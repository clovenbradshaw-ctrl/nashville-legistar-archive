// native/kernel/self-record.js — EOSelfRecord@1: the reading mind as a fold of an
// append-only record. The object that makes reading RECURSIVE: we learn things
// later that change what earlier things meant, without forgetting what we
// thought they meant.
//
// PROVENANCE (2026-10-07, promoted from eval/recursion/ — commit 3234403). The
// eval was the experiment; it held (K1/K2/P1/P2 falsified the two-term system
// and the record earned its place, PROGRESS.md), so per the house rule the real
// organ moves into the khora and the eval keeps only the numbers and the
// falsifier. eval/recursion/{self-record,k1,middle}.mjs now IMPORT this module.
//
// THREE PROPERTIES, and only these, enable re-interpretation without amnesia:
//   P1 IMMUTABLE PAST       the log is a grown, frozen list of EOLogEntry@1;
//                           `appendEntry` returns a NEW log. Reading `asOf` a
//                           past cursor reproduces what was believed THEN.
//   P2 REVISION-AS-APPEND   learning later is a REVISE entry that flags a past
//                           claim; it re-keys the CURRENT projection and never
//                           touches the earlier entry.
//   P3 CURSOR PROJECTION    meaning_t(x) = fold(log, asOf = t)(x). Past and
//                           present are views of one log at two cursors.
// THE EVIDENCE GATE (the "when there is sufficient evidence" rule): a revision
// whose standing is `candidate` and whose evidence is below EVIDENCE_BAR is
// RECORDED but IGNORED by every fold until corroborated. Everything is
// recursively changeable, only when evidence clears the bar.
//
// TWO FOLDS of the same principle live here:
//   · the CLAIM LOG (`emptyLog`/`readEntry`/`reviseEntry`/`projectEntries`) —
//     the canonical form: entries carry a {subject,relation,object} claim.
//   · the REVISION RECORD (`createRecord`/`valueAt`/`distinguish`) — the
//     key/value sidecar the gate and the participatory middle read; a
//     convenience view of (entries + revisions) at a cursor.
// Pure: no I/O, no model, no DOM. The clock is the caller's `asOf`.

export const SELF_RECORD_SCHEMA = "EOSelfRecord@1";
export const LOG_ENTRY_SCHEMA = "EOLogEntry@1";
/** Declared, not measured from data: a revision adopts once its evidence reaches
 *  this bar. A single whisper hangs; corroboration re-keys. (II.11: a declared
 *  constant says so and names its giver — the giver is eval/recursion/k1.mjs.) */
export const EVIDENCE_BAR = 2;

const freeze = (x) => Object.freeze(x);

/** The key a claim folds under. */
export const claimKey = (c) => `${c?.subject}|${c?.relation}|${c?.object}`;

// ── P1/P2 · the immutable claim log ──────────────────────────────────────────

export const emptyLog = () => freeze([]);

/** Append (immutable): returns a NEW log. Entries are never edited (P1). */
export function appendEntry(log, entry) {
  const seq = log.length;
  return freeze([...log, freeze({ schema: LOG_ENTRY_SCHEMA, seq, ...entry })]);
}
export const readEntry = (log, claim, { witness = { doc: "demo" }, giver = "t" } = {}) =>
  appendEntry(log, { op: "READ", witness, giver, claim: freeze(claim), revises: null, consequence: { kind: "claim_recorded" } });
export const reviseEntry = (log, pastSeq, claim, { witness = { doc: "demo" }, giver = "t" } = {}) =>
  appendEntry(log, { op: "REVISE", witness, giver, claim: freeze(claim), revises: pastSeq, consequence: { kind: "claim_revised", past: pastSeq } });

/** Fold the log at cursor t (entries 0..t): key -> { meaning, source, revisedFrom }.
 *  The immutable past is honoured: an entry's own meaning never changes (P1/P3). */
export function projectEntries(log, t = log.length) {
  const out = new Map();
  for (let i = 0; i <= Math.min(t, log.length - 1); i += 1) {
    const e = log[i];
    if (!e.claim) continue;
    if (e.op === "REVISE" && e.revises != null) {
      const oldK = claimKey(log[e.revises]?.claim ?? {});
      const prev = out.get(oldK);
      if (prev) out.set(oldK, { ...prev, revisedFrom: e.seq, revisedBy: e.seq });
      // fall through: the new meaning is its own key — the old one stays (P1)
    }
    const k = claimKey(e.claim);
    const prev = out.get(k);
    out.set(k, { meaning: e.claim, source: e.seq, revisedFrom: e.op === "REVISE" ? e.revises : (prev?.revisedFrom ?? null), revisedBy: null });
  }
  return out;
}

// ── the evidence gate + the revision record (k1/middle) ──────────────────────

/** Does a revision's evidence clear the bar? A non-candidate always counts; a
 *  candidate counts only at/above EVIDENCE_BAR. */
export const adjudicated = (r) => r.standing !== "candidate" || Number(r.evidence ?? 0) >= EVIDENCE_BAR;

/** The working revision store: seed entries plus an append-only revisions list. */
export function createRecord(seed = []) {
  return { schema: SELF_RECORD_SCHEMA, entries: (seed ?? []).map((e) => freeze({ ...e })), revisions: [] };
}

/** The value of `key` at cursor `asOf`: the last entry, then the last ADOPTED
 *  revision, with seq <= asOf. A candidate below the bar is never believed. */
export function valueAt(record, asOf, key) {
  let v = null;
  for (const e of record.entries ?? []) if (e.seq <= asOf && e.key === key) v = e.value;
  for (const r of record.revisions ?? []) if (r.seq <= asOf && r.key === key && adjudicated(r)) v = r.to;
  return v;
}

/** THE PARTICIPATORY MIDDLE. One witness arrives; it is reconciled with the fold
 *  at the cursor:
 *    mechanical     the arrival is consistent → reuse, nothing appended.
 *    participatory  it CONFLICTS → build the re-key (key -> arrival), record it
 *                   as a candidate with cumulative evidence, and adopt from its
 *                   own seq once the evidence clears the bar. `reopens:true`
 *                   when it re-opens an inherited/given distinction.
 *  Everything it generates is an entry with seq/key/to/evidence/standing —
 *  nothing unlogged (the middle earns its place by evidence, K1). */
export function distinguish(record, { asOf, key, arrival, weight = 1 } = {}) {
  const cur = valueAt(record, asOf, key);
  const conflict = cur != null && Number(cur) !== Number(arrival) && String(cur) !== String(arrival);
  if (!conflict) return { mode: "mechanical", key, cur, appended: false };
  const prior = (record.revisions ?? []).filter((r) => r.key === key && r.seq <= asOf).reduce((a, x) => a + Number(x.evidence ?? 1), 0);
  const evidence = prior + weight;
  const inherited = record.entries.find((e) => e.key === key)?.standing === "given";
  const rev = { seq: asOf + 0.5, key, to: arrival, evidence, standing: "candidate", kind: "generated", ...(inherited ? { reopens: true } : {}) };
  record.revisions.push(rev); // recorded, append-only
  const adoptedNow = adjudicated(rev);
  return {
    mode: "participatory", key, cur, to: arrival, evidence, appended: true,
    standing: adoptedNow ? "adopted" : "pending", reopens: inherited || undefined,
    now: valueAt(record, asOf + 0.5, key),
  };
}

export default { SELF_RECORD_SCHEMA, LOG_ENTRY_SCHEMA, EVIDENCE_BAR, claimKey, emptyLog, appendEntry, readEntry, reviseEntry, projectEntries, adjudicated, createRecord, valueAt, distinguish };
