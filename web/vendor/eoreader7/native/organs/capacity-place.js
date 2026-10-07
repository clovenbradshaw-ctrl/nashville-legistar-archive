// organs/capacity-place.js — WHERE THE SYSTEM STANDS ON ITS OWN MAP (THE-CAPACITY-MAP.md; git 2f81545:native/docs/).
//
// Reads the two registries the system already keeps about itself — `organs/capacities.js`
// (what has been BUILT, with the terrain each organ lands on) and `assemblies.js` (what each
// assembly is FOR, and which stages it says it has not run) — and places them on the capacity
// map (kernel/capacity-map.js). Three profiles come out, and the distance between them is S10's
// "dressed":
//   built            a place with at least one organ: a CLAIM that the capacity exists
//   declared         a place some assembly says it is for
//   registryMeasured a declared place whose every declaring assembly names no measurement gap
// It runs nothing and loads no organ.
//
// THE LIMIT, stated where it bites: `registryMeasured` is only as true as the registry's own
// prose. `stagesNotRun` is free text and can go stale — assemblies.js still lists the Network
// standing run as never done while eval/network-standing.mjs exists and its results are on disk
// (the driver was written to be that stage). So this is the REGISTRY'S account of what is
// measured, not an earned ledger; an earned ledger names a results file and a control per place,
// and is a separate object (EARNED, below) that starts short on purpose.
import { nativeRegistry } from "../assemblies.js";
import { registeredAssemblies } from "../kernel/assembly.js";
import { CAPACITIES } from "./capacities.js";
import { PLACES, dressed, placeReached, placeOf, describe, admissible } from "../kernel/capacity-map.js";

/**
 * A stage the registry lists that names a MEASUREMENT still to do — not a persistence step
 * (sealing) and not a split. fold-plan.js used a shorter pattern that missed "native run on real
 * material" and so called an unmeasured Network fold measured; one pattern now serves both.
 */
export const MEASUREMENT_GAP = /\b(measure|measurement|unmeasured|real material)\b/i;
export const hasMeasurementGap = (asm) => (asm.stagesNotRun ?? []).some((s) => MEASUREMENT_GAP.test(s));

const isReading = (a) => a.layer !== "baseline";

/**
 * LIMITS — what running the built organs on real material (THE-CAPACITY-MAP.md, F3-F5')
 * showed they cannot yet be trusted to do. Each entry is attached to the place its organ's declared
 * cell lands on, and names the files that hold the runs. Those files, the doc and the test that
 * recomputed every number here from them were removed from the tree (they are at git 2f81545), so
 * these numbers are a record of that run and are NOT pinned by a test any more.
 *
 * It is not an earned ledger and does not say what IS earned: it says what was found, where.
 * `quantityClass` is set where the class of the QUANTITY differs from the class of the ACT the
 * organ's cell names — the seam F3 and F4 both landed on: the pair direction the binding organ
 * reports is a transcendental quantity (transfer entropy) computed inside a Structure-domain act.
 */
export const LIMITS = Object.freeze([
  Object.freeze({
    id: "extent-ends-a-sentence-inside-a-name",
    terrain: "Field",
    organ: "adapters/text/spans.js::splitSentences",
    finding:
      "a sentence is ended at an honorific abbreviation (Mr., Mrs., Dr.), cutting the extent inside a name. The engine already holds the received class HONORIFIC_TITLES (adapters/text/priors.js, giver lang/en); the abbreviation derivation does not consult it.",
    // sentences containing <Honorific>. and how many END in it, per book (f5p as-split audit)
    measured: Object.freeze([
      Object.freeze({ book: "pg1342_Pride_and_Prejudice.txt", role: "development", endingInIt: 1166, of: 1170 }),
      Object.freeze({ book: "pg1661_The_Adventures_of_Tom_Sawyer.txt", role: "heldout", endingInIt: 30, of: 59 }),
      Object.freeze({ book: "pg2701_Moby_Dick.txt", role: "heldout", endingInIt: 42, of: 122 }),
      Object.freeze({ book: "pg345_Dracula.txt", role: "development", endingInIt: 127, of: 403 }),
      Object.freeze({ book: "pg768_The_Adventures_of_Sherlock_Holmes.txt", role: "heldout", endingInIt: 67, of: 367 }),
      Object.freeze({ book: "pg84_Frankenstein.txt", role: "development", endingInIt: 5, of: 18 }),
    ]),
    evidence: Object.freeze(["git 2f81545:native/eval/capacity-map/results/f5p-development.json", "git 2f81545:native/eval/capacity-map/results/f5p-heldout.json"]),
  }),
  Object.freeze({
    id: "a-cut-off-honorific-is-admitted-as-a-being",
    terrain: "Entity",
    organ: "adapters/text/surfaces.js (extractSurfaces / discoverReferents) reading the cut extent",
    finding:
      "a bare honorific stands as a being with the names beside it. How much that dresses the top standing edges is specific to the book: repairing the extent lowers the share of the 20 strongest edges resting on a bare-honorific endpoint by 0.40 in one development book and by 0.00 to 0.05 in each held-out book (the placebo merge lowers it by 0.00 to 0.05), so the registered follow-up did not support it as general.",
    // share of the top-20 standing edges with a bare-honorific endpoint: as-split -> extent-repaired -> placebo
    measured: Object.freeze([
      Object.freeze({ book: "pg1342_Pride_and_Prejudice.txt", role: "development", asSplit: 0.6, repaired: 0.2, placebo: 0.55 }),
      Object.freeze({ book: "pg345_Dracula.txt", role: "development", asSplit: 0.15, repaired: 0, placebo: 0.15 }),
      Object.freeze({ book: "pg84_Frankenstein.txt", role: "development", asSplit: 0, repaired: 0, placebo: 0 }),
      Object.freeze({ book: "pg768_The_Adventures_of_Sherlock_Holmes.txt", role: "heldout", asSplit: 0.15, repaired: 0.1, placebo: 0.15 }),
      Object.freeze({ book: "pg2701_Moby_Dick.txt", role: "heldout", asSplit: 0.1, repaired: 0.1, placebo: 0.1 }),
      Object.freeze({ book: "pg1661_The_Adventures_of_Tom_Sawyer.txt", role: "heldout", asSplit: 0.05, repaired: 0, placebo: 0 }),
    ]),
    evidence: Object.freeze(["git 2f81545:native/eval/capacity-map/results/f5p-development.json", "git 2f81545:native/eval/capacity-map/results/f5p-heldout.json", "git 2f81545:native/eval/capacity-map/results/f5c-bare-titles.json"]),
  }),
  Object.freeze({
    id: "pair-direction-is-a-weak-rung",
    terrain: "Link",
    quantityClass: "transcendental",
    organ: "legacy-ported/packages/engine/emergence/binding.js::buildLink (the transfer-entropy asymmetry)",
    finding:
      "the direction of a pair, read from transfer entropy on arrival indicators, is reproducible across interleaved halves above an order-destroyed control only weakly: in the standing pairs of the Shakespeare plays (excess 0.046, p 0.025) and not in the standing pairs of any of the three novels (excess 0.039, 0.061 and -0.059; p 0.125, 0.075 and 0.90). Standing raised its reliability within volume strata (contrast 0.065, 0.095, 0.052 in three materials) but was not a precondition for it.",
    // primary setting, standing group: excess agreement E_S and its order-destroyed rank p, per material
    measured: Object.freeze([
      Object.freeze({ file: "f4-dracula.json", E_S: 0.039, p_E_S: 0.125 }),
      Object.freeze({ file: "f4-pride.json", E_S: 0.061, p_E_S: 0.075 }),
      Object.freeze({ file: "f4-frankenstein.json", E_S: -0.059, p_E_S: 0.9 }),
      Object.freeze({ file: "f4-plays.json", E_S: 0.046, p_E_S: 0.025 }),
    ]),
    evidence: Object.freeze(["git 2f81545:native/eval/capacity-map/results/f4-dracula.json", "git 2f81545:native/eval/capacity-map/results/f4-pride.json", "git 2f81545:native/eval/capacity-map/results/f4-frankenstein.json", "git 2f81545:native/eval/capacity-map/results/f4-plays.json"]),
  }),
]);

export const limitsFor = (terrain) => LIMITS.filter((l) => l.terrain === terrain);

/**
 * placeFromRegistries({ registry, capacities }) ->
 *   { rows, built, declared, registryMeasured, limits, dressed, notes }
 * `rows` has one entry per place: the organs built there, the assemblies declaring it, and
 * whether each declaring assembly names a measurement gap. The three profiles are
 * placeReached() results, so an orphan (a place reached with nothing beneath it) is reported,
 * never counted, and a class with no ground reached is a typed gap, not order zero.
 */
export function placeFromRegistries({ registry = nativeRegistry(), capacities = CAPACITIES } = {}) {
  const assemblies = registeredAssemblies(registry).filter(isReading);
  const rows = PLACES.map((p) => {
    const organs = capacities.filter((c) => c.terrain === p.terrain).map((c) => c.id);
    const declaredBy = assemblies.filter((a) => (a.declaredTerrains ?? []).includes(p.terrain));
    return Object.freeze({
      ...p,
      built: organs,
      declaredBy: declaredBy.map((a) => a.id),
      unmeasuredBy: declaredBy.filter(hasMeasurementGap).map((a) => a.id),
      registryMeasured: declaredBy.length > 0 && declaredBy.every((a) => !hasMeasurementGap(a)),
      limits: limitsFor(p.terrain).map((l) => l.id),
    });
  });
  const of = (pred) => placeReached(rows.filter(pred).map((r) => r.terrain));
  const built = of((r) => r.built.length > 0);
  const declared = of((r) => r.declaredBy.length > 0);
  const registryMeasured = of((r) => r.registryMeasured);
  return Object.freeze({
    rows: Object.freeze(rows),
    built,
    declared,
    registryMeasured,
    limits: LIMITS,
    dressed: built.profile.gap || registryMeasured.profile.gap ? null : dressed({ claimed: built.profile, earned: registryMeasured.profile }),
    notes: Object.freeze([
      "registryMeasured is the registry's own account (stagesNotRun prose); it is not an earned ledger and can be stale.",
      "A profile is a summary of places reached; it places claims, never material or persons.",
    ]),
  });
}

/**
 * The plan's view of the same map: which places a set of terrains reaches, and whether that
 * (claimed) profile respects the crossings. Used by fold-plan.js.
 */
export function profileOfTerrains(terrains, opts) {
  const reached = placeReached(terrains);
  return Object.freeze({
    reached,
    described: reached.profile.gap ? null : describe(reached.profile),
    admissible: reached.profile.gap ? null : admissible(reached.profile, opts),
    terrainsUnknown: Object.freeze([...new Set(terrains)].filter((t) => !placeOf(t))),
  });
}
