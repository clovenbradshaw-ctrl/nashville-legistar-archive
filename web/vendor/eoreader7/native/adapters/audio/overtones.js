// adapters/audio/overtones.js — the harmonic series, DISCOVERED from sound
// rather than taught, and turned into a metric on pitches.
//
// User direction, 2026-09-02: understanding music means overtones, not a
// theory of melody. A sounded note is a fundamental with partials at
// integer multiples of its frequency; two notes are "near" to the degree
// their partials coincide. That is physics, not convention — and so it can
// be READ off a real recording and tested against a null, the same way
// every other structure in this project is: the claim "energy sits at
// integer multiples of the strongest peak" is measured against the same
// frames with the multiples replaced by random frequencies in the same
// band. If the real multiples do not beat the random ones, the harmonic
// series was not heard, and nothing downstream may assume it.
//
// PURE. A plain radix-2 FFT (no library), magnitudes per frame, the peak,
// the energy at k·f0. No note names, no tuning, no scale anywhere in this
// file; the one giver a CALLER needs to relate a MIDI pitch number to a
// frequency (440·2^((n−69)/12)) is declared by the caller, never here.

const freeze = (v) => Object.freeze(v);

/** In-place iterative radix-2 FFT on re/im arrays of power-of-two length. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Magnitude spectrum of one frame (Hann-windowed). */
export function spectrum(samples, offset, n) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i += 1) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); re[i] = (samples[offset + i] ?? 0) * w; }
  fft(re, im);
  const mag = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i += 1) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/**
 * discoverHarmonics(samples, sampleRate, { frame, hop, partials, band, draws, seed, alpha, energyFloor })
 * → per frame: the strongest peak f0 and the summed magnitude at k·f0 (k=2..partials),
 *   against `draws` redeals of the same k frequencies drawn uniformly in `band`;
 *   the frame "hears harmonics" when the real sum beats the null's (1−alpha) quantile.
 * Every number is the caller's. Returns the share of frames that heard harmonics,
 * and the mean relative magnitude at each partial — the EMPIRICAL profile the
 * metric below is built from (never a textbook 1/k).
 */
export function discoverHarmonics(samples, sampleRate, { frame, hop, partials, band, draws, seed, alpha, energyFloor } = {}) {
  for (const [k, v] of Object.entries({ frame, hop, partials, draws, seed, alpha, energyFloor })) if (!Number.isFinite(v)) throw new TypeError(`discoverHarmonics: ${k} is declared`);
  if (!band || !Number.isFinite(band[0]) || !Number.isFinite(band[1])) throw new TypeError("discoverHarmonics: band [lo, hi] Hz is declared");
  const rnd = lcg(seed);
  const binHz = sampleRate / frame;
  const at = (mag, hz) => { const b = Math.round(hz / binHz); return b > 0 && b < mag.length ? mag[b] : 0; };
  let framesRead = 0, framesHeard = 0, framesSilent = 0;
  const profile = new Float64Array(partials + 1); // relative magnitude at partial k (1 = fundamental)
  let profiled = 0;
  const f0s = [];
  for (let o = 0; o + frame <= samples.length; o += hop) {
    let energy = 0; for (let i = 0; i < frame; i += 1) energy += Math.abs(samples[o + i]);
    if (energy / frame < energyFloor) { framesSilent += 1; continue; }
    const mag = spectrum(samples, o, frame);
    // the strongest peak inside the band is the frame's fundamental candidate
    let f0 = 0, best = -1;
    for (let b = Math.ceil(band[0] / binHz); b <= Math.floor(band[1] / binHz) && b < mag.length; b += 1) if (mag[b] > best) { best = mag[b]; f0 = b * binHz; }
    if (!f0) continue;
    framesRead += 1;
    const real = Array.from({ length: partials - 1 }, (_, i) => at(mag, (i + 2) * f0)).reduce((a, b) => a + b, 0);
    let beaten = 0;
    for (let d = 0; d < draws; d += 1) {
      let s = 0;
      for (let k = 2; k <= partials; k += 1) s += at(mag, band[0] * 2 + rnd() * (band[1] * partials - band[0] * 2));
      if (real > s) beaten += 1;
    }
    if (beaten / draws >= 1 - alpha) framesHeard += 1;
    if (best > 0) { for (let k = 1; k <= partials; k += 1) profile[k] += at(mag, k * f0) / best; profiled += 1; }
    f0s.push(f0);
  }
  for (let k = 1; k <= partials; k += 1) profile[k] = profiled ? profile[k] / profiled : 0;
  return freeze({
    framesRead, framesHeard, framesSilent, share: framesRead ? framesHeard / framesRead : 0,
    profile: freeze(Array.from(profile).slice(1)),
    declared: { frame, hop, partials, band, draws, seed, alpha, energyFloor, binHz },
    f0s: freeze(f0s),
  });
}

/**
 * overtoneOverlap(fa, fb, profile, { tolerance }) — how much of a's heard
 * partial energy lands on b's partials (within `tolerance`, a ratio), using
 * the EMPIRICAL profile above, symmetrised. 1 for the same frequency; 0 for
 * nothing shared. No convention: the partial weights are what the recording
 * had at k·f0, the coincidence test is arithmetic on frequencies.
 */
export function overtoneOverlap(fa, fb, profile, { tolerance } = {}) {
  if (!Number.isFinite(tolerance)) throw new TypeError("overtoneOverlap: tolerance (a frequency ratio) is declared");
  const K = profile.length;
  const one = (x, y) => {
    let shared = 0, total = 0;
    for (let i = 0; i < K; i += 1) {
      const fx = (i + 1) * x; total += profile[i];
      for (let j = 0; j < K; j += 1) { const fy = (j + 1) * y; if (Math.abs(fx - fy) / fx <= tolerance) { shared += profile[i]; break; } }
    }
    return total ? shared / total : 0;
  };
  return (one(fa, fb) + one(fb, fa)) / 2;
}
