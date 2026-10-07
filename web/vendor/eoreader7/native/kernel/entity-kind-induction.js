// stableHash/seedFrom/createSeededRng/shuffled used to be defined here,
// independently of contest.js's own private `lcg` — one need (a seeded
// null-distribution draw) met twice in two files that never searched for
// each other. Both now live in kernel/rng.js; see that file's header for
// why the two different generators are kept apart rather than merged into
// one algorithm.
import { stableHash, createSeededRng, shuffled } from "./rng.js";

const freeze = (value) => Object.freeze(value);

function quantileAt(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.min(1, q)) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function empiricalNull({ observed, samples, quantile = 0.95, protocol }) {
  const threshold = quantileAt(samples, quantile);
  const exceed = samples.filter((sample) => sample >= observed).length;
  const pValue = (exceed + 1) / (samples.length + 1);
  return freeze({
    schema: "EONullResult@1",
    observed,
    threshold,
    quantile,
    pValue,
    passed: observed > threshold,
    protocol: freeze({ ...protocol }),
  });
}

function structuralEntities(entityFeatures) {
  const out = [];
  for (const [entityRef, features] of entityFeatures ?? []) {
    const attributes = [];
    for (const [signature, record] of features ?? []) {
      attributes.push(freeze({
        signature,
        featureKey: record.featureKey,
        featureValue: record.featureValue,
        count: record.evidenceIds?.size ?? 1,
        firstAt: record.firstAt,
        lastAt: record.lastAt,
      }));
    }
    if (attributes.length) out.push(freeze({ id: entityRef, attributes: freeze(attributes) }));
  }
  return out;
}

/**
 * A parameter is only a possible interaction channel. It is not a Kind and it
 * carries no semantic label. Its role is analogous to a measurable degree of
 * freedom in a physical system: useful for describing how an Entity responds
 * to the surrounding relational field.
 */
export function induceEntityParameters(entityFeatures, {
  minEntityCount,
  minPrevalence,
  population = "entities:anonymous",
} = {}) {
  const entities = structuralEntities(entityFeatures);
  const n = entities.length;
  const resolvedMinEntityCount = minEntityCount ?? Math.max(3, Math.ceil(Math.sqrt(Math.max(1, n))));
  const resolvedMinPrevalence = minPrevalence ?? 1 / Math.max(2, Math.sqrt(Math.max(1, n)));
  if (n < resolvedMinEntityCount) return freeze([]);

  const bySignature = new Map();
  for (const entity of entities) {
    for (const attr of entity.attributes) {
      if (!bySignature.has(attr.signature)) bySignature.set(attr.signature, { attr, members: new Set() });
      bySignature.get(attr.signature).members.add(entity.id);
    }
  }

  const out = [];
  for (const [signature, entry] of bySignature) {
    const memberCount = entry.members.size;
    const prevalence = memberCount / n;
    if (memberCount < 2 || prevalence < resolvedMinPrevalence) continue;
    const informationWeight = 1 + Math.log((n + 1) / (memberCount + 1));
    out.push(freeze({
      schema: "EOParameterHypothesis@1",
      id: `parameter:${stableHash(`${population}|${signature}`)}`,
      signature,
      featureKey: entry.attr.featureKey,
      featureValue: entry.attr.featureValue,
      memberRefs: freeze([...entry.members].sort()),
      prevalence,
      memberCount,
      populationCount: n,
      informationWeight,
      standing: "structural_parameter_hypothesis",
      witnessed: false,
      admissible: false,
      basis: "recurrent_interaction_channel",
    }));
  }
  out.sort((a, b) => b.informationWeight - a.informationWeight || b.prevalence - a.prevalence || a.signature.localeCompare(b.signature));
  return freeze(out);
}

export function profileJaccard(a, b) {
  if (a.length !== b.length) return 0;
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === 1 && b[i] === 1) intersection += 1;
    if (a[i] === 1 || b[i] === 1) union += 1;
  }
  return union === 0 ? 0 : intersection / union;
}

function featureStatistics(entities) {
  const support = new Map();
  for (const entity of entities) {
    for (const attr of entity.attributes) support.set(attr.signature, (support.get(attr.signature) ?? 0) + 1);
  }
  const n = entities.length;
  return new Map([...support].map(([signature, count]) => [signature, freeze({
    support: count,
    prevalence: n ? count / n : 0,
    weight: 1 + Math.log((n + 1) / (count + 1)),
  })]));
}

function fieldProfile(entity, stats) {
  const values = new Map();
  let selfEnergy = 0;
  for (const attr of entity.attributes) {
    const weight = stats.get(attr.signature)?.weight ?? 1;
    const activity = 1 + Math.log(Math.max(1, attr.count));
    values.set(attr.signature, activity);
    selfEnergy += weight * activity * activity;
  }
  return freeze({ values, selfEnergy });
}

/**
 * Structural affinity is a potential, not a type score. Two Entities attract
 * when independently witnessed interaction channels make them respond to the
 * surrounding world in the same way. Common channels contribute less energy;
 * repeated channels contribute more. The normalization prevents high-activity
 * Entities from attracting everything merely because they are massive.
 */
function structuralAffinity(profileA, profileB, stats) {
  if (!(profileA?.selfEnergy > 0) || !(profileB?.selfEnergy > 0)) return 0;
  const [small, large] = profileA.values.size <= profileB.values.size
    ? [profileA.values, profileB.values]
    : [profileB.values, profileA.values];
  let sharedEnergy = 0;
  for (const [signature, activityA] of small) {
    const activityB = large.get(signature);
    if (activityB === undefined) continue;
    sharedEnergy += (stats.get(signature)?.weight ?? 1) * activityA * activityB;
  }
  return sharedEnergy / Math.sqrt(profileA.selfEnergy * profileB.selfEnergy);
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function affinityField(entities, { bondQuantile = 0.75, minAffinity = 0.12, bondThreshold = null } = {}) {
  const stats = featureStatistics(entities);
  const profiles = new Map(entities.map((entity) => [entity.id, fieldProfile(entity, stats)]));
  const pairAffinity = new Map();
  const positive = [];
  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const affinity = structuralAffinity(profiles.get(entities[i].id), profiles.get(entities[j].id), stats);
      pairAffinity.set(pairKey(entities[i].id, entities[j].id), affinity);
      if (affinity > 0) positive.push(affinity);
    }
  }
  const emergentThreshold = bondThreshold ?? Math.max(minAffinity, quantileAt(positive, bondQuantile));
  return freeze({ stats, profiles, pairAffinity, bondThreshold: emergentThreshold, bondQuantile, minAffinity });
}

function affinityBetween(field, a, b) {
  if (a === b) return 1;
  return field.pairAffinity.get(pairKey(a, b)) ?? 0;
}

function mutualBonds(entityIds, field, neighborCount) {
  const nearest = new Map();
  for (const id of entityIds) {
    const neighbors = entityIds
      .filter((other) => other !== id)
      .map((other) => ({ id: other, affinity: affinityBetween(field, id, other) }))
      .filter((entry) => entry.affinity >= field.bondThreshold)
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, neighborCount);
    nearest.set(id, new Set(neighbors.map((entry) => entry.id)));
  }
  const bonds = [];
  for (let i = 0; i < entityIds.length; i += 1) {
    for (let j = i + 1; j < entityIds.length; j += 1) {
      const a = entityIds[i];
      const b = entityIds[j];
      if (!nearest.get(a)?.has(b) || !nearest.get(b)?.has(a)) continue;
      bonds.push(freeze({ a, b, affinity: affinityBetween(field, a, b) }));
    }
  }
  return freeze(bonds);
}

function connectedBasins(entityIds, bonds, minKindSize) {
  const adjacency = new Map(entityIds.map((id) => [id, new Set()]));
  for (const bond of bonds) {
    adjacency.get(bond.a)?.add(bond.b);
    adjacency.get(bond.b)?.add(bond.a);
  }
  const seen = new Set();
  const basins = [];
  for (const id of entityIds) {
    if (seen.has(id) || !(adjacency.get(id)?.size > 0)) continue;
    const stack = [id];
    const members = [];
    seen.add(id);
    while (stack.length) {
      const current = stack.pop();
      members.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    if (members.length >= minKindSize) basins.push(members.sort());
  }
  return basins;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function basinEnergy(memberIds, entityIds, field) {
  const members = new Set(memberIds);
  const internal = [];
  const boundary = [];
  for (let i = 0; i < memberIds.length; i += 1) {
    for (let j = i + 1; j < memberIds.length; j += 1) internal.push(affinityBetween(field, memberIds[i], memberIds[j]));
  }
  for (const member of memberIds) {
    for (const other of entityIds) {
      if (members.has(other)) continue;
      boundary.push(affinityBetween(field, member, other));
    }
  }
  const internalAffinity = mean(internal);
  const boundaryAffinity = mean(boundary);
  return freeze({
    internalAffinity,
    boundaryAffinity,
    bindingEnergy: internalAffinity - boundaryAffinity,
    internalPairs: internal.length,
    boundaryPairs: boundary.length,
  });
}

function standardParameters(memberIds, entitiesById, parameters, minPrevalence) {
  const out = [];
  for (const parameter of parameters) {
    let count = 0;
    for (const id of memberIds) {
      const entity = entitiesById.get(id);
      if (entity?.attributes.some((attr) => attr.signature === parameter.signature)) count += 1;
    }
    const prevalence = memberIds.length ? count / memberIds.length : 0;
    if (prevalence < Math.max(0.5, minPrevalence)) continue;
    const distinctiveness = parameter.prevalence > 0 ? prevalence / parameter.prevalence : 0;
    out.push(freeze({
      parameterRef: parameter.id,
      signature: parameter.signature,
      featureKey: parameter.featureKey,
      featureValue: parameter.featureValue,
      prevalence,
      populationPrevalence: parameter.prevalence,
      distinctiveness,
      fieldWeight: parameter.informationWeight ?? 1,
    }));
  }
  out.sort((a, b) => b.distinctiveness - a.distinctiveness || b.fieldWeight - a.fieldWeight || b.prevalence - a.prevalence || a.signature.localeCompare(b.signature));
  return freeze(out);
}

/**
 * Candidate Kinds are now discovered as stable basins in an interaction field.
 * This is closer to chemistry than taxonomy: shared properties do not define a
 * Kind; they contribute potential. A population becomes interesting only when
 * mutual structural affinity binds it more strongly to itself than to the
 * surrounding population and that binding survives a random-subset null.
 *
 * These basins remain hypotheses. A downstream temporal/counterfactual gate
 * must still show that basin membership changes later lawful expectations
 * before Kind terrain can be admitted.
 */
export function induceEntityKindCandidates(entityFeatures, {
  minEntityCount,
  minPrevalence,
  cohesionThreshold = null,
  minKindSize,
  permutations,
  quantile = 0.95,
  bondQuantile = 0.75,
  minAffinity = 0.12,
  neighborCount = null,
  population = "entities:anonymous",
} = {}) {
  const entities = structuralEntities(entityFeatures);
  const n = entities.length;
  const resolvedMinEntityCount = minEntityCount ?? Math.max(3, Math.ceil(Math.sqrt(Math.max(1, n))));
  const resolvedMinPrevalence = minPrevalence ?? 1 / Math.max(2, Math.sqrt(Math.max(1, n)));
  const resolvedMinKindSize = minKindSize ?? Math.max(2, Math.floor(Math.sqrt(Math.max(1, n)) / 2));
  const resolvedPermutations = permutations ?? Math.min(128, Math.max(40, Math.round(n * 4)));
  if (n < resolvedMinEntityCount) return freeze({ candidates: freeze([]), parameters: freeze([]), diagnostics: freeze({ entities: n, parameters: 0, basins: 0, clusters: 0, validated: 0 }) });

  const parameters = induceEntityParameters(entityFeatures, {
    minEntityCount: resolvedMinEntityCount,
    minPrevalence: resolvedMinPrevalence,
    population,
  });
  if (!parameters.length) return freeze({ candidates: freeze([]), parameters, diagnostics: freeze({ entities: n, parameters: 0, basins: 0, clusters: 0, validated: 0 }) });

  const field = affinityField(entities, {
    bondQuantile,
    minAffinity,
    bondThreshold: cohesionThreshold,
  });
  const entityIds = entities.map((entity) => entity.id);
  const resolvedNeighborCount = neighborCount ?? Math.max(2, Math.ceil(Math.sqrt(n)));
  const bonds = mutualBonds(entityIds, field, resolvedNeighborCount);
  const basins = connectedBasins(entityIds, bonds, resolvedMinKindSize);
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const records = [];

  for (const memberIds of basins) {
    const energy = basinEnergy(memberIds, entityIds, field);
    if (!(energy.bindingEnergy > 0)) continue;
    const rng = createSeededRng({ population, memberIds, purpose: "interaction-basin-binding-null" });
    const nullSamples = [];
    for (let i = 0; i < resolvedPermutations; i += 1) {
      const sampleIds = shuffled(entityIds, rng).slice(0, memberIds.length);
      nullSamples.push(basinEnergy(sampleIds, entityIds, field).bindingEnergy);
    }
    const bindingNull = empiricalNull({
      observed: energy.bindingEnergy,
      samples: nullSamples,
      quantile,
      protocol: {
        name: "random-subset-binding-energy",
        iterations: resolvedPermutations,
        statistic: "internal-affinity-minus-boundary-affinity",
        scope: `${population} members:${memberIds.length}`,
      },
    });
    const standards = standardParameters(memberIds, entitiesById, parameters, resolvedMinPrevalence);
    const coreSignatures = standards.slice(0, 6).map((item) => item.signature).sort();
    const kindKey = `kind:basin:${stableHash(`${population}|${coreSignatures.join("|") || memberIds.join("|")}`)}`;
    const evidenceRefs = [...new Set(memberIds.flatMap((id) =>
      [...(entityFeatures.get(id)?.values() ?? [])].flatMap((record) => [...(record.evidenceIds ?? [])])))].sort();
    const witnessRefs = [...new Set(memberIds.flatMap((id) =>
      [...(entityFeatures.get(id)?.values() ?? [])].flatMap((record) => [...(record.witnessRefs ?? [])])))].sort();
    const basinBonds = bonds.filter((bond) => memberIds.includes(bond.a) && memberIds.includes(bond.b));

    records.push(freeze({
      schema: "EOKindCandidate@1",
      id: `kind-candidate:${stableHash(`${kindKey}|${memberIds.join("|")}`)}`,
      kindKey,
      standing: "structural_kind_hypothesis",
      mechanism: "interaction_affinity_basin",
      witnessed: false,
      admissible: false,
      memberRefs: freeze([...memberIds]),
      memberCount: memberIds.length,
      standardParameters: standards,
      distinguishingParameters: freeze(standards.slice(0, 6)),
      structuralSignatures: freeze(coreSignatures),
      cohesion: energy.internalAffinity,
      cohesionThreshold: field.bondThreshold,
      cohesionNull: bindingNull,
      field: freeze({
        model: "weighted_relational_affinity",
        bondThreshold: field.bondThreshold,
        bondQuantile: field.bondQuantile,
        neighborCount: resolvedNeighborCount,
        internalAffinity: energy.internalAffinity,
        boundaryAffinity: energy.boundaryAffinity,
        bindingEnergy: energy.bindingEnergy,
        stable: bindingNull.passed,
        bonds: freeze(basinBonds),
      }),
      evidenceRefs: freeze(evidenceRefs),
      witnessRefs: freeze(witnessRefs),
      basis: "stable_relational_affinity_basin",
      provenance: freeze({ giver: "kernel/entity-kind-induction", predecessor: "eoreader5/entity-kinds", model: "field_basin" }),
    }));
  }

  const validated = records.filter((candidate) => candidate.field?.stable === true)
    .sort((a, b) => b.field.bindingEnergy - a.field.bindingEnergy || b.memberCount - a.memberCount);
  const fallback = [...records].sort((a, b) => b.field.bindingEnergy - a.field.bindingEnergy || b.memberCount - a.memberCount)[0] ?? null;
  const candidates = validated.length
    ? validated
    : fallback
      ? [freeze({ ...fallback, fallbackNomination: true })]
      : [];

  return freeze({
    candidates: freeze(candidates),
    parameters,
    diagnostics: freeze({
      entities: n,
      parameters: parameters.length,
      basins: records.length,
      clusters: records.length,
      validated: validated.length,
      bondThreshold: field.bondThreshold,
      neighborCount: resolvedNeighborCount,
      minKindSize: resolvedMinKindSize,
      fallbackUsed: validated.length === 0 && Boolean(fallback),
      model: "weighted_relational_affinity",
    }),
  });
}

/**
 * NUL·Pattern — Differentiate · Existence at Pattern grain: challenge a
 * DECLARED kind membership against the SAME random-subset binding-energy
 * null `induceEntityKindCandidates` runs on its own discovered basins.
 *
 * The inducer answers "what kinds does this population's interaction field
 * suggest" (SIG·Pattern — signing a recurring kind, provisionally). This
 * function answers the opposite-facing question: a CALLER already holds a
 * membership hypothesis — these particular entities form a kind — and asks
 * whether that declared set binds to itself more strongly than to the
 * surrounding population, beyond what random subsets of the same size
 * produce in the same field. Differentiating a declared Kind against its
 * own null is the Unraveling half of the pair; nothing here discovers
 * anything.
 *
 * Two decisions, disclosed:
 *  - `cleared` mirrors the inducer's own gate exactly (`bindingEnergy > 0`
 *    AND the null passes). The null is still run and reported when binding
 *    is non-positive — the caller asked a question and the measurement is
 *    the answer — but a non-positive binding can never clear, matching the
 *    inducer's `if (!(energy.bindingEnergy > 0)) continue`.
 *  - The two doors share the null's PROTOCOL, not its draws: the RNG
 *    purpose string differs from the inducer's on purpose, so the
 *    identical member set draws different subsets through each door —
 *    shared draws would make any cross-organ agreement check circular.
 *  - The refusals are STRUCTURAL, never tuned floors: fewer than 2
 *    measurable members means no internal pair exists; members covering the
 *    whole population means no boundary pair exists. In both cases the
 *    statistic is insensitive to its own perturbation — running it would
 *    produce an unfalsifiable number, so it is refused instead (the
 *    licensing discipline nul's A10 states: check the pair is licensed
 *    before spending a null).
 */
export function testKindMembers(entityFeatures, memberIds, {
  permutations,
  quantile = 0.95,
  bondQuantile = 0.75,
  minAffinity = 0.12,
  cohesionThreshold = null,
  population = "entities:anonymous",
} = {}) {
  const entities = structuralEntities(entityFeatures);
  const measurable = new Set(entities.map((entity) => entity.id));
  const requested = [...new Set([...(memberIds ?? [])].map(String))];
  const unknown = requested.filter((id) => !measurable.has(id)).sort();
  if (unknown.length) {
    return freeze({
      refused: freeze({
        type: "unknown_members",
        unknown: freeze(unknown),
        detail: "these ids have no measurable structural profile in this population (absent from the feature index, or featureless) — a membership test over them would be measuring nothing",
      }),
    });
  }
  if (requested.length < 2) {
    return freeze({
      refused: freeze({
        type: "under_powered",
        memberCount: requested.length,
        floor: 2,
        detail: "fewer than 2 members has no internal pair — internal affinity does not exist, so the binding statistic is structurally undefined, not merely weak",
      }),
    });
  }
  if (requested.length >= entities.length) {
    return freeze({
      refused: freeze({
        type: "no_boundary",
        memberCount: requested.length,
        populationCount: entities.length,
        detail: "the declared members cover the whole measurable population — no boundary pair exists and every random subset of this size is the set itself, so the null cannot perturb anything",
      }),
    });
  }
  const field = affinityField(entities, { bondQuantile, minAffinity, bondThreshold: cohesionThreshold });
  const entityIds = entities.map((entity) => entity.id);
  const members = [...requested].sort();
  const energy = basinEnergy(members, entityIds, field);
  const resolvedPermutations = permutations ?? Math.min(128, Math.max(40, Math.round(entities.length * 4)));
  const rng = createSeededRng({ population, memberIds: members, purpose: "declared-membership-binding-null" });
  const nullSamples = [];
  for (let i = 0; i < resolvedPermutations; i += 1) {
    const sampleIds = shuffled(entityIds, rng).slice(0, members.length);
    nullSamples.push(basinEnergy(sampleIds, entityIds, field).bindingEnergy);
  }
  const bindingNull = empiricalNull({
    observed: energy.bindingEnergy,
    samples: nullSamples,
    quantile,
    protocol: {
      name: "random-subset-binding-energy",
      iterations: resolvedPermutations,
      statistic: "internal-affinity-minus-boundary-affinity",
      scope: `${population} declared-members:${members.length}`,
    },
  });
  return freeze({
    schema: "EOKindMembershipTest@1",
    memberRefs: freeze(members),
    memberCount: members.length,
    populationCount: entities.length,
    energy,
    bindingNull,
    cleared: energy.bindingEnergy > 0 && bindingNull.passed,
  });
}
