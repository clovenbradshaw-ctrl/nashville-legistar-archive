// native/kernel/entity-profile.js — A MEANINGFUL PROFILE ON ANY ENTITY.
// Medium-blind, kernel-level. Standing: nomination.
//
// User direction: "create a meaningful profile on any given entity using kind
// induction on it and displaying its key parameters no matter what they are."
//
// What an entity's parameters ARE is not declared here. A parameter is any
// relation the entity takes part in — entity-kind-induction.js's own words: "a
// parameter is only a possible interaction channel". Which parameters are KEY
// is decided by KIND INDUCTION, never by a schema: the kind an entity's
// relation profile earns (kind-functional-induction.js) is what makes a
// relation characteristic of the entity rather than incidental, and the kind's
// own one-valuedness standings say whether each parameter is
//   fixed          exposed, no member's witnessed values ever disagree
//   one-at-a-time  change over time, one value at any moment
//   many-valued    a witnessed simultaneous disagreement (refuted one-valued)
//   time-unknown   disagreements exist but none is placed in time
//   unexposed      never asserted twice — it was never tested
// and where no kind is established, "unknown" — a standing is never assumed.
//
// The profile is a READ, not a verdict. Every parameter carries its standing
// and its evidence counts. An entity whose population is too small to induce a
// kind still gets a profile — its raw relation profile, marked "kind not
// established" — never a fabricated one.

import { induceKindsAndFunctions } from "./kind-functional-induction.js";
import { stableHash } from "./rng.js";

export const ENTITY_PROFILE_SCHEMA = "EOEntityProfile@1";
export const ENTITY_PROFILES_SCHEMA = "EOEntityProfiles@1";

// The standing lattice, most-identifying first. Used both to merge a relation
// that appears under more than one of an entity's kinds (the strongest reading
// wins) and to rank the profile's parameters.
const STANDING_RANK = Object.freeze({ fixed: 0, "one-at-a-time": 1, "many-valued": 2, "time-unknown": 3, unknown: 3, unexposed: 4 });

/**
 * Turn a list of triples into IN-POPULATION per-referent assertions.
 *
 * A triple is any `{ subject, verb, object }` — the hyperlexicon's folded
 * assertion shape — or `{ end1, label, end2 }`, notes.fold's. Both directions
 * are emitted: a referent is an end of an assertion whether it is subject or
 * object, so "X met Y" gives X `(met, Y)` and Y `(met, X)`. Only ends that
 * NAME a referent in `referents` become assertions; a literal object is still
 * carried as a value, but the subject must be a referent for the assertion to
 * belong to one. `identity` canonizes a name to a referent id where the caller
 * has a cast; it defaults to identity so a caller with ids pays nothing.
 */
export function assertionsFromTriples(triples, { referents = null, identity = (x) => x } = {}) {
  const known = referents ? new Set(referents) : null;
  const isRef = (x) => x != null && x !== "" && (!known || known.has(x));
  const out = new Map();
  let seq = 0;
  for (const t of triples ?? []) {
    const s = t.subject ?? t.end1;
    const v = t.verb ?? t.label;
    const o = t.object ?? t.end2;
    if (v == null || v === "") { seq += 1; continue; }
    const at = t.seq ?? t.sequencePosition ?? seq;
    const base = {
      id: t.id ?? `t:${stableHash(`${s}|${v}|${o}`)}#${seq}`,
      rel: identity(v),
      witnessed: t.witnessed ?? ((t.witnessCount ?? t.witnesses?.length ?? 1) > 0),
      seq: at,
    };
    if (t.interval) base.interval = t.interval;
    const add = (ref, value) => {
      const key = identity(ref);
      if (!isRef(key)) return;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ ...base, value: identity(value) });
    };
    add(s, o);
    add(o, s);
    seq += 1;
  }
  return out;
}

/** The population prevalence + information weight of every relation, read off
 *  the referents that assert it — the IDF weighting entity-kind-induction
 *  already uses inside its inducer, surfaced here so a profile's parameters can
 *  be ranked by how strongly each one identifies its bearer. */
function relationStats(assertionsById, ids) {
  const support = new Map();
  for (const id of ids) for (const a of assertionsById.get(id) ?? []) support.set(a.rel, (support.get(a.rel) ?? 0) + 1);
  const n = ids.length || 1;
  const out = new Map();
  for (const [rel, count] of support) out.set(rel, { support: count, prevalence: count / n, weight: 1 + Math.log((n + 1) / (count + 1)) });
  return out;
}

/** The entity's own values for one relation, grouped, with their span in the
 *  reading. A value's `count` is how many assertions carried it; `firstAt`/
 *  `lastAt` are the reading positions; `interval` rides when any assertion
 *  placed the value in time. */
function valuesFor(assertions) {
  const byValue = new Map();
  for (const a of assertions) {
    const key = typeof a.value === "string" ? a.value : stableHash(JSON.stringify(a.value));
    let rec = byValue.get(key);
    if (!rec) { rec = { value: a.value, count: 0, firstAt: a.seq ?? null, lastAt: a.seq ?? null, interval: a.interval ?? null, evidence: [] }; byValue.set(key, rec); }
    rec.count += 1;
    if (a.seq != null) {
      rec.firstAt = rec.firstAt == null ? a.seq : Math.min(rec.firstAt, a.seq);
      rec.lastAt = rec.lastAt == null ? a.seq : Math.max(rec.lastAt, a.seq);
    }
    if (!rec.interval && a.interval) rec.interval = a.interval;
    rec.evidence.push(a.id);
  }
  return [...byValue.values()].sort((x, y) => y.count - x.count || String(x.value).localeCompare(String(y.value)));
}

// A kind's signatures are the profile features it was induced from; both
// inducers key a relation feature `rel:<name>` (kind-functional-induction.js
// profile()). The prefix is stripped so a profile reads back the bare relation.
const bareRel = (sig) => String(sig).replace(/^rel:/, "");

/**
 * profileOf(id, built) -> EOEntityProfile@1
 *
 * `built` is what buildEntityProfiles returned. The relation's standing is
 * looked up in the kind(s) the entity earned; a relation under more than one
 * kind takes the strongest standing. Where no kind stands, the standing is
 * "unknown" — never assumed single-valued.
 */
export function profileOf(id, { produced, assertionsById, ids, sameValue = (a, b) => a === b, stats = null } = {}) {
  const assertions = assertionsById.get(id) ?? [];
  const stat = stats ?? relationStats(assertionsById, ids);
  const kindKeys = [...(produced?.kindsOf?.(id) ?? [])];
  const kinds = (produced?.kinds ?? []).filter((k) => kindKeys.includes(k.kindKey));
  const characteristic = new Set(kinds.flatMap((k) => k.signatures ?? []).map(bareRel));

  const byRel = new Map();
  for (const a of assertions) {
    if (!byRel.has(a.rel)) byRel.set(a.rel, []);
    byRel.get(a.rel).push(a);
  }

  const parameters = [];
  for (const [rel, relAssertions] of byRel) {
    let standing = "unknown";
    let kindKey = null;
    for (const k of kinds) {
      const table = produced.relations.get(k.kindKey);
      const entry = table?.[rel];
      if (!entry) continue;
      if (kindKey == null || STANDING_RANK[entry.standing] < STANDING_RANK[standing]) { standing = entry.standing; kindKey = k.kindKey; }
      else if (entry.standing === standing && kindKey == null) kindKey = k.kindKey;
    }
    const s = stat.get(rel) ?? { support: relAssertions.length, prevalence: 0, weight: 1 };
    parameters.push({
      rel,
      values: valuesFor(relAssertions),
      standing,
      kindCharacteristic: characteristic.has(rel),
      informationWeight: +s.weight.toFixed(4),
      populationPrevalence: +s.prevalence.toFixed(4),
      support: s.support,
      kind: kindKey,
      evidence: relAssertions.map((a) => a.id),
    });
  }
  // KEY PARAMETERS FIRST: a relation the kind is defined by, then the strongest
  // standing (a fixed parameter identifies its bearer; an unexposed one licenses
  // nothing), then how strongly the relation identifies (IDF), then breadth.
  parameters.sort((a, b) =>
    (b.kindCharacteristic ? 1 : 0) - (a.kindCharacteristic ? 1 : 0) ||
    STANDING_RANK[a.standing] - STANDING_RANK[b.standing] ||
    b.informationWeight - a.informationWeight ||
    b.values.length - a.values.length ||
    a.rel.localeCompare(b.rel),
  );

  const established = kinds.length > 0;
  return Object.freeze({
    schema: ENTITY_PROFILE_SCHEMA,
    id,
    kinds: kinds.map((k) => ({ kindKey: k.kindKey, memberCount: k.members.length, signatures: (k.signatures ?? []).map(bareRel), bindingEnergy: k.bindingEnergy ?? null })),
    established,
    parameters,
    basis: Object.freeze({
      population: ids.length,
      populationKind: established ? "induced" : "not_established",
      assertions: assertions.length,
      relations: byRel.size,
      exposureFloor: produced?.diagnostics?.exposureFloor ?? null,
      asOf: produced?.builtAsOf ?? null,
      inducer: produced?.diagnostics?.inducer?.method ?? "inducer",
      note: established
        ? `kind induced from the relation profile (${kinds.length} kind${kinds.length === 1 ? "" : "s"}) — key parameters ordered by kind-characteristicity and functional standing`
        : "kind not established for this population — the raw relation profile is shown; no functional standing is claimed",
    }),
  });
}

/**
 * buildEntityProfiles(assertionsById, opts) -> {
 *   schema: EOEntityProfiles@1, byId: Map<id, EOEntityProfile@1>,
 *   produced, diagnostics
 * }
 *
 * One kind induction for the whole population — a kind cannot be induced from
 * one entity against itself — then one profile per entity. `referents` defaults
 * to the keys of `assertionsById`; pass a wider list (e.g. the cast) to include
 * entities that asserted nothing, so their emptiness is disclosed rather than
 * hidden.
 */
export function buildEntityProfiles(assertionsById, {
  referents = null,
  sameValue = (a, b) => a === b,
  witnessed = null,
  exposureFloor = 2,
  kindOptions = {},
  kindMethod = "inducer",
  asOf = null,
  inProfile = null,
  objectKinds = null,
} = {}) {
  if (!(assertionsById instanceof Map)) throw new TypeError("entity-profile: assertionsById must be a Map");
  if (!Number.isInteger(exposureFloor) || exposureFloor < 1) throw new TypeError("entity-profile: exposureFloor must be a positive integer");
  const ids = [...(referents ?? assertionsById.keys())].map(String);
  const assertionsOf = (id) => assertionsById.get(id) ?? [];
  const wit = witnessed ?? ((a) => a.witnessed !== false);
  const produced = induceKindsAndFunctions(ids, {
    assertionsOf,
    sameValue,
    witnessed: wit,
    exposureFloor,
    kindOptions: { population: "entity-profile", ...kindOptions },
    kindMethod,
    asOf,
    inProfile,
    objectKinds,
  });
  const stats = relationStats(assertionsById, ids);
  const byId = new Map(ids.map((id) => [id, profileOf(id, { produced, assertionsById, ids, sameValue, stats })]));
  return Object.freeze({
    schema: ENTITY_PROFILES_SCHEMA,
    byId,
    produced,
    diagnostics: Object.freeze({
      entities: ids.length,
      profiled: [...byId.values()].filter((p) => p.parameters.length > 0).length,
      kinds: produced.kinds.length,
      established: [...byId.values()].filter((p) => p.established).length,
      exposureFloor,
      asOf,
      inducer: produced.diagnostics?.inducer ?? null,
    }),
  });
}

/** profileLines(profile) -> string[] — a surface-neutral plain-text rendering,
 *  so a CLI, a notebook, or any surface without HTML can show the same profile.
 *  Every line names a parameter and its values; the standing rides the left. */
export function profileLines(profile) {
  const lines = [];
  const kind = profile.kinds.map((k) => k.kindKey).join(", ") || "—";
  lines.push(`${profile.id} · ${profile.established ? "kind" : "no kind established"}: ${kind}`);
  if (!profile.parameters.length) { lines.push("  (no relations asserted — nothing to profile)"); return lines; }
  for (const p of profile.parameters) {
    const vals = p.values.slice(0, 6).map((v) => `${v.value}${v.count > 1 ? `×${v.count}` : ""}`).join(", ") + (p.values.length > 6 ? ` … +${p.values.length - 6}` : "");
    lines.push(`  ${p.standing.padEnd(13)} ${p.kindCharacteristic ? "★" : " "} ${p.rel} → ${vals}`);
  }
  lines.push(`  basis: ${profile.basis.note}`);
  return lines;
}
