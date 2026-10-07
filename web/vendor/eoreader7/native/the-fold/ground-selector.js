// native/the-fold/ground-selector.js — THE GROUND SELECTOR. Four candidate
// criteria for what makes a body of material well-grounded, each run
// against its own null, collapsing to whichever criterion separates
// furthest from chance — never a single hand-picked yardstick.
//
// RECONSTRUCTION, NOT REDISCOVERY. An earlier pass this session built and
// validated this exact design (grounds-final.mjs) against four control
// worlds — real disputed material (correctly refused), a planted reprint
// (correctly co-held between two criteria), a planted firsthand account
// (correctly collapsed onto the eyes-and-ears criterion), and pure noise
// (correctly refused). That script's SOURCE was lost to a scratchpad
// cleanup before it was committed anywhere; only its run log survived
// (grounds-final.log, in the session scratchpad). This module rebuilds the
// same four criteria and the same collapse rule from that log's own
// printed verdicts and this repo's real organs — the null CONSTRUCTION
// below is a fresh, declared design decision (see "THE NULL" below), not a
// recovered original, because the log did not print enough of its own
// mechanics to reconstruct byte-for-byte.
//
// THE FOUR CRITERIA, each backed by a real organ already in this repo:
//   distinct sources             organs/corroboration.js::distinctSources
//   independent voices           organs/corroboration.js::sharedTextGroups
//   what eyes and ears witnessed adapters/text/priors.js::FIRST_PERSON
//   doubt carried forward        sharedTextGroups' own overlap measure,
//                                 read as cross-account divergence
//
// THE NULL. Two constructions, because the four criteria fall into two
// families and one null shape cannot meaningfully test both:
//   - `distinct sources` is the one ATTRIBUTION statistic (how many
//     distinct entities are named as the source). Its null redraws each
//     record's `ref` uniformly at random, WITH replacement, from the
//     alphabet of refs actually observed in this material — the same
//     "uniform draw from the observed alphabet" negative-sampling
//     discipline this session already built and validated in
//     bitemporal.mjs, applied here to source identity instead of graph
//     nodes.
//   - `independent voices`, `what eyes and ears witnessed`, and `doubt
//     carried forward` are all TEXT-CONTENT statistics (sharedTextGroups'
//     clustering; which texts open in the first person; how those texts
//     diverge) — none of them read `ref` at all, so an attribution-redraw
//     null is invariant for all three by construction: relabeling refs
//     changes nothing they measure, and an invariant null never refuses
//     anything (found live while building this reconstruction — the first
//     version put "what eyes and ears witnessed" in the attribution family
//     and it never once cleared, on ANY world, because its ceiling always
//     equalled its own observed value). Their null instead pools every
//     SENTENCE across every record, shuffles the pool, and re-partitions
//     it back into records of the same sentence counts — a permutation
//     test on attachment structure. (An earlier version of this
//     reconstruction bootstrapped whole TEXTS with replacement instead;
//     that let the null redraw one special text two or three times, which
//     cannot happen in the real, all-distinct material, and inflated the
//     null enough to mask a genuine firsthand signal — also found and
//     fixed live while building this.)
// Both nulls take declared {draws, seed, alpha} — undeclared throws, this
// project's own standing rule (II.23: a threshold nobody chose is not a
// threshold) — citing legacy-legacy-engine.1/packages/host/population.js's
// LINK_SPEC as the convention's giver (a declared-parameters shape to
// follow, not literal numbers to copy).
//
// COLLAPSE. Each criterion's separation is read as a percentile: the
// fraction of null draws strictly below the observed value. The criterion
// with the highest separation wins IF it clears `1 - alpha`; ties within
// one null-resolution unit (1/draws) are CO-HELD, unranked, both stand;
// nothing clearing is a REFUSAL — a finding about the material, not the
// instrument (grounds-final.log's own words).

import { distinctSources, sharedTextGroups } from "../organs/corroboration.js";
import { FIRST_PERSON } from "../adapters/text/priors.js";
import { splitSentences } from "../adapters/text/spans.js";

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const witnessOf = (r) => (r.kind ? `${r.kind}:${r.ref}` : r.ref);

function textGroups(records) {
  return sharedTextGroups(
    records.map((r) => ({ ref: r.ref, text: r.text })),
    { minSentenceLength: 20, minShared: 2, splitSentences },
  );
}

// "what eyes and ears witnessed" (Mozi's criterion, per the log): measured
// as a SHARE OF THE TOTAL, not a fraction of one record's own sentences —
// hub-monitor.mjs's real maxShare pattern (this session), applied here to
// first-person sentence counts instead of graph degree. Second live
// falsification, found chasing satisfaction on a real two-round prompt:
// the FIRST fix (own-fraction, in this function's earlier form) still
// degraded as evidence accumulated — round 2 added a genuine SECOND
// firsthand witness and the criterion stopped clearing, because a bigger
// pool of first-person sentences gives a per-record-fraction null more
// raw material to accidentally concentrate into one redealt record, so
// the ceiling rose faster than the (unchanged, per-record-capped-at-1.0)
// signal could. A SHARE of the corpus-wide total does not have this
// defect: it is bounded [0,1] by construction regardless of how much
// first-person content exists in total, and under the sentence-redeal
// null its EXPECTED value shrinks as more first-person sentences enter
// the pool (more items to spread across N slots means less of any one
// slot's expected share, not more) — so more real witnessed content
// makes the null MORE conservative, not less, the direction evidence
// should move it.
//
// `FIRST_PERSON` (a real, received closed class, giver: lang/en) is now
// checked against ANY token in a sentence, not only its first word — the
// FIRST falsification found live: real testimony ("The explosion knocked
// me off my feet before I even registered the sound") routinely does not
// open on the pronoun, and the position-restricted version scored it 0.
function firstPersonSentenceCount(text) {
  const sentences = splitSentences(String(text ?? ""));
  let hits = 0;
  for (const s of sentences) {
    const tokens = String(s?.text ?? s ?? "").split(/[^\p{L}']+/u).filter(Boolean);
    if (tokens.some((t) => FIRST_PERSON.test(t))) hits += 1;
  }
  return hits;
}

function firstPersonShare(records) {
  const counts = records.map((r) => firstPersonSentenceCount(r.text));
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return Math.max(...counts) / total;
}

// "doubt carried forward": mean divergence across INDEPENDENT pairs (pairs
// sharedTextGroups did NOT union) — 1 - shared/of per pair, averaged. Zero
// independent pairs (one voice, or everything syndicated) carries no
// measurable doubt: 0, not a division error.
function doubtMeasure(records) {
  const { groupOf, overlaps } = textGroups(records);
  const independent = overlaps.filter((o) => groupOf.get(o.a) !== groupOf.get(o.b));
  if (!independent.length) return 0;
  const divergences = independent.map((o) => (o.of > 0 ? 1 - o.shared / o.of : 1));
  return divergences.reduce((a, b) => a + b, 0) / divergences.length;
}

const CRITERIA = Object.freeze([
  {
    id: "distinct sources",
    family: "attribution",
    measure: (records) => {
      const { groupOf } = textGroups(records);
      return distinctSources(records.map(witnessOf), { groupOf }).size;
    },
  },
  {
    id: "independent voices",
    family: "text",
    measure: (records) => textGroups(records).groups.length,
  },
  {
    id: "what eyes and ears witnessed",
    family: "text",
    measure: firstPersonShare,
  },
  {
    id: "doubt carried forward",
    family: "text",
    measure: doubtMeasure,
  },
]);

function attributionRedeal(records, rnd) {
  const alphabet = [...new Set(records.map((r) => r.ref))];
  return records.map((r) => ({ ...r, ref: alphabet[Math.floor(rnd() * alphabet.length)] }));
}

// The text family's null: pool every SENTENCE across every record, shuffle
// the pool, and re-partition it back into records of the SAME sentence
// counts as the originals. This destroys which specific sentences belong
// together while preserving total content and per-record size — a
// permutation test on attachment structure, not a with-replacement
// bootstrap (found live while building this reconstruction: bootstrapping
// whole TEXTS with replacement lets the null redraw one special text two or
// three times, which cannot happen in the real, all-distinct material, and
// that alone inflated the null enough to mask a genuine firsthand signal).
function sentenceRedeal(records, rnd) {
  const perRecord = records.map((r) => splitSentences(String(r.text ?? "")).map((s) => String(s?.text ?? s ?? "")));
  const pool = perRecord.flat();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let cursor = 0;
  return records.map((r, i) => {
    const n = perRecord[i].length;
    const sentences = pool.slice(cursor, cursor + n);
    cursor += n;
    return { ...r, ref: `${r.ref}~redraw`, text: sentences.join(" ") };
  });
}

/**
 * groundSelector(records, {draws, seed, alpha}) — records: [{ref, text,
 * kind?}]. Declared draws/seed/alpha or throws (II.23).
 */
export function groundSelector(records, { draws, seed, alpha } = {}) {
  for (const [k, v] of Object.entries({ draws, seed, alpha }))
    if (!Number.isFinite(v)) throw new TypeError(`groundSelector: ${k} must be declared — a threshold nobody chose is not a threshold`);
  const list = (records ?? []).filter((r) => r && r.ref && r.text);
  if (list.length < 2) {
    return Object.freeze({ standing: "insufficient", reason: "fewer than two records — nothing to compare", results: [] });
  }

  const rnd = lcg(seed);
  const results = CRITERIA.map((c) => {
    const observed = c.measure(list);
    const nullVals = [];
    for (let d = 0; d < draws; d += 1) {
      const redealt = c.family === "attribution" ? attributionRedeal(list, rnd) : sentenceRedeal(list, rnd);
      nullVals.push(c.measure(redealt));
    }
    nullVals.sort((a, b) => a - b);
    const below = nullVals.filter((v) => v < observed).length;
    const separation = below / draws;
    const ceilingIdx = Math.min(nullVals.length - 1, Math.ceil((1 - alpha) * nullVals.length) - 1);
    const ceiling = nullVals[ceilingIdx];
    return Object.freeze({ id: c.id, observed, separation, ceiling, clears: observed > ceiling, atOrBelow: below, draws });
  });

  const clearing = results.filter((r) => r.clears).sort((a, b) => b.separation - a.separation);
  if (!clearing.length) {
    return Object.freeze({ standing: "refusal", reason: "no criterion separated from its own null", results });
  }
  const top = clearing[0].separation;
  const resolution = 1 / draws;
  const winners = clearing.filter((r) => top - r.separation <= resolution);
  if (winners.length > 1) {
    return Object.freeze({ standing: "co-held", winners: winners.map((w) => w.id), results });
  }
  return Object.freeze({ standing: "collapse", winner: winners[0].id, results });
}

/** The 4 criteria's ids, so a caller can map an archon match to one without
 * spelling the strings twice. */
export const GROUND_CRITERIA = Object.freeze(CRITERIA.map((c) => c.id));
