// consequence.js — increment D of wiring-the-measured-memory-v2: the
// promotion gate. A reference is promoted from "recalled" to standing
// identity only on RECURRENCE (retrieval.js's own citedAt — the same
// arrivals >= 2 structural floor this project already holds every binding
// organ to, reused rather than re-derived) AND CONSEQUENCE — a later turn's
// verdict actually changed because the claim was available, never
// recurrence alone (READING-SPEC S9: a count is possibility, never
// standing; the levers-RESULTS.md finding this whole lineage already
// measured — "the murder" recurred like a being and was admitted like one).
//
// CONSEQUENCE IS TYPED THREE WAYS, NOT TWO. `consequence_untested` — no
// later turn ever engaged this ground at all; a gap, not a zero
// (seriesOf's own rule, memory/activation.js: "a gap is not a zero").
// `recurring_no_consequence` — a later turn DID engage the ground, the
// claim WAS available, and the verdict did not move. Only when at least one
// engaged turn's verdict genuinely differed with the claim present versus
// absent does a reference promote.
//
// THE TIMING DISCIPLINE IS `ground-ledger.js`, REUSED, NOT ADJACENT. The
// ablation ("would this turn's verdict have been the same with this claim
// excluded from the citation base") is scored against the ground exactly as
// it stood at that turn, and once scored, permanent — ground-ledger.js's
// own two-rule firewall (a ground version cannot be frozen retroactively; a
// turn cannot be re-priced once scored), applied here to a new quantity
// rather than re-implemented. `makeGroundLedger` is imported directly (a
// same-repo file, not a cross-repo organ); the injected dependency is the
// TASK-LOG VOCABULARY ground-ledger.js itself expects
// (`{createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS, GRAIN_RANK}`),
// which `adaptTaskLog` below builds from eoreader7's real
// `native/kernel/task-log.js` + `native/kernel/cube.js` — a genuinely
// different module than eoreader6.1's `holon/task-log.js` ground-ledger.js
// was originally written against (no GRAIN_RANK export; GRAINS is ordinal
// instead), reconciled here rather than assumed compatible.
//
// THE ABLATION ITSELF IS INJECTED, NEVER COMPUTED HERE. "Re-run the
// mechanical grounding with this claim excluded" names a real computation
// (grounding.js/hypergraph.js's own verification organs, run twice), and
// wiring that live integration is real, disclosed, unattempted work — the
// same posture this pass already holds for C's retrieval composition and
// this project's own precedent (HL, self-witness, grammar-lens: built and
// tested, not deep-wired into holon.js without the multi-session-owned
// file's own explicit scope). What this module owns is the PROMOTION LOGIC
// and the FIREWALL, generic over whatever verdict function a caller
// supplies — proven here against a synthetic, hand-verifiable verdict.
//
// Pure: no IO, no model calls. `ground-ledger.js` is imported directly;
// every other organ (the task-log vocabulary) arrives injected.

import { makeGroundLedger } from "./ground-ledger.js";

/**
 * Build the `{createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS,
 * GRAIN_RANK}` shape ground-ledger.js expects, from eoreader7's real
 * `native/kernel/task-log.js` exports plus `native/kernel/cube.js`'s
 * `GRAINS` (ordinal: `["Ground","Figure","Pattern"]`, index IS the rank —
 * `GRAIN_RANK` is this ordinality made explicit, not a new fact).
 */
export function adaptTaskLog({ createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS, GRAINS }) {
  if (typeof createTaskLog !== "function" || typeof append !== "function" || !ENTRY_KINDS || !OPERATOR_BASIS || !Array.isArray(GRAINS))
    throw new TypeError("adaptTaskLog: createTaskLog/append/ENTRY_KINDS/OPERATOR_BASIS/GRAINS are all required — this is a shape adapter, not a guesser");
  const GRAIN_RANK = Object.freeze(Object.fromEntries(GRAINS.map((g, i) => [g, i])));
  return Object.freeze({ createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS, GRAIN_RANK });
}

/** One ledger per conversation, built over the adapted task-log vocabulary
 * — a thin, named re-export so callers of this file never need to know
 * ground-ledger.js exists as a separate module. */
export function createConsequenceLedger(taskLog) {
  return makeGroundLedger(taskLog);
}

/**
 * Score one turn's ablation and land it on the ledger, honoring the
 * prequential firewall (ground-ledger.js's own two rules: a turn scored
 * once stays scored; nothing here re-prices a turn the ground has already
 * moved past). `verdictWith`/`verdictWithout` are whatever the caller's own
 * grounding check returned (any comparable value — a verdict string, a
 * boolean, a claim count); `score` is 1 when they differ (the claim
 * mattered) and 0 when they agree, `nullScore` is always 0 — the declared
 * null that an arbitrary claim's ablation changes nothing, disclosed as
 * exactly that rather than a reshuffle-corrected null (real, unbuilt future
 * work: this repo's own `nul/index.js` apparatus is built for numeric
 * series, and reusing it for a discrete verdict-changed/unchanged null
 * needs its own design and measurement before it earns a name here — the
 * same standard P31's own residue already holds every number in this
 * lineage to).
 */
export function scoreConsequence(ledger, log, { turnId, turnIndex, verdictWith, verdictWithout }) {
  const score = verdictWith === verdictWithout ? 0 : 1;
  return ledger.scoreTurn(log, { turnId, turnIndex, score, nullScore: 0 });
}

/**
 * The consequence dimension alone, for one ground version — typed three
 * ways per the file header. `consequence_untested` when no turn was ever
 * scored against this ground; `recurring_no_consequence` when at least one
 * was and none moved; `mattered` (carrying every turn that DID move,
 * because a claim can matter more than once and the record is worth
 * keeping) otherwise.
 */
export function classifyConsequence(ledger, log, groundTaskId) {
  const scores = ledger.allScores(log).filter((s) => s.ground_version === groundTaskId);
  if (!scores.length) {
    return Object.freeze({ status: "consequence_untested", gap: "consequence_untested", scores: Object.freeze([]) });
  }
  const moved = scores.filter((s) => s.score > s.null_score);
  if (!moved.length) {
    return Object.freeze({ status: "recurring_no_consequence", scores: Object.freeze([...scores]) });
  }
  return Object.freeze({ status: "mattered", scores: Object.freeze([...moved]) });
}

/**
 * The full promotion decision: recurrence (a caller-supplied fact — this
 * module does not recompute B's curves) AND consequence, never recurrence
 * alone (S9). Returns `{promoted, reason}` — `reason` is always one of
 * `not_yet_recurring` / `consequence_untested` / `recurring_no_consequence`
 * / `recurrence_and_consequence`, so a refusal always names which half of
 * the AND failed.
 */
export function evaluatePromotion({ recurs, consequence }) {
  if (!recurs) return Object.freeze({ promoted: false, reason: "not_yet_recurring" });
  if (consequence.status === "consequence_untested") return Object.freeze({ promoted: false, reason: "consequence_untested" });
  if (consequence.status === "recurring_no_consequence") return Object.freeze({ promoted: false, reason: "recurring_no_consequence" });
  return Object.freeze({ promoted: true, reason: "recurrence_and_consequence" });
}
