// Alhazen — the optics pipeline.
//
// Named for Ibn al-Haytham (Alhazen, 965–1040), who argued that seeing is not
// something the eye emits but something the light *imprints* — that vision is
// measured, not willed. This is the reading pipeline for documents: it takes a
// page's pixels, makes them legible, finds the keys and values on them, reads a
// grid's structure, and proposes rules about what it is seeing — every step
// measured, disclosed, and reversible.
//
// Pure and dependency-free. Loads as ESM (`import { ... } from './alhazen.js'`),
// CommonJS (`require`), or a classic `<script>` (exposes `window.Alhazen`).
//
// THE DISCIPLINE (shared with the rest of the fold): a reading is a hypothesis.
// Keys are not assumed correct; a value is reduced to its FORMAT and the value's
// content is thrown away; nothing here decides meaning on its own.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Alhazen = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  // ── optics: make a faint page legible ─────────────────────────────────────
  // Grayscale + Otsu binarize, in place, on RGBA pixel data. Gated to pages
  // that read as a document (a light background), so a dark/colourful UI
  // screenshot is left alone.
  function binarizeData(data, w, h, opts) {
    const n = w * h;
    if (!n || !data) return data;
    const gate = !opts || opts.gate !== false; // default: leave dark/UI alone
    const hist = new Array(256).fill(0);
    const gray = new Uint8ClampedArray(n);
    let sumL = 0;
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const g = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
      gray[j] = g; hist[g]++; sumL += g;
    }
    if (gate && sumL / n < 120) return data; // dark / UI: leave it
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, max = 0, thr = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
      sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > max) { max = v; thr = t; }
    }
    for (let i = 0, j = 0; j < n; i += 4, j++) { const v = gray[j] > thr ? 255 : 0; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
    return data;
  }
  function binarizeCanvas(cv) {
    try {
      const cx = cv.getContext("2d", { willReadFrequently: true });
      const im = cx.getImageData(0, 0, cv.width, cv.height);
      binarizeData(im.data, cv.width, cv.height);
      cx.putImageData(im, 0, 0);
    } catch (e) {}
    return cv;
  }

  // ── the value's FORMAT (its shape; the content is discarded) ─────────────
  function valueFormat(v) {
    const s = String(v == null ? "" : v).trim();
    if (!s) return "empty";
    if (/^[$€£]\s?\d[\d,]*\.?\d{0,2}$/.test(s)) return "currency";
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(s) || /^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(s) || /^(0[1-9]|1[0-2])[0-2]\d(19|20)\d{2}$/.test(s)) return "date";
    if (/^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(s)) return "time";
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return "email";
    if (/^\+?1?[\s.\-()]*\d{3}[\s.\-()]*\d{3}[\s.\-]*\d{4}$/.test(s)) return "phone";
    if (/^(yes|no|true|false|s[ií])$/i.test(s)) return "choice";
    if (/\d/.test(s) && /^[A-Za-z0-9][A-Za-z0-9\-\/.]{3,}$/.test(s) && /[A-Za-z]/.test(s)) return "identifier";
    if (/^\d+$/.test(s)) return "integer";
    if (/^\d[\d,]*\.\d+$/.test(s)) return "decimal";
    if (/^[A-Za-z][A-Za-z.'\-]+( [A-Za-z][A-Za-z.'\-]+){1,3}$/.test(s)) return "name";
    return s.length > 60 ? "free-text" : "text";
  }

  // ── read a form: the label a page prints and the value beside it ─────────
  // colon, or two-or-more spaces, or " - ". Lowercase labels accepted.
  function extractFormFields(text) {
    const out = [];
    for (const raw of String(text || "").split("\n")) {
      const line = raw.replace(/\s+$/, "").trim();
      if (line.length < 4) continue;
      let label, value;
      const sep = line.indexOf(":");
      if (sep > 1 && sep <= 40) { label = line.slice(0, sep); value = line.slice(sep + 1); }
      else {
        const m = /^([A-Za-z][A-Za-z ./()&#,\-]{1,40}?)(?:\s{2,}|\s+[-–—]\s+)(\S.*)$/.exec(line);
        if (!m) continue;
        label = m[1]; value = m[2];
      }
      label = label.replace(/[\s.:\-–—]+$/, "").trim();
      value = value.trim();
      const words = label.split(/\s+/).filter(Boolean);
      if (label.length < 2 || words.length > 6 || /\d/.test(label) || !/[A-Za-z]/.test(label)) continue;
      if (!value || /^[\W_]*$/.test(value)) continue;
      out.push({ label, value: value.slice(0, 220) });
      if (out.length >= 60) break;
    }
    return out;
  }
  function snake(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function titleLine(text) { return (String(text || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "").slice(0, 60); }

  // ── a grid ("nested") form: a header row defines columns; rows fill them ─
  function readGridFromElements(els) {
    const items = (els || []).filter((e) => e && e.text && e.region && String(e.text).trim())
      .map((e) => ({ t: String(e.text).trim(), x: e.region[0], y: e.region[1], h: e.region[3] }));
    if (items.length < 6) return { columns: [], records: [] };
    items.sort((a, b) => a.y - b.y);
    const rows = [];
    for (const it of items) {
      const cy = it.y + it.h / 2, r = rows[rows.length - 1];
      if (r && Math.abs(cy - r.cy) < Math.max(9, it.h * 0.6)) { r.items.push(it); r.cy = (r.cy * (r.items.length - 1) + cy) / r.items.length; }
      else rows.push({ cy, items: [it] });
    }
    if (rows.length < 2) return { columns: [], records: [] };
    const head = rows[0].items.slice().sort((a, b) => a.x - b.x);
    const colX = head.map((h) => h.x);
    const records = [];
    for (const r of rows.slice(1)) {
      const rec = {};
      for (const it of r.items) {
        let bi = 0, bd = 1e9;
        colX.forEach((cx, i) => { const d = Math.abs(cx - it.x); if (d < bd) { bd = d; bi = i; } });
        const key = head[bi] ? head[bi].t : ("col" + (bi + 1));
        rec[key] = rec[key] ? rec[key] + " " + it.t : it.t;
      }
      if (Object.keys(rec).length >= 2) records.push(rec);
    }
    return { columns: head.map((h) => h.t), records };
  }
  function readGridFromText(lines) {
    let header = null; const records = [];
    for (const line of lines) {
      const cells = line.trim().split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean);
      if (cells.length < 3) continue;
      if (!header && cells.every((c) => /[A-Za-z]/.test(c) && c.length <= 28)) { header = cells; continue; }
      if (header && cells.length >= Math.max(2, header.length - 1)) {
        const rec = {}; for (let i = 0; i < header.length; i++) rec[header[i]] = cells[i] || ""; records.push(rec);
      }
    }
    return { columns: header || [], records };
  }

  // ── the tuple of everything + nesting ────────────────────────────────────
  function inventTuples(text, elements) {
    const lines = String(text || "").split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
    const tuples = [];
    for (const line of lines) {
      const f = extractFormFields(line)[0];
      if (f) { const fmt = valueFormat(f.value); tuples.push({ label: f.label, value: f.value, canonical: snake(f.label), format: fmt, type: fmt }); }
    }
    let grid = elements && elements.length ? readGridFromElements(elements) : { columns: [], records: [] };
    if (!grid.records.length) grid = readGridFromText(lines);
    const cellLines = lines.filter((l) => l.trim().split(/\s{2,}|\t/).filter(Boolean).length >= 3);
    const nested = grid.records.length > 0 || cellLines.length >= 3;
    const kind = nested ? "table" : (tuples.length >= 3 ? "form" : "prose");
    const columns = grid.columns.length ? grid.columns : (nested ? cellLines[0].trim().split(/\s{2,}|\t/).filter(Boolean) : []);
    return { nested, kind, tuples, columns, records: grid.records, header: grid.columns };
  }

  // ── a local pass: propose rules about what it is seeing ──────────────────
  // Deterministic and offline; a local model may replace or supplement it.
  function structuralProposer(text, elements) {
    const inv = inventTuples(text, elements);
    const rules = [];
    for (const t of inv.tuples) rules.push({ type: "key", label: t.label, canonical: t.canonical, valueType: t.format, value: t.value });
    for (const r of (inv.records || [])) rules.push({ type: "record", record: r });
    if (inv.nested) {
      for (const c of inv.columns) rules.push({ type: "key", label: c, canonical: snake(c), valueType: "column" });
      rules.push({ type: "struct", structure: "table", nested: true, columns: inv.columns });
    }
    return { kindName: titleLine(text) || "unknown", structure: inv.kind, nested: inv.nested, rules };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEE ANYTHING — the domain-agnostic optical read.
  //
  // The document functions above assume a light page with dark ink. A reader
  // that only sees documents is blind to the rest of the world. These functions
  // make NO assumption about what the image is: they measure luminance, colour,
  // background and structure, cut the image into regions, name what the whole
  // looks like (sceneKind), and disclose what they could NOT read (gaps). Every
  // classification here is a PROPOSAL — falsifiable, reversible — never a fact.
  // ═══════════════════════════════════════════════════════════════════════════
  const _lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const _sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const _hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("");

  // luminance + colour + sharpness, measured over the whole frame
  function frameStats(data, w, h) {
    const n = w * h; let sum = 0, sumSq = 0, sat = 0, dark = 0, light = 0;
    let gx = 0, gxp = 0; const seen = new Set();
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const L = _lum(r, g, b); sum += L; sumSq += L * L; sat += _sat(r, g, b);
      if (L < 60) dark++; if (L > 200) light++;
      seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      const x = j % w; if (x) gx += Math.abs(L - gxp); gxp = L;
    }
    const mean = sum / n, std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    return { mean: +mean.toFixed(1), std: +std.toFixed(1), saturation: +(sat / n).toFixed(3),
             darkShare: +(dark / n).toFixed(3), lightShare: +(light / n).toFixed(3),
             colors: seen.size, edge: +(gx / n).toFixed(1) };
  }

  // the frame's palette: the k most-covered colours (quantized to 4 bits/channel)
  function palette(data, w, h, k) {
    k = k || 8; const n = w * h, m = new Map();
    for (let i = 0, j = 0; j < n; i += 16, j += 4) { // sample every 4th pixel for speed
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      m.set(key, (m.get(key) || 0) + 1);
    }
    const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, c]) => ({
      hex: _hex(((key >> 8) & 15) * 17, ((key >> 4) & 15) * 17, (key & 15) * 17), share: +(c / tot).toFixed(3),
    }));
  }

  // the frame's background: the dominant colour of the border band
  function backgroundOf(data, w, h) {
    const m = new Map(), band = Math.max(2, Math.round(Math.min(w, h) * 0.03));
    const add = (i) => { const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4); const e = m.get(key) || [0, 0, 0, 0]; e[0] += data[i]; e[1] += data[i + 1]; e[2] += data[i + 2]; e[3]++; m.set(key, e); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (x < band || x >= w - band || y < band || y >= h - band) add((y * w + x) * 4); }
    if (!m.size) return { hex: "#ffffff", lum: 255 };
    const [key, e] = [...m.entries()].sort((a, b) => b[1][3] - a[1][3])[0];
    const r = e[0] / e[3], g = e[1] / e[3], b = e[2] / e[3];
    return { hex: _hex(r, g, b), lum: +_lum(r, g, b).toFixed(1) };
  }

  // the ink mask: pixels that differ from the background by more than a threshold
  function inkMask(data, w, h, eps) {
    const bg = backgroundOf(data, w, h), thr = eps == null ? 45 : eps;
    const mask = new Uint8Array(w * h);
    let count = 0;
    for (let i = 0, j = 0; j < w * h; i += 4, j++) {
      const d = Math.abs(data[i] - parseHex(bg.hex, 0)) + Math.abs(data[i + 1] - parseHex(bg.hex, 1)) + Math.abs(data[i + 2] - parseHex(bg.hex, 2));
      if (d > thr) { mask[j] = 1; count++; }
    }
    return { mask, background: bg, share: +(count / (w * h)).toFixed(4) };
  }
  function parseHex(hex, k) { const v = parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16); return isNaN(v) ? 0 : v; }

  // connected components of the ink mask (4-neighbour, iterative); boxes + area
  function segmentMask(mask, w, h, minArea) {
    const lab = new Int32Array(w * h).fill(-1), comps = [], st = [];
    for (let s = 0; s < w * h; s++) {
      if (!mask[s] || lab[s] >= 0) continue;
      const id = comps.length, c = { id, minx: w, maxx: 0, miny: h, maxy: 0, area: 0 };
      st.push(s); lab[s] = id;
      while (st.length) {
        const p = st.pop(), x = p % w, y = (p - x) / w, L = mask;
        c.area++;
        if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x; if (y < c.miny) c.miny = y; if (y > c.maxy) c.maxy = y;
        if (x > 0 && mask[p - 1] && lab[p - 1] < 0) { lab[p - 1] = id; st.push(p - 1); }
        if (x < w - 1 && mask[p + 1] && lab[p + 1] < 0) { lab[p + 1] = id; st.push(p + 1); }
        if (y > 0 && mask[p - w] && lab[p - w] < 0) { lab[p - w] = id; st.push(p - w); }
        if (y < h - 1 && mask[p + w] && lab[p + w] < 0) { lab[p + w] = id; st.push(p + w); }
      }
      if (c.area >= minArea) { c.region = [c.minx, c.miny, c.maxx - c.minx + 1, c.maxy - c.miny + 1]; comps.push(c); }
    }
    return comps;
  }
  // a component's kind, from its own geometry (never a model's guess)
  function classifyRegion(c) {
    const [x, y, rw, rh] = c.region, area = c.area, fill = area / (rw * rh), ar = rw / rh;
    if (rh <= 3 && rw >= 14) return "rule";
    if (rh >= 5 && rh <= 46 && rw >= 6 && ar >= 0.6 && fill < 0.85) return "text";
    if (fill >= 0.5 && rw >= 40 && rh >= 40) return "figure";
    if (fill >= 0.6) return "block";
    return "mark";
  }
  // text lines by horizontal projection (robust where per-letter components are not)
  function textBands(mask, w, h) {
    const rowc = new Int32Array(h);
    for (let p = 0; p < w * h; p++) if (mask[p]) rowc[(p - (p % w)) / w]++;
    const bands = []; let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && rowc[y] > Math.max(2, w * 0.004);
      if (on && start < 0) start = y;
      if ((!on) && start >= 0) { if (y - start >= 4) bands.push({ y: start, h: y - start, rows: y - start }); start = -1; }
    }
    return bands;
  }

  // classify the whole frame — the sceneKind is a PROPOSAL, not a fact
  function classifyScene(fs, bg, inkShare, pal, regionCounts) {
    const colors = fs.colors || pal.filter((p) => p.share > 0.02).length;
    const colorful = fs.saturation > 0.22;
    if (inkShare < 0.003 && fs.std < 10) return "blank";
    if (colorful && colors > 16 && fs.std > 25) return "photograph";   // many distinct tones, no flat page
    if (bg.lum <= 110 && fs.lightShare < 0.5) return "screenshot";     // dark UI
    if (bg.lum > 190 && colors <= 8 && regionCounts.rule >= 10 && regionCounts.text < 10) return "chart";
    if (bg.lum > 190 && colors <= 8 && regionCounts.rule >= 6 && regionCounts.text < 6) return "diagram";
    if (bg.lum > 170 && colors <= 16) return "document";
    if (regionCounts.text >= 1) return "document";
    return "unknown";
  }

  // THE READ: any image → a disclosed optical record
  function readImage(data, w, h, opts) {
    opts = opts || {};
    const fs = frameStats(data, w, h);
    const pal = palette(data, w, h, opts.palette || 8);
    const ink = inkMask(data, w, h, opts.epsilon);
    const minArea = opts.minArea || Math.max(12, Math.round(w * h / 20000));
    const comps = segmentMask(ink.mask, w, h, minArea);
    const regions = comps.map((c) => { const k = classifyRegion(c); return { region: c.region, area: c.area, kind: k, fill: +(c.area / (c.region[2] * c.region[3])).toFixed(2) }; });
    const bands = textBands(ink.mask, w, h);
    const counts = { rule: 0, text: 0, figure: 0, block: 0, mark: 0 };
    for (const r of regions) counts[r.kind] = (counts[r.kind] || 0) + 1;
    if (bands.length > counts.text) counts.text = bands.length;
    let sceneKind = classifyScene(fs, ink.background, ink.share, pal, counts);
    // the skin/face read is a PRIOR and is OFF by default — the reader learns
    // what the subject is from the stream (learnSalience), not from a skin rule.
    const faceRead = (opts && opts.useSkinPrior) ? detectFaces(data, w, h) : { faces: [], skinShare: 0 };
    if (faceRead.faces.length && faceRead.skinShare > 0.03) sceneKind = "person";
    const gaps = [];
    if (sceneKind === "photograph") gaps.push({ kind: "no_vision_model", because: "a photograph has no text to read; only colour, luminance and structure were measured" });
    if (sceneKind === "person") gaps.push({ kind: "face_read", n: faceRead.faces.length, because: "a face was located from skin tone + shape; its identity is not read (no face model)" });
    if (counts.figure) gaps.push({ kind: "figure_unread", n: counts.figure, because: "figure regions were located but their content was not read (no vision model)" });
    if (!counts.text && sceneKind !== "blank" && sceneKind !== "photograph" && sceneKind !== "person") gaps.push({ kind: "no_text_found", because: "no text-like regions were found" });
    return {
      schema: "AlhazenSee@1", width: w, height: h,
      luminance: { mean: fs.mean, std: fs.std, contrast: fs.std, edge: fs.edge },
      saturation: fs.saturation, background: ink.background.hex, backgroundLum: ink.background.lum,
      polarity: ink.background.lum > 128 ? "dark-on-light" : "light-on-dark",
      inkShare: ink.share, palette: pal,
      sceneKind, faces: faceRead.faces, skinShare: faceRead.skinShare, regionCounts: counts, textLines: bands.length, regions, gaps,
      standing: "measured; sceneKind is a proposal, not a fact",
    };
  }

  // ── FIELD PRIORS — the ABILITY (pure, no IO) to learn a label→format lexicon
  // from observed (label, value) pairs and apply it. A project that vendors
  // Alhazen owns the LOG (append-only) and the folded PRIORS; the mechanism lives
  // here. Nothing is saved by Alhazen itself — observe()/fold()/apply() are the
  // whole capability; persistence and provenance are the caller's.
  function createFieldPriors(seed) {
    const by = (seed && seed.by) || {};
    const observe = (label, value, fmt) => { const c = snake(label); if (!c) return; const e = by[c] || (by[c] = { n: 0, formats: {} }); e.n++; const f = fmt || valueFormat(value); e.formats[f] = (e.formats[f] || 0) + 1; };
    const majority = (e) => Object.entries(e.formats).sort((a, b) => b[1] - a[1])[0];
    const typeOf = (label) => { const e = by[snake(label)]; if (!e) return null; const [format, k] = majority(e); return { format, n: e.n, confident: k / e.n >= 0.6 }; };
    const fold = () => { const lexicon = {}; for (const [k, e] of Object.entries(by)) { const [format, c] = majority(e); lexicon[k] = { format, n: e.n, confident: c / e.n >= 0.6 }; } return { schema: "FieldPriors@1", observations: Object.values(by).reduce((s, e) => s + e.n, 0), labels: Object.keys(lexicon).length, lexicon }; };
    const apply = (fields) => (fields || []).map((f) => { const t = typeOf(f.label); if (t && t.confident && (!f.type || f.type === "text")) return { ...f, type: t.format, learned: true }; return f; });
    return { schema: "FieldPriors@1", by, observe, typeOf, fold, apply };
  }

  // ── GET BETTER: propose rules from a reading + its ground truth ──────────
  // `truth` is a template of what the page truly holds:
  //   { kind, fields:[{label, value, box}], columns?, records? }
  // Returns rules the reader can apply to its NEXT look — the content of a
  // value never crosses; only the label's canonical name and the value's FORMAT.
  function learnFrom(read, truth) {
    const t = truth || {}, rules = [];
    const seen = new Map();
    for (const f of (t.fields || [])) {
      if (!f || !f.label) continue;
      const canonical = snake(f.label);
      if (!canonical) continue;
      const valueType = f.format && f.format !== "empty" ? f.format : valueFormat(f.value);
      const e = seen.get(canonical);
      if (e) { e.n++; if (e.valueType === "text" && valueType !== "text") e.valueType = valueType; }
      else { seen.set(canonical, { n: 1, valueType }); }
    }
    for (const [canonical, e] of seen) rules.push({ type: "key", canonical, valueType: e.valueType, witness: "ground-truth", n: e.n });
    if (t.kind) rules.push({ type: "kind", name: t.kind, witness: "ground-truth" });
    if (t.records && t.records.length) rules.push({ type: "struct", structure: "table", columns: t.columns || Object.keys(t.records[0]), nested: true, witness: "ground-truth" });
    return rules;
  }

  // apply learned rules to a look: use the label lexicon to bind pairs whose
  // format the plain pass would miss (no colon, no 2-space run)
  function applyRules(text, elements, rules) {
    const keyTypes = new Map();
    for (const r of rules || []) if (r.type === "key" && r.canonical) keyTypes.set(r.canonical, r.valueType);
    const base = inventTuples(text, elements);
    const tuples = [...base.tuples];
    const have = new Set(tuples.map((x) => x.canonical));
    const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      for (const [canonical, valueType] of keyTypes) {
        if (have.has(canonical)) continue;
        const words = canonical.split("_");
        const re = new RegExp("^\\s*" + words.map((w) => w.slice(0, 4)).join("[a-z]*[ .]*") + "[a-z]*[ .:]*[\\-–—]?\\s+(\\S.*)$", "i");
        const m = re.exec(line);
        if (m && m[1] && m[1].trim().length) {
          tuples.push({ label: line.slice(0, m.index + m[0].length - m[1].length).trim().replace(/[.:\-–—\s]+$/, ""), value: m[1].trim(), canonical, format: valueType, type: valueType, via: "learned-rule" });
          have.add(canonical); break;
        }
      }
    }
    return { ...base, tuples };
  }

  // a read's agreement with truth — the number the improvement loop climbs
  function scoreRead(read, truth) {
    const t = truth || {}, pred = (read && read.tuples) || [];
    const key = (canonical, value) => canonical + "=" + String(value).trim().toLowerCase();
    const P = new Set(pred.map((p) => key(p.canonical, p.value)));
    const G = (t.fields || []).map((f) => key(snake(f.label), f.value));
    const hit = G.filter((g) => P.has(g)).length;
    const fmtOk = pred.filter((p) => { const f = (t.fields || []).find((x) => snake(x.label) === p.canonical); return f && valueFormat(f.value) === p.format; }).length;
    return {
      gt: G.length, pred: pred.length,
      recall: G.length ? +(hit / G.length).toFixed(3) : null,
      precision: pred.length ? +(hit / pred.length).toFixed(3) : null,
      formatAccuracy: pred.length ? +(fmtOk / pred.length).toFixed(3) : null,
    };
  }

  // the append-only rule ledger — how the reader remembers what it learned
  function createRuleLedger() {
    const rules = [];
    return {
      schema: "AlhazenRules@1", rules,
      add(rs) { for (const r of rs || []) if (!rules.some((x) => x.type === r.type && x.canonical === r.canonical)) rules.push({ ...r, at: rules.length }); return this; },
      falsify(canonical, reason) { const r = rules.find((x) => x.canonical === canonical); if (r) { r.falsified = reason || true; r.at = rules.length; } return this; },
      active() { return rules.filter((r) => !r.falsified); },
      keyTypes() { const m = new Map(); for (const r of this.active()) if (r.type === "key") m.set(r.canonical, r.valueType); return m; },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANY EYES — a reader that sniffs what it is, opens the right eyes, and
  // reconciles them into one reading with its dissent named.
  //
  // A single eye sees one thing well and is blind to the rest. So: an EYE is a
  // strategy over one channel (pixels, a text layer, a depth buffer, frames); a
  // SNIFF decides which eyes a thing deserves; the eyes run; RECONCILE reports
  // where they AGREE, where they give MEANINGFUL DELTAS (a disagreement that
  // changes the read), and what stays contested. Nothing here decides meaning
  // alone — a reading survives only the contention of the others.
  // ═══════════════════════════════════════════════════════════════════════════

  const rectArea = (r) => (r ? Math.max(0, r[2]) * Math.max(0, r[3]) : 0);
  function overlapFrac(a, b) {
    if (!a || !b) return 0;
    const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const min = Math.min(rectArea(a), rectArea(b));
    return min > 0 ? (ix * iy) / min : 0;
  }
  // two region-kinds are "the same class" when they'd agree about what it is
  const roleClass = (k) => {
    const s = String(k || "");
    if (/wash|colour|color|figure|photo|image|chart|highlight/.test(s)) return "ink-of-colour";
    if (/text|ink|line|mark|block|rule/.test(s)) return "ink-of-form";
    return s || "unknown";
  };

  // ── layers: extract the z-planes OF a 2D image (paper/ink/wash/faint/figure)
  function layersOf(data, w, h, opts) {
    opts = opts || {};
    const bg = backgroundOf(data, w, h);
    const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
    const n = w * h, faintT = opts.faint == null ? 40 : opts.faint, inkT = opts.ink == null ? 120 : opts.ink;
    const roll = { paper: null, faint: null, wash: null, ink: null };
    const acc = {};
    const bump = (k, x, y, r, g, b, dist) => {
      const a = acc[k] || (acc[k] = { n: 0, x0: w, y0: h, x1: 0, y1: 0, r: 0, g: 0, b: 0, op: 0 });
      a.n++; if (x < a.x0) a.x0 = x; if (x > a.x1) a.x1 = x; if (y < a.y0) a.y0 = y; if (y > a.y1) a.y1 = y; a.r += r; a.g += g; a.b += b;
      a.op += Math.min(1, dist / 255);
    };
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const r = data[i], g = data[i + 1], b = data[i + 2], x = j % w, y = (j - x) / w;
      const L = _lum(r, g, b), d = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB), sat = _sat(r, g, b);
      let k;
      if (d < faintT) k = "paper";
      else if (sat > 0.25) k = "wash";
      else if (d > inkT) k = "ink";
      else k = "faint";
      bump(k, x, y, r, g, b, d);
    }
    const order = ["paper", "faint", "wash", "figure", "ink"];
    const layers = order.filter((k) => acc[k] && acc[k].n).map((k) => {
      const a = acc[k];
      return { role: k, share: +(a.n / n).toFixed(4), region: [a.x0, a.y0, a.x1 - a.x0 + 1, a.y1 - a.y0 + 1],
               color: _hex(a.r / a.n, a.g / a.n, a.b / a.n), opacity: +(a.op / a.n).toFixed(3) };
    });
    return { schema: "AlhazenLayers@1", width: w, height: h, background: bg.hex, layers, zOrder: order,
             note: "a 2D image read as stacked z-planes; z is a role ordering, not a measured depth" };
  }

  // ── 3D: a depth buffer → a surface read; or a point cloud → a mesh summary
  function read3D(input) {
    const w = input.width, h = input.height, depth = input.depth;
    if (!depth || !w || !h) return { schema: "Alhazen3D@1", gap: "needs_depth", because: "no depth buffer supplied" };
    const n = w * h; let min = Infinity, max = -Infinity, sum = 0;
    for (let i = 0; i < n; i++) { const z = depth[i]; if (!isFinite(z)) continue; if (z < min) min = z; if (z > max) max = z; sum += z; }
    const mean = sum / n; let sq = 0;
    for (let i = 0; i < n; i++) { const z = depth[i]; if (isFinite(z)) sq += (z - mean) * (z - mean); }
    const std = Math.sqrt(sq / n), range = max - min || 1;
    // slope + facing histogram (which way the surface turns), from finite diffs
    let slopeSum = 0, slopeMax = 0, up = 0, tilt = 0, steep = 0;
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      const i = y * w + x, dx = depth[i + 1] - depth[i], dy = depth[i + w] - depth[i], s = Math.sqrt(dx * dx + dy * dy);
      slopeSum += s; if (s > slopeMax) slopeMax = s;
      if (s < range * 0.02) up++; else if (s < range * 0.15) tilt++; else steep++;
    }
    const cells = (w - 1) * (h - 1);
    // relief segments: quantize depth into bands, report each band's region
    const B = 4, segs = [];
    for (let b = 0; b < B; b++) {
      const lo = min + (range * b) / B, hi = min + (range * (b + 1)) / B;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, c = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const z = depth[y * w + x]; if (z >= lo && (b === B - 1 ? z <= hi : z < hi)) { c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (c) segs.push({ band: b, z: [+lo.toFixed(3), +hi.toFixed(3)], share: +(c / n).toFixed(3), region: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] });
    }
    return { schema: "Alhazen3D@1", width: w, height: h,
             depth: { min: +min.toFixed(3), max: +max.toFixed(3), mean: +mean.toFixed(3), std: +std.toFixed(3), range: +range.toFixed(3) },
             relief: { meanSlope: +(slopeSum / cells).toFixed(3), maxSlope: +slopeMax.toFixed(3), bumpiness: +(std / range).toFixed(3) },
             facing: { flat: +(up / (up + tilt + steep || 1)).toFixed(3), tilt: +(tilt / (up + tilt + steep || 1)).toFixed(3), steep: +(steep / (up + tilt + steep || 1)).toFixed(3) },
             segments: segs,
             claims: segs.map((s, i) => ({ key: "depth_band_" + i, kind: "region", region: s.region, value: s.z.join("..") })) };
  }

  // a point cloud or mesh (ASCII "x y z" lines, .ply, .obj) → bounds/centroid
  function readPointCloud(text) {
    const pts = [];
    for (const line of String(text || "").split("\n")) {
      const t = line.trim(); if (!t || t[0] === "#" || /^(ply|end_header|solid|f|vn|vt|element|property|format|comment)/i.test(t)) continue;
      const m = t.match(/^(?:v\s+)?(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)/);
      if (m) pts.push([+m[1], +m[2], +m[3]]);
    }
    if (!pts.length) return { schema: "AlhazenMesh@1", gap: "no_points" };
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], c = [0, 0, 0];
    for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; c[k] += p[k]; }
    const centroid = c.map((v) => +(v / pts.length).toFixed(3));
    const size = mx.map((v, k) => +(v - mn[k]).toFixed(3));
    const vol = size[0] * size[1] * size[2] || 1;
    return { schema: "AlhazenMesh@1", points: pts.length, bounds: { min: mn, max: mx }, size, centroid,
             density: +(pts.length / vol).toFixed(4), dimensional: size.filter((s) => s > 1e-6).length };
  }

  // ── lift 2D layers into a 3D scene graph (z from the layer's role) ───────
  const LAYER_Z = { paper: 0, faint: 0.25, wash: 0.5, figure: 0.75, ink: 1 };
  function liftTo3D(layers) {
    const ls = (layers && layers.layers) || layers || [];
    const planes = ls.map((l) => ({ role: l.role, z: LAYER_Z[l.role] != null ? LAYER_Z[l.role] : 0.5, region: l.region, color: l.color, share: l.share, opacity: l.opacity }));
    planes.sort((a, b) => a.z - b.z);
    return { schema: "AlhazenScene@1", source: "2D lifted to a z-stack", planes,
             standing: "z is a role-derived ordering, not measured depth — a hypothesis about layering" };
  }

  // ── the eye registry — one channel each, honest about what it cannot see ──
  function rasterEye(input, opts) {
    const r = readImage(input.data, input.width, input.height, opts);
    const claims = (r.regions || []).map((g, i) => ({ key: "region_" + i, kind: g.kind, region: g.region }));
    claims.push({ key: "sceneKind", kind: "meta", value: r.sceneKind, region: [0, 0, r.width, r.height] });
    return { kind: "raster", basis: "pixels + geometry", coverage: r.regions.length ? 1 : 0.2, data: r, claims };
  }
  function layerEye(input, opts) {
    const l = layersOf(input.data, input.width, input.height, opts);
    const claims = l.layers.map((x, i) => ({ key: "layer_" + i, kind: x.role, region: x.region }));
    return { kind: "layer", basis: "pixel decomposition into z-planes", coverage: l.layers.length ? 0.8 : 0, data: l, claims };
  }
  function textEye(input) {
    const t = input.text || "";
    if (!t) return { kind: "text", basis: "ocr / text layer", coverage: 0, gap: "needs_ocr",
                     because: "no text channel was supplied; this eye needs an OCR or embedded-text source", claims: [] };
    const tuples = extractFormFields(t).map((f) => ({ ...f, format: valueFormat(f.value), canonical: snake(f.label) }));
    return { kind: "text", basis: "ocr / text channel", coverage: tuples.length ? 1 : 0, data: { tuples },
             claims: tuples.map((f) => ({ key: f.canonical, kind: "value", value: f.value, format: f.format, region: null })) };
  }
  function gridEye(input) {
    const els = input.elements || [];
    const g = readGridFromElements(els);
    return { kind: "grid", basis: "cell geometry", coverage: g.records.length ? 1 : 0, data: g,
             claims: (g.records || []).map((r, i) => ({ key: "row_" + i, kind: "record", value: JSON.stringify(r) })) };
  }
  function depthEye(input) { const d = read3D(input); return { kind: "depth3d", basis: "depth buffer", coverage: d.segments ? 1 : 0, data: d, claims: d.claims || [] }; }
  function temporalEye(input) {
    const f = input.frames || [];
    if (f.length < 2) return { kind: "temporal3d", basis: "frames (x,y,t)", coverage: 0, gap: "needs_frames", claims: [] };
    let moved = 0, tot = 0, w = f[0].width, h = f[0].height;
    for (let k = 1; k < f.length; k++) { const a = f[k - 1].data, b = f[k].data; for (let i = 0; i < w * h; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); tot++; if (d > 60) moved++; } }
    return { kind: "temporal3d", basis: "frame differencing (x,y,t)", coverage: 1, data: { frames: f.length, motion: +(moved / (tot || 1)).toFixed(3) },
             claims: [{ key: "motion", kind: "meta", value: +(moved / (tot || 1)).toFixed(3) }] };
  }
  const EYES = { raster: rasterEye, layer: layerEye, text: textEye, grid: gridEye, depth3d: depthEye, temporal3d: temporalEye };

  // ── sniff: what IS this, and which eyes does it deserve? ─────────────────
  function sniffMagic(u8) {
    const b = u8; if (!b || !b.length) return null;
    if (b[0] === 0x89 && b[1] === 0x50) return "raster";
    if (b[0] === 0xff && b[1] === 0xd8) return "raster";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "raster";
    if (b[0] === 0x42 && b[1] === 0x4d) return "raster";
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video";
    if (b.length > 8 && String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp") return "video";
    return null;
  }
  function sniffText(s) {
    const t = String(s).slice(0, 300).replace(/^\uFEFF/, "").trim();
    if (/^(ply\b|solid\s|#?\s*obj\b)/i.test(t)) return "mesh";
    if (/<(!doctype\s+html|html|div|p|body|table)\b/i.test(t)) return "html";
    if (/^\s*-?[\d.]+\s+[,\s]\s*-?[\d.]+\s+[,\s]\s*-?[\d.]+/m.test(t)) return "pointcloud";
    if (/^[\[{]/.test(t)) return "json";
    return "text";
  }
  function sniff(input) {
    if (!input) return { kind: "unknown", why: "no input" };
    if (input.left && input.right) return { kind: "stereo", why: "a stereo pair (two views)", eyes: ["depth", "raster"] };
    if (input.depth && input.width && input.height) return { kind: "depth", why: "a depth buffer was supplied", eyes: ["depth3d", "layer"] };
    if (input.frames && input.frames.length) return { kind: "video", why: `${input.frames.length} frames (x,y,t)`, eyes: ["fourd", "salience", "depth", "raster", "layer"] };
    if (input.data && input.width && input.height) {
      const fs = frameStats(input.data, input.width, input.height), bg = backgroundOf(input.data, input.width, input.height);
      const colorful = fs.saturation > 0.22, lightDoc = bg.lum > 170 && fs.saturation < 0.2;
      if (colorful) return { kind: "photo", why: "high colour saturation, few text-like cues", eyes: ["raster", "layer", "depth"] };
      if (lightDoc) return { kind: "document", why: "light background, low colour: a page", eyes: ["raster", "layer", "depth", "text", "grid"] };
      return { kind: "raster", why: "pixels, ambiguous scene", eyes: ["raster", "layer", "depth", "text"] };
    }
    if (input.bytes && input.bytes.length) { const k = sniffMagic(input.bytes) || "unknown"; const eyes = k === "pdf" ? ["text", "grid", "raster"] : k === "video" ? ["temporal3d", "raster"] : k === "raster" ? ["raster", "layer"] : ["raster"]; return { kind: k, why: "magic bytes", eyes }; }
    if (typeof input === "string" || input.text) { const s = typeof input === "string" ? input : input.text; const k = sniffText(s); const eyes = k === "mesh" || k === "pointcloud" ? ["depth3d"] : k === "html" ? ["text", "grid"] : k === "json" ? ["text"] : ["text", "grid"]; return { kind: k, why: "text structure", eyes }; }
    return { kind: "unknown", why: "unrecognised input shape" };
  }

  // ── reconcile: agreement, meaningful deltas, and the named dissent ───────
  function reconcile(readings) {
    const claims = [];
    for (const r of readings || []) for (const c of (r.claims || [])) claims.push({ ...c, eye: r.eye });
    const byKey = new Map();
    for (const c of claims) { if (c.region === undefined) c.region = null; if (!byKey.has(c.key)) byKey.set(c.key, []); byKey.get(c.key).push(c); }
    const agreement = [], deltas = [];
    for (const [key, cs] of byKey) {
      const eyes = [...new Set(cs.map((c) => c.eye))];
      const vals = [...new Set(cs.filter((c) => c.value != null).map((c) => c.value))];
      if (eyes.length > 1 && vals.length > 1) deltas.push({ kind: "value_conflict", key, eyes, values: vals, magnitude: vals.length });
      else if (eyes.length > 1) agreement.push({ key, eyes, value: cs.find((c) => c.value != null)?.value ?? null, region: cs[0].region });
    }
    // region deltas: different eyes, overlapping regions, disagreeing roles.
    // Aggregated per (eye-pair, role-class pair) so the dissent is MEANINGFUL —
    // one named disagreement with its count and worst case, never 200 echoes.
    // A FIELD claim (background/paper, a full-frame meta claim) is not a
    // competitor about a sub-region; it is excluded rather than faked into a
    // conflict with everything it contains.
    const frame = (readings || []).reduce((m, r) => Math.max(m, (r.data && r.data.width && r.data.height) ? r.data.width * r.data.height : 0), 0);
    const isField = (c) => !c.region || c.kind === "meta" || c.kind === "paper" || (frame && c.region[2] * c.region[3] > 0.5 * frame);
    const rc = new Map();
    for (let i = 0; i < claims.length; i++) for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.eye === b.eye || !a.region || !b.region || isField(a) || isField(b)) continue;
      const ov = overlapFrac(a.region, b.region);
      if (ov <= 0.45 || roleClass(a.kind) === roleClass(b.kind)) continue;
      const ca = roleClass(a.kind), cb = roleClass(b.kind);
      const key = [a.eye, b.eye].sort().join("|") + ":" + [ca, cb].sort().join(">");
      const e = rc.get(key) || { kind: "role_conflict", eyes: [a.eye, b.eye].sort(), classes: [ca, cb], n: 0, maxOverlap: 0, region: a.region };
      e.n++; if (ov > e.maxOverlap) { e.maxOverlap = ov; e.region = a.region; }
      rc.set(key, e);
    }
    for (const e of rc.values()) deltas.push({ ...e, magnitude: +e.maxOverlap.toFixed(2) });
    const gaps = (readings || []).filter((r) => r.gap).map((r) => ({ eye: r.eye, gap: r.gap, because: r.because || null }));
    const coverage = (readings || []).reduce((m, r) => Math.max(m, r.coverage || 0), 0);
    return { schema: "AlhazenReconcile@1", eyes: (readings || []).map((r) => r.eye), claims: claims.length,
             agreement, deltas, gaps, coverage: +coverage.toFixed(3), converged: deltas.length === 0,
             dissent: deltas.length ? deltas.map((d) => `${d.eyes.join(" vs ")} disagree (${d.kind}${d.key ? ":" + d.key : ""}${d.classes ? " " + d.classes.join("~") : ""}${d.n ? " ×" + d.n : ""}${d.magnitude != null ? " mag " + d.magnitude : ""})`) : [] };
  }

  // ── LOOK: sniff → open the right eyes → reconcile into one reading ───────
  function look(input, opts) {
    opts = opts || {};
    input = prepare(input);
    const s = opts.sniff || sniff(input);
    const names = opts.eyes || s.eyes || ["raster"];
    const readings = [];
    for (const nm of names) { const eye = EYES[nm]; if (!eye) continue; try { readings.push({ ...eye(input, opts), eye: nm }); } catch (e) { readings.push({ eye: nm, error: String(e), claims: [], coverage: 0 }); } }
    const rec = reconcile(readings);
    const out = { schema: "AlhazenLook@1", sniff: s, eyes: readings.map((r) => r.eye), readings, reconciled: rec };
    if (readings.some((r) => r.kind === "layer")) out.scene3d = liftTo3D(readings.find((r) => r.kind === "layer").data);
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4D — things moving through time. A single frame is a slice; a sequence is a
  // world-line. These functions accumulate a decaying ACTIVITY TRAIL over time
  // (what moved and where it persisted), track the motion centroid, estimate
  // MOTION BLUR from the smear between frames, and render the long exposure so
  // the trails themselves become an image another eye can read.
  // ═══════════════════════════════════════════════════════════════════════════
  function trailToRGBA(trail, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < w * h; j++) { const v = Math.round(255 * Math.min(1, trail[j])); out[j * 4] = 255; out[j * 4 + 1] = v; out[j * 4 + 2] = Math.max(0, 140 - v); out[j * 4 + 3] = 255; }
    return out;
  }
  // track OBJECTS (not just motion) across frames of a static-camera scene:
  // foreground = pixels that differ from the frame's own background; each blob
  // carries a learned identity signature (its colour) and a size. Association
  // combines a scale-invariant POSITION gate with an APPEARANCE distance, so the
  // reader discovers which blob is which — it is never told how many there are,
  // what colours they are, or that size may change. Identity survives growth,
  // shrinkage and occlusion (coast + re-identify).
  function trackObjects(frames, opts) {
    opts = opts || {};
    const w = frames[0].width, h = frames[0].height;
    const maxOcc = opts.maxOcclusion == null ? Math.max(6, Math.round(frames.length * 0.6)) : opts.maxOcclusion;
    const baseR = opts.radius || Math.max(10, Math.hypot(w, h) * 0.09);
    const minArea = opts.minArea || Math.max(4, Math.round(w * h / 60000));
    const fgT = opts.fgThreshold == null ? 110 : opts.fgThreshold;
    const tracks = [], events = [];
    const inRect = (r, x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
    const boxAround = (x, y, area, m) => { const s = Math.sqrt(Math.max(1, area)); return [x - s / 2 - (m || 0), y - s / 2 - (m || 0), s + (m || 0) * 2, s + (m || 0) * 2]; };
    const applyMatch = (t, c, k) => {
      const dx = c.cx - t.x, dy = c.cy - t.y; t.vx = t.vx == null ? dx : 0.6 * t.vx + 0.4 * dx; t.vy = t.vy == null ? dy : 0.6 * t.vy + 0.4 * dy;
      t.x = c.cx; t.y = c.cy; t.last = k; t._m = true; t._own = c;
      t.color = t.color ? _mix(t.color, c.color, 0.5) : c.color.slice();
      t.areas.push(c.area); t.path.push([+c.cx.toFixed(1), +c.cy.toFixed(1)]);
      if (t.hidden) { t.occlusions.push({ from: t.hiddenSince, to: k, frames: k - t.hiddenSince, entry: t.hiddenAt, exit: [+c.cx.toFixed(1), +c.cy.toFixed(1)] }); t.hidden = false; t.reappeared = true; t.hiddenCount = 0; }
    };
    const newTrack = (c, k, parents) => { const t = { id: tracks.length, path: [[+c.cx.toFixed(1), +c.cy.toFixed(1)]], areas: [c.area], x: c.cx, y: c.cy, vx: 0, vy: 0, color: c.color.slice(), start: k, last: k, hidden: false, hiddenCount: 0, occlusions: [], reappeared: false, _m: true, _own: c }; if (parents) t.parents = parents; tracks.push(t); return t; };
    for (let k = 0; k < frames.length; k++) {
      const d = frames[k].data, bg = backgroundOf(d, w, h);
      const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
      const fg = new Uint8Array(w * h);
      for (let j = 0; j < w * h; j++) { const i = j * 4; if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) > fgT) fg[j] = 1; }
      const comps = segmentMask(fg, w, h, minArea).map((c) => ({ cx: c.region[0] + c.region[2] / 2, cy: c.region[1] + c.region[3] / 2, area: c.area, region: c.region, color: _meanColor(d, w, c.region), used: false }));
      // movingOnly: mark each blob by how much of it CHANGED since the last frame,
      // so a static background (doorframes, furniture) is not tracked as an object
      let mm = null;
      if (opts.movingOnly && k > 0) { const p = frames[k - 1].data; mm = new Uint8Array(w * h); for (let j = 0; j < w * h; j++) { const i = j * 4; if (Math.abs(d[i] - p[i]) + Math.abs(d[i + 1] - p[i + 1]) + Math.abs(d[i + 2] - p[i + 2]) > fgT) mm[j] = 1; } }
      for (const c of comps) { if (mm) { let m = 0; const [x, y, ww, hh] = c.region; for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) if (mm[yy * w + xx]) m++; c.moving = m / Math.max(1, c.area); } else c.moving = 1; }
      for (const t of tracks) { if (t.dead) continue; t.px = t.x + (t.vx || 0); t.py = t.y + (t.vy || 0); t._m = false; t._own = null; }
      for (const c of comps) {
        c.insiders = tracks.filter((t) => !t.dead && inRect(c.region, t.px, t.py));
        // HOST: an insider big enough to EXPLAIN the blob (a static object a
        // smaller one is passing BEHIND). With a host the entrants are occluded;
        // without one, two bodies sharing a blob have MERGED.
        c.host = c.insiders.find((t) => (t.areas[t.areas.length - 1] || 0) >= 0.7 * c.area) || null;
      }
      // (a) collisions → merge, or occlusion behind a host
      for (const c of comps) {
        if (c.insiders.length < 2 || (opts.movingOnly && c.moving < 0.2)) continue;
        c.used = true;
        if (c.host) { applyMatch(c.host, c, k); }
        else {
          const ids = c.insiders.map((t) => t.id);
          events.push({ kind: "collision", frame: k, tracks: ids, at: [+c.cx.toFixed(1), +c.cy.toFixed(1)] });
          const comp = newTrack(c, k, ids);
          events.push({ kind: "merge", frame: k, into: comp.id, tracks: ids, at: [+c.cx.toFixed(1), +c.cy.toFixed(1)] });
          for (const t of c.insiders) { t.dead = true; t.mergedInto = comp.id; t.end = k; }
        }
      }
      // (b) a track whose last blob has come apart into 2+ blobs → split
      for (const t of tracks) {
        if (t.dead || t._m || t._own) continue;
        const box = boxAround(t.px, t.py, t.areas[t.areas.length - 1] || 1, 4);
        const own = comps.filter((c) => !c.used && inRect(box, c.cx, c.cy));
        if (own.length >= 2) {
          const sum = own.reduce((s, c) => s + c.area, 0), pa = t.areas[t.areas.length - 1] || sum;
          if (sum >= 0.6 * pa && sum <= 1.9 * pa) {
            t.dead = true; t.splitInto = []; t.end = k;
            for (const c of own) { c.used = true; t.splitInto.push(newTrack(c, k, [t.id]).id); }
            events.push({ kind: "split", frame: k, from: t.id, into: t.splitInto, at: [+t.x.toFixed(1), +t.y.toFixed(1)] });
          }
        }
      }
      // (c) ordinary 1-1 association (appearance first, position second)
      const pairs = [];
      for (const t of tracks) { if (t.dead || t._m || t._own) continue; const gate = t.hidden ? baseR * 3.5 : baseR * 1.8;
        for (const c of comps) { if (c.used) continue; const dd = Math.hypot(c.cx - t.px, c.cy - t.py), cd = _colDist(c.color, t.color); if (dd <= gate || cd < 70) pairs.push({ t, c, score: cd / 765 + dd / (gate * 2) }); } }
      pairs.sort((A, B) => A.score - B.score);
      for (const { t, c } of pairs) { if (t._m || c.used) continue; applyMatch(t, c, k); c.used = true; }
      // (d) births — with movingOnly, only a blob that MOVED becomes an object
      for (const c of comps) { if (c.used) continue; if (opts.movingOnly && (k === 0 || c.moving < 0.2)) continue; newTrack(c, k, null); }
      // (e) hide → coast on velocity → die only if lost too long
      for (const t of tracks) { if (t.dead || t._m || t._own || t.start === k) continue;
        t.hiddenCount = (t.hiddenCount || 0) + 1;
        if (!t.hidden) { t.hidden = true; t.hiddenSince = k; t.hiddenAt = [+t.x.toFixed(1), +t.y.toFixed(1)]; }
        t.x = t.px; t.y = t.py;
        if (t.hiddenCount > maxOcc) { t.dead = true; t.lost = true; }
      }
      for (const t of tracks) if (t._own) t._lastRegion = t._own.region;
    }
    for (const t of tracks) {
      t.span = t.last - t.start;
      if (t.path.length >= 2) { const dx = t.path[t.path.length - 1][0] - t.path[0][0], dy = t.path[t.path.length - 1][1] - t.path[0][1]; t.displacement = +Math.hypot(dx, dy).toFixed(1); } else t.displacement = 0;
      t.speed = +(t.displacement / Math.max(1, t.span)).toFixed(2);
      const a = t.areas || [0]; t.areaMin = Math.min(...a); t.areaMax = Math.max(...a); t.sizeChange = +(t.areaMax / Math.max(1, t.areaMin)).toFixed(2);
      t.occludedFrames = (t.occlusions || []).reduce((s, o) => s + o.frames, 0);
      t.permanent = t.occlusions && t.occlusions.length > 0 && t.reappeared;
      t.color = t.color.map((v) => Math.round(v));
      t.colorHex = _hex(t.color[0], t.color[1], t.color[2]);
    }
    const out = tracks.filter((t) => !t.lost && (t.path.length >= 3 || (t.occlusions && t.occlusions.length) || t.splitInto || t.mergedInto));
    out.events = events;
    out.all = tracks;
    return out;
  }
  // associated into tracks (id, path, velocity, colour signature). A track that
  // loses its blob is not killed — it COASTS on its last velocity (hidden), and
  // when a blob reappears near the predicted position with a matching colour it
  // is re-identified as the SAME object. Occlusion events are recorded, so a
  // ball that goes behind something and returns keeps one identity throughout.
  const _meanColor = (data, w, region) => { const [x0, y0, rw, rh] = region; let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; } return n ? [r / n, g / n, b / n] : [0, 0, 0]; };
  const _colDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const _mix = (a, b, al) => [a[0] * (1 - al) + b[0] * al, a[1] * (1 - al) + b[1] * al, a[2] * (1 - al) + b[2] * al];
  function trackMotions(frames, opts) {
    opts = opts || {};
    const w = frames[0].width, h = frames[0].height, thr = opts.threshold == null ? 60 : opts.threshold;
    const maxOcc = opts.maxOcclusion == null ? Math.max(6, Math.round(frames.length * 0.5)) : opts.maxOcclusion;
    const baseR = Math.max(12, Math.hypot(w, h) * 0.12), minArea = Math.max(6, Math.round(w * h / 40000));
    const tracks = [];
    for (let k = 1; k < frames.length; k++) {
      const a = frames[k - 1].data, b = frames[k].data, mask = new Uint8Array(w * h);
      for (let j = 0; j < w * h; j++) { const i = j * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > thr) mask[j] = 1; }
      const comps = segmentMask(mask, w, h, minArea).map((c) => ({ cx: c.region[0] + c.region[2] / 2, cy: c.region[1] + c.region[3] / 2, area: c.area, region: c.region, used: false, color: _meanColor(b, w, c.region) }));
      // predict each live track forward on its own velocity
      for (const t of tracks) { if (t.dead) continue; t.px = t.x + (t.vx || 0); t.py = t.y + (t.vy || 0); t._m = false; }
      // 1) associate blobs to tracks by predicted position + colour (a hidden
      //    track gets a wider gate, which is how a returning object is reclaimed)
      const pairs = [];
      for (const t of tracks) { if (t.dead) continue; const r = t.hidden ? baseR * 2.4 : baseR;
        for (const c of comps) { if (c.used) continue; const d = Math.hypot(c.cx - t.px, c.cy - t.py); if (d <= r) pairs.push({ t, c, score: d / r + _colDist(c.color, t.color) * 0.0015 }); } }
      pairs.sort((A, B) => A.score - B.score);
      for (const { t, c } of pairs) {
        if (t._m || c.used) continue;
        const dx = c.cx - t.x, dy = c.cy - t.y;
        t.vx = t.vx == null ? dx : 0.6 * t.vx + 0.4 * dx; t.vy = t.vy == null ? dy : 0.6 * t.vy + 0.4 * dy;
        t.x = c.cx; t.y = c.cy; t.last = k; t._m = true; c.used = true;
        t.color = _mix(t.color, c.color, 0.5);
        t.path.push([+c.cx.toFixed(1), +c.cy.toFixed(1)]);
        if (t.hidden) { t.occlusions.push({ from: t.hiddenSince, to: k, frames: k - t.hiddenSince, entry: t.hiddenAt, exit: [+c.cx.toFixed(1), +c.cy.toFixed(1)] }); t.hidden = false; t.reappeared = true; t.hiddenCount = 0; }
      }
      // 2) unmatched blobs → new tracks
      for (const c of comps) { if (c.used) continue; tracks.push({ id: tracks.length, path: [[+c.cx.toFixed(1), +c.cy.toFixed(1)]], x: c.cx, y: c.cy, vx: 0, vy: 0, color: c.color, start: k, last: k, hidden: false, hiddenCount: 0, occlusions: [], reappeared: false, _m: true }); }
      // 3) unmatched tracks → HIDE and coast (permanence), die only if lost too long
      for (const t of tracks) { if (t.dead || t._m) continue;
        t.hiddenCount = (t.hiddenCount || 0) + 1;
        if (!t.hidden) { t.hidden = true; t.hiddenSince = k; t.hiddenAt = [+t.x.toFixed(1), +t.y.toFixed(1)]; }
        t.x = t.px; t.y = t.py;                                    // coast on velocity
        if (t.hiddenCount > maxOcc) { t.dead = true; t.lost = true; }
      }
    }
    for (const t of tracks) {
      if (t.path.length >= 2) { const dx = t.path[t.path.length - 1][0] - t.path[0][0], dy = t.path[t.path.length - 1][1] - t.path[0][1]; t.displacement = +Math.hypot(dx, dy).toFixed(1); t.heading = +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1); }
      else { t.displacement = 0; t.heading = null; }
      t.span = t.last - t.start; t.speed = +(t.displacement / Math.max(1, t.span)).toFixed(2);
      t.occludedFrames = (t.occlusions || []).reduce((s, o) => s + o.frames, 0);
      t.permanent = t.occlusions && t.occlusions.length > 0 && t.reappeared;   // survived being hidden
    }
    return tracks.filter((t) => (t.path.length >= 2 || (t.occlusions && t.occlusions.length)) && !t.lost);
  }
  function read4D(input) {
    const frames = (input && input.frames) || [];
    if (frames.length < 2) return { schema: "Alhazen4D@1", gap: "needs_frames", because: "4D needs at least two frames (x, y, t)" };
    const w = frames[0].width, h = frames[0].height, n = frames.length, thr = input.threshold == null ? 60 : input.threshold;
    const trail = new Float32Array(w * h), centroids = [], frameMoved = [];
    for (let k = 0; k < n; k++) {
      if (k === 0) { centroids.push(null); frameMoved.push(0); continue; }
      const a = frames[k - 1].data, b = frames[k].data;
      let moved = 0, sx = 0, sy = 0;
      for (let j = 0; j < w * h; j++) {
        const i = j * 4, d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        if (d > thr) { moved++; const x = j % w, y = (j - x) / w; sx += x; sy += y; trail[j] = Math.min(1, trail[j] * 0.78 + 0.4); }
        else trail[j] *= 0.93; // evaporation: a trail fades where motion stops
      }
      centroids.push(moved ? [sx / moved, sy / moved] : null);
      frameMoved.push(+(moved / (w * h)).toFixed(4));
    }
    const velocities = [];
    for (let k = 2; k < n; k++) { const a = centroids[k - 1], b = centroids[k]; if (a && b) velocities.push([b[0] - a[0], b[1] - a[1]]); }
    const vmean = velocities.length ? [velocities.reduce((s, v) => s + v[0], 0) / velocities.length, velocities.reduce((s, v) => s + v[1], 0) / velocities.length] : null;
    const tmask = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) if (trail[j] > 0.5) tmask[j] = 1;
    const trailRegions = segmentMask(tmask, w, h, Math.max(8, Math.round(w * h / 20000))).map((c) => ({ region: c.region, area: c.area }));
    const speed = vmean ? Math.hypot(vmean[0], vmean[1]) : 0;
    const angle = vmean && (vmean[0] || vmean[1]) ? +(Math.atan2(vmean[1], vmean[0]) * 180 / Math.PI).toFixed(1) : null;
    const persisted = trailRegions.reduce((s, r) => s + r.area, 0) / (w * h);
    const tracks = trackMotions(frames, { threshold: thr });
    const trackClaims = tracks.map((t, i) => {
      const xs = t.path.map((p) => p[0]), ys = t.path.map((p) => p[1]);
      const region = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
      return { key: "track_" + i, kind: "trail", region, value: t.displacement };
    });
    return {
      schema: "Alhazen4D@1", width: w, height: h,
      time: { frames: n, movedPerFrame: frameMoved },
      motion: { centroids: centroids.map((c) => (c ? c.map((x) => +x.toFixed(1)) : null)), netVelocity: vmean ? vmean.map((x) => +x.toFixed(2)) : null, speed: +speed.toFixed(2) },
      trails: { regions: trailRegions, count: trailRegions.length, persistence: +persisted.toFixed(4) },
      tracks: tracks.map((t) => ({ id: t.id, start: t.start, last: t.last, path: t.path, displacement: t.displacement, heading: t.heading, speed: t.speed, span: t.span, occlusions: t.occlusions || [], occludedFrames: t.occludedFrames || 0, reappeared: !!t.reappeared, permanent: !!t.permanent })),
      motionBlur: { direction: vmean ? vmean.map((x) => +x.toFixed(2)) : null, angleDeg: angle, length: +speed.toFixed(2), basis: "edge smear ≈ inter-frame displacement" },
      longExposure: { data: trailToRGBA(trail, w, h), width: w, height: h },
      claims: trackClaims,
    };
  }
  // motion blur from a SINGLE still: gradient-orientation anisotropy fixes the
  // AXIS (a still cannot fix the kernel length — that is disclosed, not guessed)
  function motionBlurOfImage(data, w, h) {
    const hist = new Float64Array(18); let mag = 0, cnt = 0;
    const L = (p) => _lum(data[p], data[p + 1], data[p + 2]);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4, gx = L(i + 4) - L(i - 4), gy = L(i + w * 4) - L(i - w * 4);
      const m = Math.abs(gx) + Math.abs(gy); if (m < 40) continue;
      const b = Math.floor((((Math.atan2(gy, gx) + Math.PI) % Math.PI)) / (Math.PI / 18)); hist[b] += m; mag += m; cnt++;
    }
    if (!cnt) return { schema: "AlhazenBlur@1", gap: "no_edges" };
    let bi = 0; for (let k = 1; k < 18; k++) if (hist[k] > hist[bi]) bi = k;
    const dom = (bi + 0.5) * (Math.PI / 18), peak = +(hist[bi] / mag).toFixed(3);
    return { schema: "AlhazenBlur@1", edgePixels: cnt, dominantNormalDeg: +(dom * 180 / Math.PI).toFixed(1), blurAxisDeg: +(dom * 180 / Math.PI + 90).toFixed(1), anisotropy: peak, blurred: peak > 0.2, basis: "gradient-orientation anisotropy (axis only; length needs frames)" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHEROMONES + SWARM — stigmergy for the eyes.
  //
  // No eye is best in every scene. So the reader keeps a pheromone board: a
  // decaying strength per (sceneKind, eye). A swarm dispatches the eligible eyes
  // as independent ants; the ones whose claims SURVIVE reconciliation deposit,
  // a conflicted eye deposits a little, and every strength evaporates each pass.
  // Sniff consults the board to open the eyes that have paid off HERE — so the
  // reader gets better with use, with no model and no labels.
  // ═══════════════════════════════════════════════════════════════════════════
  function createPheromone(seed) {
    const board = (seed && seed.board) || {};
    return {
      schema: "AlhazenPheromone@1", board,
      strength(scene, eye) { return (board[scene] && board[scene][eye]) || 0; },
      deposit(scene, eye, amt) { const b = board[scene] || (board[scene] = {}); b[eye] = Math.min(1, (b[eye] || 0) + (amt == null ? 0.15 : amt)); return this; },
      evaporate(f) { f = f == null ? 0.02 : f; for (const s in board) for (const e in board[s]) { board[s][e] *= (1 - f); if (board[s][e] < 0.01) delete board[s][e]; } return this; },
      recommend(scene, eyes) { const b = board[scene] || {}; return [...eyes].sort((a, c) => (b[c] || 0) - (b[a] || 0)); },
    };
  }
  function prepare(input) {
    if (input && !input.data && input.frames && input.frames.length) {
      const f = input.frames[input.frames.length - 1];
      return { ...input, data: f.data, width: f.width, height: f.height };
    }
    return input;
  }
  function runEye(name, input, opts) {
    try { return { ...EYES[name](input, opts), eye: name }; }
    catch (e) { return { eye: name, error: String(e), claims: [], coverage: 0 }; }
  }
  function swarm(input, opts) {
    opts = opts || {};
    input = prepare(input);
    const s = opts.sniff || sniff(input);
    const phe = opts.pheromone || createPheromone();
    const eligible = opts.eyes || s.eyes || ["raster"];
    const ranked = phe.recommend(s.kind, eligible);           // trail order
    const chosen = opts.budget ? ranked.slice(0, opts.budget) : ranked; // cost: afford only k eyes
    const ants = chosen.map((nm) => runEye(nm, input, opts)); // one ant per eye
    const rec = reconcile(ants);
    const conflicted = new Set(rec.deltas.flatMap((d) => d.eyes));
    for (const a of ants) {
      if (a.gap || !a.claims || !a.claims.length) continue;     // a blind/no-op eye learns nothing
      phe.deposit(s.kind, a.eye, conflicted.has(a.eye) ? 0.03 : 0.15);
    }
    phe.evaporate();
    const out = { schema: "AlhazenSwarm@1", sniff: s, ranked, ants: ants.map((a) => ({ eye: a.eye, gap: a.gap || null, claims: (a.claims || []).length, coverage: a.coverage })),
                  reconciled: rec, pheromone: phe.board, converged: rec.converged, dissent: rec.dissent };
    const lay = ants.find((a) => a.kind === "layer");
    if (lay) out.scene3d = liftTo3D(lay.data);
    const four = ants.find((a) => a.kind === "fourd");
    if (four) out.fourd = { motion: four.data.motion, trails: four.data.trails, motionBlur: four.data.motionBlur };
    return out;
  }
  function fourdEye(input) { const d = read4D(input); return { kind: "fourd", basis: "frames (x, y, t): trails + motion", coverage: d.gap ? 0 : 1, data: d, gap: d.gap, claims: d.claims || [] }; }
  EYES.fourd = fourdEye;

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPTH PERCEPTION — infer near/far with no depth sensor and no model.
  //
  // Three cues, picked by what the input affords:
  //   • monocular (a single frame): OCCLUSION (who covers whom), relative SIZE,
  //     vertical position on the ground plane, and local DETAIL (texture
  //     gradient — nearer surfaces carry finer, sharper detail).
  //   • stereo  (two views): block-matching DISPARITY → depth.
  //   • motion parallax (a video): objects that sweep the frame faster are
  //     nearer (their tracks move more per unit time).
  // Every depth here is a HYPOTHESIS, and conflicting cues are named, not averaged
  // away in silence.
  // ═══════════════════════════════════════════════════════════════════════════
  const _norm = (v, lo, hi) => (hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5);
  // segment into COLOUR-coherent regions (flood fill over foreground, splitting
  // where colour changes) — so two touching objects of different colour stay two
  // objects, which plain connected-components of a binary mask cannot do.
  function segmentColors(data, w, h, opts) {
    opts = opts || {};
    const bg = backgroundOf(data, w, h), bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
    const fgT = opts.fgThreshold == null ? 110 : opts.fgThreshold, tol = opts.colorTolerance == null ? 90 : opts.colorTolerance;
    const minArea = opts.minArea || Math.max(8, Math.round(w * h / 30000));
    const lab = new Int32Array(w * h).fill(-1), comps = [], st = [];
    for (let s = 0; s < w * h; s++) {
      if (lab[s] >= 0) continue;
      let i = s * 4;
      if (Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB) <= fgT) continue;
      const id = comps.length, c = { id, minx: w, maxx: 0, miny: h, maxy: 0, area: 0, r: 0, g: 0, b: 0 };
      st.push(s); lab[s] = id;
      while (st.length) {
        const p = st.pop(), x = p % w, y = (p - x) / w; i = p * 4;
        c.area++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
        if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x; if (y < c.miny) c.miny = y; if (y > c.maxy) c.maxy = y;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (q < 0 || lab[q] >= 0) continue; const iq = q * 4;
          if (Math.abs(data[iq] - bgR) + Math.abs(data[iq + 1] - bgG) + Math.abs(data[iq + 2] - bgB) <= fgT) continue;
          if (Math.abs(data[iq] - data[i]) + Math.abs(data[iq + 1] - data[i + 1]) + Math.abs(data[iq + 2] - data[i + 2]) > tol) continue;
          lab[q] = id; st.push(q);
        }
      }
      if (c.area >= minArea) { c.region = [c.minx, c.miny, c.maxx - c.minx + 1, c.maxy - c.miny + 1]; c.color = [c.r / c.area, c.g / c.area, c.b / c.area]; comps.push(c); }
    }
    return comps;
  }
  function regionDetail(data, w, h, region) {
    const [x0, y0, rw, rh] = region; let strong = 0, tot = 0;
    const L = (p) => _lum(data[p], data[p + 1], data[p + 2]);
    for (let y = Math.max(1, y0); y < Math.min(h - 1, y0 + rh); y++) for (let x = Math.max(1, x0); x < Math.min(w - 1, x0 + rw); x++) {
      const i = (y * w + x) * 4; const gx = L(i + 4) - L(i - 4), gy = L(i + w * 4) - L(i - w * 4); tot++; if (Math.abs(gx) + Math.abs(gy) > 60) strong++;
    }
    return tot ? strong / tot : 0;
  }
  const rectContains = (outer, inner) => { const [x, y] = [inner[0] + inner[2] / 2, inner[1] + inner[3] / 2]; return x >= outer[0] && x <= outer[0] + outer[2] && y >= outer[1] && y <= outer[1] + outer[3]; };

  function depthFromCues(data, w, h, opts) {
    opts = opts || {};
    const minArea = opts.minArea || Math.max(8, Math.round(w * h / 30000));
    let regions = segmentColors(data, w, h, opts).map((c) => {
      const [x, y, rw, rh] = c.region;
      return { region: c.region, area: c.area, color: c.color.map((v) => Math.round(v)), cx: x + rw / 2, cy: y + rh / 2,
               size: c.area / (w * h), vert: 1 - (y + rh / 2) / h, detail: regionDetail(data, w, h, c.region), contains: 0, containedBy: null };
    });
    if (!regions.length) return { schema: "AlhazenDepth@1", cue: "monocular", gap: "no_regions", regions: [] };
    // occlusion: a region whose centre sits inside another's box is a PATCH on
    // it — the smaller enclosed one is IN FRONT (a thing on/over the backdrop),
    // the larger container is the far field it occludes.
    for (const a of regions) for (const b of regions) { if (a === b) continue; if (rectContains(a.region, b.region) && a.area > b.area * 1.05) { b.containedBy = a; a.contains++; } }
    const sizes = regions.map((r) => r.size), dets = regions.map((r) => r.detail);
    const sLo = Math.min(...sizes), sHi = Math.max(...sizes), dLo = Math.min(...dets), dHi = Math.max(...dets);
    for (const r of regions) {
      const occl = r.contains > 0 && !r.containedBy ? 0.25 : (r.containedBy ? 1 : 0.5);
      r.occlusion = occl;
      r.depth = +(0.45 * occl + 0.2 * _norm(r.size, sLo, sHi) + 0.2 * r.vert + 0.15 * _norm(r.detail, dLo, dHi)).toFixed(3);
    }
    // name a cue conflict when occlusion says front but vertical says far
    const conflicts = regions.filter((r) => r.occlusion === 1 && r.vert < 0.4).map((r) => ({ region: r.region, because: "occludes others but sits high (size/vertical disagree with occlusion)" }));
    regions.sort((a, b) => b.depth - a.depth);
    return { schema: "AlhazenDepth@1", cue: "monocular: occlusion + size + vertical + detail", regions,
             depthOrder: regions.map((r, i) => ({ rank: i, region: r.region, depth: r.depth })), conflicts,
             standing: "a hypothesis; occlusion is the strongest cue, size/vertical/detail are priors" };
  }

  function stereoDepth(left, right, w, h, opts) {
    opts = opts || {};
    const maxD = opts.maxDisparity || 40, bs = opts.block || 8;
    if (left.length !== w * h * 4 || right.length !== w * h * 4) return { schema: "AlhazenDepth@1", cue: "stereo", gap: "size_mismatch" };
    const map = opts.keepMap ? new Int16Array(w * h).fill(-1) : null;
    let sum = 0, n = 0, mn = Infinity, mx = -Infinity;
    for (let y = 0; y + bs <= h; y += bs) for (let x = maxD; x + bs <= w; x += bs) {
      let best = 0, bestSAD = Infinity;
      for (let d = 0; d <= maxD; d++) {
        let sad = 0;
        for (let dy = 0; dy < bs; dy++) for (let dx = 0; dx < bs; dx++) { const il = ((y + dy) * w + (x + dx)) * 4, ir = ((y + dy) * w + (x + dx - d)) * 4; sad += Math.abs(left[il] - right[ir]) + Math.abs(left[il + 1] - right[ir + 1]) + Math.abs(left[il + 2] - right[ir + 2]); }
        if (sad < bestSAD) { bestSAD = sad; best = d; }
      }
      sum += best; n++; if (best < mn) mn = best; if (best > mx) mx = best;
      if (map) for (let dy = 0; dy < bs; dy++) for (let dx = 0; dx < bs; dx++) map[(y + dy) * w + (x + dx)] = best;
    }
    const mean = n ? sum / n : 0;
    return { schema: "AlhazenDepth@1", cue: "stereo disparity (block SAD)", width: w, height: h,
             disparity: { min: mn, max: mx, mean: +mean.toFixed(2) }, map,
             standing: "depth ∝ 1/disparity; larger disparity = nearer" };
  }

  function motionParallax(tracks) {
    const ts = (tracks || []).filter((t) => t.speed != null && t.path && t.path.length >= 2);
    if (!ts.length) return { schema: "AlhazenDepth@1", cue: "motion parallax", gap: "no_tracks", regions: [] };
    const sp = ts.map((t) => t.speed), lo = Math.min(...sp), hi = Math.max(...sp);
    const regions = ts.map((t) => { const xs = t.path.map((p) => p[0]), ys = t.path.map((p) => p[1]); return { id: t.id, speed: t.speed, depth: +_norm(t.speed, lo, hi).toFixed(3), region: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1] }; });
    regions.sort((a, b) => b.depth - a.depth);
    return { schema: "AlhazenDepth@1", cue: "motion parallax (faster track = nearer)", regions, standing: "assumes similar motion; a stationary but near object is mis-ranked" };
  }

  function perceiveDepth(input, opts) {
    input = prepare(input);
    if (input.left && input.right) return stereoDepth(input.left.data || input.left, input.right.data || input.right, input.left.width || input.width, input.left.height || input.height, opts);
    if (input.frames && input.frames.length >= 2) return motionParallax(trackObjects(input.frames, opts));
    if (input.data) return depthFromCues(input.data, input.width, input.height, opts);
    return { schema: "AlhazenDepth@1", gap: "no_pixels", because: "depth needs pixels, a stereo pair, or frames" };
  }
  function depthEye(input, opts) {
    const pd = perceiveDepth(input, opts);
    const claims = (pd.regions || []).map((r, i) => ({ key: "depth_" + i, kind: "depth", region: r.region, value: r.depth }));
    return { kind: "depth", basis: pd.cue, coverage: (pd.regions || []).length ? 0.9 : 0, data: pd, gap: pd.gap, claims };
  }
  EYES.depth = depthEye;

  // ═══════════════════════════════════════════════════════════════════════════
  // FACES / PEOPLE — find a person with no model, from skin tone + shape.
  // The skin mask is the RGB (Kovac) rule OR the YCbCr chroma rule; connected
  // skin regions are filtered by face-like size, aspect and fill. This is a
  // PROPOSAL (a beige wall can false-positive), disclosed as such.
  // ═══════════════════════════════════════════════════════════════════════════
  function skinMask(data, w, h) {
    const m = new Uint8Array(w * h); let count = 0;
    for (let j = 0; j < w * h; j++) {
      const i = j * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const ycc = (() => { const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b; return Cb >= 77 && Cb <= 127 && Cr >= 133 && Cr <= 173; })();
      const rgb = r > 95 && g > 40 && b > 20 && (mx - mn) > 15 && Math.abs(r - g) > 15 && r > g && r > b;
      if (ycc || rgb) { m[j] = 1; count++; }
    }
    return { mask: m, share: count / (w * h) };
  }
  function detectFaces(data, w, h, opts) {
    opts = opts || {};
    const sk = skinMask(data, w, h);
    if (sk.share < 0.01) return { schema: "AlhazenFace@1", faces: [], skinShare: +sk.share.toFixed(3), because: "too little skin-tone area" };
    const comps = segmentMask(sk.mask, w, h, Math.max(24, Math.round(w * h * 0.004)));
    const faces = [];
    for (const c of comps) {
      const [x, y, ww, hh] = c.region, area = c.area, fill = area / (ww * hh), asp = ww / hh;
      if (ww < w * 0.05 || hh < h * 0.05 || area < w * h * 0.01) continue;
      if (asp < 0.5 || asp > 1.9 || fill < 0.34 || fill > 0.98) continue;
      faces.push({ box: [x, y, ww, hh], area, aspect: +asp.toFixed(2), fill: +fill.toFixed(2),
                   confidence: +Math.min(1, area / (w * h) * 2.5 + fill * 0.5).toFixed(2) });
    }
    faces.sort((a, b) => b.area - a.area);
    return { schema: "AlhazenFace@1", faces: faces.slice(0, 6), skinShare: +sk.share.toFixed(3), standing: "skin-tone + shape; a proposal, not a fact" };
  }
  EYES.face = (input) => {
    if (!input || !input.data) return { kind: "face", basis: "skin tone + shape", coverage: 0, gap: "needs_pixels", claims: [] };
    const fr = detectFaces(input.data, input.width, input.height);
    return { kind: "face", basis: "skin tone + shape", coverage: fr.faces.length ? 0.9 : 0, data: fr,
             claims: fr.faces.map((f, i) => ({ key: "face_" + i, kind: "face", region: f.box, value: f.confidence })) };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARN THE SUBJECT ON THE FLY — no skin, no face, no class prior.
  // Across a short clip the reader builds its OWN background model (the per-pixel
  // mean — what stays put) and calls the SUBJECT whatever persistently differs
  // from it and/or moves. It is never told what a face, a person or an object is;
  // it is told nothing at all. The subject is a hypothesis from the stream. ═══════
  function learnSalience(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 4) return { schema: "AlhazenSalience@1", gap: "needs_frames", because: "a background is learned across several frames" };
    const w = frames[0].width, h = frames[0].height, N = w * h, thr = opts.threshold == null ? 70 : opts.threshold;
    const bgr = new Float32Array(N), bgg = new Float32Array(N), bgb = new Float32Array(N);
    for (const f of frames) for (let j = 0; j < N; j++) { const i = j * 4; bgr[j] += f.data[i] / n; bgg[j] += f.data[i + 1] / n; bgb[j] += f.data[i + 2] / n; }
    const pers = new Float32Array(N), mot = new Float32Array(N);
    for (let k = 0; k < n; k++) {
      const d = frames[k].data, p = k > 0 ? frames[k - 1].data : null;
      for (let j = 0; j < N; j++) {
        const i = j * 4, dev = Math.abs(d[i] - bgr[j]) + Math.abs(d[i + 1] - bgg[j]) + Math.abs(d[i + 2] - bgb[j]);
        if (dev > thr) pers[j]++;
        if (p && (Math.abs(d[i] - p[i]) + Math.abs(d[i + 1] - p[i + 1]) + Math.abs(d[i + 2] - p[i + 2])) > thr) mot[j]++;
      }
    }
    const sal = new Float32Array(N);
    for (let j = 0; j < N; j++) sal[j] = 0.6 * (pers[j] / n) + 0.4 * (n > 1 ? mot[j] / (n - 1) : 0);
    const mask = new Uint8Array(N);
    for (let j = 0; j < N; j++) if (sal[j] > 0.25) mask[j] = 1;
    const comps = segmentMask(mask, w, h, Math.max(16, Math.round(N * 0.004)));
    const subjects = comps.map((c) => {
      const [x, y, ww, hh] = c.region; let s = 0, p = 0, m = 0;
      for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) { const j = yy * w + xx; s += sal[j]; p += pers[j]; m += mot[j]; }
      const cxp = x + ww / 2, cyp = y + hh / 2;
      const centrality = 1 - Math.min(1, Math.hypot(cxp - w / 2, cyp - h / 2) / Math.hypot(w / 2, h / 2));
      return { region: c.region, area: c.area, score: +((s / Math.max(1, c.area)) * (0.6 + 0.4 * centrality)).toFixed(3),
               persistence: +(p / (c.area * n)).toFixed(3), motion: +(m / Math.max(1, c.area * (n - 1))).toFixed(3), centrality: +centrality.toFixed(2) };
    }).filter((s) => s.area > N * 0.004).sort((a, b) => b.score - a.score);
    return { schema: "AlhazenSalience@1", subjects: subjects.slice(0, 4), frames: n,
             background: "learned on the fly — the per-pixel mean across the clip",
             standing: "the subject is whatever persistently differs from the learned background — no skin, face or class prior" };
  }
  EYES.salience = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 4) return { kind: "salience", basis: "learned background", coverage: 0, gap: "needs_frames", claims: [] };
    const s = learnSalience(input.frames, opts);
    return { kind: "salience", basis: "online background + persistence + motion", coverage: (s.subjects || []).length ? 0.9 : 0, data: s,
             claims: (s.subjects || []).map((x, i) => ({ key: "subject_" + i, kind: "subject", region: x.region, value: x.score })) };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL FROM NOISE — separate what MOVES (signal) from what merely IS (noise:
  // the static scene, a big object that just sits there, the camera's own drift).
  // Global (camera) motion is estimated and removed first; the residual motion
  // energy gets a NOISE FLOOR MEASURED from the clip itself (median + k·MAD),
  // never a set threshold; blobs whose energy clears the floor are the signal.
  // The largest foreground is NOT the signal — the largest thing that MOVES is.
  // ═══════════════════════════════════════════════════════════════════════════
  function dilateMask(mask, w, h, d) {
    const out = new Uint8Array(mask);
    if (!d) return out;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy >= 0 && yy < h) out[yy * w + xx] = 1; }
    }
    return out;
  }
  function estimateGlobalShift(a, b, w, h, max) {
    max = max || 6;
    const bs = 16, L = (d, x, y) => { const i = (y * w + x) * 4; return _lum(d[i], d[i + 1], d[i + 2]); };
    const shifts = [];
    for (let by = 0; by + bs <= h; by += bs) for (let bx = 0; bx + bs <= w; bx += bs) {
      let mean = 0;
      for (let y = 0; y < bs; y++) for (let x = 0; x < bs; x++) mean += L(a, bx + x, by + y);
      mean /= bs * bs;
      let v = 0; for (let y = 0; y < bs; y++) for (let x = 0; x < bs; x++) { const d = L(a, bx + x, by + y) - mean; v += d * d; }
      if (v / (bs * bs) < 200) continue;                 // FLAT block: its shift is ambiguous — skip
      let best = [0, 0], bd = Infinity;
      for (let dy = -max; dy <= max; dy++) for (let dx = -max; dx <= max; dx++) {
        let sad = 0;
        for (let y = 0; y < bs; y += 2) for (let x = 0; x < bs; x += 2) { const yy = by + y, xx = bx + x, sy = yy + dy, sx = xx + dx; if (sy < 0 || sy >= h || sx < 0 || sx >= w) { sad += 1e9; continue; } sad += Math.abs(L(b, xx, yy) - L(a, sx, sy)); }
        if (sad < bd) { bd = sad; best = [dx, dy]; }
      }
      shifts.push(best); if (shifts.length >= 64) break;
    }
    if (!shifts.length) return [0, 0];
    const xs = shifts.map((s) => s[0]).sort((p, q) => p - q), ys = shifts.map((s) => s[1]).sort((p, q) => p - q);
    return [xs[xs.length >> 1], ys[ys.length >> 1]];
  }
  function signalFromNoise(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 3) return { schema: "AlhazenSignal@1", gap: "needs_frames", because: "a noise floor is measured across a clip" };
    const w = frames[0].width, h = frames[0].height, N = w * h, thr = opts.threshold == null ? 70 : opts.threshold;
    const E = new Float32Array(N), shifts = [];
    for (let k = 1; k < n; k++) {
      const a = frames[k - 1].data, b = frames[k].data;
      const [gx, gy] = opts.compensate === false ? [0, 0] : estimateGlobalShift(a, b, w, h, opts.maxShift || 6);
      shifts.push([gx, gy]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const j = y * w + x, i = j * 4, sx = x - gx, sy = y - gy;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) { const p = (sy * w + sx) * 4, d = Math.abs(b[i] - a[p]) + Math.abs(b[i + 1] - a[p + 1]) + Math.abs(b[i + 2] - a[p + 2]); if (d > thr) E[j] += d; }
      }
    }
    const arr = Array.from(E).sort((x, y) => x - y), med = arr[arr.length >> 1];
    const dev = arr.map((v) => Math.abs(v - med)).sort((x, y) => x - y), mad = dev[dev.length >> 1];
    const floor = Math.max(1, med + (opts.k == null ? 6 : opts.k) * mad);
    const mask = new Uint8Array(N); let sig = 0;
    for (let j = 0; j < N; j++) if (E[j] > floor) { mask[j] = 1; sig++; }
    const closed = dilateMask(mask, w, h, opts.close == null ? Math.max(2, Math.round(w / 64)) : opts.close);
    const comps = segmentMask(closed, w, h, Math.max(6, Math.round(N * 0.001))).map((c) => {
      const [x, y, ww, hh] = c.region; let e = 0;
      for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) e += E[yy * w + xx];
      const fill = c.area / (ww * hh);
      return { region: c.region, area: c.area, fill: +fill.toFixed(2), energy: +e.toFixed(1), density: +(e / Math.max(1, c.area)).toFixed(1), snr: +(e / Math.max(1, floor * c.area)).toFixed(2) };
    }).filter((c) => c.fill >= 0.3 && c.area <= N * 0.5).sort((a, c) => c.density - a.density);
    const gm = shifts.length ? [shifts.reduce((s, v) => s + Math.abs(v[0]), 0) / shifts.length, shifts.reduce((s, v) => s + Math.abs(v[1]), 0) / shifts.length] : [0, 0];
    return { schema: "AlhazenSignal@1", width: w, height: h, noiseFloor: +floor.toFixed(1), median: +med.toFixed(1), mad: +mad.toFixed(1),
             signalShare: +(sig / N).toFixed(4), globalMotion: gm.map((x) => +x.toFixed(2)), regions: comps, mask, energy: E,
             standing: "the noise floor is MEASURED from the clip (median + k·MAD of residual motion); global camera motion is removed first; signal = what MOVES, not what merely is" };
  }
  EYES.signal = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 3) return { kind: "signal", basis: "residual motion vs a measured floor", coverage: 0, gap: "needs_frames", claims: [] };
    const s = signalFromNoise(input.frames, opts);
    return { kind: "signal", basis: "residual motion > measured noise floor", coverage: (s.regions || []).length ? 0.9 : 0, data: s,
             claims: (s.regions || []).map((x, i) => ({ key: "signal_" + i, kind: "signal", region: x.region, value: x.snr })) };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // IGNORE — the power of attention is NOT attending to most things. Alhazen
  // builds a model that explains the bulk (static background, global camera
  // motion, idle motion below the measured floor) and IGNORES all of it. What
  // it attends is the small unexplained residual — and the ignored set is
  // disclosed as a result, never silently dropped. budget = the attention share.
  // ═══════════════════════════════════════════════════════════════════════════
  function attention(frames, opts) {
    opts = opts || {};
    const sig = signalFromNoise(frames, opts);
    if (sig.gap) return { schema: "AlhazenAttend@1", gap: sig.gap };
    const E = sig.energy, w = sig.width, h = sig.height, N = w * h;
    const budget = opts.budget == null ? 0.05 : opts.budget, floor = sig.noiseFloor;
    const arr = Array.from(E).sort((a, b) => a - b);
    const thr = arr[Math.min(arr.length - 1, Math.floor((1 - budget) * arr.length))];
    const attended = new Uint8Array(N); let att = 0, igStatic = 0, igLow = 0;
    for (let j = 0; j < N; j++) { if (E[j] >= thr && E[j] > floor) { attended[j] = 1; att++; } else { if (E[j] <= 0) igStatic++; else igLow++; } }
    const regions = segmentMask(attended, w, h, Math.max(6, Math.round(N * 0.0005))).map((c) => ({ region: c.region, area: c.area })).sort((a, b) => b.area - a.area).slice(0, 8);
    return { schema: "AlhazenAttend@1", width: w, height: h, budget, floor: +floor.toFixed(1), attentionThreshold: +thr.toFixed(1),
             attended: { share: +(att / N).toFixed(4), regions, mask: attended },
             ignored: { share: +((N - att) / N).toFixed(4), staticShare: +(igStatic / N).toFixed(4), lowShare: +(igLow / N).toFixed(4) },
             standing: "attention = NOT attending to the ~" + Math.round((1 - budget) * 100) + "% the model already explains (background, global motion, idle); only the surprising residual is attended; the ignored set is disclosed" };
  }
  EYES.attend = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 3) return { kind: "attend", basis: "suppress what is explained", coverage: 0, gap: "needs_frames", claims: [] };
    const a = attention(input.frames, opts);
    return { kind: "attend", basis: "model-explained suppression", coverage: a.attended ? 0.9 : 0, data: a,
             claims: (a.attended ? a.attended.regions : []).map((x, i) => ({ key: "attended_" + i, kind: "signal", region: x.region, value: x.area })) };
  };

  // The reader learns a background, finds the hand, turns each frame into a
  // normalized occupancy GRID (a handshape descriptor), segments the stream into
  // HELD POSTURES (runs of low handshape change), and clusters those postures
  // into a per-stream VOCABULARY of learned signs. A posture that recurs maps to
  // the same learned sign. Nothing is told what a sign means; a repeated sign is
  // simply one the reader has seen before.
  // ═══════════════════════════════════════════════════════════════════════════
  function handDescriptor(fg, w, region, G) {
    const [x0, y0, rw, rh] = region, out = new Float32Array(G * G);
    let tot = 0;
    for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) {
      const j = (y0 + yy) * w + (x0 + xx); if (!fg[j]) continue;
      const gx = Math.min(G - 1, Math.floor((xx / rw) * G)), gy = Math.min(G - 1, Math.floor((yy / rh) * G));
      out[gy * G + gx] += 1; tot++;
    }
    if (tot) for (let i = 0; i < out.length; i++) out[i] /= tot;   // normalized occupancy
    return out;
  }
  function readSigns(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 6) return { schema: "AlhazenSigns@1", gap: "needs_frames", because: "a sign is a MOVEMENT through signing space over time (x, y, t)" };
    const w = frames[0].width, h = frames[0].height, N = w * h, G = opts.grid || 5, thr = opts.threshold == null ? 70 : opts.threshold;
    const fgs = [], boxes = [];
    for (let k = 0; k < n; k++) {
      const d = frames[k].data, bg = backgroundOf(d, w, h);
      const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
      const fg = new Uint8Array(N);
      for (let j = 0; j < N; j++) { const i = j * 4; if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) > thr) fg[j] = 1; }
      const comps = segmentMask(fg, w, h, Math.max(16, Math.round(N * 0.002))).sort((a, b) => b.area - a.area);
      fgs.push(fg); boxes.push(comps[0] ? comps[0].region : null);
    }
    // stable signing-space ROI (union of the hand's extent) so handshape keeps its aspect
    let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    for (const b of boxes) if (b) { rx0 = Math.min(rx0, b[0]); ry0 = Math.min(ry0, b[1]); rx1 = Math.max(rx1, b[0] + b[2]); ry1 = Math.max(ry1, b[1] + b[3]); }
    const roi = isFinite(rx0) ? [rx0, ry0, rx1 - rx0, ry1 - ry0] : [0, 0, w, h];
    // each frame is a point in signing space: handshape + normalized location
    const F = boxes.map((b, k) => b ? { box: b, c: [(b[0] + b[2] / 2) / w, (b[1] + b[3] / 2) / h], shape: handDescriptor(fgs[k], w, roi, G) } : null);
    const diag = Math.hypot(w, h);
    const motion = (k) => { const a = F[k - 1], b = F[k]; if (!a || !b) return 0; return Math.hypot((b.c[0] - a.c[0]) * w, (b.c[1] - a.c[1]) * h) / diag; };
    const pause = opts.pause == null ? 0.008 : opts.pause;   // a stop (holding still) separates signs
    // segment into MOVEMENT EPISODES (a sign is a stroke of motion through signing space)
    const units = []; let cur = null;
    for (let k = 0; k < n; k++) {
      if (!F[k]) { if (cur && cur.length >= 2) units.push(cur); cur = null; continue; }
      const m = k > 0 ? motion(k) : 1;
      if (m < pause) { if (cur && cur.length >= 2) units.push(cur); cur = null; continue; }
      cur = cur ? (cur.push(k), cur) : [k];
    }
    if (cur && cur.length >= 2) units.push(cur);
    const shapeMean = (ks) => { const acc = new Float32Array(G * G); let m = 0; for (const k of ks) { const f = F[k]; if (!f) continue; m++; for (let i = 0; i < acc.length; i++) acc[i] += f.shape[i]; } if (m) for (let i = 0; i < acc.length; i++) acc[i] /= m; return acc; };
    // each sign = a 4D descriptor: handshape + location + movement (direction, straightness, repetition)
    const desc = units.map((ks) => {
      const s = shapeMean(ks), c0 = F[ks[0]].c, c1 = F[ks[ks.length - 1]].c;
      const disp = [c1[0] - c0[0], c1[1] - c0[1]];
      let pathLen = 0, rev = 0, prevDx = null, loc = [0, 0];
      for (let i = 0; i < ks.length; i++) {
        loc[0] += F[ks[i]].c[0]; loc[1] += F[ks[i]].c[1];
        if (i > 0) { const dx = F[ks[i]].c[0] - F[ks[i - 1]].c[0], dy = F[ks[i]].c[1] - F[ks[i - 1]].c[1]; pathLen += Math.hypot(dx, dy); if (prevDx != null && Math.sign(dx) !== Math.sign(prevDx) && Math.abs(dx) > 0.004) rev++; prevDx = dx; }
      }
      loc = [loc[0] / ks.length, loc[1] / ks.length];
      const dispMag = Math.hypot(disp[0], disp[1]);
      return { shape: s, disp, dispMag, straight: pathLen > 1e-6 ? Math.min(1, dispMag / pathLen) : 0, reversals: rev, loc, from: ks[0], to: ks[ks.length - 1], frames: ks.length, box: F[ks[0]].box };
    });
    // cluster the 4D descriptors into a per-stream vocabulary
    const wS = opts.wShape == null ? 1 : opts.wShape, wM = opts.wMove == null ? 2.5 : opts.wMove, wL = opts.wLoc == null ? 0.6 : opts.wLoc, wR = opts.wRev == null ? 0.4 : opts.wRev;
    const shapeDist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const dd = (a, b) => wS * shapeDist(a.shape, b.shape) + wM * Math.hypot(a.disp[0] - b.disp[0], a.disp[1] - b.disp[1]) + wL * Math.hypot(a.loc[0] - b.loc[0], a.loc[1] - b.loc[1]) + wR * Math.min(3, Math.abs(a.reversals - b.reversals)) / 3;
    const signTh = opts.signThreshold == null ? 0.12 : opts.signThreshold;
    const signs = [], signOf = [];
    desc.forEach((d) => { let best = -1, bd = Infinity; signs.forEach((s, si) => { const x = dd(d, s.exemplar); if (x < bd) { bd = x; best = si; } }); if (best >= 0 && bd < signTh) { signs[best].count++; signs[best].units.push(signOf.length); signOf.push(best); } else { signs.push({ id: signs.length, exemplar: d, count: 1, units: [signOf.length] }); signOf.push(signs.length - 1); } });
    const timeline = desc.map((d, i) => ({ from: d.from, to: d.to, sign: signOf[i], move: [+d.disp[0].toFixed(3), +d.disp[1].toFixed(3)], reversals: d.reversals, box: d.box }));
    return { schema: "AlhazenSigns@1", grid: G, frames: n, dimension: "4D — handshape + location in signing space + movement (path, direction, repetition) over time",
             vocabulary: signs.length, signs: signs.map((s) => ({ id: s.id, count: s.count, units: s.units, move: s.exemplar.disp.map((x) => +x.toFixed(3)), reversals: s.exemplar.reversals })), timeline,
             standing: "learned per-stream: a sign is a MOVEMENT through signing space, not a held shape; no lexicon, no language assumed; meaning NOT known" };
  }
  EYES.signs = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 6) return { kind: "signs", basis: "learned handshape vocabulary", coverage: 0, gap: "needs_frames", claims: [] };
    const s = readSigns(input.frames, opts);
    return { kind: "signs", basis: "handshape segmentation + online clustering", coverage: s.vocabulary ? 0.9 : 0, data: s,
             claims: (s.timeline || []).map((t, i) => ({ key: "sign_" + i, kind: "sign", region: t.box, value: t.sign })) };
  };

  // ── the NUL: what hands NORMALLY do ────────────────────────────────────────
  // Signing is not a fixed checklist — it is a DEPARTURE from ordinary hand
  // motion. So the reader keeps a NUL model: running statistics of how hands
  // normally behave (learned, per feature: recurrence, holds, straightness,
  // reversals, speed). It is fed the STRUCTURE-DESTROYED features of every clip
  // it judges (same amount of motion, no linguistic structure) — hands "just
  // moving". A sign is then what surprises that NUL. Nothing external is assumed;
  // the baseline is learned from what the reader has seen.
  function createHandNul(seed) {
    const keys = ["recurrence", "holdFraction", "straightness", "reversals", "speedMean"];
    const state = (seed && seed.state) || Object.fromEntries(keys.map((k) => [k, { n: 0, mean: 0, M2: 0 }]));
    const observe = (f) => { for (const k of keys) { if (f[k] == null) continue; const s = state[k], d = f[k] - s.mean; s.n++; s.mean += d / s.n; s.M2 += d * (f[k] - s.mean); } return state; };
    const sd = (k) => { const s = state[k]; return s.n > 1 ? Math.sqrt(s.M2 / (s.n - 1)) : 0; };
    const expected = (k) => +state[k].mean.toFixed(4);
    const surprise = (f) => { const per = {}; let bits = 0; for (const k of keys) { if (f[k] == null || !state[k].n) continue; const sig = Math.max(1e-3, sd(k)); const z = (f[k] - state[k].mean) / sig; per[k] = +z.toFixed(2); bits += Math.max(0, Math.abs(z) - 1); } return { bits: +bits.toFixed(2), z: per }; };
    return { schema: "HandNul@1", keys, state, observe, expected, surprise, samples: () => state.recurrence.n };
  }

  // ── the VIBE of a hand: a learned APPEARANCE prototype (colour histogram +
  // shape occupancy + scale) beside the motion vibe — the character of what a
  // hand IS and how it TENDS to behave. Learned online from confident hands.
  function handAppearance(fg, data, w, region, opts) {
    const G = (opts && opts.grid) || 5, [x0, y0, rw, rh] = region;
    const col = new Float32Array(64), sh = new Float32Array(G * G);
    let n = 0, fgn = 0;
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) {
      const j = y * w + x, i = j * 4;
      const r = data[i] >> 6, g = data[i + 1] >> 6, b = data[i + 2] >> 6;
      const isFg = fg ? fg[j] : (_lum(data[i], data[i + 1], data[i + 2]) > 128);
      n++; col[(r << 4) | (g << 2) | b] += isFg ? 1 : 0.15;
      if (isFg) { fgn++; sh[Math.min(G - 1, Math.floor((y - y0) / rh * G)) * G + Math.min(G - 1, Math.floor((x - x0) / rw * G))]++; }
    }
    if (n) for (let i = 0; i < 64; i++) col[i] /= n;
    if (fgn) for (let i = 0; i < sh.length; i++) sh[i] /= fgn;
    const area = rw * rh, out = new Float32Array(64 + G * G + 2);
    out.set(col, 0); out.set(sh, 64);
    out[64 + G * G] = Math.min(1, Math.log(1 + area) / 10);      // scale
    out[64 + G * G + 1] = Math.min(3, rw / Math.max(1, rh)) / 3; // aspect
    return out;
  }
  function createHandVibe(seed) {
    const G = (seed && seed.grid) || 5, D = 64 + G * G + 2, mkeys = ["recurrence", "holdFraction", "straightness", "reversals", "speedMean"];
    const st = (seed && seed.st) || { app: { n: 0, mean: new Float64Array(D), M2: new Float64Array(D) }, mot: Object.fromEntries(mkeys.map((k) => [k, { n: 0, mean: 0, M2: 0 }])) };
    const observeAppearance = (d) => { if (!d || d.length !== st.app.mean.length) return; const n = st.app.n; for (let i = 0; i < d.length; i++) { const delta = d[i] - st.app.mean[i]; st.app.mean[i] += delta / (n + 1); st.app.M2[i] += delta * (d[i] - st.app.mean[i]); } st.app.n++; };
    const handiness = (d) => { if (!d || !st.app.n || d.length !== st.app.mean.length) return 0.5; let s = 0; for (let i = 0; i < d.length; i++) { const sd = Math.sqrt(Math.max(1e-8, st.app.n > 1 ? st.app.M2[i] / (st.app.n - 1) : 1e-4)); const z = (d[i] - st.app.mean[i]) / sd; s += Math.min(9, z * z); } return +(1 / (1 + s / d.length)).toFixed(3); };
    const observeMotion = (f) => { for (const k of mkeys) { if (f[k] == null) continue; const s = st.mot[k], d = f[k] - s.mean; s.n++; s.mean += d / s.n; s.M2 += d * (f[k] - s.mean); } };
    const motionSurprise = (f) => { let bits = 0; const z = {}; for (const k of mkeys) { if (f[k] == null || !st.mot[k].n) continue; const sd = Math.sqrt(Math.max(1e-6, st.mot[k].n > 1 ? st.mot[k].M2 / (st.mot[k].n - 1) : 1e-4)); const zz = (f[k] - st.mot[k].mean) / sd; z[k] = +zz.toFixed(2); bits += Math.max(0, Math.abs(zz) - 1); } return { bits: +bits.toFixed(2), z }; };
    return { schema: "HandVibe@1", grid: G, st, observeAppearance, handiness, observeMotion, motionSurprise, expectedMotion: () => Object.fromEntries(mkeys.map((k) => [k, +st.mot[k].mean.toFixed(4)])), samples: () => st.app.n };
  }
  const createBodyVibe = (seed) => createHandVibe(seed);   // same vibe, learned on BODIES

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTURE vs SIGN — know what a hand is, and tell idle hand MOVEMENT from
  // SIGNING. Hands are the SIGNAL blobs (compact, moving) — never the big static
  // body. Signedness is SURPRISE against the NUL of what hands normally do.
  // ═══════════════════════════════════════════════════════════════════════════
  function readGesture(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 8) return { schema: "AlhazenGesture@1", gap: "needs_frames", because: "signedness is measured across a clip" };
    const w = frames[0].width, h = frames[0].height, N = w * h, G = opts.grid || 5, thr = opts.threshold == null ? 70 : opts.threshold;
    const sig = signalFromNoise(frames, opts);
    const att = attention(frames, opts), sigMask = att.attended ? att.attended.mask : (sig.mask || null);
    const fgs = [], hands = [];
    for (let k = 0; k < n; k++) {
      const d = frames[k].data, bg = backgroundOf(d, w, h);
      const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
      const fg = new Uint8Array(N);
      for (let j = 0; j < N; j++) { if (sigMask && !sigMask[j]) continue; const i = j * 4; if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) > thr) fg[j] = 1; }
      fgs.push(fg);
      const comps = segmentMask(fg, w, h, Math.max(12, Math.round(N * 0.001))).filter((c) => c.area <= N * 0.12).sort((a, b) => b.area - a.area);
      hands.push(comps.slice(0, 2).map((c) => ({ box: c.region, cx: (c.region[0] + c.region[2] / 2) / w, cy: (c.region[1] + c.region[3] / 2) / h, area: c.area })));
    }
    const prim = []; let prev = null;
    for (const hs of hands) { let pick = null; if (prev) { let bd = 1e9; for (const c of hs) { const d = Math.hypot(c.cx - prev.cx, c.cy - prev.cy); if (d < bd) { bd = d; pick = c; } } } if (!pick && hs.length) pick = hs[0]; prim.push(pick); if (pick) prev = pick; }
    const handFrames = prim.filter(Boolean).length;
    // the BODY: the persistent, large foreground (what stays). Signing speaks WITH the body.
    const persist = new Float32Array(N);
    for (let k = 0; k < n; k++) { const fg = fgs[k]; for (let j = 0; j < N; j++) if (fg[j]) persist[j]++; }
    const bodyMask = new Uint8Array(N); for (let j = 0; j < N; j++) if (persist[j] >= n * 0.6) bodyMask[j] = 1;
    const bodyComp = segmentMask(bodyMask, w, h, Math.max(24, Math.round(N * 0.02))).sort((a, b) => b.area - a.area)[0] || null;
    const bb = bodyComp ? bodyComp.region : null;
    const bcx = bb ? (bb[0] + bb[2] / 2) / w : 0.5, bcy = bb ? (bb[1] + bb[3] / 2) / h : 0.5;
    const bScaleN = bb ? Math.hypot(bb[2] / w, bb[3] / h) : 1;
    // body-anchored locations, by height fraction (head → chest → waist → base)
    const partOf = (x, y) => { if (!bb) return "space"; const fx = (x - bb[0]) / bb[2], fy = (y - bb[1]) / bb[3]; if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return "space"; if (fy < 0.22) return "head"; if (fy < 0.55) return "chest"; if (fy < 0.8) return "waist"; return "base"; };
    let rx0 = 1e9, ry0 = 1e9, rx1 = -1e9, ry1 = -1e9;
    for (const hs of hands) for (const c of hs) { rx0 = Math.min(rx0, c.box[0]); ry0 = Math.min(ry0, c.box[1]); rx1 = Math.max(rx1, c.box[0] + c.box[2]); ry1 = Math.max(ry1, c.box[1] + c.box[3]); }
    const roi = isFinite(rx0) ? [rx0, ry0, rx1 - rx0, ry1 - ry0] : [0, 0, w, h];
    const shapes = prim.map((p, k) => p ? handDescriptor(fgs[k], w, roi, G) : null);
    const diag = Math.hypot(w, h);
    const speed = (k) => { const a = prim[k - 1], b = prim[k]; if (!a || !b) return 0; return Math.hypot((b.cx - a.cx) * w, (b.cy - a.cy) * h) / diag; };
    const sdist = (a, b) => { if (!a || !b) return 1; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const pauseTh = opts.pause == null ? 0.006 : opts.pause;
    const units = []; let cur = null, holds = 0;
    for (let k = 0; k < n; k++) {
      const sp = k > 0 ? speed(k) : 1;
      if (sp < pauseTh) { holds++; if (cur && cur.length >= 2) units.push(cur); cur = null; continue; }
      const chg = k > 0 ? sdist(shapes[k - 1], shapes[k]) : 0;
      if (chg > (opts.shapeJump == null ? 0.12 : opts.shapeJump)) { if (cur && cur.length >= 2) units.push(cur); cur = [k]; continue; }
      cur = cur ? (cur.push(k), cur) : [k];
    }
    if (cur && cur.length >= 2) units.push(cur);
    const desc = units.map((ks) => {
      const c0 = prim[ks[0]], c1 = prim[ks[ks.length - 1]]; let rev = 0, pdx = null, path = 0;
      for (let i = 1; i < ks.length; i++) { const a = prim[ks[i - 1]], b = prim[ks[i]]; const dx = b.cx - a.cx; path += Math.hypot(dx, b.cy - a.cy); if (pdx != null && Math.sign(dx) !== Math.sign(pdx) && Math.abs(dx) > 0.004) rev++; pdx = dx; }
      let lx = 0, ly = 0; for (const k of ks) { lx += prim[k].cx; ly += prim[k].cy; } lx /= ks.length; ly /= ks.length;
      return { shape: shapes[ks[0]] || new Float32Array(G * G), disp: [(c1.cx - c0.cx), (c1.cy - c0.cy)], loc: [lx, ly], rev, straight: path > 1e-6 ? Math.min(1, Math.hypot(c1.cx - c0.cx, c1.cy - c0.cy) / path) : 0, from: ks[0], to: ks[ks.length - 1] };
    });
    const dd = (a, b) => { let s = 0; for (let i = 0; i < a.shape.length; i++) s += Math.abs(a.shape[i] - b.shape[i]); return s / a.shape.length + 2.5 * Math.hypot(a.disp[0] - b.disp[0], a.disp[1] - b.disp[1]) + 1.5 * Math.hypot((a.loc ? a.loc[0] : 0) - (b.loc ? b.loc[0] : 0), (a.loc ? a.loc[1] : 0) - (b.loc ? b.loc[1] : 0)); };
    const signTh = opts.signThreshold == null ? 0.12 : opts.signThreshold;
    const V = [], signOf = [];
    desc.forEach((d) => { let best = -1, bd = Infinity; V.forEach((x, i) => { const q = dd(d, x.exemplar); if (q < bd) { bd = q; best = i; } }); if (best >= 0 && bd < signTh) { V[best].count++; signOf.push(best); } else { V.push({ id: V.length, exemplar: d, count: 1 }); signOf.push(V.length - 1); } });
    const episodes = desc.length, vocab = V.length, recurrence = episodes ? +(1 - vocab / episodes).toFixed(3) : 0, holdFraction = +(holds / n).toFixed(3);
    const straightMean = episodes ? +(desc.reduce((s, d) => s + d.straight, 0) / episodes).toFixed(3) : 0;
    const revMean = episodes ? +(desc.reduce((s, d) => s + d.rev, 0) / episodes).toFixed(3) : 0;
    let spSum = 0, spN = 0; for (let k = 1; k < n; k++) { const v = speed(k); if (v > 0) { spSum += v; spN++; } }
    const speedMean = spN ? +(spSum / spN).toFixed(4) : 0;
    const feats = { recurrence, holdFraction, straightness: straightMean, reversals: revMean, speedMean };
    // the clip's OWN NUL: same motion, structure destroyed (recurrence 0, no holds)
    const nullFeats = { recurrence: 0, holdFraction: 0, straightness: straightMean, reversals: revMean, speedMean };
    const nul = opts.nul || null;
    if (nul && opts.learn !== false) nul.observe(nullFeats);      // the NUL learns what hands normally do
    const surprise = nul ? nul.surprise(feats) : { bits: +(Math.max(0, recurrence) + Math.max(0, holdFraction) * 3).toFixed(2), z: {} };
    let verdict = "undetermined";
    if (episodes >= 3 && recurrence >= 0.25) verdict = "signing";
    else if (episodes <= 2 || (recurrence < 0.15 && holdFraction < 0.15)) verdict = "moving";
    return { schema: "AlhazenGesture@1", width: w, height: h, frames: n,
             hands: { known: handFrames >= n * 0.3, handFrames, blobsPerFrame: hands.map((x) => x.length), signingSpace: roi, spaceArea: +((roi[2] * roi[3]) / N).toFixed(3) },
             noiseFloor: sig.noiseFloor, globalMotion: sig.globalMotion, episodes, vocabulary: vocab, recurrence, holdFraction,
             nul: { what: "what hands normally do (structure-destroyed hand motion)", features: nul ? { recurrence: nul.expected("recurrence"), holdFraction: nul.expected("holdFraction"), speedMean: nul.expected("speedMean") } : null, samples: nul ? nul.samples() : 0 },
             surprise, signedness: { verdict, features: feats, surpriseBits: surprise.bits, margin: +(recurrence - 0.25).toFixed(3) },
             timeline: desc.map((d, i) => ({ from: d.from, to: d.to, sign: signOf[i], move: [+d.disp[0].toFixed(3), +d.disp[1].toFixed(3)], reversals: d.rev })),
             standing: "CANDIDATE: hands = the SIGNAL blobs that move (never the big static body); signedness = SURPRISE against the NUL of what hands normally do (learned), not a fixed threshold" };
  }
  EYES.gesture = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 8) return { kind: "gesture", basis: "signedness from residual motion", coverage: 0, gap: "needs_frames", claims: [] };
    const g = readGesture(input.frames, opts);
    return { kind: "gesture", basis: "signal-vs-noise + signedness (surprise vs HandNul)", coverage: g.signedness ? 0.9 : 0, data: g, claims: [] };
  };

  // ── a HAND-LOCATION PRIOR (Janus-tier): where a hand TENDS to be RELATIVE TO
  // a body. Learned from observed (body, hand) pairs into a body-relative grid,
  // then used to PREDICT a hand's box when none is detected, and to score how
  // plausible a candidate hand's location is. This is the prior a reasoner
  // (Janus) can hold and Alhazen can consume as data.
  function createHandLocationPrior(seed) {
    const GX = (seed && seed.GX) || 5, GY = (seed && seed.GY) || 5;
    const st = (seed && seed.st) || { grid: Float64Array.from((seed && seed.grid) || new Array(GX * GY).fill(0)), n: (seed && seed.n) || 0, sizeSum: (seed && seed.sizeSum) || 0, sizeN: (seed && seed.sizeN) || 0 };
    const cell = (body, hand) => { const bx = body[0] + body[2] / 2, by = body[1] + body[3] / 2, bw = body[2], bh = body[3]; const rx = (hand[0] + hand[2] / 2 - bx) / bw + 0.5, ry = (hand[1] + hand[3] / 2 - by) / bh + 0.5; if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return -1; return Math.min(GY - 1, Math.floor(ry * GY)) * GX + Math.min(GX - 1, Math.floor(rx * GX)); };
    const observe = (body, hand) => { if (!body || !hand) return; const i = cell(body, hand); if (i < 0) return; st.grid[i]++; st.n++; st.sizeSum += hand[2] / body[2]; st.sizeN++; };
    const predict = (body, k) => { k = k || 2; if (!body || !st.n) return []; const bw = body[2], bh = body[3], bx = body[0] + bw / 2, by = body[1] + bh / 2, sizeRel = st.sizeN ? st.sizeSum / st.sizeN : 0.2; return [...st.grid].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, k).filter((c) => c.v > 0).map(({ i }) => { const rx = ((i % GX) + 0.5) / GX, ry = (((i / GX) | 0) + 0.5) / GY; const hx = bx + (rx - 0.5) * bw, hy = by + (ry - 0.5) * bh, hw = sizeRel * bw; return [Math.round(hx - hw / 2), Math.round(hy - hw / 2), Math.round(hw), Math.round(hw)]; }); };
    const plausibility = (body, hand) => { if (!body || !hand || !st.n) return 0; const i = cell(body, hand); if (i < 0) return 0; const mx = Math.max(...st.grid); return mx ? +(st.grid[i] / mx).toFixed(3) : 0; };
    return { schema: "HandLocationPrior@1", GX, GY, get n() { return st.n; }, get sizeSum() { return st.sizeSum; }, get sizeN() { return st.sizeN; }, get grid() { return Array.from(st.grid); }, samples: () => st.n, observe, predict, plausibility };
  }

  // ── HAND BEHAVIOUR: watch hand TRACKS and EXTRAPOLATE inferences about how
  // hands behave — speed, straightness, dwell, reversal rate, size vs body — as
  // named statements with running evidence, and predict the next position.
  function createHandBehavior(seed) {
    const S = seed && seed.st || seed || null;
    const mk = (o) => (o ? { n: o.n || 0, mean: o.mean || 0, M2: o.M2 || 0 } : { n: 0, mean: 0, M2: 0 });
    const st = S ? { speed: mk(S.speed), straight: mk(S.straight), dwell: mk(S.dwell), revPerSec: mk(S.revPerSec), sizeRel: mk(S.sizeRel) } : { speed: mk(), straight: mk(), dwell: mk(), revPerSec: mk(), sizeRel: mk() };
    const upd = (s, x) => { if (x == null || !isFinite(x)) return; const d = x - s.mean; s.n++; s.mean += d / s.n; s.M2 += d * (x - s.mean); };
    const sd = (s) => (s.n > 1 ? Math.sqrt(s.M2 / (s.n - 1)) : 0);
    const observeTrack = (track, opts) => {
      opts = opts || {}; const fps = opts.fps || 8, pts = (track || []).filter(Boolean);
      if (pts.length < 3) return;
      let path = 0, rev = 0, pdx = null, dwell = 0;
      for (let i = 1; i < pts.length; i++) { const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y; const step = Math.hypot(dx, dy); path += step; if (step < 1.2) dwell++; if (pdx != null && Math.sign(dx) !== Math.sign(pdx) && Math.abs(dx) > 1) rev++; pdx = dx; }
      const dur = (pts.length - 1) / fps, disp = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
      upd(st.speed, path / Math.max(0.1, dur)); upd(st.straight, path > 0 ? disp / path : 0); upd(st.dwell, dwell / (pts.length - 1)); upd(st.revPerSec, rev / Math.max(0.1, dur));
      if (pts[0].w) upd(st.sizeRel, pts[0].w);
    };
    const predictNext = (track, n) => { const pts = (track || []).filter(Boolean); if (!pts.length) return null; const k = Math.min(4, pts.length), a = pts[pts.length - k], b = pts[pts.length - 1]; const vx = (b.x - a.x) / Math.max(1, k - 1), vy = (b.y - a.y) / Math.max(1, k - 1); return { x: b.x + vx * (n || 1), y: b.y + vy * (n || 1), w: b.w, h: b.h, vx, vy }; };
    const inferences = () => { const r = (s) => +s.mean.toFixed(2); return [
      { about: "speed", claim: `hands move ~${r(st.speed)} px/frame (sd ${sd(st.speed).toFixed(2)})`, n: st.speed.n },
      { about: "straightness", claim: `hand paths are ~${r(st.straight)} straight (1=straight)`, n: st.straight.n },
      { about: "dwell", claim: `hands dwell (near-still) ~${(st.dwell.mean * 100).toFixed(0)}% of frames`, n: st.dwell.n },
      { about: "reversals", claim: `hands reverse direction ~${r(st.revPerSec)}/s`, n: st.revPerSec.n },
      { about: "size", claim: `a hand is ~${r(st.sizeRel)} px wide`, n: st.sizeRel.n },
    ]; };
    return { schema: "HandBehavior@1", n: () => st.speed.n, st, get behavior() { return { speed: +st.speed.mean.toFixed(2), straight: +st.straight.mean.toFixed(2), dwell: +st.dwell.mean.toFixed(3), reversalsPerSec: +st.revPerSec.mean.toFixed(2), sizeRel: +st.sizeRel.mean.toFixed(2) }; }, observeTrack, predictNext, inferences };
  }

  // ── HANDS: what it thinks are hands — compact, moving, ATTENDED blobs (an
  // articulator, not the body). Returns the hand regions over the clip and the
  // latest frame's boxes, so a surface can spotlight only the hands.
  function hands(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 4) return { schema: "AlhazenHands@1", gap: "needs_frames" };
    const w = frames[0].width, h = frames[0].height, N = w * h, thr = opts.threshold == null ? 70 : opts.threshold;
    const sg = signalFromNoise(frames, opts), E = sg.energy;
    const att = attention(frames, opts), mask = att.attended ? att.attended.mask : (sg.mask || null);
    const minH = opts.minHandArea || Math.max(8, Math.round(N * 0.0008)), maxH = opts.maxHandArea || Math.round(N * 0.08);
    const perFrame = [];
    for (let k = 0; k < n; k++) {
      const d = frames[k].data, bg = backgroundOf(d, w, h);
      const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
      const fg = new Uint8Array(N);
      for (let j = 0; j < N; j++) { if (mask && !mask[j]) continue; const i = j * 4; if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) > thr) fg[j] = 1; }
      const comps = segmentMask(fg, w, h, minH).map((c) => { const [x, y, ww, hh] = c.region; let e = 0; for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) e += E[yy * w + xx]; return { region: c.region, area: c.area, fill: c.area / (ww * hh), edens: e / Math.max(1, c.area) }; })
        .filter((c) => c.area <= maxH && c.fill >= 0.2).sort((a, b) => b.edens - a.edens).slice(0, 2);   // HANDS MOVE: rank by motion, not size
      perFrame.push(comps.map((c) => c.region));
    }
    const tracks = [];
    for (let k = 0; k < n; k++) for (const b of perFrame[k]) {
      const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2; let best = null, bd = 1e9;
      for (const t of tracks) { const dd = Math.hypot(cx - t.cx, cy - t.cy); if (dd < bd && k - t.last <= 4) { bd = dd; best = t; } }
      if (best && bd < w * 0.15) { best.cx = cx; best.cy = cy; best.last = k; best.n++; best.lastBox = b; }
      else tracks.push({ cx, cy, x0: b[0], y0: b[1], x1: b[0] + b[2], y1: b[1] + b[3], last: k, n: 1, lastBox: b });
    }
    const regions = tracks.filter((t) => t.n >= Math.max(3, n * 0.1)).sort((a, b) => b.n - a.n).slice(0, 2).map((t) => [t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0]);
    const current = tracks.filter((t) => t.last >= n - 5).sort((a, b) => b.n - a.n).slice(0, 2).map((t) => t.lastBox);   // the CURRENT frame's tight hand box(es)
    return { schema: "AlhazenHands@1", frames: n, framesWithHands: perFrame.filter((x) => x.length).length, count: regions.length,
             regions, latest: perFrame[n - 1] || [], current,
             standing: "hands = compact, moving, ATTENDED blobs (an articulator, not the body)" };
  }
  EYES.hands = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 4) return { kind: "hands", basis: "attended compact moving blobs", coverage: 0, gap: "needs_frames", claims: [] };
    const hh = hands(input.frames, opts);
    return { kind: "hands", basis: "attended compact moving blobs", coverage: hh.count ? 0.9 : 0, data: hh,
             claims: (hh.regions || []).map((r, i) => ({ key: "hand_" + i, kind: "hand", region: r, value: 1 })) };
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // THE SCENE, HOLONICALLY — operators used properly, and parts that NEST.
  //   NUL·Ground  the ground the scene is marked off from
  //   SEG·Figure  cut the frame into figures (foreground blobs)
  //   SIG·Figure  the body (persistent, large) and the hands (compact, moving)
  //   INS·Pattern type each figure as body-kind / hand-kind
  //   CON·Figure  bind each hand PART-OF its body — hands come with bodies —
  //               and record hand-body CONTACT (signing speaks with the body)
  //   SEG·Pattern the hand's movement, segmented into signs
  //   SYN·Ground  compose the holon tree: scene ⊃ body ⊃ hands
  //   EVA·Figure  signedness = surprise against the NUL of what hands normally do
  // The tree IS the format: a hand holon nests under a body holon, never floats
  // alone. Evidence: hands tend to come with bodies.
  // ═══════════════════════════════════════════════════════════════════════════
  function readScene(frames, opts) {
    opts = opts || {};
    const n = (frames && frames.length) || 0;
    if (n < 6) return { schema: "AlhazenScene@1", gap: "needs_frames" };
    const w = frames[0].width, h = frames[0].height, N = w * h, thr = opts.threshold == null ? 70 : opts.threshold;
    const O = (op, grain, terrain) => ({ op, grain, terrain });
    const sig = signalFromNoise(frames, opts);
    const att = attention(frames, opts), sigMask = att.attended ? att.attended.mask : (sig.mask || null);
    const fgs = [], perHands = [], persist = new Float32Array(N);
    for (let k = 0; k < n; k++) {
      const d = frames[k].data, bg = backgroundOf(d, w, h);
      const bgR = parseHex(bg.hex, 0), bgG = parseHex(bg.hex, 1), bgB = parseHex(bg.hex, 2);
      const fg = new Uint8Array(N), fgAll = new Uint8Array(N);
      for (let j = 0; j < N; j++) { const i = j * 4, far = Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) > thr; if (far) { fgAll[j] = 1; if (!sigMask || sigMask[j]) fg[j] = 1; } }
      fgs.push(fg);
      for (let j = 0; j < N; j++) if (fgAll[j]) persist[j]++;
      const comps = segmentMask(fg, w, h, Math.max(12, Math.round(N * 0.001))).filter((c) => c.area <= N * 0.12).sort((a, b) => b.area - a.area);
      perHands.push(comps.slice(0, 2).map((c) => ({ region: c.region, cx: (c.region[0] + c.region[2] / 2) / w, cy: (c.region[1] + c.region[3] / 2) / h, area: c.area })));
    }
    // SIG·Figure — the body is the persistent, large figure
    const bodyMask = new Uint8Array(N); for (let j = 0; j < N; j++) if (persist[j] >= n * 0.6) bodyMask[j] = 1;
    const bodyComp = segmentMask(bodyMask, w, h, Math.max(24, Math.round(N * 0.02))).sort((a, b) => b.area - a.area)[0] || null;
    const bb = bodyComp ? bodyComp.region : null;
    const partOf = (x, y) => { if (!bb) return "space"; const fx = (x - bb[0]) / bb[2], fy = (y - bb[1]) / bb[3]; if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return "space"; if (fy < 0.22) return "head"; if (fy < 0.55) return "chest"; if (fy < 0.8) return "waist"; return "base"; };
    const prim = []; let prev = null;
    for (const hs of perHands) { let pick = null; if (prev) { let bd = 1e9; for (const c of hs) { const d = Math.hypot(c.cx - prev.cx, c.cy - prev.cy); if (d < bd) { bd = d; pick = c; } } } if (!pick && hs.length) pick = hs[0]; prim.push(pick); if (pick) prev = pick; }
    const handFrames = prim.filter(Boolean).length, handRegions = prim.filter(Boolean).map((p) => p.region);
    // CON·Figure — bind hands to the body, and record body contact
    const relations = [];
    if (bb && handFrames) relations.push({ op: "CON", grain: "Figure", terrain: "Link", end1: "whole.body.hand[0]", label: "part-of", end2: "whole.body", because: "hands come with bodies" });
    if (!bb && handFrames) relations.push({ op: "CON", grain: "Figure", terrain: "Link", end1: "whole.hand[0]", label: "unanchored", end2: null, because: "a hand was seen with no body found" });
    if (bb) { const bcx = bb[0] + bb[2] / 2, bcy = bb[1] + bb[3] / 2, bd = Math.hypot(bb[2], bb[3]); const contacts = {}; for (const p of prim) { if (!p) continue; const part = partOf(p.cx * w, p.cy * h); if (part !== "space" && Math.hypot(p.cx * w - bcx, p.cy * h - bcy) / bd < 0.6) contacts[part] = (contacts[part] || 0) + 1; } for (const part of Object.keys(contacts)) relations.push({ op: "CON", grain: "Figure", terrain: "Link", end1: "whole.body.hand[0]", label: "contacts", end2: "whole.body." + part, n: contacts[part] }); }
    // EVA·Figure — signedness against the NUL
    const g = readGesture(frames, opts);
    // SYN·Ground — the holon tree (parts inside wholes)
    const handHolon = { path: "whole.body.hand[0]", role: "hand", kind: "hand", region: handRegions[0] || null, parts: [{ role: "handshape", op: "SEG" }, { role: "movement", op: "CON" }] };
    const bodyHolon = { path: "whole.body", role: "body", kind: "body", region: bb, parts: handFrames ? [handHolon] : [] };
    const holon = { path: "whole", role: "scene", parts: bb || handFrames ? [bodyHolon] : [] };
    const operators = [O("NUL", "Ground", "Void"), O("SEG", "Figure", "Link"), O("SIG", "Figure", "Entity"), O("INS", "Pattern", "Kind"), O("CON", "Figure", "Link"), O("SEG", "Pattern", "Network"), O("SYN", "Ground", "Field"), O("EVA", "Figure", "Lens")];
    return { schema: "AlhazenScene@1", width: w, height: h, frames: n,
             ground: { noiseFloor: sig.noiseFloor, globalMotion: sig.globalMotion, signalShare: sig.signalShare },
             holon, relations, operators, handsKnown: handFrames >= n * 0.3, body: bb ? { region: bb, n: persist ? 1 : 0 } : null, handsPerFrame: prim.map((p) => p ? { x: Math.round(p.cx * w), y: Math.round(p.cy * h), w: p.region[2], h: p.region[3] } : null),
             signedness: g.signedness, surprise: g.surprise, nul: g.nul,
             standing: "holonic: scene (SYN) ⊃ BODY holon (SIG) ⊃ HAND holons (SEG/SIG) bound part-of (CON); hands come with bodies; signedness is EVA vs the NUL" };
  }
  EYES.scene = (input, opts) => {
    if (!input || !input.frames || input.frames.length < 6) return { kind: "scene", basis: "holonic scene", coverage: 0, gap: "needs_frames", claims: [] };
    return { kind: "scene", basis: "holonic + operators", coverage: 0.9, data: readScene(input.frames, opts), claims: [] };
  };

  return { binarizeData, binarizeCanvas, valueFormat, extractFormFields, snake, titleLine, readGridFromElements, readGridFromText, inventTuples, structuralProposer,
           frameStats, palette, backgroundOf, inkMask, segmentMask, classifyRegion, textBands, classifyScene, readImage,
           learnFrom, applyRules, scoreRead, createRuleLedger, createFieldPriors,
           overlapFrac, roleClass, layersOf, read3D, readPointCloud, liftTo3D, EYES, sniff, reconcile, look,
           trailToRGBA, read4D, trackMotions, trackObjects, motionBlurOfImage, createPheromone, prepare, runEye, swarm,
           depthFromCues, stereoDepth, motionParallax, perceiveDepth, skinMask, detectFaces, learnSalience, readSigns,
           signalFromNoise, estimateGlobalShift, readGesture, createHandNul, createHandVibe, createBodyVibe, handAppearance, readScene, attention, hands, createHandLocationPrior, createHandBehavior };
});
