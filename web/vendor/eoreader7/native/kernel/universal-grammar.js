// Handle: Chomsky — the arrangement is universal; a language's grammar is the
//   cube's cells worn by that language's surfaces.
// kernel/universal-grammar.js — THE CUBE AS A TAXONOMICALLY COMPLETE GRAMMAR.
//
// `cube.js` already states the theory: every language's morphology projects
// onto the cube, the three DOMAINS are the three grammatical departments and
// the three GRAINS are the three clause positions —
//
//   Existence       the nominal system        Ground = clause frame
//   Structure       the syntax                Figure = the argument
//   Interpretation  the verbal/functional     Pattern = the agreement system
//
// — and `CELL_OF_GRAMMAR` measured eight dimensions of it on Ancient Greek.
// Its only consumer was a test. This module makes the theory COMPLETE against
// the one cross-linguistic inventory every treebank we hold is annotated in
// (Universal Dependencies v2): every part of speech, every relation and every
// feature value has a cube address, or it is refused loudly. Completeness is
// a test, not a hope — `taxonomyGaps()` enumerates what is missing, and the
// round-trip harness fails when a treebank uses something this table does
// not place.
//
// WHY THIS CAN BE RICHER THAN ANY ONE LANGUAGE. The inventory is the UNION of
// what languages mark: the dual, the optative, the jussive, evidentiality,
// clusivity, the middle voice, Bantu noun classes, fourteen spatial cases.
// English marks almost none of these. A record typed in this table can hold
// all of them, and a projection into English drops what English cannot say,
// while the record — and its provenance — keeps it.
//
// THREE KINDS OF ENTRY, each carrying its basis so no assignment passes
// itself off as more than it is:
//
//   measured  — inherited from `CELL_OF_GRAMMAR`, derived by tallying real
//               Greek endings (cube.js's own provenance note). Never
//               overridden here, even where it strains the department rule.
//   declared  — placed by the RULE below, from a dimension's department and
//               clause position. Revisable: the cross-lingual test (the same
//               meaning in two languages should land in the same cells) is
//               what can falsify a declared placement.
//   form      — describes the SURFACE (an abbreviation, a digit, a typo, a
//               loanword), not meaning. Kept losslessly in the record's
//               surface layer and never given a meaning cell, because the
//               cube types meaning and form belongs to provenance.
//
// A cell is an ADDRESS, not a value. Several values share a cell (Sub and Opt
// both sit at EVA·Pattern); the dimension and value are always kept beside
// it, so the record stays lossless while the cube organizes it.

import { cellOf, CELL_OF_GRAMMAR } from "./cube.js";

export const UNIVERSAL_GRAMMAR_SCHEMA = "EOUniversalGrammar@1";

// ── THE INVENTORY: Universal Dependencies v2 (universaldependencies.org/u/) ──
export const UD_UPOS = Object.freeze([
  "ADJ", "ADP", "ADV", "AUX", "CCONJ", "DET", "INTJ", "NOUN", "NUM", "PART", "PRON", "PROPN", "PUNCT", "SCONJ", "SYM", "VERB", "X",
]);

export const UD_DEPRELS = Object.freeze([
  "acl", "advcl", "advmod", "amod", "appos", "aux", "case", "cc", "ccomp", "clf", "compound", "conj", "cop", "csubj", "dep", "det",
  "discourse", "dislocated", "expl", "fixed", "flat", "goeswith", "iobj", "list", "mark", "nmod", "nsubj", "nummod", "obj", "obl",
  "orphan", "parataxis", "punct", "reparandum", "root", "vocative", "xcomp",
]);

export const UD_FEATURES = Object.freeze({
  // lexical
  PronType: ["Prs", "Rcp", "Art", "Int", "Rel", "Exc", "Dem", "Emp", "Tot", "Neg", "Ind", "Con"],
  NumType: ["Card", "Ord", "Mult", "Frac", "Sets", "Dist", "Range"],
  Poss: ["Yes"], Reflex: ["Yes"],
  // nominal inflection
  Gender: ["Masc", "Fem", "Neut", "Com"],
  Animacy: ["Anim", "Inan", "Hum", "Nhum"],
  NounClass: [...Array.from({ length: 23 }, (_, i) => `Bantu${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `Wol${i + 1}`)],
  Number: ["Sing", "Plur", "Dual", "Tri", "Pauc", "Grpa", "Grpl", "Inv", "Count", "Ptan", "Coll"],
  Case: ["Abs", "Acc", "Erg", "Nom", "Abe", "Ben", "Cau", "Cmp", "Cns", "Com", "Dat", "Dis", "Equ", "Gen", "Ins", "Par", "Tem", "Tra",
    "Voc", "Abl", "Add", "Ade", "All", "Del", "Ela", "Ess", "Ill", "Ine", "Lat", "Loc", "Per", "Sbe", "Sbl", "Spl", "Sub", "Sup", "Ter"],
  Definite: ["Ind", "Spec", "Def", "Cons", "Com"],
  Deixis: ["Prox", "Med", "Remt", "Nvis", "Abv", "Even", "Bel"],
  DeixisRef: ["1", "2"],
  Degree: ["Pos", "Equ", "Cmp", "Sup", "Abs"],
  // verbal inflection
  VerbForm: ["Fin", "Inf", "Sup", "Part", "Conv", "Gdv", "Ger", "Vnoun"],
  Mood: ["Ind", "Imp", "Cnd", "Pot", "Sub", "Jus", "Prp", "Qot", "Opt", "Des", "Nec", "Adm"],
  Tense: ["Past", "Pres", "Fut", "Imp", "Pqp"],
  Aspect: ["Imp", "Perf", "Prosp", "Prog", "Hab", "Iter", "Cons"],
  Voice: ["Act", "Mid", "Rcp", "Pass", "Antip", "Lfoc", "Bfoc", "Dir", "Inv", "Cau"],
  Evident: ["Fh", "Nfh"],
  Polarity: ["Pos", "Neg"],
  Person: ["0", "1", "2", "3", "4"],
  Polite: ["Infm", "Form", "Elev", "Humb"],
  Clusivity: ["In", "Ex"],
});

/** Features that describe the SURFACE, not meaning: kept in the surface
 *  layer, never given a meaning cell. */
export const FORM_FEATURES = Object.freeze(new Set(["Abbr", "Typo", "Foreign", "NumForm", "Compound", "Prefix", "Form", "Style", "Variant", "ExtPos"]));

// ── THE RULE for declared placements ────────────────────────────────────────
// A dimension's DEPARTMENT fixes its domain, its CLAUSE POSITION fixes its
// grain, and what it DOES to its bearer fixes the mode:
//   Differentiate — it cuts a distinction (NUL / SEG / DEF)
//   Relate        — it binds the bearer to something (SIG / CON / EVA)
//   Generate      — it composes or produces (INS / SYN / REC)
// Each dimension therefore has one HOME cell; a value takes its home unless
// a measured entry says otherwise. Per-value distinctions are asserted only
// where they were measured — the table does not invent precision.
const HOME = Object.freeze({
  // Existence — the nominal system
  PronType: ["SIG", "Figure"],   // anchors a being to the discourse
  Poss: ["CON", "Pattern"],      // a possessor relation, as Gen is
  Reflex: ["SIG", "Ground"],     // anchored to the clause's own frame
  Gender: ["NUL", "Pattern"],    // divides beings into kinds
  Animacy: ["NUL", "Pattern"],
  NounClass: ["NUL", "Pattern"],
  Number: ["SIG", "Pattern"],    // measured values below; others take the plural's cell
  Definite: ["SIG", "Pattern"],  // cube.js: Kind = definiteness
  Deixis: ["SIG", "Ground"],     // anchored to the speaker's ground
  DeixisRef: ["SIG", "Ground"],
  NumType: ["DEF", "Figure"],    // cardinality: how many
  Degree: ["EVA", "Figure"],     // comparison is an evaluation
  // Structure — case, where it is not measured, is a relation to the setting
  Case: ["CON", "Ground"],
  // Interpretation — the verbal and functional system
  VerbForm: ["SEG", "Pattern"],
  Mood: ["EVA", "Pattern"],      // non-indicative moods are evaluated worlds
  Tense: ["REC", "Pattern"],
  Aspect: ["SIG", "Pattern"],
  Voice: ["REC", "Figure"],      // a non-active voice re-takes the argument
  Evident: ["EVA", "Ground"],    // how the clause is known: its warrant
  Polarity: ["DEF", "Ground"],   // the cut that makes the frame not-so
  Person: ["INS", "Figure"],
  Polite: ["EVA", "Figure"],     // cube.js: Lens = voice/person, the tenor
  Clusivity: ["SIG", "Ground"],  // speaker-anchored, as first person is
});

/** Declared per-value refinements, each with its reason. Kept small on
 *  purpose: a refinement that no measurement supports is a guess. */
const DECLARED_VALUES = Object.freeze({
  Case: {
    Erg: [["SEG", "Figure"], "the distinguished agent, as Nom is"],
    Abs: [["CON", "Figure"], "the bound core argument, as Acc is"],
    Par: [["CON", "Pattern"], "a part-of relation, as Gen is"],
    Ess: [["INS", "Figure"], "a state the being is in"],
    Tra: [["INS", "Figure"], "a state the being becomes"],
  },
  Tense: { Imp: [["REC", "Pattern"], "a past, as Past is"], Pqp: [["REC", "Pattern"], "a past before a past"] },
  Aspect: {
    Prosp: [["SYN", "Pattern"], "a coming event, as Fut is"],
    Hab: [["SIG", "Pattern"], "a recurring event, as Prog is"],
    Iter: [["SIG", "Pattern"], "a repeated event, as Prog is"],
  },
  VerbForm: {
    Sup: [["SYN", "Figure"], "a non-finite complement, as Inf is"],
    Gdv: [["DEF", "Pattern"], "a verbal adjective of obligation, as Ger is"],
    Vnoun: [["DEF", "Pattern"], "a verbal noun, as Ger is"],
  },
  Person: { "0": [["INS", "Figure"], "an impersonal third"], "4": [["INS", "Figure"], "an obviative third"] },
});

// Language-specific dimensions attested in our treebanks. Each is placed by
// what it does, with its reason, so it cannot enter the record unaddressed.
const LANGUAGE_SPECIFIC = Object.freeze({
  HebBinyan: [["REC", "Figure"], "Hebrew verb pattern: derivational voice and valency, as Voice is"],
  HebExistential: [["NUL", "Ground"], "an existential predicate: what is there at all"],
  AdvType: [["CON", "Ground"], "the setting an adverb places the event in"],
  AdpType: [["CON", "Ground"], "which side of its nominal a relation marker sits"],
  PartType: [["EVA", "Pattern"], "a particle's discourse function"],
  ConjType: [["SYN", "Pattern"], "how a conjunction composes"],
  VerbType: [["SYN", "Figure"], "a copula composes a predicate"],
  NumValue: [["DEF", "Figure"], "a numeral's value: how many"],
});

// ── RELATIONS: placed by UD's own two-way taxonomy ──────────────────────────
// UD arranges its relations in a table. COLUMNS say what the dependent is to
// the clause: a core argument, a non-core dependent, or a dependent inside a
// nominal. ROWS say what kind of thing the dependent is. Relations are all in
// the Structure domain, so:
//   column → grain   core = Figure (Link, the core), non-core = Ground
//                     (Field, the setting), nominal = Pattern (Network)
//   row    → mode    nominal = Differentiate (SEG), clause = Generate (SYN),
//                     modifier word / function word = Relate (CON)
// The groups UD sets outside that table — coordination, multiword units,
// loose joining, repair, punctuation, the root — are placed by what they do.
const REL_TABLE = Object.freeze({
  nsubj: ["SEG", "Figure"], obj: ["SEG", "Figure"], iobj: ["SEG", "Figure"],
  csubj: ["SYN", "Figure"], ccomp: ["SYN", "Figure"], xcomp: ["SYN", "Figure"],
  obl: ["SEG", "Ground"], vocative: ["SEG", "Ground"], expl: ["SEG", "Ground"], dislocated: ["SEG", "Ground"],
  advcl: ["SYN", "Ground"],
  advmod: ["CON", "Ground"], discourse: ["CON", "Ground"],
  aux: ["CON", "Ground"], cop: ["CON", "Ground"], mark: ["CON", "Ground"],
  nmod: ["SEG", "Pattern"], appos: ["SEG", "Pattern"], nummod: ["SEG", "Pattern"],
  acl: ["SYN", "Pattern"],
  amod: ["CON", "Pattern"],
  det: ["CON", "Pattern"], clf: ["CON", "Pattern"], case: ["CON", "Pattern"],
  // outside the table
  conj: ["SYN", "Pattern"], cc: ["CON", "Pattern"],          // coordination composes a network
  fixed: ["SYN", "Figure"], flat: ["SYN", "Figure"], compound: ["SYN", "Figure"], // several words, one figure
  list: ["SEG", "Pattern"], parataxis: ["SEG", "Pattern"],    // loosely joined: a cut between units
  orphan: ["SEG", "Pattern"],                                  // an ellipsis: the head is the cut
  goeswith: ["SYN", "Figure"],                                 // one word split in two
  reparandum: ["SEG", "Ground"],                               // a repair: the frame was cut and redone
  punct: ["SEG", "Ground"],                                    // the frame's own boundaries
  root: ["SYN", "Ground"],                                     // the clause frame itself
  dep: ["CON", "Ground"],                                      // a relation the annotator could not type
});

// ── WORD CLASSES ────────────────────────────────────────────────────────────
// The three entries grain-typing.js already uses are kept (verb, adposition,
// conjunction); the rest follow the department rule.
const UPOS_TABLE = Object.freeze({
  NOUN: ["SIG", "Figure"], PROPN: ["SIG", "Figure"], PRON: ["SIG", "Figure"], // beings
  ADJ: ["NUL", "Pattern"],                                                    // a quality: what kind
  NUM: ["DEF", "Figure"],                                                     // how many
  DET: ["SIG", "Pattern"],                                                    // definiteness
  VERB: ["CON", "Figure"],                                                    // grain-typing.js: verb → Link
  ADP: ["CON", "Ground"],                                                     // grain-typing.js: adposition → Field
  CCONJ: ["SEG", "Figure"], SCONJ: ["SEG", "Figure"],                         // grain-typing.js: conjunction
  AUX: ["EVA", "Pattern"],                                                    // the finite carrier of tense and mood
  ADV: ["CON", "Ground"],                                                     // the setting
  PART: ["EVA", "Pattern"],                                                   // polarity, question, focus
  INTJ: ["EVA", "Ground"],                                                    // the speaker's atmosphere
  PUNCT: ["SEG", "Ground"], SYM: ["SEG", "Ground"],
  X: ["NUL", "Ground"],                                                       // unclassified: the honest void
});

const addr = ([op, grain], basis, reason = null) => {
  const c = cellOf(op, grain);
  return Object.freeze({ op, grain, domain: c.domain, terrain: c.terrain, cell: `${op}·${grain}`, basis, ...(reason ? { reason } : {}) });
};

/** Split a UD feature name into its dimension and layer: `Number[psor]` →
 *  { dim: "Number", layer: "psor" }. A layered feature belongs to a
 *  different participant (the possessor, the absolutive argument…) and
 *  takes the same cell as its plain dimension, with the layer kept. */
export function splitFeature(name) {
  const m = /^([A-Za-z]+)(?:\[([a-z0-9]+)\])?$/.exec(String(name ?? ""));
  return m ? { dim: m[1], layer: m[2] ?? null } : { dim: String(name ?? ""), layer: null };
}

/** The cube address of a feature value, or `{ form: true }` for a surface
 *  feature, or `null` when the taxonomy does not place it (a gap). */
export function addressOfFeature(name, value) {
  const { dim, layer } = splitFeature(name);
  const v = String(value ?? "");
  if (FORM_FEATURES.has(dim)) return Object.freeze({ form: true, dim, layer });
  const measured = CELL_OF_GRAMMAR[dim]?.[v];
  if (measured) return withLayer(addr(measured, "measured"), layer);
  const refined = DECLARED_VALUES[dim]?.[v];
  if (refined) return withLayer(addr(refined[0], "declared", refined[1]), layer);
  if (LANGUAGE_SPECIFIC[dim]) return withLayer(addr(LANGUAGE_SPECIFIC[dim][0], "declared", LANGUAGE_SPECIFIC[dim][1]), layer);
  if (HOME[dim] && (!UD_FEATURES[dim] || UD_FEATURES[dim].includes(v))) return withLayer(addr(HOME[dim], "declared", `${dim}'s home cell`), layer);
  return null;
}
const withLayer = (a, layer) => (layer ? Object.freeze({ ...a, layer }) : a);

/** The cube address of a relation. A subtype (`nmod:poss`, `obl:tmod`)
 *  takes its universal relation's cell and keeps the subtype. */
export function addressOfRelation(deprel) {
  const [base, sub = null] = String(deprel ?? "").split(":");
  const t = REL_TABLE[base];
  if (!t) return null;
  const a = addr(t, "declared", "UD's own relation taxonomy: column → grain, row → mode");
  return sub ? Object.freeze({ ...a, subtype: sub }) : a;
}

/** The cube address of a word class. */
export function addressOfUpos(upos) {
  const t = UPOS_TABLE[String(upos ?? "")];
  return t ? addr(t, "declared", "the department rule") : null;
}

/** Everything in the UD v2 inventory that this taxonomy fails to place.
 *  An empty result is what "taxonomically complete" means, as a fact. */
export function taxonomyGaps() {
  const gaps = [];
  for (const u of UD_UPOS) if (!addressOfUpos(u)) gaps.push({ kind: "upos", item: u });
  for (const r of UD_DEPRELS) if (!addressOfRelation(r)) gaps.push({ kind: "deprel", item: r });
  for (const [dim, values] of Object.entries(UD_FEATURES)) {
    for (const v of values) if (!addressOfFeature(dim, v)) gaps.push({ kind: "feature", item: `${dim}=${v}` });
  }
  return gaps;
}

/** Which of the 27 cells the taxonomy reaches, and how often. A cell no
 *  grammatical category lands in is a place the universal grammar has
 *  nothing to say — worth knowing, never assumed to be a defect. */
export function cellCoverage() {
  const hits = new Map();
  const bump = (a, what) => { if (!a || a.form) return; const k = a.cell; if (!hits.has(k)) hits.set(k, []); hits.get(k).push(what); };
  for (const u of UD_UPOS) bump(addressOfUpos(u), `UPOS ${u}`);
  for (const r of UD_DEPRELS) bump(addressOfRelation(r), `rel ${r}`);
  for (const [dim, values] of Object.entries(UD_FEATURES)) for (const v of values) bump(addressOfFeature(dim, v), `${dim}=${v}`);
  const ops = ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"];
  const out = [];
  for (const op of ops) for (const grain of ["Ground", "Figure", "Pattern"]) {
    const k = `${op}·${grain}`;
    out.push({ cell: k, terrain: cellOf(op, grain).terrain, count: hits.get(k)?.length ?? 0, sample: (hits.get(k) ?? []).slice(0, 4) });
  }
  return out;
}
