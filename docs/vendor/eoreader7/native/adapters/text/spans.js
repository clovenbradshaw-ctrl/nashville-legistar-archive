// the legacy engine · perceiver/text/spans — real meaningful spans, not arbitrary
// fixed-size chunks. Everything built earlier this session (motif
// detection, structure tests, significance) operated on chunkWords(words,
// 40) — 40-word windows with no relationship to sentence or clause
// boundaries. That's the wrong foundation for anything above it: heat-
// tracking needs a real unit to attach activation to, coref resolution
// needs real sentence boundaries to resolve a pronoun within.
//
// Ported from eoreader5's text-organ.js::splitSentences, a real, tested
// implementation — paragraph breaks are a harder boundary than any
// terminator (a chapter heading has no period and must not glue onto the
// next paragraph), closing quotes after a terminator are absorbed, and a
// terminator NOT followed by whitespace is treated as a probable
// abbreviation ("Mr.") rather than a sentence end. Not reinvented — CLAUDE.md
// names sentence segmentation with offsets as one of the consistently
// reinvented wheels in this project family.

// Container, not content. A Project Gutenberg file wraps the work in a
// licence header, a title block, and often a table of contents; none of it
// is the text being read, and leaving it in put a chapter-number list at the
// top of a salience report earlier in this session. Knowing where the
// container ends is received knowledge ABOUT THE FILE FORMAT — the same kind
// as knowing an mp3 carries an ID3 header — not a linguistic rule and not a
// word set: no claim is made here about any language's vocabulary. Texts
// without these markers pass through untouched.
// ANCHORED TO A WHOLE LINE, which eoreader4.2 had and this did not. The old
// shape here was `\*\*\*\s*START OF ...[^*]*\*\*\*` — it matches across line
// breaks and depends on the trailing stars being the next asterisks in the
// file, so a book whose title contains one, or a marker PG wrote slightly
// differently, drags the cut to the wrong place. A marker is a LINE.
const GUTENBERG_START = /^[^\S\n]*\*{3}[^\S\n]*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;
const GUTENBERG_END = /^[^\S\n]*\*{3}[^\S\n]*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;

// THE BOOK TELLING YOU WHAT IT IS, WHICH IS NOT CHROME — the distinction
// eoreader4.2 drew and the reason this list exists. Everything before the
// start marker is host furniture except these: they are the work's own front
// matter, and dropping them with the licence text loses the only place a
// translator or an edition is ever named. They are carried over the cut.
//
// These are English field names and therefore a fact about PG's file format,
// received on exactly the same terms as the markers themselves (II.2). No
// claim is made about any language's vocabulary — a file that does not use
// them simply keeps nothing.
const FRONT_FIELD = /^(?:Title|Author|Editor|Translator|Illustrator|Release date|Language|Original publication|Credits)\s*:/i;

// THE CONTAINER DOES NOT END AT THE START MARKER, and assuming it did put 354
// forms of transcriber's note into the material on Heidi. Measured: the
// perished ground of a standpoint reader turned out to be Project Gutenberg's
// producer credits, so a reader imagining prose reached back and said the
// publisher's name, a copyright year and a page number.
//
// After the marker PG typically continues with a producer credit block, an
// ornamental rule, and a boxed transcriber's note, and only then the work.
// Two of the three are recognised by FORM alone, which is what keeps this out
// of linguistic-rule territory:
//
//   RULE   a line of nothing but asterisks and space
//   BOX    a run of lines drawn out of + - | and space, or bounded by pipes
//
// Neither says anything about a language's vocabulary — they are typography,
// and a Devanagari or CJK file draws its boxes the same way. The third needs a
// format marker, and a PG URL is exactly the same kind of received knowledge
// about the file format as the START marker itself already is (an mp3 has an
// ID3 header; a PG file has a credit block).
//
// STRIPPING STOPS AT THE FIRST PARAGRAPH THAT IS NONE OF THESE. It never scans
// the body, so a rule or a box drawn inside the work — a table, a scene break
// — is content and survives. Bounding it that way is what makes this safe;
// an unbounded version would eat an author's own ornament.
const PG_CREDIT_URL = /\b(?:pgdp\.net|gutenberg\.org|www\.gutenberg)/i;
const ORNAMENT_RULE = /^[\s*]+$/;
const BOX_BLOCK = /^[\s+|=_-]*$/;
const BOX_ROW = /^\s*\|.*\|\s*$/;

const isContainerParagraph = (p) => {
  const trimmed = p.trim();
  if (!trimmed) return true;
  if (ORNAMENT_RULE.test(trimmed)) return true;
  if (PG_CREDIT_URL.test(trimmed)) return true;
  // A boxed block: every line is either a border or a piped row.
  const lines = trimmed.split("\n");
  if (lines.every((l) => BOX_BLOCK.test(l) || BOX_ROW.test(l))) return true;
  return false;
};

// The cell this organ occupies on the operator grid (engine/operators.js):
// SEG · Field · Clearing — sentence segmentation; abbreviations are injected
// priors, never a list. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SEG", grain: "Ground" });

/**
 * Does what survived read as material at all, or as the container's error page?
 *
 * eoreader4.2's `looksLikeBook`, re-earned and renamed away from books.
 * Project Gutenberg's `.txt` redirect is served with a malformed Location
 * header, so a client that follows it lands on an HTML error page — which
 * carries no PG markers, survives stripping untouched, and gets read as the
 * work. 4.2 recorded the symptom exactly: "the reader parses site chrome
 * (Search / Donate / DOCTYPE) instead of the novel."
 *
 * Structural and cheap: too short to be anything, or it opens on a markup
 * tag. Nothing here knows a language. REPORTS, DOES NOT RULE — `stripContainer`
 * returns it as a field rather than refusing, because a caller reading a
 * genuinely tiny fragment is doing something legitimate and a perceiver is not
 * the place to decide it is not.
 */
export const looksLikeMaterial = (text) => {
  const t = String(text ?? "").replace(/^﻿/, "").trimStart();
  if (t.length < 200) return false;
  if (/^<(?:!doctype|html|head|body|div|meta|title|\?xml)\b/i.test(t)) return false;
  return true;
};

/**
 * Separate the work from the container it arrived in.
 *
 * Returns `{ text, offset, front, looks_like_material }`.
 *
 * THE CONTIGUITY CONTRACT IS WHY `front` IS A FIELD AND NOT A PREFIX.
 * eoreader4.2 returned the front-matter lines glued onto the front of the
 * body, which is right for a metadata harvester and wrong here: everything
 * downstream of this resolves spans by slicing the SOURCE at `offset`, so
 * `text` has to remain a contiguous slice of what came in. Prepending would
 * make every anchor past the join point wrong by the length of the header —
 * the same class of drift as the byte/character mix eoreader5 records in
 * `host/corpus.js` ("indexOf gives a CHARACTER index; anchors are byte
 * offsets"), arriving by a different road.
 *
 * So the front matter is carried, not discarded and not inlined.
 */
export const stripContainer = (text) => {
  let s = String(text ?? "");
  let offset = 0;
  const front = [];
  const start = s.match(GUTENBERG_START);
  if (start) {
    // The book telling you what it is, kept from the header before the cut.
    for (const line of s.slice(0, start.index).split("\n")) {
      const trimmed = line.trim();
      if (FRONT_FIELD.test(trimmed)) {
        const at = trimmed.indexOf(":");
        front.push(Object.freeze({ field: trimmed.slice(0, at).trim(), value: trimmed.slice(at + 1).trim() }));
      }
    }
    offset = start.index + start[0].length;
    s = s.slice(offset);

    // Walk the leading paragraphs and drop the ones that are still container.
    // Offsets are accumulated as we go, because everything downstream anchors
    // spans against this offset and a strip that forgot to move it would
    // silently shift every citation in the reader.
    for (;;) {
      const m = s.match(/^(\s*)([\s\S]*?)(\n\s*\n|$)/);
      if (!m) break;
      const paragraph = m[2];
      if (!paragraph.trim()) break;
      if (!isContainerParagraph(paragraph)) break;
      const consumed = m[0].length;
      if (consumed === 0) break;
      offset += consumed;
      s = s.slice(consumed);
    }
  }
  const end = s.match(GUTENBERG_END);
  if (end) s = s.slice(0, end.index);
  return { text: s, offset, front: Object.freeze(front), looks_like_material: looksLikeMaterial(s) };
};

/**
 * NORMALISATION MUST CARRY ITS OWN OFFSET, the same law `stripContainer`
 * above already holds ("everything downstream anchors spans against this
 * offset and a strip that forgot to move it would silently shift every
 * citation") — applied to the one step in this file that used to violate
 * it. `splitSentences` collapses `\r\n`/`\r` to `\n` before it computes a
 * single offset, and until this function existed that collapse was a bare
 * `.replace()` with nothing recording where a character had been removed.
 *
 * MEASURED (the-fold POLICIES.md LP3, 2026-08-29): a real Project
 * Gutenberg file with 3,654 CRLF pairs produced a span whose recorded
 * address, taken at face value, missed its own source file by 969 bytes —
 * correct only against a private, un-addressable copy of the text. The
 * defect was not in `splitSentences`'s CHOICE to normalise (mixed line
 * endings must fold to one before a terminator/whitespace rule can be
 * language-agnostic); it was that the normalisation was invisible.
 *
 * `\r\n` -> `\n` REMOVES one character per pair; bare `\r` -> `\n` is a
 * same-length substitution. So the map from normalised offset back to raw
 * offset is a monotonic step function with one step per collapsed CRLF —
 * recorded as checkpoints at each divergence, not walked character by
 * character on every query. `toRaw` binary-searches the last checkpoint at
 * or before the query and adds the accumulated raw-ahead-of-normalised
 * delta. Verified against the actual case that found this: a span at
 * normalised offset 196 in that file's body now resolves to raw offset
 * 1165 — the true position — via `toRaw`.
 *
 * `splitSentences` itself is UNCHANGED below: it still normalises inline
 * and returns exactly what it always returned. A caller that needs raw-file
 * addresses calls `normaliseNewlines` FIRST, passes its own `.text` to
 * `splitSentences` (which then finds nothing left to collapse — a no-op,
 * byte-identical to normalising once), and applies `.toRaw` to any offset
 * before writing it down. A caller that never calls this keeps today's
 * behaviour exactly, because nothing about `splitSentences` changed.
 */
export const normaliseNewlines = (text) => {
  const raw = String(text ?? "");
  const out = [];
  const checkpoints = [{ norm: 0, raw: 0 }];
  let normPos = 0;
  let rawPos = 0;
  while (rawPos < raw.length) {
    if (raw[rawPos] === "\r" && raw[rawPos + 1] === "\n") {
      out.push("\n");
      rawPos += 2;
      normPos += 1;
      checkpoints.push({ norm: normPos, raw: rawPos });
    } else {
      out.push(raw[rawPos] === "\r" ? "\n" : raw[rawPos]);
      rawPos += 1;
      normPos += 1;
    }
  }
  const toRaw = (n) => {
    if (!Number.isFinite(n)) throw new TypeError("toRaw: offset must be a finite number");
    let lo = 0, hi = checkpoints.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (checkpoints[mid].norm <= n) lo = mid; else hi = mid - 1;
    }
    const cp = checkpoints[lo];
    return cp.raw + (n - cp.norm);
  };
  return { text: out.join(""), toRaw };
};

import { SENTENCE_TERMINATORS, CLOSING_QUOTES } from "./priors.js";

/**
 * detectFrontMatterRun(text, {maxScanChars, tocLineMax, tocRunMin,
 * proseParaMin}) — a long run of short, unterminated paragraphs (a table
 * of contents' own shape: "CHAPTER ONE", "BOOK FIRST—A JUST MAN", one
 * heading per line, no sentence terminator) immediately before a
 * genuinely long prose paragraph, found only within the document's OWN
 * front matter, never deep inside it.
 *
 * Built from a real, measured failure (S27; live_priors' own corpus
 * sweep, an adversarial audit of its flagged reading anomalies): a
 * Gutenberg-mirrored edition of Les Misérables carries no PG
 * START/END markers at all, so `stripContainer` strips nothing and its
 * own table of contents is never touched — it runs to roughly char
 * 21,600 before real narrative prose begins ("In 1815, M.
 * Charles-François-Bienvenu Myriel was Bishop of D——"),
 * nearly three times past an 8,000-character flat excerpt window. Zero
 * relation edges were extracted from a book that has hundreds.
 *
 * TWO SAFETY PROPERTIES, both found ADVERSARIALLY — two independent
 * skeptics verifying the first cut of this function, not its own author
 * — and both load-bearing, so both are enforced here rather than left
 * to a caller to remember:
 *
 *   - The terminator check strips CLOSING_QUOTES first. A naive
 *     `/[.!?]$/` test misreads quote-terminated dialogue
 *     ("Nor running a chance of arrest?") as TOC-shaped, because the
 *     closing quote character sits after the real terminator. This reuses
 *     this file's own received `SENTENCE_TERMINATORS`/`CLOSING_QUOTES`
 *     closed classes — the SAME ones `splitSentencesInRange` already
 *     walks past a terminator, a few lines below — rather than
 *     inventing a second, Unicode-punctuation-category regex here.
 *   - `maxScanChars` BOUNDS the search. Without a bound, this same shape
 *     (a run of short, unterminated lines) matches a back-of-book
 *     alphabetical INDEX just as well as a front-of-book table of
 *     contents — found live, firing at 94% depth into an unrelated
 *     book (a misindexed "Leviathan" file's own back-matter index).
 *     Detection never runs past `maxScanChars`, so this function can only
 *     ever relocate an excerpt FORWARD within the document's own front
 *     matter — never into its middle, and never into its back matter.
 *
 * Thresholds (70-char lines, 8 consecutive, a 300-char prose paragraph to
 * land on) were chosen by reading real specimens, not against any single
 * golden score — disclosed rather than claimed as null-derived, and
 * checked against nine independent control books (Moby Dick, Pride and
 * Prejudice, Shakespeare's Complete Works, Tom Sawyer, Dorian Gray, Leaves
 * of Grass, Sherlock Holmes, Alice, Don Quixote) before shipping: 7/9
 * correctly never fire, and Moby Dick's real 28KB Etymology/Extracts
 * front section — genuine prose, real terminators — is correctly
 * left alone, confirming this targets TOC *shape*, not "any front
 * matter."
 *
 * Returns `{detected, skipTo, runLength}` — `skipTo` is a character
 * offset into the SAME string handed in (never re-based, never folded for
 * newlines first: a caller composing this with `normaliseNewlines` calls
 * this FIRST, on the raw body, exactly the way `stripContainer` already
 * composes before newline normalisation elsewhere in this file).
 */
export const detectFrontMatterRun = (text, { maxScanChars = 32000, tocLineMax = 70, tocRunMin = 8, proseParaMin = 300 } = {}) => {
  const s = String(text ?? "");
  const scan = s.slice(0, maxScanChars);
  const BREAK = /(?:\r?\n)\s*(?:\r?\n)+/g;
  const paragraphs = [];
  let paraStart = 0;
  let pm;
  while ((pm = BREAK.exec(scan))) {
    paragraphs.push({ start: paraStart, end: pm.index });
    paraStart = pm.index + pm[0].length;
  }
  paragraphs.push({ start: paraStart, end: scan.length });

  const stripTrailingClosingQuotes = (t) => {
    let end = t.length;
    while (end > 0 && CLOSING_QUOTES.has(t[end - 1])) end -= 1;
    return t.slice(0, end);
  };
  const isTerminated = (t) => {
    const stripped = stripTrailingClosingQuotes(t.trimEnd());
    return stripped.length > 0 && SENTENCE_TERMINATORS.has(stripped[stripped.length - 1]);
  };
  // A markdown ATX heading ("# Title", "##### Artikel 1") is a real,
  // INTENTIONAL structural marker — the opposite of the undifferentiated
  // run of plain lines a Gutenberg-style table of contents actually is.
  // Found live, not by reasoning about it: a Dutch legal code
  // (world-legislation/nl/BWBR0001838.md — YAML frontmatter, then
  // markdown headings each followed by either real prose or a bare
  // "Vervallen" ["Repealed"]) has DOZENS of repealed articles in a row,
  // each an "##### Artikel N" heading immediately followed by one
  // five-character word with no terminator — a run that cleared this
  // function's own floor and skipped 4,594 real characters into a
  // previously-CLEAN 39-edge reading, landing on nothing (0 edges). This
  // is the identical failure shape the back-of-book-index counter-example
  // already named (a real document structure that happens to share TOC's
  // surface shape) — found on a SECOND, unrelated structural convention
  // this pass's own control set never tested, because none of its nine
  // control books were markdown-formatted. Excluding ATX headings is
  // general, not a patch for this one file: Les Misérables' own TOC uses
  // plain "CHAPTER I—TITLE" lines with no "#" anywhere, so this exclusion
  // changes nothing about the specimen this function was built for, and
  // it is principled — a heading is evidence of deliberate document
  // structure, never evidence of an undifferentiated list masquerading
  // as content.
  const ATX_HEADING_RE = /^#{1,6}\s/;
  const isTocShaped = (paraText) => {
    const t = paraText.trim();
    if (!t || t.length >= tocLineMax) return false;
    if (ATX_HEADING_RE.test(t)) return false;
    return !isTerminated(t);
  };

  let run = 0;
  for (const para of paragraphs) {
    const paraText = scan.slice(para.start, para.end);
    if (isTocShaped(paraText)) {
      run += 1;
      continue;
    }
    const len = para.end - para.start;
    if (run >= tocRunMin && len >= proseParaMin) {
      return { detected: true, skipTo: para.start, runLength: run };
    }
    run = 0;
  }
  return { detected: false, skipTo: 0, runLength: 0 };
};

const PARAGRAPH_BREAK = /\n\s*\n+/g;

// The guard this file used to rely on — "a terminator not followed by
// whitespace is probably an abbreviation" — catches `3.14` and does NOT catch
// `Mr. Darcy`, which is the case its own comment named. Measured on real text:
// "Mr. Collins" occurred in 0 of Pride and Prejudice's sentences against 145
// occurrences in the file, because every title was split off as a sentence of
// its own. War and Peace never showed it, since Russian titles ("Prince
// Vasíli", "Count Rostóv") carry no period — so the defect was invisible for
// exactly as long as the corpus was Russian.
//
// WHICH tokens are abbreviations is a fact about a language, so it is not
// decided here. It is injected (`options.abbreviations`) and lives as data in
// bin/priors/lang/*.json, on its way to eoPriors. This module stays
// language-agnostic in the same way material.js does: no list baked in.
//
// When nothing is injected the fallback is derived from the material itself,
// Zipf-style, with no word list: a token type ALWAYS written with a trailing
// period is an abbreviation, since a real sentence-final word also turns up
// mid-sentence without one. A length bar taken from the text's own 10th
// -percentile token length keeps out words that merely happen to be
// text-final-only in a short sample.
//
// The fallback is a floor, not a substitute, and it is fragile in a way worth
// stating precisely rather than implying it is close enough. Two limits, both
// measured:
//
//   - the length bar on real English prose comes out at 2 characters, so a
//     three-character title like `Mrs` is out of reach by construction;
//   - "always written with a period" is all-or-nothing, so ONE period-less
//     occurrence anywhere — including in a licence header — disqualifies a
//     token for the whole text.
//
// Together those are not a small shortfall. On Frankenstein the fallback
// recovers `Mr` and `M` (13 and 8 sentences repaired). On Pride and Prejudice
// it recovers NOTHING: `Mr. Darcy` stays at 0 sentences derived, against 249
// with the prior. A caller that has a prior should pass it.
const TOKEN_BEFORE_DOT = /(\p{L}[\p{L}\p{M}]*)\./gu;
const TOKEN_RE = /\p{L}[\p{L}\p{M}]*/gu;

export const deriveAbbreviations = (text) => {
  const withDot = new Map();
  const total = new Map();
  const lengths = [];
  for (const m of text.matchAll(TOKEN_BEFORE_DOT)) withDot.set(m[1], (withDot.get(m[1]) || 0) + 1);
  for (const m of text.matchAll(TOKEN_RE)) {
    total.set(m[0], (total.get(m[0]) || 0) + 1);
    lengths.push(m[0].length);
  }
  if (lengths.length === 0) return new Set();
  lengths.sort((a, b) => a - b);
  const bar = lengths[Math.floor(lengths.length * 0.1)];
  const out = new Set();
  for (const [token, n] of withDot) if (n >= 2 && total.get(token) === n && token.length <= bar) out.add(token);
  return out;
};

/** The token immediately before position i, or "" if there is none. */
const tokenEndingAt = (s, i) => {
  let j = i;
  while (j > 0 && /[\p{L}\p{M}]/u.test(s[j - 1])) j--;
  return s.slice(j, i);
};

const pushSentence = (s, start, end, out) => {
  const raw = s.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return;
  const leading = raw.length - raw.trimStart().length;
  out.push({ text: trimmed, offset: start + leading, order: out.length });
};

// A NAME'S INITIAL IS NOT A STOP. Structural, like the decimal-point guard: no
// word list, only letter case, so it holds for any cased script and never
// fires in one without case. A period after a single uppercase letter is an
// initial when the letter stands inside a name — after a capitalised word or
// another initial, or before another initial — and the next word, after
// spaces, opens with an uppercase letter. The abbreviation fallback above
// cannot see this: it needs a token twice in the text it is handed, and every
// reader hands one chunk at a time, so "Ulysses S. Grant was born in Point
// Pleasant" was split at "S." and the claim lost its subject (2026-09-16).
//
// Measured before it shipped, over War and Peace and five Wikipedia pages:
// 314 boundaries removed — about 300 of them names ("John F. Kennedy",
// "A. M. Turing", "J. E. B. Stuart") — and 6 real sentence ends merged ("July
// 1969, A. D. We came in peace", and bibliography entries whose author ends in
// an initial before a title). A merge joins two sentences; a split severs a
// name from its own claim. A line break after the letter stays a boundary.
const UPPERCASE = /\p{Lu}/u;
const LETTER_CHAR = /\p{L}/u;
const isNameInitial = (s, i, rangeStart, rangeEnd) => {
  const x = i - 1;
  if (x < rangeStart || !UPPERCASE.test(s[x])) return false;
  if (x > rangeStart && LETTER_CHAR.test(s[x - 1])) return false; // the end of a word, not a single letter
  let n = i + 1;
  while (n < rangeEnd && (s[n] === " " || s[n] === "\t")) n += 1;
  if (n === i + 1 || n >= rangeEnd || !UPPERCASE.test(s[n])) return false;
  const beforeInitial = s[n + 1] === "." && !(n + 2 < rangeEnd && LETTER_CHAR.test(s[n + 2]));
  let p = x - 1;
  while (p >= rangeStart && (s[p] === " " || s[p] === "\t")) p -= 1;
  if (p === x - 1) return beforeInitial;
  let w = p;
  while (w >= rangeStart && LETTER_CHAR.test(s[w])) w -= 1;
  const previous = s.slice(w + 1, p + 1);
  const afterCapitalised = previous.length >= 2 && UPPERCASE.test(previous[0]);
  const afterInitial = p > rangeStart && s[p] === "." && UPPERCASE.test(s[p - 1]) && !(p - 2 >= rangeStart && LETTER_CHAR.test(s[p - 2]));
  return afterCapitalised || afterInitial || beforeInitial;
};

const splitSentencesInRange = (s, rangeStart, rangeEnd, out, abbreviations) => {
  let start = rangeStart;
  for (let i = rangeStart; i < rangeEnd; i++) {
    if (!SENTENCE_TERMINATORS.has(s[i])) continue;
    let end = i + 1;
    while (end < rangeEnd && CLOSING_QUOTES.has(s[end])) end += 1;
    if (end < rangeEnd && !/\s/.test(s[end])) continue; // a decimal point, not a stop
    if (s[i] === "." && abbreviations.has(tokenEndingAt(s, i))) continue; // a title, not a stop
    if (s[i] === "." && end === i + 1 && isNameInitial(s, i, rangeStart, rangeEnd)) continue; // an initial, not a stop
    pushSentence(s, start, end, out);
    start = end;
  }
  pushSentence(s, start, rangeEnd, out);
};

/**
 * @param {string} text
 * @param {object} [options]
 * @param {Iterable<string>|null} [options.abbreviations] - tokens that take a
 *   trailing period without ending a sentence. A LANGUAGE prior; pass one from
 *   bin/priors/lang/*.json. Omit to derive a weaker set from the text itself.
 */
export const splitSentences = (text, { abbreviations = null } = {}) => {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const abbrev = abbreviations ? new Set(abbreviations) : deriveAbbreviations(s);
  const paragraphs = [];
  let paraStart = 0;
  let pm;
  PARAGRAPH_BREAK.lastIndex = 0;
  while ((pm = PARAGRAPH_BREAK.exec(s))) {
    paragraphs.push({ start: paraStart, end: pm.index });
    paraStart = pm.index + pm[0].length;
  }
  paragraphs.push({ start: paraStart, end: s.length });

  const sentences = [];
  for (const para of paragraphs) splitSentencesInRange(s, para.start, para.end, sentences, abbrev);
  sentences.forEach((sent, i) => { sent.order = i; });
  return sentences;
};
