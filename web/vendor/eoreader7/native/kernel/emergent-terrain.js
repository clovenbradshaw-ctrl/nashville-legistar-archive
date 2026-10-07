import { TERRAINS } from "./terrain-state.js";
import {
  structuralFieldGeometry,
  relationNetworkComponents,
  interpretiveParadigmModels,
} from "./terrain-math.js";
import { interpretiveAtmosphereFactorField } from "./atmosphere-math.js";

const freeze = (value) => Object.freeze(value);
const OPEN = new Set([undefined, null, "open", "strengthened", "weakened"]);
const OCCURRENCE_BINDINGS = new Set(["EOPronounBinding@1", "EODefiniteBinding@1"]);

const stableHash = (value) => {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];
const emptyTerrainState = () => Object.fromEntries(TERRAINS.map((terrain) => [terrain, freeze([])]));
const scopeOf = (edge) => edge?.meta?.encounterRef ?? (Number.isFinite(edge?.scope?.sequencePosition) ? `sequence:${edge.scope.sequencePosition}` : null);
const material = (item) => item?.id && OPEN.has(item.status) && item?.distinction?.materiality?.makesDifference === true;

function fieldProjection(scope, edges = []) {
  if (!scope || edges.length < 2) return null;
  const edgeRefs = edges.map((edge) => edge.id).filter(Boolean).sort();
  if (edgeRefs.length < 2) return null;
  const geometry = structuralFieldGeometry(edges);
  return freeze({
    schema: "EOStructuralFieldProjection@2",
    id: `terrain:field:${stableHash(`${scope}|${edgeRefs.join("|")}`)}`,
    terrain: "Field",
    standing: "projection",
    witnessed: false,
    scope,
    edgeRefs: freeze(edgeRefs),
    relationTypes: freeze(unique(edges.map((edge) => edge.relation)).sort()),
    geometry,
    basis: "local_incidence_field_over_witnessed_links",
  });
}

function networkProjections(edgesById, referentsByEdge) {
  const components = relationNetworkComponents([...edgesById.values()], referentsByEdge);
  return components.map((component) => freeze({
    schema: "EORelationNetworkProjection@2",
    id: `terrain:network:${stableHash(`${component.edgeRefs.join("|")}|${component.referentRefs.join("|")}`)}`,
    terrain: "Network",
    standing: "projection",
    witnessed: false,
    edgeRefs: component.edgeRefs,
    referentRefs: component.referentRefs,
    topology: component,
    basis: "connected_bipartite_hypergraph_component",
  }));
}

function atmosphereProjection(obligations = [], sequence = null) {
  if (!obligations.length) return null;
  const obligationRefs = obligations.map((item) => item.id).sort();
  const consequenceKinds = unique(obligations.flatMap((item) => item.consequences ?? []).map((item) => item?.kind)).sort();
  const field = interpretiveAtmosphereFactorField(obligations, { sequence });
  return freeze({
    schema: "EOInterpretiveAtmosphereProjection@2",
    id: `terrain:atmosphere:${stableHash(obligationRefs.join("|"))}`,
    terrain: "Atmosphere",
    standing: "projection",
    witnessed: false,
    obligationRefs: freeze(obligationRefs),
    consequenceKinds: freeze(consequenceKinds),
    field,
    basis: "interpretive_constraint_factor_graph",
  });
}

function paradigmProjections(obligations = []) {
  return interpretiveParadigmModels(obligations).map((model) => freeze({
    schema: "EOInterpretiveParadigmProjection@2",
    id: `terrain:paradigm:${stableHash(`${model.signature}|${model.memberRefs.join("|")}`)}`,
    terrain: "Paradigm",
    standing: "projection",
    witnessed: false,
    pattern: model.signature,
    obligationRefs: model.memberRefs,
    groundRefs: model.groundRefs,
    model,
    basis: "minimum_description_length_over_independent_interpretations",
  }));
}

function earnedRefsForEdge(edge, bindingByOccurrence) {
  const refs = new Set();
  for (const participant of edge?.participants ?? []) {
    if (participant?.standing === "referent" && participant.ref) {
      refs.add(participant.ref);
      continue;
    }
    const occurrence = participant?.occurrence ?? participant?.ref;
    const bound = occurrence ? bindingByOccurrence.get(occurrence) : null;
    if (bound) refs.add(bound);
  }
  return refs;
}

function refreshField(index, scope) {
  if (!scope) return;
  const edgeIds = index.edgeIdsByScope.get(scope) ?? new Set();
  const edges = [...edgeIds].map((id) => index.edgesById.get(id)).filter(Boolean);
  const projection = fieldProjection(scope, edges);
  if (projection) index.projections.Field.set(scope, projection);
  else index.projections.Field.delete(scope);
  index.dirty = true;
}

function refreshNetworks(index) {
  index.projections.Network.clear();
  for (const projection of networkProjections(index.edgesById, index.referentsByEdge)) index.projections.Network.set(projection.id, projection);
  index.dirty = true;
}

function refreshEdgeReferents(index, edgeId) {
  const edge = index.edgesById.get(edgeId);
  if (!edge) return;
  const next = earnedRefsForEdge(edge, index.bindingByOccurrence);
  index.referentsByEdge.set(edgeId, next);
  refreshNetworks(index);
}

function ingestEdge(index, edge) {
  if (edge?.schema !== "EOHyperedge@1" || !edge.id || index.edgesById.has(edge.id)) return false;
  index.edgesById.set(edge.id, edge);
  const scope = scopeOf(edge);
  if (scope) {
    if (!index.edgeIdsByScope.has(scope)) index.edgeIdsByScope.set(scope, new Set());
    index.edgeIdsByScope.get(scope).add(edge.id);
    refreshField(index, scope);
  }
  for (const participant of edge.participants ?? []) {
    if (participant?.standing === "referent") continue;
    const occurrence = participant?.occurrence ?? participant?.ref;
    if (!occurrence) continue;
    if (!index.edgeIdsByOccurrence.has(occurrence)) index.edgeIdsByOccurrence.set(occurrence, new Set());
    index.edgeIdsByOccurrence.get(occurrence).add(edge.id);
  }
  refreshEdgeReferents(index, edge.id);
  return true;
}

function ingestBinding(index, binding) {
  if (!OCCURRENCE_BINDINGS.has(binding?.schema) || !binding?.id || !binding?.occurrence || !binding?.referent) return false;
  const current = index.bindingByOccurrence.get(binding.occurrence);
  const currentId = index.bindingIdByOccurrence.get(binding.occurrence);
  index.bindingsById.set(binding.id, binding);
  if (current === binding.referent && currentId === binding.id) return false;
  index.bindingByOccurrence.set(binding.occurrence, binding.referent);
  index.bindingIdByOccurrence.set(binding.occurrence, binding.id);
  for (const edgeId of index.edgeIdsByOccurrence.get(binding.occurrence) ?? []) {
    const edge = index.edgesById.get(edgeId);
    if (edge) index.referentsByEdge.set(edgeId, earnedRefsForEdge(edge, index.bindingByOccurrence));
  }
  refreshNetworks(index);
  index.dirty = true;
  return true;
}

function removeBinding(index, id) {
  const binding = index.bindingsById.get(id);
  if (!binding) return false;
  index.bindingsById.delete(id);
  if (index.bindingIdByOccurrence.get(binding.occurrence) !== id) return true;
  index.bindingIdByOccurrence.delete(binding.occurrence);
  index.bindingByOccurrence.delete(binding.occurrence);
  for (const edgeId of index.edgeIdsByOccurrence.get(binding.occurrence) ?? []) {
    const edge = index.edgesById.get(edgeId);
    if (edge) index.referentsByEdge.set(edgeId, earnedRefsForEdge(edge, index.bindingByOccurrence));
  }
  refreshNetworks(index);
  index.dirty = true;
  return true;
}

function refreshInterpretive(index) {
  const obligations = [...index.obligationsById.values()].filter(material);
  index.projections.Atmosphere.clear();
  const atmosphere = atmosphereProjection(obligations, index.sequence);
  if (atmosphere) index.projections.Atmosphere.set("current", atmosphere);
  index.projections.Paradigm.clear();
  for (const paradigm of paradigmProjections(obligations)) index.projections.Paradigm.set(paradigm.id, paradigm);
  index.dirty = true;
}

/**
 * Incremental projection of terrains that emerge from already-earned Fold
 * structure rather than from a single producing EO operation. Raw witness is
 * retained separately; these projections remain present-tense views only.
 */
export function createEmergentTerrainIndex(entries = []) {
  const index = {
    schema: "EOEmergentTerrainIndex@2",
    edgesById: new Map(),
    edgeIdsByScope: new Map(),
    edgeIdsByOccurrence: new Map(),
    bindingsById: new Map(),
    bindingByOccurrence: new Map(),
    bindingIdByOccurrence: new Map(),
    referentsByEdge: new Map(),
    obligationsById: new Map(),
    sequence: 0,
    projections: {
      Field: new Map(),
      Network: new Map(),
      Atmosphere: new Map(),
      Paradigm: new Map(),
    },
    snapshot: null,
    dirty: true,
  };
  indexEmergentTerrainEntries(index, entries);
  return index;
}

export function indexEmergentTerrainEntries(index, entries = []) {
  if (!index?.schema?.startsWith("EOEmergentTerrainIndex@")) throw new TypeError("indexEmergentTerrainEntries requires EOEmergentTerrainIndex");
  let interpretiveDirty = false;
  for (const entry of entries ?? []) {
    if (!entry) continue;
    const sequence = Number.isFinite(entry?.scope?.sequencePosition)
      ? entry.scope.sequencePosition
      : Number.isFinite(entry?.sequencePosition)
        ? entry.sequencePosition
        : null;
    if (sequence !== null) index.sequence = Math.max(index.sequence, sequence);
    if (entry.schema === "EOHyperedge@1") {
      ingestEdge(index, entry);
      continue;
    }
    if (OCCURRENCE_BINDINGS.has(entry.schema)) {
      ingestBinding(index, entry);
      continue;
    }
    if (entry.schema === "EOObligation@1" && entry.id) {
      index.obligationsById.set(entry.id, entry);
      interpretiveDirty = true;
      continue;
    }
    if (entry.schema === "EOOperation@1" && entry?.payload?.action === "remove-provisional" && entry.payload.id) removeBinding(index, entry.payload.id);
  }
  if (interpretiveDirty) refreshInterpretive(index);
  return index;
}

function materialObligationsForIds(index, ids) {
  const out = [];
  for (const obligation of index.obligationsById.values()) {
    if (!material(obligation)) continue;
    if (ids.has(obligation.id) || [...(obligation.grounds ?? []), ...(obligation.alternatives ?? [])].some((id) => ids.has(id))) out.push(obligation);
  }
  return out;
}

export function snapshotEmergentTerrainState(index, { ids = null } = {}) {
  if (!index?.schema?.startsWith("EOEmergentTerrainIndex@")) throw new TypeError("snapshotEmergentTerrainState requires EOEmergentTerrainIndex");
  if (!ids) {
    if (!index.dirty && index.snapshot) return index.snapshot;
    const state = emptyTerrainState();
    state.Field = freeze([...index.projections.Field.values()]);
    state.Network = freeze([...index.projections.Network.values()]);
    state.Atmosphere = freeze([...index.projections.Atmosphere.values()]);
    state.Paradigm = freeze([...index.projections.Paradigm.values()]);
    index.snapshot = freeze(state);
    index.dirty = false;
    return index.snapshot;
  }

  const allowed = ids instanceof Set ? ids : new Set(ids);
  const state = emptyTerrainState();
  const scopes = new Set();
  for (const id of allowed) {
    const edge = index.edgesById.get(id);
    if (edge) {
      const scope = scopeOf(edge);
      if (scope) scopes.add(scope);
    }
  }

  const fields = [];
  for (const scope of scopes) {
    const edges = [...(index.edgeIdsByScope.get(scope) ?? [])].filter((id) => allowed.has(id)).map((id) => index.edgesById.get(id)).filter(Boolean);
    const projection = fieldProjection(scope, edges);
    if (projection) fields.push(projection);
  }
  state.Field = freeze(fields);

  const visibleEdges = [...index.edgesById.values()].filter((edge) => allowed.has(edge.id) || [...(index.referentsByEdge.get(edge.id) ?? [])].some((ref) => allowed.has(ref)));
  state.Network = freeze(relationNetworkComponents(visibleEdges, index.referentsByEdge).map((component) => freeze({
    schema: "EORelationNetworkProjection@2",
    id: `terrain:network:${stableHash(`${component.edgeRefs.join("|")}|${component.referentRefs.join("|")}`)}`,
    terrain: "Network",
    standing: "projection",
    witnessed: false,
    edgeRefs: component.edgeRefs,
    referentRefs: component.referentRefs,
    topology: component,
    basis: "connected_bipartite_hypergraph_component",
  })));

  const obligations = materialObligationsForIds(index, allowed);
  const atmosphere = atmosphereProjection(obligations, index.sequence);
  state.Atmosphere = atmosphere ? freeze([atmosphere]) : freeze([]);
  state.Paradigm = freeze(paradigmProjections(obligations));
  return freeze(state);
}

/**
 * Standalone projection for callers that only have a Fold snapshot. Recursive
 * reading uses EOEmergentTerrainIndex and never rescans the accumulated Fold
 * merely to orient toward the next encounter.
 */
export function projectEmergentTerrains(fold = {}, { ids = null } = {}) {
  const entries = [
    ...(fold?.graphEntries ?? []),
    ...(fold?.obligations ?? []),
  ];
  return snapshotEmergentTerrainState(createEmergentTerrainIndex(entries), { ids });
}

export function mergeTerrainStates(...states) {
  const result = {};
  for (const terrain of TERRAINS) {
    const populated = states.map((state) => state?.[terrain] ?? []).filter((entries) => entries.length > 0);
    if (populated.length === 0) {
      result[terrain] = freeze([]);
      continue;
    }
    if (populated.length === 1) {
      result[terrain] = populated[0];
      continue;
    }
    const byId = new Map();
    for (const entries of populated) for (const entry of entries) if (entry?.id) byId.set(entry.id, entry);
    result[terrain] = freeze([...byId.values()]);
  }
  return freeze(result);
}
