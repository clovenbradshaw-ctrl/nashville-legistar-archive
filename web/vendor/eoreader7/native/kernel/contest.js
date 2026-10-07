// native/kernel/contest.js — CO-PRESENCE IS EVIDENCE, NEVER AN ANSWER.
// Handle: Tungara — after the túngara frog, whose call grows more complex only when a competing male is in the frame, raising the margin a rival must clear. Amendment XVII.
// Medium-general, kernel-level. No notion of text, sentence, name or pronoun
// appears below; the only inputs are scored candidates and the set of
// candidates the CURRENT FRAME carries alongside the deixis being resolved.
//
// WHY THIS EXISTS. `adapters/text/pronouns.js` refused, categorically, any
// frame that carried a named surface: `if (named.size === 0 && ...)`. That
// veto is text-shaped twice over — it names "a named surface," and it treats
// co-presence as disqualifying rather than as a difference to be weighed.
// Measured consequence on encyclopedic prose (Battle of Borodino, 305
// sentences): 113 frames carry a third-person singular pronoun, 99 of them
// also carry a name, so 88% of the material was refused before any recall
// ran, and the reported rung read `{ran: true, bindings: 0, gaps: 6}` — six
// gaps standing in for a hundred and thirteen chances. A count that hides
// its own denominator is the failure P38 is named for, one layer up.
//
// WHAT REPLACES IT. The organ already owns a machine for "two candidates I
// cannot separate": the margin. So co-presence stops being a gate and
// becomes a STANDING — a frame that carries competitors must clear a
// STRICTER margin than one that does not, because the frame itself supplies
// a pull the recall cannot see. The veto's judgement is preserved (a
// contested frame is genuinely harder) without its blindness (a contested
// frame is not therefore unreadable).
//
// CO-PRESENCE NEVER SCORES. A co-present candidate enters at its own recall
// value and nothing else. Adding a bonus for being in the frame would be
// nearest-name binding, which pronouns.js's own header refuses by name, and
// which this file must not smuggle back in through the kernel. Co-presence
// raises the BAR; it never raises a SCORE. That asymmetry is the whole
// design.
//
// WHY IT IS MEDIUM-GENERAL. "Which of the beings present did this
// unlabelled thing point at" is not a text question. A shot with two faces
// and one unlabelled gaze; a bar with two instruments and one unattributed
// motif; a turn with two labelled speakers and one bare "same as before" —
// each is a scored-candidate set plus a co-present set. Each may call this
// function unchanged. The adapter contributes the scores and the frame
// membership; the kernel contributes the verdict.
//
// NOTHING IS DEFAULTED. `minActivation`, `minMargin` and `contestedMargin`
// are all declared by the caller, on the same terms activation.js's
// `window` and pronouns.js's own two bars already hold: how much echo counts
// as real, and how far a winner must lead, are properties of the reading,
// never constants this file assumes for every medium.

// `lcg` used to be defined here, independently of entity-kind-induction.js's
// own private seeded generator — one need (a seeded null-distribution draw)
// met twice in two files that never searched for each other. Now shared;
// see kernel/rng.js's header for why the two generators stay separate.
import { lcg } from "./rng.js";

/** Verdict kinds. A gap is a result; each one names why. */
export const CONTEST_VERDICTS = Object.freeze({
  BOUND: "bound",
  NO_CANDIDATE: "no_candidate",
  BELOW_FLOOR: "below_floor",
  NO_MARGIN: "no_margin",
  CONTESTED_NO_MARGIN: "contested_no_margin",
  NULL_NOT_CLEARED: "null_not_cleared",
});

/**
 * Adjudicate one deixis against scored candidates, weighing frame co-presence
 * as a raised bar rather than a veto or a bonus.
 *
 * @param {object} args
 * @param {Map<string,number>|Array<[string,number]>} args.scores candidate id
 *   -> its own recall/activation. Supplied whole by the adapter; this file
 *   computes no scores and knows nothing about how they were earned.
 * @param {Iterable<string>} [args.coPresent] candidate ids the CURRENT frame
 *   carries alongside the deixis. Membership only — never a score.
 * @param {number} args.minActivation declared floor the top candidate must
 *   clear. Never defaulted.
 * @param {number} args.minMargin declared lead over the runner-up, as a
 *   fraction of the top score, for an UNCONTESTED frame. Never defaulted.
 * @param {number} args.contestedMargin declared lead required instead when
 *   the frame carries co-present competitors. Never defaulted. Must be at
 *   least minMargin — a contested frame is never the easier case, and a
 *   caller asking for that has mis-declared, not discovered a shortcut.
 * @param {(id: string) => boolean} [args.admissible] hard filter applied
 *   before ranking (gender, individuation type, anything the CALLER types).
 *   A filter, never a tiebreak — the same standing pronouns.js already gives
 *   gender and `nonPersonal`.
 * @returns {{verdict: string, id: string|null, score: number|null,
 *   margin: number|null, runnerUp: string|null, contested: string[],
 *   barApplied: number|null, detail: string}}
 */
export function adjudicate({
  scores,
  coPresent,
  minActivation,
  minMargin,
  contestedMargin,
  admissible,
} = {}) {
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("adjudicate: minActivation is declared — how much echo counts as real is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1)
    throw new TypeError("adjudicate: minMargin is declared — how far a winner must lead is never a default");
  if (!Number.isFinite(contestedMargin) || contestedMargin < 0 || contestedMargin > 1)
    throw new TypeError("adjudicate: contestedMargin is declared — what a contested frame costs is never a default");
  if (contestedMargin < minMargin)
    throw new RangeError("adjudicate: contestedMargin < minMargin — a frame carrying competitors is never the easier case; declare it as at least minMargin");

  const table = scores instanceof Map ? scores : new Map(scores ?? []);
  const present = coPresent instanceof Set ? coPresent : new Set(coPresent ?? []);
  const keep = typeof admissible === "function" ? admissible : () => true;

  // Co-presence contributes MEMBERSHIP, never magnitude: a co-present
  // candidate that the reading has not activated stays at its own zero and
  // loses, exactly as it would if the frame had not carried it.
  const ranked = [...table.entries()]
    .filter(([id]) => keep(id))
    .sort((a, b) => b[1] - a[1]);

  // Contest is measured over the ADMISSIBLE candidates only. A co-present
  // competitor the caller's own hard filter already excluded (wrong gender,
  // not a person, not the kind of thing this deixis could point at) is not
  // a competitor — raising the bar for it would charge the reading for an
  // ambiguity it does not actually face.
  const contested = [...present].filter((id) => keep(id));
  const bar = contested.length > 0 ? contestedMargin : minMargin;

  const base = { contested, barApplied: bar };

  if (ranked.length === 0) {
    return {
      ...base,
      verdict: CONTEST_VERDICTS.NO_CANDIDATE,
      id: null,
      score: null,
      margin: null,
      runnerUp: null,
      detail: "no admissible candidate has been activated yet — nothing here to bind to",
    };
  }

  const [topId, topScore] = ranked[0];
  if (topScore < minActivation) {
    return {
      ...base,
      verdict: CONTEST_VERDICTS.BELOW_FLOOR,
      id: topId,
      score: topScore,
      margin: null,
      runnerUp: ranked[1]?.[0] ?? null,
      detail: `top candidate's recall (${topScore.toFixed(3)}) does not clear minActivation (${minActivation})`,
    };
  }

  const second = ranked[1]?.[1] ?? 0;
  const margin = topScore > 0 ? (topScore - second) / topScore : 0;

  if (margin < bar) {
    return {
      ...base,
      verdict: contested.length > 0 ? CONTEST_VERDICTS.CONTESTED_NO_MARGIN : CONTEST_VERDICTS.NO_MARGIN,
      id: topId,
      score: topScore,
      margin,
      runnerUp: ranked[1]?.[0] ?? null,
      detail:
        contested.length > 0
          ? `frame carries ${contested.length} co-present competitor(s); top leads by ${(margin * 100).toFixed(1)}%, short of the contested bar (${(bar * 100).toFixed(1)}%)`
          : `top candidate leads the runner-up by only ${(margin * 100).toFixed(1)}%, short of minMargin (${(bar * 100).toFixed(1)}%)`,
    };
  }

  return {
    ...base,
    verdict: CONTEST_VERDICTS.BOUND,
    id: topId,
    score: topScore,
    margin,
    runnerUp: ranked[1]?.[0] ?? null,
    detail:
      contested.length > 0
        ? `bound over ${contested.length} co-present competitor(s) by ${(margin * 100).toFixed(1)}%, clearing the contested bar (${(bar * 100).toFixed(1)}%)`
        : `bound by ${(margin * 100).toFixed(1)}%, clearing minMargin (${(bar * 100).toFixed(1)}%)`,
  };
}

// ── the null-adjudicator ────────────────────────────────────────────────────
//
// WHY adjudicate() ABOVE IS NOT ENOUGH, measured. A margin compared to a
// CONSTANT rewards a sparse candidate field: scrambling a material's frames
// destroys its coherence, thins the field, and RAISES the mean margin
// (Borodino 0.028 real -> 0.053 shuffled; W&P article 0.047 -> 0.073; Pride
// binds MORE shuffled than real, 648 vs 610; Frankenstein still binds at 76%
// of its real rate on scrambled material). A bar that incoherent material clears
// more easily than coherent material is measuring field density, not
// evidence.
//
// THE FIX IS THE REPO'S OWN SHAPE: test the lead against the material's own
// null instead of a constant (the Born-gate discipline — draws, seed, a
// declared significance — already used by wayfind and network-standing).
// The null here redistributes WHICH members were present at the activated
// frames: each draw samples, for every activated frame, a member-set from
// the pool of member-sets the reading has actually produced so far — empty
// sets included, so the material's own presence density is preserved — and
// recomputes the same best-single-hop margin. The real margin beats the
// null only when the same member owns several of the hottest recalled
// frames, i.e. when recall keeps pointing at the same being. That is what
// reading IS; scrambled material cannot fake it, because its recall scatters.
//
// The degenerate cases come out honest without special-casing: a
// one-member world ties every draw (p = 1, refused — identity made no
// difference, so nothing was read); a dense field lowers the null's margins
// along with the real one, so a small lead can still be significant where a
// constant bar would have refused it.
//
// draws / seed / alpha are declared, never defaulted — the same standing
// every other Born gate in this codebase holds.

const bestSingleHop = (activation, memberAt) => {
  const score = new Map();
  for (const [frame, amt] of activation) {
    const members = memberAt(frame);
    if (!members) continue;
    for (const m of members) {
      if (amt > (score.get(m) ?? -Infinity)) score.set(m, amt);
    }
  }
  return score;
};

const marginOf = (score, keep) => {
  const ranked = [...score.entries()].filter(([id]) => keep(id)).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { top: null, topScore: 0, margin: 0, runnerUp: null };
  const [top, topScore] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  return { top, topScore, margin: topScore > 0 ? (topScore - second) / topScore : 0, runnerUp: ranked[1]?.[0] ?? null };
};

/**
 * Adjudicate one deixis by testing its lead against the material's own
 * permutation null, instead of against a declared constant.
 *
 * @param {object} args
 * @param {Map<*,number>} args.activation frame -> recalled amount, for THIS
 *   deixis. Sparse; supplied whole by the adapter.
 * @param {Map<*,Iterable<string>>} args.frameMembers frame -> the member ids
 *   present at that frame, for every frame the reading has produced so far.
 *   Frames with nobody present belong in this map too — the null preserves
 *   the material's own presence density only if they do.
 * @param {Iterable<string>} [args.coPresent] members the CURRENT frame
 *   carries. Reported for disclosure; membership, never a score.
 * @param {number} args.minActivation declared floor. Never defaulted.
 * @param {number} args.draws declared null draws. Never defaulted.
 * @param {number} args.seed declared; reproducibility is a property of the
 *   run, not a courtesy.
 * @param {number} args.alpha declared significance the real margin must
 *   reach against the null. Never defaulted.
 * @param {(id: string) => boolean} [args.admissible] hard filter, as above.
 */
export function nullAdjudicate({
  activation,
  frameMembers,
  coPresent,
  minActivation,
  draws,
  seed,
  alpha,
  admissible,
} = {}) {
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("nullAdjudicate: minActivation is declared — how much echo counts as real is never a default");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("nullAdjudicate: draws is declared — how many null draws buy a verdict is never a default");
  if (!Number.isFinite(seed))
    throw new TypeError("nullAdjudicate: seed is declared — a verdict that cannot be reproduced is not a verdict");
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1)
    throw new TypeError("nullAdjudicate: alpha is declared in (0,1) — how surprising a lead must be is never a default");
  if (!(activation instanceof Map)) throw new TypeError("nullAdjudicate: activation is a Map(frame -> amount)");
  if (!(frameMembers instanceof Map)) throw new TypeError("nullAdjudicate: frameMembers is a Map(frame -> members)");

  const keep = typeof admissible === "function" ? admissible : () => true;
  const present = [...(coPresent ?? [])].filter((id) => keep(id));

  const real = marginOf(bestSingleHop(activation, (f) => frameMembers.get(f)), keep);
  const base = { contested: present, draws, alpha };

  if (real.top === null) {
    return { ...base, verdict: CONTEST_VERDICTS.NO_CANDIDATE, id: null, score: null, margin: null, runnerUp: null, p: null,
      detail: "no admissible candidate has been activated yet — nothing here to bind to" };
  }
  if (real.topScore < minActivation) {
    return { ...base, verdict: CONTEST_VERDICTS.BELOW_FLOOR, id: real.top, score: real.topScore, margin: null, runnerUp: real.runnerUp, p: null,
      detail: `top candidate's recall (${real.topScore.toFixed(3)}) does not clear minActivation (${minActivation})` };
  }

  // The pool the null samples from: the member-sets the reading has
  // actually produced, empties included. Frozen once per call.
  const pool = [...frameMembers.values()];
  const rand = lcg(seed);
  const frames = [...activation.keys()];
  let asExtreme = 0;
  for (let d = 0; d < draws; d++) {
    const assign = new Map();
    for (const f of frames) assign.set(f, pool[Math.floor(rand() * pool.length)]);
    const nullMargin = marginOf(bestSingleHop(activation, (f) => assign.get(f)), keep).margin;
    if (nullMargin >= real.margin) asExtreme += 1; // ties count toward the null — conservative
  }
  const p = (asExtreme + 1) / (draws + 1);

  if (p > alpha) {
    return { ...base, verdict: CONTEST_VERDICTS.NULL_NOT_CLEARED, id: real.top, score: real.topScore, margin: real.margin, runnerUp: real.runnerUp, p,
      detail: `a lead of ${(real.margin * 100).toFixed(1)}% is what this material's own null produces (p=${p.toFixed(3)} over ${draws} draws) — separation without evidence` };
  }

  return { ...base, verdict: CONTEST_VERDICTS.BOUND, id: real.top, score: real.topScore, margin: real.margin, runnerUp: real.runnerUp, p,
    detail: `lead of ${(real.margin * 100).toFixed(1)}% clears the material's own null (p=${p.toFixed(3)} <= ${alpha} over ${draws} draws)` };
}
