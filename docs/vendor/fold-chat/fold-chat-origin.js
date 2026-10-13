// fold-chat-origin.js — an encyclopedia is a POINTER, never a citation. No DOM, no model, no clock; the network arrives as `fetchImpl`.
//
// The rule (user, 2026-10-06): Wikipedia is not cited. What it says is a lead; the thing to cite is the ORIGINAL source the article
// itself points at, fetched, with the path there kept:   the article → the footnote under the sentence → the page the footnote names.
//
//   parseWikiHtml(html)                 → { notes: Map<id, Note>, blocks: [{ text, marks: [{ at, id, n }] }] }
//        the article's own markup, read mechanically: each in-text `[n]` (a mark, at a character position of its block) and each
//        footnote's links (the original, and an archived copy when the article gives one).
//   noteMarksFor(blocks, sentence)      → [{ id, n, claim }] | null        null = the sentence is not in the article's prose
//        the footnotes under the sentence, each with the span of text it stands under (`claim`).
//   wikiIndex(url, { fetchImpl, memo }) → { edition, title, url, notes, blocks } | null     one parse call per article, memoised
//   followClaim({ sentence, passage, … }) → Trail
//        Trail = { status, found, refs, path, tried, origin }
//          status  origin        a footnote's page was read AND carries the claim → cite `origin`, show `path`
//                  unsupported   pages were read; none carries the claim            → pointers only
//                  unread        the footnotes name pages that could not be read      → pointers only
//                  no-reference  the sentence stands under no footnote                → nothing to follow
//                  unlocated     the sentence is not in the article's prose           → nothing to follow
//                  unindexed     the article's markup could not be fetched            → nothing to follow
//          found   { kind: "wikipedia", title, url, edition }     where the lead was found: a hop of the path, NEVER the citation
//          refs    [{ n, id, url, archived, label, host }]        the article's own pointers for the sentence (what to fetch)
//          path    [{ kind: "found-in" | "reference" | "read", … }]  the hops to the origin (empty unless status is origin)
//          tried   every hop of every attempt, supported or not — the whole trail, kept
//          origin  { url, title, host, via, sentence, passage }   the page read and the sentence of it that carries the claim
//
// IDENTITY, as the user defines it (2026-10-06): what a thing is FOR SOMEONE — everything the reading connects to it, cut off where the difference
// stops mattering; that cut neighbourhood, seen from one perspective, is its identity. So it is RELATIVE (every verdict here names its for-whom and
// its cut), REVISABLE (a verdict is the reading so far: the trail keeps every page tried, and another page can move it) and EARNED (a thing that
// carries no weight is never "the same": below `minAtoms` the verdict is undecidable). NOMINATED, NOT MEASURED: `identity.measured` is false on every
// trail — the consequence rule below is a nomination with its measurements pending, and the substitution control (swap a name for a generic stand-in
// and see whether the surroundings are disturbed alike, by more than chance) is NOT built. Where the page's own definition of a word differs from
// the claim's giver (HUD's "affordable" is not a planning document's), the stems here do not see it.
//
// TWO RUNGS, mechanical both (no model). Rung 1 — CONSEQUENCE (above): the claim and the page's sentence select the same figures, names, terms. It is
// strict on WORDS, so a claim reworded ("rises … runs" for "flows") is `undecidable (terms)`. Rung 2 — BOUND, the Pivot's own reading (B) under
// the ASKER's frame (`askFrame`: the referents and the slot the person asked for): both the claim and every sentence of the page are READ into rows
// (`bindSentence`: referent, filler, polarity, tense) and the ASSERTIONS are compared — same referent, same filler, same polarity, compatible
// tense. The asker's frame is the cut: words outside it (the verb that happened to be used) do not decide what the page says FOR THIS ASK. A page
// that binds the frame with ANOTHER filler is `different` (a rival, not merely "no support"). No frame (not a slot ask) → rung 1 alone.
//
// The project's own statement of it (docs/BACKWARDS-GROUNDING-PREREG.md): a page's sentence is a HOLON whose identity IS its address
// `<ref>#<start>-<end>` (it reads back as its own bytes or it is refused); a sentence and a source's sentence are THE SAME CLAIM iff their
// CONSEQUENCES against the source (its window, the figures each equals in its own units, the names, the content terms) are equal and non-empty
// (fold-chat-assemble.js `sameClaim`). The source need not say it in the same words — the reading is by consequence, not by string. Empty
// consequence is `undecidable`, typed, never "same" and never "different": the page is then NOT an origin. Pages are the same page by their
// normalised address (scheme, `www`, fragment and a trailing slash are not a second page).
//
// A page that cannot be fetched is not "supporting" anything; a page that is fetched but does not carry the claim is recorded as such and
// is not cited. Nothing here rewrites a word of either page: the origin's `sentence` is a verbatim slice of the origin's own text.

import { splitSentences } from "./fold-chat-ground.js";
import { consequenceOf, sentenceSpans } from "./fold-chat-assemble.js";
import { askFrame } from "./fold-chat-frame.js";
import { bindSentence } from "./fold-chat-witness.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { resolveTitlesWikipedia } from "./fold-chat-titles.js";
import { sameMeaning } from "./fold-chat-meaning.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { TERTIARY, isTertiary, tertiaryOf } from "./fold-chat-tertiary.js";
import { detectLang } from "./fold-chat-lang.js";
import { readText } from "./fold-chat-web.js";

export { TERTIARY, isTertiary, tertiaryOf };
export const ORIGIN = Object.freeze({
  maxAttempts: 3,          // footnotes tried per claim (each is one page read)
  maxHtmlChars: 4_000_000, // an article's parse HTML beyond this is not read
  minAtoms: 3,             // EARNED: a claim whose consequence is fewer than this many names/figures/terms is idle — undecidable, never "same"
  minAtomsSlot: 2,         // ... except a SLOT claim (a figure AND a name: "The Eiffel Tower is 330 metres tall"), whose figure and name each carry weight; the figure/name gates below still decide (C1: wrong-figure and other-tower decoys stay rejected)
  corroborateReads: 8,     // search hits read for the ANSWER's own atomic claim (the first that carries it, in search order, is the origin)
  turnBoxMs: 12000,        // all the following-up of one turn; past it the rows keep their pointers and the turn goes on
  readMs: 6000,            // one page read, original or archived copy
  noteChars: 240,          // a footnote's own words kept for display
  indexTtlMs: 10 * 60 * 1000,
});

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };

// ── reading the article's markup ───────────────────────────────────────────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => String(s ?? "")
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ""; } })
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } })
  .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
const ws = (s) => String(s ?? "").replace(/[\s ]+/g, " ").trim();
const plain = (html) => ws(decode(String(html ?? "").replace(/<[^>]*>/g, " ")));
const attr = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag); return m ? decode(m[2] ?? m[3]) : ""; };
const noteIdOf = (s) => decode(s).replace(/^#?cite_note-/, "");

const ARCHIVE = /(^|\.)(web\.archive\.org|archive\.(org|today|is|ph|md|li|vn|fo)|webcitation\.org|perma\.cc|wayback\.archive-it\.org|webarchive\.nationalarchives\.gov\.uk|timetravel\.mementoweb\.org)$/i;
const WIKIMEDIA = /(^|\.)(wikipedia|wikimedia|wikidata|wikimediafoundation|mediawiki)\.org$/i;
const normUrl = (u) => { const s = String(u || ""); return /^\/\//.test(s) ? "https:" + s : s; };
const absolute = (u) => /^https?:\/\/[^\s]+$/i.test(normUrl(u));

/** The page an archive link was made of: `https://web.archive.org/web/2020…/https://example.org/x` → `https://example.org/x`. */
export function archivedOriginal(u) {
  const m = /^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/i.exec(normUrl(u));
  return m ? m[1] : null;
}

/** One footnote's `<li>`: its external links split into the ORIGINAL and an archived copy, plus its own words. */
function noteOf(id, inner, n) {
  let url = null, archived = null, label = "";
  for (const m of inner.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = m[0].slice(0, m[0].indexOf(">") + 1);
    const href = normUrl(attr(tag, "href"));
    const cls = attr(tag, "class"), rel = attr(tag, "rel");
    if (!absolute(href) || !(/\bexternal\b/i.test(cls) || /nofollow/i.test(rel))) continue;
    const h = hostOf(href);
    if (WIKIMEDIA.test(h)) continue;
    if (ARCHIVE.test(h)) { if (!archived) archived = href; if (!url) { const o = archivedOriginal(href); if (o && !WIKIMEDIA.test(hostOf(o))) url = o; } continue; }
    if (!url) url = href;
    if (!label) label = plain(m[0]);
  }
  const cite = /<cite\b[^>]*>([\s\S]*?)<\/cite>/i.exec(inner);
  const text = plain(cite ? cite[1] : inner).slice(0, ORIGIN.noteChars);
  return { id, n: n ?? null, url, archived, label: label.replace(/^["“”']+|["“”']+$/g, "") || text.slice(0, 80), host: url ? hostOf(url) : "", text };
}

const BREAK = /^<\/(?:p|li|tr|td|th|h[1-6]|div|dd|dt|table|ul|ol|blockquote|figure|figcaption)\s*>$|^<br\b[^>]*>$/i;

/** The article's HTML → { notes, blocks }. A block is one paragraph / list item / table cell of prose; its `marks` are the footnote
 *  markers, each at the character position (in `text`) where the marker stood. The marker's own `[12]` text is NOT in `text`. */
export function parseWikiHtml(html) {
  let h = String(html ?? "");
  h = h.replace(/<!--[\s\S]*?-->/g, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const notes = new Map();
  const labels = new Map();
  // the footnote list(s): read, then cut out of the prose
  h = h.replace(/<ol\b[^>]*class="[^"]*\breferences\b[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi, (_, list) => {
    for (const m of list.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
      const id = noteIdOf(attr(m[1], "id")); if (!id) continue;
      notes.set(id, noteOf(id, m[2], null));
    }
    return " ";
  });
  h = h.replace(/<sup\b[^>]*class="[^"]*\bnoprint\b[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, "");        // [citation needed] and its kin
  const blocks = [];
  let cur = { text: "", marks: [] };
  const flush = () => { if (cur.text.trim()) blocks.push(cur); cur = { text: "", marks: [] }; };
  const tok = /(<sup\b[^>]*class="[^"]*\breference\b[^"]*"[^>]*>[\s\S]*?<\/sup>)|(<\/?[a-z][^>]*>)|([^<]+|<)/gi;
  for (let m; (m = tok.exec(h));) {
    if (m[1]) {
      const a = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(m[1]); if (!a) continue;
      const id = noteIdOf(attr(a[0], "href"));
      const lab = ws(plain(a[1]).replace(/[\[\]]/g, ""));
      if (id) { cur.marks.push({ at: cur.text.length, id, n: /^\d+$/.test(lab) ? Number(lab) : null }); if (/^\d+$/.test(lab) && !labels.has(id)) labels.set(id, Number(lab)); }
    } else if (m[2]) { if (BREAK.test(m[2])) flush(); }
    else cur.text += decode(m[3]);
  }
  flush();
  for (const [id, n] of labels) { const note = notes.get(id); if (note) note.n = n; }
  return { notes, blocks };
}

// ── finding a sentence in the article's prose ────────────────────────────────────────────────────────────────────────────────────────
/** `s` folded for matching (diacritics, case, whitespace runs) with a map from each folded char back to its index in `s`. */
// A pronunciation is in the parse HTML (/ˈaɪfəl/ ⓘ, [tuʁ ɛfɛl] ⓘ) and not in the plain-text extract the chat quotes: it is not the sentence's words, so it is not matched.
// Only a /…/ or […] that holds IPA characters, and the ⓘ glyph, are skipped — a bracketed figure or a slash in "and/or" stays.
const IPA_SEGMENT = /\/[^\/\n]{1,80}\/|\[[^\]\n]{1,80}\]/g, IPA_CHAR = /[\u0250-\u02ff\u1d00-\u1dbf]/, SPEAKER = "\u24d8";
function pronounced(s) {
  const skip = new Set();
  for (const m of s.matchAll(IPA_SEGMENT)) if (IPA_CHAR.test(m[0])) for (let k = m.index; k < m.index + m[0].length; k++) skip.add(k);
  for (let i = s.indexOf(SPEAKER); i >= 0; i = s.indexOf(SPEAKER, i + 1)) skip.add(i);
  return skip;
}
function folded(s) {
  const out = [], map = [], skip = pronounced(s);
  for (let i = 0; i < s.length; i++) {
    const c = skip.has(i) ? " " : s[i];
    if (/[\s ]/.test(c)) { if (out.length && out[out.length - 1] !== " ") { out.push(" "); map.push(i); } continue; }
    for (const ch of c.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase()) { out.push(ch); map.push(i); }
  }
  if (out.length && out[out.length - 1] === " ") { out.pop(); map.pop(); }
  return { n: out.join(""), map };
}

/** Where `sentence` stands in a block: [start, end) in the block's own text, or null. Whole first; else its head and its tail (a snip
 *  that skipped words in the middle, or an ellipsis). */
function locate(block, sentence) {
  const b = folded(block.text), q = folded(sentence);
  if (!q.n) return null;
  const at = (needle) => { const i = b.n.indexOf(needle); return i < 0 ? null : [b.map[i], b.map[Math.min(b.map.length - 1, i + needle.length - 1)] + 1]; };
  const whole = at(q.n);
  if (whole) return whole;
  if (q.n.length < 80) return null;
  const head = at(q.n.slice(0, 60)), tail = at(q.n.slice(-60));
  return head && tail && head[0] <= tail[0] ? [head[0], tail[1]] : null;
}

/** The footnotes under `sentence`: each mark that stands inside it or right at its end, with the text it stands under — from the previous
 *  mark (or the start of the sentence) up to itself. null when the sentence is not in the article's prose. */
export function noteMarksFor(blocks, sentence) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const r = locate(block, String(sentence ?? ""));
    if (!r) continue;
    const [a, b] = r;
    const out = [];
    let prev = a;
    for (const mk of block.marks) {
      if (mk.at <= a) continue;
      if (mk.at > b) break;
      out.push({ id: mk.id, n: mk.n, claim: ws(block.text.slice(prev, mk.at)) });
      prev = mk.at;
    }
    return out;
  }
  return null;
}

const wordsOf = (s) => (String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

/** A lead summarises the body and seldom carries footnotes itself. When `sentence` stands under none, the body's own sentence that says
 *  the same thing, and the footnotes under THAT sentence: { sentence, marks } | null.
 *  The finder is loose on purpose — words shared with the claim, each weighted by how rare it is in THIS article (no word list, no
 *  language: a word every paragraph uses weighs nothing) — because it only names a page to read; the page it names is read and must
 *  itself carry the claim (the strict check is there, not here). */
export function bodyMarksFor(blocks, sentence, { minShare = 0.5, minShared = 2 } = {}) {
  const list = Array.isArray(blocks) ? blocks : [];
  const want = [...new Set(wordsOf(sentence))];
  if (want.length < 3 || !list.length) return null;
  const df = new Map();
  for (const b of list) for (const w of new Set(wordsOf(b.text))) df.set(w, (df.get(w) || 0) + 1);
  const weight = (w) => Math.log(1 + list.length / (df.get(w) || 1));
  const total = want.reduce((t, w) => t + weight(w), 0);
  let best = null;
  for (const b of list) {
    if (!b.marks.length || locate(b, String(sentence ?? ""))) continue;               // the claim's own block is not its corroboration
    let from = 0;
    for (const s of splitSentences(b.text)) {
      const i = b.text.indexOf(s, from); if (i < 0) continue;
      from = i + s.length;
      const have = new Set(wordsOf(s));
      const shared = want.filter((w) => have.has(w));
      if (shared.length < minShared) continue;
      const share = shared.reduce((t, w) => t + weight(w), 0) / total;
      if (share >= minShare && (!best || share > best.share)) best = { share, block: b, s };
    }
  }
  if (!best) return null;
  const marks = noteMarksFor([best.block], best.s);
  return marks && marks.length ? { sentence: best.s, marks, share: best.share } : null;
}

// ── fetching an article's index ───────────────────────────────────────────────────────────────────────────────────────────────────────
const WIKI_RE = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i;

/** The article at `url`, read for its footnotes: { edition, title, url, notes, blocks } | null (not an article, or its markup was not
 *  served). One call per article per tab (`memo.origins`). Never throws. */
export async function wikiIndex(url, { fetchImpl = globalThis.fetch, memo = null, signal = null } = {}) {
  const m = WIKI_RE.exec(String(url ?? ""));
  if (!m) return null;
  const cache = memo ? (memo.origins ||= new Map()) : null;
  const hit = cache && cache.get(url);
  if (hit && Date.now() - hit.at < ORIGIN.indexTtlMs) return hit.val;
  try {
    const title = decodeURIComponent(m[2]).replace(/_/g, " ");
    const api = `https://${m[1]}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text%7Crevid&format=json&formatversion=2&disableeditsection=1&disablelimitreport=1&redirects=1&origin=*`;
    const r = await fetchImpl(api, signal ? { signal } : {});
    if (!r || !r.ok) return null;
    const j = await r.json();
    const html = j && j.parse && typeof j.parse.text === "string" ? j.parse.text : "";
    if (!html || html.length > ORIGIN.maxHtmlChars) return null;
    const val = { edition: m[1].toLowerCase(), title: String((j.parse && j.parse.title) || title), url, revid: Number.isFinite(j.parse && j.parse.revid) ? j.parse.revid : null, ...parseWikiHtml(html) };
    if (cache) cache.set(url, { at: Date.now(), val });
    return val;
  } catch { return null; }
}

// ── following a claim to its origin ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The claim's own identity: its holon address `<ref>#<start>-<end>` in the passage it was read on — or null when the passage's text is not at hand
 *  or does not read back as the sentence (an address that does not self-verify is not given). */
export function holonAddress(passage, sentence) {
  const text = passage && typeof passage.text === "string" ? passage.text : "";
  const i = sentence ? text.indexOf(String(sentence)) : -1;
  if (i < 0) return null;
  return `${(passage && passage.ref) || hostOf(passage && passage.url) || "page"}#${i}-${i + String(sentence).length}`;
}

/** One page, one key: the scheme, a leading `www.`, the fragment and a trailing slash do not make a second page. */
export function pageKey(u) {
  try { const x = new URL(String(u)); return x.hostname.replace(/^www\./i, "").toLowerCase() + (x.pathname.replace(/\/+$/, "") || "") + x.search; } catch { return String(u ?? ""); }
}

/** What every verdict is a reading OF: the cut (the page sentence and the sentence either side), the for-whom, and that the rule is nominated. */
export const IDENTITY = (forWhom = null, rung = "consequence") => Object.freeze(rung === "meaning"
  ? { by: "meaning", cut: "the reading's own hyperlexicon: the slots a word fills (end1 \u2192 end2), witnessed by sources other than the pair under test; then the strict consequence", for: forWhom ? String(forWhom).slice(0, 200) : null, basis: "nominated", measured: false }
  : rung === "bound"
  ? { by: "bound", cut: "the asker's frame: its referents and slot; the page's sentence read the same way (referent, filler, polarity, tense)", for: forWhom ? String(forWhom).slice(0, 200) : null, basis: "nominated", measured: false }
  : { by: "consequence", cut: "holon window ±1, cut at figures, names and content terms", for: forWhom ? String(forWhom).slice(0, 200) : null, basis: "nominated", measured: false });

/** The asker's frame, read once: { frame, fw, lang } | null (not a slot ask, no grammar for the language, titles unreachable). Never throws. */
export async function readFrame(question, { fetchImpl = globalThis.fetch, lang = null } = {}) {
  try {
    const q = String(question ?? "").trim();
    if (!q) return null;
    const code = lang && lang !== "unknown" ? lang : (detectLang(q).lang || null);
    const fw = code ? functionWordsOf(code) : null;
    if (!code || !(fw instanceof Set) || !fw.size) return null;
    const frame = await askFrame(q, { fw, lang: code, resolveTitles: (c) => resolveTitlesWikipedia(c, { fetchImpl, edition: code }) });
    return frame && frame.ok ? { frame, fw, lang: code } : null;
  } catch { return null; }
}

const figureOf = (t) => { const m = String(t ?? "").replace(/(\d)[,\u00a0 ](?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
const sameFill = (slot, a, b) => {
  if (slot === "quantity" || slot === "time") { const x = figureOf(a), y = figureOf(b); return x !== null && y !== null && x === y; }
  const x = toks(a), y = toks(b);
  if (!x.length || !y.length) return false;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  for (let i = 0; i + s.length <= l.length; i++) { if (s.every((w, j) => l[i + j] === w)) return true; }
  return false;
};
const toks = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

/** RUNG 2 — the claim and the page, each READ by the Pivot's B grammar under the asker's frame, compared as ASSERTIONS.
 *  → null when the rung does not apply (no frame, or the claim does not bind the frame with a filler), else
 *    { verdict: "same" | "different" | "undecidable", address, sentence, filler, why? } — `address` is the page sentence's holon address. */
export function supportByFrame(claim, page, reading) {
  if (!reading || !reading.frame || !reading.frame.ok || !(reading.fw instanceof Set)) return null;
  const { frame, fw, lang } = reading;
  const bind = (text, source, topic) => { try { return bindSentence({ text, start: 0, end: text.length }, frame, { fw, lang, source, topic: topic || null }); } catch { return null; } };
  const c = bind(String(claim ?? ""), { url: "claim" }, null);
  if (!c || c.tier !== "T1" || !c.filler || !c.filler.text) return null;                 // read under this frame the claim holds no filler: nothing to compare
  const text = String((page && page.text) || "").slice(0, 20000);
  let rival = null, tenseSkew = null;
  for (const s of sentenceSpans(text)) {
    const r = bind(s.text, { url: page && page.url }, page && page.title);
    if (!r || r.tier !== "T1" || !r.filler || !r.filler.text) continue;
    const hit = { address: `origin#${s.start}-${s.end}`, sentence: s.text, filler: r.filler.text };
    if (r.polarity !== c.polarity) { rival = rival || { ...hit, why: "polarity" }; continue; }
    if (!sameFill(frame.slot, c.filler.text, r.filler.text)) { rival = rival || { ...hit, why: "filler" }; continue; }
    if (c.tense !== "unknown" && r.tense !== "unknown" && c.tense !== r.tense) { tenseSkew = tenseSkew || { ...hit, why: "tense" }; continue; }
    return { verdict: "same", ...hit };
  }
  if (rival) return { verdict: "different", ...rival };
  if (tenseSkew) return { verdict: "undecidable", ...tenseSkew };
  return { verdict: "undecidable", address: null, sentence: null, filler: null, why: "frame-unbound" };
}

/** Does `page` say what `claim` says — by CONSEQUENCE (identity as the project defines it), not by string?
 *  → { verdict: "same" | "different" | "undecidable", address, sentence, atoms, why?, detail? }
 *    same          the page's sentence at `address` has the consequence the claim has (equal, non-empty): it is the supporting assertion
 *    different     the page speaks of the same ground and selects something else (another figure, another name): NOT support
 *    undecidable   the claim makes no difference to this page (no overlap, a unit it cannot compare, a negation or a comparison no gate
 *                  reads, a language apart) — typed, never guessed; the page is not an origin */
export function supportOf(claim, page, { forWhom = null, reading = null, meaning = null } = {}) {
  const first = supportByConsequence(claim, page, forWhom);
  if (first.verdict === "same") return first;
  const b = supportByFrame(claim, page, reading);
  // the bound rung reads the slot's filler only ("time" = the YEAR: "20 July 1969" and "launch on July 16, 1969" both fill it with 1969): the page's sentence must still
  // carry every figure the claim states (C1, post-hoc: Apollo 11's "launch on July 16, 1969" and "San Francisco 1945" were accepted for "20 July 1969" / "24 October 1945")
  if (b && b.verdict === "same" && figuresCovered(claim, b.sentence)) return { verdict: "same", address: b.address, sentence: b.sentence, atoms: [], identity: IDENTITY(forWhom, "bound"), rung: "bound", filler: b.filler };
  if (b && b.verdict === "different") return { verdict: "different", address: b.address, sentence: b.sentence, atoms: [], why: b.why, detail: "the page binds the ask's frame with another " + b.why, identity: IDENTITY(forWhom, "bound"), rung: "bound", filler: b.filler };
  const m = supportBySynonyms(claim, page, meaning, forWhom);
  if (m) return m;
  return first;
}

/** Every number the claim states (digits, thousands separators and a decimal point ignored) stands in `sentence`. */
export function figuresCovered(claim, sentence) {
  const nums = (t) => (String(t ?? "").replace(/(\d)[,\u00a0 ](?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) || []);
  const have = new Set(nums(sentence));
  return nums(claim).every((n) => have.has(n));
}

/** RUNG 3 (gated: only when a caller hands in a ledger — see fold-chat-meaning.js for why it is OFF by default). The claim failed rung 1 ONLY on content
 *  words the page words differently; where the reading's own hyperlexicon earns each such word as the same meaning as a word of a page sentence (the same slot,
 *  heard in sources other than the pair under test), the page's word is put in its place and the STRICT check is run again. Every substituted pair is disclosed
 *  on the verdict (`synonyms`), never merged silently; a pair the reading did not earn is a typed gap and the verdict stays rung 1's. */
function supportBySynonyms(claim, page, meaning, forWhom) {
  const ledger = meaning && meaning.ledger;
  if (!ledger || !Array.isArray(ledger.notes) || !ledger.notes.length) return null;
  const text = String((page && page.text) || "");
  const c = consequenceOf(claim, [{ url: page && page.url, source: page && page.url, ref: "origin", text }]);
  if (c.atoms.length || c.why !== "terms" || !c.detail) return null;
  const missing = c.detail.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  if (!missing.length || missing.length > 3) return null;
  const exclude = (meaning && meaning.exclude) || [];
  for (const sp of sentenceSpans(text.slice(0, 20000))) {
    const words = [...new Set(wordsOf(sp.text).filter((w) => w.length >= 3))];
    const pairs = [];
    for (const m of missing) {
      let hit = null;
      for (const u of words) { const r = sameMeaning(m, u, ledger, { exclude }); if (r.verdict === "same" && r.via === "slot") { hit = { claim: m, page: u, via: r.slots, witnesses: r.witnesses }; break; } }
      if (!hit) { pairs.length = 0; break; }
      pairs.push(hit);
    }
    if (!pairs.length) continue;
    let sub = String(claim);
    for (const h of pairs) sub = sub.replace(new RegExp(`(?<![\\p{L}\\p{N}])${h.claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), h.page);
    const r = supportByConsequence(sub, page, forWhom);
    if (r.verdict === "same") return { ...r, identity: IDENTITY(forWhom, "meaning"), rung: "meaning", synonyms: pairs };
  }
  return null;
}

/** RUNG 1 */
function supportByConsequence(claim, page, forWhom) {
  const pg = [{ url: page && page.url, source: page && page.url, title: page && page.title, ref: "origin", text: String((page && page.text) || "") }];
  const c = consequenceOf(claim, pg);
  if (!c.atoms.length) return { verdict: "undecidable", why: c.why || "no-material", detail: c.detail || "", address: null, sentence: null, atoms: [] };
  const idle = c.atoms.filter((x) => !x.startsWith("holon:")).length;
  const slot = c.atoms.some((x) => x.startsWith("fig:")) && c.atoms.some((x) => x.startsWith("name:"));
  if (idle < (slot ? ORIGIN.minAtomsSlot : ORIGIN.minAtoms)) return { verdict: "undecidable", why: "idle", detail: `${idle} of ${slot ? ORIGIN.minAtomsSlot : ORIGIN.minAtoms} atoms: too little for a page to be the same for anyone`, address: c.address, sentence: null, atoms: c.atoms, identity: IDENTITY(forWhom) };
  const m = /#(\d+)-(\d+)$/.exec(c.address || "");
  const sentence = m ? pg[0].text.slice(Number(m[1]), Number(m[2])) : null;
  if (!sentence) return { verdict: "undecidable", why: "unaddressed", detail: "", address: c.address, sentence: null, atoms: c.atoms };
  // THE SAME CLAIM, directionally: the page's sentence must select what the claim selects (its window, every figure the claim carries, every
  // name, every content term) — a claim may say LESS than the sentence, never something else. (`sameClaim` is symmetric, so a clause of a longer
  // sentence reads "different" from it; the rule it states for terms is applied to figures and names too.) A page sentence the gate cannot read
  // (a negation, a comparison) has no consequence of its own and so can never be the support of an affirmative claim.
  const own = consequenceOf(sentence, pg);
  if (!own.atoms.length) return { verdict: "undecidable", why: own.why || "unread-structure", detail: own.detail || "", address: c.address, sentence, atoms: c.atoms };
  // a name's identity is its words, not a sentence-initial article: "The Nobel Prize" opening a sentence is the "Nobel Prize" a clause names
  const lead = new Set([...(FUNCTION_WORDS.en || []), ...(FUNCTION_WORDS[detectLang(String(claim)).lang] || [])].map((x) => String(x).normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase()));
  const nameId = (a) => { const w = a.slice(5).split("_"); while (w.length > 1 && lead.has(w[0])) w.shift(); return "name:" + w.join("_"); };
  const part = (k, p) => k.atoms.filter((x) => x.startsWith(p)).map((x) => (p === "name:" ? nameId(x) : x));
  const within = (xs, ys) => xs.every((x) => ys.includes(x));
  const said = part(c, "holon:").join() === part(own, "holon:").join() && within(part(c, "fig:"), part(own, "fig:")) && within(part(c, "name:"), part(own, "name:")) && within(part(c, "term:"), part(own, "term:"));
  return { verdict: said ? "same" : "different", address: c.address, sentence, atoms: c.atoms, identity: IDENTITY(forWhom) };
}

// ── HOW A FACT FAILS HERE (the nine operators, user 2026-10-06) ─────────────────────────────────────────────────────────────────────────────
// Every outcome that is not an origin is typed by the operator it fails at and by what KIND of failure it is — never collapsed into "unsupported":
//   refusal    nobody marked it / nothing could be reached (SIG): a REFUSAL, not a falsehood
//   gap        the claim and the page cannot be settled against each other (NUL, INS, SEG, DEF, EVA): typed, never "false" and never "true"
//   falsified  a contradicted edge or a competing filler in a one-filler slot (CON): the only kind that FALSIFIES
// GRAIN: each operator is asked at three grains — GROUND (the whole record), FIGURE (this claim), PATTERN (across sources and time). A failure says which:
// a page that cannot be reached is a failure of the record (ground); a sentence with no footnote under it is a failure of this claim (figure); whether the
// attestations trace to ONE upstream or several (SIG), and whether independent sources bind the same edge (CON), are PATTERN questions — `trail.pattern`.
// Data only: the card says it in plain words; the operator names never reach the screen.
export const FAILURE = Object.freeze({
  "no-reference": Object.freeze({ op: "SIG", grain: "figure", kind: "refusal", says: "nobody marked it: no footnote stands under this sentence" }),
  unlocated: Object.freeze({ op: "INS", grain: "figure", kind: "refusal", says: "the sentence cannot be addressed in the article's own text" }),
  unindexed: Object.freeze({ op: "SIG", grain: "ground", kind: "refusal", says: "the article's references could not be fetched" }),
  unread: Object.freeze({ op: "SIG", grain: "ground", kind: "refusal", says: "the pages it points to could not be read: no witness reached" }),
  unsupported: Object.freeze({ op: "INS", grain: "figure", kind: "gap", says: "the cited instance is not what it is cited as: the page read does not carry the claim" }),
  contradicted: Object.freeze({ op: "CON", grain: "figure", kind: "falsified", says: "a page it points to says something else about the same thing" }),
});
/** The operator a typed `why` of an undecidable / different verdict fails at. Unknown whys are SIG gaps: said, never guessed. */
export function failureOfWhy(why, verdict = "undecidable") {
  const w = String(why || "");
  if (verdict === "different") return { op: "CON", grain: "figure", kind: "falsified", says: w === "polarity" ? "the page denies it" : "the page gives another filler for the same slot" };
  if (/^figure/.test(w) || w === "tense") return { op: "SEG", grain: "figure", kind: "gap", says: "the page's figure, unit or date is not the claim's: a boundary differs" };
  if (w === "unread-structure") return { op: "EVA", grain: "figure", kind: "gap", says: "a comparison or a negation no gate reads: no null, no verdict" };
  if (w === "terms" || w === "terms-elsewhere" || w === "thin") return { op: "DEF", grain: "figure", kind: "gap", says: "the page words it with other terms: not shown to be the same meaning" };
  if (w === "no-overlap" || w === "frame-unbound" || /^name/.test(w)) return { op: "NUL", grain: "figure", kind: "gap", says: "what the claim is about is absent from this page" };
  if (w === "idle") return { op: "NUL", grain: "figure", kind: "gap", says: "the claim carries too little for any page to be the same for anyone" };
  return { op: "SIG", grain: "figure", kind: "gap", says: "not settled" };
}
/** The year (or year-month-day) an archive address was taken: `/web/20190301…/` → "2019-03-01"; `/web/2019/` → "2019". null for anything else. REC: a copy is true on ITS ground. */
export function archivedAsOf(u) {
  const m = /^https?:\/\/web\.archive\.org\/web\/(\d{4})(\d{2})?(\d{2})?/i.exec(String(u ?? ""));
  return m ? [m[1], m[2], m[3]].filter(Boolean).join("-") : null;
}

const pointerOf = (ref) => ({ n: ref.n, id: ref.id, url: ref.url, archived: ref.archived, label: ref.label, host: ref.host });

/** (the footnote walk, below `followClaim`)  Follow ONE sentence of an encyclopedia passage to the pages its footnotes name. `passage` = { url, … } of the encyclopedia page.
 *  `read` is the page reader ({ ok, text, title, via, url }); the chat's own (`readText`) by default. Never throws. */
async function followFootnotes({ sentence, passage, fetchImpl = globalThis.fetch, memo = null, read = readText, signal = null, maxAttempts = ORIGIN.maxAttempts, timeoutMs = ORIGIN.readMs, alongside = [], forWhom = null, reading = null, meaning = null } = {}) {
  const url = passage && passage.url;
  const base = { status: "unindexed", found: null, refs: [], path: [], tried: [], origin: null, fails: FAILURE.unindexed };
  try {
    const idx = await wikiIndex(url, { fetchImpl, memo, signal });
    if (!idx) return base;
    const found = { kind: "wikipedia", title: idx.title, url, edition: idx.edition, revid: idx.revid, address: holonAddress(passage, sentence) };   // REC (ground): the revision it was read from
    const marks = noteMarksFor(idx.blocks, sentence);
    if (marks === null) return { ...base, status: "unlocated", found, fails: FAILURE.unlocated };
    const refsOf = (list) => {
      const seen = new Set(), refs = [];
      for (const mk of list) {
        const note = idx.notes.get(mk.id);
        const key = note ? pageKey(note.url || note.archived || note.id) : "";
        if (!note || seen.has(key)) continue;
        seen.add(key);
        refs.push({ ...note, claim: mk.claim });
      }
      return refs;
    };
    let refs = refsOf(marks), body = null;
    // a lead seldom cites; when nothing under the sentence names a page, the body's own sentence for the same thing may (the path says so)
    if (!refs.some((r) => r.url || r.archived)) {
      const b = bodyMarksFor(idx.blocks, sentence);
      const viaBody = b ? refsOf(b.marks) : [];
      if (viaBody.some((r) => r.url || r.archived)) { body = { kind: "in-article", sentence: b.sentence }; refs = viaBody.map((r) => ({ ...r, claim: "" })); }   // found by the body's words: the page must carry the ASKED sentence
    }
    if (!refs.length) return { ...base, status: "no-reference", found, fails: FAILURE["no-reference"] };
    const out = { ...base, status: "unread", found, refs: refs.map(pointerOf), fails: FAILURE.unread };
    const first = { kind: "found-in", title: idx.title, url, edition: idx.edition, revid: idx.revid, address: found.address };
    // each footnote's page is read at once (a slow one costs one timeout, not one per footnote); the first, in the article's own order,
    // that carries the claim is the origin. An archived copy is for a page that cannot be read, never for one that disagrees.
    const candidates = refs.filter((r) => r.url || r.archived).slice(0, maxAttempts);
    for (const r of refs) if (!r.url && !r.archived) out.tried.push({ kind: "reference", n: r.n, id: r.id, label: r.label, note: r.text, url: null, read: false, why: "a note with no page to fetch (a book, a print source, or an explanation)" });
    const attemptRef = async (ref) => {
      const tried = [], refHop = { kind: "reference", n: ref.n, id: ref.id, label: ref.label, url: ref.url || ref.archived };
      const targets = [ref.url && { url: ref.url, copy: false }, ref.archived && ref.archived !== ref.url && { url: ref.archived, copy: true }].filter(Boolean);
      let anyRead = false;
      for (const t of targets) {
        if (signal && signal.aborted) break;
        let rd = null;
        try { rd = await read(t.url, { fetchImpl, memo, timeoutMs }); } catch { rd = null; }
        if (!rd || !rd.ok || !rd.text) { tried.push({ ...refHop, read: false, fails: FAILURE.unread, why: t.copy ? "the archived copy could not be read" : "the page could not be read" }); continue; }
        anyRead = true;
        const orig = ref.url || archivedOriginal(t.url) || t.url;   // the page the footnote NAMES; an archive is only how it was read
        const readHop = { kind: "read", url: rd.url || t.url, of: t.copy ? orig : null, via: rd.via || null, title: rd.title || "", copy: t.copy, ...(t.copy ? { asOf: archivedAsOf(t.url) } : {}) };
        const claim = ref.claim && ref.claim.length >= 12 ? ref.claim : sentence;
        const sup = supportOf(claim, { url: readHop.url, title: readHop.title, text: rd.text }, { forWhom, reading, meaning });
        if (sup.verdict !== "same") { tried.push({ ...refHop, ...readHop, read: true, supports: false, verdict: sup.verdict, fails: failureOfWhy(sup.why, sup.verdict), ...(sup.verdict === "different" ? { says: sup.sentence, address: sup.address } : {}), ...(sup.why ? { why: "the page was read; " + (sup.verdict === "different" ? "it says something else about this" : "this claim makes no difference to it (" + sup.why + ")") } : {}) }); break; }   // an archived copy is for a page that cannot be read, not one that disagrees
        tried.push({ ...refHop, ...readHop, read: true, supports: true, verdict: "same", address: sup.address });
        return { tried, anyRead, hit: { refHop, readHop, origin: { url: t.copy ? orig : readHop.url, copyUrl: t.copy ? readHop.url : null, asOf: t.copy ? archivedAsOf(t.url) : null, title: readHop.title, host: hostOf(t.copy ? orig : readHop.url), via: readHop.via, copy: t.copy, sentence: sup.sentence, address: sup.address, atoms: sup.atoms, identity: sup.identity, rung: sup.rung || "consequence", synonyms: sup.synonyms || null, passage: { ref: "Origin", title: readHop.title, url: readHop.url, text: rd.text, via: rd.via || null } } } };
      }
      return { tried, anyRead, hit: null };
    };
    const results = await Promise.all(candidates.map(attemptRef));
    for (const r of results) out.tried.push(...r.tried);
    const hits = results.filter((r) => r.hit);
    const win = hits[0];
    if (win) {
      const { refHop, readHop, origin } = win.hit;
      // PATTERN (SIG, CON): every footnote's page that carries the claim, and how many distinct hosts they are — one upstream repeated, or several independent
      // attestations. The host is the declared proxy for "upstream" (a syndicated story on two hosts still counts as two): said, not measured.
      const hosts = [...new Set(hits.map((h) => h.hit.origin.host).filter(Boolean))];
      const pattern = { attests: hits.length, independent: hosts.length, hosts, basis: "distinct hosts (declared proxy for upstream)", also: hits.slice(1).map((h) => ({ url: h.hit.origin.url, host: h.hit.origin.host, address: h.hit.origin.address })) };
      return { ...out, status: "origin", path: [first, ...(body ? [body] : []), refHop, { ...readHop, supports: true }], origin, pattern };
    }
    // a footnote's page that is read and says something ELSE about the same thing (a competing filler, a denial) falsifies the claim's own reference: CON
    const refuter = out.tried.find((x) => x.verdict === "different");
    if (refuter) return { ...out, status: "contradicted", refuter: { url: refuter.of || refuter.url, sentence: refuter.says || null, address: refuter.address || null, why: refuter.why }, fails: FAILURE.contradicted };
    const status = results.some((r) => r.anyRead) ? "unsupported" : "unread";
    return { ...out, status, fails: FAILURE[status] };
  } catch { return base; }
}

// ── the words a trail is shown in (app-authored, plain) ──────────────────────────────────────────────────────────────────────────────
/** The path as hops a person can read: ["Wikipedia “Charles III”", "reference 12", "royal.uk"]. */
export function pathWords(trail) {
  const t = trail && typeof trail === "object" ? trail : null;
  if (!t || !t.found) return [];
  const hops = [{ text: `${t.found.edition && t.found.edition !== "en" ? t.found.edition + "." : ""}Wikipedia “${t.found.title}”`, url: t.found.url }];
  const via = t.status === "origin" ? t.path.filter((h) => h.kind !== "found-in") : [];
  for (const h of via) hops.push(h.kind === "in-article" ? { text: "its body", url: null } : h.kind === "alongside" ? { text: "also on", url: null } : h.kind === "reference" ? { text: h.n ? `reference ${h.n}` : "its reference", url: null } : { text: (hostOf(h.of || h.url) || h.title || "the page") + (h.copy ? ` (archived copy${h.asOf ? ", " + h.asOf : ""})` : ""), url: h.of || h.url });
  return hops;
}

/** What the card says when nothing could be cited: Wikipedia is named only as where the lead was found. */
export function pointerWords(trail) {
  const t = trail && typeof trail === "object" ? trail : null;
  const where = t && t.found ? `Wikipedia “${t.found.title}”` : "an encyclopedia article";
  const n = t && Array.isArray(t.refs) ? t.refs.length : 0;
  const why = {
    contradicted: "a page it points to says something else about the same thing", unread: "its references could not be read", unsupported: "its references were read but do not carry this", "no-reference": "it cites nothing for this sentence",
    unlocated: "this sentence could not be matched to its references", unindexed: "its references could not be fetched",
  }[t && t.status] || "no original source was read";
  return `Found in ${where} — not cited: ${why}` + (n ? `. It points to ${n} original source${n === 1 ? "" : "s"}.` : ".");
}

/** The citation-shaped record of a trail's origin (what `citeOf` reads): the original page, the path beside it. null unless an origin was read. */
export function originSource(trail, { ref = null, lang = null } = {}) {
  if (!trail || trail.status !== "origin" || !trail.origin) return null;
  const o = trail.origin;
  return { ref: ref || "O1", title: o.title || o.host, url: o.url, host: o.host, ...(lang ? { lang } : {}), site: o.host };
}

/** A page ALREADY READ this turn (never an encyclopedia) that carries the claim: { url, title, host, via, sentence, passage } | null.
 *  The footnotes did not lead anywhere, but the turn's own search read other pages; one of them saying the same thing is an origin. */
export function corroboration(sentence, passages, { forWhom = null, reading = null, meaning = null } = {}) {
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || typeof p.text !== "string" || !p.text.trim() || !absolute(p.url) || !admitHost(p.url) || p.snippetOnly) continue;   // C1: the same host gate as the search route (A Britannica page already read was an origin: 3 of 14 claims)
    const sup = supportOf(String(sentence ?? ""), p, { forWhom, reading, meaning });
    if (sup.verdict !== "same") continue;
    return { url: p.url, title: p.title || "", host: hostOf(p.url), via: p.via || null, sentence: sup.sentence, address: sup.address, atoms: sup.atoms, identity: sup.identity, rung: sup.rung || "consequence", synonyms: sup.synonyms || null, passage: p };
  }
  return null;
}

// ── the ANSWER's own claim, asked of the search's pages ───────────────────────────────────────────────────────────────────────────────
// A lead seldom cites, and the pages a turn happened to read are few (A1, 2026-10-06: 0 non-encyclopedia pages in 4 of 5 turns). So the answer's atomic claim
// ("Canberra is the capital of Australia.") is asked of the top search hits themselves — but never of a page that is only another index of the same facts.
// Hosts that are not witnesses: copies of the encyclopedia, other encyclopedias, content farms, Q&A, social. Declared, not measured (II.11): the author's table
// (the same classes fold-chat-primary.js drops); `admit` replaces it.
export const NOT_A_WITNESS = Object.freeze([
  /(^|\.)(wikiwand\.com|dbpedia\.org|alchetron\.com|kiddle\.co|wikimili\.com|everybodywiki\.com|wikizero\.[a-z]+|wiki2\.org|wikitrans\.net|infogalactic\.com|justapedia\.org|wikiless\.[a-z.]+|wikimedia\.org|wikidata\.org|fandom\.com|wikia\.(com|org)|miraheze\.org|grokipedia\.com|wikitia\.com)$/i,
  /(^|\.)wik[a-z0-9-]*\.[a-z.]+$/i, /(^|\.)[a-z0-9-]*pedia\.[a-z.]+$/i,
  /(^|\.)(britannica\.com|encyclopedia\.com|newworldencyclopedia\.org|citizendium\.org|worldhistory\.org|encyclopedia\.pub|thefamouspeople\.com|famousbirthdays\.com|infoplease\.com|thefreedictionary\.com|dictionary\.com|merriam-webster\.com)$/i,
  /(^|\.)(answers\.com|reference\.com|ask\.com|ehow\.com|wikihow\.com|buzzle\.com|ranker\.com|factretriever\.com|factslides\.com|thefactsite\.com|brainly\.[a-z.]+|chegg\.com|coursehero\.com|study\.com|bartleby\.com|enotes\.com|sparknotes\.com|geeksforgeeks\.org)$/i,
  /(^|\.)(quora\.com|reddit\.com|answers\.yahoo\.com|stackexchange\.com|stackoverflow\.com|medium\.com|substack\.com|blogspot\.[a-z.]+|wordpress\.com|tumblr\.com)$/i,
  /(^|\.)(facebook\.com|twitter\.com|x\.com|instagram\.com|pinterest\.[a-z.]+|tiktok\.com|linkedin\.com|youtube\.com)$/i,
]);
/** May this URL's page stand as a witness? (absolute, not an encyclopedia/pointer host, not a copy/farm/Q&A/social host) */
export const admitHost = (url) => { const h = hostOf(url); return !!h && absolute(url) && !tertiaryOf(url) && !NOT_A_WITNESS.some((re) => re.test(h)); };

/** `claim` asked of the first `max` admissible `hits` ({ url, title, text?, via? }; a hit that already carries its text is not read again).
 *  Pages are read at once and judged IN SEARCH ORDER; the first that `supportOf` calls `same` is the origin.
 *  → { origin: <as corroboration()>, tried: [{ url, host, read, verdict, why? }] } | { origin: null, tried }. Never throws. */
export async function corroborateAnswer(claim, hits, { read = readText, fetchImpl = globalThis.fetch, memo = null, timeoutMs = ORIGIN.readMs, signal = null, max = ORIGIN.corroborateReads, admit = admitHost, forWhom = null, reading = null, meaning = null } = {}) {
  const tried = [];
  try {
    const seen = new Set(), list = [];
    for (const h of Array.isArray(hits) ? hits : []) {
      if (!h || !absolute(h.url) || !admit(h.url)) continue;
      const k = pageKey(h.url); if (seen.has(k)) continue; seen.add(k); list.push(h);
      if (list.length >= max) break;
    }
    const pages = await Promise.all(list.map(async (h) => {
      if (typeof h.text === "string" && h.text.trim() && !h.snippetOnly) return { ok: true, text: h.text, title: h.title || "", url: h.url, via: h.via || null };
      if (signal && signal.aborted) return null;
      try { return await read(h.url, { fetchImpl, memo, timeoutMs }); } catch { return null; }
    }));
    let origin = null;
    list.forEach((h, i) => {
      const rd = pages[i], host = hostOf(h.url);
      if (!rd || !rd.ok || !rd.text) { tried.push({ url: h.url, host, read: false, verdict: null }); return; }
      const page = { url: rd.url || h.url, title: rd.title || h.title || "", text: rd.text };
      const sup = supportOf(String(claim ?? ""), page, { forWhom, reading, meaning });
      tried.push({ url: h.url, host, read: true, verdict: sup.verdict, ...(sup.why ? { why: sup.why } : {}) });
      if (!origin && sup.verdict === "same") origin = { url: page.url, title: page.title, host: hostOf(page.url), via: rd.via || null, sentence: sup.sentence, address: sup.address, atoms: sup.atoms, identity: sup.identity, rung: sup.rung || "consequence", synonyms: sup.synonyms || null, passage: { ref: "Origin", title: page.title, url: page.url, text: rd.text, via: rd.via || null } };
    });
    return { origin, tried };
  } catch { return { origin: null, tried }; }
}

/** ONE sentence of an encyclopedia passage → its Trail (see the head of this file). Follows the article's own footnotes first; when none
 *  leads to a page that carries the claim, the pages already read (`alongside`) are asked instead; and last, the ANSWER's atomic claim (`answerClaim`, else the
 *  sentence) is asked of the search's top pages (`hits`, see `corroborateAnswer`). Never throws. */
export async function followClaim(opts = {}) {
  const trail = await followFootnotes(opts);
  if (trail.status === "origin") return trail;
  let o = corroboration(opts.sentence, opts.alongside, { forWhom: opts.forWhom, reading: opts.reading, meaning: opts.meaning });
  let viaSearch = false;
  if (!o && Array.isArray(opts.hits) && opts.hits.length) {
    const r = await corroborateAnswer(opts.answerClaim || opts.sentence, opts.hits, { read: opts.read, fetchImpl: opts.fetchImpl, memo: opts.memo, signal: opts.signal, forWhom: opts.forWhom, reading: opts.reading, meaning: opts.meaning, admit: opts.admit, max: opts.maxHits });
    if (r.origin) { o = r.origin; viaSearch = true; }
  }
  const at = trail.found || (opts.passage && opts.passage.url ? { kind: "wikipedia", title: opts.passage.title || "", url: opts.passage.url, edition: null } : null);
  if (!o || !at) return trail;
  const found = { kind: "found-in", title: at.title, url: at.url, edition: at.edition, address: holonAddress(opts.passage, opts.sentence) };
  return { ...trail, found: trail.found || at, status: "origin", pattern: { attests: 1, independent: 1, hosts: [o.host], basis: (viaSearch ? "a page found by searching the answer's claim; " : "a page already read; ") + "distinct hosts (declared proxy for upstream)", also: [] }, origin: { ...o, copy: false }, path: [found, { kind: "alongside", url: o.url }, { kind: "read", url: o.url, via: o.via, title: o.title, copy: false, supports: true }] };
}

// ── what is stored and shown ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A trail without the origin's page text: what rides a stored row. */
export function slimTrail(t) {
  if (!t || typeof t !== "object") return null;
  const o = t.origin ? { url: t.origin.url, copyUrl: t.origin.copyUrl || null, asOf: t.origin.asOf || null, title: t.origin.title, host: t.origin.host, via: t.origin.via || null, copy: !!t.origin.copy, sentence: t.origin.sentence || null, address: t.origin.address || null, identity: t.origin.identity || null, rung: t.origin.rung || null, synonyms: t.origin.synonyms || null } : null;
  return { status: t.status, found: t.found || null, refs: asArr(t.refs), path: asArr(t.path), tried: asArr(t.tried), origin: o, ...(t.fails ? { fails: t.fails } : {}), ...(t.refuter ? { refuter: t.refuter } : {}), ...(t.pattern ? { pattern: t.pattern } : {}) };
}

const asArr = (a) => (Array.isArray(a) ? a : []);
const aWhile = (p, ms, fallback) => new Promise((resolve) => { const t = setTimeout(() => resolve(fallback), ms); p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); }); });

/** Every row an AnswerTurn@1 shows a source for (by identity, de-duplicated). */
function rowsOf(turn) {
  const all = [turn.answer && turn.answer.row, ...asArr(turn.contest), turn.gap && turn.gap.closest, ...asArr(turn.gap && turn.gap.refuters)];
  return [...new Set(all.filter((r) => r && typeof r === "object"))];
}

/** AnswerTurn@1 → the same turn whose encyclopedia rows carry `origin` (a slim Trail) — the original page each sentence rests on, read,
 *  or the pointers when none could be. Nothing else about the turn changes: the row's sentence, filler and standing are what they were;
 *  only WHAT IS CITED does. The turn gains one trace line per row followed (first person, plain words) and, for an answer with no
 *  origin read, a standing "not checked" line. `passages` = the pages the turn already read (an origin may be one of them).
 *  Never throws; a turn with no encyclopedia row comes back as it was. */
export async function originateTurn(turn, { passages = [], fetchImpl = globalThis.fetch, memo = null, signal = null, read = readText, boxMs = ORIGIN.turnBoxMs, forWhom = null, reading, meaning = null, hits = [] } = {}) {
  try {
    if (!turn || typeof turn !== "object" || turn.handoff || turn.aborted) return turn;
    const rows = rowsOf(turn).filter((r) => r.source && isTertiary(r.source.url) && typeof r.sentence === "string" && r.sentence.trim());
    if (!rows.length) return turn;
    const alongside = asArr(passages).filter((p) => p && !tertiaryOf(p.url));
    const memoKey = (r) => r.source.url + "\u0000" + r.sentence;
    // the asker's frame, read once: the cut every claim is compared under (a turn that is not a slot ask has none, and rung 1 alone applies)
    const frameRead = reading !== undefined ? reading : await aWhile(readFrame(turn.said, { fetchImpl, lang: turn.lang && turn.lang.code }), 4000, null);
    const trails = new Map();
    await Promise.all(rows.map(async (r) => {
      const k = memoKey(r);
      if (trails.has(k)) return;
      const own = asArr(passages).find((p) => p && p.url === r.source.url);
      const pending = followClaim({ sentence: r.sentence, passage: { url: r.source.url, title: r.source.title, ref: r.source.ref, text: own ? own.text : "" }, fetchImpl, memo, read, signal, alongside, hits, answerClaim: turn.answer && turn.answer.row === r && typeof turn.answer.text === "string" && turn.answer.text.trim() ? turn.answer.text : undefined, forWhom: forWhom || turn.said || null, reading: frameRead, meaning });
      trails.set(k, pending);
      trails.set(k, await aWhile(pending, boxMs, { status: "unread", found: { kind: "wikipedia", title: r.source.title || "", url: r.source.url, edition: null }, refs: [], path: [], tried: [], origin: null }));
    }));
    const swapped = new Map(rows.map((r) => [r, { ...r, origin: slimTrail(trails.get(memoKey(r))) }]));
    const swap = (r) => swapped.get(r) || r;
    const out = { ...turn };
    const found = rows.map((r) => swapped.get(r).origin);
    const read1 = found.filter((o) => o && o.status === "origin");
    if (turn.answer) {
      const unmeasured = asArr(turn.answer.unmeasured).slice();
      if (!read1.length) unmeasured.push(ORIGIN_NOT_READ);
      out.answer = { ...turn.answer, row: swap(turn.answer.row), unmeasured };
    }
    out.contest = asArr(turn.contest).map(swap);
    if (turn.gap) out.gap = { ...turn.gap, ...(turn.gap.closest ? { closest: swap(turn.gap.closest) } : {}), ...(turn.gap.refuters ? { refuters: turn.gap.refuters.map(swap) } : {}) };
    let n = asArr(turn.trace).reduce((m, l) => Math.max(m, Number.isFinite(l && l.n) ? l.n : 0), 0);
    const lines = [], said = new Set();
    for (const o of found) {
      if (!o || !o.found) continue;
      const key = o.found.url + "|" + o.status + "|" + (o.origin ? o.origin.url : "");
      if (said.has(key)) continue; said.add(key);
      lines.push({ n: ++n, say: traceWords(o), detail: pathWords(o).map((h) => h.text).join(" \u2192 "), result: o.status === "origin" ? "origin read" : "pointers only", probe: null, unmeasured: o.status !== "origin" });
    }
    out.trace = [...asArr(turn.trace), ...lines];
    out.origins = read1.map((o) => o.origin).filter((o, i, a) => o && a.findIndex((x) => x && x.url === o.url) === i);
    return out;
  } catch { return turn; }
}

/** The standing "not checked" line of an answer whose encyclopedia sentence reached no original page. */
export const ORIGIN_NOT_READ = "No original source was read for this: an encyclopedia is a pointer, not a citation, and none of the pages it points to could be read and shown to say the same.";

/** The first-person line of the reasoning trace for one followed sentence (app-authored, never the model's). */
export function traceWords(o) {
  const t = o && o.found ? `\u201c${o.found.title}\u201d` : "that article";
  if (o && o.status === "origin" && o.origin) {
    const how = o.path.some((h) => h.kind === "alongside") ? `a page I had already read says the same: ${o.origin.host}` : `I followed the article's own reference to ${o.origin.host}${o.origin.copy ? " (an archived copy)" : ""} and read it`;
    return `That sentence is on Wikipedia ${t}. Wikipedia is a pointer, not a source I cite, so ${how}.`;
  }
  return `That sentence is on Wikipedia ${t}, which I don't cite. ${pointerWords(o).replace(/^Found in [^\u2014]+\u2014 not cited: /, "")}`;
}
