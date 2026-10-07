// native/kernel/identity-trajectory.js — a being as a TRAJECTORY through
// time, read FOR A FOR-WHOM (2026-09-27). Medium-blind, kernel-level.
// Standing: nomination.
//
// User direction, in steps: identity has its centroid at a referent, and the
// beinghood extends through the holograph for a given for-whom until a DMD
// bounds it; that extent is the being's background, experience and
// relationships, "changing over time, and the specific trajectory of that";
// and the for-whom "is ALSO coming with priors and biases."
//
// PRIOR ART. A being is a four-dimensional worm of temporal stages (Lewis's
// perdurance); what makes the stages one being is GENIDENTITY (Carnap,
// Reichenbach) — identity of the trajectory; and what carries it is
// overlapping chains of connection, never resemblance of first to last
// (Parfit). So:
//
//   stagesOf       an anchor's occurrences cut into stages along story time;
//                  a stage's extent is the count of the features the for-whom
//                  COUNTS (its declared `universe`; empty = all)
//   continuity     each stage against the being's NEXT stage, beside every
//                  other anchor's stage at that same time. A link holds when
//                  the next stage is closer to this one than EVERY other
//                  anchor's is (p <= 1/(others+1), reported). Continuity is a
//                  chain of such links — distant stages may be unalike.
//   similarityAt   one stage of A against B at the same time, ranked among
//                  the other anchors: where two extents overlap, and when
//   splice         the control built to fail: another anchor's stage spliced
//                  into a trajectory must break the chain at the splice
//   mergeBelief    the for-whom's PRIOR that two expressions are one being,
//                  updated scene by scene through the reading cursor. A prior
//                  that yields to the material is a prior; one whose share of
//                  the verdict does not fall, or that nobody declared, is a
//                  bias. The likelihoods are declared by the caller with
//                  their giver, never fitted here.
// The organ reads no spelling and names no medium; frames and positions are
// opaque integers, features opaque keys.

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/** The features a for-whom counts: its declared universe, or all if empty. */
export function lensOf(forWhom) {
  const u = new Set(forWhom?.universe ?? []);
  return u.size ? (f) => u.has(f) : () => true;
}

/** stagesOf(occurrences, { stageSize, minPerStage, forWhom }) -> Map stage -> { n, vec } */
export function stagesOf(occurrences, { stageSize, minPerStage, forWhom } = {}) {
  if (!Number.isInteger(stageSize) || !Number.isInteger(minPerStage)) throw new TypeError("identity-trajectory: stageSize and minPerStage must be declared");
  const counts = lensOf(forWhom);
  const stages = new Map();
  for (const o of occurrences ?? []) {
    const s = Math.floor(o.at / stageSize);
    if (!stages.has(s)) stages.set(s, { n: 0, vec: new Map() });
    const st = stages.get(s); st.n += 1;
    for (const x of o.features ?? []) { const f = x?.f ?? x; if (counts(f)) st.vec.set(f, (st.vec.get(f) ?? 0) + 1); }
  }
  for (const [s, st] of stages) if (st.n < minPerStage || !st.vec.size) stages.delete(s);
  return stages;
}

/** Rank of `self` among `others` (higher similarity first); beatsAll when above every other. */
function place(self, others) {
  const higher = others.filter((x) => x >= self).length;
  return { beatsAll: others.length > 0 && higher === 0, rank: higher + 1, of: others.length + 1, p: (higher + 1) / (others.length + 1) };
}

/** continuity(byAnchor, anchor, { minOthers }) -> { links, holds, breaks, gaps, continuous } */
export function continuity(byAnchor, anchor, { minOthers } = {}) {
  if (!Number.isInteger(minOthers)) throw new TypeError("identity-trajectory: minOthers must be declared");
  const mine = byAnchor.get(anchor); if (!mine) return { links: [], holds: 0, breaks: 0, gaps: 0, continuous: null };
  const order = [...mine.keys()].sort((a, b) => a - b);
  const links = [];
  for (let i = 0; i + 1 < order.length; i += 1) {
    const s = order[i], t = order[i + 1], here = mine.get(s).vec, next = mine.get(t).vec;
    const others = [...byAnchor].filter(([k, st]) => k !== anchor && st.has(t)).map(([, st]) => cosine(here, st.get(t).vec));
    if (others.length < minOthers) { links.push({ from: s, to: t, verdict: "gap", others: others.length }); continue; }
    const pl = place(cosine(here, next), others);
    links.push({ from: s, to: t, verdict: pl.beatsAll ? "holds" : "breaks", rank: pl.rank, of: pl.of, p: +pl.p.toFixed(3) });
  }
  const holds = links.filter((l) => l.verdict === "holds").length, breaks = links.filter((l) => l.verdict === "breaks").length;
  return { links, holds, breaks, gaps: links.length - holds - breaks, continuous: holds + breaks ? +(holds / (holds + breaks)).toFixed(3) : null };
}

/** similarityAt(byAnchor, a, b, stage) -> where b's stage sits among everyone's, seen from a */
export function similarityAt(byAnchor, a, b, stageA, stageB = stageA, { minOthers } = {}) {
  const A = byAnchor.get(a)?.get(stageA), B = byAnchor.get(b)?.get(stageB);
  if (!A || !B) return null;
  const others = [...byAnchor].filter(([k, st]) => k !== a && k !== b && st.has(stageB)).map(([, st]) => cosine(A.vec, st.get(stageB).vec));
  if (others.length < minOthers) return { gap: "too_few_others", others: others.length };
  const sim = cosine(A.vec, B.vec);
  return { sim: +sim.toFixed(4), ...place(sim, others) };
}

/** splice(byAnchor, anchor, donor, { every, keepDisplaced }) -> a copy of
 *  byAnchor where every `every`-th stage of `anchor` is replaced by the
 *  donor's stage at that time.
 *
 *  keepDisplaced (amended 2026-09-27, found by trajectory-eval v2): the stages
 *  the splice displaced stay in the comparison pool as a rival anchor. Without
 *  it the being's own continuation is absent, so the control only asks whether
 *  the donor is the being's nearest companion — which a close companion is.
 *  With it, the impostor must beat the being's true next stage to pass. */
export function splice(byAnchor, anchor, donor, { every, keepDisplaced = false } = {}) {
  const out = new Map(byAnchor); const mine = new Map(byAnchor.get(anchor)); const theirs = byAnchor.get(donor);
  const order = [...mine.keys()].sort((a, b) => a - b); const spliced = []; const displaced = new Map();
  order.forEach((s, i) => { if (i > 0 && i % every === 0 && theirs?.has(s)) { displaced.set(s, mine.get(s)); mine.set(s, theirs.get(s)); spliced.push(s); } });
  out.set(anchor, mine); out.delete(donor); // the donor is no longer a separate comparison: it IS the splice
  if (keepDisplaced && displaced.size) out.set(`${anchor}#displaced`, displaced);
  return { byAnchor: out, spliced };
}

/** weightByDistinction(byAnchor) -> the same stages with each feature weighted
 *  by how FEW anchors share it at that stage: ln(anchors present / anchors
 *  holding it). A feature every being shares at a moment makes no difference
 *  among them and weighs 0 — the DMD among beings, measured per stage, never a
 *  list of generic features typed here. (Found by trajectory-eval v2: acts
 *  every character performs dominated the similarity.) */
export function weightByDistinction(byAnchor) {
  const stages = new Set(); for (const st of byAnchor.values()) for (const s of st.keys()) stages.add(s);
  const df = new Map(), present = new Map();
  for (const s of stages) {
    const holders = [...byAnchor.values()].filter((st) => st.has(s));
    present.set(s, holders.length);
    const d = new Map(); for (const st of holders) for (const f of st.get(s).vec.keys()) d.set(f, (d.get(f) ?? 0) + 1);
    df.set(s, d);
  }
  const out = new Map();
  for (const [k, st] of byAnchor) {
    const w = new Map();
    for (const [s, { n, vec }] of st) {
      const v = new Map(); for (const [f, c] of vec) { const idf = Math.log(present.get(s) / df.get(s).get(f)); if (idf > 0) v.set(f, c * idf); }
      w.set(s, { n, vec: v });
    }
    out.set(k, w);
  }
  return out;
}

/**
 * mergeBelief(framesA, framesB, { prior, likelihood, window, totalFrames })
 * The for-whom's belief that A and B are one being, read scene by scene.
 *   prior       { logOdds, giver } | null   (null: the material alone)
 *   likelihood  { same, different, giver }: the co-presence rate within a
 *               shared scene, relative to independent placement, under each
 *               hypothesis — declared, with the run it was measured on
 * Poisson likelihoods per shared scene. Returns the belief's trajectory, the
 * final log-odds, and whether the prior YIELDED (its share of the final
 * log-odds fell below one half, and the verdict matches the material alone).
 */
export function mergeBelief(framesA, framesB, { prior = null, likelihood, window, totalFrames } = {}) {
  if (!likelihood?.giver || !(likelihood.same > 0) || !(likelihood.different > 0)) throw new TypeError("identity-trajectory: likelihood rates and their giver must be declared");
  if (prior && !prior.giver) throw new TypeError("identity-trajectory: a prior without a giver is a bias");
  if (!Number.isInteger(window) || !Number.isInteger(totalFrames)) throw new TypeError("identity-trajectory: window and totalFrames must be declared");
  const A = new Set(framesA), B = new Set(framesB), scenes = new Map();
  for (const [set, key] of [[A, "a"], [B, "b"]]) for (const f of set) { const s = Math.floor(f / window); if (!scenes.has(s)) scenes.set(s, { a: new Set(), b: new Set() }); scenes.get(s)[key].add(f); }
  const p0 = prior?.logOdds ?? 0; let evidence = 0, absEvidence = 0;
  const path = [];
  for (const [s, sc] of [...scenes].sort((x, y) => x[0] - y[0])) {
    if (!sc.a.size || !sc.b.size) continue;
    const size = Math.min(window, totalFrames - s * window), e = (sc.a.size * sc.b.size) / size;
    const k = [...sc.a].filter((f) => sc.b.has(f)).length;
    const llr = k * Math.log(likelihood.same / likelihood.different) - (likelihood.same - likelihood.different) * e;
    evidence += llr; absEvidence += Math.abs(llr);
    path.push({ scene: s, cursor: Math.min(totalFrames, (s + 1) * window), k, expected: +e.toFixed(3), logOdds: +(p0 + evidence).toFixed(3), priorShare: +(Math.abs(p0) / (Math.abs(p0) + absEvidence || 1)).toFixed(3) });
  }
  const final = p0 + evidence, materialAlone = evidence;
  const priorShare = Math.abs(p0) / (Math.abs(p0) + absEvidence || 1);
  return {
    logOdds: +final.toFixed(3), verdict: final > 0 ? "same" : final < 0 ? "different" : "undecided",
    materialAlone: { logOdds: +materialAlone.toFixed(3), verdict: materialAlone > 0 ? "same" : materialAlone < 0 ? "different" : "undecided" },
    prior: prior ? { logOdds: p0, giver: prior.giver, finalShare: +priorShare.toFixed(3), yielded: priorShare < 0.5 && Math.sign(final) === Math.sign(materialAlone) } : null,
    likelihood: { same: likelihood.same, different: likelihood.different, giver: likelihood.giver },
    sharedScenes: path.length, path,
  };
}
