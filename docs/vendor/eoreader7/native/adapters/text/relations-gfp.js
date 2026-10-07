// adapters/text/relations-gfp.js — the PRODUCTION GFP reader: a
// language-neutral figure-connector-figure arrangement reader, promoted
// from eval/lavar/gfp-base.mjs (2026-09-16) so all cognition reads GFP by
// default and English-SVO only comes online for a language whose measured
// RoleConfig@1 declares it (relations-language.js, the dispatch).
//
// THE GFP SHAPE, DECLARED. An arrangement is {end1, label, end2}, the
// figure-connector-figure adjacency: two figures whose mentions ADJOIN in
// reading order, the text between them the connector. The connector's
// settled part of speech TYPES the cell (Ground/Figure/Pattern, via
// grain-typing.js — the same typing LaVar's EOT reader uses), never a
// part of speech written onto the record. No subject, verb, or object
// anywhere (LAVAR §13 / P76 — "never write subject, verb or object onto a
// record"; P72 — "two ordered ends and a label is already typologically
// neutral").
//
// ZERO ENGLISH-SHAPED ASSUMPTIONS:
//   - NO capitalisation-based figure discovery — figures are found by
//     RECURRENCE + company (a received POS prior's function classes, the
//     S88/S89 heard-surfaces direction), which works on Russian, Hebrew,
//     Korean, a musical motif, a code identifier.
//   - NO positional subject/verb/object extraction — an arrangement is
//     {end1, label, end2} emitted from figure-connector-figure adjacency.
//   - NO English verb vocabulary — a label is typed by its CELL: a
//     connector that settles as verb/participle is CON·Figure (Link), a
//     preposition is CON·Ground (Field), a conjunction is SEG·Figure
//     (Distinction); a connector that does not settle is a typed grain
//     gap, kept in full.
//
// Public call shape mirrors relations.js's `extractRelations` seam so the
// perceiver can swap the extractor behind ONE unchanged call: `text`, plus
// an options bag. The perceiver reads `end1`/`label`/`end2`/`cell`/
// `grain`/`polarity`/`offset` — never subject/verb/object.

import { cellLabelOf, makeGrainTyper } from "./grain-typing.js";
import { classifyWord, dominantClass } from "./wordclass.js";
import { splitSentences } from "./spans.js";
import { clauseSpans } from "./clause-spans.js";

const FUNCTION_CLASSES = new Set(["ADP", "CCONJ", "SCONJ", "DET", "PRON", "AUX", "PART", "INTJ", "NUM", "PUNCT", "SYM", "X"]);
const WORD = /[\p{L}\p{N}]+/gu;
// Adjacency bound: two figures farther apart than this in bytes are not
// one arrangement (the same bound gfp-base.mjs declared).
const MAX_ADJACENCY = 200;
// A connector longer than this is not a connector — it is text between
// figures that wants a finer reading (the same bound the eval reader kept).
const MAX_LABEL = 40;

const dominant = (tags) => {
  const entries = Object.entries(tags ?? {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
};

/**
 * extractGfpRelations(text, { posPrior, functionWords, minRec, figures })
 * → [{ end1, label, end2, cell, grain, polarity, offset }]
 *
 * `figures` — an OPTIONAL Set of figure tokens the CALLER already heard
 * (recurrence + company is a corpus-level judgment; a caller holding a
 * running frequency table passes the admitted figures so THIS reader does
 * not re-derive a recurrence floor from one window). Omitted, figures are
 * discovered from `text` itself by the same recurrence rule
 * (count >= minRec, length >= 3, not a function word) — a self-contained
 * fallback that is weaker on short windows and says so in the returned
 * arrangement's provenance-free shape (the caller that cares about the
 * floor passes figures).
 *
 * `posPrior` — OPTIONAL received POSPrior@1 used to (a) exclude function
 * classes from figure candidacy and (b) type each connector's cell. Absent,
 * figures are still found (recurrence + functionWords if given); connectors
 * settle to grain_gap (kept, never guessed).
 */
export function extractGfpRelations(text, { posPrior = null, functionWords = null, minRec = 2, figures = null, clauseAware = false } = {}) {
  const typer = posPrior ? makeGrainTyper(posPrior) : null;
  const isFunction = (tok) => {
    if (functionWords?.has(tok.toLowerCase())) return true;
    if (!posPrior) return false;
    const e = posPrior.forms?.[tok.toLowerCase()];
    return e ? FUNCTION_CLASSES.has(dominant(e)) : false;
  };
  const tokens = [...String(text ?? "").matchAll(WORD)].map((m) => ({ tok: m[0], start: m.index, end: m.index + m[0].length }));

  // CLAUSE WINDOWS (opt-in, 2026-09-23): the same figure-recurrence
  // discovery below stays whole-text (a corpus-level judgment, unchanged);
  // only the ADJACENCY gate becomes clause-shaped. splitSentences +
  // clauseSpans give one flat list of [start, end) windows over the whole
  // input, each mapped back to global offsets — an arrangement is admitted
  // only when both figure mentions fall in the SAME window. This is what
  // replaces MAX_ADJACENCY's byte-count guess with a structural fact for
  // callers that opt in; MAX_ADJACENCY itself is untouched below and still
  // applies as a secondary bound when clauseAware is off (the default).
  const clauseWindows = clauseAware
    ? splitSentences(String(text ?? "")).flatMap((sent) => clauseSpans(sent.text).map((c) => ({ start: sent.offset + c.start, end: sent.offset + c.end })))
    : null;
  const sameClause = (a, b) => !clauseWindows || clauseWindows.some((w) => a >= w.start && a < w.end && b >= w.start && b < w.end);

  // FIGURES: recurring content tokens. No case, no position, no grammar.
  const counts = new Map();
  for (const { tok } of tokens) counts.set(tok.toLowerCase(), (counts.get(tok.toLowerCase()) ?? 0) + 1);
  const figureSet = figures ?? new Set(
    [...counts.entries()]
      .filter(([t, c]) => c >= minRec && t.length >= 3 && !isFunction(t))
      .map(([t]) => t),
  );
  if (figureSet.size === 0) return [];

  // Mentions in reading order — GREEDY, LONGEST-MATCH-FIRST.
  //
  // figureSet's own self-discovery scan (above, figures=null) can only ever
  // produce single-word entries — its candidates come off WORD-regex tokens,
  // which never contain a space. But the INJECTED `figures` set (dispatch
  // mode: hypergraph.js passes the referent index's own established
  // surfaces) routinely carries multi-word names ("hannibal hamlin"), and
  // the old scan — a bare per-token membership test — could never match one:
  // no single token equals a multi-word string. Found live, 2026-09-23, on
  // the exact malformed output this repo's own README/incident record was
  // built from: "Hannibal Hamlin was Lincoln's Vice President" read as
  // end1="Hannibal" label="Hamlin was" end2="Lincoln" — the two-word figure
  // silently split into two one-word figures, with the real word between
  // them ("was") swallowed into the connector.
  //
  // Split figureSet once into single-word membership and multi-word groups
  // (keyed by their own first word, longest candidate first within a
  // group), then scan left to right: at each position, try every multi-word
  // candidate whose first word matches (longest first) and consume the
  // whole span on a full match; only then fall back to single-word
  // membership; a position matching neither advances by one token. A
  // figureSet with no multi-word entries degrades to exactly the old
  // per-token scan, byte-identical — the self-discovery path is untouched.
  const singleWordFigures = new Set();
  const multiWordFigures = new Map(); // first word -> [[w1,w2,...], ...] longest first
  for (const f of figureSet) {
    const words = String(f).split(/\s+/).filter(Boolean);
    if (words.length <= 1) { if (words[0]) singleWordFigures.add(words[0]); continue; }
    const first = words[0];
    if (!multiWordFigures.has(first)) multiWordFigures.set(first, []);
    multiWordFigures.get(first).push(words);
  }
  for (const arr of multiWordFigures.values()) arr.sort((a, b) => b.length - a.length);

  const mentions = [];
  for (let i = 0; i < tokens.length; ) {
    const lower = tokens[i].tok.toLowerCase();
    let matchLen = 0;
    for (const words of multiWordFigures.get(lower) ?? []) {
      if (i + words.length > tokens.length) continue;
      if (words.every((w, k) => tokens[i + k].tok.toLowerCase() === w)) { matchLen = words.length; break; }
    }
    if (matchLen > 0) {
      mentions.push({ tok: tokens.slice(i, i + matchLen).map((t) => t.tok).join(" "), start: tokens[i].start, end: tokens[i + matchLen - 1].end });
      i += matchLen;
    } else {
      if (singleWordFigures.has(lower)) mentions.push(tokens[i]);
      i += 1;
    }
  }
  if (mentions.length < 2) return [];

  // Arrangements: figure-connector-figure adjacency, bounded.
  const out = [];
  for (let i = 0; i < mentions.length - 1; i += 1) {
    const f1 = mentions[i];
    const f2 = mentions[i + 1];
    if (f2.start - f1.end > MAX_ADJACENCY) continue;
    if (clauseAware && !sameClause(f1.start, f2.start)) continue;
    const label = String(text).slice(f1.end, f2.start).replace(/\s+/g, " ").trim();
    if (!label || label.length > MAX_LABEL) continue;
    if (label === f2.tok) continue; // no connector at all
    // Type by the connector's FIRST content token — the word that does the
    // connecting ("jumps over the lazy" types by "jumps", a verb → Link).
    // grain-typing's thraxOf reads the last word of whatever it is given,
    // so hand it the head alone.
    const headToken = String(label).split(/[^-\p{L}\p{N}]+/u).filter(Boolean)[0];
    const grain = (typer && headToken) ? typer.grainOf(headToken) : null;
    const cell = typer ? cellLabelOf(grain) : "grain_gap";
    out.push({
      end1: f1.tok,
      label,
      end2: f2.tok,
      cell,
      grain: grain && !grain.grain_gap ? { operator: grain.op, grain: grain.grain, terrain: grain.terrain, stance: grain.stance, settledAs: grain.settledAs } : (grain?.grain_gap ? { grain_gap: grain.grain_gap, settledAs: null } : null),
      polarity: "+", // polarity is a language-specific lens (negation class); GFP leaves it unmeasured rather than guessing
      offset: f1.end,
    });
  }
  // de-duplicate adjacent arrangements (same figure pair, same label)
  const seen = new Set();
  const unique = [];
  for (const a of out) {
    const k = `${a.end1}|${a.label.slice(0, 12)}|${a.end2}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(a);
    }
  }
  return unique;
}

/** discoverGfpVocabulary(text, { functionWords, minSurfaces, posPrior }) —
 * the vocabulary half of the seam, shaped to the perceiver's refresh() call
 * (`minSurfaces` = the caller's recurrence floor, the same `minSurfaces`
 * relations.js's own scan takes). GFP needs no English verb vocabulary;
 * FIGURES are the vocabulary, discovered from this batch by the same
 * recurrence + company rule the extractor uses, and returned as candidates
 * (`verb` = the figure token) so the perceiver's mergeRelationEvidence /
 * admittedRelationVerbs swallow it unchanged and hand the figure set back
 * to extractGfpRelations as `figures`. */
export function discoverGfpVocabulary(text, { figures = null, minRec = null, minSurfaces = null, posPrior = null, functionWords = null } = {}) {
  const floor = minRec ?? minSurfaces ?? 2;
  const isFunction = (tok) => {
    if (functionWords?.has(tok.toLowerCase())) return true;
    if (!posPrior) return false;
    const e = posPrior.forms?.[tok.toLowerCase()];
    return e ? FUNCTION_CLASSES.has(dominant(e)) : false;
  };
  const counts = new Map();
  for (const m of String(text ?? "").matchAll(WORD)) {
    const t = m[0].toLowerCase();
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const verbs = new Set(); // deliberately empty — GFP never gates on a verb list
  const candidates = [];
  if (figures) {
    for (const f of figures) candidates.push({ verb: f, surfaceForms: [f], verbDominant: true });
  } else {
    for (const [t, c] of counts) {
      if (c >= floor && t.length >= 3 && !isFunction(t)) candidates.push({ verb: t, surfaceForms: [t], verbDominant: true });
    }
  }
  return { verbs, candidates };
}