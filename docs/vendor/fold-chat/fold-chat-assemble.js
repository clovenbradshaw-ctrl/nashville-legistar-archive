// fold-chat-assemble.js — the BACKWARD path: build the answer FROM the sources, not check it after.
// Pure: no DOM, no IO, no model. Study and bars: docs/BACKWARDS-GROUNDING-PREREG.md; design, results and limits: docs/BACKWARDS-GROUNDING.md.
//
// Forward grounding lets a model write sentences and then looks for a source sentence that says the same thing; a word-matching
// gate cannot tell a good rewording from a bad one. Backward grounding turns it round (THE-HOLOGRAPH §"the skeleton-first turn":
// "the record can compose the answer's skeleton and the mouth can be reduced to voicing it"):
//
//   1. HOLONS   every sentence of every page read is an addressed unit: { address: "<ref>#<start>-<end>", text }. Its identity IS its
//               address (THE-ADDRESS A1-A3): `page.text.slice(start, end) === text` and no two pages share a ref, or the holon is refused.
//   2. SELECT   the holons that bear on the ask, by REFERENT identity (the page's own subject, or every word of the referent on the
//               holon), by ANSWER TYPE (a year bound to an event word; a quantity bound to its dimension word; a person's name), and by the
//               ask's own words (a word no source says is a signal, not noise). Below the declared floor there is no answer: a typed gap,
//               never a near-miss sentence.
//   3. EMIT     each output sentence is `verbatim` (the holon, unchanged — the default, the product rule "find, snip, cite, never
//               rewrite") or `derived` (a unit conversion, or an ordering of two sourced quantities/years: the rule, the numbers and EVERY
//               premise address ride on it and `verifyAssembly` recomputes them). A mechanical REWORDING is never emitted: the paraphrase
//               tool nominates a source sentence, it does not certify equivalence (docs/BACKWARDS-GROUNDING.md), so the answer is quoted.
//   4. IDENTITY by consequence (essay: identity-is-the-fold-at-a-point; seed: "two figures are the same iff they make the same
//               difference to the ground"): relative to the ground (the holons), a sentence's CONSEQUENCE is the set of ground atoms it
//               selects — its window holon, the ground figure each of its figures equals (same quantity in another declared unit, to its
//               own precision), its names, its content terms. `sameClaim` = equal, non-empty consequences. Empty is `undecidable`, typed.
//   `certify` is the forward gate kept as the CHECK on any voiced sentence, plus the structure the gate cannot read (a negation or an
//   ordering is `undecidable`, never accepted) and a unit veto ("330 feet" is not "330 metres").
//
// Declared, not measured (Constitution II.11): the numbers in ASSEMBLE, the cue tables below (English-first and the languages the eval
// asks in), the unit table (the gate's own). Nothing here keys on capitals for scripts without case.

import { segments, fold, scriptOf, casedRuns, entityFromTitle, capitalisationIsSignificant, isUnspaced } from "./fold-chat-mind.js";
import { detectLang } from "./fold-chat-lang.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { attribute, claimOf, namesIn, figuresIn, figureMatches, stemOf, unitOfWord, COMMON_CAP } from "./fold-chat-ground.js";

export const ASSEMBLE = Object.freeze({
  maxPageChars: 12000,   // what the app hands the gate per page
  minWords: 5,           // a shorter line is a heading or a label (the impression's own floor)
  maxWords: 140,         // a longer run is a table or a wall
  commonShare: 0.5,      // a word in at least this share of the pooled holons tells them apart not at all
  coverageFloor: 0.5,    // share of the ask's content words a holon must carry to bear on an UNTYPED ask
  maxSentences: 3,       // sentences quoted (derived lines ride beside their premises and are not counted)
  bindWords: 12,         // a figure belongs with the words within this many words of it (or in its own clause)
});

// Words that only REPORT a measurement beside a figure with a unit ("stands 330 m high"): the unit fixes the dimension, so which of these is used is not the claim.
const MEASURE_WORDS = new Set(["reach", "reaches", "reached", "measure", "measures", "measured", "rise", "rises", "rose", "span", "spans", "extend", "extends", "weigh", "weighs", "weighed", "cover", "covers", "high", "tall", "long", "wide", "deep", "thick", "heavy", "height", "length", "width", "depth", "weight", "altitude", "elevation", "distance", "size", "stands", "stand", "lies", "located", "situated", "about", "around", "approximately", "roughly", "nearly"]);
const TERMINATOR = /[.!?。！？…]["')\]”’」』]*$/u;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── words (fast path for spaced scripts; the script's own segmenter only where words are not spaced) ──────────
const foldTok = (s) => s.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
const ASCII_LETTERS = /^[a-z]+$/;
const stem = (t) => (ASCII_LETTERS.test(t) ? stemOf(t) : t);
const scriptOfSample = (text) => scriptOf(String(text ?? "").slice(0, 400));
/** Folded words of a text. `script` is passed in (a page's script is looked up once, never per sentence). */
function wordsIn(text, script) {
  const s = String(text ?? "");
  if (isUnspaced(script)) return segments(s, script).map((x) => fold(x.text));
  return foldTok(s).match(/[\p{L}\p{N}]+/gu) || [];
}

const ABBREV = /(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|inc|ltd|co|mt|ave|gen|col|capt|lt|sgt|rev|vol|approx|est)\.|\b\p{Lu}\.|(?:\b\p{L}\.){2,})$/iu;
/** Sentences with offsets. A stop ends a sentence only before whitespace (so "8,848.86", "3.5" and "U.S." stay whole); 。！？ end one anywhere; a
 *  line ends one. (fold-chat-impression.js::sentencesWithOffsets drops the head of any sentence that holds a decimal point — docs/BACKWARDS-GROUNDING.md —
 *  so the assembler cuts its own holons.) */
export function sentenceSpans(text) {
  const src = String(text ?? "");
  const out = [];
  let from = 0;
  const push = (to) => {
    const raw = src.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) out.push({ text: t, start: from + lead, end: from + lead + t.length });
    from = to;
  };
  const re = /[.!?]+["')\]”’]*(?=\s|$)|[。！？]+["')\]”’」』]*|\n+/gu;
  let m;
  while ((m = re.exec(src)) !== null) {
    const end = m.index + m[0].length;
    if (/^[.!?]/.test(m[0]) && ABBREV.test(src.slice(from, m.index + 1).trimEnd())) continue;
    push(end);
  }
  push(src.length);
  return out;
}

const hostRef = (u) => { try { return decodeURIComponent(new URL(String(u)).pathname.split("/").filter(Boolean).pop() || String(u)); } catch { return String(u || ""); } };
/** One ref per page, unique in this call (THE-ADDRESS A1: an address names one thing; two pages whose URLs end in the same word are two things). */
export function refsOf(pages) {
  const used = new Map();
  return (Array.isArray(pages) ? pages : []).map((p, i) => {
    const base = String(p?.ref || hostRef(p?.url || p?.source) || `page${i + 1}`);
    const n = used.get(base) || 0; used.set(base, n + 1);
    return n ? `${base}~${n + 1}` : base;
  });
}

/** The entity a page names itself by (title if given, else the last path segment): referent identity of the PAGE. */
export function subjectOf(page, script = null) {
  const raw = page?.title ? String(page.title) : hostRef(page?.url || page?.source || page?.ref || "").replace(/\.(html?|php|aspx?)$/i, "").replace(/[_+-]+/g, " ");
  const t = entityFromTitle(raw.replace(/_/g, " "));
  return wordsIn(t, script || scriptOf(t));
}

// ── holons ─────────────────────────────────────────────────────────────────

/** Every sentence of the pages as an addressed holon. `pages` = [{ url|source, ref?, title?, text }]; page rank = index. */
export function holonsOf(pages, { limits = ASSEMBLE } = {}) {
  const out = [];
  const list = Array.isArray(pages) ? pages : [];
  const refs = refsOf(list);
  list.forEach((p, pi) => {
    const text = String(p?.text ?? "").slice(0, limits.maxPageChars);
    const script = scriptOfSample(text);
    const subject = subjectOf(p);
    for (const s of sentenceSpans(text)) {
      if (!TERMINATOR.test(s.text)) continue;                                 // a line with no stop is a heading, a nav item, a table row
      const toks = wordsIn(s.text, script);
      if (toks.length < limits.minWords || toks.length > limits.maxWords) continue;
      out.push({ address: `${refs[pi]}#${s.start}-${s.end}`, ref: refs[pi], p: pi, source: p?.url || p?.source || null, start: s.start, end: s.end, text: s.text, words: toks.length, subject, script, _toks: toks });
    }
  });
  return out;
}

/** THE-ADDRESS A3: a holon reads back as its own bytes or it is refused. */
export function verifyHolon(h, pages) {
  const p = (pages || [])[h?.p];
  if (!p) return false;
  const text = String(p.text ?? "").slice(0, ASSEMBLE.maxPageChars);
  return text.slice(h.start, h.end) === h.text;
}

// ── the ask ────────────────────────────────────────────────────────────────

// What kind of answer the ask wants — DECLARED cue tables (English first, then the languages the eval asks in). Each language's cues are
// the plain interrogatives of that language, not the eval's sentences. An unlisted language has no typed answer: it falls back to
// referent + the ask's own words, which is the weaker rule, not a wrong one.
const YEAR_CUES = [/\b(?:what year|which year|in what year|when|what date|which date)\b/iu, /\b(?:en qué año|en que año|cuándo|cuando|qué año|fecha)\b/iu, /\b(?:quelle année|en quelle année|quand|date)\b/iu, /\b(?:welchem jahr|in welchem jahr|wann|welches jahr|datum)\b/iu, /\b(?:em que ano|qual ano|quando|data)\b/iu, /(?:в каком году|какого года|когда|дата|год)/iu, /(?:哪一年|哪年|何时|什么时候|几年|年份)/u, /(?:いつ|何年)/u, /(?:متى|أي عام|في أي عام|أي سنة|عام|سنة)/u, /(?:कब|किस वर्ष|किस साल|कौन सा वर्ष)/u, /\b(?:mwaka gani|lini|ilianguka lini|mwaka)\b/iu];
const QTY_CUES = [/\b(?:how (?:tall|high|long|far|deep|wide|heavy|big|much|many)|what is the (?:height|length|depth|weight|population|speed))\b/iu, /\b(?:cuánto mide|qué altura|cuántos|cuánto)\b/iu, /\b(?:quelle hauteur|combien|quelle est la hauteur)\b/iu, /\b(?:wie hoch|wie lang|wie viele|wie groß)\b/iu, /\b(?:qual a altura|quanto mede|quantos)\b/iu, /(?:какова высота|какая высота|сколько)/iu, /(?:多高|多长|多少|有多)/u, /(?:何メートル|どのくらい|高さ)/u, /(?:ما ارتفاع|كم ارتفاع|ما طول|كم)/u, /(?:कितनी ऊँचाई|कितना|कितनी)/u, /\b(?:urefu gani|ni mrefu kiasi gani|kiasi gani)\b/iu];
const WHO_CUES = [/\b(?:who|whom|whose)\b/iu, /\b(?:quién|quiénes|quien)\b/iu, /\b(?:qui)\b/iu, /\b(?:wer|wen|wem)\b/iu, /\b(?:quem)\b/iu, /(?:кто|кого)/iu, /(?:谁|誰|是谁)/u, /(?:誰が|誰)/u, /(?:من هو|من هي|من الذي)/u, /(?:कौन|किसने)/u, /\b(?:nani)\b/iu];
const cueHit = (tables, q) => tables.some((r) => r.test(q));
// Words that only TYPE the answer (they say "a year", "how tall"), never what it is about: not matched against the holons.
const CUE_WORDS = new Set(["year", "years", "when", "date", "tall", "high", "long", "much", "many", "how", "height", "length", "which", "what", "who", "whom", "where", "older", "younger", "taller", "longer", "larger", "bigger", "first", "born", "population", "number"]);
// Which words of a holon bind a QUANTITY to the dimension the ask names ("how tall" → tall/height/high). Declared, English.
const DIM_WORDS = [
  [/\b(?:tall|height|high|taller|tallest|higher|highest)\b/i, ["tall", "height", "high", "tallest", "highest", "taller", "higher"]],
  [/\b(?:long|length|longer|longest|far|distance)\b/i, ["long", "length", "longest", "longer", "flows", "flow", "distance", "extends", "spans", "span"]],
  [/\b(?:deep|depth|deeper|deepest)\b/i, ["deep", "depth", "deepest", "deeper"]],
  [/\b(?:wide|width)\b/i, ["wide", "width", "across"]],
  [/\b(?:heavy|weigh|weight|heavier|mass)\b/i, ["weigh", "weighs", "weight", "mass", "heavy", "heavier"]],
  [/\b(?:speed|fast|velocity)\b/i, ["speed", "velocity", "fast", "travel", "travels", "c"]],
];
// A year is an answer to "when" only beside an EVENT word (it is a year of something): English, declared.
const EVENT_WORDS = ["founded", "established", "chartered", "created", "opened", "incorporated", "formed", "built", "constructed", "completed", "began", "begun", "launched", "inaugurated", "erected", "teaching", "since", "born", "landed", "fell", "ended", "signed", "died", "discovered", "invented", "published", "released", "won", "declared", "independence"];
const BIRTH = ["born", "birth"];
const FOUNDING = ["founded", "established", "chartered", "created", "opened", "incorporated", "formed", "teaching", "since", "built", "constructed", "completed", "began"];

// A comparison ask names two referents and a comparative; the comparative says WHICH quantity. English only (declared limit).
const COMPARE = [
  [/\b(?:older|oldest|earlier|born first|founded first|came first)\b/i, { kind: "year", bigger: false, label: "Older" }],
  [/\b(?:younger|later|born later)\b/i, { kind: "year", bigger: true, label: "Younger" }],
  [/\b(?:taller|higher|tallest|highest)\b/i, { kind: "len", bigger: true, label: "Taller", words: DIM_WORDS[0][1] }],
  [/\b(?:longer|longest)\b/i, { kind: "len", bigger: true, label: "Longer", words: DIM_WORDS[1][1] }],
  [/\b(?:shorter|shortest)\b/i, { kind: "len", bigger: false, label: "Shorter", words: [...DIM_WORDS[1][1], ...DIM_WORDS[0][1]] }],
  [/\b(?:heavier|heaviest)\b/i, { kind: "mass", bigger: true, label: "Heavier", words: DIM_WORDS[4][1] }],
];
const RATE_CUES = /(?:\bper second\b|\/\s*s\b|\bpar seconde\b|\bpor segundo\b|в секунду|每秒|毎秒|في الثانية|प्रति सेकंड)/iu;
const LINK = new Set(["and", "of", "the", "de", "del", "la", "le", "von", "van", "der", "y", "e", "&"]);

/** What the ask is about and what shape of answer it wants. Pure. */
export function askOf(question) {
  const q = String(question ?? "");
  const script = scriptOf(q);
  const det = (() => { try { return detectLang(q); } catch { return { lang: "und" }; } })();
  const lang = det.lang || "und";
  const fw = new Set([...(FUNCTION_WORDS[lang] || []), ...(FUNCTION_WORDS.en || [])].map((w) => fold(w)));
  // referents: cased runs (only where case marks names), a run split by "and"/"of" is one name ("Pride and Prejudice"), a trailing small
  // numeral belongs to it ("Apollo 11")
  const referents = [];
  if (capitalisationIsSignificant(script)) {
    const runs = casedRuns(q, script, { functionWords: fw });
    for (let i = 0; i < runs.length; i++) {
      let r = { ...runs[i] };
      while (i + 1 < runs.length) {
        const gap = q.slice(r.end, runs[i + 1].start).trim().toLowerCase();
        if (gap && gap.split(/\s+/).every((w) => LINK.has(w)) && gap.split(/\s+/).length <= 2) { r = { surface: q.slice(r.start, runs[i + 1].end), start: r.start, end: runs[i + 1].end }; i++; } else break;
      }
      const num = q.slice(r.end).match(/^\s+(\d{1,3})(?![\p{L}\p{N}])/u);
      if (num) r = { surface: `${r.surface} ${num[1]}`, start: r.start, end: r.end + num[0].length };
      const toks = wordsIn(r.surface, script).filter((t) => !fw.has(t));
      if (toks.length) referents.push({ surface: r.surface, toks });
    }
  }
  const refToks = new Set(referents.flatMap((r) => r.toks));
  const qToks = wordsIn(q, script);
  const wants = { year: cueHit(YEAR_CUES, q), quantity: cueHit(QTY_CUES, q), person: cueHit(WHO_CUES, q), unit: null, rate: RATE_CUES.test(q), dimWords: null };
  // a unit the ask names ("in feet", "in miles") is the unit it wants
  for (const t of qToks) { const u = unitOfWord(t); if (u) { wants.unit = { ...u, word: t }; wants.quantity = true; break; } }
  if (wants.quantity) for (const [re, words] of DIM_WORDS) if (re.test(q)) { wants.dimWords = words; break; }
  let compare = null;
  if (referents.length >= 2) for (const [re, spec] of COMPARE) if (re.test(q)) { compare = { ...spec }; break; }
  if (compare && compare.kind === "year") compare.words = /\bborn\b|\bbirth\b/i.test(q) ? BIRTH : FOUNDING;
  const terms = [...new Set(qToks.filter((t) => !fw.has(t) && !CUE_WORDS.has(t) && !refToks.has(t) && !(wants.unit && t === wants.unit.word) && !/^\d+$/.test(t)).map(stem))];
  return { question: q, lang, script, referents, terms, wants, compare };
}

// ── selection ──────────────────────────────────────────────────────────────

const tokSet = (h) => (h._set ||= new Set(h._toks.map(stem)));
const isYear = (f) => f.numeric && !f.unit && /^\d{3,4}$/.test(f.norm) && f.v >= 500 && f.v <= 2200;
// "299 792 458" (a space or thin space between groups of three) is one figure; the replacement is the same length, so offsets stay the holon's own.
const groupThousands = (t) => t.replace(/(?<![\d,.])(\d{1,3})((?:[ \u00a0\u2009\u202f]\d{3})+)(?![\d])/g, (m) => m.replace(/[ \u00a0\u2009\u202f]/g, ","));
const figsOf = (h) => (h._figs ||= figuresIn(groupThousands(h.text)));
const CLAUSE = /[,;:—.!?\n]/;

const EXPONENT_LOST = ["area", "square", "sq", "basin", "drainage", "catchment", "population", "volume"];   // a figure beside these is not a length: the page text lost its exponent ("185,000 km")
const hasAny = (set, words) => words.some((x) => set.has(stem(x)));
/** Word tokens of a holon with their offsets in its text (numbers like "8,848.86" are one token); cached. */
function posOf(h) {
  if (h._pos) return h._pos;
  const out = [];
  if (isUnspaced(h.script)) for (const x of segments(h.text, h.script)) out.push({ t: stem(fold(x.text)), s: x.start, e: x.end });
  else { const re = /[\p{L}\p{N}]+(?:[.,][\p{N}]+)*/gu; let m; while ((m = re.exec(h.text)) !== null) out.push({ t: stem(foldTok(m[0])), s: m.index, e: m.index + m[0].length }); }
  return (h._pos = out);
}
/** Is figure `fig` of holon h bound to one of `words` (a dimension word for a quantity, an event word for a year)? It is when it is the
 *  NEAREST figure of its kind to an occurrence of the word, within bindWords tokens; or when it is the only figure of its kind in the
 *  sentence and the word is in the sentence at all (a long sentence: "Its height was … measured … as 8,848.86 m"). A length beside
 *  "area"/"basin" is not a length. Returns the token distance, or null. */
function bindOf(h, fig, words, kind, n = ASSEMBLE.bindWords) {
  const pos = posOf(h);
  const want = new Set(words.map(stem));
  const of = (f) => pos.findIndex((x) => x.s < f.end && x.e > f.start);
  const kindOf = (f) => (kind === "year" ? isYear(f) : f.unit && f.unit.dim === kind);
  const fi = of(fig);
  if (fi < 0) return null;
  if (kind !== "year" && pos.slice(Math.max(0, fi - 3), fi).some((x) => EXPONENT_LOST.includes(x.t))) return null;
  const peers = figsOf(h).filter((f) => kindOf(f) && !(kind !== "year" && pos.slice(Math.max(0, of(f) - 3), Math.max(0, of(f))).some((x) => EXPONENT_LOST.includes(x.t)))).map((f) => ({ f, i: of(f) })).filter((x) => x.i >= 0);
  const wi = pos.map((x, i) => (want.has(x.t) ? i : -1)).filter((i) => i >= 0);
  if (!wi.length) return null;
  // the figure's own clause (a comma inside a number is not a break) carries a word of the kind
  {
    const segs = [];
    let from = 0;
    const re = /[,;:—.!?\n](?!\d)/g; let m;
    while ((m = re.exec(h.text)) !== null) { segs.push([from, m.index]); from = m.index + 1; }
    segs.push([from, h.text.length]);
    const seg = segs.find(([a, b]) => fig.start >= a && fig.start <= b);
    if (seg && wi.some((i) => pos[i].s >= seg[0] && pos[i].e <= seg[1] + 1)) return 0;
  }
  if (peers.length === 1 && peers[0].f === fig) return Math.min(...wi.map((i) => Math.abs(i - fi)));
  let best = null;
  for (const i of wi) {
    const owner = peers.reduce((a, b) => (Math.abs(b.i - i) < Math.abs(a.i - i) ? b : a), peers[0]);
    if (owner.f === fig && Math.abs(owner.i - i) <= n) best = best === null ? Math.abs(owner.i - i) : Math.min(best, Math.abs(owner.i - i));
  }
  return best;
}

/** Does holon h carry referent r? By the page's own subject (equal, or beginning with the referent: identity, not containment), or by EVERY
 *  word of the referent on the holon; across languages (the ask and the page differ) the referent's rarest word is what a translation keeps. */
function carries(h, r, df, cross) {
  const sub = h.subject.filter(Boolean);
  const rt = r.toks;
  if (sub.length && sub.length >= rt.length && rt.every((t, i) => sub[i] === t)) return "subject";
  const set = tokSet(h);
  const need = cross ? [rt.filter((t) => !/^\d+$/.test(t)).sort((a, b) => (df.get(stem(a)) || 1e9) - (df.get(stem(b)) || 1e9))[0] || rt[0]] : rt;
  return need.every((t) => set.has(stem(t))) ? "mention" : null;
}

function scoreHolons(ask, holons, pageLang) {
  const N = Math.max(1, holons.length);
  const df = new Map();
  for (const h of holons) for (const t of tokSet(h)) df.set(t, (df.get(t) || 0) + 1);
  const content = ask.terms;                               // every content word of the ask, including the ones no source says
  const telling = content.filter((t) => (df.get(t) || 0) / N < ASSEMBLE.commonShare);
  const w = (t) => Math.log(1 + N / (df.get(t) || 1));
  const typedAsk = !!(ask.wants.year || (ask.wants.quantity && (ask.wants.unit || ask.wants.dimWords)) || ask.wants.person);
  const rows = [];
  for (const h of holons) {
    const set = tokSet(h);
    const present = telling.filter((t) => set.has(t));
    const cov = content.length ? content.filter((t) => set.has(t)).length / content.length : 1;
    const cross = !!(pageLang[h.p] && pageLang[h.p] !== ask.lang);
    const car = ask.referents.map((r) => carries(h, r, df, cross));
    const carried = ask.referents.length ? car.some(Boolean) : true;
    const figs = figsOf(h);
    let typed = true, typeWhy = "";
    if (ask.wants.year) {
      typeWhy = "year";
      typed = figs.some((f) => isYear(f) && (ask.lang !== "en" || bindOf(h, f, EVENT_WORDS, "year") !== null));
    }
    if (typed && ask.wants.quantity && ask.wants.unit) {
      typeWhy = "quantity:" + ask.wants.unit.dim;
      typed = figs.some((f) => f.unit && f.unit.dim === ask.wants.unit.dim && isRate(h, f) === !!ask.wants.rate && (!ask.wants.dimWords || ask.lang !== "en" || bindOf(h, f, ask.wants.dimWords, ask.wants.unit.dim) !== null));
    } else if (typed && ask.wants.quantity && ask.wants.dimWords) {
      typeWhy = "quantity";
      typed = figs.some((f) => f.numeric && !isYear(f) && (ask.lang !== "en" || f.unit && bindOf(h, f, ask.wants.dimWords, f.unit.dim) !== null));
    } else if (typed && ask.wants.quantity && !ask.wants.year) { typeWhy = "quantity"; typed = figs.some((f) => f.numeric); }
    if (typed && ask.wants.person && capitalisationIsSignificant(h.script)) {
      typeWhy = "person";
      const refSet = new Set(ask.referents.flatMap((r) => r.toks));
      typed = namesIn(h.text).some((n) => { const nt = wordsIn(n, h.script); return nt.length >= 2 && !nt.every((t) => refSet.has(t)); });
    }
    const score = present.reduce((a, t) => a + w(t), 0) + (car.includes("subject") ? 2 : 0) + (car.includes("mention") ? 1 : 0) + (typed ? 1.5 : 0);
    rows.push({ h, cov, carried, typed, typeWhy, score, present });
  }
  return { rows, telling, df, typedAsk };
}

// ── derivation ─────────────────────────────────────────────────────────────

const sig = (n) => String(n).replace(/^0+\.?0*/, "").replace(/\./, "").replace(/0+$/, "").length || 1;
const fmt = (v, digits) => String(Number(v.toPrecision(digits)));
/** Does the figure carry a per-second rate ("299,792,458 metres per second", "m/s")? */
const isRate = (h, fig) => /^\s*[\p{L}²³]+\s*(?:per second|\/\s*s\b)/iu.test(h.text.slice(fig.end));
const displayUnit = (h, fig) => { const rest = h.text.slice(fig.end).replace(/^\s?/, ""); const m = rest.match(/^[\p{L}²³]+/u); return m ? m[0] : fig.unit.w; };

/** A unit conversion premise → derived line. `fig` is the source figure (with its unit), `target` the ask's unit. */
function convert(h, fig, target) {
  const digits = Math.min(6, sig(fig.norm) + 2);
  const value = (fig.v * fig.unit.f) / target.f;
  const rate = isRate(h, fig);
  return {
    text: `${fig.raw} ${displayUnit(h, fig)}${rate ? "/s" : ""} = ${fmt(value, digits)} ${target.word}${rate ? "/s" : ""}`,
    derivation: { rule: "unit-conversion", premises: [{ address: h.address, figure: fig.raw, unit: fig.unit.w, at: [fig.start, fig.end] }], from: fig.unit.w, to: target.w, factor: fig.unit.f / target.f, value: Number(value.toPrecision(digits)), digits, rate, table: "fold-chat-ground UNIT_TABLE" },
  };
}

/** Recompute a derived sentence from its premises: the checker's half of "carries its derivation". */
export function verifyDerivation(d, holons) {
  const dv = d?.derivation;
  if (!dv) return { ok: false, why: "no-derivation" };
  const by = new Map(holons.map((h) => [h.address, h]));
  if (dv.rule === "unit-conversion") {
    const pr = dv.premises?.[0]; const h = by.get(pr?.address);
    if (!h) return { ok: false, why: "premise-address" };
    const fig = figsOf(h).find((f) => f.start === pr.at[0] && f.end === pr.at[1]);
    if (!fig || !fig.unit || fig.raw !== pr.figure) return { ok: false, why: "premise-figure" };
    const to = unitOfWord(dv.to);
    if (!to || fig.unit.dim !== to.dim) return { ok: false, why: "dimension" };
    const v = Number(((fig.v * fig.unit.f) / to.f).toPrecision(dv.digits));
    return { ok: v === dv.value && String(d.text).includes(String(v)), why: v === dv.value ? "" : "arithmetic" };
  }
  if (dv.rule === "compare-quantity" || dv.rule === "compare-year") {
    for (const pr of dv.premises || []) {
      const h = by.get(pr.address);
      if (!h) return { ok: false, why: "premise-address" };
      const fig = figsOf(h).find((f) => f.start === pr.at[0] && f.end === pr.at[1]);
      if (!fig || fig.raw !== pr.figure) return { ok: false, why: "premise-figure" };
      const base = dv.rule === "compare-year" ? fig.v : fig.v * (fig.unit?.f ?? NaN);
      if (!(Math.abs(base - pr.base) <= 1e-9 * Math.max(1, Math.abs(base)))) return { ok: false, why: "arithmetic" };
    }
    const [a, b] = dv.premises;
    const gt = a.base > b.base;
    return { ok: dv.winner === (gt === dv.bigger ? 0 : 1) && a.base !== b.base, why: "order" };
  }
  return { ok: false, why: "unknown-rule" };
}

/** The figure of the right kind on holon h that is BOUND to the quantity's own words (a year to an event word; a length to "long"). */
function boundFigure(h, spec) {
  const figs = figsOf(h);
  if (spec.kind === "year") return figs.find((f) => isYear(f) && bindOf(h, f, spec.words, "year") !== null) || null;
  return figs.find((f) => f.unit && f.unit.dim === spec.kind && f.numeric && !isRate(h, f) && bindOf(h, f, spec.words, spec.kind) !== null) || null;
}

function compareDerivation(ask, rows, df, pageLang) {
  const spec = ask.compare; if (!spec) return null;
  const picks = [];
  for (let k = 0; k < Math.min(2, ask.referents.length); k++) {
    const r = ask.referents[k];
    let best = null;
    for (const row of rows) {
      const h = row.h;
      const cross = !!(pageLang[h.p] && pageLang[h.p] !== ask.lang);
      const c = carries(h, r, df, cross);
      if (!c) continue;
      const fig = boundFigure(h, spec);
      if (!fig) continue;
      const score = row.score + (c === "subject" ? 2 : 0);
      if (!best || score > best.score) best = { h, fig, score, r };
    }
    if (!best) return { gap: { kind: "no-figure-of-kind", about: r.surface, detail: spec.kind } };
    picks.push(best);
  }
  if (picks.length < 2) return null;
  const base = (p) => (spec.kind === "year" ? p.fig.v : p.fig.v * p.fig.unit.f);
  const a = base(picks[0]), b = base(picks[1]);
  if (a === b) return { gap: { kind: "no-difference", about: ask.referents.map((r) => r.surface).join(" / "), detail: "equal" } };
  const winner = (a > b) === spec.bigger ? 0 : 1;
  const show = (p) => `${p.r.surface}: ${p.fig.raw}${p.fig.unit ? " " + displayUnit(p.h, p.fig) : ""}`;
  const cmp = a > b ? ">" : "<";
  return {
    premises: picks,
    sentence: {
      text: `${spec.label}: ${picks[winner].r.surface} (${show(picks[0])} ${cmp} ${show(picks[1])})`,
      address: picks.map((p) => p.h.address), how: "derived",
      derivation: { rule: spec.kind === "year" ? "compare-year" : "compare-quantity", kind: spec.kind, bigger: spec.bigger, winner, premises: picks.map((p) => ({ address: p.h.address, figure: p.fig.raw, unit: p.fig.unit?.w || null, at: [p.fig.start, p.fig.end], base: base(p) })) },
    },
  };
}

// ── assemble ───────────────────────────────────────────────────────────────

const pageLangs = (pages) => pages.map((p) => { try { const d = detectLang(String(p.text).slice(0, 600)); return d.confident ? d.lang : null; } catch { return null; } });

/**
 * assemble({ question, pages }) → { sentences:[{ text, address:[…], how:'verbatim'|'derived', derivation? }], gaps:[{ kind, about, detail }], ask, holons: n, ms }
 * Never calls a model; never emits a sentence that is not a holon of the pages or a derivation recomputable from holons.
 */
export function assemble({ question, pages = [], limits = ASSEMBLE, now = () => Date.now() } = {}) {
  const t0 = now();
  const done = (sentences, gaps, ask, n) => ({ sentences, gaps, ask, holons: n, ms: now() - t0 });
  const ok = (Array.isArray(pages) ? pages : []).filter((p) => String(p?.text ?? "").trim());
  if (!ok.length) return done([], [{ kind: "no-source", about: String(question ?? ""), detail: "no page was read" }], askOf(question), 0);
  const holons = holonsOf(ok, { limits }).filter((h) => verifyHolon(h, ok));
  const ask = askOf(question);
  if (!holons.length) return done([], [{ kind: "no-source", about: ask.question, detail: "no readable sentence on any page" }], ask, 0);
  const pl = pageLangs(ok);
  const { rows, df, typedAsk } = scoreHolons(ask, holons, pl);
  const bearing = rows.filter((r) => r.carried && (typedAsk || r.cov >= limits.coverageFloor) && (ask.terms.length || ask.referents.length || typedAsk));
  const sentences = [], gaps = [];

  // a comparison derives from two sourced quantities, each bound to its own words, each with its own premise; the premises are quoted beside it
  if (ask.compare) {
    const cmp = compareDerivation(ask, rows, df, pl);
    if (cmp?.sentence) {
      for (const p of cmp.premises) sentences.push({ text: p.h.text, address: [p.h.address], how: "verbatim" });
      sentences.push(cmp.sentence);
      return done(sentences, gaps, ask, holons.length);
    }
    if (cmp?.gap) { gaps.push({ ...cmp.gap }); return done(sentences, gaps, ask, holons.length); }   // a comparison that cannot be derived is a gap, not a pile of unrelated sentences
  }

  const pool = bearing.filter((r) => r.typed);
  if (!pool.length) {
    const near = rows.filter((r) => r.carried);
    if (bearing.length && typedAsk) gaps.push({ kind: "no-figure-of-kind", about: ask.question, detail: [...new Set(bearing.map((r) => r.typeWhy).filter(Boolean))].join(",") || "typed answer wanted" });
    else if (near.length) gaps.push({ kind: "no-holon-bears", about: ask.question, detail: `best coverage ${Math.max(...near.map((r) => r.cov)).toFixed(2)} < ${limits.coverageFloor}` });
    else {
      const dl = (() => { try { return detectLang(ok.map((p) => String(p.text).slice(0, 800)).join(" ")); } catch { return {}; } })();
      gaps.push(dl.lang && dl.lang !== ask.lang && dl.confident ? { kind: "language-gap", about: ask.question, detail: `${ask.lang} ask, ${dl.lang} sources` } : { kind: "no-holon-bears", about: ask.question, detail: "no sentence carries the ask's referent" });
    }
    return done(sentences, gaps, ask, holons.length);
  }
  pool.sort((a, b) => b.score - a.score || a.h.p - b.h.p || a.h.start - b.h.start);
  const seen = [], keep = [];
  for (const r of pool) {
    const key = norm(r.h.text).toLowerCase();
    if (seen.some((k) => k === key || k.includes(key) || key.includes(k))) continue;
    seen.push(key); keep.push(r);
    if (keep.length >= limits.maxSentences) break;
  }
  for (const r of keep) sentences.push({ text: r.h.text, address: [r.h.address], how: "verbatim", score: Number(r.score.toFixed(3)) });

  // a unit the ask names that no kept holon STATES (same dimension, same unit, same rate-ness): convert the best holon's figure of that dimension
  const target = ask.wants.unit;
  if (target) {
    const states = keep.some((r) => figsOf(r.h).some((f) => f.unit && f.unit.dim === target.dim && f.unit.f === target.f && isRate(r.h, f) === !!ask.wants.rate));
    if (!states) {
      for (const r of keep) {
        const fig = figsOf(r.h).find((f) => f.unit && f.unit.dim === target.dim && f.numeric && isRate(r.h, f) === !!ask.wants.rate && (!ask.wants.dimWords || ask.lang !== "en" || bindOf(r.h, f, ask.wants.dimWords, ask.wants.unit.dim) !== null));
        if (fig) { const d = convert(r.h, fig, target); sentences.push({ text: d.text, address: [r.h.address], how: "derived", derivation: d.derivation }); break; }
      }
    }
  }
  return done(sentences, gaps, ask, holons.length);
}

/** The checker's half of B2: every verbatim sentence reads back as its address; every derived one recomputes. Returns { ok, violations }. */
export function verifyAssembly(result, pages) {
  const ok = (Array.isArray(pages) ? pages : []).filter((p) => String(p?.text ?? "").trim());
  const holons = holonsOf(ok);
  const violations = [];
  const byAddr = new Map();
  for (const h of holons) { if (byAddr.has(h.address)) violations.push({ text: h.text, why: "address-names-two-things" }); byAddr.set(h.address, h); }
  for (const s of result?.sentences || []) {
    if (s.how === "verbatim") {
      const h = byAddr.get(s.address?.[0]);
      if (!h || h.text !== s.text || !verifyHolon(h, ok)) violations.push({ text: s.text, why: "verbatim-not-at-address" });
    } else if (s.how === "derived") {
      const v = verifyDerivation(s, holons);
      if (!v.ok) violations.push({ text: s.text, why: "derivation:" + v.why });
      for (const a of s.address || []) if (!byAddr.has(a)) violations.push({ text: s.text, why: "derived-premise-address" });
    } else violations.push({ text: s.text, why: "unknown-how" });
  }
  return { ok: violations.length === 0, violations };
}

// ── identity by consequence ────────────────────────────────────────────────

// Structure a lexical gate cannot read. A sentence carrying one is `undecidable`: it is never accepted and never merged (declared cue tables:
// English, es, fr, de, ru, zh, ja, ar; an unlisted language is not guarded — said in docs/BACKWARDS-GROUNDING.md).
const NEGATION = /(?:\b(?:not|never|no|nor|neither|without|cannot|isn't|wasn't|doesn't|didn't|won't|n't)\b|n['’]t\b|\b(?:nunca|jamás|tampoco|sin)\b|\b(?:jamais|ne\s+\w+\s+pas|n['’]\w+\s+pas|aucun|sans)\b|\b(?:nicht|nie|niemals|kein|keine|ohne)\b|(?:\bне\b|\bнет\b|никогда|без\b)|(?:不是|没有|沒有|从未|從未|未曾|並非|并非)|(?:ではない|ていない|なかった|ません)|(?:\bلم\b|\bليس\b|\bلا\b|\bبدون\b))/iu;
const COMPARATIVE = /(?:\bthan\b|\b(?:taller|shorter|longer|older|younger|larger|bigger|smaller|higher|lower|heavier|lighter|earlier|later)\b|\bчем\b|(?:比|より))/iu;
// The gate indexes at most 20000 chars of a page; the check reads what the gate reads.
const CHECK_CHARS = 20000;

function nearFig(v, c) { return Math.abs(v - c.v) <= 0.5 * Math.pow(10, -c.dec) + 1e-9 * Math.abs(c.v); }
/** A claim figure `c` and a ground figure `w` say the same quantity. Stricter than the gate on one point: when the claim names a unit,
 *  the ground figure must carry a unit of that dimension and match after conversion (330 feet is not 330 metres, 7,300 kilograms is not
 *  7,300 tonnes); a claim silent about its unit falls back to the gate's own figureMatches. */
function figureSame(c, w) {
  if (c.unit) return !!(w.unit && c.numeric && w.numeric && c.unit.dim === w.unit.dim && nearFig((w.v * w.unit.f) / c.unit.f, c));
  return figureMatches(c, w);
}

/**
 * consequenceOf(sentence, pages) → { atoms:[…sorted strings], key, address, why } — the fold of the ground at the sentence.
 * Empty `atoms` means the sentence makes no difference to this ground: `why` says in a typed word where it stopped
 * ('unread-structure' | 'cross-language' | 'figure-unit' | the gate's own reasons | 'no-material').
 */
export function consequenceOf(sentence, pages) {
  const s = String(sentence ?? "");
  const ok = (Array.isArray(pages) ? pages : []).filter((p) => String(p?.text ?? "").trim());
  const none = (why, detail = "") => ({ atoms: [], key: "", address: null, why, detail });
  if (!ok.length) return none("no-material");
  const bare = claimOf(s);
  if (NEGATION.test(bare)) return none("unread-structure", "negation");
  if (COMPARATIVE.test(bare)) return none("unread-structure", "comparison");
  const refs = refsOf(ok);
  const material = ok.map((p, i) => ({ ref: refs[i], source: p.url || p.source, text: String(p.text).slice(0, CHECK_CHARS) }));
  const [e] = attribute(s, material);
  if (!e || !e.ref) return none(e?.why || "no-material", e?.detail || "");
  const m = material.find((x) => x.source === e.source && x.ref === e.ref) || material.find((x) => x.ref === e.ref) || material[0];
  const sents = sentenceSpans(m.text);
  const idx = Math.max(0, sents.findIndex((x) => e.span.start >= x.start && e.span.start <= x.end));
  const lo = Math.max(0, idx - 1), hi = Math.min(sents.length - 1, idx + 1);
  const win = sents.slice(lo, hi + 1);
  const holon = sents[idx];
  const address = `${m.ref}#${holon.start}-${holon.end}`;
  // read the figures over the window's contiguous text, so a heading number ("4.3") or a decimal stays whole
  const gfigs = figuresIn(m.text.slice(win[0].start, win[win.length - 1].end), win[0].start);
  const atoms = new Set([`holon:${address}`]);
  const nameKey = (n) => wordsIn(String(n).replace(/['’]s\b/gu, ""), scriptOf(String(n))).map(stem).join("_");
  for (const c of figuresIn(bare)) {
    // "Apollo 11", "Boeing 747": a short figure right after a capitalised word is part of the NAME, not a quantity (the gate reads it so too)
    const pre = bare.slice(0, c.start).match(/(\p{Lu}[\p{L}'’-]+)\s+$/u);
    if (pre && !COMMON_CAP.has(pre[1]) && /^\d{1,3}$/.test(c.norm) && !c.unit) { atoms.add("name:" + nameKey(pre[1]) + "_" + c.norm); continue; }
    const hit = gfigs.find((w) => figureSame(c, w));       // earliest in the ground: the canonical atom of a quantity stated in several units
    if (!hit) return none("figure-unit", c.raw + (c.unit ? " " + c.unit.w : ""));
    atoms.add(`fig:${hit.unit ? hit.unit.dim : "n"}:${Number((hit.v * (hit.unit?.f ?? 1)).toPrecision(9))}@${hit.start}`);
  }
  const names = namesIn(bare);
  for (const n of names) atoms.add("name:" + nameKey(n));
  const bscript = scriptOf(bare);
  const topic = new Set(wordsIn(m.ref, scriptOf(m.ref)).map(stem));
  const fw = new Set([...(FUNCTION_WORDS.en || []), ...(FUNCTION_WORDS[detectLang(bare).lang] || [])].map((x) => fold(x)));
  const nameToks = new Set(names.flatMap((n) => wordsIn(String(n).replace(/['’]s\b/gu, ""), bscript)).map(stem));
  const figToks = new Set(figuresIn(bare).flatMap((f) => wordsIn(f.raw, bscript)));
  for (const t of wordsIn(bare, bscript)) {
    const st = stem(t);
    if (fw.has(t) || topic.has(st) || nameToks.has(st) || figToks.has(t) || /^\d/.test(t) || t.length < 4 || MEASURE_WORDS.has(t) || MEASURE_WORDS.has(st)) continue;
    if (unitOfWord(t)) continue;
    atoms.add("term:" + st);
  }
  const list = [...atoms].sort();
  return { atoms: list, key: list.join("|"), address, why: "" };
}

/** Same claim, by consequence: relative to this ground, both sentences select the same window, the same figures, the same names, and the
 *  content terms of one are those of the other (a sentence may say less, never something else). `undecidable` is typed, never a guess. */
export function sameClaim(a, b, pages) {
  const ca = consequenceOf(a, pages), cb = consequenceOf(b, pages);
  if (!ca.atoms.length || !cb.atoms.length) return { verdict: "undecidable", why: !ca.atoms.length ? ca.why : cb.why, detail: !ca.atoms.length ? ca.detail : cb.detail, a: ca, b: cb };
  const parts = (c) => ({ holon: c.atoms.filter((x) => x.startsWith("holon:")).join(), fig: c.atoms.filter((x) => x.startsWith("fig:")).join("|"), name: c.atoms.filter((x) => x.startsWith("name:")).join("|"), term: c.atoms.filter((x) => x.startsWith("term:")).map((x) => x.slice(5)) });
  const A = parts(ca), B = parts(cb);
  const sub = (x, y) => x.every((t) => y.includes(t));
  const same = A.holon === B.holon && A.fig === B.fig && A.name === B.name && (sub(A.term, B.term) || sub(B.term, A.term));
  return { verdict: same ? "same" : "different", a: ca, b: cb };
}

/** The forward gate kept as the CHECK: may this (voiced or foreign) sentence stand against these pages? */
export function certify(sentence, pages) {
  const c = consequenceOf(sentence, pages);
  return c.atoms.length ? { accepted: true, address: c.address, atoms: c.atoms } : { accepted: false, why: c.why, detail: c.detail };
}
