// code-draw-standing.js — the code-draw failure-shape cells on the-fold's
// metacognition.js standing ledger. THE THIRD CONSUMER of `standingOf`
// (reading, routing, now code draws — model-routing-design-PROPOSAL.md
// §"Piece 4," the user's own scoped-down first step: "the system should
// start learning what it knows and doesn't know").
//
// Pure: this file never imports metacognition.js directly (eoreader7 owns
// kernel, the-fold owns the surface — see the-fold/CLAUDE.md's own "The
// boundary" section: "the surface imports organs through ONE seam... no
// organ imports the surface"). A caller builds `mc = makeMetacognition
// (taskLog)` on the-fold's own side and injects it here — the cast.js
// pattern this whole codebase holds to.
//
// WHAT THIS DOES: declares a CLOSED signature vocabulary over three
// in-flight features a code draw legitimately has access to DURING the
// draw — never held-out truth:
//   roundsExhausted — the repair loop spent its whole round budget
//     (CODING-LESSONS.md lesson 56: "49 of 108 runs used all four rounds
//     and still failed" — round-exhaustion is an unread retrieval-monitor
//     signal, not a new statistic).
//   hasRegressions — RepairLedger (lang-levers.js) recorded at least one
//     round whose candidate scored WORSE than the one already held; a
//     repair loop actively getting worse is a shape, not noise.
//   bokDisagreed / bokAbsent — the bok arm's own K candidates landed
//     different visible-case scores (candidate disagreement), or the bok
//     arm never ran at all. LAVAR.md:148's own disclosed limit: "self-
//     consistency is not correctness... only catches a witness that flips
//     under reorder" — so disagreement is read as evidence of instability,
//     and its ABSENCE (never checked) is folded into its own separate cell
//     rather than silently treated as "no disagreement found."
//
// Cells are OBSERVED against the ledger's own historical `heldOut` column
// (native/organs/lang-competency.js) in a SEPARATE offline calibration step
// (native/eval/the-fold/code-draw-standing-calibrate.mjs) — split train/
// validate, never single-split "calibrated on all data" (create-learn-
// RESULTS.md's own rule: two observations is not calibration). At
// INFERENCE time this file reads only signature() — never heldOut, never
// anything the draw does not already legitimately have.
//
// WHAT THIS DOES NOT DO (model-routing-design-PROPOSAL.md's own "What NOT
// to build," carried here verbatim): no confidence score asked of the
// model directly; no "is this hard" classifier trained on vibes — every
// trigger here is a closed, mechanical, already-computed run-shape fact;
// no swap-the-draft — the concede move below only ever APPENDS a mechanical
// disclosure or reports a route-down signal, exactly GATE-STALE-FACTS-
// DESIGN.md:128's "the model is just the mouth" applied a second time.

/** The closed feature set. Undeclared/unknown features fold to false
 * rather than widen the signature class — a feature this file has not
 * been told about is not evidence of anything. */
export const CODE_DRAW_FEATURES = Object.freeze(["roundsExhausted", "hasRegressions", "bokDisagreed", "bokUnknown"]);

/** signatureFor(features) -> "code-draw:rounds-exhausted+regressions", or
 * "code-draw:clean" when every feature reads false. A pure, closed-class
 * string — never a learned embedding (P79's own "kind-standing" posture,
 * one register over). */
export function signatureFor({ roundsExhausted = false, hasRegressions = false, bokDisagreed = false, bokUnknown = false } = {}) {
  const bits = [
    roundsExhausted ? "rounds-exhausted" : null,
    hasRegressions ? "regressions" : null,
    bokDisagreed ? "bok-disagreed" : (bokUnknown ? "bok-absent" : null),
  ].filter(Boolean);
  return bits.length ? `code-draw:${bits.join("+")}` : "code-draw:clean";
}

/** featuresFromRow(row, {maxRounds}) — the SAME features a legitimately
 * in-flight draw has: rounds spent so far, regressions counted so far, and
 * the bok arm's own candidate disagreement when that arm ran (bokUnknown
 * when it did not, or when an older ledger row predates the field —
 * disclosed absence, never smoothed into "no disagreement"). */
export function featuresFromRow(row, { maxRounds = 3 } = {}) {
  const roundsExhausted = Number(row?.rounds ?? 0) >= maxRounds;
  const hasRegressions = Number(row?.regressions ?? 0) > 0;
  const ranBok = row?.arm === "bok";
  const bokKnown = ranBok && row?.bokDisagreement != null;
  const bokDisagreed = bokKnown && row.bokDisagreement === true;
  const bokUnknown = !bokKnown;
  return { roundsExhausted, hasRegressions, bokDisagreed, bokUnknown };
}

/** cellFor(row, opts) -> the ledger cell string for one historical row. */
export function cellFor(row, opts) {
  return signatureFor(featuresFromRow(row, opts));
}

/** observeRows(mc, log, rows, opts) -> log. Folds a TRAIN split's rows onto
 * mc's ledger, one observe() per row: heldOut=true is CONFIRMED, heldOut=
 * false is CORRECTED — the same vocabulary assessAgreement already gives
 * this ledger for an S1/S2 turn, reused rather than re-derived: a code
 * draw's own held-out pass is exactly "was the draw right this time." */
export function observeRows(mc, log, rows, opts) {
  for (const row of rows) {
    const cell = cellFor(row, opts);
    const heldOut = !!row?.heldOut;
    log = mc.observe(log, { cell, delta: { confirmed: heldOut ? 1 : 0, corrected: heldOut ? 0 : 1, unresolved: 0, extended: 0 } });
  }
  return log;
}

/** monitorFires(mc, log, features) -> { cell, standing, fires }. `fires` is
 * true iff the TRAINED standing for this signature reads "contested" —
 * mc.standingOf's own vocabulary: at least one observed failure, past
 * WITNESS_FLOOR trials. "unproven"/"established" both read false — the
 * same "not-yet-measured is not the same as safe" rule metacognition.js's
 * own surfWeight already holds (an unproven cell buys no escalation), read
 * here for a monitor's own trigger instead of a retrieval budget. */
export function monitorFires(mc, log, features) {
  const cell = signatureFor(features);
  const standing = mc.standingOf(log, cell);
  return { cell, standing, fires: standing.standing === "contested" };
}

/** validate(mc, trainedLog, validationRows, opts) -> { n, firesOn,
 * precision, recall, tp, fp, fn, tn }. Reads heldOut truth ONLY here,
 * offline — scores the TRAINED standings (fit on the train split alone)
 * against rows they were never observed onto. This is the monitor's own
 * measured operating point — never invented numbers — and it is meant to
 * be attached to every live emission (see makeCodeDrawMonitor below). */
export function validate(mc, trainedLog, validationRows, opts) {
  let tp = 0, fp = 0, fn = 0, tn = 0, fires = 0;
  for (const row of validationRows) {
    const features = featuresFromRow(row, opts);
    const { fires: fired } = monitorFires(mc, trainedLog, features);
    const actuallyFailed = !row?.heldOut;
    if (fired) fires++;
    if (fired && actuallyFailed) tp++;
    else if (fired && !actuallyFailed) fp++;
    else if (!fired && actuallyFailed) fn++;
    else tn++;
  }
  const n = validationRows.length;
  return {
    n, firesOn: fires,
    precision: fires ? tp / fires : null,
    recall: (tp + fn) ? tp / (tp + fn) : null,
    tp, fp, fn, tn,
  };
}

/** disclosureFor(cell, standing) -> a mechanical, dated, never-model-
 * phrased concede move — GATE-STALE-FACTS-DESIGN.md:128's own pattern
 * ("the model is just the mouth"), applied to a code draw's own standing
 * instead of a stale fact. Returns null when the standing does not fire
 * (nothing to disclose is not a disclosure). */
export function disclosureFor(cell, standing) {
  if (!standing || standing.standing !== "contested") return null;
  return `[metacognition] this draw's shape (${cell}) has needed correction ${standing.corrected} of ${standing.total} time(s) measured — escalate or verify before trusting it. (${new Date().toISOString().slice(0, 10)})`;
}

/** makeCodeDrawMonitor(mc, trainedLog, operatingPoint, opts) -> {check}.
 * `operatingPoint` is the SEPARATE offline validate() result — carried on
 * every emission (WITNESS_OPERATING_POINT's own posture: a stated false-
 * positive/false-negative rate from the monitor's own validation split,
 * never a vibe). `check(features)` reads only in-flight features — never
 * heldOut truth — and returns a route-down signal plus (when it fires) a
 * mechanical disclosure string, never a rewritten draft (P186: the mouth
 * is not censored — this monitor only ever appends or signals, it never
 * edits what a draw said). */
export function makeCodeDrawMonitor(mc, trainedLog, operatingPoint, opts) {
  return {
    operatingPoint,
    check(features) {
      const { cell, standing, fires } = monitorFires(mc, trainedLog, features);
      return {
        cell,
        standing,
        fires,
        routeDown: fires,
        disclosure: fires ? disclosureFor(cell, standing) : null,
        operatingPoint,
      };
    },
  };
}
