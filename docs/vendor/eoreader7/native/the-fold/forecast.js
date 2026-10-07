// forecast.js — predictive processing for the coding loop, numerically.
//
// Attention proposes, priors dispose (ATTENTION-PROPOSES-PRIORS-DISPOSE):
// before spending a test round, the loop predicts P(green) from what is
// already known — the op shape, the file's language, whether the bytes
// parsed — then the real exit code disposes, and the error updates the
// prior for the next round. Expectation → observation → prediction error
// → prior update, every round, with no model anywhere in it.
//
// This is NOT kernel/expectations.js (Bharata): that module is the
// qualitative face (open/strengthened/violated as fold ops). This is the
// quantitative face — Laplace-smoothed tallies per (op, language,
// syntax) key. Different mechanism, imported nothing, re-derived
// nothing; the round record speaks Bharata's words (fulfilled/violated)
// over these numbers, and both stay honest because both are recorded.
//
// SHAPE: { schema: "CodeForecast@1", keys: { key: { trials, greens } } }.
// Frozen on every update (tuples, never mutated ledgers). Session-scoped:
// a run starts empty (maximal uncertainty, disclosed) and learns within
// the run; cross-run persistence is named unattempted work, not a silent
// pool. A key never seen predicts 0.5 — "no history" said as a number,
// never as confidence.

export function emptyForecast() {
  return Object.freeze({ schema: "CodeForecast@1", keys: Object.freeze({}) });
}

/** forecastKey({ op, language, syntax }) -> "SYN|python|checked".
 *  `syntax` is the pre-check verdict word the loop records
 *  (checked | skipped-no-engine | unchecked-not-python). */
export function forecastKey({ op = "?", language = "?", syntax = "?" } = {}) {
  return `${op}|${language}|${syntax}`;
}

/** forecast(prior, key) -> { p, trials, greens, basis }.
 *  Laplace: (greens+1)/(trials+2). Zero trials → p=0.5 on the record,
 *  with the basis saying so out loud. */
export function forecast(prior, key) {
  const rec = prior?.keys?.[key];
  const trials = rec?.trials ?? 0;
  const greens = rec?.greens ?? 0;
  return {
    p: (greens + 1) / (trials + 2),
    trials,
    greens,
    basis: trials === 0
      ? `no history for "${key}" — maximal uncertainty (0.5), not confidence`
      : `${greens}/${trials} green for "${key}"`,
  };
}

/** observe(prior, key, won) -> newPrior (frozen).
 *  won is boolean exit-0. Returns a NEW forecast object; the input is
 *  never mutated (append-only memory, one tally at a time). */
export function observe(prior, key, won) {
  const keys = { ...(prior?.keys ?? {}) };
  const rec = keys[key] ?? { trials: 0, greens: 0 };
  keys[key] = Object.freeze({ trials: rec.trials + 1, greens: rec.greens + (won ? 1 : 0) });
  return Object.freeze({ schema: "CodeForecast@1", keys: Object.freeze(keys) });
}

/** forecastError(p, won) -> outcome − p, signed.
 *  +0.5 means "failed where confident"; −0.5 means "passed where
 *  doubtful". The loop records it on every tested round; |error| ≥ 0.5
 *  with trials ≥ 2 is surprise in this repo's own sense (a confident
 *  prior revised by witness), and the round says so. */
export function forecastError(p, won) {
  return (won ? 1 : 0) - p;
}
