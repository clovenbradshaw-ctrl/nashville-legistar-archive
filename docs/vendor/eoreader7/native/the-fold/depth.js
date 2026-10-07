// depth.js — the thinking-depth slider (P123). Pure.
//
// User direction (2026-09-05): "the output becomes better the same way
// people make better output, not by expanding their context window but
// by … so the way we switch models and reasoning, this can toggle deeper
// thinking through a slider."
//
// Deeper thinking here is MORE RECURSION over the same bounded working
// memory, never more context: the draft is read against its sources
// again, more sentences are put to the witness, a denied sentence is
// rewritten once more, a short section is continued again, a thin
// retrieval is hunted again, more cited links are opened. That is how a
// person makes better output — a second reading, a colleague's eye, one
// more pass — not by holding more in mind at once. The model's window is
// untouched at every rung; only the number of bounded passes changes.
//
// Level 1 IS today's declared budgets (the base layer must be a fine
// response alone; every rung above is additive). Asks double per rung —
// the effort ladder's own giver — and rounds add one per rung. Level 0 is
// the quick rung: retrieval and every mechanical check still run, but no
// ask is spent on recursion. All declared (P9), none measured; the
// measurement is the same ask run at two rungs, on the record.
export const DEPTH_MAX = 3;
export const DEPTH_NAMES = ["quick", "plain", "careful", "deep"];

const int = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.floor(n) : 1; };
const clamp = (n) => Math.max(0, Math.min(DEPTH_MAX, n));

/**
 * budgetsFor(level, base) → the recursion budgets at that rung.
 * base: { corrections, witnessAsks, pieceWitnessAsks, snipRounds, revisionRounds, revisionAsks, continuations, hunts, linkChecks } — the caller's own declared constants, so this module never restates them.
 */
export function budgetsFor(level, base) {
  const d = clamp(int(level));
  if (d === 0) return { level: 0, name: DEPTH_NAMES[0], corrections: 0, witnessAsks: 0, pieceWitnessAsks: 0, snipRounds: 0, revisionRounds: 0, revisionAsks: 0, continuations: 0, hunts: 0, linkChecks: 0 };
  const scale = 2 ** (d - 1);
  const extra = d - 1;
  return {
    level: d, name: DEPTH_NAMES[d],
    corrections: base.corrections + extra,
    witnessAsks: base.witnessAsks * scale,
    pieceWitnessAsks: base.pieceWitnessAsks * scale,
    snipRounds: base.snipRounds + extra,
    revisionRounds: base.revisionRounds + extra,
    revisionAsks: base.revisionAsks * scale,
    continuations: base.continuations + extra,
    hunts: base.hunts + extra,
    linkChecks: base.linkChecks * scale,
  };
}

/**
 * The rung in plain words, for the picker's legend, the prompt trace and the
 * export — what is done more, never the apparatus.
 *
 * "Up to N sentences are put to the witness" understated its own true worst
 * case (Bug-2 investigation, 2026-09-15): `witnessNote`'s own armed-select
 * protocol can spend a SECOND model call per ask (a sibling-swap arm check,
 * or a generate-then-swapped-generate fallback pair — corroboration.js's
 * own header, "the arm"), so a budget of N asks is really up to 2N model
 * calls, not N — and at depth 3 (deep), N is already 24. Measured live: an
 * ordinary "tell me everything about this" question against one attached,
 * fact-dense source cost 33 separate model calls at depth 3 against 3 at
 * depth 1 for the same question, on the same material. The line now says
 * so, so a person reading the depth explainer is not left to discover the
 * true cost by counting network requests.
 */
export function depthLine(budgets, { piece = false } = {}) {
  const b = budgets;
  if (!b || b.level === 0) return `Thinking depth 0 of ${DEPTH_MAX} (quick): the answer is drafted once, read against the sources once, and nothing is asked again.`;
  const parts = piece
    ? [`each section is read against its sources and rewritten up to ${b.snipRounds} time${b.snipRounds === 1 ? "" : "s"} where a number, date or name is not in them`, `up to ${b.pieceWitnessAsks} sentences per section are put to the witness (each ask up to two model calls)`, `a sentence a later reading denies is rewritten up to ${b.revisionRounds} time${b.revisionRounds === 1 ? "" : "s"}`, `a short section is continued up to ${b.continuations} time${b.continuations === 1 ? "" : "s"}`, `a thin retrieval is hunted up to ${b.hunts} time${b.hunts === 1 ? "" : "s"}`]
    : [`the draft is corrected up to ${b.corrections} time${b.corrections === 1 ? "" : "s"}`, `up to ${b.witnessAsks} sentences are put to the witness (each ask up to two model calls)`, `up to ${b.linkChecks} cited links are opened`];
  return `Thinking depth ${b.level} of ${DEPTH_MAX} (${b.name}): ${parts.join("; ")}. The model's context is the same at every depth; only the number of passes changes — a witness ask's own two-call worst case means the real spend can run well past the sentence count named above.`;
}
