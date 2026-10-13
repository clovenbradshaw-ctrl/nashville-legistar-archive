// fold-chat-dmd.js — THE MEASURED STOP FOR THE FOLD TURN (THE-STIGMERGIC-PIPELINE
// §5). The turn's fuel is a FLOOR; the stop is the measured decay of the turn's
// own trajectory. This wraps khora's `createRewriteGate` (streaming, causal DMD —
// nothing from the future) with the observables a fold pass actually produces.
//
// The two observables, per pass:
//   residual       — how far the page still is from holding (held → 0; else the
//                    finding's length, the correction it still owes). The
//                    "is it settling?" dimension the leading mode reads.
//   residual_lag   — the residual of the PASS BEFORE (a delay embedding, Takens).
//                    A cycle needs a phase dimension or it is invisible to DMD —
//                    a constant second coordinate fits a real positive decay to a
//                    period-2 alternation (the doc's own caveat, `rewrite-gate.js`
//                    §"the phase dimension caveat"). The lag gives the phase.
//
// |λ| > 1 carrying (still converging — let it run, floor permitting);
// |λ| < 1 settled (fire: the residual stands, release it as a NUL);
// arg λ ≠ 0 cycling (fire: the turn is a loop, not a convergence).
//
// PURE w.r.t. the injected gate (the arithmetic is the vendored kernel's). The
// falsifying control lives in fold-chat-dmd.test.mjs: a decaying trajectory must
// fire early and stop the run before the floor; a carrying one must run to the
// floor; a period-2 alternation must fire `oscillating`; [3,1,3] must NOT fire decay.

import { createRewriteGate } from "./vendor/khora/native/kernel/rewrite-gate.js";

export const DMD_DIMS = 2;
export const DMD_RANK = 2;

/** createTurnGate() — observe the passes, decide between them. */
export function createTurnGate({ dims = DMD_DIMS, rank = DMD_RANK } = {}) {
  const gate = createRewriteGate({ dims, rank });
  let prevResidual = null;
  return {
    /** observe({ held, finding, residual }) -> the state pushed ({ residual, residualLag }).
     *  `residual` (a MEASURED number: the page's failing claims + observation errors,
     *  not a text length) is preferred when given; `finding.length` is only the
     *  fallback for callers that have no measured signal. The FIRST observation only
     *  seeds the lag (a delay coordinate is a history; a first pass has none). */
    observe({ held = false, finding = null, residual = null } = {}) {
      const text = finding == null ? "" : String(finding);
      const r = residual != null ? residual : (held ? 0 : (text ? text.length : 1));
      if (prevResidual === null) { prevResidual = r; return { residual: r, residualLag: null }; }
      const residualLag = prevResidual;
      gate.push([r, residualLag]);
      prevResidual = r;
      return { residual: r, residualLag };
    },
    /** decide() -> { fire, reason, magnitude?, period?, pairs }.
     *  A magnitude within float-epsilon of 1 is NOT decay — a flat trajectory sits
     *  on the |λ| = 1 boundary and must not be read as settled (guarded here so the
     *  frozen kernel's exact `< 1` cannot fire it on rounding noise). */
    decide() {
      const d = gate.decide();
      if (d.fire && d.reason === "decayed" && Number.isFinite(d.magnitude) && d.magnitude >= 1 - 1e-9) {
        return Object.freeze({ ...d, fire: false, reason: "carrying", note: "borderline |λ|≈1 is not decay" });
      }
      return d;
    },
    get pairs() { return gate.pairs; },
  };
}

/** One plain line disclosing a fired stop. Pure. */
export function stopLine(d) {
  if (!d || !d.fire) return "";
  const mag = Number.isFinite(d.magnitude) ? `|λ|=${d.magnitude.toFixed(3)}` : "";
  if (d.reason === "oscillating") return `dmd stop · oscillating (period ${d.period?.toFixed(1)} rounds) — the turn is a loop, not a convergence; releasing its residual as a NUL.`;
  return `dmd stop · decayed (${mag}) — the turn's dominant mode has settled with residual; the floor did not stop it, the measured decay did.`;
}

export default { DMD_DIMS, DMD_RANK, createTurnGate, stopLine };
