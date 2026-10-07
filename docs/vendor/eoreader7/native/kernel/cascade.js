// kernel/cascade.js — ONE shared primitive for "what rests on this,
// transitively": invert a dependency list into Map<id, Set<dependentId>>
// once, then walk a single multi-source BFS over it.
//
// organs/derivation.js's premise-withdrawal cascade (exposure/
// withdrawDerived) and this kernel's own licence-withdrawal cascade
// (reaction.js::withdraw) grew the identical shape independently, each
// hand-rolled: a frontier of ids, and at every round a full rescan of the
// live set asking "does this candidate's dependency list `.includes()` a
// frontier id" — O(rounds * liveSize) instead of O(edges). reaction.js's
// own copy was worse again: it rebuilt its whole candidate array
// (`allDerived()`) fresh on every single frontier item, not just once per
// round. Per the legacy engine.1's own CLAUDE.md ("When two goldens grow the same
// tool independently, reconcile them — don't just dedupe"): both were read
// in full, neither was strictly superior — derivation.js's version already
// used a `seen` set correctly and never rescanned per item; reaction.js's
// version already carried the "seeds are taken too" shape derivation.js's
// callers don't need. This file is the union: one inversion, one walk,
// reused by both, with each caller's own seeding behaviour left to it.
//
// Neither function below knows what an "id" means — a raw testimony note,
// a derived note, or a derived hyperedge are all just ids and dependency
// lists here.

/**
 * dependentsIndex(items, dependsOn, idOf) — Map<id, Set<dependentId>>,
 * built once.
 *   items      any array of nodes
 *   dependsOn  (item) => iterable of ids this item rests on (its premises,
 *              or its derivation parents)
 *   idOf       (item) => this item's own stable id (default: `item.id` —
 *              derivation.js's notes carry it there; reaction.js's own
 *              `allDerived()` rows carry it at `.edge.id`, so that caller
 *              passes `(f) => f.edge.id`)
 */
export function dependentsIndex(items, dependsOn, idOf = (item) => item.id) {
  const index = new Map();
  for (const item of items ?? []) {
    const id = idOf(item);
    for (const dep of dependsOn(item) ?? []) {
      if (!index.has(dep)) index.set(dep, new Set());
      index.get(dep).add(id);
    }
  }
  return index;
}

/**
 * cascade(index, seeds, { seen }) — the transitive closure of DEPENDENTS
 * reachable from `seeds`, as one multi-source breadth-first walk over a
 * prebuilt `dependentsIndex`. Every id is visited at most once, so this is
 * O(edges actually touched), never O(rounds * the whole live set).
 *
 * Seeds themselves are never in the returned array — a caller that wants
 * them counted too (reaction.js's own `withdraw`, where the directly-
 * matched facts are themselves taken, at depth 0, cascadedFrom: null) adds
 * them itself; a caller whose seed is external to the dependency graph
 * (derivation.js's own `premise`, a note id that is not itself one of the
 * derived items being walked) does not.
 *
 * `seen` (optional, mutated in place) pre-populates ids to treat as
 * already reached, and accumulates every id this call visits too — a
 * caller with its own persistent "already taken" set (reaction.js's
 * `withdrawn` Map) passes its keys so a later call does not re-walk from,
 * or re-take, something a prior call already took: by construction,
 * everything transitively resting on an already-taken id is already taken
 * too, so there is nothing further to discover past it.
 *
 * Returns an array of { id, cascadedFrom, cascadeDepth }, each visited
 * exactly once, in breadth-first order — so `cascadeDepth` is the
 * SHORTEST path from any seed, and ties (an id reachable from two seeds,
 * or through two parents, at the same depth) resolve to whichever parent
 * this pass reaches it through first.
 */
export function cascade(index, seeds, { seen = new Set() } = {}) {
  const taken = [];
  const frontier0 = [];
  for (const s of seeds ?? []) { seen.add(s); frontier0.push({ id: s, depth: 0 }); }
  let frontier = frontier0;
  while (frontier.length) {
    const next = [];
    for (const { id, depth } of frontier) {
      for (const dep of index.get(id) ?? []) {
        if (seen.has(dep)) continue;
        seen.add(dep);
        taken.push({ id: dep, cascadedFrom: id, cascadeDepth: depth + 1 });
        next.push({ id: dep, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return taken;
}

// Every id a cascade() over this index could ever return or accept as a
// seed: every key (a ground other ids depend on) union every id inside
// every key's Set (a dependent). Ids outside this union can never appear
// in a real cascade, so they are never worth drawing as a synthetic seed.
function universeOf(index) {
  const ids = new Set();
  for (const [key, dependents] of index) {
    ids.add(key);
    for (const dep of dependents) ids.add(dep);
  }
  return [...ids];
}

// Fisher-Yates partial shuffle: the first `count` slots of a copy of
// `universe`, each equally likely, no id repeated. If `count` exceeds the
// universe's size the whole universe is returned (every id sampled once) —
// there being no way to draw more distinct ids than exist.
function sampleWithoutReplacement(universe, count, rng) {
  const pool = universe.slice();
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function maxDepthOf(hits) {
  let max = 0;
  for (const h of hits) if (h.cascadeDepth > max) max = h.cascadeDepth;
  return max;
}

/**
 * cascadeNull(index, seedCount, opts) — the empirical distribution of
 * cascade() reach for `trials` synthetic seed sets of size `seedCount`,
 * drawn uniformly without replacement from this index's own id universe
 * (see `universeOf`). Calls the real `cascade` unmodified, once per trial;
 * no reimplementation of the walk.
 *
 * Returns { reachedCounts: number[], maxDepths: number[] }, each array of
 * length `trials`, unsorted — a distribution, never a verdict. `rng` is
 * injectable so callers (tests) can get a deterministic distribution;
 * production callers take the `Math.random` default.
 */
export function cascadeNull(index, seedCount, { trials = 200, rng = Math.random } = {}) {
  const universe = universeOf(index);
  const reachedCounts = [];
  const maxDepths = [];
  for (let t = 0; t < trials; t++) {
    const seeds = sampleWithoutReplacement(universe, seedCount, rng);
    const hits = cascade(index, seeds);
    reachedCounts.push(hits.length);
    maxDepths.push(maxDepthOf(hits));
  }
  return { reachedCounts, maxDepths };
}

/**
 * cascadeSurprise(index, seeds, opts) — runs the real cascade, then
 * cascadeNull at the same seed count, and reports where the real result
 * ranks in that distribution.
 *
 * Returns { reached, maxDepth, rank, trials }. `rank` is
 * count(nullReachedCounts <= reached) / trials — 1.0 means this cascade
 * reached farther than every synthetic trial, 0.0 means every synthetic
 * trial reached at least as far. No alpha, no pass/fail baked in: the rank
 * is the measurement, and the caller decides what, if anything, to do with
 * it (e.g. recording it on the ground ledger).
 */
export function cascadeSurprise(index, seeds, { trials = 200, rng = Math.random } = {}) {
  const real = cascade(index, seeds);
  const { reachedCounts } = cascadeNull(index, (seeds ?? []).length, { trials, rng });
  const atOrBelow = reachedCounts.filter((c) => c <= real.length).length;
  return { reached: real.length, maxDepth: maxDepthOf(real), rank: atOrBelow / trials, trials };
}
