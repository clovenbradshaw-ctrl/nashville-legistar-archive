// native/organs/void-satisfaction.js — satisfaction as a GENERAL, OMNIMODAL,
// LEVEL-ADDRESSED check (2026-09-21).
//
// One function, applied at ANY node of the void holarchy:
//   satisfyVoid(address: ["whole"])
//   satisfyVoid(address: ["whole","partOne"])
//   satisfyVoid(address: ["whole","partOne","paraTwo"])
// The void at that node (its nine operators) and the fillers covering it decide
// the standing. The MODALITY only names the level (text: section; code:
// module; music: movement; film: act) — the check is the same. So satisfaction
// stops being an essay ritual and a code ritual and becomes the holon's own
// test, at every depth.
//
// It is MECHANICAL (no model): coverage (DEF), kind (INS), binding to the
// anchor (CON), composition (SYN), admission (EVA), and any failure REOPENS
// the level (REC). Falsifying control: a level marked satisfied whose filler
// fails the SAME check when it is addressed as a child (low sets possibility
// for high) concedes the holarchy — a part cannot claim what its sub-part
// could not carry.
import { HOLON_LEVELS, MODALITIES } from "./void-holarchy.js";

const STOP = new Set(["the","and","for","with","that","this","from","are","was","were","its","his","her","they","them","then","than","into","onto","over","under","about","which","what","when","where","how","who","of","in","on","at","to","as","by","be","or","if","is","it","a","an","not","but","does","did","has","have","had","can","will","would","should","could"]);
const words = (s) => new Set((String(s ?? "").toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((w) => !STOP.has(w)));
const shares = (a, b) => { const A = words(a), B = words(b); for (const w of A) if (B.has(w)) return w; return null; };
const META = /^(here'?s|here is|the (?:code|answer|section|essay)|note that|as an ai|i can'?t|i cannot|no |none|n\/?a)/i;

/**
 * Satisfaction of the void at ONE addressed node of the holarchy.
 * @param {object} o
 *   address      — path of node names, e.g. ["whole"] or ["whole","partOne"]
 *   modality     — text | music | film | code
 *   void         — the level's nine-operator fields ({slot, anchor, extent, cardinality, ...})
 *   fillers      — the extents covering this node (strings or {text, grounded})
 *   declaredCount— how many fillers the node is declared to hold (else void.cardinality)
 *   grounded     — boolean (is there admitted ground?) or fn(filler) -> bool
 *   anchor       — the thing fillers must bind to (else void.anchor / void.slot)
 */
export function satisfyVoid({ address = ["whole"], modality = "text", void: v = {}, fillers = [], declaredCount = null, grounded = null, anchor = null, defined = null } = {}) {
  const names = MODALITIES[modality] ?? MODALITIES.text;
  const depth = Math.max(0, address.length - 1);
  const hl = HOLON_LEVELS[Math.min(depth, HOLON_LEVELS.length - 1)];
  const name = names[hl.level] ?? hl.level;
  const path = address.join(".");
  const subject = String(v.slot ?? v.subject ?? v.anchor ?? anchor ?? "").trim();
  const parts = fillers.map((f) => (typeof f === "string" ? { text: f } : f)).filter((p) => p && String(p.text ?? "").trim());
  const defCount = declaredCount ?? (v.cardinality != null ? Number(v.cardinality) : parts.length);
  const failures = [];

  // NUL — the space is marked off: a subject exists.
  if (!subject) failures.push({ op: "NUL", kind: "unmarked_space", detail: "no slot/subject — the space is not marked off" });
  // SIG — what must resolve: an anchor is named.
  if (!subject) failures.push({ op: "SIG", kind: "no_anchor", detail: "nothing named that must resolve" });
  // INS — the kind that may stand: fillers are the level's kind, not meta.
  parts.forEach((p, i) => { if (META.test(String(p.text).trim())) failures.push({ op: "INS", kind: "wrong_kind", detail: `${name} ${i + 1} is meta/empty, not ${name} content` }); });
  // SEG — extent + units: at least one unit.
  if (!parts.length) failures.push({ op: "SEG", kind: "no_extent", detail: `no ${name}(s) present` });
  // CON — each filler is bound to the anchor. For TEXT: shares a content term
  // (stopwords excluded). For CODE: binding is structural (a unit belongs to
  // its artifact) — a filename is not a lexical anchor, so the lexical test
  // does not apply.
  if (subject && modality !== "code") parts.forEach((p, i) => { if (!shares(subject, p.text)) failures.push({ op: "CON", kind: "unbound_filler", detail: `${name} ${i + 1} shares no term with "${subject.slice(0, 40)}"` }); });
  // SYN — the fillers compose: no duplicate units; (code) referenced names must
  // be defined SOMEWHERE in the artifact — a sub-level may call a sibling's
  // name, so `defined` (names known at higher levels) counts too.
  const seen = new Set();
  parts.forEach((p, i) => { const k = String(p.text).trim().slice(0, 80); if (seen.has(k)) failures.push({ op: "SYN", kind: "duplicate_filler", detail: `${name} ${i + 1} duplicates an earlier one` }); seen.add(k); });
  if (modality === "code") {
    const definedNames = new Set([...(defined ? [...defined] : []), ...[...String(parts.map((p) => p.text).join("\n")).matchAll(/\b(?:def|function|class|const|let|var)\s+(\w+)/g)].map((m) => m[1])]);
    const BUILTIN = new Set(["if", "for", "while", "return", "print", "function", "def", "int", "str", "len", "range", "sum", "join", "split", "map", "filter", "sorted", "list", "dict", "set", "self", "None", "True", "False", "enumerate", "zip", "abs", "min", "max", "isinstance", "type", "log", "Error", "JSON", "Object", "Array"]);
    for (const p of parts) for (const m of String(p.text).matchAll(/\b(\w+)\s*\(/g)) {
      const call = m[1];
      if (BUILTIN.has(call) || definedNames.has(call)) continue;
      failures.push({ op: "SYN", kind: "undefined_name", detail: `${call}() is called but not defined in this ${name}` });
    }
  }
  // DEF — cardinality: all declared cells filled.
  if (defCount > parts.length) failures.push({ op: "DEF", kind: "under_filled", detail: `${parts.length}/${defCount} ${name}(s) — ${defCount - parts.length} missing` });
  // EVA — admission: the ground test.
  if (typeof grounded === "function") parts.forEach((p, i) => { if (!grounded(p)) failures.push({ op: "EVA", kind: "not_admitted", detail: `${name} ${i + 1} failed admission (ungrounded)` }); });
  else if (grounded === false) failures.push({ op: "EVA", kind: "no_ground", detail: "no material ground admitted — a void cannot be filled by premise alone" });

  const ok = failures.length === 0;
  return {
    schema: "EOVoidSatisfaction@1",
    address: path, modality, level: hl.level, name,
    ok, filled: parts.length, of: defCount, failures,
    standing: ok ? "satisfied" : "reopens",
    basis: ok
      ? `the ${path} (${name}) is satisfied across the operators`
      : `${path} (${name}) REOPENS on ${[...new Set(failures.map((f) => f.op))].join(", ")}`,
  };
}
