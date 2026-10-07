import { eoOperation, deltaFold } from "../../kernel/fold.js";
import { stampDelta } from "../../kernel/assembly.js";
import { deriveIdentityRevision } from "../../kernel/identity.js";
import { expectation, openExpectation, expectationTransition } from "../../kernel/expectations.js";
import {
  descriptorOccurrence,
  directDescriptorOccurrences,
  descriptorHypotheses, descriptorHypothesesWith,
} from "./individuation.js";
import {
  appositionalDescriptorBindings,
  projectDiscourseReferents,
  projectDiscourseReferentsWith,
} from "./discourse-referents.js";
import { textIdentityEvidence } from "./identity-evidence.js";
import { idSetOf, entriesBySchema } from "../../kernel/fold.js";
import { identityEvidenceFromAnchors } from "./anchoring.js";

// The fold's id set is a chain view (kernel) — O(delta) per encounter.
// The view's Set is SHARED state, so local admissions overlay it rather
// than mutating it.
const existingIds = (fold) => {
  const base = idSetOf(fold?.graphEntries ?? []);
  const added = new Set();
  return { has: (id) => base.has(id) || added.has(id), add: (id) => added.add(id) };
};

/**
 * Convert witnessed text structure into warranted EO change.
 *
 * Repeated descriptor strings no longer become referents merely by recurrence.
 * Recurrence earns an identity hypothesis. Actual descriptor-derived referents
 * require contextual occurrence-level support (currently explicit apposition).
 * This prevents every use of "the creature" or "the fiend" from collapsing
 * globally while preserving each witnessed occurrence and hypothesis.
 */
export async function reviseTextFold({ observations = [], fold = {}, canonicalizationFloor = undefined, assembly = null } = {}) {
  const known = existingIds(fold);
  const operations = [];
  const newDescriptorOccurrences = [];
  const currentGraphEntries = [];
  const identitySupports = [];
  const identityAttacks = [];
  const admittedReferents = []; // Bharata: a being admitted opens an anticipation
  const referencedThisTurn = new Set(); // Bharata: a being referenced fulfills one

  const admitGraphObject = (value, { op = "INS", grain = "Ground", witness = null, consequence = null } = {}) => {
    if (!value?.id || known.has(value.id)) return false;
    known.add(value.id);
    currentGraphEntries.push(value);
    operations.push(eoOperation({
      op,
      grain,
      witness,
      outputs: [value.id],
      consequence,
      payload: { action: "graph-object", value },
    }));
    return true;
  };

  const admitOccurrence = (occurrence, witnessRef) => {
    if (!occurrence || !admitGraphObject(occurrence, {
      op: "INS",
      grain: "Ground",
      witness: witnessRef,
      consequence: { kind: "referent_occurrence_witnessed", occurrence: occurrence.id },
    })) return;
    newDescriptorOccurrences.push(occurrence);
  };

  for (const observation of observations) {
    const witnessRef = observation?.id ?? observation?.witness ?? null;
    const encounterRef = observation?.provenance?.source != null
      ? `${observation.provenance.source}:${observation.anchor?.start ?? observation.id ?? "?"}`
      : observation?.id ?? "unknown";

    const identity = textIdentityEvidence(observation?.witness, {
      alternatives: fold?.unresolvedAlternatives ?? [],
      witness: witnessRef,
    });
    identitySupports.push(...identity.supports);
    identityAttacks.push(...identity.attacks);

    for (const occurrence of directDescriptorOccurrences(observation?.witness, { encounterRef })) {
      admitOccurrence(occurrence, witnessRef);
    }

    const discourse = appositionalDescriptorBindings(observation?.witness, {
      encounterRef,
      witness: witnessRef,
    });
    for (const occurrence of discourse.occurrences) admitOccurrence(occurrence, witnessRef);
    for (const link of discourse.links) {
      admitGraphObject(link, {
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        consequence: { kind: "discourse_identity_supported", link: link.id },
      });
    }

    for (const entry of observation?.graphEntries ?? []) {
      currentGraphEntries.push(entry);
      if (entry?.referent) referencedThisTurn.add(entry.referent);
      if (entry?.referentId) referencedThisTurn.add(entry.referentId);
      if (entry?.schema !== "EOReferent@1" || !entry.id || known.has(entry.id)) continue;
      known.add(entry.id);
      admittedReferents.push(entry.id); // Bharata: a new being — anticipation opens
      // WHAT FED IT, RECORDED WHERE IT IS KNOWN (P160).
      //
      // A paradigm has a single address linked to all the things that fed it.
      // Measured before this: a referent reached exactly ONE thing — itself.
      // Fifteen EOMention@1 entries pointed AT `ref:auto:french`, each
      // carrying real byte offsets; the referent pointed at none of them. The
      // links only ran upward, so going DOWN from a referent meant scanning
      // the whole log, and the reverse index that made that bearable was a
      // substitute for links that should have existed.
      //
      // They cost nothing to record. At this instant the observation that
      // produced the referent is in hand, and the mentions inside it already
      // name it. `inputs` is a declared field on every operation and was
      // being left empty while `outputs` was filled — the lineage was
      // half-written, in the direction that cannot be walked.
      const fedBy = (observation?.graphEntries ?? [])
        .filter((x) => x?.id && x.id !== entry.id && (x.referent === entry.id || (x.referentId === entry.id)))
        .map((x) => x.id);
      operations.push(eoOperation({
        op: "INS",
        grain: "Figure",
        witness: witnessRef,
        inputs: fedBy,
        outputs: [entry.id],
        consequence: { kind: "referent_admitted", ref: entry.id },
        payload: { action: "graph-object", value: fedBy.length ? { ...entry, fedBy: Object.freeze(fedBy) } : entry },
      }));
    }

    for (const edge of observation?.hyperedges ?? []) {
      if (edge?.schema !== "EOHyperedge@1") continue;
      currentGraphEntries.push(edge);
      for (const participant of edge.participants ?? []) {
        if (participant?.ref) referencedThisTurn.add(participant.ref);
        admitOccurrence(descriptorOccurrence(participant, {
          encounterRef: edge.meta?.encounterRef ?? encounterRef,
          edge,
        }), witnessRef);
      }
      if (!edge.id || known.has(edge.id)) continue;
      known.add(edge.id);
      operations.push(eoOperation({
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        inputs: (edge.participants ?? []).map((participant) => participant.ref).filter(Boolean),
        outputs: [edge.id],
        consequence: { kind: "relation_witnessed", edge: edge.id },
        payload: { action: "hyperedge", value: edge },
      }));
    }
  }

  // Only what this sentence could have changed (individuation.js, `changedOnly`): the walk below admits unknown ids and skips known ones, and an untouched group's hypothesis was offered when it last changed.
  for (const hypothesis of descriptorHypothesesWith(fold?.graphEntries ?? [], newDescriptorOccurrences, { changedOnly: true })) {
    if (known.has(hypothesis.id)) continue;
    known.add(hypothesis.id);
    operations.push(eoOperation({
      op: "CON",
      grain: "Figure",
      inputs: [...hypothesis.occurrenceRefs],
      outputs: [hypothesis.id],
      consequence: { kind: "identity_hypothesis_opened", hypothesis: hypothesis.id },
      payload: { action: "provisional", value: hypothesis },
    }));
  }

  // THE FOLD'S OWN ARRAY, NOT A SPREAD OF IT (P157). A fresh array literal
  // carries no delta link, so the incremental view could never walk back and
  // recomputed over the entire fold every sentence — measured at zero hits in
  // 3,392 calls. This is the same shape `descriptorHypothesesWith` above uses,
  // and for the same reason.
  for (const referent of projectDiscourseReferentsWith(fold?.graphEntries ?? [], currentGraphEntries)) {
    if (known.has(referent.id)) continue;
    admitGraphObject(referent, {
      op: "INS",
      grain: "Figure",
      consequence: {
        kind: "contextual_referent_admitted",
        ref: referent.id,
        defeasibleBy: ["SEG", "DEF", "REC"],
      },
    });
  }

  // Descriptor-anchoring evidence (anchoring.js), witnessed through the
  // ordinary perception -> witness path as EOAnchorEvidence@1 entries, joins
  // the SAME support/attack grammar apposition already feeds — one
  // identity-revision door, not a second mechanism.
  const anchors = observations.flatMap((o) => (o?.graphEntries ?? []).filter((x) => x?.schema === "EOAnchorEvidence@1"));
  if (anchors.length) {
    const anchorEvidence = identityEvidenceFromAnchors(anchors, fold);
    identitySupports.push(...anchorEvidence.supports);
    identityAttacks.push(...anchorEvidence.attacks);
  }

  // THE FOLD'S OWN ARRAY, NOT A SPREAD OF IT (P157, a third time): the edge
  // index rides the fold's delta stream; this sentence's admissions go in
  // beside it as `extraEntries` and are scanned after it, in their order.
  const identityDelta = deriveIdentityRevision({
    fold,
    extraEntries: currentGraphEntries,
    supports: identitySupports,
    attacks: identityAttacks,
    canonicalizationFloor,
  });
  operations.push(...identityDelta.operations);

  // ── BHARATA (the felt — the rasa cycle, fed for real). A being admitted
  // opens an anticipation (tension builds); a being referenced again fulfils
  // its open anticipation (a release lands). This is what proves the fold's
  // expectations are no longer Object.freeze([]) by construction — the
  // reader's own recurrence is the felt. (prove-felt.mjs named the gap;
  // dynamics.js reads both obligations and expectations now.)
  const OPEN_X = new Set(["open", "strengthened", "weakened"]);
  const priorExpectations = fold?.expectations ?? [];
  for (const exp of priorExpectations) {
    if (exp?.schema !== "EOExpectation@1" || !OPEN_X.has(exp.state)) continue;
    const ref = exp?.scope?.ref ?? exp?.grounds?.[0];
    if (ref && referencedThisTurn.has(ref)) {
      operations.push(expectationTransition(exp, "fulfilled", { witness: "bharata:recurrence", consequence: { kind: "anticipation_fulfilled", ref } }));
    }
  }
  for (const ref of admittedReferents) {
    const exp = expectation({ id: `exp:recur:${ref}`, hypothesis: `${ref} recurs`, giver: "bharata", grounds: [ref], scope: { ref }, openedAt: (fold?.sequence ?? 0) + 1, state: "open" });
    operations.push(openExpectation(exp, { witness: "bharata:admitted", consequence: { kind: "anticipation_opened", ref } }));
  }

  // A5.1 (assemblies spec) — stamped WHERE THE DELTA IS BUILT: when the
  // caller names the producing assembly, every operation of this delta
  // carries provenance.assembly. Opt-in, byte-identical when absent — the
  // descriptorAnchoring precedent, applied to provenance.
  const delta = deltaFold(operations);
  return assembly ? stampDelta(delta, assembly) : delta;
}
