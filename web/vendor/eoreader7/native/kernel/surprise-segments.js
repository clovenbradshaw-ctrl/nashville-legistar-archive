/* Rubin speaks:
 * “Es  ist  dieser  Unterschied,  hier  der  Unter- 
schied zwischen  Figur  und  Grund  benannt,  den  ich  zu  unter- 
suchen mich  bemüht  habe.”
 *
 * This file implements Rubin's figure-ground boundary analysis, where the segment boundary is situated where the ground was most wrong.  I believe it's vital to analyze and test the boundary's effects in a rigorous fashion, rather than solely relying on a subjective interpretation.
 *
 * — the engineering record below, kept whole —
 */
// kernel/surprise-segments.js — ground / figure / pattern, as a recursive
// Handle: Rubin — after Edgar Rubin's figure-ground boundary: the segment boundary sits exactly where the ground was most wrong. Amendment XVII.
// segmentation of any stream by its own surprise. Medium-blind.
//
// THE CLAIM THIS MAKES OPERATIONAL (user, 2026-09-02): "the system has no
// view from nowhere and never is without Bayesian priors … music exists in
// statements too — in ground / figure / pattern that need to be segmented
// recursively, more elegantly than language ever can."
//
// GROUND is the prior so far: everything heard, sedimented, predicting the
// next event. FIGURE is the event that departs from it — its surprise, in
// bits, measured BEFORE it arrives (prequential; ground-ledger.js's
// firewall). PATTERN is what the figures do to the ground next: the
// segments they cut, which become the events of the next level, where the
// same three terms apply again. A boundary is not a rule about commas or
// bar lines; it is where the ground was most wrong.
//
// THE NULL IS BUILT IN (II.23). Where a boundary sits is decided against
// the same stream with its order destroyed: the surprise an event must
// reach to cut is the (1−alpha) quantile of the surprises the SHUFFLED
// stream produces under the same reader. A stream whose surprises never
// exceed what shuffling produces has no figures, and this file says so
// rather than cutting anyway.
//
// NOTHING NAMED. No sentence, bar, phrase, note or word appears in this
// code; the caller's instruments decide what an event is, and the caller's
// own script (punctuation, bar lines) is the ORACLE a boundary is tested
// against — never something the segmenter reads.
import { sedimentPrior, predictNext, shapeOf, lcg, shuffled } from "./continuation.js";

const freeze = (v) => Object.freeze(v);

/** surprises(events, { order, alphabetSize }) — each event's bits under the ground so far (the prior grows as it reads). */
export function surprises(events, { order, alphabetSize = null } = {}) {
  if (!Number.isInteger(order) || order < 1) throw new TypeError("surprises: order is declared");
  const ev = (events ?? []).map(String);
  const out = new Float64Array(ev.length);
  const alphabet = new Map();
  const tables = new Map();
  for (let k = 1; k <= order; k += 1) tables.set(k, new Map());
  const prior = { order, alphabet, tables };
  const floorOf = () => 1 / ((alphabetSize ?? alphabet.size) + 1);
  for (let i = 0; i < ev.length; i += 1) {
    const p = i ? predictNext(prior, ev.slice(Math.max(0, i - order), i)) : { dist: new Map() };
    const prob = p.dist.get(ev[i]) ?? 0;
    out[i] = -Math.log2(Math.max(prob, floorOf()));
    // sediment this event into the ground, at every grain
    alphabet.set(ev[i], (alphabet.get(ev[i]) ?? 0) + 1);
    for (let k = 1; k <= order && i - k >= 0; k += 1) {
      const ctx = ev.slice(i - k, i).join(" ");
      const t = tables.get(k);
      if (!t.has(ctx)) t.set(ctx, new Map());
      const m = t.get(ctx); m.set(ev[i], (m.get(ev[i]) ?? 0) + 1);
    }
  }
  return out;
}

export const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

/**
 * segmentBySurprise(events, { order, alpha, draws, seed, minLength }) →
 *   { boundaries, segments, cut, surprises, nullCut, figures }
 * A boundary is placed BEFORE event i when its surprise is at or above the
 * null's (1−alpha) quantile AND is a local maximum (the figure's own peak,
 * not its shoulder). `minLength` (declared) refuses cuts that would make a
 * segment shorter than it — a figure needs room to be one.
 */
export function segmentBySurprise(events, { order, alpha, draws, seed, minLength, alphabetSize = null } = {}) {
  for (const [k, v] of Object.entries({ alpha, draws, seed, minLength })) if (!Number.isFinite(v)) throw new TypeError(`segmentBySurprise: ${k} is declared`);
  const ev = (events ?? []).map(String);
  if (ev.length < 2) return freeze({ boundaries: [], segments: [ev], cut: 0, surprises: [], nullCut: 0, figures: 0, refused: ev.length < 2 ? "too_short" : null });
  const s = surprises(ev, { order, alphabetSize });
  // THE NULL: the same reader over the same events with their order destroyed
  const rng = lcg(seed);
  const pooled = [];
  for (let d = 0; d < draws; d += 1) for (const x of surprises(shuffled(ev, rng), { order, alphabetSize })) pooled.push(x);
  pooled.sort((a, b) => a - b);
  const cut = quantile(pooled, 1 - alpha);
  const boundaries = [];
  let last = 0;
  for (let i = 1; i < ev.length; i += 1) {
    const peak = s[i] >= cut && s[i] >= (s[i - 1] ?? -Infinity) && s[i] >= (s[i + 1] ?? -Infinity);
    if (peak && i - last >= minLength) { boundaries.push(i); last = i; }
  }
  const segments = [];
  let from = 0;
  for (const b of boundaries) { segments.push(ev.slice(from, b)); from = b; }
  segments.push(ev.slice(from));
  return freeze({ boundaries: freeze(boundaries), segments: freeze(segments.map(freeze)), cut, surprises: freeze(Array.from(s)), nullCut: cut, figures: boundaries.length, refused: null });
}

/**
 * segmentToken(segment, { order }) — what a segment IS at the next level:
 * its move-shape signature (repeat / return / new, symbol-free) plus its
 * length. Two segments with the same signature are the same kind of thing
 * whatever their symbols were — which is what lets the next level find
 * PATTERN across figures made of different notes or different words.
 */
export function segmentToken(segment, { order } = {}) {
  if (!Number.isInteger(order) || order < 1) throw new TypeError("segmentToken: order is declared");
  const seen = new Set();
  const shapes = [];
  for (let i = 0; i < segment.length; i += 1) { shapes.push(shapeOf(segment.slice(0, i), segment[i], seen, order)); seen.add(segment[i]); }
  return `${segment.length}:${shapes.join(".")}`;
}

/**
 * recursiveSegments(events, { order, alpha, draws, seed, minLength, depth })
 * → one level per depth: the stream at that level, its boundaries, its
 * segments, and the tokens that form the next level's stream. Stops early,
 * saying so, when a level cuts nothing (no figures) or has too few events.
 */
export function recursiveSegments(events, { order, alpha, draws, seed, minLength, depth } = {}) {
  if (!Number.isInteger(depth) || depth < 1) throw new TypeError("recursiveSegments: depth is declared");
  const levels = [];
  let stream = (events ?? []).map(String);
  for (let d = 0; d < depth; d += 1) {
    // each level's floor is its own alphabet — measured (2026-09-02): without it the
    // same stream cut 77 figures called directly and 0 inside the recursion
    const seg = segmentBySurprise(stream, { order, alpha, draws, seed: seed + d, minLength, alphabetSize: new Set(stream).size });
    const tokens = seg.segments.map((x) => segmentToken(x, { order }));
    levels.push(freeze({ level: d, events: stream.length, boundaries: seg.boundaries, figures: seg.figures, cut: seg.cut, tokens: freeze(tokens), distinctTokens: new Set(tokens).size, refused: seg.refused }));
    if (seg.refused || seg.figures === 0 || tokens.length < 2 * minLength) { levels[levels.length - 1] = freeze({ ...levels[levels.length - 1], stopped: seg.refused ?? (seg.figures === 0 ? "no_figures" : "too_few_segments") }); break; }
    stream = tokens;
  }
  return freeze(levels);
}
