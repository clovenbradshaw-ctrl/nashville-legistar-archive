// fold-chat-junk.js — the junk gate and the wall check. Pure: no DOM, no IO, no model, no clock.
//
// A snip is the page's OWN words, shown under the creator's name. A verbatim snip of the page's menu, its cookie banner,
// its bot-wall or its "this listing has expired" notice is still a wrong answer: it is the site talking about itself.
// This module is the one place that says so, so every rung of the ladder (declared block, meta description, impression,
// baseline, a Wikipedia lead) is judged by the same rule BEFORE a snip is shown, and when everything is junk the person
// gets a typed gap (never the junk, never a model's guess in its place).
//
//   unitsOf / classifyUnit   a UNIT is a run between sentence stops, line breaks, ellipses and ' | '; a long unit is cut into
//                            windows (a menu dump has no stops). A unit is CHROME when (L) the declared multilingual phrases of
//                            fold-chat-junk-lexicon.js cover >= COVER of its letters, (S) it is a stopless run (a long run with
//                            almost no function words and no sentence stop; not code), or (T) a title-case run (Latin, Cyrillic,
//                            Greek only). (S) and (T) look at the tokens the lexicon did not already explain and skip key:value data.
//   junkOf(text)             junk = dominated by chrome (>= DOMINATED of the word tokens) or leads with chrome (one of the first
//                            LEAD_UNITS units of >= LEAD_MIN tokens), or markup text, or hollow (labels with no values).
//   gateSnips(snips)         keep the snips that pass; a typed gap when none do.
//   wallOf({status,title,text})  is this a wall (a block, a captcha, an expiry, a gate, a waiting room, a consent wall)? A wall
//                            page yields NO snip: { kind:'gap', gap:'blocked', reason }.
//   verifyJoined(pieces,hay) a snip assembled from non-contiguous pieces is re-verified AFTER joining: every piece must be on the
//                            page; pieces that are not are dropped; the rest are shown as separate quoted pieces with ellipses.
//
// DECLARED, NOT MEASURED (Constitution II.11 — each with its giver): every threshold in JUNK is the author's. The unit rules and
// numbers (DOMINATED..TITLE_SHARE) were fixed in docs/SNIP-JUNK-PREREG.md before the swarm cache was re-scored and are the same
// as eval/swarm/junk-judge.mjs; the gate ADDS to the judge (STRONG phrases, the punctuation guard on stopless runs, the fragment
// rule, markup, hollowness, the wall check), each added after reading the first audit and listed in the prereg's results. The phrase
// lists are data in fold-chat-junk-lexicon.js. Case is folded, never matched (no capital-letter class appears); the one use of capitals
// (the title-case run) is gated on the script, where capitals mark names.
import { CHROME, STRONG, WALL, WALL_WEAK } from "./fold-chat-junk-lexicon.js";
import { segments, scriptOf, isUnspaced, capitalisationIsSignificant, fold } from "./fold-chat-mind.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const JUNK = Object.freeze({
  DOMINATED: 0.5, LEAD_MIN: 3, LEAD_UNITS: 2, WINDOW: 40, STEP: 20, COVER: 0.4, STOPLESS_MIN: 12, FW_MAX: 0.1, CODE_SYMBOLS: 0.06, TITLE_SHARE: 0.6,
  // walls: a wall's own text is short; a long page that merely mentions a captcha in a footer is not a wall.
  WALL_SHORT: 2500,      // chars of visible text under which any wall phrase makes the page a wall
  WALL_LEAD: 240,        // chars of the opening text whose first unit is read for a wall notice
  WALL_LEAD_COVER: 0.4,
  WALL_NEAR: 600,         // chars from the top of a short page within which a (non-weak) wall phrase is a notice, not a mention
  WALL_SHORT_COVER: 0.08, // a short page is a wall when the wall phrases cover this share of its letters (a passing mention of a captcha covers ~0.02)  // share of the title / first unit's letters the wall phrases must cover for it to be a notice
  WALL_PROSE_SHARE: 0.25, // ...and under this share of the page's text (a short page that is all prose is a short page, not a wall)
  WALL_PROSE: 400,       // a page whose prose (non-chrome text) is under this many chars, and that is mostly chrome, shows nothing
  SENTENCE_MIN: 6,       // a passage holds a unit of at least this many word tokens (a label or a date line is not a passage)
  SENTENCE_CJK: 12,      // ...or, in an unspaced script, this many characters
  STRONG_MAX: 40,        // a unit this short (word tokens) that holds one STRONG phrase is chrome
  HOLLOW_MIN: 30,        // a declared block with fewer than this many chars of VALUES (after labels) is a hollow template
});

const FW = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
// a phrase needs >= 3 characters, or >= 2 in an unspaced script (a Han or Kana word can be two characters)
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const phrases = (lex) => [...new Set(Object.values(lex).flat().map(fold))].filter((p) => p.length >= 3 || (p.length >= 2 && CJK.test(p))).sort((a, b) => b.length - a.length);
const CHROME_P = phrases(CHROME), STRONG_P = phrases(STRONG), WALL_P = phrases(WALL), WALL_ALL_P = phrases({ a: [...Object.values(WALL).flat(), ...Object.values(WALL_WEAK).flat()] });
const isLetter = (ch) => /[\p{L}\p{N}]/u.test(ch);
const letters = (s) => (s.match(/[\p{L}\p{N}]/gu) || []).length;
const BAD_HTTP = (s) => Number.isFinite(+s) && +s >= 400;

/** Units of a text: runs between line breaks, ellipses, ' | ' and sentence stops (a stop is . ! ? 。！？ followed by space, so
 *  4.97 and 3.5 stay whole; a stop after a known abbreviation does not end a unit). */
const ABBREV = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|nos|fig|figs|eq|inc|ltd|co|corp|mt|ave|gen|col|capt|lt|sgt|rev|vol|vols|pp|ca|approx|est|dept|univ|e\.g|i\.e|cf|al)\.$/iu;
/** Does this text END on an abbreviation or a lone initial, so its final "." is not a sentence stop? */
export const endsWithAbbreviation = (t) => { const x = String(t ?? "").replace(/["')\]”’]+$/u, ""); return ABBREV.test(x) || /(?:^|[\s(])\p{Lu}\.$/u.test(x); };
export function unitsOf(text) {
  const out = [];
  for (const line of String(text ?? "").split(/\n+|\s…\s|…|\s\|\s/u)) {
    let cur = "";
    for (const piece of line.split(/(?<=[.!?。！？]["')\]”’]*)\s+(?=\S)/u)) {
      cur = cur ? cur + " " + piece : piece;
      const t = cur.trim();
      if (/\.["')\]”’]*$/u.test(t) && endsWithAbbreviation(t)) continue;   // 'Fig.' / 'Dr.' / 'J.' do not end a unit
      if (t) out.push(t);
      cur = "";
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
function windowsOf(u) {
  const segs = segments(u); if (segs.length <= JUNK.WINDOW) return [u];
  const out = []; for (let i = 0; i < segs.length; i += JUNK.STEP) out.push(u.slice(segs[i].start, segs[Math.min(i + JUNK.STEP, segs.length) - 1].end));
  return out;
}
/** Characters of `f` (already folded) inside any hit of `list`; returns a 0/1 mask. */
function maskOf(f, list) {
  const mark = new Uint8Array(f.length);
  for (const p of list) { let at = 0; while ((at = f.indexOf(p, at)) >= 0) { mark.fill(1, at, at + p.length); at += p.length; } }
  return mark;
}
/** One unit: is it chrome, and why. { chrome, why, n, cov } */
export function classifyUnit(u, { prose = true } = {}) {
  const script = scriptOf(u); const toks = segments(u, script); const n = toks.length;
  const f = fold(u); const mark = maskOf(f, CHROME_P);
  let c = 0; for (let i = 0; i < f.length; i++) if (mark[i] && isLetter(f[i])) c++;
  const cov = c / (letters(f) || 1);
  if (cov >= JUNK.COVER) return { chrome: true, why: "lexicon", n, cov };
  if (n <= JUNK.STRONG_MAX && STRONG_P.some((p) => f.includes(p))) return { chrome: true, why: "strong-phrase", n, cov };
  // tokens the lexicon did not already explain
  const free = []; let pos = 0;
  for (const t of toks) { const ft = fold(t.text); const at = f.indexOf(ft, pos); if (at < 0) { free.push(t); continue; } pos = at + ft.length; if (!mark[at]) free.push(t); }
  const kv = (u.match(/[\p{L}]+:\s/gu) || []).length >= 2;
  if (prose && !isUnspaced(script) && free.length >= JUNK.STOPLESS_MIN - 4 && n >= JUNK.STOPLESS_MIN && !kv) {
    const fw = free.filter((t) => FW.has(fold(t.text))).length / free.length;
    const stops = /[.!?。！？](?=\s)/u.test(u.replace(/[.!?]+$/u, ""));
    // a stopless RUN carries no punctuation at all: a menu has none, prose in a language with no function-word list (German,
    // Dutch, Polish...) always has a comma or a stop, so it is never mistaken for one
    const punctuated = /[,;:.!?。！？、，]/u.test(u);
    const sym = (u.match(/[{}()<>=;$\\[\]]/g) || []).length / u.length;
    if (fw < JUNK.FW_MAX && !stops && !punctuated && sym < JUNK.CODE_SYMBOLS) return { chrome: true, why: "stopless", n, cov };
    if (capitalisationIsSignificant(script) && !stops) {
      const cap = free.filter((t) => /^[\p{Lu}\p{N}]/u.test(t.text)).length / free.length;
      if (cap >= JUNK.TITLE_SHARE) return { chrome: true, why: "titlecase", n, cov };
    }
  }
  return { chrome: false, why: "", n, cov };
}

/** Markup that leaked into text: tags, attribute assignments, escaped tags, template placeholders. */
export function hasMarkup(text) {
  const t = String(text ?? "");
  return /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?>/iu.test(t) || /&lt;\/?[a-z]/iu.test(t) || /\b(?:width|height|frameborder|scrolling|class|style|href|src)=["']/iu.test(t) || /\{\{|\}\}|\[#\w+#\]|<\?php/iu.test(t);
}
/** A declared block whose fields have no values ("Starts: 2026-10-05 / Where:") shows nothing. */
export function isHollow(text) {
  const lines = String(text ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  const labelOnly = (l) => /^[\p{L} ]{1,20}:\s*$/u.test(l);
  const values = lines.filter((l) => !labelOnly(l)).map((l) => l.replace(/^[\p{L} ]{1,20}:\s*/u, "")).join(" ");
  const dateOnly = values.replace(/[\d\-/:.TZ+ ]/g, "").length === 0;
  return values.length < JUNK.HOLLOW_MIN || (dateOnly && lines.length <= 3);
}

/** Does this text hold at least one SENTENCE: a unit of >= SENTENCE_MIN word tokens that ends on a stop or carries function words
 *  (spaced scripts); for unspaced scripts, a unit of >= SENTENCE_CJK characters. A label, a date line or a table header is a
 *  fragment, not a passage. */
export function hasSentence(text) {
  for (const u of unitsOf(text)) {
    const script = scriptOf(u), toks = segments(u, script);
    if (isUnspaced(script)) { if (letters(u) >= JUNK.SENTENCE_CJK) return true; continue; }
    const words = toks.filter((t) => /\p{L}/u.test(t.text));
    if (words.length < JUNK.SENTENCE_MIN) continue;
    const fw = words.filter((t) => FW.has(fold(t.text))).length / words.length;
    if (fw >= 0.1 || /[.!?]["')\]”’]*$/u.test(u)) return true;
  }
  return false;
}

/** { junk, dominated, leading, markup, hollow, share, n, reason } */
export function junkOf(text, { declared = false } = {}) {
  const t = String(text ?? "");
  // A DECLARED block (recipe, how-to, FAQ, event) is lists and fields, not prose: only the lexicon, markup and hollowness judge it.
  const us = unitsOf(t).flatMap((u) => windowsOf(u).map((w) => ({ w, ...classifyUnit(w, { prose: !declared }) })));
  const total = us.reduce((a, u) => a + u.n, 0) || 0;
  const ch = us.filter((u) => u.chrome).reduce((a, u) => a + u.n, 0);
  const head = us.filter((u) => u.n >= JUNK.LEAD_MIN).slice(0, JUNK.LEAD_UNITS);
  const leading = head.some((u) => u.chrome), dominated = total > 0 && ch / total >= JUNK.DOMINATED;
  const markup = hasMarkup(t), hollow = declared && isHollow(t), empty = total === 0;
  const fragment = !declared && !empty && !hasSentence(t);
  const reason = empty ? "empty" : markup ? "markup" : hollow ? "hollow" : fragment ? "fragment" : leading ? "leads-with-chrome" : dominated ? "dominated-by-chrome" : "";
  return { junk: !!reason, dominated, leading, markup, hollow, fragment, share: total ? +(ch / total).toFixed(3) : 0, n: total, reason };
}

/** The gate. `snips` are { text, ... } (any shape with a text); returns { shown, junk:[{snip,reason}], gap }.
 *  `gap` is a typed app-authored gap when snips existed and none passed (never the junk, never a model). */
export function gateSnips(snips, { declaredKinds = ["recipe", "howto", "faq", "qa", "Event", "JobPosting", "Product"] } = {}) {
  const shown = [], junk = [];
  for (const s of Array.isArray(snips) ? snips : []) {
    const j = junkOf(s?.text, { declared: declaredKinds.includes(s?.kind) || s?.rung === "a" });
    if (j.junk) junk.push({ snip: s, reason: j.reason }); else shown.push(s);
  }
  const gap = !shown.length && junk.length ? { kind: "gap", gap: "junk", reason: "everything this page offered was the site talking about itself (menus, banners, notices), not its content" } : null;
  return { shown, junk, gap };
}

// ── walls ──────────────────────────────────────────────────────────────────
const hit = (f, list) => { for (const p of list) if (f.includes(p)) return p; return ""; };
/** Is this a wall instead of the page asked for? input: the HTTP status (if known), the page title, the VISIBLE text (scripts and
 *  styles already removed). A wall yields no snip. { blocked, kind, reason } — the reason is plain words for the person. */
export function wallOf({ status = 0, title = "", text = "" } = {}) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (BAD_HTTP(status)) {
    const s = +status;
    const what = s === 404 || s === 410 ? "the page is gone (it moved or expired)" : s === 429 ? "the site is limiting how fast pages can be read" : s === 401 || s === 403 ? "the site refused to show this page to an automated reader" : "the site returned an error";
    return { blocked: true, kind: "http", reason: `${what} (HTTP ${s})` };
  }
  const f = fold(t), ft = fold(title);
  // The opening of the page (its title, or its first unit) is a wall notice when declared wall phrases cover a good share of it:
  // "Access Denied" is all notice; "How to fix page not found errors on your site" is an article ABOUT one.
  const leadUnit = fold(unitsOf(t.slice(0, JUNK.WALL_LEAD))[0] || "");
  const covers = (x, share = JUNK.WALL_LEAD_COVER, list = WALL_P) => { if (!x) return false; const m = maskOf(x, list); let c = 0; for (let i = 0; i < x.length; i++) if (m[i] && isLetter(x[i])) c++; return c / (letters(x) || 1) >= share; };
  if (covers(ft) || covers(leadUnit)) return { blocked: true, kind: "wall-lead", reason: "the page opens with a block, gate or expiry notice instead of its content" };
  if (t.length <= JUNK.WALL_SHORT) {
    // a wall phrase near the top of a short page is a notice; one buried in the middle, or a weak word, must cover a real share
    const near = hit(f.slice(0, JUNK.WALL_NEAR), WALL_P);
    if (near || covers(f, JUNK.WALL_SHORT_COVER, WALL_ALL_P)) return { blocked: true, kind: "wall-short", reason: "the page is a short block, gate or expiry notice, not the content asked for" };
  }
  // a consent / login / nav page with almost no prose of its own
  const prose = unitsOf(t).flatMap(windowsOf).filter((u) => !classifyUnit(u).chrome).join(" ");
  if (t.length && prose.length < JUNK.WALL_PROSE && prose.length < t.length * JUNK.WALL_PROSE_SHARE && t.length <= JUNK.WALL_SHORT * 2) return { blocked: true, kind: "no-content", reason: "the page shows no readable content here (only menus or notices)" };
  return { blocked: false, kind: "", reason: "" };
}

// ── stitched snips ─────────────────────────────────────────────────────────
const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Re-verify a snip assembled from pieces, after joining. `hay` is the page text the snip claims to come from.
 *  Returns { ok, pieces (verified, in order), dropped (not on the page), text (the pieces joined with ' … ') }.
 *  A piece is verbatim when its whitespace-squashed text occurs in the whitespace-squashed page; the join itself adds only
 *  the ellipsis, which is never page text. Pieces with leaked markup are dropped too. */
export function verifyJoined(pieces, hay) {
  const h = squash(hay);
  const kept = [], dropped = [];
  for (const p of Array.isArray(pieces) ? pieces : []) {
    const q = squash(p);
    if (!q) continue;
    if (h.includes(q) && !hasMarkup(q)) kept.push(q); else dropped.push(q);
  }
  return { ok: kept.length > 0 && dropped.length === 0, pieces: kept, dropped, text: kept.join(" … ") };
}
/** The pieces of an already-joined text (split at the ellipsis the join added, or at line breaks). */
export const piecesOf = (text) => String(text ?? "").split(/\n+|\s…\s|…|\s\.\.\.\s/u).map(squash).filter(Boolean);
