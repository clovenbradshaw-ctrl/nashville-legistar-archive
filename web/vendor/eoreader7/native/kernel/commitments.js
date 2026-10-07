// commitments.js — the reader's DECLARED, DEFEASIBLE commitments about how
// to read what it heard. The Interpretation layer over the notes ledger.
// Medium-blind.
//
// WHAT WAS MISSING. `notes.js` records what a reading HEARD: INS births an
// arrangement, SYN corroborates it. Existence and Structure, and nothing
// else. It has no vocabulary at all for how the reading was READ — and two
// of those judgments are load-bearing:
//
//   SAMENESS   — "The Russian army withdraws" and "Imperial Russian forces
//                retreated" are one proposition. The ledger's key is the
//                exact words, so they are two notes forever, and
//                `corroborated` therefore means VERBATIM AGREEMENT while
//                promising propositional agreement.
//   SIGNIFICANCE — what is furniture, what is noise, what matters. Decided
//                today at EXTRACTION (`blankFurniture`), silently and
//                irreversibly: the note never exists, so a wrong call
//                cannot be found or taken back. S51 discloses the live
//                risk — a navbox row and a line of screenplay dialogue are
//                the same shape, and only one of them is furniture.
//
// NEITHER IS A FACT IN THE BYTES. Sameness-of-meaning carries a TOLERANCE
// (tense, connotation, granularity — "withdraws" is not "retreated", a
// reader decides those differences do not matter HERE), and a tolerance is
// always FOR something. Significance is the same: nothing is insignificant
// simpliciter, only insignificant for a purpose. Both are Interpretation —
// the reader's own commitments, which is why no amount of further reading
// produces them and why every mechanical attempt to derive one has
// measured flat (lemma folding: 0 joins; distributional company: refuted,
// `saw`/`wrote` beat `looked`/`gazed`).
//
// SO THEY GET INTERPRETATION'S OWN TRIAD, and one mechanism serves both —
// a new cross-cutting judgment is a reason to widen a carrier, not to
// build a second one (P39's own deleted `landCell` is the precedent):
//
//   DEF — DECLARE the commitment. A giver is required (a commitment with
//         no one behind it is not defeasible, it is just a default) and a
//         PURPOSE is required (the tolerance is meaningless without the
//         thing it is a tolerance for). Per grid.js's standing rule, DEF
//         lands with no companion EVA — so a fresh commitment stands as a
//         WISH, never as fact.
//   EVA — TEST it. Not "does the world agree", which is the category error:
//         a corpus cannot contain the fact that two phrasings mean one
//         thing. What a corpus CAN do is refuse — the grain theorem's
//         usable half. So EVA asks whether committing to this does any
//         WORK, against a redealt commitment of the same shape (II.23):
//           same-as        -> does folding these lift corroboration more
//                             than folding a random same-size set?
//           does-not-matter-> ABLATION. Declaring something insignificant
//                             PREDICTS that removing it changes nothing.
//                             If removing it moves standings more than
//                             removing a random same-size set would, the
//                             declaration is refuted. Bateson's criterion,
//                             made testable, aimed at the reader's own
//                             attention rather than at the material.
//   REC — CONCEDE it, and what was read under it is read without it again.
//
// ONE LEDGER, NOT TWO. These acts land on the SAME log the hearings do.
// `notes.js` already lands four operators — INS (a hearing is born), SYN
// (a hearing is seconded), REC (`concede`), and DEF (the frame, "what this
// reader stands on") — so the log has never been a ledger of notes; it is
// a ledger of ACTS, and a note is the most common product of one. The
// frame is the standing proof: it lives in the log and never enters
// `fold()`, because `fold` requires two ends and a label.
//
// A second log was the first instinct here (bridges.js's precedent) and it
// was wrong. That precedent is about WHAT fold() SURFACES — a projection
// question, not a storage one. Splitting the stream costs three things
// that matter: seq-not-clock ordering between a hearing and the commitment
// that reads it (two logs make "as of" a reconciliation problem);
// `checkCubeProgression`, which runs over one log's own lineage and cannot
// check a chain split across two; and store.js's founding invariant —
// one event stream, the current state always projected. Two streams is two
// truths.
//
// THE WALL IS THEREFORE A TESTED PROPERTY, NOT A FILING CONVENTION: A
// COMMITMENT NEVER EDITS A NOTE AND NEVER APPEARS AS ONE. It carries no
// ends, so `fold()` cannot surface it; it carries a giver rather than
// witnesses, so `standingOf` cannot count it. The heard record stays
// byte-identical and stays readable with no commitments applied at all —
// which is what makes a wrong significance call recoverable where
// `blankFurniture` made it permanent. `commitments.test.js` pins both.
//
// AND A STANDING READ UNDER COMMITMENTS SAYS SO. `readUnder` marks every
// note it touched with what it was read under, because a `corroborated`
// that quietly rests on three declared equivalences — one of them still a
// wish — reintroduces exactly the honesty bug this module exists to fix.
// `standingOf`'s own `assumedBridges` is the precedent.
//
// NOTHING NAMED. This file's executable body names no medium: no sentence,
// word, verb, bar, frame, pixel. `commitments.test.js` reads this source
// and fails if one appears.

import * as nativeTaskLog from "./task-log.js";
import { cellOf as nativeCellOf } from "./cube.js";
import { lcg, shuffled } from "./continuation.js";

/** The closed vocabulary of what a reader may commit to. Two verbs, one mechanism. */
export const KINDS = Object.freeze({
  /** these members are ONE — read them folded together */
  SAME_AS: "same-as",
  /** these members do not bear on this purpose — read them withheld */
  DOES_NOT_MATTER: "does-not-matter",
  /** these members bear on this purpose — read them kept, whatever else would withhold them */
  MATTERS: "matters",
});

/** Why a commitment was refused at the door — before it can stand as even a wish. */
export const REFUSALS = Object.freeze({
  /** no giver: a commitment nobody is behind is a default wearing a declaration's clothes */
  NO_GIVER: "no_giver",
  /** no purpose: a tolerance is always a tolerance FOR something, and significance is never simpliciter */
  NO_PURPOSE: "no_purpose",
  /** fewer members than the kind can act on (same-as needs two to fold) */
  TOO_FEW_MEMBERS: "too_few_members",
  /** not one of the declared kinds */
  UNKNOWN_KIND: "unknown_kind",
});

/** What a declared commitment currently stands as. */
export const STANDINGS = Object.freeze({
  /** declared, not yet evaluated — grid.js's own word for a define with no companion evaluate */
  WISH: "wish",
  /** evaluated and it held */
  TESTIMONY: "testimony",
  /** evaluated and it did no work, or introduced incoherence */
  REFUSED: "refused",
  /** taken back by its own REC */
  CONCEDED: "conceded",
});

const norm = (v) => String(v ?? "").trim();
const memberKey = (members) => [...new Set((members ?? []).map(norm).filter(Boolean))].sort().map((m) => `${m.length}:${m}`).join("");

/**
 * makeCommitments({ taskLog, cellOf }) — the ledger of declared readings,
 * over an injected task-log (default: this kernel's own), so a caller
 * already holding a provider of the algebra keeps its commitments beside
 * its notes rather than in a second world.
 */
export function makeCommitments({ taskLog = nativeTaskLog, cellOf = nativeCellOf } = {}) {
  const { createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS } = taskLog;
  const grains = taskLog.GRAIN_RANK
    ? Object.keys(taskLog.GRAIN_RANK).sort((a, b) => taskLog.GRAIN_RANK[a] - taskLog.GRAIN_RANK[b])
    : [...taskLog.GRAINS];
  const [GROUND, FIGURE, PATTERN] = grains;

  const cellFields = (op, grain) => {
    if (!cellOf) return {};
    const c = cellOf(op, grain);
    if (!c || c.gap) return { cell_gap: c?.gap ?? "no_cell", cell_reason: c?.reason ?? null };
    return { cell: `${c.op}·${c.grain}`, stance: c.stance, terrain: c.terrain, mode: c.mode, domain: c.domain };
  };

  /**
   * declare(log, { kind, members, giver, purpose, grain, because }) — DEF.
   * The commitment lands as a WISH: putting a reading forward is not
   * checking it (grid.js's own documented exception, the one verb that
   * needs no companion evaluate at declaration time).
   *
   * `grain` is the caller's, declared not derived: a commitment about THESE
   * members is Figure (a Lens); one about a shape or class is Pattern (a
   * Paradigm). The cell is stamped from (DEF, grain) by the real cube, so
   * a Figure commitment reads terrain Lens and a Pattern one Paradigm
   * without this file restating either table.
   */
  function declare(log, { kind, members, giver, purpose, grain = FIGURE, because = null } = {}) {
    if (!Object.values(KINDS).includes(kind)) return { log, refused: { type: REFUSALS.UNKNOWN_KIND, detail: `not a declared kind: ${JSON.stringify(kind)}`, known: Object.values(KINDS) } };
    if (!norm(giver)) return { log, refused: { type: REFUSALS.NO_GIVER, detail: "a commitment names who is behind it — one that does not is a default, not a defeasible reading" } };
    if (!norm(purpose)) return { log, refused: { type: REFUSALS.NO_PURPOSE, detail: "a tolerance is a tolerance FOR something; nothing is insignificant simpliciter" } };
    const ms = [...new Set((members ?? []).map(norm).filter(Boolean))].sort();
    const floor = kind === KINDS.SAME_AS ? 2 : 1;
    if (ms.length < floor) return { log, refused: { type: REFUSALS.TOO_FEW_MEMBERS, detail: `${kind} acts on at least ${floor} member(s), got ${ms.length}` } };
    const id = `commit:${kind}:${memberKey(ms)}`;
    const next = append(log, {
      kind: ENTRY_KINDS.PROPOSE, task_id: id, operator: "DEF", operator_basis: OPERATOR_BASIS.DECLARED, grain,
      ...cellFields("DEF", grain),
      description: `declared: ${kind} over ${ms.length} member(s)`,
      commitment: kind, members: ms, giver: norm(giver), purpose: norm(purpose),
      ...(because != null ? { because } : {}),
    });
    return { log: next, refused: null, id };
  }

  /**
   * evaluate(log, id, { verdict, ground, broken, because, evidence }) — EVA.
   * A ground and the perturbation it was broken against are REQUIRED, the
   * same rule grid.js's own `evaluate` holds: a verdict with no named null
   * is an opinion wearing a measurement's clothes. `verdict` is "holds" or
   * "refused"; `evidence` is the caller's own numbers, carried opaque.
   */
  function evaluate(log, id, { verdict, ground, broken, because = null, evidence = null } = {}) {
    if (verdict !== "holds" && verdict !== "refused") return { log, refused: { type: "unknown_verdict", detail: 'a commitment evaluates to "holds" or "refused"' } };
    if (!norm(ground) || !norm(broken)) return { log, refused: { type: "no_ground", detail: "evaluate names the ground it read and the perturbation it broke that ground against" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    if (!prior) return { log, refused: { type: "unknown_commitment", detail: "nothing stands to evaluate", id } };
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: id, operator: "EVA", operator_basis: OPERATOR_BASIS.PRODUCED, grain: prior.grain ?? FIGURE,
      ...cellFields("EVA", prior.grain ?? FIGURE),
      description: `evaluated: ${verdict}`,
      verdict, ground: norm(ground), broken: norm(broken),
      ...(evidence != null ? { evidence } : {}),
      ...(because != null ? { because } : {}),
    });
    return { log: next, refused: null };
  }

  /**
   * concede(log, id, { trigger }) — REC. The reader takes a reading back.
   * Nothing is deleted; the projection stops applying it, and every note it
   * folded or withheld is read as it was heard again. The trigger is
   * recorded VERBATIM — never a silent concession.
   */
  function concede(log, id, { trigger } = {}) {
    if (typeof trigger !== "string" || !trigger.trim()) return { log, refused: { type: "no_trigger", detail: "a re-zero records its own reason" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    if (!prior) return { log, refused: { type: "unknown_commitment", detail: "nothing stands to concede", id } };
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: `rec:${log.nextSeq}`, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: prior.grain ?? FIGURE,
      ...cellFields("REC", prior.grain ?? FIGURE),
      description: `re-zero: ${trigger}`,
      concedes: id, trigger,
    });
    return { log: next, refused: null };
  }

  const concededIds = (log) => new Set((log?.entries ?? []).filter((e) => e?.operator === "REC" && e.concedes).map((e) => e.concedes));

  /** The latest EVA verdict per commitment id. */
  function verdicts(log) {
    const out = new Map();
    for (const e of log?.entries ?? []) if (e?.operator === "EVA" && e.verdict) out.set(e.task_id, e);
    return out;
  }

  /**
   * standings(log) — every declared commitment with what it currently
   * stands as. A wish is DISCLOSED, never quietly treated as either fact
   * or noise: it is a reading somebody put forward and nobody has tested.
   */
  function standings(log) {
    const gone = concededIds(log);
    const evals = verdicts(log);
    return projectTasks(log)
      .filter((t) => t.commitment)
      .map((t) => {
        const ev = evals.get(t.task_id) ?? null;
        const standing = gone.has(t.task_id)
          ? STANDINGS.CONCEDED
          : !ev
            ? STANDINGS.WISH
            : ev.verdict === "holds"
              ? STANDINGS.TESTIMONY
              : STANDINGS.REFUSED;
        return { id: t.task_id, kind: t.commitment, members: t.members ?? [], giver: t.giver, purpose: t.purpose, grain: t.grain, standing, evaluated: ev ? { verdict: ev.verdict, ground: ev.ground, broken: ev.broken, evidence: ev.evidence ?? null } : null };
      });
  }

  /**
   * inForce(log, { include }) — the commitments a projection should apply.
   * By default TESTIMONY only: a wish has not earned the right to change
   * what a reader sees. `include: ["wish"]` is the disclosed way to read
   * under untested commitments — useful for measuring what one WOULD do,
   * which is exactly what `evaluate` needs, and never the default.
   */
  const inForce = (log, { include = [STANDINGS.TESTIMONY] } = {}) => standings(log).filter((c) => include.includes(c.standing));

  /**
   * classesOf(commitments) — the equivalence classes the standing
   * `same-as` commitments induce, by union-find. Transitive by
   * construction: A~B and B~C put A, B and C in one class, which is what
   * makes a contradiction introduced three commitments away findable at
   * all.
   */
  function classesOf(commitments) {
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => { for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x); const [ra, rb] = [find(a), find(b)]; if (ra !== rb) parent.set(ra, rb); };
    for (const c of commitments) if (c.kind === KINDS.SAME_AS) for (let i = 1; i < c.members.length; i += 1) union(c.members[0], c.members[i]);
    const byRoot = new Map();
    for (const m of parent.keys()) { const r = find(m); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(m); }
    return [...byRoot.values()].map((ms) => ms.sort());
  }

  /**
   * readUnder(log, notes, { include }) — THE PROJECTION, and
   * the only place commitments touch a reading. Returns the notes as read:
   * `same-as` members folded into one (witnesses and spans UNIONED, the
   * same rule `hear` uses when one source seconds another), and
   * `does-not-matter` members withheld unless a `matters` commitment keeps
   * them. Every note that a commitment touched carries `under` — the ids
   * that produced it — so a standing computed from this can never look
   * like one computed from the bytes alone.
   *
   * `notes` is the notes-module instance, injected: this file holds no fold
   * of its own and never reaches into the note ledger's shape.
   */
  function readUnder(log, notes, { include = [STANDINGS.TESTIMONY] } = {}) {
    const live = inForce(log, { include });
    const heard = notes.fold(log);
    const classes = classesOf(live);
    const classOf = new Map();
    for (const ms of classes) for (const m of ms) classOf.set(m, ms[0]);

    const withheld = new Set();
    const kept = new Set();
    for (const c of live) {
      if (c.kind === KINDS.DOES_NOT_MATTER) for (const m of c.members) withheld.add(m);
      if (c.kind === KINDS.MATTERS) for (const m of c.members) kept.add(m);
    }
    const underOf = new Map();
    const noteUnder = (id, commitId) => { if (!underOf.has(id)) underOf.set(id, new Set()); underOf.get(id).add(commitId); };
    for (const c of live) for (const m of c.members) noteUnder(m, c.id);

    const folded = new Map();
    const out = [];
    const dropped = [];
    for (const n of heard) {
      if (withheld.has(n.id) && !kept.has(n.id)) { dropped.push({ id: n.id, under: [...(underOf.get(n.id) ?? [])] }); continue; }
      const root = classOf.get(n.id) ?? null;
      if (root == null) { out.push(underOf.has(n.id) ? { ...n, under: [...underOf.get(n.id)] } : n); continue; }
      const prior = folded.get(root);
      if (!prior) {
        const seed = { ...n, id: root, witnesses: [...(n.witnesses ?? [])], spans: [...(n.spans ?? [])], folds: [n.id], under: [...(underOf.get(n.id) ?? [])] };
        folded.set(root, seed);
        out.push(seed);
        continue;
      }
      // fold: the FIRST member's face is kept as the display (hear()'s own
      // rule — evidence accumulates beneath a face without the words
      // drifting), witnesses and spans unioned.
      prior.witnesses = [...new Set([...prior.witnesses, ...(n.witnesses ?? [])])];
      const at = new Set(prior.spans.map((s) => s.at));
      for (const s of n.spans ?? []) if (!at.has(s.at)) { at.add(s.at); prior.spans.push(s); }
      prior.folds.push(n.id);
      prior.under = [...new Set([...prior.under, ...(underOf.get(n.id) ?? [])])];
    }
    return { notes: out, dropped, classes, applied: live.map((c) => ({ id: c.id, kind: c.kind, standing: c.standing })) };
  }

  /**
   * redeal(commitLog, universe, { seed, include }) — THE CONTROL BUILT TO
   * FAIL (II.23). Every standing commitment is re-declared over RANDOM
   * members drawn from the same universe, keeping its kind and its size.
   * Reading under the redeal and comparing is what turns "this commitment
   * changed the reading" into "this commitment changed the reading MORE
   * THAN ANY COMMITMENT OF ITS SHAPE WOULD HAVE" — which is the only form
   * of the question a corpus can answer, since it cannot contain the fact
   * that two phrasings mean one thing but can certainly show that folding
   * them did no work.
   */
  function redeal(commitLog, universe, { seed = 0, include = [STANDINGS.TESTIMONY] } = {}) {
    const pool = [...new Set((universe ?? []).map(norm).filter(Boolean))];
    const rng = lcg(seed);
    // A SCRATCH log, never the real one: an experiment run to learn whether
    // a commitment does work must not itself become part of the record
    // (interact.js's own rule — what is learned lands, what was tried to
    // learn it does not).
    let log = createTaskLog();
    for (const c of inForce(commitLog, { include })) {
      const drawn = shuffled(pool, rng).slice(0, c.members.length);
      if (drawn.length < (c.kind === KINDS.SAME_AS ? 2 : 1)) continue;
      const r = declare(log, { kind: c.kind, members: drawn, giver: `redeal:${c.giver}`, purpose: `control for ${c.id}`, grain: c.grain });
      if (r.refused) continue;
      log = r.log;
      const e = evaluate(log, r.id, { verdict: "holds", ground: "redeal", broken: "membership" });
      if (!e.refused) log = e.log;
    }
    return log;
  }

  return { declare, evaluate, concede, standings, inForce, classesOf, readUnder, redeal, KINDS, STANDINGS, REFUSALS };
}
