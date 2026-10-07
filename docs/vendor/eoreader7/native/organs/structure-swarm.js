// structure-swarm.js — AN ANT COLONY THAT LOOKS FOR STRUCTURE IN A SERIES, WITH THE REAL STIGMERGY, AND A BAR SET BY THE SEARCH ITSELF.
//
// Fold invariant: THE COLONY MAY TRY ANYTHING AND IS BELIEVED ABOUT NOTHING. Ants build pipelines (transforms, then one statistic) by
// following the trails earlier ants left (kernel/stigmergy.js — the same pheromone layer the hard-read swarm uses: success deposits,
// failure deposits nothing, evaporation demotes, a scout still tries the untried). A pipeline is worth reporting only if it beats a
// SEARCH-AWARE ceiling: the best z any of the pipelines this colony tried reaches on a copy of the data with nothing in it. So a wider
// search raises the bar (signal.js's rule), and a colony that finds nothing says so.
//
// The colony knows no domain. Moves and judges live in er7py/swarm.py; this file is the ants, the trails, the ceiling and the report.
// The evaluator is injected (evalBatch / ceilingOf) so the colony is testable without python and the notebook can run it on real data.
import { deposit, routeOrderFor } from "../kernel/stigmergy.js";

export const TRANSFORMS = Object.freeze(["diff1", "diff8", "diff64", "fast4", "fast16", "slow16", "abs", "sq", "blk64", "blk512", "detrend"]);
export const STATS = Object.freeze(["std", "skew", "kurt", "acf1", "acf8", "acf64", "slope", "peak", "trend"]);
export const MAX_DEPTH = 3;        // declared: transforms per pipeline
export const Z_OK = 3;             // declared: a pipeline that clears this against its null lays a trail (the search-aware ceiling decides what is REPORTED)
export const EXPLORE = 0.35;       // chosen by hand, not yet measured against a null: a common epsilon-greedy exploration rate — the chance an ant scouts a random allowed move instead of following the strongest trail (kernel's own 10% only ever reorders the FIRST hop)
export const ROUNDS = 3, ANTS = 24; // declared: a colony is ROUNDS generations of ANTS ants
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const key = (spec) => spec.join(">");

/** One ant: walk the graph start -> transform* -> statistic, choosing each step by the learned order at that node. */
export function walk(trails, { rng, now, tried = new Set() }) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const spec = []; let prev = null;
    for (let d = 0; ; d++) {
      const head = prev ? `swarm|after:${prev}` : "swarm|start";
      const routes = d >= MAX_DEPTH ? [...STATS] : [...TRANSFORMS, ...STATS];
      // a trail may name a move this step no longer allows; and repeating the move just made (differencing twice, detrending twice) is a variant, not a discovery
      const order = routeOrderFor(trails, head, { now, routes, rng }).filter((r) => routes.includes(r) && r !== prev);
      const step = rng() < EXPLORE || attempt > 6 ? order[Math.floor(rng() * order.length)] : order[0];
      spec.push(step); if (STATS.includes(step)) break; prev = step;
    }
    if (!tried.has(key(spec))) return spec;
  }
  return null;
}

/** colony({ evalBatch, ceilingOf, trails, rounds, ants, seed, now }) -> { trails, tried, results, ceiling, structures, log } */
export async function colony({ evalBatch, ceilingOf, trails = {}, rounds = ROUNDS, ants = ANTS, seed = 1, now = Date.now() }) {
  const rng = lcg(seed), tried = new Set(), all = [], log = [];
  let t = trails;
  for (let r = 0; r < rounds; r++) {
    const specs = [];
    for (let a = 0; a < ants; a++) { const sp = walk(t, { rng, now, tried }); if (!sp) break; tried.add(key(sp)); specs.push(sp); }
    if (!specs.length) break;
    const res = await evalBatch(specs, seed * 1000 + r), t0 = Date.now(); let laid = 0;
    res.forEach((x, i) => {
      all.push(x);
      if (Math.max(x.z_shuffle ?? 0, x.z_phase ?? 0) < Z_OK) return;
      let prev = null; for (const step of x.spec) { t = deposit(t, { head: prev ? `swarm|after:${prev}` : "swarm|start", route: step, ok: true, ms: i, at: now }); prev = step; } laid++;
    });
    log.push({ round: r + 1, ants: specs.length, trails: laid, best: Math.max(0, ...res.map((x) => Math.max(x.z_shuffle ?? 0, x.z_phase ?? 0))) });
  }
  const ceiling = await ceilingOf(all.map((x) => x.spec), seed);
  const found = [];
  for (const x of all) for (const nul of ["shuffle", "phase"]) { const z = x[`z_${nul}`] ?? 0; if (z > ceiling[nul] && x.stat != null) found.push({ spec: x.spec, null: nul, z, stat: x.stat, gloss: x.gloss, over: z / Math.max(ceiling[nul], 1e-9) }); }
  // Redundancy: many pipelines see one thing. Per null, keep the strongest two per final statistic (parsimony-ranked), then cap the null's list.
  // A find that beats only the SHUFFLE null says "order matters" — true of any correlated series — so it is capped lower than one that beats the
  // PHASE null (nonlinear structure the spectrum cannot explain), which is the informative kind.
  const rank = (f) => f.z / (1 + 0.25 * (f.spec.length - 1)), CAP = { phase: 5, shuffle: 3 };
  const seen = new Map(), per = { phase: 0, shuffle: 0 }, structures = [];
  for (const f of found.sort((a, b) => rank(b) - rank(a))) { const k = `${f.spec.at(-1)}|${f.null}`; const n = seen.get(k) ?? 0; if (n < 2 && per[f.null] < CAP[f.null]) { seen.set(k, n + 1); per[f.null]++; structures.push(f); } }
  structures.sort((a, b) => (b.null === "phase") - (a.null === "phase") || rank(b) - rank(a));
  return { trails: t, tried: all.length, results: all, ceiling, structures, foundBeforeDedupe: found.length, log };
}
