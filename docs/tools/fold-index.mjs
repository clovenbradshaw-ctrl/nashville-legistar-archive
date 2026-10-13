// fold-index.mjs — replay the append-only index log into the current view
// (current.json): the materialized fold the surface loads. Disposable and
// rebuildable; the log remains the source of truth.
//
// Usage: node tools/fold-index.mjs --out store/nashville

import { join } from 'node:path';
import { foldIndex } from './index-log.mjs';

const a = Object.fromEntries(process.argv.slice(2).flatMap((x, i, arr) => (x.startsWith('--') ? [[x.slice(2), arr[i + 1]]] : [])));
const out = a.out || 'store/corpus';
const stats = foldIndex({ logPath: join(out, 'index.log.jsonl'), vectorsPath: join(out, 'vectors.f16'), outPath: join(out, 'current.json') });
console.log(`fold: ${stats.items} items, ${stats.chunks} chunks, dim ${stats.dim}, ${stats.rows} vector rows, from ${stats.records} log records`);
