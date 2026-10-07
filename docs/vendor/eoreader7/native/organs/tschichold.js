// native/organs/tschichold.js — DEF·Ground: Clearing at Atmosphere, beside
// Alhazen's frame.js. THE SETTING: how the bytes were set, read before any
// word is read, and declared as a frame so that two readings set differently
// never compare silently.
// Handle: Tschichold — after Jan Tschichold (1902–1974), typographer of Die neue Typographie (1928) and The Form of the Book: read how a text is set before reading what it says; a convention is declared, never assumed.
//
// WHY THIS ORGAN EXISTS (2026-09-28, measured, not supposed). Folding the
// archons' original-language texts out of live_priors with the-fold's own
// Ground reader (native/the-fold/medium.js) and paradigm organ found that:
//   1. the stock reader reads the first/last word, capitals, syllables and
//      rhyme with ASCII classes — on 19 of 57 works (Chinese, Arabic, Greek)
//      98–100% of lines came back with no first word at all, and on IAST it
//      returns plausible wrong fragments instead (GRETIL, measured on originals);
//   2. the most "distinctive" typographic facts were the EDITION's, not the
//      author's: Wikisource lines carry one leading space, Gutenberg verse two,
//      the editor's line numbers sit glued to verse ends, page UI (" [ 编辑 ]",
//      " [ recensere ]") sits inside headings, and one fetch doubled a whole
//      book (Marcus Aurelius: 490 of 1017 lines twice) — comparing those
//      facts across works measured the editions;
//   3. the hard-wrap rule of the stock reader is a Latin-case convention
//      (a line continuing in lowercase is prose): Italian verse opens its
//      lines in lowercase (Dante's tercets were glued in pairs) and German
//      prose continues on capitalised nouns (left broken like verse).
// The fix is not a better guess inside each reader; it is a SETTING: read the
// medium's conventions once, state them as rules with their evidence, declare
// the setting as a frame (frame.js: "declare the frame before comparing
// results, never after"), and let every reading carry the setting's id.
//
// THE PARENT TEACHES, THE CHILD REMEMBERS (organs/mnemonic.js's own pattern,
// here for layout). The CV parent (organs/look.js — pdftoppm, OpenCV boxes,
// Tesseract layout) sees a page once; the originals (the source-served bytes:
// Wikisource wikitext, Gutenberg's own files, GRETIL's own editions, the NTRS
// PDFs) are read once; what they teach is kept as a RULE — a primitive over
// bytes, a table of its closed vocabulary, its evidence, its falsification —
// in the bench (live_priors/derived-priors/typography-priors/), so the next
// reading of similar bytes needs neither the look nor the fetch. The user's
// direction for the bench: learn from originals, never trust prior
// extractions (a .txt, a .cv.md, a .structure.json are READINGS), and falsify
// every rule on similar but not identical content.
//
// WHAT IS DECLARED HERE is closed typographic grammar only — the punctuation
// that ends a sentence in each script, the marks that close a line — stated
// as TABLES (Sets), never as regex alternations (KleeneUp's rule). Which
// rules fire on a text is MEASURED on that text, each against a null or the
// house's two bars (low possibility: p ≤ 1/T over the T rules run on this
// text — one false rule expected per reading; high probability: the rule's
// own majority condition). No model, no embeddings, no vectors.
//
// PURE except loadBench (one file read, lazily imported so the organ still
// loads in a browser).

import { readMarker as stockMarker, markupOf, uniformityP, MEDIUM_SCHEMA } from "../the-fold/medium.js";
import { syllableCount } from "./readability.js";
import { declareFrame } from "./frame.js";

export const SETTING_SCHEMA = "EOTypographicSetting@1";
export const BENCH_SCHEMA = "TypographyBench@1";
export const TSCHICHOLD_GIVER = "eoreader7:organs/tschichold.js";
// Schema versioning starts at 1 by construction, incremented only on a real
// breaking change to what this organ declares — not a measured quantity.
export const TSCHICHOLD_VERSION = 1;

// ── CLOSED TYPOGRAPHIC GRAMMAR (tables) ─────────────────────────────────────
const LOCALE = Object.freeze({ lzh: "zh", zho: "zh", cmn: "zh", jpn: "ja", kor: "ko", arb: "ar", ara: "ar", fas: "fa", heb: "he", grc: "el", ell: "el", lat: "la", san: "sa", non: "is", isl: "is", deu: "de", fra: "fr", ita: "it", spa: "es", rus: "ru", eng: "en" });
// Marks that END a sentence, by script (Unicode Sentence_Terminal, read off
// the scripts in this corpus). Folded to their ASCII function in `end`.
const STOP_MARKS = new Map([
  [".", "."], ["!", "!"], ["?", "?"],
  ["。", "."], ["．", "."], ["｡", "."], ["！", "!"], ["？", "?"],
  ["؟", "?"], ["۔", "."],
  ["।", "."], ["॥", "."],
  ["።", "."], ["፧", "?"],
]);
// Marks that CLOSE a clause without ending the sentence.
const CLAUSE_MARKS = new Map([
  [",", ","], [";", ";"], [":", ":"], ["—", "—"], ["–", "—"], ["-", "-"], ["…", "…"],
  ["，", ","], ["、", ","], ["；", ";"], ["：", ":"],
  ["،", ","], ["؛", ";"],
  ["·", ";"],               // Greek ano teleia — a pause between colon and semicolon
  ["፣", ","], ["፤", ";"],
]);
// Closing quotes and brackets that may follow a mark.
const CLOSERS = new Set(['"', "”", "’", "'", ")", "]", "」", "』", "）", "》", "〉", "»", "«"]);
// The Greek question mark is U+037E, canonically ";" — in a Greek text ";" asks.
const QUESTION_SEMICOLON_LANGS = new Set(["grc", "ell"]);

const segCache = new Map();
const segmenter = (lang) => { const loc = LOCALE[lang] ?? lang ?? undefined; if (!segCache.has(loc)) segCache.set(loc, new Intl.Segmenter(loc, { granularity: "word" })); return segCache.get(loc); };
const lower = (w, lang) => { try { return String(w).toLocaleLowerCase(LOCALE[lang] ?? undefined); } catch { return String(w).toLowerCase(); } };
const strip = (w) => String(w ?? "").normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");

/** Word-like segments of a string (ICU; dictionary segmentation for CJK). */
export function wordsOf(s, lang) {
  const out = [];
  for (const x of segmenter(lang).segment(String(s ?? ""))) if (x.isWordLike) out.push(x.segment);
  return out;
}

/** The mark a line ends on, with trailing closers skipped: { mark, fn, strong }.
 *  `fn` is the ASCII function ("." "?" "!" "," ";" ":" "—" "…") or "". */
export function endOf(body, lang = null) {
  const cs = [...String(body ?? "").trimEnd()];
  let i = cs.length - 1;
  while (i >= 0 && CLOSERS.has(cs[i])) i--;
  if (i < 0) return { mark: "", fn: "", strong: false };
  const c = cs[i];
  // Sanskrit in IAST writes the daṇḍa as "|" and the double daṇḍa as "||".
  if (c === "|") return { mark: cs[i - 1] === "|" ? "||" : "|", fn: ".", strong: true };
  if (c === ";" && QUESTION_SEMICOLON_LANGS.has(lang)) return { mark: ";", fn: "?", strong: true };
  if (STOP_MARKS.has(c)) return { mark: c, fn: STOP_MARKS.get(c), strong: true };
  if (CLAUSE_MARKS.has(c)) return { mark: c, fn: CLAUSE_MARKS.get(c), strong: false };
  return { mark: "", fn: "", strong: false };
}
const closes = (body, lang) => endOf(body, lang).fn !== "";

const SCRIPTS = [
  ["latin", /\p{Script=Latin}/u], ["greek", /\p{Script=Greek}/u], ["cyrillic", /\p{Script=Cyrillic}/u],
  ["han", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
  ["abjad", /[\p{Script=Arabic}\p{Script=Hebrew}]/u], ["devanagari", /\p{Script=Devanagari}/u],
];
export const scriptOf = (w) => (SCRIPTS.find(([, re]) => re.test(w)) ?? ["other"])[0];
const VOWELS = Object.freeze({ latin: new Set("aeiouy"), greek: new Set("αεηιουω"), cyrillic: new Set("аеёиоуыэюя") });
const MATRES = new Set(["ا", "و", "ي", "ى", "א"]);
const vowelRuns = (w, vs) => { let n = 0, prev = false; for (const ch of w) { const v = vs.has(ch); if (v && !prev) n++; prev = v; } return n; };

/** A syllable count per script — vowel runs where the script writes vowels,
 *  one per character where it is syllabic, one per consonant for an abjad (a
 *  declared proxy, not a pronunciation). */
export function syllables(word) {
  const w = lower(strip(word).replace(/[’']/g, ""));
  const sc = scriptOf(w);
  if (sc === "latin") return syllableCount(w);
  if (sc === "greek") return Math.max(1, vowelRuns(w, VOWELS.greek));
  if (sc === "cyrillic") return Math.max(1, [...w].filter((c) => VOWELS.cyrillic.has(c)).length);
  if (sc === "han") return [...w].filter((c) => SCRIPTS[3][1].test(c)).length;
  if (sc === "abjad") return Math.max(1, [...w].filter((c) => /\p{L}/u.test(c) && !MATRES.has(c)).length);
  if (sc === "devanagari") return Math.max(1, [...w].filter((c, k, a) => /[ऄ-हक़-ॡ]/u.test(c) && a[k + 1] !== "्").length);
  return 0;
}

/** Spelled rhyme keys, per alphabet (sound.js's rule over each alphabet's own
 *  vowels); for Han the final character itself — no rhyme dictionary here. */
export function rhymeKeys(word) {
  const w = lower(strip(word).replace(/[’']/g, ""));
  if (!w) return null;
  const sc = scriptOf(w);
  if (sc === "han") { const c = [...w].at(-1); return { word: w, tail: c, loose: c, last3: c }; }
  const vs = VOWELS[sc];
  if (!vs) { const t = [...w].slice(-2).join(""); return { word: w, tail: t, loose: t, last3: [...w].slice(-3).join("") }; }
  let x = [...w].filter((c) => /\p{L}/u.test(c)).join("");
  if (!x) return null;
  const whole = x;
  if (sc === "latin" && x.length > 3 && !vs.has(x.at(-2)) && x.at(-1) === "e") x = x.slice(0, -1);
  const cs = [...x];
  let i = cs.length - 1; while (i >= 0 && !vs.has(cs[i])) i--;
  let j = i; while (j > 0 && vs.has(cs[j - 1])) j--;
  const tail = i < 0 ? x : cs.slice(j).join("");
  const tc = [...tail]; let k = 0; while (k < tc.length && vs.has(tc[k])) k++;
  return { word: whole, tail, loose: (tc.find((c) => vs.has(c)) ?? "") + tc.slice(k).join(""), last3: [...whole].slice(-3).join("") };
}

const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xff10];
const digitVal = (d) => { const cp = d.codePointAt(0); const z = DIGIT_ZEROS.find((z0) => cp >= z0 && cp < z0 + 10); return z == null ? NaN : cp - z; };
const numberOf = (s) => { let n = 0; for (const d of s) { const v = digitVal(d); if (Number.isNaN(v)) return null; n = n * 10 + v; } return n; };

/** medium.js's markers, plus a bracketed number "[1119]" and non-ASCII digits. */
export function readMarker(line) {
  const t = String(line ?? "");
  let m;
  if ((m = t.match(/^\[(\p{Nd}+)\]\s*(.*)$/u))) return { marker: `[${m[1]}]`, kind: "bracket-arabic", value: numberOf(m[1]), rest: m[2] };
  if ((m = t.match(/^(\p{Nd}+)[.)](?:\s+(.*)|$)/u)) && /[^0-9]/.test(m[1])) return { marker: `${m[1]}.`, kind: "arabic", value: numberOf(m[1]), rest: m[2] ?? "" };
  return stockMarker(t);
}

// ── THE GROUND READER, SCRIPT-UNIVERSAL ─────────────────────────────────────
const expandTabs = (s) => { let out = ""; for (const ch of s) out += ch === "\t" ? " ".repeat(8 - (out.length % 8)) : ch; return out; };
const inlineWiki = (s) => s
  .replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<[^>]+>/g, "")
  .replace(/\{\{[^{}]*\}\}/g, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\S+\s([^\]]*)\]/g, "$1")
  .replace(/'{2,}/g, "").replace(/&nbsp;/g, " ");
const inlineMd = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1").replace(/`([^`]*)`/g, "$1");

/** medium.js's rawLines, unchanged (it is not exported there). */
function rawLines(text) {
  let t = String(text ?? "").replace(/\r/g, "");
  const markup = markupOf(t);
  if (markup === "wikitext") {
    let depth = 0; const kept = [];
    for (const l of t.split("\n")) { const open = (l.match(/\{\{/g) ?? []).length, close = (l.match(/\}\}/g) ?? []).length; if (depth > 0 || (open > close && /^\s*\{\{/.test(l))) { depth += open - close; if (depth < 0) depth = 0; continue; } if (/^\s*(\{\||\|\}|\|-|\||!)/.test(l) || /^\[\[(Category|File|Image):/i.test(l)) continue; kept.push(l); }
    t = kept.join("\n");
  }
  if (markup === "markdown") t = t.replace(/^---\n[\s\S]*?\n---\n/, "");
  const out = []; let block = 0, blank = true;
  for (const raw of t.split("\n")) {
    const e = expandTabs(raw).replace(/\s+$/, "");
    if (!e.trim()) { if (!blank) block++; blank = true; continue; }
    blank = false;
    const indent = e.length - e.trimStart().length;
    let s = e.trim(), heading = false, level = null, marked = null;
    if (markup === "wikitext") {
      let m;
      if ((m = s.match(/^(=+)\s*(.*?)\s*=+$/))) { heading = true; level = m[1].length; s = m[2]; }
      else if ((m = s.match(/^([*#:;]+)\s*(.*)$/))) { marked = { marker: m[1], kind: m[1].endsWith("#") ? "arabic" : "bullet", depth: m[1].length }; s = m[2]; }
      s = inlineWiki(s).trim();
    } else if (markup === "markdown") {
      let m;
      if ((m = s.match(/^(#{1,6})\s+(.*)$/))) { heading = true; level = m[1].length; s = m[2]; }
      s = inlineMd(s).trim();
    }
    if (markup !== "wikitext") s = s.replace(/^(>\s*)+/, "").trim();
    if (!s || !/[\p{L}\p{N}]/u.test(s)) continue;
    out.push({ text: s, indent: marked ? marked.depth * 2 : indent, block, heading, level, marked, markup });
  }
  let run = 0, prevDepth = null;
  for (const r of out) { if (r.marked?.kind === "arabic") { run = r.marked.depth === prevDepth ? run + 1 : 1; prevDepth = r.marked.depth; r.marked.value = run; } else { run = 0; prevDepth = null; } }
  return { lines: out, markup };
}

const casedLetters = (s) => [...s].filter((c) => c.toUpperCase() !== c.toLowerCase());

/**
 * elementsOf(text, { lang }) → EOMedium@1 { markup, elements, wrapWidth, wrappedBlocks }
 * the-fold/medium.js's element shape, read in any script:
 *   first/last — the first/last word-like segment (Intl.Segmenter);
 *   words — the count of segments; syllables/rhyme — per script (above);
 *   caps — every cased letter capital (uncased scripts: never);
 *   end — the closing mark's ASCII function; strong — it ends a sentence;
 *   hard wrap — decided per BLOCK by the typesetter's rule (see wrapReading).
 */
export function elementsOf(text, { lang = null } = {}) {
  const { lines, markup } = rawLines(text);
  const allCaps = (x) => { const L = casedLetters(x); return L.length >= 2 && L.every((c) => c === c.toUpperCase()); };
  const { W, wrapped } = wrapReading(lines, lang);
  const joined = [];
  for (const l of lines) {
    const prev = joined.at(-1);
    const sameRun = prev && !prev.heading && !l.heading && !l.marked && prev.block === l.block && l.indent >= prev.indent && !readMarker(l.text);
    if (sameRun && wrapped.get(l.block)) prev.text = prev.text.replace(/-$/, "") + (/-$/.test(prev.text) ? "" : " ") + l.text;
    // A turnover: a verse line too long for the measure, continued after a
    // mid-phrase mark on a line indented deeper. The lowercase test scopes it
    // to cased scripts; in an uncased script a turnover stands as its own line.
    else if (prev && !prev.heading && !allCaps(prev.text) && !l.heading && !l.marked && prev.block === l.block && closes(prev.text, lang) && !endOf(prev.text, lang).strong && /^\p{Ll}/u.test(l.text) && l.indent > prev.indent && !readMarker(l.text)) prev.text += " " + l.text;
    else joined.push({ ...l });
  }
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const typical = median(joined.filter((l) => !l.heading).map((l) => wordsOf(l.text, lang).length)) || 1;
  const blockSize = new Map(); for (const l of joined) blockSize.set(l.block, (blockSize.get(l.block) ?? 0) + 1);
  const elements = joined.map((l, i) => {
    const m = l.marked ? { marker: l.marked.marker, kind: l.marked.kind, value: l.marked.value ?? null, rest: l.text } : readMarker(l.text);
    const body = m ? m.rest : l.text;
    const w = wordsOf(body, lang);
    const next = joined[i + 1];
    const L = casedLetters(body);
    const caps = L.length >= 2 && L.every((c) => c === c.toUpperCase());
    const e = endOf(body, lang);
    let cls;
    if (l.heading) cls = "heading";
    else if (m && !w.length) cls = "label";
    else if (m) cls = "item";
    else if (!e.fn && (caps || (blockSize.get(l.block) === 1 && next && next.block !== l.block && w.length <= typical))) cls = "heading";
    else cls = "line";
    const norm = (x) => lower(x.replace(/[’']/g, ""), lang);
    const lastWord = w.length ? norm(w.at(-1)) : "";
    return {
      i, text: body, cls, marker: m?.marker ?? null, markerKind: m?.kind ?? null, label: m?.value ?? null,
      indent: l.indent, block: l.block, level: l.level ?? null,
      words: w.length, syllables: w.reduce((a, x) => a + syllables(x), 0),
      first: w.length ? norm(w[0]) : "", last: lastWord, rhyme: rhymeKeys(lastWord),
      end: e.fn, strong: e.strong, caps,
    };
  });
  return { schema: MEDIUM_SCHEMA, reader: TSCHICHOLD_GIVER, markup, elements, wrapWidth: W, wrappedBlocks: [...wrapped.values()].filter(Boolean).length };
}

/**
 * wrapReading(lines, lang) — HARD WRAP, decided per block by the typesetter's
 * own rule, never by letter case. Two readings of every interior line: did the
 * next word fail to fit (len + 1 + nextFirstWord > W, W = the text's own
 * 95th-percentile interior line length — measured per text), and does the
 * line end mid-phrase (no closing mark)? Wrapped prose breaks at arbitrary
 * word gaps, so both hold for most of its lines; verse of even length passes
 * the first and fails the second. A block with three or more interior lines
 * decides for itself by majority; a shorter one inherits the work's reading.
 */
export function wrapReading(lines, lang = null) {
  const interior = [];
  for (let i = 0; i + 1 < lines.length; i++) if (lines[i].block === lines[i + 1].block) interior.push([...lines[i].text].length + lines[i].indent);
  interior.sort((a, b) => a - b);
  const W = interior.length ? interior[Math.min(interior.length - 1, Math.floor(0.95 * interior.length))] : 0;
  const firstWordLen = (s) => [...(wordsOf(s, lang)[0] ?? "")].length;
  const byBlock = new Map();
  for (const l of lines) (byBlock.get(l.block) ?? byBlock.set(l.block, []).get(l.block)).push(l);
  const tally = new Map(); let wAll = 0, nAll = 0;
  for (const [b, ls] of byBlock) {
    let w = 0;
    for (let i = 0; i + 1 < ls.length; i++) {
      const fits = [...ls[i].text].length + ls[i].indent + 1 + firstWordLen(ls[i + 1].text) > W;
      if (fits && !closes(ls[i].text, lang)) w++;
    }
    tally.set(b, { w, n: ls.length - 1 }); wAll += w; nAll += ls.length - 1;
  }
  const workWrapped = W > 0 && wAll * 2 > nAll;
  const wrapped = new Map();
  for (const [b, { w, n }] of tally) wrapped.set(b, n >= 3 ? w * 2 > n : n >= 1 && workWrapped);
  return { W, wrapped, workWrapped, interiorLines: nAll, wrapCandidates: wAll };
}

/** An element's skeleton in any script: \p{Lu}+→A, \p{Ll}+→a, uncased→o, digits→9. */
export function skeletonOf(e) {
  const shape = e.cls === "label" ? e.markerKind : e.text.replace(/\p{Lu}+/gu, "A").replace(/\p{Ll}+/gu, "a").replace(/[\p{Lo}\p{Lm}\p{M}]+/gu, "o").replace(/\p{Nd}+/gu, "9").replace(/\s+/g, " ");
  return `${e.cls}${e.level ? `:h${e.level}` : ""}:${shape}`;
}

/** segmentCollection's cut and uniformity null, over already-read elements.
 *  The random cuts are seeded (the same material cuts the same way twice).
 *  `level` defaults to segmentCollection's documented 0.05 so the universal
 *  reader cuts where the stock reader cuts; a caller reading under its own T
 *  passes 1/T, and the draws grow so p can reach it. (1/T over the candidates
 *  alone would be no test: one candidate gives a level of 1.) */
export function segmentElements(elements, { rnd = seeded(), level = 0.05 } = {}) {
  const counts = new Map();
  for (const e of elements) if (e.cls === "label" || e.cls === "heading") counts.set(skeletonOf(e), (counts.get(skeletonOf(e)) ?? 0) + 1);
  const cv = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return m ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m : 0; };
  const cut = (sk) => { const units = []; let cur = null; for (const e of elements) { if (skeletonOf(e) === sk) { if (cur?.elements.length) units.push(cur); cur = { id: e.marker ?? e.text, elements: [] }; continue; } if (cur) cur.elements.push(e); } if (cur?.elements.length) units.push(cur); return units; };
  const cands = [...counts].filter(([, n]) => n >= 3).map(([sk, n]) => { const u = cut(sk); return { sk, n, units: u, cv: u.length ? cv(u.map((x) => x.elements.length)) : Infinity }; }).sort((a, b) => b.n - a.n || a.cv - b.cv);
  if (!cands.length) return { units: [{ id: "whole", elements }], separator: null, basis: "no label or heading recurs three times: the text is one unit" };
  const draws = Math.max(200, Math.ceil(2 / level));
  for (const cand of cands) {
    const p = uniformityP(cand.cv, elements.length, cand.n, { rnd, draws });
    if (p > level) continue;
    return { units: cand.units.map((u) => ({ id: u.id, elements: u.elements.map((e, i) => ({ ...e, i })) })), separator: cand.sk, basis: `cut at "${cand.sk}" (${cand.n} occurrences, p=${p.toFixed(3)} ≤ ${level} vs a random cut)` };
  }
  return { units: [{ id: "whole", elements }], separator: null, basis: `${cands.length} recurring skeleton(s), none more uniform than a random cut at ${level}: one unit` };
}

// ── STATISTICS ──────────────────────────────────────────────────────────────
/** A seeded generator in [0, 1): every null in this organ draws reproducibly. */
function seeded(seed = 2166136261) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296);
}
function poissonUpper(c, m) {
  if (c <= 0) return 1;
  if (m <= 0) return 0;
  let logTerm = -m, cdf = 0;
  for (let x = 0; x < c; x++) { cdf += Math.exp(logTerm); logTerm += Math.log(m) - Math.log(x + 1); }
  return Math.max(0, Math.min(1, 1 - cdf));
}

// ── THE RULE PRIMITIVES ─────────────────────────────────────────────────────
// Each primitive is (ctx, params) → { fired, evidence, p? } over a prepared
// context (raw lines, parts). A rule in the bench names its primitive and
// supplies its params (the closed vocabulary as a table, never a pattern).
// `p` is reported where a null exists; the caller holds it to 1/T.

/** Prepare once: raw lines (as written), parts (form feed or a fetcher's
 *  60-rule separator), the text's own numbers. */
export function prepare(text, { lang = null } = {}) {
  const raw = String(text ?? "").replace(/\r/g, "");
  const lines = raw.split("\n");
  const parts = [[]];
  for (const l of lines) {
    if (l.includes("\f") || /^─{20,}\s*$/.test(l)) { parts.push([]); continue; }
    parts.at(-1).push(l);
  }
  return { raw, lang, lines, parts: parts.filter((p) => p.some((l) => l.trim())) };
}

const trimmed = (l) => l.trim();
const nonEmpty = (ls) => ls.map(trimmed).filter(Boolean);

export const PRIMITIVES = Object.freeze({
  /** The editor's lineation: trailing numbers on text lines, every one a
   *  multiple of `step` — under a content null each is with p = 1/step, so
   *  k of k is (1/step)^k. */
  lineation(ctx, { step = 5 } = {}) {
    const nums = [];
    // The last whitespace-separated token, read from the line's end — linear
    // (a lazy /\p{L}.*?\s…$/ backtracked quadratically on GRETIL's 50K-char
    // lines: 22.8 s on Pāṇini, measured).
    for (const l of ctx.lines) {
      const s = l.trimEnd(); const sp = s.lastIndexOf(" ");
      if (sp <= 0) continue;
      const tok = s.slice(sp + 1);
      if (tok.length <= 4 && /^\p{Nd}+$/u.test(tok) && /\p{L}/u.test(s.slice(Math.max(0, sp - 200), sp))) nums.push(numberOf(tok));
    }
    const k = nums.filter((n) => n != null && n % step === 0).length;
    const p = nums.length ? (k === nums.length ? (1 / step) ** k : 1) : 1;
    return { fired: nums.length >= 1 && k === nums.length, p, evidence: { trailingNumbers: nums.length, multiples: k, step } };
  },
  /** Hard-wrapped prose (see wrapReading) — fires when the work reads wrapped. */
  hardWrap(ctx) {
    const { lines } = rawLines(ctx.raw);
    const r = wrapReading(lines, ctx.lang);
    return { fired: r.workWrapped, evidence: { wrapWidth: r.W, interiorLines: r.interiorLines, wrapCandidates: r.wrapCandidates, wrappedBlocks: [...r.wrapped.values()].filter(Boolean).length } };
  },
  /** Page UI rendered as text: a closed table of tokens ("[ edit ]" labels). */
  tokens(ctx, { table = [] } = {}) {
    const hits = {}; let n = 0;
    for (const t of table) { let i = 0, c = 0; while ((i = ctx.raw.indexOf(t, i)) !== -1) { c++; i += t.length; } if (c) { hits[t] = c; n += c; } }
    return { fired: n > 0, evidence: { hits, total: n } };
  },
  /** Whole lines carrying a template's text (a licence box, a download link):
   *  a closed table of substrings. */
  templateLines(ctx, { table = [] } = {}) {
    const hits = {}; let n = 0;
    for (const l of ctx.lines) { const s = l.trim(); for (const t of table) if (s.includes(t)) { hits[t] = (hits[t] ?? 0) + 1; n++; break; } }
    return { fired: n > 0, evidence: { hits, lines: n } };
  },
  /** A page template: a line that heads (appears within the first `head`
   *  lines of) more than half of the parts. */
  pageTemplate(ctx, { head = 12 } = {}) {
    const P = ctx.parts.length;
    if (P < 3) return { fired: false, evidence: { parts: P, reason: "fewer than three parts: nothing recurs per part" } };
    const at = new Map();
    for (const part of ctx.parts) { const seen = new Set(nonEmpty(part).slice(0, head)); for (const s of seen) at.set(s, (at.get(s) ?? 0) + 1); }
    const tmpl = [...at].filter(([s, c]) => c * 2 > P && /[\p{L}]/u.test(s)).map(([s, c]) => ({ line: s.slice(0, 60), parts: c }));
    return { fired: tmpl.length > 0, evidence: { parts: P, template: tmpl.slice(0, 12) } };
  },
  /** A doubled fetch: blocks repeated exactly twice whose length exceeds the
   *  work's median block — a copy, not a refrain (refrains are short and many). */
  duplicateBlocks(ctx) {
    const blocks = ctx.raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const len = blocks.map((b) => [...b].length).sort((a, b) => a - b);
    const med = len[Math.floor(len.length / 2)] ?? 0;
    const c = new Map(); for (const b of blocks) c.set(b, (c.get(b) ?? 0) + 1);
    const doubled = [...c].filter(([b, n]) => n === 2 && [...b].length > med);
    const chars = doubled.reduce((a, [b]) => a + [...b].length, 0);
    return { fired: doubled.length > 0, evidence: { blocks: blocks.length, medianBlockChars: med, doubledBlocks: doubled.length, doubledChars: chars, share: +(chars / Math.max(1, [...ctx.raw].length)).toFixed(4) } };
  },
  /** A flattened edition: sigla (a delimiter, a siglum like ps_1,1.1, the same
   *  delimiter) followed by more text on the same line, for more than half of
   *  the sigla — the edition's line breaks were lost. */
  flattenedSigla(ctx) {
    // The delimiter is a whole run — "||" or "//" as well as "|" or "/":
    // matching a single "/" of Nāgārjuna's "// mmk_1.1 //" left the second
    // slash looking like text after the siglum (measured false positive).
    const re = /(\|\|?|\/\/?)\s*[a-z]+_[\d,.]+\s*(\|\|?|\/\/?)/gu;
    let total = 0, glued = 0;
    for (const l of ctx.lines) { for (const m of l.matchAll(re)) { total++; if (l.slice(m.index + m[0].length, m.index + m[0].length + 16).trim()) glued++; } }
    return { fired: total > 0 && glued * 2 > total, evidence: { sigla: total, followedByText: glued, lines: ctx.lines.length } };
  },
  /** Page numbers: whole lines that are a number — bare or decorated ("5",
   *  "-5-", "(12)", "— 7 —", "[3]": the NTRS reports' own footers and the look
   *  loop's "-9-" shape) — forming a run that counts up (+1 or +2 steps, a
   *  recto/verso skip allowed), for more than half the steps. */
  pageNumbers(ctx) {
    const nums = []; ctx.lines.forEach((l, i) => { const s = l.trim(); const m = s.match(/^[\p{P}\s]{0,3}(\p{Nd}{1,4})[\p{P}\s]{0,3}$/u); if (m && s.length <= 12) nums.push({ n: numberOf(m[1]), i }); });
    let steps = 0; for (let j = 1; j < nums.length; j++) if (nums[j].n === nums[j - 1].n + 1 || nums[j].n === nums[j - 1].n + 2) steps++;
    return { fired: nums.length >= 3 && steps * 2 > nums.length - 1, evidence: { bareNumberLines: nums.length, countingSteps: steps } };
  },
  /** Recurring whole lines against the work's own unigram null (a refrain, a
   *  label, a heading, a template): count vs expected, Poisson, level 1/T over
   *  every recurring line looked at. Reports; fires when any stand. */
  recurringLines(ctx) {
    const toks = ctx.lines.map((l) => wordsOf(l, ctx.lang).map((w) => w.toLowerCase()));
    const N = toks.reduce((a, t) => a + t.length, 0) || 1;
    const f = new Map(); for (const t of toks) for (const w of t) f.set(w, (f.get(w) ?? 0) + 1);
    const byLen = new Map(); for (const t of toks) if (t.length) byLen.set(t.length, (byLen.get(t.length) ?? 0) + 1);
    const cnt = new Map(), at = new Map();
    ctx.lines.forEach((l, i) => { const k = l.trim().replace(/\s+/g, " "); if (!toks[i].length) return; cnt.set(k, (cnt.get(k) ?? 0) + 1); if (!at.has(k)) at.set(k, i); });
    const rec = [...cnt].filter(([, c]) => c >= 2), T = rec.length || 1;
    const stand = rec.map(([k, c]) => { const t = toks[at.get(k)]; const m = (byLen.get(t.length) ?? 0) * Math.exp(t.reduce((a, w) => a + Math.log(f.get(w) / N), 0)); return { line: k.slice(0, 60), count: c, words: t.length, p: poissonUpper(c, m) }; }).filter((x) => x.p <= 1 / T).sort((a, b) => b.count - a.count);
    return { fired: stand.length > 0, evidence: { recurring: rec.length, standing: stand.length, top: stand.slice(0, 12) } };
  },
  /** Speaker labels: recurring short lines (≤ `maxWords` segments) that end on a
   *  stop, standing against the unigram null — or recurring one-token leads
   *  before a stop ("ΘΕΑΙ.", "King."). */
  speakerLabels(ctx, { maxWords = 2 } = {}) {
    const r = PRIMITIVES.recurringLines(ctx);
    // A speaker is named, not numbered: a line that is only a marker ("1."),
    // or whose last word is a numeral ("Canto I.", "Liber II."), is a section
    // head — measured false positives on Nietzsche and Dante, 2026-09-28.
    const ROMAN = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
    const numbered = (line) => { const ws = wordsOf(line, ctx.lang); const last = ws.at(-1) ?? ""; return !ws.some((w) => /\p{L}/u.test(w)) || /^\p{Nd}+$/u.test(last) || ROMAN.test(last); };
    // A label INTRODUCES speech: in more than half its occurrences the next
    // line is text, not a blank. The tail of a hard-wrapped quotation ("me.”",
    // Middlemarch, measured) ends its paragraph instead.
    const introduces = (label) => { let n = 0, followed = 0; ctx.lines.forEach((l, i) => { if (l.trim().replace(/\s+/g, " ") === label) { n++; if ((ctx.lines[i + 1] ?? "").trim()) followed++; } }); return n > 0 && followed * 2 > n; };
    const labels = r.evidence.top.filter((x) => x.words <= maxWords && endOf(x.line, ctx.lang).fn === "." && !numbered(x.line) && introduces(x.line));
    // INLINE CUES ("FAUSTUS. Settle thy studies…", "ΘΕΑΙ. Ναί.", "_Y. Mor._
    // Madam"): a one-token lead ending "." (transcriber underscores and
    // brackets stripped), recurring. A cue is told from a recurring
    // abbreviation ("Q. Fabius", "Mr. Brooke") by TURN-TAKING: consecutive
    // cues change speaker far more often than a random order of the same cues
    // would (1 − Σ pᵢ²) — binomial tail, held to 1/T by the caller. The
    // swarm refuted a standalone-only rule on PG 811's inline cues.
    const seq = [];
    for (const l of ctx.lines) {
      const s = l.trim().replace(/^[_*[(]+/u, "").replace(/^(\S{1,14}?)[_*\])]+(?=\.)/u, "$1");
      const m = s.match(/^(\S{1,14}\.)\s+\S/u);
      if (m && /\p{L}/u.test(m[1]) && wordsOf(m[1], ctx.lang).length === 1 && !numbered(m[1])) seq.push(m[1]);
    }
    const cnt = new Map(); for (const c of seq) cnt.set(c, (cnt.get(c) ?? 0) + 1);
    const cast = new Set([...cnt].filter(([, c]) => c >= 3).map(([c]) => c));
    const cues = seq.filter((c) => cast.has(c));
    let turnP = 1, changes = 0, expected = 0;
    if (cast.size >= 2 && cues.length >= 4) {
      const n = cues.length; for (let i = 1; i < n; i++) if (cues[i] !== cues[i - 1]) changes++;
      const share = [...cast].map((c) => cues.filter((x) => x === c).length / n);
      expected = 1 - share.reduce((a, s) => a + s * s, 0);
      const lC = (N, k) => { let v = 0; for (let i = 1; i <= k; i++) v += Math.log(N - k + i) - Math.log(i); return v; };
      const m = n - 1; let tail = 0; for (let x = changes; x <= m; x++) tail += Math.exp(lC(m, x) + x * Math.log(Math.max(1e-12, expected)) + (m - x) * Math.log(Math.max(1e-12, 1 - expected)));
      turnP = Math.min(1, tail);
    }
    const topLeads = [...cnt].filter(([c]) => cast.has(c)).sort((a, b) => b[1] - a[1]).slice(0, 8);
    // Dialogue needs two voices: one recurring label line is a heading
    // ("Soneto." in Cervantes, measured), not a cast.
    const byLabels = labels.length >= 2;
    return { fired: byLabels || (cast.size >= 2 && changes / Math.max(1, cues.length - 1) > expected && turnP < 1), p: byLabels ? null : turnP, evidence: { labelLines: labels.slice(0, 10), cast: topLeads, cues: cues.length, speakerChanges: changes, expectedChangeRate: +expected.toFixed(3), turnTakingP: turnP } };
  },
  /** Stage directions: recurring bracketed or parenthesised whole lines. */
  stageDirections(ctx) {
    const c = new Map();
    for (const l of ctx.lines) { const s = l.trim(); if (/^[[(].*[\])]\.?$/u.test(s) && /\p{L}/u.test(s)) c.set(s, (c.get(s) ?? 0) + 1); }
    const rec = [...c].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    return { fired: rec.length > 0, evidence: { distinct: rec.length, top: rec.slice(0, 8) } };
  },
  /** Marginal reference letters glued to a line's head (Stephanus b/c/d/e): a
   *  closed table of letters followed by a space and a label-like lead. */
  marginalLetters(ctx, { letters = ["a", "b", "c", "d", "e"] } = {}) {
    const L = new Set(letters); let n = 0; const ex = [];
    for (const l of ctx.lines) { const s = l.trim(); if (s.length > 2 && L.has(s[0]) && s[1] === " " && /^\S{1,12}\.\s/u.test(s.slice(2))) { n++; if (ex.length < 4) ex.push(s.slice(0, 30)); } }
    return { fired: n >= 2, evidence: { lines: n, examples: ex } };
  },
  /** Another hand: lines opening on a declared commentary label (a closed table). */
  anotherHand(ctx, { table = [] } = {}) {
    const hits = {}; let n = 0;
    for (const l of ctx.lines) { const s = l.trim(); for (const t of table) if (s.startsWith(t)) { hits[t] = (hits[t] ?? 0) + 1; n++; break; } }
    return { fired: n > 0, evidence: { hits, lines: n } };
  },
  /** Duplication at a fixed lag (a fetch that concatenated overlapping
   *  subpages): the lag at which exact non-trivial lines recur most, tested
   *  against seeded random lags — p = (random lags matching at least as many
   *  + 1) / (draws + 1). Measured by the swarm on Marcus Aurelius: a 77-line
   *  run at lag 550, 736x the random-lag rate. */
  shiftDuplication(ctx, { draws: declared = 64 } = {}, { level = null } = {}) {
    // A Monte Carlo p never falls below 1/(draws + 1): draw enough random lags
    // that it can reach the level it is judged at, with one lag allowed to tie.
    const draws = level ? Math.max(declared, Math.ceil(2 / level)) : declared;
    const L = ctx.lines.map((l) => l.trim().replace(/\s+/g, " "));
    const n = L.length;
    const real = L.map((s) => wordsOf(s, ctx.lang).length >= 3 ? s : null);
    const at = new Map(); real.forEach((s, i) => { if (s) (at.get(s) ?? at.set(s, []).get(s)).push(i); });
    const lagCount = new Map();
    for (const is of at.values()) if (is.length >= 2 && is.length <= 4) for (let a = 0; a < is.length; a++) for (let b = a + 1; b < is.length; b++) { const d = is[b] - is[a]; lagCount.set(d, (lagCount.get(d) ?? 0) + 1); }
    if (!lagCount.size) return { fired: false, p: 1, evidence: { lines: n, repeatedLines: 0 } };
    const [lag, count] = [...lagCount].sort((x, y) => y[1] - x[1])[0];
    const matchesAt = (d) => { let c = 0; for (let k = 0; k + d < n; k++) if (real[k] && real[k] === real[k + d]) c++; return c; };
    const rnd = seeded();
    let ge = 0; for (let t = 0; t < draws; t++) { const d = 1 + Math.floor(rnd() * Math.max(1, n - 1)); if (d !== lag && matchesAt(d) >= count) ge++; }
    const p = (ge + 1) / (draws + 1);
    let run = 0, best = 0; for (let k = 0; k + lag < n; k++) { if (real[k] && real[k] === real[k + lag]) { run++; best = Math.max(best, run); } else if (real[k]) run = 0; }
    // A concatenated copy never overlaps itself: the lag must exceed the run
    // (lag 1 with a run of 2 is a stutter — three identical lines — measured
    // on the Ashby PDF, not a doubled fetch).
    return { fired: count >= 2 && best >= 2 && lag > best, p, evidence: { lag, matchesAtLag: count, longestRun: best, randomLagDraws: draws, lines: n } };
  },
  /** An old OCR text layer that splits words into letters ("i n f r a r e d"):
   *  runs of four or more single-letter tokens, against the text's own rate
   *  of single-letter tokens (expected runs ≈ N·r^4, Poisson tail). */
  letterSplit(ctx) {
    let N = 0, single = 0, runs = 0; const ex = [];
    for (const l of ctx.lines) {
      const ws = wordsOf(l, ctx.lang); N += ws.length;
      let run = 0;
      for (const w of [...ws, ""]) { if ([...w].length === 1 && /\p{L}/u.test(w)) { single++; run++; } else { if (run >= 4) { runs++; if (ex.length < 3) ex.push(l.trim().slice(0, 50)); } run = 0; } }
    }
    const r = N ? single / N : 0, expected = N * r ** 4;
    const p = runs ? poissonUpper(runs, expected) : 1;
    return { fired: runs >= 2, p, evidence: { tokens: N, singleLetterRate: +r.toFixed(4), runsOf4Plus: runs, expected: +expected.toFixed(3), examples: ex } };
  },
  /** Body boundaries a source declares (a closed table): Project Gutenberg's
   *  START/END banners, GRETIL's "# Text" — keep what lies between. */
  bodyMarkers(ctx, { start = [], end = [] } = {}) {
    const s = ctx.lines.findIndex((l) => start.some((m) => l.trim().startsWith(m)));
    const e = ctx.lines.findIndex((l, i) => i > s && end.some((m) => l.trim().startsWith(m)));
    return { fired: s >= 0 || e >= 0, evidence: { startLine: s, endLine: e, lines: ctx.lines.length } };
  },
  /** Baseline indentation: the modal indent of text lines, when not zero, is
   *  the edition's (read indent relative to it). */
  baselineIndent(ctx) {
    const c = new Map();
    for (const l of ctx.lines) { if (!l.trim()) continue; const ind = expandTabs(l).length - expandTabs(l).trimStart().length; c.set(ind, (c.get(ind) ?? 0) + 1); }
    const [modal, count] = [...c].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
    const total = [...c.values()].reduce((a, b) => a + b, 0);
    return { fired: modal > 0 && count * 2 > total, evidence: { modalIndent: modal, share: +(count / Math.max(1, total)).toFixed(3) } };
  },
  /** A convention the text declares about itself (a transcriber's note): lines
   *  in the text's head that pair a markup character with a declaration phrase
   *  from a closed table ("Umschließungen mit", "transcriber"). */
  declaredConventions(ctx, { phrases = [], head = 60 } = {}) {
    const found = [];
    for (const l of ctx.lines.slice(0, head)) { const s = l.trim(); for (const p of phrases) if (s.toLowerCase().includes(p.toLowerCase())) { found.push(s.slice(0, 120)); break; } }
    const marks = [...new Set(found.flatMap((s) => [...s.matchAll(/(?:mit|with|in)\s+([*~_=+#])/gu)].map((m) => m[1])))];
    return { fired: found.length > 0, evidence: { declarations: found.slice(0, 6), marks } };
  },
});

// ── THE BUILT-IN RULES (the seed bench) ─────────────────────────────────────
// Measured on live_priors EXTRACTIONS while folding the archons (2026-09-28);
// each is re-grounded on originals — or narrowed, or refuted — by the bench.
// `covers` names the TypographyLooks@1 families a rule teaches (by id) and
// `grain` which of the three questions it answers there.
export const SEED_RULES = Object.freeze([
  { id: "lineation-5", name: "editor's lineation every fifth line", family: "source-convention", primitive: "lineation", params: { step: 5 }, action: "strip-trailing-lineation", covers: ["C1.04", "C1.09"], grain: "ground" },
  { id: "hard-wrap", name: "hard-wrapped prose (typesetter's rule)", family: "source-convention", primitive: "hardWrap", params: {}, action: "join-wrapped-blocks", covers: ["C1.02"], grain: "ground" },
  { id: "wikisource-edit-links", name: "Wikisource edit links rendered as text", family: "extraction-artifact", primitive: "tokens", params: { table: [" [ 编辑 ]", " [ 編輯 ]", " [ recensere ]", " [ عدل ]", " [ edit ]", " [ modifier ]", " [ Bearbeiten ]", " [ modifica ]", " [ править ]"] }, action: "strip-tokens", covers: ["C1.16", "C7.02"], grain: "ground" },
  { id: "wikisource-templates", name: "Wikisource templates rendered as text", family: "extraction-artifact", primitive: "templateLines", params: { table: ["公有领域", "Public domain Public domain", "参阅 维基百科", "閲文言 維基大典", " المؤلف ", "نزل نسخة مطبوعة"] }, action: "drop-lines", covers: ["C1.16", "C7.02"], grain: "ground" },
  { id: "page-template", name: "a line heading more than half the parts", family: "extraction-artifact", primitive: "pageTemplate", params: { head: 12 }, action: "drop-template-lines", covers: ["C1.16", "C2.01"], grain: "ground" },
  { id: "doubled-fetch", name: "long blocks repeated exactly twice", family: "extraction-artifact", primitive: "duplicateBlocks", params: {}, action: "drop-second-copies", covers: ["C1.16"], grain: "pattern" },
  { id: "flattened-sigla", name: "edition sigla glued to the next text", family: "extraction-artifact", primitive: "flattenedSigla", params: {}, action: "break-after-sigla", covers: ["C1.02", "C1.06"], grain: "ground" },
  { id: "page-numbers", name: "bare page-number lines counting up", family: "extraction-artifact", primitive: "pageNumbers", params: {}, action: "drop-page-numbers", covers: ["C2.01", "C2.02", "C1.16"], grain: "ground" },
  { id: "recurring-lines", name: "recurring whole lines beyond the unigram null", family: "source-convention", primitive: "recurringLines", params: {}, action: "report", covers: ["C1.04", "C1.05", "C1.07"], grain: "pattern" },
  { id: "speaker-labels", name: "speaker labels", family: "source-convention", primitive: "speakerLabels", params: { maxWords: 2 }, action: "mark-speaker", covers: ["C1.05"], grain: "figure" },
  { id: "stage-directions", name: "stage directions", family: "source-convention", primitive: "stageDirections", params: {}, action: "mark-direction", covers: ["C1.05"], grain: "figure" },
  { id: "stephanus-letters", name: "marginal reference letters on speaker leads", family: "extraction-artifact", primitive: "marginalLetters", params: { letters: ["a", "b", "c", "d", "e"] }, action: "strip-marginal-letter", covers: ["C1.09"], grain: "figure" },
  { id: "commentary-hand", name: "another hand's commentary label", family: "source-convention", primitive: "anotherHand", params: { table: ["【索隱述贊】", "【集解】", "【索隱】", "【正義】"] }, action: "mark-other-hand", covers: ["C1.09"], grain: "figure" },
  { id: "baseline-indent", name: "the edition's baseline indent", family: "extraction-artifact", primitive: "baselineIndent", params: {}, action: "subtract-baseline-indent", covers: ["C1.02", "C1.16"], grain: "ground" },
  { id: "declared-conventions", name: "conventions the text declares about itself", family: "source-convention", primitive: "declaredConventions", params: { phrases: ["Umschließungen mit", "Anmerkungen zur Transkription", "Transcriber's Note", "Transcriber’s Note", "Note du transcripteur", "ADDITIONAL CHARACTERS"] }, action: "honor-declared-markup", covers: ["C1.09"], grain: "ground" },
  { id: "shift-duplication", name: "a run of lines repeated at one fixed lag (overlapping subpages)", family: "extraction-artifact", primitive: "shiftDuplication", params: { draws: 64 }, action: "drop-lagged-run", covers: ["C1.16"], grain: "pattern" },
  { id: "ocr-letter-split", name: "an old OCR text layer splitting words into letters", family: "extraction-artifact", primitive: "letterSplit", params: {}, action: "report", covers: ["C2.02", "C7.01"], grain: "ground" },
  { id: "body-markers", name: "a source's declared body boundaries", family: "source-convention", primitive: "bodyMarkers", params: { start: ["*** START OF", "# Text"], end: ["*** END OF"] }, action: "keep-body-between-markers", covers: ["C1.16", "C1.12"], grain: "ground" },
]);

/**
 * competency(looks, bench) → per TypographyLooks@1 family: the rules that
 * cover it, the grains they answer, and how they stood under falsification.
 *   taught    — at least one HELD (or NARROWED) rule, from a look at originals
 *   learning  — rules exist, none has held yet (seeds, or refuted)
 *   untaught  — no rule: a typed gap, with the exemplar to LOOK at first
 * Measured off the bench, never asserted: a family is taught by rules that
 * survived falsification, not by being listed.
 */
export function competency(looks, bench = { rules: SEED_RULES }) {
  const rules = bench?.rules ?? SEED_RULES;
  const held = (r) => r.standing === "HELD" || r.standing === "NARROWED";
  // Taught is the low bar (a rule that held names the family); runnable is the
  // high one the look loop exists for: a held rule this organ can execute, so
  // similar bytes are read with no look. Same executability as detectRules.
  const runs = (r) => held(r) && !!PRIMITIVES[r.primitive];
  const rows = (looks?.families ?? []).map((f) => {
    const cov = rules.filter((r) => (r.covers ?? []).includes(f.id));
    const grains = [...new Set(cov.filter(held).map((r) => r.grain).filter(Boolean))].sort();
    const status = cov.some(held) ? "taught" : cov.length ? "learning" : "untaught";
    const firstLook = f.exemplars?.find((e) => e.exists)?.path ?? null;
    return { id: f.id, carrier: f.carrier, name: f.name, status, runnable: cov.some(runs), rules: cov.map((r) => ({ id: r.id, standing: r.standing ?? "SEED", grain: r.grain ?? null, runs: runs(r) })), grainsHeld: grains, missingGrains: ["ground", "figure", "pattern"].filter((g) => !grains.includes(g)), lookFirst: status === "taught" ? null : firstLook ?? f.acquire ?? "no exemplar held" };
  });
  const tally = (s) => rows.filter((r) => r.status === s).length;
  return { families: rows.length, taught: tally("taught"), learning: tally("learning"), untaught: tally("untaught"), runnable: rows.filter((r) => r.runnable).length, rows };
}

/** The bench, from live_priors (lazily read; a missing bench is a typed gap,
 *  and the seed rules stand alone, disclosed). */
export async function loadBench({ path = null } = {}) {
  let fsMod, pathMod;
  try { fsMod = await import("node:fs"); pathMod = await import("node:path"); } catch { return { schema: BENCH_SCHEMA, rules: SEED_RULES, gap: "no filesystem here — the seed rules alone" }; }
  const root = globalThis.process?.env?.LIVE_PRIORS_DIR ?? pathMod.join(pathMod.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "live_priors");
  const file = path ?? pathMod.join(root, "derived-priors", "typography-priors", "tschichold-bench-v1.json");
  if (!fsMod.existsSync(file)) return { schema: BENCH_SCHEMA, rules: SEED_RULES, gap: `bench not found at ${file} — the seed rules alone` };
  const bench = JSON.parse(fsMod.readFileSync(file, "utf8"));
  if (bench.schema !== BENCH_SCHEMA) return { schema: BENCH_SCHEMA, rules: SEED_RULES, gap: `bench at ${file} is ${bench.schema}, not ${BENCH_SCHEMA} — the seed rules alone` };
  return { ...bench, file };
}

/** Run every rule of a bench on one text: { fired, quiet, level, T }. A rule
 *  with a null fires only when its p meets 1/T (T = the rules run). */
export function detectRules(text, { lang = null, rules = SEED_RULES, T: Tall = null } = {}) {
  const ctx = prepare(text, { lang });
  const runnable = rules.filter((r) => r.standing !== "REFUTED" && PRIMITIVES[r.primitive]);
  const T = Tall ?? (runnable.length || 1), level = 1 / T;
  const fired = [], quiet = [];
  for (const r of runnable) {
    let out;
    try { out = PRIMITIVES[r.primitive](ctx, r.params ?? {}, { level, T }); } catch (e) { quiet.push({ id: r.id, error: String(e?.message ?? e) }); continue; }
    const stands = out.fired && (out.p == null || out.p <= level);
    (stands ? fired : quiet).push({ id: r.id, name: r.name, family: r.family, action: r.action, p: out.p ?? null, evidence: out.evidence });
  }
  return { fired, quiet, T, level, lines: ctx.lines.length, parts: ctx.parts.length };
}

/**
 * readSetting(text, { lang, bench }) → { setting, frame } — the setting read
 * off the bytes and DECLARED through frame.js: the reader, the bench (with its
 * giver), and the setting's own numbers (wrap width, baseline indent, rules
 * fired, level). Two readings under different settings meet frame.js's
 * cross_frame wall; facts made relative to the setting (indent minus the
 * baseline) are what may cross it.
 */
export async function readSetting(text, { lang = null, bench = null, source = null } = {}) {
  const b = bench ?? { schema: BENCH_SCHEMA, rules: SEED_RULES, giver: TSCHICHOLD_GIVER, gap: "seed rules only" };
  // TWO PASSES — the edition before the author. Artifact rules read the raw
  // bytes and are applied; the author's conventions are read on that cleaned
  // copy (measured: Marcus Aurelius's bracketed notes looked recurrent only
  // because the fetch had doubled the book). One level, 1/T over every rule.
  const runnable = b.rules.filter((r) => r.standing !== "REFUTED" && PRIMITIVES[r.primitive]);
  const T = runnable.length || 1;
  const artifact = runnable.filter((r) => r.family === "extraction-artifact");
  const d1 = detectRules(text, { lang, rules: artifact, T });
  const baseline = d1.fired.find((f) => f.id === "baseline-indent")?.evidence?.modalIndent ?? 0;
  const cleaned = applySetting(text, { fired: d1.fired, numbers: { baselineIndent: baseline }, lang }, { rules: artifact }).text;
  const d2 = detectRules(cleaned, { lang, rules: runnable.filter((r) => r.family !== "extraction-artifact"), T });
  const d = { fired: [...d1.fired, ...d2.fired], quiet: [...d1.quiet, ...d2.quiet], T, level: 1 / T };
  const num = (id, key) => d.fired.find((f) => f.id === id)?.evidence?.[key] ?? d.quiet.find((f) => f.id === id)?.evidence?.[key] ?? null;
  const numbers = { wrapWidth: num("hard-wrap", "wrapWidth") ?? 0, baselineIndent: d.fired.some((f) => f.id === "baseline-indent") ? num("baseline-indent", "modalIndent") : 0, rulesRun: d.T, rulesFired: d.fired.length, level: d.level };
  const declared = await declareFrame({
    organs: { setting: `${TSCHICHOLD_GIVER}@${TSCHICHOLD_VERSION}`, reader: "tschichold.elementsOf" },
    givers: { bench: `${b.giver ?? TSCHICHOLD_GIVER}${b.file ? ` (${b.file})` : ""}` },
    numbers,
  });
  const setting = { schema: SETTING_SCHEMA, lang, source, fired: d.fired, quiet: d.quiet.map((q) => q.id), numbers, benchGap: b.gap ?? null };
  return declared.refused ? { setting, frame: null, refused: declared } : { setting: { ...setting, frame: declared.frame.id }, frame: declared.frame };
}

/**
 * applySetting(text, setting) → { text, ledger } — a READING COPY with the
 * fired rules' actions applied; the source is never replaced (LP1). The
 * ledger says what each action removed or changed, by count.
 */
export function applySetting(text, setting, { rules = SEED_RULES } = {}) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const acts = new Set(setting.fired.map((f) => byId.get(f.id)?.action).filter(Boolean));
  const ledger = {};
  const note = (k, n = 1) => { ledger[k] = (ledger[k] ?? 0) + n; };
  let t = String(text ?? "").replace(/\r/g, "");
  for (const f of setting.fired) {
    const r = byId.get(f.id);
    if (r?.action === "strip-tokens") for (const tok of r.params?.table ?? []) { const parts = t.split(tok); if (parts.length > 1) { note(r.id, parts.length - 1); t = parts.join(""); } }
    if (r?.action === "break-after-sigla") t = t.replace(/((?:\|\|?|\/\/?)\s*[a-z]+_[\d,.]+\s*(?:\|\|?|\/\/?))(?=\s*[\p{L}\p{N}])/gu, (m) => { note(r.id); return `${m}\n\n`; });
  }
  // Whole-text line operations, recomputed on the text being applied so no
  // line index from another pass is trusted.
  if (acts.has("keep-body-between-markers")) {
    const r = rules.find((x) => x.action === "keep-body-between-markers");
    const start = r?.params?.start ?? [], end = r?.params?.end ?? [];
    const ls = t.split("\n");
    const s = ls.findIndex((l) => start.some((m) => l.trim().startsWith(m)));
    const e = ls.findIndex((l, i) => i > s && end.some((m) => l.trim().startsWith(m)));
    if (s >= 0 || e >= 0) { const kept = ls.slice(s >= 0 ? s + 1 : 0, e >= 0 ? e : ls.length); note("body-markers", ls.length - kept.length); t = kept.join("\n"); }
  }
  if (acts.has("drop-lagged-run")) {
    const lag = setting.fired.find((f) => f.id === "shift-duplication")?.evidence?.lag;
    if (lag) {
      const ls = t.split("\n"); const norm = ls.map((l) => l.trim().replace(/\s+/g, " "));
      const drop = new Set(); for (let k = 0; k + lag < ls.length; k++) if (norm[k] && wordsOf(norm[k], setting.lang ?? null).length >= 3 && norm[k] === norm[k + lag]) drop.add(k + lag);
      if (drop.size) { note("shift-duplication", drop.size); t = ls.filter((_, i) => !drop.has(i)).join("\n"); }
    }
  }
  const tmpl = new Set((setting.fired.find((f) => f.id === "page-template")?.evidence?.template ?? []).map((x) => x.line));
  const tmplTable = setting.fired.filter((f) => byId.get(f.id)?.action === "drop-lines").flatMap((f) => byId.get(f.id)?.params?.table ?? []);
  const seenBlocks = new Set();
  const out = [];
  const blocks = t.split(/(\n\s*\n)/);
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (/^\n\s*\n$/.test(b)) { out.push(b); continue; }
    if (acts.has("drop-second-copies")) { const k = b.trim(); if (k && seenBlocks.has(k) && k.length > 200) { note("doubled-fetch"); continue; } seenBlocks.add(k); }
    const kept = [];
    for (let line of b.split("\n")) {
      const s = line.trim();
      if (tmplTable.some((x) => s.includes(x))) { note("wikisource-templates"); continue; }
      if (acts.has("drop-template-lines") && tmpl.has(s.slice(0, 60))) { note("page-template"); continue; }
      if (acts.has("drop-page-numbers") && /^\p{Nd}{1,4}$/u.test(s)) { note("page-numbers"); continue; }
      if (acts.has("strip-trailing-lineation")) { const m = line.match(/^(.*\p{L}.*?)\s+(\p{Nd}{1,4})\s*$/u); if (m && numberOf(m[2]) % 5 === 0) { line = m[1]; note("lineation-5"); } }
      if (acts.has("strip-marginal-letter") && /^[a-e] \S{1,12}\.\s/u.test(s)) { line = line.replace(/^(\s*)[a-e] /u, "$1"); note("stephanus-letters"); }
      kept.push(line);
    }
    out.push(kept.join("\n"));
  }
  t = out.join("");
  if (acts.has("subtract-baseline-indent")) { const m = setting.numbers?.baselineIndent ?? 0; if (m > 0) { const re = new RegExp(`^ {1,${m}}`, "gmu"); t = t.replace(re, () => { note("baseline-indent"); return ""; }); } }
  return { text: t, ledger, frame: setting.frame ?? null };
}

/**
 * compareBytes(a, b, { lang }) → what turned bytes `a` into bytes `b`, as
 * candidate rules ("what I think the rule is"): lines kept, lines DROPPED
 * (grouped — a dropped line that recurs is furniture), lines JOINED (k of a's
 * consecutive lines became one of b's: a wrap), EDGE edits (a trailing number
 * or a leading run removed: lineation, indentation, markers), lines ADDED in b
 * (what the other reading — an OCR look, another edition — saw that a did not).
 * Line identity is whitespace-collapsed text; nothing is scored by similarity.
 */
export function compareBytes(a, b, { lang = null } = {}) {
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const A = String(a ?? "").replace(/\r/g, "").split("\n").map(norm).filter(Boolean);
  const B = String(b ?? "").replace(/\r/g, "").split("\n").map(norm).filter(Boolean);
  const bIndex = new Map(); B.forEach((l, i) => { if (!bIndex.has(l)) bIndex.set(l, []); bIndex.get(l).push(i); });
  const usedB = new Set();
  const take = (l) => { const is = bIndex.get(l); if (!is) return -1; const i = is.find((x) => !usedB.has(x)); if (i == null) return -1; usedB.add(i); return i; };
  const kept = [], dropped = [], joined = [], edge = [];
  for (let i = 0; i < A.length; i++) {
    if (take(A[i]) >= 0) { kept.push(i); continue; }
    let done = false;
    for (let k = 2; k <= 6 && i + k <= A.length && !done; k++) {
      const seq = A.slice(i, i + k);
      const spaced = seq.join(" "), hyph = seq.reduce((s, x) => (s.endsWith("-") ? s.slice(0, -1) + x : s ? `${s} ${x}` : x), "");
      for (const cand of [spaced, hyph]) if (take(cand) >= 0) { joined.push({ at: i, k, hyphen: cand === hyph && cand !== spaced }); i += k - 1; done = true; break; }
    }
    if (done) continue;
    const tail = A[i].match(/^(.*\S)\s+(\p{Nd}{1,4})$/u);
    if (tail && take(tail[1]) >= 0) { edge.push({ at: i, kind: "trailing-number", value: tail[2] }); continue; }
    const head = A[i].match(/^(\S{1,4})\s+(.*)$/u);
    if (head && take(head[2]) >= 0) { edge.push({ at: i, kind: "leading-token", value: head[1] }); continue; }
    // A chunk removed from a line's end or head ("I. [ recensere ]" → "I."):
    // some unused line of b is a proper prefix or suffix of this line.
    const chunk = chunkEdge(A[i]);
    if (chunk) { edge.push({ at: i, kind: chunk.kind, value: chunk.value }); continue; }
    dropped.push(i);
  }
  function chunkEdge(line) {
    for (const [j, bl] of B.entries()) {
      if (usedB.has(j) || bl.length >= line.length || !bl) continue;
      if (line.startsWith(bl) && /\s/u.test(line[bl.length])) { usedB.add(j); return { kind: "trailing-chunk", value: line.slice(bl.length).trim() }; }
      if (line.endsWith(bl) && /\s/u.test(line[line.length - bl.length - 1])) { usedB.add(j); return { kind: "leading-chunk", value: line.slice(0, line.length - bl.length).trim() }; }
    }
    return null;
  }
  const added = B.map((l, i) => i).filter((i) => !usedB.has(i));
  const dropCount = new Map(); for (const i of dropped) dropCount.set(A[i], (dropCount.get(A[i]) ?? 0) + 1);
  const furniture = [...dropCount].filter(([, c]) => c >= 2).sort((x, y) => y[1] - x[1]).map(([line, count]) => ({ line: line.slice(0, 80), count }));
  const tn = edge.filter((e) => e.kind === "trailing-number").map((e) => numberOf(e.value)).filter((n) => n != null);
  const candidates = [];
  if (furniture.length) candidates.push({ rule: "drop-lines", primitive: "templateLines", table: furniture.slice(0, 20).map((f) => f.line), evidence: `${furniture.length} dropped line(s) recur` });
  if (joined.length) candidates.push({ rule: "join-wrapped", primitive: "hardWrap", evidence: `${joined.length} join(s), ${joined.filter((j) => j.hyphen).length} across a hyphen; k = ${[...new Set(joined.map((j) => j.k))].join(",")}` });
  if (tn.length) { const all5 = tn.every((n) => n % 5 === 0); candidates.push({ rule: all5 ? "strip-lineation" : "strip-trailing-numbers", primitive: "lineation", evidence: `${tn.length} trailing number(s) removed${all5 ? `, every one a multiple of 5 (p = ${(0.2 ** tn.length).toExponential(1)} under a content null)` : ""}` }); }
  const lt = new Map(); for (const e of edge.filter((x) => x.kind === "leading-token")) lt.set(e.value, (lt.get(e.value) ?? 0) + 1);
  if (lt.size) candidates.push({ rule: "strip-leading-tokens", primitive: "marginalLetters", table: [...lt].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([v]) => v), evidence: `${edge.filter((x) => x.kind === "leading-token").length} line(s) lost a leading token` });
  const ch = new Map(); for (const e of edge.filter((x) => x.kind.endsWith("-chunk"))) ch.set(`${e.kind}\u0000${e.value}`, (ch.get(`${e.kind}\u0000${e.value}`) ?? 0) + 1);
  if (ch.size) candidates.push({ rule: "strip-tokens", primitive: "tokens", table: [...ch].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k]) => k.split("\u0000")[1]), evidence: `${edge.filter((x) => x.kind.endsWith("-chunk")).length} line(s) lost a chunk at an edge (${[...ch].slice(0, 3).map(([k, c]) => `"${k.split("\u0000")[1].slice(0, 20)}"×${c}`).join(", ")})` });
  if (added.length) candidates.push({ rule: "b-saw-more", primitive: null, evidence: `${added.length} line(s) in b have no source line in a — what the other reading saw (an OCR look, another edition)` });
  return { lines: { a: A.length, b: B.length }, kept: kept.length, dropped: dropped.length, joined: joined.length, edge: edge.length, added: added.length, furniture: furniture.slice(0, 20), candidates };
}

/**
 * falsify(rule, cases) → per case { label, expect, fired, verdict, evidence } and
 * a standing: HELD when every case came out as expected, REFUTED otherwise.
 * `cases`: [{ label, text, lang, expect: "fire" | "not-fire" }].
 */
export function falsify(rule, cases = []) {
  const rows = cases.map((c) => {
    const d = detectRules(c.text, { lang: c.lang ?? null, rules: [rule] });
    const fired = d.fired.some((f) => f.id === rule.id);
    const ok = (c.expect === "fire") === fired;
    return { label: c.label, expect: c.expect, fired, verdict: ok ? "as-expected" : "counterexample", evidence: (d.fired[0] ?? d.quiet[0])?.evidence ?? null };
  });
  return { id: rule.id, standing: rows.every((r) => r.verdict === "as-expected") ? "HELD" : "REFUTED", rows };
}
