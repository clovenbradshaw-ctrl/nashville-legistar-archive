// reference-fit.js — "grow the organs so the pipeline naturally tries to
// fit toward a real reference, always revisable." This is the standing,
// revisable capability the earlier exploratory Girard/Pocket-Casts pass
// (2026-09-30) was a one-off manual version of: a real property (a CSS
// value the podcast app renders) can be measured against a growing corpus
// of real references, and any adjustment it earns lands as an entry on the
// SAME append-only kernel ledger (kernel/task-log.js), typed by the SAME
// nine operators / three grains everything else in this repo uses — never
// a second, informal decision process running beside it.
//
// THE NINE OPERATORS, AS THEY ARE USED HERE (each function below lands
// exactly one):
//   INS  (Generate·Existence, Figure/Entity)   proposeReference    — a
//        reference (the-fold, heimdall, a downloaded screenshot...) is
//        individuated as a real thing this corpus now includes.
//   SIG  (Relate·Existence, Figure/Entity)     signMeasurement     — one
//        reference's real measured value for one property is signed as a
//        fact worth attending to.
//   SEG  (—, RETRACT)                          retractFinding      — a
//        prior finding is CUT from the live candidate set (task-log's own
//        first-class RETRACT entry kind, never a second deletion scheme).
//   CON  (Relate·Structure, Figure/Link)       bindCorrespondence  — a
//        reference's measurement is declared RELEVANT to one of our own
//        properties (the arrangement, never assumed).
//   SYN  (Generate·Structure, Figure/Link)     synthesizeCandidate — the
//        live, non-retracted measurements are composed into one candidate
//        value (a per-channel RGB median) — DERIVED when the references
//        agree tightly, CONTESTED when they do not, per task-log's own
//        OPERATOR_BASIS vocabulary, never silently blended either way.
//   DEF  (Differentiate·Interpretation, Figure/Lens) defineCandidate — the
//        candidate is cut out as a testable clause (void-loop's own
//        Dissecting stance at this exact cell).
//   EVA  (Relate·Interpretation, Figure/Lens)  evaluateCandidate   — the
//        SAME cell's Binding stance: the clause is checked against a
//        real, injected verdict function (never trusted from the median
//        alone) and against the CONTESTED/DERIVED basis SYN already
//        disclosed. Only a DERIVED-and-holding candidate is ever fit to
//        mechanically apply.
//   REC  (Generate·Interpretation, Pattern/Paradigm) concedeCandidate —
//        "always revisable": a landed candidate is conceded, never
//        deleted, when later evidence (a new reference, a person's own
//        call) disagrees — landed on the SAME task_id (no `supersedes`;
//        a re-zero concedes a ground, it does not compile a new whole out
//        of the old one, this repo's own standing REC convention) and
//        the next round's SYN/DEF/EVA opens under a new round number.
//   NUL  is the caller's own act, not this module's: asking `fitStatus`
//        for a property NOT yet on the ledger IS the NUL declaration
//        ("what should property P be, given the references we have") —
//        there is nothing to individuate here beyond that question itself.
//
// Pure; the kernel task-log/cube functions are IMPORTED (not injected —
// they are this repo's own kernel, not an external organ the cast.js
// pattern exists to swap out), and the EVA check function is the one
// thing genuinely injected per call, since what counts as "holds" is the
// caller's own domain knowledge (a WCAG contrast floor, a golden's own
// score, anything).

import { ENTRY_KINDS, OPERATOR_BASIS, append, projectTasks } from "../kernel/task-log.js";

// Per-channel RGB spread (0-255) at or above which references are reported
// CONTESTED rather than silently averaged into a value nobody measured.
// Declared, not tuned: a generous multiple of the +2.7-lightness-point
// elevation step girard.js's own ELEVATION_STEP already treats as a real,
// meaningful difference between two references — a spread this small
// between references is noise; the whole point is refusing to paper over
// one this large.
export const SPREAD_THRESHOLD = { value: 20, giver: "organs/reference-fit.js", basis: "generous multiple of girard.js's own ELEVATION_STEP (2.7), the smallest difference this repo's Girard evidence already treats as real and meaningful — a per-channel RGB spread below this among references is noise, at or above it is a genuine, disclosed disagreement" };

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}
function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function currentTask(log, taskId) {
  return projectTasks(log).find((t) => t.task_id === taskId) ?? null;
}

/** INS·Figure — a reference joins the corpus, once. Idempotent: proposing
 * the same name twice is a no-op (the being already exists). */
export function proposeReference(log, { name, giver }) {
  const task_id = `reference:${name}`;
  if (currentTask(log, task_id)) return log;
  return append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id, operator: "INS", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Figure",
    name, giver, description: `${name} joins the corpus of real, measured design references`,
  });
}

/** SIG·Figure — one reference's real measured value for one property.
 * Idempotent when the value hasn't changed (a fact re-observed is not a
 * new fact): re-signing the SAME hex is a no-op, so a caller that reruns
 * this every pipeline pass doesn't bloat the ledger with duplicate
 * observations of an unchanged screenshot. A genuinely CHANGED
 * measurement still lands as a new entry — this is re-observation, not
 * an edit lock. */
export function signMeasurement(log, { property, reference, hex }) {
  const task_id = `signal:${property}:${reference}`;
  const existing = currentTask(log, task_id);
  if (existing && existing.hex === hex) return log;
  return append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id, operator: "SIG", operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Figure",
    property, reference, hex, description: `${reference}'s real ${property} measures ${hex}`,
  });
}

/** SEG (RETRACT) — cut a prior finding from the live set. Never a second
 * deletion scheme: task-log's own first-class RETRACT entry kind. */
export function retractFinding(log, { taskId, because }) {
  if (typeof because !== "string" || !because) throw new TypeError("retractFinding requires a stated reason — a retraction with no `because` is a deletion, not a SEG");
  return append(log, { kind: ENTRY_KINDS.RETRACT, task_id: taskId, because });
}

/** CON·Figure — declare a reference's measurement relevant to our own
 * property. The arrangement, never assumed silently by SYN. Idempotent:
 * the declaration itself doesn't change between runs. */
export function bindCorrespondence(log, { property, reference }) {
  const task_id = `link:${property}:${reference}`;
  if (currentTask(log, task_id)) return log;
  return append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id, operator: "CON", operator_basis: OPERATOR_BASIS.DECLARED, grain: "Figure",
    property, reference, description: `${reference}'s ${property} measurement is declared relevant to our own ${property}`,
  });
}

/**
 * SYN·Figure — compose the live (non-retracted) signed measurements for a
 * property into one candidate value. Reads live SIG entries itself (never
 * trusts a caller-supplied sample list that might include a retracted
 * one) — `projectTasks` already drops anything RETRACT closed.
 */
export function synthesizeCandidate(log, { property, round = 1 }) {
  const tasks = projectTasks(log);
  const samples = tasks
    .filter((t) => t.operator === "SIG" && t.property === property)
    .map((t) => ({ reference: t.reference, hex: t.hex }));
  if (!samples.length) throw new TypeError(`synthesizeCandidate: no live SIG measurements for property ${JSON.stringify(property)} — sign at least one before synthesizing`);
  const rgbs = samples.map((s) => hexToRgb(s.hex));
  const channelMedian = [0, 1, 2].map((c) => median(rgbs.map((rgb) => rgb[c])));
  const candidateHex = rgbToHex(channelMedian);
  const spread = Math.max(...[0, 1, 2].map((c) => Math.max(...rgbs.map((rgb) => rgb[c])) - Math.min(...rgbs.map((rgb) => rgb[c]))));
  const contested = spread >= SPREAD_THRESHOLD.value;
  const task_id = `candidate:${property}#${round}`;
  const nextLog = append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id, operator: "SYN", operator_basis: contested ? OPERATOR_BASIS.CONTESTED : OPERATOR_BASIS.DERIVED, grain: "Figure",
    property, candidateHex, spread, n: samples.length, samples,
    description: `candidate ${property}: ${candidateHex} (median across ${samples.length} reference(s), spread ${spread}/255 per channel)`,
  });
  return { log: nextLog, candidateHex, spread, contested, n: samples.length, samples };
}

/** DEF·Figure — cut the candidate out as a testable clause (Dissecting). */
export function defineCandidate(log, { property, round = 1 }) {
  const task_id = `define:${property}#${round}`;
  return append(log, {
    kind: ENTRY_KINDS.PROPOSE, task_id, operator: "DEF", operator_basis: OPERATOR_BASIS.DECLARED, grain: "Figure",
    property, depends_on: [`candidate:${property}#${round}`],
    description: `if the round-${round} candidate ${property} clears its check, it becomes the landed value`,
  });
}

/**
 * EVA·Figure — bind the clause to a real check (Binding). `contested`
 * (SYN's own disclosed finding) refuses BEFORE the check function ever
 * runs — a contested median is never worth checking, since checking it
 * would dress up "we don't actually agree" as "and it passed anyway."
 * `check()` is the one genuinely injected function: what counts as
 * "holds" (a WCAG floor, anything) is the caller's own domain knowledge.
 */
export function evaluateCandidate(log, { property, round = 1, candidateHex, contested, check }) {
  const task_id = `define:${property}#${round}`;
  if (contested) {
    return append(log, {
      kind: ENTRY_KINDS.RESULT, task_id, operator: "EVA", operator_basis: OPERATOR_BASIS.CONTESTED, grain: "Figure",
      result: { verdict: "refused", detail: "the live references disagree beyond the declared spread threshold — never silently averaged into a value nobody actually measured" },
    });
  }
  const verdict = check(candidateHex);
  return append(log, {
    kind: ENTRY_KINDS.RESULT, task_id, operator: "EVA", operator_basis: verdict.holds ? OPERATOR_BASIS.PRODUCED : OPERATOR_BASIS.CONTESTED, grain: "Figure",
    result: { verdict: verdict.holds ? "holds" : "refused", detail: verdict.detail },
  });
}

/** REC·Pattern — concede a landed candidate. No `supersedes`: a re-zero
 * concedes a ground, it does not compile a new whole out of the old one
 * (this repo's own standing REC convention). The NEXT round's SYN opens
 * fresh under an incremented `round`. */
export function concedeCandidate(log, { property, round = 1, trigger }) {
  if (typeof trigger !== "string" || !trigger) throw new TypeError("concedeCandidate requires the verbatim trigger — a concession with no stated reason is a silent reversal, not a REC");
  const task_id = `define:${property}#${round}`;
  return append(log, {
    kind: ENTRY_KINDS.EVIDENCE, task_id, operator: "REC", operator_basis: OPERATOR_BASIS.DECLARED, grain: "Pattern",
    trigger, description: `conceding the round-${round} landed ${property} candidate — ${trigger}`,
  });
}

/**
 * fitStatus(log, property) — the plain-language reading of the highest
 * round's own define task: "landed" (holds, not conceded), "refused"
 * (contested or failed its check), "conceded" (was landed, later REC'd —
 * always revisable, exactly the standing state after a concession), or
 * "open" (no round has run its EVA yet). Never asserts a stronger verdict
 * than the ledger itself carries.
 */
export function fitStatus(log, property) {
  const tasks = projectTasks(log);
  const rounds = tasks
    .filter((t) => t.task_id.startsWith(`define:${property}#`))
    .map((t) => ({ ...t, round: Number(t.task_id.split("#")[1]) }))
    .sort((a, b) => b.round - a.round);
  const latest = rounds[0];
  if (!latest) return { status: "open", property, detail: "no round has been proposed yet — this is the NUL: what should this property be?" };
  // A concession lands as an EVIDENCE entry with operator REC on the SAME
  // task_id — projectTasks folds it in as the task's own last operator,
  // so a conceded task reads operator:"REC" even though its `result`
  // field still remembers the EVA verdict that preceded the concession.
  if (latest.operator === "REC") return { status: "conceded", property, round: latest.round, priorResult: latest.result, detail: `round ${latest.round}'s landed candidate was conceded: ${latest.description}` };
  if (!latest.result) return { status: "open", property, round: latest.round, detail: `round ${latest.round} defined, not yet evaluated` };
  if (latest.result.verdict === "holds") return { status: "landed", property, round: latest.round, candidateHex: rounds.find((r) => r.round === latest.round) && projectTasks(log).find((t) => t.task_id === `candidate:${property}#${latest.round}`)?.candidateHex, detail: latest.result.detail };
  return { status: "refused", property, round: latest.round, detail: latest.result.detail };
}

/**
 * latestRound(log, property) -> the highest round number any candidate:
 * task has ever used for this property, or 0 if none exist. The one
 * number `runReferenceFit`-style callers need to open the NEXT round
 * without re-deriving it from `fitStatus`'s own shape.
 */
export function latestRound(log, property) {
  const rounds = projectTasks(log)
    .filter((t) => t.task_id.startsWith(`candidate:${property}#`))
    .map((t) => Number(t.task_id.split("#")[1]));
  return rounds.length ? Math.max(...rounds) : 0;
}

/**
 * needsReopen(log, property) -> true when the live (non-retracted) SIG
 * measurements for this property no longer match the sample set the
 * latest round's own SYN actually saw. This is what makes "always
 * revisable" a NATURAL, automatic property of the pipeline rather than
 * something a caller has to remember to re-trigger by hand: retracting a
 * finding (SEG) or signing a genuinely new measurement (SIG) changes the
 * live evidence, and this reports the mismatch so the caller knows a
 * fresh SYN/DEF/EVA cycle is warranted — never runs one itself, since
 * opening a new round is the caller's own act, not something a status
 * READER should do as a side effect.
 */
export function needsReopen(log, property) {
  const round = latestRound(log, property);
  if (!round) return false; // nothing has ever been synthesized — that's "open", not "reopen"
  const tasks = projectTasks(log);
  const candidateTask = tasks.find((t) => t.task_id === `candidate:${property}#${round}`);
  if (!candidateTask) return false;
  const liveKeys = tasks.filter((t) => t.operator === "SIG" && t.property === property).map((t) => `${t.reference}:${t.hex}`).sort();
  const frozenKeys = (candidateTask.samples ?? []).map((s) => `${s.reference}:${s.hex}`).sort();
  return JSON.stringify(liveKeys) !== JSON.stringify(frozenKeys);
}
