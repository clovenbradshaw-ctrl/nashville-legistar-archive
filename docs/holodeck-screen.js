// holodeck-screen.js — the image's middle layer, read IN THIS TAB: the measured 2D model
// (elements with region [x,y,w,h], roles, reading order, design tokens, typed gaps) that sits
// between the pixels and any HTML. This is the browser twin of the screenshot pipeline's
// screen-read.js / screen-sidecar.js, which shell out to ffmpeg + the tesseract binary; here the
// pixels come from a decoded image and the word boxes from tesseract.js (already loaded for OCR),
// so an image dropped into the fold is read for STRUCTURE, not only for its string.
//
// The pure geometry — words → texts → boxes → a tree → elements → tokens — is holodeck-screen-core.js,
// which is CI'd in node and reused unchanged. This module is only the browser's decode + OCR glue.
//
// Nothing here is a vision model: every field is measured from the pixels and the OCR boxes, and
// the note says so. A region no box or text explained stays a gap; it is never guessed.

import { buildScreenModel, elementsOf, tokensOf, gapsOf, readingTextOf, ledgerLinesOf, htmlOf } from './holodeck-screen-core.js';

let _tess = null;
async function loadTess(base) {
  if (_tess) return _tess;
  const src = base || 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('tesseract.js did not load')); document.head.appendChild(s); });
  return (_tess = window.Tesseract);
}

// Faint or low-contrast scans read poorly. Grayscale + Otsu-binarize the page
// before the eyes read it — but only when the page reads as a document (a light
// background), so a dark/colourful UI screenshot is left alone. Measured on a
// faded clinical form this took the read from 0 fields to several.
function binarize(cv) {
  // Optics live in Alhazen (scores-patch-points/Alhazen); use it when present.
  if (typeof window !== "undefined" && window.Alhazen && window.Alhazen.binarizeCanvas) return window.Alhazen.binarizeCanvas(cv);
  try {
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const im = cx.getImageData(0, 0, cv.width, cv.height), d = im.data;
    const hist = new Array(256).fill(0), gray = new Uint8ClampedArray(d.length / 4);
    let sumL = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0; gray[j] = g; hist[g]++; sumL += g; }
    if (sumL / gray.length < 120) return cv;
    const total = gray.length; let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, max = 0, thr = 127;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > max) { max = v; thr = t; } }
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = gray[j] > thr ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
  } catch (e) {}
  return cv;
}

// tesseract.js word → the pipeline's word shape ({ text, conf, bbox:{x0,y0,x1,y1} }).
function wordsFromTess(data) {
  const words = [];
  (data.words || []).forEach(w => { if (w && w.text && w.text.trim() && w.confidence >= 0) words.push({ text: w.text, conf: w.confidence, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } }); });
  return words;
}

/** Read a decoded bitmap into the measured 2D model. Returns the model, its sidecar-shaped parts
 *  (elements/tokens/gaps), the reading text and the EOT ledger lines — everything the surface and
 *  the records need, with no DOM left in the result. `img` may be an ImageBitmap, canvas or img. */
export async function readScreenImage(img, opts = {}) {
  const tr = opts.tr || (() => {});
  const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
  if (!W || !H) return null;
  const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
  if (opts.binarize !== false) binarize(cv);
  const { data } = cx.getImageData(0, 0, W, H);
  tr('screen', 'decode', 'Decoded ' + W + ' × ' + H + ' pixels for the 2D model', { w: W, h: H });
  let words = [], raw = '';
  try {
    const T = await loadTess(opts.tessSrc); tr('screen', 'ocr', 'Reading the image’s word boxes with tesseract');
    const r = await T.recognize(cv, 'eng', { logger: m => { if (opts.onProgress && m && m.status) opts.onProgress(m); } });
    const data = (r && r.data) || {};
    words = wordsFromTess(data);
    raw = String(data.text || '').replace(/\s+\n/g, '\n').trim();
    tr('screen', 'ocr', 'Tesseract returned ' + words.length + ' word boxes', { words: words.length });
  } catch (e) { tr('screen', 'ocr-fail', 'No word boxes (OCR did not run: ' + e.message + ')'); }
  const model = buildScreenModel({ width: W, height: H, data }, words, opts.core || {});
  tr('screen', 'model', 'The 2D model: ' + model.stats.boxes + ' boxes, ' + model.stats.texts + ' texts, ' + model.stats.images + ' images, ' + model.stats.rules + ' rules', model.stats);
  const elements = elementsOf(model, 1);
  const tokens = tokensOf(model);
  const gaps = gapsOf({ lines: wordsToLines(words), report: {} }, model, 1);
  const text = readingTextOf({ width: W, height: H, unit: model.unit, root: model.root, stats: model.stats, tokens, elements, source: {} }, {});
  const ledger = ledgerLinesOf({ source: { name: opts.name || 'image' }, elements }, { image: opts.name || 'image' });
  return { schema: 'EOScreenLook@1', width: W, height: H, unit: model.unit, model, elements, tokens, gaps, text, ledger, raw, words: words.length };
}

/** The page's CONTENT from the measured model: its text nodes in reading order, each with the
 *  region [x,y,w,h] it was read from, and the page text they compose with each element's
 *  [start,end) into it. `screen.text` is the LAYOUT reading ("Looking at the image…"); this is the
 *  words themselves, positioned — what an overlay anchors to. Offsets are the model's own, so a
 *  caller that builds the document text the same way (elements joined by '\n') can slice it. */
export function contentOf(screen) {
  const els = (screen.elements || []).filter(e => e.type === 'text' && e.text && e.text.trim() && e.region)
    .slice().sort((a, b) => a.region[1] - b.region[1] || a.region[0] - b.region[0]);
  let text = ''; const out = [];
  for (const e of els) {
    const t = e.text.trim(); if (text) text += '\n';
    const start = text.length; out.push({ id: e.id, role: e.role, region: e.region, text: t, start, end: start + t.length });
    text += t;
  }
  return { text, elements: out, width: screen.width, height: screen.height };
}

// OCR words → the line shape gapsOf expects (a line per distinct OCR line index is overkill here;
// one line per word is enough for "did the box's text land?").
function wordsToLines(words) {
  const byLine = new Map();
  words.forEach(w => { const key = w.bbox.y0 + ':' + w.bbox.y1; let L = byLine.get(key); if (!L) byLine.set(key, L = { text: '', conf: 0, n: 0, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } }); L.text += (L.text ? ' ' : '') + w.text; L.conf += w.conf; L.n++; L.bbox.x0 = Math.min(L.bbox.x0, w.bbox.x0); L.bbox.x1 = Math.max(L.bbox.x1, w.bbox.x1); L.bbox.y0 = Math.min(L.bbox.y0, w.bbox.y0); L.bbox.y1 = Math.max(L.bbox.y1, w.bbox.y1); });
  return [...byLine.values()].map(L => ({ text: L.text, conf: Math.round(L.conf / L.n), bbox: L.bbox }));
}

export { buildScreenModel, elementsOf, tokensOf, gapsOf, readingTextOf, ledgerLinesOf, htmlOf };
