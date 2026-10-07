// tournament.js — the N-candidate selector `runCodeLoop` doesn't have.
//
// Lives in the kernel (pure selection machinery), not the-fold: the engine
// belongs to eoreader7, the surface to the-fold. Its only outward import
// is the patch primitive (kernel files already import the-fold-side
// physics — notes.js, reaction.js — so this follows standing precedent).
//
// The loop tries exactly one patch per round and keeps the first exit-0.
// A mechanical tier proposes several (remedy table, stub synthesis,
// widened anchors) for one failing test — this module tries each against
// a PRISTINE copy, scores `{ exit code, then minimal diff }`, and lands
// the winner with the losers recorded as refused trials (DEF-shaped, so
// the audit trail shows what was considered and why it lost).
//
// PURE: no fs, no model, no clock. The caller injects `test({ code,
// index }) -> { exitCode, output }` (execSync in production, a stub in
// tests) and bounds N (array length). Physics unchanged: `readOps` +
// `applyOps` decide applicability; the tester decides victory. A
// dirty-but-passing winner is still a winner here — witness cleanliness
// as tiebreak is named, unattempted future work (the loop's own
// exit-code-only verdict, kept).

import { readOps, applyOps } from "../the-fold/patch.js";

/**
 * runTournament({ code, candidates, test, rank }) ->
 * { winner: { candidate, op, code, exitCode, output, diffBytes } | null,
 *   trials: [{ index, ok, gap?, op?, exitCode?, output?, diffBytes?, rank? }] }
 *
 * `candidates` is [{ find, add }, ...] in caller priority order. Each is
 * applied to the pristine `code` (never chained — a loser leaves no
 * trace); inapplicable ones record their gap without testing. Among
 * exit-0 trials the smallest |diff| wins (first wins ties — caller order
 * is the priority vote). Null tester result ({exitCode} missing) is a
 * recorded gap, never a win.
 *
 * `rank(candidate, index) -> number` (optional): predictive ordering —
 * priors propose the trial order (higher first), tests dispose. Default
 * preserves caller order (stable). Rank changes which green is found
 * first under a future trial budget; the winner rule is unchanged.
 */
export function runTournament({ code, candidates, test, rank = null } = {}) {
  const trials = [];
  if (typeof code !== "string") {
    return { winner: null, trials, gap: { kind: "no-projection", reason: "there is no code to patch" } };
  }
  if (!Array.isArray(candidates) || !candidates.length) {
    return { winner: null, trials, gap: { kind: "malformed", reason: "a tournament needs a non-empty candidate list" } };
  }
  if (typeof test !== "function") {
    return { winner: null, trials, gap: { kind: "malformed", reason: "a tournament needs an injected test({ code, index })" } };
  }
  // Trial order: rank proposes (higher first), caller order breaks ties
  // (stable — without rank the behavior is byte-identical to before).
  // `index` below still names the candidate's ORIGINAL position, so the
  // audit trail reads in caller terms whatever order the trials ran.
  const order = candidates.map((c, i) => i);
  if (typeof rank === "function") {
    const score = new Map();
    for (const i of order) {
      let r = null;
      try { r = rank(candidates[i], i); } catch { r = null; }
      score.set(i, typeof r === "number" && Number.isFinite(r) ? r : null);
    }
    order.sort((a, b) => {
      const ra = score.get(a), rb = score.get(b);
      if (ra === null && rb === null) return a - b;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return rb - ra || a - b;
    });
  }
  for (const i of order) {
    const candidate = candidates[i];
    const ops = readOps([{ find: candidate?.find, add: candidate?.add }]);
    const applied = ops ? applyOps(code, ops) : { ok: false, gap: { kind: "malformed", reason: "find/add did not resolve to a real op" } };
    if (!applied.ok) {
      trials.push({ index: i, ok: false, gap: applied.gap });
      continue;
    }
    let result;
    try {
      result = test({ code: applied.code, index: i });
    } catch (err) {
      trials.push({ index: i, ok: false, gap: { kind: "test_threw", reason: String(err?.message ?? err) } });
      continue;
    }
    const exitCode = result && typeof result.exitCode === "number" ? result.exitCode : null;
    if (exitCode === null) {
      trials.push({ index: i, ok: false, gap: { kind: "test_no_verdict", reason: "the tester returned no numeric exitCode" } });
      continue;
    }
    trials.push({
      index: i,
      ok: true,
      op: ops[0].op,
      exitCode,
      output: typeof result.output === "string" ? result.output : "",
      diffBytes: Math.abs(applied.code.length - code.length),
      code: applied.code,
    });
  }
  const winners = trials.filter((t) => t.ok && t.exitCode === 0).sort((a, b) => a.diffBytes - b.diffBytes);
  if (!winners.length) return { winner: null, trials };
  const best = winners[0];
  return {
    winner: {
      candidate: candidates[best.index],
      op: best.op,
      code: best.code,
      exitCode: best.exitCode,
      output: best.output,
      diffBytes: best.diffBytes,
    },
    trials,
  };
}
