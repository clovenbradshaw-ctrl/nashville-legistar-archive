// native/adapters/text/contextual-dmd.js — DMD in a context, with every dial
// derived from the material rather than typed.
//
// WHAT WAS WRONG WITH THE FIRST PASS. eval/salience-dmd.mjs fixed DIMS=16,
// RANK=8, and pinned ONE roster at sentence 63 which then stood for the whole
// book. A globally pinned observable set is the opposite of contextual: it
// measures the modes of Walton's opening vocabulary and calls them the
// novel's. Every one of those numbers is gone here.
//
// HOW EACH DIAL IS DERIVED NOW.
//
//   observables — the band-admitted motifs that actually OCCUR in this
//     window. memory/activation.js's own incremental gate decides membership
//     (idf >= floor AND df >= 2, computed from the prefix only); the window
//     decides presence. The state dimension is therefore whatever this
//     stretch of material yields, and it differs between contexts. That is
//     the point, not a defect.
//
//   rank — "numerical": every direction the data excited above floating-point
//     noise at this matrix's own size and scale (dmd.js's derived criterion,
//     max(m,n)*eps*sigma_max). No model order is chosen.
//
//   window — measured by kernel/activation.js::dmdWindow, the
//     difference-that-makes-a-difference: the shallowest depth at which
//     forgetting everything older no longer changes the conclusion. Here the
//     conclusion IS the decomposition, so the two organs that share the
//     letters DMD finally compose: Bateson's window measured against Dynamic
//     Mode Decomposition's own answer (READING-SPEC S11 disclosed the
//     collision; this is its resolution).
//
//   the conclusion — DISCRETE, so agreement is exact and no tolerance is
//     smuggled in: (how many modes this material excites, how many of them
//     oscillate). dmdWindow's own default `equal` is exact comparison, which
//     is the organ telling its callers the conclusion must be discrete. A
//     real-valued spectrum comparison would need a closeness threshold, and
//     that threshold would be exactly the kind of typed number this file
//     exists to remove.
//
//   candidates — a dyadic ladder over what has actually been read (2, 4, 8,
//     ... up to the observations in hand). Doubling is structural; it is not
//     a chosen set of depths.

import { dmd } from "../../kernel/dmd.js";
import { dmdWindow } from "../../kernel/activation.js";

/** Dyadic ladder up to n — derived from the material's own extent. */
export const dyadicCandidates = (n) => {
  const out = [];
  for (let d = 2; d < n; d *= 2) out.push(d);
  if (n >= 2) out.push(n);
  return out;
};

/** Snapshot matrix in the basis this stretch of material itself supplies. */
export const basisOf = (observations) => {
  const motifs = new Set();
  for (const counts of observations) for (const m of counts.keys()) motifs.add(m);
  return [...motifs].sort();
};

const columnsFor = (observations, basis) =>
  basis.map((m) => observations.map((counts) => counts.get(m) ?? 0));

/**
 * decompose — the modes of these observations, in their own basis, at
 * numerical rank. Returns a typed gap rather than a guess when the stretch
 * cannot support a decomposition.
 */
export const decompose = (observations, { dt = 1 } = {}) => {
  if (observations.length < 3) return { gap: "too_few_observations", observations: observations.length };
  const basis = basisOf(observations);
  if (!basis.length) return { gap: "empty_basis", observations: observations.length };
  const X = columnsFor(observations.slice(0, -1), basis);
  const Xp = columnsFor(observations.slice(1), basis);
  const out = dmd(X, Xp, { rank: "numerical", dt });
  return { basis, dims: basis.length, ...out };
};

/**
 * conclusionOf — what a difference must make a difference TO. Deliberately
 * two integers: the rank the material excites, and how many of those modes
 * are oscillatory. Discrete, so dmdWindow's exact `equal` needs no tolerance.
 */
export const conclusionOf = (observations) => {
  const out = decompose(observations);
  if (out.gap) return { rank: 0, oscillatory: 0, gap: out.gap };
  return {
    rank: out.rank,
    oscillatory: out.eigenvalues.filter((l) => Math.abs(l.im) > 0).length,
  };
};

/**
 * contextualModes — measure this material's own reach, then decompose over
 * exactly that reach, in exactly that stretch's own basis.
 *
 * `observations` is a sequence of per-unit motif-count Maps, in reading
 * order, prefix-only (the caller owes causality — READING-SPEC S3).
 */
export const contextualModes = (observations, { dt = 1 } = {}) => {
  const candidates = dyadicCandidates(observations.length);
  if (!candidates.length) return { gap: "too_few_observations", observations: observations.length };
  const measured = dmdWindow(observations, conclusionOf, { candidates });
  const window = measured.window ?? observations.length;
  const stretch = observations.slice(Math.max(0, observations.length - window));
  const out = decompose(stretch, { dt });
  return {
    window: measured.window,
    windowBasis: measured.basis,
    windowGap: measured.gap ?? null,
    triedDepths: measured.tried,
    usedObservations: stretch.length,
    ...out,
  };
};
