// holodeck-screen-core.js — the measured 2D model, pure and portable. Given decoded pixels
// ({width, height, data: RGBA}) and OCR word boxes, it returns the model between the pixels and
// any HTML: a tree of box/text/image/rule nodes, each with a region [x,y,w,h], a role, a parent
// and reading order, plus the page's design tokens and the regions no box or text explained.
//
// This is a faithful ESM port of eoreader7's screenshot-pipeline screen-core.cjs (the cv2html
// core) — same union-find flat-region segmentation, same box/rule/outline/image discovery, same
// text→paragraph→heading rules, same parent/reading-order assignment, same token measurement. It
// is vendored here so the fold can read an image IN THIS TAB with no binary and no server: the
// .cjs runs only where node + ffmpeg + the tesseract CLI exist; this runs on a canvas's pixels
// and tesseract.js's boxes, which every browser already has.
//
// Nothing here is a vision model: every number is measured from the pixels and the OCR boxes.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const h2 = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
const toHex = c => '#' + h2(c[0]) + h2(c[1]) + h2(c[2]);
const cdist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PILL = 9999;

function dominant(img, x0, y0, x1, y1) {
  x0 = clamp(Math.floor(x0), 0, img.width); x1 = clamp(Math.ceil(x1), 0, img.width);
  y0 = clamp(Math.floor(y0), 0, img.height); y1 = clamp(Math.ceil(y1), 0, img.height);
  if (x1 <= x0 || y1 <= y0) return [255, 255, 255];
  const sx = Math.max(1, Math.floor((x1 - x0) / 80)), sy = Math.max(1, Math.floor((y1 - y0) / 80));
  const d = img.data, W = img.width, hist = new Map();
  for (let y = y0; y < y1; y += sy) for (let x = x0; x < x1; x += sx) {
    const i = (y * W + x) * 4;
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    let e = hist.get(k); if (!e) { e = [0, 0, 0, 0]; hist.set(k, e); }
    e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2];
  }
  let best = null;
  for (const e of hist.values()) if (!best || e[0] > best[0]) best = e;
  if (!best) return [255, 255, 255];
  return [Math.round(best[1] / best[0]), Math.round(best[2] / best[0]), Math.round(best[3] / best[0])];
}

function meanColor(img, x0, y0, x1, y1) {
  x0 = clamp(Math.floor(x0), 0, img.width); x1 = clamp(Math.ceil(x1), 0, img.width);
  y0 = clamp(Math.floor(y0), 0, img.height); y1 = clamp(Math.ceil(y1), 0, img.height);
  if (x1 <= x0 || y1 <= y0) return [200, 200, 200];
  const sx = Math.max(1, Math.floor((x1 - x0) / 80)), sy = Math.max(1, Math.floor((y1 - y0) / 80));
  const d = img.data, W = img.width; let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y += sy) for (let x = x0; x < x1; x += sx) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function sampleInk(img, x0, y0, x1, y1) {
  const W = img.width, d = img.data;
  const bg = dominant(img, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  x0 = clamp(Math.floor(x0), 0, W); x1 = clamp(Math.ceil(x1), 0, W);
  y0 = clamp(Math.floor(y0), 0, img.height); y1 = clamp(Math.ceil(y1), 0, img.height);
  const sx = Math.max(1, Math.floor((x1 - x0) / 120)), sy = Math.max(1, Math.floor((y1 - y0) / 40));
  const arr = []; let max = 0;
  for (let y = y0; y < y1; y += sy) for (let x = x0; x < x1; x += sx) {
    const i = (y * W + x) * 4;
    const dd = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    arr.push([dd, d[i], d[i + 1], d[i + 2]]); if (dd > max) max = dd;
  }
  let fr = 0, fg = 0, fb = 0, fn = 0, ink = 0;
  for (const a of arr) { if (a[0] >= max * 0.5) ink++; if (a[0] >= max * 0.75) { fr += a[1]; fg += a[2]; fb += a[3]; fn++; } }
  const fgc = fn ? [fr / fn, fg / fn, fb / fn] : [0, 0, 0];
  return { bg, fg: fgc, contrast: max, inkRatio: arr.length ? ink / arr.length : 0 };
}

function segment(img, tol) {
  const W = img.width, H = img.height, d = img.data, N = W * H;
  const parent = new Int32Array(N);
  for (let i = 0; i < N; i++) parent[i] = i;
  function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4;
    if (x + 1 < W) { const q = p + 4; if (cdist([d[p], d[p + 1], d[p + 2]], [d[q], d[q + 1], d[q + 2]]) <= tol) { const a = find(i), b = find(i + 1); if (a !== b) parent[b] = a; } }
    if (y + 1 < H) { const q = p + W * 4; if (cdist([d[p], d[p + 1], d[p + 2]], [d[q], d[q + 1], d[q + 2]]) <= tol) { const a = find(i), b = find(i + W); if (a !== b) parent[b] = a; } }
  }
  const label = new Int32Array(N), rootId = new Int32Array(N).fill(-1), comps = [];
  for (let i = 0; i < N; i++) {
    const r = find(i); let id = rootId[r];
    if (id < 0) { id = comps.length; rootId[r] = id; comps.push({ id, x0: W, y0: H, x1: -1, y1: -1, n: 0, r: 0, g: 0, b: 0 }); }
    label[i] = id; const c = comps[id], x = i % W, y = (i / W) | 0;
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
    c.n++; c.r += d[i * 4]; c.g += d[i * 4 + 1]; c.b += d[i * 4 + 2];
  }
  for (const c of comps) c.color = [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)];
  return { W, H, label, comps };
}

function edgeScore(seg, c) {
  const W = seg.W, label = seg.label, id = c.id, bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  const cx = Math.max(1, Math.floor(bw * 0.15)), cy = Math.max(1, Math.floor(bh * 0.15));
  let hit = 0, tot = 0;
  for (let x = c.x0 + cx; x <= c.x1 - cx; x++) { tot += 2; if (label[c.y0 * W + x] === id) hit++; if (label[c.y1 * W + x] === id) hit++; }
  for (let y = c.y0 + cy; y <= c.y1 - cy; y++) { tot += 2; if (label[y * W + c.x0] === id) hit++; if (label[y * W + c.x1] === id) hit++; }
  return tot ? hit / tot : 0;
}

function cornerRadius(seg, c) {
  const W = seg.W, label = seg.label, id = c.id, bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  let a = 0; while (a < bw && label[c.y0 * W + c.x0 + a] !== id) a++;
  let b = 0; while (b < bh && label[(c.y0 + b) * W + c.x0] !== id) b++;
  const r = Math.max(a, b), half = Math.min(bw, bh) / 2;
  if (r < 3) return 0;
  if (r >= half - 1) return PILL;
  return r;
}

function findBoxes(seg, opts) {
  const comps = seg.comps;
  let bgComp = comps[0]; for (const c of comps) if (c.n > bgComp.n) bgComp = c;
  const boxes = [], rules = [], outlines = [], used = new Set([bgComp.id]);
  for (const c of comps) {
    if (c.id === bgComp.id) continue;
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, area = bw * bh;
    const mn = Math.min(bw, bh), mx = Math.max(bw, bh);
    if (mn <= 4 && mx >= 40 && c.n / area >= 0.85) { rules.push({ type: 'rule', x: c.x0, y: c.y0, w: bw, h: bh, color: c.color }); used.add(c.id); continue; }
    if (c.n < opts.minArea || bw < 12 || bh < 12) continue;
    const es = edgeScore(seg, c), fill = c.n / area, thick = c.n / (2 * (bw + bh));
    if (fill < 0.2 && thick <= 4.5) { if (es >= 0.9) { outlines.push({ x: c.x0, y: c.y0, w: bw, h: bh, color: c.color, thick: clamp(Math.round(thick), 1, 6), radius: cornerRadius(seg, c) }); used.add(c.id); } continue; }
    if (es < 0.8) continue;
    boxes.push({ type: 'box', x: c.x0, y: c.y0, w: bw, h: bh, color: c.color, radius: cornerRadius(seg, c) });
    used.add(c.id);
  }
  return { bgComp, boxes, rules, outlines, used };
}

function mergeOutlines(boxes, outlines) {
  for (const o of outlines) {
    let best = null;
    for (const b of boxes) { if (b.border) continue; const s = o.thick + 3;
      if (Math.abs(b.x - (o.x + o.thick)) <= s && Math.abs(b.y - (o.y + o.thick)) <= s && Math.abs((b.x + b.w) - (o.x + o.w - o.thick)) <= s && Math.abs((b.y + b.h) - (o.y + o.h - o.thick)) <= s) { if (!best || b.w * b.h > best.w * best.h) best = b; } }
    if (best) { best.x = o.x; best.y = o.y; best.w = o.w; best.h = o.h; best.border = { w: o.thick, color: o.color }; best.radius = Math.max(best.radius, o.radius); }
    else boxes.push({ type: 'box', x: o.x, y: o.y, w: o.w, h: o.h, color: o.color, transparent: true, radius: o.radius, border: { w: o.thick, color: o.color } });
  }
  return boxes;
}

function findImages(seg, usedArr, texts) {
  const W = seg.W, H = seg.H, label = seg.label, N = W * H, T = 8;
  const left = new Uint8Array(N);
  for (let i = 0; i < N; i++) left[i] = usedArr[label[i]] ? 0 : 1;
  for (const t of texts) { const x0 = Math.max(0, Math.floor(t.x0) - 2), x1 = Math.min(W - 1, Math.ceil(t.x1) + 2), y0 = Math.max(0, Math.floor(t.y0) - 2), y1 = Math.min(H - 1, Math.ceil(t.y1) + 2); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) left[y * W + x] = 0; }
  const tw = Math.ceil(W / T), th = Math.ceil(H / T), busy = new Uint8Array(tw * th);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) { let n = 0, tot = 0; for (let y = ty * T; y < Math.min(H, ty * T + T); y++) for (let x = tx * T; x < Math.min(W, tx * T + T); x++) { n += left[y * W + x]; tot++; } if (n >= tot * 0.1) busy[ty * tw + tx] = 1; }
  const dil = new Uint8Array(tw * th);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) if (busy[ty * tw + tx]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = tx + dx, ny = ty + dy; if (nx >= 0 && ny >= 0 && nx < tw && ny < th) dil[ny * tw + nx] = 1; }
  const seen = new Uint8Array(tw * th), rects = [];
  for (let s = 0; s < tw * th; s++) {
    if (!dil[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1; let x0 = W, y0 = H, x1 = -1, y1 = -1, cnt = 0;
    while (stack.length) {
      const t = stack.pop(), tx = t % tw, ty = (t / tw) | 0;
      if (busy[t]) for (let y = ty * T; y < Math.min(H, ty * T + T); y++) for (let x = tx * T; x < Math.min(W, tx * T + T); x++) if (left[y * W + x]) { cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]]) { if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue; const ni = ny * tw + nx; if (dil[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); } }
    }
    if (cnt < 40 || x1 < 0) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (Math.min(w, h) < 6) continue;
    if (Math.max(w, h) >= 8 * Math.min(w, h) && Math.min(w, h) < 12) continue;
    if (w * h > 2500 && cnt / (w * h) < 0.05) continue;
    rects.push({ x: x0, y: y0, w, h });
  }
  let merged = true;
  while (merged) { merged = false; outer: for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j], s = 2; if (a.x <= b.x + b.w + s && b.x <= a.x + a.w + s && a.y <= b.y + b.h + s && b.y <= a.y + a.h + s) { const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h); rects[i] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; rects.splice(j, 1); merged = true; break outer; } } }
  return rects.filter(r => r.w * r.h >= 100).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 150).map(r => ({ type: 'image', x: Math.max(0, r.x - 1), y: Math.max(0, r.y - 1), w: Math.min(W, r.w + 2), h: Math.min(H, r.h + 2) }));
}

function buildTexts(img, lines, opts) {
  const segs = [];
  for (const ln of lines) {
    let words = (ln.words || []).filter(w => w.text && w.text.trim() && w.bbox);
    if (!words.length && ln.text && ln.text.trim() && ln.bbox) words = [{ text: ln.text.trim(), bbox: ln.bbox, confidence: ln.conf }];
    if (!words.length) continue;
    words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const lh = Math.max.apply(null, words.map(w => w.bbox.y1 - w.bbox.y0));
    let cur = null;
    for (const w of words) { const b = w.bbox;
      if (cur && b.x0 - cur.x1 > Math.max(lh * 1.0, 14)) { segs.push(cur); cur = null; }
      if (!cur) cur = { words: [], x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, conf: 0, n: 0 };
      cur.words.push(w.text.trim()); cur.x0 = Math.min(cur.x0, b.x0); cur.y0 = Math.min(cur.y0, b.y0); cur.x1 = Math.max(cur.x1, b.x1); cur.y1 = Math.max(cur.y1, b.y1);
      cur.conf += (w.confidence != null ? w.confidence : (ln.conf != null ? ln.conf : 80)); cur.n++; }
    if (cur) segs.push(cur);
  }
  const out = [];
  for (const s of segs) {
    s.text = s.words.join(' '); const conf = s.conf / s.n;
    if (!/[A-Za-z0-9\u00C0-\uFFFF]/.test(s.text)) continue;
    if (conf < opts.minConf) continue;
    if (s.text.length <= 2 && conf < 80) continue;
    const h = s.y1 - s.y0, w = s.x1 - s.x0; if (h < 5 || w < 4) continue;
    const ink = sampleInk(img, s.x0, s.y0, s.x1 + 1, s.y1 + 1);
    if (ink.contrast < 45) continue;
    s.hasAsc = /[A-Z0-9bdfhklt\u00C0-\u00DD]/.test(s.text);
    const hasDesc = /[gjpqy,;()\[\]{}]/.test(s.text);
    const ext = (s.hasAsc ? 0.74 : 0.52) + (hasDesc ? 0.21 : 0);
    s.em = clamp(h / ext, 8, 240);
    s.color = ink.fg; s.bg = ink.bg; s.bold = ink.inkRatio > 0.26;
    out.push(s);
  }
  return out;
}

function makePara(seg) { return { type: 'text', lines: [seg], em: seg.em, color: seg.color, bold: seg.bold }; }

function canJoin(p, s) {
  const last = p.lines[p.lines.length - 1], em = p.em;
  if (Math.abs(s.em - em) / em > 0.12) return false;
  if (cdist(p.color, s.color) > 120) return false;
  const gap = s.y0 - last.y1; if (gap < -0.25 * em || gap > 1.0 * em) return false;
  if (!(s.x0 < last.x1 && s.x1 > last.x0)) return false;
  const first = p.lines[0];
  const leftOK = Math.abs(s.x0 - first.x0) <= 0.6 * em;
  const cOK = Math.abs((s.x0 + s.x1) / 2 - (last.x0 + last.x1) / 2) <= 0.8 * em;
  const rOK = Math.abs(s.x1 - last.x1) <= 0.6 * em && p.lines.length > 1;
  return leftOK || cOK || rOK;
}

function finalizePara(p) {
  const L = p.lines, em = p.em, n = L.length;
  const base = l => l.y0 + (l.hasAsc ? 0.74 : 0.52) * em;
  let pitch = em * 1.25;
  if (n > 1) pitch = clamp((base(L[n - 1]) - base(L[0])) / (n - 1), em * 1.0, em * 2.4);
  p.lineH = pitch;
  const baseFromTop = (pitch - 1.117 * em) / 2 + 0.905 * em;
  const x0 = Math.min.apply(null, L.map(l => l.x0)), x1 = Math.max.apply(null, L.map(l => l.x1));
  p.x = x0 - 0.04 * em; p.w = x1 - x0 + 0.08 * em; p.y = base(L[0]) - baseFromTop; p.h = pitch * n;
  p.align = 'left';
  if (n > 1) {
    const lefts = L.map(l => l.x0), rights = L.map(l => l.x1), cs = L.map(l => (l.x0 + l.x1) / 2);
    const sp = a => Math.max.apply(null, a) - Math.min.apply(null, a);
    if (sp(lefts) <= 0.5 * em) p.align = 'left';
    else if (sp(rights) <= 0.5 * em) p.align = 'right';
    else if (sp(cs) <= 0.8 * em) p.align = 'center';
  }
}

/** The model, from decoded pixels and OCR lines. `img` = { width, height, data: Uint8ClampedArray }.
 *  `lines` = [{ text, conf, bbox:{x0,y0,x1,y1}, words:[{text,confidence,bbox}] }]. */
export function buildScreenModel(img, lines, opts = {}) {
  const o = Object.assign({ tol: 10, minArea: 500, minConf: 45, dpr: 1, ratio: 1, images: true }, opts || {});
  const W = img.width, H = img.height;
  const seg = segment(img, o.tol);
  const bf = findBoxes(seg, o);
  let boxes = mergeOutlines(bf.boxes, bf.outlines);
  boxes.sort((a, b) => b.w * b.h - a.w * a.h); boxes = boxes.slice(0, 400);
  const texts = buildTexts(img, lines || [], o);
  const usedArr = new Uint8Array(Math.max(1, seg.comps.length)); bf.used.forEach(id => { usedArr[id] = 1; });
  const imgs = o.images ? findImages(seg, usedArr, texts) : [];
  for (const im of imgs) im.color = meanColor(img, im.x, im.y, im.x + im.w, im.y + im.h);

  const root = { type: 'root', x: 0, y: 0, w: W, h: H, color: bf.bgComp.color, children: [] };
  boxes.forEach(b => { b.children = []; });
  const bySmall = boxes.slice().sort((a, b) => a.w * a.h - b.w * b.h);
  function parentOf(cx, cy, minArea) { for (const b of bySmall) { if (b.w * b.h <= minArea) continue; if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return b; } return root; }
  for (const b of boxes) parentOf(b.x + b.w / 2, b.y + b.h / 2, b.w * b.h).children.push(b);
  for (const r of bf.rules) parentOf(r.x + r.w / 2, r.y + r.h / 2, 0).children.push(r);
  for (const im of imgs) parentOf(im.x + im.w / 2, im.y + im.h / 2, 0).children.push(im);

  const byParent = new Map();
  for (const s of texts) { const p = parentOf((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0); if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(s); }
  const paras = [];
  for (const [p, list] of byParent) {
    list.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0); const ps = [];
    for (const s of list) { let joined = false; for (let i = ps.length - 1; i >= 0; i--) { if (canJoin(ps[i], s)) { ps[i].lines.push(s); joined = true; break; } } if (!joined) ps.push(makePara(s)); }
    for (const pp of ps) { finalizePara(pp); p.children.push(pp); paras.push(pp); }
  }
  const single = paras.filter(p => p.lines.length === 1).map(p => p.em).sort((a, b) => a - b);
  const med = single.length ? single[Math.floor(single.length / 2)] : 16;
  let h1Used = false;
  paras.slice().sort((a, b) => b.em - a.em).forEach(p => { p.tag = 'p';
    if (p.lines.length > 2) return;
    if (p.em >= 1.7 * med && !h1Used) { p.tag = 'h1'; h1Used = true; } else if (p.em >= 1.35 * med) p.tag = 'h2'; else if (p.em >= 1.15 * med && p.bold) p.tag = 'h3'; });

  (function walk(node, parentColor) {
    for (const c of node.children || []) {
      if (c.type === 'box') {
        const kids = c.children;
        if (kids.length === 1 && kids[0].type === 'text' && kids[0].lines.length === 1 && c.h >= 22 && c.h <= 90 && c.w <= 480 && kids[0].w / c.w >= 0.3 && (c.border || cdist(c.color, parentColor) >= 40)) c.button = true;
        else if (c.w >= 0.9 * W && c.y <= 2 && c.h <= 200 && kids.length >= 2) c.tag = 'header';
        else if (c.w >= 0.9 * W && c.h >= 120) c.tag = 'section';
        walk(c, c.transparent ? parentColor : c.color);
      }
    }
  })(root, root.color);

  const rank = { box: 0, rule: 1, image: 2, text: 3 };
  (function sortKids(n) { if (!n.children) return; n.children.sort((a, b) => rank[a.type] - rank[b.type] || (b.w * b.h - a.w * a.h)); n.children.forEach(sortKids); })(root);
  const flat = []; (function flatten(n) { for (const c of n.children || []) { flat.push(c); flatten(c); } })(root);
  return { width: W, height: H, unit: o.ratio / o.dpr, root, flat, seg, stats: { boxes: flat.filter(n => n.type === 'box').length, texts: paras.length, images: imgs.length, rules: bf.rules.length } };
}

// ---------- the sidecar-shaped projections (same shapes screen-sidecar.js produces) ----------
const roleOf = (n) => n.type === 'root' ? 'page' : n.type === 'box' ? (n.button ? 'button' : n.tag ?? 'box') : n.type === 'text' ? n.tag ?? 'p' : n.type;
const textOf = (n) => n.type === 'text' ? n.lines.map(l => l.text).join(' ') : n.type === 'box' && n.button ? n.children[0].lines[0].text : null;

export function elementsOf(model, ratio = 1) {
  const out = []; const R = v => Math.round(v * ratio); let n = 0;
  (function walk(node, parent) {
    for (const c of node.children || []) {
      const el = { id: 'e' + (n++), parent: parent ? parent.id : 'e' + (n - 1) };
      el.type = c.type; el.role = roleOf(c); el.region = [R(c.x), R(c.y), R(c.w), R(c.h)];
      const t = textOf(c); if (t != null) el.text = t;
      if (c.color) el.color = toHex(c.color);
      if (c.type === 'text') { el.em = Math.round(c.em * model.unit * 10) / 10; el.bold = !!c.bold; el.align = c.align; el.lines = c.lines.length; }
      if (c.type === 'box') { if (c.radius) el.radius = c.radius >= PILL ? 'pill' : Math.round(c.radius * model.unit * 10) / 10; if (c.border) el.border = { width: Math.round(c.border.w * model.unit * 10) / 10, color: toHex(c.border.color) }; if (c.transparent) el.transparent = true; }
      out.push(el); walk(c, el);
    }
  })(model.root, null);
  if (out.length) out[0].parent = null;
  return out;
}

export function tokensOf(model) {
  const u = model.unit, root = model.root, all = model.flat;
  const boxes = all.filter(n => n.type === 'box'), texts = all.filter(n => n.type === 'text');
  const pageArea = model.width * model.height;
  const tokens = { viewport: { width: Math.round(model.width * u * 10) / 10, height: Math.round(model.height * u * 10) / 10 }, background: { hex: toHex(root.color), basis: "the page's largest flat region" } };
  const tally = pairs => { const m = new Map(); for (const [k, w] of pairs) m.set(k, (m.get(k) ?? 0) + w); return [...m.entries()].map(([k, w]) => ({ value: k, weight: w })).sort((a, b) => b.weight - a.weight); };
  const spread = c => Math.max(...c) - Math.min(...c);
  const rgbOf = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fills = tally(boxes.filter(b => !b.transparent && toHex(b.color) !== tokens.background.hex).map(b => [toHex(b.color), b.w * b.h]));
  tokens.surfaces = fills.slice(0, 4).map(f => ({ hex: f.value, share: Math.round((f.weight / pageArea) * 1000) / 1000, n: boxes.filter(b => !b.transparent && toHex(b.color) === f.value).length }));
  const cards = boxes.filter(b => !b.button && !b.transparent && !b.tag && b.children.some(c => c.type === 'text') && toHex(b.color) !== tokens.background.hex);
  const cardFill = tally(cards.map(b => [toHex(b.color), 1]));
  tokens.surface = cardFill.length ? { hex: cardFill[0].value, n: cardFill[0].weight, basis: 'the fill most text-holding panels share' } : null;
  const buttons = boxes.filter(b => b.button);
  if (buttons.length) { const top = tally(buttons.map(b => [toHex(b.color), 1]))[0]; const one = buttons.find(b => toHex(b.color) === top.value); tokens.accent = { hex: top.value, spread: spread(one.color), n: top.weight, basis: 'the fill most buttons share', ink: toHex(one.children[0].color) }; }
  else if (fills.length) { const top = [...fills].sort((a, b) => spread(rgbOf(b.value)) - spread(rgbOf(a.value)))[0]; tokens.accent = { hex: top.value, spread: spread(rgbOf(top.value)), n: 1, basis: 'no button on the page: its most saturated fill' }; }
  else tokens.accent = null;
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const onPage = texts.filter(t => t.lines.length && t.lines[0].bg && dist(t.lines[0].bg, root.color) < 60);
  const ink = tally((onPage.length ? onPage : texts).map(t => [toHex(t.color), t.lines.reduce((s, l) => s + l.text.length, 0)]));
  tokens.ink = ink.length ? { hex: ink[0].value, n: (onPage.length ? onPage : texts).filter(t => toHex(t.color) === ink[0].value).length, basis: 'the colour that sets the most text on the page background' } : null;
  const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const rad = list => { const v = list.map(b => b.radius).filter(r => r > 0 && r < PILL).map(r => r * u); return v.length ? { px: Math.round(median(v) * 10) / 10, n: v.length, pills: list.filter(b => b.radius >= PILL).length } : (list.some(b => b.radius >= PILL) ? { px: null, n: 0, pills: list.filter(b => b.radius >= PILL).length } : null); };
  tokens.radius = { box: rad(boxes.filter(b => !b.button)), button: rad(buttons) };
  if (texts.length) {
    const em = list => list.length ? Math.round(median(list.map(t => t.em * u)) * 10) / 10 : null;
    const byTag = tag => texts.filter(t => t.tag === tag), body = texts.filter(t => t.tag === 'p');
    const multi = texts.filter(t => t.lines.length > 1 && t.lineH && t.em);
    tokens.type = { body: body.length ? { px: em(body), n: body.length } : null, h1: byTag('h1').length ? { px: em(byTag('h1')), n: byTag('h1').length } : null, h2: byTag('h2').length ? { px: em(byTag('h2')), n: byTag('h2').length } : null, h3: byTag('h3').length ? { px: em(byTag('h3')), n: byTag('h3').length } : null,
      boldShare: Math.round((texts.filter(t => t.bold).length / texts.length) * 100) / 100,
      lineHeight: multi.length ? { ratio: Math.round(median(multi.map(t => t.lineH / t.em)) * 100) / 100, n: multi.length } : null,
      scale: tally(texts.map(t => [String(Math.round(t.em * u)), 1])).map(s => ({ px: Number(s.value), n: s.weight })).sort((a, b) => a.px - b.px),
      basis: 'text height over the ascender/descender extent of its glyphs; fonts are not identified' };
  } else tokens.type = null;
  const vgaps = [], hgaps = [], padX = [], padY = [];
  (function walk(n) {
    const kids = (n.children ?? []).filter(c => c.type !== 'rule').sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 1; i < kids.length; i++) { const a = kids[i - 1], b = kids[i]; const vg = b.y - (a.y + a.h), hg = b.x - (a.x + a.w); const sameRow = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5 * Math.min(a.h, b.h); if (sameRow) { if (hg > 0) hgaps.push(hg * u); } else if (vg > 0) vgaps.push(vg * u); }
    if (n.type === 'box' && !n.button) { const t = (n.children ?? []).filter(c => c.type !== 'rule'); if (t.length && t.some(c => c.type === 'text' || c.type === 'box')) { padX.push((Math.min(...t.map(c => c.x)) - n.x) * u); padY.push((Math.min(...t.map(c => c.y)) - n.y) * u); } }
    for (const c of n.children ?? []) walk(c);
  })(root);
  const med = xs => (xs.length ? { px: Math.round(median(xs) * 10) / 10, n: xs.length } : null);
  tokens.spacing = { vertical: med(vgaps), horizontal: med(hgaps), padX: med(padX), padY: med(padY) };
  const bp = buttons.map(b => ({ x: (b.children[0].x - b.x) * u, y: (b.children[0].y - b.y) * u }));
  tokens.buttonPadding = bp.length ? { x: Math.round(median(bp.map(b => b.x)) * 10) / 10, y: Math.round(median(bp.map(b => b.y)) * 10) / 10, n: bp.length } : null;
  const bw = boxes.map(b => b.border).filter(Boolean);
  tokens.border = bw.length ? { width: Math.round(median(bw.map(b => b.w)) * u * 10) / 10, color: toHex(bw[0].color), n: bw.length } : null;
  return tokens;
}

export function gapsOf(read, model, ratio = 1) {
  const gaps = [];
  const R = r => [Math.round(r[0] * ratio), Math.round(r[1] * ratio), Math.round(r[2] * ratio), Math.round(r[3] * ratio)];
  (read.lines || []).forEach(l => { if (l.conf != null && l.conf < 45 && l.bbox) gaps.push({ kind: 'ocr_line_not_landed', text: l.text, conf: l.conf, region: R([l.bbox.x0, l.bbox.y0, l.bbox.x1 - l.bbox.x0, l.bbox.y1 - l.bbox.y0]), because: 'mean word confidence ' + l.conf + ' is under the 45 floor' }); });
  const imgs = model.flat.filter(n => n.type === 'image');
  if (imgs.length) gaps.push({ kind: 'image_regions_unread', n: imgs.length, regions: imgs.map(im => R([im.x, im.y, im.w, im.h])), because: 'a region the boxes and text do not explain: only its mean colour was measured; what it depicts was not read (no vision model ran)' });
  return gaps;
}

/** A short reading text: what the page is made of, in plain words — the same shape the pipeline's
 *  readingTextOf returns, built here from the model + tokens + elements (no sidecar needed). */
export function readingTextOf(sidecar, opts = {}) {
  const { width: W, height: H, tokens, elements } = sidecar;
  const t = tokens || {};
  const roles = {}; (elements || []).forEach(e => roles[e.role] = (roles[e.role] || 0) + 1);
  const head = elements ? elements.filter(e => e.role === 'h1' || e.role === 'h2' || e.role === 'h3').slice(0, 20) : [];
  const L = [];
  L.push('Looking at the image (' + W + '×' + H + 'px): read mechanically from its pixels and the text OCR found — no vision model. Regions are pixel rectangles [x,y,w,h] in the original image.');
  if (t.background) { const cols = [t.background.hex, ...(t.surfaces || []).map(s => s.hex)].filter(Boolean); L.push('Colours: background ' + t.background.hex + '; surfaces ' + cols.slice(1).join(', ') + '; text ' + ((t.ink && t.ink.hex) || '—') + (t.accent ? '; accent ' + t.accent.hex : '') + '.'); }
  L.push('Structure: ' + Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([r, n]) => n + ' ' + r).join(', ') + '.');
  if (head.length) L.push('Headings: ' + head.map(h => '“' + (h.text || '') + '”').join(', ') + '.');
  if (t.type) L.push('Type: body ' + (t.type.body ? t.type.body.px + 'px' : '—') + (t.type.h1 ? ', h1 ' + t.type.h1.px + 'px' : '') + (t.type.h2 ? ', h2 ' + t.type.h2.px + 'px' : '') + '; ' + Math.round((t.type.boldShare || 0) * 100) + '% bold.');
  L.push('This is what the image says it is, not a description of any picture in it.');
  return L.join('\n');
}

export function ledgerLinesOf(sidecar, { image = 'image' } = {}) {
  const name = (sidecar && sidecar.source && sidecar.source.name) || image;
  const els = (sidecar && sidecar.elements) || [];
  const lines = []; const seen = new Set();
  for (const e of els) {
    const text = (e.text || '').trim(); if (!text) continue;
    const re = /\b[\p{Lu}][\p{L}\p{N}'\u2019\u2010-]*(?:[\s\u2010-]+[\p{Lu}][\p{L}\p{N}'\u2019\u2010-]*)*/gu; let m;
    while ((m = re.exec(text))) {
      const run = m[0]; const key = run.toLowerCase(); if (seen.has(key) || run.length < 2) continue; seen.add(key);
      lines.push({ schema: 'EOTObservation@1', role: 'visual-box', id: name + ':' + e.id, at: { image: name, region: e.region }, label: run, kind: e.role || null,
        witnesses: ['screen-core(flat-region segmentation of the pixels + OCR)'], verify: 'crop `region` from `image`, re-run OCR, confirm the text; re-measure the fill' });
    }
  }
  return lines;
}

export function htmlOf(sidecar, opts = {}) { return ''; } // HTML rendering is not needed in the reading path; the pipeline's screen-sidecar owns it.

export { PILL, toHex };
