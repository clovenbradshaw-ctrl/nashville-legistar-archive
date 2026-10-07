// native/kernel/settling.js — SETTLING: DOES ANY SLOT OF A STREAM HOLD ONE
// VALUE LONG ENOUGH, IN SEQUENCE, TO BE WORTH BREAKING (2026-09-25).
// Medium-blind, kernel-level. Handle: James — after "habit is the enormous
// fly-wheel of society": a prior has to spin undisturbed before a strike can
// be felt. Nomination.
//
// the-fold/document-ledger.js::detectTrajectoryBoredom catches a stream that
// has stopped moving. This is its mirror on the SAME axis: a stream where
// nothing ever holds — every step surprising, no slot ever confirmed — is not
// depth but its counterfeit, and it passes the boredom test perfectly.
// bayes-surprise.js's own arithmetic says why it matters: the fall a
// contradiction produces is governed by the prior mass already on the value it
// crosses (klAdmit's b_v), so a slot that never held a value cannot be
// meaningfully surprised. You cannot be betrayed by a stranger.
//
//   THE STATISTIC   RUN MASS: over every slot, the longest run of one non-ABSENT
//                   value across consecutive steps, summed over the slots whose
//                   longest run reaches CANONICALIZATION_FLOOR (corroboration.js's
//                   own floor — not a new one). ABSENT is excluded: a slot absent
//                   for many steps has settled on nothing (emergentFacts' own
//                   exclusion of "varies").
//   THE NULL        the same steps with their ORDER destroyed (surprise-
//                   segments.js's own null): a shuffle keeps every fact's
//                   multiplicity and breaks its runs, so it asks exactly whether
//                   holding-in-sequence exceeds what these facts scattered at
//                   random would already hold. p = P(shuffled run mass >=
//                   observed), +1 for the observed draw.
//   THE VERDICT     three, each derived, none hand-set:
//                     never_settles        no slot reaches the floor at all — a
//                                          structural zero, no null needed
//                     settled_any_order    slots hold, and would in any order —
//                                          the facts recur regardless of
//                                          sequence (a constant stream; the
//                                          boredom detector's territory)
//                     settles_in_sequence  slots hold in stretches beyond
//                                          chance at the caller's declared
//                                          pValue — regimes that form and
//                                          break: the band the essay named
//                   A stream too short for the shuffle to reach the bar at all
//                   (n! orderings <= 1/pValue) is refused, typed — the floor is
//                   derived from pValue, never chosen.
//   THE BAND        the Bayesian trace is reported beside the verdict (mean
//                   bits early vs late, the steps admitted in order into a
//                   fresh holograph) so a caller can see the middle.
//
// Typing (reasoned, per capacities.js's hand-check discipline): whether any
// kind forms at all in a stream, tested against its own null, is
// Differentiate·Existence at Pattern grain — NUL·Kind, Unraveling — beside
// `kindnull` (a declared membership challenged against a random-subset null).

import { ABSENT, createHolograph, admit } from "./bayes-surprise.js";
import { CANONICALIZATION_FLOOR } from "./corroboration.js";

export const SETTLING_SCHEMA = "EOSettling@1";
export const CELL = Object.freeze({ op: "NUL", grain: "Pattern" });

const toMap = (facts) => (facts instanceof Map ? facts : new Map(Object.entries(facts ?? {})));

/** Per slot, the longest run of one non-ABSENT value over consecutive steps;
 *  `settled` are the slots whose run reaches the floor, `runMass` their runs summed. */
function runs(steps, slots, floor) {
  const best = new Map();
  const cur = new Map();
  for (const s of steps) {
    for (const slot of slots) {
      const v = s.has(slot) ? String(s.get(slot)) : ABSENT;
      const r = cur.get(slot);
      const len = v === ABSENT ? 0 : r && r.value === v ? r.length + 1 : 1;
      cur.set(slot, { value: v, length: len });
      if (len > (best.get(slot) ?? 0)) best.set(slot, len);
    }
  }
  const settled = [], lengths = {};
  let runMass = 0, maxRun = 0;
  for (const [slot, len] of best) {
    lengths[slot] = len;
    if (len > maxRun) maxRun = len;
    if (len >= floor) { settled.push(slot); runMass += len; }
  }
  return { settled: settled.sort(), runMass, maxRun, lengths };
}

function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

/**
 * settling(steps, { pValue, shuffles, rng, floor, alpha, gamma })
 *   → { schema, n, floor, verdict, settles, settled, runMass, maxRun, runLengths,
 *       p, pValue, early, late, trace, shuffles, basis }
 *   or a typed refusal { gap: "too_short" | "settled_order_untestable", ... }.
 *
 * `steps`: one fact set per step, in order — Maps or objects slot → value, the
 * shape bayes-surprise.js admits. `pValue` is declared by the caller (P9).
 */
export function settling(steps, { pValue, shuffles = 400, rng = Math.random, floor = CANONICALIZATION_FLOOR, alpha = 1, gamma = 1 } = {}) {
  if (!(pValue > 0 && pValue < 1)) throw new TypeError("settling: pValue is declared by the caller, in (0, 1) — never defaulted (P9)");
  if (!(shuffles >= 1)) throw new TypeError("settling: shuffles is a positive count");
  const S = (steps ?? []).map(toMap);
  const n = S.length;
  if (n < floor) return { gap: "too_short", schema: SETTLING_SCHEMA, n, floor, basis: `${n} step(s) cannot hold a value for ${floor}: nothing is decided` };
  const slots = new Set();
  for (const s of S) for (const k of s.keys()) slots.add(k);
  const observed = runs(S, slots, floor);

  // THE BAND: the Bayesian trace, steps admitted in order into a fresh holograph.
  const holo = createHolograph({ alpha, gamma });
  const trace = S.map((s) => admit(holo, s).bayes);
  const half = Math.floor(n / 2);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const early = mean(trace.slice(0, half)), late = mean(trace.slice(half));
  const band = `mean Bayesian surprise ${early.toFixed(2)} bits (first ${half}) → ${late.toFixed(2)} (last ${n - half})`;
  const common = { schema: SETTLING_SCHEMA, n, floor, settled: observed.settled, runMass: observed.runMass, maxRun: observed.maxRun, runLengths: observed.lengths, pValue, early: Number(early.toFixed(3)), late: Number(late.toFixed(3)), trace: trace.map((b) => Number(b.toFixed(3))) };

  if (!observed.settled.length) {
    return { ...common, verdict: "never_settles", settles: false, p: null, shuffles: 0, basis: `no slot held one value for ${floor} consecutive step(s) across ${n} (longest run ${observed.maxRun}) — nothing settles, structurally; ${band}` };
  }
  if (factorial(n) <= 1 / pValue) {
    return { gap: "settled_order_untestable", ...common, settles: true, p: null, shuffles: 0, basis: `${observed.settled.length} slot(s) hold (run mass ${observed.runMass}), but ${n} step(s) admit only ${factorial(n)} ordering(s) — the shuffle cannot reach p < ${pValue}, so whether they hold BY SEQUENCE is undecided; ${band}` };
  }
  let atLeast = 0;
  for (let t = 0; t < shuffles; t++) {
    const perm = S.slice();
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    if (runs(perm, slots, floor).runMass >= observed.runMass) atLeast++;
  }
  const p = (atLeast + 1) / (shuffles + 1);
  const inSequence = p < pValue;
  return {
    ...common,
    verdict: inSequence ? "settles_in_sequence" : "settled_any_order",
    settles: true,
    p: Number(p.toFixed(4)),
    shuffles,
    basis: inSequence
      ? `${observed.settled.length} slot(s) hold one value for >= ${floor} consecutive step(s), run mass ${observed.runMass} (longest ${observed.maxRun}) — order-shuffling the same ${n} steps reaches that ${(p * 100).toFixed(0)}% of the time (p=${p.toFixed(3)}): regimes form and break in sequence, not by chance; ${band}`
      : `${observed.settled.length} slot(s) hold one value for >= ${floor} consecutive step(s), run mass ${observed.runMass} (longest ${observed.maxRun}) — order-shuffling the same ${n} steps reaches that ${(p * 100).toFixed(0)}% of the time (p=${p.toFixed(3)}): they hold in any order; the facts recur regardless of sequence; ${band}`,
  };
}
