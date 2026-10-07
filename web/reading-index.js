// reading-index.js — PURE truth→lens fold: FoldReadingIndex@2 derived from a ground-reading
// JSONL (the log). No navigator, no worker, no OPFS — just lines in, index out. The worker
// imports this; the falsification harness replays the same code against the raw truth to prove
// the lens agrees with the log it was folded from. The log is the truth; the index is a view.
//
// The fold is a LEFT FOLD over lines, so it is cacheable the way an append-only log wants:
//   state = foldLines(newState, head)          // a cached fold (checkpoint)
//   state = foldLines(state, tail)             // the log appended; fold only the tail
//   index = projectIndex(state)                // rank/trim into the lens
// and  projectIndex(foldLines(state, head+tail)) ≡ projectIndex(foldLines(foldLines(s, head), tail)).
// falsify.truth.mjs asserts exactly that invariant — a cached fold equals a full replay.
const inc = (o, k, n) => { o[k] = (o[k] || 0) + (n || 1); };

export function newFoldState() {
  return { cur: null, seq: 0, bad: 0, src: {}, cast: new Map(), bonds: new Map(), canon: new Map(), ids: new Map(), kinds: {}, order: [] };
}

/**
 * Fold lines into an existing fold state (mutating, in place). Deterministic in its counts;
 * arrival order only affects `first`/`firstSeq`/`order`, never the tallies.
 */
export function foldLines(state, lines) {
  const { src, cast, bonds, canon, ids, kinds, order } = state;
  const S = s => src[s] || (src[s] = { chunks: 0, chars: 0, ops: {}, terrain: {}, kinds: {}, cast: {}, bonds: {}, idChurn: {} });
  for (const l of lines) {
    if (!l) continue;
    let j; try { j = JSON.parse(l); } catch (x) { state.bad++; continue; }
    if (j.schema === 'Encounter@1') { state.cur = j.source; state.seq++; const X = S(state.cur); X.chunks++; X.chars += j.extent || 0; if (!order.includes(state.cur)) order.push(state.cur); continue; }
    if (j.schema !== 'DeltaFold@1' || !state.cur) continue;
    const X = S(state.cur);
    for (const o of j.operations || []) { const c = o.consequence || {}; const k = o.operator + '/' + (c.kind || '?'); inc(kinds, k); inc(X.kinds, k); inc(X.ops, o.operator); inc(X.terrain, o.terrain);
      const v = o.payload && o.payload.value;
      if (v && v.schema === 'EOReferent@1') { const id = v.id; let R = cast.get(id); if (!R) { R = { id, surfaces: [], standing: v.standing, mentions: 0, src: {}, first: state.cur, firstSeq: state.seq }; cast.set(id, R); } (v.surfaces || []).forEach(s => { if (!R.surfaces.includes(s)) R.surfaces.push(s); }); R.mentions = Math.max(R.mentions, v.mentions || 0); R.standing = v.standing || R.standing; inc(R.src, state.cur); inc(X.cast, (v.surfaces || [id])[0]); }
      else if (v && v.schema === 'EOHyperedge@1') { const P = (v.participants || []).map(p => p.surface || p.surfaceKey || '?'); if (P.length < 2) continue; const key = P.slice(0, 2).sort().join(' — '); let B = bonds.get(key); if (!B) { B = { a: P[0], b: P[1], n: 0, rel: {}, pos: 0, neg: 0, src: {}, first: state.cur, firstSeq: state.seq }; bonds.set(key, B); } B.n++; inc(B.rel, v.relation || '?'); if ((v.meta && v.meta.polarity) === '-') B.neg++; else B.pos++; inc(B.src, state.cur); inc(X.bonds, key); }
      else if (v && v.schema === 'EOCanonicalHyperedge@1') { const P = (v.participants || []).map(p => p.value); if (P.length < 2) continue; const key = P.slice(0, 2).sort().join(' — '); let B = canon.get(key); if (!B) { B = { a: P[0], b: P[1], n: 0, alts: {}, src: {} }; canon.set(key, B); } B.n++; (v.participants || []).forEach(p => (p.alternatives || []).forEach(a => { if (a !== p.value) inc(B.alts, a); })); inc(B.src, state.cur); }
      else if (v && v.schema === 'EOIdentityAlternative@1') { const key = v.left + ' ↔ ' + v.right; let I = ids.get(key); if (!I) { I = { left: v.left, right: v.right, n: 0, events: {}, src: {} }; ids.set(key, I); } I.n++; inc(I.events, c.kind || v.standing || '?'); inc(I.src, state.cur); inc(X.idChurn, key); }
      else if (c.kind === 'identity_split' || c.kind === 'identity_reading_refused' || c.kind === 'identity_hypothesis_supported') { const key = c.identity || (o.inputs || []).join(' ↔ '); let I = ids.get(key); if (!I) { I = { left: (o.inputs || [])[0] || key, right: (o.inputs || [])[1] || '', n: 0, events: {}, src: {} }; ids.set(key, I); } I.n++; inc(I.events, c.kind); inc(I.src, state.cur); inc(X.idChurn, key); }
    }
  }
  return state;
}

/**
 * Project a folded state into the lens: rank the global rows, trim the per-source maps,
 * attach metadata. This is the cacheable OUTPUT — the state itself is the checkpoint.
 */
export function projectIndex(state, url, cur2, t0, lineCount) {
  if (state.bad) throw new Error(state.bad + ' of ' + lineCount + ' lines failed to parse.');
  const { src, cast, bonds, canon, ids, kinds, order } = state;
  const top = (m, n, sc) => [...m.values()].sort((a, b) => sc(b) - sc(a)).slice(0, n).map(x => ({ ...x, srcN: Object.keys(x.src || {}).length }));
  const trim = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25));
  // Projection is derived, never destructive: the per-source maps are trimmed into NEW
  // objects so the folded state (the checkpoint) keeps its full tallies for the next tail.
  const sources = {};
  for (const [name, X] of Object.entries(src)) sources[name] = { ...X, cast: trim(X.cast), bonds: trim(X.bonds), idChurn: trim(X.idChurn) };
  return { schema: 'FoldReadingIndex@2', from: url, cursor: cur2, builtAt: new Date().toISOString(), ms: Date.now() - t0, lines: lineCount, bad: state.bad, encounters: state.seq, order, sources, kinds,
    castTotal: cast.size, cast: top(cast, 3000, x => x.mentions * 10 + Object.keys(x.src).length),
    bondsTotal: bonds.size, bonds: top(bonds, 3000, x => x.n + 3 * Object.keys(x.src).length),
    canonTotal: canon.size, canon: top(canon, 1500, x => x.n),
    identitiesTotal: ids.size, identities: top(ids, 1500, x => x.n) };
}

/**
 * Fold the raw reading lines into the compact index. Deterministic in its counts; arrival
 * order only affects `first`/`firstSeq`/`order`, never the tallies.
 */
export function buildIndex(lines, url, cur2, t0) {
  return projectIndex(foldLines(newFoldState(), lines), url, cur2, t0, lines.length);
}

export { inc };