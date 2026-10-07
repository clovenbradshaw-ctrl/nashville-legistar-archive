// native/adapters/text/verb-synonym-disclosure.js — Roget's second ground:
// a DISCLOSED grouping of candidate verbs that may name the same act, laid
// beside the mechanical vocabulary, never merged into it.
//
// THE GAP THIS ANSWERS (measured, not asserted — see
// native/eval/verb-synonym-fold-benchmark.mjs for the run this cites).
// discoverRelationVocab (relations.js:404-406,421,755) admits a candidate
// verb keyed by its exact lowercased surface token, and extractRelations
// matches a triple only against that literal Set. morphology.js's
// actClosure/createLemmatizer — this codebase's only existing act-folding
// mechanism — widens FORM (trudged -> trudges) strictly by shared lemma; it
// never folds a different lemma however synonymous ("verified" and
// "recheck", "captured" and "took" are BOTH real, same-fact restatements
// found in this repo's own fixtures, and sameAct is false on both by
// construction: lemmasOf("captured") = {captured, captur, capture},
// lemmasOf("took") = {took, take} — no overlap). Two clauses stating the
// identical real-world fact with two different, non-inflectional verbs are
// therefore never recognised as testimony for the same act anywhere in this
// pipeline.
//
// WHY THIS IS ITS OWN FILE, NOT A CHANGE TO EITHER EXISTING ONE.
// relations.js's own header already draws the line this file must not
// cross: "no triple is emitted without a literal verb match in the
// vocabulary it was handed" — that is a promise about FABRICATION, and nothing
// here is licensed to loosen it. morphology.js's actClosure carries an
// equally load-bearing promise the other direction: "the closure never adds
// an act the material did not earn — it widens FORM, not vocabulary." A
// synonym is not a form of the same act; it is a SECOND witness that the
// same act happened, worded differently. Folding it into actClosure's own
// forms Set would make "captured" and "took" the same STRING everywhere a
// caller reads `forms`, silently deciding a question actClosure's own
// contract says it never decides. So this stays a third, separate function:
// it reads the outputs of the other two, changes neither, and its own
// output is additive metadata a caller may attach or ignore.
//
// THE SHAPE, exactly the precedent already set (native/memory/activation.js
// :339-374, the ONE prior real benchmark of an embedding against this
// lineage's mechanical tiers — a Hebbian sparse code beat a ColBERT-style
// retriever there, and the design rule that measurement produced is
// followed verbatim here):
//
//   1. INJECTED, NEVER IMPORTED. `embed` is a plain function the caller
//      hands in — this file has no model baked into it, no vocabulary, no
//      download, and imports nothing (same wall morphology.js's own header
//      already states for itself). With no `embed`, the answer is a typed
//      gap, never a silent zero standing in for "no synonymy found."
//
//   2. IT RERANKS WHAT THE MECHANICAL TIER ALREADY SURFACED — it does not
//      discover a vocabulary of its own. The input is exactly
//      discoverRelationVocab's own `candidates` array (real, attested verb
//      tokens with real surface counts this document already earned); an
//      embedding is never asked to nominate a verb the mechanical gate did
//      not already admit as a candidate. If the mechanical tier surfaced
//      fewer than two candidates, there is nothing to rerank, and the gap
//      says so rather than being filled by a guess. (This is also why
//      "recheck" in the katherine-johnson-body fixture — a real synonym for
//      an admitted verb — cannot be disclosed by this file at all: it never
//      becomes a candidate in the first place, a SEPARATE and prior gap in
//      discoverRelationVocab's own positional tallyAfter, which no
//      embedding downstream of that gate can reach.)
//
//   3. NO COSINE IS EVER HAND-SET. P (CLAUDE.md, "no hand-set thresholds,
//      prefer a measured null"): a pair's standing here is its RANK inside
//      the EXACT population of every other pair this same document's own
//      candidate pool produces — never a fixed cosine cutoff chosen by
//      feel. The nearest-neighbour pick itself is an argmax (activation.js's
//      own `top`), which needs no threshold at all; the rank/percentile
//      attached to it is the measured null, reported so a caller can judge
//      the pick's strength rather than being told pass/fail by this file.
//
//   4. THE MECHANICAL TIER'S OWN VERDICT RIDES ALONGSIDE, NEVER RECONCILED.
//      When a caller injects `sameAct` (createLemmatizer's own, real), each
//      disclosed pair also carries whether the LEMMA tier already agrees.
//      Where it does not — "captured"/"took", different lemmas, real
//      embedding proximity — that disagreement IS the finding
//      (activation.js:370-375, "plural grounds for one figure are legal,
//      and their disagreement is the only self-check"). Nothing here
//      merges the two verbs into one vocabulary entry; a downstream
//      consumer (a human reviewer, or a later mechanical check) decides
//      what a disclosed, disagreeing pair is worth. No triple is ever
//      emitted, rewritten, or relabelled by this file — extractRelations's
//      own literal VERB_ALT match stays the only thing that licenses a
//      triple, exactly as before this file existed.
//
// MEASURED, on this repo's real fixtures (native/eval/
// verb-synonym-fold-benchmark.mjs, real nomic-embed-text embeddings from an
// already-running local ollama server — nothing installed or downloaded to
// run it): the one gold same-fact/different-verb pair that clears
// discoverRelationVocab's own candidate gate for both members
// ("captured"/"took", borodino-excerpt.txt vs this repo's own
// witness-paraphrase.mjs item 10) ranks in the top 12 of 378 real
// same-document candidate pairs (96.8th percentile, exact rank p ~= 0.032)
// and is literally rank 1 of 27 by cosine similarity when "captured" is
// used as the query — real, above-chance signal, on real data, with no
// cosine threshold anywhere in the measurement. A second gold pair
// ("verified"/"recheck") showed no comparable separation (ranked 39th of
// 54) when measured directly (it is not rerank-eligible — "recheck" never
// clears the candidate gate at all) — reported honestly rather than
// omitted, because one favourable instance is a finding, not a proof that
// this reliably closes the gap. See PROOF.md / the benchmark's own output
// for the full, unedited numbers.

/** The model tier's absence, stated once, the same shape activation.js's own NO_EMBEDDER uses. */
const NO_EMBEDDER = Object.freeze({
  gap: "undeclared",
  what: "embed",
  why: "verb synonymy across different lemmas is model-tier and needs a resolver with a giver; none was supplied",
});

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
};

/**
 * embeddingActDisclosure(candidates, embed, opts) -> { clusters, pairsConsidered, embedGaps, gap }
 *
 * `candidates` — discoverRelationVocab's own `candidates` array (or any
 *   iterable of `{verb}` objects or plain verb strings). This file measures
 *   nothing about the text itself; it only reranks tokens the mechanical
 *   tier already surfaced.
 *
 * `embed(token) -> number[] | null | undefined` — INJECTED, synchronous.
 *   A caller backed by a network embedder (this benchmark used ollama's
 *   nomic-embed-text) fetches every vector it needs BEFORE calling this
 *   function and hands in a plain lookup (`(t) => cache.get(t)`) — the
 *   engine-facing seam stays synchronous and free of any network or model
 *   dependency, exactly as activation.js's own `embed(ws) -> vector[]` does.
 *   Returning `null`/`undefined` for a token is a per-token gap (disclosed
 *   in `embedGaps`), never treated as "maximally dissimilar to everything."
 *
 * `sameAct(a, b) -> boolean` (optional) — createLemmatizer's own, real. When
 *   supplied, every disclosed pair also carries the mechanical tier's own
 *   verdict on that SAME pair, so agreement or disagreement between the two
 *   channels is visible on the record rather than silently reconciled.
 *
 * `maxCandidates` (default 400) — an ENGINEERING bound, not a significance
 *   threshold: this file enumerates the full O(n^2) pairwise population to
 *   compute an exact rank (never a sampled or hand-set one), so a caller
 *   whose mechanical tier surfaced an unusually large candidate pool must
 *   pre-filter (e.g. to `verbDominant` candidates) rather than have this
 *   function silently degrade to an approximation.
 *
 * Returns `clusters`: one entry per candidate that has a nearest neighbour,
 * `{ verb, neighbor, cosine, rankAmongPairs, pairsConsidered, rankP,
 * percentile, mutual, mechanicalAgrees, disagreement }`, sorted by cosine
 * descending. `rankAmongPairs` / `pairsConsidered` is the EXACT count of
 * same-pool pairs scoring at or above this one, out of every pair in the
 * pool — the measured null, not a threshold; `rankP` is that ratio, plain
 * arithmetic on the two counts a caller could otherwise recompute itself.
 * A mutual nearest-neighbour pair (each is the other's own top pick) is
 * reported once. Nothing here is filtered by rankP or cosine before being
 * returned — every candidate's own best pick is disclosed, strong or weak,
 * and the caller reads the rank to judge which.
 */
export const embeddingActDisclosure = (candidates, embed, { sameAct = null, maxCandidates = 400 } = {}) => {
  const tokens = [...new Set(
    [...(candidates ?? [])]
      .map((c) => (typeof c === "string" ? c : c?.verb))
      .filter((x) => typeof x === "string" && x.length > 0)
      .map((x) => x.toLowerCase()),
  )];

  if (tokens.length < 2) {
    return {
      clusters: [], pairsConsidered: 0, embedGaps: [],
      gap: { reason: "insufficient_candidates", tier: "structural", detail: `embeddingActDisclosure needs at least 2 distinct candidate verbs to rerank; the mechanical tier supplied ${tokens.length}` },
    };
  }
  if (!embed) return { clusters: [], pairsConsidered: 0, embedGaps: [], gap: NO_EMBEDDER };
  if (tokens.length > maxCandidates) {
    return {
      clusters: [], pairsConsidered: 0, embedGaps: [],
      gap: { reason: "candidate_pool_too_large", tier: "engineering", detail: `${tokens.length} candidates exceeds maxCandidates=${maxCandidates}; the exact same-pool null this file reports needs the full pairwise population — pre-filter the candidate pool rather than have this sample` },
    };
  }

  const vecOf = new Map();
  const embedGaps = [];
  for (const t of tokens) {
    const v = embed(t);
    if (v && v.length) vecOf.set(t, v); else embedGaps.push(t);
  }
  const covered = tokens.filter((t) => vecOf.has(t));
  if (covered.length < 2) {
    return {
      clusters: [], pairsConsidered: 0, embedGaps,
      gap: { reason: "embedder_returned_no_vectors", tier: "model", detail: "embed() was supplied but returned a usable vector for fewer than 2 of the candidates" },
    };
  }

  // ── THE EXACT NULL: every pair this document's own real candidate pool
  // produces, enumerated once. This population IS the measured null — no
  // sampling, no permutation needed, because it is small enough (bounded by
  // maxCandidates) to enumerate exactly.
  const pairSims = [];
  for (let i = 0; i < covered.length; i += 1) {
    for (let j = i + 1; j < covered.length; j += 1) pairSims.push(cosine(vecOf.get(covered[i]), vecOf.get(covered[j])));
  }
  const sortedAsc = [...pairSims].sort((a, b) => a - b);
  const atOrAbove = (sim) => {
    let lo = 0, hi = sortedAsc.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedAsc[mid] < sim) lo = mid + 1; else hi = mid; }
    return sortedAsc.length - lo;
  };

  // ── THE RERANK: each candidate's nearest neighbour among the OTHER
  // candidates this SAME document's mechanical tier surfaced — an argmax,
  // never a top-K or cosine cutoff (activation.js's own `top`).
  const nnOf = new Map();
  for (const t of covered) {
    let best = null, bestSim = -Infinity;
    for (const u of covered) {
      if (u === t) continue;
      const sim = cosine(vecOf.get(t), vecOf.get(u));
      if (sim > bestSim) { bestSim = sim; best = u; }
    }
    nnOf.set(t, { neighbor: best, cosine: bestSim });
  }

  const clusters = [];
  const seenMutual = new Set();
  for (const [verb, { neighbor, cosine: sim }] of nnOf) {
    if (!neighbor) continue;
    const mutual = nnOf.get(neighbor)?.neighbor === verb;
    if (mutual) {
      const key = [verb, neighbor].sort().join("|");
      if (seenMutual.has(key)) continue; // report a mutual pair once, not twice
      seenMutual.add(key);
    }
    const rankAmongPairs = atOrAbove(sim);
    const mechanicalAgrees = typeof sameAct === "function" ? sameAct(verb, neighbor) : null;
    clusters.push({
      verb, neighbor, cosine: sim,
      rankAmongPairs, pairsConsidered: pairSims.length,
      rankP: rankAmongPairs / pairSims.length,
      percentile: 1 - (rankAmongPairs - 1) / pairSims.length,
      mutual,
      // Never reconciled — the mechanical tier's own verdict on this exact
      // pair, laid down beside the embedding's nomination.
      mechanicalAgrees,
      disagreement: mechanicalAgrees === false,
    });
  }
  clusters.sort((a, b) => b.cosine - a.cosine);

  return { clusters, pairsConsidered: pairSims.length, embedGaps, gap: null };
};
