// build-index.mjs — append chunks + vectors for a corpus into the append-only
// index (index.log.jsonl + vectors.f16). Idempotent: documents already in the
// log are skipped, so re-running only adds new ones.
//
// Usage:
//   node tools/build-index.mjs --corpus corpus/nashville --out store/nashville \
//        [--chunk 800] [--overlap 0.15] [--dim 256] [--model nomic-embed-text]

import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLog, appendLog, appendVectors } from './index-log.mjs';

const a = Object.fromEntries(process.argv.slice(2).flatMap((x, i, arr) => (x.startsWith('--') ? [[x.slice(2), arr[i + 1]]] : [])));
const out = a.out || 'store/corpus';
const chunkChars = parseInt(a.chunk || '800', 10);
const overlap = parseFloat(a.overlap || '0.15');
const dim = parseInt(a.dim || '256', 10);
const model = a.model || 'nomic-embed-text';
const limit = a.limit ? parseInt(a.limit, 10) : 0;
const OLLAMA = a.ollama || 'http://127.0.0.1:11435';

mkdirSync(out, { recursive: true });
const LOG = join(out, 'index.log.jsonl');
const VEC = join(out, 'vectors.f16');

// load documents
let docs = [];
if (a.corpus) {
  docs = readdirSync(a.corpus).filter((f) => f.endsWith('.txt')).map((f) => ({ id: f.replace(/\.txt$/, ''), title: f.replace(/\.txt$/, ''), text: readFileSync(join(a.corpus, f), 'utf8') }));
} else if (a.items) {
  docs = JSON.parse(readFileSync(a.items, 'utf8')).map((it) => ({ id: it.id, title: it.title, pointer: it.pointer, tags: it.tags, text: it.text }));
}
if (limit) docs = docs.slice(0, limit);

const existing = readLog(LOG);
const done = new Set(existing.filter((r) => r.op === 'doc').map((r) => r.id));
let row = existing.filter((r) => r.op === 'vector').length;
process.stderr.write(`${docs.length} docs, ${done.size} already in log, next row ${row}\n`);

const l2 = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); };
const chunk = (t) => { const step = Math.max(1, Math.floor(chunkChars * (1 - overlap))), o = []; for (let s = 0; s < t.length; s += step) { const e = Math.min(t.length, s + chunkChars); o.push({ s, e, text: t.slice(s, e) }); if (e >= t.length) break; } return o; };
async function embedBatch(input) {
  const r = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, input }) });
  if (!r.ok) throw new Error('embed ' + r.status + ' ' + (await r.text()).slice(0, 100));
  return (await r.json()).embeddings;
}

let added = 0;
for (const d of docs) {
  if (done.has(d.id) || !d.text || !d.text.trim()) continue;
  const chunks = chunk(d.text);
  if (!chunks.length) continue;
  const recs = [{ v: 1, op: 'doc', id: d.id, title: d.title || d.id, pointer: d.pointer || null, tags: d.tags || null, chars: d.text.length, at: new Date().toISOString() }];
  const rows = [];
  for (let i = 0; i < chunks.length; i += 16) {
    const embs = await embedBatch(chunks.slice(i, i + 16).map((c) => 'search_document: ' + c.text));
    for (const e of embs) rows.push(l2(e.slice(0, dim)));
  }
  appendVectors(VEC, rows);
  for (let k = 0; k < chunks.length; k++) {
    recs.push({ v: 1, op: 'chunk', id: d.id, chunk: k, span: [chunks[k].s, chunks[k].e] });
    recs.push({ v: 1, op: 'vector', id: d.id, chunk: k, model, dim, row: row + k });
  }
  appendLog(LOG, recs);
  row += rows.length;
  added++;
  process.stderr.write(`  + ${d.id}: ${chunks.length} chunks (row ${row})\n`);
}
console.log(`appended ${added} doc(s), ${row} vector rows total -> ${out}`);
