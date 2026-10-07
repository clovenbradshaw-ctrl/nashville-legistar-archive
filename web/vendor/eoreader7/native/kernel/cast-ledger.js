// native/kernel/cast-ledger.js — CastLedger@1: the entity assembly's sealed
// product (ASSEMBLIES-AND-ARTIFACTS.md §3, spec step 3 — the strongest
// candidate first: goldens exist, precision measured).
//
// The ledger is a PROJECTION of what the fold holds about the cast —
// referents, their surfaces, their mention counts, and the typed gaps the
// discovery organ filed — arithmetic tier throughout (A1.3): ids, strings
// and monotone counts, nothing that decays. It is always re-derivable from
// the log (A3.2): deriveCastLedger over a reconstructed fold's graphEntries
// yields byte-identical output, because everything here is read in the
// log's own deterministic order and canonicalized by sort where the order
// is not itself the content.
//
// Medium-blind by the same licence rhythm-priors.js already holds: this
// module reads schema names (EOReferent@1, EOMention@1, EOReferentGap@1),
// never a medium's grammar — which surfaces mean what stays the adapter's
// business (S6).

import { sealArtifact } from "./artifact.js";

const freeze = (value) => Object.freeze(value);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const entriesOf = (foldOrEntries) => Array.isArray(foldOrEntries) ? foldOrEntries : (foldOrEntries?.graphEntries ?? []);

/**
 * deriveCastLedger(foldOrEntries) — the CastLedger@1 body.
 *
 * Referents are canonicalized by id; each carries its surfaces exactly as
 * the fold's own (deterministic) accumulation left them, plus a monotone
 * mention count. Gaps ride whole — a typed gap is part of the cast's
 * honest state, not decoration (A4.2's spirit one level down: absence
 * typed, never zeroed).
 */
export function deriveCastLedger(foldOrEntries) {
  const entries = entriesOf(foldOrEntries);
  const referents = new Map();
  const mentions = new Map();
  const gaps = [];
  for (const entry of entries) {
    if (entry?.schema === "EOReferent@1" && entry.id) {
      referents.set(entry.id, { id: entry.id, surfaces: [...(entry.surfaces ?? [])] });
    } else if (entry?.schema === "EOMention@1" && entry.referent) {
      mentions.set(entry.referent, (mentions.get(entry.referent) ?? 0) + 1);
    } else if (entry?.schema === "EOReferentGap@1") {
      gaps.push({ id: entry.id ?? null, reason: entry.reason ?? "untyped", referent: entry.referent ?? null, tier: entry.tier ?? null });
    }
  }
  const rows = [...referents.values()]
    .map((r) => freeze({ id: r.id, surfaces: freeze(r.surfaces), mentions: mentions.get(r.id) ?? 0 }))
    .sort(byId);
  const gapRows = gaps
    .map((g) => freeze(g))
    .sort((a, b) => (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : (a.referent ?? "") < (b.referent ?? "") ? -1 : 1));
  return freeze({
    schema: "CastLedger@1",
    referents: freeze(rows),
    gaps: freeze(gapRows),
    counts: freeze({
      referents: rows.length,
      surfaces: rows.reduce((n, r) => n + r.surfaces.length, 0),
      mentions: [...mentions.values()].reduce((n, c) => n + c, 0),
    }),
  });
}

/**
 * castLedgerConformance(body, foldOrEntries) — the entity assembly's own
 * conformance over a ledger it is about to seal (A3.1's precondition).
 * Mechanical: identity is whole, counts are honest, and every mention the
 * fold holds is attributable inside the ledger.
 */
export function castLedgerConformance(body, foldOrEntries) {
  const entries = entriesOf(foldOrEntries);
  const checks = [];
  const failures = [];
  const check = (name, ok) => { checks.push(name); if (!ok) failures.push(name); };
  check("schema is CastLedger@1", body?.schema === "CastLedger@1");
  const ids = new Set((body?.referents ?? []).map((r) => r.id));
  check("referent ids unique", ids.size === (body?.referents ?? []).length);
  check("every referent carries at least one surface", (body?.referents ?? []).every((r) => (r.surfaces ?? []).length > 0));
  const foldMentions = entries.filter((e) => e?.schema === "EOMention@1");
  check("every mention the fold holds names a referent the ledger carries", foldMentions.every((m) => ids.has(m.referent)));
  check("counts agree with the rows", body?.counts?.referents === (body?.referents ?? []).length
    && body?.counts?.mentions === (body?.referents ?? []).reduce((n, r) => n + r.mentions, 0));
  return { passed: failures.length === 0, checks, failures };
}

// S12: what the projection DROPPED from the fold it was cut from — declared
// at seal time, because that is where consumers' collapses come from.
const CAST_LEDGER_DROPPED = freeze([
  "mention positions and witnesses — only per-referent mention counts survive; the rhythm of returns is the atmosphere assembly's artifact, not this one's",
  "relation edges and their participants — the link assembly's product is not smuggled into the entity artifact",
  "discovery events (DEF.admit order, witnessed merges, provenance per surface) — regenerable from the log, which stays the authority (A3.2)",
  "every geometric-tier quantity (activation, presence, margins) — dropped by law (A1.1), not by accident",
]);

/**
 * sealCastLedger({ foldOrEntries, producer, material, regime,
 * sealedAtSequence, dropped }) — derive, check, seal: the entity assembly's
 * set-down in one motion, refused whole if any part refuses.
 */
export function sealCastLedger({ foldOrEntries, producer, material, regime, sealedAtSequence, dropped = CAST_LEDGER_DROPPED } = {}) {
  const body = deriveCastLedger(foldOrEntries);
  const conformance = castLedgerConformance(body, foldOrEntries);
  if (!conformance.passed)
    throw new TypeError(`sealCastLedger: the entity assembly's own conformance failed (${conformance.failures.join("; ")}) — an unsealed projection is scratch and may not cross a boundary (A3.1)`);
  return sealArtifact({ kind: "CastLedger@1", producer, material, regime, dropped: [...dropped], body, sealedAtSequence, conformance });
}
