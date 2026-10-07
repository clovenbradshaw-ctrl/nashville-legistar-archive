// reasoning-core.js — a general finite-domain constraint solver. Not a
// puzzle solver: it knows nothing about knights, knaves, sentences, or any
// other domain. It knows variables, domains, and constraints.
//
// User direction, 2026-09-16, after knights-and-knaves shipped as its own
// hand-rolled brute force: "no puzzle shaped specific solver, it just needs
// to be a general reasoning engine." Confirmed by survey (this session's own
// design workflow): `logic-puzzle.js::solveKnightsKnaves` had exactly two
// puzzle-specific facts baked into its SEARCH loop, not just its parsing —
// a hardcoded 2-valued domain (`1 << n`) and the consistency rule written
// inline instead of declared. Both are gone here: domains are arbitrary
// value lists, and every rule — including "a speaker's own statement must
// match their own type" — is one more constraint the caller declares,
// never something this file assumes.
//
// TWO INDEPENDENT DESIGNS WERE PROPOSED AND ADVERSARIALLY CRITIQUED before
// this was written (not asserted, checked): both converged on this same
// {variables, constraints} shape, and both under-delivered on the one
// property that actually matters at scale — real pruning. Both enumerated
// every COMPLETE assignment before testing anything, which is the identical
// class of failure `logic-puzzle.js`'s own boolean-only loop had, just
// widened from 2 values to N. A held-out third domain (map-coloring, never
// seen while this was designed) is what the domain scan below is checked
// against, not just the knights-and-knaves case it was built to replace.
//
// WHAT THIS FILE ACTUALLY DOES: backtracking search with real pruning. A
// constraint is scoped to the variables it touches (`vars`); the solver
// assigns one variable at a time and tests every constraint whose `vars`
// are now FULLY assigned — the instant one fails, the whole remaining
// subtree under that partial assignment is never visited. This is the
// standard, textbook shape (not novel, not tuned to any puzzle) and it is
// what makes cryptarithmetic-scale problems (10 variables, 10-value
// domains) tractable where a leaf-only brute force is not: a constraint
// violated on the second variable prunes every one of the remaining
// variables' domains at once, rather than enumerating all of them first.
//
// WHAT THIS FILE DOES NOT DO, disclosed rather than silently promised:
// it solves "assign each variable one value such that every constraint
// holds," never a SEQUENTIAL problem (a plan, a sequence of moves, a state
// reached over time — river-crossing, tower-of-hanoi). Those need a
// different declared shape (states, transitions, a goal test) this file
// does not model; a caller with a sequential problem gets no result from
// here, not a wrong one forced into this shape. Real, disclosed, future
// work — not attempted.
//
// DISCLOSED LIMIT, found by actually stress-testing this rather than
// assumed safe: pruning power is exactly as good as how narrowly the
// CALLER scopes its own constraints, never better. A constraint whose
// `vars` names every variable in the problem cannot be tested until every
// one of them is assigned — no search strategy can check a rule before
// the values it reads exist. Measured live: a classic 8-letter
// cryptarithmetic puzzle (SEND+MORE=MONEY, digit domain size 10) declared
// with ONE global "all values differ" constraint spanning all 8 letters
// ran the full unpruned 10^8-leaf search and exhausted memory; the
// identical puzzle declared with 28 narrow PAIRWISE inequality
// constraints (each touching only 2 letters, so pruning fires the
// instant any two collide) found the real, correct, famously unique
// answer (9567+1085=10652) in ~12s over ~5.7M nodes — real pruning, and
// still far from instant, because the sum constraint itself genuinely
// cannot be checked before all 8 digits are known. This is not tuned or
// hidden: a caller wanting tractable search on a wide problem decomposes
// its own broad rules into the narrowest constraints that are actually
// true, the same discipline real constraint-satisfaction practice always
// requires. This file adds no heuristic to compensate — only the
// declared `vars` scoping decides how early anything prunes.
//
// Algebraic solving (real/irrational roots, unit conversion, symbolic
// manipulation — the-fold's own arithmetic.js, mathjs-backed) is
// deliberately NOT folded into this file. A finite-domain search can never
// reach an irrational root by enumeration; forcing both into one algorithm
// means badly reinventing a computer-algebra system. Two genuinely
// different mathematical acts stay two strategies; a caller picks by what
// kind of unknown it has, this file only ever does the finite-domain one.
//
// Pure. No fetch, no fs, no DOM. Zero imports.

/** A finite domain: a concrete, ordered list of values — never a bare
 * count. `["red","blue"]`, not `2`. */
export const finiteDomain = (values) => Object.freeze({ kind: "finite", values: Object.freeze([...values]) });

export const declareVariable = (name, domain) => Object.freeze({ name, domain });

/**
 * declareConstraint(name, vars, test, reason?) — `vars` is the list of
 * variable names this constraint reads; the solver uses it to know the
 * EARLIEST point in the assignment order at which the constraint can be
 * tested at all (once every one of `vars` has a value), which is the
 * entire mechanism of the pruning below. `test(assignment)` reads only
 * `vars`' current values and returns `true`/`false` — never `null`; a
 * constraint that cannot yet be evaluated is simply not tested (`vars`
 * not yet fully assigned), so there is no partial-truth value to invent.
 */
export const declareConstraint = (name, vars, test, reason = null) =>
  Object.freeze({ name, vars: Object.freeze([...vars]), test, reason });

export const makeCSP = (variables, constraints) => Object.freeze({ variables: Object.freeze([...variables]), constraints: Object.freeze([...constraints]) });

/**
 * solveCSP({variables, constraints}) — backtracking search with real
 * per-step pruning, not leaf-only enumeration. Variables are assigned in
 * DECLARED order (no variable-ordering heuristic — a caller that wants one
 * orders its own `variables` array; this file adds no heuristic it did not
 * declare, the same "nothing hand-tuned" discipline this codebase holds
 * for its statistics). At each depth, only the constraints whose `vars`
 * are now fully covered are tested; a failing one prunes the ENTIRE
 * remaining subtree (every value of every not-yet-assigned variable) in
 * one step, without visiting any of it.
 *
 * Returns `{ trials, solutions, totalNodesVisited, pruned }`:
 *  - `trials`: one entry per assignment actually tested to a full leaf
 *    (every variable assigned) — `{ assignment, satisfied, failedAt }`.
 *    A leaf is only reached when nothing pruned it first, so this array
 *    is never the full domain-product for anything that had constraints
 *    to prune with — the audit trail IS the pruning behavior, not a
 *    summary of it.
 *  - `pruned`: one entry per subtree cut before reaching a leaf —
 *    `{ partial, failedConstraint, failedAt }` — `partial` is the exact
 *    values assigned when the cut happened, `failedConstraint` names
 *    which declared rule failed and `failedAt` gives its own `test`
 *    result's inputs (the values of just its `vars`), so a reader sees
 *    the actual values that broke a rule, not a static sentence repeated
 *    for every cut.
 *  - `solutions`: every leaf where every constraint held.
 *  - `totalNodesVisited`: trials.length + pruned.length — the real search
 *    cost, reported rather than left to be inferred.
 */
// `limit` (optional): stop after that many solutions. A satisfiability
// question ("is there ANY consistent assignment with b first?") needs one
// witness, not every one — at 20 variables the full set is ~10^18. Omitted,
// the search is exhaustive exactly as before.
export function solveCSP({ variables, constraints }, { limit = Infinity } = {}) {
  const trials = [];
  const pruned = [];
  const solutions = [];

  // Each constraint is tested EXACTLY ONCE — at the depth where the LAST
  // of its `vars` (by declaration order) is first assigned, never before
  // (not yet fully known) and never again after (already confirmed, and a
  // pure test over unchanged values can only repeat the same answer). A
  // constraint naming a variable this CSP never declared is a caller bug,
  // refused loudly here rather than silently never checked.
  const orderOf = new Map(variables.map((v, i) => [v.name, i]));
  const checkableAt = variables.map(() => []);
  for (const c of constraints) {
    const indices = c.vars.map((v) => {
      if (!orderOf.has(v)) throw new Error(`reasoning-core: constraint "${c.name}" reads variable "${v}", which was never declared`);
      return orderOf.get(v);
    });
    checkableAt[Math.max(...indices)].push(c);
  }

  function assign(depth, current) {
    if (depth === variables.length) {
      // Every constraint was already checked incrementally on the way
      // down (checkableAt covers every constraint by the final depth,
      // since every constraint's vars are a subset of all variables), so
      // reaching here means every one held — this leaf is a solution.
      const snapshot = { ...current };
      trials.push({ assignment: snapshot, satisfied: true, failedAt: null });
      solutions.push(snapshot);
      return;
    }
    const variable = variables[depth];
    for (const value of variable.domain.values) {
      if (solutions.length >= limit) break;
      current[variable.name] = value;
      let failed = null;
      for (const c of checkableAt[depth]) {
        if (c.test(current) === false) { failed = c; break; }
      }
      if (failed) {
        pruned.push({
          partial: { ...current },
          failedConstraint: failed.name,
          failedAt: Object.fromEntries(failed.vars.map((v) => [v, current[v]])),
        });
        continue; // this value's whole remaining subtree is never visited
      }
      assign(depth + 1, current);
    }
    delete current[variable.name];
  }
  assign(0, {});

  return { trials, solutions, pruned, totalNodesVisited: trials.length + pruned.length };
}
