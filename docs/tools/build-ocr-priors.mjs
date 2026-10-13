// build-ocr-priors.mjs — the priors the Extracted tab folds a scan's OCR against: what words, and which word
// pairs, the REST of the sample reads. Counted as DOCUMENT frequency (how many contracts contain it), so a page's
// own misreads cannot vouch for themselves: the page subtracts its own document before it asks.
//
// Reads ocr/<token>.json (tools/build-epav-ocr.mjs), writes ocr-priors.json:
//   { docs, words: { word: df }, pairs: { "a b": df } }      only entries held by two or more documents.
//
// Usage: node tools/build-ocr-priors.mjs [--ocr ocr] [--out ocr-priors.json]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = resolve(ROOT, arg('ocr', 'ocr')), out = resolve(ROOT, arg('out', 'ocr-priors.json'));
const core = (t) => { const m = /^[^A-Za-z]*([A-Za-z]+(?:['’][A-Za-z]+)?)[^A-Za-z]*$/.exec(t || ''); return m ? m[1].toLowerCase().replace(/’/g, "'") : null; };
const wdf = new Map(), pdf = new Map(); let docs = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  let rec; try { rec = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch (e) { continue; }
  if (!Array.isArray(rec)) continue;
  docs++; const ws = new Set(), ps = new Set();
  for (const pg of rec) { let prev = null;
    for (const e of pg.elements || []) { const w = core(e.text); if (!w || w.length < 2) { prev = null; continue; } ws.add(w); if (prev) ps.add(prev + ' ' + w); prev = w; } }
  ws.forEach((w) => wdf.set(w, (wdf.get(w) || 0) + 1)); ps.forEach((p) => pdf.set(p, (pdf.get(p) || 0) + 1));
}
const words = {}, pairs = {};
for (const [w, n] of wdf) if (n >= 2) words[w] = n;
for (const [p, n] of pdf) if (n >= 2 && words[p.split(' ')[0]] && words[p.split(' ')[1]]) pairs[p] = n;
writeFileSync(out, JSON.stringify({ docs, words, pairs }));
console.log(`docs ${docs} · words seen ${wdf.size} → kept ${Object.keys(words).length} (in 2+ docs) · pairs kept ${Object.keys(pairs).length} · ${out}`);
