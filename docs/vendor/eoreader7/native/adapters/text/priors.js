// the legacy engine · perceiver/text/priors — the prior register for closed-class
// word sets. Every received closed class enters through DEF.admit, names its
// giver, declares its scope (Amendment IV). These are not mined from the
// material; they are received facts about a language's function words or a
// script's typographic conventions.
//
// Each export carries a `giver` and optional `scope` so a reader can trace
// provenance back to the language or script that supplied it.

// ── lang/en — English function words ────────────────────────────────────────

/**
 * Negation markers — a small closed grammatical class, not an open semantic
 * list. P251(a): the do-support and modal contractions were present but the
 * *be* and *have* auxiliary contractions (isn't/aren't/wasn't/weren't,
 * haven't/hasn't/hadn't) and the rarer modal contractions were missing —
 * a negated claim using one of those forms was silently read as
 * affirmative (NEGATION_WORDS membership gates `negationBeforeVerbFor`
 * before the mis-parse/beyond-reach machinery in P43 ever engages, so a
 * missing member skips that machinery entirely rather than degrading
 * through it). Closing the class is the P43-sanctioned move ("a received
 * class that closes a false binding is turned on, not left opt-in") —
 * every added form is a standard, closed, enumerable English orthographic
 * contraction, same giver, not a hand-picked or open-ended addition.
 */
export const NEGATION_WORDS = Object.freeze(new Set([
  "not", "never", "hardly", "scarcely", "neither", "nor",
  "didn't", "don't", "doesn't", "wouldn't", "couldn't", "shouldn't",
  "won't", "can't", "cannot",
  "isn't", "aren't", "wasn't", "weren't",
  "haven't", "hasn't", "hadn't",
  "mustn't", "needn't", "shan't", "daren't", "mightn't", "oughtn't",
]));
export const NEGATION_WORDS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * The chat turn's re-zero opening — the negators a person opens a CORRECTION
 * with. The general adverbial negators above, PLUS the bare interjective
 * negations ("no", "nope", "nah") that are determiners/interjections rather
 * than the adverbs NEGATION_WORDS carries, so they are a class of their own.
 * Found live (2026-10-09): adapters/chat/user-turns.js is DOCUMENTED to read
 * "no, that's wrong" as a re-zero and "No problem, thanks!" as an
 * acknowledgment, but the class it was wired with (NEGATION_WORDS) lacked
 * "no", so its own motivating example never fired. The adapter still requires
 * a point-back (an anaphor or a first-person claim), so an acknowledgment
 * that merely opens with "no" and points at nothing stays an assertion.
 */
export const CHAT_REZERO_NEGATION = Object.freeze(new Set([
  ...NEGATION_WORDS, "no", "nope", "nah", "naw",
]));
export const CHAT_REZERO_NEGATION_META = Object.freeze({ giver: "lang/en (interjective negation class, re-zero openings)", scope: "adapters/chat/user-turns" });

/**
 * Negation correlatives — the closed set of adverbs that, immediately after
 * a standalone "not", turn it from a negator into an affirmative correlative
 * conjunction: "not only X but also Y", "not just X but also Y" both assert
 * BOTH X and Y, never a negation of either. Found live (2026-09-23): the
 * relation extractor's own negation scan read "not" in "This decentralization
 * not only provides users with more control... but also enhances..." as
 * negating the clause it introduces, when the construction is affirmative.
 * "not just ..., but also ..." is independently named in this repo's own
 * CODING-LESSONS.md:1348 as a pair that must never be split, confirming the
 * class is a real, recurring English construction, not a specimen of one.
 * Scoped to the standalone "not" alternative only (relations.js's
 * negationBeforeVerbFor) — "never only"/"cannot only" etc. have no such
 * correlative reading and are unaffected.
 */
export const NEGATION_CORRELATIVES = Object.freeze(new Set(["only", "just"]));
export const NEGATION_CORRELATIVES_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * First-person pronouns — forms whose capitalisation carries no naming
 * information in English. Same giver as FIRST_PERSON.
 */
export const NEVER_A_NAME = Object.freeze(new Set(["i", "i'm", "i'll", "i'd", "i've"]));
export const NEVER_A_NAME_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * First-person pronoun forms — who is "I" here is a function of who holds the
 * pen, not of the token itself. Same giver as NEVER_A_NAME.
 */
export const FIRST_PERSON = /^(i|me|my|mine|myself|we|us|our|ours)$/i;
export const FIRST_PERSON_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Pronouns that stand as a WHOLE subject — the nominative personal forms,
 * the demonstratives and the interrogatives that can head a clause. A
 * closed class, received: a pronoun is never the head of a wider noun
 * phrase ("the window Lucy" is two things; "the window it" is not one), so
 * a subject anchor that IS one of these is complete, and a walk widening a
 * subject leftward that MEETS one has crossed into another clause. Same
 * giver as the classes above. Measured need (2026-09-02, real Dracula
 * prose): "I think it", "know it", "I hope I", "I wonder what he" — a
 * pronoun subject glued to the matrix clause before it, one shape.
 */
export const SUBJECT_PRONOUNS = Object.freeze(new Set([
  "i", "you", "he", "she", "it", "we", "they",
  "this", "that", "these", "those",
  "who", "what", "which", "whoever", "whatever",
]));
export const SUBJECT_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Predeterminers — the closed class that stands BEFORE a determiner inside
 * one noun phrase ("all the", "both the", "such a", "half the"). A subject
 * walk that reaches a determiner has found the NP's left edge unless one
 * of these precedes it. Same giver.
 */
export const PREDETERMINERS = Object.freeze(new Set(["all", "both", "half", "such", "quite", "rather"]));
export const PREDETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Third-person SINGULAR, GENDERED pronoun forms — a small closed grammatical
 * class, the same standing as FIRST_PERSON above, not an open semantic list.
 * Each form maps to the gender class it grammaticalises in English, never to
 * a referent: WHICH referent a token like "he" points at on a given occasion
 * is exactly the model-tier gap surfaces.js names
 * ("pronoun_and_descriptor_mentions_unresolved") and is not decided here.
 *
 * Number-ambiguous forms ("they", "them", "their", "theirs", "themselves")
 * are deliberately absent: singular-or-plural is not decidable from the
 * pronoun alone, and this register does not guess it (Amendment II's
 * "measured, never assumed" standing, applied to a grammatical class rather
 * than a statistic).
 */
export const THIRD_PERSON_SINGULAR = Object.freeze({
  he: "m", him: "m", his: "m", himself: "m",
  she: "f", her: "f", hers: "f", herself: "f",
});
export const THIRD_PERSON_SINGULAR_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Indefinite determiners — a closed grammatical class, not an open semantic
 * list. An indefinite determiner INTRODUCES its noun rather than pointing
 * back at one already established; whether the noun it introduces names a
 * whole new thing or a detail of something already present is a further
 * question this class does not decide (a consumer like widget.js's routing
 * still has to read what the noun IS, not just that the determiner is
 * indefinite — "some color" and "another one" both carry a member of this
 * set, and only one of them names a new artifact).
 */
export const INDEFINITE_DETERMINERS = Object.freeze(new Set([
  "a", "an", "some", "any", "another",
]));
export const INDEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Definite determiners — a closed grammatical class. A definite determiner
 * presupposes its noun is already identifiable to the listener; whether
 * that noun is actually present in some specific material is, again, for
 * the consumer to check against bytes, not for this class to know.
 */
export const DEFINITE_DETERMINERS = Object.freeze(new Set([
  "the", "this", "that", "these", "those",
]));
export const DEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Anaphoric pronoun forms — tokens that, used pronominally, point back at
 * something already established rather than naming it fresh. "this" and
 * "that" overlap with DEFINITE_DETERMINERS by form (English does not mark
 * determiner-use vs. pronoun-use morphologically); a consumer distinguishing
 * "make it bigger" (pronoun, nothing follows) from "make this widget bigger"
 * (determiner, a noun follows) reads the surrounding tokens, not this set
 * alone.
 */
/**
 * Interrogative pro-forms, each mapped to the KIND OF THING it asks for.
 *
 * A closed grammatical class in the same standing as ANAPHORIC_PRONOUNS
 * below: English has these and no others, and the gloss on each is the
 * lexicographic fact any dictionary states for the word ("who" asks after a
 * person) — NOT an ontology this engine invented and not a type system. The
 * value is the head noun a reader would supply if asked to finish "this
 * question is asking for a ___", nothing more.
 *
 * A Map rather than a Set because the gloss IS the received content: a
 * caller that only needs membership can still ask `.has`, but a caller that
 * drops the gloss and keeps the keys has thrown away the half of this prior
 * that was worth receiving.
 *
 * "how" and "why" are deliberately NOT here — they ask after a manner or a
 * reason, which is an explanation and not a filler, so they carry no head
 * noun to gloss. They are their own class, MANNER_REASON_PRONOUNS below,
 * because the distinction is what lets a caller refuse a slot outright
 * rather than opening one it can never fill.
 */
export const INTERROGATIVE_PRONOUNS = Object.freeze(new Map([
  ["who", "person"],
  ["whom", "person"],
  ["whose", "person"],
  ["what", "thing"],
  ["which", "thing"],
  ["where", "place"],
  ["when", "time"],
]));
export const INTERROGATIVE_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * The two interrogatives that ask after a manner or a reason rather than
 * after a filler. Split from INTERROGATIVE_PRONOUNS above on the grammar's
 * own line, not on a caller's convenience: "who was X" names a slot some
 * entity occupies, "why was X" names no slot at all, and a reader that
 * cannot tell those apart will open an answer slot for a question that has
 * none and then report it unfilled forever.
 */
export const MANNER_REASON_PRONOUNS = Object.freeze(new Set(["how", "why"]));
export const MANNER_REASON_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

export const ANAPHORIC_PRONOUNS = Object.freeze(new Set([
  "it", "it's", "this", "this's", "that", "that's", "these", "those",
]));
export const ANAPHORIC_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Possessive determiners — a closed grammatical class, distinct from
 * DEFINITE_DETERMINERS above (a possessive presupposes a possessor, a
 * definite article presupposes only identifiability) and distinct from
 * ANAPHORIC_PRONOUNS (a possessive determiner always precedes a noun; an
 * anaphoric pronoun optionally stands alone). Both facts a consumer reads
 * from context, never from this set alone.
 */
export const POSSESSIVE_DETERMINERS = Object.freeze(new Set([
  "my", "your", "his", "her", "its", "our", "their",
]));
export const POSSESSIVE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Coordinating conjunctions that join two noun phrases into one (as
 * opposed to joining two independent clauses, which every member of this
 * set can also do — a consumer distinguishing the two reads what stands on
 * each side, not this set alone). Scoped to "and"/"or" deliberately: they
 * are the unambiguous NP-coordinators; "but"/"nor"/"yet"/"so" more often
 * join clauses than phrases in ordinary prose and are left OUT rather than
 * risked — a narrower true set, not a wider guessed one.
 */
export const NP_COORDINATORS = Object.freeze(new Set(["and", "or"]));
export const NP_COORDINATORS_META = Object.freeze({ giver: "lang/en", scope: null });
// Clause-level coordinators — the words that open a coordinated CLAUSE
// ("but he had spoken…", "so it was…"), as opposed to the NP coordinators
// above that join two noun phrases. Received, not measured: on the real
// two-page Borodino ledger (2026-09-02) 55 of 83 extracted subjects were
// debris of exactly this shape ("and it", "but he", "battle that"), because
// the extractor's leading-word strip only fired on a caller-measured
// function-word class that small material cannot supply.
export const CLAUSE_COORDINATORS = Object.freeze(new Set(["and", "but", "or", "nor", "so", "yet", "for"]));
export const CLAUSE_COORDINATORS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Auxiliary and modal verb forms — a closed grammatical class (English's
 * finite auxiliary inventory: the copula's own forms, have/do as tense-
 * and-polarity auxiliaries, and the nine modals). Distinguishes an
 * AUXILIARY position from a CONTENT-VERB position without knowing what any
 * particular content verb means — the same slot-vs-class distinction
 * wordclass.js's own header already draws (SLOT is not CLASS): a consumer
 * scanning past this class to find the real predicate is reading structure,
 * never meaning.
 */
export const AUXILIARY_VERBS = Object.freeze(new Set([
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had",
  "do", "does", "did",
  "will", "shall", "should", "would", "could", "can", "may", "might", "must",
]));
export const AUXILIARY_VERBS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Inflectional suffixes — the closed set of English inflection endings. A
 * received grammatical class, not vocabulary: these are the morphemes by
 * which one FORM of a word varies from another while pointing at the same
 * referent ("color"/"colors", "button"/"buttons", "big"/"bigger"). A
 * consumer testing whether two tokens are forms of one referent strips or
 * appends members of this set — it never stems heuristically (there is no
 * stemmer in this engine, deliberately). Orthographic variance between
 * dialects ("colour"/"color") is NOT inflection and is not this class's to
 * unify — that closes only through a received spelling prior with its own
 * giver, when one exists.
 */
export const INFLECTIONAL_SUFFIXES = Object.freeze(new Set([
  "s", "es", "ed", "ing", "er", "est", "'s",
]));
export const INFLECTIONAL_SUFFIXES_META = Object.freeze({ giver: "lang/en", scope: null });

// ── script/latn — Latin-script typographic conventions ──────────────────────

/** Sentence-ending punctuation marks. */
export const SENTENCE_TERMINATORS = Object.freeze(new Set([
  ".", "!", "?", "…",
  // Other scripts' own terminators, declared by the script they belong to
  // (Unicode block names, not a language list): CJK ideographic and
  // halfwidth full stop / question / exclamation, Arabic question mark and
  // full stop (Urdu), Devanagari danda / double danda, Armenian full stop,
  // Ethiopic full stop.
  "。", "！", "？", "｡", "؟", "۔", "।", "॥", "։", "።",
]));
export const SENTENCE_TERMINATORS_META = Object.freeze({ giver: "script/latn + script/hani,jpan,arab,deva,armn,ethi (Unicode terminator characters)", scope: null });

/** Terminators of scripts that write NO space after a sentence (CJK). Latin
 * `.` followed by a non-space is a decimal point or an abbreviation; an
 * ideographic full stop followed by the next sentence is a boundary. */
export const UNSPACED_TERMINATORS = Object.freeze(new Set(["。", "！", "？", "｡"]));

/** Closing quote marks. */
export const CLOSING_QUOTES = Object.freeze(new Set(['"', "'", "”", "’", "」", "』", "”", "）", "»"]));
export const CLOSING_QUOTES_META = Object.freeze({ giver: "script/latn", scope: null });

/**
 * English honorific titles — a genuine closed class of address, not
 * derived statistically. Found necessary reading Dracula end to end:
 * spans.js's own `deriveAbbreviations` only admits a token that is
 * followed by "." on EVERY occurrence in the material, so a title this
 * particular text sometimes spells without a period (a real, ordinary
 * source-specific choice) is silently excluded, and the run-detection
 * walker in surfaces.js then reads the bare title as its own
 * one-token capitalised run — "Dr", "Mr", "Mrs" surfacing as huge,
 * spurious standalone cast entries. A closed class is the fix precisely
 * because titles are a CLOSED SET in English regardless of a given
 * source's punctuation habits, unlike the open, statistically-derived
 * abbreviation set spans.js exists for.
 *
 * Also the fix for a second, sharper bug: title-fold.js's own qualifier
 * test originally accepted ANY word recurring in lowercase elsewhere in
 * the material as a legitimate title — which is necessary but not
 * sufficient, and merged "Castle Dracula" into "Count Dracula" because
 * "castle" genuinely does recur in lowercase (as an ordinary common
 * noun naming the building, not as anyone's title). Membership in this
 * closed class is the sufficient condition a mined statistic cannot be.
 */
export const HONORIFIC_TITLES = Object.freeze(new Set([
  "mr", "mrs", "miss", "ms", "mx",
  "dr", "prof", "professor", "rev", "reverend", "fr",
  "sir", "madam", "madame", "mademoiselle", "monsieur",
  "herr", "frau", "fraulein", "signor", "signora", "signorina",
  "lord", "lady", "dame",
  "count", "countess", "duke", "duchess", "baron", "baroness",
  "viscount", "viscountess", "earl", "marquis", "marquess", "voivode",
  "king", "queen", "prince", "princess",
  "captain", "capt", "colonel", "col", "major", "general", "gen",
  "admiral", "lieutenant", "lt", "sergeant", "sgt",
]));
export const HONORIFIC_TITLES_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Document-structure labels — CHAPTER, PART, BOOK, VOLUME — never a name
 * candidate regardless of adjacent capitalisation. Found live reading
 * Dracula: a chapter heading sitting beside a diary date line ("11
 * August. CHAPTER XI.") is not a PURE all-caps unit (the existing
 * all-caps-unit skip only fires when EVERY token qualifies), so
 * "CHAPTER" survived into mixed candidates like "August CHAPTER",
 * "Harker Journal CHAPTER". A structural label is typographic
 * furniture, the same class stripContainer/blankFurniture already
 * exist to remove at document/table scale — this is the same principle
 * at single-token scale.
 */
export const STRUCTURAL_LABELS = Object.freeze(new Set(["chapter", "part", "book", "volume"]));
export const STRUCTURAL_LABELS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Subordinators and relative pronouns — the closed class that OPENS a
 * subordinate clause. Promoted here 2026-09-01 from a private regex inside
 * pronouns.js, where it had done real work for one consumer while every
 * other reader of English clause structure had no access to it: the same
 * compiled-but-unshared shape III.5 legislates against, one register in.
 *
 * WHY IT MATTERS BEYOND COREFERENCE. A clause is the natural boundary of
 * an ASSERTION — a proposition, the unit a reader actually admits — while
 * a sentence is only typography, the way a bar is typography for music. An
 * extractor whose left wall is the sentence walks across clause
 * boundaries and captures fragments spanning two propositions ("if so my",
 * "for I", "day belief"); the wall it wants is this class.
 *
 * "to" belongs: it is the non-finite counterpart of the finite
 * complementizers ("declined to make her available" opens a clause exactly
 * as "declined that she be made available" would). Same phenomenon,
 * different still-closed realization — pronouns.js's own note, kept with
 * the class it describes.
 */
export const CLAUSE_OPENERS = Object.freeze(new Set([
  "that", "which", "who", "whom", "whose",
  "because", "although", "though", "while", "when", "whether",
  "unless", "since", "before", "after", "until", "if", "to",
  // "how" — the fronted interrogative/adverbial ("How she longed to get
  // out" — the clause opens with How; the subject is she). Added 2026-09-13
  // after the golden measured the subject swallowing the opener ("How she"
  // as end1). Same class as when/while/whether already in this set.
  "how",
]));
export const CLAUSE_OPENERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * The English copula's own paradigm, form -> lemma. A closed class of the
 * language, given the same way every class in this file is given.
 *
 * WHY THIS IS HERE AND NOT IN THE MORPHOLOGY PRIOR, measured rather than
 * assumed (eoreader7 S58): UniMorph English -- the giver `MorphologyPrior@1`
 * names -- carries **zero rows** for the lemma `be` across all 652,477 of
 * them, while every other top-frequency irregular (have, do, go, say, get,
 * make, know, take, see, come, think, give) carries five verb rows apiece.
 * The three rows in which `am`, `are` and `were` appear at all are tagged
 * `N;SG` -- the noun senses. So this is not a bug in the prior's builder,
 * which faithfully kept what it was given; it is a single, isolated hole in
 * the giver, and it happens to be the most common verb in English. A hole in
 * a received prior is closed by a second named giver, never by inference.
 *
 * SCOPE, stated because it bounds every consumer: this maps FORMS to the
 * lemma `be` and says nothing about tense, aspect or number. Folding `is`
 * with `was` says the two are the same ACT. It does not say they are the
 * same claim -- "X is in command" and "X was in command" are about different
 * times -- which is why every consumer takes this by explicit injection and
 * none takes it by default.
 */
export const COPULA_PARADIGM = Object.freeze({
  be: "be", am: "be", is: "be", are: "be", was: "be", were: "be",
  been: "be", being: "be", "'s": "be", "'re": "be", "'m": "be",
});
export const COPULA_PARADIGM_META = Object.freeze({ giver: "lang/en", scope: "the copula's paradigm alone; tense is not carried" });

/**
 * Subordinating conjunctions — the closed class that opens a SUBORDINATE
 * clause ("because it rained", "although she knew"), as opposed to
 * CLAUSE_COORDINATORS above, which joins two clauses of equal rank. A
 * genuinely closed grammatical class in English (unlike an open-class verb
 * vocabulary — this is not the RECEIVED_RELATION_VERBS mistake, see that
 * file's own corrected header for why open-class hand lists don't hold up:
 * a subordinator set does not grow the way a verb vocabulary does). Each
 * member checked live against the received POS prior (pos-eng.json) and
 * found SCONJ-dominant: because (167 SCONJ vs 42 ADP), although (43 vs 1
 * ADV), while (91 vs 17 NOUN), since (87 SCONJ vs 34 ADP + 5 ADV), if (719
 * vs 1 stray PROPN), after (89 vs 135 ADP — genuinely mixed, kept because
 * the SCONJ mass is still real and this class only ever widens a search,
 * never gates one shut), before (94 vs 58 ADP + 31 ADV), unless (31, no
 * competing tag), until (37 vs 28 ADP), though (39 SCONJ vs 33 ADV + 1
 * ADP). "That" is deliberately NOT here — pos-eng.json measures it almost
 * evenly split SCONJ/PRON/DET (994/851/176), too ambiguous for a closed-
 * class membership test alone; a caller needing "that" as a clause-opener
 * reads it from INTERROGATIVE_PRONOUNS-adjacent context instead, not from
 * this set. The WH-relative openers (who/which/whose/where/when) are NOT
 * here either — they are already received as INTERROGATIVE_PRONOUNS above;
 * a consumer wanting "any clause-opening function word" unions both sets
 * rather than this file duplicating them.
 */
export const SUBORDINATING_CONJUNCTIONS = Object.freeze(new Set([
  "because", "although", "while", "since", "if",
  "after", "before", "unless", "until", "though",
]));
export const SUBORDINATING_CONJUNCTIONS_META = Object.freeze({ giver: "lang/en", scope: "opens a subordinate clause; says nothing about where it ends" });
