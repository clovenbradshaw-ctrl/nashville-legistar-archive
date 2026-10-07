// native/kernel/reaction.js — mechanical reasoning as the physics and
// chemistry of the cube: a cue settles against a prior-conditioned substrate.
//
// THE ASK THIS ANSWERS, near-verbatim: leverage all the priors as well as
// possible, and run a true "neural net"-style thing so the instrument can
// MECHANICALLY reason using the physics and chemistry of the cube. Both
// halves of that sentence name organs this kernel already has; what was
// missing was the circuit between them, and this module is only that
// circuit. Nothing below invents a statistic, a threshold, or a licence —
// every law is an existing organ's, cited at its point of use.
//
// WHAT THIS CIRCUIT IS, MEASURED (2026-08-28, the-fold `eval/derivation-
// precision.mjs`, four arms against an oracle independent by construction —
// the derivation reads succession qualifiers, the oracle reads term dates):
//
//   THIS IS A FILTER, NOT A GENERATOR.
//
// An unlicensed 20-line transitive join over the same raw edges reaches every
// product this circuit reaches, and 14 more (`chemistryFoundThatNaiveMissed:
// 0`). So the circuit's value is NOT that its products are otherwise
// unreachable — it is that every product carries provenance to raw witnesses
// and a refusal surface, and that reaching is licensed by a named giver. The
// veto that surface supports is the half that measurably pays: precision 0.842
// (naive join, zero apparatus) -> 1.000 (this circuit under its gate), every
// false product eliminated including a self-loop.
//
// Say it this way and not the other way. "Mechanical reasoning" here means a
// licensed, provenance-carrying walk of a closure a dumber mechanism could
// also walk — not a source of inference nothing else could perform. Claiming
// the second would be a false provenance claim about the apparatus itself,
// which is the exact defect this whole system exists to prevent. A standing
// regression holds this honest: the licensed fact set must remain a SUBSET of
// the naive join's, and the day it does not, that test fails and this
// paragraph is what must be rewritten.
//
// PHYSICS — presence, one hop, decay. kernel/activation.js is P1's first
// clause ("activation decays") with the window MEASURED or declared, never
// defaulted; terrain-activation.js makes it operational across the nine-cell
// grid ("presence spreads exactly as far as the proposition itself reaches,
// one hop, no more"; folding one proposition in costs O(what it touches)).
// This module adds no second activation mechanism: the substrate's present
// IS a createTerrainActivation instance, and the one rule added here is that
// A REACTION REQUIRES CONTACT WITH THE PRESENT — a chain may react only when
// at least one of its three atoms (from, bridge, to) is lit above the
// caller's declared floor. An uncued substrate derives nothing: no presence,
// no reasoning. (`cue: null` is the explicit, disclosed control arm — the
// gate off, full-extent closure — exactly as `window: null` is activation's
// own disclosed undecayed control.)
//
// Note what this is NOT: memory/activation.js records, with measurements,
// that multi-hop spreading activation is the "similarity flood" its one
// recurrent hop deliberately departs from. This module does not reintroduce
// it. Multi-hop REACH here comes only through licensed composition — each
// hop is its own act, on its own step, with its own provenance — and the
// front propagates because a product LIGHTS ITS OWN ENDS (terrain-
// activation's existing Link rule), never because activation diffuses.
//
// CHEMISTRY — bonding at bridges, licensed by givers, with declared yields.
// relation-composition.js already holds the bonds: chains form only at a
// shared REFERENT bridge, and candidates are nominated only at >= 2
// independent witnesses (bipartite matching — its own wall). hyperlexicon.js
// already holds the licence: "experience may nominate candidates; only a
// GIVEN affordance with a named giver licenses composition." This module
// adds one declared field to what a giver may say — `meta.yields`, the
// relation a licensed reaction PRODUCES — carried through the hyperlexicon's
// existing meta channel, no schema change anywhere. With yields, a product
// is a real derived hyperedge that re-enters the ledger and can chain again
// (r(a,b) ∘ r(b,c) => r(a,c) for a transitive r is exactly hl.js's R6, made
// operational); without yields, a licensed product is TERMINAL — the
// bridge fact evaluateRelationCompositions already emits, one hop, no more.
//
// THE GRAIN LAW, inherited whole (interpretation/declarations.js, hl.js
// probe D): an affordance is Pattern-grain, refutable from a corpus but
// never earned from one. So nothing in a settle ever ADDS chemistry — a
// candidate nomination, however well witnessed, licenses no reaction here,
// and `affordancesFromDeclarations` reads only the GIVEN tier of the
// declarations register (foldDeclarations already excludes the conceded).
//
// WHAT A DERIVED EDGE IS, honestly: a never-stated fact computed from
// stated ones under a giver's declared chemistry. Its witness names its own
// derivation (`derived:<left>+<right>`), never a byte span it does not
// have; its meta carries both parents, the bridge it bonded at, the
// affordance's giver, and its depth — so the full provenance closure is
// walkable to raw witnessed edges. A derivation that would restate a RAW
// witnessed fact is refused as churn (`alreadyWitnessed` — the raw witness
// stands; re-deriving it would dress a stated fact as an inference). A
// second derivation path to an already-derived fact is counted (`paths`),
// never duplicated.
//
// TERMINATION is structural, and capped anyway: derived facts are deduped
// by (relation, from, to) over a finite referent set, each chain site is
// consulted at most once, and `maxSteps` is declared by the caller.

import { createRelationCompositionLedger } from "./relation-composition.js";
import { compositionAffordance, normalizeHyperlexicon, licenseStanding } from "./hyperlexicon.js";
import { createTerrainActivation } from "./terrain-activation.js";
import { hyperedge } from "./hypergraph.js";
import { experienceRelationVocabulary } from "./experience-priors.js";
import { refuteRelation, afterVeto } from "./refutation.js";
import { dependentsIndex, cascade } from "./cascade.js";

const freeze = (value) => Object.freeze(value);
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
const factKey = (relation, from, to) => `${relation}\u0000${from}\u0000${to}`;
const chainId = (chain) => `${chain.leftEdge.id}\u0000${chain.rightEdge.id}`;
const pairLabel = (left, right) => `${left}\u0000${right}`;

/**
 * affordancesFromDeclarations(fold) — chemistry from the declarations
 * register, GIVEN tier only.
 *
 * `fold` is `interpretation/declarations.js::foldDeclarations(log)`'s own
 * result. Each GIVEN `transitive(r)` becomes the one affordance its
 * mathematics states: (r, r) yields r, licensed by the declaration's own
 * giver. Candidates yield NOTHING — the grain law above — and functional
 * declarations yield nothing either (functional(r) is R2's exclusion
 * licence, not a composition licence; that seam stays hl.js's own).
 */
export function affordancesFromDeclarations(fold = {}) {
  return freeze((fold.given ?? []).flatMap((d) => {
    if (!d.rel || !d.giver) return [];
    if (d.declKind === "transitive") {
      return [freeze({
        left: d.rel,
        right: d.rel,
        giver: d.giver,
        witnesses: [],
        meta: freeze({ chemistry: true, yields: d.rel, basis: "given transitive declaration — r composed with r yields r (hl.js R6, declarations.js given tier)" }),
      })];
    }
    // A GIVEN `composes` declaration IS a closure claim, so it projects
    // through the same four-row table a caller would otherwise assemble by
    // hand — which is the point of routing chemistry through the register:
    // an affordance that came from a declaration can be CONCEDED, and one
    // built in a caller's local variable cannot.
    if (d.declKind === "composes" && d.yields) return [...closureAffordances({ base: d.rel, yields: d.yields, giver: d.giver })];
    return [];
  }));
}

/**
 * refutedAffordances(fold, entries, { expectUnique, cycleLimit, intervalOf })
 * — `affordancesFromDeclarations`, FORCED through refutation.js's own veto
 * first. Never call `affordancesFromDeclarations` directly on a live
 * `fold` when `entries` is the material a relation's own premises came
 * from — this is the entry point that does, and the reason it exists is a
 * measured failure, not a hypothetical one.
 *
 * Measured live (2026-09-10, the-fold's `eval/the-fold/mechanical-logic-
 * battery.mjs` TC4): three premises stating `alice > bob > carol > alice`
 * under a declared-transitive `older_than` — a plain, positive cycle —
 * were handed to `step()`/`settle()` WITHOUT running `refuteRelation`
 * first, and composition did not refuse. It derived a fully circular
 * belief set (`alice —older_than→ carol`, `bob —older_than→ alice`,
 * `carol —older_than→ bob` — every referent now "older than" every other
 * one). `step()` has no notion of "this contradicts itself"; it only ever
 * asks "does a licensed affordance exist," and a cycle does not make an
 * affordance stop existing on its own. Refutation was already built,
 * already correctly catches this exact case (`refuteRelation` returns
 * `refuted: true, reasons: ["cycle"]` on the identical premises), and
 * already has the assembly rule for exactly this situation
 * (`afterVeto` — one relation's clean scan is not a licence, and one
 * relation's refuted scan removes it from what a giver's declarations may
 * license). What was missing was FORCING that assembly to run before
 * declarations become chemistry, rather than leaving it a caller's own
 * discipline to remember — `refutation-wall.test.js`'s own law
 * ("no code path can turn 'not refuted' into 'admitted'") stated for
 * absence of refutation; this closes the parallel gap for absence of
 * the CALL to refute at all.
 *
 * A GIVEN declaration whose relation `refuteRelation` reports refuted for
 * is dropped before `affordancesFromDeclarations` ever sees it — composing
 * over that relation is not merely inadvisable, it is unreachable. A
 * relation `refuteRelation` reports `insufficient` power for (fewer than
 * two resolved edges) survives: refutation requires a positive
 * counterexample, and an under-examined relation has supplied none — the
 * same asymmetry `refutation.js`'s own header states (absence of a
 * refusal is not a check, but it is also not itself a refutation).
 * Survival is DISCLOSED, never silent: survivors carry their scan power
 * (`survivorsWithPower: [{rel, power}]`) and the thin ones are listed at
 * top level as `insufficientPower: [rels]` (aliased `insufficient`).
 * No auto-veto follows.
 */
export function refutedAffordances(fold = {}, entries = [], { expectUnique = false, cycleLimit = 3, intervalOf = null } = {}) {
  const given = (fold.given ?? []).filter((d) => d.rel && d.giver);
  const scans = new Map(given.map((d) => [d.rel, refuteRelation(entries, d.rel, { expectUnique, cycleLimit, intervalOf })]));
  const { survivors, vetoed, unscanned } = afterVeto(given.map((d) => d.rel), scans);
  const survivorSet = new Set(survivors);
  const guardedFold = freeze({ ...fold, given: freeze(given.filter((d) => survivorSet.has(d.rel))) });
  // veto-report: survivors are disclosed with their scan power; thin ones are listed, never auto-vetoed.
  const survivorsWithPower = freeze([...survivorSet].map((rel) => freeze({ rel, power: scans.get(rel)?.power ?? "unknown" })));
  const insufficientPower = freeze([...survivorSet].filter((rel) => scans.get(rel)?.power !== "sufficient"));
  return freeze({
    affordances: affordancesFromDeclarations(guardedFold),
    survivors: freeze([...survivorSet]),
    survivorsWithPower,
    vetoed: freeze(vetoed),
    unscanned: freeze(unscanned ?? []),
    insufficientPower,
    insufficient: insufficientPower,
    scans: freeze(Object.fromEntries(scans)),
  });
}

/**
 * closureAffordances({ base, yields, giver }) — the four-row reaction table
 * that closes a NON-transitive adjacency relation into its transitive
 * product, under one giver.
 *
 * `replaces` (immediate succession) is the worked case: replaces(c,b) ∘
 * replaces(b,a) does NOT yield replaces(c,a) — c did not replace a — it
 * yields a DIFFERENT relation ("after"/"succeeded-transitively", the
 * giver's to name). Once that product exists it must keep composing with
 * both the base and itself, or the closure stalls at depth two; hence
 * exactly four rows, all yielding the same product:
 *   (base, base), (base, yields), (yields, base), (yields, yields).
 * All four carry the same giver, because they are one declaration —
 * "`yields` is the transitive closure of `base`" — stated as the affordance
 * rows the ledger can actually consult.
 */
export function closureAffordances({ base, yields, giver } = {}) {
  if (!base || !yields || !giver) throw new TypeError("closureAffordances: base, yields and giver are all declared — a closure is a giver's claim about a relation, never a default");
  const basis = `transitive closure: ${yields} is declared the closure of ${base}`;
  // `adjacency` names the side the giver is claiming is 1:1 — closing an
  // adjacency relation is what this table IS ("replaces" has exactly one
  // immediate predecessor). refutation.js reads it to decide where a
  // uniqueness check is licensed, because uniqueness refutes an adjacency
  // claim and refutes NOTHING about the transitive product, where many-to-
  // many is what transitivity means (measured: the derived closure read as
  // "refuted" until this was declared).
  return freeze([
    [base, base], [base, yields], [yields, base], [yields, yields],
  ].map(([left, right]) => freeze({ left, right, giver, witnesses: [], meta: freeze({ chemistry: true, yields, basis, adjacency: base }) })));
}

/**
 * nominateFromExperience(priors, candidates, { requireBoth }) — cross-work
 * memory gates observed nominations.
 *
 * Extracted from eval/experienced-new-book.mjs (which built it inline) so
 * there is ONE implementation: a candidate passes when at least one side —
 * both, under `requireBoth` — is a RECURRENT cross-work memory
 * (experience-priors.js's own `recurrent` standing, >= 2 works; never a
 * floor invented here). What passes is annotated, never re-scored: the
 * nomination is still a candidate, and nomination is not reasoning
 * permission — the hyperlexicon's own wall, restated at the door.
 */
export function nominateFromExperience(priors = [], candidates = [], { requireBoth = false } = {}) {
  const vocabulary = experienceRelationVocabulary(priors);
  const remembered = new Map(vocabulary.filter((r) => r.recurrent).map((r) => [r.relation, r]));
  return freeze((candidates ?? []).flatMap((candidate) => {
    const left = remembered.get(candidate.left) ?? null;
    const right = remembered.get(candidate.right) ?? null;
    const passes = requireBoth ? (left && right) : (left || right);
    if (!passes) return [];
    return [freeze({
      ...candidate,
      meta: freeze({
        ...(candidate.meta ?? {}),
        rememberedLeft: Boolean(left),
        rememberedRight: Boolean(right),
        workSupport: Math.max(left?.workSupport ?? 0, right?.workSupport ?? 0),
        priorRefs: freeze([...new Set([...(left?.priorRefs ?? []), ...(right?.priorRefs ?? [])])]),
      }),
    })];
  }));
}

/**
 * createReactionSubstrate({ entries, hyperlexicon, window, charter }) — the
 * standing, prior-conditioned structure a cue settles against.
 *
 *   entries      graph entries in the ledger's own shape: EOHyperedge@1
 *                edges (+ occurrence bindings, if the caller has them).
 *   hyperlexicon the chemistry — an EOHyperlexicon@1 whose GIVEN
 *                affordances may carry `meta.yields`.
 *   window       the physics — activation's own declared/measured window,
 *                or null for the disclosed undecayed control
 *                (createActivation's wall, inherited, not restated).
 *   charter      THE GROUND (ethos-in-the-core law, 2026-09-16) — the real
 *                charter the composition stands on, as { sha256, giver }.
 *                Every GIVEN affordance that is a LICENSE (carries a charter
 *                `binding`) is verified against it before it may fire; a
 *                license row whose binding does not match, or a substrate
 *                with no charter at all, is UNGROUNDED and withholds — it
 *                cannot license composition. Structural chemistry rows
 *                (transitivity/closure, no binding) are reasoning, kept
 *                apart from the moral license tier. This is the core's own
 *                bearing wall: pull the charter and every license is
 *                ungrounded — composition over the moral tier cannot fire,
 *                the reasoning breaks rather than running ungoverned.
 */
export function createReactionSubstrate({ entries = [], hyperlexicon = null, window = undefined, charter = null } = {}) {
  const ledger = createRelationCompositionLedger(entries);
  const chemistry = normalizeHyperlexicon(hyperlexicon);
  const present = createTerrainActivation({ window });
  // THE GROUND, read once and held: the substrate's whole license tier is
  // verified against this single value for its entire lifetime. A caller
  // cannot swap the ground mid-reaction.
  const groundHash = charter?.sha256 ?? null;

  // Raw stated facts, by (relation, from, to) over referent-standing ends —
  // the dedupe floor a derivation may never restate. Ends resolved only
  // through an occurrence binding are not in this set (the ledger resolves
  // them privately); a derived duplicate of such an edge is counted as
  // derived-with-paths rather than refused — disclosed, not silent.
  const rawStated = new Set();
  const rawEdgeList = [];
  const rawSeen = new Set();
  const rememberRaw = (entry) => {
    if (entry?.schema !== "EOHyperedge@1" || !entry.relation) return;
    // Deduped by id: a caller that re-offers the whole known set on every
    // arrival (the natural shape when edges are projected from a growing
    // fold) must not accumulate duplicates here. The ledger already ignores
    // a re-offered edge; this keeps `edges()` agreeing with it.
    if (entry.id && rawSeen.has(entry.id)) return;
    if (entry.id) rawSeen.add(entry.id);
    rawEdgeList.push(entry);
    const parts = entry.participants ?? [];
    const from = parts[0];
    const to = parts.length >= 2 ? parts[parts.length - 1] : null;
    if (from?.standing === "referent" && from.ref && to?.standing === "referent" && to.ref) {
      rawStated.add(factKey(entry.relation, from.ref, to.ref));
    }
  };
  for (const entry of entries) rememberRaw(entry);

  const derivedByKey = new Map();   // factKey -> derived hyperedge
  const pathsByKey = new Map();     // factKey -> number of derivation paths
  const depthByEdge = new Map();    // edge id -> derivation depth (raw = 0)
  const consulted = new Set();      // chain ids whose affordance was read
  const withheldByPair = new Map(); // pairLabel -> { left, right, standing, chains }
  const vetoedByPair = new Map();   // pairLabel -> { left, right, reasons, chains }
  const ungroundedByPair = new Map(); // pairLabel -> { left, right, tier, why, chains } — a given license whose giver's binding does not match the substrate's charter
  const terminalById = new Map();   // chain id -> terminal bridge fact
  const vetoed = new Map();         // pairLabel -> reasons, set per settle
  const withdrawn = new Map();      // derived edge id -> { trigger, cascadedFrom, depth }
  let derivedCount = 0;

  const depthOf = (edgeId) => depthByEdge.get(edgeId) ?? 0;

  /** Light what a cue touches. Bare strings are referent ids (Entity);
   * entry-shaped objects light whatever terrain their schema names —
   * terrain-activation's own mapping, not a second one. */
  const cue = (refs = []) => {
    const shaped = (refs ?? []).map((r) => typeof r === "string" ? { schema: "EOReferent@1", id: r } : r);
    return present.light(shaped);
  };

  /**
   * One reaction pass. Chains in contact with the present (any atom lit at
   * >= floor; every chain when `floor` is null — the control arm) have
   * their affordance consulted ONCE:
   *   given + yields  -> a derived edge, ingested (new chain sites form)
   *                      and lit (the front moves one bridge-hop)
   *   given, no yields-> a terminal bridge fact (one hop, no more)
   *   not given       -> withheld, tallied by pair with its standing
   */
  const step = ({ floor = undefined } = {}) => {
    if (floor !== null && !Number.isFinite(floor)) throw new TypeError("reaction step: floor is declared — how faint still counts as present is the caller's to say (null = no presence gate, the disclosed control)");
    const lit = floor === null ? null : new Set(present.present(floor).Entity.map((e) => e.id));
    const inContact = (chain) => lit === null || lit.has(chain.from) || lit.has(chain.bridge) || lit.has(chain.to);

    const derived = [];
    const newTerminal = [];
    let reacted = 0;
    let alreadyWitnessed = 0;
    let additionalPaths = 0;

    for (const chain of ledger.chains()) {
      const id = chainId(chain);
      // A chain resting on a WITHDRAWN edge may not fire. The composition
      // ledger keeps the edge (it exposes no removal), so this is where a
      // retracted fact stops being usable as a premise — without it, a
      // withdrawal would take back a conclusion while leaving the material
      // able to re-derive it a step later.
      if (withdrawn.has(chain.leftEdge.id) || withdrawn.has(chain.rightEdge.id)) continue;
      if (consulted.has(id) || !inContact(chain)) continue;
      consulted.add(id);
      reacted += 1;

      // THE VETO IS CHECKED BEFORE THE LICENCE, and the two are kept apart
      // on the report. `withheld` means no giver ever licensed this pair;
      // `vetoed` means one did AND THE MATERIAL REFUTED IT (refutation.js).
      // Collapsing them would lose exactly the distinction a concession
      // needs: nobody vouched, versus somebody vouched and was wrong.
      const vetoKey = pairLabel(chain.leftEdge.relation, chain.rightEdge.relation);
      if (vetoed.has(vetoKey)) {
        const tally = vetoedByPair.get(vetoKey) ?? { left: chain.leftEdge.relation, right: chain.rightEdge.relation, reasons: vetoed.get(vetoKey), chains: 0 };
        tally.chains += 1;
        vetoedByPair.set(vetoKey, tally);
        continue;
      }

      const affordance = compositionAffordance(chemistry, chain.leftEdge.relation, chain.rightEdge.relation, {
        leftGrain: chain.leftEdge.eo?.grain ?? null,
        rightGrain: chain.rightEdge.eo?.grain ?? null,
      });
      if (affordance.standing !== "given") {
        const key = pairLabel(chain.leftEdge.relation, chain.rightEdge.relation);
        const tally = withheldByPair.get(key) ?? { left: chain.leftEdge.relation, right: chain.rightEdge.relation, standing: affordance.standing, chains: 0 };
        tally.chains += 1;
        tally.standing = affordance.standing;
        withheldByPair.set(key, tally);
        continue;
      }

      // THE ETHOS-IN-THE-CORE CHECK (Aristotle, performed in the act): a
      // GIVEN affordance is only a LICENSE when its giver is bound to this
      // substrate's real charter. `licenseStanding` verifies the binding
      // against the ground read once above. Structural chemistry rows (no
      // charter binding) are reasoning and pass as chemistry; a charter-
      // bound license whose binding does not match the substrate's charter —
      // or a substrate with no charter at all — is UNGROUNDED: it cannot
      // fire, and the composition it would have licensed does not happen.
      // This is not a post-hoc filter; it is the definition of what "given"
      // may license in this substrate. Remove the charter and every license
      // becomes ungrounded — the moral tier goes dark and reasoning over it
      // breaks, instead of running ungoverned.
      const licence = licenseStanding(affordance, groundHash ? { sha256: groundHash } : null);
      if (!licence.licensed) {
        const key = pairLabel(chain.leftEdge.relation, chain.rightEdge.relation);
        const tally = ungroundedByPair.get(key) ?? { left: chain.leftEdge.relation, right: chain.rightEdge.relation, tier: licence.tier ?? "license", why: licence.why, chains: 0 };
        tally.chains += 1;
        ungroundedByPair.set(key, tally);
        continue;
      }

      const yields = affordance.meta?.yields ?? null;
      if (!yields) {
        terminalById.set(id, freeze({
          from: chain.from, bridge: chain.bridge, to: chain.to,
          left: chain.leftEdge.relation, right: chain.rightEdge.relation,
          giver: affordance.giver,
          edgeRefs: freeze([chain.leftEdge.id, chain.rightEdge.id]),
        }));
        newTerminal.push(terminalById.get(id));
        continue;
      }

      const key = factKey(yields, chain.from, chain.to);
      if (rawStated.has(key)) { alreadyWitnessed += 1; continue; }
      if (derivedByKey.has(key)) {
        pathsByKey.set(key, (pathsByKey.get(key) ?? 1) + 1);
        additionalPaths += 1;
        continue;
      }

      const depth = 1 + Math.max(depthOf(chain.leftEdge.id), depthOf(chain.rightEdge.id));
      const edge = hyperedge({
        id: `derived:${derivedCount++}:${slug(yields)}:${slug(chain.from)}:${slug(chain.to)}`,
        relation: yields,
        participants: [
          { ref: chain.from, standing: "referent", role: null },
          { ref: chain.to, standing: "referent", role: null },
        ],
        witness: `derived:${chain.leftEdge.id}+${chain.rightEdge.id}`,
        meta: {
          derived: true,
          depth,
          parents: [chain.leftEdge.id, chain.rightEdge.id],
          bridge: chain.bridge,
          affordance: { left: chain.leftEdge.relation, right: chain.rightEdge.relation, giver: affordance.giver },
        },
      });
      derivedByKey.set(key, edge);
      pathsByKey.set(key, 1);
      depthByEdge.set(edge.id, depth);
      derived.push(edge);
    }

    if (derived.length) {
      ledger.ingest(derived);   // products re-enter: new chain sites form
      present.light(derived);   // ...and light their own ends — the front moves
    }

    return freeze({ reacted, derived: freeze(derived), terminal: freeze(newTerminal), alreadyWitnessed, additionalPaths });
  };

  /**
   * settle({ cue, floor, maxSteps }) — iterate reaction passes until
   * quiescence (a pass that derives nothing and lands no new terminal
   * fact) or the declared step cap. `cue: null` with `floor: null` is the
   * full-closure control arm; a real cue with a real floor is the reader's
   * present doing the gating.
   */
  const settle = ({ cue: cueRefs = undefined, floor = undefined, maxSteps = undefined, veto = null } = {}) => {
    if (cueRefs === undefined) throw new TypeError("settle: cue is declared — pass referent ids/entries, or null for the disclosed ungated control");
    if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new TypeError("settle: maxSteps is a declared positive integer — how long a settling may run is the caller's to say");
    // `veto` is refutation.js's `vetoedPairs(audit)` output, passed whole —
    // this module reads a list of refuted pairs and never re-derives the
    // judgement, so the scan stays the one place refutation is decided.
    vetoed.clear();
    ungroundedByPair.clear();
    for (const pair of veto ?? []) vetoed.set(pairLabel(pair.left, pair.right), freeze([...(pair.reasons ?? [])]));
    if (cueRefs !== null) cue(cueRefs);

    const trace = [];
    let quiescent = false;
    for (let i = 0; i < maxSteps; i += 1) {
      const pass = step({ floor: cueRefs === null ? null : floor });
      trace.push(freeze({ step: i + 1, reacted: pass.reacted, derived: pass.derived.length, terminal: pass.terminal.length, alreadyWitnessed: pass.alreadyWitnessed, additionalPaths: pass.additionalPaths }));
      if (pass.derived.length === 0 && pass.terminal.length === 0) { quiescent = true; break; }
    }

    return freeze({
      quiescent,
      steps: freeze(trace),
      derived: derivedFacts(),
      terminal: freeze([...terminalById.values()]),
      withheld: freeze([...withheldByPair.values()].map((w) => freeze({ ...w }))),
      vetoed: freeze([...vetoedByPair.values()].map((v) => freeze({ ...v }))),
      // UNGROUNDED — the ethos-in-the-core report (2026-09-16): a GIVEN
      // license row whose giver's charter binding does not match this
      // substrate's ground (or a substrate with no ground at all). These
      // are licenses that EXISTED but could not fire — disclosed so a
      // caller can see exactly what the ground refused, never silently.
      ungrounded: freeze([...ungroundedByPair.values()].map((u) => freeze({ ...u }))),
      ground: groundHash ? freeze({ sha256: groundHash }) : null,
    });
  };

  /** Everything ever derived, withdrawn or not — the history. `derived()`
   * is the live projection over it; withdrawal never deletes. */
  const allDerived = () => freeze([...derivedByKey.entries()].map(([key, edge]) => freeze({
    relation: edge.relation,
    from: edge.participants[0].ref,
    to: edge.participants[edge.participants.length - 1].ref,
    depth: edge.meta.depth,
    paths: pathsByKey.get(key) ?? 1,
    giver: edge.meta.affordance.giver,
    edge,
  })));

  /** The live belief: everything derived that has not been withdrawn. */
  const derivedFacts = () => freeze(allDerived().filter((f) => !withdrawn.has(f.edge.id)));

  /**
   * withdraw({ left, right, giver }, { trigger }) — take back what a
   * now-refuted licence produced, AND everything that rested on it.
   *
   * THE CASCADE IS THE POINT. A derived fact can be a parent of another
   * derived fact, so withdrawing only the directly-produced ones would
   * leave conclusions standing on ground that has just been conceded —
   * which is the same defect, one hop out, that `derivedUnder` exists to
   * close at the first hop. Every fact whose provenance passes through a
   * withdrawn edge goes with it, transitively, and each records the edge
   * it cascaded from so the withdrawal is auditable rather than a bulk
   * delete.
   *
   * Nothing is deleted: `withdrawn` is a marking, the history stays whole
   * (`allDerived`), and `trigger` is required — a withdrawal with no
   * recorded reason is a deletion wearing a concession's name
   * (declarations.js::concede's own rule, same words, applied to products
   * instead of declarations).
   */
  const withdraw = ({ left = null, right = null, giver = null } = {}, { trigger } = {}) => {
    if (typeof trigger !== "string" || !trigger.trim()) throw new TypeError("withdraw: a trigger is declared — a withdrawal with no recorded reason is a deletion wearing a concession's name");
    // ONE inversion (derived edge id -> the derived edges naming it as a
    // parent), ONE BFS — kernel/cascade.js, shared with derivation.js's own
    // premise-withdrawal walk. `all`/`byId` are read once, not rebuilt (via
    // `allDerived()`, which allocates a fresh array from the whole history
    // every call) on every single frontier item the way this used to.
    const all = allDerived();
    const byId = new Map(all.map((f) => [f.edge.id, f]));
    const index = dependentsIndex(all, (f) => f.edge.meta.parents ?? [], (f) => f.edge.id);
    // The directly-matched facts ARE taken, at depth 0 — unlike
    // derivation.js's `premise` (external to the graph it walks), a
    // licence's own products are themselves what a concession takes back.
    const seeds = derivedUnder({ left, right, giver }).map((f) => f.edge.id);
    const seedHits = seeds.map((id) => ({ id, cascadedFrom: null, cascadeDepth: 0 }));
    // Seeding `seen` with the currently-withdrawn ids is the multi-call
    // exclusion the old per-item `withdrawn.has()` check gave: by
    // construction, everything transitively resting on an already-withdrawn
    // id is already withdrawn too, so there is nothing further to re-walk.
    const hits = [...seedHits, ...cascade(index, seeds, { seen: new Set(withdrawn.keys()) })];

    const taken = [];
    for (const { id, cascadedFrom, cascadeDepth } of hits) {
      const fact = byId.get(id);
      if (!fact) continue;
      withdrawn.set(id, freeze({ trigger, cascadedFrom, depth: cascadeDepth }));
      taken.push(freeze({ relation: fact.relation, from: fact.from, to: fact.to, edgeId: id, cascadedFrom, cascadeDepth }));
    }
    return freeze(taken);
  };

  /** What has been taken back, and why — the disclosure side of withdrawal:
   * a fact that quietly vanished would be indistinguishable from one never
   * derived. */
  const withdrawnFacts = () => freeze(allDerived()
    .filter((f) => withdrawn.has(f.edge.id))
    .map((f) => freeze({ relation: f.relation, from: f.from, to: f.to, edgeId: f.edge.id, ...withdrawn.get(f.edge.id) })));

  /**
   * derivedUnder({ left, right, giver }) — the facts a given affordance
   * actually produced, matched on whichever fields the caller supplies.
   *
   * THIS IS WHAT MAKES A CONCESSION REACH ITS PRODUCTS. The veto stops
   * FUTURE derivation; it cannot un-derive what a now-refuted affordance
   * already yielded, and silently leaving those live would be the exact
   * shape this repo's own concession rule forbids (a re-zero that does not
   * reach what it re-zeroes is a version bump wearing an operator's name).
   * A caller that concedes a declaration asks this for the products and
   * withdraws them on the same act.
   */
  const derivedUnder = ({ left = null, right = null, giver = null } = {}) => freeze(
    derivedFacts().filter((fact) => {
      const a = fact.edge.meta.affordance ?? {};
      if (left != null && a.left !== left) return false;
      if (right != null && a.right !== right) return false;
      if (giver != null && a.giver !== giver) return false;
      return true;
    }),
  );

  /** Grow the substrate with material that arrived later — the corpus
   * getting bigger is what makes a standing refutation search meaningful
   * (a candidate unrefuted at three facts is not unrefuted at forty). New
   * chain sites form here; existing ones are not re-consulted. */
  const admit = (arriving = []) => {
    for (const entry of arriving) rememberRaw(entry);
    return ledger.ingest(arriving);
  };

  return freeze({
    cue,
    step,
    settle,
    admit,
    derived: derivedFacts,
    derivedUnder,
    withdraw,
    withdrawn: withdrawnFacts,
    history: allDerived,
    // Raw material plus LIVE derived facts: a re-audit must not read a
    // retracted conclusion back in as evidence.
    edges: () => freeze([...rawEdgeList, ...derivedFacts().map((f) => f.edge)]),
    present: (floor) => present.present(floor),
    diagnostics: () => ledger.diagnostics(),
    window: present.window,
  });
}
