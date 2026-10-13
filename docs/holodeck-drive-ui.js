// holodeck-drive-ui.js — the DOM for the Drive-style Sources view. A thin client:
// every decision (what is shown, in what order, what a key does, what a menu
// offers, what an undo restores, what a preview may be) comes from the pure
// modules. This file draws, measures its own container, and forwards events.
//
//   mountDrive(root, props) → { update(props), destroy(), api }
//
// `props` is the page's whole contract (see index.html syncDrive):
//   drive          the controller from holodeck-drive-controller.js
//   docs           raw source records (kept AND set aside AND in Trash)
//   counts         { id → { statements, names } }
//   base, isNew, transcribing, notKept   Sets of ids
//   openedAt       { id → first opened (ms) }
//   on             { open, details, rename, keep, readPixels, transcribe,
//                    openOriginal, deleteForever, scope, addSource }
//   getBytes       (id, 'pdf'|'image') → Promise<ArrayBuffer|Uint8Array|null>
//   pdfLib         () → Promise<pdfjs>
//
// Reader-UX rules this file keeps: a click never moves the document (no
// scrollIntoView anywhere on pointer paths); the surface scrolls with the page
// and draws only the rows near the viewport; inputs are native and uncontrolled,
// so nothing is debounced.

import * as V from './holodeck-drive-view.js';
import * as S from './holodeck-drive-select.js';
import * as T from './holodeck-drive-thumb.js';
import * as L from './holodeck-drive-log.js';

const HDV_CSS = `
.hdv{--hdv-gap:12px;font:400 14px/1.4 var(--sans);color:var(--ink);display:flex;flex-direction:column;gap:10px;min-width:0}
.hdv *{box-sizing:border-box}
.hdv button{font:inherit;color:inherit;cursor:pointer}
.hdv-bar{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}
.hdv-tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line2);flex:1 1 auto}
.hdv-tab{all:unset;cursor:pointer;display:flex;gap:6px;align-items:baseline;padding:8px 10px;border-bottom:2px solid transparent;margin-bottom:-1px;color:var(--mut);font:500 14px var(--sans);white-space:nowrap;border-radius:6px 6px 0 0}
.hdv-tab:hover{color:var(--ink)}
.hdv-tab[aria-current=true]{color:var(--ink);border-bottom-color:var(--acc)}
.hdv-tab.hdv-over{background:var(--sel);outline:1px dashed var(--acc)}
.hdv-tab small{font:500 12px var(--mono);color:var(--dim)}
.hdv-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hdv-search{flex:1 1 220px;min-width:140px;background:var(--s2);border:1px solid var(--line2);border-radius:999px;padding:7px 14px;color:var(--ink);font:400 14px var(--sans);outline:none}
.hdv-search:focus{border-color:var(--acc)}
.hdv-btn{background:var(--s1);border:1px solid var(--line2);border-radius:8px;padding:6px 12px;color:var(--ink2);font:500 13px var(--sans);display:inline-flex;gap:6px;align-items:center;min-height:32px}
.hdv-btn:hover{border-color:var(--acc);color:var(--ink)}
.hdv-btn[aria-pressed=true]{background:var(--sel);border-color:var(--acc);color:var(--ink)}
.hdv-btn.hdv-primary{background:var(--acc2);border-color:var(--acc2);color:var(--bg)}
.hdv-seg{display:inline-flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}
.hdv-seg button{border:0;background:transparent;padding:6px 10px;color:var(--mut);display:inline-flex;align-items:center;min-height:32px}
.hdv-seg button[aria-pressed=true]{background:var(--sel);color:var(--ink)}
.hdv-select{background:var(--s1);border:1px solid var(--line2);border-radius:8px;color:var(--ink2);font:500 13px var(--sans);padding:6px 8px;min-height:32px}
.hdv-crumbs{display:flex;flex-wrap:wrap;gap:2px;align-items:center;font:500 15px var(--sans);min-height:32px}
.hdv-crumb{all:unset;cursor:pointer;padding:3px 8px;border-radius:6px;color:var(--ink2)}
.hdv-crumb:hover{background:var(--s2);color:var(--ink)}
.hdv-crumb[aria-current=location]{color:var(--ink);font-weight:600;cursor:default}
.hdv-crumb.hdv-over{background:var(--sel);outline:1px dashed var(--acc)}
.hdv-sep{color:var(--dim)}
.hdv-chips{display:flex;gap:6px;flex-wrap:wrap}
.hdv-chip{background:transparent;border:1px solid var(--line2);border-radius:999px;padding:3px 11px;color:var(--ink2);font:500 13px var(--sans);display:inline-flex;gap:6px;align-items:center}
.hdv-chip:hover{border-color:var(--acc)}
.hdv-chip[aria-pressed=true]{background:var(--sel);border-color:var(--acc);color:var(--ink)}
.hdv-chip small{font:500 11px var(--mono);color:var(--dim)}
.hdv-toolwrap{position:relative}
.hdv-bulk{position:absolute;inset:0;z-index:2;display:flex;gap:8px;align-items:center;flex-wrap:wrap;overflow:hidden;background:var(--sel);border:1px solid var(--line2);border-radius:10px;padding:0 10px}
.hdv-bulk b{font:600 13px var(--sans);margin-right:4px}
.hdv-note{font:400 13px var(--sans);color:var(--mut)}
.hdv-body{position:relative;outline:none;min-width:0}
.hdv-grid{display:grid;gap:var(--hdv-gap)}
.hdv-tile{position:relative;background:var(--s1);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;cursor:default;user-select:none;-webkit-user-select:none}
.hdv-tile:hover{border-color:var(--line2)}
.hdv-tile[aria-selected=true]{border-color:var(--acc);background:var(--sel)}
.hdv-tile:focus-visible,.hdv-row:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.hdv-tile.hdv-over{outline:2px dashed var(--acc);outline-offset:-2px;background:var(--sel)}
.hdv-tile.hdv-drag{opacity:.5}
.hdv-pv{position:relative;aspect-ratio:4/3;background:var(--s2);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--mut)}
.hdv-pv img,.hdv-pv .hdv-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center}
.hdv-pv .hdv-snip{position:absolute;inset:0;padding:10px 12px;font:400 11px/1.45 var(--serif);color:var(--ink2);text-align:left;overflow:hidden;-webkit-mask-image:linear-gradient(#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent);background:var(--bg)}
.hdv-pv svg{width:34%;height:34%;opacity:.8}
.hdv-sec{font:600 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut);padding:6px 2px 6px;line-height:1.4}
.hdv-pv img.hdv-top{object-position:top center}
.hdv-foot{display:flex;gap:8px;align-items:center;padding:8px 8px 8px 10px;min-height:48px}
.hdv-foot svg{flex:none;width:18px;height:18px}
.hdv-name{flex:1;min-width:0;font:500 14px/1.3 var(--sans);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.hdv-sub{font:400 12px var(--sans);color:var(--mut)}
.hdv-more{all:unset;cursor:pointer;flex:none;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--mut);opacity:0}
.hdv-more:hover{background:var(--s2);color:var(--ink)}
.hdv-tile:hover .hdv-more,.hdv-tile:focus-within .hdv-more,.hdv-tile[aria-selected=true] .hdv-more,.hdv-row:hover .hdv-more,.hdv-row:focus-within .hdv-more,.hdv-row[aria-selected=true] .hdv-more{opacity:1}
@media (hover:none){.hdv-more{opacity:1}}
.hdv-check{position:absolute;left:8px;top:8px;width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line2);background:var(--bg);opacity:0;display:flex;align-items:center;justify-content:center;padding:0}
.hdv-tile:hover .hdv-check,.hdv-tile:focus-within .hdv-check,.hdv-tile[aria-selected=true] .hdv-check,.hdv-check[aria-checked=true]{opacity:1}
.hdv-check[aria-checked=true]{background:var(--acc2);border-color:var(--acc2);color:var(--bg)}
.hdv-badge{position:absolute;left:8px;bottom:8px;background:var(--bg);border:1px solid var(--line2);border-radius:999px;padding:1px 8px;font:600 11px var(--sans);color:var(--ink2)}
.hdv-badge[data-k=new]{border-color:var(--ok);color:var(--ok)}
.hdv-badge[data-k=needsRead],.hdv-badge[data-k=transcribing]{border-color:var(--amber);color:var(--amber)}
.hdv-star{position:absolute;right:8px;top:8px;color:var(--amber);width:18px;height:18px}
.hdv-list{display:flex;flex-direction:column}
.hdv-head,.hdv-row{display:grid;align-items:center;column-gap:10px;padding:0 8px;border-bottom:1px solid var(--line)}
.hdv-head{font:600 12px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--mut);min-height:34px;position:sticky;top:0;background:var(--bg);z-index:1}
.hdv-head button{all:unset;cursor:pointer;display:inline-flex;gap:4px;align-items:center}
.hdv-head button:hover{color:var(--ink)}
.hdv-row{min-height:44px;cursor:default;user-select:none;-webkit-user-select:none;position:relative}
.hdv-row:hover{background:var(--s1)}
.hdv-row[aria-selected=true]{background:var(--sel)}
.hdv-row.hdv-over{outline:2px dashed var(--acc);outline-offset:-2px;background:var(--sel)}
.hdv-row.hdv-drag{opacity:.5}
.hdv-cell{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2)}
.hdv-cell.hdv-mono{font:400 13px var(--mono)}
.hdv-cell.hdv-r{text-align:right}
.hdv-namecell{display:flex;gap:10px;align-items:center;min-width:0;color:var(--ink)}
.hdv-namecell svg{flex:none;width:20px;height:20px}
.hdv-namecell .hdv-t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 14px var(--sans)}
.hdv-pill{flex:none;border:1px solid var(--line2);border-radius:999px;padding:0 7px;font:600 11px var(--sans);color:var(--ink2)}
.hdv-pill[data-k=new]{border-color:var(--ok);color:var(--ok)}
.hdv-pill[data-k=needsRead],.hdv-pill[data-k=transcribing]{border-color:var(--amber);color:var(--amber)}
.hdv-empty{border:1px dashed var(--line2);border-radius:12px;padding:28px 18px;text-align:center;color:var(--mut);font:400 14px var(--sans)}
.hdv-rename{font:500 14px var(--sans);color:var(--ink);background:var(--bg);border:1px solid var(--acc);border-radius:6px;padding:2px 6px;width:100%;min-width:0;outline:none}
.hdv-menu{position:fixed;z-index:60;min-width:200px;background:var(--s1);border:1px solid var(--line2);border-radius:10px;padding:6px;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.hdv-menu button{all:unset;display:flex;width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;cursor:pointer;font:500 14px var(--sans);color:var(--ink)}
.hdv-menu button:hover,.hdv-menu button:focus-visible{background:var(--sel2);outline:none}
.hdv-menu button[data-danger=true]{color:var(--bad)}
.hdv-menu hr{border:0;border-top:1px solid var(--line);margin:4px 0}
.hdv-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:70;background:var(--ink);color:var(--bg);border-radius:10px;padding:10px 14px;display:flex;gap:14px;align-items:center;font:500 14px var(--sans);box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:min(560px,calc(100vw - 32px))}
.hdv-toast button{all:unset;cursor:pointer;font:600 14px var(--sans);text-decoration:underline}
.hdv-dlg{position:fixed;inset:0;z-index:65;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.hdv-dlg>div{background:var(--s1);border:1px solid var(--line2);border-radius:14px;padding:18px;width:min(420px,100%);max-height:80vh;overflow:auto;display:flex;flex-direction:column;gap:10px}
.hdv-dlg h3{margin:0;font:600 16px var(--sans)}
.hdv-dlg .hdv-opt{all:unset;cursor:pointer;display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:8px;font:500 14px var(--sans)}
.hdv-dlg .hdv-opt:hover,.hdv-dlg .hdv-opt:focus-visible{background:var(--sel2);outline:none}
.hdv-dlg .hdv-opt[aria-disabled=true]{opacity:.4;cursor:not-allowed}
.hdv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

// minimal, plain line icons (24 viewBox, stroke = currentColor)
const P = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pdf: 'M7 3h7l5 5v13H7zM14 3v5h5M9.5 14h5M9.5 17h5',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3',
  audio: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  note: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  data: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  document: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z',
  more: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  up: 'M7 14l5-5 5 5', down: 'M7 10l5 5 5-5',
};
const svg = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="${name === 'star' && extra === 'fill' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || P.document}"/></svg>`;
const TYPE_COLOR = { pdf: '#e07a6a', image: '#6fb58b', video: '#c78fe0', audio: '#c78fe0', web: '#7aa7ff', note: '#d9b45e', data: '#6fc0c0', document: '#9d9da8', folder: '#9db6e8' };

// each distinct icon string is parsed once; every use after that is a clone
const svgParsed = new Map();
const parsedSvg = str => { let n = svgParsed.get(str); if (!n) { const t = document.createElement('template'); t.innerHTML = str; n = t.content.firstElementChild; svgParsed.set(str, n); } return n; };
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') { if (typeof v === 'string' && v.startsWith('<svg') && v.indexOf('</svg>') === v.length - 6) el.append(parsedSvg(v).cloneNode(true)); else el.innerHTML = v; } else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    if (c.nodeType) el.append(c);
    else if (typeof c === 'string' && c.startsWith('<svg')) el.append(parsedSvg(c).cloneNode(true));
    else el.append(document.createTextNode(String(c)));
  }
  return el;
};
const setKids = (el, ...kids) => el.replaceChildren(...kids.flat().filter(c => c != null && c !== false));

// optional analytic columns: demoted from the cards, still one click away.
// `min` is the narrowest width at which the column's own text still reads
// (a layout fact; the visible set is whatever fits the measured container).
const COLS = [
  { key: 'by', label: 'Added by', min: 130, fr: 1, on: true, get: (e) => e.by },
  { key: 'modified', label: 'Last modified', min: 130, fr: 1, on: true, get: (e, now) => V.whenLabel(e.modifiedAt, now), sort: 'modified', title: 'When it was added to this workspace — not when it was published' },
  { key: 'size', label: 'Size', min: 120, fr: 1, on: true, get: e => V.sizeLabel(e), sort: 'size', r: true },
  { key: 'type', label: 'Type', min: 90, fr: 1, on: false, get: e => e.typeLabel, sort: 'type' },
  { key: 'publisher', label: 'Publisher', min: 140, fr: 1, on: false, get: e => e.publisher || '—', sort: 'publisher' },
  { key: 'standing', label: 'Standing', min: 110, fr: 1, on: false, get: e => e.standing || '—' },
  { key: 'statements', label: 'Statements', min: 110, fr: 1, on: false, get: e => (e.statements ? e.statements.toLocaleString() : '—'), sort: 'statements', r: true, mono: true },
  { key: 'names', label: 'Names', min: 90, fr: 1, on: false, get: e => (e.names ? e.names.toLocaleString() : '—'), r: true, mono: true },
  { key: 'custody', label: 'Custody', min: 130, fr: 1, on: false, get: e => e.custody || '—' },
];

export function mountDrive(root, initial) {
  if (!document.getElementById('hdv-css')) { const st = document.createElement('style'); st.id = 'hdv-css'; st.textContent = HDV_CSS; document.head.appendChild(st); }
  let props = initial, drive = props.drive, unsub = null;
  let loc = { kind: 'folder', folder: null }, sort = { key: 'name', explicit: false }, types = new Set(), query = '';
  let mode = 'grid', cols = new Set(COLS.filter(c => c.on).map(c => c.key)), detailsOn = false;
  let sel = S.emptySel(), menuEl = null, dlgEl = null, toast = null, renaming = null, dragging = null;
  let rowsCache = null, rowsKey = '', entries = [], scrollRaf = 0, lastWin = '', destroyed = false;
  const urls = new Map(), previews = new Map(), pending = new Set();
  let metrics = { rowH: V.DECLARED.DEFAULT_ROW_PX, tileH: 220, folderH: 70, headH: 28, cols: 1, tileW: 200, gap: V.DECLARED.DEFAULT_GAP_PX };
  const queue = T.createQueue(Math.max(1, Math.floor(((navigator.hardwareConcurrency) || 2) / 2)));
  const cache = T.createCache(idbStore());

  const shell = h('div', { class: 'hdv', role: 'region', 'aria-label': 'Sources' });
  const bar = h('div', { class: 'hdv-bar' });
  const tools = h('div', { class: 'hdv-tools' });
  const crumbs = h('div', { class: 'hdv-crumbs', role: 'navigation', 'aria-label': 'Folder path' });
  const chips = h('div', { class: 'hdv-chips', role: 'group', 'aria-label': 'File types' });
  const bulk = h('div', { class: 'hdv-bulk', role: 'toolbar', 'aria-label': 'Selected sources' });
  const toolwrap = h('div', { class: 'hdv-toolwrap' }, tools, bulk);
  const note = h('div', { class: 'hdv-note', role: 'status' });
  const body = h('div', { class: 'hdv-body', tabindex: '-1' });
  const live = h('div', { class: 'hdv-sr', role: 'status', 'aria-live': 'polite' });
  shell.append(bar, toolwrap, crumbs, chips, note, body, live);
  root.replaceChildren(shell);

  const saveP = p => { try { drive.setPrefs(p); } catch (e) { /* convenience only */ } };
  const loadPrefs = () => {
    const p = drive.prefs();
    if (p.mode === 'list' || p.mode === 'grid') mode = p.mode;
    if (p.sort && typeof p.sort.key === 'string') sort = { key: p.sort.key, dir: p.sort.dir, explicit: true };
    if (Array.isArray(p.cols)) cols = new Set(p.cols.filter(k => COLS.some(c => c.key === k)));
    detailsOn = !!p.details;
  };

  // ── data ──
  const buildEntries = () => {
    const ctx = { seen: drive.state.seen, openedAt: props.openedAt || {}, isNew: props.isNew, transcribing: props.transcribing, counts: props.counts || {}, base: props.base, notKept: props.notKept };
    entries = (props.docs || []).map(d => V.entryOf(d, ctx));
    for (const e of entries) e.starred = e.id in drive.state.starred;
  };
  const rows = () => {
    const key = [drive.version, props.rev, loc.kind, loc.folder, sort.key, sort.dir, sort.explicit, [...types].join(','), query, entries.length].join('|');
    if (key === rowsKey && rowsCache) return rowsCache;
    rowsKey = key;
    rowsCache = V.rowsFor({ entries, state: drive.state, location: loc, sort, types, query, universe: entries.map(e => e.id) });
    return rowsCache;
  };
  const byId = () => { const m = new Map(); for (const e of entries) m.set(e.id, e); return m; };

  // ── chrome ──
  const countFor = k => {
    if (k === 'seen') return entries.filter(e => e.notKept && !L.placeOf(drive.state, e.id).trashed).length;
    if (k === 'trash') { const ix = L.indexOf(drive.state, entries.map(e => e.id)); return ix.trashedSources.length + ix.trashTopFolders.length; }
    return 0;
  };
  function renderChrome() {
    const R = rows();
    const tab = (k, label, n, drop) => {
      const on = !query && (k === 'top' ? loc.kind === 'folder' : loc.kind === k);
      const b = h('button', { class: 'hdv-tab', 'aria-current': on ? 'true' : null, 'data-tab': k, onclick: () => go(k === 'top' ? { kind: 'folder', folder: null } : { kind: k }) }, label, n ? h('small', {}, n) : null);
      if (drop) wireDrop(b, drop);
      return b;
    };
    const tabs = h('div', { class: 'hdv-tabs', role: 'navigation', 'aria-label': 'Places' },
      tab('top', V.STR.top, 0, { to: null }), tab('recent', V.STR.recent), tab('starred', V.STR.starred), tab('seen', V.STR.seen, countFor('seen')),
      tab('trash', V.STR.trash, countFor('trash'), { trash: true }));
    const addBtn = props.on && props.on.addSource ? h('button', { class: 'hdv-btn hdv-primary', onclick: () => props.on.addSource() }, svg('plus'), 'Add source') : null;
    setKids(bar, tabs, addBtn);

    const search = h('input', { class: 'hdv-search', type: 'search', placeholder: 'Search sources', 'aria-label': 'Search sources by name, publisher or type', value: query });
    search.addEventListener('input', () => { query = search.value; sel = S.emptySel(); render(); const s2 = tools.querySelector('.hdv-search'); if (s2) { s2.focus({ preventScroll: true }); try { s2.setSelectionRange(query.length, query.length); } catch (e) { /* type=search */ } } });
    const sortSel = h('select', { class: 'hdv-select', 'aria-label': 'Sort by', onchange: e => { const k = e.target.value; sort = { key: k, dir: undefined, explicit: true }; saveP({ sort: { key: k, dir: undefined } }); render(); } },
      V.SORTS.map(s => h('option', { value: s.key, selected: s.key === sort.key ? true : null }, s.label)));
    const dirOf = () => sort.dir || (V.SORTS.find(s => s.key === sort.key) || V.SORTS[0]).dir;
    const dirBtn = h('button', { class: 'hdv-btn', 'aria-label': 'Sort direction: ' + (dirOf() === 'asc' ? 'ascending' : 'descending') + '. Press to reverse.', title: 'Reverse the order', html: svg(dirOf() === 'asc' ? 'up' : 'down'), onclick: () => { sort = { key: sort.key, dir: dirOf() === 'asc' ? 'desc' : 'asc', explicit: true }; saveP({ sort: { key: sort.key, dir: sort.dir } }); render(); } });
    const view = h('div', { class: 'hdv-seg', role: 'group', 'aria-label': 'Layout' },
      h('button', { 'aria-pressed': mode === 'grid' ? 'true' : 'false', 'aria-label': 'Grid', title: 'Grid', html: svg('grid'), onclick: () => setMode('grid') }),
      h('button', { 'aria-pressed': mode === 'list' ? 'true' : 'false', 'aria-label': 'List', title: 'List', html: svg('list'), onclick: () => setMode('list') }));
    const colBtn = mode === 'list' ? h('button', { class: 'hdv-btn', 'aria-haspopup': 'menu', onclick: e => openColumnsMenu(e.currentTarget) }, 'Columns') : null;
    const details = props.on && props.on.details ? h('button', { class: 'hdv-btn', 'aria-pressed': detailsOn ? 'true' : 'false', title: 'Show the selected source’s details beside the list', html: svg('info') + ' Details', onclick: () => { detailsOn = !detailsOn; saveP({ details: detailsOn }); syncDetails(); renderChrome(); } }) : null;
    const newF = loc.kind === 'folder' && !query ? h('button', { class: 'hdv-btn', onclick: () => newFolder() }, svg('folder'), 'New folder') : null;
    setKids(tools, search, sortSel, dirBtn, view, colBtn, details, newF);

    // breadcrumbs: a path you can drop onto
    const parts = [];
    if (query) parts.push(h('span', { class: 'hdv-crumb', 'aria-current': 'location' }, 'Search results'));
    else if (loc.kind === 'folder') {
      const path = L.pathOf(drive.state, loc.folder);
      const seg = (name, id, last) => {
        const b = h('button', { class: 'hdv-crumb', 'aria-current': last ? 'location' : null, onclick: last ? null : () => go({ kind: 'folder', folder: id }) }, name);
        if (!last) wireDrop(b, { to: id });
        return b;
      };
      parts.push(seg(V.STR.top, null, path.length === 0));
      path.forEach((p, i) => { parts.push(h('span', { class: 'hdv-sep', 'aria-hidden': 'true' }, '›')); parts.push(seg(p.name, p.id, i === path.length - 1)); });
    } else parts.push(h('span', { class: 'hdv-crumb', 'aria-current': 'location' }, { recent: V.STR.recent, starred: V.STR.starred, trash: V.STR.trash, seen: V.STR.seen }[loc.kind]));
    crumbs.replaceChildren(...parts);

    chips.replaceChildren(...R.types.map(t => h('button', { class: 'hdv-chip', 'aria-pressed': types.has(t.key) ? 'true' : 'false', onclick: () => { types.has(t.key) ? types.delete(t.key) : types.add(t.key); render(); } }, t.label, h('small', {}, t.n))));
    chips.style.display = R.types.length > 1 ? '' : 'none';

    // bulk bar
    const keys = sel.ids; const nS = keys.filter(k => !S.isFolderKey(k)).length, nF = keys.length - nS;
    bulk.style.display = keys.length ? '' : 'none';
    if (keys.length) {
      const m = V.menuFor({ sel: selEntries(), folderSel: keys.filter(S.isFolderKey).map(S.idOfKey), location: loc.kind === 'trash' ? { kind: 'trash' } : loc });
      const showIds = loc.kind === 'trash' ? ['restore', 'deleteForever'] : ['star', 'move', 'trash'];
      setKids(bulk, h('b', {}, keys.length + ' selected'), m.filter(x => showIds.includes(x.id)).map(x => h('button', { class: 'hdv-btn', 'data-danger': x.danger ? 'true' : null, onclick: () => act(x.id) }, x.label)),
        h('button', { class: 'hdv-btn', onclick: () => { sel = S.clear(sel); render(); } }, 'Clear'));
      void nS; void nF;
    }
    note.textContent = loc.kind === 'trash' ? 'Sources in Trash are left out of every reading until you restore them.' : loc.kind === 'recent' ? 'Newest first: when a source was added or first opened.' : '';
    note.style.display = note.textContent ? '' : 'none';
    if (!drive.saved) { note.textContent = (note.textContent ? note.textContent + ' ' : '') + 'This browser would not save your folders just now — they will be gone when you close the page.'; note.style.display = ''; }
  }

  // ── body ──
  const selEntries = () => { const m = byId(); return sel.ids.filter(k => !S.isFolderKey(k)).map(k => m.get(S.idOfKey(k))).filter(Boolean); };
  const itemKeys = R => [...R.folders.map(f => S.keyOf.folder(f.id)), ...R.items.map(e => S.keyOf.source(e.id))];

  function scrollParentOf(el) {
    for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p; }
    return null;
  }

  // Everything the window arithmetic needs is MEASURED from real nodes of the
  // real width: a probe tile, a probe folder tile, a probe row, a probe label.
  function measure(R) {
    const W = Math.max(1, body.clientWidth || root.clientWidth || 800);
    const probeH = el => { el.style.visibility = 'hidden'; el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0'; body.append(el); const r = el.getBoundingClientRect().height; el.remove(); return r; };
    const lh = probeH(h('div', { class: 'hdv-sec' }, 'Folders'));
    if (mode === 'grid') {
      const gap = parseFloat(getComputedStyle(shell).getPropertyValue('--hdv-gap')) || V.DECLARED.DEFAULT_GAP_PX;
      const g = V.gridMetrics(W, { gap });
      const pt = tileEl({ id: '__probe', title: 'Probe', type: 'document', typeLabel: 'Document', chip: null }, false); pt.style.width = g.tileW + 'px';
      const pf = folderTile({ id: '__probe', name: 'Probe', counts: { subtree: 0 } }, 'f:__probe'); pf.style.width = g.tileW + 'px';
      metrics = { ...metrics, cols: g.cols, tileW: g.tileW, gap, tileH: probeH(pt) + gap, folderH: probeH(pf) + gap, headH: lh };
    } else {
      const probe = h('div', { class: 'hdv-row' }, h('div', { class: 'hdv-cell' }, 'Probe'));
      const rh = probeH(probe);
      metrics = { ...metrics, rowH: Math.max(1, rh || V.DECLARED.DEFAULT_ROW_PX), cols: 1, headH: lh };
    }
    void R;
  }

  function visibleCols() {
    const W = body.clientWidth || 800; const fixed = 40 + 28 + 16; // checkbox + more + gutters
    const want = COLS.filter(c => cols.has(c.key));
    let nameMin = 200, used = nameMin + fixed; const out = [];
    for (const c of want) { if (used + c.min <= W) { out.push(c); used += c.min; } }
    return out;
  }

  const perf = { renders: 0, lastMs: 0, lastPartsMs: {}, window: { ms: 0, built: 0, reused: 0, drawn: 0, phases: {} } };
  function render() {
    if (destroyed) return;
    if (dragging) { dragging.deferred = true; return; }
    const t0 = performance.now();
    buildEntriesIfStale(); const t1 = performance.now();
    const R = rows(); const t2 = performance.now();
    sel = S.prune(sel, itemKeys(R));
    renderChrome(); const t3 = performance.now();
    measure(R); const t4 = performance.now();
    renderWindow(true); const t5 = performance.now();
    syncDetails();
    perf.renders++; perf.lastMs = performance.now() - t0;
    perf.lastPartsMs = { entries: t1 - t0, rows: t2 - t1, chrome: t3 - t2, measure: t4 - t3, window: t5 - t4 };
  }
  let entriesRev = null;
  const buildEntriesIfStale = () => { const k = props.rev + '|' + drive.version; if (k !== entriesRev) { entriesRev = k; buildEntries(); } };

  function blocksOf(R) {
    const per = mode === 'grid' ? metrics.cols : 1;
    const both = R.folders.length > 0 && R.items.length > 0;
    return [
      { id: 'folders', count: R.folders.length, rowH: mode === 'grid' ? metrics.folderH : metrics.rowH, perRow: per, header: R.folders.length && both ? metrics.headH : 0 },
      { id: 'files', count: R.items.length, rowH: mode === 'grid' ? metrics.tileH : metrics.rowH, perRow: per, header: R.items.length && both ? metrics.headH : 0 },
    ];
  }
  function windowNow(R) {
    const keys = itemKeys(R);
    const sp = scrollParentOf(body);
    const bodyTop = body.getBoundingClientRect().top;
    const vpTop = sp ? sp.getBoundingClientRect().top : 0, vpH = sp ? sp.clientHeight : window.innerHeight;
    const scrolled = vpTop - bodyTop; // how far the top of the list is above the viewport (negative: below)
    const wb = V.windowBlocks({ blocks: blocksOf(R), viewportH: vpH, scrollTop: scrolled });
    return { keys, wb, vpH };
  }

  function renderWindow(force) {
    const R = rows();
    const { keys, wb } = windowNow(R);
    const sig = [wb.blocks.map(b => b.w.start + ':' + b.w.end).join('/'), mode, keys.length, rowsKey, metrics.cols, Math.round(metrics.tileW), [...cols].join(','), sel.ids.join(','), sel.focus, renaming, drive.version, props.rev].join('|');
    if (!force && sig === lastWin) return;
    lastWin = sig;
    const tw0 = performance.now(); perf.window.built = 0; perf.window.reused = 0;
    const focusKey = body.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
    const epoch = [props.rev, drive.version, mode, metrics.cols, Math.round(metrics.tileW), [...cols].join(','), rowsKey, visibleCols().map(c => c.key).join('.')].join('|');
    if (epoch !== nodeEpoch) { nodeCache.clear(); nodeEpoch = epoch; }
    const seenNow = new Set();
    body.replaceChildren();
    if (!keys.length) { body.append(h('div', { class: 'hdv-empty' }, emptyText())); return; }
    // one tab stop among what is DRAWN: if the focused item is outside the window, the first drawn one takes it
    const drawnKeys = wb.blocks.flatMap(b => { const l = b.id === 'folders' ? R.folders : R.items; return l.slice(b.w.start, b.w.end).map(it => (b.id === 'folders' ? S.keyOf.folder(it.id) : S.keyOf.source(it.id))); });
    const tabs = S.tabindexOf(drawnKeys, sel.focus);
    const position = new Map(keys.map((k, i) => [k, i]));
    const frag = document.createDocumentFragment();
    const both = R.folders.length > 0 && R.items.length > 0;
    body.setAttribute('aria-multiselectable', 'true'); body.setAttribute('aria-label', 'Sources and folders');
    const drawn = [];
    if (mode === 'grid') {
      body.setAttribute('role', S.ROLES.grid.container); body.removeAttribute('aria-rowcount');
      for (const b of wb.blocks) {
        if (!b.count) continue;
        if (both) frag.append(h('div', { class: 'hdv-sec', role: 'presentation' }, b.id === 'folders' ? 'Folders' : 'Files'));
        const grid = h('div', { class: 'hdv-grid', role: 'presentation', style: `grid-template-columns:repeat(${metrics.cols},minmax(0,1fr));padding-top:${b.w.padTop}px;padding-bottom:${b.w.padBottom}px` });
        const list = b.id === 'folders' ? R.folders : R.items;
        for (let i = b.w.start; i < b.w.end; i++) {
          const it = list[i]; const k = b.id === 'folders' ? S.keyOf.folder(it.id) : S.keyOf.source(it.id);
          const sg = (sel.ids.includes(k) ? 'S' : '-') + tabs[k] + (renaming === k ? 'R' : '-') + position.get(k) + '/' + keys.length;
          const el = reuse(k, sg, () => {
            const n = b.id === 'folders' ? folderTile(it, k) : tileEl(it, true, k);
            n.setAttribute('aria-posinset', String(position.get(k) + 1)); n.setAttribute('aria-setsize', String(keys.length)); return n;
          });
          el.setAttribute('tabindex', String(tabs[k])); seenNow.add(k);
          grid.append(el); if (b.id !== 'folders') drawn.push(it);
        }
        frag.append(grid);
      }
    } else {
      body.setAttribute('role', S.ROLES.list.container); body.setAttribute('aria-rowcount', String(keys.length + 1));
      const vc = visibleCols();
      const tpl = `34px minmax(200px,3fr) ${vc.map(c => `minmax(${c.min - 20}px,${c.fr}fr)`).join(' ')} 28px`;
      frag.append(h('div', { class: 'hdv-head', role: 'row', style: `grid-template-columns:${tpl}` },
        h('div', { role: 'columnheader', 'aria-label': 'Select' }),
        h('div', { role: 'columnheader', 'aria-sort': sortAttr('name') }, h('button', { onclick: () => sortBy('name') }, 'Name', arrow('name'))),
        ...vc.map(c => h('div', { role: 'columnheader', class: c.r ? 'hdv-r' : null, 'aria-sort': c.sort ? sortAttr(c.sort) : null, title: c.title || null }, c.sort ? h('button', { onclick: () => sortBy(c.sort) }, c.label, arrow(c.sort)) : c.label)),
        h('div', { role: 'columnheader', 'aria-label': 'Actions' })));
      const now = Date.now();
      for (const b of wb.blocks) {
        if (!b.count) continue;
        if (both) frag.append(h('div', { class: 'hdv-sec', role: 'presentation' }, b.id === 'folders' ? 'Folders' : 'Files'));
        const list = h('div', { class: 'hdv-list', role: 'rowgroup', style: `padding-top:${b.w.padTop}px;padding-bottom:${b.w.padBottom}px` });
        const items = b.id === 'folders' ? R.folders : R.items;
        for (let i = b.w.start; i < b.w.end; i++) {
          const it = items[i]; const k = b.id === 'folders' ? S.keyOf.folder(it.id) : S.keyOf.source(it.id);
          const sg = (sel.ids.includes(k) ? 'S' : '-') + tabs[k] + (renaming === k ? 'R' : '-') + position.get(k) + '/' + keys.length;
          const el = reuse(k, sg, () => { const n = rowEl(it, b.id === 'folders', k, vc, tpl, now); n.setAttribute('aria-rowindex', String(position.get(k) + 2)); return n; });
          el.setAttribute('tabindex', String(tabs[k])); seenNow.add(k);
          list.append(el); if (b.id !== 'folders') drawn.push(it);
        }
        frag.append(list);
      }
    }
    body.append(frag);
    for (const k of nodeCache.keys()) if (!seenNow.has(k)) nodeCache.delete(k); // bounded by the window
    if (focusKey) { const t = body.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (t) t.focus({ preventScroll: true }); }
    const tw1 = performance.now();
    // previews only for what is drawn now (the window)
    for (const e of drawn) ensurePreview(e);
    perf.window.ms = performance.now() - tw0; perf.window.drawn = drawn.length; perf.window.phases = { build: tw1 - tw0, previews: performance.now() - tw1 };
  }

  // Drawn nodes are reused while nothing about them changed: a scroll step builds
  // only the tiles that just came into the window.
  const nodeCache = new Map(); let nodeEpoch = '';
  const reuse = (key, sg, build) => {
    const hit = nodeCache.get(key);
    if (hit && hit.sg === sg) { perf.window.reused++; return hit.el; }
    const el = build(); nodeCache.set(key, { sg, el }); perf.window.built++; return el;
  };

  const sortAttr = k => (sort.key === k ? ((sort.dir || (V.SORTS.find(s => s.key === k) || {}).dir) === 'asc' ? 'ascending' : 'descending') : 'none');
  const arrow = k => (sort.key === k ? h('span', { 'aria-hidden': 'true' }, (sort.dir || (V.SORTS.find(s => s.key === k) || {}).dir) === 'asc' ? '↑' : '↓') : null);
  const sortBy = k => { const cur = sort.key === k ? (sort.dir || (V.SORTS.find(s => s.key === k) || {}).dir) : null; sort = { key: k, dir: cur ? (cur === 'asc' ? 'desc' : 'asc') : undefined, explicit: true }; saveP({ sort: { key: sort.key, dir: sort.dir } }); render(); };
  const emptyText = () => query ? V.STR.empty.search : loc.kind === 'folder' ? (loc.folder == null ? V.STR.empty.top : V.STR.empty.folder) : V.STR.empty[loc.kind];

  // ── items ──
  function tileEl(e, real, key) {
    const selected = key && sel.ids.includes(key);
    const pv = h('div', { class: 'hdv-pv' });
    fillPreview(pv, e);
    const check = real ? h('button', { class: 'hdv-check', role: 'checkbox', 'aria-checked': selected ? 'true' : 'false', 'aria-label': 'Select ' + e.title, tabindex: '-1', html: selected ? svg('check') : '', onclick: ev => { ev.stopPropagation(); selectKey(key, ev, true); } }) : null;
    const el = h('div', { class: 'hdv-tile', role: S.ROLES.grid.item, 'aria-selected': selected ? 'true' : 'false', 'aria-label': ariaLabel(e), 'data-key': key || null, 'data-id': e.id, draggable: real ? 'true' : null, title: e.title },
      pv, check,
      e.chip ? h('span', { class: 'hdv-badge', 'data-k': e.chip.key }, e.chip.label) : null,
      e.starred ? h('span', { class: 'hdv-star', html: svg('star', 'fill'), 'aria-label': 'Starred' }) : null,
      h('div', { class: 'hdv-foot' }, h('span', { html: svg(e.type), style: 'color:' + TYPE_COLOR[e.type] }), h('span', { class: 'hdv-name' }, renaming === key ? null : e.title),
        real ? h('button', { class: 'hdv-more', 'aria-label': 'More actions for ' + e.title, 'aria-haspopup': 'menu', tabindex: '-1', html: svg('more'), onclick: ev => { ev.stopPropagation(); openMenuFor(key, ev.currentTarget); } }) : null));
    if (real) wireItem(el, key, false);
    if (renaming === key) startInlineRename(el.querySelector('.hdv-name'), e.title, name => props.on.rename && props.on.rename(e.id, name));
    return el;
  }

  function folderTile(f, key) {
    const selected = sel.ids.includes(key);
    const n = f.counts ? f.counts.subtree : 0;
    const el = h('div', { class: 'hdv-tile hdv-folder', role: S.ROLES.grid.item, 'aria-selected': selected ? 'true' : 'false', 'aria-label': 'Folder ' + f.name + ', ' + n + (n === 1 ? ' source' : ' sources'), 'data-key': key, 'data-folder': f.id, draggable: f.inTrash ? null : 'true', title: f.name },
      h('div', { class: 'hdv-foot', style: 'padding:12px 10px' },
        h('span', { html: svg('folder'), style: 'color:' + TYPE_COLOR.folder + ';width:26px;height:26px;display:inline-flex' }),
        h('span', { class: 'hdv-name' }, renaming === key ? null : h('span', {}, f.name, h('span', { class: 'hdv-sub', style: 'display:block' }, n + (n === 1 ? ' source' : ' sources')))),
        h('button', { class: 'hdv-more', 'aria-label': 'More actions for folder ' + f.name, 'aria-haspopup': 'menu', tabindex: '-1', html: svg('more'), onclick: ev => { ev.stopPropagation(); openMenuFor(key, ev.currentTarget); } })),
      h('button', { class: 'hdv-check', role: 'checkbox', 'aria-checked': selected ? 'true' : 'false', 'aria-label': 'Select folder ' + f.name, tabindex: '-1', html: selected ? svg('check') : '', onclick: ev => { ev.stopPropagation(); selectKey(key, ev, true); } }));
    wireItem(el, key, true);
    if (!f.inTrash) wireDrop(el, { to: f.id });
    if (renaming === key) startInlineRename(el.querySelector('.hdv-name'), f.name, name => drive.renameFolder(f.id, name));
    return el;
  }

  function rowEl(item, isFolder, key, vc, tpl, now) {
    const selected = sel.ids.includes(key);
    const e = isFolder ? null : item, f = isFolder ? item : null;
    const title = isFolder ? f.name : e.title;
    const nameCell = h('div', { class: 'hdv-namecell' },
      h('span', { html: svg(isFolder ? 'folder' : e.type), style: 'color:' + TYPE_COLOR[isFolder ? 'folder' : e.type] }),
      renaming === key ? null : h('span', { class: 'hdv-t' }, title),
      !isFolder && e.chip ? h('span', { class: 'hdv-pill', 'data-k': e.chip.key }, e.chip.label) : null,
      !isFolder && e.starred ? h('span', { html: svg('star', 'fill'), style: 'color:var(--amber);width:14px;height:14px;display:inline-flex', 'aria-label': 'Starred' }) : null);
    const cells = vc.map(c => h('div', { role: S.ROLES.list.cell, class: 'hdv-cell' + (c.r ? ' hdv-r' : '') + (c.mono ? ' hdv-mono' : ''), title: null },
      isFolder ? (c.key === 'size' ? (f.counts ? f.counts.subtree + ' sources' : '') : c.key === 'modified' ? V.whenLabel(null, now).replace('Earlier', '—') : c.key === 'by' ? '—' : '') : c.get(e, now)));
    const row = h('div', { class: 'hdv-row', role: S.ROLES.list.row, style: `grid-template-columns:${tpl}`, 'aria-selected': selected ? 'true' : 'false', 'aria-label': isFolder ? 'Folder ' + title : ariaLabel(e), 'data-key': key, 'data-id': isFolder ? null : e.id, 'data-folder': isFolder ? f.id : null, draggable: isFolder && f.inTrash ? null : 'true', title },
      h('div', { role: S.ROLES.list.cell }, h('button', { class: 'hdv-check', style: 'position:static;opacity:1', role: 'checkbox', 'aria-checked': selected ? 'true' : 'false', 'aria-label': 'Select ' + title, tabindex: '-1', html: selected ? svg('check') : '', onclick: ev => { ev.stopPropagation(); selectKey(key, ev, true); } })),
      h('div', { role: S.ROLES.list.cell, style: 'min-width:0' }, nameCell), ...cells,
      h('div', { role: S.ROLES.list.cell }, h('button', { class: 'hdv-more', 'aria-label': 'More actions for ' + title, 'aria-haspopup': 'menu', tabindex: '-1', html: svg('more'), onclick: ev => { ev.stopPropagation(); openMenuFor(key, ev.currentTarget); } })));
    wireItem(row, key, isFolder);
    if (isFolder && !f.inTrash) wireDrop(row, { to: f.id });
    if (renaming === key) startInlineRename(nameCell, title, name => (isFolder ? drive.renameFolder(f.id, name) : props.on.rename && props.on.rename(e.id, name)), true);
    return row;
  }

  const ariaLabel = e => [e.title, e.typeLabel, e.chip ? e.chip.label : null, e.modifiedAt != null ? 'added ' + V.whenLabel(e.modifiedAt, Date.now()) : null, e.starred ? 'starred' : null].filter(Boolean).join(', ');

  // ── previews ──
  function fillPreview(pv, e) {
    const rec = previews.get(e.id);
    pv.replaceChildren();
    if (rec && rec.kind === 'youtube') pv.append(h('div', { class: 'hdv-bg', style: `background-image:url("${rec.url}")`, role: 'img', 'aria-label': 'Video thumbnail' }));
    else if (rec && (rec.kind === 'image' || rec.kind === 'pdf')) pv.append(h('img', { src: urlFor(rec), alt: '', draggable: 'false', class: rec.kind === 'pdf' ? 'hdv-top' : null }));
    else if (rec && rec.kind === 'text') pv.append(h('div', { class: 'hdv-snip', title: 'The first words of the source' }, rec.snippet));
    else { pv.innerHTML = svg(e.type); pv.style.color = TYPE_COLOR[e.type]; if (rec && rec.kind === 'icon') pv.title = 'No preview: ' + rec.reason; }
  }
  const urlFor = rec => { if (!urls.has(rec.key)) urls.set(rec.key, URL.createObjectURL(rec.blob)); return urls.get(rec.key); };

  function ensurePreview(e) {
    if (previews.has(e.id) && previews.get(e.id).forKey === contentTag(e)) return;
    if (pending.has(e.id)) return; pending.add(e.id);
    const bucket = T.bucketOf(metrics.tileW * (window.devicePixelRatio || 1));
    const budget = T.snippetBudget({ w: metrics.tileW - 24, h: metrics.tileW * 0.75 * 0.7, fontPx: 11, lineH: 16 });
    queue.add(async () => {
      try {
        const rec = await T.resolvePreview({
          entry: e, cache, bucket, budget,
          getBytes: kind => (props.getBytes ? props.getBytes(e.id, kind) : Promise.resolve(null)),
          getText: null,
          renderImage: (bytes, b) => renderImage(bytes, b),
          renderPdf: (bytes, b) => renderPdf(bytes, b, props.pdfLib),
        });
        previews.set(e.id, { ...rec, forKey: contentTag(e) });
      } catch (err) { previews.set(e.id, { kind: 'icon', reason: 'it could not be previewed', forKey: contentTag(e) }); }
      pending.delete(e.id);
      if (destroyed) return;
      for (const node of body.querySelectorAll(`[data-id="${CSS.escape(e.id)}"] .hdv-pv`)) fillPreview(node, e);
    });
  }
  const contentTag = e => e.id + ':' + e.chars + ':' + e.sizeBytes + ':' + (e.head || '').length;

  // ── interaction ──
  function wireItem(el, key, isFolder) {
    el.addEventListener('click', ev => { if (ev.target.closest('.hdv-more,.hdv-check,input')) return; selectKey(key, ev, false); });
    el.addEventListener('dblclick', ev => { if (ev.target.closest('.hdv-more,.hdv-check,input')) return; openKey(key); });
    el.addEventListener('contextmenu', ev => { ev.preventDefault(); if (!sel.ids.includes(key)) { sel = S.click(sel, key, itemKeys(rows())); } renderChromeOnly(); openMenuAt(ev.clientX, ev.clientY, el); });
    el.addEventListener('dragstart', ev => {
      if (!sel.ids.includes(key)) { sel = S.click(sel, key, itemKeys(rows())); }
      dragging = { keys: sel.ids.slice(), deferred: false };
      const payload = JSON.stringify({ workspace: drive.workspaceId, keys: dragging.keys });
      ev.dataTransfer.setData('application/x-holodeck-sources', payload);
      ev.dataTransfer.setData('text/plain', dragging.keys.length + ' source' + (dragging.keys.length === 1 ? '' : 's'));
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('hdv-drag');
    });
    el.addEventListener('dragend', () => { el.classList.remove('hdv-drag'); const d = dragging; dragging = null; if (d && d.deferred) render(); });
    void isFolder;
  }

  function wireDrop(el, target) {
    const ok = ev => ev.dataTransfer && [...ev.dataTransfer.types].includes('application/x-holodeck-sources');
    el.addEventListener('dragenter', ev => { if (!ok(ev)) return; ev.preventDefault(); ev.stopPropagation(); });
    el.addEventListener('dragover', ev => { if (!ok(ev)) return; ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = 'move'; el.classList.add('hdv-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('hdv-over'));
    el.addEventListener('drop', ev => {
      if (!ok(ev)) return; ev.preventDefault(); ev.stopPropagation(); el.classList.remove('hdv-over');
      let p; try { p = JSON.parse(ev.dataTransfer.getData('application/x-holodeck-sources')); } catch (e) { return; }
      if (!p || p.workspace !== drive.workspaceId) return;
      dropOn(p.keys, target);
    });
  }

  function dropOn(keys, target) {
    const srcs = keys.filter(k => !S.isFolderKey(k)).map(S.idOfKey), fols = keys.filter(S.isFolderKey).map(S.idOfKey);
    try {
      const n = srcs.length + fols.length;
      if (target.trash) drive.batch('Moved ' + n + (n === 1 ? ' item' : ' items') + ' to Trash', () => { if (srcs.length) drive.trash(srcs); for (const f of fols) drive.trashFolder(f); });
      else {
        const where = target.to == null ? V.STR.top : drive.state.folders[target.to].name;
        // folders first, so a refusal (a folder into itself) leaves the sources alone
        drive.batch('Moved ' + n + (n === 1 ? ' item' : ' items') + ' to ' + where, () => { for (const f of fols) drive.moveFolder(f, target.to); if (srcs.length) drive.place(srcs, target.to); });
      }
    } catch (e) { say(e instanceof L.DriveRefusal ? e.message : 'That move could not be done.'); }
    dragging = null; sel = S.clear(sel); afterChange(true);
  }

  function selectKey(key, ev, fromCheckbox) {
    const order = itemKeys(rows());
    sel = fromCheckbox ? S.check(sel, key, order, { shift: ev.shiftKey }) : S.click(sel, key, order, { shift: ev.shiftKey, meta: ev.metaKey || ev.ctrlKey });
    renderChromeOnly(); renderWindow(true); announce();
  }
  function renderChromeOnly() { renderChrome(); }
  function announce() { live.textContent = sel.ids.length ? sel.ids.length + (sel.ids.length === 1 ? ' item selected' : ' items selected') : 'Selection cleared'; syncDetails(); }

  function openKey(key) {
    if (S.isFolderKey(key)) { const id = S.idOfKey(key); if (loc.kind === 'trash') return; go({ kind: 'folder', folder: id }); return; }
    props.on && props.on.open && props.on.open(S.idOfKey(key));
  }
  function go(l) { loc = l; query = ''; types = new Set(); sel = S.emptySel(); renaming = null; render(); const sp = scrollParentOf(body); void sp; }
  function setMode(m) { mode = m; saveP({ mode: m }); render(); }

  // mirror ONE selected source into the page's own source panel — only when
  // the selected id changes (never on every render: that would loop through the page)
  let mirrored;
  function syncDetails() {
    if (!detailsOn || !props.on || !props.on.details) { mirrored = undefined; return; }
    const one = sel.ids.length === 1 && !S.isFolderKey(sel.ids[0]) ? S.idOfKey(sel.ids[0]) : null;
    if (one === mirrored || (one === null && mirrored === undefined)) return;
    mirrored = one;
    props.on.details(one);
  }

  function newFolder() {
    try {
      const id = drive.createFolder(loc.kind === 'folder' && !query ? 'New folder' : 'New folder', loc.kind === 'folder' ? loc.folder : null);
      toastWith('Created folder “New folder”', true);
      sel = S.click(S.emptySel(), S.keyOf.folder(id), []); renaming = S.keyOf.folder(id);
      afterChange(); sel = { ids: [S.keyOf.folder(id)], anchor: S.keyOf.folder(id), focus: S.keyOf.folder(id) }; render();
    } catch (e) { say(e instanceof L.DriveRefusal ? e.message : 'Could not create the folder.'); }
  }

  function startInlineRename(host, current, commit, inCell) {
    if (!host) return;
    const input = h('input', { class: 'hdv-rename', value: current, 'aria-label': 'Name', spellcheck: 'false' });
    let done = false;
    const finish = save => {
      if (done) return; done = true; renaming = null;
      const v = input.value.trim();
      try { if (save && v && v !== current) commit(v); } catch (e) { say(e instanceof L.DriveRefusal ? e.message : 'Could not rename.'); }
      afterChange();
    };
    input.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); } });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', ev => ev.stopPropagation());
    input.addEventListener('dblclick', ev => ev.stopPropagation());
    input.addEventListener('mousedown', ev => ev.stopPropagation());
    host.replaceChildren(input);
    if (inCell) host.insertBefore(input, host.children[1] || null);
    queueMicrotask(() => { input.focus({ preventScroll: true }); input.select(); });
  }

  // ── menus + actions ──
  function closeMenu(restore) { if (menuEl) { const from = menuEl._from; menuEl.remove(); menuEl = null; if (restore && from && from.isConnected) from.focus({ preventScroll: true }); } }
  function openMenuFor(key, anchor) {
    if (!sel.ids.includes(key)) { sel = S.click(sel, key, itemKeys(rows())); renderChromeOnly(); }
    const r = anchor.getBoundingClientRect(); openMenuAt(r.left, r.bottom, anchor);
  }
  function openMenuAt(x, y, from) {
    closeMenu();
    const keys = sel.ids;
    const m = V.menuFor({ sel: selEntries(), folderSel: keys.filter(S.isFolderKey).map(S.idOfKey), location: loc.kind === 'trash' ? { kind: 'trash' } : loc });
    if (keys.length === 1 && S.isFolderKey(keys[0]) && loc.kind !== 'trash') m.splice(m.findIndex(i => i.id === 'trash'), 0, { id: 'scope', label: 'Read only this folder' });
    if (keys.length === 1 && S.isFolderKey(keys[0]) && loc.kind !== 'trash') { const i = m.findIndex(q => q.id === 'trash'); m.splice(i, 0, { id: 'removeFolder', label: 'Remove folder, keep its sources' }); }
    if (!m.length) return;
    const el = h('div', { class: 'hdv-menu', role: S.ROLES.menu.container, 'aria-label': 'Actions' });
    el._from = from;
    for (const it of m) { if (it.danger && el.children.length) el.append(h('hr', { role: 'separator' })); el.append(h('button', { role: S.ROLES.menu.item, 'data-danger': it.danger ? 'true' : null, onclick: () => { closeMenu(false); act(it.id); } }, it.label)); }
    el.addEventListener('keydown', ev => {
      const items = [...el.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (ev.key === 'Home') { ev.preventDefault(); items[0].focus(); } else if (ev.key === 'End') { ev.preventDefault(); items[items.length - 1].focus(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(true); }
      else if (ev.key === 'Tab') { ev.preventDefault(); closeMenu(true); }
    });
    document.body.append(el); menuEl = el;
    const vw = window.innerWidth, vh = window.innerHeight, r = el.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(x, vw - r.width - 8)) + 'px'; el.style.top = Math.max(8, Math.min(y, vh - r.height - 8)) + 'px';
    el.querySelector('button').focus({ preventScroll: true });
  }
  function openColumnsMenu(anchor) {
    closeMenu();
    const r = anchor.getBoundingClientRect();
    const el = h('div', { class: 'hdv-menu', role: 'menu', 'aria-label': 'Columns' }); el._from = anchor;
    for (const c of COLS) el.append(h('button', { role: 'menuitemcheckbox', 'aria-checked': cols.has(c.key) ? 'true' : 'false', onclick: () => { cols.has(c.key) ? cols.delete(c.key) : cols.add(c.key); saveP({ cols: [...cols] }); closeMenu(false); render(); } }, (cols.has(c.key) ? '✓ ' : '   ') + c.label));
    el.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(true); } });
    document.body.append(el); menuEl = el; el.style.left = Math.min(r.left, window.innerWidth - 220) + 'px'; el.style.top = r.bottom + 4 + 'px';
    el.querySelector('button').focus({ preventScroll: true });
  }

  function act(id) {
    const keys = sel.ids.slice();
    const srcs = keys.filter(k => !S.isFolderKey(k)).map(S.idOfKey), fols = keys.filter(S.isFolderKey).map(S.idOfKey);
    const one = srcs.length === 1 && !fols.length ? srcs[0] : null;
    try {
      switch (id) {
        case 'open': if (keys.length === 1) openKey(keys[0]); return;
        case 'details': if (one && props.on.details) props.on.details(one); return;
        case 'star': { const all = selEntries(); const on = !all.every(e => e.starred); drive.star(srcs, on); break; }
        case 'rename': if (keys.length === 1) { renaming = keys[0]; render(); } return;
        case 'move': openMoveDialog(srcs, fols); return;
        case 'trash': { const n = srcs.length + fols.length; drive.batch('Moved ' + n + (n === 1 ? ' item' : ' items') + ' to Trash', () => { if (srcs.length) drive.trash(srcs); for (const f of fols) drive.trashFolder(f); }); sel = S.emptySel(); break; }
        case 'removeFolder': for (const f of fols) drive.trashFolder(f, { withContents: false }); sel = S.emptySel(); break;
        case 'restore': { const n = srcs.length + fols.length; drive.batch('Restored ' + n + (n === 1 ? ' item' : ' items'), () => { if (srcs.length) drive.restore(srcs); for (const f of fols) drive.restoreFolder(f); }); sel = S.emptySel(); break; }
        case 'deleteForever': confirmDelete(srcs, fols); return;
        case 'keep': if (one && props.on.keep) props.on.keep(one); return;
        case 'readPixels': if (one && props.on.readPixels) props.on.readPixels(one); return;
        case 'transcribe': if (one && props.on.transcribe) props.on.transcribe(one); return;
        case 'openOriginal': if (one && props.on.openOriginal) props.on.openOriginal(one); return;
        case 'scope': if (fols.length === 1 && props.on.scope) props.on.scope(fols[0]); return;
        default: return;
      }
    } catch (e) { say(e instanceof L.DriveRefusal ? e.message : 'That could not be done.'); return; }
    afterChange(true);
  }

  function afterChange(withToast) {
    renaming = null;
    if (withToast && drive.canUndo()) toastWith(drive.undoLabel(), true);
    if (props.on && props.on.changed) props.on.changed();
    render();
  }

  function say(msg) { toastWith(msg, false); }
  function toastWith(msg, undoable) {
    if (toast) toast.remove();
    toast = h('div', { class: 'hdv-toast', role: 'status' }, h('span', {}, msg),
      undoable ? h('button', { onclick: () => doUndo() }, 'Undo') : null,
      h('button', { 'aria-label': 'Dismiss', onclick: () => { toast.remove(); toast = null; } }, '×'));
    document.body.append(toast);
  }
  function doUndo() {
    if (!drive.undo()) return;
    if (toast) { toast.remove(); toast = null; }
    sel = S.emptySel(); if (props.on && props.on.changed) props.on.changed(); render(); live.textContent = 'Undone';
  }

  function dialog(title, content, opts = {}) {
    closeDialog();
    const box = h('div', { role: opts.alert ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h3', {}, title), content);
    dlgEl = h('div', { class: 'hdv-dlg', onclick: ev => { if (ev.target === dlgEl) closeDialog(); } }, box);
    dlgEl.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); closeDialog(); } });
    document.body.append(dlgEl);
    const first = dlgEl.querySelector('button,[tabindex]'); if (first) first.focus({ preventScroll: true });
  }
  function closeDialog() { if (dlgEl) { dlgEl.remove(); dlgEl = null; } }

  function openMoveDialog(srcs, fols) {
    const st = drive.state; const banned = new Set();
    for (const f of fols) { banned.add(f); for (const d of L.descendants(st, f)) banned.add(d); }
    const ix = L.indexOf(st, entries.map(e => e.id));
    const list = h('div', { role: 'listbox', 'aria-label': 'Choose a folder' });
    const add = (id, name, depth) => {
      const disabled = id != null && banned.has(id);
      list.append(h('button', { class: 'hdv-opt', role: 'option', 'aria-disabled': disabled ? 'true' : null, style: 'padding-left:' + (10 + depth * 18) + 'px', onclick: () => {
        if (disabled) return; closeDialog();
        try { const n = srcs.length + fols.length; drive.batch('Moved ' + n + (n === 1 ? ' item' : ' items') + ' to ' + (id == null ? V.STR.top : st.folders[id].name), () => { for (const f of fols) drive.moveFolder(f, id); if (srcs.length) drive.place(srcs, id); }); sel = S.emptySel(); afterChange(true); } catch (e) { say(e instanceof L.DriveRefusal ? e.message : 'That move could not be done.'); }
      } }, svg('folder'), name));
      for (const c of ix.folderKids[id == null ? ix.topKey : id] || []) add(c, st.folders[c].name, depth + 1);
    };
    add(null, V.STR.top, 0);
    dialog('Move to…', h('div', {}, list, h('div', { style: 'display:flex;justify-content:flex-end;margin-top:8px' }, h('button', { class: 'hdv-btn', onclick: closeDialog }, 'Cancel'))));
  }

  function confirmDelete(srcs, fols) {
    const n = srcs.length + fols.length;
    dialog('Delete forever?', h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      h('p', { style: 'margin:0;color:var(--ink2)' }, n === 1 ? 'This removes the source from this workspace for good. It cannot be undone.' : 'This removes ' + n + ' items from this workspace for good. It cannot be undone.'),
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, h('button', { class: 'hdv-btn', onclick: closeDialog }, 'Keep in Trash'),
        h('button', { class: 'hdv-btn', style: 'border-color:var(--bad);color:var(--bad)', onclick: () => { closeDialog(); for (const id of srcs) props.on.deleteForever && props.on.deleteForever(id); sel = S.emptySel(); afterChange(false); } }, 'Delete forever'))), { alert: true });
  }

  // ── keyboard ──
  body.addEventListener('keydown', ev => {
    if (ev.target.matches('input')) return;
    const R = rows(); const keys = itemKeys(R);
    const act1 = S.actionFor(ev, { hasSelection: sel.ids.length > 0, inTrash: loc.kind === 'trash' });
    const nav = S.navigate(keys.indexOf(sel.focus != null ? sel.focus : (document.activeElement && document.activeElement.getAttribute('data-key'))), keys.length, ev.key, { cols: mode === 'grid' ? metrics.cols : 1, page: Math.max(1, Math.floor(window.innerHeight / (mode === 'grid' ? metrics.tileH : metrics.rowH))) });
    if (nav != null && !(ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      const k = keys[nav];
      sel = ev.shiftKey ? S.click({ ...sel, anchor: sel.anchor || keys[0] }, k, keys, { shift: true }) : { ids: [k], anchor: k, focus: k };
      sel.focus = k;
      renderChromeOnly(); renderWindow(true); focusKey(k); announce();
      return;
    }
    if (!act1) return;
    ev.preventDefault();
    switch (act1) {
      case 'selectAll': sel = S.selectAll(keys, sel); renderChromeOnly(); renderWindow(true); announce(); break;
      case 'undo': doUndo(); break;
      case 'clear': sel = S.clear(sel); renderChromeOnly(); renderWindow(true); announce(); break;
      case 'toggle': { const k = sel.focus || keys[0]; if (k) { sel = S.check(sel, k, keys); renderChromeOnly(); renderWindow(true); announce(); } break; }
      case 'open': { const k = sel.focus || sel.ids[0]; if (k) openKey(k); break; }
      case 'menu': { const el = body.querySelector(`[data-key="${CSS.escape(sel.focus || keys[0] || '')}"]`); if (el) { const r = el.getBoundingClientRect(); openMenuAt(r.left + 24, r.top + 24, el); } break; }
      case 'trash': case 'deleteForever': case 'rename': act(act1); break;
      default: break;
    }
  });
  // the page's own keys (Escape closing panels, etc.) must not fire while a menu is open
  document.addEventListener('keydown', ev => { if (menuEl && ev.key === 'Escape') { ev.stopPropagation(); closeMenu(true); } }, true);
  document.addEventListener('mousedown', ev => { if (menuEl && !menuEl.contains(ev.target)) closeMenu(false); }, true);

  function focusKey(k) {
    const el = body.querySelector(`[data-key="${CSS.escape(k)}"]`);
    if (el) { for (const x of body.querySelectorAll('[tabindex="0"]')) x.setAttribute('tabindex', '-1'); el.setAttribute('tabindex', '0'); el.focus({ preventScroll: true }); revealIfOutside(el); return; }
    // not drawn: scroll the page just enough that its row is inside the window, then focus
    const R = rows(); const bl = blocksOf(R); const fi = R.folders.length;
    const i = itemKeys(R).indexOf(k); if (i < 0) return;
    const inFiles = i >= fi, b = inFiles ? bl[1] : bl[0], idx = inFiles ? i - fi : i;
    const off = inFiles ? (bl[0].count ? bl[0].header + Math.ceil(bl[0].count / bl[0].perRow) * bl[0].rowH : 0) + b.header : b.header;
    const top = body.getBoundingClientRect().top + window.scrollY + off + Math.floor(idx / b.perRow) * b.rowH;
    window.scrollTo({ top: top - window.innerHeight / 2 });
    renderWindow(true);
    const el2 = body.querySelector(`[data-key="${CSS.escape(k)}"]`); if (el2) { el2.setAttribute('tabindex', '0'); el2.focus({ preventScroll: true }); }
  }
  function revealIfOutside(el) { // keyboard only: arrow keys bring the focused item into view
    const r = el.getBoundingClientRect();
    if (r.top < 0) window.scrollBy({ top: r.top - 8 }); else if (r.bottom > window.innerHeight) window.scrollBy({ top: r.bottom - window.innerHeight + 8 });
  }
  body.addEventListener('focusin', ev => { const el = ev.target.closest && ev.target.closest('[data-key]'); if (el) sel.focus = el.getAttribute('data-key'); });
  body.addEventListener('click', ev => { if (ev.target === body || ev.target.classList.contains('hdv-grid') || ev.target.classList.contains('hdv-list')) { sel = S.clear(sel); renderChromeOnly(); renderWindow(true); announce(); } });
  body.addEventListener('contextmenu', ev => { if (ev.target === body || ev.target.classList.contains('hdv-grid')) { ev.preventDefault(); } });

  // scroll + resize: draw only the window; never touch the scroll position
  const onScroll = () => { if (scrollRaf) return; scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; if (!destroyed) renderWindow(false); }); };
  const sp0 = () => scrollParentOf(root) || window;
  let spEl = sp0(); spEl.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (destroyed) return; lastWin = ''; measure(rows()); renderWindow(true); }) : null;
  if (ro) ro.observe(body);

  loadPrefs();
  unsub = drive.subscribe(() => { rowsKey = ''; });
  buildEntries(); entriesRev = props.rev + '|' + drive.version;
  render();

  const handle = {
    api: { perf, redraw: () => renderWindow(false), get loc() { return loc; }, get sel() { return sel; }, get mode() { return mode; }, rows, metrics: () => metrics, entries: () => entries, drive: () => drive,
      setLocation: l => go(l), setQuery: q => { query = q; render(); }, setMode, windowStats: () => { const { wb } = windowNow(rows()); return { blocks: wb.blocks.map(b => ({ id: b.id, count: b.count, start: b.w.start, end: b.w.end })), total: wb.total, nodes: body.querySelectorAll('[data-key]').length }; } },
    update(next) {
      if (destroyed) return;
      const swapped = next.drive !== drive;
      props = next;
      if (swapped) { if (unsub) unsub(); drive = next.drive; unsub = drive.subscribe(() => { rowsKey = ''; }); loc = { kind: 'folder', folder: null }; sel = S.emptySel(); previews.clear(); loadPrefs(); }
      rowsKey = ''; entriesRev = null; render();
    },
    destroy() {
      destroyed = true; if (unsub) unsub(); ro && ro.disconnect(); spEl.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll);
      closeMenu(false); closeDialog(); if (toast) toast.remove();
      for (const u of urls.values()) { try { URL.revokeObjectURL(u); } catch (e) { /* gone */ } }
      root.replaceChildren();
    },
  };
  root.__hdv = handle.api; // read-only handle for debugging and the live acceptance run
  return handle;
}

// ── browser-only generators (injected into the pure thumb module) ──────────
async function renderImage(bytes, bucket) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, bucket / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale)), hgt = Math.max(1, Math.round(bmp.height * scale));
  const out = await toBlob(bmp, w, hgt);
  bmp.close && bmp.close();
  return { blob: out, w, h: hgt };
}
async function renderPdf(bytes, bucket, pdfLib) {
  if (!pdfLib) throw new Error('no pdf reader');
  const pdfjs = await pdfLib();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes).slice() }).promise;
  try {
    const page = await doc.getPage(1);
    const v1 = page.getViewport({ scale: 1 }); const scale = bucket / v1.width; const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('empty canvas'))), 'image/webp'));
    return { blob, w: c.width, h: c.height };
  } finally { try { doc.destroy(); } catch (e) { /* closed */ } }
}
async function toBlob(bmp, w, hgt) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, hgt); c.getContext('2d').drawImage(bmp, 0, 0, w, hgt); return c.convertToBlob({ type: 'image/webp' }); }
  const c = document.createElement('canvas'); c.width = w; c.height = hgt; c.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('empty canvas'))), 'image/webp'));
}

// IndexedDB store for the preview cache: its own database, so it never
// collides with the page's `fold-explorer` upgrade path. Failure = memory-only.
function idbStore() {
  if (typeof indexedDB === 'undefined') return null;
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('holodeck-drive-previews', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  return {
    async get(k) { const db = await open(); return new Promise((res, rej) => { const q = db.transaction('p').objectStore('p').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); },
    async put(k, v) { const db = await open(); return new Promise((res, rej) => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  };
}
