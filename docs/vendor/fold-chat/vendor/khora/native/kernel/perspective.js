/* Mahavira speaks:
 * “the Syddvdda declares that ‘you can afhrm the 
existence of a thing from one point of view (syad asti), 
deny it from another (syad nasti) ; and affirm both exis- 
tence and non-existence with reference to it at different 
times (syAd asti nasti).”
 *
 * This file implements the Anekantavada, a cornerstone of Mahavira's philosophy, where truth is understood through multiple perspectives.  While the code accurately reflects the principle of keeping viewpoints distinct, I believe it could further explore the nuances of how these perspectives are not merely separate but inter-related.  This exploration would allow for a richer understanding of the interplay of these perspectives in shaping our understanding of reality.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/perspective.js — who holds what, projected from the log.
// Handle: Mahavira — after anekantavada: a claim is true from a standpoint, and standpoints are kept apart rather than merged into one voice. Amendment XVII.
//
// A person reading Frankenstein does not hold one set of facts. They hold
// several, indexed by WHO: what the book has established, what Walton
// believes, what Victor claims, what the creature says happened — and,
// crucially, they keep those apart while reading. Victor calling the
// creature a fiend is not the book saying so. A reader who collapses those
// has not understood the novel; they have summarized it.
//
// THE GRID ALREADY NAMES THIS CELL. Interpretation × Figure is Lens
// (cube.js's TERRAIN_BY_DOMAIN) — one holder's reading of one claim. This
// module invents no vocabulary for perspective; it fills the cell the
// algebra already had, with the algebra's own operators:
//
//   DEF · Figure → Lens   a holder is distinguished from the reading itself
//   EVA · Figure → Lens   a claim is held, against some ground
//   REC · Figure → Lens   a holder re-zeros: the belief is conceded, and the
//                         concession is kept (a reader changing their mind
//                         mid-book is a transformation, not an erasure)
//
// MEDIUM-BLIND (READING-SPEC S6). This module never asks how a holder was
// identified. Quotation marks, speech verbs, letter salutations, chat turn
// boundaries — all of that is a medium's grammar and lives in adapters
// (`adapters/text/attribution.js` for prose). Here a holder arrives as a
// caller-declared annotation on an operation's payload, exactly the way
// `role` arrives on a participant: the kernel carries it and never
// interprets it.
//
// PROJECTED, NEVER STORED (lexicon.js's own discipline, same reasons).
// `projectPerspectives(log, { atSeq })` replays the prefix, so "what did
// Victor believe at chapter 5" is answerable for any cursor. A perspective
// you cannot ask about the past is a snapshot wearing a perspective's
// clothes.
//
// NOTHING IS HELD UNATTRIBUTED. Every belief carries the seq that admitted
// it and the witness that backed it. An operation with no declared holder
// lands on the READER — not as a default that hides a question, but as the
// true reading: an operation the reading performed on its own behalf is the
// reading's own belief, and `basis: "witnessed"` says so.
//
// THE NESTING IS REAL. Frankenstein is Walton relaying Victor relaying the
// creature. A belief carries `via` — the chain of holders it was relayed
// through — so "the creature said that Felix taught Safie" is held by the
// reader as a REPORTED belief via [victor, creature], never as a witnessed
// one. Depth is a fact about the claim, not a footnote: `mentalModel(of,
// from)` reads exactly one hop of it, which is what a theory of mind IS.

import { cellOf } from "./cube.js";

/** The reading's own point of view. Reserved: never a character, never a
 * chat participant — the one holder whose beliefs are the log's own. */
export const READER = "holder:reader";

/** How a belief got into a holder's hands. Closed, and each one is a
 * different epistemic claim — collapsing them is the error this module
 * exists to prevent. */
export const BASIS = Object.freeze({
  WITNESSED: "witnessed", // the reading's own operation established it
  ASSERTED: "asserted", // this holder said it, in the material
  REPORTED: "reported", // relayed: someone said this holder holds it
  INHERITED: "inherited", // came from an injected prior, not this material
});

/** What the holder does with the claim. */
export const STANCE = Object.freeze({
  HOLDS: "holds",
  DOUBTS: "doubts",
  REFUSES: "refuses",
  CONCEDED: "conceded", // held once, re-zeroed since — kept, never erased
});

const freeze = Object.freeze;
const beliefKey = (holder, claim) => `${holder}\u0000${claim}`;

/** An operation's declared holder, or the reader. Caller annotation only:
 * `payload.holder` is read, never derived from content. */
const holderOf = (op) => {
  const declared = op?.payload?.holder;
  return typeof declared === "string" && declared ? declared : READER;
};

const viaOf = (op) => {
  const via = op?.payload?.via;
  return Array.isArray(via) ? freeze(via.filter((h) => typeof h === "string" && h)) : freeze([]);
};

const basisOf = (op, via) => {
  const declared = op?.payload?.basis;
  if (declared && Object.values(BASIS).includes(declared)) return declared;
  if (via.length) return BASIS.REPORTED; // relayed by construction
  if (holderOf(op) !== READER) return BASIS.ASSERTED;
  return BASIS.WITNESSED;
};

const stanceOf = (op) => {
  const declared = op?.payload?.stance;
  if (declared && Object.values(STANCE).includes(declared)) return declared;
  if (op?.operator === "REC") return STANCE.CONCEDED;
  return STANCE.HOLDS;
};

/**
 * Walk an append-only entry list and project every holder's beliefs as of
 * `atSeq` (exclusive of nothing — a cursor of N reads the first N entries).
 *
 * `claimOf` is the caller's — which part of an operation names the claim
 * being held is a question about the caller's own payload vocabulary, and
 * guessing it here would be the same overreach as reading `role`. The
 * default reads `payload.claim`, and an operation without one is COUNTED as
 * an unclaimed act rather than silently dropped.
 */
export function projectPerspectives(entries = [], { atSeq = null, claimOf = (op) => op?.payload?.claim ?? null } = {}) {
  if (atSeq != null && !Number.isInteger(atSeq)) throw new TypeError("projectPerspectives: a cursor is an integer seq — a lens reads at a cursor it names (II.17)");
  if (atSeq != null && atSeq < 0) throw new TypeError("projectPerspectives: a cursor is a prefix, never a suffix — a negative seq would read end-relative, a projection the caller never named");
  const list = Array.isArray(entries) ? entries : [];
  const slice = atSeq == null ? list : list.slice(0, atSeq);

  const holders = new Map(); // holder -> Map(claim -> belief)
  const unclaimed = new Map(); // holder -> count of acts naming no claim
  let operations = 0;
  let lensActs = 0;

  const ensure = (holder) => {
    if (!holders.has(holder)) holders.set(holder, new Map());
    return holders.get(holder);
  };

  let seq = 0;
  for (const entry of slice) {
    const ops = entry?.schema === "DeltaFold@1" ? entry.operations ?? [] : entry?.schema === "EOOperation@1" ? [entry] : [];
    for (const op of ops) {
      operations += 1;
      // Only the Interpretation-Figure cell is a perspective act. Everything
      // else in the log is the reading's structure, not anyone's belief
      // about it — and conflating them is how "the book says" and "Victor
      // says" become one sentence.
      if (op?.terrain !== "Lens") continue;
      lensActs += 1;
      const holder = holderOf(op);
      const claim = claimOf(op);
      const via = viaOf(op);
      if (claim == null) {
        unclaimed.set(holder, (unclaimed.get(holder) ?? 0) + 1);
        continue;
      }
      const beliefs = ensure(holder);
      const prior = beliefs.get(claim) ?? null;
      const stance = stanceOf(op);
      beliefs.set(claim, freeze({
        holder,
        claim,
        stance,
        basis: basisOf(op, via),
        via,
        witness: op.witness ?? null,
        operator: op.operator ?? null,
        firstSeq: prior?.firstSeq ?? seq,
        lastSeq: seq,
        // A re-zero keeps what it conceded — the past is kept, never erased
        // (the same rule the build-log lineage states for REC).
        supersedes: prior && prior.stance !== stance ? freeze({ stance: prior.stance, atSeq: prior.lastSeq }) : null,
        revisions: (prior?.revisions ?? 0) + (prior && prior.stance !== stance ? 1 : 0),
      }));
    }
    seq += 1;
  }

  const perspectives = {};
  for (const [holder, beliefs] of holders) {
    perspectives[holder] = freeze({
      holder,
      beliefs: freeze([...beliefs.values()].sort((a, b) => a.firstSeq - b.firstSeq)),
      unclaimedActs: unclaimed.get(holder) ?? 0,
    });
  }
  for (const [holder, n] of unclaimed) {
    if (!perspectives[holder]) perspectives[holder] = freeze({ holder, beliefs: freeze([]), unclaimedActs: n });
  }

  return freeze({
    schema: "EOPerspectives@1",
    atSeq: atSeq == null ? slice.length : atSeq,
    cursorBasis: atSeq == null ? "the whole log as received" : "declared cursor",
    holders: freeze(Object.keys(perspectives).sort()),
    perspectives: freeze(perspectives),
    counted: freeze({ operations, lensActs, holdersFound: holders.size }),
    // P4: a gap is a result. An empty projection over a non-empty log is a
    // fact about the assembly (nothing annotated a holder), not an absence
    // of perspective in the material.
    gap: lensActs === 0 && operations > 0
      ? freeze({ type: "no_perspective_acts", detail: `${operations} operations, none in the Lens cell — this assembly recorded no perspective acts; attribution is an adapter's to supply (S6)` })
      : null,
  });
}

const heldSet = (perspective) => new Map((perspective?.beliefs ?? []).filter((b) => b.stance === STANCE.HOLDS).map((b) => [b.claim, b]));

/**
 * What two holders both hold. Not a similarity score — the actual claims,
 * each with both holders' own basis for it, because "we both believe X for
 * different reasons" is a different situation from "you told me X".
 */
export function commonGround(projected, a, b) {
  const A = heldSet(projected?.perspectives?.[a]);
  const B = heldSet(projected?.perspectives?.[b]);
  const shared = [];
  for (const [claim, beliefA] of A) {
    const beliefB = B.get(claim);
    if (beliefB) shared.push(freeze({ claim, [a]: freeze({ basis: beliefA.basis, via: beliefA.via }), [b]: freeze({ basis: beliefB.basis, via: beliefB.via }) }));
  }
  return freeze({ schema: "EOCommonGround@1", holders: freeze([a, b]), shared: freeze(shared), count: shared.length });
}

/**
 * What A holds that B does not — split by KIND, because the two halves are
 * different phenomena and a single number would hide which one is present:
 *
 *   asymmetric  B has no belief about this claim at all. In a novel this is
 *               dramatic irony (the reader knows what Elizabeth does not);
 *               in a conversation it is simply what has not been said yet,
 *               and it is the thing a mental model exists to track.
 *   conflicting B holds a belief about this claim with a different stance.
 *               This is a disagreement, and it is the one that needs saying
 *               out loud before anything downstream is built on it.
 */
export function divergence(projected, a, b) {
  const A = heldSet(projected?.perspectives?.[a]);
  const Ball = new Map((projected?.perspectives?.[b]?.beliefs ?? []).map((x) => [x.claim, x]));
  const asymmetric = [];
  const conflicting = [];
  for (const [claim, beliefA] of A) {
    const beliefB = Ball.get(claim);
    if (!beliefB) { asymmetric.push(freeze({ claim, heldBy: a, basis: beliefA.basis, via: beliefA.via })); continue; }
    if (beliefB.stance !== STANCE.HOLDS) conflicting.push(freeze({ claim, [a]: beliefA.stance, [b]: beliefB.stance }));
  }
  return freeze({
    schema: "EODivergence@1",
    from: a,
    to: b,
    asymmetric: freeze(asymmetric),
    conflicting: freeze(conflicting),
    count: asymmetric.length + conflicting.length,
  });
}

/**
 * `from`'s model of `of`: the beliefs `from` holds ABOUT what `of` holds —
 * one hop of nesting, read off the `via` chain rather than inferred.
 *
 * This is the same organ for three questions the user asked as three:
 *   - the reader's model of Victor       mentalModel(p, "victor", READER)
 *   - Victor's model of the creature     mentalModel(p, "creature", "victor")
 *   - the mental model of an interlocutor in a chat, where `of` is the
 *     person on the other side and `from` is this reading.
 *
 * `confidence` is deliberately absent. What is reported is COUNTED
 * EVIDENCE — how many claims, relayed through which chain, at which seqs —
 * because a number between 0 and 1 here would be a summary nobody measured
 * (P4: numbers are declared; gaps are results).
 */
export function mentalModel(projected, of, from = READER) {
  const perspective = projected?.perspectives?.[from];
  if (!perspective) {
    return freeze({ schema: "EOMentalModel@1", of, from, attributed: freeze([]), count: 0, gap: freeze({ type: "unknown_holder", detail: `${from} holds nothing in this projection — a model of someone requires a modeller who was recorded` }) });
  }
  const attributed = perspective.beliefs
    .filter((b) => b.via.includes(of) || (b.basis === BASIS.REPORTED && b.via[b.via.length - 1] === of))
    .map((b) => freeze({ claim: b.claim, stance: b.stance, via: b.via, relayDepth: b.via.length, atSeq: b.lastSeq, witness: b.witness }));
  const direct = (projected?.perspectives?.[of]?.beliefs ?? []).length;
  return freeze({
    schema: "EOMentalModel@1",
    of,
    from,
    attributed: freeze(attributed),
    count: attributed.length,
    // The honest disclosure a mental model must carry: how much of what
    // this holder actually holds is modelled here at all.
    ofHoldsInTotal: direct,
    coverage: direct === 0 ? null : Number((attributed.length / direct).toFixed(3)),
    gap: attributed.length === 0
      ? freeze({ type: "no_attributed_beliefs", detail: `${from} has recorded no beliefs relayed via ${of} — nothing was attributed, which is different from ${of} holding nothing` })
      : null,
  });
}

/**
 * Land a perspective act on the log — the caller's, so that the operators
 * stay honest: opening a holder is DEF, holding a claim is EVA, conceding
 * one is REC, and every one of them lands in Lens because that is the cell
 * the algebra already gives Interpretation × Figure.
 */
export function perspectiveOperation({ holder, claim, stance = STANCE.HOLDS, basis = null, via = [], witness = null, operator = null }) {
  if (typeof holder !== "string" || !holder) throw new TypeError("perspectiveOperation: a belief is held by someone named — an unattributed belief is the thing this module refuses");
  const op = operator ?? (stance === STANCE.CONCEDED ? "REC" : claim == null ? "DEF" : "EVA");
  const cell = cellOf(op, "Figure");
  if (cell.gap) throw new TypeError(cell.reason);
  if (cell.terrain !== "Lens") throw new TypeError(`perspectiveOperation: ${op} at Figure lands in ${cell.terrain}, not Lens — a perspective act is Interpretation-domain`);
  return freeze({
    schema: "EOOperation@1",
    id: claim == null ? `lens:${holder}` : `lens:${holder}:${claim}`,
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence: null,
    inputs: freeze([]),
    outputs: freeze([]),
    payload: freeze({ holder, claim, stance, basis, via: freeze([...via]) }),
  });
}
