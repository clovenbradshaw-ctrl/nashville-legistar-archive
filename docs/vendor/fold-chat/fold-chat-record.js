// fold-chat-record.js — the chat's ADAPTER onto the khora's FoldRecord@1 (vendor/khora/native/the-fold/fold-record.js).
//
// The contract (claim at a holon address, append-only store, record pointer, bounded view, round trip) lives in the khora and is
// re-exported here unchanged. What is the chat's own is only the turn's UNITS: the Pivot's spoken sentences (or the sources the fold
// showed) become the claims. Nothing is rewritten — a claim's text is the unit's, its basis carries the source address that witnessed it.
import { claimAt, holonOfSource } from "./vendor/khora/native/the-fold/fold-record.js";

export { FOLD_RECORD_SCHEMA, turnAddress, holonOfSource, claimAt, pointerOf, appendClaims, claimsAt, projectRecord, spokenFrom } from "./vendor/khora/native/the-fold/fold-record.js";

/** The source's own bytes at a support address `<ref>#<from>-<to>`: `material` is what the turn READ ([{ ref, text }], the same items the Pivot judged against), the
 *  span is a byte range of that item's text. Absent (null) when the ref is not in the material or the range does not fit — never guessed, never the spoken sentence
 *  (record.sources[].text is the SPOKEN sentence and its address is the matched PHRASE's span, so neither can stand in for the page's bytes: measured by the peer session, 43/43 differed). */
export function citedAt(support, material) {
  const sup = String(support ?? "");
  const at = sup.lastIndexOf("#");
  if (at < 1) return null;
  const m = sup.slice(at + 1).match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const ref = sup.slice(0, at), a = Number(m[1]), b = Number(m[2]);
  const item = (material || []).find((x) => x && String(x.ref) === ref && typeof x.text === "string");
  if (!item || !(b > a) || b > item.text.length) return null;
  return item.text.slice(a, b);
}

/** The claims one finished turn makes, in order.
 *  Spoken sentences (the Pivot's kept sentence/code units) are what the fold SAID, verbatim; when it spoke none, the sources it showed are claims it SHOWED.
 *  `basis.cited` = the source's bytes at `support` from `material` (see citedAt); `basis.support` is the address the claim stands on. */
export function claimsOfTurn({ turn, pivot = null, record = null, material = [] } = {}) {
  const out = [];
  const add = (rel, text, basis) => { const c = claimAt(turn, out.length + 1, rel, text, basis); if (c) out.push(c); };
  const withCited = (support) => { const cited = citedAt(support, material); return { support: String(support), source: holonOfSource(support), ...(cited != null ? { cited } : {}) }; };
  const units = (pivot?.units || []).filter((u) => u && (u.kind === "sentence" || u.kind === "code"));
  if (units.length) {
    for (const u of units) add("said", u.text, { turn, kind: u.kind, ...(u.support ? withCited(u.support) : {}) });
  } else {
    for (const r of record?.sources || []) if (r?.address) add("showed", r.text, { turn, kind: "source", ...withCited(r.address) });
  }
  return out;
}
