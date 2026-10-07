// native/kernel/network-standing.js — the Network terrain's STANDING organ:
// which co-arriving pairs are edges, decided by each pair's own
// permutation null, never by count.
//
// S9, downward clause, made mechanical: raw co-arrival (low — the
// material's own arrival positions) sets which pairs are POSSIBLE;
// standing is granted only by the null (the organ's own standard) — a
// pair seen together fifty times in a book where both beings are on
// every page has earned nothing that fifty draws of shuffled arrivals
// wouldn't also show. P6 calls this layer "the substantive product" and
// the native reading has never run it: terrain-activation LIGHTS raw
// pairs (presence), this module gives a pair standing (belief). The two
// must never be confused — presence fades, standing is projected.
//
// MEDIUM-BLIND: beings are {id, arrivals} in whatever unit the caller's
// reading arrives in (sentences, bars, shots). The binding organ arrives
// INJECTED (emergence/binding.js — the goldens/network incident records
// the cost of hand-rolling it instead); this module adds no statistics of
// its own, only the standing projection and its typed refusals.
//
// EVERY NUMBER DECLARED, each with its giver: `window` is the caller's —
// measured (dmdWindow) or cited; `draws`/`alpha`/`seed` follow
// host/population.js::LINK_SPEC's own convention (draws 199, alpha 0.05 —
// the certified consumer's cut, cited not re-derived).

const NULL_KEY_SEP = String.fromCharCode(0);

export function networkStanding(beings = [], { bindLinks, window, draws, seed, alpha } = {}) {
  if (typeof bindLinks !== "function")
    throw new TypeError("networkStanding: bindLinks is injected — the engine's own null, never a private reimplementation");
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1)
    throw new TypeError("networkStanding: alpha is declared — which p admits an edge is the caller's to cite");
  // window/draws/seed are validated by bindLinks itself ("declared, never
  // defaulted") — not re-checked here, one wall per number.

  // The arrival floor is binding's own structural minimum, cited not
  // chosen: one arrival has no co-arrival to test, and a pair built on one
  // gives the displacement null no room to displace — measured here as a
  // degenerate p=0 that would GRANT standing precisely where the test
  // could not run. Below-floor beings are excluded with their names kept.
  const tested = [];
  const belowFloor = [];
  for (const being of beings) {
    if ((being?.arrivals?.length ?? 0) >= 2) tested.push(being);
    else belowFloor.push({ id: being?.id ?? null, arrivals: being?.arrivals?.length ?? 0, reason: "below_arrival_floor", detail: "fewer than 2 arrivals — no co-arrival to test (binding's structural minimum)" });
  }
  const { pairs, nulls } = bindLinks(tested, { window, draws, seed });
  const edges = [];
  const refused = [];
  for (const p of pairs) {
    const n = nulls.get(`${p.a.id}${NULL_KEY_SEP}${p.b.id}`);
    const row = { a: p.a.id, b: p.b.id, coArrivals: p.overlap, pValue: n?.pValue ?? null };
    if (n && n.pValue < alpha) edges.push(row);
    else refused.push({ ...row, reason: "coincident_under_null", detail: `observed co-arrival does not clear its own displacement null at alpha ${alpha} — company kept by chance is not a bond` });
  }
  edges.sort((x, y) => y.coArrivals - x.coArrivals);
  return { edges, refused, belowFloor, declared: { window, draws, seed, alpha }, pairsTested: pairs.length };
}

/**
 * directedEdges — direction and polarity for pairs that ALREADY have
 * standing, via the engine's own buildLink (reversal null for direction,
 * reseed null as the witness gate's third test — injected whole, never
 * reassembled from halves).
 *
 * S9 ordering, stated: the directed question is asked ONLY of pairs the
 * displacement null admitted — standing (high) licenses which pairs get
 * the more expensive directed test (low), and a pair the reversal null
 * cannot orient stays typed `direction_undetermined`, never guessed from
 * raw asymmetry. `totalUnits` is the reading's own length in its own
 * fold unit — the caller's fact, declared.
 */
export function directedEdges(beings = [], edges = [], { buildLink, totalUnits, draws, seed } = {}) {
  if (typeof buildLink !== "function")
    throw new TypeError("directedEdges: buildLink is injected — the engine's own three-null gate, never a private reimplementation");
  const byId = new Map(beings.map((b) => [b.id, b]));
  const directed = [];
  const undetermined = [];
  edges.forEach((e, i) => {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    if (!a || !b) return;
    const link = buildLink({ a, b, overlap: e.coArrivals }, { totalUnits, draws, seed: seed + i * 13 });
    const row = {
      a: e.a, b: e.b, coArrivals: e.coArrivals,
      reversalP: link.nulls.reversal.pValue,
      reseedP: link.nulls.reseed.pValue,
    };
    if (link.direction) directed.push({
      ...row, direction: link.direction, polarity: link.polarity, strength: link.strength,
      // S10: TE from sparse arrivals is sound as a RANK, not a magnitude —
      // pairs with different arrival counts are not comparable in bits.
      strengthMeans: "rank among this run's oriented pairs, never a comparable magnitude in bits (S10)",
    });
    else undetermined.push({ ...row, reason: "direction_undetermined", detail: "the reversal null cannot orient this pair — mutual company has no measured leader" });
  });
  return { directed, undetermined };
}
