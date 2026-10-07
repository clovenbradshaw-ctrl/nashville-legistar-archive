// Handle: Thymus — after the organ where a candidate is presented and selected, not admitted on presentation alone: nomination is not admission. Amendment XVII.

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

function sameAnchor(a, b) {
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// Candidate nomination is not admission. By default a candidate needs explicit
// evidence anchored to the encounter; modality-specific gates may be stricter.
//
// SHARED CORE (2026-09-14): `witness()` and `witnessVerbose()` are the same
// loop, asked for a different amount of honesty about what happened in it.
// `witness()` keeps its EXISTING RETURN SHAPE byte-for-byte — other code
// depends on it (a bare array of Observation@1) — so a refusal still simply
// is not in that array. `witnessVerbose()` is the new, additive export: it
// returns what witness() would have silently dropped, and WHY, so a caller
// that wants to keep the refusal (lexicon.js: Void terrain is "refusals and
// typed gaps") has something to keep. Neither loop's admission logic changed;
// this only stopped throwing the reason away.
async function runWitness(encounter, candidates = [], { admit } = {}) {
  const observations = [];
  const refused = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const defaultDecision = Boolean(candidate?.evidence) && sameAnchor(candidate.anchor, encounter.anchor);
    const decision = admit
      ? await admit(encounter, candidate)
      : { admitted: defaultDecision, witness: candidate?.evidence };
    const admitted = typeof decision === "boolean" ? decision : Boolean(decision?.admitted);
    if (!admitted) {
      const reason = (decision && typeof decision === "object" && decision.reason)
        ? decision.reason
        : admit
          ? "refused by admit"
          : !candidate?.evidence
            ? "no evidence"
            : "anchor mismatch";
      refused.push(Object.freeze({ candidate, reason }));
      continue;
    }
    const warrant = typeof decision === "object" ? (decision.witness ?? decision.evidence ?? candidate.evidence) : candidate.evidence;
    if (!warrant) {
      refused.push(Object.freeze({ candidate, reason: "no warrant" }));
      continue;
    }
    const nominated = candidate.candidate ?? candidate;
    observations.push(Object.freeze({
      schema: "Observation@1",
      id: candidate.id ?? `observation:${encounter.sequencePosition ?? "?"}:${index}`,
      witness: warrant,
      anchor: candidate.anchor ?? encounter.anchor,
      distinctions: asArray(nominated?.distinctions ?? nominated),
      hyperedges: Object.freeze([...(candidate.hyperedges ?? nominated?.hyperedges ?? [])]),
      graphEntries: Object.freeze([...(candidate.graphEntries ?? nominated?.graphEntries ?? [])]),
      provenance: {
        source: encounter.source,
        modality: encounter.modality,
        perceiver: candidate.perceiver,
        nominationCause: asArray(candidate.nominationCause),
        prior: candidate.prior ?? null,
      },
    }));
  }
  return { observations, refused };
}

export async function witness(encounter, candidates = [], opts = {}) {
  return (await runWitness(encounter, candidates, opts)).observations;
}

/**
 * Everything `witness()` admits, PLUS everything it silently dropped and why.
 * `refused` is `[{ candidate, reason }]` — one entry per candidate that never
 * became an Observation@1, in encounter order. `reason` is one of "no
 * evidence", "anchor mismatch", "refused by admit" (an injected `admit`
 * returned false/a falsy `admitted` with no `reason` of its own), a
 * caller-supplied `decision.reason`, or "no warrant" (admitted, but no
 * evidence/witness existed to record). Additive: nothing that calls
 * `witness()` needs to change, and this export changes no existing behavior.
 */
export async function witnessVerbose(encounter, candidates = [], opts = {}) {
  const { observations, refused } = await runWitness(encounter, candidates, opts);
  return { observations, refused: Object.freeze(refused) };
}
