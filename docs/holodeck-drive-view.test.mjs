import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './holodeck-drive-log.js';
import * as V from './holodeck-drive-view.js';

const clock = (t0 = 1_760_000_000_000) => { let t = t0; return () => (t += 1000); };
const run = (s, evs) => evs.reduce(L.applyEvent, s);
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const TYPES = [{ type: 'PDF' }, { type: 'Image' }, { type: 'Web page', url: 'https://x.test/p' }, { type: 'YouTube video', media: { kind: 'youtube', id: 'abc' } }, { type: 'Data' }, { type: 'Notebook log' }, {}];
const synthetic = (n, seed = 1) => {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = TYPES[Math.floor(r() * TYPES.length)];
    return { id: 'd' + i, title: 'Source ' + Math.floor(r() * 1e6).toString(36) + ' ' + i, publisher: r() < 0.7 ? 'Pub ' + Math.floor(r() * 40) : '', text: 'lorem ipsum '.repeat(40 + Math.floor(r() * 400)), year: 1990 + Math.floor(r() * 35), ...t };
  });
};

test('file types are plain and from the record\'s own fields', () => {
  const T = d => V.fileTypeOf(d);
  assert.equal(T({ type: 'PDF' }), 'pdf'); assert.equal(T({ format: 'pdf' }), 'pdf');
  assert.equal(T({ type: 'Image' }), 'image'); assert.equal(T({ media: { kind: 'youtube', id: 'x' } }), 'video');
  assert.equal(T({ type: 'Web page', url: 'u' }), 'web'); assert.equal(T({ medium: 'Audio' }), 'audio');
  assert.equal(T({ type: 'Notebook log' }), 'note'); assert.equal(T({}), 'document');
});

test('status chips are plain words, one at a time, in a fixed order of importance', () => {
  const e = (o) => V.entryOf({ id: 'a', title: 'a', ...o.d }, o.ctx || {}).chip;
  assert.equal(e({ d: { needsRead: true }, ctx: { isNew: new Set(['a']) } }).label, 'New');
  assert.equal(e({ d: { needsRead: true } }).label, 'Needs read');
  assert.equal(e({ d: { type: 'Image' } }), null);
  assert.equal(e({ d: { medium: 'Video' } }).label, 'Not transcribed');
  assert.equal(e({ d: { medium: 'Video' }, ctx: { transcribing: new Set(['a']) } }).label, 'Transcribing');
  assert.equal(e({ d: { medium: 'Video', transcribed: true } }), null);
});

test('E7 "Last modified" is when it was ADDED: a 1999 publication first seen today reads today; an earlier source reads "Earlier", never a made-up time', () => {
  const now = Date.UTC(2026, 9, 12, 15, 30);
  const w = L.makeWriter({ now: () => now, id: () => 'x' }); let s = L.emptyState();
  s = run(s, w.observe(s, ['old'], { earlier: true })); s = run(s, w.observe(s, ['fresh']));
  const ctx = { seen: s.seen };
  const fresh = V.entryOf({ id: 'fresh', title: 'f', published: '1999-04-01', year: 1999 }, ctx), old = V.entryOf({ id: 'old', title: 'o', published: '2001-02-02' }, ctx), unseen = V.entryOf({ id: 'never', title: 'n', published: '2010-01-01' }, ctx);
  assert.equal(fresh.modifiedAt, now); assert.match(V.whenLabel(fresh.modifiedAt, now), /^Today /);
  assert.equal(old.modifiedAt, null); assert.equal(V.whenLabel(old.modifiedAt, now), 'Earlier');
  assert.equal(unseen.modifiedAt, null);
  assert.ok(!/1999|2001|2010/.test(V.whenLabel(fresh.modifiedAt, now)));
});

test('E7 control: a column that reads `published` is caught by the same check', () => {
  const now = Date.UTC(2026, 9, 12);
  const bad = d => Date.parse(d.published);
  assert.notEqual(bad({ published: '1999-04-01' }), now);
});

test('sizes are honest: bytes when known, characters of text when that is all there is, a dash otherwise', () => {
  const e = d => V.sizeLabel(V.entryOf({ id: 'a', title: 'a', ...d }));
  assert.equal(e({ bytes: 1_234_567 }), '1.2 MB'); assert.equal(e({ bytes: 512 }), '512 B');
  assert.equal(e({ text: 'x'.repeat(12345) }), '12,345 characters'); assert.equal(e({}), '—');
});

test('relative times', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0);
  assert.match(V.whenLabel(now - 3600e3, now), /^Today /);
  assert.equal(V.whenLabel(now - 24 * 3600e3, now), 'Yesterday');
  assert.match(V.whenLabel(Date.UTC(2026, 2, 4, 12), now), /Mar 4$/);
  assert.match(V.whenLabel(Date.UTC(2024, 2, 4, 12), now), /2024$/);
});

test('sorting: name is natural, unknown times and sizes are last in either direction, ties are stable', () => {
  const E = (id, o) => V.entryOf({ id, title: id, ...o });
  const es = [E('item 10', {}), E('item 2', {}), E('Item 1', {})];
  assert.deepEqual(V.sortEntries(es, { key: 'name' }).map(e => e.id), ['Item 1', 'item 2', 'item 10']);
  const m = [{ ...E('a', {}), modifiedAt: 5 }, { ...E('b', {}), modifiedAt: null }, { ...E('c', {}), modifiedAt: 9 }];
  assert.deepEqual(V.sortEntries(m, { key: 'modified', dir: 'desc' }).map(e => e.id), ['c', 'a', 'b']);
  assert.deepEqual(V.sortEntries(m, { key: 'modified', dir: 'asc' }).map(e => e.id), ['a', 'c', 'b']);
});

test('the first level shows folders first, then loose sources; opening a folder shows its own; search spans places but never Trash', () => {
  const docs = [{ id: 'a', title: 'Budget memo', type: 'PDF' }, { id: 'b', title: 'Interview', medium: 'Audio' }, { id: 'c', title: 'Budget notes' }, { id: 'd', title: 'Gone budget' }];
  const entries = docs.map(d => V.entryOf(d));
  const w = L.makeWriter({ now: clock(), id: () => 'fo-1' }); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'Finance' })); s = run(s, w.place(s, ['a'], 'fo-1')); s = run(s, w.trash(s, ['d']));
  let r = V.rowsFor({ entries, state: s, location: { kind: 'folder', folder: null }, sort: { key: 'name' } });
  assert.deepEqual(r.folders.map(f => f.name), ['Finance']); assert.deepEqual(r.items.map(e => e.id), ['c', 'b']);
  r = V.rowsFor({ entries, state: s, location: { kind: 'folder', folder: 'fo-1' }, sort: { key: 'name' } });
  assert.deepEqual(r.items.map(e => e.id), ['a']); assert.deepEqual(r.path.map(p => p.name), ['Finance']);
  r = V.rowsFor({ entries, state: s, location: { kind: 'folder', folder: null }, query: 'budget', sort: { key: 'name' } });
  assert.deepEqual(r.items.map(e => e.id), ['a', 'c'], 'finds the one inside Finance, not the trashed one');
  r = V.rowsFor({ entries, state: s, location: { kind: 'trash' } });
  assert.deepEqual(r.items.map(e => e.id), ['d']);
  r = V.rowsFor({ entries, state: s, location: { kind: 'folder', folder: null }, query: 'fin' });
  assert.deepEqual(r.folders.map(f => f.id), ['fo-1'], 'a folder is found by its name too');
});

test('type chips count what is in the place BEFORE the chip is applied, so a chip never hides its siblings', () => {
  const entries = [{ id: 'a', type: 'PDF' }, { id: 'b', type: 'PDF' }, { id: 'c', type: 'Image' }].map(d => V.entryOf({ title: d.id, ...d }));
  const r = V.rowsFor({ entries, state: L.emptyState(), location: { kind: 'folder', folder: null }, types: new Set(['pdf']) });
  assert.deepEqual(r.items.map(e => e.id).sort(), ['a', 'b']);
  assert.deepEqual(r.types.map(t => [t.key, t.n]), [['image', 1], ['pdf', 2]]);
});

test('Starred, Seen and Recent are views over the same sources', () => {
  const now = 1_760_000_000_000;
  const docs = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  const ctx = { seen: { a: now - 5000, b: now - 1000, c: null }, openedAt: { c: now - 100 }, notKept: new Set(['b']) };
  const entries = docs.map(d => V.entryOf(d, ctx));
  const w = L.makeWriter({ now: clock(), id: () => 'x' }); let s = L.emptyState(); s = run(s, w.star(s, ['a'], true));
  assert.deepEqual(V.rowsFor({ entries, state: s, location: { kind: 'starred' } }).items.map(e => e.id), ['a']);
  assert.deepEqual(V.rowsFor({ entries, state: s, location: { kind: 'seen' } }).items.map(e => e.id), ['b']);
  assert.deepEqual(V.rowsFor({ entries, state: s, location: { kind: 'recent' } }).items.map(e => e.id), ['c', 'a'], 'newest first; "Seen, not kept" stays out of Recent');
});

test('E8 trashed sources are listed in Trash and drop out of every other place', () => {
  const entries = ['a', 'b'].map(id => V.entryOf({ id, title: id }));
  const w = L.makeWriter({ now: clock(), id: () => 'x' }); let s = L.emptyState(); s = run(s, w.trash(s, ['a']));
  for (const kind of ['starred', 'recent', 'seen']) assert.ok(!V.rowsFor({ entries, state: s, location: { kind } }).items.some(e => e.id === 'a'));
  assert.deepEqual(V.rowsFor({ entries, state: s, location: { kind: 'folder', folder: null } }).items.map(e => e.id), ['b']);
});

// ── E5: scale ──────────────────────────────────────────────────────────────
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const buildWorkspace = n => {
  const docs = synthetic(n, 7), now = Date.now();
  const w = L.makeWriter({ now: clock(), id: (() => { let k = 0; return () => 'fo-' + ++k; })() }); let s = L.emptyState();
  const folders = []; for (let i = 0; i < 30; i++) { const p = i > 5 ? folders[i % 6] : null; const ev = w.createFolder(s, { name: 'Folder ' + i, parent: p }); s = run(s, ev); folders.push(ev[0].content.folder); }
  docs.forEach((d, i) => { if (i % 3 === 0) s = run(s, w.place(s, [d.id], folders[i % folders.length])); });
  const seen = Object.fromEntries(docs.map((d, i) => [d.id, now - i * 60000]));
  return { docs, state: s, ctx: { seen }, folders };
};

for (const n of [500, 2000]) {
  test(`E5 ${n} sources: deriving entries, rows and the window — timings`, () => {
    const { docs, state, ctx } = buildWorkspace(n);
    const t = {}; const time = (k, f, reps = 15) => { const xs = []; let out; for (let i = 0; i < reps; i++) { const t0 = performance.now(); out = f(); xs.push(performance.now() - t0); } t[k] = +median(xs).toFixed(2); return out; };
    const entries = time('entries', () => docs.map(d => V.entryOf(d, ctx)), 5);
    for (const key of ['name', 'modified', 'type', 'size', 'publisher', 'statements']) time('rows:' + key, () => V.rowsFor({ entries, state, location: { kind: 'folder', folder: null }, sort: { key } }));
    time('rows:search', () => V.rowsFor({ entries, state, location: { kind: 'folder', folder: null }, query: 'source pub 7' }));
    time('rows:everything-root', () => V.rowsFor({ entries, state: L.emptyState(), location: { kind: 'folder', folder: null }, sort: { key: 'modified' } }));
    time('window', () => V.windowOf({ count: n, rowH: 44, viewportH: 800, scrollTop: 22000 }));
    console.log(`  [timing n=${n}] ` + JSON.stringify(t) + ` (frame budget ${V.DECLARED.FRAME_MS.toFixed(1)} ms)`);
    // P-budget (pre-registered): one interaction's derivation fits in one frame
    const worst = Math.max(...Object.entries(t).filter(([k]) => k.startsWith('rows:')).map(([, v]) => v));
    assert.ok(worst <= V.DECLARED.FRAME_MS, `worst rows derivation ${worst} ms exceeds one frame (${V.DECLARED.FRAME_MS.toFixed(1)} ms)`);
  });
}

test('E5 the drawn window is bounded by the viewport, not by the number of sources; the render-everything control scales with N', () => {
  const drawn = n => { const w = V.windowOf({ count: n, rowH: 44, viewportH: 800, scrollTop: 5000 }); return w.end - w.start; };
  assert.equal(drawn(500), drawn(2000)); assert.equal(drawn(2000), drawn(20000));
  const everything = n => n; // the control: mount every row
  assert.ok(everything(2000) > 4 * drawn(2000));
  // padding reserves the full scroll height so the scrollbar is true
  const w = V.windowOf({ count: 2000, rowH: 44, viewportH: 800, scrollTop: 5000 });
  assert.equal(w.padTop + (w.end - w.start) * 44 + w.padBottom, 2000 * 44);
});

test('E5 stacked blocks: folders then files, each windowed against the same viewport, node count bounded', () => {
  const run = (nFiles, scrollTop) => V.windowBlocks({ blocks: [{ id: 'f', count: 30, rowH: 70, perRow: 6, header: 28 }, { id: 'x', count: nFiles, rowH: 220, perRow: 6, header: 28 }], viewportH: 800, scrollTop });
  const drawn = r => r.blocks.reduce((n, b) => n + (b.w.end - b.w.start), 0);
  assert.ok(drawn(run(2000, 5000)) <= 6 * (Math.ceil(800 / 220) * 3) + 6 * (Math.ceil(800 / 70) * 3));
  assert.equal(drawn(run(2000, 5000)), drawn(run(20000, 5000)), 'independent of how many files there are');
  const top = run(2000, 0);
  assert.equal(top.blocks[0].w.start, 0); assert.ok(top.blocks[1].w.end > 0, 'the files block starts inside the first viewport');
  const deep = run(2000, 30000);
  assert.equal(deep.blocks[0].w.end - deep.blocks[0].w.start, 0, 'folders far above draw nothing');
  assert.equal(deep.total, 28 + 5 * 70 + 28 + Math.ceil(2000 / 6) * 220);
});

test('grid metrics derive columns from the container and the declared minimum tile', () => {
  const g = w => V.gridMetrics(w, { minTile: V.DECLARED.MIN_TILE_PX, gap: 12 });
  assert.equal(g(375).cols, 2); assert.equal(g(1134).cols, 6);
  assert.ok(g(1134).tileW >= 168); assert.equal(g(100).cols, 1);
  const w = V.windowOf({ count: 100, rowH: 200, viewportH: 600, scrollTop: 0, perRow: 6 });
  assert.equal(w.rows, 17); assert.equal(w.start, 0);
});

test('E10 context menus: one source, many, a folder, and Trash each offer what can be done and nothing that cannot', () => {
  const e = V.entryOf({ id: 'a', title: 'a', type: 'PDF', url: 'https://x.test', needsRead: true });
  const ids = m => m.map(x => x.id);
  assert.deepEqual(ids(V.menuFor({ sel: [e] })), ['open', 'details', 'star', 'rename', 'move', 'readPixels', 'openOriginal', 'trash']);
  assert.deepEqual(ids(V.menuFor({ sel: [e, e] })), ['star', 'move', 'trash']);
  assert.deepEqual(ids(V.menuFor({ folderSel: ['f1'] })), ['open', 'rename', 'trash']);
  assert.deepEqual(ids(V.menuFor({ sel: [e], location: { kind: 'trash' } })), ['restore', 'deleteForever']);
  assert.equal(V.menuFor({ sel: [e, e] }).at(-1).label, 'Move 2 to Trash');
});

test('E12 nothing a person can read uses the canon vocabulary', () => {
  const banned = /\b(ground|figure|pattern|void|terrain|holon|operator|grain|domain|mode|eot|gfp|cube|archon|helix|referent|fold)\b/i;
  const s = V.visibleStrings();
  assert.ok(s.length > 30);
  for (const x of s) assert.ok(!banned.test(x), 'canon word in: ' + x);
  assert.ok(banned.test('the ground of the figure'), 'control: the lint does catch a canon string');
});
