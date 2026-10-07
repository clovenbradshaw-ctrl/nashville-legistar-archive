// native/kernel/artifact.js — Artifact@1: a sealed projection of the log
// (ASSEMBLIES-AND-ARTIFACTS.md §3, A1/A3; READING-SPEC S25).
//
// An artifact is what an assembly SETS DOWN — Hora's bench (Simon 1962),
// never a database: always re-derivable from the log, never authoritative
// over it. The tier law (A1, from S10's three classes of math and P1's
// "activation decays, identity does not"):
//
//   ONLY THE ARITHMETIC TIER SHIPS (A1.3). Identity ledgers, relation
//   vocabularies, declaration registers, sequence declarations, experience
//   and rhythm priors, and the log itself — monotone counts and identities
//   that never retreat. DECAY IS NEVER SERIALIZED (A1.1): no artifact
//   carries activation, presence, or any γ^(now−t) quantity, because "the
//   reach of the present" cannot be checkpointed — by resume-time it isn't
//   the present. Serialized presence is stale attention wearing memory's
//   name; serialized belief-state was the two-incompatible-cube-ports drift
//   (eoreader5, per CUBE.md). STANDING IS RE-GRANTED, NEVER TRANSFERRED
//   (A1.2): a null verdict travels as a record (draws, seed, alpha,
//   material hash) and conditions nothing on new material until re-run
//   against that material's own null — network-standing.js's existing rule,
//   promoted to the boundary.
//
// SEALING IS A CHECKPOINT (A3.1): an artifact is sealed only after its
// assembly's own conformance passed on the material it was derived from.
// An unsealed projection is scratch and may not cross a boundary — so
// sealArtifact REFUSES a failed or absent conformance rather than recording
// one. ARTIFACTS ARE CHEAP AND DISPOSABLE (A3.2): any artifact regenerates
// from the log + producer version; a consumer finding a version mismatch
// regenerates rather than adapts — adapters over stale artifacts are how a
// second source of truth is born.
//
// DETERMINISM IS PART OF THE CONTRACT: a seal carries no wall clock (seq,
// not clock — task-log.js's own discipline), so sealing the same body twice
// from the same log is byte-identical, which is what makes the regeneration
// round-trip (test 2/3) a real check instead of a fuzzy one.

const freeze = (value) => Object.freeze(value);

// The decay-tier vocabulary an artifact body may never carry (A1.1/A1.3).
// Exact key names, case-insensitive — the geometric tier's own words
// (activation, presence, margins, γ) plus their obvious spellings. The
// conformance test greps sealed bodies with this same wall, so widening it
// is one edit, not two.
export const FORBIDDEN_BODY_KEYS = freeze([
  "activation", "activations", "activationOf",
  "presence", "present",
  "gamma", "decay", "decayed", "halfLife",
  "margin", "margins",
]);
const FORBIDDEN = new Set(FORBIDDEN_BODY_KEYS.map((k) => k.toLowerCase()));

/**
 * artifactTierViolations(body) — every path in the body whose key names a
 * decay-tier quantity. Typed rows, never a throw: the seal refuses on them,
 * and a test can read them directly.
 */
export function artifactTierViolations(body, path = "body", seen = new Set()) {
  if (body == null || typeof body !== "object") return freeze([]);
  if (seen.has(body)) return freeze([]);
  seen.add(body);
  const out = [];
  if (Array.isArray(body)) {
    body.forEach((item, i) => out.push(...artifactTierViolations(item, `${path}[${i}]`, seen)));
    return freeze(out);
  }
  for (const [key, value] of Object.entries(body)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      out.push(freeze({ path: `${path}.${key}`, key, reason: "decay_tier_quantity", detail: "A1.1: decay is never serialized — the reach of the present cannot be checkpointed, because by resume-time it isn't the present" }));
    }
    out.push(...artifactTierViolations(value, `${path}.${key}`, seen));
  }
  return freeze(out);
}

/**
 * sealArtifact({ kind, producer, material, regime, dropped, body,
 * sealedAtSequence, conformance }) — the one door to a sealed Artifact@1.
 *
 *   kind             "CastLedger@1", "ExperiencePrior@1", ... — versioned.
 *   producer         { assembly, version } — who sealed it (the assembly's
 *                    registered id and version, A2).
 *   material         { source, hash, extent } — what it was read from. The
 *                    hash is the caller's stable content address (see
 *                    materialHash); extent is in the caller's own declared
 *                    unit.
 *   regime           the producer's regimes, verbatim — S7: priors injected
 *                    are stated; their absence is stated too (an empty
 *                    object is an explicit "none", never an omission).
 *   dropped          S12: what the source carried that this artifact does
 *                    not — declared at seal time, because that is where
 *                    consumers' collapses come from. A non-empty list;
 *                    "nothing dropped" is itself said out loud.
 *   conformance      { passed: true, checks: [...] } — A3.1: the producing
 *                    assembly's own conformance, already run on this
 *                    material. Absent or failed => refused; an unsealed
 *                    projection is scratch.
 */
export function sealArtifact({ kind, producer, material, regime, dropped, body, sealedAtSequence, conformance } = {}) {
  if (typeof kind !== "string" || !/@\d+$/.test(kind))
    throw new TypeError("sealArtifact: kind is a versioned name (\"CastLedger@1\") — an unversioned artifact cannot be regenerated against its producer");
  if (typeof producer?.assembly !== "string" || !producer.assembly.startsWith("assembly:") || !Number.isInteger(producer.version))
    throw new TypeError("sealArtifact: producer is { assembly, version } — who sealed it, by registered id (A2)");
  if (typeof material?.source !== "string" || !material.source || typeof material.hash !== "string" || !material.hash || !Number.isFinite(material.extent))
    throw new TypeError("sealArtifact: material is { source, hash, extent } — what it was read from, content-addressed, with its extent in the caller's declared unit");
  if (regime == null || typeof regime !== "object")
    throw new TypeError("sealArtifact: regime is the producer's regimes verbatim — S7: priors injected are stated, and their absence is stated too ({} is an explicit none, never an omission)");
  if (!Array.isArray(dropped) || dropped.length === 0 || dropped.some((d) => typeof d !== "string" || !d))
    throw new TypeError("sealArtifact: dropped is declared at seal time — what the source carried that this artifact does not (S12); when nothing was dropped, that is itself said out loud");
  if (!Number.isInteger(sealedAtSequence) || sealedAtSequence < 0)
    throw new TypeError("sealArtifact: sealedAtSequence is the fold position at seal — an artifact that cannot say when it was cut cannot be regenerated to the same cut");
  if (conformance?.passed !== true || !Array.isArray(conformance.checks) || conformance.checks.length === 0)
    throw new TypeError("sealArtifact: sealing is a checkpoint (A3.1) — the producing assembly's conformance must have PASSED on this material, with the checks named; an unsealed projection is scratch and may not cross a boundary");
  const violations = artifactTierViolations(body);
  if (violations.length)
    throw new TypeError(`sealArtifact: the body carries decay-tier quantities (${violations.map((v) => v.path).join(", ")}) — only the arithmetic tier ships (A1.3); decay is never serialized (A1.1)`);
  return freeze({
    schema: "EOArtifact@1",
    kind,
    producer: freeze({ assembly: producer.assembly, version: producer.version }),
    material: freeze({ source: material.source, hash: material.hash, extent: material.extent, ...(material.unit ? { unit: material.unit } : {}) }),
    regime: freeze(structuredClone(regime)),
    dropped: freeze([...dropped]),
    body,
    sealedAtSequence,
    seal: freeze({
      conformance: freeze([...conformance.checks]),
      tierScan: "clean",
      basis: "A3.1 — sealed only after the producing assembly's own conformance passed on the material it was derived from",
    }),
  });
}

/**
 * producerMismatch(artifact, { id, version }) — A3.2's consumer-side check:
 * a version mismatch means REGENERATE, never adapt. Returns a typed row or
 * null; acting on it is the caller's.
 */
export function producerMismatch(artifact, { id, version } = {}) {
  if (artifact?.schema !== "EOArtifact@1") throw new TypeError("producerMismatch requires an EOArtifact@1");
  if (artifact.producer.assembly !== id)
    return freeze({ reason: "producer_assembly_mismatch", sealed: artifact.producer, expected: freeze({ assembly: id, version }), rule: "A3.2 — regenerate from the log, never adapt: adapters over stale artifacts are how a second source of truth is born" });
  if (artifact.producer.version !== version)
    return freeze({ reason: "producer_version_mismatch", sealed: artifact.producer, expected: freeze({ assembly: id, version }), rule: "A3.2 — regenerate from the log, never adapt: adapters over stale artifacts are how a second source of truth is born" });
  return null;
}

/** sameBody(a, b) — the regeneration round-trip's own comparison: byte
 * equality of the canonical JSON, which the deterministic seal makes a real
 * check. */
export function sameBody(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * materialHash(text) — sha-256 hex over the received bytes, via the
 * platform's own crypto (no import; works in Node ≥ 18 and the page alike).
 * Async because subtle is; the seal takes the RESULT, so the kernel's
 * synchronous surface stays synchronous.
 */
export async function materialHash(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── A3.3: the two artifacts that already exist, grandfathered ────────────
// EOExperiencePrior@1 and EORhythmPrior@1 already satisfy Artifact@1's
// shape minus the `dropped` field; they gain the field and the seal here —
// they are NOT rebuilt. The body IS the prior object, unchanged, which is
// what makes the sealed-path byte-identity check (spec step 2's set-down) a
// real one. experience-priors.js's own contract line — "nothing from the
// target enters the prior; memory is never witness" — is A4.1 already
// stated, cited as this spec's precedent, not replaced; the conformance
// below checks exactly that triple mechanically before the seal is allowed.

// S12: what each prior's build DROPPED — declared at seal time, because
// that is where consumers' collapses come from (the POS-prior collapse is
// the measured precedent: the superposition survived, the variable that
// would collapse it did not, and the first consumer collapsed it globally).
const EXPERIENCE_PRIOR_DROPPED = freeze([
  "the raw graph entries and turn history of each completed reading — only per-key aggregates (occurrences, workSupport, workRate, sourceRefs) survive",
  "per-edge witnesses and byte spans — a remembered relation form cannot be walked back to the sentences that taught it",
  "terrain state beyond per-work membership — WHICH encounters lit a terrain is gone; only that a work did survives",
  "every geometric-tier quantity of the readings (activation, presence, margins) — dropped by law (A1.1), not by accident",
]);
const RHYTHM_PRIOR_DROPPED = freeze([
  "which referent produced each gap — the histogram pools every admitted being's inter-mention gaps",
  "mention ids and read positions — only gap lengths and their per-work support survive",
  "every geometric-tier quantity of the readings (activation, presence, margins) — dropped by law (A1.1), not by accident",
]);

// The atmosphere assembly's own conformance over a prior it is about to
// seal (A3.1's precondition, run here so the seal cannot be reached around
// it). Mechanical restatements of the modules' own contract lines.
function priorConformance(prior, schema) {
  const checks = [];
  const failures = [];
  const check = (name, ok) => { checks.push(name); if (!ok) failures.push(name); };
  check(`schema is ${schema}`, prior?.schema === schema);
  check("giver named", typeof prior?.giver === "string" && prior.giver.length > 0);
  check("memory is never witness — standing defeasible_experience_prior, witnessed false, admissible false", prior?.standing === "defeasible_experience_prior" && prior?.witnessed === false && prior?.admissible === false);
  check("target excluded — provenance.targetExcluded", prior?.provenance?.targetExcluded === true);
  check("sourceRefs non-empty and sourceCount agrees with them", Array.isArray(prior?.sourceRefs) && prior.sourceRefs.length > 0 && prior.sourceCount === prior.sourceRefs.length);
  return { passed: failures.length === 0, checks, failures };
}

export function sealExperiencePrior(prior, { producer, material, regime, sealedAtSequence, dropped = EXPERIENCE_PRIOR_DROPPED } = {}) {
  const conformance = priorConformance(prior, "EOExperiencePrior@1");
  if (!conformance.passed)
    throw new TypeError(`sealExperiencePrior: the producing assembly's own conformance failed (${conformance.failures.join("; ")}) — an unsealed projection is scratch and may not cross a boundary (A3.1)`);
  return sealArtifact({ kind: "ExperiencePrior@1", producer, material, regime, dropped: [...dropped], body: prior, sealedAtSequence, conformance });
}

export function sealRhythmPrior(prior, { producer, material, regime, sealedAtSequence, dropped = RHYTHM_PRIOR_DROPPED } = {}) {
  const conformance = priorConformance(prior, "EORhythmPrior@1");
  if (!conformance.passed)
    throw new TypeError(`sealRhythmPrior: the producing assembly's own conformance failed (${conformance.failures.join("; ")}) — an unsealed projection is scratch and may not cross a boundary (A3.1)`);
  return sealArtifact({ kind: "RhythmPrior@1", producer, material, regime, dropped: [...dropped], body: prior, sealedAtSequence, conformance });
}
