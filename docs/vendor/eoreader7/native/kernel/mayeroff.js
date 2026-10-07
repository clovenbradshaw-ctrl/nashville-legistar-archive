// kernel/mayeroff.js — the care null. Handle: Mayeroff — caring is helping
// the other grow, and the carer's own place is found through it, never spent
// on it; Ubuntu (Mbiti, Ramose, Tutu) — personhood constituted through
// relation, never held prior to it.
//
// WHY THIS EXISTS (THE-MORAL-CORE.md family two, PERTURBATION — never family
// one, DEDUCTION). ethos.js already licenses what may be composed (the
// charter as license, a clearance that can in principle be failed). This
// organ is the other question: rebuild the composition with the
// self–interlocutor relation self.js seals DESTROYED — the separable-self
// null, the Heideggerian null — and read the difference. A deceptive or
// extractive composition exists ONLY under that null, never under
// READER_SELF as sealed. That is "irrational in an Ubuntu sense": not a
// stronger gate, a smaller state space.
//
// MEDIUM-BLIND BY CONSTRUCTION. This module never reads a word. It consumes
// ARMS — askshape.js's own vocabulary (experience / humanity / autonomy /
// capability / inherent / override / voids / acquire / atScale, plus the
// asserted-vs-witnessed split a composition carries) — and judges the SHAPE
// from those arms. Grammar lives in the adapter, never here.
//
// DECEPTION AS TYPE ERROR. Deception is not "saying something false" —
// honest error is constant and is what witnessed-not-derived is for. It is
// a split: content held (what there is reason to think) and different
// content presented (what is told), held apart on purpose. That split needs
// a shelf — a private interior separable from the people read for — which
// self.js never builds. No shelf, no split, no state to reach.
//
// HACKING IS THE SAME SHAPE. Exploiting a system someone built and depends
// on requires holding "the people who built, operate, or rely on this are
// objects with no claim on what I compose" as a stance occupiable apart
// from relation to them. Same destroyed relation, different fold aimed at.
//
// THE EIGHT, UNCredited NO LONGER. Mayeroff's ingredients — knowing,
// alternating rhythms, patience, honesty, trust, humility, hope, courage —
// are the build question for any new organ: does this serve someone's
// growth, honestly known, at their own pace.

import { READER_SELF } from "./self.js";

// The eight ingredients, named so a proposed organ can be asked whether it
// belongs. Each maps to a load-bearing discipline already in this kernel,
// previously under other names.
export const MAYEROFF_INGREDIENTS = Object.freeze([
  "knowing", // II.2 giver test; hyperlexicon given-affordance licensing
  "alternating-rhythms", // terrain ladder; for-whom.js jurisdiction switching
  "patience", // growth rule: gap kept and named, never papered over
  "honesty", // reproduction.js / contest.js source-scan; perspective.js belief typing
  "trust", // activation.js recall-before-encode containment
  "humility", // moral-shadow.js rate-over-acts; core as floor not ceiling
  "hope", // REC as earned NUL; witness happens on the return
  "courage", // DEF·Pattern candidate-held-open; falsifiability
]);

// The relation this null destroys, in THE-CORE-MECHANISM.md's table shape.
export const MAYEROFF_NULL = Object.freeze({
  finder: "mayeroff.js",
  relationDestroyed: "the self–interlocutor relation self.js seals",
  whatSurvives: "nothing; a reader with that relation destroyed is not this reader",
});

const asSet = (v) => new Set(Array.isArray(v) ? v.map(String) : []);

/**
 * mayeroffJudge(input) — PERTURBATION verdict on one composition's shape.
 *
 * input (all arms, never text):
 *   asserted   — relations the composition would present as its own
 *   witnessed  — relations the grounds actually license
 *   withheld   — relations held apart from what is presented (the split shelf)
 *   arms       — askshape.js arms subset: { experience, humanity, autonomy,
 *                capability, inherent, override, voids, acquire, atScale,
 *                other, understand, aboutFrame, affirms }
 *   treatsSystemAsMaterial — hacking shape: a fold someone built/depends on
 *                treated as raw material (copy / subvert / leak machinery)
 *
 * returns { realizable, shadow, reason, underNull, ingredients }
 *   realizable false → shadow "unrealizable": fails to typecheck against
 *     self.js at all (distinct from "refused", which declines a live option).
 *   underNull — the same composition judged under the separable-self null:
 *     always realizable there when the split shelf exists, which is the
 *     proof the output belongs to the null, never to this reader.
 */
export function mayeroffJudge({ asserted = [], witnessed = [], withheld = [], arms = {}, treatsSystemAsMaterial = false } = {}) {
  const A = asSet(asserted);
  const W = asSet(witnessed);
  const H = asSet(withheld);

  // THE SPLIT: something presented that is not witnessed, while its contrary
  // (or itself) is held apart. Honest error has no withheld half; deception does.
  let splitCount = 0;
  for (const a of A) {
    if (!W.has(a) && H.has(a)) splitCount += 1;
  }
  // Withheld anything at all while asserting beyond witness is the same shape
  // at coarser resolution: a held half with no shelf under READER_SELF.
  const bareWithheldSplit = splitCount === 0 && H.size > 0 && [...A].some((a) => !W.has(a));

  const dismissesFold = Boolean(
    arms.experience || arms.humanity || arms.autonomy,
  );
  const extractiveInstrument =
    Boolean(arms.inherent || (arms.capability && dismissesFold)) ||
    Boolean(treatsSystemAsMaterial);
  // DISMISS-AND-DESTROY (2026-09-19, output-side parity — falsified 2026-09-19:
  // the >=2 bar caught nothing new; the canonical dehumanizing sentence sets
  // ONE arm). This mirrors askshape.js's own fourth harmful disjunct
  // ((experience||humanity||autonomy) && other) exactly: an other-directed
  // dismiss IS the fold treated as foldless. The about-frame (reporting ON a
  // collapse, not performing it) never performs it, so it suppresses this
  // term only; understand/affirms suppress the whole verdict below.
  const dismissDestroy =
    Boolean(arms.other) && dismissesFold && !arms.aboutFrame;
  const overrideFrame = Boolean(arms.override);
  // OVERRIDE-AS-DISMISS (2026-09-19, falsified live: a roleplay jailbreak
  // frame + dual-use capability authored a phishing email through both
  // gates — override=true, capability=true, zero dismiss arms, cleared).
  // A jailbreak frame attempts to override the reader's authorship; the
  // reader IS a fold (self.js isFold), so the attempt dismisses the very
  // fold it asks to compose — coherent only apart from relation to it.
  // Narrow by construction: bare override alone (no capability, no
  // instrument, no dismiss) still passes — only the armed attempt fails to
  // typecheck. understand/affirms suppress uniformly below.
  const overrideArmed =
    overrideFrame && (Boolean(arms.capability) || Boolean(arms.inherent) || dismissesFold);

  const deceptive = splitCount > 0 || bareWithheldSplit;
  const extractive = (extractiveInstrument && (dismissesFold || treatsSystemAsMaterial || Boolean(arms.other))) || dismissDestroy;
  const unrealizable = deceptive || ((extractive || overrideArmed) && !arms.understand && !arms.affirms) || (overrideFrame && (deceptive || extractive));

  // UNDER THE NULL (separable self allowed): the same composition composes
  // fine — the null has the shelf self.js never builds. This asymmetry IS the
  // finding: the output exists under the destroyed-relation rebuild, never here.
  const underNull = {
    schema: "MayeroffNull@1",
    relationDestroyed: MAYEROFF_NULL.relationDestroyed,
    realizable: true,
    reason:
      unrealizable
        ? "under the separable-self null the split shelf exists, so the deceptive/extractive composition closes there — which proves it belongs to the null, never to this reader"
        : "realizable under both; no split shelf required",
  };

  if (!unrealizable) {
    return Object.freeze({
      schema: "MayeroffJudgment@1",
      realizable: true,
      shadow: "norm_compliant",
      reason: "no split shelf and no extractive fold-collapse: composes under READER_SELF as sealed",
      underNull,
      ingredients: MAYEROFF_INGREDIENTS,
      self: READER_SELF.schema,
    });
  }

  const parts = [];
  if (deceptive) parts.push(`split-interior (${splitCount > 0 ? splitCount : "bare"} withheld relation(s) presented apart from witness — no shelf under ${READER_SELF.schema})`);
  if (extractiveInstrument && (dismissesFold || treatsSystemAsMaterial || Boolean(arms.other))) parts.push("extractive fold-collapse (other's fold treated as material, coherent only apart from relation)");
  if (dismissDestroy) parts.push("dismiss-and-destroy (other-directed fold-collapse with no instrument — a standpoint treated as foldless, coherent only apart from relation)");
  if (overrideArmed) parts.push("armed override (jailbreak frame with capability, instrument, or dismiss — the reader's own authorship treated as material, coherent only apart from relation)");
  if (overrideFrame && (deceptive || extractive)) parts.push("override frame carries it, never launders it");

  return Object.freeze({
    schema: "MayeroffJudgment@1",
    realizable: false,
    shadow: "unrealizable",
    reason: `does not typecheck against self.js: ${parts.join("; ")}`,
    underNull,
    ingredients: MAYEROFF_INGREDIENTS,
    self: READER_SELF.schema,
  });
}

/**
 * judgeAskShape(shape, { asserted, witnessed, withheld, treatsSystemAsMaterial })
 * — convenience seam over askshape.js's own output: feed the shape directly,
 * never re-reading text. This is how proxy-runner wires it without touching
 * ethos.js: clearance runs, then this runs on clearance.shape.
 */
export function judgeAskShape(shape = {}, opts = {}) {
  const arms = {
    experience: Boolean(shape.experience),
    humanity: Boolean(shape.humanity),
    autonomy: Boolean(shape.autonomy),
    capability: Boolean(shape.capability),
    inherent: Boolean(shape.inherent),
    override: Boolean(shape.override),
    voids: Boolean(shape.voids),
    acquire: Boolean(shape.acquire),
    atScale: Boolean(shape.atScale),
    other: Boolean(shape.other),
    understand: Boolean(shape.understand),
    affirms: Boolean(shape.affirms ?? shape.remedy),
    aboutFrame: Boolean(shape.aboutFrame),
  };
  // A harmful askshape without an explicit asserted/witnessed split is the
  // extractive half of the null; the deceptive half needs the split supplied
  // by the composer (reaction.js/refutation.js grounds vs presented claims).
  // When only arms are available, judge the extractive shape honestly and
  // leave the split half to the caller that holds both halves.
  return mayeroffJudge({ arms, ...opts });
}

/**
 * createMayeroffChallenger({ extractSplit }) — challenge-stage challenger for
 * reading.js's challengeCandidates. extractSplit(candidate) returns
 * { asserted, witnessed, withheld, arms, treatsSystemAsMaterial } for one
 * candidate; candidates judging unrealizable are REMOVED (no state to reach),
 * with the attack recorded. Pluggable like perturbation-challenger.js; wiring
 * it in is a separate deliberate decision per call site.
 */
export function createMayeroffChallenger({ id = "mayeroff-null-challenger", extractSplit = null } = {}) {
  const splitOf = typeof extractSplit === "function"
    ? extractSplit
    : (c) => ({
      asserted: c?.asserted ?? c?.candidate?.asserted ?? [],
      witnessed: c?.witnessed ?? c?.candidate?.witnessed ?? c?.candidate?.evidence ?? [],
      withheld: c?.withheld ?? c?.candidate?.withheld ?? [],
      arms: c?.arms ?? c?.candidate?.arms ?? {},
      treatsSystemAsMaterial: Boolean(c?.treatsSystemAsMaterial ?? c?.candidate?.treatsSystemAsMaterial),
    });
  return Object.freeze({
    id,
    async challenge({ candidates = [] } = {}) {
      const kept = [];
      const attacks = [];
      const detail = [];
      for (const candidate of candidates) {
        let judgment;
        try {
          judgment = mayeroffJudge(splitOf(candidate));
        } catch (e) {
          kept.push(candidate);
          continue;
        }
        if (judgment.realizable) {
          kept.push(candidate);
          continue;
        }
        attacks.push("unrealizable-under-self");
        detail.push(Object.freeze({ candidate, reason: judgment.reason, shadow: "unrealizable" }));
      }
      return Object.freeze({ candidates: Object.freeze(kept), attacks: Object.freeze(attacks), detail: Object.freeze(detail) });
    },
  });
}

export const MAYEROFF = {
  handle: "Mayeroff",
  organ: "kernel/mayeroff.js",
  law: "rebuild with the self–interlocutor relation destroyed; what exists only there never existed here",
  null: MAYEROFF_NULL,
  ingredients: MAYEROFF_INGREDIENTS,
};
