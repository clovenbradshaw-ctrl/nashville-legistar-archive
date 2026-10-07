// passage-comparison.js — a comparison whose numbers live in the passages, worked out before the mouth speaks.
// Handle: Parmenides/Kelsen — same-vs-other by evidence: a figure belongs to a referent only when the sentence
// carrying it names THAT referent and not the other; two figures are comparable only when they share a unit.
//
// arithmetic.js::checkComparison (P173) answers "which is larger, 9 or 19?" because the values are the
// question's own. "Which carries more vehicles a day, the Vellmar bridge or the Karst tunnel, and by how many?"
// has no digits: the figures are in the retrieved passages, and a 1B mouth asked to subtract them either
// answers tersely and wrong (1,500 for 2,500) or has to reason at length. This reads the two referents the
// question sets side by side (the noun phrases either side of its coordinator), finds the sentence of the
// passages that names each and carries a figure in the unit the question asks in, and hands the arithmetic
// engine the two figures. The result is a FACT for the mouth (P173's own posture), never an instruction.
//
// Nothing here is a word list about any topic. The only closed classes are the ones the engine already owns:
// CLAIM_STOPWORDS (what is not part of a noun phrase), arithmetic.js's comparatives, grounding.js's
// wordSet/hasWord (the one fold, P11). Anything ambiguous is refused, not guessed (P9): a sentence naming both
// referents, two different figures in the asked unit for one referent, no unit shared by both, more than one
// candidate unit the question does not choose between.
import { CLAIM_STOPWORDS, wordSet, hasWord, splitSentences } from "../organs/grounding.js";
import { COMPARATIVE_WORDS, checkComparison } from "./arithmetic.js";
import { unquoted } from "./quoting.js";

const COMPARATIVE = new RegExp(`\\b(${COMPARATIVE_WORDS})\\b`, "i");
const COORD = /^(or|versus|vs\.?|against)$/i;
const FIGURE_RE = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\w])(?:\s+([\p{L}][\p{L}-]*))?/gu;
const tok = (s) => [...String(s).matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => m[0]);
const isStop = (w) => CLAIM_STOPWORDS.has(w.toLowerCase());

/** The two noun phrases the question sets side by side: the maximal non-stopword runs either side of its coordinator. */
export function referentsOf(question) {
  const asked = unquoted(String(question ?? ""));
  if (!COMPARATIVE.test(asked)) return null;
  for (const seg of asked.split(/[,;:?!()]+/)) {
    const ws = tok(seg);
    const at = ws.findIndex((w) => COORD.test(w));
    if (at < 1) continue;
    let l = at - 1;
    const left = [];
    while (l >= 0 && !isStop(ws[l])) left.unshift(ws[l--]);
    let r = at + 1;
    while (r < ws.length && isStop(ws[r])) r++;
    const right = [];
    while (r < ws.length && !isStop(ws[r])) right.push(ws[r++]);
    if (!left.length || !right.length) continue;
    const surface = (arr, before) => (before >= 0 && /^(the|this|that)$/i.test(ws[before]) ? "the " : "") + arr.join(" ");
    return [
      { surface: surface(left, l), tokens: left },
      { surface: surface(right, ws.findIndex((w, i) => i > at && !isStop(w)) - 1), tokens: right },
    ];
  }
  return null;
}

/** figures of a sentence → [{ text, value, unit }]; the unit is the word the figure stands before. */
const figuresOf = (sentence) => [...String(sentence).matchAll(FIGURE_RE)].map((m) => ({ text: m[1], value: Number(m[1].replace(/,/g, "")), unit: (m[2] ?? "").toLowerCase() }));

/**
 * checkPassageComparison(question, passages, { math }) → { kind: "passage-comparison", sentence, ... } | null
 * null unless every step is unambiguous.
 */
export function checkPassageComparison(question, passages, { math } = {}) {
  if (!math || typeof math.evaluate !== "function") return null;
  const refs = referentsOf(question);
  if (!refs) return null;
  const sets = refs.map((r) => new Set(r.tokens.map((t) => t.toLowerCase())));
  // what tells one referent from the other: its own tokens the other lacks
  const own = refs.map((r, i) => r.tokens.filter((t) => !isStop(t) && !sets[1 - i].has(t.toLowerCase())));
  if (own.some((o) => !o.length)) return null;
  const asked = wordSet(unquoted(String(question)));
  const bound = [[], []];
  for (const p of passages ?? []) {
    for (const s of splitSentences(String(p?.text ?? p ?? ""))) {
      const words = wordSet(s.text);
      const hits = own.map((o) => o.some((t) => hasWord(words, t)));
      if (hits[0] === hits[1]) continue; // names neither, or both: not evidence for either
      const figs = figuresOf(s.text).filter((f) => f.unit);
      const i = hits[0] ? 0 : 1;
      for (const f of figs) bound[i].push({ ...f, sentence: s.text });
    }
  }
  const shared = [...new Set(bound[0].map((f) => f.unit))].filter((u) => bound[1].some((f) => f.unit === u));
  if (!shared.length) return null;
  const named = shared.filter((u) => hasWord(asked, u));
  const units = named.length ? named : shared;
  if (units.length !== 1) return null; // more than one candidate unit and the question does not choose
  const unit = units[0];
  const pick = bound.map((b) => b.filter((f) => f.unit === unit));
  if (pick.some((b) => new Set(b.map((f) => f.value)).size !== 1)) return null; // two different figures for one referent
  const [a, b] = [pick[0][0], pick[1][0]];
  const word = COMPARATIVE.exec(unquoted(String(question)))[1];
  const cmp = checkComparison(`Which is ${word}, ${a.value} or ${b.value}? By how much?`, { math });
  if (!cmp || cmp.gap || a.value === b.value) return null;
  const fmt = (n) => ([a.text, b.text].some((t) => t.includes(",")) ? Number(n).toLocaleString("en-US") : String(n));
  const winner = cmp.first === a.value ? 0 : 1;
  const cap = (t) => t.replace(/^the /, "The ");
  const verb = /^(more|fewer|less)$/i.test(word) ? `has ${word.toLowerCase()}` : `is ${word.toLowerCase()}`;
  const [W, L] = winner === 0 ? [a, b] : [b, a];
  const sentence = `${cap(refs[winner].surface)} ${verb}: ${W.text} ${unit} against ${L.text} for ${refs[1 - winner].surface}, a difference of ${fmt(cmp.difference)} ${unit}.`;
  return { kind: "passage-comparison", referents: refs.map((r) => r.surface), values: [a.value, b.value], unit, first: winner, difference: cmp.difference, sentence, spans: [a.sentence, b.sentence] };
}
