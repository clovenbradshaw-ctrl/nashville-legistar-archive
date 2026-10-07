/* Kairos speaks:
 * “why, in Heaven’s name, is the back of thy head 
bald? B. Because none whom I have once raced 
by on my winged feet will now, though he wishes it 
sore, take hold of me from behind. A. Why did the 
artist fashion thee? B. For your sake, stranger, and 
he set me up in the porch as a lesson.”
 *
 * This file, eoreader7/native/organs/kairos.js, embodies the essence of Kairos, the god of the opportune moment.  It represents a rigorous approach to understanding the fleeting nature of time and the significance of the present.  However, it's essential to recognize that the subjective nature of Kairos is a complex challenge.
 *
 * — the engineering record below, kept whole —
 */
// kairos.js — Kairos, the third watcher, the Pattern: the difference that
// makes a difference. The pair completed.
//
// Handle: Kairos — the god of the opportune moment, the qualitative present
// (as opposed to chronos, the linear time the memory clocks measure). The
// two ravens are the faculties: Huginn (thought) decides WHICH MODEL answers
// a job; Muninn (memory) decides WHAT is recalled into the turn. Kairos
// decides the THIRD thing — whether the turn's difference made a difference:
// attention, surprise, learning. The only part that holds nothing of its own
// and the only part that can tell moved from gone (P130's Pattern; Bateson's
// "a difference that makes a difference"; nul.pattern()'s `opened` sign).
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it. Here: KAIROS (the pattern — the difference a turn
// makes), the third of the triad. All three — the two ravens and the
// moment — answer to heimdall.
//
// The organs are already built and measured; this module is their REGISTER,
// the decision over them, the same shape Huginn holds over the model rungs
// and Muninn over the recall:
//
//   the attention axis — aperture.js's observations (a real tier-stack
//   surprise reading of the discourse stream, its own null: every arrival
//   placed against the continuation prior). What aperture does NOT decide
//   is the SIGN — is this a difference that makes a difference, or noise?
//   That is Kairos's, read off the SAME fields with the SAME cut.
//
//   the address axis — relative-pattern.js's `correspond` (drift/reanchor
//   over the relative memory): agree / repaired / ground-shifted / apart.
//   That is the Pattern act already ON the record; what it does not say is
//   what the correspondence MEANS — a difference, or none. Kairos says it.
//
// The walls (this project's own law, applied to the Pattern):
//   - THE CUT IS THE NULL'S OWN, never a threshold picked here. A placed
//     arrival reads `rank > 0.5` — aperture's own documented cut, the null's
//     OWN median ("not a value chosen by checking what it does to any one
//     run"), cited and pinned against the real organs, never re-derived.
//   - A GAP IS NEVER A VERDICT (P41, aperture's own "withheld, never
//     flipped"): an unmeasured arrival reads `gap`, never `noise` — absence
//     of a measurement is not the same as the ground holding.
//   - KAIROS NEVER SAYS WHAT THE READING SHOULD HAVE BEEN (P43). The sign
//     says only whether the ground moved, never what the right answer was.
//   - NEVER A DISPLAYED METRIC (P72, user direction: the system registers
//     surprise to itself, "never show it metrics of its own self state").
//     The sign is a typed verdict and a reason, never a number rendered.
//   - KAIROS HOLDS NOTHING OF HIS OWN (P130: the Pattern is the part that
//     holds nothing). No model (Huginn's), no memory (Muninn's), no
//     threshold of his own — the organs are injected and the cut is cited.
//   - THE DECISION IS ON THE RECORD. Every sign lands a `kairos-*` line
//     naming the verdict and its reason — the meta is watched by solon,
//     never self-judged.
//
// PURE: no fetch, no DOM, no storage. The organs' measurements arrive as
// arguments (aperture observations, a correspond act); this file composes.

/** The closed sign vocabulary. `pattern` is a difference that makes a
 *  difference (the ground moved — attention narrows, the lesson is
 *  carried). `noise` is a difference that makes no difference (the ground
 *  held — nothing to carry; the hunt settles here). `gap` is nothing
 *  measured — withheld, never a verdict (P41). */
export const SIGN = Object.freeze({ PATTERN: "pattern", NOISE: "noise", GAP: "gap" });

/** The per-arrival reading, three-valued. The cut is aperture's own: a
 *  placed arrival with `rank > 0.5` held the ground (more than half the
 *  null's own continuations moved belief at least this far); `rank <= 0.5`
 *  is unsettled — the null's median did NOT hold, the movement crossed it
 *  (aperture's own measured lesson: a real model's topic pivot placed at
 *  rank 0.01 while a repeat's KL sits inside the support). Censored
 *  readings and gaps read the observation's own fields, never a guess. */
export function arrivalPattern(o) {
  if (!o || o.gap) return Object.freeze({ sign: SIGN.GAP, reason: "unmeasured" });
  if (o.censored === "above") return Object.freeze({ sign: SIGN.PATTERN, reason: "shift", censored: "above", rank: o.rank ?? null });
  if (o.censored === "below") return Object.freeze({ sign: SIGN.NOISE, reason: "settled_below_support", censored: "below", rank: o.rank ?? null });
  if (o.rank != null) {
    return o.rank > 0.5
      ? Object.freeze({ sign: SIGN.NOISE, reason: "settled", rank: o.rank })
      : Object.freeze({ sign: SIGN.PATTERN, reason: "unsettled", rank: o.rank });
  }
  return Object.freeze({ sign: SIGN.GAP, reason: "unmeasured" });
}

/**
 * The exchange's Pattern verdict, over aperture observations (both roles,
 * the turn's own unit). The exchange reads by the aperture's own rules:
 * a gap anywhere refuses the WHOLE exchange (nothing measured → nothing
 * judged, `exchangeHeldGround`'s own "gaps refuse" shape); otherwise one
 * `pattern` arrival makes the exchange a pattern — attention narrows onto
 * whichever half was sharpest (`exchangeSurprise`'s max, cited) — and only
 * when every arrival held does the exchange read `noise`.
 */
export function kairosSign(arrivals) {
  if (!Array.isArray(arrivals) || arrivals.length === 0) {
    return Object.freeze({ sign: SIGN.GAP, reason: "no_arrivals" });
  }
  const reads = arrivals.map(arrivalPattern);
  if (reads.some((r) => r.sign === SIGN.GAP)) {
    return Object.freeze({ sign: SIGN.GAP, reason: "unmeasured", arrivals: reads });
  }
  if (reads.some((r) => r.sign === SIGN.PATTERN)) {
    return Object.freeze({ sign: SIGN.PATTERN, reason: reads.find((r) => r.sign === SIGN.PATTERN).reason, arrivals: reads });
  }
  return Object.freeze({ sign: SIGN.NOISE, reason: "held", arrivals: reads });
}

/**
 * The Pattern verdict over a Ground/Figure correspondence (the relative
 * memory's own act, relative-pattern.js::correspond): what the difference
 * MEANS. `agree` and `ground-only` are no difference (the figure still
 * meets its ground, or the ground holds and only the recall missed — a
 * gap on Muninn's side, not a difference). `repaired`, `ground-shifted`
 * and `apart` are real differences — the ground moved under the figure,
 * reconciled or not. Kairos tells moved from gone: `apart` with a `gone`
 * ground is the difference that matters and is unresolved.
 */
export function kairosCorrespond(act) {
  const kind = act?.kind ?? null;
  switch (kind) {
    case "agree":
      return Object.freeze({ sign: SIGN.NOISE, kind, reason: "agree — the figure still meets its ground exactly" });
    case "ground-only":
      return Object.freeze({ sign: SIGN.NOISE, kind, reason: "ground-only — the ground holds; the figure was not recalled, which is Muninn's gap, not a difference" });
    case "repaired":
      return Object.freeze({ sign: SIGN.PATTERN, kind, reason: "repaired — the figure re-anchored to moved bytes" });
    case "ground-shifted":
      return Object.freeze({ sign: SIGN.PATTERN, kind, reason: "ground-shifted — the ground moved under the figure and it is not yet re-anchored" });
    case "apart": {
      const gone = act?.ground?.kind === "gone";
      return Object.freeze({ sign: SIGN.PATTERN, kind, reason: gone ? "apart and gone — the ground itself is gone; moved-from-gone, told" : "apart — the figure meets no ground; a real, unresolved difference" });
    }
    default:
      return Object.freeze({ sign: SIGN.GAP, kind, reason: "unmeasured — no correspondence act was read" });
  }
}

/**
 * The record line for a sign — what the turn's difference was judged to
 * be, and why. Pure; the caller stamps the time and lands it, the same
 * `huginnDecision`/`muninnDecision` discipline.
 */
export function kairosDecision({ act = "sign", turn = null, role = null, sign = null, reason = null, axis = null } = {}) {
  const entry = { act: `kairos-${act}`, sign };
  if (turn != null) entry.turn = turn;
  if (role != null) entry.role = role;
  if (reason) entry.reason = reason;
  if (axis) entry.axis = axis;
  return entry;
}