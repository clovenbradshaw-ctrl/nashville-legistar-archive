// native/kernel/antimatter.js — the negative space of every perspective and
// every terrain. Handles: Dirac and Mariotte.
//
// Dirac named the positron a HOLE in the plenum — an absence that walks,
// collides, and annihilates with the matter it is missing. Mariotte (1668)
// found the hole in the human eye: the optic disc, patched by the brain with
// the same cloth as the scene it looks at, invisible precisely because it is
// central. Both are the same law, stated twice: a perspective is a debt to
// its own ground, and the debt is the price of seeing at all.
//
// WHAT IT IS. The complement of perspective.js and theory-of-mind.js. Those
// organs fold what a mind HOLDS; this organ derives what a mind — and a
// terrain, and a session — does not hold, from the entity's OWN vocabulary,
// never guessed. Four moves:
//
//   terrainAntimatter(spec)  — for a cube cell (domain x grain), the NEAR
//       complement: its own null (NUL at the same grain — "can this fail at
//       all?"), the same grain in the other two domains (the lenses it
//       structurally excludes), and the other grains of its own domain (what
//       its own vocabulary implies). Five entries, closed, each carrying a
//       fixed question. Never the whole complement: the unbounded "everything
//       else" is noise, and a machine that reports noise reports nothing.
//
//   mindAntimatter(projected, holder) — the negative space of a mind over a
//       projection: the claims it HOLDS that the material contradicts
//       (undermined — it does not know its own contradiction exists), and
//       the claims its world raised that it has no stance on (unsettled —
//       its own unanswered questions).
//
//   sessionAntimatter(entries) — the session's log line: the terrains it did
//       NOT touch and the claims it raised that the chain cannot answer. The
//       extension terrains.log carries: "terrains NOT touched: …", and now
//       "questions this chain cannot answer: …".
//
//   collide(fold, antimatter) — the collision rule. Matter meets anti-matter
//       and annihilates; the residue is a QUESTION, not an answer. A claim
//       the mind still holds against the material's contradiction is the
//       surviving question; a claim it no longer holds is the absorbed
//       collision.
//
// THE WALLS. Everything here is derived from what the log already carries —
// the cube's own tables, the projected perspectives, the operations' own
// terrains. No model is consulted; no claim is invented; a negative space
// that would require guessing is a typed gap, never a finding. And the
// deepest wall, from the essay "The anti-matter of every terrain": the
// record of holes is itself a hole. The list of what a session did not touch
// has its own untouchable terrain, and this organ says so in its own outputs
// (recordBound) rather than pretending the list is complete.
//
// THE WALLS FOUND BY FALSIFICATION (2026-09-19), stated so they are not
// mistaken for features:
//
//   STRING-BOUND. Undermining and unsettling match claims by their exact
//   claim string. A contradiction the material expresses in a DIFFERENT
//   claim string — a mind holding "the creature is a fiend" while the
//   material asserts "the creature is gentle" — is invisible to this organ,
//   and it refuses to infer the relation (S6: the kernel never reads
//   meaning; negation is a semantic relation, the model's and the caller's,
//   never this file's). A mind can hold a contradiction this organ cannot
//   see. That is a wall, stated, and the falsification test pins it.
//
//   WORLD-BOUND. unsettled is the mind's own world's questions. When a
//   world is DECLARED, claims raised outside it are reported as `outside`
//   (the mind is out of the loop on them — the irony wall) and never as the
//   mind's own. A caller that declares no world gets the whole log as the
//   world (worldBound: "log") — the reader's model of the person, where the
//   whole material IS the person's world. Mixing the two is a category
//   error this organ refuses: collide() gates on holder identity and on the
//   anti-matter's schema, so two minds' worlds are never silently collided.

// THE ANTI-MATTER FAMILY. Five schemas here — EOTerrainAntimatter@1,
// EOMindAntimatter@1, EOSessionAntimatter@1, EOCollision@1,
// EOAntimatterIntersection@1 — and one surface schema beside them,
// EOSwarmAntimatter@1 (swarm-server.mjs), whose questions are the FRAMINGS'
// typed holes, not the material's claims: the same line, one category apart,
// and the divergence is deliberate (the essay's "holes of the framings").
// The shared renderer below is the single source of the line's format; the
// surfaces decide what their questions ARE.

import { DOMAINS, GRAINS, TERRAIN_BY_DOMAIN, cellOf } from "./cube.js";
import { TERRAINS, terrainOf } from "./terrain-state.js";
import { READER, STANCE, projectPerspectives } from "./perspective.js";

const freeze = Object.freeze;

/** THE LINE, ONE RENDERER — the single source of the essay's format:
 * `terrains NOT touched: X  Y — <clause>: a | b`. The questions are
 * sanitized — separators a question carries are made safe, so the line can
 * always be split back (falsified 2026-09-19: the swarm's pointing reasons
 * always contained " — ", and material claims can contain " | "). An empty
 * untouched list renders "all terrains touched", never a trailing ghost.
 * The clause is the caller's own category: the kernel's sessions say
 * "questions this chain cannot answer" (material claims); the swarm says
 * "holes of the framings" (typed gaps). */
export function renderAntimatterLine({ untouched = [], questions = [], clause = "questions this chain cannot answer" } = {}) {
  const safe = (q) => String(q).replace(/\s+/g, " ").replace(/\|/g, "/").replace(/—/g, "-");
  const touched = untouched.length ? `terrains NOT touched: ${untouched.join("  ")}` : "all terrains touched";
  const clean = [...new Set(questions.map(safe).filter(Boolean))];
  return clean.length ? `${touched} — ${clause}: ${clean.join(" | ")}` : touched;
}

// ── the closed question vocabulary of the cube, per cell ──────────────────
// Every question is a fixed string derived from the cube's own grammar.
// Nothing here is generated; the near-complement is DERIVED, never guessed.
// GIVER (II.11): the algebra itself — each register below is exactly the
// cube's own TERRAIN_BY_DOMAIN cell names worn by the question its position
// implies (cube.js, kernel/cube.js — received, never chosen; the arithmetic
// is the measurement).

const GRAIN_QUESTIONS = freeze({
  Ground: "can this ground fail at all?",
  Figure: "can this figure fail at all?",
  Pattern: "can this pattern fail at all?",
});

// The excluded domain's own register, at the same grain — what the terrain
// structurally cannot see because it stands in another domain.
const OTHER_DOMAIN_QUESTIONS = freeze({
  Existence: freeze({ Ground: "what is there at all?", Figure: "what IS this thing?", Pattern: "what kind of thing is it?" }),
  Structure: freeze({ Ground: "what field does it stand in?", Figure: "how is it arranged?", Pattern: "what network holds it?" }),
  Interpretation: freeze({ Ground: "what ground does it stand on?", Figure: "what does it mean?", Pattern: "what shape does it expect?" }),
});

// The same domain's other grains — what its own vocabulary implies but does
// not answer.
const OWN_DOMAIN_QUESTIONS = freeze({
  Existence: freeze({ Ground: "what is the void it stands on?", Figure: "what is the entity it happens to?", Pattern: "what kind does it belong to?" }),
  Structure: freeze({ Ground: "what is the field it stands in?", Figure: "what is the link it is?", Pattern: "what network does it form?" }),
  Interpretation: freeze({ Ground: "what atmosphere does it stand in?", Figure: "what lens sees it?", Pattern: "what paradigm does it expect?" }),
});

const domainOfTerrain = (terrain) => {
  for (const [domain, byGrain] of Object.entries(TERRAIN_BY_DOMAIN)) {
    for (const [grain, name] of Object.entries(byGrain)) {
      if (name === terrain) return freeze({ domain, grain });
    }
  }
  return null;
};

/**
 * The anti-matter of one terrain — the NEAR complement, closed and typed.
 * `spec` is a cube cell (from `cellOf`) or a terrain's own name. Five
 * entries, never more:
 *
 *   own_null      the NUL operator at the same grain — "can this fail at
 *                 all?" (for an Existence terrain the null is ITSELF: the
 *                 refusal of the same figure, `self: true`);
 *   other_domain  the same grain in the other two domains — the lenses it
 *                 structurally excludes;
 *   own_domain    the other two grains of its own domain — what its own
 *                 vocabulary implies but does not answer.
 *
 * The whole complement is unbounded noise and is refused on purpose: an
 * anti-matter that reports everything reports nothing.
 */
export function terrainAntimatter(spec) {
  const fromName = typeof spec === "string" ? domainOfTerrain(spec) : null;
  const domain = fromName ? fromName.domain : spec?.domain;
  const grain = fromName ? fromName.grain : spec?.grain;
  if (!domain || !Object.prototype.hasOwnProperty.call(TERRAIN_BY_DOMAIN, domain) || !GRAINS.includes(grain)) {
    return freeze({
      schema: "EOTerrainAntimatter@1",
      spec,
      near: freeze([]),
      gap: freeze({ type: "unknown_spec", detail: "a terrain is named by its own name or by a cube cell — anything else is a typed gap, never an empty anti-matter" }),
    });
  }
  const terrain = TERRAIN_BY_DOMAIN[domain][grain];
  // THE OP, VALIDATED — a caller that names an operator is claiming a real
  // cell, and a cell that does not exist is a typed gap, never a confident
  // anti-matter (the organ's own wall: "anything else is a typed gap").
  if (!fromName && typeof spec?.op === "string") {
    const claimed = cellOf(spec.op, grain);
    if (claimed.gap || claimed.terrain !== terrain) {
      return freeze({
        schema: "EOTerrainAntimatter@1",
        spec,
        near: freeze([]),
        gap: freeze({ type: "unknown_spec", detail: `${spec.op}·${grain} is not a cell of ${terrain} — ${claimed.gap ? claimed.reason : `${spec.op} lands in ${claimed.terrain}, not ${terrain}`}; a nonexistent cell has no anti-matter (antimatter.js's own wall)` }),
      });
    }
  }
  const ownNull = cellOf("NUL", grain);

  const near = [];
  near.push(freeze({
    kind: "own_null",
    domain: ownNull.domain,
    grain: ownNull.grain,
    terrain: ownNull.terrain,
    self: ownNull.terrain === terrain,
    op: "NUL",
    question: GRAIN_QUESTIONS[grain],
  }));
  for (const other of DOMAINS) {
    if (other === domain) continue;
    near.push(freeze({
      kind: "other_domain",
      domain: other,
      grain,
      terrain: TERRAIN_BY_DOMAIN[other][grain],
      op: null,
      question: OTHER_DOMAIN_QUESTIONS[other][grain],
    }));
  }
  for (const g of GRAINS) {
    if (g === grain) continue;
    near.push(freeze({
      kind: "own_domain",
      domain,
      grain: g,
      terrain: TERRAIN_BY_DOMAIN[domain][g],
      op: null,
      question: OWN_DOMAIN_QUESTIONS[domain][g],
    }));
  }

  const byKind = (kind) => near.filter((n) => n.kind === kind).length;
  return freeze({
    schema: "EOTerrainAntimatter@1",
    terrain,
    domain,
    grain,
    cell: freeze({ op: fromName ? null : spec?.op ?? null, domain, grain, terrain }),
    near: freeze(near),
    questions: freeze(near.map((n) => n.question)),
    // DERIVED, NEVER LITERAL: a cube change must move this count or break the
    // test that pins it — a counted block that restates assumptions is a
    // judgment wearing the clothes of a measurement.
    counted: freeze({ near: near.length, ownNull: byKind("own_null"), otherDomains: byKind("other_domain"), ownDomain: byKind("own_domain") }),
  });
}

/**
 * The anti-matter of one mind over a projection — what it does not know,
 * derived from what its world raised. Two kinds, kept apart:
 *
 *   undermined  claims the mind HOLDS that the material contradicts (another
 *               holder holds the same claim with a different stance). The
 *               mind does not know its own contradiction exists — the floor
 *               it never checked.
 *   unsettled   claims the material raised that the mind has NO stance on at
 *               all — the questions its own world asked it and it never
 *               answered.
 *
 * `world` is the mind's own world — the holders whose claims count as asked
 * of it. When declared, unsettled is RESTRICTED to claims raised inside the
 * world, and a claim raised ONLY outside the world is reported as `outside`:
 * the mind is out of the loop on it (the irony wall — out of the loop means
 * they do not affect it), so it is the world's question, never its own. (A
 * claim raised BOTH inside and outside the world is in both lists — inside
 * it is asked of the mind, outside it is the world's question; the two
 * reports are the same claim's two addresses, and neither is smoothed.) A
 * mind whose world is only itself is asked nothing it has not answered; a
 * reader modelling the person of the whole log declares no world and the
 * whole log IS the world (worldBound: "log"). An EMPTY world list is not a
 * world — a world of no one is meaningless, and an empty list gets the
 * documented default (the whole log), never the silent reverse.
 *
 * A claim the mind holds a stance on (even a refusal) is NOT unsettled — the
 * mind answered it. The contested half — the mind's refusals that the
 * material contradicts — is a conflict between holders, reported by
 * perspective.js's own divergence, never re-derived here: this organ's
 * residue is the still-held claim, collide()'s, not the still-refused one.
 */
export function mindAntimatter(projected, holder, { world = null } = {}) {
  if (!projected || typeof projected !== "object" || !projected.perspectives) {
    return freeze({
      schema: "EOMindAntimatter@1",
      holder,
      undermined: freeze([]),
      unsettled: freeze([]),
      outside: freeze([]),
      world: null,
      worldBound: "log",
      lensAntiMatter: terrainAntimatter("Lens"),
      counted: freeze({ undermined: 0, unsettled: 0, outside: 0 }),
      gap: freeze({ type: "no_projection", detail: "a negative space is derived from a projection — without one, the space is a guess, and a guess is refused" }),
    });
  }
  const pov = projected.perspectives?.[holder];
  if (!pov) {
    return freeze({
      schema: "EOMindAntimatter@1",
      holder,
      undermined: freeze([]),
      unsettled: freeze([]),
      outside: freeze([]),
      world: null,
      worldBound: "log",
      lensAntiMatter: terrainAntimatter("Lens"),
      counted: freeze({ undermined: 0, unsettled: 0, outside: 0 }),
      gap: freeze({ type: "unknown_holder", detail: `${holder} holds nothing in this projection — a negative space requires a mind who was recorded (perspective.js's own wall)` }),
    });
  }

  // A declared world is a NON-EMPTY list of holders. An empty list is not an
  // empty world — a world of no one is meaningless, and a caller whose
  // computed world came up empty must get the documented default (the whole
  // log), not the silent reverse (everything outside).
  const worldList = Array.isArray(world) && world.length > 0 ? [...world] : null;
  const worldSet = worldList ? new Set(worldList) : null;
  const held = new Map(pov.beliefs.filter((b) => b.stance === STANCE.HOLDS).map((b) => [b.claim, b]));
  const own = new Map(pov.beliefs.map((b) => [b.claim, b]));

  const underminedBy = new Map();
  const unsettledBy = new Map();
  const outside = [];
  for (const [other, otherPov] of Object.entries(projected.perspectives)) {
    if (other === holder) continue;
    for (const b of otherPov.beliefs) {
      if (held.has(b.claim)) {
        // The material contradicts a claim this mind HOLDS, and the mind
        // still holds it: its blindspot at the claim level.
        if (b.stance !== STANCE.HOLDS) {
          if (!underminedBy.has(b.claim)) underminedBy.set(b.claim, { claim: b.claim, heldBy: holder, contradictors: [] });
          underminedBy.get(b.claim).contradictors.push(freeze({ holder: other, stance: b.stance, basis: b.basis, witness: b.witness }));
        }
      } else if (!own.has(b.claim)) {
        // The material raised a claim this mind has no stance on at all.
        if (worldSet && !worldSet.has(other)) {
          // OUTSIDE THE DECLARED WORLD — the mind is out of the loop on it
          // (the irony wall); it is the world's question, never its own.
          if (!outside.some((x) => x.claim === b.claim)) {
            outside.push(freeze({ claim: b.claim, raisedBy: other, stance: b.stance, basis: b.basis, witness: b.witness }));
          }
          continue;
        }
        if (!unsettledBy.has(b.claim)) {
          unsettledBy.set(b.claim, { claim: b.claim, raisedBy: other, stances: [b.stance], basis: b.basis, witness: b.witness });
        } else if (!unsettledBy.get(b.claim).stances.includes(b.stance)) {
          // The material raised the claim with a DIFFERENT stance — the
          // surviving entry keeps the first raiser, and the split is
          // disclosed, never smoothed (the same discipline as perspective.js's
          // conflicting divergence).
          unsettledBy.get(b.claim).stances.push(b.stance);
          unsettledBy.get(b.claim).contestedRaise = true;
        }
      }
    }
  }

  const undermined = [...underminedBy.values()].map((u) => freeze({ ...u, contradictors: freeze(u.contradictors) }));
  const unsettled = [...unsettledBy.values()].map((u) => freeze({ ...u, stances: freeze(u.stances) }));
  const lens = terrainAntimatter("Lens");
  return freeze({
    schema: "EOMindAntimatter@1",
    holder,
    undermined: freeze(undermined),
    unsettled: freeze(unsettled),
    outside: freeze(outside),
    world: worldList ? freeze(worldList) : null,
    worldBound: worldList ? "declared" : "log",
    // THE LENS ANTI-MATTER — the essay's other-domains-lenses applied to
    // a perspective: a mind's BELIEF acts land in Lens (Interpretation x
    // Figure, perspective.js's own cell — the belief projection folds no
    // other cell), so the lens's anti-matter is fixed and derived, never
    // guessed: Entity and Link (the lenses it structurally excludes),
    // Atmosphere and Paradigm (what its own vocabulary implies), and its own
    // null — can this figure fail at all? Named for what it IS: the cell's
    // anti-matter, not a census of the terrains the mind occupies (a being
    // whose acts are all Entity still reads through Lens beliefs).
    lensAntiMatter: lens,
    counted: freeze({ undermined: undermined.length, unsettled: unsettled.length, outside: outside.length }),
    // THE WALL, STATED: what the log never raised is not a blindspot of the
    // mind — it is a hole in the record, and this organ refuses to guess it.
    // The list of holes is itself a hole, and the disclosure is a field a
    // caller receives, not a comment it must find.
    recordBound: true,
    disclosure: "the record of holes is itself a hole — what this log never raised is not on this list, and the list has its own untouchable terrain; the negative space is bound to what was raised, never complete",
  });
}

/**
 * The anti-matter of a session — the log line terrains.log now carries. Two
 * halves, both negative space:
 *
 *   touched / untouched  terrains the session's operations did and did NOT
 *                        occupy — the "terrains NOT touched: …" line;
 *   questions            Lens claims the material raised that the READER
 *                        holds no stance on — the questions this chain
 *                        cannot answer.
 *
 * `line` is the rendered entry, ready for the session log. A session whose
 * untouched list is empty has still not touched what it never knew existed:
 * the record is bound, never complete.
 */
export function sessionAntimatter(entries = [], { question = null } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const touched = new Set();
  const raised = [];
  let unplaced = 0;
  for (const entry of list) {
    const ops = entry?.schema === "DeltaFold@1" ? (entry.operations ?? []) : entry?.schema === "EOOperation@1" ? [entry] : [];
    for (const op of ops) {
      const terrain = terrainOf(op);
      if (terrain) touched.add(terrain);
      else unplaced += 1;
      // The Lens gate is the SAME resolver the touched-set uses — an op that
      // derives to Lens by its own arithmetic raises its claim; a literal
      // terrain field and an eo-style cell must not disagree (antimatter.js's
      // own wall: the two halves of the walk speak one vocabulary).
      if (terrain === "Lens" && typeof op?.payload?.claim === "string") raised.push(op.payload.claim);
    }
  }

  const untouched = TERRAINS.filter((t) => !touched.has(t));

  const projected = projectPerspectives(list);
  const readerClaims = new Set((projected.perspectives?.[READER]?.beliefs ?? []).map((b) => b.claim));
  const questions = [];
  const seen = new Set();
  for (const claim of raised) {
    if (seen.has(claim)) continue;
    seen.add(claim);
    if (!readerClaims.has(claim)) questions.push(claim);
  }

  const line = renderAntimatterLine({ untouched, questions });
  return freeze({
    schema: "EOSessionAntimatter@1",
    question,
    touchedTerrains: freeze([...touched]),
    untouchedTerrains: freeze(untouched),
    questions: freeze(questions),
    line,
    counted: freeze({ touched: touched.size, untouched: untouched.length, questions: questions.length, unplaced }),
    recordBound: true,
    disclosure: "the record of holes is itself a hole — the terrains this log never raised are not on this list, and the questions the log never asked are not among these questions; unplaced operations are counted, never guessed into a terrain",
  });
}

/**
 * The collision rule: matter meets anti-matter, and the residue is a
 * QUESTION, not an answer. `fold` is an EOUniverse@1 / EOUniverseFor@1 (or
 * any object carrying a perspective with beliefs); `antimatter` is the
 * EOMindAntimatter@1 derived from the same mind.
 *
 *   residue   the undermined claims the mind STILL holds — the floor it
 *             never checked, now load-bearing. The question survives the
 *             collision.
 *   absorbed  the undermined claims the mind no longer holds (conceded,
 *             doubted, refused, or never held) — the collision resolved,
 *             matter won or lost, the hole was sewn.
 */
export function collide(fold, antimatter) {
  if (!antimatter || antimatter?.schema !== "EOMindAntimatter@1") {
    throw new TypeError("collide: the anti-matter is required — a collision with a non-EOMindAntimatter is a guess wearing the collision's clothes (antimatter.js's own wall)");
  }
  const undermined = Array.isArray(antimatter?.undermined) ? antimatter.undermined : [];
  const beliefs = Array.isArray(fold?.perspective?.beliefs) && fold.perspective.beliefs.length > 0 ? fold.perspective.beliefs : null;
  if (fold == null || (undermined.length > 0 && !beliefs)) {
    throw new TypeError("collide: a collision with undermined claims needs the matter it collides — a fold whose perspective carries no beliefs collides nothing; a refused mind passes perspective: null and collides to zero");
  }
  if (fold.holder != null && antimatter.holder != null && fold.holder !== antimatter.holder) {
    throw new TypeError(`collide: the fold models ${fold.holder} and the anti-matter was derived for ${antimatter.holder} — a collision between two minds' worlds is refused, never silently mixed`);
  }
  const stanceBy = new Map((beliefs ?? []).map((b) => [b.claim, b]));

  const residue = [];
  const absorbed = [];
  for (const u of undermined) {
    const mine = stanceBy.get(u.claim);
    if (mine && mine.stance === STANCE.HOLDS) {
      residue.push(freeze({ claim: u.claim, contradictors: u.contradictors, detail: "the mind still holds this claim against the material's contradiction — the question survives the collision" }));
    } else {
      // Absorbed is a CROSS-MOMENT statement: the anti-matter was derived
      // from one projection (the moment the mind held), the fold carries
      // another. "Never held" is a caller error wearing a verdict's clothes
      // — the label says what the record shows, and the record is the wall.
      absorbed.push(freeze({ claim: u.claim, stance: mine?.stance ?? "not in this fold's record", detail: "the contradiction was absorbed — this fold's record does not hold the claim, either it conceded or the fold and the anti-matter come from different moments" }));
    }
  }

  return freeze({
    schema: "EOCollision@1",
    holder: fold?.holder ?? antimatter?.holder ?? null,
    residue: freeze(residue),
    absorbed: freeze(absorbed),
    counted: freeze({ residue: residue.length, absorbed: absorbed.length }),
    note: "matter meets anti-matter, and the residue is a question, not an answer",
  });
}

/**
 * THE INTERSECTION — A(reader) ∩ A(terrain), the essay's section five: the
 * misreading region, where the reader's hole and the material's hole overlap
 * and the misreading is invisible, because it looks exactly like reading.
 *
 * Two sets, kept apart, both derived from what the projection actually
 * raised:
 *
 *   unsupported  claims the reader HOLDS that the material NEVER raised —
 *                the reader reads the document's hole as the document's
 *                ground, and never checked. (The reader's priors projected
 *                onto the material, wearing the material's clothes.)
 *   undermined   claims the reader HOLDS that the material CONTRADICTS —
 *                the reader does not know its own contradiction exists.
 *
 * Neither is a finding about the world; the region is where the reading will
 * be wrong invisibly, and naming it is the whole point — a misreading that is
 * named is a question, not a failure (the essay's collision rule).
 */
export function intersection(projected, { reader = READER } = {}) {
  if (!projected || typeof projected !== "object" || !projected.perspectives) {
    return freeze({ schema: "EOAntimatterIntersection@1", reader, unsupported: freeze([]), undermined: freeze([]), gap: freeze({ type: "no_projection", detail: "an intersection is derived from a projection — without one, the region is a guess, and a guess is refused" }) });
  }
  const pov = projected.perspectives?.[reader];
  if (!pov) {
    return freeze({ schema: "EOAntimatterIntersection@1", reader, unsupported: freeze([]), undermined: freeze([]), gap: freeze({ type: "unknown_holder", detail: `${reader} holds nothing in this projection — a misreading region requires a reader who was recorded (perspective.js's own wall)` }) });
  }
  const readerHeld = new Map(pov.beliefs.filter((b) => b.stance === STANCE.HOLDS).map((b) => [b.claim, b]));
  const materialRaised = new Set();
  for (const [other, otherPov] of Object.entries(projected.perspectives)) {
    if (other === reader) continue;
    for (const b of otherPov.beliefs) materialRaised.add(b.claim);
  }

  const unsupported = [];
  for (const [claim, belief] of readerHeld) {
    if (!materialRaised.has(claim)) {
      unsupported.push(freeze({ claim, basis: belief.basis, via: belief.via, witness: belief.witness, detail: "the reader holds this claim and the material never raised it — the document's hole read as its ground, never checked" }));
    }
  }
  const undermined = mindAntimatter(projected, reader).undermined;

  return freeze({
    schema: "EOAntimatterIntersection@1",
    reader,
    unsupported: freeze(unsupported),
    undermined: freeze(undermined),
    counted: freeze({ unsupported: unsupported.length, undermined: undermined.length }),
    note: "the misreading region — where the reader's hole and the material's hole overlap, the reading is wrong invisibly; a named misreading is a question, not a failure",
  });
}