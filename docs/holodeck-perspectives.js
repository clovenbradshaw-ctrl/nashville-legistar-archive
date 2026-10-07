// holodeck-perspectives.js — three embodied readers, kept apart. Not one
// aggregate baseline: live_priors' three genres (books, encyclopedic,
// government & legal) are each a reader with its OWN expectations, kept as
// its own holograph (vendor/eoreader7/native/kernel/bayes-surprise.js).
//
// WHAT A READER EXPECTS IS STRUCTURE, NEVER WORDS. The unit is what one
// sentence does to the running picture of who is in it and who is held
// together with whom — the same vocabulary the belief-shift scorer in
// index.html already speaks (a first bond between two known names, a new
// name entering bonded to a known one, a bond negated, a bond merely
// restated). A novel keeps introducing people and rarely restates a
// pairing; a statute restates constantly and almost never bonds anything
// new. Those are differences in how a reading proceeds, and they survive
// any change of subject matter. No word, no vocabulary and no word count is
// ever stored: what survives the fetch is Dirichlet counts over three
// declared slots.
//
// READ-ONLY AGAINST THIS WORKSPACE. A workspace statement's own event is
// read against each reader with predict() alone — never admit() — so
// nothing this workspace says can teach a live_priors reader anything, and
// nothing a reader holds is returned but numbers.
//
// KEPT APART, NOT AVERAGED. Each reader's verdict on a statement lands as
// its own perspectiveOperation (BASIS.INHERITED: it came from what that
// reader's genre gave it, not from this document) and divergence() from
// perspective.js (Mahavira / anekantavada: true from a standpoint,
// standpoints kept apart) surfaces exactly where readers disagree.

import { createHolograph, admit, predict } from './vendor/eoreader7/native/kernel/bayes-surprise.js';
import { STANCE, BASIS, perspectiveOperation, projectPerspectives, divergence } from './vendor/eoreader7/native/kernel/perspective.js';
import * as PR from './vendor/eoreader7/native/adapters/text/priors.js';

export const GENRES = [
  { id: 'lit', label: 'Literature', desc: 'how a novel proceeds' },
  { id: 'ency', label: 'Encyclopedic', desc: 'how a reference article proceeds' },
  { id: 'gov', label: 'Government & legal', desc: 'how a statute proceeds' },
];

// Declared budgets (P9: a number that costs something is named, with its
// giver, and is neither fit to a corpus nor walked against a golden).
//   SAMPLE_PER_GENRE  documents read per genre — a structural prior needs a
//                     representative sample, not the whole corpus.
//   PICTURE_WINDOW    the reach of the present, in sentences: a name counts
//                     as "already in the picture" only if it was met within
//                     this many sentences. Without it "known" would mean
//                     "anywhere earlier in the book", and a 70,000-sentence
//                     novel would differ from a 20-statement workspace in
//                     length alone. The same window is applied to both
//                     sides. ~a paragraph; sensitivity is reported by the
//                     eval, not tuned here.
//   NOTABLE_QUANTILE  the line each reader draws for "notable": a shape
//                     costing it more bits than 85% of what it has itself
//                     read — the same top-15% line surprise() already draws
//                     over shifts in view.
export const SAMPLE_PER_GENRE = 6;
export const PICTURE_WINDOW = 25;
export const NOTABLE_QUANTILE = 0.85;
export const MIN_SENTENCE_CHARS = 20;
// A lone capitalised token is a name only if it recurs capitalised
// mid-sentence in the same stream. Two is the structural minimum the engine
// already uses for "a pattern" (binding.js arrivals floor; one occurrence
// has no recurrence to test) — reused, not tuned. Novels name people with
// single tokens ("Harker", "Darcy"); requiring multi-word runs alone read
// 95% of a novel as name-free.
export const NAME_RECURRENCE = 2;

// The corpus account follows the served page (scores-patch-points.github.io →
// scores-patch-points), overridable at runtime with localStorage['hd:account'] —
// one declaration (fold-workspace.json), no code hunt on an account move.
const HD_ACCOUNT = (() => {
  try {
    const o = (typeof localStorage !== 'undefined' && localStorage.getItem('hd:account'));
    if (o) return o;
    const h = (typeof location !== 'undefined' && location.hostname) || '';
    if (/\.github\.io$/.test(h)) return h.split('.')[0];
  } catch (e) {}
  return 'scores-patch-points';
})();
const LP_RAW = 'https://raw.githubusercontent.com/' + HD_ACCOUNT + '/ethos/main/';

// Received closed classes (priors.js, lang/en — every entry names its
// giver). A sentence-initial capital carries no evidence of a name (the
// engine's own rule, surfaces.js); these are the words that begin a
// sentence for grammatical reasons.
const NOT_A_NAME_START = new Set([
  ...PR.DEFINITE_DETERMINERS, ...PR.INDEFINITE_DETERMINERS, ...PR.CLAUSE_OPENERS, ...PR.SUBJECT_PRONOUNS,
  ...PR.POSSESSIVE_DETERMINERS, ...PR.ANAPHORIC_PRONOUNS, ...PR.CLAUSE_COORDINATORS, ...PR.SUBORDINATING_CONJUNCTIONS,
  ...PR.NEVER_A_NAME, ...PR.PREDETERMINERS,
]);
const NEG = PR.NEGATION_WORDS;

const CAP = /^[A-Z][A-Za-z'’-]*$/;
const ALLCAPS = /^[A-Z]{2,}$/;
const SENT_RE = /[^.!?\n]+[.!?]?/g;
const bucket = (n) => (n >= 3 ? '3+' : String(n));
const clean = (t) => t.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9'’-]+$/, '');

function tokenize(sentence) {
  const out = [];
  for (const raw of String(sentence || '').split(/\s+/)) {
    if (!raw) continue;
    const t = clean(raw);
    if (!t) continue;
    out.push({ t, brk: /[,;:.!?)\]"”]$/.test(raw) });
  }
  return out;
}

/** The names in each sentence of ONE document, read the way the engine reads
 *  them: a run of capitalised tokens broken by punctuation, kept when it is
 *  multi-word, ALL-CAPS, or a lone token that recurs (NAME_RECURRENCE); a sentence-initial token starts a name only when
 *  it is not a grammatical opener AND the same token is met capitalised
 *  somewhere it does not begin a sentence (recurrence is the evidence, not
 *  the capital). Two passes because that evidence arrives later. */
export function namesByStatement(sentences) {
  const toks = sentences.map(tokenize);
  const mid = new Map();
  toks.forEach((ts) => ts.forEach((k, i) => { if (i > 0 && CAP.test(k.t) && !PR.NEVER_A_NAME.has(k.t.toLowerCase())) mid.set(k.t, (mid.get(k.t) || 0) + 1); }));
  return toks.map((ts) => {
    const found = new Set();
    let run = [];
    const flush = () => {
      if (run.length >= 2 || (run.length === 1 && (ALLCAPS.test(run[0]) || (mid.get(run[0]) || 0) >= NAME_RECURRENCE))) found.add(run.join(' '));
      run = [];
    };
    ts.forEach((k, i) => {
      const capital = CAP.test(k.t) && (ALLCAPS.test(k.t) || /[a-z]/.test(k.t));
      const openerWord = i === 0 && (NOT_A_NAME_START.has(k.t.toLowerCase()) || !mid.has(k.t));
      if (capital && !openerWord && PR.NEVER_A_NAME.has(k.t.toLowerCase())) { flush(); return; }
      if (capital && !openerWord) run.push(k.t); else flush();
      if (k.brk) flush();
    });
    flush();
    return [...found].filter((n) => n.length > 2);
  });
}

const pairKey = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);
const contains = (a, b) => a.includes(b) || b.includes(a);

/** What each statement in ONE stream (a document, or one reading order of a
 *  workspace) does to the picture held so far, as three structural facts:
 *
 *    event   the strongest thing it does — bond (two names already in the
 *            picture, held together for the first time) · enter (a new name
 *            bonded to one already there) · turn (negates a bond the
 *            picture had affirmed) · restate (holds only pairs already
 *            held) · introduce (names, none yet in the picture, nothing to
 *            bond) · bare (no names at all)
 *    known   how many of its names were already in the picture
 *    fresh   how many were not
 *
 *  Both sides of every predict() are read by this one function. */
export function factsAlong(sentences, window = PICTURE_WINDOW) {
  const names = namesByStatement(sentences);
  const frames = []; // recent { names:Set, pairs:Map(key -> negated?) }
  const inPicture = () => {
    const ents = new Set(), pairs = new Map();
    for (const f of frames) { f.names.forEach((n) => ents.add(n)); f.pairs.forEach((neg, k) => { const p = pairs.get(k) || { aff: 0, neg: 0 }; if (neg) p.neg++; else p.aff++; pairs.set(k, p); }); }
    return { ents, pairs };
  };
  return sentences.map((text, i) => {
    const ns = names[i];
    const { ents, pairs } = inPicture();
    const negated = tokenize(text).some((k) => NEG.has(k.t.toLowerCase()));
    const known = ns.filter((n) => ents.has(n)), fresh = ns.filter((n) => !ents.has(n));
    let event = ns.length ? 'introduce' : 'bare';
    let held = 0, bond = false, enter = false, turn = false;
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
      if (contains(ns[a], ns[b])) continue;
      const p = pairs.get(pairKey(ns[a], ns[b]));
      const ka = ents.has(ns[a]), kb = ents.has(ns[b]);
      if (p) { held++; if (negated && p.aff > 0 && p.neg === 0) turn = true; }
      else if (ka && kb) bond = true;
      else if (ka || kb) enter = true;
    }
    if (turn) event = 'turn'; else if (bond) event = 'bond'; else if (enter) event = 'enter'; else if (held) event = 'restate';
    const fp = new Map();
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) if (!contains(ns[a], ns[b])) fp.set(pairKey(ns[a], ns[b]), negated);
    frames.push({ names: new Set(ns), pairs: fp });
    if (frames.length > window) frames.shift();
    return { event, known: bucket(known.length), fresh: bucket(fresh.length) };
  });
}

async function fetchText(path) {
  const r = await fetch(LP_RAW + path);
  if (!r.ok) throw new Error('fetch failed (' + r.status + '): ' + path);
  return r.text();
}

/** Builds one genre's reader: streams admit() over the events of its own
 *  documents, each read as its own stream with its own picture. The text is
 *  read, turned into events and discarded; the reader that survives is
 *  Dirichlet counts only (createHolograph's contract: slot -> value ->
 *  count), never a sentence. */
export async function buildGenreHolograph(paths, onProgress, window = PICTURE_WINDOW) {
  const holo = createHolograph({ alpha: 1, gamma: 1 });
  const sample = (paths || []).slice(0, SAMPLE_PER_GENRE);
  const combos = new Map(); // fact tuple -> count: structure only
  let done = 0, sentences = 0;
  for (const path of sample) {
    let text;
    try { text = await fetchText(path); } catch (e) { done++; if (onProgress) onProgress(done, sample.length, sentences); continue; }
    const sents = (text.match(SENT_RE) || []).map((s) => s.trim()).filter((s) => s.length >= MIN_SENTENCE_CHARS);
    for (const f of factsAlong(sents, window)) {
      admit(holo, f);
      const k = JSON.stringify(f); const c = combos.get(k);
      if (c) c.n++; else combos.set(k, { f, n: 1 });
      sentences++;
    }
    done++;
    if (onProgress) onProgress(done, sample.length, sentences);
  }
  return { holo, files: done, sentences, notableBits: notableBitsOf(holo, combos) };
}

/** This reader's own line for "notable": costing it more bits than
 *  NOTABLE_QUANTILE of the sentences it has itself read. Derived from the
 *  reader's own experience; a reader that has read nothing finds nothing
 *  notable. */
export function notableBitsOf(holo, combos) {
  const rows = [...combos.values()].map(({ f, n }) => ({ bits: scoreAgainstGenre(holo, f).bits, n })).sort((a, b) => a.bits - b.bits);
  const total = rows.reduce((t, r) => t + r.n, 0);
  if (!total) return Infinity;
  let run = 0;
  for (const r of rows) { run += r.n; if (run / total >= NOTABLE_QUANTILE) return r.bits; }
  return rows[rows.length - 1].bits;
}

/** Builds all three readers. `lpSets` is the app's own LP_SETS. */
export async function buildAllGenres(lpSets, onProgress) {
  const out = {};
  for (const g of GENRES) {
    const set = lpSets[g.id];
    out[g.id] = await buildGenreHolograph(set ? set.paths : [], (n, t, s) => onProgress && onProgress(g.id, g.label, n, t, s));
  }
  return out;
}

/** Read-only: a workspace statement's facts against one reader, WITHOUT
 *  admitting it. predict() never mutates the holograph — the leak wall. */
export function scoreAgainstGenre(holo, facts, notableBits = Infinity) {
  let bits = 0; const perSlot = {};
  for (const [slot, value] of Object.entries(facts || {})) {
    const r = predict(holo, slot, value);
    perSlot[slot] = r; bits += r.bits;
  }
  return { bits, perSlot, notableBits, notable: bits > notableBits };
}

export function scorePerspectives(holos, facts) {
  const out = {};
  for (const g of GENRES) { const r = holos && holos[g.id]; if (r && r.holo) out[g.id] = scoreAgainstGenre(r.holo, facts, r.notableBits); }
  return out;
}

/** The append-only perspective log: one operation per (reader, statement),
 *  landing that reader's own stance on "this statement is notable".
 *  `scored` is [{ id, byGenre }]. */
export function buildPerspectiveLog(scored) {
  const log = [];
  for (const item of scored || []) {
    for (const g of GENRES) {
      const s = item.byGenre && item.byGenre[g.id];
      if (!s) continue;
      log.push(perspectiveOperation({ holder: g.id, claim: 'notable:' + item.id, stance: s.notable ? STANCE.HOLDS : STANCE.DOUBTS, basis: BASIS.INHERITED }));
    }
  }
  return log;
}

/** Projects the log and computes divergence in BOTH directions of every
 *  pair: a mismatch only shows from whichever reader HOLDS the claim
 *  (heldSet), so one direction alone would half-see it. */
export function projectAndDiverge(log) {
  const projected = projectPerspectives(log);
  const pairs = [];
  for (let i = 0; i < GENRES.length; i++) {
    for (let j = i + 1; j < GENRES.length; j++) {
      const a = GENRES[i].id, b = GENRES[j].id;
      const ab = divergence(projected, a, b), ba = divergence(projected, b, a);
      const seen = new Set(); const conflicting = [];
      [...ab.conflicting, ...ba.conflicting].forEach((c) => { if (seen.has(c.claim)) return; seen.add(c.claim); conflicting.push(c); });
      pairs.push({ a, b, conflicting });
    }
  }
  return { projected, pairs };
}

// ---- persistence -----------------------------------------------------------
// A reader is counts over three structural slots (no text), so it is small and
// safe to keep in the browser between visits. It carries the declared numbers
// it was trained under; a reader trained under different numbers is a
// different reader and is refused on revive rather than silently reused.
export const readerRecipe = () => ({ PICTURE_WINDOW, SAMPLE_PER_GENRE, NAME_RECURRENCE, NOTABLE_QUANTILE, MIN_SENTENCE_CHARS });

export function serializeReaders(readers) {
  const out = { recipe: readerRecipe(), readers: {} };
  for (const g of GENRES) {
    const r = readers && readers[g.id]; if (!r || !r.holo) continue;
    out.readers[g.id] = {
      files: r.files, sentences: r.sentences, notableBits: Number.isFinite(r.notableBits) ? r.notableBits : null,
      admitted: r.holo.admitted, absentMass: r.holo.absentMass ?? 0, alpha: r.holo.alpha, gamma: r.holo.gamma,
      slots: [...r.holo.slots].map(([slot, m]) => [slot, [...m]]),
    };
  }
  return out;
}

export function reviveReaders(saved) {
  if (!saved || !saved.readers || !saved.recipe) return null;
  const now = readerRecipe();
  for (const k of Object.keys(now)) if (saved.recipe[k] !== now[k]) return null;
  const out = {};
  for (const g of GENRES) {
    const s = saved.readers[g.id]; if (!s) return null;
    const holo = createHolograph({ alpha: s.alpha, gamma: s.gamma });
    holo.admitted = s.admitted; holo.absentMass = s.absentMass;
    s.slots.forEach(([slot, entries]) => holo.slots.set(slot, new Map(entries)));
    out[g.id] = { holo, files: s.files, sentences: s.sentences, notableBits: s.notableBits == null ? Infinity : s.notableBits };
  }
  return out;
}
