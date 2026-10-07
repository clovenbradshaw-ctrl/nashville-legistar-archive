// the legacy engine · perceiver/audio/reduce — the pure half, importable anywhere.
//
// Split out of material.js (2026-08-17) for one reason only: material.js's
// `load` decodes with the system ffmpeg, so the module imports
// node:child_process at top level — which makes the WHOLE module unloadable
// in a browser, including the two functions here that touch no IO at all.
// The Fold's measuring door needed `reduce` in a page; the split is
// addressing/packaging (which bytes live in which file), not a new statistic
// or channel, so it does not trigger the growth rule — the same standing
// material.js already claims for `locate` under SEED.md Amendment XVI.
//
// material.js re-exports everything here, so every existing caller sees the
// exact surface it always had. All commentary on WHAT the channels measure —
// rms's permutation-blindness, flux's order-sensitivity, both channels'
// polarity invariance, and the invariance audit that earned them — stays in
// material.js with `load`, where it has always lived. This file is the
// arithmetic.

export const CHANNELS = Object.freeze(["rms", "flux"]);

export const reduce = (samples, { fraction = 1, frameSamples = 400, channel = "rms" } = {}) => {
  if (!CHANNELS.includes(channel)) throw new TypeError(`audio reduce: unknown channel "${channel}" (want one of ${CHANNELS.join(", ")})`);
  const readLen = Math.max(frameSamples, Math.floor(samples.length * fraction));
  const material = [];
  for (let i = 0; i + frameSamples <= readLen; i += frameSamples) {
    if (channel === "rms") {
      let sumSq = 0;
      for (let j = i; j < i + frameSamples; j++) sumSq += samples[j] * samples[j];
      material.push(Math.sqrt(sumSq / frameSamples));
    } else {
      // flux: mean |sample[j] - sample[j-1]| over the frame's adjacent pairs.
      // Order-sensitive (adjacency is exactly what a permutation destroys)
      // and polarity-invariant (the difference of two negated values has the
      // same absolute magnitude as the original).
      let sumAbsDelta = 0;
      for (let j = i + 1; j < i + frameSamples; j++) sumAbsDelta += Math.abs(samples[j] - samples[j - 1]);
      material.push(sumAbsDelta / (frameSamples - 1));
    }
  }
  return material;
};

// The inverse of reduce()'s framing: a surf()/atmosphere() material index
// back to the raw sample range (and, given sampleRate, the real time range)
// it was built from. Symmetric with reduce() by construction -- same
// frameSamples stride, nothing re-derived -- so a standpoint found in a ride
// over this material can be located without re-deciding what a frame is.
// SEED.md Amendment XVI: addressing infrastructure, not a new statistic or
// perturbation, so it does not trigger the growth rule.
export const locate = (index, { frameSamples = 400, sampleRate = 8000 } = {}) => {
  if (!Number.isInteger(index) || index < 0) return { error: "index must be a non-negative integer" };
  if (!Number.isInteger(frameSamples) || frameSamples < 1) return { error: "frameSamples must be a positive integer" };
  const sampleStart = index * frameSamples;
  const sampleEnd = sampleStart + frameSamples;
  return { sampleStart, sampleEnd, timeStart: sampleStart / sampleRate, timeEnd: sampleEnd / sampleRate };
};
