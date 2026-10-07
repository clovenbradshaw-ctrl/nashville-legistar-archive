// holodeck-trace.js — the fold's end of the Milestone 7 trace.
//
// The surface exposes SITUATED ACCOUNTS: invitations, refusals, consequences
// and plan revisions, showing whose account exists and whose does not. It
// supports leaving alone without a failure badge, and showing useful progress
// without a total completion claim. It NEVER populates an absent-perspective
// panel with invented first-person testimony.
//
// This is the reading/research surface's renderer over a FoldTrace@1 (the
// artifact-neutral trace khora emits and penelope retains). It consumes the
// trace as JSON — it does not import khora.

export const TRACE_VIEW_SCHEMA = "TraceSituatedView@1";
export const TRACE_VIEW_VERSION = 1;

/**
 * renderSituatedView(trace) — the inspectable artifact: panels for
 * participants (whose account exists), refusals, consequences, plan revisions
 * and completions. An absent perspective is rendered as ABSENT — never filled
 * with invented first-person testimony.
 */
export function renderSituatedView(trace) {
  const participants = [];
  const refusals = [];
  const consequences = [];
  const revisions = [];
  const completions = [];
  const invitations = [];

  for (const row of trace?.entries ?? []) {
    const r = row?.record;
    if (row.schema === "Encounter@1") {
      for (const p of r?.participants ?? []) {
        if (p.kind === "observed") {
          participants.push({ bearer: p.identity ?? "observed", account: "present", kind: "observed" });
        } else if (p.kind === "withheld") {
          participants.push({ bearer: p.identity ?? "a withheld participant", account: "absent", kind: "withheld" });
        } else {
          participants.push({ bearer: p.identity ?? "an unresolved referent", account: "absent", kind: "unresolved" });
        }
      }
    }
    if (row.schema === "Response@1") {
      const refused = r?.refusal === true || String(r?.actual_response ?? "").toLowerCase() === "declined";
      if (refused) refusals.push({ bearer: r?.responder, detail: "declined a further inquiry" });
    }
    if (row.schema === "Consequence@1") {
      consequences.push({
        encounter_id: r?.encounter_id,
        observed: r?.observed_changes ?? [],
        unexpected: r?.unexpected_affected ?? [],
      });
    }
    if (row.schema === "PlanRevision@1") {
      revisions.push({ effect: r?.record?.effect_forecasts?.[0]?.effect ?? "revised the plan", giver: r?.record?.effect_forecasts?.[0]?.evidence?.[1] ?? "unknown" });
    }
    if (row.schema === "SituatedTransition@1" && r?.proposed_change === "invite_voluntary_input") {
      invitations.push({ bearer: r?.affected_bearers?.[0]?.bearer ?? "?" });
    }
    if (row.schema === "Completion@1") {
      const state = r?.completion_state ?? r?.record?.completion_state;
      completions.push({
        state,
        // Leaving alone is rendered as a completed disposition, never a
        // failure badge.
        isFailure: state === "failed",
        isLeaveAlone: state === "left_alone",
      });
    }
  }

  return {
    schema: TRACE_VIEW_SCHEMA,
    version: TRACE_VIEW_VERSION,
    sessionId: trace?.sessionId ?? null,
    purpose: trace?.purpose ?? null,
    participants,
    invitations,
    refusals,
    consequences,
    revisions,
    completions,
    // The honesty clause: panels whose account is absent are left empty.
    // Never invent first-person testimony for an absent participant.
    absentPerspectives: participants.filter((p) => p.account === "absent").map((p) => p.bearer),
    inventedTestimony: false,
  };
}

/**
 * renderCompletionBanner(view) — the surface's completion line. Leave-alone
 * shows useful progress WITHOUT a total completion claim.
 */
export function renderCompletionBanner(view) {
  const last = view?.completions?.[view.completions.length - 1];
  if (!last) return "in progress — no completion claimed";
  if (last.isLeaveAlone) return "left alone — a completed disposition; no further action taken";
  if (last.isFailure) return "blocked — the inquiry could not be completed";
  return "accomplished under the declared checks";
}

export const TRACE_VIEW = {
  schema: TRACE_VIEW_SCHEMA,
  version: TRACE_VIEW_VERSION,
  render: renderSituatedView,
  banner: renderCompletionBanner,
  describe: "show whose account exists and whose does not; leave alone without a failure badge; never populate an absent-perspective panel with invented first-person testimony",
};