/* Nagarjuna speaks:
 * “But can there be a more eloquent refutation of 
an opponent than the proof that he is not capable of 
establishing his own thesis”
 *
 * This file embodies Nagarjuna's Prasanga method of refutation, where refutations are entirely grounded in consequence and assertion of the opponent's own arguments.  However, its use within the code structure for refutation might potentially oversimplify the complexities of refutation, as it risks ignoring the nuances and subtleties that arise in a rigorous engagement with opponent's arguments.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/refutation.js — the veto organ: what the material REFUSES,
// Handle: Nagarjuna — after the Madhyamaka method of prasanga: refutation runs entirely by consequence, and asserts no thesis of its own. Amendment XVII.
// never what it licenses.
//
// THE GROUND IS READ, NOT CARRIED. This organ does not own its teaching as a
// comment — it reads it from the committed canon (eoreader7/canon/, the
// prasanga passage: "he used only prasanga-vākya or reductio ad absurdum
// argument... on the very principles accepted by them"), the span AND the
// window around it. `GROUND` is the canon's own bytes and `GROUND_REF` is the
// byte address they live at. To understand what this organ stands on, read
// what is around that span. The ground is load-bearing: the physics field
// (antistrauss-physics.txt) binds to the canon's sha256, so change the canon
// and the ground changes; a missing canon ungrounds the field and the gate
// refuses closed.
// canon-ground.mjs reads the canon off disk (node:*), so it is imported only
// under Node; this module stays loadable in the browser, where the ground is absent.
const __isNode = typeof process !== "undefined" && !!process.versions?.node;
const __canonGround = __isNode ? (await import("../the-fold/canon-ground.mjs")).loadCanonGround() : null;
const __refutationGround = __canonGround?.mechanics.find((m) => m.id === "refutation") ?? null;
export const GROUND = __refutationGround ? __refutationGround.ground : null;
export const GROUND_REF = __refutationGround ? __refutationGround.ref : null;
// WHY THIS IS A VETO AND NOT A GATE, measured before it was written.
// the-fold's `eval/falsification-probe.mjs` ran six corpora with ground
// truth declared in advance through the real door and the real kernel
// nominator, and reported one decisive pair: a five-fact succession chain
// and a five-fact dominance chain, STRUCTURALLY IDENTICAL by construction
// (1:1, acyclic, every referent distinct, both nominated at identical
// support, both clearing uniqueness) and OPPOSITE in ground truth —
// succession composes soundly, "defeated" does not. The scan cannot tell
// them apart. Structure alone does not license composition, and a
// refutation-cleared candidate is therefore NOT a licence.
//
// What the same probe showed this organ CAN do is refuse, and refuse for
// real: 3 of 6 corpora were correctly refused, each on a positive,
// observable counterexample. That is the whole competence, and it is
// precisely bounded — refuting a claim of transitive composition requires a
// POSITIVE counterexample, and positive-only material supplies one in
// exactly two shapes:
//
//   UNIQUENESS  a referent standing at the same end of the same relation
//               twice, with distinct partners. The bridge then conflates
//               two distinct things (the real tenure bug: one person
//               entering one office twice, so a person-level bridge joined
//               two different terms).
//   CYCLE       a → b → … → a under one relation. A cycle directly
//               contradicts a transitive ordering, and is the one refutation
//               of transitivity that positive-only material can state.
//
// Where neither is present, ABSENCE IS NOT REFUTATION: nothing in
// positive-only material says "a did not beat c", and under open-world
// semantics that silence refutes nothing. This organ therefore never
// returns "clean" — it returns what it examined and what it found, and a
// caller that reads no-refutation as a licence has made the error the probe
// was run to prevent.
//
// AND IT NEVER REPORTS A CHECK IT COULD NOT RUN (P41: the absence of a
// refusal is not a check). Refutation is structurally impossible below two
// resolved edges, so `power` is reported on every result: a relation with
// one examined edge is `insufficient`, never `unrefuted`. Edges whose ends
// are not both resolved referents are counted as `unresolved` rather than
// silently dropped — a scan that examined nothing must not read as a scan
// that found nothing.
//
// AND WHAT WAS UNRESOLVED IS NAMED, NOT ONLY COUNTED (added for THE-NULL-
// STATES.md — "anytime the model doesn't have it"). `unresolved` used to be
// a bare integer: the specific edges behind it vanished the moment they
// failed `endsOf`. Every result now also carries `voidCandidates` — one
// entry per edge with an end that never resolved to a referent, shaped
// exactly as `kernel/notes.js::declareVoid` takes it (`end1`/`label`/
// `end2`/`because`), MINUS a scope, which only a caller reading the
// material can supply (law 1: a null names its scope, and this organ
// reads none). This is deliberately NOT the void's own cell — the void is
// DEF·Ground, a declared emptiness over an ARRANGEMENT a caller went
// looking for; this organ's own null is EVA·Ground's `insufficient`, a
// scan that could not run. What ships here is a bridge: Nagarjuna asserts
// nothing and declares nothing (this file's own header, line 1) — it only
// NAMES where a caller with a real scope would have grounds to declare
// one. No call site in this repo persists these candidates yet; that
// wiring is disclosed future work, not built here.

const freeze = (value) => Object.freeze(value);

/** Both ends of an arrangement, by ORDINAL POSITION — never by role name.
 * (relation-composition.js's own rule, inherited: an arrangement has ends,
 * not parts of speech.) Returns null unless BOTH ends are resolved
 * referents; an unresolved end cannot establish a violation. */
function endsOf(edge) {
  if (edge?.schema !== "EOHyperedge@1") return null;
  const parts = edge.participants ?? [];
  const from = parts[0];
  const to = parts.length >= 2 ? parts[parts.length - 1] : null;
  if (from?.standing !== "referent" || !from.ref) return null;
  if (to?.standing !== "referent" || !to.ref) return null;
  return { from: from.ref, to: to.ref, edge };
}

/** The name a participant offers even where it never resolved to a
 * referent: its surface text where the perceiver kept one, else its raw
 * `ref` (an occurrence id, for an `unresolved_surface` participant) — the
 * same fallback `identity.js`/`relation-composition.js`/
 * `kind-graph-structure.js` already use for this exact standing. A
 * resolved referent's own `.ref` IS its identity, so this reads correctly
 * either way. Returns null only where neither is present. */
function nameOf(participant) {
  return participant?.surface ?? participant?.ref ?? null;
}

/**
 * unresolvedVoidOf(edge) — where `endsOf` would refuse this edge (either
 * end not a resolved referent), name what was lost rather than letting it
 * disappear into `unresolved`'s bare count. Returns null wherever both
 * ends resolve (nothing to name) or wherever the unresolved end offers no
 * surface and no ref at all (nothing nameable — never fabricated).
 */
function unresolvedVoidOf(edge) {
  if (edge?.schema !== "EOHyperedge@1") return null;
  const parts = edge.participants ?? [];
  if (parts.length < 2) return null;
  const from = parts[0];
  const to = parts[parts.length - 1];
  const fromOk = from?.standing === "referent" && Boolean(from.ref);
  const toOk = to?.standing === "referent" && Boolean(to.ref);
  if (fromOk && toOk) return null;
  const end1 = nameOf(from);
  if (!end1) return null;
  const side = !fromOk && !toOk ? "both ends" : !fromOk ? "the first end" : "the second end";
  return freeze({
    end1, label: edge.relation ?? null, end2: toOk ? nameOf(to) : null,
    edgeId: edge.id ?? null,
    because: `refutation examined a ${edge.relation ?? "relation"} edge whose ${side} never resolved to a referent — named here rather than silently dropped from the scan`,
  });
}

function findCycles(adjacency, limit) {
  const color = new Map();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    if (cycles.length >= limit) return;
    color.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (cycles.length >= limit) break;
      const seen = color.get(next) ?? 0;
      if (seen === 1) {
        const at = stack.indexOf(next);
        if (at >= 0) cycles.push(freeze([...stack.slice(at), next]));
      } else if (seen === 0) visit(next);
    }
    stack.pop();
    color.set(node, 2);
  };
  for (const node of adjacency.keys()) if ((color.get(node) ?? 0) === 0) visit(node);
  return cycles;
}

/**
 * refuteRelation(edges, relation, { expectUnique, cycleLimit }) — everything
 * the material positively says AGAINST treating `relation` as composable.
 *
 * `expectUnique` IS DECLARED BY THE CALLER AND DEFAULTS TO OFF, and that
 * default was earned by running this organ rather than reasoning about it.
 * Uniqueness refutes an ADJACENCY claim: immediate succession has exactly
 * one predecessor, so a referent with two is evidence of two conflated
 * tenures. It refutes NOTHING about a transitive relation, where many-to-
 * many is what transitivity MEANS — measured live on the succession
 * material, the derived closure `after:<office>` was flagged "refuted" on
 * uniqueness because Colfax is after both Hamlin AND Breckinridge, which is
 * the closure being correct. A check applied where its precondition does
 * not hold produces a refutation that means nothing; that is A10's trap
 * (a statistic insensitive to its perturbation fails invisibly), found here
 * one layer in from where this file's header already records it.
 *
 * So the caller declares the claim — `part_of` is genuinely transitive AND
 * many-to-many, `replaces` is genuinely 1:1 — and an undeclared relation
 * gets the cycle check alone. A cycle is always licensed: nothing may be
 * strictly after itself, whatever the cardinality.
 *
 * Returns `{ relation, examined, unresolved, voidCandidates, power,
 * uniqueness, cycles, refuted, reasons }`. `voidCandidates` names what
 * `unresolved` only counts — see this file's header. `refuted: false`
 * means "nothing refuted it HERE",
 * which is not the same as sound and is never to be read as one — see this
 * file's header. A uniqueness check that did not run reports
 * `checked: false`, never a pass (P41: the absence of a refusal is not a
 * check).
 */
/**
 * INTERVAL-OVERLAP — uniqueness-of-a-position becomes uniqueness-of-a-position-
 * AT-A-TIME when the material supplies intervals.
 *
 * Half-open [start, end): a handover at the same instant (one ends exactly as
 * the next begins) is DISJOINT, which is what lawful succession looks like.
 * A missing bound reads as unbounded, so an unknown interval overlaps
 * everything — the conservative direction, since disjointness is what would
 * excuse a violation and it must be shown, never assumed.
 */
const overlaps = (a, b) => {
  if (!a || !b) return true;                       // unknown: cannot show disjoint
  const s1 = a.start ?? -Infinity, e1 = a.end ?? Infinity;
  const s2 = b.start ?? -Infinity, e2 = b.end ?? Infinity;
  return s1 < e2 && s2 < e1;
};

export function refuteRelation(edges = [], relation, { expectUnique = false, cycleLimit = 3, intervalOf = null } = {}) {
  if (!relation) throw new TypeError("refuteRelation: the relation to examine is declared, never inferred from the edge set");
  const matching = (edges ?? []).filter((e) => e?.relation === relation);
  const resolved = matching.map(endsOf).filter(Boolean);
  const unresolved = matching.length - resolved.length;
  // Named, not merely counted (this file's header, above): every edge
  // behind `unresolved` that offers ANYTHING to name — a surface, an
  // occurrence ref — survives here as a void-shaped candidate a caller
  // can hand to `declareVoid` once it supplies a real scope.
  const voidCandidates = freeze(matching.map(unresolvedVoidOf).filter(Boolean));

  const forward = new Map();
  const backward = new Map();
  const forwardEdges = new Map();
  const backwardEdges = new Map();
  const adjacency = new Map();
  for (const { from, to, edge } of resolved) {
    if (!forward.has(from)) forward.set(from, new Map());
    forward.get(from).set(to, edge.id ?? null);
    if (!backward.has(to)) backward.set(to, new Map());
    backward.get(to).set(from, edge.id ?? null);
    if (!forwardEdges.has(from)) forwardEdges.set(from, []);
    forwardEdges.get(from).push(edge);
    if (!backwardEdges.has(to)) backwardEdges.set(to, []);
    backwardEdges.get(to).push(edge);
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  }

  const violations = [];
  const excused = [];
  // When intervals are supplied, standing twice at one end is only a
  // counterexample if two of those standings OVERLAP IN TIME. Two disjoint
  // standings are the same position held twice, which is lawful succession and
  // was never evidence against the relation — the office gate that refused on
  // reuse alone was destroying true facts to prevent that confusion.
  // Three outcomes, not two — and the difference is P41's. A violation may
  // stand on a MEASURED overlap (two known intervals overlap), or stand
  // because disjointness COULD NOT BE SHOWN (an interval unknown), or be
  // excused (every pair known-disjoint). The first is an interval-overlap
  // finding; the second is the base uniqueness claim with its excuse
  // unavailable — labeling it "interval-overlap" would report a measurement
  // that never happened.
  const overlapEvidence = (referentEdges) => {
    if (!intervalOf) return { stands: true, basis: "no-intervals" };
    const iv = referentEdges.map((e) => { try { return intervalOf(e) ?? null; } catch { return null; } });
    let unshowable = false;
    for (let i = 0; i < iv.length; i += 1) for (let j = i + 1; j < iv.length; j += 1) {
      if (!iv[i] || !iv[j]) { unshowable = true; continue; }
      if (overlaps(iv[i], iv[j])) return { stands: true, basis: "measured-overlap" };
    }
    if (unshowable) return { stands: true, basis: "disjointness-unshowable" };
    return { stands: false, basis: "known-disjoint" };
  };
  if (expectUnique) {
    for (const [referent, partners] of forward) {
      if (partners.size < 2) continue;
      const row = { referent, side: "functional", detail: "stands at the first end of this relation more than once, with distinct partners", partners: freeze([...partners.keys()]), edgeRefs: freeze([...partners.values()].filter(Boolean)) };
      const ev = overlapEvidence(forwardEdges.get(referent) ?? []);
      if (ev.stands) violations.push(freeze({ ...row, ...(intervalOf ? { overlapBasis: ev.basis } : {}) }));
      else excused.push(freeze({ ...row, excusedBy: "interval-disjoint", why: "stands here more than once, but never at overlapping times — the same position held twice is succession, not a uniqueness violation" }));
    }
    for (const [referent, partners] of backward) {
      if (partners.size < 2) continue;
      const row = { referent, side: "inverse-functional", detail: "stands at the second end of this relation more than once, with distinct partners", partners: freeze([...partners.keys()]), edgeRefs: freeze([...partners.values()].filter(Boolean)) };
      const ev = overlapEvidence(backwardEdges.get(referent) ?? []);
      if (ev.stands) violations.push(freeze({ ...row, ...(intervalOf ? { overlapBasis: ev.basis } : {}) }));
      else excused.push(freeze({ ...row, excusedBy: "interval-disjoint", why: "stands here more than once, but never at overlapping times — the same position held twice is succession, not a uniqueness violation" }));
    }
  }

  let cycles = findCycles(adjacency, cycleLimit);
  // A cycle is a counterexample only if it CLOSES WITHIN ONE STANDING of each
  // node. A -> B -> A where A's two standings are disjoint in time is not a
  // loop, it is a sequence: A held it, B held it, A held it again. Measured on
  // real material (the-fold, 2026-08-28): admitting intervals excused every
  // uniqueness violation on the refused office and recovered nothing, because
  // this second shape independently refused the same office. Same law, other
  // half — uniqueness-at-a-time needs cycles-at-a-time beside it.
  const excusedCycles = [];
  if (intervalOf && cycles.length) {
    const edgesBetween = new Map();
    for (const { from, to, edge } of resolved) {
      const k = `${from}\u0000${to}`;
      if (!edgesBetween.has(k)) edgesBetween.set(k, []);
      edgesBetween.get(k).push(edge);
    }
    const ivOf = (e) => { try { return intervalOf(e) ?? null; } catch { return null; } };
    const closesWithinOneStanding = (path) => {
      // walk the cycle; at each interior node the edge arriving and the edge
      // leaving must be able to share one standing (overlap) for the loop to be real
      for (let i = 1; i < path.length; i += 1) {
        const node = path[i];
        const incoming = edgesBetween.get(`${path[i - 1]}\u0000${node}`) ?? [];
        const outgoing = edgesBetween.get(`${node}\u0000${path[(i + 1) % path.length]}`) ?? [];
        if (!incoming.length || !outgoing.length) continue;      // cannot show disjoint
        const any = incoming.some((a) => outgoing.some((b) => overlaps(ivOf(a), ivOf(b))));
        if (!any) return false;                                   // this hop needs two standings
      }
      return true;
    };
    const kept = [];
    for (const path of cycles) (closesWithinOneStanding(path) ? kept : excusedCycles).push(path);
    cycles = kept;
  }

  // A scan that COULD NOT have refuted must not read as one that did not.
  const power = resolved.length < 2 ? "insufficient" : "sufficient";
  const reasons = [];
  if (violations.length) {
    const measured = violations.some((v) => v.overlapBasis === "measured-overlap");
    // "interval-overlap" names a MEASURED finding; a violation standing only
    // because disjointness could not be shown keeps the base claim's name.
    reasons.push(intervalOf && measured ? "interval-overlap" : "uniqueness");
  }
  if (cycles.length) reasons.push("cycle");

  return freeze({
    schema: "EORelationRefutation@1",
    relation,
    // THE GROUND — the canon byte address this organ stands on (Nagarjuna's
    // prasanga: refute by consequence, assert nothing), carried on the record
    // so a reader tracing a refutation verdict meets the teaching that
    // grounds it.
    groundRef: GROUND_REF,
    examined: resolved.length,
    ofEdges: matching.length,
    unresolved,
    voidCandidates,
    power,
    powerDetail: power === "insufficient"
      ? "fewer than two resolved edges carry this relation — neither a uniqueness violation nor a cycle is structurally expressible, so this scan could not have refuted anything"
      : "at least two resolved edges — both refutation shapes were expressible",
    uniqueness: freeze({
      checked: expectUnique,
      violated: violations.length > 0,
      violations: freeze(violations),
      intervalsDeclared: Boolean(intervalOf),
      excused: freeze(excused),
      ...(intervalOf ? { shape: "interval-overlap — a repeat standing refutes only where two standings overlap in time; disjoint repeats are excused and listed" } : {}),
      ...(expectUnique ? {} : { why: "not checked: this relation was not declared 1:1, and uniqueness refutes nothing about a many-to-many one" }),
    }),
    cycles: freeze({ present: cycles.length > 0, examples: freeze(cycles),
      ...(intervalOf ? { excused: freeze(excusedCycles), why: "a cycle is excused where it cannot close within one standing of each node — the return is to a later standing, which is sequence, not a loop" } : {}) }),
    refuted: reasons.length > 0,
    reasons: freeze(reasons),
    // Stated on every result so no caller can quietly upgrade silence.
    disclosure: reasons.length > 0
      ? "a positive counterexample was found in this material"
      : "no counterexample was found in THIS material; open-world absence is not refutation and this is not a licence",
  });
}

/**
 * auditChemistry(edges, hyperlexicon) — every GIVEN affordance, against what
 * the material actually says.
 *
 * The audit examines the relations an affordance NAMES (its two sides), not
 * the affordance's own conclusion: a closure is refuted when the relation it
 * closes is refuted. Candidates are not audited — they license nothing, so
 * there is nothing for a counterexample to withdraw.
 *
 * WHERE UNIQUENESS IS LICENSED IS READ OFF THE AFFORDANCE, never assumed:
 * `meta.adjacency` names the side its giver claims is 1:1 (closureAffordances
 * stamps the base). Every other relation — the transitive product above all
 * — gets the cycle check alone. Assuming it instead was a real bug this
 * organ shipped with for one run: the derived closure was reported refuted
 * because a transitive relation is many-to-many on purpose.
 *
 * Returns one row per given affordance, each carrying the per-relation
 * refutation whole, so a caller concedes on evidence rather than on a flag.
 */
export function auditChemistry(edges = [], hyperlexicon = null, { cycleLimit = 3 } = {}) {
  const composition = hyperlexicon?.composition ?? {};
  const cache = new Map();
  const scanOf = (relation, expectUnique) => {
    const key = `${relation}\u0000${expectUnique ? "1" : "0"}`;
    if (!cache.has(key)) cache.set(key, refuteRelation(edges, relation, { expectUnique, cycleLimit }));
    return cache.get(key);
  };

  const rows = [];
  for (const entry of Object.values(composition)) {
    if (entry?.standing !== "given") continue;
    const sides = [...new Set([entry.left, entry.right].filter(Boolean))];
    const claimedUnique = new Set([entry.meta?.adjacency].filter(Boolean));
    const scans = sides.map((side) => scanOf(side, claimedUnique.has(side)));
    const refutedBy = scans.filter((s) => s.refuted);
    rows.push(freeze({
      left: entry.left,
      right: entry.right,
      giver: entry.giver ?? null,
      yields: entry.meta?.yields ?? null,
      refuted: refutedBy.length > 0,
      refutedBy: freeze(refutedBy),
      scans: freeze(scans),
      // An audit over material too thin to refute is itself a disclosure.
      power: scans.every((s) => s.power === "sufficient") ? "sufficient" : "partial",
    }));
  }
  return freeze(rows);
}

/**
 * vetoedPairs(audit) — the (left, right) pairs a settle must not fire,
 * derived from an audit rather than hand-assembled by a caller. Returned as
 * plain pair objects so `reaction.js` owns its own key shape.
 */
/**
 * The giver licenses; this organ only removes.
 *
 * THE SHAPE THIS EXISTS TO ENFORCE. `refuted: false` is not a licence — the
 * twin corpora (a succession chain and a dominance chain, structurally
 * identical and opposite in truth) both clear every scan this organ can run,
 * so a caller that admits on absence-of-refutation has admitted the false twin
 * too. Two call sites had that shape, both spelling it `licensed:
 * !scan.refuted`, which reads as though the scan granted something.
 *
 * So the licensing decision must be made BEFORE this is called and passed in:
 * `licensedByGiver` is what a NAMED GIVER has taken responsibility for. This
 * returns those minus what the material positively refutes. There is no path
 * from "not refuted" to "returned": an item absent from `licensedByGiver` is
 * never returned however clean its scan, which is the property the
 * grep-level guard and `refutation-wall.test.js` both check.
 *
 * @param {Iterable} licensedByGiver keys a named giver has licensed
 * @param {Map|object} scans key -> a refuteRelation result
 * @returns {{survivors: string[], vetoed: Array, unscanned: Array, disclosure: string}}
 *   `survivors` are ONLY scanned && !refuted keys — a key with no scan lands
 *   in `unscanned` as {key, gap:"no_scan", detail}, never in survivors
 *   (an unscanned key falling into survivors was the ledger-ignorance gap
 *   this shape closes: absence of a scan is not a clean scan).
 */
export function afterVeto(licensedByGiver = [], scans = new Map()) {
  const read = (key) => (scans instanceof Map ? scans.get(key) : scans?.[key]) ?? null;
  const survivors = [], vetoed = [], unscanned = [];
  for (const key of licensedByGiver) {
    const scan = read(key);
    if (!scan) unscanned.push(freeze({ key, gap: "no_scan", detail: `no scan ran for "${key}" — unscanned is not clean, and is excluded from survivors` }));
    else if (scan?.refuted) vetoed.push(freeze({ key, reasons: freeze([...(scan.reasons ?? [])]) }));
    else survivors.push(key);
  }
  return freeze({
    survivors: freeze(survivors),
    vetoed: freeze(vetoed),
    unscanned: freeze(unscanned),
    disclosure: "survivors are what a NAMED GIVER licensed and this material did not refute — unrefuted is not earned, unscanned keys are named in `unscanned` (gap:no_scan) and never survivors, and nothing outside licensedByGiver can appear here",
  });
}

export function vetoedPairs(audit = []) {
  return freeze((audit ?? []).filter((row) => row.refuted).map((row) => freeze({ left: row.left, right: row.right, reasons: row.refutedBy.flatMap((s) => s.reasons) })));
}

/**
 * voidCandidatesFrom(audit) — every unresolved edge end named across an
 * audit's own scans (both sides of every relation `auditChemistry`
 * examined), flattened and deduped by (end1, label, end2). Mirrors
 * `vetoedPairs`'s own shape — a plain derivation off `audit`, nothing
 * this organ was not already carrying — for a caller who wants every
 * place a real scope would license a `declareVoid`, not just the ones
 * behind an audited affordance's own refutation.
 */
export function voidCandidatesFrom(audit = []) {
  const seen = new Map();
  for (const row of audit ?? []) {
    for (const scan of row?.scans ?? []) {
      for (const c of scan?.voidCandidates ?? []) {
        const key = `${c.end1} ${c.label} ${c.end2 ?? ""}`;
        if (!seen.has(key)) seen.set(key, c);
      }
    }
  }
  return freeze([...seen.values()]);
}
