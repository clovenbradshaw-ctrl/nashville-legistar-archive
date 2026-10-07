// adapters/text/grammar.js — THE GRAMMAR REGISTER (2026-09-28): which
// language's grammar comes online, at which holonic level.
//
// User direction: "Be sure this, Chomsky, is properly connected to the
// various languages so this comes online when needed at the proper holonic
// level." The syntactic organs this session built and the ones before it —
// name trees (name-spans.js), the head phrase and its prepositions, clause
// trees (clause-spans.js), the copula and transition register (occupancy-
// testimony.js), the pronoun prior (pronouns.js), the relation dispatch
// (relations-language.js) — each declares `giver: "lang/en"` on its own
// closed classes, and each was being reached by direct import: English
// grammar came online because a file imported it, never because the
// material declared its language. This register is the one door:
//   grammarFor(language)          -> the grammar, or a typed gap
//   grammarAt(language, level)    -> that level's organs, or a typed gap
//   levelOfHolon(address)         -> which level a holon address is read at
// A language with no registered grammar returns `no_grammar_for_language`
// (the same terms pronouns.js's S39 holds); a level the grammar does not
// reach returns `no_grammar_at_level`. Never an English attempt on Russian
// material; never a clause organ asked to read a name.
//
// HOLONIC LEVELS, lowest first (kernel/gfp-claim.js's addresses, the
// user's own framing in clause-spans.js: "clause, sentence, paragraph,
// section — each itself a GFP, each drillable and collapsible"):
//   name < phrase < clause < sentence < paragraph < section < document
// A grammar organ lives at ONE level and is asked at that level: the name
// tree at `name`, the head cut at `phrase`, subordination at `clause`, the
// splitter at `sentence`. Paragraph and above carry no grammar in any
// language registered today — a paragraph is a convention of the script
// (P80's own measurement: section cuts land at chance) — and say so.
//
// PURE. Everything here is a pointer to an organ that already exists with
// its own giver; nothing is restated.

import { HONORIFIC_TITLES, HONORIFIC_TITLES_META, DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS, CLAUSE_COORDINATORS, SUBORDINATING_CONJUNCTIONS, SUBJECT_PRONOUNS, INTERROGATIVE_PRONOUNS, AUXILIARY_VERBS, NEGATION_WORDS, SENTENCE_TERMINATORS } from "./priors.js";
import { nameSpans, nameNesting, NAME_PARTICLES, NAME_PARTICLES_META } from "./name-spans.js";
import { clauseSpans } from "./clause-spans.js";
import { splitSentences } from "./spans.js";
import { COPULA_FORMS, COPULA_FORMS_META, LOCATIVE_PREPOSITIONS } from "./phasepost.js";
import { OCCUPANCY_TRANSITIONS_EN, OCCUPANCY_TRANSITIONS_EN_META } from "./occupancy-testimony.js";

export const HOLON_LEVELS = Object.freeze(["name", "phrase", "clause", "sentence", "paragraph", "section", "document"]);

/** The prepositions that close a head phrase and open a fronted phrase (lang/en). */
export const PREPOSITIONS_EN = Object.freeze(new Set(["of", "in", "on", "at", "from", "to", "for", "by", "with", "under", "over", "during", "after", "before", "until", "since", "among", "between", "within", "near", "behind", "beside", "beyond", "above", "below", "across", "through", "toward", "towards", "against", "along", "around", "into", "onto", "upon"]));
export const PREPOSITIONS_EN_META = Object.freeze({ giver: "lang/en — the prepositions occupancy-testimony.js cuts a head phrase at and reads a fronted phrase by" });

const GRAMMARS = Object.freeze({
  en: Object.freeze({
    language: "en", giver: "lang/en",
    levels: Object.freeze({
      name: Object.freeze({ titles: HONORIFIC_TITLES, titlesGiver: HONORIFIC_TITLES_META.giver, particles: NAME_PARTICLES, particlesGiver: NAME_PARTICLES_META.giver, determiners: Object.freeze(new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS])), spans: nameSpans, nesting: nameNesting }),
      phrase: Object.freeze({ prepositions: PREPOSITIONS_EN, prepositionsGiver: PREPOSITIONS_EN_META.giver, locative: LOCATIVE_PREPOSITIONS }),
      clause: Object.freeze({ coordinators: CLAUSE_COORDINATORS, subordinators: SUBORDINATING_CONJUNCTIONS, relativizers: Object.freeze(new Set(INTERROGATIVE_PRONOUNS.keys())), subjectPronouns: SUBJECT_PRONOUNS, spans: clauseSpans, copula: COPULA_FORMS, copulaGiver: COPULA_FORMS_META.giver, auxiliaries: AUXILIARY_VERBS, negation: NEGATION_WORDS, transitions: OCCUPANCY_TRANSITIONS_EN, transitionsGiver: OCCUPANCY_TRANSITIONS_EN_META.giver }),
      sentence: Object.freeze({ split: splitSentences, terminators: SENTENCE_TERMINATORS }),
    }),
  }),
});

/** The registered grammar for a language, or a typed gap — never a guess. */
export function grammarFor(language) {
  const key = String(language ?? "").toLowerCase().split(/[-_]/)[0];
  if (!key) return { gap: { reason: "no_language_declared", detail: "a grammar comes online for a declared language; none was declared" } };
  const g = GRAMMARS[key];
  return g ?? { gap: { reason: "no_grammar_for_language", language: key, registered: Object.keys(GRAMMARS), detail: `no grammar is registered for "${key}" — a reader that needs one refuses, never attempts another language's` } };
}

/** The organs at one holonic level for a language, or a typed gap. */
export function grammarAt(language, level) {
  if (!HOLON_LEVELS.includes(level)) return { gap: { reason: "unknown_level", level, levels: HOLON_LEVELS } };
  const g = grammarFor(language);
  if (g.gap) return g;
  const organs = g.levels[level];
  return organs ?? { gap: { reason: "no_grammar_at_level", language: g.language, level, detail: level === "paragraph" || level === "section" || level === "document" ? "a paragraph or section is a convention of the script, not a grammatical unit (P80: section cuts land at chance)" : `the ${g.language} grammar carries nothing at "${level}"` } };
}

/** Which level a holon address is read at, by its LAST segment's prefix: s = sentence, c = clause, p = paragraph, sec = section; "/" is the document. Unknown prefixes are a gap. */
export function levelOfHolon(address) {
  const segs = String(address ?? "/").split("/").filter(Boolean);
  if (!segs.length) return "document";
  const last = segs[segs.length - 1];
  if (/^sec\d*/i.test(last)) return "section";
  if (/^s\d+/i.test(last)) return "sentence";
  if (/^c\d+/i.test(last)) return "clause";
  if (/^p\d+/i.test(last)) return "paragraph";
  if (/^n\d+/i.test(last)) return "name";
  return null;
}

export const registeredLanguages = () => Object.keys(GRAMMARS);
