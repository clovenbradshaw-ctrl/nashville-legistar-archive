// chains.js — a chain verified by its own cross-checked pointers, and the
// contiguous segments within it, genre-blind. Pure.
//
// User direction, verbatim (2026-08-27), after `successionFillers` shipped
// wired directly to Wikipedia's own vocabulary ("office", "president", "In
// office"): "'box subjects' is a wikipedia specific, office of, all of this
// is designed to solve this one problem when what we need is a universal
// system for answering any question."
//
// THE CUT THIS FILE MAKES. A succession box, a version history, a chain of
// custody, a championship's own title-holder sequence — every one of them
// is the SAME object: records with an id, a pointer to whatever came before
// and after, and fields. What differs between genres is only (a) how raw
// material becomes records shaped like that, and (b) which field groups
// records into one slot and which field states a record's own extent. This
// file does neither (a) nor (b) — it is the ONE thing every such chain
// shares: verifying adjacency by cross-checked pointers, and finding the
// contiguous runs within it. succession.js is now a READER onto this — it
// turns Wikipedia's own box shape into records this file has never heard of
// a president or an office, and never will.
//
// THE ONE SUBTLE RULE, generalized past the genre it was first found in.
// succession.js's own original header names it for Wikipedia specifically:
// a later box's `precededBy` must match the EARLIER box's already-resolved
// subject, not merely its raw text. Stated for any chain: where BOTH sides
// of an adjacency speak (a record's own `next` AND its neighbor's own
// `prev`), they must agree, or the link is not verified — never a guess
// between two disagreeing witnesses.

/** Default identity: exact match after the caller's own fold (or none). A
 * caller whose ids are names in prose (a bare surname vs. a titled full
 * name) injects a containment matcher instead — succession.js's own
 * `namesMatch` is the worked example, unchanged, now handed in rather than
 * assumed. */
export const exactMatch = (a, b) => a != null && b != null && a === b;

/**
 * records: [{id, prev?, next?, seq?, fields?}]. With numeric seq on every
 * record, order comes from seq and each consecutive pair's pointers are
 * checked against it (a seq gap splits the chain — a gap is a boundary,
 * never an error). Without seq, order is recovered from the pointers
 * alone, and structural impossibilities refuse typed: duplicate_id / fork /
 * mismatched_link / cycle / orphans. Where both sides of an adjacency
 * speak, they must agree; a link one side asserts and the other
 * contradicts is never verified. `sides` counts corroboration — 2 when
 * both records assert the link, 1 when only one does.
 */
export function verifyChain(records, { matches = exactMatch } = {}) {
  const recs = (records ?? []).filter((r) => r && r.id != null);
  if (!recs.length) return { ok: false, refused: { type: "empty_material", detail: "no records with ids" } };
  for (let i = 0; i < recs.length; i++)
    for (let j = i + 1; j < recs.length; j++)
      if (matches(recs[i].id, recs[j].id))
        return { ok: false, refused: { type: "duplicate_id", detail: `"${recs[i].id}" / "${recs[j].id}"` } };

  if (recs.every((r) => Number.isFinite(r.seq))) {
    const ordered = [...recs].sort((a, b) => a.seq - b.seq);
    const chains = [];
    let order = [ordered[0]];
    let links = [];
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      if (b.seq !== a.seq + 1) {
        chains.push({ order, links });
        order = [b];
        links = [];
        continue;
      }
      const forward = a.next != null && matches(a.next, b.id);
      const backward = b.prev != null && matches(b.prev, a.id);
      const contradicted = (a.next != null && !forward) || (b.prev != null && !backward);
      links.push({
        from: a.id,
        to: b.id,
        sides: (forward ? 1 : 0) + (backward ? 1 : 0),
        contradicted,
        verified: !contradicted && (forward || backward),
      });
      order.push(b);
    }
    chains.push({ order, links });
    return { ok: true, mode: "seq", chains };
  }

  const pred = new Map();
  for (const b of recs) {
    const cands = recs.filter(
      (a) => a !== b && ((a.next != null && matches(a.next, b.id)) || (b.prev != null && matches(b.prev, a.id))),
    );
    if (cands.length > 1) return { ok: false, refused: { type: "fork", detail: `"${b.id}" has ${cands.length} predecessor candidates` } };
    if (cands.length === 1) {
      const a = cands[0];
      const forward = a.next != null && matches(a.next, b.id);
      const backward = b.prev != null && matches(b.prev, a.id);
      if ((a.next != null && !forward) || (b.prev != null && !backward))
        return { ok: false, refused: { type: "mismatched_link", detail: `"${a.id}" → "${b.id}": the two records disagree` } };
      pred.set(b, { a, sides: (forward ? 1 : 0) + (backward ? 1 : 0) });
    }
  }
  const succCount = new Map();
  for (const [, { a }] of pred) {
    succCount.set(a, (succCount.get(a) ?? 0) + 1);
    if (succCount.get(a) > 1) return { ok: false, refused: { type: "fork", detail: `"${a.id}" precedes more than one record` } };
  }
  const starts = recs.filter((r) => !pred.has(r));
  if (!starts.length) return { ok: false, refused: { type: "cycle", detail: "no start — every record has a predecessor" } };
  const succ = new Map([...pred].map(([b, { a, sides }]) => [a, { b, sides }]));
  const consumed = new Set();
  const chains = [];
  for (const s of starts) {
    const order = [s];
    const links = [];
    consumed.add(s);
    let cur = s;
    while (succ.has(cur)) {
      const { b, sides } = succ.get(cur);
      if (consumed.has(b)) return { ok: false, refused: { type: "cycle", detail: `"${b.id}" reached twice` } };
      links.push({ from: cur.id, to: b.id, sides, contradicted: false, verified: true });
      order.push(b);
      consumed.add(b);
      cur = b;
    }
    chains.push({ order, links });
  }
  if (consumed.size !== recs.length)
    return { ok: false, refused: { type: "orphans", detail: `${recs.length - consumed.size} record(s) in no chain` } };
  return { ok: true, mode: "links", chains };
}

const sameVal = (a, b, matches) => (a == null && b == null) || (a != null && b != null && matches(a, b));

/**
 * Contiguous runs of one chain sharing a field value. A run is CLOSED when
 * its internal links are all verified and each end is bounded by something
 * other than silence: a verified different-valued neighbor (strongest —
 * the chain proves the space stops there), the end record's own pointer to
 * an id outside this record set (the chain continues, named, beyond this
 * material), or a declared terminus (no pointer at all — the record claims
 * to be an end). An unverified link at a boundary leaves that end OPEN,
 * and an open end leaves the segment open — a segment is never closed by
 * silence.
 */
export function segmentsByField(chain, { field, matches = exactMatch } = {}) {
  if (!field) throw new Error("chains: segmentsByField requires a field");
  const order = chain?.order ?? [];
  if (!order.length) return [];
  const links = chain.links ?? [];
  const val = (r) => r.fields?.[field] ?? null;
  const segs = [];
  let start = 0;
  for (let i = 1; i <= order.length; i++) {
    if (i < order.length && sameVal(val(order[i]), val(order[i - 1]), matches)) continue;
    const members = order.slice(start, i);
    const first = members[0];
    const last = members[members.length - 1];
    const before =
      start === 0
        ? first.prev != null
          ? { type: "named-outside", neighbor: first.prev }
          : { type: "terminus" }
        : links[start - 1]?.verified
          ? { type: "different-neighbor", neighbor: order[start - 1].id }
          : { type: "open", detail: "unverified link at the boundary" };
    const after =
      i === order.length
        ? last.next != null
          ? { type: "named-outside", neighbor: last.next }
          : { type: "terminus" }
        : links[i - 1]?.verified
          ? { type: "different-neighbor", neighbor: order[i].id }
          : { type: "open", detail: "unverified link at the boundary" };
    const internallyVerified = links.slice(start, i - 1).every((l) => l.verified);
    segs.push({
      value: val(first),
      members,
      bounds: { before, after },
      internallyVerified,
      closed: internallyVerified && before.type !== "open" && after.type !== "open",
    });
    start = i;
  }
  return segs;
}

/** The giver, phrased for a record or a prompt — what actually bounds this
 * segment, said plainly, graded rather than flattened to "closed". */
export const closurePhrase = (seg) => {
  const side = (b) =>
    b.type === "different-neighbor"
      ? `a verified neighbor outside the set ("${b.neighbor}")`
      : b.type === "named-outside"
        ? `the record's own pointer to "${b.neighbor}", outside this material`
        : b.type === "terminus"
          ? "a declared end of the chain"
          : "an open end";
  return `chain-verified order, bounded before by ${side(seg.bounds.before)} and after by ${side(seg.bounds.after)}`;
};

/**
 * The universal filler shape a void's own `fill()` needs — {filler, span,
 * source} — from any set of generic records, genre-blind. Composes
 * verifyChain + segmentsByField + a CALLER-declared span reader; nothing
 * here decides what a record's own extent means (a date line, a page
 * range, a version number) — that stays the reader's, per record.
 *
 * `groupBy(record) -> key` decides which records share one slot (a
 * succession-box reader groups by office+president; a different genre
 * groups by whatever ITS OWN records name — a chain-of-custody log by
 * evidence id, a championship list by the title itself). Only groups with
 * 2+ records are considered — a single-holder slot has nothing to verify a
 * closure boundary against and is left for the caller's own singular-case
 * handling, not silently forced through this arithmetic.
 *
 * `spanOf(record) -> {from,to}|null` reads ONE record's own stated extent.
 * A record with no readable span still contributes as a witness (`fill()`'s
 * own contract: a null span is disclosed absence, never guessed).
 */
export function chainFillers(records, { groupBy, spanOf, matches = exactMatch } = {}) {
  if (typeof groupBy !== "function") throw new TypeError("chainFillers: groupBy is the caller's — this file has no genre vocabulary of its own");
  if (typeof spanOf !== "function") throw new TypeError("chainFillers: spanOf is the caller's — reading a record's own extent is genre-specific");
  const byGroup = new Map();
  for (const r of records ?? []) {
    const key = groupBy(r);
    if (key == null) continue;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(r);
  }
  const fillers = [];
  for (const group of byGroup.values()) {
    if (group.length < 2) continue;
    const chain = verifyChain(group, { matches });
    if (!chain.ok) continue;
    for (const c of chain.chains) {
      // A length-1 sub-chain verified nothing — the record shares the
      // group's key but connects to no one, so nothing here has been
      // CHAIN-verified for it; it is exactly as unconfirmed as a record
      // this function was never handed. And an INTERNAL contradiction
      // (seq-mode's own way of surfacing a mismatch: both records still
      // land in one `order`, only the link's own `.verified` disagrees) is
      // the identical unconfirmed state wearing a longer array — checked
      // directly rather than inferred from length, or a seq-adjacent pair
      // whose pointers disagree would ship as if it had chain-verified.
      if (c.order.length < 2 || !c.links.every((l) => l.verified)) continue;
      // Every record in `group` already shares one groupBy key by
      // construction, so the whole sub-chain IS one segment — the closure
      // question is only ever about its two ends, never an internal scan.
      const first = c.order[0];
      const last = c.order[c.order.length - 1];
      const before =
        first.prev != null ? { type: "named-outside", neighbor: first.prev } : { type: "terminus" };
      const after =
        last.next != null ? { type: "named-outside", neighbor: last.next } : { type: "terminus" };
      const giver = closurePhrase({ bounds: { before, after } });
      for (const member of c.order) {
        fillers.push({ filler: member.id, span: spanOf(member), source: giver, _record: member });
      }
    }
  }
  return fillers;
}
