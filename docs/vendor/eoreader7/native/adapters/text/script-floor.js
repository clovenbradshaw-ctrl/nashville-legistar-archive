// script-floor.js — how short a word may be and still carry a meaning.
//
// A minimum word length is a proxy for "enough to be distinctive". A character
// carries different amounts in different scripts, so one number in characters
// is a fact about Latin, not about language: a Han character is a morpheme (a
// two-character word is a whole word — 北京, 孔子); Arabic and Hebrew write
// consonants only (a three-letter form is a full root or name — جون, שלום).
// `wordFloor(w, base)` lowers a caller's declared floor for those scripts and
// returns it unchanged for every other, so the Latin path is byte-identical.
const DENSE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const ABJAD = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
export const wordFloor = (w, base) => (DENSE.test(w) ? Math.min(base, 2) : ABJAD.test(w) ? Math.min(base, 3) : base);
