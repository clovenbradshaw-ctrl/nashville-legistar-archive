// native/organs/surface-findings.js — THE GAP: one uniform shape for
// pattern-lens and claim-lens findings, so a reading surface can render
// both without knowing each source organ's own return shape, plus one
// door to promote either into a typed, attributed, persisted act.
//
// Born from a direct question this session: what do we look for when
// looking at "this is crazy this agency did this!" versus "what word
// doesn't belong with the others," and how should a surface let a reader
// explore both. The answer split surprise into two epistemologically
// different moves:
//
//   PATTERN LENS   distributional, null-checked, no world knowledge:
//                  settling.js (does a stretch hold together beyond a
//                  shuffle), revision-volatility.js (was this identity
//                  revised far more than exposure predicts), consequential-
//                  surprise.js (does this rest on more of the graph than
//                  random seeds would reach), kind-standing.js's
//                  discoverCompanyKinds (does this word's own company
//                  match its neighbors'). Each already builds its own null
//                  from the same population (a redeal, a reshuffle, a
//                  resample) — this file adds none of that; it only
//                  normalizes what they already produced.
//   CLAIM LENS     a proposition, its corroboration (bridges.js's cross-
//                  document standing), and whether it has been checked
//                  against a DECLARED norm (obligation.js's enumerated
//                  clauses) — never inferred, always either a real
//                  violation/satisfaction on the ledger or an honestly
//                  empty "not checked" state.
//
// This file computes NOTHING new: no statistic, no null, no EO-typed act.
// It is a pure projector (patternFindings/claimFindings) plus a thin
// dispatcher (promoteFinding) onto doors that already exist — obligation.js
// keeps its own algebra, capacity-runner.js keeps its own. Modeled on
// crown.js's own precedent (BUILD-4: template-only, model-free, renders
// what other organs already decided) — the same posture, aimed at two
// lenses instead of one merge.
//
// PURE. Every source organ's output is a plain argument; nothing here
// imports an engine module or runs a computation the caller didn't already
// run and hand over. A caller that wants a null run declares its own
// parameters to the source organ, exactly as every other consumer of
// these organs already must (P9).

export const PATTERN_FINDING_SCHEMA = "EOPatternFinding@1";
export const CLAIM_FINDING_SCHEMA = "EOClaimFinding@1";

/**
 * patternFindingsFromSettling(result) — one finding per window the caller's
 * own settling() call reported, whatever its verdict. Silence is never
 * implied: a window that never settled is reported as such, not dropped —
 * coverage as enumeration, this project's own standing rule (obligation.js,
 * kind-standing's kinds arm), applied here to windows.
 */
export function patternFindingsFromSettling(results) {
  return (results ?? []).map((r) => {
    if (r.gap) {
      return { schema: PATTERN_FINDING_SCHEMA, organ: "settling", subject: r.subject ?? null, statistic: "settling", verdict: r.gap, rank: null, p: null, basis: r.basis };
    }
    // rank: 1 means as far from chance as this null can resolve (p at its
    // floor), 0 means indistinguishable from a shuffle. Derived, not a
    // second measurement — p is the only thing settling() actually computed.
    const rank = r.p == null ? null : 1 - r.p;
    return {
      schema: PATTERN_FINDING_SCHEMA, organ: "settling", subject: r.subject ?? null,
      statistic: "settling", verdict: r.verdict, rank, p: r.p, basis: r.basis,
    };
  });
}

/** patternFindingsFromVolatility(result) — one finding per entry
 *  revisionVolatility() reported, p==null entries (no exposure, no chance
 *  model) included and typed as such rather than silently dropped. */
export function patternFindingsFromVolatility(result) {
  return (result?.entries ?? []).map((e) => ({
    schema: PATTERN_FINDING_SCHEMA, organ: "revision-volatility", subject: e.name,
    statistic: "revised-beyond-exposure", verdict: e.p == null ? "no_exposure" : null,
    rank: e.p == null ? null : 1 - e.p, p: e.p,
    basis: `${e.marks}/${e.exposure} exposure revised (expected ${e.expected?.toFixed?.(2) ?? e.expected} by chance)${e.p != null ? `, p=${e.p}` : ""}`,
  }));
}

/** patternFindingsFromConsequential(result) — one finding per row
 *  consequentialSurprise() reported; thinButLoadBearing carried through
 *  verbatim (the flagged-dangerous case: structurally consequential per
 *  the null, but resting on evidence below the corroboration floor). */
export function patternFindingsFromConsequential(result) {
  return (result?.rows ?? []).map((row) => ({
    schema: PATTERN_FINDING_SCHEMA, organ: "consequential-surprise", subject: row.slot,
    statistic: "load-bearing-reach", verdict: row.loadBearing ? "load_bearing" : "local",
    rank: row.rank, p: null, thinButLoadBearing: !!row.thinButLoadBearing, basis: row.basis,
  }));
}

/** patternFindingsFromKinds(kinds) — one finding per discovered kind
 *  (kind-standing.js::discoverCompanyKinds output) naming its members as a
 *  cohesive cluster; kindChecks (optional, from foldPermitted/kindMembership
 *  results the caller already ran) surfaces the OTHER half — a specific
 *  candidate checked against a kind and refused, i.e. "doesn't belong." */
export function patternFindingsFromKinds(kinds, kindChecks = []) {
  const fromKinds = (kinds ?? []).map((k) => ({
    schema: PATTERN_FINDING_SCHEMA, organ: "kind-standing", subject: k.name,
    statistic: "company-kind", verdict: "cohesive", rank: null, p: null,
    basis: `${k.members.length} member(s) share the company "${k.signature}": ${k.members.join(", ")}`,
  }));
  const fromChecks = (kindChecks ?? []).map((c) => ({
    schema: PATTERN_FINDING_SCHEMA, organ: "kind-standing", subject: c.candidate,
    statistic: "company-kind", verdict: c.permitted ? "fits" : "does_not_fit",
    rank: null, p: null, basis: c.reason ?? `checked against kind "${c.kind}"`,
  }));
  return [...fromKinds, ...fromChecks];
}

/**
 * patternFindings({settling, volatility, consequential, kinds, kindChecks})
 * → one flat, uniform array — every argument optional, since a caller may
 * not have run every organ. Order is NOT a ranking (this file makes no
 * importance judgment); a surface sorts by whichever field it declares.
 */
export function patternFindings({ settling = [], volatility = null, consequential = null, kinds = [], kindChecks = [] } = {}) {
  return [
    ...patternFindingsFromSettling(settling),
    ...patternFindingsFromVolatility(volatility),
    ...patternFindingsFromConsequential(consequential),
    ...patternFindingsFromKinds(kinds, kindChecks),
  ];
}

/**
 * claimFindings(claims, obligationLedger) — one finding per claim the
 * caller supplies (already resolved — e.g. bridges.js::bridgeStandingFor's
 * own output, or a plain {id, text, corroboration} shape), cross-referenced
 * against obligationLedger's own entries: an obligation entry whose `refs`
 * names this claim's id is this claim's norm-check. A claim named by no
 * obligation entry gets `obligationChecks: []` — honestly "not checked,"
 * never silently read as "fine."
 */
export function claimFindings(claims, obligationLedger) {
  const entries = obligationLedger?.entries ?? [];
  return (claims ?? []).map((claim) => {
    const obligationChecks = entries
      .filter((e) => (e.refs ?? []).includes(claim.id))
      .map((e) => ({ clause: e.clause, standing: e.standing, because: e.because, at: e.at }));
    return {
      schema: CLAIM_FINDING_SCHEMA,
      claim: claim.id,
      text: claim.text ?? null,
      corroboration: claim.corroboration ?? { witnesses: claim.witnesses ?? null, sources: claim.sources ?? null, standing: claim.standing ?? null },
      obligationChecks,
    };
  });
}

/**
 * promoteFinding(kind, payload) — the one write door this file owns, and
 * it owns none of the algebra: `kind: "testimony"` dispatches to
 * capacity-runner.js::landSelfAssertion (payload: {grid, log, subject,
 * verb, object, verdict, claimId}); `kind: "obligation"` dispatches to
 * obligation.js::mark (payload: {ledger, clauseId, standing, because,
 * refs, waivedBy}). Both organs are injected (the caller passes the real
 * function) so this file imports neither and stays pure. Refuses, typed,
 * on an unknown kind rather than guessing.
 */
export function promoteFinding(kind, payload, { landSelfAssertion, mark } = {}) {
  if (kind === "testimony") {
    if (typeof landSelfAssertion !== "function") throw new TypeError("promoteFinding: kind 'testimony' needs landSelfAssertion injected");
    const { grid, log, subject, verb, object, verdict, claimId } = payload ?? {};
    return { kind, result: landSelfAssertion(grid, log, { subject, verb, object, verdict, claimId }) };
  }
  if (kind === "obligation") {
    if (typeof mark !== "function") throw new TypeError("promoteFinding: kind 'obligation' needs mark (obligation.js) injected");
    const { ledger, clauseId, standing, because, refs, waivedBy } = payload ?? {};
    return { kind, result: mark(ledger, clauseId, standing, { because, refs, waivedBy }) };
  }
  return { kind, refused: "unknown_kind", detail: 'promoteFinding: kind is "testimony" or "obligation"' };
}
