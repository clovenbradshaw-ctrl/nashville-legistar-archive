// the-fold/claim-dependencies.js -- the missing piece for wiring kernel/
// consequential-surprise.js's load-bearing/local partition into holon-
// addressed GFP claims. consequentialSurprise needs a dependents `index`
// (kernel/cascade.js's dependentsIndex) and a caller-declared `seedsOf`
// mapping a slot/value to seed ids reachable through it -- checked earlier
// this session via docs/surprise-organs.js's own real usage, and named as a
// gap because no existing seedsOf generalizes to claims. This builds one,
// on its own, tested standalone -- not yet wired into fold-at.js or the CLI,
// which is the disclosed next step, not attempted here.
//
// THE DEPENDENCY RELATION: claim B depends on claim A when they share a role
// filler (the same ARG0 or ARG1 value) -- a real, mechanical proxy for
// coreference/shared-entity connection, the same kind of connection this
// whole project already treats as meaningful (referents.js's own resolved
// beings, takesUp's own referent-overlap check in finish.js). Not invented
// for this file: it is the same "do these two statements share a subject"
// test used elsewhere, applied here to claims instead of raw text.
import { dependentsIndex } from "../kernel/cascade.js";
import { createHolograph } from "../kernel/bayes-surprise.js";
import { consequentialSurprise } from "../kernel/consequential-surprise.js";
import { slotsFromClaims, cloneHolograph } from "./fold-at.js";
import { seeded } from "../adapters/text/english-parser.js";

/** Every role filler a claim carries, as values (not keyed by role -- ARG0
 *  and ARG1 both count as "this claim mentions X"). */
function fillersOf(claim) {
  return Object.values(claim?.roles ?? {}).filter(Boolean);
}

/**
 * claimDependencyIndex(claims, idOf) -> Map(fillerValue -> Set(claim ids))
 *
 * The dependents index kernel/consequential-surprise.js's own `index`
 * parameter expects: for each role-filler VALUE (the "dependency"), which
 * claim ids mention it. `idOf` defaults to claim.id, falling back to the
 * claim's own ground when no id was declared (gfpClaim's id is optional).
 */
export function claimDependencyIndex(claims, idOf = (c) => c.id ?? c.ground) {
  return dependentsIndex(claims, fillersOf, idOf);
}

/**
 * seedsOfClaimFiller(slot, value) -> the value itself, as a one-element seed
 * list, when the slot is a role slot (this file's own naming convention,
 * "N:role:ARGn", matches fold-at.js's slotsFromClaims exactly -- checked by
 * reading its source before writing this). A non-role slot (rel, polarity)
 * has no filler-sharing meaning and seeds nothing -- cascade() only ever
 * walks from a real shared entity, never a relation label or a polarity
 * sign, which are not "things other claims can mention."
 */
export function seedsOfClaimFiller(slot, value) {
  return /:role:/.test(String(slot)) ? [value] : [];
}

/**
 * loadBearingChecker(allClaims, { pValue, idOf }) -> (candidateId) => true|false|null
 *
 * Consolidates a pattern this session hand-rolled three separate times
 * (cli/fold-at.mjs's own CLI query, arrange.js's inline loadBearingOf
 * closure, and ad hoc test scripts): build one dependency index and one
 * fresh holograph over `allClaims`, then, per candidate, run
 * kernel/consequential-surprise.js's consequentialSurprise on a CLONE of
 * that holograph (never mutating the shared one -- verified the same way
 * fold-at.js's own significance layer is) restricted to just the claims
 * whose id starts with `${candidateId}:` (this project's own claimsFromFeat
 * id convention, checked against arrange.js before writing this).
 *
 * Returns null (never a guessed false) when the candidate has no claims of
 * its own to check. When `pValue` is not supplied, returns a function that
 * always answers null -- the same "opt-in, no default threshold" contract
 * every consequentialSurprise caller in this project already follows.
 *
 * DETERMINISTIC BY CANDIDATE ID (fixed 2026-09-26, found by mechanical
 * reproduction: the same candidate, same claim universe, same pValue,
 * checked five times in a row, flipped true/false non-deterministically,
 * and disagreed with itself within one process run when checked twice for
 * the same id). consequentialSurprise's own null simulation defaults its
 * `rng` to Math.random when no caller supplies one; this had never been
 * seeded here. Passing `seeded(candidateId)` (english-parser.js's own
 * already-established PRNG, the same one pocket-discovery-gap.js already
 * uses for its own null trials) makes the SAME candidate id always resolve
 * to the SAME verdict against the SAME claim universe -- a real fix to a
 * pre-existing defect, not a new invention.
 */
export function loadBearingChecker(allClaims, { pValue = null, idOf = (c) => c.id ?? c.ground } = {}) {
  if (pValue === null || !allClaims.length) return () => null;
  const index = claimDependencyIndex(allClaims, idOf);
  const holo = createHolograph({ alpha: 1, gamma: 1 });
  return (candidateId) => {
    const own = allClaims.filter((c) => c.id?.startsWith(`${candidateId}:`));
    if (!own.length) return null;
    const facts = Object.fromEntries(slotsFromClaims(own));
    const result = consequentialSurprise(cloneHolograph(holo), facts, { index, seedsOf: seedsOfClaimFiller, pValue, rng: seeded(String(candidateId)) });
    return result.rows.some((r) => r.loadBearing);
  };
}

/**
 * loadBearingOfWhole(allClaims, memberIds, { pValue, idOf }) -> true|false|null
 *
 * A HOLONIC EXPERIMENT (2026-09-26, user: "these get nested holonically... a
 * holon is both a whole and a part"): loadBearingChecker answers "is THIS ONE
 * member load-bearing" and a caller combines many such answers into a PARTS
 * aggregate (arrange.js's own bodySlots do exactly this: true if any member's
 * own check is true, null if every member's is null, false otherwise). This
 * function instead pools every claim belonging to ANY of `memberIds` into ONE
 * combined candidate and runs consequentialSurprise ONCE on that union -- a
 * genuine WHOLE-level question: do this group's claims, taken together, reach
 * farther through the dependency index than a null of equivalent size, not
 * "does any one of them alone." The two computations are structurally
 * different (one call over a union vs. several calls combined by boolean
 * logic) and are not guaranteed to agree -- that disagreement, if real and
 * measured, is the holonic tension made concrete, not assumed.
 *
 * Same "opt-in, no default threshold" contract as loadBearingChecker: null
 * when pValue is unset or the group has no claims of its own to check.
 */
export function loadBearingOfWhole(allClaims, memberIds, { pValue = null, idOf = (c) => c.id ?? c.ground } = {}) {
  if (pValue === null || !allClaims.length || !memberIds?.length) return null;
  const prefixes = memberIds.map((id) => `${id}:`);
  const own = allClaims.filter((c) => prefixes.some((p) => c.id?.startsWith(p)));
  if (!own.length) return null;
  const index = claimDependencyIndex(allClaims, idOf);
  const holo = createHolograph({ alpha: 1, gamma: 1 });
  const facts = Object.fromEntries(slotsFromClaims(own));
  const result = consequentialSurprise(holo, facts, { index, seedsOf: seedsOfClaimFiller, pValue, rng: seeded(memberIds.join("|")) });
  return result.rows.some((r) => r.loadBearing);
}
