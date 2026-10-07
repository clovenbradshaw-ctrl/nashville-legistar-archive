// native/the-fold/referent-slots.js — THE SAME HUNT, OVER A REFERENT'S
// RELATIONS INSTEAD OF A TEXT'S POSITIONS (layer 7, 2026-09-22).
//
// The user: "how do we extract parameters on a given kind? how do we learn
// that a president has terms? and the slots are self emergent? … make them
// emergent." Everywhere else in this engine a "position" is a text
// position — line 3, bar 7. A referent has no text positions, but it has
// RELATIONS, and a relation-instance is exactly the same shape as a text
// element: a class ("tenure", "held office"), and attributes (which office,
// when it started, when it ended). Wikidata's P39 position-held statement,
// qualified by P580/P582 start/end time, is one such relation-instance per
// term served.
//
// SO THIS ORGAN WRITES NO NEW LEARNING CODE. It reshapes a referent's
// relation-instances into the { cls, attrs } shape the Ground reader already
// produces (medium.js elementsOf), and form-prior.js's emergentFacts /
// paradigm.js's learnParadigmEmergent run over them unmodified. "A president
// has terms" is then not a fact declared anywhere — it is what
// learnParadigmEmergent FINDS separates multi-term holders from single-term
// ones, the same way it finds a sonnet has fourteen lines: count:tenure, one
// emergent slot among others, surviving the same null.
//
// Dates are ISO 8601 (Wikidata's own qualifier format, "+1848-01-05T…Z");
// startYear/endYear are exposed as plain numbers alongside the raw string so
// the emergent generator's own numeric SUCCESSOR fact (SYN: v = w + 1) can
// fire across a referent's own tenures — one term's end year preceding the
// next term's start year is then found, not hand-written.
import { emergentFacts } from "./form-prior.js";

const yearOf = (iso) => {
  const m = String(iso ?? "").match(/^[+-]?(\d{1,6})-/);
  return m ? Number(m[1]) : null;
};

/**
 * referentElements(entity) → { elements: [{ cls, office, start, end,
 * startYear, endYear, replaces, replacedBy }] }, ordered as the source gave
 * them (a referent's relations have no inherent order the way text does —
 * callers wanting chronological order should sort `entity.tenures` first
 * and say so; this organ reorders nothing on its own).
 */
export function referentElements(entity, { relation = "tenure" } = {}) {
  const rows = entity?.tenures ?? entity?.relations ?? [];
  return {
    elements: rows.map((r) => ({
      cls: relation,
      office: r.office ?? "",
      start: r.start ?? "",
      end: r.end ?? "",
      startYear: yearOf(r.start),
      endYear: yearOf(r.end),
      replaces: r.replaces ?? "",
      replacedBy: r.replacedBy ?? "",
    })),
  };
}

/** emergentFacts, run over one referent's relations. A thin call-through —
 *  kept as its own export so callers never need to know the reshape. */
export const referentFacts = (entity, opts) => emergentFacts(referentElements(entity, opts));
