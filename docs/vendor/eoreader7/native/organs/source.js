/* Nadim — GENERATED EPIGRAPH AND COMMENTARY, NOT THE AUTHOR'S WORDS except text inside quotation marks, and only where the archon's dossier (the-fold docs/archons/dossier) verifies that quote:
 * “هذا فهرست كتب جميع الأمم، من العرب والعجم، الموجود منها بلغة العرب وقلمها، في أصناف العلوم وأخبار مصنفيها، وطبقات مؤلفيها، وأنسابهم وتاريخ مواليدهم، ومبلغ أعمارهم وأوقات وفاتهم، وأماكن بلدانهم ومناقبهم ومثالبهم، منذ ابتداء كل علم اخترع إلى عصرنا هذا، وهو سنة سبع وسبعين وثلاثمائة للهجرة.”
 *
 * This file, 'source.js', is a repository of verified words, a record of what has been definitively verified.  It serves as a foundation for understanding the world, not by imposing judgments upon it, but by presenting the world as it is.  The use of this file should not be a matter of opinion, but of objective truth.
 *
 * — the engineering record below, kept whole —
 */
// source.js — the address half.
// Handle: Nadim — after Ibn al-Nadim's Fihrist, an addressed catalogue of every known work; retrieval by where it sits, never by judgment of what it says. Amendment XVII.
//
// A System 2 record is only worth more than a paraphrase because its refs can
// be read back. That requires material with addresses, so this module holds
// the smallest honest version of one: paste text, it is chunked at paragraph
// boundaries, every chunk knows its byte range, and retrieval is mechanical
// term overlap. No model chooses anything here.
//
// Two rules this module exists to obey:
//   - The model does not get tools. Whether a turn retrieves is a
//     deterministic function of the question's own words, not a decision the
//     model makes.
//   - Whatever cannot be addressed is a typed gap, never a guess. A chunk with
//     no term overlap is simply absent; nothing is invented to fill it.

import { hear } from "../adapters/text/active-ear.js";
import { sniffContainer } from "./measure.js";

const STOPWORDS = new Set(
  ("a an and are as at be but by for from had has have he her his i in into is it its of on or " +
    "our she that the their them there these they this to was were what when where which who why " +
    "will with would you your do does did can could should about would're not no if then than so " +
    "how me my we us been being over under after before also just like more most some such only").split(" "),
);

/**
 * Diacritics are folded away before splitting. A corpus can be accented where
 * the question is not — a Project Gutenberg text writes "Natásha" 1,213 times,
 * and a reader asking about Natasha would otherwise be told, with all of War
 * and Peace loaded, that there is no mention of her. That failure looks like
 * the retrieval working and the material lacking, which is the worst shape a
 * bug can take here.
 */
/**
 * Diacritic folding, the same fold everywhere: a corpus that writes Bezúkhov
 * must answer a question that writes Bezukhov, in RETRIEVAL and in the CHECKS
 * alike. Measured live on War and Peace: tokenize folded (so the right
 * chapters were retrieved) while the grounding index did not (so every
 * accented name in them was flagged "not in the material"). The engine had
 * the same bug in the opposite state (CLAUDE.md); one shared fold is the fix
 * for the class, not the instance.
 *
 * Widened for the same reason a second time (2026-08-28): a vocalized Hebrew
 * corpus (nikud — real material, fetched live from the Talmud) and an
 * unvocalized question are the identical Bezúkhov/Bezukhov shape one script
 * over — measured, `foldDiacritics("שָׁלוֹם") !== "שלום"` before this. Hebrew
 * nikud (U+0591–U+05C7) and Arabic tashkil (U+064B–U+065F, plus U+0670's
 * superscript alef) sit outside the Latin/Greek/Cyrillic combining-marks
 * block this fold already stripped, so they survived untouched. Folding a
 * vowel mark away can only WIDEN what matches — it never narrows a real
 * distinction into a false one, the same "safe by construction" class as
 * P41/P43's determiner/negation priors — so this is not gated behind an
 * opt-in the way `verbForms`/`createLemmatizer` are.
 */
export function foldDiacritics(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u065f\u0670]/g, "");
}

/**
 * A text reduced to its WORDS AND ITS STOPS: diacritics folded, case folded,
 * every sentence-terminal run collapsed to one canonical stop, and every
 * other mark — typesetting rather than vocabulary — reduced to a word
 * boundary. Letters and numbers of any script survive; nothing else does.
 *
 * This exists because a model does not retype a source's BYTES, it retypes
 * its WORDS. The bytes of a book carry curly quotation marks, curly
 * apostrophes, em and en dashes and the ellipsis glyph; a model's retyping of
 * the same passage carries straight quotes, hyphens, three dots, and a comma
 * that drifted. Measured on War and Peace (audit 2026-08-16): a full
 * transcription of a chunk read as reproduction byte-exact and as clean prose
 * once its punctuation was straightened — across a third of the corpus, and
 * dropping the commas alone was enough on its own. A fold that stops at
 * diacritics therefore lets a photocopy pass as an answer, which is P11's own
 * lesson (one fold, applied to BOTH sides of every containment) arriving one
 * drift class later.
 *
 * The stop is the one mark that is NOT typesetting, and it is kept
 * deliberately. Where a source's sentence ENDS is the source's own structure,
 * and reproducing that boundary is what separates transcribing a passage from
 * extracting a clause out of one: an answer that lifts "Dredging of the
 * channel runs through March" and stops where the source does not has
 * selected something; an answer that runs to the source's full stop and halts
 * there has copied. Both readings are already pinned in holon.test.mjs, one
 * in each direction, and both survive this fold — which a blanket
 * punctuation strip does not (it condemns the extraction).
 *
 * The word rule is not invented here: `\p{L}\p{N}` is exactly the boundary
 * grounding.js's containment index already splits on, so the two organs read
 * "the same words" the same way. Unicode classes, not `[a-z0-9]`, because a
 * Cyrillic or CJK corpus must fold to its words and not to nothing — a fold
 * that silently emptied on another script would make the checks that use it
 * go blind rather than wrong, which is worse (II.13's own scar).
 *
 * Distinct from quotes.js's `normalizedIndex`, deliberately: that fold must
 * keep a map back to the original characters (it addresses bytes) and must
 * keep the difference between "byte equal" and "found under the fold" — that
 * difference IS its verbatim/drifted verdict. This one answers a coarser
 * question, "are these the source's words, in the source's order, to the
 * source's own stops", and can afford to shed everything else. Both stand on
 * foldDiacritics; neither is a second fold of the first's job.
 */
export function foldTypography(s) {
  return foldDiacritics(s)
    .toLowerCase()
    // One canonical stop, however the source or the retyping spelled it —
    // "…" and "..." are the same end of the same sentence.
    .replace(/[.!?…]+/g, " . ")
    // Everything else that is not a letter, a number, or a stop is a boundary.
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  return hear(foldDiacritics(text))
    .toLowerCase()
    // Unicode word/number classes, not `[a-z0-9]` — the same boundary
    // `foldTypography` already splits on, two functions up in this file, and
    // for the same reason (its own header: "a Cyrillic or CJK corpus must
    // fold to its words and not to nothing"). This function had not been
    // brought into line with that precedent: measured live, a real fetched
    // page of Hebrew Talmud (`tokenize("שלום")`) returned `[]`, so `retrieve`
    // — which scores by term overlap on `tokenize`'s own output, on BOTH the
    // question and every chunk's `.terms` — was blind on it in both
    // directions, not merely unranked. `%`/`.`/`-` stay listed: they are
    // this function's own extra allowance (a percent sign, and dots/dashes
    // kept INSIDE a token, below), never `foldTypography`'s job.
    //
    // Disclosed, not silently claimed: this fixes every WHITESPACE-DELIMITED
    // script (Hebrew, Arabic, Cyrillic, Greek, Devanagari, …) — it does not
    // give CJK real word segmentation, because there is no boundary
    // character between adjacent ideographs for a split-on-boundaries
    // tokenizer to find, regardless of which characters count as "word"
    // characters. Checked, not assumed, and it is WORSE than "unsegmented":
    // `tokenize("北京")` — Beijing, a real two-character word — is still
    // `[]`, because the length floor below (`t.length > 2`) drops it the
    // same way it drops a two-letter English word; only a LONGER run of
    // several ideographs (`tokenize("北京大学")`, four characters, "Peking
    // University") survives, as one oversized amalgam token, never a real
    // word boundary. Both facts are pinned in fold.test.mjs rather than
    // implied — real CJK reading needs a dictionary- or model-based word
    // breaker AND a length floor that is not tuned to English, neither
    // attempted here.
    .split(/[^\p{L}\p{N}%.\-]+/u)
    // Dots and dashes are kept inside a token so "12.5" and "hit-and-run"
    // survive, which means the last word of a sentence arrives as "bolo." and
    // matches nothing. Trim them at the edges only.
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    // Short tokens are noise — except numerals, which are form rather than
    // vocabulary and are exactly what a document numbers its own parts with.
    // Without this "chapter ii" cannot find CHAPTER II, and half a book's
    // labels (II, IV, VI, IX, XI) are unaddressable. "i" stays out: it is in
    // the stopword list as a pronoun, which is what it almost always is.
    .filter((t) => (t.length > 2 || isNumeral(t)) && !STOPWORDS.has(t));
}

/** A numeral by shape: digits, or roman. The engine's own test, not a list. */
function isNumeral(t) {
  return /^\d+$/.test(t) || /^[ivxlcdm]+$/.test(t);
}

/**
 * Chunk a document at blank lines, keeping each chunk's byte range in the
 * original string. Ranges are half-open [start, end) and index the exact
 * string readRange is given back, which is what makes a ref re-openable.
 */
/**
 * Container boilerplate, dropped before anything is addressed.
 *
 * READING-POLICY P5.3: "Project Gutenberg front and back matter parses
 * cleanly and will dominate a belief graph with license prose if left in."
 * Measured here on War and Peace: 47 of 11,190 passages were the licence, the
 * donation appeal and the header — retrievable, quotable, citable, and not
 * the book. The offset is carried forward, because a strip that forgot to
 * move it would silently shift every address in the reader (P5.2).
 */
const GUTENBERG_START_RE = /\*\*\*\s*START OF TH(?:E|IS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;


/**
 * Gutenberg plain-text italics markup (`_word_`), stripped so the marker
 * itself never reads as part of a name or a clause boundary.
 *
 * Found live reading the whole of Dracula end to end: 308 occurrences in
 * the raw file, and every one of them was leaking straight into the
 * Entity terrain — `_ Hell`, `_Czarina Catherine_`, `_He_`, `_must_ know`
 * — because CAP_TOKEN and the clause extractor both read the underscore
 * as an ordinary token character, no different from a stray comma before
 * the P50 fix made THAT a declared category instead of an enumeration.
 * Same principle here: strip the MARKUP CONVENTION, name the category
 * (a matched pair of underscores bounding a short run with no underscore
 * or paragraph break inside it), never chase individual italicized words.
 *
 * Length-changing on purpose, like stripContainer's own offset — this
 * runs once, immediately after container-stripping and before ANY
 * sentence-splitting or span-tracking begins, so every downstream offset
 * (splitSentences, extractSurfaces, hypergraph edge spans) is already
 * relative to the stripped text and nothing drifts out of sync with it.
 * An unmatched underscore (no closing partner on the same run) is left
 * alone rather than guessed at — a real, disclosed residue, not chased.
 */
export function stripItalicsMarkup(text) {
  return String(text ?? "").replace(/_([^_\n]{1,200}?)_/g, "$1");
}

export function stripContainer(text) {
  const s = String(text ?? "");
  const start = s.match(GUTENBERG_START_RE);
  const offset = start ? start.index + start[0].length : 0;
  let body = s.slice(offset);
  const end = body.match(/\*\*\*\s*END OF TH(?:E|IS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (end) body = body.slice(0, end.index);
  return { text: body, offset };
}

/**
 * What the container itself says it is — never a guess, never fetched.
 * Gutenberg's own front matter states its Title/Author before the same
 * START marker stripContainer already finds (one regex, not two: the
 * boundary between "header" and "body" is the same question both
 * functions ask). Provenance is the file's own bytes: `ref` addresses
 * exactly the header span this was read from, and `giver` says plainly
 * that this is the SOURCE's declaration, not this instrument's. Scoped to
 * Gutenberg's own convention on purpose — a real, disclosed absence for
 * every other container shape, not a guess dressed as one (identifyMaterial's
 * own `guess: null` discipline, applied to bibliographic identity instead
 * of structural kind).
 *
 * Built 2026-08-26, live-diagnosed cause: S1 named the wrong book and
 * author for Pierre Bezukhov (Dostoevsky's The Brothers Karamazov —
 * this corpus is Tolstoy's War and Peace), and a correction pass that
 * still failed shipped uncorrected because nothing had ever told the
 * model what book this actually is. The fix is not a better check after
 * the fact; it is not making the model guess in the first place.
 */
/**
 * Blank a flattened TABLE region, length-preserving, so a clause extractor
 * never reads its cells as prose.
 *
 * WHAT WENT WRONG, and why this is not a Wikipedia parser. `extractRelations`
 * reads a whitespace connector ACROSS a bare newline on purpose — real
 * hard-wrapped prose (Gutenberg wraps at ~70-80 chars) puts subject and verb
 * on different physical lines, and refusing to cross a newline would lose
 * most of a book. That assumption is simply FALSE inside a table that has
 * been flattened to one cell per line: there the newline is a cell boundary,
 * not a wrap, so the extractor glues the end of one row to the start of the
 * next and manufactures a triple neither row states. Measured on the real
 * fetched Hannibal Hamlin article, whose infobox flattens to:
 *
 *     15th Vice President of the United States
 *     In office
 *     March 4, 1861   - March 4, 1865
 *     President
 *     Abraham Lincoln
 *     Preceded by
 *     John C. Breckinridge
 *     Succeeded by
 *     Andrew Johnson
 *
 * THE CLASS, NOT THE LABELS. Nothing here knows "Preceded by", "In office" or
 * "Succeeded by", and adding them would rebuild `succession.js` — the module
 * this repo condemned precisely because per-site formatting rules cannot
 * generalise (CLAUDE.md, 2026-08-28). What IS general is the FORM: a run of
 * consecutive lines that are short and carry no sentence terminator is a
 * table's cells, whatever language or site produced it, because a sentence
 * that ends without terminal punctuation and fits in a cell is not a
 * sentence. Same discipline as `segments.js`'s heading detector one organ
 * over — a heading is form, not content — and the same discipline
 * `grounding.js::blankStructure` already holds for fenced code: the point is
 * never to UNDERSTAND the region, only to keep a prose reader out of a place
 * where prose is not what is written.
 *
 * DECLARED, NEVER DEFAULTED (P4/P9). `minRun` and `maxCell` are the caller's
 * to state: how many rows make a table, and how long a line can be and still
 * be a cell, are facts about the material a caller is reading, not constants
 * this module gets to pick. There is no default.
 *
 * LENGTH-PRESERVING, and scoped by the caller. Every blanked character is
 * replaced by a space, so the returned string indexes identically to the one
 * handed in and any offset taken against either still names the same place —
 * the same contract `blankStructure` holds. It is the CALLER's job to run
 * this only on an extraction copy: the real bytes must keep reaching
 * citations, retrieval, and the model.
 *
 * WHAT THIS DOES NOT CLAIM. It removes a table from the clause extractor's
 * view; it does not read the table. The facts in that infobox are real and
 * recoverable — by a table reader, which is a different organ (P59's shape
 * recognisers are the live direction). Nothing here has been measured to
 * improve any downstream grounding score, and this docstring is not the
 * place such a claim would be allowed to appear without one.
 */
/**
 * Does this line end a sentence? Terminal punctuation read as a CLASS —
 * Unicode's own terminators plus their closing quotes — never an enumeration
 * of the marks seen so far. P50's rule, which this repo has walked into three
 * times. ONE implementation: `blankLabelRows` and `blankBelowMeasure` both
 * ask it, so a fourth walk-in cannot happen in only one of them.
 */
export const endsASentence = (line) => {
  const t = String(line ?? "").trim().replace(/[\p{Pf}\p{Pe}"'\u2019\u201d]+$/u, "");
  return t.length > 0 && /[.!?\u2026\u3002\uFF01\uFF1F]$/u.test(t);
};

export function blankLabelRows(text, { minRun, maxCell } = {}) {
  if (!Number.isInteger(minRun) || minRun < 2)
    throw new TypeError("blankLabelRows: minRun is declared — how many consecutive cells make a table is the caller's to say, and two is the structural floor (one line is not a run)");
  if (!Number.isInteger(maxCell) || maxCell < 1)
    throw new TypeError("blankLabelRows: maxCell is declared — how long a line can be and still be a cell is a fact about the material, never a constant chosen here");

  const src = String(text ?? "");
  const lines = src.split("\n");
  // A cell: non-empty, short, and not ending a sentence. Terminal punctuation
  // is read as a CLASS (Unicode's own terminators plus their closing quotes),
  // never an enumeration of the marks seen so far — P50's rule, which this
  // repo has now walked into three times.
  const isCell = (line) => {
    const t = line.trim().replace(/[\p{Pf}\p{Pe}"'\u2019\u201d]+$/u, "");
    return t.length > 0 && t.length <= maxCell && !endsASentence(t);
  };

  const out = lines.slice();
  let i = 0;
  while (i < lines.length) {
    if (!isCell(lines[i]) ) { i++; continue; }
    // A run may be separated by blank lines — a flattened table often is.
    let j = i, cells = 0, last = i;
    while (j < lines.length && (lines[j].trim() === "" || isCell(lines[j]))) {
      if (lines[j].trim() !== "") { cells++; last = j; }
      j++;
    }
    if (cells >= minRun) {
      for (let k = i; k <= last; k++) out[k] = " ".repeat(lines[k].length);
    }
    i = j > i ? j : i + 1;
  }
  return out.join("\n");
}

export function declaredIdentity(name, text) {
  const s = String(text ?? "");
  const start = s.match(GUTENBERG_START_RE);
  if (!start) return null;
  const header = s.slice(0, start.index);
  const title = header.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || null;
  const author = header.match(/^Author:\s*(.+)$/m)?.[1]?.trim() || null;
  if (!title && !author) return null;
  return {
    title,
    author,
    giver: "the source file's own declared header",
    ref: `${name}#0-${start.index}`,
  };
}

/**
 * Split one delimited line into cells, walking quotes.
 *
 * This existed twice before it existed once, and the two copies disagreed in
 * exactly the way the reconcile rule predicts: term.js::csvTable walked RFC
 * 4180 quotes but only spoke comma; tables.js::delimitedRows sniffed the
 * delimiter off the bytes but split with String.split, so any quoted cell
 * containing the delimiter burst into two. Measured on the first real dataset
 * the measuring door met (USGS all_month.csv, 10,733 earthquakes): 10,549 of
 * its rows carry a quoted place like "10 km ENE of Coso Junction, CA", and
 * 10,549 rows came out of delimitedRows one or two cells too wide — every
 * column to the right of `place` silently shifted, so a declared measurement
 * of `mag` would have been a measurement of something else. The union of
 * what is right in each copy lives here, in the zero-import module both can
 * reach, and both callers now split with it.
 */
export function splitDelimited(line, delim) {
  const cells = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      // A quote opens a cell only at the cell's start — mid-cell quotes are
      // content (5'9", O'Brien "Bob"), and treating them as delimiter-escapes
      // is how a naive parser eats half a row.
      quoted = true;
    } else if (ch === delim) {
      cells.push(field);
      field = "";
    } else field += ch;
  }
  cells.push(field);
  return cells;
}

/**
 * A whole delimited text as {head, rows}, delimiter read off the bytes.
 *
 * The union of the two former readers, whole: term.js's copy walked quotes
 * across newlines (a quoted cell may legally contain a line break) but only
 * spoke comma; tables.js's copy sniffed comma/tab/semicolon but split on
 * String.split. This walks the whole text with the quote state machine and
 * sniffs the delimiter first — quote-aware, on the first line as a line,
 * because sniffing on raw byte counts would count delimiters inside quoted
 * cells as structure.
 *
 * Returns null when the text is not tabular (fewer than two columns or two
 * lines) — the same contract delimitedRows always had, kept here so both
 * callers refuse the same things.
 */
export function delimitedTable(text) {
  const s = String(text ?? "");
  const firstNl = s.indexOf("\n");
  const firstLine = (firstNl === -1 ? s : s.slice(0, firstNl)).replace(/\r$/, "");
  if (!firstLine.trim()) return null;
  const delim = [",", "\t", ";"]
    .map((d) => ({ d, n: splitDelimited(firstLine, d).length }))
    .sort((a, b) => b.n - a.n)[0];
  if (delim.n < 2) return null;

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let sawQuote = false;
  const endField = () => {
    row.push(sawQuote ? field : field.trim());
    field = "";
    sawQuote = false;
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field.trim() === "") {
      quoted = true;
      sawQuote = true;
      field = "";
    } else if (ch === delim.d) endField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (field !== "" || row.length) endRow();
  if (rows.length < 2) return null;
  return { head: rows[0], rows: rows.slice(1) };
}

/**
 * `boundaries` are the document's own structure, found by form and handed in:
 * `[{ start, end, label }]` in the coordinates of the file as it sits on disk.
 *
 * They are RECEIVED, never discovered here. Finding where one stretch of a
 * source ends is the segments organ's job in the legacy engine, and it earns that
 * boundary from the material's own shape — a short line, followed by a blank
 * line, numbered or roman-numeraled or all-caps, with substance beneath it.
 * This module does not know the word "chapter" and must not learn it: a
 * heading is form, not vocabulary, and a source that numbers its movements or
 * its letters or its exhibits gets segmented exactly as well as a novel does.
 *
 * A passage cut at a blank line is a paragraph and nothing more. A passage cut
 * at a discovered boundary is the unit the document itself claims — which is
 * what a reader means by "the chapter where", and what an address should name.
 */
/**
 * A best guess of WHAT KIND OF THING a piece of material is — never a
 * certainty, always disclosed as a guess, checked magic/structure FIRST and
 * a filename extension only as the last, weakest resort (the same
 * discipline `measure.js::sniffContainer` already states for binary bytes:
 * "a container is named only when its magic is unambiguous... magic is
 * checked BEFORE any text heuristic, always" — reused here for the binary
 * case, not re-derived, so a WAV is named the same way whether it reaches
 * the measuring door or a chat attachment).
 *
 * Requirement, from a live measurement (2026-08-18): a fetched RSS feed of
 * 8 separate posts read, to both a person skimming it and a small model
 * asked to write about it, as one continuous essay — nothing anywhere said
 * what the material actually WAS before its content was read. `chunkSource`
 * carries the result on every chunk as `identity` (never baked into a
 * chunk's own byte-addressed `.text` — the same reason `chunkRows` already
 * keeps a table's column header BESIDE the passage rather than inside it:
 * "splicing them into the text would make the passage disagree with the
 * bytes at its own address"), so whichever passage retrieval actually picks
 * still says what kind of thing it came from — omnimodal by construction,
 * since every chunking path threads the same one field.
 *
 * Ordinary prose (no structural marker, no informative extension) returns
 * `guess: null` on purpose: stating "this is text" on every ordinary
 * attachment would be noise dressed as a finding, and the whole point of a
 * disclosed guess is that it says something only when there IS something
 * worth saying.
 */
export function identifyMaterial(name, text, { bytes } = {}) {
  if (bytes) {
    const container = sniffContainer(bytes);
    if (container) return { kind: `binary:${container}`, guess: `a ${container.toUpperCase()} file`, certainty: "magic" };
  }
  const s = String(text ?? "");
  if (/<rss[\s>]/i.test(s) && /<channel[\s>]/i.test(s))
    return { kind: "feed:rss", guess: "an RSS feed — a syndicated list of separate posts, not one document", certainty: "structure" };
  if (/<feed[\s>]/i.test(s) && /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(s))
    return { kind: "feed:atom", guess: "an Atom feed — a syndicated list of separate posts, not one document", certainty: "structure" };
  if (looksDelimited(name, s)) return { kind: "table", guess: "a delimited table — rows and columns, not prose", certainty: "structure" };
  const trimmed = s.trimStart();
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isParseableJson(trimmed))
    return { kind: "json", guess: "a JSON document", certainty: "structure" };
  if (/^\s*<!doctype html/i.test(s) || /<html[\s>]/i.test(s)) return { kind: "html", guess: "an HTML page", certainty: "structure" };
  const ext = (String(name ?? "").match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  const CODE_EXT = {
    py: "Python", js: "JavaScript", mjs: "JavaScript", ts: "TypeScript", java: "Java",
    rb: "Ruby", go: "Go", rs: "Rust", c: "C", cpp: "C++", sh: "shell script",
  };
  if (CODE_EXT[ext]) return { kind: `code:${ext}`, guess: `${CODE_EXT[ext]} source code`, certainty: "extension" };
  if (ext === "md" || ext === "markdown") return { kind: "markdown", guess: "a Markdown document", certainty: "extension" };
  const declared = declaredIdentity(name, s);
  return declared ? { kind: "prose", guess: null, certainty: "default", declared } : { kind: "prose", guess: null, certainty: "default" };
}

function isParseableJson(s) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

export function chunkSource(name, text, { boundaries, identity, atmosphere, blankFurniture, mergeShortRuns = false } = {}) {
  const chunks = chunkSourceRaw(name, text, { boundaries, identity, atmosphere, mergeShortRuns });
  return blankFurniture ? withPageBlanking(chunks, text, blankFurniture) : chunks;
}

/**
 * Each chunk's own span of a WHOLE-PAGE furniture blanking, attached as
 * `chunk.blanked` — the same characters as `chunk.text`, with furniture
 * turned to spaces, decided with the whole document in view.
 *
 * WHY THIS EXISTS, MEASURED. `blankLabelRows` calls something furniture only
 * when it sees `minRun` CONSECUTIVE cells. Its one consumer
 * (`hypergraph.js::readSentenceText`) applied it to ONE SENTENCE of ONE
 * already-chunked passage, and the median chunk of a real Wikipedia page is
 * 31-72 characters — so a navbox is atomised into one-bullet passages and a
 * run of four can never form. Measured on three real fixtures: blanking as
 * shipped removed 286 / 1157 / 742 characters where blanking the whole page
 * removes 16176 / 14963 / 47098 — 13x to 63x more furniture, and the
 * difference is not the sentence boundary (per-sentence and per-passage agree
 * at 1.000 / 1.000 / 0.852) but the PASSAGE boundary. The evidence for a run
 * lives across chunks, so the decision has to be taken where the page still
 * exists, which is here.
 *
 * `chunk.text` IS NEVER TOUCHED, so every existing address still reads back;
 * this only ever ADDS a parallel copy for extraction to read.
 *
 * THE READBACK GATE, and it is not decoration — it was found by running this
 * against real Gutenberg books. `chunk.text` is `body.trim()` while
 * `start`/`end` span the UNTRIMMED body (chunkProse, above), so a chunk's
 * text is not always `text.slice(start, end)`: 66 of 2,249 Pride and
 * Prejudice chunks carry leading whitespace inside their own span, shifted by
 * up to 34 characters, and 1,218 of 36,837 do in the complete Shakespeare.
 * Slicing the blanked page at `[start, end]` would hand those chunks a window
 * shifted left by exactly that much — and a shifted window has EXACTLY the
 * right length, so a length check cannot see it. Measured against the naive
 * design on Pride and Prejudice: 60 chunks corrupted. So this LOCATES the
 * chunk's own text inside its span and slices the blanked page there.
 *
 * The delimited path is a slice too, not a reconstruction: `chunkRows` takes
 * `body` and strips one trailing newline, so its rows read back and DO
 * receive a copy — an earlier note here claimed they never match, which was
 * an artifact of comparing with strict equality against a span that carries
 * that trailing newline. What is true of them is disclosed in the tests
 * instead: a CSV's rows are short lines without terminal punctuation, so this
 * blanker calls a data table furniture — and did so before this change too,
 * since the whole table lands in one chunk that already met `minRun` on its
 * own.
 *
 * A chunk receives a copy only when that copy is verifiably ITS OWN text with
 * nothing but spaces substituted — same length, every position either
 * identical or blanked. Anything else keeps no `blanked` field and its
 * consumer falls back, unchanged. P5.2's discipline applied to this mechanism
 * itself: a parallel copy that cannot be shown to be the same text is not a
 * parallel copy.
 *
 * WHAT THE PER-CHARACTER CHECK DOES NOT PROVE, stated because it is the
 * gate's one blind spot: it proves the copy differs from this chunk's text
 * only by blanking. It does NOT prove alignment, because a window that is
 * entirely spaces passes every position trivially — which is the intended
 * shape for every navbox row. Alignment rests on locating the text
 * unambiguously, which is why an ambiguous or out-of-range span is refused
 * below rather than resolved by guesswork.
 */
function withPageBlanking(chunks, text, blankFurniture) {
  const src = String(text ?? "");
  let blanked;
  try {
    blanked = blankFurniture(src);
  } catch {
    return chunks; // an organ that throws leaves the chunking exactly as it was
  }
  // Length preservation is the whole premise — without it no offset survives.
  if (typeof blanked !== "string" || blanked.length !== src.length) return chunks;

  return chunks.map((chunk) => {
    const { start, end } = chunk;
    // `slice` reads a negative index from the END of the string, so an
    // out-of-range span would silently address a different region entirely.
    if (!Number.isInteger(start) || !Number.isInteger(end)) return chunk;
    if (start < 0 || end > src.length || start > end) return chunk;
    const raw = src.slice(start, end);
    const own = String(chunk.text ?? "");
    if (!own.length) return chunk; // nothing to align, and indexOf("") is 0
    // Where this chunk's own text sits inside its span (chunkProse trims).
    const at = raw.indexOf(own);
    if (at === -1) return chunk;
    // AMBIGUOUS: the text occurs more than once in its own span, so which
    // occurrence this chunk is cannot be established from the bytes. Every
    // chunker today yields a unique first occurrence (the trim boundary), so
    // this refuses nothing in practice — it is here so that a future chunker
    // which DOES reconstruct its text is refused rather than aligned by luck.
    if (raw.indexOf(own, at + 1) !== -1) return chunk;
    const candidate = blanked.slice(start + at, start + at + own.length);
    if (candidate.length !== own.length) return chunk;
    let differs = false;
    for (let i = 0; i < own.length; i++) {
      // The only licensed difference is a character becoming a space.
      if (candidate[i] === own[i]) continue;
      if (candidate[i] !== " ") return chunk;
      differs = true;
    }
    // Nothing was blanked here, so a copy would be a second identical string
    // retained for every chunk of every source — on a 3.3MB book that is
    // 3.3MB for no benefit. The consumer's own per-sentence blanking still
    // runs, so omitting this changes no reading.
    if (!differs) return chunk;
    return { ...chunk, blanked: candidate };
  });
}

function chunkSourceRaw(name, text, { boundaries, identity, atmosphere, mergeShortRuns } = {}) {
  if (looksDelimited(name, text)) return chunkRows(name, text, identity);
  // The addresses stay true to the file as it sits on disk: the container is
  // skipped, not renumbered.
  const { text: body, offset } = stripContainer(text);
  if (boundaries?.length) return chunkByBoundaries(name, text, boundaries, offset, identity);
  // `atmosphere` is an injected organ bundle (the cast.js pattern — this
  // module stays pure, so the caller hands in the engine functions rather
  // than this file importing packages/engine directly). When absent — every
  // existing caller, unchanged — the blank-line split below runs exactly as
  // it always has. When present, atmosphereBoundaries decides which of the
  // blank-line breaks are REAL regime shifts (signal) versus ordinary
  // typographic noise, and only those become chunk boundaries. See
  // atmosphereBoundaries's own header for why blank lines are still the
  // CANDIDATE set, not replaced.
  if (atmosphere) {
    const discovered = atmosphereBoundaries(name, body, offset, atmosphere);
    if (discovered?.length) return chunkByBoundaries(name, text, discovered, offset, identity);
    // A typed gap (not enough material to license the test, or the organs
    // themselves declined) falls through to the same default below — never
    // a silent empty result where a caller expected chunks.
  }
  if (offset) return chunkProse(name, body, offset, identity, mergeShortRuns);
  return chunkProse(name, text, 0, identity, mergeShortRuns);
}

/**
 * Which blank-line breaks are a real regime shift, and which are noise —
 * decided by the SAME statistical test packages/host/terrains.js already
 * uses to find topic/scene boundaries across a document's chunks
 * (loops/atmosphere.js::readAtmosphere, built on nul/index.js's licensed
 * ground/difference/isGap apparatus: a boundary is only real when the
 * accumulated ground actually FAILS a declared, null-corrected test, never
 * a structural rule dressed as a finding). "Born rule" in that module's own
 * header names precisely what's borrowed from the physics (the collapse-as-
 * measurement structure) and what isn't (no |amplitude|^2 weighting
 * anywhere) — the same honest borrowing applies here, one register down:
 * chunkSource's own blank-line split, which used to BE the final chunk
 * boundary, becomes only the CANDIDATE set a licensed test then filters.
 *
 * Blank lines stay the candidate set rather than something finer (sentences,
 * fixed-width windows) because they are cheap, already computed by
 * chunkProse, and every real boundary this module could ever place has to
 * fall ON one anyway (chunkByBoundaries only ever cuts a passage at a blank
 * line or a supplied boundary — never mid-paragraph). Testing candidates
 * that could never become a boundary regardless of the test's answer would
 * cost real computation for no possible finding.
 *
 * `organs` is `{ causalSurprisalSeries, readAtmosphere, regime }` — the
 * first two imported straight from packages/engine (material.js,
 * loops/atmosphere.js), `regime` the declared `{ window, draws, tolerance,
 * hop }` a caller must supply explicitly (never defaulted here — the same
 * "declared, never a default" discipline atmosphere.js's own header
 * enforces for these exact four numbers). Reuse packages/host/terrains.js's
 * own ATMOSPHERE_REGIME ({ window: 5, draws: 256, tolerance: 3, hop: 5 })
 * rather than re-deriving a second set of numbers for the identical
 * question at a different call site.
 *
 * Returns `null` — a typed "declined", not an empty array standing in for
 * one — when there isn't enough candidate material to license the test at
 * all (readAtmosphere's own MIN_GROUND floor, calibrated at 10x window in
 * atmosphere.js, needs roughly that many paragraphs before it can report
 * anything) or when the organs themselves report a gap for any other
 * reason. The caller (chunkSource) falls back to the ordinary blank-line
 * split in that case — a short paste or a small attachment cannot support
 * a statistical test of its own paragraph breaks, and pretending otherwise
 * would be the exact "manufactured precision" this codebase refuses
 * everywhere else.
 */
export function atmosphereBoundaries(name, body, offset, organs) {
  const { causalSurprisalSeries, readAtmosphere, regime } = organs ?? {};
  if (typeof causalSurprisalSeries !== "function" || typeof readAtmosphere !== "function" || !regime) return null;
  const candidates = chunkProse(name, body, offset, null);
  if (candidates.length < 2) return null;
  const series = causalSurprisalSeries(candidates.map((c) => [...c.terms]));
  const result = readAtmosphere({ material: series, ...regime });
  if (!result || result.gap || !result.regions?.length) return null;
  // readAtmosphere does not return a typed gap when the WHOLE material is
  // too short to ever build a ground at all — it returns one region
  // spanning everything with apertureOpen/apertureClose/opened all null
  // (found live: 8 short candidate paragraphs, window=5, MIN_GROUND=50 —
  // the read loop never executes even once, yet a "successful" one-region
  // result comes back that would silently MERGE all 8 into a single chunk,
  // a real boundary decision this call never actually licensed). A region
  // only reflects a judged ground when its own apertureOpen is non-null;
  // if NONE of the regions ever got one, nothing was tested anywhere in
  // this material and the honest answer is decline, not "merge it all."
  if (!result.regions.some((r) => r.apertureOpen != null)) return null;
  return result.regions
    .map((r) => {
      const first = candidates[r.start];
      const last = candidates[Math.min(r.end, candidates.length) - 1];
      if (!first || !last) return null;
      return { start: first.start, end: last.end, label: null };
    })
    .filter(Boolean);
}

/**
 * One passage per discovered segment, each carrying the label the document
 * gave it. A segment that runs past the reach of one passage is split at
 * paragraph breaks inside itself, and every piece keeps the segment's label so
 * a reader can still tell which chapter a fragment came from — the label
 * travels, the boundary is never invented.
 */
const SEGMENT_MAX_CHARS = 4000;

function chunkByBoundaries(name, text, boundaries, containerOffset, identity) {
  const chunks = [];
  for (const b of boundaries) {
    // Anything before the first boundary is the preamble; the container strip
    // has already dropped what it can, and what remains is still addressable.
    if (b.end <= containerOffset) continue;
    const start = Math.max(b.start, containerOffset);
    const body = text.slice(start, b.end);
    if (body.trim().length < 20) continue;

    if (body.length <= SEGMENT_MAX_CHARS) {
      chunks.push(makeChunk(name, text, start, b.end, b.label, identity));
      continue;
    }
    // Split inside the segment at blank lines, never mid-paragraph: take
    // paragraphs until the next one would overrun the reach, then cut at the
    // last break that still fits. Waiting for a break PAST the limit is how
    // this first went wrong — with paragraphs longer than a fifth of the
    // reach, the next break never arrives and the whole chapter stays one
    // passage.
    const rel = text.slice(start, b.end);
    const breaks = [];
    const re = /\n\s*\n/g;
    let m;
    while ((m = re.exec(rel))) breaks.push({ at: m.index, next: re.lastIndex });
    breaks.push({ at: rel.length, next: rel.length });

    let from = 0;
    let lastFit = null;
    for (const br of breaks) {
      if (br.at - from <= SEGMENT_MAX_CHARS) {
        lastFit = br;
        continue;
      }
      // This break overruns. Cut at the last one that fit; if none did, the
      // paragraph itself is larger than the reach and is kept whole rather
      // than cut mid-sentence.
      const cut = lastFit ?? br;
      chunks.push(makeChunk(name, text, start + from, start + cut.at, b.label, identity));
      from = cut.next;
      lastFit = null;
      if (br.at - from <= SEGMENT_MAX_CHARS) lastFit = br;
    }
    if (from < rel.length) chunks.push(makeChunk(name, text, start + from, b.end, b.label, identity));
  }
  return chunks;
}

function makeChunk(name, text, start, end, label, identity) {
  const body = text.slice(start, end);
  return {
    source: name,
    start,
    end,
    text: body.trim(),
    label: label ?? null,
    ref: `${name}#${start}-${end}`,
    // The label is part of what the passage says it is, so it is searchable
    // too — "chapter xviii" should find the chapter.
    terms: new Set([...tokenize(body), ...tokenize(label ?? "")]),
    // Carried beside the text, never inside it — identifyMaterial's own
    // header states why (the same reason chunkRows keeps a table's column
    // header beside the passage, not spliced into it).
    identity: identity ?? null,
  };
}

function chunkProse(name, text, base, identity, mergeShortRuns = false) {
  const chunks = [];
  const re = /\n\s*\n/g;
  let start = 0;
  let m;
  const push = (from, to) => {
    const body = text.slice(from, to);
    if (body.trim().length < 20) return;
    // Offsets are the file's, not the stripped body's — a ref must read back
    // from the file the reader actually has (READING-POLICY P5.2).
    const start = base + from;
    const end = base + to;
    chunks.push({
      source: name,
      start,
      end,
      text: body.trim(),
      ref: `${name}#${start}-${end}`,
      identity: identity ?? null,
      terms: new Set(tokenize(body)),
    });
  };
  const spans = [];
  while ((m = re.exec(text))) {
    spans.push({ from: start, to: m.index });
    start = re.lastIndex;
  }
  spans.push({ from: start, to: text.length });
  const maxChars = mergeShortRuns.maxChars ?? 1200;
  const shortChars = mergeShortRuns.shortChars ?? 100;
  if (mergeShortRuns && (!Number.isInteger(maxChars) || maxChars < 1 || !Number.isInteger(shortChars) || shortChars < 1))
    throw new TypeError("mergeShortRuns budgets must be positive integers");
  const runs = [];
  for (const span of spans) {
    const short = text.slice(span.from, span.to).trim().length <= shortChars;
    const last = runs.at(-1);
    if (mergeShortRuns && short && last?.short && span.to - last.from <= maxChars) last.to = span.to;
    else runs.push({ ...span, short });
  }
  for (const { from, to } of runs) push(from, to);
  return chunks;
}

/** Rows per addressable passage, unless the rows are long enough to fill it. */
const ROWS_PER_CHUNK = 8;
const ROW_CHUNK_CHARS = 1200;

/**
 * A spreadsheet has no blank lines, so paragraph chunking makes the whole file
 * one passage: nothing can be retrieved from it and nothing in it can be
 * cited. Delimited files are admitted by row instead.
 */
function looksDelimited(name, text) {
  if (/\.(csv|tsv)$/i.test(name)) return true;
  const first = text.slice(0, text.indexOf("\n") + 1 || 400);
  const second = text.slice(first.length, first.length + 400).split("\n")[0];
  const count = (s, ch) => s.split(ch).length - 1;
  for (const ch of [",", "\t", ";"]) {
    const a = count(first, ch);
    if (a >= 3 && a === count(second, ch)) return true;
  }
  return false;
}

/**
 * Row groups, with the byte range covering exactly the rows and nothing else —
 * so a ref still reads back precisely what it names. The header travels beside
 * the passage rather than inside it: the model needs the column names to read
 * the rows, and splicing them into the text would make the passage disagree
 * with the bytes at its own address.
 */
function chunkRows(name, text, identity) {
  const nl = text.indexOf("\n");
  const header = nl === -1 ? text : text.slice(0, nl);
  const headerTerms = tokenize(header);
  const chunks = [];

  let start = nl + 1;
  let rows = 0;
  let cursor = start;
  const flush = (end) => {
    const body = text.slice(start, end);
    if (body.trim()) {
      chunks.push({
        source: name,
        start,
        end,
        text: body.replace(/\n$/, ""),
        header,
        ref: `${name}#${start}-${end}`,
        terms: new Set([...tokenize(body), ...headerTerms]),
        identity: identity ?? null,
      });
    }
    start = end;
    rows = 0;
  };

  while (cursor < text.length) {
    const next = text.indexOf("\n", cursor);
    const lineEnd = next === -1 ? text.length : next + 1;
    rows++;
    if (rows >= ROWS_PER_CHUNK || lineEnd - start >= ROW_CHUNK_CHARS) flush(lineEnd);
    cursor = lineEnd;
  }
  if (cursor > start) flush(cursor);
  return chunks;
}

/** Read a ref back out of the material it addresses. The re-opening. */
export function readRange(sources, ref) {
  const m = String(ref).match(/^(.*)#(\d+)-(\d+)$/);
  if (!m) return null;
  const [, name, from, to] = m;
  const doc = sources[name];
  if (typeof doc !== "string") return null;
  return doc.slice(Number(from), Number(to));
}

/**
 * Mechanical retrieval: score every chunk by how many of the question's own
 * terms it carries, rank, take the top few. There is no relevance floor to
 * pick — a chunk either shares a term with the question or it does not, and a
 * chunk that shares none is simply absent from the result. Nothing is invented
 * to fill the gap and no cutoff is asserted that the material did not supply.
 */
export function retrieve(chunks, question, limit = 3, foldedRefs = []) {
  const qTerms = [...new Set(tokenize(question))];
  if (!qTerms.length) return [];
  const folded = new Set(foldedRefs);
  const scored = chunks
    .map((c) => {
      const hits = qTerms.filter((t) => c.terms.has(t)).length;
      // A passage already folded into an earlier turn's record is
      // deprioritized, not excluded: it has been read once already, and a turn
      // that keeps re-reading the same paragraph is not making progress. Half
      // its own score rather than a fixed subtraction, so the penalty stays
      // proportional to how relevant the passage was in the first place.
      const score = folded.has(c.ref) ? hits / 2 : hits;
      return { chunk: c, hits, score };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.score - a.score || a.chunk.start - b.chunk.start);
  return scored.slice(0, limit).map((s) => s.chunk);
}

/**
 * The MATERIAL block, carrying passage TEXT alone — never an address, never
 * an instruction to cite one. Requirement, stated directly (user,
 * 2026-08-18): the model must have zero idea citations are even happening,
 * let alone be able to write one. Before this, every passage shipped as
 * `[${c.ref}]\n${c.text}` with the instruction "cite the address in
 * brackets exactly as written" — handing the model a working example of
 * this instrument's own address syntax in every single prompt, then asking
 * it to reproduce one. `checkCitations` (below) could only ever verify that
 * a self-reported address EXISTED among what was offered, never that the
 * specific sentence it was stapled to was actually about that passage — a
 * model could staple any real address to any sentence and pass. The
 * correspondence is computed entirely afterward, mechanically, by
 * `attribute()` (cite.js) reading which passage's CONTENT the model's own
 * words actually overlap — the model never needs to see or write the token
 * for that to work, so it never gets the chance to fake one.
 *
 * A chunk's `identity` (identifyMaterial, above) rides ahead of its text
 * exactly the way `header` already does for a tabular chunk's column names
 * — carried beside the passage, never spliced into it, so the address it
 * came from still reads back the bytes exactly as they sit on disk. Shown
 * only when there is something worth saying (identifyMaterial returns
 * `guess: null` for ordinary prose on purpose): the measured failure this
 * closes is a model treating a fetched feed's 8 separate posts as one
 * essay because nothing anywhere said what the material actually was.
 */
/**
 * A source's own name, as a person would say it — never "the material".
 *
 * USER DIRECTION, 2026-08-27: 'i dont like where it says "material offers,
 * material states" — just have it be like "Wikipedia, Retrieved..."'. The
 * reason is measured, not stylistic: a generic scaffolding word is a term
 * of art the model must first decide how to talk about, and tonight a
 * reasoning model was caught doing exactly that out loud, spending real
 * tokens working out that a phrase in its own prompt was not one it was
 * allowed to echo. A real host and a real date are FACTS it can simply
 * relay. Nothing here is invented: the host comes from the chunk's own
 * source name (assigned at fetch, `web:<host>-<i>`) and the date from the
 * fetch record's own `retrievedAt`, so an absent date prints nothing
 * rather than a guessed one.
 */
function sourceFace(chunk) {
  const name = String(chunk?.source ?? "");
  const when = chunk?.identity?.retrievedAt ? String(chunk.identity.retrievedAt).slice(0, 10) : null;
  let who;
  if (name === "web:search-results") who = "Web search results";
  else if (name.startsWith("web:")) who = name.slice(4).replace(/-\d+$/, "");
  else who = name;
  return when ? `${who}, retrieved ${when}` : who;
}

export function buildSourceBlock(chunks) {
  if (!chunks.length) return null;
  // GROUPED BY SOURCE, each named once. Previously every passage sat under
  // one generic "MATERIAL —" banner that also restated what to do with them
  // ("answer from these when they cover the question") — a duty the execute
  // system prompt already states, in the same call, in almost the same
  // words. Saying it twice is not twice as clear; it is one more rule to
  // comply with. Provenance here, duty there, each said once.
  const parts = [];
  const bySource = new Map();
  for (const c of chunks) {
    const key = c.source ?? "";
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(c);
  }
  for (const group of bySource.values()) {
    const bodies = [];
    for (const c of group) {
      const body = c.header ? `columns: ${c.header}\n${c.text}` : c.text;
      const lines = [];
      const d = c.identity?.declared;
      if (d) {
        const fields = [d.title && `Title: ${d.title}`, d.author && `Author: ${d.author}`].filter(Boolean).join(", ");
        lines.push(`(${d.giver} — ${fields} — ${d.ref})`);
      }
      if (c.identity?.guess) lines.push(`(this looks like: ${c.identity.guess})`);
      bodies.push(lines.length ? `${lines.join("\n")}\n${body}` : body);
    }
    parts.push(`${sourceFace(group[0])}:\n${bodies.join("\n\n")}`);
  }
  return parts.join("\n\n");
}

/**
 * Mechanical grounding check. Every bracketed address the answer cites is
 * checked against the addresses actually handed to it this turn; a citation
 * naming material that was never retrieved is unsupported. This is a check on
 * the address, not on the truth of the sentence — which is exactly why it can
 * run without a model.
 */
export function checkCitations(answer, chunks) {
  const offered = new Set(chunks.map((c) => c.ref));
  const cited = [...String(answer).matchAll(/\[([^\]\s]+#\d+-\d+)\]/g)].map(
    (m) => m[1],
  );
  const used = [...new Set(cited.filter((r) => offered.has(r)))];
  const unsupported = [...new Set(cited.filter((r) => !offered.has(r)))];
  return { used, unsupported, cited: [...new Set(cited)] };
}

/**
 * What the turn could not settle. Mechanical: material was retrieved but the
 * answer cited none of it, or no material was retrieved at all for a question
 * that had terms to match on.
 */
export function openQuestions(question, chunks, used) {
  const open = [];
  if (!chunks.length && tokenize(question).length)
    open.push(`no material matched: ${truncateOne(question, 120)}`);
  else if (chunks.length && !used.length)
    open.push(`material retrieved but uncited: ${truncateOne(question, 120)}`);
  return open;
}

function truncateOne(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 3) + "..." : t;
}

/**
 * measureOf(text, { percentile }) — the document's own measure: the line
 * length at a DECLARED percentile of its non-empty lines.
 *
 * This is separated from the blanker on purpose. A measure is a fact about a
 * WHOLE document, and `blankBelowMeasure` may be handed one sentence or one
 * passage — so the caller measures once, over everything it has, and declares
 * the number. An organ that measured its own input would compute a different
 * measure for every chunk and silently mean something different each time.
 *
 * `percentile` is declared, never defaulted (P4): where the measure sits is a
 * choice about how much of a document is expected to be running prose, and a
 * constant chosen here would be that choice made invisibly.
 */
export function measureOf(text, { percentile } = {}) {
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1)
    throw new TypeError("measureOf: percentile is declared — where the measure sits is a claim about the material, never a constant chosen here");
  const lens = String(text ?? "").split("\n").map((l) => l.trim().length).filter((n) => n > 0).sort((a, b) => a - b);
  return lens.length ? lens[Math.floor(percentile * (lens.length - 1))] : 0;
}

/**
 * blankBelowMeasure(text, { measure, fill, minRun }) — blank every line that
 * does not FILL the measure in a run, LENGTH-PRESERVING, so every byte offset
 * into the result is the same offset into the input (P5.2, and the same
 * discipline `blankLabelRows` above already holds).
 *
 * WHY A RUN AND NOT A LINE. Measured (eval/the-fold/results/
 * cross-format-RESULTS.md): a bare length threshold scores F1 0.769 on a
 * document whose paragraphs are single lines and **0.148** on the SAME content
 * hard-wrapped at 72 columns — recall 0.091, one prose line in eleven. Hard
 * wrapping is what a PDF's text layer IS. Wrapping destroys per-line length
 * and PRESERVES the paragraph: a wrapped paragraph is a run of lines at the
 * wrap column ending in a short one, a table is a run of short lines. Asking
 * about the run instead of the line scored 0.936 on that same wrapped
 * rendering, and 0.641 / 0.670 / 0.648 on three real pages where the
 * threshold scored 0.639 / 0.654 / 0.618 — at precision 0.909-0.916 against
 * 0.821-0.915, with junk admitted falling from 73-77% to 8-9%.
 *
 * The short line that ENDS a paragraph is kept by adjacency, which is the
 * whole reason a run is the unit. A LONE filling line is not a paragraph (a
 * wide table row, a long heading) and is blanked.
 *
 * NOTHING HERE IS NAMED. No format, no site, no vocabulary: the measure comes
 * from the caller and everything else is a line's own length relative to it.
 *
 * `fill` and `minRun` are declared. `fill` is what fraction of the measure a
 * line must reach; `minRun` is how many filling lines make a paragraph, and
 * two is the structural floor for the same reason `blankLabelRows` gives —
 * one line is not a run.
 */
export function blankBelowMeasure(text, { measure, fill, minRun } = {}) {
  if (!Number.isFinite(measure) || measure < 0)
    throw new TypeError("blankBelowMeasure: measure is declared — see measureOf, which the caller runs once over the whole document");
  if (!Number.isFinite(fill) || fill <= 0 || fill > 1)
    throw new TypeError("blankBelowMeasure: fill is declared — what fraction of the measure a line must reach is the caller's to say");
  if (!Number.isInteger(minRun) || minRun < 2)
    throw new TypeError("blankBelowMeasure: minRun is declared, and two is the structural floor — one line is not a run");

  const lines = String(text ?? "").split("\n");
  const floor = fill * measure;
  const fills = lines.map((l) => l.trim().length >= floor && l.trim().length > 0);
  const blank = lines.map((l) => l.trim().length === 0);
  // A BLANK LINE DOES NOT BREAK A RUN. Measured, and it was a real defect:
  // computing runs over every line meant that in a real extracted page — where
  // paragraphs are separated by blank lines — no two filling lines were ever
  // adjacent, so the run rule fired almost nowhere and two of three real pages
  // kept 1% of their lines. A blank line separates paragraphs; it does not
  // make each paragraph a lone line.
  const prevFilling = (i) => { for (let j = i - 1; j >= 0; j -= 1) { if (blank[j]) continue; return fills[j]; } return false; };
  const nextFilling = (i) => { for (let j = i + 1; j < lines.length; j += 1) { if (blank[j]) continue; return fills[j]; } return false; };
  const keep = lines.map(() => false);
  for (let i = 0; i < fills.length; i += 1) {
    if (!fills[i]) continue;
    let run = 1;
    if (prevFilling(i)) run += 1;
    if (nextFilling(i)) run += 1;
    if (run < minRun) continue;
    keep[i] = true;
    // The short line that ends the paragraph travels with it — but ONLY if it
    // ends a sentence. Measured while writing this: without that condition the
    // rule cannot tell a paragraph's last line from the FIRST ROW OF A TABLE
    // sitting immediately after it, and admitted `| a | b |` on exactly that
    // arrangement. Requiring a terminator is conservative in the right
    // direction — it can drop a real trailing line that ends mid-thought
    // before a heading, and can never admit a table row.
    for (let j = i + 1; j < fills.length; j += 1) {
      if (blank[j]) continue;
      if (fills[j]) break;
      if (endsASentence(lines[j])) keep[j] = true;
      break;
    }
  }
  // A document with no runs at all — every paragraph a single line, which is
  // the unwrapped case — has nothing for the run rule to find, so filling
  // alone decides. Reported here as the fallback it is rather than returning
  // an empty document.
  const anyRun = keep.some(Boolean);
  return lines.map((l, i) => ((anyRun ? keep[i] : fills[i]) ? l : " ".repeat(l.length))).join("\n");
}
