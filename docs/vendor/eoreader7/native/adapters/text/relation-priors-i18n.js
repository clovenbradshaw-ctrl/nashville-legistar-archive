// relation-priors-i18n.js — the same closed-class shape priors.js already
// holds for lang/en (NEGATION_WORDS, SUBJECT_PRONOUNS, DEFINITE_DETERMINERS,
// CLAUSE_OPENERS, AUXILIARY_VERBS), given for the languages this project has
// real POS priors and UDHR readings for (Spanish, Arabic, Mandarin).
//
// WHY THIS EXISTS. `relations.js`'s own extractors (`discoverRelationVocab`,
// `extractRelations`, `expandSubjectNP`) already take every one of these
// five classes as an INJECTED parameter with an English default — the
// "search for the organ before writing one" answer here was that no new
// mechanism is needed, only real data for the existing injection points.
// `native/eval/lavar/eot-jsonl.mjs`'s own header names the gap directly
// (2026-09-09/10, this session): "--lang= swaps the ONE thing that is
// cheaply, honestly portable ... Everything else ... is left AS-IS on
// purpose." Measured live the same session: Arabic — which has ordinary
// whitespace — still extracted zero real propositions from its own UDHR
// body text with the English-only classes in place, only from the
// document's own incidental English UN-boilerplate header. This file closes
// that gap for the three languages this project can currently verify a
// reading against (real POS priors + real golden tuples already exist for
// spa/arb/cmn_hans).
//
// SCOPE, DISCLOSED RATHER THAN IMPLIED COMPLETE. Every set below is a real,
// giver-named closed grammatical class — never an open vocabulary list —
// but each is narrower than the full paradigm in the same disclosed way
// priors.js's own English classes are (COPULA_PARADIGM's own scope note:
// "says nothing about tense ... every consumer takes this by explicit
// injection and none takes it by default"). Spanish/Arabic auxiliary verbs
// are given at PRESENT TENSE forms only — other tenses are a real,
// unclaimed gap, not silently folded in. A category that does not exist
// the same way in a language's own typology is an EMPTY set with the reason
// stated, never a borrowed English shape forced onto it (the same
// discipline this project holds for the cube's own Ground-row cells: no
// cell is filled where none exists).
//
// Byte-identical for every existing caller: nothing here is wired in by
// default anywhere. A caller opts in per language, explicitly.

/**
 * Spanish (lang/es) — a Romance, pro-drop language with grammaticalised
 * gender/number agreement on determiners.
 */
export const RELATION_PRIORS_SPA = Object.freeze({
  // Auxiliary/modal verbs, PRESENT TENSE forms only (haber's compound-tense
  // paradigm, ser/estar as copula/progressive auxiliaries, and the core
  // modals). Other tenses (imperfect, preterite, future, conditional) are a
  // real, disclosed gap — not fabricated here.
  auxiliaryVerbs: Object.freeze(new Set([
    "he", "has", "ha", "hemos", "habéis", "han",
    "soy", "eres", "es", "somos", "sois", "son",
    "estoy", "estás", "está", "estamos", "estáis", "están",
    "puedo", "puedes", "puede", "podemos", "podéis", "pueden",
    "debo", "debes", "debe", "debemos", "debéis", "deben",
  ])),
  // Subject pronouns — the nominative personal forms plus the
  // demonstratives and interrogatives that can head a clause alone, the
  // same class SUBJECT_PRONOUNS (lang/en) draws. Spanish is pro-drop, so
  // these are the OVERT forms only; a dropped subject is a separate,
  // unaddressed gap (the same one this whole pass's header discloses for
  // the driver's sentence-splitting/subject-inheritance model generally).
  subjectPronouns: Object.freeze(new Set([
    "yo", "tú", "vos", "usted", "él", "ella",
    "nosotros", "nosotras", "vosotros", "vosotras", "ustedes", "ellos", "ellas",
    "este", "esta", "esto", "ese", "esa", "eso", "aquel", "aquella", "aquello",
    "quién", "quien", "qué", "cuál",
  ])),
  definiteDeterminers: Object.freeze(new Set(["el", "la", "los", "las", "lo"])),
  indefiniteDeterminers: Object.freeze(new Set([
    "un", "una", "unos", "unas", "algún", "alguna", "algunos", "algunas", "otro", "otra",
  ])),
  clauseOpeners: Object.freeze(new Set([
    "que", "quien", "quienes", "cuyo", "cuya",
    "porque", "aunque", "mientras", "cuando", "si", "antes", "después", "hasta", "para",
  ])),
  negationWords: Object.freeze(new Set([
    "no", "nunca", "jamás", "tampoco", "ni", "nadie", "nada", "ninguno", "ninguna",
  ])),
});
export const RELATION_PRIORS_SPA_META = Object.freeze({ giver: "lang/es", scope: "present-tense auxiliary forms only; overt subject pronouns only (pro-drop unaddressed)" });

/**
 * Arabic (lang/ar, MSA) — a Semitic language whose definiteness is a BOUND
 * morpheme (the ال- prefix on the noun itself), not a free-standing
 * determiner token, and which has no indefinite article at all (a bare noun
 * is indefinite by default). Both determiner classes below are correctly
 * EMPTY for this typological reason, stated rather than left silently
 * missing — forcing English's "a definite determiner is its own word" shape
 * onto Arabic would be exactly the borrowed-category mistake this whole
 * pass exists to close (the-fold POLICIES.md P76's own correction, one
 * register over: a case-marking strategy that still recovers "subject" is
 * the same borrowed category surviving through a different mechanism).
 */
export const RELATION_PRIORS_ARB = Object.freeze({
  // The copula's own paradigm (kāna, "to be" — obligatory in past tense,
  // null in ordinary present-tense predication, which is why there is no
  // present-tense form to list here) plus the negative copula (laysa).
  auxiliaryVerbs: Object.freeze(new Set(["كان", "كانت", "كانوا", "كنا", "كنت", "ليس"])),
  subjectPronouns: Object.freeze(new Set([
    "أنا", "أنت", "أنتِ", "هو", "هي", "نحن", "أنتم", "أنتن", "هم", "هن",
  ])),
  // Empty — see the module header: definiteness is the bound ال- prefix,
  // never a separate token this class could name.
  definiteDeterminers: Object.freeze(new Set()),
  // Empty — Arabic has no indefinite article; a bare noun is indefinite.
  indefiniteDeterminers: Object.freeze(new Set()),
  clauseOpeners: Object.freeze(new Set([
    "أن", "الذي", "التي", "الذين", "اللاتي",
    "لأن", "إذا", "عندما", "بينما", "حتى",
  ])),
  negationWords: Object.freeze(new Set(["لا", "لم", "لن", "ما", "ليس", "غير"])),
});
export const RELATION_PRIORS_ARB_META = Object.freeze({ giver: "lang/ar", scope: "definite/indefinite determiners are typologically empty by design, not an omission; copula listed only where an overt present-tense form exists" });

/**
 * Mandarin (lang/zh, written in Simplified Han for this project's
 * udhr-cmn_hans specimen) — topic-prominent, no grammaticalised
 * definiteness/indefiniteness marking at all (this.zh's demonstratives 这/那
 * are deictic, not articles, and are carried under subjectPronouns/
 * clauseOpeners rather than duplicated here), and aspect (了/着/过) is a
 * DIFFERENT grammatical slot from the modal auxiliaries this class names —
 * aspect particles are deliberately excluded, not folded in as if they were
 * the same thing.
 *
 * DISCLOSED LIMIT THIS FILE DOES NOT CLOSE: these classes help only once a
 * token boundary exists to match them against. Mandarin has no whitespace
 * between words, and `relations.js`'s own extractor splits on `\s+` — so
 * this real closed-class data is necessary but not sufficient; the deeper,
 * separate fix (real word segmentation) is still open, named in
 * `native/READING-SPEC.md` and this session's own prior report.
 */
export const RELATION_PRIORS_CMN = Object.freeze({
  // Modal verbs only — aspect markers (了/着/过) occupy a different slot
  // and are not auxiliary verbs in the sense this class names.
  auxiliaryVerbs: Object.freeze(new Set(["能", "会", "可以", "应该", "必须", "要", "想", "得"])),
  subjectPronouns: Object.freeze(new Set([
    "我", "你", "您", "他", "她", "它",
    "我们", "你们", "他们", "她们", "它们",
    "这", "那", "谁", "什么",
  ])),
  // Empty — Mandarin has no definite article; see module header.
  definiteDeterminers: Object.freeze(new Set()),
  // Empty — Mandarin has no indefinite article; a bare noun is unmarked for
  // (in)definiteness, and 一 + classifier is a measure-word construction
  // this class does not attempt to capture.
  indefiniteDeterminers: Object.freeze(new Set()),
  clauseOpeners: Object.freeze(new Set(["因为", "如果", "虽然", "当", "既然", "除非"])),
  negationWords: Object.freeze(new Set(["不", "没", "没有", "别", "无", "未"])),
});
export const RELATION_PRIORS_CMN_META = Object.freeze({ giver: "lang/zh (script/hans)", scope: "modal auxiliaries only, aspect particles excluded; definite/indefinite determiners typologically empty; word-segmentation gap unaddressed by this file" });

/**
 * The registry a caller actually reads — keyed the same way
 * `native/eval/lavar/eot-jsonl.mjs`'s own LANG_PRONOUNS is (ISO 639-3-ish
 * short codes matching this project's existing --lang= values). Absent for
 * every language this project has NOT built real closed classes for
 * (English stays the extractor's own default; fra/tur/kor/ell/heb/swh stay
 * exactly the "deliberate stress test" this session's own eot-jsonl.mjs
 * header names — no entry here means no change to their existing,
 * disclosed behavior).
 */
export const RELATION_PRIORS_BY_LANG = Object.freeze({
  spa: RELATION_PRIORS_SPA,
  arb: RELATION_PRIORS_ARB,
  cmn: RELATION_PRIORS_CMN,
});

/** Build the `extractRelations`/`discoverRelationVocab`/`expandSubjectNP` options object for a declared language, or `null` for a language with no registered relation priors (the caller's own signal to fall back to those functions' English defaults unchanged). */
export function relationPriorOptionsFor(lang) {
  const p = RELATION_PRIORS_BY_LANG[lang];
  if (!p) return null;
  return {
    auxiliaryVerbs: p.auxiliaryVerbs,
    subjectPronouns: p.subjectPronouns,
    definiteDeterminers: p.definiteDeterminers,
    indefiniteDeterminers: p.indefiniteDeterminers,
    clauseOpeners: p.clauseOpeners,
    negationWords: p.negationWords,
  };
}
