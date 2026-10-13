// holodeck-research-log.test.mjs — the run's events said in plain words; the counters stay exact as rows move.
//   node --test holodeck-research-log.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLog, STOP_WORDS } from './holodeck-research-log.js';
import { research } from './holodeck-research.js';
import { makeBackground } from './holodeck-research-null.js';
import { readingOfAnalysis, terrainOf } from './holodeck-research-terrain.js';
import { labelOf } from './holodeck-research-lanes.js';

const COMMON = 'the of and to in a is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no she other its may these two time first new some could them than only about into over after most also made many then such out year people city river house water work world part place system states history long great small old'.split(' ');
const BG = makeBackground(COMMON.map((w, i) => [w, Math.max(2, Math.round(40000 / (1 + i)))]));
const rep = (s, k) => Array.from({ length: k }, () => s).join(' ');
const page = (extra = '') => rep('The Zorblatt lighthouse at Port Venn was kept by Mara Quill for many years and the Zorblatt lighthouse lamp was lit every night.', 3) + ' ' + extra + ' ' + rep('The water was cold and people came from the city.', 4);

async function aRun() {
  const pages = {
    'https://a.example/z1': { title: 'Zorblatt lighthouse 1', text: page('Ivo Harlow signed the register at Kessel Bay in the winter, and Teodora Finch mapped the reef beyond Cape Orrin.') },
    'https://a.example/z2': { title: 'Zorblatt lighthouse 2', text: page('Ruth Okafor repaired the lens at Dunmore Quay while Silas Brandt kept the fog signal beside Hollis Rock.') },
    'https://a.example/z3': { title: 'Zorblatt lighthouse 3', text: page('Anselm Vogt surveyed the headland near Marrow Sound and Perpetua Lund recorded the storms of Aldous Point.') },
    'https://b.example/bread': { title: 'Sourdough bread', text: rep('Mix flour and water and let the dough rest for a long time in a warm place.', 8) },
    'https://js.example/app': { title: 'Zorblatt lighthouse app', snippet: 'Zorblatt lighthouse history of the Zorblatt keepers', text: '', bad: 'no text without scripts' },
  };
  const log = makeLog({ label: labelOf });
  const run = await research('history of the Zorblatt lighthouse', {
    background: BG, emit: ev => log.push(ev),
    search: async () => ({ results: Object.keys(pages).map(u => ({ title: pages[u].title, url: u, snippet: pages[u].snippet || pages[u].text.slice(0, 150) })), engine: 'DuckDuckGo' }),
    read: async url => pages[url].bad ? { ok: false, error: pages[url].bad } : { ok: true, text: pages[url].text, title: pages[url].title, via: 'direct', url },
    route: () => ({ scopes: ['web'], why: { web: 'always — the open web answers anything' }, rest: ['github'] }),
  });
  return { run, log };
}

test('every outcome gets a row in plain words, and the counters agree with the record', async () => {
  const { run, log } = await aRun();
  const st = log.stats();
  assert.equal(st.read, run.sources.length);
  assert.equal(st.found, run.candidates.length);
  assert.equal(st.setAside, run.candidates.filter(c => c.state === 'turned-away').length);
  assert.equal(st.unread, run.gaps.filter(g => g.kind === 'unread').length);
  assert.equal(st.toRead + st.read + st.unread + st.notAbout, run.candidates.filter(c => c.verdict === 'admitted' && c.state !== 'pending').length + run.candidates.filter(c => c.state === 'pending').length);
  const chips = new Set(log.rows().map(r => r.chip));
  for (const c of ['Looking in', 'Read', 'Set aside', 'Stopped']) assert.ok([...chips].some(x => x.startsWith(c)), c + ' missing from ' + [...chips].join(' | '));
});

test('a candidate is one row that moves, never two', async () => {
  const { run, log } = await aRun();
  const keys = log.rows().map(r => r.key).filter(k => k.startsWith('c:'));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, run.candidates.length);
});

test('the stop row carries the reason in words and the numbers behind it', async () => {
  const { run, log } = await aRun();
  const stop = log.rows().find(r => r.key === 'stop');
  assert.equal(stop.title, STOP_WORDS[run.stop.reason]);
  assert.equal(stop.line, run.stop.detail);
  const batch = log.rows().filter(r => r.key.startsWith('batch:'));
  assert.ok(batch.length >= 1);
  assert.ok(batch.some(b => /newly confirmed/.test(b.title)));
});

test('a page that could not be read says why, in the row', async () => {
  const { log } = await aRun();
  const r = log.rows().find(x => x.chip === 'Couldn’t read');
  assert.ok(r && /scripts/.test(r.line), JSON.stringify(log.rows().map(x => [x.chip, x.title && x.title.slice(0, 40)])));
});

test('the surface never says a register name', async () => {
  const { log } = await aRun();
  const all = JSON.stringify(log.rows());
  assert.ok(!/\b(Void|Entity|Atmosphere|Paradigm|Network|Lens)\b/.test(all));
});

test('the terrain is laid out from the Holodeck’s own analysis: furniture left out, its ids kept, its kinds and echoes carried', () => {
  const A = {
    docs: [{ id: 'u1', title: 'One', url: 'https://x.example/1', type: 'Web page', research: { via: 'direct', found: ['web'] } }, { id: 'u2', title: 'Two', url: 'https://y.example/2', type: 'Wikipedia article' }, { id: 'u3', title: 'Elsewhere', type: 'Text' }],
    sts: [
      { id: 'u1:0', doc: 'u1', s: 0, e: 40, text: 'Mara Quill kept the Zorblatt Lighthouse.', names: ['Mara Quill', 'Zorblatt Lighthouse'], figs: [], dates: [], frame: 'fact' },
      { id: 'u1:1', doc: 'u1', s: 41, e: 60, text: 'Share this page', names: [], figs: [], dates: [], frame: 'fact', ref: true },
      { id: 'u2:0', doc: 'u2', s: 0, e: 44, text: 'Mara Quill kept the Zorblatt Lighthouse for years.', names: ['Mara Quill', 'Zorblatt Lighthouse'], figs: [], dates: [], frame: 'fact' },
      { id: 'u3:0', doc: 'u3', s: 0, e: 30, text: 'Unrelated Person said it.', names: ['Unrelated Person'], figs: [], dates: [], frame: 'attributed' },
    ],
    names: { 'Mara Quill': { name: 'Mara Quill', type: 'person' }, 'Zorblatt Lighthouse': { name: 'Zorblatt Lighthouse', type: 'place' } },
    echoes: { 'u1:0': [{ id: 'u2:0', sim: 0.8 }, { id: 'u3:0', sim: 0.3 }], 'u2:0': [{ id: 'u1:0', sim: 0.8 }] },
  };
  const input = readingOfAnalysis(A, ['u1', 'u2'], [{ kind: 'unread', why: 'x' }]);
  assert.deepEqual(input.docs.map(d => d.id), ['u1', 'u2']);
  assert.deepEqual(input.sts.map(s => s.id), ['u1:0', 'u2:0']);          // furniture and the other workspace's source are out
  assert.deepEqual(Object.keys(input.echoes).sort(), ['u1:0', 'u2:0']);
  const t = terrainOf(input, { key: 'k' });
  assert.equal(t.seen.link.echoes.length, 1);                               // the Holodeck's own echo, once
  assert.equal(t.seen.kind.kinds.find(k => k.kind === 'person').n, 1);      // its induced kind, not a guess
  assert.equal(t.seen.entity.rows.find(r => r.name === 'Mara Quill').standing, 'earned');
  assert.equal(t.perSource.u1.echoedElsewhere[0].in[0], 'u2');
});

import { rowsOfRecord } from './holodeck-research-log.js';
test('a stored record replays into the same rows the live stream gave (after a reload the ledger is still whole)', async () => {
  const { run, log } = await aRun();
  const live = log.rows(), again = rowsOfRecord(run, labelOf);
  const sig = rows => rows.map(r => r.chip + '|' + r.key.split(':')[0]).sort();
  assert.deepEqual(sig(again), sig(live));
  assert.equal(again.find(r => r.key === 'stop').line, run.stop.detail);
  assert.ok(again.filter(r => r.chip === 'Couldn’t read').every(r => r.line.length > 10));
});
