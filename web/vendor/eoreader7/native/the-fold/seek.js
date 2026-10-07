// seek.js — answer "who/what stands in relation R to A" from any source that
// can answer four questions. PURE, and source-independent: there is not a
// qid, a property id, a URL, or a vocabulary word from any particular
// publisher anywhere in this file, and a test asserts it.
//
// WHY THIS FILE EXISTS, stated plainly. The walk it performs was built first
// against Wikidata and was, honestly, a Wikidata parser with reasoning-shaped
// comments on it — `P31`, `P39`, `haswbstatement`, `Special:EntityData` ran
// through every step, so nothing in it could ever have answered the same
// question from an org chart, a version history, or a table on disk. That
// inverts the dependency law this project already holds: spec <- kernel <-
// adapters, and `relation-composition.js` records the same mistake being made
// and undone one layer down ("the kernel reaching back for role names only an
// English-SVO text adapter ever writes... went dark on everything else").
//
// THE SOURCE INTERFACE — four questions, no more:
//
//   resolve(surface)            -> [{id, label, description?}]
//       what could this string name? Ambiguity is returned, never collapsed.
//   entity(id)                  -> {id, label, kinds:[...], relations:[...]}
//       relations are {relation, value, scope?:{from,to}, prev?, next?}.
//       `scope` is any ordered extent — dates, versions, page ranges, chapter
//       numbers — compared as strings, so a source may use whatever ordering
//       its own domain has. This file never parses one.
//   specialize(slotId, context)  -> [id]        (optional)
//       narrow a generic slot to the one that applies in the anchor's own
//       context. A source with no such notion returns [] and the generic slot
//       is used as-is.
//   membersOf(relation, valueId) -> [id]
//       the inverse: everything standing in `relation` to `valueId`.
//   neighbours(id)               -> [id]        (optional)
//       things this entity points at, used only to LEARN a relation by
//       example when the caller does not name one.
//
// Everything below composes those. What is general lives here; what is
// Wikidata's lives in an adapter.

const uniq = (xs) => [...new Set((xs ?? []).filter(Boolean))];

/**
 * learnRelation — which relation expresses membership in `slotId`, learned
 * from examples rather than named by the caller.
 *
 * The slot's own neighbours are fetched and asked which relation THEY use to
 * point back at it. Witness eligibility is gated on `kind` when the question
 * has one: measured on a real source, counting back-pointers alone learned a
 * housekeeping relation ("category's main topic") over the membership one,
 * two witnesses to one, because a filing record points at a thing exactly as
 * a member does. What the question seeks is what can witness.
 *
 * Returns candidates ordered by witnesses, each carrying the ids that
 * actually did it, so a caller checks rather than trusts a count.
 */
export async function learnRelation(slotId, source, { kind = null, batch = 6, settleRuns = 2, maxBatches = 12 } = {}) {
  if (typeof source?.neighbours !== "function") return { candidates: [], examined: 0, settled: false, refused: false, reason: "source cannot offer examples" };
  let via = "outbound";
  let ids = uniq(await source.neighbours(slotId)).filter((id) => id !== slotId);
  // A SINK HAS NO OUTBOUND NEIGHBOURS, and that is not the same as having no
  // members. This walk learns by reading things NEAR the slot and seeing which
  // relation they use to point back at it — which silently assumes the slot
  // points at something to begin with. A Wikidata office does; a slot built
  // from a list read out of a document does not: every member points at it and
  // it points at nothing, so `examined` came back 0 with the members sitting
  // right there unread. `inbound` is the same question asked in the direction
  // the data actually goes, and it is OPTIONAL — a source without it behaves
  // exactly as before.
  if (!ids.length && typeof source.inbound === "function") {
    const back = await source.inbound(slotId);
    if (back === null || back === undefined) return { candidates: [], examined: 0, batches: 0, settled: false, refused: true, via: "inbound" };
    ids = uniq(back).filter((id) => id !== slotId);
    via = "inbound";
  }
  const byRelation = new Map();
  let examined = 0;
  let verdict = "none";
  let unchanged = 0;
  let batches = 0;
  let cursor = 0;
  let refused = false;

  while (unchanged < settleRuns && batches < maxBatches && cursor < ids.length) {
    const slice = ids.slice(cursor, cursor + batch);
    cursor += slice.length;
    const got = await source.entities(slice);
    // A REFUSED READ IS NOT AN EXHAUSTED SOURCE. Conflating them makes a walk
    // report "the evidence ran out" when the source merely declined.
    if (got === null || got === undefined) {
      refused = true;
      break;
    }
    batches++;
    for (const e of got) {
      if (!e?.id || e.id === slotId) continue;
      if (kind && !(e.kinds ?? []).includes(kind)) continue;
      examined++;
      for (const rel of uniq((e.relations ?? []).filter((r) => r.value === slotId).map((r) => r.relation))) {
        if (!byRelation.has(rel)) byRelation.set(rel, new Set());
        byRelation.get(rel).add(e.id);
      }
    }
    const next = leaderOf(byRelation);
    if (next === verdict) unchanged++;
    else { unchanged = 0; verdict = next; }
  }
  // `via` is reported, never inferred by the caller: "learned from six things
  // the slot names" and "learned from six things that name the slot" are
  // different evidence and a reader must be able to tell them apart.
  return { candidates: rank(byRelation), examined, batches, settled: unchanged >= settleRuns, refused, via };
}

const rank = (byRelation) =>
  [...byRelation.entries()]
    .map(([relation, ws]) => ({ relation, witnesses: [...ws], count: ws.size }))
    .sort((a, b) => b.count - a.count || String(a.relation).localeCompare(String(b.relation)));

// Only what a further example could change WITHOUT changing the outcome is
// dropped: the leader and whether it is alone. Counts and the tail are not
// the verdict, so they must not restart the settle count.
const leaderOf = (byRelation) => {
  const r = rank(byRelation);
  return r.length ? `${r[0].relation}|${r[0].count > 1 ? "multi" : "single"}` : "none";
};

/**
 * coverage — how much of `scope` the bound extents actually account for,
 * end to end, and whether they tile it with no gap.
 *
 * ORDERING ONLY, NEVER PARSING. Extents are compared as strings, so a source
 * may hand over ISO dates, semantic versions, chapter numbers or byte
 * offsets and this function is equally correct on all of them. `span` is the
 * caller's own measure of distance between two points on its scale; without
 * one, coverage is reported as unmeasurable rather than guessed.
 */
export function coverage(scope, bound, { span = null } = {}) {
  const from = scope?.from;
  const to = scope?.to;
  if (from == null || to == null || !bound?.length) return { ratio: null, gaps: null, tiles: false, reason: "nothing to cover" };
  const clipped = bound
    .filter((b) => b.scope?.from != null && b.scope?.to != null)
    .map((b) => ({ from: b.scope.from < from ? from : b.scope.from, to: b.scope.to > to ? to : b.scope.to }))
    .filter((s) => s.from < s.to)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)));
  if (!clipped.length) return { ratio: null, gaps: null, tiles: false, reason: "no bound extent falls inside the scope" };

  let gaps = 0;
  let cursor = from;
  const covered = [];
  for (const s of clipped) {
    if (s.from > cursor) { gaps++; cursor = s.from; }
    if (s.to > cursor) { covered.push({ from: cursor, to: s.to }); cursor = s.to; }
  }
  if (cursor < to) gaps++;
  const tiles = gaps === 0;
  if (typeof span !== "function") {
    // Tiling is a purely ordinal fact and is still reported; a RATIO needs a
    // measure the source has to supply.
    return { ratio: null, gaps, tiles, reason: "no span measure supplied — extent is ordered, not measured" };
  }
  const total = span(from, to);
  const got = covered.reduce((s, c) => s + span(c.from, c.to), 0);
  if (!Number.isFinite(total) || total <= 0) return { ratio: null, gaps, tiles, reason: "the scope has no measurable width" };
  return { ratio: Number(Math.max(0, Math.min(1, got / total)).toFixed(4)), gaps, tiles, reason: null };
}

/**
 * chooseAnchor — which reading of the anchor can actually support the
 * question, tried in the source's own order.
 *
 * EXPORTED so no caller re-implements it. A caller that did its own anchor
 * read and its own scope check short-circuited this entirely — measured:
 * the route bailed with "Lincoln holds nothing with a bounded extent" while
 * this function, three lines later, would have tried the next candidate.
 * Duplicated logic does not drift only in what it computes; it drifts in
 * WHETHER IT RUNS.
 */
export async function chooseAnchor(anchors, source) {
  const passedOver = [];
  for (const cand of anchors ?? []) {
    const e = await source.entity(cand.id);
    if (e === null || e === undefined) return { refused: true, entity: null, scopes: [], passedOver };
    const scopes = (e.relations ?? []).filter((r) => r.scope?.from != null && r.scope?.to != null);
    if (scopes.length) return { refused: false, entity: e, scopes, passedOver };
    passedOver.push({ id: cand.id, label: cand.label ?? null, why: "holds nothing with a bounded extent" });
  }
  return { refused: false, entity: null, scopes: [], passedOver };
}

/**
 * seekBindings — the whole walk, over any source.
 *
 * It CHOOSES NOTHING among the anchor's scopes: every scope the anchor holds
 * is bound against and reported, including the empty ones, because the
 * question does not say which is meant and picking silently would invent its
 * own scope. A caller ranks by coverage.
 */
export async function seekBindings({ anchor, slot, kind = null }, source, { span = null, relation = null } = {}) {
  const steps = [];
  const anchors = await source.resolve(anchor);
  const slots = await source.resolve(slot);
  steps.push({ step: "resolve", anchor: anchors?.slice(0, 5) ?? [], slot: slots?.slice(0, 5) ?? [] });
  if (!anchors?.length || !slots?.length) return { gap: { type: "unbound_surface", detail: "a surface named nothing this source knows" }, steps };

  // THE QUESTION PICKS THE REFERENT, not the source's ranking.
  //
  // Taking `candidates[0]` was a real, measured failure: asked "who was
  // lincoln's vp?", the bare surname resolved first to a PLACE, a place
  // holds no dated office, and the walk reported "Lincoln holds nothing with
  // a bounded extent" — a true sentence about the wrong Lincoln. The rival
  // readings were right there in the candidate list, unexamined.
  //
  // So candidates are tried in the source's order until one can actually
  // support the question — here, until one holds a relation with a bounded
  // extent, since the whole walk binds by extent. That is not a preference
  // for a "better" entity; it is a REQUIREMENT the question already carries,
  // used as the discriminator instead of a guess. What was passed over is
  // reported, so a reader can see the ambiguity was real and how it closed.
  const chosen = await chooseAnchor(anchors, source);
  if (chosen.refused) return { gap: { type: "source_refused", detail: "the anchor could not be read" }, steps };
  const { entity: anchorEntity, scopes, passedOver } = chosen;
  steps.push({ step: "anchor-scopes", chose: anchorEntity?.id ?? null, count: scopes.length, passedOver });
  if (!anchorEntity) {
    return {
      gap: {
        type: "no_scoped_relations",
        detail: `no reading of "${anchor}" holds anything with a bounded extent (tried ${anchors.length})`,
      },
      steps,
    };
  }

  // Narrow the generic slot to the one that applies here, when the source
  // has such a notion; otherwise the generic slot stands.
  let slotId = slots[0].id;
  if (typeof source.specialize === "function") {
    const special = await source.specialize(slotId, { entity: anchorEntity, scopes });
    if (special?.length) { slotId = special[0]; steps.push({ step: "specialize", to: slotId }); }
  }

  let rel = relation;
  if (!rel) {
    const learned = await learnRelation(slotId, source, { kind });
    steps.push({ step: "learn-relation", candidates: learned.candidates.map((c) => ({ relation: c.relation, witnesses: c.count })), examined: learned.examined, settled: learned.settled, refused: learned.refused });
    rel = learned.candidates[0]?.relation ?? null;
    if (!rel) return { gap: { type: "no_relation_learned", detail: `nothing observed relates members to ${slotId}` }, steps };
  }

  const memberIds = await source.membersOf(rel, slotId);
  if (memberIds === null || memberIds === undefined) return { gap: { type: "source_refused", detail: "the member search was declined" }, steps };
  const members = await source.entities(memberIds);
  if (members === null || members === undefined) return { gap: { type: "source_refused", detail: "reading the members was declined partway; a partial set would understate them" }, steps };
  steps.push({ step: "members", relation: rel, found: memberIds.length });

  const perScope = scopes.map((scope) => {
    const bound = [];
    for (const m of members ?? []) {
      for (const r of m.relations ?? []) {
        if (r.relation !== rel || r.value !== slotId) continue;
        const s = r.scope;
        if (!s?.from || !(s.from >= scope.scope.from && s.from < scope.scope.to)) continue;
        // CUSTODY SURVIVES THE WALK. Whatever address a source put on the
        // relation travels with the binding — a qid for one giver, a byte
        // range in a saved page for another. Dropping it here made a binding
        // that could be stated but not walked back to, which is the one thing
        // this instrument's provenance rules exist to prevent.
        bound.push({ id: m.id, label: m.label, scope: s, prev: r.prev ?? null, next: r.next ?? null, span: r.span ?? null });
      }
    }
    bound.sort((a, b) => String(a.scope.from).localeCompare(String(b.scope.from)));
    return { scope, bound, coverage: coverage(scope.scope, bound, { span }) };
  });
  steps.push({ step: "bind", perScope: perScope.map((p) => ({ relation: p.scope.relation, bound: p.bound.length, tiles: p.coverage.tiles })) });
  return { slot: slotId, relation: rel, perScope, steps };
}

/**
 * chainCloses — do the bound members' own prev/next pointers name each other?
 * Identity, not spelling: ids are compared, never labels.
 */
export function chainCloses(bound) {
  const byId = new Map((bound ?? []).map((b) => [b.id, b]));
  const links = [];
  const openEnds = [];
  for (const b of bound ?? []) {
    const fwd = b.next && byId.get(b.next);
    if (fwd) links.push({ from: b.id, to: fwd.id, mutual: fwd.prev === b.id });
    else if (b.next) openEnds.push({ from: b.id, names: b.next, direction: "after" });
    if (b.prev && !byId.has(b.prev)) openEnds.push({ from: b.id, names: b.prev, direction: "before" });
  }
  return { links, openEnds, mutual: links.length > 0 && links.every((l) => l.mutual) };
}
