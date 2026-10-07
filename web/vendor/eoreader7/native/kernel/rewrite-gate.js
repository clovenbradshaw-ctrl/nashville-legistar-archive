// native/kernel/rewrite-gate.js — the measured stop for bounded-revise
// loops (THE-STIGMERGIC-PIPELINE §5, Phase A). DMD over the round
// trajectory decides when a rewrite loop has settled — the cap stays the
// floor, never the mechanism.
//
// WHY A GATE AND NOT A COUNTER. The round cap counts attempts; it cannot
// distinguish "still converging" from "settled with residual" from
// "cycling". The gate reads the trajectory's dominant mode (causal
// streaming DMD — nothing from the future, `dmd-stream.js` pins the
// Hemati equivalence by test): |λ| < 1 is a material that has settled,
// an oscillatory leading mode is a material that cycles between states.
// The round's own work is never interrupted by the gate; it decides
// BETWEEN rounds, over the rounds completed.
//
// THE HORIZON, HONESTLY. pairs ≥ 2 (three pushed rounds) is required for
// a decision, so under a budget of two rounds the gate is structurally
// silent and the cap governs — behavior unchanged. The gate becomes live
// when the budget exceeds the horizon. That is a finding, not a failure:
// a two-round loop cannot lie about its trajectory because it has none.

import { createStreamingDmd } from "./dmd-stream.js";

export function createRewriteGate({ dims = 2, rank = 2, dt = 1 } = {}) {
  if (!Number.isInteger(dims) || dims < 1) throw new TypeError("createRewriteGate: dims is declared");
  if (!Number.isInteger(rank) || rank < 1) throw new TypeError("createRewriteGate: rank is declared");
  const dmd = createStreamingDmd({ dims, dt });
  const history = []; // the pushed states, for the settling confirmation

  const push = (state) => {
    dmd.push(state);
    history.push([...state]);
    if (history.length > 8) history.shift();
  };

  /** Decide over the rounds pushed so far. Fires when the dominant mode
   *  has decayed (`decayed` — settled with residual, the residual stands
   *  and is disclosed by the satisfaction check) or cycles (`oscillating`
   *  — the material is a loop, not a convergence). Silent on
   *  insufficient pairs, a degenerate Gram, or a carrying mode. */
  const decide = () => {
    if (dmd.pairs < 2) return Object.freeze({ fire: false, reason: "insufficient_pairs", pairs: dmd.pairs });
    const m = dmd.modes({ rank });
    if (m.gap || !m.eigenvalues.length) return Object.freeze({ fire: false, reason: m.gap ?? "degenerate_gram", pairs: dmd.pairs });
    const lead = m.eigenvalues[0];
    // A cycle may sit on the negative real axis (λ = -1: period 2, im = 0
    // exactly) — the frequency is the cycle's signal, never the imaginary
    // part alone. period is derived from the frequency, and only claimed
    // within the observed horizon (period ≤ pushes): a period longer than
    // the observation is a claim about the future.
    const freq = Math.abs(lead.frequency);
    const oscillating = freq > 1e-9;
    if (oscillating) {
      const period = (2 * Math.PI) / freq;
      if (period >= 2 && period <= dmd.pushes) {
        return Object.freeze({ fire: true, reason: "oscillating", magnitude: lead.magnitude, period, growth: lead.growth, pairs: dmd.pairs });
      }
    }
    // THE SETTLING CONFIRMATION (2026-09-29, found by the loop falsifier):
    // the three-point window [3,1,3] least-squares a real 0.6 — a FALSE
    // "decayed" on a material that is actually cycling. Decay fires only
    // when the material is still settling: the LAST TWO transitions are
    // non-increasing. A cycle always carries an up-transition inside the
    // window — blocked. (The phase dimension caveat, named: a pure
    // findings-alternation with a flat second observable is INVISIBLE to
    // DMD — no scalar operator maps 3→1 and 1→3 — so the gate stays
    // silent and the cap governs; the gate never misreports a cycle it
    // has no phase dimension for. That silence is pinned by test.)
    if (lead.magnitude < 1) {
      const last = history.at(-1);
      const prev = history.at(-2);
      const before = history.at(-3);
      const settling = !last || !prev ? true : before ? prev[0] <= before[0] && last[0] <= prev[0] : last[0] <= prev[0];
      if (settling) return Object.freeze({ fire: true, reason: "decayed", magnitude: lead.magnitude, growth: lead.growth, pairs: dmd.pairs });
    }
    return Object.freeze({ fire: false, reason: "carrying", magnitude: lead.magnitude, pairs: dmd.pairs });
  };

  return Object.freeze({ push, decide, get pairs() { return dmd.pairs; } });
}