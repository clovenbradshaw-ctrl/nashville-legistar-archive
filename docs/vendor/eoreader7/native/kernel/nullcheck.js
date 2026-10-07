// native/kernel/nullcheck.js — THE SHUFFLE-AND-COUNT LOOP, SHARED
// (2026-09-22).
//
// "No hand-set thresholds, prefer a measured null" runs through this whole
// engine — a candidate cut, split, or boundary is only accepted once it
// beats what random draws of the same material would give. A repo-wide
// search found this exact loop — draw a null, recompute a statistic, count
// how many draws are at least as extreme as what was observed — written out
// independently in at least seven places (the-fold/medium.js, form-prior.js,
// kind-memory.js, relative.js, kernel/for-whom.js, kernel/notes.js,
// kernel/surprise-segments.js), each with its own draws/rnd/seed plumbing.
//
// WHAT IS SHARED HERE, AND WHAT ISN'T: only the counting loop. The p-value
// FORMULA is a real, deliberate choice each caller makes for itself —
// medium.js's uniformityP returns a plain atLeastAsExtreme/draws ratio;
// kind-memory.js's splitProposal adds a Laplace +1 correction on both sides
// so a null of zero observed exceedances never reads as p=0 from a finite
// sample. Forcing one formula onto both would be a behavior change dressed
// as a refactor. permutationCount hands back the raw count and lets the
// caller finish the arithmetic its own way.
//
// NOT YET MIGRATED: kernel/for-whom.js's trajectoryNull, kernel/notes.js's
// dietBoundaries, kernel/surprise-segments.js's segmentBySurprise, and
// the-fold/relative.js's nullBand all run the same shape of loop but were
// not read closely enough this session to migrate without risk — in a
// shared, live checkout, touching a file's exact statistical convention
// without having verified it first is not a refactor, it is a guess.

/**
 * permutationCount(draws, drawNull, isAtLeastAsExtreme) — run `draws` draws
 * of the null (drawNull() → one null statistic), count how many satisfy
 * isAtLeastAsExtreme(nullStat). Returns { ge, draws }; the caller turns
 * that into whatever p-value convention it already uses.
 */
export function permutationCount(draws, drawNull, isAtLeastAsExtreme) {
  let ge = 0;
  for (let d = 0; d < draws; d += 1) if (isAtLeastAsExtreme(drawNull())) ge += 1;
  return { ge, draws };
}
