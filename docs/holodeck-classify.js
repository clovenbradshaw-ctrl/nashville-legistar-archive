// holodeck-classify.js — what kind of sound a recording is, decided in this browser.
//
// One rung, the same shape as the in-browser recognizer (fold-net.js): the audio is
// decoded locally, the model runs here, nothing leaves the machine. The model is the
// YAMNet end-to-end ONNX export (jafet21/yamnetonnx, the full SavedModel — its input
// is raw float32 16 kHz mono audio, its output is one AudioSet score vector per
// 0.48 s patch). `hd:clsModel` can point at any other YAMNet END2END .onnx (CORS).
//
// The output is not a flat label but the places where the kind of sound *changes*:
// frames are argmax'd, smoothed over a 5-frame window to kill flicker, then merged.
// A span shorter than ~1.5 s is absorbed into its neighbour, so the caller gets only
// the significant chunks — the segments where something meaningfully different is
// happening, which is what the surface shows as the recording's sound map.

import { CLASS_NAMES } from './yamnet-names.js';

const MODEL_URL = 'https://huggingface.co/jafet21/yamnetonnx/resolve/main/yamnet.onnx';
const RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.min.mjs';
const WURL = ortho => 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/' + ortho;
const HOP_S = 0.48, WINDOW_S = 0.96;

let _ort = null, _session = null, _loading = null;

export function clsModelUrl() { try { const v = localStorage.getItem('hd:clsModel'); return v ? v : null; } catch (e) { return null; } }

async function load(onProgress) {
  if (_session) return _session;
  if (_loading) return _loading;
  _loading = (async () => {
    try {
      onProgress && onProgress({ stage: 'loading classifier' });
      if (!_ort) {
        const m = await import(RUNTIME_URL);
        // Point onnxruntime-web at the CDN's own wasm files instead of trying to guess location.protocol hosting.
        m.env.wasm.wasmPaths = WURL('');
        _ort = m;
      }
      const url = clsModelUrl() || MODEL_URL;
      _session = await _ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
      _ort.env.wasm.numThreads = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 1;
      return _session;
    } catch (e) {
      _session = null; throw e;
    }
  })();
  const s = await _loading; _loading = null; return s;
}

// The whole recording at 16 kHz mono. Kept for callers that need it all at once; it streams
// through holodeck-pcm.js rather than decoding the file in one piece (which, for a long
// recording, exhausted the tab).
export async function decode16k(buf) {
  const P = await import(new URL('holodeck-pcm.js', import.meta.url).href);
  return P.decode16kAll(buf);
}

// classifySound(buf, { onProgress, maxSec }) -> { source, model, spans, covered, duration }
//   buf:  ArrayBuffer of any decoded audio (wav/mp3/flac/…). Span: { start, end, label, name, frames }.
export async function classifySound(buf, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const maxSec = opts.maxSec || 4 * 3600;
  const session = await load(onProgress);
  onProgress && onProgress({ stage: 'decoding audio' });
  // YAMNet's frame count is a function of the waveform length; the sound is streamed in
  // 20 s windows (holodeck-pcm.js) so only one window is decoded at a time, progress is
  // real, and the frames are stitched.
  const P = await import(new URL('holodeck-pcm.js', import.meta.url).href);
  const total = (await P.audioDuration(buf)) || null;
  const inputName = session.inputNames[0];
  // The END2END export takes a 1-D waveform [N]; feeding [1, N] makes session.run reject
  // ("Invalid rank for input"), which the caller only traces — it read as a hang. Follow the
  // model's own declared rank when the runtime reports it, so an `hd:clsModel` that wants
  // a batch axis still works.
  const meta = session.inputMetadata && [].concat(session.inputMetadata).find(m => m && m.name === inputName);
  const batched = !!(meta && meta.shape && meta.shape.length === 2);
  const labels = []; let duration = 0;
  for await (const w of P.pcm16k(buf, { winSec: 20 })) {
    if (w.start >= maxSec) break;
    const part = w.pcm; duration = w.start + part.length / 16000;
    // a plain copy, as before: the window can be an AudioBuffer's own channel memory
    const feed = { [inputName]: new _ort.Tensor('float32', part.slice(0), batched ? [1, part.length] : [part.length]) };
    const out = await session.run(feed);
    const tensor = Object.values(out)[0];
    if (!tensor || !tensor.data || !tensor.dims) throw new Error('the classifier returned no scores');
    const scores = tensor.data; const F = tensor.dims && tensor.dims.length === 2 ? tensor.dims[0] : Math.floor(scores.length / 521);
    if (F && scores.length >= F * 521) {
      for (let f = 0; f < F; f++) {
        let best = 0; let o0 = f * 521;
        for (let k = 1; k < 521; k++) if (scores[o0 + k] > scores[o0 + best]) best = k;
        labels.push(best);
      }
    }
    onProgress && onProgress({ stage: 'classifying', pct: total ? Math.min(100, Math.round(duration / Math.min(total, maxSec) * 100)) : null, frames: labels.length });
    await new Promise(r => setTimeout(r, 0));
  }
  if (!labels.length) throw new Error('no frames were scored');
  const hop = Math.max(HOP_S, duration / labels.length);
  return { ...spansFromLabels(labels, duration, hop), source: 'in-browser-yamnet', model: 'yamnet-end2end-onnx', duration };
}

// spansFromLabels(labels, duration, hop) -> { spans, covered }
//   Pure and deterministic, so the merge rule is testable: argmax runs are smoothed by
//   a 5-frame majority vote (kills single-frame flicker), merged, and a run shorter
//   than 4 frames (~1.9 s) is absorbed into the previous span — the caller gets only
//   the significant chunks, the places where something meaningfully different happens.
export function spansFromLabels(labels, duration, hop) {
  hop = hop || Math.max(HOP_S, duration / Math.max(1, labels.length));
  if (!labels.length) return { spans: [], covered: 0 };
  const sm = labels.map((_, i) => {
    const votes = new Map();
    for (let j = Math.max(0, i - 2); j <= Math.min(labels.length - 1, i + 2); j++) votes.set(labels[j], (votes.get(labels[j]) || 0) + 1);
    let best = labels[i], cnt = 0; votes.forEach((c, v) => { if (c > cnt) { cnt = c; best = v; } }); return best;
  });
  const spans = []; let cur = null;
  sm.forEach((lab, i) => {
    const t0 = Math.max(0, Math.min(i * hop, duration)), t1 = Math.max(0, Math.min((i + 1) * hop, duration));
    if (cur && cur.label === lab) { cur.end = t1; cur.frames++; return; }
    if (cur) spans.push(cur);
    cur = { start: t0, end: Math.max(t0, t1), label: lab, frames: 1, name: CLASS_NAMES[lab] || ('class ' + lab) };
  });
  if (cur) spans.push(cur);
  const out = [];
  for (const sp of spans) {
    if (!out.length) { out.push(sp); continue; }
    if (sp.frames < 4 || (sp.end - sp.start) < 1.5) { const prev = out[out.length - 1]; if (prev.end < sp.end) prev.end = sp.end; }
    else out.push(sp);
  }
  const covered = out.reduce((a, x) => a + (x.end - x.start), 0);
  return { spans: out, covered: Math.round(covered / Math.max(0.001, duration) * 100) };
}