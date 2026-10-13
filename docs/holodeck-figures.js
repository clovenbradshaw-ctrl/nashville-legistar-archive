// holodeck-figures.js — ingest a document's text as SECTIONED, KEYED, NESTED JSON.
//
// Alhazen's discipline: a reading is a hypothesis. Each figure is a KEY (the
// label the document gives) and a VALUE (typed: amount / date / percent / text),
// with the byte span it came from. Keys are gathered under the SECTION that holds
// them, and a total/contract-value key NESTS the component amounts that follow it
// (base, change orders, previous amounts) — the way a ledger reads.
//
// The shape is stable so it can be written once per document and read back:
//
//   { assertion,
//     sections: [ { heading, level,
//       keys: [ { key, value, kind, desc, evidence:{s,e}, children:[ … ] } ] } ],
//     counts, hasRows }

const FIGURE = /\$\s?\d[\d,\s]*(?:\.\d{1,2})?(?:\s*(?:million|billion|thousand|[MBK]\b))?/i;
const DATE = /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i;
const PERCENT = /\b\d{1,3}(?:\.\d+)?\s?%/;

const num = raw => {
  const s = String(raw).toLowerCase();
  const n = Number(s.replace(/[^0-9.]/g, '')); if (!isFinite(n)) return NaN;
  if (/million/.test(s) || /m\s*$/.test(s)) return n * 1e6;
  if (/billion/.test(s) || /b\s*$/.test(s)) return n * 1e9;
  if (/thousand/.test(s) || /k\s*$/.test(s)) return n * 1e3;
  return n;
};

const cleanKey = k => String(k)
  .replace(/^\s*(?:\d+(?:\.\d+)*|[ivx]+\.|[a-z]\))\s*/i, '')
  .replace(/[\s:=\-–—|]+$/, '')
  .replace(/\b(?:is|was|of|the|a|an|to|be|shall|will|are|were|at|in|on|for|by)$/i, '')
  .replace(/^\W+/, '').replace(/\s{2,}/g, ' ').trim().slice(0, 60);

// A line that opens a section. `model` (optional) is the trained structure: a
// Map of normalized section name → learned level. A line matching a learned
// section takes that level; otherwise the shape decides.
function headingOf(line, model) {
  const s = line.trim();
  if (!s || s.length > 66) return null;
  if (FIGURE.test(s) || DATE.test(s)) return null;
  if (/[:=|\t]\s*\S/.test(s)) return null;
  const nn = s.toLowerCase().replace(/^\d{1,3}(?:\.\d+){0,3}\.?\s*/, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (model && nn && model.has(nn)) return { heading: s.replace(/\s{2,}/g, ' ').trim(), level: model.get(nn) || 2 };
  if (/^(?:ARTICLE|SECTION|APPENDIX|EXHIBIT|SCHEDULE)\b/i.test(s)) return { heading: s.replace(/\s{2,}/g, ' ').trim(), level: 1 };
  if (/^[A-Z0-9][A-Z0-9 .,'&()\/#-]+$/.test(s) && (s.match(/[A-Z]{2,}/g) || []).length >= 1 && !/\b(?:the|and|of)\b/i.test(s)) return { heading: s.replace(/\s{2,}/g, ' ').trim(), level: 1 };
  const m = /^(\d+(?:\.\d+)*|[IVX]+\.|[a-z]\)|[A-Z])\.?\s+([A-Z][^.!?]{2,50})$/.exec(s);
  if (m && s.split(/\s+/).length <= 9 && !/\b(?:is|was|shall|will|are|were)\b/i.test(s)) return { heading: s.replace(/\s{2,}/g, ' ').trim(), level: Math.min(3, m[1].split('.').length + 1) };
  if (s.split(/\s+/).length <= 6 && /^[A-Z][a-z]/.test(s) && !/[.!?,]$/.test(s) && !/\b(?:is|was|are|were|shall|will)\b/i.test(s)) return { heading: s, level: 3 };
  return null;
}

const describe = r => r.kind === 'amount' ? 'The ' + (r.key ? r.key.toLowerCase() : 'figure') + ' is ' + r.value + '.'
  : r.kind === 'date' ? (r.key ? r.key + ' — ' + r.value + '.' : 'Dated ' + r.value + '.')
  : r.kind === 'percent' ? 'A rate: ' + (r.key ? r.key.toLowerCase() + ' at ' : '') + r.value + '.'
  : r.key + ': ' + r.value + '.';

// The verbatim bytes around a span, so a row can show the source it came from.
const snipOf = (t, s, e, pad = 48) => { const a = Math.max(0, s - pad), b = Math.min(t.length, e + pad); return (a > 0 ? '…' : '') + t.slice(a, b).replace(/\s+/g, ' ').trim() + (b < t.length ? '…' : ''); };

const isParent = r => r.kind === 'amount' && /\btotal\b|contract\s+(?:value|amount|price)|estimated\s+(?:contract\s+)?value|original\s+(?:amount|amt)|revised|corrected\s+total|new\s+total/i.test(r.key);

export function figureTable(text, opts = {}) {
  const model = opts.structure ? new Map(opts.structure.sections.map(s => [s.name, s.level])) : (opts.lexicon || null);
  // OCR merges headings into body lines ("…DSA will 15. Compensation/Payment
  // 15.1 Time & Materials…"). Split a numbered heading back onto its own line so
  // sections can be told apart.
  const t = String(text || '')
    .replace(/([^\n])\s+(\d{1,2}(?:\.\d+){0,3})\.\s+(?=[A-Z])/g, '$1\n$2. ')
    .replace(/([^\n])\s+((?:ARTICLE|SECTION|EXHIBIT|SCHEDULE|APPENDIX)\s+[A-Z0-9])/g, '$1\n$2');
  const lines = t.split(/\r?\n/);
  const sections = [];
  let cur = { heading: '', level: 4, keys: [], blocks: [], text: '', s: 0 };
  sections.push(cur);
  let off = 0; const seen = new Set();

  const add = (key, value, kind, raw, s, e, depth) => {
    key = cleanKey(key); if (!key || key.length < 2 || /^\W*$/.test(key)) return;
    const sig = key.toLowerCase() + '|' + String(value).toLowerCase();
    if (seen.has(sig)) return; seen.add(sig);
    const row = { type: 'field', key, value, kind, depth: depth || 0, desc: '', evidence: { s, e }, snip: snipOf(t, s, e), children: [] };
    row.desc = describe(row);
    if (isParent(row)) cur.keys.push(row);
    else {
      const last = cur.keys[cur.keys.length - 1];
      if (last && isParent(last) && kind === 'amount') last.children.push(row);
      else cur.keys.push(row);
    }
    cur.blocks.push(row);
  };
  const para = (text, s, e, depth) => { const tx = text.trim(); if (tx.length < 2) return; cur.blocks.push({ type: 'para', text: tx.slice(0, 600), depth: depth || 0, evidence: { s, e } }); };

  // Join wrapped lines into real paragraphs (dehyphenated), so passages are
  // coherent, not one fragment per line.
  let pbuf = [], pstart = 0, pdepth = 0;
  const flushPara = () => {
    if (!pbuf.length) return;
    const text = pbuf.join(' ').replace(/(\w)-\s+(\w)/g, '$1$2').replace(/\s{2,}/g, ' ').trim();
    if (text.length >= 2) cur.blocks.push({ type: 'para', text: text.slice(0, 1600), depth: pdepth, evidence: { s: pstart, e: pstart + text.length } });
    pbuf = [];
  };

  // A table is a run of aligned-column lines (2+ columns split on 2+ spaces or a
  // tab, carrying data). A lone such line is not a table — it falls back to prose.
  let pend = null;
  const flushPend = () => {
    if (!pend) return;
    if (pend.rows.length >= 2) cur.blocks.push({ type: 'table', rows: pend.rows, cols: Math.max(...pend.rows.map(r => r.length)), evidence: { s: pend.s, e: pend.e } });
    else pend.lines.forEach(([ln, ls]) => para(ln, ls, ls + ln.length, 0));
    pend = null;
  };

  for (const line of lines) {
    const ls = off; off += line.length + 1;
    const trimmed = line.trim(); if (!trimmed) continue;
    cur.text = (cur.text || '') + line + '\n';
    const indent = line.length - line.trimStart().length; const depth = Math.min(4, Math.floor(indent / 3));
    const cells = trimmed.split(/\s{2,}|\t+/).filter(x => x.length);
    const short = cells.every(c => c.length <= 44);
    const datum = cells.some(c => /^[\s$€£]*-?\d[\d,.%$€£\/-]*\s*$/.test(c.trim()) || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(c.trim()));
    const tabular = cells.length >= 2 && cells.length <= 12 && short && datum && trimmed.length > 8 && trimmed.length < 170 && !/[:=]\s*\S/.test(trimmed);
    if (tabular) { flushPara(); if (!pend) pend = { rows: [], lines: [], s: ls }; pend.rows.push(cells); pend.lines.push([trimmed, ls]); pend.e = ls + line.length; continue; }
    if (pend) flushPend();
    const h = headingOf(line, model);
    if (h) { flushPara(); cur = { heading: h.heading, level: h.level, keys: [], blocks: [], text: '', s: ls }; sections.push(cur); continue; }
    const kv = /^([^:=$|\t]{2,60}?)\s*(?::|=|\t|\||\.{3,}|·)\s*(.{1,90})$/.exec(trimmed);
    if (kv) { flushPara();
      const val = kv[2];
      const fm = FIGURE.exec(val), dm = DATE.exec(val), pm = PERCENT.exec(val);
      if (fm) add(kv[1], fm[0].trim(), 'amount', fm[0].trim(), ls + line.indexOf(fm[0]), ls + line.indexOf(fm[0]) + fm[0].length, depth);
      else if (dm) add(kv[1], dm[0].trim(), 'date', dm[0].trim(), ls + line.indexOf(dm[0]), ls + line.indexOf(dm[0]) + dm[0].length, depth);
      else if (pm) add(kv[1], pm[0].trim(), 'percent', pm[0].trim(), ls + line.indexOf(pm[0]), ls + line.indexOf(pm[0]) + pm[0].length, depth);
      else if (val.trim()) add(kv[1], val.trim().slice(0, 60), 'text', val.trim().slice(0, 60), ls + line.indexOf(val), ls + line.indexOf(val) + val.length, depth);
      continue;
    }
    const fig = FIGURE.exec(trimmed);
    if (fig) {
      flushPara();
      const at = line.indexOf(fig[0]);
      const key = line.slice(0, at).trim().split(/\s+/).slice(-6).join(' ').replace(/^.*[.!?]\s+/, '');
      add(key, fig[0].trim(), 'amount', fig[0].trim(), ls + at, ls + at + fig[0].length, depth);
      continue;
    }
    const dm = DATE.exec(trimmed);
    if (dm && /date|effective|expir|term|through|begin|end|awarded|sent/i.test(trimmed)) {
      flushPara();
      const at = line.indexOf(dm[0]);
      add(line.slice(0, at), dm[0].trim(), 'date', dm[0].trim(), ls + at, ls + at + dm[0].length, depth);
      continue;
    }
    if (!pbuf.length) { pstart = ls; pdepth = depth; }
    pbuf.push(trimmed);
  }
  flushPara();
  flushPend();

  const kept = sections.filter(s => s.keys.length || s.blocks.length);
  // byte spans: a section runs from its heading to the next section's heading
  kept.forEach((s, i) => { s.e = i + 1 < kept.length ? kept[i + 1].s : t.length; });
  // the section tree, nested by learned level
  const tree = []; { const stack = []; for (const s of kept) { const node = { title: s.heading, level: s.level, s: s.s, e: s.e, blocks: (s.blocks || []).length, children: [] }; while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop(); (stack.length ? stack[stack.length - 1].children : tree).push(node); stack.push(node); } }
  const counts = {}; kept.forEach(s => s.keys.forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1; r.children.forEach(c => { counts[c.kind] = (counts[c.kind] || 0) + 1; }); }));
  const heads = kept.map(s => s.heading).join(' ').toLowerCase(); const keys = kept.map(s => s.keys.map(k => k.key.toLowerCase()).join(' ')).join(' ');
  let assertion = 'Figures this document names.';
  if (/\btotal\b/.test(keys) && /\bchange[-\s]?order\b|\boriginal\b|\brevised\b|\bcorrected\b|\bamendment\b/.test(keys + heads)) assertion = 'A change-order / amendment ledger: original and revised contract amounts.';
  else if (/\btotal\b/.test(keys)) assertion = 'A schedule of contract amounts, with the totals named.';
  else if (/\brate\b|\bunit price\b|\bhourly\b|\bmonthly\b/.test(keys)) assertion = 'A rate card: unit prices and rates.';
  else if ((counts.date || 0) > (counts.amount || 0)) assertion = 'A set of dates and terms.';
  else if ((counts.amount || 0) > 0) assertion = 'A table of amounts named in the document.';

  const all = kept.flatMap(s => s.keys.flatMap(k => [k, ...k.children]));
  const amts = all.filter(r => r.kind === 'amount').map(r => num(r.value)).filter(isFinite);
  // A disclosed best guess at the document's format (refined by induction across
  // the corpus in tools/induct-figures.mjs — there will be repeats).
  let format = 'mixed layout';
  if (/amendment|change order/.test(heads)) format = 'change-order / amendment';
  else if (/compensation|payment methodology/.test(heads)) format = 'clause contract (compensation schedule)';
  else if ((counts.date || 0) > (counts.amount || 0)) format = 'dated record';
  else if ((counts.amount || 0) > 0) format = 'amount schedule';
  return { assertion, format, sections: kept, tree, counts, hasRows: all.length > 0, rows: all.length, maxAmount: amts.length ? Math.max(...amts) : null };
}

export const fmtUSD = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
