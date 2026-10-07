// native/organs/search-terms.js — Structure Search's own capacities.js: a
// small, typed registry naming each semantic search term designed this
// session, so a caller can resolve a plain-language term to its real
// module/fn/cube-cell instead of trusting a UI label. REFERENCE-ONLY, like
// most of capacities.js's own rows — this file follows that file's stated
// discipline verbatim: naming a term here is not the same as running it.
// Running one still means the caller imports the real module themselves,
// exactly as surface-findings.js::promoteFinding and
// target-resolve.js::shapeMatch already require for their own doors.
//
// `family` is PERTURBATION / PREDICTION / DEDUCTION — THE-CORE-MECHANISM.md's
// own three, named by what the observed is compared against, never invented
// here — or STRUCTURAL for the two organs that are neither: contextuality.js
// and dmd.js are each exact, no null, a structural fact of the data (both
// files' own words).
//
// clusters: is routed to kind-standing.js, NOT kind-induction.js, though
// capacities.js itself registers kind-induction.js::projectKinds at the
// same cell (SIG.Kind) and kind-standing.js is not in that table at all —
// disclosed, not smoothed over. The obvious choice was kind-induction.js;
// THE-CORE-MECHANISM.md names that organ's own basin null as one of only
// three named project errors ("tried to answer membership by simulation,
// and the simulation was degenerate"). kind-standing.js answers the same
// question by measuring the real population instead — the same document
// calls that stronger, not weaker. Routing here follows the postmortem,
// not the registry.
//
// Two rows (reframed-by, missing) name a sibling repo's module (the-fold's
// void-loop.js), never an eoreader7-native path — disclosed the same way
// capacities.js discloses its own non-native rows, not silently implied
// native.

export const TERM_SCHEMA = "EOSearchTerm@1";

export const SEARCH_TERMS = Object.freeze([
  Object.freeze({
    id: "holds", family: "PERTURBATION", cell: "NUL.Kind",
    module: "native/kernel/settling.js", fn: "settling",
    question: "did this regime hold together, or when did it break?",
  }),
  Object.freeze({
    id: "fits", family: "PERTURBATION", cell: "NUL.Kind",
    module: "native/kernel/entity-kind-induction.js", fn: "testKindMembers",
    question: "does this one candidate survive a declared-membership challenge?",
  }),
  Object.freeze({
    id: "clusters", family: "PERTURBATION", cell: "SIG.Kind",
    module: "native/organs/kind-standing.js", fn: "discoverCompanyKinds",
    question: "what groups cohere on their own, measured against the real population?",
    note: "not kind-induction.js::projectKinds — see file header",
  }),
  Object.freeze({
    id: "reversed", family: "PERTURBATION", cell: "CON.Network",
    module: "native/kernel/arrow.js", fn: "arrowOf",
    question: "does this sequence read differently backward than forward?",
  }),
  Object.freeze({
    id: "revised", family: "PERTURBATION", cell: "EVA.Lens",
    module: "native/kernel/revision-volatility.js", fn: "revisionVolatility",
    question: "has this been revised more than its own exposure predicts?",
  }),
  Object.freeze({
    id: "depends-on", family: "PERTURBATION", cell: "EVA.Paradigm",
    module: "native/kernel/consequential-surprise.js", fn: "consequentialSurprise",
    question: "how much of the graph would collapse if this were wrong?",
  }),
  Object.freeze({
    id: "since-merge", family: "PERTURBATION", cell: "SEG.Network",
    module: "native/kernel/hindsight.js", fn: "hindsight",
    question: "what did the record say before this identity event re-addressed it?",
  }),
  Object.freeze({
    id: "claims", family: "DEDUCTION", cell: "DEF.Lens",
    module: "native/organs/obligation.js", fn: "mark / standings",
    question: "does this proposition check out against a declared norm?",
  }),
  Object.freeze({
    id: "reframed-by", family: "DEDUCTION", cell: "REC.Paradigm",
    module: "void-loop.js", fn: "reshape",
    question: "does this finding contradict the declared space badly enough to re-zero it?",
    note: "the-fold (sibling repo), not eoreader7-native",
  }),
  Object.freeze({
    id: "missing", family: "DEDUCTION", cell: "SIG.Void",
    module: "void-loop.js", fn: "whatWouldSettle",
    question: "what absence would resolve, and what would settle it?",
    note: "the-fold (sibling repo), not eoreader7-native",
  }),
  Object.freeze({
    id: "agrees-with", family: "STRUCTURAL", cell: "SYN.Network",
    module: "native/kernel/contextuality.js", fn: "contextuality",
    question: "do the local readings glue into one global one, exactly, no null?",
  }),
  Object.freeze({
    id: "cycles-in", family: "STRUCTURAL", cell: "DEF.Paradigm",
    module: "native/kernel/dmd.js", fn: "dmd",
    question: "is there a hidden oscillatory or growth mode in this trajectory?",
  }),
]);

const byId = new Map(SEARCH_TERMS.map((t) => [t.id, t]));

/** Exact-id lookup only — a silent nearest-match is exactly the kind of
 * guess this registry exists to refuse instead of make (capacities.js's own
 * rule, restated here for the same reason). */
export function findSearchTerm(id) {
  return byId.get(String(id ?? "").trim().toLowerCase()) ?? null;
}

export function listSearchTerms() {
  return SEARCH_TERMS;
}

export function searchTermsByFamily(family) {
  const f = String(family ?? "").toUpperCase();
  return SEARCH_TERMS.filter((t) => t.family === f);
}
