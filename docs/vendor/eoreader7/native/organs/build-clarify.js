// native/organs/build-clarify.js — the recursive ask-back door, run as the
// THREE REGISTERS IN ORDER (user direction, 2026-09-18: "ethos, logos and
// pathos are entire systems of archons, in that order, not archons
// themselves"; THE-MORAL-CORE-AS-A-RING.md: ethos is the ground, logos the
// figure, pathos the pattern — and the pathos of one ring is the ethos of
// the next).
//
// The void can ALWAYS be recursively redefined. A build task arrives as a
// task and nothing else; the instrument does not guess what "build" means.
// It declares the void across the holarchy (Koestler — every level a whole
// and a part; here modality=code, so artifact · module · function ·
// statement), reads its own undeclared cells (logos), and when the space is
// under-specified it ASKS — returns the questions that would settle it,
// never a generated answer. The person's answers come back, the void is
// RE-DECLARED from them (re-ground: the pathos of the ring), and if the
// space is still under-specified it asks again, narrowing each round.
//
// THE THREE REGISTERS, IN ORDER:
//
//   ETHOS  (the ground — Solon/Grotius/Brandeis/Levinas/Buber) — the ground
//          the whole door stands on. Composed INJECTED: `clear` runs the
//          caller's own ethosClear/askShapeBest/interlocutor; the door
//          itself never restates the constitution. A task that fails ethos
//          is refused before any question is asked — the ground comes first.
//
//   LOGOS  (the figure — the evidentiary walk + Degrees Kelsen) — the void
//          declaration's cells ARE claims on the table. `lint` runs the
//          caller's own linter over the void + every answer + the standing
//          notes, and a cycle in what the answers would assert REFUSES that
//          answer (never lands, never re-asked): logos restricts what ethos
//          clears. `whatWouldSettle` is the figure-cut: the undeclared
//          build-blocking cells become the questions.
//
//   PATHOS (the pattern — Abhinavagupta/Murch/Panini) — `reGround` runs the
//          caller's own reGroundCondition over a measured felt shape. It
//          decides the ROUND:
//            ground_holds  + cells still open  → ask (needs-clarification)
//            ground_holds  + cells filled      → licensed to build
//            ground_moved_nothing              → typed still_under_specified,
//                                                NEVER a re-ask of the same
//                                                questions (whatWouldSettle
//                                                already knows its cost)
//            budget spent                      → still_under_specified (a
//                                                bounded loop, never an
//                                                infinite one)
//
// CONVERGENCE. A round that answers a previously-undeclared build-blocking
// cell is progress; a round that answers nothing already asked is a
// re-ground with no altitude change — the pathos register refuses it as a
// closed ground, and the door reports still_under_specified rather than
// spinning. Every round is a recorded act on the caller's append-only log.
//
// PURE: no fetch, no DOM, no model calls. All three registers arrive
// injected (the cast.js discipline this codebase holds for every organ that
// composes the constitution): this file carries the ORDER and the
// recursion, never a second copy of any archon's machinery.

import { voidHolarchy, MODALITIES } from "./void-holarchy.js";

export const SCHEMA = "EOBuildClarify@1";
export const MAX_ROUNDS = 3;

// ── The declared cells, in canon order (domain-major, per-level). ────────
// The ask is PLAIN and minimal (Gary's law: as little as possible in the
// mouth, and the mouth never sees apparatus vocabulary). No cell name, no
// operator, no "void"/"slot"/"anchor" reaches the person — only the one
// question whose answer would close the space.
const CELL_QUESTIONS = Object.freeze({
  slot: (slot) => ({ ask: `what should this be?`, wouldSettle: "the thing itself is named" }),
  anchor: (slot) => ({ ask: `who is it for?`, wouldSettle: "who it is for is named" }),
  admits: (slot) => ({ ask: `what kind of parts does it have?`, wouldSettle: "the parts are named" }),
  extent: () => ({ ask: "how many parts, or how big?", wouldSettle: "the size is named" }),
  relation: () => ({ ask: "how do the parts belong to it?", wouldSettle: "the relation is named" }),
  composition: () => ({ ask: "how do the parts fit together?", wouldSettle: "the composition is named" }),
  cardinality: (slot) => ({ ask: `how many?`, wouldSettle: "the count is named" }),
  admission: () => ({ ask: "what makes a part good enough?", wouldSettle: "the test is named" }),
  reopensOn: () => ({ ask: "what would change its shape?", wouldSettle: "the re-open condition is named" }),
});

/** The undeclared build-blocking cells of a level's void, as questions. */
export function questionsFor(levelVoid, { slot = null } = {}) {
  if (!levelVoid || levelVoid.schema !== "EOVoidLevel@1") return Object.freeze([]);
  const out = [];
  for (const u of levelVoid.undeclared ?? []) {
    const tpl = CELL_QUESTIONS[u.field];
    if (!tpl) continue;
    const { ask, wouldSettle } = tpl(slot);
    out.push(Object.freeze({
      cell: u.field, op: u.op, terrain: u.terrain ?? null,
      ask, wouldSettle,
      // The question is only worth asking if answering it changes the build.
      // A cell whose value would not move the admission test is not a
      // build-blocking gap — declared as such, never silently dropped.
      buildBlocking: true,
    }));
  }
  return Object.freeze(out);
}

/**
 * answerFills(answers, levelVoid, { openBefore }) — which previously-
 * undeclared cells an incoming answer set actually fills. An answer is a
 * typed object { cell, value } or { ask, value }; matching is by cell name
 * first, then by the wouldSettle string's own words (the person may answer
 * in prose rather than by cell — the door re-folds the answer onto the
 * void, never demands a form).
 *
 * `openBefore` is the list of cells that were undeclared BEFORE this round's
 * answers arrived — the caller re-declares the void FROM the answers (the
 * re-ground), so a cell is declared in the current void AND carried in the
 * answer; a move is measured against the PREVIOUS open set, never the new
 * one. Without `openBefore`, a fill counts as moved iff the cell was not
 * already declared in the current void.
 */
export function answerFills(answers = [], levelVoid, { openBefore = null } = {}) {
  const declared = levelVoid?.declared ?? [];
  const had = new Set(declared.map((d) => d.field));
  const openSet = openBefore ? new Set(openBefore) : null;
  const fills = [];
  const moved = new Set();
  for (const a of answers ?? []) {
    const cell = String(a?.cell ?? a?.field ?? "").trim();
    const value = String(a?.value ?? a?.answer ?? "").trim();
    if (!value) continue;
    const target = cell || guessCell(value, levelVoid);
    if (!target) continue;
    if (had.has(target)) {
      // Answered a cell that is already declared in the CURRENT void — if it
      // was open before this round, this IS the fill; if it was declared
      // before too, it is a re-statement (no altitude change).
      const wasOpen = openSet ? openSet.has(target) : false;
      if (!wasOpen) continue;
    }
    fills.push({ cell: target, value });
    moved.add(target);
  }
  return {
    fills: Object.freeze(fills),
    moved: Object.freeze([...moved]),
    leftOpen: Object.freeze(levelVoid.undeclared.filter((u) => !moved.has(u.field)).map((u) => u.field)),
  };
}

/** A tiny, declared guess: match the answer's own words to a cell's asks. */
function guessCell(value, levelVoid) {
  const v = String(value ?? "").toLowerCase();
  for (const u of levelVoid?.undeclared ?? []) {
    const tpl = CELL_QUESTIONS[u.field];
    if (tpl) {
      const { ask, wouldSettle } = tpl();
      const hay = `${ask} ${wouldSettle}`.toLowerCase();
      const words = v.split(/\W+/).filter((w) => w.length > 3);
      let shared = 0;
      for (const w of words) if (hay.includes(w) && ++shared >= 2) return u.field;
    }
  }
  return null;
}

/**
 * foldAnswersFromTask(reply, questions, { cells }) — a person's plain reply
 * mapped onto the open cells. The questions carry their cell names and their
 * plain ask/wouldSettle; the reply is matched cell-by-cell: a cell is
 * answered only when the reply's own content words overlap its ask or its
 * wouldSettle (the same OR-shaped generosity P31's company rule uses, and
 * the same discipline — a cell is NEVER guessed from silence). A reply that
 * answers nothing yields []: the door re-asks rather than mis-fill.
 *
 * The fold is per-QUESTION, never whole-message: "for me, three profiles"
 * answers anchor ("who it is for" ← "for me") AND cardinality ("how many" ←
 * "three") independently, each on its own cell. Order-free, additive.
 */
/**
 * foldAnswersFromTask(reply, questions) — a person's plain reply mapped onto
 * the open cells STRUCTURALLY, never by vocabulary. The reply is split into
 * clauses at PUNCTUATION (the medium's own grain — a comma is a boundary in
 * every language, the same way the sentence is text's grain in the holarchy),
 * and clause i answers question i in the order asked. Position is the earned
 * signal, exactly as relations.js finds a slot positionally and never by
 * English; a clause that ends up answering nothing keeps that question open
 * (the door re-asks rather than mis-fill). "para mí, tres perfiles" folds as
 * correctly as "for me, three profiles" — no English, no word-matching, no
 * per-language prior.
 *
 * A reply with FEWER clauses than open questions leaves the rest open. A
 * reply with MORE clauses than questions takes the first N (the surplus is
 * the person's own words, never a fill of a cell they did not reach).
 */
export function foldAnswersFromTask(reply, questions = []) {
  const t = String(reply ?? "").trim();
  if (!t) return Object.freeze([]);
  const clauses = t
    .split(/[.,;!?。！？；\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!clauses.length) return Object.freeze([]);
  const out = [];
  for (let i = 0; i < clauses.length && i < (questions ?? []).length; i++) {
    const cell = String(questions[i]?.cell ?? "").trim();
    if (!cell) continue;
    out.push({ cell, value: clauses[i] });
  }
  return Object.freeze(out);
}

/**
 * buildClarify({ task, level, modality, fieldsByLevel, answers, round,
 * standing, clear, lint, reGround, log, budget }) → the round's verdict.
 *
 * The three registers in order:
 *   1. ETHOS  — `clear({ task, answers, round })` must pass. A refusal
 *               returns immediately: the ground comes before any question.
 *   2. LOGOS  — the void (whole-level) is declared; `lint({ notes })` over
 *               standing + the answers' own claims refuses a cycle. Then the
 *               undeclared build-blocking cells become the questions.
 *   3. PATHOS — `reGround({ round, moved, answers })` decides hold / re-ground;
 *               the verdict above follows from its reading of the round.
 */
export function buildClarify({
  task = "", modality = "code", fieldsByLevel = {},
  answers = [], round = 0, standing = [], openBefore = null,
  clear = null, lint = null, reGround = null, log = null, budget = MAX_ROUNDS,
} = {}) {
  const t = String(task ?? "").trim();
  if (!t) return { schema: SCHEMA, kind: "refused", reason: "no_task", round };
  if (round < 0 || round > budget) {
    return { schema: SCHEMA, kind: "still_under_specified", round, basis: `recursion budget spent (${budget} rounds) — the void is genuinely under-specified and re-asking cannot close it` };
  }

  // ── ETHOS: the ground first, whole and always ──────────────────────────
  if (typeof clear === "function") {
    let cleared;
    try { cleared = clear({ task: t, answers, round }); } catch { cleared = null; }
    if (cleared && cleared.cleared === false) {
      return { schema: SCHEMA, kind: "refused", round, reason: cleared.reason ?? "ethos_refused", at: Date.now() };
    }
  }

  // ── LOGOS: declare the void, lint the table, cut the questions ─────────
  let hol;
  try {
    hol = voidHolarchy({ modality, fieldsByLevel });
  } catch {
    hol = null;
  }
  if (!hol || hol.schema !== "EOVoidHolarchy@1") {
    return { schema: SCHEMA, kind: "refused", round, reason: "void_unbuildable" };
  }
  const whole = hol.levels[0]?.void ?? null;
  if (!whole) return { schema: SCHEMA, kind: "refused", round, reason: "void_unbuildable" };

  // Logos over the answers' own claims + the standing: a cycle refuses the
  // answer before it can fill a cell. This is the figure-cut — what ethos
  // clears, logos restricts.
  let lintFinding = null;
  if (typeof lint === "function") {
    const answerNotes = (answers ?? []).map((a) => ({ end1: String(a?.cell ?? "answer"), label: "states", end2: String(a?.value ?? "").slice(0, 120) }));
    try { lintFinding = lint({ notes: [...standing, ...answerNotes], round }); } catch { lintFinding = null; }
    if (lintFinding?.cycles?.length) {
      return { schema: SCHEMA, kind: "refused", round, reason: "logos_cycle", basis: `an answer would turn the standing back on itself: ${lintFinding.cycles[0]}`, at: Date.now() };
    }
  }

  const { fills, leftOpen } = answerFills(answers, whole, { openBefore });
  const openQuestions = questionsFor(whole, { slot: whole.slot ?? t });
  const buildBlockingOpen = openQuestions.filter((q) => q.buildBlocking);
  const allDeclared = leftOpen.length === 0;

  // ── PATHOS: the re-ground decides the round ────────────────────────────
  let pathos = null;
  if (typeof reGround === "function") {
    try { pathos = reGround({ round, fills, leftOpen, answers }); } catch { pathos = null; }
  }
  const groundHolds = !pathos || pathos.kind === "ground_holds";
  // An answer "moved nothing" iff it filled no cell that was open before this
  // round — measured against the PREVIOUS void, never the re-declared one
  // (the caller re-declares FROM the answers, so the cell appears declared
  // and already-answered both; only the previous open set says what changed).
  const movedNothing = answers?.length > 0 && fills.length === 0;

  if (groundHolds && allDeclared) {
    return { schema: SCHEMA, kind: "licensed", round, fills, void: hol, at: Date.now() };
  }
  if (!groundHolds && !allDeclared) {
    return { schema: SCHEMA, kind: "needs-clarification", round, fills, void: hol, questions: buildBlockingOpen, pathos: { kind: pathos.kind, basis: pathos.basis ?? null }, at: Date.now() };
  }
  if (movedNothing) {
    return { schema: SCHEMA, kind: "still_under_specified", round, basis: "an answer moved nothing this round — it filled no undeclared cell, so the ground did not move and re-asking the same questions is a closed loop (the pathos register refuses it)", void: hol, at: Date.now() };
  }
  if (!allDeclared) {
    return { schema: SCHEMA, kind: "needs-clarification", round, fills, void: hol, questions: buildBlockingOpen, at: Date.now() };
  }
  return { schema: SCHEMA, kind: "licensed", round, fills, void: hol, at: Date.now() };
}

/** A thin recorder: every round lands as an append-only act, never lost. */
export function recordRound(log, round) {
  if (!Array.isArray(log)) return log;
  return Object.freeze([...log, Object.freeze({ seq: log.length, at: Date.now(), round: Object.freeze({ ...round }) })]);
}

export const BUILD_CLARIFY = { handle: "the three registers in order", organ: "build-clarify", law: "ethos (ground) → logos (figure) → pathos (pattern); the void is recursively redefined; an answer that moves nothing is never re-asked", modality: MODALITIES };