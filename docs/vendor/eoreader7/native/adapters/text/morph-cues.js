// adapters/text/morph-cues.js — Sullivan's second sense: MORPHOLOGY BY
// ELIMINATION. Which marks on and around a word tell its case, its tense,
// its number, its mood — learned from the material's own co-occurrence,
// each cue admitted only above its own null and above the search's own
// noise floor, never written as a rule.
// Handle: Sullivan — Annie Sullivan spelled into Helen Keller's hand until
//   the world's own regularity (w-a-t-e-r, at the pump) did the teaching:
//   a mark is learned from what reliably comes with it, not from a rule
//   composed for the student. existence-grain.js is her first sense (which
//   forms may leave the Void); this is her second (what the marks on a form
//   say). Medium: any token stream with a form and, where the caller has
//   them, a word class, neighbours and a parse.
//
// WHY THIS EXISTS. clause-tense.js reads English tense off the Chomsky
// parser with rules written by hand for English ("had" + participle is
// Pqp, "will" is Fut); english-parser.js's lexicon keeps one best feats
// string per form and per ending. The user: "we must learn all tenses,
// cases, etc." Every treebank this house holds — English, Latin, Greek,
// two Sanskrits, Arabic, Hebrew — marks its features in its own places:
// Latin case on the ending, Hebrew definiteness on a prefix, English tense
// on an auxiliary one word to the left, Arabic mood on the ending under a
// prefix. A learner that only knows endings reads three of those. This
// one is told nothing about where to look: it is given the CUE KINDS below
// and lets each language's material admit the cues that speak in it.
//
// THE STUDENT'S SENSES (CUE_KINDS), each conditioned on the word CLASS the
// caller supplies: the last k characters (end:k), the first k (beg:k), the
// class alone (class), the form and the class of the neighbour to the left
// and right (left, right, lclass, rclass — constructions, parse-free), and
// the lemmas of any auxiliaries attached (aux — constructions,
// parse-given). Three of these are measured lessons from the first runs
// (2026-09-25): without class conditioning, Latin Case endings fired on
// 99.8% of finite verbs ("-t" was enriched among the few participles that
// carry Case and nothing said a finite verb cannot); without neighbour
// CLASS, a tense marked by the ABSENCE of an auxiliary (the toy language's
// present) had no cue that could carry it, since every left-neighbour
// form was a different key; and without the negative evidence below, the
// class-alone cue fired on every token of its class. In a treebank the
// class is gold; in a live read it is the tagger's (english-parser.js, 74%
// held-out recall), and the audit says which.
//
// FOUND BY ELIMINATION — THE NEGATIVE EVIDENCE IS LEARNED. Tokens of a
// carrier class that carry NO value of the feature are learned as the
// value UNMARKED ("∅"): a finite Latin verb is a VERB with no Case, and
// "-t" on a VERB is a cue FOR that. A prediction of ∅ is Sullivan saying
// what the form is not — reported as "unmarked", never as a guess at a
// value, and counted against her when the gold carries one.
//
// ADMISSION, NO THRESHOLD — THREE NULLS, ALL THE MATERIAL'S OWN.
//   1. Split-half consistency. The learning material is cut in two by
//      sentence parity. A cue (kind, key, class) is a CANDIDATE only if it
//      occurs in both halves and both settle it on the same value — the
//      golden-free fitness sullivan-learn.mjs used.
//   2. The cue's own null: ENRICHMENT, not a rival argmax. observed =
//      P(gold = v | cue fires) on half B; a draw = the same fraction with
//      B's labels shuffled among B's tokens. Beyond every one of N draws,
//      or refused. (First version shuffled A's labels and took each key's
//      argmax — which IS the majority value, so every perfect cue for a
//      majority value tied its own null and Latin Past came back
//      "unreached". Measured, replaced.)
//   3. The SEARCH's own floor (the elenchus bar, eval/lavar/elenchus-bar.mjs,
//      applied here as a max-statistic permutation floor): with thousands
//      of candidates, some clear their own null by chance. The whole
//      search is rerun R times on labels shuffled across every token; the
//      most SURPRISE any candidate reaches in a rerun — the exact binomial
//      tail of its correct tokens at its value's base rate, in bits — is
//      the floor. A real cue's surprise must clear it. (Raw excess as the
//      statistic let a rare, perfect Latin Fut ending die at a floor set by
//      the commonest tense; z blew up on single tokens of rare values and
//      set the floor by flukes; the binomial tail does neither — see
//      binomialSurprise below.)
// N, R and the seed are declared; the rank and the floor are kept beside
// every verdict.
//
// PREDICTION BY ELIMINATION. On a new token, every admitted cue that fires
// speaks with its own held-out accuracy. All agree → bound (or unmarked).
// None fires → VOID, an honest "not yet", never the majority value. They
// disagree → CONTESTED: the most accurate cue's value is offered, the
// rivals landed beside it, never silently resolved.
//
// THE GOLD IS A WITNESS, NEVER THE FITNESS. audit() reads a held-out
// split's gold only after the model is fixed, and reports coverage,
// accuracy, contests, misses (unmarked, void), and false fires on tokens
// of carrier classes that carry nothing. eval/lavar/sullivan-morph.mjs
// runs it over every treebank held.
import { lcg } from "../../kernel/continuation.js";
import { FORM_FEATURES } from "../../kernel/universal-grammar.js";

export const SCHEMA = "EOMorphCues@1";
export const CUE_KINDS = Object.freeze(["end:1", "end:2", "end:3", "end:4", "beg:1", "beg:2", "beg:3", "class", "left", "right", "lclass", "rclass", "aux"]);
// R reruns set the search floor; by exchangeability the real search's best
// fluke exceeds the best of R null reruns about 1 time in R+1, so with
// R = 11 roughly one feature in twelve admits one chance cue. Declared,
// reported beside every model as `null.reruns`, never hidden.
export const NULL = Object.freeze({ draws: 12, reruns: 11, seed: 7 });
export const UNMARKED = "∅";

const SEP = "\u0001";
const freeze = (v) => Object.freeze(v);
export const cueKey = (kind, key, cls) => `${kind}${SEP}${key}${SEP}${cls ?? ""}`;

/** featsOf("Case=Acc|Number=Sing") → Map { Case → "Acc", Number → "Sing" } */
export function featsOf(feats) {
  const m = new Map();
  if (!feats || feats === "_") return m;
  for (const kv of String(feats).split("|")) { const i = kv.indexOf("="); if (i > 0) m.set(kv.slice(0, i), kv.slice(i + 1)); }
  return m;
}

/** Every feature name a token stream carries, minus the surface features
 *  universal-grammar.js keeps out of the meaning layer. */
export function featuresIn(sentences) {
  const seen = new Set();
  for (const s of sentences) for (const t of s.tokens) for (const k of featsOf(t.feats).keys()) if (!FORM_FEATURES.has(k)) seen.add(k);
  return [...seen].sort();
}

/** cuesOf(token, sentence) → [[kind, key, class], …] — the senses, applied. */
export function cuesOf(t, sent) {
  const out = [];
  const cls = t.upos ?? "";
  const f = String(t.form ?? "").toLowerCase();
  for (const k of [1, 2, 3, 4]) if (f.length >= k) out.push([`end:${k}`, f.slice(-k), cls]);
  for (const k of [1, 2, 3]) if (f.length >= k) out.push([`beg:${k}`, f.slice(0, k), cls]);
  out.push(["class", "", cls]);
  const toks = sent?.tokens ?? [];
  const pos = toks.indexOf(t);
  if (pos >= 0) {
    const L = pos > 0 ? toks[pos - 1] : null, R = pos < toks.length - 1 ? toks[pos + 1] : null;
    out.push(["left", L ? String(L.form).toLowerCase() : "^", cls]);
    out.push(["right", R ? String(R.form).toLowerCase() : "$", cls]);
    out.push(["lclass", L ? String(L.upos ?? "") : "^", cls]);
    out.push(["rclass", R ? String(R.upos ?? "") : "$", cls]);
    if (t.id != null) {
      const aux = toks.filter((x) => x.upos === "AUX" && x.head === t.id).map((x) => String(x.lemma ?? x.form).toLowerCase()).sort();
      if (aux.length) out.push(["aux", aux.join("+"), cls]);
    }
  }
  return out;
}

const bump = (m, k, v) => { let e = m.get(k); if (!e) { e = new Map(); m.set(k, e); } e.set(v, (e.get(v) ?? 0) + 1); };
const argmax = (dist) => { let best = null, n = -1; for (const [v, c] of dist) if (c > n || (c === n && v < best)) { best = v; n = c; } return best; };
const total = (dist) => { let n = 0; for (const c of dist.values()) n += c; return n; };

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// THE SEARCH STATISTIC IS SURPRISE IN BITS, NOT z. Measured on Latin
// (2026-09-25): z = excess / sqrt(np(1-p)) reaches ≈10 for ONE token of a
// rare value under a rare key (n = 1, p = 0.01), so a floor set by the
// best z in a shuffled rerun was set by such flukes and killed every
// mid-support cue beneath them — Case coverage fell to 44%. The exact
// binomial tail has no such blow-up: one token of a 1% value is 6.6 bits,
// a perfect ending over 700 tokens at a 42% base is hundreds. −log2 P(X ≥
// ok | n, p), summed from ok upward until the terms vanish.
function lgamma(x) {
  // Lanczos, g = 7 — the standard coefficients
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i += 1) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const logChoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
export function binomialSurprise(ok, n, p) {
  if (n <= 0 || ok <= 0) return 0;
  if (p >= 1) return 0;
  if (p <= 0) p = 1 / (n + 1);
  if (ok <= n * p) return 0; // depleted or at base: no enrichment to be surprised by
  const lp = Math.log(p), lq = Math.log(1 - p);
  let logTerm = logChoose(n, ok) + ok * lp + (n - ok) * lq;
  let sum = logTerm;
  for (let j = ok + 1; j <= n; j += 1) {
    logTerm += Math.log((n - j + 1) / j) + lp - lq;
    // log-sum-exp, stopping once the tail no longer moves the sum
    const m = Math.max(sum, logTerm);
    const next = m + Math.log(Math.exp(sum - m) + Math.exp(logTerm - m));
    if (next - sum < 1e-12) { sum = next; break; }
    sum = next;
  }
  return -sum / Math.LN2;
}

/** The learning tokens of `feature`: every token that states it, plus —
 *  the negative evidence — every token of a class that ever states it but
 *  here carries nothing, as UNMARKED. */
export function carriersOf(sentences, feature) {
  const classes = new Set();
  for (const s of sentences) for (const t of s.tokens) if (featsOf(t.feats).has(feature)) classes.add(t.upos ?? "");
  const out = [];
  sentences.forEach((s, si) => {
    for (const t of s.tokens) {
      const v = featsOf(t.feats).get(feature);
      if (v == null && !classes.has(t.upos ?? "")) continue;
      out.push({ token: t, sentence: si, value: v ?? UNMARKED, keys: cuesOf(t, s).map(([k, key, cls]) => cueKey(k, key, cls)) });
    }
  });
  return { tokens: out, classes };
}

/** One pass of the search over a labelling: candidates (both halves, same
 *  value) with observed accuracy, excess and z on B. Pure in its inputs, so
 *  the same pass serves the real labels and every shuffled rerun. */
function search(A, B, labelsA, labelsB) {
  const TA = new Map(), TB = new Map();
  A.forEach((c, i) => { for (const k of c.keys) bump(TA, k, labelsA[i]); });
  B.forEach((c, i) => { for (const k of c.keys) bump(TB, k, labelsB[i]); });
  const base = new Map();
  for (const v of labelsB) base.set(v, (base.get(v) ?? 0) + 1);
  for (const [v, n] of base) base.set(v, n / labelsB.length);
  const out = [];
  for (const [key, distA] of TA) {
    const distB = TB.get(key);
    if (!distB) continue;
    const v = argmax(distA);
    if (v !== argmax(distB)) continue;
    const n = total(distB), ok = distB.get(v) ?? 0, p = base.get(v) ?? 0;
    out.push({ key, value: v, accuracy: ok / n, excess: ok - n * p, surprise: binomialSurprise(ok, n, p), support: total(distA) + n, firesB: n });
  }
  return out;
}

/**
 * learnFeature(sentences, feature, { draws, reruns, seed })
 * Returns the frozen model: admitted cues with their settled value, held-out
 * accuracy, z, support and null rank; the search floor; and everything
 * refused, with why.
 */
export function learnFeature(sentences, feature, { draws = NULL.draws, reruns = NULL.reruns, seed = NULL.seed } = {}) {
  const { tokens: carriers, classes } = carriersOf(sentences, feature);
  const A = carriers.filter((c) => c.sentence % 2 === 0), B = carriers.filter((c) => c.sentence % 2 === 1);
  const values = [...new Set(carriers.map((c) => c.value))].sort();
  const meta = (floor) => ({ schema: SCHEMA, feature, values, classes: [...classes].sort(), floor, carriers: carriers.filter((c) => c.value !== UNMARKED).length, unmarked: carriers.filter((c) => c.value === UNMARKED).length, halves: { A: A.length, B: B.length }, null: { draws, reruns, seed } });
  const empty = (floor = 0) => freeze({ ...meta(floor), cues: freeze({}), admitted: 0, candidates: 0, refused: freeze([]) });
  if (!A.length || !B.length) return empty();

  const labelsA = A.map((c) => c.value), labelsB = B.map((c) => c.value);
  const candidates = search(A, B, labelsA, labelsB);
  const rng = lcg(seed);

  // null 3 — the search's own floor: the best z any candidate reaches when
  // every label is shuffled across all learning tokens
  let floor = 0;
  const all = carriers.map((c) => c.value);
  for (let r = 0; r < reruns; r += 1) {
    const L = shuffled(all, rng);
    const la = [], lb = [];
    carriers.forEach((c, i) => (c.sentence % 2 === 0 ? la : lb).push(L[i]));
    for (const c of search(A, B, la, lb)) if (c.surprise > floor) floor = c.surprise;
  }
  if (!candidates.length) return empty(floor);

  // null 2 — each candidate's own: its firing set's share of its value under B's labels shuffled
  const firesB = new Map();
  B.forEach((c, i) => { for (const k of c.keys) { if (!firesB.has(k)) firesB.set(k, []); firesB.get(k).push(i); } });
  const beaten = new Map(candidates.map((c) => [c.key, 0]));
  const nullMax = new Map(candidates.map((c) => [c.key, 0]));
  for (let d = 0; d < draws; d += 1) {
    const L0 = shuffled(labelsB, rng);
    for (const c of candidates) {
      const idx = firesB.get(c.key) ?? [];
      let ok = 0;
      for (const i of idx) if (L0[i] === c.value) ok += 1;
      const acc = idx.length ? ok / idx.length : 0;
      if (acc >= c.accuracy) beaten.set(c.key, beaten.get(c.key) + 1);
      if (acc > nullMax.get(c.key)) nullMax.set(c.key, acc);
    }
  }

  const cues = {};
  const refused = [];
  for (const c of candidates) {
    const rank = beaten.get(c.key) / draws;
    const [kind, key, cls] = c.key.split(SEP);
    const entry = { kind, key, class: cls, value: c.value, accuracy: c.accuracy, excess: c.excess, surprise: c.surprise, support: c.support, rank, nullMax: nullMax.get(c.key) };
    if (rank === 0 && c.surprise > floor) cues[c.key] = freeze(entry);
    else refused.push(freeze({ ...entry, why: rank !== 0 ? "own null" : "search floor" }));
  }
  return freeze({ ...meta(floor), cues: freeze(cues), admitted: Object.keys(cues).length, candidates: candidates.length, refused: freeze(refused) });
}

/** predict(model, token, sentence) → { verdict: "bound"|"unmarked"|"contested"|"void", value, cue, rivals } */
export function predict(model, t, sent) {
  const firing = [];
  for (const [kind, key, cls] of cuesOf(t, sent)) { const c = model.cues[cueKey(kind, key, cls)]; if (c) firing.push(c); }
  if (!firing.length) return freeze({ verdict: "void", value: null, cue: null, rivals: [] });
  firing.sort((a, b) => b.accuracy - a.accuracy || b.support - a.support);
  const values = new Set(firing.map((c) => c.value));
  const top = firing[0];
  if (values.size === 1) return freeze({ verdict: top.value === UNMARKED ? "unmarked" : "bound", value: top.value, cue: top, rivals: [] });
  return freeze({ verdict: "contested", value: top.value, cue: top, rivals: firing.filter((c) => c.value !== top.value) });
}

/**
 * audit(model, sentences) — the gold read AFTER the model is fixed, as a
 * witness. Carriers: covered (a value offered), correct, contested, missed
 * as unmarked, missed as void. Non-carriers of carrier classes: false fires
 * (a value offered), silenced (unmarked or void).
 */
export function audit(model, sentences) {
  const feature = model.feature;
  const carrierClasses = new Set(model.classes ?? []);
  let carriers = 0, covered = 0, correct = 0, contested = 0, contestedCorrect = 0, missedUnmarked = 0, missedVoid = 0;
  const byKind = {}, byValue = {};
  const tally = (o, k, f) => { if (!o[k]) o[k] = { n: 0, correct: 0 }; o[k].n += 1; if (f) o[k].correct += 1; };
  let nonCarriers = 0, falseFires = 0, silenced = 0;
  for (const s of sentences) for (const t of s.tokens) {
    const v = featsOf(t.feats).get(feature);
    if (v == null) {
      if (!carrierClasses.has(t.upos ?? "")) continue;
      nonCarriers += 1;
      const p = predict(model, t, s);
      if (p.verdict === "void" || p.verdict === "unmarked") silenced += 1; else falseFires += 1;
      continue;
    }
    carriers += 1;
    const p = predict(model, t, s);
    if (p.verdict === "void") { missedVoid += 1; tally(byValue, v, false); continue; }
    if (p.value === UNMARKED) { missedUnmarked += 1; tally(byValue, v, false); continue; }
    covered += 1;
    const ok = p.value === v;
    if (ok) correct += 1;
    if (p.verdict === "contested") { contested += 1; if (ok) contestedCorrect += 1; }
    tally(byKind, p.cue.kind, ok);
    tally(byValue, v, ok);
  }
  const dominant = Object.entries(byKind).sort((a, b) => b[1].n - a[1].n)[0]?.[0] ?? null;
  return freeze({ feature, carriers, covered, correct, contested, contestedCorrect, missedUnmarked, missedVoid, nonCarriers, falseFires, silenced, dominantKind: dominant, byKind: freeze(byKind), byValue: freeze(byValue) });
}

/** Which cue kinds carry each value in a model — form (end/beg), class, or construction (left/right/lclass/rclass/aux). UNMARKED is left out. */
export function reachOf(model) {
  const out = {};
  for (const c of Object.values(model.cues)) {
    if (c.value === UNMARKED) continue;
    const family = c.kind.startsWith("end") || c.kind.startsWith("beg") ? "form" : c.kind === "class" ? "class" : "construction";
    if (!out[c.value]) out[c.value] = { form: 0, class: 0, construction: 0, best: null };
    out[c.value][family] += 1;
    if (!out[c.value].best || c.accuracy > out[c.value].best.accuracy) out[c.value].best = { kind: c.kind, key: c.key, class: c.class, accuracy: c.accuracy, support: c.support };
  }
  return freeze(out);
}

// ── THE CONVENTIONS ARE STORED WITH THEIR GIVERS, PERIOD AND REGION ──────────
// A learned convention is a fact about ONE language at ONE period in ONE
// register from ONE region — Vedic hymns are not "Sanskrit", 2004 newswire
// is Modern Standard Arabic and no one's spoken dialect, Herodotus is Ionic
// and the Gospels are Koine. A prior that does not say so would let a
// reader apply the Aeneid's case endings to a medieval charter without
// knowing it had. So a MorphCuesPrior@1 is refused unless its provenance
// names the giver, the period, the region, the register, the script, the
// license and the source, and says for each whether it was measured from
// the file or declared by the builder from the treebank's documentation
// (the discipline parser-eng-ewt.json's ParserProvenance@1 already holds).
export const PRIOR_SCHEMA = "MorphCuesPrior@1";
export const REQUIRED_PROVENANCE = Object.freeze(["giver", "period", "region", "register", "script", "license", "source"]);
export const BASES = Object.freeze(["measured from the file", "declared from the treebank's documentation", "declared by the builder — verify"]);

/** morphCuesFromPrior(raw) → { language, provenance, features } — refuses a
 *  prior with no giver, period, region, register, script, license or
 *  source, or one whose provenance field does not say its basis. */
export function morphCuesFromPrior(raw) {
  if (raw?.schema !== PRIOR_SCHEMA) throw new TypeError(`morphCuesFromPrior: unknown schema ${raw?.schema}`);
  const p = raw.provenance ?? {};
  for (const k of REQUIRED_PROVENANCE) {
    const v = p[k];
    const said = v && typeof v === "object" ? v.value : v;
    if (said == null || said === "") throw new TypeError(`morphCuesFromPrior: a prior must name its ${k} — a convention without a ${k} is a rule from nowhere`);
    if (v && typeof v === "object" && !BASES.includes(v.basis)) throw new TypeError(`morphCuesFromPrior: ${k} must say its basis (${BASES.join(" | ")})`);
  }
  if (!raw.language?.iso || !raw.language?.stage) throw new TypeError("morphCuesFromPrior: a prior must name its language — ISO code and stage (Vedic is not Classical)");
  return { language: raw.language, provenance: p, features: raw.features ?? {} };
}

// ── PERIOD, COMPARED MECHANICALLY WHEN BOTH SIDES DECLARE ONE ─────────────
// The prose period is the record; a prior MAY also declare
// language.span = { from, to } in years (negative = BCE) with its basis, and
// a read MAY declare --period=<year> or <from>..<to>. When both exist the
// overlap is a fact; when either is missing the answer is null — unknown,
// never assumed. A mismatch is DISCLOSED on every tense the convention
// fills and on the coverage line; it never blocks a read (a reader may
// choose the modern Hebrew convention for a Biblical text and must be told,
// not stopped).
export function parsePeriod(text) {
  const m = /^\s*(-?\d{1,5})(?:\s*\.\.\s*(-?\d{1,5}))?\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const from = Number(m[1]), to = m[2] != null ? Number(m[2]) : from;
  return from <= to ? { from, to } : { from: to, to: from };
}
export function periodOverlap(a, b) {
  if (!a || !b || !Number.isFinite(a.from) || !Number.isFinite(a.to) || !Number.isFinite(b.from) || !Number.isFinite(b.to)) return null;
  return a.from <= b.to && b.from <= a.to;
}

/**
 * witnessOf(loaded, feature) — a stored convention as a WITNESS: a predict
 * closure over one feature's admitted cues, usable on any token stream
 * shaped like the parser's rows (form, upos, id, head, lemma, and the
 * sentence's tokens). null when the prior holds no model for the feature,
 * so a caller can say "no convention learned" rather than guess. The
 * witness carries the prior's language and giver, so whatever it says can
 * be attributed: a value from Vedic hymns is never mistaken for one from a
 * 2004 newspaper.
 */
export function witnessOf(loaded, feature) {
  const model = loaded?.features?.[feature];
  if (!model || !model.cues) return null;
  return freeze({
    feature, language: loaded.language, giver: loaded.provenance?.giver?.value ?? null, admitted: model.admitted ?? Object.keys(model.cues).length,
    predict: (token, sent) => predict(model, token, sent),
  });
}
