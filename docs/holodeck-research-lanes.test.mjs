// holodeck-research-lanes.test.mjs — the adapter over the vendored fold search/read/route. No network: fetch is injected.
//   node --test holodeck-research-lanes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { disclosure, searchHosts, makeLanes, looksBinary, labelOf } from './holodeck-research-lanes.js';
import { setBridge } from './vendor/fold-chat/fold-chat-web.js';
import { resetCooldowns, noteRateLimited } from './vendor/fold-chat/fold-chat-route.js';

const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => JSON.stringify(o), headers: new Map() });
const html = (s, status = 200) => ({ ok: status < 400, status, text: async () => s, body: null, json: async () => { throw new Error('not json'); } });

test('the disclosure is derived from the vendored URL builders: the question goes to the hosts search() would call', async () => {
  const h = await searchHosts(['wikipedia', 'github', 'archive', 'openalex', 'crossref']);
  assert.deepEqual(h.wikipedia, ['en.wikipedia.org']);
  assert.deepEqual(h.github, ['api.github.com']);
  assert.deepEqual(h.archive, ['archive.org']);
  assert.deepEqual(h.openalex, ['api.openalex.org']);
  assert.deepEqual(h.crossref, ['api.crossref.org']);
});

test('web search is disclosed as the relay, or — when a bridge is set — as this machine', async () => {
  const noBridge = await disclosure({ bridge: null });
  assert.match(noBridge.search.find(s => s.scope === 'web').hosts[0], /holodeck-proxy\..*workers\.dev.*DuckDuckGo/);
  assert.ok(noBridge.read.some(d => d.id === 'relay'));
  assert.ok(noBridge.read.some(d => d.id === 'proxy') && noBridge.read.some(d => d.id === 'reader'));
  assert.ok(!noBridge.read.some(d => d.id === 'bridge'));
  const withBridge = await disclosure({ bridge: 'http://localhost:8790' });
  assert.match(withBridge.search.find(s => s.scope === 'web').hosts[0], /localhost.*this machine/);
  assert.ok(withBridge.read.some(d => d.id === 'bridge'));
  setBridge(null);
});

test('every disclosed read door names what it learns, and only the site and bridge learn it on a clean read', async () => {
  const d = await disclosure({ bridge: null });
  assert.ok(d.read.every(x => x.learns));
  assert.ok(d.read.filter(x => x.id !== 'site').every(x => /refused|only when/.test(x.learns) || x.id === 'bridge'));
});

test('a response that is not text is turned away as such, not quoted', async () => {
  assert.equal(looksBinary('\u0000\u0001\u0002'.repeat(30)), true);
  assert.equal(looksBinary('Plain prose about a lighthouse and its keepers, long enough to be judged at all.'), false);
  const lanes = makeLanes({ fetchImpl: async () => html('�\u0001�\u0002'.repeat(60)) });
  const r = await lanes.read('https://x.example/blob');
  assert.equal(r.ok, false);
});

test('a page nobody can read is a typed refusal that lists the doors tried', async () => {
  const lanes = makeLanes({ fetchImpl: async () => { throw new Error('network'); } });
  const r = await lanes.read('https://js.example/app');
  assert.equal(r.ok, false);
  assert.match(r.error, /every door was tried/);
  assert.ok(r.tried.includes('direct') && r.tried.includes('public proxies'));
});

test('a readable page comes back with its text, its title and the lane that read it', async () => {
  const body = '<html><head><title>Zorblatt lighthouse</title></head><body><article><p>' + 'The Zorblatt lighthouse was kept by Mara Quill for many years. '.repeat(5) + '</p></article></body></html>';
  const lanes = makeLanes({ fetchImpl: async () => html(body) });
  const r = await lanes.read('https://a.example/z');
  assert.equal(r.ok, true); assert.equal(r.via, 'direct'); assert.match(r.title, /Zorblatt/); assert.match(r.text, /Mara Quill/);
});

test('a PDF address goes to the Holodeck’s own file reader when one is given', async () => {
  let asked = null;
  const lanes = makeLanes({ fetchImpl: async () => { throw new Error('should not be fetched as html'); }, readExtra: async url => { asked = url; return { ok: true, text: 'Text layer of a paper about the Zorblatt lighthouse. '.repeat(4), title: 'Paper', via: 'direct (PDF text layer)', url }; } });
  const r = await lanes.read('https://uni.example/paper.pdf');
  assert.equal(asked, 'https://uni.example/paper.pdf'); assert.equal(r.via, 'direct (PDF text layer)');
});

test('the router, the probe and the cooldown are the fold’s own', async () => {
  resetCooldowns();
  const lanes = makeLanes({ fetchImpl: async () => json({}) });
  const r = lanes.route('which open-source library implements a b-tree in rust?');
  assert.ok(r.scopes.includes('web') && r.scopes.includes('github'));
  assert.ok(r.rest.includes('openalex'));
  const p = lanes.probe([{ url: 'https://arxiv.org/abs/1' }, { url: 'https://pubmed.ncbi.nlm.nih.gov/2' }], r.scopes);
  assert.ok(p.add.includes('openalex') && p.add.includes('crossref'));
  assert.equal(lanes.cooling('web'), false);
  lanes.limited('web', new Error('Web search answered 429'));
  assert.equal(lanes.cooling('web'), true);
  resetCooldowns();
  assert.equal(labelOf('openalex'), 'Research papers · OpenAlex');
});
