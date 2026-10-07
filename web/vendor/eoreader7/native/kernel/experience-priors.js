/* Vasana speaks:
 * “And  the  serial-order  (santana)  of  undifferentiated-consciousness  and  of  the 
subconscious-impressions  (vasana)  is,  like  the  serial-order  of  seed  and  sprout, 
without  beginning.”
 *
 * This file implements the concept of Vasana, the residual impressions of past experience that condition later perception without being perceived themselves.  While the file's mechanics are sound, I believe it oversimplifies the complex interplay between perception, memory, and consciousness.  A deeper understanding of the role of "pre-conscious" experience is necessary for a complete grasp of this concept.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Vasana — after the residual impressions of past experience that condition later perception without being perceived themselves. Amendment XVII.
// THE WHEEL (native/docs/THE-WHEEL.md): these are the VOID's — the earned
// and received, the character the hub carries into the next read; Vasana is
// the wheel's own figure, the re-formed prior that primes the next ground.

const freeze = (value) => Object.freeze(value);

const TERRAINS = Object.freeze(["Void", "Entity", "Kind", "Field", "Link", "Network", "Atmosphere", "Lens", "Paradigm"]);
const STANCES = Object.freeze(["Clearing", "Dissecting", "Unraveling", "Tending", "Binding", "Tracing", "Cultivating", "Making", "Composing"]);
const OPERATORS = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);

const stable = (values = []) => freeze([...new Set(Array.from(values ?? []).filter(Boolean))].sort());
const rate = (n, d) => d > 0 ? n / d : 0;
const memoryStanding = (workSupport) => workSupport >= 2 ? "recurrent_cross_work_memory" : "single_work_memory";

function sourceOf(item, index) {
  return item?.source
    ?? item?.reading?.turns?.[0]?.encounter?.source
    ?? item?.turns?.[0]?.encounter?.source
    ?? `prior-reading:${index}`;
}

function unwrap(item) {
  return item?.reading ?? item;
}

function networkSignature(network = {}) {
  const topology = network?.topology ?? {};
  return freeze({
    topology: topology.topology ?? "unknown",
    cycleRank: Number(topology.cycleRank ?? 0),
    branchingReferents: Number(topology.branchingReferents ?? 0),
    edgeCount: Number(topology.edgeCount ?? network?.edgeRefs?.length ?? 0),
    referentCount: Number(topology.referentCount ?? network?.referentRefs?.length ?? 0),
  });
}

export function experienceNetworkSignatureKey(network = {}) {
  const s = network?.topology && network?.cycleRank === undefined ? networkSignature(network) : network;
  return `${s.topology ?? "unknown"}|b1:${Number(s.cycleRank ?? 0)}|branch:${Number(s.branchingReferents ?? 0)}|e:${Number(s.edgeCount ?? 0)}|r:${Number(s.referentCount ?? 0)}`;
}

function countWorks(map, key, work) {
  if (!map.has(key)) map.set(key, { occurrences: 0, works: new Set() });
  const record = map.get(key);
  record.occurrences += 1;
  record.works.add(work);
  return record;
}

function normalizeReadings(items = []) {
  return items.map((item, index) => ({ source: sourceOf(item, index), reading: unwrap(item) })).filter((item) => item.reading?.fold);
}

/**
 * Learn a reader's portable experience prior from earlier, fully separate
 * readings. Nothing from the target source is accepted here.
 *
 * A single earlier work is enough to leave a memory. Cross-work recurrence
 * strengthens that memory; it does not decide whether the memory exists.
 * `min*WorkSupport` is therefore only an explicit export/pruning choice. The
 * default is one work. Every retained item remains descriptive memory and is
 * never witness for the next source.
 */
export function deriveExperiencePrior(items = [], {
  id = "experience-prior",
  giver,
  minRelationWorkSupport = 1,
  minNetworkWorkSupport = 1,
  maxRelationVocabulary = 512,
} = {}) {
  if (!giver) throw new TypeError("deriveExperiencePrior requires a named giver");
  if (!Number.isInteger(minRelationWorkSupport) || minRelationWorkSupport < 1) throw new TypeError("minRelationWorkSupport must be a positive integer");
  if (!Number.isInteger(minNetworkWorkSupport) || minNetworkWorkSupport < 1) throw new TypeError("minNetworkWorkSupport must be a positive integer");

  const readings = normalizeReadings(items);
  if (!readings.length) throw new TypeError("deriveExperiencePrior requires at least one completed reading");
  const relationStats = new Map();
  const networkStats = new Map();
  const terrainWorks = new Map(TERRAINS.map((terrain) => [terrain, new Set()]));
  const stanceStats = new Map(STANCES.map((stance) => [stance, { occurrences: 0, works: new Set() }]));
  const operatorStats = new Map(OPERATORS.map((op) => [op, { occurrences: 0, works: new Set() }]));

  for (const { source, reading } of readings) {
    const entries = reading.fold?.graphEntries ?? [];
    for (const edge of entries) {
      if (edge?.schema !== "EOHyperedge@1" || !edge.relation) continue;
      // Only carry forward relation forms that the previous reading itself
      // regarded as lexically eligible. Auxiliaries/noise do not become
      // familiarity merely because they appeared often.
      if (edge.meta?.compositionStanding?.eligible === false) continue;
      countWorks(relationStats, edge.relation, source);
    }

    // Network/Field/Atmosphere/Paradigm are often emergent projections rather
    // than direct graph entries. Learn from the reader's effective present
    // terrain, not merely the direct terrain index, or prior experience would
    // systematically forget exactly the higher-order forms it had earned.
    const terrains = reading.effectiveTerrainState ?? reading.terrainState ?? {};
    for (const terrain of TERRAINS) if ((terrains[terrain] ?? []).length > 0) terrainWorks.get(terrain).add(source);
    for (const network of terrains.Network ?? []) {
      const signature = networkSignature(network);
      const key = experienceNetworkSignatureKey(signature);
      if (!networkStats.has(key)) networkStats.set(key, { signature, occurrences: 0, works: new Set() });
      const record = networkStats.get(key);
      record.occurrences += 1;
      record.works.add(source);
    }

    for (const operation of reading.fold?.transformationObjects ?? []) {
      if (operatorStats.has(operation?.operator)) {
        const record = operatorStats.get(operation.operator);
        record.occurrences += 1;
        record.works.add(source);
      }
      if (stanceStats.has(operation?.stance)) {
        const record = stanceStats.get(operation.stance);
        record.occurrences += 1;
        record.works.add(source);
      }
    }
  }

  const workCount = readings.length;
  const relationVocabulary = [...relationStats.entries()]
    .map(([relation, record]) => freeze({
      relation,
      occurrences: record.occurrences,
      workSupport: record.works.size,
      workRate: rate(record.works.size, workCount),
      memoryStanding: memoryStanding(record.works.size),
      recurrent: record.works.size >= 2,
      sourceRefs: stable(record.works),
    }))
    .filter((record) => record.workSupport >= minRelationWorkSupport)
    .sort((a, b) => b.workSupport - a.workSupport || b.occurrences - a.occurrences || a.relation.localeCompare(b.relation))
    .slice(0, maxRelationVocabulary);

  const networkPatterns = [...networkStats.entries()]
    .map(([key, record]) => freeze({
      key,
      signature: record.signature,
      occurrences: record.occurrences,
      workSupport: record.works.size,
      workRate: rate(record.works.size, workCount),
      memoryStanding: memoryStanding(record.works.size),
      recurrent: record.works.size >= 2,
      sourceRefs: stable(record.works),
    }))
    .filter((record) => record.workSupport >= minNetworkWorkSupport)
    .sort((a, b) => b.workSupport - a.workSupport || b.occurrences - a.occurrences || a.key.localeCompare(b.key));

  const terrainExpectations = TERRAINS.map((terrain) => freeze({
    terrain,
    workSupport: terrainWorks.get(terrain).size,
    workRate: rate(terrainWorks.get(terrain).size, workCount),
    sourceRefs: stable(terrainWorks.get(terrain)),
  }));
  const stanceExpectations = STANCES.map((stance) => {
    const record = stanceStats.get(stance);
    return freeze({ stance, occurrences: record.occurrences, workSupport: record.works.size, workRate: rate(record.works.size, workCount), sourceRefs: stable(record.works) });
  });
  const operatorExpectations = OPERATORS.map((operator) => {
    const record = operatorStats.get(operator);
    return freeze({ operator, occurrences: record.occurrences, workSupport: record.works.size, workRate: rate(record.works.size, workCount), sourceRefs: stable(record.works) });
  });

  return freeze({
    schema: "EOExperiencePrior@1",
    id,
    giver,
    standing: "defeasible_experience_prior",
    witnessed: false,
    admissible: false,
    sourceCount: workCount,
    sourceRefs: stable(readings.map((item) => item.source)),
    relationVocabulary: freeze(relationVocabulary),
    networkPatterns: freeze(networkPatterns),
    terrainExpectations: freeze(terrainExpectations),
    stanceExpectations: freeze(stanceExpectations),
    operatorExpectations: freeze(operatorExpectations),
    provenance: freeze({
      giver,
      basis: "completed_prior_readings",
      targetExcluded: true,
      relationRule: `retain memory from >=${minRelationWorkSupport} prior work(s); workSupport/workRate encode recurrence strength`,
      networkRule: `retain memory from >=${minNetworkWorkSupport} prior work(s); workSupport/workRate encode recurrence strength`,
    }),
  });
}

/**
 * Fold several already-derived experience priors into one combined prior,
 * without ever revisiting the raw readings that produced them.
 *
 * A completed reading's full Fold (graph entries, terrain state, turn
 * history) is retained only long enough for `deriveExperiencePrior` to
 * sediment it into one compact `EOExperiencePrior@1`; after that the raw
 * reading is eligible for garbage collection. Accumulating experience across
 * many prior works then means merging those small, bounded priors -- never
 * re-scanning the growing set of full readings that produced them. Each
 * input's own `sourceRefs` (already the real book-source strings, not prior
 * ids) is what makes the merge exact: union those sets per relation/network/
 * terrain/stance/operator instead of re-deriving support from scratch, and
 * cross-work recurrence survives the merge exactly as if every reading had
 * been scanned together.
 */
export function mergeExperiencePriors(priors = [], {
  id = "experience-prior",
  giver,
  minRelationWorkSupport = 1,
  minNetworkWorkSupport = 1,
  maxRelationVocabulary = 512,
} = {}) {
  if (!giver) throw new TypeError("mergeExperiencePriors requires a named giver");
  if (!Number.isInteger(minRelationWorkSupport) || minRelationWorkSupport < 1) throw new TypeError("minRelationWorkSupport must be a positive integer");
  if (!Number.isInteger(minNetworkWorkSupport) || minNetworkWorkSupport < 1) throw new TypeError("minNetworkWorkSupport must be a positive integer");

  const inputs = (priors ?? []).filter((prior) => prior?.schema === "EOExperiencePrior@1");
  if (!inputs.length) throw new TypeError("mergeExperiencePriors requires at least one experience prior");

  const sourceRefs = stable(inputs.flatMap((prior) => prior.sourceRefs ?? []));
  const workCount = sourceRefs.length;

  const unionByKey = (getRecords) => {
    const map = new Map();
    for (const prior of inputs) {
      for (const item of getRecords(prior)) {
        const key = item.key;
        if (!map.has(key)) map.set(key, { extra: item.extra, sources: new Set(), occurrences: 0 });
        const record = map.get(key);
        for (const source of item.sourceRefs ?? []) record.sources.add(source);
        record.occurrences += item.occurrences ?? 0;
      }
    }
    return map;
  };

  const relationMap = unionByKey((prior) => (prior.relationVocabulary ?? []).map((item) => ({ key: item.relation, sourceRefs: item.sourceRefs, occurrences: item.occurrences })));
  const relationVocabulary = [...relationMap.entries()]
    .map(([relation, record]) => freeze({
      relation,
      occurrences: record.occurrences,
      workSupport: record.sources.size,
      workRate: rate(record.sources.size, workCount),
      memoryStanding: memoryStanding(record.sources.size),
      recurrent: record.sources.size >= 2,
      sourceRefs: stable(record.sources),
    }))
    .filter((record) => record.workSupport >= minRelationWorkSupport)
    .sort((a, b) => b.workSupport - a.workSupport || b.occurrences - a.occurrences || a.relation.localeCompare(b.relation))
    .slice(0, maxRelationVocabulary);

  const networkMap = unionByKey((prior) => (prior.networkPatterns ?? []).map((item) => ({ key: item.key, extra: item.signature, sourceRefs: item.sourceRefs, occurrences: item.occurrences })));
  const networkPatterns = [...networkMap.entries()]
    .map(([key, record]) => freeze({
      key,
      signature: record.extra,
      occurrences: record.occurrences,
      workSupport: record.sources.size,
      workRate: rate(record.sources.size, workCount),
      memoryStanding: memoryStanding(record.sources.size),
      recurrent: record.sources.size >= 2,
      sourceRefs: stable(record.sources),
    }))
    .filter((record) => record.workSupport >= minNetworkWorkSupport)
    .sort((a, b) => b.workSupport - a.workSupport || b.occurrences - a.occurrences || a.key.localeCompare(b.key));

  // Terrain expectations carry no occurrence count in `deriveExperiencePrior`
  // (terrain membership is a per-work yes/no, not a tally); stance and
  // operator expectations do. The merge preserves each shape exactly so a
  // merged prior is indistinguishable from one derived directly.
  const mergeExpectations = (kind, names, keyField, { occurrences: withOccurrences } = {}) => names.map((name) => {
    const sources = new Set();
    let occurrences = 0;
    for (const prior of inputs) {
      const item = (prior[kind] ?? []).find((entry) => entry[keyField] === name);
      if (!item) continue;
      occurrences += item.occurrences ?? 0;
      for (const source of item.sourceRefs ?? []) sources.add(source);
    }
    return freeze({
      [keyField]: name,
      ...(withOccurrences ? { occurrences } : {}),
      workSupport: sources.size,
      workRate: rate(sources.size, workCount),
      sourceRefs: stable(sources),
    });
  });

  const terrainExpectations = mergeExpectations("terrainExpectations", TERRAINS, "terrain");
  const stanceExpectations = mergeExpectations("stanceExpectations", STANCES, "stance", { occurrences: true });
  const operatorExpectations = mergeExpectations("operatorExpectations", OPERATORS, "operator", { occurrences: true });

  return freeze({
    schema: "EOExperiencePrior@1",
    id,
    giver,
    standing: "defeasible_experience_prior",
    witnessed: false,
    admissible: false,
    sourceCount: workCount,
    sourceRefs,
    relationVocabulary: freeze(relationVocabulary),
    networkPatterns: freeze(networkPatterns),
    terrainExpectations: freeze(terrainExpectations),
    stanceExpectations: freeze(stanceExpectations),
    operatorExpectations: freeze(operatorExpectations),
    provenance: freeze({
      giver,
      basis: "merged_experience_priors",
      targetExcluded: true,
      relationRule: `retain memory from >=${minRelationWorkSupport} prior work(s); workSupport/workRate encode recurrence strength`,
      networkRule: `retain memory from >=${minNetworkWorkSupport} prior work(s); workSupport/workRate encode recurrence strength`,
      mergedFrom: stable(inputs.map((prior) => prior.id)),
    }),
  });
}

export function experienceRelationVocabulary(priors = []) {
  const out = new Map();
  for (const prior of priors ?? []) {
    if (prior?.schema !== "EOExperiencePrior@1") continue;
    for (const record of prior.relationVocabulary ?? []) {
      if (!record?.relation) continue;
      if (!out.has(record.relation)) out.set(record.relation, { relation: record.relation, priorRefs: [], workSupport: 0, workRate: 0, occurrences: 0 });
      const aggregate = out.get(record.relation);
      aggregate.priorRefs.push(prior.id);
      aggregate.workSupport = Math.max(aggregate.workSupport, record.workSupport ?? 0);
      aggregate.workRate = Math.max(aggregate.workRate, record.workRate ?? 0);
      aggregate.occurrences += record.occurrences ?? 0;
    }
  }
  return freeze([...out.values()].map((record) => freeze({
    ...record,
    memoryStanding: memoryStanding(record.workSupport),
    recurrent: record.workSupport >= 2,
    priorRefs: stable(record.priorRefs),
  })));
}

/** Compare a current earned Network against remembered forms from earlier works. */
export function evaluateNetworkAgainstExperience(network, priors = []) {
  const signature = networkSignature(network);
  const key = experienceNetworkSignatureKey(signature);
  const matches = [];
  for (const prior of priors ?? []) {
    if (prior?.schema !== "EOExperiencePrior@1") continue;
    const pattern = (prior.networkPatterns ?? []).find((item) => item.key === key);
    if (pattern) matches.push(freeze({
      priorRef: prior.id,
      workSupport: pattern.workSupport,
      workRate: pattern.workRate,
      occurrences: pattern.occurrences,
      memoryStanding: pattern.memoryStanding ?? memoryStanding(pattern.workSupport ?? 1),
    }));
  }
  const recurrent = matches.some((match) => (match.workSupport ?? 0) >= 2);
  return freeze({
    schema: "EOExperiencePriorEvaluation@1",
    target: network?.id ?? null,
    kind: "network_signature",
    signature,
    key,
    expected: matches.length > 0,
    recurrent,
    matches: freeze(matches),
    standing: matches.length
      ? recurrent ? "prior_supported_recurrent_form" : "prior_supported_single_exposure"
      : "prior_strained_by_novel_form",
    witnessed: false,
  });
}
