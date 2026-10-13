// holodeck-relations.js — LINKING SOURCES BY RELATION, NOT BY TYPE.
//
// One link model for every surface: a link joins two spans (whole · span · value) of two sources by one of six
// relations, at one of three grains, and says how it was established (in the file · computed · inferred ·
// confirmed). Nothing here is a source-type check: a video, its captions, a transcript, an act and a contract are
// all "a source with text and, sometimes, a time axis".
//
// This is NOT holodeck-links.js. That file binds a referent to Wikidata/Wikipedia and refuses namesakes; this one
// links the workspace's own sources to each other. The two never share a record.
//
// PURE and model-free: plain data in, plain data out, no DOM. `A` is the app's analysis ({docs, sts, stsByDoc,
// docById}); every function reads only what it needs from it, so the tests drive it with a hand-built fixture.
//
// No hand-set thresholds. A wording match is kept only when each side is the other's strictly best partner and the
// pair's score beats a seeded resampling null (statements of the same size drawn from the workspace's own token
// distribution). A value is rare by its own document frequency (idf), never by a constant.

export const LINKS_SCHEMA = 'HolodeckLinks@1';

// ── the vocabulary ──────────────────────────────────────────────────────────────────────────────────────────────
// `line` names the stroke a surface draws; `symmetric` relations have no direction (the id sorts the two ends).
export const RELATIONS = {
  'form-of':      { label: 'form of',      line: 'double', symmetric: false, glyph: '═' },
  'part-of':      { label: 'part of',      line: 'nest',   symmetric: false, glyph: '⊂' },
  'cites':        { label: 'cites',        line: 'arrow',  symmetric: false, glyph: '→' },
  'derived-from': { label: 'derived from', line: 'dashed', symmetric: false, glyph: '⇢' },
  'same-value':   { label: 'same value',   line: 'dotted', symmetric: true,  glyph: '●─●' },
  'says-about':   { label: 'says about',   line: 'thin',   symmetric: false, glyph: '↝' },
};
export const RELATION_IDS = Object.keys(RELATIONS);
// How a link was established. `rank` orders confidence for a provenance threshold: a surface that asks for
// "confirmed + computed" admits every provenance whose rank is at least `computed`'s.
export const PROVENANCE = {
  inferred:  { label: 'inferred',    rank: 0 },
  computed:  { label: 'computed',    rank: 1 },
  file:      { label: 'in the file', rank: 2 },
  confirmed: { label: 'confirmed',   rank: 3 },
};
export const PROVENANCE_IDS = Object.keys(PROVENANCE);
export const VERDICTS = ['same', 'differs', 'extends'];
export const GRAINS = ['ground', 'figure', 'pattern'];

// ── spans: whole · span · value ─────────────────────────────────────────────────────────────────────────────────
// A span runs along an axis: time for media, characters for text. A value is a span that carries a figure or date.
export const wholeSpan = doc => ({ doc: String(doc), kind: 'whole' });
export const charSpan = (doc, s, e) => ({ doc: String(doc), kind: 'span', axis: 'chars', s, e });
export const timeSpan = (doc, t0, t1) => ({ doc: String(doc), kind: 'span', axis: 'time', t0, t1 });
export const valueSpan = (doc, s, e, value, unit, raw) => ({ doc: String(doc), kind: 'value', axis: 'chars', s, e, value, unit, raw });
const r3 = x => Math.round(x * 1000) / 1000;
export function spanKey(sp) {
  if (!sp) return '';
  if (sp.kind === 'whole') return sp.doc;
  if (sp.axis === 'time') return sp.doc + '@t' + r3(sp.t0) + '-' + r3(sp.t1);
  return sp.doc + '@' + sp.s + '-' + sp.e + (sp.kind === 'value' ? '=' + sp.value : '');
}
export const onChars = sp => !!sp && sp.kind !== 'whole' && sp.axis !== 'time';

function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
// A link's id is a function of what it joins, so a reader's decision about a link survives recomputation.
export function linkId(relation, from, to) {
  let a = spanKey(from), b = spanKey(to);
  if (RELATIONS[relation] && RELATIONS[relation].symmetric && a > b) [a, b] = [b, a];
  return relation + ':' + hash32(a + '\u0001' + b);
}

// Ground: the two whole sources are tied. Figure: a specific passage or value is tied to another. (Pattern is
// never stored — it is a recurring structure *over* links; see patternsOf.)
export const grainOf = L => (L.from.kind === 'whole' && L.to.kind === 'whole' ? 'ground' : 'figure');

export function makeLink({ relation, from, to, provenance, why, source, verdict, quote, score, finding }) {
  if (!RELATIONS[relation]) throw new Error('unknown relation: ' + relation);
  if (!PROVENANCE[provenance]) throw new Error('unknown provenance: ' + provenance);
  const L = { id: linkId(relation, from, to), relation, from, to, provenance, why: why || '', source: source || 'declared' };
  if (verdict) L.verdict = verdict;
  if (quote) L.quote = quote;
  if (score != null) L.score = score;
  if (finding) L.finding = finding;
  L.grain = grainOf(L);
  return L;
}

// ── tokens and values ───────────────────────────────────────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const lower = x => String(x == null ? '' : x).toLocaleLowerCase();
export function words(text) {
  const out = [];
  const m = lower(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  for (let w of m) {
    w = w.replace(/^['’-]+|['’-]+$/g, '').replace(/['’]s$/, '');
    if (w.length < 2) continue;
    if (/^\d+$/.test(w) && w.length <= 2) continue; // bare small numbers are values, handled separately
    if (w.length > 4 && /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    out.push(w);
  }
  return out;
}

// Dates and figures a statement states, as value tokens: two sources that state the same date state the same
// token, whatever the surrounding words. `s`/`e` are absolute offsets into the source's text.
export function valuesOf(st) {
  const out = []; const t = st.text || ''; const base = st.s || 0; const seen = new Set();
  const push = v => { const k = v.token + '@' + v.s; if (!seen.has(k)) { seen.add(k); out.push(v); } };
  const date = (m, mo, d, y) => { if (!mo || d < 1 || d > 31) return;
    push({ kind: 'date', token: 'd:' + mo + '-' + d, key: 'date', value: mo * 100 + d, year: y || null, raw: m[0], s: base + m.index, e: base + m.index + m[0].length }); };
  let m;
  const a = new RegExp('\\b' + MON_RE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+((?:19|20)\\d{2}))?\\b', 'gi');
  while ((m = a.exec(t))) date(m, MONTHS[m[1].toLowerCase()], +m[2], m[3] && +m[3]);
  const b = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON_RE + '\\.?(?:,?\\s+((?:19|20)\\d{2}))?\\b', 'gi');
  while ((m = b.exec(t))) date(m, MONTHS[m[2].toLowerCase()], +m[1], m[3] && +m[3]);
  const c = /\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g;
  while ((m = c.exec(t))) date(m, +m[2] >= 1 && +m[2] <= 12 ? +m[2] : 0, +m[3], +m[1]);
  let figList = st.figs;
  if (!figList) { // text that has not been through the app's figure finder (a draft): currency amounts and percents
    figList = []; const fr = /([$£€])\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(%|percent)/g; let q;
    while ((q = fr.exec(t))) { const v = parseFloat((q[2] || q[3]).replace(/,/g, '')); if (!isFinite(v)) continue;
      figList.push({ raw: q[0], value: v, unit: q[1] ? (q[1] === '$' ? 'dollars' : q[1] === '£' ? 'pounds' : 'euros') : 'percent', s: q.index, e: q.index + q[0].length }); }
  }
  figList.forEach(g => {
    if (g == null || !isFinite(+g.value)) return;
    const unit = String(g.unit || g.label || '').toLowerCase();
    const s0 = g.s || 0;
    push({ kind: 'fig', token: 'n:' + unit + ':' + (+g.value), key: unit, value: +g.value, raw: g.raw || String(g.value), s: base + s0, e: base + (g.e != null ? g.e : s0 + String(g.raw || '').length) });
  });
  return out;
}
const sameYearish = (x, y) => x.year == null || y.year == null || x.year === y.year;

// ── cue spans: the time axis of a timed source ──────────────────────────────────────────────────────────────────
// A timed source carries `tmarks` [{o: char offset, t: seconds}] — where in its text each timecode begins. A cue
// runs from one mark to the next; the last cue runs to `duration` if the source states one, else one median cue.
export const isTimed = d => !!(d && d.tmarks && d.tmarks.length);
export function cuesOf(d) {
  const m = ((d && d.tmarks) || []).filter(x => x && isFinite(x.o) && isFinite(x.t)).slice().sort((p, q) => p.o - q.o || p.t - q.t);
  if (!m.length) return [];
  const gaps = m.slice(1).map((x, i) => x.t - m[i].t).filter(g => g > 0).sort((p, q) => p - q);
  const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 5;
  const len = (d.text || '').length;
  return m.map((x, i) => ({ doc: d.id, i, s: x.o, e: i + 1 < m.length ? m[i + 1].o : Math.max(x.o, len), t0: x.t,
    t1: i + 1 < m.length ? m[i + 1].t : (isFinite(d.duration) && d.duration > x.t ? d.duration : x.t + med) }));
}
export function timeAt(d, o) { const c = cuesOf(d); if (!c.length) return null; let k = c[0]; for (const x of c) { if (x.s <= o) k = x; else break; } return k.t0; }
export function charsAt(d, t) { const c = cuesOf(d); if (!c.length) return null; let k = c[0]; for (const x of c) { if (x.t0 <= t) k = x; else break; } return k.s; }
export function fmtClock(t) {
  t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

// ── importers: the links a file already states ──────────────────────────────────────────────────────────────────
// 1. Caption timecodes. A timed source states that each stretch of its text is the form of a stretch of its media.
export function importCues(A) {
  const links = [];
  for (const d of A.docs || []) for (const c of cuesOf(d)) {
    if (c.e <= c.s) continue;
    links.push(makeLink({ relation: 'form-of', from: charSpan(d.id, c.s, c.e), to: timeSpan(d.id, c.t0, c.t1), provenance: 'file', source: 'captions',
      why: 'The source’s own timecodes place this text at ' + fmtClock(c.t0) + '–' + fmtClock(c.t1) + '.' }));
  }
  return links;
}

// 2. Transcript alignment. Two timed sources of the SAME recording (the files name the same media id) share one
//    time axis, so a cue in one overlaps the cue(s) of the other wherever they overlap in time.
export function importAlignment(A) {
  const links = []; const timed = (A.docs || []).filter(d => isTimed(d) && d.media && d.media.id);
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    const a = timed[i], b = timed[j]; if (a.media.id !== b.media.id) continue;
    const ca = cuesOf(a), cb = cuesOf(b);
    for (const x of ca) for (const y of cb) {
      const ov = Math.min(x.t1, y.t1) - Math.max(x.t0, y.t0); if (ov <= 0) continue;
      if (ov < 0.5 * Math.min(x.t1 - x.t0, y.t1 - y.t0)) continue; // overlapping by less than half of the shorter cue is a touch, not an alignment
      links.push(makeLink({ relation: 'form-of', from: charSpan(a.id, x.s, x.e), to: charSpan(b.id, y.s, y.e), provenance: 'computed', source: 'alignment',
        why: 'Both are timed text of the same recording and overlap at ' + fmtClock(Math.max(x.t0, y.t0)) + '.' }));
    }
  }
  return links;
}

// 3. Citations. A statement that names a section ("§14", "Section 14 of the Harbor Development Act", "cl. 5.1")
//    cites it. The citation is in the file; the target is resolved by the title of the cited source, or by a
//    statement that opens with that number. A citation that cannot be resolved is returned, not dropped — a
//    reference to something the workspace does not hold is a gap the reader should see.
const CITE_RE = /(?:§+|\b(?:sections?|secs?\.|articles?|art\.|clauses?|cl\.|chapters?|ch\.|paragraphs?|par\.))\s*(\d+(?:\.\d+)*(?:\([a-z0-9]+\))*)(?:\s+(?:of|in)\s+(?:the\s+)?((?:[A-Z][\w’'-]*\s+){0,6}(?:Act|Code|Ordinance|Law|Charter|Statute|Regulations?|Agreement|Lease|Contract|Policy|Rules?)))?/gi;
export function citationsOf(st) {
  const out = []; const t = st.text || ''; let m; CITE_RE.lastIndex = 0;
  const lead = (t.match(/^\s*/) || [''])[0].length;
  while ((m = CITE_RE.exec(t))) {
    // a section number that opens the statement is the statement's own label ("§14. The Authority may…"), not a citation
    if (m.index <= lead && !m[2]) continue;
    out.push({ num: m[1], of: m[2] ? m[2].trim() : '', raw: m[0], s: (st.s || 0) + m.index, e: (st.s || 0) + m.index + m[0].length });
  }
  return out;
}
const titleKey = t => words(t).join(' ');
export function importCitations(A) {
  const links = [], unresolved = [];
  const docs = A.docs || []; const by = id => (A.stsByDoc && A.stsByDoc[id]) || [];
  const tkey = new Map(docs.map(d => [d.id, titleKey(d.title)]));
  const opener = (st, num) => new RegExp('^\\s*(?:§+\\s*|(?:sections?|articles?|clauses?)\\.?\\s*)?' + num.replace(/\./g, '\\.').replace(/[()]/g, '\\$&') + '(?![\\d])', 'i').test(st.text || '');
  for (const d of docs) for (const st of by(d.id)) for (const c of citationsOf(st)) {
    let targets;
    if (c.of) { const want = words(c.of); targets = docs.filter(x => x.id !== d.id && want.length && want.every(w => (tkey.get(x.id) || '').split(' ').includes(w))); }
    else targets = docs.filter(x => x.id !== d.id && by(x.id).some(s => opener(s, c.num)));
    if (targets.length !== 1) {
      unresolved.push({ doc: d.id, st: st.id, raw: c.raw, num: c.num, of: c.of, s: c.s, e: c.e,
        why: targets.length ? 'more than one source could be meant' : (c.of ? 'no source here is titled “' + c.of + '”' : 'no other source opens with section ' + c.num) });
      continue;
    }
    const T = targets[0]; const hit = by(T.id).find(s => opener(s, c.num));
    links.push(makeLink({ relation: 'cites', from: charSpan(d.id, c.s, c.e), to: hit ? charSpan(T.id, hit.s, hit.e) : wholeSpan(T.id), provenance: 'file', source: 'citation',
      why: 'The text says “' + c.raw + '”' + (hit ? '.' : '; the cited source holds no passage that opens with ' + c.num + ', so the whole source is the target.'), quote: { from: c.raw },
      finding: { kind: 'cite', headline: 'Cites “' + c.raw + '”' + (hit ? ', which reads: “' + clipTo(hit.text, 140) + '”' : ' in ' + T.title + ', which holds no passage that opens with ' + c.num), terms: [c.raw], marks: { from: [[c.s, c.e]], to: hit ? [[hit.s, Math.min(hit.e, hit.s + 40)]] : [] } } }));
  }
  return { links, unresolved };
}

// 4. Title containment: a source whose title contains another source's whole title is a part of it.
export function importParts(A) {
  const links = [];
  const keys = (A.docs || []).map(d => ({ d, k: titleKey(d.title) })).filter(x => x.k.split(' ').length >= 2);
  for (const a of keys) for (const b of keys) {
    if (a.d.id === b.d.id || a.k === b.k) continue;
    if (a.k.length > b.k.length && (' ' + a.k + ' ').includes(' ' + b.k + ' '))
      links.push(makeLink({ relation: 'part-of', from: wholeSpan(a.d.id), to: wholeSpan(b.d.id), provenance: 'inferred', source: 'title',
        why: '“' + a.d.title + '” contains the whole title “' + b.d.title + '”; the documents do not say it is a part.' }));
  }
  return links;
}

// 5. What the workspace already holds: contract-links.json (legislation that names the contracting party; a
//    contract that replaces or is replaced by another) and the app's own copy-origin reading.
export function importContractLinks(json, A) {
  const out = []; const have = new Set((A.docs || []).map(d => d.id));
  const L = (json && json.links) || {};
  for (const id of Object.keys(L)) {
    if (!have.has(id)) continue; const e = L[id] || {};
    (e.legislation || []).forEach(x => { const from = x.id || x.legId; if (!from || !have.has(from)) return;
      out.push(makeLink({ relation: 'says-about', from: wholeSpan(from), to: wholeSpan(id), provenance: x.basis === 'stated' ? 'file' : 'inferred', source: 'contract-links', why: x.why || 'Legislation that names the contracting party.' })); });
    (e.replaces || []).forEach(x => { if (!x.id || !have.has(x.id)) return;
      out.push(makeLink({ relation: 'derived-from', from: wholeSpan(id), to: wholeSpan(x.id), provenance: x.basis === 'stated' ? 'file' : 'inferred', source: 'contract-links', why: x.why || 'Successive terms of the same party.' })); });
  }
  return out;
}
export function importOrigins(map, A) {
  const out = []; const have = new Set((A.docs || []).map(d => d.id));
  for (const id of Object.keys(map || {})) {
    const o = map[id]; if (!o || !have.has(id) || !have.has(o.of)) continue;
    out.push(makeLink({ relation: 'derived-from', from: wholeSpan(id), to: wholeSpan(o.of), provenance: 'computed', source: 'origin', why: (o.why || 'Shares most of its text with') + ' the source it points to.' }));
  }
  return out;
}

// ── wording: pairs proposed by the words, labelled by the figures ───────────────────────────────────────────────
// The index is built once per analysis: per statement a bag of word and value tokens, per token its document
// frequency over statements. A pair's score is the idf-sum of the tokens the two share.
export function bagOf(st) {
  const vals = valuesOf(st); const ws = words(st.text); const toks = new Set(ws);
  for (let i = 0; i + 1 < ws.length; i++) toks.add(ws[i] + ' ' + ws[i + 1]);           // adjacent words: a shared phrase is more than a shared bag
  vals.forEach(v => { toks.add(v.token); toks.add('u:' + v.key); });                    // the value, and the kind of value it is
  return { toks, vals };
}
export function buildIndex(A, { onlyDocs = null, cues = false } = {}) {
  const docs = (A.docs || []).filter(d => !onlyDocs || onlyDocs.has(d.id));
  const sts = []; const byDoc = new Map();
  for (const d of docs) {
    const list = ((A.stsByDoc && A.stsByDoc[d.id]) || []).filter(st => (st.text || '').trim().length >= 12);
    byDoc.set(d.id, list); list.forEach(st => sts.push(st));
  }
  const info = new Map(); const df = new Map();
  for (const st of sts) {
    const { toks, vals } = bagOf(st);
    info.set(st.id, { st, toks, vals }); toks.forEach(t => df.set(t, (df.get(t) || 0) + 1));
  }
  const N = sts.length || 1; const idf = t => Math.log2((N + 1) / (df.get(t) || 1)); // surprisal in bits: 0 for a token in every statement
  const inv = new Map(); info.forEach((x, id) => x.toks.forEach(t => { (inv.get(t) || inv.set(t, []).get(t)).push(id); }));
  const score = (a, b) => {
    const P = info.get(a), Q = info.get(b); if (!P || !Q) return 0;
    const [sm, lg] = P.toks.size <= Q.toks.size ? [P, Q] : [Q, P]; let s = 0;
    sm.toks.forEach(t => { if (lg.toks.has(t)) s += idf(t); });
    return s;
  };
  // The workspace's token distribution, for the resampling null: a token is drawn in proportion to its df.
  const vocab = [...df.keys()].sort(); const cum = new Float64Array(vocab.length); let tot = 0;
  vocab.forEach((t, i) => { tot += df.get(t); cum[i] = tot; });
  const draw = u => { const x = u * tot; let lo = 0, hi = vocab.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return vocab[lo]; };
  // `cues` switches on the findings that read English negators (a denial). Off by default: no cue list runs unless asked.
  return { docs, sts, byDoc, info, df, N, idf, inv, score, draw, vocabSize: vocab.length, cues: !!cues };
}
// A fixed-seed generator so the null is the same on every run (no clock, no Math.random).
function lcg(seed) { let x = (seed >>> 0) || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }

// Best partners of one source's statements in another: mutual and strictly best, each graded against a resampling null.
// The null replaces a statement with as many tokens drawn from the workspace's own token distribution (by document
// frequency, fixed seed) and asks what that replacement's best partner score would have been. The replacement for
// a statement of A is drawn from the workspace minus B, and the one for a statement of B from the workspace minus
// A: a bag drawn from the whole workspace could pull in the partner's own distinctive words, which is the very
// dependence being tested. A pair is kept (beatsNull) only if its observed score exceeds every one of those draws
// on both sides. So the threshold is the workspace's own vocabulary, not a constant. The Seam, where a reader has
// already chosen the two sources, shows a weak pair as weak; the workspace-wide proposals require it.
export const NULL_DRAWS = 40;
export function pairDocs(ix, docA, docB, { draws = NULL_DRAWS, requireNull = false } = {}) {
  const la = ix.byDoc.get(docA) || [], lb = ix.byDoc.get(docB) || [];
  const rnd = lcg(parseInt(hash32(docA + '|' + docB), 36));
  const dfIn = pool => { const m = new Map(); pool.forEach(st => ix.info.get(st.id).toks.forEach(t => m.set(t, (m.get(t) || 0) + 1))); return m; };
  const dfA = dfIn(la), dfB = dfIn(lb);
  // a token of the workspace's distribution, thinned by the share of its occurrences that sit outside `excl`
  const drawOutside = excl => { for (let i = 0; i < 64; i++) { const t = ix.draw(rnd()); const x = excl.get(t) || 0; if (!x || rnd() * ix.df.get(t) >= x) return t; } return null; };
  const scoreSets = (toks, pool) => {
    let bs = 0;
    for (const b of pool) { let s = 0; const T = ix.info.get(b.id).toks; toks.forEach(t => { if (T.has(t)) s += ix.idf(t); }); if (s > bs) bs = s; }
    return bs;
  };
  const best = (a, pool) => {
    let bs = 0, bb = null, second = 0;
    for (const b of pool) { const sc = ix.score(a.id, b.id); if (sc > bs) { second = bs; bs = sc; bb = b; } else if (sc > second) second = sc; }
    return { b: bb, score: bs, second };
  };
  const fwd = new Map(), back = new Map();
  la.forEach(a => { const r = best(a, lb); if (r.b && r.score > 0) fwd.set(a.id, r); });
  lb.forEach(b => { const r = best(b, la); if (r.b && r.score > 0) back.set(b.id, r); });
  const nullBest = (id, pool, excl) => {
    const k = ix.info.get(id).toks.size; let m = 0;
    for (let i = 0; i < draws; i++) { const t = new Set(); for (let j = 0; j < k; j++) { const x = drawOutside(excl); if (x != null) t.add(x); } const s = scoreSets(t, pool); if (s > m) m = s; }
    return m;
  };
  const out = new Map();
  fwd.forEach((r, aId) => {
    const bk = back.get(r.b.id); if (!bk || bk.b.id !== aId) return;                 // mutual best, so nothing is merged
    if (!(r.score > r.second) || !(bk.score > bk.second)) return;                       // a tie is not a best
    const nullMax = Math.max(nullBest(aId, lb, dfB), nullBest(r.b.id, la, dfA));
    const beatsNull = r.score > nullMax;
    if (requireNull && !beatsNull) return;
    out.set(aId, { b: r.b, score: r.score, nullMax, beatsNull });
  });
  return out;
}

// A denial is about its topic words, not its whole sentence: the terms that carry at least one bit across the
// workspace (in fewer than half its statements) and are words rather than numbers. Function words never qualify.
const distinctive = (ix, t) => /^[\p{L}][\p{L}'’-]{3,}$/u.test(t) && (ix.df.get(t) || 0) * 2 <= ix.sts.length;
const dtoks = (ix, id) => { const out = []; ix.info.get(id).toks.forEach((t) => { if (distinctive(ix, t)) out.push(t); }); return out; };
const dscore = (ix, aId, bId) => { const Q = ix.info.get(bId).toks; let s = 0; for (const t of dtoks(ix, aId)) if (Q.has(t)) s += ix.idf(t); return s; };

// What a bag of as many topic words as the denial has, drawn from the workspace's own words outside the candidate
// source, finds at best in that source: the bar a real pair must clear. Same statistic, same selection (best of the
// source), only the words are chance. Cached per (statement, source) on the index.
export function nullFloor(ix, aId, docB, draws = NULL_DRAWS) {
  const key = aId + '>' + docB; ix._floor = ix._floor || new Map(); if (ix._floor.has(key)) return ix._floor.get(key);
  const pool = ix.byDoc.get(docB) || []; const rnd = lcg(parseInt(hash32(key), 36));
  const excl = new Map(); pool.forEach((st) => ix.info.get(st.id).toks.forEach((t) => excl.set(t, (excl.get(t) || 0) + 1)));
  const outside = () => { for (let i = 0; i < 256; i++) { const t = ix.draw(rnd()); if (!distinctive(ix, t)) continue; const x = excl.get(t) || 0; if (!x || rnd() * ix.df.get(t) >= x) return t; } return null; };
  const k = dtoks(ix, aId).length; let m = 0;
  for (let i = 0; i < draws; i++) {
    const bag = new Set(); for (let j = 0; j < k; j++) { const x = outside(); if (x != null) bag.add(x); }
    for (const c of pool) { let sc = 0; const T = ix.info.get(c.id).toks; bag.forEach((t) => { if (T.has(t)) sc += ix.idf(t); }); if (sc > m) m = sc; }
  }
  ix._floor.set(key, m); return m;
}

// A denial is compared with EVERY statement of another source that states the same things, not only its single best
// partner: "does the contract contain any … surveillance? No." is answered by each listed item, not by one. A candidate
// qualifies when it shares a distinctive term and out-scores what a random bag of the same size finds in that source.
export function polarityLinks(A, ix, { perDoc = 3 } = {}) {
  const out = []; const seen = new Set();
  const docIds = ix.docs.map((d) => d.id);
  for (const D of ix.sts) {
    if (!negIn(D.text)) continue;
    for (const other of docIds) {
      if (other === D.doc) continue;
      const cands = [];
      for (const C of ix.byDoc.get(other) || []) {
        if (negIn(C.text)) continue;                    // two denials agree; a denial and a statement differ
        const sc = dscore(ix, D.id, C.id); if (sc > 0) cands.push({ C, sc });
      }
      if (!cands.length) continue;
      const floor = nullFloor(ix, D.id, other);
      cands.filter((x) => x.sc > floor).sort((x, y) => y.sc - x.sc).slice(0, perDoc).forEach(({ C, sc }) => {
        const L = linkFromPair(ix, D, C, sc, true); if (!L.finding || L.finding.kind !== 'polarity') return;
        if (seen.has(L.id)) return; seen.add(L.id); L.source = 'denial'; out.push(L);
      });
    }
  }
  return out;
}

// The verdict is read off the figures, never off the similarity.
export function verdictOf(ix, aId, bId) {
  const P = ix.info.get(aId), Q = ix.info.get(bId); if (!P || !Q) return { verdict: null, via: null };
  let equal = null, conflict = null;
  for (const x of P.vals) for (const y of Q.vals) {
    if (x.kind !== y.kind) continue;
    if (x.kind === 'date') {
      if (x.token === y.token && sameYearish(x, y)) equal = equal || [x, y];
      else if (x.token !== y.token && x.year && y.year && x.year === y.year) conflict = conflict || [x, y];
    } else if (x.key === y.key) { if (x.value === y.value) equal = equal || [x, y]; else conflict = conflict || [x, y]; }
  }
  if (conflict && !equal) return { verdict: 'differs', via: conflict };
  if (equal) return { verdict: 'same', via: equal };
  return { verdict: P.vals.length !== Q.vals.length ? 'extends' : null, via: null };
}

// ── findings: what a pair establishes, said plainly, with the exact words marked ───────────────────────────────────
// A link that says only "same value" or "says about" tells a reader nothing they can act on. A finding is the
// specific thing the two ends show together, built from the text alone:
//   differs   a figure or date stated two ways about the same thing        "$12" here, "$15" there
//   polarity  one end denies and the other states, over the same terms      "No … surveillance" against "Video Surveillance Solutions"
//   defined   a phrase one source writes into the definition of a term      "drone" is named in the definition of "UAS"
//   same      the same figure or date in both                               both state "May 3"
//   terms     the distinctive words the two share (what made them a pair)   both address drone, video, analytics
//   cite      a citation, with the passage it lands on
// `marks` are absolute [start, end) offsets into each source's text, so a surface can underline the words themselves.
const NEG_CUE = /\b(?:not|never|none|nothing|without|neither|nor|cannot|disclaims?|prohibit(?:s|ed)?)\b|\w+n['’]t\b|\bno\b(?!\.?\s*\d)/gi;
const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clipTo = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
function negIn(text) { NEG_CUE.lastIndex = 0; const m = NEG_CUE.exec(text || ''); return m ? { raw: m[0], at: m.index } : null; }
export function sharedTerms(ix, aId, bId, max = 4) {
  const P = ix.info.get(aId), Q = ix.info.get(bId); if (!P || !Q) return [];
  // words that carry something in this workspace (in fewer than half its statements, four letters or more): a pair that
  // shares only "on", "this" and "the" shares nothing worth marking
  const out = []; P.toks.forEach((t) => { if (Q.toks.has(t) && distinctive(ix, t)) { const w = ix.idf(t); if (w > 0) out.push([t, w]); } });
  return out.sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, max).map((x) => x[0]);
}
export function marksFor(st, terms) {
  const t = st.text || '', base = st.s || 0, hits = [];
  for (const w of terms) { const re = new RegExp('\\b' + escRe(w) + '[\\p{L}\\p{N}]*', 'giu'); let m; let k = 0; while ((m = re.exec(t)) && k++ < 6) hits.push([base + m.index, base + m.index + m[0].length]); }
  hits.sort((x, y) => x[0] - y[0]); const out = [];
  hits.forEach((h) => { const l = out[out.length - 1]; if (l && h[0] <= l[1]) l[1] = Math.max(l[1], h[1]); else out.push(h.slice()); });
  return out;
}
const around = (st, marks, w = 70) => { const t = st.text || ''; const base = st.s || 0; const m = marks[0]; if (!m) return clipTo(t, 2 * w); const a = Math.max(0, m[0] - base - w / 2), b = Math.min(t.length, m[1] - base + w); return (a > 0 ? '…' : '') + t.slice(a, b).replace(/\s+/g, ' ').trim() + (b < t.length ? '…' : ''); };
export function findingFor(ix, a, b, verdictInfo) {
  const terms = sharedTerms(ix, a.id, b.id);
  const ma = marksFor(a, terms), mb = marksFor(b, terms);
  const { verdict, via } = verdictInfo || verdictOf(ix, a.id, b.id);
  if (verdict === 'differs' && via) {
    const x = via[0].raw, y = via[1].raw;
    return { kind: 'differs', headline: 'Different figures for the same thing: “' + x + '” here, “' + y + '” there', terms, marks: { from: [[via[0].s, via[0].e]].concat(ma), to: [[via[1].s, via[1].e]].concat(mb) } };
  }
  const na = negIn(a.text), nb = negIn(b.text);
  if (ix.cues && !!na !== !!nb && terms.length) {
    const den = na ? a : b, sta = na ? b : a, md = na ? ma : mb, ms = na ? mb : ma;
    return { kind: 'polarity', headline: 'One denies what the other states, over ' + terms.slice(0, 3).join(', ') + ': “' + around(den, md) + '” against “' + around(sta, ms) + '”', terms, marks: { from: ma, to: mb }, denier: na ? 'from' : 'to' };
  }
  if (verdict === 'same' && via) return { kind: 'same', headline: 'Both state “' + via[0].raw + '”' + (terms.length ? ', over ' + terms.slice(0, 3).join(', ') : ''), terms, marks: { from: [[via[0].s, via[0].e]].concat(ma), to: [[via[1].s, via[1].e]].concat(mb) } };
  if (terms.length >= 2) return { kind: 'terms', headline: 'Both address ' + terms.join(', '), terms, marks: { from: ma, to: mb } };
  return null;
}
// A definition writes its examples into its own text: '"Surveillance technology" includes: automatic license plate
// readers, closed-circuit cameras, …'. Any other source that names one of those examples falls inside what the
// definition says — and that is the finding, whatever else the two say alike.
const DEF_HEAD = /^\s*(?:\(\w+\)\s*)?["“]([^"”]{2,70})["”]\s+(?:shall\s+mean|means|shall\s+include|includes|including)\b/i;
export function definedLinks(A, ix) {
  const defs = []; // {st, term, examples:[phrase words]}
  for (const st of ix.sts) {
    const m = DEF_HEAD.exec(st.text || ''); if (!m) continue;
    const body = (st.text || '').slice(m[0].length);
    const parts = body.split(/[;,]|\band\b|\bor\b|\(\w{1,4}\)|:/i).map((x) => words(x).join(' ')).filter((x) => x && x.split(' ').length <= 6);
    const ex = [...new Set(parts)].filter((phrase) => { const w = phrase.split(' '); return w.length >= 2; });   // a phrase, never one generic word: “hardware” is in every definition and says nothing
    if (ex.length) defs.push({ st, term: m[1].trim(), examples: ex });
  }
  const links = []; const seen = new Set();
  for (const D of defs) {
    for (const S of ix.sts) {
      if (S.doc === D.st.doc) continue;
      const norm = ' ' + words(S.text).join(' ') + ' ';
      for (const phrase of D.examples) {
        if (!norm.includes(' ' + phrase + ' ')) continue;
        const first = phrase.split(' ')[0]; const re = new RegExp('\\b' + escRe(first) + '[\\p{L}\\p{N}]*', 'iu'); const mm = re.exec(S.text || ''); if (!mm) continue;
        const s0 = (S.s || 0) + mm.index, e0 = s0 + Math.max(mm[0].length, phrase.length);
        const key = S.id + '>' + D.st.id + '>' + phrase; if (seen.has(key)) continue; seen.add(key);
        links.push(makeLink({ relation: 'says-about', from: valueSpan(S.doc, s0, Math.min(e0, (S.s || 0) + (S.text || '').length), 0, 'defined-term', phrase), to: charSpan(D.st.doc, D.st.s, D.st.e), provenance: 'computed', source: 'definition',
          why: 'The text names “' + phrase + '”, a phrase the definition of “' + D.term + '” writes into its own text.',
          finding: { kind: 'defined', headline: '“' + phrase + '” is named in the definition of “' + D.term + '”: “' + clipTo(D.st.text, 150) + '”', terms: [phrase], marks: { from: [[s0, Math.min(e0, (S.s || 0) + (S.text || '').length)]], to: marksFor(D.st, phrase.split(' ')) } } }));
        break; // one finding per statement per definition: the first example it names
      }
    }
  }
  return links;
}

// ── the engine's reading across sources ─────────────────────────────────────────────────────────────────────────────
// What the sources establish TOGETHER is read by the engine (POST /v1/read-across: native/the-fold/read-across.js),
// not here. This module only turns its answer into links: it holds no cue word of any language. The engine returns
//   findings    licensed: they cleared a null (a source names another by carrying its title; a set of omissions that
//               independent sources would not share by chance)
//   candidates  held below the line: a form the named text holds that the naming source never writes and other sources
//               return to, a thing spoken of in several modified ways that no source says
// and every mark is a UTF-16 index into the document exactly as sent. A candidate is an `inferred` link, never more.
const clipText = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
export function importReadAcross(A, result) {
  if (!result || result.schema !== 'EOReadAcross@1') return [];
  const have = new Set((A.docs || []).map((d) => d.id));
  const title = (id) => { const d = (A.docs || []).find((x) => x.id === id); return d ? d.title || d.id : id; };
  const links = []; const inRange = (m) => m && have.has(m.doc) && Number.isFinite(m.s) && Number.isFinite(m.e) && m.e > m.s;
  const marksOf = (list, doc) => (list || []).filter((m) => inRange(m) && m.doc === doc).map((m) => [m.s, m.e]);
  const all = (result.findings || []).map((f) => ({ ...f, licensed: true })).concat((result.candidates || []).map((f) => ({ ...f, licensed: false })));
  // the naming statement per (from, to): where a left-out summary hangs
  const naming = new Map();
  for (const f of all) if (f.kind === 'names' && f.licensed && f.statements && f.statements[0]) naming.set(f.from + '>' + f.to, f.statements[0]);
  // the strongest pair first, and the forms the other sources return to most; a handful per pair, the rest stay with the engine
  const perPair = new Map();
  const ordered = all.slice().sort((x, y) => (y.namesMargin || 0) - (x.namesMargin || 0) || (y.licensed - x.licensed) || (y.attention || 0) - (x.attention || 0));
  for (const f of ordered) {
    if (f.kind === 'left-out') { const k = f.from + '>' + f.to; const n = perPair.get(k) || 0; if (n >= 6) continue; perPair.set(k, n + 1); }
    if (f.kind === 'names') {
      if (!f.licensed || !have.has(f.from) || !have.has(f.to) || !f.statements || !f.statements.length) continue;
      const st = f.statements[0];
      links.push(makeLink({ relation: 'says-about', from: charSpan(f.from, st.s, st.e), to: wholeSpan(f.to), provenance: 'computed', source: 'engine',
        why: 'The engine reads this passage as naming “' + title(f.to) + '”: ' + f.basis + '.',
        finding: { kind: 'names', headline: '“' + clipText(st.text, 130) + '” names “' + clipText(title(f.to), 70) + '”', terms: [], marks: { from: marksOf(f.marks, f.from), to: [] }, basis: f.basis } }));
    } else if (f.kind === 'left-out') {
      if (!have.has(f.from) || !have.has(f.to) || !f.where || !(f.raised || []).length) continue;
      const r0 = f.raised[0]; const mk = (f.marks || []).find((m) => m.role === 'raised' && m.doc === r0.doc);
      if (!mk || !inRange(mk) || !have.has(r0.doc)) continue;
      const mine = (f.marks || []).find((m) => m.role === 'in-source' && m.doc === f.to);
      links.push(makeLink({ relation: 'says-about', from: charSpan(r0.doc, mk.s, mk.e), to: charSpan(f.to, f.where.s, f.where.e), provenance: f.licensed ? 'computed' : 'inferred', source: 'engine',
        why: f.basis + (f.set ? ' — ' + f.set : '') + '.',
        finding: { kind: 'scope', headline: '“' + f.form + '” is in “' + clipText(title(f.to), 60) + '” and is raised here; “' + clipText(title(f.from), 60) + '” names that text and never writes it' + (f.licensed ? '' : ' (not licensed: ' + (f.set || 'below the line') + ')'),
          terms: [f.form], marks: { from: [[mk.s, mk.e]], to: mine && inRange(mine) ? [[mine.s, mine.e]] : [] }, licensed: f.licensed, attendedBy: f.attendedBy } }));
    } else if (f.kind === 'absent') {
      const heldBy = (f.heldBy || []).find((id) => have.has(id)); const at = f.phrases && f.phrases[0] && f.phrases[0].at;
      if (!have.has(f.from) || !heldBy || !at) continue;
      links.push(makeLink({ relation: 'says-about', from: charSpan(f.from, at.s, at.e), to: wholeSpan(heldBy), provenance: 'inferred', source: 'engine',
        why: f.basis + '.',
        finding: { kind: 'absent', headline: 'Spoken of as ' + f.phrases.map((p) => '“' + p.phrase + '”').slice(0, 4).join(', ') + '; no source says any of them, though ' + (f.heldBy.length === 1 ? 'one says' : f.heldBy.length + ' say') + ' “' + f.form + '”',
          terms: f.phrases.map((p) => p.phrase), marks: { from: marksOf(f.marks, f.from).slice(0, 6), to: [] }, licensed: false } }));
    }
  }
  return links;
}

function linkFromPair(ix, a, b, score, beatsNull = true) {
  const { verdict, via } = verdictOf(ix, a.id, b.id);
  let from = charSpan(a.doc, a.s, a.e), to = charSpan(b.doc, b.s, b.e), quote = null;
  if (via) {
    from = valueSpan(a.doc, via[0].s, via[0].e, via[0].value, via[0].key, via[0].raw);
    to = valueSpan(b.doc, via[1].s, via[1].e, via[1].value, via[1].key, via[1].raw);
    quote = { from: via[0].raw, to: via[1].raw };
  }
  const rel = verdict === 'same' || verdict === 'differs' ? 'same-value' : 'says-about';
  // Computed means an equality was found, not a resemblance: the same value stated in the best-matching statement
  // of each. Everything that rests on the wording alone stays inferred until a reader confirms it.
  const provenance = verdict === 'same' ? 'computed' : 'inferred';
  const why = verdict === 'same' ? 'Both state ' + (quote ? '“' + quote.from + '”' : 'the same value') + ' in the passages that read most alike.'
    : verdict === 'differs' ? 'Wording match; the figures disagree (' + (quote ? '“' + quote.from + '” against “' + quote.to + '”' : 'different values') + ').'
    : verdict === 'extends' ? 'Wording match; one states a figure or date the other does not.' : 'Wording match; no figure to compare.';
  const finding = findingFor(ix, a, b, { verdict, via });
  // a denial against a statement is the strongest thing a pair of wordings can show: it is a difference, not a resemblance
  const strong = finding && finding.kind === 'polarity';
  const L = makeLink({ relation: rel, from, to, provenance: strong && provenance === 'inferred' ? 'inferred' : provenance, why: strong ? 'Wording match; one end denies what the other states.' : why, source: 'wording', verdict: strong && !verdict ? 'differs' : (verdict || undefined), quote, score, finding });
  if (!beatsNull) L.weak = true;
  return L;
}

// Proposals between two named sources (Seam): every statement with its partner, or alone. Nothing is merged.
export function seamOf(A, docA, docB, ix = buildIndex(A)) {
  const pairs = pairDocs(ix, docA, docB); const used = new Set(); const rows = [];
  const la = ix.byDoc.get(docA) || [], lb = ix.byDoc.get(docB) || [];
  la.forEach(a => {
    const p = pairs.get(a.id);
    if (p) { used.add(p.b.id); const L = linkFromPair(ix, a, p.b, p.score, p.beatsNull); rows.push({ a, b: p.b, link: L, verdict: L.verdict || 'related', score: p.score, weak: !p.beatsNull }); }
    else rows.push({ a, b: null, link: null, verdict: 'alone', score: 0 });
  });
  // an unpaired denial (or the statement it denies) is shown against its best candidate in the other source
  const denial = (st, pool, docOther) => { if (!negIn(st.text)) return null; const f = nullFloor(ix, st.id, docOther); let best = null;
    for (const C of pool) { if (negIn(C.text)) continue; const sc = dscore(ix, st.id, C.id); if (sc > f && (!best || sc > best.sc)) best = { C, sc }; }
    return best; };
  rows.forEach((r) => { if (r.a && !r.b) { const x = denial(r.a, lb, docB); if (x) { const L = linkFromPair(ix, r.a, x.C, x.sc, true);
    if (L.finding && L.finding.kind === 'polarity') { r.b = x.C; r.link = L; r.verdict = 'differs'; r.score = x.sc; r.shared = true; } } } });
  lb.forEach((b) => { if (used.has(b.id) || rows.some((r) => r.b === b)) return; const row = { a: null, b, link: null, verdict: 'alone', score: 0 };
    const x = denial(b, la, docA);
    if (x) { const L = linkFromPair(ix, x.C, b, x.sc, true); if (L.finding && L.finding.kind === 'polarity') { row.a = x.C; row.link = L; row.verdict = 'differs'; row.score = x.sc; row.shared = true; } }
    rows.push(row); });
  const count = v => rows.filter(r => r.verdict === v).length;
  return { rows, docA, docB, counts: { same: count('same'), differs: count('differs'), extends: count('extends'), related: count('related'), alone: count('alone') } };
}

// Every proposal across the workspace, under a stated work budget. `links` are the pairs that beat the null;
// `weak` are the mutual best pairs that did not — kept apart and disclosed, never dropped, because on a small
// workspace nothing can beat chance and the reader should be told that rather than shown an empty list.
// `truncated` says so when the budget ran out: coverage is a property of what was read, never implied. Candidate
// source pairs come from the inverted index over tokens that are rare by their own document frequency (no more
// than the square root of the statement count).
export function proposeAll(A, { budget = 3e6, maxPerDoc = 400 } = {}) {
  const ix = buildIndex(A); const links = [], weak = []; const seen = new Set(); let work = 0, truncated = false;
  const hot = new Map();
  const cap = Math.max(2, Math.ceil(Math.sqrt(ix.N)));
  ix.inv.forEach(list => {
    if (truncated || list.length < 2 || list.length > cap) return;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = ix.info.get(list[i]).st.doc, b = ix.info.get(list[j]).st.doc; if (a === b) continue;
      const k = a < b ? a + '\u0001' + b : b + '\u0001' + a; hot.set(k, (hot.get(k) || 0) + 1); work++;
    }
    if (work > budget) truncated = true;
  });
  const perDoc = new Map();
  for (const [k] of [...hot.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))) {
    if (work > budget * 2) { truncated = true; break; }
    const [da, db] = k.split('\u0001');
    if ((perDoc.get(da) || 0) >= maxPerDoc || (perDoc.get(db) || 0) >= maxPerDoc) continue;
    const pairs = pairDocs(ix, da, db); work += (ix.byDoc.get(da) || []).length * (ix.byDoc.get(db) || []).length;
    pairs.forEach((p, aId) => {
      const L = linkFromPair(ix, ix.info.get(aId).st, p.b, p.score, p.beatsNull);
      if (seen.has(L.id)) return; seen.add(L.id);
      (p.beatsNull ? links : weak).push(L); perDoc.set(da, (perDoc.get(da) || 0) + 1); perDoc.set(db, (perDoc.get(db) || 0) + 1);
    });
  }
  return { links, weak, truncated, sources: ix.docs.length, statements: ix.sts.length, vocabulary: ix.vocabSize };
}

// ── margin: a draft, sentence by sentence, against everything the workspace holds ──────────────────────────────────
// Each sentence of the draft is scored against every statement through the inverted index. A source "answers" the
// sentence when its best statement beats a resampling null — the same sentence-sized bag drawn from the workspace's
// own token distribution — so the bar is the workspace's vocabulary, not a constant. A sentence nothing answers is
// returned as unanswered: the margin shows that too, per sentence, as the overview builder does for a whole frame.
export function sentencesOf(text) {
  const out = []; const re = /[^.!?\n]+(?:[.!?]+(?=\s|$)|(?=\n)|$)/g; let m;
  while ((m = re.exec(text))) { const raw = m[0]; const t = raw.trim(); if (t.length < 3) continue; const lead = raw.length - raw.trimStart().length; out.push({ s: m.index + lead, e: m.index + lead + t.length, text: t }); }
  return out;
}
function scoreAll(ix, toks) {
  const acc = new Map();
  toks.forEach(t => { const w = ix.idf(t); if (w <= 0) return; const list = ix.inv.get(t); if (!list) return; for (const id of list) acc.set(id, (acc.get(id) || 0) + w); });
  return acc;
}
export function marginOf(ix, text, { draws = NULL_DRAWS, perSentence = 3 } = {}) {
  const rnd = lcg(parseInt(hash32(text.slice(0, 64) + text.length), 36));
  const rows = [];
  for (const sen of sentencesOf(text)) {
    const bag = bagOf({ text: sen.text, s: sen.s });
    const acc = scoreAll(ix, bag.toks);
    let nullMax = 0; const k = bag.toks.size;
    for (let i = 0; i < draws; i++) {
      const t = new Set(); for (let j = 0; j < k; j++) t.add(ix.draw(rnd()));
      scoreAll(ix, t).forEach(v => { if (v > nullMax) nullMax = v; });
    }
    const best = new Map(); // best statement per source
    acc.forEach((sc, id) => { const st = ix.info.get(id).st; const b = best.get(st.doc); if (!b || sc > b.score) best.set(st.doc, { st, score: sc, id }); });
    const partners = [...best.values()].filter(b => b.score > nullMax).sort((x, y) => y.score - x.score).slice(0, perSentence).map(b => {
      const { verdict, via } = verdictOfBags(bag, ix.info.get(b.id));
      return { doc: b.st.doc, st: b.st, score: b.score, verdict: verdict || 'related', via };
    });
    rows.push({ ...sen, partners, unanswered: partners.length === 0, nullMax, best: [...best.values()].sort((x, y) => y.score - x.score)[0] || null });
  }
  return rows;
}
function verdictOfBags(P, Q) {
  let equal = null, conflict = null;
  for (const x of P.vals) for (const y of Q.vals) {
    if (x.kind !== y.kind) continue;
    if (x.kind === 'date') { if (x.token === y.token && sameYearish(x, y)) equal = equal || [x, y]; else if (x.token !== y.token && x.year && y.year && x.year === y.year) conflict = conflict || [x, y]; }
    else if (x.key === y.key) { if (x.value === y.value) equal = equal || [x, y]; else conflict = conflict || [x, y]; }
  }
  if (conflict && !equal) return { verdict: 'differs', via: conflict };
  if (equal) return { verdict: 'same', via: equal };
  return { verdict: P.vals.length !== Q.vals.length ? 'extends' : null, via: null };
}

// ── the whole set, with a reader's decisions applied ────────────────────────────────────────────────────────────
export function collect(A, { contractLinks = null, origins = null, inferred = true, budget, readAcross = null, cues = false } = {}) {
  const cites = importCitations(A);
  const base = [].concat(importCues(A), importAlignment(A), cites.links, importParts(A),
    contractLinks ? importContractLinks(contractLinks, A) : [], origins ? importOrigins(origins, A) : [], []);
  // cross-source findings come from the engine's reading (readAcross). The cue-phrase finders below read English
  // negators and definition verbs; they are off unless asked for, and kept for comparison only.
  if (readAcross) base.push(...importReadAcross(A, readAcross));
  if (cues) { const ixd = buildIndex(A); base.push(...definedLinks(A, ixd), ...polarityLinks(A, ixd)); }
  let truncated = false, coverage = null, weak = [];
  if (inferred) {
    const p = proposeAll(A, { budget }); base.push(...p.links); weak = p.weak; truncated = p.truncated;
    coverage = { sources: p.sources, statements: p.statements, vocabulary: p.vocabulary };
  }
  const byId = new Map(); base.forEach(L => { if (!byId.has(L.id)) byId.set(L.id, L); });
  const have = new Set(byId.keys());
  return { links: [...byId.values()], weak: weak.filter(L => !have.has(L.id)), unresolved: cites.unresolved, truncated, coverage };
}
// Decisions are an append-only log: {id, at, by, action: confirm | reject | change | declare, link?, relation?}.
// Nothing is deleted: a rejected link leaves the set but stays in `rejected`, and a later `confirm` restores it.
export function resolveLinks(links, events = []) {
  const byId = new Map(links.map(L => [L.id, { ...L }])); const hist = new Map();
  for (const ev of events) {
    if (!ev || !ev.action) continue;
    if (ev.action === 'declare' && ev.link) { const L = { ...ev.link, provenance: 'confirmed', by: ev.by, at: ev.at, source: 'declared' }; L.grain = grainOf(L); byId.set(L.id, L); continue; }
    const L = byId.get(ev.id); if (!L) continue;
    (hist.get(ev.id) || hist.set(ev.id, []).get(ev.id)).push(ev);
    if (ev.action === 'confirm') { L.provenance = 'confirmed'; L.by = ev.by; L.at = ev.at; L.rejected = false; }
    else if (ev.action === 'reject') { L.rejected = true; L.by = ev.by; L.at = ev.at; }
    else if (ev.action === 'change' && RELATIONS[ev.relation]) { if (!L.was) L.was = L.relation; L.relation = ev.relation; L.provenance = 'confirmed'; L.by = ev.by; L.at = ev.at; L.rejected = false; }
  }
  const out = [], rejected = []; byId.forEach(L => (L.rejected ? rejected : out).push(L));
  return { links: out, rejected, history: hist };
}

// ── reading the set ─────────────────────────────────────────────────────────────────────────────────────────────
// filter: {relations: [id], minProvenance: id, verdict: 'differs'}; a null filter admits everything.
export function admits(filter = {}) {
  const rels = filter.relations ? new Set(filter.relations) : null;
  const min = filter.minProvenance != null ? PROVENANCE[filter.minProvenance].rank : null;
  return L => (!rels || rels.has(L.relation)) && (min == null || PROVENANCE[L.provenance].rank >= min) && (!filter.verdict || L.verdict === filter.verdict);
}
export const linksOf = (links, doc) => links.filter(L => L.from.doc === doc || L.to.doc === doc);
export const otherEnd = (L, doc) => (L.from.doc === doc ? L.to : L.from);
// What each source says of itself on its tile: how many links, how many differ.
export function tallyByDoc(links) {
  const t = new Map();
  const bump = (d, L) => { const x = t.get(d) || { links: 0, differs: 0, inferred: 0 }; x.links++; if (L.verdict === 'differs') x.differs++; if (L.provenance === 'inferred') x.inferred++; t.set(d, x); };
  links.forEach(L => { bump(L.from.doc, L); if (L.to.doc !== L.from.doc) bump(L.to.doc, L); });
  return t;
}
// The links with an end on characters [s, e) of a source — the passage card and the reader's gutter use this.
export const linksAt = (links, doc, s, e) => links.filter(L => [L.from, L.to].some(sp => sp.doc === doc && onChars(sp) && sp.s < e && s < sp.e));

// Pattern grain: a recurring structure — the same relation joining the same two sources more than once.
export function patternsOf(links) {
  const m = new Map();
  links.forEach(L => {
    let a = L.from.doc, b = L.to.doc; if (RELATIONS[L.relation].symmetric && a > b) [a, b] = [b, a];
    const k = L.relation + '\u0001' + a + '\u0001' + b; const x = m.get(k) || { key: k, relation: L.relation, a, b, links: [], differs: 0 };
    x.links.push(L); if (L.verdict === 'differs') x.differs++; m.set(k, x);
  });
  return [...m.values()].filter(x => x.links.length >= 2).sort((p, q) => q.links.length - p.links.length || (p.key < q.key ? -1 : 1));
}
// What a surface draws at a grain: ground = whole-source ties; figure = each link; pattern = bundles (a bundle
// of one is not a pattern, so single links stay figures).
export function atGrain(links, grain) {
  if (grain === 'ground') return { ties: links.filter(L => L.grain === 'ground'), bundles: [], singles: [] };
  if (grain === 'pattern') {
    const P = patternsOf(links); const inP = new Set(); P.forEach(p => p.links.forEach(L => inP.add(L.id)));
    return { ties: [], bundles: P, singles: links.filter(L => !inP.has(L.id)) };
  }
  return { ties: [], bundles: [], singles: links };
}

// Ground: a field over each source's own statements — which passages any link touches and which touch nothing
// (the void). Statements are the bins, so there is no bin width to choose.
export function fieldsOf(A, links) {
  const out = [];
  for (const d of A.docs || []) {
    const sts = (A.stsByDoc && A.stsByDoc[d.id]) || [];
    const ends = [];
    links.forEach(L => [L.from, L.to].forEach(sp => { if (sp.doc === d.id && onChars(sp)) ends.push({ sp, L }); }));
    const cells = sts.map(st => {
      const hit = ends.filter(x => x.sp.s < st.e && st.s < x.sp.e).map(x => x.L);
      return { st: st.id, s: st.s, e: st.e, n: hit.length, differs: hit.filter(L => L.verdict === 'differs').length, inferred: hit.filter(L => L.provenance === 'inferred').length };
    });
    const whole = links.filter(L => (L.from.doc === d.id && L.from.kind === 'whole') || (L.to.doc === d.id && L.to.kind === 'whole')).length;
    const linked = cells.filter(c => c.n > 0).length;
    out.push({ doc: d.id, title: d.title, cells, whole, linked, void: cells.length - linked, total: cells.length });
  }
  return out;
}

// Orbit: sources are planets, the passages that carry links are their moons. A body's ring is the number of link
// steps from the centre. The nest has the shape holodeck-holons.js returns, so openAtLevel / levelsOf / repOf /
// rollUp take it unchanged: Roots (level 0) shows sources, Parts (level 1) opens every source into its passages.
export function orbitOf(A, links, centre) {
  const planets = new Map(), moons = new Map(), edges = [];
  const planet = id => { if (!planets.has(id)) planets.set(id, { n: id, c: 0 }); return planets.get(id); };
  const passageAt = sp => (onChars(sp) ? (((A.stsByDoc && A.stsByDoc[sp.doc]) || []).find(st => st.s < sp.e && sp.s < st.e) || null) : null);
  const usable = links.filter(L => L.from.axis !== 'time' && L.to.axis !== 'time'); // a text and its own media is not an orbit
  usable.forEach(L => {
    const a = planet(L.from.doc), b = planet(L.to.doc); a.c++; if (b !== a) b.c++;
    const pa = passageAt(L.from), pb = passageAt(L.to);
    const na = pa ? 'p:' + pa.id : L.from.doc, nb = pb ? 'p:' + pb.id : L.to.doc;
    if (pa) { if (!moons.has(na)) moons.set(na, { n: na, doc: pa.doc, st: pa, c: 0 }); moons.get(na).c++; }
    if (pb) { if (!moons.has(nb)) moons.set(nb, { n: nb, doc: pb.doc, st: pb, c: 0 }); moons.get(nb).c++; }
    if (na !== nb) edges.push({ a: na, b: nb, c: 1, link: L.id });
  });
  const parent = new Map(), kids = new Map();
  planets.forEach((_, id) => { parent.set(id, null); kids.set(id, []); });
  moons.forEach((m, id) => { parent.set(id, m.doc); kids.get(m.doc).push(id); kids.set(id, []); });
  kids.forEach(list => list.sort());
  const weight = new Map(), size = new Map();
  planets.forEach((p, id) => { weight.set(id, p.c); size.set(id, 1 + kids.get(id).length); });
  moons.forEach((m, id) => { weight.set(id, m.c); size.set(id, 1); });
  const roots = [...planets.keys()].sort((x, y) => planets.get(y).c - planets.get(x).c || (x < y ? -1 : 1));
  const nest = { parent, kids, roots, weight, size, has: n => parent.has(n) };
  // link steps between sources from the centre: breadth-first over source ties
  const adj = new Map(); planets.forEach((_, id) => adj.set(id, new Set()));
  usable.forEach(L => { if (L.from.doc !== L.to.doc) { adj.get(L.from.doc).add(L.to.doc); adj.get(L.to.doc).add(L.from.doc); } });
  const dist = new Map(); const c0 = planets.has(centre) ? centre : roots[0];
  if (c0 != null) { dist.set(c0, 0); const q = [c0]; while (q.length) { const x = q.shift(); adj.get(x).forEach(y => { if (!dist.has(y)) { dist.set(y, dist.get(x) + 1); q.push(y); } }); } }
  return { nest, planets, moons, edges, dist, centre: c0 };
}

// ── source hues ─────────────────────────────────────────────────────────────────────────────────────────────────
// Six hues: the app's five accents and one more, per theme. A source keeps its hue across every surface because the
// assignment is a function of the sorted ids of the sources handed in.
export const HUES = {
  dark:  ['#8ab4ff', '#56d364', '#f0b429', '#b79cf0', '#e0a0c0', '#5fd0c4'],
  light: ['#1d4ed8', '#15803d', '#b45309', '#6d28d9', '#be185d', '#0f766e'],
};
export const DIFFERS = { dark: '#f87171', light: '#b91c1c' };
export function hueMap(docIds, theme = 'dark') {
  const pal = HUES[theme] || HUES.dark; const m = new Map();
  [...new Set(docIds)].sort().forEach((id, i) => m.set(id, pal[i % pal.length]));
  return m;
}

// ── contracts ───────────────────────────────────────────────────────────────────────────────────────────────────
// Each surface declares what it may do. Read-only surfaces declare NUL on links, so permission to write a link sits
// in Review and the Sources shelf alone. A mount hands a `write` function only to a surface for which
// canWriteLinks() is true — a surface cannot write by accident.
export const SURFACE_CONTRACTS = [
  { surface: 'Sources shelf', type: 'table',      status: 'catalog',       terrains: ['Entity', 'Kind'],                ops: ['INS', 'DEF', 'CON', 'SEG', 'REC'], notes: 'Existing drive grid and list. Adds link badge and Compare.' },
  { surface: 'Passage',       type: 'card',       status: 'catalog',       terrains: ['Entity'],                        ops: ['NUL'],                             notes: 'Side card for one span and its links.' },
  { surface: 'Reader',        type: 'reader',     status: 'catalog',       terrains: ['Field', 'Lens'],                 ops: ['NUL', 'CON', 'EVA'],               notes: 'Existing reader. Gains the link gutter.' },
  { surface: 'Graph',         type: 'graph',      status: 'catalog + REC', terrains: ['Link', 'Network', 'Entity'],     ops: ['CON', 'SYN'],                      notes: 'Orbit and cluster grain. Builds on holodeck-holons.js.' },
  { surface: 'Player',        type: 'player',     status: 'gap',           terrains: ['Entity', 'Field'],               ops: ['NUL', 'CON'],                      notes: 'Existing media player gains cue spans on the scrubber.' },
  { surface: 'Lanes',         type: 'lanes',      status: 'gap',           terrains: ['Entity', 'Link'],                ops: ['NUL', 'CON'],                      notes: 'New.' },
  { surface: 'Margin',        type: 'margin',     status: 'gap',           terrains: ['Lens', 'Link'],                  ops: ['NUL', 'CON', 'EVA'],               notes: 'New. Overview builder output could render here.' },
  { surface: 'Seam',          type: 'seam',       status: 'gap',           terrains: ['Lens'],                          ops: ['NUL', 'EVA', 'DEF'],               notes: 'New. Entry from Compare.' },
  { surface: 'Fields',        type: 'atmosphere', status: 'gap',           terrains: ['Void', 'Field', 'Atmosphere'],   ops: ['NUL', 'SIG', 'CON'],               notes: 'New. The Ground grain.' },
  { surface: 'Review',        type: 'review',     status: 'gap',           terrains: ['Link', 'Lens'],                  ops: ['EVA', 'CON', 'DEF'],               notes: 'New. The only surface that writes links besides the shelf.' },
];
export const contractOf = surface => SURFACE_CONTRACTS.find(c => c.surface.toLowerCase() === String(surface).toLowerCase()) || null;
export const canWriteLinks = surface => ['review', 'sources shelf'].includes(String(surface).toLowerCase());
