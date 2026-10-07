// native/organs/embedded-query.js — the embedding-lemma combinator: cancels
// TWO unknowns at once (which word means "yes"; whether the speaker
// answers truthfully or falsely) by asking about a HYPOTHETICAL answer
// rather than the proposition directly. Pure, closed-form — a "loop in a
// loop" only in the sense of a question about a question; evaluating it
// is a single identity, not a recursive unwind, and it terminates by
// construction (depth exactly one, never self-referential past that).
//
// CORRECTED (2026-09-10, caught by this module's own test): the lemma's
// real content is about the LITERAL WORD uttered ("da" or "ja" as a
// SOUND), never about abstract "yes/no" MEANING. The first draft returned
// a "yes/no" boolean and pushed the da/ja translation into a separate
// `wordFor` step keyed by a declared word-mapping — which is wrong: the
// whole point of the embedding is that the uttered WORD is fixed
// (literally "da" when the embedded proposition is true) regardless of
// what da secretly means. Conflating "the word" with "its meaning" made
// `wordFor` compute the wrong thing whenever the secret mapping was
// da=no — caught by a test asserting the true, stronger invariant, not by
// review.
//
// HONESTY TYPES, closed class: "true" (answers every question truthfully),
// "false" (answers every question falsely), "random" (a fair coin per
// question, uncorrelated with anything asked — CARRIES NO SIGNAL BY
// DECLARATION, never merely "weak" — see NULL_WITNESS below, the DEF·Ground
// act this organ makes: a source can be declared a priori uninformative,
// a different claim than "unresolved" or "under-examined" elsewhere in
// this codebase, which are always facts about the READER's power to
// examine, not the SOURCE's own mechanism).

export const HONESTY_TYPES = Object.freeze(["true", "false", "random"]);
export const DA = "da";
export const JA = "ja";

/**
 * saysDa(honesty, propositionTruth) — does a god of the given honesty type
 * LITERALLY UTTER THE WORD "da" (never mind what it means) in answer to
 * "If I asked you 'P?', would you say da?", where P has the given truth
 * value? Returns `true` (utters "da"), `false` (utters "ja"), or `null`
 * for "random" — a random answer carries no signal.
 *
 * PROOF, by direct case derivation over BOTH secret mappings (da=yes or
 * da=no) and BOTH honesty types — verified exhaustively against an
 * independent brute-force simulator in embedded-query.test.js, which
 * literally tracks the uttered WORD at every step rather than an
 * abstract yes/no value:
 *
 *   Let YES be whichever of {da, ja} really means "yes" (unknown to us).
 *   honesty=true, P true: asked P directly, the god truthfully utters
 *     YES. Sub-case YES=da: "would you say da" is true; truthfully
 *     reporting that utters YES=da. Sub-case YES=ja (so da=NO-word): the
 *     god would utter YES=ja, not da, so "would you say da" is FALSE;
 *     truthfully reporting that utters NO-word=da (since NO=da in this
 *     sub-case). EITHER WAY: the god utters "da".
 *   honesty=false: the double negation of lying about a hypothetical lie
 *     cancels the same way, by the mirrored argument (full four-branch
 *     table in the test file) — the god utters "da" too.
 *   P false is the exact mirror of both: the god utters "ja" in every
 *     sub-case, both honesty types.
 *
 * This is why the function needs no `honesty` branch in its return value
 * at all: True and False become indistinguishable, and simultaneously
 * reliable, once a question is embedded this way — and the uttered word
 * is fixed independent of which word secretly means what.
 */
export function saysDa(honesty, propositionTruth) {
  if (!HONESTY_TYPES.includes(honesty)) throw new TypeError(`saysDa: honesty must be one of ${HONESTY_TYPES.join(", ")}`);
  if (typeof propositionTruth !== "boolean") throw new TypeError("saysDa: propositionTruth is a declared boolean — the proposition's real truth value, never guessed");
  if (honesty === "random") return null;
  return propositionTruth; // true and false both reduce to the identity — this IS the lemma, on the WORD, not the meaning
}

/** word(saysDaBool) — the literal word ("da"/"ja") a `saysDa` result names.
 * Trivial by design: once `saysDa` answers the real question (which SOUND
 * is uttered), there is nothing left to translate — no word-mapping is
 * ever consulted here, on purpose (that was the bug). */
export function word(saysDaBool) {
  if (typeof saysDaBool !== "boolean") throw new TypeError("word: saysDaBool is declared (from saysDa) — never a mapped yes/no value");
  return saysDaBool ? DA : JA;
}

// NULL_WITNESS — DEF·Ground (the same cell frame.js occupies for declaring
// an interpretive boundary condition), extended with one more declared
// kind: a witness whose testimony is a coin flip BY CONSTRUCTION.
export const NULL_WITNESS = "null_witness_by_construction";
export function isNullWitness(honesty) {
  if (!HONESTY_TYPES.includes(honesty)) throw new TypeError(`isNullWitness: honesty must be one of ${HONESTY_TYPES.join(", ")}`);
  return honesty === "random";
}
