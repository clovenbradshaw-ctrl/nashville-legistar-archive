// recurring-form-anchors.js — script-agnostic candidate anchors for
// discoverRelationVocab, for material where extractSurfaces' own
// capitalisation-significance test structurally cannot fire.
//
// THE GAP THIS CLOSES. discoverRelationVocab (relations.js) seeds its
// candidate-verb search from two sources: `surfaces` (named referents —
// extractSurfaces, surfaces.js) and `anchorSpans` (positional anchors,
// e.g. a bound pronoun occurrence — relations.js's own header: "the token
// after it sits in the same slot the token after a name does"). Every
// caller in this codebase supplies `surfaces` alone. extractSurfaces finds
// a candidate referent by testing whether a token's CAPITALISED share is
// significantly above a fair-coin null (capitalisationIsSignificant,
// surfaces.js) — a real, sound test for Latin/Cyrillic/Greek-script prose,
// and STRUCTURALLY VACUOUS for a script with no letter case at all (Arabic,
// Han): every token there reads as "never capitalised", so the significance
// test can never clear, so `surfaces` comes back empty, so
// discoverRelationVocab has nothing to seed from — measured live,
// 2026-09-10/11: a real Arabic UDHR reading extracted zero real
// propositions from its own body text even with real closed-class priors
// in place (real whitespace, real Spanish/Arabic/Mandarin AUXILIARY_VERBS/
// SUBJECT_PRONOUNS/etc. wired in), because the candidate SEED itself was
// already empty before those priors ever got a chance to matter.
//
// SEARCH FIRST: a script-agnostic candidate mechanism for exactly this
// class of gap already exists, one tier over. `organs/hypergraph.js`'s own
// `endpoint()` grants a SUBJECT identity via a RECURRING content word (its
// own header, quoting host/terrains.js's prior finding: "a concept
// document's real vocabulary is made of recurring content words, not
// proper names, and the cast ladder starves on it") — gated at
// `FORM_MIN_ARRIVALS = 2` distinct sentences, the same structural-minimum
// argument this file reuses rather than re-derives (one arrival is a
// hapax, not a pattern; two is the floor a co-occurrence test needs at
// all). That mechanism operates on ALREADY-EXTRACTED end1/end2 text,
// never on raw document offsets, so it cannot itself supply
// discoverRelationVocab's `anchorSpans` — this file is the missing half:
// the SAME recurrence test, computing the SPAN of every qualifying
// occurrence in the raw document, in the exact `{index, length, anchor}`
// shape relations.js's own header already documents.
//
// WHY THIS IS SOUND WHERE A BARE ANCHORED STRING WOULD NOT BE. relations.js's
// own header states the rule this file follows: "the wall is positional on
// purpose — anchoring the STRING would anchor every occurrence, which is
// exactly the unlicensed shape the treebank-VERB nomination was refused
// for." Every span here is a REAL occurrence's own position, tokenized off
// the real bytes, never a string broadcast across the document.
//
// SCOPE, DISCLOSED. This closes the candidate-SEEDING half of the gap for
// any script with real inter-word boundaries (Arabic has ordinary
// whitespace; this closes cleanly there). It does NOT close Mandarin's
// separate, deeper problem: `tokenize`'s own WORD_RE (`\p{L}\p{N}'+`,
// source.js/material.js, P62) has no word-boundary signal at all inside an
// unbroken run of Han characters, so a real multi-character Mandarin word
// is invisible to this same regex the same way it is everywhere else in
// this codebase (P62's own disclosed CJK-segmentation gap) — named here,
// not silently worked around.

const WORD_RE = /[\p{L}\p{N}']+/gu;

/**
 * scriptIsCaseless(text) — does this MATERIAL's own script carry a
 * case distinction at all? Detected from the bytes themselves, never from
 * a `--lang=` label or a hardcoded per-language table — the same mistake
 * this whole file exists to correct one level up: learning that Arabic's
 * script has no case does not tell you anything about Spanish's, and a
 * caller steering on "this language is in my list of languages that need
 * the fix" is exactly the un-generalized, un-transferable shape this
 * project's own generality gate (P71) warns against. A script either has
 * letters that distinguish case (Latin, Cyrillic, Greek, Armenian — some
 * fraction of real prose will carry an uppercase letter) or it does not
 * (Arabic, Hebrew, every CJK script) — measured directly against a real
 * sample of the material's own letters, not assumed from its declared
 * language.
 *
 * Real signal, not a guess: `\p{Lu}` (letter, uppercase) is a genuine
 * Unicode property per codepoint, so a text drawn from a case-bearing
 * script reliably contains SOME uppercase letters (sentence-initial
 * capitals alone guarantee it in ordinary prose) while a text drawn from a
 * case-less script contains structurally none, regardless of length.
 * `minLetters` guards the edge case of a tiny or letterless sample (a bare
 * number, an empty string) where the absence of an uppercase letter proves
 * nothing about the script.
 */
export function scriptIsCaseless(text, { minLetters = 40 } = {}) {
  const s = String(text ?? "");
  // MEASURED ON THE DOMINANT SCRIPT ONLY, not the whole byte stream. Found
  // live: every UDHR specimen this project reads carries a few lines of
  // incidental English metadata ("Language: Arabic (ar)") ahead of the
  // real body — a handful of ASCII uppercase letters that, counted against
  // the whole document, wrongly read a genuinely Arabic-script document as
  // case-bearing. ASCII letters are counted SEPARATELY from the rest of
  // \p{L}; whichever class is the majority of the material's own letters
  // is the one case-ness is measured against — an incidental foreign
  // fragment too small to be the dominant script never gets to answer the
  // question for the document that contains it.
  const asciiLetters = s.match(/[A-Za-z]/g) ?? [];
  const otherLetters = s.match(/[^\x00-\x7F]/gu)?.filter((c) => /\p{L}/u.test(c)) ?? [];
  const total = asciiLetters.length + otherLetters.length;
  if (total < minLetters) return null; // not enough signal to say either way
  if (asciiLetters.length >= otherLetters.length) {
    return asciiLetters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length === 0;
  }
  return otherLetters.filter((c) => /\p{Lu}/u.test(c)).length === 0;
}

/**
 * recurringFormAnchorSpans(text, {sentences, minArrivals, functionWords}) —
 * every occurrence's [index, length) of a token that recurs across at
 * least `minArrivals` DISTINCT sentences of `text`, shaped for
 * discoverRelationVocab's `anchorSpans` parameter.
 *
 * `sentences` — pre-split sentence objects/strings covering `text`
 * (splitSentences' own return shape); required, never re-derived here, so
 * a caller that already split the text for its own purposes pays for the
 * split once.
 *
 * `minArrivals` — declared, never defaulted-and-hidden: FORM_MIN_ARRIVALS
 * (hypergraph.js) = 2 is the reused structural minimum this file's own
 * header names; a caller states it explicitly rather than trusting an
 * implicit default that could silently drift from that precedent.
 *
 * `functionWords`, optional — a closed class (this text's own measured
 * common-terms set, or a language's declared closed classes) to exclude
 * from anchoring; a recurring closed-class word ("the", "and", Arabic's
 * "أن") is not a candidate SUBJECT and should not seed a verb-candidate
 * search any more than it would as a bare string surface.
 */
export function recurringFormAnchorSpans(text, { sentences, minArrivals, functionWords = null } = {}) {
  const s = String(text ?? "");
  if (!Array.isArray(sentences) || sentences.length === 0) return [];
  if (!Number.isInteger(minArrivals) || minArrivals < 1) {
    throw new TypeError("recurringFormAnchorSpans: minArrivals is declared — how much recurrence counts as a pattern is the caller's to say, never a default here");
  }

  // Pass 1: which lowercase forms recur across at least minArrivals
  // DISTINCT sentences — the same per-sentence-distinct discipline
  // hypergraph.js's own computation uses, not raw occurrence count (one
  // sentence repeating a word three times is not three arrivals of a
  // pattern).
  const sentenceHits = new Map(); // lowercase token -> count of distinct sentences it appeared in
  for (const sent of sentences) {
    const sText = typeof sent === "string" ? sent : sent?.text ?? "";
    const seenThisSentence = new Set();
    for (const m of sText.matchAll(WORD_RE)) {
      const w = m[0].toLowerCase();
      if (w.length < 2) continue; // a single glyph carries no recurrence signal worth anchoring on
      if (functionWords?.has(w)) continue;
      seenThisSentence.add(w);
    }
    for (const w of seenThisSentence) sentenceHits.set(w, (sentenceHits.get(w) ?? 0) + 1);
  }
  const qualifying = new Set([...sentenceHits.entries()].filter(([, n]) => n >= minArrivals).map(([w]) => w));
  if (!qualifying.size) return [];

  // Pass 2: every occurrence's own span, in the SAME char coordinates `s`
  // (and discoverRelationVocab's own `text` argument) already use —
  // relations.js's `tallyAfter` slices `s` directly by JS-string char
  // offset, never a byte offset, so this file stays in that same space
  // rather than the byte-offset convention host/corpus.js's
  // tokenizeWithOffsets uses for a different consumer.
  const out = [];
  for (const m of s.matchAll(WORD_RE)) {
    const w = m[0].toLowerCase();
    if (!qualifying.has(w)) continue;
    out.push({ index: m.index, length: m[0].length, anchor: `form:${w}` });
  }
  return out;
}
