// grounding-glyphs.mjs — THE 27 CELLS, AS GLYPHS, WIRED TO THE SURFACE.
//
// Canonical glyphs from experientialontology.org (EO Notation §10, "The Nine
// Operators (Reference)" + Decal Notation): the operator glyphs and the grain
// decals are declared there to be interchangeable with the three-letter codes
// and the Greek symbols. Every cell = <operator glyph><grain decal>:
//
//   ∅− ∅+ ∅*   ○− ○+ ○*   ●− ●+ ●*    Existence (NUL SIG INS)
//   ｜− ｜+ ｜*  ⋈− ⋈+ ⋈*   △− △+ △*    Structure (SEG CON SYN)
//   ⊢− ⊢+ ⊢*   ⊨− ⊨+ ⊨*   ◉− ◉+ ◉*    Interpretation (DEF EVA REC)
//
// REC's glyph is ◉ (a ring around a filled circle: the retraced run kept as
// record, ●, inside a new open frame, ○). It was ⊛ until 2026-10-06; ⊛ never
// matched its stated rationale. Source: eo-wiki, "Operator Naming", Practitioner
// Glyphs. Records written earlier keep ⊛; read both as REC.
//
// The prose per cell (the plain-language grounding name) and the null it owes
// (THE-NULL-STATES' pairing rule: every positive finding an organ lands has a
// null in the same cell) come from this repo's own record — THE-27-CELLS.md
// and THE-NULL-STATES.md — never invented here. Pure: no I/O, no DOM.

export const OPERATOR_GLYPHS = Object.freeze({
  NUL: "∅", SIG: "○", INS: "●", SEG: "｜", CON: "⋈", SYN: "△", DEF: "⊢", EVA: "⊨", REC: "◉",
});
/** REC has been drawn three ways: ⊛ (the wiki until 2026-10-06), ↬ (penelope's
 *  tapestry, chosen for its one-cell width) and ◉ (now). Records written under
 *  an earlier mark still carry it, so anything that ingests an older version
 *  reads the glyph through operatorOfGlyph, never a table of its own. Only
 *  unambiguous marks belong here: △ was once INS and is now SYN, so it is not
 *  aliased. */
export const LEGACY_GLYPHS = Object.freeze({ "⊛": "REC", "↬": "REC" });
const GLYPH_OPERATOR = Object.freeze({
  ...Object.fromEntries(Object.entries(OPERATOR_GLYPHS).map(([op, g]) => [g, op])),
  ...LEGACY_GLYPHS,
});
/** The operator a glyph stands for, current or legacy; null for anything else. */
export const operatorOfGlyph = (g) => GLYPH_OPERATOR[g] ?? null;

export const OPERATOR_GREEK = Object.freeze({
  NUL: "ν", SIG: "σ", INS: "α", SEG: "κ", CON: "ε", SYN: "η", DEF: "δ", EVA: "ψ", REC: "Ω",
});
export const OPERATOR_NAME = Object.freeze({
  NUL: "withdraw determination", SIG: "register signal", INS: "instantiate a particular",
  SEG: "partition, draw boundary", CON: "establish connection", SYN: "synthesize into whole",
  DEF: "assert / define what holds", EVA: "render judgment", REC: "recursive revision",
});
export const GRAIN_DECALS = Object.freeze({ Ground: "−", Figure: "+", Pattern: "*" });
export const GRAIN_NAME = Object.freeze({
  Ground: "−1 · an ambient condition, substrate, atmosphere",
  Figure: "+1 · a specific, bounded entity or particular",
  Pattern: "emergent (τ) · a recurring regularity or process that unfolds over time",
});

/** The 27 cells, one entry each: terrain/stance from the cube, glyph from the
 *  notation, the plain grounding name and the null it owes from the repo's
 *  own record. Keyed by `<op>·<grain>`. */
export const CELLS = Object.freeze({
  "NUL·Ground": { terrain: "Void", stance: "Clearing", name: "measured against a broken nothing", nulls: "no_ground · degenerate_ground · incommensurate_extent", description: "a figure stands only when a deliberately-destroyed version of the material fails to produce it — the statistic is placed against a licensed, broken null." },
  "NUL·Figure": { terrain: "Entity", stance: "Dissecting", name: "established, not merely present", nulls: "no_presence · below_recurrence_floor · ambiguous_surface · exceeds_witness", description: "a being stands when it clears the floor of what counts as established — existence and establishment are different questions, and this cell answers the second." },
  "NUL·Pattern": { terrain: "Kind", stance: "Unraveling", name: "kind membership against the random null", nulls: "unknown_members · under_powered · no_boundary · made_no_difference", description: "a 'these belong together' stands only when shuffled company cannot reproduce the binding energy — the null discriminates, it does not rubber-stamp." },
  "SIG·Ground": { terrain: "Void", stance: "Tending", name: "absence named as a settleable question", nulls: "unread_extent · empty_material", description: "what is missing stands by becoming the specific question that would settle it — a gap the loop can name is a question it can ask." },
  "SIG·Figure": { terrain: "Entity", stance: "Binding", name: "identity resolved to who", nulls: "unheard · beyond-reach", description: "a name stands when it resolves to a referent, not to a byte string — the same name, one being; a referent is a centre of expansion, never a label on an end." },
  "SIG·Pattern": { terrain: "Kind", stance: "Tracing", name: "kind traced from recurrence", nulls: "no_candidate · control_survived", description: "a recurring pattern stands provisionally from the population's own co-occurrence — every basin carries its own null arm, and nothing is promoted by induction alone." },
  "INS·Ground": { terrain: "Void", stance: "Cultivating", name: "ground generated by declared preflight", nulls: "no_material · empty_material", description: "a groundless turn gets its one declared search before anything is drafted — generating the ground the checks need, never a guessed answer." },
  "INS·Figure": { terrain: "Entity", stance: "Making", name: "brought into being with its result attached", nulls: "INCOMPLETE · UNADDRESSED · NOT_A_VERB", description: "a thing stands by being born, with the result it produced riding it — results attach, they never re-type." },
  "INS·Pattern": { terrain: "Kind", stance: "Composing", name: "known procedure instantiated", nulls: "missing_kind_prior · refused-as-underpowered · ambiguous_surface", description: "a procedure stands when applied to new material with zero model calls — a skill without a check is refused as a wish." },
  "SEG·Ground": { terrain: "Field", stance: "Clearing", name: "the covered extent declared, with its units", nulls: "extent_excludes · no_slot · no_anchor · gap_between_parts", description: "a question stands when its space of coverage and its units are fixed — a hole is only visible against a declared extent." },
  "SEG·Figure": { terrain: "Link", stance: "Dissecting", name: "a disputable cut from the extent", nulls: "a denial refused as beyond-reach · the cut has no cell of its own", description: "a denial stands by being separated from the extent as a claim you can contest — sharing a link's ends and never its id." },
  "SEG·Pattern": { terrain: "Network", stance: "Unraveling", name: "separation at the real seams", nulls: "no_seam", description: "a whole stands cut where it actually separates — parameter-free, at the network's bridges, and refused when a 2-edge-connected network separates nowhere." },
  "CON·Ground": { terrain: "Field", stance: "Tending", name: "the connective field maintained", nulls: "no_population · skippedNoCopresence", description: "the ambient of possible relations stands by being tended — maintained, never decided; the deciding half is another cell." },
  "CON·Figure": { terrain: "Link", stance: "Binding", name: "an arrangement read from the material's own words", nulls: "unbound · object_unspecific · undetermined · CONTESTED", description: "a relation stands when read with its byte-span verified against the material's own bytes — the register's link, end─label─end, never guessed." },
  "CON·Pattern": { terrain: "Network", stance: "Tracing", name: "a recurring arrangement bound", nulls: "pronoun_no_candidate · pronoun_no_margin · no_incoming_face", description: "a shape stands when it recurs enough to bind as one arrangement across the network — one shape once binds nothing." },
  "SYN·Ground": { terrain: "Field", stance: "Cultivating", name: "sedimented readings compiled into one ground", nulls: "empty_field", description: "accumulated readings stand when merged into one carried ground — givers named, absences gapped, compiling never promotes a standing." },
  "SYN·Figure": { terrain: "Link", stance: "Making", name: "re-sighting folded into the same note", nulls: "withheld · vetoed · UNLICENSED_PERTURBATION", description: "a being stands when a later sighting joins the same note with witnesses added — two pages agreeing become one note, never two." },
  "SYN·Pattern": { terrain: "Network", stance: "Composing", name: "relations composed into a chain", nulls: "not_yet_executable · undeclared_organ · organ_unreachable", description: "a relation stands by being linked to its neighbours and referent-siblings — relations only make sense linked." },
  "DEF·Ground": { terrain: "Atmosphere", stance: "Clearing", name: "the declared interpretive frame", nulls: "no_frame · undeclared · searchedVoid", description: "a reading stands when the frame it is held in is declared — a void over the configuration itself, with its scope." },
  "DEF·Figure": { terrain: "Lens", stance: "Dissecting", name: "a candidate cut against the corpus", nulls: "wish · fixture_absent · control_absent", description: "a candidate stands by being cut against the ground, provenance-carrying — a define with no evaluate is a wish, not a bound." },
  "DEF·Pattern": { terrain: "Paradigm", stance: "Unraveling", name: "a declaration earned, never given", nulls: "unmeasured · no_pronoun_prior_for_language", description: "a functional claim stands only as REFUTED or CANDIDATE — never as GIVEN: a corpus can refute a Pattern-grain claim, never earn one." },
  "EVA·Ground": { terrain: "Atmosphere", stance: "Tending", name: "the accumulated ground metered", nulls: "unexamined", description: "the reader's own picture stands by being carried while unmoved and refreshed exactly where it moved — examined and clean are different facts." },
  "EVA·Figure": { terrain: "Lens", stance: "Binding", name: "checked by a guard that can fire", nulls: "the unreachable guard · insufficient · inconclusive", description: "a claim stands when a check it could actually fail runs on it — a wall that can never fire is a comment wearing rigor." },
  "EVA·Pattern": { terrain: "Paradigm", stance: "Tracing", name: "standing across independent witnesses", nulls: "control_survived · NOT COMPARABLE · unlicensed", description: "a claim stands across the set of witnesses — agree, single, disagree, contradicted, undetermined: a property of the set no member carries." },
  "REC·Ground": { terrain: "Atmosphere", stance: "Cultivating", name: "the regime re-zeroed", nulls: "no_rezero_trigger · not_earned", description: "a reading stands when a stale ambient is conceded and a fresh one begins — re-zero is never a default, it answers a measured unravel." },
  "REC·Figure": { terrain: "Lens", stance: "Making", name: "ground conceded, next born", nulls: "record_gap · record_conflict · source_absent", description: "a judged projection stands by conceding its ground and birthing the next — a re-zero concedes a ground, it does not compile a new whole out of the old." },
  "REC·Pattern": { terrain: "Paradigm", stance: "Composing", name: "the paradigm reshaped by a contradiction", nulls: "paradigm_unraveled · empty_paradigm · kept_ground", description: "the space itself stands by re-zeroing the paradigm, not just one figure — a finding contradicting the declared space re-zeros the space." },
});

/** cellOf(op, grain) -> the full cell record, glyph included. */
export function cellOf(op, grain) {
  const base = CELLS[`${op}·${grain}`];
  if (!base) return null;
  return Object.freeze({
    op, grain,
    terrain: base.terrain, stance: base.stance,
    name: base.name, nulls: base.nulls, description: base.description,
    glyph: `${OPERATOR_GLYPHS[op]}${GRAIN_DECALS[grain]}`,
    greek: `${OPERATOR_GREEK[op]}${GRAIN_DECALS[grain]}`,
    operator: OPERATOR_NAME[op],
    grainName: GRAIN_NAME[grain],
  });
}

/** The four glyphs the fold surface actually wears, as a convenience map for
 *  the renderer's own role defaults (source cards, rows, measures, beings,
 *  networks). Overridable per item via its own `grounding` cell field. */
export const SURFACE_DEFAULT_CELLS = Object.freeze({
  source: "INS·Figure",   // retained + hash-pinned: brought into being with its result attached
  row: "CON·Figure",      // asserted connection: an arrangement read from the material's own words
  measure: "CON·Ground",  // provenance-stamped metrics: the connective field maintained
  being: "SIG·Figure",    // beads: identity resolved to who
  network: "CON·Pattern", // subgraph: a recurring arrangement bound
});

export function surfaceCellOf(kind, overrideCell = null) {
  const addr = overrideCell ?? SURFACE_DEFAULT_CELLS[kind] ?? "CON·Figure";
  const [op, grain] = addr.split("·");
  return cellOf(op, grain);
}