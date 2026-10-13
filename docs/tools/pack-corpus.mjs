// pack-corpus.mjs — pack a normalized corpus into the holodeck's two-tier
// store: a small hot index (metadata + byte offsets) and a packed UTF-8 cold
// blob of impressions. Generic: it knows nothing about any particular corpus
// or archive; it reads items.json and writes hot.json + impressions.bin.
//
// Item shape (input):
//   { id, title, type?, year?, pointer?{resolver,url,id}, tags?, text }
//
// Output:
//   <out>/hot.json          { schema, corpus, generated, cold, items[] }
//   <out>/impressions.bin   concatenated UTF-8 impression text
//
// Usage: node tools/pack-corpus.mjs --input items.json --name nashville --out store/nashville

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const input = args.input || 'items.json';
const name = args.name || 'corpus';
const out = args.out || join('store', name);

const items = JSON.parse(readFileSync(input, 'utf8'));
mkdirSync(out, { recursive: true });

const chunks = [];
let offset = 0;
const hot = [];
for (const it of items) {
  if (!it || typeof it.id !== 'string') throw new Error('item missing id');
  const bytes = Buffer.from(String(it.text ?? ''), 'utf8');
  const start = offset;
  chunks.push(bytes);
  offset += bytes.length;
  hot.push({
    id: it.id,
    title: it.title ?? it.id,
    ...(it.type ? { type: it.type } : {}),
    ...(it.year != null ? { year: it.year } : {}),
    ...(it.pointer ? { pointer: it.pointer } : {}),
    ...(it.tags ? { tags: it.tags } : {}),
    off: [start, start + bytes.length],
  });
}

const cold = Buffer.concat(chunks);
const sha256 = createHash('sha256').update(cold).digest('hex');
writeFileSync(join(out, 'impressions.bin'), cold);

const doc = {
  schema: 'HolodeckStore@1',
  corpus: name,
  generated: new Date().toISOString(),
  cold: { file: 'impressions.bin', bytes: cold.length, sha256 },
  items: hot,
};
writeFileSync(join(out, 'hot.json'), JSON.stringify(doc));

const hotBytes = JSON.stringify(doc).length;
console.log(`packed ${hot.length} items`);
console.log(`  hot.json       ${hotBytes.toLocaleString()} bytes (${(hotBytes / 1024).toFixed(0)} KB) — resident`);
console.log(`  impressions.bin ${cold.length.toLocaleString()} bytes (${(cold.length / 1048576).toFixed(2)} MB) — cold/OPFS`);
console.log(`  -> ${out}`);
