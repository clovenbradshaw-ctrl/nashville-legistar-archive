// native/kernel/identity-exclusion.js — WHEN TWO REFERENTS CANNOT BE ONE:
// a contradiction on a relation their kind allows only one value of
// (2026-09-27). Medium-blind, kernel-level. Standing: nomination until
// eval/identity/exclusion-eval.mjs says otherwise.
//
// THE USER'S RULE, verbatim: "Two referents with different birthdays cannot
// be the same person." And the frame around it: identity is read from the
// actual node network — the assertions about a referent — in a DEPENDENCY
// ORDER, with kind induction on those assertions; recurrence (who is around)
// is not identity, and SHOULD fail on companions (the swarm, 2026-09-27:
// co-arrival over reading time reached AUC 0.97 on Russian case forms and
// collapsed exactly on same-scene companions — Наташа/Соня, Бурьен/Марья).
//
// THE ORDER, each step licensing the next (arithmetic before geometry before
// calculus — THE-THREE-MATHEMATICS):
//   1 KIND        what each referent is. A shared kind is what makes step 2
//                 askable at all: "one birth date" is a fact about PEOPLE.
//                 Two kinds a giver declares disjoint exclude outright.
//   2 FUNCTIONAL  which relations that kind allows one value of. A GIVEN entry
//                 (a named giver) may convict. An INDUCED candidate
//                 (kind-functional-induction.js) may only RAISE a conflict,
//                 never convict: a corpus can refute a functional claim and
//                 cannot establish one (the grain theorem), so what it learned
//                 is a hypothesis, and a hypothesis does not sentence (kelsen).
//   3 VALUES      both referents assert the relation and no pair of their
//                 values agrees -> EXCLUDED, and the two assertions are the
//                 proof. A value pair the comparison cannot decide (a year
//                 against a day in another calendar) is INCOMPARABLE — never
//                 read as a conflict.
//
// WHAT THIS DOES NOT SAY. "unbound" is not "same": two siblings share a
// father and a mother and no conflict needs to appear until a birth date
// does. Sameness needs positive evidence from elsewhere (the assertion
// network, identity-induction.js); this organ is the other half of the
// definition — the counterexample that no amount of co-presence can outvote.
//
// ONE LATTICE (archon review 2026-09-27, nagarjuna + kelsen). This organ is
// the AGAINST support for the claim "a and b are one": its verdicts are
// hl.js's own values, never private words —
//   contradicted  a conflict on a relation a named GIVER declared one-valued,
//                 standing on witnessed assertions: the claim is refuted
//   unbound       no conviction: nothing conflicts, or the only conflicts rest
//                 on an induced CANDIDATE (a candidate may raise a conflict,
//                 never convict — kelsen) or on an unwitnessed assertion; the
//                 conflicts ride on the result, typed, with their reason
//   beyond-reach  the frame cannot ask: no shared kind, no one-valued relation
//                 declared or induced, or a register built past the cursor
// It never returns bound: failing to find a conflict is not evidence of
// sameness. Identity itself — the positive pattern — is identity-induction's;
// kernel/identity-verdict.js composes the two supports through hl.js.
//
// Nothing here compares strings. What a value is, and when two values are
// the same, is injected (`sameValue`) — a date in a calendar, a referent id
// (which may itself be an identity question one level down the holon), a
// quantity with units.

import { CONTRADICTED, UNBOUND, BEYOND_REACH } from "../interpretation/hl.js";

const need = (o, keys) => { for (const k of keys) if (typeof o[k] !== "function" && !(o[k] instanceof Map)) throw new TypeError(`identity-exclusion: '${k}' must be supplied`); };

/**
 * makeIdentityExclusion({ kindsOf, assertionsOf, functional, disjointKinds?, sameValue })
 *   kindsOf(x)        -> Set of kind ids the referent is asserted to be (with
 *                        whatever standing the caller requires); empty = unknown
 *   assertionsOf(x)   -> [{ rel, value, id }]
 *   functional        Map<kind, Map<rel, { giver }>>   — the received register
 *   disjointKinds     Map<kind, Map<kind, { giver }>>  — optional
 *   sameValue(u, v, rel) -> true | false | null (cannot tell)
 *   witnessed(assertion) -> boolean   — optional. A proof must STAND: when
 *                        supplied, a conflict is a proof only if both of its
 *                        assertions are witnessed; otherwise it is CONTESTED —
 *                        a disagreement on the record, not two referents.
 *                        Found live (2026-09-27): Sergey Volkonsky's own
 *                        Wikidata item holds two death dates that no calendar
 *                        reconciles (1784-03-08 Julian, unreferenced;
 *                        1784-03-10 Gregorian, referenced) and two birth
 *                        years (1715, 1703); split across two records they
 *                        "proved" one man was two.
 */
export function makeIdentityExclusion(organs = {}) {
  need(organs, ["kindsOf", "assertionsOf", "functional", "sameValue"]);
  const { kindsOf, assertionsOf, functional, sameValue, disjointKinds = new Map(), witnessed = null, registerAsOf = null } = organs;
  // An entry is either GIVEN (a named giver) or an induced CANDIDATE carrying
  // its evidence (kernel/kind-functional-induction.js). Nothing else: a
  // single-valued relation is never simply assumed.
  for (const [kind, rels] of functional) for (const [rel, d] of rels) if (!d?.giver && !(d?.standing === "candidate" && d?.evidence)) throw new TypeError(`identity-exclusion: functional(${kind}, ${rel}) has no giver and no candidate evidence — a single-valued relation is received or induced, never assumed`);

  // judge(a, b, { at, asOf, relevant })
  //   asOf      the READING cursor: only assertions with seq <= asOf are
  //             believed yet (an assertion without seq is always believed)
  //   at        the TIME being asked about: for a one-at-a-time parameter only
  //             values whose interval contains `at` are compared; with no `at`,
  //             a one-at-a-time parameter's values conflict only when their
  //             intervals overlap — disjoint intervals are change, not two
  //             referents
  //   relevant  the for-whom's frame: which relations it asks about
  function judge(a, b, { at = null, asOf = null, relevant = null } = {}) {
    const order = [];
    const frame = { at, asOf, relevant: relevant ? "declared" : null };
    // the register that licenses step 2 must not be ahead of the reading
    // cursor: standings earned at seq 50 cannot license a verdict as of seq 10
    // (muninn / clippy). A register with no cursor was built from everything.
    if (asOf != null && (registerAsOf == null || registerAsOf > asOf)) return Object.freeze({ a, b, verdict: BEYOND_REACH, reason: "register_ahead_of_cursor", frame, registerAsOf });
    const believed = (xs) => (asOf == null ? xs : xs.filter((x) => x.seq == null || x.seq <= asOf));
    const holdsAt = (x) => at == null || !x.interval || ((x.interval.lo ?? -Infinity) <= at && at <= (x.interval.hi ?? Infinity));
    const overlap = (x, y) => { if (!x.interval || !y.interval) return null; return Math.max(x.interval.lo ?? -Infinity, y.interval.lo ?? -Infinity) <= Math.min(x.interval.hi ?? Infinity, y.interval.hi ?? Infinity); };
    // 1 — kind
    const ka = kindsOf(a) ?? new Set(), kb = kindsOf(b) ?? new Set();
    if (!ka.size || !kb.size) return Object.freeze({ a, b, verdict: UNBOUND, reason: "kind_unknown", frame, order: [{ step: "kind", a: [...ka], b: [...kb] }] });
    for (const x of ka) for (const y of kb) {
      const d = disjointKinds.get(x)?.get(y) ?? disjointKinds.get(y)?.get(x);
      if (d) return Object.freeze({ a, b, verdict: CONTRADICTED, by: "kind", proof: [{ kinds: [x, y], giver: d.giver }], frame, order: [{ step: "kind", a: [...ka], b: [...kb], disjoint: [x, y] }] });
    }
    const shared = [...ka].filter((k) => kb.has(k));
    order.push({ step: "kind", a: [...ka], b: [...kb], shared });
    if (!shared.length) return Object.freeze({ a, b, verdict: BEYOND_REACH, reason: "no_shared_kind", frame, order });
    // 2 — the functional relations the shared kinds license
    const rels = new Map();
    for (const k of shared) for (const [rel, d] of functional.get(k) ?? []) if (!rels.has(rel) && (!relevant || relevant(rel))) rels.set(rel, { ...d, kind: k });
    if (!rels.size) { order.push({ step: "functional", licensed: [] }); return Object.freeze({ a, b, verdict: BEYOND_REACH, reason: "no_functional_relation_declared", frame, order }); }
    // 3 — values
    const Aa = believed(assertionsOf(a) ?? []), Ab = believed(assertionsOf(b) ?? []);
    const agreed = [], conflicts = [], incomparable = [], unasserted = [], changed = [];
    for (const [rel, d] of rels) {
      const timed = d.temporal === "one-at-a-time";
      const va = Aa.filter((x) => x.rel === rel && (!timed || holdsAt(x))), vb = Ab.filter((x) => x.rel === rel && (!timed || holdsAt(x)));
      if (!va.length || !vb.length) { unasserted.push(rel); continue; }
      let agree = null, undecided = null, lastFalse = null;
      for (const u of va) for (const v of vb) {
        let s = sameValue(u.value, v.value, rel);
        // a one-at-a-time parameter: different values at DISJOINT times are
        // change, never a conflict; at unknown times, undecidable
        if (s === false && timed && at == null) { const o = overlap(u, v); if (o === false) continue; if (o === null) s = null; }
        if (s === true) agree ??= [u, v];
        else if (s === null) undecided ??= [u, v];
        else lastFalse ??= [u, v];
      }
      if (agree) agreed.push({ rel, a: agree[0], b: agree[1] });
      else if (undecided) incomparable.push({ rel, a: undecided[0], b: undecided[1] });
      else if (!lastFalse) changed.push(rel); // every disagreement was at disjoint times: change, one referent possible
      else conflicts.push({ rel, giver: d.giver ?? null, standing: d.giver ? "given" : "candidate", evidence: d.evidence ?? null, kind: d.kind, a: lastFalse[0], b: lastFalse[1] });
    }
    order.push({ step: "functional", licensed: [...rels.keys()] }, { step: "values", agreed: agreed.map((x) => x.rel), conflicts: conflicts.map((x) => x.rel), incomparable: incomparable.map((x) => x.rel), changed, unasserted });
    // a conviction needs a GIVEN relation and witnessed assertions on both sides
    const convicting = conflicts.filter((c) => c.standing === "given" && (!witnessed || (witnessed(c.a) && witnessed(c.b))));
    const raised = conflicts.filter((c) => !convicting.includes(c)).map((c) => ({ ...c, raisedAs: c.standing !== "given" ? "candidate_conflict" : "unwitnessed_conflict" }));
    const believedCounts = { a: Aa.length, b: Ab.length };
    if (convicting.length) return Object.freeze({ a, b, verdict: CONTRADICTED, by: "functional", proof: convicting, raised, agreed, incomparable, changed, frame, believed: believedCounts, order });
    return Object.freeze({ a, b, verdict: UNBOUND, reason: raised.length ? raised[0].raisedAs : "no_conflict", raised, agreed, incomparable, changed, frame, believed: believedCounts, order });
  }
  return Object.freeze({ judge });
}
