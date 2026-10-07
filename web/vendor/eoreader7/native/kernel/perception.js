const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

function priorHypotheses(prior, encounter, orientation) {
  if (!prior || typeof prior.hypotheses !== "function") return [];
  if (typeof prior.applicability === "function" && !prior.applicability(encounter, orientation)) return [];
  return asArray(prior.hypotheses(encounter, orientation)).map((candidate) => ({
    ...candidate,
    nominationCause: [...asArray(candidate.nominationCause), "received_prior"],
    prior: { giver: prior.giver, provenance: prior.provenance },
  }));
}

// Orientation and priors may nominate candidates; they never admit observations.
export async function perceive(encounter, orientation, { perceivers = [], priors = [] } = {}) {
  const nominations = [];
  for (const prior of priors) nominations.push(...priorHypotheses(prior, encounter, orientation));
  for (const organ of perceivers) {
    const output = await organ.perceive(encounter, orientation, nominations);
    for (const candidate of asArray(output)) {
      nominations.push({
        schema: "PerceptCandidate@1",
        candidate: candidate.candidate ?? candidate,
        anchor: candidate.anchor ?? encounter.anchor,
        perceiver: candidate.perceiver ?? organ.id ?? "anonymous",
        nominationCause: asArray(candidate.nominationCause ?? "bottom_up_difference"),
        evidence: candidate.evidence ?? null,
        warrant: candidate.warrant ?? null,
      });
    }
  }
  return nominations.map((candidate) => candidate.schema === "PerceptCandidate@1" ? candidate : ({
    schema: "PerceptCandidate@1",
    candidate: candidate.candidate ?? candidate,
    anchor: candidate.anchor ?? encounter.anchor,
    perceiver: candidate.perceiver ?? "prior",
    nominationCause: asArray(candidate.nominationCause ?? "structural_prior"),
    evidence: candidate.evidence ?? null,
    warrant: candidate.warrant ?? null,
    prior: candidate.prior,
  }));
}
