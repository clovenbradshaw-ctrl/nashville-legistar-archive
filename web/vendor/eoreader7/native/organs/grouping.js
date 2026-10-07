// organs/grouping.js — GROUPING. Handle: Palmer — after Stephen Palmer's
// Gestalt common-region/proximity work: grouping precedes hierarchy, so
// within-group spacing must read tighter than between-group spacing, or a
// reader's first-pass segmentation of the page disagrees with the
// semantic groups the author actually intended. The specific 450ms timing
// figure the source literature review cites is disclosed there as
// illustrative and under-sourced; only the SHAPE of the effect
// (proximity/common-region grouping, not that number) is used here.
//
// WELL-EVIDENCED-IN-PRINCIPLE tier. `groups`: an array of { id, memberIds }
// the CALLER declares as semantically related (e.g., one episode's
// title+date+badge+player) — this organ never guesses at grouping from
// layout alone, the same "a claim is judged against its own declared
// premises" discipline logos.js already holds. `threshold` is a REGIME
// DIAL (organs/regime-dial.js): how much tighter "within" must read than
// "nearest outside," named and sourced by the caller, never invented here.
//
// PURE.
import { requireRegimeDial } from "./regime-dial.js";
import { EVIDENCE_TIER } from "./evidence-tier.js";

/**
 * groupingFindings({ elements, groups, threshold }) — within-group gaps
 * must be smaller than the nearest between-group gap, by the declared
 * margin.
 */
export function groupingFindings({ elements, groups, threshold } = {}) {
  if (!groups || !groups.length) return []; // nothing declared as grouped — nothing to check, no threshold needed
  const dial = requireRegimeDial(threshold, "groupingMargin");
  const byId = new Map((elements ?? []).map((e) => [e.id, e]));
  // FOUND LIVE, FIXED HERE: the first cut computed only the VERTICAL
  // (top/bottom) gap, with a comment claiming "a caller measuring a
  // horizontally-flowing layout supplies rects accordingly" — aspirational,
  // never actually implementable without corrupting the rect data, and it
  // produced a genuinely wrong reading the first time this ran against a
  // real row-based layout (title/date side by side, same vertical band):
  // a NEGATIVE "gap" from measuring vertical overlap between two elements
  // that are actually separated horizontally. Real 2D edge-to-edge
  // separation: the gap on each axis is the positive distance between the
  // nearer edges (0 if the boxes overlap on that axis); if the boxes
  // overlap on BOTH axes the true result is "overlapping," reported
  // explicitly rather than as a fabricated negative number a caller could
  // silently average into something meaningless.
  const gapBetween = (a, b) => {
    if (!a || !b || !a.rect || !b.rect) return null;
    const dx = a.rect.right < b.rect.left ? b.rect.left - a.rect.right
      : b.rect.right < a.rect.left ? a.rect.left - b.rect.right
      : 0;
    const dy = a.rect.bottom < b.rect.top ? b.rect.top - a.rect.bottom
      : b.rect.bottom < a.rect.top ? a.rect.top - b.rect.bottom
      : 0;
    if (dx === 0 && dy === 0) return { overlapping: true, gap: 0 };
    // One axis overlapping means the boxes sit directly beside/above one
    // another — the real separation is the OTHER axis alone, not a
    // diagonal that would overstate it; both non-zero means true diagonal
    // separation (Pythagorean distance between the nearer corners).
    const gap = dx === 0 ? dy : dy === 0 ? dx : Math.sqrt(dx ** 2 + dy ** 2);
    return { overlapping: false, gap };
  };
  return (groups ?? []).map((g) => {
    const members = g.memberIds.map((id) => byId.get(id)).filter(Boolean);
    const withinGaps = [];
    for (let i = 0; i < members.length - 1; i += 1) {
      const r = gapBetween(members[i], members[i + 1]);
      // Two group members that literally overlap are not "gap 0, tight and
      // fine" — overlap is a layout defect this axis should surface, not
      // silently reward as maximal tightness. Named, never averaged in.
      if (r) withinGaps.push(r.overlapping ? null : r.gap);
    }
    const anyWithinOverlap = withinGaps.some((v) => v == null);
    const cleanWithin = withinGaps.filter((v) => v != null);
    const maxWithin = cleanWithin.length ? Math.max(...cleanWithin) : null;
    const outsiders = (elements ?? []).filter((e) => !g.memberIds.includes(e.id));
    const outsideGaps = outsiders.length && members.length
      ? outsiders.flatMap((o) => members.map((m) => gapBetween(m, o)).filter(Boolean))
      : [];
    const nearestOutsideGap = outsideGaps.length ? Math.min(...outsideGaps.filter((r) => !r.overlapping).map((r) => r.gap)) : null;
    const clears = anyWithinOverlap || maxWithin == null || nearestOutsideGap == null
      ? null // a genuine measurement gap (or an overlap defect), never a guessed pass
      : nearestOutsideGap - maxWithin >= dial.value;
    return {
      tier: EVIDENCE_TIER.WELL_EVIDENCED_IN_PRINCIPLE,
      giver: "Palmer common region / proximity, via Gestalt grouping — the specific timing figure in the source review is disclosed as illustrative and under-sourced; only the grouping-precedes-hierarchy shape is used here",
      thresholdGiver: dial.giver,
      thresholdBasis: dial.basis,
      groupId: g.id,
      overlap: anyWithinOverlap,
      maxWithinGap: maxWithin,
      nearestOutsideGap,
      clears,
    };
  });
}
