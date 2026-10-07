// native/kernel/kind-functional-induction.js — KIND INDUCTION ON THE FLY, and
// which relations each induced kind holds single-valued, for ANY referent type
// (2026-09-27). Medium-blind, kernel-level. Standing: nomination.
//
// User direction: "kind induction on the fly for any arbitrary referent type" —
// identity exclusion must not rest on a register someone typed for PEOPLE.
// This composes two things the engine already has:
//
//   KIND   kernel/entity-kind-induction.js (induceEntityKindCandidates) over
//          each referent's relation PROFILE — which relations it takes part
//          in, never its name. Only kinds that pass the inducer's own
//          random-subset null are used; its "fallback nomination" licenses
//          nothing.
//   ONE-VALUEDNESS per kind, read off the values themselves, under the grain
//          theorem hl-acquire.js already states: a corpus can REFUTE that a
//          relation is single-valued and can never establish it. So a relation
//          gets exactly one of three standings for a kind, never "given":
//            unexposed  no member asserts it more than once — it was never
//                       tested, so it licenses NOTHING
//            refuted    a member holds two values that do not agree, both
//                       witnessed — a real counterexample
//            candidate  at least `exposureFloor` members asserted it more
//                       than once and every such member's values agree, and
//                       nothing refutes it — defeasible, forever
//   A value pair the comparison cannot decide counts neither way.
//
// The output plugs into kernel/identity-exclusion.js as its register: every
// entry carries standing "candidate" and its evidence counts, and an exclusion
// resting on one is itself only a candidate — revisable when the kind or the
// relation is.

import { induceEntityKindCandidates } from "./entity-kind-induction.js";
import { createSeededRng, shuffled, stableHash } from "./rng.js";

// CHARACTERISTIC-SET KINDS (2026-09-27, "fix, look to prior art"). The
// relation-profile kinds this module needs are what RDF engineering calls
// characteristic sets (Neumann & Moerkotte 2011): group referents by the EXACT
// set of relations they take part in. Emergent-schema discovery (Pham,
// Passing, Erling & Boncz 2015) then merges a set into a strict SUPERSET set —
// a record that shows fewer of a kind's relations is still of that kind — into
// the superset with the most support; two supersets tied on support is an
// AMBIGUOUS merge and is refused, never a coin flip.
//
// THE GATE IS SEARCH-AWARE (II.10 / II.23: selection is an axis). Placing a
// group chosen FOR sharing relations against random subsets of the population
// passes by construction — the failure P79 already recorded. So the null
// reruns the WHOLE procedure (group, merge) on redealt profiles: every
// (referent, relation) pairing is shuffled across referents, each relation's
// frequency and each referent's profile size kept (a relation redealt twice to
// one referent collapses — disclosed), co-occurrence destroyed. A kind is
// licensed only if its support beats the LARGEST group the null ever produced,
// at p <= alpha on LIFT = support / (the null's mean support for that same
// schema + 1), p = (#draws whose largest lift >= this lift + 1) / (draws + 1).
// Raw support was tried first and refuted by its own test: a 20-member kind
// lost to null groups that were large only because their relations are common.
// Trying more groups raises the bar, it never lowers it.
function csRoots(sigsOf) {
  const groups = new Map();
  for (const [id, sigs] of sigsOf) {
    if (!sigs.size) continue;
    const key = [...sigs].sort().join("\u0001");
    if (!groups.has(key)) groups.set(key, { key, sigs, members: [] });
    groups.get(key).members.push(id);
  }
  const list = [...groups.values()].sort((a, b) => a.sigs.size - b.sigs.size || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parent = new Map(list.map((g) => [g.key, g.key]));
  const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
  const support = new Map(list.map((g) => [g.key, g.members.length]));
  let refusedAmbiguous = 0;
  for (const g of list) {
    let best = null, bestSupport = -1, tied = false;
    for (const h of list) {
      if (h.sigs.size <= g.sigs.size) continue;
      let sub = true; for (const s of g.sigs) if (!h.sigs.has(s)) { sub = false; break; }
      if (!sub) continue;
      const root = find(h.key); const n = support.get(root);
      if (root === best) continue;
      if (n > bestSupport) { best = root; bestSupport = n; tied = false; } else if (n === bestSupport) tied = true;
    }
    if (best == null) continue;
    if (tied) { refusedAmbiguous += 1; continue; }
    const root = find(g.key); if (root === best) continue;
    parent.set(root, best); support.set(best, support.get(best) + support.get(root));
  }
  const roots = new Map();
  for (const g of list) { const r = find(g.key); if (!roots.has(r)) roots.set(r, { schema: groups.get(r).sigs, members: [] }); roots.get(r).members.push(...g.members); }
  return { roots: [...roots.values()], refusedAmbiguous };
}

export function characteristicSetKinds(features, { draws, alpha, seed, population = "cs" } = {}) {
  if (!Number.isInteger(draws) || draws < 1 || !(alpha > 0 && alpha < 1) || seed == null) throw new TypeError("characteristic-sets: draws, alpha and seed must be declared");
  const sigsOf = new Map([...features].map(([id, m]) => [id, new Set(m.keys())]));
  const observed = csRoots(sigsOf);
  const pairs = []; for (const [id, sigs] of sigsOf) for (const s of sigs) pairs.push([id, s]);
  const schemaKey = (r) => [...r.schema].sort().join("\u0001");
  const drawRoots = [];
  for (let d = 0; d < draws; d += 1) {
    const col = shuffled(pairs.map((p) => p[1]), createSeededRng({ seed, population, purpose: `cs-redeal-${d}` }));
    const redealt = new Map([...sigsOf.keys()].map((id) => [id, new Set()]));
    pairs.forEach(([id], i) => redealt.get(id).add(col[i]));
    drawRoots.push(csRoots(redealt).roots.map((r) => [schemaKey(r), r.members.length]));
  }
  // The null's own expected support for each schema, then each draw's LARGEST
  // support-over-expectation: a kind is surprising for how much more often its
  // relations co-occur than their frequencies alone make them, never for being
  // big because its relations are common.
  const expected = new Map();
  for (const roots of drawRoots) for (const [k, n] of roots) expected.set(k, (expected.get(k) ?? 0) + n / draws);
  const lift = (k, n) => n / ((expected.get(k) ?? 0) + 1);
  const maxima = drawRoots.map((roots) => Math.max(0, ...roots.map(([k, n]) => lift(k, n)))).sort((a, b) => a - b);
  const kinds = [], unlicensed = [];
  for (const r of observed.roots) {
    const n = r.members.length, k = schemaKey(r), l = lift(k, n);
    const p = (maxima.filter((x) => x >= l).length + 1) / (draws + 1);
    const schema = [...r.schema].sort();
    const row = { kindKey: `kind:cs:${stableHash(schema.join("|"))}`, memberRefs: r.members.sort(), structuralSignatures: schema, field: { stable: true, bindingEnergy: null }, support: n, expectedUnderNull: +(expected.get(k) ?? 0).toFixed(3), lift: +l.toFixed(3), p };
    if (n >= 2 && p <= alpha) kinds.push(row); else unlicensed.push({ support: n, lift: +l.toFixed(3), p, schemaSize: schema.length });
  }
  return { candidates: kinds, diagnostics: { method: "characteristic-sets", groups: observed.roots.length, licensed: kinds.length, refusedAmbiguous: observed.refusedAmbiguous, nullLargestLift: { median: +maxima[Math.floor(draws / 2)].toFixed(3), max: +maxima[draws - 1].toFixed(3) }, draws, alpha, unlicensedRoots: unlicensed.length } };
}

export function induceKindsAndFunctions(referents, { assertionsOf, sameValue, witnessed = null, exposureFloor, kindOptions, declaredKinds = null, asOf = null, objectKinds = null, kindMethod = "inducer", inProfile = null } = {}) {
  if (typeof assertionsOf !== "function" || typeof sameValue !== "function") throw new TypeError("kind-functional-induction: assertionsOf and sameValue must be supplied");
  if (!Number.isInteger(exposureFloor) || exposureFloor < 1) throw new TypeError("kind-functional-induction: exposureFloor must be declared");
  if (!kindOptions && !declaredKinds) throw new TypeError("kind-functional-induction: kindOptions must be declared (they are the kind inducer's own), or kinds declared");
  if (kindMethod !== "inducer" && kindMethod !== "characteristic-sets") throw new TypeError(`kind-functional-induction: unknown kindMethod ${kindMethod}`);
  // inProfile(rel): which relations may define a KIND. A caller filters out
  // bookkeeping relations (an external identifier, a category link) with a
  // GIVEN classification — Wikidata's own property classes — never a list typed
  // here. Standings below still read every relation.
  const induce = (f) => (kindMethod === "characteristic-sets" ? characteristicSetKinds(f, kindOptions) : induceEntityKindCandidates(f, kindOptions));
  const ids = [...referents];
  // THE READING CURSOR (archon review, muninn / clippy): kinds and standings
  // are learned only from assertions read by `asOf` (an assertion's `seq`), so
  // a register can say what it knew as of a point and never licenses a verdict
  // earlier than that. An assertion without seq is believed at every cursor.
  const read = (id) => (assertionsOf(id) ?? []).filter((a) => asOf == null || a.seq == null || a.seq <= asOf);
  // PROFILE. Round 0: which relations a referent takes part in — RDF's
  // characteristic sets (Neumann & Moerkotte 2011), IDF-weighted inside the
  // inducer as emergent-schema discovery does (Pham, Passing, Erling & Boncz
  // 2015). With `objectKinds: { rounds, referentOf, valueKind? }` declared,
  // later rounds add WHAT EACH RELATION POINTS AT — `rel>kind-of-object` for an
  // object in the population (its kind from the previous round), or
  // `rel>valueKind(value)` for one outside it — the Infinite Relational Model's
  // co-clustering of entities and the kinds they relate to (Kemp, Tenenbaum,
  // Griffiths, Yamada & Ueda 2006), iterated to a fixed partition rather than
  // sampled: a person's place of birth points at a PLACE, which a bag of
  // relation names cannot see. Stops when the partition repeats, or at the
  // declared number of rounds.
  const profile = (prevKindOf) => {
    const features = new Map();
    for (const id of ids) {
      const m = new Map();
      const put = (sig, key, a) => { if (!m.has(sig)) m.set(sig, { featureKey: key, featureValue: true, evidenceIds: new Set(), firstAt: 0, lastAt: 0 }); m.get(sig).evidenceIds.add(a.id ?? `${id}:${sig}:${m.get(sig).evidenceIds.size}`); };
      for (const a of read(id)) {
        if (inProfile && !inProfile(a.rel)) continue;
        put(`rel:${a.rel}`, a.rel, a);
        if (prevKindOf) {
          const obj = objectKinds.referentOf?.(a.value);
          const k = obj != null ? prevKindOf.get(obj) : null;
          const vk = k ?? (obj == null && objectKinds.valueKind ? objectKinds.valueKind(a.value) : null);
          if (vk) put(`rel:${a.rel}>${vk}`, `${a.rel}>${vk}`, a);
        }
      }
      if (m.size) features.set(id, m);
    }
    return features;
  };
  const partitionKey = (ks) => ks.map((k) => [...k.memberRefs].sort().join(",")).sort().join("|");
  let features = profile(null);
  let induced = declaredKinds ? { candidates: [], diagnostics: { declared: declaredKinds.length } } : induce(features);
  let kinds = declaredKinds
    ? declaredKinds.map((k) => ({ kindKey: k.kindKey, memberRefs: k.memberRefs, structuralSignatures: [], field: { stable: true, bindingEnergy: null }, declared: true }))
    : induced.candidates.filter((k) => k.field?.stable === true && !k.fallbackNomination);
  const rounds = [{ round: 0, kinds: kinds.length, partition: partitionKey(kinds) }];
  if (objectKinds && !declaredKinds) {
    if (!Number.isInteger(objectKinds.rounds) || objectKinds.rounds < 1 || typeof objectKinds.referentOf !== "function") throw new TypeError("kind-functional-induction: objectKinds needs declared rounds and referentOf");
    for (let r = 1; r <= objectKinds.rounds; r += 1) {
      const prev = new Map(); for (const k of kinds) for (const m of k.memberRefs) prev.set(m, k.kindKey);
      features = profile(prev);
      const next = induce(features);
      const nextKinds = next.candidates.filter((k) => k.field?.stable === true && !k.fallbackNomination);
      const key = partitionKey(nextKinds);
      rounds.push({ round: r, kinds: nextKinds.length, partition: key });
      induced = next; kinds = nextKinds;
      if (key === rounds[rounds.length - 2].partition) break;
    }
  }
  const kindsOfRef = new Map(ids.map((id) => [id, new Set()]));
  for (const k of kinds) for (const m of k.memberRefs) kindsOfRef.get(m)?.add(k.kindKey);

  // TIME (2026-09-27, user direction: "the parameters that at a given cursor
  // and a particular for-whom cannot be contradictory"). An assertion may carry
  // `interval: { lo, hi }` — when its value holds, as numbers the caller chose
  // (years, story days, reading positions); absent = not known. Two values
  // DISAGREE; whether that is a contradiction depends on time:
  //   overlapping intervals  -> simultaneous: the parameter holds several at once
  //   disjoint intervals     -> change: one at a time
  //   either interval absent -> the time is not known: evidence for neither
  // So each relation, per kind, is one of:
  //   fixed           exposed, and no member's witnessed values ever disagree
  //   one-at-a-time   no simultaneous disagreement, and >= exposureFloor members
  //                   show CHANGE — one value at any moment, not for ever
  //   many-valued     a witnessed SIMULTANEOUS disagreement (refuted as one-valued)
  //   time-unknown    disagreements exist but none is placed in time
  //   unexposed       never asserted twice for one member
  const overlap = (x, y) => {
    if (!x.interval || !y.interval) return null;
    const lo = Math.max(x.interval.lo ?? -Infinity, y.interval.lo ?? -Infinity);
    const hi = Math.min(x.interval.hi ?? Infinity, y.interval.hi ?? Infinity);
    return lo <= hi;
  };
  const register = new Map(), relations = new Map();
  for (const k of kinds) {
    const rels = new Map();
    for (const m of k.memberRefs) {
      const byRel = new Map();
      for (const a of read(m)) { if (!byRel.has(a.rel)) byRel.set(a.rel, []); byRel.get(a.rel).push(a); }
      for (const [rel, vs] of byRel) {
        const r = rels.get(rel) ?? { members: 0, exposed: 0, agreed: 0, changed: 0, simultaneous: 0, untimed: 0, refutedBy: [] };
        r.members += 1;
        if (vs.length > 1) {
          r.exposed += 1;
          let sim = null, change = false, untimed = false, anyDisagree = false;
          for (let i = 0; i < vs.length; i += 1) for (let j = i + 1; j < vs.length; j += 1) {
            if (sameValue(vs[i].value, vs[j].value, rel) !== false) continue;
            if (witnessed && !(witnessed(vs[i]) && witnessed(vs[j]))) continue; // an unwitnessed disagreement is not evidence
            anyDisagree = true;
            const o = overlap(vs[i], vs[j]);
            if (o === true) sim ??= [vs[i], vs[j]]; else if (o === false) change = true; else untimed = true;
          }
          if (sim) { r.simultaneous += 1; if (r.refutedBy.length < 3) r.refutedBy.push({ member: m, a: sim[0].id, b: sim[1].id }); }
          else if (change) r.changed += 1;
          else if (untimed) r.untimed += 1;
          else if (!anyDisagree) r.agreed += 1;
        }
        rels.set(rel, r);
      }
    }
    const entries = new Map(); const table = {};
    for (const [rel, r] of rels) {
      const disagreed = r.simultaneous + r.changed + r.untimed;
      const standing = r.simultaneous > 0 ? "many-valued"
        : r.changed >= exposureFloor && r.untimed === 0 ? "one-at-a-time"
        : disagreed === 0 && r.agreed >= exposureFloor ? "fixed"
        : disagreed > 0 ? "time-unknown" : "unexposed";
      table[rel] = { standing, ...r };
      if (standing === "fixed" || standing === "one-at-a-time") entries.set(rel, { standing: "candidate", temporal: standing, evidence: { members: r.members, exposed: r.exposed, agreed: r.agreed, changed: r.changed }, kind: k.kindKey });
    }
    register.set(k.kindKey, entries); relations.set(k.kindKey, table);
  }
  return Object.freeze({
    kinds: kinds.map((k) => ({ kindKey: k.kindKey, members: k.memberRefs, signatures: k.structuralSignatures, bindingEnergy: k.field.bindingEnergy })),
    kindsOf: (id) => kindsOfRef.get(id) ?? new Set(),
    register, relations, builtAsOf: asOf,
    diagnostics: { referents: ids.length, profiled: features.size, kinds: kinds.length, inducer: induced.diagnostics, rounds: rounds.map(({ round, kinds: n }) => ({ round, kinds: n })), converged: rounds.length > 1 ? rounds[rounds.length - 1].partition === rounds[rounds.length - 2].partition : null },
  });
}
