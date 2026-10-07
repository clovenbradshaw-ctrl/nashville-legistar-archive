// native/adapters/text/propernoun-fold.js — a token-level fold that maps an
// inflected proper-noun form onto its lemma, BUILT FROM a received
// ProperNounPrior (giver-named, e.g. a treebank derivation) rather than a
// hand-typed rule. This is the fold a caller may inject into
// surfaces.js::namesCorefer / discoverReferents to stop one being stranding
// across its case-forms in an inflecting script (the-fold
// eval/results/anaphora-ru-RESULTS.md). Pure: it loads the prior object given
// to it and returns a token-normalizing function.
//
// THE CONTRACT, two facts that make it safe:
//
//   1. SINGLE LEMMA FOLDS; MULTI LEMMA STRANDS. A surface form attested under
//      EXACTLY ONE lemma maps onto that lemma — "Кутузову"/"Кутузовым" fold
//      onto stem "Кутузов". A form attested under MULTIPLE lemmas (a Russian
//      feminine nominative "Кутузова" is homographic with the genitive of
//      masculine "Кутузов") is AMBIGUOUS and is returned UNCHANGED — stranded,
//      disclosed, never guessed onto one being. This mirrors the pronoun
//      clean/soft split and corefersIndividuated's own rule that an ambiguous
//      fragment stands as its own referent.
//
//   2. ADJECTIVES NEVER ENTER. The prior maps UPOS=PROPN forms only (its
//      builder keys on that column). A derivational adjective — "Бородинский",
//      "Московский" — is a DIFFERENT part of speech, a different word, and is
//      absent from the PROPN register, so it is returned unchanged and never
//      folds onto the place noun. The no-over-merge boundary that matters
//      ("Кутузов" must NOT merge with "Бородинский") is a property of the
//      annotated data, not a rule policed here.
//
// The material decides presence (the prior never carries a window anywhere —
// it only says which surface forms are the same lemma; the fold only ever runs
// between surfaces the material itself already contains).
//
// @param {object} prior  a ProperNounPrior@1 shape: { forms: { [form]: { lemmas } } }
// @returns {(token: string) => string}  fold applied to lowercased tokens
export const makeProperNounFold = (prior) => {
  const table = new Map();
  if (prior?.forms) {
    for (const [form, rec] of Object.entries(prior.forms)) {
      const entries = Object.entries(rec?.lemmas ?? {});
      if (entries.length === 1) table.set(form, entries[0][0]);
    }
  }
  return (token) => {
    const t = String(token ?? "").toLowerCase();
    return table.get(t) ?? t;
  };
};
