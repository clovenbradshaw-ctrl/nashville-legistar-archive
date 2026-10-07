// fold-gate.js — kind-standing's first live caller (Tier 4 #10): the fold
// gate the cast never had.
//
// THE DEFECT THIS CLOSES (named in NEXT-PASSES since P79 landed): "the
// live cast still folds Castle Dracula into Count Dracula; foldPermitted
// exists and nothing calls it." The engine's referent discovery merges on
// shared name-tokens — correct for Anna/Anna Pávlovna, wrong for
// Castle/Count Dracula, and P79 built the measured gate (company-kind
// membership under the population null) that can tell them apart. It has
// sat unconsulted because no seam handed it (a) a proposed merge, (b) the
// sentences, and (c) a DECLARED kind to test membership against. This is
// that seam, and nothing more: the gate's statistics stay kind-standing's,
// the merge bookkeeping stays the engine's, and the KIND stays the
// caller's own declaration (foldPermitted's contract — membership needs
// declared members; deriving the kind from nothing is P79's own refuted
// basin null).
//
// REVIEW, NOT PREVENTION, by design: the engine's discoverReferents runs
// unmodified and reports every merge it made (`merges: {kept, folded,
// witness}`); this module re-examines each REPORTED merge against the
// declared kind and returns the vetoed ones with their evidence. A caller
// (cast display, the crown, a referent query) treats a vetoed merge's two
// halves as distinct. Undoing the merge inside the engine's own event
// stream is deliberately NOT attempted here — rewriting another organ's
// referent ids from outside is how two bookkeepings drift; the veto is a
// STANDING a consumer consults, the same posture kind-standing's own
// header takes ("a gate must treat unknown as no standing, never as
// different kind").
//
// PURE; organs injected (contextVectors/foldPermitted from kind-standing,
// splitSentences from the engine) — the cast.js posture.

import { contextVectors, foldPermitted, kindMembership } from "./index.js";

export const REFUSALS = Object.freeze({
  undeclared: "the kind is DECLARED — members with a named giver, alpha valued (P4/P79); a gate that derives its own kind from nothing re-runs the refuted basin null",
});

// ── the identity gate: a merge's own two sides, witnessed against each other ─
//
// reviewMerges above catches Castle Dracula ⨯ Count Dracula because the two
// sides sit in DIFFERENT declared kinds (place vs. person) — a coarse,
// reliable signal. It cannot catch Sonia ⨯ Marmeladov: both are persons, so
// both read the identical verdict against any person-kind, and foldPermitted
// (same_kind) permits by construction. "The Holograph" essay names the gap
// precisely: "nothing yet counts witnesses against a merge" once the two
// sides already agree on kind.
//
// THE FIX IS NOT A NEW STATISTIC. It is `kindMembership` called on a
// singleton: instead of asking "does A's company resemble the DECLARED
// kind's members, more than the population's does" (P79's own question),
// ask "does A's company resemble B'S company specifically, more than the
// population's does" — B standing in as a kind of exactly one member. The
// population-is-the-null contract (P79, verbatim: "nothing redealt") is
// identical either way; only which surface plays "the kind" changes. This
// is deliberately NOT the refuted mechanism (`sameAct`-by-raw-cosine,
// the-fold CLAUDE.md's "act identity by distributional company is DEAD" —
// saw/wrote 0.744 beat the genuine synonym pair looked/gazed 0.585): that
// attempt compared two surfaces' cosine DIRECTLY, with no population and no
// null. This asks whether the closeness is unusual — a rank against every
// OTHER referent in the material — which is exactly the discipline that
// already validated kind-standing (9 of 10 declared place-kind members
// recover; Castle Dracula/Count Dracula correctly separate).
//
// Asymmetric on purpose: A can be a card-carrying member of "the kind named
// B" while B is not a member of "the kind named A" (thin profiles cut both
// ways independently), so both directions are tested and BOTH must read
// `member` for the pair to stand unrefuted. `undetermined` on either side
// is the same withhold this whole codebase already holds everywhere else —
// a thin profile is a fact about the reading, never evidence of a different
// being (kind-standing.js's own header, one level up).

/**
 * refuteIdentity(candidate, anchor, vecs, {alpha}) — does the CANDIDATE's own
 * company resemble the ANCHOR's, specifically, more than the material's other
 * referents' does? `vecs` must already carry the population's own vectors
 * (contextVectors over both surfaces AND every other referent) — nothing here
 * computes a population; P79's contract stays: the population is whatever
 * `vecs` was built over, minus the anchor itself.
 *
 * DIRECTIONAL, AND THE DIRECTION IS LOAD-BEARING — measured, after a
 * symmetric first cut was refuted by its own real-book run. The first
 * version required BOTH directions to read `member` (candidate→anchor AND
 * anchor→candidate). That is not `kindMembership`'s contract — its declared
 * `members` are meant to be the well-evidenced reference set, and the
 * candidate is what gets tested against them — and requiring symmetry is
 * structurally biased toward refusal whenever the two sides carry unequal
 * evidence, which is nearly always true of name variants. Measured on the
 * real Crime and Punishment text (267-referent population, alpha 0.1):
 *
 *   surface                    mass   candidate→anchor      anchor→candidate
 *   Sofya Semyonovna  (same)     72   member     p=0.004    not_member p=0.322
 *   Sofya Ivanovna    (same)      6   member     p=0.037    not_member p=0.367
 *   Marmeladov     (a FATHER)    68   not_member p=0.101    not_member p=0.363
 *   Mr Marmeladov  (a FATHER)     4   not_member p=0.483    not_member p=0.382
 *
 * The candidate→anchor column separates true variants from the father's
 * surname cleanly. The anchor→candidate column reads `not_member` for every
 * row, good and bad alike — it carries no signal at all, because a rich
 * anchor tested against one thin variant's singleton "kind" is roughly
 * equally unlike everything in a large population. ANDing a working test
 * with a constant is the constant. One direction, and the caller is
 * responsible for passing the evidence-richer surface as `anchor`
 * (`reviewReferentAssignments` picks it by company mass for exactly this).
 *
 * Returns `{verdict, candidate: <kindMembership>}`:
 *   "confirmed"     — the candidate reads `member` of the anchor's singleton
 *                      kind: closer to it than the population is.
 *   "refuted"       — `not_member`: a real, population-null-surviving
 *                      distinction separates them.
 *   "undetermined"  — too thin a profile to test at all (never a conviction
 *                      from absence).
 */
export function refuteIdentity(candidate, anchor, vecs, { alpha } = {}) {
  if (!Number.isFinite(alpha)) throw new Error("refuteIdentity: alpha must be declared");
  const verdict = kindMembership(candidate, [anchor], vecs, { alpha });
  if (verdict.verdict === "unknown") return { verdict: "undetermined", candidate: verdict };
  if (verdict.verdict === "member") return { verdict: "confirmed", candidate: verdict };
  return { verdict: "refuted", candidate: verdict };
}

/**
 * reviewIdentityMerges(passages, merges, {splitSentences, population, alpha})
 *
 * The `reviewMerges` shape, with no declared kind — `refuteIdentity`'s
 * pairwise test needs none, and requiring one here would be the same
 * derive-a-kind-from-nothing mistake `reviewMerges` itself refuses, aimed
 * backwards: there is no kind to declare, only the pair the merge already
 * names. `population` is the cast's OWN other referents (P79: the null is
 * everyone else in the material, never simulated) — fewer than two and
 * every pair reads `undetermined` honestly (`no_population`), same as
 * `kindMembership` itself.
 *
 * Returns `{confirmed, refuted, undetermined}` — every reported merge lands
 * in exactly one, carrying `refuteIdentity`'s own verdicts as evidence.
 * REVIEW, NOT PREVENTION (reviewMerges' own posture): the engine's merge
 * stands; a caller treats a REFUTED entry's two halves as still-distinct
 * pending a witness, the same posture drift()/reanchor() already hold for
 * a ground address that no longer resolves.
 */
export function reviewIdentityMerges(passages, merges, { splitSentences, population = [], alpha } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("reviewIdentityMerges: splitSentences is injected — required");
  if (!Number.isFinite(alpha)) throw new Error("reviewIdentityMerges: alpha must be declared");
  const text = (passages ?? []).map((p) => p?.text ?? "").join("\n\n");
  const sentences = splitSentences(text).map((s) => ({ text: s.text ?? s }));
  const confirmed = [], refuted = [], undetermined = [];
  for (const m of merges ?? []) {
    const a = String(m.witness ?? m.kept ?? "");
    const b = String(m.folded ?? "");
    if (!a || !b) { undetermined.push({ merge: m, reason: "merge record carries no surfaces" }); continue; }
    const vecs = contextVectors(sentences, [...new Set([a, b, ...population])]);
    const verdict = refuteIdentity(a, b, vecs, { alpha });
    const entry = { merge: m, a, b, verdict: verdict.verdict, evidence: verdict };
    if (verdict.verdict === "confirmed") confirmed.push(entry);
    else if (verdict.verdict === "refuted") refuted.push(entry);
    else undetermined.push(entry);
  }
  return { confirmed, refuted, undetermined, alpha };
}

/**
 * reviewMerges(passages, merges, { splitSentences, kind, alpha })
 *
 * `kind` — { members: [surface...], giver: string } — the declared kind
 *   membership is tested against (P79's own contract: the population is
 *   the null, so members must be DECLARED, never induced here).
 *
 * Returns { permitted, vetoed, unknown } — every merge lands in exactly
 * one, each carrying kind-standing's own verdicts as evidence. `unknown`
 * (either side has no profile) PERMITS per foldPermitted's own rule — a
 * thin profile is a fact about the reader, not the referents — but is
 * reported apart so a consumer can see how much the gate actually
 * measured.
 */
export function reviewMerges(passages, merges, { splitSentences, kind, alpha, population = [] } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("reviewMerges: reviewMerges: splitSentences is injected — required");
  if (!kind || !Array.isArray(kind.members) || !kind.members.length || !kind.giver || !Number.isFinite(alpha))
    throw new TypeError("reviewMerges: " + REFUSALS.undeclared);
  // `population` — the material's OWN other referents (the cast's faces),
  // because kind-standing's null IS the population: "is X a member of kind
  // K" is answered by whether X sits closer to K's members than the rest
  // of the material does (P79, verbatim — nothing redealt). A pair alone
  // has no rest-of-material, which the first live run refused honestly as
  // `no_population`; the caller hands the cast in, and the cast is
  // MEASURED from the material, not declared, so this costs no giver.

  const text = (passages ?? []).map((p) => p?.text ?? "").join("\n\n");
  const sentences = splitSentences(text).map((s) => ({ text: s.text ?? s }));
  const permitted = [], vetoed = [], unknown = [];
  for (const m of merges ?? []) {
    const a = String(m.witness ?? m.kept ?? "");
    const b = String(m.folded ?? "");
    if (!a || !b) { unknown.push({ merge: m, reason: "merge record carries no surfaces" }); continue; }
    // vectors are built over the two surfaces PLUS the declared members —
    // the members ARE the population the null needs (P79: nothing redealt)
    const vecs = contextVectors(sentences, [...new Set([a, b, ...kind.members, ...population])]);
    const verdict = foldPermitted(a, b, kind.members, vecs, { alpha });
    const entry = { merge: m, a, b, verdict, kind: kind.giver };
    if (verdict.reason === "no_standing") unknown.push(entry);
    else if (verdict.permitted) permitted.push(entry);
    else vetoed.push(entry);
  }
  return { permitted, vetoed, unknown, kind: { giver: kind.giver, members: kind.members.length }, alpha };
}

// ── the assignment gate: every surface, against the group it actually landed in ─
//
// TRIED reviewIdentityMerges against the real Crime and Punishment text
// (2026-09-08) and it had nothing to review: `discoverReferents` reported
// ZERO merges on a 900,000-byte slice, yet its own `events` show bare
// "Marmeladov" and "Mr Marmeladov" — the FATHER's surname, everywhere else
// in the text — landing on `ref:auto:sofya_semyonovna_marmeladov`, the
// DAUGHTER's referent, founded by the fuller "Sofya Semyonovna Marmeladov"
// (processed first, most-individuated-first assignment order, S17). This
// is the essay's Sonia/Marmeladov specimen, reproduced independently on
// real bytes — and it is NOT a recorded merge event at all. It is the
// ORDINARY containment-based assignment a bare surname gets on its very
// first sighting, because nothing yet distinguishes "shares a token with
// the group's maximal" from "IS the group's maximal, semantically" at
// assignment time. `reviewIdentityMerges` can only examine what
// `discoverReferents` chose to LABEL a merge; this examines every
// assignment, merge-labelled or not.
//
// Same statistic, wider net: for every referent id with more than one
// surface, the group's own ANCHOR (its most-individuated member — the
// same rule `discoverReferents`' own assignment order already uses to
// decide who founds a group) is compared against every OTHER surface
// sharing that id via `refuteIdentity`. A refuted pairing is disclosed —
// never silently un-clustered, the same review-not-prevention posture
// every gate in this file already holds.

/** Total company mass a surface's vector carries — how much evidence
 * `contextVectors` actually has about it, not how many words it is.
 * `undefined` for a surface with no profile at all. */
const massOf = (vecs, s) => { const v = vecs.get(s); return v ? [...v.values()].reduce((a, b) => a + b, 0) : undefined;};

/**
 * reviewReferentAssignments(passages, events, {splitSentences, alpha, population})
 *
 * `events` — `discoverReferents`'s own return, `.events` (every
 * `{type: "DEF.admit", referent_id, surface}` row) — read directly, no
 * separate merge bookkeeping to keep in sync.
 *
 * Groups events by `referent_id`; within each group of >1 surface, the
 * anchor is the RICHEST surface — the one `contextVectors` has the most
 * total company mass for — and every other surface in the group is tested
 * against it with `refuteIdentity`. `population` defaults to every OTHER
 * group's own anchor — the material's real referents, never simulated
 * (P79) — when the caller has none more specific to hand.
 *
 * ANCHOR BY MASS, NOT BY LENGTH — measured, not assumed. A first cut
 * anchored on the longest (most-individuated) surface, mirroring
 * `discoverReferents`' own assignment-order convention — and TRIED against
 * the real Crime and Punishment text, it flagged "Sofya" and "Sofya
 * Ivanovna" as refuted against their own group's true anchor, alongside
 * the real Marmeladov/Mr Marmeladov confusion it correctly caught. Reading
 * the raw vectors why: "Sofya Semyonovna Marmeladov" (the full ceremonial
 * form) occurs almost nowhere as its own exact 3-word phrase (4 total
 * mentions of company); "Sofya" alone carries 82, dominated by
 * `after=semyonovna` — real prose uses the shorter forms far more than the
 * full one, so the longest surface is reliably the SPARSEST, not the most
 * representative. Anchoring on mass instead — whichever surface
 * `contextVectors` actually has the most evidence for — fixes this without
 * inventing a second statistic: it is the same vectors, read for what they
 * already are before comparing anything.
 *
 * Returns `{confirmed, refuted, undetermined}`, one entry per non-anchor
 * surface, each carrying its group's referent_id and anchor for context.
 */
export function reviewReferentAssignments(passages, events, { splitSentences, alpha, population = null } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("reviewReferentAssignments: splitSentences is injected — required");
  if (!Number.isFinite(alpha)) throw new Error("reviewReferentAssignments: alpha must be declared");
  const byId = new Map();
  for (const e of events ?? []) {
    if (e?.type !== "DEF.admit" || !e.surface || !e.referent_id) continue;
    if (!byId.has(e.referent_id)) byId.set(e.referent_id, []);
    const list = byId.get(e.referent_id);
    if (!list.includes(e.surface)) list.push(e.surface);
  }

  const text = (passages ?? []).map((p) => p?.text ?? "").join("\n\n");
  const sentences = splitSentences(text).map((s) => ({ text: s.text ?? s }));
  // ONE pass over every surface in every group, so the mass each carries
  // is read once and used both to pick anchors and to compare against them.
  // A caller-supplied `population` may name surfaces no group holds, so it
  // joins the one pass too — otherwise those names would silently carry no
  // vector and drop out of the null they were handed in to BE.
  const allSurfaces = [...new Set([...[...byId.values()].flat(), ...(population ?? [])])];
  const preVecs = contextVectors(sentences, allSurfaces);
  const anchorOf = (surfaces) => surfaces.reduce((best, s) => ((massOf(preVecs, s) ?? -1) > (massOf(preVecs, best) ?? -1) ? s : best), surfaces[0]);
  const derivedPopulation = population ?? [...byId.values()].map(anchorOf);

  const confirmed = [], refuted = [], undetermined = [];
  for (const [referentId, surfaces] of byId) {
    if (surfaces.length < 2) continue;
    const anchor = anchorOf(surfaces);
    // THE NULL IS *OTHER* REFERENTS — the group's own siblings are not
    // "other" and must not stand in the population. Measured: with them
    // left in (the first cut passed `surfaces` straight into the vectors,
    // and `kindMembership` derives its population from `vecs.keys()` minus
    // the declared member, so every sibling silently became a null draw),
    // 50 of 57 within-group comparisons on real Crime and Punishment read
    // `refuted` — including the daughter's own genuine name variants. The
    // direction of that error is exactly what the contamination predicts:
    // a sibling that IS the same being resembles the anchor well, so it
    // inflates the null it was never supposed to join, and a true match
    // then cannot look unusual against it. Only `s`, the anchor, and the
    // cross-group population are in scope for any one comparison.
    const others = derivedPopulation.filter((p) => !surfaces.includes(p));
    // The vectors are the ONE pre-pass's, SELECTED — never recomputed per
    // comparison. Rebuilding them inside this loop re-scanned every sentence
    // per candidate and took the real-book test from 99s to past 280s;
    // `contextVectors` is a corpus scan, and its result is the same map
    // whichever subset is asked for.
    const selectVecs = (names) => {
      const m = new Map();
      for (const n of names) { const v = preVecs.get(n); if (v) m.set(n, v); }
      return m;
    };
    for (const s of surfaces) {
      if (s === anchor) continue;
      const vecs = selectVecs([...new Set([s, anchor, ...others])]);
      const verdict = refuteIdentity(s, anchor, vecs, { alpha });
      const entry = { referentId, anchor, surface: s, verdict: verdict.verdict, evidence: verdict };
      if (verdict.verdict === "confirmed") confirmed.push(entry);
      else if (verdict.verdict === "refuted") refuted.push(entry);
      else undetermined.push(entry);
    }
  }
  return { confirmed, refuted, undetermined, alpha };
}
