// nesting.js — floor 4½: a claim in an end slot, and the wall that makes it
// worth having.
//
// NEXT-PASSES named this floor and deliberately left it shut: "designed,
// namespaced, deliberately unopened until corroboration throughput
// justifies it (Pass 1-2). The door from 'knows what happened' to 'knows
// who believes what happened.'" Pass 1 (the slice lever) and Pass 2 (both
// witness protocols calibrated, generate 0.33 and select 2/6 with 0/8
// fabricated) are measured, so the gate is met and the door opens here.
//
// WHAT IT IS. An end slot may hold `claim:<assertionId>` instead of a
// surface. So the ledger can hold, as ordinary notes:
//     Tolstoy --states--> claim:napoleon|fought|kutuzov
//     A       --denies--> claim:napoleon|fought|kutuzov
// Both are ordinary corroboratable notes. Neither IS the inner claim.
//
// THE WALL — the whole reason this floor exists rather than flattening
// attribution into the assertion. **Witnesses of an outer note never
// corroborate the inner claim.** Two sources agreeing that Tolstoy says X
// corroborate that TOLSTOY SAYS X, and give X itself nothing. Without the
// wall, nesting is worse than useless: it manufactures corroboration by
// restating attribution, which is exactly how a rumour becomes a fact.
// `corroborationOf` enforces it and `leakCheck` is the assay.
//
// WHAT IT BUYS, concretely:
//   * DISAGREEMENT WITHOUT CONTRADICTION. "A says X" and "B says not-X"
//     are both true notes; the ledger stops being forced to pick.
//   * ATTRIBUTION AS EVIDENCE OF THE RIGHT THING. A well-sourced note
//     about who believes what is a real finding even when the inner claim
//     stays open.
//   * THE MODEL'S OWN VOICE, TYPED. P39's `self:model` witness is exactly
//     an outer note — the model asserting X is `self:model --asserts-->
//     claim:X`, which the wall then correctly refuses to let count as
//     evidence for X. That was previously handled by a special case in
//     mergeTestimony; here it is the ordinary shape.
//
// PURE. No engine import; ids arrive already built (assertionId is the
// hyperlexicon's, injected or precomputed by the caller).

export const CLAIM_PREFIX = "claim:";

export const REFUSALS = Object.freeze({
  not_a_claim_ref: "an end slot holding a nested claim must be `claim:<id>`",
  self_reference: "a claim may not contain itself, at any depth",
  too_deep: "nesting deeper than the caller's declared budget",
  undeclared: "maxDepth is the caller's (P4)",
});

/** `claim:<id>` — the one shape a nested end takes. */
export const claimRef = (id) => `${CLAIM_PREFIX}${String(id ?? "").trim()}`;
export const isClaimRef = (slot) => typeof slot === "string" && slot.startsWith(CLAIM_PREFIX);
export const innerId = (slot) => (isClaimRef(slot) ? slot.slice(CLAIM_PREFIX.length) : null);

/**
 * How deep does this note nest? 0 for a plain note. Resolution walks the
 * ledger, so an id naming a note the ledger does not hold reports the
 * depth reached and names the missing id rather than guessing.
 */
export function depthOf(note, ledger, { maxDepth } = {}) {
  if (!Number.isFinite(maxDepth)) throw new Error("depthOf: " + REFUSALS.undeclared);
  const byId = ledger instanceof Map ? ledger : new Map((ledger ?? []).map((n) => [n.id, n]));
  const seen = new Set();
  let cur = note, d = 0;
  while (cur) {
    const slot = [cur.end1 ?? cur.subject, cur.end2 ?? cur.object].find(isClaimRef);
    if (!slot) return { depth: d };
    const id = innerId(slot);
    if (seen.has(id) || id === note.id) return { refused: "self_reference", detail: REFUSALS.self_reference, at: id };
    seen.add(id);
    d += 1;
    if (d > maxDepth) return { refused: "too_deep", detail: REFUSALS.too_deep, depth: d, maxDepth };
    const next = byId.get(id);
    if (!next) return { depth: d, unresolved: id };
    cur = next;
  }
  return { depth: d };
}

/** Every note in the ledger that nests THIS claim, by the id it names. */
export function attributionsOf(claimId, ledger) {
  const target = claimRef(claimId);
  return (ledger ?? []).filter((n) => (n.end1 ?? n.subject) === target || (n.end2 ?? n.object) === target);
}

/**
 * corroborationOf(claimId, ledger, { distinctSources, distinctRecipes })
 *
 * THE WALL. Returns the inner claim's OWN corroboration — the witnesses of
 * the note whose id this is — and, kept strictly apart, what the ledger's
 * attributions add up to. `direct` is the only number a consumer may gate
 * a belief on; `attributed` is a fact about who says so, never about the
 * world. The two are never summed, and there is no option to sum them.
 */
export function corroborationOf(claimId, ledger, { distinctSources, distinctRecipes } = {}) {
  if (typeof distinctSources !== "function") throw new TypeError("corroborationOf: distinctSources is injected — required");
  const list = ledger ?? [];
  const own = list.find((n) => n.id === claimId);
  const direct = own ? distinctSources(own.witnesses ?? []).size : 0;
  const directInstruments = own && distinctRecipes ? distinctRecipes(own.witnesses ?? []).size : null;

  const attributions = attributionsOf(claimId, list).map((n) => ({
    id: n.id,
    who: n.end1 ?? n.subject,
    stance: n.label ?? n.verb,
    sources: distinctSources(n.witnesses ?? []).size,
    instruments: distinctRecipes ? distinctRecipes(n.witnesses ?? []).size : null,
  }));

  // stances that OPPOSE each other are a disagreement ABOUT the claim, and
  // a disagreement is a real, reportable state — never a contradiction
  // forcing the ledger to drop one side.
  const voices = new Set(attributions.map((a) => a.who));
  return {
    claimId,
    onRecord: Boolean(own),
    direct,                       // the ONLY number a belief may be gated on
    directInstruments,
    attributed: attributions.length,
    voices: voices.size,
    attributions,
    // said explicitly so no consumer has to infer it from the shape
    note: direct === 0 && attributions.length > 0
      ? "attributed but not corroborated: sources say who believes this, and nothing says it is so"
      : null,
  };
}

/**
 * leakCheck — the assay for the wall, runnable by any consumer that keeps
 * its own ledger. Given a claim, it reports whether any witness of an
 * ATTRIBUTION has been counted into the claim's own witness set. A leak is
 * how "two papers report that he said it" silently becomes "two sources
 * confirm it", so this is checked, never assumed.
 */
export function leakCheck(claimId, ledger) {
  const list = ledger ?? [];
  const own = list.find((n) => n.id === claimId);
  if (!own) return { leaked: false, reason: "claim not on record" };
  const ownWitnesses = new Set((own.witnesses ?? []).map(String));
  const leaked = [];
  for (const a of attributionsOf(claimId, list))
    for (const w of a.witnesses ?? [])
      if (ownWitnesses.has(String(w))) leaked.push({ attribution: a.id, witness: String(w) });
  return { leaked: leaked.length > 0, witnesses: leaked };
}

/**
 * disagreement(claimId, ledger, { opposes }) — who is on each side. The
 * caller declares which stances oppose which (`opposes(a, b) -> boolean`),
 * because "states" vs "denies" is a fact about a vocabulary, not about
 * nesting, and this module refuses to hold a stance list of its own.
 */
export function disagreement(claimId, ledger, { opposes } = {}) {
  if (typeof opposes !== "function") throw new TypeError("disagreement: `opposes` is the caller's declaration — required");
  const atts = attributionsOf(claimId, ledger ?? []);
  const pairs = [];
  for (let i = 0; i < atts.length; i++)
    for (let j = i + 1; j < atts.length; j++) {
      const a = atts[i], b = atts[j];
      if (opposes(a.label ?? a.verb, b.label ?? b.verb))
        pairs.push({ a: a.end1 ?? a.subject, aStance: a.label ?? a.verb, b: b.end1 ?? b.subject, bStance: b.label ?? b.verb });
    }
  return { contested: pairs.length > 0, pairs, voices: atts.length };
}
