// precision-race.js — the mechanical pipeline runs beside the mouth; a
// conclusion wins on precision (Friston), a gap never does.
//
// User direction, 2026-09-16: "lets have response go as normal, and this is
// a pipeline that runs on its own, and if it comes to a conclusion it can
// win. friston". The model's draft is a PREDICTION. A mechanism that settles
// the question — an exhaustive check, a computed value — is an OBSERVATION.
// The posterior follows precision: a settled observation is precise by
// construction (every case tried, or computed by an engine), so it wins; a
// mechanism that claims the question but cannot settle it (a typed gap)
// carries no precision, and the prediction stands. There is no numeric
// precision here to tune — precision is structural: settled or not.
//
// A win keeps the loser: the model's draft rides the result as `superseded`,
// so nothing the mouth said is erased from the record, only outweighed.
//
// Pure and medium-blind. Mechanisms are injected: `{ name, run(task, ctx) }`,
// each returning null (not its question), `{ concluded: true, kind, text }`,
// or `{ concluded: false, gap }`. No mechanism here knows about puzzles,
// arithmetic or language.
//
// THE FOUR CORNERS ARE hl.js's, NOT A SECOND LATTICE (Nagarjuna, 2026-09-16:
// "get this all aligned"). A mechanical conclusion has exactly the shape
// Belnap–Dunn FDE already gives a verdict in this codebase — is / is-not /
// both / neither — and `native/interpretation/hl.js` already carries that
// lattice, named and tested, with a real involution (`flip`). Reinventing
// SETTLED/CONTRADICTION/UNDERDETERMINED here would have been a second
// implementation of one fact, the exact drift class this repo's own
// postmortems keep naming (the operator-order divergence, the two-runtime-
// type ternary). So this module imports hl's names outright:
//   BOUND        one value determined — the tetralemma's "is".
//   CONTRADICTED every candidate tried refutes it — "is not".
//   CONTESTED    more than one candidate holds — "both", Belnap's own
//                fourth value, not an error state.
//   UNBOUND      nothing here decides it either way — "neither" — a
//                puzzle with no candidates evaluable, not (yet) a failure.
//   BEYOND_REACH hl.js's own fifth state, "genuine inexpressibility outside
//                that lattice" — used here for the MECHANISM's own limit
//                (an engine it needs is missing), never a fact about the
//                question. This is the module's `gap`, given hl's name.
import { BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH, flip } from "../interpretation/hl.js";

export const CONCLUSION = Object.freeze({ BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH });
export { flip };

/** Runs every mechanism on the task; the first that reaches BOUND,
 * CONTRADICTED or CONTESTED is the observation. A mechanism that recognizes
 * the question but names why it cannot compute an answer (a gap — its
 * engine is missing, its search bailed) is a finding, not a verdict: the
 * gap is collected and disclosed, and the prediction stands — the header
 * law, "a gap never does [win]" (Friston: precision is structural, settled
 * or not, and a gap is not settled). A mechanism that throws is a gap too,
 * and the rest still run. Only when NO mechanism claimed the question at
 * all — zero concludes, zero gaps — does the observation carry nothing but
 * the empty gaps list. */
export async function runMechanical(task, mechanisms = [], ctx = {}) {
  const gaps = [];
  for (const m of mechanisms) {
    let out;
    try {
      out = await m.run(task, ctx);
    } catch (err) {
      gaps.push({ mechanism: m.name, gap: `threw: ${err?.message ?? err}` });
      continue;
    }
    if (!out) continue;
    if (out.concluded) return { concluded: true, mechanism: m.name, kind: out.kind, text: out.text, detail: out.detail ?? null, gaps };
    gaps.push({ mechanism: m.name, gap: out.gap ?? "claimed but did not settle" });
  }
  if (gaps.length) {
    return {
      concluded: false,
      mechanism: null,
      kind: BEYOND_REACH,
      text: null,
      detail: { gaps },
      gaps,
    };
  }
  return { concluded: false, mechanism: null, kind: null, text: null, detail: null, gaps };
}

/** The precision-weighted choice between the mouth's prediction and the
 * mechanical observation. A SETTLED observation — BOUND, CONTRADICTED, or
 * CONTESTED — outweighs the model's draft (it carries structural precision).
 * A BEYOND_REACH gap is NOT settled: it never wins the race; it rides the
 * observation as disclosure, and the prediction stands with the gap named. */
export function precisionWinner({ observation, draft }) {
  if (observation?.concluded && observation?.kind !== BEYOND_REACH) {
    return {
      winner: "mechanical",
      text: observation.text,
      superseded: draft ?? null,
      basis: `${observation.mechanism} reached ${observation.kind} — an observation outweighs a prediction`,
      observation,
    };
  }
  const gaps = observation?.gaps?.length ? ` (disclosed gaps: ${observation.gaps.map((g) => `${g.mechanism}: ${g.gap}`).join("; ")})` : "";
  return {
    winner: "model",
    text: draft ?? "",
    superseded: null,
    basis: `no mechanism settled this question — the prediction stands${gaps}`,
    observation: observation ?? null,
  };
}
