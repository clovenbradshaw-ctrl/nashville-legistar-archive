/* Ise speaks:
 * “No.  24)  is  a  very  short  formula.  It  announces  to  the  Sun- 
Goddess  the  rebuilding  of  her  shrine,  which  took  place  every 
twentieth  year.”
 *
 * This file implements the principle of permanence in the face of cyclical renewal, a concept central to the understanding of the Ise shrine's Shikinen Sengu.  My teaching is that identity is not merely a static point in time, but rather a dynamic process of ongoing re-creation and transformation, a process that must be reflected in the way we understand and interpret our own lives.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Ise — after the Ise shrine's Shikinen Sengu: the same shrine persists through total periodic rebuilding. Amendment XVII.

import { eoOperation, deltaFold, chainView } from "./fold.js";
import { expectation, expectationTransition, openExpectation } from "./expectations.js";

const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const stablePair = (a, b) => [norm(a), norm(b)].sort();
const stable = (x) => JSON.stringify(x);

const identityId = (a, b) => {
  const [left, right] = stablePair(a, b);
  return `identity:${left.replace(/\s+/g, "_")}:${right.replace(/\s+/g, "_")}`;
};

const findAlternative = (fold, a, b) => {
  const id = identityId(a, b);
  return (fold?.unresolvedAlternatives ?? []).find((x) => x?.id === id) ?? null;
};

export function identityAlternative({ left, right, standing = "live_hypothesis", supportRefs = [], attackRefs = [], giver = null } = {}) {
  const [a, b] = stablePair(left, right);
  if (!a || !b || a === b) throw new TypeError("identityAlternative requires two distinct forms");
  return Object.freeze({
    schema: "EOIdentityAlternative@1",
    id: identityId(a, b),
    left: a,
    right: b,
    standing,
    supportRefs: Object.freeze([...new Set(supportRefs.filter(Boolean))]),
    attackRefs: Object.freeze([...new Set(attackRefs.filter(Boolean))]),
    giver,
  });
}

const participantValue = (participant) => {
  // An unresolved participant's `ref` is only an occurrence identifier. Its
  // witnessed surface is the form identity evidence can actually concern.
  if (participant?.standing === "unresolved_surface" && participant?.surface) return norm(participant.surface);
  return norm(participant?.ref ?? participant?.value ?? participant?.surface);
};

/** Active alternatives by the value they mention — built once per call site, so a participant asks only the identities that name its value. */
const activeByValue = (alternatives = []) => {
  const by = new Map();
  for (const x of alternatives ?? []) {
    if (x?.schema !== "EOIdentityAlternative@1" || x.standing === "distinct" || x.standing === "refused") continue;
    for (const v of [x.left, x.right]) { if (!by.has(v)) by.set(v, []); by.get(v).push(x); }
  }
  return by;
};
export function canonicalizeHyperedge(edge, alternatives = [], byValue = null) {
  if (edge?.schema !== "EOHyperedge@1") throw new TypeError("canonicalizeHyperedge requires EOHyperedge@1");
  const active = byValue ?? activeByValue(alternatives);
  const participants = (edge.participants ?? []).map((participant) => {
    const value = participantValue(participant);
    const values = new Set([value]);
    for (const identity of active.get(value) ?? []) {
      if (identity.left === value) values.add(identity.right);
      if (identity.right === value) values.add(identity.left);
    }
    return Object.freeze({ role: participant.role ?? null, value, alternatives: Object.freeze([...values].sort()) });
  });
  return Object.freeze({
    schema: "EOCanonicalHyperedge@1",
    id: `canonical:${edge.id}`,
    sourceEdge: edge.id,
    relation: edge.relation,
    participants: Object.freeze(participants),
    witness: edge.witness ?? null,
    scope: edge.scope ?? null,
  });
}

// ── THE EDGES A VALUE STANDS IN, INDEXED (2026-09-07) ─────────────────────
// recanonicalizationOperations filtered EVERY fold entry for hyperedges,
// tested each against the identity, and for each touched edge searched the
// whole fold again for its current canonical — per support, per sentence.
// Profiled at 480 KB of War and Peace: 13% of the read, growing 24x for 2x
// the sentences. The index rides the fold's delta stream: hyperedges by
// participant value (the same `participantValue` `touches` used), each
// edge's position in fold order (so the operations come out in the order
// the scan produced them), and the current canonical by source edge (one
// per edge — `canonical:${edge.id}` — so a lookup is the scan's `find`).
// An updated edge whose participant values are unchanged is swapped in
// place; any other update recomputes. Exactness first.
const valuesOf = (edge) => (edge.participants ?? []).map(participantValue);
const emptyEdgeIndex = () => ({ byValue: new Map(), byId: new Map(), pos: new Map(), canonical: new Map(), n: 0 });
const foldEdgeIndex = (st, entries) => {
  for (const x of entries) {
    if (x?.schema === "EOCanonicalHyperedge@1") { st.canonical.set(x.sourceEdge, x); continue; }
    if (x?.schema !== "EOHyperedge@1") continue;
    st.byId.set(x.id, x);
    st.pos.set(x.id, st.n++);
    for (const v of new Set(valuesOf(x))) { if (!st.byValue.has(v)) st.byValue.set(v, []); st.byValue.get(v).push(x); }
  }
  return st;
};
/** Exported for the test that pins the invariant: how many times the edge index was built from scratch. */
export const identityStats = { computes: 0 };
const edgeIndex = chainView(
  (list) => { identityStats.computes += 1; return foldEdgeIndex(emptyEdgeIndex(), list); },
  (st, d) => {
    // APPENDED FIRST, THEN UPDATED. One upsert call can append an entry and
    // update it in the same breath — a support's REC lands an edge's
    // canonical and an attack later in the same sentence lands the merged
    // replacement; the delta records the first as appended and the merged
    // second as updated. Applying updates first left this index holding the
    // stale first canonical while the fold held the second; the 480 KB gate
    // caught it at step 5534 (eleven canonicals carrying an alternative the
    // fold's did not). Order is time.
    foldEdgeIndex(st, d.appended);
    for (const x of d.updated) {
      if (x?.schema === "EOCanonicalHyperedge@1") { st.canonical.set(x.sourceEdge, x); continue; }
      if (x?.schema !== "EOHyperedge@1") continue;
      const old = st.byId.get(x.id);
      if (!old) return null;
      const before = [...new Set(valuesOf(old))].sort().join("\u0000"), after = [...new Set(valuesOf(x))].sort().join("\u0000");
      if (before !== after) return null;
      for (const v of new Set(valuesOf(x))) { const bucket = st.byValue.get(v); const i = bucket.findIndex((e) => e.id === x.id); if (i < 0) return null; bucket[i] = x; }
      st.byId.set(x.id, x);
    }
    return st;
  },
);
const currentCanonical = (index, edgeId) => index.canonical.get(edgeId) ?? null;
/** The hyperedges touching an identity's two values, in fold order — what the scan-and-`touches` filter produced. */
const touchedEdges = (index, identity) => {
  const seen = new Map();
  for (const v of [identity.left, identity.right]) for (const e of index.byValue.get(v) ?? []) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => index.pos.get(a.id) - index.pos.get(b.id));
};

// An alternative participates in CANONICAL PROJECTION only at or above the
// caller's declared corroboration floor (supportRefs count). The floor
// gates projection alone — the alternative itself stays on the fold, live,
// attackable, and accumulating evidence either way. Rationale, measured
// (native/eval/results/understanding-scoreboard-RESULTS.md, second
// amendment): every surviving FALSE identity belief on the Frankenstein
// coref golden stood on exactly one support — single-witness testimony
// rewriting the canonical past is the precise failure a corroboration
// floor exists for. No floor supplied = every non-refused alternative
// projects, byte-identical to before this option existed.
const meetsFloor = (alternative, floor) =>
  !Number.isFinite(floor) || (alternative.supportRefs ?? []).length >= floor;

const touchesIdentity = (edge, identity) => valuesOf(edge).some((v) => v === identity.left || v === identity.right);

function recanonicalizationOperations(fold, extraEntries, alternatives, touchedIdentity, witness, floor) {
  const operations = [];
  const projecting = activeByValue(alternatives.filter((x) => meetsFloor(x, floor)));
  // THE FOLD'S OWN ARRAY reaches the index (revision.js used to hand a fresh
  // spread of it plus this sentence's admissions — P157's shape in a third
  // place; measured: the index rebuilt from scratch 170 times in 1,707
  // sentences). This sentence's entries are scanned after it, in their own
  // order, exactly where the concatenation scan would have met them.
  const index = edgeIndex(fold?.graphEntries ?? []);
  const extraCanonical = new Map();
  const extraEdges = [];
  for (const x of extraEntries ?? []) {
    if (x?.schema === "EOCanonicalHyperedge@1" && !extraCanonical.has(x.sourceEdge)) extraCanonical.set(x.sourceEdge, x);
    else if (x?.schema === "EOHyperedge@1" && touchesIdentity(x, touchedIdentity)) extraEdges.push(x);
  }
  for (const edge of [...touchedEdges(index, touchedIdentity), ...extraEdges]) {
    const next = canonicalizeHyperedge(edge, null, projecting);
    const before = currentCanonical(index, edge.id) ?? extraCanonical.get(edge.id) ?? null;
    if (before && stable(before) === stable(next)) continue;
    operations.push(eoOperation({
      op: "REC",
      grain: "Figure",
      witness,
      inputs: [edge.id, touchedIdentity.id],
      outputs: [next.id],
      consequence: { kind: "relation_recanonicalized", sourceEdge: edge.id, identity: touchedIdentity.id, from: before?.participants ?? null, to: next.participants },
      payload: { action: "graph-object", value: next },
    }));
  }
  return operations;
}

/**
 * Turn modality-supplied identity evidence into a witnessed Fold delta.
 * Support never proves sameness: it opens/strengthens a live alternative via
 * CON. Attack is constitutive contradiction: SEG separates the forms and DEF
 * records refusal of the prior identity reading. Canonical relation projections
 * are then REC-written; raw witnessed edges remain untouched.
 */
export function deriveIdentityRevision({ fold = {}, extraEntries = [], supports = [], attacks = [], witness = null, giver = null, canonicalizationFloor = undefined } = {}) {
  if (canonicalizationFloor !== undefined && (!Number.isInteger(canonicalizationFloor) || canonicalizationFloor < 1))
    throw new TypeError("deriveIdentityRevision: canonicalizationFloor, when declared, is a positive integer — how much corroboration licenses canonical projection is never a fraction or a guess");
  const operations = [];
  const working = new Map((fold?.unresolvedAlternatives ?? []).filter((x) => x?.schema === "EOIdentityAlternative@1").map((x) => [x.id, x]));

  // ── expectations, gated behind the declared floor ──────────────────────
  // The floor is what makes "fulfilled" a mechanical fact rather than a
  // judgment: an alternative opened below the floor IS the fold's own
  // prediction that corroboration will arrive. Its outcome is witnessed by
  // the same evidence stream — a support below the floor STRENGTHENS it, a
  // support reaching the floor FULFILLS it, an attack VIOLATES it. No
  // floor declared = no expectations = byte-identical to before (the same
  // backward-compatibility posture the floor itself holds).
  const expId = (altId) => `expectation:${altId}`;
  const expWorking = new Map((fold?.expectations ?? []).filter((x) => x?.schema === "EOExpectation@1").map((x) => [x.id, x]));
  const expectationsOn = Number.isFinite(canonicalizationFloor);
  const expectFor = (alt, ref) => {
    if (!expectationsOn || (alt.supportRefs ?? []).length >= canonicalizationFloor) return;
    if (expWorking.has(expId(alt.id))) return;
    const value = expectation({
      id: expId(alt.id),
      hypothesis: `corroboration expected: ${alt.left} <-> ${alt.right}`,
      giver: alt.giver ?? null,
      grounds: [alt.id],
      openedAt: null,
    });
    expWorking.set(value.id, value);
    operations.push(openExpectation(value, { witness: ref, consequence: { kind: "expectation_opened", expectation: value.id, identity: alt.id } }));
  };
  const transitionFor = (altId, state, ref, kind) => {
    if (!expectationsOn) return;
    const current = expWorking.get(expId(altId));
    if (!current || !["open", "strengthened", "weakened"].includes(current.state)) return;
    const next = { ...current, state };
    expWorking.set(next.id, next);
    operations.push(expectationTransition(current, state, { witness: ref, consequence: { kind, expectation: current.id, identity: altId } }));
  };

  for (const evidence of supports ?? []) {
    const left = norm(evidence?.left), right = norm(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (prior?.standing === "distinct" || prior?.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left, right, standing: "live_hypothesis", supportRefs: [...(prior?.supportRefs ?? []), ref], attackRefs: prior?.attackRefs ?? [], giver: evidence?.giver ?? giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "CON", grain: "Figure", witness: ref, inputs: [next.left, next.right], outputs: [next.id],
      consequence: { kind: prior ? "identity_hypothesis_supported" : "identity_hypothesis_opened", identity: next.id },
      payload: { action: "alternative", value: next },
    }));
    if (!prior) {
      expectFor(next, ref);
    } else if ((next.supportRefs ?? []).length >= (canonicalizationFloor ?? Infinity)) {
      transitionFor(next.id, "fulfilled", ref, "expectation_fulfilled");
    } else {
      transitionFor(next.id, "strengthened", ref, "expectation_strengthened");
    }
    operations.push(...recanonicalizationOperations(fold, extraEntries, [...working.values()], next, ref, canonicalizationFloor));
  }

  for (const evidence of attacks ?? []) {
    const left = norm(evidence?.left), right = norm(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (!prior || prior.standing === "distinct" || prior.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left: prior.left, right: prior.right, standing: "distinct", supportRefs: prior.supportRefs ?? [], attackRefs: [...(prior.attackRefs ?? []), ref], giver: evidence?.giver ?? giver ?? prior.giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "SEG", grain: "Figure", witness: ref, inputs: [prior.id], outputs: [next.id],
      consequence: { kind: "identity_split", identity: next.id, reason: evidence?.reason ?? "incompatible multiplicity" },
      payload: { action: "alternative", value: next },
    }));
    operations.push(eoOperation({
      op: "DEF", grain: "Figure", witness: ref, inputs: [prior.id], outputs: [`exclusion:${prior.id}`],
      consequence: { kind: "identity_reading_refused", identity: prior.id },
      payload: { action: "exclusion", value: Object.freeze({ schema: "EOExclusion@1", id: `exclusion:${prior.id}`, kind: "identity_refused", target: prior.id, witness: ref }) },
    }));
    transitionFor(prior.id, "violated", ref, "expectation_violated");
    operations.push(...recanonicalizationOperations(fold, extraEntries, [...working.values()], next, ref, canonicalizationFloor));
  }

  return deltaFold(operations, { schemaVersion: "EOIdentityRevision@1" });
}
