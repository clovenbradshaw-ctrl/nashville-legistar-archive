// block-derive.mjs — THE PROJECTIONS (Network · Paradigm · Atmosphere).
//
// Fold invariant: EVERYTHING DERIVED IS TYPED AS DERIVED, NEVER ASSERTED AS
// SOURCE. Given the Links, the Cast, and the surface def (the Lens set),
// this block derives what the record does not literally state: the networks
// (a lens's question answered across plans; the lighting of places by their
// links), the paradigm (the change log of revisions), and the atmosphere
// (the model's own prose, marked — never blended). Deterministic: same
// links + def in, same projections out.
export const PROJECTION_SCHEMA = "EOProjections@1";

export function deriveProjections({ links, cast = null, def, metrics = [] }) {
  const networks = [];
  for (const t of def.topics ?? []) {
    const q = (t.queries ?? []).map((x) => String(x).toLowerCase());
    const matched = links.filter((l) => {
      const hay = `${l.verbatim} ${l.fields?.section ?? ""}`.toLowerCase();
      return q.some((x) => hay.includes(x));
    });
    if (!matched.length) continue;
    const byDoc = {};
    for (const l of matched) (byDoc[l.doc] ??= []).push(l);
    networks.push({
      kind: "lens",
      id: t.id,
      label: t.label,
      rows: matched.length,
      docs: Object.entries(byDoc).map(([doc, ls]) => ({ doc, rows: ls.length, links: ls })),
    });
  }
  // The lighting map: a place is lit by the links that name it, one hop;
  // a place no link names is not lit (never guessed).
  const places = [];
  for (const [place, districts] of Object.entries(def.metrics?.placeDistricts ?? {})) {
    const lit = links.filter((l) => String(l.fields?.place ?? "").toLowerCase() === place.toLowerCase());
    places.push({
      kind: "lighting",
      place,
      districts,
      links: lit,
      state: lit.length >= 6 ? "lit" : lit.length ? "dim" : "unresolved",
    });
  }
  // The paradigm: the revision chain, from links that carry supersedes.
  const changeLog = links
    .filter((l) => l.supersedes)
    .map((l) => ({ kind: "revision", id: l.id, supersedes: l.supersedes, basis: l.basis, title: l.title ?? null }));
  // The atmosphere: the model's own prose, structurally marked.
  const atmosphere = (def.analysis ?? []).map((a, i) => ({
    kind: "model-claim",
    id: `analysis:${i + 1}`,
    text: a.text ?? "",
    basis: "stated by the model; no retained source states it",
  }));
  return { schema: PROJECTION_SCHEMA, networks, places, changeLog, atmosphere };
}