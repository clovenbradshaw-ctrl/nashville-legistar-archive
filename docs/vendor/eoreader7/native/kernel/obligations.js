/* Jaimini speaks:
 * “Dliarma or Duty is that wliicli, being desirable, is 
indicated (or tanght) by Vedic injunction.”
 *
 * This file implements Jaimini's understanding of obligation, derived from the Mimamsa Sutras.  It demonstrates that the injunction of a scriptural text carries a lasting obligation.  While the principle is sound, the implementation here relies on a strict adherence to the text, potentially neglecting the nuance of 'obligation' in the broader context of the world.
 *
 * — the engineering record below, kept whole —
 */
// Handle: Jaimini — after Mimamsa's vidhi: a scriptural injunction opens a standing obligation that persists until the enjoined act discharges it. Amendment XVII.

import { eoOperation } from "./fold.js";

export function obligation({ id, distinction, grounds = [], alternatives = [], consequences = [], openedAt = null, persistence = 0, status = "open" }) {
  if (!id) throw new TypeError("Obligation requires id");
  return Object.freeze({ schema: "EOObligation@1", id, distinction, grounds: Object.freeze([...grounds]), alternatives: Object.freeze([...alternatives]), consequences: Object.freeze([...consequences]), openedAt, persistence, status, resolutionRefs: Object.freeze([]) });
}

export function openObligation(value, { witness, grain = "Figure", op = "DEF" } = {}) {
  return eoOperation({ op, grain, witness, inputs: [...(value.grounds ?? [])], outputs: [value.id], consequence: value.consequences ?? null, payload: { action: "obligation", value: { ...value, status: value.status ?? "open" } } });
}

export function resolveObligation(id, { witness, status = "resolved", grain = "Figure", op = "DEF", consequence = null } = {}) {
  return eoOperation({ op, grain, witness, inputs: [id], outputs: [id], consequence, payload: { action: "resolve-obligation", id, status } });
}

export function carryObligations(fold) {
  return (fold?.obligations ?? []).map((item) => ["resolved", "closed", "superseded"].includes(item.status) ? item : { ...item, persistence: (item.persistence ?? 0) + 1 });
}
