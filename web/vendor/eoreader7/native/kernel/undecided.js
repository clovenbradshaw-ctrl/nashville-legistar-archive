// native/kernel/undecided.js — A READING THAT HAS NOT COLLAPSED (2026-09-28).
// Medium-blind, kernel-level. Standing: nomination.
//
// User direction, verbatim: "Are we putting things too much into discrete
// buckets rather than using physics, putting things into a superposition
// until they collapse at a certain reading at a for whom somewhere?" — and
// then: "this shouldn't be just in a small part of the pipeline but
// everywhere where it makes something better."
//
// The identity organ already lives this way (EOIdentityAlternative@1 in
// fold.unresolvedAlternatives: live_hypothesis / distinct / refused, with
// expectations gated by a corroboration floor; contest.js::adjudicate hands
// back the contested set rather than a winner). Nothing else does: the
// surface extractor vetoes, the pronoun binder drops what fell below its
// floor, the occupancy reader kept one mention and typed the rest as
// refusals. Each of those threw away evidence at read time with no for-whom
// in the room. This is the ONE shape they emit instead, and the ONE act
// that collapses it.
//
//   undecided(...)   a slot, its candidates, each candidate's evidence as
//                    named features, the cursor it was read at, the giver.
//                    Standing "open". Frozen. Content-addressed id, so the
//                    same reading of the same slot is the same record.
//   collapse(...)    EVA at a cursor, FOR a for-whom, under a NAMED rule —
//                    a separate, appended record that points at the
//                    undecided one. Verdicts: chosen / contested / none.
//                    Never mutates. A later for-whom, or a later rule, may
//                    collapse the same record differently; both stand.
//   standingOf(...)  the latest collapse for a for-whom, else "open".
//
// THE SECOND HALF OF THE PHYSICS. A superposition with no measurement rule
// is a bag of maybes. What makes a collapse honest is what performs it: a
// declared rule with its giver, a cursor, a for-whom. The wall moves from
// the record to the mouth — every candidate is kept; an uncollapsed
// candidate is never asserted. A rule may reuse contest.js's adjudicate
// (declared floors and margins) over scored candidates; a rule that is a
// plain predicate declares itself as one.
//
// Nothing here names a medium: candidates are opaque values, features are
// opaque keys. The test scans this body for medium words.

const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

export const UNDECIDED_SCHEMA = "EOUndecided@1";
export const COLLAPSE_SCHEMA = "EOCollapse@1";
export const COLLAPSE_VERDICTS = Object.freeze({ CHOSEN: "chosen", CONTESTED: "contested", NONE: "none" });

/**
 * undecided({ question, slot, candidates, cursor, giver, at })
 *   candidates: [{ value, via, features }] — `features` is a flat object of
 *   named evidence (numbers, booleans, strings); nothing is scored here.
 */
export function undecided({ question, slot, candidates, cursor, giver, at = null } = {}) {
  if (!question || !slot) throw new TypeError("undecided: question and slot are declared");
  if (!giver) throw new TypeError("undecided: a giver is declared — an undecided reading with no giver is a rumour");
  if (!Array.isArray(candidates)) throw new TypeError("undecided: candidates is an array (possibly empty)");
  const cs = candidates.map((c, i) => Object.freeze({ index: i, value: c.value, via: c.via ?? null, features: Object.freeze({ ...(c.features ?? {}) }) }));
  const body = { schema: UNDECIDED_SCHEMA, question, slot, candidates: cs, cursor: cursor ?? null, at, giver, standing: "open" };
  return Object.freeze({ id: `undecided:${fnv(canon({ question, slot, candidates: cs, at }))}`, ...body, candidates: Object.freeze(cs) });
}

/**
 * collapse(record, { forWhom, rule, cursor })
 *   rule: { name, giver, decide(candidates, record) -> { chosen?: index|null, contested?: index[], reason? } }
 *   A rule that returns no `chosen` and no `contested` collapses to NONE.
 */
export function collapse(record, { forWhom, rule, cursor = null } = {}) {
  if (record?.schema !== UNDECIDED_SCHEMA) throw new TypeError("collapse: an EOUndecided@1 record");
  if (!forWhom?.id) throw new TypeError("collapse: a for-whom with an id — a collapse nobody performed did not happen");
  if (!rule?.name || !rule?.giver || typeof rule.decide !== "function") throw new TypeError("collapse: a rule with a name, a giver and decide()");
  const out = rule.decide(record.candidates, record) ?? {};
  const contested = Array.isArray(out.contested) ? out.contested.filter((i) => Number.isInteger(i) && record.candidates[i]) : [];
  const chosen = Number.isInteger(out.chosen) && record.candidates[out.chosen] ? out.chosen : null;
  const verdict = chosen !== null ? COLLAPSE_VERDICTS.CHOSEN : contested.length ? COLLAPSE_VERDICTS.CONTESTED : COLLAPSE_VERDICTS.NONE;
  const body = { schema: COLLAPSE_SCHEMA, of: record.id, forWhom: forWhom.id, cursor, rule: { name: rule.name, giver: rule.giver, params: rule.params ?? null }, verdict, chosen: chosen !== null ? record.candidates[chosen] : null, contested: Object.freeze(contested.map((i) => record.candidates[i])), reason: out.reason ?? null };
  return Object.freeze({ id: `collapse:${fnv(canon({ of: record.id, forWhom: forWhom.id, cursor, rule: body.rule }))}`, ...body });
}

/** The latest collapse of `record` performed for `forWhom`, else "open". */
export function standingOf(record, collapses = [], forWhom = null) {
  const mine = collapses.filter((c) => c?.schema === COLLAPSE_SCHEMA && c.of === record?.id && (!forWhom || c.forWhom === forWhom.id));
  if (!mine.length) return { standing: "open", collapse: null };
  const last = mine[mine.length - 1];
  return { standing: last.verdict, collapse: last };
}

/**
 * contestRule({ score, minActivation, minMargin, contestedMargin, adjudicate, giver })
 *   A collapse rule built on contest.js's adjudicate: `score(candidate)` maps a
 *   candidate to its activation; co-presence is every other candidate. The
 *   floors are the caller's (P4).
 */
export function contestRule({ score, minActivation, minMargin, contestedMargin, adjudicate, giver, name = "contest" } = {}) {
  if (typeof score !== "function" || typeof adjudicate !== "function") throw new TypeError("contestRule: score() and adjudicate are injected");
  return {
    name, giver, params: { minActivation, minMargin, contestedMargin },
    decide(candidates) {
      const scores = new Map(candidates.map((c) => [String(c.index), score(c)]));
      const r = adjudicate({ scores, coPresent: new Set(candidates.map((c) => String(c.index))), minActivation, minMargin, contestedMargin });
      if (r.verdict === "bound" && r.id != null) return { chosen: Number(r.id), reason: r.verdict };
      const contested = r.contested?.length && r.verdict !== "no_candidate" ? candidates.map((c) => c.index) : [];
      return { contested: r.verdict === "below_floor" || r.verdict === "no_candidate" ? [] : contested, reason: r.verdict };
    },
  };
}

// ── landing on the fold ─────────────────────────────────────────────────────
// An undecided reading and its collapses PERSIST in the fold's own
// `unresolvedAlternatives` slot (the same slot EOIdentityAlternative@1 already
// rides in), as ordinary DeltaFold operations: opening a slot is a mark on the
// ground that something is there and not yet decided — SIG·Ground, the Void
// terrain (NUL cannot carry a payload, and rightly: nothing is recorded by an
// absence); a collapse is EVA·Figure, a judgment at a cursor for a for-whom.
// Replayed by reconstruct() like everything else; `openSlots` and
// `standingOf` read the standing back per for-whom, so a later for-whom, or
// a later rule, re-collapses on the fly with the past whole.

/** The operation that lands an undecided record; `eoOperation` is injected so this file imports no fold. */
export function undecidedOperation(record, { eoOperation, witness = null } = {}) {
  if (record?.schema !== UNDECIDED_SCHEMA) throw new TypeError("undecidedOperation: an EOUndecided@1 record");
  if (typeof eoOperation !== "function") throw new TypeError("undecidedOperation: eoOperation is injected");
  return eoOperation({ op: "SIG", grain: "Ground", witness, inputs: [], outputs: [record.id], consequence: { kind: "slot_opened", slot: record.slot, question: record.question, candidates: record.candidates.length }, payload: { action: "alternative", value: record } });
}

/** The operation that lands a collapse; the undecided record is its input, never rewritten. */
export function collapseOperation(c, { eoOperation, witness = null } = {}) {
  if (c?.schema !== COLLAPSE_SCHEMA) throw new TypeError("collapseOperation: an EOCollapse@1 record");
  if (typeof eoOperation !== "function") throw new TypeError("collapseOperation: eoOperation is injected");
  return eoOperation({ op: "EVA", grain: "Figure", witness, inputs: [c.of], outputs: [c.id], consequence: { kind: "slot_collapsed", of: c.of, forWhom: c.forWhom, verdict: c.verdict, rule: c.rule.name }, payload: { action: "alternative", value: c } });
}

/** Every undecided record on a fold, each with its standing for `forWhom` (or "open"). */
export function openSlots(fold, forWhom = null) {
  const all = fold?.unresolvedAlternatives ?? [];
  const collapses = all.filter((x) => x?.schema === COLLAPSE_SCHEMA);
  return all.filter((x) => x?.schema === UNDECIDED_SCHEMA).map((r) => ({ record: r, ...standingOf(r, collapses, forWhom) }));
}
