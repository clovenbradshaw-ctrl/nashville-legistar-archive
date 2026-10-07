// native/kernel/revision-volatility.js — REVISION VOLATILITY: HOW MANY OF A
// NODE'S OWN SIGHTINGS WERE LATER REVISED, AGAINST THE CHANCE ITS EXPOSURE
// ALONE WOULD GIVE (2026-09-25). Medium-blind, kernel-level. Handle: Quine —
// after the web of belief in which no statement is immune to revision, and
// some have been revised more than their exposure explains. Nomination.
//
// corroboration.js keeps every occurrence on file and marks the ones later
// revised: `falsified` (DEF, falsifyOccurrence) and `superseded` (REC,
// supersedeLesson). Its `revision` counter is bumped by every act INCLUDING a
// sighting (signProvisionalKind), so it counts change, not revision — found
// 2026-09-25 by this module's own falsifier: a store with no revisions at all
// read as volatile under the counter. The statistic here is the MARKS —
// occurrences revised after they arrived — so a node's own arrivals never
// count against it; the raw counter is reported beside it, unused.
//
//   OBSERVED   marks = the entry's falsified + superseded occurrences
//   EXPOSURE   its occurrence count — a node seen fifty times has had fifty
//              chances to be revised; one seen twice has had two
//   THE NULL   the store's total marks dealt onto its occurrences uniformly
//              WITHOUT replacement (an occurrence is revised at most once),
//              `trials` times; p = P(this entry's dealt marks >= its observed
//              marks), +1 for the observed draw. A node revised more than its
//              exposure explains is volatile above chance; one revised less is
//              steadier than chance.
//
// No mapping from p into a Dirichlet alpha or a decay gamma is made here: that
// would be a formula nobody earned. The prior is declared by the caller
// (bayes-surprise.js's own law); this file hands the caller a measured p and a
// rank among peers to declare it with. consequential-surprise.js takes the p as
// `volatilityOf(id)` and reports it per row, unmultiplied.
//
// Typing (reasoned, per capacities.js's hand-check discipline): the reliability
// of ONE being's status over time is Relate·Interpretation at Figure grain —
// EVA·Lens, Binding — beside `witness` (does one landing compile) and `web`
// (one claim's words checked).

export const REVISION_VOLATILITY_SCHEMA = "EORevisionVolatility@1";
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

const isMarked = (o) => !!(o?.falsified || o?.superseded);

/** Deal `total` marks onto distinct occurrences uniformly without replacement
 *  (a partial Fisher–Yates over one owner index per occurrence); returns the
 *  marks landed per entry. */
function dealMarks(exposures, total, rng) {
  const owners = [];
  exposures.forEach((n, i) => { for (let k = 0; k < n; k++) owners.push(i); });
  const counts = new Array(exposures.length).fill(0);
  const m = Math.min(total, owners.length);
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(rng() * (owners.length - i));
    [owners[i], owners[j]] = [owners[j], owners[i]];
    counts[owners[i]]++;
  }
  return counts;
}

/**
 * revisionVolatility(store, { trials, rng }) → { schema, total, trials, entries, basis }
 *
 * `store` is corroboration.js's shape: `store.concepts[name] = { status,
 * revision, occurrences: [{ falsified?, superseded?, ... }] }`. Every entry is
 * reported; `entries` is sorted by p ascending (most volatile above chance
 * first), then by name. An entry with no occurrences has no exposure and is
 * reported with p = null and rank = null — no chance model exists for a node
 * never seen. `rank` is the share of peers (entries with a p) no more volatile
 * than this one: 1.0 is the most volatile entry in the store.
 */
export function revisionVolatility(store, { trials = 200, rng = Math.random } = {}) {
  if (!(trials >= 1)) throw new TypeError("revisionVolatility: trials is a positive count");
  const names = Object.keys(store?.concepts ?? {}).sort();
  const occurrences = names.map((n) => store.concepts[n]?.occurrences ?? []);
  const exposures = occurrences.map((os) => os.length);
  const observed = occurrences.map((os) => os.filter(isMarked).length);
  const total = observed.reduce((a, b) => a + b, 0);
  const atLeast = new Array(names.length).fill(0);
  for (let t = 0; t < trials; t++) {
    const dealt = dealMarks(exposures, total, rng);
    for (let i = 0; i < names.length; i++) if (dealt[i] >= observed[i]) atLeast[i]++;
  }
  const totalExposure = exposures.reduce((a, b) => a + b, 0);
  const entries = names.map((name, i) => ({
    name,
    marks: observed[i],
    revision: Number(store.concepts[name]?.revision ?? 0),
    exposure: exposures[i],
    expected: totalExposure ? (total * exposures[i]) / totalExposure : 0,
    p: exposures[i] > 0 ? (atLeast[i] + 1) / (trials + 1) : null,
    status: store.concepts[name]?.status ?? null,
    rank: null,
  }));
  const withP = entries.filter((e) => e.p != null);
  for (const e of withP) e.rank = withP.filter((x) => x.p >= e.p).length / withP.length;
  entries.sort((a, b) => ((a.p ?? 2) - (b.p ?? 2)) || a.name.localeCompare(b.name));
  return {
    schema: REVISION_VOLATILITY_SCHEMA,
    total,
    trials,
    entries,
    basis: `${total} revised occurrence(s) (falsified or superseded) across ${names.length} entr(y/ies) with ${totalExposure} occurrence(s); p per entry = P(dealing all ${total} mark(s) onto occurrences uniformly without replacement gives this entry at least its observed marks), ${trials} deal(s), +1 for the observed draw; rank = share of peers no more volatile above chance; the raw revision counter is reported, not used (it counts sightings too)`,
  };
}

/** volatilityOf(vol) → (name) => p — the accessor consequential-surprise.js
 *  takes; null for a name the store never saw or never exposed. */
export function volatilityOf(vol) {
  const byName = new Map((vol?.entries ?? []).map((e) => [e.name, e.p]));
  return (name) => byName.get(name) ?? null;
}
