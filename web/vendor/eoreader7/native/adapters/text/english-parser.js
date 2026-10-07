// Handle: Chomsky — a grammar is learned from what was heard, and then it reads what it never heard.
// See also: the reading-competency audit this file's held-out numbers anchor
// (74.0% recall / 73.7% precision, SVO-first, vs the live route's 0.9%/18.5%,
// null-confirmed p=1.9e-43) — github.com/clovenbradshaw-ctrl/reading-training
// adapters/text/english-parser.js — RAW ENGLISH → UNIVERSAL DEPENDENCIES, mechanically.
//
// The rich EOT (kernel/eot-rich.js) takes a Universal Dependencies analysis
// in. Until now that meant gold annotation only: the engine could round-trip a
// treebank but could not read a page of English it was handed. This is the
// reader that closes that gap for English: raw text in, one full analysis per
// sentence out — word class, lemma, morphological features, head and
// relation — in the same shape a treebank gives, so every downstream organ
// (the cube typing, the two-layer record, the round trip) is unchanged.
//
// NO LANGUAGE MODEL. Four small learned parts, each trained on the English
// treebank the project already holds (UD_English-EWT) and each measured on a
// held-out tenth it never saw:
//
//   tokenizer   the treebank's own conventions (clitics split, punctuation
//               separate), measured against the treebank's own raw text
//   tagger      an averaged perceptron over the word and its neighbours
//   parser      arc-eager transitions, an averaged perceptron choosing each
//               move, a static oracle to learn from
//   labeller    an averaged perceptron naming each arc the parser drew
//   lemma/feats the treebank's own tallies, keyed by form and word class,
//               backing off to the ending — the Greek/Sanskrit ending-prior
//               discipline, ambiguity resolved by count, never by rule
//
// Every part is deterministic: training shuffles with a seeded generator, so
// the same treebank yields the same model byte for byte.

export const PARSER_SCHEMA = "EnglishParser@1";

// ── the averaged perceptron ────────────────────────────────────────────────
export class Perceptron {
  constructor(classes) {
    this.classes = classes;
    this.n = classes.length;
    this.index = new Map(classes.map((c, i) => [c, i]));
    this.w = new Map();
    this.tot = new Map();
    this.ts = new Map();
    this.i = 0;
  }
  scores(feats) {
    const s = new Float64Array(this.n);
    for (const f of feats) {
      const w = this.w.get(f);
      if (!w) continue;
      for (let c = 0; c < this.n; c++) s[c] += w[c];
    }
    return s;
  }
  best(feats, valid = null) {
    const s = this.scores(feats);
    let bi = -1, bv = -Infinity;
    for (let c = 0; c < this.n; c++) {
      if (valid && !valid[c]) continue;
      if (s[c] > bv || (s[c] === bv && bi >= 0 && this.classes[c] < this.classes[bi])) { bv = s[c]; bi = c; }
    }
    return bi;
  }
  // ADDITIVE, NEVER CALLED BY best() ABOVE (2026-09-26): best() already
  // computes this same score array and then throws away everything except
  // the winning index, at every one of its 6 real call sites in this file --
  // none of them expect a changed return shape, so best() itself stays
  // untouched. This exposes the margin between the top class and the
  // runner-up: a standard linear-classifier confidence measure, not an
  // invented threshold -- no cutoff is applied here, the raw margin is
  // handed to whichever future caller decides what to do with it (the
  // real prerequisite for a register/confidence-aware backoff, found
  // missing while diagnosing why "Photosynthesis converts..." mistagged
  // "converts" as NOUN with no way for a caller to have known the decision
  // was close or confident).
  bestWithMargin(feats, valid = null) {
    const s = this.scores(feats);
    let bi = -1, bv = -Infinity, second = -Infinity;
    for (let c = 0; c < this.n; c++) {
      if (valid && !valid[c]) continue;
      if (s[c] > bv || (s[c] === bv && bi >= 0 && this.classes[c] < this.classes[bi])) { second = bv; bv = s[c]; bi = c; }
      else if (s[c] > second) second = s[c];
    }
    return { index: bi, margin: bi < 0 ? null : (second === -Infinity ? Infinity : bv - second) };
  }
  update(truth, guess, feats) {
    this.i++;
    if (truth === guess) return;
    for (const f of feats) {
      let w = this.w.get(f);
      if (!w) { w = new Float32Array(this.n); this.w.set(f, w); this.tot.set(f, new Float32Array(this.n)); this.ts.set(f, new Float32Array(this.n)); }
      const tot = this.tot.get(f), ts = this.ts.get(f);
      for (const [c, v] of [[truth, 1], [guess, -1]]) {
        tot[c] += (this.i - ts[c]) * w[c];
        ts[c] = this.i;
        w[c] += v;
      }
    }
  }
  tick() { this.i++; }
  average() {
    for (const [f, w] of this.w) {
      const tot = this.tot.get(f), ts = this.ts.get(f);
      let any = false;
      for (let c = 0; c < this.n; c++) {
        const t = tot[c] + (this.i - ts[c]) * w[c];
        w[c] = t / Math.max(1, this.i);
        if (w[c] !== 0) any = true;
      }
      if (!any) this.w.delete(f);
    }
    this.tot = null; this.ts = null;
  }
  toJSON() {
    const w = {};
    for (const [f, arr] of this.w) {
      const pairs = [];
      for (let c = 0; c < this.n; c++) if (arr[c] !== 0) pairs.push(c, Math.round(arr[c] * 1e4) / 1e4);
      if (pairs.length) w[f] = pairs;
    }
    return { classes: this.classes, w };
  }
  static fromJSON(j) {
    const p = new Perceptron(j.classes);
    for (const [f, pairs] of Object.entries(j.w)) {
      const arr = new Float32Array(p.n);
      for (let k = 0; k < pairs.length; k += 2) arr[pairs[k]] = pairs[k + 1];
      p.w.set(f, arr);
    }
    return p;
  }
}

export function seeded(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}
const shuffle = (arr, rand) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── tokenizer ──────────────────────────────────────────────────────────────
// The treebank's conventions: clitics split off their host ("do" + "n't",
// "John" + "'s"), punctuation separate, a URL or e-mail address kept whole.
// Both straight and curly apostrophes, because literature uses the curly one.
const CLITIC = /^(.+?)(n['’]t|['’](?:s|re|ve|ll|m|d|S|RE|VE|LL|M|D))$/;
const NEGATIVE_CLITIC = /^(.+?)(N['’]T)$/;
const KEEP_WHOLE = /^(?:https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+|\d+(?:[.,:]\d+)+|[A-Za-z]\.(?:[A-Za-z]\.)+|(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt|vs|etc|Prof|Gen|Col|Capt|Lt|Rev|Hon|No)\.)$/;

export function tokenize(text) {
  const out = [];
  const raw = String(text ?? "");
  const re = /\S+/g;
  let m;
  while ((m = re.exec(raw))) {
    let chunk = m[0];
    let at = m.index;
    const pieces = [];
    if (KEEP_WHOLE.test(chunk)) { pieces.push(chunk); }
    else {
      // leading punctuation
      const lead = [];
      while (chunk.length > 1 && /^[\p{P}\p{S}]/u.test(chunk) && !/^['’][a-z]/i.test(chunk.slice(0, 2))) { lead.push(chunk[0]); chunk = chunk.slice(1); }
      // a leading apostrophe that is punctuation (an open quote)
      if (/^['’]\S/.test(chunk) && !/^['’](s|re|ve|ll|m|d|t)\b/i.test(chunk)) { lead.push(chunk[0]); chunk = chunk.slice(1); }
      const trail = [];
      while (chunk.length > 1 && /[\p{P}\p{S}]$/u.test(chunk) && !KEEP_WHOLE.test(chunk)) {
        // keep an abbreviation's own period when the chunk is an abbreviation
        trail.unshift(chunk[chunk.length - 1]); chunk = chunk.slice(0, -1);
      }
      pieces.push(...lead);
      const c = CLITIC.exec(chunk) || NEGATIVE_CLITIC.exec(chunk);
      if (c && c[1].length) {
        // "can't" → "ca" + "n't", "won't" → "wo" + "n't": the treebank's split
        pieces.push(c[1], c[2]);
      } else if (chunk.includes("—") || chunk.includes("--")) {
        for (const p of chunk.split(/(—|--)/)) if (p) pieces.push(p);
      } else pieces.push(chunk);
      pieces.push(...trail);
    }
    for (const p of pieces) {
      const i = raw.indexOf(p, at);
      out.push({ form: p, start: i, end: i + p.length });
      at = i + p.length;
    }
  }
  return out;
}

const SENTENCE = new Intl.Segmenter("en", { granularity: "sentence" });
/** Sentences as {text, start, end} over the raw bytes, by the script's own
 *  sentence rules (ICU). Paragraph breaks always end a sentence. */
export function sentences(text) {
  const out = [];
  const raw = String(text ?? "");
  const paraRe = /\n\s*\n/g;
  let last = 0; const paras = [];
  let m;
  while ((m = paraRe.exec(raw))) { paras.push([last, m.index]); last = m.index + m[0].length; }
  paras.push([last, raw.length]);
  for (const [a, b] of paras) {
    const chunk = raw.slice(a, b);
    for (const { segment, index } of SENTENCE.segment(chunk)) {
      const t = segment.trim();
      if (!t) continue;
      const s = a + index + segment.indexOf(t);
      out.push({ text: t, start: s, end: s + t.length });
    }
  }
  return out;
}

// ── tagger ─────────────────────────────────────────────────────────────────
const normalize = (w) => {
  if (w.includes("-") && w[0] !== "-") return "!HYPHEN";
  if (/^\d{4}$/.test(w)) return "!YEAR";
  if (/^\d/.test(w)) return "!DIGITS";
  return w.toLowerCase();
};
const shapeOf = (w) => w.replace(/[A-Z]+/g, "X").replace(/[a-z]+/g, "x").replace(/[0-9]+/g, "d").slice(0, 6);

function tagFeatures(i, word, context, prev, prev2) {
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const w = context[i + 2];
  add("b");
  add("s3", w.slice(-3)); add("s2", w.slice(-2)); add("p1", w[0]);
  add("t-1", prev); add("t-2", prev2); add("t-1t-2", prev, prev2);
  add("w", w); add("t-1w", prev, w);
  add("w-1", context[i + 1]); add("s3-1", context[i + 1].slice(-3)); add("w-2", context[i]);
  add("w+1", context[i + 3]); add("s3+1", context[i + 3].slice(-3)); add("w+2", context[i + 4]);
  add("sh", shapeOf(word)); add("cap", /^[A-Z]/.test(word) ? (i === 0 ? "first" : "mid") : "no");
  return f;
}

export function tagSentence(tagger, words) {
  const context = ["-START-", "-START2-", ...words.map(normalize), "-END-", "-END2-"];
  let prev = "-START-", prev2 = "-START2-";
  const tags = [];
  for (let i = 0; i < words.length; i++) {
    const c = tagger.best(tagFeatures(i, words[i], context, prev, prev2));
    const t = tagger.classes[c];
    tags.push(t); prev2 = prev; prev = t;
  }
  return tags;
}

// ADDITIVE SIBLING (2026-09-26): an exact structural mirror of tagSentence
// above, reusing the SAME unexported tagFeatures so the two can never
// silently drift apart -- the only difference is bestWithMargin in place
// of best(), returning each token's own decision margin alongside its tag.
// Built to run the real measurement the ledger named as the next licensed
// step: does margin actually predict tagging errors on real held-out gold
// data, or not. tagSentence itself is untouched.
export function tagSentenceWithMargins(tagger, words) {
  const context = ["-START-", "-START2-", ...words.map(normalize), "-END-", "-END2-"];
  let prev = "-START-", prev2 = "-START2-";
  const tags = [], margins = [];
  for (let i = 0; i < words.length; i++) {
    const r = tagger.bestWithMargin(tagFeatures(i, words[i], context, prev, prev2));
    const t = tagger.classes[r.index];
    tags.push(t); margins.push(r.margin); prev2 = prev; prev = t;
  }
  return { tags, margins };
}

// ── parser: arc-eager ──────────────────────────────────────────────────────
export const ACTIONS = ["SHIFT", "REDUCE", "LEFT", "RIGHT"];
const distBucket = (d) => (d <= 4 ? String(d) : d <= 7 ? "5-7" : "8+");

function parseFeatures(st, words, tags) {
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const s0 = st.stack.length ? st.stack[st.stack.length - 1] : -1;
  const s1 = st.stack.length > 1 ? st.stack[st.stack.length - 2] : -1;
  const n0 = st.i < st.n ? st.i : -1, n1 = st.i + 1 < st.n ? st.i + 1 : -1, n2 = st.i + 2 < st.n ? st.i + 2 : -1;
  const W = (k) => (k < 0 ? "∅" : k === 0 ? "ROOT" : words[k]);
  const T = (k) => (k < 0 ? "∅" : k === 0 ? "ROOT" : tags[k]);
  const lc = (k) => (k > 0 && st.left[k].length ? T(st.left[k][0]) : "∅");
  const rc = (k) => (k > 0 && st.right[k].length ? T(st.right[k][st.right[k].length - 1]) : "∅");
  const s0w = W(s0), s0t = T(s0), n0w = W(n0), n0t = T(n0), n1t = T(n1), n2t = T(n2), n1w = W(n1), s1t = T(s1);
  const dist = s0 > 0 && n0 > 0 ? distBucket(n0 - s0) : "∅";
  const s0h = s0 > 0 && st.head[s0] >= 0 ? T(st.head[s0]) : "∅";
  add("b");
  add("s0w", s0w); add("s0t", s0t); add("s0wt", s0w, s0t);
  add("n0w", n0w); add("n0t", n0t); add("n0wt", n0w, n0t);
  add("n1w", n1w); add("n1t", n1t); add("n2t", n2t); add("s1t", s1t);
  add("s0w n0w", s0w, n0w); add("s0t n0t", s0t, n0t); add("s0wt n0t", s0w, s0t, n0t); add("s0t n0wt", s0t, n0w, n0t);
  add("s0t n0t n1t", s0t, n0t, n1t); add("n0t n1t n2t", n0t, n1t, n2t); add("s1t s0t n0t", s1t, s0t, n0t);
  add("s0t s0l n0t", s0t, lc(s0), n0t); add("s0t s0r n0t", s0t, rc(s0), n0t); add("s0t n0t n0l", s0t, n0t, lc(n0));
  add("s0h s0t n0t", s0h, s0t, n0t);
  add("d s0t n0t", dist, s0t, n0t); add("d s0w", dist, s0w); add("d n0w", dist, n0w);
  add("vl s0", s0t, s0 > 0 ? st.left[s0].length : 0); add("vr s0", s0t, s0 > 0 ? st.right[s0].length : 0);
  add("vl n0", n0t, n0 > 0 ? st.left[n0].length : 0);
  add("s0hasHead", s0 > 0 ? String(st.head[s0] >= 0) : "∅");
  return f;
}

function newState(n) {
  return { n, i: 1, stack: [0], head: new Array(n).fill(-1), left: Array.from({ length: n }, () => []), right: Array.from({ length: n }, () => []) };
}
function validMoves(st) {
  const s0 = st.stack.length ? st.stack[st.stack.length - 1] : -1;
  const hasBuf = st.i < st.n;
  return [
    hasBuf,                                      // SHIFT
    s0 > 0 && st.head[s0] >= 0,                  // REDUCE
    hasBuf && s0 > 0 && st.head[s0] < 0,         // LEFT: n0 → s0
    hasBuf && s0 >= 0,                           // RIGHT: s0 → n0
  ];
}
function apply(st, a) {
  const s0 = st.stack[st.stack.length - 1];
  if (a === 0) { st.stack.push(st.i); st.i++; }
  else if (a === 1) { st.stack.pop(); }
  else if (a === 2) { st.head[s0] = st.i; st.left[st.i].unshift(s0); st.stack.pop(); }
  else if (a === 3) { st.head[st.i] = s0; st.right[s0].push(st.i); st.stack.push(st.i); st.i++; }
}
/** The static oracle: the move that keeps the gold tree reachable. */
function oracle(st, gold) {
  const s0 = st.stack.length ? st.stack[st.stack.length - 1] : -1;
  const n0 = st.i < st.n ? st.i : -1;
  if (s0 > 0 && n0 > 0 && gold[s0] === n0) return 2;
  if (s0 >= 0 && n0 > 0 && gold[n0] === s0) return 3;
  if (s0 > 0 && st.head[s0] >= 0) {
    if (n0 < 0) return 1;
    for (let k = 0; k < st.stack.length - 1; k++) { const w = st.stack[k]; if (gold[n0] === w || gold[w] === n0) return 1; }
  }
  if (n0 < 0 && s0 > 0) return 1;
  return 0;
}

/** Parse one sentence (1-based arrays with index 0 = ROOT). Returns heads. */
export function parseSentence(parser, words, tags) {
  const n = words.length;
  const st = newState(n);
  let guard = 0;
  while ((st.i < n || st.stack.length > 1) && guard++ < 4 * n + 10) {
    const valid = validMoves(st);
    if (!valid.some(Boolean)) break;
    const a = parser.best(parseFeatures(st, words, tags), valid);
    apply(st, a);
  }
  // Anything left without a head attaches to the first root-level word, or
  // becomes the root: a tree is always returned, never a forest.
  const roots = [];
  for (let k = 1; k < n; k++) if (st.head[k] < 0 || st.head[k] === 0) roots.push(k);
  const root = roots[0] ?? 1;
  for (let k = 1; k < n; k++) {
    if (k === root) st.head[k] = 0;
    else if (st.head[k] < 0 || st.head[k] === 0) st.head[k] = root;
  }
  return st.head;
}

// ── labeller ───────────────────────────────────────────────────────────────
function labelFeatures(d, heads, words, tags, children) {
  const h = heads[d];
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const dw = words[d].toLowerCase(), dt = tags[d];
  const hw = h === 0 ? "ROOT" : words[h].toLowerCase(), ht = h === 0 ? "ROOT" : tags[h];
  const dir = h === 0 ? "root" : d < h ? "L" : "R";
  add("b"); add("dw", dw); add("dt", dt); add("hw", hw); add("ht", ht);
  add("dt ht", dt, ht); add("dt ht dir", dt, ht, dir); add("dw ht", dw, ht); add("dt hw", dt, hw);
  add("dir dist", dir, distBucket(Math.abs(d - h))); add("dsuf ht", dw.slice(-3), ht);
  add("dt ht dir dist", dt, ht, dir, distBucket(Math.abs(d - h)));
  for (const c of children[d]) { add("dchild", tags[c]); add("dchild w", words[c].toLowerCase()); add("dchild dt", tags[c], dt, ht); }
  const hh = h > 0 ? heads[h] : -1;
  add("hht", hh > 0 ? tags[hh] : hh === 0 ? "ROOT" : "∅", ht, dt);
  return f;
}
const childrenOf = (heads) => { const c = heads.map(() => []); for (let k = 1; k < heads.length; k++) if (heads[k] > 0) c[heads[k]].push(k); return c; };

export function labelSentence(labeller, heads, words, tags) {
  const children = childrenOf(heads);
  const labels = new Array(heads.length).fill("_");
  for (let d = 1; d < heads.length; d++) labels[d] = heads[d] === 0 ? "root" : labeller.classes[labeller.best(labelFeatures(d, heads, words, tags, children))];
  return labels;
}

// ── lemma and features, from the treebank's own tallies ────────────────────
export function buildLexicon(sents) {
  const byForm = new Map(), bySuffix = new Map(), byUpos = new Map();
  const bump = (m, k, v) => { let e = m.get(k); if (!e) { e = new Map(); m.set(k, e); } e.set(v, (e.get(v) ?? 0) + 1); };
  for (const s of sents) for (const t of s.tokens) {
    const lf = t.form.toLowerCase();
    bump(byForm, `${lf}|${t.upos}`, `${t.lemma}\t${t.feats}`);
    for (const k of [3, 2, 1]) bump(bySuffix, `${lf.slice(-k)}|${k}|${t.upos}`, `${lemmaRule(t.form, t.lemma)}\t${t.feats}`);
    bump(byUpos, t.upos, t.feats);
  }
  const top = (m) => { const o = {}; for (const [k, e] of m) o[k] = [...e.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0]; return o; };
  return { form: top(byForm), suffix: top(bySuffix), upos: top(byUpos) };
}
/** A lemma rule relative to the form: how many characters to cut, what to
 *  add, and the case. "running"/"run" → "cut4+n"? No: learned as the
 *  shortest cut-and-add pair, the ending discipline. */
function lemmaRule(form, lemma) {
  const f = form.toLowerCase(), l = lemma.toLowerCase();
  let p = 0; while (p < f.length && p < l.length && f[p] === l[p]) p++;
  return `${f.length - p}:${l.slice(p)}`;
}
function applyRule(form, rule) {
  const [cut, add] = [Number(rule.split(":")[0]), rule.split(":").slice(1).join(":")];
  const base = form.toLowerCase();
  return base.slice(0, base.length - cut) + add;
}
export function lemmaAndFeats(lexicon, form, upos) {
  const lf = form.toLowerCase();
  const hit = lexicon.form[`${lf}|${upos}`];
  if (hit) { const [lemma, feats] = hit.split("\t"); return { lemma: upos === "PROPN" && lemma.toLowerCase() === lf ? form : lemma, feats, basis: "form" }; }
  for (const k of [3, 2, 1]) {
    const r = lexicon.suffix[`${lf.slice(-k)}|${k}|${upos}`];
    if (r) { const [rule, feats] = r.split("\t"); const lemma = applyRule(form, rule); return { lemma: upos === "PROPN" ? form : lemma, feats, basis: `ending -${lf.slice(-k)}` }; }
  }
  return { lemma: upos === "PROPN" ? form : lf, feats: lexicon.upos[upos] ?? "_", basis: "word class" };
}

// ── the whole reader ───────────────────────────────────────────────────────
export function loadModel(json) {
  return {
    tagger: Perceptron.fromJSON(json.tagger),
    parser: Perceptron.fromJSON(json.parser),
    labeller: Perceptron.fromJSON(json.labeller),
    lexicon: json.lexicon,
    meta: json.meta,
  };
}

/** Analyse already-tokenized words. Returns UD rows (1-based ids). */
export function analyse(model, forms) {
  const tags = tagSentence(model.tagger, forms);
  const words = ["ROOT", ...forms], T = ["ROOT", ...tags];
  const heads = parseSentence(model.parser, words, T);
  const labels = labelSentence(model.labeller, heads, words, T);
  return forms.map((form, k) => {
    const { lemma, feats } = lemmaAndFeats(model.lexicon, form, tags[k]);
    return { id: k + 1, form, lemma, upos: tags[k], xpos: "_", feats, head: heads[k + 1], deprel: labels[k + 1], deps: "_", misc: "_" };
  });
}

/** Raw text in; one CoNLL-U block per sentence out, with the sentence's raw
 *  byte offsets kept as provenance in the comments. */
export function parseText(model, text, { idPrefix = "s" } = {}) {
  const out = [];
  let n = 0;
  for (const s of sentences(text)) {
    const toks = tokenize(s.text);
    if (!toks.length) continue;
    n++;
    const rows = analyse(model, toks.map((t) => t.form));
    rows.forEach((r, k) => { r.misc = `Offset=${s.start + toks[k].start}`; });
    const lines = [`# sent_id = ${idPrefix}${n}`, `# text = ${s.text.replace(/\s+/g, " ")}`, `# offset = ${s.start}-${s.end}`,
      ...rows.map((r) => [r.id, r.form, r.lemma, r.upos, r.xpos, r.feats, r.head, r.deprel, r.deps, r.misc].join("\t"))];
    out.push(lines.join("\n"));
  }
  return out.join("\n\n") + (out.length ? "\n" : "");
}

/**
 * upostOccurrences(model, text) — every token's OWN per-occurrence parsed
 * UPOS, keyed by its lowercased form: Map<form, [{off, upos}]>. The same
 * evidence parseText serialises to CoNLL-U, kept as data instead of a
 * string a caller would otherwise re-parse (measured live, 2026-09-23,
 * fixing the proper-name pipeline's SVO gap: every earlier ad hoc caller
 * was splitting parseText's own tab-separated output back apart to get
 * exactly this).
 *
 * THE POINT OF THIS FUNCTION (parse-gated-names.js's own reason for
 * existing): a token's UPOS here comes from tagging its OWN sentence, once
 * per occurrence — unlike a received POS prior's dominant class (a single
 * type-level lookup shared by every occurrence of a form) or a
 * capitalisation count (an orthographic fact, not a syntactic one). Two
 * occurrences of the same spelling can carry different tags here, which is
 * the whole reason this is worth keeping separate from either.
 */
export function upostOccurrences(model, text) {
  const out = new Map();
  for (const s of sentences(text)) {
    const toks = tokenize(text.slice(s.start, s.end)).map((t) => ({ form: t.form, start: s.start + t.start }));
    if (!toks.length) continue;
    let rows;
    try { rows = analyse(model, toks.map((t) => t.form)); } catch { continue; }
    rows.forEach((r, k) => {
      const key = toks[k].form.toLowerCase();
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ off: toks[k].start, upos: r.upos });
    });
  }
  return out;
}

// ── training ───────────────────────────────────────────────────────────────
const projective = (heads) => {
  const arcs = [];
  for (let d = 1; d < heads.length; d++) arcs.push([Math.min(d, heads[d]), Math.max(d, heads[d])]);
  for (const [a, b] of arcs) for (const [c, e] of arcs) if (a < c && c < b && b < e) return false;
  return true;
};

export function train(sents, { iterations = 5, seed = "ewt", log = () => {} } = {}) {
  const upos = [...new Set(sents.flatMap((s) => s.tokens.map((t) => t.upos)))].sort();
  const labels = [...new Set(sents.flatMap((s) => s.tokens.map((t) => t.deprel)).filter((l) => l !== "root"))].sort();
  const tagger = new Perceptron(upos);
  const parser = new Perceptron(ACTIONS);
  const labeller = new Perceptron(labels);
  const rand = seeded(seed);
  const data = sents.map((s) => ({ forms: s.tokens.map((t) => t.form), tags: s.tokens.map((t) => t.upos), heads: [-1, ...s.tokens.map((t) => t.head)], labels: ["_", ...s.tokens.map((t) => t.deprel)] }));
  const parsable = data.filter((d) => projective(d.heads));
  for (let it = 0; it < iterations; it++) {
    let tagOk = 0, tagN = 0, moveOk = 0, moveN = 0;
    for (const d of shuffle(data, rand)) {
      // tagger: greedy, learning from its own previous predictions
      const context = ["-START-", "-START2-", ...d.forms.map(normalize), "-END-", "-END2-"];
      let prev = "-START-", prev2 = "-START2-";
      for (let i = 0; i < d.forms.length; i++) {
        const f = tagFeatures(i, d.forms[i], context, prev, prev2);
        const g = tagger.best(f), t = tagger.index.get(d.tags[i]);
        tagger.update(t, g, f);
        tagN++; if (g === t) tagOk++;
        prev2 = prev; prev = tagger.classes[g];
      }
    }
    for (const d of shuffle(parsable, rand)) {
      // parser: gold tags in training (predicted tags differ at test time, and
      // the measured score says what that costs)
      const words = ["ROOT", ...d.forms], tags = ["ROOT", ...d.tags];
      const st = newState(words.length);
      let guard = 0;
      while ((st.i < st.n || st.stack.length > 1) && guard++ < 4 * st.n + 10) {
        const valid = validMoves(st);
        if (!valid.some(Boolean)) break;
        const gold = oracle(st, d.heads);
        const f = parseFeatures(st, words, tags);
        const g = parser.best(f, valid);
        parser.update(gold, g, f);
        moveN++; if (g === gold) moveOk++;
        apply(st, valid[gold] ? gold : g);
      }
      // labeller: gold arcs
      const children = childrenOf(d.heads);
      for (let k = 1; k < words.length; k++) {
        if (d.heads[k] === 0) continue;
        const f = labelFeatures(k, d.heads, words, tags, children);
        const g = labeller.best(f), t = labeller.index.get(d.labels[k]);
        if (t === undefined) continue;
        labeller.update(t, g, f);
      }
    }
    log(`iteration ${it + 1}/${iterations}: tagger ${(100 * tagOk / tagN).toFixed(2)}% on training, parser moves ${(100 * moveOk / moveN).toFixed(2)}%`);
  }
  tagger.average(); parser.average(); labeller.average();
  return {
    schema: PARSER_SCHEMA,
    meta: { trainedOn: sents.length, projectiveUsed: parsable.length, iterations, seed },
    tagger: tagger.toJSON(), parser: parser.toJSON(), labeller: labeller.toJSON(),
    lexicon: buildLexicon(sents),
  };
}

/**
 * eotFromText(model, text, { source, toEot, parseConllu }) → one rich EOT
 * record per sentence, each carrying `span: [start, end]` in the text's own
 * string coordinates, so `text.slice(start, end)` reproduces the sentence
 * exactly. The rich-record module is passed in rather than imported, so this
 * adapter stays free of a kernel dependency; the record carries the parser's
 * provenance beside it when the model has one.
 */
export function eotFromText(model, text, { source = "text", toEot, parseConllu } = {}) {
  if (typeof toEot !== "function" || typeof parseConllu !== "function") throw new TypeError("eotFromText: pass { toEot, parseConllu } from kernel/eot-rich.js");
  const out = [];
  for (const s of parseConllu(parseText(model, text))) {
    const off = /^# offset = (\d+)-(\d+)$/m.exec(s.lines.join("\n"));
    const rec = toEot(s, { language: "eng", source });
    rec.span = off ? [Number(off[1]), Number(off[2])] : null;
    rec.parser = model.provenance ?? null;
    out.push(rec);
  }
  return out;
}
