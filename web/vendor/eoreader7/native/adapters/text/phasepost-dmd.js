// native/adapters/text/phasepost-dmd.js — the adapter that was missing: a
// stream of already-extracted, still-revisable relations, classified one
// by one into the engine's 27 cells (phasepost.js), turned into the
// numeric trajectory contextual-dmd.js's own `contextualModes` already
// knows how to decompose. Nothing new is computed here — this module
// composes two already-real, already-tested organs; it owns only the
// GLUE, and the glue is small on purpose.
//
// WHY THIS DID NOT ALREADY EXIST, checked rather than assumed (the-fold
// POLICIES.md P229's browser-verification pass, 2026-09-15): the two real,
// measured DMD drivers that exist — eval/salience-dmd.mjs and this
// directory's own contextual-dmd.js — both decompose LEXICAL SALIENCE
// trajectories (word/motif recurrence). Neither has ever been pointed at
// phasepost.js's 27-cell classifications. So "the phaseposts, as the
// measured output of DMD run over a trajectory of revisable
// classifications" — the synthesis this file's own CLAUDE.md section
// ("Cognition takes place with the phaseposts") already names as the
// destination — was a stated goal, not yet a wired pipeline. This module
// is that wiring, nothing more: it does not touch phasepost.js, cube.js,
// contextual-dmd.js, or dmd.js, and it introduces no new mathematics.
//
// THE UNIT IS ONE ACT, BY DEFAULT — occurrence-level, the same grain
// phasepost.js's own header already commits to ("GRAIN IS
// OCCURRENCE-LEVEL"). Coarser grouping (one snapshot per sentence, per
// paragraph, per turn) is available via the injected `unitOf`, but is not
// assumed: an edge carries no ready-made sentence index of its own in the
// general case, and manufacturing one would be a second, unproven organ
// bolted onto this one. A caller who has real unit boundaries (a sentence
// ref, a turn number) supplies them; a caller who does not still gets a
// genuine, well-defined trajectory — the finest one the data supports.
//
// A CONTESTED OR GAP VERDICT CONTRIBUTES NOTHING TO THE COUNT, AND IS
// NEVER SILENTLY DROPPED FROM THE RECORD. phasepost.js's own P56
// discipline ("a candidate set, not a verdict — this module never
// coin-flips") is honored here the only way a numeric trajectory CAN
// honor it: an uncertain act adds zero evidence for any one cell, rather
// than being forced into one of its candidates or split fractionally
// across them (either would manufacture a precision the classification
// itself refused to claim). It is still named on `excluded`, with the
// unit it belonged to and the reason, so a reader can see exactly how
// much of the reading the trajectory had to look past.
//
// THE UNIT'S OWN TIME STEP IS NEVER DELETED FOR BEING UNCERTAIN. A unit
// whose only edge turned out contested still occupies a real position in
// the trajectory — an all-zero snapshot — because DMD's own math depends
// on uniform, ordered time spacing; silently skipping an uncertain moment
// would misdate everything after it. Only an all-excluded PREFIX or
// SUFFIX changes what the basis or the windowing measure; contextual-
// dmd.js's own `dmdWindow` already decides how much of the trajectory a
// causal read should actually spend, and this module does not
// second-guess that.
//
// PURE. classify() is injected (phasepost.js::makePhasepost's own output
// — never re-derived here), and edges arrive already in reading order;
// this module preserves that order and adds none of its own, so the
// causal guarantee dmd.js/contextual-dmd.js already carry ("a caller that
// hands it a whole book has read the future") is inherited unbroken.

import { contextualModes } from "./contextual-dmd.js";

// A REAL COMPATIBILITY GAP, FOUND BUILDING THIS, AND FIXED AT ITS SOURCE
// RATHER THAN PAPERED OVER HERE. The first cut of this module added a
// LOCAL `edgeFromArrangement` translator, converting a real edge's
// `{end1, label, end2}` (hypergraph.js's own typologically-neutral public
// shape, P76) into `{subject, verb, object}` so phasepost.js's classify()
// would accept it — which silently REINTRODUCED the exact SVO/English-
// specific naming P76 fought to remove, one file downstream, and did it
// as a translation layer rather than a fix (caught by direct user
// correction: "SVO is EN focused, fix that"). The real fix is in
// phasepost.js itself: `classify(edge)` now reads `end1`/`label`/`end2`
// FIRST, with `subject`/`verb`/`object` kept only as a fallback for
// existing callers — so a real edge, from ANY of this project's
// arrangement-producing readers (the English positional reader, or
// eoreader7's Latin case-marked reader, P77), classifies natively, with
// no adapter-side renaming anywhere. This module now hands `classify`
// whatever edges it is given, verbatim.
//
// "THE PARTS OF SPEECH THE RESPECTIVE LANGUAGES DOES ENCODE IS USEFUL"
// (user, same correction) — kept, not discarded: a case-marked edge's own
// `end1Detail`/`end2Detail` (e.g. `{case: "Nom"}`/`{case: "Acc"}`,
// relations-case-marked.js) rides straight through to classify() exactly
// as attached, because this module never strips or renames a field it
// does not itself need. phasepost.js's own header now states plainly
// which half of ITS reasoning is genuinely typology-neutral (the field
// access) and which half stays lang/en-scoped, received content
// (ActPrior@1, the closed classes) — a real, disclosed, unattempted-here
// boundary, not a claim this module resolves.

/** The one established string form for a cube cell, reused rather than
 * reinvented — the identical `${op}·${grain}` join kernel/notes.js,
 * kernel/commitments.js and organs/derivation.js already build inline.
 * `null` for a gap or an absent cell, never a guessed label. */
export const cellLabel = (cell) => (cell && !cell.gap && cell.op && cell.grain ? `${cell.op}·${cell.grain}` : null);

/**
 * phasepostObservations(edges, { classify, unitOf }) -> { observations,
 *   units, counted, excluded }
 *
 * `edges` — relations in reading order (phasepost.js's own edge shape:
 *   {subject, verb|relation, object, ...}). Never reordered here.
 * `classify` — REQUIRED, injected: phasepost.js's `makePhasepost(...).
 *   classify`, never re-derived — this module has no notion of an act
 *   prior, a determiner class, or the cube, on purpose.
 * `unitOf(edge, index)` — OPTIONAL, defaults to `(edge, i) => i` (one
 *   edge, one unit — the finest honest grain). Returns a unit key; edges
 *   sharing a key land in the same snapshot, counts summed.
 *
 * `observations` is the sequence contextual-dmd.js's own `contextualModes`
 * expects: one Map<cellLabel, count> per unit, in unit order — including
 * a unit whose only edges were excluded, which still contributes an empty
 * Map rather than a hole in the trajectory.
 */
export function phasepostObservations(edges, { classify, unitOf = (edge, i) => i } = {}) {
  if (typeof classify !== "function") {
    throw new TypeError("phasepostObservations: classify is injected — phasepost.js's own makePhasepost(...).classify, never a private reimplementation");
  }
  const byUnit = new Map();
  const order = [];
  const excluded = [];
  let counted = 0;

  edges.forEach((edge, i) => {
    const unit = unitOf(edge, i);
    if (!byUnit.has(unit)) {
      byUnit.set(unit, new Map());
      order.push(unit);
    }
    const verdict = classify(edge);
    const label = verdict.op && verdict.cell ? cellLabel(verdict.cell) : null;
    if (!label) {
      excluded.push({ unit, standing: verdict.standing ?? "gap", because: verdict.because ?? null, edge });
      return;
    }
    counted += 1;
    const counts = byUnit.get(unit);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return {
    observations: order.map((u) => byUnit.get(u)),
    units: order,
    counted,
    excluded,
  };
}

/**
 * phasepostModes(edges, { classify, unitOf, dt }) -> contextualModes()'s
 *   own return shape (`{window, windowBasis, basis, dims, eigenvalues,
 *   rank, operator, ...}` or `{gap}`), plus `observations` (the actual
 *   array of per-unit Maps this module built — see the note below),
 *   `units`, `counted`, `excludedCount`, `excluded` — the bookkeeping
 *   contextualModes itself has no notion of, since it never sees a
 *   classification, only a trajectory.
 *
 * A REAL BUG, CAUGHT WHILE FIXING THE TESTS FOR THE SVO CORRECTION ABOVE,
 * NOT SHIPPED: `decompose()` (contextual-dmd.js) returns `observations` as
 * a bare COUNT on its gap paths (`{gap, observations: observations.
 * length}`) and omits the field entirely on success — a first draft here
 * spread `...out` last, so a gapped call silently exposed `observations`
 * as that ambiguous number while a successful call exposed nothing under
 * that name at all. This module's OWN richer meaning — the actual array
 * of per-unit Maps it built, useful on both outcomes — now always wins,
 * spread last and explicitly; contextual-dmd.js's own gap-count is
 * redundant with `units.length` here regardless, so nothing is lost by
 * not exposing it under this name.
 *
 * This is the whole adapter: classify every edge, build the trajectory,
 * hand it to the SAME contextual-dmd.js this repo already trusts for
 * lexical-salience modes. No new decomposition, no new windowing rule, no
 * new rank criterion — the only thing new is what the trajectory's
 * dimensions MEAN.
 */
export function phasepostModes(edges, { classify, unitOf, dt = 1 } = {}) {
  const { observations, units, counted, excluded } = phasepostObservations(edges, { classify, unitOf });
  const out = contextualModes(observations, { dt });
  return { ...out, observations, units, counted, excludedCount: excluded.length, excluded };
}
