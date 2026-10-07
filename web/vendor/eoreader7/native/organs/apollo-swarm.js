// apollo-swarm.js — the self-healing dispatch: Apollo → eoSwarm → Thea.
// Server-side bridge (imports eo-swarm + organs; NOT in the browser seam).
// When Apollo's surpriseOf() is non-null, dispatch(finding) breeds remedy
// hypotheses as ants through Wilson's own gate (eoSwarm) and hands the
// result to Thea for a remedy. Hypotheses are fixed strings; fitness is the
// caller's own restoration score — this file hand-sets no threshold.

import { eoSwarm } from "../eval/lavar/eo-swarm.mjs";
import { craftRemedy } from "./thea.js";
import { surpriseOf } from "./apollo.js";

export const REMEDY_HYPOTHESES = Object.freeze([
  "throttle-caller", "failover-model", "re-forge-cache", "defer-batch", "downgrade-mind",
]);

/**
 * dispatch(finding, { fitness, bar }) — run one self-healing round.
 * fitness(ids) REQUIRED: caller's restoration score for a hypothesis set.
 * bar REQUIRED: caller's measured elenchus bar. Returns null when the
 * finding is not dispatch-grade, else { swarm, remedy }.
 */
export function dispatch(finding, { fitness, bar } = {}) {
  const surprise = surpriseOf(finding);
  if (!surprise) return null;
  if (typeof fitness !== "function") throw new Error("apollo-swarm.dispatch: fitness(ids) is required");
  if (!Number.isFinite(bar)) throw new Error("apollo-swarm.dispatch: bar is required");
  const ants = REMEDY_HYPOTHESES.map((h, i) => ({
    id: h, ids: [h],
    op: ["SEG", "CON", "DEF", "EVA", "REC"][i % 5], grain: "Figure",
  }));
  const swarm = eoSwarm({
    ants, fitness, bar,
    terrainOf: () => [surprise.channel],
    legal: () => true,
  });
  const remedy = craftRemedy({ finding: surprise, report: swarm });
  return { swarm, remedy, finding: surprise };
}
