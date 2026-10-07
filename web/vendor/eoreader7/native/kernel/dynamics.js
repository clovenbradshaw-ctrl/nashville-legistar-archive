const OPEN = new Set([undefined, null, "open", "strengthened", "weakened"]);

// Bharata's rasa, as the one column: an expectation's `state` and an
// obligation's `status` are the SAME axis — anticipation (open/strengthened/
// weakened) → landing (fulfilled/violated/reframed/superseded/resolved). The
// felt organs read BOTH fields of the fold, so an expectation that lands is
// a Release, never a silent state change (prove-felt.mjs proved the field
// gap — expectations emit `state`, dynamics used to read only `status`).
const stateOf = (o) => (o?.status ?? o?.state ?? null);
const isOpen = (o) => OPEN.has(stateOf(o));
const allObligations = (fold) => [...(fold?.obligations ?? []), ...(fold?.expectations ?? [])];

export function deriveSurprise(delta) {
  const operations = (delta?.operations ?? []).filter((operation) => operation.operator !== "NUL");
  const affectedAddresses = [...new Set(operations.map((o) => `${o.mode}/${o.domain}/${o.grain}`))];
  const touched = new Set();
  for (const operation of operations) {
    for (const id of operation.inputs ?? []) touched.add(id);
    for (const id of operation.outputs ?? []) touched.add(id);
    if (operation.payload?.value?.id) touched.add(operation.payload.value.id);
    if (operation.payload?.id) touched.add(operation.payload.id);
  }
  return Object.freeze({
    schema: "SurpriseProfile@1",
    operations,
    affectedAddresses,
    touchedGraphObjects: Object.freeze([...touched]),
    downstreamConsequences: operations.flatMap((o) => o.consequence == null ? [] : [o.consequence]),
    recanonicalizations: operations.filter((o) => o.operator === "REC"),
    expectationEffects: operations.filter((o) => o.payload?.action === "expectation"),
    obligationEffects: operations.filter((o) => ["obligation", "resolve-obligation"].includes(o.payload?.action)),
    patternEffects: operations.filter((o) => o.payload?.value?.schema === "EOPatternCandidate@1"),
  });
}

export function deriveTension(fold) {
  const obligations = allObligations(fold).filter(isOpen);
  const interactionNetwork = [];
  for (let i = 0; i < obligations.length; i += 1) {
    for (let j = i + 1; j < obligations.length; j += 1) {
      const a = obligations[i];
      const b = obligations[j];
      const ar = new Set([...(a.grounds ?? []), ...(a.alternatives ?? [])].map(String));
      const shared = [...(b.grounds ?? []), ...(b.alternatives ?? [])].map(String).filter((x) => ar.has(x));
      if (shared.length) interactionNetwork.push({ from: a.id, to: b.id, shared });
    }
  }
  const sequence = fold?.sequence ?? 0;
  return Object.freeze({
    schema: "TensionProfile@1",
    obligations,
    interactionNetwork,
    persistence: obligations.map((o) => ({
      id: o.id,
      value: o.openedAt == null ? (o.persistence ?? 0) : Math.max(o.persistence ?? 0, sequence - o.openedAt + 1),
    })),
    consequences: obligations.map((o) => ({ id: o.id, value: o.consequences ?? [] })),
  });
}

export function deriveRelease(delta, beforeFold, afterFold) {
  const before = new Map(allObligations(beforeFold).map((o) => [o.id, o]));
  const releases = [];
  for (const after of allObligations(afterFold)) {
    const prior = before.get(after.id);
    if (!prior || stateOf(prior) === stateOf(after) || isOpen(after)) continue;
    const transformation = (delta?.operations ?? []).filter((op) => op.payload?.id === after.id || op.payload?.value?.id === after.id);
    if (!transformation.length) continue;
    releases.push({ schema: "Release@1", obligation: after.id, before: prior, transformation, after, witness: transformation.map((op) => op.witness).filter(Boolean) });
  }
  return releases;
}
