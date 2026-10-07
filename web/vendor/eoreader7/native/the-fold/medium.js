// medium.js — THE GROUND READER: ANY TEXT AS A SEQUENCE OF ELEMENTS
// (2026-09-22).
//
// The paradigm hunt asks the nine operators of every form at three grains,
// and its Ground grain is the MEDIUM: how the text lays itself out before any
// word is read — its lines, its headings, its list items and labels, its
// indentation, its blocks. A sonnet, a man page, a recipe and a statute are
// laid out in different media (hard-wrapped plain text, troff rendered to a
// terminal, MediaWiki markup, Markdown), and this reader turns each into the
// same thing: an ordered list of elements, each with a class and the handful
// of facts every later cell reads.
//
// What is listed here is CLOSED typographic grammar, the ruler and not the
// shape (CODING-LESSONS 71): the markup of three media (wikitext, Markdown,
// plain), the list markers a writer can use (bullets, enumerators, option
// flags), and one rule for hard-wrapped prose (a line that runs on into a
// lowercase line is one authored line). Which of these a FORM uses is never
// written here — paradigm.js measures it on the form's own instances.
//
// Element classes:
//   heading   a markup heading, or a line with no closing punctuation that is
//             all capitals, or stands alone in its block ahead of more text,
//             no longer than the unit's typical line
//   item      a line opening on a list marker (its label read and kept)
//   label     a marker alone ("1.", "XIV", "(a)") — a separator, not content
//   line      everything else: a verse line, a prose paragraph, a sentence

import { syllables, rhymeKeys } from "./sound.js";
import { permutationCount } from "../kernel/nullcheck.js";
import { createSeededRng } from "../kernel/rng.js";

export const MEDIUM_SCHEMA = "EOMedium@1";

const ROMAN = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
const romanValue = (s) => { const v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }; let n = 0; const t = s.toLowerCase(); for (let i = 0; i < t.length; i++) { const a = v[t[i]], b = v[t[i + 1]] ?? 0; n += a < b ? -a : a; } return n; };

/** A list marker at the start of a line, read into its kind and value. */
export function readMarker(line) {
  const t = String(line ?? "");
  let m;
  if ((m = t.match(/^([-*•·–])\s+(.*)$/))) { const inner = readMarker(m[2]); return inner && inner.kind !== "bullet" && inner.kind !== "option" ? inner : { marker: m[1], kind: "bullet", value: null, rest: m[2] }; }
  if ((m = t.match(/^\((\d+)([A-Z]{0,2})\)\s*(.*)$/))) return { marker: `(${m[1]}${m[2]})`, kind: "paren-arabic", value: Number(m[1]), rest: m[3] };
  if ((m = t.match(/^\(([ivx]+)\)\s*(.*)$/i)) && ROMAN.test(m[1]) && (m[1].length > 1 || /^i$/i.test(m[1]))) return { marker: `(${m[1]})`, kind: "paren-roman", value: romanValue(m[1]), rest: m[2] };
  if ((m = t.match(/^\(([a-z]{1,2})\)\s*(.*)$/i))) return { marker: `(${m[1]})`, kind: "paren-alpha", value: m[1].toLowerCase().charCodeAt(0) - 96, rest: m[2] };
  if ((m = t.match(/^(\d+)[.)](?:\s+(.*)|$)/))) return { marker: `${m[1]}.`, kind: "arabic", value: Number(m[1]), rest: m[2] ?? "" };
  if ((m = t.match(/^([ivxlcdm]+)\.?(?:\s+(.*)|$)/i)) && ROMAN.test(m[1]) && (m[2] == null || /\.$/.test(t.split(/\s/)[0]))) return { marker: m[1], kind: "roman", value: romanValue(m[1]), rest: m[2] ?? "" };
  if ((m = t.match(/^(-{1,2}[A-Za-z0-9@%#?][\w-]*)(?:\s+(.*)|$)/))) return { marker: m[1], kind: "option", value: null, rest: m[2] ?? "" };
  return null;
}

const expandTabs = (s) => { let out = ""; for (const ch of s) out += ch === "\t" ? " ".repeat(8 - (out.length % 8)) : ch; return out; };

/** Which markup the text is written in — read off its own lines. */
export function markupOf(text) {
  const lines = String(text ?? "").split("\n");
  if (lines.filter((l) => /^X:\s*\d+/.test(l)).length >= 1 && lines.some((l) => /^K:/.test(l)) && lines.some((l) => /\|/.test(l) && !/^[A-Za-z]:/.test(l))) return "abc";
  // Two live bugs, reproduced and fixed 2026-09-22, both from the same
  // root cause: a "*"-bullet line is used by BOTH markdown and wikitext
  // lists, and a bare "#" line is used by markdown headings AND
  // MediaWiki's own ordered-list marker — neither one, alone, actually
  // tells the two apart. A generated document mixing "## Section"
  // headings with "* item" bullets (an extremely ordinary markdown shape)
  // was being misread as wikitext, and every "##" heading then parsed as
  // a nested list marker instead of a heading — zero headings found.
  // WIKI-EXCLUSIVE markup (==heading==, '''bold''', [[links]], {{templates}})
  // is never used by markdown at all; a real markdown heading signal
  // (>= 2 "#" lines) wins immediately over ambiguous bullets when no
  // wiki-exclusive marker appears anywhere in the text.
  const wikiExclusive = lines.filter((l) => /^=+[^=].*[^=]=+\s*$/.test(l) || /'''|\[\[|\{\{/.test(l)).length;
  const bullets = lines.filter((l) => /^[*:;]+\s/.test(l)).length;
  const md = lines.filter((l) => /^#{1,6}\s/.test(l) || /\]\(https?:/.test(l)).length;
  if (md >= 2 && wikiExclusive === 0) return "markdown";
  const wiki = wikiExclusive + bullets;
  return wiki > md && wiki >= 2 ? "wikitext" : md >= 2 ? "markdown" : "plain";
}

// Strip inline markup to the words a reader sees; never invents text.
const inlineWiki = (s) => s
  .replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<[^>]+>/g, "")
  .replace(/\{\{[^{}]*\}\}/g, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\S+\s([^\]]*)\]/g, "$1")
  .replace(/'{2,}/g, "").replace(/&nbsp;/g, " ");
const inlineMd = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1").replace(/`([^`]*)`/g, "$1");

/** Raw lines → [{ text, indent, block, heading? level? }] after markup is read. */
function rawLines(text) {
  let t = String(text ?? "").replace(/\r/g, "");
  const markup = markupOf(t);
  if (markup === "wikitext") {
    // Whole-line templates and tables carry no prose of their own.
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
    // A quoted line ("> …", Markdown or a plain-text reply) is read as its own line.
    if (markup !== "wikitext") s = s.replace(/^(>\s*)+/, "").trim();
    if (!s || !/[\p{L}\p{N}]/u.test(s)) continue;
    out.push({ text: s, indent: marked ? marked.depth * 2 : indent, block, heading, level, marked, markup });
  }
  // Auto-numbered wikitext lists count within their run.
  let run = 0, prevDepth = null;
  for (const r of out) { if (r.marked?.kind === "arabic") { run = r.marked.depth === prevDepth ? run + 1 : 1; prevDepth = r.marked.depth; r.marked.value = run; } else { run = 0; prevDepth = null; } }
  return { lines: out, markup };
}

// ── ABC NOTATION (2026-09-22): a tune's header fields and its bars, in the
// same elements as a text's headings and lines. What is read is the closed
// grammar of the notation — field letters, note letters with accidentals and
// octave marks, lengths, bar lines — never any musical form: which meter a
// jig has, where a reel repeats, is measured by paradigm.js / form-prior.js
// on the tunes. A bar's LENGTH is its duration in the tune's unit (the way a
// line's is its syllables); its CLOSE is the bar line that ends it (the way a
// line's is its punctuation); its CADENCE is its final pitch class, so bars
// "rhyme" when they come home to the same note.
const ABC_NOTE = /(\^{1,2}|_{1,2}|=)?([A-Ga-g])([,']*)(\d*)(\/*)(\d*)|z(\d*)(\/*)(\d*)/g;
function abcElements(text) {
  const out = []; let block = 0;
  // The unit of length: the tune's L: field, else the notation's own default
  // (1/8 when the meter is 3/4 or more, else 1/16 — the ABC standard's rule).
  let unit = null, meter = null;
  const frac = (v) => { const m = String(v ?? "").match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) / Number(m[2]) : /^C\|?$/.test(String(v ?? "").trim()) ? 1 : null; };
  const lenOf = (num, slashes, den) => { const n = num ? Number(num) : 1; if (!slashes) return n; const d = den ? Number(den) : 2 ** slashes.length; return n / d; };
  const pushField = (key, value) => out.push({ text: value, cls: key === "X" ? "label" : "field", marker: key, markerKind: key === "X" ? "arabic" : "field", label: key === "X" ? Number(value) || null : null, key, indent: 0, block, level: null, words: 0, syllables: 0, first: key.toLowerCase(), last: "", rhyme: null, cadence: null, end: "", strong: false, caps: false });
  for (const raw of String(text ?? "").replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/%.*$/, "").trim();
    if (!line) { block++; continue; }
    const fm = line.match(/^([A-Za-z]):\s*(.*)$/);
    if (fm) { pushField(fm[1], fm[2].trim()); if (fm[1] === "L") unit = frac(fm[2]); if (fm[1] === "M") meter = frac(fm[2]); if (fm[1] === "X") { unit = null; meter = null; } continue; }
    const U = unit ?? (meter != null && meter < 0.75 ? 1 / 16 : 1 / 8);
    // bars: split on bar lines, keeping each bar's closing line
    const parts = line.replace(/"[^"]*"/g, (m) => m.replace(/\|/g, "")).split(/(\|\]|\|\||\[\|\]?|:\|+:?|\|+:|::|\|\d?|\[\d)/);
    for (let i = 0; i < parts.length; i += 2) {
      const body = (parts[i] ?? "").replace(/\\$/, "").trim();
      const close = (parts[i + 1] ?? "").trim();
      if (!body || !/[A-Ga-gz]/.test(body.replace(/"[^"]*"/g, ""))) continue;
      const chord = (body.match(/"([^"]*)"/) ?? [])[1] ?? null;
      const notesText = body.replace(/"[^"]*"/g, "").replace(/![^!]*!/g, "");
      const notes = [];
      for (const m of notesText.matchAll(ABC_NOTE)) notes.push(m[2] ? { pitch: `${m[1] ?? ""}${m[2]}${m[3] ?? ""}`, pc: m[2].toUpperCase(), len: lenOf(m[4], m[5], m[6]) } : { pitch: "z", pc: "z", len: lenOf(m[7], m[8], m[9]) });
      const sounded = notes.filter((n) => n.pc !== "z");
      out.push({ text: notesText.replace(/\s+/g, " ").trim(), cls: "bar", marker: null, markerKind: null, label: null, indent: 0, block, level: null,
        words: notes.length, syllables: Math.round(notes.reduce((a, n) => a + n.len, 0) * U * 1000) / 1000, // in whole notes
        first: sounded[0]?.pitch ?? "", last: sounded.at(-1)?.pitch ?? "", rhyme: null, cadence: sounded.at(-1)?.pc ?? null,
        end: close.replace(/\d/g, "") || "", strong: /:|\|\||\]/.test(close), caps: false, chord });
    }
  }
  return out.map((e, i) => ({ ...e, i }));
}

const CLOSE = /[.!?:;,)\]"”’'—–-]$/;
const STRONG = /[.!?]["”’')\]]*$/;

/**
 * elementsOf(text) → EOMedium@1 { markup, elements }
 * Each element: { i, text, cls, marker, markerKind, label, indent, block,
 *   level, words, syllables, first, last, rhyme, end, strong, caps }
 */
export function elementsOf(text) {
  if (markupOf(text) === "abc") return { schema: MEDIUM_SCHEMA, markup: "abc", elements: abcElements(text) };
  const { lines, markup } = rawLines(text);
  // Hard wrap: a line that does not close and runs into a lowercase line in
  // the same block, at the same or deeper indent, is one authored line.
  const joined = [];
  const allCaps = (x) => { const L = x.replace(/[^A-Za-z]/g, ""); return L.length >= 2 && L === L.toUpperCase(); };
  for (const l of lines) {
    const prev = joined.at(-1);
    const cont = prev && !prev.heading && !allCaps(prev.text) && !l.heading && !l.marked && prev.block === l.block && !CLOSE.test(prev.text) && /^[a-z(]/.test(l.text) && l.indent >= prev.indent && !readMarker(l.text);
    if (cont) prev.text = prev.text.replace(/-$/, "") + (/-$/.test(prev.text) ? "" : " ") + l.text;
    else if (prev && !prev.heading && !allCaps(prev.text) && !l.heading && !l.marked && prev.block === l.block && CLOSE.test(prev.text) && !STRONG.test(prev.text) && /^[a-z]/.test(l.text) && l.indent > prev.indent && !readMarker(l.text)) prev.text += " " + l.text; // a hanging-indent continuation
    else joined.push({ ...l });
  }
  const wordsOf = (s) => s.split(/\s+/).filter(Boolean);
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const typical = median(joined.filter((l) => !l.heading).map((l) => wordsOf(l.text).length)) || 1;
  const blockSize = new Map(); for (const l of joined) blockSize.set(l.block, (blockSize.get(l.block) ?? 0) + 1);
  const elements = joined.map((l, i) => {
    const m = l.marked ? { marker: l.marked.marker, kind: l.marked.kind, value: l.marked.value ?? null, rest: l.text } : readMarker(l.text);
    const body = m ? m.rest : l.text;
    const w = wordsOf(body);
    const next = joined[i + 1];
    const letters = body.replace(/[^A-Za-z]/g, "");
    const caps = letters.length >= 2 && letters === letters.toUpperCase();
    let cls;
    if (l.heading) cls = "heading";
    else if (m && !w.length) cls = "label";
    else if (m) cls = "item";
    else if (!CLOSE.test(body) && (caps || (blockSize.get(l.block) === 1 && next && next.block !== l.block && w.length <= typical))) cls = "heading";
    else cls = "line";
    const lastWord = (body.toLowerCase().replace(/[’']/g, "").match(/[a-z]+/g) ?? []).at(-1) ?? "";
    return {
      i, text: body, cls, marker: m?.marker ?? null, markerKind: m?.kind ?? null, label: m?.value ?? null,
      indent: l.indent, block: l.block, level: l.level ?? null,
      words: w.length, syllables: w.reduce((a, x) => a + syllables(x), 0),
      first: (body.toLowerCase().replace(/[’']/g, "").match(/[a-z]+/) ?? [""])[0], last: lastWord, rhyme: rhymeKeys(lastWord),
      end: (body.match(/[.!?:;,—–]["”’')\]]*$/)?.[0] ?? "").replace(/["”’')\]]/g, ""), strong: STRONG.test(body), caps,
    };
  });
  return { schema: MEDIUM_SCHEMA, markup, elements };
}

/** An element's skeleton: its class, markup level and the shape of its
 *  characters — so "XIV" and "CXXVI" share one, "1." and "112." another. */
export function skeletonOf(e) {
  const shape = e.cls === "label" ? e.markerKind : e.text.replace(/[A-Z]+/g, "A").replace(/[a-z]+/g, "a").replace(/\d+/g, "9").replace(/\s+/g, " ");
  return `${e.cls}${e.level ? `:h${e.level}` : ""}:${shape}`;
}

// A recurring label/heading skeleton is ambiguous by itself: a book of
// sonnets numbered 1..150 and a single paper's numbered sections 1..9 BOTH
// recur, both can even both be a strictly ascending integer run — no fixed
// property of the marker text tells them apart. What DOES tell them apart,
// measured (2026-09-22, the real failure: NeurIPS's "Attention Is All You
// Need" split into 9 "instances" at its own section headings): true
// recurring items (poems, dictionary entries) are cut into pieces MORE
// UNIFORM in size than an arbitrary same-N-way split of the same document
// would be by chance — a poem is a poem is a poem, but "Introduction" vs.
// "Model Architecture" vs. "References" are wildly different lengths. This
// is the SAME relative-ground discipline as everywhere else in this
// engine: the candidate cut is only accepted if it is a genuine surprise
// against random cuts of the identical material, never a hand-picked
// coefficient-of-variation ceiling.
function randomCutCv(totalLen, n, rnd) {
  const cuts = new Set();
  while (cuts.size < n - 1) cuts.add(1 + Math.floor(rnd() * (totalLen - 1)));
  const pts = [0, ...[...cuts].sort((a, b) => a - b), totalLen];
  const parts = []; for (let i = 0; i < n; i++) parts.push(pts[i + 1] - pts[i]);
  const m = parts.reduce((a, b) => a + b, 0) / parts.length;
  return m ? Math.sqrt(parts.reduce((a, b) => a + (b - m) ** 2, 0) / parts.length) / m : 0;
}
/** p = how often a random same-N-way split of `totalLen` elements is AT
 *  LEAST as uniform as the candidate's real cv — small p means the real
 *  cut is a genuine surprise, not an artifact of splitting anything into N
 *  pieces. Exported for testing without a live document.
 *
 *  p = (ge + 1) / (draws + 1): the real cut counts as one more draw, so p is
 *  never 0 and "p <= level" cuts a true null at most `level` of the time
 *  (plain ge / draws accepted ge = 10 of 200 at 0.05: a false-cut rate of
 *  11/201). The default generator is seeded from the null's own shape,
 *  (totalLen, n): the same material draws the same cuts on every run, and
 *  candidates with the same n are judged against the SAME draws, so a less
 *  uniform one can never pass where a more uniform one failed. Measured
 *  under Math.random (2026-09-29, READING-SPEC S136): 283 of 1,553
 *  live_priors documents with a candidate could read differently on two
 *  runs. */
export function uniformityP(realCv, totalLen, n, { draws = 200, rnd = createSeededRng({ purpose: "medium.uniformityP", totalLen, n }) } = {}) {
  if (n < 2 || totalLen < n) return 1;
  const { ge } = permutationCount(draws, () => randomCutCv(totalLen, n, rnd), (cv) => cv <= realCv);
  return (ge + 1) / (draws + 1);
}

/** The separators segmentCollection weighs, in the order it tries them: each
 *  label or heading skeleton that recurs three times or more, most frequent
 *  first (ties: the one whose units vary least in size), with the units it
 *  cuts and their size cv. Exported so a measurement of segmentCollection
 *  reads its real candidates, not a copy (eval/the-fold/segment-flips.mjs). */
export function collectionCandidates(elements) {
  const counts = new Map();
  for (const e of elements) if (e.cls === "label" || e.cls === "heading") counts.set(skeletonOf(e), (counts.get(skeletonOf(e)) ?? 0) + 1);
  const cv = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return m ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m : 0; };
  const cut = (sk) => { const units = []; let cur = null; for (const e of elements) { if (skeletonOf(e) === sk) { if (cur?.elements.length) units.push(cur); cur = { id: e.marker ?? e.text, elements: [] }; continue; } if (cur) cur.elements.push(e); } if (cur?.elements.length) units.push(cur); return units; };
  return [...counts].filter(([, n]) => n >= 3).map(([sk, n]) => { const u = cut(sk); return { sk, n, units: u, cv: u.length ? cv(u.map((x) => x.elements.length)) : Infinity }; }).sort((a, b) => b.n - a.n || a.cv - b.cv);
}

/** The level a candidate's uniformity p must reach for the collection to be
 *  cut there. DECLARED, not measured: 0.05 is the level this reader has
 *  always cut at, kept so earlier readings keep their meaning — the one
 *  hand-set number here, named so it is not mistaken for a measurement. It
 *  is a level PER CANDIDATE: a text whose many recurring skeletons are tried
 *  in turn has that many chances to clear it by accident (READING-SPEC S136
 *  measures how often). A caller testing under its own T passes its own. */
export const SEGMENT_LEVEL = 0.05;

/**
 * segmentCollection(text, { level, rnd }) → { units: [{ id, elements }], separator, basis }
 * A collection (a book of sonnets, an act of sections) cut at the separator
 * that recurs: of the label and heading skeletons that occur three times or
 * more, the one that occurs most (ties: the one whose units vary least in
 * size) AND whose unit-size uniformity is a genuine surprise against random
 * same-N-way cuts of the same material (uniformityP above, p <= `level`) — a
 * candidate that fails this is refused and the next-best tried; failing all
 * of them, the text is one unit. What precedes the accepted separator is
 * front matter, left out and counted. Each null draws max(200, ceil(2/level))
 * cuts, so p can reach the level with one tie. With no `rnd`, each
 * candidate's null is seeded from its own shape and the same text is always
 * cut the same way; a caller's `rnd` is one stream shared by every candidate.
 */
export function segmentCollection(text, { level = SEGMENT_LEVEL, rnd } = {}) {
  if (!(level > 0 && level <= 1)) throw new RangeError(`segmentCollection: level must be in (0, 1], got ${level}`);
  const { elements, markup } = elementsOf(text);
  const cands = collectionCandidates(elements);
  if (!cands.length) return { units: [{ id: "whole", elements }], separator: null, markup, basis: "no label or heading recurs three times: the text is one unit" };
  const draws = Math.max(200, Math.ceil(2 / level));
  const pText = (p) => p.toFixed(Math.max(3, 1 - Math.floor(Math.log10(level)))); // never prints a real p as 0 at a strict level
  const refusedNotes = [];
  for (const cand of cands) {
    const p = uniformityP(cand.cv, elements.length, cand.n, rnd ? { draws, rnd } : { draws });
    if (p > level) { refusedNotes.push(`"${cand.sk}" refused (p=${pText(p)}, not more uniform than a random ${cand.n}-way cut)`); continue; }
    const front = elements.findIndex((e) => skeletonOf(e) === cand.sk);
    const units = cand.units.map((u) => ({ id: u.id, elements: u.elements.map((e, i) => ({ ...e, i })) }));
    return { units, separator: cand.sk, markup, basis: `cut at "${cand.sk}" (${cand.n} occurrences; unit sizes vary ${cand.cv.toFixed(2)}, p=${pText(p)} <= ${level} vs. a random cut); ${front} element(s) of front matter left out${refusedNotes.length ? `; ${refusedNotes.join("; ")}` : ""}` };
  }
  return { units: [{ id: "whole", elements }], separator: null, markup, basis: `${cands.length} recurring skeleton(s) found but none cut more uniformly than a random same-N-way split would by chance at ${level} (${refusedNotes.join("; ")}): the text is one unit, not a collection` };
}
