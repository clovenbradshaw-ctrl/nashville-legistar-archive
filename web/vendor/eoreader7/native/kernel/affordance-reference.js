// native/kernel/affordance-reference.js — a reference licensed by what it is
// Handle: Clark — after Herbert Clark's bridging inference: "the engine" is licensed by "the car" already in common ground. Amendment XVII.
// GIVEN to belong to, not only by having been said before. Medium-general,
// kernel-level.
//
// WHY THIS EXISTS. `adapters/text/discourse-referents.js` binds two
// occurrences of the SAME surface into one referent (explicit apposition);
// ordinary CON binds a pronoun to something already individuated. Neither
// covers "I bought a car. The engine made a noise" — "the engine" was
// never mentioned, and nothing in the log names it, so ordinary CON has
// nothing to reach for and would either refuse correctly (honest, but
// leaves the reference unresolved) or, worse, get talked into treating
// mere co-occurrence as evidence (exactly what P57/P60's own history in
// this project's sibling documents warns is the wrong move — nomination is
// not reasoning permission).
//
// THE PRIMITIVE ALREADY EXISTS AND IS ALREADY GENERAL. `kernel/
// hyperlexicon.js` is not a part-whole table — read closely, it is an
// explicit ledger of ANY relation-composition affordance, licensed only
// when a named giver has declared it (`giveHyperlexiconAffordance`),
// never from mere observed adjacency (`admitHyperlexiconCandidates` stays
// at `standing: "candidate"` forever, and `compositionAffordance` here is
// filtered to `"given"` only — composition needs a name, not a count).
// "Car affords engine" is exactly one more entry in that same ledger. This
// file adds no new licensing rule; it asks the Hyperlexicon a question its
// own API was already shaped to answer, and reuses ITS answer rather than
// inventing a second "is this related" test.
//
// TWO OPERATORS, ONE MOVE — the SAME pattern completion.js documents for
// NUL+CON, one triad over. Minting the implied referent is SYN·Figure: an
// emergent particular ("this car's own engine") that is not reducible to
// anything directly asserted — nobody stated "there is an engine," it is
// synthesized from what "car" is already given to entail. Binding the bare
// reference to that freshly-synthesized particular is the ordinary CON·
// Figure step, ordinary reference resolution's own cell. grid.js's own
// pinned illegality ("synthesize may not declare from relate — you cannot
// commit a whole from a stance that refuses to commit") is honored here by
// construction: synthesis fires only from a GIVEN affordance, an act of
// Generate·Figure ("Making"), never from a bare relate-mode co-occurrence.
//
// NOTHING BELOW KNOWS WHAT A NOUN PHRASE IS. `key` is whatever the caller's
// own individuation already uses to name a thing (a word, a MIDI program
// number, a circuit-component type, an opaque id) — the same discipline
// `return-curve.js`'s `form` and `witness.js`'s `role` already hold. The
// English-specific work (recognizing "the engine" as a definite NP whose
// head noun is "engine") belongs to a text adapter that has not been
// written; this file has no opinion on how a `sig` gets its `key`.
//
// AMBIGUITY IS REFUSED, NEVER GUESSED (matching contest.js's own posture
// one operator over: a candidate a caller's own filter has excluded is not
// a competitor, but two GENUINE affordances into the same key ARE — and
// this organ types that as a gap rather than picking the first one it
// finds, the exact `.find()`-first-match failure both repos' postmortems
// already name).

import { cellOf } from "./cube.js";
import { compositionAffordance } from "./hyperlexicon.js";

export const SYNTHESIZED_SCHEMA = "EOAffordedReferent@1";

/** SYN·Figure: an emergent particular, licensed, not directly stated. */
export const SYNTHESIS_CELL = Object.freeze(cellOf("SYN", "Figure"));

/** CON·Figure: the same cell ordinary reference resolution occupies. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Figure"));

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

/**
 * synthesizeFromAffordance({ sig, established, hyperlexicon }) — find
 * whether the bare reference `sig` is a GIVEN affordance of exactly one
 * already-established referent, and if so mint the implied particular.
 *
 * `sig`: { id, key } — the unresolved reference.
 * `established`: [{ id, key }] — referents this reading has already
 *   individuated (INS'd), in any order; direction is anchor -> target, so
 *   an affordance must have been given as (established.key, sig.key).
 * `hyperlexicon`: a real `hyperlexicon.js` instance (injected — this
 *   function computes no affordances of its own).
 */
export function synthesizeFromAffordance({ sig, established = [], hyperlexicon } = {}) {
  if (!sig?.id || sig?.key === undefined) throw new TypeError("synthesizeFromAffordance: sig.id and sig.key are required");
  if (!hyperlexicon) throw new TypeError("synthesizeFromAffordance: hyperlexicon is injected, never assumed");

  const licensed = [];
  for (const anchor of established) {
    const affordance = compositionAffordance(hyperlexicon, anchor.key, sig.key);
    if (affordance.standing === "given") licensed.push({ anchor, affordance });
  }

  if (licensed.length === 0) {
    return gap("no_affordance", { sigId: sig.id, key: sig.key, detail: "no established referent is GIVEN to afford this key — nothing here licenses synthesizing it" });
  }
  if (licensed.length > 1) {
    return gap("ambiguous_affordance", {
      sigId: sig.id,
      key: sig.key,
      candidates: licensed.map((l) => ({ anchorId: l.anchor.id, anchorKey: l.anchor.key, giver: l.affordance.giver })),
      detail: "more than one established referent is GIVEN to afford this key — refused rather than guessed",
    });
  }

  const { anchor, affordance } = licensed[0];
  return Object.freeze({
    schema: SYNTHESIZED_SCHEMA,
    id: `afforded:${anchor.id}:${sig.key}`,
    key: sig.key,
    cell: SYNTHESIS_CELL,
    anchorId: anchor.id,
    sigId: sig.id,
    provenance: Object.freeze({ giver: affordance.giver, basis: "explicitly given relation-composition affordance", witnesses: affordance.witnesses }),
  });
}

/**
 * resolveAfforded(sig, synthesis) — the CON step: bind the bare reference
 * to whatever synthesizeFromAffordance produced, or pass its gap through
 * unresolved. A thin wrapper on purpose — the licensing decision already
 * happened above; this only types the binding.
 */
export function resolveAfforded(sig, synthesis) {
  if (synthesis?.gap) {
    return Object.freeze({ ...synthesis, cell: RESOLUTION_CELL, bound: false, sigId: sig?.id ?? null });
  }
  return Object.freeze({
    cell: RESOLUTION_CELL,
    bound: true,
    sigId: sig.id,
    id: synthesis.id,
    key: synthesis.key,
    provenance: synthesis.provenance,
  });
}
