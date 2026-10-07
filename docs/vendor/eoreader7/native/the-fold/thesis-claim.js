// thesis-claim.js — WHEN SEVERAL THESIS CANDIDATES ARE THE SAME CLAIM
// (2026-09-25; read twice by the reading archons the same day). arrange.js's
// thesis is a SELECTION: the one general, non-contrastive, subject-only
// statement whose words recur most, and its own sentence is always what the
// piece and the mouth are given. This file asks one further question: do
// several of the eligible candidates recur as the SAME CLAIM — the same
// relation, at the same polarity, over roles that agree? If they do, a
// GENERALIZED CLAIM stands BESIDE the winner's sentence on the record, never
// in its place: the agreement is real evidence the single top-scorer alone
// did not carry.
//
// Nothing here discovers a cluster by any means but the engine's own,
// already-proven one: kernel/entity-kind-induction.js's null-validated
// affinity-basin clustering, the same primitive the-fold/kinds.js already
// runs over every drafted statement and the-fold/paradigm.js already runs
// over literary forms. No new statistic, no hand-set threshold — a basin
// either clears its own random-subset binding-energy null or it does not.
// The null is measured on WHAT IS GENERALIZED: one feature per candidate,
// its relation joined with its polarity and its via, read off f.notes —
// arrange.js's OWN already-computed field (built by its local notesOf(),
// originally for Kelsen's cycle-finder). No new parsing, and no import of
// kinds.js's rootOf, which is private there. (Gornick showed a denial
// warranting the basin that then excluded it, when the feature was the
// relation alone.)
//
// BUILT (2026-09-25, same day): the bridge into the reasoning core —
// claimsOf(thesisGen), below — turns a generalization into real
// EOGfpClaim@1s: force "strict" at each member's own part, force "default"
// at the lca, never strict at the lca (a report is not a law; Zinsser,
// Kelsen). organs/reasoning-lint.js's lintGfp/falsifyGfp now refuse any
// record that is not EOGfpClaim@1 by schema name, built first as this
// bridge's own precondition (a lone EOGfpGeneralization@1 used to clear
// them silently). Neither is wired into arrange.js's outline yet — the
// bridge exists and is verified against the real reasoning core, but
// whether and where a live caller should consume `claimsOf(gen)` is a
// separate, not-yet-made decision.
//
// ALSO BUILT (2026-09-25): (4) the typed polarity contest — arrangeEssay
// now builds a local, throwaway kernel/notes.js ledger and admits each
// witnessed member's own exact triple as a link, each denial's own exact
// triple as a cut, each statement its own witness/source (a document is
// many sayings, never one voice testifying twice). Verified directly:
// kernel/notes.js's noteId keys on the FULL triple, so a cut only meets a
// link when its own object is byte-identical to a witnessed one — the
// generalization's varying role is not enough, and correctly so: a denial
// naming an object no member asserted contests nothing actually witnessed,
// and stays a reported string, never a manufactured contest.
//
// STILL OWED: (2) The restore: a member that
// opens a multi-sentence source paragraph returns to that paragraph's body
// group (still a witness); a refrain line stays held out — after one mouth
// run on a refrain-bearing real ground (McPhee, Gornick, Lish; contested by
// Clark, Kidder & Todd). (3) The phrasing step: one computed claim in, one
// sentence out, re-checked through arrange.js's eligibility gate before it
// replaces anything.

import { kindEvidence, createKindInductionIndex, indexKindEntries } from "../kernel/kind-induction.js";
import { induceEntityKindCandidates } from "../kernel/entity-kind-induction.js";
import { gfpClaim, claimFromTriple, generalizeClaims, caselessIdentity, holon } from "../kernel/gfp-claim.js";

/**
 * thesisBasin(pool, winnerId, { population }) →
 *   { candidate, noted, entities, diagnostics }
 * `candidate` is a validated EOKindCandidate@1 or null. `pool` is
 * arrange.js's own thesis-candidate array (already gated: general,
 * non-contrastive, names no being beyond the subject); `winnerId` is today's
 * single-winner thesis point id — the returned basin, if any, always contains
 * it, so a generalization only ever elaborates today's pick, never jumps to a
 * cluster the recurrence score would never have chosen. `noted` is how many
 * pool candidates carried at least one relation note (a candidate whose
 * parse yields no subject+object note is invisible to the basin: under-cited,
 * and said in the basis), and `diagnostics` is the kernel's own.
 */
export function thesisBasin(pool, winnerId, { population = "thesis-pool" } = {}) {
  const entries = [];
  let seq = 0, noted = 0;
  const posOf = new Map(pool.map((f, i) => [f.pt.id, i]));
  for (const f of pool) {
    let any = false;
    for (const note of f.notes) {
      if (!note.label) continue;
      any = true;
      entries.push(kindEvidence({
        id: `tb-${++seq}`, entityRef: f.pt.id, featureKey: "claim", featureValue: `${note.label}\u0001${note.polarity ?? "+"}\u0001${note.via ?? "obj"}`,
        sequencePosition: posOf.get(f.pt.id), witness: f.pt.id, anchor: { start: f.pt.span.start, end: f.pt.span.end },
      }));
    }
    if (any) noted += 1;
  }
  const index = createKindInductionIndex();
  indexKindEntries(index, entries);
  const induced = induceEntityKindCandidates(index.entityFeatures, { population });
  const validated = induced.candidates.filter((c) => c.field?.stable === true && c.fallbackNomination !== true && c.memberCount >= 2);
  const candidate = validated.find((c) => c.memberRefs.includes(winnerId)) ?? null;
  // A basin that cleared but does not hold the winner is a third state, said
  // as such (the winner may itself be a denial, or carry no note): never
  // "no basin" beside a validated count.
  const elsewhere = validated.filter((c) => c !== candidate).map((c) => ({ memberRefs: c.memberRefs, memberCount: c.memberCount, cohesionNull: c.cohesionNull }));
  return { candidate, elsewhere, noted, entities: induced.diagnostics.entities, diagnostics: induced.diagnostics };
}

/**
 * thesisGeneralization(basinMembers, { identity, winnerId }) →
 *   { generalization, statements, relation, label, polarity, via,
 *     agreeingClaims, excluded, unresolved, refused: null }
 *   or { generalization: null, refused: <why>, excluded, unresolved }
 * — a refusal is always said, and what was left out is always named.
 * Builds one GFP claim per relation-note on each basin member (arrange.js's
 * own subj/root/obj triple with its polarity, via and particle; the claim's
 * relation carries the particle and the oblique's case — "give up",
 * "flow:through" — so the fact says what keyed its group), skips notes whose
 * polarity is unresolved (a negation the read did not place — returned as
 * `unresolved`, never cited), groups the rest by relation + polarity + via
 * (a denial never joins the assertions it denies; "flowed through" never
 * joins "flowed past"), takes the group that holds the WINNER's statement
 * (`winnerId` is required in practice: arrange.js always passes it; without
 * it the largest group is taken, disclosed here), and refuses unless at least
 * two claims are in it AND they agree on at least one role — a relation's
 * frequency is not a claim. Every other group is returned as `excluded`,
 * with its statement ids, relation, polarity and via. `identity` defaults to
 * caseless string identity, not a referent-aware resolver: R's
 * resolveText/represent operate over spans and referent ids, not the bare
 * parse-tree lemmas a note's end1/end2 already are, so "the dam" merging
 * with "Old Hickory Dam" is not attempted here.
 */
export function thesisGeneralization(basinMembers, { identity = caselessIdentity, winnerId = null } = {}) {
  const tagged = [], unresolved = [];
  for (const f of basinMembers) {
    for (const note of f.notes) {
      if (!note.label) continue;
      if (note.polarity === "?") { unresolved.push(f.pt.id); continue; }
      const via = note.via ?? "obj";
      const caseOf = via.startsWith("obl:") ? via.slice(4) : "";
      const rel = `${note.label}${note.prt ? ` ${note.prt}` : ""}${caseOf ? `:${caseOf}` : ""}`;
      tagged.push({
        claim: claimFromTriple(note.end1, rel, note.end2, { ground: holon(`/${f.pt.part}`), id: note.id, polarity: note.polarity ?? "+" }),
        ptId: f.pt.id, via, label: note.label,
      });
    }
  }
  const keyOf = (t) => `${t.claim.rel}\u0001${t.claim.polarity}\u0001${t.via}`;
  const groups = new Map();
  for (const t of tagged) { const k = keyOf(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  const describe = (g) => ({ statements: [...new Set(g.map((t) => t.ptId))], relation: g[0].claim.rel, polarity: g[0].claim.polarity, via: g[0].via, claims: g.length });
  const others = (group) => [...groups.values()].filter((g) => g !== group).map(describe);
  const refuse = (why, group = null) => ({ generalization: null, refused: why, excluded: others(group), unresolved: [...new Set(unresolved)] });
  const own = [...groups.values()].filter((g) => g.some((t) => t.ptId === winnerId));
  if (winnerId != null && !own.length) return refuse(`the winner ${winnerId} carries no resolved relation note in this basin`);
  const group = (own.length ? own : [...groups.values()]).sort((a, b) => b.length - a.length)[0];
  if (!group) return refuse("no relation notes among the basin's members");
  if (group.length < 2) return refuse(`only 1 claim carries the relation "${group[0].claim.rel}" (${group[0].claim.polarity}, ${group[0].via}) in the winner's group`, group);
  const generalization = generalizeClaims(group.map((t) => t.claim), { identity });
  if (!Object.keys(generalization.agreed).length) return refuse(`${group.length} claims share the relation "${generalization.rel}" but agree on no role — a relation's frequency is not a claim`, group);
  return {
    generalization,
    statements: [...new Set(group.map((t) => t.ptId))],
    relation: generalization.rel, label: group[0].label, polarity: generalization.polarity, via: group[0].via,
    // Kept, not discarded (owed item 1, header above): each member's own
    // claim, already built here with its own ground, is what claimsOf turns
    // into real EOGfpClaim@1s below.
    claims: group.map((t) => t.claim),
    agreeingClaims: group.length, excluded: others(group), unresolved: [...new Set(unresolved)], refused: null,
  };
}

/**
 * claimsOf(thesisGen) → EOGfpClaim@1[] — the reasoning-core bridge (owed
 * item 1, header above). Two kinds, never merged into one: each basin
 * member's OWN claim, force "strict" at ITS OWN part (what that one
 * statement actually witnesses, definite there — reusing the exact claim
 * thesisGeneralization already built, only its force changed); and one
 * further claim at the generalization's OWN ground — the lca of every
 * member — force "default", carrying only the AGREED roles (a varying role
 * has no single value the wider ground could assert). A report is not a
 * law: the induction beyond any one member's own ground stays defeasible,
 * NEVER strict at the lca (Zinsser, Kelsen, third reading). Takes
 * thesisGeneralization's own return value, not the bare EOGfpGeneralization@1
 * — it needs each member's claims, which the bare record does not carry.
 */
export function claimsOf(thesisGen) {
  const gen = thesisGen?.generalization;
  if (!gen || !thesisGen.claims?.length) return [];
  const witnessed = thesisGen.claims.map((c) => gfpClaim({ ground: c.ground, rel: c.rel, roles: c.roles, polarity: c.polarity, force: "strict", id: c.id }));
  if (!Object.keys(gen.agreed).length) return witnessed;
  const induced = gfpClaim({ ground: gen.ground, rel: gen.rel, roles: gen.agreed, polarity: gen.polarity, force: "default", id: `${gen.sourceIds.join("+")}~generalized` });
  return [...witnessed, induced];
}
