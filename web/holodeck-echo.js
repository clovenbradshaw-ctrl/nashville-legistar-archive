// holodeck-echo.js — which claims from different sources say nearly the same thing.
// Each claim is an exact sparse vector of its words (and names), no hashing. Two claims echo when their cosine
// A claim lists another as an echo when their cosine beats the largest cosine THAT CLAIM reaches to any other
// source when the same words are shuffled across the claims, over `draws` seeded shuffles. The shuffle keeps each
// claim's word count, so a short claim (which matches anything by chance) earns a higher floor than a long one, and
// the chance that a claim's list is spurious is about 1/(draws+1). The floor comes from that null; no chosen constant.
//   items: [{ doc, terms: Map(term -> weight) }]
//   returns { pairs: [{ a, b, sim, ab, ba }] (a < b; ab: b is an echo of a; ba: a is an echo of b), floors: Float32Array
//             (per item), floor (the lowest of them), maxima: [per-draw largest cosine of any pair] }

(function (root) {
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

function unit(terms) {
  let n = 0; terms.forEach(w => { n += w * w; });
  n = Math.sqrt(n) || 1; const out = new Map(); terms.forEach((w, t) => out.set(t, w / n)); return out;
}

// Accumulate the cosine of every cross-document pair through an inverted index; fills rowMax with each item's largest
// cosine to any other source (cells only grow while accumulating, so the running maximum is the final one) and returns
// the largest cosine of any pair.
function accumulate(vecs, docs, acc, rowMax) {
  const N = vecs.length, post = new Map();
  vecs.forEach((v, i) => v.forEach((w, t) => { let l = post.get(t); if (!l) post.set(t, l = []); l.push(i, w); }));
  acc.fill(0); rowMax.fill(0); let max = 0;
  post.forEach(l => {
    for (let x = 0; x < l.length; x += 2) for (let y = x + 2; y < l.length; y += 2) {
      let i = l[x], j = l[y]; if (docs[i] === docs[j]) continue; if (i > j) { const k = i; i = j; j = k; }
      const s = (acc[i * N + j] += l[x + 1] * l[y + 1]); if (s > max) max = s; if (s > rowMax[i]) rowMax[i] = s; if (s > rowMax[j]) rowMax[j] = s;
    }
  });
  return max;
}

function echoPairs(items, { draws = 19, seed = 20260930 } = {}) {
  const N = items.length; if (N < 2) return { pairs: [], floors: new Float32Array(N), floor: 1, maxima: [] };
  const docs = items.map(x => x.doc), real = items.map(x => unit(x.terms));
  const acc = new Float32Array(N * N), rowMax = new Float32Array(N), floors = new Float32Array(N);
  const flat = []; const counts = items.map((x, i) => { let c = 0; x.terms.forEach((w, t) => { flat.push([t, w]); c++; }); return c; });
  const rnd = mulberry32(seed), maxima = [];
  for (let d = 0; d < draws; d++) {
    for (let i = flat.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = flat[i]; flat[i] = flat[j]; flat[j] = t; }
    let p = 0; const vs = counts.map(c => { const m = new Map(); for (let k = 0; k < c; k++, p++) m.set(flat[p][0], (m.get(flat[p][0]) || 0) + flat[p][1]); return unit(m); });
    maxima.push(accumulate(vs, docs, acc, rowMax)); for (let i = 0; i < N; i++) if (rowMax[i] > floors[i]) floors[i] = rowMax[i];
  }
  accumulate(real, docs, acc, rowMax);
  const pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const s = acc[i * N + j], ab = s > floors[i], ba = s > floors[j]; if (ab || ba) pairs.push({ a: i, b: j, sim: s, ab, ba }); }
  let floor = Infinity; for (let i = 0; i < N; i++) if (floors[i] < floor) floor = floors[i];
  return { pairs, floors, floor, maxima };
}

  const api = { echoPairs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HDEcho = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
