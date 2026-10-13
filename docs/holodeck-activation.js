// holodeck-activation.js — MEANING ACTIVATION on the canonical path (§7),
// composed strictly from the vendored organs (no second engine).
//
// The one thing this module decides is the INDEX: it REBUILDS the identity
// index from the surface's OWN admitted cast (rix.cast — the reading
// pipeline's referents, already the engine's work) through the engine's own
// builder (readingIndexFromLog → resolve / resolveIn). The mention book and
// the activation runner are the vendored organs' (activation-wiring's
// mentionBook / activate). No admission is re-derived here; a referent that the
// reading did not admit can never activate.
//
// When the question resolves to no referent, activation yields nothing and the
// caller falls back to term retrieval — a recorded basis, never a silent mix
// (the organ's own rule: `basis: "surface"` is disclosed when the fallback
// stood in).
import { mentionBook, activate } from './vendor/eoreader7/native/the-fold/activation-wiring.js';
import { readingIndexFromLog } from './vendor/eoreader7/native/the-fold/reading-log.js';
import { namesCorefer, diaNorm } from './vendor/eoreader7/native/adapters/text/surfaces.js';
import { splitSentences } from './vendor/eoreader7/native/adapters/text/spans.js';

const INDEX_CACHE = new WeakMap(); // rix -> index (the engine's own identity face)
const BOOK_CACHE = new WeakMap(); // index -> Map<IX, {sentences, byId}> — the
// mention walk is O(corpus) so it runs once per (cast, chunks) pair, not once
// per question; both rix and IX are stable across turns.

/** The engine's identity index, rebuilt from the surface's admitted cast. */
export function indexFromCast(rix) {
  if (!rix || !Array.isArray(rix.cast) || !rix.cast.length) return null;
  let index = INDEX_CACHE.get(rix);
  if (index) return index;
  try {
    const entries = rix.cast
      .map((c) => ({
        schema: 'EOReferent@1',
        ref: String(c.id),
        surfaces: ((c.surfaces && c.surfaces.length) ? c.surfaces : [c.id]).filter(Boolean),
      }))
      .filter((e) => e.ref && e.surfaces.length);
    index = entries.length ? readingIndexFromLog(entries, { diaNorm, namesCorefer }) : null;
    INDEX_CACHE.set(rix, index);
  } catch { index = null; }
  return index;
}

/**
 * activationRetrieval({ rix, IX, question, transcript, read, limit, seen }) →
 * { passages, meta } | null. Meaning-activation first; null means NO referent
 * resolved (the caller's term fallback stands — disclosed, not silent).
 * Passages are the activation organ's own sentence-shaped rows (byte-addressed,
 * offset self-verified by mentionBook). `seen` is a Set of already-used refs
 * the caller wants excluded (the same `folded` the term retriever honours).
 */
export function activationRetrieval({ rix, IX, question = '', transcript = [], read = null, limit = 8, seen = null } = {}) {
  try {
    const index = indexFromCast(rix);
    if (!index || !IX || !IX.chunks || !IX.chunks.length) return null;
    let byIx = BOOK_CACHE.get(index);
    if (!byIx) { byIx = new Map(); BOOK_CACHE.set(index, byIx); }
    let book = byIx.get(IX);
    if (!book) {
      book = mentionBook(IX.chunks, index, { splitSentences });
      byIx.set(IX, book);
    }
    if (!book || !book.sentences.length) return null;
    const r = activate({ question, transcript, index, book, notes: [], read: read || null, resolutions: 0 });
    if (!r.passages.length) return null;
    const passages = (seen && seen.size) ? r.passages.filter((p) => !seen.has(p.ref)) : r.passages;
    if (!passages.length) return null;
    return {
      passages: passages.slice(0, limit),
      meta: {
        basis: 'activation',
        resolution: r.activeBasis ?? r.basis ?? 'activation',
        active: [...(r.active ?? [])],
        hop1: [...(r.hop1 ?? [])],
        window: r.window ?? 0,
        grain: r.grain ?? null,
        why: r.why ?? '',
      },
    };
  } catch { return null; }
}

export default { indexFromCast, activationRetrieval };