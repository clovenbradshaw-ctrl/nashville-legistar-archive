// holodeck-eyes.js — the extractors that look at one source ("eyes"), the layers their pixels
// carry, and the reconciliation that folds whatever eyes ran into one reading.
//
// WHY EYES. The same scan can be read by more than one reader, and they disagree: a born-digital
// PDF's own text layer is exact but absent on a scan; tesseract's flat string usually lands but
// carries no positions; the measured 2D model (image→HTML, holodeck-screen-core.js) carries
// positions and structure but costs a full OCR + segmentation pass. No single eye is always right,
// so each is a witness, and a reconciliation layer folds them.
//
// ONLY AS NEEDED — AND LEARNED. Which eye to run is not fixed: it is SENSED from the bytes (a PDF
// that carries a text layer never needs OCR) and from STIGMERGIC TRAILS — a per-kind ledger of
// which eye actually landed and was chosen last time. Trails are pheromone, not policy: they bias,
// they never forbid, and a person's chosen eyes always win. If the sensed set lands too little, the
// run ESCALATES, adding the next eye and writing that outcome back to the trail.
//
// LAYERS / ALPHA / NEGATIVE PIXELS. A page is pixels, and pixels are a stack the eye never sees
// flattened: background, ink, a wash (watermark), and the leftover foreground no layer explains
// ("negative pixels"). layerModel() measures per-pixel alpha = distance from the page's own
// background, names the flat components into layers, flags a large faint wash as a watermark (the
// ignore faculty's pixel twin), and keeps the residual foreground as a negative map.
//
// Nothing here is a vision model: every number is measured from the pixels, the OCR boxes and the
// text layers. Pure functions; the browser glue that renders pages and runs tesseract lives in
// index.html, so this module is CI'd in node.

import { dominant, toHex, segment } from './holodeck-screen-core.js';

export const EYES = [
  { id: 'textlayer', label: 'Text layer', cost: 'cheap', note: 'the PDF’s own embedded characters — exact, present only when the file carries them' },
  { id: 'ocr', label: 'Flat OCR', cost: 'medium', note: 'tesseract’s raw string over the rendered page — lands most text, carries no positions' },
  { id: 'model', label: '2D model', cost: 'heavy', note: 'the measured layout (image→HTML): text regions with positions, from the pixels and OCR boxes' },
];
export const EYE_IDS = EYES.map(e => e.id);
export const EYE = Object.fromEntries(EYES.map(e => [e.id, e]));

// ── sensing: what is likely needed, from the bytes and the trails ───────────────────────────────
// A SNIFF, not a decision: `kind` is the file's own signature (holodeck-media.js sniff → 'pdf' /
// png / …), `textLayer` is the cheap probe of whether a PDF carries its own characters. The base
// set is the cheapest eye likely to land; the trails may reorder or extend it, never remove it.
export function baseEyes({ kind = 'pdf', textLayer = false, image = false } = {}) {
  if (image) return ['model'];
  if (kind === 'pdf') return textLayer ? ['textlayer'] : ['model'];
  return ['model', 'ocr'];
}
export function senseEyes({ kind = 'pdf', textLayer = false, image = false, trails = null } = {}) {
  const base = baseEyes({ kind, textLayer, image });
  const key = image ? 'image' : kind;
  const t = trails && trails[key];
  if (!t || !t.byEye) return { eyes: base, basis: 'sniff', note: 'from the file’s own signature' + (kind === 'pdf' ? (textLayer ? ' (it carries a text layer)' : ' (no text layer — a scan)') : '') };
  // the trail's own line: the eye that was CHOSEN most often for this kind, if it landed more than
  // the base set did. Bias only — a trail with no gap keeps the base.
  const stat = e => t.byEye[e] ? { e, chosen: t.byEye[e].chosen || 0, chars: t.byEye[e].chars || 0, runs: t.byEye[e].runs || 0 } : null;
  const all = EYE_IDS.map(stat).filter(Boolean);
  if (!all.length) return { eyes: base, basis: 'sniff', note: 'no trail for this kind yet' };
  const best = all.slice().sort((a, b) => b.chosen - a.chosen || b.chars - a.chars)[0];
  const baseChars = all.filter(s => base.includes(s.e)).reduce((m, s) => Math.max(m, s.chars), 0);
  if (best && best.chosen > 0 && best.chars > baseChars * 1.2) {
    return { eyes: [best.e, ...base.filter(e => e !== best.e)], basis: 'trail', note: 'the trail says ' + EYE[best.e].label + ' has landed cleanest for ' + key + ' (' + best.chosen + ' of ' + best.runs + ' runs)' };
  }
  return { eyes: base, basis: 'sniff', note: 'the trail agrees with the sniff for ' + key + ' (' + all.map(s => s.e + ' ' + s.chosen).join(', ') + ')' };
}
// The escalation ladder: after the sensed set lands too little (below `floor` characters/page),
// the next eye is added — as needed, never all three at once. Returns null when there is no next.
export function escalate(run, trails = null) {
  const order = (trails && trails._order) || ['textlayer', 'ocr', 'model'];
  const ran = run.eyes || [];
  const next = order.filter(e => !ran.includes(e)).sort((a, b) => EYE_IDS.indexOf(a) - EYE_IDS.indexOf(b))[0];
  return next ? { eyes: [...ran, next], basis: 'escalate', note: 'the first pass landed ' + (run.chars || 0) + ' characters — adding ' + EYE[next].label + ' (as needed)' } : null;
}

// ── trails: append-only, per-kind, pheromone not policy ─────────────────────────────────────────
const TRAIL_KEY = 'hd:eye-trails';
function trailStore() {
  try { if (typeof localStorage !== 'undefined') return { load: () => JSON.parse(localStorage.getItem(TRAIL_KEY) || '{}') || {}, save: v => localStorage.setItem(TRAIL_KEY, JSON.stringify(v)) }; } catch (e) {}
  return { load: () => (globalThis.__hdEyeTrails || {}), save: v => { globalThis.__hdEyeTrails = v; } };
}
export function loadTrails() { return trailStore().load(); }
// record(perPage[{page, chosen, witnesses}], kind) → the updated ledger. Each run: every eye that
// was a witness gets a run + its character count; the chosen eye gets a `chosen`. Superseding, not
// edited: a new run adds to the counts.
export function recordTrail(kind, perPage, opts = {}) {
  const store = trailStore(); const all = store.load(); const t = all[kind] = all[kind] || { byEye: {} };
  const by = t.byEye; const seen = new Set();
  for (const p of perPage || []) {
    for (const w of p.witnesses || []) {
      const e = by[w.eye] = by[w.eye] || { runs: 0, chosen: 0, chars: 0 };
      if (!seen.has(w.eye + ':' + p.page)) { e.runs++; seen.add(w.eye + ':' + p.page); }
      e.chars += w.chars || 0;
      if (w.chosen) e.chosen++;
    }
  }
  t.runs = (t.runs || 0) + 1; t.updatedAt = new Date().toISOString(); if (opts.order) all._order = opts.order;
  store.save(all); return all;
}

// ── layers: the page as a stack — background / ink / wash / negative pixels ─────────────────────
// alpha(pixel) = its L1 distance from the page's own dominant colour, normalised to the page's own
// maximum, so a page with one dark mark and a page of grey text both use the whole 0..255 range.
// A flat component is a WASH (watermark candidate) when it is faint (mean alpha < watermarkAlpha)
// AND spans a large part of the page (extent ≥ watermarkExtent); otherwise strong components are
// ink. The NEGATIVE map is foreground alpha no ink or wash layer claims — the leftover, disclosed.
export const LAYER_CONST = { step: 8, tol: 24, watermarkAlpha: 90, watermarkExtent: 0.35, minArea: 60, foreground: 40 };
export function layerModel(img, opts = {}) {
  const o = Object.assign({}, LAYER_CONST, opts || {});
  const { width: W, height: H, data: d } = img;
  if (!W || !H || !d) return null;
  const bg = dominant(img, 0, 0, W, H);
  const A = new Int32Array(W * H); let maxd = 1;
  for (let i = 0; i < W * H; i++) { const p = i * 4; const dd = Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]); if (dd > maxd) maxd = dd; A[i] = dd; }
  const step = o.step, gw = Math.ceil(W / step), gh = Math.ceil(H / step);
  const alpha = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { let m = 0; for (let y = gy * step; y < Math.min(H, (gy + 1) * step); y++) for (let x = gx * step; x < Math.min(W, (gx + 1) * step); x++) { const v = A[y * W + x]; if (v > m) m = v; } alpha[gy * gw + gx] = Math.round(m / maxd * 255); }
  const seg = segment(img, o.tol);
  let bgComp = seg.comps[0]; for (const c of seg.comps) if (c.n > bgComp.n) bgComp = c;
  const layers = [];
  for (const c of seg.comps) {
    if (c.id === bgComp.id) continue;
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, area = bw * bh;
    if (c.n < o.minArea || bw < 6 || bh < 6) continue;
    let ma = 0, cnt = 0; for (let y = c.y0; y <= c.y1; y += 2) for (let x = c.x0; x <= c.x1; x += 2) { if (seg.label[y * W + x] === c.id) { ma += A[y * W + x]; cnt++; } }
    const alphaN = (cnt ? ma / cnt : 0) / maxd, extent = Math.max(bw / W, bh / H);
    const role = (alphaN * 255 < o.watermarkAlpha && extent >= o.watermarkExtent) ? 'wash' : 'ink';
    layers.push({ id: 'L' + c.id, role, region: [c.x0, c.y0, bw, bh], fill: +(c.n / area).toFixed(3), alpha: +alphaN.toFixed(3), extent: +extent.toFixed(3), color: toHex(c.color) });
  }
  const claimed = (gx, gy) => layers.some(L => { const [x, y, w, h] = L.region; return gx * step >= x - step && gx * step <= x + w + step && gy * step >= y - step && gy * step <= y + h + step; });
  const negative = new Uint8Array(gw * gh); let negCells = 0;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const i = gy * gw + gx; if (alpha[i] >= (o.foreground / 255) * 255 && !claimed(gx, gy)) { negative[i] = alpha[i]; negCells++; } }
  const wash = layers.filter(L => L.role === 'wash');
  return {
    background: toHex(bg), width: W, height: H, grid: { w: gw, h: gh, step }, alpha, negative,
    layers, ink: layers.filter(L => L.role === 'ink').length,
    watermark: wash.length ? { present: true, n: wash.length, regions: wash.map(L => L.region), meanAlpha: +(wash.reduce((s, L) => s + L.alpha, 0) / wash.length).toFixed(3) } : { present: false, n: 0, regions: [] },
    negativeCells: negCells,
  };
}

// ── reconciliation: fold whatever eyes ran into one reading, page by page ────────────────────────
// NEVER adds or removes a page: one output per input page, and a rescan replaces in place. Per page
// the CHOSEN eye is the one that landed the most characters (ties broken by `prefer`, so a
// positioned eye wins a tie); every other eye that ran stays a WITNESS with its own count, and the
// lines only it saw are recorded as DISAGREEMENTS — never appended, so nothing is duplicated.
export const RECONCILE_MARGIN = 0.15;
export function reconcilePages(pages, { eyes = EYE_IDS, prefer = ['model', 'textlayer', 'ocr'], margin = RECONCILE_MARGIN } = {}) {
  // Coverage counts any letter or number in any script (\p{L}\p{N}), never a Latin range: "how much
  // landed" is script-neutral, so a CJK or Arabic page is never scored as empty.
  const cov = t => (String(t || '').match(/[\p{L}\p{N}]/gu) || []).length;
  const lines = t => String(t || '').split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 2);
  const out = [];
  for (const p of pages) {
    const present = eyes.filter(e => p[e] && cov(p[e].text) >= 3);
    // The chosen eye lands the most, but a small lead does not let noise (OCR's extra characters)
    // beat a positioned eye: only an eye ahead by more than `margin` displaces one earlier in
    // `prefer`. So the 2D model wins a near-tie; a real gap still wins on its own.
    const most = present.reduce((m, e) => Math.max(m, cov(p[e].text)), 0);
    const near = present.filter(e => cov(p[e].text) >= most * (1 - margin));
    const chosen = near.slice().sort((a, b) => prefer.indexOf(a) - prefer.indexOf(b))[0]
      || present.slice().sort((a, b) => cov(p[b].text) - cov(p[a].text))[0] || null;
    const witnesses = present.map(e => ({ eye: e, chars: cov(p[e].text), chosen: e === chosen }));
    const disagreements = [];
    if (present.length > 1) {
      const sets = {}; present.forEach(e => sets[e] = new Set(lines(p[e].text).map(s => s.toLowerCase())));
      const chosenSet = sets[chosen] || new Set();
      present.filter(e => e !== chosen).forEach(e => { const only = [...sets[e]].filter(l => !chosenSet.has(l)).slice(0, 8); if (only.length) disagreements.push({ eye: e, only }); });
    }
    out.push({ page: p.page, chosen, text: chosen ? p[chosen].text : '', witnesses, disagreements, layers: p.layers ? { watermark: p.layers.watermark, ink: p.layers.ink, background: p.layers.background } : null });
  }
  const ledger = ['reconciled ' + out.length + ' page(s) over ' + eyes.length + ' eye(s) ['
    + eyes.map(e => EYE[e].label).join(' · ') + ']; the chosen eye is the one that landed the most text, one page in, one page out',
    ...out.map(p => 'page ' + p.page + ': ' + (p.chosen || 'nothing landed') + ' chosen (' + p.witnesses.map(w => w.eye + ' ' + w.chars + (w.chosen ? '✓' : '')).join(', ') + ')'
      + (p.disagreements.length ? ' — ' + p.disagreements.length + ' disagreement(s) kept as witnesses' : ''))];
  return { pages: out, text: out.map(p => p.text).join('\n\n'), eyes, ledger };
}

// A small summary for the surface: which eyes ran, which won each page, whether a wash was found.
export function summarize(reconciled, layers) {
  const byEye = {}; reconciled.pages.forEach(p => { if (p.chosen) byEye[p.chosen] = (byEye[p.chosen] || 0) + 1; });
  const disagree = reconciled.pages.reduce((n, p) => n + p.disagreements.length, 0);
  const wash = (layers || []).filter(l => l.watermark && l.watermark.present);
  return { eyes: reconciled.eyes, chosen: byEye, pages: reconciled.pages.length, disagreements: disagree, watermarkPages: wash.length };
}
