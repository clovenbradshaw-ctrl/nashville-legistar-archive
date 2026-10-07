// native/kernel/contextuality.js — CONTEXTUALITY: DO THE PER-CONTEXT READINGS
// GLUE INTO ONE GLOBAL READING, OR IS THE OBSTRUCTION REAL (2026-09-25).
// Medium-blind, kernel-level. Handle: Abramsky & Brandenburger — after the
// sheaf-theoretic structure of non-locality and contextuality: an empirical
// model is a presheaf of local sections over a cover of contexts, and
// contextuality is the failure of those sections to glue. Nomination.
//
// WHY THIS EXISTS. READING-SPEC S13 drew the boundary for "quantum-style"
// mathematics on this record: a density matrix built from counts reduces to
// Bayes (no interference term is estimable from frequencies), and phase is
// earned only from dynamics (kernel/dmd.js). What S13 named as the ONE
// quantum-style quantity computable from exactly our data — and left unbuilt
// — is contextuality: the obstruction to gluing per-context readings into one
// global assignment. This module is that, in its possibilistic form. No
// amplitude, no phase, no Hilbert space: contextuality is a property of a
// family of supports over overlapping contexts, and it is exactly computable.
//
//   MEASUREMENT   a slot the caller names (a position fact, a relation about a
//                 referent, an observable) — this file names none
//   OUTCOME       the value a section gives it (strings; ABSENT for a slot the
//                 section does not carry)
//   CONTEXT       a set of measurements observed JOINTLY, with its SUPPORT: the
//                 set of joint sections seen in that context
//   GLOBAL SECTION  one assignment over every measurement whose restriction to
//                 each context lies in that context's support
//
//   THE HIERARCHY (Abramsky & Brandenburger 2011), each verdict derived:
//     signalling            two contexts' supports restricted to a shared
//                           measurement differ as sets — the model is not
//                           no-signalling; "the reading of a slot depends on
//                           which other slots were read with it." Not
//                           contextuality: a direct influence. S13 names
//                           Contextuality-by-Default as the treatment of
//                           signalling systems; it is OWED here, never
//                           approximated by a formula nobody earned.
//     noncontextual         every local section extends to a global section
//     logically_contextual  some local section extends to none, others do
//     strongly_contextual   no global section exists at all
//
// THE LEMMA THAT PLACES THE SEAM. With ONE section per context and consistent
// overlaps, the union of the sections is itself a global section — so a
// ledger whose contexts are places, each giving one reading, can only ever
// be signalling (a dispute) or gluable. Contextuality needs contexts that
// carry SEVERAL joint sections: instances of a form (each a joint reading of
// many slots), grouped by which slots they carry. That is why the seam is
// form-prior.js's instances, not the Lens's one-reading-per-place notes.
// bayes-surprise.js says of itself that independence of slots is a declared
// simplification; this is the organ that says WHEN that simplification fails
// non-classically — the slots' joint readings agree on every overlap and
// still admit no single reading.
//
// THE WALL. The extension search is backtracking with pruning against every
// context's support, bounded by a caller-declared NODE BUDGET; exhausting it
// is a typed refusal (`search_budget_exceeded`) with the partial results,
// never a verdict. That is a compute wall, disclosed the way atmosphere-
// math.js discloses `maxStates`, and it is the one constant here. The
// contextual FRACTION (Abramsky, Barbosa & Mansfield 2017: the linear
// programme over noncontextual models) is owed and reported null with its
// basis — the verdict is possibilistic, exact, and a structural fact of the
// data, which is why no null is run for it (settling.js's "structural zero,
// no null needed").
//
// Typing (reasoned, per capacities.js's hand-check discipline): gluing local
// sections into a whole is construction — Generate·Structure — over the whole
// cover: Pattern grain. SYN·Network, Composing; a refusal to glue is that
// cell's typed verdict.

import { ABSENT } from "./bayes-surprise.js";

export const CONTEXTUALITY_SCHEMA = "EOContextuality@1";
export const CELL = Object.freeze({ op: "SYN", grain: "Pattern" });
export const VERDICTS = Object.freeze(["signalling", "noncontextual", "logically_contextual", "strongly_contextual"]);

const SEP = "\u0000";
const toMap = (s) => (s instanceof Map ? s : new Map(Object.entries(s ?? {})));
const keyOf = (section, measurements) => measurements.map((k) => `${k}=${section.has(k) ? String(section.get(k)) : ABSENT}`).join(SEP);
const readable = (section) => Object.fromEntries([...section].map(([k, v]) => [k, String(v)]));

/**
 * empiricalModel(contexts) → { contexts: [{id, measurements, support}], measurements, outcomes }
 *   contexts  [{ id?, sections: [Map|object slot → value] }]. A context's
 *             measurements are the union of its sections' keys; a section
 *             missing one carries ABSENT there (bayes-surprise.js's own value
 *             for a slot an instance lacks). Duplicate sections collapse: the
 *             support is a SET (possibilistic), not a multiset.
 */
export function empiricalModel(contexts = []) {
  const out = [];
  (contexts ?? []).forEach((c, i) => {
    const secs = (c?.sections ?? []).map(toMap);
    const measurements = [...new Set(secs.flatMap((s) => [...s.keys()].map(String)))].sort();
    if (!measurements.length) return;
    const support = new Map();
    for (const s of secs) {
      const full = new Map(measurements.map((k) => [k, s.has(k) ? String(s.get(k)) : ABSENT]));
      support.set(keyOf(full, measurements), full);
    }
    out.push(Object.freeze({ id: c.id ?? `context:${i}`, measurements: Object.freeze(measurements), support: Object.freeze([...support.values()]) }));
  });
  const measurements = [...new Set(out.flatMap((c) => c.measurements))].sort();
  const outcomes = new Map(measurements.map((k) => [k, new Set()]));
  for (const c of out) for (const s of c.support) for (const k of c.measurements) outcomes.get(k).add(s.get(k));
  return { contexts: out, measurements, outcomes };
}

/** The no-signalling check, possibilistic: for every pair of contexts, the
 *  supports restricted to the shared measurements must be the same SET. Each
 *  failure names the pair, the shared measurements, and the restricted
 *  sections found only on one side. */
export function signallingPairs(model) {
  const pairs = [];
  const cs = model.contexts;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const shared = cs[i].measurements.filter((k) => cs[j].measurements.includes(k));
      if (!shared.length) continue;
      const restrict = (c) => new Map(c.support.map((s) => [keyOf(s, shared), Object.fromEntries(shared.map((k) => [k, s.get(k)]))]));
      const a = restrict(cs[i]), b = restrict(cs[j]);
      const onlyA = [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
      const onlyB = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
      if (onlyA.length || onlyB.length) pairs.push(Object.freeze({ a: cs[i].id, b: cs[j].id, shared: Object.freeze(shared), onlyIn: Object.freeze({ [cs[i].id]: Object.freeze(onlyA), [cs[j].id]: Object.freeze(onlyB) }) }));
    }
  }
  return pairs;
}

/**
 * extend(model, seed, budget) — does the partial assignment `seed` extend to
 * a global section? Backtracking over the unassigned measurements (smallest
 * outcome set first), pruning whenever some context's support holds no
 * section agreeing with the assignment so far. Bounded by `budget` nodes.
 *   → { found, exhausted, nodes, section }
 */
export function extend(model, seed, budget) {
  if (!(Number.isFinite(budget) && budget > 0)) throw new TypeError("contextuality: the search budget is declared by the caller — a compute wall, disclosed, never defaulted silently");
  const assign = new Map(seed);
  const order = model.measurements.filter((k) => !assign.has(k)).sort((x, y) => model.outcomes.get(x).size - model.outcomes.get(y).size);
  let nodes = 0;
  const consistent = () => model.contexts.every((c) => {
    const keys = c.measurements.filter((k) => assign.has(k));
    return !keys.length || c.support.some((s) => keys.every((k) => s.get(k) === assign.get(k)));
  });
  if (!consistent()) return { found: false, exhausted: false, nodes, section: null };
  const walk = (i) => {
    if (++nodes > budget) return "budget";
    if (i === order.length) return true;
    const k = order[i];
    for (const v of model.outcomes.get(k)) {
      assign.set(k, v);
      if (consistent()) { const r = walk(i + 1); if (r !== false) return r; }
      assign.delete(k);
    }
    return false;
  };
  const r = walk(0);
  return { found: r === true, exhausted: r === "budget", nodes, section: r === true ? new Map(assign) : null };
}

/**
 * contextuality(contexts, { budget }) → EOContextuality@1
 *   { schema, verdict, contexts, measurements, sections, extendable,
 *     unextendable: [{context, section}], signalling: [...], gluable,
 *     contextualFraction: null, owed, budget, nodes, basis }
 *   or a typed refusal { gap: "no_context" | "search_budget_exceeded", ... }.
 * Overlaps are checked BEFORE the gluing search, so a signalling model is
 * named as such and its gluing reported beside, never read as contextual.
 */
export function contextuality(contexts = [], { budget = 100000 } = {}) {
  const model = empiricalModel(contexts);
  const n = model.contexts.length;
  if (!n) return { gap: "no_context", schema: CONTEXTUALITY_SCHEMA, contexts: 0, basis: "no context carries a measurement: nothing to glue" };
  const signalling = signallingPairs(model);
  const unextendable = [];
  let sections = 0, nodes = 0, exhausted = false, anyFound = false;
  for (const c of model.contexts) {
    for (const s of c.support) {
      sections++;
      const r = extend(model, s, budget);
      nodes += r.nodes;
      if (r.exhausted) { exhausted = true; break; }
      if (r.found) anyFound = true; else unextendable.push(Object.freeze({ context: c.id, section: readable(s) }));
    }
    if (exhausted) break;
  }
  const owed = Object.freeze([
    "contextual fraction — the linear programme over noncontextual models (Abramsky, Barbosa & Mansfield 2017); reported null until built",
    ...(signalling.length ? ["Contextuality-by-Default for signalling systems (READING-SPEC S13): direct influences are named above, not subtracted"] : []),
  ]);
  const common = { schema: CONTEXTUALITY_SCHEMA, cell: CELL, contexts: n, measurements: model.measurements.length, sections, signalling: Object.freeze(signalling), contextualFraction: null, owed, budget, nodes };
  if (exhausted) return { gap: "search_budget_exceeded", ...common, extendable: sections - unextendable.length - 1, unextendable: Object.freeze(unextendable), basis: `the extension search spent its declared budget of ${budget} node(s) before every local section was decided — undecided, not a verdict; raise the budget or narrow the contexts` };
  const gluable = anyFound;
  const verdict = signalling.length ? "signalling" : !gluable ? "strongly_contextual" : unextendable.length ? "logically_contextual" : "noncontextual";
  const basisOf = {
    signalling: `${signalling.length} context pair(s) disagree on a shared measurement — the reading of a slot depends on which slots were read with it (a direct influence, not contextuality); gluing reported beside: ${gluable ? `${sections - unextendable.length}/${sections} section(s) extend` : "no global section"}`,
    noncontextual: `every one of ${sections} local section(s) across ${n} context(s) extends to a global section: one reading fits all of them`,
    logically_contextual: `${unextendable.length} of ${sections} local section(s) extend to no global section while ${sections - unextendable.length} do — locally consistent everywhere, and some readings cannot be part of any whole (Hardy's shape)`,
    strongly_contextual: `no global section exists over ${model.measurements.length} measurement(s): every overlap agrees and no single reading fits (the PR box's shape)`,
  };
  return Object.freeze({ ...common, verdict, gluable, extendable: sections - unextendable.length, unextendable: Object.freeze(unextendable), basis: basisOf[verdict] });
}

/**
 * contextualityOfSteps(steps, { budget }) — the bayes-surprise.js shape: one
 * Map/object slot → value per instance. Instances are grouped into contexts
 * by the SET of slots they carry (a five-line form and a six-line form are
 * two contexts; their instances are the sections), and the model is judged.
 */
export function contextualityOfSteps(steps = [], opts = {}) {
  const S = (steps ?? []).map(toMap);
  const groups = new Map();
  for (const s of S) {
    const key = [...s.keys()].map(String).sort().join(SEP);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)).push(s);
  }
  const contexts = [...groups].map(([key, secs], i) => ({ id: `form:${i} (${key.split(SEP).length} slot(s), ${secs.length} instance(s))`, sections: secs }));
  return { ...contextuality(contexts, opts), forms: contexts.length, instances: S.length };
}
