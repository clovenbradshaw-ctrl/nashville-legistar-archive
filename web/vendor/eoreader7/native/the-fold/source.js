// source.js — SHIM. The organ lives in eoreader7/native/organs (Phase 3 of the
// organ migration, 2026-09-02; absorbed into eoreader7 2026-10-01); this file
// only forwards it so a stale importer keeps resolving. New code imports the
// seam, ../organs/index.js, never this file.
// Handle: Nadim — after Ibn al-Nadim's Fihrist, an addressed catalogue of every known work; retrieval by where it sits, never by judgment of what it says. Amendment XVII.
//
// ONE name is wrapped rather than forwarded, and this is deliberate:
// retrieve()'s shape-cue tie-fallback (shape-fallback.js) is a the-fold
// concern — relative.js, which it is built on, is kept apart from eoreader7's
// organs — so the engine's own retrieve() never grew the `shapeFallback`
// option. The seam is where the caller-side wiring (holon.js, app.js) already
// hands it in; without the wrap here it was silently dropped and the whole
// mechanism was dead code. The wrap is byte-identical to the engine's own
// retrieve() whenever `shapeFallback` is omitted.
import { tokenize } from "../organs/source.js";
export * from "../organs/source.js";

/**
 * Mechanical retrieval, with the shape-cue tie-fallback wired (see
 * shape-fallback.js's own header for the mechanism and the one incident it is
 * built from). Same scoring and ranking as the engine's own retrieve(); the
 * only addition is a tie at the TOP score: when two or more chunks share it
 * and `shapeFallback` is a function, the fallback is handed that tied group,
 * the question, and the full chunk list, and may name one tied member to
 * promote. Promotion only ever reorders within the tied group (the promoted
 * chunk moves to its front; the rest keep their original relative order) and
 * can therefore change WHICH chunks are returned when `limit` is smaller than
 * the group. A fallback that declines, throws, or names a chunk outside the
 * tied group leaves the untouched baseline. "Tied" is exact `===` on the
 * integer-or-half score — never an epsilon (see shape-fallback.js's header).
 */
export function retrieve(chunks, question, limit = 3, foldedRefs = [], { shapeFallback = null } = {}) {
  const qTerms = [...new Set(tokenize(question))];
  if (!qTerms.length) return [];
  const folded = new Set(foldedRefs);
  const scored = chunks
    .map((c) => {
      const hits = qTerms.filter((t) => c.terms.has(t)).length;
      // A passage already folded into an earlier turn's record is
      // deprioritized, not excluded: it has been read once already, and a turn
      // that keeps re-reading the same paragraph is not making progress. Half
      // its own score rather than a fixed subtraction, so the penalty stays
      // proportional to how relevant the passage was in the first place.
      const score = folded.has(c.ref) ? hits / 2 : hits;
      return { chunk: c, hits, score };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.score - a.score || a.chunk.start - b.chunk.start);
  if (scored.length) {
    const topScore = scored[0].score;
    const tieEnd = scored.findIndex((s) => s.score !== topScore);
    const tieLen = tieEnd < 0 ? scored.length : tieEnd;
    if (tieLen >= 2 && typeof shapeFallback === "function") {
      const tied = scored.slice(0, tieLen).map((s) => s.chunk);
      // A throwing fallback is a decline, not a crash — the same posture as
      // a fallback that returns nothing: retrieve() is the only thing that
      // ever touches the result, and the reader is never held hostage to a
      // tie-break organ's own defects.
      let pick = null;
      try {
        pick = shapeFallback(tied, question, chunks);
      } catch {
        pick = null;
      }
      if (pick && tied.includes(pick)) {
        const ordered = [pick, ...tied.filter((c) => c !== pick)].map((c) => ({ chunk: c }));
        scored.splice(0, tieLen, ...ordered);
      }
    }
  }
  return scored.slice(0, limit).map((s) => s.chunk);
}