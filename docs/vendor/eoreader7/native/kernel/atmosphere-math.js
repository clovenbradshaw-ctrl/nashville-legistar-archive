const freeze = (value) => Object.freeze(value);
const unique = (values = []) => [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))];

function nestedReferenceValues(value, out = new Set()) {
  if (value == null) return out;
  if (typeof value === "string") {
    if (/^(ref|ref-occ|occ|edge|expectation|obligation|identity|composition|frame|pattern|motif|task):/.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) nestedReferenceValues(item, out);
    return out;
  }
  if (typeof value === "object") for (const item of Object.values(value)) nestedReferenceValues(item, out);
  return out;
}

function obligationRefs(obligation) {
  const refs = new Set([...(obligation?.grounds ?? []), ...(obligation?.alternatives ?? [])].filter(Boolean).map(String));
  for (const ref of nestedReferenceValues(obligation?.consequences ?? [])) refs.add(ref);
  return refs;
}

function persistenceOf(obligation, sequence) {
  const stored = Math.max(0, Number(obligation?.persistence ?? 0));
  if (!Number.isFinite(sequence) || !Number.isFinite(obligation?.openedAt)) return stored;
  return Math.max(stored, sequence - obligation.openedAt + 1, 0);
}

function explicitFactor(obligation) {
  const constraint = obligation?.constraint;
  if (!constraint || !Array.isArray(constraint.assignments) || !constraint.assignments.length) return null;
  const variables = unique(constraint.variables?.length ? constraint.variables : obligationRefs(obligation));
  if (!variables.length) return null;
  const assignments = [];
  for (const item of constraint.assignments) {
    if (!item?.values || typeof item.values !== "object" || !Number.isFinite(item.cost)) continue;
    const values = {};
    let complete = true;
    for (const variable of variables) {
      if (!(variable in item.values)) { complete = false; break; }
      values[variable] = String(item.values[variable]);
    }
    if (complete) assignments.push(freeze({ values: freeze(values), cost: item.cost }));
  }
  if (!assignments.length) return null;
  return freeze({ obligation: obligation.id, variables: freeze(variables), assignments: freeze(assignments) });
}

function domainsFor(factors) {
  const domains = new Map();
  for (const factor of factors) {
    for (const assignment of factor.assignments) {
      for (const variable of factor.variables) {
        if (!domains.has(variable)) domains.set(variable, new Set());
        domains.get(variable).add(assignment.values[variable]);
      }
    }
  }
  return domains;
}

function enumerateAssignments(domains, limit = 4096) {
  const variables = [...domains.keys()].sort();
  let count = 1;
  for (const variable of variables) count *= Math.max(1, domains.get(variable)?.size ?? 0);
  if (count > limit) return { variables, assignments: [], truncated: true, stateCount: count };
  const assignments = [];
  function visit(i, current) {
    if (i >= variables.length) {
      assignments.push(freeze({ ...current }));
      return;
    }
    const variable = variables[i];
    for (const value of domains.get(variable) ?? []) {
      current[variable] = value;
      visit(i + 1, current);
    }
    delete current[variable];
  }
  visit(0, {});
  return { variables, assignments, truncated: false, stateCount: count };
}

function factorCost(factor, assignment) {
  let best = Infinity;
  for (const row of factor.assignments) {
    let matches = true;
    for (const variable of factor.variables) {
      if (assignment[variable] !== row.values[variable]) { matches = false; break; }
    }
    if (matches) best = Math.min(best, row.cost);
  }
  return best;
}

function frustrationOf(factors, { maxStates = 4096 } = {}) {
  if (!factors.length) return freeze({ available: false, reason: "no_explicit_constraint_costs", frustration: null });
  const domains = domainsFor(factors);
  const enumeration = enumerateAssignments(domains, maxStates);
  if (enumeration.truncated) return freeze({
    available: false,
    reason: "constraint_state_space_exceeds_exact_limit",
    stateCount: enumeration.stateCount,
    maxStates,
    frustration: null,
  });

  const localMinimum = factors.reduce((sum, factor) => {
    const best = Math.min(...factor.assignments.map((row) => row.cost));
    return sum + best;
  }, 0);
  let globalMinimum = Infinity;
  let minimizingAssignments = [];
  for (const assignment of enumeration.assignments) {
    let energy = 0;
    for (const factor of factors) {
      const cost = factorCost(factor, assignment);
      if (!Number.isFinite(cost)) { energy = Infinity; break; }
      energy += cost;
    }
    if (energy < globalMinimum) {
      globalMinimum = energy;
      minimizingAssignments = [assignment];
    } else if (energy === globalMinimum) minimizingAssignments.push(assignment);
  }
  if (!Number.isFinite(globalMinimum)) return freeze({
    available: true,
    satisfiable: false,
    localMinimum,
    globalMinimum: null,
    frustration: Infinity,
    stateCount: enumeration.stateCount,
    minimizingAssignments: freeze([]),
  });
  return freeze({
    available: true,
    satisfiable: true,
    localMinimum,
    globalMinimum,
    frustration: Math.max(0, globalMinimum - localMinimum),
    stateCount: enumeration.stateCount,
    minimizingAssignments: freeze(minimizingAssignments),
  });
}

/**
 * Interpretation/Ground as a factor graph over unresolved material constraints.
 *
 * Every obligation is a factor and every referenced Fold object is a variable
 * node. Shared references establish coupling topology only; they do NOT imply
 * conflict or energetic tension. Exact frustration is reported only when a
 * giver/adapter supplies explicit assignment costs in `obligation.constraint`.
 * Persistence is kept as temporal exposure, not multiplied into instantaneous
 * constraint energy.
 */
export function interpretiveAtmosphereFactorField(obligations = [], { sequence = null, maxStates = 4096 } = {}) {
  const usable = obligations.filter((item) => item?.id);
  const variables = new Map();
  const factors = [];
  const explicitFactors = [];
  let persistenceExposure = 0;

  for (const obligation of usable) {
    const refs = [...obligationRefs(obligation)].sort();
    const persistence = persistenceOf(obligation, sequence);
    persistenceExposure += persistence;
    for (const ref of refs) {
      if (!variables.has(ref)) variables.set(ref, new Set());
      variables.get(ref).add(obligation.id);
    }
    const factor = freeze({
      obligation: obligation.id,
      variableRefs: freeze(refs),
      persistence,
      consequenceCount: (obligation.consequences ?? []).length,
      alternativeCount: (obligation.alternatives ?? []).length,
      explicitConstraint: Boolean(obligation?.constraint),
    });
    factors.push(factor);
    const explicit = explicitFactor(obligation);
    if (explicit) explicitFactors.push(explicit);
  }

  const couplings = [];
  for (const [variable, obligationIds] of variables) {
    const ids = [...obligationIds].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) couplings.push(freeze({ variable, from: ids[i], to: ids[j] }));
    }
  }

  const frustration = usable.length === 0
    ? freeze({ available: true, satisfiable: true, localMinimum: 0, globalMinimum: 0, frustration: 0, stateCount: 1, minimizingAssignments: freeze([freeze({})]), reason: "no_live_material_constraints" })
    : frustrationOf(explicitFactors, { maxStates });
  return freeze({
    model: "interpretive_constraint_factor_graph",
    obligationCount: usable.length,
    variableCount: variables.size,
    factorCount: factors.length,
    couplingCount: couplings.length,
    persistenceExposure,
    variables: freeze([...variables].map(([ref, obligationIds]) => freeze({ ref, obligationRefs: freeze([...obligationIds].sort()) })).sort((a, b) => a.ref.localeCompare(b.ref))),
    factors: freeze(factors),
    couplings: freeze(couplings),
    frustration,
    tensionAvailable: frustration.available,
    tension: frustration.available ? frustration.frustration : null,
    basis: "constraint_topology_without_invented_conflict",
  });
}
