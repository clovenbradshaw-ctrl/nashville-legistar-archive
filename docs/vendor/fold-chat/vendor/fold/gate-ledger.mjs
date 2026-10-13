// gate-ledger.mjs — the gate's HISTORY, and the first live consumer of
// reasoning-stages.gateVerdict. The essay's stage 12 is a judgment over time,
// not over one run: "a gate is verified against what it should reject; report
// pass from a gate nothing has ever failed" is REFUSED. One run cannot prove a
// gate can reject — a history can.
//
// The ladder applies it to itself. The probe-set IS a gate: it rejects when it
// catches a void, passes when it finds none. So an "all closed" from a probe
// set that has NEVER caught anything is UNMEASURED — a clean bill from a check
// nothing has ever failed. Only after the probe set has caught at least one
// void does its all-clear read `pass` instead of `unmeasured`. This is the
// ladder refusing to render shown as measured.
//
// PURE (the clock is injected); the verdict is reasoning-stages.gateVerdict
// over the CUMULATIVE rejected count, so a gate earns `pass` only by having
// rejected something, ever (stage 12's exact condition).
//
// Falsifying control (test/gate-ledger.test.mjs): a gate with no rejected on
// record can never get `pass`; one caught void across ten runs flips the next
// all-clear to `pass`; a failed run always reads `fail`.

import { gateVerdict } from "./reasoning-stages.mjs";

export const GATE_LEDGER_SCHEMA = "GateLedger@1";

export function createGateLedger({ records = [] } = {}) {
  return { schema: GATE_LEDGER_SCHEMA, records: [...(records ?? [])] };
}

export function recordGate(ledger, { gate, rows = 0, rejected = 0, failed = 0, at = Date.now() } = {}) {
  const r = { gate, at, rows, rejected, failed };
  ledger.records.push(r);
  return r;
}

/** The gate's totals across every recorded run. */
export function cumulative(ledger, { gate }) {
  const rs = (ledger?.records ?? []).filter((r) => r.gate === gate);
  return rs.reduce(
    (a, r) => ({ rows: a.rows + r.rows, rejected: a.rejected + r.rejected, failed: a.failed + r.failed, runs: a.runs + 1 }),
    { rows: 0, rejected: 0, failed: 0, runs: 0 },
  );
}

/** Record the run, then judge on the CUMULATIVE history: { verdict, reason, cumulative }. */
export function judgeGate(ledger, { gate, rows = 0, rejected = 0, failed = 0, at = Date.now() } = {}) {
  if (!ledger) throw new TypeError("judgeGate requires a ledger");
  recordGate(ledger, { gate, rows, rejected, failed, at });
  const cum = cumulative(ledger, { gate });
  const verdict = gateVerdict({ rows: cum.rows, rejected: cum.rejected, failed: cum.failed });
  const reason = verdict === "fail"
    ? `the gate ${gate} has failed ${cum.failed} run(s) of ${cum.runs}`
    : verdict === "unmeasured"
      ? `the gate ${gate} has never rejected anything across ${cum.runs} run(s) — shown, not measured`
      : `the gate ${gate} has rejected before (${cum.rejected} across ${cum.runs} run(s))`;
  return { verdict, reason, cumulative: cum };
}

export function gateLedgerToJSON(ledger) { return JSON.stringify(ledger.records ?? []); }
export function gateLedgerFromJSON(text) {
  let records = [];
  try { records = JSON.parse(String(text ?? "[]")); } catch { records = []; }
  return createGateLedger({ records: Array.isArray(records) ? records : [] });
}

export default { GATE_LEDGER_SCHEMA, createGateLedger, recordGate, cumulative, judgeGate, gateLedgerToJSON, gateLedgerFromJSON };