/* Mozi speaks:
 * “Therefore 
there  must  be  three  tests.  What  are  the  three  tests  ? Motse 
said  : Its  basis,  its  verifiability,  and  its  applicability.  How 
is  it  to  be  based  ? It  should  be  based  on  the  deeds  of  the 
ancient  sage-kings.  How  is  it  to  be  verified  ? It  is  to  be 
verified  by  the  senses  of  hearing  and  sight  of  the  common 
people.  How  is  it  to  be  applied  ? It  is  to  be  applied  by 
adopting  it  in  government  and  observing  its  benefits  to  the 
country  and  the  people.  This  is  what  is  meant  by  the  three 
tests  of  every  doctrine.”
 *
 * This file, grounded in Mozi's teachings, implements a strict framework for determining truth and validity.  While the "eyes and ears" principle provides a clear starting point, I believe it's important to critically evaluate claims beyond sensory perception, particularly in situations where subjective interpretation and context play a role.
 *
 * — the engineering record below, kept whole —
 */
// grounding.js — is every checkable claim in this answer actually in the bytes?
// Handle: Mozi — after Mozi's test of the senses: a claim stands if it is in what the eyes and ears can witness, or it doesn't stand at all. Amendment XVII.
//
// THE GROUND IS READ, NOT CARRIED. This organ does not own its teaching as a
// comment — it reads it from the committed canon (eoreader7/canon/, the
// three tests: basis, verifiability, applicability), the span AND the window
// around it. `GROUND` is the canon's own bytes and `GROUND_REF` is the byte
// address they live at. To understand what this organ stands on, read what
// is around that span. The ground is load-bearing: the physics field
// (antistrauss-physics.txt) binds to the canon's sha256, so change the canon
// and the ground changes; a missing canon ungrounds the field and the gate
// refuses closed.
//
// Ported from eochatX's app/client/eo-citation-check.ts (itself a port of
// eoWebLLM's, itself a port of eochat's server/citation-check.js). The
// organising idea is unchanged: a claim attached to material must be backed by
// bytes that material actually contains, and that is checked mechanically —
// string containment — for the two things a model most often invents, numbers
// and proper names. It never judges whether an uncited claim is true.
// canon-ground.mjs reads the canon off disk (node:fs/path/crypto/url), so it
// is imported only under Node. In a browser this module must stay loadable
// (the-fold/app.js imports it), and there the ground is simply absent.
// Browser-safe: the canon-ground module imports node:* (fs/path/crypto/url), so
// it can never be a STATIC graph edge in a page. The import is deferred into a
// lazy loader the browser never reaches; under Node it resolves the same canon.
const __isNode = typeof process !== "undefined" && !!process.versions?.node;
let __canonGround = null;
async function __loadCanonGround() {
  if (__canonGround === null) {
    const m = await import("../the-fold/canon-ground.mjs");
    __canonGround = m.loadCanonGround();
  }
  return __canonGround;
}
const __groundingGround = __isNode ? (await __loadCanonGround()).mechanics.find((m) => m.id === "grounding") : null;
export const GROUND = __groundingGround ? __groundingGround.ground : null;
export const GROUND_REF = __groundingGround ? __groundingGround.ref : null;
//
// This complements what was already here. `checkCitations` in source.js checks
// ADDRESSES: did the answer cite something it was handed. `attribute` in
// cite.js attaches an address where the model wrote none. Neither looks inside
// the sentence. This does: it pulls the figures and names out of the answer and
// asks whether the material says them at all. Together they answer three
// different questions, and a record built from all three can say what a turn
// established, where, and what it made up.
//
// What was left behind, and why: eochatX's file carries an inline void-marker
// renderer, a "did you mean" corrector, citation snippeting, a polarity check,
// evasion detection, multi-ground cross-checking and a re-surf resolver. All of
// them serve UI surfaces or pipeline stages this app does not have. Porting
// them would be assuming complexity rather than earning it.
//
// Pure: no DOM, no IO, no model.

import { foldDiacritics } from "./source.js";
import { ATTRS } from "./web.js";
import { AUXILIARY_VERBS } from "../adapters/text/priors.js";

export const CLAIM_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "it",
  "its",
  "he",
  "she",
  "they",
  "them",
  "his",
  "her",
  "hers",
  "their",
  "theirs",
  "we",
  "us",
  "our",
  "ours",
  "you",
  "your",
  "yours",
  "i",
  "me",
  "my",
  "mine",
  "who",
  "whom",
  "whose",
  "which",
  "what",
  "where",
  "why",
  "how",
  "and",
  "but",
  "or",
  "nor",
  "so",
  "yet",
  "for",
  "as",
  "if",
  "then",
  "than",
  "when",
  "while",
  "after",
  "before",
  "since",
  "because",
  "although",
  "though",
  "unless",
  "until",
  "whether",
  "in",
  "on",
  "at",
  "by",
  "to",
  "from",
  "with",
  "within",
  "without",
  "of",
  "about",
  "into",
  "onto",
  "over",
  "under",
  "between",
  "among",
  "through",
  "during",
  "against",
  "toward",
  "towards",
  "upon",
  "across",
  "per",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "let",
  "let's",
  "no",
  "not",
  "yes",
  "both",
  "each",
  "every",
  "either",
  "neither",
  "some",
  "any",
  "all",
  "none",
  "few",
  "many",
  "much",
  "more",
  "most",
  "less",
  "least",
  "several",
  "one",
  "two",
  "three",
  "other",
  "another",
  "same",
  "such",
  "own",
  "very",
  "only",
  "just",
  "also",
  "too",
  "still",
  "already",
  "always",
  "never",
  "often",
  "again",
  "first",
  "second",
  "third",
  "next",
  "last",
  "later",
  "earlier",
  "now",
  "today",
  "however",
  "moreover",
  "therefore",
  "thus",
  "hence",
  "meanwhile",
  "instead",
  "overall",
  "finally",
  "additionally",
  "furthermore",
  "nevertheless",
  "besides",
  "accordingly",
  "consequently",
  "similarly",
  "conversely",
  "notably",
  "indeed",
  // Discourse adverbs a small model loves to open sentences with. They are
  // never proper names, so a capitalized "Unfortunately" is grammar, not a
  // claim — flagging it makes the reader pay for the model's mannerisms.
  "unfortunately",
  "fortunately",
  "thankfully",
  "regrettably",
  "admittedly",
  "sadly",
  "luckily",
  "ironically",
  "surprisingly",
  "honestly",
  "interestingly",
  "perhaps",
  "maybe",
  "possibly",
  "likely",
  "clearly",
  "importantly",
  "generally",
  "specifically",
  "particularly",
  "essentially",
  "ultimately",
  "together",
  "according",
  "based",
  "note",
  "given",
  "regarding",
  "concerning",
  "despite",
  "well",
  "actually",
  "otherwise",
  "source",
  "sources",
  "passage",
  "passages",
  "text",
  "texts",
  "document",
  "documents",
  "answer",
  "answers",
  "question",
  "questions",
  "reader",
  "material",
  "context",
  "citation",
  "citations",
  "quote",
  "quotes",
  "summary",
  "response",
]);

// AMENDED 2026-09-22: the trailing \b required a transition to a NON-word
// character right after the digits, but English attaches two closed,
// grammatical suffix classes directly onto a digit run with no separator —
// the ordinal suffixes (1st, 2nd, 3rd, 4th...) and the bare plural/decade
// "s" (the 1990s, the 20s, the high 60s) — so a digit run immediately
// followed by either read as no boundary at all and the whole number went
// unmatched. Confirmed live: NUMBER_RE.test("3rd") and .test("1990s") were
// both false, so a checkable atom ("the 3rd woman... in the 1990s") in a
// fabricated S1 answer produced zero atoms and never escalated to System 2
// (extractCheckableAtoms -> needsSystem2, app.js). This is the same class
// of gap WH_DEFINITE_RE closed the same day (gary.js): the fix is not a
// word-list patch for "3rd" and "1990s" specifically, it is admitting the
// two real, closed suffix classes into the boundary itself, the same way
// any other ordinal or decade phrase is written. Deliberately narrow —
// only these two classes, not an open "digits followed by any letters"
// rule, which would swallow unrelated concatenations like "20sqft" (and in
// fact still does not: the trailing \b below still fails there, since "q"
// keeps the run inside a single word either with or without the "s").
export const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th|s)?\b/g;
// The suffix above is grammar, not quantity — a checkable atom's token
// (what gets compared against a material's own numberSet) is stripped back
// to the bare figure, the same way `%` and `,` were already stripped below;
// "3rd" is a claim about the figure 3, "1990s" a claim about the figure
// 1990, and a source that writes the bare digits still supports either.
const NUMBER_SUFFIX_RE = /(?:st|nd|rd|th|s)$/;

// SPELLED-OUT NUMBERS (found live, 2026-09-22, via a mapping pass over the
// checkable-claim ladder: "give me the year the treaty was signed" / S1
// answers "The treaty was signed in eighteen forty eight." — a specific,
// checkable year claim that SHOULD escalate to a grounded check). NUMBER_RE
// requires an actual digit character (\d), so a spelled-out number has
// nothing for it to match at all: not a boundary edge case, a total blind
// spot for the whole number-atom path (extractAtoms -> extractCheckableAtoms
// -> needsSystem2 in app.js, and corroborateAtoms/checkGrounding too, since
// all three read atoms off this same function). Voice-to-text and casual
// writing both commonly spell years and small numbers out rather than using
// digits.
//
// This parses the closed grammar of English cardinal number words — never a
// word list of years or a tuned threshold, the same standing this file
// already gives PROPER_RE's own closed capitalization grammar. A standalone
// "one"/"two"/"zero"/"oh" is ordinary English (a pronoun, a determiner, an
// interjection) far more often than a claim, so only a MULTI-word run, or
// one of the less ambiguous words (three and up, any tens/scale word),
// stands alone as a checkable number — WORD_NUM_DISTINCTIVE below, checked
// by extractAtoms before it ever calls parseWordNumber on a lone word.
const WORD_NUM_UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const WORD_NUM_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD_NUM_SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
const WORD_NUM_DISTINCTIVE = new Set([
  "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "thousand", "million", "billion",
]);
const WORD_NUM_VOCAB = new Set([...Object.keys(WORD_NUM_UNITS), ...Object.keys(WORD_NUM_TENS), ...Object.keys(WORD_NUM_SCALES), "oh", "and"]);
const WORD_NUM_ALTERNATION = [...WORD_NUM_VOCAB].sort((a, b) => b.length - a.length).join("|");
export const WORD_NUM_RE = new RegExp(`\\b(?:${WORD_NUM_ALTERNATION})\\b(?:[\\s-]+\\b(?:${WORD_NUM_ALTERNATION})\\b)*`, "gi");

/**
 * English cardinal-number words -> the integer they name, or null when the
 * run does not parse as one — never a guess. Two grammars, chosen by
 * whether a scale word (hundred/thousand/...) is present:
 * - WITH a scale word: the ordinary grouping algorithm ("nineteen hundred"
 *   = 1900, "two thousand and five" = 2005).
 * - WITHOUT one: at most two two-digit "registers" — the spoken-year idiom
 *   ("eighteen forty-eight" = 1848, "nineteen oh five" = 1905, "twenty
 *   twenty-four" = 2024) — because English never chains a teen/lone-tens
 *   word directly into another teen/tens word to mean addition (only
 *   TENS+UNIT does that: "forty eight" = 48, not 4008); a single register
 *   is just that number ("forty eight" = 48, "eighteen" = 18). Three or
 *   more loose registers with no scale word is not a shape this grammar
 *   claims, and returns null rather than guessing.
 */
export function parseWordNumber(words) {
  const toks = words.map((w) => w.toLowerCase()).filter((w) => w !== "and");
  if (!toks.length) return null;
  if (toks.some((w) => w in WORD_NUM_SCALES)) {
    let total = 0;
    let current = 0;
    for (const w of toks) {
      if (w in WORD_NUM_UNITS) current += WORD_NUM_UNITS[w];
      else if (w in WORD_NUM_TENS) current += WORD_NUM_TENS[w];
      else if (w === "hundred") current = (current || 1) * 100;
      else if (w in WORD_NUM_SCALES) {
        total += (current || 1) * WORD_NUM_SCALES[w];
        current = 0;
      } else if (w !== "oh") return null;
    }
    return total + current;
  }
  const registers = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    const next = toks[i + 1];
    if (w in WORD_NUM_TENS && next in WORD_NUM_UNITS) {
      registers.push(WORD_NUM_TENS[w] + WORD_NUM_UNITS[next]);
      i++;
    } else if (w === "oh" && next in WORD_NUM_UNITS) {
      registers.push(WORD_NUM_UNITS[next]);
      i++;
    } else if (w in WORD_NUM_TENS) registers.push(WORD_NUM_TENS[w]);
    else if (w in WORD_NUM_UNITS) registers.push(WORD_NUM_UNITS[w]);
    else return null;
  }
  if (registers.length === 1) return registers[0];
  if (registers.length === 2) return registers[0] * 100 + registers[1];
  return null;
}

const PROPER_RE =
  /\p{Lu}[\p{L}]*(?:['\u2019][\p{L}]+)?(?:[ -](?:of|the|de|von|van|del|la|le)?[ ]?\p{Lu}[\p{L}]*(?:['\u2019][\p{L}]+)?)*/gu;

// extractAtoms's fallback for a sentence PROPER_RE cannot read at all \u2014 see
// the comment on that branch, below, for why. One word at a time (no
// connector grammar): the point of this branch is only ever to recover the
// atoms PROPER_RE's own capitalization requirement made invisible, never to
// out-group what PROPER_RE itself does for ordinarily-cased text.
const CASELESS_WORD_RE = /\p{L}+(?:['\u2019]\p{L}+)?/gu;

export function wordSet(s) {
  const set = new Set();
  // Folded the same way retrieval folds (source.js::foldDiacritics): the
  // check must judge the same alphabet the search searched, or every
  // accented name in a found passage reads as invented.
  for (const w of foldDiacritics(String(s || "").toLowerCase()).split(/[^\p{L}\p{N}]+/u)) if (w) set.add(w);
  return set;
}

const NUM_IN_TEXT_RE = /\d[\d,]*(?:\.\d+)?/g;
export function numberSet(s) {
  const set = new Set();
  const src = String(s || "");
  NUM_IN_TEXT_RE.lastIndex = 0;
  let m;
  while ((m = NUM_IN_TEXT_RE.exec(src)) !== null) set.add(m[0].replace(/,/g, ""));
  return set;
}

/**
 * A word counts as present if the bytes contain it, or a long-enough stem of
 * it. "Investigation" in the answer is supported by "investigations" in the
 * source; four characters is the shortest thing that can be a stem rather than
 * a coincidence.
 */
const MIN_STEM = 4;
export function hasWord(words, word) {
  // Both sides of the containment pass through the same fold — an answer
  // that copies the source's own accents must not fail against an index
  // that folded them.
  const w = foldDiacritics(String(word).toLowerCase());
  if (words.has(w)) return true;
  if (w.length < MIN_STEM) return false;
  for (const hw of words) {
    if (hw.length >= MIN_STEM && (hw.startsWith(w) || w.startsWith(hw))) return true;
  }
  return false;
}

export function hasNumber(numbers, token) {
  return numbers.has(String(token).replace(/,/g, ""));
}

// A source that says "Chief Executive" supports an answer that says "CEO", and
// the reverse. These are fixed, symmetric equivalences applied to the index at
// build time, so the check itself stays exact string containment. Deliberately
// small: office roles only, nothing that collides with ordinary prose.
// A NULL PROTOTYPE, deliberately. A plain object literal inherits from
// Object.prototype, so a lookup by a word the MATERIAL happens to contain —
// "constructor", "toString", "valueOf", "hasOwnProperty" — returns an
// inherited function instead of undefined, and the caller's `for (const e of
// exp)` throws "exp is not iterable". Measured live (S77, 2026-09-06): three
// turns of a long stream died this way within thirty turns of adding
// react-dom.js to the corpus, because React source says "constructor"
// constantly. Any table keyed by words read out of material has this hole.
const ABBREV_EXPANSIONS = Object.assign(Object.create(null), {
  ceo: ["chief", "executive"],
  coo: ["chief", "operating", "officer"],
  cfo: ["chief", "financial", "officer"],
  cto: ["chief", "technology", "officer"],
  cio: ["chief", "information", "officer"],
  cmo: ["chief", "marketing", "officer"],
  vp: ["vice", "president"],
});

export function abbreviationExpansion(word) {
  const key = String(word || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Own properties only, and only a real list — belt and braces beside the
  // null prototype above, so a future edit that restores a plain literal
  // cannot reopen the hole.
  const exp = Object.hasOwn(ABBREV_EXPANSIONS, key) ? ABBREV_EXPANSIONS[key] : null;
  return Array.isArray(exp) ? exp : null;
}

/** One index over everything the turn was given, both directions expanded. */
export function buildUnionIndex(passages) {
  const words = new Set();
  const numbers = new Set();
  for (const p of passages) {
    for (const w of wordSet(p.text)) words.add(w);
    for (const n of numberSet(p.text)) numbers.add(n);
    // A row group's column names are part of what the material says.
    if (p.header) for (const w of wordSet(p.header)) words.add(w);
  }
  for (const w of [...words]) {
    const exp = abbreviationExpansion(w);
    if (exp) for (const e of exp) words.add(e);
  }
  for (const [key, phrase] of Object.entries(ABBREV_EXPANSIONS)) {
    if (phrase.every((p) => hasWord(words, p))) words.add(key);
  }
  return { words, numbers };
}

export function tokenSupported(index, isNumber, token) {
  if (isNumber) return hasNumber(index.numbers, token);
  if (hasWord(index.words, token)) return true;
  const exp = abbreviationExpansion(token);
  if (exp) return exp.every((e) => hasWord(index.words, e));
  return false;
}

/**
 * A passage exploded into its own sentences, each indexed the way
 * buildUnionIndex indexes a whole passage — the unit the number-company
 * check below requires LOCAL support against. `buildUnionIndex(passages)`
 * flattens every passage into one bag with no notion of what stood next to
 * what; "30" and "60" mentioned in two unrelated sentences of the same page
 * (or two unrelated passages) could together "support" a claim that needs
 * them said in the same breath, and that is exactly bare occurrence
 * counting over strings — the failure this function exists to end (user
 * direction, 2026-08-19: grounding must read the material's own
 * hypergraphical context, not raw word counts — "you can tell a word by
 * the company it keeps"). The header row's words ride every sentence: a
 * row group's own column names apply throughout it, the same fact
 * buildUnionIndex already carries for the whole-passage bag.
 */
export function buildLocalIndex(passage) {
  const headerWords = passage?.header ? wordSet(passage.header) : null;
  return splitSentences(String(passage?.text ?? "")).map((s) => {
    const index = buildUnionIndex([{ text: s.text }]);
    if (headerWords) for (const w of headerWords) index.words.add(w);
    return { text: s.text, index };
  });
}

/**
 * A number's "company": every content word of its OWN sentence, excluding
 * stopwords and every atom's own tokens in that sentence (numbers and
 * names alike) — a sibling atom is a separate, independently-checked
 * claim, not context that should gate this one.
 *
 * Two things this is NOT, each ruled out by a live test case rather than
 * assumed. (1) Not applied to NAME atoms: grounding.test.mjs's "an
 * invented figure, agency and year are each caught" wraps a REAL name
 * around a FABRICATED predicate — "The Kessington Report gave a figure of
 * 21 percent" — and the two share no words with the source at all (the
 * report was "commissioned", never "gave a figure"); requiring the real
 * name's company to include the fabrication's own words made the real
 * name fail too. A multi-word name phrase already carries its own
 * specificity (PROPER_RE's run-of-capitals) and, in checkGrounding, a
 * referent-resolution rescue — a bare "30" has neither, and is the
 * single-token, zero-context case this instrument had no defense for. (2)
 * Not narrowed to the number's nearest neighbour word: a first version
 * tried that, and a row-group answer ("The case_number column lists
 * 24-0011 for Gary IN PD") failed it — the words immediately beside "24"
 * are the model's own narrative gloss ("column", "lists"), absent from
 * the terse CSV row itself, while the genuinely matching word
 * ("case_number", from the header) sits three words back. Company is an
 * OR-match (`numberSupporters` below): a passage sentence must hold ONE
 * of these words, so a larger company set only widens what CAN pass — it
 * never lets an unrelated passage sentence pass on padding alone, because
 * an unrelated sentence about something else typically shares NONE of a
 * claim's real vocabulary (measured in the trazodone case this fix was
 * built against: an adversarial passage mentioning "30 dogs" shares no
 * word with "trazodone... 30 to 60 minutes" and is correctly refused).
 * "Sentence" is the locality unit — structural, the same boundary this
 * file already uses everywhere else — never a hand-picked token count
 * (P4's open debt, CLAUDE.md: ROWS_PER_CHUNK, NULL_SAMPLES and friends are
 * already named there as constants that should be derived, not tuned).
 *
 * Disclosed residue, and the real next step (POLICIES.md P31 has the full
 * writeup): "sentence" is a structural boundary, not a tuned token count,
 * but it is still a HAND-CHOSEN unit — the same class of debt P4 already
 * names for ROWS_PER_CHUNK/NULL_SAMPLES. The sharper design, named but not
 * built: a word's universe here is bounded by how many hops out you can
 * go (nearest word → next word → ... → whole sentence → adjacent
 * sentence) before an additional hop stops moving the verdict beyond what
 * a retrieval-drawn null of unrelated candidate company would move it by
 * chance — nul/index.js's pattern() ("a difference that makes a
 * difference"), asked a question it has never been asked. Not attempted
 * here: that null needs its own design and its own measurement before it
 * earns a name, and a claimed null test that was not actually validated
 * would be worse than this honest, disclosed heuristic.
 */
function numberCompany(sentenceText, exclude) {
  const company = new Set();
  for (const w of wordSet(sentenceText)) if (!CLAIM_STOPWORDS.has(w) && !exclude.has(w)) company.add(w);
  return company;
}

/**
 * Which of `entries` support a number atom IN CONTEXT: a passage counts
 * only when some SENTENCE of it carries both the number and at least one
 * word from its company (see numberCompany above). With no company
 * available (a bare number with nothing but stopwords and sibling atoms
 * around it), this falls back to the old whole-passage containment — there
 * is no context signal to require, and refusing on that ground would be a
 * new false negative, not a fix. `entries` are the passages, each
 * pre-indexed once per call site (`index`: whole-passage bag, for the
 * fallback; `local`: buildLocalIndex's per-sentence indexes, for the real
 * check) — built once per corroboration/check run and reused across every
 * atom, the same amortization buildUnionIndex's callers already rely on.
 */
function numberSupporters(token, company, entries) {
  if (!company.size) return entries.filter(({ index }) => hasNumber(index.numbers, token));
  return entries.filter(({ local }) =>
    local.some((ls) => hasNumber(ls.index.numbers, token) && [...company].some((w) => hasWord(ls.index.words, w))),
  );
}

// Exported so cite.js's own splitSentences can share this exact guard
// rather than carrying a second, independently-maintained copy that could
// drift from this one (the diacritics-fold lesson, applied to abbreviation
// detection instead of case-folding: CLAUDE.md, "every organ that compares
// text to text must share retrieval's fold, or a found passage fails the
// very check that should confirm it" — generalized here to splitting).
export const ABBREV =
  /(?:\b(?:mr|mrs|ms|dr|st|prof|rev|hon|vol|no|pp?|ch|ed|fig|cf|vs|etc|al|inc|ltd|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)|\b[A-Z])\.$/i;

/** Sentences with their offsets, not fooled by "Dr." or "Jan.". */
export function splitSentences(text) {
  const out = [];
  const src = String(text || "");
  let start = 0;
  const re = /[.!?]+(?=["'\u201d\u2019)\]]*(?:\s|$))|\n{2,}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const end = m.index + m[0].length;
    const piece = src.slice(start, end);
    if (ABBREV.test(piece.trimEnd())) continue;
    const trimmed = piece.trim();
    if (trimmed) out.push({ text: trimmed, start: start + piece.indexOf(trimmed), end });
    start = end;
  }
  const tail = src.slice(start);
  const trimmed = tail.trim();
  if (trimmed) out.push({ text: trimmed, start: start + tail.indexOf(trimmed), end: src.length });
  return out;
}

/** The checkable things in a sentence: figures, and names. */
export function extractAtoms(sentence, absoluteStart = 0) {
  const atoms = [];
  NUMBER_RE.lastIndex = 0;
  let m;
  while ((m = NUMBER_RE.exec(sentence)) !== null) {
    const before = sentence.slice(0, m.index);
    // "1." opening a line is a list marker, not a claim about a quantity.
    const atLineStart = /(^|\n)[\s>*-]*$/.test(before);
    const followedByMarker = /^[.)]\s/.test(sentence.slice(m.index + m[0].length));
    if (atLineStart && followedByMarker) continue;
    atoms.push({
      kind: "number",
      text: m[0],
      tokens: [m[0].replace(/[,%]/g, "").replace(NUMBER_SUFFIX_RE, "")],
      start: absoluteStart + m.index,
      end: absoluteStart + m.index + m[0].length,
    });
  }
  WORD_NUM_RE.lastIndex = 0;
  while ((m = WORD_NUM_RE.exec(sentence)) !== null) {
    const words = m[0].split(/[\s-]+/).filter(Boolean);
    // A lone ambiguous word ("one", "two", "zero", "oh", "and" — the last
    // never matches alone, see WORD_NUM_RE's construction) is ordinary
    // English far more often than a number claim; see this block's own
    // header above WORD_NUM_UNITS for why only a multi-word run or a
    // WORD_NUM_DISTINCTIVE word stands alone.
    if (words.length === 1 && !WORD_NUM_DISTINCTIVE.has(words[0].toLowerCase())) continue;
    const value = parseWordNumber(words);
    if (value === null) continue;
    atoms.push({
      kind: "number",
      text: m[0],
      tokens: [String(value)],
      start: absoluteStart + m.index,
      end: absoluteStart + m.index + m[0].length,
    });
  }
  PROPER_RE.lastIndex = 0;
  // The lead includes a list marker: "1. Social standing…" capitalizes
  // "Social" by position exactly as a sentence start does (run 5 flagged it
  // as an invented referent through the bare-whitespace lead).
  const sentenceLead = sentence.match(/^\s*(?:[-*>]\s+|\d+[.)]\s+)?\s*/)[0].length;
  while ((m = PROPER_RE.exec(sentence)) !== null) {
    const phrase = m[0].trim();
    const words = phrase.split(/[\s-]+/).filter(Boolean);
    // A single capitalized word at the sentence's own start is capitalized
    // by position — the engine's measured principle (surfaces.js skips
    // sentence-initial tokens for cap evidence), applied here after run 3
    // flagged list-lead emotion words ("Shock", "Anxiety") as invented
    // referents. The trade is disclosed: a single-token invented name that
    // only ever opens sentences escapes; multi-token names and any
    // mid-sentence recurrence are still caught.
    //
    // CARVED OUT, same day, live-verified: the lead-skip has no way to tell
    // a true single-word name from a false one, it only looks at position —
    // and that blindness lands squarely on the canonical shape this whole
    // grounding ladder exists to check. "Harris is the winner." is S1's own
    // register for a terse factual answer: PROPER_RE matches only "Harris"
    // (one word, sentence-initial), the guard above discarded it
    // unconditionally, extractCheckableAtoms came back empty, and
    // needsSystem2 (app.js) — which reads this same atom list to decide
    // whether to escalate to the checked pass — never fired. Confirmed live
    // (grounding.js, node): extractAtoms("Harris is the winner.") was `[]`
    // before this carve-out. checkGrounding's own consumer has the same
    // gap for the identical reason (one shared branch, two callers).
    //
    // The fix is not a lowered bar, a name list, or dropping the guard — it
    // is the SAME structural move gary.js's WH_DEFINITE_RE already made on
    // the question side of this exact ladder: Strawson's definite
    // description. A copula ALONE is not enough evidence — first tried and
    // rejected live: "Fear is a powerful motivator.", "Shock was
    // overwhelming.", "Anxiety is common." all match "capitalized word +
    // copula" exactly as "Harris is the winner." does, and are exactly the
    // generic, position-capitalized-abstract-noun statements the lead-skip
    // exists to protect (this file's own measured false-positive class, one
    // register up). What actually distinguishes "Harris is THE winner"
    // from "Fear is A powerful motivator" is the article: a copula
    // followed by a DEFINITE article ("the") names a single, specific,
    // presupposed-to-exist value (a definite description) — a copula
    // followed by an indefinite article ("a"/"an") or a bare predicate
    // names a class or generic property, never a specific claim. So the
    // carve-out fires only on "is/are/was/were the …" — never on a bare
    // copula. (No contraction form here — PROPER_RE's own trailing
    // ['’][\p{L}]+ group already swallows a name's "'s"/"'re" into the
    // SAME match, e.g. "Harris's" is one token, so nothing would ever be
    // left after it for a second, separate contraction check to see;
    // tried and confirmed live before writing this comment.) Verified
    // live: extractAtoms("Harris is the winner.") now returns "Harris";
    // extractAtoms("Fear is a powerful motivator.") / ("Shock was
    // overwhelming.") / ("Anxiety is common.") are unchanged, still `[]`.
    // grounding.test.mjs's own measured cases ("Shock ran through the
    // ranks", "Anxiety followed", "1. Social standing mattered") are
    // SUBJECT + ordinary verb, not even copula-shaped, so they were never
    // at risk from this carve-out either way — reconfirmed passing after
    // this change.
    const leadFollowsDefiniteCopula = /^\s*(?:is|are|was|were)\s+the\b/i.test(
      sentence.slice(m.index + m[0].length),
    );
    // SECOND, INDEPENDENT carve-out, same day: the copula test above only
    // ever explains a lead word that has a REST OF THE SENTENCE around it
    // to be borrowing its capitalization-by-position from ("Harris IS THE
    // winner"). That reasoning has nothing to explain when nothing follows
    // at all — a System-1 answer that is nothing but a bare name
    // ("Francis.") is a ONE-WORD SENTENCE, not a stray capital opening a
    // longer one, and is the entire checkable content of the answer, not a
    // position artifact. Confirmed live: extractAtoms("Francis.") was `[]`
    // before this carve-out, starving needsSystem2's atom-based escalation
    // of the one shape (a bare wrong or invented name) it exists to catch.
    // Narrow on purpose: any real predicate, list sibling, or trailing
    // prose at all still exempts the word exactly as before — this only
    // fires when there is no letter anywhere after the matched word.
    const restOfSentence = sentence.slice(m.index + m[0].length);
    const sentenceIsJustThisWord = !/\p{L}/u.test(restOfSentence);
    if (
      words.length === 1 &&
      m.index === sentenceLead &&
      !leadFollowsDefiniteCopula &&
      !sentenceIsJustThisWord
    )
      continue;
    const contentWords = words.filter(
      (w) =>
        !CLAIM_STOPWORDS.has(w.toLowerCase().replace(/['\u2019]s$/, "")) &&
        // A capitalized contraction is grammar, never a name \u2014 "Isn't" opening
        // a sentence was flagged as an invented referent (run 2, turn 37).
        !/^[A-Z][a-z]*['\u2019]t$/.test(w),
    );
    if (!contentWords.length) continue;
    atoms.push({
      kind: "name",
      text: phrase,
      tokens: contentWords.map((w) => w.replace(/['\u2019]s$/, "")),
      start: absoluteStart + m.index,
      end: absoluteStart + m.index + m[0].length,
    });
  }
  // AMENDED 2026-09-22: PROPER_RE's whole name-atom detection rests on a
  // Unicode uppercase codepoint (\p{Lu}) to even START a match \u2014 the right
  // signal for ordinarily-cased text, where capitalization is how English
  // marks a proper name. It goes BLIND, not selective, the moment that
  // convention is simply absent from the text: a documented, live quirk of
  // small/quantized local models in exactly this pipeline (this project's
  // own north star is "local model only") is to answer entirely in
  // lowercase \u2014 no capital anywhere, not even a sentence-initial one.
  // Measured live (run directly, not reasoned about in the abstract):
  // extractAtoms("the governor of texas is greg abbott") === [] \u2014 PROPER_RE
  // never starts a single match, so a real, possibly-invented name ships
  // with zero checkable atoms and, downstream, zero System 2 verification
  // (needsSystem2 in app.js reads exactly this atom list to decide whether
  // to check S1's reply at all).
  //
  // The structural fact worth reading here is not "is this particular word
  // capitalized" \u2014 that breaks the instant the model's own casing does \u2014
  // but "does this sentence carry a capitalization convention AT ALL",
  // which is measurable with no word list and no tuned number, the same way
  // PROPER_RE's own signal already is: a sentence with at least one letter
  // and not one single uppercase codepoint anywhere has no convention left
  // to read, so this fallback fires only in that exact, rare condition. A
  // sentence with even one capital letter \u2014 the overwhelming majority of
  // real text, including every ordinary reply this file has always
  // handled \u2014 never reaches this branch (`atoms.some` below short-circuits
  // whenever PROPER_RE already found a name, and the case test guards the
  // rest), so PROPER_RE's existing, calibrated selectivity is completely
  // untouched for anything but the specific failure this closes.
  //
  // What counts as "a word worth checking" in that fallback is not invented
  // here either: CLAIM_STOPWORDS is this exact file's own established
  // content-word filter. Each surviving word becomes its own atom \u2014 not
  // grouped into phrases the way PROPER_RE groups "Greg Abbott" \u2014 because
  // grouping needs the connector grammar PROPER_RE reads via
  // capitalization, which is exactly the signal this branch has none of;
  // an ungrouped atom per real word is the same granularity NUMBER_RE
  // already uses for its own atoms, just applied to names once case can no
  // longer tell them apart from prose.
  //
  // Same asymmetry as the rest of this checking ladder: a false positive
  // here costs one grounded comparison \u2014 and, via wordSet's own case fold
  // (this file's own hasWord/buildUnionIndex), a genuinely sourced
  // lowercase word still matches its source and is never flagged, so this
  // never turns a correct lowercase reply into a false "not in the
  // material". A false negative is a small local model's confidently wrong
  // name shipped with nothing behind it \u2014 the exact failure grounding.js
  // exists to catch.
  if (!atoms.some((a) => a.kind === "name") && /\p{L}/u.test(sentence) && !/\p{Lu}/u.test(sentence)) {
    CASELESS_WORD_RE.lastIndex = 0;
    while ((m = CASELESS_WORD_RE.exec(sentence)) !== null) {
      const word = m[0];
      const bare = word.replace(/['\u2019]\p{L}+$/u, "");
      if (CLAIM_STOPWORDS.has(bare.toLowerCase())) continue;
      atoms.push({
        kind: "name",
        text: word,
        tokens: [bare],
        start: absoluteStart + m.index,
        end: absoluteStart + m.index + word.length,
      });
    }
  }
  atoms.sort((a, b) => a.start - b.start);
  return atoms;
}

const MAX_FINDINGS = 40;

/** An address as source.js writes it — bytes, not a claim about quantities. */
const ADDRESS = /\[?[^\s\]]+#\d+-\d+\]?/g;

/** An HTML/XML/SVG tag, opening or closing, attributes and all — reusing
 * web.js's own ATTRS fragment (the same "walk quoted values" rule that
 * exists because an attribute value can legally contain ">") rather than a
 * second, narrower tag regex invented here. */
const TAG = new RegExp(`<\\/?[a-zA-Z][a-zA-Z0-9:-]*${ATTRS}\\/?>`, "g");

/**
 * The answer with its structure blanked, length preserved: headings,
 * line-initial bold labels, bracketed addresses, fenced code blocks, and
 * markup tags are the model's own scaffolding, not claims (the measured
 * cases live in checkGrounding's comment below). Exported because every
 * organ that reads CLAIMS out of an answer must skip the same furniture —
 * the relation tier (hypergraph.js) shares this, or a Title-Case heading
 * would read as a subject and a byte address as a figure. Length-preserving
 * so every offset an extractor reports lands in the original answer's own
 * coordinate space.
 *
 * A fenced code block is a program, not an assertion about the world:
 * measured live (2026-08-17), a widget's own `<!DOCTYPE html>` and
 * `getElementById` were flagged as unsupported claims and sent to the web
 * tier for "corroboration" — DOCTYPE is not a fact anyone could state or
 * contradict. Blanked whole, fence lines included, so the language tag on
 * the opening fence cannot itself read as a claim either.
 *
 * A markup tag OUTSIDE a fence is the same category, not a smaller one:
 * measured live (2026-08-19), a small model asked for SVG answered with bare
 * `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" .../></svg>` —
 * no fence, so the fenced-block rule above never fired — and the apparatus
 * read "100", "50", "40" as unsupported figures: the artifact grounding
 * itself in its own attribute values, the exact failure the fenced case
 * was fixed for, wearing the one disguise that rule didn't cover. TAG blanks
 * every tag whether or not the model remembered to fence it, so compliance
 * with "wrap code in a fence" is never load-bearing for this rule to hold.
 */
// A `#{1,6}` heading line, or a line that is bold start-to-end, is ORDINARILY
// section furniture — a label over real content sitting elsewhere in the
// answer, never itself a claim (the two tests above this function's own
// header). But a small model answering ONE terse factual question routinely
// writes its WHOLE reply as a single heading — "## The exchange rate today
// is 150 yen to the dollar" — found live, 2026-09-22, on the volatile-fact
// twin of this file's own "exchange rate" example: the digit is a checkable
// claim, not a section title, and it is the ONLY thing in the answer.
// Blanking that whole line unconditionally erases the answer's entire
// content, silently turning "examined, clean" into "nothing to examine" —
// the exact absence-vs-clean conflation checkGrounding's own header already
// refuses one register over ("examined is not the same as clean"). So these
// two rules are conditional on there being real content OUTSIDE the matched
// line(s) — a heading beside prose stays furniture; a heading that IS the
// whole answer is prose that happens to be formatted as a heading, and only
// its marker syntax (`#`/`**`) is blanked, never the words. Both branches
// stay length-preserving.
const HEADING_LINE_RE = /^[ \t]*#{1,6}[^\n]*$/gm;
const BOLD_WHOLE_LINE_RE = /^[ \t]*\*\*[^\n*]+\*\*[ \t]*:?[ \t]*$/gm;

export function blankStructure(answer) {
  const blank = (m) => " ".repeat(m.length);
  const withFurniture = String(answer)
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm, blank)
    .replace(TAG, blank);

  const asHeadings = withFurniture.replace(HEADING_LINE_RE, blank).replace(BOLD_WHOLE_LINE_RE, blank);
  const wholeAnswerIsHeadings = withFurniture.trim() !== "" && asHeadings.trim() === "";

  const structured = wholeAnswerIsHeadings
    ? withFurniture
        // Strip only the `#` marker chars, keeping the rest of the line —
        // the sentence that follows reads as ordinary prose to extractAtoms.
        .replace(/^([ \t]*)(#{1,6})/gm, (_, ws, hashes) => ws + " ".repeat(hashes.length))
        // Strip only the `**` delimiters of a whole-line bold phrase,
        // keeping the inner words and any trailing colon/whitespace.
        .replace(/^([ \t]*)\*\*([^\n*]+)\*\*([ \t]*:?[ \t]*)$/gm, (_, a, mid, c) => `${a}  ${mid}  ${c}`)
    : asHeadings;

  return structured
    // A line-initial bold phrase with a colon is a heading even when prose
    // follows on the same line ("**Anatole's Effect:** she felt…") — and the
    // same heading wearing a list marker ("1. **HTML Structure:** - We
    // create…", "- **Counter Initialization:** let count = 0…") is still a
    // heading: the model labelling the sections of its own walk-through, not
    // a claim about the world. Measured live (2026-08-17): a counter
    // widget's numbered explanation defeated the anchor and rendered a wall
    // of label chips ("Counter Initialization", "Event Listeners") plus
    // "claiming things nothing given backs: 76". The optional prefix admits
    // digits-and-dot or a -/*/+ bullet, with leading whitespace, and the
    // whole match blanks so the marker's own digit never reads as a figure.
    // This rule is unconditional — it only ever strips a LABEL prefix and
    // always leaves the trailing content on the line untouched, so unlike
    // the two whole-line rules above it can never erase an entire answer.
    .replace(
      /^[ \t]*(?:\d+\.[ \t]+|[-*+][ \t]+)?\*\*[^\n*]+:\*\*|^[ \t]*(?:\d+\.[ \t]+|[-*+][ \t]+)?\*\*[^\n*]+\*\*:/gm,
      blank,
    )
    .replace(ADDRESS, blank);
}

/**
 * Every checkable atom in the answer with the passages that STATE it — the
 * corroboration face of the same walk checkGrounding does. Where
 * checkGrounding asks "is anything absent from the union", this asks "how
 * many of the offered passages, across how many distinct sources, state each
 * atom" — because support is not a bit. A figure one passage states and a
 * figure four passages from three sources state are different strengths of
 * ground, and the difference is the whole methodology: the approach toward
 * truth is asymptotic, through agreeing perspectives that are actually
 * independent. `sources` counts distinct source files (the ref before `#`),
 * which is this instrument's honest independence test for local material —
 * two chunks of one file are one perspective, not two.
 *
 * Read-only companion to checkGrounding, never a replacement: an atom with
 * empty `refs` here is the same fact as a finding there.
 */
export function corroborateAtoms(answer, passages) {
  if (!passages?.length) return { examined: false, clean: null, atoms: [], detail: "unexamined — no passages" };
  const per = passages.map((p) => ({
    ref: p.ref ?? null,
    source: String(p.ref ?? "").split("#")[0] || null,
    index: buildUnionIndex([p]),
    local: buildLocalIndex(p),
  }));
  const atoms = [];
  for (const s of splitSentences(blankStructure(answer))) {
    const sentAtoms = extractAtoms(s.text, s.start);
    // Every atom in THIS sentence is excluded from being another atom's
    // "company" — a sibling figure or name is a separate, independently
    // checked claim, not context (numberCompany's own header has the case
    // that proved this matters).
    const exclude = new Set(sentAtoms.flatMap((a) => a.tokens.map((t) => foldDiacritics(String(t).toLowerCase()))));
    // Same company for every number atom in this sentence — it does not
    // depend on where in the sentence a given atom sits, only on what the
    // sentence's OTHER (non-atom) words are.
    const company = numberCompany(s.text, exclude);
    for (const atom of sentAtoms) {
      let supporters;
      if (atom.kind === "number") {
        supporters = numberSupporters(atom.tokens[0], company, per);
      } else {
        supporters = per.filter(({ index }) => atom.tokens.every((t) => tokenSupported(index, false, t)));
      }
      atoms.push({
        kind: atom.kind,
        text: atom.text,
        start: atom.start,
        end: atom.end,
        sentence: s.text,
        refs: supporters.map((x) => x.ref).filter(Boolean),
        sources: [...new Set(supporters.map((x) => x.source).filter(Boolean))],
      });
    }
  }
  return { examined: true, atoms };
}

/**
 * Every figure and name in the answer, checked against everything the turn was
 * handed.
 *
 * `examined` is not the same as `clean`. When nothing was examined
 * (`examined: false` — no passages were handed over), `clean` is null
 * (neither true nor false) with `detail: "unexamined — no passages"`, so a
 * caller reading `if (clean)` can never mistake "nothing to check against"
 * for "checked, found nothing wrong". A caller wanting "verified clean"
 * reads `clean === true && examined`. A capped list says it was capped for
 * the same reason: a truncated report that looks complete is a lie of omission.
 */
export function checkGrounding(answer, passages, { question = "", resolveName = null } = {}) {
  if (!passages?.length) {
    return { sentences: 0, atomsChecked: 0, findings: [], clean: null, examined: false, detail: "unexamined — no passages", truncated: null, groundRef: GROUND_REF };
  }
  const index = buildUnionIndex(passages);
  // Per-passage entries for the number-company check only (numberSupporters,
  // below) — `index` above is untouched and still what every NAME atom's
  // check reads (see numberCompany's header for why names are excluded from
  // this fix).
  const entries = passages.map((p) => ({ index: buildUnionIndex([p]), local: buildLocalIndex(p) }));
  const questionWords = wordSet(question);
  // An address is not a claim. `kessington.txt#80-174` carries two numbers
  // that are byte offsets this app asked for, and checking them against the
  // material flagged the citation itself as an unsupported figure — the check
  // accusing the answer of inventing the very thing it was told to write.
  //
  // A heading is not a claim either. Measured on the live dialogue run: a
  // model that structures its answer with markdown headings writes Title
  // Case phrases ("Clash of Ideals", "A Catalyst") that the proper-name
  // extractor reads as names, and the record drowns in structure flagged as
  // invention while the real drift (an invented novel title) sits in the
  // noise. Heading lines — # markers, and lines that are entirely a bold
  // phrase — are the model's own scaffolding and are blanked (length
  // preserved) before atoms are extracted (blankStructure, above — shared
  // with the relation tier, hypergraph.js). A name INSIDE a body sentence
  // is still checked; only the furniture is exempt.
  const sentences = splitSentences(blankStructure(answer));
  const findings = [];
  let atomsChecked = 0;

  for (const s of sentences) {
    const sentAtoms = extractAtoms(s.text, s.start);
    // A sibling atom is never company — see numberCompany's own header.
    const exclude = new Set(sentAtoms.flatMap((a) => a.tokens.map((t) => foldDiacritics(String(t).toLowerCase()))));
    const company = numberCompany(s.text, exclude);
    for (const atom of sentAtoms) {
      atomsChecked++;
      let absent;
      if (atom.kind === "number") {
        absent = numberSupporters(atom.tokens[0], company, entries).length ? [] : [atom.tokens[0]];
      } else {
        absent = atom.tokens.filter((t) => !tokenSupported(index, false, t));
      }
      if (!absent.length) continue;
      // A name is a reference to a REFERENT, not a byte sequence, and the
      // byte test above cannot see that "Bezukhov" and "Pierre Bezúkhov"
      // point at the same being. When the caller supplies a resolver built
      // from the material's own cast (cast.js, on the engine's organs), a
      // name the cast covers is supported — rescue only, never veto: a
      // resolver can save a finding from being raised, it cannot raise one.
      // The content tokens go, not the raw phrase, so a possessive or a
      // connective in the phrase cannot spoil the resolution.
      if (atom.kind === "name" && resolveName?.(atom.tokens.join(" "))) continue;
      findings.push({
        kind: "unsupported_claim",
        atomKind: atom.kind,
        text: atom.text,
        absent,
        start: atom.start,
        end: atom.end,
        // The sentence the claim stands in, carried so a proof-seeker can
        // search on the claim's own context (proof.js) without re-locating
        // it — the same words, no paraphrase. The question travels with it —
        // the same anchor app.js's single-source corroboration door already
        // carries for its own claims ("the question is the conversation's
        // own anchor," measured live: a casualties sentence whose "it"
        // pointed a sentence back left the battle's name out of its own
        // search). Folded in here, at the source, every consumer of a
        // finding's `sentence` gets it, not just that one door.
        sentence: [s.text, question].filter(Boolean).join(" ").trim(),
        // A name the question itself supplied is the model repeating the
        // asker, not inventing a source — worth knowing when reading a finding.
        echoesQuestion: atom.tokens.every((t) => questionWords.has(t.toLowerCase())),
      });
    }
  }

  findings.sort((a, b) => a.start - b.start);
  const kept = findings.slice(0, MAX_FINDINGS);
  return {
    sentences: sentences.length,
    atomsChecked,
    findings: kept,
    clean: findings.length === 0,
    examined: true,
    // THE GROUND — the canon byte address this organ stands on (Mozi's
    // three tests), carried on the record so a reader tracing a grounding
    // verdict meets the teaching that grounds it.
    groundRef: GROUND_REF,
    truncated:
      findings.length > kept.length
        ? { reported: kept.length, total: findings.length, dropped: findings.length - kept.length }
        : null,
  };
}

/**
 * Every checkable atom in an answer, unconditionally unsupported — for a
 * caller that has no material at all and still wants candidates for the web
 * tier (proofTargets). This is NOT checkGrounding with the guard removed:
 * checkGrounding's `examined: false` at zero passages is a deliberate fact
 * ("clean and examined are different facts" — grounding.test.mjs) and stays
 * exactly as it is for every existing caller. Measured live (2026-08-17): a
 * plain question with no material attached ("what percentage of Earth's
 * atmosphere is nitrogen...") produced zero proof-seeking chips — not
 * because proof-seeking was off, but because `findings` never had anything
 * in it to offer, since checkGrounding correctly declines to examine
 * against an index that does not exist. With no material, every atom is
 * trivially unsupported by definition, so this mirrors checkGrounding's own
 * atom scan without the index comparison. Same finding shape, so an
 * existing consumer of `findings` (proofTargets, unsupportedClaims) needs
 * no changes to accept it.
 */
/**
 * A yes/no (polarity) question is identified by its SHAPE, never a fixed
 * verb list: English marks it with subject-auxiliary inversion, so a
 * polarity question's own first word is a member of the closed
 * AUXILIARY_VERBS class (adapters/text/priors.js, giver lang/en) — "does
 * decaf have caffeine", "is Paris the capital of France", "can it fly". A
 * WH-question is aux-SECOND ("who IS the president"), never aux-first, so
 * this test does not need to also exclude WH-words. Same discipline
 * WH_DEFINITE_RE applies to the sibling gap in the-fold's gary.js (same
 * day): read the grammar, never enumerate the specimens.
 */
function firstWord(text) {
  const m = String(text ?? "").trim().match(/^[\p{L}\p{N}']+/u);
  return m ? m[0].toLowerCase() : "";
}

function isPolarityQuestion(question) {
  return AUXILIARY_VERBS.has(firstWord(question));
}

/**
 * A polarity question's own content words (CLAIM_STOPWORDS stripped) — the
 * claim being asked about, independent of which way it gets answered.
 * "does decaf have caffeine" -> {decaf, caffeine}; "does"/"have" are both
 * already members of CLAIM_STOPWORDS.
 */
function polarityClaimWords(question) {
  const words = new Set();
  if (!isPolarityQuestion(question)) return words;
  for (const w of wordSet(question)) if (!CLAIM_STOPWORDS.has(w)) words.add(w);
  return words;
}

// The floor a sentence's own "company" with the polarity claim must clear
// before it counts as addressing that claim — reused whole, not re-derived,
// from the same structural "2, or however many are available" minimum this
// codebase already repeats for exactly this judgment (ORACLE_MIN_CONTENT_
// WORDS in gary.js, WITNESS_FLOOR in asserted.js, EVIDENCE_FLOOR in
// hl-acquire.js): a single shared word is a coincidence, two is a pattern.
const POLARITY_COMPANY_FLOOR = 2;

/**
 * The checkable atom a bare yes/no answer never gave NUMBER_RE or
 * PROPER_RE anything to catch. "No, decaf coffee does not have any
 * caffeine in it" and "Decaf coffee is caffeine-free, so it does not have
 * caffeine" both structurally contain no digit and no capitalized
 * multi-word run — extractAtoms returns nothing for either sentence,
 * regardless of which model wrote it or whether it is right or wrong.
 * This is a second, independent atom kind beside number/name, gated on
 * the QUESTION's own shape (a polarity question) and the SENTENCE's own
 * company with that question's claim (P31's company rule, applied here to
 * a whole claim rather than a bare number) — never on a marker word like
 * "yes"/"no", because an affirmative answer routinely carries neither
 * ("Decaf coffee contains a small amount of caffeine" affirms the claim
 * with no marker at all). `tokens` carries the sentence's own content
 * words (not only the ones shared with the question), so a proof-seeking
 * search gets real search terms and `echoesQuestion` (computed the normal
 * way below) is not trivially always true.
 */
function polarityAtomsIn(sentence, absoluteStart, polarityWords) {
  if (!polarityWords.size) return [];
  const sentenceContentWords = [];
  for (const w of wordSet(sentence)) if (!CLAIM_STOPWORDS.has(w)) sentenceContentWords.push(w);
  const shared = sentenceContentWords.filter((w) => polarityWords.has(w));
  const needed = Math.min(POLARITY_COMPANY_FLOOR, polarityWords.size);
  if (shared.length < needed) return [];
  return [
    {
      kind: "polarity",
      text: sentence.trim(),
      tokens: sentenceContentWords,
      start: absoluteStart,
      end: absoluteStart + sentence.length,
    },
  ];
}

export function extractCheckableAtoms(answer, { question = "" } = {}) {
  const questionWords = wordSet(question);
  const polarityWords = polarityClaimWords(question);
  const sentences = splitSentences(blankStructure(answer));
  const findings = [];
  for (const s of sentences) {
    const sentAtoms = extractAtoms(s.text, s.start);
    const atoms = sentAtoms.length ? sentAtoms : polarityAtomsIn(s.text, s.start, polarityWords);
    for (const atom of atoms) {
      findings.push({
        kind: "unsupported_claim",
        atomKind: atom.kind,
        text: atom.text,
        absent: atom.tokens,
        start: atom.start,
        end: atom.end,
        // Same anchor as checkGrounding's own findings, and it matters MORE
        // here: this function exists for sentences with no material behind
        // them at all, and a topic-less follow-up ("prove it") drafts a
        // sentence that names nothing the original question named either.
        // Measured live 2026-08-18: asked to prove a fabricated "70 degrees
        // in NYC", the model answered "I did just check a weather app" —
        // with no question folded in, proofQuery had only that sentence's
        // own words to search on, and searched for a weather app rather
        // than NYC weather. Folding the question in gives the search
        // something to anchor to even when the drafted sentence carries
        // nothing of its own.
        sentence: [s.text, question].filter(Boolean).join(" ").trim(),
        echoesQuestion: atom.tokens.every((t) => questionWords.has(t.toLowerCase())),
      });
    }
  }
  findings.sort((a, b) => a.start - b.start);
  return findings.slice(0, MAX_FINDINGS);
}

/** The findings as short lines, for a record's `unsupported`.
 *
 * A name the question itself supplied is the model repeating the asker, not
 * inventing a source — the finding stays in the report (and in the drawn
 * stripe, where mildness is cheap), but it does not enter the RECORD's
 * unsupported list, where it reads as invention and drowns the real drift.
 * Measured live: a question naming Karatáev produced "Karataev's not in the
 * material" on the record of an answer that merely stayed on topic. */
export function unsupportedClaims(report) {
  return report.findings
    .filter((f) => !f.echoesQuestion)
    .map((f) =>
      f.atomKind === "number" ? `figure ${f.text} not in the material` : `${f.text} not in the material`,
    );
}
