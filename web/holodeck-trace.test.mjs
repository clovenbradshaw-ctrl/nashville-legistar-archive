// holodeck-trace.test.mjs — Milestone 7, the-fold side.
//
// The reading/research surface renders the situated view over a FoldTrace@1:
// whose account exists and whose does not, invitations, refusals,
// consequences, plan revisions and completions. Leaving alone is a completed
// disposition (never a failure badge); absent perspectives are rendered as
// ABSENT, never populated with invented first-person testimony.

import test from "node:test";
import assert from "node:assert/strict";
import { renderSituatedView, renderCompletionBanner } from "./holodeck-trace.js";

function traceFixture({ leftAlone = false } = {}) {
  const entries = [];
  let prev = "genesis";
  const entry = (schema, record) => entries.push({ seq: entries.length, prevHash: prev, schema, record });
  entry("Encounter@1", {
    schema: "Encounter@1", version: 1, encounter_id: "enc-1", time: "2026-10-04T12:00:00Z",
    observer: "the-fold", purpose_id: "p-1", medium: "text", source_refs: ["perm:a"],
    participants: [
      { kind: "observed", identity: "p1", evidence: ["seen"], scope: ["this encounter"] },
      { kind: "withheld", evidence: ["declined"], scope: ["this encounter"] },
    ],
    context: "a meeting", observation_method: "direct", disclosure_scope: ["cited-material"],
  });
  entry("SituatedTransition@1", { schema: "SituatedTransition@1", version: 1, proposed_change: "invite_voluntary_input", affected_bearers: [{ bearer: "p1" }] });
  entry("Response@1", { schema: "Response@1", version: 1, responder: "p1", encounter_id: "enc-1", offered_response: "x", actual_response: "declined", source_address: "perm:a", disclosure_limits: [], refusal: true });
  entry("Consequence@1", { schema: "Consequence@1", version: 1, encounter_id: "enc-1", observed_changes: ["nothing further"], unresolved_effects: [], unexpected_affected: ["p2"] });
  entry("Completion@1", { schema: "Completion@1", version: 1, completion_state: leftAlone ? "left_alone" : "failed", task_id: "t", checks: [], unresolved_consequences: [] });
  return { schema: "FoldTrace@1", version: 1, purpose: "answer", sessionId: "s1", entries, prev };
}

test("the surface shows whose account exists and whose does not", () => {
  const view = renderSituatedView(traceFixture());
  const p1 = view.participants.find((p) => p.bearer === "p1");
  assert.ok(p1, "p1 is a participant");
  assert.equal(p1.account, "present");
  assert.ok(view.participants.some((p) => p.kind === "withheld" && p.account === "absent"), "a withheld participant is absent");
});

test("refusals, consequences and revisions are exposed as events", () => {
  const view = renderSituatedView(traceFixture());
  assert.ok(view.refusals.some((r) => r.bearer === "p1"), "the refusal is shown");
  assert.ok(view.consequences.some((c) => c.unexpected.includes("p2")), "the new affected party is shown");
});

test("an absent perspective is never populated with invented first-person testimony", () => {
  const view = renderSituatedView(traceFixture());
  assert.equal(view.inventedTestimony, false);
  assert.deepEqual(view.absentPerspectives, ["a withheld participant"], "the absent perspective is named as absent, not filled in");
  assert.ok(!view.participants.some((p) => p.kind === "withheld" && p.account === "present"), "no invented first-person account for the withheld party");
});

test("leave alone is a completed disposition, never a failure badge", () => {
  const ok = renderSituatedView(traceFixture({ leftAlone: true }));
  const completion = ok.completions[ok.completions.length - 1];
  assert.equal(completion.isLeaveAlone, true);
  assert.equal(completion.isFailure, false);
  assert.match(renderCompletionBanner(ok), /completed disposition/);
});

test("a failed completion shows a blocked banner, not a total completion claim", () => {
  const failed = renderSituatedView(traceFixture({ leftAlone: false }));
  assert.match(renderCompletionBanner(failed), /blocked|could not be completed/);
});