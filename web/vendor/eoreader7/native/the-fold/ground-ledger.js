// ground-ledger.js — the prequential firewall: retroactivity made
// unrepresentable, not merely discouraged.
//
// Chat framing this answers: felt-surprise ("the log seems less surprising
// now") is corrupt as a competency signal because content written ABOUT a
// past turn was conditioned on it — the measurement moved, nothing in the
// world compressed. The fix (Dawid's prequential principle) is a strict
// timing firewall: a turn's surprise may only be scored against the ground
// state that existed strictly BEFORE that turn arrived, and once scored, a
// turn's score is permanent — the ground moving later can never re-price it.
//
// Reused, not reinvented: this is the cast.js/priors-toggles.js/fold-log.js
// pattern (the engine module arrives as an argument, so the page loads it
// from /engine and the tests load it by relative path). Every entry goes
// through the engine's own `append` — vocabulary walls (kind, operator,
// basis, grain) are the engine's, never re-implemented here.
//
// A GROUND VERSION is a PROPOSE: task_id `ground:v<n>`, operator INS · Figure
// · produced-basis... no — DECLARED, because this ledger is landed by an
// external caller (the summary-refresh mechanism, or a replay script) via
// `append` directly, never by the log's own autopoietic `produce()` rule
// engine — the same reasoning wide-vs-narrow.mjs's `landSample` already
// used for exactly this distinction. Operator INS matches this repo's own
// corrected convention for PROPOSE (grid.js/fold-log.js's "delta carriage"
// amendment: "birth is Generate · Existence," not SEG — SEG stays the
// deletion primitive). Ground versions are never superseded or chained:
// each is its own independent task_id, because every past ground must stay
// queryable for prequential lookups, not just the live one.
//
// A SCORE is a RESULT attached to the ground version it was scored against
// — "a result attaches an answer to a task that already exists; stamping an
// operator on it would re-type the task," task-log.js's own produce()
// discipline, carried here rather than re-derived.
//
// THE FIREWALL, exactly two rules, both mechanical:
//   1. Ground versions must strictly advance in turnIndex — proposing a
//      version "as of" a turn at or before an existing version throws.
//   2. A turn_id may receive a score at most once, ever, on this ledger —
//      scoreTurn scans for a prior RESULT naming the same turn_id and
//      throws if found. Nothing else here prevents scoring a NEW turn
//      against an OLD ground version (that is the entire point of
//      prequential scoring); this refuses only the one move that launders
//      retroactivity — re-pricing a turn already on the books once the
//      ground has moved past it.
//
// What this file deliberately does NOT do: score anything. `score` and
// `nullScore` arrive as already-computed numbers — the null battery (NLL
// from logprobs, or cloze-accuracy against a shuffled ground) is separate,
// disclosed future work, same posture the wide-vs-narrow.mjs header takes
// toward its own permutation test.

export function makeGroundLedger(taskLog) {
  const { createTaskLog, append, ENTRY_KINDS, OPERATOR_BASIS, GRAIN_RANK } = taskLog;

  // Read from the engine's own rank table rather than restated — the name
  // has one source of truth (fold-log.js's own line, reused verbatim).
  const FIGURE = Object.keys(GRAIN_RANK).find((g) => GRAIN_RANK[g] === 1);

  const isGroundPropose = (e) =>
    e.kind === ENTRY_KINDS.PROPOSE && typeof e.task_id === "string" && e.task_id.startsWith("ground:v");

  function groundVersions(log) {
    return log.entries.filter(isGroundPropose);
  }

  /** The most recently frozen ground version — the one with the largest
   * turnIndex — or null if none has ever been proposed. */
  function latestGroundVersion(log) {
    const versions = groundVersions(log);
    if (!versions.length) return null;
    return versions.reduce((a, b) => (b.turnIndex > a.turnIndex ? b : a));
  }

  const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /**
   * Freeze a ground state as of `turnIndex`. Churn is refused (identical
   * summary to the current live version appends nothing — fold-log.js's own
   * discipline: "an entry that changes no state is churn"). turnIndex must
   * strictly exceed every prior version's turnIndex — this is rule 1 of the
   * firewall, and it is what makes "propose a ground as of a turn already
   * passed" unrepresentable rather than merely discouraged.
   */
  function proposeGroundVersion(log, { turnIndex, summary }) {
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      throw new TypeError("proposeGroundVersion: turnIndex must be a non-negative integer");
    }
    const cur = latestGroundVersion(log);
    if (cur && turnIndex <= cur.turnIndex) {
      throw new RangeError(
        `proposeGroundVersion: turnIndex ${turnIndex} does not strictly exceed the latest ground version's turnIndex ${cur.turnIndex} — a ground version cannot be frozen as of a turn already passed`,
      );
    }
    if (cur && deepEqual(cur.summary, summary)) return log; // churn: identical ground, nothing new to record
    const n = groundVersions(log).length + 1;
    return append(log, {
      kind: ENTRY_KINDS.PROPOSE,
      task_id: `ground:v${n}`,
      description: `ground version ${n}, frozen as of turn ${turnIndex}`,
      operator: "INS",
      operator_basis: OPERATOR_BASIS.DECLARED,
      grain: FIGURE,
      turnIndex,
      summary,
    });
  }

  /**
   * The ground version in force strictly BEFORE `turnIndex` — the
   * prequential lookup. Returns null (a caller-visible `no_ground` gap,
   * this repo's own established name for exactly this situation — grid.js's
   * `distinguish`/`void` refusal uses the identical term) when no version
   * was ever frozen before this turn.
   */
  function groundVersionAsOf(log, turnIndex) {
    const eligible = groundVersions(log).filter((v) => v.turnIndex < turnIndex);
    if (!eligible.length) return null;
    return eligible.reduce((a, b) => (b.turnIndex > a.turnIndex ? b : a));
  }

  /** Every RESULT entry on this ledger, in landing order — the raw material
   * for "has this ground ever earned forward bits." */
  function allScores(log) {
    return log.entries.filter((e) => e.kind === ENTRY_KINDS.RESULT).map((e) => e.result);
  }

  /**
   * Score one turn against the ground version in force before it arrived.
   * Refuses (throws) rather than silently re-pricing when `turnId` already
   * has a score anywhere on this ledger — rule 2 of the firewall. Refuses
   * (throws, typed) when no ground version was ever frozen before
   * `turnIndex` — there is nothing to score against yet, not a zero.
   */
  function scoreTurn(log, { turnId, turnIndex, score, nullScore }) {
    if (typeof turnId !== "string" || !turnId) {
      throw new TypeError("scoreTurn: turnId must be a non-empty string");
    }
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      throw new TypeError("scoreTurn: turnIndex must be a non-negative integer");
    }
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new TypeError("scoreTurn: score must be a finite number");
    }
    if (typeof nullScore !== "number" || !Number.isFinite(nullScore)) {
      throw new TypeError("scoreTurn: nullScore must be a finite number");
    }
    const already = allScores(log).some((r) => r.turn_id === turnId);
    if (already) {
      throw new RangeError(
        `scoreTurn: turn_id ${JSON.stringify(turnId)} already has a score on this ledger — retroactivity is refused, not just discouraged; a turn is scored against the ground it actually arrived under, once`,
      );
    }
    const ground = groundVersionAsOf(log, turnIndex);
    if (!ground) {
      const err = new RangeError(`scoreTurn: no ground version was frozen before turn ${turnIndex}`);
      err.gap = "no_ground";
      throw err;
    }
    return append(log, {
      kind: ENTRY_KINDS.RESULT,
      task_id: ground.task_id,
      result: {
        turn_id: turnId,
        turn_index: turnIndex,
        score,
        null_score: nullScore,
        ground_version: ground.task_id,
        ground_turn_index: ground.turnIndex,
      },
    });
  }

  /** Rebuild a log from its serialized entries alone — the resumption
   * property P3 already demands elsewhere (skills.js, fold-log.js), held
   * here too: a stored row that violates the vocabulary throws instead of
   * silently loading. */
  function replayEntries(entries) {
    let log = createTaskLog();
    for (const e of entries ?? []) log = append(log, e);
    return log;
  }

  return Object.freeze({
    proposeGroundVersion,
    groundVersionAsOf,
    scoreTurn,
    allScores,
    latestGroundVersion,
    groundVersions,
    replayEntries,
  });
}
