// logos.js — Logos, the archon of SOUNDNESS: do the claims on the table
// turn the argument back on itself?
//
// nagarjuna.js's own "paradigm" terrain already names this exactly
// ("LOGOS: the answer's claim... must not turn the argument in on itself
// (reasoning-lint's findClaimCycle). An answer that introduces a cycle
// into the whole is logically unsound, whatever it binds to") but the
// organ it calls for was never built here — `grep -rn findClaimCycle`
// across this repo found the one comment naming it and nothing wiring
// it. This is that organ, reusing eoreader7's real `findClaimCycle`
// (organs/reasoning-lint.js, "Degrees Kelsen") rather than a second
// cycle-detector grown here — the same function this session already
// verified live against the eoreader7 proxy's own reasoning_content
// stream.
//
// PURE. `findClaimCycle` takes a flat array of {end1, label, end2} notes
// — the exact shape `hypergraph.js`'s own `relationsFor(...).edges`
// already carries (P76's earned-name wipe), so nothing here re-derives
// what an edge is.

import { findClaimCycle, lintLedger, lintTimeline } from "./reasoning-lint.js";

/** nagarjuna.js's own `organs.logos(notes)` contract: an array of found
 * cycles (today, at most one — findClaimCycle stops at the first). */
export function logos(notes) {
  const cycle = findClaimCycle(notes ?? []);
  return cycle ? [cycle] : [];
}

/**
 * ledgerLint(log, { door, taskLog, fromSeq, functional }) — Degrees Kelsen
 * over the NOTES IN THE LOG, not over what the model said.
 *
 * Until this existed the live turn linted only the question's own words for
 * a cycle; the record a turn actually writes — disputes, cuts, derived facts,
 * two notes at one address — was never read by the linter at all. This reads
 * it at the strictest degree, once for the whole ledger and once as the
 * turn's own fold (`fromSeq`, where the ledger stood when the turn began), so
 * the record can say what THIS turn's writing introduced apart from what was
 * already standing.
 *
 * `functional` is the declarations register folded (given / candidates):
 * a disagreement at one address convicts only where a named giver declared
 * the relation takes one value. Without it the linter's old unconditional
 * reading convicted hundreds of true facts on real pages (reasoning-lint.js,
 * oneValueLookup), so this caller always supplies it — an empty register
 * convicts nobody and counts what it did not judge.
 *
 * Disclosure only (P186): the result rides the record; nothing here edits or
 * withholds the mouth's answer. Findings are trimmed to plain fields and
 * capped; the counts are never capped.
 */
// Strict: the only extra check it adds over the ledger is the support cycle,
// and on 3,539 real notes (five Wikipedia pages, 2026-09-16) it found none.
export const LEDGER_LINT_STRICTNESS = "strict";
// The record's own list convention, reused: answer-record.js already caps
// `unbacked` and `absences` at 50. The counts are never capped.
export const LEDGER_LINT_MAX_FINDINGS = 50;

const trimFinding = (f) => ({ kind: f.kind, level: f.level, severity: f.severity, detail: f.detail, ...(f.note ? { note: f.note } : {}) });

export function ledgerLint(log, { door, taskLog, fromSeq = null, functional = { given: [], candidates: [] } } = {}) {
  if (!log?.entries?.length || !door || typeof taskLog?.projectTasks !== "function") return null;
  const strictness = LEDGER_LINT_STRICTNESS;
  const turnFold = Number.isInteger(fromSeq) && fromSeq >= 0 && fromSeq < log.nextSeq;
  let whole, appeared = null, resolved = null;
  if (turnFold) {
    const t = lintTimeline({ log, door, taskLog, cursors: [fromSeq, log.nextSeq], strictness, functional });
    whole = t.folds.at(-1);
    appeared = t.transitions[0]?.appeared ?? [];
    resolved = t.transitions[0]?.resolved ?? [];
  } else {
    whole = lintLedger(log, { door, taskLog, strictness, functional });
  }
  const notInfo = (f) => f.severity !== "info";
  return {
    strictness,
    ok: whole.ok,
    read: whole.read,
    counts: { ...whole.counts },
    unjudged: whole.unjudged?.addresses ?? 0,
    findings: whole.findings.filter(notInfo).slice(0, LEDGER_LINT_MAX_FINDINGS).map(trimFinding),
    ...(appeared ? {
      thisTurn: {
        fromSeq,
        toSeq: log.nextSeq,
        appeared: appeared.filter(notInfo).slice(0, LEDGER_LINT_MAX_FINDINGS).map(trimFinding),
        appearedCount: appeared.filter(notInfo).length,
        resolvedCount: resolved.filter(notInfo).length,
      },
    } : {}),
  };
}

/**
 * functionalConflicts(log, { door, taskLog, functional }) — the SAME strict
 * ledgerLint reading `app.js` already runs post-hoc for disclosure (P236),
 * run BEFORE the mouth drafts and narrowed to just the pairs a reader must
 * know about going in: `standing_contradiction` findings, where a declared
 * `/declare … functional` relation holds two different values at rest. The
 * finding's own `at` field concatenates the two note ids as `"idA+idB"`
 * (reasoning-lint.js's `pairCtx`, no `a`/`b` fields survive on the finding
 * itself) — split once here so callers never re-parse it.
 *
 * Disclosure only (P186): this returns which pairs conflict; it lands
 * nothing and edits nothing. A caller that wants the conflict VISIBLE to
 * the mouth before it drafts still has to land it (dispute()) itself.
 */
export function functionalConflicts(log, { door, taskLog, functional } = {}) {
  // lintLedger DIRECTLY, never through ledgerLint above: ledgerLint's own
  // trimFinding strips a finding's `at` field (built for the post-hoc
  // disclosure surface, which only ever shows counts/detail, never re-opens
  // which ids conflicted) — going through it here would always report zero
  // conflicts. Found by a standalone mechanism test before this shipped.
  if (!log?.entries?.length || !door || typeof taskLog?.projectTasks !== "function") return [];
  const whole = lintLedger(log, { door, taskLog, strictness: LEDGER_LINT_STRICTNESS, functional });
  if (!whole) return [];
  const out = [];
  for (const f of whole.findings) {
    if (f.kind !== "standing_contradiction" || typeof f.at !== "string") continue;
    const [aId, bId] = f.at.split("+");
    if (aId && bId) out.push({ aId, bId, detail: f.detail });
  }
  return out;
}

/**
 * Does the QUESTION's own claims already form a cycle, independent of any
 * answer? Treats the question as its own material — the one place this
 * repo's checking apparatus never looks, since every other check compares
 * an ANSWER against retrieved ground, never a question against itself.
 * `relationsFor` is app.js's own already-built reader (makeRelationReader's
 * returned function): called here with the question as its one passage so
 * the edges it returns are the question's own, nothing external.
 */
export function questionCycle(question, relationsFor) {
  const text = String(question ?? "").trim();
  if (!text || typeof relationsFor !== "function") return null;
  let reader;
  try { reader = relationsFor([{ text }], { pool: [{ text }] }); } catch { return null; }
  const edges = reader?.edges ?? [];
  if (!edges.length) return null;
  const cycle = findClaimCycle(edges);
  return cycle
    ? { cycle: cycle.cycle, detail: `A support cycle in the question's own claims: ${cycle.cycle.join(" → ")} — nothing outside the cycle grounds it (begs the question).` }
    : null;
}
