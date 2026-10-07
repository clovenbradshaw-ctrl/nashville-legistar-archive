/* Xushen speaks:
 * “It was the collection of Li-sst, controlled, amended, explained and classified 
under 540 rational keys.”
 *
 * `
 * This file implements Xushen's lexicon: the first dictionary built from attested character usage rather than decree.  It represents the foundational principles of a dictionary,  grounded in the living linguistic practice of language users, as opposed to arbitrary decree. 
 * `
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/lexicon.js — the reading's dictionary, PROJECTED FROM THE LOG.
// Handle: Xushen — after the Shuowen Jiezi, the first dictionary built from attested character usage rather than decree. Amendment XVII.
//
// Not a second store, and not a read of the live Fold: the append-only witness
// log is the reality, and the lexicon is one projection of it — the same
// discipline the store lineage already states ("the log is truth, projection
// is convenience"; "the reality should be the event stream, the current state
// always projected"). Consequences that follow from that and would not follow
// from reading a Fold snapshot:
//
//   - CURSOR-SCRUBBABLE. `projectLexicon(log, { atSeq })` answers "what did
//     this reading know as of encounter N", for any N, because it replays the
//     prefix rather than reporting a present. A dictionary you cannot ask
//     about the past is a snapshot wearing a dictionary's clothes.
//   - RECONSTRUCTIBLE FROM THE RECORD ALONE. Nothing here needs a live reader;
//     hand it a serialized log and the same lexicon comes back.
//   - EVERY HEADWORD CARRIES ITS ADMISSION. A word is not "in the dictionary"
//     because it exists — it is there because some operation, at some
//     encounter, admitted it, and that operation's id/operator/witness rides
//     the entry. Nothing enters unattributed.
//
// TERRAIN-ORGANIZED, using the engine's own nine-cell grid rather than a shape
// invented here — Existence (Void/Entity/Kind), Structure (Field/Link/Network),
// Interpretation (Atmosphere/Lens/Paradigm). Terrain assignment is
// terrain-state.js's `terrainOf` (an entry's declared terrain, or its own
// operator×grain cell), never a guess from content.
//
// EMPTY CELLS ARE REPORTED, NOT HIDDEN. A terrain with nothing in it is a
// fact about this reading, and the lexicon says which mechanism would have
// filled it. That is the difference between "this book has no paradigms" and
// "nothing in this assembly computes paradigms."

import { reconstruct } from "./fold.js";
import { TERRAINS, terrainOf, projectTerrainState, terrainCounts } from "./terrain-state.js";
import { projectEmergentTerrains, mergeTerrainStates } from "./emergent-terrain.js";

const freeze = (value) => Object.freeze(value);
const stable = (values = []) => freeze([...new Set(Array.from(values ?? []).filter(Boolean))].sort());

// Which mechanism fills each terrain — so an empty cell can say why.
const FILLED_BY = freeze({
  Void: "refusals and typed gaps (exclusions, unresolved alternatives)",
  Entity: "admitted referents and their occurrences (perceiver + revision)",
  Kind: "kind induction over the admitted population (kind-induction.js)",
  Field: "scope projections over relation edges (emergent-terrain.js)",
  Link: "witnessed relation edges (perceiver's SVO extraction)",
  Network: "relation network components (emergent-terrain.js)",
  Atmosphere: "interpretive atmosphere factor field (atmosphere-math.js)",
  Lens: "focused readings of one passage against a claim",
  Paradigm: "paradigm projections surviving upward propagation",
});

const encounterOf = (entry) => {
  const witness = String(entry?.witness ?? entry?.id ?? "");
  const fromText = /(?:^|:)text:(\d+)/.exec(witness) ?? /^text:(\d+)/.exec(witness);
  if (fromText) return Number(fromText[1]);
  const fromMention = /^mention:(\d+):/.exec(String(entry?.id ?? ""));
  if (fromMention) return Number(fromMention[1]);
  const fromEdge = /^edge:text:(\d+):/.exec(String(entry?.id ?? ""));
  return fromEdge ? Number(fromEdge[1]) : null;
};

/**
 * Walk the log once and record, for every graph object id, the operation that
 * admitted it: which operator, at which encounter, on whose witness. This is
 * what makes a headword attributable rather than merely present.
 */
function admissionIndex(entries = []) {
  const byId = new Map();
  let encounter = null;
  for (const entry of entries) {
    if (entry?.schema === "Encounter@1") { encounter = entry.sequencePosition ?? encounter; continue; }
    if (entry?.schema !== "DeltaFold@1") continue;
    for (const operation of entry.operations ?? []) {
      const value = operation?.payload?.value;
      const ids = [...(operation.outputs ?? []), ...(value?.id ? [value.id] : [])];
      for (const id of ids) {
        if (!id || byId.has(id)) continue; // FIRST admission — later ops revise, they do not re-admit
        byId.set(id, freeze({
          operator: operation.operator ?? null,
          grain: operation.grain ?? null,
          action: operation.payload?.action ?? null,
          consequence: operation.consequence?.kind ?? null,
          witness: operation.witness ?? null,
          encounter,
        }));
      }
    }
  }
  return byId;
}

const headword = (entry, admissions) => freeze({
  id: entry.id,
  schema: entry.schema,
  display: entry.display ?? entry.surface ?? entry.relation ?? entry.canonicalSurface ?? entry.id,
  surfaces: stable(entry.surfaces ?? (entry.surface ? [entry.surface] : [])),
  standing: entry.standing ?? entry.state ?? entry.status ?? null,
  admittedBy: admissions.get(entry.id) ?? null,
  firstSeenAt: admissions.get(entry.id)?.encounter ?? encounterOf(entry),
});

/**
 * The reading's dictionary as of a cursor.
 *
 * @param {Array} log the reader's own append-only event log (getLog())
 * @param {object} [options]
 * @param {number} [options.atSeq] replay only the first N log entries — the
 *   lexicon as of that point in the reading. Omitted: the whole log.
 * @param {number} [options.perTerrain] headwords listed per terrain (the
 *   COUNT is always complete; this bounds only what is enumerated).
 */
export function projectLexicon(log = [], { atSeq = null, perTerrain = 25, seed = {} } = {}) {
  if (!Array.isArray(log)) throw new TypeError("projectLexicon requires the reader's log array");
  if (atSeq != null && (!Number.isInteger(atSeq) || atSeq < 0)) throw new TypeError("atSeq, when declared, is a non-negative integer log index");
  const entries = atSeq == null ? log : log.slice(0, atSeq);

  // THE PROJECTION: replay the log into a fold, then read terrains off it.
  const fold = reconstruct(entries, seed);
  const admissions = admissionIndex(entries);

  const declared = projectTerrainState(fold);
  const emergent = projectEmergentTerrains(fold);
  const state = mergeTerrainStates(declared, emergent);

  const terrains = {};
  for (const terrain of TERRAINS) {
    const items = state[terrain] ?? [];
    terrains[terrain] = freeze({
      terrain,
      count: items.length,
      filledBy: FILLED_BY[terrain] ?? null,
      empty: items.length === 0,
      // An empty cell states which mechanism would have filled it — the
      // difference between "the book has none" and "nothing computes these".
      absence: items.length === 0 ? `no entries — this terrain is filled by ${FILLED_BY[terrain] ?? "no wired mechanism"}` : null,
      headwords: freeze(items.slice(0, perTerrain).map((entry) => headword(entry, admissions))),
    });
  }

  // Referents get their own enumeration: they are the small semantic subset
  // of Entity a reader can actually address, and the thing a person opening a
  // dictionary of a book is usually looking for.
  const referents = (fold.graphEntries ?? [])
    .filter((entry) => entry?.schema === "EOReferent@1")
    .map((entry) => freeze({
      ...headword(entry, admissions),
      mentions: (fold.graphEntries ?? []).filter((x) => x?.schema === "EOMention@1" && x.referent === entry.id).length,
    }))
    .sort((a, b) => b.mentions - a.mentions);

  // Relations are the Link vocabulary in the form a reader wants it: form,
  // how often witnessed, and whether it is eligible as portable memory.
  const relationCounts = new Map();
  for (const entry of fold.graphEntries ?? []) {
    if (entry?.schema !== "EOHyperedge@1" || !entry.relation) continue;
    if (!relationCounts.has(entry.relation)) relationCounts.set(entry.relation, { relation: entry.relation, witnessed: 0, eligible: entry.meta?.compositionStanding?.eligible !== false, dominantClass: entry.meta?.compositionStanding?.dominantClass ?? null });
    relationCounts.get(entry.relation).witnessed += 1;
  }
  const relations = [...relationCounts.values()].sort((a, b) => b.witnessed - a.witnessed).map(freeze);

  return freeze({
    schema: "EOLexicon@1",
    projectedFrom: freeze({
      logEntries: entries.length,
      ofTotal: log.length,
      atSeq,
      encounters: entries.filter((e) => e?.schema === "Encounter@1").length,
      basis: "replayed from the append-only witness log via reconstruct(); not read from a live Fold",
    }),
    counts: terrainCounts(state),
    admissions: admissions.size,
    terrains: freeze(terrains),
    referents: freeze(referents.slice(0, perTerrain)),
    referentCount: referents.length,
    relations: freeze(relations.slice(0, perTerrain)),
    relationCount: relations.length,
  });
}

/**
 * The same dictionary at several cursors — how the reading's knowledge grew.
 * Cursors are log indices; a reader that knows more later should show it.
 */
export function lexiconTrajectory(log = [], { cursors = [], perTerrain = 5 } = {}) {
  return freeze(cursors.map((atSeq) => {
    const lexicon = projectLexicon(log, { atSeq, perTerrain });
    return freeze({
      atSeq,
      encounters: lexicon.projectedFrom.encounters,
      counts: lexicon.counts,
      referentCount: lexicon.referentCount,
      relationCount: lexicon.relationCount,
    });
  }));
}
