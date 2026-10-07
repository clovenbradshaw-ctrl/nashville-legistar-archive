// thea.js — the remedy archon.
// Handle: Thea — the Titaness of sight: clear seeing turned into remedy.
// Amendment XVII (proposed).
//
// Apollo (apollo.js) finds surprise; an eoSwarm investigates; Thea crafts the
// remedy. PURE: maps (finding + swarm report) -> ordered remedy actions drawn
// ONLY from Heimdall's own homeostatic vocabulary — pace / defer / escalate /
// downgrade / re-forge / quarantine-caller — plus a disclose note. Thea never
// executes; the caller (proxy/heimdall) does.

export const THEA_ACTIONS = Object.freeze([
  "pace", "defer", "downgrade", "escalate", "re-forge", "quarantine-caller", "observe",
]);

export const THEA_REFUSALS = Object.freeze({
  no_finding: "no Apollo finding was offered — Thea remedies a witnessed surprise, never a mood",
  no_report: "no swarm report was offered — remedy without investigation is a guess",
});

/**
 * craftRemedy({ finding, report }) — deterministic remedy composer.
 * report = { ants, best } from eoSwarm dispatch (apollo-swarm.js): best.ids
 * names the leading hypothesis (e.g. "throttle-caller", "failover-model").
 * Returns { actions: [{ act, reason }], disclose }.
 */
export function craftRemedy({ finding, report } = {}) {
  if (!finding) return { refused: "no_finding" };
  if (!report) return { refused: "no_report" };
  const hyp = report?.best?.ids ?? [];
  const has = (...names) => names.some((n) => hyp.includes(n));
  const actions = [];
  const push = (act, reason) => { if (THEA_ACTIONS.includes(act)) actions.push({ act, reason }); };

  if (finding.kind === "runaway") {
    if (finding.channel === "genTokens") { push("defer", "runaway generation: hold new turns until the box recovers"); push("downgrade", "drop to a cheaper mind while generation is unbounded"); }
    else if (finding.channel === "apiCalls") { push("quarantine-caller", "wild outbound calls: ration the offending requestor first"); push("pace", "pace the remaining flow"); }
    else { push("defer", `runaway on ${finding.channel}: defer before breakdown`); }
    if (has("failover-model")) push("escalate", "swarm confirms a failing path: fail over to the next measured path");
    if (has("re-forge-cache")) push("re-forge", "swarm confirms a stale choice-cache entry: re-forge it");
  } else if (finding.kind === "alarm") {
    if (finding.channel === "turnMs" || finding.channel === "cpuIdle") { push("pace", "sustained saturation: pace and queue batch behind interactive"); push("defer", "defer batch work first"); }
    else if (finding.channel === "refusals") { push("downgrade", "refusal storm: serve what this box proves it can serve"); }
    else if (finding.channel === "apiCalls") { push("pace", "API surge: pace the flow"); if (has("throttle-caller")) push("quarantine-caller", "swarm traces the surge to one caller"); }
    else { push("observe", `alarm on ${finding.channel}: keep watching under hysteresis`); }
    if (has("failover-model")) push("escalate", "swarm confirms path failure: escalate to the next path");
  } else {
    push("observe", `kind ${finding.kind} is not dispatch-grade: watch, do not act`);
  }

  const disclose = `Thea: ${finding.kind} on ${finding.channel} (z=${Number(finding.z ?? 0).toFixed(2)}) → ${actions.map((a) => a.act).join(", ") || "observe"}; hypotheses examined: ${hyp.join("+") || "none"}`;
  return Object.freeze({ actions: Object.freeze(actions), disclose, giver: "thea", standing: "proposed" });
}
