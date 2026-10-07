// native/kernel/temporal-reference.js — tense is anaphora: a bare temporal
// Handle: Partee — after Barbara Partee's "Tense, Aspect and Anaphora": tense is anaphora, referring back to an established reference time. Amendment XVII.
// deixis points back at an already-established reference ground, and
// narrative advances that ground the way any other act advances a ground.
// Medium-general, kernel-level.
//
// WHY THIS EXISTS. Partee's account of tense: "I turned off the stove"
// does not compute a fresh time by subtracting from the utterance moment —
// it points back at a reference time already on the discourse's own
// record, the identical anaphoric move ordinary pronouns make one triad
// over. Nothing in this repo currently individuates a time as a referent
// at all — confirmed by search: no temporal-referent concept exists
// anywhere in `native/`. This file is the smallest thing that closes it,
// built from cells the cube already has rather than a new "temporal"
// terrain: a time is individuated exactly the way any particular is
// (INS·Figure — Entity does not mean "person or object," it means "any
// individuated particular"), and the narrative's own CURRENT reference
// ground — what a bare past tense currently points to — is Interpretation·
// Ground: Atmosphere, "present interpretive ground" in this repo's own
// terrain-activation.js header. That is not a stretch: the reference time
// is not a claim about the world (Lens/Figure) or a recurring pattern
// (Paradigm), it is the AMBIENT SITUATION every subsequent tense reads
// against — precisely what Atmosphere already names elsewhere in this
// kernel.
//
// ADVANCING THE GROUND IS REC, NOT A NEW ACT INVENTED FOR THIS FILE.
// `kernel/perspective.js`'s own REC usage concedes a prior belief and
// keeps it on record rather than erasing it ("a holder re-zeros: the
// belief is conceded, and the concession is kept"). A narrative moving
// from one reference time to the next is the identical shape: the OLD now
// is not wrong, it is superseded, and `advanceReferenceGround` keeps it —
// `supersedes` names exactly what was re-zeroed, mirroring
// `perspective.js`'s own field for the same reason.
//
// RESOLUTION IS DETERMINISTIC WHEN IT CAN BE, ADJUDICATED WHEN IT MUST BE.
// With exactly one ground established at or before a tense reference,
// "the current one" is not a guess — it is the only candidate, a
// tautology, not a default. With more than one live candidate (a flashback
// layer competing with the main narrative's own now), this file invents
// no second scoring rule: it hands the candidates to `contest.js`'s real
// `adjudicate`, which will itself refuse to run without the caller's own
// declared minActivation/minMargin/contestedMargin — so genuine ambiguity
// can never silently fall back to "most recent" the way the one-candidate
// case honestly can.

import { cellOf } from "./cube.js";
import { adjudicate } from "./contest.js";

export const TIME_SCHEMA = "EOTimeReferent@1";
export const GROUND_SCHEMA = "EOReferenceGround@1";

/** INS·Figure: a time, individuated exactly like any other particular. */
export const ESTABLISH_CELL = Object.freeze(cellOf("INS", "Figure"));

/** REC·Ground: the narrative's ambient "now" re-zeroing, past kept. */
export const ADVANCE_CELL = Object.freeze(cellOf("REC", "Ground"));

/** CON·Ground: the same terrain the target (a ground) lives in. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Ground"));

/** establishTime({ id, at, key }) — individuate a time as a referent. */
export function establishTime({ id, at, key } = {}) {
  if (id == null) throw new TypeError("establishTime: id is required");
  if (!Number.isFinite(at)) throw new TypeError("establishTime: at is declared on the caller's own clock — never defaulted");
  if (key === undefined) throw new TypeError("establishTime: key is required");
  return Object.freeze({ schema: TIME_SCHEMA, id, at, key, cell: ESTABLISH_CELL });
}

/**
 * advanceReferenceGround({ id, at, timeId, from }) — re-zero the current
 * reference ground to a newly established time. `from` (the prior ground,
 * or null for the narrative's first) is kept, never erased — `supersedes`
 * names it explicitly.
 */
export function advanceReferenceGround({ id, at, timeId, from = null } = {}) {
  if (id == null) throw new TypeError("advanceReferenceGround: id is required");
  if (!Number.isFinite(at)) throw new TypeError("advanceReferenceGround: at is declared on the caller's own clock — never defaulted");
  if (timeId == null) throw new TypeError("advanceReferenceGround: timeId is required — a ground without an established time is not a ground");
  return Object.freeze({
    schema: GROUND_SCHEMA, id, at, timeId, cell: ADVANCE_CELL,
    supersedes: from ? Object.freeze({ id: from.id, timeId: from.timeId, at: from.at }) : null,
  });
}

/**
 * candidateGrounds(sigAt, grounds) — every ground established at or before
 * `sigAt`, EXCLUDING any ground a later one has already superseded, most
 * recent first.
 *
 * The exclusion is load-bearing, not an optimization: `advanceReferenceGround`
 * records `supersedes` precisely so an ordinary linear narrative — g1, then
 * g2 superseding g1 — collapses back to ONE live candidate once g2 exists,
 * the way a reader actually experiences tense (the old "now" is gone, not a
 * standing rival). Two grounds that do NOT supersede each other (a genuine
 * flashback thread declared independently of the main line, neither's `from`
 * pointing at the other) correctly stay separate candidates — real
 * ambiguity is never collapsed, only a chain's own retired links are.
 * Never forward either way — a tense reference does not reach a ground the
 * narrative has not yet advanced to.
 */
export function candidateGrounds(sigAt, grounds = []) {
  if (!Number.isFinite(sigAt)) throw new TypeError("candidateGrounds: sigAt is declared on the caller's own clock — never defaulted");
  // A ground is excluded only once the SUPERSEDING ground has itself
  // happened by sigAt — not merely because a later supersession exists
  // somewhere in the full list. At sigAt=30 with g1@0 superseded by g2@50,
  // g2 has not happened yet at 30, so g1 is still the live "now" there;
  // excluding it unconditionally would answer a question about the whole
  // list's future, not about this point in it.
  const notYetHappened = (g) => g.at > sigAt;
  const supersededByNow = new Set(
    grounds.filter((g) => !notYetHappened(g) && g.supersedes?.id != null).map((g) => g.supersedes.id),
  );
  return Object.freeze(
    grounds
      .filter((g) => !notYetHappened(g) && !supersededByNow.has(g.id))
      .sort((a, b) => b.at - a.at),
  );
}

/**
 * resolveAnaphoricTense(sigAt, grounds, opts) — CON·Ground the tense
 * reference to the current reference ground.
 *
 * Exactly one candidate: bound, deterministically — not a default, the
 * only possible answer. Zero candidates: an honest `no_candidate` gap.
 * More than one: routed to the real `adjudicate` (`opts` is its own
 * signature) — which itself requires the caller's declared bars, so
 * genuine ambiguity can never silently resolve to "most recent."
 */
export function resolveAnaphoricTense(sigAt, grounds, opts = {}) {
  const candidates = candidateGrounds(sigAt, grounds);

  if (candidates.length === 0) {
    return Object.freeze({
      verdict: "no_candidate", cell: RESOLUTION_CELL, timeId: null, groundId: null,
      detail: "no reference ground has been established at or before this point",
    });
  }
  if (candidates.length === 1) {
    const only = candidates[0];
    return Object.freeze({
      verdict: "bound", cell: RESOLUTION_CELL, timeId: only.timeId, groundId: only.id,
      basis: "sole-candidate", detail: "exactly one reference ground precedes this point — not a default, the only possible answer",
    });
  }

  const verdict = adjudicate(opts);
  const won = verdict.id != null ? candidates.find((c) => c.id === verdict.id) : null;
  return Object.freeze({ ...verdict, cell: RESOLUTION_CELL, timeId: won ? won.timeId : null, groundId: verdict.id });
}

/**
 * resolveReachBack(sigAt, grounds, opts) — a tense that points BEFORE the
 * current reference ground (UD's Pqp: "a past before a past"; English
 * "had gone"). Partee: the pluperfect refers to a time anterior to the
 * reference time, and does not advance it.
 *
 * The anterior candidate is not invented: it is the ground the live one
 * SUPERSEDED — `advanceReferenceGround` keeps that link for exactly this
 * reach. Zero live grounds: `no_candidate` (nothing to reach back from).
 * A live ground that superseded nothing (the narrative's first): a typed
 * `no_prior_ground` — the past-before-this-past is not on the record, and
 * that absence is the finding. One prior: bound, basis "prior-ground".
 * Several (independent threads, each with its own prior): routed to the
 * real `adjudicate`, as resolveAnaphoricTense does, never "most recent".
 */
export function resolveReachBack(sigAt, grounds = [], opts = {}) {
  const live = candidateGrounds(sigAt, grounds);
  if (live.length === 0) {
    return Object.freeze({ verdict: "no_candidate", reach: true, cell: RESOLUTION_CELL, timeId: null, groundId: null,
      detail: "no reference ground has been established at or before this point — nothing to reach back from" });
  }
  const prior = live.filter((g) => g.supersedes).map((g) => g.supersedes);
  if (prior.length === 0) {
    return Object.freeze({ verdict: "no_prior_ground", reach: true, cell: RESOLUTION_CELL, timeId: null, groundId: null,
      detail: "the live reference ground is the narrative's first — a past before it is not on the record" });
  }
  if (prior.length === 1) {
    return Object.freeze({ verdict: "bound", reach: true, cell: RESOLUTION_CELL, timeId: prior[0].timeId, groundId: prior[0].id,
      basis: "prior-ground", detail: "the one ground the live reference ground superseded — not a default, the only anterior ground on record" });
  }
  const verdict = adjudicate(opts);
  const won = verdict.id != null ? prior.find((p) => p.id === verdict.id) : null;
  return Object.freeze({ ...verdict, reach: true, cell: RESOLUTION_CELL, timeId: won ? won.timeId : null, groundId: verdict.id });
}
