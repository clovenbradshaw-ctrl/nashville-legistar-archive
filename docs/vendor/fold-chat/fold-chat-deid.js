// fold-chat-deid.js — take the identifying details out of a request before it leaves, put them back in the reply.
//
// PSEUDONYMIZATION, and the audit grades it as exactly that ("masked", never "sealed"): what identifies a person is replaced
// by an opaque PER-TURN id — a type and six random characters (PERSON_k3f9ax) — the real values stay in a map held in this
// closure, and the reply is mapped back locally. The ids are random and issued fresh for every turn, so the same name is
// a different id next turn and no id says anything about the name. The structure of the request and of the code is
// untouched: the outside service can still read what the code DOES, not who it is about or where they live.
//
// WHAT FINDS WHAT. Judgement is a Python PII redactor's (scripts/pii: Presidio + a spaCy pipeline + recognizers for handles,
// street addresses and proper-noun tags, so lowercase and informal typing is read too); it returns spans, this module
// replaces them. No word list decides anything. This module itself carries only SHAPES that need no model:
// keys and tokens, emails, home-path usernames, phone and SSN shapes, private hosts, a title and the name after it,
// and every term in the taint registry (what the Fold read locally) plus any `extra` terms the caller found.
//
// MODES. "default" masks everything the redactor reports. "open" is the person's opt-in to sending more of their
// own material (see fold-chat-seal NEVER_SENT, and the CONTEXT types below): it leaves places, organisations and links
// readable, and STILL masks every personal identifier — a name, a handle, an email, a phone, an address, a number that
// identifies, a key. Nobody's PII leaves in either mode.
//
// WHAT IT DOES NOT CATCH: a personal detail the redactor does not report and no shape matches. The caller verifies
// the masked text by running the redactor over it again (fold-chat-client remoteCode) and fails closed.
//
// Pure: no DOM, no network. The map is the key; it is never exported, logged or recorded.

import { SECRET_PATTERNS, EMAIL } from "./fold-chat-seal.js";

const PREFIXES = ["PERSON", "NAME", "ORG", "LOC", "GROUP", "URL", "HANDLE", "ADDRESS", "USER", "PATH", "FILE", "TERM", "EMAIL", "PHONE", "SECRET", "HOST", "ID"];
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";   // no i, l, o, 0, 1: nothing to misread
const ID_CLASS = "[a-hj-km-np-z2-9]{6}";
const PLACEHOLDER = new RegExp("(?:" + PREFIXES.join("|") + ")_" + ID_CLASS, "gi");
const ONLY_PLACEHOLDER = new RegExp("^(?:" + PREFIXES.join("|") + ")_" + ID_CLASS + "$", "i");
const GENERIC_USERNAMES = new Set(["user", "users", "admin", "root", "runner", "ubuntu", "shared", "guest", "node", "home", "app", "ec2-user"]);

/** What a span from the redactor is, and whether it is personal. Anything not listed (DATE_TIME, AGE …) is not masked: it does not identify alone. */
export const SPAN_TYPES = Object.freeze({
  PERSON: ["PERSON", true], NAME_CANDIDATE: ["NAME", true], HANDLE: ["HANDLE", true], ADDRESS: ["ADDRESS", true],
  EMAIL_ADDRESS: ["EMAIL", true], PHONE_NUMBER: ["PHONE", true], IP_ADDRESS: ["HOST", true], MAC_ADDRESS: ["HOST", true],
  CREDIT_CARD: ["ID", true], IBAN_CODE: ["ID", true], US_SSN: ["ID", true], US_ITIN: ["ID", true], US_PASSPORT: ["ID", true], US_DRIVER_LICENSE: ["ID", true],
  US_BANK_NUMBER: ["ID", true], UK_NHS: ["ID", true], MEDICAL_LICENSE: ["ID", true], CRYPTO: ["SECRET", true],
  LOCATION: ["LOC", false], ORGANIZATION: ["ORG", false], NRP: ["GROUP", false], URL: ["URL", false],   // context: left readable in "open"
});

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const global = (re) => new RegExp(re.source, re.flags.replace(/[gd]/g, "") + "gd");
const prefixOfKind = (kind) => (/path|folder/i.test(kind) ? "PATH" : /file/i.test(kind) ? "FILE" : /user/i.test(kind) ? "USER" : /name|person/i.test(kind) ? "NAME" : "TERM");

// Shapes found by pattern. `group` masks only that capture (a password's value, not its name).
const PATTERNS = [
  ...SECRET_PATTERNS.filter(([k]) => k !== "password assignment").map(([, re]) => ({ prefix: "SECRET", pri: 0, re: global(re) })),
  { prefix: "SECRET", pri: 0, re: global(/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?([^\s"']{8,})/i), group: 1 },
  { prefix: "EMAIL", pri: 0, re: global(EMAIL) },
  { prefix: "USER", pri: 1, re: global(/(?:\/Users|\/home)\/([A-Za-z0-9._-]+)(?=\/)/), group: 1 },
  { prefix: "USER", pri: 1, re: global(/[A-Za-z]:\\Users\\([^\\\s]+)(?=\\)/), group: 1 },
  { prefix: "NAME", pri: 1, re: global(/\b(?:Dr|Mr|Mrs|Ms|Miss|Prof|Rev|Sen|Rep|Judge)\.?\s+([\p{Lu}][\p{L}'’-]{2,})/u), group: 1 },
  { prefix: "ID", pri: 1, re: global(/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/) },
  { prefix: "PHONE", pri: 1, re: global(/(?<![\d.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\d])/) },
  { prefix: "HOST", pri: 1, re: global(/\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/) },
  { prefix: "HOST", pri: 1, re: global(/\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:local|internal|corp|lan|intranet)\b/i) },
];

/** Where the placeholders already sit in a text: [[start, end], …]. A span that touches one is the redactor reading our own ids, not a detail. */
export function placeholderRanges(text) { return [...String(text ?? "").matchAll(PLACEHOLDER)].map((m) => [m.index, m.index + m[0].length]); }
/** The spans of one text that this mode masks. A proper-noun tag that sits inside a place or organisation the redactor
 *  named is that place or organisation, not a person: in "open" it is left readable with it. */
export function maskableSpans(spans, mode = "default", minScore = 0.35) {
  const list = (spans || []).filter((sp) => SPAN_TYPES[sp?.type] && !(sp.score != null && sp.score < minScore));
  const context = list.filter((sp) => !SPAN_TYPES[sp.type][1]);
  return list.filter((sp) => {
    const t = SPAN_TYPES[sp.type];
    if (mode === "open" && !t[1]) return false;
    if (sp.type === "NAME_CANDIDATE" && context.some((c) => c.start <= sp.start && sp.end <= c.end)) return false;
    return true;
  });
}
/** Would this one span be masked in this mode (judged alone)? */
export function spanIsMasked(span, mode = "default", minScore = 0.35) { return maskableSpans([span], mode, minScore).length > 0; }

/** A call-shaped code fragment, as a whole span: identifier(args)… where every argument is a number or a short token with a digit or a single letter
 *  (set(k2,138) set(k5,322)). A name inside the call (greet(priya)) is NOT this shape, so it is still masked. Pass in `exempt`; opt-in. */
export const CODE_CALLS = /(?:[A-Za-z_][\w.]*\((?:\s*(?:\d+|[A-Za-z]\d*|[A-Za-z]{1,2}\d+)\s*(?:,\s*(?:\d+|[A-Za-z]\d*|[A-Za-z]{1,2}\d+)\s*)*)?\)?\s*)+/;

/** Capitalised multi-word names in a text ("Eleanor Voss") — a floor for when no redactor is reachable. */
export function namesIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{Ll}'’-]{2,}(?:[ \t]+\p{Lu}[\p{Ll}'’-]{2,})+(?![\p{L}\p{N}])/gu)) out.add(m[0]);
  return [...out];
}

const bounded = (t) => `(?<![\\p{L}\\p{N}_])${esc(t)}(?![\\p{L}\\p{N}_])`;
const randomId = () => { const b = new Uint8Array(6); globalThis.crypto.getRandomValues(b); return [...b].map((x) => ID_ALPHABET[x % ID_ALPHABET.length]).join(""); };

/** A fresh masker. One per outbound TURN: its ids and its map die with it. `taint` is a createTaint() registry;
 *  `extra` are terms the caller found ("Eleanor" or {term, kind, whole}); `mode` is "default" or "open". */
export function createDeid({ taint = null, extra = [], mode = "default", minScore = 0.35, exempt = [] } = {}) {
  // Redactor spans whose text is one of these (a RegExp that matches the whole span, or an exact string) are left alone: code-ish tokens
  // such as k2 or ES that a name tagger reads as names. Shapes (keys, emails) and the taint registry are never exempt.
  const isExempt = (s) => exempt.some((x) => (x instanceof RegExp ? new RegExp("^(?:" + x.source + ")$", x.flags.replace(/[gy]/g, "")).test(s) : String(x).toLowerCase() === s.toLowerCase()));
  const extras = [...new Map((extra || []).map((e) => (typeof e === "string" ? { term: e, kind: "name" } : e)).filter((e) => e?.term && String(e.term).trim().length >= 3).map((e) => [String(e.term).trim(), { term: String(e.term).trim(), kind: e.kind || "name", whole: e.whole !== false }])).values()];
  const extraRe = (e, flags = "iu") => new RegExp(e.whole ? bounded(e.term) : esc(e.term), flags);   // a piece of an identifier has no word edges to hold to
  const forward = new Map();   // "PREFIX\u0000surface" → placeholder
  const back = new Map();      // lowercased placeholder → original surface form, exactly as it appeared
  const reserved = new Set();  // placeholder-shaped tokens the text already contains — never issued, so nothing is confused

  const issue = (prefix, surface) => {
    const k = prefix + "\u0000" + surface;
    let ph = forward.get(k);
    if (!ph) {
      let id; do { id = randomId(); ph = `${prefix}_${id}`; } while (reserved.has(ph.toLowerCase()) || back.has(ph.toLowerCase()));
      forward.set(k, ph); back.set(ph.toLowerCase(), surface);
    }
    return ph;
  };

  /** Every match in `text`, in the text's own coordinates: { start, end, prefix, pri }. Lower pri wins ties. */
  const collect = (text, spans) => {
    const out = [];
    for (const { prefix, pri, re, group } of PATTERNS) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(text)); ) {
        const idx = group == null ? m.indices[0] : m.indices[group];
        if (idx && !ONLY_PLACEHOLDER.test(text.slice(idx[0], idx[1]))) out.push({ start: idx[0], end: idx[1], prefix, pri });
        if (m[0] === "") re.lastIndex++;
      }
    }
    const terms = new Map();   // surface → { prefix, whole }
    if (taint) for (const h of taint.scan(text)) terms.set(h.term, { prefix: prefixOfKind(h.kind || ""), whole: false });
    for (const e of extras) if (!terms.has(e.term)) terms.set(e.term, { prefix: prefixOfKind(e.kind), whole: e.whole });
    for (const m of text.matchAll(/(?:\/Users|\/home)\/([A-Za-z0-9._-]{3,})(?=\/)|[A-Za-z]:\\Users\\([^\\\s]{3,})(?=\\)/g)) {
      const u = m[1] || m[2];
      if (!GENERIC_USERNAMES.has(u.toLowerCase()) && !terms.has(u)) terms.set(u, { prefix: "USER", whole: false });
    }
    for (const [term, { prefix, whole }] of terms) {
      const re = extraRe({ term, whole }, "giu");
      for (let m; (m = re.exec(text)); ) out.push({ start: m.index, end: m.index + m[0].length, prefix, pri: 1 });
    }
    for (const sp of maskableSpans(spans, mode, minScore)) {
      const t = SPAN_TYPES[sp.type];
      if (Number.isInteger(sp.start) && Number.isInteger(sp.end) && isExempt(text.slice(sp.start, sp.end))) continue;
      if (Number.isInteger(sp.start) && Number.isInteger(sp.end) && sp.end > sp.start && sp.end <= text.length) out.push({ start: sp.start, end: sp.end, prefix: t[0], pri: 2 });
    }
    return out;
  };

  /** Overlapping matches become ONE span (the union masks more, never less); its type is the strongest member's. */
  const union = (ms) => {
    ms.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const m of ms) {
      const last = merged[merged.length - 1];
      if (last && m.start < last.end) {
        const longer = m.end - m.start > last.end - last.start;
        if (m.pri < last.pri || (m.pri === last.pri && longer)) { last.prefix = m.prefix; last.pri = m.pri; }
        last.end = Math.max(last.end, m.end);
      } else merged.push({ ...m });
    }
    return merged;
  };

  const api = {
    /** Mask several texts that travel together. `spans[i]` are the redactor's spans for `texts[i]` ({start, end, type, score}, JS indices). */
    maskAll(texts, { spans = null } = {}) {
      const list = texts.map((t) => String(t ?? ""));
      for (const t of list) for (const m of t.matchAll(PLACEHOLDER)) reserved.add(m[0].toLowerCase());
      return list.map((t, i) => {
        let out = "", at = 0;
        for (const m of union(collect(t, spans?.[i]))) { out += t.slice(at, m.start) + issue(m.prefix, t.slice(m.start, m.end)); at = m.end; }
        return out + t.slice(at);
      });
    },
    mask(text, o) { return api.maskAll([text], o && o.spans ? { spans: [o.spans] } : undefined)[0]; },
    /** Put the originals back into a reply. A placeholder this turn never issued is left exactly as written; a model that changed its case still finds its way home. */
    unmask(text) {
      return String(text ?? "").replace(new RegExp("(" + PREFIXES.join("|") + ")_(" + ID_CLASS + ")", "gi"), (whole, p, id) => back.get(`${p}_${id}`.toLowerCase()) ?? whole);
    },
    /** What is STILL in a masked text that must not be: the kinds only, never the values. Empty = clean. */
    residual(masked) {
      const t = String(masked ?? "");
      const hits = [];
      if (taint) for (const h of taint.scan(t)) hits.push({ type: "particular", kind: h.kind });
      for (const e of extras) if (extraRe(e).test(t)) hits.push({ type: "particular", kind: e.kind });
      const stripped = t.replace(PLACEHOLDER, "§");
      for (const { prefix, re, group } of PATTERNS) { re.lastIndex = 0; for (let m; (m = re.exec(stripped)); ) { const idx = group == null ? m.indices[0] : m.indices[group]; if (idx && !/^§+$/.test(stripped.slice(idx[0], idx[1]))) { hits.push({ type: "pattern", kind: prefix.toLowerCase() }); break; } if (m[0] === "") re.lastIndex++; } re.lastIndex = 0; }
      return hits;
    },
    /** What was masked, by kind and count — no values. */
    stats() {
      const kinds = {};
      for (const [ph] of back) { const p = ph.slice(0, ph.indexOf("_")).toUpperCase(); kinds[p] = (kinds[p] || 0) + 1; }
      return { count: back.size, kinds, mode };
    },
    /** Is this span text exempt (code-ish, left alone)? */
    exempts: isExempt,
    mode,
  };
  return api;
}
