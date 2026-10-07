import { GRAINS, OPERATOR_CHAIN, cellOf, isCurrentOperator } from "./cube.js";

export const ENTRY_KINDS = Object.freeze({ PROPOSE: "propose", SUPERSEDE: "supersede", EVIDENCE: "evidence", RESULT: "result", RETRACT: "retract" });
export const OPERATOR_BASIS = Object.freeze({ PRODUCED: "produced", DERIVED: "derived", DECLARED: "declared", CONTESTED: "contested", ABSENT: "absent" });
// DERIVED from cube.js's own domain/mode tables, never restated here — see
// OPERATOR_CHAIN's header there for the audit that settled the divergence
// this replaces (a hand-written order that had drifted from the very tables
// it was restating, in a file whose own header said nothing is restated).
export const OPERATOR_ORDER = OPERATOR_CHAIN;

// The three Structure-domain operators, as an identity lookup rather than a
// literal string a caller re-types. Ported 2026-08-29 alongside
// checkCubeProgression/isCurrentOperator (the-fold's build-log.js needs it
// to stamp SEG/SYN entries by name rather than a bare string). The historical
// provider also derived STRUCTURE_ROW (`Object.keys(STRUCTURE_OPERATORS)`)
// from this table; no consumer here has needed it yet, so it is not carried
// across speculatively — add it if and when a real caller does.
export const STRUCTURE_OPERATORS = Object.freeze({ SEG: "SEG", CON: "CON", SYN: "SYN" });

// A grain's depth as an ordinal, off this module's own imported GRAINS —
// added for a real external consumer (the-fold's hyperlexicon.js, which
// reads `Object.keys(taskLog.GRAIN_RANK).find((g) => taskLog.GRAIN_RANK[g]
// === 1)` to name the Figure grain without hardcoding it, the same way this
// file's own `append` already treats GRAINS as the one true ordering rather
// than restating it). Nothing invented: GRAINS was already imported here
// for `append`'s own validation two lines below, so this is a fact this
// module already holds, read off rather than restated. Advisory only —
// nothing in `append`/`projectTasks` consults it.
export const GRAIN_RANK = Object.freeze(Object.fromEntries(GRAINS.map((g, i) => [g, i])));

export function createTaskLog({ admits = OPERATOR_ORDER } = {}) {
  if (!Array.isArray(admits) || !admits.length) throw new TypeError("createTaskLog: admits must be a non-empty array of operator codes");
  return Object.freeze({ entries: Object.freeze([]), nextSeq: 0, admits: Object.freeze([...admits]) });
}

export function append(log, entry) {
  if (!entry || typeof entry !== "object") throw new TypeError("append requires an entry object");
  if (!Object.values(ENTRY_KINDS).includes(entry.kind)) throw new TypeError(`append: unknown entry kind ${JSON.stringify(entry.kind)}`);
  if (typeof entry.task_id !== "string" || !entry.task_id) throw new TypeError("append: every entry needs a task_id");
  const admits = log.admits ?? OPERATOR_ORDER;
  if (entry.operator != null && !admits.includes(entry.operator)) throw new TypeError(`append: ${JSON.stringify(entry.operator)} is not admitted by this log`);
  if (entry.operator != null && !Object.values(OPERATOR_BASIS).includes(entry.operator_basis)) throw new TypeError("append: an entry carrying an operator must state its operator_basis");
  if (entry.grain != null && !GRAINS.includes(entry.grain)) throw new TypeError(`append: invalid grain ${entry.grain}`);
  if (entry.grain != null && entry.operator == null) throw new TypeError("append: a grain was supplied without the operator that shares its cell");
  const sealed = Object.freeze({ ...entry, seq: log.nextSeq, depends_on: Object.freeze([...(entry.depends_on ?? [])]), evidence: Object.freeze([...(entry.evidence ?? [])]) });
  return Object.freeze({ entries: Object.freeze([...log.entries, sealed]), nextSeq: log.nextSeq + 1, admits });
}

const RESERVED = new Set(["kind","task_id","seq","supersedes","operator","operator_basis","grain","description","depends_on","evidence","result"]);

// One entry folded into the projection state — the step projectTasks takes
// for every entry, in seq order.
function projectEntry(byId, superseded, retracted, e) {
  if (e.kind === ENTRY_KINDS.RETRACT) { retracted.add(e.task_id); return; }
  if (e.supersedes) superseded.add(e.supersedes);
  const prior = byId.get(e.task_id) ?? { task_id: e.task_id, operator: null, operator_basis: OPERATOR_BASIS.ABSENT, operator_gap: "no structural act has been earned for this task yet", grain: null, grain_gap: "no grain has been earned for this task's operator yet", cell: null, description: null, depends_on: [], evidence: [], result: null, first_seq: e.seq };
  const payload = {}; for (const [key, value] of Object.entries(e)) if (!RESERVED.has(key)) payload[key] = value;
  const nextOperator = e.operator ?? prior.operator;
  const nextGrain = e.grain ?? (e.operator != null ? null : prior.grain);
  byId.set(e.task_id, Object.freeze({ ...prior, ...payload, evidence: e.evidence?.length ? [...new Set([...prior.evidence, ...e.evidence])] : prior.evidence, result: e.kind === ENTRY_KINDS.RESULT ? e.result : prior.result, description: e.description ?? prior.description, depends_on: e.depends_on.length ? [...e.depends_on] : prior.depends_on, operator: nextOperator, operator_basis: e.operator != null ? e.operator_basis : prior.operator_basis, operator_gap: e.operator != null ? null : prior.operator_gap, grain: nextGrain, grain_gap: e.grain != null ? null : e.operator != null ? "no grain has been earned for this task's operator yet" : prior.grain_gap, cell: nextOperator != null && nextGrain != null ? cellOf(nextOperator, nextGrain) : null, last_seq: e.seq }));
}

// THE PROJECTION IS INCREMENTAL (2026-09-27: re-projecting every entry on
// every call made a ledger of 10,000 entries take 230 s to hear — quadratic
// in its length, the wall a long work hits first). A log is immutable and
// append() carries its earlier entries over as the same objects, so the
// projection after an entry is remembered against that entry and a longer
// log folds only what came after the last entry already projected. Each
// projected task is frozen: a caller can read it, never edit the memory.
// The result is the same as projecting from scratch
// (tests/task-log-incremental.test.js checks it against the plain fold).
const projected = new WeakMap();   // last entry -> { byId, superseded, retracted }

export function projectTasks(log) {
  const entries = log.entries;
  let from = entries.length, state = null;
  while (from > 0) { state = projected.get(entries[from - 1]); if (state) break; from--; }
  const byId = new Map(state?.byId ?? []), superseded = new Set(state?.superseded ?? []), retracted = new Set(state?.retracted ?? []);
  for (let i = from; i < entries.length; i++) projectEntry(byId, superseded, retracted, entries[i]);
  if (entries.length && typeof entries[entries.length - 1] === "object") projected.set(entries[entries.length - 1], { byId, superseded, retracted });
  return [...byId.values()].filter((t) => !retracted.has(t.task_id) && !superseded.has(t.task_id)).sort((a,b) => a.first_seq - b.first_seq);
}

// ── progression: does a thread run the algebra backward? ─────────────────────
//
// CROSSED THE RATCHET 2026-08-29. The frozen provider carried these three as
// `isGrainProgression` / `isProductionOrder` / `checkCubeProgression`, and
// the-fold's grid.js and build-log.js both consume the third through an
// injected task-log bundle — the last two symbols standing between app.js and
// dropping its duplicate legacy import of this very module.
//
// Nothing is restated here. Both orderings are read off primitives this file
// ALREADY holds: GRAIN_RANK (built from cube.js's GRAINS) and OPERATOR_ORDER.
// The provider's version reached for a `validateChain` helper to answer a
// two-element question; the position comparison IS that answer, so the helper
// is not carried across with it.
//
// ADVISORY, exactly as it was: nothing here blocks an `append`. A flag is a
// report that a thread coarsened its grain or ran its operators backward —
// the caller decides what that is worth.

/** Did grain hold or deepen? `null` when either side is not a grain at all. */
export function isGrainProgression(priorGrain, nextGrain) {
  if (!GRAINS.includes(priorGrain) || !GRAINS.includes(nextGrain)) return null;
  return GRAIN_RANK[nextGrain] >= GRAIN_RANK[priorGrain];
}

/** Did the operators run forward along OPERATOR_ORDER? `null` if either is not current. */
export function isProductionOrder(priorOp, nextOp) {
  if (!isCurrentOperator(priorOp) || !isCurrentOperator(nextOp)) return null;
  return OPERATOR_ORDER.indexOf(nextOp) >= OPERATOR_ORDER.indexOf(priorOp);
}

// A thread follows `supersedes` across task_ids — the spiral link, distinct
// from `depends_on`'s lattice link. Cycle-guarded: a log that supersedes in a
// loop returns the entry it started from rather than spinning.
const threadRootOf = (task_id, supersedes) => {
  let current = task_id;
  const seen = new Set();
  while (supersedes.has(current) && !seen.has(current)) {
    seen.add(current);
    current = supersedes.get(current);
  }
  return current;
};

/**
 * Walk each thread's own entries in seq order and flag every step where grain
 * coarsened or production order reversed. Entries carrying no operator or no
 * grain are skipped — an untyped entry makes no algebraic claim to check.
 */
export function checkCubeProgression(log) {
  const supersedes = new Map();
  for (const e of log.entries) {
    if (e.kind === ENTRY_KINDS.SUPERSEDE && e.supersedes) supersedes.set(e.task_id, e.supersedes);
  }

  const byThread = new Map();
  for (const e of log.entries) {
    if (e.operator == null || e.grain == null) continue;
    const root = threadRootOf(e.task_id, supersedes);
    if (!byThread.has(root)) byThread.set(root, []);
    byThread.get(root).push(e);
  }

  const flags = [];
  for (const entries of byThread.values()) {
    for (let i = 1; i < entries.length; i++) {
      const prior = entries[i - 1];
      const next = entries[i];
      if (isGrainProgression(prior.grain, next.grain) === false)
        flags.push({ task_id: next.task_id, kind: "grain-coarsened", from: prior.grain, to: next.grain, atSeq: next.seq });
      if (prior.operator !== next.operator && isProductionOrder(prior.operator, next.operator) === false)
        flags.push({ task_id: next.task_id, kind: "production-order-reversed", from: prior.operator, to: next.operator, atSeq: next.seq });
    }
  }
  return flags;
}
