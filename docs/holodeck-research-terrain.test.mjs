// holodeck-research-terrain.test.mjs — the terrain pass: nine registers over a set of sources, every row addressed.
//   node --test holodeck-research-terrain.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainOf, readingOf, CELLS, SEEN, SEEING, SCHEMA } from './holodeck-research-terrain.js';
import { readSource } from './holodeck-research-read.js';
import { relevance, termsOf, makeBackground, rng } from './holodeck-research-null.js';

const runOf = sources => ({ sources: sources.map((s, i) => ({ id: 's' + (i + 1), title: s.title || 'Source ' + (i + 1), url: s.url || 'https://site' + (i + 1) + '.example/p', via: 'direct', found: [{ scope: s.lane || 'web' }], text: s.text })), gaps: [] });
const terrain = (sources, key = 'k') => terrainOf(readingOf(runOf(sources), readSource), { key });

const A = 'Mara Quill kept the Zorblatt Lighthouse at Port Venn for 31 years. The lamp burned 400 percent brighter than before, the log said. She built the tower in 1904.';
const B = 'The Zorblatt Lighthouse stood at Port Venn under Mara Quill. The lamp burned 350 percent brighter than before, according to the log. Ivo Harlow signed the register in 1911.';
const C = 'Teodora Finch wrote about the harbour at Port Venn. She said the Zorblatt Lighthouse might be rebuilt. Ivo Harlow disagreed.';

test('the nine registers split six SEEN and three SEEING, and the surface says them in plain words', () => {
  assert.deepEqual([...SEEN].sort(), ['entity', 'field', 'kind', 'link', 'network', 'void']);
  assert.deepEqual([...SEEING].sort(), ['atmosphere', 'lens', 'paradigm']);
  const t = terrain([{ text: A }, { text: B }]);
  assert.deepEqual(Object.keys(t.seen).sort(), [...SEEN].sort());
  assert.deepEqual(Object.keys(t.seeing).sort(), [...SEEING].sort());
  const registers = /^(Void|Entity|Kind|Field|Link|Network|Atmosphere|Lens|Paradigm)$/;
  for (const c of Object.values(CELLS)) assert.ok(!registers.test(c.plain), c.plain + ' is a register name on the surface');
  assert.equal(t.schema, SCHEMA);
});

test('a name two sources witness is earned; one that only one source says is heard once', () => {
  const t = terrain([{ text: A }, { text: B }, { text: C }]);
  const row = n => t.seen.entity.rows.find(r => r.name === n);
  assert.equal(row('Mara Quill').standing, 'earned');
  assert.equal(row('Port Venn').sources.length, 3);
  assert.equal(row('Teodora Finch').standing, 'heard once');
  assert.ok(t.seen.void.heardOnce > 0 && t.seen.void.earned > 0);
});

test('every row carries a source and a span that slices back out of that source', () => {
  const sources = [{ text: A }, { text: B }, { text: C }];
  const t = terrain(sources);
  const texts = Object.fromEntries(sources.map((s, i) => ['s' + (i + 1), s.text]));
  const check = a => { assert.ok(texts[a.doc] != null, 'unknown doc ' + a.doc); assert.ok(Number.isFinite(a.s) && Number.isFinite(a.e) && a.e > a.s, JSON.stringify(a)); assert.ok(a.e <= texts[a.doc].length); };
  t.seen.entity.rows.forEach(r => r.at.forEach(check));
  t.seen.link.statements.forEach(check);
  t.seen.field.units.forEach(u => u.values.forEach(v => v.at.forEach(check)));
  t.seen.network.edges.forEach(e => e.at.forEach(check));
  // the entity span really is the name
  const mq = t.seen.entity.rows.find(r => r.name === 'Mara Quill');
  for (const a of mq.at) assert.equal(texts[a.doc].slice(a.s, a.e), 'Mara Quill');
});

test('figures in one unit that no two sources agree on are flagged as differing; a shared value is not', () => {
  const t = terrain([{ text: A }, { text: B }]);
  const pct = t.seen.field.units.find(u => u.unit === 'percent');
  assert.ok(pct && pct.differs);
  assert.ok(t.seeing.paradigm.breaks.some(b => b.kind === 'figures differ' && b.unit === 'percent'));
  const same = terrain([{ text: 'The lamp burned 400 percent brighter.' }, { text: 'Records show 400 percent brighter lamps.' }]);
  assert.equal(same.seen.field.units.find(u => u.unit === 'percent').differs, false);
});

test('the same wording said in two sources is an echo; unrelated sentences are not', () => {
  const t = terrain([
    { text: 'The Zorblatt Lighthouse lamp burned brighter than any lamp before it at Port Venn. Rain fell on the quiet harbour town.' },
    { text: 'The Zorblatt Lighthouse lamp burned brighter than any lamp before it at Port Venn, the log says. Bakers sell bread near Mara Quill.' },
  ]);
  assert.ok(t.seen.link.echoes.length >= 1);
  assert.ok(t.seen.link.echoes[0].sim > t.seen.link.echoes[0].nullMax);
  const none = terrain([{ text: 'The Zorblatt Lighthouse stands at Port Venn on cold grey rock.' }, { text: 'Bakers at Port Venn sell warm bread to the Zorblatt Lighthouse keepers daily.' }]);
  assert.equal(none.seen.link.echoes.length, 0);
});

test('a tie is kept only when its shared statements beat every random overlap and two independent sources witness it', () => {
  // 40 statements over two sources; "Mara Quill" and "Ivo Harlow" always together (10, five in each); "Kessel Bay" scattered
  const mk = off => { const lines = [];
    for (let i = 0; i < 5; i++) lines.push('That morning Mara Quill met Ivo Harlow near the old dock number ' + (off + i) + ' on a grey morning.');
    for (let i = 0; i < 15; i++) lines.push('That evening ' + (i % 2 ? 'Ruth Okafor' : 'Ruth Okafor and Kessel Bay') + ' walked past the quiet market stall number ' + (off + i) + ' alone.');
    return lines.join('\n'); };
  const t = terrain([{ text: mk(0) }, { text: mk(100) }]);
  const mi = t.seen.network.edges.find(e => [e.a, e.b].sort().join('|') === 'Ivo Harlow|Mara Quill');
  assert.ok(mi && mi.k === 10 && mi.k > mi.nullMax && mi.witnesses === 2, JSON.stringify(t.seen.network.edges));
  assert.ok(!t.seen.network.edges.some(e => [e.a, e.b].includes('Kessel Bay') && [e.a, e.b].includes('Mara Quill')));
});

test('a tie that only one source witnesses is not drawn, however many times that source says it', () => {
  const lines = []; for (let i = 0; i < 12; i++) lines.push('That morning Mara Quill met Ivo Harlow near the old dock number ' + i + ' on a grey morning.');
  for (let i = 0; i < 30; i++) lines.push('Bakers sold warm bread at the quiet market stall number ' + i + ' to the crowd.');
  const t = terrain([{ text: lines.join('\n') }, { text: 'Mara Quill wrote letters in the harbour town. Ivo Harlow read them aloud on the pier at dusk.' }]);
  assert.equal(t.seen.network.edges.length, 0);
});

test('sources that hold the same ground beyond chance are grouped; a stranger is stray', () => {
  const t = terrain([
    { text: 'Mara Quill and Ivo Harlow and Teodora Finch surveyed Port Venn and Kessel Bay. Ruth Okafor joined the survey at Port Venn.' },
    { text: 'Ivo Harlow and Mara Quill and Ruth Okafor mapped Kessel Bay near Port Venn. Teodora Finch drew the survey charts.' },
    { text: 'Silas Brandt baked bread in Oslo while Perpetua Lund sold cheese in Bergen near Anselm Vogt. ' + Array.from({ length: 30 }, (_, i) => 'Citizen Number' + String.fromCharCode(65 + (i % 26)) + String.fromCharCode(97 + ((i * 7) % 26)) + ' visited Town' + String.fromCharCode(65 + ((i * 3) % 26)) + 'ville.').join(' ') },
  ]);
  const g = t.seeing.paradigm.groups;
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].docs, ['s1', 's2']);
  assert.deepEqual(t.seeing.paradigm.stray, ['s3']);
  assert.equal(t.perSource.s1.group, 0); assert.equal(t.perSource.s3.group, -1);
});

test('per source: what it shares with the others, what only it says, what it says again elsewhere', () => {
  const t = terrain([{ text: A }, { text: B }, { text: C }]);
  const c = t.perSource.s3;
  assert.ok(c.names.some(n => n.name === 'Teodora Finch' && n.standing === 'only here'));
  assert.ok(c.names.some(n => n.name === 'Port Venn' && n.standing === 'earned' && n.also.length === 2));
  assert.equal(c.earned + c.onlyHere, c.referents);
  assert.deepEqual(Object.keys(c.frames).sort(), ['attributed', 'fact', 'plan', 'uncertain']);
  assert.ok(t.perSource.s3.frames.uncertain >= 1 || t.perSource.s3.frames.attributed >= 1);
});

test('framing and views are filters over the same statements, not sections: their ids resolve into the link rows', () => {
  const t = terrain([{ text: A }, { text: B }, { text: C }]);
  const ids = new Set(t.seen.link.statements.map(s => s.id));
  for (const list of Object.values(t.seeing.atmosphere.frames)) list.forEach(id => assert.ok(ids.has(id)));
  t.seeing.lens.byYear.forEach(y => y.statements.forEach(id => assert.ok(ids.has(id))));
  assert.ok(t.seeing.lens.byYear.some(y => y.year === 1904));
  assert.ok(t.seeing.lens.bySite.length === 3 && t.seeing.lens.byLane.some(l => l.lane === 'web'));
});

test('a single source is said to be a single source; nothing earned is said to be nothing earned', () => {
  const t = terrain([{ text: A }]);
  assert.ok(t.seen.void.notices.some(n => n.kind === 'single-source'));
  assert.ok(t.seen.void.notices.some(n => n.kind === 'no-corroboration'));
  assert.equal(t.seen.entity.rows.every(r => r.standing === 'heard once'), true);
});

test('typed gaps from the run (unread, turned away, off-topic when read) ride into the Sources register', () => {
  const run = runOf([{ text: A }, { text: B }]);
  run.gaps = [{ kind: 'unread', url: 'https://js.example/x', title: 'App', why: 'no lane returned its text' }, { kind: 'turned-away', url: 'https://x.example', title: 'Bread', why: 'inside the null' }, { kind: 'lane-failed', scope: 'github', why: '403' }];
  const t = terrainOf(readingOf(run, readSource), { key: 'k' });
  assert.deepEqual(t.seen.void.gaps.map(g => g.kind).sort(), ['turned-away', 'unread']);
  assert.ok(t.seen.void.gaps.every(g => g.why));
});

test('same input, same terrain; and the order the statements arrive in changes no count', () => {
  const sources = [{ text: A }, { text: B }, { text: C }];
  assert.deepEqual(terrain(sources, 'k'), terrain(sources, 'k'));
  const input = readingOf(runOf(sources), readSource);
  const r = rng(5); const shuffled = { ...input, sts: [...input.sts].sort(() => r() - 0.5) };
  const a = terrainOf(input, { key: 'k' }), b = terrainOf(shuffled, { key: 'k' });
  assert.equal(a.counts.referents, b.counts.referents); assert.equal(a.counts.earned, b.counts.earned);
  assert.deepEqual(a.seen.entity.rows.map(x => [x.name, x.sources, x.statements]), b.seen.entity.rows.map(x => [x.name, x.sources, x.statements]));
});

test('calibration — over 300 stretches of ordinary English of every length, no more than 2% clear the relevance null', () => {
  const words = 'the of and to in a is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no she other its may these two time'.split(' ');
  const be = words.map((w, i) => [w, Math.max(2, Math.round(30000 / (1 + i)))]);
  const bg = makeBackground(be), tot = be.reduce((a, [, c]) => a + c, 0), terms = termsOf('who was the first one that would have been there');
  let n = 0, N = 300;
  for (let i = 0; i < N; i++) {
    const r = rng(500 + i), L = 20 + (i * 53) % 700, o = [];
    for (let j = 0; j < L; j++) { let x = r() * tot, k = 0; while (x > be[k][1]) { x -= be[k][1]; k++; } o.push(be[k][0]); }
    if (relevance(terms, o.join(' '), bg, { key: 'cal' + i }).outside) n++;
  }
  assert.ok(n / N <= 0.02, n + ' of ' + N + ' ordinary stretches cleared the null');
});
