// Handle: Koestler — holon, the whole that is also a part; holarchy, the
//   recursion of such wholes (The Ghost in the Machine). The void is the
//   same structure at every level, named by the modality that reads it.
// organs/void-holarchy.js — the VOID as a HOLARCHY, OMNIMODAL.
//
// The void is not flat, and it does not speak text. A piece has levels, and
// EVERY level is a void: a whole (its own nine-operator DEF) and a part (a
// filler covering an extent in the void one level up). The levels are
// STRUCTURAL — the holon recursion — and the modality only NAMES them:
// an arrangement has ends, not parts of speech (S6, proven in
// omnimodal-kernel.test.js by driving the kernel with a melody and a film).
// The text "sentence" is the music "bar" is the film "shot": one holarchy,
// any medium.
//
// THE STRUCTURAL LEVELS (medium-general — the recursion, not the grammar):
//   WHOLE      — the entire artifact's void
//   PART       — a part of the whole (a whole in its own right)
//   SUB-PART   — a part of a part (a whole in its own right)
//   … and down, recursively. Each level's grain is the cube's own
//   Ground/Figure/Pattern ladder, coarse to fine.
//
// THE MODALITIES (how a medium names the structural levels):
//   text:  document · section · paragraph · sentence · clause
//   music: work · movement · phrase · bar
//   film:  work · act · scene · shot · gesture
//   code:  artifact · module · function · statement · expression
// The structure is the same; only the names differ. Nothing here says
// "essay", "paragraph", or "sentence" as a STRUCTURAL fact — those are
// text-modality names.
//
// THE LAW OF HOLONS, FOR VOIDS: low sets possibility for high, high
// probability for low. A sub-part's void (low) sets what its part (high) can
// assert — a part cannot claim what no sub-part could carry. The whole's
// declared shape (high) makes certain part-voids probable — the declared
// structure IS the parent void spawning its children.
//
// EVERY LEVEL IS DEF'D BY THE SAME NINE OPERATORS — NUL (what space, marked
// off), SIG (what must resolve), INS (what kind of part), SEG (the extent +
// units), CON (what binds a filler to the anchor), SYN (how fillers compose),
// DEF (cardinality), EVA (admission), REC (what reopens it). A level that
// omits an operator is under-specified — and the omission is visible.
import { cellOf } from "../kernel/cube.js";

/** The structural levels of the holarchy — the recursion, medium-blind. */
export const HOLON_LEVELS = Object.freeze([
  { level: "whole", depth: 0, grain: "Ground", label: "the entire artifact's void" },
  { level: "part", depth: 1, grain: "Figure", label: "a part of the whole — a whole in its own right" },
  { level: "subpart", depth: 2, grain: "Pattern", label: "a part of a part — a whole in its own right" },
  { level: "subsubpart", depth: 3, grain: "Figure", label: "a part of a sub-part — a whole in its own right" },
]);

/** How a medium NAMES the structural levels (S6: an arrangement has ends). */
export const MODALITIES = Object.freeze({
  text: { whole: "document", part: "section", subpart: "paragraph", subsubpart: "sentence", terminal: "clause" },
  music: { whole: "work", part: "movement", subpart: "phrase", subsubpart: "bar", terminal: "motif" },
  film: { whole: "work", part: "act", subpart: "scene", subsubpart: "shot", terminal: "gesture" },
  code: { whole: "artifact", part: "module", subpart: "function", subsubpart: "statement", terminal: "expression" },
});

/** The nine operators, in the canon's dependency order (domain-major). */
export const VOID_OPERATORS = Object.freeze([
  { op: "NUL", field: "slot", asks: "what space this is, marked off from all it is not" },
  { op: "SIG", field: "anchor", asks: "what must resolve for this space to exist at all" },
  { op: "INS", field: "admits", asks: "what kind of thing may stand here" },
  { op: "SEG", field: "extent", asks: "the extent to be covered, and its units" },
  { op: "CON", field: "relation", asks: "what binds a filler to the anchor" },
  { op: "SYN", field: "composition", asks: "how fillers compose across the extent" },
  { op: "DEF", field: "cardinality", asks: "how many fillers the space is declared to hold" },
  { op: "EVA", field: "admission", asks: "the test a candidate must pass to fill any of it" },
  { op: "REC", field: "reopensOn", asks: "what forces this declaration to be revised" },
]);

/**
 * DEFINE ONE LEVEL'S VOID across all nine operators. Every field optional,
 * every omission typed: a caller that cannot state one gets a declared gap
 * for that operator, never a default. `cellOf` is injected.
 */
export function defineLevelVoid(fields = {}, { cellOf: injectCellOf = cellOf } = {}) {
  const declared = [];
  const undeclared = [];
  for (const o of VOID_OPERATORS) {
    const cell = injectCellOf(o.op, "Figure");
    const value = fields[o.field];
    const present = value !== undefined && value !== null && value !== "";
    if (present) declared.push({ op: o.op, field: o.field, asks: o.asks, terrain: cell.terrain });
    else undeclared.push({ op: o.op, field: o.field, asks: o.asks, terrain: cell.terrain });
  }
  return {
    schema: "EOVoidLevel@1",
    standing: undeclared.length ? "under-specified" : "specified",
    declared,
    undeclared,
    basis: undeclared.length
      ? `the ${fields.slot ?? "level"} void is under-specified: ${undeclared.map((u) => `${u.op} (${u.asks})`).join("; ")}`
      : `the ${fields.slot ?? "level"} void is fully specified across all nine operators`,
  };
}

/**
 * THE OMNIMODAL VOID HOLARCHY. `modality` names the medium (text/music/film/
 * code); the structural levels are the holon recursion, each named by the
 * modality. Each level is simultaneously a WHOLE (its own nine-operator void)
 * and a PART (a filler covering an extent in the level above). A level
 * omitted from `fieldsByLevel` is under-specified — a visible typed gap.
 */
export function voidHolarchy({ modality = "text", fieldsByLevel = {}, cellOf: injectCellOf = cellOf } = {}) {
  const names = MODALITIES[modality] ?? MODALITIES.text;
  const levels = HOLON_LEVELS.map((hl, i) => {
    const fields = fieldsByLevel[hl.level] ?? {};
    const levelVoid = defineLevelVoid(fields, { cellOf: injectCellOf });
    const parent = i > 0 ? HOLON_LEVELS[i - 1].level : null;
    return {
      level: hl.level,
      name: names[hl.level] ?? hl.level,
      depth: hl.depth,
      grain: hl.grain,
      parent,
      label: hl.label,
      asFiller: parent ? {
        parent,
        fills: fields.extent ?? null,
        relation: fields.relation ?? null,
        admission: fields.admission ?? null,
      } : null,
      void: levelVoid,
    };
  });
  return {
    schema: "EOVoidHolarchy@1",
    modality,
    levels,
    terminal: names.terminal ?? null,
    law: "low sets possibility for high, high probability for low — a sub-part's void bounds what its part can assert; the whole's declared shape spawns its part-voids",
    basis: levels.map((l) => `${l.name}: ${l.void.standing}`).join(" · "),
  };
}

/** Alias of voidHolarchy — the nested voids by any name. */
export const holarchyOfVoids = voidHolarchy;