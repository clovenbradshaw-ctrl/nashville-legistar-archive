// the legacy engine · emergence/activation — ASSOCIATIVE MEMORY THAT READS LEFT TO
// RIGHT. What brings a prior passage to the surface when a new one arrives,
// computed with nothing from the future.
//
// The mechanisms are eoreader5's `emergence/store`, which earned them against
// a memory golden, and they are re-derived here rather than copied because
// SEED.md's growth rule says nothing is ported: "every organ is re-earned here
// or does not come, including the good ones." What survives unchanged:
//
//   1. HEBBIAN ENCODING. Associations are written when two motifs CO-OCCUR in
//      a frame, at read time — never recomputed at query time. This one is
//      already causal, and it is the reason the whole thing can be: a memory
//      that wires as it reads has no query-time view of the document.
//
//   2. SPARSE CODING (dentate gyrus). Only distinctive motifs become keys.
//      The gate is a BAND — distinctive (idf ≥ floor) AND recurring (df ≥ 2) —
//      because a trace that never reactivates is not a memory and cannot
//      bridge two passages.
//
//   3. PATTERN COMPLETION (CA3). A partial cue reactivates a stored pattern by
//      ONE recurrent hop along wired edges, weighted by edge strength. One
//      hop, not a similarity flood: a diffuse spread pools inside a passage's
//      own dense vocabulary and drowns the distant target.
//
// The three numbered mechanisms name their own anatomy but not, until now,
// their own literature: sparse coding at the dentate gyrus and one-shot
// pattern completion at CA3 are Marr's (1971) archicortex model, developed
// into the sparse/dense complementary-learning-systems account by McClelland,
// McNaughton & O'Reilly (1995). The nearby-sounding but DIFFERENT lineage is
// spreading activation (Collins & Loftus 1975; surveyed for IR by Crestani
// 1997) — cited here because it is the mechanism this one is not: spreading
// activation propagates across multiple hops with decay, which is exactly
// the "similarity flood" #3 above names and rejects. One recurrent hop is a
// deliberate departure from that lineage, not an application of it.
//
// WHAT HAD TO CHANGE, AND IT IS THE WHOLE POINT.
//
// eoreader5 computes idf, trigram-df, and the df ≥ 2 gate over ALL frames
// before reading any of them. Every retrieval is therefore conditioned on the
// document's total vocabulary, including pages the reader has not reached. For
// a batch summariser that is merely a bit dishonest. For a READER it is fatal:
// it is the same leak the text perceiver already had to close for surprisal
// ("a whole-document table leaks the future into every block's score"), and it
// is worse here, because the df ≥ 2 gate literally admits a key on the
// strength of a recurrence that has not happened yet.
//
// So the tables are incremental. At frame t, idf is log(t / df_t) over the t
// frames already read, and a motif is a key once it has ALREADY recurred.
// This costs less than it sounds: a motif that has been seen once has a
// posting list containing only its own frame, which retrieval excludes anyway,
// so a hapax was never able to recall anything. Causality is close to free
// here, which is itself evidence the mechanism was the right shape.
//
// It is not entirely free, and the price is worth stating plainly because it
// looks like a bug and is not: THE THIRD OCCURRENCE IS THE FIRST THAT CAN
// RECALL. A motif needs df >= 2 to be a key, and at its second appearance the
// tables have only counted one — so the second occurrence cannot reach the
// first, and the third reaches both. A reader really does work this way. The
// second time a phrase appears you may feel it; the third time you can place
// it. What is lost is exactly the retrieval that a whole-document table gets
// by knowing, at the second occurrence, that a third is coming.
//
// Note also that the idf floor is scale-free despite looking absolute:
// log(t/df) >= floor is the same statement as df/t <= e^-floor, a RATE, so it
// does not drift as t grows. That was checked rather than assumed, having just
// spent an evening on a statistic that turned out to be reading its own extent
// (see nul/index.js::pattern). What it does mean is that in a very short
// document nothing can be both recurring and rare, and the code is correctly
// empty — a small corpus has no distant memory to have.
//
// The invariant that defines "left to right", and the one conformance holds
// this module to: reading the first k frames of a document must produce
// EXACTLY the records that reading the whole document and taking the first k
// produces. A reader who would have read it differently had they known how it
// ends is not reading.
//
// Medium-agnostic in shape, not yet in fact: `motifsOf` takes tokens, and
// tokens come from a perceiver. A musical reading would supply intervals or
// contour-cells instead of words and nothing below would change. That claim is
// untested here and is not asserted — see scripts/RESULTS.md on how badly the
// omnimodal commitment currently holds up when actually measured.

const WORD_RE = /[\p{L}\p{N}']+/gu;

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — associative memory that reads left to right; one
// recurrent hop, not a flood. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

// Unicode-aware, unlike the Latin-1 class this was learned from: a memory that
// can only wire English is not a memory, it is a language module.
export const tokens = (t) => String(t ?? "").toLowerCase().match(WORD_RE) ?? [];

const bump = (map, key, amount) => map.set(key, (map.get(key) ?? 0) + amount);

// Declared once, shared between codeOf and readForward rather than
// redeclared as two independent literals that could silently drift.
//
// IDF_FLOOR is scale-free (see the file header: log(t/df) >= floor is the
// same statement as the RATE df/t <= e^-floor, which does not drift as t
// grows) — an honest declared resolution, checked rather than assumed.
//
// MIN_LEN is NOT yet earned, and forcing a derivation for it here would be
// the thing this file's own growth rule warns against. Measured directly:
// on Frankenstein, of every (word, frame) pair clearing IDF_FLOOR, ~6% are
// words under 4 characters — and that pool is a genuine MIX, not a clean
// noise class: real function words ("any", "us", "did", "nor", "her") sit
// alongside real content words this arctic-and-nature-heavy text needs
// ("ice", "sun", "sea", "joy"). A length cutoff cannot separate those two —
// they are the same length. What WOULD separate them is the same kind of
// Zipf-derived closed-class test `material.js::functionWordSet` already
// uses elsewhere in this codebase, but that requires a retrieval-quality
// golden to validate any replacement against (does the swap help or hurt
// recall?), which does not exist yet and is not built here. Left declared,
// on the same terms as `completion`/`topEdges`/`edgeSlots` below.
const IDF_FLOOR = 2.0;
const MIN_LEN = 4;

/**
 * The sparse code of one frame, against the tables AS THEY STAND. Nothing here
 * looks at a frame that has not been read.
 *
 * Unigrams (gist) and trigrams (verbatim) are returned separately because they
 * are different stores and must not compete for slots — measured in the
 * lineage: a single budget ranked by summed idf let trigrams crowd out every
 * distinctive unigram, and trigrams recur only in adjacent frames, so the code
 * bridged locally and never at range.
 */
export const codeOf = (ws, state, { minLen = MIN_LEN, idfFloor = IDF_FLOOR } = {}) => {
  const { df, gramDf, read } = state;
  // An unseen form is maximally distinctive, which is right: the first time you
  // meet a strange word it is the most separable thing on the page.
  const idfOf = (w) => Math.log(Math.max(1, read) / Math.max(1, df.get(w) ?? 0));

  // TWO GATES, NOT ONE — and this is the correction causal reading forced.
  //
  //   trace — what gets STORED. Distinctiveness only, which is knowable now.
  //   cue   — what gets FIRED. Distinctive AND already recurring.
  //
  // With a single band gate (the whole-document version's shape) nothing is
  // ever indexed until it has already recurred, so a motif's first two
  // appearances leave no trace at all and its third has a perfectly good key
  // pointing at an empty posting list. Measured: the third occurrence of a
  // planted motif recalled nothing, with a 17-key code and an activation of
  // exactly zero.
  //
  // Splitting them also says something truer. Encoding is not conditional on
  // future retrieval value — you do not decline to remember something because
  // it has not recurred yet. What recurrence earns is the right to be used as
  // a CUE: a form that has come round again has proven it can bridge, and
  // firing on forms that never recur is what floods retrieval with the local
  // neighbourhood.
  const trace = new Map();
  const cue = new Map();

  for (const w of ws) {
    if (w.length < minLen) continue;
    const s = idfOf(w);
    if (s < idfFloor) continue; // must be distinctive to separate
    trace.set(w, Math.max(trace.get(w) ?? 0, s));
    if ((df.get(w) ?? 0) >= 2) cue.set(w, Math.max(cue.get(w) ?? 0, s)); // ...and must ALREADY have recurred to fire
  }

  const long = ws.filter((w) => w.length >= 3);
  for (let i = 0; i + 2 < long.length; i++) {
    const g = `${long[i]} ${long[i + 1]} ${long[i + 2]}`;
    const seen = gramDf.get(g) ?? 0;
    if (seen < 1) continue; // a phrase said once is not yet a phrase; storing every trigram is not sparse coding
    const s = idfOf(long[i]) + idfOf(long[i + 1]) + idfOf(long[i + 2]);
    // The lineage's rule is that a trigram is "distinctive by construction"
    // and needs no floor. That holds for prose and fails for BOILERPLATE: a
    // formula repeated in every frame — a running header, a refrain, a licence
    // line — has summed idf of zero and was still admitted. Zero-weight keys
    // contribute nothing to activation but do populate posting lists, so every
    // frame came back recalling every earlier frame with a total of exactly
    // 0.00. A key that separates nothing is not a key; this is SEED.md #3's
    // zero-width null wearing the sparse code's coat.
    if (s < idfFloor) continue;
    trace.set(g, Math.max(trace.get(g) ?? 0, s));
    if (seen >= 2) cue.set(g, Math.max(cue.get(g) ?? 0, s));
  }

  return { trace, cue };
};

// The model tier's absence, stated once so every record carries the same
// typed refusal rather than a scatter of nulls that read like zeroes.
const NO_EMBEDDER = Object.freeze({
  gap: "undeclared",
  what: "embed",
  why: "descriptor synonymy is model-tier and needs a resolver with a giver; none was supplied",
});

/**
 * Late interaction (MaxSim) between the cue frame and each frame the sparse
 * code already surfaced. Pooled cosine is deliberately not used: pooling a
 * passage into one vector was measured to lose to late interaction on this
 * exact task, which is ColBERT's own claim and it held.
 *
 * Returns the surfaced frames rescored, plus the disagreement between the two
 * channels — which of them placed something the other did not.
 */
const rerank = (embed, ws, activation, frames, order) => {
  const orders = [...activation.keys()];
  if (orders.length === 0) {
    // Nothing to rerank. This is the tier boundary doing its job: the model
    // tier is not permitted to conjure a memory the engine tier never had.
    return Object.freeze({ gap: "no_ground", why: "the engine tier surfaced nothing to rerank" });
  }
  const cueVecs = embed(ws);
  const scored = orders.map((o) => {
    const other = frames[o];
    const vecs = embed(other.words ?? tokens(other.text));
    let total = 0;
    for (const q of cueVecs) {
      let best = -Infinity;
      for (const d of vecs) {
        let dot = 0;
        for (let i = 0; i < q.length; i++) dot += q[i] * d[i];
        if (dot > best) best = dot;
      }
      if (best > -Infinity) total += best;
    }
    return { order: o, maxSim: cueVecs.length ? total / cueVecs.length : 0, engine: activation.get(o) };
  });
  scored.sort((a, b) => b.maxSim - a.maxSim);
  const byEngine = [...scored].sort((a, b) => b.engine - a.engine);
  return Object.freeze({
    top: scored[0],
    // Plural grounds for one figure: when the two channels disagree about
    // which prior passage this most belongs with, that disagreement is the
    // finding and is not reconciled here.
    agrees: scored[0].order === byEngine[0].order,
    n: scored.length,
  });
};

/**
 * One CA3 completion step over the store AS IT STANDS. Never more than one.
 *
 * Exported so a caller with its own frame notion (perceiver/text/pronouns.js
 * binds a pronoun's frame to whichever prior frame's motifs it shares, then
 * asks a side table which referent that frame named — same one-hop recall,
 * a different question asked of the same activation Map) can reuse this
 * exact mechanism rather than re-deriving a second recall function that
 * would drift from this one.
 */
export const recall = (code, state, { completion, topEdges, selfOrder }) => {
  const { posting, edges } = state;
  const activation = new Map();
  const add = (order, amt) => {
    if (order === selfOrder) return;
    bump(activation, order, amt);
  };

  for (const [m, w] of code) {
    const p = posting.get(m);
    if (p) for (const [order, pw] of p) add(order, w * pw);

    if (completion <= 0) continue;
    const nbrs = edges.get(m);
    if (!nbrs) continue;
    const top = [...nbrs].sort((a, b) => b[1] - a[1]).slice(0, topEdges);
    const norm = top.reduce((s, [, str]) => s + str, 0) || 1;
    for (const [nb, str] of top) {
      const np = posting.get(nb);
      if (!np) continue;
      const gate = completion * w * (str / norm);
      for (const [order, pw] of np) add(order, gate * pw);
    }
  }
  return activation;
};

/**
 * ENCODE — wire one frame's trace into the posting table and the bounded
 * Hebbian edge graph, then advance the df/gramDf tables. Always called AFTER
 * `recall` for the same frame (never before): recalling after encoding would
 * let a frame retrieve itself and every motif it just wired.
 *
 * Factored out of `readForward`'s loop so a caller with its own frame notion
 * (perceiver/text/pronouns.js — sentence-level frames, not readForward's own
 * chunking) advances the SAME tables the same way, rather than a second,
 * possibly-drifting copy of this bookkeeping.
 */
export const encodeFrame = (state, order, ws, trace, { edgeSlots = 24 } = {}) => {
  for (const [m, w] of trace) {
    let p = state.posting.get(m);
    if (!p) state.posting.set(m, (p = new Map()));
    p.set(order, w);
  }
  // Bounded Hebbian: edges are O(k²), and a frame's most distinctive
  // co-firings are the associations worth keeping. Retrievable is not the
  // same as wired.
  const wired = [...trace].sort((a, b) => b[1] - a[1]).slice(0, edgeSlots);
  for (let a = 0; a < wired.length; a++) {
    for (let b = a + 1; b < wired.length; b++) {
      const inc = Math.min(wired[a][1], wired[b][1]);
      let ea = state.edges.get(wired[a][0]);
      if (!ea) state.edges.set(wired[a][0], (ea = new Map()));
      bump(ea, wired[b][0], inc);
      let eb = state.edges.get(wired[b][0]);
      if (!eb) state.edges.set(wired[b][0], (eb = new Map()));
      bump(eb, wired[a][0], inc);
    }
  }

  // The tables advance only now, so this frame was never counted in its own
  // idf. Off-by-one here is the difference between reading and reviewing.
  // EVERY form counts toward df, including short ones. `minLen` is a policy
  // about what makes a good unigram key; df is a fact about what has been
  // read, and conflating them was a real bug: short function words never
  // entered the table, so `df.get("the")` came back empty and the fallback
  // scored it as maximally rare. Every filler trigram then inflated to a top
  // key, the sparse code stopped being sparse, and recall flooded — every
  // frame recalled every previous frame at reach 1.
  const seenU = new Set(ws);
  for (const w of seenU) bump(state.df, w, 1);
  const long = ws.filter((w) => w.length >= 3);
  const seenG = new Set();
  for (let k = 0; k + 2 < long.length; k++) seenG.add(`${long[k]} ${long[k + 1]} ${long[k + 2]}`);
  for (const g of seenG) bump(state.gramDf, g, 1);
  state.read++;
};

/**
 * readForward(frames) — the reading act, one frame at a time.
 *
 * For each frame, in order: RECALL FIRST, THEN ENCODE. That ordering is not a
 * detail. Recalling after encoding would let the frame retrieve itself and
 * every motif it just wired, which is how a memory ends up reporting that
 * everything reminds it of the present.
 *
 * frames: [{ order, offset, text }] or [{ order, offset, words }], in reading
 * order. Words may be supplied directly so a caller that has already tokenised
 * does not pay for it twice, and so a non-text perceiver can hand in whatever
 * its own units are.
 */
/**
 * WHERE THE EMBEDDING GOES, AND WHY IT GOES THERE.
 *
 * The sparse code above can only fire on forms that have ALREADY RECURRED. It
 * is verbatim and keyword recurrence — engine tier — and it cannot bridge
 * `monster ≈ creature` or `union ≈ wedding` even in principle. An embedding
 * can. That makes it precisely a MODEL-TIER organ, and the cardinal regression
 * in this lineage is faking a model-tier absence, so the seam has to be built
 * so that absence stays visible.
 *
 * Three decisions, each of which could have gone the other way:
 *
 *   1. INJECTED, NEVER IMPORTED. `embed` is handed in, exactly as the cast and
 *      lexicon are DATA elsewhere. The engine has no model baked into it, no
 *      vocabulary, no download. A module that reaches for a checkpoint is not
 *      omnimodal, it is English-shaped.
 *
 *   2. IT RERANKS WHAT THE SPARSE CODE SURFACED — it does not retrieve on its
 *      own. Partly cost: MaxSim against every prior frame is quadratic, while
 *      against the handful the sparse code already surfaced it is free. Mostly
 *      tier: if the engine tier surfaced nothing, there is nothing to rerank,
 *      and the gap stays a gap instead of being quietly filled by a model. The
 *      engine proposes; the model refines; the model never invents the
 *      proposal.
 *
 *      This is also what the lineage's own measurement recommends. Benchmarked
 *      against a ColBERT-style late-interaction retriever over static token
 *      embeddings, the Hebbian sparse code came out AHEAD at the range these
 *      motifs actually recur (pg84 R@10 13 vs 10 of 60). The embedding is not
 *      a better retriever to swap in. It is a DIFFERENT KIND OF EVIDENCE.
 *
 *   3. SO IT IS A SECOND GROUND, AND THE DISAGREEMENT IS THE POINT. SEED.md
 *      #6: "Plural grounds for one figure are legal, and their disagreement is
 *      the only self-check." One channel placing a memory while the other
 *      calls it absent is the most informative thing this can produce, and it
 *      is reported rather than reconciled. `nul::disagreement` already has the
 *      shape.
 *
 * With no `embed` supplied, `resonance` is a typed gap on every record —
 * `undeclared`, because a resolution was left to a default. It is never 0, and
 * never quietly omitted. Nothing in this repo currently supplies one: there is
 * no checkpoint on disk and the only host for the real one is blocked by the
 * sandbox's network policy. So this seam is UNMEASURED, and by SEED.md's own
 * growth rule an unwired organ is refuted rather than early. It is built to
 * the shape the measurement will need and makes no claim until it has one.
 */
export const readForward = (frames, { idfFloor = IDF_FLOOR, minLen = MIN_LEN, completion = 0.5, topEdges = 6, edgeSlots = 24, embed = null } = {}) => {
  const state = {
    df: new Map(),
    gramDf: new Map(),
    posting: new Map(),
    edges: new Map(),
    read: 0,
  };

  const records = [];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const ws = f.words ?? tokens(f.text);
    const order = f.order ?? i;

    // ── RECALL: what does this bring back, given only what has been read ──
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });
    const activation = recall(cue, state, { completion, topEdges, selfOrder: order });

    let total = 0;
    let best = null;
    for (const [o, a] of activation) {
      total += a;
      if (!best || a > best.activation) best = { order: o, activation: a };
    }

    // How much of this frame's own code is material the reader has never had a
    // key for before. Novelty and activation are not opposites: a passage can
    // be full of new terms and still ring loudly with old ones.
    let fresh = 0;
    for (const m of trace.keys()) if (!state.posting.has(m)) fresh++;

    records.push({
      order,
      offset: f.offset ?? null,
      codeSize: cue.size,
      traceSize: trace.size,
      // Total weight of everything the past lit up. Zero is a real answer: it
      // means nothing already read has a key in common with this.
      activation: total,
      // How far back the loudest echo is, in frames. null when nothing
      // answered — a gap, not a zero, because "no reach" and "reach of 0" are
      // different findings and collapsing them would be a lie of arithmetic.
      reach: best ? order - best.order : null,
      strongest: best,
      recalled: activation.size,
      novelty: trace.size ? fresh / trace.size : null,
      // The model tier, kept apart from the engine tier and never summed into
      // it. A gap here is a result; a zero here would be a lie.
      resonance: embed
        ? rerank(embed, ws, activation, frames, order)
        : NO_EMBEDDER,
    });

    // ── ENCODE: wire it in, after it has been read ──────────────────────
    encodeFrame(state, order, ws, trace, { edgeSlots });
  }

  return { records, state };
};

/**
 * The observables a reading yields, as series `nul` can build a ground over.
 *
 * Each is a different question about the same act, and which of them carries
 * anything is an empirical matter settled by measurement, never by which one
 * sounds most like reading. See scripts/activation-clearings.mjs.
 *
 *   activation — how loudly the past answers
 *   reach      — how far back the loudest answer is
 *   novelty    — how much of this has no precedent to answer it
 *   recalled   — how many distinct prior frames answered at all
 *
 * `reach` is null where nothing answered. Series need numbers, so the caller
 * says what an unanswered frame means: `missing` is declared, not defaulted,
 * because filling a gap with 0 asserts "the echo is here, at distance zero,"
 * which is the opposite of what happened.
 */
export const seriesOf = (records, key, { missing } = {}) => {
  if (missing === undefined) throw new TypeError("seriesOf: `missing` is declared, never defaulted — a gap is not a zero");
  return records.map((r) => (r[key] == null ? missing : r[key]));
};
