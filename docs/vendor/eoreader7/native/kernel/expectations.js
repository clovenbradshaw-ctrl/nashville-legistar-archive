/* Bharata speaks:
 * “The  statement  of  the  Ndtyagdstra  is  simple.  Sentiment  is  pro- 
duced from  the  union  of  the  determinants  (vibhdva),  the  conse- 
quents (anubhdva),  and  the  transitory  feelings  {vyabhicdrin).”
 *
 * This file implements the Bharata's  approach to expectations, as defined in the Natyashastra's rasa theory.  I believe this framework, while insightful, can sometimes fall into a trap of rigid emotional scaffolding.  The file should instead strive for nuanced understanding of expectations, acknowledging their fluidity and the complexities of human experience.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Bharata — after the Natyashastra's rasa theory: an expectation is built, strengthened, weakened, and released like a staged emotion. Amendment XVII.

import { eoOperation } from "./fold.js";

export const EXPECTATION_STATES = Object.freeze(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);

export function expectation({ id, hypothesis, giver, grounds = [], openedAt = null, scope = null, consequences = [], state = "open" }) {
  if (!id) throw new TypeError("Expectation requires id");
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  return Object.freeze({ schema: "EOExpectation@1", id, hypothesis, giver, grounds: Object.freeze([...grounds]), openedAt, scope, consequences: Object.freeze([...consequences]), state });
}

export function expectationTransition(current, state, { witness, consequence = null, grain = "Figure", reframes = null } = {}) {
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  const op = state === "reframed" || reframes ? "REC" : "EVA";
  return eoOperation({ op, grain, witness, inputs: [current.id], outputs: [current.id], consequence, payload: { action: "expectation", value: { ...current, state, ...(reframes ? { reframes } : {}) } } });
}

// Mirror of obligations.js's openObligation, for symmetry: opening an
// expectation is INS (a new anticipated structure enters the fold);
// transitions stay expectationTransition's own EVA/REC.
export function openExpectation(value, { witness, grain = "Figure", op = "INS", consequence = null } = {}) {
  return eoOperation({ op, grain, witness, inputs: [...(value.grounds ?? [])], outputs: [value.id], consequence, payload: { action: "expectation", value } });
}
