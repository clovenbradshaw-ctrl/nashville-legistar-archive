// diag-embed.mjs — span-level recall@k (does the CONTAINING chunk surface?),
// by query length, vs a random null. This is the decisive metric: it is not
// inflated by a document owning many chunks.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'corpus/nashville';
const SIZE = 1200, OVERLAP = 0.15, N = 20;
const OLLAMA = 'http://127.0.0.1:11435', MODEL = 'nomic-embed-text';

const all = readdirSync(dir).filter((f) => f.endsWith('.txt')).slice(0, N);
const docs = all.map((f) => ({ id: f.replace(/\.txt$/, ''), text: readFileSync(join(dir, f), 'utf8') }));

async function emb(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const r = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, input: texts.slice(i, i + 16) }) });
    if (!r.ok) throw new Error('embed ' + r.status);
    for (const e of (await r.json()).embeddings) out.push(e);
  }
  return out;
}
const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); };
const chunk = (t) => { const step = Math.floor(SIZE * (1 - OVERLAP)), o = []; for (let s = 0; s < t.length; s += step) { const e = Math.min(t.length, s + SIZE); o.push({ s, e, text: t.slice(s, e) }); if (e >= t.length) break; } return o; };
function order(vecs, qv) { const a = vecs.map((v, i) => { let s = 0; for (let j = 0; j < v.length; j++) s += v[j] * qv[j]; return [i, s]; }); a.sort((x, y) => y[1] - x[1]); return a; }

const chunks = [];
for (const d of docs) for (const c of chunk(d.text)) chunks.push({ id: d.id, ...c });
const VD = (await emb(chunks.map((c) => c.text))).map(norm);
const NN = chunks.map(() => norm(Array.from({ length: 768 }, () => Math.random() * 2 - 1)));

const probes = [];
for (const d of docs) {
  const w = []; const re = /\S+/g; let m; while ((m = re.exec(d.text))) w.push([m.index, m.index + m[0].length]);
  const deep = w.filter(([s]) => s > 6000);
  if (!deep.length) continue;
  for (const L of [17, 40]) {
    const j = Math.floor(Math.random() * Math.max(1, deep.length - L));
    const s = deep[j][0], e = deep[Math.min(deep.length - 1, j + L - 1)][1];
    probes.push({ id: d.id, s, e, q: d.text.slice(s, e).replace(/\s+/g, ' ').trim(), L });
  }
}
// the true chunk = the one containing the probe span, in the same doc
for (const p of probes) {
  p.trueChunk = chunks.findIndex((c) => c.id === p.id && c.s <= p.s && c.e >= p.e);
}
const K = [1, 3, 5, 10];
const spanHit = (mat, qv, p, k) => order(mat, qv).slice(0, k).some(([i]) => i === p.trueChunk);

for (const L of [17, 40]) {
  const ps = probes.filter((p) => p.L === L && p.trueChunk >= 0);
  const qvs = (await emb(ps.map((p) => p.q))).map(norm);
  const row = {}, nrow = {};
  for (const k of K) { row[k] = ps.filter((p, i) => spanHit(VD, qvs[i], p, k)).length; nrow[k] = ps.filter((p, i) => spanHit(NN, qvs[i], p, k)).length; }
  console.log(`\nquery ${L} words, deep, ${ps.length} probes, ${docs.length} docs / ${chunks.length} chunks — SPAN recall`);
  console.log('  semantic: ' + K.map((k) => `@${k} ${(row[k] / ps.length * 100).toFixed(0)}%`).join('  '));
  console.log('  null    : ' + K.map((k) => `@${k} ${(nrow[k] / ps.length * 100).toFixed(0)}%`).join('  '));
}
