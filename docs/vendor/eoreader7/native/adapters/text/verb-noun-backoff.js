// verb-noun-backoff.js -- a corpus-derived, register-agnostic signal for the
// real NOUN/VERB mistags margin-calibration.test.mjs proved are
// concentrated in the low-margin half (high-margin accuracy 0.9987 vs
// low-margin 0.9077, Fisher p=9.926e-264, median margin 26.886 -- all real,
// measured, reused here unchanged, never re-derived or hand-set).
//
// THE MOTIVATING CASE: "Photosynthesis converts light energy into chemical
// energy stored in glucose." mistags "converts" as NOUN, margin 4.627 (real,
// below the median). The word never occurs in the training treebank
// (`grep -c "^converts\t" en_ewt-ud-train.conllu` = 0) and its lemma
// "convert" occurs only 3 times total -- too sparse to fix from the
// training treebank alone (background this file's own commit message
// records in full).
//
// TWO DESIGNS WERE TRIED AND MEASURED, NOT ASSUMED. Both are disclosed here
// because both are real findings, not because either is recommended for
// unconditional use:
//
// (1) A NARROWER SYNTACTIC IDEA, REJECTED BY MEASUREMENT: "a word ending in
//     -s followed within a window by 'into' is probably a verb." Tested
//     against the real gold treebank (training 9/10 of en_ewt-ud-train
//     .conllu, held-out tenth untouched) across window sizes 1..8: best
//     precision 0.30 (window 1, only 20 firings in the WHOLE training
//     corpus) against a null base rate of P(VERB | ends in -s) = 0.1046 --
//     real lift, but far too weak and far too rare. Not implemented here.
//
// (2) THE SIBLING-FAMILY SIGNAL BELOW, MEASURED AND DISCLOSED AS A NET
//     REGRESSION AT POPULATION SCALE, EVEN THOUGH IT REALLY DOES FIX THE
//     MOTIVATING CASE. siblingForms()/siblingVerbLean() aggregate the
//     tagger's own high-confidence (margin >= 26.886) votes on a word's
//     MORPHOLOGICAL SIBLINGS (bare stem, -ing form, -ed form) from a real
//     scan of live_priors (all 13 numbered content categories -- see
//     native/scripts/build-verb-noun-backoff-prior.mjs -- none hardcoded).
//     For convert/converts/converting/converted this correctly shows
//     convert/converting/converted overwhelmingly VERB at high confidence,
//     while the exact ambiguous form "converts" itself showed a real
//     competing NOUN sense in one sample ("Time makes more converts than
//     ...", the religious-convert noun) -- which is exactly why the exact
//     form's own votes are excluded from its own family's evidence pool:
//     they are what is in question, not independent evidence for it.
//
//     backoffCorrectedTag() below implements this as a sibling-relative-
//     majority rule and DOES flip "converts" correctly in the motivating
//     sentence. But measured on the SAME held-out tenth
//     margin-calibration.test.mjs already uses (20,034 tokens): of the 543
//     real low-margin NOUN/PROPN -s-ending predictions, only 18 (3.3%) are
//     actually gold VERB -- a hard ceiling this signal cannot see past. The
//     rule as implemented fires 73 times, correcting 15 of those 18 real
//     errors (83% recall on the true-error subset) but wrongly flipping 58
//     genuinely-NOUN low-margin words (precision 0.205) -- net token
//     accuracy MOVES DOWN, 0.953180 -> 0.951183 (verb-noun-backoff
//     .test.mjs's own real, committed numbers). Two refinements were also
//     measured and did not change the verdict: excluding candidates whose
//     immediately preceding tag is DET/ADJ/NUM/PRON (precision still ~0.20,
//     delta still -30); and requiring zero counter-evidence plus a rising
//     vote floor (best precision 0.357 at a 20-vote floor, only 14 firings,
//     delta still -3). A compound rule requiring BOTH the sibling-family
//     evidence above AND a nearby goal preposition (into/to/from/onto
//     /toward/towards) was also measured and fired too rarely (2-7 times)
//     to be reliable at any tested setting (precision 0.0-0.33).
//
// THE HONEST CONCLUSION: English noun/verb zero-derivation ("houses",
// "disputes", "witnesses", "murders", "attacks" -- all real regressions
// measured above, all genuine plural nouns whose stem ALSO has a real verb
// sense somewhere in a large corpus) is common enough that "this word
// family is used as a verb somewhere in real text" is not, by itself,
// discriminating evidence about any ONE occurrence's actual sense. This is
// why backoffCorrectedTag() is NOT called by tagSentence, tagSentenceWith
// Margins, or anywhere else in this file's own callers by default -- it is
// purely additive and opt-in, kept for the one case it is real, disclosed
// evidence for (a caller who wants sibling-family evidence as one input
// among others, or who is willing to accept its measured precision/recall
// tradeoff for a narrower use than "flip every low-margin -s NOUN"), never
// wired in as an unconditional correction.

/** General English -s/-es/-ies verb-inflection morphology (not a lookup
 *  table, not word-specific): derive a -s form's bare stem, -ing form and
 *  -ed form. Ambiguous only in the ordinary way English spelling already is
 *  (e.g. a stem ending in a consonant may or may not double before -ing);
 *  callers look candidates up in a real corpus-derived table, so a
 *  double-checked stem that never actually occurs simply contributes no
 *  votes rather than a wrong one. */
export function siblingForms(word) {
  const w = String(word || "").toLowerCase();
  if (!/^[a-z]{3,}s$/.test(w)) return null;
  let stem;
  if (/[^aeiou]ies$/.test(w)) stem = w.slice(0, -3) + "y"; // carries -> carry
  else if (/(?:s|x|z|ch|sh)es$/.test(w)) stem = w.slice(0, -2); // passes -> pass, watches -> watch
  else stem = w.slice(0, -1); // converts -> convert
  const ing = /e$/.test(stem) && !/(?:ee|oe|ye)$/.test(stem) ? stem.slice(0, -1) + "ing" : stem + "ing";
  const ed = /e$/.test(stem) ? stem + "d" : /[^aeiou]y$/.test(stem) ? stem.slice(0, -1) + "ied" : stem + "ed";
  return { stem, ing, ed };
}

/** Aggregate confident VERB vs NOUN/PROPN votes across a word's sibling
 *  forms ONLY (never the exact form itself -- see file header). Returns
 *  {verbVotes, nounVotes} both >= 0; {verbVotes: 0, nounVotes: 0} means the
 *  prior has no corroborating evidence either way, which callers must treat
 *  as "leave the prediction alone", not as evidence for NOUN. */
export function siblingVerbLean(index, word) {
  const forms = siblingForms(word);
  if (!forms) return { verbVotes: 0, nounVotes: 0 };
  let verbVotes = 0, nounVotes = 0;
  for (const sib of [forms.stem, forms.ing, forms.ed]) {
    const rec = index?.counts?.[sib];
    if (!rec) continue;
    verbVotes += rec.VERB || 0;
    nounVotes += (rec.NOUN || 0) + (rec.PROPN || 0);
  }
  return { verbVotes, nounVotes };
}

/**
 * The sibling-relative-majority backoff rule (see file header for why this
 * is disclosed as a MEASURED NET REGRESSION at population scale, and is
 * therefore not called by any default tagging path in this file). Only
 * ever touches a prediction that is ALREADY low-margin and ALREADY tagged
 * NOUN/PROPN on a word ending in -s; every other prediction passes through
 * unchanged. Flips to VERB only when the sibling family's confident votes
 * show a strict VERB majority AND at least one real confident VERB vote
 * exists (never flips on the mere absence of NOUN evidence) -- a
 * sibling-relative-majority rule, not an invented cutoff -- but this
 * majority-vote criterion is exactly the part measurement showed is not
 * discriminating enough: see verb-noun-backoff.test.mjs's own committed
 * numbers before enabling this anywhere.
 *
 * @param {object} index          the loaded VerbNounBackoffPrior@1 JSON
 * @param {string} word           the surface form as tagged
 * @param {string} tag            the tagger's own predicted UPOS tag
 * @param {number|null} margin    that token's own margin (bestWithMargin)
 * @param {number} medianMargin   the population median margin to gate on
 *                                (pass 26.886, margin-calibration.test.mjs's
 *                                real measured value -- never hand-set here)
 */
export function backoffCorrectedTag(index, word, tag, margin, medianMargin) {
  if (tag !== "NOUN" && tag !== "PROPN") return tag;
  if (margin === null || margin === undefined || !(margin < medianMargin)) return tag;
  if (!/^[a-zA-Z]{3,}s$/.test(word)) return tag;
  const { verbVotes, nounVotes } = siblingVerbLean(index, word);
  if (verbVotes > 0 && verbVotes > nounVotes) return "VERB";
  return tag;
}
