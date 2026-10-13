// fold-chat-bookscenes.js — SCENES and EVENTS of a shelfed book, mechanically, no model.
//
// The book fold (fold-chat-bookfold.js) reduces each chapter to ONE event line. This is the layer
// beneath it: cut a chapter into scenes where the reading BLINKS (Murch, organs/pacing.js), and
// give each scene the events the grammar actually BOUND there (adapters/text/relations.js with the
// whole-book verb vocabulary — the same model-free seam that read the EOT). No model, no invention:
//   · a scene boundary is measured (a short sentence landing after a sustained rhythm), never judged;
//   · an EVENT is a sentence the seam bound, realized VERBATIM at its byte address — the fold never
//     writes an event; it lifts the book's own sentence that the grammar anchored to a being;
//   · a sentence the seam cannot bind to a being produces no event — absence, never a guess.
// Anti-hallucination is structural (the byte-trace wall): every event keeps the raw offset its
// sentence started at, and the fold's word check refuses any address whose bytes do not hold the event.
//
//   import { bookGrammar, bookScenes } from "./fold-chat-bookscenes.js";
//   const g = bookGrammar(raw, book);            // the whole-book verb vocabulary + closed class (one pass, cached per tab)
//   const scenes = bookScenes(raw, parsed, book, { grammar: g });

import { splitSentences } from "./vendor/khora/native/adapters/text/spans.js";
import { pacingGrade } from "./vendor/khora/native/organs/pacing.js";
import { discoverRelationVocab, extractRelations } from "./vendor/khora/native/adapters/text/relations.js";
import { extractSurfaces, discoverReferents } from "./vendor/khora/native/adapters/text/surfaces.js";
import { chaptersOf, foldCast } from "./fold-chat-bookfold.js";

const deaccent = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A closed class from the text's own frequency (the Zipf head) — the standing-in for
 *  material.js::functionWordSet, which the vendored seam does not carry. */
export function closedClass(text, { head = 140, floor = 60 } = {}) {
  const freq = new Map();
  for (const t of String(text).toLowerCase().match(/[a-z][a-z'-]+/g) || []) freq.set(t, (freq.get(t) || 0) + 1);
  const n = Math.min(head, Math.max(floor, Math.floor(freq.size / 40)));
  return new Set([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t));
}

const GRAMMAR = new Map();   // book.id -> { verbs, closed, cast } — one build per tab, never twice
/** The whole-book grammar the seam reads by: the admitted surfaces, the discovered relation
 *  verbs, the closed class, and the book's cast. One few-second pass, cached per tab. */
export function bookGrammar(raw, book, { progress = null } = {}) {
  if (GRAMMAR.has(book.id)) return GRAMMAR.get(book.id);
  progress?.("reading the grammar of the whole book\u2026 (one pass, then it is cached)");
  const closed = closedClass(raw);
  const sentences = splitSentences(String(raw));
  const surfaces = extractSurfaces(sentences, { functionWords: closed });
  const discovered = discoverReferents(surfaces);
  const cast = foldCast(raw).map((c) => c.key);
  const verbs = (discoverRelationVocab(String(raw), { surfaces, functionWords: closed, minSurfaces: 2 }).verbs ?? new Set());
  const entry = { verbs, closed, cast };
  GRAMMAR.set(book.id, entry);
  return entry;
}

/** The sentences of a text with their character offsets, relative to the text. The vendored
 *  splitSentences names the start `offset` (spans.js:431): `{ text, offset, order }`. */
function sentenceStarts(text) {
  const sents = splitSentences(String(text)).sort((a, b) => a.offset - b.offset);
  return { sents, starts: sents.map((s) => s.offset) };
}

/** Scene boundaries within a chapter: where MURCH'S CUT falls. The blink points index into
 *  sentenceLengths' OWN split ((?<=[.!?])\s+), so each is snapped to the seam's sentence start. */
function blinkBoundaries(chapterText, sents) {
  const grade = pacingGrade(chapterText);
  if (!grade.blinkPoints?.length) return [];
  const parts = String(chapterText).split(/(?<=[.!?])\s+/);
  const startsOf = [];
  { let c = 0; for (const p of parts) { startsOf.push(c); c += p.length + 1; } }
  const seamStarts = sents.map((s) => s.start);
  const out = [];
  let p = 0;
  for (const b of grade.blinkPoints) {
    const charStart = startsOf[b.index] ?? (b.index < parts.length ? startsOf[parts.length - 1] : chapterText.length);
    while (p < seamStarts.length && seamStarts[p] < charStart) p++;
    const snap = seamStarts[p];
    if (snap != null && snap > 0 && !out.includes(snap)) out.push(snap);
  }
  return out.sort((a, b) => a - b);
}

const LOC_RE = /\b(?:in|at|to|from|near|toward|into|outside|inside|across)\s+([A-ZÀ-Þ][\w’'-]+)/g;

/** Fold one scene: set · cast · events. Every event is the seam's bound sentence, VERBATIM
 *  at its raw byte address (rawStart + the sentence's offset in the scene text). No model wrote it. */
function foldScene(sceneText, rawStart, ch, { verbs, closed, cast, maxEvents }) {
  const set = [...new Set([...sceneText.matchAll(LOC_RE)].map((m) => m[1]).filter((w) => !cast.includes(deaccent(w).toLowerCase())))].slice(0, 6);
  const deg = new Map();
  for (const k of cast) { const n = (sceneText.match(new RegExp(`\\b${esc(k)}\\b`, "gi")) || []).length; if (n) deg.set(k, n); }
  const sceneCast = [...deg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const { sents, starts } = sentenceStarts(sceneText);
  const rel = extractRelations(sceneText, { verbs, functionWords: closed, subjectWalls: true });
  const bySentence = new Map();   // sentence index -> { s, v, o }
  for (const r of (Array.isArray(rel) ? rel : [])) {
    const off = Number(r?.offset);
    if (!Number.isFinite(off) || starts.length === 0 || off < starts[0]) continue;
    let idx = starts.length - 1;
    while (idx > 0 && starts[idx] > off) idx--;
    if (idx < 0) continue;
    const s = sents[idx];
    const f = deaccent(String(s?.text ?? "")).toLowerCase();
    const named = cast.filter((k) => new RegExp(`\\b${esc(k)}\\b`).test(f));
    if (!named.length) continue;                      // Houdini: an event names a being
    if (!bySentence.has(idx)) bySentence.set(idx, { s, v: r.verb, o: r.object, named });
  }
  // each event is the sentence VERBATIM, byte-addressed: the span from this sentence's offset to the
  // next one's (or the scene's end). The fold displays the collapsed sentence; the bytes it came from
  // are the guarantee — nothing is written, only lifted.
  const events = [...bySentence.values()].slice(0, maxEvents).map((e, i) => {
    const off = Number(e.s.offset ?? 0);
    const si = sents.indexOf(e.s);
    const next = sents[si + 1]?.offset ?? sceneText.length;
    const verbatim = sceneText.slice(off, next);
    return {
      n: i + 1, at: rawStart + off, len: verbatim.length, verbatim,
      text: verbatim.replace(/\s+/g, " ").trim(),
      v: String(e.v ?? ""), o: String(e.o ?? ""), named: (e.named || []).slice(0, 3),
      ref: `${ch.book.replace(/ \(.*\)/, "")}, Chapter ${ch.chapter}`,
    };
  });
  return { set, cast: sceneCast, events, ref: ch.book.replace(/ \(.*\)/, ""), chapter: ch.chapter, at: rawStart };
}

/** The scenes of one book, in story order: chapters cut at Murch's blinks, each scene folded to
 *  set · cast · events. Bounded: a scene needs >= minChars, keeps at most maxEvents events, and
 *  the book keeps its strongest maxScenes (by the beings' degree), story order inside. Pure. */
export function bookScenes(raw, parsed, book, { grammar = null, maxScenes = 6, maxEvents = 6, minChars = 120, progress = null } = {}) {
  const g = grammar || bookGrammar(raw, book, { progress });
  const { verbs, closed, cast } = g;
  const chapters = chaptersOf(parsed).filter((c) => c.book === book);
  const out = [];
  for (const ch of chapters) {
    const chapterText = String(raw).slice(ch.start, ch.end);
    const { sents } = sentenceStarts(chapterText);
    const bounds = blinkBoundaries(chapterText, sents);
    let at = 0;
    for (const b of [...bounds, chapterText.length]) {
      const sceneStart = at;
      at = b;
      if (b - sceneStart < minChars) continue;        // a scene needs content
      const sceneText = chapterText.slice(sceneStart, b);
      const sc = foldScene(sceneText, ch.start + sceneStart, ch, { verbs, closed, cast, maxEvents });
      if (sc.events.length) out.push(sc);             // a scene with no bound event is a beat, not an event
    }
  }
  const ranked = out.map((sc, i) => ({ sc, i, w: sc.cast.reduce((a, [, n]) => a + Math.log(1 + n), 0) }));
  ranked.sort((a, b) => b.w - a.w);
  const kept = ranked.slice(0, maxScenes).sort((a, b) => a.i - b.i).map((r) => r.sc);
  return { scenes: kept, cut: out.length };
}

/** The scenes of every book of the shelfed text, folded. Each book carries its strongest scenes,
 *  so the whole-book summary can narrate from measured events, never invented ones. */
export function bookScenesFor(raw, parsed, book, { grammar = null, maxScenes = 4, maxEvents = 5, progress = null } = {}) {
  const g = grammar || bookGrammar(raw, book, { progress });
  const labels = [...new Set(chaptersOf(parsed).map((c) => c.book))];
  const per = [];
  let cut = 0;
  for (const label of labels) {
    const r = bookScenes(raw, parsed, label, { grammar: g, maxScenes, maxEvents });
    cut += r.cut;
    per.push({ book: label, ...r });
  }
  return { per, cut };
}

/** The measured events beneath every book of the fold, one per book, compact for a small window. */
export function scenePromptFor(book, result, { maxChar = 260 } = {}) {
  const lines = [];
  for (const p of (result?.per || [])) {
    const top = p.scenes[0];
    if (!top || !top.events.length) continue;
    const e = top.events[0];
    const t = e.text.length > maxChar ? e.text.slice(0, maxChar).trimEnd() + "\u2026" : e.text;
    lines.push(`[${top.ref}] ${t}`);
  }
  return `The events the fold read BENEATH the plot lines (each a sentence of ${book.title}, verbatim at its byte address; they were not written — they were bound and lifted):\n${lines.join("\n")}`;
}

/** The scene folds in a promptable form — the material a model may phrase, never extend. */
export function scenePrompt(book, scenes) {
  const blocks = (scenes || []).map((sc, i) => {
    const cast = sc.cast.slice(0, 5).map(([k, n]) => `${k}${n > 1 ? ` \u00d7${n}` : ""}`).join(", ");
    const ev = sc.events.map((e) => `  \u2022 [${e.ref}] \u201c${e.text}\u201d`).join("\n");
    return `SCENE ${i + 1} \u2014 ${cast ? `cast: ${cast}` : "cast: (none named)"}${sc.set.length ? ` \u00b7 set: ${sc.set.join(", ")}` : ""}\n${ev}`;
  });
  return `These are the scenes of ${book.title} the fold cut and read (no model wrote any event):\n${blocks.join("\n")}`;
}