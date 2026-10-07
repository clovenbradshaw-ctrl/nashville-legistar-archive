// native/kernel/merge-standing.js — A MERGE IS A HYPOTHESIS, A POSITION IS ITS
// ATTACK (2026-09-28). Medium-blind, kernel-level. Standing: nomination.
//
// The cast's name-variant coreference MERGES two surfaces into one being
// ("Pierre Bezúkhov" into "Count Bezúkhov", under the title). The material's
// own occupancy testimony says that locus is HELD — by two distinct occupant
// referents. Both are evidence; neither is a verdict. This organ turns them
// into the identity organ's own vocabulary, so that kernel/identity.js's
// `deriveIdentityRevision` does the judging with the operators it already
// owns:
//   a merge      -> a SUPPORT of the identity alternative (left = the absorbed
//                   surface, right = the surviving one): CON·Figure, the
//                   alternative opened or strengthened, on the fold
//   a position   -> an ATTACK on every alternative that names that locus,
//                   once the locus has >= minOccupants distinct occupants:
//                   SEG·Figure, the alternative split to `distinct`, plus the
//                   DEF exclusion identity.js already lands
// Nothing here decides; nothing here names a medium. `minOccupants` is the
// caller's (P4) — positionsByPattern's own floor is 2 (one arrival has no
// co-arrival to test), and a caller that wants stricter says so.
//
// AMENDED the same day, from the v6 run (results/occupancy-host-eval-v6-
// RESULTS.md): the two occupants that split the Bezúkhov merge were
// `monsieur_pierre` and `pierre` — ONE being under two cast ids. The attack
// had inherited its distinctness from the cast, and the cast was the thing
// on trial. So a locus with two occupants is itself UNDECIDED (undecided.js):
//   position   — two holders, the locus is not a being       -> the attack
//   one_being  — one holder under two names                  -> a SUPPORT for
//                merging the occupants (CON·Figure), no attack
// A for-whom collapses it under a named rule. `NESTED_NAMES` reads the
// caller's declared nesting evidence (which occupant pairs nest, and which
// are AMBIGUOUS — a partial nesting the caller's medium cannot settle; both
// the caller's own reading, never computed here): any ambiguous pair ->
// contested; every pair nested -> one_being; no pair nested -> position;
// mixed -> contested. A contested locus attacks nothing and proposes
// nothing. With NO nesting evidence declared
// the rule `CAST_DISTINCTNESS` collapses to position — the pre-amendment
// behaviour, now a named trust with its giver rather than a silent one.
// An uncollapsed slot never attacks (THE-UNDECIDED: an uncollapsed
// candidate is never asserted).

import { undecided, collapse, COLLAPSE_VERDICTS } from "./undecided.js";

export const MERGE_STANDING_SCHEMA = "EOMergeStanding@1";
export const DEFAULT_FOR_WHOM = Object.freeze({ id: "reader:merge-standing" });

const pairKey = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** Every pair nested -> one_being; none -> position; some -> contested. Nesting is the caller's declared evidence. */
export const NESTED_NAMES = Object.freeze({
  name: "nested_names", giver: "kernel/merge-standing.js (v6 amendment): a name contained in another name is one being's two faces, not two holders",
  decide: (cs, rec) => {
    const one = cs.findIndex((c) => c.value === "one_being"), pos = cs.findIndex((c) => c.value === "position");
    const pairs = rec.candidates[one]?.features.pairs ?? 0, nested = rec.candidates[one]?.features.nestedPairs ?? 0, ambiguous = rec.candidates[one]?.features.ambiguousPairs ?? 0;
    if (!pairs) return { chosen: pos, reason: "no occupant pairs" };
    if (ambiguous) return { contested: [one, pos], reason: `${ambiguous} of ${pairs} occupant pairs nest only partially (a bare head or given, a dropped middle name) — the names cannot settle it` };
    if (nested === pairs) return { chosen: one, reason: `every occupant pair nests (${nested}/${pairs})` };
    if (nested === 0) return { chosen: pos, reason: `no occupant pair nests (0/${pairs})` };
    return { contested: [one, pos], reason: `some occupant pairs nest (${nested}/${pairs}) — neither reading stands alone` };
  },
});
/** The pre-amendment reading, named: the cast's ids are trusted as distinct beings. */
export const CAST_DISTINCTNESS = Object.freeze({
  name: "cast_distinctness", giver: "the cast (discoverReferents): two referent ids are two beings — a trust, declared as a rule so it can be refused",
  decide: (cs) => ({ chosen: cs.findIndex((c) => c.value === "position"), reason: "no nesting evidence declared; the cast's distinctness stands" }),
});

/**
 * positionSlot({ locus, occupants, witnesses, nested, giver, cursor })
 *   -> EOUndecided@1: the locus as position | one_being, with the caller's nesting evidence as features.
 *   nested: Set of pairKey(a, b) for occupant pairs the caller reads as one name inside another (optional).
 */
export function positionSlot({ locus, occupants, witnesses = [], nested = null, ambiguous = null, giver, cursor = null }) {
  const pairs = []; for (let i = 0; i < occupants.length; i++) for (let j = i + 1; j < occupants.length; j++) pairs.push([occupants[i], occupants[j]]);
  const nestedPairs = nested ? pairs.filter(([a, b]) => nested.has(pairKey(a, b))) : [];
  const amb = ambiguous ?? nested?.ambiguous ?? null;
  const ambiguousPairs = amb ? pairs.filter(([a, b]) => amb.has(pairKey(a, b))) : [];
  return undecided({
    question: "what this locus is", slot: `locus:${locus}`, giver, cursor,
    candidates: [
      { value: "position", via: "occupancy", features: { occupants: occupants.length, witnesses: witnesses.length, pairs: pairs.length, nestedPairs: nestedPairs.length, ambiguousPairs: ambiguousPairs.length } },
      { value: "one_being", via: "occupancy", features: { occupants: occupants.length, witnesses: witnesses.length, pairs: pairs.length, nestedPairs: nestedPairs.length, ambiguousPairs: ambiguousPairs.length, nested: nestedPairs.map(([a, b]) => `${a}<->${b}`), ambiguous: ambiguousPairs.map(([a, b]) => `${a}<->${b}`) } },
    ],
  });
}

/**
 * mergeEvidence({ merges, standings, witness, minOccupants, nested, forWhom, rule, cursor })
 *   merges:    [{ surface, into, witness?, basis? }]
 *   standings: [{ locus, occupant, witness? }]   (locus and occupant are referent ids or surfaces — the SAME
 *                                               vocabulary the merges use; the caller keys them)
 *   nested:    Set of "a\u0000b" (ordered by <) — occupant pairs the caller reads as nesting names (optional)
 *   rule:      a collapse rule; defaults to NESTED_NAMES when `nested` is declared, CAST_DISTINCTNESS otherwise
 * -> { supports, attacks, positions, slots, collapses, withheld, schema }
 *   supports carries the merges AND, for every locus collapsed one_being, the occupant pairs as merge hypotheses.
 */
export function mergeEvidence({ merges = [], standings = [], witness = null, minOccupants, nested = null, ambiguous = null, forWhom = DEFAULT_FOR_WHOM, rule = null, cursor = null } = {}) {
  if (!Number.isInteger(minOccupants) || minOccupants < 1) throw new TypeError("mergeEvidence: minOccupants is declared — how many holders make a position is never a default");
  const theRule = rule ?? (nested ? NESTED_NAMES : CAST_DISTINCTNESS);
  const supports = merges.filter((m) => m?.surface && m?.into && m.surface !== m.into).map((m) => ({ left: m.surface, right: m.into, witness: m.witness ?? witness, reason: m.basis ?? "name_variant_merge" }));
  const byLocus = new Map();
  for (const s of standings) { if (!s?.locus || !s?.occupant) continue; if (!byLocus.has(s.locus)) byLocus.set(s.locus, { occupants: new Set(), witnesses: [] }); const e = byLocus.get(s.locus); e.occupants.add(s.occupant); if (s.witness) e.witnesses.push(s.witness); }
  const held = [...byLocus].filter(([, e]) => e.occupants.size >= minOccupants).map(([locus, e]) => ({ locus, occupants: [...e.occupants], witnesses: e.witnesses }));
  const slots = [], collapses = [], positions = [], withheld = [], attacks = [];
  for (const p of held) {
    const slot = positionSlot({ ...p, nested, ambiguous: ambiguous ?? nested?.ambiguous ?? null, giver: theRule.giver, cursor });
    const c = collapse(slot, { forWhom, rule: theRule, cursor });
    slots.push(slot); collapses.push(c);
    if (c.verdict === COLLAPSE_VERDICTS.CHOSEN && c.chosen.value === "position") {
      positions.push(p);
      for (const m of merges) {
        if (m?.surface !== p.locus && m?.into !== p.locus) continue;
        attacks.push({ left: m.surface, right: m.into, witness: p.witnesses[0] ?? witness, reason: `position_held_by_${p.occupants.length}: a locus with ${p.occupants.length} distinct occupants is not one being` });
      }
    } else {
      withheld.push({ locus: p.locus, occupants: p.occupants, verdict: c.verdict, reason: c.reason });
      if (c.verdict === COLLAPSE_VERDICTS.CHOSEN && c.chosen.value === "one_being") {
        for (const pair of c.chosen.features.nested) { const [a, b] = pair.split("<->"); supports.push({ left: a, right: b, witness: p.witnesses[0] ?? witness, reason: `one_being_under_names: two occupants of ${p.locus} whose names nest` }); }
      }
    }
  }
  return Object.freeze({ schema: MERGE_STANDING_SCHEMA, supports: Object.freeze(supports), attacks: Object.freeze(attacks), positions: Object.freeze(positions), slots: Object.freeze(slots), collapses: Object.freeze(collapses), withheld: Object.freeze(withheld) });
}

export const occupantPairKey = pairKey;
