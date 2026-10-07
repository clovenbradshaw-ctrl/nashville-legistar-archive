// adapters/text/grain-typing.js — the connector-typing logic that types the
// GFP cell of an arrangement from its connector's settled part of speech.
// Promoted from eval/lavar/grain-typing.mjs (2026-09-16) so the PRODUCTION
// reading path can type cells with the identical logic the LaVar/EOT reader
// uses — one implementation, never a second copy that can drift.
//
// Pure factory: makeGrainTyper(posPrior) closes over one received POS
// prior (the caller's own choice) and returns {thraxOf, grainOf} bound to
// it. Nothing here decides WHICH prior; every caller states its own.
//
// GRAIN, NOT ERROR — the correction this typing exists to encode. A
// connector's settled part of speech types the observation's grain
// instead of gating its admission:
//   verb / participle  -> CON · Figure   (Link, Binding)   a discrete act
//   preposition        -> CON · Ground   (Field, Tending)  a state, a co-presence
//   conjunction        -> SEG · Figure   (Link, Dissecting) a distinction drawn
//   anything else, or unsettled -> grain gap, kept, never discarded
import { classifyWord, dominantClass } from "./wordclass.js";
import * as cube from "../../kernel/cube.js";

// THE ONE VERB-SHARE THRESHOLD (Chomsky, 2026-09-20 — the language-
// universality archon): every (VERB+AUX)-share gate in the reading stack
// reads THIS constant — the adapter layer's definition, imported by
// recursive.js's received-prior tier and by hypergraph.js's vocabulary
// gate. It used to be spelled `> 0.5` here, `>= 0.5` there and
// `>= GRAMMAR_MIN_SHARE` elsewhere — three spellings of one number, the
// drift class this project's postmortems keep naming (P22/P24).
// "the production sidecar recipe's own value, matched not chosen"
export const GRAMMAR_MIN_SHARE = 0.5;

export const GRAIN_BY_THRAX = Object.freeze({
  verb: { op: "CON", grain: "Figure" },
  participle: { op: "CON", grain: "Figure" },
  preposition: { op: "CON", grain: "Ground" },
  conjunction: { op: "SEG", grain: "Figure" },
});

export function makeGrainTyper(posPrior) {
  const thraxOf = (label) => {
    const head = String(label ?? "").trim().split(/\s+/).pop()?.toLowerCase();
    if (!head) return null;
    return dominantClass(classifyWord(head, { posPrior }), { minShare: GRAMMAR_MIN_SHARE })?.thraxClass ?? null;
  };
  const grainOf = (label) => {
    const thrax = thraxOf(label);
    const spec = thrax ? GRAIN_BY_THRAX[thrax] : null;
    if (!spec) {
      if (thrax) return { refused: true, settledAs: thrax };
      return {
        grain_gap: `connector does not settle in the received prior (Universal Dependencies has no Thrax-tradition category for it, e.g. the infinitive marker "to" is PART) — kept, not discarded`,
        settledAs: null,
      };
    }
    const cell = cube.cellOf(spec.op, spec.grain);
    return { operator: spec.op, grain: spec.grain, terrain: cell.terrain, stance: cell.stance, settledAs: thrax };
  };
  return { thraxOf, grainOf };
}

/** Map a grainOf() result to the cube cell's label — the same "CON·Ground
 * (Field) / CON·Figure (Link) / SEG·Figure (Distinction)" naming every GFP
 * record carries. A refused or unsettled connector returns the typed gap
 * marker verbatim (kept, never guessed). */
export function cellLabelOf(grain) {
  if (!grain || grain.grain_gap) return "grain_gap";
  const op = grain.operator ?? grain.op;
  if (op === "CON" && grain.grain === "Ground") return "CON·Ground (Field)";
  if (op === "CON" && grain.grain === "Figure") return "CON·Figure (Link)";
  if (op === "SEG" && grain.grain === "Figure") return "SEG·Figure (Distinction)";
  return "grain_gap";
}

/**
 * ablationPressureFor(grain, connector, sentenceTokens, connectorIdx, opts)
 *   -> Promise<grain | pressureResult>
 *
 * OPT-IN, ASYNC, PASS-THROUGH. Every other export in this file is pure and
 * synchronous, on purpose — nothing above touches a model or the network.
 * This is the one exception, called out explicitly rather than hidden —
 * but it makes NO model call itself and imports nothing from
 * ablation-grain-pressure.js: `ablationPressure` arrives INJECTED (the
 * cast.js/morphology.js pattern this codebase already holds — a pure
 * adapter never reaches into a frozen provider on its own), so a caller
 * supplies whichever embedding-backed function it wants, already bound to
 * its own model choice. This activates ONLY when `grain` is already a
 * grain_gap. A settled grain (or a refused one) is returned completely
 * UNCHANGED — this never second-guesses real evidence from the received
 * prior. A caller that never passes `ablationPressure`/`centroidSets`, or
 * never calls this function at all, sees byte-identical behavior to
 * before it existed.
 *
 * The result on a real gap is ablation-grain-pressure.js's own typed,
 * REVISABLE pressure object (`{grain_gap:true, basis:"ablation-delta",
 * revisable:true, votes, combined}`) — never a settled classification, and
 * never something this file merges back into `.operator`/`.grain`/`.terrain`
 * itself. A caller decides whether and how to weigh it against everything
 * else it knows, at whatever holonic level is appropriate to that caller.
 */
export async function ablationPressureFor(grain, connector, sentenceTokens, connectorIdx, { ablationPressure, embed, centroidSets } = {}) {
  if (!grain || !grain.grain_gap) return grain; // settled or refused: untouched, always
  if (typeof ablationPressure !== "function" || typeof embed !== "function" || !centroidSets?.length) return grain; // no injected mechanism: the gap stays a gap, exactly as before
  return ablationPressure(connector, sentenceTokens, connectorIdx, { embed, centroidSets });
}