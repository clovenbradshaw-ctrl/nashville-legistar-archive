// paradigm.js — DEF·Paradigm AND EVA·Paradigm: WHAT SATISFIES A FORM, LEARNED
// FROM ITS INSTANCES, AND WHETHER A CANDIDATE SATISFIES IT (2026-09-22).
//
// The user: "we need a revisable assertion DEF of what satisfies and an
// intelligent EVA" — and "what is it about the HUNT that these all require
// that is a universal kind?" The answer is the cube. A form (a sonnet, a
// limerick, a recipe, an obituary, a statute section, a man page) is asked
// the same twenty-seven questions: each of the nine operators at each of the
// three grains, measured on the form's instances against the rest of the
// population as the null. No question is written for a form; which answers
// come back is what the form is.
//
//              Ground (the medium)       Figure (the parts)          Pattern (across instances)
//   NUL        marks it never carries    role words it lacks         the cells where it is silent
//   SIG        marks that announce it    role words at the parts     the signature, as a whole
//   INS        what a unit is made of    what fills first and last   how much instances vary
//   SEG        how many elements, blocks where it cuts itself         whether the cuts recur
//   CON        adjacent parts answering  positions answering (rhyme) the scheme
//   SYN        evenness, rhythm          what comes before what      the arc (next layer: the parse)
//   DEF        } the Interpretation row is judgement: a frame (DEF), a verdict (EVA), a frame
//   EVA        } reset — the volta, the punchline (REC) — is asked of the mouth, licensed, and
//   REC        } cached; never counted. DEF·Pattern and EVA·Pattern are this module's own two acts.
//
// The Existence and Structure rows are measured; the Interpretation row is
// judged. The split between what a mechanistic EVA can satisfy and what needs
// judgement falls out of the cube rather than being chosen.
//
// Two bars (feedback: low possibility, high probability): a feature is
// admitted only when chance is ruled out at the definition's own level — one
// false feature expected across every test the definition ran, 1/T — AND
// more instances hold it than not. Tests: the exact hypergeometric for a mark or
// a role word (instances against the population), the rank-sum for a
// measure, the Poisson-binomial against each unit's own shuffle for a
// relation between positions, the exact binomial for an order. Nothing here
// is a hand-set threshold; the one structural floor is five instances, below
// which the organ refuses as under-powered.
//
// Reads medium.js (the Ground reader) and sound.js (rhyme by spelling, with
// its limit stated). The parse's own cube addresses across a unit's
// positions (profile.js) are the next layer, for SYN·Pattern — named, not
// faked.

import { elementsOf } from "./medium.js";
import { rhymes } from "./sound.js";

export const PARADIGM_SCHEMA = "EOParadigm@1";
export const OPS = ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"];
export const GRAINS = ["Ground", "Figure", "Pattern"];
const x_key = (e) => e.key;
const JUDGED = new Set(["DEF", "EVA", "REC"]);

// ── the exact tests ─────────────────────────────────────────────────────────
const lf = (() => { const c = [0]; return (n) => { for (let i = c.length; i <= n; i++) c[i] = c[i - 1] + Math.log(i); return c[n]; }; })();
const lC = (n, k) => (k < 0 || k > n ? -Infinity : lf(n) - lf(k) - lf(n - k));
/** P(X ≥ k) (upper) or P(X ≤ k) (lower) for k of `draws` drawn from T holding K. */
export function hypergeom(k, draws, K, T, tail = "upper") {
  let p = 0; const lo = Math.max(0, draws - (T - K)), hi = Math.min(draws, K), den = lC(T, draws);
  for (let x = tail === "upper" ? k : lo; tail === "upper" ? x <= hi : x <= k; x++) p += Math.exp(lC(K, x) + lC(T - K, draws - x) - den);
  return Math.min(1, p);
}
/** P(S ≥ s) for S a sum of independent Bernoullis with probabilities ps. */
export function poissonBinomialUpper(ps, s) {
  let dp = [1];
  for (const p of ps) { const nx = new Array(dp.length + 1).fill(0); dp.forEach((v, i) => { nx[i] += v * (1 - p); nx[i + 1] += v * p; }); dp = nx; }
  return Math.min(1, dp.slice(Math.max(0, s)).reduce((a, b) => a + b, 0));
}
const binomTwoSided = (k, n) => { const f = (x) => Math.exp(lC(n, x) - n * Math.log(2)); const pk = f(k); let p = 0; for (let x = 0; x <= n; x++) if (f(x) <= pk * (1 + 1e-9)) p += f(x); return Math.min(1, p); };
/** Rank-sum (Mann–Whitney) normal approximation with tie correction:
 *  { p (two-sided), direction: +1 instances higher, −1 lower }. */
export function rankSum(a, b) {
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const ranks = new Array(all.length); let ties = 0;
  for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1].v === all[i].v) j++; const r = (i + j + 2) / 2; for (let k = i; k <= j; k++) ranks[k] = r; const t = j - i + 1; ties += t ** 3 - t; i = j + 1; }
  const n1 = a.length, n2 = b.length, N = n1 + n2;
  const R1 = all.reduce((s, x, i) => s + (x.g === 0 ? ranks[i] : 0), 0);
  const U = R1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - ties / (N * (N - 1) || 1)));
  if (!sigma) return { p: 1, direction: 0 };
  const z = (U - mu) / sigma;
  const phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  return { p: Math.min(1, 2 * (1 - phi(Math.abs(z)))), direction: Math.sign(z) };
}
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

// ── the unit, read once ─────────────────────────────────────────────────────
const asUnit = (u) => (Array.isArray(u?.elements) ? u : { id: u?.id ?? null, elements: elementsOf(typeof u === "string" ? u : u?.text ?? "").elements });
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cvOf = (xs) => { const m = mean(xs); return m ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m : 0; };
const content = (u) => u.elements.filter((e) => e.cls === "line" || e.cls === "item" || e.cls === "bar");
const succ = (a, b) => a.markerKind && a.markerKind === b.markerKind && a.label != null && b.label === a.label + 1;
// Rhyme is the medium's: a cadence (the final pitch class, music) where the
// medium gives one, else the spelled tail (sound.js). Same-as is the whole
// element again — a refrain, a repeated bar.
const RELATIONS = {
  rhyme: (a, b) => (a.cadence != null || b.cadence != null ? !!a.cadence && a.cadence === b.cadence : rhymes(a.last, b.last)),
  sameAs: (a, b) => !!a.text && a.text === b.text,
  sameEnd: (a, b) => !!a.last && a.last === b.last,
  sameFirst: (a, b) => !!a.first && a.first === b.first,
};

/** Every measurable fact of one unit, grouped by the cell that reads it. */
export function unitFacts(u0) {
  const u = asUnit(u0);
  const E = u.elements, C = content(u);
  const minIndent = Math.min(...E.map((e) => e.indent), 0);
  const marks = new Set();
  for (const e of E) { marks.add(`class:${e.cls}`); if (e.markerKind) marks.add(`marker:${e.markerKind}`); if (e.level) marks.add(`heading-level:${e.level}`); if (e.cls === "heading" && e.caps) marks.add("heading:all-capitals"); }
  if (E.some((e) => e.indent > minIndent)) marks.add("indentation");
  if (new Set(E.map((e) => e.block)).size > 1) marks.add("block-breaks");
  if (C.length && C.filter((e) => /^[“"‘'(]?[A-Z]/.test(e.text)).length * 2 > C.length) marks.add("content-starts-capitalized");
  if (C.length && C.filter((e) => e.end).length * 2 > C.length) marks.add("content-ends-punctuated");
  if (C.length && C.filter((e) => e.strong).length * 2 > C.length) marks.add("content-ends-a-sentence");
  const roles = new Set();
  for (const e of C) if (e.first) roles.add(`starts:${e.first}`);
  for (const e of E.filter((x) => x.cls === "heading")) for (const w of e.text.toLowerCase().match(/[a-z]+/g) ?? []) roles.add(`heading:${w}`);
  // A header field's value is a role word of its own (a tune's meter, a
  // front matter's rank) — the field letter and its value, never interpreted.
  for (const e of E.filter((x) => x.cls === "field" && x.key && !/^[TSXZN]$/.test(x.key))) roles.add(`field:${x_key(e)}=${String(e.text).toLowerCase().slice(0, 24)}`);
  const adj = (rel) => { let k = 0, n = 0; for (let i = 1; i < C.length; i++) { n++; if (rel(C[i - 1], C[i])) k++; } return n ? k / n : 0; };
  const itemsRun = () => { const I = E.filter((e) => e.cls === "item" && e.label != null); let k = 0; for (let i = 1; i < I.length; i++) if (succ(I[i - 1], I[i])) k++; return I.length > 1 ? k / (I.length - 1) : 0; };
  const syl = C.map((e) => e.syllables).filter((x) => x > 0);
  return {
    id: u.id, elements: E, content: C,
    marks, roles,
    firstClass: E[0]?.cls ?? null, lastClass: E.at(-1)?.cls ?? null,
    measures: {
      "SEG:elements": C.length,
      "SEG:blocks": new Set(E.map((e) => e.block)).size,
      "INS:share-items": C.length ? C.filter((e) => e.cls === "item").length / C.length : 0,
      "INS:share-headings": E.length ? E.filter((e) => e.cls === "heading").length / E.length : 0,
      "SYN:syllables-per-part": mean(syl),
      "SYN:evenness(cv)": cvOf(syl),
      "CON:adjacent-rhyme": adj(RELATIONS.rhyme),
      "CON:adjacent-same-first": adj(RELATIONS.sameFirst),
      "CON:labels-count-up": itemsRun(),
    },
  };
}

// ── DEF·Paradigm ────────────────────────────────────────────────────────────
/**
 * learnParadigm({ name, instances, population }) → EOParadigm@1
 * instances / population: arrays of texts, { text }, or { elements } units.
 */
export function learnParadigm({ name = "form", instances = [], population = [], revision = 1, sources = [] } = {}) {
  const I = instances.map(unitFacts), P = population.map(unitFacts);
  const cells = {};
  for (const op of OPS) for (const g of GRAINS) cells[`${op}·${g}`] = { op, grain: g, features: [], tests: 0, basis: "" };
  const cell = (op, g) => cells[`${op}·${g}`];
  if (I.length < 5) return { schema: PARADIGM_SCHEMA, name, refused: "under_powered", instances: I.length, population: P.length, cells, features: [], basis: `${I.length} instance(s): below five the organ cannot tell a form from a coincidence — refused` };
  if (P.length < 5) return { schema: PARADIGM_SCHEMA, name, refused: "no_null", instances: I.length, population: P.length, cells, features: [], basis: `${P.length} population unit(s): a form is what separates its instances from the rest, and there is no rest to separate from — refused` };
  const nI = I.length, nP = P.length, T = nI + nP;
  const majority = (k, n) => k * 2 > n;

  // A binary family (marks, role words, first/last class): SIG when instances
  // hold it more than not and beyond the population; NUL when the population
  // holds it more than not and instances lack it beyond chance.
  const binaryFamily = (sigCell, nulCell, has) => {
    const keys = new Set(); for (const f of [...I, ...P]) for (const k of has(f)) keys.add(k);
    const sigCands = [...keys].filter((k) => majority(I.filter((f) => has(f).has(k)).length, nI));
    const nulCands = [...keys].filter((k) => majority(P.filter((f) => has(f).has(k)).length, nP) && !majority(I.filter((f) => has(f).has(k)).length, nI));
    // Every key LOOKED AT counts as a test, not only the ones the majority
    // pre-filter passed: that filter reads the same counts the test does, so
    // counting only its survivors shrinks T exactly where chance runs high
    // (measured 2026-09-22: 1.2 false features per coincidence, one run 6).
    sigCell.tests += keys.size;
    for (const k of sigCands) {
      const kI = I.filter((f) => has(f).has(k)).length, kP = P.filter((f) => has(f).has(k)).length;
      const p = hypergeom(kI, nI, kI + kP, T, "upper");
      sigCell.features.push({ key: k, type: "has", support: kI / nI, contrast: kP / nP, p, pending: true });
    }
    for (const k of nulCands) {
      const kI = I.filter((f) => has(f).has(k)).length, kP = P.filter((f) => has(f).has(k)).length;
      const p = hypergeom(kI, nI, kI + kP, T, "lower");
      nulCell.features.push({ key: k, type: "lacks", support: 1 - kI / nI, contrast: 1 - kP / nP, p, pending: true });
    }
  };
  binaryFamily(cell("SIG", "Ground"), cell("NUL", "Ground"), (f) => f.marks);
  binaryFamily(cell("SIG", "Figure"), cell("NUL", "Figure"), (f) => f.roles);
  binaryFamily(cell("INS", "Figure"), cell("INS", "Figure"), (f) => new Set([`first-part:${f.firstClass}`, `last-part:${f.lastClass}`]));

  // Measures: the instances' values against the population's, by rank.
  const byCell = { SEG: "SEG·Ground", INS: "INS·Ground", SYN: "SYN·Ground", CON: "CON·Ground" };
  for (const key of Object.keys(I[0].measures)) {
    const c = cells[byCell[key.split(":")[0]]]; c.tests++;
    const a = I.map((f) => f.measures[key]), b = P.map((f) => f.measures[key]);
    const r = rankSum(a, b);
    const sa = [...a].sort((x, y) => x - y), q = (t) => sa[Math.min(sa.length - 1, Math.floor(t * sa.length))];
    // The high bar for a measure: the instances' middle half does not reach
    // the population's median — most instances sit on the far side.
    const pm = [...b].sort((x, y) => x - y)[Math.floor(b.length / 2)];
    const most = r.direction > 0 ? a.filter((v) => v > pm).length : a.filter((v) => v < pm).length;
    c.features.push({ key, type: "measure", direction: r.direction, p: r.p, support: most / nI, range: [q(0.25), q(0.75)], instanceMedian: q(0.5), populationMedian: pm, pending: true });
  }

  // SEG·Pattern: whether the cuts recur — the modal element count, held by
  // more instances than not and more than the population holds it.
  // Positions are the CONTENT sequence's own (lines, items, bars): a tune's
  // header fields vary in number, and bar 5 must mean the fifth bar.
  for (const f of [...I, ...P]) f.seq = f.content;
  const counts = new Map(); for (const f of I) counts.set(f.seq.length, (counts.get(f.seq.length) ?? 0) + 1);
  const [mode, modeN] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const segP = cell("SEG", "Pattern"); segP.tests = 1;
  const modeP = P.filter((f) => f.seq.length === mode).length;
  segP.features.push({ key: `elements=${mode}`, type: "count", value: mode, support: modeN / nI, contrast: modeP / nP, p: hypergeom(modeN, nI, modeN + modeP, T, "upper"), pending: true });
  const fixed = majority(modeN, nI);
  const atMode = I.filter((f) => f.seq.length === mode);

  // SEG·Figure: the seams of a fixed-count form — positions that end a
  // sentence more often than each unit's own rate of sentence ends predicts.
  const segF = cell("SEG", "Figure");
  if (fixed && mode > 1) {
    segF.tests = mode;
    for (let i = 0; i < mode; i++) {
      const ps = atMode.map((f) => f.seq.filter((e) => e.strong).length / f.seq.length);
      const k = atMode.filter((f) => f.seq[i].strong).length;
      segF.features.push({ key: `seam-after-part-${i + 1}`, type: "seam", position: i, support: k / atMode.length, p: poissonBinomialUpper(ps, k), pending: true });
    }
  } else segF.basis = fixed ? "one element: no seams" : `no element count held by more instances than not (modal ${mode} in ${modeN} of ${nI}) — seams need fixed positions`;

  // CON·Figure: positions that answer each other, against each unit's own
  // shuffle (the unit's rate of that relation over all its pairs).
  const conF = cell("CON", "Figure");
  const pairs = [];
  if (fixed && mode > 1) {
    const rels = Object.entries(RELATIONS);
    conF.tests = (mode * (mode - 1) / 2) * rels.length;
    for (const [rel, fn] of rels) {
      const base = atMode.map((f) => { let k = 0, n = 0; for (let i = 0; i < mode; i++) for (let j = i + 1; j < mode; j++) { n++; if (fn(f.seq[i], f.seq[j])) k++; } return n ? k / n : 0; });
      for (let i = 0; i < mode; i++) for (let j = i + 1; j < mode; j++) {
        const k = atMode.filter((f) => fn(f.seq[i], f.seq[j])).length;
        if (!majority(k, atMode.length)) continue; // the high bar first: only majority pairs are tested
        const p = poissonBinomialUpper(base, k);
        conF.features.push({ key: `${rel}(${i + 1},${j + 1})`, type: "pair", relation: rel, i, j, support: k / atMode.length, p, pending: true });
      }
    }
  } else conF.basis = segF.basis;

  // SYN·Figure: what comes before what — for role words held by more
  // instances than not, the order of their first appearance.
  const synF = cell("SYN", "Figure");
  const roleKeys = [...new Set(I.flatMap((f) => [...f.roles]))].filter((k) => majority(I.filter((f) => f.roles.has(k)).length, nI));
  const firstAt = (f, k) => { const [kind, w] = k.split(":"); return f.elements.findIndex((e) => (kind === "starts" ? (e.cls === "line" || e.cls === "item") && e.first === w : e.cls === "heading" && (e.text.toLowerCase().match(/[a-z]+/g) ?? []).includes(w))); };
  const orderPairs = [];
  for (let x = 0; x < roleKeys.length; x++) for (let y = x + 1; y < roleKeys.length; y++) {
    const both = I.filter((f) => f.roles.has(roleKeys[x]) && f.roles.has(roleKeys[y]));
    if (!majority(both.length, nI)) continue;
    const before = both.filter((f) => firstAt(f, roleKeys[x]) < firstAt(f, roleKeys[y])).length;
    const [a, b, k] = before * 2 >= both.length ? [roleKeys[x], roleKeys[y], before] : [roleKeys[y], roleKeys[x], both.length - before];
    orderPairs.push({ key: `${a} before ${b}`, type: "order", a, b, support: k / both.length, over: both.length, p: binomTwoSided(k, both.length), pending: true });
  }
  synF.tests = orderPairs.length; synF.features.push(...orderPairs);

  // The two bars: chance ruled out at 1/T over EVERY test this definition
  // ran — one false feature expected across the whole definition, never one
  // per cell (measured 2026-09-22 by the control: a cell with a single test
  // had a level of 1, and p = 0.42 was admitted) — and held more than not.
  const T_ALL = Object.values(cells).reduce((n, c) => n + c.tests, 0);
  const level = T_ALL ? 1 / T_ALL : 0;
  for (const c of Object.values(cells)) {
    c.level = level;
    c.features = c.features.filter((f) => f.p <= level && f.support > 0.5).map(({ pending, ...f }) => ({ ...f, cell: `${c.op}·${c.grain}` }));
  }
  // An order edge only stands between role words that are themselves signs.
  const sigRoles = new Set(cell("SIG", "Figure").features.map((f) => f.key));
  cell("SYN", "Figure").features = cell("SYN", "Figure").features.filter((f) => sigRoles.has(f.a) && sigRoles.has(f.b));

  // CON·Pattern: the scheme — rhyme and repetition pairs joined into letters.
  const conP = cell("CON", "Pattern");
  const kept = cell("CON", "Figure").features;
  let scheme = null;
  if (fixed && kept.length) {
    const parent = [...Array(mode).keys()];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const f of kept.filter((x) => x.relation === "rhyme" || x.relation === "sameEnd" || x.relation === "sameAs")) parent[find(f.j)] = find(f.i);
    const letter = new Map(); let next = 0;
    scheme = [...Array(mode).keys()].map((i) => { const r = find(i); const joined = kept.some((f) => (f.relation === "rhyme" || f.relation === "sameEnd" || f.relation === "sameAs") && (f.i === i || f.j === i)); if (!joined) return "x"; if (!letter.has(r)) letter.set(r, "ABCDEFGHIJKLMNOP"[next++]); return letter.get(r); }).join("");
    conP.features.push({ key: `scheme ${scheme}`, type: "scheme", scheme, cell: "CON·Pattern", support: mean(atMode.map((f) => kept.filter((p) => RELATIONS[p.relation](f.seq[p.i], f.seq[p.j])).length / kept.length)), p: Math.min(...kept.map((f) => f.p)) });
  } else conP.basis = fixed ? "no pair of positions answers another beyond chance" : segF.basis;

  // INS·Pattern: how much the instances vary among themselves (reported).
  cell("INS", "Pattern").basis = `element count varies ${cvOf(I.map((f) => f.elements.length)).toFixed(2)} across instances, ${cvOf(P.map((f) => f.elements.length)).toFixed(2)} across the population`;
  cell("SYN", "Pattern").basis = "unmeasured: the arc needs the parse's own cube addresses across a unit's positions (profile.js) — the next layer";

  const measured = Object.values(cells).filter((c) => !JUDGED.has(c.op)).flatMap((c) => c.features);
  // SIG·Pattern: the signature as a whole — the marks and role words together.
  const sigAll = measured.filter((f) => f.type === "has" || f.type === "lacks");
  cell("SIG", "Pattern").basis = sigAll.length ? `${sigAll.length} mark(s) and role word(s) together` : "no mark or role word separates the instances";
  cell("NUL", "Pattern").basis = `silent cells: ${Object.values(cells).filter((c) => !JUDGED.has(c.op) && c.grain !== "Pattern" && !c.features.length).map((c) => `${c.op}·${c.grain}`).join(", ") || "none"}`;
  for (const op of JUDGED) for (const g of GRAINS) cells[`${op}·${g}`].basis = "judgement: the Interpretation row is asked of the mouth, licensed, and cached — never counted";
  cells["DEF·Pattern"].basis = `this definition: ${measured.length} measured feature(s) from ${nI} instance(s) against ${nP} — revisable (revision ${revision}); the judged cells are named, not faked`;
  cells["EVA·Pattern"].basis = "evaluateParadigm: a candidate held against every measured feature, scored against the instances' and population's own scores";

  const paradigm = {
    schema: PARADIGM_SCHEMA, name, revision, sources, instances: nI, population: nP,
    cells, features: measured, count: fixed ? mode : null, scheme, tests: T_ALL, level,
    judged: [...JUDGED].flatMap((op) => GRAINS.map((g) => `${op}·${g}`)),
  };
  // EVA's own calibration: the score that best separates the learning
  // instances from the population (in-sample; a held-out check is the
  // caller's — the probe does it).
  const sI = I.map((f) => scoreFacts(paradigm, f).score), sP = P.map((f) => scoreFacts(paradigm, f).score);
  const cuts = [...new Set([...sI, ...sP])].sort((a, b) => a - b);
  let best = { cut: 1, acc: 0 };
  for (const c of cuts) { const acc = (sI.filter((s) => s >= c).length / nI + sP.filter((s) => s < c).length / nP) / 2; if (acc > best.acc) best = { cut: c, acc }; }
  paradigm.satisfies = { cut: best.cut, balancedAccuracy: best.acc, basis: `a candidate satisfies when it holds at least ${(best.cut * 100).toFixed(0)}% of the measured features — the cut that best separates the ${nI} instances from the ${nP} (balanced accuracy ${(best.acc * 100).toFixed(0)}%, in sample)` };
  paradigm.basis = `${name}: ${measured.length} feature(s) in ${Object.values(cells).filter((c) => c.features.length && !JUDGED.has(c.op)).length} measured cell(s)${fixed ? `; ${mode} parts` : ""}${scheme ? `; scheme ${scheme}` : ""}; the Interpretation row judged`;
  return paradigm;
}

function holds(f, u) {
  switch (f.type) {
    case "has": return f.cell.endsWith("Ground") ? u.marks.has(f.key) : f.cell === "INS·Figure" ? `first-part:${u.firstClass}` === f.key || `last-part:${u.lastClass}` === f.key : u.roles.has(f.key);
    case "lacks": return f.cell.endsWith("Ground") ? !u.marks.has(f.key) : !u.roles.has(f.key);
    case "measure": { const v = u.measures[f.key]; return f.direction > 0 ? v > f.populationMedian : v < f.populationMedian; }
    case "count": return u.content.length === f.value;
    case "seam": return u.content.length > f.position && !!u.content[f.position].strong;
    case "pair": return u.content.length > f.j && RELATIONS[f.relation](u.content[f.i], u.content[f.j]);
    case "order": { const at = (k) => { const [kind, w] = k.split(":"); return u.elements.findIndex((e) => (kind === "starts" ? e.first === w : e.cls === "heading" && e.text.toLowerCase().includes(w))); }; const a = at(f.a), b = at(f.b); return a >= 0 && b >= 0 && a < b; }
    case "scheme": return true; // the scheme is its pairs; each pair is scored on its own
    default: return false;
  }
}
function scoreFacts(paradigm, u) {
  const fs = paradigm.features.filter((f) => f.type !== "scheme");
  const checks = fs.map((f) => ({ key: f.key, cell: f.cell, held: holds(f, u) }));
  return { score: checks.length ? checks.filter((c) => c.held).length / checks.length : 0, checks };
}

// ── EVA·Paradigm ────────────────────────────────────────────────────────────
/**
 * evaluateParadigm(paradigm, candidate) → { satisfies, score, checks, judged, basis }
 * Every measured feature checked; the Interpretation row returned as the
 * questions still owed to judgement.
 */
export function evaluateParadigm(paradigm, candidate) {
  if (paradigm?.refused) return { satisfies: null, score: null, checks: [], judged: [], basis: `no paradigm to evaluate against: ${paradigm.basis}` };
  const u = unitFacts(candidate);
  const { score, checks } = scoreFacts(paradigm, u);
  const satisfies = score >= paradigm.satisfies.cut;
  const missed = checks.filter((c) => !c.held);
  return {
    satisfies, score, checks, judged: paradigm.judged,
    basis: `${checks.length - missed.length} of ${checks.length} measured feature(s) held (${(score * 100).toFixed(0)}%, cut ${(paradigm.satisfies.cut * 100).toFixed(0)}%)${missed.length ? `; missing: ${missed.slice(0, 6).map((c) => c.key).join(", ")}${missed.length > 6 ? ", …" : ""}` : ""}; still owed to judgement: the Interpretation row (${paradigm.judged.filter((c) => c.endsWith("Pattern")).join(", ")} …)`,
  };
}

/** The paradigm as readable lines, cell by cell. */
export function paradigmLines(p) {
  const out = [`${p.name} — ${p.basis}`];
  if (p.refused) return [...out, `refused: ${p.refused}`];
  for (const op of OPS) for (const g of GRAINS) {
    const c = p.cells[`${op}·${g}`];
    if (JUDGED.has(op) && g !== "Pattern") continue;
    const fmt = (f) => `${f.key}${f.type === "measure" ? ` (${f.direction > 0 ? "higher" : "lower"}: median ${(+f.instanceMedian).toFixed(2)} vs ${(+f.populationMedian).toFixed(2)})` : f.contrast != null ? ` (${Math.round(f.support * 100)}% vs ${Math.round(f.contrast * 100)}%)` : ` (${Math.round(f.support * 100)}%)`}`;
    const body = c.features.length ? c.features.slice(0, 10).map(fmt).join("; ") + (c.features.length > 10 ? `; … ${c.features.length - 10} more` : "") : c.basis || "—";
    out.push(`  ${`${op}·${g}`.padEnd(15)} ${body}`);
  }
  out.push(`  satisfies      ${p.satisfies.basis}`);
  return out;
}

// ── EMERGENT FEATURES (2026-09-22). The user: "make them emergent." The
// families above (marks, role words, measures, pairs, orders) are a list.
// Here every feature is generated: each unit's EMERGENT FACTS (form-prior.js
// emergentFacts — the Ground reader's own attributes crossed with SIG, CON
// equality and SYN succession, nothing listed) become binary features
// "slot = value", a slot the unit lacks is ABSENT (the void is a feature),
// and each is tested instances against population. Every (slot, value) LOOKED
// AT counts toward the level — 1/T over all of them — and a feature is held by
// more instances than not. The cube cell of a feature is read off how it was
// generated, never assigned by hand to a named relation.
import { emergentFacts } from "./form-prior.js";
import { ABSENT } from "../kernel/bayes-surprise.js";
import { kindEvidence, createKindInductionIndex } from "../kernel/kind-induction.js";
import { induceEntityKindCandidates } from "../kernel/entity-kind-induction.js";

export function cellOfFact(slot, value) {
  if (value === ABSENT) return "NUL·Figure";
  if (slot.startsWith("count:")) return "SEG·Ground";
  if (slot.includes("*:")) return value === "varies" ? "INS·Pattern" : "SYN·Pattern";
  if (slot.startsWith("key:")) return "SIG·Ground";
  if (slot.endsWith("=")) return value === "none" ? "NUL·Figure" : "CON·Figure";
  if (slot.endsWith("+1")) return value === "none" ? "NUL·Figure" : "SYN·Figure";
  return "SIG·Figure";
}

export function learnParadigmEmergent({ name = "form", instances = [], population = [], revision = 1 } = {}) {
  const facts = (u) => emergentFacts(Array.isArray(u?.elements) ? u : { elements: elementsOf(typeof u === "string" ? u : u?.text ?? "").elements });
  const I = instances.map(facts), P = population.map(facts);
  if (I.length < 5) return { schema: PARADIGM_SCHEMA, name, refused: "under_powered", instances: I.length, features: [], basis: `${I.length} instance(s): below five — refused` };
  if (P.length < 5) return { schema: PARADIGM_SCHEMA, name, refused: "no_null", instances: I.length, features: [], basis: "no population to separate from — refused" };
  const nI = I.length, nP = P.length, T = nI + nP;
  const slots = new Set([...I, ...P].flatMap((f) => [...f.keys()]));
  // Every (slot, value) held by anyone is LOOKED AT; each counts as a test.
  const tally = new Map(); // JSON [slot, value] → [inInstances, inPopulation]
  const add = (f, side) => { for (const s of slots) { const v = f.has(s) ? String(f.get(s)) : ABSENT; const k = JSON.stringify([s, v]); const t = tally.get(k) ?? [0, 0]; t[side]++; tally.set(k, t); } };
  I.forEach((f) => add(f, 0)); P.forEach((f) => add(f, 1));
  const tests = tally.size, level = 1 / tests;
  const features = [];
  for (const [k, [kI, kP]] of tally) {
    if (kI * 2 <= nI) continue;
    const [slot, value] = JSON.parse(k);
    const p = hypergeom(kI, nI, kI + kP, T, "upper");
    if (p <= level) features.push({ cell: cellOfFact(slot, value), key: slot.endsWith("=") ? `${slot.slice(0, -1)} equals ${value}` : slot.endsWith("+1") ? `${slot.slice(0, -2)} follows ${value}` : `${slot}=${value}`, slot, value, type: "fact", support: kI / nI, contrast: kP / nP, p });
  }
  features.sort((a, b) => a.p - b.p || b.support - a.support);
  const holdsF = (f, u) => String(u.has(f.slot) ? u.get(f.slot) : ABSENT) === f.value;
  // COMPRESSION, BY DOMINANCE (no threshold): a feature is dropped when a
  // kept one holds on at least the same instances and on no more of the
  // population — it adds nothing the kept one does not say better. Its name
  // is kept on the one that dominates it (`same`). Measured: rhyme keys,
  // last words and the voids implied by a count had each been a feature.
  const bits = (f, list) => list.map((u) => (holdsF(f, u) ? 1 : 0));
  const subset = (a, b) => a.every((x, i) => !x || b[i]); // a ⊆ b
  const kept = [];
  for (const f of features) {
    const fi = bits(f, I), fp = bits(f, P);
    const by = kept.find((g) => subset(fi, g.bi) && subset(g.bp, fp));
    if (by) { (by.f.same ??= []).push(f.key); continue; }
    kept.push({ f, bi: fi, bp: fp });
  }
  const pruned = features.length - kept.length;
  // DEF and EVA are different acts (measured: dominance left "limerick vs
  // sonnet" defined by count = 5 alone — right for telling them apart, wrong
  // for satisfaction: five lines of prose would satisfy it). The DEFINITION
  // is compressed — dominated features folded under what dominates them —
  // but SATISFACTION is scored against every admitted feature.
  const all = [...features];
  features.length = 0; for (const k of kept) features.push(k.f);
  const score = (u) => (all.length ? all.filter((f) => holdsF(f, u)).length / all.length : 0);
  const sI = I.map(score), sP = P.map(score);
  let best = { cut: 1, acc: 0 };
  for (const c of [...new Set([...sI, ...sP])]) { const acc = (sI.filter((s) => s >= c).length / nI + sP.filter((s) => s < c).length / nP) / 2; if (acc > best.acc) best = { cut: c, acc }; }
  const byCell = {}; for (const f of features) (byCell[f.cell] ??= []).push(f);
  return {
    schema: PARADIGM_SCHEMA, name, revision, emergent: true, instances: nI, population: nP, tests, level, features, byCell,
    satisfies: { cut: best.cut, balancedAccuracy: best.acc }, facts,
    pruned, all,
    basis: `${name}: ${features.length} emergent feature(s) (${pruned} dominated, folded into them) of ${tests} (slot, value) pairs looked at (level 1/${tests}), in ${Object.keys(byCell).length} cell(s): ${Object.entries(byCell).map(([c, fs]) => `${c} ${fs.length}`).join(", ")}`,
  };
}
export function evaluateParadigmEmergent(p, candidate) {
  if (p?.refused) return { satisfies: null, score: null };
  const u = p.facts(candidate);
  const scored = p.all ?? p.features;
  const held = scored.filter((f) => String(u.has(f.slot) ? u.get(f.slot) : ABSENT) === f.value).length;
  const score = scored.length ? held / scored.length : 0;
  return { satisfies: score >= p.satisfies.cut, score, held, of: scored.length };
}

// ── DISCOVERED PLURALITY (2026-09-22). learn-pass.js's own `stance`
// (expertise-agent.js's extractStance) lets a PERSON declare that one name
// spans more than one paradigm ("white paper — tech sector" vs "white paper
// — food science"). This is the other half: given instances all filed under
// ONE name with no declared stance, does the engine's OWN reading find that
// they cluster into more than one real sub-paradigm? It reuses the SAME
// evidence learnParadigmEmergent already extracts (form-prior.js's
// emergentFacts — no separate feature set invented) and the SAME induction
// this engine already trusts elsewhere for "is this a real kind, or
// coincidence" (kernel/entity-kind-induction.js's affinity-basin clustering
// with its random-subset binding-energy null, wired the way kinds.js already
// wires it onto statements). Nothing here forks the recording — a caller
// that finds `plural: true` DISCLOSES it; auto-forking one paradigm into
// several ledger entries is a bigger behavior change, left undone on
// purpose (see learn-pass.js's own call site).
/**
 * detectParadigmPlurality(instances, { name, population }) →
 *   { plural: false, basis, diagnostics }  — the common case: no real split
 *   { plural: true, clusters: [{ members, distinguishingFacts }], unclustered, basis, diagnostics }
 * `population` here is only a label for the induction's own seeded null and
 * its kind keys (kernel/entity-kind-induction.js's own `population` option)
 * — it is NOT the comparison ground learnParadigmEmergent measures against;
 * the instances cluster against THEMSELVES, the same self-clustering
 * kinds.js already does for one draft's statements.
 */
export function detectParadigmPlurality(instances = [], { name = "form", population = null } = {}) {
  const nI = instances.length;
  if (nI < 5) return { plural: false, refused: "under_powered", instances: nI, basis: `${nI} instance(s): below five the induction cannot tell a cluster from a coincidence — refused` };
  // positional: false (2026-09-22, the OOM fix — see form-prior.js's own
  // comment on emergentFacts) — this organ self-clusters real instances,
  // which can each be a real multi-thousand-line document; per-position
  // facts (`@3421:closes`) are not a comparable address across independently
  // authored documents and almost never clear induceEntityParameters' own
  // memberCount>=2 admissibility gate, so keeping them only pays the cost
  // (an O(elements^2) scan and an O(elements) fact volume, multiplied
  // several times over by the clustering's own data structures) without
  // buying signal. Only the position-independent facts (count:*, key:*, the
  // lifted cls*:attr whole-class facts) participate here — DISCLOSED, not
  // silent: measured directly (synthetic 2-8k-line documents), the plurality
  // induction proper never used the per-position facts constructively at
  // real-corpus scale, and learnParadigmEmergent (which DOES compare same-
  // shaped instances position-by-position) is untouched by this change.
  const facts = (u) => emergentFacts(Array.isArray(u?.elements) ? u : { elements: elementsOf(typeof u === "string" ? u : u?.text ?? "").elements }, { positional: false });
  const entries = [];
  let seq = 0;
  instances.forEach((u, i) => {
    const id = (typeof u === "object" && u?.id != null) ? String(u.id) : `instance-${i}`;
    for (const [slot, value] of facts(u)) entries.push(kindEvidence({ id: `pp-${++seq}`, entityRef: id, featureKey: slot, featureValue: value, sequencePosition: i }));
  });
  const index = createKindInductionIndex(entries);
  const popLabel = population || `paradigm:${name}`;
  const induced = induceEntityKindCandidates(index.entityFeatures, { population: popLabel });
  const validatedCount = induced.diagnostics.validated;
  if (validatedCount < 2) {
    return {
      plural: false, instances: nI, diagnostics: induced.diagnostics,
      basis: validatedCount === 1
        ? `one stable cluster among ${nI} instances (random-subset binding-energy null) — a single paradigm, not a plural one`
        : `no cluster of these ${nI} instances bound to itself beyond the random-subset binding-energy null — a single paradigm`,
    };
  }
  const clusters = induced.candidates.map((c) => ({
    members: [...c.memberRefs],
    distinguishingFacts: (c.distinguishingParameters ?? []).map((p) => ({ key: p.featureKey, value: p.featureValue, prevalence: +p.prevalence.toFixed(3), distinctiveness: +p.distinctiveness.toFixed(3) })),
    cohesion: c.cohesion, pValue: c.cohesionNull?.pValue ?? null,
  }));
  const clustered = new Set(clusters.flatMap((c) => c.members));
  const unclustered = instances.map((u, i) => (typeof u === "object" && u?.id != null) ? String(u.id) : `instance-${i}`).filter((id) => !clustered.has(id));
  return {
    plural: true, instances: nI, clusters, unclustered, diagnostics: induced.diagnostics,
    basis: `${clusters.length} stable clusters found among ${nI} instances (random-subset binding-energy null, each cluster's own p ≤ ${Math.max(...clusters.map((c) => c.pValue ?? 1)).toFixed(3)}); ${unclustered.length} instance(s) outside any stable cluster — "${name}" may not be one paradigm`,
  };
}
