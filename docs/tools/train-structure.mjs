// train-structure.mjs — train the extractor on the corpus's STRUCTURE.
//
// The corpus shares one template, so headings, their numbering depth, and the
// section names all repeat. This pass reads every contract's text and learns:
//   • heading PATTERNS and the level each implies (numbered N. / N.M / ALL CAPS /
//     ARTICLE / Title Case)
//   • section NAMES, their dominant level, and how often they recur
//   • the template's section ORDER (which names follow which)
// and writes figures/_structure.json. The extractor then assigns levels from what
// it learned, instead of guessing shape-by-shape.
//
// Usage: node tools/train-structure.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const seed = JSON.parse(readFileSync(join(ROOT, 'nashville-contracts-seed.json'), 'utf8'));
const textOf = tok => { const p = join(ROOT, 'ocr', tok + '.json'); if (existsSync(p)) { try { const t = JSON.parse(readFileSync(p, 'utf8')).map(pg => pg.text || '').join('\n'); if (t.trim()) return t; } catch (e) {} } const s = seed.find(x => x.id.replace(/^nash-/, '') === tok); return (s && s.text) || ''; };
const norm = s => s.toLowerCase().replace(/^\d{1,3}(?:\.\d+){0,3}\.?\s*/, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

const NUM = /^(\d{1,3}(?:\.\d+){0,3})\.?\s+(.+)$/;
const names = new Map(); // name -> { df:Set, lv:Map, forms:Map }
const patterns = new Map(); // pattern -> { df:Set, lv:Map }
let docs = 0;
const bump = (m, k, lv) => { const e = m.get(k) || m.set(k, { df: new Set(), lv: new Map(), forms: new Map() }).get(k); e.df.add(docs); e.lv.set(lv, (e.lv.get(lv) || 0) + 1); return e; };
for (const x of seed) {
  const t = textOf(x.id.replace(/^nash-/, '')); if (!t) continue; docs++;
  const seen = new Set();
  for (let line of t.split(/\r?\n/)) {
    line = line.trim(); if (!line || line.length > 66) continue;
    if (/[\d$]\s*[\d,]{2,}/.test(line) && !/^\d{1,3}(\.\d+){0,3}\.?\s+[A-Z]/.test(line)) continue;
    let name = null, lv = null, pat = null;
    if (/^(?:ARTICLE|SECTION|EXHIBIT|SCHEDULE|APPENDIX)\b/i.test(line)) { name = line; lv = 1; pat = 'article'; }
    else { const m = NUM.exec(line); if (m && /^[A-Z]/.test(m[2])) { const d = m[1].split('.').length; name = m[2]; lv = d <= 1 ? 2 : 3; pat = 'numbered-' + Math.min(3, d); } }
    if (!name && /^[A-Z][A-Z0-9 \/&'’.,()#-]{3,58}$/.test(line) && /[A-Z]{3,}/.test(line) && !/\b(?:THE|AND|OF)\b/.test(line)) { name = line; lv = 1; pat = 'caps'; }
    if (!name && /^[A-Z][a-z]/.test(line) && line.split(/\s+/).length <= 6 && !/[.!?,;:]$/.test(line)) { name = line; lv = 3; pat = 'title'; }
    if (!name) continue;
    const n = norm(name); if (!n || n.length < 3 || seen.has(n)) continue; seen.add(n);
    bump(names, n, lv).forms.set(name.trim(), (bump(names, n, lv).forms.get(name.trim()) || 0) + 1);
    const p = patterns.get(pat) || patterns.set(pat, { df: new Set(), lv: new Map() }).get(pat); p.df.add(docs); p.lv.set(lv, (p.lv.get(lv) || 0) + 1);
  }
}

const maj = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
const sections = [...names.entries()].map(([name, e]) => ({ name, level: maj(e.lv), df: e.df.size, forms: [...e.forms.keys()].slice(0, 4) })).filter(s => s.df >= 3).sort((a, b) => b.df - a.df);
const pats = [...patterns.entries()].map(([p, e]) => ({ pattern: p, level: maj(e.lv), df: e.df.size })).sort((a, b) => b.df - a.df);

writeFileSync(join(ROOT, 'figures', '_structure.json'), JSON.stringify({ documents: docs, patterns: pats, sections }, null, 1));
console.log('trained on', docs, 'contracts · learned', sections.length, 'section names,', pats.length, 'patterns');
console.log('patterns:', pats.map(p => p.pattern + '(L' + p.level + ',' + p.df + ')').join('  '));
console.log('top sections:');
sections.slice(0, 25).forEach(s => console.log(`  L${s.level}  df ${String(s.df).padStart(3)}  "${s.name}"`));
