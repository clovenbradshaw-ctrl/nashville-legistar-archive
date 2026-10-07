// native/kernel/terrain-activation.js — the reach of the present, per terrain.
// Handle: Hubel — after the receptive field: the reach of the present moment is local and bounded, like a cortical neuron's patch of the visual field. Amendment XVII.
//
// P1: activation is the reach of the present, not the size of memory. This
// organ makes that operational across the nine-cell grid: every proposition,
// as it arrives, LIGHTS the terrains it actually touches — its beings
// (Entity), its arrangements (Link), their co-arrivals (Network), its scope
// (Field), its refusals (Void), its identity events (Lens) — and everything
// lit fades at the reader's own gamma. What is active NOW is small by
// design; folding a proposition in costs O(what this proposition touches),
// never O(everything read). A reader whose per-proposition cost grows with
// the book is re-reading, not reading (READING-SPEC S4).
//
// THE WHEEL (native/docs/THE-WHEEL.md): activation is the SPOKE's reach —
// one hop, the beings' presence; the fold lit at the present is the rim.
//
// This is a different thing from lexicon.js: the lexicon is PERSISTENCE
// projected from the log (identity — never forgets); this is ACTIVATION
// (presence — always fading). P1's table says the reader needs both and
// must never confuse them. `snapshot()` here answers "what is the reading
// holding hot right now, terrain by terrain"; the lexicon answers "what has
// this reading established". Exporting this as "the graph" is the exact
// mistake P6 warns about (119 live edges at Frankenstein's end are the
// present's reach, not the reading's content).
//
// The decay window is MEASURED (dmdWindow — difference that makes a
// difference), or declared with its reason, or explicitly null for the
// undecayed control arm. Never silently defaulted (READING-SPEC S5).
//
// Terrain assignment: an entry that carries its own `terrain` is taken at
// its word; otherwise the entry's SCHEMA names what kind of presence it is —
// a mapping of schemas to cells, not a reading of content (the cube is not
// a content classifier). Unknown schemas are reported, never guessed.

import { createActivation, gammaFor, dmdWindow } from "./activation.js";
import { TERRAINS } from "./terrain-state.js";

const SCHEMA_TERRAIN = Object.freeze({
  "EOReferent@1": "Entity",
  "EOMention@1": "Entity",
  "EOReferentOccurrence@1": "Entity",
  "EOHyperedge@1": "Link",
  "EOCanonicalHyperedge@1": "Link",
  "EOIdentityHypothesis@1": "Lens",
  "EOIdentityAlternative@1": "Lens",
  "EOAnchorEvidence@1": "Lens",
  "EOExclusion@1": "Void",
  "EOReferentGap@1": "Void",
  "EOExpectation@1": "Atmosphere",
  "EOObligation@1": "Atmosphere",
  "EOPatternCandidate@1": "Paradigm",
});

const key = (terrain, id) => `${terrain}\u0000${id}`;

/**
 * createTerrainActivation({ window }) — one decaying presence over
 * (terrain, id) keys. `window` per S5: a number (measured or declared with
 * reason), or null for the disclosed undecayed control.
 *
 * `light(entries)` folds one proposition's own entries in and returns what
 * it lit: { lit: {terrain: [ids]}, unknown: [schemas] } — the per-
 * proposition answer to "which terrains did this touch".
 */
export function createTerrainActivation({ window = undefined } = {}) {
  const activation = createActivation({ window });

  const terrainOfEntry = (entry) => {
    if (entry?.terrain && TERRAINS.includes(entry.terrain)) return entry.terrain;
    return SCHEMA_TERRAIN[entry?.schema] ?? null;
  };

  const light = (entries = []) => {
    const lit = {};
    const unknown = [];
    const keys = [];
    for (const entry of entries) {
      if (!entry?.id) continue;
      const terrain = terrainOfEntry(entry);
      if (!terrain) { if (entry.schema) unknown.push(entry.schema); continue; }
      keys.push(key(terrain, entry.id));
      (lit[terrain] ??= []).push(entry.id);
      // A Link arrangement also lights its ENDS (Entity) and, when both ends
      // are resolved beings, their co-arrival (Network) — presence spreads
      // exactly as far as the proposition itself reaches, one hop, no more.
      if (terrain === "Link" && Array.isArray(entry.participants)) {
        const ends = entry.participants.filter((p) => p?.standing === "referent" && p.ref);
        for (const end of ends) {
          keys.push(key("Entity", end.ref));
          (lit.Entity ??= []).push(end.ref);
        }
        if (ends.length >= 2) {
          const pair = [ends[0].ref, ends[ends.length - 1].ref].sort().join("|");
          keys.push(key("Network", pair));
          (lit.Network ??= []).push(pair);
        }
        if (entry.scope?.sequencePosition != null && entry.meta?.source) {
          const field = `${entry.meta.source}`;
          keys.push(key("Field", field));
          (lit.Field ??= []).push(field);
        }
      }
    }
    activation.observe(keys);
    return { lit, unknown };
  };

  /** The reach of the present, terrain by terrain: ids whose current
   * activation clears `floor` (declared by the caller — how faint still
   * counts as present is not this module's to decide). */
  const present = (floor) => {
    if (!Number.isFinite(floor)) throw new TypeError("terrain-activation: the presence floor is declared — how faint still counts as present is the caller's to say");
    const out = Object.fromEntries(TERRAINS.map((t) => [t, []]));
    const snap = activation.snapshot();
    for (const [k, v] of snap.freq) {
      if (v < floor) continue;
      const cut = k.indexOf("\u0000");
      const terrain = k.slice(0, cut);
      if (out[terrain]) out[terrain].push({ id: k.slice(cut + 1), activation: Number(v.toFixed(3)) });
    }
    for (const t of TERRAINS) out[t].sort((a, b) => b.activation - a.activation);
    return out;
  };

  return Object.freeze({ light, present, gamma: activation.gamma, window, get size() { return activation.size; } });
}

export { gammaFor, dmdWindow };
