// Handle: Berge — after Claude Berge, who coined "hypergraph." Amendment XVII.

const freeze = (value) => Object.freeze(value);
const REF_RE = /^(ref|obs|edge|expectation|obligation|frame|pattern|motif|delta|op|occ|surface|mention|encounter|lex):/;
const addRef = (set, value) => { if (typeof value === "string" && REF_RE.test(value)) set.add(value); };
const addRefs = (set, values) => { for (const value of values ?? []) addRef(set, value); };

function referencesOf(entry) {
  const refs = new Set();
  if (!entry || typeof entry !== "object") return refs;
  switch (entry.schema) {
    case "Observation@1":
      for (const d of entry.distinctions ?? []) {
        addRef(refs, d?.ref);
        addRef(refs, d?.referentId);
        addRef(refs, d?.occurrence);
        addRef(refs, d?.surfaceKey);
      }
      addRef(refs, entry.encounterRef);
      break;
    case "EOHyperedge@1":
      for (const p of entry.participants ?? []) {
        addRef(refs, p.ref);
        addRef(refs, p.surfaceKey);
        addRefs(refs, p.candidateReferents);
      }
      addRef(refs, entry.meta?.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOMention@1":
      addRef(refs, entry.referent);
      addRef(refs, entry.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOLexicalOccurrence@1":
      addRef(refs, entry.surfaceKey);
      addRef(refs, entry.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOExpectation@1":
      addRefs(refs, entry.grounds);
      addRefs(refs, entry.consequences);
      addRef(refs, entry.reframes);
      break;
    case "EOObligation@1":
      addRefs(refs, entry.grounds);
      addRefs(refs, entry.alternatives);
      addRefs(refs, entry.consequences);
      addRefs(refs, entry.resolutionRefs);
      if (typeof entry.distinction === "object") {
        for (const value of Object.values(entry.distinction)) addRef(refs, value);
      }
      break;
    case "EOPatternCandidate@1":
    case "EOMotifCandidate@1":
      addRefs(refs, entry.instances);
      addRefs(refs, entry.witnessRefs);
      break;
    case "EOOperation@1":
      addRefs(refs, entry.inputs);
      addRefs(refs, entry.outputs);
      addRef(refs, entry.witness);
      if (Array.isArray(entry.witness)) addRefs(refs, entry.witness);
      addRef(refs, entry.payload?.value?.id);
      addRef(refs, entry.payload?.id);
      break;
    default:
      break;
  }
  return refs;
}

export function hyperedge({ id, relation, participants = [], witness = null, scope = null, eo = null, meta = {} }) {
  if (!id) throw new TypeError("Hyperedge requires stable id");
  if (!relation) throw new TypeError("Hyperedge requires relation");
  if (!Array.isArray(participants) || participants.length === 0) throw new TypeError("Hyperedge requires participants");
  return freeze({ schema: "EOHyperedge@1", id, relation, participants: freeze(participants.map((p) => freeze({ ...p }))), witness, scope, eo, meta: freeze({ ...meta }) });
}

export function graphObject(value) {
  if (!value?.id || !value?.schema) throw new TypeError("graph object requires id and schema");
  return freeze({ ...value });
}

const addIndex = (map, key, id) => {
  if (key == null) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(id);
};
const removeIndex = (map, key, id) => {
  if (key == null) return;
  const bucket = map.get(key);
  if (!bucket) return;
  bucket.delete(id);
  if (bucket.size === 0) map.delete(key);
};

function indexKeys(entry) {
  const incident = new Set();
  if (entry?.schema === "EOHyperedge@1") {
    for (const p of entry.participants ?? []) {
      if (p.ref) incident.add(p.ref);
      if (p.surfaceKey) incident.add(p.surfaceKey);
    }
  }
  if (entry?.schema === "EOMention@1" && entry.referent) incident.add(entry.referent);
  if (entry?.schema === "EOLexicalOccurrence@1" && entry.surfaceKey) incident.add(entry.surfaceKey);
  const dependent = new Set([...referencesOf(entry)].filter((ref) => ref !== entry?.id));
  return { incident, dependent, relation: entry?.schema === "EOHyperedge@1" ? entry.relation ?? null : null,
    sequence: entry?.schema === "EOHyperedge@1" && Number.isFinite(entry?.scope?.sequencePosition) ? entry.scope.sequencePosition : null };
}

export function indexHypergraphEntries(graph, entries = []) {
  if (!graph?.byId || !graph?.incident || !graph?.dependent) throw new TypeError("indexHypergraphEntries requires an EO hypergraph index");
  const keysById = graph.keysById ?? new Map();
  graph.keysById = keysById;
  graph.relation ??= new Map();
  graph.sequence ??= new Map();
  for (const entry of entries) {
    if (!entry?.id) continue;
    // The perceiver re-emits a seen referent (and its gap) on every sentence
    // it appears in; within a refresh window it is the same object. Removing
    // and re-adding every one of its dependent keys for an entry that is
    // already the indexed object is work that changes nothing — measured at
    // 480 KB as 6% of the read, growing 16x for 2x the sentences.
    if (graph.byId.get(entry.id) === entry) continue;
    const priorKeys = keysById.get(entry.id);
    if (priorKeys) {
      for (const key of priorKeys.incident) removeIndex(graph.incident, key, entry.id);
      for (const key of priorKeys.dependent) removeIndex(graph.dependent, key, entry.id);
      removeIndex(graph.relation, priorKeys.relation, entry.id);
      removeIndex(graph.sequence, priorKeys.sequence, entry.id);
    }
    graph.byId.set(entry.id, entry);
    const keys = indexKeys(entry);
    keysById.set(entry.id, keys);
    for (const key of keys.incident) addIndex(graph.incident, key, entry.id);
    for (const key of keys.dependent) addIndex(graph.dependent, key, entry.id);
    addIndex(graph.relation, keys.relation, entry.id);
    addIndex(graph.sequence, keys.sequence, entry.id);
  }
  // (2026-09-07) `entries` was materialised — every indexed entry copied
  // into a fresh array — on EVERY call, and reading.js indexes three times
  // per sentence: O(fold) per sentence, 6% of a 480 KB read growing 16x for
  // 2x the sentences, for an array nothing in either tree reads. It is now
  // materialised when read, and the copy is kept until the next index call.
  MATERIALIZED.delete(graph);
  if (!Object.getOwnPropertyDescriptor(graph, "entries")?.get) {
    Object.defineProperty(graph, "entries", { enumerable: true, configurable: true, get() {
      let m = MATERIALIZED.get(graph);
      if (!m) { m = [...graph.byId.values()]; MATERIALIZED.set(graph, m); }
      return m;
    } });
  }
  return graph;
}
const MATERIALIZED = new WeakMap(); // graph -> its entries array, valid until the next index call

export function buildHypergraph(entries = []) {
  const graph = { schema: "EOHypergraph@1", entries: [], byId: new Map(), incident: new Map(), dependent: new Map(), relation: new Map(), sequence: new Map(), keysById: new Map() };
  return indexHypergraphEntries(graph, entries);
}

export function graphEntriesForIds(graph, ids = []) { return [...ids].map((id) => graph?.byId?.get(id)).filter(Boolean); }
export function graphEdgesForRelation(graph, relation) { return graphEntriesForIds(graph, graph?.relation?.get(relation) ?? []).filter((entry) => entry.schema === "EOHyperedge@1"); }
export function graphEdgesAtSequence(graph, sequencePosition) { return graphEntriesForIds(graph, graph?.sequence?.get(sequencePosition) ?? []).filter((entry) => entry.schema === "EOHyperedge@1"); }

export function relevantHypergraphNeighborhood(graph, seeds = [], { maxHops = 3, maxEntries = 500 } = {}) {
  if (!graph?.byId) return freeze({ schema: "EOHypergraphNeighborhood@1", entries: freeze([]), ids: freeze([]), truncated: false });
  const seedIds = new Set();
  for (const seed of seeds) {
    if (typeof seed === "string") seedIds.add(seed);
    else {
      if (seed?.id) seedIds.add(seed.id);
      for (const ref of referencesOf(seed)) seedIds.add(ref);
      for (const d of seed?.distinctions ?? []) {
        if (d?.ref) seedIds.add(d.ref);
        if (d?.referentId) seedIds.add(d.referentId);
      }
    }
  }
  const seen = new Set(seedIds);
  let frontier = new Set(seedIds);
  let truncated = false;
  const add = (id, next) => {
    if (!id || seen.has(id)) return;
    if (seen.size >= maxEntries + seedIds.size) { truncated = true; return; }
    seen.add(id); next.add(id);
  };
  for (let hop = 0; hop < maxHops && frontier.size && !truncated; hop += 1) {
    const next = new Set();
    for (const id of frontier) {
      for (const edgeId of graph.incident.get(id) ?? []) add(edgeId, next);
      for (const depId of graph.dependent.get(id) ?? []) add(depId, next);
      const entry = graph.byId.get(id);
      if (entry?.schema === "EOHyperedge@1") {
        for (const p of entry.participants ?? []) { add(p.ref, next); if (p.surfaceKey) add(p.surfaceKey, next); }
      }
      for (const ref of referencesOf(entry)) add(ref, next);
      if (truncated) break;
    }
    frontier = next;
  }
  const entries = [...seen].map((id) => graph.byId.get(id)).filter(Boolean);
  return freeze({ schema: "EOHypergraphNeighborhood@1", ids: freeze(entries.map((e) => e.id)), entries: freeze(entries), truncated });
}
