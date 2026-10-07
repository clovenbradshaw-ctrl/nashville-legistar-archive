// native/adapters/text/case-marked-language.js — a case-marking language's
// reading organs DERIVED from received priors, never typed in per language.
// Handle: Chomsky — the arrangement is universal; a language's grammar is the
// cube's cells worn by that language's surfaces (kernel/universal-grammar.js).
//
// relations-case-marked.js reads role off morphology and was built for Latin,
// with three Latin-specific pieces: a received preposition list, received
// personal endings to find the verb, and a closed exception map. For any
// language with a Universal Dependencies treebank, the first two need not be
// received by hand at all — the treebank already says which forms are
// closed-class and which endings are finite:
//
//   excludeForms   every form whose dominant UPOS in the language's POSPrior@1
//                  is a closed, never-a-participant class (ADP, CCONJ, SCONJ,
//                  PART, INTJ, ADV). Attested forms only; nothing guessed.
//   classifyVerb   a word is a finite verb when (a) the POSPrior, if it knows
//                  the form, says VERB/AUX dominates, and (b) the CasePrior's
//                  verbFormByEnding (the opt-in VerbForm tally,
//                  scripts/build-latin-case-prior.mjs --verbform-table=1) puts
//                  VerbForm=Fin on top of the word's ending at the declared
//                  floors. Built because Russian's PAST tense — the tense a
//                  novel is told in — carries no Person feature, so a
//                  person-ending table never sees it.
//
// Every floor is declared by the caller (P9). A word neither prior can speak
// for is not a verb here — a gap in the reader, never a guess.

const CLOSED = new Set(["ADP", "CCONJ", "SCONJ", "PART", "INTJ", "ADV"]);
const dominant = (tags) => { let top = null, n = 0, tot = 0; for (const [t, c] of Object.entries(tags ?? {})) { tot += c; if (c > n) { top = t; n = c; } } return top ? { tag: top, share: n / tot } : null; };

export function caseMarkedLanguage({ casePrior, posPrior, verbEndingLen, minVolume, minShare } = {}) {
  for (const [k, v] of Object.entries({ casePrior, posPrior, verbEndingLen, minVolume, minShare })) if (v === undefined || v === null) throw new TypeError(`caseMarkedLanguage: '${k}' must be declared`);
  if (!casePrior.verbFormByEnding) throw new TypeError("caseMarkedLanguage: casePrior carries no verbFormByEnding — rebuild it with --verbform-table=1");
  const forms = posPrior.forms ?? {};
  const excludeForms = new Set();
  for (const [f, tags] of Object.entries(forms)) { const d = dominant(tags); if (d && CLOSED.has(d.tag)) excludeForms.add(f.toLowerCase()); }
  const classifyVerb = (word) => {
    const lower = String(word).toLowerCase();
    const known = dominant(forms[lower]);
    if (known && known.tag !== "VERB" && known.tag !== "AUX") return null;
    const entry = casePrior.verbFormByEnding[lower.slice(-verbEndingLen)];
    if (!entry || entry.total < minVolume) return null;
    const top = entry.ranked[0];
    if (top.key !== "Fin" || top.share < minShare) return null;
    return { word, ending: lower.slice(-verbEndingLen), person: null, number: null, share: top.share, weak: !known, giver: `${casePrior.provenance?.giver ?? "case prior"} VerbForm by ending` };
  };
  // HEADS ONLY: a case-marked language's adjectives, determiners and numerals
  // AGREE with their noun, so a clause carries several words in the same case
  // and "the nominative" is ambiguous by construction (measured on
  // UD_Russian-GSD dev before this: ambiguous_nominative the largest gap).
  // Only a form the POSPrior types NOUN/PROPN/PRON by dominance may be an end;
  // an unattested form is kept (a proper name the treebank never saw).
  const HEAD = new Set(["NOUN", "PROPN", "PRON"]);
  const isHead = (word) => { const d = dominant(forms[String(word).toLowerCase()]); return !d || HEAD.has(d.tag); };
  // GOVERNED: the word right after a preposition is its object — oblique,
  // never an end. The prepositions are the treebank's own attested ADP forms.
  const adpositions = new Set(Object.entries(forms).filter(([, t]) => dominant(t)?.tag === "ADP").map(([f]) => f.toLowerCase()));
  return Object.freeze({ casePrior, excludeForms, classifyVerb, isHead, adpositions, language: casePrior.language ?? posPrior.language ?? null });
}
