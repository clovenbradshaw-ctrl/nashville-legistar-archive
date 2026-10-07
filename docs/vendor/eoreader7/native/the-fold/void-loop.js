// void-loop.js — answering as a DEF/EVA/REC loop over a declared void,
// run down the stance ladder.
//
// User direction, 2026-08-27, verbatim: "answering all questions starts
// with defining the VOID that needs to be filled with a DEF, EVA, REC
// loop" — then, asked what the stance face contributes: "and the stance
// face?"
//
// THE POSITION THIS FILE TAKES. Answering is not drafting-then-checking.
// It is: zero the space (void-shape.js's nine operators), then run one
// loop against it — propose fillers, admit or refuse each against the
// declared admission test, and re-zero when the posture that proposed
// them runs out. The answer is what the loop leaves standing, and an
// uncovered extent is a FINDING rather than a blank.
//
// WHAT THIS FILE ADDS, given that both halves already existed. `grid.js`
// already lands DEF, EVA and REC on an append-only task log, with every
// refusal the composition law names; `void-shape.js` already declares a
// space across all nine operators and does the coverage arithmetic. What
// was missing is that neither could reach the other, and nothing ran the
// loop: `declareVoid`'s only caller (void-brief.js) builds a declaration
// AFTER the answer has rendered and throws it away, and grid.js's acts
// are reachable only by a person typing `/act`. This file is the loop,
// and it is deliberately the only new thing — no second log, no second
// algebra, no second coverage test.
//
// ── THE CHOREOGRAPHY IS READ, NEVER CHOSEN ─────────────────────────────
//
// Every act this loop lands takes its terrain and its stance from the
// void's OWN cells, computed by the engine's cube at declaration time.
// Nothing here hardcodes a terrain/stance table, so a change in the
// engine's algebra moves this loop with it rather than leaving a second,
// drifting copy behind (`flattenTerrains`'s own discipline in grid.js,
// applied one level up). Computed against the real cube, the nine read:
//
//   NUL  slot         Differentiate Ground   Existence      Void      Clearing
//   SIG  anchor       Relate        Figure   Existence      Entity    Binding
//   INS  admits       Generate      Pattern  Existence      Kind      Composing
//   SEG  extent       Differentiate Ground   Structure      Field     Clearing
//   CON  relation     Relate        Figure   Structure      Link      Binding
//   SYN  composition  Generate      Pattern  Structure      Network   Composing
//   DEF  cardinality  Differentiate Figure   Interpretation Lens      Dissecting
//   EVA  admission    Relate        Figure   Interpretation Lens      Binding
//   REC  reopensOn    Generate      Pattern  Interpretation Paradigm  Composing
//
// So the loop's three stances are Dissecting -> Binding -> Composing:
// cut the candidates out, bind each to the ground, compose a new ground
// when the binding fails. DEF is the ONLY Dissecting cell in the whole
// declaration — cardinality is the single cut in a space otherwise made
// of clearings, bindings and compositions, and it is exactly the cell
// whose absence produced the specimen this work started from (a slot
// holding two fillers, read as holding one). DEF and EVA share a terrain
// (Lens) and differ only in stance: you cut with the lens, then you bind
// with it. That is why they are a loop and not two unrelated checks.
//
// ── TWO STANCE FACES, KEPT APART ───────────────────────────────────────
//
// The DERIVED stance (the engine's `STANCE_BY_MODE`, above) is a property
// of a cell — computed, never chosen, cannot be wrong. The DECLARED
// stance (`from <stance>` in grid.js's composition law) is the actor's
// posture — declared per act and refusable three ways. grid.js will not
// import the engine's stance labels, and its own header says why: a grid
// act is medium-blind (`at <terrain>` is authoritative and need not share
// the operator's domain), so an engine stance label there would read as
// authoritative output when it is not. A void declaration does not have
// that problem — `cellOf(op, grain)` uses the operator's OWN domain, so
// its nine cells are domain-locked by construction and their stances are
// legitimately meaningful. Same word, two standings. Do not harmonize
// them; one of the two breaks if you do.
//
// ── THE LADDER, AND WHY IT DESCENDS IN THIS ORDER ──────────────────────
//
// The declared stance is the loop's one free variable: it decides which
// generator proposes candidates at all. Three rungs, each naming a tier
// this repo already has, descended only when the one above is exhausted
// — `skills.js`'s own ladder discipline (skill -> slot-fill -> model,
// every descent a typed `open` entry), with stances in place of tiers.
// An answer reached at `encounter` and one reached at `extraction` are
// both answers, and they are not the same kind of answer; the record
// says which without anyone inferring it from a score.
//
// ── THE LOOP'S OWN LAW, DECLARED AS ITS OWN ────────────────────────────
//
// grid.js pins exactly one stance illegality: `synthesize` may not
// declare `from relate` ("you cannot commit a whole from a stance that
// refuses to commit"). This file generalizes that to the loop and OWNS
// the generalization rather than implying grid.js enforces it: the loop
// may not close from the posture it proposed from. A fan-out from
// `encounter` closed from `encounter` never tested anything — candidates
// were generated, a commitment was generated, and the EVA between them
// was ceremony. `closeLoop` refuses it by name (`stance_did_not_change`).
//
// ── FAN-OUT, NOT WALK ──────────────────────────────────────────────────
//
// `proposeFrom` takes an ARRAY and lands every candidate before any
// admission runs. This is structural, not stylistic: propose-one-test-it-
// propose-the-next is a greedy search, and a greedy search over two true
// fillers returns whichever it drew first — which is the specimen. The
// set of DEFs with no clearing EVA yet IS the superposition, and it is
// addressable on the log, projectable at a cursor, and revisable, because
// supersession keeps the past.
//
// ── PURE, ORGANS INJECTED (the cast.js discipline) ─────────────────────
//
// No engine import: `grid` arrives already constructed (it carries the
// cube and the task log), and `admission` — the EVA organ — is the
// caller's. This file imports only its sibling `void-shape.js`, the way
// `void-brief.js` already does, so it stays node-testable with no mount.

import { spaceFrom, fill, voidsOf, voidLine, undeclaredOf } from "./void-shape.js";

/**
 * The descent order, and each rung's generator. Giver for the ORDER:
 * skills.js's own ladder (mechanical first, one constrained call next,
 * the free model path last), read one register over. Giver for the
 * STANCE CELLS: grid.js's `STANCE_SHORTHANDS`, unchanged — this table
 * names them, it does not redefine them.
 *
 * `encounter` is last and is the only rung that can supply a filler the
 * material never named. That is where fabrication lives, and naming it
 * as a posture is what makes it visible instead of ambient.
 */
export const STANCE_LADDER = Object.freeze([
  Object.freeze({
    stance: "extraction",
    cell: "Differentiate·Figure",
    generates: "what the material itself already states",
  }),
  Object.freeze({
    stance: "cultivation",
    cell: "Relate·Figure",
    generates: "what binds to the anchor — a reference library, a fetched page, a witness",
  }),
  Object.freeze({
    stance: "encounter",
    cell: "Generate·Figure",
    generates: "a filler nothing named — supplied, not read",
  }),
]);

const LADDER_BASIS =
  "extraction -> cultivation -> encounter, descended only on exhaustion — skills.js's own descent ladder (skill -> slot-fill -> model), stances in place of tiers";

/** The nine fields `declareVoid` keys its cells by, indexed by operator. */
const FIELD_BY_OP = Object.freeze({
  NUL: "slot", SIG: "anchor", INS: "admits",
  SEG: "extent", CON: "relation", SYN: "composition",
  DEF: "cardinality", EVA: "admission", REC: "reopensOn",
});

const isDeclaration = (d) => d?.schema === "EOVoidDeclaration@1";
const refuse = (type, detail, extra = {}) => Object.freeze({ ok: false, refusal: Object.freeze({ type, detail, ...extra }) });

/**
 * Quote a value for an act line. A value carrying a double quote is
 * REFUSED rather than escaped or stripped: grid.js's tokenizer has no
 * escape syntax, so silently mangling the value would land an act about
 * something other than what the caller named — the one failure a loop
 * whose whole job is filler identity must not have.
 */
function quoted(value) {
  const s = String(value ?? "").trim();
  if (!s) return { ok: false, reason: "a filler is named, never blank" };
  if (s.includes('"')) return { ok: false, reason: `a double quote in "${s}" cannot be carried through the composition law, which has no escape syntax` };
  return { ok: true, text: `"${s}"` };
}

/**
 * The loop's own act vocabulary, read off a real declaration's cells.
 * Every entry is `{op, terrain, stance, grain}` taken from what the
 * engine's cube computed — never a table typed here.
 *
 * Returns a typed refusal (not a throw) when handed something that is
 * not an `EOVoidDeclaration@1`, so a caller's door can report it.
 */
export function loopChoreography(declaration) {
  if (!isDeclaration(declaration)) return refuse("not_a_declaration", "loopChoreography: expects an EOVoidDeclaration@1 from void-shape.js::declareVoid");
  const byOp = new Map(declaration.cells.map((c) => [c.op, c]));
  const read = (op) => {
    const c = byOp.get(op);
    return Object.freeze({ op, terrain: c.terrain, stance: c.stance, grain: c.grain, mode: c.mode, domain: c.domain, field: FIELD_BY_OP[op], declared: c.declared });
  };
  return Object.freeze({
    ok: true,
    open: read("NUL"),      // zero the space
    anchor: read("SIG"),    // what must resolve
    propose: read("DEF"),   // the cut — one act per candidate
    admit: read("EVA"),     // the bind — one act per candidate
    bind: read("CON"),      // two fillers of one slot are related
    compose: read("SYN"),   // the whole, from parts
    reopen: read("REC"),    // a new ambient ground begins
  });
}

/** Which rung the loop is standing on, or null once the ladder is spent. */
export function currentRung(loop) {
  return STANCE_LADDER[loop?.rung] ?? null;
}

/**
 * Open a loop against a declared void.
 *
 * REFUSES on the three absences the LOOP itself cannot survive, each by
 * its own name, and DISCLOSES the rest rather than refusing them.
 *
 * The first cut of this function refused any `under-specified`
 * declaration outright, on the position that if the nine cannot be
 * declared there is no question yet. Its own test caught the cost: a
 * space with no numeric extent can never open, so the cardinality close
 * — the only route such a space has — was unreachable code, and
 * `void-shape.js`'s own deliberate `constraint: null` branch ("you
 * cannot see a hole in a shape you never declared", the honest outcome)
 * could never be reached through a loop at all. A refusal no declaration
 * can usefully pass is a claim about the refusal, not about the
 * declaration — this repo has caught that shape twice before (the
 * measuring door's unreachable `best_of_n`, `nul`'s borrowed window
 * floor), and this is the third.
 *
 * So: `no_slot` (NUL — the opening act names it), `no_anchor` (SIG — the
 * ground of the opening act and of every admission), and
 * `no_closing_condition` (neither SEG's extent nor a numeric DEF
 * cardinality, so nothing could ever license a commit and the loop
 * would run forever). Everything else undeclared rides the loop as
 * `underSpecified` and is reported by `foldLoop`, visible exactly the
 * way `void-shape.js`'s own header asks for without being fatal.
 *
 * REFUSES without `broken`. Both of `ground <candidate> broken:<p>` are
 * required by grid.js's own grammar for the opening NUL act, and this
 * loop will not supply a default perturbation on a caller's behalf (P4:
 * every number and every parameter is the caller's). The practical
 * effect is that opening a loop costs the caller a statement of what
 * would make the whole thing wrong — which is the wall that keeps a
 * fan-out-and-score loop from becoming a spiral that agrees with itself.
 */
export function openLoop(declaration, { grid, log, broken, claimId = null } = {}) {
  if (!grid?.parseAct || !grid?.land) return refuse("no_grid", "openLoop: grid.js's instance is injected — this file carries no algebra of its own");
  if (!isDeclaration(declaration)) return refuse("not_a_declaration", "openLoop: expects an EOVoidDeclaration@1 from void-shape.js::declareVoid");
  if (typeof broken !== "string" || !broken.trim()) {
    return refuse("no_perturbation", "openLoop: zeroing a space names what would make it wrong — `broken` is the caller's, never defaulted");
  }
  const choreo = loopChoreography(declaration);
  if (!choreo.ok) return choreo;

  if (!declaration.slot) {
    return refuse("no_slot", `openLoop: ${undeclaredOf(declaration)}`, { undeclared: declaration.undeclared });
  }
  if (!choreo.anchor.declared) {
    return refuse("no_anchor", `openLoop: nothing is declared for this space to be a space OF — ${undeclaredOf(declaration)}`, { undeclared: declaration.undeclared });
  }
  if (!declaration.extent && !Number.isFinite(choreo.propose.declared)) {
    return refuse(
      "no_closing_condition",
      "openLoop: this space declares neither an extent (SEG) nor a numeric cardinality (DEF), so nothing could ever license a commit — a loop with no closing condition does not terminate",
      { undeclared: declaration.undeclared },
    );
  }

  const slotText = quoted(declaration.slot);
  if (!slotText.ok) return refuse("unquotable_slot", slotText.reason);
  const anchorText = quoted(choreo.anchor.declared ?? declaration.slot);
  if (!anchorText.ok) return refuse("unquotable_anchor", anchorText.reason);

  // `from ${mode}` — the bare mode resolves against the terrain's own
  // grain, which is how the opening act's stance comes out as exactly the
  // NUL cell's derived stance (Clearing) without this file naming it.
  const line = `void ${slotText.text} at ${choreo.open.terrain} from ${choreo.open.mode.toLowerCase()} ground ${anchorText.text} broken:${broken.trim()}`;
  const landed = landLine(grid, log, line, claimId);
  if (!landed.ok) return landed;

  return Object.freeze({
    ok: true,
    log: landed.log,
    line,
    loop: Object.freeze({
      schema: "EOVoidLoop@1",
      declaration,
      choreography: choreo,
      space: spaceFrom(declaration),
      rung: 0,
      ladderBasis: LADDER_BASIS,
      openingId: landed.ids[0],
      // Disclosed, never fatal: the cells this space did not declare.
      underSpecified: Object.freeze([...declaration.undeclared]),
      broken: broken.trim(),
      claimId,
      candidates: Object.freeze([]),
      descents: Object.freeze([]),
      closed: null,
    }),
  });
}

/** Parse-then-land one composed line, so every wall a typed act meets applies. */
function landLine(grid, log, line, claimId) {
  const parsed = grid.parseAct(line, { log });
  if (!parsed.ok) return Object.freeze({ ok: false, refusal: Object.freeze({ ...parsed.refusal, line }) });
  const event = claimId ? { ...parsed.event, claim_id: claimId } : parsed.event;
  const { log: next, ids } = grid.land(log, event);
  return Object.freeze({ ok: true, log: next, ids, event });
}

/**
 * DEF fan-out: every candidate lands as its own `define`, from the rung's
 * declared stance, BEFORE any admission runs.
 *
 * Each candidate is `{value, witness, span?, refs?}`. `witness` is
 * required and is a different fact from the stance: the witness says WHO
 * (the material, a reference library, `self:model`), the stance says HOW
 * (dissected out, bound in, encountered). A `self:model` candidate
 * proposed from `extraction` is the model claiming it READ this —
 * checkable against bytes, and a miss is a fabrication; the same
 * candidate from `encounter` is the model saying it is supplying this,
 * which is a different and honest thing.
 *
 * A candidate whose act the composition law refuses is REPORTED, never
 * silently dropped — the loop's own record of what it could not even ask.
 */
export function proposeFrom(loop, { grid, log, stance, candidates } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "proposeFrom: expects an EOVoidLoop@1");
  if (loop.closed) return refuse("loop_closed", "proposeFrom: this loop has already closed — re-open a new one rather than adding to a committed whole");
  const rung = currentRung(loop);
  if (!rung) return refuse("ladder_exhausted", "proposeFrom: every rung of the stance ladder has been spent");
  if (stance !== rung.stance) {
    return refuse("wrong_rung", `proposeFrom: this loop stands on "${rung.stance}" — "${stance}" is not the current posture, and descending is REC's act, never a caller's choice of words`, { standing: rung.stance, stated: stance });
  }
  if (!Array.isArray(candidates) || !candidates.length) {
    return refuse("no_candidates", "proposeFrom: a fan-out proposes a SET — an empty rung is exhausted, which is `descend`'s finding, not a proposal");
  }

  let current = log;
  const landedIds = [];
  const refusals = [];
  const admittedCandidates = [];
  for (const cand of candidates) {
    const value = quoted(cand?.value);
    if (!value.ok) { refusals.push({ candidate: cand?.value ?? null, type: "unquotable_filler", detail: value.reason }); continue; }
    if (typeof cand?.witness !== "string" || !cand.witness.trim()) {
      refusals.push({ candidate: cand.value, type: "no_witness", detail: "every proposed filler names who offers it — a candidate with no witness is a guess with no author" });
      continue;
    }
    const line = `define ${value.text} at ${loop.choreography.propose.terrain} from ${stance}`;
    const landed = landLine(grid, current, line, loop.claimId);
    if (!landed.ok) { refusals.push({ candidate: cand.value, ...landed.refusal }); continue; }
    current = landed.log;
    landedIds.push(landed.ids[0]);
    admittedCandidates.push(Object.freeze({
      value: String(cand.value).trim(),
      witness: cand.witness.trim(),
      stance,
      span: cand.span ?? null,
      refs: Object.freeze([...(cand.refs ?? [])]),
      defineId: landed.ids[0],
      standing: "wish",
      verdict: null,
      because: null,
      evaluateId: null,
    }));
  }

  return Object.freeze({
    ok: true,
    log: current,
    ids: landedIds,
    refusals: Object.freeze(refusals),
    loop: Object.freeze({ ...loop, candidates: Object.freeze([...loop.candidates, ...admittedCandidates]) }),
  });
}

/**
 * EVA: one `evaluate` per outstanding wish, from the EVA cell's own
 * derived stance (Binding — which is `cultivation`'s cell, so the
 * admission act always declares a RELATE posture no matter which rung
 * proposed the candidate; that stance change is the loop's spine).
 *
 * `admission` is the injected organ and answers the declared admission
 * test: `(candidate, {declaration, loop}) => {verdict, because, refs}`
 * where `verdict` is "holds" | "refused" | null. **null is not a
 * failure** — it is "checked, inconclusive", and the candidate stays a
 * wish, which is the honest state and the one this repo's own checking
 * organs already hold (grounding.js's `examined` vs `clean`).
 *
 * ONE test is built in rather than asked of the organ: a candidate whose
 * span lies wholly outside the declared extent is refused as arithmetic,
 * without consulting anything. That is not judgment and cannot be wrong.
 * Everything else is the organ's.
 *
 * The verdict is attached with `attachResult`, never written into the act
 * line as `verdict:` — grid.js's own note for exactly this case: a
 * verdict on a RESULT entry reads as COMPUTED, where one in the line
 * reads as DECLARED by whoever typed it, and these acts are not typed by
 * anyone.
 */
export function admit(loop, { grid, log, admission } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "admit: expects an EOVoidLoop@1");
  if (typeof admission !== "function") return refuse("no_admission_organ", "admit: the admission test is the caller's organ — this file does not know what the declared test means");
  const wishes = loop.candidates.filter((c) => c.standing === "wish");
  if (!wishes.length) return refuse("nothing_outstanding", "admit: every proposed filler has already been evaluated on this loop");

  const extent = loop.declaration.extent ?? null;
  let current = log;
  let space = loop.space;
  const byId = new Map();
  const refusals = [];

  for (const cand of wishes) {
    const value = quoted(cand.value);
    const anchorText = quoted(loop.choreography.anchor.declared ?? loop.declaration.slot);
    if (!value.ok || !anchorText.ok) { refusals.push({ candidate: cand.value, type: "unquotable_filler", detail: value.reason ?? anchorText.reason }); continue; }

    const line =
      `evaluate ${value.text} at ${loop.choreography.admit.terrain} from cultivation ` +
      `ground ${anchorText.text} broken:${loop.broken}`;
    const landed = landLine(grid, current, line, loop.claimId);
    if (!landed.ok) { refusals.push({ candidate: cand.value, ...landed.refusal }); continue; }
    current = landed.log;
    const evaluateId = landed.ids[0];

    // The one built-in test: arithmetic, not judgment.
    const outside = extent && cand.span && (cand.span.to < extent.from || cand.span.from > extent.to);
    const read = outside
      ? { verdict: "refused", because: `its extent ${cand.span.from}-${cand.span.to} lies wholly outside ${extent.from}-${extent.to}`, refs: [], basis: "extensional" }
      : { ...(admission(cand, { declaration: loop.declaration, loop }) ?? {}), basis: "declared-admission" };

    const verdict = read.verdict === "holds" || read.verdict === "refused" ? read.verdict : null;
    const result = Object.freeze({
      filler: cand.value,
      witness: cand.witness,
      proposedFrom: cand.stance,
      basis: read.basis,
      because: read.because ?? null,
      refs: Object.freeze([...(read.refs ?? [])]),
    });
    // Omitting `verdict` entirely is the honest shape for checked-but-
    // inconclusive; grid.js's foldGrid already reads that as "wish".
    const attached = grid.attachResult(current, evaluateId, result, verdict ? { verdict } : {});
    if (!attached.ok) { refusals.push({ candidate: cand.value, ...attached.refusal }); continue; }
    current = attached.log;

    if (verdict === "holds") space = fill(space, { filler: cand.value, span: cand.span, source: cand.witness });
    byId.set(cand.defineId, Object.freeze({
      ...cand,
      // EVALUATED-AND-INCONCLUSIVE IS NOT UNEVALUATED. Both used to land
      // back on `wish`, so a candidate HL had already read and returned
      // `unbound` for stayed indistinguishable from one never looked at —
      // and since `descend` refuses while a wish is untested, a single
      // junk candidate nothing could settle pinned the ladder forever.
      // Surfaced by wiring the HL tier, where `unbound` is the CORRECT
      // and common answer for a source that simply says nothing.
      standing: verdict === "holds" ? "testimony" : verdict === "refused" ? "refused" : "undetermined",
      verdict,
      because: read.because ?? null,
      // WHICH test refused it, because `reshape` treats the two
      // differently: an extensional refusal rests on the declared extent,
      // so conceding that extent re-opens the candidate; a refusal by the
      // declared admission organ was never about the extent and stands.
      refusedBy: verdict === "refused" ? read.basis : null,
      evaluateId,
    }));
  }

  return Object.freeze({
    ok: true,
    log: current,
    refusals: Object.freeze(refusals),
    loop: Object.freeze({
      ...loop,
      space,
      candidates: Object.freeze(loop.candidates.map((c) => byId.get(c.defineId) ?? c)),
    }),
  });
}

/**
 * The projection. Nothing here computes: it reads the loop's own
 * candidates and hands the space to `void-shape.js`'s arithmetic, which
 * is the only thing allowed to say whether an extent is covered.
 *
 * `standing` is deliberately five-valued rather than a boolean, for the
 * same reason `voidsOf` is: "the space is covered", "the space is short
 * and this posture is spent", "the space is short and there are still
 * untested candidates", "the ladder is spent", and "committed" are five
 * different facts and a caller must be able to tell them apart.
 */
export function foldLoop(loop) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "foldLoop: expects an EOVoidLoop@1");
  const wishes = loop.candidates.filter((c) => c.standing === "wish");                 // proposed, never evaluated
  const undetermined = loop.candidates.filter((c) => c.standing === "undetermined");   // evaluated, nothing settled it
  const testimony = loop.candidates.filter((c) => c.standing === "testimony");
  const refused = loop.candidates.filter((c) => c.standing === "refused");
  const coverage = voidsOf(loop.space);
  const cardinality = loop.choreography.propose.declared;
  const cardinalityMet = Number.isFinite(cardinality) && testimony.length === cardinality;
  const rung = currentRung(loop);

  // A SPACE IS NOT COVERED WHILE IT HOLDS A FILLER IT CANNOT PLACE.
  //
  // `voidsOf` has always computed `unplaced` separately — a filler admitted
  // with no span, "a real witness whose extent is unknown, disclosed
  // separately rather than silently counted as covering everything (which
  // would close the void by ignorance)" — and nothing has ever read it.
  // Same shape as the finding this whole line of work started from
  // (`clusterFillers` computing cardinality that nothing downstream asked
  // for), one file over.
  //
  // Reading it matters because "covered" is the licence to commit, and a
  // space whose completeness depends on IGNORING something it admitted is
  // not complete — it is complete-if-you-don't-count-that. Measured on the
  // real specimen: Hamlin's own page states 1861-1865 and covers the whole
  // declared extent, Johnson's own page states the relation and states no
  // span at all, and the honest reading of those two together is not
  // "Hamlin, complete" — it is "Hamlin, and one more the material does not
  // place."
  //
  // Only when there IS a constraint. With no extent declared, `voidsOf`
  // returns `unbounded` and nothing can be placed within it, so an unplaced
  // filler is not evidence of anything — it is the honest state of a space
  // that was never given a shape, and the cardinality route stays open.
  const unplacedBlocks = coverage.standing !== "unbounded" && coverage.unplaced.length > 0;

  // `unplaced` overrides a COVERED reading and never a genuinely short one:
  // a space that is short has somewhere to go (descend, find more) and
  // reporting it as unplaceable would stop the ladder on the wrong finding.
  const wouldBeCovered = coverage.standing === "covered" || cardinalityMet;
  const standing = loop.closed
    ? "committed"
    : wouldBeCovered && !unplacedBlocks
      ? "covered"
      : wishes.length
        ? "outstanding"
        : wouldBeCovered
          ? "unplaced"
          : rung
            ? "posture_spent"
            : "ladder_spent";

  return Object.freeze({
    ok: true,
    standing,
    rung: rung ? rung.stance : null,
    wishes: Object.freeze(wishes),
    undetermined: Object.freeze(undetermined),
    testimony: Object.freeze(testimony),
    refused: Object.freeze(refused),
    coverage,
    cardinality: Number.isFinite(cardinality) ? cardinality : null,
    cardinalityMet,
    line: voidLine(loop.space),
    descents: loop.descents,
    underSpecified: Object.freeze([...(loop.underSpecified ?? [])]),
    reshapes: Object.freeze([...(loop.reshapes ?? [])]),
    reshapeTriggers: reshapeTriggers(loop),
    closed: loop.closed,
  });
}

/**
 * REC: this posture is spent, so a new ambient ground begins.
 *
 * Lands through `grid.concedeEvaluation` — the existing REC path,
 * modelled (its own header says so) on `build-log.js::rezeroBuild`: an
 * EVIDENCE·REC entry carrying the trigger VERBATIM, with no `supersedes`,
 * because a re-zero concedes a ground rather than compiling a new whole
 * out of the old one. The candidates already on the log are not retracted
 * by descending; they stay exactly where they are, which is what makes a
 * collapse revisable rather than a deletion.
 *
 * REFUSES while any wish is still outstanding. "This posture is spent" is
 * a finding about the generator, and it cannot be true while candidates
 * it already produced have not been tested — descending there would spend
 * a lower, looser posture on work the current one had not finished.
 */
export function descend(loop, { grid, log, trigger } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "descend: expects an EOVoidLoop@1");
  if (loop.closed) return refuse("loop_closed", "descend: this loop has already committed");
  const rung = currentRung(loop);
  if (!rung) return refuse("ladder_exhausted", "descend: every rung of the stance ladder has been spent — there is no looser posture to fall to");
  const outstanding = loop.candidates.filter((c) => c.standing === "wish");
  if (outstanding.length) {
    return refuse("wishes_outstanding", `descend: ${outstanding.length} filler(s) proposed from "${rung.stance}" have not been evaluated — a posture is not spent while its own candidates are untested`, { outstanding: outstanding.map((c) => c.value) });
  }
  if (typeof trigger !== "string" || !trigger.trim()) {
    return refuse("no_trigger", "descend: a re-zero records its own reason verbatim — never a silent concession");
  }

  const conceded = grid.concedeEvaluation(log, loop.openingId, { trigger: trigger.trim() });
  if (!conceded.ok) return Object.freeze({ ok: false, refusal: conceded.refusal });

  const next = loop.rung + 1;
  return Object.freeze({
    ok: true,
    log: conceded.log,
    id: conceded.id,
    from: rung.stance,
    to: STANCE_LADDER[next]?.stance ?? null,
    loop: Object.freeze({
      ...loop,
      rung: next,
      descents: Object.freeze([...loop.descents, Object.freeze({ from: rung.stance, to: STANCE_LADDER[next]?.stance ?? null, trigger: trigger.trim(), id: conceded.id })]),
    }),
  });
}

/**
 * Commit the whole.
 *
 * THE LOOP'S OWN LAW (this file's, not grid.js's — see the header): the
 * closing stance may not be one any surviving filler was proposed from.
 *
 * Two ways to be closable, and they come from different cells. COVERAGE
 * (SEG's extent, via `voidsOf`) — every part of the declared extent is
 * covered by a named filler. CARDINALITY (DEF's own cell) — the declared
 * number of fillers is met, which is the only route open to a space with
 * no numeric extent, since `voidsOf` on an unbounded space can never
 * report "covered" and closing on it would be closing by ignorance.
 *
 * ONE filler commits as testimony and lands no further act: grid.js
 * refuses `synthesize` with fewer than two parts, and it is right to —
 * you do not compose a whole out of one part. TWO OR MORE land a `relate`
 * (they co-fill one slot, which is a real edge, warranted by the slot
 * itself) and then the `synthesize`. The relate is not ceremony: it is
 * what makes the synthesis legal under grid.js's own
 * `unwarranted_synthesis` refusal, and the fact that it is required is
 * the grammar saying that parts must be related before they are composed.
 */
export function closeLoop(loop, { grid, log, stance } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "closeLoop: expects an EOVoidLoop@1");
  if (loop.closed) return refuse("loop_closed", "closeLoop: this loop has already committed");
  const fold = foldLoop(loop);
  if (fold.standing === "unplaced") {
    return refuse(
      "unplaced_filler",
      `closeLoop: ${fold.coverage.unplaced.map((f) => `«${f}»`).join(", ")} cleared admission and the material never placed ` +
      `${fold.coverage.unplaced.length > 1 ? "them" : "it"} — the extent reads covered only by not counting ` +
      `${fold.coverage.unplaced.length > 1 ? "them" : "it"}, which is not the same as being covered`,
      { standing: fold.standing, unplaced: fold.coverage.unplaced, coverage: fold.coverage },
    );
  }
  if (fold.standing !== "covered") {
    return refuse("void_open", `closeLoop: ${voidLine(loop.space)}`, { standing: fold.standing, coverage: fold.coverage });
  }
  const testimony = fold.testimony;
  if (!testimony.length) return refuse("nothing_admitted", "closeLoop: no filler cleared its admission — there is no whole to commit");

  const proposedFrom = new Set(testimony.map((c) => c.stance));
  if (proposedFrom.has(stance)) {
    return refuse(
      "stance_did_not_change",
      `closeLoop: these fillers were proposed from "${stance}" and cannot be committed from it — you cannot commit a whole from the posture that proposed it, or the evaluation between them tested nothing`,
      { proposedFrom: [...proposedFrom], stated: stance },
    );
  }
  if (typeof stance !== "string" || !stance.trim()) {
    return refuse("no_stance", "closeLoop: a commit declares its own posture — an undeclared stance is an unfalsifiable one");
  }

  let current = log;
  const ids = [];
  if (testimony.length > 1) {
    const a = quoted(testimony[0].value);
    const b = quoted(testimony[1].value);
    const slotText = quoted(loop.declaration.slot);
    if (!a.ok || !b.ok || !slotText.ok) return refuse("unquotable_filler", a.reason ?? b.reason ?? slotText.reason);
    // Both referents are already established: each landed its own `define`.
    const relateLine = `relate ${a.text} to ${b.text} at ${loop.choreography.bind.terrain} from cultivation warrant:co-fillers-of-one-slot`;
    const related = landLine(grid, current, relateLine, loop.claimId);
    if (!related.ok) return related;
    current = related.log;
    ids.push(related.ids[0]);

    const parts = testimony.map((c) => quoted(c.value));
    const bad = parts.find((p) => !p.ok);
    if (bad) return refuse("unquotable_filler", bad.reason);
    const synthLine = `synthesize ${parts.map((p) => p.text).join(", ")} at ${loop.choreography.compose.terrain} from ${stance}`;
    const composed = landLine(grid, current, synthLine, loop.claimId);
    if (!composed.ok) return composed;
    current = composed.log;
    ids.push(composed.ids[0]);
  }

  return Object.freeze({
    ok: true,
    log: current,
    ids: Object.freeze(ids),
    loop: Object.freeze({
      ...loop,
      closed: Object.freeze({
        stance,
        by: fold.coverage.standing === "covered" ? "coverage" : "cardinality",
        fillers: Object.freeze(testimony.map((c) => c.value)),
        composed: testimony.length > 1,
      }),
    }),
  });
}

// ── REC's OTHER trigger: the finding reshapes the space ─────────────────
//
// `descend` handles one REC finding — this posture is spent. The other is
// larger and is the reason REC's own cell reads "what forces this
// DECLARATION to be revised" rather than "what forces another attempt":
// the space itself can be wrong, and the loop's own findings are what
// show it. A filler the admission test ADMITTED, whose extent runs past
// the extent the space declared, is the space being contradicted by
// something it accepted.
//
// The two REC findings land differently, and grid.js already had both
// paths for exactly this distinction:
//
//   posture spent      -> `concedeEvaluation`  EVIDENCE·REC, no supersedes
//                         (build-log.js's rezeroBuild: a re-zero concedes
//                         a ground, it does not compile a new whole)
//   declaration wrong  -> `revise ... supersedes <opening>`  SUPERSEDE
//                         (the act that zeroed the space is superseded,
//                         because the space it zeroed was the wrong one)
//
// Reshaping RESETS THE LADDER to `extraction`. A new ambient ground has
// begun, and the tightest posture deserves the first look at it — a
// widened extent is exactly the condition under which the material may
// now state something it could not before. The descents already made are
// kept, not erased: they are the record of how this ground was reached.
//
// Candidates carry across, and their standings are treated by WHY they
// hold: testimony stays testimony (an admitted filler is not un-admitted
// by the space growing), a candidate refused by the DECLARED ADMISSION
// organ stays refused (that judgment was never about the extent), and a
// candidate refused EXTENSIONALLY returns to `wish` — its refusal rested
// on the very extent just conceded, so keeping it refused would be
// standing on a ground the loop has already given up.

/**
 * The findings that say this space was declared wrong. Pure — computed
 * from the loop's own state, never from a model's opinion of it.
 *
 * Each finding names the CELL to revise (`field`), so a caller is told
 * which of the nine to re-declare rather than being handed "something is
 * off". Returns `[]` when nothing in the loop contradicts the space,
 * which is a real answer and not a failure to look.
 */
export function reshapeTriggers(loop) {
  if (loop?.schema !== "EOVoidLoop@1") return Object.freeze([]);
  const out = [];
  const extent = loop.declaration.extent ?? null;
  const testimony = loop.candidates.filter((c) => c.standing === "testimony");

  if (extent) {
    for (const c of testimony) {
      if (!c.span) continue;
      const over = c.span.to > extent.to;
      const under = c.span.from < extent.from;
      if (!over && !under) continue;
      // Wholly-outside candidates never reach testimony (admit refuses
      // them as arithmetic), so anything here overlaps AND runs past.
      out.push(Object.freeze({
        type: "extent_too_small",
        field: "extent",
        filler: c.value,
        witness: c.witness,
        detail:
          `«${c.value}» was admitted with extent ${c.span.from}-${c.span.to}, which runs past the declared ` +
          `${extent.from}-${extent.to} — the space accepted a filler it cannot contain`,
        suggested: Object.freeze({ from: Math.min(extent.from, c.span.from), to: Math.max(extent.to, c.span.to) }),
      }));
    }
  }

  // A candidate excluded by the EXTENT ALONE, while the space is still
  // short. Found by running this loop over real material: a narrowly
  // declared FDR term refused every VP that stated the relation, purely
  // for sitting outside it, and reported the space short in the same
  // breath — the space refusing the only things that could fill it.
  //
  // The disclosure is deliberately weaker than `extent_too_small`'s, and
  // the reason is an ordering cost worth naming rather than hiding:
  // `admit` refuses a wholly-outside span as ARITHMETIC, before the
  // declared admission organ is ever consulted. That is a real saving
  // (no fetch, no model call, for a candidate the numbers already
  // exclude) and it loses real information — a candidate excluded by a
  // WRONG extent never gets the check that would have shown the extent
  // was wrong. So this trigger says exactly what happened and no more:
  // these were excluded WITHOUT BEING READ, and the space is still open.
  const excluded = loop.candidates.filter((c) => c.standing === "refused" && c.refusedBy === "extensional" && c.span);
  if (extent && excluded.length && voidsOf(loop.space).standing === "incomplete") {
    out.push(Object.freeze({
      type: "extent_excludes",
      field: "extent",
      detail:
        `${excluded.length} candidate(s) — ${excluded.map((c) => `«${c.value}»`).join(", ")} — were excluded by the extent alone, ` +
        `without ever being read, and ${extent.from}-${extent.to} is still short: a space that refuses candidates and reports ` +
        `itself unfilled is evidence about the space, not about them`,
      excluded: Object.freeze(excluded.map((c) => c.value)),
      suggested: Object.freeze({
        from: Math.min(extent.from, ...excluded.map((c) => c.span.from)),
        to: Math.max(extent.to, ...excluded.map((c) => c.span.to)),
      }),
    }));
  }

  // The space reports itself complete while holding a filler it could not
  // place. Either the filler does not belong or the extent's own GRAIN is
  // too coarse to sit it anywhere — SEG's cell is "the extent to be
  // covered, AND ITS UNITS", and the units are the half that goes unread.
  // Deliberately carries NO `suggested`: this module can see that the grain
  // is wrong and cannot see what the right one would be, and inventing one
  // would be the manufactured precision the rest of this apparatus exists
  // to refuse. A caller gets the finding and the cell, not a guess.
  const coverageNow = voidsOf(loop.space);
  if (coverageNow.standing === "covered" && coverageNow.unplaced.length) {
    out.push(Object.freeze({
      type: "covered_but_unplaced",
      field: "extent",
      detail:
        `the extent reads covered, and ${coverageNow.unplaced.map((f) => `«${f}»`).join(", ")} cleared admission with no ` +
        `extent the material states — a space is not complete while it holds a filler it cannot place, so either the grain ` +
        `of ${extent ? `${extent.from}-${extent.to}` : "this extent"} is too coarse to sit it anywhere or it does not belong`,
      unplaced: Object.freeze([...coverageNow.unplaced]),
    }));
  }

  const cardinality = loop.choreography.propose.declared;
  if (Number.isFinite(cardinality) && testimony.length > cardinality) {
    out.push(Object.freeze({
      type: "cardinality_exceeded",
      field: "cardinality",
      detail:
        `the space declares ${cardinality} filler(s) and ${testimony.length} cleared admission — ` +
        `either the declaration undercounts the slot or the admission test is too loose`,
      admitted: Object.freeze(testimony.map((c) => c.value)),
      suggested: testimony.length,
    }));
  }

  const everProposed = loop.candidates.length;
  const anyHeld = testimony.length > 0;
  if (!currentRung(loop) && everProposed && !anyHeld) {
    out.push(Object.freeze({
      type: "admission_impassable",
      field: "admission",
      detail:
        `every rung of the ladder is spent and all ${everProposed} candidate(s) were refused — ` +
        `a test nothing can pass is a claim about the test, not about the candidates`,
      refused: Object.freeze(loop.candidates.map((c) => c.value)),
    }));
  }
  return Object.freeze(out);
}

/**
 * REC over the declaration: concede this space and stand up the revised
 * one, keeping everything the loop already earned.
 *
 * REFUSES a revision that changes nothing (`no_change`) — the same churn
 * refusal `build-log.js::reviseBuild` holds for identical code, and for
 * the same reason: an entry that would change no state is not a record of
 * anything, and a re-zero that concedes a ground identical to the one it
 * replaces is a loop that will run forever.
 */
export function reshape(loop, { grid, log, trigger, revised } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "reshape: expects an EOVoidLoop@1");
  if (loop.closed) return refuse("loop_closed", "reshape: this loop has already committed — a committed whole is superseded by a new loop, not edited");
  if (!isDeclaration(revised)) return refuse("not_a_declaration", "reshape: the revised space is an EOVoidDeclaration@1 — re-declare it, never patch a field");
  if (revised.standing === "under-specified") {
    return refuse("under_specified", undeclaredOf(revised), { undeclared: revised.undeclared });
  }
  if (typeof trigger !== "string" || !trigger.trim()) {
    return refuse("no_trigger", "reshape: a re-zero records its own reason verbatim — never a silent concession");
  }

  const sameCells = (a, b) =>
    a.cells.length === b.cells.length &&
    a.cells.every((c, i) => JSON.stringify(c.declared) === JSON.stringify(b.cells[i].declared));
  if (sameCells(loop.declaration, revised)) {
    return refuse("no_change", "reshape: the revised space declares exactly what the current one does — a re-zero onto an identical ground records nothing and would not terminate");
  }

  const triggerText = quoted(trigger);
  if (!triggerText.ok) return refuse("unquotable_trigger", triggerText.reason);
  const slotText = quoted(revised.slot ?? loop.declaration.slot);
  if (!slotText.ok) return refuse("unquotable_slot", slotText.reason);

  // `because "<trigger>"` is quoted so a trigger containing a clause
  // keyword ("...from the material", "...at Lens") cannot silently
  // fracture the line into another clause — grid.js's tokenizer never
  // reads a quoted token as a keyword.
  const line =
    `revise ${slotText.text} at ${loop.choreography.reopen.terrain} from closure ` +
    `because ${triggerText.text} supersedes ${loop.openingId}`;
  const landed = landLine(grid, log, line, loop.claimId);
  if (!landed.ok) return landed;

  const choreo = loopChoreography(revised);
  if (!choreo.ok) return choreo;

  // Rebuild the space from the revised declaration and re-admit every
  // filler that already cleared. Append-only: nothing earned is lost.
  let space = spaceFrom(revised);
  const carried = loop.candidates.map((c) => {
    if (c.standing === "refused" && c.refusedBy === "extensional") {
      return Object.freeze({ ...c, standing: "wish", verdict: null, because: null, refusedBy: null, evaluateId: null });
    }
    // Nothing settled it on the OLD ground; the new one gets to be asked.
    if (c.standing === "undetermined") {
      return Object.freeze({ ...c, standing: "wish", verdict: null, because: null, evaluateId: null });
    }
    return c;
  });
  for (const c of carried) {
    if (c.standing === "testimony") space = fill(space, { filler: c.value, span: c.span, source: c.witness });
  }

  return Object.freeze({
    ok: true,
    log: landed.log,
    id: landed.ids[0],
    line,
    reopened: Object.freeze(carried.filter((c, i) => c.standing === "wish" && loop.candidates[i].standing === "refused").map((c) => c.value)),
    loop: Object.freeze({
      ...loop,
      declaration: revised,
      choreography: choreo,
      space,
      candidates: Object.freeze(carried),
      rung: 0,
      openingId: landed.ids[0],
      reshapes: Object.freeze([...(loop.reshapes ?? []), Object.freeze({ trigger: trigger.trim(), id: landed.ids[0], from: loop.declaration.extent ?? null, to: revised.extent ?? null })]),
    }),
  });
}

// ── CURIOSITY: a gap the loop can name is a question it can ask ─────────
//
// User direction, 2026-08-27: "it should also research Johnson to
// understand it, it needs to be curious."
//
// The loop was honest and incurious. It admitted Andrew Johnson, could
// not place him, reported `unplaced`, and stopped — filing the gap
// instead of pursuing it. But the gap it filed is SPECIFIC: not "something
// is missing" but "I hold a filler and the source I read never says when."
// A gap that specific is a QUESTION, and a question is something to go and
// answer rather than something to disclose.
//
// Measured, which is why this exists at all: Andrew Johnson's Wikipedia
// SUMMARY carries no vice-presidential span, and his FULL page does — "in
// light of what happened on March 4, 1865", and, better, "sworn in
// alongside Hamlin (his predecessor as vice president)", which states the
// succession that partitions the extent outright. The loop stopped at the
// summary because the summary is all it thought to ask for.
//
// WHAT THIS FUNCTION IS AND IS NOT. It is pure and it fetches nothing: it
// turns the loop's own state into the questions that would settle it, each
// naming what changes if answered. Acting on them — a deeper read, a
// search, a second source — is the caller's, exactly as reading is. The
// loop knows what it needs to know; it does not know how to find out.
//
// `openQuestions` is already taken, by `fold.js`, for a different question
// (which facets of a TURN went unanswered). This is about what would
// settle a SPACE, so it gets its own name rather than overloading that one.

const relationName = (declaration) => {
  const c = declaration?.cells?.find((x) => x.op === "CON")?.declared;
  return (typeof c === "object" && c ? c.id ?? c.name : c) ?? "the relation";
};
const anchorName = (declaration) => declaration?.cells?.find((x) => x.op === "SIG")?.declared ?? declaration?.slot ?? "the anchor";

/**
 * What this loop would need to know, in the order that settles it fastest.
 *
 * Placing a filler already in hand comes before finding a new one: it is
 * one targeted read against a source already identified, and it can close
 * a space outright, where a search for another filler may find nothing.
 */
export function whatWouldSettle(loop) {
  if (loop?.schema !== "EOVoidLoop@1") return Object.freeze([]);
  const rel = relationName(loop.declaration);
  const anchor = anchorName(loop.declaration);
  const coverage = voidsOf(loop.space);
  const out = [];

  // 1. A filler admitted and unplaceable. The most decisive question the
  //    loop can ask, and the one it used to swallow.
  if (coverage.standing !== "unbounded") {
    for (const c of loop.candidates.filter((x) => x.standing === "testimony" && !x.span)) {
      out.push(Object.freeze({
        type: "place_filler",
        about: c.value,
        witness: c.witness,
        ask: `when did «${c.value}» hold «${rel}» under «${anchor}»?`,
        wouldSettle: `«${c.value}» cleared admission and nothing places it — the extent reads covered only by not counting it`,
        // The source that already said yes is the first place to look
        // harder, before looking anywhere else.
        lookFirst: Object.freeze([...(c.refs ?? []), c.witness].filter(Boolean)),
      }));
    }
  }

  // 2. A stretch nothing covers. A real question about the world, not
  //    about a candidate — and the one that needs a new filler.
  for (const v of coverage.voids ?? []) {
    out.push(Object.freeze({
      type: "fill_void",
      about: Object.freeze({ ...v }),
      ask: `who held «${rel}» under «${anchor}» between ${v.from} and ${v.to}${loop.declaration.dimension ? ` (${loop.declaration.dimension})` : ""}?`,
      wouldSettle: `${v.from}-${v.to} is filled by nothing named so far`,
      lookFirst: Object.freeze([]),
    }));
  }

  // 3. Evaluated and nothing settled it. Weakest, and last: a source that
  //    said nothing is the least promising place to ask again.
  for (const c of loop.candidates.filter((x) => x.standing === "undetermined")) {
    out.push(Object.freeze({
      type: "settle_undetermined",
      about: c.value,
      ask: `did «${c.value}» hold «${rel}» under «${anchor}»?`,
      wouldSettle: `«${c.value}» was read and nothing bound or refuted it`,
      lookFirst: Object.freeze([...(c.refs ?? [])]),
    }));
  }
  return Object.freeze(out);
}

/**
 * Fold an answered question back in. A deeper read that PLACES a filler
 * revises that filler's own reading — it does not propose a new candidate
 * and does not re-open the ladder, because nothing new was found: the same
 * filler is now placed.
 *
 * REFUSES a span the space cannot contain (`span_outside_extent`) rather
 * than silently widening the extent behind the caller's back. If the extent
 * is genuinely wrong, that is `reshape`'s act, with its own REC on the
 * record — never a side effect of answering a question.
 */
export function placeFiller(loop, { filler, span, source } = {}) {
  if (loop?.schema !== "EOVoidLoop@1") return refuse("not_a_loop", "placeFiller: expects an EOVoidLoop@1");
  if (loop.closed) return refuse("loop_closed", "placeFiller: this loop has already committed");
  const idx = loop.candidates.findIndex((c) => c.value === filler && c.standing === "testimony");
  if (idx < 0) return refuse("not_admitted", `placeFiller: «${filler}» is not an admitted filler on this loop — only something already through admission can be placed`);
  if (loop.candidates[idx].span) return refuse("already_placed", `placeFiller: «${filler}» already carries an extent`);
  if (!(Number.isFinite(span?.from) && Number.isFinite(span?.to) && span.from <= span.to)) {
    return refuse("no_span", "placeFiller: a placement is a closed interval {from, to} with from <= to");
  }
  const extent = loop.declaration.extent;
  if (extent && (span.to < extent.from || span.from > extent.to)) {
    return refuse("span_outside_extent", `placeFiller: ${span.from}-${span.to} lies wholly outside ${extent.from}-${extent.to} — if the extent is wrong, concede it with \`reshape\` rather than widening it by placing something outside it`);
  }
  const placed = Object.freeze({ ...loop.candidates[idx], span: Object.freeze({ ...span }), placedBy: source ?? null });
  const candidates = loop.candidates.map((c, i) => (i === idx ? placed : c));
  // The space is REBUILT, never appended to. `fill` is append-only by
  // design — "a filler is never overwritten by a later one that happens to
  // share its name", because two witnesses covering different extents is
  // the Lincoln case itself — so filling the placed copy on top of the
  // spanless one would leave BOTH, and `voidsOf` would go on reporting the
  // filler unplaced forever. Same rebuild `reshape` already does.
  let space = spaceFrom(loop.declaration);
  for (const c of candidates) {
    if (c.standing === "testimony") space = fill(space, { filler: c.value, span: c.span, source: c.witness });
  }
  return Object.freeze({ ok: true, loop: Object.freeze({ ...loop, candidates: Object.freeze(candidates), space }) });
}
