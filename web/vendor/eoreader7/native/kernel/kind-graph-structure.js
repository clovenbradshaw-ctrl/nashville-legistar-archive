/* Xunzi speaks:
 * “Then in accordance with that, names are given to things. 
"When things are alike, they are named alike ; when 
difierent, they are named differently.”
 *
 * This file implements Xunzi's understanding of kinds, which are related by resemblance, not a strict tree. The kind-graph serves as a flexible and dynamic representation of relationships, allowing for nuanced comparisons and analysis, rather than a rigid structure.  The file's implementation aims to be faithful to Xunzi's teaching.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Xunzi — after the Zhengming chapter's graded names: kinds relate by resemblance in a graph, never a strict tree. Amendment XVII.
//
// AMENDED 2026-09-15 — predicate identity, and a second archon (Osgood) for
// what an embedding may say about it once the mechanical tier has spoken.
//
// `predicateSet` (below) decided membership by raw JS string equality on
// `edge.relation`. Two witnessed inflections of ONE lemma ("retreated" and
// "retreats" for the same act) counted as two distinct predicates, inflating
// `relation_diversity_depth` from surface form alone — exactly the failure
// class native/memory/activation.js documents finding generally (a claim
// phrased "underwent metamorphosis" against material stating "undergoes
// metamorphosis" read as two different verbs) and that native/organs/
// hypergraph.js already carries the remedy for at the claim-matching tier:
// an injected `sameAct`, built by native/adapters/text/morphology.js's
// `createLemmatizer` over a received UniMorph prior. That remedy was never
// carried into this file's own `predicateSet`, so the identical bug
// survived here. Measured on real material before wiring anything in (this
// project's own "no hand-set thresholds, prefer a measured null" rule):
// five real Wikipedia battle/war articles run through the real production
// extractor (native/eval/the-fold/kind-graph-embedding-rerank.mjs) turned up
// one real instance (had/has, on the American Civil War article's "the
// war") and zero relation_diversity_depth threshold crossings that the
// lemma fold actually changed on that corpus — real, but inert there. The
// mechanism is kept general regardless: the corpus that would exercise it
// (dialogue-heavy or historical-present narrative) is real prose this
// project's own fixtures do not happen to contain yet, not a hypothetical.
//
// `sameAct` below is OPTIONAL and INJECTED, never imported into this
// module — omitted, `predicateSet` behaves byte-identically to before this
// amendment (raw string equality, exactly as `predicateSet.add(edge.relation)`
// always did).
//
// `predicateResonance(a, b)` is a SECOND, separate injection, held to
// native/memory/activation.js's exact discipline for where an embedding is
// allowed to go (see that file's "WHERE THE EMBEDDING GOES, AND WHY IT GOES
// THERE"): (1) INJECTED, NEVER IMPORTED — this module takes no model
// dependency, no vocabulary, no download; (2) IT RERANKS ONLY WHAT THE
// MECHANICAL TIER ALREADY SURFACED — called only on a predicate the (lemma-
// aware, or raw) `predicateSet` has ALREADY decided is a genuinely new,
// distinct member; it is never consulted to decide Set membership, and
// cannot merge or suppress a predicate the mechanical tier admitted; (3)
// DISAGREEMENT IS DISCLOSED, NOT RECONCILED — the raw similarity against
// every other predicate already on record for the entity is placed on the
// emitted feature's `resonance` field as evidence, never collapsed into a
// merge-or-don't verdict. No similarity cutoff is hand-set anywhere in this
// file; a consumer, or a later measured-null pass, decides what the numbers
// mean. Its archon is Osgood (native/organs/archon-compendium.js): meaning
// placed as a point in a measured space, so two words' distance apart is a
// number to weigh, never a verdict that they are the same word.
//
// Both injections are additive: with neither supplied, every emitted
// feature — `relation_diversity_depth` included — is byte-identical to
// this file before this amendment.

const freeze = (value) => Object.freeze(value);

const OCCURRENCE_BINDING_SCHEMAS = new Set(["EOPronounBinding@1", "EODefiniteBinding@1"]);
const DEFAULT_DEPTH_THRESHOLDS = Object.freeze([2, 4, 8, 16]);

// The embedding tier's absence, stated once so every resonance-bearing
// feature carries the same typed refusal rather than a scatter of nulls
// that read like zeroes (native/memory/activation.js's `NO_EMBEDDER`, same
// posture, same shape).
const NO_PREDICATE_RESONANCE = freeze({
  gap: "undeclared",
  what: "predicateResonance",
  why: "cross-lemma predicate synonymy is model-tier and needs a resolver with a giver; none was supplied",
});

/**
 * What an (optional, injected) embedding says about a predicate the
 * mechanical tier has ALREADY decided is new and distinct for this entity,
 * compared against every other predicate already on record for it. Never
 * called to decide membership — only to rerank/disclose after the fact.
 */
function predicateResonanceOf(predicateResonance, newPredicate, priorPredicates) {
  if (!predicateResonance) return NO_PREDICATE_RESONANCE;
  if (!priorPredicates.length) {
    // Tier-boundary case, exactly like activation.js's `rerank` on an empty
    // activation Map: nothing yet exists for this entity to compare against,
    // so there is nothing to rerank. The model tier is not permitted to
    // conjure a comparison the mechanical tier never had.
    return freeze({ gap: "no_ground", why: "no other predicate is yet on record for this entity to compare against" });
  }
  const all = [];
  for (const other of priorPredicates) {
    let similarity = null;
    try { similarity = predicateResonance(newPredicate, other); } catch { similarity = null; }
    if (typeof similarity === "number" && Number.isFinite(similarity)) all.push(freeze({ predicate: other, similarity }));
  }
  if (!all.length) return freeze({ gap: "no_ground", why: "predicateResonance returned no comparable similarity for any prior predicate" });
  all.sort((a, b) => b.similarity - a.similarity);
  return freeze({ newPredicate, comparedAgainst: priorPredicates.length, top: all[0], all: freeze(all) });
}

const positionOf = (edge) => Number.isFinite(edge?.scope?.sequencePosition)
  ? edge.scope.sequencePosition
  : Number.isFinite(edge?.sequencePosition)
    ? edge.sequencePosition
    : null;

const occurrenceOf = (participant) => participant?.occurrence
  ?? (participant?.standing === "unresolved_surface" ? participant?.ref : null);

function endpointOf(participant, bindings) {
  if (!participant) return null;
  if (participant.standing === "referent" && participant.ref) {
    return freeze({ entityRef: participant.ref, basis: "witnessed_referent", bindingRef: null });
  }
  const occurrence = occurrenceOf(participant);
  if (!occurrence) return null;
  const binding = bindings.get(occurrence);
  if (!binding?.referent) return null;
  return freeze({ entityRef: binding.referent, basis: "explicit_occurrence_binding", bindingRef: binding.id });
}

function structuralFeature({ id, entityRef, featureKey, featureValue, edge, basis, bindingRef = null, resonance = undefined }) {
  const descriptor = {
    id,
    entityRef,
    featureKey,
    featureValue,
    sequencePosition: positionOf(edge),
    witness: edge?.witness ?? null,
    witnessRefs: freeze([...(edge?.witnessRefs ?? [])]),
    provenance: freeze({
      modality: edge?.meta?.modality ?? edge?.provenance?.modality ?? null,
      giver: "kernel/kind-graph-structure",
      basis,
      sourceSchema: edge?.schema ?? null,
      sourceRef: edge?.id ?? null,
      bindingRef,
    }),
  };
  // `resonance` is added to the frozen shape only when a caller actually
  // asked for one (see the diversity-depth call site below) — every other
  // feature kind, and every caller that injects neither `sameAct` nor
  // `predicateResonance`, keeps the exact pre-amendment shape.
  if (resonance !== undefined) descriptor.resonance = resonance;
  return freeze(descriptor);
}

/**
 * Present-tense structural projection over immutable witnessed hyperedges.
 *
 * Ordinary edge arrival is incremental. A newly learned occurrence binding is
 * rarer and can change the present interpretation of earlier raw witness, so
 * only binding changes trigger a full reprojection. Raw edges themselves are
 * never rewritten. The projection remains semantic-label free: role,
 * recurrence depth, role breadth, and relation-diversity depth are merely
 * candidate structure for the downstream held-out difference-making gate.
 */
export function createKindGraphStructureLedger({ depthThresholds = DEFAULT_DEPTH_THRESHOLDS, sameAct = null, predicateResonance = null } = {}) {
  const thresholds = [...new Set(depthThresholds)]
    .filter((value) => Number.isInteger(value) && value >= 2)
    .sort((a, b) => a - b);
  if (!thresholds.length) throw new TypeError("Kind graph structure requires at least one depth threshold >= 2");
  // A `relation_diversity_depth` feature carries a `resonance` field only
  // when at least one of the two injections is present — the additive-layer
  // rule (base layer unmodified; every layer above buys something, never
  // degrades it). Neither supplied, this stays false and the feature shape
  // never changes from what this file emitted before this amendment.
  const discloseResonance = Boolean(sameAct) || Boolean(predicateResonance);

  const rawEdges = new Map();
  const bindings = new Map();
  let features = [];
  let pending = [];
  let relationCount = new Map();
  let predicates = new Map();
  let roles = new Map();
  let roleBreadthEmitted = new Set();
  let rebuilds = 0;

  const emit = (descriptor) => {
    features.push(descriptor);
    pending.push(descriptor);
  };

  const projectEdge = (edge) => {
    for (let ordinal = 0; ordinal < (edge.participants ?? []).length; ordinal += 1) {
      const participant = edge.participants[ordinal];
      const endpoint = endpointOf(participant, bindings);
      if (!endpoint?.entityRef) continue;
      const entityRef = endpoint.entityRef;
      const role = participant.role ?? "participant";
      const bindingRef = endpoint.bindingRef;

      emit(structuralFeature({
        id: `kind-evidence:graph-role:${edge.id}:${ordinal}`,
        entityRef,
        featureKey: "relation_role",
        featureValue: role,
        edge,
        basis: endpoint.basis === "explicit_occurrence_binding"
          ? "bound_hyperedge_role"
          : "witnessed_hyperedge_role",
        bindingRef,
      }));

      const count = (relationCount.get(entityRef) ?? 0) + 1;
      relationCount.set(entityRef, count);
      if (thresholds.includes(count)) {
        emit(structuralFeature({
          id: `kind-evidence:graph-participation-depth:${entityRef}:${count}`,
          entityRef,
          featureKey: "relation_participation_depth",
          featureValue: `${count}+`,
          edge,
          basis: "witnessed_relation_recurrence_threshold",
          bindingRef,
        }));
      }

      if (!predicates.has(entityRef)) predicates.set(entityRef, new Set());
      const predicateSet = predicates.get(entityRef);
      const beforePredicates = predicateSet.size;
      // Without `sameAct`, this is exactly `predicateSet.add(edge.relation)`
      // as before: `canonicalPredicate` is always `edge.relation` itself, so
      // the Set never dedupes anything it didn't already dedupe by raw
      // string identity. With `sameAct` injected, a witnessed predicate
      // joins an EXISTING member's key when the two share a lemma — the
      // mechanical (never model-tier) fix — and only a genuine new lemma
      // grows the Set.
      const canonicalPredicate = sameAct
        ? ([...predicateSet].find((existing) => sameAct(existing, edge.relation)) ?? edge.relation)
        : edge.relation;
      predicateSet.add(canonicalPredicate);
      if (predicateSet.size > beforePredicates && thresholds.includes(predicateSet.size)) {
        const priorPredicates = [...predicateSet].filter((p) => p !== canonicalPredicate);
        emit(structuralFeature({
          id: `kind-evidence:graph-diversity-depth:${entityRef}:${predicateSet.size}`,
          entityRef,
          featureKey: "relation_diversity_depth",
          featureValue: `${predicateSet.size}+`,
          edge,
          basis: "witnessed_relation_diversity_threshold",
          bindingRef,
          resonance: discloseResonance ? predicateResonanceOf(predicateResonance, canonicalPredicate, priorPredicates) : undefined,
        }));
      }

      if (!roles.has(entityRef)) roles.set(entityRef, new Set());
      const roleSet = roles.get(entityRef);
      roleSet.add(role);
      // Role BREADTH is "this being has been witnessed at more than one end
      // of an arrangement" — a structural fact any medium can present. It was
      // written as roleSet.has("subject") && roleSet.has("object"), which
      // made a kernel-level structural feature depend on an English-SVO
      // adapter's own vocabulary; material labelled any other way scored zero
      // breadth however varied its arrangements. Counted by DISTINCTNESS now,
      // never by the names the roles happen to carry.
      if (!roleBreadthEmitted.has(entityRef) && roleSet.size >= 2) {
        roleBreadthEmitted.add(entityRef);
        emit(structuralFeature({
          id: `kind-evidence:graph-role-breadth:${entityRef}:distinct-ends`,
          entityRef,
          featureKey: "relation_role_breadth",
          featureValue: `${roleSet.size}_distinct_roles`,
          edge,
          basis: "witnessed_role_breadth",
          bindingRef,
        }));
      }
    }
  };

  const rebuild = () => {
    features = [];
    pending = [];
    relationCount = new Map();
    predicates = new Map();
    roles = new Map();
    roleBreadthEmitted = new Set();
    const sorted = [...rawEdges.values()].sort((a, b) => positionOf(a) - positionOf(b) || a.id.localeCompare(b.id));
    for (const edge of sorted) projectEdge(edge);
    rebuilds += 1;
  };

  const ingest = (entries = []) => {
    let changed = 0;
    let bindingChanged = false;
    const newEdges = [];

    // Bindings are installed before projecting any edges from the same batch.
    // This avoids a transient unresolved projection when an observation carries
    // both the edge and its causal binding.
    for (const entry of entries ?? []) {
      if (!OCCURRENCE_BINDING_SCHEMAS.has(entry?.schema) || !entry?.occurrence || !entry?.referent) continue;
      const prior = bindings.get(entry.occurrence);
      if (prior?.id === entry.id && prior?.referent === entry.referent) continue;
      bindings.set(entry.occurrence, entry);
      bindingChanged = true;
      changed += 1;
    }

    for (const entry of entries ?? []) {
      if (entry?.schema !== "EOHyperedge@1" || !entry.id || positionOf(entry) === null || rawEdges.has(entry.id)) continue;
      rawEdges.set(entry.id, entry);
      newEdges.push(entry);
      changed += 1;
    }

    if (bindingChanged) {
      rebuild();
    } else if (newEdges.length) {
      newEdges.sort((a, b) => positionOf(a) - positionOf(b) || a.id.localeCompare(b.id));
      for (const edge of newEdges) projectEdge(edge);
    }
    return changed;
  };

  const drain = () => {
    if (!pending.length) return freeze([]);
    const out = freeze([...pending]);
    pending = [];
    return out;
  };

  return freeze({
    schema: "EOKindGraphStructureLedger@1",
    ingest,
    drain,
    // The induction index consumes only projection deltas. Keeping this alias
    // avoids an O(n^2) full scan while preserving its existing internal call.
    snapshot: drain,
    allFeatures: () => freeze([...features]),
    diagnostics: () => freeze({
      rawEdges: rawEdges.size,
      occurrenceBindings: bindings.size,
      projectedFeatures: features.length,
      rebuilds,
      depthThresholds: freeze([...thresholds]),
      // Disclosed rather than left implicit: whether this ledger's own
      // `predicateSet` is folding by lemma or by raw string, and whether an
      // embedding tier was ever injected to rerank the residue. Never
      // affects a single count above — pure transparency.
      predicateIdentity: sameAct ? "lemma_canonical" : "raw_string",
      predicateResonance: predicateResonance ? "injected" : "undeclared",
    }),
  });
}
