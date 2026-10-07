// Handle: Ariel — Mira Ariel, whose accessibility theory reads how a text
// refers back to what it already set down: a full name for what has faded, a
// pronoun for what is still present. A book is only held if what it said is
// read back.
//
// read-back.js — THE BOOK READ BACK INTO THE RECORD. The ear (talk-reader.js)
// hears everything the mouth says while an outline is built; after that the
// bodies were stored and never read again, so every act that needs what the
// prose itself said had nothing to stand on (ONE-PIPELINE.md, "The missing
// elements"). This reads each body mechanically, and the organs below stand
// on the reading, one empty phasepost each:
//
//   readBack        SIG·Figure  (Entity · Binding) — who each part names, and
//                   who its pronouns bind to (adapters/text/pronouns.js, by
//                   activation); the strangers it names; the possessive facts
//                   it states ("Lily's dog is Rex")
//   clearance       NUL·Figure  (Entity · Dissecting) — a stranger is present
//                   once; it is ESTABLISHED when it recurs in RECURRENCE_FLOOR
//                   parts, and only then may it join the record
//   stuck           NUL·Pattern (Kind · Unraveling) — kernel/settling.js over
//                   what each part holds: a stream that holds in any order is
//                   stuck; one that holds in stretches that break is moving
//   seams           SEG·Pattern (Network · Unraveling) — the parts as a chain
//                   linked by the beings they share; a link carrying nothing
//                   is a seam, where the book falls apart
//   laws            DEF·Pattern (Paradigm · Unraveling) — the prose's own
//                   possessive facts scanned for functional relations
//                   (organs/hl-acquire.js): a relation one subject binds to two
//                   values is refuted — a contradiction the book made itself
//
// No regular expressions.
import { createActivation } from "../kernel/activation.js";
import { resolvePronounsByActivation } from "../adapters/text/pronouns.js";
import { settling } from "../kernel/settling.js";
import { scanFunctionalCandidates } from "./hl-acquire.js";

export const READ_BACK_SCHEMA = "ReadBack@1";

/** The activation arm's declared reach — set by hand 2026-09-28, the values
 *  tests/pronouns.test.js runs the arm under (ACT_OPTS): a present of eight
 *  sentences, a fifth of a naming to bind, a fifth's lead over the next. */
export const PRONOUN_OPTS = Object.freeze({ window: 8, minActivation: 0.2, minMargin: 0.2 });
/** A stranger named in this many parts has recurred — set by hand
 *  2026-09-28, the structural minimum the-fold/resolutions.js and network.js
 *  declare (one arrival has no recurrence to test). */
export const RECURRENCE_FLOOR = 2;
/** Words capitalised for reasons other than being a name — set by hand
 *  2026-09-27 (eval/long-form/score.mjs's list, moved here so the scorer and
 *  the reader read strangers the same way). */
export const NOT_NAMES = new Set(["I", "I'm", "I'll", "I've", "I'd", "Mom", "Dad", "Mama", "Papa", "God", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Chapter", "Mr", "Mrs", "Ms", "Dr", "OK", "Oh"]);

const isLetter = (ch) => !!ch && ch.toLowerCase() !== ch.toUpperCase();
const isCap = (w) => !!w && isLetter(w[0]) && w[0] !== w[0].toLowerCase();
/** A word without its surrounding punctuation or possessive. */
export const clean = (w) => { let x = String(w); while (x && !isLetter(x.at(-1)) && !(x.at(-1) >= "0" && x.at(-1) <= "9")) x = x.slice(0, -1); while (x && !isLetter(x[0]) && !(x[0] >= "0" && x[0] <= "9")) x = x.slice(1); if (x.endsWith("'s") || x.endsWith("’s")) x = x.slice(0, -2); return x; };
/** Whole-word occurrence of a (possibly multi-word) name. */
export const hasName = (text, name) => { const t = String(text); let i = t.indexOf(name); while (i >= 0) { if (!isLetter(t[i - 1]) && !isLetter(t[i + name.length])) return true; i = t.indexOf(name, i + 1); } return false; };

const DETERMINERS = new Set(["a", "an", "the", "her", "his", "their", "its", "my", "our", "your"]);
const COPULA = new Set(["is", "was"]);
const STOPS = new Set(["and", "but", "who", "which", "that", "because", "while", "when"]);

/** Possessive facts a sentence states of a cast member: "Lily's old dog was
 *  Rex, …" -> { end1: lily, label: "old dog", end2: "Rex" }; and an age said
 *  outright, "Lily is 30" -> label "age". */
export function factsIn(text, cast) {
  const words = String(text).split(" ").filter(Boolean);
  const out = [];
  for (const c of cast) {
    const nameWords = c.name.split(" ");
    for (let i = 0; i + nameWords.length <= words.length; i++) {
      const head = nameWords.slice(0, -1).every((w, k) => clean(words[i + k]) === w);
      if (!head) continue;
      const last = words[i + nameWords.length - 1];
      const at = i + nameWords.length;
      const possessive = last === `${nameWords.at(-1)}'s` || last === `${nameWords.at(-1)}’s`;
      if (possessive) {
        let j = at; const rel = [];
        while (j < words.length && !COPULA.has(words[j].toLowerCase()) && rel.length < 3) { rel.push(clean(words[j]).toLowerCase()); if (words[j].endsWith(",") || words[j].endsWith(".")) break; j++; }
        if (j >= words.length || !COPULA.has(words[j].toLowerCase())) continue;
        const val = [];
        for (let k = j + 1; k < words.length && val.length < 5; k++) { const w = clean(words[k]); if (!w || STOPS.has(w.toLowerCase())) break; val.push(w); if ([",", ".", ";", "!", "?"].includes(words[k].at(-1))) break; }
        const label = rel.filter((w) => w && !DETERMINERS.has(w)).join(" ");
        const value = val.filter((w) => !DETERMINERS.has(w.toLowerCase())).join(" ");
        if (label && value) out.push({ end1: c.id, label, end2: value, polarity: "+" });
      } else if (clean(last) === nameWords.at(-1) && COPULA.has((words[at] ?? "").toLowerCase())) {
        const n = clean(words[at + 1] ?? "");
        if (n && [...n].every((ch) => ch >= "0" && ch <= "9")) out.push({ end1: c.id, label: "age", end2: n, polarity: "+" });
      }
    }
  }
  return out;
}

/**
 * readBack({ parts, cast, sentences, known }) -> { schema, parts: [...], bindings, gaps }
 *   parts  [{ id, chapter, lines: [{ text, addr }] }] in the book's order
 *   cast   [{ id, name }]
 *   known  words that are the universe's own (the cast's detail values)
 * Per part: `named` (cast ids named), `bound` (cast ids a pronoun binds to,
 * where no name is in the sentence), `present` (either), `strangers`
 * (capitalised words inside a sentence that are not the cast's), `facts`.
 */
export function readBack({ parts, cast, sentences, known = [] }) {
  const surfaces = new Map(cast.map((c) => [c.name, c.id]));
  // the cast's names and the words of their details are the universe's, never strangers (as eval/long-form/score.mjs reads them)
  const castWords = new Set([...cast.flatMap((c) => c.name.split(" ")), ...known.flatMap((v) => String(v).split(" ").map(clean))]);
  const flat = [];
  let order = 0;
  for (const [pi, p] of parts.entries()) for (const l of p.lines) for (const s of sentences(l.text)) flat.push({ text: s.text, order: order++, offset: 0, part: pi, addr: l.addr ?? null });
  const { bindings, gaps } = resolvePronounsByActivation(flat, surfaces, { ...PRONOUN_OPTS, createActivation });
  const boundAt = new Map();
  for (const b of bindings) boundAt.set(b.sentenceOrder, [...(boundAt.get(b.sentenceOrder) ?? []), b.referentId]);
  const out = parts.map((p) => ({ id: p.id, chapter: p.chapter ?? null, named: new Set(), bound: new Set(), strangers: new Map(), facts: [] }));
  for (const s of flat) {
    const r = out[s.part];
    for (const c of cast) if (hasName(s.text, c.name)) r.named.add(c.id);
    for (const id of boundAt.get(s.order) ?? []) r.bound.add(id);
    for (const w0 of s.text.split(" ").slice(1)) { const w = clean(w0); if (w && isCap(w) && w.length > 1 && w !== w.toUpperCase() && !castWords.has(w) && !NOT_NAMES.has(w)) r.strangers.set(w, (r.strangers.get(w) ?? 0) + 1); }
    for (const f of factsIn(s.text, cast)) r.facts.push({ ...f, addr: s.addr, part: r.id });
  }
  return {
    schema: READ_BACK_SCHEMA,
    parts: out.map((r) => ({ ...r, named: [...r.named], bound: [...r.bound], present: [...new Set([...r.named, ...r.bound])], strangers: Object.fromEntries(r.strangers) })),
    bindings: bindings.length,
    gaps: gaps.length,
  };
}

/** NUL·Figure — does a stranger clear its ground: established when named in
 *  RECURRENCE_FLOOR parts or more, refused as a one-off otherwise. */
export function clearance(read, { floor = RECURRENCE_FLOOR } = {}) {
  const partsOf = new Map();
  read.parts.forEach((p, k) => { for (const w of Object.keys(p.strangers)) { if (!partsOf.has(w)) partsOf.set(w, []); partsOf.get(w).push(k); } });
  const established = [], refused = [];
  for (const [name, ks] of partsOf) (ks.length >= floor ? established : refused).push({ name, parts: ks.length, first: read.parts[ks[0]].id, firstIndex: ks[0] });
  established.sort((a, b) => b.parts - a.parts);
  return { established, refused, floor };
}

/** NUL·Pattern — what each part holds, as slots for kernel/settling.js: who
 *  is present, and the first word each part opens on. */
export function stuck(read, { pValue, rng, shuffles = 400, openings = null }) {
  const steps = read.parts.map((p, k) => ({ present: [...p.present].sort().join("+") || "no one", ...(openings ? { opens: openings[k] ?? "" } : {}) }));
  return settling(steps, { pValue, rng, shuffles });
}

/** SEG·Pattern — the parts as a chain linked by the beings they share
 *  (present cast and established strangers). A link sharing nothing is a
 *  seam. Returned as the indices k where parts k-1 and k share no being. */
export function seams(read, { established = [] } = {}) {
  const known = new Set(established.map((e) => e.name));
  const beings = (p) => new Set([...p.present, ...Object.keys(p.strangers).filter((w) => known.has(w))]);
  const out = [];
  for (let k = 1; k < read.parts.length; k++) { const a = beings(read.parts[k - 1]), b = beings(read.parts[k]); if (![...b].some((x) => a.has(x))) out.push(k); }
  return out;
}

/** DEF·Pattern — the prose's own possessive facts scanned for functional
 *  relations: refuted (one subject, two values — the book contradicting
 *  itself), candidate, or underpowered. */
export function laws(read) {
  const edges = read.parts.flatMap((p) => p.facts);
  const scan = scanFunctionalCandidates(edges);
  // the contradictions themselves, with where each value was said
  const bySubj = new Map();
  for (const e of edges) { const k = `${e.end1}|${e.label}`; if (!bySubj.has(k)) bySubj.set(k, new Map()); const m = bySubj.get(k); const v = e.end2.toLowerCase(); if (!m.has(v)) m.set(v, e); }
  const contradictions = [...bySubj.entries()].filter(([, m]) => m.size > 1).map(([k, m]) => ({ subject: k.split("|")[0], label: k.split("|")[1], values: [...m.values()].map((e) => ({ value: e.end2, part: e.part, addr: e.addr })) }));
  return { edges: edges.length, scan, contradictions };
}
