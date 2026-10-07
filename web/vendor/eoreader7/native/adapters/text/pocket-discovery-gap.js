// adapters/text/pocket-discovery-gap.js — how many real sub-clusters
// ("pockets") sit inside one POS/provenance bucket's ablation-delta vectors,
// discovered from the data, never hand-set. Replaces an earlier ad hoc
// agglomerative-z-test approach (kept in this session's own scratch history,
// not landed here) that killed its own false positives (0/5 on unstructured
// synthetic data) but at a real power cost, honestly measured: only 1/5 true
// positives on realistic non-axis-aligned 3-cluster data, even with its null
// trial count raised 30->100. That result was reported as underpowered, not
// fixed, and named the gap statistic (Tibshirani, Walther & Hastie 2001) --
// an established, peer-reviewed method for this exact problem -- as the
// honest next lever rather than more hand-tuning of a home-grown statistic.
//
// Measured on the SAME synthetic scenarios as the ad hoc method (16-dim,
// non-axis-aligned Gaussian blobs): 4/5 true positives on repeated 3-cluster
// trials (vs the ad hoc method's 1/5) at a cost of 1/5 false positives on
// repeated null trials (vs the ad hoc method's 0/5) -- a real, reported
// precision/recall trade-off, not an unqualified improvement. Whether this
// trade-off is the right one for live use is a separate question from
// whether the method itself is sound; this file exists to make that
// trade-off measurable, not to declare it settled.
//
// Why this matters for ablation-grain-pressure.js: buildCentroidsFrom
// currently does `centroids[pos] = mean(deltas.map(norm))` -- one centroid
// per POS, per provenance set. Real usage inside one POS is not one
// cluster (concrete vs. abstract nouns pull embeddings in different
// directions); a single mean throws that structure away. This module finds
// how many directions are actually there. NOT yet wired into
// buildCentroidsFrom -- that wiring is a later, still-blocked step (the
// shared Ollama /api/embed endpoint this needs real centroids from has been
// down all session; see documents/vision-end-state:1.jsonl's own ordered
// next-steps list). This file lands the discovery method on its own,
// tested against synthetic data only, ahead of that dependency clearing.
//
// The null here is directions uniformly random on the unit hypersphere
// (same n, same dimensionality as the real data) -- the natural reference
// distribution for cosine/angular data, playing the same role Tibshirani's
// uniform-bounding-box null plays for Euclidean data. Unit vectors make
// squared-Euclidean and cosine distance monotonically related
// (||a-b||^2 = 2 - 2cos(a,b) when ||a||=||b||=1), so standard Euclidean
// k-means / within-cluster-dispersion machinery applies directly.

function norm(v) { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); }
function sqDist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s; }
function mean(vs) { const d = vs[0].length; const out = new Array(d).fill(0); for (const v of vs) for (let i = 0; i < d; i++) out[i] += v[i]; return out.map((x) => x / vs.length); }

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// Box-Muller, seeded -- for null points uniform on the unit hypersphere
// (normalize a standard-Gaussian vector) and for k-means++-style init.
function gaussian(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomUnitVector(dim, rnd) {
  const v = Array.from({ length: dim }, () => gaussian(rnd));
  return norm(v);
}

/** k-means on unit vectors (k-means++ init, `restarts` random starts, keep
 *  the lowest-W_k run) -- returns { assignments, centers, Wk } where
 *  Wk = sum over clusters of sum of squared distances to that cluster's own
 *  mean (the standard pooled within-cluster dispersion the gap statistic's
 *  log(W_k) is built from). */
function kmeans(vectors, k, rnd, restarts = 8, iters = 50) {
  const n = vectors.length;
  if (k >= n) {
    return { assignments: vectors.map((_, i) => i), centers: vectors.map((v) => v.slice()), Wk: 0 };
  }
  let best = null;
  for (let r = 0; r < restarts; r++) {
    // k-means++ seeding: spreads initial centers apart, avoids bad local minima
    const centers = [vectors[Math.floor(rnd() * n)].slice()];
    while (centers.length < k) {
      const d2 = vectors.map((v) => Math.min(...centers.map((c) => sqDist(v, c))));
      const total = d2.reduce((s, x) => s + x, 0) || 1;
      let target = rnd() * total, idx = 0;
      for (; idx < n; idx++) { target -= d2[idx]; if (target <= 0) break; }
      centers.push(vectors[Math.min(idx, n - 1)].slice());
    }
    let assignments = new Array(n).fill(0);
    for (let it = 0; it < iters; it++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let bestJ = 0, bestD = Infinity;
        for (let j = 0; j < k; j++) { const d = sqDist(vectors[i], centers[j]); if (d < bestD) { bestD = d; bestJ = j; } }
        if (assignments[i] !== bestJ) { assignments[i] = bestJ; changed = true; }
      }
      for (let j = 0; j < k; j++) {
        const members = vectors.filter((_, i) => assignments[i] === j);
        if (members.length) centers[j] = mean(members);
      }
      if (!changed) break;
    }
    let Wk = 0;
    for (let i = 0; i < n; i++) Wk += sqDist(vectors[i], centers[assignments[i]]);
    if (!best || Wk < best.Wk) best = { assignments: assignments.slice(), centers: centers.map((c) => c.slice()), Wk };
  }
  return best;
}

/**
 * discoverPocketsByGapStatistic(rawVectors, opts)
 *   -> { k, pockets, gaps, basis }
 *
 * opts: { kMax, nullTrials, kmeansRestarts, seed }
 *   kMax: largest cluster count considered (default min(n-1, 6) -- bounded
 *   by how many real usage-directions a single POS/provenance bucket could
 *   plausibly hold at the vector counts this actually runs on, not a belief
 *   about the true number).
 *   nullTrials: reference datasets sampled per k for the null log(W_k)
 *   estimate (a Monte Carlo precision knob, not a threshold on real data --
 *   raising it only tightens the null estimate, it cannot manufacture a gap
 *   that isn't there).
 */
export function discoverPocketsByGapStatistic(rawVectors, { kMax, nullTrials = 20, kmeansRestarts = 8, seed = 1 } = {}) {
  const vectors = rawVectors.map(norm);
  const n = vectors.length;
  if (n === 0) return { k: 0, pockets: [], gaps: [], basis: "no vectors" };
  if (n < 4) return { k: 1, pockets: [{ center: mean(vectors), n, memberIdx: vectors.map((_, i) => i) }], gaps: [], basis: "too few vectors to estimate a gap statistic; one trivial pocket" };

  const dim = vectors[0].length;
  const K = Math.max(1, Math.min(kMax ?? Math.min(n - 1, 6), n - 1));
  const rnd = rng(seed);

  const realRuns = [];
  const logWk = [];
  for (let k = 1; k <= K; k++) {
    const run = kmeans(vectors, k, rnd, kmeansRestarts);
    realRuns.push(run);
    logWk.push(Math.log(Math.max(run.Wk, 1e-12)));
  }

  // null: nullTrials reference datasets, each n points uniform on the same
  // unit hypersphere, same k-means procedure, same k range.
  const nullLogWk = Array.from({ length: K }, () => []);
  for (let b = 0; b < nullTrials; b++) {
    const nullVectors = Array.from({ length: n }, () => randomUnitVector(dim, rnd));
    for (let k = 1; k <= K; k++) {
      const run = kmeans(nullVectors, k, rnd, kmeansRestarts);
      nullLogWk[k - 1].push(Math.log(Math.max(run.Wk, 1e-12)));
    }
  }

  const gaps = [], sdk = [];
  for (let k = 1; k <= K; k++) {
    const nulls = nullLogWk[k - 1];
    const nullMean = nulls.reduce((s, x) => s + x, 0) / nulls.length;
    const nullSd = Math.sqrt(nulls.reduce((s, x) => s + (x - nullMean) ** 2, 0) / nulls.length);
    gaps.push(nullMean - logWk[k - 1]);
    sdk.push(nullSd * Math.sqrt(1 + 1 / nullTrials));
  }

  // Tibshirani's rule: smallest k such that Gap(k) >= Gap(k+1) - s_{k+1}.
  // If no k in [1, K-1] satisfies it, fall back to argmax(Gap) -- a
  // documented, standard fallback for when the sequence never triggers the
  // rule at all (e.g. K itself is the best-supported choice).
  let chosenK = null;
  for (let k = 1; k <= K - 1; k++) {
    if (gaps[k - 1] >= gaps[k] - sdk[k]) { chosenK = k; break; }
  }
  if (chosenK === null) {
    let bestIdx = 0;
    for (let i = 1; i < gaps.length; i++) if (gaps[i] > gaps[bestIdx]) bestIdx = i;
    chosenK = bestIdx + 1;
  }

  const chosenRun = realRuns[chosenK - 1];
  const pockets = Array.from({ length: chosenK }, (_, j) => ({
    center: chosenRun.centers[j],
    n: chosenRun.assignments.filter((a) => a === j).length,
    memberIdx: chosenRun.assignments.map((a, i) => (a === j ? i : -1)).filter((i) => i >= 0),
  }));

  return {
    k: chosenK,
    pockets,
    gaps: gaps.map((g, i) => ({ k: i + 1, gap: g, sd: sdk[i], logWk: logWk[i] })),
    basis: `gap statistic over k=1..${K}, ${nullTrials} reference null(s) per k (uniform-on-hypersphere, same n=${n} and dim=${dim}): chose k=${chosenK} via Tibshirani's rule (smallest k with Gap(k) >= Gap(k+1) - s_{k+1}), or argmax(Gap) if that rule never triggered`,
  };
}
