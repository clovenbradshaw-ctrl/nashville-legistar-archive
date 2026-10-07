// native/kernel/sequence.js — "next in a sequence", modelled once.
//
// ADMITTED BY MEASUREMENT, NOT BY ELEGANCE. The user's bar, verbatim
// (2026-08-28): "this needs to demonstrably improve retrieval and reasoning
// before admission" — "and prediction". the-fold's
// eval/sequence-admission.mjs is the gate: retrieval 47/47 unique-correct
// where flat conflated 7 (zero wrong); reasoning 95 derived / 31
// oracle-true / 0 false at precision 1.000 and depth 6, strictly dominating
// the shipped pareto frontier (office gate: 5 true @ 1.000; interval gate:
// 20 true @ 0.909) with NO veto and NO interval side-channel; prediction 7
// leave-one-out recoveries at zero wrong against a structural-zero baseline.
// The gate's PRE-REGISTERED prediction arm FAILED first (3 wrong guesses)
// and that failure is kept verbatim in the results: it exposed that the
// declared algebra was refutable and unrefuted, and produced `refuteLocus`
// below. S21 (READING-SPEC.md) is the law this module carries.
//
// WHY THIS EXISTS. Office succession, hospital-bed occupancy, versions,
// chapters and queues are one relational type wearing different nouns, and
// this repo rediscovered its properties one patch at a time: the locus
// smuggled into the relation NAME (`replaces:<office>`, 24 affordance rows),
// the order witness passed out of band (`intervalOf`), position identity
// rebuilt after the adapter destroyed it (`person#office#start`), and a
// "cycle" that was only ever a RETURN read at the wrong grain. None of those
// are facts about any domain; they are what being next-in-sequence means.
//
// THE ARROW IS STRUCTURAL, NOT METRIC. This module never parses a date and
// does no time arithmetic: `orderedBy`/`until` values are OPAQUE ORDERED
// KEYS, compared only with === and < . A linked list — a sequence with no
// clock at all — is declared by omitting them, and loses exactly the
// abutment affordances and nothing else. Where keys exist they witness the
// material's own irreversibility; they are never durations.
//
// A POSITION IS NOT ITS OCCUPANT. The one distinction everything here rests
// on: a thing may hold the same sequence more than once (thirteen standings
// of one occupant in one seat, in the real material this was built against).
// Edges relate POSITIONS; occupants are what positions are of. Collapsing
// them manufactures cycles out of returns and conflates neighbours across
// standings.
//
// WHAT THIS MODULE IS NOT. Not a reader (it never touches text), not a
// classifier (nothing infers a sequence from content — the mapping is
// DECLARED, with a giver, and a corpus may refute the algebra but never earn
// it), and not a kernel change (edges it emits chain in the existing kernel
// because position identity CARRIES the locus — the constraint the 24 rows
// encoded, held by identity instead).

const freeze = Object.freeze;

/** What being next-in-sequence entails — the reader's declared, defeasible
 *  commitment, never a fact a corpus proved. */
export const ALGEBRA = freeze({
  irreflexive: "no position immediately follows itself",
  asymmetric: "if a position follows b, b does not follow a",
  functionalPerPosition: "a position has at most one immediate predecessor and one immediate successor — of POSITIONS, never of occupants",
  closureIsAnotherRelation: "the transitive closure is a strict order and a DIFFERENT relation; uniqueness refutes nothing about it",
  locusScoped: "composition holds only within one locus; across loci it is unsound",
});

const val = (record, field, index) =>
  typeof field === "function" ? field(record, index) : (field == null ? null : record?.[field]);

/**
 * declareSequence(...) — a domain's mapping, as data.
 *
 * `locus` — which sequence a record's standing is in (an office, a bed, a
 * product line). `occupant` — the durable thing holding it. `position` — what
 * names ONE standing distinctly (a start key, a statement index): required
 * and distinct from `occupant`, because a thing may hold a sequence twice.
 * `predecessor`/`successor` — fields naming the neighbouring OCCUPANT, which
 * is how sources typically record it; resolving that to a POSITION is this
 * module's job and is disclosed when it cannot be done. `orderedBy`/`until` —
 * optional opaque order keys for a standing's two boundaries; their absence
 * is a real declared difference (a linked list), not a defaulted one.
 */
export function declareSequence({ relation, locus, occupant, position, predecessor = null, successor = null, orderedBy = null, until = null, giver } = {}) {
  if (!relation) throw new TypeError("declareSequence: the relation is named, never inferred");
  if (!giver) throw new TypeError("declareSequence: a named giver — the algebra is this reader's commitment, and a corpus cannot earn it");
  if (locus == null) throw new TypeError("declareSequence: a locus is required — omitting it is how a third argument ends up smuggled inside the relation name");
  if (occupant == null || position == null) throw new TypeError("declareSequence: occupant and position are both required and are not the same field — a thing may hold one sequence more than once");
  return freeze({ relation, locus, occupant, position, predecessor, successor, orderedBy, until, giver, algebra: ALGEBRA });
}

const posId = (locus, occupant, key) => `pos:${locus}|${occupant}|${key}`;
const IMPLIED = "@unwitnessed";

/**
 * readSequence(records, declaration, { hyperedge }) — records to
 * position-grain edges, locus carried on every one.
 *
 * The edge shape: participants `[fromPosition, locus, toPosition]` with
 * `meta.locusAt: 1` — the locus is identified by ORDINAL, never by a role
 * name the kernel would have to interpret (S6: an arrangement has ends, not
 * parts of speech). Ends stay first/last, so these edges chain in the
 * EXISTING kernel unchanged — and cross-locus chains are impossible by
 * construction, because a position's identity contains its locus.
 *
 * Neighbour resolution, in order, never first-match:
 *   1. the occupant has exactly ONE standing in this locus — unambiguous;
 *   2. order keys decide: the standing whose `until` is the LATEST at or
 *      before this standing's own start (the most recently completed one) —
 *      a measured choice, not a positional accident;
 *   3. otherwise DISCLOSED as unresolved; no edge is emitted, because an
 *      occupant-grain fallback would reintroduce the conflation this exists
 *      to remove.
 * An occupant with NO standings in the material gets ONE implied standing
 * (`@unwitnessed`) so chains through off-corpus neighbours stay alive; the
 * count is disclosed, and the risk it carries (an absent occupant who truly
 * held twice would be conflated) is named in the result rather than hidden.
 *
 * CONTINUITY: where order keys exist, two standings of the SAME occupant in
 * the SAME locus that strictly abut (one's `until` === the next's start) are
 * linked with the same relation, `basis: "continuity-abutment"`. This is the
 * dates-as-material move: the middle terms of a long tenure typically carry
 * NO neighbour pointers at all, and without continuity the sequence's own
 * line breaks there. A gap is NEVER bridged — someone else held it, and their
 * own standings carry the chain.
 */
export function readSequence(records = [], declaration, { hyperedge } = {}) {
  if (!declaration?.relation) throw new TypeError("readSequence: a declaration from declareSequence()");
  if (typeof hyperedge !== "function") throw new TypeError("readSequence: hyperedge is injected");
  const d = declaration;

  const rows = [...records].map((record, index) => ({
    record, index,
    locus: val(record, d.locus, index),
    occupant: val(record, d.occupant, index),
    key: val(record, d.position, index),
    order: d.orderedBy ? val(record, d.orderedBy, index) : null,
    until: d.until ? val(record, d.until, index) : null,
  })).filter((r) => r.locus != null && r.occupant != null && r.key != null);
  for (const r of rows) r.id = posId(r.locus, r.occupant, r.key);

  const groups = new Map();           // `${locus} ${occupant}` -> rows
  for (const r of rows) {
    const k = `${r.locus} ${r.occupant}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const implied = new Map();          // same key -> implied position id
  const unresolved = [];

  /** Which STANDING of `occupantRef` does a pointer on `row` name? */
  const resolveStanding = (row, occupantRef, side) => {
    const k = `${row.locus} ${occupantRef}`;
    const list = groups.get(k) ?? [];
    if (list.length === 0) {
      if (!implied.has(k)) implied.set(k, posId(row.locus, occupantRef, IMPLIED));
      return { id: implied.get(k), implied: true };
    }
    if (list.length === 1) return { id: list[0].id, implied: false };
    // several standings: order keys decide, or nothing does
    const anchor = side === "predecessor" ? row.order : row.until;
    if (anchor != null) {
      if (side === "predecessor") {
        // the most recently COMPLETED standing at or before this one began
        const done = list.filter((c) => c.until != null && String(c.until) <= String(anchor));
        if (done.length) return { id: done.reduce((a, b) => (String(a.until) >= String(b.until) ? a : b)).id, implied: false };
      } else {
        // the earliest standing beginning at or after this one ended
        const next = list.filter((c) => c.order != null && String(c.order) >= String(anchor));
        if (next.length) return { id: next.reduce((a, b) => (String(a.order) <= String(b.order) ? a : b)).id, implied: false };
      }
    }
    unresolved.push({ locus: row.locus, occupant: occupantRef, standings: list.length, from: row.id, side,
      why: "several standings of this occupant in this sequence and no order key chooses between them" });
    return null;
  };

  const byKey = new Map();            // `${from} ${to}` -> edge draft
  const draft = (from, to, locus, basis, index, occupants) => {
    const k = `${from} ${to}`;
    if (byKey.has(k)) { byKey.get(k).bases.add(basis); return; }
    byKey.set(k, { from, to, locus, bases: new Set([basis]), index, occupants });
  };

  for (const r of rows) {
    const pred = d.predecessor ? val(r.record, d.predecessor, r.index) : null;
    if (pred != null) {
      const t = resolveStanding(r, pred, "predecessor");
      if (t) draft(r.id, t.id, r.locus, "declared-pointer", r.index, { [r.id]: r.occupant, [t.id]: pred });
    }
    const succ = d.successor ? val(r.record, d.successor, r.index) : null;
    if (succ != null) {
      const t = resolveStanding(r, succ, "successor");
      if (t) draft(t.id, r.id, r.locus, "declared-pointer", r.index, { [t.id]: succ, [r.id]: r.occupant });
    }
  }

  // continuity — strict abutment only; a gap is someone else's standing
  if (d.orderedBy && d.until) {
    for (const list of groups.values()) {
      const sorted = [...list].filter((r) => r.order != null).sort((a, b) => (String(a.order) < String(b.order) ? -1 : 1));
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1], next = sorted[i];
        if (prev.until != null && String(prev.until) === String(next.order)) {
          draft(next.id, prev.id, next.locus, "continuity-abutment", next.index,
            { [next.id]: next.occupant, [prev.id]: prev.occupant });
        }
      }
    }
  }

  const edges = [...byKey.values()].map((e, i) => hyperedge({
    id: `${d.relation}:${i}:${e.from}->${e.to}`,
    relation: d.relation,
    witness: { giver: d.giver, record: e.index },
    participants: [
      { ref: e.from, standing: "referent", role: null },
      { ref: e.locus, standing: "referent", role: null },
      { ref: e.to, standing: "referent", role: null },
    ],
    meta: { locusAt: 1, bases: [...e.bases], occupants: e.occupants },
  }));

  const positions = rows.map((r) => freeze({ id: r.id, locus: r.locus, occupant: r.occupant, key: r.key, order: r.order, until: r.until }));
  const impliedList = [...implied.entries()].map(([k, id]) => {
    const sp = k.indexOf(" ");
    return freeze({ id, locus: k.slice(0, sp), occupant: k.slice(sp + 1) });
  });
  return freeze({
    edges: freeze(edges),
    positions: freeze(positions),
    implied: freeze(impliedList),
    impliedRisk: impliedList.length
      ? "an occupant with no records here got ONE implied standing; if it truly held this sequence more than once, its neighbours are conflated exactly the way person grain conflated everything"
      : null,
    unresolved: freeze(unresolved),
  });
}

/** The locus of an edge this module produced — read by the DECLARED ordinal,
 *  never by a role name (S6). */
export const locusOf = (edge) => {
  const at = edge?.meta?.locusAt;
  return Number.isInteger(at) ? (edge?.participants?.[at]?.ref ?? null) : null;
};

/** Do two edges sit in the same sequence? The constraint `replaces:<office>`
 *  encoded by keying — held here as a question, not a naming convention. */
export const sameLocus = (left, right) => {
  const a = locusOf(left), b = locusOf(right);
  return a != null && b != null && a === b;
};

/**
 * refuteLocus(positions) — the corpus refuting the DECLARATION, which is the
 * one thing the grain theorem says it may do.
 *
 * The algebra declares every locus single-file (`functionalPerPosition`).
 * That is the reader's commitment, and the material can hold a positive
 * counterexample: two standings of DIFFERENT occupants overlapping in time
 * inside one locus prove the locus is a POOL — many concurrent seats filed
 * under one name — and single-file inference there is unsound. Found live,
 * not hypothesized: "United States senator" is one Wikidata office for a
 * hundred concurrent seats, every March-4 turnover synchronizes boundaries
 * across them, and strict abutment predicted the wrong occupant from a
 * PARALLEL seat. The declaration was refutable and nothing checked it —
 * the same comment-not-a-wall shape this repo keeps paying for.
 *
 * Overlap is the same half-open [order, until) read the interval organ uses;
 * both keys must be present on both standings — absence refutes nothing
 * (open-world), it just fails to refute.
 */
export function refuteLocus(positions = []) {
  const byLocus = new Map();
  for (const p of positions) {
    if (p.order == null || p.until == null) continue;
    if (!byLocus.has(p.locus)) byLocus.set(p.locus, []);
    byLocus.get(p.locus).push(p);
  }
  const refuted = [];
  for (const [locus, list] of byLocus) {
    let example = null;
    outer: for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i], b = list[j];
      if (a.occupant === b.occupant) continue;   // a return is the occupant's own line
      if (String(a.order) < String(b.until) && String(b.order) < String(a.until)) { example = { a: a.id, b: b.id }; break outer; }
    }
    if (example) refuted.push(freeze({ locus, counterexample: freeze(example),
      why: "two different occupants stand here at overlapping times — this locus is a POOL of concurrent seats, not a single-file sequence, and cross-occupant abutment inference in it is unsound" }));
  }
  return freeze({
    refuted: freeze(refuted),
    refutedLoci: freeze(new Set(refuted.map((r) => r.locus))),
    disclosure: "a locus this scan does not refute is not thereby proven single-file — undated standings cannot testify; open-world absence refutes nothing (the falsification probe's own law)",
  });
}

/**
 * predictNeighbour(positions, {locus, of, side, refutedLoci}) — the PREDICTION affordance:
 * with a pointer absent, which standing abuts? STRICT abutment only (one
 * standing's `until` === the other's start): a near miss is a gap, a gap is
 * someone else, and guessing across it is how a wrong mechanical answer
 * outruns an honest refusal. Returns the abutting position or a typed
 * refusal — never a nearest-match.
 */
export function predictNeighbour(positions = [], { locus, of, side = "predecessor", refutedLoci = null } = {}) {
  if (refutedLoci && refutedLoci.has(locus)) {
    return freeze({ refused: "locus_refuted",
      why: "this locus holds concurrent standings of different occupants — a pool, not a single file — so an abutting boundary may belong to a parallel seat; measured live: it predicted the wrong occupant before this refusal existed" });
  }
  const target = positions.find((p) => p.id === of);
  if (!target) return freeze({ refused: "unknown_position" });
  const anchor = side === "predecessor" ? target.order : target.until;
  if (anchor == null) return freeze({ refused: "no_order_key", why: "this standing carries no boundary key; abutment is unmeasurable" });
  const hits = positions.filter((p) => p.locus === locus && p.id !== of &&
    (side === "predecessor" ? p.until != null && String(p.until) === String(anchor)
                            : p.order != null && String(p.order) === String(anchor)));
  if (hits.length === 1) return freeze({ position: hits[0], basis: "strict-abutment" });
  if (hits.length > 1) return freeze({ refused: "ambiguous_abutment", candidates: hits.map((h) => h.id) });
  return freeze({ refused: "no_abutment", why: "no standing's boundary meets this one exactly — the gap belongs to someone this material has not witnessed" });
}
