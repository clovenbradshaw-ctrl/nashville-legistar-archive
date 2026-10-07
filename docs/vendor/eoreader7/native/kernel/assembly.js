// native/kernel/assembly.js — Assembly@1: the named thing measurements attach
// to, and the register that holds it (ASSEMBLIES-AND-ARTIFACTS.md §2, A2;
// READING-SPEC S25).
//
// GIVERS, named up front. The subassembly criterion is Herbert Simon's ("The
// Architecture of Complexity", 1962 — Hora and Tempus; near-decomposability
// as a claim about interaction rates). The register discipline is
// task-log.js's own (append-only; supersession keeps the past; a new version
// arrives as a new entry, never as an edit inside an old one). The contract
// derivation reads cube.js — an assembly declares which (operator, grain)
// CELLS it may emit, and ops/terrains/stances are READ OFF that declaration
// via cellOf, never restated by hand (the GRAIN_RANK rule: a fact a module
// already holds is read off, never re-derived by a second copy that can
// drift).
//
// WHAT AN ASSEMBLY IS NOT. The kernel is not an assembly (A2.4): fold.js,
// cube.js, reading.js are the substrate assemblies run on. This module is
// register MECHANICS only — the concrete starting registry (which organs make
// up which assembly) lives above the kernel, in native/assemblies.js, as
// path strings the kernel never resolves.
//
// EVERY DIAL IS A PRIOR AWAITING THE MATERIAL'S OWN MEASUREMENT (S16): a
// regime entry without { value, giver, basis } is refused — the giver field
// is mandatory, so an undeclared floor cannot ride into a contract wearing a
// default's clothes.
//
// CONTRACT ENFORCEMENT, disclosed scope: `contractViolations` is the pure
// checker for A2.3 ("an assembly emitting outside its declared ops/terrains
// is refused at applyDelta"). Wiring it INTO applyDelta is a behavioral
// change — it needs every operation to carry provenance.assembly first, and
// V7-CUT gates behavioral change on conformance — so the checker ships as a
// wall tests and drivers consult, and the applyDelta wiring is the named
// next pass, not silently implied done.
//
// CONCESSION (A5). A refuted assembly concedes WHOLESALE: one REC enumerates
// every standing contribution (`contributionsOf` — the generalization of
// reaction.js's derivedUnder from per-affordance to per-assembly), with a
// named trigger, no silent overwrite, evidence never deleted
// (declarations.js::concede's own rule, pointed at a bigger object). The REC
// lands on the fold through the EXISTING applyDelta machinery with no
// payload action — a marking read by projection (`concededAssemblies`),
// exactly as reaction.js's `withdraw` marks and never deletes. A concession
// that cannot enumerate what it re-zeroes is a version bump wearing an
// operator's name — reaction.js's own sentence, now enforced at the scale it
// was written for: conceding an assembly with zero standing contributions is
// refused.

import { GRAINS, TERRAIN_BY_DOMAIN, cellOf } from "./cube.js";
import { eoOperation } from "./fold.js";

const freeze = (value) => Object.freeze(value);
const stable = (values = []) => freeze([...new Set(Array.from(values ?? []).filter(Boolean))].sort());
const TERRAINS = freeze(Object.values(TERRAIN_BY_DOMAIN).flatMap((byGrain) => GRAINS.map((g) => byGrain[g])));
const DYNAMICS_FEEDS = freeze(["surprise", "tension", "release"]);
const CONSUME_TAGS = freeze(["prior", "witness"]);
const LAYERS = freeze(["lattice", "baseline", "projection"]);

/**
 * assembly({ id, version, layer, cells, terrains, organs, regimes, consumes,
 * produces, stagesNotRun, dynamics, note }) — one Assembly@1, validated.
 *
 *   cells      the (operator, grain) pairs this assembly may EMIT into the
 *              fold — measured off its organs' own eoOperation calls, cited
 *              in the registry, and the source contract.ops/stances are
 *              derived from. May be empty: a projection organ that emits no
 *              operations declares exactly that.
 *   terrains   where its PRODUCTS land (§2's table column) — unioned with
 *              the cell-derived terrains, because an operator's terrain is
 *              the cube's to derive and a product's terrain is the
 *              assembly's to declare.
 *   layer      "lattice" (a row of the terrain lattice — what prefix and
 *              absence reasoning ranges over), "baseline" (a whole reader
 *              kept as S1's measuring stick), or "projection" (a derived
 *              read over other assemblies' state — P-a pre-registers that
 *              such a row is expected to FAIL the severance test as an
 *              assembly boundary).
 *   consumes   Artifact kinds accepted, each tagged { kind, as } where `as`
 *              is "prior" (from any other read — nominates, never admits;
 *              A4.1) or "witness" (only lawful from the same read — §4).
 *   regimes    every declared dial: { name: { value, giver, basis } } —
 *              S16, giver mandatory.
 */
export function assembly({
  id,
  version,
  layer = "lattice",
  cells = [],
  terrains = [],
  organs,
  regimes = {},
  consumes = [],
  produces = [],
  stagesNotRun = [],
  dynamics = [],
  note = null,
} = {}) {
  if (typeof id !== "string" || !id.startsWith("assembly:") || id.length <= "assembly:".length)
    throw new TypeError("assembly: id is \"assembly:<name>\" — the namespace is what makes a stamp resolvable");
  if (!Number.isInteger(version) || version < 1)
    throw new TypeError("assembly: version is a positive integer, bumped on any organ or regime change (A2)");
  if (!LAYERS.includes(layer))
    throw new TypeError(`assembly: layer must be one of ${LAYERS.join("/")} — which reasoning ranges over this row is declared, never guessed`);
  if (!Array.isArray(organs) || organs.length === 0 || organs.some((o) => typeof o !== "string" || !o))
    throw new TypeError("assembly: organs is a non-empty list of module paths — an assembly with no implementation is a wish");
  const resolvedCells = (cells ?? []).map(([op, grain]) => {
    const cell = cellOf(op, grain);
    if (cell.gap) throw new TypeError(`assembly ${id}: invalid cell (${op}, ${grain}) — ${cell.reason}`);
    return cell;
  });
  for (const terrain of terrains ?? []) {
    if (!TERRAINS.includes(terrain)) throw new TypeError(`assembly ${id}: unknown terrain ${JSON.stringify(terrain)}`);
  }
  for (const [name, dial] of Object.entries(regimes ?? {})) {
    if (!dial || typeof dial !== "object" || dial.value === undefined || typeof dial.giver !== "string" || !dial.giver || typeof dial.basis !== "string" || !dial.basis)
      throw new TypeError(`assembly ${id}: regime ${JSON.stringify(name)} must declare { value, giver, basis } — every dial is a prior awaiting the material's own measurement (S16); the giver field is mandatory`);
  }
  for (const item of consumes ?? []) {
    if (!item || typeof item.kind !== "string" || !item.kind || !CONSUME_TAGS.includes(item.as))
      throw new TypeError(`assembly ${id}: each consumed artifact kind is tagged { kind, as: "prior" | "witness" } — witness is only lawful from the same read (§4)`);
  }
  for (const feed of dynamics ?? []) {
    if (!DYNAMICS_FEEDS.includes(feed)) throw new TypeError(`assembly ${id}: unknown dynamics feed ${JSON.stringify(feed)}`);
  }
  return freeze({
    schema: "Assembly@1",
    id,
    version,
    layer,
    // the terrains this assembly DECLARES as its subject, apart from those its cells
    // happen to emit (contract.terrains is the measured union) — a planner answers
    // "which fold reads X" from what an assembly is FOR, not from what it touches.
    declaredTerrains: stable([...(terrains ?? [])]),
    contract: freeze({
      ops: stable(resolvedCells.map((c) => c.op)),
      terrains: stable([...(terrains ?? []), ...resolvedCells.map((c) => c.terrain)]),
      stances: stable(resolvedCells.map((c) => c.stance)),
    }),
    cells: freeze(resolvedCells),
    organs: freeze([...organs]),
    regimes: freeze(Object.fromEntries(Object.entries(regimes ?? {}).map(([k, v]) => [k, freeze({ ...v })]))),
    consumes: freeze((consumes ?? []).map((c) => freeze({ ...c }))),
    produces: stable(produces),
    stagesNotRun: freeze([...(stagesNotRun ?? [])]),
    dynamics: stable(dynamics),
    ...(note ? { note } : {}),
  });
}

/** A fresh, empty register — an immutable value, task-log.js's own shape. */
export function createAssemblyRegistry() {
  return freeze({ schema: "AssemblyRegistry@1", entries: freeze([]) });
}

/**
 * register(registry, asm) — append-only (A2.2). A (id, version) pair is
 * never edited in place and never re-registered; a new version supersedes by
 * arriving with a HIGHER number, and every older entry stays on the list —
 * change arrives as a new assembly, never as an edit inside an old one.
 */
export function registerAssembly(registry, asm) {
  if (registry?.schema !== "AssemblyRegistry@1") throw new TypeError("registerAssembly requires an AssemblyRegistry@1");
  if (asm?.schema !== "Assembly@1") throw new TypeError("registerAssembly requires an Assembly@1 — construct it through assembly() so its contract is derived, not asserted");
  const latest = resolveAssembly(registry, asm.id);
  if (latest && asm.version <= latest.version)
    throw new TypeError(`registerAssembly: ${asm.id}@${asm.version} does not supersede the registered ${asm.id}@${latest.version} — the register is append-only and versions only move forward (A2.2)`);
  return freeze({ schema: "AssemblyRegistry@1", entries: freeze([...registry.entries, asm]) });
}

/** The latest registered version of one assembly, or null. */
export function resolveAssembly(registry, id) {
  let found = null;
  for (const entry of registry?.entries ?? []) {
    if (entry.id === id && (!found || entry.version > found.version)) found = entry;
  }
  return found;
}

/** The latest version of every registered assembly, id-sorted. */
export function registeredAssemblies(registry) {
  const ids = stable((registry?.entries ?? []).map((e) => e.id));
  return freeze(ids.map((id) => resolveAssembly(registry, id)));
}

/**
 * stampResult(registry, result, id) — A2.1: every measurement names its
 * assembly. The stamp resolves through the register — a result stamped with
 * an unregistered assembly would be quotable as nothing, so it is refused
 * here rather than discovered later.
 */
export function stampResult(registry, result, id) {
  const asm = resolveAssembly(registry, id);
  if (!asm) throw new TypeError(`stampResult: ${JSON.stringify(id)} is not on the register — a result without a registered assembly stamp is quotable as nothing (A2.1)`);
  return freeze({ ...result, assembly: freeze({ id: asm.id, version: asm.version }) });
}

/**
 * absentAssemblies(registry, presentIds) — A4.2's typed absence: the lattice
 * rows registered but not present in this run. Absence of an upper assembly
 * is TYPED, never rendered as a zero in that assembly's metrics. Baseline
 * and projection rows are not lattice layers and do not appear as absences.
 */
export function absentAssemblies(registry, presentIds = []) {
  const present = new Set(presentIds);
  return freeze(registeredAssemblies(registry)
    .filter((a) => a.layer === "lattice" && !present.has(a.id))
    .map((a) => a.id));
}

/**
 * contractViolations(asm, operations) — A2.3's pure checker: operations
 * whose cell falls outside the assembly's declared contract. Returns typed
 * rows, never throws — where the refusal lands (applyDelta, a test, a
 * driver) is the caller's, and the disclosed applyDelta wiring is a later,
 * conformance-gated pass.
 */
export function contractViolations(asm, operations = []) {
  if (asm?.schema !== "Assembly@1") throw new TypeError("contractViolations requires an Assembly@1");
  const out = [];
  for (const op of operations) {
    if (op?.schema !== "EOOperation@1") continue;
    if (!asm.contract.ops.includes(op.operator)) {
      out.push(freeze({ id: op.id ?? null, operator: op.operator, terrain: op.terrain, reason: "operator_outside_contract", detail: `${asm.id}@${asm.version} does not declare ${op.operator} among its ops` }));
      continue;
    }
    if (!asm.contract.terrains.includes(op.terrain)) {
      out.push(freeze({ id: op.id ?? null, operator: op.operator, terrain: op.terrain, reason: "terrain_outside_contract", detail: `${asm.id}@${asm.version} does not declare ${op.terrain} among its terrains` }));
    }
  }
  return freeze(out);
}

/**
 * stampDelta(delta, { id, version }) — A5.1: every fold contribution carries
 * its producer. One field, stamped where deltas are built: each operation
 * gains provenance.assembly = { id, version }; everything else on the
 * operation (and on the delta) is byte-identical.
 */
export function stampDelta(delta, { id, version } = {}) {
  if (delta?.schema !== "DeltaFold@1") throw new TypeError("stampDelta requires a DeltaFold@1");
  if (typeof id !== "string" || !id.startsWith("assembly:") || !Number.isInteger(version))
    throw new TypeError("stampDelta: the producing assembly is named as { id, version } — an unattributed contribution is what A5 exists to prevent");
  const producer = freeze({ id, version });
  return freeze({
    ...delta,
    operations: freeze((delta.operations ?? []).map((op) => freeze({
      ...op,
      provenance: freeze({ ...(op.provenance ?? {}), assembly: producer }),
    }))),
  });
}

/**
 * contributionsOf(fold, assemblyId) — every standing contribution one
 * assembly made to this fold: the operations stamped with its provenance,
 * and the graph objects those operations put there. This is
 * reaction.js::derivedUnder generalized from per-affordance to
 * per-assembly — what makes a concession able to reach its products.
 */
export function contributionsOf(fold, assemblyId) {
  const operations = (fold?.transformationObjects ?? []).filter((op) => op?.provenance?.assembly?.id === assemblyId);
  const outputRefs = stable(operations.flatMap((op) => [
    ...(op.outputs ?? []),
    ...(op.payload?.value?.id ? [op.payload.value.id] : []),
  ]));
  return freeze({ operations: freeze(operations), outputRefs });
}

/**
 * concedeAssembly(fold, { assembly: { id, version }, trigger }) — A5.2: a
 * refuted assembly concedes wholesale. Returns { delta, conceded } where the
 * delta holds ONE REC (Pattern grain — the concession is the ∀-shaped act,
 * declarations.js's own typing) whose consequence enumerates exactly the
 * contribution set it re-zeroes. Nothing is deleted and nothing is
 * overwritten: applying the delta appends the REC to the fold's own
 * transformation log, and concededAssemblies() is the projection that reads
 * it. Refusals are typed:
 *   - no trigger: a re-zero records its own reason, never a silent concession
 *   - no contributions: a concession that cannot enumerate what it re-zeroes
 *     is a version bump wearing an operator's name
 */
export function concedeAssembly(fold, { assembly: producer, trigger } = {}) {
  if (typeof producer?.id !== "string" || !producer.id.startsWith("assembly:"))
    throw new TypeError("concedeAssembly: the conceded assembly is named as { id, version }");
  if (typeof trigger !== "string" || !trigger.trim())
    throw new TypeError("concedeAssembly: a trigger is declared — a re-zero records its own reason as `trigger`, never a silent concession (declarations.js::concede's rule, at assembly scale)");
  const contributions = contributionsOf(fold, producer.id);
  if (!contributions.operations.length)
    throw new TypeError(`concedeAssembly: ${producer.id} has no standing contribution on this fold — a concession that cannot enumerate what it re-zeroes is a version bump wearing an operator's name (A5.2)`);
  const reZeroes = stable(contributions.operations.map((op) => op.id));
  const operation = eoOperation({
    op: "REC",
    grain: "Pattern",
    witness: null,
    inputs: [...reZeroes],
    outputs: [],
    consequence: {
      kind: "assembly_conceded",
      assembly: freeze({ id: producer.id, version: producer.version ?? null }),
      trigger,
      reZeroes,
      outputRefs: contributions.outputRefs,
    },
    payload: null,
  });
  return freeze({
    delta: freeze({ schema: "DeltaFold@1", id: `concession:${producer.id}:${fold?.sequence ?? 0}`, operations: freeze([operation]) }),
    conceded: contributions,
  });
}

/** The projection over assembly concessions: which assemblies this fold has
 * conceded, each with its trigger and the enumerated set — read from the
 * fold's own transformation log, never a second store. */
export function concededAssemblies(fold) {
  const out = [];
  for (const op of fold?.transformationObjects ?? []) {
    if (op?.operator !== "REC" || op?.consequence?.kind !== "assembly_conceded") continue;
    out.push(freeze({
      assembly: op.consequence.assembly,
      trigger: op.consequence.trigger,
      reZeroes: op.consequence.reZeroes ?? freeze([]),
      outputRefs: op.consequence.outputRefs ?? freeze([]),
      operationId: op.id ?? null,
    }));
  }
  return freeze(out);
}

/**
 * derivedUnderConceded(consumed, concessions) — A5.3: downstream consumers
 * of a conceded artifact are NOTIFIED, not rewritten (the S19 pattern — a
 * veto stops future derivation and cannot un-derive the past). `consumed`
 * is the artifacts a result was built on; the return is what that result's
 * own `derivedUnderConceded` field should carry.
 */
export function derivedUnderConceded(consumed = [], concessions = []) {
  const byId = new Map(concessions.map((c) => [c.assembly?.id, c]));
  return freeze((consumed ?? []).flatMap((artifact) => {
    const producerId = artifact?.producer?.assembly;
    const concession = byId.get(producerId);
    if (!concession) return [];
    return [freeze({
      kind: artifact.kind ?? null,
      producer: artifact.producer ?? null,
      trigger: concession.trigger,
      standing: "consumed_artifact_producer_conceded",
    })];
  }));
}
