import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrive, LEGACY_FOLDERS_KEY, cachedTrashed, TRASHED_CACHE_KEY } from './holodeck-drive-controller.js';
import { STORE_KEY } from './holodeck-drive-log.js';

const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const clock = (t0 = 1_760_000_000_000) => { let t = t0; return () => (t += 1000); };
const ids = (() => { let k = 0; return () => 'fo-n' + ++k; });

test('E3 end to end: the old flat folders appear as folders with their sources, and the legacy key is byte-identical afterwards', () => {
  const legacy = JSON.stringify({ ws: [{ id: 'fo-a', name: 'Contracts', docs: ['x', 'y'] }, { id: 'fo-b', name: 'Press', docs: ['z'] }], other: [{ id: 'fo-q', name: 'Elsewhere', docs: ['z'] }] });
  const st = mem({ [LEGACY_FOLDERS_KEY]: legacy });
  const d = createDrive({ storage: st, workspaceId: 'ws', now: clock(), newId: ids() });
  d.refresh(['x', 'y', 'z', 'w']);
  assert.deepEqual(d.folderList().map(f => [f.id, f.name, f.docs.sort()]), [['fo-a', 'Contracts', ['x', 'y']], ['fo-b', 'Press', ['z']]]);
  assert.equal(d.folderOfDoc('x'), 'fo-a'); assert.equal(d.folderOfDoc('w'), '');
  d.place(['w'], 'fo-b'); d.createFolder('New');
  assert.equal(st.getItem(LEGACY_FOLDERS_KEY), legacy, 'never written');
  assert.equal(d.migration.folders, 2);
});

test('E3 migration happens once: reopening reads the log, and a later change to the legacy list is not re-imported', () => {
  const st = mem({ [LEGACY_FOLDERS_KEY]: JSON.stringify({ ws: [{ id: 'fo-a', name: 'A', docs: ['x'] }] }) });
  const d1 = createDrive({ storage: st, workspaceId: 'ws', now: clock() }); d1.refresh(['x']);
  d1.createFolder('Mine');
  st.setItem(LEGACY_FOLDERS_KEY, JSON.stringify({ ws: [] }));
  const d2 = createDrive({ storage: st, workspaceId: 'ws', now: clock() }); d2.refresh(['x']);
  assert.equal(d2.folderList().length, 2); assert.equal(d2.migration, null);
});

test('an unreadable log is kept aside, not overwritten silently', () => {
  const st = mem({ [STORE_KEY('ws')]: '{broken' });
  const d = createDrive({ storage: st, workspaceId: 'ws', now: clock() });
  assert.ok([...st._m.keys()].some(k => k.startsWith(STORE_KEY('ws') + ':unreadable-')));
  assert.equal(st._m.get([...st._m.keys()].find(k => k.includes('unreadable'))), '{broken');
  assert.equal(d.saved, true);
});

test('E7 the first load says "earlier"; sources arriving later get a time; hydration is not mistaken for arrival', () => {
  const st = mem(); const now = clock();
  const d = createDrive({ storage: st, workspaceId: 'ws', now });
  d.refresh([], { ready: false });                         // large workspace, still hydrating
  assert.equal(Object.keys(d.state.seen).length, 0);
  d.refresh(['a', 'b'], { ready: true });                  // hydrated: they were here before this log
  assert.equal(d.state.seen.a, null);
  d.refresh(['a', 'b', 'c'], { ready: true });             // c really arrived
  assert.ok(Number.isFinite(d.state.seen.c));
  const t = d.state.seen.c; d.refresh(['a', 'b', 'c']);
  assert.equal(d.state.seen.c, t);
});

test('E8 trash: derived cache lists trashed ids synchronously; a folder in Trash takes its sources; restore brings them back; the log keeps both', () => {
  const st = mem(); const d = createDrive({ storage: st, workspaceId: 'ws', now: clock(), newId: ids() });
  d.refresh(['a', 'b', 'c']);
  const f = d.createFolder('F'); d.place(['a', 'b'], f);
  d.trash(['c']); d.trashFolder(f);
  assert.deepEqual([...cachedTrashed(st, 'ws')].sort(), ['a', 'b', 'c']);
  assert.equal(d.isTrashed('a'), true);
  d.restoreFolder(f); d.restore(['c']);
  assert.deepEqual([...cachedTrashed(st, 'ws')], []);
  assert.equal(d.folderOfDoc('a'), f);
  assert.ok(d.events.length >= 6, 'append-only');
});

test('E4 undo through the controller restores a bulk move and a folder trash, in order, and survives a reload', () => {
  const st = mem(); const d = createDrive({ storage: st, workspaceId: 'ws', now: clock(), newId: ids() });
  d.refresh(['a', 'b', 'c']);
  const f = d.createFolder('F'), g = d.createFolder('G');
  d.place(['a', 'b'], f);
  d.place(['a', 'b', 'c'], g);
  assert.equal(d.undoLabel(), 'Moved 3 sources to G');
  d.undo();
  assert.equal(d.folderOfDoc('a'), f); assert.equal(d.folderOfDoc('c'), '');
  d.trashFolder(f); assert.equal(d.isTrashed('a'), true);
  d.undo(); assert.equal(d.isTrashed('a'), false);
  const d2 = createDrive({ storage: st, workspaceId: 'ws', now: clock() }); d2.refresh(['a', 'b', 'c']);
  assert.equal(d2.folderOfDoc('a'), f, 'persisted');
});

test('the rail keeps working on the log: nested folders list by path, with subtree sources', () => {
  const d = createDrive({ storage: mem(), workspaceId: 'ws', now: clock(), newId: ids() });
  d.refresh(['a', 'b']);
  const p = d.createFolder('Parent'), c = d.createFolder('Child', p); d.place(['a'], c); d.place(['b'], p);
  const l = d.folderList();
  assert.deepEqual(l.map(x => x.name), ['Parent', 'Parent / Child']);
  assert.deepEqual([...d.folderDocs(p)].sort(), ['a', 'b']);
});

test('subscribers hear every change; a throwing subscriber does not break the log', () => {
  const d = createDrive({ storage: mem(), workspaceId: 'ws', now: clock(), newId: ids() });
  let n = 0; d.subscribe(() => { throw new Error('bad'); }); d.subscribe(() => n++);
  d.refresh(['a']); d.createFolder('X'); d.trash(['a']);
  assert.ok(n >= 3);
});

test('when storage refuses writes the state still works and says it is not saved', () => {
  const st = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const d = createDrive({ storage: st, workspaceId: 'ws', now: clock(), newId: ids() });
  d.createFolder('X'); assert.equal(d.saved, false); assert.equal(d.folderList().length, 1);
});

test('the same sources in a different workspace are not touched', () => {
  const st = mem(); const a = createDrive({ storage: st, workspaceId: 'A', now: clock(), newId: ids() }); a.refresh(['x']); a.trash(['x']);
  const b = createDrive({ storage: st, workspaceId: 'B', now: clock(), newId: ids() }); b.refresh(['x']);
  assert.equal(b.isTrashed('x'), false);
});

test('E4 a drag of folders AND sources is one Undo that takes both back', () => {
  const d = createDrive({ storage: mem(), workspaceId: 'ws', now: clock(), newId: ids() });
  d.refresh(['a', 'b']);
  const f = d.createFolder('F'), g = d.createFolder('G'), h = d.createFolder('H');
  d.batch('Moved 3 items to H', () => { d.moveFolder(f, h); d.moveFolder(g, h); d.place(['a'], h); });
  assert.equal(d.state.folders[f].parent, h); assert.equal(d.folderOfDoc('a'), h);
  assert.equal(d.undoLabel(), 'Moved 3 items to H');
  d.undo();
  assert.equal(d.state.folders[f].parent, null); assert.equal(d.state.folders[g].parent, null); assert.equal(d.folderOfDoc('a'), '');
  assert.equal(d.undoLabel(), 'Created folder “H”', 'the batch was one entry');
});
