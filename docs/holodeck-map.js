// holodeck-map.js — the layered, nested name map, one engine for every place the Holodeck draws names and their ties.
// One ladder of levels: Sources (the readings and the names they share) > Names, level by level (names folded into
// holons; each step opens one more layer of groups) > Statements (what a name sits in). Zoom and pan are separate:
// they scale what is drawn, and more labels fit as you zoom in. Nesting and label placement are holodeck-holons.js:
// pure, from the ties alone, no model.
//
//   const map = mountMap(hostEl, { legend, onProfile, sentence, padBottom, wheelZoom, empty });
//   map.set({ sig?, nodes:[{ n, c, mine?, st?, color? }], edges:[{ a, b, c, mine?, neg? }], docs:[{ id, title }],
//             occ: Map(name -> [{ doc, id, t? }]), hot?: Set(name), hotPairs?: [[a, b]], odd?: Map(name -> standing), sel?: name });
//   map.destroy();
//
// `st` 'cand' or 'drop' draws a faint unlabelled dot (found, not admitted); anything else is a holon member. A `sig` that
// has not changed lets set() skip the rebuild; without one, every set() rebuilds (the replay player folds a new state per event).
// Plain wheel zooms only when `wheelZoom` is set (a full-screen map); otherwise Ctrl/Cmd+wheel or a pinch zooms and plain
// scroll still scrolls the page.
import { nestByTies, repOf, visibleHolons, rollUp, placeLabels, sourceGraph, statementsOf, levelsOf, openAtLevel } from './holodeck-holons.js';

export function mapOrigin(vis, adj, sel) {
  if (sel && vis.includes(sel)) return { name: sel, reason: 'you selected it' };
  let name = null, degree = -1; for (const n of vis) { const d = (adj.get(n) || new Set()).size; if (d > degree) { name = n; degree = d; } }
  return { name, reason: degree > 0 ? 'it has the most visible connections (shared statements)' : 'it is the first visible name; no connections are present' };
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const eKey = (a, b) => a < b ? a + '\u0001' + b : b + '\u0001' + a;
const solid = x => !!x && x.st !== 'cand' && x.st !== 'drop';

const CSS = `
.hm{position:absolute;inset:0;z-index:1;overflow:hidden;font:13px/1.45 'Hanken Grotesk',system-ui,sans-serif}
.hm *{box-sizing:border-box}
.hm canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.hm button{all:unset;cursor:pointer;color:var(--mut);font:500 13px 'Hanken Grotesk',sans-serif;padding:4px 9px}
.hm button:hover{color:var(--ink)}.hm button:focus-visible{outline:2px solid var(--acc);outline-offset:1px}.hm button[disabled]{opacity:.35;cursor:default;color:var(--mut)}
.hm-top{position:absolute;left:12px;right:12px;top:8px;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:6px 10px;flex-wrap:wrap;pointer-events:none}
.hm-position{flex:1 0 100%;color:var(--mut);font-size:12px;background:var(--s1);padding:3px 6px;border-radius:5px}
.hm-top>*{pointer-events:auto}
.hm-layers,.hm-tg{display:flex;align-items:center;gap:2px;background:var(--s1);border:1px solid var(--line);border-radius:8px;padding:2px 4px}
.hm-layers button[aria-pressed=true]{color:var(--ink);box-shadow:inset 0 -2px 0 var(--acc)}
.hm-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.hm-lv,.hm-spd{font:500 12px 'JetBrains Mono',monospace;color:var(--mut);min-width:84px;text-align:center;white-space:nowrap}
.hm-spd{min-width:40px}
.hm-card{position:absolute;left:12px;top:46px;z-index:2;width:min(380px,calc(100% - 24px));max-height:min(46%,320px);overflow:auto;background:var(--s1);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;color:var(--ink2)}
.hm-card.full{width:calc(100% - 24px);max-height:calc(100% - 64px)}
.hm-card[hidden]{display:none}
.hm-ch{color:var(--ink);margin-bottom:6px}
.hm-src{font:600 11px 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:8px 0 3px}
.hm-st{padding:5px 0;border-top:1px solid var(--line)}
.hm-wi{margin-top:3px;display:flex;flex-wrap:wrap}
.hm-mut{margin:0 0 6px;color:var(--mut)}
.hm button.hm-nm{display:inline-block;border:1px solid var(--line2);border-radius:999px;padding:1px 9px;font:500 12px 'Hanken Grotesk',sans-serif;color:var(--ink);margin:0 4px 4px 0}
.hm button.hm-nm:hover{border-color:var(--acc)}
.hm-nm i{font-style:normal;color:var(--dim);margin-left:5px}
.hm-key{position:absolute;left:12px;bottom:8px;z-index:1;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--dim);pointer-events:none}
.hm-key i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px}
`;
let styled = false;

export function mountMap(host, opts = {}) {
  if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  const root = document.createElement('div'); root.className = 'hm';
  const legend = `<div class="hm-key"><span><i style="border:1.5px dashed var(--dim)"></i>ring: holds more names, click to open</span><span><i style="background:var(--acc)"></i>a name; larger means more statements</span><span>${opts.wheelZoom ? 'scroll' : 'Ctrl + scroll'} to zoom · drag to pan · ↑ ↓ step a level</span></div>`;
  root.innerHTML = `<canvas></canvas><div class="hm-top"><div class="hm-layers" role="group" aria-label="Layer"><button type="button" data-layer="sources" title="The readings and the names they share">Sources</button><button type="button" data-layer="names" aria-pressed="true" title="Names, nested into groups that open on click">Names</button><button type="button" data-layer="statements" title="What a name sits in">Statements</button></div>` +
    `<div class="hm-tools"><span class="hm-tg" title="Zoom the picture"><button type="button" data-z="out" title="Zoom out">−</button><button type="button" data-z="in" title="Zoom in">+</button><button type="button" data-z="fit" title="Fit everything">Fit</button></span>` +
    `<span class="hm-tg" title="Move between levels of nesting"><button type="button" data-lv="up" title="Up a level: fewer, larger groups">↑</button><span class="hm-lv"></span><button type="button" data-lv="down" title="Down a level: open the groups">↓</button></span>` +
    `<span class="hm-tg" title="Orbit speed"><button type="button" data-spd="slow" title="Slower orbit">🐢</button><span class="hm-spd"></span><button type="button" data-spd="fast" title="Faster orbit">🐇</button></span></div><div class="hm-position" aria-label="Map viewpoint"></div></div><div class="hm-card" hidden></div>${opts.legend ? legend : ''}`;
  host.appendChild(root);
  const gc = root.querySelector('canvas'), cardEl = root.querySelector('.hm-card'), layersEl = root.querySelector('.hm-layers'), topEl = root.querySelector('.hm-top'), lvEl = root.querySelector('.hm-lv'); { const s = root.querySelector('.hm-spd'); if (s) s.textContent = '0.25×'; }
  const padBottom = opts.padBottom ?? 30, css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let col = {}, W = 0, H = 0, dpr = 1, topPad = 54, alive = true, raf = 0, frame = 0;
  const readCols = () => { col = { acc: css('--acc'), blue: css('--blue'), dim: css('--dim'), ink: css('--ink'), ink2: css('--ink2'), bad: css('--bad'), amber: css('--amber'), edge: css('--edge'), line2: css('--line2'), bg: css('--bg') }; };

  let D = null, sig = null, nodeMap = new Map(), adj = new Map(), docMap = new Map(), occ = new Map(), lastSel, nest0 = null, model = null;
  let selectedEdge = null;
  let layer = 'names', sel = null, level = 0, heat = 1, sigH = '', dirty = true, lastCard = '', drag = null, moved = false;
  const view = { k: 1, x: 0, y: 0 }, manual = new Map(), P = new Map(), hitsAt = [], edgeHits = [], wcache = new Map(), cc = new Map();
  const X = x => x * view.k + view.x, Y = y => y * view.k + view.y, Rz = r => Math.max(1.4, r * view.k);

  function rebuild() {
    nodeMap = new Map(D.nodes.map(x => [x.n, x])); docMap = new Map((D.docs || []).map(x => [x.id, x])); occ = D.occ || new Map(); adj = new Map();
    D.edges.forEach(E => { if (!solid(nodeMap.get(E.a)) || !solid(nodeMap.get(E.b))) return; (adj.get(E.a) || adj.set(E.a, []).get(E.a)).push(E.b); (adj.get(E.b) || adj.set(E.b, []).get(E.b)).push(E.a); });
  }

  // Names that share no more statements with any other name than chance would give are not structure; they fold into
  // one holon of their own, so the map shows how the tied names hang together instead of a scatter of loose dots.
  const VIRT = 'No strong ties', nodeOf = n => nodeMap.get(n) || (model && model.virtNode && n === VIRT ? model.virtNode : null);
  function buildModel() {
    const nodes = D.nodes.filter(solid), ids = new Set(nodes.map(x => x.n)), edges = D.edges.filter(E => ids.has(E.a) && ids.has(E.b));
    const nk = nodes.length + ':' + edges.length + ':' + nodes.reduce((s, x) => s + (x.c || 1), 0) + ':' + edges.reduce((s, E) => s + (E.c || 1), 0);
    if (!nest0 || nest0.key !== nk) {
      const tied = new Set(); edges.forEach(E => { tied.add(E.a); tied.add(E.b); });
      const iso = nodes.filter(x => !tied.has(x.n) && x.n !== VIRT), useV = iso.length > 5;
      const vNode = useV ? { n: VIRT, c: Math.max(...iso.map(x => x.c || 1)) + 1 } : null, all = edges.map(E => ({ a: E.a, b: E.b, c: E.c || 1 })).concat(useV ? iso.map(x => ({ a: VIRT, b: x.n, c: 1 })) : []);
      const nest = nestByTies(nodes.map(x => ({ n: x.n, c: x.c || 1 })).concat(vNode ? [vNode] : []), all);
      nest0 = { key: nk, nest, all, edges, names: nodes.map(x => x.n).concat(vNode ? [VIRT] : []), lv: levelsOf(nest), virtNode: vNode ? { n: VIRT, c: vNode.c, color: 'var(--dim)', virt: true } : null }; model = null;
    }
    const vk = level + '|' + [...manual].map(([n, v]) => n + (v ? '+' : '-')).join(',');
    if (model && model.vk === vk) return model;
    const N = nest0, open = openAtLevel(N.nest, level); open.delete(VIRT); manual.forEach((v, n) => { if (v) open.add(n); else open.delete(n); });
    const rep = new Map(N.names.map(n => [n, repOf(N.nest, n, open)])), agg = rollUp(N.all, rep);
    N.edges.forEach(E => { const a = rep.get(E.a), b = rep.get(E.b); if (a == null || b == null || a === b) return; const x = agg.get(eKey(a, b)); if (x) { if (E.mine) x.mine = true; if (E.neg) x.neg = true; } });
    model = { nk, vk, nest: N.nest, open, rep, agg, vis: visibleHolons(N.nest, open), virtNode: N.virtNode, max: N.lv.max }; return model;
  }
  const holonR = (M, n) => Math.min(26, 4.5 + Math.sqrt(M.nest.weight.get(n)) * 1.7);

  function nearOf(n) { let sx = 0, sy = 0, c = 0; (adj.get(n) || []).forEach(o => { const q = P.get(o); if (q) { sx += q.x; sy += q.y; c++; } }); return c ? { x: sx / c, y: sy / c } : null; }
  function posOf(x) {
    let p = P.get(x.n);
    if (!p && model) { const par = model.nest.parent.get(x.n), q = par != null && P.get(par); if (q) { const u = hash(x.n) * 6.283; p = { x: q.x + Math.cos(u) * 28, y: q.y + Math.sin(u) * 28, vx: 0, vy: 0, r: 3 }; P.set(x.n, p); } }
    if (!p && solid(x)) { const q = nearOf(x.n); if (q) { const u = hash(x.n) * 6.283; p = { x: q.x + Math.cos(u) * 18, y: q.y + Math.sin(u) * 18, vx: 0, vy: 0, r: 3 }; P.set(x.n, p); } }
    if (!p) { const u = hash(x.n), v = hash(x.n + '#'); const R = Math.min(W, H) * (solid(x) ? 0.22 : 0.44); p = { x: W / 2 + Math.cos(u * 6.283) * R * (0.6 + 0.4 * v), y: H / 2 + Math.sin(u * 6.283) * R * (0.6 + 0.4 * v), vx: 0, vy: 0, r: 3 }; P.set(x.n, p); }
    return p;
  }

  function simulate() {
    if (layer !== 'names') return;
    const M = buildModel();
    const key = M.nk + '|' + M.vk + '|' + (sel || '') + '|' + W + 'x' + H;
    if (simulate._k !== key) {
      // OHS: RELATIVISTIC solar system. Compute the layout ONCE: origin =
      // selected name else most-bonded; BFS relational distance = orbit ring.
      // Cached per (model, origin, size) so per-frame work is just the spin.
      const vis = M.vis.slice();
      const visSet = new Set(vis);
      const adj = new Map(), wadj = new Map();
      const addE = (a, b, w) => { if (a == null || b == null || a === b || !visSet.has(a) || !visSet.has(b)) return;
        if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a);
        const ww = Math.max(1, w || 1);
        if (!wadj.has(a)) wadj.set(a, new Map()); if (!wadj.has(b)) wadj.set(b, new Map());
        const ma = wadj.get(a), mb = wadj.get(b); ma.set(b, Math.max(ma.get(b) || 0, ww)); mb.set(a, Math.max(mb.get(a) || 0, ww)); };
      (D.edges || []).forEach(E => addE(E.a, E.b, E.c || (E.sts && E.sts.length)));
      if (M.agg) M.agg.forEach(E => addE(E.a, E.b, E.c));
      const center = mapOrigin(vis, adj, sel), origin = center.name;
      root.querySelector('.hm-position').textContent = origin ? 'Centered on ' + origin + ' because ' + center.reason + ' · ' + docMap.size + ' sources · distance follows shared-statement counts, not ownership or control' : 'No origin: no names have been read here.';
      topPad = topEl.offsetHeight + 16; cardEl.style.top = topPad + 'px';
      // GRAVITY: orbit radius ∝ 1/bond. Edge length is the bond's inverse
      // (scaled so the strongest bond is length 1), so a strongly-bound name
      // sits close and a weakly-bound one drifts out; Dijkstra gives the
      // cumulative relational distance that becomes the orbit ring.
      let WMAX = 1; wadj.forEach(mm => mm.forEach(w => { if (w > WMAX) WMAX = w; }));
      const dist = new Map(); vis.forEach(n => dist.set(n, Infinity)); if (origin) dist.set(origin, 0);
      const done = new Set();
      while (true) { let u = null, bd = Infinity; vis.forEach(n => { if (!done.has(n) && dist.get(n) < bd) { bd = dist.get(n); u = n; } }); if (u == null) break; done.add(u);
        (wadj.get(u) || new Map()).forEach((w, m) => { if (!done.has(m)) { const nd = dist.get(u) + WMAX / w; if (nd < dist.get(m)) dist.set(m, nd); } }); }
      const rings = new Map();
      vis.forEach(n => { const r = isFinite(dist.get(n)) ? Math.min(40, Math.max(0, Math.round(dist.get(n)))) : 99; if (!rings.has(r)) rings.set(r, []); rings.get(r).push(n); });
      const step = Math.min(W, H) * 0.12;
      const lay = new Map();
      const radii = new Set();
      rings.forEach((list, r) => {
        const radius = r === 0 ? 0 : Math.min(Math.min(W, H) * 0.46, step * r + step * 0.5);
        if (radius > 0) radii.add(Math.round(radius));
        const speed = r === 0 ? 0 : (0.22 / (1 + r * 0.45));
        list.forEach((n, i) => lay.set(n, { radius, speed, base: -Math.PI / 2 + i * 6.283 / Math.max(1, list.length) + (r % 2 ? 0.35 : 0), r: holonR(M, n) + ((M.nest.kids.get(n) || []).length ? 4 : 0) }));
      });
      simulate._lay = lay; simulate._k = key; simulate._rings = [...radii].sort((a, b) => a - b);
    }
    const cx = W / 2, cy = (H - padBottom + topPad) / 2;
    simulate._t = (simulate._t || 0) + 1;
    simulate._lay.forEach((L, n) => { const ang = L.base + simulate._t * L.speed * 0.02 * (simulate._spd || 0.25);
      const x = cx + Math.cos(ang) * L.radius, y = cy + Math.sin(ang) * L.radius;
      P.set(n, { x: Math.max(30, Math.min(W - 30, x)), y: Math.max(topPad + 14, Math.min(H - padBottom - 20, y)), vx: 0, vy: 0, ang, r: L.r }); });
  }

  const fill = x => { const c = x.color; if (!c) return x.mine ? col.acc : col.blue; if (!c.startsWith('var(')) return c; if (!cc.has(c)) cc.set(c, css(c.slice(4, -1).trim())); return cc.get(c); };
  function drawNames(g) {
    const M = buildModel(), hot = new Set([...(D.hot || [])].map(n => M.rep.get(n) || n)), odd = D.odd || new Map();
    const hotE = new Set((D.hotPairs || []).map(([a, b]) => { const x = M.rep.get(a), y = M.rep.get(b); return x && y && x !== y ? eKey(x, y) : ''; }));
    hitsAt.length = 0; edgeHits.length = 0;
    // OHS: draw the orbit rings so the relational-distance shells read as a
    // solar system (faint concentric circles around the origin).
    if (simulate._rings) { const ocx = W / 2, ocy = (H - padBottom + topPad) / 2, ox = X(ocx), oy = Y(ocy); g.save(); g.setLineDash([3, 6]); g.strokeStyle = col.line2; g.globalAlpha = 0.5; g.lineWidth = 1;
      simulate._rings.forEach(rad => { g.beginPath(); g.arc(ox, oy, Rz(rad), 0, 6.283); g.stroke(); }); g.restore(); }
    M.agg.forEach((E, key) => { const a = P.get(E.a), b = P.get(E.b); if (!a || !b) return; g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(b.x), Y(b.y));
      g.strokeStyle = E.neg ? col.bad : E.mine ? col.acc : col.edge; g.globalAlpha = hotE.has(key) ? 1 : E.mine ? 0.7 : 0.35; g.lineWidth = Math.min(5, 0.8 + Math.log2(1 + E.c)) + (hotE.has(key) ? 1.5 : 0); g.setLineDash(E.neg ? [5, 4] : []); g.stroke(); edgeHits.push({ a:E.a, b:E.b, x1:X(a.x), y1:Y(a.y), x2:X(b.x), y2:Y(b.y) }); });
    g.setLineDash([]); g.globalAlpha = 1;
    const items = [];
    D.nodes.forEach(x => { if (solid(x)) return; const p = P.get(x.n); if (!p) return; const h = hot.has(x.n);
      g.beginPath(); g.arc(X(p.x), Y(p.y), Rz(h ? 5 : 2.6), 0, 6.283); g.globalAlpha = h ? 1 : x.st === 'drop' ? 0.2 : 0.45; g.strokeStyle = h ? col.acc : col.dim; g.lineWidth = 1.2; g.stroke();
      if (h) items.push({ id: x.n, x: X(p.x), y: Y(p.y), r: Rz(5), text: x.n, pri: 1e9, force: true }); });
    g.globalAlpha = 1;
    M.vis.forEach(n => { const x = nodeOf(n), p = x && P.get(n); if (!p) return;
      const r = Rz(holonR(M, n)), sx = X(p.x), sy = Y(p.y), h = hot.has(n), nk = M.nest.kids.get(n).length, isOpen = M.open.has(n), od = odd.get(n), isoN = model.nest.parent.get(n) === VIRT, dark = n === VIRT;
      if (isoN) { g.beginPath(); g.arc(sx, sy, Math.max(1.6, r * 0.8), 0, 6.283); g.fillStyle = '#05070a'; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; return; }
      if (od === 'stands' || od === 'contested') { g.beginPath(); g.arc(sx, sy, r + 6, 0, 6.283); g.strokeStyle = col.amber; g.lineWidth = 2; g.setLineDash(od === 'contested' ? [3, 3] : []); g.stroke(); g.setLineDash([]); }
      if (nk) { g.beginPath(); g.arc(sx, sy, r + 4, 0, 6.283); g.strokeStyle = isOpen ? col.acc : col.line2; g.lineWidth = 1.5; g.setLineDash(isOpen ? [] : [3, 3]); g.stroke(); g.setLineDash([]); }
      g.beginPath(); g.arc(sx, sy, r + (h ? 2 : 0), 0, 6.283); g.fillStyle = dark ? '#05070a' : fill(x); g.fill(); if (dark) { g.strokeStyle = col.dim; g.lineWidth = 1.5; g.stroke(); } else if (h || sel === n) { g.strokeStyle = col.ink; g.lineWidth = 2; g.stroke(); }
      hitsAt.push({ id: n, x: sx, y: sy, r: Math.max(13, r + (nk ? 4 : 0)) });
      items.push({ id: n, x: sx, y: sy, r: r + (nk ? 5 : 1), text: (n.length > 24 ? n.slice(0, 23) + '…' : n) + (nk && !isOpen ? '  +' + (M.nest.size.get(n) - 1) : ''), pri: M.nest.weight.get(n), force: h || sel === n }); });
    g.font = "12px 'Hanken Grotesk', sans-serif";
    const meas = t => { let w = wcache.get(t); if (w == null) { w = g.measureText(t).width; wcache.set(t, w); } return w; };
    placeLabels(items, W, H - padBottom + 10, meas, 13, topPad - 6).forEach(L => { hitsAt.push({ id: L.id, x: L.x, y: L.y - 4, r: 11 }); g.textAlign = L.align; g.fillStyle = hot.has(L.id) || sel === L.id ? col.ink : col.ink2; g.fillText(L.text, L.x, L.y); });
    g.textAlign = 'center';
    if (!D.nodes.length) { g.fillStyle = col.dim; g.font = "13px 'Hanken Grotesk', sans-serif"; g.fillText(opts.empty || 'Names appear here as they are found.', W / 2, H / 2); }
  }
  function drawSources(g) {
    const prior = new Set(D.nodes.filter(x => x.st === 'prior' && !x.mine).map(x => x.n)), SG = sourceGraph({ docs: [...docMap.values()], occ, prior });
    const seen = SG.nodes.filter(n => n.id === 'prior' || n.c > 0); hitsAt.length = 0;
    if (!seen.length) { g.fillStyle = col.dim; g.font = "13px 'Hanken Grotesk', sans-serif"; g.fillText('Sources appear here once their statements have been read.', W / 2, H / 2); return; }
    const cx = W / 2, cy = (H - padBottom + topPad) / 2, ring = Math.min(W, H) * 0.3, spokes = seen.filter(n => n.id !== 'prior'), hub = seen.some(n => n.id === 'prior'), pos = new Map();
    if (hub) pos.set('prior', { x: cx, y: cy });
    spokes.forEach((n, i) => { const a = -Math.PI / 2 + i * 6.283 / Math.max(1, spokes.length); pos.set(n.id, !hub && spokes.length === 1 ? { x: cx, y: cy } : { x: cx + Math.cos(a) * ring * 1.4, y: cy + Math.sin(a) * ring }); });
    g.font = "12px 'Hanken Grotesk', sans-serif";
    SG.edges.forEach(E => { const a = pos.get(E.a), b = pos.get(E.b); if (!a || !b) return; g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(b.x), Y(b.y)); g.strokeStyle = col.edge; g.globalAlpha = 0.6; g.lineWidth = Math.min(8, 1 + Math.log2(1 + E.c) * 1.2); g.stroke(); g.globalAlpha = 1;
      const t = E.a === 'prior' ? 0.7 : 0.5, lx = X(a.x + (b.x - a.x) * t), ly = Y(a.y + (b.y - a.y) * t), lab = plural(E.c, 'shared name'), lw = g.measureText(lab).width + 8;
      g.fillStyle = col.bg; g.globalAlpha = 0.85; g.fillRect(lx - lw / 2, ly - 9, lw, 14); g.globalAlpha = 1; g.fillStyle = col.dim; g.textAlign = 'center'; g.fillText(lab, lx, ly + 2); });
    seen.forEach(n => { const p = pos.get(n.id), r = Rz(Math.min(46, 16 + Math.sqrt(n.c) * 3)), isP = n.id === 'prior', sx = X(p.x), sy = Y(p.y);
      g.beginPath(); g.arc(sx, sy, r, 0, 6.283); g.fillStyle = isP ? col.blue : col.acc; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; if (sel === n.id) { g.strokeStyle = col.ink; g.lineWidth = 2; g.stroke(); }
      hitsAt.push({ id: n.id, x: sx, y: sy, r });
      g.textAlign = 'center'; g.fillStyle = col.ink; g.fillText(n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label, sx, sy + r + 15); g.fillStyle = col.dim; g.fillText(isP ? plural(n.c, 'name') : plural(n.c, 'statement'), sx, sy + r + 29); });
  }
  function draw() {
    const g = gc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.globalAlpha = 1;
    if (layer === 'names') drawNames(g); else if (layer === 'sources') drawSources(g); else hitsAt.length = 0;
    g.globalAlpha = 1;
  }

  // ---------- the open holon's card ----------
  const sentenceOf = o => { const t = (opts.sentence ? opts.sentence(o) : o.t || '').replace(/\s+/g, ' ').trim(); return t.length > 240 ? t.slice(0, 239) + '…' : t; };
  const docTitle = id => (docMap.get(id) || {}).title || 'Source';
  const chipsOf = list => list.map(([n, c]) => `<button type="button" class="hm-nm" data-name="${esc(n)}">${esc(n)}${c ? `<i>${c}</i>` : ''}</button>`).join('');
  function cardHtml() {
    if (selectedEdge && layer === 'names') {
      const e = selectedEdge, witnesses = new Map();
      D.edges.filter(x => { const a = model.rep.get(x.a) || x.a, b = model.rep.get(x.b) || x.b; return eKey(a,b) === eKey(e.a,e.b); }).forEach(x => {
        const right = new Set((occ.get(x.b) || []).map(o => String(o.doc) + ':' + o.id));
        (occ.get(x.a) || []).filter(o => right.has(String(o.doc) + ':' + o.id)).forEach(o => witnesses.set(String(o.doc) + ':' + o.id, o));
      });
      return '<div class="hm-ch"><b>Why this connection exists</b></div>' + chipsOf([[e.a,0],[e.b,0]]) + '<p class="hm-mut">Names sharing statements, rolled up through the visible groups. This does not establish ownership, coordination or control.</p>' + (witnesses.size ? [...witnesses.values()].map(o => '<div class="hm-st"><div class="hm-src">' + esc(docTitle(o.doc)) + ' · statement ' + esc(o.id) + '</div>' + esc(sentenceOf(o)) + (opts.onWitness ? '<button type="button" data-witness="' + esc(String(o.doc) + ':' + o.id) + '">Open in source →</button>' : '') + '</div>').join('') : '<p class="hm-mut">No shared-statement witness is available here. This may be a grouping link; do not treat it as a sourced relation.</p>');
    }

    if (layer === 'sources') {
      if (!sel) return '';
      if (sel === 'prior') { const ns = D.nodes.filter(x => x.st === 'prior' && !x.mine).sort((a, b) => b.c - a.c).slice(0, 14).map(x => [x.n, x.c]); return `<div class="hm-ch"><b>Already in the picture</b> · names from your earlier sources</div>${chipsOf(ns)}`; }
      const d = [...docMap.values()].find(x => 'doc:' + x.id === sel), id = String(d ? d.id : sel.slice(4)), names = new Map(), sts = new Set();
      occ.forEach((list, n) => list.forEach(o => { if (String(o.doc) === id) { names.set(n, (names.get(n) || 0) + 1); sts.add(o.id); } }));
      return `<div class="hm-ch"><b>${esc(d ? d.title : 'Source')}</b> · ${plural(sts.size, 'statement')} · ${plural(names.size, 'name')}</div>${chipsOf([...names].sort((a, b) => b[1] - a[1]).slice(0, 14))}`;
    }
    if (layer === 'names') {
      if (!sel || !model || !model.nest.has(sel)) return '';
      if (model.virtNode && sel === VIRT) return `<div class="hm-ch"><b>Names with no strong tie</b> · ${plural(model.nest.size.get(VIRT) - 1, 'name')}</div><p class="hm-mut">None of these shares more statements with another name than chance would give. ${model.open.has(VIRT) ? 'They are spread out below.' : 'Click the ring to spread them out.'}</p>`;
      const sts = statementsOf(occ, sel), holds = model.nest.size.get(sel) - 1;
      return `<div class="hm-ch"><b>${esc(sel)}</b> · ${plural(sts.length, 'statement')}${holds ? ' · holds ' + plural(holds, 'more name') + (model.open.has(sel) ? ' (open)' : ' — click it to open') : ''}</div>` +
        sts.slice(0, 3).map(o => `<div class="hm-st"><div class="hm-src">${esc(docTitle(o.doc))}</div>${esc(sentenceOf(o))}</div>`).join('') +
        `<div style="margin-top:6px">${sts.length ? `<button type="button" class="hm-nm" data-layer="statements">All ${sts.length} in Statements →</button>` : '<p class="hm-mut">Its statements are not among the sources read here.</p>'}${opts.onProfile ? `<button type="button" class="hm-nm" data-profile="${esc(sel)}">Open its profile →</button>` : ''}</div>`;
    }
    if (!sel || !occ.has(sel)) { const top = [...occ].map(([n, l]) => [n, l.length]).sort((a, b) => b[1] - a[1]).slice(0, 16); return `<p class="hm-mut">Statements sit inside names. Pick a name:</p>${chipsOf(top)}`; }
    const sts = statementsOf(occ, sel), by = new Map(); sts.forEach(o => (by.get(o.doc) || by.set(o.doc, []).get(o.doc)).push(o));
    return `<div class="hm-ch"><b>${esc(sel)}</b> · ${plural(sts.length, 'statement')} in ${plural(by.size, 'source')}</div>` + [...by].map(([d, l]) => `<div class="hm-src">${esc(docTitle(d))}</div>` + l.slice(0, 60).map(o => `<div class="hm-st">${esc(sentenceOf(o))}${o.with.length ? `<div class="hm-wi">${chipsOf(o.with.slice(0, 8).map(n => [n, 0]))}</div>` : ''}</div>`).join('')).join('');
  }
  function renderCard() {
    layersEl.querySelectorAll('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
    const up = root.querySelector('[data-lv=up]'), dn = root.querySelector('[data-lv=down]'); up.disabled = layer === 'sources'; dn.disabled = layer === 'statements';
    if (D && layer === 'names') buildModel();
    lvEl.textContent = layer === 'sources' ? 'Sources' : layer === 'statements' ? 'Statements' : 'Names · ' + (level + 1) + '/' + ((model ? model.max : 0) + 1);
    const h = D ? cardHtml() : ''; cardEl.className = 'hm-card' + (layer === 'statements' ? ' full' : ''); cardEl.hidden = !h; cardEl.style.top = (topEl.offsetHeight + 16) + 'px';
    if (h !== lastCard) { lastCard = h; cardEl.innerHTML = h; }
  }

  // ---------- levels, zoom and pan ----------
  const after = () => { heat = 1; dirty = true; renderCard(); };
  const setLayer = l => { selectedEdge = null; if (l !== 'names') root.querySelector('.hm-position').textContent = docMap.size + ' sources in this map · ' + (l === 'sources' ? 'links count shared names; placement is a display arrangement' : 'statements shown for the selected name'); if ((l === 'sources') !== (layer === 'sources')) sel = null; layer = l; after(); };
  function levelDown() { if (!D) return; if (layer === 'sources') { layer = 'names'; level = 0; manual.clear(); } else if (layer === 'names') { buildModel(); if (level < model.max) { level++; manual.clear(); } else layer = 'statements'; } after(); }
  function levelUp() { if (layer === 'statements') layer = 'names'; else if (layer === 'names') { if (level > 0) { level--; manual.clear(); } else { layer = 'sources'; sel = null; } } after(); }
  function zoomAt(mx, my, f) { const nk = Math.max(0.35, Math.min(8, view.k * f)), s = nk / view.k; view.x = mx - (mx - view.x) * s; view.y = my - (my - view.y) * s; view.k = nk; dirty = true; }
  const fit = () => { view.k = 1; view.x = 0; view.y = 0; dirty = true; };
  function focusName(n) { selectedEdge = null; buildModel(); sel = n; layer = 'names'; for (let p = model.nest.parent.get(n); p != null; p = model.nest.parent.get(p)) manual.set(p, true); heat = 1; dirty = true; }
  const pick = e => { const r = gc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 1e9; hitsAt.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d <= h.r + 6 && d < bd) { best = h; bd = d; } }); return best; };
  const tipOf = h => layer === 'sources' ? (docMap.get(h.id.slice(4)) || {}).title || h.id : h.id + (model && model.nest.kids.get(h.id) && model.nest.kids.get(h.id).length ? ' — holds ' + plural(model.nest.size.get(h.id) - 1, 'more name') : '');

  gc.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; try { gc.setPointerCapture(e.pointerId); } catch (x) {} });
  gc.addEventListener('pointermove', e => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (moved || Math.hypot(dx, dy) > 4) { moved = true; view.x = drag.vx + dx; view.y = drag.vy + dy; dirty = true; gc.style.cursor = 'grabbing'; return; } }
    const h = pick(e); gc.style.cursor = h ? 'pointer' : 'grab'; gc.title = h ? tipOf(h) : ''; });
  gc.addEventListener('pointerup', () => { drag = null; });
  gc.addEventListener('click', e => { if (moved) { moved = false; return; } const h = pick(e);
    selectedEdge = null;
    if (!h && layer === 'names') { let best = null, bd = 7; edgeHits.forEach(x => { const r = gc.getBoundingClientRect(), px = e.clientX-r.left, py = e.clientY-r.top, dx=x.x2-x.x1, dy=x.y2-x.y1, t=Math.max(0,Math.min(1,((px-x.x1)*dx+(py-x.y1)*dy)/(dx*dx+dy*dy || 1))), d=Math.hypot(px-x.x1-t*dx,py-x.y1-t*dy); if (d<bd) { best=x; bd=d; } }); if (best) { selectedEdge=best; renderCard(); return; } }
    if (layer === 'names') { if (h && !h.noPick) { sel = h.id; if (model && model.nest.kids.get(h.id).length) { manual.set(h.id, !model.open.has(h.id)); heat = 1; } } else { sel = null; manual.clear(); view.k = 1; view.x = 0; view.y = 0; heat = 1; } }
    else if (layer === 'sources') sel = h ? h.id : null;
    dirty = true; renderCard(); });
  gc.addEventListener('dblclick', e => { if (!pick(e)) fit(); });
  gc.addEventListener('wheel', e => { if (!(opts.wheelZoom || e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = gc.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
  root.querySelector('.hm-tools').addEventListener('click', e => { const b = e.target.closest('[data-z],[data-lv],[data-spd]'); if (!b || b.disabled) return;
    if (b.dataset.spd) { simulate._spd = Math.min(8, Math.max(0.1, (simulate._spd || 0.5) * (b.dataset.spd === 'fast' ? 1.6 : 1 / 1.6))); const el = root.querySelector('.hm-spd'); if (el) el.textContent = (simulate._spd).toFixed(1) + '×'; return; }
    if (b.dataset.z === 'fit') fit(); else if (b.dataset.z) zoomAt(W / 2, H / 2, b.dataset.z === 'in' ? 1.35 : 1 / 1.35); else if (b.dataset.lv === 'up') levelUp(); else levelDown(); });
  layersEl.addEventListener('click', e => { const b = e.target.closest('[data-layer]'); if (b) setLayer(b.dataset.layer); });
  cardEl.addEventListener('click', e => { const w = e.target.closest('[data-witness]'); if (w) { const o = [...occ.values()].flat().find(o => String(o.doc) + ':' + o.id === w.dataset.witness); if (o && opts.onWitness) opts.onWitness(o); return; } const b = e.target.closest('[data-name],[data-layer],[data-profile]'); if (!b) return;
    if (b.dataset.profile) { opts.onProfile && opts.onProfile(b.dataset.profile); return; }
    if (b.dataset.layer) { setLayer(b.dataset.layer); return; }
    focusName(b.dataset.name); renderCard(); });

  function size() { const r = gc.getBoundingClientRect(); if (!r.width || !r.height) return; dpr = window.devicePixelRatio || 1; W = r.width; H = r.height; gc.width = W * dpr; gc.height = H * dpr; topPad = topEl.offsetHeight + 16; cardEl.style.top = topPad + 'px'; dirty = true; }
  const ro = new ResizeObserver(size); ro.observe(host);
  function loop() { if (!alive) return; if (++frame % 30 === 0) { readCols(); cc.clear(); dirty = true; }
    if (D && W && (dirty || heat > 0.01 || layer === 'names')) { simulate(); draw(); dirty = false; } raf = requestAnimationFrame(loop); }

  function set(d) {
    D = d; selectedEdge = null; if (d.sig == null || d.sig !== sig) { sig = d.sig; rebuild(); heat = Math.max(heat, 0.8); }
    if ((d.sel || null) !== lastSel) { lastSel = d.sel || null; if (lastSel && nodeMap.has(lastSel)) focusName(lastSel); }
    dirty = true; renderCard();
  }
  function destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); root.remove(); }

  readCols(); size(); renderCard(); raf = requestAnimationFrame(loop);
  return { set, destroy, el: root };
}
