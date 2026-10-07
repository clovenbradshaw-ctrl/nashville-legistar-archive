// native/kernel/shadow-echo.js — the child's sense: what a thing LOOKS LIKE,
// without keeping the bytes. Pure math, no I/O, no engine, no model.
//
// WHY THIS FILE EXISTS. The CV parent (organs/look.js — OpenCV + a vision
// model) teaches; this kernel is what the child keeps. A CV read is expensive
// and external; the child cannot run it. But the child CAN hold two cheap,
// byte-derived traces of anything it was shown — the SHADOW and the ECHO —
// and match a new thing's traces against the DMD framework of what a concept
// is, next time, without the parent in the loop.
//
//   SHADOW — the spatial footprint: the thing's own shape projected flat.
//     Downsampled luminance grid + row/column profiles + gradient profiles.
//     The shadow of a dog is "body, head, legs" in silhouette terms.
//   ECHO — the spectral ring: what frequencies the thing's bytes resonate
//     at. 1D log-bin spectra of the row/column profiles + radial rings of the
//     2D spectrum. The echo of a dog is "soft, mid-low spatial frequencies,
//     nothing sharp"; the echo of a picket fence is "a sharp high line".
//
// A concept's DMD framework is what things OF THAT CONCEPT have in common:
// the examples are a trajectory (teaching order), decomposed by the same
// Dynamic Mode Decomposition kernel/dmd.js already carries. The modes with
// the largest magnitudes are the dogness that persists across dogs; the
// decaying modes are the quirks of particular dogs. Recognition projects a
// new descriptor onto that coherent subspace and measures the residual — how
// much of the new thing is NOT doglike. The acceptance floor is fully
// derived from the concept's own examples (leave-one-out worst self-match),
// never a typed threshold: a thing is recognized when it matches its kind at
// least as well as the kind matches itself.
//
// OMNIMODAL. The kernel knows nothing about images. `descriptorOf(grid)` is
// the image face; `descriptorFromSeries(series)` is the audio/video face
// (RMS envelope shadow + spectral echo of the series); text has its own
// established face (contextual-dmd over motif windows, wired by the organ).
// One framework, one store, every sense — the child is not a vision model,
// it is a memory of what every sense has been shown.
//
// DESCRIPTOR CONTRACT (declared, never silently defaulted): every descriptor
// is a fixed-shape Float64Array, L2-normalized (brightness/volume invariant
// by construction — the shadow does not depend on exposure), shadow and echo
// concatenated. The shape is the contract: a mismatch between two
// descriptors is a hard error, not a silent zero.

import { dmd, economySVD, matmul } from "./dmd.js";

const EPS = 1e-12;

// ── descriptor shape ───────────────────────────────────────────────────────
// Declared contract: the bins are fixed so any two descriptors are
// comparable. Each bin is an AVERAGE over its region of the resampled
// material — derived from the bytes, never a tuned feature.
//
// THE SIZE RULE: a memory larger than its source is not a memory, it is a
// duplicate. The whole descriptor is 144 bins, QUANTIZED to one byte per bin
// (every bin lies in [0,1] after L2 normalization, so a byte is a faithful
// 1/255 quantization) — 144 bytes for anything taught, against a source that
// is at minimum thousands of bytes. The ECHO is the compression: what a
// thing rings like survives at a handful of spectral bins; the SHADOW keeps
// only the footprint. The organ refuses a lesson whose source is smaller
// than the memory of it.
export const SHADOW_SHAPE = Object.freeze({ grid: 8, row: 8, col: 8, grad: 4 });
export const ECHO_SHAPE = Object.freeze({ logBins: 24, rings: 8 });
export const SHADOW_LEN =
  SHADOW_SHAPE.grid * SHADOW_SHAPE.grid + SHADOW_SHAPE.row + SHADOW_SHAPE.col + SHADOW_SHAPE.grad * 2;
export const ECHO_LEN = ECHO_SHAPE.logBins * 2 + ECHO_SHAPE.rings;
export const DESCRIPTOR_LEN = SHADOW_LEN + ECHO_LEN;
export const DESCRIPTOR_BYTES = DESCRIPTOR_LEN; // one byte per bin, quantized

// ── the COLOR half: the hue LAYOUT of the thing, spatially ────────────────
// The shadow is luminance; the color half is where the hue lives IN the
// shape — one hue byte per shadow bin (the 8×8 grid), a coarse chroma map
// (4×4 — where the color actually is), and an 8-bin global hue histogram.
// "Different colors on different sides" is then a spatial fact in the
// descriptor, and a red circle overlapping a blue square separates by
// chroma before the shadow is ever asked. Opt-in: a lesson taught without
// a color grid stays the 144-byte grayscale contract; a color lesson is
// 144 + 88 = 232 bytes — still a compression against any real source, and
// the size rule still holds (a memory larger than its source is not a
// memory). The color half is normalized separately, like shadow and echo.
export const COLOR_SHAPE = Object.freeze({ hue: 64, chroma: 16, hist: 8 });
export const COLOR_LEN = COLOR_SHAPE.hue + COLOR_SHAPE.chroma + COLOR_SHAPE.hist;
export const COLORED_LEN = DESCRIPTOR_LEN + COLOR_LEN;

// hue of an rgb triple, hexcone (standard HSV hue), in [0, 1)
export function hueOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d <= 1e-9) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h + 6) % 6) / 6;
}

// colorOf: the color half of one region. `rgb` is a Uint8Array rgb24 grid
// (3 bytes per cell, row-major). Each of the 8×8 shadow bins yields its
// mean hue (weighted by chroma — a gray bin contributes nothing), the 4×4
// chroma map is the mean saturation per coarse cell, and the global
// histogram counts hue energy across the region.
export function colorOf(rgb, w, h, crop = null) {
  const { grid: g, w: gw, h: gh } = cropGrid2(rgb, w, h, crop);
  const out = [];
  const { hue: hueBins, chroma: chromaBins, hist: histBins } = COLOR_SHAPE;
  const cell = (r, c) => {
    const i = (r * gw + c) * 3;
    return [g[i], g[i + 1], g[i + 2]];
  };
  // per shadow-bin hue, chroma-weighted (the same 8×8 grid the shadow uses)
  const hw = 8;
  const chromaGrid = new Float64Array(hw * hw);
  const hist = new Float64Array(histBins);
  for (let r = 0; r < gh; r += 1) {
    for (let c = 0; c < gw; c += 1) {
      const [R, G, B] = cell(r, c);
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      const ch = (max - min) / 255;
      if (ch <= 1e-3) continue;
      const bin = Math.min(hw - 1, Math.floor((r * hw) / gh));
      const cbin = Math.min(hw - 1, Math.floor((c * hw) / gw));
      chromaGrid[bin * hw + cbin] += ch;
      hist[Math.min(histBins - 1, Math.floor(hueOf(R, G, B) * histBins))] += ch;
    }
  }
  const hueGrid = new Float64Array(hw * hw);
  const hueAcc = new Float64Array(hw * hw);
  for (let r = 0; r < gh; r += 1) {
    for (let c = 0; c < gw; c += 1) {
      const [R, G, B] = cell(r, c);
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      const ch = (max - min) / 255;
      if (ch <= 1e-3) continue;
      const bin = Math.min(hw - 1, Math.floor((r * hw) / gh)) * hw + Math.min(hw - 1, Math.floor((c * hw) / gw));
      const h = hueOf(R, G, B);
      // circular mean of hue within a bin, weighted by chroma
      hueAcc[bin] += ch * Math.cos(h * 2 * Math.PI);
      hueGrid[bin] += ch * Math.sin(h * 2 * Math.PI);
    }
  }
  for (let b = 0; b < hw * hw; b += 1) {
    hueGrid[b] = Math.atan2(hueGrid[b], hueAcc[b] + 1e-9) / (2 * Math.PI);
    hueGrid[b] = (hueGrid[b] + 1) % 1;
  }
  for (let i = 0; i < hueGrid.length; i += 1) out.push(hueGrid[i]);
  const cm = resample2D(chromaGrid, hw, hw, 4, 4);
  for (let i = 0; i < cm.length; i += 1) out.push(cm[i]);
  let hsum = 0;
  for (let i = 0; i < hist.length; i += 1) hsum += hist[i];
  for (let i = 0; i < hist.length; i += 1) out.push(hsum > 0 ? hist[i] / hsum : 0);
  return Float64Array.from(out);
}

// crop helper for the color grid (3 bytes per cell)
function cropGrid2(grid, w, h, crop) {
  if (!crop) return { grid, w, h };
  const [x, y, cw, ch] = crop;
  if (!(x >= 0 && y >= 0 && cw > 0 && ch > 0 && x + cw <= w && y + ch <= h))
    throw new TypeError(`cropGrid: crop [${crop}] does not lie inside the ${w}x${h} grid`);
  const out = new Uint8Array(cw * ch * 3);
  for (let r = 0; r < ch; r += 1) {
    for (let c = 0; c < cw; c += 1) {
      const si = ((y + r) * w + (x + c)) * 3;
      const di = (r * cw + c) * 3;
      out[di] = grid[si];
      out[di + 1] = grid[si + 1];
      out[di + 2] = grid[si + 2];
    }
  }
  return { grid: out, w: cw, h: ch };
}

// ── quantization: the memory is the lossy echo, stored at 1 byte per bin ──
// Both the taught examples and the recognition query pass through the SAME
// quantization, so every residual and distance is computed in the child's
// own numeric world — exact and consistent, never a mix of precisions.
// Shape-agnostic: each modality's face declares its own length (image 144,
// series 50, text 48), and a concept validates queries against ITS OWN shape
// at recognition time — the one contract no face may silently break.
export function quantizeDescriptor(d) {
  if (!d?.length) throw new TypeError("quantizeDescriptor: a descriptor array is required");
  return Uint8Array.from(d, (v) => Math.max(0, Math.min(255, Math.round(v * 255))));
}

export function dequantizeDescriptor(q) {
  if (!q?.length) throw new TypeError("dequantizeDescriptor: a quantized descriptor is required");
  return Float64Array.from(q, (b) => b / 255);
}

export function encodeDescriptor(d) {
  return Buffer.from(quantizeDescriptor(d)).toString("base64");
}

export function decodeDescriptor(b64) {
  const q = Buffer.from(b64, "base64");
  if (!q.length) throw new TypeError("decodeDescriptor: empty stored descriptor");
  return dequantizeDescriptor(q);
}

const FFT_LEN = 64; // power of two for the radix-2 FFT — resample target, derived by the FFT's own requirement

// ── tiny radix-2 FFT (magnitude only), hand-rolled like the rest of this
//    kernel's math — the codebase does not import a numeric library for a
//    transform it can hold and test in isolation (dmd.js's own precedent). ──
export function fftMagnitude(signal) {
  const n = signal.length;
  if (n === 0 || (n & (n - 1)) !== 0) throw new TypeError(`fftMagnitude: length must be a power of two (got ${n})`);
  let re = Float64Array.from(signal);
  let im = new Float64Array(n);
  // decimation-in-FREQUENCY: butterfly combines the DIFFERENCE of a pair,
  // twiddled, into the odd half (v[j] = (x[j]-x[j+half])·W^j) and the SUM
  // into the even half (u[j] = x[j]+x[j+half]); output is bit-reversed and
  // is un-reversed below.
  for (let len = n; len > 1; len >>= 1) {
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k += 1) {
        const angle = (-2 * Math.PI * k) / len;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const a = start + k;
        const b = a + half;
        const obr = re[b];
        const obi = im[b];
        const dr = re[a] - obr;
        const di = im[a] - obi;
        re[b] = dr * c - di * s;
        im[b] = dr * s + di * c;
        re[a] += obr;
        im[a] += obi;
      }
    }
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    // bit-reversal of the DIF output order
    let j = 0;
    for (let b = i, bits = n >> 1; bits > 0; bits >>= 1, b >>= 1) j = (j << 1) | (b & 1);
    out[j] = Math.hypot(re[i], im[i]);
  }
  return out;
}

// ── resample: box-average an arbitrary-length series down to n bins. Each
//    bin is the mean of its own stretch of the material — nothing is chosen
//    beyond the bin count, which is the declared contract. ────────────────
export function resample(series, n) {
  const m = series.length;
  if (m === 0) return new Float64Array(n);
  if (m === n) return Float64Array.from(series);
  const out = new Float64Array(n);
  for (let b = 0; b < n; b += 1) {
    const start = Math.floor((b * m) / n);
    const end = Math.max(start + 1, Math.floor(((b + 1) * m) / n));
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += series[i];
    out[b] = sum / (end - start);
  }
  return out;
}

// ── resample2D: a TRUE 2D box-average (w×h → ow×oh), row-major. The flat
//    resample is only correct when the target divides the source; a crop of
//    arbitrary size (a 36×22 dog box, say) mangled into a 32×32 spectrum
//    would destroy the 2D structure (measured, mnemonic.test.mjs: scaled
//    shapes fell outside their own family). Every output cell is the mean
//    of its own block of the material — nothing is chosen but the bins. ──
export function resample2D(grid, w, h, ow, oh) {
  const out = new Float64Array(ow * oh);
  for (let r = 0; r < oh; r += 1) {
    const r0 = Math.floor((r * h) / oh);
    const r1 = Math.max(r0 + 1, Math.floor(((r + 1) * h) / oh));
    for (let c = 0; c < ow; c += 1) {
      const c0 = Math.floor((c * w) / ow);
      const c1 = Math.max(c0 + 1, Math.floor(((c + 1) * w) / ow));
      let sum = 0;
      for (let y = r0; y < r1; y += 1) {
        for (let x = c0; x < c1; x += 1) sum += grid[y * w + x];
      }
      out[r * ow + c] = sum / ((r1 - r0) * (c1 - c0));
    }
  }
  return out;
}

const cropGrid = (grid, w, h, crop) => {
  if (!crop) return { grid, w, h };
  const [x, y, cw, ch] = crop;
  if (!(x >= 0 && y >= 0 && cw > 0 && ch > 0 && x + cw <= w && y + ch <= h))
    throw new TypeError(`cropGrid: crop [${crop}] does not lie inside the ${w}x${h} grid`);
  const out = [];
  for (let r = 0; r < ch; r += 1) for (let c = 0; c < cw; c += 1) out.push(grid[(y + r) * w + (x + c)]);
  return { grid: out, w: cw, h: ch };
};
export { cropGrid };

const normalize = (arr) => {
  let norm = 0;
  for (let i = 0; i < arr.length; i += 1) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm);
  if (norm <= EPS) return new Float64Array(arr.length);
  return Float64Array.from(arr, (v) => v / norm);
};

const logBinsOf = (spectrum, bins) => {
  const m = spectrum.length;
  const out = new Float64Array(bins);
  for (let b = 0; b < bins; b += 1) {
    const lo = Math.floor(Math.pow(m - 1, b / bins));
    const hi = Math.max(lo + 1, Math.floor(Math.pow(m - 1, (b + 1) / bins)));
    let sum = 0;
    for (let i = lo; i <= hi && i < m; i += 1) sum += spectrum[i];
    out[b] = hi < m ? sum / (hi - lo + 1) : sum / Math.max(1, m - lo);
  }
  return out;
};

// ── the shadow: spatial footprint of a luminance grid ─────────────────────
// Downsampled grid + row/col profiles + gradient profiles, each bin an
// average. Crop (in grid coordinates [x,y,w,h]) ties the shadow to a
// SPECIFIC PART of the image — the child remembers where the dog was.
export function shadowOf(grid, w, h, crop = null) {
  const { grid: g, w: gw, h: gh } = cropGrid(grid, w, h, crop);
  const { grid: gs, row: rp, col: cp, grad: gp } = SHADOW_SHAPE;
  const out = [];

  const cell = (r, c) => g[r * gw + c];
  const coarse = resample2D(g, gw, gh, gs, gs); // true 2D box-average to gs×gs
  for (let i = 0; i < coarse.length; i += 1) out.push(coarse[i]);

  const rowProf = new Float64Array(gh);
  const colProf = new Float64Array(gw);
  for (let r = 0; r < gh; r += 1) {
    let s = 0;
    for (let c = 0; c < gw; c += 1) s += cell(r, c);
    rowProf[r] = s / gw;
  }
  for (let c = 0; c < gw; c += 1) {
    let s = 0;
    for (let r = 0; r < gh; r += 1) s += cell(r, c);
    colProf[c] = s / gh;
  }
  const rr = resample(rowProf, rp);
  for (let i = 0; i < rr.length; i += 1) out.push(rr[i]);
  const cc = resample(colProf, cp);
  for (let i = 0; i < cc.length; i += 1) out.push(cc[i]);

  const gradRow = new Float64Array(gh);
  const gradCol = new Float64Array(gw);
  for (let r = 0; r < gh; r += 1) {
    let s = 0;
    for (let c = 1; c < gw; c += 1) s += Math.abs(cell(r, c) - cell(r, c - 1));
    gradRow[r] = s / Math.max(1, gw - 1);
  }
  for (let c = 0; c < gw; c += 1) {
    let s = 0;
    for (let r = 1; r < gh; r += 1) s += Math.abs(cell(r, c) - cell(r - 1, c));
    gradCol[c] = s / Math.max(1, gh - 1);
  }
  const gr = resample(gradRow, gp);
  for (let i = 0; i < gr.length; i += 1) out.push(gr[i]);
  const gc = resample(gradCol, gp);
  for (let i = 0; i < gc.length; i += 1) out.push(gc[i]);

  return Float64Array.from(out);
}

// ── the echo: what frequencies the bytes ring at ──────────────────────────
// 1D log-bin spectra of the row/col profiles (the spatial "timbre" of the
// shape) + radial ring sums of the 2D spectrum on a 32×32 downsample (the
// energy-by-scale curve). Magnitude only — phase is pose, and the child
// remembers what a thing is, not how it was posed.
export function echoOf(grid, w, h, crop = null) {
  const { grid: g, w: gw, h: gh } = cropGrid(grid, w, h, crop);
  const { logBins: lb, rings } = ECHO_SHAPE;
  const out = [];

  const rowProf = new Float64Array(gh);
  const colProf = new Float64Array(gw);
  for (let r = 0; r < gh; r += 1) {
    let s = 0;
    for (let c = 0; c < gw; c += 1) s += g[r * gw + c];
    rowProf[r] = s / gw;
  }
  for (let c = 0; c < gw; c += 1) {
    let s = 0;
    for (let r = 0; r < gh; r += 1) s += g[r * gw + c];
    colProf[c] = s / gh;
  }

  const rowMag = fftMagnitude(resample(rowProf, FFT_LEN));
  const colMag = fftMagnitude(resample(colProf, FFT_LEN));
  const rowLog = logBinsOf(rowMag, lb);
  for (let i = 0; i < rowLog.length; i += 1) out.push(rowLog[i]);
  const colLog = logBinsOf(colMag, lb);
  for (let i = 0; i < colLog.length; i += 1) out.push(colLog[i]);

  // 2D spectrum rings on a 32×32 true 2D downsample: energy by spatial-
  // frequency ring — coarse shape resonance first, fine detail later.
  const N = 32;
  const sq = resample2D(g, gw, gh, N, N);
  const re2 = Float64Array.from(sq);
  const im2 = new Float64Array(N * N);
  // separable radix-2 2D FFT (magnitude only): rows then columns
  for (let r = 0; r < N; r += 1) {
    const mag = fftMagnitude(Float64Array.from({ length: N }, (_, c) => re2[r * N + c]));
    for (let c = 0; c < N; c += 1) { re2[r * N + c] = mag[c]; im2[r * N + c] = 0; }
  }
  for (let c = 0; c < N; c += 1) {
    const mag = fftMagnitude(Float64Array.from({ length: N }, (_, r) => re2[r * N + c]));
    for (let r = 0; r < N; r += 1) { re2[r * N + c] = mag[r]; im2[r * N + c] = 0; }
  }
  const ringSum = new Float64Array(rings);
  const maxR = Math.hypot(N / 2, N / 2);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const dr = Math.abs(r - N / 2);
      const dc = Math.abs(c - N / 2);
      const rad = Math.hypot(dr, dc) / maxR;
      const b = Math.min(rings - 1, Math.floor(rad * rings));
      ringSum[b] += re2[r * N + c];
    }
  }
  for (let b = 0; b < rings; b += 1) out.push(ringSum[b] / Math.max(1, Math.PI * ((b + 1) ** 2 - b ** 2) * (maxR * maxR / (rings * rings))));

  return Float64Array.from(out);
}

// ── figure/ground: WHERE things are, without a CV model ───────────────────
// A photograph is not one thing. The child proposes candidate regions from
// the raw grid alone: a cell is FIGURE when it deviates from the grid's own
// mean by more than the grid's own standard deviation — the floor is derived
// from this material, never typed — and 4-connected components of the figure
// mask become candidate regions in the SAME [x,y,w,h] address shape the CV
// parent's boxes use. A component that matches no concept is simply reported
// unmatched; nothing is silently discarded. A flat image yields zero regions
// (mask: "flat"), disclosed, and the caller may fall back to whole-image.
export function figureRegions(grid, w, h, { floor = null, mask = null } = {}) {
  const n = grid.length;
  if (n === 0 || n !== w * h) throw new TypeError(`figureRegions: grid shape disagrees (${n} cells vs ${w}x${h})`);
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += grid[i];
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i += 1) {
    const d = grid[i] - mean;
    sq += d * d;
  }
  const std = Math.sqrt(sq / n);
  // `floor` inherits the figure/ground criterion from a PARENT material: a
  // crop of a bright figure flips its own background over its own std (a
  // 90%-square crop reads its margin as figure), so recursion uses the
  // frame's floor — figure/ground is a property of the frame, not of each
  // crop. Derived from the parent's bytes, never typed.
  const useMean = floor?.mean ?? mean;
  const useStd = floor?.std ?? std;
  if (useStd <= EPS) return { regions: [], mask: "flat", mean, std };
  const base = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) base[i] = Math.abs(grid[i] - useMean) > useStd ? 1 : 0;
  // `mask` overrides the figure cells entirely: a chroma mask (cells with
  // real color) lets a red circle overlapping a blue square separate into
  // its own components BEFORE the shadow is asked — color is the
  // segmentation key overlap cannot live without (measured, the color
  // curriculum).
  const maskCells = mask ?? base;
  const regions = [];
  const seen = new Uint8Array(n);
  // a figure smaller than ONE shadow bin cannot carry a shadow — below the
  // child's own resolution, derived from the descriptor contract (8×8 grid
  // bins over the material), never a typed area floor.
  const minArea = Math.max(1, Math.floor(n / 64));
  for (let start = 0; start < n; start += 1) {
    if (!maskCells[start] || seen[start]) continue;
    let minR = start % w, maxR = start % w, minC = (start / w) | 0, maxC = (start / w) | 0;
    let area = 0;
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const idx = queue.pop();
      area += 1;
      const r = idx % w;
      const c = (idx / w) | 0;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= w || nc < 0 || nc >= h) continue;
        const ni = nc * w + nr;
        if (maskCells[ni] && !seen[ni]) { seen[ni] = 1; queue.push(ni); }
      }
    }
    if (area < minArea) continue;
    regions.push({ region: [minR, minC, maxR - minR + 1, maxC - minC + 1], area });
  }
  // derived reporting order: largest figure first — what dominates the frame
  // is the first thing named, the child's own salience, not a typed tiebreak
  regions.sort((a, b) => b.area - a.area);
  return { regions, mask: regions.length ? "figure" : "no_figure", mean, std };
}

// ── the whole descriptor: shadow + echo ───────────────────────────────────
// The shadow and the echo are normalized SEPARATELY and concatenated, each
// half unit-normed: the shadow must not swallow the echo (or vice versa).
// Measured (mnemonic.test.mjs): one global normalization let the echo dwarf
// the envelope to quantized silence, and a sine read as a saw because the
// timbre difference had collapsed into one-bit bin noise. With separate
// norms, the SHAPE of each half is the descriptor — brightness/volume
// invariant, pitch moves only the shadow, timbre lives only in the echo.
export function descriptorOf(grid, w, h, crop = null, rgb = null) {
  const shadow = shadowOf(grid, w, h, crop);
  const echo = echoOf(grid, w, h, crop);
  const colored = !!rgb;
  const d = new Float64Array(colored ? COLORED_LEN : DESCRIPTOR_LEN);
  d.set(normalize(shadow), 0);
  d.set(normalize(echo), SHADOW_LEN);
  if (colored) {
    d.set(normalize(colorOf(rgb, w, h, crop)), DESCRIPTOR_LEN);
  }
  return d;
}

// ── the series face (audio, video, any 1D byte stream) ────────────────────
// SHADOW of a series = its RMS envelope profile (where the energy is, in
// time); ECHO of a series = its log-bin spectrum (what frequencies it rings
// at) + centroid/rolloff — the timbre numbers audio/moments.js already
// carries. Same contract, same framework. `segment` ([start, length], in
// samples) ties the descriptor to a SPECIFIC PART of the series — the child
// remembers when the bird sang, not just that a bird sang.
export const SERIES_WINDOW_BINS = 24;
export const SERIES_LEN = SERIES_WINDOW_BINS + 4; // envelope + support + flatness + rolloff + log-crest

// ── the series echo: pitch-INVARIANT spectral statistics ─────────────────
// Measured, mnemonic.test.mjs: log-bin spectra move 0.5+ per 1% pitch
// shift, and even a one-octave chroma fold rotates with the harmonic comb
// (harmonics sit at k·j, so folding by octaves shifts by log2(k)). A memory
// that cannot hear the same timbre at another pitch is not a timbre memory.
// What is genuinely invariant for periodic signals:
//   support   — the fraction of spectrum bins carrying real energy (a saw's
//               comb fills the band; a sine's single spike is ~empty)
//   flatness  — geometric/arithmetic mean of the magnitudes (the house's
//               own adapters/audio/moments.js statistic: comb vs spike)
//   rolloff   — the 85% energy point as a fraction (how far the energy
//               extends, mirror-free half-spectrum)
//   log-crest — log10(max/arithmetic-mean): a sine's crest is enormous, a
//               comb's modest
// The shadow (RMS envelope) carries WHERE in time the energy is; these four
// carry WHAT kind of signal it is, at any pitch.
export function seriesEchoStatistics(mag) {
  const half = Math.max(1, mag.length >> 1);
  let max = 0;
  let arith = 0;
  let sum = 0;
  let logSum = 0;
  let count = 0;
  for (let i = 1; i <= half; i += 1) {
    const m = mag[i];
    sum += m;
    arith += m;
    if (m > max) max = m;
    if (m > 0) { logSum += Math.log(m); count += 1; }
  }
  const arithMean = arith / half;
  let support = 0;
  const supportFloor = max * 0.02; // a bin "carries energy" above 2% of the peak — derived from the material's own peak
  for (let i = 1; i <= half; i += 1) if (mag[i] > supportFloor) support += 1;
  support /= half;
  let cum = 0;
  let roll = 0;
  for (let i = 1; i <= half; i += 1) { cum += mag[i]; if (cum >= 0.85 * sum) { roll = i; break; } }
  const flatness = count > 0 && arithMean > 0 ? Math.exp(logSum / count) / arithMean : 0;
  const crest = arithMean > 0 && max > 0 ? max / arithMean : 0;
  return { support, flatness, rolloff: roll / half, logCrest: crest > 0 ? Math.log10(crest) / 3 : 0 };
}

export function descriptorFromSeries(series, { windowBins = SERIES_WINDOW_BINS, segment = null } = {}) {
  let data = series;
  if (segment) {
    const [start, len] = segment;
    if (!(start >= 0 && len > 0 && start + len <= series.length))
      throw new TypeError(`descriptorFromSeries: segment [${segment}] does not lie inside a ${series.length}-sample series`);
    data = series.slice(start, start + len);
  }
  const out = [];
  const n = data.length;
  const win = Math.max(1, Math.floor(n / windowBins));
  const env = new Float64Array(windowBins);
  for (let b = 0; b < windowBins; b += 1) {
    let sq = 0;
    let cnt = 0;
    for (let i = b * win; i < Math.min(n, (b + 1) * win); i += 1) { sq += data[i] * data[i]; cnt += 1; }
    env[b] = cnt > 0 ? Math.sqrt(sq / cnt) : 0;
  }
  for (let i = 0; i < env.length; i += 1) out.push(env[i]);
  // THE ECHO IS THE WAVEFORM'S, NOT AN AVERAGE'S: a box-average of a
  // symmetric series cancels to silence (measured, mnemonic.test.mjs — a
  // sawtooth's echo vanished and a sine read as a saw). The spectrum is
  // computed on the RAW samples at full resolution, zero-padded to a power
  // of two (every byte kept; the pad smears, it never deletes).
  const fftLen = Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(2, n))));
  const padded = new Float64Array(fftLen);
  padded.set(data.subarray(0, n));
  const mag = fftMagnitude(padded);
  // the four pitch-invariant spectral statistics — the timbre tell
  const stats = seriesEchoStatistics(mag);
  out.push(stats.support, stats.flatness, stats.rolloff, stats.logCrest);
  const shadow = normalize(Float64Array.from(out.slice(0, windowBins)));
  const echo = normalize(Float64Array.from(out.slice(windowBins)));
  const d = new Float64Array(windowBins + 4);
  d.set(shadow, 0);
  d.set(echo, windowBins);
  return d;
}

// ── figure/ground for a series: WHERE in time the thing happens ───────────
// The 1D sibling of figureRegions: a bin is FIGURE when the ENERGY profile
// deviates from the series' own mean by more than its own standard deviation
// (derived from this material, never typed); connected runs of figure bins
// are candidate segments [start, length] in SAMPLES — the audio event, the
// video cut, the passage of raised motif density. Segmentation runs on the
// RMS ENVELOPE, not the raw samples: a constant-amplitude tone has constant
// energy and therefore NO segments (its samples swing ±1 and would split
// into noise runs — measured, mnemonic.test.mjs); a chirp is one segment.
// A series already shorter than two envelope windows IS its own profile
// (the text face's per-window motif counts), used directly.
export function figureSegments(series, { window = SERIES_WINDOW_BINS, envelope = true } = {}) {
  const n = series.length;
  if (n === 0) return { segments: [], mask: "empty" };
  let profile;
  let binToSample;
  if (!envelope || n <= 2 * window) {
    profile = Array.from(series);
    binToSample = (bin) => bin;
  } else {
    const win = Math.max(1, Math.floor(n / window));
    profile = Array.from({ length: window }, (_, b) => {
      let sq = 0;
      let cnt = 0;
      for (let i = b * win; i < Math.min(n, (b + 1) * win); i += 1) { sq += series[i] * series[i]; cnt += 1; }
      return cnt > 0 ? Math.sqrt(sq / cnt) : 0;
    });
    binToSample = (bin) => bin * win;
  }
  const m = profile.length;
  let sum = 0;
  for (let i = 0; i < m; i += 1) sum += profile[i];
  const mean = sum / m;
  let sq = 0;
  for (let i = 0; i < m; i += 1) {
    const d = profile[i] - mean;
    sq += d * d;
  }
  const std = Math.sqrt(sq / m);
  if (std <= EPS) return { segments: [], mask: "flat", mean, std };
  const figure = profile.map((v) => Math.abs(v - mean) > std);
  const segments = [];
  let i = 0;
  while (i < m) {
    while (i < m && !figure[i]) i += 1;
    if (i >= m) break;
    const start = i;
    while (i < m && figure[i]) i += 1;
    const s0 = binToSample(start);
    const s1 = Math.min(n, binToSample(i));
    segments.push({ segment: [s0, s1 - s0], length: s1 - s0 });
  }
  segments.sort((a, b) => b.length - a.length);
  return { segments, mask: segments.length ? "figure" : "no_figure", mean, std };
}

// ── the DMD framework of a concept: what things of its kind have in common ─
// The examples, in teaching order, are a trajectory; the DMD operator's
// coherent subspace is the dogness. The projector is U — the SVD basis the
// DMD operator itself acts on (its eigenvectors live in exactly that
// subspace; dmd.js's economySVD is the reduction every call shares). The
// eigenvalues carry each mode's growth and frequency, disclosed as the
// framework's own diagnostics: how many modes the kind excites, how many
// oscillate, how fast the idiosyncratic ones decay.
export function frameworkOf(examples, { cache = null } = {}) {
  if (cache?.revision === examples.revision && cache.framework) return cache.framework;
  const states = examples.items.map((e) => e.descriptor);
  if (states.length < 3) return { gap: "too_few_examples", examples: states.length };
  const m = states.length;
  const nCols = states[0].length;
  const X = Array.from({ length: nCols }, (_, i) => states.slice(0, m - 1).map((s) => s[i]));
  const Xp = Array.from({ length: nCols }, (_, i) => states.slice(1).map((s) => s[i]));
  const { eigenvalues, rank, operator } = dmd(X, Xp, { rank: "numerical" });
  const { U } = economySVD(X, { rank: Infinity });
  const coherent = eigenvalues.filter((l) => l.magnitude >= 1 - EPS).length;
  const oscillatory = eigenvalues.filter((l) => Math.abs(l.im) > EPS).length;
  const growths = eigenvalues.map((l) => l.growth);
  const framework = {
    rank,
    modes: eigenvalues.length,
    coherent,
    oscillatory,
    growthMin: growths.length ? Math.min(...growths) : null,
    growthMax: growths.length ? Math.max(...growths) : null,
    projector: U,
    revision: examples.revision,
  };
  if (cache) cache.framework = framework;
  return framework;
}

// residual: how much of the descriptor is NOT explained by the concept's
// coherent subspace — the part of the new thing that is not doglike.
export function residualOf(descriptor, framework) {
  const U = framework?.projector;
  const rank = U?.length ? (U[0]?.length ?? 0) : 0;
  if (rank === 0) return 1;
  const proj = new Float64Array(descriptor.length);
  for (let i = 0; i < descriptor.length; i += 1) {
    let s = 0;
    for (let j = 0; j < rank; j += 1) s += U[i][j] * descriptor[j];
    proj[i] = s;
  }
  let d2 = 0;
  for (let i = 0; i < descriptor.length; i += 1) {
    const diff = descriptor[i] - proj[i];
    d2 += diff * diff;
  }
  return Math.sqrt(d2);
}

// the acceptance floor, fully derived: the worst within-family nearest
// distance, measured leave-one-out — for every example, the distance to its
// nearest SIBLING among the others; the worst such distance is how far a
// thing of this kind may sit from its nearest kin and still be one of them.
// Measured (mnemonic.test.mjs): in 144-bin quantized space with a handful of
// examples, the DMD subspace residual is uninformative — every new thing is
// nearly orthogonal to a span of 3-4 examples — while the within-family
// nearest distance separates kinds by two orders of magnitude. The DMD
// framework remains the disclosed family structure; this bound is the
// recognition floor. There is no confidence SCORE: a thing is inside its
// kind's bound or it is not, and how far inside is the margin — geometry,
// not arithmetic.
//
// THE TWIN PROBLEM, DERIVED AWAY: a kind's examples often come in tight
// multiples — several hands of one pose, or a shape's own symmetry orbit
// (a square at 0° and at 90° are the same shadow). Each example's NEAREST
// sibling is then its twin at the hand-noise level (~0.03), and the bound
// measures only the noise, never the pose chain — measured in the rotation
// curriculum (mnemonic-curriculum.test.mjs): a square family taught across
// an octant of poses could not bridge a 5° gap because every lesson's
// nearest sibling was its own other hand. The material's own distance
// spectrum is bimodal in exactly that case (hand edges ~0.03, pose edges
// ~0.4), so the LARGEST GAP in the sorted within-kind distances is the
// derived twin level: siblings closer than the gap are the same thing in
// other hands or other symmetry copies — they do not count as distance. A
// kind whose spectrum has no bimodal gap keeps the plain nearest bound.
export function selfBoundOf(examples, { cache = null } = {}) {
  if (cache?.revision === examples.revision && cache.bound !== undefined) return cache.bound;
  const items = examples.items;
  if (items.length < 2) {
    // a single-lesson kind has no within-family spread to measure — it
    // recognizes at the child's own resolution: one quantized byte (the
    // memory's exact grain), disclosed, never a typed generosity.
    const single = { bound: 1 / 255, gap: "too_few_examples", examples: items.length };
    if (cache) cache.bound = single;
    return single;
  }
  const dists = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      dists.push(distanceOf(items[i].descriptor, items[j].descriptor));
    }
  }
  // the derived twin level: the separation between same-thing copies and
  // different poses, cut from the LOW structure of the kind's own distance
  // spectrum — the largest gap BELOW the median distance (measured: a
  // fill-continuum family is trimodal — hands ~0.03, adjacent fills ~0.4,
  // far fills ~1.1 — and the largest gap overall sat between the upper
  // clusters, sending the bound to 1.36; the hands are always the lowest
  // cluster, so the low-side gap is the true same-thing cut)
  let twinLevel = 0;
  const sorted = [...dists].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let bestGap = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] > median) break;
    const gap = sorted[i] - sorted[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      twinLevel = sorted[i - 1];
    }
  }
  let worst = 0;
  for (let i = 0; i < items.length; i += 1) {
    let nearest = Infinity;
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;
      const d = distanceOf(items[i].descriptor, items[j].descriptor);
      if (d < nearest) nearest = d;
    }
    // the effective sibling distance: the nearest sibling BEYOND the twin
    // level, when the spectrum's largest gap actually separates one
    if (bestGap > 0 && sorted.length >= 2) {
      let beyond = Infinity;
      for (let j = 0; j < items.length; j += 1) {
        if (i === j) continue;
        const d = distanceOf(items[i].descriptor, items[j].descriptor);
        if (d > twinLevel && d < beyond) beyond = d;
      }
      if (beyond < Infinity) nearest = beyond;
    }
    if (nearest > worst) worst = nearest;
  }
  const bound = { bound: worst, gap: null, twinLevel: bestGap > 0 ? twinLevel : null };
  if (cache) cache.bound = bound;
  return bound;
}

export const distanceOf = (a, b) => {
  if (a.length !== b.length) throw new TypeError(`distanceOf: descriptor shape mismatch (${a.length} vs ${b.length})`);
  let d2 = 0;
  for (let i = 0; i < a.length; i += 1) {
    const df = a[i] - b[i];
    d2 += df * df;
  }
  return Math.sqrt(d2);
};

// ── the recognition: is this new thing doglike, per the child's memory? ───
// Pure over a store shape { concepts: { name: { revision, items: [...] } } }.
// OMNIMODAL: shape is per-concept — each item carries the descriptor length
// its own sense produces (image 144, series 50, text 48) and the concept
// validates against ITS OWN shape, never a global one.
//
// EVERY READING IS AGAINST A VOID. A kind is recognized against the
// complement of the kind set active in the store at this moment: the void is
// the nearest example of any OTHER kind. The same bytes read differently
// against {dog, cat} than against {mammal, plant} — parsing is a function of
// the universe being parsed against, and the verdict discloses the void it
// was read against (its kind and distance) and whether this kind is the
// PRIMARY reading (closest of all kinds) or a secondary containment.
//
// THE VERDICT IS BOUNDED GEOMETRY, NOT A SCORE: inside the kind's own
// within-family bound → recognized, outside → not; how far inside is the
// margin. The DMD framework (modes, eigenvalues, residual) is computed only
// when `diagnostics: true` — the verdict never pays for it.
export function recognizeDescriptor(store, concept, descriptor, { cache = null, diagnostics = false } = {}) {
  const conceptEntry = store?.concepts?.[concept];
  if (!conceptEntry?.items?.length) return { verdict: "unrecognized", gap: "concept_unknown", concept };
  const shape = conceptEntry.items[0].shape ?? DESCRIPTOR_LEN;
  if (descriptor.length !== shape)
    throw new TypeError(`recognizeDescriptor: descriptor shape mismatch (${descriptor.length} vs the concept's own ${shape})`);
  const boundInfo = selfBoundOf(conceptEntry, { cache });
  let best = null;
  let bestD = Infinity;
  for (const item of conceptEntry.items) {
    const d = distanceOf(descriptor, item.descriptor);
    if (d < bestD) { bestD = d; best = item; }
  }
  const bound = boundInfo.bound ?? 0;
  const verdict = bestD <= bound ? "recognized" : "unrecognized";

  // the void: the nearest example of any OTHER kind — what this reading is
  // NOT. Parsing on {dog, cat}, a thing near both is disclosed as such.
  let voidBest = null;
  let voidD = Infinity;
  let voidKind = null;
  for (const [otherName, otherEntry] of Object.entries(store?.concepts ?? {})) {
    if (otherName === concept || !otherEntry?.items?.length) continue;
    const otherShape = otherEntry.items[0].shape ?? DESCRIPTOR_LEN;
    if (otherShape !== shape) continue;
    for (const item of otherEntry.items) {
      const d = distanceOf(descriptor, item.descriptor);
      if (d < voidD) { voidD = d; voidBest = item; voidKind = otherName; }
    }
  }

  const framework = diagnostics ? frameworkOf(conceptEntry, { cache }) : null;
  return {
    verdict,
    concept,
    // bounded geometry, not a score: inside the bound → recognized; the
    // margin is how far inside (or how far beyond, when negative)
    nearestDistance: bestD,
    bound,
    margin: bound - bestD,
    // the void this reading was taken against
    void: voidBest
      ? {
          kind: voidKind,
          distance: voidD,
          margin: bestD - voidD,
          region: voidBest.region ?? null,
          source: voidBest.source ?? null,
        }
      : null,
    // PRIMARY: this kind is the closest of all kinds at this moment;
    // SECONDARY: another kind is closer (a containment — the lattice)
    reading: voidBest ? (bestD <= voidD ? "primary" : "secondary") : "primary",
    framework: framework
      ? {
          rank: framework.rank,
          modes: framework.modes,
          coherent: framework.coherent,
          oscillatory: framework.oscillatory,
          growthMin: framework.growthMin,
          growthMax: framework.growthMax,
          residual: residualOf(descriptor, framework),
        }
      : null,
    nearest: best
      ? {
          region: best.region ?? null,
          source: best.source ?? null,
          label: best.label ?? null,
          distance: bestD,
        }
      : null,
  };
}