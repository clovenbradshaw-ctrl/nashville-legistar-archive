/* Liu Hui speaks:
 * “doubling and doubling the number of sides, and if we proceed 
until we can no more continue the process of doubling, the perimeter 
ultimately comes to coincide with the circumference of the circle, so 
that by taking its area for that of the circle, no portion however 
small will go neglected. Therefore multiplying with half circumference 
to half diameter, we get the circular area.””
 *
 * This file implements the derivation of the geometric circle, following Liu Hui's methodology.  It embodies a rigorous, step-by-step approach to deduction, ensuring each step is demonstrably justified by prior knowledge.  My teaching prioritizes the clarity and precision of the derivation process, advocating for the avoidance of arbitrary shortcuts or unproven assertions.
 *
 * — the engineering record below, kept whole —
 */
// derivation.js — floor 6: a corroborated note as a PREMISE.
// Handle: Liu Hui — after the mathematician who proved each step from results already established; what isn't derived from a premise doesn't count. Amendment XVII.
//
// THE LADDER, so this floor is placed rather than asserted. F0 units → F1
// referents → F2 arrangements → F3 claims → F4½ nesting → F5 corroborated
// notes (assertions that became variables over their own restatements).
// Every floor promotes the previous floor's FINDING into an OPERAND. Floor
// 6 operates on F5's finding: a note that survived corroboration is now a
// premise, and licensed composition derives from premises facts the
// material never stated — with provenance to the premises and, through
// them, to bytes.
//
// WHAT ALREADY EXISTED, AND WHAT DID NOT. The circuit is the kernel's
// (`kernel/reaction.js` — the physics and chemistry of the cube, measured
// as a FILTER, NOT A GENERATOR: every product it reaches an unlicensed join
// also reaches; its whole value is provenance, a refusal surface, and a
// giver's name on every licence). It ran only inside eval drivers
// (`eval/the-fold/full-circuit.mjs`, P60's oracle runs), over edges the
// driver assembled by hand, and its products were printed and discarded.
// This organ is the missing floor: it reads premises OFF THE LEDGER, lands
// products BACK ON THE LEDGER, and holds the wall that makes a derived note
// safe to keep beside a heard one.
//
// THE WALL — nesting's wall, one register up. Witnesses of an outer note
// never corroborate the inner claim (nesting.js); here, PREMISES' WITNESSES
// NEVER CORROBORATE THE PRODUCT, and the product never corroborates a
// premise. Concretely:
//   * a derived note lands with `witnesses: []` and `spans: []`. It was
//     stated nowhere. What carries it is `premises` (its direct parents)
//     and `provenance` (the byte addresses the walk reaches). It can never
//     read "corroborated" to any consumer that counts witnesses — the
//     >=2-sources gate excludes it BY CONSTRUCTION, not by a check.
//   * landing a product appends nothing to any premise: the leak assay is
//     that every premise's witness set is byte-identical before and after.
//   * `foldHyperlexicon` never projects a derived note (hyperlexicon.js);
//     `foldDerived` is their projection. F5 consumers see only what was
//     heard.
//   * conceding a premise (hyperlexicon.js::concede, REC·Figure) withdraws
//     every product resting on it, TRANSITIVELY, on the same act
//     (`withdrawDerived`, REC·Pattern per product, each naming what it
//     cascaded from) — reaction.js's own `withdraw` rule, landed on the
//     ledger. History stays whole; nothing is deleted.
//
// THE FLOOR IS DECLARED. Which notes count as premises — how many distinct
// sources, how many distinct instruments — is the caller's number (P4/P9),
// never a default here. `distinctSources`/`distinctRecipes` are the
// corroboration walk's own counters, reused.
//
// ── TWO REGIMES, ONE LEDGER: what `carry` separates ────────────────────
//
// The floor conflated two different epistemic jobs behind one number, and
// the conflation is why this floor has stood empty.
//
// BASE TESTIMONY — what a source says happened — is token-level evidentiary
// reasoning, the domain courts and historians already work in and the
// domain Bayesian evidence was built for. Its correct form is not a COUNT
// of witnesses but a SUM of their calibrated log-odds, and a witness at
// LR = 1 contributes exactly zero however many of it you collect. That is
// the mathematical statement of what was measured by hand on 2026-09-03
// (25 real / 25 fabricated, 2 states in each arm, LR = 1.0), and it is why
// this file does NOT ship a log-odds gate: the one calibration this engine
// has says the available witness carries no information, and inventing
// likelihood ratios to sum would be worse than admitting that (II.10 — an
// uncalibrated ratio is a change of units that fails invisibly). What the
// count still legitimately is, is a LABEL.
//
// DERIVED STRUCTURE — what this floor builds on top of those claims — is
// synthesised, generalising and theory-shaped, and that is Popper's
// register, not Bayes'. Nothing here is ever "confirmed". A product earns
// its place by being REFUTABLE and by having somewhere to land when it
// falls, never by its premises having accumulated corroboration. So the
// permission to build is the falling machinery being wired: `exposure`
// says what rests on a premise before anything is decided, `dispute`
// (kernel) gives a challenge somewhere to land, and `concedePremise`
// takes the tower down transitively with every withdrawal named.
//
// `carry: true` is that separation, made operational: below-floor notes
// are ADMITTED as premises and reported in `carried` with their level, so
// a caller builds on n=1 and knows exactly where it is thin — rather than
// `stopped`, which refuses to build at all and has, measured, left this
// floor empty rather than sparse. A count that gates is corroboration
// buying permission; a count that rides is corroboration doing its actual
// job. `carry: false` keeps the old gate for callers that want it, and
// neither is a default — the caller declares which regime it is in.
//
// THE LICENCE COMES FROM THE REGISTER, NEVER FROM THIS FILE. Chemistry is
// projected from `interpretation/declarations.js`'s GIVEN tier alone
// (`affordancesFromDeclarations`) so every affordance can be CONCEDED; a
// candidate yields nothing (the grain theorem: a corpus can refute a
// Pattern-grain claim and never earn one). With no giver, derivation is a
// measured zero — that is the control, and it is exercised, not assumed.
//
// THE VETO RUNS BEFORE THE LICENCE. `auditChemistry` scans the premises
// for what positively refutes a given affordance (cycles; uniqueness
// violations where adjacency is claimed) and `vetoedPairs` stops those
// pairs from firing — reported apart from `withheld` (nobody vouched)
// because the two need different remedies.
//
// TWO CONTROLS SHIP WITH THE ORGAN (II.23: a statistic earns its use by a
// control built to fail): `naiveJoin` is the unlicensed transitive closure
// the derived set must stay a SUBSET of (reaction.js's own standing
// regression, restated at this floor), and `redeal` permutes premises'
// objects within a relation so a caller can show the derived set MOVES
// when its premises move.
//
// TYPED BY THE ACT. A derived note is SYN · Pattern · derived — Composing,
// on the Network terrain: a whole compiled from parts under a licence.
// `operator_basis: derived` is task-log's own word for it. The cell is read
// off the injected `cellOf`, never restated.
import { hyperedge } from "../kernel/hypergraph.js";
import { createHyperlexicon as createChemistry, giveHyperlexiconAffordance } from "../kernel/hyperlexicon.js";
import { createReactionSubstrate, affordancesFromDeclarations } from "../kernel/reaction.js";
import { auditChemistry, vetoedPairs } from "../kernel/refutation.js";
import { dependentsIndex, cascade } from "../kernel/cascade.js";
import { foldDeclarations } from "../interpretation/declarations.js";
import { distinctSources, distinctRecipes } from "./corroboration.js";

export const DERIVED_PREFIX = "derived:";
export const isDerivedId = (id) => typeof id === "string" && id.startsWith(DERIVED_PREFIX);

export const REFUSALS = Object.freeze({
  no_floor: "the standing floor is declared — {sources, instruments}: sources a positive integer, instruments a non-negative integer (0 = instrument independence not required, said so) (P4/P9)",
  no_carry: "`carry` is a declared boolean — whether below-floor premises are ADMITTED with their fragility carried (true) or REFUSED (false). Never inferred from the floor",
  no_declarations: "chemistry comes from the declarations register, so a derivation names the register it reads",
  no_steps: "maxSteps is a declared positive integer — how long a settling may run is the caller's to say",
  no_trigger: "a withdrawal records its own reason as `trigger` — never a silent concession",
  no_presence: "a cue lights the present, and the presence floor (how faint still counts) is declared beside it — cue: null is the disclosed ungated control",
});

const asSet = (xs) => new Set(xs ?? []);
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * premisesOf(notes, { floor }) — which F5 notes stand as premises. A note
 * below the floor is STOPPED, typed with the counts it actually had, never
 * silently dropped: a caller can see exactly what the floor excluded.
 */
export function premisesOf(notes, { floor, carry = false } = {}) {
  // `instruments: 0` is a DECLARATION, not a default: the caller says
  // instrument independence is not required. Measured live (2026-09-02):
  // a witness admitted by a chat turn is a bare source ref with no
  // `~recipe`, so distinctRecipes reads 0 for every live note and a floor
  // of 1 instrument could never be met — the honest floor for such a
  // ledger is declared 0, and the report still carries the count.
  if (!floor || !Number.isInteger(floor.sources) || floor.sources < 1 || !Number.isInteger(floor.instruments) || floor.instruments < 0)
    throw new TypeError("premisesOf: " + REFUSALS.no_floor);
  if (typeof carry !== "boolean") throw new TypeError("premisesOf: " + REFUSALS.no_carry);
  const premises = [], stopped = [], contested = [], carried = [];
  for (const n of notes ?? []) {
    const sources = distinctSources(n.witnesses).size;
    const instruments = distinctRecipes(n.witnesses).size;
    const level = { sources, instruments, contested: n.disputedBy?.length ?? 0 };
    const meets = sources >= floor.sources && instruments >= floor.instruments;
    if (meets || carry) {
      premises.push(carry ? { ...n, level } : n);
      if (!meets) carried.push({ id: n.id, subject: n.subject, verb: n.verb, object: n.object, ...level, floor: { ...floor } });
      // A LIVE DISPUTE DOES NOT BLOCK A PREMISE, AND MUST NOT. At n=2 a
      // disagreement is visible but not adjudicable, so refusing the
      // premise would convict on evidence that cannot convict — and the
      // whole point of the falling machinery is that you may build on a
      // contested base PROVIDED the structure carries what would fall.
      // Reported, never withheld: a caller reads `contested` and knows
      // exactly which part of its tower has a live challenge underneath.
      if (n.disputedBy?.length) contested.push({ id: n.id, subject: n.subject, verb: n.verb, object: n.object, disputedBy: [...n.disputedBy] });
    } else stopped.push({ id: n.id, subject: n.subject, verb: n.verb, object: n.object, sources, instruments, floor: { ...floor } });
  }
  return { premises, stopped, contested, carried };
}

/** Chemistry from the register's GIVEN tier — and nothing else. */
export function chemistryFor(declarations) {
  const fold = foldDeclarations(declarations);
  let chem = createChemistry();
  for (const row of affordancesFromDeclarations(fold)) chem = giveHyperlexiconAffordance(chem, row);
  return { chemistry: chem, given: fold.given, candidates: fold.candidates };
}

/**
 * The ends a note IS, as opposed to the words it was first heard in. The
 * ledger keys identity on earned referent faces (hear() folds
 * end1Face/end2Face — or an injected noteIdentity — into the id) while the
 * display keeps the first reading's own bytes. Measured live (2026-09-02):
 * "Andrew Johnson —replaced→ Hannibal Hamlin in March 1865" and "Hannibal
 * Hamlin —replaced→ John Breckinridge…" never bridged when the substrate
 * bonded on display strings, because the object's adjunct debris is not
 * the next subject's face. Bonding on the id's ends is bonding on the
 * identity the ledger already earned — P73's seam, consumed, not a second
 * identity invented here. Where no face was earned the id holds the
 * lowercased surface, so nothing is folded that the ledger did not fold.
 */
export function identityEnds(note) {
  const id = String(note?.id ?? "");
  const first = id.indexOf("|"), last = id.lastIndexOf("|");
  if (first < 0 || last <= first) return { end1: String(note.subject ?? ""), end2: String(note.object ?? "") };
  return { end1: id.slice(0, first), end2: id.slice(last + 1) };
}

/** Premises as substrate edges: bonded on identity ends, each carrying its
 * note id, its display words, and its addresses. */
export function substrateEdges(premises) {
  return premises.map((n) => {
    const { end1, end2 } = identityEnds(n);
    return hyperedge({
      id: `note:${n.id}`,
      relation: n.verb,
      participants: [
        { ref: end1, standing: "referent", identity: "ledger", display: n.subject, role: null },
        { ref: end2, standing: "referent", identity: "ledger", display: n.object, role: null },
      ],
      witness: n.spans?.[0]?.at ?? `note:${n.id}`,
      meta: { noteId: n.id, witnesses: [...(n.witnesses ?? [])], spans: (n.spans ?? []).map((s) => s.at) },
    });
  });
}

/** identity end → the display words the premises used for it (first seen
 * wins, the ledger's own rule), so a product is worded in the material's
 * words rather than in lowercased ids. */
export function displayMap(premises) {
  // The display of an identity end is its FACE's own words where a premise
  // states them exactly, else the shortest display seen — never the first
  // seen, which live (2026-09-02) handed a product a debris reading
  // ("Andrew Johnson in 1869 after …") when a clean one was on the ledger.
  const m = new Map();
  const offer = (id, display) => {
    const d = String(display ?? id);
    const cur = m.get(id);
    if (d.toLowerCase() === id) { m.set(id, d); return; }
    if (cur && cur.toLowerCase() === id) return;
    if (!cur || d.length < cur.length) m.set(id, d);
  };
  for (const n of premises) {
    const { end1, end2 } = identityEnds(n);
    offer(end1, n.subject);
    offer(end2, n.object);
  }
  return m;
}

/**
 * naiveJoin(premises, { base, yields }) — THE UNLICENSED CONTROL. A plain
 * transitive closure over `base` edges, reported as `yields`. It has no
 * provenance, no veto, no giver, and it is the set the licensed derivation
 * must remain a subset of. If the licensed set ever reaches a fact this
 * cannot, the circuit is claiming a power it does not have.
 */
export function naiveJoin(premises, { base, yields } = {}) {
  const forward = new Map();
  for (const n of premises ?? []) {
    if (n.verb !== base) continue;
    const { end1, end2 } = identityEnds(n);
    if (!forward.has(end1)) forward.set(end1, new Set());
    forward.get(end1).add(end2);
  }
  const out = new Set();
  for (const start of forward.keys()) {
    const seen = new Set([start]);
    let frontier = [...(forward.get(start) ?? [])];
    while (frontier.length) {
      const next = [];
      for (const x of frontier) {
        if (seen.has(x)) continue;
        seen.add(x);
        out.add(`${start}|${yields}|${x}`);
        for (const y of forward.get(x) ?? []) next.push(y);
      }
      frontier = next;
    }
  }
  return out;
}

/**
 * redeal(notes, { seed }) — THE PERTURBATION CONTROL. Each relation's
 * objects are permuted among its own notes (marginals kept, the
 * arrangement destroyed), seeded so a run is reproducible. A derivation
 * insensitive to this has read nothing from its premises.
 */
export function redeal(notes, { seed } = {}) {
  if (!Number.isInteger(seed)) throw new TypeError("redeal: seed is declared");
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const byVerb = new Map();
  for (const n of notes ?? []) { if (!byVerb.has(n.verb)) byVerb.set(n.verb, []); byVerb.get(n.verb).push(n); }
  const out = [];
  for (const group of byVerb.values()) {
    const objects = group.map((n) => n.object);
    for (let i = objects.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [objects[i], objects[j]] = [objects[j], objects[i]]; }
    group.forEach((n, i) => out.push({ ...n, object: objects[i], id: `${n.subject}|${n.verb}|${objects[i]}`.toLowerCase() }));
  }
  return out;
}

/**
 * makeDerivation({ hl, taskLog }) — the floor, bound to one ledger bundle.
 *   hl       a makeHyperlexicon bundle (foldHyperlexicon, concede, assertionId)
 *   taskLog  { append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS, GRAIN_RANK, cellOf? }
 */
export function makeDerivation({ hl, taskLog } = {}) {
  if (!hl || !taskLog) throw new TypeError("makeDerivation: the hyperlexicon bundle and the task-log bundle are injected");
  const { append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS, GRAIN_RANK, cellOf = null } = taskLog;
  const grainAt = (rank) => Object.keys(GRAIN_RANK).find((g) => GRAIN_RANK[g] === rank);
  const PATTERN = grainAt(2);
  const cellFields = (op, grain) => {
    if (!cellOf) return {};
    const c = cellOf(op, grain);
    if (!c || c.gap) return { cell_gap: c?.gap ?? "no_cell", cell_reason: c?.reason ?? null };
    return { cell: `${c.op}·${c.grain}`, stance: c.stance, terrain: c.terrain, mode: c.mode, domain: c.domain };
  };
  const derivedId = (from, yields, to) => DERIVED_PREFIX + hl.assertionId(from, yields, to);

  /** Live derived notes: on the log, not withdrawn; `stated` says whether the
   * same triple has since been HEARD (a derivation the material caught up to). */
  function foldDerived(log) {
    const gone = hl.concededIds(log);
    const tasks = projectTasks(log);
    // Stored notes carry the NEUTRAL ends (kernel/notes.js: end1/label/end2);
    // this organ's own derived entries still write subject/verb/object. Read
    // either, so a heard note and a derived one meet on one identity.
    const endsOf = (t) => ({ subject: t.subject ?? t.end1, verb: t.verb ?? t.label, object: t.object ?? t.end2 });
    const heard = new Set(tasks.filter((t) => { const e = endsOf(t); return e.subject && e.verb && e.object && !t.derived && !gone.has(t.task_id); }).map((t) => t.task_id));
    return tasks
      .filter((t) => t.derived === true && !gone.has(t.task_id))
      .map((t) => ({
        id: t.task_id, ...endsOf(t),
        premises: [...(t.premises ?? [])], grounds: [...(t.grounds ?? [])], provenance: [...(t.provenance ?? [])],
        depth: t.depth, paths: t.paths, giver: t.giver ?? null, affordance: t.affordance ?? null,
        // P89: every product RECORDS restsOn (the min across its transitive
        // grounds). The fold projected everything but that field, so a reader
        // of the fold saw a derived fact with no fragility — found by the
        // product assay's derivation wall (the-fold P97), not by review.
        restsOn: t.restsOn ?? null,
        witnesses: [], spans: [],
        stated: heard.has(hl.assertionId(endsOf(t).subject, endsOf(t).verb, endsOf(t).object)),
      }))
      .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  }

  /** What has been withdrawn, each with its trigger and what it cascaded from. */
  function withdrawnDerived(log) {
    const tasks = new Map(projectTasks(log).map((t) => [t.task_id, t]));
    return (log?.entries ?? [])
      .filter((e) => e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && isDerivedId(e.concedes ?? ""))
      .map((e) => { const t = tasks.get(e.concedes); return { id: e.concedes, subject: t?.subject ?? t?.end1 ?? null, verb: t?.verb ?? t?.label ?? null, object: t?.object ?? t?.end2 ?? null, trigger: e.trigger, cascadedFrom: e.cascadedFrom ?? null, cascadeDepth: e.cascadeDepth ?? 0, at: e.seq }; });
  }

  /**
   * derive(log, { declarations, floor, maxSteps, cue, presenceFloor, cycleLimit })
   * → { log, derived, premises, stopped, licences, withheld, vetoed, audit, quiescent }
   *
   * `cue: null` (default) is the disclosed full-closure control arm —
   * every chain in contact; a real cue with a `presenceFloor` lets the
   * reader's present gate the reaction (reaction.js's physics).
   */
  function derive(log, { declarations, floor, carry = false, maxSteps, cue = null, presenceFloor = null, cycleLimit = 3 } = {}) {
    if (!declarations) throw new TypeError("derive: " + REFUSALS.no_declarations);
    if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new TypeError("derive: " + REFUSALS.no_steps);
    // A real cue needs its presence floor beside it. Without this check a
    // cue with no floor fell through to `floor: null` — the ungated control
    // arm — and reported itself as gated. Found by the test, not by review.
    if (cue !== null && !Number.isFinite(presenceFloor)) throw new TypeError("derive: " + REFUSALS.no_presence);
    const notes = hl.foldNotes(log);
    const { premises, stopped, contested, carried } = premisesOf(notes, { floor, carry });
    // The evidentiary LEVEL of every note, so a product can carry the level
    // of its WEAKEST ground rather than pretend its premises were equal.
    const levelById = new Map(notes.map((n) => [n.id, { sources: distinctSources(n.witnesses).size, instruments: distinctRecipes(n.witnesses).size, contested: n.disputedBy?.length ?? 0 }]));
    const { chemistry, given, candidates } = chemistryFor(declarations);
    const edges = substrateEdges(premises);
    const audit = auditChemistry(edges, chemistry, { cycleLimit });
    const substrate = createReactionSubstrate({ entries: edges, hyperlexicon: chemistry, window: null });
    const settled = substrate.settle({ cue, floor: cue === null ? null : presenceFloor, maxSteps, veto: vetoedPairs(audit) });

    const byEdge = new Map(substrate.edges().map((e) => [e.id, e]));
    const ledgerIdOf = (edgeId) => {
      const e = byEdge.get(edgeId);
      if (!e) return null;
      if (e.meta?.derived) return derivedId(e.participants[0].ref, e.relation, e.participants[e.participants.length - 1].ref);
      return e.meta?.noteId ?? null;
    };
    const walk = (edgeId, grounds, addresses, seen = new Set()) => {
      if (seen.has(edgeId)) return; seen.add(edgeId);
      const e = byEdge.get(edgeId);
      if (!e) return;
      if (!e.meta?.derived) { grounds.add(e.meta?.noteId); for (const a of e.meta?.spans ?? []) addresses.add(a); return; }
      for (const p of e.meta.parents ?? []) walk(p, grounds, addresses, seen);
    };

    const shown = displayMap(premises);
    let next = log;
    const derived = [];
    for (const f of settled.derived) {
      const id = derivedId(f.from, f.relation, f.to);
      const subject = shown.get(f.from) ?? f.from, object = shown.get(f.to) ?? f.to;
      const premiseIds = (f.edge.meta.parents ?? []).map(ledgerIdOf).filter(Boolean);
      const grounds = new Set(), addresses = new Set();
      walk(f.edge.id, grounds, addresses);
      const prior = projectTasks(next).find((t) => t.task_id === id) ?? null;
      const unchanged = prior && sameSet(asSet(prior.premises), asSet(premiseIds)) && prior.paths === f.paths;
      // THE FRAGILITY, CARRIED. A product is exactly as well-attested as its
      // WEAKEST ground — min, never mean: an average would let a strong
      // premise launder a single-source one, which is the same laundering
      // the two-witness gate was invented to stop. `contested` counts the
      // grounds carrying a live dispute; it is a label, and blocks nothing.
      const groundLevels = [...grounds].map((g) => levelById.get(g)).filter(Boolean);
      const restsOn = {
        sources: groundLevels.length ? Math.min(...groundLevels.map((l) => l.sources)) : 0,
        instruments: groundLevels.length ? Math.min(...groundLevels.map((l) => l.instruments)) : 0,
        contested: groundLevels.filter((l) => l.contested > 0).length,
        grounds: groundLevels.length,
      };
      const row = { id, subject, verb: f.relation, object, depth: f.depth, paths: f.paths, premises: premiseIds, grounds: [...grounds], provenance: [...addresses], giver: f.giver, restsOn, affordance: { left: f.edge.meta.affordance.left, right: f.edge.meta.affordance.right } };
      if (unchanged) { derived.push({ ...row, landed: "unchanged" }); continue; }
      next = append(next, {
        kind: prior ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.PROPOSE,
        task_id: id,
        operator: "SYN", operator_basis: OPERATOR_BASIS.DERIVED, grain: PATTERN,
        ...cellFields("SYN", PATTERN),
        description: `${prior ? "re-derived" : "derived"}: ${subject} ${f.relation} ${object} (depth ${f.depth}, ${f.paths} path${f.paths === 1 ? "" : "s"})`,
        subject, verb: f.relation, object,
        witnesses: [], spans: [],   // THE WALL: stated nowhere, carried by its premises
        derived: true,
        premises: premiseIds, grounds: [...grounds], provenance: [...addresses],
        depth: f.depth, paths: f.paths, giver: f.giver, restsOn, affordance: row.affordance,
      });
      derived.push({ ...row, landed: prior ? "updated" : "new" });
    }
    return {
      log: next, derived,
      premises: premises.map((n) => n.id), stopped, contested, carried,
      licences: given.map((g) => ({ kind: g.declKind, rel: g.rel, yields: g.yields ?? null, giver: g.giver })),
      candidates: candidates.map((c) => ({ kind: c.declKind, rel: c.rel })),
      withheld: [...settled.withheld], vetoed: [...settled.vetoed], audit: [...audit],
      quiescent: settled.quiescent, steps: settled.steps.length,
    };
  }

  /**
   * exposure(log, premise) — WHAT WOULD FALL, without anything falling.
   * The same transitive walk `withdrawDerived` performs, run as a query:
   * every live derived note resting on this premise, with the depth it
   * sits at. This is what lets a contested premise be CARRIED rather than
   * either trusted or refused — the disagreement is on the record, and so
   * is the size of what rests on it, before anyone decides anything.
   *
   * It is also the measurement instrument the 17%-worst-concession figure
   * came from, promoted out of an eval driver into the organ, so the same
   * number can be read off a live ledger instead of recomputed by hand.
   *
   * `known` is checked with the IDENTICAL predicate `notes.js::concede`
   * uses to refuse `unknown_note` — a bug found live (the-fold P198-class:
   * a dry run must not promise what the act refuses). Before this, a
   * bogus id silently reported "would withdraw 0" (indistinguishable from
   * a real, harmless premise) and the door's own printed next step,
   * `/concede! <id>`, then refused with `unknown_note` — a caller could
   * not tell the two cases apart without performing the act.
   */
  function exposure(log, premise) {
    if (!premise) return { premise: null, withdrawn: [], depth: 0, known: false };
    const known = projectTasks(log).some((t) => t.task_id === premise);
    if (!known) return { premise, withdrawn: [], depth: 0, known: false };
    const gone = new Set(hl.concededIds(log));
    const live = foldDerived(log).filter((d) => !gone.has(d.id));
    const byId = new Map(live.map((d) => [d.id, d]));
    // ONE inversion (premise id -> the derived notes naming it), ONE BFS —
    // kernel/cascade.js, shared with reaction.js's own withdrawal walk.
    const index = dependentsIndex(live, (d) => d.premises);
    const hits = cascade(index, [premise]);
    const taken = hits.map(({ id, cascadedFrom, cascadeDepth }) => {
      const d = byId.get(id);
      return { id, subject: d.subject, verb: d.verb, object: d.object, cascadedFrom, cascadeDepth };
    });
    const depth = taken.reduce((m, t) => Math.max(m, t.cascadeDepth), 0);
    return { premise, withdrawn: taken, depth, share: live.length ? taken.length / live.length : 0, known: true };
  }

  /**
   * withdrawDerived(log, { premise }, { trigger }) — the cascade: every
   * live derived note whose premises pass through `premise` (a note id or
   * a derived id), transitively, receives its own REC·Pattern naming the
   * id it cascaded from and its depth. Returns the log and what was taken.
   */
  function withdrawDerived(log, { premise } = {}, { trigger } = {}) {
    if (typeof trigger !== "string" || !trigger.trim()) return { log, refused: { type: "no_trigger", detail: REFUSALS.no_trigger }, withdrawn: [] };
    if (!premise) return { log, refused: { type: "no_premise", detail: "name the premise whose products are withdrawn" }, withdrawn: [] };
    // The derived-note SET is invariant across this walk: this function only
    // ever appends REC·Pattern evidence entries (never a PROPOSE/SUPERSEDE
    // for a derived note), and the REC·Figure concession `gone` reads
    // (`hl.concededIds`) is always landed BEFORE this runs — concedePremise's
    // own ordering, one act — so `live` is computed once, not re-folded from
    // the whole task log on every BFS round the way it used to be.
    const gone = new Set(hl.concededIds(log));
    const live = foldDerived(log).filter((d) => !gone.has(d.id));
    const byId = new Map(live.map((d) => [d.id, d]));
    const index = dependentsIndex(live, (d) => d.premises);
    const hits = cascade(index, [premise]);

    let next = log;
    const taken = [];
    for (const { id, cascadedFrom, cascadeDepth } of hits) {
      const d = byId.get(id);
      const recId = `rec:${next.nextSeq}`;
      next = append(next, {
        kind: ENTRY_KINDS.EVIDENCE, task_id: recId, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: PATTERN,
        ...cellFields("REC", PATTERN),
        description: `withdrawn: ${d.subject} ${d.verb} ${d.object} — ${trigger}`,
        concedes: d.id, trigger, cascadedFrom, cascadeDepth,
      });
      taken.push({ id: d.id, subject: d.subject, verb: d.verb, object: d.object, cascadedFrom, cascadeDepth });
    }
    return { log: next, refused: null, withdrawn: taken };
  }

  /**
   * concedePremise(log, noteId, { trigger }) — ONE ACT: the note is
   * conceded (REC·Figure, hyperlexicon.js) and everything resting on it is
   * withdrawn (REC·Pattern per product). A concession that did not reach
   * its products would be a version bump wearing an operator's name.
   */
  function concedePremise(log, noteId, { trigger } = {}) {
    const c = hl.concede(log, noteId, { trigger });
    if (c.refused) return { log, refused: c.refused, withdrawn: [] };
    const w = withdrawDerived(c.log, { premise: noteId }, { trigger });
    return { log: w.log, refused: null, conceded: noteId, withdrawn: w.withdrawn };
  }

  return { derive, foldDerived, exposure, withdrawDerived, withdrawnDerived, concedePremise, derivedId };
}
