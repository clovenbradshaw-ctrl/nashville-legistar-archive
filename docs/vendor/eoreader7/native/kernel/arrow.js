// kernel/arrow.js — the arrow of time, learned, never given. Medium-blind,
// Handle: Eddington — after Arthur Eddington, who named "time's arrow" (1927) and put it in the statistics of the world, not in its laws: a sequence has an arrow when it reads differently backwards. Amendment XVII.
// kernel-level.
//
// WHY THIS EXISTS. The transplant run (eval/lavar/transplant-arm.mjs,
// 2026-09-25) reversed a chapter's sentence order and the reader did not
// notice: every organ it runs is local to its neighbourhood, and nothing at
// the Pattern grain reads the unfolding. The early theory
// (Time as Emergent Dimension) says that grain IS time's trans-temporal
// kind — a regularity visible only across the sequence, approached as a
// limit — and Hume says the arrow is habit, not form. This organ is that
// habit, built as a measurement.
//
// TWO QUESTIONS, KEPT APART.
//   1. Is this sequence IRREVERSIBLE — does it read differently backwards?
//      Intrinsic to the material. Measured as the divergence between the
//      k-gram distribution and its own reversal. A stationary process's
//      entropy rate is the same in both directions (a theorem), so
//      prediction cost cannot see this; block statistics can: "a b c" vs
//      "c b a" is what a→b→c→a looks like and detailed balance does not.
//   2. Which way is FORWARD? Not intrinsic. Irreversibility has a
//      magnitude and no sign. Direction exists only against a REFERENCE
//      sequence the reader has already read the "forward" way — the
//      habit. Given one, this sequence is nearer the reference or nearer
//      the reference's reversal. Given none, direction is null, disclosed.
//      That is the Humean split exactly: the world supplies asymmetry,
//      experience supplies the sign.
//
// THE NULL IS BUILT IN (II.23) — AND IT IS NOT THE SHUFFLE. Measured while
// this file was being tested: a symmetric random walk (reversible by
// detailed balance) beat a shuffled null on irreversibility, 0.084 against
// 0.044–0.064, because the walk is ORDERED (8 of 16 bigrams ever occur)
// and a shuffle destroys order, not just direction — sampling noise on a
// structured sequence is larger than on an exchangeable one. The shuffle
// is Rubin's null (is there order at all?), not the arrow's. The arrow's
// null keeps the same undirected structure and removes only the sign:
// symmetrize the observed k-gram distribution, S(g) = (P(g) + P(rev g))/2,
// and draw the same number of grams from S at a declared seed. A verdict
// of "irreversible" means the observed divergence sat beyond EVERY such
// draw; the rank is always reported, and the number of draws is the
// caller's declared resolution, never a cut-off picked here. A photo, or
// any input with no order, is void, not zero.
//
// CELL. cellOf("CON", "Pattern"): Structure × Relate × Pattern — terrain
// Network, stance Tracing. A regularity of ORDER relations traced across
// the whole; not Paradigm (that is the reader's frame, one domain over).
import { cellOf } from "./cube.js";
import { lcg } from "./continuation.js";

export const SCHEMA = "EOArrow@1";
export const CELL = Object.freeze(cellOf("CON", "Pattern"));

const freeze = (v) => Object.freeze(v);

/** k-gram frequency distribution of an event sequence: Map "a b" -> probability. */
export function grams(events, k) {
  const ev = events.map(String);
  const m = new Map();
  const n = Math.max(0, ev.length - k + 1);
  for (let i = 0; i < n; i += 1) {
    const g = ev.slice(i, i + k).join("\u0001");
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  for (const [g, c] of m) m.set(g, c / n);
  return m;
}

/** The same distribution read backwards: every gram reversed. */
export function reversedGrams(dist) {
  const m = new Map();
  for (const [g, p] of dist) { const r = g.split("\u0001").reverse().join("\u0001"); m.set(r, (m.get(r) ?? 0) + p); }
  return m;
}

/** Jensen–Shannon divergence in bits, 0 (identical) to 1 (disjoint). Bounded and symmetric, so no zero problem on unseen grams. */
export function jsDivergence(p, q) {
  const keys = new Set([...p.keys(), ...q.keys()]);
  let d = 0;
  for (const g of keys) {
    const a = p.get(g) ?? 0, b = q.get(g) ?? 0, m = (a + b) / 2;
    if (a > 0) d += 0.5 * a * Math.log2(a / m);
    if (b > 0) d += 0.5 * b * Math.log2(b / m);
  }
  return d;
}

/** The arrow's null: the same undirected k-gram structure with the sign removed — `count` grams drawn from the symmetrized distribution S(g) = (P(g) + P(rev g)) / 2 at the caller's rng. */
export function symmetricDraw(dist, count, rng) {
  const sym = new Map();
  for (const [g, p] of dist) {
    const r = g.split("\u0001").reverse().join("\u0001");
    sym.set(g, (sym.get(g) ?? 0) + p / 2);
    sym.set(r, (sym.get(r) ?? 0) + p / 2);
  }
  const keys = [...sym.keys()], cum = [];
  let acc = 0;
  for (const g of keys) { acc += sym.get(g); cum.push(acc); }
  const out = new Map();
  for (let i = 0; i < count; i += 1) {
    const u = rng() * acc;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < u) lo = mid + 1; else hi = mid; }
    out.set(keys[lo], (out.get(keys[lo]) ?? 0) + 1);
  }
  for (const [g, c] of out) out.set(g, c / count);
  return out;
}

/** irreversibility(events, k): JS between the sequence's k-gram distribution and its own reversal. */
export function irreversibility(events, k) {
  const p = grams(events, k);
  return jsDivergence(p, reversedGrams(p));
}

/**
 * arrowOf(events, { k, draws, seed, reference })
 *   verdict     "irreversible" | "reversible" | "void"
 *   direction   "forward" | "backward" | null — only with a reference, only
 *               when the preference sat beyond every shuffled draw
 * Every number that produced the verdict is returned beside it.
 */
export function arrowOf(events, { k = 2, draws = 32, seed = 7, reference = null } = {}) {
  if (!Array.isArray(events)) return freeze({ schema: SCHEMA, cell: CELL, verdict: "void", reason: "no ordered sequence", n: 0 });
  if (!Number.isInteger(k) || k < 2) throw new TypeError("arrowOf: k is declared and at least 2 — a 1-gram has no order to reverse");
  if (events.length < k + 1) return freeze({ schema: SCHEMA, cell: CELL, verdict: "void", reason: `fewer than ${k + 1} events — nothing to read backwards`, n: events.length });

  const p = grams(events, k);
  const count = events.length - k + 1;
  const observed = jsDivergence(p, reversedGrams(p));
  const rng = lcg(seed);
  const nulls = [];
  for (let i = 0; i < draws; i += 1) { const d = symmetricDraw(p, count, rng); nulls.push(jsDivergence(d, reversedGrams(d))); }
  const beyond = nulls.filter((x) => x >= observed).length;
  const rank = beyond / draws;
  const verdict = rank === 0 ? "irreversible" : "reversible";

  let direction = null, preference = null;
  if (Array.isArray(reference) && reference.length >= k + 1) {
    const ref = grams(reference, k);
    const refRev = reversedGrams(ref);
    // negative: nearer the reference read forward; positive: nearer its reversal
    const pref = (d) => jsDivergence(d, ref) - jsDivergence(d, refRev);
    const obs = pref(p);
    const rng2 = lcg(seed + 1);
    const nullPref = [];
    for (let i = 0; i < draws; i += 1) nullPref.push(Math.abs(pref(symmetricDraw(p, count, rng2))));
    const beyondPref = nullPref.filter((x) => x >= Math.abs(obs)).length;
    preference = freeze({ observed: obs, rank: beyondPref / draws, min: Math.min(...nullPref), max: Math.max(...nullPref) });
    if (beyondPref === 0 && obs !== 0) direction = obs < 0 ? "forward" : "backward";
  }

  return freeze({
    schema: SCHEMA, cell: CELL, verdict, direction,
    irreversibility: observed, k, n: events.length,
    null: freeze({ draws, seed, rank, min: Math.min(...nulls), max: Math.max(...nulls) }),
    preference,
  });
}
