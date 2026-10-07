// pathos-turn.js — the PATHOS SYSTEM, NOT OPTIONAL: every finished exchange
// is undergone, at the arc grain, and a ground that fails is conceded on the
// record before the next turn speaks.
//
// The organ itself is eoreader7's (native/organs/pathos.js, Abhinavagupta —
// the felt shape of a reading, and the re-ground when the ground fails).
// This module is the live turn's composition of it: it reads the RECENT
// CONVERSATION — the same rolling arc arcs.js measures — through pathosOf,
// asks reGroundCondition, lands the concession through landReGround when one
// fires, and hands back the next turn's voice cue. The organs are injected
// (the cast.js pattern) so the page loads them from the one seam and the
// tests load the real ones by relative path.
//
// THE LOOP (the organ's own law, executable here):
//   the conversation's recent voice → pathosOf (rhythm + curve + strain,
//   for a DECLARED experiencer) → reGroundCondition → reGround (REC·Ground:
//   a recorded concession) → landReGround (the act lands, addressable)
//   → the cue the next turn hears.
//
// LAWS HELD, each the organ's own:
//   1. PATHOS WITHOUT A DECLARED EXPERIENCER IS REFUSED — the caller
//      declares who underwent this, never a default.
//   2. A concession is a recorded act, never an idle one — ground_holds
//      never concedes, and the same kind is not conceded twice in a row
//      without a holding reading in between (a second act for the same kind
//      on the same ground would be the same act twice).
//   3. The curve is a typed GAP on this pipeline, disclosed, never a
//      verdict: the conversation's own exchange is not run through a reader
//      fold, so surprise/tension/release are unmeasured and `collapse`
//      structurally cannot fire here. Rhythm (real, from the text) and
//      strain (real, from the caller's record) are what decide — `stale`
//      and `contested` — and the read says its curve is a gap.
//
// Usage (the page):
//   pathosTurn({ organs: { pathosOf, reGroundCondition, reGround, landReGround },
//                text: recentAnswers.join(" "),
//                experiencer: { who: "the-fold:reader", read: `conversation:${convo}` },
//                state: { contested: [...] }, ledger: state.pathosLog,
//                lastKind: state.pathosLast, heldSinceLast: state.pathosHeld, turn })

export const PATHOS_TURN_LAWS = Object.freeze({
  curve: "a typed gap on this pipeline — the conversation is not run through a reader fold, so collapse cannot fire; stale and contested are the live registers",
  concession: "one concession per failing register, never twice in a row without a holding reading between",
});

/** The model-facing cue for the next turn, per condition. Information about
 *  the conversation's own recent voice, never a directive, and clean of
 *  apparatus vocabulary (firewall.js) — asserted in pathos-turn.test.mjs. */
export function pathosCueFor(condition) {
  switch (condition?.kind) {
    case "stale":
      return "The recent answers in this conversation have been flat — the same rhythm every time.";
    case "contested":
      return "This conversation keeps returning to the same unresolved disagreement.";
    case "collapse":
      return "Something in this conversation broke the ground it was standing on, and nothing released it.";
    default:
      return null;
  }
}

/**
 * pathosTurn — one mandatory pass of the pathos loop over the conversation's
 * recent voice. Returns the read, the condition, the landed act (or null),
 * the updated ledger and concession bookkeeping, and the next turn's cue.
 */
export function pathosTurn({
  organs,
  text,
  experiencer,
  state = {},
  ledger = [],
  lastKind = null,
  heldSinceLast = true,
  reScope = null,
  turn = null,
} = {}) {
  for (const name of ["pathosOf", "reGroundCondition", "reGround", "landReGround"]) {
    if (typeof organs?.[name] !== "function") {
      throw new TypeError(`pathosTurn requires the pathos organ ${name} — injected, never re-implemented`);
    }
  }
  const read = organs.pathosOf({ text, experiencer, state });
  const condition = organs.reGroundCondition(read);
  // The organ's own bound (its header): one concession per failing register
  // per pass, and a ground that holds is never conceded. The live stream's
  // counterpart of "per pass": a kind already conceded stays conceded until
  // a holding reading re-founds the ground.
  const shouldLand = condition.kind !== "ground_holds" && (lastKind !== condition.kind || heldSinceLast);
  let act = null;
  let nextLedger = ledger;
  if (shouldLand) {
    act = organs.reGround({
      read,
      giver: `reader:pathos@${condition.kind}${turn != null ? `:turn:${turn}` : ""}`,
      reScope,
    });
    nextLedger = organs.landReGround(ledger, act);
  }
  return Object.freeze({
    read,
    condition,
    act,
    ledger: nextLedger,
    lastKind: act ? condition.kind : lastKind,
    heldSinceLast: condition.kind === "ground_holds" ? true : act ? false : heldSinceLast,
    cue: pathosCueFor(condition),
    disclosure: PATHOS_TURN_LAWS,
  });
}