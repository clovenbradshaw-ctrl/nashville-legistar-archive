// kernel/narrative-time.js — Partee's organ, walked over a reading's own
// tensed arrangements. Medium-general, kernel-level: the caller supplies
// the arrangements in ledger order and a GIVER-NAMED tense typer; this
// file supplies nothing but the walk.
//
// WHY THIS EXISTS. temporal-reference.js (Partee: tense is anaphora) sat
// on eval/the-fold/results/unwired-organs.json since it was written — the
// transplant run (eval/lavar/transplant-arm.mjs, 2026-09-25) found the
// reader arrow-blind partly because no time was ever individuated as a
// referent in a real read. This is the smallest wiring that closes that:
// Partee's own account of narrative progression, where each event
// sentence in the past both refers to the current reference ground AND
// advances it (Partee 1984 after Kamp/Hinrichs), applied to the ledger's
// arrangements in the order the ledger holds them.
//
// TENSES ARE THE UNIVERSAL INVENTORY, not this file's. The typer returns
// one of kernel/universal-grammar.js's UD Tense values — Past, Pres, Fut,
// Imp, Pqp — or "undeclared"; an English adapter reads Pqp off "had gone",
// a Latin one off a single inflected form, and this walk cannot tell the
// difference, which is the point.
//
// THE WALK.
//   Past / Imp, first in the read   establish a time (INS·Figure) at the
//                                   arrangement's own address; advance the
//                                   ground to it (REC·Ground, from null)
//   Past / Imp, in a NEW sentence   establish the next time; advance the
//                                   ground, superseding the last (kept,
//                                   never erased)
//   Past / Imp, same sentence       resolve against the live ground (CON·Ground)
//   Pqp                             REACH BACK: resolve to the ground the
//                                   live one superseded (resolveReachBack);
//                                   does not advance — Partee's pluperfect
//                                   refers before the reference time and
//                                   leaves it where it is
//   Pres / Fut                      the speaker's now and after — not
//                                   anaphoric to the story's ground;
//                                   counted, never resolved
//   undeclared                      the typer could not say; counted
// Every resolution is temporal-reference.js's own verdict, never this
// file's: bound / no_candidate / no_prior_ground / adjudicated.
//
// WHAT THE FIRST VERSION MEASURED, kept on record. Without Pqp the walk
// gave identical counts forward and reversed (its own test says so): a
// linear chain of advancing grounds is indifferent to the order of the
// events. The reach-back is the first move whose verdict depends on what
// came BEFORE, so it is the first row the transplant harness can expect
// to move under sentence reversal.
import { establishTime, advanceReferenceGround, resolveAnaphoricTense, resolveReachBack } from "./temporal-reference.js";
import { UD_FEATURES } from "./universal-grammar.js";

export const TENSES = Object.freeze([...UD_FEATURES.Tense, "undeclared"]);
const ADVANCES = new Set(["Past", "Imp"]);

/**
 * narrativeTime(arrangements, { tenseOf, giver })
 *   arrangements  [{ id, at: [start, end], label, sentence }] in ledger order;
 *                 `sentence` is any value equal within one sentence
 *   tenseOf       arrangement -> one of TENSES — the caller's typer, whose
 *                 giver is named beside it
 * Returns frozen { times, grounds, resolutions, counts, giver } — every
 * object inside is temporal-reference.js's own, untouched.
 */
export function narrativeTime(arrangements, { tenseOf, giver } = {}) {
  if (typeof tenseOf !== "function") throw new TypeError("narrativeTime: tenseOf is the caller's declared typer");
  if (!giver) throw new TypeError("narrativeTime: the tense typer must name its giver");
  const times = [], grounds = [], resolutions = [];
  const counts = Object.fromEntries(TENSES.map((t) => [t, 0]));
  Object.assign(counts, { bound: 0, no_candidate: 0, adjudicated: 0, reachBound: 0, no_prior_ground: 0 });
  let current = null, lastSentence = null, n = 0;
  const record = (r, a, at) => {
    resolutions.push(Object.freeze({ ...r, arrangement: a.id, at }));
    if (r.reach) counts[r.verdict === "bound" ? "reachBound" : r.verdict === "no_prior_ground" ? "no_prior_ground" : r.verdict === "no_candidate" ? "no_candidate" : "adjudicated"] += 1;
    else counts[r.verdict === "bound" ? "bound" : r.verdict === "no_candidate" ? "no_candidate" : "adjudicated"] += 1;
  };
  for (const a of arrangements ?? []) {
    const tense = tenseOf(a);
    if (!TENSES.includes(tense)) throw new TypeError(`narrativeTime: tenseOf returned "${tense}" — declared tenses are ${TENSES.join(", ")}`);
    counts[tense] += 1;
    const at = a.at[0];
    if (tense === "Pqp") { record(resolveReachBack(at, grounds), a, at); continue; }
    if (!ADVANCES.has(tense)) continue;
    if (current === null || a.sentence !== lastSentence) {
      n += 1;
      const t = establishTime({ id: `t${n}`, at, key: a.sentence ?? at });
      const g = advanceReferenceGround({ id: `g${n}`, at, timeId: t.id, from: current });
      times.push(Object.freeze({ ...t, arrangement: a.id }));
      grounds.push(g);
      current = g;
      lastSentence = a.sentence;
    }
    record(resolveAnaphoricTense(at, grounds), a, at);
  }
  return Object.freeze({ times: Object.freeze(times), grounds: Object.freeze(grounds), resolutions: Object.freeze(resolutions), counts: Object.freeze(counts), giver });
}
