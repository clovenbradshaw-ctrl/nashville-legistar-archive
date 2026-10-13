// holodeck-research.test.mjs — the research assistant's decisions: the two nulls, the mechanical reading, and the
// acquisition loop driven against a fake web. No network, no model, no clock.
//   node --test holodeck-research.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWS, makeBackground, termsOf, relevance, keyness, earnedGain, saturationTest, unseenExpectation, wordsOf, stemOf, rng } from './holodeck-research-null.js';
import { readSource, splitStatements, figuresIn, namesIn, referentKey } from './holodeck-research-read.js';
import { research, normUrl, frontier, CONCURRENCY } from './holodeck-research.js';

// ── a stand-in for "ordinary English": a Zipf-ish vocabulary, deterministic ─────────────────────────────────────────
const COMMON = ('the of and to in a is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no ' +
  'she other its may these two time first new some could them than only about into over after most also made many then such out year people city river house water work world part place system states ' +
  'history long great small old large national public well state because between through during before under while where each same another found called known used between against might under still ' +
  'told said says report reported during later early late much very back down just good great made like make way even take used long right left high found three four five several').split(/\s+/);
const bgEntries = []; COMMON.forEach((w, i) => bgEntries.push([w, Math.max(2, Math.round(40000 / (1 + i * 0.9)))]));
const BG = makeBackground(bgEntries);

const clean = s => s.replace(/\s+/g, ' ').trim();
const rep = (s, n) => Array.from({ length: n }, () => s).join(' ');

test('keyness: text that says the question’s rare words again and again is outside every one of 199 draws', () => {
  const terms = termsOf('history of the Zorblatt lighthouse');
  const text = rep('The Zorblatt lighthouse stands on the old headland, and the Zorblatt keepers lit the lighthouse every night.', 6) + ' ' + rep('The water was cold and the people were long gone from the place.', 10);
  const r = relevance(terms, text, BG, { key: 'k1' });
  assert.equal(r.ok, true); assert.equal(r.draws, DRAWS);
  assert.equal(r.outside, true, JSON.stringify(r));
  assert.ok(r.g > r.nullMax);
  assert.ok(r.matched.some(m => m.stem === stemOf('zorblatt')));
});

test('FALSIFIER — one stray mention of a common query word is inside the null', () => {
  const terms = termsOf('history of the lighthouse');
  const text = rep('The people were in the city for a long time and the water was very cold and the river was high.', 40) + ' Some history.';
  const r = relevance(terms, text, BG, { key: 'k2' });
  assert.equal(r.ok, true);
  assert.equal(r.outside, false, 'a single common word in a long off-topic text must not clear the null: ' + JSON.stringify({ g: r.g, nullMax: r.nullMax }));
});

// a stretch of ordinary English: words drawn at the background's own rates (what a null draw looks like)
function ordinary(L, seed) {
  const r = rng(seed), tot = bgEntries.reduce((a, [, c]) => a + c, 0), out = [];
  for (let i = 0; i < L; i++) { let x = r() * tot, k = 0; while (x > bgEntries[k][1]) { x -= bgEntries[k][1]; k++; } out.push(bgEntries[k][0]); }
  return out.join(' ');
}

test('FALSIFIER — a long stretch of ordinary English is inside the null for a question made of ordinary words', () => {
  const terms = termsOf('who was the first to prove the Pythagorean theorem');
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = relevance(terms, ordinary(600, seed), BG, { key: 'k3-' + seed });
    assert.equal(r.ok, true);
    assert.equal(r.outside, false, 'seed ' + seed + ': ' + JSON.stringify({ g: r.g, nullMax: r.nullMax, matched: r.matched }));
  }
});

test('relevance is seeded from its key: same material, same verdict; the numbers are in range', () => {
  const terms = termsOf('Zorblatt lighthouse keepers');
  const text = rep('The Zorblatt lighthouse keepers lit the lamp.', 3) + ' ' + rep('The people were in the city.', 8);
  const a = relevance(terms, text, BG, { key: 'same' }), b = relevance(terms, text, BG, { key: 'same' });
  assert.deepEqual(a, b);
  assert.ok(a.nullMax >= a.nullMedian && a.nullMedian >= 0);
  assert.ok(a.p >= 1 / (DRAWS + 1) - 1e-12 && a.p <= 1);
});

test('without a background, relevance is typed undecided — never guessed', () => {
  const r = relevance(termsOf('Zorblatt lighthouse'), 'The Zorblatt lighthouse.', makeBackground([]), { key: 'x' });
  assert.equal(r.ok, false); assert.match(r.why, /background/);
  assert.equal(relevance([], 'text', BG).ok, false);
});

test('a word the prior has never seen is the rarest thing it can say (add-one smoothing)', () => {
  assert.ok(BG.p(stemOf('zorblatt')) < BG.p(stemOf('history')));
  assert.ok(BG.p(stemOf('zorblatt')) > 0);
});

test('property — G is non-decreasing in how many times a query term is said, for a fixed length', () => {
  const terms = termsOf('Zorblatt lighthouse');
  const r = rng(7);
  for (let trial = 0; trial < 40; trial++) {
    const L = 200 + Math.floor(r() * 800), c1 = Math.floor(r() * 6), c2 = c1 + 1 + Math.floor(r() * 6);
    const mk = c => { const m = new Map(); if (c) m.set(stemOf('zorblatt'), c); return keyness(terms, m, L, BG).g; };
    assert.ok(mk(c2) >= mk(c1), `L=${L} ${c1}->${c2}`);
  }
});

// ── corroboration gain ──────────────────────────────────────────────────────────────────────────────────────────────
const S = (...xs) => new Set(xs);
test('earnedGain counts only referents that cross support 2, via the corpus or via the batch itself', () => {
  const prior = new Map([['a', 1], ['b', 2], ['c', 1]]);
  const g = earnedGain(prior, [S('a', 'b', 'x'), S('x', 'y')]);
  assert.equal(g.delta, 2);            // a: 1->2 (via corpus), x: 0->2 (via the batch). b was already earned; y has one witness.
  assert.equal(g.viaCorpus, 1); assert.equal(g.viaBatch, 1);
});

test('fewer than three sources cannot be tested for saturation, and reading goes on', () => {
  const t = saturationTest([S('a', 'b'), S('a', 'c')]);
  assert.equal(t.testable, false); assert.match(t.why, /three sources/);
});

test('a corpus of mirrors is saturated: another source is expected to bring under one new item', () => {
  const same = () => S('mara quill', 'port venn', 'zorblatt', 'lighthouse', 'keeper');
  const t = saturationTest([same(), same(), same(), same()]);
  assert.equal(t.testable, true); assert.equal(t.saturated, true); assert.equal(t.expected, 0);
});

test('a diverse corpus is not saturated: each source brings things nobody else said', () => {
  const mk = i => S('shared', 'only' + i + 'a', 'only' + i + 'b', 'only' + i + 'c');
  const t = saturationTest([mk(1), mk(2), mk(3), mk(4)]);
  assert.equal(t.saturated, false); assert.ok(t.looMax >= 3);
});

test('FALSIFIER — sources that share nothing are NOT called saturated (no overlap is not redundancy)', () => {
  const t = saturationTest([S('a1', 'a2'), S('b1', 'b2'), S('c1', 'c2')]);
  assert.equal(t.saturated, false);
});

test('property — setting a source aside never makes a corpus look more novel than the worst case reported', () => {
  const r = rng(3);
  for (let k = 0; k < 40; k++) {
    const sets = Array.from({ length: 3 + Math.floor(r() * 4) }, () => new Set(Array.from({ length: 5 }, () => 'w' + Math.floor(r() * 12))));
    const t = saturationTest(sets);
    const pt = unseenExpectation(sets).expected;
    assert.ok(t.looMax >= 0);
    // the leave-one-out maximum is at least the point estimate rescaled to n-1 sources' worth of evidence
    assert.ok(t.looMax * (sets.length - 1) >= pt * sets.length - sets.length, JSON.stringify({ looMax: t.looMax, pt }));
  }
});

test('property — the gain does not depend on the order of the batch’s sources', () => {
  const r = rng(11);
  for (let t = 0; t < 30; t++) {
    const prior = new Map(); for (let i = 0; i < 12; i++) prior.set('p' + i, 1 + Math.floor(r() * 3));
    const batch = Array.from({ length: 3 }, () => new Set(Array.from({ length: 4 }, () => 'p' + Math.floor(r() * 16))));
    assert.equal(earnedGain(prior, batch).delta, earnedGain(prior, [...batch].reverse()).delta);
  }
});

// ── the mechanical reading ──────────────────────────────────────────────────────────────────────────────────────────
test('every statement slices back out of its source by its own span', () => {
  const text = 'Dr. Mara Quill led the survey in 1904. It cost $5 million.\n\nThe Zorblatt lighthouse opened in 1911! Was it finished? Yes.';
  const { sts } = readSource(text);
  assert.ok(sts.length >= 3);
  for (const st of sts) assert.equal(text.slice(st.s, st.e), st.text);
});

test('a sentence-opening word is not a name unless the source writes it capitalised mid-sentence', () => {
  const a = readSource('Because the harbour froze, Mara Quill left. However the ice melted.');
  const refs = a.referents;
  assert.ok(refs.includes('mara quill'));
  assert.ok(!refs.includes('because') && !refs.includes('however'));
  const b = readSource('Yesterday we met Harbour. The harbour is old. We saw Harbour again.');
  assert.ok(b.referents.includes('harbour'));
});

test('a year is a date, not a figure; money and percent are figures with units', () => {
  assert.equal(figuresIn('Built in 1911.').length, 0);
  const f = figuresIn('It cost $5 million and 12 percent of it was lost.');
  assert.deepEqual(f.map(x => x.unit), ['dollars', 'percent']);
  assert.equal(f[0].value, 5e6);
});

test('a referent is its folded self: case, accents, a leading “the”', () => {
  assert.equal(referentKey('The Zürich Lighthouse'), referentKey('zurich lighthouse'));
});

// ── the acquisition loop against a fake web ─────────────────────────────────────────────────────────────────────────
const P = (title, body) => ({ title, text: body });
const onTopic = (extra = '', names = ['Mara Quill', 'Port Venn']) =>
  rep('The Zorblatt lighthouse at ' + names[1] + ' was kept by ' + names[0] + ' for many years and the Zorblatt lighthouse lamp was lit every night.', 3) + ' ' + extra + ' ' + rep('The water was cold and people came from the city to see it.', 4);

function fakeWeb(spec) {
  const calls = { search: [], read: [] };
  const web = {
    calls,
    search: async (scope, q) => {
      calls.search.push([scope, q]);
      const s = spec.lanes[scope]; if (!s) throw new Error(scope + ' did not answer.');
      if (s instanceof Error) throw s;
      return { results: s.map(u => ({ title: spec.pages[u].title, url: u, snippet: spec.pages[u].snippet || spec.pages[u].text.slice(0, 160), source: new URL(u).hostname })), engine: scope.toUpperCase() };
    },
    read: async url => {
      calls.read.push(url);
      const p = spec.pages[url];
      if (!p || p.unreadable) return { ok: false, error: p && p.unreadable, tried: ['direct', 'relay', 'public proxy', 'text reader'] };
      return { ok: true, text: p.text, title: p.title, via: p.via || 'direct', url };
    },
  };
  return web;
}
const events = [];
const base = (web, over = {}) => ({ search: web.search, read: web.read, background: BG, emit: e => events.push(e), route: () => ({ scopes: ['web', 'wikipedia'], why: { web: 'always', wikipedia: 'encyclopedic ask' }, rest: ['github', 'archive'] }), ...over });

test('it streams lanes, searches, candidates, reads, batches and one stop — in that order', async () => {
  events.length = 0;
  const pages = {}, urls = [];
  for (let i = 0; i < 6; i++) { const u = 'https://site' + i + '.example/zorblatt'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic(' ' + 'Extra detail ' + i + '.')); }
  const web = fakeWeb({ lanes: { web: urls, wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const kinds = events.map(e => e.t);
  assert.equal(kinds[0], 'lanes');
  assert.equal(kinds.at(-1), 'stop');
  assert.ok(kinds.indexOf('search') < kinds.indexOf('candidate'));
  assert.ok(kinds.indexOf('candidate') < kinds.indexOf('read'));
  assert.ok(kinds.indexOf('read') < kinds.indexOf('batch'));
  assert.equal(kinds.filter(k => k === 'stop').length, 1);
  assert.equal(run.schema, 'HolodeckResearchRun@1');
});

test('candidates the null turns away are listed with the numbers and are never read', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    'https://b.example/bread': P('How to bake sourdough bread', rep('Mix the flour and the water and let the dough rest in the warm place for a long time.', 6)),
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.ok(!web.calls.read.includes('https://b.example/bread'));
  const gap = run.gaps.find(g => g.kind === 'turned-away');
  assert.ok(gap && /ordinary English/.test(gap.why) && /vs the null/.test(gap.why));
  assert.equal(run.sources.length, 1);
});

test('an unreadable page is a typed gap with its reason, and the run goes on', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    'https://js.example/zorblatt': { title: 'Zorblatt lighthouse (app)', text: '', snippet: 'Zorblatt lighthouse history and the Zorblatt keepers', unreadable: 'the page has no text without running its scripts' },
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'unread');
  assert.ok(g && /scripts/.test(g.why) && Array.isArray(g.tried));
  assert.equal(run.sources.length, 1);
});

test('a page that is read but is not about the question is refused with its numbers, and stays out of the corpus', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    // the snippet clears the gate; the page, once read, is mostly something else
    'https://c.example/tide': { title: 'Zorblatt lighthouse tide tables', snippet: 'Zorblatt lighthouse tide tables and the Zorblatt lamp', text: rep('Tide tables for the harbour list the high water and the low water at each hour of the day.', 20) },
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'off-topic-when-read');
  assert.ok(g && /not about the question/.test(g.why));
  assert.deepEqual(run.sources.map(s => s.url), ['https://a.example/zorblatt']);
});

test('reading stops when the corpus is saturated, and the stop carries the numbers', async () => {
  const pages = {}, urls = [];
  // two batches of three on-topic pages that say the same thing: the second adds nothing the first did not earn
  for (let i = 0; i < 6; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic('', ['Mara Quill', 'Port Venn'])); }
  const web = fakeWeb({ lanes: { web: urls, wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { route: () => ({ scopes: ['web'], why: {}, rest: [] }) }));
  assert.equal(run.stop.reason, 'saturated');
  assert.ok(run.stop.test && run.stop.test.looMax < 1);
  assert.match(run.stop.detail, /under the floor of one/);
  assert.equal(run.batches.length, 1);   // three mirrors are enough to tell
  assert.equal(run.sources.length, CONCURRENCY);
  // the pages that cleared the null but were not read are listed, with why — never silently dropped
  const held = run.gaps.filter(g => g.kind === 'held');
  assert.equal(held.length, 3);
  assert.ok(held.every(g => /saturated/.test(g.why)));
  assert.equal(run.candidates.filter(c => c.state === 'held').length, 3);
});

test('when the gated pool runs out while the corpus is still learning, it widens to the lanes the router held back', async () => {
  // batch 1 names once-heard people; the held-back lane's pages say them again (and more), so widening is what earns them
  const a = (i, who) => P('Zorblatt lighthouse ' + i, onTopic(who.join(' and ') + ' signed the Zorblatt lighthouse log.', ['Mara Quill', 'Port Venn']));
  const pages = {
    'https://w1.example/z': a(1, ['Ivo Harlow', 'Teodora Finch']), 'https://w2.example/z': a(2, ['Ruth Okafor', 'Silas Brandt']), 'https://w3.example/z': a(3, ['Anselm Vogt', 'Perpetua Lund']),
    'https://g1.example/z': a(4, ['Ivo Harlow', 'Ruth Okafor']), 'https://g2.example/z': a(5, ['Teodora Finch', 'Anselm Vogt']), 'https://g3.example/z': a(6, ['Silas Brandt', 'Perpetua Lund']),
  };
  const web = fakeWeb({ lanes: { web: ['https://w1.example/z', 'https://w2.example/z', 'https://w3.example/z'], github: ['https://g1.example/z', 'https://g2.example/z', 'https://g3.example/z'] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { route: () => ({ scopes: ['web'], why: { web: 'always' }, rest: ['github'] }) }));
  assert.ok(run.rounds.some(r => r.kind === 'widened' && r.scopes.includes('github')), JSON.stringify(run.rounds));
  assert.ok(run.sources.length >= 6);
  assert.ok(web.calls.search.some(c => c[0] === 'github'));
});

test('a lane that throws is a typed gap; the other lanes still answer', async () => {
  const pages = { 'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()) };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: new Error('Wikipedia answered 503.') }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'lane-failed');
  assert.ok(g && g.scope === 'wikipedia' && /503/.test(g.why));
  assert.equal(run.sources.length, 1);
});

test('the same address from two lanes is one candidate that remembers both', async () => {
  const u = 'https://en.wikipedia.org/wiki/Zorblatt_lighthouse';
  const pages = { [u]: P('Zorblatt lighthouse - Wikipedia', onTopic()) };
  const web = fakeWeb({ lanes: { web: [u], wikipedia: [u + '#History'] }, pages: { ...pages, [u + '#History']: pages[u] } });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.equal(run.candidates.length, 1);
  assert.deepEqual(run.candidates[0].found.map(f => f.scope).sort(), ['web', 'wikipedia']);
  assert.equal(normUrl('https://www.Example.com/a/?utm_source=x#frag'), 'example.com/a');
});

test('stopping it says so and keeps what was read', async () => {
  const ctl = new AbortController();
  const pages = {}, urls = [];
  for (let i = 0; i < 9; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic(' Detail ' + i + ' Person' + i + ' Harlow.')); }
  const web = fakeWeb({ lanes: { web: urls }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { signal: ctl.signal, route: () => ({ scopes: ['web'], why: {}, rest: [] }), emit: e => { if (e.t === 'batch') ctl.abort(); } }));
  assert.equal(run.stop.reason, 'aborted');
  assert.ok(run.sources.length >= 1 && run.sources.length <= CONCURRENCY);
});

test('with no background the run says relevance was not measured and reads in lane order', async () => {
  events.length = 0;
  const pages = { 'https://a.example/x': P('Anything', rep('Plain words about nothing in particular at all.', 4)), 'https://b.example/y': P('Else', onTopic()) };
  const web = fakeWeb({ lanes: { web: Object.keys(pages) }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { background: null, route: () => ({ scopes: ['web'], why: {}, rest: [] }) }));
  assert.ok(events.some(e => e.t === 'note' && /NOT measured/.test(e.why)));
  assert.ok(run.candidates.every(c => c.verdict === 'admitted'));
  assert.deepEqual(web.calls.read.slice(0, 2), Object.keys(pages));
});

test('no lane answers: the run ends with no-candidates and says how many searches failed', async () => {
  const web = fakeWeb({ lanes: { web: new Error('Web search answered 502'), wikipedia: new Error('Wikipedia did not answer.') }, pages: {} });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.equal(run.stop.reason, 'no-candidates');
  assert.match(run.stop.detail, /searches failed/);
});

test('frontier names the strongest earned referent that is not already in the question or followed', () => {
  const support = new Map([['mara quill', 4], ['zorblatt lighthouse', 6], ['port venn', 3], ['ivo harlow', 1]]);
  const surface = new Map([['mara quill', 'Mara Quill'], ['port venn', 'Port Venn'], ['zorblatt lighthouse', 'Zorblatt Lighthouse']]);
  const qs = wordsOf('history of the Zorblatt lighthouse').map(stemOf);
  assert.equal(frontier(support, surface, qs, new Set()).surface, 'Mara Quill');
  assert.equal(frontier(support, surface, qs, new Set(['mara quill'])).surface, 'Port Venn');
  assert.equal(frontier(support, surface, qs, new Set(['mara quill', 'port venn'])), null);
});

test('a control run that ignores the stop reads on, and still records where the null would have stopped it', async () => {
  const pages = {}, urls = [];
  for (let i = 0; i < 9; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic('', ['Mara Quill', 'Port Venn'])); }
  const mk = () => fakeWeb({ lanes: { web: urls }, pages });
  const route = () => ({ scopes: ['web'], why: {}, rest: [] });
  const stopped = await research('history of the Zorblatt lighthouse', base(mk(), { route }));
  const control = await research('history of the Zorblatt lighthouse', base(mk(), { route, noStop: true }));
  assert.equal(stopped.stop.reason, 'saturated');
  assert.equal(control.sources.length, 9);
  assert.equal(control.wouldStopAt, stopped.batches.length);
  assert.ok(stopped.sources.length < control.sources.length);
});

import { proseTest, structureRate } from './holodeck-research-null.js';
const DUMP = "{'type': 'BOOK CHAPTER', 'published_date': '1 September 2024', 'publication': 'The Book of Politics', 'title': 'Eiffel Tower', 'name': None, 'id': None, 'location': None, 'display_doi': 'https://doi.org/10.1215/9781478059189-019', 'grant_info': None, 'multiple_lead_investigators': [], 'finances': [], 'project_description': None, 'coaccess': [], 'multi-resolution': [{'url': 'http://www.jstor.org/stable/10.2307', 'tid': 'jstor.org'}]}";

test('a metadata record is not prose: its structure share beats every stretch of the other sources', () => {
  const peers = [onTopic(), onTopic(' More.', ['Ivo Harlow', 'Port Venn'])];
  const t = proseTest(DUMP, peers, { key: 'p' });
  assert.equal(t.testable, true); assert.equal(t.outside, true);
  assert.equal(proseTest(peers[0], [peers[1], DUMP], { key: 'q' }).outside, false);
});

test('with no other source there is nothing to be unlike: untestable, and kept', () => {
  assert.equal(proseTest(DUMP, [], { key: 'x' }).testable, false);
  assert.equal(structureRate('Plain words only.'), 0);
});

test('a corpus made entirely of records does not flag its own kind', () => {
  assert.equal(proseTest(DUMP, [DUMP.replace('Eiffel', 'Louvre'), DUMP.replace('Eiffel', 'Orsay')], { key: 'k' }).outside, false);
});

test('the loop refuses a record that mentions the question and says so with the numbers', async () => {
  const pages = {
    'https://a.example/z1': P('Zorblatt lighthouse 1', onTopic()),
    'https://a.example/z2': P('Zorblatt lighthouse 2', onTopic(' More.')),
    'https://j.example/rec': { title: 'Zorblatt lighthouse record', snippet: 'Zorblatt lighthouse Zorblatt keepers history', text: "{'title': 'Zorblatt lighthouse history', 'keepers': ['Mara Quill'], 'id': None, 'type': 'RECORD', 'kind': None, 'doi': None, 'zorblatt': 'Zorblatt lighthouse', 'meta': {'a': [], 'b': {}, 'c': None, 'zorblatt': 'Zorblatt lighthouse Zorblatt lighthouse Zorblatt'}}" },
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages) }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { route: () => ({ scopes: ['web'], why: {}, rest: [] }) }));
  const g = run.gaps.find(x => x.kind === 'not-prose');
  assert.ok(g && /structure/.test(g.why), JSON.stringify(run.gaps.map(x => x.kind)));
  assert.deepEqual(run.sources.map(s => s.url).sort(), ['https://a.example/z1', 'https://a.example/z2']);
});

import { corpusIndex, phraseKeyness } from './holodeck-research-null.js';
test('a name the corpus says beyond ordinary English is keyed; an ordinary word that is capitalised is not', () => {
  const texts = [rep('See the Zorblatt lighthouse and Mara Quill. References follow the history of the city.', 12), rep('See also the Zorblatt lighthouse; the people of the city and the river. References.', 12)];
  const idx = corpusIndex(texts);
  const bgx = makeBackground([...bgEntries, ['see', 16000]]);
  assert.equal(phraseKeyness('Zorblatt lighthouse', idx, bgx, { key: 'a' }).outside, true);
  assert.equal(phraseKeyness('Mara Quill', idx, bgx, { key: 'a' }).outside, true);
  assert.equal(phraseKeyness('See', idx, bgx, { key: 'a' }).outside, false);
});

test('frontier prefers the most keyed name, and skips a name the null does not carry', () => {
  const support = new Map([['references', 9], ['mara quill', 4], ['port venn', 3]]);
  const surface = new Map([['references', 'References'], ['mara quill', 'Mara Quill'], ['port venn', 'Port Venn']]);
  const keyed = new Map([['references', { outside: false, g: 0 }], ['mara quill', { outside: true, g: 40 }], ['port venn', { outside: true, g: 90 }]]);
  assert.equal(frontier(support, surface, [], new Set(), keyed).surface, 'Port Venn');
  assert.equal(frontier(support, surface, [], new Set(['port venn']), keyed).surface, 'Mara Quill');
  assert.equal(frontier(support, surface, [], new Set(['port venn', 'mara quill']), keyed), null);
});

import { termUnits } from './holodeck-research-null.js';
// a background with the real shape: many rare words, a few very common ones
const WIDE = makeBackground([...bgEntries, ...Array.from({ length: 4000 }, (_, i) => ['rareword' + i, 3]), ['valley', 900], ['authority', 1200], ['tennessee', 40], ['pythagorean', 6], ['webgpu', 1], ['sourdough', 2], ['starter', 300], ['start', 4000], ['feed', 500], ['how', 3000], ['do', 5000], ['i', 8000], ['a', 9000]]);

test('words any page can say are not units: "a", "how", "start" measure nothing; named things are units as phrases', () => {
  const q = 'How do I feed a sourdough starter?';
  const u = termUnits(q, { bg: WIDE, entities: [] });
  const flat = u.units.map(x => x.join(' '));
  assert.ok(flat.includes('sourd'));
  for (const w of ['how', 'do', 'i', 'a', 'start']) assert.ok(!flat.includes(w), w + ' should not be a unit');
  const t = termUnits('Tennessee Valley Authority', { bg: WIDE, entities: ['Tennessee Valley Authority'] });
  assert.deepEqual(t.anchors, [['tenne', 'valle', 'autho']]);
  assert.ok(t.units.some(x => x.length === 3));
});

test('FALSIFIER — a math page that says "a" a hundred times does not clear a question about something else', () => {
  const math = rep('Let a and b be the legs and c the hypotenuse, so that a squared plus b squared equals c squared for a right triangle and any a.', 40);
  const q = 'How do I feed a sourdough starter?';
  const { units, anchors } = termUnits(q, { bg: WIDE, entities: [] });
  const r = relevance(units, math, WIDE, { key: 'm', anchors });
  assert.equal(r.outside, false);
});

test('the named thing anchors: a page about the state that never says the agency is not about the agency', () => {
  const q = 'Tennessee Valley Authority';
  const { units, anchors } = termUnits(q, { bg: WIDE, entities: [q] });
  const geo = rep('Tennessee is a state in the southeastern region and the valley of the river is long and the people of Tennessee farm the valley land.', 30);
  const tva = rep('The Tennessee Valley Authority built the dams and the Tennessee Valley Authority sold power to the people of the valley.', 12) + ' ' + rep('The water was cold and the people came from the city.', 10);
  assert.equal(relevance(units, geo, WIDE, { key: 'g', anchors }).outside, false);
  assert.equal(relevance(units, tva, WIDE, { key: 't', anchors }).outside, true);
});
