// holodeck-reading.js — the local reading: the cast, bonds and encounters a source yields
// when the Holodeck reads it itself, in the exact FoldReadingIndex@2 shape the OHS ground
// reading already has. OHS's reading is folded offline from a 1.67 GB log of EOReferent /
// EOHyperedge deltas; this is the same structure derived in-tab from the vendored eoreader7
// relation reader — the same organs the engine's POST /v1/read drives — so an uploaded source
// lands as Referents and Bonds beside the corpus, not as names alone.
//
// Pure: no DOM, no navigator, no network. The relation reader is injected, so a test folds a
// hand-made report and the page injects holodeck-reader.js's makeEngineRelationReader().
//
//     const report = relationsFor(passages);   // { examined, vocabulary, edges, read }
//     const one = readDoc('u1', text, report); // one source's block + its global cast/bonds
//     const rix = mergeReadings([one], { from: 'workspace' }); // FoldReadingIndex@2-shaped
//
// Every edgeFace carries { end1, label, end2, polarity, refs } (hypergraph.js). end1/end2 are
// the reader's own earned names; label is the verb it read them under; polarity '-' is a
// negation. A bond is the unordered pair; its relation is the labels seen on it.

const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = s => clean(s).toLowerCase();
const bondKey = (a, b) => (a < b ? a + ' \u2014 ' + b : b + ' \u2014 ' + a);
const inc = (o, k, n) => { o[k] = (o[k] || 0) + (n || 1); };
// A null-prototype bag: a surface or doc id named "__proto__", "constructor" or "toString" is a
// legal key here, never the prototype accessor — so counts are kept, not silently swallowed.
const bag = () => Object.create(null);
const intoBag = src => { const o = bag(); for (const k in src) o[k] = src[k]; return o; };

/** Split a document into relation-reader passages. Paragraphs first, then long ones cut on
 *  sentence boundaries, so the vocabulary the reader measures is neither one giant blob nor a
 *  fragment per line. `max` mirrors the engine's own 60 000-character cap for the whole read. */
export function splitPassages(text, max = 2000) {
  const paras = String(text || '').split(/\n{2,}/).map(clean).filter(Boolean);
  const out = [];
  for (const p of paras) {
    if (p.length <= max) { out.push(p); continue; }
    let cur = '';
    for (const s of p.split(/(?<=[.!?])\s+/)) {
      if (cur && (cur.length + s.length + 1) > max) { out.push(cur); cur = ''; }
      cur = cur ? cur + ' ' + s : s;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : (clean(text) ? [clean(text)] : []);
}

/** How many times a surface is written in the text: whole words for a single token, a plain
 *  case-insensitive scan for a multi-word name. This is the OHS `mentions` count's local twin. */
export function countSurface(text, surface) {
  const s = clean(surface); if (!s) return 0;
  const hay = String(text || '');
  if (!/\s/.test(s)) { const m = hay.match(new RegExp('(?<![\\p{L}\\p{N}])' + esc(s) + '(?![\\p{L}\\p{N}])', 'giu')); return m ? m.length : 0; }
  const low = hay.toLowerCase(), t = s.toLowerCase(); let i = 0, n = 0;
  while ((i = low.indexOf(t, i)) >= 0) { n++; i += t.length; }
  return n;
}

/** One document's reading, from the relation reader's own report. Returns:
 *  - source:   the per-source block (`sources[name]` in the index: chunks, chars, ops, cast, bonds)
 *  - cast:     global cast rows for this source ({ id, surfaces, standing, mentions, src, first, srcN })
 *  - bonds:    global bond rows for this source ({ a, b, n, rel, pos, neg, src, first, srcN })
 *  - surfaces: the distinct earned ends, in first-seen order
 *  - encounters/chars: what the source contributed (the OHS `sources[name].chunks` / `.chars`). */
export function readDoc(name, text, report, opts = {}) {
  const standing = opts.standing || 'witnessed';
  const passages = opts.passages || 1;
  const edges = Array.isArray(report && report.edges) ? report.edges : [];
  const bySurf = new Map();   // normalized -> display surface (first seen)
  const bond = new Map();     // key -> { a, b, n, rel, pos, neg }
  const srcCast = bag();      // surface -> mentions (per-source)
  const srcBonds = bag();     // key -> count (per-source)
  const srcKinds = bag();
  for (const e of edges) {
    const a = clean(e && e.end1), b = clean(e && e.end2), label = clean(e && e.label) || '?';
    if (!a || !b || norm(a) === norm(b)) continue;
    for (const sf of [a, b]) if (!bySurf.has(norm(sf))) bySurf.set(norm(sf), sf);
    const k = bondKey(a, b);
    let B = bond.get(k);
    if (!B) { B = { a, b, n: 0, rel: bag(), pos: 0, neg: 0 }; bond.set(k, B); }
    B.n++; inc(B.rel, label); if (e && e.polarity === '-') B.neg++; else B.pos++;
    inc(srcBonds, k);
    inc(srcKinds, 'CON/' + label);
  }
  const text0 = String(text || '');
  for (const sf of bySurf.values()) inc(srcCast, sf, Math.max(1, countSurface(text0, sf)));
  const surfaces = [...bySurf.values()];
  const cast = surfaces.map(sf => { const src = bag(); inc(src, name, 1); return { id: norm(sf), surfaces: [sf], standing, mentions: srcCast[sf] || 1, src, first: name, srcN: 1 }; });
  const bonds = [...bond.values()].map(B => { const src = bag(); inc(src, name, B.n); return { ...B, src, first: name, srcN: 1 }; });
  const source = { chunks: passages, chars: text0.length, ops: intoBag({ INS: surfaces.length, CON: edges.length, REC: 0 }), terrain: bag(), kinds: srcKinds, cast: srcCast, bonds: srcBonds, idChurn: bag() };
  return { source, cast, bonds, surfaces, encounters: passages, chars: text0.length };
}

/** Fold per-source readings into a FoldReadingIndex@2-shaped object, so every consumer that
 *  already reads the OHS index (`holodeck-records.js`'s buildLog, `readingVals`'s panels) reads
 *  this one the same way. Later sources merge onto earlier ones by surface and by unordered pair. */
export function mergeReadings(readings, meta = {}) {
  const sources = bag(), kinds = bag(); const order = [];
  const cast = new Map(), bonds = new Map(); let encounters = 0, chars = 0;
  for (const r of readings) {
    if (!r) continue;
    const name = r.name; if (!name) continue;
    order.push(name); encounters += r.encounters || 0; chars += r.chars || 0;
    const prev = sources[name];
    // Every map is a null-prototype bag (bag()), so a source or surface named "__proto__" merges
    // as data, never as the prototype: a plain `sources[name]` lookup would have returned
    // Object.prototype for such a name and then thrown on `.ops`.
    if (prev) { for (const k in r.source.ops) inc(prev.ops, k, r.source.ops[k]); for (const k in r.source.cast) inc(prev.cast, k, r.source.cast[k]); for (const k in r.source.bonds) inc(prev.bonds, k, r.source.bonds[k]); for (const k in r.source.kinds) inc(prev.kinds, k, r.source.kinds[k]); prev.chunks += r.source.chunks; prev.chars += r.source.chars; }
    else sources[name] = { ...r.source, ops: intoBag(r.source.ops), cast: intoBag(r.source.cast), bonds: intoBag(r.source.bonds), kinds: intoBag(r.source.kinds) };
    for (const k in r.source.kinds) inc(kinds, k, r.source.kinds[k]);
    for (const c of r.cast) { const key = norm((c.surfaces || [c.id])[0]); let C = cast.get(key); if (!C) { C = { id: c.id, surfaces: [], standing: c.standing, mentions: 0, src: bag(), first: c.first, regions: [], roles: bag() }; cast.set(key, C); } for (const s of c.surfaces) if (!C.surfaces.includes(s)) C.surfaces.push(s); C.mentions = Math.max(C.mentions, c.mentions || 0); C.standing = c.standing || C.standing; inc(C.src, name, 1); for (const rg of c.regions || []) if (!C.regions.some(x => x.join(',') === rg.join(','))) C.regions.push(rg); for (const k in c.roles || {}) inc(C.roles, k, c.roles[k]); }
    for (const b of r.bonds) { const key = bondKey(b.aKey || b.a, b.bKey || b.b); let B = bonds.get(key); if (!B) { B = { a: b.a, b: b.b, aKey: b.aKey || b.a, bKey: b.bKey || b.b, n: 0, rel: bag(), pos: 0, neg: 0, src: bag(), first: b.first }; bonds.set(key, B); } B.n += b.n; for (const k in b.rel) inc(B.rel, k, b.rel[k]); B.pos += b.pos; B.neg += b.neg; inc(B.src, name, b.n); }
  }
  const castArr = [...cast.values()].map(c => ({ ...c, srcN: Object.keys(c.src).length })).sort((a, b) => b.mentions * 10 + b.srcN - (a.mentions * 10 + a.srcN));
  const bondArr = [...bonds.values()].map(b => ({ ...b, srcN: Object.keys(b.src).length })).sort((a, b) => b.n + 3 * b.srcN - (a.n + 3 * a.srcN));
  return { schema: 'FoldReadingIndex@2', from: meta.from || 'workspace (read in this tab)', builtAt: meta.builtAt || new Date().toISOString(), ms: meta.ms || 0, lines: 0, bad: 0,
    encounters, order, sources, kinds, castTotal: castArr.length, cast: castArr, bondsTotal: bondArr.length, bonds: bondArr, canonTotal: 0, canon: [], identitiesTotal: 0, identities: [] };
}

const STOP_W = new Set(('the a an and or of to in on for with at by from as is are was were be been being ' +
  'will would should could may might can this that these those it its their his her they them we our you ' +
  'your i not no new every per than then also into over under about after before during each which who whom ' +
  'what when where while there here has have had do does did said says last first next more most some any ' +
  'all other such only just very since until because through across between within without upon ' +
  'product docs contact learn more privacy terms sign log in out home about').split(' '));

/** Name runs in a box's text (length-preserving): a run is a name phrase, not a clause or a lone
 *  stop word. Used for the screen reading, where the OCR box is the unit, not a sentence. */
export function nameRuns(text) {
  const out = [];
  const re = /\b[\p{Lu}][\p{L}\p{N}'\u2019\u2010-]*(?:[\s\u2010-]+[\p{Lu}][\p{L}\p{N}'\u2019\u2010-]*)*/gu;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const run = m[0], words = run.split(/\s+/);
    if (words.length === 1 && (STOP_W.has(run.toLowerCase()) || run.length < 2)) continue;
    if (words.every(w => STOP_W.has(w.toLowerCase()))) continue;
    out.push(run);
  }
  return out;
}

/** A `readDoc`-shaped reading for an image, from its measured 2D model (`elements` with
 *  region [x,y,w,h] and role). Names legible in a box become referents standing `sighted`, each
 *  carrying its regions; two names co-held in one box become a bond. This is what makes an image
 *  answer "what is where" — the placement text cannot give. */
export function readSighted(name, elements, meta = {}) {
  const casting = new Map();     // norm(name) -> { id, surfaces, standing, mentions, src, regions, roles }
  const bond = new Map();
  const srcCast = bag(), srcBonds = bag(), srcKinds = bag();
  let edges = 0;
  for (const e of elements || []) {
    const text = clean(e.text); if (!text) continue;
    const here = [];
    for (const run of nameRuns(text).slice(0, 6)) {
      const key = norm(run); let C = casting.get(key);
      if (!C) { C = { id: key, surfaces: [run], standing: meta.standing || 'sighted', mentions: 0, src: bag(), regions: [], roles: bag() }; casting.set(key, C); }
      if (!C.surfaces.includes(run)) C.surfaces.push(run);
      C.mentions++; inc(C.src, name, 1); inc(C.roles, e.role || '?');
      if (Array.isArray(e.region) && !C.regions.some(r => r.join(',') === e.region.join(','))) C.regions.push(e.region);
      inc(srcCast, run, 1); here.push(key);
    }
    inc(srcKinds, 'CON/' + (e.role || '?'));
    const uniq = [...new Set(here)];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      const k = bondKey(uniq[i], uniq[j]); let B = bond.get(k);
      if (!B) { B = { a: uniq[i], b: uniq[j], n: 0, rel: bag(), pos: 0, neg: 0, src: bag() }; bond.set(k, B); }
      B.n++; inc(B.rel, e.role || '?'); B.pos++; inc(B.src, name, 1); edges++; inc(srcBonds, k);
    }
  }
  const surfaces = [...casting.values()].map(c => ({ ...c, regions: c.regions, roles: c.roles, srcN: Object.keys(c.src).length }));
  const cast = surfaces.map(c => ({ ...c, first: name }));
  const bonds = [...bond.values()].map(B => {
    const key = bondKey(B.a, B.b); const A = casting.get(B.a), Bb = casting.get(B.b);
    return { a: (A && A.surfaces[0]) || B.a, b: (Bb && Bb.surfaces[0]) || B.b, aKey: B.a, bKey: B.b, n: B.n, rel: B.rel, pos: B.pos, neg: B.neg, src: B.src, first: name, srcN: Object.keys(B.src).length };
  });
  const source = { chunks: 1, chars: clean(meta.readingText || '').length || (elements || []).length, ops: intoBag({ INS: cast.length, CON: edges, REC: 0 }), terrain: bag(), kinds: srcKinds, cast: srcCast, bonds: srcBonds, idChurn: bag(), sighted: true, elements: (elements || []).length, geometry: (elements || []).map(e => ({ id: e.id, parent: e.parent, role: e.role, region: e.region, text: e.text || null })) };
  return { name, source, cast, bonds, encounters: 1, chars: source.chars, surfaces: cast.map(c => c.surfaces[0]) };
}

/** Read a whole workspace in one call: docs = [{ id, title, text }], relationsFor = the
 *  reader. Skips a doc with no text. Caps the whole read at `cap` characters like the engine. */
export function readWorkspace(docs, relationsFor, opts = {}) {
  const cap = opts.cap || 60000;
  const out = [];
  for (const d of docs) {
    const text = String((d && d.text) || '').slice(0, cap);
    if (!text.trim()) continue;
    let report = { edges: [] };
    try { report = relationsFor(splitPassages(text).map(t => ({ ref: d.id, text: t }))) || report; } catch (e) { report = { edges: [] }; }
    const r = readDoc(opts.nameOf ? opts.nameOf(d) : (d.id || d.title), text, report, { passages: splitPassages(text).length, standing: opts.standing });
    out.push({ name: opts.nameOf ? opts.nameOf(d) : (d.id || d.title), ...r });
  }
  return mergeReadings(out, { from: opts.from, builtAt: opts.builtAt, ms: opts.ms });
}

export { bondKey };
