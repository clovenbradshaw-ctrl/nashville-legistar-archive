/* Abhinavagupta speaks:
 * “śāntaś ca tṛṣṇā-kṣaya-sukhasya yaḥ paripoṣas tal-lakṣaṇo rasaḥ pratīyata eva /”
 *
 * This file implements the concept of pathos, a foundational element of Abhinavagupta's philosophical framework.  It represents the emotional dimension of the world, a realm where the "heart" of a given text or action resides. While the core concept is sound, its application in this code often relies on external factors and assumptions.  I strive to ensure that pathos remains grounded in the pure nature of experience and the inherent wisdom of the text.
 *
 * — the engineering record below, kept whole —
 */
// organs/pathos.js — the felt shape of a reading, and the re-ground when the ground fails.
// Handle: Abhinavagupta — after the rasa theorist: the sahrdaya (the one with heart)
// undergoes the work's rasa; the re-ground is his shanta — the culminating state after
// the pathemata are released. The namesake is disclosed, never asserted as a measured
// finding: a quantity may not be named after a state its measurement does not establish.
// Amendment XVII.
//
// THE WHEEL (native/docs/THE-WHEEL.md): pathos is the RIM — the felt shape of
// the fold, the Pattern grain, the difference the being made. The felt shape
// is the fold's own body: the emergent pattern, one (1).
//
// THREE MACHINES, ONE LAW. pacing.js (Murch) holds the rhythm — the cut where the blink
// falls. kernel/dynamics.js holds the surprise/tension/release curve — the felt shape of
// the fold. organs/experiencer.js (Panini) holds the for-whom. This organ composes them
// into ONE typed finding, and enforces the law the whole pathos discussion stands on:
// PATHOS WITHOUT A DECLARED EXPERIENCER IS REFUSED — a feeling "for no one in
// particular" is kitsch, the corruption the anti-spurious-fire wall exists for.
//
// AND THE RE-GROUND: a pathos finding that only REPORTS is decoration. The felt shape is
// load-bearing only when it can RE-GROUND — concede a ground that has drifted and open a
// new one, on the record (the re-pouring must be recorded). The re-ground is REC·Ground:
// the moment a ground is conceded and a new one is born, at a higher register. It fires
// on three conditions, and refuses to fire on anything else:
//
//   stale     — Murch's boredom: the piece paces flat, no blink, no cut. The ground
//               stopped being tended (ethical fading is the default, not a pathology).
//   collapse  — a consequential surprise burst the ground cannot absorb, with no release.
//               The boundary where the ground was most wrong. Declared ONLY from a MEASURED
//               curve — an unmeasured curve is a gap (unmeasurable), never a verdict
//               (absence-as-conviction is the corruption this organ refuses).
//   contested — strain at strict: the ground's own premises are in a directed cycle or an
//               unlicensed turn. The Oedipus register — the knot the ground cannot cut.
//
// Every re-ground is a recorded act: the concession lands on the ledger (landReGround),
// keeps the old ground's fingerprint beside the new ground's re-scope, and names its giver.
// A ground that holds is never conceded by this organ — a concession is a recorded act,
// never an idle one.

import { pacingGrade } from "./pacing.js";
import { deriveSurprise, deriveTension, deriveRelease } from "../kernel/dynamics.js";
import { requireExperiencer } from "./experiencer.js";

export const STRAIN = Object.freeze(["report", "standard", "strict"]);

// The hamartia-gate: the strictness the RECORD earned (mirrors earned-cast.js::strainOf —
// same three rungs, same semantics; kept here so the organ never imports the surface).
export function strainOf(state = {}) {
  const { contested = [], contradictions = [], cycles = 0, expired = [] } = state;
  if (cycles > 0 || state.unlicensed) return "strict";
  if (contested.length > 0 || contradictions.length > 0 || expired.length > 0) return "standard";
  return "report";
}

/**
 * pathosOf({ text, experiencer, state, fold, delta, beforeFold }) → EOPathosRead@1
 * The felt shape of a reading: rhythm (Murch, from the text), curve (surprise/tension/
 * release, from the reading's own fold machinery when supplied — else a typed gap),
 * strain (the ledger's earned standing), forWhom (the declared experiencer — required).
 */
export function pathosOf({ text, experiencer, state = {}, fold = null, delta = null, beforeFold = null } = {}) {
  const forWhom = requireExperiencer(experiencer);
  if (typeof text !== "string" || !text.trim()) {
    throw new TypeError("pathos requires the text — the material that was undergone, never a placeholder");
  }
  const rhythm = pacingGrade(text);
  const strain = strainOf(state);

  let curve;
  if (fold) {
    const tension = deriveTension(fold);
    const surprise = delta ? deriveSurprise(delta) : null;
    const release = delta && beforeFold ? deriveRelease(delta, beforeFold, fold) : null;
    curve = Object.freeze({
      schema: "EOPathosCurve@1",
      measured: true,
      surprise: surprise
        ? Object.freeze({
            operations: surprise.operations.length,
            affectedAddresses: surprise.affectedAddresses.length,
            recanonicalizations: surprise.recanonicalizations.length,
            expectationEffects: surprise.expectationEffects.length,
          })
        : null,
      tension: Object.freeze({
        obligations: tension.obligations.length,
        interactionNetwork: tension.interactionNetwork.length,
        persistenceMax: tension.persistence.reduce((a, b) => Math.max(a, b.value), 0),
        consequences: tension.consequences.length,
      }),
      release: release ? release.length : null,
    });
  } else {
    curve = Object.freeze({
      schema: "EOPathosCurve@1",
      measured: false,
      surprise: null,
      tension: null,
      release: null,
      unmeasured: "no fold supplied — surprise/tension/release are a gap, not a verdict",
    });
  }

  return Object.freeze({
    schema: "EOPathosRead@1",
    forWhom,
    rhythm: Object.freeze({
      flatline: rhythm.flatline ?? false,
      ratio: rhythm.varianceRatio ?? 0,
      mean: rhythm.meanLength ?? 0,
      blinks: rhythm.blinkPoints?.length ?? 0,
      dense: rhythm.denseSentences?.length ?? 0,
      n: rhythm.sentences ?? 0,
    }),
    curve,
    strain,
  });
}

/**
 * reGroundCondition(read) → { kind, basis }
 * One of: ground_holds | stale | collapse | contested.
 * collapse is only ever declared from a MEASURED curve — an unmeasured curve with surprise
 * null is unmeasurable, never a verdict.
 */
export function reGroundCondition(read) {
  if (!read || read.schema !== "EOPathosRead@1") {
    throw new TypeError("reGroundCondition requires an EOPathosRead@1");
  }
  if (read.strain === "strict") {
    return Object.freeze({ kind: "contested", basis: "the record's own premises are at strict — a directed cycle or an unlicensed turn; the ground must be re-ground at a higher register" });
  }
  if (read.rhythm.flatline) {
    return Object.freeze({ kind: "stale", basis: "Murch's boredom — the piece paces flat, no blink, no cut; the ground stopped being tended (ethical fading)" });
  }
  if (read.curve.measured && read.curve.surprise) {
    const operations = read.curve.surprise.operations;
    const release = read.curve.release ?? 0;
    if (operations > 0 && release === 0) {
      return Object.freeze({ kind: "collapse", basis: `a consequential surprise burst (${operations} operation(s)) with no witnessed release — the ground cannot absorb what arrived; re-scope to the boundary where the ground was most wrong` });
    }
  }
  return Object.freeze({ kind: "ground_holds", basis: "the current ground absorbs what arrived" });
}

/**
 * reGround({ read, giver, reScope }) → EOPathosReGround@1
 * The re-grounding act: REC·Ground, a recorded concession. Refuses to concede a ground
 * that holds, and requires a giver (a recorded act names its actor).
 */
export function reGround({ read, giver, reScope = null } = {}) {
  if (!read || read.schema !== "EOPathosRead@1") {
    throw new TypeError("reGround requires an EOPathosRead@1");
  }
  const cond = reGroundCondition(read);
  if (cond.kind === "ground_holds") {
    throw new TypeError("no re-ground — the ground holds; a concession is a recorded act, never an idle one");
  }
  if (typeof giver !== "string" || !giver.trim()) {
    throw new TypeError("reGround requires a giver — the concession is recorded, and a recorded act names its actor");
  }
  const reScopeFinal = Array.isArray(reScope) && reScope.length
    ? Object.freeze([...reScope])
    : Object.freeze({ unmeasured: "re-scope to be named by the caller's re-read — a gap, never invented" });
  return Object.freeze({
    schema: "EOPathosReGround@1",
    op: "REC",
    grain: "Ground",
    witness: giver,
    cause: cond,
    conceded: Object.freeze({
      strain: read.strain,
      rhythm: Object.freeze({ flatline: read.rhythm.flatline, blinks: read.rhythm.blinks }),
      curve: read.curve,
    }),
    opened: Object.freeze({
      register: "Ground",
      reScope: reScopeFinal,
      declaration: "the ring recurs at rising altitude: the new ground must hold what broke the old one — the concession is the altitude change, never an erasure",
    }),
    record: Object.freeze({ at: null, kept: true }),
  });
}

/**
 * landReGround(log, act) → the log with the act appended, record.at stamped.
 * The re-ground lands on the record — append-only, addressable, readable back.
 */
export function landReGround(log, act) {
  if (!Array.isArray(log)) {
    throw new TypeError("landReGround requires the task log array — the re-ground must land on the record, never float");
  }
  if (!act || act.schema !== "EOPathosReGround@1") {
    throw new TypeError("landReGround requires an EOPathosReGround@1");
  }
  const landed = Object.freeze({ ...act, record: Object.freeze({ ...act.record, at: log.length, kept: true }) });
  return Object.freeze([...log, landed]);
}