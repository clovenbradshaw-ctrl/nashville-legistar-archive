// organs/contrast.js — CONTRAST: the one visual-hierarchy archon with no
// personal handle, because none is needed or honest — the floor is a
// received standard (W3C WCAG 2.2, Understanding Success Criterion 1.4.3),
// used verbatim, exactly the discipline priors.js already holds for every
// received closed class: a number with a real giver is used as-is, never
// re-derived or softened into a "recommendation."
//
// WELL-EVIDENCED tier, the top of the literature review's own confidence
// table: this is a hard legal/perceptual floor (contrast-sensitivity loss
// with age; luminance-based so it also serves color-vision deficiency),
// never a judgment call. A caller wanting a "does this look nice" read
// will not find one here — see organs/visual-hierarchy.js's own header for
// why that channel is refused everywhere in this team, not only here.
//
// PURE.

/** relativeLuminance([r,g,b]) — WCAG's own formula, 0..255 channels. */
export function relativeLuminance([r, g, b]) {
  const chan = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [chan(r), chan(g), chan(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** contrastRatio(rgb1, rgb2) — WCAG's (L1+0.05)/(L2+0.05), L1 the lighter. */
export function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * wcagFloorFor({fontSizePx, bold}) — 3:1 for "large text" (WCAG: >=24px
 * regular, or >=18.66px [14pt] bold), else 4.5:1. The floor and the size
 * cutoffs are W3C's own definition, used verbatim.
 */
export function wcagFloorFor({ fontSizePx, bold = false }) {
  const large = fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
  return large ? 3.0 : 4.5;
}

import { EVIDENCE_TIER } from "./evidence-tier.js";

/**
 * contrastFindings(elements) — elements: [{ id, fontSizePx, bold, color:
 * [r,g,b], backgroundColor: [r,g,b] }]. Every finding is a hard W3C floor.
 */
// SUCCESS CRITERION 1.4.3 IS SCOPED TO TEXT. Found live (podcast-pathos-
// repair-loop.mjs, 2026-09-30): a decorative element with no rendered text
// at all (an .ethos-badge status dot) was checked for "text contrast"
// against its own fill color — a category error, not a stricter check;
// there is no text there for a reader to fail to read. The mechanical
// repair strategy then spent 80+ cycles "fixing" a violation that was
// never in WCAG 1.4.3's scope to begin with, and made the TOTAL failure
// count go UP, not down. An element whose caller supplies `text: ""`
// (extractElements' own real, always-populated field) is declaring
// exactly this — no rendered text, out of scope, never a false violation.
// An element with NO `text` field at all (an older caller, or a test
// fixture predating this field) is UNCHANGED: `undefined !== ""`, so
// nothing here is skipped for it — this fix costs no existing caller
// anything.
export function contrastFindings(elements) {
  return (elements ?? []).filter((el) => el.text !== "").map((el) => {
    const ratio = contrastRatio(el.color, el.backgroundColor);
    const floor = wcagFloorFor(el);
    return {
      tier: EVIDENCE_TIER.WELL_EVIDENCED,
      giver: "W3C WCAG 2.2, Understanding Success Criterion 1.4.3",
      id: el.id,
      ratio: Math.round(ratio * 100) / 100,
      floor,
      clears: ratio >= floor,
    };
  });
}
