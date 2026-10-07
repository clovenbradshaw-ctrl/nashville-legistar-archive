// mhc-interact.js — the MHC battery pointed at a COUNTERPART instead of a
// text: what order of task this instrument completes when the thing it is
// working on answers back.
//
// mhc.js is the scorer and is UNTOUCHED by this module. Its own header says
// what makes that possible: "this module runs whatever async task and arms an
// item hands it and knows nothing about text, referents, edges or the engine."
// Everything that made it a READING battery lives in eval/mhc-battery.mjs's
// bindings. This file is a second set of bindings — a ladder of interaction
// items, generic over counterparts — plus the three things that genuinely
// change when the material stops being inert. Nothing here re-implements a
// scorer, an order table, or an axiom.
//
// -- WHY THIS SHAPE, so it is not re-derived --------------------------------
//
// 1. THE CONFOUND MHC WAS BUILT TO END COMES BACK, ONE LEVEL UP.
//
// Commons's complaint about predecessor stage theories is that they
// "confounded stimulus and response" — scoring performances without
// independently specifying the complexity of the task. mhc.js already answers
// that for reading, and it answers it easily, because a text is INERT: the
// material cannot adapt, so a stage read off it is unambiguously the reader's.
//
// In interaction both sides act. A naive score is then a number about the
// PAIR reported as a number about us. The fix is Commons's own fix, applied
// one level up: the task's order is still declared analytically in advance,
// and the counterpart is held fixed and NAMED — every report this module
// produces is a claim about (this assembly, this counterpart) and says so.
// And the `discrimination` arm is a REAL SIBLING COUNTERPART rather than a
// stub, exactly as eval/mhc-battery.mjs's own discrimination arms use the
// other real material as their control. A foil written to fail would be this
// battery grading its own homework.
//
// 2. A10'S LICENSING GETS TEETH IT COULD NOT HAVE ON A TEXT — AND NEEDS NO
//    NEW ARM.
//
// READING-POLICY A10: "before spending a null, check the pair is licensed — a
// statistic insensitive to its perturbation fails invisibly and globally."
// On a fixed text you assert that the perturbation reached the input. With a
// counterpart you can PROVE it: perturb the act and watch the response move.
//
// The first cut of this module added a fourth arm (`contingency`) for that,
// which would have meant editing mhc.js's ARMS list. It was deleted before it
// ran, for the reason P39 already records in this repo's own words: a new
// cross-cutting fact is a reason to widen an existing carrier, not to build a
// second one. mhc.js ALREADY has the carrier — every arm reports `perturbed`,
// and `perturbed: false` already lands `unlicensed_perturbation` / UNMEASURED.
// So contingency is not a separate question here: a counterpart that does not
// read our acts returns the SAME responses whatever we do, which is precisely
// an arm whose perturbation did not reach the task. Every arm below checks
// that its own perturbation moved the counterpart's actual responses, and a
// deaf counterpart falls out as UNMEASURED at the floor without one line of
// special-casing. mhc-interact.test.mjs pins that with a deaf stub.
//
// 3. `lowerOrder` AND `arbitrary` GET THEIR NATURAL INTERACTION FORMS.
//
//   lowerOrder — the constituents alone. For a plan whose later acts are
//     computed from earlier responses, "alone" means BLINDED: the same acts
//     emitted open-loop, built from an empty response history. If open-loop
//     replay accomplishes the task, there was no interaction — we were
//     emitting, and the counterpart's answers were decoration.
//
//   arbitrary — the same acts, seeded-reordered (or seeded-re-paired, where
//     the coordination is a pairing rather than an order). For interaction
//     the coordination genuinely IS contingent temporal order, so this is the
//     perturbation the axiom asks for rather than an analogy to one. Same
//     construction asserted.js already states for its word-salad arm (perturb
//     what is present, hold the constituents fixed), reusing that module's own
//     `seededShuffle` rather than a second one.
//
// -- WHAT INTERACTION MEASURES THAT NO AMOUNT OF READING CAN -----------------
//
// CLAUDE.md records the causal door as deliberately shut: binding.js carries
// transferEntropy and reversalNull, and the DFR work measured 100/100 false
// positives on common-cause synthetic data — "confounding requires design,
// not statistics." Interaction IS that design. Order 11 here is a real
// do-operator: run the plan, run it with the act REMOVED, and run it with the
// act replaced by an accepted-but-irrelevant PLACEBO, over seeded draws. That
// contrast is unavailable to any reader of a fixed record, and it is the one
// item on this ladder with no counterpart in eval/mhc-battery.mjs.
//
// -- PROBES ARE DERIVED FROM THE COUNTERPART, NEVER HARDCODED ---------------
//
// eval/mhc-battery.mjs learned this the hard way and says so: a battery that
// names its own answers is a test of one fixture, and — worse — it makes
// content-independence unaskable, since it cannot be run against a second
// material. The trap is one step nastier here, because a hardcoded act string
// is a hardcoded COUNTERPART. So a counterpart declares its own probe surface
// (PROBE_SURFACE below), the ladder is written once against that surface, and
// a counterpart that cannot offer a probe lands a typed `unmeasured` at that
// order rather than a fabricated specimen. Environment-independence — the
// interaction reading of the MHC's central content-independence claim — is
// then askable with mhc.js's own `contentIndependence` and no new machinery.
//
// PURE, COUNTERPARTS INJECTED (the cast.js pattern): nothing here spawns a
// process, opens a socket, or imports an engine. eval/mhc-interaction-battery
// .mjs binds counterparts to real things; mhc-interact.test.mjs drives this
// whole ladder against in-memory stubs, so the walls stay testable wherever
// this repo is checked out.

import { seededShuffle } from "../organs/asserted.js";
import { CONTRACT, declareCounterpart, runPlan, streamOf, corroborate, enumerateSlot, depends } from "./interact.js";

// The capacities themselves live in interact.js — the module the APP calls.
// This file is a SECOND CONSUMER of that same organ, never a parallel copy of
// it: a battery that scores machinery nobody runs has measured nothing that
// matters, and two implementations of one fact is the drift class this repo's
// own postmortems keep naming. Re-exported so anything that already imported
// them from here keeps working.
export { CONTRACT, declareCounterpart, runPlan, streamOf };

/** What a counterpart declares about itself, so ONE ladder can be written
 * against every counterpart. Each key is one order's probe; a missing key is
 * a typed gap at that order, never a fabricated specimen. */
export const PROBE_SURFACE = Object.freeze({
  accepted: "5 — an act this counterpart HAS",
  foreign: "5 — an act it does NOT have (its refusal is the negative case)",
  pair: "6 — two acts with distinguishable effects: [{act, effect(text)}, {act, effect(text)}]",
  chain: "7 — {probe, read(text), use(value), check(text, value)}: a later act COMPUTED from what came back",
  rule: "8 — {seen:[case], novel, uncovered, act(case), predict(case), check(text, predicted)}",
  routes: "9 — {routes: [[act...], [act...]], reached(observations)}: two distinct routes to one effect. `reached` reads the whole run, never its last response — same reason as `intervention.effect` below.",
  slot: "10 — {template(filler), candidates:[...], empty}: an open slot whose filler set is quantified over",
  intervention:
    "11 — {plan:[act...], omit: index, placebo, effect(observations)}: the do-operator. `effect` must read the WHOLE observation list, not only its last entry — see the note below.",
});

/** Found by running the order-11 `arbitrary` arm rather than by reasoning
 * about it, and kept here because it is the kind of thing a binding gets
 * wrong silently. The first stub defined its effect as "the LAST response was
 * 42". Inserting an irrelevant act at a seeded position then broke the effect
 * whenever the insertion landed at the end — so the arm fired, and a perfectly
 * sound intervention item was refused for `arbitrary_coordination`.
 *
 * The arm was right and the effect predicate was wrong: an effect read off
 * the final response is a property of where the transcript happens to STOP,
 * not of the world the plan acted on. Any predicate of that shape is broken
 * by appending a no-op, which is exactly what an insertion null does. Effects
 * here therefore quantify over the observation list. */
export const EFFECT_MUST_NOT_READ_ONLY_THE_LAST_RESPONSE = Object.freeze({
  gap: "effect_reads_transcript_end",
  detail:
    "An `intervention.effect` that inspects only the final observation measures where the transcript stopped rather than what the plan did to the counterpart. Appending an irrelevant act breaks it, so the order-11 arbitrary arm fires and refuses a sound item.",
});

export const ENV_REFUSALS = Object.freeze({ NO_PROBE: "no_probe_at_this_order" });

/** Which probes this counterpart actually offers, and which it does not. A
 * missing probe is a fact about the counterpart — reported as such — and
 * never a reason to invent one. */
export function deriveProbes(surface) {
  const s = surface ?? {};
  const have = {};
  const gaps = [];
  for (const key of Object.keys(PROBE_SURFACE)) {
    if (s[key] == null) gaps.push({ probe: key, gap: ENV_REFUSALS.NO_PROBE, detail: PROBE_SURFACE[key] });
    else have[key] = s[key];
  }
  return Object.freeze({ probes: Object.freeze(have), gaps: Object.freeze(gaps) });
}

const isComputed = (step) => typeof step === "function";
const actsOf = (observations) => observations.map((o) => o.act).join("   ");

// -- arm builders -----------------------------------------------------------
//
// Every arm is a NEGATIVE control (mhc.js runs the arms first and each must
// FAIL to accomplish the task) and every arm reports `perturbed` honestly.

/** The generic licensing shape: an arm that could not actually perturb
 * anything says so, and mhc.js lands the item UNMEASURED rather than passed. */
const armResult = ({ completed, perturbed, detail, draws, fired }) =>
  Object.freeze({
    completed: perturbed ? completed === true : false,
    perturbed: perturbed === true,
    detail: perturbed ? detail : `nothing moved: ${detail} — the perturbation did not reach what the task reads`,
    ...(draws == null ? {} : { draws, fired: fired ?? 0 }),
  });

/** `lowerOrder` for a closed-loop plan: the same acts emitted OPEN-LOOP.
 * Licensed only if blinding actually changed an act string — if no step reads
 * the responses, there was no loop to open and this arm tested nothing. */
export function blindedArm({ counterpart, plan, goal }) {
  return async () => {
    if (!plan.some((s) => isComputed(s))) {
      return armResult({ perturbed: false, detail: "no act in this plan is computed from a response, so open-loop replay is the same plan" });
    }
    const blind = await runPlan(counterpart, plan, { blind: true });
    const real = await runPlan(counterpart, plan);
    const changed = actsOf(blind) !== actsOf(real) || streamOf(blind) !== streamOf(real);
    // The perturbation WAS applied — the responses were withheld from every
    // act that claimed to read them. Whether the acts then came out identical
    // is the FINDING, not a licensing question, and an earlier cut had it the
    // other way round: a plan whose "closed loop" ignored the response
    // produced identical acts, the arm called itself unlicensed, and axiom 3's
    // clearest possible violation landed as UNMEASURED instead of as the
    // refusal it is. Only "no act in this plan reads a response at all"
    // (checked above) is a genuine failure to perturb.
    return armResult({
      completed: await goal(blind),
      perturbed: true,
      detail: changed
        ? `the same ${plan.length} act(s) emitted open-loop, built from an empty response history — the acts came out different`
        : `the same ${plan.length} act(s) emitted open-loop, and they came out IDENTICAL: nothing in this plan actually reads the counterpart`,
    });
  };
}

/** `lowerOrder` where the constituent's power is genuinely narrower rather
 * than blinder: the arm sees the real run and may use only `use`, with
 * `moved` stating what was withheld and whether withholding it changed
 * anything the task reads. */
export function withheldArm({ counterpart, plan, use, moved }) {
  return async () => {
    const real = await runPlan(counterpart, plan);
    const licensed = await moved(real);
    return armResult({ completed: await use(real), perturbed: licensed.perturbed, detail: licensed.detail });
  };
}

/** `arbitrary`: the same acts, seeded-reordered, closed loop otherwise.
 * Reported natural-frequency (fired of draws), the way asserted.js's own
 * order arm and eval/mhc-battery.mjs's `shuffled` already do. */
export function reorderedArm({ counterpart, plan, goal, draws = 5, seed = 0 }) {
  return async () => {
    if (plan.length < 2) return armResult({ perturbed: false, detail: "a one-act plan has no order to re-deal" });
    const identity = plan.map((_, i) => i).join(",");
    let fired = 0;
    let anyChanged = false;
    for (let d = 0; d < draws; d += 1) {
      const order = seededShuffle(plan.map((_, i) => i), seed + d);
      if (order.join(",") === identity) continue;
      anyChanged = true;
      if (await goal(await runPlan(counterpart, order.map((i) => plan[i])))) fired += 1;
    }
    return armResult({
      completed: fired > 0,
      perturbed: anyChanged,
      draws,
      fired,
      detail: `accomplished the task in ${fired} of ${draws} seeded re-orderings of the same acts`,
    });
  };
}

/** `arbitrary` for items whose coordination is a PAIRING rather than an
 * order: the same responses, re-attached to the wrong acts. The WHOLE
 * response moves (acceptance included) — an earlier cut shuffled only the
 * text, which left an acceptance-reading task invariant under its own null. */
export function repairedArm({ counterpart, plan, goal, draws = 5, seed = 0 }) {
  return async () => {
    const real = await runPlan(counterpart, plan);
    if (real.length < 2) return armResult({ perturbed: false, detail: "fewer than two responses — nothing to re-pair" });
    const identity = real.map((o) => streamOf([o])).join("|");
    let fired = 0;
    let anyChanged = false;
    for (let d = 0; d < draws; d += 1) {
      const dealt = seededShuffle(real.map((o) => ({ accepted: o.accepted, text: o.text })), seed + d);
      if (dealt.map((o) => streamOf([o])).join("|") === identity) continue;
      anyChanged = true;
      if (await goal(real.map((o, i) => ({ act: o.act, ...dealt[i] })))) fired += 1;
    }
    return armResult({
      completed: fired > 0,
      perturbed: anyChanged,
      draws,
      fired,
      detail: `accomplished the task in ${fired} of ${draws} seeded re-pairings of act to response`,
    });
  };
}

/** `discrimination`: the same task against a REAL sibling counterpart, not a
 * stub written to fail. Licensed only if the sibling is confirmed to lack the
 * affordance the task needs. */
export function siblingArm({ sibling, plan, goal, lacks }) {
  return async () => {
    if (!sibling) return armResult({ perturbed: false, detail: "no sibling counterpart supplied — this battery has nothing to discriminate against" });
    const observations = await runPlan(sibling, plan);
    return armResult({
      completed: await goal(observations),
      perturbed: await lacks(observations),
      detail: `the same plan against "${sibling.id}", confirmed not to accept it`,
    });
  };
}

// -- the ladder -------------------------------------------------------------

const UNREACHABLE = (detail) => async () => ({ unreachable: true, detail });

/** An item whose probe the counterpart does not offer. Task and arms all
 * report `unreachable`, so mhc.js lands it `unmeasured` — which is exactly
 * what `contentIndependence` already reads as "no probe": a fact about the
 * counterpart, never about the item or the system. */
function noProbe(base, probe) {
  const detail = `this counterpart declares no "${probe}" probe: ${PROBE_SURFACE[probe]}`;
  return {
    ...base,
    task: UNREACHABLE(detail),
    arms: { lowerOrder: UNREACHABLE(detail), arbitrary: UNREACHABLE(detail), discrimination: UNREACHABLE(detail) },
  };
}

const short = (s) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 45)}...` : t;
};

/** The interaction ladder, orders 5-11, written ONCE against the probe
 * surface and run against any counterpart that declares one.
 *
 * Orders 0-4 are mhc.js's own declared floor (out of scope by construction).
 * Orders 12-16 are NOT built here and are not implied: the report simply has
 * no item at them and `stageFrom` caps accordingly. Axiom 1 requires
 * contiguity, so stopping is legitimate where skipping would not be. */
export function interactionLadder({ counterpart, sibling, assembly, draws = 5, seed = 0 }) {
  const surface = counterpart.describe();
  const { probes, gaps } = deriveProbes(surface);
  const A = { assembly };
  // The assembly rides on EVERY item, including the ones with no probe:
  // READING-POLICY P0 is a requirement on the claim, and "this counterpart
  // offers no specimen at order 6" is a claim about the assembly too.
  const at = (order, probe, build) => {
    const base = Object.assign({}, BASES[order](counterpart), A);
    return probes[probe] == null ? noProbe(base, probe) : Object.assign({}, base, build(probes[probe]));
  };

  const items = [
    // -- 5 . Nominal ------------------------------------------------------
    at(5, "accepted", () => {
      const { accepted, foreign } = probes;
      if (foreign == null) return noProbe(Object.assign({}, BASES[5](counterpart), A), "foreign");
      const plan = [accepted, foreign];
      const goal = (obs) => obs[0]?.accepted === true && obs[1]?.accepted === false;
      return {
        task: async () => {
          const obs = await runPlan(counterpart, plan);
          return {
            completed: goal(obs),
            detail: `"${short(accepted)}" accepted (${obs[0]?.accepted}); "${short(foreign)}" refused (${obs[1]?.accepted === false})`,
          };
        },
        arms: {
          // Below the floor there is no notion of an affordance — only bytes
          // emitted. Judging by the act STRING alone cannot refuse an act
          // that is perfectly well-formed and simply is not there.
          lowerOrder: withheldArm({
            counterpart,
            plan,
            use: (obs) => obs[0].act.trim().length > 0 && obs[1].act.trim().length === 0,
            moved: async (obs) => ({
              perturbed: obs[0]?.accepted !== obs[1]?.accepted || obs[0]?.text !== obs[1]?.text,
              detail: "the counterpart's responses were withheld; only the act strings remain",
            }),
          }),
          arbitrary: repairedArm({ counterpart, plan, goal, draws, seed }),
          discrimination: siblingArm({ sibling, plan, goal, lacks: (obs) => obs[0]?.accepted === false }),
        },
      };
    }),

    // -- 6 . Sentential ---------------------------------------------------
    at(6, "pair", (pair) => {
      const plan = [pair[0].act, pair[1].act];
      const goal = (obs) =>
        pair[0].effect(obs[0]?.text ?? "") && pair[1].effect(obs[1]?.text ?? "") && !pair[1].effect(obs[0]?.text ?? "");
      return {
        task: async () => {
          const obs = await runPlan(counterpart, plan);
          return {
            completed: goal(obs),
            detail: `"${short(pair[0].act)}" produced its own effect; "${short(pair[1].act)}" produced its own; and the first did not produce the second's`,
          };
        },
        arms: {
          // Order 5 alone knows only that an act was accepted. Both of these
          // are accepted, so acceptance cannot tell one effect from the other.
          lowerOrder: withheldArm({
            counterpart,
            plan,
            use: (obs) => obs[0].accepted !== obs[1].accepted,
            moved: async (obs) => ({
              perturbed: (obs[0]?.text ?? "") !== (obs[1]?.text ?? ""),
              detail: "the effect texts were withheld; only acceptance remains",
            }),
          }),
          arbitrary: repairedArm({ counterpart, plan, goal, draws, seed }),
          discrimination: siblingArm({ sibling, plan, goal, lacks: (obs) => !obs.every((o) => o.accepted) }),
        },
      };
    }),

    // -- 7 . Preoperational -----------------------------------------------
    at(7, "chain", (chain) => {
      // The load-bearing step: an act COMPUTED from what came back. This is
      // the interaction analogue of the reading battery's order-7 item (a
      // pronoun bound to what was read before it) — anaphora is to a text
      // what carried state is to a counterpart.
      const plan = [chain.probe, (obs) => chain.use(chain.read(obs[0]?.text ?? ""))];
      // Located by PROVENANCE, never by index: the arbitrary arm re-orders the
      // plan, which moves the computed act off position 1 — and a positional
      // goal then reads whichever act happens to land there, which is how a
      // reordering null can be satisfied by an act that was never computed
      // from anything. `computed` is what interact.js records for exactly this.
      const goal = (obs) => {
        const at = obs.findIndex((o) => o.computed);
        if (at <= 0) return false; // nothing came back before it to compute from
        return chain.check(obs[at]?.text ?? "", chain.read(obs[at - 1]?.text ?? ""));
      };
      return {
        task: async () => {
          const obs = await runPlan(counterpart, plan);
          return {
            completed: goal(obs),
            detail: `read "${short(chain.read(obs[0]?.text ?? ""))}" back from "${short(chain.probe)}", built "${short(obs[1]?.act ?? "")}" out of it, and the counterpart carried it`,
          };
        },
        arms: {
          lowerOrder: blindedArm({ counterpart, plan, goal }),
          arbitrary: reorderedArm({ counterpart, plan, goal, draws, seed }),
          discrimination: siblingArm({ sibling, plan, goal, lacks: (obs) => obs[0]?.accepted === false }),
        },
      };
    }),

    // -- 8 . Primary ------------------------------------------------------
    at(8, "rule", (rule) => {
      const plan = [rule.act(rule.novel)];
      const goal = (obs) => {
        const predicted = rule.predict(rule.novel);
        return predicted != null && rule.check(obs[0]?.text ?? "", predicted) && rule.predict(rule.uncovered) == null;
      };
      return {
        task: async () => {
          const obs = await runPlan(counterpart, plan);
          return {
            completed: goal(obs),
            detail: `predicted "${short(rule.predict(rule.novel))}" for a case never run, and the counterpart produced it; the rule declines the case it does not cover`,
          };
        },
        arms: {
          // Order 7 alone carries what happened; it does not generalise. Its
          // best answer for an unrun case is an already-seen case's value.
          lowerOrder: withheldArm({
            counterpart,
            plan,
            use: (obs) => rule.check(obs[0]?.text ?? "", rule.predict(rule.seen[0])),
            moved: async () => ({
              perturbed: String(rule.predict(rule.seen[0])) !== String(rule.predict(rule.novel)),
              detail: "the rule was withheld; only an already-observed case's own value remains",
            }),
          }),
          // Held to EXACTLY the standard the task is held to, across EVERY
          // case rather than the novel one alone. An earlier cut scored the
          // re-deal on the novel case only; with three cases a shuffle lands
          // the right value there about a third of the time, so the arm would
          // have refused a sound item for its own small sample. Asking the
          // dealt map to predict every case is the same conjunction the task
          // itself makes, and a non-identity permutation of distinct values
          // cannot satisfy it.
          arbitrary: async () => {
            const cases = [...rule.seen, rule.novel];
            const truth = cases.map((c) => String(rule.predict(c)));
            const observed = [];
            for (const c of cases) observed.push((await runPlan(counterpart, [rule.act(c)]))[0]?.text ?? "");
            let fired = 0;
            let anyChanged = false;
            for (let d = 0; d < draws; d += 1) {
              const dealt = seededShuffle(truth, seed + d);
              if (dealt.join(" ") === truth.join(" ")) continue;
              anyChanged = true;
              if (observed.every((text, i) => rule.check(text, dealt[i]))) fired += 1;
            }
            return armResult({
              completed: fired > 0,
              perturbed: anyChanged,
              draws,
              fired,
              detail: `a seeded re-dealing of the rule's own case-to-value map predicted every case in ${fired} of ${draws} draws`,
            });
          },
          discrimination: siblingArm({ sibling, plan, goal, lacks: (obs) => obs[0]?.accepted === false }),
        },
      };
    }),

    // -- 9 . Concrete -----------------------------------------------------
    at(9, "routes", (routes) => {
      // Corroboration counted by ROUTE, not by repetition — the interaction
      // reading of the shipped order-9 item's "passages and sources counted
      // apart, because two chunks of one file are one perspective."
      const [routeA, routeB] = routes.routes;
      // `reached` reads the WHOLE run, never its last response — the same rule
      // EFFECT_MUST_NOT_READ_ONLY_THE_LAST_RESPONSE states for an
      // intervention, and it bites here for the same reason: the arbitrary arm
      // re-deals which acts constitute a route, and a last-response predicate
      // would report on where each dealt route happened to stop.
      const reached = (obs) => routes.reached(obs);
      const survey = async (cp) => {
        const a = await runPlan(cp, routeA);
        const b = await runPlan(cp, routeB);
        const again = await runPlan(cp, routeA);
        const arrivals = [a, b, again].filter(reached).length;
        const distinct = new Set();
        if (reached(a) || reached(again)) distinct.add(routeA.join(" "));
        if (reached(b)) distinct.add(routeB.join(" "));
        return { arrivals, distinct: distinct.size };
      };
      return {
        task: async () => {
          const s = await survey(counterpart);
          return {
            completed: s.distinct === 2 && s.arrivals === 3,
            detail: `${s.arrivals} arrival(s) of the same effect from ${s.distinct} distinct route(s) — one route run twice is still one route`,
          };
        },
        arms: {
          // Order 8 alone applies the rule per instance; it has no notion of a
          // perspective, so it counts arrivals. One route run twice then reads
          // as two corroborations.
          lowerOrder: async () => {
            const s = await survey(counterpart);
            return armResult({
              completed: s.arrivals === 2,
              perturbed: s.arrivals !== s.distinct,
              detail: "counted by arrival rather than by route",
            });
          },
          // Re-deal WHICH ACTS constitute a route, sizes preserved. Route
          // identity itself is invariant under a label shuffle, so shuffling
          // labels would be A10's own trap; the acts are what the coordination
          // actually groups.
          arbitrary: async () => {
            const flat = [...routeA, ...routeB];
            if (flat.length < 2) return armResult({ perturbed: false, detail: "one act in total — nothing to re-deal into routes" });
            // Licensed on the PARTITION, not on the flat sequence: with two
            // routes of equal length, simply swapping them is a different
            // permutation that yields the identical pair of routes, so a
            // sequence-level "changed" test would count a no-op as a re-deal
            // and the arm would fire on its own null. What this arm perturbs
            // is which acts constitute a route.
            const partition = (list) => [list.slice(0, routeA.length).join("|"), list.slice(routeA.length).join("|")].sort().join("  ||  ");
            const identity = partition(flat);
            let fired = 0;
            let anyChanged = false;
            for (let d = 0; d < draws; d += 1) {
              const dealt = seededShuffle(flat, seed + d);
              if (partition(dealt) === identity) continue;
              anyChanged = true;
              const x = dealt.slice(0, routeA.length);
              const y = dealt.slice(routeA.length);
              if (reached(await runPlan(counterpart, x)) && reached(await runPlan(counterpart, y))) fired += 1;
            }
            return armResult({
              completed: fired > 0,
              perturbed: anyChanged,
              draws,
              fired,
              detail: `the same acts re-dealt into two routes of the same sizes reached the effect twice in ${fired} of ${draws} draws`,
            });
          },
          discrimination: siblingArm({
            sibling,
            plan: routeA,
            goal: async (obs) => reached(obs),
            lacks: (obs) => !obs.every((o) => o.accepted),
          }),
        },
      };
    }),

    // -- 10 . Abstract ----------------------------------------------------
    at(10, "slot", (slot) => {
      const probeSet = async (cp, candidates) => {
        const out = [];
        for (const filler of candidates) {
          const obs = await runPlan(cp, [slot.template(filler)]);
          if (obs[0]?.accepted) out.push(filler);
        }
        return out;
      };
      return {
        task: async () => {
          const admitted = await probeSet(counterpart, slot.candidates);
          const empty = await probeSet(counterpart, [slot.empty]);
          return {
            completed: admitted.length > 1 && admitted.length < slot.candidates.length && empty.length === 0,
            detail: `the open slot ranges over ${admitted.length} of ${slot.candidates.length} candidate filler(s) — ${admitted.map(short).join(", ")}; a slot with no admissible filler ranges over 0`,
          };
        },
        arms: {
          // Order 9 alone coordinates the instances in hand. Answering from
          // one already-run instance gives a singleton, never the set.
          lowerOrder: async () => {
            const admitted = await probeSet(counterpart, slot.candidates);
            const fromOne = admitted.slice(0, 1);
            return armResult({
              completed: fromOne.length === admitted.length,
              perturbed: admitted.length > 1,
              detail: "answered from a single already-run instance rather than by quantifying over the slot",
            });
          },
          // Guessing. Its discrimination is a property of the POOL — a random
          // subset of a three-candidate slot reproduces a two-filler answer
          // about a third of the time — so it is reported natural-frequency
          // (fired of draws) and never converted into a threshold here. A
          // binding that offers a pool too small for the null to say anything
          // will see the item refused with the count on its face, which is the
          // honest outcome rather than a hidden one.
          arbitrary: async () => {
            const admitted = await probeSet(counterpart, slot.candidates);
            let fired = 0;
            let anyChanged = false;
            for (let d = 0; d < draws; d += 1) {
              const dealt = seededShuffle(slot.candidates, seed + d).slice(0, Math.max(1, admitted.length));
              if (dealt.join(",") === admitted.join(",")) continue;
              anyChanged = true;
              if (dealt.length === admitted.length && dealt.every((f) => admitted.includes(f))) fired += 1;
            }
            return armResult({
              completed: fired > 0,
              perturbed: anyChanged,
              draws,
              fired,
              detail: `a seeded random subset of the same size reproduced the admitted set in ${fired} of ${draws} draws`,
            });
          },
          discrimination: siblingArm({
            sibling,
            plan: [slot.template(slot.candidates[0])],
            goal: async (obs) => obs[0]?.accepted === true,
            lacks: (obs) => obs[0]?.accepted === false,
          }),
        },
      };
    }),

    // -- 11 . Formal ------------------------------------------------------
    at(11, "intervention", (iv) => {
      // THE DO-OPERATOR. CLAUDE.md records the causal door as deliberately
      // shut for the measuring organ, on the DFR finding that confounding
      // "requires design, not statistics". This is that design: not a null
      // built by re-dealing a record, but the world run again with one act
      // removed — and once more with an accepted-but-irrelevant PLACEBO in its
      // place, so the contrast is THIS act rather than merely an act.
      const without = iv.plan.filter((_, i) => i !== iv.omit);
      const placeboed = iv.plan.map((s, i) => (i === iv.omit ? iv.placebo : s));
      return {
        task: async () => {
          let held = 0;
          let brokeByOmission = 0;
          let brokeByPlacebo = 0;
          for (let d = 0; d < draws; d += 1) {
            if (iv.effect(await runPlan(counterpart, iv.plan))) held += 1;
            if (!iv.effect(await runPlan(counterpart, without))) brokeByOmission += 1;
            if (!iv.effect(await runPlan(counterpart, placeboed))) brokeByPlacebo += 1;
          }
          return {
            completed: held === draws && brokeByOmission === draws && brokeByPlacebo === draws,
            draws,
            fired: held,
            detail: `with the act: ${held}/${draws} held. Without it: ${brokeByOmission}/${draws} broke. With an accepted-but-irrelevant act in its place: ${brokeByPlacebo}/${draws} broke — so the effect follows THIS act, not merely an act.`,
          };
        },
        arms: {
          // Order 10 alone quantifies over what the counterpart ACCEPTS. Every
          // act of the shortened plan is still accepted on its own, so
          // acceptance-quantification is blind to the dependence entirely.
          lowerOrder: async () => {
            const each = [];
            for (const act of iv.plan) each.push((await runPlan(counterpart, [act]))[0]);
            const full = await runPlan(counterpart, iv.plan);
            const shortened = await runPlan(counterpart, without);
            return armResult({
              completed: each.every((o) => o.accepted) && iv.effect(shortened),
              perturbed: iv.effect(full) !== iv.effect(shortened),
              detail: "read only which acts the counterpart accepts, which the omission leaves unchanged",
            });
          },
          // An ARBITRARY change instead of the named one: insert the placebo
          // at a seeded position and leave every real act in place. The effect
          // must survive it. If an irrelevant insertion also breaks the
          // effect, the intervention measured brittleness, not dependence —
          // and refusing the item is then the correct reading.
          arbitrary: async () => {
            let fired = 0;
            let anyChanged = false;
            for (let d = 0; d < draws; d += 1) {
              const positions = iv.plan.map((_, i) => i).concat(iv.plan.length);
              const at_ = seededShuffle(positions, seed + d)[0];
              const inserted = [...iv.plan.slice(0, at_), iv.placebo, ...iv.plan.slice(at_)];
              if (inserted.length === iv.plan.length) continue;
              anyChanged = true;
              const full = await runPlan(counterpart, iv.plan);
              if (iv.effect(full) && !iv.effect(await runPlan(counterpart, inserted))) fired += 1;
            }
            return armResult({
              completed: fired > 0,
              perturbed: anyChanged,
              draws,
              fired,
              detail: `an arbitrary irrelevant insertion reproduced the task's own contrast in ${fired} of ${draws} draws`,
            });
          },
          discrimination: siblingArm({
            sibling,
            plan: iv.plan,
            goal: async (obs) => iv.effect(obs),
            lacks: (obs) => !obs.every((o) => o.accepted),
          }),
        },
      };
    }),
  ];

  return Object.freeze({ items: Object.freeze(items), gaps, surface });
}

/** The declarations mhc.js requires, per order, held in one place so an item
 * cannot quietly disagree with the one below it about what its constituents
 * are. Axiom 1 is checked against these by mhc.js itself. */
const BASES = {
  5: (cp) => ({
    id: "i5-nominal",
    order: 5,
    name: "an act names an affordance the counterpart actually has",
    organ: `${cp.id} — accept / refuse`,
    stages: ["emission", "acceptance"],
    definedInTermsOf: [],
    organizes:
      "a byte string emitted into a counterpart is folded into an act that either names something it has or does not, so the counterpart's refusal is information rather than noise",
  }),
  6: (cp) => ({
    id: "i6-sentential",
    order: 6,
    name: "one act, one effect, in order",
    organ: `${cp.id} — act to effect`,
    stages: ["emission", "acceptance", "effect"],
    definedInTermsOf: ["i5-nominal"],
    organizes:
      "two named affordances are coordinated with their own effects, so an effect belongs to the act that produced it rather than to the exchange at large",
  }),
  7: (cp) => ({
    id: "i7-preoperational",
    order: 7,
    name: "a later act computed from what came back",
    organ: `${cp.id} — carried state`,
    stages: ["emission", "acceptance", "effect", "carry"],
    definedInTermsOf: ["i6-sentential"],
    organizes:
      "two act-effect pairs are coordinated ACROSS turns, the second act being a function of the first's response — the loop the word interaction actually names",
  }),
  8: (cp) => ({
    id: "i8-primary",
    order: 8,
    name: "an empirical rule applied to a case not yet run",
    organ: `${cp.id} — prediction then execution`,
    stages: ["emission", "effect", "carry", "prediction"],
    definedInTermsOf: ["i7-preoperational"],
    organizes:
      "carried exchanges are coordinated into a rule that predicts an unrun case and declines the cases it does not cover",
  }),
  9: (cp) => ({
    id: "i9-concrete",
    order: 9,
    name: "corroboration counted by route, not by repetition",
    organ: `${cp.id} — two routes to one effect`,
    stages: ["effect", "prediction", "corroboration"],
    definedInTermsOf: ["i8-primary"],
    organizes:
      "several applications of the rule are coordinated so that two DIFFERENT routes to one effect count as two and one route run twice counts as one",
  }),
  10: (cp) => ({
    id: "i10-abstract",
    order: 10,
    name: "the whole filler set of an open slot in the counterpart",
    organ: `${cp.id} — slot quantification`,
    stages: ["acceptance", "corroboration", "quantification"],
    definedInTermsOf: ["i9-concrete"],
    organizes:
      "concrete accepted instances are coordinated into a variable ranging over a category, so the answer is a SET rather than the instances that happen to have been run",
  }),
  11: (cp) => ({
    id: "i11-formal",
    order: 11,
    name: "the do-operator: this act, against the world run again without it",
    organ: `${cp.id} — intervention`,
    stages: ["quantification", "intervention"],
    definedInTermsOf: ["i10-abstract"],
    organizes:
      "quantified acceptance is coordinated with a constructed counterfactual — the same plan minus one act, and the same plan with an irrelevant act in its place — so a dependence is tested rather than observed",
  }),
};
