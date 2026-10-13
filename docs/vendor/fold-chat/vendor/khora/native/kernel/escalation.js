// native/kernel/escalation.js — WHEN THE MODEL COMES ONLINE TO THINK HARDER,
// and how that is LEARNED (2026-09-28). Medium-blind, kernel-level.
//
// User direction, verbatim: "Similar to when we have to use a CV model and
// OCR we should have the model come online to think harder. But that should
// be learned for the future, using Wilson Ants as needed."
//
// THE ANALOGUE, already built: organs/look.js brings a CV model online only
// when a mechanical trigger says the reader is reading something wrong
// (`weirdFormattingScore` -> `shouldLook`), and escalates to a larger vision
// model only on a named disagreement. This module is the same ladder for
// REASONING over what was not fully ingested: the trigger is kernel/
// ingestion.js (a claim rests on a holon that is `unread` or `partial`), the
// rungs are declared by the caller (a mechanical re-read, a small judge, a
// large judge), and the ORDER the rungs are tried in is not fixed here — it
// is LEARNED, in the environment, by kernel/stigmergy.js (Handle: Wilson).
//
// STIGMERGY, REUSED WHOLE. Every escalation is an ant's trip: it leaves a
// deposit { head, route, ok, ms } — the HEAD is the SHAPE of what was left
// open (the typed gap reasons inside the holon, e.g. "inverted_subject" or
// "pronoun_unbound+contested"; a caller reading a medium may prefix the
// holonic level), the ROUTE is the rung that was tried, `ok` whether it
// settled the claim. Successes strengthen the trail; failures deposit
// nothing and evaporate (7-day half-life, stigmergy.js's own); a rung that
// has never been tried is still scouted with the exploration epsilon, so a
// colony that has learned "this shape needs a judge" keeps probing whether
// the mechanics have caught up (they do — every organ this session built
// closed a shape that yesterday needed a judge). Nothing here decides a
// claim; it decides WHICH RUNG TO TRY FIRST, and records what happened.
//
// THE WALL. A judge's success is a deposit, never a fact: it strengthens
// the trail for THAT shape, and nothing else. A rung that resolved a claim
// wrongly is learned by the same environment the wrong answer lands in — a
// later contradiction is an alarm deposit (`ok: false` on the rung that
// answered, plus a veto weight), Wilson's alarm pheromone, so the trail that
// led there weakens faster than evaporation alone would take it.

import { deposit, routeOrderFor, trailStats, EXPLORE_EPSILON } from "./stigmergy.js";
import { INGESTION_SCHEMA } from "./ingestion.js";

export const ESCALATION_SCHEMA = "EOEscalation@1";
export const DEFAULT_RUNGS = Object.freeze(["mechanical", "judge"]);
export const VETO_WEIGHT = 3; // one contradiction outweighs three successes — a wrong answer is a danger, not an absence

/** The shape of what a standing left open: its gap reasons and open-slot verdicts, sorted and unique. A caller may prefix a level ("sentence:"). */
export function shapeOf(standing, { prefix = "" } = {}) {
  if (standing?.schema !== INGESTION_SCHEMA) throw new TypeError("shapeOf: an EOIngestionStanding@1");
  const parts = [...new Set([...standing.gaps.map((g) => g.reason), ...standing.openSlots.map((s) => `slot:${s.verdict}`)])].sort();
  return `${prefix}${standing.standing === "unread" ? "unread" : parts.join("+") || "partial"}`;
}

/**
 * ladderFor(trails, shape, { rungs, now, explore, rng }) -> { shape, order, stats, learned }
 *   order:   the rungs in the order to try — stigmergy's learned order (strongest trail first,
 *            never-tried rungs after every rung that earned one, a scout with probability `explore`)
 *   learned: whether any rung has a trail for this shape at all (false = the structural default order)
 */
export function ladderFor(trails, shape, { rungs = DEFAULT_RUNGS, now = Date.now(), explore = EXPLORE_EPSILON, rng = Math.random } = {}) {
  const stats = trailStats(trails, shape, { now, routes: [...rungs] });
  const order = routeOrderFor(trails, shape, { now, routes: [...rungs], explore, rng });
  return Object.freeze({ schema: ESCALATION_SCHEMA, shape, order: Object.freeze(order), stats: Object.freeze(stats.map((s) => Object.freeze({ ...s }))), learned: stats.some((s) => s.deposits > 0) });
}

/**
 * shouldEscalate({ standing, trails, rungs, ... }) -> { needed, first, ladder } | { needed: false }
 *   A `read` holon needs nothing. Otherwise the first rung of the learned ladder is what to try.
 */
export function shouldEscalate({ standing, trails = {}, prefix = "", ...opts } = {}) {
  if (standing?.schema !== INGESTION_SCHEMA) throw new TypeError("shouldEscalate: an EOIngestionStanding@1");
  if (standing.standing === "read") return Object.freeze({ needed: false, shape: null, first: null, ladder: null });
  const shape = shapeOf(standing, { prefix });
  const ladder = ladderFor(trails, shape, opts);
  return Object.freeze({ needed: true, shape, first: ladder.order[0] ?? null, ladder });
}

/** One trip recorded: the rung tried for this shape, whether it settled the claim, how long it took. Returns the new trails. */
export function recordOutcome(trails, { shape, rung, ok, ms = 0, at = Date.now() } = {}) {
  if (!shape || !rung) throw new TypeError("recordOutcome: shape and rung are declared");
  return deposit(trails, { head: shape, route: rung, ok: Boolean(ok), ms, at });
}

/**
 * recordContradiction(trails, { shape, rung, at }) — the alarm trail: an answer this rung gave
 * for this shape was later found to conflict with the environment. Deposits VETO_WEIGHT failures
 * dated NOW so the rung's strength (a sum over success deposits) is diluted in the ledger's
 * window and its share of the shape's traffic drops — the window (TRAIL_WINDOW) evaporates old
 * successes out to make room, which is the demotion.
 */
export function recordContradiction(trails, { shape, rung, at = Date.now() } = {}) {
  let t = trails;
  for (let i = 0; i < VETO_WEIGHT; i++) t = deposit(t, { head: shape, route: rung, ok: false, ms: 0, at });
  return t;
}
