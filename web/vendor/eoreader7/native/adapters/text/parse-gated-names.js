// adapters/text/parse-gated-names.js — proper-name candidate admission with
// the per-occurrence SVO parse as the GATE and capitalisation as
// CORROBORATION, not a coequal vote.
//
// THE GAP THIS CLOSES. Measured 2026-09-23 on a 365-item, 9-annotator blind
// gold for Henry IV Part 1 (modern spelling): the two detectors this repo
// already had for "is this word a name" — surfaces.js's `extractSurfaces`
// (a capitalised-run scan; imports only deriveAbbreviations and
// NEVER_A_NAME/HONORIFIC_TITLES, never a parser) and existence-grain.js's
// naming signal (also `R.cased && e.capP < ALPHA`, its own separate
// capitalisation-significance test) — are BOTH orthography-only. Neither
// reads the material's own SVO structure. The one detector that does,
// `english-parser.js`'s per-sentence dependency tagger read via
// `upostOccurrences`, already outperformed both on F1 (67.4 vs 55.1 and
// 63.7) used alone. Confirmed by the user's own read of the code: "we have
// to go through SVO for English to get there" (to the cube) — checked, not
// assumed, and it was right in a stronger way than stated: two of five
// candidate detectors did not touch the parse AT ALL, not just weight it
// too lightly.
//
// THE RULE, and why it is this rule and not a plausible-sounding one.
// Nine admission formulas were scored against the same gold before this
// one was picked (existence-grain's own naming signal AND-gated with the
// parse actually CRATERED recall to 43.2%, because it compounds two
// already-conservative gates):
//   parse-any (>=1 occurrence PROPN) alone ................ F1 70.5
//   parse-majority (>=0.5 of occurrences PROPN) alone ...... F1 67.4
//   parse-any AND capitalised (surfaces.js run) ............ F1 77.5  <- this rule
//   parse-majority OR (parse-any AND capitalised) .......... F1 70.7
//   parse-any AND existence-grain's own naming/Entity ...... F1 55.6
//   parse-any AND (existence-grain OR capitalised) ......... F1 77.4
//   best PRE-EXISTING combination (no parse gate at all) ... F1 76.3
// "parse-any AND capitalised" won: precision 69.4%, recall 87.7%, F1 77.5
// — the best of everything tried, including the best combination of the
// OLD orthography-only detectors. A single real syntactic PROPN reading is
// enough to license (majority-of-occurrences is stricter and scores
// worse); capitalisation stays required as independent corroboration, so
// a parser mistake tagging a stray lowercase function word PROPN once
// cannot admit it alone.
//
// STANDALONE AND UNWIRED, on the same standing as
// english-parser-perceiver.mjs's own header: nothing imports this into
// recursive.js's createCausalTextPerceiver or session.reader. Wiring it
// into the live admission path (replacing or gating surfaces.js's role in
// discoverReferents) changes behaviour for every session's every read and
// needs the same explicit sign-off that perceiver's wiring required —
// this file is proven and ready for that decision, not a silent default.
//
// PARTICULAR TO ENGLISH, named rather than assumed: `model` is
// english-parser.js's trained UD parser for English (parser-eng-ewt.json).
// A caseless script or a language without this repo's own trained parser
// has no `upostOccurrences` to gate with — surfaces.js's capitalisation
// scan (or its own script's Entity/Kind cues) remains what runs for it.

import { splitSentences } from "./spans.js";
import { extractSurfaces } from "./surfaces.js";
import { upostOccurrences } from "./english-parser.js";

const WORD = /\p{L}[\p{L}'’]*/gu;

/**
 * parseGatedNames(text, {model, sentenceOpts, surfaceOpts}) —
 *
 * `model` a loaded english-parser.js model (loadModel(json)), REQUIRED.
 *
 * Returns:
 *   admitted  Set<lowercased word> licensed by parse-any AND capitalised.
 *   evidence  Map<word, {capitalized, synPropn, occurrences}> — the raw
 *             evidence behind every capitalised-run candidate, admitted
 *             or not, so a caller can see why one was refused.
 *   runs      surfaces.js's own capitalised-run candidates (multi-word
 *             surfaces like "Sir John Falstaff"), filtered to the runs
 *             where at least one constituent word is admitted — the
 *             shape a referent-discovery caller (discoverReferents)
 *             actually consumes, not bare isolated words.
 */
export function parseGatedNames(text, { model, sentenceOpts, surfaceOpts } = {}) {
  if (!model) throw new TypeError("parseGatedNames: a loaded english-parser.js model is required");
  const sents = splitSentences(text, sentenceOpts);
  const surfaceRuns = extractSurfaces(sents, surfaceOpts);
  const occ = upostOccurrences(model, text);

  const capitalizedWords = new Set();
  for (const r of surfaceRuns) for (const w of r.surface.toLowerCase().match(WORD) ?? []) capitalizedWords.add(w);

  const admitted = new Set();
  const evidence = new Map();
  for (const w of capitalizedWords) {
    const os = occ.get(w) ?? [];
    const synPropn = os.some((o) => o.upos === "PROPN");
    evidence.set(w, { capitalized: true, synPropn, occurrences: os.length });
    if (synPropn) admitted.add(w);
  }

  const runs = surfaceRuns.filter((r) => (r.surface.toLowerCase().match(WORD) ?? []).some((w) => admitted.has(w)));
  return { admitted, evidence, runs };
}
