// holodeck-drive-view.js — the Drive-style Sources view as a pure model:
// a source record → an entry (type, plain-language chip, when it was ADDED,
// size as honestly as it is known); entries + folder state + a location, a sort,
// type chips and a query → the rows to show; rows + container size → the window
// of rows to draw. No DOM, no storage, no network, no model.
//
// Terrain/analytic vocabulary stays backstage: every string a person can read is
// in STR below, plain words, and a test lints them.

import { indexOf, placeOf, folderStatus, pathOf } from './holodeck-drive-log.js';

// The only constants. Each has its reason; nothing else in this feature is a
// tuned number. (docs/DRIVE-SOURCES-PREREG.md, "Declared constants".)
export const DECLARED = Object.freeze({
  // the 60 Hz display's frame period: the budget one interaction's derivation
  // must fit inside so the page never drops a frame because of it
  FRAME_MS: 1000 / 60,
  // narrowest tile that still holds a two-line 14 px title beside the 28 px action button; the
  // column count is derived from the container width and this floor
  MIN_TILE_PX: 160,
  // a single grid gap / list row height are layout facts of the stylesheet, not
  // tuned: the DOM module reads them back from computed style and passes them in
  // (these defaults are only used by tests that have no stylesheet)
  DEFAULT_GAP_PX: 12, DEFAULT_ROW_PX: 44,
});

export const STR = Object.freeze({
  top: 'My sources', recent: 'Recent', starred: 'Starred', trash: 'Trash', seen: 'Seen, not kept',
  earlier: 'Earlier', unknownSize: '—', you: 'You', workspace: 'This workspace',
  chip: { new: 'New', needsRead: 'Needs read', transcribing: 'Transcribing', notTranscribed: 'Not transcribed', notKept: 'Not kept' },
  type: { pdf: 'PDF', image: 'Image', video: 'Video', audio: 'Audio', web: 'Web page', note: 'Note', data: 'Data', document: 'Document' },
  empty: {
    top: 'No sources here yet. Use Add source to bring one in, or drag a source onto a folder.',
    folder: 'This folder is empty. Drag sources here, or use Move to… on a source.',
    recent: 'Nothing has been added or opened yet.', starred: 'Star a source to keep it close. Starred sources show up here.',
    trash: 'Trash is empty. Sources you move to Trash can be restored from here.', seen: 'Nothing is set aside.',
    search: 'No source matches. Search looks at source names, publishers and types — use Search in the side bar to look inside the text.',
  },
});

// ── file types ─────────────────────────────────────────────────────────────
export function fileTypeOf(d) {
  const t = String(d.type || '').toLowerCase(), f = String(d.format || '').toLowerCase(), m = String(d.medium || '').toLowerCase();
  if (d.media && d.media.kind === 'youtube') return 'video';
  if (t === 'image' || d.hasImg || d.imgSrc) return 'image';
  if (t === 'pdf' || f === 'pdf' || d.pdf || d.pdfSrc) return 'pdf';
  if (m === 'video' || t === 'video' || t === 'youtube video') return 'video';
  if (m === 'audio' || t === 'audio') return 'audio';
  if (d.media && d.media.kind === 'local') return /^audio/.test(String(d.media.mime || '')) ? 'audio' : 'video';
  if (t === 'data' || f === 'csv' || f === 'json') return 'data';
  if (t === 'web page' || t === 'link' || f === 'page' || (f === 'html' && d.url)) return 'web';
  if (t === 'notebook log' || t === 'dropped text' || t === 'transcript' || t === 'note') return 'note';
  return 'document';
}

export function chipOf(e) {
  if (e.isNew) return { key: 'new', label: STR.chip.new };
  if (e.transcribing) return { key: 'transcribing', label: STR.chip.transcribing };
  if (e.needsRead) return { key: 'needsRead', label: STR.chip.needsRead };
  if (e.canTranscribe) return { key: 'notTranscribed', label: STR.chip.notTranscribed };
  if (e.notKept) return { key: 'notKept', label: STR.chip.notKept };
  return null;
}

// A source record + what the page knows about it → one flat entry.
// `ctx`: { seen:{id→time|null}, openedAt:{id→time}, isNew:Set, transcribing:Set,
//          counts:{id→{statements,names}}, base:Set (ids that ship with the workspace),
//          notKept:Set, author:string }
export function entryOf(d, ctx = {}) {
  const id = String(d.id);
  const seenAt = ctx.seen && id in ctx.seen ? ctx.seen[id] : undefined;
  const upd = Number.isFinite(d.updated) ? d.updated : null;
  const addedAt = Number.isFinite(seenAt) ? seenAt : null;
  const modifiedAt = upd != null && addedAt != null ? Math.max(upd, addedAt) : upd != null ? upd : addedAt;
  const chars = typeof d.text === 'string' && d.text.length ? d.text.length : Number.isFinite(d.textLength) ? d.textLength : null;
  const sizeBytes = Number.isFinite(d.bytes) ? d.bytes : Number.isFinite(d.size) ? d.size : null;
  const c = (ctx.counts && ctx.counts[id]) || {};
  const typ = fileTypeOf(d);
  const e = {
    id, title: String(d.title || 'Untitled'), type: typ, typeLabel: STR.type[typ] || STR.type.document,
    publisher: d.publisher ? String(d.publisher) : '', url: d.url ? String(d.url) : '', published: d.published ? String(d.published) : d.year ? String(d.year) : '',
    addedAt, addedKnown: addedAt != null, modifiedAt, openedAt: ctx.openedAt && Number.isFinite(ctx.openedAt[id]) ? ctx.openedAt[id] : null,
    by: ctx.base && ctx.base.has(id) ? STR.workspace : (ctx.author || STR.you),
    sizeBytes, chars, statements: c.statements || 0, names: c.names || 0,
    standing: d.standing ? String(d.standing) : '', kind: d.kind ? String(d.kind) : '', custody: d.custody ? String(d.custody) : '', medium: d.medium ? String(d.medium) : '',
    isNew: !!(ctx.isNew && ctx.isNew.has(id)), needsRead: !!d.needsRead, transcribing: !!(ctx.transcribing && ctx.transcribing.has(id)),
    canTranscribe: !!((typ === 'video' || typ === 'audio') && !d.transcribed), notKept: !!(ctx.notKept && ctx.notKept.has(id)),
    ytId: d.media && d.media.kind === 'youtube' ? String(d.media.id || '') : '',
    // the first words of the source's OWN text — verbatim, for a preview; never composed
    head: typeof d.text === 'string' ? d.text.slice(0, 1200) : '',
    hasPdf: typ === 'pdf', hasImage: typ === 'image',
  };
  e.chip = chipOf(e);
  e.hay = [e.title, e.publisher, e.url, e.typeLabel, e.kind, e.standing].join('\u0001').toLowerCase();
  return e;
}

// ── formatting (deterministic given `now`) ─────────────────────────────────
export function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return STR.unknownSize;
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, n = bytes;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 || n >= 100 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
}
export function sizeLabel(e) {
  if (Number.isFinite(e.sizeBytes)) return humanSize(e.sizeBytes);
  if (Number.isFinite(e.chars)) return e.chars.toLocaleString('en-US') + ' characters';
  return STR.unknownSize;
}
export function whenLabel(t, now = Date.now(), locale = 'en-US') {
  if (!Number.isFinite(t)) return STR.earlier;
  const d = new Date(t), n = new Date(now), day = x => Math.floor((x - new Date(x).getTimezoneOffset() * 60000) / 86400000);
  const diff = day(now) - day(t);
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return 'Today ' + time;
  if (diff === 1) return 'Yesterday';
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── what to show ───────────────────────────────────────────────────────────
// location: { kind: 'folder', folder: id|null } | { kind: 'recent'|'starred'|'trash'|'seen' }
export const SORTS = Object.freeze([
  { key: 'name', label: 'Name', dir: 'asc' }, { key: 'modified', label: 'Last modified', dir: 'desc' },
  { key: 'type', label: 'Type', dir: 'asc' }, { key: 'size', label: 'Size', dir: 'desc' }, { key: 'publisher', label: 'Publisher', dir: 'asc' },
  { key: 'statements', label: 'Statements', dir: 'desc' },
]);
const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const cmpNum = (a, b, dir) => {
  const an = Number.isFinite(a), bn = Number.isFinite(b);
  if (!an && !bn) return 0; if (!an) return 1; if (!bn) return -1; // unknown always last, either direction
  return dir === 'asc' ? a - b : b - a;
};
export function sortEntries(list, sort) {
  const { key = 'name', dir } = sort || {};
  const d = dir || (SORTS.find(s => s.key === key) || SORTS[0]).dir;
  const by = {
    name: (x, y) => (d === 'asc' ? 1 : -1) * coll.compare(x.title, y.title),
    modified: (x, y) => cmpNum(x.modifiedAt, y.modifiedAt, d),
    type: (x, y) => (d === 'asc' ? 1 : -1) * coll.compare(x.typeLabel, y.typeLabel),
    size: (x, y) => cmpNum(Number.isFinite(x.sizeBytes) ? x.sizeBytes : x.chars, Number.isFinite(y.sizeBytes) ? y.sizeBytes : y.chars, d),
    publisher: (x, y) => (!x.publisher && y.publisher ? 1 : x.publisher && !y.publisher ? -1 : (d === 'asc' ? 1 : -1) * coll.compare(x.publisher, y.publisher)),
    statements: (x, y) => cmpNum(x.statements, y.statements, d),
  }[key] || ((x, y) => coll.compare(x.title, y.title));
  return list.slice().sort((x, y) => by(x, y) || coll.compare(x.title, y.title) || (x.id < y.id ? -1 : 1));
}

export function queryTokens(q) { return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
export function matches(e, tokens, extra = '') { return tokens.every(t => e.hay.includes(t) || (extra && extra.includes(t))); }

// The rows for one view. Returns:
//   { folders:[{id,name,counts,starred?}], items:[entry…], total, path:[{id,name}], location,
//     types:[{key,label,n}]   // chips present in the location, with counts BEFORE the type filter
//   }
export function rowsFor({ entries, state, location, sort, types, query, universe }) {
  const byId = new Map(); for (const e of entries) byId.set(e.id, e);
  const ids = universe || entries.map(e => e.id);
  const ix = indexOf(state, ids);
  const tokens = queryTokens(query);
  const loc = location || { kind: 'folder', folder: null };
  let folders = [], pool = [];
  const idsToEntries = a => a.map(id => byId.get(id)).filter(Boolean);
  if (tokens.length) {
    // search spans every place that is not Trash, and is scoped to sources
    const live = entries.filter(e => !placeOf(state, e.id).trashed);
    pool = live.filter(e => {
      const p = placeOf(state, e.id).folder; const fname = p != null && state.folders[p] ? state.folders[p].name.toLowerCase() : '';
      return matches(e, tokens, fname);
    });
    folders = Object.keys(state.folders).filter(id => !folderStatus(state, id).trashed && tokens.every(t => state.folders[id].name.toLowerCase().includes(t))).map(id => ({ id, name: state.folders[id].name, counts: ix.counts[id] }));
  } else if (loc.kind === 'folder') {
    const k = loc.folder == null ? ix.topKey : loc.folder;
    folders = (ix.folderKids[k] || []).map(id => ({ id, name: state.folders[id].name, counts: ix.counts[id] }));
    pool = idsToEntries(ix.sourceKids[k] || []);
  } else if (loc.kind === 'recent') {
    pool = entries.filter(e => !placeOf(state, e.id).trashed && !e.notKept && (Number.isFinite(e.addedAt) || Number.isFinite(e.openedAt)));
    pool = pool.map(e => ({ e, t: Math.max(Number.isFinite(e.addedAt) ? e.addedAt : 0, Number.isFinite(e.openedAt) ? e.openedAt : 0) })).sort((a, b) => b.t - a.t).map(x => x.e);
  } else if (loc.kind === 'starred') {
    pool = entries.filter(e => e.id in state.starred && !placeOf(state, e.id).trashed);
  } else if (loc.kind === 'seen') {
    pool = entries.filter(e => e.notKept && !placeOf(state, e.id).trashed);
  } else if (loc.kind === 'trash') {
    folders = ix.trashTopFolders.map(id => ({ id, name: state.folders[id].name, counts: ix.counts[id], trashedAt: state.folders[id].trashed.at, inTrash: true }));
    pool = idsToEntries(ix.trashedSources);
  }
  const typeCount = new Map(); for (const e of pool) typeCount.set(e.type, (typeCount.get(e.type) || 0) + 1);
  const chips = [...typeCount].map(([key, n]) => ({ key, label: STR.type[key], n })).sort((a, b) => coll.compare(a.label, b.label));
  let items = pool;
  if (types && types.size) items = items.filter(e => types.has(e.type));
  // 'recent' is ordered by recency unless the person picked a sort
  const sorted = loc.kind === 'recent' && !tokens.length && !(sort && sort.explicit) ? items : sortEntries(items, sort);
  return { folders, items: sorted, total: sorted.length + folders.length, path: loc.kind === 'folder' && loc.folder != null ? pathOf(state, loc.folder) : [], location: loc, types: chips, index: ix };
}

// ── the window ─────────────────────────────────────────────────────────────
// Rows (a list row, or a row of grid tiles) are fixed-height, so the window is
// arithmetic: no measuring of hidden nodes, cost independent of the total.
export function gridMetrics(containerW, { minTile = DECLARED.MIN_TILE_PX, gap = DECLARED.DEFAULT_GAP_PX } = {}) {
  const w = Math.max(1, Math.floor(containerW));
  const cols = Math.max(1, Math.floor((w + gap) / (minTile + gap)));
  const tileW = (w - gap * (cols - 1)) / cols;
  return { cols, tileW, gap };
}

export function windowOf({ count, rowH, viewportH, scrollTop, perRow = 1, overscan }) {
  const rows = Math.ceil(count / perRow);
  const vis = Math.max(1, Math.ceil(viewportH / rowH));
  const over = overscan == null ? vis : overscan; // one page each side: derived, not tuned
  const first = Math.floor(scrollTop / rowH); // negative when this block starts below the viewport's top
  const r0 = Math.min(rows, Math.max(0, first - over));
  const r1 = Math.min(rows, Math.max(r0, first + vis + over));
  return { rows, r0, r1, start: Math.min(count, r0 * perRow), end: Math.min(count, r1 * perRow), padTop: r0 * rowH, padBottom: Math.max(0, (rows - r1) * rowH), total: rows * rowH };
}

// Several stacked blocks (folders, then files), each with its own row height and
// an optional header. One call, each block windowed against the same viewport.
// Cost is bounded by the viewport, never by the number of items.
export function windowBlocks({ blocks, viewportH, scrollTop }) {
  let top = 0; const out = [];
  for (const b of blocks) {
    if (!b.count) { out.push({ ...b, w: windowOf({ count: 0, rowH: b.rowH, viewportH, scrollTop: 0, perRow: b.perRow }), top, header: 0 }); continue; }
    const header = b.header || 0;
    const w = windowOf({ count: b.count, rowH: b.rowH, viewportH, scrollTop: scrollTop - top - header, perRow: b.perRow });
    out.push({ ...b, w, top, header });
    top += header + w.total;
  }
  return { blocks: out, total: top };
}

// ── menus (the model; the DOM module draws it) ─────────────────────────────
// `sel`: array of entries (sources) and `folderSel`: array of folder ids.
export function menuFor({ sel = [], folderSel = [], location = { kind: 'folder', folder: null }, canRename = true }) {
  const n = sel.length, f = folderSel.length;
  const inTrash = location.kind === 'trash';
  const m = [];
  if (inTrash) {
    m.push({ id: 'restore', label: 'Restore' });
    m.push({ id: 'deleteForever', label: 'Delete forever…', danger: true });
    return m;
  }
  if (n + f === 1) m.push({ id: 'open', label: f ? 'Open folder' : 'Open' });
  if (n === 1 && !f) m.push({ id: 'details', label: 'Details' });
  if (n && !f) m.push({ id: 'star', label: sel.every(e => e.starred) ? 'Remove star' : 'Star' });
  if (n + f === 1 && canRename) m.push({ id: 'rename', label: 'Rename' });
  if (n) m.push({ id: 'move', label: 'Move to…' });
  if (n === 1 && !f) {
    const e = sel[0];
    if (e.notKept) m.push({ id: 'keep', label: 'Keep as a source' });
    if (e.needsRead || e.type === 'pdf' || e.type === 'image') m.push({ id: 'readPixels', label: 'Read the pixels' });
    if (e.canTranscribe) m.push({ id: 'transcribe', label: 'Transcribe' });
    if (e.url) m.push({ id: 'openOriginal', label: 'Open original ↗' });
  }
  m.push({ id: 'trash', label: n + f > 1 ? 'Move ' + (n + f) + ' to Trash' : 'Move to Trash', danger: true });
  return m;
}

// every string a person can read that this model can emit — the lint's input
export function visibleStrings() {
  const out = [];
  const walk = o => { for (const v of Object.values(o)) typeof v === 'string' ? out.push(v) : walk(v); };
  walk(STR); SORTS.forEach(s => out.push(s.label));
  const probe = { id: 'x', title: 't', type: 'pdf', typeLabel: 'PDF', canTranscribe: true, needsRead: true, notKept: true, url: 'u' };
  for (const loc of [{ kind: 'folder' }, { kind: 'trash' }]) for (const m of menuFor({ sel: [probe], location: loc })) out.push(m.label);
  for (const m of menuFor({ sel: [probe, probe], folderSel: ['a'] })) out.push(m.label);
  return out;
}
