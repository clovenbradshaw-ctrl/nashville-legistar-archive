// holodeck-waveform.js — the picture of a recording's loudness, one bar per slice of time.
//
// The reader's player shows video as video and audio as a waveform. This module is the audio half: it
// reduces the decoded samples to a fixed number of peaks (pure, tested), decodes a recording's bytes to
// those peaks in the browser (streamed through holodeck-pcm.js one window at a time, so a three-hour
// meeting never sits decoded in memory), and
// paints them with the played part in the accent colour. Nothing leaves the tab.

/** The loudest sample in each of `buckets` equal slices of `samples`, scaled so the loudest slice is 1. */
export function peaksOf(samples, buckets) {
  const n = samples ? samples.length : 0, B = Math.max(1, buckets | 0), out = new Float32Array(B);
  if (!n) return out;
  let top = 0;
  for (let b = 0; b < B; b++) {
    const lo = Math.floor(b * n / B), hi = Math.max(lo + 1, Math.floor((b + 1) * n / B));
    let m = 0;
    for (let i = lo; i < hi && i < n; i++) { const v = samples[i] < 0 ? -samples[i] : samples[i]; if (v > m) m = v; }
    out[b] = m; if (m > top) top = m;
  }
  if (top > 0) for (let b = 0; b < B; b++) out[b] /= top;
  return out;
}

/** Seconds at a horizontal position inside a box of `width` pixels. Clamped to the recording. */
export function timeAtX(x, width, duration) {
  if (!(width > 0) || !(duration > 0)) return 0;
  return Math.min(duration, Math.max(0, x / width * duration));
}

/** Decode a recording's bytes to { peaks, duration }, or null when the browser can't read the sound.
 *  The sound streams in windows; each window leaves a fine row of peaks (one per 50 ms) that is
 *  reduced to `buckets` at the end, so memory is the row, not the recording. */
export async function decodePeaks(bytes, buckets = 1600) {
  try {
    if (!bytes || !(bytes.byteLength > 44)) return null;
    if (typeof window === 'undefined' || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return null;
    const P = await import(new URL('holodeck-pcm.js', import.meta.url).href);
    const STEP = 800; const fine = []; let n = 0;
    for await (const w of P.pcm16k(bytes, { winSec: 60 })) {
      const x = w.pcm;
      for (let o = 0; o < x.length; o += STEP) { let m = 0; const e = Math.min(x.length, o + STEP); for (let i = o; i < e; i++) { const v = x[i] < 0 ? -x[i] : x[i]; if (v > m) m = v; } fine.push(m); }
      n += x.length;
    }
    if (!n) return null;
    return { peaks: peaksOf(Float32Array.from(fine), buckets), duration: n / P.RATE };
  } catch (e) { return null; }
}

/** Paint peaks onto a canvas: mirrored bars, the played share (0..1) in `played`. Resolves CSS variables itself. */
export function drawWave(canvas, peaks, progress = 0) {
  if (!canvas || !peaks || !peaks.length) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const cs = getComputedStyle(canvas), pick = (v, d) => (cs.getPropertyValue(v) || '').trim() || d;
  const rest = pick('--dim', '#8a8f98'), done = pick('--acc', '#5b8def');
  const g = canvas.getContext('2d'); g.clearRect(0, 0, w, h);
  const n = peaks.length, bw = w / n, mid = h / 2, cut = Math.max(0, Math.min(1, progress)) * w;
  for (let i = 0; i < n; i++) {
    const x = i * bw, bh = Math.max(2 * dpr, peaks[i] * h * 0.92);
    g.fillStyle = x + bw <= cut ? done : rest;
    g.globalAlpha = x + bw <= cut ? 1 : 0.55;
    g.fillRect(x, mid - bh / 2, Math.max(1, bw - dpr * 0.5), bh);
  }
  g.globalAlpha = 1; g.fillStyle = done; g.fillRect(Math.min(w - dpr, cut), 0, dpr * 1.5, h);
}
