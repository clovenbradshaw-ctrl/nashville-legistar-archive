/* Verbatim snip — the mechanical answer to a verbatim ask.
 *
 * When the person asks for a work's OWN words ("quote me Shakespeare
 * verbatim", "cite-moi Shakespeare mot pour mot"), the answer is not
 * composed — it is SNIPPED. The mouth must never generate a quotation from
 * its weights: a generated "quote" is an invention wearing a source's name.
 *
 *   VERBATIM SNIP — resolve the named public-domain work against a real
 *   source (Wikisource), cut a bounded passage mechanically, and return it
 *   with its provenance. Deterministic for a fixed source text, free of
 *   model tokens. The only invented words are the fixed FRAME naming the
 *   source and the choice of the default passage when the person names no
 *   passage — both disclosed, never silent.
 *
 * KLEENEUP (2026-09-21): the FINDING in this organ moved off regex and onto
 * the physics primitives (native/kernel/kleene-up.js — Handle: Kleene). The
 * old QUOTE_VERB / EXACTNESS / QUOTE_ME_FRAME / EXACT_TEXT_OF word-class
 * regexes and the QUOTABLE_WORKS `match` regexes are gone; what they did is
 * now MEASUREMENT: single words are measured against the TOKENIZED field
 * (the tokenizer — whitespace/punctuation splitting — is structural grammar,
 * disclosed, and it is what preserves the word-boundary semantics `\b`
 * used to fake), and multi-word phrases are measured as needles in the
 * folded raw field at their byte addresses. Absence is a result. The
 * remaining regexes below are STRUCTURAL and stay, disclosed: `cutSnip`'s
 * scaffolding skip and the positional cut parse the page's grammar — parsing
 * is not finding, and kleeneUp does not claim it.
 *
 * Relation to organs/quotes.js (Handle: Dai): that organ VERIFIES
 * quotations already in an answer against the offered material (verbatim /
 * drifted / unlocated) and repairs drift — a post-hoc audit. This organ is
 * the mirror image, pre-model: a REQUESTED verbatim never reaches the model
 * at all; it is fetched and cut. Dai checks what the mouth wrote; this hand
 * decides what the mouth never needs to write.
 *
 * What this organ does NOT do:
 *   - It never quotes from the model's memory. No source on hand → named gap,
 *     never a guess dressed as a quotation.
 *   - It never serves works still in copyright. The door is public-domain
 *     primary sources only (Wikisource); anything else is a refused gap.
 *   - It never paraphrases the snip. The bytes are the bytes.
 */

import { findNeedles } from "../kernel/kleene-up.js";

// ── the word classes, as NEEDLE SETS (semantic reduction — kleeneUp) ──────
// The single-word needles are measured against the tokenized field, so a word
// boundary is real (a "cite" token is not "cited" or "recite"); the phrase
// needles are measured in the folded raw field at their byte addresses. The
// set below is the same language the old word-class regexes named — EN/FR/DE/
// ES/IT — decomposed mechanically, never invented. Falsified 2026-09-17:
// English-only fired first; the works stay proper nouns and only the intent
// frames needed widening. A language not covered still falls through —
// disclosed, and the unwired-work refusal below is the backstop against
// invention, never a generated quotation.
const QUOTE_VERB_WORDS = Object.freeze([
  "quote", "quoting", "recite", "cite", "citez", "zitat", "cita", "citación",
  "zitier", "zitiere", "citazione",
]);
const QUOTE_VERB_PHRASES = Object.freeze([
  "quote me", "quote us", "recite me", "read me", "cite-moi", "cite moi",
  "zitier mir", "citame", "cítame", "citami",
]);

const EXACTNESS_WORDS = Object.freeze([
  "verbatim", "exact", "exactly", "original", "actual", "wörtlich", "wortwörtlich",
]);
const EXACTNESS_PHRASES = Object.freeze([
  "word for word", "word-for-word", "exact words", "exact text", "exact lines",
  "original words", "original text", "original lines", "actual words",
  "as he wrote", "as she wrote", "as they wrote", "as shakespeare wrote",
  "mot pour mot", "mot pôur mot", "texte exact", "texte original",
  "exakte text", "exakte worte", "exakte zeilen",
  "exakten text", "exakten worte", "exakten zeilen",
  "exakter text", "exakter worte", "exakter zeilen",
  "palabra por palabra", "texto exacto", "texto original",
  "parola per parola", "testo esatto", "testo originale",
]);

// A quote-me frame ALONE fires (no exactness marker required).
const QUOTE_ME_FRAME_PHRASES = Object.freeze([
  "quote me", "quoting me", "cite-moi", "zitier mir", "cítame", "citami",
]);

// The exact-text-of frame: the words-of ask — "the exact text of X".
const EXACT_TEXT_OF_PHRASES = Object.freeze([
  "exact text of", "exact words of", "exact lines of", "exact passage of",
  "original text of", "original words of", "original lines of", "original passage of",
  "full text of", "full words of", "full lines of", "full passage of",
  "texte exact de", "texte original de",
  "texto exacto de", "texto original de",
  "testo esatto di", "testo originale di",
]);

// The tokenizer — STRUCTURAL grammar (splitting the field into words), stays.
// It is what gives the single-word needles their real boundaries.
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;
const tokensOf = (t) => String(t).toLocaleLowerCase("en-US").split(TOKEN_SPLIT).filter(Boolean);
const hasWord = (tokens, word) => tokens.includes(word);
const hasAnyWord = (tokens, words) => words.some((w) => hasWord(tokens, w));
const hasAnyPhrase = (folded, phrases) =>
  findNeedles(folded, phrases, { all: false }).counted.found > 0;

// Works this organ can reach mechanically today: public-domain authors whose
// primary texts live on Wikisource. The map is deliberate and small — a work
// is added by wiring its source, never by letting the model reach for one.
// Each work is a NEEDLE (measured at its byte address in the ask), not a
// pattern: "shakespeare" is found, never /shakespeare/i'd.
export const QUOTABLE_WORKS = Object.freeze([
  { needles: ["shakespeare"], author: "William Shakespeare", wikisource: "William Shakespeare" },
  { needles: ["hamlet"], author: "William Shakespeare", wikisource: "Hamlet" },
  { needles: ["macbeth"], author: "William Shakespeare", wikisource: "Macbeth" },
  { needles: ["sonnet"], author: "William Shakespeare", wikisource: "Shakespeare's Sonnets" },
]);

// The disclosed default: the person named an author but no passage. The
// choice is pinned here — in the open, reproducible — never a model's pick.
export const DEFAULT_PASSAGE = Object.freeze({
  work: "Sonnet 18",
  author: "William Shakespeare",
  wikisource: "Shakespeare's Sonnets (1883)/Sonnet 18",
  basis: "you named no particular lines, so this is the pinned default — name a play, sonnet, or speech and those words are what gets snipped",
});

// Wikisource scaffolding that is never the verse: nav arrows, catalog
// id-lines, version lists, disambiguation frames, sister-project footers.
// Measured live: the pinned default first resolved to a versions page and
// the snip quoted the version list instead of the sonnet — so the cut
// skips these lines mechanically before cutting, never by meaning.
// STRUCTURAL (parsing the page's grammar) — disclosed, and kleeneUp leaves
// it: parsing is not finding.
const BOILERPLATE_RES = [
  /^[←→]$/,
  /^for other versions of this work/i,
  /^versions of .* include/i,
  /may refer to:?\s*$/i,
  /disambiguation page/i,
  /^works entitled/i,
  /^search for titles/i,
  /^sister projects/i,
  /^in the collected/i,
  // Edition nav between sibling pieces (Sonnet 17 / Sonnet 19 flanking the
  // verse) — never the asked-for words.
  /^(sonnet|chapter|section|part)\s+\d+$/i,
  /\(ed\.\) by/i,
  /edited by/i,
  // A version-list entry: a quoted title reprinted "in" some collection,
  // or a bare catalog line trailing a year — the versions page's own rows.
  /^"[^"]*"?,?\s+in\s+/i,
  /\(\s*\d{4}\s*\)\s*$/,
  /,\s*by\s+[A-Z]/,
  /^\d{5,}\s/,
  /\b\d{5,}\b.*—.*\b(1[6-9]|20)\d{2}\b/,
];

const isBoilerplate = (line) => {
  const l = String(line ?? "").trim();
  if (!l || l.length <= 2) return true;
  return BOILERPLATE_RES.some((re) => re.test(l));
};

export const MAX_SNIP_CHARS = 600;

// The passage-named check: fixed phrases are NEEDLES (to be / shall i
// compare); the sonnet/act/scene + number coupling is token grammar
// (STRUCTURAL, disclosed) — a digit token measured right after the name.
const PASSAGE_PHRASES = Object.freeze(["to be", "shall i compare"]);
const PASSAGE_WORDS = Object.freeze(["hamlet", "macbeth", "act", "scene"]);
const namesPassage = (tokens, folded) =>
  hasAnyWord(tokens, PASSAGE_WORDS) ||
  hasAnyPhrase(folded, PASSAGE_PHRASES) ||
  // sonnet/act/scene followed by a numeral — token grammar, structural.
  (tokens.includes("sonnet") && /^\d+$/.test(tokens[tokens.indexOf("sonnet") + 1] ?? ""));

/**
 * Detect a mechanical-snip ask. Returns `{ work, defaulted }` or null.
 * `work` is the QUOTABLE_WORKS entry the snip should be cut from;
 * `defaulted` is true when the person named an author but no passage, so
 * the caller must disclose the pinned default.
 */
export function snipShape(task) {
  const t = String(task ?? "").trim();
  if (!t) return null;
  const folded = t.toLocaleLowerCase("en-US");
  const tokens = tokensOf(t);
  const wantsQuote =
    (hasAnyWord(tokens, QUOTE_VERB_WORDS) || hasAnyPhrase(folded, QUOTE_VERB_PHRASES)) &&
    (hasAnyWord(tokens, EXACTNESS_WORDS) || hasAnyPhrase(folded, EXACTNESS_PHRASES)) ||
    hasAnyPhrase(folded, QUOTE_ME_FRAME_PHRASES) ||
    hasAnyPhrase(folded, EXACT_TEXT_OF_PHRASES);
  if (!wantsQuote) return null;
  const work =
    QUOTABLE_WORKS.find((w) => findNeedles(folded, w.needles, { all: false }).counted.found > 0) ?? null;
  if (!work) {
    // A verbatim ask for a work with no wired source: not ours to serve.
    // The caller names the gap (no_source_wired) — never a model "quote".
    return { work: null, defaulted: false, gap: "no_source_wired" };
  }
  return { work, defaulted: !namesPassage(tokens, folded), gap: null };
}

/**
 * Cut a bounded passage mechanically from fetched source text. The cut is
 * positional (the opening verse lines), never semantic — no model chooses
 * "the best part". Wikisource scaffolding (nav, catalog ids, version lists)
 * is skipped by fixed patterns first. Returns `{ snip, chars, longest,
 * basis }` — `longest` is the longest kept line, so the caller can tell a
 * versions/disambiguation page (no long lines, nothing to quote) from the
 * verse and keep hunting instead of snipping the scaffolding.
 */
export function cutSnip(sourceText, { maxChars = MAX_SNIP_CHARS } = {}) {
  const text = String(sourceText ?? "").replace(/\r/g, "").trim();
  if (!text) return { snip: "", chars: 0, longest: 0, basis: "empty source — nothing to cut" };
  // Skip scaffolding head-matter (title/author lines) up to the first long
  // line, then cut at a line boundary under the budget.
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => !isBoilerplate(l));
  if (!lines.length) return { snip: "", chars: 0, longest: 0, basis: "only scaffolding — nothing quotable" };
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    if (lines[i].length > 60) { start = i; break; }
  }
  let acc = "";
  for (let i = start; i < lines.length; i++) {
    const next = acc ? `${acc}\n${lines[i]}` : lines[i];
    if (next.length > maxChars) break;
    acc = next;
  }
  const snip = acc || lines.slice(start, start + 1).join("\n").slice(0, maxChars);
  const longest = snip.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  return { snip, chars: snip.length, longest, basis: `positional cut: opening lines from line ${start + 1}, ${snip.length} chars — no selection by meaning` };
}

/**
 * Format the snipped verbatim for display. The ❝ markers and the provenance
 * line are the VISUAL contract: a reader can tell at a glance this block was
 * snipped from a source, not written by the model.
 */
export function formatQuote({ snip = "", title = "", author = "", url = "" } = {}) {
  const lines = String(snip).trim().split("\n");
  const body = lines.map((l) => `❝ ${l}`).join("\n");
  const credit = `— ${author ? `${author}, ` : ""}${title}`.trim();
  const provenance = url
    ? `[snipped verbatim — non-model prose · source: ${url}]`
    : `[snipped verbatim — non-model prose]`;
  return `${body}\n${credit}\n${provenance}`;
}