// interact.js — the app's capacity to work WITH something that answers back.
//
// Everything this instrument does to a TEXT is a reading: the material is
// inert, it does not adapt, and the whole grounding ladder is built on that.
// Everything it does to a RUNTIME, a shell, its own act grammar, a database or
// a web organ is something else — the counterpart acts too, and what it says
// back can change what should be done next. This module is the machinery for
// that second thing, and it exists because the app had almost none of it: every
// door it owns (`/run`, `/act`, `.load`, a `pip install`) fires ONE act and
// reads ONE response. There is no way, anywhere in this repo before this file,
// to say "do this, read what came back, then do that with it" — let alone to
// predict an effect before causing it, or to establish that an effect actually
// depended on the act that appeared to cause it.
//
// -- THE CAPACITIES, AND WHY THEY ARE THESE ONES ---------------------------
//
// The list is not invented here. It is read off Commons's Model of
// Hierarchical Complexity (`mhc.js`'s GIVER names the sources; the eo-wiki's
// own "MHC and EO" article is where this project already recorded the
// convergence), which specifies — analytically, before anyone performs
// anything — what a task at each order REQUIRES: each order coordinates the
// order below it, non-arbitrarily, producing something the lower one cannot
// reach. Applied to interaction rather than to reading, the orders name
// exactly the capacities missing above, in dependency sequence. `RUNGS` below
// carries the mapping, and each function here is one rung's capacity.
//
// The MHC also decides something this module must NOT do: an order is a
// property of the TASK, determinable in advance, never a score read off a
// performance. So `rungReached` derives what an interaction actually did from
// the run's own structure — was an act computed from a response, was an
// expectation declared and compared — and never from anybody's say-so about
// what they meant to do. A caller cannot claim rung 7 by asserting it.
//
// -- WHAT INTERACTION CAN DO THAT NO AMOUNT OF READING CAN -----------------
//
// `depends()` is the one to notice. CLAUDE.md records the causal door as
// deliberately shut for the measuring organ: `binding.js` carries
// `transferEntropy` and `reversalNull`, and the DFR work measured 100/100
// false positives on common-cause synthetic data — that paper's own
// conclusion being that confounding "requires design, not statistics."
// Interaction IS that design. `depends()` does not infer a dependence from a
// record; it runs the world again with the act removed, and once more with an
// accepted-but-irrelevant act in its place, and reports all three counts. That
// is unavailable to any reader of a fixed transcript, and it is the reason
// this module is worth more than a convenience wrapper over `step()`.
//
// -- HONESTY RULES CARRIED FROM THE REST OF THIS REPO ----------------------
//
// 1. A refusal is information, never an error. A counterpart saying "I do not
//    have that" is rung 5 working, and it is recorded as a response.
// 2. An effect is read off the WHOLE run, never off its last response. Found
//    the hard way (see EFFECT_READS_THE_WHOLE_RUN below): a predicate that
//    inspects only the final observation measures where the transcript
//    happened to stop, and appending a no-op breaks it.
// 3. Nothing here declares a rung it did not exercise. `verifyLoop` exists
//    precisely because "this step was written as a function of the response"
//    and "this step's act actually changed because of the response" are two
//    different facts, and only the second one is rung 7.
// 4. Counts are reported natural-frequency (fired of draws), never converted
//    into a threshold this module did not earn.
//
// PURE, COUNTERPARTS INJECTED (the cast.js pattern): nothing here spawns a
// process, opens a socket, or imports an engine. Adapters live where the
// crossing already lives — term.js for the sandboxed runtimes, the act grammar
// for grid.js. `interact.test.mjs` drives every capacity against in-memory
// counterparts, so the walls stay testable wherever this repo is checked out.

import { seededShuffle } from "../organs/asserted.js";

/** The whole contract. Three methods, small on purpose: anything that can
 * answer them can be worked with — a sandbox runtime, this repo's own act
 * grammar, a shell, a database, a web organ, another agent, a person. */
export const CONTRACT = Object.freeze({
  id: "a stable name for this counterpart; it is reported with every result",
  kind: "what sort of counterpart it is, in the result's own words",
  open: "async () => session — a FRESH counterpart. Every capacity here opens its own, so no run inherits another's state.",
  session: "{ step(act) -> {accepted, text}, close() } — step may be async",
  describe: "() => anything the caller wants to publish about what this counterpart affords; optional",
});

/** The capacities, in dependency order — each coordinates the one below it.
 * Names and the requirement are Commons's; the second half of each line is
 * what it means HERE. */
export const RUNGS = Object.freeze({
  5: Object.freeze({
    name: "Nominal",
    capacity: "an act names an affordance the counterpart has, or it does not — and the refusal is information",
    here: "every step carries `accepted`; a refusal is a response, never an exception",
  }),
  6: Object.freeze({
    name: "Sentential",
    capacity: "one act, one effect, attributed to the act that caused it",
    here: "each step carries its own `text`, never a pooled transcript",
  }),
  7: Object.freeze({
    name: "Preoperational",
    capacity: "a later act COMPUTED from what came back — the loop the word interaction actually names",
    here: "a script step may be a function of the responses so far; `verifyLoop` proves the loop is real",
  }),
  8: Object.freeze({
    name: "Primary",
    capacity: "an empirical rule applied: predict the effect, then act, then compare",
    here: "a step may declare `expect`; the comparison lands on the step as `predicted`/`met`",
  }),
  9: Object.freeze({
    name: "Concrete",
    capacity: "corroboration counted by ROUTE, not by repetition — two ways of reaching one effect are two witnesses; one way twice is one",
    here: "`corroborate()`",
  }),
  10: Object.freeze({
    name: "Abstract",
    capacity: "quantify over an open slot: the whole set of fillers the counterpart admits, rather than the one that was tried",
    here: "`enumerateSlot()`",
  }),
  11: Object.freeze({
    name: "Formal",
    capacity: "intervene — run the world again without the act, and again with an irrelevant act in its place, to establish that the effect depended on THIS act",
    here: "`depends()`",
  }),
});

export const REFUSALS = Object.freeze({
  NO_ID: "counterpart_unnamed",
  NO_OPEN: "counterpart_cannot_open",
  NO_SESSION: "counterpart_session_cannot_step",
  EMPTY_SCRIPT: "nothing_to_do",
  NO_SLOT: "no_candidates_to_quantify_over",
  ONE_ROUTE: "one_route_is_not_corroboration",
  NO_ACT_TO_REMOVE: "intervention_names_no_act",
});

/** Found by running an intervention rather than by reasoning about one, and
 * kept as a named export because a caller gets this wrong silently. An effect
 * predicate that inspects only the FINAL observation measures where the
 * transcript stopped, not what the plan did — so appending a no-op breaks it,
 * which is exactly what an insertion control does. Every effect predicate here
 * receives the whole observation list. */
export const EFFECT_READS_THE_WHOLE_RUN = Object.freeze({
  gap: "effect_reads_transcript_end",
  detail:
    "An effect predicate that inspects only the last observation reports where the run happened to stop rather than what the acts did to the counterpart. Quantify over the whole list.",
});

/** Shape-check a counterpart. Never throws — a malformed one is reported, the
 * same posture grid.js's own parse and measure.js's `admit` already take. */
export function declareCounterpart(raw) {
  const c = raw ?? {};
  const id = String(c.id ?? "").trim();
  if (!id) return refuse(REFUSALS.NO_ID, "a counterpart must carry an id — it is reported with every result it produces");
  if (typeof c.open !== "function") return refuse(REFUSALS.NO_OPEN, `"${id}" must supply open() -> session`);
  return Object.freeze({
    ok: true,
    counterpart: Object.freeze({
      id,
      kind: String(c.kind ?? "unstated"),
      open: c.open,
      describe: typeof c.describe === "function" ? c.describe : () => null,
    }),
  });

  function refuse(gap, detail) {
    return Object.freeze({ ok: false, refusal: Object.freeze({ gap, detail }) });
  }
}

// -- the primitive: a plan against a fresh session --------------------------

const actOf = (step, observations) => {
  const a = step && typeof step === "object" ? step.act : step;
  return typeof a === "function" ? a(observations) : String(a ?? "");
};

const isComputed = (step) => {
  const a = step && typeof step === "object" ? step.act : step;
  return typeof a === "function";
};

/** Run a plan of bare acts against a FRESH session. `blind: true` computes
 * every act from an EMPTY response history — the open-loop control that
 * `verifyLoop` and `depends` both rest on. */
export async function runPlan(counterpart, plan, { blind = false } = {}) {
  const session = await counterpart.open();
  if (typeof session?.step !== "function") {
    await session?.close?.();
    throw new Error(`counterpart "${counterpart.id}" opened a session with no step()`);
  }
  const observations = [];
  try {
    for (const step of plan) {
      const act = String(actOf(step, blind ? [] : observations));
      const obs = await session.step(act);
      // `computed` is provenance of the ACT, not a leak of the plan's shape:
      // it records that this act was built out of what had come back rather
      // than written down in advance. A caller that must locate "the act
      // computed from the response" needs it, because reordering moves that
      // act off whatever index it started at.
      observations.push({ act, accepted: obs?.accepted === true, text: String(obs?.text ?? ""), computed: isComputed(step) });
    }
  } finally {
    await session.close?.();
  }
  return observations;
}

/** The response stream as one comparable string — what every control in this
 * module asks the same question of: did what we changed MOVE this? */
export const streamOf = (observations) => observations.map((o) => `${o.accepted ? "+" : "-"}${o.text}`).join(" ");

const actsOf = (observations) => observations.map((o) => o.act).join("   ");

// -- rungs 5 through 8: conduct ---------------------------------------------

/** CONDUCT an interaction. This is rungs 5-8 in one call, because they are one
 * activity: emit an act, read what came back, let the next act depend on it,
 * and — where the caller has a rule worth risking — say what is expected
 * BEFORE causing it.
 *
 * A script step is either a bare act (a string), or:
 *   { act, expect?, met?, note? }
 * where `act` may be a function of the responses so far (rung 7), `expect` may
 * be a function of the responses so far returning what this step's effect is
 * predicted to be (rung 8), and `met(text, predicted, observation)` decides
 * whether the prediction held. The default `met` is exact containment of the
 * predicted value in the response text — deliberately crude, because a caller
 * with a real rule should supply the comparison its rule actually makes.
 *
 * Nothing here decides whether the interaction SUCCEEDED. That is the caller's
 * question and its answer belongs to the caller's own goal; what this returns
 * is the honest record of what was done and what came back. */
export async function conduct(counterpart, script, { blind = false } = {}) {
  const steps = Array.isArray(script) ? script : [];
  if (!steps.length) {
    return Object.freeze({ counterpart: counterpart.id, gap: REFUSALS.EMPTY_SCRIPT, detail: "a conduct with no steps does nothing", steps: Object.freeze([]), rung: null });
  }

  const session = await counterpart.open();
  const observations = [];
  const out = [];
  try {
    for (const step of steps) {
      const prior = blind ? [] : observations;
      const act = String(actOf(step, prior));
      const declared = step && typeof step === "object" && typeof step.expect === "function";
      const predicted = declared ? step.expect(prior) : undefined;
      const obs = await session.step(act);
      const record = {
        act,
        computed: isComputed(step),
        accepted: obs?.accepted === true,
        text: String(obs?.text ?? ""),
        note: step && typeof step === "object" && step.note ? String(step.note) : null,
      };
      observations.push({ ...record });
      if (declared) {
        const met =
          typeof step.met === "function"
            ? step.met(record.text, predicted, record) === true
            : predicted != null && String(record.text).includes(String(predicted));
        // A prediction that could not be formed is a GAP, never a miss: the
        // rule declined to cover this case, which is a different fact from the
        // rule being wrong about it.
        record.predicted = predicted ?? null;
        record.met = predicted == null ? null : met;
      }
      out.push(Object.freeze(record));
    }
  } finally {
    await session.close?.();
  }

  const result = { counterpart: counterpart.id, steps: Object.freeze(out), blind };
  return Object.freeze({ ...result, rung: rungReached(result), reading: readingOf(result) });
}

/** What rung did this interaction ACTUALLY exercise — derived from the run's
 * own structure, never from a caller's claim about it. The MHC's own
 * separation of task from performance, applied to this module's own
 * reporting: a caller cannot assert rung 7 by meaning to. */
export function rungReached(result) {
  const steps = result?.steps ?? [];
  if (!steps.length) return null;
  let rung = 5; // an act was emitted and its acceptance was read
  if (steps.some((s) => s.text !== "")) rung = 6; // an effect came back, attributed to its own act
  // Rung 7 needs BOTH: an act computed from responses, and something before it
  // for it to have been computed FROM.
  const computedAt = steps.findIndex((s) => s.computed);
  if (computedAt > 0) rung = 7;
  if (steps.some((s) => s.met === true || s.met === false)) rung = Math.max(rung, 8);
  return rung;
}

const readingOf = (result) => {
  const steps = result?.steps ?? [];
  const refused = steps.filter((s) => !s.accepted).length;
  const predicted = steps.filter((s) => s.met === true || s.met === false);
  const missed = predicted.filter((s) => s.met === false);
  const parts = [`${steps.length} act(s)`, `${refused} refused`];
  if (steps.some((s) => s.computed)) parts.push(`${steps.filter((s) => s.computed).length} computed from what came back`);
  if (predicted.length) parts.push(`${predicted.length} predicted, ${missed.length} missed`);
  return parts.join(" · ");
};

/** Rung 7, PROVEN rather than assumed. Writing a step as a function of the
 * responses is a claim; that the act genuinely changed because of them is a
 * fact, and only the fact is the capacity. Runs the script twice — once
 * normally, once open-loop with every act computed from an empty history — and
 * reports whether the acts actually differed.
 *
 * A script whose "closed loop" produces identical acts is not a loop. That is
 * a real finding about the script, reported as `loopReal: false`, not an
 * error. */
export async function verifyLoop(counterpart, script) {
  const wired = script.some((s) => isComputed(s));
  if (!wired) {
    return Object.freeze({
      counterpart: counterpart.id,
      loopReal: false,
      gap: "no_step_reads_a_response",
      detail: "no act in this script is computed from a response, so there is no loop to verify",
    });
  }
  const real = await conduct(counterpart, script);
  const blind = await conduct(counterpart, script, { blind: true });
  const loopReal = actsOf(real.steps) !== actsOf(blind.steps);
  return Object.freeze({
    counterpart: counterpart.id,
    loopReal,
    detail: loopReal
      ? "run open-loop, the acts came out different — the counterpart's responses genuinely shaped what was done next"
      : "run open-loop, the acts came out IDENTICAL — this script only appears to read the counterpart",
    real: real.steps,
    blind: blind.steps,
  });
}

// -- rung 9: corroborate ----------------------------------------------------

/** Rung 9. Two DIFFERENT routes to one effect are two witnesses; one route run
 * twice is one witness that answered twice. This is the interaction sibling of
 * the grounding ladder's own "refs and distinct sources counted apart, because
 * two chunks of one file are one perspective" — carried over here rather than
 * re-derived, and it is why `arrivals` and `routes` are returned as separate
 * numbers and never summed.
 *
 * `reached(observations)` reads the WHOLE run (see EFFECT_READS_THE_WHOLE_RUN).
 * `repeat` re-runs the first route so the distinction is demonstrated on this
 * counterpart rather than asserted. */
export async function corroborate(counterpart, { routes, reached, repeat = true } = {}) {
  const list = (routes ?? []).filter((r) => Array.isArray(r) && r.length);
  if (list.length < 2) {
    return Object.freeze({
      counterpart: counterpart.id,
      gap: REFUSALS.ONE_ROUTE,
      detail: "corroboration needs at least two distinct routes; fewer were supplied",
      routes: list.length,
    });
  }
  const runs = [];
  for (const route of list) runs.push({ route, observations: await runPlan(counterpart, route) });
  if (repeat) runs.push({ route: list[0], observations: await runPlan(counterpart, list[0]), repeatOf: 0 });

  const witnesses = new Map();
  let arrivals = 0;
  for (const r of runs) {
    if (!reached(r.observations)) continue;
    arrivals += 1;
    const key = r.route.join("   ");
    if (!witnesses.has(key)) witnesses.set(key, { route: r.route, arrivals: 0 });
    witnesses.get(key).arrivals += 1;
  }
  const distinct = [...witnesses.values()];
  return Object.freeze({
    counterpart: counterpart.id,
    rung: 9,
    arrivals,
    routes: distinct.length,
    witnesses: Object.freeze(distinct.map((w) => Object.freeze({ route: Object.freeze([...w.route]), arrivals: w.arrivals }))),
    reading: `${arrivals} arrival(s) of the effect from ${distinct.length} distinct route(s)${repeat ? " — one route was run twice and still counts once" : ""}`,
  });
}

// -- rung 10: enumerate a slot ----------------------------------------------

/** Rung 10. The counterpart is asked what it admits in an open position,
 * rather than one filler being tried and treated as the answer. Every
 * candidate is put to it; the answer is a SET, with the refusals kept as the
 * other half of the same fact. */
export async function enumerateSlot(counterpart, { template, candidates } = {}) {
  const list = (candidates ?? []).map(String);
  if (typeof template !== "function" || !list.length) {
    return Object.freeze({
      counterpart: counterpart.id,
      gap: REFUSALS.NO_SLOT,
      detail: "quantifying over a slot needs a template(filler) and at least one candidate",
    });
  }
  const admitted = [];
  const refused = [];
  for (const filler of list) {
    const obs = await runPlan(counterpart, [template(filler)]);
    (obs[0]?.accepted ? admitted : refused).push({ filler, text: obs[0]?.text ?? "" });
  }
  return Object.freeze({
    counterpart: counterpart.id,
    rung: 10,
    admitted: Object.freeze(admitted.map((a) => a.filler)),
    refused: Object.freeze(refused.map((r) => r.filler)),
    detail: Object.freeze([...admitted, ...refused]),
    reading: `the slot ranges over ${admitted.length} of ${list.length} candidate(s): ${admitted.map((a) => a.filler).join(", ") || "none"}`,
  });
}

// -- rung 11: intervene -----------------------------------------------------

/** Rung 11, and the capacity no reading can supply. Establish whether an
 * effect DEPENDS on one particular act by running the world again:
 *
 *   with     — the plan as written; the effect should hold
 *   without  — the named act removed; the effect should not
 *   placebo  — the named act REPLACED by an accepted-but-irrelevant one; the
 *              effect should not, which is what separates "this act" from
 *              "an act"
 *   inserted — the irrelevant act ADDED at a seeded position with everything
 *              else intact; the effect SHOULD survive, and if it does not, the
 *              plan is merely brittle and the other three counts establish
 *              nothing. Reported, never silently dropped.
 *
 * All four are run at `draws` seeds and reported natural-frequency. No
 * threshold is applied here: `dependsOnAct` is true only when the pattern is
 * unanimous across every draw, and anything less is handed back as counts for
 * the caller to read. */
export async function depends(counterpart, { plan, act: omit, placebo, effect, draws = 5, seed = 0 } = {}) {
  const steps = (plan ?? []).slice();
  if (!steps.length || !Number.isInteger(omit) || omit < 0 || omit >= steps.length) {
    return Object.freeze({
      counterpart: counterpart.id,
      gap: REFUSALS.NO_ACT_TO_REMOVE,
      detail: "an intervention needs a plan and the index of the act whose effect is in question",
    });
  }
  if (typeof effect !== "function") {
    return Object.freeze({ counterpart: counterpart.id, gap: REFUSALS.NO_ACT_TO_REMOVE, detail: "an intervention needs an effect(observations) predicate that reads the whole run" });
  }

  const without = steps.filter((_, i) => i !== omit);
  const swapped = placebo == null ? null : steps.map((s, i) => (i === omit ? placebo : s));
  const positions = steps.map((_, i) => i).concat(steps.length);
  const counts = { with: 0, without: 0, placebo: 0, inserted: 0, insertions: 0 };

  for (let d = 0; d < draws; d += 1) {
    if (effect(await runPlan(counterpart, steps))) counts.with += 1;
    if (effect(await runPlan(counterpart, without))) counts.without += 1;
    if (swapped && effect(await runPlan(counterpart, swapped))) counts.placebo += 1;
    // EVERY position, not a seeded sample of one. The insertion control is
    // load-bearing — it is what stops a merely brittle plan from being read as
    // a demonstrated dependence — and a sampled version can simply miss the
    // position that breaks the effect, reporting robustness it never tested.
    // A control that decides a correctness claim does not get to depend on a
    // seed. Found by a plan whose effect read only the last response: the
    // sampling version called it robust whenever no draw happened to insert at
    // the end.
    if (placebo != null) {
      for (const at of positions) {
        counts.insertions += 1;
        if (effect(await runPlan(counterpart, [...steps.slice(0, at), placebo, ...steps.slice(at)]))) counts.inserted += 1;
      }
    }
  }

  const survivesIrrelevantChange = placebo == null ? null : counts.inserted === counts.insertions;
  const dependsOnAct =
    counts.with === draws && counts.without === 0 && (placebo == null ? true : counts.placebo === 0 && survivesIrrelevantChange === true);

  return Object.freeze({
    counterpart: counterpart.id,
    rung: 11,
    act: steps[omit],
    draws,
    counts: Object.freeze(counts),
    dependsOnAct,
    survivesIrrelevantChange,
    reading:
      `with the act, the effect held ${counts.with}/${draws}; without it, ${counts.without}/${draws}` +
      (placebo == null
        ? " (no placebo supplied, so this cannot separate THIS act from merely an act)"
        : `; with an irrelevant act in its place, ${counts.placebo}/${draws}; with that same irrelevant act merely ADDED, ${counts.inserted}/${draws}` +
          (survivesIrrelevantChange ? "" : " — the effect did not survive an irrelevant insertion, so this plan is brittle and the contrast above establishes nothing")),
  });
}

// -- one more control, shared: does the ORDER matter? -----------------------

/** Not an MHC rung of its own — a control the other capacities need and the
 * app can use directly: re-run the same acts in seeded different orders and
 * report how often the effect still holds. An effect indifferent to order was
 * not produced by a sequence, whatever the sequence looked like. */
export async function orderMatters(counterpart, { plan, effect, draws = 5, seed = 0 } = {}) {
  const steps = (plan ?? []).slice();
  if (steps.length < 2 || typeof effect !== "function") {
    return Object.freeze({ counterpart: counterpart.id, gap: "no_order_to_test", detail: "testing order needs at least two acts and an effect(observations) predicate" });
  }
  const identity = steps.map((_, i) => i).join(",");
  let held = 0;
  let dealt = 0;
  for (let d = 0; d < draws; d += 1) {
    const order = seededShuffle(steps.map((_, i) => i), seed + d);
    if (order.join(",") === identity) continue;
    dealt += 1;
    if (effect(await runPlan(counterpart, order.map((i) => steps[i])))) held += 1;
  }
  return Object.freeze({
    counterpart: counterpart.id,
    dealt,
    held,
    ordered: dealt > 0 && held === 0,
    reading:
      dealt === 0
        ? "no seeded deal changed the order — nothing was tested"
        : `re-ordered ${dealt} time(s); the effect still held in ${held} of them`,
  });
}
