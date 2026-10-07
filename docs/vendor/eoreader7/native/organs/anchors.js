// native/organs/anchors.js — the archon of byte addresses. Handle: Tycho
// (Brahe) — the meticulous measurer whose tables of positions became the
// anchors Kepler's laws stood on. This organ turns a document's citations into
// REAL anchors: every cited type, field, operation, id, table, and product
// name resolves to the byte where it actually appears in the artifacts we
// hold — or is reported absent, which is a real fact, never a guess.
//
// Compose of adapters/code/anchors.js (the pure resolution layer), exported at
// the seam like its siblings. The canonical use for the STR engagement:
//
//   const artifacts = loadAnchorArtifacts(strArtifactSpecs());
//   anchorDocument({ doc: nineJobsText, artifacts }) -> { terms, byStatus, … }
//
// Disciplines (the what-organ's law set, applied to citations): an anchor is a
// byte address, not a match; absence is a result; a Type.field is checked
// against the type's own field list; a Type.id is marked data_level (schema
// artifacts cannot witness instance rows).

import { loadAnchorArtifacts, strArtifactSpecs, linkDocument } from "../adapters/code/anchors.js";

export const CELL = Object.freeze({ op: "SIG", grain: "Figure" });

export const REFUSALS = Object.freeze({
  empty_doc: Object.freeze({ gap: "anchors:empty_doc", detail: "no document text was handed to the organ — nothing to anchor." }),
  no_artifacts: Object.freeze({ gap: "anchors:no_artifacts", detail: "no artifacts were loaded — a citation cannot anchor to nothing. Use loadAnchorArtifacts (or strArtifactSpecs for the STR engagement)." }),
});

const STATUS_ORDER = ["field_confirmed", "anchored", "data_level", "field_absent", "type_absent", "unfound"];

/**
 * anchorDocument({ doc, artifacts, fileId }) -> AnchorReport@1
 * Extract every cited term from `doc`, resolve each against `artifacts`, and
 * return the structured linkage: per-term verdicts, a status rollup, the
 * count of real byte anchors, and the unfound/absent terms (the honest gaps).
 */
export function anchorDocument({ doc = "", artifacts = null, fileId = "document" } = {}) {
  if (!doc?.trim()) return Object.freeze({ ...REFUSALS.empty_doc, schema: "AnchorReport@1" });
  if (!artifacts) return Object.freeze({ ...REFUSALS.no_artifacts, schema: "AnchorReport@1" });

  const link = linkDocument(doc, artifacts);
  const byStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, link.byStatus[s] ?? 0]).filter(([, n]) => n > 0),
  );
  return Object.freeze({
    schema: "AnchorReport@1",
    fileId,
    terms: link.terms,
    byStatus,
    anchorCount: link.anchorCount,
    unfound: link.unfound,
  });
}

// A compact markdown row per term, for rendering the anchored doc.
export function renderAnchorRow(r) {
  const where =
    r.typeAnchor ? `${r.typeAnchor.file}:${r.typeAnchor.offset}`
      : r.anchor?.bundleOffset ? `bundle:${r.anchor.bundleOffset}`
        : r.anchor ? `${r.anchor.file}:${r.anchor.offset}`
          : r.swarmAnchor ? `swarm:${r.swarmAnchor.offset}`
            : r.rawWitness ? `${r.rawWitness.file}:${r.rawWitness.offset}`
              : "—";
  const extra =
    r.slateField !== undefined ? `slateField=${r.slateField}`
      : r.opWitness ? `opField=${r.opWitness.fieldInOp}`
        : r.field !== undefined ? `field=${r.field}`
          : "";
  return `| ${r.status} | \`${r.term}\` | ${where} | ${extra} |`;
}

export { loadAnchorArtifacts, strArtifactSpecs };