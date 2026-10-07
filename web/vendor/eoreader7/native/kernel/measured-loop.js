// native/kernel/measured-loop.js — bound a repair loop by whether it is
// MEASURABLY doing anything, not by a hand-picked repeat count.
//
// THE ASK THIS ANSWERS, near-verbatim: "we bound the loops on loops by a
// test of DMD to determine if we're actually doing anything." Every self-
// heal loop in this tree (a dispute settled and a claim conceded, a
// revision-spiral cut, a void filled) is a round that either moves the
// state it is repairing or does not, and this project's own standing law
// (never a threshold picked by hand — P4, P71's generality gate, the
// falsification-probe tradition) says a stopping rule for that loop should
// be MEASURED the same way every other stopping rule here is, not typed as
// a constant.
//
// THE MEASURE, reused whole: `kernel/dmd-stream.js`'s own streaming Dynamic
// Mode Decomposition — the causal, one-snapshot-at-a-time formulation this
// kernel already carries for reading a stream's own modes. A caller reports
// ONE NUMBER per round: how much is still unresolved (open disputes, live
// findings, whatever the caller's domain counts). Pushed as a 1-dimensional
// state, the streaming DMD's own eigenvalue IS the measured growth rate of
// that count round over round — nothing invented here, the same `modes()`
// dmd-stream.js already proves equals batch DMD over the prefix.
//
//   growth < 0   the issue count is measurably decaying  -> keep going
//   growth ~ 0   nothing is moving                        -> STOP: converged
//   growth > 0   issues are increasing                    -> STOP: diverging
//                (a repair that measurably makes things worse gets no more
//                budget, whatever budget remains)
//
// `insufficient_pairs`/`degenerate_gram` (dmd-stream.js's own typed gaps,
// fewer than two rounds or a state that never moved at all) read as
// "continue" here — the measured test needs at least two rounds of history
// before it can measure anything, so the loop is never stopped on a
// measurement that was never taken.
//
// A HARD CEILING still bounds every loop this module makes (P9: a budget is
// always declared, never implicit) — but it is the SAFETY FLOOR under the
// measured test, not the operative stop. A well-behaved loop should almost
// always stop on "converged" or "diverging" well before it, and a loop that
// only ever stops on the ceiling is itself worth a look.

import { createStreamingDmd } from "./dmd-stream.js";

/** A growth this close to zero reads as "not moving" — this is a numerical
 * tolerance for floating-point noise around an exact fixed point, never a
 * substantive threshold picked to make some case pass. 1e-9 is the standard
 * epsilon-scale convention for "zero up to double-precision noise" (well
 * above machine epsilon ~2.2e-16, well below anything a real growth rate
 * would produce) — by construction, not measured against any case. */
export const STILLNESS_TOLERANCE = 1e-9;

export const VERDICTS = Object.freeze({
  CONVERGED: "converged",       // stop: the measured mode is flat — nothing is moving
  DIVERGING: "diverging",       // stop: the measured mode is growing — repair is making it worse
  RESOLVED: "resolved",         // stop: the issue count itself reached zero
  CEILING: "ceiling",           // stop: the declared safety floor was reached first
  INSUFFICIENT_HISTORY: "insufficient_history", // continue: fewer than two rounds pushed yet
  DECAYING: "decaying",         // continue: the measured mode is genuinely shrinking
});

/**
 * makeMeasuredLoop({ ceiling, relTol }) — one loop's own convergence
 * instrument. `ceiling` (required, P9) is the hard safety floor: the number
 * of rounds after which the loop stops regardless of what the measure says.
 * `relTol` is dmd-stream.js's own rank-truncation tolerance, passed through
 * unchanged (never re-derived here).
 */
export function makeMeasuredLoop({ ceiling, relTol = 1e-10 } = {}) {
  if (!Number.isFinite(ceiling) || ceiling < 1)
    throw new TypeError("makeMeasuredLoop: ceiling is the declared safety floor under the measured test (P9) — every loop is bounded, never implicitly");
  const dmd = createStreamingDmd({ dims: 1, dt: 1 });
  const rounds = [];

  /** Report this round's own count of what is still unresolved. */
  function push(issueCount) {
    if (!Number.isFinite(issueCount) || issueCount < 0)
      throw new TypeError("makeMeasuredLoop.push: the caller's own non-negative count of what remains unresolved");
    dmd.push([issueCount]);
    rounds.push(issueCount);
  }

  /**
   * Should the loop take another round? Returns `{ continue, verdict,
   * rounds, growth? }` — `verdict` is always one of VERDICTS, so a caller
   * never has to re-derive what stopped it.
   */
  function verdict() {
    const n = rounds.length;
    if (n && rounds[n - 1] === 0) return Object.freeze({ continue: false, verdict: VERDICTS.RESOLVED, rounds: n });
    if (n >= ceiling) return Object.freeze({ continue: false, verdict: VERDICTS.CEILING, rounds: n });
    const m = dmd.modes({ rank: 1, relTol });
    if (m.gap) return Object.freeze({ continue: true, verdict: VERDICTS.INSUFFICIENT_HISTORY, rounds: n, gap: m.gap });
    const top = m.eigenvalues[0];
    if (top.growth > STILLNESS_TOLERANCE) return Object.freeze({ continue: false, verdict: VERDICTS.DIVERGING, rounds: n, growth: top.growth });
    if (Math.abs(top.growth) <= STILLNESS_TOLERANCE) return Object.freeze({ continue: false, verdict: VERDICTS.CONVERGED, rounds: n, growth: top.growth });
    return Object.freeze({ continue: true, verdict: VERDICTS.DECAYING, rounds: n, growth: top.growth });
  }

  return Object.freeze({ push, verdict, get rounds() { return Object.freeze([...rounds]); } });
}

/**
 * runMeasuredLoop({ ceiling, relTol, round, issuesAfter }) — the loop
 * itself, for a caller that wants the whole thing rather than the raw
 * instrument. `round(state)` performs one repair attempt and returns the
 * next state; `issuesAfter(state)` reads that state's own unresolved count.
 * Returns `{ state, history: [...verdicts], stop }`.
 */
export async function runMeasuredLoop({ ceiling, relTol, round, issuesAfter, initialState }) {
  if (typeof round !== "function" || typeof issuesAfter !== "function")
    throw new TypeError("runMeasuredLoop: round(state) and issuesAfter(state) are both required — this module measures a caller's own repair, it does not invent one");
  const loop = makeMeasuredLoop({ ceiling, relTol });
  let state = initialState;
  const history = [];
  loop.push(issuesAfter(state));
  let v = loop.verdict();
  history.push(v);
  while (v.continue) {
    state = await round(state);
    loop.push(issuesAfter(state));
    v = loop.verdict();
    history.push(v);
  }
  return Object.freeze({ state, history: Object.freeze(history), stop: v });
}
