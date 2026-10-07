// relation-kinds.js — kindOf(connector) → one of the 27 cells (2026-09-15,
// user direction: "we need to define a universe of total types of
// relationships, and lets suppose there are likely... 27"; "think of the
// standing face"; "all the slots and word order and shit is just means to an
// end"; "if we keep our eyes on the metastructure, we can be omnilingual").
// Pure.
//
// THE METASTRUCTURE IS NOT THE MEANING (corrected 2026-09-16 — an earlier
// version of this header said it was). The MEANING of a communication is
// what its GIVER intended; the metastructure — the 27-cell lattice
// (operator × grain, cube.js) — is only the closed vocabulary this apparatus
// uses to talk ABOUT that intent across any medium, the frame that makes
// cognition OMNIMODAL, never a replacement for the giver's own intent. A
// relationship's KIND is which of the 27 cells its label is — the closed
// lattice, never an open verb list. Slots and word order are the PROJECTION
// (a language's own eigenvalue for getting from a sentence to {end1, label,
// end2}); the cell is where the arrangement lands. This is what makes the
// reading OMNILINGUAL: a Hebrew "היא", an English "is", a Russian copula all
// land on the same cell, because the cell is not a string or an order — it is
// a place in the metastructure, the shared frame that lets what two givers
// meant be COMPARED at all. The standing face (standingOf, kernel/notes.js)
// grades the same arrangement by how it is attested. A relationship =
// (kind ∈ 27 cells, standing ∈ evidence lattice) — and neither axis IS the
// giver's meaning; both are this instrument's read on it.
//
// THE KIND FAMILIES (the user's "likely 27"). A label's cell is read off two
// axes:
//
//   DOMAIN (what kind of being the relation asserts):
//     Existence      — what a thing IS: presence, naming, identity, birth,
//                      kind-membership (NUL SIG INS)
//     Structure      — how ends CONNECT: separation, negation, adjacency,
//                      composition, whole-part (SEG CON SYN)
//     Interpretation — what the relation MEANS: definition, evaluation,
//                      comparison, re-grounding (DEF EVA REC)
//
//   GRAIN (the order of the claim about that being):
//     Ground         — the base the relation stands on (is there a thing at all)
//     Figure         — the figure raised from the ground (X relates to Y)
//     Pattern        — the pattern the relation is part of (recurring, composed)
//
// The connector resolves to a cell by the ACT it asserts, folded through
// morphology (sameAct) so inflections land on their lemma's cell. The mapping
// is a CLOSED table keyed by semantic act, with the nine operators as the
// primary key and the grain read off the connector's shape (a copula/identity
// is Figure·Existence; a partitive is Pattern·Structure; a comparative is
// Figure·Interpretation). A connector no closed kind admits is a typed gap,
// never a guess — the relation is unclassed, and the ladder's other rungs
// carry it.
import { cellOf } from "../kernel/cube.js";

// The nine operators' mode/domain, read off cube.js (never restated — the
// same rule that killed OPERATOR_ORDER's divergence). `cellOf` is the one
// authority; these constants are only the CLOSED KIND TABLE's keys.
const COPULA = new Set(["is", "are", "was", "were", "be", "been", "being", "become", "becomes", "became", "הוא", "היא", "есть", "был", "была", "является", "быть", "です", "는", "은"]);
const IDENTITY = new Set(["equals", "equal", "same as", "is the same as", "identical to", "idem"]);
const PARTITIVE = new Set(["of", "part of", "member of", "in", "inside", "belongs to", "belong to", "comprises", "comprise", "includes", "include", "consists of", "contain", "contains", "element of"]);
const COMPOSITION = new Set(["made of", "made from", "composed of", "built of", "formed of", "constructed from", "compose", "composes"]);
const PRECEDENCE = new Set(["precedes", "preceded", "before", "prior to", "succeeds", "succeeded", "after", "replaces", "replaced", "follows", "followed", "next", "previous", "succeeding", "preceding"]);
const COMPARISON = new Set(["greater than", "less than", "larger than", "smaller than", "bigger than", "taller than", "older than", "younger than", "more than", "fewer than", "compared to", "higher than", "lower than", "best", "biggest", "largest", "smallest", "tallest", "oldest", "youngest", "first", "largest", "biggest", "most", "least", "greater", "less"]);
const POSSESSION = new Set(["has", "have", "had", "owned by", "owned", "belongs to", "belong to", "possess", "possesses", "holds", "hold", "carries", "carry", "יש ל", "имеет", "имеют", "имел", "にあります"]);
const ACTION = new Set(["wrote", "wrote", "writes", "write", "wrote", "founded", "founds", "found", "built", "builds", "build", "created", "creates", "create", "invented", "invents", "invent", "commanded", "commands", "command", "led", "leads", "lead", "authored", "authors", "author", "patented", "patents", "patent", "invaded", "invades", "invade", "painted", "paints", "paint", "married", "marries", "marry"]);
const NEGATION = new Set(["not", "never", "no", "isn't", "aren't", "wasn't", "weren't", "doesn't", "don't", "didn't", "ain't"]);
const ABSENCE = new Set(["lacks", "lack", "without", "absent", "missing", "no longer", "devoid of"]);
const CLASSIFICATION = new Set(["is a", "are a", "is an", "are an", "type of", "kind of", "sort of", "species of", "category of", "class of"]);
const CAUSATION = new Set(["causes", "cause", "caused", "leads to", "lead to", "leads", "produces", "produce", "produced", "results in", "result in", "resulted in", "creates", "create", "makes", "make", "gives rise to"]);
const DEPENDENCE = new Set(["depends on", "depend on", "depended on", "based on", "based upon", "relies on", "rely on", "relied on", "founded on", "rests on", "rest on", "due to", "owing to"]);
const SPATIAL = new Set(["in", "at", "on", "near", "beside", "under", "over", "above", "below", "around", "through", "across", "north of", "south of", "east of", "west of", "located in", "located at", "situated in", "situated at"]);
const TEMPORAL = new Set(["before", "after", "during", "in", "around", "circa", "about", "until", "since", "preceding", "following", "in the year", "between", "from", "to"]);
const APPROXIMATION = new Set(["approximately", "about", "around", "circa", "roughly", "near", "almost", "nearly"]);
const PREDICATION = new Set(["is the", "are the", "is an", "is a", "are", "are", "was the", "were the", "is considered", "are considered", "is known as", "are known as", "is called", "are called", "is named", "are named", "is regarded as", "are regarded as"]);

/** The fold, shared so inflections reach their lemma's cell (the same
 *  cross-organ fold as every other comparison). */
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** The lemma-folding organ, injected (cast.js pattern) — without it, exact
 *  membership only; with it, inflections land on their lemma's cell. */
let _sameAct = null;
export function setSameAct(fn) { _sameAct = typeof fn === "function" ? fn : null; }

/** A relation label is one of the known acts? (exact or sameAct-folded). */
function inClass(klass, label) {
  const l = fold(label);
  if (klass.has(l)) return true;
  if (_sameAct) {
    for (const k of klass) { try { if (_sameAct(k, label)?.verdict === "same" || _sameAct(k, label) === true) return true; } catch { /* one form refusing is not a wall */ } }
  }
  return false;
}

/** The cell string for an (op, grain) — "SIG·Figure", composed from cube.js's
 *  own fields (never a second table). */
const cellName = (op, grain) => `${op}·${grain}`;

/**
 * kindOf(label) → { cell, op, grain, ... } | { gap }.
 * The cell of a relationship label, read off the closed kind table. The
 * grain is read off the connector's act:
 *   Ground  — the relation asserts a base/presence (a copula of existence)
 *   Figure  — the relation RAISES a figure (identity, action, possession)
 *   Pattern — the relation is part of a structure (partitive, composition,
 *             precedence, classification)
 * A label no closed kind admits is a typed gap, never a guess.
 */
export function kindOf(label) {
  const l = fold(label);
  if (!l) return { gap: "no_label", detail: "kindOf needs a label" };
  const cell = (op, grain, from) => ({ ...cellOf(op, grain), cell: cellName(op, grain), from });
  // Copula: the basic "X is Y" — Existence·Figure (identity of a being).
  if (inClass(COPULA, l) || inClass(IDENTITY, l)) return cell("SIG", "Figure", "identity");
  // Predication ("is the capital of"): the predicate binds a figure — Existence·Pattern (a kind-instance claim).
  if (inClass(PREDICATION, l)) return cell("INS", "Pattern", "predication");
  // Classification ("is a type of"): Kind — Existence·Pattern.
  if (inClass(CLASSIFICATION, l)) return cell("INS", "Pattern", "kind");
  // Partitive ("of", "part of"): Structure·Ground (a field's parts).
  if (inClass(PARTITIVE, l)) return cell("SEG", "Ground", "partitive");
  // Composition ("made of"): Structure·Pattern.
  if (inClass(COMPOSITION, l)) return cell("SYN", "Pattern", "composition");
  // Precedence ("replaces", "precedes"): Interpretation·Pattern (re-grounding).
  if (inClass(PRECEDENCE, l)) return cell("REC", "Pattern", "precedence");
  // Comparison ("greater than"): Interpretation·Figure.
  if (inClass(COMPARISON, l)) return cell("EVA", "Figure", "comparison");
  // Possession ("has", "belongs to"): Structure·Figure (a link).
  if (inClass(POSSESSION, l)) return cell("CON", "Figure", "possession");
  // Action ("wrote", "founded", "commanded"): Structure·Figure (a relation between ends).
  if (inClass(ACTION, l)) return cell("CON", "Figure", "action");
  // Negation / absence ("not", "lacks"): Structure·Ground (a cut / SEG).
  if (inClass(NEGATION, l) || inClass(ABSENCE, l)) return cell("SEG", "Ground", "negation");
  // Causation ("causes", "leads to"): Interpretation·Pattern.
  if (inClass(CAUSATION, l)) return cell("SYN", "Pattern", "causation");
  // Dependence ("depends on"): Interpretation·Ground (a basis).
  if (inClass(DEPENDENCE, l)) return cell("DEF", "Ground", "dependence");
  // Spatial / temporal ("in", "before"): Structure·Ground (a field).
  if (inClass(SPATIAL, l) || inClass(TEMPORAL, l)) return cell("CON", "Ground", "spatio-temporal");
  // Approximation ("about", "approximately"): Interpretation·Ground (a margin).
  if (inClass(APPROXIMATION, l)) return cell("EVA", "Ground", "approximation");
  return { gap: "unclassed", detail: `no closed kind admits "${label}"`, label };
}

/** The closed kind vocabulary — one label per cell, for the reader to name a
 *  relationship's cell in plain words. Not the mapping; the mapping is
 *  kindOf above. */
export const CELL_NAMES = Object.freeze({
  "SIG·Figure": "identity",
  "INS·Pattern": "kind",
  "SEG·Ground": "cut",
  "SYN·Pattern": "composition",
  "REC·Pattern": "succession",
  "EVA·Figure": "comparison",
  "CON·Figure": "link",
  "DEF·Ground": "basis",
  "CON·Ground": "field",
  "EVA·Ground": "margin",
});