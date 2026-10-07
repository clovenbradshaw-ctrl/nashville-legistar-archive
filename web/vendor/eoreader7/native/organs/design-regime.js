// organs/design-regime.js — DESIGN-REGIME. Handle: Müller-Brockmann vs.
// Carson — grid-consistency (Müller-Brockmann, "Grid Systems in Graphic
// Design") vs. expressive-rupture (Carson, Ray Gun): the ONE
// PRACTITIONER-GRADE, EXPLICITLY DEMOTED check in this team, kept because
// it names a real, disclosed disagreement rather than smuggling one
// side's taste in as a silent default. The literature review has zero
// primary empirical support for grid-consistency as a general virtue.
//
// Fires ONLY under a declared "grid-systematic" regime, and judges the
// artifact against ITS OWN claimed regime — logos.js's own discipline (a
// claim is judged against its own premises, never an external ideal).
// An "expressive-rupture" regime is never contested by inconsistency,
// because rupture delivering rupture is not contested by its own
// standard.
//
// PRACTITIONER-GRADE tier, at the bottom of the review's own confidence
// table — this organ's own findings say so on every call.
//
// PURE.
import { EVIDENCE_TIER } from "./evidence-tier.js";

/**
 * regimeFinding({ declaredRegime, tokenUsage }) — `tokenUsage`: [{ value,
 * role }] — every distinct color/size/spacing value actually used, and
 * the semantic role it was used for.
 */
export function regimeFinding({ declaredRegime, tokenUsage } = {}) {
  if (declaredRegime !== "grid-systematic" && declaredRegime !== "expressive-rupture") {
    throw new TypeError('visual-hierarchy: regimeFinding requires a declared regime — "grid-systematic" or "expressive-rupture" — never a default; an unstated regime is exactly the unqualified "for no one in particular" pathos.js already refuses');
  }
  if (declaredRegime === "expressive-rupture") {
    return {
      tier: EVIDENCE_TIER.PRACTITIONER_GRADE,
      giver: "Carson (Ray Gun) — rupture delivering rupture is not contested by its own standard",
      declaredRegime,
      contested: false,
      basis: "no verdict is possible or sought under a declared expressive-rupture regime",
    };
  }
  const byRole = new Map();
  for (const { value, role } of tokenUsage ?? []) {
    if (!byRole.has(role)) byRole.set(role, new Set());
    byRole.get(role).add(value);
  }
  const inconsistentRoles = [...byRole.entries()].filter(([, values]) => values.size > 1).map(([role, values]) => ({ role, values: [...values] }));
  return {
    tier: EVIDENCE_TIER.PRACTITIONER_GRADE,
    giver: "Müller-Brockmann (Grid Systems in Graphic Design) — no primary empirical support in the retrieved literature; kept as a disclosed, low-confidence check, judged against the artifact's OWN declared regime, never an external ideal",
    declaredRegime,
    contested: inconsistentRoles.length > 0,
    inconsistentRoles,
  };
}
