// category-discovery.js — "the small model needs to discover this... ask
// questions about what makes a podcast app a podcast app, and falsify its
// conclusions." A model's free-text answer to an open category question is
// a set of HYPOTHESES, never a fact — this organ extracts checkable claims
// from that text mechanically (a declared keyword table, never claimed as
// real language understanding) and hands them to a caller for FALSIFICATION
// against real, measured evidence: does the reference actually show this,
// and does our own artifact actually have it. Only a claim that clears
// BOTH ("the reference genuinely has it" AND "we genuinely lack it") is a
// confirmed gap — the same shape reference-fit.js already holds for a
// property (never landing a value nobody actually corroborated), aimed
// here at STRUCTURAL/compositional claims instead of a CSS value.
//
// PURE. `extractClaims` and `falsify` take plain data; the two "does X have
// this" answers are the caller's own crossings (a live DOM check, a direct
// visual observation of a downloaded reference image) — this file never
// measures anything itself, exactly the cast.js-adjacent split every other
// organ in this session holds between shape and crossing.

// Declared, disclosed keyword table — a caller extending this list is
// widening what CAN be discovered, never claiming the model was
// "understood": a claim this table doesn't recognize is silently dropped,
// never guessed at.
export const CONCEPT_TABLE = Object.freeze([
  { id: "artwork", pattern: /cover ?art|artwork|thumbnail|album art|(episode|show|podcast) image/i, label: "shows per-episode or per-show artwork/cover images" },
  { id: "persistent-player", pattern: /now.?playing|persistent player|mini.?player|sticky player|bottom player|playback bar|fixed player/i, label: "has a persistent/sticky player, not one inline control per row" },
  { id: "grid-layout", pattern: /\bgrid\b|columns of (shows|podcasts|tiles)|tiles?\b/i, label: "arranges shows/episodes in a grid of tiles" },
  { id: "tab-nav", pattern: /tab bar|bottom nav|navigation (bar|icons)|nav(igation)? tabs/i, label: "has a bottom tab/navigation bar" },
  { id: "search", pattern: /search (bar|icon|field|box)?/i, label: "has a search affordance" },
  { id: "progress-scrubber", pattern: /progress bar|scrubber|seek bar|playback progress/i, label: "shows playback progress distinctly from the raw player" },
  { id: "duration", pattern: /duration|episode length|time remaining|running time/i, label: "shows episode duration" },
  { id: "attribution", pattern: /host|author|show name|podcast name|hosted by/i, label: "shows the show's name/host beside each episode" },
]);

/** extractClaims(modelText) -> [{id, label}] — every concept in the table
 * whose pattern the model's own free text matched. Order follows the
 * table, not the model's own phrasing. */
export function extractClaims(modelText) {
  const text = String(modelText ?? "");
  return CONCEPT_TABLE.filter((c) => c.pattern.test(text)).map(({ id, label }) => ({ id, label }));
}

/**
 * falsify(claims, {referenceHasIt, appHasIt}) — both functions take a
 * claim id and return true / false / null (null = genuinely not checked,
 * never guessed). Verdicts:
 *   "model-claim-not-supported-by-reference" — the model said this
 *     matters, but the real reference does not actually show it. The
 *     model was WRONG about what defines the category, not merely
 *     ahead of our own app.
 *   "confirmed-gap" — the reference genuinely has it, our app genuinely
 *     doesn't. This is the only verdict that licenses building anything.
 *   "already-present" — the reference has it and so do we.
 *   "unmeasured" — either side is null; refuse to guess.
 */
export function falsify(claims, { referenceHasIt, appHasIt }) {
  return claims.map((c) => {
    const ref = referenceHasIt(c.id);
    const app = appHasIt(c.id);
    let verdict;
    if (ref === false) verdict = "model-claim-not-supported-by-reference";
    else if (ref === true && app === false) verdict = "confirmed-gap";
    else if (ref === true && app === true) verdict = "already-present";
    else verdict = "unmeasured";
    return { ...c, referenceHasIt: ref, appHasIt: app, verdict };
  });
}
