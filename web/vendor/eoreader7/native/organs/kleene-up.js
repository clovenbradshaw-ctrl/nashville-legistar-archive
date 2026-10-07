// native/organs/kleene-up.js — the archon of regex eviction.
// Handle: Kleene (Stephen Cole Kleene, 1909–1994) — the founder of regular
// languages. The organ is named for him because it evicts his machinery by
// name: a thing is FOUND by its position in the byte field, never by a
// pattern guessed over it, and a thing is SNIPPED at its permanent address,
// never by a match. kleeneUp is the clean-up: it sweeps the codebase for
// regex FINDING and SNIPPING and re-seats it on the physics primitives in
// native/kernel/kleene-up.js (needle · anchor · window · sha256-verified
// ground). It is a WITNESS, never a verdict: it measures what a pattern IS
// (literal / semantic / structural / typed_gap) and names the migratable
// ones; the migration itself is a build, run by scripts/kleene-up.mjs under
// the organ's own audit.
//
// CELL: SIG · Figure — the organ SIGNS the figure of the field: where the
// needle sits, in what window, cut at what address. NUL here is the empty
// needle — found everywhere, therefore nowhere (a typed gap, never a match).
//
// THE BOUNDARY. The physics primitives live in the KERNEL (kleene-up.js) so
// any organ — and any kernel module — can FIND and SNIP without reaching for
// a pattern; this file is the organ SEAM: the cube cell, the typed refusals,
// and the disclosure that the sweep is a measurement, never an opinion. The
// kernel never imports organs; this organ imports the kernel, like its
// siblings (anchors.js / grounding.js / verbatim-snip.js).

import {
  SCHEMA, HANDLE, REFUSALS,
  foldedIndex, needleDigest,
  findNeedle, findNeedles, windowAt, snipAt,
  reduceRegex, wordSet,
} from "../kernel/kleene-up.js";

export const CELL = Object.freeze({ op: "SIG", grain: "Figure" });
export const KLEENE_UP_SCHEMA = SCHEMA;

export const KLEENE_UP_REFUSALS = Object.freeze(REFUSALS);

// The four names a pattern earns. A measurement, never an opinion.
export const KINDS = Object.freeze(["literal", "semantic", "structural", "typed_gap"]);

export {
  foldedIndex,
  needleDigest,
  findNeedle,
  findNeedles,
  windowAt,
  snipAt,
  reduceRegex,
  wordSet,
  HANDLE,
};

/**
 * auditField — the organ's standing move: take a field of text (a file's
 * bytes, a document, a task string) and a set of patterns the caller suspects,
 * and return the KleeneUpAudit@1: each pattern named by reduceRegex, each
 * named migratable pattern measured over the field with findNeedles, and the
 * structural / typed_gap patterns disclosed as left-alone (grammar is not
 * finding). Absence is a result; a migratable needle that is not in the field
 * is reported absent, never guessed.
 */
export function auditField(field, patterns, { all = false } = {}) {
  const text = String(field ?? "");
  const entries = Array.isArray(patterns) ? patterns : Object.entries(patterns ?? {});
  const rows = [];
  for (const [label, source] of entries.map((p) => (Array.isArray(p) ? p : [p, p]))) {
    const cls = reduceRegex(source);
    if (cls.kind === "literal" || cls.kind === "semantic") {
      const ws = wordSet(source, { flags: cls.flags });
      const findings = findNeedles(text, ws?.needles ?? [], { ci: ws?.ci ?? false, all });
      rows.push(Object.freeze({
        label,
        kind: cls.kind,
        source,
        flags: cls.flags,
        needles: ws?.needles ?? Object.freeze([]),
        ci: ws?.ci ?? false,
        findings,
      }));
    } else {
      rows.push(Object.freeze({
        label,
        kind: cls.kind,
        source,
        flags: cls.flags,
        gap: cls.gap ?? null,
        detail: cls.detail,
        findings: null,
      }));
    }
  }
  return Object.freeze({
    schema: "KleeneUpAudit@1",
    fieldChars: text.length,
    all,
    rows: Object.freeze(rows),
    counted: Object.freeze({
      patterns: rows.length,
      literal: rows.filter((r) => r.kind === "literal").length,
      semantic: rows.filter((r) => r.kind === "semantic").length,
      structural: rows.filter((r) => r.kind === "structural").length,
      typedGaps: rows.filter((r) => r.kind === "typed_gap").length,
      migratable: rows.filter((r) => r.kind === "literal" || r.kind === "semantic").length,
      absent: rows.filter((r) => r.findings && r.findings.counted.found === 0).length,
    }),
  });
}

export default {
  CELL, HANDLE, KLEENE_UP_SCHEMA, KLEENE_UP_REFUSALS, KINDS,
  foldedIndex, needleDigest, findNeedle, findNeedles, windowAt, snipAt,
  reduceRegex, wordSet, auditField,
};