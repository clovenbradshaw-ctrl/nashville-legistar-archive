// holodeck-eyes.test.mjs — the eyes' own pins: the layer stack (ink vs wash vs negative pixels),
// the per-page reconciliation (one page in, one out), and the sensing that decides which eye is
// needed from the bytes and the stigmergic trail. Pure functions, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYES, EYE_IDS, baseEyes, senseEyes, escalate, reconcilePages, summarize,
  layerModel, recordTrail, loadTrails, RECONCILE_MARGIN,
} from './holodeck-eyes.js';
import { dominant } from './holodeck-screen-core.js';
import { contentOf } from './holodeck-screen.js';

// A synthetic page: white ground, a large FAINT wash (a watermark), two strong ink lines, and a
// couple of stray dark pixels no layer explains (the negative map).
function page() {
  const W = 200, H = 200, d = new Uint8ClampedArray(W * H * 4).fill(255);
  const set = (x, y, r, g, b) => { const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; };
  for (let y = 50; y < 150; y++) for (let x = 50; x < 150; x++) set(x, y, 232, 232, 232);
  for (let y = 60; y < 70; y++) for (let x = 40; x < 160; x++) set(x, y, 20, 20, 20);
  for (let y = 90; y < 100; y++) for (let x = 40; x < 120; x++) set(x, y, 20, 20, 20);
  set(5, 5, 0, 0, 0); set(5, 7, 0, 0, 0);
  return { width: W, height: H, data: d };
}

test('layerModel separates the stack: a faint large wash is a watermark layer, strong marks are ink, leftovers are negative pixels', () => {
  const L = layerModel(page());
  assert.equal(L.background, '#ffffff', 'the background is the page’s own dominant colour');
  assert.equal(L.watermark.present, true, 'a large faint component is a wash');
  assert.ok(L.watermark.meanAlpha < 0.35, 'a watermark is faint');
  assert.ok(L.ink >= 1, 'strong components are ink');
  assert.ok(L.negativeCells >= 1, 'foreground no layer claims is the negative map');
  assert.equal(L.alpha.length, L.grid.w * L.grid.h, 'the alpha grid is downsampled, not the raw page');
  assert.equal(L.negative.length, L.alpha.length, 'the negative map shares the alpha grid');
});

test('reconcilePages folds the eyes per page: one page in, one out, the most-landed wins a real gap, the model wins a near-tie, disagreements are witnesses not merges', () => {
  const pages = [
    { page: 1, textlayer: { text: 'Alpha Beta Gamma' }, ocr: { text: 'Alpha Beta Gamrna Delta' }, model: { text: 'Alpha Beta Gamma Delta' } },
    { page: 2, model: { text: 'Only the model saw this page' } },
  ];
  const r = reconcilePages(pages);
  assert.equal(r.pages.length, 2, 'never adds or removes a page');
  assert.equal(r.pages[0].chosen, 'model', 'a near-tie goes to the positioned model, not OCR noise');
  assert.equal(r.pages[1].chosen, 'model');
  assert.ok(r.pages[0].witnesses.some(w => w.eye === 'textlayer' && !w.chosen), 'the losing eyes stay witnesses');
  assert.ok(r.pages[0].disagreements.length >= 1, 'the lines only one eye saw are kept as disagreements');
  assert.equal(RECONCILE_MARGIN, 0.15, 'the near-tie margin is declared');
  // a real coverage gap still wins on its own
  const wide = reconcilePages([{ page: 1, ocr: { text: 'x'.repeat(300) }, model: { text: 'short' } }]);
  assert.equal(wide.pages[0].chosen, 'ocr', 'a real gap beats the model’s preference');
});

test('coverage is script-neutral: a CJK page is not scored as empty', () => {
  const r = reconcilePages([{ page: 1, ocr: { text: '李白 杜甫 白居易 王維 孟浩然 李商隱' }, model: { text: 'short latin' } }]);
  assert.equal(r.pages[0].chosen, 'ocr', 'the CJK eye landed more characters and is chosen');
});

test('sensing: the sniff picks the cheapest likely eye, and only a real trail gap displaces it', () => {
  assert.deepEqual(baseEyes({ kind: 'pdf', textLayer: true }), ['textlayer'], 'a born-digital PDF needs no OCR');
  assert.deepEqual(baseEyes({ kind: 'pdf', textLayer: false }), ['model'], 'a scan needs the measured model');
  assert.deepEqual(baseEyes({ image: true }), ['model']);
  const noTrail = senseEyes({ kind: 'pdf', textLayer: false });
  assert.equal(noTrail.basis, 'sniff', 'no trail → the sniff decides');
  const trails = { pdf: { byEye: { ocr: { runs: 4, chosen: 4, chars: 900 }, model: { runs: 1, chosen: 0, chars: 10 } } } };
  const led = senseEyes({ kind: 'pdf', textLayer: false, trails });
  assert.equal(led.basis, 'trail', 'a real gap in the trail biases the choice');
  assert.equal(led.eyes[0], 'ocr', 'toward the eye that actually landed');
});

test('escalation adds exactly one eye, only when the first pass was thin, and never exhausts the ladder twice', () => {
  const first = escalate({ eyes: ['model'], chars: 5 }, { _order: EYE_IDS });
  assert.deepEqual(first.eyes.sort(), ['model', 'textlayer'].sort(), 'the next eye is added, not all');
  const last = escalate({ eyes: ['model', 'ocr', 'textlayer'], chars: 5 }, { _order: EYE_IDS });
  assert.equal(last, null, 'no eye left to add');
});

test('the trail is append-only and per-kind: a run adds counts, it never overwrites', () => {
  for (const k of Object.keys(loadTrails())) { if (k !== '_order') { /* leave real state; test on a private kind */ } }
  const kind = 'test-kind-' + Date.now();
  const a = recordTrail(kind, [{ page: 1, witnesses: [{ eye: 'textlayer', chars: 100, chosen: true }, { eye: 'ocr', chars: 80, chosen: false }] }]);
  const b = recordTrail(kind, [{ page: 1, witnesses: [{ eye: 'textlayer', chars: 100, chosen: true }] }]);
  assert.equal(b[kind].byEye.textlayer.chosen, 2, 'runs accumulate');
  assert.equal(b[kind].byEye.textlayer.chars, 200, 'character counts accumulate');
  assert.equal(b[kind].byEye.ocr.runs, 1, 'the other eye is untouched by the second run');
});

test('summarize reports what the eyes did without inventing a page', () => {
  const r = reconcilePages([{ page: 1, model: { text: 'Alpha Beta' }, ocr: { text: 'Alpha Beta Gamrna' } }, { page: 2, model: { text: 'Gamma Delta' } }]);
  const s = summarize(r, [{ watermark: { present: true }, ink: 3 }]);
  assert.equal(s.pages, 2, 'one page per input page');
  assert.deepEqual(s.eyes, EYE_IDS);
  assert.equal(s.watermarkPages, 1);
});

// The image→HTML core the eyes sit on: the page's CONTENT (positioned text, reading order) and the
// page's own background. These are the pieces hdPdfEyes composes into per-page eye entries.
test('contentOf composes the page content in reading order, and every offset slices back to its text', () => {
  const screen = { width: 1000, height: 1400, elements: [
    { id: 'e9', type: 'text', role: 'p', text: 'Second line', region: [100, 300, 400, 40] },
    { id: 'e2', type: 'box', role: 'box', region: [0, 0, 1000, 1400] },
    { id: 'e5', type: 'text', role: 'h1', text: 'A Heading', region: [100, 100, 500, 60] },
    { id: 'e7', type: 'text', role: 'p', text: 'First body', region: [100, 200, 600, 40] },
  ] };
  const c = contentOf(screen);
  assert.equal(c.text, 'A Heading\nFirst body\nSecond line', 'text nodes, top to bottom, boxes ignored');
  for (const e of c.elements) assert.equal(c.text.slice(e.start, e.end), e.text, 'the element offsets are exact');
});

test('dominant reads the page’s own background, not a stray mark', () => {
  const img = { width: 2, height: 2, data: new Uint8ClampedArray([9, 9, 9, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]) };
  assert.equal(dominant(img, 0, 0, 2, 2).join(','), '255,255,255');
});
