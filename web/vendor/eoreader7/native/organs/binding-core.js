// binding-core.js — the Binding stance's algebra, extracted as ONE core
// with ZERO domain vocabulary. §VIII.1's test article.
//
// THE PREDICTION UNDER TEST (THE-THREE-MATHEMATICS §VIII.1): "an organ
// occupying a stance in one MATHEMATICS should port to another with only
// its adapter changing." Binding (Relate·Figure) is the stance that went
// full first — SIG·Figure (cast: mention -> referent), CON·Figure
// (relations: claim -> edge), EVA·Figure (witness: testimony -> verdict).
// If those three are one act in three mathematics, their shared core is
// expressible once, domain-blind, and each cell is that core plus a thin
// adapter. If any cell needs the CORE changed, the prediction breaks and
// THE-THREE-MATHEMATICS says so.
//
// THE CORE, read off all three organs before writing it (each clause
// names where it already lives):
//   1. a FIGURE seeks its counterpart in a FIELD of candidates
//   2. a declared CRITERION scores each candidate (cast: surface
//      nesting/containment; relations: endpoint+label agreement;
//      witness: decider containment)
//   3. the binding demands a UNIQUE clearing candidate — a tie is
//      AMBIGUOUS, refused, never a coin flip (cast's ambiguous_surface;
//      relations' competing; the witness's same-index arm)
//   4. a positive answer must survive an INSENSITIVITY probe where the
//      caller supplies one — a criterion that also clears a designated
//      foil learned nothing (the witness's sibling arm; the null arms
//      everywhere else)
//   5. the outcome CARRIES ITS EVIDENCE, and every failure is a TYPED
//      refusal, never a silent miss
//
// MEDIUM- AND DOMAIN-BLIND BY MECHANICAL ASSERTION: the transfer test
// scans this file's own source for domain vocabulary (contest.js's own
// enforcement trick) — no mention/referent/edge/claim/verdict/witness
// words may appear below this header.

export const REFUSALS = Object.freeze({
  no_candidate: "the field offers nothing to bind to",
  below_criterion: "no candidate clears the declared criterion",
  ambiguous: "more than one candidate clears, and none leads by the declared margin — a tie is never a coin flip",
  foiled: "the criterion also clears the designated foil, so a clearance carries no information",
  undeclared: "score and floor are the caller's — never defaulted",
});

/**
 * bind(figure, field, { score, floor, margin, foil }) — the Binding act.
 *
 * `score(figure, candidate)` -> finite number (higher = stronger), the
 *   domain adapter's whole contribution;
 * `floor` — the declared clearance (P4: never defaulted);
 * `margin` — how far the winner must lead the runner-up, in the same
 *   units (0 allows exact co-winners to refuse as ambiguous);
 * `foil` — optional: a candidate-shaped thing that must NOT clear; if it
 *   does, the act refuses as foiled (the insensitivity probe).
 *
 * Returns { bound: candidate, strength, runnerUp, evidence } or
 * { refused, detail } — typed, with the scores that decided it.
 */
export function bind(figure, field, { score, floor, margin = 0, foil = null } = {}) {
  if (typeof score !== "function" || !Number.isFinite(floor))
    return { refused: "undeclared", detail: REFUSALS.undeclared };
  const candidates = [...(field ?? [])];
  if (!candidates.length) return { refused: "no_candidate", detail: REFUSALS.no_candidate };

  const scored = candidates
    .map((candidate) => ({ candidate, strength: score(figure, candidate) }))
    .filter((s) => Number.isFinite(s.strength))
    .sort((a, b) => b.strength - a.strength);

  const clearing = scored.filter((s) => s.strength >= floor);
  if (!clearing.length)
    return { refused: "below_criterion", detail: REFUSALS.below_criterion, best: scored[0] ?? null };

  if (foil !== null) {
    const foilStrength = score(figure, foil);
    if (Number.isFinite(foilStrength) && foilStrength >= floor)
      return { refused: "foiled", detail: REFUSALS.foiled, foilStrength };
  }

  const [top, runnerUp = null] = clearing;
  if (runnerUp && top.strength - runnerUp.strength <= margin)
    return { refused: "ambiguous", detail: REFUSALS.ambiguous, contenders: clearing.slice(0, 4) };

  return { bound: top.candidate, strength: top.strength, runnerUp, evidence: { floor, margin, cleared: clearing.length } };
}
