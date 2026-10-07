// eoreader7 native · adapters/text/segments — structural boundaries, found
// not named.
//
// CROSSED THE RATCHET 2026-08-29, unchanged. This organ had no v7 redesign:
// its whole remit is FORM (a line's shape, a numeral's shape), and v7's cut
// changed nothing about form. Moved rather than re-earned for the same
// reason priors.js was moved byte-identical — parity is the ratchet's gate,
// and rewriting an organ with no pending redesign would break parity while
// buying nothing. Behavioural equality with the frozen provider is pinned by
// conformance/legacy-parity.test.mjs.
//
// A reader has to know where one stretch of a source ends and the next begins
// before it can be asked for "the next chapter" or "the scene where". This
// organ finds those boundaries by FORM and nothing else: the words a source
// uses for its headings ("Chapter", "Letter", "Scene", "Movement") are that
// source's own surfaces, not this module's vocabulary. Nothing here knows any
// of them, and it fires identically on a numbered movement in a score with no
// words at all — the omnimodal commitment, same as material.js and spans.js.
//
// RE-EARNED, NOT PORTED. eoreader-chat carried this machinery for eoreader5's
// corpus; it is brought here under the legacy engine's terms, with the measured
// lessons carried as design rather than copied as code:
//
//  1. A heading is form, not content. A short line, followed by a blank line,
//     that is numbered, roman-numeraled, all-caps, or Title Case word pair.
//     "Chapter 1" scores the same way "Movement 3" and "Sinfonia 9" do,
//     because the pattern is WORD + NUMBER, and the word is not named.
//
//  2. A sentence is not a heading. A line ending in . ! ? — after trailing
//     quotes are stripped, so "Mary Bolkónskaya.”" cannot wave through on its
//     closing quote — is prose, not a boundary. The one exception is a bare
//     roman numeral ("XVIII."), which is a heading's own punctuation.
//
//  3. A name is not a heading. A leading abbreviation-shaped token followed
//     by a capitalised word ("Mr. Darcy", "St. Petersburg") is an honourific
//     + name line — the same false positive the surfaces organ fights with
//     its ratio filter. Refused by form (abbrev. + Capital), never by list.
//
//  4. A listing is not a structure. A book's own table of contents is a wall
//     of perfectly heading-shaped lines with nothing under them. A candidate
//     earns its place by what opens beneath it, or it is dropped — and the
//     front matter falls into the preamble, which the reader still renders.
//
//  5. Fewer than two boundaries is a typed gap, never a one-entry table of
//     contents. A document we found no structure in should say so.
//
//  6. A window edge is a window, not a chapter. When no heading stands behind
//     an anchor inside the reach, the segment starts at the window edge and
//     is LABELLED as such — a segment title fabricated from a mid-sentence
//     line is a false permanency, and saying "(context window — no heading
//     precedes this passage)" instead of inventing one is the whole refusal.
//
//  7. No level. Whether one heading nests under another is a holon-level
//     claim, and level is discovered from existence-dependency, never
//     inferred from a heading's typographic form. The outline is flat, and
//     honest about being flat.
//
// UNIT CONTRACT — the drift that this file exists to prevent. Offsets are
// unit-ambiguous until a caller says what they are: `lineIndex` builds
// UTF-16 code-unit starts, a byte-addressable host builds byte starts. The
// engine treats them as opaque and always returns the same unit it was given.
// What is FORBIDDEN is mixing them — slicing a string by byte offsets, or
// counting line starts in code units against a byte anchor, silently drifts
// on the first non-ASCII character. eoreader-chat measured that failure on
// Sanskrit and Chinese corpus labels and it is not re-created here.
//
// Pure: no clock, no I/O, no randomness, no model. A prompt is never required
// to name a word; the number forms (arabic, roman) ARE convertible here
// because they are form, and form is this organ's whole remit.

// The cell this organ occupies on the operator grid (engine/operators.js):
// SEG · Field · Clearing — structural boundaries found by form and nothing
// else. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SEG", grain: "Ground" });

// ── the form tests ───────────────────────────────────────────────────────────

const TRAILING_QUOTES = /["'‘’“”]+$/;
const ROMAN_ALONE_PERIOD = /^[IVXLCDM]+\.$/;
const SENTENCE_TAIL = /[?.!]$/;
const ROMAN_LEAD = /^[IVXLCDM]+[.)]?\s/;
const NUMBERED_LEAD = /^\p{Nd}{1,4}[).]\s/u;
const WORD_THEN_NUMBER = /^\p{L}[\p{L}\p{M}'\u2019]*\s+\p{Nd}{1,4}$/u;
const HONOURIFIC_LINE = /^[\p{L}][\p{L}\p{M}]*\.\s+\p{Lu}/u;
const TITLE_CASE_PAIR = /^\p{Lu}\p{Ll}+\s+\p{Lu}/u;

const allCaps = (s) => s.length >= 4 && /[\p{Lu}]/u.test(s) && !/[\p{Ll}]/u.test(s);

/**
 * Score one line as a structural boundary candidate, 0–5.
 *
 * `nextLineBlank` is required: a boundary opens onto a body, and the blank
 * line is how a text says so. Without it, every line of a paragraph stands
 * on its own and the detector would carve prose into headings.
 */
export const headingScore = (line, nextLineBlank) => {
  const trimmed = line.trim();
  if (trimmed.length > 80) return 0;
  if (!nextLineBlank) return 0;

  // 2. a sentence is not a heading — after stripping closing quotes so a
  //    speech tail ("Bolkónskaya.”") is judged on the period it ends with.
  //    A bare numeral is the exception: "III.", "XVIII.", "12" are counting
  //    made line-shaped, a heading's own punctuation, never prose.
  const unquoted = trimmed.replace(TRAILING_QUOTES, "");
  const bareNumeral = /^\p{Nd}{1,4}\.?$/u.test(unquoted) || ROMAN_ALONE_PERIOD.test(unquoted);
  if (unquoted.length < 3 && !bareNumeral) return 0;
  if (SENTENCE_TAIL.test(unquoted) && !bareNumeral) return 0;

  // 3. a name is not a heading — honourific + name, by form.
  if (HONOURIFIC_LINE.test(trimmed)) return 0;

  let s = 0;
  if (ROMAN_LEAD.test(trimmed)) s += 3;
  if (NUMBERED_LEAD.test(trimmed)) s += 3;
  // 1. WORD + NUMBER, or a bare number. The word is not named — "Chapter 1",
  //    "Letter 4", "Movement 3", "Sinfonia 9" all arrive by the same form, and
  //    it is what makes Frankenstein navigable from end to end.
  if (WORD_THEN_NUMBER.test(trimmed) || bareNumeral) s += 3;
  if (allCaps(trimmed)) s += 2;
  if (TITLE_CASE_PAIR.test(trimmed)) s += 2;
  if (SENTENCE_TAIL.test(trimmed) && !bareNumeral) s -= 2;
  return s >= 2 ? s : 0;
};

// ── the index ────────────────────────────────────────────────────────────────

/**
 * A line index in the CALLER's unit. `starts[i]` is the offset (bytes or code
 * units — the caller's choice, kept consistent) where line i begins;
 * `lengthOf(line)` measures one line in that same unit. Offsets produced here
 * are only ever combined with the same index's `starts`/`lengthOf`/`total`.
 */
export const lineIndex = (text) => {
  const s = String(text ?? "");
  const lines = s.split("\n");
  const starts = new Array(lines.length);
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = at;
    at += lines[i].length + (i + 1 < lines.length ? 1 : 0); // the \n between lines only
  }
  return { lines, starts, total: at, lengthOf: (line) => line.length };
};

/** The index of the line containing `offset` (binary search over starts). */
export const lineAt = (starts, offset) => {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

// Amendment (golden-quotes-surprise-calibration pilot): a heading must be
// isolated ABOVE too, not just followed by a blank line. Without this, a
// long title hard-wrapped across several physical lines (Gutenberg wraps at
// ~70-80 chars) has every one of its OWN continuation lines independently
// scored as a fresh heading — measured directly: Don Quixote's table of
// contents wraps "...FAMOUS KNIGHT IN THE\nWORLD\n\n", and "WORLD" alone is
// all-caps, short, followed by a blank line, and passed the substance gate
// (the next candidate's own label counted as its "body") — so a prompt
// containing the ordinary word "world" resolved to that fragment instead of
// the real passage. A genuine heading is isolated on both sides in real
// prose (surrounded by blank lines); only a hard-wrap continuation sits
// directly under a non-blank line. Requiring isolation above keeps every
// existing single-line heading (already isolated in real usage) and drops
// exactly the mid-wrap fragments.
const isHeading = (index, i) =>
  i + 1 < index.lines.length &&
  (i === 0 || index.lines[i - 1].trim() === "") &&
  headingScore(index.lines[i], index.lines[i + 1].trim() === "") > 0;

/** Every heading-shaped line in the index, unscreened. */
export const headingsOf = (index) => {
  const out = [];
  for (let i = 0; i < index.lines.length; i++) {
    if (!isHeading(index, i)) continue;
    out.push({
      line: i,
      start: index.starts[i],
      label: index.lines[i].trim(),
      bodyStart: index.starts[i] + index.lengthOf(index.lines[i]) + 1,
    });
  }
  return out;
};

/**
 * The whole-document outline.
 *
 * A candidate survives only if a real body opens beneath it (lesson 4): the
 * substance under a heading is the joined trimmed length of the lines before
 * the next heading, and a heading-shaped line with less than `minBody` under
 * it is a listing entry, not a boundary. The front matter it discards falls
 * under `preambleEnd`, which the reader still renders.
 *
 * Fewer than two surviving boundaries is a typed gap (lesson 5) — never a
 * one-entry table of contents.
 *
 * Flat by construction (lesson 7): `start`/`bodyStart`/`end` are the heading
 * line, the line after it, and the next heading's start. No nesting is
 * inferred from typography, ever.
 */
export const outlineOfIndex = (index, { max = 500, minBody = 40 } = {}) => {
  if (!index || index.lines.length === 0 || index.total === 0) return { headings: [], gap: "empty_text" };

  const candidates = headingsOf(index);
  const found = [];
  for (let i = 0; i < candidates.length && found.length < max; i++) {
    const next = candidates[i + 1];
    const toLine = next ? next.line : index.lines.length;
    let substance = 0;
    for (let k = candidates[i].line + 1; k < toLine; k++) substance += index.lines[k].trim().length;
    if (substance < minBody) continue; // a listing, not a boundary
    found.push({ ...candidates[i], end: next ? next.start : index.total });
  }

  if (found.length < 2) {
    return {
      headings: found,
      gap: found.length
        ? "only_one_boundary_detected"
        : "no_structural_boundaries_detected",
      preambleEnd: found.length ? found[0].start : null,
    };
  }

  return {
    headings: found,
    gap: null,
    truncated: found.length >= max,
    preambleEnd: found[0].start,
  };
};

/**
 * The segment bracketing an anchor — the structural cluster around one
 * position, which is what "the scene where X happens" means.
 *
 * The reach is a window around the anchor (lesson 6): whatever stands behind
 * and ahead of it within the reach is found, and a missing heading behind is
 * reported honestly — the segment starts at the window edge and carries the
 * literal label "(context window — no heading precedes this passage)" instead
 * of a fabricated chapter name. `found: false` marks that case so a caller can
 * show it as a window rather than dress it as a boundary.
 *
 * Returns null when no structural boundary is anywhere within the reach — the
 * caller then reports "no structural boundary detected", never a guess.
 */
export const discoverSegment = (index, nearOffset, { radius = 6000 } = {}) => {
  const total = index.total;
  if (!Number.isFinite(nearOffset)) return null;
  const r = Math.min(radius, Math.max(600, total >> 2));
  const lo = Math.max(0, nearOffset - r);
  const hi = Math.min(total, nearOffset + r);
  const firstLine = lineAt(index.starts, lo);
  const lastLine = lineAt(index.starts, hi);
  const anchorLine = lineAt(index.starts, nearOffset);

  let startLine = null;
  let endLine = null;
  for (let i = anchorLine; i >= firstLine; i--) if (isHeading(index, i)) { startLine = i; break; }
  for (let i = anchorLine + 1; i <= lastLine; i++) if (isHeading(index, i)) { endLine = i; break; }
  if (startLine == null && endLine == null) return null;

  const found = startLine != null;
  if (!found) startLine = firstLine;

  let headingCount = 0;
  for (let i = firstLine; i <= lastLine; i++) if (isHeading(index, i)) headingCount++;

  return {
    start: index.starts[startLine],
    end: endLine != null ? index.starts[endLine] : hi,
    label: found ? index.lines[startLine].trim() : "(context window — no heading precedes this passage)",
    found,
    headingCount,
  };
};

// ── number forms ─────────────────────────────────────────────────────────────
//
// Arabic and roman numerals are both just FORMS of counting; converting
// between them is the same act as normalising case, and it is what lets a
// prompt say "chapter 18" to a source that says "CHAPTER XVIII". The same form
// discipline covers every digit script a source might print: "अध्याय २" is
// addressed by a prompt that writes "२", by its surface, because the VALUE of
// a Devanagari २ is knowledge, and knowledge is a prior. A word that counts
// ("second", "third") is vocabulary and is deliberately NOT here — an English
// ordinal belongs in a language prior, on its way to eoPriors.

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export const toArabic = (roman) => {
  const s = String(roman ?? "").toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = ROMAN_VALUES[s[i]];
    if (v < prev) total -= v;
    else { total += v; prev = v; }
  }
  return total;
};

export const toRoman = (n) => {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return null;
  const table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, sym] of table) {
    while (n >= v) { out += sym; n -= v; }
  }
  return out;
};

// ── addressing ───────────────────────────────────────────────────────────────
//
// Does a prompt address a boundary? Mechanical, form-only: whitespace and
// punctuation folded on both sides, case folded through the same single-pass
// accent map the surfaces organ uses (diaNorm — never a third map; a collision
// it causes is ambiguity, a typed gap, never a silently wrong segment), and
// numbers compared across numeral forms. The boundary's own words must appear
// in the prompt as a contiguous run — "snip chapter 2 of the book" contains
// "chapter 2", and the leading and trailing words of the prompt are the
// reader's, not ours. A prompt that says "the second chapter" does not address
// this heading by form — "second" is an English ordinal, a prior word, and the
// caller falls through to content search rather than pretending to understand
// it.
//
// NUMERALS ARE FORM, IN EVERY DIGIT SCRIPT. ASCII digits carry an intrinsic
// value ("chapter 18" finds "CHAPTER XVIII", "chapter 2" finds "CHAPTER II"),
// and non-ASCII digit scripts (Devanagari १, Arabic-Indic ١) are compared by
// their own surface: a Hindi heading "अध्याय २" is addressed by a prompt that
// writes "अध्याय २", never by "अध्याय 2". Crossing a digit-script boundary
// ("2" ⟶ "२") is a value claim, and value claims are prior knowledge —
// language word-forms and digit-script mappings alike belong in eoPriors, and
// the engine reports a miss rather than pretending a २ is a 2.

import { diaNorm } from "./surfaces.js";

const tokensOf = (s) => diaNorm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const isNumeralToken = (t) => /^\p{Nd}+$/u.test(t) || /^[ivxlcdm]+$/.test(t);
const numeralValue = (t) => {
  if (/^[0-9]+$/.test(t)) return Number(t); // intrinsic value
  if (/^\p{Nd}+$/u.test(t)) return t; // other digit scripts: surface, value is a prior
  return toArabic(t);
};
const wordsOf = (tokens) => tokens.filter((t) => !isNumeralToken(t));
const valuesOf = (tokens) => tokens.filter(isNumeralToken).map(numeralValue);

export const headingsMatch = (prompt, label) => {
  const pt = tokensOf(prompt);
  const lt = tokensOf(label);
  const lwords = wordsOf(lt);
  const lvalues = valuesOf(lt);
  if (lwords.length === 0 && lvalues.length === 0) return false;
  for (let i = 0; i + lt.length <= pt.length; i++) {
    const win = pt.slice(i, i + lt.length);
    const wwords = wordsOf(win);
    const wvalues = valuesOf(win);
    if (wwords.length !== lwords.length || wvalues.length !== lvalues.length) continue;
    if (!wwords.every((w, k) => w === lwords[k])) continue;
    if (!wvalues.every((v, k) => v === lvalues[k])) continue;
    return true;
  }
  return false;
};
