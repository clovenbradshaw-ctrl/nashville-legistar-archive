// kernel/fold.js — the fold: the transient projection of the log along the
// reader's chain (S78), a forward delta stream that retains nothing. THE
// WHEEL (native/docs/THE-WHEEL.md): this is the RIM — the Fold grain, the
// difference the being made on the next ground, an event never a state.

import { cellOf } from "./cube.js";

const STATES = new Set(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);
const emptyClasses = () => ({
  witnessed: [],
  provisional: [],
  expectations: [],
  obligations: [],
  exclusions: [],
  unresolvedAlternatives: [],
  activeFrames: [],
  receivedPriors: [],
  graphEntries: [],
  transformationObjects: [],
  transformationHistoryRefs: [],
});

/**
 * SEAL, DO NOT COPY (P158).
 *
 * `clone` was `structuredClone`, and it was defeating itself. Every entry
 * constructor in this tree already returns `Object.freeze({...})`; the clone
 * then produced a fresh, UNFROZEN deep copy of it. Measured on a 60 KB read:
 * of 6,307 entries in the fold, exactly ZERO were frozen — the freezing was
 * being undone at the door — and 3,370 `provenance` objects held **8 distinct
 * values**, so 3,362 of them were duplicate objects that could have been one
 * shared reference. The fold's graphEntries serialize to 10.6 MB and gzip to
 * 554 KB: **19.3x compressible**, almost all of it this duplication.
 *
 * The clone existed to stop a caller mutating what it had handed over.
 * Freezing gives that guarantee without the copy: nothing can be written, and
 * sub-objects shared between entries STAY shared instead of being multiplied.
 * One pass that marks, rather than a full deep copy that allocates.
 *
 * Cycles are handled (a seen-set), and a value already frozen is returned
 * untouched, so the common case costs one `Object.isFrozen` check.
 */
const sealed = new WeakSet();
const seal = (value) => {
  if (value === null || typeof value !== "object") return value;
  if (sealed.has(value)) return value;
  sealed.add(value);
  for (const v of Object.values(value)) seal(v);
  return Object.isFrozen(value) ? value : Object.freeze(value);
};
const clone = (value) => (value == null ? value : seal(value));
const copyFold = (fold) => ({ ...(fold ?? receivedGround()) });

export function receivedGround(seed = {}) {
  return {
    schema: "EOFold@1",
    sequence: 0,
    ...emptyClasses(),
    ...clone(seed),
  };
}

export function eoOperation({ id = null, op, grain, witness = null, consequence = null, inputs = [], outputs = [], payload = null, provenance = null }) {
  const cell = cellOf(op, grain);
  if (cell.gap) throw new TypeError(cell.reason);
  if (op === "NUL" && payload?.action) {
    throw new TypeError("NUL records no transformation and cannot carry a mutating payload");
  }
  return Object.freeze({
    schema: "EOOperation@1",
    id,
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence,
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    payload,
    // A5.1 (assemblies spec): every fold contribution carries its producer.
    // Optional and absent-when-unsupplied, so every existing operation —
    // and every byte-compared delta — is unchanged; stampDelta
    // (kernel/assembly.js) is the one place a producing assembly lands it.
    ...(provenance ? { provenance: Object.freeze({ ...provenance }) } : {}),
  });
}

export function deltaFold(operations = [], meta = {}) {
  return Object.freeze({
    schema: "DeltaFold@1",
    operations: Object.freeze([...operations]),
    ...meta,
  });
}

function upsertById(list = [], value) {
  const next = [...list];
  const i = value?.id == null ? -1 : next.findIndex((item) => item?.id === value.id);
  if (i >= 0) next[i] = { ...next[i], ...clone(value) };
  else next.push(clone(value));
  return next;
}

// ── the delta stream ────────────────────────────────────────────────────
// (P166) THE TIP IS EXTENDED IN PLACE; the log is what is immutable.
//
// `upsertManyById` did `const next = [...list]` on every call — one whole-
// array copy per observation per array, ~20.5M slots on a 240 KB read — and
// the delta record it kept pointed BACKWARD (`childArray -> { prev, ... }`),
// so the tip held every intermediate array alive through a WeakMap value:
// the O(n²) was resident memory, not only copy time. And `POSITIONS` already
// said the truth out loud: "linear chain: steal, extend, hand to the child".
// The index was transient; only the array was still being copied.
//
// TRANSIENCE IS DECLARED BY THE CALLER THAT OWNS THE CHAIN, never inferred
// from the array. `applyObservation` and `applyDelta` are public and PURE by
// default — tests/identity-revision.test.js holds `fold1`, applies a delta
// to get `fold2`, and reads `fold1` afterwards; that is a legitimate use of
// a pure function and it must keep working. The reader's own linear chain
// (reading.js) and `reconstruct` pass `{ transient: true }`, because they are
// the two places that never read a superseded fold: the reader drops
// `beforeFold` at the end of each step, `deriveRelease` reads only
// `obligations` (which stay copy-on-write through `upsertById`, and must —
// before/after is its whole question), and a superseded turn's `fold` is a
// projection of the log at that seq, not a retained object. The fold is
// state; the log is the record (P159). Same standing as `carry` and
// `minShare` elsewhere in this tree: declared, never defaulted.
//
// Under `transient`: an array this function CREATED is owned, and is
// extended in place. An array it did not create (a seed, a caller's own
// list, a pure result) is copied ONCE and the copy becomes owned. A frozen
// owned array (sealed as part of a value — pathological, but possible) falls
// back to the copy. Without `transient`: every call copies, as it always
// did, and the copy is NOT owned, so no later transient call can mutate it.
//
// The delta record now points FORWARD. Each owned array has a stream of
// nodes { appended, updated, next }; the array's record holds only the
// newest node; a view holds the node it last consumed. Old nodes are
// reachable from views alone, so the stream is collected from the front as
// views catch up — no history is retained by the array itself.
const STREAM = new WeakMap(); // ownedArray -> { tail: node }
const own = (array) => { STREAM.set(array, { tail: { appended: [], updated: [], next: null } }); return array; };
const advance = (array, appended, updated) => { const s = STREAM.get(array); const node = { appended, updated, next: null }; s.tail.next = node; s.tail = node; };
/** Whether the fold owns this array (created it, may extend it in place). Exported for the test that pins the invariant. */
export const isOwned = (array) => STREAM.has(array) && !Object.isFrozen(array);

/**
 * chainView(compute, foldStep) — a memoized view over the delta stream.
 * `compute(list)` builds state from scratch; `foldStep(state, delta)`
 * advances state by one delta and returns it, or null to demand a recompute
 * (e.g. an update it cannot fold exactly). Exactness is the contract: both
 * paths produce identical results, pinned by fold-transient.test.js.
 *
 * On a hit the view is at the array's tail and returns at once. Behind the
 * tail, it folds forward from the node it last consumed. A COPY (the once-
 * only copy of a foreign array, or a branch off a frozen tip) starts a new
 * stream and the view recomputes from scratch for it — copies are rare now,
 * and a from-scratch compute costs the same order as the copy that caused
 * it, so no state is carried across arrays and no path exists to get wrong.
 */
export function chainView(compute, foldStep) {
  const memo = new WeakMap(); // array -> { at: node | null, state }
  return (list) => {
    if (!Array.isArray(list)) return compute(list ?? []);
    const s = STREAM.get(list) ?? null;
    const hit = memo.get(list);
    if (hit && (s === null || hit.at === s.tail)) return hit.state;
    let state = null;
    if (hit && s !== null && hit.at) {
      state = hit.state;
      for (let node = hit.at.next; node && state != null; node = node.next) state = foldStep(state, node);
    }
    if (state == null) state = compute(list);
    memo.set(list, { at: s?.tail ?? null, state });
    return state;
  };
}

/** The fold's own id set, as a chain view — O(delta) per encounter. */
export const idSetOf = chainView(
  (list) => { const ids = new Set(); for (const e of list) if (e?.id != null) ids.add(e.id); return ids; },
  (ids, d) => { for (const e of d.appended) if (e?.id != null) ids.add(e.id); return ids; },
);

/** Entries of one schema, as a chain view — appended in place; any UPDATE
 * touching the schema demands the recompute path (exactness first). */
const bySchemaViews = new Map();
export function entriesBySchema(list, schema) {
  if (!bySchemaViews.has(schema)) {
    bySchemaViews.set(schema, chainView(
      (xs) => xs.filter((e) => e?.schema === schema),
      (arr, d) => {
        if (d.updated.some((e) => e?.schema === schema)) return null;
        for (const e of d.appended) if (e?.schema === schema) arr.push(e);
        return arr;
      },
    ));
  }
  return bySchemaViews.get(schema)(list);
}

const POSITIONS = new WeakMap(); // ownedArray -> Map(id -> position); positions never shift (append/replace-in-place only)

/** Under `transient`: the tip in place, or a once-only owned copy of what we did not create. Pure: an unowned copy. */
function tipOf(list, transient) {
  if (!transient) return [...list];
  if (isOwned(list)) return list;
  return own([...list]);
}

const isNoop = (current, value) => { for (const k in value) if (!(k in current) || current[k] !== value[k]) return false; return true; };

function upsertManyById(list = [], values = [], { transient = false } = {}) {
  if (!values.length) return list;
  const next = tipOf(list, transient);
  let index = POSITIONS.get(next);
  if (!index) {
    // A pure copy inherits its parent's index by COPY, never by theft: the
    // parent may be a reader's live tip, and taking its index would cost
    // that reader a rebuild on its next step.
    const parent = next === list ? null : POSITIONS.get(list);
    index = parent ? new Map(parent) : new Map();
    if (!parent) for (let i = 0; i < next.length; i += 1) if (next[i]?.id != null) index.set(next[i].id, i);
    POSITIONS.set(next, index);
  }
  const appended = [];
  const updated = [];
  for (const raw of values) {
    if (!raw) continue;
    const value = clone(raw);
    const id = value?.id;
    if (id != null && index.has(id)) {
      const i = index.get(id);
      // AN UPDATE THAT CHANGES NOTHING IS NOT AN UPDATE (2026-09-07). Measured
      // at 240 KB: 1,628 hyperedge "updates" on 1,166 sentences and 112
      // occurrence "updates" — revision.js re-admits this sentence's own
      // observation entries (the fold does not hold them yet at revise time),
      // so applyDelta upserted the very same object a second time. Every
      // schema view read that as an update and answered with an exact O(n)
      // recompute; at 480 KB the from-scratch lambdas grew 26x. When every
      // field of the value is already the current entry's own, the entry
      // stays, and nothing is recorded — the fold's bytes are identical
      // either way, and the views keep their state. A value that differs in
      // any field is an update, as before.
      const current = next[i];
      if (isNoop(current, value)) continue;
      next[i] = { ...current, ...value };
      updated.push(next[i]);
      continue;
    }
    if (id != null) index.set(id, next.length);
    next.push(value);
    appended.push(value);
  }
  if (isOwned(next)) advance(next, appended, updated);
  return next;
}

/** Append without an id index — `transformationHistoryRefs` is one string per delta and was copied whole per step too. */
function appendOwned(list = [], items = [], { transient = false } = {}) {
  if (!items.length) return list;
  const next = tipOf(list, transient);
  for (const item of items) next.push(item);
  if (isOwned(next)) advance(next, items, []);
  return next;
}

function removeById(list = [], id) {
  return id == null ? list : list.filter((item) => item?.id !== id);
}

function graphable(value) {
  return value?.id && value?.schema ? value : null;
}

export function applyObservation(fold, observation, { transient = false } = {}) {
  if (observation?.schema !== "Observation@1") throw new TypeError("applyObservation requires Observation@1");
  const next = copyFold(fold);
  // NOT ACCUMULATED (P159). `witnessed` held every Observation@1 the reading
  // ever made — 1,465 entries and 3.2 MB, 22% of the fold — and it is
  // VERBATIM the log's own Observation@1 entries, identical and in order
  // (measured). Nothing in the tree reads its contents: the only two readers
  // anywhere are eval/frankenstein.mjs:71 and :93, and both ask only for
  // `.length`.
  //
  // A count that the log can answer is not a reason to keep a second copy of
  // the log. The observations are still fully available — from the log, where
  // they already are — and `witnessed` stays present-but-empty so that a
  // caller reading it gets a truthful empty array rather than `undefined`.
  next.witnessed = next.witnessed ?? [];
  // THE OBSERVATION IS THE RECORD; ITS CHILDREN ARE THE STATE (P164).
  //
  // This line used to add the Observation@1 object ITSELF to graphEntries,
  // beside its own hyperedges and graphEntries. An Observation CONTAINS those
  // as nested arrays — so the fold held the parent, carrying copies of its
  // children, in the same array as the children. Measured: 6,603 of the
  // 10,261 objects nested inside Observations (64%) were also top-level
  // entries. That is the 2.7 MB "containment copy" of a 6.6 MB fold, and it
  // is the same defect as P159 step 1 — a record of an act being materialised
  // into an accumulation of the act's effects.
  //
  // Nothing reads an Observation@1 from graphEntries. The graph index takes
  // observations from the step (reading.js::observationGraph), revision.js
  // reads `observation.graphEntries` off the observation it is handed, and
  // the projection filters for referents and hyperedges. The observation
  // remains in the log, whole, where it was born and where it is the truth.
  const additions = [
    ...(observation.hyperedges ?? []),
    ...(observation.graphEntries ?? []),
  ].filter(graphable);
  next.graphEntries = upsertManyById(next.graphEntries ?? [], additions, { transient });
  return next;
}

function applyPayload(fold, operation) {
  if (operation.operator === "NUL") return [];
  const payload = operation.payload ?? {};
  switch (payload.action) {
    case "provisional":
      fold.provisional = upsertById(fold.provisional ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "expectation": {
      const value = payload.value ?? {};
      if (value.state && !STATES.has(value.state)) throw new TypeError(`unknown expectation state: ${value.state}`);
      fold.expectations = upsertById(fold.expectations ?? [], value);
      return [value].filter(graphable);
    }
    case "obligation":
      fold.obligations = upsertById(fold.obligations ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "exclusion":
      fold.exclusions = upsertById(fold.exclusions ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "alternative":
      fold.unresolvedAlternatives = upsertById(fold.unresolvedAlternatives ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "frame":
      fold.activeFrames = upsertById(fold.activeFrames ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "prior":
      fold.receivedPriors = upsertById(fold.receivedPriors ?? [], payload.value);
      return [];
    case "hyperedge":
    case "graph-object":
      return [payload.value].filter(graphable);
    case "resolve-obligation": {
      const existing = (fold.obligations ?? []).find((item) => item?.id === payload.id);
      const revised = existing ? {
        ...existing,
        status: payload.status ?? "resolved",
        resolvedAt: fold.sequence + 1,
        resolutionRefs: [...(existing.resolutionRefs ?? []), operation.id].filter(Boolean),
      } : null;
      if (!revised) return [];
      fold.obligations = upsertById(fold.obligations ?? [], revised);
      return [revised];
    }
    case "remove-provisional":
      fold.provisional = removeById(fold.provisional ?? [], payload.id);
      return [];
    default:
      return [];
  }
}

export function applyDelta(fold, delta, { transient = false } = {}) {
  if (delta?.schema !== "DeltaFold@1") throw new TypeError("applyDelta requires DeltaFold@1");
  const next = copyFold(fold);
  next.sequence = (next.sequence ?? 0) + 1;
  let opIndex = 0;
  const operations = [];
  const graphUpdates = [];
  for (const rawOperation of delta.operations ?? []) {
    if (rawOperation?.schema !== "EOOperation@1") throw new TypeError("DeltaFold contains a non-EO operation");
    if (rawOperation.operator === "NUL" && rawOperation.payload?.action) throw new TypeError("NUL cannot mutate Fold state");
    const operation = rawOperation.id ? rawOperation : { ...rawOperation, id: `${delta.id ?? `delta:${next.sequence}`}:op:${opIndex}` };
    opIndex += 1;
    operations.push(operation);
    graphUpdates.push(...applyPayload(next, operation));
  }
  // THE RECORD IS NOT THE STATE (P159).
  //
  // `transformationObjects` is the record of ACTS; `graphEntries` is the
  // accumulation of their EFFECTS. Operations were being written to both, so
  // 4,447 EOOperation@1 entries — about 30% of the fold — sat in graphEntries
  // as a second copy of a record the log already holds and this line holds
  // beside it.
  //
  // NUL is the sharpest case and the reason the distinction is not cosmetic.
  // `eoOperation` and the guard four lines above both refuse a NUL that
  // carries a mutating payload — "NUL records no transformation" — and
  // `graphable` then admitted it into graphEntries anyway. A
  // non-transformation was being materialised into an accumulation of
  // transformations. It is an act, so it belongs to the record; it has no
  // effect, so it has no place in the state.
  //
  // The graph INDEX is unaffected: reading.js already builds it from
  // graphEntries AND transformationObjects together, which is where the
  // duplication was visible from the other side.
  next.transformationObjects = upsertManyById(next.transformationObjects ?? [], operations, { transient });
  next.graphEntries = upsertManyById(next.graphEntries ?? [], graphUpdates.filter(graphable), { transient });
  const ref = delta.id ?? `delta:${next.sequence}`;
  next.transformationHistoryRefs = appendOwned(next.transformationHistoryRefs ?? [], [ref], { transient });
  return next;
}

export function reconstruct(entries = [], seed = {}) {
  // Its own chain, read by nobody until it returns: transient by construction.
  const transient = true;
  let fold = receivedGround(seed);
  for (const entry of entries) {
    if (entry?.schema === "EOFold@1") throw new TypeError("Fold snapshots are not append-log events");
    if (entry?.schema === "Observation@1") {
      fold = applyObservation(fold, entry, { transient });
      continue;
    }
    if (entry?.schema === "EOHyperedge@1") {
      const next = copyFold(fold);
      next.graphEntries = upsertManyById(next.graphEntries ?? [], [entry], { transient });
      fold = next;
      continue;
    }
    if (entry?.schema === "DeltaFold@1") fold = applyDelta(fold, entry, { transient });
  }
  return fold;
}
