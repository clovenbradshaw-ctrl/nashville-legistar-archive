// skeleton-loop.js — STAGE 7: THE SKELETON LOOP. RECOMPOSE WHATEVER A
// FINDING STILL LICENSES, UNTIL SETTLED (2026-09-22).
//
// The user's flow: "compose a reason-linted EOT skeleton … recursively
// updating it as needed, with the shape in mind and the ethos and logos
// intact." Stage 6 (arrange.js) composes the skeleton and lints it — Clark
// (a section with no job), Kelsen (conflicting figures, a circular claim),
// Kidder & Todd (one fact said twice), the extent (an inversion). Some
// findings LICENSE a recomposition: an off-thesis section that answers none
// of the ask's questions may leave; across tiers, the operator's figure
// stands and the fetched one may leave. This loop applies what is licensed
// — one finding per loop, the outline REBUILT from the material less what
// left, never patched — and measures each loop against the last, Hora's
// way (loop-check.js): a loop that loses a question the ask asked is
// undone, whatever else it fixed. It stops when nothing is licensed, when a
// loop is undone, or when it has run once per finding that was licensed at
// the start — bounded by the work, not by a constant.
//
// The SHAPE is in mind throughout: the skeleton's section count is measured
// against the void's cardinality (asked, or learned from the sources), and
// reported on every loop; selection to that budget is stage 6's own
// (selectToBudget), so this loop never invents sections to fill a shape.
//
// No model call. The mouth's votes (steer.js) run after this loop, on the
// settled skeleton.

import { arrangeEssay } from "./arrange.js";
import { drawnParts, draftWords } from "./eot-draft.js";
import { isFunctionWord } from "./pos-prior.js";
import { askQuestions } from "./steer.js";

export const SKELETON_LOOP_SCHEMA = "EOSkeletonLoop@1";

/** What the skeleton holds: statements placed, the ask's questions some
 *  section still covers, findings licensing a recomposition, sections. */
export function measureSkeleton(outline, draft, { task = "", shape = null } = {}) {
  const points = drawnParts(draft).flatMap((p) => p.children ?? []);
  const text = new Map(points.map((pt) => [pt.id, pt.text]));
  const placed = outline.slots.flatMap((s) => s.statements).filter((id) => text.has(id));
  const questions = askQuestions(task);
  const said = new Set(placed.flatMap((id) => draftWords(text.get(id)).filter((w) => !isFunctionWord(w))));
  const covered = questions.filter((q) => { const own = draftWords(q).filter((w) => !isFunctionWord(w)); return !own.length || own.some((w) => said.has(w)); }).length;
  const licensed = outline.findings.filter((f) => f.licenses).length;
  const sections = outline.slots.filter((s) => s.statements.length).length;
  const want = shape?.agreedUnits?.find((a) => ["paragraph", "section", "part"].includes(a.unit))?.n ?? null;
  return { placed: placed.length, of: points.length, covered, questions: questions.length, licensed, findings: outline.findings.length, sections, want };
}

/** A loop may not lose a question the ask asked; it should reduce what is
 *  licensed; losing statements is allowed only as a finding licensed it. */
export function judgeSkeletonLoop(prev, now) {
  if (!prev) return { verdict: "first", keep: true, why: "loop zero: the skeleton as composed" };
  if (now.covered < prev.covered) return { verdict: "worse", keep: false, why: `covers ${now.covered} of ${now.questions} questions, the last loop covered ${prev.covered}` };
  if (now.licensed > prev.licensed) return { verdict: "worse", keep: false, why: `${now.licensed} finding(s) license a recomposition, the last loop left ${prev.licensed}` };
  if (now.licensed < prev.licensed) return { verdict: "better", keep: true, why: `${prev.licensed - now.licensed} licensed finding(s) resolved, no question lost` };
  return { verdict: "same", keep: true, why: "loses nothing, resolves nothing" };
}

/**
 * skeletonLoop({ draft, spec, shape, task, arrange, onLoop }) →
 *   { outline, loops: [{ n, finding, measure, judge, excluded }], excluded, basis }
 * `arrange` may be an injected arranger (a skeleton arm); it must accept
 * { draft, spec, exclude }.
 */
export function skeletonLoop({ draft, spec = null, shape = null, task = "", arrange = null, onLoop = null } = {}) {
  const compose = arrange ?? arrangeEssay;
  const excluded = new Set();
  let outline = compose({ draft, spec, exclude: excluded });
  let measure = measureSkeleton(outline, draft, { task, shape });
  const loops = [{ n: 0, finding: null, measure, judge: judgeSkeletonLoop(null, measure), excluded: [] }];
  if (onLoop) onLoop(loops[0]);
  const budget = measure.licensed;
  for (let n = 1; n <= budget; n++) {
    const f = outline.findings.find((x) => x.licenses && (x.statements ?? []).some((id) => !excluded.has(id)));
    if (!f) break;
    const leaving = (f.statements ?? []).filter((id) => !excluded.has(id));
    const trial = new Set([...excluded, ...leaving]);
    const next = compose({ draft, spec, exclude: trial });
    const m = measureSkeleton(next, draft, { task, shape });
    const j = judgeSkeletonLoop(measure, m);
    const loop = { n, finding: { kind: f.kind, owner: f.owner, licenses: f.licenses, detail: f.detail }, measure: m, judge: j, excluded: leaving };
    loops.push(loop);
    if (onLoop) onLoop(loop);
    if (!j.keep) break;
    for (const id of leaving) excluded.add(id);
    outline = next; measure = m;
    if (!measure.licensed) break;
  }
  const last = loops.at(-1);
  const settled = measure.licensed === 0;
  return {
    schema: SKELETON_LOOP_SCHEMA, outline, loops, excluded: [...excluded], settled, measure,
    basis: `${loops.length - 1} loop(s) after the composition; ${settled ? "settled — nothing left licensing a recomposition" : last.judge.keep ? `stopped with ${measure.licensed} licensed finding(s) still open (bounded by the ${budget} licensed at the start)` : `the last loop was undone (${last.judge.why}); the skeleton stands at loop ${loops.length - 2}`}; ${excluded.size} statement(s) left the skeleton; ${measure.sections} section(s)${measure.want != null ? ` against a shape of ${measure.want}` : ""}, ${measure.covered}/${measure.questions} question(s) covered`,
  };
}

export function skeletonLoopLine(loop) {
  const m = loop.measure, j = loop.judge;
  return `loop ${loop.n}${loop.finding ? ` · ${loop.finding.owner}: ${loop.finding.licenses} (${loop.excluded.join(", ")})` : ""}: ${j.verdict}${j.keep ? "" : " — UNDONE"}\n${m.placed} of ${m.of} statements placed · ${m.sections} section(s)${m.want != null ? ` (shape: ${m.want})` : ""} · ${m.covered}/${m.questions} question(s) covered · ${m.licensed} licensed of ${m.findings} finding(s)\n${j.why}${loop.finding ? `\n${loop.finding.detail}` : ""}`;
}
