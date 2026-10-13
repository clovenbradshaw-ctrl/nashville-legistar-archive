// identity-meet.js — THE IDENTITY THAT SURVIVES MULTIPLE FOR-WHOMS.
//
// identity-at-a-point.md: identity exists only for-whom (S113), so *identification*
// is for-whom-relative. The thing that survives the family is the MEET of their
// identifications, grounded in the record they share: a pair is the same being
// for everyone iff no admissible for-whom splits it. A pair one for-whom joins
// and another divides was a for-whom-local reading — the falsifier.
//
// TWO LEVELS:
//   · FORM  — the pair as a frame names it (the surfaces, "Alice"/"A."). This is
//             the reading; it is what a for-whom asserts.
//   · POINT — the referent the record carries those forms on (`ref`, the
//             reader-independent handle; the fold at a point). `survivingIdentityAtPoints`
//             translates each frame's reading through the SHARED record's refs and
//             meets there — the being, not the spelling. A form with no ref in the
//             record falls back to its own spelling (a named gap: the point is unknown).
//
// The being is invariant; only the identification is relative.
//
// PURE: no clock, no random, no IO.

import { deriveIdentityRevisionForWhom } from "./identity.js";

const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const key = (a, b) => [String(a), String(b)].sort().join("\u0000");

/** relationOf(delta) — the identity relation a revision asserts, as a Map from
 *  pair-key to true (held: live hypothesis) or false (split: refused). Pure. */
export function relationOf(delta) {
  const rel = new Map();
  for (const op of delta?.operations ?? []) {
    const v = op?.payload?.value;
    if (!v?.left || !v?.right) continue;
    const kind = op?.consequence?.kind;
    const held = kind === "identity_hypothesis_opened" || kind === "identity_hypothesis_supported";
    const split = kind === "identity_split";
    if (!held && !split) continue;
    const k = key(norm(v.left), norm(v.right));
    if (split) rel.set(k, false); else if (!rel.has(k)) rel.set(k, true);
  }
  return rel;
}

/** refsOf(ctx) — norm(surface) -> Set(ref): the referents the record carries each
 *  form on. Read from the SHARED record, so every frame sees the same points. Pure. */
export function refsOf(ctx = {}) {
  const m = new Map();
  const edges = [...(ctx?.fold?.graphEntries ?? []), ...(ctx?.extraEntries ?? [])];
  for (const e of edges) {
    if (e?.schema !== "EOHyperedge@1") continue;
    for (const p of e.participants ?? []) {
      const s = norm(p?.surface); const r = p?.ref != null ? String(p.ref) : null;
      if (!s || r == null) continue;
      if (!m.has(s)) m.set(s, new Set());
      m.get(s).add(r);
    }
  }
  return m;
}

const pointsFor = (form, refs) => refs.get(norm(form)) ?? new Set([norm(form)]); // no ref → the spelling is its own point (a gap)

/** relationOfPoints(delta, refs) — the frame's relation translated onto the refs
 *  the record carries its forms on. A split anywhere wins over a hold. Pure. */
export function relationOfPoints(delta, refs) {
  const rel = new Map();
  for (const op of delta?.operations ?? []) {
    const v = op?.payload?.value;
    if (!v?.left || !v?.right) continue;
    const kind = op?.consequence?.kind;
    const held = kind === "identity_hypothesis_opened" || kind === "identity_hypothesis_supported";
    const split = kind === "identity_split";
    if (!held && !split) continue;
    for (const a of pointsFor(v.left, refs)) for (const b of pointsFor(v.right, refs)) {
      const k = key(a, b);
      if (split) rel.set(k, false); else if (!rel.has(k)) rel.set(k, true);
    }
  }
  return rel;
}

/** The meet itself: a pair survives iff some admitted frame holds it and none splits it. */
function meet(frames, refused) {
  const keys = new Set();
  for (const f of frames) for (const k of f.relation.keys()) keys.add(k);
  const survivors = [], splits = [];
  for (const k of keys) {
    const vals = frames.filter((f) => f.relation.has(k)).map((f) => f.relation.get(k));
    if (vals.some((v) => v === false)) splits.push(k);
    else survivors.push(k);
  }
  return Object.freeze({
    schema: "EOIdentityMeet@1",
    frames: Object.freeze(frames.map((f) => f.forWhom)),
    refused: Object.freeze(refused),
    survivors: Object.freeze(survivors.sort()),
    splits: Object.freeze(splits.sort()),
  });
}

/** survivingIdentity(reads) — the meet at the FORM level (the frames' own names). */
export function survivingIdentity(reads = []) {
  const frames = [], refused = [];
  for (const r of reads) {
    if (!r?.forWhom?.id) throw new TypeError("survivingIdentity: every read needs a for-whom");
    const out = deriveIdentityRevisionForWhom(r.forWhom, r.ctx ?? {});
    if (!out.admitted) { refused.push(Object.freeze({ forWhom: r.forWhom.id, reason: out.reason })); continue; }
    frames.push(Object.freeze({ forWhom: r.forWhom.id, relation: relationOf(out.delta) }));
  }
  return meet(frames, refused);
}

/** survivingIdentityAtPoints(reads) — the meet at the REFERENT level: each frame's
 *  reading is translated through the shared record's refs, so the survivor is the
 *  being (the fold at a point), not the spelling. A form with no ref is its own
 *  point — a named gap, disclosed by the frame's own surface key. */
export function survivingIdentityAtPoints(reads = []) {
  const frames = [], refused = [];
  for (const r of reads) {
    if (!r?.forWhom?.id) throw new TypeError("survivingIdentityAtPoints: every read needs a for-whom");
    const out = deriveIdentityRevisionForWhom(r.forWhom, r.ctx ?? {});
    if (!out.admitted) { refused.push(Object.freeze({ forWhom: r.forWhom.id, reason: out.reason })); continue; }
    frames.push(Object.freeze({ forWhom: r.forWhom.id, relation: relationOfPoints(out.delta, refsOf(r.ctx)) }));
  }
  return meet(frames, refused);
}

export default { relationOf, refsOf, relationOfPoints, survivingIdentity, survivingIdentityAtPoints };
