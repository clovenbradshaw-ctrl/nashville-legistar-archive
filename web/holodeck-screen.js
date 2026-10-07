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
  const { data } = cx.getImageData(0, 0, W, H);
  tr('screen', 'decode', 'Decoded ' + W + ' × ' + H + ' pixels for the 2D model', { w: W, h: H });
  let words = [];
  try {
    const T = await loadTess(opts.tessSrc); tr('screen', 'ocr', 'Reading the image’s word boxes with tesseract');
    const r = await T.recognize(cv, 'eng', { logger: m => { if (opts.onProgress && m && m.status) opts.onProgress(m); } });
    words = wordsFromTess((r && r.data) || {});
    tr('screen', 'ocr', 'Tesseract returned ' + words.length + ' word boxes', { words: words.length });
  } catch (e) { tr('screen', 'ocr-fail', 'No word boxes (OCR did not run: ' + e.message + ')'); }
  const model = buildScreenModel({ width: W, height: H, data }, words, opts.core || {});
  tr('screen', 'model', 'The 2D model: ' + model.stats.boxes + ' boxes, ' + model.stats.texts + ' texts, ' + model.stats.images + ' images, ' + model.stats.rules + ' rules', model.stats);
  const elements = elementsOf(model, 1);
  const tokens = tokensOf(model);
  const gaps = gapsOf({ lines: wordsToLines(words), report: {} }, model, 1);
  const text = readingTextOf({ width: W, height: H, unit: model.unit, root: model.root, stats: model.stats, tokens, elements, source: {} }, {});
  const ledger = ledgerLinesOf({ source: { name: opts.name || 'image' }, elements }, { image: opts.name || 'image' });
  return { schema: 'EOScreenLook@1', width: W, height: H, unit: model.unit, model, elements, tokens, gaps, text, ledger, words: words.length };
}

// OCR words → the line shape gapsOf expects (a line per distinct OCR line index is overkill here;
// one line per word is enough for "did the box's text land?").
function wordsToLines(words) {
  const byLine = new Map();
  words.forEach(w => { const key = w.bbox.y0 + ':' + w.bbox.y1; let L = byLine.get(key); if (!L) byLine.set(key, L = { text: '', conf: 0, n: 0, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } }); L.text += (L.text ? ' ' : '') + w.text; L.conf += w.conf; L.n++; L.bbox.x0 = Math.min(L.bbox.x0, w.bbox.x0); L.bbox.x1 = Math.max(L.bbox.x1, w.bbox.x1); L.bbox.y0 = Math.min(L.bbox.y0, w.bbox.y0); L.bbox.y1 = Math.max(L.bbox.y1, w.bbox.y1); });
  return [...byLine.values()].map(L => ({ text: L.text, conf: Math.round(L.conf / L.n), bbox: L.bbox }));
}

export { buildScreenModel, elementsOf, tokensOf, gapsOf, readingTextOf, ledgerLinesOf, htmlOf };
