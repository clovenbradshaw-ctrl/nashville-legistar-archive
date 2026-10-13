// the legacy engine · perceiver/text — turns real text into the numeric material `nul`
// requires. Unicode-aware (not ASCII-only): a ground built from this must
// hold for any script, not just English, or the omnimodal commitment is a
// lie for every language but one.
//
// Surprisal is self-referential: -log2 of a word's own frequency within the
// material being measured, Laplace-smoothed. No external corpus, no model —
// the only prior is the material itself.
//
// Contract shared by every perceiver in this directory: load(path) does I/O
// once; reduce(units, {fraction}) is pure and answers "what would the
// material look like having read only this much of the real thing so far."

// load() below is Node-only I/O a non-Node host never calls — but a STATIC
// top-level `import fs from "fs"` is resolved and LINKED at module-load
// time regardless of whether load() is ever invoked, and a bundler-free
// browser host (no fs-fallback stub, no import map for a bare "fs" — this
// module is reached by a the-fold Worker with no bundler at all, found
// 2026-09-08 wiring the constitutional reader into the browser) fails to
// link the WHOLE module graph on that import alone, whether or not load()
// runs. A dynamic import() inside load() itself defers resolution to the
// one call site that actually needs it, so a host that never calls load()
// never evaluates the import expression at all — Node resolves it exactly
// as the static form did; nothing about the Node contract changes.
import { hear } from "./active-ear.js";
import { stripContainer } from "./spans.js";

const WORD_RE = /[\p{L}\p{N}']+/gu;
const MICROBITS = 1_000_000;

export const tokenize = (text) => hear(text.toLowerCase()).match(WORD_RE) || [];

export const buildFrequencyTable = (words) => {
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return { freq, total: words.length };
};

export const surprisalMicrobits = (words, table) => {
  const ws = typeof words === "string" ? tokenize(words) : words;
  if (ws.length === 0) return 0;
  let bits = 0;
  for (const w of ws) {
    const count = table.freq.get(w) || 0;
    // Fixed pseudocount (add-one), not scaled by vocabulary size. Scaling
    // the smoothing term by table.freq.size (distinct word types seen)
    // made the denominator inflate continuously as reading progresses —
    // real vocabulary diversity keeps growing throughout a novel — which
    // produced a systematic upward drift in surprisal over the WHOLE
    // document (measured: r(position, causal surprisal) = 0.297 on
    // Frankenstein) with no narrative content behind it. An unseen word
    // still costs what a first-time hapax would; that cost now depends only
    // on how much has been read (table.total), not on how many distinct
    // types happened to appear along the way.
    const p = (count + 1) / (table.total + 1);
    bits += -Math.log2(p);
  }
  return (bits / ws.length) * MICROBITS;
};

export const chunkWords = (words, size) => {
  const chunks = [];
  for (let i = 0; i + size <= words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
};

/**
 * THE CONTAINER IS NOT THE WORK, and this path used to read it as one.
 *
 * `stripContainer` lived in `spans.js` and the sentence path called it; this —
 * the NUMERIC path, the one `surf`, `fold` and the whole `nul` substrate go
 * through — did not. So every ground built here was grown partly over the
 * distributor's licence.
 *
 * MEASURED, 2026-07-31, Heidi (Project Gutenberg 20781), 1376 chunks:
 *   - all 30 of `surf`'s wave-breaks fell in the licence, none in the novel;
 *   - from a standpoint at chunk 547, 38 of 60 placed positions (63%) were
 *     wrapper rather than Heidi, and the wrapper held the top of the ranking.
 *
 * eoreader5 had already found this and fixed it at ingest
 * (`packages/host/corpus.js::ingestFile`): "the markers bracket the actual
 * work, and leaving them in put license text into search results." That fix was
 * not re-earned here. This is it, re-earned at the perceiver rather than the
 * host, because this module is where the numeric material is born.
 *
 * NOT A MEASUREMENT, and it must not become one. Knowing where the container
 * ends is received knowledge about the FILE FORMAT — the same kind as knowing
 * an mp3 carries an ID3 header (see `spans.js`) — so markers are the right
 * instrument, not a weaker one. eoreader5's `emergence/boundaries/index.js`
 * records why the alternative fails: "concentration alone is a clustering
 * heuristic that happily individuates boilerplate." A salience measure finds
 * the wrapper BECAUSE the wrapper is statistically distinctive, which makes it
 * a false-positive generator rather than a detector.
 *
 * NO OFFSET IS CARRIED, deliberately. What this module produces is a
 * chunk-indexed series with no byte anchors, so there is nothing here for an
 * offset to correct. A caller mapping a position back to the FILE takes the
 * offset from `spans.js::stripContainer`, which returns `{ text, offset }` for
 * exactly that reason — eoreader5 measured the cost of dropping it on pg84.txt:
 * "spans came back verbatim but 686 bytes early, which looks correct in every
 * test that only re-reads through this process and is wrong the moment anyone
 * opens the file."
 *
 * A text with no markers passes through untouched.
 */
export const load = async (path) => {
  const { readFileSync } = await import("fs");
  return tokenize(stripContainer(readFileSync(path, "utf8")).text);
};

export const reduce = (words, { fraction = 1, chunkSize = 40 } = {}) => {
  const readWords = words.slice(0, Math.max(1, Math.floor(words.length * fraction)));
  const table = buildFrequencyTable(readWords);
  return chunkWords(readWords, chunkSize).map((c) => surprisalMicrobits(c, table));
};

// Causal surprisal: each chunk is scored against the frequency table of
// chunks BEFORE it only, never the whole document. A whole-document table
// leaks the future into every block's score — a block near the start gets
// measured against vocabulary it hasn't been read yet. This is eoreader5's
// forwardScore lesson (emergence/surprise/index.js), ported as a real
// mechanism, not an assertion: "how much new information would this add,
// given what's already been read" is a different, causally honest question
// from "how rare are these words across the whole book."
//
// `gamma` (default 1, undecayed — identical to this function before
// 2026-08-05) is belief.js's own forgetting rate, ported here for the same
// reason belief.js has one: "relevance is local and revisable, so it must be
// able to decay" (SEED.md Amendment IV.2). At gamma=1 an unseen word's cost,
// log2(table.total+1), is mathematically guaranteed to rise for as long as
// the document runs, REGARDLESS OF CONTENT — table.total only ever grows.
// That is a residual of the fix just above (the 0.297 measurement is real
// and stands, unchanged, as gamma=1's own number) and is large enough to
// make a healthy, non-degenerate atmosphere ground on a single coherent
// 250-chunk passage read as "surfeit" purely from position, confirmed
// directly: scripts/adversarial/challenge-7-rec-re-zero-atmosphere-boundary-
// correctn.mjs's cookery-alone negative control cleared its own ground at
// chunk ~199 with the series having drifted from ~5.4M to ~9M microbits,
// zero topic shift behind it.
//
// gamma<1 bounds table.total (and every word's own count) to a decaying
// window of recent reading — belief.js's lazy schedule, cell.v *
// gamma^(t−cell.t), applied per word and to the running total alike, so an
// unseen-in-a-while word costs what it would cost against a reader's
// EFFECTIVE recent memory, not against everything since page one. MEASURED,
// 2026-08-05 (scripts/causal-surprisal-gamma-calibration.mjs): at gamma=0.999
// (chunkSize=50 — half-life ≈ 14 chunks, ≈700 words) r(position, causal
// surprisal) on Frankenstein (pg84) falls from 0.443 (gamma=1) to -0.27, and
// the series stops climbing (chunk 30/400/800/last ≈ 7.0M/7.2M/6.9M/7.7M
// microbits, vs. gamma=1's 7.6M/9.3M/9.2M/10.7M). Ground-size alone cannot
// buy this back at gamma=1 — the same script confirms drift still clears a
// healthy ground at minimums up to 20*window — so this is not a
// ground-size substitute; both matter, see atmosphere.js's MIN_GROUND.
export const causalSurprisalSeries = (chunks, { gamma = 1 } = {}) => {
  if (!(gamma > 0) || gamma > 1)
    throw new TypeError("material: gamma is the reader's fading (belief.js's own gamma) and must lie in (0,1]");
  const table = { freq: new Map(), total: 0 };
  const series = [];
  let t = 0;
  for (const chunk of chunks) {
    if (table.total === 0) {
      series.push(selfEntropyMicrobits(chunk));
    } else {
      // Only words actually IN this chunk are ever looked up, so the decayed
      // snapshot handed to surprisalMicrobits needs entries for exactly
      // those — never the whole vocabulary — and the unchanged, already-
      // tested formula does the rest. At gamma=1 this snapshot is bit-for-
      // bit `table` restricted to the chunk's own words, which is why gamma=1
      // reproduces this function's pre-2026-08-05 output exactly.
      const snapshot = { freq: new Map(), total: table.total };
      for (const w of new Set(chunk)) {
        const cell = table.freq.get(w);
        if (cell) snapshot.freq.set(w, cell.v * gamma ** (t - cell.t));
      }
      series.push(surprisalMicrobits(chunk, snapshot));
    }
    // Decay is applied ONCE per chunk, not per word within it: every
    // occurrence in this chunk is folded in at the same instant, t + this
    // chunk's own length, so repeats within one chunk neither decay against
    // nor inflate the cost of one another — same causal boundary the
    // undecayed version already held (scoring happens before any of this
    // chunk's own words are folded in).
    const counts = new Map();
    for (const w of chunk) counts.set(w, (counts.get(w) || 0) + 1);
    for (const [w, n] of counts) {
      const cell = table.freq.get(w);
      const decayed = cell ? cell.v * gamma ** (t - cell.t) : 0;
      table.freq.set(w, { v: decayed + n, t: t + chunk.length });
    }
    table.total = table.total * gamma ** chunk.length + chunk.length;
    t += chunk.length;
  }
  return series;
};

const selfEntropyMicrobits = (words) => {
  if (words.length === 0) return 0;
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  let bits = 0;
  for (const w of words) {
    const p = freq.get(w) / words.length;
    bits += -Math.log2(p);
  }
  return (bits / words.length) * MICROBITS;
};

// Token relevance: is this word even worth attending to? Self-referential,
// no external stopword list (no external corpus, per this whole module's
// discipline, and a hardcoded English stopword list would be a lie for
// every other language, same reasoning as the Unicode tokenizer above).
// Zipf's law does the work instead: the handful of words occupying a wildly
// disproportionate share of all tokens in ANY natural-language text are
// almost always function words (the, a, of, and...) — closed-class,
// structural, carrying little content on their own. A word is "relevant"
// when it does NOT belong to that small, over-represented set.
const DEFAULT_RELEVANCE_THRESHOLD = 0.006; // ~0.6% of all tokens — tuned against real text, see conformance test

export const tokenRelevance = (word, table, { threshold = DEFAULT_RELEVANCE_THRESHOLD } = {}) => {
  if (table.total === 0) return 1; // no history yet — nothing has earned irrelevance
  const share = (table.freq.get(word) || 0) / table.total;
  return share < threshold ? 1 : 0;
};

export const contentWords = (words, table, opts) => words.filter((w) => tokenRelevance(w, table, opts) === 1);

/** The closed class this text's own distribution reveals — never a stored list. */
export const functionWordSet = (table, { threshold = DEFAULT_RELEVANCE_THRESHOLD } = {}) => {
  const set = new Set();
  for (const [word, count] of table.freq) {
    if (count / table.total >= threshold) set.add(word);
  }
  return set;
};

// ── locate: the inverse of reduce()'s chunking ──────────────────────────────
//
// SEED.md Amendment XVI: a surf()/atmosphere() material index is a chunk index
// into WORDS, and load()/tokenize() throw the byte position away entirely —
// there was no way back from a standpoint to real text before this.
// Deliberately independent of tokenize()/load(): those are untouched, so
// nothing that already depends on their existing behaviour is at risk.
// tokenizeWithOffsets is the one extra pass a caller opts into when it wants
// locate() to work, at the cost of walking the text once more.

const _utf8 = new TextEncoder();
const _byteLength = (s) => _utf8.encode(s).length;

/**
 * Same WORD_RE as tokenize(), same lowercasing per word — so the word
 * sequence is identical to tokenize()'s output, word-for-word — but every
 * token also carries its UTF-8 byte range against the ORIGINAL (not
 * lowercased) text, the same coordinate space host/corpus.js's byteIndex
 * already uses. One pass, O(n) total: the gap between each match and the
 * last is sliced and encoded once, never the whole prefix each time.
 */
export const tokenizeWithOffsets = (text) => {
  const out = [];
  const re = new RegExp(WORD_RE.source, WORD_RE.flags);
  let lastIndex = 0;
  let byteAt = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    byteAt += _byteLength(text.slice(lastIndex, m.index));
    const wordBytes = _byteLength(m[0]);
    out.push({ word: m[0].toLowerCase(), byteStart: byteAt, byteEnd: byteAt + wordBytes });
    byteAt += wordBytes;
    lastIndex = m.index + m[0].length;
  }
  return out;
};

/**
 * A surf()/atmosphere() material index (a chunk of `chunkSize` words) back to
 * the byte range it was built from — read off the offset table a caller
 * already tokenized, never re-derived, so the coordinates cannot drift from
 * what was actually measured. `chunkSize` must match whatever reduce() was
 * called with; nothing here re-decides it, per SEED.md #5 (two grounds built
 * to different specs were never comparable).
 */
export const locate = (index, offsetTokens, { chunkSize = 40 } = {}) => {
  if (!Number.isInteger(index) || index < 0) return { error: "index must be a non-negative integer" };
  if (!Array.isArray(offsetTokens) || offsetTokens.length === 0) return { error: "no offset tokens to locate against" };
  const wordStart = index * chunkSize;
  if (wordStart >= offsetTokens.length) return { error: `index ${index} is past the end of the tokenized material` };
  const wordEnd = Math.min(wordStart + chunkSize, offsetTokens.length);
  return { wordStart, wordEnd, byteStart: offsetTokens[wordStart].byteStart, byteEnd: offsetTokens[wordEnd - 1].byteEnd };
};
