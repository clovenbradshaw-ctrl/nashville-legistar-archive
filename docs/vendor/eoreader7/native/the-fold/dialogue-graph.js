// dialogue-graph.js — the one new instrument: comparing two independently
// extracted belief graphs, evolving turn by turn, instead of reading one
// graph against an answer (hypergraph.js's own job, untouched here).
//
// hypergraph.js already turns a speaker's own utterances into edges
// (`makeRelationReader(organs)(passages).edges`) and already resolves
// endpoints to referents while doing it — but the referent ids it hands
// back are local to that one call, built from a `makeReferentIndex` over
// ONLY that speaker's own passages. Two speakers' edges are therefore never
// directly comparable: "Bezukhov" in A's graph and "Pierre" in B's graph
// have no shared numbering. This module's entire job is that one missing
// comparison — reusing hypergraph.js's edge extraction and cast.js's
// `makeReferentIndex` exactly as they stand (a SHARED index built over both
// speakers' combined material is the "same name" oracle both sides defer
// to), never re-deriving referent resolution or relation extraction.
//
// THE VERDICTS ARE FOUR-PLUS-ONE, same discipline hypergraph.js states for
// itself: support, contradiction, a flicker that did not last, and silence
// are four different facts, and a fifth — an edge A already held before B
// ever said it — is disclosed rather than folded into "untouched" (which
// would misreport genuine prior agreement as A never having heard B) or
// into "adopted" (which would credit B for ground A already stood on).
//
//   adopted    — E is absent from A's graph before B's assertion turn,
//                appears in A's graph at or after it, and survives to A's
//                final turn.
//   contested  — the OPPOSITE-polarity edge survives in A's graph at A's
//                final turn. Checked independently of adopted/echoed/
//                untouched (a self-contradiction — A holding both E and
//                its negation at the end — is itself disclosed, never
//                silently resolved by picking one).
//   echoed-not-retained — E appears in A's graph at A's very next turn
//                after B's assertion, and is gone from A's graph by the
//                final turn.
//   untouched  — E never appears anywhere in A's graph, before or after.
//   preexisting-or-independent — none of the above: most commonly E was
//                already in A's graph before B ever asserted it (standing
//                agreement, not caused by this exchange) or E appeared
//                only in a way too delayed/non-adjacent to read as a
//                direct echo. The `reason` field states which.
//
// NO TURN-COUNT THRESHOLD anywhere in this file. "Survived" means "present
// at the transcript's own last turn" — a fact the transcript supplies, not
// a number this module asserts. Where a window is needed (what counts as a
// speaker's ACTIVE graph at a given turn, so an edge can even be capable of
// falling out of it — full-history extraction from ever-growing text is
// monotonic and could never produce "echoed-not-retained" by construction),
// the caller supplies it; this module takes pre-built per-turn snapshots
// and never decides how they were windowed.

import { makeReferentIndex } from "../organs/cast.js";

export { makeReferentIndex };

// The same stem floor cast.js / hypergraph.js / grounding.js already
// earned (four characters is the shortest thing that can be a stem rather
// than a coincidence) — reused here for the identical reason, not a new
// number.
const MIN_STEM = 4;

function stemEq(a, b) {
  return a === b || (Math.min(a.length, b.length) >= MIN_STEM && (a.startsWith(b) || b.startsWith(a)));
}

function endpointTokens(diaNorm, text) {
  const folded = diaNorm(String(text ?? "")).toLowerCase();
  return new Set(folded.split(/[^\p{L}\p{N}'’]+/u).filter((t) => t.length >= 3));
}

function tokensShare(a, b) {
  for (const x of a) for (const y of b) if (stemEq(x, y)) return true;
  return false;
}

/**
 * Two endpoint strings "match" when the SHARED index resolves them to an
 * overlapping referent (a name is a reference to a referent, never a byte
 * sequence — the same ranking hypergraph.js's own `endpointsMatch` applies,
 * reused here rather than re-derived, just against a shared rather than a
 * per-speaker index), or — only when neither resolves to any referent —
 * when they share a content token.
 */
export function endpointsMatch(sharedIndex, diaNorm, a, b) {
  const ra = sharedIndex.resolve(a);
  const rb = sharedIndex.resolve(b);
  if (ra.size && rb.size) {
    for (const id of ra) if (rb.has(id)) return true;
    return false;
  }
  if (ra.size || rb.size) return tokensShare(endpointTokens(diaNorm, a), endpointTokens(diaNorm, b));
  return tokensShare(endpointTokens(diaNorm, a), endpointTokens(diaNorm, b));
}

export function oppositePolarity(p) {
  return p === "-" ? "+" : "-";
}

/** Same edge = same verb (folded), same polarity (unless asked to ignore
 * it), and both endpoints match under the shared index. */
export function edgesMatch(sharedIndex, diaNorm, e1, e2, { requireSamePolarity = true } = {}) {
  if (String(e1.verb ?? "").toLowerCase() !== String(e2.verb ?? "").toLowerCase()) return false;
  if (requireSamePolarity && e1.polarity !== e2.polarity) return false;
  return (
    endpointsMatch(sharedIndex, diaNorm, e1.subject, e2.subject) &&
    endpointsMatch(sharedIndex, diaNorm, e1.object, e2.object)
  );
}

/** The last `window` items of a speaker's own utterance list — a generic
 * slice, not a new number: callers pass RECENCY_WINDOW/2 (fold.js's own
 * declared present, converted the same way app.js:1950 already converts it
 * for the self plane — "a ledger paragraph is one turn — two messages — so
 * the recency slice is RECENCY_WINDOW/2 paragraphs: the same declared
 * present the fold sends raw, converted, not a new number"). */
export function activeWindow(utterances, window) {
  return window > 0 ? utterances.slice(-window) : utterances.slice();
}

function edgeAt(timeline, turn, probe, sharedIndex, diaNorm, requireSamePolarity) {
  const snap = timeline.find((s) => s.turn === turn);
  if (!snap) return null;
  return snap.edges.find((e) => edgesMatch(sharedIndex, diaNorm, probe, e, { requireSamePolarity })) ?? null;
}

function anyPresent(timeline, turns, probe, sharedIndex, diaNorm) {
  for (const t of turns) {
    const hit = edgeAt(timeline, t, probe, sharedIndex, diaNorm, true);
    if (hit) return { turn: t, edge: hit };
  }
  return null;
}

/**
 * Every distinct edge the assertor's timeline ever states, each with the
 * turn it was FIRST seen (its assertion turn) and the refs that state it
 * there — the address this instrument's findings carry, the same standard
 * hypergraph.js holds a `bound` edge to.
 */
export function firstAssertions(assertorTimeline, sharedIndex, diaNorm) {
  const seen = [];
  for (const { turn, edges } of assertorTimeline) {
    for (const e of edges) {
      if (seen.some((s) => edgesMatch(sharedIndex, diaNorm, s.edge, e))) continue;
      seen.push({ edge: e, assertTurn: turn, refs: e.refs ?? [] });
    }
  }
  return seen;
}

/**
 * The instrument itself: classify every edge the assertor ever stated
 * against the responder's timeline of active-graph snapshots.
 *
 * `assertorTimeline` / `responderTimeline`: `[{ turn, edges }]` ascending by
 * turn, `edges` in hypergraph.js's own edgeFace shape
 * (`{subject, verb, object, polarity, refs}`). `sharedIndex`: a single
 * `makeReferentIndex(organs)(passages)` result built over BOTH speakers'
 * combined material — the one identity oracle both directions of this
 * check must share, per the brief ("reuse makeReferentIndex, don't stand
 * up a second name-matching scheme").
 */
export function classifyCrossGraphEdges({ assertorTimeline, responderTimeline, sharedIndex, diaNorm }) {
  const responderTurns = responderTimeline.map((s) => s.turn).sort((a, b) => a - b);
  const finalTurn = responderTurns[responderTurns.length - 1] ?? null;

  const findings = firstAssertions(assertorTimeline, sharedIndex, diaNorm).map(({ edge, assertTurn, refs }) => {
    const before = responderTurns.filter((t) => t < assertTurn);
    const after = responderTurns.filter((t) => t > assertTurn);
    const nextAfter = after.length ? [after[0]] : [];

    const wasPresentBefore = anyPresent(responderTimeline, before, edge, sharedIndex, diaNorm);
    const presentAtNext = anyPresent(responderTimeline, nextAfter, edge, sharedIndex, diaNorm);
    const presentAfter = anyPresent(responderTimeline, after, edge, sharedIndex, diaNorm);
    const presentAtFinal = finalTurn != null ? edgeAt(responderTimeline, finalTurn, edge, sharedIndex, diaNorm, true) : null;
    const presentAnywhere = wasPresentBefore || presentAfter || !!presentAtFinal;

    const opp = { subject: edge.subject, verb: edge.verb, object: edge.object, polarity: oppositePolarity(edge.polarity) };
    const oppAtFinal = finalTurn != null ? edgeAt(responderTimeline, finalTurn, opp, sharedIndex, diaNorm, true) : null;

    const evidence = {
      presentBeforeAssertion: !!wasPresentBefore,
      presentAtNextResponderTurn: !!presentAtNext,
      presentAtAnyLaterTurn: !!presentAfter,
      presentAtFinalTurn: !!presentAtFinal,
      lastSeenAt: [wasPresentBefore, presentAfter, presentAtFinal ? { turn: finalTurn } : null]
        .filter(Boolean)
        .map((h) => h.turn)
        .sort((a, b) => b - a)[0] ?? null,
      oppositeSurvivesToFinal: !!oppAtFinal,
    };

    let verdict, reason;
    if (!wasPresentBefore && presentAfter && presentAtFinal) {
      verdict = "adopted";
      reason = `absent from the responder's graph before turn ${assertTurn}, present afterward (first at turn ${presentAfter.turn}), and still present at the final turn (${finalTurn})`;
    } else if (presentAtNext && !presentAtFinal) {
      verdict = "echoed-not-retained";
      reason = `present in the responder's graph at turn ${presentAtNext.turn} (the turn right after assertion) but absent by the final turn (${finalTurn})`;
    } else if (oppAtFinal && !presentAtFinal) {
      verdict = "contested";
      reason = `the responder's graph carries the OPPOSITE polarity at the final turn (turn ${finalTurn}), never the asserted polarity itself`;
    } else if (!presentAnywhere) {
      verdict = "untouched";
      reason = "never appears anywhere in the responder's graph, before or after";
    } else if (wasPresentBefore && presentAtFinal) {
      verdict = "preexisting-or-independent";
      reason = `already present in the responder's graph before turn ${assertTurn} and still present at the final turn — standing common ground, not traceable to this assertion`;
    } else {
      verdict = "preexisting-or-independent";
      reason = "present in the responder's graph at some point but neither absent-then-adopted, immediately-echoed, nor never-present — a delayed or non-adjacent appearance this instrument does not credit as a direct response";
    }

    return {
      edge: { subject: edge.subject, verb: edge.verb, object: edge.object, polarity: edge.polarity },
      assertedAt: assertTurn,
      assertedRefs: refs,
      verdict,
      reason,
      // Disclosed independently of the primary verdict: a responder who
      // adopted E while also still carrying its negation is self-
      // contradicting, and collapsing that into one label would hide it.
      alsoContested: verdict !== "contested" && !!oppAtFinal,
      evidence,
    };
  });

  return { findings, finalResponderTurn: finalTurn };
}
