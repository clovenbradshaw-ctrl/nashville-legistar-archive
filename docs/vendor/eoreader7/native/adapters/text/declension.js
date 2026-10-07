// native/adapters/text/declension.js — does inflected surface A reach
// EXACTLY observed surface B under a productive case transform this
// language's own noun morphology licenses?
//
// CELL: CON · Structure · Figure (Link) — binding two already-extracted
// surface forms into one identity is a relate act between two specific
// things, not a scout (SIG) or an individuation (INS) of either alone.
//
// THE ONE RULE THAT MAKES THIS SAFE: this file answers a PAIRWISE
// question — "given these two SPECIFIC observed strings, does one reach
// the other" — never "what is this word's lemma." A rule applied to a
// single word in isolation can corrupt it (build-declension-prior.mjs's
// own header: a language's genitive-plural pattern can also match an
// already-nominative proper name that happens to end the same way). A
// rule applied pairwise against a second REAL observed string cannot: a
// false merge needs two unrelated real surfaces in the same document to
// coincide on the exact same transformed string, not one word's own
// identity to be silently rewritten.
//
// INJECTED, not imported: the prior (DeclensionPrior@1, built by
// build-declension-prior.mjs from a received UniMorph paradigm table,
// giver named in the prior's own provenance) arrives as data. This file
// knows nothing about any one language — Russian today, anything else a
// caller builds a prior for tomorrow.

const MIN_STEM = 2; // below this the residual stem after stripping a case ending is too short to trust as one word's own root

/**
 * createDeclensionFolder(prior, { minStem }) -> { sameStem(inflected, base) }
 *
 * `prior`   a DeclensionPrior@1 object ({ rules: [{from, to, count}, ...] })
 *           — omit or pass null and sameStem always returns false, loudly
 *           disclosed via `.gap`, never silently.
 * `minStem` the residual-stem floor (default MIN_STEM, the structural
 *           minimum below which a stripped ending leaves nothing to
 *           anchor an identity claim on).
 */
export const createDeclensionFolder = (prior, { minStem = MIN_STEM } = {}) => {
  if (!prior || !Array.isArray(prior.rules) || !prior.rules.length) {
    const sameStem = () => false;
    sameStem.gap = { reason: "no_declension_prior", tier: "model", detail: "no declension prior injected — names never fold across case, exact-token comparison only" };
    return { sameStem, gap: sameStem.gap };
  }
  const rules = prior.rules;
  // One direction only per call is enough: the consumer (namesCorefer)
  // already tries both (a, b) and (b, a), matching the shared-final-token
  // check it sits beside.
  const sameStem = (inflected, base) => {
    if (!inflected || !base || inflected === base) return false;
    for (const r of rules) {
      if (!inflected.endsWith(r.from)) continue;
      const stemLen = inflected.length - r.from.length;
      if (stemLen < minStem) continue;
      if (inflected.slice(0, stemLen) + r.to === base) return true;
    }
    return false;
  };
  sameStem.gap = null;
  return { sameStem, gap: null };
};
