import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './holodeck-drive-log.js';

// a deterministic clock and a seeded generator: tests must be reproducible
const clock = (t0 = 1_700_000_000_000) => { let t = t0; return () => (t += 1000); };
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const snap = s => JSON.parse(JSON.stringify({ folders: s.folders, place: s.place, starred: s.starred, trashedAt: s.trashedAt }));
const mkW = () => { let k = 0; return L.makeWriter({ now: clock(), id: () => 'fo-' + (++k) }); };
const run = (s, evs) => evs.reduce(L.applyEvent, s);

test('a folder is made, named, nested and the breadcrumb says where it is', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: '  Hearings  ' }));
  s = run(s, w.createFolder(s, { name: 'Exhibits', parent: 'fo-1' }));
  s = run(s, w.createFolder(s, { name: 'Scans', parent: 'fo-2' }));
  assert.equal(s.folders['fo-1'].name, 'Hearings');
  assert.deepEqual(L.pathOf(s, 'fo-3').map(x => x.name), ['Hearings', 'Exhibits', 'Scans']);
  assert.throws(() => w.createFolder(s, { name: '   ' }), e => e.code === 'empty-name');
  assert.throws(() => w.createFolder(s, { name: 'x', parent: 'nope' }), e => e.code === 'no-parent');
});

test('E9 a folder cannot go inside itself or a descendant — refused on write, ignored on fold', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B', parent: 'fo-1' })); s = run(s, w.createFolder(s, { name: 'C', parent: 'fo-2' }));
  assert.throws(() => w.moveFolder(s, 'fo-1', 'fo-3'), e => e.code === 'cycle');
  assert.throws(() => w.moveFolder(s, 'fo-1', 'fo-1'), e => e.code === 'cycle');
  // a log written elsewhere that tries it anyway: the fold ignores the event and stays finite
  const evil = { type: L.NS + 'folder.move', content: { folder: 'fo-1', parent: 'fo-3' }, origin_server_ts: 9, sender: '@x', event_id: '$x' };
  const after = L.applyEvent(s, evil);
  assert.equal(after.folders['fo-1'].parent, null);
  assert.deepEqual(L.pathOf(after, 'fo-3').map(x => x.id), ['fo-1', 'fo-2', 'fo-3']);
});

test('E9 control: a move with no ancestor check DOES make a cycle the path walk would never finish (the guard is what stops it)', () => {
  const naive = { a: { id: 'a', parent: 'c' }, b: { id: 'b', parent: 'a' }, c: { id: 'c', parent: 'b' } };
  const s = { ...L.emptyState(), folders: Object.assign(Object.create(null), Object.fromEntries(Object.entries(naive).map(([k, v]) => [k, { ...v, name: k, trashed: null }]))) };
  const p = L.pathOf(s, 'a'); // must terminate, and within the guard (folders + 2), never loop
  assert.equal(p.length, 3, 'each folder once');
  assert.ok(Array.isArray(L.descendants(s, 'a')));
});

test('sources default to the top level; place moves them; the index counts subtrees', () => {
  const w = mkW(); let s = L.emptyState(); const U = ['s1', 's2', 's3', 's4'];
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B', parent: 'fo-1' }));
  s = run(s, w.place(s, ['s1', 's2'], 'fo-1')); s = run(s, w.place(s, ['s3'], 'fo-2'));
  const ix = L.indexOf(s, U);
  assert.deepEqual(ix.sourceKids[''], ['s4']);
  assert.deepEqual(ix.sourceKids['fo-1'], ['s1', 's2']);
  assert.equal(ix.counts['fo-1'].subtree, 3); assert.equal(ix.counts['fo-1'].direct, 2); assert.equal(ix.counts['fo-1'].folders, 1);
  assert.deepEqual(L.subtreeSources(s, U, 'fo-1').sort(), ['s1', 's2', 's3']);
  assert.deepEqual(w.place(s, ['s1'], 'fo-1'), [], 'moving to where it already is writes nothing');
});

test('Trash: a source goes to Trash and comes back to the folder it left', () => {
  const w = mkW(); let s = L.emptyState(); const U = ['s1', 's2'];
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.place(s, ['s1'], 'fo-1'));
  s = run(s, w.trash(s, ['s1']));
  let ix = L.indexOf(s, U);
  assert.deepEqual(ix.trashedSources, ['s1']); assert.deepEqual(ix.sourceKids['fo-1'] || [], []);
  s = run(s, w.restore(s, ['s1']));
  ix = L.indexOf(s, U);
  assert.deepEqual(ix.sourceKids['fo-1'], ['s1']); assert.deepEqual(ix.trashedSources, []);
});

test('Trash: a folder takes its contents with it, and restoring returns every one in place', () => {
  const w = mkW(); let s = L.emptyState(); const U = ['s1', 's2', 's3'];
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B', parent: 'fo-1' }));
  s = run(s, w.place(s, ['s1'], 'fo-1')); s = run(s, w.place(s, ['s2'], 'fo-2'));
  s = run(s, w.trashFolder(s, 'fo-1', { withContents: true }));
  let ix = L.indexOf(s, U);
  assert.deepEqual(ix.trashTopFolders, ['fo-1']);
  assert.deepEqual(ix.sourceKids[''], ['s3']);
  assert.equal(L.placeOf(s, 's2').trashed, true); assert.equal(L.placeOf(s, 's2').via, 'folder:fo-1');
  assert.equal(L.folderStatus(s, 'fo-2').trashed, true); assert.equal(L.folderStatus(s, 'fo-2').topLevel, false);
  s = run(s, w.restoreFolder(s, 'fo-1'));
  ix = L.indexOf(s, U);
  assert.deepEqual(ix.sourceKids['fo-1'], ['s1']); assert.deepEqual(ix.sourceKids['fo-2'], ['s2']);
  assert.deepEqual(ix.folderKids[''], ['fo-1']); assert.deepEqual(ix.folderKids['fo-1'], ['fo-2']);
});

test('Trash: removing a folder but KEEPING its sources lifts them to the parent, and restoring puts them back', () => {
  const w = mkW(); let s = L.emptyState(); const U = ['s1', 's2'];
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B', parent: 'fo-1' }));
  s = run(s, w.place(s, ['s1'], 'fo-2')); s = run(s, w.place(s, ['s2'], 'fo-1'));
  s = run(s, w.trashFolder(s, 'fo-2', { withContents: false }));
  let ix = L.indexOf(s, U);
  assert.deepEqual(ix.sourceKids['fo-1'].sort(), ['s1', 's2'], 'both now show in A');
  assert.deepEqual(ix.trashTopFolders, ['fo-2']);
  s = run(s, w.restoreFolder(s, 'fo-2'));
  ix = L.indexOf(s, U);
  assert.deepEqual(ix.sourceKids['fo-2'], ['s1']); assert.deepEqual(ix.sourceKids['fo-1'], ['s2']);
});

test('placing into a folder that is in Trash is refused', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.trashFolder(s, 'fo-1'));
  assert.throws(() => w.place(s, ['s1'], 'fo-1'), e => e.code === 'folder-in-trash');
});

test('first sight stamps an added time once and never changes it; a log that is new says "earlier", not a time', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.observe(s, ['a', 'b'], { earlier: true }));
  assert.equal(s.seen.a, null);
  s = run(s, w.observe(s, ['a', 'c']));
  assert.equal(s.seen.a, null, 'an earlier source never acquires a time');
  assert.ok(Number.isFinite(s.seen.c));
  const t = s.seen.c; s = run(s, w.observe(s, ['c']));
  assert.equal(s.seen.c, t);
});

// ── E3: migration ──────────────────────────────────────────────────────────
const legacyCorpus = rand => {
  const nF = 1 + Math.floor(rand() * 6), docs = Array.from({ length: 12 }, (_, i) => 'd' + i), out = [];
  for (let i = 0; i < nF; i++) {
    const f = { id: rand() < 0.1 && out.length ? out[0].id : 'fo-' + i, name: rand() < 0.1 ? '' : 'Folder ' + i, docs: [] };
    for (const d of docs) if (rand() < 0.3) f.docs.push(d);
    if (rand() < 0.1) delete f.docs;
    if (rand() < 0.1 && f.docs) f.docs.push(...f.docs); // duplicates inside one folder
    out.push(f);
  }
  if (rand() < 0.3) out.push(null, 'junk', 7);
  return out;
};
const memberships = legacy => { const m = new Set(); for (const f of legacy.filter(x => x && typeof x === 'object')) for (const d of (Array.isArray(f.docs) ? f.docs : [])) m.add(String(d)); return m; };

test('E3 migration keeps every folder and every membership (adopted or itemised), 300 random stores', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const legacy = legacyCorpus(rng(seed)); const before = JSON.stringify(legacy);
    const ev = L.migrateLegacy(legacy, { now: clock() });
    assert.equal(JSON.stringify(legacy), before, 'the legacy value is not mutated');
    const s = L.foldEvents(ev);
    const objs = legacy.filter(x => x && typeof x === 'object');
    assert.equal(Object.keys(s.folders).length, objs.length, 'seed ' + seed + ': every legacy folder becomes a folder');
    const mig = s.migrations[0];
    // every legacy source ends adopted (has a place) — and any extra folder membership is in the residue
    for (const d of memberships(legacy)) assert.ok(d in s.place, `seed ${seed}: ${d} has a place`);
    const alsoCount = mig.residue.reduce((n, r) => n + r.also.length, 0);
    const legacyPairs = objs.reduce((n, f) => n + new Set((Array.isArray(f.docs) ? f.docs : []).map(String)).size, 0);
    assert.equal(Object.keys(s.place).length + alsoCount, legacyPairs, `seed ${seed}: adopted + residue = every membership`);
    // names survive (an empty name is given a plain default, not dropped)
    const names = Object.values(s.folders).map(f => f.name).sort(), want = objs.map(f => String(f.name || '').trim() || 'Untitled folder').sort();
    assert.deepEqual(names, want, 'seed ' + seed);
  }
});

test('E3 migration keeps the original folder ids (so anything that remembered one still resolves)', () => {
  const legacy = [{ id: 'fo-abc', name: 'Contracts', docs: ['x', 'y'] }, { id: 'fo-def', name: 'Press', docs: ['z'] }];
  const s = L.foldEvents(L.migrateLegacy(legacy, { now: clock() }));
  assert.deepEqual(Object.keys(s.folders).sort(), ['fo-abc', 'fo-def']);
  assert.equal(s.place.x, 'fo-abc'); assert.equal(s.place.z, 'fo-def');
});

test('E3 a source listed under two legacy folders is placed in the first and the second is itemised', () => {
  const s = L.foldEvents(L.migrateLegacy([{ id: 'a', name: 'A', docs: ['x'] }, { id: 'b', name: 'B', docs: ['x', 'y'] }], { now: clock() }));
  assert.equal(s.place.x, 'a'); assert.equal(s.place.y, 'b');
  assert.deepEqual(s.migrations[0].residue, [{ source: 'x', adopted: 'a', also: ['b'] }]);
});

test('E3 control: a migration that copies only the first folder is caught by the same invariant', () => {
  const legacy = [{ id: 'a', name: 'A', docs: ['x'] }, { id: 'b', name: 'B', docs: ['y'] }];
  const bad = L.foldEvents(L.migrateLegacy(legacy.slice(0, 1), { now: clock() }));
  assert.notEqual(Object.keys(bad.folders).length, legacy.length);
  assert.ok(!('y' in bad.place));
});

test('migration of an empty or absent legacy list is a recorded no-op', () => {
  for (const x of [undefined, null, [], 'x']) { const s = L.foldEvents(L.migrateLegacy(x, { now: clock() })); assert.equal(Object.keys(s.folders).length, 0); assert.equal(s.migrations.length, 1); }
});

test('duplicate legacy folder ids are kept apart (the second gets a new id, and says so)', () => {
  const s = L.foldEvents(L.migrateLegacy([{ id: 'a', name: 'A', docs: ['x'] }, { id: 'a', name: 'A again', docs: ['y'] }], { now: clock() }));
  assert.equal(Object.keys(s.folders).length, 2);
  assert.deepEqual(s.migrations[0].renamedIds, [{ from: 'a', to: 'a-2' }]);
  assert.equal(s.place.y, 'a-2');
});

// ── E4: undo ───────────────────────────────────────────────────────────────
const randomOp = (rand, s, w, U) => {
  const folders = Object.keys(s.folders), pick = a => a[Math.floor(rand() * a.length)];
  const some = () => [...new Set(Array.from({ length: 1 + Math.floor(rand() * 4) }, () => pick(U)))];
  const k = Math.floor(rand() * 10);
  try {
    if (k === 0 || !folders.length) return w.createFolder(s, { name: 'F' + Math.floor(rand() * 99), parent: folders.length && rand() < 0.5 ? pick(folders) : null });
    if (k === 1) return w.renameFolder(s, pick(folders), 'R' + Math.floor(rand() * 99));
    if (k === 2) return w.moveFolder(s, pick(folders), rand() < 0.3 ? null : pick(folders));
    if (k === 3) return w.trashFolder(s, pick(folders), { withContents: rand() < 0.5 });
    if (k === 4) return w.restoreFolder(s, pick(folders));
    if (k === 5) return w.place(s, some(), rand() < 0.2 ? null : pick(folders));
    if (k === 6) return w.star(s, some(), rand() < 0.6);
    if (k === 7) return w.trash(s, some());
    if (k === 8) return w.restore(s, some());
    return w.place(s, some(), pick(folders));
  } catch (e) { if (e instanceof L.DriveRefusal) return []; throw e; }
};

test('E4 undo restores the exact state: 400 random sequences, every step undone', () => {
  const U = Array.from({ length: 10 }, (_, i) => 's' + i);
  for (let seed = 1; seed <= 400; seed++) {
    const rand = rng(seed * 7919), w = mkW(); let s = L.emptyState();
    for (let step = 0; step < 14; step++) {
      const evs = randomOp(rand, s, w, U); if (!evs.length) continue;
      const before = snap(s);
      const inv = evs.flatMap(ev => L.inverseOf(s, ev, w));
      const applied = run(s, evs);
      const back = run(applied, inv);
      assert.deepEqual(snap(back), before, `seed ${seed} step ${step}: ${evs[0].type}`);
      s = applied; // keep going from the applied state, not the undone one
    }
  }
});

test('E4 a bulk move is undone as a whole, each source back to the folder it came from', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B' }));
  s = run(s, w.place(s, ['s1'], 'fo-1')); s = run(s, w.place(s, ['s2'], 'fo-2'));
  const mv = w.place(s, ['s1', 's2', 's3'], 'fo-2');
  const inv = mv.flatMap(ev => L.inverseOf(s, ev, w));
  const back = run(run(s, mv), inv);
  assert.equal(back.place.s1, 'fo-1'); assert.equal(back.place.s2, 'fo-2'); assert.ok(!('s3' in back.place));
});

test('E4 control: an undo that only reverses the last item of a bulk move fails the same check', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.place(s, ['s1', 's2'], 'fo-1'));
  s = run(s, w.createFolder(s, { name: 'B' }));
  const mv = w.place(s, ['s1', 's2'], 'fo-2');
  const bad = [w.mk('source.place', { sources: ['s2'], folder: 'fo-1' })]; // last item only
  const back = run(run(s, mv), bad);
  assert.notDeepEqual(snap(back), snap(s));
});

test('the log only grows: undo appends, nothing is removed', () => {
  const w = mkW(); let log = []; let s = L.emptyState();
  const add = evs => { log = log.concat(evs); s = run(s, evs); };
  add(w.createFolder(s, { name: 'A' })); add(w.place(s, ['s1'], 'fo-1'));
  const before = log.slice(); add(w.place(s, ['s1'], null).flatMap(ev => [ev, ...L.inverseOf(s, ev, w)]));
  assert.deepEqual(log.slice(0, before.length), before);
  assert.ok(log.length > before.length);
});

// ── the record vocabulary + persistence ────────────────────────────────────
test('the structure exports as ins/def/con in the workspace record vocabulary', () => {
  const w = mkW(); let s = L.emptyState();
  s = run(s, w.createFolder(s, { name: 'A' })); s = run(s, w.createFolder(s, { name: 'B', parent: 'fo-1' }));
  s = run(s, w.place(s, ['s9'], 'fo-2')); s = run(s, w.star(s, ['s9'], true));
  const r = L.toRecordEvents(s);
  assert.ok(r.some(e => e.type === 'io.holodeck.ins' && e.content.anchor === 'folder:fo-1' && e.content.entity_type === 'Folders'));
  assert.ok(r.some(e => e.type === 'io.holodeck.con' && e.content.source_anchor === 'folder:fo-2' && e.content.target_anchor === 'folder:fo-1'));
  assert.ok(r.some(e => e.type === 'io.holodeck.con' && e.content.source_anchor === 'src:s9' && e.content.target_anchor === 'folder:fo-2'));
  assert.ok(r.some(e => e.type === 'io.holodeck.def' && e.content.anchor === 'src:s9' && e.content.field === 'starred'));
});

test('persistence is a thin pair over any storage; unreadable is reported, not thrown', () => {
  const mem = new Map(); const st = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(L.loadLog(st, 'w'), { events: [], exists: false });
  const w = mkW(); const evs = w.createFolder(L.emptyState(), { name: 'A' });
  assert.equal(L.saveLog(st, 'w', evs), true);
  assert.equal(L.loadLog(st, 'w').events.length, 1);
  mem.set(L.STORE_KEY('w'), '{not json'); assert.equal(L.loadLog(st, 'w').unreadable, true);
  assert.equal(L.saveLog({ setItem() { throw new Error('quota'); } }, 'w', evs), false);
});

test('ids that look like object internals are just ids', () => {
  const w = mkW(); const s0 = L.emptyState();
  const t = run(s0, w.createFolder(s0, { name: 'A', folder: 'fo-1' }));
  const u = run(t, w.place(t, ['__proto__', 'constructor'], 'fo-1'));
  assert.equal(u.place['__proto__'], 'fo-1'); assert.equal(({}).polluted, undefined); assert.equal(Object.getPrototypeOf(u.place), null);
});
