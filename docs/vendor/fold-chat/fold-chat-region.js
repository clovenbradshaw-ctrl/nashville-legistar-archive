// fold-chat-region.js — where a page's CONTENT is, so sentence scoring starts after the nav and header region. Pure: no DOM
// (a small tolerant tag parser), no IO, no model.
//
// The old ladder scored sentences from the top of the page's text, so the first thing a snip found was the menu, the consent
// banner, the sign-in links. This module takes raw HTML and returns the text of the CONTENT region:
//   1. parse the tags into a tree (void elements, implied ends of p/li/td, scripts and styles skipped whole);
//   2. choose the scope: the longest <main> / role=main, else the longest <article>, else <body>;
//   3. drop subtrees that are not content — nav, header/footer/aside (outside the scope's own article), dialogs, forms' buttons,
//      hidden nodes, ARIA landmarks banner/navigation/contentinfo/complementary/search, and elements whose id/class TOKENS name
//      a menu, a cookie or consent notice, a newsletter, a share bar, an ad, a breadcrumb — unless dropping would remove most of
//      the page's text (a class like "has-sidebar" on a wrapper is not a sidebar);
//   4. cut the rest into text BLOCKS at block-level tags, measuring each block's link density and chrome share;
//   5. drop boilerplate blocks (mostly links and short; or dominated by chrome by fold-chat-junk.js `junkOf`);
//   6. find where the content STARTS: the first block that is prose (a long block with a sentence stop) followed by another, or
//      the longest block when there is no prose run (a listing, a table page). Nothing before it is scored.
//
// Entity decoding is the numeric forms plus a small named set; other named entities are left as the page wrote them (never
// guessed). Every returned text is a whitespace-squashed concatenation of the page's own text nodes: nothing is added.
import { junkOf } from "./fold-chat-junk.js";
import { segments, scriptOf, isUnspaced, fold } from "./fold-chat-mind.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

// Declared, not measured (Constitution II.11 — author's, fixed in docs/SNIP-JUNK-PREREG.md):
export const REGION = Object.freeze({
  linkHeavy: 0.5,        // a block with more than this share of link text is a menu...
  linkShortWords: 20,    // ...when it is also shorter than this many words
  proseWords: 12,        // a prose block has at least this many words
  proseFw: 0.15,         // ...and at least this share of function words (spaced scripts)
  keepIfShare: 0.5,      // a class/id-named drop is refused when it holds more than this share of the page's text
  runWords: 25,          // a prose block this long stands alone; a shorter one counts only beside another prose block
  maxChars: 40000,       // the region text the ladder scores
  maxBlocks: 2000,
});

const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const SKIP_BODY = new Set("script style noscript template svg iframe head canvas object embed select textarea".split(" "));
const DROP_TAGS = new Set("nav dialog button".split(" "));
const DROP_OUTSIDE = new Set("header footer aside".split(" "));
const DROP_ROLES = new Set("banner navigation contentinfo complementary search dialog alertdialog menu menubar".split(" "));
const DROP_TOKENS = new Set("nav navbar navigation menu menus submenu breadcrumb breadcrumbs cookie cookies consent gdpr cmp banner modal popup popover overlay newsletter subscribe subscription sidebar footer masthead topbar skip share sharing social advert adverts advertisement ads ad promo paywall signin login signup toc".split(" "));
const BLOCK = new Set("address article aside blockquote body dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td tfoot th thead tr ul br".split(" "));
const IMPLIED = { p: new Set("p"), li: new Set("li"), dt: new Set("dt dd"), dd: new Set("dt dd"), tr: new Set("tr td th"), td: new Set("td th"), th: new Set("td th"), option: new Set("option") };
const NAMED = { nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };

const decode = (s) => String(s ?? "").replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCp(parseInt(h, 16), m)).replace(/&#(\d+);/g, (m, d) => safeCp(+d, m)).replace(/&(nbsp|quot|apos|lt|gt);/g, (m, n) => NAMED[n]).replace(/&amp;/g, "&");
const safeCp = (n, fallback) => { try { return String.fromCodePoint(n); } catch { return fallback; } };

// ── parse ──────────────────────────────────────────────────────────────────
const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
function attrsOf(s) {
  const a = {};
  for (const m of String(s).matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return a;
}
/** HTML -> tree { tag, attrs, kids:[node|string] }. Tolerant: a stray close tag is ignored, an unclosed tag closes at its parent's end. */
export function parseHtml(html) {
  const src = String(html ?? "");
  const root = { tag: "#root", attrs: {}, kids: [] }; const stack = [root];
  let last = 0, m; TAG_RE.lastIndex = 0;
  const top = () => stack[stack.length - 1];
  const text = (t) => { if (t) top().kids.push(t); };
  while ((m = TAG_RE.exec(src)) !== null) {
    text(src.slice(last, m.index)); last = TAG_RE.lastIndex;
    if (!m[2]) continue;                                         // a comment, doctype or declaration
    const close = m[1] === "/", tag = m[2].toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const node = { tag, attrs: attrsOf(m[3]), kids: [] };
    const imp = IMPLIED[tag];
    if (imp) { while (stack.length > 1 && imp.has(top().tag)) stack.pop(); }
    else if (BLOCK.has(tag) && top().tag === "p") stack.pop();
    top().kids.push(node);
    if (VOID.has(tag) || /\/\s*$/.test(m[3])) continue;
    if (SKIP_BODY.has(tag)) {                                    // never parse inside: jump to the matching close
      const end = src.toLowerCase().indexOf("</" + tag, TAG_RE.lastIndex);
      if (end < 0) { last = TAG_RE.lastIndex = src.length; break; }
      const gt = src.indexOf(">", end); last = TAG_RE.lastIndex = gt < 0 ? src.length : gt + 1;
      continue;
    }
    stack.push(node);
  }
  text(src.slice(last));
  return root;
}
const textLen = (n) => (typeof n === "string" ? n.length : n.tag === "script" || n.tag === "style" ? 0 : n.kids.reduce((a, k) => a + textLen(k), 0));
function find(n, pred, out = []) { if (typeof n === "string") return out; if (pred(n)) out.push(n); for (const k of n.kids) find(k, pred, out); return out; }
// The tokens of an element's id and classes that NAME what it is. A BEM modifier ("main--sidebar") and a layout state
// ("has-sidebar", "with-nav", "no-menu") describe the layout, not the element, and name nothing.
const STATE = new Set("with has without no is show hide when on off".split(" "));
const tokensOf = (n) => `${n.attrs.id || ""} ${n.attrs.class || ""}`.toLowerCase().split(/\s+/).flatMap((cls) => {
  const toks = cls.replace(/--[^\s]*/g, "").split(/[^a-z]+/).filter(Boolean);
  return toks.some((t) => STATE.has(t)) ? [] : toks;
});
// A node that holds real paragraphs is content whatever its class says.
const holdsProse = (n) => find(n, (x) => x.tag === "p" && textLen(x) >= 120).length >= 2;
const hiddenNode = (n) => n.attrs["aria-hidden"] === "true" || "hidden" in n.attrs || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.attrs.style || "");

// ── the region ─────────────────────────────────────────────────────────────
export function pickScope(root) {
  const best = (list) => list.map((n) => ({ n, len: textLen(n) })).sort((a, b) => b.len - a.len)[0];
  const mains = find(root, (n) => n.tag === "main" || n.attrs.role === "main");
  const arts = find(root, (n) => n.tag === "article");
  const m = best(mains), a = best(arts);
  if (m && m.len >= 300) return { node: m.n, scope: "main", article: a && textLen(a.n) >= m.len * 0.3 ? a.n : null };
  if (a && a.len >= 300) return { node: a.n, scope: "article", article: a.n };
  const body = find(root, (n) => n.tag === "body")[0] || root;
  return { node: body, scope: "body", article: null };
}

/** Blocks of the scope: [{ text, tag, chars, linkChars }], with non-content subtrees dropped. */
export function blocksOf(scopeNode, total, article) {
  const blocks = []; let cur = null; const dropped = { tag: 0, role: 0, token: 0, hidden: 0 };
  let gap = false;                                  // text was dropped since the last block: the next block is NOT adjacent to it on the page
  const flush = () => { if (cur) { const t = decode(cur.parts.join(" ")).replace(/\s+/g, " ").trim(); if (t) { blocks.push({ text: t, tag: cur.tag, chars: t.length, linkChars: Math.min(t.length, cur.link), idx: blocks.length, gapBefore: gap }); gap = false; } cur = null; } };
  const open = (tag) => { flush(); cur = { parts: [], tag, link: 0 }; };
  const walk = (n, inLink, insideArticle) => {
    if (typeof n === "string") { if (!cur) open("#text"); const t = n.replace(/\s+/g, " "); cur.parts.push(t); if (inLink) cur.link += decode(t).trim().length; return; }
    if (blocks.length >= REGION.maxBlocks) return;
    const tag = n.tag;
    if (SKIP_BODY.has(tag)) return;
    if (hiddenNode(n)) { dropped.hidden++; if (textLen(n)) gap = true; return; }
    const inArt = insideArticle || tag === "article" || n === article;
    if (DROP_TAGS.has(tag)) { dropped.tag++; if (textLen(n)) { flush(); gap = true; } return; }
    if (DROP_OUTSIDE.has(tag) && !inArt && textLen(n) <= total * REGION.keepIfShare) { dropped.tag++; if (textLen(n)) { flush(); gap = true; } return; }
    if (n.attrs.role && DROP_ROLES.has(n.attrs.role.toLowerCase())) { dropped.role++; if (textLen(n)) { flush(); gap = true; } return; }
    if (tag !== "body" && tag !== "main" && tag !== "article" && tag !== "html" && n !== scopeNode && tokensOf(n).some((t) => DROP_TOKENS.has(t)) && textLen(n) <= total * REGION.keepIfShare && !holdsProse(n)) { dropped.token++; if (textLen(n)) { flush(); gap = true; } return; }
    const isBlock = BLOCK.has(tag);
    if (isBlock) open(tag); else if (!cur) open("#text"); else cur.parts.push(" ");
    const link = inLink || tag === "a";
    for (const k of n.kids) walk(k, link, inArt);
    if (isBlock) flush(); else if (cur) cur.parts.push(" ");
  };
  walk(scopeNode, false, false); flush();
  return { blocks, dropped };
}

const FW_ALL = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
/** Is this block prose: long enough, has a sentence stop, a normal share of function words (spaced scripts). */
export function isProse(text) {
  const script = scriptOf(text), toks = segments(text, script);
  if (isUnspaced(script)) return toks.length >= REGION.proseWords * 2 && /[。！？.!?]/u.test(text);
  if (toks.length < REGION.proseWords) return false;
  const fw = toks.filter((t) => FW_ALL.has(fold(t.text))).length / toks.length;
  const stop = /[.!?。！？]["')\]”’]*(?:\s|$)/u.test(text);
  // a language with no function-word list (German, Dutch, Polish...) is prose when it is long and punctuated like prose
  return stop && (fw >= REGION.proseFw || (toks.length >= REGION.runWords - 10 && /[,;]/.test(text)));
}
const wordCount = (t) => segments(t).length;

/** Drop boilerplate blocks (link menus, chrome-dominated) and find where the content starts. With `runs`, also keep only
 *  MAIN-TEXT blocks after the start: prose that stands alone (>= runWords words) or sits beside other prose, plus headings and
 *  list items — an isolated one-line caption, disclaimer, widget note or promo is not scored (when the page has no prose at all,
 *  a listing or a table page, nothing is dropped this way).
 *  { kept:[block], start:index into kept (0 when there is no prose run), skipped:n blocks before start } */
export function contentOf(blocks, { runs = false } = {}) {
  let kept = blocks.filter((b) => {
    // a menu is mostly links and has no sentence in it; a sentence that merely carries links (a credit, a location) is content
    const sentence = wordCount(b.text) >= 10 && /[.!?。！？]["')\]”’]*$/u.test(b.text);
    if (b.linkChars / Math.max(1, b.chars) > REGION.linkHeavy && wordCount(b.text) < REGION.linkShortWords && !sentence) return false;
    const j = junkOf(b.text);
    return !j.dominated;
  });
  let start = -1;
  for (let i = 0; i < kept.length; i++) {
    if (!isProse(kept[i].text)) continue;
    if (wordCount(kept[i].text) >= REGION.runWords || (kept[i + 1] && isProse(kept[i + 1].text))) { start = i; break; }
  }
  if (start < 0 && kept.length) { start = kept.reduce((bi, b, i) => (b.chars > kept[bi].chars ? i : bi), 0); if (kept[start].chars < 80) start = 0; }
  start = Math.max(0, start);
  if (runs && kept.some((b, i) => i >= start && isProse(b.text))) {
    const prose = kept.map((b) => isProse(b.text));
    const sentenceLike = (b) => b.chars >= 100 && wordCount(b.text) >= 12 && /[.!?。！？]["')\]”’]*$/u.test(b.text);   // a long line that ends on a stop is a statement even if it is a list of nouns
    const main = (i) => (prose[i] && (wordCount(kept[i].text) >= REGION.runWords || prose[i - 1] || prose[i + 1])) || sentenceLike(kept[i]);
    const heading = (b) => /^h[1-6]$/.test(b.tag) || (b.tag === "li" && wordCount(b.text) >= 8);
    kept = kept.filter((b, i) => i < start || main(i) || heading(b));
    start = Math.min(start, kept.length - 1);
    // the start index moves with the filter: it is the first kept block at or after the old start
  }
  return { kept, start: Math.max(0, start), skipped: Math.max(0, start) };
}

/** HTML -> the content region. { text, blocks (from the start), scope, start, skipped, dropped, totalBlocks } */
export function regionOfHtml(html) {
  const root = parseHtml(html);
  const total = textLen(root) || 1;
  const { node, scope, article } = pickScope(root);
  const { blocks, dropped } = blocksOf(node, total, article);
  const { kept, start, skipped } = contentOf(blocks, { runs: true });
  const used = kept.slice(start);
  // Blocks are joined by a blank line; where the page has OTHER text between two blocks (dropped chrome, a dropped boilerplate
  // block, a block not scored) the join is a blank line, a masked line of spaces, a blank line — a passage never bridges it, so
  // every passage cut from this text is contiguous on the page and stays verbatim.
  let text = ""; let prev = null;
  for (const b of used) { text += prev ? (b.gapBefore || b.idx !== prev.idx + 1 ? "\n\n \n\n" : "\n\n") : ""; text += b.text; prev = b; if (text.length > REGION.maxChars) { text = text.slice(0, REGION.maxChars); break; } }
  return { text, blocks: used, scope, start, skipped, dropped, totalBlocks: blocks.length };
}

/** The visible text of a page (scripts, styles and comments gone), whitespace-squashed. Used for the wall check and the verbatim
 *  hay. Every tag boundary is a space. */
export function visibleTextOfHtml(html) {
  const root = parseHtml(html);
  const out = []; const walk = (n) => { if (typeof n === "string") { out.push(n); return; } if (SKIP_BODY.has(n.tag) && n.tag !== "svg") return; out.push(" "); for (const k of n.kids) walk(k); out.push(" "); };
  walk(root);
  return decode(out.join("")).replace(/\s+/g, " ").trim();
}

/** The page's title and first heading, for the wall check. */
export function titleOfHtml(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html ?? ""));
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : "";
}

/** Passage TEXT (blocks already separated by blank lines, as fold-chat-web.js hands them on) -> the same text with every block
 *  that is not content (chrome-dominated, or ahead of where the content starts) replaced by spaces. Offsets are kept, so ranges
 *  taken from the masked text are ranges of the original: a snip cut from it is still verbatim. */
export function maskNavRegion(text) {
  const src = String(text ?? "");
  const re = /[^\n]+(?:\n(?!\n)[^\n]+)*/g; const blocks = []; let m;
  while ((m = re.exec(src)) !== null) blocks.push({ text: m[0], start: m.index, end: m.index + m[0].length, chars: m[0].length, linkChars: 0, tag: "p" });
  if (blocks.length < 2) return { text: src, start: 0, masked: 0 };
  const { kept, start } = contentOf(blocks);
  if (!kept.length) return { text: src, start: 0, masked: 0 };
  const keep = new Set(kept.slice(start).map((b) => b.start));
  const masked = blocks.filter((b) => !keep.has(b.start)).length;
  if (!masked) return { text: src, start: 0, masked: 0 };
  const chars = src.split("");
  for (const b of blocks) if (!keep.has(b.start)) for (let i = b.start; i < b.end; i++) if (chars[i] !== "\n") chars[i] = " ";
  return { text: chars.join(""), start, masked };
}

// ── tables and code: what a no-model snip can honestly do ─────────────────
// The answer to a table question is a ROW, and to a code question a BLOCK. A sentence scorer neither reads a table nor
// quotes code; these two readers do the one safe thing: quote the page's own row (with its header row) or block, verbatim,
// when the ask's own words occur in it. They never compute, reorder, join cells with anything but the page's own spacing,
// or choose between rows by value ("which team leads" is a sort the page did, not a sentence).
const cellsOf = (tr) => find(tr, (n) => n.tag === "td" || n.tag === "th").map((c) => decode(flatText(c)).replace(/\s+/g, " ").trim()).filter(Boolean);
function flatText(n) { return typeof n === "string" ? n : SKIP_BODY.has(n.tag) ? "" : " " + n.kids.map(flatText).join(" ") + " "; }
const FW_TERMS = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
/** Content words of an ask (folded, >= 3 letters, not function words) — what a row or a block must share with it. */
export function askTerms(ask) { return [...new Set(segments(ask).map((t) => fold(t.text)).filter((w) => w.length >= 3 && !FW_TERMS.has(w)))]; }

/** Table rows that share >= minShared ask terms: [{ header, row, shared }] — the row and its header row, each the page's own cells
 *  separated by a space. At most `max` rows; only tables of >= 2 rows whose rows have >= 2 cells. */
export function tableRowsOfHtml(html, ask, { minShared = 2, max = 2 } = {}) {
  const terms = askTerms(ask); if (terms.length < minShared) return [];
  const root = parseHtml(html); const out = [];
  for (const table of find(root, (n) => n.tag === "table")) {
    if (hiddenNode(table)) continue;
    const trs = find(table, (n) => n.tag === "tr"); if (trs.length < 2) continue;
    const rows = trs.map(cellsOf).filter((c) => c.length >= 2);
    if (rows.length < 2) continue;
    const header = rows[0].join(" ");
    for (let i = 1; i < rows.length; i++) {
      const f = fold(rows[i].join(" ") + " " + header);
      const shared = terms.filter((t) => f.includes(t)).length;
      if (shared >= minShared && fold(rows[i].join(" ")).split(" ").some((w) => terms.some((t) => w.includes(t)))) out.push({ header, row: rows[i].join(" "), shared });
    }
  }
  return out.sort((a, b) => b.shared - a.shared).slice(0, max);
}

/** Code blocks (<pre>) of 2..60 lines that share >= 1 ask term with the block or the block just before it. Text is the page's own,
 *  line breaks kept. [{ code, shared }] */
export function codeBlocksOfHtml(html, ask, { max = 2 } = {}) {
  const terms = askTerms(ask); if (!terms.length) return [];
  const root = parseHtml(html); const out = [];
  const walk = (n, prevText) => {
    if (typeof n === "string") return prevText;
    if (n.tag === "pre" && !hiddenNode(n)) {
      const raw = decode(n.kids.map((k) => (typeof k === "string" ? k : k.tag === "br" ? "\n" : flatTextKeep(k))).join("")).replace(/\r/g, "");
      const code = raw.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
      const lines = code.split("\n").length;
      if (lines >= 2 && lines <= 60 && code.length >= 30 && code.length <= 1500) {
        const f = fold(code + " " + prevText); const shared = terms.filter((t) => f.includes(t)).length;
        if (shared >= 1 && !/[<>]/.test(code)) out.push({ code, shared });
      }
      return code;
    }
    let p = prevText;
    for (const k of n.kids) p = walk(k, p);
    return BLOCK.has(n.tag) && typeof n.kids[0] !== "undefined" ? (textLen(n) < 400 ? decode(flatText(n)).replace(/\s+/g, " ").trim() : p) : p;
  };
  walk(root, "");
  return out.sort((a, b) => b.shared - a.shared).slice(0, max);
}
function flatTextKeep(n) { return typeof n === "string" ? n : n.tag === "br" ? "\n" : n.kids.map(flatTextKeep).join(""); }
