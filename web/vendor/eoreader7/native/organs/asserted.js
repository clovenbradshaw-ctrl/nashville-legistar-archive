/* Dignaga speaks:
 * “Therefore the meaning of a word 
consists in a repudiation of the discrepant meaning".”
 *
 * This file implements the logic of Dignaga, as outlined in his work on the nature of language and knowledge.  I believe the file's use of a strict dialectical framework, while sound in its application to the Buddhist logician's work, can be overly rigid.  I believe a more nuanced approach, one that acknowledges the complexities of human language and thought, could yield a more robust understanding of the interplay of affirmation and negation in language.
 *
 * — the engineering record below, kept whole —
 */
// asserted.js — the assertion tier for relation edges: a mechanical reader's
// Handle: Dignaga — after the Buddhist logician: a word designates by excluding its contraries, and a verb is a hypothesis carrying its own counted support. Amendment XVII.
// "this word is the verb of this clause" treated as a HYPOTHESIS with
// disclosed support, never a recovered fact.
//
// Where this comes from, so it is not re-derived. Nine vocabulary
// configurations (UniMorph widening, lemma matching, span-role resolution,
// clause framing, adjacency votes — eval/results of the prior investigation,
// uncommitted) all chased the same linguist's question — "is this token the
// same verb as that one?" — and the pareto-best of the nine was the plain
// unfiltered vocabulary, with the residual gap untouched by any of them.
// The user's redirect, near-verbatim: "we don't need to rediscover grammar
// as linguists think of it, we need to discover real structure and MEANING,
// which must always be asserted by a reader (even a mechanical one)." A part
// of speech is not a fact a word carries; it is an after-the-fact
// description. This repo already refuses that move everywhere else (the cube
// is not a content classifier; L2's capitalisation-as-veto; the referent
// index over stemming). This module draws the same line on the verb side:
// extractRelations's own claim about a clause gets the same treatment the
// model's claims get — support counted, limits typed, nothing silently kept.
//
// THE ORGAN WAS SEARCHED FOR FIRST, and the honest finding is that none
// exists ready-made — but two established constructions compose into it:
//
//   · nul/index.js's LICENSED table covers (statistic, perturbation) pairs
//     over NUMERIC SERIES only; no text perturbation is licensed there, and
//     admitting one is not this repo's to do (the table is the engine's).
//     What transfers is the DISCIPLINE: a null is built by perturbing what
//     is present, and what it holds fixed is declared.
//   · emergence/activation.js has no unused mode for this either — but its
//     cue gate IS the recurrence rule this module needs: "a form that has
//     come round again has proven it can bridge" (df >= 2 to fire; the
//     third occurrence is the first that can recall). binding.js states the
//     same floor as arrivals >= 2, "binding's structural minimum."
//   · The text-shuffle-as-null already has a measured precedent in this
//     lineage: operators.js's 95.7% shuffle-survival refutation of the
//     content classifier, and goldens/agency-civic/rotation-control.mjs —
//     each clause's own words, seeded-shuffled, scored through the SAME
//     pipeline with the document's vocabulary held fixed. That golden
//     measured the construction's worth: 10.6% real admission vs 3.4%
//     word-salad admission on 208 civic clauses. This module is that
//     construction made per-edge and carried on the edge itself.
//
// TWO MEASURES, AND ONLY ONE EVER SETS A STANDING.
//
//   witnesses — self-corroboration by recurrence: how many independent
//     statements (extracted triple occurrences) fold into this edge.
//     `standingOf` types the edge `corroborated` at WITNESS_FLOOR (= 2) and
//     `single-witness` below it. The floor is structural, not tuned:
//     recurrence means "came round again," which is 2 by the meaning of the
//     word — the same 2 activation.js's cue gate and binding.js's arrivals
//     minimum already earned independently. Never walked against a golden.
//
//   orderArm — the per-edge word-salad floor: in N seeded copies of the
//     material with each sentence's words shuffled IN PLACE (vocabulary,
//     referent identity, and sentence boundaries all held fixed — the
//     rotation-control's own isolation), how many copies still yield an
//     edge of this shape? Reported as counts, phrased natural-frequency
//     ("fired in 3 of 20 shuffled copies"), and NEVER a verdict: a cut on
//     the rate would need calibration, calibration would need a golden, and
//     tuning a threshold against a golden's own score is the exact move
//     the legacy engine.1's CLAUDE.md forbids. The counts are the disclosure; if
//     the eval harness shows they separate real from planted edges, a cut
//     can be EARNED by a later pass — it is not invented here.
//
// The polarity of a shuffled-copy triple is noise by construction (the
// negation window is an order fact and the order was just destroyed), so
// the arm matches on shape only — subject/verb/object, polarity ignored —
// and says so here rather than quietly comparing a destroyed bit.
//
// Pure: no engine imports, no fetch, no DOM. The extraction closure and the
// sentence splitter are injected (the cast.js pattern) so hypergraph.js can
// hand in its own vocabulary-fixed extractRelations and the tests can hand
// in the real engine organs by relative path.

// The deterministic LCG and per-label FNV seeding, giver named:
// goldens/agency-civic/rotation-control.mjs (which itself inherits the
// declared-LCG discipline from extract-clauses.mjs and goldens/cast's chance
// baseline). Reproduced rather than imported because goldens are firewalled
// consumers — nothing outside a golden's directory may import from it, by
// that golden's own conformance test.
export const seededShuffle = (items, seed) => {
  let s = seed >>> 0;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// FNV-1a over a label, so every (draw, sentence) pair gets its own
// reproducible but distinct shuffle — one seed reused identically across
// sentences could accidentally preserve cross-sentence structure
// (rotation-control.mjs's own reason, kept).
export const seedFrom = (label) => {
  const s = String(label ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** One sentence's own words, order destroyed, everything else kept. */
export const shuffleSentenceWords = (sentence, seed) =>
  seededShuffle(String(sentence ?? "").split(/\s+/).filter(Boolean), seed).join(" ");

/**
 * The witness floor: recurrence means "came round again", which is 2 by the
 * meaning of the word. Givers: emergence/activation.js's cue gate (df >= 2
 * to fire — "a form that has come round again has proven it can bridge")
 * and emergence/binding.js's arrivals >= 2 ("binding's structural minimum").
 * Structural, never walked against a golden.
 */
export const WITNESS_FLOOR = 2;

export const standingOf = (statements) =>
  Number.isInteger(statements) && statements >= WITNESS_FLOOR ? "corroborated" : "single-witness";

/**
 * The per-edge word-salad arm. `passages` is the same list the caller's
 * edges were read from; `splitSentences` is the engine's own boundary (the
 * unit of statement — shuffling within it destroys exactly the order the
 * SVO prior reads, holding vocabulary, referent identity, and sentence
 * boundaries fixed); `extract` is the caller's OWN extraction closure with
 * its vocabulary already bound, so the arm can never re-measure a
 * vocabulary from salad. `draws` is declared, never defaulted — the finest
 * rank sayable about the arm is 1/draws (nul's own words for what draws
 * is), and how much resolution a disclosure needs is the caller's to say.
 *
 * Returns { draws, seed, samples } where samples[d] is the triple list the
 * extraction heard in shuffled copy d, tagged with the passage index it
 * came from. Matching samples to edges is the caller's, because "the same
 * edge" is referent identity and that machinery lives with the caller
 * (hypergraph.js's endpointsMatch) — a second implementation here would be
 * the drift this repo's postmortems keep catching.
 */
export const orderArm = ({ passages, splitSentences, extract, draws, seed = 0 }) => {
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError(
      "orderArm: draws is declared, never defaulted — the arm's resolution is 1/draws and is the caller's to say",
    );
  if (typeof extract !== "function" || typeof splitSentences !== "function")
    throw new TypeError("orderArm: extract and splitSentences are injected, never assumed");

  const list = (passages ?? []).filter((p) => p && typeof p.text === "string" && p.text.trim());
  const sentencesPer = list.map((p) => {
    let sents = [];
    try {
      sents = splitSentences(p.text);
    } catch {
      sents = [p.text];
    }
    return sents.map((x) => (typeof x === "string" ? x : x?.text ?? "")).filter((x) => x.trim());
  });

  const samples = [];
  for (let d = 0; d < draws; d++) {
    const heard = [];
    for (let pi = 0; pi < sentencesPer.length; pi++) {
      const shuffled = sentencesPer[pi]
        .map((sent, si) => shuffleSentenceWords(sent, (seedFrom(`${d}:${pi}:${si}`) + seed) >>> 0))
        .join(" ");
      let triples = [];
      try {
        triples = extract(shuffled);
      } catch {
        triples = [];
      }
      for (const t of triples) heard.push({ ...t, passage: pi });
    }
    samples.push(heard);
  }
  return { draws, seed, samples };
};

/**
 * The disclosure sentence, natural-frequency style, never phrased finer
 * than the arm's own resolution (the kinds-arm discipline: the renderer may
 * never phrase finer than finestRank — here that means counts out of draws,
 * never a percentage the draws cannot support).
 */
export const assertionPhrase = (assertion) => {
  if (!assertion) return "";
  const w =
    assertion.standing === "corroborated"
      ? `stated ${assertion.statements} times independently`
      : "stated once — kept, with its support counted at one";
  const arm = assertion.orderArm
    ? `; an edge of this shape still fired in ${assertion.orderArm.fired} of ${assertion.orderArm.draws} word-shuffled copies of the material`
    : "";
  return w + arm;
};
