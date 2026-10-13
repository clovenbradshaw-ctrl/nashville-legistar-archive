// build-figures.mjs — ingest every contract's text as sectioned, keyed, nested
// JSON, once, into figures/<token>.json. The app READS these files for the
// "Extracted figures" page instead of extracting live.
//
// Text source: the full OCR text (ocr/<token>.json, pages joined) when present,
// else the seed excerpt. Resumable (skips finished tokens).
//
// Usage: node tools/build-figures.mjs [--seed …] [--outdir figures] [--workers 6]

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureTable } from '../holodeck-figures.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).flatMap(a => a.startsWith('--') ? [[a.slice(2), process.argv[process.argv.indexOf(a) + 1]]] : []));
const outdir = args.outdir || join(ROOT, 'figures');
const workers = parseInt(args.workers || '6', 10);
mkdirSync(outdir, { recursive: true });

const seed = JSON.parse(readFileSync(args.seed || join(ROOT, 'nashville-contracts-seed.json'), 'utf8'));
const ocrDir = join(ROOT, 'ocr');
// the learned section lexicon + structure (from tools/train-sections.mjs / train-structure.mjs)
let lexicon = null, structure = null;
try { const sp = join(ROOT, 'figures', '_sections.json'); if (existsSync(sp)) lexicon = new Set(JSON.parse(readFileSync(sp, 'utf8')).sections.map(s => s.name)); } catch (e) {}
try { const stp = join(ROOT, 'figures', '_structure.json'); if (existsSync(stp)) structure = JSON.parse(readFileSync(stp, 'utf8')); } catch (e) {}
if (structure) console.log('structure model:', structure.sections.length, 'learned sections');
else if (lexicon) console.log('lexicon:', lexicon.size, 'learned sections');
const fullText = tok => {
  const p = join(ocrDir, tok + '.json');
  if (existsSync(p)) { try { const pages = JSON.parse(readFileSync(p, 'utf8')); const t = pages.map(pg => pg.text || '').join('\n'); if (t.trim()) return t; } catch (e) {} }
  return null;
};

const todo = seed.filter(x => !existsSync(join(outdir, x.id.replace(/^nash-/, '') + '.json')));
console.log('contracts', seed.length, '· to build', todo.length, '· out', outdir);

let done = 0, fromOcr = 0, failed = 0;
async function work() {
  while (todo.length) {
    const x = todo.shift(); const tok = x.id.replace(/^nash-/, '');
    try {
      const full = fullText(tok); if (full) fromOcr++;
      const table = figureTable(full || x.text || '', { lexicon, structure });
      writeFileSync(join(outdir, tok + '.json'), JSON.stringify({ id: tok, title: x.title, source: full ? 'ocr' : 'seed', ...table }));
      done++;
    } catch (e) { failed++; console.log('ERR', tok, e.message); }
  }
}
await Promise.all(Array.from({ length: workers }, work));
console.log(`done: ${done} (${fromOcr} from full OCR text), ${failed} failed`);
