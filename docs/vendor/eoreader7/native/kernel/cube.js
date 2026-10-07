// EOReader 7 native cube algebra.
//
// This is intentionally smaller than the historical engine/operators.js.
// The kernel needs only the closed EO algebra. App verbs, organ routing,
// and historical registries remain compatibility concerns.
//
// THE WHEEL, IN THE CUBE (native/docs/THE-WHEEL.md). The three grains are
// the wheel's registers: Ground is the Void (the hub, the rebuilt ground),
// Figure is the Beings (the spokes, the particulars), Pattern is the Fold
// (the rim, the difference the being made). 0 / n / 1.

export const MODES = Object.freeze(["Differentiate", "Relate", "Generate"]);
export const DOMAINS = Object.freeze(["Existence", "Structure", "Interpretation"]);
export const GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);

const OP_MODE = Object.freeze({
  NUL: "Differentiate",
  SIG: "Relate",
  INS: "Generate",
  SEG: "Differentiate",
  CON: "Relate",
  SYN: "Generate",
  DEF: "Differentiate",
  EVA: "Relate",
  REC: "Generate",
});

const OP_DOMAIN = Object.freeze({
  NUL: "Existence",
  SIG: "Existence",
  INS: "Existence",
  SEG: "Structure",
  CON: "Structure",
  SYN: "Structure",
  DEF: "Interpretation",
  EVA: "Interpretation",
  REC: "Interpretation",
});

export const TERRAIN_BY_DOMAIN = Object.freeze({
  Existence: Object.freeze({ Ground: "Void", Figure: "Entity", Pattern: "Kind" }),
  Structure: Object.freeze({ Ground: "Field", Figure: "Link", Pattern: "Network" }),
  Interpretation: Object.freeze({ Ground: "Atmosphere", Figure: "Lens", Pattern: "Paradigm" }),
});

export const STANCE_BY_MODE = Object.freeze({
  Differentiate: Object.freeze({ Ground: "Clearing", Figure: "Dissecting", Pattern: "Unraveling" }),
  Relate: Object.freeze({ Ground: "Tending", Figure: "Binding", Pattern: "Tracing" }),
  Generate: Object.freeze({ Ground: "Cultivating", Figure: "Making", Pattern: "Composing" }),
});

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

export const cellOf = (op, grain) => {
  if (!OP_MODE[op]) return gap("unknown_spec", { reason: `no such operator: ${op}`, known: Object.keys(OP_MODE) });
  if (!GRAINS.includes(grain)) return gap("unknown_spec", { reason: `no such grain: ${grain}`, known: GRAINS });
  const mode = OP_MODE[op];
  const domain = OP_DOMAIN[op];
  return Object.freeze({ op, grain, mode, domain, terrain: TERRAIN_BY_DOMAIN[domain][grain], stance: STANCE_BY_MODE[mode][grain] });
};

// Is this operator code one the CURRENT epoch admits? The historical engine
// carried this beside an OPERATOR_EPOCH string and an ALT/SUP-era registry;
// here it is simply the question `cellOf` already answers internally, exposed
// so a caller can ask it WITHOUT provoking a typed gap it would then have to
// unwrap. The nine are the nine — README's own "ALT and SUP are not canonical
// operators" is this function's whole content.
/**
 * THE OPERATOR CHAIN, DERIVED — never a literal (2026-09-01).
 *
 * The canonical sequence is domain-major x mode: for each domain in
 * DOMAINS order, its Differentiate / Relate / Generate operators. That is
 * CUBE.md line 39's own enumeration and the handbook's strict dependency
 * chain ("of nearly thirteen hundred possible orderings, only this one
 * survives basic consistency checks"), lineage eoreader4.1 core/operators.js.
 *
 * It is derived here rather than typed because it ALREADY LIVES in this
 * file's own OP_MODE/OP_DOMAIN tables, and a restatement of a table that
 * sits ten lines above it is exactly how the divergence this replaces
 * happened: task-log.js carried a hand-written OPERATOR_ORDER whose header
 * said "nothing is restated here", and it had drifted from the tables it
 * was restating. Audited 2026-09-01 against every operator-typed entry on
 * disk and against the full native suite: neither could tell the two
 * orderings apart, so the divergence was protecting nothing measurable —
 * the burden was on the divergence, and it was not met.
 */
export const OPERATOR_CHAIN = Object.freeze(
  DOMAINS.flatMap((domain) =>
    MODES.map((mode) => Object.keys(OP_MODE).find((op) => OP_DOMAIN[op] === domain && OP_MODE[op] === mode))
  ).filter(Boolean)
);

export const isCurrentOperator = (op) => Object.prototype.hasOwnProperty.call(OP_MODE, op);

// ── THE CUBE AS A UNIVERSAL GRAMMAR (2026-09-17) ───────────────────────────
// The cube is not just an operator algebra — it GENERATES the grammatical
// category space every language's morphology projects onto. A language's
// case/person/number/tense/etc. are not a separate grammar; they are the
// cube's cells worn by that language's surfaces. The three domains are the
// three grammatical departments:
//   Existence       what is           -> the nominal system (Entity=being,
//                                        Kind=definiteness, Void=impersonal)
//   Structure       how it is arranged -> the syntax (Field=oblique/setting,
//                                        Link=transitive core, Network=clause)
//   Interpretation  what it means      -> the verbal/functional system
//                                        (Atmosphere=mood, Lens=voice/person,
//                                        Paradigm=tense-aspect)
// The three grains are the clause positions: Ground=the clause frame,
// Figure=the argument, Pattern=the agreement system.
//
// DECLARED, REVISABLE THEORY — written once, consumed by the one-master
// case-prior builder (scripts/build-latin-case-prior.mjs) and by the Greek
// person tier (eval/lavar/greek.mjs), so a language's morphological prior
// carries its cube cell and the reader reads in language-independent cells.
//
// PROVENANCE (2026-09-17): derived by consequence, not assertion — the map's
// cells are the ones the UD_Ancient_Greek-PROIEL and UD_Ancient_Greek-Perseus
// endings actually settle to when tallied (see live_priors/digested/
// GREEK-FLUENCY-LESSONS.md, lessons 5-6, 11): Person 2 -> SIG·Figure, 1 ->
// SIG·Ground, 3 -> INS·Figure; Nom -> SEG·Figure, Acc -> CON·Figure, Gen ->
// CON·Pattern, Dat -> CON·Ground; voice -> the Lens, mood -> the Atmosphere,
// tense -> the Paradigm. The mapping is the theory; the priors are its
// measurement.
export const CELL_OF_GRAMMAR = Object.freeze({
  Case: { Nom: ["SEG", "Figure"], Acc: ["CON", "Figure"], Gen: ["CON", "Pattern"], Dat: ["CON", "Ground"], Voc: ["SIG", "Ground"], Loc: ["SIG", "Ground"], Ins: ["SIG", "Pattern"], Abl: ["SEG", "Ground"] },
  Person: { "1": ["SIG", "Ground"], "2": ["SIG", "Figure"], "3": ["INS", "Figure"] },
  Number: { Sing: ["SIG", "Figure"], Plur: ["SIG", "Pattern"], Dual: ["SIG", "Ground"] },
  VerbForm: { Fin: ["EVA", "Pattern"], Part: ["SEG", "Pattern"], Inf: ["SYN", "Figure"], Ger: ["DEF", "Pattern"] },
  Mood: { Ind: ["EVA", "Ground"], Sub: ["EVA", "Pattern"], Opt: ["EVA", "Pattern"], Imp: ["NUL", "Ground"] },
  Voice: { Act: ["EVA", "Figure"], Pass: ["REC", "Figure"], Mid: ["REC", "Ground"] },
  Tense: { Past: ["REC", "Pattern"], Pres: ["EVA", "Figure"], Fut: ["SYN", "Pattern"] },
  Aspect: { Imp: ["NUL", "Ground"], Perf: ["INS", "Pattern"], Prog: ["SIG", "Pattern"] },
});

/** grammarCell(feature, value) — the cube cell of a grammatical feature
 * value (Case=Nom, Person=2, …), or null when unmapped. The universal
 * grammar's projection surface. */
export function grammarCell(feature, value) {
  const c = CELL_OF_GRAMMAR[feature]?.[String(value)];
  return c ? cellOf(c[0], c[1]) : null;
}

// Algebra enumeration groups by operator. This is useful for validating the
// closed operator×grain algebra, but recursive interrogation uses a different,
// semantically meaningful traversal order exposed as cubeAddresses().
export const algebraAddresses = () => Object.freeze(
  Object.keys(OP_MODE).flatMap((op) => GRAINS.map((grain) => cellOf(op, grain))),
);
