// native/kernel/ground-closure.js — the witness's one observable job:
// notice when the ground starts to close. Pure; numbers arrive as
// arguments (the cast.js pattern), nothing is imported.
//
// THE WHEEL (native/docs/THE-WHEEL.md): this is the HUB's own watch — the
// Void, the nothing against which; the witness measures its openness, never
// its fullness, and re-ground is the hub's re-hollowing.
//
// THE REFRAME THAT NAMES THIS ORGAN (2026-09-13). The holograph is
// ATTENTION — an act, not a record: the fold at a cursor IS the present,
// and every part points at the whole. The hyperlexicon is AWARENESS — a
// field, not a store: its health criterion is OPENNESS, never completeness
// ("the ground must not close; sclerosis is death"). The witness is neither
// of them. It is the organ that notices when attention has drifted and the
// field has started to close, and its one observable job is answering with
// re-grounding (REC), never accumulation.
//
// WHAT "CLOSING" MEANS, OPERATIONALLY. A ground closes when its DEPOSITS
// exceed its PASSAGE.
//
//   deposits — the reading folding into itself. A being folded into itself
//   (selfReferentFolds — the Marmeladov shape: both ends of an irreflexive
//   relation resolving to one referent, the reading reading its own prior
//   back) plus ambiguity held unresolved (untyped contests — the field
//   closing around what it never settled).
//
//   passage — what re-forms the field. The dynamics actually moving
//   (movesHolograph — expectations the reading opened actually resolving)
//   plus honest gaps (typedAbsences — the reading acknowledging what it did
//   not know, which IS the openness: a gap that is a result, never silence).
//
//   openness = passage / (passage + deposits). 1 is pure re-formation
//   (every deposit is a gap the field acknowledged); 0 is pure deposit
//   (the field reads only itself).
//
// THE BAR IS DERIVED, NEVER SET. The null-arm runs the SAME reader on
// structureless material (word-shuffled, clause structure destroyed) and
// reports its own deposits and passage. That is the false-positive floor
// for closure: a reader with nothing real to re-form will still fold a
// being into itself and still acknowledge gaps, at the null's rate. A real
// reading whose openness is BELOW the null's is folding into itself more
// than a reader reading noise does — the ground has closed. A reading AT
// or ABOVE the null's openness is doing no worse than honest noise, and
// with re-formation present it is open. The null's numbers come from the
// caller (null-arm.mjs); nothing here invents a threshold.
//
// THE ANSWER. The witness's whole job, and the only thing it does:
//   open     -> release   (the field's products accrete into the
//                          hyperlexicon — they are knowledge, re-formed by
//                          passage, not deposits)
//   closing  -> re-ground (REC — shed the deposits, descend one level,
//                          start a fresh ground; never accumulate onto a
//                          closing field)
//   closed   -> re-ground (the stronger form: passage is 0, the field
//                          reads only itself)
//   no_ground-> withhold  (no field activity measured — a verdict here
//                          would be the dark-room refusal, manufacturing a
//                          conviction from silence)
//
// A VERDICT IS NEVER FINER THAN ITS EVIDENCE (the repo's own standing rule,
// asserted.js's assertionPhrase and metacognition.js's standingOf both hold
// the same line): openness is reported as a share, never a score, and the
// "closing"/"closed" split is structural (is there ANY re-formation), never
// a tuned margin.

/** closureOf({shape, nullShape}) — one reading's openness, against the
 * null-derived bar. `shape` carries the holograph-health fields a reading
 * itself records (selfReferentFolds, movesHolograph, contests,
 * typedAbsences); `nullShape` carries the same fields measured by the
 * null-arm on structureless material. Numbers are summed from the fields
 * named; nothing is guessed. */
export function closureOf({ shape = {}, nullShape = {} } = {}) {
  const deposits = (shape.selfReferentFolds ?? 0) + (shape.contests ?? 0);
  const passage = (shape.movesHolograph ?? 0) + (shape.typedAbsences ?? 0);
  const nullDeposits = (nullShape.selfReferentFolds ?? 0) + (nullShape.contests ?? 0);
  const nullPassage = (nullShape.movesHolograph ?? 0) + (nullShape.typedAbsences ?? 0);

  const total = passage + deposits;
  if (total === 0) {
    return Object.freeze({
      schema: "EOGroundClosure@1",
      deposits, passage, openness: null,
      nullDeposits, nullPassage, nullOpenness: null,
      verdict: "no_ground",
      reason: "no field activity measured — a verdict here would manufacture conviction from silence",
      bar: "unavailable",
    });
  }
  const openness = passage / total;
  const nullTotal = nullPassage + nullDeposits;
  const nullOpenness = nullTotal > 0 ? nullPassage / nullTotal : null;
  if (nullOpenness === null) {
    return Object.freeze({
      schema: "EOGroundClosure@1",
      deposits, passage, openness,
      nullDeposits, nullPassage, nullOpenness,
      verdict: "no_ground",
      reason: "the null-arm reported no deposits and no passage — there is no derived bar to stand on",
      bar: "unavailable",
    });
  }
  if (openness >= nullOpenness) {
    return Object.freeze({
      schema: "EOGroundClosure@1",
      deposits, passage, openness,
      nullDeposits, nullPassage, nullOpenness,
      verdict: "open",
      reason: `openness ${openness.toFixed(3)} is at or above the null's ${nullOpenness.toFixed(3)} — no worse than honest noise, and with passage present the field is being re-formed`,
      bar: `null openness ${nullOpenness.toFixed(3)} (derived from the null-arm, never set)`,
    });
  }
  if (passage === 0) {
    return Object.freeze({
      schema: "EOGroundClosure@1",
      deposits, passage, openness,
      nullDeposits, nullPassage, nullOpenness,
      verdict: "closed",
      reason: `passage is 0 with ${deposits} deposit(s) — the field reads only itself; openness ${openness.toFixed(3)} is below the null's ${nullOpenness.toFixed(3)}`,
      bar: `null openness ${nullOpenness.toFixed(3)} (derived from the null-arm, never set)`,
    });
  }
  return Object.freeze({
    schema: "EOGroundClosure@1",
    deposits, passage, openness,
    nullDeposits, nullPassage, nullOpenness,
    verdict: "closing",
    reason: `openness ${openness.toFixed(3)} is below the null's ${nullOpenness.toFixed(3)} — the field is folding into itself more than noise does, faster than passage re-forms it`,
    bar: `null openness ${nullOpenness.toFixed(3)} (derived from the null-arm, never set)`,
  });
}

/** witnessAnswer(reading) — the door's answer: deposit or release. A
 * closing field's products are deposits (habit), never knowledge — the
 * hyperlexicon must not accrete onto a field that is reading itself. */
export function witnessAnswer(reading) {
  switch (reading?.verdict) {
    case "open": return Object.freeze({ action: "release", reason: "the field is open — its products are re-formed by passage and accrete into the hyperlexicon" });
    case "closing": return Object.freeze({ action: "re-ground", reason: "the field is closing — shed the deposits, descend one level, start a fresh ground" });
    case "closed": return Object.freeze({ action: "re-ground", reason: "the field is closed — passage is 0, it reads only itself; re-ground, never accumulate" });
    default: return Object.freeze({ action: "withhold", reason: "no verdict — nothing was measured; withhold rather than invent" });
  }
}

/** driftOf(series) — attention drifted? The witness notices when the field
 * has started to close, not only that it is closed. `series` is an array of
 * {seq, openness} readings in order; a net decline from first to last is
 * drift. Structural, never a tuned window. */
export function driftOf(series = []) {
  const readings = series.filter((s) => s && typeof s.openness === "number");
  if (readings.length < 2) {
    return Object.freeze({ schema: "EOGroundDrift@1", readings: readings.length, drifting: null, reason: "fewer than two measured openness readings — a drift claim would be a guess" });
  }
  const first = readings[0].openness;
  const last = readings[readings.length - 1].openness;
  const net = last - first;
  return Object.freeze({
    schema: "EOGroundDrift@1",
    readings: readings.length,
    drifting: net < 0,
    net,
    first, last,
    reason: net < 0
      ? `openness declined ${first.toFixed(3)} -> ${last.toFixed(3)} — attention has drifted, the field is closing`
      : `openness held or rose ${first.toFixed(3)} -> ${last.toFixed(3)} — no net drift`,
  });
}