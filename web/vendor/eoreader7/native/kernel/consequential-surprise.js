// native/kernel/consequential-surprise.js — CONSEQUENTIAL SURPRISE: THE BITS AN
// ADMISSION MOVES, PARTITIONED BY HOW MUCH RESTS ON WHAT MOVED (2026-09-25).
// Medium-blind, kernel-level. Handle: Bar-Hillel & Carnap — after the paradox
// that a contradiction carries infinite information and no meaning: rarity and
// consequence were never one axis. Nomination.
//
// kernel/bayes-surprise.js measures how far ONE slot's belief moved on an
// admission, and says of itself that independence of slots is a declared
// simplification. kernel/cascade.js measures how much rests on an id,
// transitively, and ranks that reach against a null of synthetic seeds
// (cascadeNull). Neither imported the other — checked 2026-09-25 by grep: no
// module in native/ imports both. This module introduces them and adds nothing
// of its own except a partition:
//
//   CONSEQUENTIAL BITS   the Bayesian surprise of slots whose attached ids reach
//                        farther through the dependents index than the null's
//                        synthetic seeds do, at the caller's declared pValue —
//                        surprise that landed on something load-bearing
//   LOCAL BITS           the rest — belief moved; nothing was resting on it
//
// The dangerous case is reported, never scored: a slot attached to an id below
// corroboration.js's CANONICALIZATION_FLOOR that is nonetheless load-bearing
// (`thinButLoadBearing`) — cheap to contradict in bits, because barely any prior
// mass sat there; expensive to lose, because the reach says so. No product of
// bits and reach is computed: a composite would be a formula nobody earned. The
// rank is the measurement; the partition is the only arithmetic, and it is a sum.
//
// WHAT A SLOT ATTACHES TO IS THE CALLER'S. `seedsOf(slot, value)` maps an
// admitted fact to ids in the caller's own dependents index; this file names no
// slot, no id, no schema. `pValue` is declared by the caller (P9, never
// defaulted): a verdict about chance states its bar in the result. A reach of
// zero is never load-bearing whatever its rank — on an empty index every
// synthetic seed also reaches zero and the rank is vacuously 1.0.
//
// Typing (reasoned, per capacities.js's hand-check discipline): evaluating how a
// Pattern-grain belief change relates to the network that rests on it is
// Relate·Interpretation at Pattern grain — EVA·Paradigm, Tracing: a property of
// the SET of dependents no single slot carries, the same reason `standing`
// (capacity-runner.js::mergeTestimony) sits in that cell.

import { admit } from "./bayes-surprise.js";
import { cascade, cascadeNull } from "./cascade.js";
import { CANONICALIZATION_FLOOR } from "./corroboration.js";

export const CONSEQUENTIAL_SURPRISE_SCHEMA = "EOConsequentialSurprise@1";
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

/** count(null <= reached) / trials — cascadeSurprise's own rank definition,
 *  over a null computed once per seed count and shared across every slot that
 *  attaches that many ids. */
function rankIn(reachedCounts, reached) {
  let atOrBelow = 0;
  for (const c of reachedCounts) if (c <= reached) atOrBelow++;
  return atOrBelow / reachedCounts.length;
}

/**
 * consequentialSurprise(holo, facts, { index, seedsOf, pValue, trials, rng,
 * corroborationOf, volatilityOf }) → { schema, surprisal, bayes,
 * consequentialBits, localBits, rows, pValue, trials, basis }
 *
 * Admits `facts` into `holo` exactly as bayes-surprise.js's admit does (the
 * holograph is updated once; both surprises are measured against the prior as
 * it stood before), then, per slot, walks the ids `seedsOf(slot, value)`
 * attaches through `index` (a cascade.js dependentsIndex) and ranks the reach
 * against cascadeNull at the same seed count. A slot attaching no id is local
 * by construction and says so.
 *
 * `corroborationOf(id)` (optional) → the id's distinct-source count
 * (corroboration.js::corroboration); `volatilityOf(id)` (optional) → the id's
 * revision-volatility p (revision-volatility.js::volatilityOf). Both are
 * reported per row, never multiplied in.
 */
export function consequentialSurprise(holo, facts, { index, seedsOf, pValue, trials = 200, rng = Math.random, corroborationOf = null, volatilityOf = null } = {}) {
  if (!(index instanceof Map)) throw new TypeError("consequentialSurprise: index is a cascade.js dependentsIndex (a Map)");
  if (typeof seedsOf !== "function") throw new TypeError("consequentialSurprise: seedsOf(slot, value) is declared by the caller — no slot is named here");
  if (!(pValue > 0 && pValue < 1)) throw new TypeError("consequentialSurprise: pValue is declared by the caller, in (0, 1) — never defaulted (P9)");
  if (!(trials >= 1)) throw new TypeError("consequentialSurprise: trials is a positive count");
  const delta = admit(holo, facts);
  const nullsBySeedCount = new Map();
  const nullFor = (n) => {
    if (!nullsBySeedCount.has(n)) nullsBySeedCount.set(n, cascadeNull(index, n, { trials, rng }).reachedCounts);
    return nullsBySeedCount.get(n);
  };
  const rows = [];
  let consequentialBits = 0, localBits = 0;
  for (const [slot, { value, surprisal, bayes }] of Object.entries(delta.perSlot)) {
    const seeds = [...new Set([...(seedsOf(slot, value) ?? [])].filter((id) => id != null))];
    if (!seeds.length) {
      rows.push({ slot, value, surprisal, bayes, seeds, reached: 0, rank: null, loadBearing: false, thin: null, thinButLoadBearing: false, volatile: null, basis: "attaches no id — local by construction" });
      localBits += bayes;
      continue;
    }
    const reached = cascade(index, seeds).length;
    const rank = rankIn(nullFor(seeds.length), reached);
    const loadBearing = reached > 0 && rank > 1 - pValue;
    const corro = corroborationOf ? seeds.map((id) => corroborationOf(id)) : null;
    const thin = corro ? corro.some((c) => Number.isFinite(c) && c < CANONICALIZATION_FLOOR) : null;
    const vol = volatilityOf ? seeds.map((id) => volatilityOf(id)) : null;
    const volatile = vol ? vol.some((p) => Number.isFinite(p) && p < pValue) : null;
    rows.push({
      slot, value, surprisal, bayes, seeds, reached, rank, loadBearing,
      thin, thinButLoadBearing: thin === true && loadBearing, volatile,
      basis: `${reached} id(s) rest on ${seeds.length} seed(s); rank ${rank.toFixed(3)} against ${trials} synthetic seed set(s) of the same size — ${loadBearing ? `above the ${pValue} bar: load-bearing` : reached === 0 ? "nothing rests on it: local" : "within chance: local"}${thin === true ? `; a seed sits below the corroboration floor (${CANONICALIZATION_FLOOR})` : ""}${volatile === true ? "; a seed's own revision history is itself above chance" : ""}`,
    });
    if (loadBearing) consequentialBits += bayes; else localBits += bayes;
  }
  rows.sort((a, b) => (Number(b.loadBearing) - Number(a.loadBearing)) || (b.bayes - a.bayes));
  return {
    schema: CONSEQUENTIAL_SURPRISE_SCHEMA,
    surprisal: delta.surprisal,
    bayes: delta.bayes,
    consequentialBits,
    localBits,
    rows,
    pValue,
    trials,
    basis: `${delta.bayes.toFixed(3)} bits moved across ${rows.length} slot(s): ${consequentialBits.toFixed(3)} on load-bearing ids (reach above ${trials} synthetic seed sets at pValue ${pValue}), ${localBits.toFixed(3)} local; corroboration floor ${CANONICALIZATION_FLOOR}`,
  };
}
