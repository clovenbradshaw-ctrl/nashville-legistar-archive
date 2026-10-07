// adapters/text/numeral-words.js — English cardinal number WORDS, folded
// against the digit tokens a book, or a claim, writes them as.
//
// Found live, 2026-09-28: copula-claims.js's own header disclosed this gap
// by name — "it does not fold synonyms or numerals ('fifty-nine' is not
// '59')" — and fast-reasoning.mjs's own pre-registered KEY carries the
// specimen the gap was named for: "Renfield is fifty-nine," read against a
// claim phrased "Renfield is 59." (KEY item DR/true, R. M. Renfield, ætat
// 59). The mechanical rung's own tokenizer (organs/source.js::tokenize)
// keeps a hyphenated numeral as ONE token ("fifty-nine") and a digit run as
// another ("59"); neither reads the other's value without this organ, so
// that claim — true, and readable in the book's own bytes — read `open`.
//
// wordsToNumber(text) parses a WHOLE phrase of cardinal number words
// ("fifty-nine", "nineteen", "two hundred and thirty") into the value it
// names, or null when the text is not one — a single stray word (a
// pronoun, a name, "the") refuses the WHOLE phrase, never a partial read:
// a partial read would be a guess at what the rest of the phrase meant.
// sameNumeral(a, b) widens token equality the way createLemmatizer's
// sameAct widens verb tense: a raw digit token folds against its own
// cardinal-word phrase, and two digit tokens fold by NUMERIC value, so
// "059" and "59" are the same numeral even though they are not the same
// string.
//
// THE CLOSED CLASSES. English cardinal number words are a closed, received
// lexical set — the same standing priors.js's own entries hold, declared
// here with the same giver and the same `_META` companion, never mined
// from any material. Ones/teens/tens are the paradigm's own base forms;
// SCALE_WORDS is the multiplier tier — "hundred" multiplies the group
// already in progress ("two hundred thirty" stays one group), "thousand"
// and above CLOSE the group in progress and start a new, higher one ("two
// hundred thousand" closes at thousand) — the ordinary grouping every
// English cardinal reading uses, never a rule invented here.
// CARDINAL_CONNECTORS is the one word ("and") that can sit BETWEEN two
// cardinal words without itself being one ("two hundred and thirty").
//
// WHAT IT NEVER DOES. It does not read ordinals ("fifty-ninth" is not this
// organ's — no ordinal ever names an age or a quantity, which is what a
// copula complement states); it does not read a mixed phrase that also
// carries a non-number word ("about fifty-nine" refuses whole, rather than
// guessing which word to drop); it does not compute anything — only fold
// two ALREADY-STATED numerals as the same value, the way sameAct folds two
// already-stated verb forms as the same act.

export const ONES_WORDS = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
});
export const ONES_WORDS_META = Object.freeze({ giver: "lang/en", scope: "cardinal ones, zero through nine" });

export const TEEN_WORDS = Object.freeze({
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
});
export const TEEN_WORDS_META = Object.freeze({ giver: "lang/en", scope: "cardinal teens, ten through nineteen" });

export const TENS_WORDS = Object.freeze({
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});
export const TENS_WORDS_META = Object.freeze({ giver: "lang/en", scope: "cardinal tens, twenty through ninety" });

// "hundred" is deliberately not a row below: it is read specially, because
// it does not CLOSE a group the way thousand and above do (see the header).
export const SCALE_WORDS = Object.freeze({
  hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000, trillion: 1_000_000_000_000,
});
export const SCALE_WORDS_META = Object.freeze({ giver: "lang/en", scope: "hundred multiplies the open group; thousand and above close it and start a new one" });

export const CARDINAL_CONNECTORS = Object.freeze(new Set(["and"]));
export const CARDINAL_CONNECTORS_META = Object.freeze({ giver: "lang/en", scope: "the one word a cardinal phrase may carry between two number words without itself being one" });

// Hyphens split a compound cardinal ("fifty-nine") into its two words
// exactly the way whitespace does — the same allowance organs/source.js's
// own tokenize gives a hyphen, read the other direction.
const SPLIT_RE = /[\s-]+/;

/**
 * wordsToNumber(text) -> number | null
 *
 * Parses `text` as ONE cardinal number-word phrase. Every word in it must
 * be a member of ONES_WORDS, TEEN_WORDS, TENS_WORDS, SCALE_WORDS or
 * CARDINAL_CONNECTORS — a single word outside those five classes refuses
 * the WHOLE phrase (P9: an ambiguous read is refused, never guessed at). A
 * hundred/thousand/etc. with nothing before it reads as one of them
 * ("a hundred" said as bare "hundred" is the ordinary English reading).
 */
export function wordsToNumber(text) {
  const raw = String(text ?? "").trim().toLowerCase();
  if (!raw) return null;
  const words = raw.split(SPLIT_RE).filter(Boolean);
  if (!words.length) return null;
  let total = 0, group = 0, matched = false;
  for (const w of words) {
    if (CARDINAL_CONNECTORS.has(w)) continue;
    if (Object.hasOwn(ONES_WORDS, w)) { group += ONES_WORDS[w]; matched = true; continue; }
    if (Object.hasOwn(TEEN_WORDS, w)) { group += TEEN_WORDS[w]; matched = true; continue; }
    if (Object.hasOwn(TENS_WORDS, w)) { group += TENS_WORDS[w]; matched = true; continue; }
    if (w === "hundred") { group = (group || 1) * SCALE_WORDS.hundred; matched = true; continue; }
    if (Object.hasOwn(SCALE_WORDS, w)) { total += (group || 1) * SCALE_WORDS[w]; group = 0; matched = true; continue; }
    return null; // a stray word: the phrase is not purely cardinal, and a partial read would be a guess
  }
  return matched ? total + group : null;
}

const DIGIT_RE = /^-?\d+(?:\.\d+)?$/;

/**
 * sameNumeral(a, b) -> boolean
 *
 * True when `a` and `b` name the same numeral: a raw digit token against
 * its own cardinal-word phrase ("59" / "fifty-nine"), or two digit tokens
 * folded by NUMERIC value rather than spelling ("059" / "59", and two
 * string-identical tokens). False — never a guess — when either side is
 * not a number in either form.
 */
export function sameNumeral(a, b) {
  const x = String(a ?? "").trim().toLowerCase();
  const y = String(b ?? "").trim().toLowerCase();
  if (!x || !y) return false;
  const nx = DIGIT_RE.test(x) ? Number(x) : wordsToNumber(x);
  const ny = DIGIT_RE.test(y) ? Number(y) : wordsToNumber(y);
  return nx != null && ny != null && nx === ny;
}
