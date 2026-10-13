// index-log.mjs — the append-only index: a JSONL log of records (the source of
// truth) plus an append-only fp16 vector sidecar, and a fold that materializes
// the current view (fold-index.mjs). Nothing in the log is ever rewritten;
// retractions are tombstones; re-embedding appends new vector rows tagged with
// their model. The fold is disposable and rebuildable by replaying the log.

import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function readLog(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function appendLog(path, recs) {
  appendFileSync(path, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// ---- fp16 sidecar -------------------------------------------------------
export function f32ToHalfBytes(f32) {
  const out = Buffer.alloc(f32.length * 2);
  for (let i = 0; i < f32.length; i++) {
    const x = f32[i];
    let h;
    const f32buf = new Float32Array(1); f32buf[0] = x;
    const u = new Uint32Array(f32buf.buffer)[0];
    const sign = (u >> 16) & 0x8000;
    let exp = (u >> 23) & 0xff, mant = u & 0x7fffff;
    if (exp === 255) { h = sign | 0x7c00 | (mant ? 0x200 : 0); }
    else {
      exp = exp - 127 + 15;
      if (exp <= 0) { h = sign; }
      else if (exp >= 31) { h = sign | 0x7c00; }
      else { h = sign | (exp << 10) | (mant >> 13); }
    }
    out.writeUInt16LE(h, i * 2);
  }
  return out;
}
export function halfBytesToF32(buf) {
  const out = new Float32Array(buf.length / 2);
  for (let i = 0; i < out.length; i++) {
    const h = buf.readUInt16LE(i * 2);
    const sign = (h & 0x8000) ? -1 : 1, exp = (h >> 10) & 0x1f, mant = h & 0x3ff;
    let v;
    if (exp === 0) v = mant * Math.pow(2, -24);
    else if (exp === 31) v = mant ? NaN : Infinity;
    else v = (1 + mant / 1024) * Math.pow(2, exp - 15);
    out[i] = sign * v;
  }
  return out;
}
export function appendVectors(path, rows) { // rows: Float32Array[] (already dim-length)
  const buf = Buffer.concat(rows.map(f32ToHalfBytes));
  appendFileSync(path, buf);
  return buf.length / (rows[0].length * 2); // rows written
}

// ---- fold ---------------------------------------------------------------
export function foldIndex({ logPath, vectorsPath, outPath }) {
  const recs = readLog(logPath);
  const items = new Map();
  const tombstones = new Set();
  let model = null, dim = null, maxRow = -1;
  for (const r of recs) {
    if (r.op === 'doc') items.set(r.id, { id: r.id, title: r.title, pointer: r.pointer, tags: r.tags, chunks: [] });
    else if (r.op === 'chunk') { const it = items.get(r.id); if (it) it.chunks[r.chunk] = { off: r.span, row: null, model: null }; }
    else if (r.op === 'vector') { const it = items.get(r.id); if (it && it.chunks[r.chunk]) { it.chunks[r.chunk].row = r.row; it.chunks[r.chunk].model = r.model; model = r.model; dim = r.dim; if (r.row > maxRow) maxRow = r.row; } }
    else if (r.op === 'tombstone') tombstones.add(r.id);
  }
  for (const id of tombstones) items.delete(id);
  const out = { schema: 'HolodeckIndexFold@1', generated: new Date().toISOString(), model, dim, vector: { file: 'vectors.f16', rows: maxRow + 1 }, items: [...items.values()].filter((it) => it.chunks.length) };
  writeFileSync(outPath, JSON.stringify(out));
  return { items: out.items.length, chunks: out.items.reduce((a, i) => a + i.chunks.length, 0), dim, model, rows: maxRow + 1, records: recs.length };
}
