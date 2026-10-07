// sound.js — THE SOUND READER, AT THE GRAIN BELOW THE WORD (2026-09-22).
//
// The paradigm hunt (paradigm.js) reads the Ground of verse — rhyme, and the
// length of a line in syllables — and the EOT parser reads words, not sounds.
// This is the reader that feeds it. It is SPELLING, NOT SOUND: this machine
// holds no pronunciation dictionary, so a rhyme is the tail of the spelling
// (the last vowel group and what follows it) and a syllable is a vowel run
// (organs/readability.js). Both over-match and under-match in known ways
// ("love"/"move" rhyme by eye; "though"/"through" do not rhyme by ear), and
// every caller tests a rhyme pattern against a within-unit shuffle null, so
// the over-matching is absorbed by the null rather than mistaken for a form.
// A pronunciation organ replaces this module's two functions and nothing
// else changes.

import { syllableCount } from "../organs/readability.js";

export const SOUND_STANDING = "spelling-based: rhyme is the spelled tail, a syllable is a vowel run — no pronunciation dictionary on this machine";

export const syllables = (word) => syllableCount(String(word ?? "").replace(/[’']/g, ""));

const letters = (w) => String(w ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z]/g, "");

/** The spelled rhyme keys of a word: its tail (last vowel group onward, a
 *  silent final e dropped), a looser key (the tail's first vowel and its
 *  consonants), and its last three letters. */
export function rhymeKeys(word) {
  let x = letters(word);
  if (!x) return null;
  const whole = x;
  if (/[^aeiouy][aeiouy]*[^aeiouy]e$/.test(x) && x.length > 3) x = x.slice(0, -1);
  const tail = x.match(/[aeiouy]+[^aeiouy]*$/)?.[0] ?? x;
  const loose = (tail.match(/[aeiouy]/)?.[0] ?? "") + tail.replace(/^[aeiouy]+/, "");
  return { word: whole, tail, loose, last3: whole.slice(-3) };
}

/** Two DIFFERENT words whose spelled tails agree. The same word twice is
 *  repetition, a different relation (sameWord), never a rhyme. */
export function rhymes(a, b) {
  const A = rhymeKeys(a), B = rhymeKeys(b);
  if (!A || !B || A.word === B.word) return false;
  return A.tail === B.tail || A.loose === B.loose || (A.word.length > 3 && B.word.length > 3 && A.last3 === B.last3);
}
