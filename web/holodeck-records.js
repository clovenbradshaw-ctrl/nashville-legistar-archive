// holodeck-records.js — the whole workspace as a relational database whose schema emerges from the data.
// Everything Holodeck already read (sources, statements, names, figures, dates, the reader's cast and
// bonds, tables found inside captured pages) is written as an operator log — INS a record, DEF its values,
// CON its relations — and folded by bare-metal-eo-matrix-app's fold.js, unchanged. No schema is declared
// up front. After the data lands, the schema is read off it: which tables exist, what type each field is,
// which tables link to which and how many-to-how-many, and each of those readings is itself a DEF on the
// same log with the evidence it was read from. State is never stored; it is fold(events).
import { fold, foldFrom } from './vendor/bare-metal/src/fold.js';
import { delimitedTable } from './vendor/eoreader7/native/organs/source.js';

const NS = 'io.holodeck';
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const cut = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const safeType = s => clean(s).replace(/\./g, '').slice(0, 60) || 'Table';

export function buildLog(A, rix, opts = {}) {
  const events = []; let ts = 1; const T0 = Date.UTC(2026, 0, 1);
  const ev = (op, content) => events.push({ type: NS + '.' + op, content, origin_server_ts: T0 + ts, sender: '@holodeck:this-tab', event_id: '$h' + (ts++) });
  const ins = (anchor, type, vals) => { ev('ins', { anchor, entity_type: type, payload: {} }); for (const k in vals) { const v = vals[k]; if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue; ev('def', { anchor, path: k, value: v }); } };
  const con = (a, b, rel) => ev('con', { source_anchor: a, target_anchor: b, relation_type: rel });
  const docA = d => 'src:' + d.id, nameA = n => 'name:' + n;
  const counted = opts.counted || (() => true);
  for (const d of A.docs) {
    ins(docA(d), 'Sources', { title: cut(d.title, 200), kind: d.kind || undefined, medium: d.medium || undefined, standing: d.standing || undefined,
      published: d.published || undefined, year: d.year || undefined, publisher: d.publisher ? cut(d.publisher, 80) : undefined, url: d.url || undefined,
      custody: d.custodyStatus || undefined, kept: counted(d) });
  }
  const names = Object.values(A.names || {});
  for (const n of names) ins(nameA(n.name), 'Names', { name: n.name, type: n.type || undefined, aliases: n.aliases && n.aliases.length ? n.aliases.slice(0, 8) : undefined });
  let nf = 0, nd = 0;
  for (const st of A.sts) {
    if (st.ref) continue; const d = A.docById[st.doc]; if (!d) continue; const a = 'st:' + st.id;
    ins(a, 'Statements', { body: cut(st.text, 600), frame: st.frame || undefined, year: st.year || undefined, claim: !!st.claimy });
    con(a, docA(d), 'in');
    for (const n of st.names) if (A.names[n]) con(a, nameA(n), 'names');
    (st.figs || []).forEach((g, i) => { const v = +(g.value ?? g.val); const fa = 'fig:' + st.id + ':' + i; nf++;
      ins(fa, 'Figures', { label: cut(g.raw || g.text || String(g.value), 80), value: isFinite(v) ? v : undefined, unit: g.label || g.unit || undefined });
      con(fa, a, 'stated in'); });
    (st.dates || []).forEach((g, i) => { const da = 'date:' + st.id + ':' + i; nd++;
      ins(da, 'Dates', { label: cut(g.raw || '', 80), year: g.year || undefined, month: g.month || undefined });
      con(da, a, 'stated in'); });
  }
  // The reader's cast and bonds: the OHS ground reading (`rix`, keyed by ohsId) and the local
  // reading the tab folded itself (`opts.localIx`, keyed by the doc's own id) land as the same
  // Referents and Bonds — so an uploaded source is read, not merely named. An anchor already
  // emitted by one reading is never re-inserted by the other; the pair just links to it.
  const seenRef = new Set(), seenBond = new Set();
  const emitReading = (R, docOf) => {
    if (!R || !Array.isArray(R.cast)) return;
    const bySurf = new Map();
    for (const c of R.cast) { const a = 'ref:' + c.id; const surf = (c.surfaces || [c.id])[0]; bySurf.set(surf, a);
      if (seenRef.has(a)) continue; seenRef.add(a);
      ins(a, 'Referents', { name: cut(surf, 120), standing: c.standing || undefined, mentions: c.mentions || undefined, surfaces: (c.surfaces || []).slice(0, 6), sources: c.srcN || Object.keys(c.src || {}).length });
      const fd = docOf(c.first); if (fd) con(a, docA(fd), 'first read in');
      if (A.names[surf]) con(a, nameA(surf), 'is'); }
    for (const b of R.bonds || []) { const a = 'bond:' + b.a + '|' + b.b; if (seenBond.has(a)) continue; seenBond.add(a);
      const ra = bySurf.get(b.a), rb = bySurf.get(b.b);
      const rel = Object.entries(b.rel || {}).sort((x, y) => y[1] - x[1])[0];
      ins(a, 'Bonds', { label: cut(b.a + ' — ' + b.b, 160), relation: rel ? rel[0] : undefined, witnessed: b.n, sources: b.srcN || Object.keys(b.src || {}).length, negative: b.neg || 0 });
      if (ra) con(a, ra, 'between'); if (rb) con(a, rb, 'between'); }
  };
  if (rix && Array.isArray(rix.cast)) { const bySrc = {}; A.docs.forEach(d => { if (d.ohsId) bySrc[d.ohsId] = d; }); emitReading(rix, s => bySrc[String(s).replace(/\.(txt|json)$/, '')] || A.docById[String(s)] || null); }
  if (opts.localIx && Array.isArray(opts.localIx.cast)) emitReading(opts.localIx, s => A.docById[String(s)] || null);
  const found = tablesInSources(A);
  const nameKey = new Map(names.map(n => [n.name.toLowerCase(), n.name]));
  for (const t of found) {
    const type = safeType(t.name);
    t.rows.forEach((r, i) => { const a = 'row:' + t.key + ':' + i; const vals = {}; t.head.forEach((h, j) => { vals[h] = cut(r.cells[j], 300); });
      ins(a, type, vals); con(a, docA(r.doc), 'found in');
      r.cells.forEach(c => { const n = nameKey.get(clean(c).toLowerCase()); if (n) con(a, nameA(n), 'mentions'); }); });
  }
  filterTupleEvents(ev, opts.filterFrames, opts.savedFolds);
  return { events, found, counts: { figures: nf, dates: nd } };
}

// Filter tuple as operator log: every active filter is INS its frame entity,
// DEF its read frame (value + for-whom giver/question), EVA its coverage result
// (criterion = the for-whom's question, result = matched/total + relevance).
// Order is hard: INS → DEF → EVA, or the fold records missing_ins /
// criterionless_judgment violations. One REC per saved fold: saving a filter as
// a fold is the re-zero — a new frame. No REC per bare filter.
function filterTupleEvents(ev, frames = [], folds = []) {
  for (const fr of frames) {
    const a = 'filter:' + fr.key;
    ev('ins', { anchor: a, entity_type: 'FilterFrames', payload: {} });
    ev('def', { anchor: a, path: 'label', value: cut(fr.label, 160) });
    ev('def', { anchor: a, path: 'filter', value: cut(fr.key, 60) });
    ev('def', { anchor: a, path: 'value', value: cut(fr.value, 300) });
    ev('def', { anchor: a, path: 'giver', value: cut(fr.giver, 120) });
    ev('def', { anchor: a, path: 'question', value: cut(fr.question, 300) });
    ev('def', { anchor: a, path: 'matched', value: fr.matched });
    ev('def', { anchor: a, path: 'total', value: fr.total });
    ev('def', { anchor: a, path: 'relevance', value: fr.relevance });
    ev('eva', { anchor: a, criterion: cut(fr.question, 300), result: fr.matched + '/' + fr.total + ' match, relevance ' + fr.relevance, note: 'for ' + fr.giver } );
  }
  for (const fo of folds) {
    ev('rec', { kind: 'fold', label: cut(fo.label, 160), filters: fo.f || {}, question: cut(fo.q || '', 300), sources: fo.n || 0 });
  }
}

// Tables that already exist inside the material: <table> elements in captured pages, and whole delimited
// files. Two tables with the same header row are the same table, wherever they were found.
export function tablesInSources(A) {
  const groups = new Map(); const P = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  const add = (doc, head, rows, name) => {
    head = head.map((h, j) => clean(h).replace(/\./g, '') || 'Column ' + (j + 1));
    const seen = {}; head = head.map(h => { seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? h + ' ' + seen[h] : h; });
    const key = head.map(h => h.toLowerCase()).join('|');
    let g = groups.get(key); if (!g) { g = { key: 't' + groups.size, head, rows: [], docs: new Set(), names: {} }; groups.set(key, g); }
    rows.forEach(cells => { if (g.rows.length < 3000) g.rows.push({ doc, cells }); }); g.docs.add(doc.id);
    if (name) g.names[name] = (g.names[name] || 0) + 1;
  };
  for (const d of A.docs) {
    if (P && d.html && /<table/i.test(d.html)) {
      let body; try { body = P.parseFromString(d.html, 'text/html'); } catch (e) { continue; }
      body.querySelectorAll('table').forEach(tb => {
        if (tb.querySelector('table')) return;
        const trs = [...tb.querySelectorAll('tr')]; if (trs.length < 3) return;
        const cellsOf = tr => [...tr.children].filter(c => /^T[HD]$/.test(c.tagName)).map(c => c.textContent);
        let hi = trs.findIndex(tr => tr.querySelector('th')); if (hi < 0 || hi > 2) hi = 0;
        const head = cellsOf(trs[hi]); if (head.length < 2 || head.length > 14) return;
        const rows = trs.slice(hi + 1).map(cellsOf).filter(c => c.length === head.length && c.some(x => clean(x)));
        if (rows.length < 2) return;
        const avg = rows.flat().reduce((n, c) => n + clean(c).length, 0) / (rows.length * head.length); if (avg > 220) return;
        let name = clean(tb.querySelector('caption') && tb.querySelector('caption').textContent);
        if (!name) { let el = tb; for (let k = 0; k < 40 && el && !name; k++) { el = el.previousElementSibling || el.parentElement; if (el && /^H[1-6]$/.test(el.tagName)) name = clean(el.textContent); } }
        add(d, head, rows, cut(name, 60));
      });
    } else if (/\.(csv|tsv)$/i.test(d.title || '') || d.format === 'csv') {
      const t = delimitedTable(d.text || ''); if (t && t.head.length >= 2) add(d, t.head, t.rows.filter(r => r.length === t.head.length), cut(d.title, 60));
    }
  }
  return [...groups.values()].filter(g => g.rows.length >= 2).slice(0, 40).map(g => {
    const nm = Object.entries(g.names).sort((a, b) => b[1] - a[1])[0];
    return { ...g, name: 'Table · ' + (nm ? nm[0] : g.head.slice(0, 3).join(', ')), docs: [...g.docs] };
  });
}

// Read the schema off the folded state. Every conclusion carries the count it was drawn from.
const LABELS = ['title', 'name', 'label', 'body'];
export function inferSchema(state) {
  const byType = new Map();
  if (state.entitiesByType) {
    for (const [t, anchors] of Object.entries(state.entitiesByType)) {
      if (!t) continue;
      const rows = [];
      for (const a of anchors) { const e = state.entities[a]; if (e) rows.push(e); }
      if (rows.length) byType.set(t, rows);
    }
  } else {
    for (const e of Object.values(state.entities)) { const t = e._type; if (!t) continue; (byType.get(t) || byType.set(t, []).get(t)).push(e); }
  }
  const tables = [...byType.entries()].sort((a, b) => b[1].length - a[1].length);
  const fields = {}, label = {}, tableInfo = [];
  for (const [t, rows] of tables) {
    const keys = []; const seen = new Set(); rows.forEach(e => { for (const k in e) if (k[0] !== '_' && !seen.has(k)) { seen.add(k); keys.push(k); } });
    const fs = keys.map(k => readField(k, rows));
    const lab = fs.find(f => LABELS.includes(f.name)) || fs.filter(f => f.type === 'text').sort((a, b) => b.distinct - a.distinct)[0] || fs[0];
    const rank = f => f === lab ? 0 : f.type === 'select' ? 1 : f.type === 'date' ? 2 : f.type === 'number' ? 3 : f.type === 'boolean' ? 4 : 5;
    fs.sort((a, b) => rank(a) - rank(b) || keys.indexOf(a.name) - keys.indexOf(b.name));
    fields[t] = fs; label[t] = lab ? lab.name : null; tableInfo.push({ name: t, rows: rows.length });
  }
  const typeOf = a => state.entities[a] && state.entities[a]._type;
  const L = new Map();
  for (const c of state.connections) { const f = typeOf(c.source), to = typeOf(c.target); if (!f || !to) continue; const k = f + '\u0000' + c.type + '\u0000' + to;
    let l = L.get(k); if (!l) L.set(k, l = { from: f, rel: c.type, to, n: 0, out: new Map(), inn: new Map() }); l.n++;
    l.out.set(c.source, (l.out.get(c.source) || 0) + 1); l.inn.set(c.target, (l.inn.get(c.target) || 0) + 1); }
  const links = [...L.values()].map(l => { const mo = Math.max(...l.out.values()), mi = Math.max(...l.inn.values());
    return { from: l.from, rel: l.rel, to: l.to, n: l.n, card: (mi > 1 ? 'many' : 'one') + '-to-' + (mo > 1 ? 'many' : 'one'), sources: l.out.size, targets: l.inn.size }; })
    .sort((a, b) => b.n - a.n);
  return { tables: tableInfo, fields, label, links };
}
function readField(name, rows) {
  const vals = []; for (const e of rows) { const v = e[name]; if (v !== undefined && v !== null && v !== '') vals.push(v); }
  const n = vals.length, cover = rows.length ? n / rows.length : 0;
  const all = p => vals.length > 0 && vals.every(p);
  const freq = new Map(); vals.forEach(v => { const k = Array.isArray(v) ? null : String(v); if (k !== null) freq.set(k, (freq.get(k) || 0) + 1); });
  const distinct = freq.size;
  const numLike = v => typeof v === 'number' || (typeof v === 'string' && /^[\s$€£(-]*\d[\d,]*(\.\d+)?\s*%?\)?$/.test(v.trim()));
  let type = 'text', basis, options = null;
  if (all(v => typeof v === 'boolean')) { type = 'boolean'; basis = 'every value is yes or no'; }
  else if (all(v => typeof v === 'number')) { type = 'number'; basis = 'every value is a number'; }
  else if (all(Array.isArray)) { type = 'multiselect'; const s = new Set(vals.flat()); basis = 'each value is a list · ' + s.size + ' distinct items'; }
  else if (all(v => typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?/.test(v))) { type = 'date'; basis = 'every value is a calendar date'; }
  else if (all(v => typeof v === 'string' && /^https?:\/\//.test(v))) { type = 'url'; basis = 'every value is a web address'; }
  else if (n >= 3 && all(numLike)) { type = 'number'; basis = 'every value reads as a number'; }
  else if (n >= 4 && distinct <= Math.max(2, Math.round(Math.sqrt(n))) && distinct <= 40 && distinct < n) {
    type = 'select'; options = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); basis = distinct + ' values repeat across ' + n.toLocaleString() + ' rows'; }
  else { const avg = vals.reduce((s, v) => s + String(v).length, 0) / (n || 1); if (avg > 140) type = 'longtext';
    basis = distinct.toLocaleString() + ' distinct of ' + n.toLocaleString(); }
  return { name, type, options, distinct, n, cover, basis };
}

export function schemaEvents(schema, after) {
  let ts = after + 1; const T0 = Date.UTC(2026, 0, 1); const out = [];
  const ev = (path, value, basis) => out.push({ type: NS + '.def', content: { anchor: null, path: '_schema.' + path, value, basis, inferred: true }, origin_server_ts: T0 + ts, sender: '@holodeck:schema', event_id: '$s' + (ts++) });
  ev('tables', schema.tables.map(t => t.name), 'types seen on ' + schema.tables.reduce((s, t) => s + t.rows, 0).toLocaleString() + ' records');
  for (const t of schema.tables) {
    ev('fields.' + t.name, schema.fields[t.name].map(f => ({ name: f.name, type: f.type, options: f.options || undefined })), schema.fields[t.name].length + ' fields read off ' + t.rows.toLocaleString() + ' rows');
    if (schema.label[t.name]) ev('label.' + t.name, schema.label[t.name], 'the field that names a record');
  }
  ev('links', schema.links.map(l => ({ from: l.from, rel: l.rel, to: l.to, card: l.card })), schema.links.length + ' relations read off the connections');
  return out;
}

// One call: log → fold → read the schema → append it to the log → fold again.
export function buildDatabase(A, rix, opts) {
  const t0 = Date.now();
  const { events, found, counts } = buildLog(A, rix, opts);
  const state = fold(events);
  const schema = inferSchema(state);
  const sev = schemaEvents(schema, events.length);
  foldFrom(state, sev);
  return { state, schema, events: events.concat(sev), found, counts, ms: Date.now() - t0 };
}
