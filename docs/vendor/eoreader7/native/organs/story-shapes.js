// organs/story-shapes.js — THE EO STORY SHAPES, TAXONOMICALLY COMPLETE.
// Handle: Vonnegut — his eight shapes are the READER's fortune curves. But
// EO's cube is richer: 3 domains × 3 modes = 9 operators, each × 3 grains =
// 27 cells, and EVERY cell names a distinct arc a piece can trace. Vonnegut's
// eight are the reader-facing subset; the 27 are the taxonomy of what a piece
// CAN do. This organ enumerates them all, derived from the kernel's own cube
// algebra (never a second copy of the table), and classifies a given essay's
// fortune curve into the cells it actually traces.
//
// The domains (what the piece shapes), the modes (the act), the grains (the
// level the act lands on), the terrain (what it is about), the stance (the
// posture of the act):
//   Existence (NUL/SIG/INS) — the being's story: what is, which one, what kind.
//   Structure (SEG/CON/SYN) — the hanging-together story: extent, binding, weave.
//   Interpretation (DEF/EVA/REC) — the meaning story: frame, test, revision.
//   Differentiate (cut apart) · Relate (bind) · Generate (make).
//   Ground / Figure / Pattern — the level of the difference.
import { cellOf, OPERATOR_CHAIN, DOMAINS, MODES, GRAINS } from "../kernel/cube.js";

/**
 * THE COMPLETE SHAPE TABLE — all 27 cells, each named as a story shape, with
 * the domain (what it shapes), mode (the act), grain, terrain, stance, and a
 * one-line shape the piece traces when this cell is its arc. Derived from the
 * cube's own cellOf — the algebra is the taxonomy, never a restated table.
 */
export const STORY_SHAPES = OPERATOR_CHAIN.flatMap((op) => GRAINS.map((grain) => {
  const c = cellOf(op, grain);
  // The story shape each cell names — the ARC the piece traces when this
  // cell is its spine. Taxonomically complete: every cell has one.
  const shape = shapeOf(op, grain);
  return {
    cell: `${op}·${grain}`,
    op, grain,
    domain: c.domain, mode: c.mode, terrain: c.terrain, stance: c.stance,
    name: shape.name,
    arc: shape.arc,
  };
}));

/**
 * The story shape of one cell. This is the EO taxonomy: a piece traces a
 * specific arc depending on which cell is its spine. Vonnegut's reader-facing
 * eight appear here (man-in-hole, rags-to-riches, from-bad-to-worse,
 * the-flatline, etc.) plus the EO ones the reader doesn't usually name but a
 * writer's craft recognizes — each is a declared arc with a name and the
 * movement it traces.
 */
function shapeOf(op, grain) {
  const SH = {
    // ── EXISTENCE · the being's story ──
    "NUL·Ground": { name: "The Clearing", arc: "marks its subject off from everything adjacent — the space it clears, and what it is NOT." },
    "NUL·Figure": { name: "The One", arc: "one being clears its ground, or several must be kept apart — individuation as the arc." },
    "NUL·Pattern": { name: "The Kind", arc: "what KIND of thing it is, held against the material — a kind that resolves or stays open." },
    "SIG·Ground": { name: "The Absence", arc: "what is missing and must be found for the story to exist — an absence that drives it." },
    "SIG·Figure": { name: "The Named", arc: "the names and the referent, so one being is meant — identity as the arc." },
    "SIG·Pattern": { name: "The Recurrence", arc: "how many distinct beings keep recurring as the same kind — a census of identity." },
    "INS·Ground": { name: "The Baseline", arc: "the account built before any judgment — a foundation story." },
    "INS·Figure": { name: "The Portrait", arc: "what the piece brings into being that did not exist before — a creation story." },
    "INS·Pattern": { name: "The Account", arc: "what kind of account it instantiates — a genre story (species description, history, elegy)." },
    // ── STRUCTURE · the hanging-together story ──
    "SEG·Ground": { name: "The Extent", arc: "the range it must cover, in its own units — a journey across a declared map." },
    "SEG·Figure": { name: "The Cut", arc: "what is cut apart, derived from the material's own bytes — a dissection." },
    "SEG·Pattern": { name: "The Seams", arc: "where the story parts at natural bridges — a chaptered arc." },
    "CON·Ground": { name: "The Field", arc: "the ambient of possible relations before any is confirmed — a field-opens arc." },
    "CON·Figure": { name: "The Binding", arc: "what binds each named thing to the subject — a web of edges." },
    "CON·Pattern": { name: "The Cycle", arc: "the recurring relation found at a real floor — a loop, the same cycle returning." },
    "SYN·Ground": { name: "The Ground", arc: "what received readings merge into one carried ground — a synthesis story." },
    "SYN·Figure": { name: "The Witness", arc: "where two sources agree into one claim — corroboration as the arc." },
    "SYN·Pattern": { name: "The Chain", arc: "how parts compose so a reader walks through — a passage story." },
    // ── INTERPRETATION · the meaning story ──
    "DEF·Ground": { name: "The Frame", arc: "the interpretive frame declared — alarm, wonder, elegy — a framed story." },
    "DEF·Figure": { name: "The Thesis", arc: "one answer declared, held to — Vonnegut's single-spine arc." },
    "DEF·Pattern": { name: "The Frames", arc: "candidate framings, some refuted, some staying candidate — a contest of frames." },
    "EVA·Ground": { name: "The Owed", arc: "what the piece owes the reader's accumulated picture — a debt-and-payment story." },
    "EVA·Figure": { name: "The Test", arc: "what each claim must pass to stand — a trial arc, claims judged." },
    "EVA·Pattern": { name: "The Standing", arc: "each claim's standing across its witnesses — a verdict story." },
    "REC·Ground": { name: "The Rezero", arc: "when the piece concedes its frame and re-zeroes — a conversion arc." },
    "REC·Figure": { name: "The Retraction", arc: "what would make it take back a claim — a reversal, an un-saying." },
    "REC·Pattern": { name: "The Revision", arc: "what finding forces the whole declaration to revise — a paradigm-shift arc." },
  };
  return SH[`${op}·${grain}`] ?? { name: `${op}·${grain}`, arc: "the arc this cell traces" };
}

/** All shapes by domain — the taxonomy grouped. */
export const shapesByDomain = () => {
  const out = {};
  for (const d of DOMAINS) {
    out[d] = STORY_SHAPES.filter((s) => s.domain === d).map((s) => ({ cell: s.cell, name: s.name, arc: s.arc }));
  }
  return out;
};

/** All shapes by mode — the acts grouped. */
export const shapesByMode = () => {
  const out = {};
  for (const m of MODES) {
    out[m] = STORY_SHAPES.filter((s) => s.mode === m).map((s) => s.cell);
  }
  return out;
};

/**
 * VONNEGUT'S EIGHT, mapped onto the cube — the reader-facing subset. Each of
 * his fortune shapes corresponds to the cells whose arcs trace that curve:
 *   Man-in-hole      — DEF·Figure (thesis, a dip) + EVA·Figure (the test
 *                      climbs out) — the piece surprises, then understands.
 *   Boy-meets-girl   — CON·Figure (the binding) + REC·Figure (the retraction
 *                      and recovery) — bind, lose, bind again.
 *   Rags-to-riches   — INS·Figure (the portrait, born) — a steady creation.
 *   From-bad-to-worse— REC·Pattern (the revision that un-does) — a falling arc.
 *   Which-way-is-up  — a piece whose spine is no cell — the flatline.
 *   Cinderella       — NUL·Ground (clearing) + SYN·Figure (the witness that
 *                      redeems) — hidden, recognized.
 *   Creation         — INS·Ground (the baseline) — the account built from nothing.
 *   Journey          — SEG·Ground (the extent) — a crossing of a declared map.
 */
export const VONNEGUT_EIGHT = [
  { shape: "Man in Hole", cells: ["DEF·Figure", "EVA·Figure"], arc: "the thesis digs (the surprise), the test climbs out — surprise, then understanding." },
  { shape: "Boy Meets Girl", cells: ["CON·Figure", "REC·Figure"], arc: "bind, lose, retract, bind again — the love arc." },
  { shape: "Rags to Riches", cells: ["INS·Figure"], arc: "the portrait is born and grows — a steady rise." },
  { shape: "From Bad to Worse", cells: ["REC·Pattern"], arc: "the revision un-does what was built — a steady fall." },
  { shape: "Which Way Is Up", cells: [], arc: "no spine cell — the flatline, the essay that argues nothing." },
  { shape: "Cinderella", cells: ["NUL·Ground", "SYN·Figure"], arc: "cleared off from the crowd, then recognized by the witness — hidden, revealed." },
  { shape: "Creation", cells: ["INS·Ground"], arc: "the baseline account built from nothing — genesis." },
  { shape: "Journey", cells: ["SEG·Ground"], arc: "a crossing of the declared extent — the range as the map." },
];

/** The taxonomy, complete — for any caller that wants the whole table. */
export const allStoryShapes = () => STORY_SHAPES;

/**
 * CLASSIFY A PIECE'S ARC into the taxonomy. Given the essay's fortune curve
 * (vonnegut.js) and the shape it already traces, report: the classic
 * Vonnegut shape (if any), the EO cells the arc actually visits (by the
 * arc's own movement — a thesis→test arc visits DEF·Figure and EVA·Figure;
 * a binding→retraction arc visits CON·Figure and REC·Figure), and the single
 * spine cell. This is the writer's read of the piece's shape.
 * `vonnegutShape` is the result of organs/vonnegut.js storyShape() — injected
 * so this organ owns only the mapping, never the measurement.
 */
export function classifyArc(vonnegutResult) {
  const curve = vonnegutResult?.curve ?? [];
  const held = curve.map((c) => c.conviction);
  const start = held[0] ?? 0, end = held[held.length - 1] ?? 0;
  const peak = Math.max(0, ...held);
  const rose = end > start;
  const fell = end < start;
  // The cells the arc visits, read off its movement (the same mapping
  // VONNEGUT_EIGHT declares, generalised to the spine cells the movement
  // names): a rise after the thesis is the TEST climbing out (EVA·Figure);
  // a steady creation is the PORTRAIT (INS·Figure); a fall is the REVISION
  // un-doing (REC·Pattern); a level arc is the FLATLINE (no spine).
  const visited = [];
  if (rose && curve.length >= 2) { visited.push("DEF·Figure", "EVA·Figure"); } // thesis, then test climbed
  if (peak > start + 1 && curve.length >= 3) visited.push("INS·Figure"); // a creation that accumulates
  if (fell) visited.push("REC·Pattern"); // the revision that un-does
  if (!visited.length) visited.push("NUL·Ground"); // a clearing, at minimum
  const spine = visited[0] ?? null;
  const spineCell = STORY_SHAPES.find((s) => s.cell === spine) ?? null;
  const vonnegutShape = vonnegutResult?.shape ?? "flatline";
  return {
    vonnegutShape,
    shapeName: spineCell?.name ?? null,
    arc: spineCell?.arc ?? null,
    visitedCells: [...new Set(visited)],
    curve: held,
    basis: `Vonnegut: ${vonnegutShape}. EO: the piece's spine is ${spineCell?.name ?? "?"} (${spine}) — ${spineCell?.arc ?? ""}`,
  };
}

/** Alias of classifyArc — the writer's read by any name. */
export const readArc = classifyArc;