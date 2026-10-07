// eoreader7 · adapters/text/construction — collapse a form's superposed
// class AT THE OCCURRENCE, by the construction it stands in.
//
// THE RULE THIS SERVES. A prior over word forms holds ambiguity honestly
// (build-pos-prior.mjs: "a form keeps every UPOS tag the treebank ever gave
// it... never collapsed to one majority verdict here") but gives a consumer
// nothing to collapse it WITH. So consumers collapse it globally — measured,
// anchoring.js's being-evidence gate keeps a form when VERB > AUX, which
// admits `had` on the strength of 335 main-verb uses in a treebank and then
// reads "the murder had been committed" as the murder acting.
//
// A form is not the thing with a class; the OCCURRENCE is (roles.js's own
// statement of the same rule, one level over). Auxiliaryhood in particular
// is not lexical at all — it is constructional: `had` is AUX before a
// participle and a main verb before a noun phrase. So the collapse is done
// here against ConstructionPrior@1, which conditions a form's class
// distribution on the observable trace of its construction — the dominant
// class of the token that follows.
//
// COLLAPSE IS NOT GUARANTEED, and that is the point. A cell whose top class
// does not clear the caller's declared `minShare` is reported LIVE: the
// superposition did not collapse on this evidence. `has` before a particle
// is 53/47 AUX/VERB in the treebank and has no business being called either.
// A live reading is a result, never a failure — the same standing every gap
// in this repo already holds.
//
// NOTHING IS HAND-LISTED. Which forms are ambiguous, which cells exist, and
// every count are the received treebank's own facts. This file contributes
// the backoff ladder and the floors, both declared by the caller.

const DECLARED = "construction: minShare is declared — how dominant a class must be to count as collapsed is a property of the reading, never a constant this file assumes";

const shareOf = (dist) => {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const [cls, n] = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  return { cls, n, total, share: n / total };
};

/**
 * dominantClass — the class a form is most often tagged, from the form-level
 * prior. This is the CONDITIONING VARIABLE, not a verdict about the token:
 * it stands in for "what kind of thing follows", which is what the treebank
 * cells were keyed on at build time.
 */
export const dominantClass = (form, formPrior) => {
  const row = formPrior?.forms?.[String(form ?? "").toLowerCase()];
  if (!row) return null;
  return Object.entries(row).sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * collapseForm — resolve one occurrence's class.
 *
 * @param {string} form the token being resolved
 * @param {string|null} nextForm the token after it in the material, or null
 *   at a sentence end (which is itself a frame, not a missing value)
 * @param {object} options
 * @param {object} options.constructionPrior ConstructionPrior@1
 * @param {object} options.formPrior POSPrior@1 — the backoff level
 * @param {number} options.minShare declared; below it the reading stays live
 * @param {string} [options.sentenceEndFrame] the key standing for "nothing
 *   follows"; read from the construction prior's own declaration
 * @returns {{standing: "collapsed"|"live"|"gap", cls: string|null, share: number|null,
 *            n: number|null, basis: string, frame: string|null, distribution: object|null}}
 */
export const collapseForm = (form, nextForm, {
  constructionPrior,
  formPrior,
  minShare,
  sentenceEndFrame = constructionPrior?.declared?.sentenceEndFrame ?? "END",
} = {}) => {
  if (!Number.isFinite(minShare) || minShare <= 0 || minShare > 1) throw new TypeError(DECLARED);
  const key = String(form ?? "").toLowerCase();

  // level 1 — the construction. The frame is what follows, read through the
  // form-level prior exactly as the builder read it.
  const frame = nextForm == null ? sentenceEndFrame : (dominantClass(nextForm, formPrior) ?? "UNK");
  const cell = constructionPrior?.forms?.[key]?.[frame];
  if (cell) {
    const top = shareOf(cell);
    if (top) {
      return top.share >= minShare
        ? { standing: "collapsed", cls: top.cls, share: top.share, n: top.total, basis: "construction", frame, distribution: cell }
        : { standing: "live", cls: null, share: top.share, n: top.total, basis: "construction", frame, distribution: cell };
    }
  }

  // level 2 — the form alone. Reached when the construction was never
  // observed enough to be a distribution; disclosed as a weaker basis, never
  // silently mixed with level 1.
  const row = formPrior?.forms?.[key];
  if (row) {
    const top = shareOf(row);
    if (top) {
      return top.share >= minShare
        ? { standing: "collapsed", cls: top.cls, share: top.share, n: top.total, basis: "form", frame, distribution: row }
        : { standing: "live", cls: null, share: top.share, n: top.total, basis: "form", frame, distribution: row };
    }
  }

  // level 3 — nothing received says anything about this form.
  return { standing: "gap", cls: null, share: null, n: null, basis: "unattested", frame, distribution: null };
};
