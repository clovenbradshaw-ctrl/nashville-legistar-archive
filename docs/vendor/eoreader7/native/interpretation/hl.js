// the legacy engine · engine/interpretation/hl — HL, a content-general logic for
// the Interpretation domain (DEF SIG EVA... no: DEF EVA REC — the kernel's
// own "Significance triad", same domain `operators.js` calls
// Interpretation). Re-earned as engine code, not left in an application
// repo, on the same evidence Article I.2 already asks for: does this
// mechanism work identically regardless of what content it's aimed at.
//
// WHY THIS DOMAIN, STATED FROM EVIDENCE NOT INSTINCT. `operators.js`'s own
// ORGANS table, grouped by OP_DOMAIN (2026-08-20 audit): Existence's 11
// organs cluster around ONE shared statistical engine (`nul/index.js` —
// ground/difference/censored/reZero, itself cross-cutting rather than
// domain-exclusive: it also supplies EVA's Figure act and REC's Ground
// act). Structure's 20 organs extract and bind (`perceiver/text/
// relations.js`, `emergence/binding.js`) but its VERDICT layer — bound /
// contradicted / unbound, `judge()` — was never promoted to the engine;
// it lives downstream in an application repo (the-fold's hypergraph.js),
// consuming these primitives rather than sitting beside them.
// Interpretation is the largest group by far — 29 of 62 organs, nearly
// half the registry — and the most fragmented: NINE separate EVA-Pattern
// modules (competency/ledger.js, emergence/jati.js, emergence/revision.js,
// search/index.js, loops/{grain,samanya,time,read-level0}.js,
// host/reading.js), each hand-rolling its own "does this claim hold as a
// general pattern" logic, with no shared judgment engine underneath any
// of them. HL is that engine, landed where the fragmentation already was
// worst, not asserted as a good place to put it.
//
// WHAT HL IS. Models are STAGES — finite, append-only hypergraphs (any
// domain's own edges; this file knows nothing about text, relations, or
// the-fold). Inference rules are content-general (R1 match, R2 functional
// exclusion, R3 negation involution, R4 polarity-split persistence, R5
// grain-theorem quantifiers, R6 transitive composition). Verdicts are
// judgment outcomes, not truth values: Belnap–Dunn FDE
// (bound/contradicted/contested/unbound) plus beyond-reach as genuine
// inexpressibility outside that lattice, absorbing through every
// compound.
//
// MEDIUM-BLINDNESS, THE SAME CLAIM grid.js's own header already makes for
// terrain ("a single DEF means the same act whether defining a variable,
// a character, a policy, or a hypothesis"): HL's atomic claims (r(s,o))
// are Structure-domain SHAPE — an edge is an edge, whichever domain its
// endpoints came from. HL performs an Interpretation-domain ACT on that
// shape: judging it against DECLARED general rules, never against
// content it derives itself. That is not a category confusion between
// Structure and Interpretation; it is the same medium-blindness the cube
// already claims everywhere else, now instantiated in a logic instead of
// asserted about one.
//
// THE GIVER DISCIPLINE. Declarations (functional / transitive / complete)
// are exactly as strong as their acquisition — this module makes their
// USE sound, never their acquisition free. Every declaration requires a
// named giver or is refused, typed. Edges require provenance the same
// way. Acquiring declarations mechanically, at need, is a caller's job
// (the-fold's hl-acquire.js is one such caller) — this file holds the
// engine, never the evidence for any specific declaration.
//
// R5's STATUS, kept precise. The no-upward-entailment result (∀ over an
// open domain never binds at a finite stage) is a theorem of any GATING
// (pure-precondition) construction. Whether the cube's own semantics is
// gating-only or "attractor-obligated" (lower tiers completing a
// disjunction of upper cells, not merely unlocking free choice among
// them) was left explicitly open in the source record that motivated
// this probe and is NOT settled by anything in this file. If the
// attractor reading ever earns its own semantics, R5's open-domain
// clause is the one line here that would change.
//
// Zero imports. Zero engine-organ dependencies. Anything that needs this
// logic injects edges and declarations from its own data — the same
// posture nul/index.js holds for its own statistics.

export const BOUND = "bound";
export const CONTRADICTED = "contradicted";
export const CONTESTED = "contested";
export const UNBOUND = "unbound";
export const BEYOND_REACH = "beyond-reach";
export const UNREFUTED = "unrefuted@stage";
export const UNDETERMINED = "undetermined";

// R3: negation is the FDE involution — swaps bound/contradicted, fixes
// contested, unbound, beyond-reach (each its own fixed point).
export function flip(v) {
  if (v === BOUND) return CONTRADICTED;
  if (v === CONTRADICTED) return BOUND;
  return v;
}

const refuse = (type, detail) => {
  const e = new Error(`hl: ${type} — ${detail}`);
  e.refused = { type, detail };
  return e;
};

const edgeKey = (e) => JSON.stringify([e.rel, e.s, e.o, e.key ?? null, e.polarity]);

/** A stage: finite hypergraph, append-only. Build with the add/declare
 * functions; combine with extendStage. Plain object, no class, so a
 * caller can serialize or inspect it with nothing engine-specific. */
export function createStage() {
  return {
    anchors: new Set(),
    types: new Map(), // anchor -> type tag (optional)
    edges: new Map(), // edgeKey -> {rel, s, o, key, polarity, source}
    functional: new Map(), // rel -> {giver}
    transitive: new Map(), // rel -> {giver}
    complete: new Map(), // domainName -> {anchors: Set, giver}
  };
}

export function addAnchor(stage, id, type = null) {
  stage.anchors.add(id);
  if (type != null) stage.types.set(id, type);
  return stage;
}

export function addEdge(stage, { rel, s, o, key = null, polarity = "+", source }) {
  if (!rel || s == null || o == null) throw refuse("malformed_edge", "rel, s, o are required");
  if (polarity !== "+" && polarity !== "-")
    throw refuse("malformed_edge", `polarity must be "+" or "-", got ${JSON.stringify(polarity)}`);
  if (!source) throw refuse("no_provenance", `edge ${rel}(${s}, ${o}) carries no source — provenance is required`);
  const e = { rel, s, o, key, polarity, source };
  const k = edgeKey(e);
  const prior = stage.edges.get(k);
  if (prior) {
    const sources = new Set([].concat(prior.source, source));
    stage.edges.set(k, { ...prior, source: [...sources] });
  } else {
    stage.edges.set(k, e);
  }
  return stage;
}

const requireGiver = (giver, what) => {
  if (!giver || typeof giver !== "string")
    throw refuse("no_giver", `${what} requires a named giver — a declaration is exactly as strong as its acquisition`);
};

export function declareFunctional(stage, rel, { giver } = {}) {
  requireGiver(giver, `functional(${rel})`);
  stage.functional.set(rel, { giver });
  return stage;
}

export function declareTransitive(stage, rel, { giver } = {}) {
  requireGiver(giver, `transitive(${rel})`);
  stage.transitive.set(rel, { giver });
  return stage;
}

export function declareComplete(stage, domainName, anchors, { giver } = {}) {
  requireGiver(giver, `complete(${domainName})`);
  stage.complete.set(domainName, { anchors: new Set(anchors), giver });
  return stage;
}

/** Append-only union: everything in both, nothing retracted. Returns a
 * NEW stage; neither input is touched. */
export function extendStage(a, b) {
  const s = createStage();
  for (const st of [a, b]) {
    for (const id of st.anchors) s.anchors.add(id);
    for (const [id, t] of st.types) s.types.set(id, t);
    for (const [k, e] of st.edges) {
      const prior = s.edges.get(k);
      if (prior) {
        const sources = new Set([].concat(prior.source, e.source));
        s.edges.set(k, { ...prior, source: [...sources] });
      } else s.edges.set(k, { ...e });
    }
    for (const [rel, d] of st.functional) s.functional.set(rel, d);
    for (const [rel, d] of st.transitive) s.transitive.set(rel, d);
    for (const [dn, d] of st.complete) s.complete.set(dn, { anchors: new Set(d.anchors), giver: d.giver });
  }
  return s;
}

// R6: transitive composition, derived provenance recording the chain.
// Computed fresh per read — a stage is small at claim-checking scale, and
// caching a closure on a mutable stage is a staleness bug waiting to land.
function closureEdges(stage) {
  const E = new Map(stage.edges);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rel of stage.transitive.keys()) {
      const pos = [...E.values()].filter((e) => e.rel === rel && e.polarity === "+");
      for (const a of pos) {
        for (const b of pos) {
          if (a.o !== b.s) continue;
          const derived = { rel, s: a.s, o: b.o, key: null, polarity: "+", source: `derived(${rel}: ${a.s}→${a.o}→${b.o})` };
          const k = edgeKey(derived);
          if (!E.has(k)) {
            E.set(k, derived);
            changed = true;
          }
        }
      }
    }
  }
  return [...E.values()];
}

/** R1 + R2: atomic verdict. `definite` marks a definite description —
 * "THE r of s" — which presupposes a unique binding (Russell's clause);
 * multiple distinct bound objects for (s, any key) is presupposition
 * failure, verdict contested, before any match is attempted. */
export function atomic(stage, rel, s, o, key = null, { definite = false } = {}) {
  if (!stage.anchors.has(s) || !stage.anchors.has(o)) return BEYOND_REACH;
  const E = closureEdges(stage);
  if (definite && key == null && stage.functional.has(rel)) {
    const objs = new Set(E.filter((e) => e.rel === rel && e.s === s && e.polarity === "+").map((e) => e.o));
    if (objs.size > 1) return CONTESTED;
  }
  const hit = (pol) =>
    E.some((e) => e.rel === rel && e.s === s && e.o === o && (key == null || e.key === key) && e.polarity === pol);
  const sup = hit("+");
  let ctr = hit("-");
  // R2 functional exclusion: for a functional relation, a DIFFERENT bound
  // object at the same (s, key) contradicts this one — the rule that
  // retires per-error-class patches (numeric substitution among them).
  if (stage.functional.has(rel) && !sup) {
    const others = E.filter(
      (e) => e.rel === rel && e.s === s && e.polarity === "+" && (key == null || e.key === key),
    );
    if (others.some((e) => e.o !== o)) ctr = true;
  }
  if (sup && ctr) return CONTESTED;
  if (sup) return BOUND;
  if (ctr) return CONTRADICTED;
  return UNBOUND;
}

// ∧ (meet) / ∨ (join), computed the way canonical FDE actually defines
// them: each verdict is TWO independent supports — is there evidence FOR
// the claim, is there evidence AGAINST it — and ∧/∨ combine those two
// supports separately (∧: both-for / either-against; ∨: either-for /
// both-against). This is NOT the same thing as sorting the four verdicts
// into one line and taking min/max of that line's index — a single line
// cannot encode two independent bits, and CONTESTED (for-and-against) vs
// UNBOUND (neither) is exactly the pair a linear order gets wrong: a
// prior version of this file used TRUTH_ORDER =
// [CONTRADICTED, CONTESTED, UNBOUND, BOUND] and took min/max of its
// index, which reproduces the real FDE table everywhere EXCEPT
// AND(CONTESTED, UNBOUND) (linear order: CONTESTED; canonical FDE, "both
// AND neither": CONTRADICTED — neither side has both a for and the
// against the other side lacks, so the conjunction is falsity-supported)
// and OR(CONTESTED, UNBOUND) (linear order: UNBOUND; canonical: "both OR
// neither" = BOUND). Verified against the canonical two-support
// definition by exhaustive case (all 16 ordered pairs × 2 operators) —
// conformance/hl-compound.test.mjs's own cross-term case pins this pair
// specifically, not just the cases a linear order already gets right.
// beyond-reach still absorbs in BOTH, ahead of this table entirely: a
// compound with an inexpressible part is not evaluable — evaluating the
// rest and calling it the whole would be a silent lie about reach.
const SUPPORT_OF = {
  [BOUND]: [true, false],
  [CONTRADICTED]: [false, true],
  [CONTESTED]: [true, true],
  [UNBOUND]: [false, false],
};
const VERDICT_OF_SUPPORT = new Map(
  Object.entries(SUPPORT_OF).map(([verdict, [forSup, againstSup]]) => [`${forSup}:${againstSup}`, verdict]),
);
/** The one table from two independent supports to a verdict — exported so an
 * organ composing its own FOR and AGAINST evidence (identity-verdict.js) reads
 * the same lattice instead of restating it (nagarjuna: one lattice). */
export function verdictOfSupport(forSupport, againstSupport) {
  return VERDICT_OF_SUPPORT.get(`${Boolean(forSupport)}:${Boolean(againstSupport)}`);
}
function fdeAnd(a, b) {
  const [fa, aa] = SUPPORT_OF[a];
  const [fb, ab] = SUPPORT_OF[b];
  return VERDICT_OF_SUPPORT.get(`${fa && fb}:${aa || ab}`);
}
function fdeOr(a, b) {
  const [fa, aa] = SUPPORT_OF[a];
  const [fb, ab] = SUPPORT_OF[b];
  return VERDICT_OF_SUPPORT.get(`${fa || fb}:${aa && ab}`);
}

/** Read a claim against a stage. Claim grammar (arrays):
 *   ["atom", rel, s, o, key?]        — atomic edge claim
 *   ["the",  rel, s, o, key?]        — definite description (presupposes uniqueness)
 *   ["not", phi] / ["and", a, b] / ["or", a, b]
 *   ["exists", type|null, body]      — body: (anchor) => phi
 *   ["forall", type|null, body, domainName]
 * Types genuinely restrict: an out-of-type counterexample cannot refute a
 * typed ∀ (probed adversarially before this landed). */
export function read(stage, phi) {
  const op = phi[0];
  if (op === "atom") return atomic(stage, phi[1], phi[2], phi[3], phi[4] ?? null);
  if (op === "the") return atomic(stage, phi[1], phi[2], phi[3], phi[4] ?? null, { definite: true });
  if (op === "not") return flip(read(stage, phi[1]));
  if (op === "and" || op === "or") {
    const a = read(stage, phi[1]);
    const b = read(stage, phi[2]);
    if (a === BEYOND_REACH || b === BEYOND_REACH) return BEYOND_REACH;
    if (a === UNREFUTED || b === UNREFUTED)
      throw refuse("quantifier_in_compound", "an open-domain ∀ verdict is stage-indexed and does not compose through ∧/∨ — read it alone");
    return op === "and" ? fdeAnd(a, b) : fdeOr(a, b);
  }
  if (op === "exists") {
    const [, typ, body] = phi;
    const dom = [...stage.anchors].sort().filter((a) => typ == null || stage.types.get(a) === typ);
    const vs = dom.map((a) => read(stage, body(a)));
    if (vs.includes(BOUND)) return BOUND; // verifiable; persistent once bound (R5)
    if (vs.includes(CONTESTED)) return CONTESTED;
    return UNBOUND;
  }
  if (op === "forall") {
    const [, typ, body, domainName] = phi;
    const declared = stage.complete.get(domainName);
    if (declared) {
      // The postulation route: a declared-complete domain reduces ∀ to a
      // finite conjunction. The declaration's giver carries the weight.
      const vs = [...declared.anchors].map((a) => read(stage, body(a)));
      if (vs.includes(CONTRADICTED)) return CONTRADICTED;
      if (vs.length && vs.every((v) => v === BOUND)) return BOUND;
      return UNBOUND;
    }
    // Open domain, R5 under the grain theorem: refutable (one persistent
    // counterexample), never bindable at any finite stage.
    const known = [...stage.anchors].sort().filter((a) => typ == null || stage.types.get(a) === typ);
    const vs = known.map((a) => read(stage, body(a)));
    if (vs.includes(CONTRADICTED)) return CONTRADICTED;
    return UNREFUTED;
  }
  throw refuse("unknown_form", String(op));
}

/** The judgment layer: attach(φ) = verdict(φ) + sensitivity(φ). A
 * verdict earns attachment only if perturbing the claim MOVES it — its
 * negation, and (for atoms on functional relations) its bound-slot
 * substitutions. An insensitive verdict downgrades to undetermined
 * rather than attaching: a verdict that reads the same on the claim and
 * its negation was never a judgment about THIS claim. */
export function attach(stage, phi) {
  const verdict = read(stage, phi);
  if (verdict === BEYOND_REACH || verdict === UNREFUTED) {
    // Not judgments: one is inexpressibility, the other is stage-indexed
    // non-refutation. Neither attaches; neither downgrades — reported as
    // themselves.
    return { verdict, attached: false, sensitivity: null };
  }
  const perturbations = [["negation", ["not", phi]]];
  if (phi[0] === "atom" || phi[0] === "the") {
    const [, rel, s, o, key = null] = phi;
    if (stage.functional.has(rel)) {
      const E = closureEdges(stage);
      const others = new Set(
        E.filter((e) => e.rel === rel && e.s === s && e.polarity === "+" && e.o !== o).map((e) => e.o),
      );
      for (const o2 of others) perturbations.push([`substitute:${o2}`, [phi[0], rel, s, o2, key]]);
    }
  }
  const moves = perturbations.map(([name, p]) => {
    let v;
    try {
      v = read(stage, p);
    } catch {
      v = null;
    }
    return { perturbation: name, verdict: v, moved: v !== null && v !== verdict };
  });
  const moved = moves.filter((m) => m.moved).length;
  const attached = moved > 0;
  return {
    verdict: attached ? verdict : UNDETERMINED,
    attached,
    sensitivity: { perturbed: moves.length, moved, detail: moves },
  };
}
