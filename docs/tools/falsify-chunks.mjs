// falsify-chunks.mjs — is ~1200-char chunking enough to be useful?
//
// Falsification design:
//  * Localization probes: a verbatim 17-word window taken from DEEP in each
//    document (>6000 chars) must retrieve that document's chunk AND overlap the
//    true span. If chunk-level can't place a query deep in a long doc the way
//    item-level(6000) provably can't, chunking isn't enough.
//  * Baselines: item-level (first 6000 chars only) and a random null, same probes.
//  * Chunk sizes compared: 600 / 1200 / 2400 (15% overlap).
//
// Usage: node tools/falsify-chunks.mjs --dir corpus/nashville [--perdoc 2]

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const dir = args.dir || 'corpus/nashville';
const perDoc = parseInt(args.perdoc || '2', 10);
const OLLAMA = 'http://127.0.0.1:11435';
const MODEL = 'nomic-embed-text';

const docs = readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => ({ id: f.replace(/\.txt$/, ''), text: readFileSync(join(dir, f), 'utf8') }));

async function embedBatch(input) {
  const r = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, input }) });
  if (!r.ok) throw new Error('embed ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return (await r.json()).embeddings;
}
async function embedMany(texts, label) {
  const out = [];
  const B = 16;
  for (let i = 0; i < texts.length; i += B) {
    const embs = await embedBatch(texts.slice(i, i + B));
    for (const e of embs) out.push(e);
    if ((i / B) % 20 === 0) process.stderr.write(`  ${label} ${Math.min(i + B, texts.length)}/${texts.length}\n`);
  }
  return out;
}
function norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }
function chunk(text, size, overlap = 0.15) {
  const step = Math.max(1, Math.floor(size * (1 - overlap)));
  const out = [];
  for (let s = 0; s < text.length; s += step) {
    const e = Math.min(text.length, s + size);
    out.push({ s, e, text: text.slice(s, e) });
    if (e >= text.length) break;
  }
  return out;
}

// ---- probes: 17-word windows starting beyond char 6000 ----
const probes = [];
for (const d of docs) {
  const words = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(d.text))) words.push([m.index, m.index + m[0].length]);
  const deep = words.filter(([s]) => s > 6000);
  for (let k = 0; k < perDoc && deep.length; k++) {
    const j = Math.floor(Math.random() * Math.max(1, deep.length - 17));
    const s = deep[j][0], e = deep[Math.min(deep.length - 1, j + 16)][1];
    probes.push({ id: d.id, s, e, q: d.text.slice(s, e).replace(/\s+/g, ' ').trim() });
  }
}
const N = probes.length;
process.stderr.write(`${docs.length} docs, ${N} deep probes\n`);

// ---- item-level baseline (first 6000 chars) ----
const itemVecs = (await embedMany(docs.map((d) => d.text.slice(0, 6000)), 'item')).map(norm);
function top1(vecs, qv) { let bi = -1, bs = -1; for (let i = 0; i < vecs.length; i++) { let s = 0; const a = vecs[i], q = qv; for (let j = 0; j < a.length; j++) s += a[j] * q[j]; if (s > bs) { bs = s; bi = i; } } return [bi, bs]; }

// ---- run each chunk size + null ----
const results = [];
for (const size of [600, 1200, 2400]) {
  const chunks = [];
  for (const d of docs) for (const c of chunk(d.text, size)) chunks.push({ id: d.id, ...c });
  const vecs = (await embedMany(chunks.map((c) => c.text), `chunk${size}`)).map(norm);
  const nullv = chunks.map(() => norm(Array.from({ length: 768 }, () => Math.random() * 2 - 1)));

  let docHit = 0, spanHit = 0, nullHit = 0;
  for (const p of probes) {
    const qv = norm((await embedBatch([p.q]))[0]);
    const [ci] = top1(vecs, qv); const c = chunks[ci];
    if (c.id === p.id) docHit++;
    if (c.id === p.id && c.s < p.e && c.e > p.s) spanHit++;
    const [ni] = top1(nullv, qv); if (chunks[ni].id === p.id) nullHit++;
  }
  results.push({ size, chunks: chunks.length, docHit, spanHit, nullHit, N });
  process.stderr.write(`size ${size}: ${chunks.length} chunks, docHit ${docHit}/${N}, spanHit ${spanHit}/${N}, nullHit ${nullHit}/${N}\n`);
}

// ---- item-level probe hit ----
let itemDocHit = 0;
for (const p of probes) { const qv = norm((await embedBatch([p.q]))[0]); const [bi] = top1(itemVecs, qv); if (docs[bi].id === p.id) itemDocHit++; }

console.log('\n=== localization of deep content (>6000 chars) over ' + N + ' probes across ' + docs.length + ' docs ===');
console.log(`item-level (first 6000 chars only): docHit@1 ${itemDocHit}/${N} (${(itemDocHit / N * 100).toFixed(0)}%)`);
for (const r of results) console.log(`chunk ${String(r.size).padStart(4)} (${r.chunks} chunks): docHit@1 ${r.docHit}/${N} (${(r.docHit / N * 100).toFixed(0)}%), spanHit@1 ${r.spanHit}/${N} (${(r.spanHit / N * 100).toFixed(0)}%), null docHit ${r.nullHit}/${N}`);
