// native/organs/distinguishing-plan.js — SYN·Pattern: synthesize an
// adaptive plan of queries that distinguishes every hypothesis in a
// small, declared hypothesis space, given a declared (possibly
// NONDETERMINISTIC — see EITHER below) oracle.
//
// GENERAL, not puzzle-specific: any finite hypothesis space, any set of
// candidate queries each a PURE function of one hypothesis returning
// true, false, or EITHER, any query budget. Exhaustive search is safe
// because the space this is built for is small — bounded explicitly
// (`maxHypotheses`/`maxQueries`), refused above the declared cap rather
// than left to run slow and silent.
//
// EITHER, not a third observable branch — a REAL BUG this module's own
// first draft had, caught by running it (boolos-puzzle.mjs's own first
// full execution failed 2 of 6 real hypotheses before this fix): a
// witness whose answer is a coin flip does NOT emit a separate,
// recognizable "no signal" channel — it emits an ordinary true/false
// word, indistinguishable on the wire from a real one. The uncertainty is
// WHICH branch it lands in, never a third branch of its own. So a
// hypothesis whose query answer is `EITHER` is placed into BOTH the true
// AND false branches, and a plan is only valid once EVERY such duplicated
// hypothesis is correctly resolved on BOTH branches it could have landed
// in — the plan must work regardless of which way that hypothesis's own
// coin happens to fall, because nothing observable ever reveals which way
// it fell.
//
// This occupies the same cell `relative-pattern.js::correspond` already
// does (SYN·Pattern, Network terrain — "a product derived over a ground
// and a figure") with a different act: that organ composes a reading's
// own ground and figure; this one composes a QUERY STRATEGY from a
// hypothesis space and a set of probes.

export const EITHER = "either"; // the declared sentinel — never true, false, or null

const DEFAULT_MAX_HYPOTHESES = 64;
const DEFAULT_MAX_QUERIES = 32;

/**
 * planDistinguishingQueries(hypotheses, candidateQueries, { budget, maxHypotheses, maxQueries })
 *
 *   hypotheses       array of opaque hypothesis values (ids, objects —
 *                    never interpreted here, only partitioned).
 *   candidateQueries array of { id, ask(hypothesis) -> true|false|EITHER }.
 *                    `ask` must be a PURE function of the one hypothesis
 *                    passed to it.
 *   budget           declared positive integer — max questions in the
 *                    plan (never defaulted).
 *
 * Returns a query TREE: `{ done: true, query, branches: { true, false } }`
 * where each branch is itself a subtree, OR `{ done: true, hypothesis }`
 * at a leaf where exactly one hypothesis remains, OR `{ done: false,
 * undetermined: [...] }` — a REAL refusal, never a guess, when no plan
 * within budget distinguishes every hypothesis.
 */
export function planDistinguishingQueries(hypotheses, candidateQueries, { budget, maxHypotheses = DEFAULT_MAX_HYPOTHESES, maxQueries = DEFAULT_MAX_QUERIES } = {}) {
  if (!Number.isInteger(budget) || budget < 1) throw new TypeError("planDistinguishingQueries: budget is a declared positive integer — how many questions the plan may spend");
  if (!Array.isArray(hypotheses) || hypotheses.length === 0) throw new TypeError("planDistinguishingQueries: hypotheses is a declared, non-empty array");
  if (hypotheses.length > maxHypotheses) throw new RangeError(`planDistinguishingQueries: ${hypotheses.length} hypotheses exceeds the declared cap of ${maxHypotheses} — this is exhaustive search over a small, explicit space, not built to scale past it`);
  if (!Array.isArray(candidateQueries) || candidateQueries.length === 0) throw new TypeError("planDistinguishingQueries: candidateQueries is a declared, non-empty array");
  if (candidateQueries.length > maxQueries) throw new RangeError(`planDistinguishingQueries: ${candidateQueries.length} candidate queries exceeds the declared cap of ${maxQueries}`);

  const sameSet = (a, b) => a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

  function search(remaining, budgetLeft) {
    if (remaining.length <= 1) return Object.freeze({ done: true, hypothesis: remaining[0] ?? null });
    if (budgetLeft <= 0) return Object.freeze({ done: false, undetermined: Object.freeze([...remaining]) });

    for (const q of candidateQueries) {
      const trueBranch = [], falseBranch = [];
      for (const h of remaining) {
        const answer = q.ask(h);
        if (answer !== true && answer !== false && answer !== EITHER)
          throw new TypeError(`planDistinguishingQueries: candidate "${q.id}".ask(...) must return true, false, or EITHER — got ${JSON.stringify(answer)}`);
        if (answer === true) trueBranch.push(h);
        else if (answer === false) falseBranch.push(h);
        else { trueBranch.push(h); falseBranch.push(h); } // EITHER: could land on either wire, resolved on both
      }
      // No progress at all — every hypothesis duplicated onto both
      // branches identically (e.g. every remaining hypothesis answers
      // EITHER to this query) — skip without recursing.
      if (sameSet(trueBranch, falseBranch)) continue;

      const trueSub = search(trueBranch, budgetLeft - 1);
      if (!trueSub.done) continue;
      const falseSub = search(falseBranch, budgetLeft - 1);
      if (!falseSub.done) continue;

      return Object.freeze({ done: true, query: q.id, branches: Object.freeze({ true: trueSub, false: falseSub }) });
    }
    return Object.freeze({ done: false, undetermined: Object.freeze([...remaining]) });
  }

  return search(hypotheses, budget);
}

/**
 * executePlan(plan, answerFn) — walk a plan produced by
 * `planDistinguishingQueries` against a REAL run: `answerFn(queryId)`
 * returns the true/false answer ACTUALLY OBSERVED for that query
 * (adaptively). For a query whose asked god is random in the real
 * hypothesis, the caller's `answerFn` must itself flip the coin and
 * return a real true/false — there is no third wire to hand back, exactly
 * per this module's own EITHER discipline above.
 */
export function executePlan(plan, answerFn) {
  let node = plan;
  while (true) {
    if (!node.done) throw new Error(`executePlan: this plan never resolves — ${node.undetermined?.length ?? "some"} hypotheses remain undetermined even with unlimited budget`);
    if (!node.query) return node.hypothesis; // a leaf: exactly one hypothesis survived
    const answer = answerFn(node.query);
    if (answer !== true && answer !== false) throw new TypeError(`executePlan: answerFn("${node.query}") must return true or false — got ${JSON.stringify(answer)}`);
    const next = node.branches[String(answer)];
    if (!next) throw new Error(`executePlan: query "${node.query}" has no branch for answer ${answer}`);
    node = next;
  }
}
