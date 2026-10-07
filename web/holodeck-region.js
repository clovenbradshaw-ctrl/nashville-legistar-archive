// holodeck-region.js — the regional null: what is NORMAL here, measured, never assumed.
//
// "What's normal" depends on where you stand. A capitalised "Contractor" is normal inside a contract that defines it
// and odd in a news story; "Label:" lines are a form's furniture; template sentences are normal among our own media
// descriptions and rare among council minutes. So every question of the form "is this usual?" is asked against a
// REGION, and the region's extent is itself measured, following eoreader7's standing rule (nul/index.js; the
// hop-bounded referent universe): expand outward hop by hop and stop where the next hop out can no longer be told
// apart from this one.
//
// The ladder, innermost first:  this document -> documents of the same kind -> the workspace -> eoreader7's English prior.
// At each hop the region is compared with the next region out by a null built from that outer region: DRAWS samples of
// the same size, drawn without replacement. The region is its own normal only when it is more extreme than EVERY draw
// (the finest rank sayable is 1/DRAWS). Otherwise, at this size, it is indistinguishable from the wider region, so we
// expand and use the wider region's larger sample. A quantile floor q can only be stated by a region holding at least
// 1/q values; a smaller region has to expand. Every answer names the hop that defined normal and the walk that got there.
//
// Pure: seeded from the question's own key, so the same material always gives the same answer. No clock, no I/O.
(function (root) {
  const DRAWS = 199; // declared, not defaulted: 1/DRAWS is the resolution of "more extreme than chance"
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const quantile = (v, q) => { const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };

  // RATES. ladder: [{ name, k, n }] innermost first; k of n occurrences have the property (e.g. written capitalised).
  function normalRate(ladder, { key = '', draws = DRAWS } = {}) {
    const walk = [], L = ladder.filter(r => r && r.n > 0);
    for (let i = 0; i < L.length; i++) {
      const cur = L[i], parent = L.slice(i + 1).find(p => p.n > cur.n);
      if (!parent) { walk.push({ name: cur.name, k: cur.k, n: cur.n, verdict: 'outermost with data' }); return { rate: cur.k / cur.n, hop: cur.name, walk }; }
      const r = rng(hash(key + '|' + cur.name + '|' + parent.name)); let lo = Infinity, hi = -Infinity;
      // exact sampling without replacement for small regions; above 200 draws per sample, the hypergeometric's normal
      // approximation (same mean and variance), which is accurate at that size and keeps a workspace-wide walk fast
      const p = parent.k / parent.n, sd = Math.sqrt(cur.n * p * (1 - p) * (parent.n - cur.n) / Math.max(1, parent.n - 1));
      for (let d = 0; d < draws; d++) { let x = 0;
        if (cur.n <= 200) { let K = parent.k, N = parent.n; for (let j = 0; j < cur.n; j++) { if (r() < K / N) { x++; K--; } N--; } }
        else { const z = Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r()); x = Math.max(0, Math.min(cur.n, Math.round(cur.n * p + sd * z))); }
        if (x < lo) lo = x; if (x > hi) hi = x; }
      if (cur.k < lo || cur.k > hi) { walk.push({ name: cur.name, k: cur.k, n: cur.n, verdict: 'its own normal: outside all ' + draws + ' draws from ' + parent.name + ' (' + lo + '–' + hi + ' of ' + cur.n + ')' }); return { rate: cur.k / cur.n, hop: cur.name, walk }; }
      walk.push({ name: cur.name, k: cur.k, n: cur.n, verdict: 'indistinguishable from ' + parent.name + ' at this size (draws ' + lo + '–' + hi + '), so expand' });
    }
    return { rate: null, hop: null, walk };
  }

  // FLOORS. ladder: [{ name, values: number[] }] innermost first. Returns the q-quantile of the innermost region that both
  // differs from its parent (median outside every same-size draw's median) and holds enough values to state q.
  function normalQuantile(ladder, q, { key = '', draws = DRAWS } = {}) {
    const walk = [], L = ladder.filter(r => r && r.values && r.values.length), need = Math.ceil(1 / q);
    for (let i = 0; i < L.length; i++) {
      const cur = L[i], n = cur.values.length, parent = L.slice(i + 1).find(p => p.values.length > n);
      if (n < need) { walk.push({ name: cur.name, n, verdict: 'too few values (' + n + ') to state a ' + Math.round(q * 100) + 'th-percentile floor; expand' }); continue; }
      if (!parent) { walk.push({ name: cur.name, n, verdict: 'outermost with data' }); return { floor: quantile(cur.values, q), hop: cur.name, walk }; }
      const r = rng(hash(key + '|' + cur.name + '|' + parent.name)), med = quantile(cur.values, 0.5); let lo = Infinity, hi = -Infinity;
      for (let d = 0; d < draws; d++) { const pool = parent.values.slice(), s = []; for (let j = 0; j < n; j++) { const t = Math.floor(r() * pool.length); s.push(pool[t]); pool[t] = pool[pool.length - 1]; pool.pop(); } const m = quantile(s, 0.5); if (m < lo) lo = m; if (m > hi) hi = m; }
      if (med < lo || med > hi) { walk.push({ name: cur.name, n, verdict: 'its own normal: median outside all ' + draws + ' draws from ' + parent.name }); return { floor: quantile(cur.values, q), hop: cur.name, walk }; }
      walk.push({ name: cur.name, n, verdict: 'indistinguishable from ' + parent.name + ', so expand' });
    }
    return { floor: null, hop: null, walk };
  }

  const API = { DRAWS, normalRate, normalQuantile, quantile };
  root.HDRegion = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
