// block-extract.mjs — THE EXTRACTOR (Link · Structure·Figure).
//
// Fold invariant: EVERY ROW CARRIES ITS BYTE ADDRESS AND ITS BASIS, AND THE
// SAME LAYER IN, THE SAME ROWS OUT. The extractor reads a retained text layer
// and emits byte-anchored rows mechanically — line-segmented with real spans
// into the layer, page-bridged through the pagemap, keeping lines that carry
// a goal/action verb, a quantity, a named agency, or a known place. Nothing
// here guesses; a model may later PROPOSE rows, but a proposal is never a
// surfaced row until its span resolves verbatim AND a reviewer flags it.
import { extractPlanRows } from "../../organs/plans/extract.mjs";

export const LINK_SCHEMA = "PlanLedgerObservation@1";

function pageFor(pagemap, byteStart) {
  for (const pg of pagemap) if (byteStart >= pg.byteStart && byteStart < pg.byteEnd) return pg.page;
  return pagemap.length;
}

/**
 * extractLinks({ text, doc, mode, pagemap, cap, vocab }) -> links[]
 * `doc` is the link's FULL retained path (e.g. "nashville/ground/x.txt" or
 * "inst/a.txt") — the address the gate resolves against the ground. The
 * underlying organ's instance-shaped id/doc are replaced with the block's
 * domain-neutral forms. Deterministic: same layer in, same rows out.
 * `vocab` (optional) is the discovery dialogue's limited schema — when
 * present its agencies/places/quantities/goals REPLACE the extractor's
 * received defaults, so the vocabulary is discovered, not model-authored.
 */
export function extractLinks({ text, doc, mode = "layout", pagemap = null, cap = 3500, vocab = null }) {
  const rows = extractPlanRows({ text, doc, mode, vocab });
  const links = rows
    .map((r, i) => ({ ...r, id: `surface:${doc}:row:${String(i + 1).padStart(4, "0")}`, doc }))
    .map((r) => ({ ...r, page: pagemap ? pageFor(pagemap, r.at[0]) : null }))
    .filter((r, idx, arr) => arr.findIndex((x) => x.verbatim === r.verbatim) === idx);
  const priority = { goal: 0, number: 1, name: 2, place: 3 };
  links.sort((a, b) => (priority[a.kind] ?? 4) - (priority[b.kind] ?? 4) || a.at[0] - b.at[0]);
  return cap ? links.slice(0, cap) : links;
}

/** ref of a link — the address the gate resolves verbatim. */
export const linkRef = (l) => `${l.doc}#${l.at[0]}-${l.at[1]}`;