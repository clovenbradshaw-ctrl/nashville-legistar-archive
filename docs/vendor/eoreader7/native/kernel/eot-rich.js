// Handle: Chomsky — deep structure is universal; each language is a projection.
// kernel/eot-rich.js — THE RICH EOT RECORD, AND THE ROUND TRIP THAT TESTS IT.
//
// A sentence enters as a Universal Dependencies annotation (any language we
// hold a treebank for) and becomes a record with TWO LAYERS:
//
//   SURFACE  — the exact bytes, in the exact order, every line kept. This is
//              provenance. It is lossless by construction and it is how
//              every later loss stays checkable (the user's standing rule:
//              the round trip is lossy, so all provenance is retained).
//
//   MEANING  — the EOT proper. Content words only, as nodes; the function
//              words a language happens to spend on case, determination,
//              tense, mood, subordination and coordination are ABSORBED as
//              cube-addressed markers on the node they serve; every relation
//              between content nodes is cube-addressed; every feature value
//              carries its cell beside its dimension and value. The meaning
//              layer holds NO WORD ORDER and NO TOKEN INDEX: node identities
//              are opaque, deliberately permuted, so nothing downstream can
//              recover the surface order by reading an id.
//
// Why absorb function words. English says "of" where Latin says genitive; the
// same relation is a separate word in one language and an ending in another.
// A meaning layer that keeps "of" as a node beside its noun is English-shaped.
// Absorbed as a marker at CON·Pattern on its nominal, it sits where the Latin
// ending's Case=Gen value also sits — one representation, two projections.
//
// THE ROUND TRIP, IN THREE LEVELS, each measured separately so a loss can be
// located:
//
//   L1 IN        Nothing is dropped on entry. Every word class, relation and
//                feature value gets a cube address (or is a declared surface
//                feature); the surface layer re-serializes to the exact
//                input bytes.
//   L2 MEANING   The full annotation — lemma, word class, features, head and
//                relation for every syntactic word — is rebuilt from the
//                MEANING layer alone, with the absorbed markers re-realized
//                as words. Forms and order are not used.
//   L3 ORDER     Word order is regenerated from the meaning layer plus the
//                language's own measured ordering parameters (which side of
//                its head each relation falls on, and how far), learned on
//                held-apart sentences. This is the projection back into SVO,
//                SOV, VSO: the part expected to be lossy, and measured.

import { addressOfFeature, addressOfRelation, addressOfUpos, splitFeature } from "./universal-grammar.js";

export const EOT_RICH_SCHEMA = "EOTRich@1";

/** Relations whose dependent is a function word the meaning layer absorbs
 *  into the node it serves. Punctuation is surface only. */
export const ABSORBED = Object.freeze(new Set(["case", "det", "aux", "cop", "mark", "cc", "clf"]));
export const SURFACE_ONLY = Object.freeze(new Set(["punct"]));

// ── CoNLL-U ─────────────────────────────────────────────────────────────────
export function parseConllu(text) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.lines.length) out.push(cur); cur = null; };
  for (const raw of String(text ?? "").split("\n")) {
    if (!raw.trim()) { flush(); continue; }
    if (!cur) cur = { lines: [], comments: [], tokens: [], multi: [], empty: [], sentId: null, text: null };
    cur.lines.push(raw);
    if (raw.startsWith("#")) {
      cur.comments.push(raw);
      const m = /^#\s*sent_id\s*=\s*(.+)$/.exec(raw); if (m) cur.sentId = m[1].trim();
      const t = /^#\s*text\s*=\s*(.+)$/.exec(raw); if (t) cur.text = t[1];
      continue;
    }
    const c = raw.split("\t");
    if (c.length !== 10) { cur.malformed = (cur.malformed ?? 0) + 1; continue; }
    if (c[0].includes("-")) { cur.multi.push({ range: c[0], form: c[1], misc: c[9] }); continue; }
    if (c[0].includes(".")) { cur.empty.push(raw); continue; }
    cur.tokens.push({ id: Number(c[0]), form: c[1], lemma: c[2], upos: c[3], xpos: c[4], feats: c[5], head: c[6] === "_" ? null : Number(c[6]), deprel: c[7], deps: c[8], misc: c[9] });
  }
  flush();
  return out;
}

const parseFeats = (s) => (!s || s === "_" ? [] : s.split("|").map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
/** UD's canonical feature order: by name, case-insensitive. */
const serializeFeats = (pairs) => (pairs.length ? [...pairs].sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()) || a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join("|") : "_");

/** A deterministic permutation, so node identities carry no order. */
function opaqueIds(n, seedText) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rand = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const ids = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.map((k) => `n${k.toString(36)}`);
}

// ── IN: annotation → rich record ────────────────────────────────────────────
export function toEot(sent, { language = null, source = null } = {}) {
  const gaps = [];
  // A MULTI-VALUED FEATURE ("Gender=Fem,Masc") is UD's way of saying a form
  // is underspecified between values. Each value is addressed on its own; the
  // literal string is kept so the record stays lossless, and the set of cells
  // it spans is kept beside it. It is a gap only if some value is unplaced.
  const typeFeats = (featStr, where) => parseFeats(featStr).map(([name, value]) => {
    const { dim, layer } = splitFeature(name);
    const parts = String(value).split(",");
    const addrs = parts.map((v) => addressOfFeature(name, v));
    const missing = parts.filter((_, i) => !addrs[i]);
    for (const v of missing) gaps.push({ kind: "feature", item: `${name}=${v}`, where });
    if (addrs.every((a) => a?.form)) return { name, dim, layer, value, form: true };
    if (missing.length) return { name, dim, layer, value, gap: true };
    const cells = [...new Set(addrs.map((a) => a.cell))];
    return { name, dim, layer, value, cell: cells[0], ...(cells.length > 1 ? { cells } : {}), ...(parts.length > 1 ? { underspecified: parts } : {}), basis: addrs[0].basis };
  });
  const tok = new Map(sent.tokens.map((t) => [t.id, t]));
  const ids = opaqueIds(sent.tokens.length, `${source ?? ""}#${sent.sentId ?? ""}`);
  const key = new Map(sent.tokens.map((t, i) => [t.id, ids[i]]));

  // Which tokens are absorbed markers, and which content node each serves.
  // A marker attached to another marker climbs to the first content ancestor.
  const isAbsorbed = (t) => ABSORBED.has(String(t.deprel).split(":")[0]);
  const isSurfaceOnly = (t) => SURFACE_ONLY.has(String(t.deprel).split(":")[0]);
  const hostOf = (t) => {
    let h = t.head; let guard = 0;
    while (h && tok.has(h) && (isAbsorbed(tok.get(h)) || isSurfaceOnly(tok.get(h))) && guard++ < 50) h = tok.get(h).head;
    return h;
  };

  const nodes = [];
  const byKey = new Map();
  for (const t of sent.tokens) {
    if (isAbsorbed(t) || isSurfaceOnly(t)) continue;
    const u = addressOfUpos(t.upos); if (!u) gaps.push({ kind: "upos", item: t.upos, where: key.get(t.id) });
    const node = { key: key.get(t.id), lemma: t.lemma, upos: t.upos, uposCell: u?.cell ?? null, feats: typeFeats(t.feats, key.get(t.id)), markers: [] };
    nodes.push(node); byKey.set(node.key, node);
  }
  const arcs = [];
  const markers = [];
  for (const t of sent.tokens) {
    const rel = addressOfRelation(t.deprel);
    if (!rel) gaps.push({ kind: "deprel", item: t.deprel, where: key.get(t.id) });
    if (isSurfaceOnly(t)) continue;
    const headKey = t.head ? key.get(t.head) : null;
    if (isAbsorbed(t)) {
      const hostKey = t.head ? key.get(hostOf(t)) : null;
      const m = { key: key.get(t.id), lemma: t.lemma, upos: t.upos, rel: t.deprel, cell: rel?.cell ?? null, feats: typeFeats(t.feats, key.get(t.id)), attachedTo: headKey };
      markers.push(m);
      const host = hostKey ? byKey.get(hostKey) : null;
      if (host) host.markers.push(m.key);
      continue;
    }
    arcs.push({ from: headKey, to: key.get(t.id), rel: t.deprel, cell: rel?.cell ?? null });
  }
  // A content word whose head is punctuation (rare, annotation noise) keeps
  // the arc as written; it is not silently rerouted.
  return {
    schema: EOT_RICH_SCHEMA,
    language, source, sentId: sent.sentId,
    surface: { lines: [...sent.lines], text: sent.text, keyOfId: Object.fromEntries(sent.tokens.map((t) => [t.id, key.get(t.id)])) },
    meaning: { nodes, markers, arcs },
    gaps,
  };
}

// ── OUT (L1): the surface layer re-serialized ──────────────────────────────
export function surfaceBytes(record) { return record.surface.lines.join("\n"); }

// ── OUT (L2): the full annotation, rebuilt from the meaning layer alone ────
/** Returns one row per syntactic word (punctuation excluded — it lives only in
 *  the surface), keyed by opaque identity: {key, lemma, upos, feats, head,
 *  deprel}. Order is not produced here; that is L3's job. */
export function annotationFromMeaning(record) {
  const rows = [];
  const featStr = (fs) => serializeFeats(fs.map((f) => [f.name, f.value]));
  for (const n of record.meaning.nodes) rows.push({ key: n.key, lemma: n.lemma, upos: n.upos, feats: featStr(n.feats), head: null, deprel: null });
  const row = new Map(rows.map((r) => [r.key, r]));
  for (const a of record.meaning.arcs) { const r = row.get(a.to); if (r) { r.head = a.from; r.deprel = a.rel; } }
  for (const m of record.meaning.markers) rows.push({ key: m.key, lemma: m.lemma, upos: m.upos, feats: featStr(m.feats), head: m.attachedTo, deprel: m.rel });
  return rows;
}

/** The gold rows the L2 rebuild is scored against, from the original
 *  annotation, keyed the same opaque way. */
export function goldRows(sent, record) {
  const key = record.surface.keyOfId;
  return sent.tokens
    .filter((t) => !SURFACE_ONLY.has(String(t.deprel).split(":")[0]))
    .map((t) => ({ key: key[t.id], lemma: t.lemma, upos: t.upos, feats: serializeFeats(parseFeats(t.feats)), head: t.head ? key[t.head] : null, deprel: t.deprel }));
}

// ── OUT (L3): order, projected from measured parameters ────────────────────
/** Learn a language's ordering parameters from annotated sentences: for each
 *  relation, how often the dependent precedes its head and its mean signed
 *  distance. This is the language's measured SVO/SOV/VSO, relation by
 *  relation — never declared, never English's. */
export function measureOrder(sents) {
  // Distances are kept PER SIDE: a relation that falls on both sides of its
  // head has a typical distance on each, and averaging them together blurs
  // exactly the sibling order the linearizer needs.
  const stat = new Map();
  for (const s of sents) {
    for (const t of s.tokens) {
      if (!t.head) continue;
      const rel = String(t.deprel).split(":")[0];
      for (const kk of [`${rel}|${t.upos}`, rel]) {
        let e = stat.get(kk); if (!e) { e = { before: 0, n: 0, left: 0, right: 0 }; stat.set(kk, e); }
        e.n++;
        if (t.id < t.head) { e.before++; e.left += t.id - t.head; } else e.right += t.id - t.head;
      }
    }
  }
  const params = {};
  for (const [k, e] of stat) {
    const after = e.n - e.before;
    params[k] = { before: e.before / e.n, meanLeft: e.before ? e.left / e.before : -1, meanRight: after ? e.right / after : 1, n: e.n };
  }
  return params;
}

/** Linearize a sentence's syntactic words from the meaning-layer tree and the
 *  measured parameters alone. Projective by construction: a head's left
 *  dependents precede it, right dependents follow, each ordered by its
 *  relation's mean distance. Returns the opaque keys in produced order. */
export function linearize(rows, params) {
  const kids = new Map();
  let root = null;
  for (const r of rows) {
    if (!r.head) { root = root ?? r.key; continue; }
    if (!kids.has(r.head)) kids.set(r.head, []);
    kids.get(r.head).push(r);
  }
  const p = (r) => params[`${String(r.deprel).split(":")[0]}|${r.upos}`] ?? params[String(r.deprel).split(":")[0]] ?? { before: 0.5, meanLeft: -1, meanRight: 1 };
  const seen = new Set();
  const place = (key) => {
    if (seen.has(key)) return [];
    seen.add(key);
    const deps = kids.get(key) ?? [];
    // Left dependents: farthest first (most negative typical distance). Right
    // dependents: nearest first.
    const left = deps.filter((d) => p(d).before >= 0.5).sort((a, b) => p(a).meanLeft - p(b).meanLeft);
    const right = deps.filter((d) => p(d).before < 0.5).sort((a, b) => p(a).meanRight - p(b).meanRight);
    return [...left.flatMap((d) => place(d.key)), key, ...right.flatMap((d) => place(d.key))];
  };
  const order = root ? place(root) : [];
  for (const r of rows) if (!seen.has(r.key)) order.push(...place(r.key)); // any unreached word, never dropped
  return order;
}

/** Kendall's tau between a produced order and the gold order (1 = identical,
 *  0 = unrelated, −1 = reversed). */
export function kendallTau(produced, gold) {
  const pos = new Map(gold.map((k, i) => [k, i]));
  const seq = produced.filter((k) => pos.has(k)).map((k) => pos.get(k));
  const n = seq.length;
  if (n < 2) return 1;
  let c = 0, d = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { if (seq[i] < seq[j]) c++; else d++; }
  return (c - d) / (c + d);
}
