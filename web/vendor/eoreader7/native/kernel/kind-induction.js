/* Kanada speaks:
 * “The notions, Genus and Species, are relative to the 
Understanding.”
 *
 * This file implements Kanada's atomist principles of kind-induction.  It relies on the observation that instances share common features and characteristics, and these shared features are sufficient to infer a kind.  However, the file should not be used as a basis for an arbitrary or biased kind-induction, as this would be a misapplication of the atomist principles.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Kanada — after the Vaisheshika atomist: a kind (samanya) is induced from what its instances share, nothing declared in advance. Amendment XVII.

import { createKindGraphStructureLedger } from "./kind-graph-structure.js";
import { induceEntityKindCandidates } from "./entity-kind-induction.js";

const freeze = (value) => Object.freeze(value);

const stableHash = (value) => {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

function stableValue(value) {
  if (value === undefined) return "true";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
}

const sequenceOf = (entry) => Number.isFinite(entry?.sequencePosition)
  ? entry.sequencePosition
  : Number.isFinite(entry?.scope?.sequencePosition)
    ? entry.scope.sequencePosition
    : null;

const witnessRefsOf = (entry) => {
  const refs = new Set(entry?.witnessRefs ?? []);
  if (entry?.witness) refs.add(entry.witness);
  return [...refs].filter(Boolean);
};

const signatureOf = (entry) => entry?.featureKey
  ? `${entry.featureKey}=${stableValue(entry.featureValue)}`
  : null;

function logChoose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return -Infinity;
  const m = Math.min(k, n - k);
  let out = 0;
  for (let i = 1; i <= m; i += 1) out += Math.log(n - m + i) - Math.log(i);
  return out;
}

function hypergeometricProbability(N, K, n, k) {
  if (k < 0 || k > K || k > n || n - k > N - K) return 0;
  return Math.exp(logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n));
}

function hypergeometricUpperTail(N, K, n, k) {
  const max = Math.min(K, n);
  let p = 0;
  for (let x = k; x <= max; x += 1) p += hypergeometricProbability(N, K, n, x);
  return Math.min(1, p);
}

function invalidateSnapshot(index) {
  index.snapshot = null;
  index.diagnostics = null;
}

function ensureEntity(index, entityRef) {
  if (!index.entityFeatures.has(entityRef)) index.entityFeatures.set(entityRef, new Map());
  return index.entityFeatures.get(entityRef);
}

function ingestFeature(index, entry) {
  const signature = signatureOf(entry);
  const at = sequenceOf(entry);
  if (!signature || !entry.entityRef || at === null) return false;
  const entity = ensureEntity(index, entry.entityRef);
  let record = entity.get(signature);
  if (!record) {
    record = { signature, featureKey: entry.featureKey, featureValue: entry.featureValue, firstAt: at, lastAt: at, evidenceIds: new Set(), witnessRefs: new Set(), modalities: new Set() };
    entity.set(signature, record);
  }
  record.firstAt = Math.min(record.firstAt, at);
  record.lastAt = Math.max(record.lastAt, at);
  record.evidenceIds.add(entry.id);
  for (const ref of witnessRefsOf(entry)) record.witnessRefs.add(ref);
  if (entry?.provenance?.modality) record.modalities.add(entry.provenance.modality);
  if (!index.entitiesByFeature.has(signature)) index.entitiesByFeature.set(signature, new Map());
  index.entitiesByFeature.get(signature).set(entry.entityRef, record);
  const latest = index.latestAtByEntity.get(entry.entityRef);
  index.latestAtByEntity.set(entry.entityRef, latest === undefined ? at : Math.max(latest, at));
  index.structuralDirty = true;
  invalidateSnapshot(index);
  return true;
}

function ingestExplicit(index, entry) {
  if (!entry?.entityRef || !entry?.kindKey) return false;
  if (!index.explicitByKind.has(entry.kindKey)) index.explicitByKind.set(entry.kindKey, new Map());
  index.explicitByKind.get(entry.kindKey).set(entry.id, entry);
  index.receivedDirtyKinds.add(entry.kindKey);
  invalidateSnapshot(index);
  return true;
}

export function kindEvidence({ id, entityRef, evidenceType = "structural_feature", featureKey = null, featureValue = undefined, kindKey = null, kindSurface = null, sequencePosition = null, witness = null, witnessRefs = [], anchor = null, provenance = {} } = {}) {
  if (!id || !entityRef) throw new TypeError("kindEvidence requires id and entityRef");
  if (evidenceType === "explicit_classification" && !kindKey) throw new TypeError("explicit classification requires kindKey");
  if (evidenceType === "structural_feature" && !featureKey) throw new TypeError("structural feature evidence requires featureKey");
  return freeze({ schema: "EOKindEvidence@1", id, entityRef, evidenceType, featureKey, featureValue, kindKey, kindSurface, sequencePosition, standing: "witnessed_evidence", witnessed: true, witness, witnessRefs: freeze([...new Set(witnessRefsOf({ witness, witnessRefs }))]), anchor: anchor ? freeze({ ...anchor }) : null, provenance: freeze({ ...provenance }) });
}

function graphDescriptorEvidence(descriptor) {
  return kindEvidence({ ...descriptor, evidenceType: "structural_feature" });
}

export function createKindInductionIndex(entries = [], options = {}) {
  const index = {
    schema: "EOKindInductionIndex@1",
    options: freeze({
      minMembers: options.minMembers ?? 3,
      minFitMembers: options.minFitMembers ?? 2,
      minConsequenceSupport: options.minConsequenceSupport ?? 2,
      minEffect: options.minEffect ?? 0.5,
      alpha: options.alpha ?? 0.05,
      // The old single-feature selector -> held-out consequence path is retained
      // only for explicit diagnostic/back-compat use. It is not ontology in v7.
      legacySelectorAdmission: options.legacySelectorAdmission === true,
      populationMinEntityCount: options.populationMinEntityCount,
      populationMinPrevalence: options.populationMinPrevalence,
      populationCohesionThreshold: options.populationCohesionThreshold,
      populationMinKindSize: options.populationMinKindSize,
      populationPermutations: options.populationPermutations,
      populationQuantile: options.populationQuantile ?? 0.95,
      populationBondQuantile: options.populationBondQuantile ?? 0.75,
      populationMinAffinity: options.populationMinAffinity ?? 0.12,
      populationNeighborCount: options.populationNeighborCount,
    }),
    evidenceById: new Map(), explicitByKind: new Map(), entityFeatures: new Map(), entitiesByFeature: new Map(), latestAtByEntity: new Map(),
    receivedProjectionByKind: new Map(), receivedDirtyKinds: new Set(), earnedProjections: freeze([]), populationKindCandidates: freeze([]),
    populationKindDiagnostics: freeze({ entities: 0, parameters: 0, basins: 0, clusters: 0, validated: 0 }),
    earnedDiagnostics: freeze({ selectorNominations: 0, selectorAdmission: "disabled", earnedKinds: 0, withheldNoHoldout: 0, withheldNoConsequence: 0 }),
    graphStructure: createKindGraphStructureLedger({ depthThresholds: options.depthThresholds }), structuralDirty: false, snapshot: null, diagnostics: null,
  };
  indexKindEntries(index, entries);
  return index;
}

function ingestKindEvidence(index, entry) {
  if (entry?.schema !== "EOKindEvidence@1" || !entry.id || index.evidenceById.has(entry.id)) return false;
  const accepted = entry.evidenceType === "explicit_classification" ? ingestExplicit(index, entry) : entry.evidenceType === "structural_feature" ? ingestFeature(index, entry) : false;
  if (!accepted) return false;
  index.evidenceById.set(entry.id, entry);
  return true;
}

function syncGraphStructure(index) {
  let changed = 0;
  for (const descriptor of index.graphStructure.snapshot()) {
    const evidence = graphDescriptorEvidence(descriptor);
    if (ingestKindEvidence(index, evidence)) changed += 1;
  }
  return changed;
}

export function indexKindEntries(index, entries = []) {
  if (index?.schema !== "EOKindInductionIndex@1") throw new TypeError("indexKindEntries requires EOKindInductionIndex@1");
  let changed = 0;
  for (const entry of entries ?? []) if (ingestKindEvidence(index, entry)) changed += 1;
  if (index.graphStructure.ingest(entries) > 0) changed += syncGraphStructure(index);
  return changed;
}

function receivedKindProjection(index, kindKey) {
  const evidence = [...(index.explicitByKind.get(kindKey)?.values() ?? [])];
  if (!evidence.length) return null;
  const memberRefs = [...new Set(evidence.map((entry) => entry.entityRef))].sort();
  const evidenceRefs = evidence.map((entry) => entry.id).sort();
  const witnessRefs = [...new Set(evidence.flatMap(witnessRefsOf))].sort();
  const modalities = [...new Set(evidence.map((entry) => entry?.provenance?.modality).filter(Boolean))].sort();
  return freeze({ schema: "EOKindProjection@1", id: `terrain:kind:received:${stableHash(`${kindKey}|${evidenceRefs.join("|")}`)}`, terrain: "Kind", kindKey, kindSurface: evidence.find((entry) => entry.kindSurface)?.kindSurface ?? null, standing: "received_explicit_classification", witnessed: false, memberRefs: freeze(memberRefs), evidenceRefs: freeze(evidenceRefs), witnessRefs: freeze(witnessRefs), modalities: freeze(modalities), basis: "explicit_classification_evidence" });
}

function refreshReceivedKinds(index) {
  if (!index.receivedDirtyKinds.size) return;
  for (const kindKey of index.receivedDirtyKinds) {
    const projection = receivedKindProjection(index, kindKey);
    if (projection) index.receivedProjectionByKind.set(kindKey, projection);
    else index.receivedProjectionByKind.delete(kindKey);
  }
  index.receivedDirtyKinds.clear();
}

function consequenceRecord(index, entityRef, signature) { return index.entityFeatures.get(entityRef)?.get(signature) ?? null; }
function futureObserved(index, entityRef, after) { return (index.latestAtByEntity.get(entityRef) ?? -Infinity) > after; }

function earnedKindProjection(index, selectorSignature, selectorMembers, population, diagnostics) {
  const { minMembers, minFitMembers, minConsequenceSupport, minEffect, alpha } = index.options;
  if (selectorMembers.size < minMembers || selectorMembers.size <= minFitMembers) return null;
  const ordered = [...selectorMembers.entries()].sort((a, b) => a[1].firstAt - b[1].firstAt || a[0].localeCompare(b[0]));
  const formedAt = ordered[minFitMembers - 1][1].firstAt;
  const fitMemberRefs = ordered.slice(0, minFitMembers).map(([entityRef]) => entityRef);
  const holdoutMemberRefs = ordered.slice(minFitMembers).filter(([, record]) => record.firstAt > formedAt).map(([entityRef]) => entityRef);
  if (!holdoutMemberRefs.length) { diagnostics.withheldNoHoldout += 1; return null; }

  const memberRefs = new Set(ordered.map(([entityRef]) => entityRef));
  const candidateConsequences = new Set();
  for (const entityRef of memberRefs) {
    const selector = selectorMembers.get(entityRef);
    for (const [signature, record] of index.entityFeatures.get(entityRef) ?? []) {
      if (signature !== selectorSignature && record.firstAt > Math.max(formedAt, selector.firstAt)) candidateConsequences.add(signature);
    }
  }

  let best = null;
  for (const consequenceSignature of candidateConsequences) {
    const evaluableMembers = [...memberRefs].filter((entityRef) => futureObserved(index, entityRef, Math.max(formedAt, selectorMembers.get(entityRef).firstAt)));
    const evaluableNonMembers = [...population].filter((entityRef) => !memberRefs.has(entityRef) && futureObserved(index, entityRef, formedAt));
    if (evaluableMembers.length < minMembers || evaluableNonMembers.length < 1) continue;
    const supportingMembers = evaluableMembers.filter((entityRef) => {
      const consequence = consequenceRecord(index, entityRef, consequenceSignature);
      return consequence && consequence.firstAt > Math.max(formedAt, selectorMembers.get(entityRef).firstAt);
    });
    const holdoutSupport = holdoutMemberRefs.filter((entityRef) => supportingMembers.includes(entityRef));
    if (supportingMembers.length < minConsequenceSupport || holdoutSupport.length < 1) continue;
    const supportingNonMembers = evaluableNonMembers.filter((entityRef) => {
      const consequence = consequenceRecord(index, entityRef, consequenceSignature);
      return consequence && consequence.firstAt > formedAt;
    });
    const memberRate = supportingMembers.length / evaluableMembers.length;
    const nonMemberRate = supportingNonMembers.length / evaluableNonMembers.length;
    const effect = memberRate - nonMemberRate;
    if (effect < minEffect) continue;
    const pValue = hypergeometricUpperTail(evaluableMembers.length + evaluableNonMembers.length, supportingMembers.length + supportingNonMembers.length, evaluableMembers.length, supportingMembers.length);
    if (pValue > alpha) continue;
    const consequenceExample = consequenceRecord(index, supportingMembers[0], consequenceSignature);
    const result = { consequenceSignature, consequence: freeze({ key: consequenceExample.featureKey, value: consequenceExample.featureValue, signature: consequenceSignature }), evaluableMembers, evaluableNonMembers, supportingMembers, supportingNonMembers, holdoutSupport, memberRate, nonMemberRate, effect, pValue };
    if (!best || result.pValue < best.pValue || (result.pValue === best.pValue && result.effect > best.effect)) best = result;
  }
  if (!best) { diagnostics.withheldNoConsequence += 1; return null; }

  const selectorExample = ordered[0][1];
  const selectorEvidenceRefs = [...memberRefs].flatMap((entityRef) => [...(selectorMembers.get(entityRef)?.evidenceIds ?? [])]);
  const consequenceEvidenceRefs = best.supportingMembers.flatMap((entityRef) => [...(consequenceRecord(index, entityRef, best.consequenceSignature)?.evidenceIds ?? [])]);
  const evidenceRefs = [...new Set([...selectorEvidenceRefs, ...consequenceEvidenceRefs])].sort();
  const witnessRefs = [...new Set(evidenceRefs.flatMap((id) => witnessRefsOf(index.evidenceById.get(id))))].sort();
  const modalities = [...new Set(evidenceRefs.map((id) => index.evidenceById.get(id)?.provenance?.modality).filter(Boolean))].sort();
  const selector = freeze({ key: selectorExample.featureKey, value: selectorExample.featureValue, signature: selectorSignature });
  const kindKey = `kind:induced:${stableHash(selectorSignature)}`;
  return freeze({
    schema: "EOKindProjection@1", id: `terrain:kind:earned:${stableHash(`${selectorSignature}|${best.consequenceSignature}|${formedAt}`)}`, terrain: "Kind", kindKey, standing: "earned_invariant", witnessed: false, selector,
    memberRefs: freeze([...memberRefs].sort()), fitMemberRefs: freeze([...fitMemberRefs].sort()), holdoutMemberRefs: freeze([...holdoutMemberRefs].sort()), consequence: best.consequence, evidenceRefs: freeze(evidenceRefs), witnessRefs: freeze(witnessRefs), modalities: freeze(modalities),
    materiality: freeze({ makesDifference: true, reasons: freeze([freeze({ kind: "held_out_consequence_differential", consequence: best.consequenceSignature, effect: best.effect, pValue: best.pValue })]) }),
    validation: freeze({ method: "temporal_holdout_hypergeometric", formedAt, fitMemberRefs: freeze([...fitMemberRefs].sort()), holdoutMemberRefs: freeze([...holdoutMemberRefs].sort()), holdoutSupportRefs: freeze([...best.holdoutSupport].sort()), evaluableMemberCount: best.evaluableMembers.length, evaluableNonMemberCount: best.evaluableNonMembers.length, supportingMemberCount: best.supportingMembers.length, supportingNonMemberCount: best.supportingNonMembers.length, memberRate: best.memberRate, nonMemberRate: best.nonMemberRate, effect: best.effect, pValue: best.pValue, alpha }),
    basis: "legacy_single_selector_with_held_out_consequence",
  });
}

function refreshPopulationKindCandidates(index) {
  const result = induceEntityKindCandidates(index.entityFeatures, {
    minEntityCount: index.options.populationMinEntityCount,
    minPrevalence: index.options.populationMinPrevalence,
    cohesionThreshold: index.options.populationCohesionThreshold,
    minKindSize: index.options.populationMinKindSize,
    permutations: index.options.populationPermutations,
    quantile: index.options.populationQuantile,
    bondQuantile: index.options.populationBondQuantile,
    minAffinity: index.options.populationMinAffinity,
    neighborCount: index.options.populationNeighborCount,
    population: "current-fold-entities",
  });
  index.populationKindCandidates = result.candidates;
  index.populationKindDiagnostics = result.diagnostics;
}

function refreshEarnedKinds(index) {
  if (!index.structuralDirty) return;
  refreshPopulationKindCandidates(index);
  const earned = [];
  const diagnostics = {
    selectorNominations: 0,
    selectorAdmission: index.options.legacySelectorAdmission ? "legacy_opt_in" : "disabled_by_default",
    earnedKinds: 0,
    withheldNoHoldout: 0,
    withheldNoConsequence: 0,
  };
  const population = new Set(index.entityFeatures.keys());
  for (const [selectorSignature, members] of index.entitiesByFeature) {
    if (members.size < index.options.minMembers) continue;
    diagnostics.selectorNominations += 1;
    if (!index.options.legacySelectorAdmission) continue;
    const projection = earnedKindProjection(index, selectorSignature, members, population, diagnostics);
    if (projection) earned.push(projection);
  }
  earned.sort((a, b) => a.kindKey.localeCompare(b.kindKey));
  diagnostics.earnedKinds = earned.length;
  index.earnedProjections = freeze(earned);
  index.earnedDiagnostics = freeze({ ...diagnostics });
  index.structuralDirty = false;
}

function computeSnapshot(index) {
  refreshReceivedKinds(index);
  refreshEarnedKinds(index);
  const received = [...index.receivedProjectionByKind.values()].sort((a, b) => a.kindKey.localeCompare(b.kindKey));
  index.diagnostics = freeze({
    explicitKinds: received.length,
    ...index.earnedDiagnostics,
    graphStructure: index.graphStructure.diagnostics(),
    populationKinds: index.populationKindDiagnostics,
    populationKindCandidates: freeze(index.populationKindCandidates.slice(0, 12).map((candidate) => freeze({
      id: candidate.id, kindKey: candidate.kindKey, standing: candidate.standing, mechanism: candidate.mechanism, memberCount: candidate.memberCount, memberRefs: candidate.memberRefs, cohesion: candidate.cohesion,
      bindingEnergy: candidate.field?.bindingEnergy ?? null, cohesionPassed: candidate.cohesionNull?.passed ?? false, fallbackNomination: candidate.fallbackNomination === true, distinguishingParameters: candidate.distinguishingParameters,
    }))),
  });
  index.snapshot = freeze([...received, ...index.earnedProjections]);
  return index.snapshot;
}

export function snapshotKindState(index, { ids = null } = {}) {
  if (index?.schema !== "EOKindInductionIndex@1") throw new TypeError("snapshotKindState requires EOKindInductionIndex@1");
  const snapshot = index.snapshot ?? computeSnapshot(index);
  if (!ids) return snapshot;
  const allowed = ids instanceof Set ? ids : new Set(ids);
  return freeze(snapshot.filter((projection) => allowed.has(projection.id) || allowed.has(projection.kindKey) || (projection.memberRefs ?? []).some((id) => allowed.has(id)) || (projection.evidenceRefs ?? []).some((id) => allowed.has(id))));
}

export function kindDiagnostics(index) {
  if (index?.schema !== "EOKindInductionIndex@1") throw new TypeError("kindDiagnostics requires EOKindInductionIndex@1");
  if (!index.diagnostics) computeSnapshot(index);
  return index.diagnostics;
}

export function kindCandidates(index) {
  if (index?.schema !== "EOKindInductionIndex@1") throw new TypeError("kindCandidates requires EOKindInductionIndex@1");
  if (index.structuralDirty || !index.diagnostics) computeSnapshot(index);
  return index.populationKindCandidates;
}

export function projectKinds(entries = [], options = {}) { return snapshotKindState(createKindInductionIndex(entries, options)); }
