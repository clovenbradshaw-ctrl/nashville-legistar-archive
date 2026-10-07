// apollo.js — the homeostasis archon.
// Handle: Apollo — sophrosyne: measure, bound, moderation. Amendment XVII.
//
// Heimdall guards the outward flows (which path to serve). Apollo watches the
// whole box for SURPRISE: runaway generation, wild API calls, behaviour out of
// the ordinary — and when found, dispatches an eoSwarm to investigate and
// hands its report to Thea (thea.js) for remedy. Sense → baseline → surprise
// → investigate → remedy: the self-healing loop.
//
// PURE: no I/O, no clock reads except caller-supplied `at`. Baselines are
// caller-held state (EWMA mean/variance per channel), so the organ never
// invents a threshold: the caller declares k, window, and hysteresis.

export const APOLLO_CHANNELS = Object.freeze([
  "turnMs",       // per-turn latency
  "cpuIdle",      // vitals cpu idle %
  "apiCalls",     // outbound calls per window
  "genTokens",    // generated tokens per turn
  "refusals",     // 429/refusal rate per window
]);

export const APOLLO_REFUSALS = Object.freeze({
  no_sample: "no sample was offered — Apollo never invents vitals",
  unknown_channel: "channel is not one of APOLLO_CHANNELS; declare it before watching it",
  thin_baseline: "fewer than minSamples observations: surprise needs a baseline, not a first impression",
});

const DEFAULTS = Object.freeze({
  k: 3,              // sigma multiples for surprise
  minSamples: 10,    // baseline floor before verdicts
  hysteresis: 2,     // consecutive surprises before ALARM (never flaps)
  alpha: 0.15,       // EWMA rate
});

/** Empty baseline store: channel -> { n, mean, m2, alarms, streak }. */
export function createBaseline() { return {}; }

function updateStat(s, x, alpha) {
  if (!s || s.n === 0) return { n: 1, mean: x, m2: 0, streak: 0, alarms: 0 };
  const mean = s.mean + alpha * (x - s.mean);
  const m2 = (1 - alpha) * s.m2 + alpha * (x - s.mean) * (x - s.mean);
  return { n: s.n + 1, mean, m2, streak: s.streak ?? 0, alarms: s.alarms ?? 0 };
}

/**
 * observe(baseline, channel, value, opts) — fold one sample in, report.
 * Returns { baseline, finding } where finding is null | { kind, ... }.
 * kinds: ok | watch | surprise | alarm | runaway.
 */
export function observe(baseline, channel, value, opts = {}) {
  if (!APOLLO_CHANNELS.includes(channel)) return { baseline, refused: "unknown_channel" };
  if (!Number.isFinite(value)) return { baseline, refused: "no_sample" };
  const { k = DEFAULTS.k, minSamples = DEFAULTS.minSamples, hysteresis = DEFAULTS.hysteresis, alpha = DEFAULTS.alpha } = opts;
  const prev = baseline[channel] ?? { n: 0, mean: 0, m2: 0, streak: 0, alarms: 0 };
  if (prev.n < minSamples) { baseline[channel] = updateStat(prev, value, alpha); return { baseline, finding: { kind: "learning", channel, n: prev.n + 1, minSamples } }; }
  const prevSd = Math.sqrt(prev.m2) || Math.abs(prev.mean) / 10 || 1;
  const z = (value - prev.mean) / prevSd;
  const surprising = Math.abs(z) >= k;
  // runaway: explosive growth — value > 4x mean while already surprising
  const runaway = surprising && value > 4 * Math.abs(prev.mean || 1) && value > prev.mean;
  const next = updateStat(prev, value, alpha);
  baseline[channel] = next;
  const sd = Math.sqrt(next.m2) || prevSd;
  if (runaway) {
    next.streak = (prev.streak ?? 0) + 1; next.alarms += 1;
    return { baseline, finding: { kind: "runaway", channel, value, mean: prev.mean, sd, z, streak: next.streak, giver: "apollo", standing: "witnessed" } };
  }
  if (!surprising) { next.streak = 0; return { baseline, finding: { kind: "ok", channel, value, mean: next.mean, sd, z } }; }
  next.streak = (prev.streak ?? 0) + 1;
  if (next.streak >= hysteresis) {
    next.alarms += 1;
    return { baseline, finding: { kind: "alarm", channel, value, mean: prev.mean, sd, z, streak: next.streak, giver: "apollo", standing: "witnessed" } };
  }
  return { baseline, finding: { kind: "watch", channel, value, mean: prev.mean, sd, z, streak: next.streak } };
}

/** surpriseOf(finding) — canonical-cycle gate: only alarm/runaway dispatch. */
export function surpriseOf(finding) {
  if (!finding) return null;
  if (finding.kind === "alarm" || finding.kind === "runaway") return finding;
  return null;
}

/** snapshot(baseline) — dynamic awareness: every channel's standing, one object. */
export function snapshot(baseline) {
  const out = {};
  for (const c of APOLLO_CHANNELS) {
    const s = baseline[c];
    if (!s) { out[c] = { standing: "unwatched" }; continue; }
    out[c] = { n: s.n, mean: s.mean, sd: Math.sqrt(s.m2), streak: s.streak ?? 0, alarms: s.alarms ?? 0 };
  }
  return out;
}
