// native/kernel/identity-induction.js — IDENTITY INDUCTION: when two
// differently-named things are the same thing, FOR SOMEONE (2026-09-27).
// Medium-blind, kernel-level. Standing: nomination until its measurements
// (eval/identity/) say otherwise.
//
// THE DEFINITION (the user's, 2026-09-27, verbatim):
//   "Two things are the same thing relative to the relevant for whom if the
//    universe folded on them is the same, bounded by a distinction that makes
//    a difference and if the impact on the nodes around them, when
//    counterfactually changed, is greater than the same perturbations of
//    other things by chance."
//
// Read as four tests, each against a null the material itself supplies:
//
//   1  THE WORLDS MATCH      pool a's and b's occurrences and re-deal them
//                            into two groups of the same sizes, many times.
//                            If a and b were one thing, the observed
//                            similarity of their universes would sit inside
//                            that re-dealt band. Below it, the reading says
//                            they differ. (Exchangeability: "two readings of
//                            the same thing".)
//   2  ONLY WHAT MATTERS     the universe is widened hop by hop and widening
//                            stops where it no longer moves the verdict
//                            statistics beyond their own null's spread; a
//                            frame may also declare which features its
//                            question depends on (`relevant`).
//   3  THEY CARRY WEIGHT     the counterfactual: replace x by the background
//                            (an average node of its kind) and measure how far
//                            the surroundings move. That distance must exceed
//                            what a random same-size draw of background
//                            occurrences moves them. Idle things fail here, so
//                            two empty universes can never "match".
//   4  THE SAME CONSEQUENCE  the direction of that counterfactual — x's lift
//                            over the background, feature by feature — must
//                            align between a and b more than a's lift aligns
//                            with randomly drawn other nodes of the kind.
//
// Test 1 alone is a failure to find a difference, which small samples always
// "pass"; test 4 is the positive evidence. Test 3 keeps test 4 honest.
// The earlier, refuted attempt (±1-token company, where saw/wrote beat
// looked/gazed) was test 1 alone at radius 1 with no background subtracted.
//
// MEDIUM-BLIND. A node is an opaque id; an occurrence is a list of opaque
// features tagged with a hop (`{ f, hop }`). This file knows no word, no
// sentence, no verb. The caller decides what a node and a feature are — in
// text, a relation label and the ends it joins; in music, a motif and what
// sounds with it.
//
// NUMBERS ARE DECLARED (P9, P4): `draws`, `alpha`, `seed`, `minOccurrences`,
// `maxHop` have no defaults. A pair below `minOccurrences` on either side is a
// typed gap — "not enough reading yet" — never "different".
//
// WHAT A VERDICT IS. `same` is a scoped, revisable standing for this frame
// over this record, never a received identity: the grain theorem forbids a
// corpus from earning an unscoped Pattern claim, and this does not claim one.
// It is landed by the caller as a hypothesis (identity.js) and conceded when
// further reading moves either universe.

import { createSeededRng } from "./rng.js";
import { BOUND, CONTRADICTED, UNBOUND, BEYOND_REACH, verdictOfSupport } from "../interpretation/hl.js";
import { economySVD, matmul, transpose } from "./dmd.js";

const need = (opts, keys) => {
  for (const k of keys) if (opts[k] === undefined || opts[k] === null) throw new TypeError(`identity-induction: '${k}' must be declared`);
};

/** Sum a list of occurrences into a count vector at radius `hop`. */
export function profileOf(occurrences, { hop, relevant = null, drop = null } = {}) {
  const v = new Map();
  for (const occ of occurrences) {
    for (const { f, hop: h } of occ) {
      if (h > hop) continue;
      if (drop && drop.has(f)) continue;
      if (relevant && !relevant(f)) continue;
      v.set(f, (v.get(f) ?? 0) + 1);
    }
  }
  return v;
}

const norm = (v) => { let s = 0; for (const x of v.values()) s += x * x; return Math.sqrt(s); };
const total = (v) => { let s = 0; for (const x of v.values()) s += x; return s; };

/** Cosine similarity of two sparse vectors (0 when either is empty). */
export function cosine(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) { const y = big.get(k); if (y) dot += x * y; }
  return dot / (na * nb);
}

/** Total-variation distance between a profile and the background, as distributions. */
function departure(p, background) {
  const tp = total(p), tb = total(background);
  if (!tp || !tb) return 0;
  let d = 0;
  const keys = new Set([...p.keys(), ...background.keys()]);
  for (const k of keys) d += Math.abs((p.get(k) ?? 0) / tp - (background.get(k) ?? 0) / tb);
  return d / 2;
}

/**
 * The counterfactual's direction: smoothed log-lift of x over the background
 * on each feature x carries. `smooth` is a pseudo-count, declared.
 */
export function liftOf(p, background, { smooth, minFeatureCount = 1 }) {
  const tp = total(p), tb = total(background), V = background.size || 1;
  const out = new Map();
  for (const [k, c] of p) {
    if (c < minFeatureCount) continue;
    const px = (c + smooth) / (tp + smooth * V);
    const pb = ((background.get(k) ?? 0) + smooth) / (tb + smooth * V);
    const l = Math.log(px / pb);
    if (l > 0) out.set(k, l);
  }
  return out;
}

const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

const subsample = (arr, k, rng) => {
  if (arr.length <= k) return arr;
  const d = [...arr];
  for (let j = d.length - 1; j >= d.length - k; j -= 1) { const r = Math.floor(rng() * (j + 1)); [d[j], d[r]] = [d[r], d[j]]; }
  return d.slice(d.length - k);
};

const sample = (arr, k, rng) => {
  const out = [];
  for (let i = 0; i < k; i += 1) out.push(arr[Math.floor(rng() * arr.length)]);
  return out;
};

/**
 * makeIdentityInduction(record, opts)
 *   record   Map<nodeId, occurrence[]>  — every node of ONE kind in the frame
 *            (occurrence = [{ f, hop }]). Nodes of other kinds never enter.
 *   opts     { draws, alpha, seed, minOccurrences, maxHop, smooth, resolution,
 *              minFeatureCount (a feature seen fewer times in a node is noise
 *              in its lift, not its consequence),
 *              namesNode?, relevant? }
 *     resolution  the grain of test 1: worlds are compared as samples of this
 *                 many occurrences. A difference visible only above it is
 *                 below the distinction that makes a difference for this
 *                 frame. Must be <= minOccurrences / 2 (two disjoint samples
 *                 of one node are the within-node band).
 *     namesNode   (feature) => nodeId | null. A feature that NAMES a node
 *                 (a hop-2 feature "this end also keeps label L") is masked
 *                 whenever that node is one of the pair being judged — a
 *                 universe that carries the candidate's own name decides the
 *                 question by spelling (found live: planted twins judged
 *                 "different" 20/30 because each half's features named the
 *                 other). Omit it only when no feature names a node.
 * returns { judge(a, b), frame }
 */
export function makeIdentityInduction(record, opts = {}) {
  const rawRecord = record;
  need(opts, ["draws", "alpha", "seed", "minOccurrences", "maxHop", "smooth", "resolution", "minFeatureCount"]);
  const { draws, alpha, seed, minOccurrences, maxHop, smooth, resolution, minFeatureCount, relevant = null, namesNode = null, trajectory = null } = opts;
  if (trajectory) need(trajectory, ["windows", "basis", "draws"]);
  if (2 * resolution > minOccurrences) throw new RangeError("identity-induction: resolution must be <= minOccurrences / 2");
  // An occurrence is either a feature list, or { at, features } when the
  // caller knows WHERE in the reading it happened (test 5 needs it).
  const AT = new WeakMap();
  {
    const norm = new Map();
    for (const [n, occs] of record) norm.set(n, occs.map((o) => {
      if (Array.isArray(o)) return o;
      const fs = [...o.features]; AT.set(fs, o.at); return fs;
    }));
    record = norm;
  }
  // which features name which node — computed once
  const naming = new Map();
  if (namesNode) for (const occs of record.values()) for (const o of occs) for (const { f } of o) {
    if (naming.has(f)) continue;
    const n = namesNode(f); if (n != null) naming.set(f, n);
  }
  // SELF-NAMING IS DROPPED FOR EVERY NODE, not only the pair being judged.
  // Masking only the candidates left every OTHER node's occurrences carrying
  // their own names, so a candidate's profile lacked a kind of feature every
  // null draw had — a small, systematic departure test 3 read as weight.
  // Found live: a label-shuffle control (II.23, answer known: nothing is the
  // same) came back 13/66 "same" at hop 2 and 0/66 at hop 1.
  if (namesNode) {
    const clean = new Map();
    for (const [n, occs] of record) clean.set(n, occs.map((o) => { const c = o.filter(({ f }) => naming.get(f) !== n); if (AT.has(o)) AT.set(c, AT.get(o)); return c; }));
    record = clean;
  }
  const nodes = [...record.keys()].filter((n) => (record.get(n)?.length ?? 0) >= minOccurrences);
  const allOcc = [];
  for (const n of record.keys()) for (const o of record.get(n)) allOcc.push(o);
  const maskFor = (a, b) => {
    const m = new Set();
    for (const [f, n] of naming) if (n === a || n === b) m.add(f);
    return m;
  };

  const bgCache = new Map();
  const background = (hop, drop) => {
    if (!bgCache.has(hop)) bgCache.set(hop, profileOf(allOcc, { hop, relevant }));
    const bg = bgCache.get(hop);
    if (!drop.size) return bg;
    const out = new Map(bg); for (const f of drop) out.delete(f); return out;
  };
  const P = (occ, hop, drop) => profileOf(occ, { hop, relevant, drop });

  // test 3 — the counterfactual weight of x, ranked against same-size draws
  // of THE REST of the corpus (found live, 2026-09-28, mention-eval.mjs on
  // War and Peace: a planted twin of Pierre — 16.6% of the pooled mention
  // count — read idle 16/16 times; Natasha at 10.3% and Bonaparte at 0.8%
  // read bound once x's own material left the comparison; the synthetic
  // test's 16 near-equal nodes, ~6.25% share each, never had the power to
  // surface this). `allOcc` (and the shared `background()`) pool EVERY
  // node's occurrences, x's own included; a same-size null draw FROM THAT
  // POOL, and a background COMPUTED FROM IT, are each partly x, so for a
  // node with a large share the null resembles x by construction and
  // "carries weight" grows harder to earn exactly for the best-attested
  // nodes — backwards. The fix is test 4's own convention (`others =
  // nodes.filter(n => n !== a && n !== b)`) applied one register over: both
  // the background x is compared against and the pool the null is drawn
  // from exclude x's own occurrences, so "does x depart from the rest of
  // the corpus more than a same-size slice of the rest of the corpus
  // departs from itself" is asked of the same population on both sides.
  const weight = (x, hop, drop, rng) => {
    const occ = record.get(x);
    const own = new Set(occ);
    const pool = allOcc.filter((o) => !own.has(o));
    const bgRest = profileOf(pool, { hop, relevant, drop });
    const observed = departure(P(occ, hop, drop), bgRest);
    const nul = [];
    for (let i = 0; i < draws; i += 1) nul.push(departure(P(sample(pool, occ.length, rng), hop, drop), bgRest));
    const ceiling = quantile(nul, 1 - alpha);
    return { observed, ceiling, carries: observed > ceiling };
  };

  const disjointPair = (occ, m, rng) => {
    const d = [...occ];
    for (let j = d.length - 1; j > d.length - 1 - 2 * m && j > 0; j -= 1) { const r = Math.floor(rng() * (j + 1)); [d[j], d[r]] = [d[r], d[j]]; }
    return [d.slice(d.length - m), d.slice(d.length - 2 * m, d.length - m)];
  };

  const statsAt = (a, b, hop, drop, rng) => {
    const A = record.get(a), B = record.get(b), m = resolution;
    // test 1 — at the declared resolution: is a b-sample as like an a-sample
    // as another a-sample (or b-sample) is?
    const within = [], cross = [];
    for (let i = 0; i < draws; i += 1) {
      const [a1, a2] = disjointPair(A, m, rng), [b1, b2] = disjointPair(B, m, rng);
      within.push(cosine(P(a1, hop, drop), P(a2, hop, drop)), cosine(P(b1, hop, drop), P(b2, hop, drop)));
      cross.push(cosine(P(a1, hop, drop), P(b1, hop, drop)));
    }
    const floor = quantile(within, alpha);
    const crossMedian = quantile(cross, 0.5);
    // test 4 — aligned consequence against random other nodes of the kind
    const bg = background(hop, drop);
    const la = liftOf(P(A, hop, drop), bg, { smooth, minFeatureCount }), lb = liftOf(P(B, hop, drop), bg, { smooth, minFeatureCount });
    const aligned = cosine(la, lb);
    const others = nodes.filter((n) => n !== a && n !== b);
    // MUTUAL: b must stand out among a's alignments with the kind, and a among b's
    const chanceA = [], chanceB = [];
    for (let i = 0; i < draws && others.length; i += 1) {
      // SIZE-MATCHED: "the same perturbation of other things" — a comparison
      // node enters at the candidate's own size, or a half-size twin is
      // measured against full-size nodes whose lifts are steadier than its own
      // (found live: planted twins failing test 4 while their decoys passed it).
      const c = record.get(others[Math.floor(rng() * others.length)]);
      const cb = liftOf(P(subsample(c, B.length, rng), hop, drop), bg, { smooth, minFeatureCount });
      const ca = liftOf(P(subsample(c, A.length, rng), hop, drop), bg, { smooth, minFeatureCount });
      chanceA.push(cosine(la, cb)); chanceB.push(cosine(lb, ca));
    }
    const ceilA = quantile(chanceA, 1 - alpha), ceilB = quantile(chanceB, 1 - alpha);
    const chanceCeiling = Math.max(ceilA, ceilB);
    const chance = [...chanceA, ...chanceB];
    const spread = quantile(chance, 0.75) - quantile(chance, 0.25);
    return {
      hop,
      worlds: { observed: crossMedian, floor, match: crossMedian >= floor },
      consequence: { observed: aligned, ceiling: chanceCeiling, spread, aligned: others.length > 0 && aligned > chanceCeiling },
    };
  };


  // ── test 5 — THE DMD BOUND: identity is the universe folded at a node OVER
  // THE READING, bounded by the dynamic modes that survive their own
  // order-shuffled null (the user's refinement, 2026-09-27: "a person's
  // identity for a given for whom is the universe folded at them bounded
  // DMDs"). Built after a bag-of-contexts reading merged Kutuzov with
  // Napoleon and Sonya with Natasha: a bag says what KIND a node is; its
  // trajectory says WHICH one.
  //   state(x, t)  x's features in reading-window t, on a shared basis of the
  //                background's most frequent features, as a unit direction
  //   dynamics(x)  the least-squares transition operator over x's consecutive
  //                present windows, at rank r_x = the number of DMD modes
  //                whose magnitude beats the same trajectory with its window
  //                ORDER shuffled (for-whom.js's trajectoryNull, per mode)
  //   test         a's dynamics predict b's transitions (and b's a's) better
  //                than the dynamics of random other nodes, fitted at the same
  //                size and rank, predict them
  // A node whose modes never beat the shuffle has no dynamics of its own: a
  // typed gap, never evidence either way.
  let span = null;
  if (trajectory) {
    let lo = Infinity, hi = -Infinity;
    for (const occs of record.values()) for (const o of occs) { const a = AT.get(o); if (Number.isFinite(a)) { lo = Math.min(lo, a); hi = Math.max(hi, a); } }
    if (Number.isFinite(lo)) span = { lo, hi: hi > lo ? hi : lo + 1 };
  }
  const windowOf = (at) => Math.min(trajectory.windows - 1, Math.floor(((at - span.lo) / (span.hi - span.lo)) * trajectory.windows));
  // THE BASIS IS THE PAIR'S OWN UNIVERSE: the most frequent features across
  // a's and b's occurrences, and every comparison node is projected onto that
  // same basis. It used to be the BACKGROUND's most frequent features — which,
  // wherever referents share common company, are exactly the features that
  // do not move, so the pair's own drifting features never entered and every
  // trajectory read "no dynamics" (found by the first conformance test of
  // test 5: a strong monotone drift, 800 occurrences, rank 0).
  const basisFor = (hop, drop, A, B) => [...profileOf([...A, ...B], { hop, relevant, drop })].sort((x, y) => y[1] - x[1]).slice(0, trajectory.basis).map(([f]) => f);
  // one unit, mean-subtracted state per reading window (null where absent)
  const windowStates = (occs, hop, drop, basis) => {
    const idx = new Map(basis.map((f, i) => [f, i]));
    const W = Array.from({ length: trajectory.windows }, () => new Array(basis.length).fill(0));
    for (const o of occs) {
      const a = AT.get(o); if (!Number.isFinite(a)) continue;
      const w = windowOf(a);
      for (const { f, hop: h } of o) { if (h > hop || (drop && drop.has(f))) continue; const i = idx.get(f); if (i !== undefined) W[w][i] += 1; }
    }
    const dirs = W.map((v) => { const n = Math.hypot(...v); return n > 0 ? v.map((x) => x / n) : null; });
    // MEAN-SUBTRACTED: a node's average direction persists under any window
    // order, so left in it is a mode at |lambda| ~ 1 in the real trajectory
    // AND every shuffle — it can never beat the null, and it hid every mode
    // beneath it (found live: every War and Peace name read rank 0).
    const present = dirs.filter(Boolean);
    const mean = present.length ? present[0].map((_, i) => present.reduce((m, v) => m + v[i], 0) / present.length) : [];
    return dirs.map((v) => (v ? v.map((x, i) => x - mean[i]) : null));
  };
  const statesOf = (occs, hop, drop, basis, order = null) => {
    const unit = windowStates(occs, hop, drop, basis);
    const seq = (order ?? unit.map((_, i) => i)).map((i) => unit[i]);
    const pairs = [];
    for (let t = 0; t + 1 < seq.length; t += 1) if (seq[t] && seq[t + 1]) pairs.push([seq[t], seq[t + 1]]);
    return pairs;
  };
  const asMatrices = (pairs) => [transpose(pairs.map((p) => p[0])), transpose(pairs.map((p) => p[1]))];
  // The rank-r least-squares operator Xp·X⁺ — exact DMD's own operator (the
  // modes dmd.js reports are its eigendecomposition); it is fitted here in the
  // full feature space so two nodes' operators act on the same states.
  const operatorOf = (pairs, r) => {
    if (pairs.length < 1) return null;
    const [X, Xp] = asMatrices(pairs);
    const { U, s, V } = economySVD(X, { rank: r });
    if (!s.length) return null;
    const VS = V.map((row) => row.map((v, j) => v / s[j]));
    return matmul(matmul(Xp, VS), transpose(U)); // k x k
  };
  const predError = (A, pairs) => {
    if (!pairs.length) return NaN;
    if (!A) return 1; // an operator fitted on nothing predicts nothing
    let e = 0, z = 0;
    for (const [x, y] of pairs) for (let i = 0; i < y.length; i += 1) { let p = 0; for (let j = 0; j < x.length; j += 1) p += A[i][j] * x[j]; e += (y[i] - p) ** 2; z += y[i] ** 2; }
    return z ? e / z : NaN;
  };
  // The bound is PREQUENTIAL, not a magnitude comparison. Measured: at a
  // 24-feature state over ~33 transitions DMD is underdetermined and its
  // eigenvalues overfit — a shuffled order produced LARGER magnitudes than
  // the real one (Pierre: 1.27 real vs 2.33 at the shuffle's 95th), so a
  // magnitude test could never pass. A mode survives when an operator of that
  // rank, fitted on half the transitions, predicts the other half better than
  // the same fit does on the trajectory with its window order destroyed.
  const twoFoldError = (pairs, r) => {
    const even = pairs.filter((_, i) => i % 2 === 0), odd = pairs.filter((_, i) => i % 2 === 1);
    if (even.length < 2 || odd.length < 2) return NaN;
    return (predError(operatorOf(even, r), odd) + predError(operatorOf(odd, r), even)) / 2;
  };
  const boundedRank = (occs, hop, drop, basis, rng) => {
    const pairs = statesOf(occs, hop, drop, basis);
    if (pairs.length < 4) return 0;
    const maxR = Math.min(basis.length, Math.floor(pairs.length / 2) - 1);
    const orders = [];
    for (let d = 0; d < trajectory.draws; d += 1) {
      const order = Array.from({ length: trajectory.windows }, (_, i) => i);
      for (let j = order.length - 1; j > 0; j -= 1) { const r = Math.floor(rng() * (j + 1)); [order[j], order[r]] = [order[r], order[j]]; }
      orders.push(statesOf(occs, hop, drop, basis, order));
    }
    let best = 0;
    for (let r = 1; r <= maxR; r += 1) {
      const obs = twoFoldError(pairs, r);
      const nul = orders.map((p) => twoFoldError(p, r)).filter(Number.isFinite);
      // stop at the FIRST rank that fails: searching past a failure tests each
      // rank at alpha and so lowers the bar the more ranks it tries (kairos)
      if (Number.isFinite(obs) && nul.length && obs < quantile(nul, alpha)) best = r; else break;
    }
    return best;
  };
  const dynamicsTest = (a, b, hop, drop, rng) => {
    if (!span) return { verdict: BEYOND_REACH, reason: "no_positions" };
    const A = record.get(a), B = record.get(b);
    const basis = basisFor(hop, drop, A, B);
    const ra = boundedRank(A, hop, drop, basis, rng), rb = boundedRank(B, hop, drop, basis, rng);
    if (!ra || !rb) return { verdict: UNBOUND, reason: "no_dynamics", ranks: { a: ra, b: rb } };
    // THE PATTERN: the two trajectories COINCIDE — a's world at a moment of
    // the reading agrees with b's world at the same moment. Measured, not
    // assumed: the first version compared one-step DYNAMICS (a's operator
    // predicting b's transitions), and a twin whose trajectory ran BACKWARDS
    // through the reading was judged bound — a smooth drift persists window to
    // window in either direction, so an operator describes how a trajectory
    // moves, never where it is. The DMD bound above stays the gate (both must
    // carry order-dependent dynamics); the comparison is synchronous, and its
    // null CIRCULARLY SHIFTS b's trajectory, which keeps b's own smoothness
    // intact so persistence alone can never pass (the swarm's strongest leg).
    const Wa = windowStates(A, hop, drop, basis), Wb = windowStates(B, hop, drop, basis);
    const sync = (x, y) => { let s = 0, n = 0; for (let t = 0; t < x.length; t += 1) if (x[t] && y[t]) { const nx = Math.hypot(...x[t]), ny = Math.hypot(...y[t]); if (nx && ny) { s += x[t].reduce((m, v, i) => m + v * y[t][i], 0) / (nx * ny); n += 1; } } return n ? { mean: s / n, n } : { mean: NaN, n: 0 }; };
    const observed = sync(Wa, Wb);
    if (observed.n < 3) return { verdict: UNBOUND, reason: "too_few_shared_windows", ranks: { a: ra, b: rb }, sharedWindows: observed.n };
    const shifted = [];
    for (let k = 1; k < trajectory.windows; k += 1) { const Ws = Wb.map((_, t) => Wb[(t + k) % Wb.length]); const v = sync(Wa, Ws).mean; if (Number.isFinite(v)) shifted.push(v); }
    const hi = quantile(shifted, 1 - alpha), lo = quantile(shifted, alpha);
    const forS = observed.mean > hi, againstS = observed.mean < lo;
    return { verdict: verdictOfSupport(forS, againstS), ranks: { a: ra, b: rb }, sync: observed.mean, sharedWindows: observed.n, shiftBand: { lo, hi }, shifts: shifted.length };
  };

  function judge(a, b, { asOf = null } = {}) {
    if (asOf != null) {
      const cut = new Map();
      for (const [n, occs] of rawRecord) cut.set(n, occs.filter((o) => Array.isArray(o) || !Number.isFinite(o.at) || o.at <= asOf));
      const r = makeIdentityInduction(cut, opts).judge(a, b);
      return Object.freeze({ ...r, asOf });
    }
    const stamp = { standing: "nomination", read: { a: record.get(a)?.length ?? 0, b: record.get(b)?.length ?? 0, nodes: nodes.length } };
    for (const [x, name] of [[a, "a"], [b, "b"]]) {
      const n = record.get(x)?.length ?? 0;
      if (n < minOccurrences) return Object.freeze({ a, b, verdict: UNBOUND, reason: "not_enough_reading", detail: `${name} has ${n} occurrence(s), below the declared ${minOccurrences}`, ...stamp });
    }
    if (a === b) return Object.freeze({ a, b, verdict: BOUND, reason: "identical_id", ...stamp });
    const rng = createSeededRng({ seed, a, b });
    const drop = maskFor(a, b);
    // test 2 — widen until widening stops moving the consequence beyond the
    // null's spread; a settled hop is NOT widened past, and an unsettled
    // bound at maxHop is recorded and demotes a "bound" (kairos).
    let chosen = statsAt(a, b, 1, drop, rng); const path = [chosen]; let settled = maxHop === 1;
    for (let hop = 2; hop <= maxHop; hop += 1) {
      const next = statsAt(a, b, hop, drop, rng); path.push(next);
      const moved = Math.abs(next.consequence.observed - chosen.consequence.observed);
      if (moved <= next.consequence.spread) { settled = true; break; }
      chosen = next;
    }
    const hop = chosen.hop;
    const wa = weight(a, hop, drop, rng), wb = weight(b, hop, drop, rng);
    const tests = { worlds: chosen.worlds, weight: { a: wa, b: wb }, consequence: chosen.consequence, bound: { settled, hop } };
    let bag, reason = null;
    if (!wa.carries || !wb.carries) { bag = UNBOUND; reason = "idle"; }
    else if (!chosen.worlds.match) { bag = CONTRADICTED; reason = "worlds_differ"; }
    else if (!chosen.consequence.aligned) { bag = UNBOUND; reason = "no_positive_evidence"; }
    else if (!settled) { bag = UNBOUND; reason = "bound_unsettled"; }
    else bag = BOUND;
    let verdict = bag;
    if (trajectory && reason !== "idle") {
      tests.dynamics = dynamicsTest(a, b, hop, drop, rng);
      const d = tests.dynamics.verdict;
      if (d === BEYOND_REACH) { if (bag === BOUND) { verdict = BEYOND_REACH; reason = tests.dynamics.reason; } }
      else {
        verdict = verdictOfSupport(bag === BOUND && d === BOUND, bag === CONTRADICTED || d === CONTRADICTED);
        if (verdict !== bag) reason = d === CONTRADICTED ? "dynamics_differ" : tests.dynamics.reason ?? "dynamics_unconfirmed";
      }
    }
    return Object.freeze({ a, b, verdict, reason, hop, masked: drop.size, tests, ...stamp, path: path.map((p) => ({ hop: p.hop, worlds: p.worlds.observed, consequence: p.consequence.observed })) });
  }

  return Object.freeze({ judge, frame: Object.freeze({ draws, alpha, seed, minOccurrences, maxHop, smooth, resolution, minFeatureCount, trajectory, relevant: relevant ? "declared" : null, namesNode: namesNode ? "declared" : null, nodes: nodes.length }) });
}
