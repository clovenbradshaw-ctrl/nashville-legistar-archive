// fold-chat-outside.js — THE OUTSIDE INTERPRETER. The DMD gate (fold-chat-dmd.js)
// reads the turn's RESIDUAL trajectory; experiment-recursion.mjs proved that a
// self-produced flat residual can never fire it — the loop cannot close itself.
// These are the two OUTSIDE signals a fold turn actually has, and they close it:
//
//   1. NEW GROUND  — did a search return a source the turn had not already read?
//      A climb that re-searches the same ground cannot converge; more passes add
//      nothing. (The web is the outside interpreter here.)
//   2. REPEATED STATE — did a pass end in a state (ground + lack + plan + finding)
//      the turn has already been in? A repeated state is a cycle, however flat
//      the residual reads.
//
// PURE: no clock, no random, no IO. Falsifying controls in
// fold-chat-outside.test.mjs: the same material must leave `novel` empty; the
// same state must be flagged stagnant on the second sighting; `stateOf` must not
// depend on the order the ground was read.

/** keyOf(m) — a source's stable identity for "have I read THIS?": the host plus
 *  the path, query dropped. A different PAGE is new ground; the same page with a
 *  tracking query is not. The same host alone is too coarse (a whole site would
 *  be one page). Pure. */
export function keyOf(m) {
  const stripped = String((m && (m.source || m.url)) || "").replace(/^https?:\/\//i, "");
  const authority = stripped.split(/[/?#]/)[0];
  const host = authority.replace(/^www\./i, "").toLowerCase();
  const path = stripped.slice(authority.length).split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  return host + path;
}

/** novelGround(material, seen) — which sources are NEW to this turn, and every
 *  key the material names. PURE w.r.t. `seen`: it reads it, never mutates it —
 *  the caller decides what to remember. */
export function novelGround(material, seen = new Set()) {
  const keys = [];
  for (const m of (material || [])) { const k = keyOf(m); if (k) keys.push(k); }
  const novel = keys.filter((k) => !seen.has(k));
  return { novel, keys };
}

/** createProgressGuard({ maxRepeats, maxStalePasses }) — the turn's own state,
 *  watched TWO ways, because either alone is fooled:
 *    · maxRepeats  — the SAME state twice (an exact cycle);
 *    · maxStalePasses — passes that added NO new ground (a cycle the wording
 *      drifts under: the same situation re-described reads as a different state,
 *      so exact matching never fires — measured: F1).
 *  `note({ sig, groundSize })` -> { repeats, stale, grew, stagnant }. Pure. */
export function createProgressGuard({ maxRepeats = 1, maxStalePasses = 0 } = {}) {
  const seen = new Map();
  let lastSize = null, stale = 0;
  return {
    note({ sig = "", groundSize = 0 } = {}) {
      const key = String(sig ?? "");
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      const repeats = n > maxRepeats;
      let grew = false;
      if (lastSize === null) { grew = true; lastSize = groundSize; }
      else if (groundSize > lastSize) { grew = true; stale = 0; lastSize = groundSize; }
      else { stale += 1; }
      return { repeats: n, stale, grew, stagnant: repeats || stale > maxStalePasses };
    },
    get size() { return seen.size; },
  };
}

/** stateOf({ ground, need, finding, outline }) — the pass's identity: the thing
 *  whose repeat means "nothing changed". The ground is de-duped and sorted, so
 *  the same sources in a different order are the SAME state. Pure. */
export function stateOf({ ground = [], need = null, finding = null, outline = "" } = {}) {
  const g = [...new Set((ground || []).map(String))].sort().join(",");
  return JSON.stringify({
    g,
    n: String(need || "").replace(/\s+/g, " ").trim().slice(0, 80),
    f: String(finding || "").replace(/\s+/g, " ").trim().slice(0, 120),
    o: String(outline || "").replace(/\s+/g, " ").trim().slice(0, 80),
  });
}

/** isConverging(hist) — the residual has fallen for the last two transitions, so
 *  the turn IS settling: leave it to the DMD (which fires on the decay), never to
 *  the stale rule. Three points are required — a first look at two is not a
 *  trajectory. Pure. */
export function isConverging(hist = []) {
  const n = hist.length;
  return n >= 3 && Number(hist[n - 1]) < Number(hist[n - 2]) && Number(hist[n - 2]) < Number(hist[n - 3]);
}

export default { keyOf, novelGround, createProgressGuard, stateOf, isConverging };
