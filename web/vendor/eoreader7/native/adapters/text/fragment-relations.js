// A conservative fragment seam. A received prior can refuse a measured head,
// never supply one. Missing endpoints remain gaps; no implicit speaker/copula.
// The register-learned ConstructionPrior@2 and its builder described in
// CHORUS-LOG are absent from this checkout; this is not that measured assembly.
import { extractRelations } from "./relations.js";

export const FRAGMENT_DISCLOSURE = Object.freeze({
  assembly: "text/fragment-transitive",
  stagesNotRun: Object.freeze(["register-learned-construction@2", "implicit-endpoint-resolution"]),
  gap: "fragment_construction_prior_unavailable",
  basis: "measured heads with literal endpoints; the logged baby-learning assembly is absent",
});

export function fragmentRelations(text, { prior = null, verbs = new Set() } = {}) {
  // The fallback uses the existing English clause lens. It cannot silently
  // become a universal grammar for a reader with no declared language prior.
  if (!["en", "eng"].includes(prior?.language)) return [];
  const allowed = new Set([...verbs].filter((word) => {
    const row = prior?.forms?.[String(word).toLowerCase()];
    if (!row) return true;
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    return total > 0 && (row.VERB ?? 0) / total >= 0.5;
  }));
  if (!allowed.size) return [];
  return extractRelations(String(text ?? ""), { verbs: allowed })
    .filter((r) => r.subject && r.object && allowed.has(r.verb))
    .map((r) => ({ end1: r.subject, label: r.verb, end2: r.object, offset: r.offset,
      polarity: r.polarity, grain: { operator: "CON", grain: "Figure" },
      basis: FRAGMENT_DISCLOSURE.assembly }));
}
