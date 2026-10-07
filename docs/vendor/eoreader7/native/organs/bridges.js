// bridges.js — Pass 12 step 2: the referent bridge, as a recorded object.
//
// THE FINDING THIS CLOSES (the-fold NEXT-PASSES.md Pass 12; kernel/notes.js
// S48; eval/the-fold/results/bridge-audit-RESULTS.md). `hear()`'s exact-
// triple match does two jobs: asserting a PROPOSITION is the same, and —
// when the hearing crosses from a source no witness of that note has named
// — asserting the two documents' REFERENTS are the same. S48 separated the
// second job into a `join`, recorded on the note but never given a life of
// its own: no independent witness, no corroboration across the notes that
// happen to rest on the SAME correspondence, no concession. Measured on
// real material (bridge-audit-RESULTS.md): 22 of 22 corroborated notes
// across three real Wikipedia pages rest on an assumed bridge — common, not
// rare, so a bridge earning its own record is warranted on that finding
// alone, independent of whether any given one is right.
//
// THE LOAD-BEARING CLAUSE (Pass 12, verbatim): "it is the same set of
// operations, just at another level." A bridge is an ARRANGEMENT — one
// reading's face for a referent, a fixed declared label, the other
// reading's face for the same referent — and `notes.js`'s `hear`/`concede`
// already compute SIG/INS/SYN/REC correctly on any arrangement. So this
// file adds no new mechanism: it derives bridge arrangements from what
// `hear()` already records on a `join` (S48's own widening keeps both
// sides' faces and spans, not only the established one — see notes.js),
// and hears them onto a SEPARATE ledger via the SAME injected `notes`
// instance the caller already has. Two content notes that independently
// cross the same two sources via the same referent pair now corroborate
// ONE bridge — a capability step 1's per-note `join` could not represent,
// because it kept the assumption but never gave it an identity of its own.
//
// WHY A SEPARATE LEDGER, NOT THE SAME ONE. A bridge is a claim about
// REFERENT correspondence, not about the material's own content; folding
// it onto the content ledger would let `fold()` surface "Smith (page-a) is
// the-same-referent-as Smith (page-b)" as if it were a fact the material
// stated, which no source ever said. Two universes, one bridge ledger
// between them — exactly the Pass 12 reframe ("frame is HOW a reading was
// made; a universe is WHAT it produced; a bridge is what makes comparing
// them legal").
//
// WHAT THIS DOES NOT DO, so it is not claimed later. It does not
// automatically retract a content note when its bridge is conceded — that
// cascade is real, disclosed future work (the same posture `concedeDiet`
// already takes toward `dietBoundaries`: a diagnostic and an act, kept
// apart until the act is itself measured). `bridgeStandingFor` is the
// read-only lookup a caller uses to decide whether to trust a note's
// corroboration; nothing here mutates the content ledger.
//
// PURE; `notes` (a `makeNotes()` instance) injected — the cast.js posture,
// so this file never constructs its own ledger algebra and can be pointed
// at any provider of the same shape.

import { noteId, sourceOfWitness } from "../kernel/notes.js";

/** The one label a bridge arrangement ever carries — declared, not derived, so a bridge is never mistaken for content the material stated. */
export const BRIDGE_LABEL = "same-referent-as";

/** Why a crossing did not become a bridge arrangement. */
export const BRIDGE_REFUSALS = Object.freeze({
  /** The join predates S48's widening (or was hand-built without it) — nothing to derive, and this file never guesses a face. */
  NO_INCOMING_FACE: "no_incoming_face",
});

/** The sorted, deduplicated key for "which sources already stood on this note" — the same key a join's own `from` and a bridge's `end1` prefix both use, so a caller deriving a bridge id independently (bridge-witness.js) computes the identical id. */
export const priorSideKey = (from) => [...new Set(from ?? [])].sort().join("+");

/**
 * deriveBridgeArrangements(note) — every referent correspondence a note's
 * OWN `joins` assumed, as arrangements ready for `hear()`. One join yields
 * up to two arrangements (end1's correspondence, end2's), because a triple
 * match asserts both ends at once. The "prior side" is keyed by the sorted
 * set of sources already on the note when the crossing happened — the
 * SAME provenance `join.from` already carries — so a later crossing that
 * assumes the identical correspondence derives the identical arrangement
 * and corroborates it, never a new one.
 *
 * Returns `{ heard, turnedAway }`, `admit`'s own shape: a join recorded
 * before S48's widening (no `incomingEnds`) is TURNED AWAY by name, never
 * silently skipped or guessed at.
 */
export function deriveBridgeArrangements(note) {
  const heard = [];
  const turnedAway = [];
  for (const j of note?.joins ?? []) {
    if (!j?.incomingEnds) { turnedAway.push({ join: j, reason: BRIDGE_REFUSALS.NO_INCOMING_FACE, detail: "this join has no recorded incoming face — built before the widening, or by a caller that skipped it" }); continue; }
    const priorSide = priorSideKey(j.from);
    const pairs = [["end1", note.end1, j.incomingEnds.end1], ["end2", note.end2, j.incomingEnds.end2]];
    for (const [which, priorFace, incomingFace] of pairs) {
      heard.push({
        end1: `${priorSide}:${priorFace}`,
        label: BRIDGE_LABEL,
        end2: `${j.source}:${incomingFace}`,
        spans: j.incomingSpans ?? [],
        witness: `bridge-inferred:${note.id}#${which}`,
        because: `assumed while hearing "${note.end1} ${note.label} ${note.end2}" (basis: ${j.basis})`,
      });
    }
  }
  return { heard, turnedAway };
}

/**
 * syncBridges(bridgeLog, notes, contentNotes) — hear every derivable
 * bridge from a content ledger's own `fold()` (or `foldWithStanding()`)
 * output onto the bridge ledger. Idempotent: re-syncing an unchanged
 * content ledger appends nothing, because `hear()` itself no-ops when a
 * hearing teaches it nothing new. Returns the same `{ log, heard,
 * turnedAway }` shape `notes.admit` already uses, so a caller reads this
 * exactly like any other door.
 */
export function syncBridges(bridgeLog, notes, contentNotes) {
  let log = bridgeLog;
  const heard = [];
  const turnedAway = [];
  for (const note of contentNotes ?? []) {
    const derived = deriveBridgeArrangements(note);
    turnedAway.push(...derived.turnedAway.map((t) => ({ ...t, note: note.id })));
    for (const arrangement of derived.heard) {
      const before = log;
      log = notes.hear(log, arrangement);
      heard.push({ id: noteId(arrangement.end1, arrangement.label, arrangement.end2), from: note.id, changed: log !== before });
    }
  }
  return { log, heard, turnedAway };
}

/**
 * bridgeStandingFor(bridgeLog, notes, note) — read-only: for a content
 * note, the standing of every bridge its OWN joins rest on, plus whether
 * any is conceded. Never mutates the content ledger — a caller (the
 * ledger-block disclosure, a reviewer) decides what a `conceded` entry
 * here should mean for the note that used it; this file only reports.
 */
export function bridgeStandingFor(bridgeLog, notes, note) {
  const conceded = notes.concededIds(bridgeLog);
  const tasks = new Map(notes.fold(bridgeLog).map((n) => [n.id, n]));
  const bridges = [];
  for (const j of note?.joins ?? []) {
    if (!j?.incomingEnds) { bridges.push({ join: j, gap: BRIDGE_REFUSALS.NO_INCOMING_FACE }); continue; }
    const priorSide = priorSideKey(j.from);
    for (const [which, priorFace, incomingFace] of [["end1", note.end1, j.incomingEnds.end1], ["end2", note.end2, j.incomingEnds.end2]]) {
      const id = noteId(`${priorSide}:${priorFace}`, BRIDGE_LABEL, `${j.source}:${incomingFace}`);
      const bridge = tasks.get(id) ?? null;
      bridges.push({
        which, id,
        standing: conceded.has(id) ? "conceded" : bridge ? notes.standingOf(bridge).standing : "unrecorded",
        witnesses: bridge?.witnesses?.length ?? 0,
        sources: bridge ? new Set(bridge.witnesses.map(sourceOfWitness)).size : 0,
      });
    }
  }
  return bridges;
}
