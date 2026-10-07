// native/organs/received-vocabulary-relations.js — a SECOND, disclosed way
// for a verb to enter the relation vocabulary (2026-09-23).
//
// User direction, this session: "i suspect our problem is trying to go from
// english to GFP then SVO rather than vice versa" — checked, not assumed.
// Measured live: `extractRelations` (relations.js) is already fully
// case-agnostic at match time -- handed a vocabulary directly, it reads
// "result|is|always a string" out of lowercase code prose exactly as
// readily as a capitalised name. The bottleneck is one step upstream:
// `discoverRelationVocab` only admits a verb into that vocabulary when it
// sits next to a capitalised, non-sentence-initial SURFACE somewhere in the
// material (relations.js's own header: "the vocabulary is derived, never
// typed in" -- from proper-noun adjacency). Code identifiers (`result`,
// `config.port`, `moduleA`) and short, subject-first turn claims (a single
// sentence whose one name is sentence-initial, so extractSurfaces never
// confirms it) structurally never clear that gate, regardless of how good
// prose comprehension gets elsewhere -- this is a register mismatch, not a
// comprehension one.
//
// THE FIX IS NARROW ON PURPOSE. This does not touch relations.js or
// surfaces.js -- both stay exactly as measured and tested. It adds a
// SECOND, small, RECEIVED vocabulary (the same discipline pos-eng.json and
// morphology-eng.json already hold in this exact reading pipeline: given
// data, never typed in as a hand list for the whole language) that a
// caller UNIONS on top of whatever discoverRelationVocab finds. Unlike the
// old 90-word hand list this file's sibling module's own header records
// being reverted for (it stood in for ALL relation discovery, silently),
// this list stands in for NOTHING that already works: it only ever WIDENS
// which verbs `extractRelations` may match, and every edge it is
// responsible for is tagged so a caller can tell it apart from a fully
// measured, surface-anchored one -- disclosed, never silent (THE-NULL-
// STATES.md's fourth law, applied to a gain rather than a gap).
//
// CORRECTION (2026-09-23, a 4-agent independent review, each checking the
// claims below against live code rather than each other): this section
// used to claim RECEIVED_RELATION_VERBS was "derived, not guessed" from two
// checkable sources. Neither checks out as stated. (a) There is no
// `SURFACES` export in kernel/gfp-claim.js -- only `CODE_SURFACES`, a
// WALS-81A word-order table (infix/prefix/postfix rendering), unrelated to
// a verb lexicon; the string "is"/"has" appears nowhere in that file. (b)
// Running the cited grep (`"rel"` across native/tests, native/eval, cli)
// finds exactly two of this list's 20 words attested that way -- "has" (via
// has-type) and "imports" -- not the eighteen the old text implied. Test
// coverage: only "has" is pinned by any assertion (received-vocabulary-
// relations.test.mjs); the "depends" test accepts either admission path,
// so it proves nothing about this list specifically. The eval battery
// sometimes cited as validating this file (native/eval/the-fold/
// reason-falsify/) never actually exercises it: cli/reason.mjs's whole
// text-reading branch is gated behind `input.text`, and every item that
// battery feeds the CLI omits it. So: RECEIVED_RELATION_VERBS is, honestly,
// a hand-typed 20-word list with weak-to-no measured backing -- not the
// data-derived thing the header used to claim. That does not make it
// dangerous the same way the reverted 90-word list was (see THE FIX IS
// NARROW ON PURPOSE above -- additive, tagged, never a sole gate), but it
// does mean the real fix is still open: a genuinely measured closed-class
// admission mechanism, in the same posPrior/GRAMMAR_MIN_SHARE spirit as
// hypergraph.js's `attestedVerbs`, but WITHOUT attestedVerbs's function-word
// exclusion (which structurally throws out copulas/auxiliaries by design --
// confirmed live against the real production verbForms lexicon, where 17 of
// these 20 words are absent). That mechanism does not exist yet; until it
// does, treat this list as a disclosed, low-blast-radius stopgap, not a
// measured one.
//
// PURE. No model call, no IO, no network.
import { extractSurfaces } from "../adapters/text/surfaces.js";
import { discoverRelationVocab, extractRelations } from "../adapters/text/relations.js";
import { splitSentences } from "../adapters/text/spans.js";
import { clauseSpans, propositionSpans } from "../adapters/text/clause-spans.js";

export const RECEIVED_RELATION_VERBS = Object.freeze([
  // Copula / possession -- the surface form nearly every property or
  // identity claim ("X has-type Y", "X is Y") is phrased with.
  "is", "are", "was", "were", "has", "have", "had",
  // Measured in real use across this repo's own reasoning specs (see
  // header): the small, recurring set of code/claim-description predicates.
  "returns", "depends", "imports", "requires", "contains",
  "extends", "implements", "calls", "throws", "governs", "checks",
  "precedes", "declares",
]);

/**
 * readWithReceivedVocabulary(text, { surfaces, received, ...extractOpts })
 * — the SAME two-step read `discoverRelationVocab` + `extractRelations`
 * already do, with `received` (default RECEIVED_RELATION_VERBS) UNIONED
 * into the discovered set before matching. `surfaces` may be supplied
 * (already-discovered surface strings/objects, the caller's own); default
 * discovers them fresh via the same `extractSurfaces` the rest of the
 * pipeline uses -- this never re-derives surface detection, only reuses it.
 *
 * Returns `{ edges, discoveredVerbs, receivedVerbsUsed }`: `edges` split
 * by which vocabulary source is responsible for each -- an edge whose verb
 * is in `discoveredVerbs` would have been found by the existing pipeline
 * alone; one only in `receivedVerbsUsed` would not have been, and is the
 * disclosed, weaker-witnessed gain this module exists to add.
 *
 * `clauseAware` (2026-09-23, opt-in, default false so every existing test
 * stays byte-identical): this module's own extractor (adapters/text/
 * relations.js) has NO clause-boundary awareness -- its `object` is
 * whatever text follows the matched verb up to the next admitted boundary,
 * which routinely bundles several independent propositions into one
 * string (caught live in the browser demo built this session: "…was the
 * first woman to win a Nobel Prize, the first person to win a Nobel Prize
 * twice and the only person to win a Nobel Prize in two different
 * scientific fields" as ONE edge's object). `true` computes clause windows
 * over the whole input the same way relations-gfp.js's `clauseAware` mode
 * does (splitSentences + clauseSpans, mapped to global offsets) and drops
 * any edge whose full subject-to-object span does not fit inside one
 * clause window -- a filter on the OUTPUT, since this older extractor's
 * internals are not touched by this change at all.
 *
 * `posPrior` (2026-09-23, optional, required only for the step below):
 * this extractor matches ONE edge per verb, so a compound predicate
 * sharing a subject ("she was awarded X and began Y") only ever produces
 * an edge for the FIRST verb -- the second predicate is invisible to it.
 * When `clauseAware` AND `posPrior` are both given, every clause is also
 * run through `propositionSpans` (clause-spans.js); each `coordinate-
 * predicate` span it finds becomes a SYNTHESIZED second edge, reusing the
 * subject of whichever already-matched edge falls inside the parent
 * proposition's own window (never a guessed or re-derived subject) paired
 * with the compound predicate's own verb/object, sliced via its exact
 * `verbStart`/`verbEnd`. Every synthesized edge carries `synthesized:
 * "coordinate-predicate"` so a caller can tell it apart from a directly
 * matched one -- disclosed, the same discipline `received: true` already
 * gives this module's OWN edges downstream. This module stays IO-free
 * itself: `posPrior` is caller-supplied (the same convention `extractRelations`
 * already uses), so the header above ("PURE. No model call, no IO, no
 * network") still holds.
 */
export function readWithReceivedVocabulary(text, { surfaces = null, received = RECEIVED_RELATION_VERBS, clauseAware = false, posPrior = null, ...extractOpts } = {}) {
  const s = String(text ?? "");
  const surfaceList = surfaces ?? extractSurfaces([{ text: s }]).map((x) => x.surface);
  const discovered = surfaceList.length ? discoverRelationVocab(s, { surfaces: surfaceList, minSurfaces: 1 }).verbs : new Set();
  const receivedSet = received instanceof Set ? received : new Set(received ?? []);
  const verbs = new Set([...discovered, ...receivedSet]);
  if (!verbs.size) return { edges: [], discoveredVerbs: discovered, receivedVerbsUsed: new Set() };
  let edges = extractRelations(s, { verbs, ...extractOpts });
  if (clauseAware) {
    const sentClauses = splitSentences(s).flatMap((sent) => clauseSpans(sent.text).map((c) => ({ start: sent.offset + c.start, end: sent.offset + c.end })));
    const inOneWindow = (start, end) => sentClauses.some((w) => start >= w.start && end <= w.end);
    edges = edges.filter((e) => {
      const start = e.subjectOffset ?? e.offset ?? 0;
      const end = (e.objectOffset ?? e.offset ?? 0) + String(e.object ?? "").length;
      return inOneWindow(start, end);
    });

    if (posPrior) {
      const synthesized = [];
      for (const clause of sentClauses) {
        const props = propositionSpans(s.slice(clause.start, clause.end), { posPrior }).map((p) => ({
          ...p,
          start: clause.start + p.start,
          end: clause.start + p.end,
          verbStart: p.verbStart === null ? null : clause.start + p.verbStart,
          verbEnd: p.verbEnd === null ? null : clause.start + p.verbEnd,
        }));
        for (const p of props) {
          if (p.relation !== "coordinate-predicate" || p.sharesSubjectWith === null) continue;
          const parent = props[p.sharesSubjectWith];
          const parentEdge = edges.find((e) => {
            const es = e.subjectOffset ?? e.offset ?? 0;
            const ee = (e.objectOffset ?? e.offset ?? 0) + String(e.object ?? "").length;
            return es >= parent.start && ee <= parent.end;
          });
          if (!parentEdge) continue; // no measured subject to reuse -- kept, never guessed
          const objectRaw = s.slice(p.verbEnd, p.end);
          const objectText = objectRaw.trim();
          if (!objectText) continue;
          synthesized.push({
            subject: parentEdge.subject,
            subjectOffset: parentEdge.subjectOffset,
            verb: s.slice(p.verbStart, p.verbEnd),
            object: objectText,
            objectOffset: p.verbEnd + (objectRaw.length - objectRaw.trimStart().length),
            polarity: "+",
            synthesized: "coordinate-predicate",
          });
        }
      }
      edges = [...edges, ...synthesized];
    }
  }
  const receivedVerbsUsed = new Set(edges.map((e) => e.verb.toLowerCase()).filter((v) => receivedSet.has(v) && !discovered.has(v)));
  return { edges, discoveredVerbs: discovered, receivedVerbsUsed };
}
