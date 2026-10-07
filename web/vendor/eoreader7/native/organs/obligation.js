// obligation.js — the obligation ledger (Tier 4 #13): long instruction
// sets admitted at a door, clause standings typed, coverage as ENUMERATION
// rather than relevance.
//
// THE GAP (NEXT-PASSES, verbatim): "long instruction sets admitted at the
// door, clause standings typed (satisfied/violated/waived/not-yet-visited),
// coverage as enumeration not relevance. The pieces exist; the ledger
// between them doesn't." Retrieval answers "what is RELEVANT to this
// step"; an instruction set needs the opposite discipline — every clause
// is owed a visit, and a clause nothing ever visited is a hole in the
// work, not a low-relevance passage. The same withhold-vs-convict line as
// everywhere else: NOT-YET-VISITED is its own standing, never collapsed
// into violated (absence of a visit is a fact about the worker) and never
// silently promoted to satisfied (which is how checklists rot).
//
// THE SHAPE, reused not invented: an append-only entry log projected to
// current standings — store.js/hyperlexicon.js's own law ("the log is
// truth, projection is convenience"). Every standing change carries
// `because` and optional `refs` (addresses into the work that satisfied
// or violated the clause — P5.2's discipline extended to obligations),
// and a standing may only move along declared transitions: a VIOLATED
// clause does not become satisfied by a later edit without the violation
// staying on the log; WAIVED requires a stated reason and a named waiver.
//
// PURE. No engine import; clauses arrive as text, the split is the
// material's own enumeration marks (numbered/lettered/bulleted lines),
// and material with no enumeration is a typed refusal — this ledger
// tracks DECLARED obligations, it does not invent clause boundaries
// inside prose (that would be a second, hidden segmenter).

export const STANDINGS = Object.freeze(["not-yet-visited", "satisfied", "violated", "waived"]);

export const REFUSALS = Object.freeze({
  no_enumeration: "this text declares no enumerated clauses (numbered, lettered, or bulleted) — the ledger tracks DECLARED obligations and never invents clause boundaries inside prose",
  unknown_clause: "no clause with that id is on the ledger",
  unknown_standing: "a standing is one of: " + STANDINGS.join(", "),
  waiver_needs_names: "a waiver carries a stated reason AND who waived — an unattributed waiver is a deletion wearing a standing's clothes",
  no_because: "a standing change carries its because — an unexplained transition is bookkeeping, not a record",
});

const MARK_RE = /^\s*(?:(\d+)[.)]|([a-z])[.)]|[-*•])\s+(.+)$/i;

/** admit(text) — the door: split DECLARED clauses, refuse un-enumerated prose. */
export function admitObligations(text) {
  const clauses = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(MARK_RE);
    if (!m) continue;
    const body = m[3].trim();
    if (!body) continue;
    clauses.push({ id: `ob-${clauses.length + 1}`, mark: (m[1] ?? m[2] ?? "•").toLowerCase(), text: body });
  }
  if (!clauses.length) return { refused: "no_enumeration", detail: REFUSALS.no_enumeration };
  return {
    ledger: {
      clauses: Object.freeze(clauses),
      entries: clauses.map((c) => ({ clause: c.id, standing: "not-yet-visited", because: "admitted at the door", at: 0 })),
      seq: 1,
    },
  };
}

/** mark(ledger, clauseId, standing, {because, refs, waivedBy}) — append-only. */
export function mark(ledger, clauseId, standing, { because, refs = [], waivedBy = null } = {}) {
  if (!STANDINGS.includes(standing)) return { refused: "unknown_standing", detail: REFUSALS.unknown_standing };
  if (!ledger?.clauses?.some((c) => c.id === clauseId)) return { refused: "unknown_clause", detail: REFUSALS.unknown_clause, clause: clauseId };
  if (!because || !String(because).trim()) return { refused: "no_because", detail: REFUSALS.no_because };
  if (standing === "waived" && (!waivedBy || !String(waivedBy).trim()))
    return { refused: "waiver_needs_names", detail: REFUSALS.waiver_needs_names };
  const entry = { clause: clauseId, standing, because: String(because), refs: [...refs], at: ledger.seq, ...(waivedBy ? { waivedBy } : {}) };
  return { ledger: { ...ledger, entries: [...ledger.entries, entry], seq: ledger.seq + 1 } };
}

/** The projection: current standing per clause, with full history intact. */
export function standings(ledger) {
  const current = new Map();
  for (const e of ledger?.entries ?? []) current.set(e.clause, e);
  return (ledger?.clauses ?? []).map((c) => ({ ...c, ...current.get(c.id) }));
}

/**
 * coverage(ledger) — ENUMERATION, not relevance: every clause counted into
 * exactly one bucket, the unvisited NAMED (never just tallied — a hole you
 * cannot see is a hole you will not visit), and `complete` true only when
 * nothing remains unvisited AND nothing stands violated. A violation
 * history that was later satisfied stays readable on the log — this
 * projection reports the CURRENT standing, the entries report the road.
 */
export function coverage(ledger) {
  const now = standings(ledger);
  const by = { "not-yet-visited": [], satisfied: [], violated: [], waived: [] };
  for (const s of now) by[s.standing].push(s.id);
  return {
    total: now.length,
    counts: Object.fromEntries(STANDINGS.map((k) => [k, by[k].length])),
    unvisited: by["not-yet-visited"].map((id) => ({ id, text: now.find((s) => s.id === id)?.text })),
    violated: by.violated,
    complete: by["not-yet-visited"].length === 0 && by.violated.length === 0,
  };
}
