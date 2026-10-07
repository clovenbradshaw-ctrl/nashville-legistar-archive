// native/adapters/text/accessibility.js — natural language's reading of the
// return curve: Accessibility Theory (Ariel), referential distance (Givon).
//
// The kernel half (kernel/return-curve.js) measures how identity returns in
// ANY medium; this file is the NL-specific organ that (a) names prose's own
// return forms — pronoun, name, definite descriptor — and (b) reads the
// measured curve as a memory design: the high-accessibility form's majority
// window is the writer's ACTIVATION clock, and the top-form share at
// extreme gaps is the writer's reliance on undecaying IDENTITY.
//
// PRIOR THEN MATERIAL (the user's own rule, and S13's): a reading starts
// from a genre-level curve if one is supplied (a prior, giver named) and is
// superseded by the material's own curve once it holds more returns than
// the prior — the supersession is REPORTED, never silent. Nothing here
// invokes an organ: mention streams arrive as data from the organs that
// own them (cast surfaces, anchoring evidence, pronoun bindings), so this
// stays pure and Node-testable.

import { returnCurve } from "../../kernel/return-curve.js";
import { gammaFor } from "../../kernel/activation.js";

export const NL_FORMS = Object.freeze({
  high: "pronoun",        // Ariel: high-accessibility marker — assumed ACTIVE
  mid: "descriptor",      // intermediate — assumed lapsed but re-groundable
  low: "name",            // low — full retrieval from identity
});

/** Mentions -> kernel events. A mention: {ref, order, form}. */
export const mentionEvents = (mentions = []) =>
  mentions.map((m) => ({ key: m.ref, at: m.order, form: m.form }));

/**
 * writerDecay(mentions, { prior }) — the material's own memory design, with
 * an optional genre prior it supersedes.
 *
 * Returns { curve, activationWindow, gamma, identityShareAtExtreme, basis,
 * prior } where basis names which level answered (material | prior) and the
 * evidence for each.
 */
export function writerDecay(mentions = [], { prior = null } = {}) {
  const curve = returnCurve(mentionEvents(mentions));
  const material = {
    activationWindow: curve.majorityWindow[NL_FORMS.high] ?? null,
    returns: curve.returns,
  };
  const priorReturns = prior?.curve?.returns ?? 0;
  const usePrior = prior != null && priorReturns > curve.returns;
  const chosen = usePrior
    ? { activationWindow: prior.activationWindow ?? null, basis: `prior (${prior.giver ?? "unnamed"}): ${priorReturns} returns vs the material's ${curve.returns}` }
    : { activationWindow: material.activationWindow, basis: prior ? `material: ${curve.returns} returns supersede the prior's ${priorReturns}` : "material (no prior supplied)" };

  const last = curve.bins[curve.bins.length - 1] ?? null;
  return Object.freeze({
    schema: "EOWriterDecay@1",
    curve,
    activationWindow: chosen.activationWindow,
    gamma: chosen.activationWindow != null && chosen.activationWindow > 1 ? gammaFor(chosen.activationWindow) : null,
    identityShareAtExtreme: last ? (last.shares[NL_FORMS.low] ?? 0) : null,
    basis: chosen.basis,
    prior: prior ? Object.freeze({ giver: prior.giver ?? null, activationWindow: prior.activationWindow ?? null, returns: priorReturns }) : null,
  });
}
