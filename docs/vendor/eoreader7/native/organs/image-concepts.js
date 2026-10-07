// image-concepts.js — "image content needs to be turned into concepts in
// the holograph, folded, reasoned over." A raster screenshot's own visual
// facts do not reach the ledger as a bare boolean in a JS object (this
// file's own earlier draft did exactly that, and was corrected mid-task) —
// they land the SAME way every other medium in this project lands a fact:
// one `hear()` call per sighting, on the SAME kernel/notes.js ledger,
// addressed, witnessed, foldable, and reasonable-over by the SAME organs
// (kind-induction, DMD) every other entity in this repo already uses.
//
// THE ADDRESS, for a raster medium. P5.2 (text) says an address must
// re-slice to the bytes it names. There is no automated re-slice check for
// a screenshot region in this pipeline (no CV wired to it) — so the
// honest raster analogue is a STRUCTURALLY well-formed region (normalized
// 0..1 coordinates, non-degenerate) that was VERIFIED BY DIRECT VISUAL
// INSPECTION of the cropped area before the note was ever landed, and the
// method is disclosed on every note (`method: "direct-visual-inspection"`)
// rather than implied to be mechanical. This is the same posture Girard's
// own REFERENCE_OBSERVATIONS took, generalized: the CLAIM is now addressed
// and foldable instead of sitting outside the ledger as a bare boolean.
//
// PURE. Builds hear()-ready arrangement objects; the caller owns the
// actual `notes.hear(log, ...)` crossing (this file writes nothing).

const REGION_RE = /^\d+(\.\d+)?,\d+(\.\d+)?-\d+(\.\d+)?,\d+(\.\d+)?$/;

/** regionAddress({imagePath, x0, y0, x1, y1}) -> "<imagePath>#x0,y0-x1,y1"
 * (normalized 0..1 coordinates). Refuses a degenerate or out-of-bounds
 * region — the same "an address that could never resolve to real content
 * is refused at the door" discipline P5.2 already holds for byte ranges. */
export function regionAddress({ imagePath, x0, y0, x1, y1 }) {
  if (typeof imagePath !== "string" || !imagePath) throw new TypeError("regionAddress requires imagePath");
  for (const [name, v] of [["x0", x0], ["y0", y0], ["x1", x1], ["y1", y1]]) {
    if (typeof v !== "number" || v < 0 || v > 1 || Number.isNaN(v)) throw new RangeError(`regionAddress: ${name} must be a number in [0,1], got ${v}`);
  }
  if (x1 <= x0 || y1 <= y0) throw new RangeError("regionAddress: a degenerate region (x1<=x0 or y1<=y0) cannot address anything — refused, never silently accepted");
  return `${imagePath}#${x0},${y0}-${x1},${y1}`;
}

/** parseRegionAddress(at) -> {imagePath, x0,y0,x1,y1} | null — the inverse,
 * so a caller (or a later re-verification pass) can re-crop what an
 * address names. */
export function parseRegionAddress(at) {
  const m = /^(.*)#(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(String(at ?? ""));
  if (!m) return null;
  const [, imagePath, x0, y0, x1, y1] = m;
  return { imagePath, x0: Number(x0), y0: Number(y0), x1: Number(x1), y1: Number(y1) };
}

/**
 * imageConceptSighting({imagePath, concept, region, giver}) -> a hear()-
 * ready arrangement: `{end1: imagePath, label: "shows", end2: concept,
 * spans: [{at, ref: imagePath}], witness: imagePath, because}`. `giver`
 * names who verified the region (a person, an agent, a model) — never
 * omitted, since an unattributed visual claim is exactly the "nameless
 * authority" corruption THE-WAYS-OF-KNOWING.md's testimony spoke names.
 */
export function imageConceptSighting({ imagePath, concept, region, giver, method = "direct-visual-inspection" }) {
  if (!giver) throw new TypeError("imageConceptSighting requires a giver — an unattributed visual claim is not testimony, it is an assertion with no witness");
  const at = regionAddress({ imagePath, ...region });
  return {
    end1: imagePath, label: "shows", end2: concept,
    spans: [{ at, ref: imagePath }],
    witness: imagePath,
    because: `${method}, verified by ${giver}`,
  };
}

/** A DOM fact's own address (our own app, not a raster image): a CDP-
 * checkable selector stands in for a byte range — "this address resolves"
 * means "this selector exists in the live DOM," genuinely checkable. */
export function domConceptSighting({ appUrl, concept, selector, giver, present }) {
  if (!giver) throw new TypeError("domConceptSighting requires a giver");
  return {
    end1: appUrl, label: "shows", end2: concept,
    spans: [{ at: `${appUrl}#${selector}`, ref: appUrl }],
    witness: appUrl,
    because: `live DOM check (${selector}) by ${giver}: ${present ? "present" : "absent"}`,
    present, // carried for the caller's own filtering — a note is only landed for a PRESENT fact; absence is not a sighting
  };
}

export { REGION_RE };
