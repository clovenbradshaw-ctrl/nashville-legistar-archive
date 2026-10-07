// native/kernel/theory-of-mind.js — folding the universe at any given FOR
// WHOM. Handle: Nagel — after Thomas Nagel, whose "view from nowhere" this
// lineage refuses (native/docs/THE-WHEEL.md's essay "The wheel turns for a
// someone", the for-whom section): a claim without a frame is a view from
// nowhere. This organ is the frame made executable in the other direction —
// not a view from nowhere, but a fold at ANY particular somewhere: the
// reader itself, the person at the door, or any being a reading has
// established. The thesis, in one line: THE SYSTEM IS THE ABILITY TO FOLD
// THE UNIVERSE AT ANY GIVEN FOR WHOM. Theory of mind is not a fourth
// subsystem; it is the one fold operation aimed at any position.
//
// A BEING IS A BODY; A FOR-WHOM IS A MIND. A body may sit many minds, and
// this is true of every being this organ folds at:
//
//   - the USER may not always be a single mind — the same person answers
//     as an engineer one turn and as a citizen the next, or two people
//     share one doorway; each mind is a frame of its own
//   - the SYSTEM can be of many minds — the reader folding at itself under
//     one question is one mind, under another question it is another; the
//     system is precisely the body that can ENTER any mind
//   - any REFERENT can be of many minds — a narrator's remembering self and
//     its acted self, a hypothesis's world and the baseline's (holder-scope
//     already builds one modal world per holder; a mind is the same
//     multiplicity one register up)
//
// A mind's ADDRESS is `body:mind:<key>` (`mindHolder(body, key)`). The body
// holder (USER, READER, a referent) is the seat; the mind holder is a
// particular frame seated there. A turn spoken under a named mind lands on
// that mind's holder; a turn with no declared mind lands on the body — the
// undifferentiated remainder, which is also a mind, honestly marked as such.
// `foldUniverseAt` folds at any of them; `parliament` adjudicates between
// MINDS, and a contest between two minds of ONE body is a self-disagreement
// — the same being holding two frames apart, which is a result, never a
// contradiction to be collapsed.
//
// A MIND IS READ AT THREE ALTITUDES. The reader does not only ask what a
// mind holds; it asks WHERE the mind stands. The three interpretation
// altitudes are the three ways a mind meets material, and they are the same
// cell the wheel's essay names in one sentence ("the pattern of one ring is
// the ethos of the next" — the residue of one reading is the ground of the
// next):
//
//   ATMOSPHERE  Interpretation x Ground — the ambient field the mind stands
//               on: its frame's ground and priors (received, declared),
//               folded over the obligations it is under (the interpretive
//               factor field, atmosphere-math.js). A mind with no ground is
//               a mind standing on nothing.
//   LENS        Interpretation x Figure — what the mind holds: the
//               projected perspective (perspective.js's Lens cell). A mind
//               that holds nothing relevant to the question is not reading
//               this question.
//   PARADIGM   Interpretation x Pattern — the shape the mind expects: the
//               dominant DMD mode of its discovery trajectory (the shape its
//               reading has come to expect) and the MDL paradigm models over
//               its obligations (terrain-math.js). A mind with no shape to
//               its reading is a flat reading.
//
// And the three-leg for-whom gate IS these three altitudes, gated: material
// discovery is the atmosphere (is there a ground at all?), question
// relevance is the lens (does what it holds touch the question?), DMD
// coherence is the paradigm (is there a shape?). `foldUniverseAt` reports
// the fold at all three altitudes, so two minds can be compared by where
// they stand, not only by what they hold — the same material read at
// atmosphere by one mind and at paradigm by another is a different reading,
// and the difference is the mind.
//
// THREE SUBJECTS, ONE OPERATION. `foldUniverseAt(forWhom, { holder, ... })`
// works for every subject the user named, because each is only a frame:
//
//   - the SYSTEM        — selfForWhom() + fold at holder:reader (self.js's
//                         own Ubuntu clause: "the reader IS a fold held
//                         between others" — the fold at the reader's own
//                         position is the reader's self-model, reflexively
//                         the very capability that produced it)
//   - the USER chatting — userForWhom() + fold at holder:user or any of the
//                         user's mind holders (what the person has asked,
//                         asserted, and conceded, per mind, attributed by
//                         the chat adapter)
//   - any ENTITY in any — entityForWhom() + fold at that being's holder or
//     content            one of its mind holders (a referent, a narrator, a
//                         modal hypothesis — the open holder vocabulary
//                         perspective.js and holder-scope.js establish)
//
// A for-whom is a FRAME (for-whom.js: giver / question / priors / ground /
// universe / medium / knowing / recipe). A fold at a for-whom answers, over
// the SAME log, two questions at once: the GATE (did this reading find
// structure that makes a difference to its question — the three-leg DMD /
// material / relevance gate) and the PERSPECTIVE (what does this mind hold —
// projected from the Lens cell). That the two share one input is the point:
// every mind is judged from the same folded state, never by re-reading the
// material (P159 — the universe is folded, never recomputed).
//
// THE RECURSION. perspective.js's own header calls `mentalModel(of, from)`
// "exactly one hop of it, which is what a theory of mind IS". This organ
// takes the remaining hops: `theoryOfMind(projected, from, about, depth)`
// reads `from`'s model of `about` at `depth` removes along the relay chain
// (`via` — "the creature said that Felix taught Safie, relayed through
// victor"). Depth 1 is the existing mentalModel (the union of every relay
// position); depth >= 2 is one exact remove from the source, so the
// recursion "I think you think X" is a depth, not a guess.
//
// THE PARLIAMENT. "The for-whom as a parliament" is the wheel essay's named
// potential: many for-whoms over one material, their disagreements typed
// and routed, the question deciding which of them was reading at all.
// `parliament(folds, { question })` is that potential made a value — the
// admitted minds' common ground and divergence are reported (never
// averaged), a refused mind is refused with its gate's own reason, and a
// contest between two minds of one body is typed a self-disagreement.
//
// FOR THEM, NOT ONLY FOR THE ASK. `foldUniverseAt` gates a mind's reading
// on the ASKER's question (the relevance leg — did its reading touch the
// question). That is the reader folding at a position for its own purposes.
// `universeOf` is the other fold: the universe folded at a being FOR THE
// BEING — everything associated with its known experience, held, gated on
// whether it has a world of its own, not on whether its world answers an
// external ask. This holds not just for questions: the for-whom's whole
// frame (giver, priors, ground, universe, medium, knowing) is what the fold
// projects, and a being's known experience is the projection of ALL of it
// onto the being's position — what it participates in, what it holds, the
// shape its experience settled into.
//
// THE IRONY WALL. Where the reader knows something the being has no belief
// about — dramatic irony — the being is OUT OF THE LOOP on it, and being out
// of the loop means it does not affect them. `universeOf` therefore folds
// the being's universe from the being's OWN participations and holdings and
// nothing else; the reader's knowledge about the being is reported in a
// typed field (`outOfLoop`) that is EXPLICITLY outside the universe and
// gates nothing. The reader's knowledge about a being is never the being's
// own knowledge — the mirror of perspective.js's own wall (a being's
// asserted claim is never the reader's witnessed belief), one direction
// over. What the being holds that the reader has no belief about is its
// PRIVATE world, reported apart; the reader is out of the loop on it.
//
// THE WALLS, stated so they are not mistaken for features. A fold is a
// claim about what THIS READING does at a position, never a claim about the
// world (identity-by-consequence's row-three discipline — no giver is
// needed to say what a reading holds, only to license what the world is).
// The person's own words are the person's claims as ASSERTED, and an
// asserted claim never becomes the reader's witnessed belief (perspective's
// own wall, carried here). Higher-order model depth is read off the relay
// structure the log already carries — it is never inferred, never guessed
// (S6: the kernel takes a holder as caller annotation and never asks how it
// was found). And a mind is entered only where one is DECLARED: the system
// does not invent which mind a turn or a stretch belongs to, the adapter or
// the caller does, and an undeclared mind is the body itself, named as such.
// An altitude is a fold of what the mind was given — the reader never
// stands a mind on a ground it did not declare (atmosphere's priors are
// received, never invented).
//
// MEDIUM-BLIND BY THE KERNEL'S OWN LAW. This module names no medium and no
// thing: `holder`, `claim`, and `via` are perspective.js's own open string
// vocabulary, and the same source-scan that guards `reproduction.js` and
// `contest.js` guards this file. The chat medium's grammar — which turn is
// an ask, which an assertion, which a re-zero, which mind it was spoken
// under — lives in the adapter (`adapters/chat/user-turns.js`), never here.

import { READER, BASIS, STANCE, projectPerspectives, mentalModel, commonGround, divergence, perspectiveOperation } from "./perspective.js";
import { createForWhom, createForWhomFold, foldForWhom, gateForWhomFold, coherentMass, trajectoryNull } from "./for-whom.js";
import { READER_SELF } from "./self.js";
import { interpretiveAtmosphereFactorField } from "./atmosphere-math.js";
import { interpretiveParadigmModels } from "./terrain-math.js";
import { mindAntimatter, collide } from "./antimatter.js";

const freeze = Object.freeze;

/** The person at the door. Reserved: never a character, never an entity in
 * material — the BODY whose claims are the conversation's own, the mirror
 * of perspective.js's READER. A mind of the person sits at
 * `user:mind:<key>`; the body itself is the undifferentiated remainder. */
export const USER = "holder:user";

/** The address of one mind seated at one body. A mind is a frame; a body is
 * a being that can sit many frames. `body` is USER, READER, or any referent
 * holder; `key` names the mind (the frame it was spoken or read under). A
 * body may not itself be a mind — a mind of a mind is a category error the
 * parliament's body-check would silently misread, so it is refused here. */
export const mindHolder = (body, key) => {
  if (typeof body !== "string" || !body) throw new TypeError("mindHolder: a body is required — a mind sits at a being, never at nothing");
  if (body.includes(":mind:")) throw new TypeError("mindHolder: a body may not itself be a mind (" + body + ") — a mind sits at a being, and a being is not a mind");
  if (typeof key !== "string" || !key) throw new TypeError("mindHolder: a mind is named by a key — an unnamed mind is the body itself");
  if (key.includes(":mind:")) throw new TypeError("mindHolder: a mind key may not smuggle another mind's address (" + key + ") — one seat, one mind");
  return `${body}:mind:${key}`;
};

/** Which body a holder belongs to — the part of the address before a mind
 * key. `user:mind:engineer` belongs to the user; `holder:user` is its own
 * body. Two different minds of one body are a self-disagreement in the
 * parliament, never a contradiction to be collapsed. */
export const bodyOf = (holder) => {
  const i = String(holder).indexOf(":mind:");
  return i >= 0 ? String(holder).slice(0, i) : holder;
};

const mindKeyOf = (holder) => {
  const i = String(holder).indexOf(":mind:");
  return i >= 0 ? String(holder).slice(i + ":mind:".length) : null;
};

const NON_NEGATIVE_INT = (n, name) => {
  if (!Number.isInteger(n) || n < 1) throw new TypeError(`${name}: an integer >= 1 is required — a model is read at a declared depth, never defaulted`);
};

/** The system's own for-whom — a mind at which the reader models itself.
 * The giver is what the reader IS (self.js's Ubuntu clause, verbatim); the
 * way of knowing is proprioception (THE-WAYS-OF-KNOWING's ninth spoke —
 * knowing-oneself); the medium is the self plane, never a thing in the
 * world. A fold at this frame is the capability that made it, aimed at
 * itself — which is the thesis made reflexive. The system's many minds are
 * this constructor called under many frames (different questions, different
 * givers), and a persisted mind's holder is `mindHolder(READER, key)`. */
export function selfForWhom({ question, giver = null, priors = [], ground = null } = {}) {
  return createForWhom({
    id: READER,
    giver: giver ?? `${READER_SELF.is} — ${READER_SELF.constitutedBy}`,
    question,
    priors,
    ground,
    universe: freeze(["self", ...(priors ?? [])]),
    medium: "self",
    knowing: "proprioception",
  });
}

/** The person's for-whom — a mind at which the reader models the one
 * chatting. The giver is the person (never "the system" — that answers
 * nothing a reading could act on); the way of knowing is ostension (the
 * person hands material over and asks directly — the first spoke). A
 * person's many minds are this constructor called under many frames and
 * folded at `mindHolder(USER, key)` holders. */
export function userForWhom({ question, giver = "the person at the door", priors = [], ground = null } = {}) {
  return createForWhom({
    id: USER,
    giver,
    question,
    priors,
    ground,
    universe: freeze(["chat", ...(priors ?? [])]),
    medium: "chat",
    knowing: "ostension",
  });
}

/** A being's for-whom — a mind at which the reader models any entity a
 * reading has established (a referent, a narrator, a hypothesis). This is
 * createForWhom under a holder's own name: `holder` is both the frame's id
 * and the perspective-log holder to fold at (or a `mindHolder(body, key)`
 * for one of the being's many minds).
 *
 * `question` defaults to the being's own horizon — "the universe as known to
 * <the being>" — because a mind reads FOR itself before it reads for any
 * asker (the for-whom's first job is the being's own world; the reader's
 * question is a second frame, supplied when it is one). A fold against that
 * default is the FOR-THEM fold: the universe folded at the being, for the
 * being, not gated on an external ask. */
export function entityForWhom({ holder, question = null, giver = null, priors = [], ground = null, medium = null, knowing = null } = {}) {
  const body = bodyOf(holder ?? "");
  return createForWhom({
    id: holder,
    giver: giver ?? `entity:${holder}`,
    question: question ?? `the universe as known to ${body}`,
    priors,
    ground,
    universe: freeze([...(priors ?? [])]),
    medium: medium ?? "material",
    knowing: knowing ?? "perturbation",
  });
}

/** Build many minds at one body — one for-whom per frame. `frames` is a
 * list of frame overrides ({ key, question, giver, priors, ground, medium,
 * knowing }); each produces a for-whom whose id is the mind's holder, so
 * the reader can fold the being under every frame it sits and the
 * parliament can adjudicate the being against itself. */
export function mindsAt(body, frames = []) {
  const list = Array.isArray(frames) ? frames : [];
  return freeze(list.map((frame, i) => {
    const key = frame?.key ?? i;
    return createForWhom({
      id: mindHolder(body, key),
      giver: frame?.giver ?? `${body} as ${key}`,
      question: frame?.question,
      priors: frame?.priors,
      ground: frame?.ground,
      universe: freeze([...(frame?.priors ?? [])]),
      medium: frame?.medium ?? null,
      knowing: frame?.knowing ?? null,
    });
  }));
}

/** Which obligations a mind stands on. An obligation is the reading's unless
 * it names a holder (caller annotation, S6); an obligation naming no holder
 * belongs to the body as a whole, and every mind seated there stands on it.
 * An obligation naming another body is not this mind's. */
const obligationsFor = (obligations, target) => {
  const body = bodyOf(target);
  return (obligations ?? []).filter((o) => {
    const holder = o?.holder ?? null;
    return holder == null || holder === target || bodyOf(holder) === body;
  });
};

/** Fold the universe at a mind's position. The one operation behind all
 * three subjects: given a frame and the log, it answers BOTH what the
 * reading found (the three-leg gate) and what this mind holds (the
 * projected perspective) from the same folded state — and reports the fold
 * at all three altitudes (the atmosphere it stands on, the lens it holds,
 * the paradigm it expects) — with the typed gaps where none of these is
 * answerable. `holder` defaults to the frame's id, so
 * selfForWhom/userForWhom/entityForWhom/mindsAt each fold at their own seat.
 *
 * `entries` is a DeltaFold@1 log or a flat list of operations and structure
 * entries; the gate consumes the structure entries and the projection
 * consumes the Lens operations, one input, two views. `obligations` is the
 * reading's EOObligation@1 entries (each optionally naming the holder that
 * took it on); the mind's subset is folded through the atmosphere and
 * paradigm projections. The streaming caller (the reader's own chain) folds
 * deltas into `createForWhomFold` with `foldForWhom` per delta and calls
 * `gateForWhomFold` + `projectPerspectives` at the moment — the same shapes
 * this organ returns, never re-read. */
export function foldUniverseAt(forWhom, { holder = null, entries = [], atSeq = null, claimOf = null, gateOpts = null, obligations = [], minTrajectory = 12 } = {}) {
  const target = holder ?? forWhom.id;
  const list = Array.isArray(entries) ? entries : [];
  const fwFold = createForWhomFold(forWhom);
  for (const e of list) foldForWhom(fwFold, e);
  const gate = gateForWhomFold(fwFold, { ...(gateOpts ?? {}), minTrajectoryLength: gateOpts?.minTrajectoryLength ?? minTrajectory });
  const projected = projectPerspectives(list, { atSeq: atSeq == null ? undefined : atSeq, claimOf: claimOf ?? undefined });
  const perspective = projected?.perspectives?.[target] ?? null;

  const mine = obligationsFor(obligations, target);
  const atmosphere = interpretiveAtmosphereFactorField(mine, { sequence: null });
  const paradigm = interpretiveParadigmModels(mine);

  const gaps = [];
  if (projected.gap) gaps.push(projected.gap);
  if (!perspective) gaps.push(freeze({ type: "unknown_holder", detail: `${target} holds nothing in this projection — a model of a mind requires a mind who was recorded (perspective.js's own wall)` }));
  if (gate.coherentEvaluable === false) gaps.push(freeze({ type: "coherence_withheld", detail: `the discovery trajectory is too short (${gate.trajectoryLength} < ${minTrajectory}) for the DMD leg to be evaluable — withheld, never refused (for-whom.js's own gate)` }));

  const held = perspective ? perspective.beliefs.filter((b) => b.stance === STANCE.HOLDS) : [];

  // THE NEGATIVE SPACE — what this mind does not know, derived from what its
  // world raised (antimatter.js): the claims it holds against the material's
  // contradiction (undermined) and the questions its world asked that it
  // never answered (unsettled), plus the collision — the residue of belief
  // meeting its own hole, which is a question, not an answer. A model of a
  // mind that carries only what the mind holds is a theory of presence; the
  // false-belief task is a test of absence, and this field is that test.
  const negative = mindAntimatter(projected, target);
  const collision = collide(freeze({ holder: target, perspective: perspective ?? null }), negative);

  return freeze({
    schema: "EOUniverse@1",
    holder: target,
    body: bodyOf(target),
    mind: mindKeyOf(target),
    forWhom,
    question: forWhom.question,
    gate,
    admitted: gate.admitted,
    // THE THREE ALTITUDES — where the mind stands, what it holds, what it
    // expects. The gate is these three gated; each altitude carries its own
    // leg's verdict so a mind can be compared by altitude, not only by count.
    altitudes: freeze({
      atmosphere: freeze({
        ground: forWhom.ground,
        priors: forWhom.priors,
        obligations: mine.length,
        field: atmosphere,
        tension: atmosphere.tensionAvailable ? atmosphere.tension : null,
        // The material leg: is there a ground at all?
        admitted: gate.material,
      }),
      lens: freeze({
        perspective,
        heldCount: held.length,
        // The relevance leg: does what it holds touch the question?
        admitted: gate.relevant,
      }),
      paradigm: freeze({
        dominantMode: gate.coherentMass ?? gate.real ?? null,
        models: paradigm,
        trajectoryLength: gate.trajectoryLength,
        // The coherence leg is admitted ONLY where it was EVALUATED and
        // cleared — a withheld leg (a trajectory too short to decompose) is
        // not an admitted shape, never a quiet pass. Withheld, never refused.
        evaluable: gate.coherentEvaluable,
        admitted: gate.coherent && gate.coherentEvaluable,
      }),
    }),
    perspective: perspective
      ? freeze({
          holder: perspective.holder,
          beliefs: perspective.beliefs,
          held: freeze(held),
          heldCount: held.length,
          unclaimedActs: perspective.unclaimedActs,
        })
      : null,
    negative,
    collision,
    seen: freeze({ totalDiscovered: fwFold.totalDiscovered, relevantDiscovered: fwFold.relevantDiscovered, encounters: fwFold.encounters, trajectoryLength: gate.trajectoryLength }),
    gaps: freeze(gaps),
  });
}

/** Fold the universe AT a being FOR THE BEING — the being's own world, gated
 * on whether it has attested a world of its own rather than on whether its
 * world answers an external ask. Where `foldUniverseAt` asks "what does this
 * mind's reading say about MY question", `universeOf` asks "what IS this
 * mind's world".
 *
 * THE UNIVERSE IS FOLDED FROM WHAT THE BEING ITSELF ATTESTED AND NOTHING
 * ELSE. `held` is what the being itself holds — its own acts on the Lens
 * cell. The gate is read from the being's own attested world: material (has
 * it held anything), paradigm (the shape of its own attestations), and lens
 * FOR THEM (does it hold a world of its own). A being the reader has placed
 * into a hundred events but that has attested nothing has NO universe FOR
 * THEM — the placement is the reading's knowledge, and the being is out of
 * the loop on the reading.
 *
 * THE IRONY WALL, TWO KINDS OF READER KNOWLEDGE, NEITHER FOLDED IN. What the
 * READING places the being into — the events the reading extracted with the
 * being as a participant — is `attributed`: the reading's model of the
 * being, never the being's own experience. What the READER holds that the
 * being has no belief about is `outOfLoop`: dramatic irony. Both are the
 * reader's knowledge; both are reported apart and gate nothing. Being out of
 * the loop means it does not affect them. What the being holds that the
 * reader has no belief about is its `private` world — the reader is out of
 * the loop on it. A real disagreement on a claim both hold is `contested`,
 * reported apart from both — the being IS in the loop on it. */
export function universeOf(forWhom, { holder = null, entries = [], atSeq = null, claimOf = null, obligations = [], minTrajectory = 12, from = READER, nullDraws = 40, nullSeed = 42 } = {}) {
  const target = holder ?? forWhom.id;
  const body = bodyOf(target);
  const list = Array.isArray(entries) ? entries : [];
  const projected = projectPerspectives(list, { atSeq: atSeq == null ? undefined : atSeq, claimOf: claimOf ?? undefined });
  const perspective = projected?.perspectives?.[target] ?? null;
  const held = perspective ? perspective.beliefs.filter((b) => b.stance === STANCE.HOLDS) : [];

  // THE BEING'S OWN ACTS: every Lens operation it itself landed. Nothing a
  // reader or another being landed counts as the being's own attestation.
  const ownActs = [];
  for (const entry of list) {
    const ops = entry?.schema === "DeltaFold@1" ? (entry.operations ?? []) : entry?.schema === "EOOperation@1" ? [entry] : [];
    for (const op of ops) {
      if (op?.terrain === "Lens" && op?.payload?.holder === target) ownActs.push(op);
    }
  }

  // THE BEING'S BLINDSPOTS — the negative space of its own world
  // (antimatter.js): the claims it holds against the material's
  // contradiction (it does not know its own contradiction exists) and the
  // questions its own world raised that it never answered. The world is
  // DECLARED — the being itself and the holders its own acts relay through
  // (their via chains) — so claims raised outside the world are reported as
  // OUTSIDE, never as the being's own: the being is out of the loop on them
  // (the irony wall), and out of the loop means they do not affect it. The
  // FOR-THEM universe is what the being knows; the blindspots are what it
  // does not know, and a being is not modelled without its holes — the
  // collision of the two is the residue, which is a question, not an answer.
  // THE IRONY WALL, AT THE WORLD'S OWN BOUNDARY: the reader is never in a
  // being's world — its knowledge is the reading's, never the being's own,
  // and one relayed op must not pull the reader's whole claim set into the
  // being's blindspots (falsified 2026-09-19, by the swarm). The world is
  // the being itself and the non-reader holders its own acts relay through.
  const worldHolders = freeze([target, ...ownActs.flatMap((op) => op?.payload?.via ?? []).filter((h) => h !== READER)]);
  const blindspots = mindAntimatter(projected, target, { world: worldHolders });
  const collision = collide(freeze({ holder: target, perspective: perspective ?? null }), blindspots);

  // The shape of the being's OWN experience: its acts across its own
  // encounters. Reader-attributed participation is not in this trajectory —
  // the reading's placement of the being is the reading's shape, never the
  // being's own.
  const byEncounter = new Map();
  for (const op of ownActs) {
    const w = String(op.witness ?? "unaddressed");
    byEncounter.set(w, (byEncounter.get(w) ?? 0) + 1);
  }
  const ownTrajectory = Object.freeze([...byEncounter.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, n]) => n));

  // THE FOR-THEM GATE, read ONLY from the being's own attestation.
  const material = held.length > 0 || ownActs.length > 0; // attested a world at all
  const lensAdmitted = held.length > 0; // holds a world of its own
  const evaluable = ownTrajectory.length >= minTrajectory;
  const coherent = evaluable ? coherentMass(ownTrajectory) > trajectoryNull(ownTrajectory, { draws: nullDraws, seed: nullSeed }) : true;
  const admitted = material && lensAdmitted && (evaluable ? coherent : true);

  const mine = obligationsFor(obligations, target);
  const atmosphere = interpretiveAtmosphereFactorField(mine, { sequence: null });
  const paradigm = interpretiveParadigmModels(mine);

  // THE TWO ASYMMETRIES AND THE CONTEST, each reported apart, none folded in.
  const readerKnows = divergence(projected, from, target);
  const beingKnows = divergence(projected, target, from);

  // THE READING'S PLACEMENT OF THE BEING — events the reading extracted with
  // the being as a participant. Reader knowledge, never the being's own.
  const participates = (p) => p?.ref != null && (p.ref === target || p.ref === body);
  const attributedEvents = list.filter((e) => e?.schema === "EOHyperedge@1" && (e.participants ?? []).some(participates));

  const gaps = [];
  if (projected.gap) gaps.push(projected.gap);
  if (!perspective) gaps.push(freeze({ type: "unknown_holder", detail: `${target} holds nothing in this projection — a universe requires a being who was recorded (perspective.js's own wall)` }));
  if (!evaluable) gaps.push(freeze({ type: "shape_withheld", detail: `the being's own attestations span ${ownTrajectory.length} < ${minTrajectory} encounters — the shape of its experience is withheld, never refused, and never reported as admitted` }));

  return freeze({
    schema: "EOUniverseFor@1",
    holder: target,
    body,
    mind: mindKeyOf(target),
    forWhom,
    // The being's own horizon, folded at itself: this is the "question" the
    // FOR-THEM fold reads for — the being's world, not an external ask.
    question: forWhom.question,
    admitted,
    gate: freeze({ material, lensAdmitted, coherent, coherentEvaluable: evaluable, admitted, trajectoryLength: ownTrajectory.length, decision: admitted
      ? `admitted — the being attested ${held.length} belief(s) across ${ownTrajectory.length} encounters; it has a world of its own`
      : !material ? "refused — the being attested no world of its own; whatever the reading places it into is the reading's knowledge, and the being is out of the loop on it"
        : !lensAdmitted ? "refused — the being acts but holds nothing; a body without a mind"
          : "refused — the being's own experience has no shape above its null; a flat world" }),
    // THE BEING'S OWN WORLD — what it itself attests, and nothing else.
    universe: freeze({
      held: freeze(held),
      heldCount: held.length,
      ownActs: ownActs.length,
      trajectoryLength: ownTrajectory.length,
    }),
    // THE IRONY WALL. The being is out of the loop on these — they are the
    // reader's holdings the being has no belief about (dramatic irony),
    // reported here and NOWHERE ELSE in this fold; they gate nothing. Being
    // out of the loop means they do not affect the being.
    outOfLoop: freeze({
      asymmetric: readerKnows.asymmetric,
      count: readerKnows.asymmetric.length,
      detail: "the being is out of the loop on these — the reader's holdings the being has no belief about (dramatic irony); they do not enter the being's universe and do not affect it",
    }),
    // The READING's placement of the being — events it extracted with the
    // being as a participant. Reader knowledge, never the being's own: the
    // being may be out of the loop on the very events it was placed into.
    attributed: freeze({
      events: freeze(attributedEvents),
      count: attributedEvents.length,
      detail: "the reading places the being in these events; they are the reading's knowledge, never the being's own attestation, and they do not gate the being's universe",
    }),
    // What the being holds that the reader has no belief about — the
    // being's private world. The reader is out of the loop on it.
    private: freeze({
      asymmetric: beingKnows.asymmetric,
      count: beingKnows.asymmetric.length,
      detail: "what the being holds that the reader has no belief about — the being's own private world, which the reader is out of the loop on",
    }),
    // A claim BOTH hold, at odds: a real disagreement, not irony. The being
    // IS in the loop on it.
    contested: freeze({
      conflicting: readerKnows.conflicting,
      count: readerKnows.conflicting.length,
    }),
    blindspots,
    collision,
    altitudes: freeze({
      atmosphere: freeze({ ground: forWhom.ground, priors: forWhom.priors, obligations: mine.length, field: atmosphere, tension: atmosphere.tensionAvailable ? atmosphere.tension : null, admitted: material }),
      lens: freeze({ perspective, heldCount: held.length, admitted: lensAdmitted }),
      paradigm: freeze({ dominantMode: evaluable ? coherentMass(ownTrajectory) : null, models: paradigm, trajectoryLength: ownTrajectory.length, evaluable, admitted: evaluable && coherent }),
    }),
    perspective,
    gaps: freeze(gaps),
  });
}

/** The altitude signature of a mind — the compact shape by which two minds
 * over one material can be compared: the ground it stood on, the count of
 * what it holds, and the mode its reading settled into. `sameShape(a, b)`
 * is true only when the two minds share a ground AND settled into the same
 * dominant mode — two minds that read the same material at the same
 * altitude but hold different things are a disagreement, not a difference
 * of shape. */
export function mindShape(fold) {
  return freeze({
    schema: "EOMindShape@1",
    holder: fold?.holder,
    body: fold?.body,
    mind: fold?.mind,
    ground: fold?.altitudes?.atmosphere?.ground ?? null,
    priors: fold?.altitudes?.atmosphere?.priors ?? freeze([]),
    mode: fold?.altitudes?.paradigm?.dominantMode ?? null,
    modeClear: (fold?.gate?.coherentEvaluable ?? false) && (fold?.gate?.coherent ?? false),
    heldCount: fold?.altitudes?.lens?.heldCount ?? 0,
    admitted: fold?.admitted ?? false,
  });
}

/** Whether two minds read the same material at the same altitude — the
 * precondition for their difference to be a disagreement rather than a
 * difference of position. Two minds that stand on different grounds or
 * settled into different shapes are not contradicting each other; they are
 * not reading the same thing. */
export function sameShape(a, b) {
  const A = mindShape(a);
  const B = mindShape(b);
  return A.ground === B.ground && A.modeClear === B.modeClear && (A.mode === B.mode || (A.modeClear === false && B.modeClear === false));
}

/** Higher-order theory of mind: what `from` holds about `about`, at `depth`
 * removes along the relay chain (`via`). Depth 1 is perspective.js's own
 * mentalModel — the union of every relay position, the thing the header
 * already calls "what a theory of mind IS". Depth >= 2 is one exact remove
 * from the ultimate source: `about` sits at `via[via.length - depth]`, so
 * "the reader's model of victor's model of the creature" is the reader
 * holding a claim relayed [victor, creature] read at depth 2 for `about` =
 * victor. The recursion is read off the structure the log already carries,
 * never inferred. */
export function theoryOfMind(projected, from, about, { depth = 1 } = {}) {
  NON_NEGATIVE_INT(depth, "depth");
  const holderPov = projected?.perspectives?.[from];
  if (!holderPov) {
    return freeze({ schema: "EOTheoryOfMind@1", from, about, depth, attributed: freeze([]), count: 0, gap: freeze({ type: "unknown_modeller", detail: `${from} holds nothing in this projection — a model requires a modeller who was recorded` }) });
  }
  if (depth === 1) {
    const model = mentalModel(projected, about, from);
    return freeze({
      schema: "EOTheoryOfMind@1",
      from, about, depth,
      attributed: model.attributed,
      count: model.count,
      ofHoldsInTotal: model.ofHoldsInTotal,
      coverage: model.coverage,
      gap: model.gap,
    });
  }
  const attributed = holderPov.beliefs
    .filter((b) => b.via.length >= depth && b.via[b.via.length - depth] === about)
    .map((b) => freeze({ claim: b.claim, stance: b.stance, via: b.via, relayDepth: b.via.length, atSeq: b.lastSeq, witness: b.witness }));
  const relaysInTotal = (projected?.perspectives?.[about]?.beliefs ?? []).filter((b) => b.via.length > 0).length;
  return freeze({
    schema: "EOTheoryOfMind@1",
    from, about, depth,
    attributed: freeze(attributed),
    count: attributed.length,
    // The honest denominator: how much of what `about` itself relays is
    // modelled here at all. A number of attributed claims with no
    // denominator is a summary nobody measured (P4).
    ofRelaysInTotal: relaysInTotal,
    coverage: relaysInTotal === 0 ? null : Number((attributed.length / relaysInTotal).toFixed(3)),
    gap: attributed.length === 0
      ? freeze({ type: "no_attributed_relay", detail: `${from} holds no belief whose relay chain places ${about} at depth ${depth} — the model is empty, which is different from ${about} holding nothing` })
      : null,
  });
}

/** Land the person's own turn as the person's held belief. The claim is the
 * person's own words — never a paraphrase, never a reading of them (S3 is
 * the adapter's and the model's, never this kernel's). A question the person
 * asks is a DEF act (they distinguish a gap into the reading); an assertion
 * is an EVA act; both land in Lens as ASSERTED — and an asserted claim never
 * leaks into the reader's own witnessed beliefs (perspective.js's wall). A
 * `mind` key (the frame the turn was spoken under) seats the belief on that
 * mind's holder; with no mind it seats on the body itself. */
export function userOperation({ claim, stance = STANCE.HOLDS, question = false, witness = null, via = [], mind = null }) {
  if (typeof claim !== "string" || !claim.trim()) throw new TypeError("userOperation: a turn is claimed by its own words — an empty claim is a typed gap, never a held nothing");
  return perspectiveOperation({
    holder: mind ? mindHolder(USER, mind) : USER,
    claim: claim.trim(),
    stance,
    basis: BASIS.ASSERTED,
    via,
    witness,
    operator: question ? "DEF" : null,
  });
}

/** The parliament: many minds over one material, adjudicated by the
 * question. Who was admitted (their reading made a difference to the
 * question) and who was refused (with the gate's own reason); among the
 * admitted, the common ground and the typed divergences — asymmetric
 * (one holds what another has no belief about) and conflicting (they
 * actively disagree) kept apart, never averaged (perspective.js's own
 * split). A contest between two minds of ONE body is typed a
 * self-disagreement — the same being holding two frames apart, which is a
 * result, never a contradiction to be collapsed. A refused mind is not a
 * member with a disagreement; it is not reading this question at all. */
export function parliament(folds = [], { question = null, projected = null } = {}) {
  const list = Array.isArray(folds) ? folds : [];
  const admitted = list.filter((f) => f?.admitted === true);
  const refused = list.filter((f) => f?.admitted !== true).map((f) => freeze({ holder: f?.holder, reason: f?.gate?.decision ?? "gate withheld — no fold was run" }));
  const agreements = [];
  const contests = [];
  if (projected && admitted.length >= 2) {
    for (let i = 0; i < admitted.length; i += 1) {
      for (let j = i + 1; j < admitted.length; j += 1) {
        const a = admitted[i];
        const b = admitted[j];
        const shared = commonGround(projected, a.holder, b.holder);
        const diff = divergence(projected, a.holder, b.holder);
        const sameBody = a.body === b.body && a.holder !== b.holder;
        if (shared.count > 0) agreements.push(freeze({
          schema: "EOParliamentAgreement@1",
          a: freeze({ holder: a.holder, mind: a.mind, recipe: a.forWhom.recipe }),
          b: freeze({ holder: b.holder, mind: b.mind, recipe: b.forWhom.recipe }),
          shared: shared.shared,
          count: shared.count,
        }));
        if (diff.count > 0) contests.push(freeze({
          schema: "EOParliamentContest@1",
          a: freeze({ holder: a.holder, mind: a.mind, recipe: a.forWhom.recipe }),
          b: freeze({ holder: b.holder, mind: b.mind, recipe: b.forWhom.recipe }),
          selfDisagreement: sameBody,
          asymmetric: diff.asymmetric,
          conflicting: diff.conflicting,
          count: diff.count,
        }));
      }
    }
  }
  // How many admitted minds each body sat — the multiplicity, counted apart
  // from the fold list (a body sitting two minds appears once here, twice there).
  const bodies = {};
  for (const f of admitted) bodies[f.body] = (bodies[f.body] ?? 0) + 1;
  // THE HOLES LEDGER — the essay's collision of holes, surfaced at the
  // parliament: every admitted mind's negative space, counted apart. A fold
  // that carried no negative space reports null, never a measured zero —
  // a hole that was not measured is not a hole that does not exist.
  const holes = admitted.map((f) => freeze({
    holder: f.holder,
    undermined: f.negative?.counted?.undermined ?? null,
    unsettled: f.negative?.counted?.unsettled ?? null,
    outside: f.negative?.counted?.outside ?? null,
    residue: f.collision?.counted?.residue ?? null,
  }));
  return freeze({
    schema: "EOParliament@1",
    question: question ?? null,
    folds: freeze(list),
    admitted: freeze(admitted),
    refused: freeze(refused),
    agreements: freeze(agreements),
    contests: freeze(contests),
    holes: freeze(holes),
    bodies: freeze(bodies),
    counted: freeze({ folds: list.length, admitted: admitted.length, refused: refused.length, agreements: agreements.length, contests: contests.length, holes: holes.length }),
  });
}