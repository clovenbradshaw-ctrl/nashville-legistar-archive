// holodeck-drive-controller.js — one workspace's Drive state: the append-only log
// (holodeck-drive-log.js) bound to a storage, with first-open migration of the
// old flat folder list, first-sight stamping, an undo stack, and subscribers.
// Still DOM-free: storage and the clock are injected, so every guarantee here is
// testable in node.
//
// Persistence layout (all localStorage-shaped, per workspace):
//   hd:drive:<id>            the log   { v:1, events:[…] }     ← the source of truth
//   hd:drive:<id>:trashed    derived   [sourceId…]             ← a cache the page reads
//                                                               synchronously before this
//                                                               module has loaded; rebuilt
//                                                               from the log, never trusted
//                                                               over it
//   fold-explorer-folders    legacy    { <id>: [{id,name,docs}] } ← NEVER written here
//
// Prefs (view mode, sort, columns) are a per-viewer convenience, not workspace
// state, and live under hd:drive-prefs:<id>.

import * as L from './holodeck-drive-log.js';

export const LEGACY_FOLDERS_KEY = 'fold-explorer-folders';
export const TRASHED_CACHE_KEY = id => L.STORE_KEY(id) + ':trashed';
export const PREFS_KEY = id => 'hd:drive-prefs:' + id;

// the sync read the page does before this module is loaded
export function cachedTrashed(storage, workspaceId) {
  try { const a = JSON.parse(storage.getItem(TRASHED_CACHE_KEY(workspaceId)) || '[]'); return Array.isArray(a) ? new Set(a.map(String)) : new Set(); } catch (e) { return new Set(); }
}

function readLegacy(storage, workspaceId) {
  try { const all = JSON.parse(storage.getItem(LEGACY_FOLDERS_KEY) || '{}'); const l = all && all[workspaceId]; return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

export function createDrive({ storage, workspaceId, now = () => Date.now(), sender = '@you:this-tab', newId = null }) {
  const w = L.makeWriter({ now, sender, id: newId });
  const subs = new Set();
  let events = [], state = L.emptyState(), saved = true, universe = [], freshLog = false, report = null, undo = [], version = 0, group = null;

  // ── load (+ migrate, + never lose an unreadable log) ──
  const loaded = L.loadLog(storage, workspaceId);
  if (loaded.exists) { events = loaded.events; state = L.foldEvents(events); }
  else {
    if (loaded.unreadable) { try { const raw = storage.getItem(L.STORE_KEY(workspaceId)); if (raw) storage.setItem(L.STORE_KEY(workspaceId) + ':unreadable-' + now().toString(36), raw); } catch (e) { /* best effort */ } }
    const legacy = readLegacy(storage, workspaceId);
    events = L.migrateLegacy(legacy, { now, sender: 'migration' });
    state = L.foldEvents(events); freshLog = true;
    saved = L.saveLog(storage, workspaceId, events);
    report = state.migrations[0] || null;
  }

  const persist = () => {
    saved = L.saveLog(storage, workspaceId, events);
    try { storage.setItem(TRASHED_CACHE_KEY(workspaceId), JSON.stringify([...trashedIds()])); } catch (e) { /* the cache is optional */ }
  };
  let tMemo = null;
  const trashedIds = () => {
    if (tMemo && tMemo.state === state && tMemo.universe === universe) return tMemo.set;
    const set = new Set(); for (const id of universe) if (L.placeOf(state, id).trashed) set.add(id); for (const id of Object.keys(state.trashedAt)) set.add(id);
    tMemo = { state, universe, set }; return set;
  };
  const emit = () => { version++; for (const f of subs) { try { f(api); } catch (e) { /* a subscriber must not break the log */ } } };

  // append events; `label` + `inv` make it undoable
  const commit = (evs, label) => {
    if (!evs.length) return false;
    const before = state;
    const inv = evs.flatMap(ev => L.inverseOf(before, ev, w));
    for (const ev of evs) { events.push(ev); state = L.applyEvent(state, ev); }
    persist();
    if (label && inv.length) { if (group) group.push(inv); else { undo.push({ label, inv }); if (undo.length > 100) undo.shift(); } }
    emit(); return true;
  };

  const api = {
    get state() { return state; }, get events() { return events; }, get version() { return version; },
    get saved() { return saved; }, get migration() { return report; }, get universe() { return universe; },
    workspaceId,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },

    // The sources that exist right now. `ready` = the page has finished loading
    // this workspace's sources (large ones hydrate after first paint); until
    // then nothing is stamped, because an empty universe is not "no sources".
    refresh(ids, { ready = true } = {}) {
      universe = ids.map(String);
      if (!ready) return false;
      const evs = w.observe(state, universe, { earlier: freshLog });
      freshLog = false;
      if (evs.length) { for (const ev of evs) { events.push(ev); state = L.applyEvent(state, ev); } persist(); emit(); return true; }
      // the derived trashed cache may be stale against a new universe
      try { storage.setItem(TRASHED_CACHE_KEY(workspaceId), JSON.stringify([...trashedIds()])); } catch (e) { /* optional */ }
      return false;
    },

    createFolder(name, parent = null) { const evs = w.createFolder(state, { name, parent }); commit(evs, 'Created folder “' + evs[0].content.name + '”'); return evs[0].content.folder; },
    renameFolder(id, name) { const f = state.folders[id], old = f && f.name; const evs = w.renameFolder(state, id, name); commit(evs, 'Renamed “' + old + '”'); },
    moveFolder(id, parent) { const f = state.folders[id]; const evs = w.moveFolder(state, id, parent); commit(evs, 'Moved folder “' + (f && f.name) + '”'); },
    trashFolder(id, opts) {
      const f = state.folders[id]; const evs = w.trashFolder(state, id, opts);
      const n = (opts && opts.withContents === false) ? 0 : L.subtreeSources(state, universe, id).length;
      commit(evs, (opts && opts.withContents === false ? 'Removed folder “' : 'Moved folder “') + (f && f.name) + (opts && opts.withContents === false ? '”, kept its sources' : '” to Trash' + (n ? ' with ' + n + ' source' + (n === 1 ? '' : 's') : '')));
    },
    restoreFolder(id) { const f = state.folders[id]; commit(w.restoreFolder(state, id), 'Restored folder “' + (f && f.name) + '”'); },
    place(ids, folder) {
      const evs = w.place(state, ids, folder); const n = evs.length ? evs[0].content.sources.length : 0;
      const where = folder == null ? 'My sources' : state.folders[folder].name;
      commit(evs, 'Moved ' + n + ' source' + (n === 1 ? '' : 's') + ' to ' + where); return n;
    },
    star(ids, on) { const evs = w.star(state, ids, on); const n = evs.length ? evs[0].content.sources.length : 0; commit(evs, (on ? 'Starred ' : 'Removed star from ') + n + ' source' + (n === 1 ? '' : 's')); return n; },
    trash(ids) { const evs = w.trash(state, ids); const n = evs.length ? evs[0].content.sources.length : 0; commit(evs, 'Moved ' + n + ' source' + (n === 1 ? '' : 's') + ' to Trash'); return n; },
    restore(ids) { const evs = w.restore(state, ids); const n = evs.length ? evs[0].content.sources.length : 0; commit(evs, 'Restored ' + n + ' source' + (n === 1 ? '' : 's')); return n; },

    // several writes that one Undo takes back together (a drag of folders AND sources)
    batch(label, fn) {
      if (group) return fn();
      group = [];
      try { return fn(); } finally {
        const g = group; group = null;
        if (g.length) { undo.push({ label, inv: g.reverse().flat() }); if (undo.length > 100) undo.shift(); }
      }
    },
    canUndo() { return undo.length > 0; },
    undoLabel() { return undo.length ? undo[undo.length - 1].label : ''; },
    undo() {
      const u = undo.pop(); if (!u) return false;
      for (const ev of u.inv) { events.push(ev); state = L.applyEvent(state, ev); }
      persist(); emit(); return true;
    },
    // forget a doc id that was permanently deleted from the workspace elsewhere:
    // nothing to write — placements for ids that are gone simply do not resolve

    trashedIds, isTrashed: id => L.placeOf(state, id).trashed,
    // the old API's shapes, so the page's rail keeps working on the log
    folderList() {
      const ix = L.indexOf(state, universe);
      return Object.keys(state.folders).filter(id => !L.folderStatus(state, id).trashed)
        .map(id => ({ id, name: L.pathOf(state, id).map(p => p.name).join(' / '), docs: L.subtreeSources(state, universe, id), direct: ix.sourceKids[id] || [] }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    },
    folderDocs(id) { return new Set(L.subtreeSources(state, universe, id)); },
    folderOfDoc(id) { const p = L.placeOf(state, id); return p.trashed || p.folder == null ? '' : p.folder; },
    toRecordEvents(opts) { return L.toRecordEvents(state, opts); },

    // prefs
    prefs() { try { return JSON.parse(storage.getItem(PREFS_KEY(workspaceId)) || '{}') || {}; } catch (e) { return {}; } },
    setPrefs(p) { try { storage.setItem(PREFS_KEY(workspaceId), JSON.stringify({ ...api.prefs(), ...p })); } catch (e) { /* a convenience only */ } },
  };
  // make the derived cache exist right after load
  try { storage.setItem(TRASHED_CACHE_KEY(workspaceId), JSON.stringify([...trashedIds()])); } catch (e) { /* optional */ }
  return api;
}
