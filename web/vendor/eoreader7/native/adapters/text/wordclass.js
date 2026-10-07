// eoreader7 native · adapters/text/wordclass — Dionysius Thrax's eight parts of
// speech as a giver-named LENS over a word, never a fact this engine
// derives. Composes two already-received priors; invents no new mechanism.
//
// THE FINDING THIS CLOSES. hypergraph.js's relation edges read a triple as
// (subject, verb, object), and "verb" was never checked against anything —
// it is whatever token sits in the connector slot. Read against real
// material (the-fold's eval/results/asserted-crosslingual.md), the
// connector slot holds "this" ("that" —this→ "means war"), "still" ("if
// you" —still→ "try"), "book" ("CHAPTER XII" —book→ "ONE"): a pronoun, an
// adverb, a noun, each called a verb because nothing ever asked. That is
// not a bug in a classifier; it is a category never applied. This module
// applies it, honestly: SLOT (which position a span fills in a clause —
// extractRelations's own first-span/connector/second-span structure) and
// CLASS (what part of speech a word's FORM is, independent of any one
// clause) are two different axes, kept separate by Halliday's Systemic
// Functional Grammar for exactly this reason (function vs. class — a
// function can be realised by any class). This file answers CLASS only.
// Nothing here reads or knows about a clause, a triple, or a slot.
//
// TWO PRIORS, TWO GIVERS, NEVER MERGED INTO ONE CLAIM.
//   1. MEASURED: which classes a form is attested as, and how often, in a
//      real human-annotated treebank — Universal Dependencies
//      UD_English-EWT (CC BY-SA 4.0), via THIS repo's own
//      scripts/build-pos-prior.mjs (POSPrior@1), which existed, was never
//      run, and is run for the first time by this pass. Ambiguity is
//      PRESERVED in the prior (its own header says so) and preserved again
//      here — classifyWord never picks a winner.
//   2. DECLARED: which of Dionysius Thrax's eight ancient categories
//      (Tekhnē grammatikē, Alexandria, ~100 BCE) a UD tag corresponds to.
//      This is a TRANSLATION between two schemes built 2,100 years apart,
//      not a fact — THRAX_MAP's own comments name exactly where the two do
//      and do not line up, including the additions Thrax's own text never
//      made (interjection: Donatus and Priscian, Latin, a few centuries
//      later, replacing the article Latin has none of).
//
// WHAT THIS FILE DOES NOT DO. It does not collapse an ambiguous word to one
// class — that is exactly the move `perceiver/text/roles.js::resolveSpanRole`
// already exists for, at the right grain: a TYPE-level frequency table
// ("book is usually a noun") cannot answer an INSTANCE-level question
// ("book" in THIS clause), and the-fold's own CLAUDE.md already carries the
// postmortem for treating those as the same question (mine-1-unimorph-
// disambiguated: a determiner-adjacency vote over type frequency introduced
// real contradictions a caller never asked for). `dominantClass` below is
// the one permitted convenience, and it takes its cut DECLARED, never
// defaulted, the same discipline resolveSpanRole's own minActivation/
// minMargin already hold.

/**
 * Dionysius Thrax's eight parts of speech, as a translation FROM Universal
 * Dependencies' UPOS tagset. Every entry states what agrees with Thrax's
 * own text and what does not — this is a declared reading, not a fact
 * inherited from either scheme.
 */
export const THRAX_MAP = Object.freeze({
  // ónoma (ὄνομα) — Thrax's own category, unmarked for proper/common.
  NOUN: "noun",
  PROPN: "noun",
  // rhêma (ῥῆμα) — Thrax's own category. UD splits AUX (copula/auxiliary
  // "to be", "to have") from VERB for typological reasons foreign to
  // Thrax's Greek-specific scheme; both fall under one ancient category.
  VERB: "verb",
  AUX: "verb",
  // antōnymía (ἀντωνυμία) — Thrax's own category.
  PRON: "pronoun",
  // arthron (ἄρθρον) — Thrax's own category, but narrower than UD's DET:
  // Thrax's article was specifically the Greek DEFINITE article. UD's DET
  // also covers English's indefinite article and demonstratives/
  // possessives ("a", "this", "my") — a real widening, not a literal match.
  DET: "article",
  // próthesis (πρόθεσις) — Thrax's own category.
  ADP: "preposition",
  // sýndesmos (σύνδεσμος) — Thrax's own category, UNDIVIDED. UD's
  // coordinating/subordinating split (CCONJ/SCONJ) is a modern refinement
  // with no ancient counterpart; both map to the one Thrax category.
  CCONJ: "conjunction",
  SCONJ: "conjunction",
  // epírrhēma (ἐπίρρημα) — Thrax's own category.
  ADV: "adverb",
  // NOT Thrax's own: Donatus and Priscian (Latin grammarians, a few
  // centuries after Thrax) dropped the article — Latin has none — and
  // added the interjection in its place. Kept here, named as the addition
  // it is, never presented as Thrax's original eight.
  INTJ: "interjection",
});

/**
 * UD tags with NO clean Thrax-tradition analogue, kept OUT of THRAX_MAP
 * rather than silently forced into the nearest category. Ancient Greek and
 * Latin grammar classed adjectives under "noun" because they share nominal
 * inflection (case, gender, number) — a claim about Greek MORPHOLOGY, not
 * a claim that adjective and noun are the same part of speech, so folding
 * ADJ into "noun" here would misrepresent Thrax's own reasoning rather
 * than honour it. PART is UD's own residual bucket (infinitival "to",
 * possessive "'s", negation particles) with no ancient counterpart at all.
 * NUM/PUNCT/SYM/X are not parts of speech in the grammatical sense.
 */
export const THRAX_OUT_OF_SCOPE = Object.freeze(new Set(["ADJ", "PART", "NUM", "PUNCT", "SYM", "X"]));

export const THRAX_META = Object.freeze({
  giver: "Dionysius Thrax, Tekhnē grammatikē, Alexandria, ~100 BCE (interjection: Donatus/Priscian, Latin, later)",
  scope: null,
});

export const POS_PRIOR_META = Object.freeze({
  giver: "Universal Dependencies UD_English-EWT, CC BY-SA 4.0 (scripts/build-pos-prior.mjs)",
  scope: "lang/en",
});

/**
 * Every class this occurrence's own FORM is attested as, with real counts
 * from the treebank and the Thrax-tradition reading of each — never
 * collapsed to one answer.
 *
 * @param {string} surface the word form, as it appears in the material.
 * @param {{forms: Object<string, Object<string,number>>}} posPrior a
 *   POSPrior@1-shaped object (scripts/build-pos-prior.mjs's own output).
 *   Injected, never assumed present — the cast.js pattern: this file has
 *   no filesystem access and no notion of where the prior lives on disk.
 * @returns {{surface: string, found: boolean, total: number,
 *   candidates: Array<{upos: string, count: number, share: number,
 *   thraxClass: (string|null)}>}} candidates sorted by count, descending.
 *   `thraxClass` is null for a UD tag THRAX_MAP does not cover
 *   (THRAX_OUT_OF_SCOPE) — a disclosed absence, never a guess.
 */
export const classifyWord = (surface, { posPrior } = {}) => {
  const lower = (surface ?? "").toLowerCase();
  const counts = posPrior?.forms?.[lower];
  if (!counts) return { surface, found: false, total: 0, candidates: [] };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const candidates = Object.entries(counts)
    .map(([upos, count]) => ({
      upos,
      count,
      share: total > 0 ? count / total : 0,
      thraxClass: THRAX_MAP[upos] ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  return { surface, found: true, total, candidates };
};

/**
 * The one permitted convenience: collapse a classification to a single
 * class, but only when the top candidate clears a CALLER-DECLARED share of
 * the attested count — never defaulted, the same standing
 * resolveSpanRole's own minActivation/minMargin already hold ("how much
 * counts as real is a property of the reading, not a constant this file
 * assumes"). Short of the bar, or with no candidates at all, this refuses
 * rather than guesses — the caller's honest next step for a genuinely
 * close case (e.g. "that": SCONJ 994 vs PRON 851, no dominant share) is
 * `resolveSpanRole` over this OCCURRENCE's own local company, not a
 * type-level frequency vote.
 *
 * @param {ReturnType<typeof classifyWord>} classification
 * @param {number} minShare declared floor, 0..1.
 */
export const dominantClass = (classification, { minShare } = {}) => {
  if (!Number.isFinite(minShare) || minShare < 0 || minShare > 1)
    throw new TypeError("dominantClass: minShare is declared — how dominant a candidate must be is never a default");
  const top = classification?.candidates?.[0];
  if (!top || top.share < minShare) return null;
  return top;
};
