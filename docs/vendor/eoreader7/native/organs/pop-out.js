// organs/pop-out.js — POP-OUT. Handle: Wolfe — after Jeremy Wolfe (Wolfe &
// Horowitz 2004): pop-out is a CONTINUUM governed by target-distractor
// DIFFERENCE, not a fixed tier count. "If everything is contrasted,
// nothing stands out" is the mechanical fact this computes — a pairwise
// difference between a DECLARED focal element and its context, never a
// variance-of-the-whole-page statistic. (This team's own first cut
// borrowed organs/pacing.js's sentence-length-variance formula for this
// phenomenon; that was the wrong statistic — pop-out is about a target
// standing out from distractors, not about a series varying over time.)
//
// WELL-EVIDENCED tier. The threshold for "how much difference counts as
// real pop-out" is a REGIME DIAL (organs/regime-dial.js) — this file
// invents no number of its own, because the literature review explicitly
// downgrades fixed numeric practitioner rules-of-thumb to the bottom of
// its own confidence table.
//
// PURE.
import { relativeLuminance } from "./contrast.js";
import { requireRegimeDial } from "./regime-dial.js";
import { EVIDENCE_TIER } from "./evidence-tier.js";

/**
 * popOutFindings({ elements, focalId, threshold }) — a pairwise contrast
 * between the DECLARED focal element and every other visible element:
 * normalized differences in size, luminance, and hue-independent color
 * distance, combined as a Euclidean norm over the three normalized
 * channels.
 */
export function popOutFindings({ elements, focalId, threshold } = {}) {
  const dial = requireRegimeDial(threshold, "popOutThreshold");
  const all = elements ?? [];
  const focal = all.find((e) => e.id === focalId);
  if (!focal) throw new TypeError(`visual-hierarchy: popOutFindings requires the declared focal element "${focalId}" to be present among the measured elements`);
  const others = all.filter((e) => e.id !== focalId);
  const sizeOf = (e) => e.areaPx ?? e.fontSizePx ?? 0;
  const maxSize = Math.max(sizeOf(focal), ...others.map(sizeOf), 1);
  const findings = others.map((e) => {
    const sizeDiff = Math.abs(sizeOf(focal) - sizeOf(e)) / maxSize;
    const lumDiff = Math.abs(relativeLuminance(focal.color) - relativeLuminance(e.color));
    const rgbDist = Math.sqrt(focal.color.reduce((s, c, i) => s + (c - e.color[i]) ** 2, 0)) / (255 * Math.sqrt(3));
    const difference = Math.sqrt(sizeDiff ** 2 + lumDiff ** 2 + rgbDist ** 2) / Math.sqrt(3);
    return { id: e.id, difference: Math.round(difference * 1000) / 1000 };
  });
  const minDifference = findings.length ? Math.min(...findings.map((f) => f.difference)) : null;
  return {
    tier: EVIDENCE_TIER.WELL_EVIDENCED,
    giver: "Wolfe & Horowitz 2004 — pop-out scales with target-distractor difference; 'if everything is contrasted, nothing stands out'",
    thresholdGiver: dial.giver,
    thresholdBasis: dial.basis,
    focalId,
    minDifference,
    // "Emphasizing everything emphasizes nothing" is the FLATLINE reading:
    // pop-out requires the focal element to differ from EVERY neighbor by
    // at least the declared threshold, not merely on average.
    flatline: minDifference !== null && minDifference < dial.value,
    perNeighbor: findings,
  };
}
