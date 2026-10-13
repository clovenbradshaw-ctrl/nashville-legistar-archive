// fold-chat-freshness.js — do the claims the fold already made still stand on the pages as they are now?
// Pure: no DOM, no IO, no model. The chat's ADAPTER onto khora's span-drift.js (vendor/khora/native/the-fold/span-drift.js): the contract —
// exact / shifted / moved / gone over `ref#start-end` — lives in the khora; what is the chat's own is only the claim shape (FoldRecord@1,
// fold-chat-record.js): a claim's `basis.support` is the address of the source sentence that witnessed it, and `basis.cited` is that source's
// own bytes at that address, written when the claim was made. The claim's text (roles.ARG1) is what the fold SAID and is NOT the cited bytes,
// so it is never checked against the address.
//
//   freshnessOf({ claims, pages })
//     → { checked, skipped, counts:{exact,shifted,moved,gone,unchecked}, stale:[…], unchecked:[…] }
//
//   `claims`  the session's claim store (s.claims). A claim with no `basis.cited` is SKIPPED, counted, never reported as gone: the record
//             did not hold the span when the claim was made, so there is nothing to compare (fold-chat-record.js: "never guessed").
//   `pages`   the pages loaded NOW: [{ ref, text }] (or { name, text }), with the same refs the addresses were minted with.
//   `stale`   every checked claim whose verdict is not `exact`, in claim order: { id, kind, was, at?, source?, ambiguous?, why? }.
//   `unchecked` claims whose source page is not loaded now (span-drift gap `source_absent`). A page that was not re-read is not evidence the
//             words changed; these are listed apart and never counted as gone.
//
// The walls: it never rewrites a claim or an address (a shifted/moved verdict carries the new address beside `was`); it never reads a claim's
// spoken text as the cited words; a missing page is unchecked, not gone.
//
// A caution carried, not hidden: refs are unique within one assemble call (fold-chat-assemble.js), not across turns, so a page re-read later
// may be given a different ref than the claim's address names. span-drift then reports `moved` (the same words under another ref), never gone,
// which is the correct, honest verdict; a caller that wants `exact` across turns must hand the SAME ref for the same page.
import { driftAll } from "./vendor/khora/native/the-fold/span-drift.js";

/** The claims that can be checked: a string `basis.support` (the address) and a string `basis.cited` (the bytes at it). */
const checkable = (c) => typeof c?.basis?.support === "string" && c.basis.support && typeof c?.basis?.cited === "string" && c.basis.cited !== "";

export function freshnessOf({ claims = [], pages = [] } = {}) {
  const list = (Array.isArray(claims) ? claims : []).filter((c) => c && typeof c === "object");
  const todo = list.filter(checkable);
  const skipped = list.length - todo.length;
  const { results } = driftAll(todo.map((c) => ({ address: c.basis.support, text: c.basis.cited })), pages);
  const counts = { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0 };
  const stale = [], unchecked = [];
  results.forEach(({ drift: d }, i) => {
    const id = todo[i].id ?? null;
    if (d.kind === "gone" && d.gap?.type === "source_absent") { counts.unchecked++; unchecked.push(id); return; }
    counts[d.kind]++;
    if (d.kind === "exact") return;
    stale.push({
      id, kind: d.kind, was: d.was ?? todo[i].basis.support,
      ...(d.at ? { at: d.at } : {}), ...(d.source ? { source: d.source } : {}),
      ...(d.ambiguous ? { ambiguous: true } : {}),
      ...(d.kind === "gone" ? { why: d.gap?.type ?? null } : {}),
    });
  });
  return { checked: todo.length, skipped, counts, stale, unchecked };
}
