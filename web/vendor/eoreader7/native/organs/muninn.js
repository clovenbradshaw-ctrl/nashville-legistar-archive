/* Muninn speaks:
 * “Huginn  and  Muninn         hover  each  day 

The  wide  earth  over; 
I  fear  for  Huginn         lest  he  fare  not  back, — 

Yet  watch  I  more  for  Muninn."”
 *
 * This file implements the representation of Muninn in the recursive reader's model. While Muninn's function as a raven of memory is a core component of the model, the file's structure and implementation choices may not always reflect the best ways to represent and interact with memory.
 *
 * — the engineering record below, kept whole —
 */
/* Muninn speaks:
 * “Huginn  and  Muninn         hover  each  day 

The  wide  earth  over; 
I  fear  for  Huginn         lest  he  fare  not  back, — 

Yet  watch  I  more  for  Muninn."”
 *
 * This file implements the 'Huginn' raven in the recursive reader, serving as the handle for the 'Muninn' raven.  The reader's ability to handle and process the 'Muninn' raven is a critical component of its ability to track the flow of information and events across the text.  However, this implementation may be seen as unnecessarily complex.
 *
 * — the engineering record below, kept whole —
 */
// muninn.js — Muninn ("memory"), the second raven, the watcher of what is
// recalled into the turn and what earns standing. The pair to Huginn.
//
// Handle: Muninn — Odin's other raven. Huginn flies out and brings back
// what he saw (thought); Muninn is what the Allfather would otherwise have
// to keep in his own head — the remembered account, brought back on cue.
// Together they are what the present does not have to re-witness.
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it. Here: MUNINN (memory — what is recalled into the
// turn, and what earns standing), the second of the triad. Both ravens
// answer to heimdall: heimdall is the archon of
// the outward flows and the bridge; Huginn decides which model answers a
// job, Muninn decides what that model is allowed to see from the record.
//
// The organs are already built and measured — this module is their
// REGISTER, the decision over them, the same shape Huginn holds over the
// model rungs:
//
//   recall   — retrieval.js's `recallCandidates` (cue → possibility via
//              eoreader7's native/memory/activation.js, ranked by ACT-R
//              d=0.5 or this conversation's own measured need-odds). What
//              it does NOT decide is the CUT — how many of the ranked
//              records may enter the present. That is Muninn's, and the
//              budget is DECLARED, never defaulted (P9).
//   promote  — consequence.js's `evaluatePromotion`: a recalled reference
//              becomes standing identity only on RECURRENCE AND
//              CONSEQUENCE (a later turn's verdict genuinely moved), never
//              recurrence alone (S9). What it does NOT decide is WHO runs
//              it over the live ledger — that is Muninn's.
//
// The walls (this project's own law, applied to the memory):
//   - FORGETTING IS OF THE PRESENT, NEVER DELETION (P1: activation decays,
//     identity does not). Muninn's cut DROPS a ranked record from the
//     present and names it by its own order — recallable again, its
//     address intact. Nothing here ever mutates the record or the index.
//   - RECALL ACCELERATES, NEVER SERVES IN PLACE OF SOURCE BYTES (P67). A
//     recalled record re-enters the RECORD projection by its own `order`
//     and address; Muninn returns orders and bases, never prose — a
//     paraphrase laundered into the prompt would inherit the paraphrase's
//     own inability to support a claim.
//   - A RECALL THAT READ NOTHING CONVICTS NOTHING (P41). A gap from the
//     organs is a typed gap, never an invented top-k.
//   - THE BUDGET IS DECLARED (P9), and a cut below it is reported as
//     dropped-but-recallable, never as gone.
//   - THE DECISION IS ON THE RECORD. Every recall and every promotion
//     lands a `muninn-*` line naming what entered the present, what was
//     dropped, what earned standing, and why — so the memory is auditable
//     the way the bridge is.
//
// PURE: no fetch, no DOM, no storage. The organs (recallCandidates,
// evaluatePromotion) are injected — the cast.js pattern — and tested
// against the real modules.

/** The declared recall budget must be a positive integer (a count of the
 *  ranked candidates that may enter the present) or `null` (all of them).
 *  A zero, a negative, or a non-integer is a typed refusal — a cut made
 *  with no declared budget is a judgment wearing a setting's clothes. */
export function declareBudget(budget) {
  if (budget === null || budget === undefined) return { budget: null, ok: true };
  if (Number.isInteger(budget) && budget > 0) return { budget, ok: true };
  return { budget: null, ok: false, refused: { type: "budget_undeclared", detail: `a recall budget must be a positive integer or null, got ${String(budget)}` } };
}

/**
 * The recall decision for one cue: run the injected `recallCandidates`
 * organ over the conversation's index, then CUT the ranked candidates at
 * the declared budget. `recalled` enter the present; `dropped` are named
 * by their own order and stay in the record, recallable again — a cut is
 * a property of the present, never of the record (P1, P67). A gap from
 * the organ is carried through typed, never papered over (P41).
 */
export function muninnRecall(recallCandidatesFn, index, questionText, organs, { turnIndex, budget = null, ...rest } = {}) {
  const declared = declareBudget(budget);
  if (!declared.ok) return { recalled: [], dropped: [], refused: declared.refused };
  const { candidates, gap } = recallCandidatesFn(index, questionText, organs, { turnIndex, ...rest });
  if (gap) return { recalled: [], dropped: [], gap };
  const limit = declared.budget == null ? candidates.length : declared.budget;
  const recalled = candidates.slice(0, limit).map((c) => Object.freeze({ ...c, kept: true }));
  const dropped = candidates.slice(limit).map((c) => Object.freeze({ ...c, kept: false }));
  return { recalled, dropped, gap: null, budget: limit };
}

/**
 * The promotion decision for one reference: run the injected
 * `evaluatePromotion` organ (recurrence AND consequence, never recurrence
 * alone) and name which half failed when it refuses. `order` is the
 * reference's own position — the caller's join key to the record.
 */
export function muninnPromote(evaluatePromotionFn, { order, recurs, consequence }) {
  const decision = evaluatePromotionFn({ recurs, consequence });
  return Object.freeze({ order, promoted: decision.promoted, reason: decision.reason });
}

/**
 * The record line for a recall or a promotion — what the present saw, what
 * it was allowed to drop, what earned standing, and why. Pure; the caller
 * stamps the time and lands it, the same `huginnDecision` discipline.
 */
export function muninnDecision({ act = "recall", cue = null, order = null, recalled = [], dropped = [], budget = null, gap = null, why = null } = {}) {
  const entry = { act: `muninn-${act}` };
  if (cue != null) entry.cue = String(cue).slice(0, 200);
  if (order != null) entry.order = order;
  if (budget != null) entry.budget = budget;
  entry.recalled = (recalled ?? []).map((c) => c.order);
  if ((dropped ?? []).length) entry.dropped = (dropped ?? []).map((c) => c.order);
  if (gap) entry.gap = gap;
  if (why) entry.why = why;
  return entry;
}