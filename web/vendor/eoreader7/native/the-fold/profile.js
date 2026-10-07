// profile.js — WHAT A STATEMENT IS ABOUT AND WHAT IT DOES, READ OFF THE CUBE
// (2026-09-21). Every EOTRich address the parser attaches (a node's upos
// cell, each feature's cell, each relation's cell, each absorbed marker and
// its features) is an operator·grain pair, and `cellOf` (kernel/cube.js)
// maps it to one of nine TERRAINS (domain × grain: what it is about) and one
// of nine STANCES (mode × grain: what it does). A statement's profile is its
// addresses counted on both faces.
//
// Raw counts are grammar: nouns and verbs put Entity and Binding everywhere.
// So each address is weighted by its SURPRISAL in this source — −log of its
// class's share among all the source's addresses — and a statement's LEAN is
// its weighted share minus the source's weighted share. A rare act (Clearing,
// 1% of the OHS addresses) then counts for what it is. Measured, never tuned.
//
// Plan: plans/generation-terrain-stance.md, step 1.

import { cellOf } from "../kernel/cube.js";
import { drawnParts } from "./eot-draft.js";

export const PROFILE_SCHEMA = "EOStatementProfile@1";

/** Every cube address in one EOTRich record. */
export function addressesOf(record) {
  const m = record?.meaning;
  if (!m) return [];
  const out = [];
  const feats = (fs) => { for (const f of fs ?? []) if (f.cell) out.push(f.cell); };
  for (const n of m.nodes ?? []) { if (n.uposCell) out.push(n.uposCell); feats(n.feats); }
  for (const a of m.arcs ?? []) if (a.cell) out.push(a.cell);
  for (const k of m.markers ?? []) { if (k.cell) out.push(k.cell); feats(k.feats); }
  return out;
}

const faces = (addr) => {
  const [op, grain] = String(addr).split("·");
  try { const c = cellOf(op, grain); return c?.terrain ? { terrain: c.terrain, stance: c.stance } : null; } catch { return null; }
};

const tally = (addrs) => {
  const t = new Map(), s = new Map();
  for (const a of addrs) { const f = faces(a); if (!f) continue; t.set(f.terrain, (t.get(f.terrain) ?? 0) + 1); s.set(f.stance, (s.get(f.stance) ?? 0) + 1); }
  return { t, s };
};

const shares = (m) => { const n = [...m.values()].reduce((a, b) => a + b, 0) || 1; return new Map([...m].map(([k, v]) => [k, v / n])); };

/**
 * profileStatements(draft) → { schema, baseline: {terrain, stance}, byId: Map(id → profile) }
 * profile: { terrain: {lean: {k: v}, top}, stance: {lean: {k: v}, top}, addresses }
 * A statement with no parse has no profile (stated, never guessed).
 */
export function profileStatements(draft) {
  const points = drawnParts(draft).flatMap((p) => p.children ?? []);
  const lp = leanProfiles(points.map((pt) => ({ id: pt.id, addresses: (pt.eot ?? []).flatMap(addressesOf) })));
  return { schema: PROFILE_SCHEMA, baseline: lp.baseline, byId: lp.byId, unparsed: points.filter((pt) => !lp.byId.has(pt.id)).map((pt) => pt.id) };
}

/**
 * leanProfiles(items) — the shared act: items are { id, addresses: [cell] };
 * the baseline is THIS collection's own share of each terrain and stance, so
 * a lean is always relative to the material it was read in, never to a
 * standing table. Returns { baseline, byId: Map(id → { terrain, stance,
 * addresses }) }. Used by profileStatements (a draft's statements) and by
 * arc.js (a read unit's elements).
 */
export function leanProfiles(items) {
  const per = new Map();
  const all = { t: new Map(), s: new Map() };
  for (const it of items) {
    const addrs = it.addresses ?? [];
    if (!addrs.length) continue;
    const c = tally(addrs);
    per.set(it.id, { c, n: addrs.length });
    for (const [k, v] of c.t) all.t.set(k, (all.t.get(k) ?? 0) + v);
    for (const [k, v] of c.s) all.s.set(k, (all.s.get(k) ?? 0) + v);
  }
  const base = { t: shares(all.t), s: shares(all.s) };
  const surprisal = { t: new Map([...base.t].map(([k, p]) => [k, -Math.log(p)])), s: new Map([...base.s].map(([k, p]) => [k, -Math.log(p)])) };
  const weighted = (m, w) => { const x = new Map([...m].map(([k, v]) => [k, v * (w.get(k) ?? 0)])); return shares(x); };
  const baseW = { t: weighted(all.t, surprisal.t), s: weighted(all.s, surprisal.s) };
  const lean = (m, face) => {
    const ws = weighted(m, surprisal[face]);
    const out = {};
    for (const k of new Set([...baseW[face].keys(), ...ws.keys()])) out[k] = (ws.get(k) ?? 0) - (baseW[face].get(k) ?? 0);
    const top = Object.entries(out).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { lean: out, top };
  };
  const byId = new Map();
  for (const [id, { c, n }] of per) byId.set(id, { terrain: lean(c.t, "t"), stance: lean(c.s, "s"), addresses: n });
  return { baseline: { terrain: Object.fromEntries(base.t), stance: Object.fromEntries(base.s) }, byId };
}
