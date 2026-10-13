// kernel/hyperlexicon-abstraction.js — THE HYPERLEXICON AS ABSTRACTION REGISTRY.
// The full-cube widening of handle Xushen's ledger: the Hyperlexicon is not
// merely a relation-composition dictionary (hyperlexicon.js) — it is also the
// record of WHAT THE SYSTEM HAS LEARNED TO RECOGNIZE, across all nine
// terrains of the EO cube, including recognitions about recognitions.
//
// THE CUBE ENTERS THE LEDGER (2026-10-10). Every abstraction row carries its
// cube cell (operator × grain → mode, domain, terrain, stance), its recursion
// DEPTH (separate from the cube address: depth is not a new cell, it is how
// many times a discovered object has become the subject of a later encounter),
// and the referent type it abstracts over. Composition affordances gain a
// COORDINATE key space (cell: · terrain: · grain: ·) on the same ledger, so a
// discovery organ can state "for this terrain, composition is licensed"
// without inventing a second dictionary.
//
// STANDING EARNS, NOT ARRIVES. The admission ladder is the fold self-audit
// experiment's own ruling: a coherent abstraction is provisional until it
// demonstrates a consequence. Standing ∈ { candidate, given, earned, refuted }:
//   candidate — nominated by encounter (Khora), not yet tested
//   given     — attested tier (Xushen's attested surfaces) or a structural
//               chemistry derivation rule, supplied by a ground
//   earned    — promoted ONLY by measured validation (Janus's consequence
//               test), never by coherence alone
//   refuted   — a falsifier defeated it; PRESERVED, never deleted, with its
//               defeat recorded
// A row cannot move to earned without validation evidence naming a method and
// a measured effect or pValue — the within-field cohesion null alone is
// refused, exactly as the outer-null control (p≈0.630) demonstrated it must
// be. A refuted row never silently becomes earned again.
//
// THE META LAW (generalized kind:has-term). A Pattern-grain abstraction (Kind,
// Network, Paradigm) may belong to a meta-abstraction of the SAME terrain at
// depth+1, and the membership is a ledger note (keeps-company), exactly as
// hyperlexicon-routes.js projects role-kinds into kind:has-term. Here it is a
// law over any Pattern abstraction, driven by depth — abstractions about other
// abstractions are one family, not a single dated-term special case. A Figure
// or Ground row is refused: those are units and substrates, not abstraction-
// emission points.
//
// PURE: no I/O, no state; every act returns a new frozen registry. A typed gap
// (unknown operator or grain) is a throw, never a silent row.

import { cellOf, GRAINS } from "./cube.js";
import { normalizeHyperlexicon, pairKey, compositionAffordance } from "./hyperlexicon.js";
import { stableHash } from "./rng.js";

const freeze = (value) => Object.freeze(value);

export const HL_ABSTRACTION_SCHEMA = "EOHyperlexiconAbstraction@1";
export const ABSTRACTION_STANDINGS = Object.freeze(["candidate", "given", "earned", "refuted", "unknown"]);
export const META_VERB = "keeps-company";
// Structural chemistry rows (the membership law mints depth anchors) carry
// this flag, kept apart from the charter license tier — same convention as
// hyperlexicon.js's licenseStanding.
const CHEMISTRY = { chemistry: true };

function coordsOf(cell) {
  return freeze({
    op: cell?.op ?? null,
    grain: cell?.grain ?? null,
    mode: cell?.mode ?? null,
    domain: cell?.domain ?? null,
    terrain: cell?.terrain ?? null,
    stance: cell?.stance ?? null,
  });
}

/** A cube cell from (op, grain), a full cell, or a terrain-coordinate row
 *  (which defaults to the Pattern grain — the abstraction-emission face).
 *  A stored terrain-coordinate cell (op null) is returned as-is: it is NOT a
 *  callable cube cell, and re-normalizing it through cellOf is a typed gap. */
function resolveCell({ op = null, grain = null, cell = null, terrain = null } = {}) {
  if (op && grain) {
    const c = cellOf(op, grain);
    if (c.gap) throw new TypeError(`hyperlexicon-abstraction: ${c.reason}`);
    return c;
  }
  if (cell?.op && cell?.grain) return cell;
  const t = terrain ?? cell?.terrain ?? null;
  const g = cell?.grain ?? "Pattern";
  return freeze({ op: null, grain: g, mode: null, domain: null, terrain: t, stance: null });
}

const provenanceFor = (row) => freeze({
  giver: row.giver ?? row.provenance?.giver ?? null,
  binding: row.binding ?? row.provenance?.binding ?? null,
  basis: row.basis ?? row.provenance?.basis ?? (
    row.standing === "earned"
      ? "earned by measured validation — the consequence test, not coherence"
      : row.standing === "given"
        ? "given tier — attested surfaces or a stamped derivation rule"
        : row.standing === "refuted"
          ? "refuted — preserved with its defeat recorded, never silently re-earned"
          : row.standing === "candidate"
            ? "nominated by encounter — provisional until a consequence is measured"
            : "no abstraction has been admitted"),
});

function normalizeValidation(validation) {
  if (!validation) return null;
  const out = {
    method: validation.method ?? "unspecified",
    ...(validation.effect != null ? { effect: validation.effect } : {}),
    ...(validation.pValue != null ? { pValue: validation.pValue } : {}),
    ...(validation.nullMethod ? { nullMethod: validation.nullMethod } : {}),
    ...(validation.nullP != null ? { nullP: validation.nullP } : {}),
    ...(validation.invariant != null ? { invariant: validation.invariant } : {}),
    ...(validation.summary ? { summary: validation.summary } : {}),
  };
  return freeze(out);
}

function normalizeAbstraction(row = {}, { cellHint = null, defaultStanding = null } = {}) {
  const cell = resolveCell(cellHint ?? row);
  const standing = ABSTRACTION_STANDINGS.includes(row.standing)
    ? row.standing
    : (row.standing ?? defaultStanding ?? "unknown");
  return freeze({
    schema: HL_ABSTRACTION_SCHEMA,
    id: row.id ?? `abstraction:${stableHash(JSON.stringify({ cell: coordsOf(cell), depth: row.depth ?? 0, label: row.label ?? null }))}`,
    cell,
    coords: coordsOf(cell),
    terrain: cell.terrain ?? null,
    depth: Number.isInteger(row.depth) ? row.depth : 0,
    referentType: row.referentType ?? "abstraction",
    label: row.label ?? null,
    standing,
    memberRefs: freeze([...(row.memberRefs ?? [])]),
    memberOf: freeze([...(row.memberOf ?? [])]),
    witnesses: freeze([...(row.witnesses ?? [])]),
    provenance: provenanceFor(row),
    validation: normalizeValidation(row.validation),
    retractions: freeze([...(row.retractions ?? [])]),
    meta: freeze({ ...(row.meta ?? {}) }),
  });
}

/** The deterministic registry id of a coordinate anchor: the meta/label-less
 *  row a terrain owns at a given depth ("abstraction:kind:depth0"). */
export function abstractionId({ op = null, grain = "Pattern", terrain = null, depth = 0, label = null } = {}) {
  const resolved = op ? cellOf(op, grain) : null;
  const t = String(terrain ?? resolved?.terrain ?? "none").toLowerCase();
  const base = `abstraction:${t}`;
  const suffix = label ? `:${String(label).toLowerCase().replace(/[^a-z0-9._-]/gi, "_")}` : "";
  return `${base}${suffix}:depth${depth}`;
}

export function createAbstractionRegistry({ abstractions = [], meta = {} } = {}) {
  const table = Object.create(null);
  for (const raw of abstractions ?? []) {
    const row = normalizeAbstraction(raw);
    table[row.id] = row;
  }
  return freeze({
    schema: HL_ABSTRACTION_SCHEMA,
    abstractions: freeze(table),
    meta: freeze({ ...meta }),
  });
}

export function normalizeAbstractionRegistry(input = null) {
  if (!input) return createAbstractionRegistry();
  if (input.schema === HL_ABSTRACTION_SCHEMA && input.abstractions) return input;
  if (Array.isArray(input)) return createAbstractionRegistry({ abstractions: input });
  if (input?.abstractions) return createAbstractionRegistry({ abstractions: input.abstractions, meta: input.meta });
  return createAbstractionRegistry({ abstractions: input });
}

function nextTable(registry, updates) {
  const r = normalizeAbstractionRegistry(registry);
  return createAbstractionRegistry({ abstractions: [...Object.values(r.abstractions), ...updates], meta: r.meta });
}

/**
 * admitAbstraction — Khora's encounter act: nominate a discovered abstraction.
 * Lands as `candidate` unless the caller states a given tier; never earned by
 * admission. A row already earned is preserved (no silent demotion).
 */
export function admitAbstraction(registry, raw) {
  const isGiven = raw?.standing === "given";
  const row = normalizeAbstraction(raw, { cellHint: raw, defaultStanding: isGiven ? "given" : "candidate" });
  const r = normalizeAbstractionRegistry(registry);
  const current = r.abstractions[row.id];
  if (current?.standing === "earned" && !isGiven) return r;
  return nextTable(r, [row]);
}

/**
 * earnAbstraction — Janus's promotional act. Refuses a row without measured
 * validation (coherence alone is not earning), and refuses to promote a
 * refuted row (a defeated abstraction must first be re-examined upstream —
 * the repaired-distinction discipline from the experiment).
 */
export function earnAbstraction(registry, { id = null, validation = null } = {}) {
  if (!validation?.method || (validation.effect == null && validation.pValue == null)) {
    throw new TypeError("earnAbstraction: earned requires validation evidence — a method and a measured effect or pValue; coherence alone is refused");
  }
  const r = normalizeAbstractionRegistry(registry);
  const existing = id ? r.abstractions[id] : null;
  if (!existing || existing.schema !== HL_ABSTRACTION_SCHEMA) {
    throw new TypeError(`earnAbstraction requires an admitted abstraction id: ${id}`);
  }
  if (existing.standing === "refuted") return r;
  const updated = normalizeAbstraction({ ...existing, standing: "earned", validation });
  return nextTable(r, [updated]);
}

/**
 * refuteAbstraction — DEF's act: record the defeat. The row is PRESERVED with
 * standing `refuted` and the falsifier attached to `retractions`; a refuted
 * row never silently becomes earned again (a new falsifier must be examined
 * upstream first).
 */
export function refuteAbstraction(registry, { id = null, falsifier = null, reason = null } = {}) {
  const r = normalizeAbstractionRegistry(registry);
  const existing = id ? r.abstractions[id] : null;
  if (!existing || existing.schema !== HL_ABSTRACTION_SCHEMA) {
    throw new TypeError(`refuteAbstraction requires an admitted abstraction id: ${id}`);
  }
  const retraction = freeze({
    falsifier: falsifier ?? reason?.falsifier ?? "unspecified",
    because: reason?.because ?? "the abstraction did not support the claimed distinction on a counterexample",
  });
  const updated = normalizeAbstraction({ ...existing, standing: "refuted", retractions: [...(existing.retractions ?? []), retraction] });
  return nextTable(r, [updated]);
}

/**
 * releaseDecision — the standing ladder's consumer. FALSIFIED + REPAIRED
 * (2026-10-10, step-4 arena): the registry exposed NO downstream consumer of
 * standing, so an earned and a coherence-promoted candidate were behaviorally
 * identical — the discipline was decorative. Repair: a consumer question that
 * decides by standing, in the module itself:
 *   earned  → released:true, carrying the measured validation (method, effect,
 *             pValue) — the only tier that licenses a consequential act.
 *   given   → released:true with its basis (the attested/dictionary tier or a
 *             stamped derivation rule releases its ground, not a p-value).
 *   candidate → released:false, WITHHELD — coherence alone licenses no action
 *             (the self-audit's p≈0.630 rule: cohesion is not standing); the
 *             row is unchanged and stays provisional in the registry.
 *   refuted → released:false, preserved — a defeated finding never re-releases,
 *             even if a new validation is stamped on it upstream.
 * PURE and frozen: it only reads; it never mutates the registry.
 */
export function releaseDecision(registry, { id = null } = {}) {
  const r = normalizeAbstractionRegistry(registry);
  const row = id ? r.abstractions[id] : null;
  if (!row || row.schema !== HL_ABSTRACTION_SCHEMA) {
    return freeze({ released: false, standing: "unknown", why: "no such abstraction — the honest absence, never a synthesized release" });
  }
  if (row.standing === "refuted") {
    return freeze({ released: false, standing: "refuted", why: "refuted — preserved with its defeat; a defeated abstraction never re-releases, even under a fresh validation" });
  }
  if (row.standing === "earned") {
    return freeze({ released: true, standing: "earned", why: "earned — measured consequence (method/effect/pValue) licenses the consequential act", evidence: row.validation });
  }
  if (row.standing === "given") {
    return freeze({ released: true, standing: "given", why: "given — the attested tier or a stamped derivation rule releases its ground", evidence: row.validation ?? freeze({ basis: row.provenance.basis }) });
  }
  return freeze({ released: false, standing: "candidate", why: "candidate — coherence alone licenses no action (cohesion is not standing); the decision is WITHHELD and the row stays provisional" });
}

/**
 * abstractionAt — best-match lookup: exact id, then coordinate match on
 * (terrain × depth) anchor, then the first row for the grain at depth (when a
 * depth is given). Returns null on honest absence — never a synthetic row.
 */
export function abstractionAt(registry, { id = null, op = null, grain = null, terrain = null, depth = null } = {}) {
  const r = normalizeAbstractionRegistry(registry);
  if (id) return r.abstractions[id] ?? null;
  if (terrain || op) {
    const c = op && grain ? cellOf(op, grain) : null;
    const t = terrain ?? c?.terrain ?? null;
    const d = depth ?? 0;
    if (t) {
      const anchor = abstractionId({ terrain: t, depth: d });
      const hit = r.abstractions[anchor];
      if (hit) return hit;
      if (c) {
        const byCell = Object.values(r.abstractions)
          .filter((a) => a.terrain === t && a.cell.op === c.op && a.cell.grain === c.grain && a.depth === d);
        if (byCell.length) return byCell[0];
      }
      const byTerrain = Object.values(r.abstractions)
        .filter((a) => a.terrain === t && a.depth === d && a.standing !== "refuted");
      if (byTerrain.length) return byTerrain[0];
    }
  }
  if (grain) {
    const byGrain = Object.values(r.abstractions)
      .filter((a) => a.cell.grain === grain && (depth == null || a.depth === depth) && a.standing !== "refuted");
    if (byGrain.length) return byGrain[0];
  }
  return null;
}

/**
 * compositionCoords — the coordinate key space for composition affordances,
 * declared on the SAME Hyperlexicon ledger as coordinate pairs. Key order of
 * specificity, matching hyperlexicon.js's own structural fallback: cell:op·grain
 * × cell:op·grain, then cell × "*", "*" × cell. Exact label-pairs defined in
 * the base ledger ALWAYS win (the given tier is never shadowed); coordinates
 * are consulted only when the base lookup returns no given affordance.
 */
export function compositionCoords(hyperlexicon, left, right, { leftOp = null, leftGrain = null, rightOp = null, rightGrain = null } = {}) {
  const hl = normalizeHyperlexicon(hyperlexicon);
  const base = compositionAffordance(hl, left, right, { leftGrain, rightGrain });
  if (base?.standing === "given") return base;

  const lc = leftOp && leftGrain ? cellOf(leftOp, leftGrain) : null;
  const rc = rightOp && rightGrain ? cellOf(rightOp, rightGrain) : null;
  const coordOf = (c, op, grain) => (c ? `cell:${c.op}·${c.grain}` : op && grain ? `cell:${op}·${grain}` : "*");
  const leftCoord = coordOf(lc, leftOp, leftGrain);
  const rightCoord = coordOf(rc, rightOp, rightGrain);

  const keys = [
    pairKey(leftCoord, rightCoord),
    pairKey(leftCoord, "*"),
    pairKey("*", rightCoord),
  ];
  for (const key of keys) {
    const row = hl.composition[key];
    if (row?.standing === "given") return row;
  }
  return base;
}

/**
 * withMetaMembership — the generalized meta law. A Pattern-grain abstraction
 * belongs to a meta-abstraction of the SAME terrain at depth+1. The meta row
 * is minted as structural chemistry the first time (given, chemistry-stamped —
 * a derivation rule, not a discovery), and membership is a ledger note
 * (keeps-company). A Figure or Ground row is refused with basis disclosed.
 *
 * FALSIFIED + REPAIRED (2026-10-10, step-3 arena): the law once admitted any
 * Pattern row, so a SINGLETON candidate or a REFUTED row was laddered into a
 * meta — a second floor generated out of nothing, contradicting the measured
 * kinds-on-kinds law ("the second floor is a test of the first; a starved
 * floor reads blank"). The narrower distinction: a floor must BIND — at least
 * two live members — and must not be REFUTED. Defeated findings are preserved
 * (they are not deleted), they just cannot stand as a parent floor.
 */
export function withMetaMembership(registry, { id = null, row = null } = {}) {
  const r = normalizeAbstractionRegistry(registry);
  const existing = row ?? (id ? r.abstractions[id] : null);
  if (!existing || existing.schema !== HL_ABSTRACTION_SCHEMA) {
    throw new TypeError(`withMetaMembership requires an abstraction id: ${id}`);
  }
  if (existing.cell.grain !== "Pattern") {
    return {
      registry: r,
      refused: true,
      basis: "only Pattern-grain abstractions (Kind, Network, Paradigm) have a meta law; Figure is a unit, Ground is a substrate",
    };
  }
  if (existing.standing === "refuted") {
    return {
      registry: r,
      refused: true,
      basis: "a REFUTED abstraction is preserved but not a floor — a defeated finding cannot telescope a second floor",
    };
  }
  if ((existing.memberRefs ?? []).length < 2) {
    return {
      registry: r,
      refused: true,
      basis: "an empty floor cannot telescope a second floor — fewer than two live members (the kinds-on-kinds law: a starved floor reads blank)",
    };
  }
  const terrain = existing.terrain ?? existing.cell.terrain;
  const metaId = abstractionId({ terrain, depth: existing.depth + 1 });
  const meta = r.abstractions[metaId] ?? normalizeAbstraction({
    id: metaId,
    terrain,
    depth: existing.depth + 1,
    referentType: "meta-abstraction",
    standing: "given",
    giver: "hyperlexicon-abstraction membership law",
    basis: "structural chemistry — the meta-abstraction of this terrain at depth+1, minted by the membership law; a derivation rule, not a discovery",
    meta: { ...CHEMISTRY, yields: "meta-membership" },
  });
  const already = (existing.memberOf ?? []).includes(metaId);
  const updated = already ? existing : normalizeAbstraction({ ...existing, memberOf: [...(existing.memberOf ?? []), metaId] });
  return {
    registry: nextTable(r, [updated, meta]),
    meta,
    note: freeze({
      subject: existing.label ?? existing.id,
      verb: META_VERB,
      object: metaId,
      witness: `hyperlexicon-abstraction:meta:${existing.id}`,
      because: `this ${terrain ?? "Pattern"} abstraction belongs to its depth ${existing.depth + 1} meta-abstraction`,
    }),
    refused: false,
  };
}

/** The membership projections, in the same note shape kindNotes() makes. */
export function abstractionNotes(registry, { witness = null } = {}) {
  const r = normalizeAbstractionRegistry(registry);
  const notes = [];
  for (const a of Object.values(r.abstractions)) {
    if (a.standing === "refuted") continue;
    for (const metaId of a.memberOf ?? []) {
      const meta = r.abstractions[metaId];
      notes.push(freeze({
        subject: a.label ?? a.id,
        verb: META_VERB,
        object: meta?.label ?? metaId,
        witness: witness ?? `hyperlexicon-abstraction:${a.id}`,
        because: `this ${a.terrain ?? "abstraction"} belongs to its depth-${a.depth + 1} meta-abstraction`,
      }));
    }
  }
  return freeze(notes);
}

export function serializeAbstractions(registry) {
  const r = normalizeAbstractionRegistry(registry);
  return freeze({
    schema: HL_ABSTRACTION_SCHEMA,
    abstractions: Object.values(r.abstractions).map((a) => normalizeAbstraction(a)),
    meta: freeze({ ...r.meta }),
  });
}