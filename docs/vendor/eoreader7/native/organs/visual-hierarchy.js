// organs/visual-hierarchy.js — visual hierarchy as GRADED EVIDENCE, not
// taste. Direct correction of this repo's own first draft (a roster of
// disagreeing design-authority archons — Tschichold/Morison, Tufte/Rams,
// Müller-Brockmann/Carson, Arnheim/Albers): real historical positions, but
// taste disagreeing with taste, never evidence. A user-supplied literature
// review (perceptual science, eye-tracking, WCAG, data-visualization
// channel rankings — each claim explicitly graded well-evidenced / moderate
// / practitioner-heuristic / illustration-only, with its own stated limits)
// is the actual foundation. This team implements ONLY the checks that
// review grades well-evidenced or moderate, tags every finding with its own
// evidence tier, and refuses to bake in the checks it grades practitioner
// lore (the F-pattern, Z-pattern, Gutenberg diagram, "three sizes maximum,"
// the grayscale test — none has primary support in the retrieved material).
//
// THIS FILE IS THE INTEGRATOR ONLY — mirroring how organs/pathos.js
// composes pacing.js/kernel-dynamics.js/experiencer.js as separate, named
// archons rather than inlining their mechanisms, this file holds no
// per-axis measurement logic of its own. Each axis is its own named
// archon module:
//   - organs/contrast.js       — WCAG (no personal handle needed: a
//                                 received legal/perceptual floor, used
//                                 verbatim, never a judgment call)
//   - organs/pop-out.js        — Handle: Wolfe (Wolfe & Horowitz 2004)
//   - organs/grouping.js       — Handle: Palmer (Gestalt common region/
//                                 proximity)
//   - organs/design-regime.js  — Handle: Müller-Brockmann vs. Carson
//                                 (the one practitioner-grade, explicitly
//                                 demoted check)
// This file's own job is composing their findings under one required
// experiencer, exactly as pathos.js composes its own archons under one.
//
// THE ONE THING THIS TEAM REFUSES TO DO, on purpose, because the
// literature review's own sharpest finding demands it: "perceived beauty
// shapes ratings of usability more reliably than it shapes actual
// performance" (Tractinsky after Kurosu & Kashimura; the ATM study found
// aesthetics shaped POST-USE PERCEPTION while actual usability differences
// did not). This team therefore has NO "does it look nice" channel at
// all, in any archon — every check here is a measured-attention or
// measured-accessibility claim, never a beauty rating, so the halo effect
// has nothing to attach to. A caller wanting an aesthetic judgment must
// ask for one explicitly, elsewhere, and must not read a clean
// visual-hierarchy report as one.
//
// EXPERIENCER REUSED UNMODIFIED (organs/experiencer.js, Panini's karaka
// grammar): a visual read "for no one in particular" is exactly the kitsch
// pathos.js already refuses. requireExperiencer's {who, read, revision}
// shape needs no visual-specific variant — `who` names the viewer and
// context ("a first-time visitor on a 375px phone in daylight"), `read`
// names the real rendered address, never "the design" unqualified.
//
// REGIME DIALS (kernel/assembly.js's own S16 discipline, reused,
// organs/regime-dial.js): the pop-out threshold and the grouping-
// tightness threshold are DECLARED by the caller as { value, giver, basis }
// — never a magic number invented here, because the literature review
// explicitly downgrades fixed numeric rules-of-thumb ("three sizes," a
// fixed pixel gap) to practitioner lore with no primary support. A caller
// who cannot name a giver and a basis for a threshold has no business
// asserting one.
//
// PURE. Takes pre-extracted element descriptors and rgb triples; a real
// DOM/CDP extractor is a separate crossing (eval/podcast-visual-hierarchy-*),
// the same split escapingScore/coherence-properties.mjs already holds
// between measurement and the network/DOM crossing that supplies its input.

import { requireExperiencer } from "./experiencer.js";
import { relativeLuminance, contrastRatio, wcagFloorFor, contrastFindings } from "./contrast.js";
import { popOutFindings } from "./pop-out.js";
import { groupingFindings } from "./grouping.js";
import { regimeFinding } from "./design-regime.js";
import { requireRegimeDial } from "./regime-dial.js";
import { EVIDENCE_TIER } from "./evidence-tier.js";

// Re-exported for callers/tests that import the shared vocabulary from the
// integrator's own module — the archon files remain the source of truth.
export { relativeLuminance, contrastRatio, wcagFloorFor, contrastFindings, popOutFindings, groupingFindings, regimeFinding, requireRegimeDial, EVIDENCE_TIER };

/**
 * visualHierarchyRead({ experiencer, elements, focalId, popOutThreshold,
 * groups, groupingMargin, regime, tokenUsage }) — the composed, graded
 * report. Requires a declared experiencer (Panini's karaka grammar,
 * unmodified) exactly as pathos.js requires one for text. No overall
 * pass/fail is computed — the report is the per-axis findings, each
 * carrying its own evidence tier, exactly the review's own table shape.
 * NEVER a beauty/aesthetic-rating field: see this file's own header for
 * why that channel is refused entirely, not merely disclaimed.
 */
export function visualHierarchyRead({ experiencer, elements, focalId, popOutThreshold, groups = [], groupingMargin, regime, tokenUsage = [] } = {}) {
  const forWhom = requireExperiencer(experiencer);
  return Object.freeze({
    schema: "EOVisualHierarchyRead@1",
    forWhom,
    contrast: contrastFindings(elements),
    popOut: popOutFindings({ elements, focalId, threshold: popOutThreshold }),
    grouping: groupingFindings({ elements, groups, threshold: groupingMargin }),
    regime: regime ? regimeFinding({ declaredRegime: regime, tokenUsage }) : null,
  });
}
