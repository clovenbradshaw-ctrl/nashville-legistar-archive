/* Tala — GENERATED EPIGRAPH AND COMMENTARY, NOT THE AUTHOR'S WORDS except text inside quotation marks, and only where the archon's dossier (the-fold docs/archons/dossier) verifies that quote:
 * “tatam  calvavanaddham  ca  [  ghanam  siisiram  eva  ca 
caturvtdham  tu  vljneyam  |  atodyam  laksananvltam  (1) 
tatam  tantrikrtam  jneyam  |  avanaddham  tu  pauskaram 
ghanam  talas  tu  vijneyah  |  susiro  vamsa  eva  ca  (2)”
 *
 * This file implements the Tala rhythm cycle, a fundamental structure in Indian classical music.  It embodies the principle of  rhythm as independent of content,  a concept often obscured by modern music's dependence on lyrics.  My challenge is to ensure that the code remains faithful to this underlying rhythm, without losing the ability to express the complexities of human expression.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/rhythm-priors.js — the WHEN half of portable experience.
// Handle: Tala — after the Indian classical rhythmic cycle: the WHEN, held independent of whatever content rides on top of it. Amendment XVII.
//
// experience-priors.js sediments WHICH structures a reader has met before
// (relation forms, network signatures, terrain/stance/operator expectations).
// This module sediments WHEN: narrative rhythm — how soon an admitted being,
// once mentioned, is mentioned again. Measured across three works
// (native/eval/results/narrative-rhythm-transfer.json): a rhythm prior
// learned on Pride and Prejudice scores ordered Frankenstein at 92% of
// Frankenstein's OWN self-prior (0.469 vs 0.512) and ~3.3x its
// order-destroyed null — so this is a property of the kind "novel", not of
// one book, which is exactly what makes it portable.
//
// THE WHEEL (native/docs/THE-WHEEL.md): rhythm is the FOLD's pacing — the
// rim's WHEN, the interval at which a being is re-admitted to the fold.
//
// Deliberately written to experience-priors.js's OWN conventions, so the two
// halves compose rather than compete: same input shape (completed readings,
// or already-sedimented priors), same `giver` requirement, same
// `standing`/`witnessed`/`admissible` triple, same merge discipline (union
// the real `sourceRefs`, never re-scan raw readings), same memoryStanding
// rule at >= 2 works. Zero imports, like its sibling — a prior module that
// needs the kernel to compute a prior would not be a prior.
//
// Nothing from the target source is ever accepted here, and a rhythm memory
// is never witness for the next reading: it opens an expectation, and the
// target's own mention stream decides it.

const freeze = (value) => Object.freeze(value);
const stable = (values = []) => freeze([...new Set(Array.from(values ?? []).filter(Boolean))].sort());
const rate = (n, d) => d > 0 ? n / d : 0;
const memoryStanding = (workSupport) => workSupport >= 2 ? "recurrent_cross_work_memory" : "single_work_memory";

function sourceOf(item, index) {
  return item?.source
    ?? item?.reading?.turns?.[0]?.encounter?.source
    ?? item?.turns?.[0]?.encounter?.source
    ?? `prior-reading:${index}`;
}
const unwrap = (item) => item?.reading ?? item;

// A mention's read position. EOMention@1 ids are `mention:{pos}:{slug}` and
// its witness is `text:{pos}` (recursive.js's own construction) — read the
// position off the entry rather than requiring the caller to thread it.
function mentionPosition(entry) {
  // THE POSITION IS THE ENCOUNTER (2026-09-13). The mention's id and
  // witness are now content-addressed (THE-ADDRESS.md A4) — hex, no
  // position. The encounterRef ("encounter:7") is the position the rhythm
  // measures (the return gap between encounters). Legacy formats kept so
  // an older fold still scores; the content-hash era reads encounterRef.
  const fromEncounter = /^encounter:(\d+)/.exec(entry?.encounterRef ?? "");
  if (fromEncounter) return Number(fromEncounter[1]);
  const fromWitness = /^text:(\d+)/.exec(entry?.witness ?? "");
  if (fromWitness) return Number(fromWitness[1]);
  const fromId = /^mention:(\d+):/.exec(entry?.id ?? "");
  return fromId ? Number(fromId[1]) : null;
}

/** Pooled inter-mention gaps of one completed reading, in read order. */
export function readingGaps(reading = {}) {
  const byReferent = new Map();
  for (const entry of reading?.fold?.graphEntries ?? []) {
    if (entry?.schema !== "EOMention@1" || !entry.referent) continue;
    const pos = mentionPosition(entry);
    if (pos == null) continue;
    if (!byReferent.has(entry.referent)) byReferent.set(entry.referent, []);
    byReferent.get(entry.referent).push(pos);
  }
  const gaps = [];
  for (const positions of byReferent.values()) {
    const ordered = [...new Set(positions)].sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i += 1) gaps.push(ordered[i] - ordered[i - 1]);
  }
  return gaps.sort((a, b) => a - b);
}

export function medianOf(sorted = []) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A histogram, not a raw gap list: merging must union evidence across works
// without either re-scanning readings or letting one long book's gap count
// dominate a short one's. Bucket by gap length; merge adds counts and unions
// sources, and the median is recoverable from the histogram exactly.
function histogram(gaps) {
  const counts = new Map();
  for (const gap of gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  return counts;
}
function medianFromHistogram(entries, total) {
  if (!total) return null;
  const sorted = [...entries].sort((a, b) => a.gap - b.gap);
  const half = total / 2;
  let seen = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    seen += sorted[i].count;
    if (seen > half) return sorted[i].gap;
    if (seen === half) {
      const next = sorted[i + 1];
      return next ? (sorted[i].gap + next.gap) / 2 : sorted[i].gap;
    }
  }
  return sorted[sorted.length - 1]?.gap ?? null;
}

/**
 * Learn a reader's portable RHYTHM prior from earlier, fully separate
 * readings. Nothing from the target source is accepted here.
 *
 * `medianGap` is a declared standard summary of the pooled gaps, never a
 * tuned threshold: no value of it was ever chosen by checking what it did to
 * a target's score (the legacy engine.1's own "never tune a parameter by checking
 * what it does to a golden's own score").
 */
export function deriveRhythmPrior(items = [], { id = "rhythm-prior", giver, minWorkSupport = 1 } = {}) {
  if (!giver) throw new TypeError("deriveRhythmPrior requires a named giver");
  if (!Number.isInteger(minWorkSupport) || minWorkSupport < 1) throw new TypeError("minWorkSupport must be a positive integer");
  const readings = (items ?? []).map((item, i) => ({ source: sourceOf(item, i), reading: unwrap(item) })).filter((x) => x.reading?.fold);
  if (!readings.length) throw new TypeError("deriveRhythmPrior requires at least one completed reading");

  const buckets = new Map(); // gap -> {count, works:Set}
  for (const { source, reading } of readings) {
    for (const [gap, count] of histogram(readingGaps(reading))) {
      if (!buckets.has(gap)) buckets.set(gap, { count: 0, works: new Set() });
      const record = buckets.get(gap);
      record.count += count;
      record.works.add(source);
    }
  }
  const gapHistogram = [...buckets.entries()]
    .map(([gap, record]) => freeze({ gap, count: record.count, workSupport: record.works.size, sourceRefs: stable(record.works) }))
    .filter((record) => record.workSupport >= minWorkSupport)
    .sort((a, b) => a.gap - b.gap);
  const total = gapHistogram.reduce((sum, x) => sum + x.count, 0);

  return freeze({
    schema: "EORhythmPrior@1",
    id,
    giver,
    standing: "defeasible_experience_prior",
    witnessed: false,
    admissible: false,
    sourceCount: readings.length,
    sourceRefs: stable(readings.map((x) => x.source)),
    medianGap: medianFromHistogram(gapHistogram, total),
    gapCount: total,
    workSupport: readings.length,
    memoryStanding: memoryStanding(readings.length),
    gapHistogram: freeze(gapHistogram),
    provenance: freeze({
      giver,
      basis: "completed_prior_readings",
      targetExcluded: true,
      rule: "pooled inter-mention gaps of admitted referents; median is a declared standard summary, not a tuned threshold",
      measured: "native/eval/results/narrative-rhythm-transfer.json — novel-learned rhythm scores a held-out novel at 92% of its own self-prior and ~3.3x its order-destroyed null",
    }),
  });
}

/**
 * Fold several already-derived rhythm priors into one, without revisiting the
 * raw readings — experience-priors.js's own merge discipline, verbatim in
 * shape: union each bucket's real `sourceRefs`, add counts, recover the
 * median from the merged histogram. Merging per-book priors is exact against
 * deriving from every raw reading at once (pinned by test).
 */
export function mergeRhythmPriors(priors = [], { id = "rhythm-prior", giver, minWorkSupport = 1 } = {}) {
  if (!giver) throw new TypeError("mergeRhythmPriors requires a named giver");
  const inputs = (priors ?? []).filter((p) => p?.schema === "EORhythmPrior@1");
  if (!inputs.length) throw new TypeError("mergeRhythmPriors requires at least one rhythm prior");

  const buckets = new Map();
  for (const prior of inputs) {
    for (const bucket of prior.gapHistogram ?? []) {
      if (!buckets.has(bucket.gap)) buckets.set(bucket.gap, { count: 0, works: new Set() });
      const record = buckets.get(bucket.gap);
      record.count += bucket.count;
      for (const source of bucket.sourceRefs ?? []) record.works.add(source);
    }
  }
  const gapHistogram = [...buckets.entries()]
    .map(([gap, record]) => freeze({ gap, count: record.count, workSupport: record.works.size, sourceRefs: stable(record.works) }))
    .filter((record) => record.workSupport >= minWorkSupport)
    .sort((a, b) => a.gap - b.gap);
  const total = gapHistogram.reduce((sum, x) => sum + x.count, 0);
  const sourceRefs = stable(inputs.flatMap((p) => p.sourceRefs ?? []));

  return freeze({
    schema: "EORhythmPrior@1",
    id,
    giver,
    standing: "defeasible_experience_prior",
    witnessed: false,
    admissible: false,
    sourceCount: sourceRefs.length,
    sourceRefs,
    medianGap: medianFromHistogram(gapHistogram, total),
    gapCount: total,
    workSupport: sourceRefs.length,
    memoryStanding: memoryStanding(sourceRefs.length),
    gapHistogram: freeze(gapHistogram),
    provenance: freeze({ giver, basis: "merged_rhythm_priors", targetExcluded: true, rule: "union of per-bucket sourceRefs; exact against deriving from every raw reading at once" }),
  });
}

/**
 * Compose the two halves of portable experience into ONE object a reader
 * carries: WHICH structures recur (EOExperiencePrior@1) and WHEN a being
 * returns (EORhythmPrior@1).
 *
 * Composition, never mutation: the inputs are returned untouched under
 * `experience`/`rhythm`, so either half can be derived, merged, replaced or
 * dropped on its own, and neither module needs to know the other's internals.
 * `sourceRefs` is the union — the honest answer to "what has this reader
 * read", which is the question the composed object exists to answer.
 */
export function composeExperience({ experience = null, rhythm = null, id = "reader-experience", giver } = {}) {
  if (!giver) throw new TypeError("composeExperience requires a named giver");
  if (!experience && !rhythm) throw new TypeError("composeExperience requires at least one half");
  if (experience && experience.schema !== "EOExperiencePrior@1") throw new TypeError("experience must be an EOExperiencePrior@1");
  if (rhythm && rhythm.schema !== "EORhythmPrior@1") throw new TypeError("rhythm must be an EORhythmPrior@1");
  const sourceRefs = stable([...(experience?.sourceRefs ?? []), ...(rhythm?.sourceRefs ?? [])]);
  return freeze({
    schema: "EOReaderExperience@1",
    id,
    giver,
    standing: "defeasible_experience_prior",
    witnessed: false,
    admissible: false,
    sourceCount: sourceRefs.length,
    sourceRefs,
    experience,
    rhythm,
    carries: freeze([...(experience ? ["which"] : []), ...(rhythm ? ["when"] : [])]),
    provenance: freeze({
      giver,
      basis: "composed_experience_halves",
      targetExcluded: true,
      rule: "structural memory (experience-priors.js) and temporal memory (this module) composed without either being rewritten",
    }),
  });
}

/**
 * The rhythm memory's expectation, scored against a target reading's own
 * mention stream: at each mention of an admitted being except its last, the
 * carried prior predicts the next mention arrives within `medianGap`
 * encounters. Mechanical both ways — the target decides, never the prior.
 */
export function scoreRhythmExpectations(reading = {}, prior = {}) {
  if (prior?.schema !== "EORhythmPrior@1") throw new TypeError("scoreRhythmExpectations requires an EORhythmPrior@1");
  const gaps = readingGaps(reading);
  if (!gaps.length) return freeze({ expectations: 0, fulfilled: 0, violated: 0, fulfilmentRate: null });
  const fulfilled = gaps.filter((gap) => gap <= prior.medianGap).length;
  return freeze({
    expectations: gaps.length,
    fulfilled,
    violated: gaps.length - fulfilled,
    fulfilmentRate: fulfilled / gaps.length,
    against: prior.id,
    medianGap: prior.medianGap,
  });
}
