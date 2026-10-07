// native/kernel/hindsight.js — HINDSIGHT: WHAT THE RECORD SAID BEFORE A LATER
// EVENT RE-ADDRESSED THE THINGS IT SAID IT ABOUT (2026-09-25). Medium-blind,
// kernel-level. Handle: Kierkegaard — life is understood backwards and lived
// forwards: the scoring never looks ahead (S3; THE-HOLOGRAPH.md §7), the
// understanding is allowed to look back, and it changes an address, never a
// number. Nomination.
//
// A merge or a reassignment on the log is a later event that changes which
// being an earlier mention was about. The earlier entries are never rewritten
// (the append-only law); nothing here mutates `entries`. This walk answers, as
// a typed list instead of a feeling: which entries BEFORE the event refer to an
// id the event touched — directly, or (given a dependents index) transitively
// through what was derived from them — each with its distance in the log's own
// order and its cascade depth, and the whole count ranked against a null of
// synthetic touched-sets drawn from the ids the prior entries actually refer to
// (cascade.js's own null discipline: a distribution, never a verdict).
//
// WHAT AN ENTRY REFERS TO IS THE CALLER'S. `refsOf(entry)` and `idOf(entry)` are
// injected; this file knows no schema. the-fold/hindsight-log.js is the adapter
// that knows EOReferentMerge@1, EOReferentReassignment@1 and EOMention@1.
//
// Typing (reasoned, per capacities.js's hand-check discipline): cutting the
// record's past at the seam a later identity event opens — what rests on the
// re-addressed being, and what does not — is Differentiate·Structure at Pattern
// grain — SEG·Network, Unraveling, beside `unravel` (a pattern cut apart at its
// own seams).

import { cascade } from "./cascade.js";

export const HINDSIGHT_SCHEMA = "EOHindsight@1";
export const CELL = Object.freeze({ op: "SEG", grain: "Pattern" });

const defaultIdOf = (entry, i) => entry?.id ?? `#${i}`;

/**
 * hindsight(entries, eventIndex, { touched, refsOf, idOf, index, trials, rng })
 *   → { schema, eventIndex, touched, reached, rows, rank, trials, basis }
 *   or a typed refusal { gap: "nothing_touched" } when the event touched no id.
 *
 * `touched`: the ids the event at `eventIndex` re-addressed. `refsOf(entry)`:
 * the ids an entry refers to. `index` (optional): a cascade.js dependentsIndex
 * keyed by `idOf(entry)`, to reach what was derived from a direct hit; only
 * dependents that themselves sit before `eventIndex` are hindsight — one
 * drafted after the event was drafted knowing, and is excluded. Rows are
 * ordered depth ascending, then distance ascending (nearest the event first).
 * `rank` is count(null reached <= real reached) / trials over synthetic
 * touched-sets of the same size drawn without replacement from the ids the
 * prior entries refer to.
 */
export function hindsight(entries, eventIndex, { touched, refsOf, idOf = defaultIdOf, index = null, trials = 200, rng = Math.random } = {}) {
  if (!Array.isArray(entries)) throw new TypeError("hindsight: entries is the log, in order");
  if (!(Number.isInteger(eventIndex) && eventIndex >= 0 && eventIndex <= entries.length)) throw new TypeError("hindsight: eventIndex is a position in entries");
  if (typeof refsOf !== "function") throw new TypeError("hindsight: refsOf(entry) is declared by the caller — no schema is named here");
  if (!(trials >= 1)) throw new TypeError("hindsight: trials is a positive count");
  const touchedSet = new Set([...(touched ?? [])].filter((t) => t != null));
  if (!touchedSet.size) return { gap: "nothing_touched", schema: HINDSIGHT_SCHEMA, eventIndex, basis: "the event re-addressed no id — there is no seam to cut at" };

  const prior = [];
  const positionOf = new Map();
  for (let i = 0; i < eventIndex; i++) {
    const id = idOf(entries[i], i);
    positionOf.set(id, i);
    prior.push({ i, id, refs: [...(refsOf(entries[i]) ?? [])].filter((r) => r != null) });
  }
  const walk = (set) => {
    const rows = [];
    for (const { i, id, refs } of prior) {
      const via = refs.filter((r) => set.has(r));
      if (via.length) rows.push({ index: i, id, via, distance: eventIndex - i, depth: 0, cascadedFrom: null });
    }
    if (!index || !rows.length) return rows;
    const seen = new Set(rows.map((r) => r.id));
    for (const h of cascade(index, rows.map((r) => r.id), { seen })) {
      const i = positionOf.get(h.id);
      if (i == null) continue; // after the event, or not on the log: not hindsight
      rows.push({ index: i, id: h.id, via: [], distance: eventIndex - i, depth: h.cascadeDepth, cascadedFrom: h.cascadedFrom });
    }
    return rows;
  };
  const rows = walk(touchedSet).sort((a, b) => (a.depth - b.depth) || (a.distance - b.distance));

  // THE NULL: touched-sets of the same size, drawn from the ids the prior
  // entries actually refer to — the universe a real event could re-address.
  const pool = [...new Set(prior.flatMap((p) => p.refs))];
  const k = Math.min(touchedSet.size, pool.length);
  let atOrBelow = 0;
  for (let t = 0; t < trials; t++) {
    const draw = pool.slice();
    for (let i = 0; i < k; i++) { const j = i + Math.floor(rng() * (draw.length - i)); [draw[i], draw[j]] = [draw[j], draw[i]]; }
    if (walk(new Set(draw.slice(0, k))).length <= rows.length) atOrBelow++;
  }
  const rank = atOrBelow / trials;
  const direct = rows.filter((r) => r.depth === 0).length;
  return {
    schema: HINDSIGHT_SCHEMA,
    eventIndex,
    touched: [...touchedSet],
    reached: rows.length,
    rows,
    rank,
    trials,
    basis: `${rows.length} of ${eventIndex} prior entr(y/ies) rest on ${touchedSet.size} re-addressed id(s): ${direct} directly${index ? `, ${rows.length - direct} through what was derived from them` : ""}; rank ${rank.toFixed(3)} against ${trials} synthetic touched-set(s) of the same size drawn from the ${pool.length} id(s) the prior entries refer to. Nothing rewritten.`,
  };
}
