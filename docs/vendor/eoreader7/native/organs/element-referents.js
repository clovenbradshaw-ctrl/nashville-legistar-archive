// element-referents.js — connecting the elements of an auto-generated
// artifact to REFERENTS, so the rest of this instrument can reason about
// "the play button" or "episode 3's title" as a THING, not as a raw CSS
// selector or a scan-order index.
//
// THE PROBLEM THIS CLOSES. `podcast-cdp-lib.mjs::extractElements` already
// reads real computed styles off the live DOM every round, but its own `id`
// field is `tag + "-" + scanOrder` — an index into `querySelectorAll`'s scan
// order, which SHIFTS the moment a row is added, removed, or reordered
// between repair rounds. Its `selector` field (".episode h3", "button")
// names a RULE, which is shared by every episode's title at once — not an
// individual thing. Neither field survives being asked "is this the SAME
// element as the one two rounds ago", which is exactly the question a
// repair loop that reasons about drift, persistence, or "did my fix land on
// the right element" needs answered.
//
// THE PRECEDENT, reused rather than reinvented. bridges.js's own load-
// bearing clause: "it is the same set of operations, just at another
// level." Cross-document referent identity in the text tier (bridges.js)
// and this problem are the SAME shape one level down: within one reading,
// establish a referent from the reading's own company (cast.js does this
// for names via capitalisation+context; kind-standing.js does this for
// referent KIND via the token before/after); across two readings, bridge
// the corresponding referents by their signature, corroborated when the
// correspondence recurs. This file does that for UI elements: within one
// extraction round, `establishElementReferents` mints one referent per
// element, keyed on a signature (selector + a disambiguator) that survives
// scan-order churn; across two rounds, `bridgeElementReferents` matches
// referents by that signature and TYPES the outcome (persisted / changed /
// appeared / vanished) rather than silently assuming persistence.
//
// WHAT COUNTS AS THE DISAMBIGUATOR, and why it is declared, not guessed.
// A selector groups many elements (every episode's <h3> matches
// ".episode h3"). Two elements sharing one selector are told apart by:
//   1. their own TEXT, when the element carries distinguishing text (an
//      episode's title is itself a stable identifier across rounds, since
//      the underlying feed data does not change between repair rounds —
//      this is the same "the material's own words are the identity"
//      posture render.js's own findSentence already holds, one register
//      over); else
//   2. their ORDINAL POSITION in visual document order (top-to-bottom,
//      by `rect.top`) among siblings sharing the selector — a real,
//      disclosed WEAKER signal than text (position shifts if a row is
//      inserted above it), so a position-only referent is typed
//      `keyedBy: "position"` rather than `"text"`, and a bridge built on a
//      position-only match is disclosed as such, never reported with the
//      same confidence as a text match.
//
// PURE; no DOM, no CDP, no fetch — takes the plain-object array
// `extractElements` already returns (or any array shaped the same way) and
// returns plain, addressable referent objects. Medium-specific by
// necessity (a CSS selector and a bounding rect are DOM facts, not
// something a text-tier organ could produce) but structured the same way
// cast.js/bridges.js structure a text referent: an id, a kind, evidence,
// and — for a bridge — a typed correspondence rather than an inference.

const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

/** A UI-appropriate "kind" name, derived from the element's own selector —
 * declared here, not claimed as a semantic classifier; a selector this
 * table does not recognize still gets a referent, typed `kind: "element"`
 * rather than refused. */
function kindOf(el) {
  const sel = el?.selector ?? "";
  const tag = el?.tag ?? "";
  if (sel === "button") return "button";
  if (sel.includes('input[type="text"]') || tag === "input") return "input";
  if (sel === ".ethos-badge") return "badge";
  if (sel === ".episode") return "episode-row";
  if (sel === ".episode h3") return "episode-title";
  if (sel === ".episode p") return "episode-detail";
  if (tag === "h1") return "heading";
  if (tag === "h3") return "subheading";
  if (tag === "p") return "paragraph";
  return "element";
}

/**
 * establishElementReferents(elements) — one referent per element, within
 * ONE extraction round. Never mutates its input.
 *
 * Returns an array of:
 *   { ref, kind, selector, text, keyedBy: "text" | "position", ordinal,
 *     rect, raw: <the original element object> }
 */
export function establishElementReferents(elements) {
  const list = Array.isArray(elements) ? elements : [];
  // Group by selector so an ordinal disambiguator counts only within its
  // own group of otherwise-identical siblings (an episode title's ordinal
  // among OTHER episode titles, not among every element on the page).
  const bySelector = new Map();
  for (const el of list) {
    const sel = el?.selector ?? "(unselected)";
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push(el);
  }

  const out = [];
  for (const [sel, group] of bySelector) {
    // Visual document order — the same order a reader scans the page in,
    // and the only order that survives a DOM scan-order renumbering.
    const ordered = [...group].sort((a, b) => (a?.rect?.top ?? 0) - (b?.rect?.top ?? 0));
    const text = ordered.map((el) => norm(el?.text ?? el?.textContent));
    const textCounts = new Map();
    for (const t of text) textCounts.set(t, (textCounts.get(t) ?? 0) + 1);

    ordered.forEach((el, i) => {
      const kind = kindOf(el);
      const rawText = norm(el?.text ?? el?.textContent ?? "");
      const distinguishingText = rawText && textCounts.get(rawText) === 1;
      const keyedBy = distinguishingText ? "text" : "position";
      const key = distinguishingText
        ? rawText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)
        : String(i);
      out.push({
        ref: `el:${sel}#${key}`,
        kind,
        selector: sel,
        text: rawText || null,
        keyedBy,
        ordinal: i,
        rect: el?.rect ?? null,
        raw: el,
      });
    });
  }
  return out;
}

/**
 * bridgeElementReferents(beforeRefs, afterRefs) — connects two rounds'
 * worth of established referents (each the output of
 * establishElementReferents). Never guesses a correspondence a
 * `keyedBy:"position"` referent's own instability would make false: a
 * position-keyed referent bridges ONLY if its selector+ordinal both match
 * exactly (the group didn't reorder or resize), and the join is typed
 * `confidence: "weak"` so a caller never treats it like a text match.
 *
 * Returns { persisted, changed, appeared, vanished } — every element from
 * either round is accounted for in exactly one bucket, disclosure over
 * inference (a `notes.js`-style rule: never silently assume, always type
 * the outcome).
 */
export function bridgeElementReferents(beforeRefs, afterRefs) {
  const before = Array.isArray(beforeRefs) ? beforeRefs : [];
  const after = Array.isArray(afterRefs) ? afterRefs : [];
  const afterByRef = new Map(after.map((r) => [r.ref, r]));
  const matchedAfter = new Set();

  const persisted = [];
  const changed = [];
  const vanished = [];

  for (const b of before) {
    const a = afterByRef.get(b.ref);
    if (!a) { vanished.push(b); continue; }
    matchedAfter.add(a.ref);
    const confidence = b.keyedBy === "text" && a.keyedBy === "text" ? "strong" : "weak";
    const sameVisualFace = JSON.stringify(b.raw?.backgroundColor) === JSON.stringify(a.raw?.backgroundColor)
      && JSON.stringify(b.raw?.color) === JSON.stringify(a.raw?.color)
      && b.raw?.fontSizePx === a.raw?.fontSizePx
      && b.raw?.bold === a.raw?.bold
      && (b.raw?.borderRadiusPx ?? null) === (a.raw?.borderRadiusPx ?? null);
    (sameVisualFace ? persisted : changed).push({ before: b, after: a, confidence });
  }

  const appeared = after.filter((a) => !matchedAfter.has(a.ref));
  return { persisted, changed, appeared, vanished };
}
