// holodeck-drive-log.js — folders, places, stars and Trash for a workspace's sources,
// as a plain APPEND-ONLY log and the state folded from it. Pure: no DOM, no
// storage, no network, no model. The page is a thin client of this module.
//
// WHY A LOG. Folders used to be a flat per-workspace list in localStorage
// (`fold-explorer-folders`) that nothing but this tab could read. A workspace is
// a unit that will be shared (docs/MATRIX-INVITES.md: "a repo is a Holodeck
// workspace", an operator log folded to state, three encrypted stores). So the
// folder structure is written the same way the rest of the workspace is: as
// events in the `io.holodeck.*` namespace with the Matrix event envelope
// ({type, content, origin_server_ts, sender, event_id}), which can be written to
// a store room unchanged, merged by timestamp, and folded by anyone.
//
//   state is never stored; it is fold(events).
//
// Nothing is ever deleted from the log. "Undo" appends the inverse event(s);
// "Delete" is a Trash event with a Restore. The only forgetting is a tombstone
// (`folder.forget`) that undo of a just-made folder appends.
//
// DATA SHAPE (documented in docs/DRIVE-SOURCES.md):
//   event   { type:'io.holodeck.drive.<op>', content:{…}, origin_server_ts, sender, event_id }
//   ops     folder.create {folder,name,parent|null}   folder.rename {folder,name}
//           folder.move {folder,parent|null}          folder.forget {folder}
//           folder.trash {folder,withContents,at?}    folder.restore {folder}
//           source.place {sources[],folder|null}      source.star {sources[],on}
//           source.trash {sources[],at?}              source.restore {sources[]}
//           source.seen {sources[],earlier?}          migrate.legacy {…report}
//
// A source lives in at most one folder (a single parent, like a drive; no
// shortcuts). A source with no place event lives at the top level.

export const NS = 'io.holodeck.drive.';
export const LOG_VERSION = 1;

export class DriveRefusal extends Error {
  constructor(code, message) { super(message); this.name = 'DriveRefusal'; this.code = code; }
}

const dict = () => Object.create(null);
const cp = d => Object.assign(dict(), d);
const arr = x => (Array.isArray(x) ? x : x == null ? [] : [x]);
const str = x => String(x == null ? '' : x);
const nameOf = x => str(x).replace(/\s+/g, ' ').trim();

export function emptyState() {
  return { v: LOG_VERSION, seq: 0, folders: dict(), place: dict(), starred: dict(), trashedAt: dict(), seen: dict(), migrations: [] };
}

// ── folding ────────────────────────────────────────────────────────────────
// A fold is tolerant: an event that would break an invariant (a cycle, an
// unknown folder) is IGNORED, never thrown, so a log written by someone else
// cannot wedge the page. Writers use the strict `plan*` functions below.
function wouldCycle(folders, id, parent) {
  const guard = Object.keys(folders).length + 2;
  let p = parent, n = 0;
  while (p != null && n++ <= guard) { if (p === id) return true; const f = folders[p]; p = f ? f.parent : null; }
  return n > guard;
}

export function applyEvent(state, ev) {
  if (!ev || typeof ev.type !== 'string' || !ev.type.startsWith(NS)) return state;
  const op = ev.type.slice(NS.length), c = ev.content || {}, t = ev.origin_server_ts, by = ev.sender || null;
  const s = { ...state, seq: state.seq + 1 };
  switch (op) {
    case 'folder.create': {
      const id = str(c.folder); if (!id || state.folders[id]) return state;
      const parent = c.parent != null && state.folders[str(c.parent)] ? str(c.parent) : null;
      s.folders = cp(state.folders); s.folders[id] = { id, name: nameOf(c.name) || 'Untitled folder', parent, createdAt: t, createdBy: by, trashed: null };
      return s;
    }
    case 'folder.rename': {
      const f = state.folders[str(c.folder)]; if (!f) return state;
      s.folders = cp(state.folders); s.folders[f.id] = { ...f, name: nameOf(c.name) || f.name }; return s;
    }
    case 'folder.move': {
      const f = state.folders[str(c.folder)]; if (!f) return state;
      const parent = c.parent != null ? str(c.parent) : null;
      if (parent != null && (!state.folders[parent] || wouldCycle(state.folders, f.id, parent))) return state;
      s.folders = cp(state.folders); s.folders[f.id] = { ...f, parent }; return s;
    }
    case 'folder.forget': {
      const id = str(c.folder); if (!state.folders[id]) return state;
      s.folders = cp(state.folders); delete s.folders[id];
      // anything that pointed into it falls back to the top level — the place
      // events stay in the log, the fold just no longer resolves them
      return s;
    }
    case 'folder.trash': {
      const f = state.folders[str(c.folder)]; if (!f || f.trashed) return state;
      s.folders = cp(state.folders); s.folders[f.id] = { ...f, trashed: { at: Number.isFinite(c.at) ? c.at : t, withContents: c.withContents !== false } }; return s;
    }
    case 'folder.restore': {
      const f = state.folders[str(c.folder)]; if (!f || !f.trashed) return state;
      s.folders = cp(state.folders); s.folders[f.id] = { ...f, trashed: null }; return s;
    }
    case 'source.place': {
      const ids = arr(c.sources).map(str).filter(Boolean); if (!ids.length) return state;
      const folder = c.folder != null ? str(c.folder) : null;
      if (folder != null && !state.folders[folder]) return state;
      s.place = cp(state.place); for (const id of ids) { if (folder == null) delete s.place[id]; else s.place[id] = folder; }
      return s;
    }
    case 'source.star': {
      const ids = arr(c.sources).map(str).filter(Boolean); if (!ids.length) return state;
      s.starred = cp(state.starred); for (const id of ids) { if (c.on === false) delete s.starred[id]; else s.starred[id] = Number.isFinite(c.at) ? c.at : t; }
      return s;
    }
    case 'source.trash': {
      const ids = arr(c.sources).map(str).filter(Boolean); if (!ids.length) return state;
      s.trashedAt = cp(state.trashedAt); for (const id of ids) if (s.trashedAt[id] == null) s.trashedAt[id] = Number.isFinite(c.at) ? c.at : t;
      return s;
    }
    case 'source.restore': {
      const ids = arr(c.sources).map(str).filter(Boolean); if (!ids.length) return state;
      s.trashedAt = cp(state.trashedAt); for (const id of ids) delete s.trashedAt[id];
      return s;
    }
    case 'source.seen': {
      const ids = arr(c.sources).map(str).filter(id => id && !(id in state.seen)); if (!ids.length) return state;
      s.seen = cp(state.seen); for (const id of ids) s.seen[id] = c.earlier ? null : t;
      return s;
    }
    case 'migrate.legacy': { s.migrations = [...state.migrations, { at: t, ...c }]; return s; }
    default: return state;
  }
}

export function foldEvents(events) {
  let s = emptyState();
  for (const ev of events || []) s = applyEvent(s, ev);
  return s;
}

// ── resolution: what the user sees ─────────────────────────────────────────
// Dissolved folder: trashed WITHOUT its contents — its children surface at its
// parent. Trashed-with-contents folder: its whole subtree is in Trash with it.
const isDissolved = f => !!(f && f.trashed && !f.trashed.withContents);
const isBinned = f => !!(f && f.trashed && f.trashed.withContents);

// Where a folder id resolves for display: the nearest ancestor-or-self that is
// not dissolved; `binned` is the OUTERMOST trashed-with-contents folder on the
// way up (the Trash item that holds this thing), or null.
export function resolveFolder(state, folderId) {
  const guard = Object.keys(state.folders).length + 2;
  let id = folderId, n = 0, binned = null, display;
  while (id != null && n++ <= guard) {
    const f = state.folders[id]; if (!f) break;
    if (isBinned(f)) binned = id;
    if (display === undefined && !isDissolved(f)) display = id;
    id = f.parent;
  }
  return { folder: display === undefined ? null : display, binned };
}

// The folder a SOURCE shows in, plus whether it is in Trash and which Trash item holds it.
export function placeOf(state, sourceId) {
  const own = state.trashedAt[sourceId];
  const raw = state.place[sourceId];
  if (raw == null || !state.folders[raw]) return { folder: null, trashed: own != null, via: own != null ? 'self' : null, trashedAt: own == null ? null : own };
  const r = resolveFolder(state, raw);
  if (r.binned) return { folder: raw, trashed: true, via: 'folder:' + r.binned, trashedAt: state.folders[r.binned].trashed.at };
  return { folder: r.folder, trashed: own != null, via: own != null ? 'self' : null, trashedAt: own == null ? null : own };
}

export function folderStatus(state, folderId) {
  const f = state.folders[folderId]; if (!f) return { exists: false };
  const guard = Object.keys(state.folders).length + 2;
  let p = f.parent, n = 0, via = null;
  while (p != null && n++ <= guard) { const a = state.folders[p]; if (!a) break; if (isBinned(a)) via = via || p; p = a.parent; }
  if (f.trashed) return { exists: true, trashed: true, topLevel: !via, via: via, at: f.trashed.at, withContents: f.trashed.withContents };
  return { exists: true, trashed: !!via, topLevel: false, via, at: via ? state.folders[via].trashed.at : null };
}

// Visible parent of a (non-trashed) folder: skips dissolved ancestors.
export function visibleParent(state, folderId) {
  const f = state.folders[folderId]; if (!f) return null;
  let p = f.parent; const guard = Object.keys(state.folders).length + 2; let n = 0;
  while (p != null && n++ <= guard) { const a = state.folders[p]; if (!a) return null; if (!isDissolved(a)) return p; p = a.parent; }
  return null;
}

// Index for a universe of source ids: one pass, then O(1) lookups.
export function indexOf(state, universe) {
  const folderKids = dict(), sourceKids = dict(), counts = dict();
  const topKey = '';
  for (const id of Object.keys(state.folders)) {
    const st = folderStatus(state, id);
    if (st.trashed) continue;
    const vp = visibleParent(state, id), k = vp == null ? topKey : vp;
    (folderKids[k] = folderKids[k] || []).push(id);
  }
  for (const k in folderKids) folderKids[k].sort((a, b) => state.folders[a].name.localeCompare(state.folders[b].name, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : 1));
  const trashedSources = [], trashTopFolders = [];
  for (const id of universe) {
    const p = placeOf(state, id);
    if (p.trashed) { if (p.via === 'self') trashedSources.push(id); continue; }
    const k = p.folder == null ? topKey : p.folder;
    (sourceKids[k] = sourceKids[k] || []).push(id);
  }
  for (const id of Object.keys(state.folders)) { const st = folderStatus(state, id); if (st.trashed && st.topLevel) trashTopFolders.push(id); }
  // counts: direct children, and subtree source counts (for tiles)
  const subtree = dict();
  const walk = (fid, depth) => {
    if (fid in subtree) return subtree[fid];
    if (depth > 4096) return 0;
    let n = (sourceKids[fid] || []).length;
    for (const c of folderKids[fid] || []) n += walk(c, depth + 1);
    return (subtree[fid] = n);
  };
  for (const id of Object.keys(state.folders)) walk(id, 0);
  for (const id of Object.keys(state.folders)) counts[id] = { direct: (sourceKids[id] || []).length, subtree: subtree[id] || 0, folders: (folderKids[id] || []).length };
  return { folderKids, sourceKids, counts, trashedSources, trashTopFolders, topKey };
}

export function pathOf(state, folderId) {
  const out = [], seen = new Set(); let id = folderId;
  while (id != null && !seen.has(id)) { seen.add(id); const f = state.folders[id]; if (!f) break; if (!isDissolved(f)) out.unshift({ id: f.id, name: f.name }); id = f.parent; }
  return out;
}

export function descendants(state, folderId) {
  const out = []; const kids = dict();
  for (const id in state.folders) { const p = state.folders[id].parent; if (p != null) (kids[p] = kids[p] || []).push(id); }
  const stack = [...(kids[folderId] || [])]; let n = 0; const lim = Object.keys(state.folders).length + 2;
  while (stack.length && n++ <= lim) { const x = stack.pop(); out.push(x); for (const c of kids[x] || []) stack.push(c); }
  return out;
}

// every source id (of the universe) that is inside the folder, at any depth, not in Trash
export function subtreeSources(state, universe, folderId) {
  const ix = indexOf(state, universe); const out = []; const seen = new Set();
  const go = (fid, d) => { if (seen.has(fid) || d > 4096) return; seen.add(fid); for (const s of ix.sourceKids[fid] || []) out.push(s); for (const c of ix.folderKids[fid] || []) go(c, d + 1); };
  go(folderId, 0); return out;
}

// ── writing: the strict side ───────────────────────────────────────────────
export function makeWriter({ now = () => Date.now(), sender = '@you:this-tab', id = null } = {}) {
  let n = 0;
  const mk = (op, content) => ({ type: NS + op, content, origin_server_ts: now(), sender, event_id: '$drive-' + now().toString(36) + '-' + (n++).toString(36) });
  const newId = id || (() => 'fo-' + now().toString(36) + Math.random().toString(36).slice(2, 6));
  return {
    mk, newId,
    createFolder(state, { name, parent = null, folder = null }) {
      const nm = nameOf(name); if (!nm) throw new DriveRefusal('empty-name', 'A folder needs a name.');
      if (parent != null && !state.folders[parent]) throw new DriveRefusal('no-parent', 'That folder is not here any more.');
      if (parent != null && folderStatus(state, parent).trashed) throw new DriveRefusal('parent-in-trash', 'That folder is in Trash.');
      return [mk('folder.create', { folder: folder || newId(), name: nm.slice(0, 120), parent })];
    },
    renameFolder(state, folder, name) {
      const f = state.folders[folder]; if (!f) throw new DriveRefusal('no-folder', 'That folder is not here any more.');
      const nm = nameOf(name); if (!nm) throw new DriveRefusal('empty-name', 'A folder needs a name.');
      if (nm === f.name) return [];
      return [mk('folder.rename', { folder, name: nm.slice(0, 120) })];
    },
    moveFolder(state, folder, parent) {
      const f = state.folders[folder]; if (!f) throw new DriveRefusal('no-folder', 'That folder is not here any more.');
      if (parent != null && !state.folders[parent]) throw new DriveRefusal('no-parent', 'That folder is not here any more.');
      if (parent === folder || (parent != null && wouldCycle(state.folders, folder, parent))) throw new DriveRefusal('cycle', 'A folder cannot go inside itself.');
      if ((f.parent == null ? null : f.parent) === parent) return [];
      return [mk('folder.move', { folder, parent })];
    },
    trashFolder(state, folder, { withContents = true } = {}) {
      const f = state.folders[folder]; if (!f) throw new DriveRefusal('no-folder', 'That folder is not here any more.');
      if (f.trashed) return [];
      return [mk('folder.trash', { folder, withContents })];
    },
    restoreFolder(state, folder) {
      const f = state.folders[folder]; if (!f || !f.trashed) return [];
      return [mk('folder.restore', { folder })];
    },
    place(state, sources, folder) {
      const ids = [...new Set(arr(sources).map(str).filter(Boolean))];
      if (folder != null && !state.folders[folder]) throw new DriveRefusal('no-folder', 'That folder is not here any more.');
      if (folder != null && folderStatus(state, folder).trashed) throw new DriveRefusal('folder-in-trash', 'That folder is in Trash.');
      const moving = ids.filter(id => (state.place[id] == null ? null : state.place[id]) !== folder);
      if (!moving.length) return [];
      return [mk('source.place', { sources: moving, folder })];
    },
    star(state, sources, on) {
      const ids = [...new Set(arr(sources).map(str).filter(Boolean))].filter(id => (id in state.starred) !== !!on);
      return ids.length ? [mk('source.star', { sources: ids, on: !!on })] : [];
    },
    trash(state, sources) {
      const ids = [...new Set(arr(sources).map(str).filter(Boolean))].filter(id => state.trashedAt[id] == null);
      return ids.length ? [mk('source.trash', { sources: ids })] : [];
    },
    restore(state, sources) {
      const ids = [...new Set(arr(sources).map(str).filter(Boolean))].filter(id => state.trashedAt[id] != null);
      return ids.length ? [mk('source.restore', { sources: ids })] : [];
    },
    // first sight: ids this log has never seen. `earlier` = the log is new, so
    // these were here before we could have seen them arrive (no time is invented).
    observe(state, ids, { earlier = false } = {}) {
      const fresh = [...new Set(arr(ids).map(str).filter(Boolean))].filter(x => !(x in state.seen));
      return fresh.length ? [mk('source.seen', { sources: fresh, ...(earlier ? { earlier: true } : {}) })] : [];
    },
  };
}

// The inverse of an event, computed against the state BEFORE it was applied.
// Returns [] when the event changed nothing. Appending these restores the
// visible state exactly (E4); the original events stay in the log.
export function inverseOf(before, ev, w) {
  const op = ev.type.slice(NS.length), c = ev.content || {};
  switch (op) {
    case 'folder.create': return [w.mk('folder.forget', { folder: c.folder })];
    case 'folder.rename': { const f = before.folders[c.folder]; return f ? [w.mk('folder.rename', { folder: c.folder, name: f.name })] : []; }
    case 'folder.move': { const f = before.folders[c.folder]; return f ? [w.mk('folder.move', { folder: c.folder, parent: f.parent })] : []; }
    case 'folder.trash': return before.folders[c.folder] && !before.folders[c.folder].trashed ? [w.mk('folder.restore', { folder: c.folder })] : [];
    case 'folder.restore': { const f = before.folders[c.folder]; return f && f.trashed ? [w.mk('folder.trash', { folder: c.folder, withContents: f.trashed.withContents, at: f.trashed.at })] : []; }
    case 'source.place': {
      const by = new Map();
      for (const id of arr(c.sources)) { const prev = before.place[id] == null ? null : before.place[id]; if (!by.has(prev)) by.set(prev, []); by.get(prev).push(id); }
      return [...by].map(([folder, sources]) => w.mk('source.place', { sources, folder }));
    }
    case 'source.star': {
      const turnedOn = arr(c.sources).filter(id => c.on !== false && !(id in before.starred));
      const byTime = new Map();
      for (const id of arr(c.sources)) if (c.on === false && id in before.starred) { const at = before.starred[id]; if (!byTime.has(at)) byTime.set(at, []); byTime.get(at).push(id); }
      return [...(turnedOn.length ? [w.mk('source.star', { sources: turnedOn, on: false })] : []), ...[...byTime].map(([at, sources]) => w.mk('source.star', { sources, on: true, at }))];
    }
    case 'source.trash': { const ids = arr(c.sources).filter(id => before.trashedAt[id] == null); return ids.length ? [w.mk('source.restore', { sources: ids })] : []; }
    case 'source.restore': {
      const by = new Map();
      for (const id of arr(c.sources)) { const at = before.trashedAt[id]; if (at == null) continue; if (!by.has(at)) by.set(at, []); by.get(at).push(id); }
      return [...by].map(([at, sources]) => w.mk('source.trash', { sources, at }));
    }
    default: return [];
  }
}

// ── migration: the flat per-workspace list → the log, additively ───────────
// `legacy` is the array stored for ONE workspace under `fold-explorer-folders`:
//   [{ id, name, docs:[sourceId…] }, …]
// The legacy key is never written or deleted by this function (or by anything
// in this module): it stays the pre-migration snapshot, so going back to an
// older page loses nothing. Folders keep their ids. A source listed under two
// legacy folders (the old UI could not do this; a hand-edited store could) is
// placed in the first, and the others are itemised in `residue` — never dropped.
export function migrateLegacy(legacy, { now = () => Date.now(), sender = 'migration', newId = null } = {}) {
  const w = makeWriter({ now, sender, id: newId });
  const list = Array.isArray(legacy) ? legacy.filter(f => f && typeof f === 'object') : [];
  const used = new Set(), events = [], residue = [], idMap = [], placedBy = new Map(); let memberships = 0;
  for (const f of list) {
    let id = str(f.id).trim();
    if (!id || used.has(id)) { const base = id || 'fo-legacy'; let k = 2; id = base + '-' + k; while (used.has(id)) id = base + '-' + (++k); idMap.push({ from: str(f.id), to: id }); }
    used.add(id);
    const nm = nameOf(f.name) || 'Untitled folder';
    events.push(w.mk('folder.create', { folder: id, name: nm, parent: null, legacy: true }));
    const docs = [...new Set(arr(f.docs).map(str).filter(Boolean))];
    const mine = [];
    for (const d of docs) {
      memberships++;
      if (placedBy.has(d)) { const r = residue.find(x => x.source === d) || (residue[residue.push({ source: d, adopted: placedBy.get(d), also: [] }) - 1]); r.also.push(id); continue; }
      placedBy.set(d, id); mine.push(d);
    }
    if (mine.length) events.push(w.mk('source.place', { sources: mine, folder: id }));
  }
  events.push(w.mk('migrate.legacy', { from: 'fold-explorer-folders', folders: used.size, memberships, placed: placedBy.size, residue, renamedIds: idMap }));
  return events;
}

// ── export: the same state as the workspace's record vocabulary ────────────
// holodeck-records.js writes Sources as `ins(anchor, type, vals)` and ties as
// `con(a, b, rel)`. This gives a folder structure the same shape so it can be
// appended to that log (and from there to a `sources` store) without a new
// reader: Folders are INS'd, a folder's parent and a source's place are CON'd.
export function toRecordEvents(state, { sender = '@holodeck:this-tab', t0 = 0 } = {}) {
  const ev = []; let n = 1;
  const push = (op, content) => ev.push({ type: 'io.holodeck.' + op, content, origin_server_ts: t0 + n, sender, event_id: '$dr' + (n++) });
  for (const id of Object.keys(state.folders).sort()) {
    const f = state.folders[id];
    push('ins', { anchor: 'folder:' + id, entity_type: 'Folders', payload: {} });
    push('def', { anchor: 'folder:' + id, field: 'name', value: f.name });
    if (f.trashed) push('def', { anchor: 'folder:' + id, field: 'trashed', value: f.trashed.withContents ? 'with contents' : 'folder only' });
    if (f.parent != null) push('con', { source_anchor: 'folder:' + id, target_anchor: 'folder:' + f.parent, relation_type: 'in folder' });
  }
  for (const id of Object.keys(state.place).sort()) {
    if (!state.folders[state.place[id]]) continue;
    push('con', { source_anchor: 'src:' + id, target_anchor: 'folder:' + state.place[id], relation_type: 'in folder' });
  }
  for (const id of Object.keys(state.starred).sort()) push('def', { anchor: 'src:' + id, field: 'starred', value: true });
  for (const id of Object.keys(state.trashedAt).sort()) push('def', { anchor: 'src:' + id, field: 'trashed', value: true });
  return ev;
}

// ── persistence: a thin pair over any localStorage-shaped object ───────────
export const STORE_KEY = id => 'hd:drive:' + id;

export function loadLog(storage, workspaceId) {
  try {
    const raw = storage.getItem(STORE_KEY(workspaceId)); if (!raw) return { events: [], exists: false };
    const o = JSON.parse(raw);
    if (o && o.v === LOG_VERSION && Array.isArray(o.events)) return { events: o.events, exists: true };
  } catch (e) { /* fall through: an unreadable log is an absent log, reported by the caller */ }
  return { events: [], exists: false, unreadable: true };
}

export function saveLog(storage, workspaceId, events) {
  try { storage.setItem(STORE_KEY(workspaceId), JSON.stringify({ v: LOG_VERSION, events })); return true; } catch (e) { return false; }
}
