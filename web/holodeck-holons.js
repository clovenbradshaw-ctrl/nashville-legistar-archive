// holodeck-holons.js — the nesting behind the replay map. Pure and model-free: plain data in, plain data out.
// A name's parent is the strongest-tied neighbour that outranks it, so the weightiest names are roots and every
// lighter name nests under what it is most tied to. Rank is a strict total order (count, then name), so the
// result is always an acyclic forest. A holon is "open" when its members are drawn instead of a single circle.

export const outranks = (a, b) => a.c > b.c || (a.c === b.c && a.n < b.n);

export function nestByTies(nodes, edges) {
  const byN = new Map(nodes.map(x => [x.n, { n: x.n, c: x.c || 1 }]));
  const best = new Map();
  const bump = (v, u, w) => {
    const V = byN.get(v), U = byN.get(u); if (!V || !U || !outranks(U, V)) return;
    const b = best.get(v); if (!b || w > b.w || (w === b.w && outranks(U, byN.get(b.u)))) best.set(v, { u, w });
  };
  edges.forEach(E => { const w = E.c || 1; bump(E.a, E.b, w); bump(E.b, E.a, w); });
  const parent = new Map(), kids = new Map([...byN.keys()].map(n => [n, []]));
  byN.forEach((x, n) => { const b = best.get(n); parent.set(n, b ? b.u : null); if (b) kids.get(b.u).push(n); });
  const weight = new Map([...byN].map(([n, x]) => [n, x.c])), size = new Map([...byN.keys()].map(n => [n, 1]));
  [...byN.values()].sort((a, b) => (outranks(a, b) ? 1 : -1)).forEach(x => { const p = parent.get(x.n); if (p !== null) { weight.set(p, weight.get(p) + weight.get(x.n)); size.set(p, size.get(p) + size.get(x.n)); } });
  kids.forEach(list => list.sort((a, b) => weight.get(b) - weight.get(a) || (a < b ? -1 : 1)));
  const roots = [...byN.values()].filter(x => parent.get(x.n) === null).sort((a, b) => (outranks(a, b) ? -1 : 1)).map(x => x.n);
  return { parent, kids, roots, weight, size, has: n => byN.has(n) };
}

// The visible holon that stands for `v`: walk down from the root while the holon is open.
export function repOf(nest, v, open) {
  const chain = []; for (let x = v; x != null; x = nest.parent.get(x)) chain.push(x);
  let i = chain.length - 1; while (i > 0 && open.has(chain[i])) i--;
  return chain[i];
}

export function visibleHolons(nest, open) {
  const out = []; const walk = n => { out.push(n); if (open.has(n)) nest.kids.get(n).forEach(walk); };
  nest.roots.forEach(walk); return out;
}

// Ties between two holons are the sum of the ties between their members; ties inside one holon vanish.
export function rollUp(edges, rep) {
  const m = new Map();
  edges.forEach(E => {
    const a = rep.get(E.a), b = rep.get(E.b); if (a == null || b == null || a === b) return;
    const key = a < b ? a + '\u0001' + b : b + '\u0001' + a; const x = m.get(key) || { a, b, c: 0, n: 0 };
    x.c += E.c || 1; x.n++; m.set(key, x);
  });
  return m;
}

// Levels: a holon's depth is how many parents sit above it. Opening "to level L" opens every holon shallower than L,
// so level 0 shows the roots and the deepest level shows every name; each step is one more layer of groups.
export function depthsOf(nest) {
  const d = new Map();
  nest.parent.forEach((_, n) => {
    if (d.has(n)) return; const chain = []; let x = n; while (x != null && !d.has(x)) { chain.push(x); x = nest.parent.get(x); }
    let base = x == null ? -1 : d.get(x); for (let i = chain.length - 1; i >= 0; i--) d.set(chain[i], ++base);
  });
  return d;
}
export function levelsOf(nest) { const depth = depthsOf(nest); let max = 0; nest.kids.forEach((ks, n) => { if (ks.length) max = Math.max(max, depth.get(n) + 1); }); return { depth, max }; }
export function openAtLevel(nest, L) { const d = depthsOf(nest), s = new Set(); nest.kids.forEach((ks, n) => { if (ks.length && d.get(n) < L) s.add(n); }); return s; }

const hits = (r, q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h;

// Greedy, highest priority first: a label is kept only if one of four spots is free of every kept label and of
// every node circle. Nothing is ever moved or shrunk, so what survives is always readable; the rest stay on
// hover (each item's `text` is the tooltip's job).
export function placeLabels(items, W, H, measure, lineH = 13, top = 4) {
  const nodes = items.map(it => ({ x: it.x - it.r, y: it.y - it.r, w: 2 * it.r, h: 2 * it.r, id: it.id }));
  const kept = [], out = [];
  [...items].sort((a, b) => (b.force ? 1 : 0) - (a.force ? 1 : 0) || b.pri - a.pri).forEach(it => {
    const w = measure(it.text), t = 2;
    const spots = [
      { x: it.x - w / 2, y: it.y + it.r + t, align: 'center' }, { x: it.x - w / 2, y: it.y - it.r - t - lineH, align: 'center' },
      { x: it.x + it.r + t, y: it.y - lineH / 2, align: 'left' }, { x: it.x - it.r - t - w, y: it.y - lineH / 2, align: 'right' }];
    for (const s of spots) {
      const box = { x: s.x, y: s.y, w, h: lineH };
      if (box.x < 4 || box.y < top || box.x + w > W - 4 || box.y + lineH > H - 4) continue;
      if (kept.some(k => hits(box, k)) || nodes.some(q => q.id !== it.id && hits(box, q))) continue;
      kept.push(box); out.push({ id: it.id, text: it.text, x: s.align === 'center' ? it.x : s.align === 'left' ? s.x : s.x + w, y: box.y + lineH - 3, align: s.align, box }); break;
    }
  });
  return out;
}

// Sources layer: each source the trace read is a holon, plus one for the picture that was already here.
// `occ` is name → [{doc, id}] (statement occurrences); `prior` is the set of names that came from earlier sources.
export function sourceGraph({ docs, occ, prior }) {
  const byDoc = new Map(docs.map(d => [d.id, { names: new Set(), sts: new Set() }]));
  occ.forEach((list, name) => list.forEach(o => { const d = byDoc.get(o.doc); if (d) { d.names.add(name); d.sts.add(o.id); } }));
  const nodes = docs.map(d => ({ id: 'doc:' + d.id, doc: d.id, label: d.title, c: byDoc.get(d.id).sts.size, names: byDoc.get(d.id).names })), edges = [];
  if (prior && prior.size) nodes.unshift({ id: 'prior', doc: null, label: 'Already in the picture', c: prior.size, names: prior });
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    let k = 0; nodes[i].names.forEach(n => { if (nodes[j].names.has(n)) k++; }); if (k) edges.push({ a: nodes[i].id, b: nodes[j].id, c: k });
  }
  return { nodes, edges };
}

// Statements layer: the statements a name sits in, grouped by source, each with the other names in the same statement.
export function statementsOf(occ, name) {
  const mine = occ.get(name) || [], keys = new Set(mine.map(o => o.doc + ':' + o.id)), cols = new Map();
  occ.forEach((list, n) => { if (n === name) return; list.forEach(o => { const k = o.doc + ':' + o.id; if (keys.has(k)) (cols.get(k) || cols.set(k, new Set()).get(k)).add(n); }); });
  return mine.map(o => ({ ...o, with: [...(cols.get(o.doc + ':' + o.id) || [])] }));
}
