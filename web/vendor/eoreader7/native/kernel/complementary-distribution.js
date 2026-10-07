// native/kernel/complementary-distribution.js — do two expressions pick out
// ONE referent? Read off how the medium's users place them (2026-09-27).
// Medium-blind, kernel-level. Standing: nomination.
//
// User direction: identity is about referents, never strings; "the point of
// language is to be understood." A speaker who wants to be understood does
// not name one thing twice in one breath — "Pierre ... he", not "Pierre ...
// Bezukhov" in the same sentence — while two different people in the same
// scene are named together all the time ("Pierre and Natasha"). So two
// expressions for one referent share SCENES and avoid sharing a FRAME.
//
// PRIOR ART. This is complementary distribution, the structuralist test by
// which two phones are one phoneme (they occur in the same environments at
// the coarse grain, never contrast at the fine one; Harris 1951). No spelling
// is read: it connects "Pierre" with "Bezukhov" as readily as "Наташа" with
// "Наташу", and a shared string is no evidence at all.
//
// THE MEASURE. Frames are the medium's finest unit a speaker fills at once (a
// sentence, a shot, a bar); scenes are windows of `window` consecutive frames.
// Only scenes where BOTH expressions occur count — expressions that never
// share a scene are a GAP, never "different": two storylines apart say
// nothing about identity. Within those scenes the observed number of frames
// holding both is compared with a null that redeals each expression's frames
// uniformly within its own scene (counts and scenes kept, frame placement
// destroyed), `draws` times, seeded.
//
//   complementary   observed below the null at p <= alpha: one referent,
//                   a CANDIDATE for identity — never a proof
//   together  observed above the null at p <= alpha: two referents
//                   named side by side — RAISED against, never convicting
//                   (only a declared constraint convicts)
//   unsettled       neither
//   gap             fewer than `minSharedScenes` shared scenes
// Every number is declared by the caller.

import { createSeededRng } from "./rng.js";

export function complementaryDistribution(framesA, framesB, { window, draws, alpha, seed, minSharedScenes, totalFrames } = {}) {
  for (const [k, v] of Object.entries({ window, draws, alpha, seed, minSharedScenes, totalFrames })) if (v == null) throw new TypeError(`complementary-distribution: '${k}' must be declared`);
  const A = new Set(framesA), B = new Set(framesB);
  const scenes = new Map();
  const place = (set, key) => { for (const f of set) { const s = Math.floor(f / window); if (!scenes.has(s)) scenes.set(s, { a: new Set(), b: new Set() }); scenes.get(s)[key].add(f); } };
  place(A, "a"); place(B, "b");
  const shared = [...scenes].filter(([, v]) => v.a.size && v.b.size).map(([s, v]) => ({ scene: s, a: v.a, b: v.b, size: Math.min(window, totalFrames - s * window) }));
  if (shared.length < minSharedScenes) return Object.freeze({ verdict: "gap", reason: "no_shared_scenes", sharedScenes: shared.length, floor: minSharedScenes });
  const observed = shared.reduce((n, sc) => n + [...sc.a].filter((f) => sc.b.has(f)).length, 0);
  const rng = createSeededRng({ seed, purpose: "complementary-distribution" });
  // draw k distinct frames of a scene of `size`, uniformly
  const sample = (size, k) => { const out = new Set(); while (out.size < Math.min(k, size)) out.add(Math.floor(rng() * size)); return out; };
  const nulls = [];
  for (let d = 0; d < draws; d += 1) {
    let n = 0;
    for (const sc of shared) { const a = sample(sc.size, sc.a.size), b = sample(sc.size, sc.b.size); for (const f of a) if (b.has(f)) n += 1; }
    nulls.push(n);
  }
  const expected = nulls.reduce((x, y) => x + y, 0) / draws;
  const pLow = (nulls.filter((x) => x <= observed).length + 1) / (draws + 1);
  const pHigh = (nulls.filter((x) => x >= observed).length + 1) / (draws + 1);
  const verdict = pLow <= alpha ? "complementary" : pHigh <= alpha ? "together" : "unsettled";
  return Object.freeze({ verdict, observed, expected: +expected.toFixed(3), ratio: expected ? +(observed / expected).toFixed(3) : null, pLow: +pLow.toFixed(4), pHigh: +pHigh.toFixed(4), sharedScenes: shared.length, declared: { window, draws, alpha, seed, minSharedScenes } });
}
