// organs/readability.js — HOW A PIECE READS, in-process, no Python.
// Handle: readability metrics (textstat's formulas) ported to pure JS so the
// score is free, deterministic, and runs anywhere — no subprocess, no NLTK
// data, no network. The readability grade complements Fisher (openings) and
// detectRedundancy (facts/templates): a piece can have no repeated openings
// and still read badly (too dense, too choppy). Each metric is a formula
// from the public readability tradition:
//   fleschReadingEase — 100 = easy, 0 = dense. Higher is more readable.
//   fleschKincaidGrade — US grade level. Lower is more readable.
//   gunningFog          — years of education needed to read it.
//   automReadabilityIndex (ARI), colemanLiau.
// Syllable counting uses a heuristic (vowel-group) — NOT the CMU dictionary,
// so it is approximate but deterministic; the score is a trend, never a law.

// Vowel-group syllable heuristic: count vowel runs, adjust for silent-e and
// -ed/-es endings. Approximate, deterministic, good enough for a trend.
export function syllableCount(word) {
  const w = String(word ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let count = 0;
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const isV = "aeiouy".includes(w[i]);
    if (isV && !prevVowel) count++;
    prevVowel = isV;
  }
  // Silent final e: "make" = 1, not 2.
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count--;
  // -ed/-es after a consonant often doesn't add a syllable ("walked").
  if ((w.endsWith("ed") || w.endsWith("es")) && count > 1) {
    const stem = w.slice(0, -2);
    if (!/[aeiou]/.test(stem.slice(-2))) count--;
  }
  return Math.max(1, count);
}

/** Count sentences, words, and syllables in a text. */
export function textMeasures(text = "") {
  const t = String(text ?? "").trim();
  if (!t) return { sentences: 0, words: 0, syllables: 0, chars: 0 };
  const sentences = (t.match(/[.!?]+(\s|$)/g) ?? []).length || 1;
  const words = t.split(/\s+/).filter(Boolean).length;
  const syllables = t.split(/\s+/).filter(Boolean).reduce((a, w) => a + syllableCount(w), 0);
  const chars = t.replace(/\s+/g, "").length;
  return { sentences, words, syllables, chars };
}

export const fleschReadingEase = (text) => {
  const { sentences, words, syllables } = textMeasures(text);
  if (!words || !sentences) return null;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
};

export const fleschKincaidGrade = (text) => {
  const { sentences, words, syllables } = textMeasures(text);
  if (!words || !sentences) return null;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
};

export const gunningFog = (text) => {
  const { sentences, words } = textMeasures(text);
  if (!words || !sentences) return null;
  const complex = String(text ?? "").split(/\s+/).filter(Boolean).filter((w) => syllableCount(w) >= 3).length;
  return 0.4 * ((words / sentences) + 100 * (complex / words));
};

export const colemanLiau = (text) => {
  const { sentences, words, chars } = textMeasures(text);
  if (!words || !sentences) return null;
  const L = (chars / words) * 100;
  const S = (sentences / words) * 100;
  return 0.0588 * L - 0.296 * S - 15.8;
};

export const automReadabilityIndex = (text) => {
  const { sentences, words, chars } = textMeasures(text);
  if (!words || !sentences) return null;
  const letters = chars;
  return 4.71 * (letters / words) + 0.5 * (words / sentences) - 21.43;
};

/** Reading time in minutes at ~230 wpm (adult silent reading). */
export const readingTimeMinutes = (text, wpm = 230) => {
  const { words } = textMeasures(text);
  return words / wpm;
};

/**
 * The readability grade of a piece — an EOT-recordable score, the way the
 * variation organs record transforms. Returns every metric + a plain-language
 * read (Easy / Plain / Fairly Difficult / Difficult / Very Confusing) from
 * Flesch, the standard banding.
 */
export function readabilityGrade(text) {
  const flesch = fleschReadingEase(text);
  const band = (f) => {
    if (f == null) return null;
    if (f >= 90) return "Very Easy";
    if (f >= 80) return "Easy";
    if (f >= 70) return "Fairly Easy";
    if (f >= 60) return "Plain English";
    if (f >= 50) return "Fairly Difficult";
    if (f >= 30) return "Difficult";
    return "Very Confusing";
  };
  return {
    flesch: flesch != null ? Number(flesch.toFixed(1)) : null,
    band: band(flesch),
    grade: fleschKincaidGrade(text) != null ? Number(fleschKincaidGrade(text).toFixed(1)) : null,
    fog: gunningFog(text) != null ? Number(gunningFog(text).toFixed(1)) : null,
    ari: automReadabilityIndex(text) != null ? Number(automReadabilityIndex(text).toFixed(1)) : null,
    colemanLiau: colemanLiau(text) != null ? Number(colemanLiau(text).toFixed(1)) : null,
    minutes: Number(readingTimeMinutes(text).toFixed(1)),
    ...textMeasures(text),
    basis: flesch != null ? `Flesch ${flesch.toFixed(0)} = ${band(flesch)}; grade ${fleschKincaidGrade(text).toFixed(0)}` : "no text to grade",
  };
}

/** Alias of readabilityGrade — the score by any name. */
export const scoreReadability = readabilityGrade;