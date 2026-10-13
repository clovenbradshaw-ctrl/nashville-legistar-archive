// fold-chat-cube.js — THE CUBE, WOVEN INTO THE AGENTIC TURN. Two of the chat's
// own judgment organs, made callable by the folds pipeline (fold-chat-folds.js):
//
//   1. PLACEMENT (cellOf). The pipeline's log already tags each act with an
//      operator (NUL SIG DEF SEG CON SYN EVA REC) and climbs a rung
//      (grain → terrain → domain). Those were glyphs over loose rungs. Here the
//      rung IS a cube grain (Ground · Figure · Pattern) and the operator IS a
//      mode × domain, so every act lands on one of the 27 coherent cells — the
//      same algebra the block kit validates against (fold-blocks.js).
//
//   2. THE GATE (routeTurn / gateTurn). Before any draw, the turn is typed by
//      the constitution's own router (vendor/fold/reasoning-stages.mjs `route`,
//      the FOLD-CONSTITUTION.md:77 algorithm): a question that cannot be stated
//      is a wall; a given is received; a barred turn is refused; a grounded turn
//      narrates only its spans; a mechanical turn is computed; what remains is
//      shown. The mouth never reasons past its lane (II.9).
//
//   3. RECURSION (runSpiral). The turn's loop-back edges, bounded by fuel: a step
//      may re-open an earlier rung with a refined atom (the ant's spiral), and
//      the driver records the chain — so a weave that does not hold can re-open
//      the whole turn instead of stopping.
//
// PURE (the gate's `route` is pure; `runSpiral` is pure w.r.t. its injected
// `step`; no DOM, no IO, no model). Falsifying control: a rung that is not a
// grain must be a typed gap (never a silent cell); a gate that routes a barred
// turn anywhere other than `refuse` concedes the router; a spiral that exceeds
// its fuel must stop, not run.

import { OPS } from "./fold-blocks.js";
import { GRAINS, cellOf as cubeCellOf } from "./vendor/khora/native/kernel/cube.js";
import { route as constitutionRoute } from "./vendor/fold/reasoning-stages.mjs";

/** The pipeline's climbing rungs, in order. */
export const RUNGS = Object.freeze(["grain", "terrain", "domain"]);
/** A rung names a GRAIN of the cube: the ask's words are Ground, the ask in its
 *  want is Figure, the kind of thing it is is Pattern. 0 / n / 1. */
export const RUNG_GRAIN = Object.freeze({ grain: "Ground", terrain: "Figure", domain: "Pattern" });

/** cellOf(op, rungOrGrain) — the cube cell an act lands on. `rungOrGrain` is a
 *  pipeline rung (grain|terrain|domain) or a grain name (Ground|Figure|Pattern).
 *  Unknown operator or rung is a TYPED GAP, never a silent cell. */
export function cellOf(op, rungOrGrain) {
  if (!OPS.includes(op)) return Object.freeze({ gap: "unknown_op", reason: `no such operator: ${op}`, known: OPS });
  const grain = RUNG_GRAIN[rungOrGrain] || (GRAINS.includes(rungOrGrain) ? rungOrGrain : null);
  if (!grain) return Object.freeze({ gap: "unknown_rung", reason: `no such rung: ${rungOrGrain}`, known: RUNGS });
  const c = cubeCellOf(op, grain);
  if (c.gap) return c;
  return Object.freeze({ ...c, rung: RUNGS.includes(rungOrGrain) ? rungOrGrain : null });
}

/** One line naming the cell of an act: mode · terrain · stance (grain is the
 *  axis both share, so it is not repeated). A gap prints its own reason. */
export function cellLine(cell) {
  if (!cell || cell.gap) return cell?.reason ? `gap · ${cell.reason}` : "";
  return `${cell.mode} · ${cell.terrain} · ${cell.stance}`;
}

/** routeTurn(turn) — the constitution's router, untouched. `turn` is
 *  { statable?, given?, refused?, grounded?, mechanical? }; the lane is
 *  refuse | received | refused | grounded | mechanical | shown. */
export function routeTurn(turn = {}) { return constitutionRoute(turn); }

/** gateTurn({ text, build, hasMaterial, satisfiable, given, refused }) — route
 *  the agentic turn by what the pipeline knows before it draws. `build` is a
 *  make-ask (the field computes it) → mechanical; `hasMaterial` is read
 *  passages → grounded; `given` is a prior the person supplied → received; a
 *  turn that cannot be stated → refuse. Order is the constitution's, so
 *  grounded outranks mechanical (narrate the material, do not re-generate it). */
export function gateTurn({ text = "", build = false, hasMaterial = false, satisfiable = true, given = null, refused = false } = {}) {
  return constitutionRoute({
    statable: satisfiable,
    given,
    refused,
    grounded: hasMaterial ? String(text) : null,
    mechanical: build ? String(text) : null,
  });
}

/** runSpiral({ atom, grain, fuel, step }) — the bounded recursion. `step(cur, i)`
 *  is injected (may be async) and returns { acts?, recurse?, done? }; `recurse`
 *  is { atom?, grain?, reason? } — re-open at that rung with that atom. The
 *  driver never runs past `fuel` steps, catches a throwing step (an act, not a
 *  crash), and returns { acts, trace, fuel } with the chain it took. Pure w.r.t.
 *  `step`: the same step and seed give the same acts and trace. */
export async function runSpiral({ atom = null, grain = "grain", fuel = 6, step } = {}) {
  if (typeof step !== "function") throw new TypeError("runSpiral requires a step function");
  const acts = [];
  const trace = [];
  let cur = { atom, grain };
  for (let i = 0; i < fuel; i += 1) {
    let r;
    try { r = await step(cur, i); }
    catch (e) {
      acts.push({ kind: "note", op: "REC", ok: false, errors: [{ code: "step", msg: String((e && e.message) || e) }] });
      trace.push({ i, stop: "error" });
      break;
    }
    for (const a of (r && r.acts) || []) acts.push(a);
    const back = r && r.recurse;
    if (!back) { trace.push({ i, stop: r && r.done ? "done" : "no-recurse" }); break; }
    trace.push({ i, recurse: back.reason || "re-open", from: cur.grain, to: back.grain || cur.grain });
    cur = { atom: back.atom != null ? back.atom : cur.atom, grain: back.grain || cur.grain };
    if (i === fuel - 1) trace.push({ i: fuel, stop: "fuel" });
  }
  return { acts, trace, fuel };
}

export default { RUNGS, RUNG_GRAIN, cellOf, cellLine, routeTurn, gateTurn, runSpiral };
