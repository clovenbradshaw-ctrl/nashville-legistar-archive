// calibration.js — the cut is measured from the stream, not declared (P175).
//
// User, 2026-09-06: "can this calibration itself be online learning
// leveraging all the best mechanics we have like the born rule and the
// different voids and nuls?"
//
// P174 decided strain against `COVERAGE_FLOOR = 0.34`. That number was
// declared, and the standing rule in this project is to measure a null
// instead of setting a constant. Worse, a fixed floor cannot be right across
// corpora: 0.34 coverage is unremarkable on a marked-up critical edition and
// alarming on a novel. The cut has to come from the material.
//
// So it does, through the engine's own licensed apparatus rather than a new
// statistic invented here. `nul/index.js::ground` builds a nothing by
// perturbing present material; `difference` places an observation against it
// and CENSORS what the null cannot reach, at its own declared resolution of
// 1/draws. The pair used is `maxDeviation/resample`, which is licensed for
// exactly this shape — its own citation is "a planted single-point magnitude
// outlier against an otherwise-ordinary series", which is the question here
// word for word: is THIS turn's coverage an outlier against the coverages
// this stream has been seeing?
//
// The construction is leave-one-out, as that citation's own script does: the
// null is built from the history alone, and the observed statistic is the
// history WITH this turn's coverage appended. A coverage that does not
// disturb the series is placed with a rank and is ordinary. One that pushes
// the series' deviation past anything resampling produces is `exceeds_witness`
// — a real outlier, at which point DIRECTION decides, because maxDeviation is
// blind to sign and an unusually WELL covered question is not a strain.
//
// THE NULLS ARE HONOURED, NOT SWALLOWED. Every typed gap the apparatus can
// return means something different here and none of them means "easy":
//   empty_material / too little history → nothing to measure against yet
//   degenerate_ground                   → the null has zero width and would
//                                         clear anything (every turn so far
//                                         has had identical coverage)
//   exceeds_witness, low side           → a measured outlier: strain
//   exceeds_witness, high side          → a measured outlier the other way:
//                                         not strain, and said so
// An unmeasurable reading is never read as no-strain. The caller falls back
// to the declared floor and the record says it did (the same line the
// grounding ladder holds: a search that did not reach its object is a fact
// about the reader, never a finding about the world).
//
// PURE: the nul apparatus is injected (the cast.js pattern this repo uses
// everywhere), so this module runs under Node with no engine mount.

/** Coverages needed before a null can be built at all. The apparatus refuses fewer than 2 draws; this is the width at which a stream's own regime is worth trusting. Declared. */
export const MIN_HISTORY = 12;
/** How many turns of coverage the null is built from — the stream's recent regime, not its whole life, so calibration tracks a corpus rather than averaging over several. Declared. */
export const HISTORY_WINDOW = 60;
/** Declared for the apparatus, which refuses to default either: the resolution of testimony is 1/draws, and the reach of the present is never derived from material length. */
export const DRAWS = 200;
export const WINDOW = 4;

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/**
 * placeCoverage(observed, history, { nul, draws, window, seed }) →
 *   { strained, why, rank?, support?, gap? }
 *
 * `strained` is true, false, or NULL — null meaning the reading could not be
 * made, which the caller must not read as false.
 */
export function placeCoverage(observed, history = [], { nul, draws = DRAWS, window = WINDOW, seed = 7 } = {}) {
  if (!nul?.ground || !nul?.difference || !nul?.maxDeviation) return { strained: null, gap: "no_apparatus", why: "the null apparatus was not supplied" };
  if (!Number.isFinite(observed)) return { strained: null, gap: "empty_material", why: "this turn's coverage could not be read" };
  const past = history.filter((x) => Number.isFinite(x)).slice(-HISTORY_WINDOW);
  if (past.length < MIN_HISTORY) return { strained: null, gap: "empty_material", why: `only ${past.length} turn(s) of coverage so far; a null needs ${MIN_HISTORY}` };

  const ground = nul.ground({ material: past, draws, window, perturbation: "resample", statistic: "maxDeviation", seed });
  if (nul.isGap?.(ground)) return { strained: null, gap: ground.gap ?? "unknown", why: `the null could not be built: ${ground.gap ?? "unknown"}` };

  const withThis = nul.maxDeviation([...past, observed], { window });
  const placed = nul.difference(withThis, ground);
  if (nul.isGap?.(placed)) {
    if (placed.gap !== "exceeds_witness") return { strained: null, gap: placed.gap, why: `the reading could not be placed: ${placed.gap}` };
    // A real outlier. maxDeviation is blind to sign, so the side is read here:
    // only an unusually POORLY covered question is a strain.
    const mid = median(past);
    const low = observed < mid;
    return {
      strained: low,
      censored: true,
      support: placed.support,
      why: low
        ? `coverage ${observed.toFixed(2)} is further from this stream's own regime than resampling it ever gets (median ${mid.toFixed(2)})`
        : `coverage ${observed.toFixed(2)} is an outlier the other way — better covered than usual, which is not a strain`,
    };
  }
  return { strained: false, rank: placed.rank, why: `coverage ${observed.toFixed(2)} sits inside what this stream ordinarily sees (rank ${placed.rank.toFixed(2)})` };
}

/**
 * chooseCut(measured, declared, audit) → which cut a turn should be decided by.
 *
 * THE LAYER-4 PAYOFF, and the reason this file does not simply replace the
 * declared floor with the measured one. Measured over 274 real turns of the
 * long-stream run:
 *
 *   the declared floor (coverage < 0.34)   fired on 40 turns (15%)  — discriminating
 *   the stream-measured null               fired on  0 turns (0%)   — NOT discriminating
 *
 * The audit layer caught it immediately: a cut that never fires is
 * indistinguishable from no cut at all (P88's oldest failure shape — a wall
 * that never fires reads as rigour). The diagnosis is not a bug but a
 * mismatch of question. The null asks "is this coverage SURPRISING for this
 * stream?", and over a corpus whose coverage genuinely ranges from 0.00 to
 * 1.00, almost nothing is surprising. The floor asks a different question —
 * "is this coverage LOW?" — and low-but-common is exactly the case that
 * matters here. **Not every threshold should become a null.** A null answers
 * surprise; some cuts need badness, and the two are not the same question.
 *
 * So the tower decides rather than the author: the measured cut is used when
 * the audit says it separates turns, and the declared floor stands when it
 * does not — with the record saying which, and why.
 */
export function chooseCut(measured, declared, audit) {
  if (!audit || audit.gap) return { use: "declared", why: `the measured cut could not be audited (${audit?.gap ?? "no audit"}), so the declared floor stands` };
  if (audit.discriminating) return { use: "measured", why: audit.why };
  return { use: "declared", why: `${audit.why}, so the declared floor stands` };
}

/** A rolling record of what coverage has looked like on this stream. Append-only in use; the window is taken at read time. */
export function rememberCoverage(history = [], coverage) {
  if (!Number.isFinite(coverage)) return history;
  const next = [...history, coverage];
  return next.length > HISTORY_WINDOW * 2 ? next.slice(-HISTORY_WINDOW * 2) : next;
}
