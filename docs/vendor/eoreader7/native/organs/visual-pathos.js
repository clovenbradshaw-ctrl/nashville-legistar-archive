// organs/visual-pathos.js — the visual medium's PATHOS, composed the way
// THE-THEORY-OF-PATHOS.md (native/docs/) says any medium must: not four
// parallel findings, but rhythm + strain + curve, under a required
// experiencer, folded through the SAME priority ladder organs/pathos.js
// already uses for text — `reGroundCondition`/`strainOf` are imported and
// run UNMODIFIED here, never re-derived, which is the actual proof this
// theory transfers rather than merely resembles.
//
// THE CORRECTION THIS FILE MAKES, over organs/visual-hierarchy.js's own
// first cut (see that file's header, and THE-THEORY-OF-PATHOS.md's own
// self-test section for the full account):
//
//   contrast (WCAG)     — NOT pathos. A hard existence-level gate on
//                          whether this reading may be perceived by this
//                          class of experiencer at all — ethos's station,
//                          not pathos's. Reported here alongside the
//                          composed verdict, disclosed, but never folded
//                          into rhythm/strain/curve or the re-ground ladder.
//   pop-out (Wolfe)     — RHYTHM. The structural (pairwise, no-reading-
//                          order) sub-shape: a flatline reads exactly as
//                          Murch's boredom does for text.
//   grouping (Palmer)   — STRAIN, a local/implicit claim: proximity
//                          asserts "these belong together"; a violation
//                          (an outsider sits closer than the group's own
//                          spread) is a self-contradicting claim.
//   design-regime       — STRAIN, a global/declared claim: the artifact's
//   (Müller-Brockmann/     own DECLARED regime, contradicted by its own
//   Carson)                actual token usage — logos's exact discipline
//                          ("a claim is judged against its own premises"),
//                          independently arrived at in design-regime.js's
//                          own header before this file connected the two.
//   curve               — an HONEST, NAMED GAP. No incremental, fold-
//                          producing reader exists yet for "a UI
//                          encountered over an interaction sequence" the
//                          way native/kernel/reading.js exists for text —
//                          reported exactly as pathos.js itself reports an
//                          unsupplied fold (`measured: false`), never
//                          silently defaulted toward ground_holds.
//
// PURE. Composes the other archon organs' pure findings; imports
// `strainOf`/`reGroundCondition` from ./pathos.js rather than duplicating
// their logic — a second copy of a priority ladder is exactly the drift
// class this repo's own postmortems keep catching (P22, P24, P39).

import { requireExperiencer } from "./experiencer.js";
import { contrastFindings } from "./contrast.js";
import { popOutFindings } from "./pop-out.js";
import { groupingFindings } from "./grouping.js";
import { regimeFinding } from "./design-regime.js";
import { strainOf, reGroundCondition } from "./pathos.js";

/**
 * visualStrainState({ elements, groups, groupingMargin, regime, tokenUsage })
 * → { contested, contradictions, cycles, expired } — pathos.js::strainOf's
 * own required input shape, folded from grouping's local violations and
 * design-regime's global ones. Neither extractor here produces a genuine
 * graph CYCLE (logos's own pathology — a support cycle, begging the
 * question) — both are real, but they are CONTRADICTIONS (a claim refuted
 * by counter-evidence), never cycles, so `cycles` stays 0 unless a future
 * extractor finds an actual circular visual claim (e.g., two elements each
 * individually asserting greater salience than the other — named, not
 * built here).
 */
export function visualStrainState({ elements, groups = [], groupingMargin, regime = null, tokenUsage = [] } = {}) {
  const contradictions = [];
  const groupFindings = groups.length ? groupingFindings({ elements, groups, threshold: groupingMargin }) : [];
  for (const g of groupFindings) {
    if (g.clears === false) {
      contradictions.push({
        kind: "grouping",
        groupId: g.groupId,
        detail: `group "${g.groupId}"'s own members sit farther apart (${g.maxWithinGap}px) than its nearest outsider (${g.nearestOutsideGap}px) — the declared grouping claim is contradicted by the actual layout`,
      });
    }
  }
  if (regime) {
    const r = regimeFinding({ declaredRegime: regime, tokenUsage });
    if (r.contested) {
      for (const role of r.inconsistentRoles) {
        contradictions.push({
          kind: "regime",
          role: role.role,
          detail: `declared regime "${regime}" is contradicted by inconsistent usage for role "${role.role}": ${JSON.stringify(role.values)}`,
        });
      }
    }
  }
  return { contested: [], contradictions, cycles: 0, expired: [] };
}

/**
 * visualPathosOf({ experiencer, elements, focalId, popOutThreshold, groups,
 * groupingMargin, regime, tokenUsage }) → { forWhom, contrast, read,
 * condition } — `read` is a real EOPathosRead@1 (the same schema
 * organs/pathos.js produces for text) and `condition` is the SAME
 * `reGroundCondition` function's own verdict, run unmodified on it:
 * ground_holds | stale | collapse | contested. `contrast` rides alongside,
 * disclosed, never folded into the ladder — see this file's own header.
 */
export function visualPathosOf({ experiencer, elements, focalId, popOutThreshold, groups = [], groupingMargin, regime = null, tokenUsage = [] } = {}) {
  const forWhom = requireExperiencer(experiencer);
  const contrast = contrastFindings(elements);
  const popOut = popOutFindings({ elements, focalId, threshold: popOutThreshold });
  const strainState = visualStrainState({ elements, groups, groupingMargin, regime, tokenUsage });
  const strain = strainOf(strainState);
  const read = Object.freeze({
    schema: "EOPathosRead@1",
    forWhom,
    rhythm: Object.freeze({
      flatline: popOut.flatline,
      ratio: popOut.minDifference ?? 0,
      mean: 0,
      blinks: 0,
      n: popOut.perNeighbor.length,
    }),
    curve: Object.freeze({
      schema: "EOPathosCurve@1",
      measured: false,
      surprise: null,
      tension: null,
      release: null,
      unmeasured: "no incremental visual reader exists yet — a UI's own interaction sequence has no fold-producing engine in this codebase (see native/docs/THE-THEORY-OF-PATHOS.md, slot 4)",
    }),
    strain,
  });
  return Object.freeze({
    schema: "EOVisualPathosRead@1",
    forWhom,
    contrast,
    popOut,
    strainState: Object.freeze(strainState),
    read,
    condition: reGroundCondition(read),
  });
}
