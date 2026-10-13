// fetch-corpus.mjs — fetch a corpus's full text ONCE into a plain directory,
// resumably, so embeddings can be built over full text (not just impressions).
//
// Resolver-agnostic in shape: it fetches {id, url} pairs and writes <id>.txt.
// The default list builder is archive.org's metadata search (one resolver); a
// different source is a different list builder, not a different tool.
//
// Usage:
//   node tools/fetch-corpus.mjs --archive-query 'identifier:nashville-epav-contract-*' \
//        --out corpus/nashville --proxy --workers 6 --min 500

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, arr) => (a.startsWith('--') ? [[a.slice(2), arr[i + 1]]] : [])));
const out = args.out || 'corpus/corpus';
const proxy = 'proxy' in args;
const workers = parseInt(args.workers || '6', 10);
const minBytes = parseInt(args.min || '500', 10);
const textFile = args['text-file'] || 'extracted-text.txt';
const PROXY = 'https://holodeck-proxy.prometheoid.workers.dev/raw?url=';
mkdirSync(out, { recursive: true });

let list = [];
if (args.list) list = JSON.parse(readFileSync(args.list, 'utf8'));
else if (args['archive-query']) {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(args['archive-query'])}&fl%5B%5D=identifier&rows=1000&output=json`;
  const j = await (await fetch(url)).json();
  list = j.response.docs.map((d) => ({ id: d.identifier, url: `https://archive.org/download/${d.identifier}/${textFile}` }));
}
console.log(`${list.length} candidate item(s)`);

const wrap = (u) => (proxy ? PROXY + encodeURIComponent(u) + '&timeout=30000' : u);
let done = 0, skipped = 0, failed = 0;

async function one(item) {
  const dest = join(out, `${item.id.replace(/[^\w.-]/g, '_')}.txt`);
  if (existsSync(dest)) { skipped++; return; }
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(wrap(item.url), { redirect: 'follow' });
      if (r.status === 200) {
        const text = await r.text();
        if (Buffer.byteLength(text, 'utf8') >= minBytes) { writeFileSync(dest, text); done++; }
        else skipped++;
        return;
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1500 * (a + 1)));
  }
  failed++;
}

const queue = [...list];
await Promise.all(Array.from({ length: workers }, async () => {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    await one(item);
    if ((done + skipped + failed) % 25 === 0) process.stderr.write(`  ${done} fetched, ${skipped} skipped, ${failed} failed\n`);
  }
}));
console.log(`done: ${done} fetched, ${skipped} skipped, ${failed} failed -> ${out}`);
