// output-order.js — THE STRUCTURE organ the falsification found missing:
// compose's `orderBy: byte-offset` is document order, not narrative order,
// so the THEN probe ("first… then… then…") produced scattered chronicle.
// This organ declares the ORDER an output's claims take, from the material's
// OWN sequence register (output-claims.js's `sequence` — the form of inner
// sense: the order the material itself states, never a guessed one) and the
// story's own spine (story-shapes.js's declared arcs).
//
// THE ORDERING LAW (compose.js's own): an order is DECLARED, never guessed.
// This organ never invents an order — it reads the order the material itself
// states (the sequence register carries first/then/afterward; the hypothetical
// form carries the consequence) and applies it. Where the material states no
// order, it REFUSES (no_declared_order) rather than emitting a guess.
//
// THE ARCHONS: Murch (the cut — a film is cut where the audience blinks)
// owns the rhythm of the order; Vonnegut (the 27-operator arc) owns the
// spine the order traces. The order is the cut; the spine is the arc.
//
// PURE. sequence rows arrive already earned (output-claims.js's output);
// this organ only places them. Both the new shape (`{ form: "sequence",
// position }`) and the legacy `{ kind: "temporal", position }` are accepted —
// a correction is an addition, never a silent rewrite of a caller.

export const OUTPUT_ORDER_SCHEMA = "OutputOrder@1";

export const ORDER_REFUSALS = Object.freeze({
  NO_DECLARED_ORDER: "no_declared_order",
  NO_TEMPORAL_CLAIMS: "no_temporal_claims",
});

/**
 * orderByNarrative({ kinds, claims, spine }) →
 *   { ordered, basis, refused }
 *
 * `kinds` is output-claims.js's sequence entries (each with its span and
 * position), or the legacy temporal kinds; `claims` is the material's claims
 * each carrying its span and ref. `spine` is an optional declared arc
 * (story-shapes.js's cell name, e.g. "The Recurrence").
 *
 * THE RULE: a claim whose span sits INSIDE a sequence entry's span is placed
 * by that entry's position (first < then < afterward); a claim with no
 * sequence anchor keeps document order relative to its neighbours. If NO
 * sequence entry exists, this REFUSES (no_declared_order) — document order
 * is not narrative order, and this organ will not pass one off as the other.
 */
export function orderByNarrative({ kinds = [], claims = [], spine = null } = {}) {
  const sequence = (kinds ?? []).filter((k) => k.form === "sequence" || k.kind === "temporal");
  if (!sequence.length) {
    return {
      ordered: [],
      basis: spine ? `declared spine "${spine}" but no sequence anchors to place by` : "no sequence entry to order by",
      refused: { type: ORDER_REFUSALS.NO_TEMPORAL_CLAIMS, detail: "the material states no first/then/afterward — document order is not narrative order, and this organ will not pass one off as the other" },
    };
  }
  // place each claim inside the sequence window that contains its span
  const placed = (claims ?? []).map((c) => {
    const at = c.span?.start ?? c.offset ?? 0;
    const window = sequence.find((k) => at >= (k.span?.start ?? 0) && at <= (k.span?.end ?? Infinity)) ?? null;
    const pos = window?.position ?? null;
    return { c, pos, windowStart: window?.span?.start ?? -1 };
  });
  // order by: position rank, then window start, then claim offset
  const rank = (p) => (p.pos === "first" ? 0 : p.pos === "then" ? 1 : p.pos === "next" || p.pos === "afterward" || p.pos === "afterwards" ? 2 : 3);
  const ordered = [...placed].sort((a, b) => rank(a) - rank(b) || a.windowStart - b.windowStart || (a.c.offset ?? a.c.span?.start ?? 0) - (b.c.offset ?? b.c.span?.start ?? 0));
  const arr = ordered.map((p) => p.c);
  return {
    ordered: arr,
    basis: `${arr.length} claim(s) placed by ${sequence.length} sequence anchor(s)${spine ? ` under the declared spine "${spine}"` : ""}`,
    refused: null,
  };
}