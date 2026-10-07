// Handle: Talmy — a claim is a Figure placed against a Ground; the relation is
// the Pattern. The word order a language uses to say it is a lens, not the claim.
// See also: the reading-competency audit that ran project()/readBack() against
// real (non-synthetic) extractor output for the first time —
// github.com/clovenbradshaw-ctrl/reading-training
// kernel/gfp-claim.js — A CLAIM AS GROUND · FIGURE · PATTERN, AND ITS SURFACES.
//
// The user's direction (2026-09-22): "reasoning linting GFP at its core, and
// then SVO, SOV — all others — at higher holonic levels. Reason works at every
// level, respecting holons. It needs to work equally well for code."
//
// THE THREE GRAINS OF ONE CLAIM (the cube's GRAINS, kernel/cube.js):
//
//   GROUND   where it holds — a holon address ("/", "/p3", "/p3/2"; for code
//            "/src/a.js/Foo/bar/b2"). Two claims are compared only where their
//            grounds overlap (one contains the other); siblings never meet.
//   FIGURE   what it is about — its participants, keyed by ROLE, never by the
//            position a language happens to put them in. Roles are argument
//            slots of the relation (ARG0, ARG1, … — Dowty's proto-roles as
//            PropBank numbers them), because "France is the capital of Paris"
//            is a different claim from "Paris is the capital of France": the
//            roles make the difference, the order does not (the-fold's
//            grounding-gfp.js: "role assignment is the grammar; relation
//            identity is the meaning").
//   PATTERN  the relation itself — its label, its polarity, and whatever a
//            giver DECLARED about it: one-valued (and in which role), symmetric,
//            acyclic. Nothing about a relation is assumed from how it is said.
//
// THE SURFACES live one holonic level up and are never read by the core.
// Every claim-level lens is here: the six orders of S, V and O (WALS 81A,
// Dryer — the six that are logically possible), a case-marked free order
// (roles carried by marks, any order reads back the same), and code's three
// surfaces, which are the same orders again: infix is SVO ("x = 3"), prefix is
// VSO ("(= x 3)"), postfix is SOV ("x 3 =", Forth/RPN). `project` puts a claim
// into a lens; `readBack` is that lens's own role assignment coming back.
// Sentence-level order (a whole tree, measured per language) is eot-rich.js's
// `linearize`, the level above this one.
//
// IDENTITY IS DECLARED, NOT ASSUMED. The default is exact after NFKC and
// whitespace collapse — code's identifiers are case-sensitive, so a caseless
// default would merge `x` and `X`. Prose callers pass `caselessIdentity` or a
// referent resolver. PURE: no I/O, no model.

export const GFP_CLAIM_SCHEMA = "EOGfpClaim@1";

// ── GROUND: holon addresses ────────────────────────────────────────────────
/** A holon address, normalized: "/" is the whole; segments separated by "/".
 *  A code scope is given as segments too (file, class, function, block). */
export function holon(path) {
  const segs = String(path ?? "/").split("/").map((s) => s.trim()).filter(Boolean);
  return "/" + segs.join("/");
}
export const segmentsOf = (h) => holon(h).split("/").filter(Boolean);
export const depthOf = (h) => segmentsOf(h).length;
/** a is the same holon as b, or an ancestor of it. */
export function contains(a, b) {
  const A = segmentsOf(a), B = segmentsOf(b);
  if (A.length > B.length) return false;
  return A.every((s, i) => s === B[i]);
}
/** Two grounds meet only when one contains the other. Siblings never do. */
export const overlap = (a, b) => contains(a, b) || contains(b, a);
/** The smallest holon containing both. */
export function lca(a, b) {
  const A = segmentsOf(a), B = segmentsOf(b), out = [];
  for (let i = 0; i < Math.min(A.length, B.length) && A[i] === B[i]; i++) out.push(A[i]);
  return "/" + out.join("/");
}
/** Every holon from the whole down to h, inclusive. */
export function ancestry(h) {
  const segs = segmentsOf(h);
  return ["/", ...segs.map((_, i) => "/" + segs.slice(0, i + 1).join("/"))];
}

// ── identity ────────────────────────────────────────────────────────────────
const collapse = (s) => String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
/** Exact identity — the default, and correct for code (`x` is not `X`). */
export const exactIdentity = (s) => collapse(s);
/** Caseless identity for prose, via the root locale ("und"), disclosed. */
export const caselessIdentity = (s) => collapse(s).toLocaleLowerCase("und");

// ── FIGURE + PATTERN: the claim ─────────────────────────────────────────────
/**
 * gfpClaim({ ground, rel, roles, polarity, force, id, basis }) — one claim.
 *   roles     { ARG0: "x", ARG1: "3", … } — participants by role
 *   polarity  "+" asserted · "-" denied
 *   force     "default" — a deeper ground's claim overrides it inside that
 *             ground (a binding shadowed in an inner scope, a section's own
 *             local fact) · "strict" — it holds throughout its ground, so a
 *             deeper counterexample refutes it (an invariant, a universal)
 */
export function gfpClaim({ ground = "/", rel, roles = {}, polarity = "+", force = "default", id = null, basis = null } = {}) {
  if (!rel) throw new TypeError("gfp-claim: a claim needs a relation (its Pattern)");
  if (polarity !== "+" && polarity !== "-") throw new TypeError(`gfp-claim: polarity is "+" or "-", never ${polarity}`);
  if (force !== "default" && force !== "strict") throw new TypeError(`gfp-claim: force is "default" or "strict", never ${force}`);
  const r = {};
  for (const [k, v] of Object.entries(roles)) if (v != null && String(v).trim() !== "") r[k] = String(v);
  return Object.freeze({ schema: GFP_CLAIM_SCHEMA, ground: holon(ground), rel: String(rel), roles: Object.freeze(r), polarity, force, id, basis });
}
/** The bridge from a reader's triple (a note's end1/label/end2, already
 *  through the language's own role assignment): end1 is ARG0, end2 is ARG1.
 *  This is the ONE place a triple's two ends become roles. */
export function claimFromTriple(end1, rel, end2, opts = {}) {
  return gfpClaim({ ...opts, rel, roles: { ARG0: end1, ARG1: end2 } });
}

/** The Figure as an order-free key. `omit` drops one role (the value role of
 *  a one-valued relation). `symmetric` forgets which role a participant holds. */
export function figureKey(claim, { omit = null, symmetric = false, identity = exactIdentity } = {}) {
  const pairs = Object.entries(claim.roles).filter(([k]) => k !== omit).map(([k, v]) => [k, identity(v)]);
  if (symmetric) return pairs.map(([, v]) => v).sort().join("\u0001");
  return pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\u0001");
}
/** Pattern + Figure: the claim's identity, independent of ground and order. */
export function claimKey(claim, opts = {}) {
  const idf = opts.identity ?? exactIdentity;
  return `${idf(claim.rel)}\u0002${figureKey(claim, opts)}`;
}

// ── THE SURFACES (one holonic level up) ─────────────────────────────────────
/** WALS 81A's six orders of S, V, O. S = ARG0, V = the relation, O = ARG1. */
export const ORDERS = Object.freeze({
  SVO: Object.freeze(["S", "V", "O"]), SOV: Object.freeze(["S", "O", "V"]),
  VSO: Object.freeze(["V", "S", "O"]), VOS: Object.freeze(["V", "O", "S"]),
  OVS: Object.freeze(["O", "V", "S"]), OSV: Object.freeze(["O", "S", "V"]),
});
/** Code's surfaces are the same orders, with their own punctuation. */
export const CODE_SURFACES = Object.freeze({
  infix: Object.freeze({ order: "SVO", render: (t) => t.join(" ") }),
  prefix: Object.freeze({ order: "VSO", render: (t) => `(${t.join(" ")})` }),
  postfix: Object.freeze({ order: "SOV", render: (t) => t.join(" ") }),
});
export const LENSES = Object.freeze([...Object.keys(ORDERS), "case-marked", ...Object.keys(CODE_SURFACES)]);

const SLOT_ROLE = Object.freeze({ S: "ARG0", O: "ARG1" });
const orderOfLens = (lens) => ORDERS[lens] ?? ORDERS[CODE_SURFACES[lens]?.order] ?? null;

/**
 * project(claim, lens, { permutation }) → tokens [{ text, role }]. For an
 * order lens, position carries the role; roles beyond ARG0/ARG1 follow in
 * role order (disclosed). For "case-marked", every token carries its role as
 * a mark and the order is free — `permutation` (indices) chooses one.
 */
export function project(claim, lens, { permutation = null } = {}) {
  const extra = Object.keys(claim.roles).filter((k) => k !== "ARG0" && k !== "ARG1").sort();
  const tokOf = (slot) => (slot === "V" ? { text: claim.rel, role: "REL" } : { text: claim.roles[SLOT_ROLE[slot]], role: SLOT_ROLE[slot] });
  if (lens === "case-marked") {
    const toks = [...["S", "V", "O"].map(tokOf), ...extra.map((k) => ({ text: claim.roles[k], role: k }))].filter((t) => t.text != null);
    const marked = toks.map((t) => ({ ...t, text: `${t.text}·${t.role}` }));
    return permutation ? permutation.map((i) => marked[i]).filter(Boolean) : marked;
  }
  const order = orderOfLens(lens);
  if (!order) throw new TypeError(`gfp-claim: no such lens "${lens}" — known: ${LENSES.join(", ")}`);
  return [...order.map(tokOf), ...extra.map((k) => ({ text: claim.roles[k], role: k }))].filter((t) => t.text != null);
}
/** The surface string a lens would print. */
export function render(claim, lens, opts) {
  const texts = project(claim, lens, opts).map((t) => t.text);
  return CODE_SURFACES[lens] ? CODE_SURFACES[lens].render(texts) : texts.join(" ");
}
/**
 * readBack(texts, lens, { ground, polarity, force }) → a claim. The lens's own
 * role assignment: position for an order lens, the mark for "case-marked".
 * This is the language's eigenvalue coming back — the core never sees it.
 */
export function readBack(texts, lens, { ground = "/", polarity = "+", force = "default" } = {}) {
  if (lens === "case-marked") {
    const roles = {}; let rel = null;
    for (const t of texts) {
      const i = String(t).lastIndexOf("·");
      const word = String(t).slice(0, i), role = String(t).slice(i + 1);
      if (role === "REL") rel = word; else roles[role] = word;
    }
    return gfpClaim({ ground, rel, roles, polarity, force });
  }
  const order = orderOfLens(lens);
  if (!order) throw new TypeError(`gfp-claim: no such lens "${lens}"`);
  const roles = {}; let rel = null;
  order.forEach((slot, i) => { if (slot === "V") rel = texts[i]; else roles[SLOT_ROLE[slot]] = texts[i]; });
  return gfpClaim({ ground, rel, roles, polarity, force });
}

// ── LEAST-GENERAL-GENERALIZATION: N claims sharing a relation → one ─────────
// (2026-09-25, the-fold/arrange.js's thesis-synthesis design; read by the
// reading archons the same day.) Several claims that already share a
// relation AND a polarity are not yet one claim — this is the one place that
// combination happens, and it combines Figures, never words. A role survives
// only where every claim carries it and agrees (under `identity`); where
// they disagree nothing is dropped or voted out — every distinct value (one
// per identity) is kept, disclosed as VARYING, and a role some claim lacks
// is counted as ABSENT. A denial never generalizes with the assertions it
// denies (kernel/notes.js, THE CUT). No hand-set threshold: unanimous or
// disclosed, nothing between. PURE: no I/O, no model, no invented value.
/**
 * generalizeClaims(claims, { identity }) → EOGfpGeneralization@1. Throws if
 * fewer than two claims are given, or if they do not all share one relation
 * and one polarity — a generalization is only ever taken across claims
 * already agreed to be the same kind of claim (the caller's job, e.g. a
 * basin already grouped by relation and polarity).
 */
export function generalizeClaims(claims, { identity = exactIdentity } = {}) {
  if (!Array.isArray(claims) || claims.length < 2) throw new TypeError("gfp-claim: generalizeClaims needs at least 2 claims");
  const rel = claims[0].rel, polarity = claims[0].polarity;
  if (!claims.every((c) => c.rel === rel)) throw new TypeError("gfp-claim: generalizeClaims requires every claim to share one relation");
  if (!claims.every((c) => c.polarity === polarity)) throw new TypeError("gfp-claim: generalizeClaims requires every claim to share one polarity");
  const ground = claims.map((c) => c.ground).reduce((a, b) => lca(a, b));
  const keys = new Set(claims.flatMap((c) => Object.keys(c.roles)));
  const distinct = (values) => { const seen = new Map(); for (const v of values) { const k = identity(v); if (!seen.has(k)) seen.set(k, v); } return [...seen.values()]; };
  const agreed = {}, varying = {}, absent = {};
  for (const key of keys) {
    const values = claims.map((c) => c.roles[key]).filter((v) => v != null);
    const missing = claims.length - values.length;
    if (missing) absent[key] = missing;
    const kept = distinct(values);
    if (!missing && kept.length === 1) agreed[key] = kept[0]; else varying[key] = kept;
  }
  return Object.freeze({
    schema: "EOGfpGeneralization@1", rel, polarity, ground,
    agreed: Object.freeze(agreed), varying: Object.freeze(varying), absent: Object.freeze(absent),
    sourceIds: Object.freeze(claims.map((c) => c.id).filter(Boolean)), n: claims.length,
  });
}
/**
 * renderGeneralization(gen, lens) → the surface string a lens would print
 * for a generalization: the agreed roles project as usual; EVERY varying
 * role has its distinct values joined by a plain list-formatter ("a, b, and
 * c") and substituted in — none is dropped. A '-' generalization is
 * prefixed "denied: " — kernel/notes.js's own mark for a cut — so the
 * surface never contradicts the record's polarity. A pure token-join of
 * lemmas, same as `render`: no model call, no tense, no article. The list
 * surface is honest only when ONE role varies: with two, "a and b V c and d"
 * reads as pairings the sources never made (sourceIds keep the pairing).
 * What it prints is a claim's surface, not a sentence; callers must not hand
 * it to a mouth as one.
 */
export function renderGeneralization(gen, lens = "SVO") {
  const list = (vals) => (vals.length <= 1 ? vals[0] : vals.length === 2 ? `${vals[0]} and ${vals[1]}` : `${vals.slice(0, -1).join(", ")}, and ${vals[vals.length - 1]}`);
  const roles = { ...gen.agreed };
  for (const [key, vals] of Object.entries(gen.varying)) if (vals.length) roles[key] = list(vals);
  const surface = render(gfpClaim({ ground: gen.ground, rel: gen.rel, roles, polarity: gen.polarity ?? "+" }), lens);
  return gen.polarity === "-" ? `denied: ${surface}` : surface;
}
