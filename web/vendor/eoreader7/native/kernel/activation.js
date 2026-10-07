// native/kernel/activation.js — activation decays. Medium-general, kernel-level.
// Handle: Atta — after the leafcutter ant's pheromone trail: it evaporates unless reinforced by continued traffic. Amendment XVII.
//
// READING-POLICY P1 is the load-bearing rule of that whole document:
// "Activation decays. Identity does not. Recall is retrieval." This module is
// the first clause, and it belongs in the KERNEL rather than in any adapter
// because losing activation is not a property of natural language — it is a
// property of anything read in time. Language, music, video, a sensor trace:
// every temporally-extended medium presents earlier material as less present
// than later material, and a reader that weights the first page exactly like
// the last is not being rigorous, it is being wrong in a way that happens to
// be easy to implement.
//
// A monotone accumulator is that error. It is also the shape a reader falls
// into naturally, because "keep a running count" looks like memory and is
// actually the absence of one.
//
// THE WINDOW IS MEASURED FROM THE MATERIAL, NOT SET. `gammaFor(window) =
// 1 - 1/window` is the engine's own derivation (emergence/tiers.js, giver
// named) — but a window someone typed in is still a magic number wearing a
// derivation's clothes, and different material has a different reach. The
// window is found by the DIFFERENCE THAT MAKES A DIFFERENCE (Bateson;
// nul/index.js's own `pattern()` states it in the same words): walk candidate
// depths outward and take the SHALLOWEST at which forgetting everything older
// no longer changes what the reader concludes. Material past that depth has
// no activation, because by measurement it makes no difference — that is what
// "activation decays" means operationally, rather than a rate chosen for it.
//
// `dmdWindow` below performs that measurement. A hand-declared window remains
// possible and is then exactly what it is: a declaration, carrying a reason,
// never mistaken for a measurement (P4). `null` is the explicit undecayed
// control arm.
//
// DECAY IS LAZY, never a sweep: a cell records (value, time) and its current
// activation is `value * gamma^(now - time)`, computed on read. Folding in one
// observation is O(1) in the number of distinct things observed, so reading at
// the honest one-proposition grain costs no more per step than reading in
// batches — which removes the only argument batching ever had.
//
// IDENTITY IS NOT THIS MODULE'S BUSINESS. What has been established stays
// established; only how PRESENT it is right now fades. A caller that decays
// its cast has misread the rule.

/** The engine's own derivation (emergence/tiers.js): a declared window's fading. */
export function gammaFor(window) {
  if (!Number.isFinite(window) || window <= 1)
    throw new TypeError("gammaFor: window is declared and must exceed 1 — how wide the present is is the reader's to say, never a default");
  return 1 - 1 / window;
}

/**
 * Measure how far back the material actually reaches — the difference that
 * makes a difference, applied to the reader's own memory depth.
 *
 * For each candidate depth, derive the reader's conclusion from the last
 * `depth` observations alone and compare it to the conclusion drawn from
 * everything. The SHALLOWEST depth that agrees is the window: beyond it,
 * remembering more changed nothing, so by measurement there is nothing there
 * to remember.
 *
 * Returns `{ window, gamma, basis, tried }`, or a typed gap
 * `{ window: null, gap: "reach_exceeds_candidates" }` when no candidate
 * agrees — the honest answer that this material's reach is longer than
 * anything tried, never a silent fall back to the widest.
 *
 * `derive` is the caller's own conclusion-drawing (what the closed class is,
 * what the cast is, whatever this reader actually decides on), because "makes
 * a difference" is only meaningful with respect to a difference TO SOMETHING.
 *
 * `restrict(observations, depth)` says WHAT "depth" NARROWS. It defaults to
 * the last `depth` observations — recency, the axis this organ was built on.
 * But the rule ("the shallowest bound at which dropping everything beyond it
 * changed no conclusion") is not about time; it is about any nested family
 * ordered by inclusion, and pinning it to a tail slice was an accident of the
 * first caller. Injecting `restrict` lets the same measurement bound HOPS in
 * a graph: depth becomes a radius, and the question becomes how far from a
 * referent you must look before the conclusion stops moving. Nothing else
 * changes, and the default is byte-identical to the previous behaviour, so
 * every existing caller measures exactly what it measured before.
 */
export function dmdWindow(observations = [], derive, { candidates, equal = (a, b) => JSON.stringify(a) === JSON.stringify(b), restrict = (obs, depth) => obs.slice(Math.max(0, obs.length - depth)) } = {}) {
  if (typeof derive !== "function") throw new TypeError("dmdWindow: derive is the conclusion a difference must make a difference TO — it is required");
  if (!Array.isArray(candidates) || !candidates.length) throw new TypeError("dmdWindow: candidate depths are declared by the caller — which depths are worth testing is not this function's to guess");
  if (typeof restrict !== "function") throw new TypeError("dmdWindow: restrict says what `depth` narrows — a function, or omit it for recency");
  const whole = derive(observations);
  const tried = [];
  for (const depth of [...candidates].sort((a, b) => a - b)) {
    const recent = restrict(observations, depth);
    const agrees = equal(derive(recent), whole);
    tried.push({ depth, agrees });
    if (agrees) return Object.freeze({ window: depth, gamma: depth > 1 ? gammaFor(depth) : 1, basis: "difference-that-makes-a-difference: the shallowest depth at which dropping everything beyond it changed no conclusion", tried: Object.freeze(tried) });
  }
  return Object.freeze({ window: null, gamma: null, gap: "reach_exceeds_candidates", basis: "no candidate depth reproduced the whole reading's conclusion — this material reaches further back than anything tried", tried: Object.freeze(tried) });
}

/**
 * A decaying activation table over arbitrary keys.
 *
 * `window` is a MEASURED depth (dmdWindow above) or an explicit declaration
 * carrying its own reason. `window: null` is the explicit, disclosed choice
 * of NO decay (gamma = 1) — a legitimate control arm, never a silent default.
 */
export function createActivation({ window = undefined } = {}) {
  if (window === undefined)
    throw new TypeError("createActivation: window is declared — pass a number, or null to choose an explicitly undecayed reader");
  const gamma = window === null ? 1 : gammaFor(window);
  const cells = new Map();
  let total = 0;
  let now = 0;

  /** Fold one observation (any iterable of keys) in at the current instant.
   *
   * THE CLOCK TICKS ONCE PER OBSERVATION — the observation IS the instant,
   * and its size never multiplies decay. P5.4 names the failure class this
   * guards ("per-sentence and per-frame folding differ by ~6x in decay
   * pressure. A run that does not state its unit is not reproducible"), and
   * it was REPRODUCED here before being fixed: dmdWindow measures depth in
   * observations, the first cut advanced `now` by key-count, and a window
   * measured as 8 propositions decayed as if it were ~1.5 — at the
   * checkpoints the whole cast read as faded while genuinely present.
   * One observe = one tick, the same unit dmdWindow's candidate depths
   * count in. (material.js's causalSurprisalSeries keeps its own per-WORD
   * clock deliberately — its unit is the word and it says so.) */
  const observe = (keys) => {
    const counts = new Map();
    let size = 0;
    for (const key of keys) { counts.set(key, (counts.get(key) ?? 0) + 1); size += 1; }
    for (const [key, n] of counts) {
      const cell = cells.get(key);
      const decayed = cell ? cell.v * gamma ** (now - cell.t) : 0;
      cells.set(key, { v: decayed + n, t: now + 1 });
    }
    total = total * gamma + size;
    now += 1;
    return size;
  };

  /** Current activation of one key. */
  const activationOf = (key) => {
    const cell = cells.get(key);
    return cell ? cell.v * gamma ** (now - cell.t) : 0;
  };

  /**
   * A materialized snapshot in the plain {freq, total} shape frequency
   * consumers expect. A fold over accumulated state — never a re-read of the
   * material the state came from.
   */
  const snapshot = () => {
    const freq = new Map();
    for (const [key, cell] of cells) freq.set(key, cell.v * gamma ** (now - cell.t));
    return { freq, total };
  };

  return Object.freeze({ observe, activationOf, snapshot, gamma, window, get size() { return cells.size; }, get now() { return now; } });
}
