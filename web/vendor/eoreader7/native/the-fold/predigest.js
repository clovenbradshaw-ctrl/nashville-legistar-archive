// predigest.js — compile the priors once; load the compact result forever.
//
// THE ASK, near-verbatim (2026-08-28): get the fold and eoreader7 to
// leverage all the priors as well as possible, "whether it's predigesting or
// what." The engine already knows how to sediment a completed reading into
// bounded, portable memory (eoreader7 native/kernel/experience-priors.js —
// WHICH structures recur — and rhythm-priors.js — WHEN a being returns),
// and its own merge discipline is built for exactly this ("fold several
// already-derived priors into one... without ever revisiting the raw
// readings that produced them; after that the raw reading is eligible for
// garbage collection"). What was missing was not a mechanism but a
// PERSISTENCE DISCIPLINE: the engine's own experienced-new-book driver
// spends ~40 minutes reading prior works and discards every sedimented
// prior at process exit. Predigesting is that run kept: read the prior
// corpus ONCE, sediment each work the moment it finishes, merge, and write
// the compact result — with its corpus manifest and giver — so every later
// question loads compiled memory instead of re-reading the shelf. This is
// P30's efficiency law aimed at priors: a work already sedimented costs
// nothing to carry; re-reading it every session is compute spent reducing
// zero uncertainty.
//
// PURE, organs injected (the cast.js pattern): the engine's derive/merge/
// compose organs arrive as arguments, so the page could load them from a
// mount and the tests load them by relative path (`../...`
// — the same sibling import consequence.test.mjs already proves works in
// this environment). No fs, no fetch, no model call anywhere in this file;
// the corpus walk and the file writes belong to the driver
// (eval/predigest-priors.mjs), the same split web.js/explore-server.mjs
// already holds.
//
// WHAT A COMPILED ARTIFACT IS, honestly: defeasible experience with its
// receipts. Every half keeps the engine's own standing triple
// (`defeasible_experience_prior` / witnessed: false / admissible: false) —
// compiling does not promote; memory is never witness for the next source.
// The artifact's `received` section MANIFESTS the received priors available
// beside it (schema, giver, path) rather than copying their bytes — a
// pointer with a giver, so "all the priors" is an inventory a loader can
// walk, never a second copy that could drift from the file on disk.
//
// assertionEdges() is the other door: the-fold's own hyperlexicon
// (hyperlexicon.js, P57 — what this instrument has READ, as an EOT log)
// projected into the engine's edge shape, so a reaction substrate
// (eoreader7 native/kernel/reaction.js) can mechanically reason over what
// the instrument has heard. ENDPOINT IDENTITY IS DISCLOSED, not smuggled:
// an assertion's ends are the assertion log's own normalized-string
// identities (assertionId's fold, reused — one implementation), NOT
// cast.js referent identity; that is the standing referent-model residue
// P23/P30 already name, carried on every participant as
// `identity: "assertion-log"` so no downstream reader can mistake it for
// an earned coreference.

import { assertionId } from "../organs/index.js";

export const COMPILED_SCHEMA = "EOCompiledPriors@1";

const freeze = (v) => Object.freeze(v);
const normalizeEnd = (v) => String(v ?? "").trim().toLowerCase();

/**
 * sedimentReading({ source, reading }, { giver, organs }) — one completed
 * reading into its two portable halves, the moment it finishes, so the raw
 * reading can be dropped. Id conventions match the engine's own driver
 * (`experience:<source>` / `rhythm:<source>`), kept in one place instead of
 * re-typed per driver.
 */
export function sedimentReading({ source, reading }, { giver, organs } = {}) {
  if (!giver) throw new TypeError("sedimentReading requires a named giver");
  if (!organs?.deriveExperiencePrior || !organs?.deriveRhythmPrior) throw new TypeError("sedimentReading requires the engine organs { deriveExperiencePrior, deriveRhythmPrior } injected");
  const item = { source, reading };
  return freeze({
    source,
    which: organs.deriveExperiencePrior([item], { giver, id: `experience:${source}` }),
    when: organs.deriveRhythmPrior([item], { giver, id: `rhythm:${source}` }),
  });
}

/**
 * compilePriors(sedimented, { giver, corpus, received, organs }) — merge the
 * per-work halves into one carried bundle and wrap it with its receipts.
 *
 *   corpus    the manifest of what was read: [{ source, path, encounters,
 *             capped }] — declared budgets stated, never hidden (the
 *             engine driver's own posture: "prefix lengths are a runtime
 *             budget, stated not hidden").
 *   received  the inventory of received priors available beside this
 *             artifact: [{ schema, giver, path }] or typed gaps
 *             ({ gap, detail }) for priors this checkout does not carry —
 *             an absence is named, never silently dropped.
 */
export function compilePriors(sedimented = [], { giver, corpus = [], received = [], organs } = {}) {
  if (!giver) throw new TypeError("compilePriors requires a named giver");
  if (!organs?.mergeExperiencePriors || !organs?.mergeRhythmPriors || !organs?.composeExperience) throw new TypeError("compilePriors requires the engine organs { mergeExperiencePriors, mergeRhythmPriors, composeExperience } injected");
  if (!sedimented.length) throw new TypeError("compilePriors requires at least one sedimented reading");
  const experience = organs.mergeExperiencePriors(sedimented.map((s) => s.which), { giver, id: "experience:compiled" });
  const rhythm = organs.mergeRhythmPriors(sedimented.map((s) => s.when), { giver, id: "rhythm:compiled" });
  const composed = organs.composeExperience({ experience, rhythm, giver, id: "reader-experience:compiled" });
  return freeze({
    schema: COMPILED_SCHEMA,
    giver,
    sourceCount: composed.sourceCount,
    corpus: freeze(corpus.map((row) => freeze({ ...row }))),
    received: freeze(received.map((row) => freeze({ ...row }))),
    composed,
    provenance: freeze({
      giver,
      basis: "prior corpus read to completion and sedimented per work; halves merged by the engine's own union-of-sourceRefs discipline (exact against deriving from every raw reading at once); raw readings dropped",
      targetExcluded: true,
    }),
  });
}

/**
 * loadCompiledPriors(json) — the walls a compiled artifact must clear
 * before anything carries it. Refusals are typed, never silent: a loader
 * that would carry an unlabelled bundle as experience is exactly the
 * unearned-prior shape the giver test exists to refuse.
 */
export function loadCompiledPriors(json) {
  if (json?.schema !== COMPILED_SCHEMA) return { refused: { type: "wrong_schema", detail: `expected ${COMPILED_SCHEMA}, got ${JSON.stringify(json?.schema)}` } };
  if (!json.giver) return { refused: { type: "no_giver", detail: "a compiled prior with no giver is an unearned prior — refused at the door" } };
  const composed = json.composed;
  if (composed?.schema !== "EOReaderExperience@1") return { refused: { type: "no_composed_experience", detail: "the artifact carries no EOReaderExperience@1 bundle" } };
  if (composed.experience && composed.experience.schema !== "EOExperiencePrior@1") return { refused: { type: "malformed_half", detail: "experience half is not an EOExperiencePrior@1" } };
  if (composed.rhythm && composed.rhythm.schema !== "EORhythmPrior@1") return { refused: { type: "malformed_half", detail: "rhythm half is not an EORhythmPrior@1" } };
  return {
    refused: null,
    giver: json.giver,
    corpus: json.corpus ?? [],
    received: json.received ?? [],
    composed,
    experience: composed.experience ?? null,
    rhythm: composed.rhythm ?? null,
  };
}

/**
 * assertionEdges(assertions, { hyperedge, source }) — the-fold hyperlexicon's
 * folded assertions, projected into the engine's own EOHyperedge@1 shape so
 * a reaction substrate can hold them.
 *
 * The witness is the assertion's FIRST byte-addressed span (`ref#a-b` — the
 * address shape this repo's refs already use); the full span and witness
 * lists ride meta. A spanless row is SKIPPED WITH ITS REASON, never emitted
 * witness-less — the same UNADDRESSED wall the admission door already
 * holds, applied again at the projection because a caller may hand this
 * function rows that never went through the door.
 */
export function assertionEdges(assertions = [], { hyperedge, source = null } = {}) {
  if (typeof hyperedge !== "function") throw new TypeError("assertionEdges requires the engine's hyperedge constructor injected");
  const edges = [];
  const skipped = [];
  for (const row of assertions) {
    const at = row?.spans?.[0]?.at ?? null;
    if (!at) { skipped.push({ assertion: row?.id ?? null, reason: "unaddressed", detail: "no byte-addressed span backs it" }); continue; }
    const subject = normalizeEnd(row.subject);
    const object = normalizeEnd(row.object);
    if (!subject || !object || !row.verb) { skipped.push({ assertion: row?.id ?? null, reason: "incomplete", detail: "an assertion needs two ends and something between them" }); continue; }
    edges.push(hyperedge({
      id: `assertion:${row.id ?? assertionId(row.subject, row.verb, row.object)}`,
      relation: row.verb,
      participants: [
        { ref: subject, standing: "referent", identity: "assertion-log", display: row.subject, role: null },
        { ref: object, standing: "referent", identity: "assertion-log", display: row.object, role: null },
      ],
      witness: at,
      meta: {
        source,
        assertion: row.id ?? null,
        witnesses: [...(row.witnesses ?? [])],
        spans: (row.spans ?? []).map((s) => s.at),
      },
    }));
  }
  return { edges, skipped };
}
