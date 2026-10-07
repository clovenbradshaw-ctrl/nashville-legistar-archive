// ground-trace.js — WHAT THE MODEL SAYS IS GROUNDED ONLY IF IT LINKS TO AN ADDRESS IN THE GROUND (2026-09-30).
//
// User direction: "anything the model says that can't be holographically linked to an auditable source is 'ungrounded' by
// definition"; "the proper state of things is it is ungrounded if the model has no input." Priors STEER which span is
// chosen (priors-ground.js); they never ENTER the text. So a shipped sentence is one of two things: LINKED — it carries its
// claim in one sentence of one source, at a byte address that slices back to that sentence — or UNGROUNDED, the model's own
// statement. There is no third state and no "sounds plausible".
//
// Measured on real bytes (2026-09-30), the job for "How a bicycle freewheel lets the wheel spin while the pedals stay still"
// was grounded on the Wikipedia Freewheel mechanism section and wrote, before three sentences quoted from it, "Bicycles don't
// just coast; they actively shift their momentum." and "This is achieved by a mechanism that allows the wheel to continue
// rotating while the pedals are stationary." Neither is in the section. document-ledger.js's citationLedger called them
// "company" and "verbatim": it counts a sentence sourced when three of its words occur ANYWHERE in a whole source — the
// per-document presence rule priors-ground.js had to leave for the passage. This module is the same correction at the
// grain of the claim: the words must occur TOGETHER, in one sentence of the source.
//
// The rule, a definition and no tuned number. A sentence is LINKED to a source sentence when MORE THAN HALF of its content
// words (draftWords stems minus the engine's isFunctionWord) occur in that one source sentence, AND every number it states
// occurs there too (a wrong year is a different claim). Among linking sentences the one carrying the most is the link. A
// sentence with no content word asserts nothing ("Yes.") and is not counted. No model call.
//
// Limits, stated: lexical — a negation or a reversal that keeps the words ("freewheels never spin") links; a claim
// assembled from TWO source sentences, neither carrying more than half of it, reads as ungrounded (the failure is to say
// "ungrounded", never to pass a claim); English word forms (see ground-carries.js).
import { draftWords } from "./eot-draft.js";
import { isFunctionWord } from "./pos-prior.js";
import { segmentSentences } from "./admission.js";

export const GROUND_TRACE_SCHEMA = "EOGroundTrace@1";

const contentWords = (s) => [...new Set(draftWords(String(s ?? "")).filter((w) => !isFunctionWord(w)))];
const numbersOf = (s) => [...new Set(String(s ?? "").match(/\d[\d.,]*\d|\d/g) ?? [])];

// Sentence boundaries WITH offsets, cut by the window's own segmenter (admission.js segmentSentences) inside each blank-line
// paragraph, so a sentence this module lights is, by construction, one the window holds as a sentence. (A private splitter
// disagreed with it on the real ground — `"slipping." In this scenario…` stayed one unit — and one lit sentence survived into the
// next window: measured by Wilson, 2026-09-30.) The segmenter normalizes whitespace, so each piece is located by a pattern that
// lets any whitespace stand where it had a space; text.slice(start, end) is the sentence as written. A piece that cannot be
// located is kept at the cursor rather than dropped, so nothing the model wrote goes untraced.
const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function sentenceSpans(text) {
  const src = String(text ?? ""); const out = [];
  const para = /[^\n]+(?:\n(?![ \t\r]*\n)[^\n]*)*/g; let pm;
  while ((pm = para.exec(src))) {
    const block = pm[0]; let at = 0;
    for (const piece of segmentSentences(block)) {
      const re = new RegExp(piece.split(/\s+/).map(escRe).join("\\s+"), "g"); re.lastIndex = at;
      const m = re.exec(block);
      if (m) { out.push({ start: pm.index + m.index, end: pm.index + m.index + m[0].length }); at = m.index + m[0].length; }
      else out.push({ start: pm.index + at, end: pm.index + block.length });
    }
  }
  return out;
}

/**
 * makeTracer(sources) → (sentence) => { status: "linked" | "ungrounded" | "no-claim", link, words }
 * The ground's sentences are read once; the tracer is then cheap to ask one sentence at a time, as the mouth draws.
 * link: { id, start, end, text, carries } — text is the SOURCE sentence the address slices back to.
 */
export function makeTracer(sources = []) {
  const units = [];
  for (const s of sources) for (const sp of sentenceSpans(s.text)) { const t = String(s.text).slice(sp.start, sp.end); units.push({ id: s.id, start: sp.start, end: sp.end, text: t, has: new Set(draftWords(t)), nums: numbersOf(t) }); }
  return (sentence) => {
    const words = contentWords(sentence);
    if (!words.length) return { status: "no-claim", link: null, words };
    const nums = numbersOf(sentence);
    let best = null;
    for (const u of units) {
      const carries = words.filter((w) => u.has.has(w));
      if (carries.length * 2 <= words.length) continue;
      if (!nums.every((n) => u.nums.includes(n))) continue;
      if (!best || carries.length > best.carries.length) best = { id: u.id, start: u.start, end: u.end, text: u.text, carries };
    }
    return { status: best ? "linked" : "ungrounded", link: best, words };
  };
}

/**
 * traceToGround({ text, sources }) → EOGroundTrace@1
 *   text     what the model wrote
 *   sources  [{ id, text }]  the ground: what the composition was allowed to stand on
 * sentences: [{ text, status: "linked" | "ungrounded", link: { id, start, end, carries } | null, words }]
 */
export function traceToGround({ text = "", sources = [] } = {}) {
  const trace = makeTracer(sources);
  const sentences = [];
  // A markdown heading line names a part and asserts nothing. It is blanked (same length, so offsets hold) BEFORE the text is cut:
  // a title on the line above a paragraph, with no blank line between, would otherwise be fused into the paragraph's first
  // sentence and take it out of the trace (measured live 2026-09-30: a job's one shipped sentence traced as "0 of 0").
  const body = String(text).replace(/^#{1,6}[ \t].*$/gm, (m) => " ".repeat(m.length));
  for (const sp of sentenceSpans(body)) {
    const t = body.slice(sp.start, sp.end).trim();
    if (!t) continue;
    const r = trace(t);
    if (r.status === "no-claim") continue; // asserts nothing
    sentences.push({ text: t, status: r.status, link: r.link, words: r.words });
  }
  const linked = sentences.filter((x) => x.status === "linked").length;
  return {
    schema: GROUND_TRACE_SCHEMA, sentences, linked, ungrounded: sentences.length - linked,
    basis: sources.length
      ? `${linked} of ${sentences.length} sentence(s) carry more than half of their content words (and every number) in one sentence of the ground; the rest are the model's own statement, ungrounded`
      : `no ground was handed to the composition: all ${sentences.length} sentence(s) are the model's own statement, ungrounded`,
  };
}
