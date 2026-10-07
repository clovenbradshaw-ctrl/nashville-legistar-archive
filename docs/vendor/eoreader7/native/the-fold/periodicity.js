// periodicity.js — find a recurring arrangement WITHOUT being told what its
// lines look like. The half of P58 that was measured and not built.
//
// THE LIMIT THIS CLOSES, stated in P58 as the honest cost of shipping the
// binder: `network.js`'s shape recognizers were chosen after looking at the
// page. Handed the instrument's whole read corpus — 883 saved pages, 25.9MB —
// they bound **8 systems**. Two hand-picked shapes do not reach a corpus, and
// a reader whose reach depends on someone having seen the layout first is a
// parser with extra steps. The user's question was exactly this: *"are you
// pre-establishing how to parse the wiki or are you teaching it to fish?"*
//
// SO NOTHING HERE KNOWS A VOCABULARY. A line's description is its own
// characters, collapsed by class: "Sir Robert Peel" is `Aa Aa Aa`, and
// "20 June 1837 – 30 August 1841" is `9 Aa 9 . 9 Aa 9`. No months, no names,
// no dates, no language. The same descriptions arise in any script with the
// same Unicode categories.
//
// THE MEASUREMENT THIS RESTS ON, taken before the module was written. Within a
// real record block, mean signature similarity at lag 2 is 0.926 against 0.579
// at lag 1 — a spike at the true period and at its harmonic (lag 4 = 0.896).
// In a prose region of the SAME page: 0.627 / 0.620 / 0.691 / 0.620, flat.
// Across the whole page: flat. Periodicity of a vocabulary-free description
// therefore locates a record block and its period, with nothing declared.
//
// AND IT IS NULLED, because a periodicity score on its own is not evidence.
// The arrangement is a fact about ORDER, so the null destroys order and keeps
// everything else: the same lines, shuffled, scored the same way. A block
// whose structure is real dies under shuffling; a run of superficially similar
// lines does not. The cut is the null's own distribution, never a number
// chosen here — this repo's standing rule (P4, and the kinds arm's own
// posture) applied to a new measurement.

/**
 * A character's class. Four marks and a space, from Unicode's own categories
 * rather than an alphabet — nothing here is English-specific.
 */
const classOf = (ch) =>
  /\p{Nd}/u.test(ch) ? "9" :
  /\p{Lu}/u.test(ch) ? "A" :
  /\p{Ll}/u.test(ch) ? "a" :
  /\s/u.test(ch) ? " " : ".";

/**
 * signature(line) — the line's shape, with runs of one class collapsed to one
 * mark. Collapsing is what makes "Sir Robert Peel" and "Lord John Russell"
 * the same shape while keeping them distinct from a date line.
 */
export function signature(line) {
  let out = "";
  for (const ch of String(line ?? "").trim()) {
    const c = classOf(ch);
    if (out[out.length - 1] !== c) out += c;
  }
  return out;
}

/**
 * How alike two shapes are: which classes each uses, as a set.
 *
 * DERIVED, NOT DESIGNED, and deliberately coarse. Exact signature equality
 * fails on the real thing — "Sir Robert Peel" is `Aa Aa Aa` and "William Lamb
 * The Viscount Melbourne" is `Aa Aa Aa Aa Aa`, the same KIND of line at
 * different lengths — and an edit distance would import a cost model nobody
 * measured. The classes a line draws on separate a name from a date without
 * either.
 */
export function alike(a, b) {
  const A = new Set(String(a).replace(/ /g, ""));
  const B = new Set(String(b).replace(/ /g, ""));
  if (!A.size && !B.size) return 1;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return shared / (A.size + B.size - shared || 1);
}

/** Mean similarity between lines `lag` apart, over a slice. */
export function meanAtLag(sigs, lag) {
  let sum = 0, n = 0;
  for (let i = 0; i + lag < sigs.length; i++) { sum += alike(sigs[i], sigs[i + lag]); n++; }
  return n ? sum / n : NaN;
}

/**
 * A deterministic shuffle. Seeded so a run is reproducible — `Math.random`
 * would make the null unrepeatable, which this repo's own eval discipline
 * refuses.
 */
function shuffled(xs, seed) {
  const a = xs.slice();
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * periodOf(sigs, {maxPeriod, draws, seed}) — the period this run of lines is
 * arranged on, or null.
 *
 * The statistic is `meanAtLag(p) - meanAtLag(1)`: how much MORE alike lines
 * p apart are than adjacent lines. A run of identical lines scores zero on it
 * by construction, which is the same refusal `network.js` makes structurally
 * ("a cycle of one shape binds nothing") arriving here as arithmetic.
 *
 * The null shuffles the lines and recomputes. Order is the only thing
 * destroyed — the same lines, the same shapes, the same counts — so a period
 * that survives is a fact about ARRANGEMENT and not about the vocabulary of
 * the block. `rank` is the share of draws the observation beat; the caller
 * decides what to do with it, and nothing here converts it to a verdict.
 */
export function periodOf(sigs, { maxPeriod = 4, draws = 400, seed = 0 } = {}) {
  if (sigs.length < 4) return null;
  const base = meanAtLag(sigs, 1);
  let best = null;
  for (let p = 2; p <= maxPeriod; p++) {
    if (sigs.length < p * 2) break;
    const lift = meanAtLag(sigs, p) - base;
    if (!Number.isFinite(lift)) continue;
    if (!best || lift > best.lift) best = { period: p, lift, at: meanAtLag(sigs, p), adjacent: base };
  }
  if (!best || best.lift <= 0) return null;

  // THE NULL IS SCORED AT THE OBSERVED PERIOD, not at each draw's own best.
  // Taking each draw's best-over-all-periods was the first version and it
  // saturated uselessly: a real block ranked 0.990 and ordinary prose 0.955,
  // which is no separation at all. Held at one period the same measurement
  // separates cleanly — real blocks land 3 in 400 with z above 3.4, while the
  // most structured prose on the same page reaches z 1.86 and the least
  // reaches 0.13.
  const values = [];
  for (let d = 0; d < draws; d++) {
    const s = shuffled(sigs, seed + d + 1);
    values.push(meanAtLag(s, best.period) - meanAtLag(s, 1));
  }
  const mean = values.reduce((a, b) => a + b, 0) / draws;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / draws);
  const beatenBy = values.filter((v) => v >= best.lift).length;

  // FACTS, NOT A VERDICT. No threshold lives here — `beatenBy`, `draws` and
  // `z` are reported and the caller declares what it will admit, which is the
  // same division `nul` itself draws ("NOT enforced inside `ground` … an organ
  // that wants the guarantee asks for it") and the kinds arm already follows.
  return {
    ...best,
    draws,
    beatenBy,
    censored: beatenBy === 0,
    z: sd > 0 ? (best.lift - mean) / sd : null,
    nullMean: mean,
  };
}
