// mhc.js — the Model of Hierarchical Complexity (Commons) as a measuring
// door onto this instrument's OWN capacities: a battery of tasks whose order
// is declared analytically in advance, run against the real organs, and
// scored quantally.
//
// WHY THIS SHAPE, so it is not re-derived. The MHC's single most useful
// property for this repo is the one Commons put at the centre of it: the
// SEPARATION OF TASK FROM PERFORMANCE. A task's order of hierarchical
// complexity is determined analytically, before and independently of anyone
// executing it; a performer's stage is then the highest-order task they
// actually complete. Predecessor stage theories, on Commons's own complaint,
// "confounded stimulus and response" — they scored performances without ever
// independently specifying the complexity of what was being performed.
//
// That separation is the same line this repo already draws everywhere else,
// arriving from the other direction: the cube is NOT a content classifier
// (packages/engine/operators.js records 95.7% of cell assignments surviving
// a word-shuffle, which refutes deriving a terrain from a passage), so a
// task's order here is likewise DECLARED by whoever writes the item, with
// its constituents named, and is NEVER computed from the material the item
// happens to run on. An order read off the material would be exactly the
// refuted move under new vocabulary.
//
// THE GIVER IS NAMED AND THE TABLE IS RECEIVED. The sixteen orders below are
// Commons's, not this repo's, and they enter the way every received closed
// class in this codebase enters (priors.js's own standing discipline — a
// received class names its giver or it does not enter). Nothing here invents
// an order, renames one, or reorders the sequence.
//
// ── WHAT IS ACTUALLY NEW HERE ─────────────────────────────────────────────
//
// Not the orders, and not the axioms. What this module contributes is the
// mechanical enforcement of the axioms as CONTROL ARMS, so that a declared
// order has to survive a test rather than stand on the declarer's say-so:
//
//   Axiom 1 (defined in terms of) is structural and cheap: an item names its
//     constituents, and each must resolve to a real item one order down in
//     the same battery. An item that names nothing, at any order above the
//     battery's floor, is refused — not scored.
//
//   Axiom 2 (organizes) is structural too: the item must declare WHAT
//     coordination it performs over those constituents, in its own words, and
//     must supply the arms below. A coordination nobody can state and nobody
//     can perturb is not a coordination.
//
//   Axiom 3 (non-arbitrarily, producing outcomes the lower-order actions
//     alone cannot accomplish) is the one that actually bites, and it is two
//     arms, because the axiom is two claims:
//
//       lowerOrder — run the constituents ALONE on the same task. If they
//         accomplish it, the item is not at the order it claims: the higher
//         coordination added nothing. Commons is explicit that arbitrary
//         chaining of lower-order actions does not constitute a higher order.
//
//       arbitrary — re-coordinate the same constituents arbitrarily (seeded,
//         with the constituents themselves held fixed) and run again. If it
//         still succeeds, the organization was arbitrary, so axiom 3 fails
//         however well the item performs.
//
// The `arbitrary` arm's construction is not invented here either: it is this
// repo's own standing null shape — perturb what is present, declare what is
// held fixed — which asserted.js already states in full for its per-edge
// word-salad arm (vocabulary, referent identity and sentence boundaries all
// held fixed while word order is destroyed), itself carried from
// goldens/agency-civic/rotation-control.mjs and from the shuffle-survival
// measurement that refuted the content classifier. Same discipline, aimed at
// a task's coordination instead of a clause's word order.
//
//   discrimination — a THIRD arm, and this one is NOT Commons's. It is this
//     battery's own addition and is labelled as such wherever it is
//     reported: an item is also run on material that does NOT support it and
//     must fail there. A task that succeeds on everything has measured
//     nothing, whatever its order. Commons's axioms say nothing about this
//     because the MHC scores task structure, not an instrument's precision;
//     this repo cares about both, and conflating the two givers would be the
//     kind of silent borrowing POLICIES.md exists to catch.
//
// ── A REFUSED ITEM IS A GAP IN THE BATTERY, NEVER A FAILURE OF THE SYSTEM ──
//
// This is the load-bearing distinction and it falls straight out of the
// task/performance separation above. When an item's axiom arms fail, what has
// been measured is that THE ITEM IS MIS-DECLARED — the battery does not have
// a genuine order-N task at that order — and the system is therefore
// UNMEASURED there. That is categorically different from an item whose axioms
// hold and whose task the system then fails, which is a real ceiling. The two
// are typed apart everywhere in this module (`refused` vs `failed`), and
// `stageFrom` refuses to report a stage number ACROSS an unmeasured order
// rather than guessing past it — the same posture every other verdict in this
// repo already holds: a check may say "I could not compare this" or "I
// compared it and it failed," never manufacture the second from the first.
//
// ── WHAT READING-POLICY BINDS HERE, AND WHAT IT CHANGED ───────────────────
//
// READING-POLICY.md is canonical for how reading works, and three of its
// rules bear directly on a battery like this one. Each changed the design
// rather than merely being cited after the fact:
//
//   P0 — "Any claim about 'what this system can do' must name the assembly it
//     was measured on... drivers that hand-chain engine organs are
//     experiments, each asking one question; they are not the reader."
//     A battery of capacity items IS such a claim, so `assembly` is a
//     REQUIRED field on every item and on the report, checked at declaration
//     time. It is not reconstructed afterwards, and a stage read off a
//     hand-chained assembly may never be reported as the assembled reader's.
//
//   P3 — "State which priors were injected in every reported run. A result
//     produced with an empty coref prior is a result about an unprimed
//     reader." The prior list is therefore not defaulted: an undeclared list
//     is a typed gap on the report's face. This rule caught a live false
//     measurement while this module was being built — a nominal-order item
//     scoring the system on folding "Abraham Lincoln" into "Lincoln", which
//     P3 says outright is measuring the missing coref prior, not the engine.
//
//   A10 — the standing rule, and the one that changed the machinery most:
//     "before spending a null, check the pair is licensed — a statistic
//     insensitive to its perturbation fails invisibly and globally." Every
//     arm here IS a null, so every arm must report whether its perturbation
//     actually reached what the task reads (`perturbed`). An arm that did not
//     is typed `unlicensed_perturbation` and leaves the item UNMEASURED —
//     never read as "the axiom held," which is exactly the invisible global
//     failure A10 names. A9 ("one null is not a null") is why an arm may
//     declare `draws`/`fired` and report plural seeded grounds rather than
//     one, natural-frequency, the way asserted.js's own order arm does.
//
//   P2 — "a run reports which stages it used; unused stages are not implied."
//     `stages` is likewise required per item, naming which of P2's reading
//     stages that item actually exercises.
//
// PURE, ORGANS INJECTED (the cast.js pattern): this module runs whatever
// async task and arms an item hands it and knows nothing about text,
// referents, edges or the engine. eval/mhc-battery.mjs is where the items are
// bound to real organs; mhc.test.mjs exercises the machinery's own walls with
// no engine at all, so the walls stay testable wherever this repo is checked
// out.

/** The received table. Commons & Richards (1984); Commons, Richards & Kuhn
 * (1982); Commons (2008). Piaget correspondences as given in the eo-wiki's
 * own "MHC and EO" article, which is where this repo already records the
 * convergence — this module reuses that reading rather than restating it. */
export const GIVER = Object.freeze({
  name: "Model of Hierarchical Complexity",
  authors: "Michael Lamport Commons, Francis Asbury Richards (and others)",
  primary: "Commons, M. L., & Richards, F. A. (1984). Beyond formal operations, Vol. 1.",
  axioms: "Commons, M. L. (2008). Introduction to the model of hierarchical complexity and its relationship to postformal action. World Futures, 64(5-7), 305-320.",
  heldHere: "eo-wiki/articles/wiki/mhc-and-eo.md — this repo's own record of the convergence, and the source of the order table reproduced below",
});

export const ORDERS = Object.freeze([
  Object.freeze({ order: 0, name: "Calculatory", piaget: "Sensorimotor" }),
  Object.freeze({ order: 1, name: "Automatic", piaget: "Sensorimotor" }),
  Object.freeze({ order: 2, name: "Sensory & Motor", piaget: "Sensorimotor" }),
  Object.freeze({ order: 3, name: "Circular Sensory-Motor", piaget: "Sensorimotor" }),
  Object.freeze({ order: 4, name: "Sensory-Motor", piaget: "Sensorimotor" }),
  Object.freeze({ order: 5, name: "Nominal", piaget: "Pre-operational" }),
  Object.freeze({ order: 6, name: "Sentential", piaget: "Pre-operational" }),
  Object.freeze({ order: 7, name: "Preoperational", piaget: "Concrete operational" }),
  Object.freeze({ order: 8, name: "Primary", piaget: "Concrete operational" }),
  Object.freeze({ order: 9, name: "Concrete", piaget: "Concrete operational" }),
  Object.freeze({ order: 10, name: "Abstract", piaget: "Formal operational" }),
  Object.freeze({ order: 11, name: "Formal", piaget: "Formal operational" }),
  Object.freeze({ order: 12, name: "Systematic", piaget: "Postformal" }),
  Object.freeze({ order: 13, name: "Metasystematic", piaget: "Postformal" }),
  Object.freeze({ order: 14, name: "Paradigmatic", piaget: "Postformal" }),
  Object.freeze({ order: 15, name: "Cross-Paradigmatic", piaget: "Postformal" }),
  Object.freeze({ order: 16, name: "Meta-Cross-Paradigmatic", piaget: "Postformal" }),
]);

const BY_ORDER = new Map(ORDERS.map((o) => [o.order, o]));

export function orderOf(n) {
  return BY_ORDER.get(Number(n)) ?? null;
}

/** Orders 0-4 are OUT OF SCOPE BY CONSTRUCTION for this instrument, and that
 * is a structural fact about it rather than an unmeasured gap — which is why
 * it gets its own name here instead of being reported as a hole.
 *
 * The eo-wiki's reading of the MHC identifies roughly three "phaseposts" —
 * genuinely discontinuous transitions in what CLASS OF OBJECT a system can
 * operate on — the first being sensorimotor to symbolic at orders ~4→5,
 * where a system becomes capable of operating on named things rather than
 * directly on ambient conditions. This instrument is handed bytes that are
 * already symbols. It never operates on ambient conditions at all: there is
 * no sensor, and orders 0-4 name tasks it is not failing to do but is not in
 * the business of doing. Declaring a floor is therefore the honest move, and
 * declaring it HERE (rather than silently starting a battery at 5) is what
 * keeps it from reading as a convenient omission. */
export const SYMBOLIC_FLOOR = 5;
export const FLOOR_REASON = Object.freeze({
  gap: "out_of_scope_by_construction",
  detail:
    "Orders 0-4 are sensorimotor: they name operating on ambient conditions rather than on named things. This instrument receives symbols and has no sensor, so it does not perform these tasks and is not measured against them. The eo-wiki's phasepost reading places the sensorimotor-to-symbolic transition at orders ~4-5; this battery starts above it, by construction rather than by omission.",
});

/** The three axioms, verbatim in structure, each named with what checks it.
 * Kept as data so a report can print the axiom beside the arm that tested it
 * and a reader never has to take "axiom 3 held" on the module's word. */
export const AXIOMS = Object.freeze([
  Object.freeze({
    axiom: 1,
    statement: "A higher-order action is defined in terms of actions at the next lower order.",
    checkedBy: "structural — every declared constituent must resolve to an item one order down in the same battery",
    giver: "Commons",
  }),
  Object.freeze({
    axiom: 2,
    statement: "A higher-order action organizes those lower-order actions.",
    checkedBy: "structural — the item must state the coordination it performs and supply arms that can perturb it",
    giver: "Commons",
  }),
  Object.freeze({
    axiom: 3,
    statement:
      "A higher-order action organizes them non-arbitrarily, producing outcomes the lower-order actions alone cannot accomplish.",
    checkedBy:
      "two arms — `lowerOrder` (constituents alone must NOT accomplish the task) and `arbitrary` (constituents re-coordinated arbitrarily must NOT accomplish it)",
    giver: "Commons",
  }),
  Object.freeze({
    axiom: null,
    statement:
      "An instrument that succeeds on material which does not support the task has measured nothing.",
    checkedBy: "one arm — `discrimination` (the task must FAIL on unsupporting material)",
    giver: "this battery, NOT Commons — the MHC scores task structure and says nothing about an instrument's precision",
  }),
]);

export const ITEM_REFUSALS = Object.freeze({
  CONSTITUENT_MISSING: "constituent_missing",
  NO_COORDINATION_DECLARED: "no_coordination_declared",
  ARM_MISSING: "arm_missing",
  LOWER_ORDER_SUFFICES: "lower_order_suffices",
  ARBITRARY_COORDINATION: "arbitrary_coordination",
  INDISCRIMINATE: "indiscriminate",
  UNLICENSED_PERTURBATION: "unlicensed_perturbation",
  ORGAN_UNREACHABLE: "organ_unreachable",
  ASSEMBLY_UNNAMED: "assembly_unnamed",
});

const ARMS = Object.freeze(["lowerOrder", "arbitrary", "discrimination"]);

/** Shape-check one declared item. Returns `{ ok: true, item }` or
 * `{ ok: false, refusal }` — never throws on a malformed declaration, the
 * same posture grid.js's own parse takes, so a battery with one bad item
 * reports that item rather than dying. */
export function declareItem(raw) {
  const item = raw ?? {};
  const id = String(item.id ?? "").trim();
  const order = Number(item.order);
  if (!id) return refuse(null, "an item must carry an id");
  if (!BY_ORDER.has(order)) return refuse(id, `order ${item.order} is not one of the sixteen`);
  if (typeof item.task !== "function") return refuse(id, "an item must carry a task() to run");
  if (!String(item.organ ?? "").trim()) return refuse(id, "an item must name the organ it drives");
  // READING-POLICY P0: "any claim about what this system can do must name the
  // assembly it was measured on." An item IS such a claim, so the assembly is
  // required at declaration time rather than reconstructed for the report.
  if (!String(item.assembly ?? "").trim()) return refuse(id, "an item must name the assembly it was measured on (READING-POLICY P0)");
  // P2: "a run reports which stages it used; unused stages are not implied."
  if (!(item.stages?.length > 0)) return refuse(id, "an item must name the reading stages it uses (READING-POLICY P2)");

  const isFloor = order === SYMBOLIC_FLOOR;
  const constituents = Object.freeze([...(item.definedInTermsOf ?? [])].map(String));
  if (!isFloor && !constituents.length) {
    return refuse(id, `order ${order} is above the battery floor and must name its constituents (axiom 1)`);
  }
  if (!String(item.organizes ?? "").trim()) {
    return refuse(id, "an item must state the coordination it performs over its constituents (axiom 2)");
  }
  for (const arm of ARMS) {
    if (typeof item.arms?.[arm] !== "function") return refuse(id, `missing the ${arm} arm`);
  }

  return Object.freeze({
    ok: true,
    item: Object.freeze({
      id,
      order,
      organ: String(item.organ),
      assembly: String(item.assembly),
      stages: Object.freeze([...item.stages].map(String)),
      name: String(item.name ?? id),
      organizes: String(item.organizes),
      definedInTermsOf: constituents,
      task: item.task,
      arms: Object.freeze({ ...item.arms }),
    }),
  });

  function refuse(itemId, detail) {
    return Object.freeze({ ok: false, refusal: Object.freeze({ gap: "malformed_item", id: itemId, detail }) });
  }
}

/** Axiom 1, battery-wide: every constituent an item names must resolve to a
 * real item exactly ONE order below it. "Exactly one" is Commons's own
 * wording ("the next lower order") and is enforced rather than softened to
 * "some lower order" — a task defined over constituents two orders down has
 * skipped a level, and the MHC's orders do not skip. */
export function checkAxiom1(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const findings = [];
  for (const item of items) {
    if (item.order === SYMBOLIC_FLOOR) continue;
    for (const cid of item.definedInTermsOf) {
      const c = byId.get(cid);
      if (!c) {
        findings.push({ id: item.id, constituent: cid, reason: ITEM_REFUSALS.CONSTITUENT_MISSING, detail: `no item "${cid}" in this battery` });
      } else if (c.order !== item.order - 1) {
        findings.push({
          id: item.id,
          constituent: cid,
          reason: ITEM_REFUSALS.CONSTITUENT_MISSING,
          detail: `"${cid}" is at order ${c.order}; axiom 1 requires the next lower order (${item.order - 1})`,
        });
      }
    }
  }
  return Object.freeze({ held: findings.length === 0, findings: Object.freeze(findings) });
}

const asOutcome = (v) => {
  if (v && typeof v === "object") {
    return {
      completed: v.completed === true,
      detail: v.detail ?? null,
      unreachable: v.unreachable === true,
      // READING-POLICY A10's standing rule, carried onto every arm: an arm is
      // a null, and "a statistic insensitive to its perturbation fails
      // invisibly and globally." An arm must therefore SHOW that what it
      // perturbed actually reached the task's input. `perturbed: false` is a
      // typed refusal of the arm itself, never a quiet pass.
      perturbed: v.perturbed !== false,
      // SEED's plural-grounds requirement, via A9 ("one null is not a null"):
      // an arm may run at several declared seeds and report how many of them
      // accomplished the task, natural-frequency, rather than one draw.
      draws: Number.isFinite(v.draws) ? v.draws : 1,
      fired: Number.isFinite(v.fired) ? v.fired : v.completed === true ? 1 : 0,
    };
  }
  return { completed: v === true, detail: null, unreachable: false, perturbed: true, draws: 1, fired: v === true ? 1 : 0 };
};

/** Run one item: the three arms first, the task only if they hold.
 *
 * ORDER MATTERS AND IS DELIBERATE. The arms decide whether there is a genuine
 * order-N task here at all; the task decides whether the system performs it.
 * Running the task first and the arms after would invite reporting a pass
 * whose item later turned out mis-declared — which is precisely the
 * confounding of stimulus and response the MHC was built to end. */
export async function runItem(item, ctx = {}) {
  const base = { id: item.id, order: item.order, organ: item.organ, assembly: item.assembly, stages: item.stages, name: item.name };

  const armResults = {};
  for (const arm of ARMS) {
    let outcome;
    try {
      outcome = asOutcome(await item.arms[arm](ctx));
    } catch (err) {
      outcome = { completed: false, detail: `arm threw: ${err?.message ?? err}`, unreachable: true, perturbed: true, draws: 1, fired: 0 };
    }
    armResults[arm] = outcome;
    if (outcome.unreachable) {
      return Object.freeze({
        ...base,
        status: "unmeasured",
        reason: ITEM_REFUSALS.ORGAN_UNREACHABLE,
        detail: `${arm} arm could not run: ${outcome.detail ?? "organ unreachable"}`,
        arms: Object.freeze(armResults),
      });
    }
    // An arm that DID run but whose perturbation never reached the task
    // decides nothing — neither for the axiom nor against it. Typed and
    // stopped here, because reading its `completed: false` as "axiom 3 held"
    // is precisely the invisible global failure A10 names. Checked after the
    // throw above: "could not run" and "ran and tested nothing" are different
    // facts and the stronger one is reported.
    if (!outcome.perturbed) {
      return Object.freeze({
        ...base,
        status: "unmeasured",
        reason: ITEM_REFUSALS.UNLICENSED_PERTURBATION,
        detail: `the ${arm} arm's perturbation did not reach what the task reads (${outcome.detail ?? "no detail given"}), so it tested nothing. READING-POLICY A10: a statistic insensitive to its perturbation fails invisibly and globally. UNMEASURED, not passed.`,
        arms: Object.freeze(armResults),
      });
    }
  }

  // Every arm is a NEGATIVE control: each one must NOT accomplish the task.
  const failed = [];
  if (armResults.lowerOrder.completed) failed.push({ arm: "lowerOrder", reason: ITEM_REFUSALS.LOWER_ORDER_SUFFICES, axiom: 3 });
  if (armResults.arbitrary.completed) failed.push({ arm: "arbitrary", reason: ITEM_REFUSALS.ARBITRARY_COORDINATION, axiom: 3 });
  if (armResults.discrimination.completed) failed.push({ arm: "discrimination", reason: ITEM_REFUSALS.INDISCRIMINATE, axiom: null });

  if (failed.length) {
    return Object.freeze({
      ...base,
      status: "refused",
      reason: failed[0].reason,
      failedArms: Object.freeze(failed),
      detail: detailFor(failed[0]),
      arms: Object.freeze(armResults),
    });
  }

  let outcome;
  try {
    outcome = asOutcome(await item.task(ctx));
  } catch (err) {
    return Object.freeze({
      ...base,
      status: "unmeasured",
      reason: ITEM_REFUSALS.ORGAN_UNREACHABLE,
      detail: `task threw: ${err?.message ?? err}`,
      arms: Object.freeze(armResults),
    });
  }
  if (outcome.unreachable) {
    return Object.freeze({
      ...base,
      status: "unmeasured",
      reason: ITEM_REFUSALS.ORGAN_UNREACHABLE,
      detail: outcome.detail,
      arms: Object.freeze(armResults),
    });
  }

  // QUANTAL: completed or not. There is no partial credit anywhere in the
  // MHC and there is none here — an item's task returns one boolean about
  // whether the whole task was accomplished, and an item wanting several
  // probes conjoins them itself before returning.
  return Object.freeze({
    ...base,
    status: outcome.completed ? "passed" : "failed",
    detail: outcome.detail,
    arms: Object.freeze(armResults),
  });
}

function detailFor({ arm, reason, axiom }) {
  if (reason === ITEM_REFUSALS.LOWER_ORDER_SUFFICES) {
    return "axiom 3: the constituents alone accomplished this task, so the higher-order coordination produced no outcome they could not reach. The item is not at the order it declares — the system is UNMEASURED here, not failing.";
  }
  if (reason === ITEM_REFUSALS.ARBITRARY_COORDINATION) {
    return "axiom 3: the same constituents re-coordinated arbitrarily still accomplished the task, so the organization is arbitrary. Commons is explicit that arbitrary chaining of lower-order actions does not constitute a higher order. The system is UNMEASURED here, not failing.";
  }
  return "this battery's own control (not Commons's): the task also succeeded on material that does not support it, so it discriminates nothing. UNMEASURED, not failing.";
}

/** Run a battery. Axiom 1 is checked once, battery-wide, before anything
 * runs — an item whose constituents do not resolve is refused without being
 * executed, because executing it could only produce a number nobody may
 * read. */
export async function runBattery(declared, ctx = {}, declaration = {}) {
  const malformed = [];
  const items = [];
  for (const raw of declared) {
    const d = declareItem(raw);
    if (d.ok) items.push(d.item);
    else malformed.push(d.refusal);
  }

  const axiom1 = checkAxiom1(items);
  const blocked = new Map();
  for (const f of axiom1.findings) if (!blocked.has(f.id)) blocked.set(f.id, f);

  const results = [];
  for (const item of items) {
    if (blocked.has(item.id)) {
      const f = blocked.get(item.id);
      results.push(
        Object.freeze({
          id: item.id,
          order: item.order,
          organ: item.organ,
          assembly: item.assembly,
          stages: item.stages,
          name: item.name,
          status: "refused",
          reason: f.reason,
          detail: `axiom 1: ${f.detail}. The system is UNMEASURED here, not failing.`,
        }),
      );
      continue;
    }
    results.push(await runItem(item, ctx));
  }

  // READING-POLICY P3: "state which priors were injected in every reported
  // run. A result produced with an empty coref prior is a result about an
  // unprimed reader." So the prior list is not defaulted to empty and quietly
  // omitted — an undeclared list is a typed gap on the report's face, and a
  // DECLARED empty list is a different, legitimate statement about which
  // reader was measured.
  const priors = Array.isArray(declaration.priors)
    ? Object.freeze({ declared: true, injected: Object.freeze([...declaration.priors].map(String)) })
    : Object.freeze({
        declared: false,
        gap: "priors_undeclared",
        detail:
          "READING-POLICY P3 requires every reported run to state which priors were injected. This run did not, so nothing here says which reader was measured.",
      });

  return Object.freeze({
    giver: GIVER,
    floor: Object.freeze({ order: SYMBOLIC_FLOOR, ...FLOOR_REASON }),
    // P0: the assembly is named on the report, not inferred from the items.
    assembly: String(declaration.assembly ?? "").trim() || Object.freeze({ gap: "assembly_unnamed", detail: "READING-POLICY P0: a claim about what this system can do must name the assembly it was measured on." }),
    priors,
    material: declaration.material == null ? null : String(declaration.material),
    axiom1,
    malformed: Object.freeze(malformed),
    items: Object.freeze(results),
    orders: byOrder(results),
  });
}

/** One verdict per order, from its items. An order is `passed` only if every
 * item at it passed — quantal, and conjunctive for the same reason: a task
 * with several parts is one task. */
function byOrder(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.order)) map.set(r.order, []);
    map.get(r.order).push(r);
  }
  const out = [];
  for (const order of [...map.keys()].sort((a, b) => a - b)) {
    const rows = map.get(order);
    const failed = rows.filter((r) => r.status === "failed");
    // REFUSED and UNMEASURED are collapsed into one order-level `status`
    // because for reading a stage they are the same fact (nothing was
    // measured here). They are NOT the same fact for content-independence —
    // a mis-declared item is a defect in the battery, an absent probe is a
    // fact about the material — so both counts are carried apart alongside it.
    // Reading only the collapsed status is how an earlier `contentIndependence`
    // failed to see a real violation at all.
    const refused = rows.filter((r) => r.status === "refused");
    const unmeasured = rows.filter((r) => r.status === "unmeasured");
    let status = "passed";
    if (failed.length) status = "failed";
    else if (refused.length || unmeasured.length) status = "unmeasured";
    out.push(
      Object.freeze({
        order,
        name: orderOf(order)?.name ?? null,
        status,
        items: Object.freeze(rows),
        // A failure and a gap at the same order are DIFFERENT facts and both
        // are carried: an order can be genuinely failed AND partly unmeasured,
        // and collapsing that to one word would hide half of it.
        failedCount: failed.length,
        refusedCount: refused.length,
        unmeasuredCount: unmeasured.length,
      }),
    );
  }
  return Object.freeze(out);
}

/** Stage, the MHC's own definition: the highest order whose task the system
 * actually completes — with this module's one added refusal.
 *
 * THE ADDED REFUSAL, AND WHY. Commons's stages do not skip: the orders are
 * quantal, empirically gap-separated, and each is defined in terms of the one
 * below. So a pass at order 12 sitting above an UNMEASURED order 11 does not
 * license "stage 12" — nobody has established that the order-11 task can be
 * done, and the order-12 item is by axiom 1 defined in terms of it. This
 * function therefore walks up from the floor and STOPS at the first order that
 * is not `passed`, reporting a stage only for the contiguous run. Passes above
 * that point are real observations and are carried as `isolated`, explicitly
 * NOT folded into the number — the same posture this repo's every other
 * verdict holds, where "I could not compare this" never becomes "I compared it
 * and it holds." */
export function stageFrom(report) {
  const orders = report?.orders ?? [];
  const seen = new Map(orders.map((o) => [o.order, o]));
  let stage = null;
  let cappedBy = null;

  for (let n = SYMBOLIC_FLOOR; n <= 16; n += 1) {
    const row = seen.get(n);
    if (!row) {
      cappedBy = { order: n, status: "no_item_declared", detail: `the battery declares no item at order ${n}` };
      break;
    }
    if (row.status === "passed") {
      stage = n;
      continue;
    }
    cappedBy = {
      order: n,
      status: row.status,
      detail:
        row.status === "failed"
          ? `order ${n} (${row.name}) was measured and the system did not complete it — a real ceiling`
          : `order ${n} (${row.name}) is UNMEASURED (${row.items.filter((i) => i.status !== "passed").map((i) => i.reason).filter(Boolean).join(", ") || "no reason given"}) — no stage may be read across it`,
    };
    break;
  }

  const isolated = orders
    .filter((o) => cappedBy && o.order > cappedBy.order && o.status === "passed")
    .map((o) => Object.freeze({ order: o.order, name: o.name }));

  return Object.freeze({
    stage,
    stageName: stage == null ? null : orderOf(stage)?.name ?? null,
    cappedBy: cappedBy ? Object.freeze(cappedBy) : null,
    // A ceiling that was MEASURED and one that was merely not reached are
    // different claims about the system and are never merged.
    ceilingIsReal: cappedBy?.status === "failed",
    isolated: Object.freeze(isolated),
  });
}

/** CONTENT-INDEPENDENCE — and the distinction an earlier version of this
 * function got wrong, which is worth stating because the wrong version is the
 * intuitive one.
 *
 * The MHC's claim is about the SCALE: a task's ORDER is a property of its
 * subtask structure, determinable analytically, and does not depend on what
 * the task is about. It is emphatically NOT a claim that a performer succeeds
 * equally across domains — the whole point of separating task from performance
 * is that one performer meets an order-11 task in one domain and fails the
 * same order in another. That is ordinary, and it is what a stage measurement
 * is FOR.
 *
 * The first version here compared raw per-order verdicts across materials and
 * reported every difference under one heading — "these items are reading
 * content, not structure." For a passed-here/failed-there difference that is
 * simply false: both runs measured a well-formed order-N task and the system
 * completed one and not the other. Three outcomes are therefore kept apart:
 *
 *   violation      — an item that is a VALID order-N task on one material and
 *                    MIS-DECLARED (its axiom arms failed) on another. This is
 *                    the real thing: the item's order-hood depends on content,
 *                    which the scale forbids.
 *   performance    — valid everywhere, completed in one material and not
 *                    another. Ordinary, reported, never counted as a failure
 *                    of the scale.
 *   noProbe        — the material offers no specimen for the item at all.
 *                    A fact about the material, not about either the item or
 *                    the system.
 */
export function contentIndependence(reports) {
  const runs = (reports ?? []).filter(Boolean);
  if (runs.length < 2) {
    return Object.freeze({
      gap: "not_examined",
      detail: "content-independence needs at least two materials of different content; fewer were supplied.",
      runs: runs.length,
    });
  }

  // A valid order-N task is one whose axioms held and whose arms were
  // licensed — which is exactly the set of items that reached a performance
  // verdict at all.
  const validityOf = (row) => {
    if (!row) return "no-probe";
    if (row.refusedCount > 0) return "mis-declared";
    if (row.status === "passed" || row.status === "failed") return "valid";
    return "no-probe";
  };

  const orders = new Set();
  for (const r of runs) for (const o of r.report.orders) orders.add(o.order);

  const violations = [];
  const performance = [];
  const noProbe = [];
  const agreed = [];

  for (const order of [...orders].sort((a, b) => a - b)) {
    const cells = runs.map((r) => {
      const row = r.report.orders.find((o) => o.order === order);
      const status = row?.status ?? "no_item_declared";
      return { material: r.material, status, validity: validityOf(row) };
    });
    const validities = new Set(cells.map((c) => c.validity));
    const statuses = new Set(cells.map((c) => c.status));

    if (validities.has("valid") && validities.has("mis-declared")) {
      violations.push(Object.freeze({ order, cells: Object.freeze(cells) }));
    } else if (validities.has("no-probe")) {
      noProbe.push(Object.freeze({ order, cells: Object.freeze(cells) }));
    } else if (statuses.size > 1) {
      performance.push(Object.freeze({ order, cells: Object.freeze(cells) }));
    } else {
      agreed.push(Object.freeze({ order, status: cells[0].status }));
    }
  }

  return Object.freeze({
    examined: true,
    materials: Object.freeze(runs.map((r) => r.material)),
    // `held` is the SCALE's claim and nothing else: no item changed its
    // order-hood with the content.
    held: violations.length === 0,
    violations: Object.freeze(violations),
    performance: Object.freeze(performance),
    noProbe: Object.freeze(noProbe),
    agreed: Object.freeze(agreed),
  });
}
