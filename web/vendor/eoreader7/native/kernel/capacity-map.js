// native/kernel/capacity-map.js — THE CAPACITY MAP (THE-CAPACITY-MAP.md; removed from the tree, git 2f81545:native/docs/).
//
// Three classes of mathematics (arithmetic, geometric, transcendental) by three
// positions (the cube's three grains), read as a lattice of what a reader has
// EARNED the right to say. It places claims and summarises them as a profile;
// it never classifies material (the cube is not a content classifier — 95.7% of
// cell assignments survived shuffling the words) and never ranks persons.
//
// WHAT IS DERIVED AND WHAT IS NOT (the document's section 1, kept beside the code
// so the two cannot drift):
//   - the nine places and the three positions are READ OFF cube.js and restated
//     nowhere in this file (a source-scan pins that);
//   - the classes and what each grants are READING-SPEC S10's, quoted;
//   - the class <-> domain identification is the ONE nominated table below
//     (CLASS_DOMAIN), THE-THREE-MATHEMATICS section I, nomination standing;
//   - the crossing rule as an ORDER over profiles is this map's own extension of a
//     per-claim chain both sources state, and it is exported as data (CROSSINGS)
//     so a crossing that the evidence does not support can be removed and kept,
//     with its result, in UNSUPPORTED_CROSSINGS — the map carries its own
//     falsification history.
//
// MEDIUM-BLIND: an order is an integer; a place is a (class, position) pair.
// Nothing here knows what a reader reads.

import { DOMAINS, GRAINS, TERRAIN_BY_DOMAIN } from "./cube.js";

const freeze = Object.freeze;
const gap = (type, detail = {}) => freeze({ gap: type, ...detail });

/**
 * NOMINATION. The three classes of mathematics and the domain that hosts each.
 * `tier`, `grants` and the failure-mode wording are READING-SPEC S10 (giver:
 * earned-here 47394b1); the domain identification is THE-THREE-MATHEMATICS
 * section I (nomination standing, where the cube's own tables win any
 * disagreement). The domain is taken by INDEX from cube.js's DOMAINS order —
 * which is the canonical chain's domain-major order — so no domain name is
 * restated here. `wall` is how the class is faked, in the sources' own words.
 */
export const CLASS_DOMAIN = freeze([
  freeze({
    id: "arithmetic",
    domain: DOMAINS[0],
    tier: "LOG",
    grants: "what is possible — identity and witness, by monotone count",
    wall: "presupposes the unit: counting is meaningless before individuation settles what counts as one",
    giver: "READING-SPEC S10 (tier, grant); THE-THREE-MATHEMATICS section I and II (domain, wall)",
  }),
  freeze({
    id: "geometric",
    domain: DOMAINS[1],
    tier: "PRESENCE",
    grants: "standing — a null's frequency ratio",
    wall: "locates and never names: position is not identity",
    giver: "READING-SPEC S10 (tier, grant); THE-THREE-MATHEMATICS section I and II (domain, wall)",
  }),
  freeze({
    id: "transcendental",
    domain: DOMAINS[2],
    tier: "INFORMATION",
    grants: "direction — information, with its probability semantics earned",
    wall: "the dark room, uncalibrated rates, integration that is not idempotent over identity",
    giver: "READING-SPEC S10 (tier, grant); THE-THREE-MATHEMATICS section I and II (domain, wall)",
  }),
]);

export const CLASS_IDS = freeze(CLASS_DOMAIN.map((c) => c.id));

/** The three positions ARE the cube's three grains. */
export const POSITIONS = GRAINS;

const classRow = (klass) => CLASS_DOMAIN.find((c) => c.id === klass) ?? null;
const requireClass = (klass) => {
  const row = classRow(klass);
  if (!row) throw new TypeError(`capacity-map: unknown class ${JSON.stringify(klass)} — the classes are ${CLASS_IDS.join(", ")}`);
  return row;
};

/** The nine places, derived: one per (class, position), terrain from the cube. */
export const PLACES = freeze(
  CLASS_DOMAIN.flatMap((c) =>
    POSITIONS.map((position, order) =>
      freeze({ klass: c.id, position, order, terrain: TERRAIN_BY_DOMAIN[c.domain][position] }),
    ),
  ),
);

export const terrainAt = (klass, position) => {
  const row = requireClass(klass);
  if (!POSITIONS.includes(position)) throw new TypeError(`capacity-map: unknown position ${JSON.stringify(position)}`);
  return TERRAIN_BY_DOMAIN[row.domain][position];
};

/** The place a terrain occupies, or null — an unknown terrain is the caller's to handle. */
export const placeOf = (terrain) => PLACES.find((p) => p.terrain === terrain) ?? null;

// ── orders: the same lattice continued, so a ring is not a second structure ──
// order = ring * (positions per ring) + position index. "Each ring's residue is
// the next ring's ground" (THE-MORAL-HELIX): order 3 is the next ring's first
// ground, not a new dimension.

export const orderOf = (position, ring = 0) => {
  const at = POSITIONS.indexOf(position);
  if (at < 0) throw new TypeError(`capacity-map: unknown position ${JSON.stringify(position)}`);
  if (!Number.isInteger(ring) || ring < 0) throw new TypeError("capacity-map: ring is a non-negative integer");
  return ring * POSITIONS.length + at;
};
export const positionOfOrder = (order) => POSITIONS[((order % POSITIONS.length) + POSITIONS.length) % POSITIONS.length];
export const ringOfOrder = (order) => Math.floor(order / POSITIONS.length);

const isOrder = (n) => Number.isInteger(n) && n >= 0;

/**
 * profile({ arithmetic, geometric, transcendental }) — each an order (integer
 * >= 0). There is NO profile below the first ground in a class: a reader has, at
 * the least, declared a ground in each (a for-whom with a question), and a class
 * with none is a typed gap — never zero, never a default. No view from nowhere.
 */
export function profile(orders = {}) {
  const missing = CLASS_IDS.filter((k) => orders[k] === undefined || orders[k] === null);
  if (missing.length) return gap("unplaced_class", { classes: missing, why: "a class with no ground is unplaced, not order zero — there is no view from nowhere" });
  const bad = CLASS_IDS.filter((k) => !isOrder(orders[k]));
  if (bad.length) return gap("bad_order", { classes: bad, why: "an order is a non-negative integer" });
  return freeze(Object.fromEntries(CLASS_IDS.map((k) => [k, orders[k]])));
}

/** Where each class of a profile stands: order, ring, position, terrain. */
export function describe(p) {
  if (p?.gap) return p;
  return freeze(
    Object.fromEntries(
      CLASS_IDS.map((k) => {
        const position = positionOfOrder(p[k]);
        return [k, freeze({ order: p[k], ring: ringOfOrder(p[k]), position, terrain: terrainAt(k, position) })];
      }),
    ),
  );
}

export const label = (p) => (p?.gap ? `(${p.gap})` : CLASS_IDS.map((k) => `${k[0]}:${p[k]}`).join(" "));

// ── the crossing rule, as data ──────────────────────────────────────────────
// A crossing says: order(higher) <= order(lower). Both are READING-SPEC S10 and
// THE-THREE-MATHEMATICS section VII read per claim ("a claim's unit before its
// edge before its integral"); as an ORDER over profiles it was this map's own
// extension, and it was PUT TO THE TEST (THE-CAPACITY-MAP.md, F3-F5, and the drivers and
// raw results in eval/capacity-map/ — both removed from the tree, kept at git 2f81545). Three lists keep the history in one place:
//   DECLARED_CROSSINGS     the hypothesis as registered, before any run
//   UNSUPPORTED_CROSSINGS  the ones the pre-registered rules did NOT support, each with the
//                          rule, the outcomes and the evidence files
//   CROSSINGS              what is in force by default = declared minus unsupported
// A crossing moves between lists; it never vanishes and never appears in two
// (capacity-map.test.js pins that, and pins each recorded outcome against the committed
// raw results, so this history cannot drift from the runs it summarises).

const declared = (higher, lower, reads, giver) => freeze({ higher, lower, reads, giver });

export const DECLARED_CROSSINGS = freeze([
  declared(
    "geometric",
    "arithmetic",
    "a standing rests on units whose identity was earned — you cannot cut what has no units",
    "THE-THREE-MATHEMATICS section VII; READING-SPEC S10 (count sets what is possible)",
  ),
  declared(
    "transcendental",
    "geometric",
    "a direction rests on the standing that earns its probability semantics — you cannot bound what has no shape",
    "THE-THREE-MATHEMATICS section VII; READING-SPEC S10 (failure mode 3)",
  ),
]);

const crossingOf = (higher, lower) => DECLARED_CROSSINGS.find((c) => c.higher === higher && c.lower === lower);

/** Crossings the evidence did not support: removed from CROSSINGS, kept here with the result. */
export const UNSUPPORTED_CROSSINGS = freeze([
  freeze({
    ...crossingOf("transcendental", "geometric"),
    result: freeze({
      rule: "supported iff SUPPORTED on the plays and on at least 2 of the 3 novels, with no FALSIFIED-* anywhere at the primary setting (F4)",
      outcomes: freeze({ dracula: "SUPPORTED", "pride-and-prejudice": "SUPPORTED", frankenstein: "FALSIFIED-INVERSE", "shakespeare-plays": "MIXED" }),
      reading:
        "not supported as a precondition. Standing raised the split-half reliability of direction within volume strata in three of four materials (a graded dependence), but direction was also reproducible without standing in one of them, and the one inversion rests on a single effective stratum of very sparse events that does not survive exact volume matching.",
    }),
    evidence: freeze([
      "git 2f81545:native/eval/capacity-map/results/f4-dracula.json",
      "git 2f81545:native/eval/capacity-map/results/f4-pride.json",
      "git 2f81545:native/eval/capacity-map/results/f4-frankenstein.json",
      "git 2f81545:native/eval/capacity-map/results/f4-plays.json",
      "git 2f81545:native/eval/capacity-map/results/f4-diagnose-frankenstein.json",
    ]),
  }),
  freeze({
    ...crossingOf("geometric", "arithmetic"),
    result: freeze({
      rule: "consequential iff self-edge share >= 0.20 and Fisher p < 0.01 and above the permuted-label 95th percentile, on at least 2 of the 3 books (F5)",
      outcomes: freeze({ overall: "MIXED", consequentialOn: "0 of 3" }),
      followUp: freeze({
        registered: "F5' (THE-CAPACITY-MAP.md section 8, git 2f81545), before it was run on any held-out book",
        rule: "consequential iff repairing the extent removes at least 0.20 of the top standing edges' bare-honorific endpoints, beyond an equal-sized placebo merge, on at least 2 of 3 held-out books",
        outcomes: freeze({ heldOut: "0 of 3", development: "1 of 3 (one book, effect 0.40)" }),
      }),
      reading:
        "not supported. The first measure took the engine's own clusters as 'the same being' and was blind to a unit that is not a being standing beside the names it accompanies. The follow-up built on what that blindness hid was registered and tested on books it had not touched: the defect is real, and specific to how a book uses honorifics (one development book 0.40; held-out books 0.00 to 0.05), so it is recorded as a measured limit of two places (LIMITS in organs/capacity-place.js), not as a law of the order.",
    }),
    evidence: freeze([
      "git 2f81545:native/eval/capacity-map/results/f5-units.json",
      "git 2f81545:native/eval/capacity-map/results/f5c-bare-titles.json",
      "git 2f81545:native/eval/capacity-map/results/f5p-heldout.json",
      "git 2f81545:native/eval/capacity-map/results/f5p-development.json",
    ]),
  }),
]);

/** What is in force by default: the declared crossings the evidence did not remove. */
export const CROSSINGS = freeze(DECLARED_CROSSINGS.filter((c) => !UNSUPPORTED_CROSSINGS.some((u) => u.higher === c.higher && u.lower === c.lower)));

/** No crossing declared: every profile admissible. The control that shows the rule bites. */
export const NO_CROSSINGS = freeze([]);

/**
 * admissible(profile, { crossings }) — does the profile respect the declared
 * crossings? Returns { ok, violations }. The rule is a property of EARNED
 * profiles (where it follows from the per-claim chain); on a CLAIMED profile a
 * violation is a diagnostic that names the over-claimed class.
 */
export function admissible(p, { crossings = CROSSINGS } = {}) {
  if (p?.gap) return freeze({ ok: false, violations: freeze([]), gap: p });
  const violations = crossings
    .filter((c) => p[c.higher] > p[c.lower])
    .map((c) => freeze({ higher: c.higher, lower: c.lower, higherOrder: p[c.higher], lowerOrder: p[c.lower], reads: c.reads }));
  return freeze({ ok: violations.length === 0, violations: freeze(violations) });
}

// ── the lattice ─────────────────────────────────────────────────────────────

function* boxOrders(rings) {
  const top = rings * POSITIONS.length;
  for (let a = 0; a < top; a++) for (let g = 0; g < top; g++) for (let t = 0; t < top; t++) yield { arithmetic: a, geometric: g, transcendental: t };
}

/** The free box of profiles over the first `rings` rings (rings = 1 gives the first ring). */
export const space = ({ rings = 1 } = {}) => freeze([...boxOrders(rings)].map((o) => profile(o)));

/** The profiles the declared crossings admit. */
export const admissibleSpace = ({ rings = 1, crossings = CROSSINGS } = {}) =>
  freeze(space({ rings }).filter((p) => admissible(p, { crossings }).ok));

/** Spread = highest order minus lowest: how unevenly the classes have advanced. */
export const spread = (p) => Math.max(...CLASS_IDS.map((k) => p[k])) - Math.min(...CLASS_IDS.map((k) => p[k]));

const advance = (p, klass) => profile({ ...p, [klass]: p[klass] + 1 });

/**
 * countRoutes({ from, to, crossings }) — the number of single-step paths (one
 * class advancing one order per step) from `from` to `to` that stay admissible at
 * every state. Dynamic programming, so it is exact for spans far too long to
 * enumerate. `from` and `to` default to the first ring's first ground and last
 * pattern in every class.
 */
export function countRoutes({ from, to, crossings = CROSSINGS } = {}) {
  const top = POSITIONS.length - 1;
  const start = from ?? profile(Object.fromEntries(CLASS_IDS.map((k) => [k, 0])));
  const goal = to ?? profile(Object.fromEntries(CLASS_IDS.map((k) => [k, top])));
  if (start.gap || goal.gap) return gap("unplaced_class", { from: start, to: goal });
  if (!admissible(start, { crossings }).ok || !admissible(goal, { crossings }).ok) return 0;
  if (CLASS_IDS.some((k) => goal[k] < start[k])) return 0;
  const memo = new Map();
  const key = (p) => CLASS_IDS.map((k) => p[k]).join(",");
  const walk = (p) => {
    if (CLASS_IDS.every((k) => p[k] === goal[k])) return 1;
    const hit = memo.get(key(p));
    if (hit !== undefined) return hit;
    let n = 0;
    for (const k of CLASS_IDS) {
      if (p[k] >= goal[k]) continue;
      const next = advance(p, k);
      if (admissible(next, { crossings }).ok) n += walk(next);
    }
    memo.set(key(p), n);
    return n;
  };
  return walk(start);
}

/**
 * routes({ from, to, crossings, limit }) — the admissible paths themselves, as
 * arrays of class ids (the class advanced at each step). A span with more routes
 * than `limit` (default 1000) is a typed gap, not a silent truncation: count with
 * countRoutes and enumerate only what can be read.
 */
export function routes({ from, to, crossings = CROSSINGS, limit = 1000 } = {}) {
  const total = countRoutes({ from, to, crossings });
  if (total?.gap) return total;
  if (total > limit) return gap("too_many_routes", { count: total, limit });
  const top = POSITIONS.length - 1;
  const start = from ?? profile(Object.fromEntries(CLASS_IDS.map((k) => [k, 0])));
  const goal = to ?? profile(Object.fromEntries(CLASS_IDS.map((k) => [k, top])));
  const out = [];
  const walk = (p, path) => {
    if (CLASS_IDS.every((k) => p[k] === goal[k])) return void out.push(freeze([...path]));
    for (const k of CLASS_IDS) {
      if (p[k] >= goal[k]) continue;
      const next = advance(p, k);
      if (admissible(next, { crossings }).ok) walk(next, [...path, k]);
    }
  };
  walk(start, []);
  return freeze(out);
}

/** The largest spread a route ever reaches; the balanced routes minimise it. */
export function routeSpread(route, { from } = {}) {
  let p = from ?? profile(Object.fromEntries(CLASS_IDS.map((k) => [k, 0])));
  let worst = spread(p);
  for (const k of route) {
    p = advance(p, k);
    worst = Math.max(worst, spread(p));
  }
  return worst;
}

/** The admissible routes whose worst spread is the smallest any route achieves. */
export function balancedRoutes(opts = {}) {
  const all = routes(opts);
  if (all?.gap) return all;
  if (!all.length) return freeze([]);
  const worst = all.map((r) => routeSpread(r, opts));
  const best = Math.min(...worst);
  return freeze(all.filter((_, i) => worst[i] === best));
}

// ── what must be earned first ───────────────────────────────────────────────

/**
 * prerequisites(klass, order, { crossings }) — the places that must be earned
 * before (klass, order): every lower order in the same class, and, for each
 * crossing whose `higher` is this class, everything the `lower` class needs up to
 * this same order, recursively. Returns places (class, order, position, terrain),
 * sorted, never including the place itself.
 */
export function prerequisites(klass, order, { crossings = CROSSINGS } = {}) {
  requireClass(klass);
  if (!isOrder(order)) throw new TypeError("capacity-map: an order is a non-negative integer");
  const seen = new Map();
  const visit = (k, upTo) => {
    for (let o = 0; o <= upTo; o++) {
      const id = `${k}#${o}`;
      if (seen.has(id)) continue;
      const position = positionOfOrder(o);
      seen.set(id, freeze({ klass: k, order: o, position, terrain: terrainAt(k, position) }));
      for (const c of crossings) if (c.higher === k) visit(c.lower, o);
    }
  };
  visit(klass, order);
  seen.delete(`${klass}#${order}`);
  return freeze([...seen.values()].sort((x, y) => CLASS_IDS.indexOf(x.klass) - CLASS_IDS.indexOf(y.klass) || x.order - y.order));
}

/**
 * nextSteps(profile, { crossings }) — for each class, may it advance one order
 * now? A step the rule forbids says what must advance first (`needs`), so the
 * answer to "what next" is never a bare refusal.
 */
export function nextSteps(p, { crossings = CROSSINGS } = {}) {
  if (p?.gap) return p;
  return freeze(
    CLASS_IDS.map((klass) => {
      const to = p[klass] + 1;
      const position = positionOfOrder(to);
      const place = freeze({ klass, order: to, position, terrain: terrainAt(klass, position) });
      const after = advance(p, klass);
      const verdict = admissible(after, { crossings });
      if (verdict.ok) return freeze({ ...place, ok: true, needs: freeze([]) });
      const needs = verdict.violations.filter((v) => v.higher === klass).map((v) => freeze({ klass: v.lower, order: to }));
      return freeze({ ...place, ok: false, needs: freeze(needs), blockedBy: verdict.violations });
    }),
  );
}

// ── placing a reader: from the places it has reached to a profile ────────────

/**
 * placeReached(terrains) — the profile a set of reached terrains supports.
 * A class's order is the longest run of positions reached from its first ground
 * (a figure is read against a ground, a pattern is a difference of figures), so a
 * reached place with an unreached place beneath it is an ORPHAN — reported, not
 * counted. A class with no ground reached is unplaced (a typed gap), not zero.
 * Terrain sets carry no ring, so this places the first ring only.
 */
export function placeReached(terrains = []) {
  const reached = new Set(terrains);
  const perClass = {};
  const orphans = [];
  const unplaced = [];
  for (const k of CLASS_IDS) {
    let run = 0;
    while (run < POSITIONS.length && reached.has(terrainAt(k, POSITIONS[run]))) run++;
    for (let o = run + 1; o < POSITIONS.length; o++) {
      const terrain = terrainAt(k, POSITIONS[o]);
      if (reached.has(terrain)) orphans.push(freeze({ klass: k, terrain, position: POSITIONS[o], missingBeneath: terrainAt(k, POSITIONS[run]) }));
    }
    if (run === 0) unplaced.push(k);
    perClass[k] = run === 0 ? null : run - 1;
  }
  const p = unplaced.length ? gap("unplaced_class", { classes: unplaced, why: "no ground reached — not order zero; there is no view from nowhere" }) : profile(perClass);
  return freeze({ profile: p, orphans: freeze(orphans), unplaced: freeze(unplaced) });
}

// ── earned versus claimed: S10's "dressed" ──────────────────────────────────

const OVER_CLAIM = freeze({
  arithmetic: null,
  geometric: "a count dressed as standing (READING-SPEC S10, failure mode 2)",
  transcendental: "a transcendental magnitude reported where its probability semantics are not earned (READING-SPEC S10, failure mode 3)",
});

/**
 * dressed({ claimed, earned }) — per class, claimed order minus earned order. A
 * positive difference is a place asserted beyond what was earned; the failure
 * mode is named only where S10 names one (the arithmetic class has none — its wall
 * is "presupposes the unit"). `claimedOrder` violations say which class is
 * over-claimed relative to what would have to lie beneath it; `earnedOrder`
 * violations mean an earned place has no earned support under it — a chain break.
 */
export function dressed({ claimed, earned } = {}, { crossings = CROSSINGS } = {}) {
  if (claimed?.gap || earned?.gap) return gap("unplaced_class", { claimed, earned });
  const rows = CLASS_IDS.map((k) =>
    freeze({
      klass: k,
      claimed: claimed[k],
      earned: earned[k],
      over: claimed[k] - earned[k],
      mode: claimed[k] > earned[k] ? OVER_CLAIM[k] : null,
      wall: requireClass(k).wall,
    }),
  );
  return freeze({
    rows: freeze(rows),
    dressedClasses: freeze(rows.filter((r) => r.over > 0).map((r) => r.klass)),
    claimedOrder: admissible(claimed, { crossings }),
    earnedOrder: admissible(earned, { crossings }),
  });
}
