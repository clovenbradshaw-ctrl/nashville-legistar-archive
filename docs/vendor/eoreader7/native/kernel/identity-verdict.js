// native/kernel/identity-verdict.js — IDENTITY AS THE PATTERN, with exclusion
// as the disambiguating tool (2026-09-27). Medium-blind, kernel-level.
// Standing: nomination.
//
// User direction: "this is a tool for disambiguating identity, but identity
// itself is the pattern — of these trajectories." The archon review
// (nagarjuna, parmenides, kelsen) settled how the two organs compose:
//
//   FOR     identity-induction.js — the positive pattern: the universes folded
//           on the two referents match, their counterfactual consequences
//           align, their trajectories cross-predict (bound; contested
//           carries a for as well)
//   AGAINST identity-exclusion.js alone, when a GIVEN one-valued relation
//           conflicts on witnessed assertions (contradicted). A candidate
//           conflict, an unwitnessed conflict or "no conflict found" is NOT
//           against.
//   RAISED  identity-induction.js when it measures a DIFFERENCE. Amended
//           2026-09-27: on the Russian first version of War and Peace it
//           called 5 of 13 case forms of ONE name "different" (Наташа/Наташу,
//           Пьер/Пьеру, Кутузов/Кутузова, Андрей/Андрея...). A case form sits
//           in the roles its case marks, so its surroundings differ by ROLE,
//           not by referent: a difference of USE (Wittgenstein, PI §43), never
//           a proof of a different thing. It is disclosed as a raised attack
//           and convicts nothing; only a declared constraint does.
//
// The verdict is hl.js's own table (verdictOfSupport) — one lattice, never a
// second one here. beyond-reach absorbs only when neither side could ask.
// FOR WHOM (amended 2026-09-27): a verdict is always someone's. A caller may
// hand the for-whom (kernel/for-whom.js createForWhom) it judged for; the
// verdict then carries its id, giver, question and priors, so the same pair
// can be re-read under another judge and a flip is attributable to the judge.
// No for-whom is reported as exactly that — never as a view from nowhere.
//
// A bound (or contested) pair is handed back as an identity.js alternative
// with its support and attack references: a revisable hypothesis, conceded
// when further reading moves either side — never a settled fact.

import { BOUND, CONTRADICTED, CONTESTED, BEYOND_REACH, verdictOfSupport } from "../interpretation/hl.js";
import { identityAlternative } from "./identity.js";

export function identityVerdict(induction, exclusion, { giver = null, forWhom = null } = {}) {
  if (!induction || !exclusion) throw new TypeError("identity-verdict: both the induction and the exclusion readings are required");
  if (induction.a !== exclusion.a || induction.b !== exclusion.b) throw new TypeError("identity-verdict: the two readings are about different pairs");
  const forS = induction.verdict === BOUND || induction.verdict === CONTESTED;
  const againstS = exclusion.verdict === CONTRADICTED;
  const raised = induction.verdict === CONTRADICTED || induction.verdict === CONTESTED ? [`induction:${induction.reason}`] : [];
  const verdict = induction.verdict === BEYOND_REACH && exclusion.verdict === BEYOND_REACH ? BEYOND_REACH : verdictOfSupport(forS, againstS);
  const supportRefs = forS ? [`induction:${induction.a}~${induction.b}@${induction.reason ?? "pattern"}`] : [];
  const attackRefs = [
    ...(exclusion.verdict === CONTRADICTED ? (exclusion.proof ?? []).flatMap((p) => [p.a?.id, p.b?.id].filter(Boolean)) : []),
  ];
  const hypothesis = verdict === BOUND || verdict === CONTESTED
    ? identityAlternative({ left: String(induction.a), right: String(induction.b), standing: verdict === BOUND ? "live_hypothesis" : "contested_hypothesis", supportRefs, attackRefs, giver })
    : null;
  return Object.freeze({ a: induction.a, b: induction.b, verdict, for: forS, against: againstS, induction: { verdict: induction.verdict, reason: induction.reason ?? null }, exclusion: { verdict: exclusion.verdict, reason: exclusion.reason ?? null, raised: (exclusion.raised ?? []).length }, raised, hypothesis, judgedFor: forWhom ? Object.freeze({ id: forWhom.id, giver: forWhom.giver, question: forWhom.question, priors: forWhom.priors }) : Object.freeze({ id: null, detail: "no for-whom declared" }) });
}
