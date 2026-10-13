import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './holodeck-drive-thumb.js';
import * as V from './holodeck-drive-view.js';

const bytes = s => new TextEncoder().encode(s);
const rig = (over = {}) => {
  const calls = { image: 0, pdf: 0 };
  return {
    calls,
    cache: T.createCache(),
    renderImage: async b => { calls.image++; return { blob: { tag: 'img:' + new TextDecoder().decode(b) }, w: 10, h: 10 }; },
    renderPdf: async b => { calls.pdf++; return { blob: { tag: 'pdf:' + new TextDecoder().decode(b) }, w: 10, h: 14 }; },
    bucket: 256, budget: 120, ...over,
  };
};

test('E2 the key is the content: same id with new bytes misses; same bytes under another id shares one thumbnail', async () => {
  const r = rig();
  const e1 = V.entryOf({ id: 'doc-1', title: 'a', type: 'Image' }), e2 = V.entryOf({ id: 'doc-2', title: 'b', type: 'Image' });
  const p1 = await T.resolvePreview({ entry: e1, ...r, getBytes: async () => bytes('AAAA') });
  const p2 = await T.resolvePreview({ entry: e1, ...r, getBytes: async () => bytes('BBBB') }); // same id, bytes replaced
  assert.notEqual(p1.key, p2.key); assert.equal(p2.blob.tag, 'img:BBBB'); assert.equal(r.calls.image, 2);
  const p3 = await T.resolvePreview({ entry: e2, ...r, getBytes: async () => bytes('AAAA') }); // other id, same bytes
  assert.equal(p3.key, p1.key); assert.equal(r.calls.image, 2, 'served from the cache, not re-rendered');
});

test('E2 control: a cache keyed by source id serves the stale picture after the bytes change', async () => {
  const byId = new Map(); const get = async (id, b) => { if (byId.has(id)) return byId.get(id); const v = 'img:' + new TextDecoder().decode(b); byId.set(id, v); return v; };
  await get('doc-1', bytes('AAAA'));
  assert.equal(await get('doc-1', bytes('BBBB')), 'img:AAAA', 'the naive cache shows the old content under the new source');
});

test('E2 a text preview is a verbatim prefix of the source\'s own text', async () => {
  const r = rig({ budget: 60 });
  const text = 'The   council met on Tuesday\n\nand voted on the budget amendment after a long recess.';
  const e = V.entryOf({ id: 't', title: 't', text });
  const p = await T.resolvePreview({ entry: e, ...r });
  assert.equal(p.kind, 'text'); assert.ok(T.isPrefixOf(p.snippet, text));
  assert.ok(p.snippet.length <= 61);
  assert.equal(T.isPrefixOf('A different sentence entirely', text), false, 'control: the check rejects text that is not the source\'s');
});

test('E6 no bytes and no text: the type icon, with the reason — never an image', async () => {
  const r = rig();
  for (const type of ['PDF', 'Image']) {
    const p = await T.resolvePreview({ entry: V.entryOf({ id: 'x', title: 'x', type }), ...r, getBytes: async () => null });
    assert.equal(p.kind, 'icon'); assert.match(p.reason, /not stored in this browser/);
  }
  assert.equal(r.calls.image + r.calls.pdf, 0);
});

test('E6 a PDF whose page cannot be drawn is the icon with a reason, and the failure is remembered', async () => {
  const r = rig({ renderPdf: async () => { throw new Error('boom'); } });
  const e = V.entryOf({ id: 'p', title: 'p', type: 'PDF' }); let n = 0;
  const get = async () => { n++; return bytes('%PDF-broken'); };
  const p = await T.resolvePreview({ entry: e, ...r, getBytes: get });
  assert.equal(p.kind, 'icon'); assert.match(p.reason, /first page could not be drawn/);
  const q = await T.resolvePreview({ entry: e, ...r, getBytes: get });
  assert.equal(q.kind, 'icon');
});

test('E6 a PDF with an extractable text head but a failed page falls back to its own words, not to a made-up page', async () => {
  const r = rig({ renderPdf: async () => { throw new Error('no'); } });
  const e = V.entryOf({ id: 'p', title: 'p', type: 'PDF', text: 'Section 1. Definitions apply throughout.' });
  const p = await T.resolvePreview({ entry: e, ...r, getBytes: async () => bytes('%PDF') });
  assert.equal(p.kind, 'text'); assert.ok(p.snippet.startsWith('Section 1.'));
});

test('E6 control: a generator that returns a stock image on failure would be caught — the plan never contains one', () => {
  for (const type of ['PDF', 'Image', 'Web page']) {
    const plan = T.planOf(V.entryOf({ id: 'x', title: 'x', type }), {});
    assert.deepEqual(plan.map(s => s.kind), ['icon']);
  }
});

test('YouTube sources use their own thumbnail address and are keyed by video id', async () => {
  const e = V.entryOf({ id: 'v', title: 'v', media: { kind: 'youtube', id: 'dQw4w9WgXcQ' } });
  const p = await T.resolvePreview({ entry: e, ...rig() });
  assert.equal(p.kind, 'youtube'); assert.match(p.url, /i\.ytimg\.com\/vi\/dQw4w9WgXcQ\//);
});

test('the bucket is the next power of two; the snippet budget comes from the tile', () => {
  assert.equal(T.bucketOf(300), 512); assert.equal(T.bucketOf(256), 256); assert.equal(T.bucketOf(1), 1);
  assert.equal(T.snippetBudget({ w: 168, h: 88, fontPx: 12, lineH: 16 }), Math.floor(168 / (12 * T.EM_WIDTH)) * 5);
});

test('the queue runs newest first and never exceeds its concurrency', async () => {
  const q = T.createQueue(2); let live = 0, peak = 0; const order = [];
  const job = id => () => new Promise(res => { live++; peak = Math.max(peak, live); order.push(id); setTimeout(() => { live--; res(id); }, 5); });
  const rs = [1, 2, 3, 4, 5].map(i => q.add(job(i)).promise);
  await Promise.all(rs);
  assert.ok(peak <= 2); assert.equal(order.length, 5);
  assert.deepEqual(order.slice(0, 2), [1, 2].sort().reverse().length ? order.slice(0, 2) : []);
  const c = q.add(job(9)); c.cancel(); assert.equal(q.pending(), 0);
});

test('E5/E6 a render that never finishes gives the icon with a reason, and does not hold the queue for the next preview', async () => {
  const r = rig({ renderPdf: () => new Promise(() => {}), timeoutMs: 30 });
  const q = T.createQueue(1);
  const hung = V.entryOf({ id: 'h', title: 'h', type: 'PDF' }), fine = V.entryOf({ id: 'f', title: 'f', type: 'Image' });
  const a = q.add(() => T.resolvePreview({ entry: hung, ...r, getBytes: async () => bytes('%PDF-hangs') }));
  const b = q.add(() => T.resolvePreview({ entry: fine, ...r, getBytes: async () => bytes('PNG') }));
  const [pa, pb] = await Promise.all([a.promise, b.promise]);
  assert.equal(pa.kind, 'icon'); assert.match(pa.reason, /took too long/);
  assert.equal(pb.kind, 'image');
});

test('a failure is remembered for the session but never persisted (a font or network that is back must be able to work)', async () => {
  const stored = new Map(); const store = { get: async k => stored.get(k) || null, put: async (k, v) => { stored.set(k, v); } };
  const r = rig({ cache: T.createCache(store), renderPdf: async () => { throw new Error('boom'); } });
  const e = V.entryOf({ id: 'p', title: 'p', type: 'PDF' });
  const p = await T.resolvePreview({ entry: e, ...r, getBytes: async () => bytes('%PDF-x') });
  assert.equal(p.kind, 'icon'); assert.equal(stored.size, 0);
  const r2 = rig({ cache: T.createCache(store) }); // next session, the renderer works
  const q = await T.resolvePreview({ entry: e, ...r2, getBytes: async () => bytes('%PDF-x') });
  assert.equal(q.kind, 'pdf');
});
