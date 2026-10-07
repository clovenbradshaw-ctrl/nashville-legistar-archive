// variety-lens.js — no text is simply "English". A reader holds many lenses,
// one per variety it has learned from that variety's own text, and says
// which lens it read a passage through and why. Cube cell EVA·Figure
// (Interpretation, terrain Lens, stance Binding): evaluating which lens
// binds the material. Handle: Sullivan.
//
// The user (2026-09-23): "we shouldn't say 'this is english', we should be
// like 'we think this is this sort of english because the rules extracted
// from these priors made the content less surprising and increased our
// comprehension/competency'." So every attribution this file makes is a
// comparative, evidenced statement: the best lens, how much less surprising
// it made the text than the runner-up (bits per word), and how much more of
// the text it knew. A segment no lens explains — more surprising under its
// best lens than 99% of that lens's own held-out text — is left in the Void,
// never forced onto the nearest label.
//
// A LENS is three layers of counts from one variety's own text: word pairs
// (enough to carry "he be working" vs "he is working", "dey go" vs "is
// going"), single words, and letter sequences within words (enough to carry
// "Heauen" vs "heaven", "wetin", "richts"). Each layer backs off to the one
// below by Witten-Bell interpolation, which has no tunable constant: the
// weight given to the lower layer is the share of distinct continuations
// seen, measured from the counts themselves.
//
// COMPREHENSION is measured where a gold standard exists (a most-frequent-
// tag tagger per variety, scored against that variety's own held-out gold
// tags) and approximated by known-word coverage where it does not.
//
// What this does NOT do: it does not read meaning, and lower surprisal is
// evidence about FORM (words, spelling, local word order), not about who
// did what to whom. A lens built from a few thousand words is weak evidence
// and says so through its own held-out spread.

import { tokenize } from "./nominal-beings.js";
import { claimFromTriple } from "../../kernel/gfp-claim.js";

const WORD = /\p{L}/u;
/** Words of a text: letter-bearing tokens, lowercased (nominal-beings.js's tokenizer). */
export const wordsOf = (text) => tokenize(String(text ?? "")).map((t) => t.w).filter((w) => WORD.test(w));

function charModel(types) {
  // Witten-Bell over letter trigrams inside word boundaries (^^ … $),
  // trained on DISTINCT words: it exists to spell words the lens has not
  // seen, so a frequent word must not dominate it.
  const ctx = [new Map(), new Map(), new Map()]; // order 0 key "", order 1 key c1, order 2 key c1c2
  const alphabet = new Set();
  const bump = (m, h, c) => { let e = m.get(h); if (!e) m.set(h, (e = { n: 0, next: new Map() })); e.n += 1; e.next.set(c, (e.next.get(c) ?? 0) + 1); };
  for (const w of types.keys()) {
    const s = `^^${w}$`;
    for (let i = 2; i < s.length; i += 1) {
      const c = s[i];
      alphabet.add(c);
      bump(ctx[0], "", c); bump(ctx[1], s[i - 1], c); bump(ctx[2], s.slice(i - 2, i), c);
    }
  }
  const base = 1 / (alphabet.size + 1);
  const p = (h2, h1, c) => {
    let prob = base;
    for (const [m, h] of [[ctx[0], ""], [ctx[1], h1], [ctx[2], h2]]) {
      const e = m.get(h);
      if (!e) continue;
      const T = e.next.size;
      prob = ((e.next.get(c) ?? 0) + T * prob) / (e.n + T);
    }
    return prob;
  };
  return (w) => {
    const s = `^^${w}$`;
    let lp = 0;
    for (let i = 2; i < s.length; i += 1) lp += Math.log2(p(s.slice(i - 2, i), s[i - 1], s[i]));
    return lp; // log2 probability of the whole spelling
  };
}

/**
 * buildLens(units, meta) — `units` is an array of texts (sentences, lines or
 * paragraphs) from ONE variety, in reading order. Word pairs never cross a
 * unit boundary.
 */
export function buildLens(units, { id, label = id, lexifier = "English", spelling = true, ...meta } = {}) {
  const uni = new Map(), bi = new Map();
  let N = 0;
  for (const u of units) {
    const ws = wordsOf(u);
    ws.forEach((w, i) => {
      uni.set(w, (uni.get(w) ?? 0) + 1); N += 1;
      if (i > 0) { const v = ws[i - 1]; let e = bi.get(v); if (!e) bi.set(v, (e = { n: 0, next: new Map() })); e.n += 1; e.next.set(w, (e.next.get(w) ?? 0) + 1); }
    });
  }
  const spell = charModel(uni);
  const spellCache = new Map();
  const T = uni.size;
  // spelling off (an ablation): every unseen word shares one "unknown" slot,
  // P = T/(N+T) — Witten-Bell's own unseen mass, no constant typed in.
  const log2Word = spelling
    ? (w) => {
        let s = spellCache.get(w);
        if (s === undefined) { s = spell(w); spellCache.set(w, s); }
        return Math.log2(((uni.get(w) ?? 0) + T * 2 ** s) / (N + T));
      }
    : (w) => Math.log2(uni.has(w) ? uni.get(w) / (N + T) : T / (N + T));
  return { id, label, lexifier, ...meta, spelling, tokens: N, types: T, uni, bi, log2Word };
}

/** Mean bits per word of `words` under a lens; `order` 1 = single words, 2 = word pairs. */
export function bitsPerWord(lens, words, { order = 2 } = {}) {
  if (!words.length) return null;
  let bits = 0;
  words.forEach((w, i) => {
    const lw = lens.log2Word(w);
    if (order < 2 || i === 0) { bits -= lw; return; }
    const e = lens.bi.get(words[i - 1]);
    if (!e) { bits -= lw; return; }
    const Tv = e.next.size;
    bits -= Math.log2(((e.next.get(w) ?? 0) + Tv * 2 ** lw) / (e.n + Tv));
  });
  return bits / words.length;
}

/** Share of `words` the lens has seen at least once. */
export const coverage = (lens, words) => (words.length ? words.filter((w) => lens.uni.has(w)).length / words.length : null);

/** The 99th percentile of a lens's bits/word over its OWN held-out segments — its void bar. */
export function voidBar(lens, heldOutSegments, { order = 2 } = {}) {
  const xs = heldOutSegments.map((ws) => bitsPerWord(lens, ws, { order })).filter((x) => x != null).sort((a, b) => a - b);
  return xs.length ? xs[Math.min(xs.length - 1, Math.floor(0.99 * xs.length))] : Infinity;
}

/**
 * attribute(words, lenses, {bars, reference, order, id}) — rank every lens,
 * state the evidence, emit a claim. `reference` names the lens comparison
 * coverage is reported against (default: the first English lens).
 */
export function attribute(words, lenses, { bars = {}, reference = null, order = 2, id = "segment" } = {}) {
  const ranked = lenses.map((l) => ({ lens: l, bits: bitsPerWord(l, words, { order }), coverage: coverage(l, words) })).sort((a, b) => a.bits - b.bits);
  const [best, second] = ranked;
  const margin = second ? second.bits - best.bits : null;
  const ref = ranked.find((r) => r.lens.id === reference) ?? null;
  const isVoid = best.bits > (bars[best.lens.id] ?? Infinity);
  const pct = (x) => `${(100 * x).toFixed(0)}%`;
  let verdict;
  if (isVoid) verdict = `no lens we hold explains this well: even the closest, ${best.lens.label}, leaves it at ${best.bits.toFixed(2)} bits/word, more surprising than 99% of that lens's own held-out text`;
  else {
    const kind = best.lens.lexifier === "English" ? `${best.lens.label}-like English` : `not English but ${best.lens.label}`;
    verdict = `we think this is ${kind}, because the ${best.lens.label} lens made it ${margin.toFixed(2)} bits/word less surprising than the ${second.lens.label} lens`
      + (ref && ref.lens.id !== best.lens.id ? `, and known-word coverage rose from ${pct(ref.coverage)} under the ${ref.lens.label} lens to ${pct(best.coverage)}` : "");
  }
  const claim = claimFromTriple(id, isVoid ? "reads-best-through-but-void" : "reads-best-through", best.lens.id, { basis: `margin ${margin?.toFixed(3)} bits/word over ${second?.lens.id}` });
  return { best: best.lens.id, second: second?.lens.id ?? null, bits: best.bits, margin, void: isVoid, verdict, claim, ranked: ranked.map((r) => ({ id: r.lens.id, bits: +r.bits.toFixed(4), coverage: r.coverage == null ? null : +r.coverage.toFixed(4) })) };
}

// ── comprehension against gold: a tagger per variety ───────────────────────
/** trainTagger(sentences) — sentences are [[form, upos], ...]; most frequent
 *  tag per word, then per 3-letter suffix, then the overall most frequent. */
export function trainTagger(sentences) {
  const byWord = new Map(), bySuffix = new Map(), all = new Map();
  const bump = (m, k, t) => { let e = m.get(k); if (!e) m.set(k, (e = new Map())); e.set(t, (e.get(t) ?? 0) + 1); };
  for (const s of sentences) for (const [f, t] of s) { const w = f.toLowerCase(); bump(byWord, w, t); bump(bySuffix, w.slice(-3), t); all.set(t, (all.get(t) ?? 0) + 1); }
  const top = (e) => [...e].sort((a, b) => b[1] - a[1])[0][0];
  const fallback = top(all);
  return (form) => { const w = form.toLowerCase(); const e = byWord.get(w) ?? bySuffix.get(w.slice(-3)); return e ? top(e) : fallback; };
}
/** tagAccuracy(tagger, sentences) — share of gold tokens tagged correctly. */
export function tagAccuracy(tagger, sentences) {
  let n = 0, ok = 0;
  for (const s of sentences) for (const [f, t] of s) { n += 1; if (tagger(f) === t) ok += 1; }
  return n ? ok / n : null;
}
