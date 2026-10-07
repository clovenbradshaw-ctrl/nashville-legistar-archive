// organs/evidence-tier.js — the shared confidence vocabulary every visual-
// hierarchy archon tags its own findings with, so no two archons invent
// their own grading scale. Read straight off the user-supplied literature
// review's own table shape (well-evidenced / well-evidenced-in-principle /
// moderate / practitioner-grade), never a scale this repo invented.
export const EVIDENCE_TIER = Object.freeze({
  WELL_EVIDENCED: "well-evidenced",
  WELL_EVIDENCED_IN_PRINCIPLE: "well-evidenced-in-principle",
  MODERATE: "moderate",
  PRACTITIONER_GRADE: "practitioner-grade",
});
