// the-fold/fold-record.js — the fold at an ADDRESS, not a string (FoldRecord@1): the contract every Fold repo crosses.
//
// A turn's fold used to be `Q: … A: …` cut to 100 characters: a copy, so the fold was not lossless at a point. Here what a turn
// said (or showed) is a set of gfp claims at holon addresses (`/t7/c2`) in an APPEND-ONLY claim store, and the warrant record
// (fold.js buildWarrantRecord) carries only a POINTER into it: { address, claimIds, forWhom }. The store is the lossless side;
// every projection (a prompt line, ON RECORD, "what did you tell me?", a weave's provenance) is a read at an address.
//
// Generic on purpose: no chat, no pivot, no DOM. A surface adapts its own units into claims (`claimAt`) and appends them; khora
// reads, janus appends derivations as claims at their own addresses, penelope carries `address` + `claimIds` as provenance.
// Nothing is rewritten: a claim's ARG1 is the unit's text verbatim and `basis` carries what witnessed it.
//
// PURE: no I/O, no model, no mutation of anything passed in.
import { gfpClaim, holon } from "../kernel/gfp-claim.js";
import { foldAt } from "./fold-at.js";

export const FOLD_RECORD_SCHEMA = "FoldRecord@1";

/** The holon for a turn: `/t7`. */
export const turnAddress = (turn) => holon(`/t${Number(turn) || 0}`);

/** A source address `<ref>#<from>-<to>` as a holon path `/s/<ref>/<from>-<to>`. Each "/" or space in the ref becomes one "~" (never collapsed, so distinct refs stay distinct). */
export function holonOfSource(address) {
  const [ref, span] = String(address ?? "").split("#");
  if (!ref) return null;
  const seg = ref.replace(/[\/\s]/g, "~");
  return holon(span ? `/s/${seg}/${span}` : `/s/${seg}`);
}

/** One claim of turn `turn`, number `i` (1-based): the fold (ARG0) `rel` (said / showed …) the unit's text VERBATIM (ARG1). Empty text is no claim (null).
 *  `lane` is the one-letter address lane: "c" (the surface's own claims, default) or "d" (derivations a reasoner appended — janus), so `/t7/c2` and `/t7/d1` never collide.
 *  `arg0` is who holds it (default "fold"); a derivation passes its own subject. */
export function claimAt(turn, i, rel, text, basis = null, { lane = "c", arg0 = "fold" } = {}) {
  const t = String(text ?? "");
  if (!t.trim() || !/^[a-z]$/.test(lane)) return null;
  const n = Number(turn) || 0;
  return gfpClaim({ ground: `${turnAddress(turn)}/${lane}${i}`, rel, roles: { ARG0: arg0, ARG1: t }, id: `t${n}${lane}${i}`, basis });
}

/** The record's pointer fields for a turn: where its claims live and which they are. Spread beside a warrant record; additive. */
export function pointerOf({ turn, claims = [], forWhom = null } = {}) {
  return { schema: FOLD_RECORD_SCHEMA, address: turnAddress(turn), claimIds: claims.map((c) => c.id), forWhom: forWhom ? String(forWhom).slice(0, 160) : null };
}

/** Append claims to the STORE. Never truncated, never rewritten; a claim whose id is already stored is not stored twice. Returns a new array. */
export function appendClaims(store, claims) {
  const prev = Array.isArray(store) ? store : [];
  const have = new Set(prev.map((c) => c.id));
  return [...prev, ...(claims || []).filter((c) => c && !have.has(c.id))];
}

const cNum = (c) => { const m = String(c.ground).match(/\/([a-z])(\d+)$/); return m ? (m[1].charCodeAt(0) - 96) * 1e6 + Number(m[2]) : 0; };   // lane order (c, then d), then number

/** Everything at or under an address, in claim order: the lossless read (khora's foldAt `here` + `descendants`). */
export function claimsAt(address, store) {
  const f = foldAt(address, store || []);
  return [...f.here, ...f.descendants].sort((a, b) => cNum(a) - cNum(b));
}

/** The BOUNDED projection of a record: the claims it points at, joined, cut to `max`. Cutting the VIEW never touches the store. */
export function projectRecord(rec, store, { max = 100 } = {}) {
  if (!rec?.address) return null;
  const ids = new Set(rec.claimIds || []);
  const text = claimsAt(rec.address, store).filter((c) => !ids.size || ids.has(c.id)).map((c) => c.roles.ARG1).join(" ");
  return text.length > max ? text.slice(0, Math.max(0, max - 1)).trimEnd() + "…" : text;
}

/** Rebuild what a turn said from the store alone (the round trip the lossless claim is tested by). */
export const spokenFrom = (rec, store) => projectRecord(rec, store, { max: Infinity });
