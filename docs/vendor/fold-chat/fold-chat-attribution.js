// fold-chat-attribution.js — the model may never name a source the page did not
// give it (Constitution II.9: a model never originates a fact OR a source).
//
// Two mechanical passes over the model's own text, run before the answer is
// stored, the way `stripSelfCitations` neutralises a forged address:
//
//   stripScaffolding   the source block hands the model labelled passages
//                      ([W1], [W2] …). Those labels are the fold's scaffolding,
//                      not the model's to show. Every `[W#]` / `[S#]` / `[M]` /
//                      "[Source 2]" marker is removed from the text (with the
//                      "in" / "from" that led to it), and the passages the
//                      model pointed at are returned as `cited` — the surface
//                      draws those as real citation chips with the real title
//                      and link.
//   checkAttributions  finds source-like attributions in the answer ("According
//                      to X", "X says", "per X", "as reported by X", a
//                      "Source:" line, and the es/fr/de/pt/ru/zh equivalents)
//                      and verifies each against the turn's ACTUAL sources:
//                        1. X names a source that was read (its title, its site,
//                           its domain)  AND the claim it is attached to is
//                           supported by THAT source's text; or
//                        2. X occurs in the text that was read (or the person's
//                           own message) AND the claim is supported by the
//                           material; or
//                        3. X is generic ("the sources", "the information
//                           provided") AND something was read.
//                      Anything else is NEUTRALISED: the attribution clause is
//                      removed, the claim stays as the model's own (and is
//                      scored like any unsourced sentence), and the removal is
//                      returned so the surface can record a notice.
//
// WHAT IS DECLARED (II.11): the attribution verbs and the per-language
// connectives below are declared vocabulary. A language not listed is simply not
// checked — that is the safe direction (we only ever REMOVE a named source).

import { attribute, tokenize } from "./fold-chat-ground.js";
import { isTertiary } from "./fold-chat-tertiary.js";

const fold = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const clean = (s) => fold(s).replace(/^the\s+/, "").replace(/[.,;:!?'’"“”]+$/g, "").trim();

// ── scaffolding markers ────────────────────────────────────────────────────
// T1 / T2 are the labels of a thread-grounded reply's block (fold-chat-thread.js threadPrompt): measured, a small model that is told not to
// write them writes them ("Here's the source: … [T2]"), and nothing stripped them.
const MARK = String.raw`(?:[WS]\s?\d+|T[12]|M\d*|(?:source|sources|src)\s*:?\s*[WS]?\s?\d+)`;
const MARK_LIST = String.raw`[\[【(]\s*${MARK}(?:\s*[,;/–-]\s*(?:[WS]\s?\d+|\d+))*\s*[\]】)]`;
const LEAD_RE = new RegExp(String.raw`\s*\b(?:in|from|by|per|see|at|of|via|within)\s+(?:the\s+)?(?:source\s+)?(?:${MARK_LIST})`, "giu");
const LONE_RE = new RegExp(String.raw`[ \t]*${MARK_LIST}`, "giu");
const LABELS_RE = /\b[WS]\s?(\d+)\b/gi;

/** Remove the source-block scaffolding from model text. `sources` is the turn's
 *  passages in the order they were labelled W1, W2, …
 *  Returns { text, removed, cited:[{ n, title, url, domain }] } (cited are unique, in first-use order). */
export function stripScaffolding(text, sources = []) {
  let out = String(text ?? "");
  const found = [];
  const note = (m) => { for (const x of m.matchAll(LABELS_RE)) if (/^[ws]/i.test(x[0])) found.push(Number(x[1])); };
  let removed = 0;
  out = out.replace(LEAD_RE, (m) => { note(m); removed++; return ""; });
  out = out.replace(LONE_RE, (m) => { note(m); removed++; return ""; });
  if (removed) out = out.replace(/[ \t]+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+/gm, (m) => m);
  const cited = [];
  const seen = new Set();
  for (const n of found) {
    const src = sources[n - 1];
    if (!src || seen.has(n)) continue;
    seen.add(n);
    const ref = String(src.ref ?? "");
    // a pointer (an encyclopedia page) is never the chip: the model's [W#] shows the original pages its references led to and were read, else the
    // pages it only points at, each marked `pointer` (fold-chat-origin.js sets `origins` / `pointers` on the passage)
    if (isTertiary(src.url || src.source)) {
      const read = Array.isArray(src.origins) ? src.origins : [];
      const list = read.length ? read.map((o) => ({ ...o, pointer: false })) : (Array.isArray(src.pointers) ? src.pointers : []).slice(0, 3).map((o) => ({ ...o, pointer: true }));
      for (const o of list) {
        if (!o || !/^https?:/i.test(String(o.url || ""))) continue;
        let d = null; try { d = new URL(String(o.url)).hostname.replace(/^www\./, ""); } catch { /* not a url */ }
        cited.push({ n: "W" + n, title: String(o.title || o.label || d || o.url), url: o.url, domain: d, ...(o.pointer ? { pointer: true } : {}) });
      }
      continue;
    }
    const title = (ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : ref).trim();
    let domain = null;
    try { domain = new URL(String(src.url || src.source)).hostname.replace(/^www\./, ""); } catch { /* not a url */ }
    cited.push({ n: "W" + n, title: title || ref, url: /^https?:/i.test(String(src.url || src.source || "")) ? (src.url || src.source) : null, domain });
  }
  return { text: out, removed, cited };
}

// ── the names a turn actually has ──────────────────────────────────────────
function hostLabels(u) {
  try {
    const h = new URL(String(u)).hostname.replace(/^www\./, "");
    const parts = h.split(".");
    const labels = [fold(h)];
    // the registrable label: weather.com → weather, bbc.co.uk → bbc, en.wikipedia.org → wikipedia
    const tld2 = ["co", "com", "org", "gov", "ac", "edu"];
    const core = parts.length >= 3 && tld2.includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    labels.push(fold(core));
    return labels;
  } catch { return []; }
}

/** The identity strings of each source the turn read: its title pieces, its site, its domain. */
export function sourceIdentities(sources = []) {
  return (Array.isArray(sources) ? sources : []).map((s, i) => {
    const ref = String(s.ref ?? "");
    const site = ref.includes(" — ") ? ref.slice(0, ref.indexOf(" — ")) : "";
    const title = ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : ref;
    const names = new Set();
    // an encyclopedia is a pointer, never a source a model may name ("according to Wikipedia" is neutralised): its text still counts as
    // material the claim may rest on, but it gives no name to attribute to (fold-chat-origin.js follows it to the pages it points at)
    if (isTertiary(s.url || s.source)) return { i, names: [], material: { ref: s.ref, source: s.source || s.url, text: String(s.text ?? "") } };
    for (const piece of [site, title, ...String(title).split(/\s[-|–—·]\s|\s\|\s/)]) { const c = clean(piece); if (c.length >= 3) names.add(c); }
    for (const l of [...hostLabels(s.url), ...hostLabels(s.source)]) if (l.length >= 3) names.add(l);
    return { i, names: [...names], material: { ref: s.ref, source: s.source || s.url, text: String(s.text ?? "") } };
  });
}

// ── the attribution patterns ───────────────────────────────────────────────
// A capitalised name phrase: "Wikipedia", "The Weather Channel", "the BBC", "Dr. Ruth Smith".
const CAP = String.raw`\p{Lu}[\p{L}\p{N}&'’-]*(?:\.[\p{L}\p{N}]+)*`;
const NAME = String.raw`(?:the\s+)?${CAP}(?:\s+(?:(?:of|for|and|&|de|del|von|van|la|le|du)\s+)?${CAP}){0,5}`;
// only REPORTING verbs: "Jane Austen wrote it" or "the guide lists three steps" is content, not an attribution
const SAYS = String.raw`(?:says|said|states|stated|reports|reported|notes|noted|claims|claimed|explains|explained|indicates|indicated|suggests|suggested)`;
const PATTERNS = [
  // a generic reference ("according to the information provided") — no name, but it claims there is something
  { re: /(?<![\p{L}])[Aa]ccording to\s+(the\s+(?:information|sources?|search results?|passages?|text|documents?|articles?|pages?|material|context|data)(?:\s+(?:provided|given|above|you gave|available))?)\s*(?:[,:]\s*)?/gu, lead: true, generic: true },
  { re: new RegExp(String.raw`(?<![\p{L}])[Aa]ccording to\s+(${NAME})\s*(?:[,:]\s*)?`, "gu"), lead: true },
  { re: new RegExp(String.raw`(?<![\p{L}])(${CAP}(?:\s+${CAP}){0,5})\s+${SAYS}(?:\s+that)?\s+`, "gu"), lead: true, subject: true },
  { re: new RegExp(String.raw`(?<![\p{L}])(?:[Aa]s\s+)?(?:reported|stated|noted|published|cited|according)\s+(?:by|in|to)\s+(${NAME})`, "gu"), lead: false },
  { re: new RegExp(String.raw`(?<![\p{L}])[Pp]er\s+(${NAME})\s*(?:[,:]\s*)?`, "gu"), lead: true },
  // es / pt / fr / de / ru
  { re: new RegExp(String.raw`(?<![\p{L}])(?:[Ss]egún|[Ss]egundo|[Dd]e acuerdo con|[Dd]e acordo com|[Ss]elon|[Dd]'après|[Ll]aut|[Nn]ach Angaben (?:von|des|der))\s+(${NAME})\s*(?:[,:]\s*)?`, "gu"), lead: true },
  { re: new RegExp(String.raw`(?<![\p{L}])(?:[Пп]о данным|[Сс]огласно|[Пп]о словам)\s+([\p{Lu}][\p{L}\p{N}&.'’-]*(?:\s+[\p{Lu}][\p{L}\p{N}&.'’-]*){0,4})\s*(?:[,:]\s*)?`, "gu"), lead: true },
  // zh: 根据X(的报道) / 据X报道
  { re: /(?:根据|依据|据)([\p{Script=Han}\p{Script=Latin}\d·]{2,12}?)(?:的?(?:报道|数据|资料|信息|统计)|报道|称|表示|介绍|说)?(?=[，,。；;：:、\s]|$)/gu, lead: true, zh: true },
];
// Capitalised words that open a sentence but are not names of anything: pronouns, determiners,
// and plural common nouns ("Studies show", "Experts say"). A subject like these is not a source.
const NOT_A_NAME = new Set("he she it they we you i this that these those there here one who many some most others people studies research experts scientists doctors reports sources officials critics historians scholars researchers analysts evidence data surveys polls observers users readers fans sources sentences often usually generally typically".split(" "));
// generic source references — not names; allowed iff something was read
const GENERIC = new Set(["the information provided", "information provided", "the information", "the sources", "sources", "the sources provided", "the sources provided", "the search results", "search results", "the passages", "the text", "the document", "the documents", "the article", "the articles", "the page", "the pages", "the material", "the context", "the data provided", "the provided information", "the provided sources", "the provided text", "you", "your message", "your document", "your text", "the user", "what you wrote", "the above"]);

const sentenceBounds = (text, a, b) => {
  let s = a; while (s > 0 && !/[.!?\n。！？]/.test(text[s - 1])) s--;
  let e = b; while (e < text.length && !/[.!?\n。！？]/.test(text[e])) e++;
  return [s, Math.min(text.length, e + 1)];
};
const cap1 = (s) => s.replace(/^(\s*)(\p{Ll})/u, (_, w, c) => w + c.toUpperCase());

/** Check every named attribution in `text` against the turn's sources.
 *  opts: { sources: [{ref, source, url, text}], material: [{ref, source, text}] (attachments / pasted text that also count), userText }
 *  Returns { text, kept: [name…], removed: [{ name, phrase, reason }] }. Never throws. */
export function checkAttributions(text, { sources = [], material = [], userText = "" } = {}) {
  let out = String(text ?? "");
  if (!out) return { text: out, kept: [], removed: [] };
  const ids = sourceIdentities(sources);
  const all = [...ids.map((x) => x.material), ...(Array.isArray(material) ? material : [])];
  const haveSomething = all.some((m) => String(m?.text ?? "").trim().length >= 40);
  const hay = new Set(); for (const m of all) for (const t of tokenize(m?.text ?? "")) hay.add(t);
  const userHay = new Set(tokenize(userText));
  const kept = [], removed = [];
  const supportedBy = (claim, mats) => {
    if (!mats.length || !String(claim).trim()) return false;
    try { return attribute(claim, mats).some((e) => e.ref); } catch { return false; }
  };
  for (const pat of PATTERNS) {
    // re-run on the progressively edited text until no unverified match remains
    let guard = 0;
    const seenHere = new Set();
    for (;;) {
      if (++guard > 24) break;
      pat.re.lastIndex = 0;
      let hit = null;
      for (const m of out.matchAll(pat.re)) { if (!seenHere.has(m.index + ":" + m[0])) { hit = m; break; } }
      if (!hit) break;
      seenHere.add(hit.index + ":" + hit[0]);
      const name = (hit[1] || "").trim();
      const key = clean(name);
      if (!key) continue;
      const start = hit.index, end = hit.index + hit[0].length;
      const [s0, e0] = sentenceBounds(out, start, end);
      const claim = (out.slice(s0, start) + " " + out.slice(end, e0)).trim();
      let verdict;
      if (pat.subject && (NOT_A_NAME.has(key) || (key.split(" ").length === 1 && NOT_A_NAME.has(key)))) continue;
      if (GENERIC.has(key)) verdict = key === "you" || /^your|^the user|^what you/.test(key) || haveSomething ? "ok" : "no-material";
      else {
        const named = ids.filter((x) => x.names.some((n) => n === key || (key.length >= 4 && (n.includes(key) || (n.length >= 4 && key.includes(n))))));
        const namedMats = named.map((x) => x.material);
        if (named.length) verdict = supportedBy(claim, namedMats) ? "ok" : "not-supported-by-source";
        else {
          const parts = tokenize(name).filter((p) => p.length > 1);
          const inText = parts.length > 0 && parts.every((p) => hay.has(p));
          const inUser = parts.length > 0 && parts.every((p) => userHay.has(p));
          if (inUser) verdict = "ok";
          else if (inText) verdict = supportedBy(claim, all) ? "ok" : "not-supported-by-source";
          else verdict = "not-a-source";
        }
      }
      if (verdict === "ok") { kept.push(name); continue; }
      // NEUTRALISE: drop the attribution clause, keep the claim as the model's own.
      removed.push({ name, phrase: hit[0].trim(), reason: verdict });
      const before = out.slice(0, start), after = out.slice(end);
      const atStart = /(^|[.!?\n。！？]\s*)$/.test(before);
      if (atStart) out = before + cap1(after.replace(/^[\s,，、;；:：]+/, ""));
      else out = before.replace(/[ \t]*[,;:]?[ \t]*$/, "") + (/^[ \t]*[.,;!?。！？]/.test(after) ? "" : " ") + after.replace(/^[ \t]+/, "");
      seenHere.clear();
    }
  }
  // a "Source:" / "Sources:" line — each listed name verified, unverified ones dropped
  out = out.replace(/^[ \t]*(?:\*\*)?(?:Sources?|References?|Fuentes?|Sources|Quellen|Источники|来源|資料)(?:\*\*)?[ \t]*:[ \t]*(.+)$/gimu, (line, list) => {
    const parts = list.split(/[;,]\s*|\s+\|\s+/).map((x) => x.trim()).filter(Boolean);
    const good = parts.filter((p) => {
      const key = clean(p.replace(/[*_`]/g, ""));
      return key && (GENERIC.has(key) ? haveSomething : ids.some((x) => x.names.some((n) => n === key || (key.length >= 4 && n.includes(key)))));
    });
    const bad = parts.filter((p) => !good.includes(p));
    for (const b of bad) removed.push({ name: b, phrase: line.trim(), reason: "not-a-source" });
    return good.length === parts.length ? line : good.length ? line.replace(list, good.join(", ")) : "";
  }).replace(/\n{3,}/g, "\n\n");
  return { text: out, kept, removed };
}

/** The one typed notice for what checkAttributions removed — null when nothing was. */
export function attributionNotice(removed) {
  const list = (Array.isArray(removed) ? removed : []).filter((r) => r && r.name);
  if (!list.length) return null;
  const names = [...new Set(list.map((r) => r.name))].slice(0, 4);
  const why = list.some((r) => r.reason === "not-supported-by-source")
    ? "and what it was attached to is not in that source's text"
    : "and no such source was read for this turn";
  return {
    kind: "attribution",
    text: `An attribution was removed: the answer credited ${names.map((n) => "“" + n + "”").join(", ")}, ${why}. The sentence remains as the model's own wording and is scored like any other.`,
    removed: list.slice(0, 8).map((r) => ({ name: r.name, reason: r.reason })),
  };
}
