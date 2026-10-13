// holodeck-paragraphs.js — a transcript's paragraphs and sections, cut where something CHANGES by more than chance.
//
// A recognizer hands back a stream of short segments. Breaking it every N seconds of pause or every N characters
// (the rule this replaces: gap > 1.5 s, length > 520) puts a break where the clock or the ruler says, not where the
// talk turns. A break belongs where the vocabulary turns by more than a shuffled transcript would turn it: "a
// difference that makes a difference".
//
//   unit        a sentence (segments joined until one ends a sentence, so a break never falls inside one) at level 1,
//               a paragraph at level 2 (sections).
//   window      the units on each side of a gap that together reach W tokens, W = sqrt(total tokens): the scale is
//               the transcript's own size, not a number chosen here.
//   similarity  s(gap) = cosine(left window, right window), tokens weighted by idf in bits over the units.
//   depth       how far s at a gap sits below the mean of s over the gaps within one window either side. A valley
//               is a change; a lone low value in jagged data is not.
//   null        the same depth after shuffling the order of the units (fixed seed). A shuffled transcript has jagged
//               s and no plateaus, so its valleys are shallow; each draw's DEEPEST valley is kept.
//   keep        a gap is a break when its depth exceeds the deepest valley of every one of DRAWS shuffles, at any of
//               three window scales (W, 2W, 4W): a transcript with no change in it is cut about 3 times in DRAWS+1,
//               and the level is named by the draws and the scales, not chosen.
//   also        a change of kind in the sound itself (applause, music — the sound map) is a break; that is passed
//               in as times, and nothing here decides what counts as a different sound.
//
// Pure and model-free: text in, break positions out. Sections run the same test on the paragraphs.

export const DRAWS = 60;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu;
const toks = (t) => (String(t || '').toLowerCase().match(WORD) || []).map((w) => w.replace(/['’]s$/, '')).filter((w) => w.length >= 2);

function lcg(seed) { let x = (seed >>> 0) || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }
function shuffled(n, rnd) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// depth of each valley of a similarity sequence: how far s at a gap sits below the mean of s over the gaps within
// `win` tokens on each side (only where a full window exists on both) (`gapMass[g]` is the tokens between gap g-1 and gap g). A mean, not a climb to the nearest
// peak: inside a subject s is jagged, and a climb stops at the first dip and calls a ripple a plateau.
function depthsOf(s, gapMass, win) {
  const out = new Array(s.length);
  for (let g = 0; g < s.length; g++) {
    // a valley needs a full window of evidence on BOTH sides; at the ends there is only one side, and doubling it
    // would hand a shuffled transcript its deepest "valleys" there
    let m = 0, sl = 0, nl = 0; for (let i = g - 1; i >= 0 && m < win; i--) { m += gapMass[i + 1]; sl += s[i]; nl++; }
    const left = m >= win && nl > 0;
    m = 0; let sr = 0, nr = 0; for (let i = g + 1; i < s.length && m < win; i++) { m += gapMass[i]; sr += s[i]; nr++; }
    const right = m >= win && nr > 0;
    out[g] = left && right ? (sl / nl - s[g]) + (sr / nr - s[g]) : 0;
  }
  return out;
}

// Gaps (between unit i and i+1) that are a valley deeper than any shuffled order's deepest valley, at any of three
// window scales (W, 2W, 4W tokens: a change shows at the scale of the thing that changed, and a short subject needs a
// short window). Each scale is held against its own shuffles, so the union is wrong about as often as the number of
// scales over DRAWS+1; two cuts within one W of tokens are one change, kept at the stronger.
// `bags` is one Map(token -> count) per unit, in order. Returns { cuts: Set<gapIndex>, W, scales, T }.
export function cutsOf(bags, { draws = DRAWS, seed = 1 } = {}) {
  const n = bags.length;
  if (n < 3) return { cuts: new Set(), W: 0, scales: [], T: 0 };
  const df = new Map(); bags.forEach((b) => b.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = (t) => Math.log2((n + 1) / (df.get(t) || 1));
  const size = bags.map((b) => { let s = 0; b.forEach((c) => { s += c; }); return s; });
  const total = size.reduce((a, b) => a + b, 0);
  const W = Math.max(1, Math.round(Math.sqrt(total)));
  const sAt = (order, g, win) => { // similarity across the gap after position g of `order`, windows of `win` tokens
    const left = new Map(), right = new Map();
    let mass = 0; for (let i = g; i >= 0 && mass < win; i--) { const u = order[i]; mass += size[u]; bags[u].forEach((c, t) => left.set(t, (left.get(t) || 0) + c)); }
    mass = 0; for (let i = g + 1; i < n && mass < win; i++) { const u = order[i]; mass += size[u]; bags[u].forEach((c, t) => right.set(t, (right.get(t) || 0) + c)); }
    let dot = 0, nl = 0, nr = 0;
    left.forEach((c, t) => { const w = c * idf(t); nl += w * w; const r = right.get(t); if (r) dot += w * r * idf(t); });
    right.forEach((c, t) => { const w = c * idf(t); nr += w * w; });
    return nl && nr ? dot / Math.sqrt(nl * nr) : 0;
  };
  const seq = (order, win) => { const s = []; for (let g = 0; g < n - 1; g++) s.push(sAt(order, g, win)); return s; };
  const gapMassOf = (order) => order.map((u) => size[u]); // tokens of the unit that follows gap i-1 (index i)
  const ident = Array.from({ length: n }, (_, i) => i);
  const scales = []; for (let w = W; w * 3 <= total || !scales.length; w *= 2) { scales.push(w); if (scales.length === 3) break; }
  const found = new Map(); // gap -> strength: how many times deeper than the null's deepest valley, at its best scale
  let Tmax = 0;
  scales.forEach((win, k) => {
    const rnd = lcg(seed + n * 2654435761 + k * 97);
    const depth = depthsOf(seq(ident, win), gapMassOf(ident), win);
    let T = 0; for (let r = 0; r < draws; r++) { const o = shuffled(n, rnd); T = Math.max(T, ...depthsOf(seq(o, win), gapMassOf(o), win)); }
    Tmax = Math.max(Tmax, T);
    depth.forEach((d, g) => { if (d > T && d > 0) found.set(g, Math.max(found.get(g) || 0, T > 0 ? d / T : Infinity)); });
  });
  // one change is not marked twice: of cuts closer than one W of tokens, only the strongest stands
  const mass = (a, b) => { let m = 0; for (let i = a + 1; i <= b; i++) m += size[i]; return m; };
  const cuts = new Set();
  [...found.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).forEach(([g]) => {
    for (const c of cuts) if (mass(Math.min(c, g), Math.max(c, g)) < W) return;
    cuts.add(g);
  });
  return { cuts, W, scales, T: Tmax };
}

const bagOf = (text) => { const m = new Map(); toks(text).forEach((t) => m.set(t, (m.get(t) || 0) + 1)); return m; };
const sum = (a, b) => { const m = new Map(a); b.forEach((c, t) => m.set(t, (m.get(t) || 0) + c)); return m; };

// The terms that most set a section apart from the others: tf × log(sections / sections holding it).
function titleOf(secBags, k, top = 3) {
  const S = secBags.length, df = new Map(); secBags.forEach((b) => b.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const scored = []; secBags[k].forEach((c, t) => { if (t.length < 4) return; const w = c * Math.log2((S + 1) / df.get(t)); if (w > 0) scored.push([t, w]); });
  return scored.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top).map((x) => x[0]);
}

/**
 * paragraphsOf(segs, { breaks, draws, seed }) → { paragraphs, sections, basis }
 *   segs    [{ start, end, text }] in order (seconds)
 *   breaks  [{ start, end }] stretches of sound that are a different kind (applause, music): a break where one sits
 *           between two segments
 *   paragraphs  [{ start, end, text, segs: [index...], why }]    why: 'shift' | 'sound' | null (the first)
 *   sections    [{ start, end, paragraphs: [index...], title: [term...] }]  empty unless there are enough paragraphs
 */
export function paragraphsOf(segs, { breaks = [], draws = DRAWS, seed = 1 } = {}) {
  const S = (segs || []).map((g, i) => ({ i, start: +g.start || 0, end: +g.end || +g.start || 0, text: String(g.text || '').trim() })).filter((g) => g.text);
  if (!S.length) return { paragraphs: [], sections: [], basis: 'no words' };
  // The unit a break may fall between is a SENTENCE, never a bare segment: a recognizer's window ends where the clock
  // says, often mid-sentence, and a paragraph must not begin in the middle of one. Segments are joined until one ends
  // a sentence. (Text with no sentence punctuation at all has no sentences to find, so each segment stands alone.)
  const ENDS = /[.!?…]["'”’)\]]*\s*$/;
  const punctuated = S.filter((g) => ENDS.test(g.text)).length >= 2;
  const U = []; let open = null;
  S.forEach((g) => {
    if (!open) { open = { start: g.start, end: g.end, text: g.text, segs: [g.i] }; U.push(open); }
    else { open.end = g.end; open.text += ' ' + g.text; open.segs.push(g.i); }
    if (!punctuated || ENDS.test(g.text)) open = null;
  });
  const bags = U.map((u) => bagOf(u.text));
  const { cuts, W } = cutsOf(bags, { draws, seed });
  const sound = new Set();
  for (let g = 0; g < U.length - 1; g++) if (breaks.some((b) => b.start < U[g + 1].start && b.end > U[g].end)) sound.add(g);
  const paragraphs = []; let cur = null;
  U.forEach((u, k) => {
    if (!cur) { cur = { start: u.start, end: u.end, text: u.text, segs: [...u.segs], why: null, _b: bags[k] }; paragraphs.push(cur); return; }
    const gap = k - 1;
    if (cuts.has(gap) || sound.has(gap)) { cur = { start: u.start, end: u.end, text: u.text, segs: [...u.segs], why: cuts.has(gap) ? 'shift' : 'sound', _b: bags[k] }; paragraphs.push(cur); }
    else { cur.end = u.end; cur.text += ' ' + u.text; cur.segs.push(...u.segs); cur._b = sum(cur._b, bags[k]); }
  });
  // sections: the same test, with the paragraphs as the units
  const sections = [];
  if (paragraphs.length >= 4) {
    const pc = cutsOf(paragraphs.map((p) => p._b), { draws, seed: seed + 7 });
    let sec = null;
    paragraphs.forEach((p, k) => {
      if (!sec || pc.cuts.has(k - 1)) { sec = { start: p.start, end: p.end, paragraphs: [k], _b: p._b }; sections.push(sec); }
      else { sec.end = p.end; sec.paragraphs.push(k); sec._b = sum(sec._b, p._b); }
    });
    if (sections.length >= 2) sections.forEach((s, k) => { s.title = titleOf(sections.map((x) => x._b), k); });
    else sections.length = 0;
  }
  sections.forEach((s) => { delete s._b; }); paragraphs.forEach((p) => { delete p._b; });
  return { paragraphs, sections, basis: U.length + (punctuated ? ' sentences' : ' segments') + ', window ' + W + ' tokens; ' + paragraphs.length + ' paragraphs where the vocabulary turned more than any of ' + draws + ' shuffled orders would' + (sound.size ? ' or the sound changed kind' : '') };
}
