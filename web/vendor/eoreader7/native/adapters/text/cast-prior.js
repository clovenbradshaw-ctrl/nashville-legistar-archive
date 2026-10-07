// native/adapters/text/cast-prior.js — a sealed CastLedger@1 entering a NEW
// read as a received prior (ASSEMBLIES-AND-ARTIFACTS.md §4, A4.1; spec
// step 3's consumer half).
//
// A4.1 IS THE WHOLE INTERFACE: an artifact from any other read NOMINATES
// and never admits. Upward (S9), the new material's own tokens set what is
// possible — this prior nominates a remembered referent ONLY where the
// encounter itself attests one of its surfaces (containsSurface — the
// perceiver's own containment reading, imported, never a second copy).
// Downward, the nomination conditions which possible is heard: an attested
// referent arrives as a candidate carrying the encounter's own material as
// its evidence, and the ordinary perceive → witness path decides admission
// exactly as it does for every other candidate (kernel/witness.js: "By
// default a candidate needs explicit evidence anchored to the encounter").
//
// A referent the material does NOT attest is nominated NOWHERE — the
// moment a sealed cast admits a being without fresh witness, the
// descriptor-being admission (levers-RESULTS) has recurred one level up.
// The conformance fixture for that wall is
// conformance/artifact-prior-boundary.test.mjs: an artifact that "knows" a
// being the text lacks admits nothing.
//
// This module is text-tier on purpose (S6): "does this material attest
// this surface" is a medium question, so the kernel holds the artifact and
// the adapter holds the reading of it.

import { containsSurface } from "./recursive.js";
import { producerMismatch } from "../../kernel/artifact.js";

const freeze = (value) => Object.freeze(value);

/** The referents of a sealed cast that THIS text attests, each with the
 * surfaces the text actually shows — exported so the wall is testable
 * without a reader in the loop. */
export function attestedReferents(artifact, text) {
  if (artifact?.kind !== "CastLedger@1") throw new TypeError("attestedReferents requires a sealed CastLedger@1 artifact");
  return freeze((artifact.body?.referents ?? []).flatMap((referent) => {
    const matched = (referent.surfaces ?? []).filter((surface) => containsSurface(text, surface));
    return matched.length ? [freeze({ id: referent.id, surfaces: freeze(matched) })] : [];
  }));
}

/**
 * castLedgerPrior(artifact, { expectedProducer }) — the received-prior
 * object kernel/perception.js consumes: { giver, provenance,
 * applicability, hypotheses }.
 *
 * `expectedProducer` (optional) is A3.2's consumer-side check: pass the
 * assembly { id, version } this read expects the cast to have come from,
 * and a mismatch REFUSES the prior at construction — regenerate, never
 * adapt — instead of quietly conditioning a read on a stale artifact.
 */
export function castLedgerPrior(artifact, { expectedProducer = null } = {}) {
  if (artifact?.schema !== "EOArtifact@1" || artifact.kind !== "CastLedger@1")
    throw new TypeError("castLedgerPrior requires a sealed CastLedger@1 — an unsealed projection is scratch and may not cross a boundary (A3.1)");
  if (expectedProducer) {
    const mismatch = producerMismatch(artifact, expectedProducer);
    if (mismatch) throw new TypeError(`castLedgerPrior: ${mismatch.reason} — ${mismatch.rule}`);
  }
  const giver = `CastLedger@1 sealed by ${artifact.producer.assembly}@${artifact.producer.version} over ${artifact.material.source}`;
  return freeze({
    giver,
    provenance: freeze({
      giver,
      artifact: freeze({ kind: artifact.kind, producer: artifact.producer, material: artifact.material }),
      basis: "A4.1 — a sealed cast from another read nominates and never admits; only surfaces this material itself attests are ever offered, with the encounter's own material as evidence",
    }),
    applicability: (encounter) => encounter?.modality === "text" && typeof encounter.material === "string",
    hypotheses: (encounter) => attestedReferents(artifact, encounter.material).map((attested) => freeze({
      candidate: freeze({
        distinctions: freeze([freeze({ referent: attested.id, surfaces: attested.surfaces })]),
        graphEntries: freeze([freeze({
          schema: "EOReferent@1",
          id: attested.id,
          surfaces: attested.surfaces,
          provenance: freeze([freeze({ giver, tier: "received_prior", basis: "cast-ledger nomination, attested by this encounter's own material" })]),
          fromPrior: true,
        })]),
      }),
      anchor: encounter.anchor,
      evidence: encounter.material,
      perceiver: "text/cast-prior",
    })),
  });
}
