// build-embeddings.mjs — build the search-only vector index (T4) over a packed
// corpus. Item-level: one normalized vector per item, from its impression text.
// Embeddings are a retrieval aid, never evidence — this builder also emits a
// random null of the same shape so a query's lift can be measured, not asserted.
//
// Usage: node tools/build-embeddings.mjs --store store/nashville [--model nomic-embed-text] [--limit N] [--maxchars 6000]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const store = args.store || 'store/nashville';
const model = args.model || 'nomic-embed-text';
const maxChars = parseInt(args.maxchars || '6000', 10);
const limit = args.limit ? parseInt(args.limit, 10) : 0;
const OLLAMA = args.ollama || 'http://127.0.0.1:11435';

const hot = JSON.parse(readFileSync(join(store, 'hot.json'), 'utf8'));
const cold = readFileSync(join(store, hot.cold.file));
const dec = new TextDecoder();
const items = limit ? hot.items.slice(0, limit) : hot.items;
const texts = items.map((it) => dec.decode(cold.subarray(it.off[0], it.off[1])).slice(0, maxChars));

async function embedBatch(input) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  return (await r.json()).embeddings;
}
function l2(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }

const B = 16;
const rows = [];
for (let i = 0; i < texts.length; i += B) {
  const embs = await embedBatch(texts.slice(i, i + B));
  for (const e of embs) rows.push(l2(e));
  if ((i / B) % 10 === 0) process.stderr.write(`  ${Math.min(i + B, texts.length)}/${texts.length}\n`);
}
const dim = rows[0].length;
const count = rows.length;

const f32 = new Float32Array(count * dim);
rows.forEach((v, i) => f32.set(v, i * dim));
writeFileSync(join(store, 'vectors.f32'), Buffer.from(f32.buffer));

// null control: random unit vectors, same shape
const nullf = new Float32Array(count * dim);
for (let i = 0; i < count; i++) {
  const v = new Float32Array(dim);
  let s = 0;
  for (let j = 0; j < dim; j++) { v[j] = Math.random() * 2 - 1; s += v[j] * v[j]; }
  s = Math.sqrt(s) || 1;
  for (let j = 0; j < dim; j++) nullf[i * dim + j] = v[j] / s;
}
writeFileSync(join(store, 'null.f32'), Buffer.from(nullf.buffer));

const meta = { schema: 'HolodeckVectors@1', model, dim, count, maxChars, generated: new Date().toISOString(), ids: items.map((it) => it.id) };
writeFileSync(join(store, 'vecmeta.json'), JSON.stringify(meta));
console.log(`embedded ${count} items, dim ${dim} -> vectors.f32 (${(count * dim * 4 / 1048576).toFixed(1)} MB) + null.f32`);
