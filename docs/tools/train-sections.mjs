// train-sections.mjs — train the extractor on the corpus.
//
// Metro's contracts share one template, so their section headings repeat across
// hundreds of documents. This pass reads every contract's text, harvests heading
// candidates, counts how often each normalized heading recurs (document
// frequency), and writes the learned section lexicon to figures/_sections.json:
// the canonical section names, their surface variants, and a pattern to find
// each one. The extractor then matches these learned sections instead of
// guessing.
//
// Usage: node tools/train-sections.mjs [--seed nashville-contracts-seed.json]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).flatMap(a => a.startsWith('--') ? [[a.slice(2), process.argv[process.argv.indexOf(a) + 1]]] : []));
const seed = JSON.parse(readFileSync(args.seed || join(ROOT, 'nashville-contracts-seed.json'), 'utf8'));

const textOf = tok => { const p = join(ROOT, 'ocr', tok + '.json'); if (existsSync(p)) { try { const pages = JSON.parse(readFileSync(p, 'utf8')); const t = pages.map(pg => pg.text || '').join('\n'); if (t.trim()) return t; } catch (e) {} } const s = seed.find(x => x.id.replace(/^nash-/, '') === tok); return (s && s.text) || ''; };

// a heading candidate: short, no figure, not a key:value, and numbered / ALL CAPS / Title Case
const HEAD = /^(\d{1,2}(?:\.\d+){0,3})\.?\s+([A-Z][A-Za-z][\w \/&'’.,-]{2,54})$/;
const norm = s => s.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
const forms = new Map(); // normalized name -> { df:Set, surfaces:Map, numbered:0, caps:0 }
let docs = 0;
for (const x of seed) {
  const tok = x.id.replace(/^nash-/, ''); const t = textOf(tok); if (!t) continue; docs++;
  const seen = new Set();
  for (let line of t.split(/\r?\n/)) {
    line = line.trim(); if (!line || line.length > 64) continue;
    const m = HEAD.exec(line); let name = null, numbered = false, caps = false;
    if (m) { name = m[2]; numbered = true; }
    else if (/^[A-Z][A-Z0-9 \/&'’.,-]{3,50}$/.test(line) && /[A-Z]{3,}/.test(line)) { name = line; caps = true; }
    else continue;
    const n = norm(name); if (!n || n.length < 3 || seen.has(n)) continue; seen.add(n);
    const f = forms.get(n) || forms.set(n, { df: new Set(), surfaces: new Map(), numbered: 0, caps: 0 }).get(n);
    f.df.add(tok); f.surfaces.set(name.trim(), (f.surfaces.get(name.trim()) || 0) + 1); if (numbered) f.numbered++; if (caps) f.caps++;
  }
}

const learned = [...forms.entries()].map(([name, f]) => ({ name, df: f.df.size, numbered: f.numbered, caps: f.caps, surfaces: [...f.surfaces.keys()].slice(0, 5) }))
  .filter(x => x.df >= Math.max(3, Math.round(docs * 0.03)))
  .sort((a, b) => b.df - a.df);

const out = { documents: docs, sections: learned };
writeFileSync(join(ROOT, 'figures', '_sections.json'), JSON.stringify(out, null, 1));
console.log('trained on', docs, 'contracts · learned sections (df>=3%):', learned.length);
learned.slice(0, 30).forEach(s => console.log(`  ${String(s.df).padStart(3)}  ${s.caps ? 'CAPS ' : ''}${s.numbered ? 'num  ' : ''} "${s.name}"  e.g. ${JSON.stringify(s.surfaces.slice(0, 2))}`));
