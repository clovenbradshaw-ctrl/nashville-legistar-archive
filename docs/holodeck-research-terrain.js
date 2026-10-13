// holodeck-research-terrain.js — the terrain pass: a set of read sources laid out by the nine registers, per source and
// for the corpus. Pure: no DOM, no network, no model. Same input, same terrain (every null is seeded from `key`).
//
// The nine registers are the lineage's vocabulary (Void · Entity · Kind / Field · Link · Network / Atmosphere · Lens ·
// Paradigm). They live HERE and in the docs; the surface says them in plain words (CELLS[x].plain — the Holodeck's own
// Sources / Names / Types / Figures / Statements / Connections / Framing / Views / Patterns). The Holodeck's split is
// kept: six registers are SEEN — each its own section — and three are SEEING — frame-level filters over the others,
// never a section of their own:
//
//   SEEN    void (sources and what is missing) · entity (who/what) · kind (what sort) · field (figures) ·
//           link (what each source says) · network (what is tied to what)
//   SEEING  atmosphere (how firmly it is said) · lens (slice by source / year / site) · paradigm (what recurs
//           across sources, and what breaks it)
//
// Provenance: every row carries `at: [{ doc, id, s, e }]` — the source and the character span of the statement it
// stands on. A row with no span is not emitted. A gap is a typed row ({ kind, why }), never a blank.
//
// Nothing is hand-set: a tie between two referents is kept only when their shared statements exceed EVERY one of
// DRAWS same-size random overlaps; an echo only when a pair's wording overlaps more than any of DRAWS random
// cross-source pairs; a source-to-source tie only when their shared earned referents exceed every random draw.
//
// Input (the "reading shape" — what index.html's analyze() already holds, or holodeck-research-read.js's readSource):
//   docs: [{ id, title, url?, via?, kind?, year?, found?:[scope] }]
//   sts : [{ id, doc, s, e, text, names:[surface], figs:[{raw,value,unit}], dates:[{raw,year}], frame }]
//   types?: { [surface]: 'person'|'organisation'|'place'|… }      (the page's induced kinds, when it has them)
//   gaps? : [{ kind, url?, title?, why }]                         (from the run record: unread / turned away / off-topic)

import { DRAWS, rng, hash32, stemsOf } from './holodeck-research-null.js';
import { referentKey } from './holodeck-research-read.js';

export const SCHEMA = 'HolodeckResearchTerrain@1';

export const CELLS = Object.freeze({
  void:       { terrain: 'Void',       plain: 'Sources',     ask: 'What’s in the record, and what’s missing?', seen: true },
  entity:     { terrain: 'Entity',     plain: 'Names',       ask: 'Who and where is mentioned?',                seen: true },
  kind:       { terrain: 'Kind',       plain: 'Types',       ask: 'What sorts of things and statements?',       seen: true },
  field:      { terrain: 'Field',      plain: 'Figures',     ask: 'What is measured or counted?',               seen: true },
  link:       { terrain: 'Link',       plain: 'Statements',  ask: 'What exactly does each source say?',         seen: true },
  network:    { terrain: 'Network',    plain: 'Connections', ask: 'Which names appear together?',               seen: true },
  atmosphere: { terrain: 'Atmosphere', plain: 'Framing',     ask: 'Fact, quote, plan, or guess?',               seen: false },
  lens:       { terrain: 'Lens',       plain: 'Views',       ask: 'Slice it by time, topic or source',          seen: false },
  paradigm:   { terrain: 'Paradigm',   plain: 'Patterns',    ask: 'What recurs across sources, and what breaks it?', seen: false },
});
export const SEEN = Object.freeze(Object.keys(CELLS).filter(k => CELLS[k].seen));
export const SEEING = Object.freeze(Object.keys(CELLS).filter(k => !CELLS[k].seen));

const FRAMES = ['fact', 'attributed', 'plan', 'uncertain'];
const addr = st => ({ doc: st.doc, id: st.id, s: st.s, e: st.e });
const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

/** Overlap of two random subsets of sizes na, nb from a universe of N, DRAWS times: the highest overlap chance gave. */
function overlapNullMax(na, nb, N, r, draws = DRAWS) {
  if (na <= 0 || nb <= 0 || N <= 0) return 0;
  na = Math.min(na, N); nb = Math.min(nb, N);
  let hi = 0;
  for (let d = 0; d < draws; d++) {
    let K = na, M = N, x = 0;   // choose nb items one by one; each lands in A with probability K/M (hypergeometric)
    for (let j = 0; j < nb; j++) { if (r() < K / M) { x++; K--; } M--; }
    if (x > hi) hi = x;
  }
  return hi;
}

export function terrainOf(input, { key = '' } = {}) {
  const docs = (input.docs || []).map(d => ({ ...d }));
  const sts = (input.sts || []).filter(st => st && st.doc != null && Number.isFinite(st.s) && Number.isFinite(st.e));
  const docById = new Map(docs.map(d => [d.id, d]));
  const r = rng(hash32(SCHEMA + '|' + key + '|' + sts.length));
  const types = input.types || {};

  // ── referents: key -> { name, docs:Set, sts:[st] } ────────────────────────────────────────────────────────────
  const ref = new Map();
  const surfaceVotes = new Map();
  for (const st of sts) {
    const seenHere = new Set();
    for (const n of st.names || []) {
      const k = referentKey(n); if (!k || seenHere.has(k)) continue; seenHere.add(k);
      let x = ref.get(k); if (!x) ref.set(k, x = { key: k, docs: new Set(), sts: [] });
      x.docs.add(st.doc); x.sts.push(st);
      const v = surfaceVotes.get(k) || surfaceVotes.set(k, new Map()).get(k); bump(v, n);
    }
  }
  for (const [k, x] of ref) { const v = [...surfaceVotes.get(k)].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); x.name = v[0][0]; }
  const earnedKeys = new Set([...ref].filter(([, x]) => x.docs.size >= 2).map(([k]) => k));

  // ── entity ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const entityRows = [...ref.values()].map(x => ({
    name: x.name, key: x.key, standing: x.docs.size >= 2 ? 'earned' : 'heard once', sources: [...x.docs].sort(), statements: x.sts.length,
    at: x.sts.slice(0, 50).map(st => { const i = (st.text || '').indexOf(x.name); const a = addr(st); return i >= 0 ? { ...a, s: st.s + i, e: st.s + i + x.name.length, st: st.id } : { ...a, st: st.id }; }),
  })).sort((a, b) => (b.sources.length - a.sources.length) || (b.statements - a.statements) || (a.name < b.name ? -1 : 1));

  // ── kind ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const kindOf = name => types[name] || (/^[\p{Lu}\p{N}.&-]{2,}$/u.test(name) ? 'acronym' : /\s/.test(name) ? 'multi-word name' : 'single-word name');
  const kindMap = new Map();
  for (const e of entityRows) { const k = kindOf(e.name); const x = kindMap.get(k) || kindMap.set(k, { kind: k, n: 0, examples: [] }).get(k); x.n++; if (x.examples.length < 5) x.examples.push(e.name); }
  const stKinds = new Map(); for (const st of sts) bump(stKinds, st.frame || 'fact');
  const kindRows = [...kindMap.values()].sort((a, b) => b.n - a.n || (a.kind < b.kind ? -1 : 1));

  // ── field: figures by unit ─────────────────────────────────────────────────────────────────────────────────────
  const units = new Map();
  for (const st of sts) for (const f of st.figs || []) {
    const u = f.unit || f.label || '?'; const x = units.get(u) || units.set(u, { unit: u, values: new Map() }).get(u);
    const vk = String(f.value); const v = x.values.get(vk) || x.values.set(vk, { raw: f.raw, value: f.value, docs: new Set(), at: [] }).get(vk);
    v.docs.add(st.doc); if (v.at.length < 20) v.at.push({ ...addr(st), raw: f.raw });
  }
  const fieldRows = [...units.values()].map(x => {
    const vals = [...x.values.values()].map(v => ({ raw: v.raw, value: v.value, sources: [...v.docs].sort(), at: v.at })).sort((a, b) => b.sources.length - a.sources.length || a.value - b.value);
    const bySource = new Set(vals.flatMap(v => v.sources));
    return { unit: x.unit, values: vals, sources: [...bySource].sort(), witnessedTwice: vals.filter(v => v.sources.length >= 2).length, differs: bySource.size >= 2 && vals.length >= 2 && !vals.some(v => v.sources.length === bySource.size) };
  }).sort((a, b) => b.sources.length - a.sources.length || b.values.length - a.values.length || (a.unit < b.unit ? -1 : 1));

  // ── link: statements, and which are said again elsewhere (echoes) ──────────────────────────────────────────────
  const stems = new Map(sts.map(st => [st.id, new Set(stemsOf(st.text).filter(w => w.length >= 3))]));
  const jac = (a, b) => { if (!a.size || !b.size) return 0; let k = 0; const [s, l] = a.size < b.size ? [a, b] : [b, a]; s.forEach(x => { if (l.has(x)) k++; }); return k / (a.size + b.size - k); };
  const byDoc = new Map(); for (const st of sts) (byDoc.get(st.doc) || byDoc.set(st.doc, []).get(st.doc)).push(st);
  // null: two statements of THESE sizes whose stems are drawn at random from the corpus's own words (function words at
  // their natural rate), DRAWS times; a pair is an echo only when its wording overlaps more than any draw did
  const bag = []; for (const st of sts) for (const w of stemsOf(st.text)) if (w.length >= 3) bag.push(w);
  const echoNullCache = new Map();
  const echoNull = (na, nb) => {
    const k = Math.min(na, nb) + ':' + Math.max(na, nb); let hi = echoNullCache.get(k);
    if (hi === undefined) {
      hi = 0; if (bag.length) for (let d = 0; d < DRAWS; d++) {
        const A = new Set(), B = new Set();
        for (let g = 0; A.size < Math.min(na, bag.length) && g < na * 8; g++) A.add(bag[Math.floor(r() * bag.length)]);
        for (let g = 0; B.size < Math.min(nb, bag.length) && g < nb * 8; g++) B.add(bag[Math.floor(r() * bag.length)]);
        const j = jac(A, B); if (j > hi) hi = j;
      }
      echoNullCache.set(k, hi);
    }
    return hi;
  };
  let echoFloor = 0;   // the highest null any tested pair had to beat (reported)
  const echoes = []; const echoOf = new Map();
  // The page hands over the Holodeck's own echoes (analyze() already measures them against a shuffled null); then
  // none are recomputed here. Without them this module measures its own, against the null above.
  const given = input.echoes || null, stById = new Map(sts.map(st => [st.id, st]));
  if (given) {
    const seenPair = new Set();
    for (const [id, list] of Object.entries(given)) { const a = stById.get(id); if (!a) continue;
      for (const o of list) { const b = stById.get(o.id); if (!b || a.doc === b.doc) continue;
        const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id; if (seenPair.has(k)) continue; seenPair.add(k);
        echoes.push({ a: addr(a), b: addr(b), sim: +(+o.sim || 0).toFixed(3), nullMax: null, via: null });
        (echoOf.get(a.id) || echoOf.set(a.id, []).get(a.id)).push(b); (echoOf.get(b.id) || echoOf.set(b.id, []).get(b.id)).push(a); } }
  }
  if (!given) { const seenPair = new Set();
    for (const x of ref.values()) { if (x.docs.size < 2) continue;
      for (let i = 0; i < x.sts.length; i++) for (let j = i + 1; j < x.sts.length; j++) {
        const a = x.sts[i], b = x.sts[j]; if (a.doc === b.doc) continue;
        const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id; if (seenPair.has(k)) continue; seenPair.add(k);
        const sa = stems.get(a.id), sb = stems.get(b.id); if (!sa || !sb || sa.size < 4 || sb.size < 4) continue;
        const sim = jac(sa, sb), hi = echoNull(sa.size, sb.size); if (hi > echoFloor) echoFloor = hi;
        if (sim > hi) { echoes.push({ a: addr(a), b: addr(b), sim: +sim.toFixed(3), nullMax: +hi.toFixed(3), via: x.name }); (echoOf.get(a.id) || echoOf.set(a.id, []).get(a.id)).push(b); (echoOf.get(b.id) || echoOf.set(b.id, []).get(b.id)).push(a); } } } }
  echoes.sort((a, b) => b.sim - a.sim);
  const linkRows = sts.map(st => ({ ...addr(st), text: st.text, names: (st.names || []).slice(0, 12), frame: st.frame || 'fact', echoedIn: [...new Set((echoOf.get(st.id) || []).map(o => o.doc))] }));

  // ── network: ties kept only when they beat every random overlap AND two independent sources witness them ────────
  // Only names several sources say can form a tie worth drawing (a name heard once cannot be tied by two witnesses),
  // so pairs are formed among those alone — which is also what keeps this tractable on a corpus of thousands of statements.
  const N = sts.length, tieNullCache = new Map();
  const pairs = new Map();
  for (const st of sts) {
    const ks = [...new Set((st.names || []).map(referentKey).filter(k => k && ref.has(k) && ref.get(k).docs.size >= 2))].slice(0, 24);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = ks[i] < ks[j] ? ks[i] : ks[j], b = ks[i] < ks[j] ? ks[j] : ks[i]; const k = a + '\u0001' + b; const x = pairs.get(k) || pairs.set(k, { a, b, sts: [], docs: new Set() }).get(k); x.sts.push(st); x.docs.add(st.doc); }
  }
  const edges = [];
  let tiesBeatingChance = 0;
  for (const x of pairs.values()) {
    const na = ref.get(x.a).sts.length, nb = ref.get(x.b).sts.length, k = x.sts.length;
    const ck = Math.min(na, nb) + ':' + Math.max(na, nb); let hi = tieNullCache.get(ck);
    if (hi === undefined) { hi = overlapNullMax(na, nb, N, r); tieNullCache.set(ck, hi); }
    if (k > hi) { tiesBeatingChance++; if (x.docs.size >= 2) edges.push({ a: ref.get(x.a).name, b: ref.get(x.b).name, k, nullMax: hi, witnesses: x.docs.size, at: x.sts.slice(0, 12).map(addr) }); }
  }
  edges.sort((p, q) => q.k - p.k || (p.a < q.a ? -1 : 1));
  const networkNodes = new Set(); edges.forEach(e => { networkNodes.add(e.a); networkNodes.add(e.b); });

  // ── atmosphere (SEEING): how firmly each thing is said ────────────────────────────────────────────────────────
  const frameIds = Object.fromEntries(FRAMES.map(f => [f, []]));
  for (const st of sts) (frameIds[st.frame] || (frameIds[st.frame] = [])).push(st.id);
  const frameBySource = {};
  for (const [d, list] of byDoc) { const c = Object.fromEntries(FRAMES.map(f => [f, 0])); for (const st of list) c[st.frame || 'fact'] = (c[st.frame || 'fact'] || 0) + 1; frameBySource[d] = c; }

  // ── lens (SEEING): slices ───────────────────────────────────────────────────────────────────────────────────────
  const years = new Map(); for (const st of sts) for (const dt of st.dates || []) if (dt.year) { const y = years.get(dt.year) || years.set(dt.year, new Set()).get(dt.year); y.add(st.id); }
  const hosts = new Map(); for (const d of docs) { const h = hostOf(d.url); if (h) (hosts.get(h) || hosts.set(h, []).get(h)).push(d.id); }
  const lens = {
    bySource: docs.map(d => ({ doc: d.id, title: d.title, statements: (byDoc.get(d.id) || []).length })),
    byYear: [...years].sort((a, b) => a[0] - b[0]).map(([y, ids]) => ({ year: y, statements: [...ids] })),
    bySite: [...hosts].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)).map(([h, ids]) => ({ site: h, docs: ids })),
    byLane: Object.entries(docs.reduce((o, d) => { for (const s of d.found || []) (o[s] = o[s] || []).push(d.id); return o; }, {})).map(([lane, ids]) => ({ lane, docs: [...new Set(ids)] })),
  };

  // ── paradigm (SEEING): which sources hold the same ground, and what breaks it ───────────────────────────────────
  const ties = []; const parent = new Map(docs.map(d => [d.id, d.id]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const allRefs = new Map(docs.map(d => [d.id, new Set([...ref.values()].filter(x => x.docs.has(d.id)).map(x => x.key))]));
  // null: two sources of these sizes, each naming referents drawn at random from the corpus WEIGHTED BY how many
  // sources witness them (a name everyone says shares by chance), DRAWS times
  const uni = [...ref.keys()].sort(), cum = []; { let t = 0; for (const k of uni) cum.push(t += ref.get(k).docs.size); }
  const totW = cum.length ? cum[cum.length - 1] : 0;
  const pickRef = () => { const x = r() * totW; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] > x) hi = m; else lo = m + 1; } return uni[lo]; };
  const drawSet = n => { const out = new Set(); for (let g = 0; out.size < Math.min(n, uni.length) && g < n * 40 + 40; g++) out.add(pickRef()); return out; };
  const nullCache = new Map();
  for (let i = 0; i < docs.length; i++) for (let j = i + 1; j < docs.length; j++) {
    const A = allRefs.get(docs[i].id), B = allRefs.get(docs[j].id); let k = 0; A.forEach(x => { if (B.has(x)) k++; });
    if (!k) continue;
    const ck = Math.min(A.size, B.size) + ':' + Math.max(A.size, B.size); let hi = nullCache.get(ck);
    if (hi === undefined) {
      hi = 0; for (let d = 0; d < DRAWS; d++) { const X = drawSet(A.size), Y = drawSet(B.size); let o = 0; X.forEach(x => { if (Y.has(x)) o++; }); if (o > hi) hi = o; }
      nullCache.set(ck, hi);
    }
    if (k > hi) { ties.push({ a: docs[i].id, b: docs[j].id, shared: k, nullMax: hi }); parent.set(find(docs[i].id), find(docs[j].id)); }
  }
  const groups = new Map(); for (const d of docs) { const g = find(d.id); (groups.get(g) || groups.set(g, []).get(g)).push(d.id); }
  const sharedBy = ids => { const c = new Map(); ids.forEach(d => (allRefs.get(d) || new Set()).forEach(k => bump(c, k))); return [...c].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5).map(([k]) => ref.get(k).name); };
  const paradigmGroups = [...groups.values()].filter(g => g.length >= 2).map(ids => ({ docs: ids.sort(), shared: sharedBy(ids), label: sharedBy(ids).slice(0, 3).join(' · ') })).sort((a, b) => b.docs.length - a.docs.length);
  const stray = docs.filter(d => ![...groups.values()].some(g => g.length >= 2 && g.includes(d.id))).map(d => d.id);
  const breaks = [
    ...fieldRows.filter(f => f.differs).map(f => ({ kind: 'figures differ', unit: f.unit, values: f.values.slice(0, 6).map(v => ({ raw: v.raw, sources: v.sources, at: v.at.slice(0, 2) })) })),
  ];
  const paradigm = { groups: paradigmGroups, stray, ties, recurs: echoes.slice(0, 20), echoFloor: +echoFloor.toFixed(3), breaks };

  // ── void: what is in the record, and what is not ──────────────────────────────────────────────────────────────
  const gaps = (input.gaps || []).map(g => ({ kind: g.kind, url: g.url || null, title: g.title || null, why: g.why }));
  const voidCell = {
    sources: docs.map(d => ({ doc: d.id, title: d.title, url: d.url || null, via: d.via || null, found: d.found || [], statements: (byDoc.get(d.id) || []).length, referents: allRefs.get(d.id).size })),
    statements: sts.length, referents: ref.size, earned: earnedKeys.size, heardOnce: ref.size - earnedKeys.size, gaps,
    notices: [
      ...(ref.size && !earnedKeys.size ? [{ kind: 'no-corroboration', why: 'no name is witnessed by two sources, so nothing here has earned standing yet' }] : []),
      ...(docs.length === 1 ? [{ kind: 'single-source', why: 'one source: agreement, disagreement and recurrence cannot be measured' }] : []),
    ],
  };

  // ── per source ──────────────────────────────────────────────────────────────────────────────────────────────────
  const perSource = {};
  for (const d of docs) {
    const mine = byDoc.get(d.id) || [];
    const myRefs = [...ref.values()].filter(x => x.docs.has(d.id));
    const here = myRefs.map(x => ({ name: x.name, key: x.key, standing: x.docs.size >= 2 ? 'earned' : 'only here', also: [...x.docs].filter(o => o !== d.id).sort(), at: x.sts.filter(s => s.doc === d.id).slice(0, 8).map(addr) }))
      .sort((a, b) => (b.also.length - a.also.length) || (a.name < b.name ? -1 : 1));
    perSource[d.id] = {
      doc: d.id, title: d.title, url: d.url || null, via: d.via || null,
      statements: mine.length, referents: myRefs.length, earned: here.filter(x => x.standing === 'earned').length, onlyHere: here.filter(x => x.standing === 'only here').length,
      names: here, figures: fieldRows.map(f => ({ unit: f.unit, values: f.values.filter(v => v.sources.includes(d.id)).map(v => ({ raw: v.raw, value: v.value, also: v.sources.filter(o => o !== d.id), at: v.at.filter(a => a.doc === d.id).slice(0, 3) })), differs: f.differs })).filter(f => f.values.length),
      frames: frameBySource[d.id] || Object.fromEntries(FRAMES.map(f => [f, 0])),
      echoedElsewhere: mine.filter(st => echoOf.has(st.id)).map(st => ({ ...addr(st), in: [...new Set(echoOf.get(st.id).map(o => o.doc))] })),
      group: paradigmGroups.findIndex(g => g.docs.includes(d.id)),
    };
  }

  return {
    schema: SCHEMA, key, counts: { sources: docs.length, statements: sts.length, referents: ref.size, earned: earnedKeys.size, ties: edges.length, echoes: echoes.length },
    seen: {
      void: voidCell,
      entity: { rows: entityRows },
      kind: { kinds: kindRows, statements: Object.fromEntries([...stKinds]) },
      field: { units: fieldRows },
      link: { statements: linkRows, echoes },
      network: { edges, nodes: [...networkNodes].sort(), draws: DRAWS, beatChance: tiesBeatingChance, earned: edges.length },
    },
    seeing: { atmosphere: { frames: frameIds, bySource: frameBySource }, lens, paradigm },
    perSource, gaps,
  };
}

/** The reading shape from a run record's sources, using holodeck-research-read.js's parse (for node and tests; the page
 *  builds the same shape from the Holodeck's own analysis). Statement ids are `<source id>:<n>`. */
export function readingOf(run, parse) {
  const docs = [], sts = [];
  for (const s of run.sources || []) {
    docs.push({ id: s.id, title: s.title, url: s.url, via: s.via, found: [...new Set((s.found || []).map(f => f.scope))] });
    const p = parse(s.text);
    p.sts.forEach((st, i) => sts.push({ id: s.id + ':' + i, doc: s.id, s: st.s, e: st.e, text: st.text, names: st.names, figs: st.figs, dates: st.dates, frame: st.frame }));
  }
  const gaps = (run.gaps || []).filter(g => g.kind === 'unread' || g.kind === 'turned-away' || g.kind === 'off-topic-when-read' || g.kind === 'not-prose');
  return { docs, sts, gaps };
}

/** The reading shape from the Holodeck's own analysis (index.html's analyze() result `A`): its docs, its statements
 *  (page furniture — `st.ref` — left out, as the Holodeck's own views leave it), its induced name kinds and its
 *  echoes. This is what the research view lays out, so a row's id is the id the reader and the side panel already use.
 *  `docIds` is the set of sources the research run ingested. Pure: A is read, never written. */
export function readingOfAnalysis(A, docIds, gaps = []) {
  const keep = new Set(docIds);
  const docs = (A.docs || []).filter(d => keep.has(d.id)).map(d => ({ id: d.id, title: d.title, url: d.url || null, via: (d.research && d.research.via) || null, year: d.year || null, kind: d.type || null, found: (d.research && d.research.found) || [] }));
  const sts = (A.sts || []).filter(st => keep.has(st.doc) && !st.ref).map(st => ({ id: st.id, doc: st.doc, s: st.s, e: st.e, text: st.text, names: st.names || [], figs: st.figs || [], dates: st.dates || [], frame: st.frame || 'fact' }));
  const ids = new Set(sts.map(st => st.id));
  const types = {}; for (const n of Object.values(A.names || {})) if (n && n.name) types[n.name] = n.type;
  const echoes = {}; for (const [id, list] of Object.entries(A.echoes || {})) if (ids.has(id)) { const l = (list || []).filter(o => ids.has(o.id)); if (l.length) echoes[id] = l; }
  return { docs, sts, types, echoes, gaps };
}
