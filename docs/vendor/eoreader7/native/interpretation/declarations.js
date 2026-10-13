// the legacy engine · engine/interpretation/declarations — an append-only register
// for hl.js declarations, with REC concession for the case hl.js's own
// persistence rule (R4) does not cover.
//
// THE GAP THIS CLOSES. R4 says positive/negative EDGE verdicts persist or
// revise correctly under stage extension. It says nothing about a
// DECLARATION (functional(r), transitive(r)) that later meets a
// counterexample. A caller who acquires declarations mechanically, at
// need — spun up from a corpus's own evidence rather than hand-authored —
// WILL sometimes acquire one that a later, larger stage refutes:
// unrefuted-functional(becomes) looks fine on 4 subjects and meets its
// counterexample on the 5th. Every R2 verdict that declaration produced
// in between was retroactively unfounded. Append-only means those get
// CONCEDED, never deleted — grid.js's own concedeEvaluation, pointed at
// declarations instead of build evaluations. Same verb (REC), same
// requirement (a named trigger, never a silent overwrite), same log
// discipline (holon/task-log.js), different object.
//
// TWO TIERS, NAMED SO THE STRENGTH OF A DECLARATION IS NEVER AMBIGUOUS:
//   - GIVEN     a human- or process-named giver (declareFunctional's own
//               `giver` argument). Licenses R2 conviction. Never spun up
//               automatically — hl.js's own requireGiver refuses it
//               otherwise.
//   - CANDIDATE unrefuted-at-this-stage, acquired mechanically (a
//               refutation search over real material found no
//               counterexample). Licenses a DISCLOSED FLAG, never a
//               conviction — this register's own `functionalCandidates`
//               reads are typed `candidate`, and nothing in hl.js's R2
//               will fire from a candidate alone (R2 checks
//               `stage.functional`, which only GIVEN declarations ever
//               populate — a caller must promote a candidate to given,
//               explicitly, with its own giver, before it can convict).
// This is the grain theorem applied to the declarations themselves:
// functional(r) is a Pattern-grain (∀-shaped) claim, refutable from a
// corpus but never earned from one — a candidate is `unrefuted@stage`,
// structurally, and stays that way no matter how much material
// accumulates, exactly as R5 already proves for open-domain ∀.

import { ENTRY_KINDS, OPERATOR_BASIS, createTaskLog, append } from "../kernel/task-log.js";

const nextEventId = (log) => `decl-${log.entries.length}`;

/** A fresh, empty declaration log — task-log.js's own primitive, admitting
 * only the two operators this register ever emits (DEF: the candidate/
 * given distinction is itself an interpretive claim about the relation;
 * REC: concession). Independent of any hl.js stage — declarations have
 * their own history, separate from the edges they govern (the
 * database-fold precedent: a different granularity gets its own log
 * rather than being forced through an unrelated one). */
export function createDeclarationLog() {
  return createTaskLog({ admits: ["DEF", "REC"] });
}

/** Propose a CANDIDATE declaration — mechanically acquired, unrefuted at
 * this stage, never yet given a name. `acquisition` is disclosed verbatim
 * (subject count, the refutation search that found nothing) so a later
 * reader can judge the acquisition, not just its conclusion. Named
 * `acquisition`, not `evidence` — task-log.js's own `evidence` field is
 * reserved vocabulary (accumulates FROM other entries; forced to an
 * array by `append`), and this is a caller-supplied payload, not that. */
export function proposeCandidate(log, { kind, rel, yields = null, acquisition, source }) {
  if (kind !== "functional" && kind !== "transitive" && kind !== "composes")
    throw new Error(`declarations: unknown kind "${kind}" — only functional/transitive/composes are acquirable candidates`);
  // A COMPOSES declaration is a claim about ONE relation plus a name for
  // its product ("`yields` is the closure of `rel`"), which is exactly
  // closureAffordances' own shape — so the register holds the claim and
  // reaction.js projects it into the four affordance rows, rather than the
  // chemistry living in a caller's local variable where nothing could ever
  // concede it. Without a product name there is no declaration: an unnamed
  // closure is the vacuous "these compose into something" the falsification
  // probe already refuted as content-free.
  if (kind === "composes" && !yields)
    throw new Error(`declarations: proposeCandidate(composes, ${rel}) requires \`yields\` — the relation the closure produces, which is the naming act the claim consists of`);
  if (!source) throw new Error(`declarations: proposeCandidate(${kind}, ${rel}) requires a source — where the search ran`);
  const id = nextEventId(log);
  return {
    id,
    log: append(log, {
      kind: ENTRY_KINDS.PROPOSE,
      task_id: id,
      description: `candidate ${kind}(${rel}): unrefuted at this stage`,
      operator: "DEF",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: "Pattern",
      declKind: kind,
      rel,
      ...(yields ? { yields } : {}),
      status: "candidate",
      acquisition,
      source,
    }),
  };
}

/** Promote a candidate to a GIVEN declaration — a human or a named
 * process vouches for it, explicitly, with its own giver. This is the
 * only route by which a declaration can license R2 conviction; nothing
 * here or in hl.js promotes automatically. */
export function promote(log, candidateTaskId, { giver }) {
  if (!giver || typeof giver !== "string")
    throw new Error("declarations: promote() requires a named giver — a declaration is exactly as strong as its acquisition");
  const found = log.entries.find((e) => e.task_id === candidateTaskId);
  if (!found) return { ok: false, refusal: { type: "target_not_found", target: candidateTaskId } };
  const id = nextEventId(log);
  return {
    ok: true,
    id,
    log: append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: candidateTaskId,
      description: `promoted to given, giver: ${giver}`,
      operator: "DEF",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: "Pattern",
      status: "given",
      giver,
    }),
  };
}

/** REC: concede a declaration a later stage refuted — never a deletion.
 * `trigger` names the counterexample; required, matching
 * grid.js::concedeEvaluation's own rule ("a re-zero with no recorded
 * reason is a version bump wearing an operator's name"). */
export function concede(log, taskId, { trigger }) {
  if (!log.entries.some((e) => e.task_id === taskId))
    return { ok: false, refusal: { type: "target_not_found", target: taskId, detail: `"${taskId}" is not on this log — nothing to concede` } };
  if (typeof trigger !== "string" || !trigger.trim())
    return { ok: false, refusal: { type: "no_trigger", detail: "concede: a re-zero records its own reason as `trigger` — never a silent concession" } };
  const id = nextEventId(log);
  return {
    ok: true,
    id,
    log: append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: id,
      description: `re-zero: ${trigger}`,
      operator: "REC",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: "Pattern",
      concedes: taskId,
      trigger,
    }),
  };
}

/** The live register: for each (kind, rel), the latest standing —
 * "given" (has a giver, ready for declareFunctional/declareTransitive),
 * "candidate" (disclosed-flag only), or absent if every proposal for
 * that relation has since been conceded. Later entries win, per this
 * log's own append-only "supersession keeps the past, the fold reads
 * forward" rule — mirrors foldGrid's own DEF/EVA companion-matching
 * fix (latest wins within a relation's own history, not first-match). */
export function foldDeclarations(log) {
  const byRel = new Map(); // "kind:rel" -> latest entry chain
  for (const e of log.entries) {
    if (e.kind === ENTRY_KINDS.PROPOSE && e.declKind) {
      const key = `${e.declKind}:${e.rel}`;
      byRel.set(key, { declKind: e.declKind, rel: e.rel, yields: e.yields ?? null, status: "candidate", acquisition: e.acquisition, source: e.source, taskId: e.task_id, giver: null, conceded: false });
    } else if (e.kind === ENTRY_KINDS.EVIDENCE && e.status === "given") {
      for (const v of byRel.values()) if (v.taskId === e.task_id) { v.status = "given"; v.giver = e.giver; }
    } else if (e.kind === ENTRY_KINDS.EVIDENCE && e.concedes) {
      for (const v of byRel.values()) if (v.taskId === e.concedes) { v.conceded = true; v.concessionReason = e.trigger; }
    }
  }
  const live = [...byRel.values()].filter((v) => !v.conceded);
  return {
    given: live.filter((v) => v.status === "given"),
    candidates: live.filter((v) => v.status === "candidate"),
    conceded: [...byRel.values()].filter((v) => v.conceded),
  };
}
