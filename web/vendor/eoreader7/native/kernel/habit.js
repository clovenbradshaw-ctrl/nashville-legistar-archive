// native/kernel/habit.js — A MODEL CALL LEAVES A REVISABLE HABIT (2026-09-28).
// Medium-blind, kernel-level. Standing: nomination.
//
// User direction, verbatim: "Be sure that model calls create a revisable
// habit that makes the next instance of something similar less likely to
// need a model call."
//
// THE SHAPE. When a judge (a model) settles something a mechanical rung
// could not — a verdict over a key, deciding on a piece of the material it
// pointed at (kernel/ingestion.js::landJudgment, `chosen` and anchored) —
// that decision is not spent once. It is written down as a HABIT: the key
// it was about, the verdict, and the DECIDER — the part of the material the
// judge pointed at, which the caller's own containment check (the same
// organ that anchored the judgment) can find again without a model. The
// next instance of the same key is answered by the habit when its decider
// is present in the material at hand: a mechanical rung, no model call,
// deposited on the escalation trails as its own rung (kernel/escalation.js,
// "habit"), so the ladder learns to try it first.
//
// REVISABLE, not permanent. A habit is an INS·Figure on an append-only log
// (kernel/task-log.js — the same log every other act lands on), and it is
// CONCEDED by REC when something later contradicts it: a mechanical verdict
// that disagrees, a witness that refuses what the habit holds, a for-whom
// that declares it wrong. Concession names its trigger. A conceded habit
// answers nothing; a later judgment may learn a new one for the same key.
// The past stays whole (supersession keeps the record; nothing is edited).
//
// WHAT A HABIT NEVER DOES. It never answers when its decider is ABSENT from
// the material at hand — absence is "not applicable", never "refused", and
// the ladder goes on to the next rung. It never generalizes past its key:
// "similar" is the caller's own key function (a folded arrangement, a claim
// shape), declared, never inferred here. And it never outranks a mechanical
// verdict: the caller's mechanical rung ran first and left a gap, or the
// habit is not consulted.

import { createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS } from "./task-log.js";

export const HABIT_SCHEMA = "EOHabit@1";
export const HABIT_RUNG = "habit";
const FIGURE = "Figure";

export const createHabits = () => createTaskLog();

/**
 * learnHabit(log, { shape, key, verdict, decider, giver, forWhom, cursor }) -> log
 *   key:     what the habit is about — the caller's own key for "the same thing again"
 *   verdict: the judgment's verdict (a candidate string)
 *   decider: what the judge pointed at, as the caller's containment organ will find it again
 *   giver:   the judge's recipe — the habit's own address
 */
export function learnHabit(log, { shape = null, key, verdict, decider, giver, forWhom = null, cursor = null } = {}) {
  if (!key) throw new TypeError("learnHabit: a habit is about a declared key");
  if (!verdict) throw new TypeError("learnHabit: a habit carries a verdict");
  if (!decider) throw new TypeError("learnHabit: a habit carries the decider the judge pointed at — a verdict with nothing to find again is a rumour");
  if (!giver) throw new TypeError("learnHabit: the giver (the judge's recipe) is declared");
  return append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id: `habit:${key}`, operator: "INS", operator_basis: OPERATOR_BASIS.PRODUCED, grain: FIGURE,
    schema: HABIT_SCHEMA, habit: Object.freeze({ shape, key, verdict, decider, giver, forWhom }), cursor,
  });
}

/** Every habit on the log for a key, in order, with `conceded` where a REC names it. */
export function habitsFor(log, key) {
  const learned = log.entries.filter((e) => e.kind === ENTRY_KINDS.PROPOSE && e.schema === HABIT_SCHEMA && e.habit?.key === key);
  const conceded = new Map(log.entries.filter((e) => e.operator === "REC" && e.concedes != null).map((e) => [e.concedes, e]));
  return learned.map((e) => ({ seq: e.seq, ...e.habit, cursor: e.cursor ?? null, conceded: conceded.get(e.seq) ? { seq: conceded.get(e.seq).seq, trigger: conceded.get(e.seq).trigger ?? null } : null }));
}

/** The live habit for a key — the latest one not conceded — or null. */
export function recallHabit(log, key) {
  const live = habitsFor(log, key).filter((h) => !h.conceded);
  return live.length ? live[live.length - 1] : null;
}

/**
 * applyHabit(habit, material, { holds }) -> { verdict, decider, rung } | null
 *   holds(decider, material) -> boolean — the caller's containment organ, the one that anchored the judgment
 * Null when the decider is not in the material at hand: not applicable, never a refusal.
 */
export function applyHabit(habit, material, { holds } = {}) {
  if (!habit) return null;
  if (typeof holds !== "function") throw new TypeError("applyHabit: holds(decider, material) is the caller's — the kernel reads no medium");
  return holds(habit.decider, material) ? { verdict: habit.verdict, decider: habit.decider, rung: HABIT_RUNG, seq: habit.seq, giver: habit.giver } : null;
}

/**
 * concedeHabit(log, key, { trigger, giver, cursor }) -> { log, conceded } — REC on the live habit for the key.
 * A key with no live habit concedes nothing (returned as { log, conceded: null }); the trigger is quoted VERBATIM.
 */
export function concedeHabit(log, key, { trigger, giver, cursor = null } = {}) {
  if (!trigger) throw new TypeError("concedeHabit: a concession names its trigger");
  const live = recallHabit(log, key);
  if (!live) return { log, conceded: null };
  const next = append(log, {
    kind: ENTRY_KINDS.EVIDENCE, task_id: `habit:${key}`, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: FIGURE,
    schema: HABIT_SCHEMA, concedes: live.seq, trigger, giver: giver ?? null, cursor,
  });
  return { log: next, conceded: { seq: live.seq, key, verdict: live.verdict, trigger } };
}

/** A count of what the ledger holds: learned, live, conceded. */
export function habitCensus(log) {
  const learned = log.entries.filter((e) => e.kind === ENTRY_KINDS.PROPOSE && e.schema === HABIT_SCHEMA);
  const conceded = new Set(log.entries.filter((e) => e.operator === "REC" && e.concedes != null).map((e) => e.concedes));
  return { learned: learned.length, live: learned.filter((e) => !conceded.has(e.seq)).length, conceded: conceded.size };
}

/** Rebuild a ledger from its persisted entries through the log's own append (a bad row throws, never loads silently). */
export function habitsFromEntries(entries = []) {
  let log = createHabits();
  for (const e of entries) { const { seq, depends_on, evidence, ...rest } = e; log = append(log, rest); }
  return log;
}
