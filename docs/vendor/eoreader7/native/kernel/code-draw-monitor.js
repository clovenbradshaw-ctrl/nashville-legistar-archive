// code-draw-monitor.js — the ONE live singleton that wires code-draw-
// standing.js's makeCodeDrawMonitor into a real call site (proxy.mjs's
// POST /v1/code handler). This is the follow-on to code-draw-standing.js's
// own header note: "makeCodeDrawMonitor/disclosureFor are built, tested,
// and ready for that wiring whenever it's taken up."
//
// Built ONCE per process, memoized (getCodeDrawMonitor below) — never
// rebuilt per request. That is not just an efficiency rule: the task this
// file answers to is explicit that recalibration is a SEPARATE, offline,
// periodic step (native/eval/the-fold/code-draw-standing-calibrate.mjs),
// not part of the live loop.
//
// Two different things happen once at boot, and they are not the same
// operation:
//   1. The TRAINED LEDGER (which cells exist, what their standing is) is
//      rebuilt deterministically from the same frozen historical ledger
//      rows and the same fixed train/validate split calibrate.mjs uses
//      (row-index parity — never a random draw). Nothing here reads
//      today's ledger growth, tunes a threshold, or fits anything; folding
//      the same declared rows through observeRows() twice always produces
//      the identical ledger. This is reconstruction, not recalibration.
//   2. The OPERATING POINT (precision/recall/tp/fp/fn/tn) is NOT
//      recomputed here at all — recomputing it live would mean reading
//      heldOut truth outside the offline step, which code-draw-standing.js
//      itself refuses to do. It is copied verbatim from the calibrate.mjs
//      run recorded in results/code-draw-standing-RESULTS.md. Update
//      RECORDED_OPERATING_POINT by hand, by re-running that script and
//      pasting its own printed numbers here — never by computation in this
//      file.
//
// Cross-repo import precedent: same relative reach into the sibling
// the-fold repo's metacognition.js that code-draw-standing.test.mjs and
// native/eval/the-fold/code-draw-standing-calibrate.mjs already use.

import { readRows } from "../organs/lang-competency.js";
import { makeMetacognition } from "../the-fold/metacognition.js";
import * as taskLog from "./task-log.js";
import { observeRows, makeCodeDrawMonitor } from "./code-draw-standing.js";

const DEFAULT_LEDGER_PATH = new URL("../../state/lang-competency.jsonl", import.meta.url).pathname;
const MAX_ROUNDS = 3; // matches code-loop.js's DEFAULT_MAX_ROUNDS and the calibration run's own --maxRounds default

// Recorded by `node native/eval/the-fold/code-draw-standing-calibrate.mjs`
// on 2026-09-22 against state/lang-competency.jsonl (1163 checked rows,
// `-v5` config, split 582/581 train/validate by row-index parity) — see
// native/eval/the-fold/results/code-draw-standing-RESULTS.md, whose own
// honest finding is that both trained cells read `contested` on this
// ledger as it stood, so this operating point currently amounts to "fires
// on essentially every draw" (precision ≈ the split's own base failure
// rate). That is a true, disclosed measurement, not a bug in this wiring.
// Re-run the calibration script and paste ITS OWN printed numbers here —
// never edited by hand, never recomputed live.
export const RECORDED_OPERATING_POINT = Object.freeze({
  n: 581,
  firesOn: 581,
  precision: 0.532,
  recall: 1.0,
  tp: 309,
  fp: 272,
  fn: 0,
  tn: 0,
  recordedAt: "2026-09-22",
  source: "native/eval/the-fold/results/code-draw-standing-RESULTS.md",
});

/** buildTrainedLedger(ledgerPath) -> { mc, log }. Pure(ish — reads a file):
 * given a ledger path, reproduces EXACTLY the train-split fold calibrate.mjs
 * itself performs. Exported for the calibration script and tests to reuse
 * without drifting from this file's own copy. */
export function buildTrainedLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  const allRows = readRows(ledgerPath).filter((r) => String(r.config ?? "").endsWith("-v5") && !r.unchecked);
  const train = allRows.filter((_, i) => i % 2 === 0); // declared, fixed — never re-rolled (same rule as calibrate.mjs)
  const mc = makeMetacognition(taskLog);
  let log = mc.createLedger();
  log = observeRows(mc, log, train, { maxRounds: MAX_ROUNDS });
  return { mc, log, trainRows: train.length, totalRows: allRows.length };
}

let cached = null; // the one live instance; see getCodeDrawMonitor()

/** getCodeDrawMonitor({ ledgerPath, operatingPoint }) -> {check}. Called
 * with no arguments from proxy.mjs's /v1/code handler: builds the monitor
 * on first call, memoizes it in `cached`, and returns the SAME object on
 * every later call for the lifetime of the process — proxy.mjs never
 * constructs a new one per request. Passing a non-default `ledgerPath`
 * (test fixtures only) always builds a fresh, unmemoized instance so a
 * test can exercise buildTrainedLedger() against a synthetic ledger
 * without disturbing the real process-wide singleton. */
export function getCodeDrawMonitor({ ledgerPath = DEFAULT_LEDGER_PATH, operatingPoint = RECORDED_OPERATING_POINT } = {}) {
  if (cached && ledgerPath === DEFAULT_LEDGER_PATH && operatingPoint === RECORDED_OPERATING_POINT) return cached;
  const { mc, log } = buildTrainedLedger(ledgerPath);
  const monitor = makeCodeDrawMonitor(mc, log, operatingPoint, { maxRounds: MAX_ROUNDS });
  if (ledgerPath === DEFAULT_LEDGER_PATH && operatingPoint === RECORDED_OPERATING_POINT) cached = monitor;
  return monitor;
}

/** shipCodeDrawResult(result, check) -> result unchanged, or
 * { ...result, disclosure } when check.disclosure is a string. Pure — the
 * exact "append, never rewrite" seam proxy.mjs's /v1/code handler calls
 * right after getCodeDrawMonitor().check(...). Kept here rather than
 * inlined in proxy.mjs so the append-vs-passthrough behavior is directly
 * testable without a live HTTP request (see code-draw-monitor.test.mjs). */
export function shipCodeDrawResult(result, check) {
  return check?.disclosure ? { ...result, disclosure: check.disclosure } : result;
}

/** resetCodeDrawMonitorForTest() — test-only escape hatch so a test can
 * prove the memoization itself (build once via the default path, reset,
 * build again, compare instances) without leaking state into unrelated
 * test files (each test file already gets its own module instance; this
 * is for within-file before/after isolation). Never called from proxy.mjs. */
export function resetCodeDrawMonitorForTest() {
  cached = null;
}
