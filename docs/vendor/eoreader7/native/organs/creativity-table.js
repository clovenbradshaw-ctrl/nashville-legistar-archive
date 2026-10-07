// organs/creativity-table.js — THE PERIODIC TABLE OF CREATIVITY, as data.
// Three axes, 3×3×3 = 27 positions. Every span of an artifact is a cell in
// this table, and — because the pipeline records PROVENANCE — its position is
// CATEGORIZED, not guessed: where a span came from decides which cell it is.
//
//   GRAIN       (the scale):  Ground (Void) · Figure (Being) · Pattern (Fold)
//   PHASE       (the moment): Formation · Structure · Interpretation
//   DERIVATION  (the source): Reproduce · Derive · Invent   ← the plagiarism
//                              spectrum, measurable from provenance
//
// The nine archons hold the nine phase×grain cells, each across the whole
// derivation axis. Marshall is in charge of the whole table (the law that
// refuses kitsch); Wilson (REC) drives the climb Reproduce → Invent; Chekhov
// guards the prose's honesty in every cell.
//
// Cosmogeny — not cosmology — is the apex: the story of a world's
// coming-into-being, not a finished map of one that already is.

export const GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);
export const PHASES = Object.freeze(["Formation", "Structure", "Interpretation"]);
export const DERIVATIONS = Object.freeze(["Reproduce", "Derive", "Invent"]);

export const ARCHONS = Object.freeze({
  "Ground|Formation": "Diaconis", "Figure|Formation": "Holmes", "Pattern|Formation": "Frankfurt",
  "Ground|Structure": "Dijkstra", "Figure|Structure": "Ostrom", "Pattern|Structure": "Alexander",
  "Ground|Interpretation": "Feynman", "Figure|Interpretation": "Pearl", "Pattern|Interpretation": "Wilson",
});

export const CELLS = Object.freeze({
  // Reproduce
  "Ground|Formation|Reproduce": "Echo",      "Ground|Structure|Reproduce": "Scaffold",      "Ground|Interpretation|Reproduce": "Doctrine",
  "Figure|Formation|Reproduce": "Facsimile", "Figure|Structure|Reproduce": "Cast",          "Figure|Interpretation|Reproduce": "Caricature",
  "Pattern|Formation|Reproduce": "Genre",    "Pattern|Structure|Reproduce": "Convention",   "Pattern|Interpretation|Reproduce": "Orthodoxy",
  // Derive
  "Ground|Formation|Derive": "Hypothesis",   "Ground|Structure|Derive": "Frame",            "Ground|Interpretation|Derive": "Reframe",
  "Figure|Formation|Derive": "Mutant",       "Figure|Structure|Derive": "Constellation",    "Figure|Interpretation|Derive": "Portrait",
  "Pattern|Formation|Derive": "Variation",   "Pattern|Structure|Derive": "Composition",     "Pattern|Interpretation|Derive": "Reading",
  // Invent
  "Ground|Formation|Invent": "Void",         "Ground|Structure|Invent": "Axiom",            "Ground|Interpretation|Invent": "Thesis",
  "Figure|Formation|Invent": "Being",        "Figure|Structure|Invent": "Invention",        "Figure|Interpretation|Invent": "Legend",
  "Pattern|Formation|Invent": "Paradigm",    "Pattern|Structure|Invent": "System",          "Pattern|Interpretation|Invent": "Cosmogeny",
});

export function cellOf({ grain, phase, derivation }) {
  const key = `${grain}|${phase}|${derivation}`;
  return { grain, phase, derivation, name: CELLS[key] ?? null, archon: ARCHONS[`${grain}|${phase}`] ?? null };
}

/** The artifact's OWN cell: it is a SYNTHESIS (Pattern × Structure = Alexander), and its derivation is read off its provenance. */
export function artifactCell(derivation) {
  return cellOf({ grain: "Pattern", phase: "Structure", derivation });
}
