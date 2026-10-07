/* Synapse speaks:
 * “A subminimal stimulus at one point in the 
field favours response to a subsequent stimulus at a second point 
in the field even 8 centimeters distant — so long as the second 
stimulus follows within summation time;”
 *
 * This file implements the core of the "synaptic" model of signaling, capturing the essential dynamics of signal arrival, processing, and firing.  While the analogy to biological synapses is useful for understanding the underlying principles, it's important to remember that this model is a simplified representation of a complex physical process.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/pending-sig.js — a SIG allowed to wait, briefly, for the INS
// Handle: Synapse — after the biological synapse: a signal docks, waits a bounded window, and fires on match or clears. Amendment XVII.
// that will license it. Medium-general, kernel-level.
//
// WHY THIS EXISTS. Every reading organ in this repo is deliberately causal
// — `memory/activation.js`'s own header: "nothing computed from material
// the reader hasn't reached yet," load-bearing for READING-SPEC S3/S11
// ("lookahead is not reading"). Cataphora ("Before SHE spoke, MARY paused")
// is genuinely forward-pointing, and a general future-search capability
// would reopen exactly the door those rules exist to keep shut. The
// honest fix is not a new search direction — it is treating a forward
// reference as an explicit, BOUNDED wait: the SIG stays open only until a
// caller-declared expiry, checked against every later act as it arrives,
// resolved the moment a match lands, and typed as an honest, disclosed
// non-resolution if the bound passes first. Nothing here looks backward
// OR forward past what the caller has already declared it may wait for.
//
// THE BOUND IS THE CALLER'S OWN UNIT (P5.4: the caller states its unit),
// never a hardcoded "same sentence." A text adapter might bound a
// cataphoric pronoun to "within this sentence's own clause count"; a
// protocol-trace adapter might bound a PENDING-ACK placeholder to "within
// the next 5 messages." This file knows neither; it only knows an integer
// `at` on the caller's own clock and an integer `expiresAt`.
//
// ONE OPEN SIG, ONE MATCH, NEVER A CHOICE AMONG SEVERAL. Ordinary CON
// (completion.js's resolveAbsence, holder-scope.js's admissibleUnder) asks
// contest.js to adjudicate among competing candidates because more than one
// could plausibly be right. A cataphoric wait is a different question —
// "has the ONE thing this SIG was left open for arrived yet" — so this
// file composes with no adjudicator at all; `matches` is the caller's own
// declared predicate (a name, a role, a schema — whatever the caller's own
// individuation already uses), and the first act that satisfies it wins by
// construction, not by margin.

import { cellOf } from "./cube.js";

export const PENDING_SCHEMA = "EOPendingSig@1";

/** SIG·Figure: a particular reference registered, not yet identified. */
export const PENDING_CELL = Object.freeze(cellOf("SIG", "Figure"));

/** CON·Figure: the same cell every other reference resolution occupies. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Figure"));

/**
 * openSig({ id, at, expiresAt, matches }) — register a forward-pointing
 * reference, bounded on the caller's own clock.
 *
 * `expiresAt`: the LAST `at` (inclusive) this SIG may still be resolved by
 * — declared, never defaulted, and must be at least `at` itself (a SIG
 * cannot expire before it opens).
 * `matches(act)`: the caller's own predicate — whatever "the thing this
 * SIG was left open for" means to the caller (a name, a role, a schema).
 * This organ never inspects an act's content; it only calls the predicate.
 */
export function openSig({ id, at, expiresAt, matches } = {}) {
  if (id == null) throw new TypeError("openSig: id is required");
  if (!Number.isFinite(at)) throw new TypeError("openSig: at is declared on the caller's own clock — never defaulted");
  if (!Number.isFinite(expiresAt) || expiresAt < at) throw new TypeError("openSig: expiresAt is declared, and cannot precede at — a SIG cannot expire before it opens");
  if (typeof matches !== "function") throw new TypeError("openSig: matches is the caller's own predicate — never inferred from content");
  return Object.freeze({
    schema: PENDING_SCHEMA, op: PENDING_CELL.op, grain: PENDING_CELL.grain, cell: PENDING_CELL,
    id, at, expiresAt, matches, status: "open",
  });
}

/**
 * checkArrival(pending, act) — offer one later act to an open SIG.
 *
 * Returns one of three typed outcomes, never a silent no-op:
 *   { status: "resolved", ... }  — this act matched, within bound: CON·Figure.
 *   { status: "open" }           — no match yet, still within bound, unchanged.
 *   { status: "expired", ... }   — the bound passed with no match: a typed
 *                                   gap, disclosed rather than dropped.
 * A caller drives this once per later act, in arrival order — the same
 * discipline `memory/activation.js`'s own readForward holds for RECALL then
 * ENCODE: nothing here is asked about an act before the caller has it.
 */
export function checkArrival(pending, act) {
  if (pending.status !== "open") return pending;
  if (!Number.isFinite(act?.at)) throw new TypeError("checkArrival: act.at is required");

  if (act.at > pending.expiresAt) {
    return Object.freeze({
      ...pending, status: "expired", cell: RESOLUTION_CELL,
      detail: `no matching act arrived by expiresAt (${pending.expiresAt}) — the reference stays open in fact, closed as unresolved in the record`,
    });
  }
  if (act.at < pending.at) return pending; // an act the caller replays out of order is not this SIG's business
  if (!pending.matches(act)) return pending;

  return Object.freeze({
    ...pending, status: "resolved", cell: RESOLUTION_CELL,
    resolvedBy: act.id, resolvedAt: act.at,
    detail: `resolved by act ${act.id} at ${act.at}, within the declared bound (expiresAt ${pending.expiresAt})`,
  });
}
