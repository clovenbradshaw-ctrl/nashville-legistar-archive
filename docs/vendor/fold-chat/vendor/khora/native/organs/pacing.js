// organs/pacing.js — MURCH'S CUT: pacing as emotional impact.
// Handle: Walter Murch — In the Blink of an Eye: a film is edited where the
// blink falls, and the blink is the instant a thought or emotion turns. Pace
// is not evenness; it is the DELIBERATE variation of rhythm in service of
// what the piece is doing. The principles, made measurable:
//   BLINK — the reader's eye rests at a sentence/paragraph boundary; the
//   edit (the variation) falls where the thought turns. A piece that never
//   varies its sentence length has no blinks — it is a flatline.
//   INFORMATION DENSITY ↔ PACE — a dense sentence (many propositions, long
//   words) reads slow; a sparse one reads quick. The piece should VARY them:
//   dense, then a release; short, then a swell. Monotone density is Murch's
//   boredom — the same failure Fisher/Strunk catch at other grains.
// Murch grades pacing: sentence-length variance, the density rhythm, and
// whether the piece has BLINK POINTS (short sentences landing after long
// ones — the reader's eye blinking where the thought turns). This is the
// emotional impact of the cut, mechanical and EOT-recordable like every
// other measure.

/** Sentence lengths (word counts) in order — the piece's rhythm as a series. */
export function sentenceLengths(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ sentence: s, words: s.split(/\s+/).filter(Boolean).length }));
}

/**
 * THE PACING GRADE — Murch's read of the cut.
 *   meanLength     — average sentence length (the tempo).
 *   variance       — the standard deviation of sentence length (the range of
 *                    the rhythm; near-zero = flatline, no blinks).
 *   blinkPoints    — the sentences notably shorter than the running mean
 *                    after a longer run: the reader's eye blinking where the
 *                    thought turns (a short sentence after two long ones).
 *   denseSentences — the longest sentences (high info density): the swells.
 *   basis          — a plain-language read of the rhythm.
 * A piece with variance near zero reads as one long monotone — no cuts, no
 * blinks, no emotional arc. A piece with real variance has Murch's cut: the
 * eye blinks where the thought turns.
 */
export function pacingGrade(text) {
  const rows = sentenceLengths(text);
  if (!rows.length) return { meanLength: 0, variance: 0, blinkPoints: [], denseSentences: [], basis: "no text to pace" };
  const lens = rows.map((r) => r.words);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = Math.sqrt(lens.reduce((a, l) => a + (l - mean) ** 2, 0) / lens.length);
  // BLINK POINTS: a sentence at least 35% shorter than the running mean of
  // the preceding window (a short landing after longer ones) — the blink.
  const blinkPoints = [];
  for (let i = 1; i < rows.length; i++) {
    const window = lens.slice(Math.max(0, i - 3), i);
    if (!window.length) continue;
    const winMean = window.reduce((a, b) => a + b, 0) / window.length;
    if (rows[i].words <= winMean * 0.65 && rows[i].words >= 3) {
      blinkPoints.push({ index: i, words: rows[i].words, windowMean: Number(winMean.toFixed(1)), sentence: rows[i].sentence.slice(0, 90) });
    }
  }
  // DENSE SENTENCES: the top decile by length — the swells of information.
  const sorted = [...lens].sort((a, b) => b - a);
  const denseThreshold = sorted[Math.max(0, Math.floor(sorted.length * 0.1))];
  const denseSentences = rows.filter((r) => r.words >= denseThreshold && r.words >= 8).map((r) => ({ words: r.words, sentence: r.sentence.slice(0, 90) }));
  // The read: flatline (variance < 30% of mean, no blinks) vs. alive.
  // A structural floor, not a tuned one: one sentence has no rhythm to grade —
  // a single length has zero variance by construction and a blink needs a
  // sentence before it — so it is never read as flat (withheld, never convicted).
  const gradable = rows.length >= 2;
  const flatline = gradable && mean > 0 && variance / mean < 0.3 && blinkPoints.length === 0;
  const basis = !gradable
    ? `Murch: one sentence carries no rhythm to grade — a single length has no variance and a blink needs a sentence before it.`
    : flatline
    ? `Murch: the piece paces flat — ${rows.length} sentence(s), mean ${mean.toFixed(0)} words, variance ${variance.toFixed(1)} (${(variance / mean * 100).toFixed(0)}% of the mean). No blinks: the eye never rests, the cut never falls. Vary the sentence lengths; let a short sentence land after a long one.`
    : `Murch: the piece has rhythm — ${rows.length} sentence(s), mean ${mean.toFixed(0)} words, variance ${variance.toFixed(1)} (${(variance / mean * 100).toFixed(0)}% of the mean), ${blinkPoints.length} blink point(s) where the thought turns. ${blinkPoints.length ? "The eye blinks where it should." : "The rhythm varies but rarely blinks — add a short landing after a dense sentence."}`;
  return {
    sentences: rows.length,
    meanLength: Number(mean.toFixed(1)),
    variance: Number(variance.toFixed(1)),
    varianceRatio: mean > 0 ? Number((variance / mean).toFixed(2)) : 0,
    blinkPoints,
    denseSentences: denseSentences.slice(0, 5),
    flatline,
    basis,
  };
}

/** Alias of pacingGrade — Murch's read by any name. */
export const murchPacing = pacingGrade;

/** Alias of sentenceLengths — the rhythm series by any name. */
export const rhythm = sentenceLengths;