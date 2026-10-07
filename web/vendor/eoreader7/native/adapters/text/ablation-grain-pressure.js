// adapters/text/ablation-grain-pressure.js — a revisable, typed PRESSURE on
// grain-typing.js's grain_gap, from a local-model "ablation" embedding delta:
// embed(sentence-with-word) minus embed(sentence-with-word-replaced-by-a-
// placeholder) carries real, measured signal about the word's grammatical
// category (29% accuracy on a 13-way POS classification vs 7.7% chance,
// p=6e-15 -- eval/the-fold/results/ablation-delta-catalog-RESULTS.md,
// 2026-09-23). Coarse, real, not a replacement for a received prior.
//
// THE THREE STANDING CONSTRAINTS (user direction, 2026-09-23), each load-
// bearing, none decorative:
//
//   1. NEVER OVERRIDES SETTLED EVIDENCE. This module is never called except
//      on an existing grain_gap (grain-typing.js's own typed absence). A
//      received POS prior that settles a connector is never second-guessed.
//
//   2. REVISABLE PRESSURE, NOT A VERDICT. The physics moves (a nudge on the
//      existing witness/admission weighing this feeds), never a hard
//      classification -- the returned object is frozen with `revisable:
//      true` and carries no mechanism to overwrite anything; a caller who
//      later gets better evidence (a real prior, a role-config) simply
//      never calls this, or its own admission logic outweighs the pressure.
//      Matches the supersedes/defeasible-claim convention already used
//      throughout eoreader7 -- nothing here is a final say.
//
//   3. POS IS LANGUAGE- AND PERIOD-SPECIFIC, NEVER UNIVERSAL. Every centroid
//      set carries real provenance (language, period, region, corpus,
//      giver) and centroid sets are kept SEPARATE, never pooled without
//      declaring that pooling as its own, weaker holonic level. A "VERB"
//      centroid built from 2010s web English and one built from 1623
//      Folio-spelling Early Modern English are not the same signal (a
//      peer session measured this directly: the modern-English-trained
//      parser loses 6-35 points of word-class agreement on Folio spelling,
//      mostly from period capitalization).
//
// HOLONIC LEVELS, weakest fallback last: `centroidSets` is an array of
// { provenance: {language, period, region, corpus, giver}, centroids }.
// ablationPressure returns EVERY set's own vote separately (a parliament,
// never blended into one number) plus a `combined` field that simply
// prefers the narrowest/most-specific set with a non-null vote.
//
// STATUS (2026-09-26, updated): the offline prior-builder
// (scripts/build-ablation-grain-prior.mjs) HAS completed a real run --
// the earlier blocker (a shared local Ollama instance) turned out, once
// actually root-caused rather than re-checked, to be a stuck daemon
// scheduler specific to embedding requests (no runner process ever
// spawned; every /api/embed call hung indefinitely with zero bytes
// returned, while /api/generate and /api/tags both answered normally),
// not the memory-pressure refusal this comment previously described.
// Restarting the daemon cleared it. native/priors/ablation-grain-eng.json
// and ablation-grain-pooled.json are both real, written from a live run.
//
// The falsification test (eval/the-fold/ablation-pressure-calibration.mjs)
// has since run for real too, to a definitive verdict: calibrated:false
// (82 held-out single-occurrence predictions; high-margin accuracy 0.171
// vs low-margin 0.220 -- the wrong direction, and not significant either
// way, Fisher p=0.798; a shuffled-label null also showed no effect,
// ruling out a broken null masking a real one). THIS MODULE'S CONFIDENCE
// FIELDS (`cosine`, `margin`) REMAIN UNCALIBRATED -- known real in
// aggregate (29% vs 7.7% chance, p=6e-15) but now actually TESTED, not
// merely untested, and found not to license per-case trust. Do not wire
// this live as a per-case confidence signal; that conclusion is unchanged,
// only its basis has moved from "blocked, never tested" to "tested and
// failed the bar."

import { seeded } from "./english-parser.js";

const MASK = "___";

const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const sub = (a, b) => a.map((x, i) => x - b[i]);
const cos = (a, b) => { let dot = 0, ma = 0, mb = 0; for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i]; } if (!ma || !mb) return 0; return dot / Math.sqrt(ma * mb); };
const mean = (vs) => vs[0].map((_, j) => vs.reduce((s, v) => s + v[j], 0) / vs.length);

/**
 * buildCentroids({words, embed, provenance}) -> {provenance, centroids, n}
 *
 * OFFLINE / reference-building only -- never called on a live turn. `words`
 * is an array of {pos, occurrences: [{forms, idx}, ...]} (multiple real
 * sentences per word, per claim-null-scoring.mjs's own convention: several
 * real contexts for the SAME lexical item, pooled, is a more robust signal
 * than any one occurrence). `embed(texts) -> vectors[]` is the caller's
 * chosen model call (this file makes no network/model calls of its own --
 * PURE, injected, matching the cast.js pattern every other adapter here
 * follows). `provenance` is REQUIRED and must name language + period +
 * region + corpus + giver -- a centroid with no giver is refused.
 */
export function buildCentroidsFrom(deltaByPos, provenance) {
  if (!provenance?.language || !provenance?.corpus || !provenance?.giver) {
    throw new TypeError("buildCentroidsFrom: provenance must name language, corpus, and giver -- an unattributed centroid is refused, never silently built");
  }
  const centroids = {};
  const n = {};
  for (const [pos, deltas] of Object.entries(deltaByPos)) {
    if (!deltas.length) continue;
    centroids[pos] = mean(deltas.map(norm));
    n[pos] = deltas.length;
  }
  return Object.freeze({ provenance: Object.freeze({ ...provenance }), centroids: Object.freeze(centroids), n: Object.freeze(n) });
}

/** Build the {withPrompt, ablatedPrompt} pair for one word's pooled real
 *  occurrences -- exposed so both the offline builder and any future caller
 *  share the identical construction (claim-null-scoring.mjs's own rule:
 *  reuse the one bridge, never a second copy that can drift). */
export function buildDeltaPrompts(occurrences) {
  const withLines = occurrences.map((o) => o.forms.join(" "));
  const ablatedLines = occurrences.map((o) => o.forms.slice(0, o.idx).concat(MASK, o.forms.slice(o.idx + 1)).join(" "));
  return { withPrompt: withLines.join("\n"), ablatedPrompt: ablatedLines.join("\n") };
}

/**
 * ablationPressure(connectorSurface, sentenceTokens, connectorIdx, {embed, centroidSets})
 *   -> { grain_gap: true, basis: "ablation-delta", revisable: true, votes: [...], combined: {...} | null }
 *
 * LIVE query -- called only on an existing grain_gap. `sentenceTokens` is
 * the tokenized surface form array the connector's sentence already has
 * (real production code always has this; no re-tokenization invented
 * here). `connectorIdx` is the connector's own index in that array. A
 * SINGLE occurrence -- the live sentence is the only context available in
 * real time, unlike the multi-occurrence centroids built offline; this
 * asymmetry is real and disclosed, not smoothed over. `centroidSets` is an
 * array of buildCentroidsFrom() results, ordered most-specific-holon-first
 * (e.g. same-language-same-period before cross-lingual-pooled) -- every
 * set's own vote is returned, never blended into one hidden number.
 */
export async function ablationPressure(connectorSurface, sentenceTokens, connectorIdx, { embed, centroidSets }) {
  if (!Array.isArray(centroidSets) || !centroidSets.length) return null;
  if (sentenceTokens[connectorIdx] !== connectorSurface && sentenceTokens[connectorIdx]?.form !== connectorSurface) {
    // typed refusal, not a silent guess: the caller's index doesn't match
    // the surface it claims to be ablating
    return Object.freeze({ grain_gap: true, basis: "ablation-delta", revisable: true, refused: "connector index does not match surface", votes: [], combined: null });
  }
  const forms = sentenceTokens.map((t) => (typeof t === "string" ? t : t.form));
  const withPrompt = forms.join(" ");
  const ablatedPrompt = forms.slice(0, connectorIdx).concat(MASK, forms.slice(connectorIdx + 1)).join(" ");
  const [withVec, ablatedVec] = await embed([withPrompt, ablatedPrompt]);
  const delta = norm(sub(norm(withVec), norm(ablatedVec)));

  const votes = centroidSets.map((set) => {
    let best = null, bestScore = -Infinity, second = -Infinity;
    for (const [pos, c] of Object.entries(set.centroids)) {
      const s = cos(delta, c);
      if (s > bestScore) { second = bestScore; bestScore = s; best = pos; } else if (s > second) { second = s; }
    }
    if (best == null) return null;
    // margin (best - second-best cosine) as the confidence proxy -- a
    // vote with no daylight between its top two candidates is weak
    // evidence even if it "won"; kept visible, never hidden inside a
    // single scalar.
    return Object.freeze({ provenance: set.provenance, pos: best, cosine: +bestScore.toFixed(4), margin: +(bestScore - second).toFixed(4) });
  }).filter(Boolean);

  const combined = votes.length ? votes[0] : null; // most-specific-holon-first ordering IS the preference rule -- no re-ranking invented here
  return Object.freeze({ grain_gap: true, basis: "ablation-delta", revisable: true, connector: connectorSurface, votes: Object.freeze(votes), combined });
}

export { seeded };
