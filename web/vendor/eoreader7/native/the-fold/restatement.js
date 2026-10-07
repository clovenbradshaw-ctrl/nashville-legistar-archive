// restatement.js — two mechanical checks for the essay-generation pipeline's
// output, prototyped in the standing style of the-fold: no hand-set
// thresholds where a measured null decides instead (see measureVariance in
// native/the-fold/admission.js, which compares a word's observed spread to
// the exact occupancy null N*(1-(1-1/N)^k)). Pure functions over text; no
// model calls, no I/O beyond what the caller hands in as strings.
//
// DETECTOR 1, spliceCeiling/detectSplice: a sentence that glues a source
// sentence onto its own rewrite repeats a long run of its own words. "Long"
// is measured, not declared: the ceiling is the longest self-repeated word
// run any sentence in the SOURCE material produces by chance, and a
// candidate sentence is flagged only when it exceeds that ceiling.
//
// DETECTOR 2, findDuplicateStatements: two source sentences that carry the
// same figures (dates, times, numbers) AND the same names state one fact;
// the richer of the two (the one whose words are a superset of the other's)
// is kept. Requiring containment of BOTH figures and names in the SAME
// direction is what keeps "the flood of 1927" from merging with "the flood
// of 2010" (the figures disagree) and keeps two sentences that merely share
// a date but differ in substance from merging (the names, or the figures,
// will not be a subset of one another).

//
// Built 2026-09-21 by a falsifier subagent in the scratchpad, integrated
// here unchanged but for its imports. Owners: the splice is Clark's (one
// job per sentence, a restatement inside one), the duplicate is Kidder &
// Todd's (two documents may not double-weight one fact).

import { draftWords } from "./eot-draft.js";
import { isFunctionWord } from "./pos-prior.js";
import { nameRuns } from "./referent-verify.js";
import { segmentSentences, measureVariance } from "./admission.js";

// ---------------------------------------------------------------------------
// Shared: a word tokenizer that keeps character offsets, so a repaired
// sentence can be cut from the ORIGINAL bytes rather than rebuilt from
// lower-cased tokens. English-scoped (word-character runs), matching the
// task's "English is fine for now."
function tokenizeWithSpans(text) {
  const s = String(text ?? "");
  const out = [];
  for (const m of s.matchAll(/[\p{L}\p{N}']+/gu)) {
    out.push({ text: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * longestSelfRepeat(text) -> the longest run of consecutive words that
 * occurs at least twice, non-overlapping, within `text`. Brute force over
 * token pairs (sentences are short; this is a prototype, not a hot path).
 * Returns null when no run of 2+ words repeats.
 */
export function longestSelfRepeat(text) {
  const toks = tokenizeWithSpans(text);
  const n = toks.length;
  let best = null;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let k = 0;
      while (i + k < j && j + k < n && toks[i + k].text === toks[j + k].text) k++;
      if (k >= 2 && (!best || k > best.length)) {
        best = { length: k, i, j, run: toks.slice(i, i + k).map((t) => t.text).join(" ") };
      }
    }
  }
  return best;
}

/**
 * spliceCeiling(sourceTexts, locale) -> { ceiling, bySentence } the NULL for
 * detector 1. Measures the longest self-repeated word run every sentence of
 * the SOURCE material (not the model's output) produces on its own — most
 * will produce none; a few will repeat a short connective phrase by chance
 * ("of the ... of the"). The ceiling is the maximum across all of them. A
 * generated sentence repeating a run LONGER than any source sentence ever
 * repeats is repeating more than chance phrasing accounts for.
 */
export function spliceCeiling(sourceTexts, locale) {
  const texts = Array.isArray(sourceTexts) ? sourceTexts : [sourceTexts];
  let ceiling = 0;
  const bySentence = [];
  for (const doc of texts) {
    for (const sent of segmentSentences(doc, locale)) {
      const rep = longestSelfRepeat(sent);
      const length = rep ? rep.length : 0;
      if (length > 0) bySentence.push({ sentence: sent, length, run: rep.run });
      if (length > ceiling) ceiling = length;
    }
  }
  return { ceiling, bySentence };
}

/** longestCrossRun(tokensA, tokensB) -> the length of the longest run of
 * consecutive words the two token lists share, at any offset in either. Used
 * to score how VERBATIM a half of a spliced sentence is against a single
 * source sentence, which is a sharper test of "carries the source's content"
 * than bag-of-words overlap: a paraphrase reuses the same nouns (it is about
 * the same fact) but rarely reproduces the source's own word order at
 * length, while the untouched half of a splice is usually copied outright. */
function longestCrossRun(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/**
 * detectSplice(sentence, ceiling, sourceText, locale) -> null, or a report
 * of the repeated run plus a repair. The repair cuts the sentence in two at
 * the second occurrence of the run (the half before it is the paraphrase +
 * glue, the half from there on is what follows the splice) and keeps
 * whichever half is more VERBATIM one of the source's own sentences — the
 * longest run of consecutive words it shares with any single source
 * sentence — rather than whichever half merely shares more vocabulary with
 * the source as a bag of words (a paraphrase of a source fact reuses the
 * same nouns and would otherwise tie or win on vocabulary alone).
 */
export function detectSplice(sentence, ceiling, sourceText, locale) {
  const rep = longestSelfRepeat(sentence);
  if (!rep || rep.length <= ceiling) return null;
  const toks = tokenizeWithSpans(sentence);
  const cut = toks[rep.j].start;
  const halfA = sentence.slice(0, cut).trim();
  const halfB = sentence.slice(cut).trim();
  const sourceSentences = segmentSentences(sourceText ?? "", locale);
  const groundScore = (half) => {
    const halfToks = tokenizeWithSpans(half).map((t) => t.text);
    let best = 0;
    for (const s of sourceSentences) {
      const run = longestCrossRun(halfToks, tokenizeWithSpans(s).map((t) => t.text));
      if (run > best) best = run;
    }
    return best;
  };
  const scoreA = groundScore(halfA);
  const scoreB = groundScore(halfB);
  let repair = scoreB >= scoreA ? halfB : halfA;
  if (repair && !/[.!?]$/.test(repair)) repair += ".";
  return {
    sentence,
    run: rep.run,
    runLength: rep.length,
    ceiling,
    halves: { a: halfA, b: halfB, scoreA, scoreB },
    repair,
  };
}

// ---------------------------------------------------------------------------
// Figures: dates, times, dollar amounts, percentages, plain numbers. English/
// Arabic-numeral scoped, deliberately conservative (closed patterns, not a
// word list) — it looks for FORM (digits, currency and time punctuation),
// never for topic.
const RICH_FIGURE_PATTERNS = [
  /\$\d[\d,]*(?:\.\d+)?/g, // dollar amounts
  /\d+(?:\.\d+)?\s*(?:%|percent)\b/gi, // percentages
  /\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)?/gi, // times
];
const BARE_NUMBER_PATTERN = /\b\d[\d,]*(?:\.\d+)?\b/g;
const normFigure = (x) => x.toLowerCase().replace(/[,\s]+/g, "").replace(/\.$/, "");

/** extractFigures(text) -> Set of normalized figure tokens (dates, times,
 * dollar amounts, percentages, bare numbers) found by shape alone, never by
 * a topic word list. */
export function extractFigures(text) {
  const s = String(text ?? "");
  const out = new Set();
  for (const re of RICH_FIGURE_PATTERNS) for (const m of s.matchAll(re)) out.add(normFigure(m[0]));
  for (const m of s.matchAll(BARE_NUMBER_PATTERN)) out.add(normFigure(m[0]));
  return out;
}

/** extractBareNumbers(text) -> just the plain digit runs (a year, a count, a
 * day-of-month), the figure kind most likely to recur across a whole
 * document by pure structural chance (page numbers, running counts, a year
 * that names the document's own reporting period) rather than by naming one
 * specific fact. Split out so findDuplicateStatements can null-filter these
 * against the corpus's own measured variance and leave the richer, rarer
 * figure shapes (times, money, percentages) alone. */
function extractBareNumbers(text) {
  const s = String(text ?? "");
  const out = new Set();
  for (const m of s.matchAll(BARE_NUMBER_PATTERN)) out.add(normFigure(m[0]));
  return out;
}

/** extractNames(text) -> Set of lower-cased proper-name runs, via the
 * project's own capitalised-run reader (referent-verify.js: nameRuns),
 * reused rather than re-invented. A leading "the" is stripped (matching
 * eot-draft.js's own namesOf) so "The Metropolitan..." at a sentence's start
 * and "the Metropolitan..." mid-sentence name the same thing. */
export function extractNames(text) {
  return new Set(nameRuns(String(text ?? "")).map((r) => r.join(" ").toLowerCase().replace(/^the /, "")).filter(Boolean));
}

const isSubset = (small, big) => { for (const x of small) if (!big.has(x)) return false; return true; };

/**
 * findDuplicateStatements(items, locale) -> pairs of sentences that state
 * the SAME fact, found by containment rather than similarity: a sentence
 * "restates" another only when its figures AND its names are both subsets
 * of the other's (in the same direction), and both sentences carry at
 * least one figure and one name to begin with — prose with no date/number
 * or no named entity is never a "fact" candidate here.
 *
 * BARE NUMBERS ARE NULL-FILTERED FIRST (measured, not declared): a lone
 * digit run ("2021", "23") recurs across a document's running counts, page
 * references and reporting-period mentions often enough that sharing one is
 * not evidence of sharing a fact — measured live on the OHS fixture, "2021"
 * and "23" are both VARIANCE by measureVariance's own occupancy null (as
 * spread through the corpus as chance allows), the same test that already
 * calls "cumberland" and "nashville" variance in the river fixture. A bare
 * number that is corpus-variance is dropped from a sentence's figure set
 * before matching; a date's month/day/year usually still leaves richer
 * shapes (a time, a percentage, a dollar amount) or a genuinely rare year
 * intact. This is what stops "In 2021, ... reviewed the plan" from merging
 * into an unrelated sentence that also happens to span 2021 — the shared
 * "2021" is exactly the kind of number chance would spread everywhere.
 *
 * `items` is an array of strings or { text, id } records (id defaults to
 * index; carry the source filename/title through `id` for reporting).
 * Returns [{ keep, drop, keepText, dropText, sharedFigures, sharedNames }].
 *
 * Guards, by construction: "the flood of 1927" vs "the flood of 2010" never
 * merge (their figure sets disagree, so neither is a subset of the other);
 * two sentences that merely share ONE variance-level date but differ in
 * substance do not merge unless ALL of the smaller one's SURVIVING figures
 * and ALL of its names are carried by the larger one.
 */
export function findDuplicateStatements(items, locale) {
  const texts = items.map((it) => (typeof it === "string" ? it : it.text));
  const variance = measureVariance(texts.join("\n\n"), locale);
  const recs = items.map((it, idx) => {
    const text = typeof it === "string" ? it : it.text;
    const id = typeof it === "string" ? idx : (it.id ?? idx);
    const figures = extractFigures(text);
    for (const bare of extractBareNumbers(text)) if (variance.has(bare)) figures.delete(bare);
    return {
      idx,
      id,
      text,
      figures,
      names: extractNames(text),
      contentWords: draftWords(text).filter((w) => !isFunctionWord(w)),
    };
  });
  const merges = [];
  for (let a = 0; a < recs.length; a++) {
    for (let b = a + 1; b < recs.length; b++) {
      const A = recs[a], B = recs[b];
      if (A.figures.size === 0 || B.figures.size === 0) continue;
      if (A.names.size === 0 || B.names.size === 0) continue;
      const aRicher = A.contentWords.length >= B.contentWords.length;
      const rich = aRicher ? A : B;
      const poor = aRicher ? B : A;
      if (!isSubset(poor.figures, rich.figures)) continue;
      if (!isSubset(poor.names, rich.names)) continue;
      merges.push({
        keep: rich.id,
        drop: poor.id,
        keepText: rich.text,
        dropText: poor.text,
        sharedFigures: [...poor.figures],
        sharedNames: [...poor.names],
      });
    }
  }
  return merges;
}
