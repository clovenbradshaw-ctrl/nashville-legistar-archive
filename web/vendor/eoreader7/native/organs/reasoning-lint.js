// organs/reasoning-lint.js — the reasoning seed's section 4–5, run as a
// linter over the holograph (the notes ledger's projected record).
//
// Handle: Degrees Kelsen — after Hans Kelsen, the jurist who formalized how
// norms in a hierarchy resolve conflict: validity first, then lex specialis,
// then lex posterior, never a silent pick. "Degrees" because the order is a
// fixed scale read at the query time — like temperature, it is measured,
// never tuned.
//
// CONSTITUTION. eo-constitution II.2 — the precedence order is received
// (giver: Hans Kelsen), never derived from material and never tuned against
// it; III.2 — a validity window is a declared tag on an entry, never a clock
// the engine owns; IV.4 — every finding cites the tags and ledger entries
// that produced it. This seed is agent policy under the constitution,
// proposed not self-enacted (IV.2), not an amendment to the constitution's
// own text (IV.1).
//
// WHAT THIS IS. The seed ("The Reasoning Seed", 2026-09-10) says
// transitivity and circularity checks catch bad CHAINS and nothing else:
// they say nothing about whether a claim should chain classically at all
// (a contested claim), whether it is still valid now (temporal gating),
// whether it is an obligation, permission, or defeasible default (force),
// or whether two seemingly contradictory claims are just differently
// scoped. The seed's fix is a fixed precedence order — validity window →
// regime → specificity → force → recency → entrenchment — written down in
// ONE place (`organs/regime.js`), and a containment boundary
// (`regime.js::isSettled`) that a contested claim may never cross into
// classical resolution. This module is that order APPLIED: it reads the
// ledger's projection (the holograph), tags every live claim the way the
// seed says it must be tagged at admission, and reports, as typed
// findings, where the record is incoherent — a contested claim that a
// resolution would silently pick, an expired obligation still treated as
// in force, a disagreement no declared rule separates, a composition step
// nothing licensed, a support cycle that begs the question.
//
// THE LADDER OF STRICTNESS. Three declared degrees, each a superset of the
// one below it:
//
//   report   — the record's standing, disclosed: what is live, what is
//              contested, what is out of its validity window, what rests on
//              a single voice's testimony. Nothing here convicts.
//   standard — the seed's two falsifiable facts, as errors: an expired
//              obligation fails the validity-window check before it ever
//              reaches force/entrenchment, and a contested claim is never
//              silently picked as a winner (it routes to landContest —
//              contraction only, never revise). A standing contradiction
//              (two live claims at one address no declared rule separates)
//              is an error here. A derived product resting on an expired or
//              contested premise is an error here.
//   strict   — the deepening: an inference step nothing licensed is an
//              error ("by the same reasoning" over an operation no
//              declaration covers — the seed's R1), and a directed cycle in
//              the claim graph (begging the question) is an error.
//
// WHAT IS INJECTED, AND WHY. `door` is a notes/hyperlexicon bundle
// (kernel/notes.js or organs/hyperlexicon.js — the cast.js pattern), so
// the linter reads the ledger through the SAME fold the surface reads,
// never a second projection. `taskLog` is the task-log bundle whose
// `projectTasks` resolves every note to its cell (operator × grain) — the
// seed's "resolve to a cube cell before reasoning", read off the ledger,
// never re-derived. `tags` is the admission-time tag map (regime.js's
// `tagClaim` output per note id); a note with no admission-time tag is
// still linted, but its force/validity are the declared defaults and the
// finding says so — the seed's "tagged at admission, not reasoned about",
// with the skipped tag made visible rather than silent.
//
// THE ACCEPTANCE CASE (the seed's section 7). One ordinance with a sunset
// clause and one contested landContest claim in one corpus. Before this
// module: a transitivity/circularity-only layer either silently resolved
// the contest (bug 3) or had no way to expire the obligation. After:
// `expired_in_conflict`/`expired_premise` fail the expired claim on the
// validity window before force or entrenchment is ever consulted, and
// `contested_disagreement`/`route_to_landContest` never pick a winner —
// both demonstrated live by `eval/the-fold/reasoning-lint-demo.mjs` and
// pinned by `tests/reasoning-lint.test.js`.
//
// PURE. No model call anywhere; no IO; no DOM. The organs are injected,
// the ledger is read through the injected fold, and every finding carries
// the note ids and the plain-language line.

import { projectTasks } from "../kernel/task-log.js";
import { gfpClaim, claimFromTriple, overlap, contains, depthOf, lca, ancestry, figureKey, claimKey, exactIdentity, GFP_CLAIM_SCHEMA } from "../kernel/gfp-claim.js";
import {
  persistenceOf, regimeOf, forceOfClause, inValidityWindow, isSettled, precedence, FORCES,
} from "./regime.js";

// ── the strictness ladder ──────────────────────────────────────────────────

export const LINT_STRICTNESS = Object.freeze(["report", "standard", "strict"]);
const LEVEL_RANK = new Map(LINT_STRICTNESS.map((l, i) => [l, i]));

export const SEVERITY = Object.freeze({ INFO: "info", WARN: "warn", ERROR: "error" });

/** Would this finding surface at the requested strictness? */
const shownAt = (finding, strictness) => LEVEL_RANK.get(finding.level) <= LEVEL_RANK.get(strictness);

const finding = (kind, level, severity, detail, { at = null, note = null, referents = null, spans = null } = {}) =>
  Object.freeze({ kind, level, severity, detail, ...(at ? { at } : {}), ...(note ? { note } : {}), ...(referents?.end1 || referents?.end2 ? { referents } : {}), ...(spans?.length ? { spans } : {}) });

// ── the holograph's own referents and raw spans, on every finding ──────────
//
// A finding that names a note should point INTO the record, not just at its
// id: WHICH referents its two ends resolve to (through the caller's
// cast.js::makeReferentIndex — the SAME identity the surface reads, injected
// cast.js-style), and the RAW BYTE SPANS the note carries (P5.2 addresses
// into the material, opened by the record, never a paraphrase). Both ride
// the finding; an absent index means ends stay folded surfaces (disclosed
// on the return), never a guessed referent.
const resolveEnds = (referentIndex, end1, end2) => {
  if (!referentIndex?.resolve) return null;
  const ids = (name) => { try { const r = referentIndex.resolve(String(name ?? "")); return r instanceof Set ? [...r] : [...(r ?? [])]; } catch { return []; } };
  const a = ids(end1), b = ids(end2);
  const id = (x) => { try { return referentIndex.represent?.(x) ?? x; } catch { return x; } };
  return {
    end1: a.length ? a.map(id) : null,
    end2: b.length ? b.map(id) : null,
    // Absent on either end is a typed absence, never a guessed being.
    gaps: { end1: !a.length, end2: !b.length },
  };
};

/** The holograph context a finding should carry: referents + raw spans. */
const contextOf = (note, { referentIndex = null } = {}) => {
  const refs = resolveEnds(referentIndex, note?.end1 ?? note?.subject, note?.end2 ?? note?.object);
  const spans = (note?.spans ?? []).map((s) => s?.at ?? s?.ref ?? null).filter(Boolean);
  return {
    ...(refs ? { referents: refs } : {}),
    ...(spans.length ? { spans: Object.freeze(spans) } : {}),
  };
};

// ── reading the holograph through the injected door ───────────────────────

// The door's fold under every name the organ has carried: the text face was
// renamed hyperlexicon.js → notes-text.js and its fold with it
// (foldHyperlexicon → foldNotes); the kernel door's is `fold`. Knowing only
// the old name, this linter read ZERO notes through the renamed door and
// returned ok:true on a contradictory ledger. A door with no fold at all is
// refused: a linter that cannot read the notes must never report them clean.
const FOLD_NAMES = Object.freeze(["foldHyperlexicon", "foldNotes", "fold"]);
const foldOf = (door, log) => {
  const name = FOLD_NAMES.find((k) => typeof door?.[k] === "function");
  if (!name) throw new TypeError(`reasoning-lint: the injected door exposes no fold (${FOLD_NAMES.join(" / ")}) — refused rather than linted as an empty ledger`);
  return door[name](log) ?? [];
};
const cutsOf = (door, log) => (typeof door?.foldCuts === "function" ? door.foldCuts(log) : []);
const disputesOf = (door, log) => {
  try { return door?.disputesOf?.(log) ?? new Map(); } catch { return new Map(); }
};
const concededOf = (door, log) => {
  try { return door?.concededIds?.(log) ?? new Set(); } catch { return new Set(); }
};

/** The seed's tag, read at lint time for a note that carries no admission-time tag. */
function workingTag(note, task, disputed, tags, queryTime) {
  const declared = tags.get(note.id) ?? null;
  const validity = declared?.validity ?? Object.freeze({ from: null, until: null, open: true });
  return Object.freeze({
    operator: task?.operator ?? null,
    grain: task?.grain ?? null,
    cell: task?.cell ?? null,
    persistence: task?.operator ? persistenceOf(task.operator) : null,
    regime: regimeOf(disputed ? [{ source: "dispute" }] : []),
    validity,
    force: declared?.force ?? "default",
    scope: declared?.scope ?? null,
    enactedAt: declared?.enactedAt ?? null,
    inScope: inValidityWindow(validity, queryTime),
    declared,
  });
}

const foldText = (t) => String(t ?? "").trim().toLowerCase();
const addressOf = (note) => `${foldText(note.end1)}|${foldText(note.label)}`;

// ── one value per address, only where a giver said so ─────────────────────
//
// Two live notes at one address (end1|label) with different end2 are a
// CONFLICT only if the relation takes one value. Most relations a reading
// hears do not: measured on 3,539 notes read from five real Wikipedia pages,
// the unconditional check convicted 459 "standing contradictions", nearly
// all of them two true facts ("Lincoln met Mary Owens" / "Lincoln met Mary
// Todd"). One-value-ness is functional(r) — a Pattern-grain claim a corpus
// can refute but never earn (interpretation/declarations.js) — so it is read
// off the declarations register, never assumed:
//   given      a named giver declared it  → a disagreement convicts (the
//              precedence order below decides it, or it stands tied)
//   candidate  unrefuted here, never given → disclosed, never a conviction
//   absent     nobody declared it          → not judged; counted as unjudged
// `functional` absent (null) keeps the old reading for callers that never
// supplied declarations — the ordinance acceptance case among them.
function oneValueLookup(functional) {
  if (functional == null) return null;
  const rels = (xs) => new Set([...(xs ?? [])]
    .filter((x) => typeof x === "string" || x?.declKind == null || x.declKind === "functional")
    .map((x) => foldText(typeof x === "string" ? x : x?.rel))
    .filter(Boolean));
  const given = rels(functional.given);
  const candidates = rels(functional.candidates);
  return (label) => {
    const l = foldText(label);
    return given.has(l) ? "given" : candidates.has(l) ? "candidate" : null;
  };
}

// ── cycle detection (begging the question, strict) ─────────────────────────

/** A directed cycle in the claim graph (end1 → end2), or null. The seed's
 * circularity check, over the holograph's own edges, never a re-derived one. */
export function findClaimCycle(notes) {
  const adj = new Map();
  for (const n of notes ?? []) {
    const a = foldText(n.end1), b = foldText(n.end2);
    if (!a || !b || a === b) continue;
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, id: n.id, end2: n.end2 });
  }
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];
  const path = [];
  const dfs = (v) => {
    color.set(v, GREY);
    path.push(v);
    for (const e of adj.get(v) ?? []) {
      const c = color.get(e.to) ?? WHITE;
      if (c === GREY) { const start = path.indexOf(e.to); return { cycle: path.slice(start).concat(e.to), edge: e }; }
      if (c === WHITE) { const r = dfs(e.to); if (r) return r; }
    }
    path.pop();
    color.set(v, BLACK);
    return null;
  };
  for (const v of adj.keys()) if ((color.get(v) ?? WHITE) === WHITE) { const r = dfs(v); if (r) return r; }
  return null;
}

// ── the ledger lint ────────────────────────────────────────────────────────

/**
 * lintLedger(log, { door, taskLog, tags, queryTime, conditions, strictness })
 * — the seed's order run over the holograph. `log` is a notes ledger,
 * `door` a notes/hyperlexicon bundle (injected), `taskLog` a task-log
 * bundle whose `projectTasks` resolves cells, `tags` the admission-time tag
 * map (regime.js `tagClaim` output), `conditions` the query's declared
 * scope conditions (lex specialis), `strictness` one of LINT_STRICTNESS.
 */
export function lintLedger(log, { door, taskLog, tags = new Map(), queryTime = Date.now(), conditions = [], strictness = "standard", referentIndex = null, functional = null } = {}) {
  if (!door || !taskLog || typeof taskLog.projectTasks !== "function")
    throw new TypeError("reasoning-lint.lintLedger: door (notes bundle) and taskLog (with projectTasks) are injected");
  const findings = [];
  const fold = foldOf(door, log);
  const cuts = cutsOf(door, log);
  const disputed = disputesOf(door, log);
  const conceded = concededOf(door, log);
  const tasks = new Map(taskLog.projectTasks(log).map((t) => [t.task_id, t]));
  const byId = new Map(fold.map((n) => [n.id, n]));
  // The holograph context for a note: referents + raw spans, or empty (absent index).
  const ctx = (n) => contextOf(n, { referentIndex });

  // The seed's "resolve to a cube cell before reasoning": every live note
  // resolves to a cell (operator × grain), read off the ledger.
  for (const n of fold) {
    const task = tasks.get(n.id);
    if (!task?.operator || !task?.grain || !task?.cell) {
      findings.push(finding("unresolved_cell", "report", SEVERITY.INFO,
        `"${n.end1} —${n.label}→ ${n.end2}" never resolved to a cube cell (operator × grain) — it cannot participate in ordered reasoning until it does`,
        { at: n.id, note: n.id, ...ctx(n) }));
    }
  }

  // The seed's regime boundary, disclosed at report: what is contested, and
  // what is out of its validity window, are named — never resolved, never
  // silently assumed still in force.
  const contestedNotes = new Set();
  for (const n of fold) {
    const disp = disputed.get(n.id) ?? [];
    const tag = workingTag(n, tasks.get(n.id), disp.length > 0, tags, queryTime);
    if (disp.length > 0) {
      contestedNotes.add(n.id);
      findings.push(finding("contested_open", "report", SEVERITY.WARN,
        `"${n.end1} —${n.label}→ ${n.end2}" is under an open contest (${disp.map((d) => d.source).join(", ")}) — route to landContest (contraction only), never resolve it`,
        { at: n.id, note: n.id, ...ctx(n) }));
    }
    if (tag.validity && tag.validity.open === false && !tag.inScope) {
      findings.push(finding("expired_out_of_scope", "report", SEVERITY.WARN,
        `"${n.end1} —${n.label}→ ${n.end2}" is out of its validity window at the query time — it fails the validity-window check before force or entrenchment is ever consulted`,
        { at: n.id, note: n.id, ...ctx(n) }));
    }
    if (n.witnesses?.length && (n.witnesses ?? []).every((w) => String(w).startsWith("testimony:")) && new Set(n.witnesses.map((w) => String(w).split("#")[0].split("~")[0])).size === 1) {
      findings.push(finding("testimony_only", "report", SEVERITY.INFO,
        `"${n.end1} —${n.label}→ ${n.end2}" rests on a single voice's testimony (${n.witnesses.join(", ")}) — an account, never corroboration`,
        { at: n.id, note: n.id, ...ctx(n) }));
    }
  }

  // The seed's section 4: two claims at one address that disagree are
  // resolved by the FIXED order, stop at the first rule that applies. The
  // linter runs the order and reports its outcome; a disagreement the order
  // routes to landContest but no dispute records, or ties it cannot break,
  // is a standing contradiction.
  const byAddress = new Map();
  for (const n of fold) {
    if (conceded.has(n.id)) continue;
    const key = addressOf(n);
    if (!byAddress.has(key)) byAddress.set(key, []);
    byAddress.get(key).push(n);
  }
  const oneValue = oneValueLookup(functional);
  const unjudged = new Set();
  for (const [address, group] of byAddress) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) for (let j = i + 1; j < group.length; j += 1) {
      const a = group[i], b = group[j];
      if (foldText(a.end2) === foldText(b.end2)) continue;
      const aDisputed = contestedNotes.has(a.id), bDisputed = contestedNotes.has(b.id);
      if (oneValue && !aDisputed && !bDisputed) {
        const standing = oneValue(a.label);
        if (standing === null) { unjudged.add(address); continue; }
        if (standing === "candidate") {
          findings.push(finding("candidate_conflict", "report", SEVERITY.WARN,
            `two live claims at "${address}" disagree (${a.end2} vs ${b.end2}); "${a.label}" is only a candidate one-value relation — unrefuted here, never given by a named giver — disclosed, never a conviction`,
            { at: `${a.id}+${b.id}`, ...ctx(a), ...ctx(b) }));
          continue;
        }
      }
      const aTag = workingTag(a, tasks.get(a.id), aDisputed, tags, queryTime);
      const bTag = workingTag(b, tasks.get(b.id), bDisputed, tags, queryTime);
      if (!aDisputed && !bDisputed && aTag.cell && bTag.cell && aTag.grain && bTag.grain) {
        const r = precedence({ tag: aTag, grain: aTag.grain }, { tag: bTag, grain: bTag.grain }, { queryTime, conditions });
        // A pair finding carries BOTH notes' holograph context — the two raw
        // spans and the resolved referents of each side, so a reader can open
        // either claim in the material.
        const pairCtx = { at: `${a.id}+${b.id}`, ...ctx(a), ...ctx(b) };
        if (r.reason === "tied") {
          findings.push(finding("standing_contradiction", "standard", SEVERITY.ERROR,
            `two live claims at "${address}" disagree (${a.end2} vs ${b.end2}) and no declared rule separates them — ${r.detail} — a caller-declared tiebreak or a landContest is required, never a silent pick`,
            pairCtx));
        } else if (r.reason === "validity_window") {
          const loser = r.winner === "a" ? b : a;
          findings.push(finding("expired_in_conflict", "standard", SEVERITY.ERROR,
            `at "${address}", precedence resolved by validity_window (the ${r.winner === "a" ? "second" : "first"} claim is out of its window) — the expired claim fails BEFORE force or entrenchment is consulted`,
            pairCtx));
        } else {
          const reason = r.reason === "force" ? "force (O beats default beats P)"
            : r.reason === "specificity" ? "specificity (lex specialis)"
            : r.reason === "recency" ? "recency (lex posterior)"
            : r.reason === "entrenchment" ? "entrenchment (grain as Spohn rank)" : r.reason;
          findings.push(finding("resolved_by_order", "standard", SEVERITY.INFO,
            `at "${address}", precedence resolved ${a.end2} vs ${b.end2} by ${reason} in favour of the ${r.winner === "a" ? "first" : "second"} claim`,
            pairCtx));
        }
      } else if (aDisputed || bDisputed) {
        // The seed's bug 3, live: a contested claim in a disagreement must
        // route to landContest, never be picked as the winner.
        findings.push(finding("contested_disagreement", "report", SEVERITY.WARN,
          `at "${address}", ${aDisputed ? a.end2 : b.end2} is under contest — precedence refuses to pick a winner here; route to landContest (contraction only)`,
          { at: `${a.id}+${b.id}`, ...ctx(a), ...ctx(b) }));
      }
    }
  }

  // A denial (cut) whose link carries no live dispute was heard but never
  // routed: the contest the seed says must be landed was not.
  for (const c of cuts) {
    const link = byId.get(c.link);
    if (link && !(disputed.get(link.id)?.length)) {
      findings.push(finding("unrouted_cut", "standard", SEVERITY.ERROR,
        `"${c.end1} —${c.label}→ ${c.end2}" was denied (cut) but no contest is on the record for the link — the denial was heard and dropped, exactly the silence the seed's section 5 forbids`,
        { at: c.id, note: link.id, ...ctx(link) }));
    }
  }

  // Derived products: a product resting on an expired or contested premise
  // is the seed's acceptance case at the composition tier. The ledger's own
  // `restsOn` already counts contested grounds (derivation.js); a product
  // that names no contested ground while standing on one claims a settled
  // base it does not have.
  for (const t of tasks.values()) {
    if (!t.derived || !t.premises?.length) continue;
    const restsOnContested = t.restsOn?.contested ?? 0;
    for (const pid of t.premises) {
      const premise = byId.get(pid);
      if (!premise) continue;
      const pDisputed = disputed.has(pid);
      const pTag = workingTag(premise, tasks.get(pid), pDisputed, tags, queryTime);
      if (pTag.validity && pTag.validity.open === false && !pTag.inScope) {
        findings.push(finding("expired_premise", "standard", SEVERITY.ERROR,
          `the derived product "${t.description ?? t.task_id}" rests on "${premise.end1} —${premise.label}→ ${premise.end2}", which is out of its validity window at the query time — the sunset clause had to expire it before it was built on`,
          { at: t.task_id, note: pid, ...ctx(premise) }));
      }
      if (pDisputed && restsOnContested === 0) {
        findings.push(finding("contested_premise", "standard", SEVERITY.ERROR,
          `the derived product "${t.description ?? t.task_id}" rests on the contested note "${premise.end1} —${premise.label}→ ${premise.end2}" and records no contested ground (restsOn.contested = 0) — it claims a settled base it does not have`,
          { at: t.task_id, note: pid, ...ctx(premise) }));
      }
    }
  }

  // Circularity (strict): a directed cycle in the claim graph is begging
  // the question — the claims justify each other in a loop.
  const cyc = findClaimCycle(fold.filter((n) => !conceded.has(n.id)));
  if (cyc) {
    // The cycle's notes, each with its own referents and raw spans — a
    // reader can open every leg of the loop in the material.
    const cycleNotes = fold.filter((n) => cyc.cycle.includes(foldText(n.end1)) || cyc.cycle.includes(foldText(n.end2)));
    findings.push(finding("circular", "strict", SEVERITY.ERROR,
      `the claim graph contains a directed cycle: ${cyc.cycle.join(" → ")} — the claims justify each other in a loop (begging the question)`,
      { at: cyc.edge?.id ?? cyc.cycle[0], ...(cycleNotes.length ? { notes: cycleNotes.map((n) => ({ ...ctx(n), id: n.id, claim: `${n.end1} —${n.label}→ ${n.end2}` })) } : {}) }));
  }

  const visible = findings.filter((f) => shownAt(f, strictness));
  return Object.freeze({
    ok: !visible.some((f) => f.severity === SEVERITY.ERROR),
    strictness,
    // How many live notes this lint actually examined — disclosed so an
    // "ok" over nothing can never pass for an "ok" over a ledger.
    read: fold.length,
    findings: Object.freeze(visible),
    counts: Object.freeze(countFindings(visible)),
    contested: Object.freeze([...contestedNotes]),
    // Addresses carrying several values that no one-value declaration covers:
    // seen, and deliberately not judged. Present only when declarations were supplied.
    ...(oneValue ? { unjudged: Object.freeze({ addresses: unjudged.size }) } : {}),
  });
}

const countFindings = (fs) => {
  const by = {};
  for (const f of fs) by[f.kind] = (by[f.kind] ?? 0) + 1;
  return by;
};

// ── the inference tier (strict) ────────────────────────────────────────────

/**
 * lintInferences(inferences, { licenses, verify, refute, strictness })
 * — a claim that is an INFERENCE ("therefore", "by the same reasoning",
 * a universal, a tautology) is the seed's R1 territory: structure never
 * licenses composition; only a named giver can. `licenses` is a Set of
 * `relation→yields` pairs a giver declared (e.g. ">→>" for transitivity of
 * order). `verify`/`refute` are the caller's injected oracles for
 * equation claims and universal claims respectively.
 *
 * `inferences` are DECLARED by the caller (the reading pipeline does not
 * classify "therefore" as an inference — the grammar lens refuses it, P56),
 * each: { kind, end1, label, end2, relation, yields, spans, ref } where
 * kind ∈ "deduction" | "same-reasoning" | "universal" | "vacuous" |
 * "equation".
 */
export async function lintInferences(inferences = [], { licenses = null, verify = null, refute = null, strictness = "standard" } = {}) {
  const findings = [];
  const licenceOf = typeof licenses === "function" ? licenses : (rel, yields) => licenses instanceof Set && licenses.has(`${rel}→${yields}`);
  // The oracle may be SYNC (the demo's hand-typed JS, the tests' stubs) or
  // ASYNC (lib/sympy-math-oracle.mjs — pyodide boots asynchronously). Await a
  // thenable so both work; a sync oracle's value passes through unchanged.
  const resolve = async (x) => (x && typeof x.then === "function" ? await x : x);
  for (const inf of inferences ?? []) {
    // An inference finding points at the claim's source ref AND, when the
    // caller declared raw spans, at those byte addresses into the material —
    // the holograph discipline applied to the inference tier.
    const at = inf.ref ?? inf.end1;
    const infSpans = (inf.spans ?? []).map((s) => s?.at ?? s?.ref ?? null).filter(Boolean);
    const atCtx = { at, ...(infSpans.length ? { spans: Object.freeze(infSpans) } : {}) };
    switch (inf.kind) {
      case "deduction":
      case "same-reasoning": {
        const licensed = licenceOf(inf.relation, inf.yields);
        if (!licensed) {
          findings.push(finding("unlicensed_inference", "strict", SEVERITY.ERROR,
            `"${inf.end1} ${inf.label} ${inf.end2}" composes ${inf.relation} into ${inf.yields ?? "…"} with no declared licence — structure never licenses composition; only a named giver can (R1)`,
            { ...atCtx }));
        } else {
          findings.push(finding("licensed_inference", "strict", SEVERITY.INFO,
            `"${inf.end1} ${inf.label} ${inf.end2}" is licensed (${inf.relation}→${inf.yields}) by a declared giver`,
            { ...atCtx }));
        }
        break;
      }
      case "universal": {
        if (typeof refute !== "function") break;
        const r = await resolve(refute(inf));
        if (r?.refuted) {
          findings.push(finding("universal_refuted", "standard", SEVERITY.ERROR,
            `"${inf.end1} ${inf.label} ${inf.end2}" claims to hold universally and a counterexample refutes it (${r.detail}) — refutation is a veto, never a licence, and here it vetoes`,
            { ...atCtx }));
        } else if (r?.detail) {
          findings.push(finding("universal_checked", "report", SEVERITY.INFO,
            `"${inf.end1} ${inf.label} ${inf.end2}" survived the declared counterexample search (${r.detail})`,
            { ...atCtx }));
        }
        break;
      }
      case "vacuous":
        findings.push(finding("vacuous_support", "report", SEVERITY.INFO,
          `"${inf.end1} ${inf.label} ${inf.end2}" justifies by a tautology (${inf.detail ?? "X = X"}) — the stated reason adds nothing the step does not already assert`,
          { ...atCtx }));
        break;
      case "equation": {
        if (typeof verify !== "function") break;
        const v = await resolve(verify(inf));
        if (v?.verdict === "false" || v?.ok === false) {
          findings.push(finding("claim_fails_oracle", "standard", SEVERITY.ERROR,
            `"${inf.statement ?? inf.end1}" — the material asserts it, the declared oracle refutes it (${v.detail})`,
            { ...atCtx }));
        } else if (v?.verdict === "ambiguous") {
          findings.push(finding("convention_dispute", "report", SEVERITY.INFO,
            `"${inf.statement ?? inf.end1}" — ${v.detail} — a convention, not a settled value`,
            { ...atCtx }));
        } else if (v?.verdict === "undefined") {
          findings.push(finding("undefined_claim", "standard", SEVERITY.ERROR,
            `"${inf.statement ?? inf.end1}" — ${v.detail}`,
            { ...atCtx }));
        } else if (v?.verdict === "holds") {
          findings.push(finding("claim_holds", "report", SEVERITY.INFO,
            `"${inf.statement ?? inf.end1}" — the declared oracle confirms it (${v.detail ?? "holds"})`,
            { ...atCtx }));
        } else if (v?.verdict === "unchecked") {
          // A claim the oracle cannot reach is a GAP, never a conviction: it
          // is disclosed and withheld, exactly the R19 posture (a verifier
          // that cannot compute the truth of a claim never guesses it).
          findings.push(finding("oracle_withheld", "report", SEVERITY.INFO,
            `"${inf.statement ?? inf.end1}" — the oracle cannot compute this claim (${v.detail}) — disclosed, never guessed`,
            { ...atCtx }));
        }
        break;
      }
      default:
        findings.push(finding("unknown_inference_kind", "report", SEVERITY.WARN,
          `an inference was declared with kind "${inf.kind}" — the linter knows deduction | same-reasoning | universal | vacuous | equation, never a guessed one`,
          { ...atCtx }));
    }
  }
  const visible = findings.filter((f) => shownAt(f, strictness));
  return Object.freeze({ ok: !visible.some((f) => f.severity === SEVERITY.ERROR), strictness, findings: Object.freeze(visible), counts: Object.freeze(countFindings(visible)) });
}

// ── content → EOT → holograph → lint ───────────────────────────────────────

/**
 * lintContent({ text, convert, source, makeLedger, frame, strictness, queryTime, tagsOf, conditions, verify, refute, licenses })
 * — the full door for NEW content or content the system itself generated.
 * `convert(text)` (the caller's reading pipeline, injected) returns
 * arrangements `{end1, label, end2, spans, witness, polarity?}` plus the
 * caller's declared `inferences`. `makeLedger()` builds a fresh notes/
 * hyperlexicon bundle (the caller's), the arrangements are admitted, and
 * both lints run over the resulting holograph.
 *
 * `tagsOf(id, note)` may supply the admission-time tag per note (the
 * seed's "tagged at admission, not reasoned about").
 */
export async function lintContent({ text, convert, source = "lint-source", makeLedger, frame = null, strictness = "standard", queryTime = Date.now(), conditions = [], tagsOf = null, verify = null, refute = null, licenses = null, taskLog = { projectTasks }, referentIndex = null, functional = null } = {}) {
  if (typeof convert !== "function" || typeof makeLedger !== "function")
    throw new TypeError("reasoning-lint.lintContent: convert (text → arrangements) and makeLedger (fresh notes bundle) are injected");
  const { arrangements = [], inferences = [] } = convert(String(text ?? ""), { source }) ?? {};
  const { door, log } = makeLedger({ frame });
  if (!door || !log) throw new TypeError("reasoning-lint.lintContent: makeLedger must return { door, log }");
  const tags = new Map();
  const admitted = door.admit ? door.admit(log, arrangements, { witness: source }) : { log, heard: [] };
  if (tagsOf) for (const h of admitted.heard ?? []) { const t = tagsOf(h.id, h); if (t) tags.set(h.id, t); }
  const ledger = lintLedger(admitted.log, { door, taskLog, tags, queryTime, conditions, strictness, referentIndex, functional });
  const inference = await lintInferences(inferences, { licenses, verify, refute, strictness });
  const findings = [...ledger.findings, ...inference.findings];
  return Object.freeze({
    ok: ledger.ok && inference.ok,
    strictness,
    findings: Object.freeze(findings),
    counts: Object.freeze(countFindings(findings)),
    ledger,
    inference,
    admitted: Object.freeze({ heard: admitted.heard ?? [], turnedAway: admitted.turnedAway ?? [] }),
  });
}

// ── the linter through time: fold the universe, compare the folds ──────────

/**
 * The identity a finding is compared on across cursors: kind × level ×
 * severity × the note/ref it points at — never the prose. A finding that
 * resolves a referent differently at a later fold is the SAME finding with
 * different context, not a new one (the holograph's own identity rule:
 * a node at cursor 500 may be two nodes at cursor 200).
 */
export const findingKey = (f) => `${f.kind}|${f.level}|${f.severity}|${f.note ?? f.at ?? ""}`;

/**
 * lintTimeline({ log, door, taskLog, cursors, strictness, tags, queryTime, conditions, referentIndex })
 * — the record folds at declared points; this lints EACH fold and reports
 * what changed between consecutive folds.
 *
 * `cursors` are seq positions (0..log.nextSeq) — the fold points to compare.
 * Default: every entry boundary (each hearing is a fold), capped by
 * MAX_FOLDS so a long ledger's timeline stays readable — the holograph's own
 * posture ("the fold condenses only the objects it is about"). Each fold is
 * `{entries: log.entries.slice(0, cursor)}` — the same log, walked to a
 * cursor, exactly as `projectTasks`-based reads already fold.
 *
 * Returns `folds` (one lint result per cursor, with its `cursor` and a
 * `signature`) and `transitions` (between consecutive folds: what APPEARED,
 * what RESOLVED, what PERSISTED) — so a reader can see the universe fold:
 * a contested note appears at the fold its dispute lands; a sunset expires
 * an obligation at the fold its window passes.
 */
export function lintTimeline({ log, door, taskLog, cursors = null, strictness = "standard", tags = new Map(), queryTime = Date.now(), conditions = [], referentIndex = null, functional = null, maxFolds = 40 } = {}) {
  if (!log?.entries?.length) return Object.freeze({ ok: true, strictness, folds: Object.freeze([]), transitions: Object.freeze([]) });
  const all = log.entries.map((e) => e.seq);
  const points = cursors && cursors.length
    ? cursors
    : all.length <= maxFolds ? all : all.filter((_, i) => i % Math.ceil(all.length / maxFolds) === 0).concat(all.at(-1));
  const folds = [];
  const seen = new Set();
  for (const cursor of points) {
    if (seen.has(cursor)) continue;
    seen.add(cursor);
    // A fold at cursor N is the state where the next write would be N: it
    // includes every entry with seq < N, never seq <= N. The holograph's own
    // rule — a query at a cursor sees the reading AS OF that point, not the
    // write that lands there. A caller passing `log.nextSeq` after a dispute
    // gets the dispute; a caller passing the pre-dispute `nextSeq` does not.
    const at = Object.freeze({ ...log, entries: Object.freeze(log.entries.filter((e) => e.seq < cursor)) });
    const lint = lintLedger(at, { door, taskLog, tags, queryTime, conditions, strictness, referentIndex, functional });
    folds.push(Object.freeze({ cursor, ...lint, signature: Object.freeze(lint.findings.map(findingKey)) }));
  }
  const key = (f) => findingKey(f);
  const transitions = [];
  for (let i = 1; i < folds.length; i += 1) {
    const prev = new Map(folds[i - 1].findings.map((f) => [key(f), f]));
    const now = new Map(folds[i].findings.map((f) => [key(f), f]));
    const appeared = folds[i].findings.filter((f) => !prev.has(key(f)));
    const resolved = folds[i - 1].findings.filter((f) => !now.has(key(f)));
    const persisted = folds[i].findings.filter((f) => prev.has(key(f)));
    transitions.push(Object.freeze({
      from: folds[i - 1].cursor, to: folds[i].cursor,
      appeared: Object.freeze(appeared),
      resolved: Object.freeze(resolved),
      persisted: Object.freeze(persisted),
      counts: Object.freeze({ appeared: appeared.length, resolved: resolved.length, persisted: persisted.length }),
    }));
  }
  return Object.freeze({ ok: folds.every((f) => f.ok), strictness, folds: Object.freeze(folds), transitions: Object.freeze(transitions) });
}

// ── the report ─────────────────────────────────────────────────────────────

/** One plain line per finding, grouped by severity — what a reader sees. */
export function lintReport(result) {
  const lines = [];
  const seen = new Set();
  for (const f of result?.findings ?? []) {
    if (seen.has(f.kind + f.detail)) continue;
    seen.add(f.kind + f.detail);
    lines.push(`  [${f.level}·${f.severity}] ${f.kind}: ${f.detail}`);
  }
  return lines;
}

export { FORCES };

// ── THE GFP CORE (2026-09-22) ──────────────────────────────────────────────
//
// User direction: "reasoning linting GFP at its core, and then SVO, SOV — all
// others — at higher holonic levels. Reason works at every level, respecting
// holons. It needs to work equally well for code." lintLedger above keys a
// claim by `end1|label` — the first word and the verb, English's own lens —
// and, with no declarations, convicts every same-address disagreement (its
// own comment measured 459 false convictions on 3,539 notes). This core
// reads claims as Ground · Figure · Pattern (kernel/gfp-claim.js):
//
//   IDENTITY  Pattern + Figure-by-role. Word order never enters: a claim read
//             back from SVO, SOV, VSO, VOS, OVS, OSV, a case-marked free
//             order, or code's infix / prefix / postfix is the same claim.
//   SCOPE     two claims meet only where their grounds overlap (one contains
//             the other). Sibling holons never meet — two sections, two
//             blocks, two functions each keep their own facts.
//   DEPTH     where grounds differ and overlap, the deeper claim is the more
//             specific (lex specialis): a "default" outer claim is OVERRIDDEN
//             inside the inner ground (a shadowed binding, a section's local
//             fact) — reported, never an error; a "strict" outer claim is
//             REFUTED by the inner counterexample (an invariant, a universal).
//   DECLARED  a relation is one-valued, symmetric or acyclic only when a giver
//             says so. An undeclared several-valued relation is counted as
//             unjudged, never convicted. A claim and its denial need no
//             declaration: P and not-P at one ground is always a contradiction.
//   ROLL-UP   every finding sits at a holon; each holon also counts what its
//             descendants found, so strain below is visible above.

const declSet = (xs, idf) => new Set([...(xs ?? [])].map((x) => idf(typeof x === "string" ? x : x?.rel)).filter(Boolean));
const functionalRoles = (xs, idf) => {
  const m = new Map();
  for (const x of xs ?? []) {
    const rel = idf(typeof x === "string" ? x : x?.rel);
    if (rel) m.set(rel, { role: (typeof x === "string" ? null : x?.role) ?? "ARG1", giver: typeof x === "string" ? null : x?.giver ?? null });
  }
  return m;
};
// Hoisted out of lintGfp (pure, no closure over its locals) so falsifyGfp
// below can print a claim the same way and tag a finding with the same two
// claim ids, without a second copy of either.
const claimLabel = (c) => `${c.polarity === "-" ? "not " : ""}${c.rel}(${Object.entries(c.roles).map(([k, v]) => `${k}=${v}`).join(", ")}) @ ${c.ground}`;
const claimIds = (a, b) => [a.id, b.id].filter(Boolean);

/**
 * lintGfp(claims, { functional, symmetric, acyclic, identity, strictness })
 *   claims      gfpClaim records (kernel/gfp-claim.js)
 *   functional  [{ rel, role = "ARG1", giver }] or [rel] — one value in `role`
 *   symmetric   [rel] — which role a participant holds does not matter
 *   acyclic     [rel] — a cycle in this relation is begging the question
 *   identity    referent identity (default exact — correct for code)
 * → { ok, findings, counts, unjudged, apart, holons, basis }
 */
export function lintGfp(claims = [], { functional = [], symmetric = [], acyclic = [], identityRels = [], identity = exactIdentity, strictness = "standard" } = {}) {
  // THE DOOR (2026-09-25, Kelsen's own finding on the thesis-synthesis
  // review: a lone EOGfpGeneralization@1 — kernel/gfp-claim.js's own
  // least-general-generalization record, built for arrange.js's thesis and
  // not yet bridged into this hierarchy — cleared this pass silently, and
  // one mixed among real claims threw an unhandled TypeError reading
  // .roles off a record that has none). Read every input by SCHEMA NAME,
  // not by duck-typing .rel/.roles, before anything below touches either.
  // A refused entry is disclosed, never silently dropped and never fatal to
  // the claims beside it — WARN, not ERROR: this door reports what is not
  // yet a claim here, it does not convict the set that is.
  const recognized = [], refused = [];
  for (const c of claims ?? []) (c?.schema === GFP_CLAIM_SCHEMA ? recognized : refused).push(c);
  const doorFindings = refused.map((c) => finding("not_a_claim", "report", SEVERITY.WARN,
    `an input is not ${GFP_CLAIM_SCHEMA} (schema: ${c?.schema ?? typeof c}) — refused at the door, not linted, not counted toward ok`, {}));
  claims = recognized;
  // IDENTITY IS ITSELF A CLAIM. A relation declared an identity ("same-as")
  // merges its two participants — but only where that claim's ground reaches
  // (Parmenides' `same`, scoped): an alias stated in one section does not
  // merge two names in a sibling. The base identity (exact, caseless, or a
  // referent resolver) runs first; the declared identities join on top.
  const baseIdf = identity;
  const idRels = declSet(identityRels, baseIdf);
  const idClaims = [...claims].filter((c) => c.polarity === "+" && idRels.has(baseIdf(c.rel)) && c.roles.ARG0 != null && c.roles.ARG1 != null);
  const ufCache = new Map();
  const identityAt = (h) => {
    if (!idClaims.length) return baseIdf;
    if (ufCache.has(h)) return ufCache.get(h);
    const parent = new Map();
    const find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
    for (const c of idClaims) if (contains(c.ground, h)) {
      const a = find(baseIdf(c.roles.ARG0)), b = find(baseIdf(c.roles.ARG1));
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
    }
    const f = (s) => find(baseIdf(s));
    ufCache.set(h, f);
    return f;
  };
  const idf = baseIdf;
  const fn = functionalRoles(functional, idf);
  const sym = declSet(symmetric, idf);
  const acy = declSet(acyclic, idf);
  const findings = [...doorFindings];
  let unjudged = 0, apart = 0;
  const cs = [...claims];
  const byRel = new Map();
  for (const c of cs) {
    if (idRels.has(idf(c.rel))) continue;
    const r = idf(c.rel);
    if (!byRel.has(r)) byRel.set(r, []);
    byRel.get(r).push(c);
  }
  const label = claimLabel;
  const ids = claimIds;

  for (const [rel, group] of byRel) {
    const symmetricRel = sym.has(rel);
    const one = fn.get(rel) ?? null;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      if (!overlap(a.ground, b.ground)) { apart++; continue; }
      const sameGround = a.ground === b.ground;
      const [outer, inner] = depthOf(a.ground) <= depthOf(b.ground) ? [a, b] : [b, a];
      const at = lca(a.ground, b.ground);
      const idh = identityAt(at);
      const scoped = (conflictKind, what) => {
        if (sameGround) {
          findings.push({ ...finding(conflictKind, "standard", SEVERITY.ERROR, `${what}: ${label(a)} vs ${label(b)} — same ground, and nothing separates them`, { at }), claims: ids(a, b) });
        } else if (outer.force === "strict") {
          findings.push({ ...finding("refuted_in_scope", "standard", SEVERITY.ERROR, `${label(outer)} is declared strict — it holds throughout ${outer.ground} — and ${label(inner)} inside it is a counterexample`, { at }), claims: ids(a, b) });
        } else {
          findings.push({ ...finding("overridden_in_scope", "report", SEVERITY.INFO, `${label(inner)} overrides ${label(outer)} inside ${inner.ground} — the deeper ground is the more specific (lex specialis), and the outer claim is a default`, { at }), claims: ids(a, b) });
        }
      };
      // P and not-P: no declaration needed.
      if (a.polarity !== b.polarity && claimKey(a, { symmetric: symmetricRel, identity: idh }) === claimKey(b, { symmetric: symmetricRel, identity: idh })) {
        scoped("polarity_contradiction", "a claim and its denial");
        continue;
      }
      // Two values in a role a giver declared one-valued.
      if (a.polarity === "+" && b.polarity === "+") {
        const role = one?.role ?? "ARG1";
        const va = a.roles[role], vb = b.roles[role];
        if (va == null || vb == null || idh(va) === idh(vb)) continue;
        if (figureKey(a, { omit: role, symmetric: symmetricRel, identity: idh }) !== figureKey(b, { omit: role, symmetric: symmetricRel, identity: idh })) continue;
        if (!one) { unjudged++; continue; }
        scoped("standing_contradiction", `"${a.rel}" is one-valued in ${role}${one.giver ? ` (giver: ${one.giver})` : ""}, and two values stand`);
      }
    }
  }

  // Cycles, per declared-acyclic relation, per scope (a holon sees its own
  // claims and its ancestors', never a sibling's).
  const grounds = [...new Set(cs.map((c) => c.ground))];
  const seenCycles = new Set();
  for (const rel of acy) {
    for (const h of grounds) {
      const scope = (byRel.get(rel) ?? []).filter((c) => c.polarity === "+" && contains(c.ground, h));
      const adj = new Map();
      for (const c of scope) {
        const from = c.roles.ARG0 != null ? idf(c.roles.ARG0) : null, to = c.roles.ARG1 != null ? idf(c.roles.ARG1) : null;
        if (!from || !to) continue;
        if (!adj.has(from)) adj.set(from, []);
        adj.get(from).push({ to, c });
      }
      const color = new Map(), path = [], edges = [];
      let found = null;
      const dfs = (v) => {
        color.set(v, 1); path.push(v);
        for (const e of adj.get(v) ?? []) {
          const k = color.get(e.to) ?? 0;
          if (k === 1) { const s = path.indexOf(e.to); found = { nodes: path.slice(s).concat(e.to), edges: [...edges.slice(s), e.c] }; return true; }
          if (k === 0) { edges.push(e.c); if (dfs(e.to)) return true; edges.pop(); }
        }
        path.pop(); color.set(v, 2); return false;
      };
      for (const v of adj.keys()) if (!color.get(v) && dfs(v)) break;
      if (!found) continue;
      const key = `${rel}|${[...new Set(found.nodes)].sort().join(",")}`;
      if (seenCycles.has(key)) continue;
      seenCycles.add(key);
      const at = found.edges.map((c) => c.ground).reduce((x, y) => lca(x, y));
      findings.push({ ...finding("circular", "strict", SEVERITY.ERROR, `"${rel}" is declared acyclic, and it returns to its start: ${found.nodes.join(" → ")} — the chain begs the question`, { at }), claims: found.edges.map((c) => c.id).filter(Boolean) });
    }
  }

  const visible = findings.filter((f) => shownAt(f, strictness));
  // Roll-up: every holon counts its own findings and its descendants'.
  const holonSet = new Set();
  for (const g of grounds) for (const h of ancestry(g)) holonSet.add(h);
  const holons = [...holonSet].sort((x, y) => depthOf(x) - depthOf(y) || (x < y ? -1 : 1)).map((h) => ({
    at: h,
    own: visible.filter((f) => f.at === h).length,
    below: visible.filter((f) => f.at !== h && contains(h, f.at)).length,
    errors: visible.filter((f) => contains(h, f.at) && f.severity === SEVERITY.ERROR).length,
  }));
  return Object.freeze({
    ok: !visible.some((f) => f.severity === SEVERITY.ERROR),
    strictness,
    findings: Object.freeze(visible),
    counts: Object.freeze(countFindings(visible)),
    unjudged, apart,
    holons: Object.freeze(holons),
    basis: Object.freeze({
      core: "GFP — Ground (holon scope) · Figure (participants by role) · Pattern (relation, polarity, declarations); word order never read",
      identity: identity === exactIdentity ? "exact after NFKC (code-safe; pass caselessIdentity or a referent resolver for prose)" : "caller-declared",
      declared: { functional: fn.size, symmetric: sym.size, acyclic: acy.size, identity: idRels.size },
    }),
  });
}

// ── FALSIFICATION: was the "strict" force ever actually exercised? ─────────
//
// lintGfp above answers one question: do the claims it was HANDED agree with
// each other. That is coherence over what's given — and THE-NULL-STATES.md
// names exactly the failure shape a coherence-only check falls into: "the
// meta-null is the one to fear... a wall that is a comment... found only by
// asking whether the wall was ever reached." A force:"strict" claim that no
// sibling happens to contradict reads as clean, but clean here can mean
// "nothing was in the room to disagree" as easily as "this was tried and
// held" — and lintGfp's own output cannot tell those two apart.
//
// This is the SAME move `organs/ground-cite.js::polarityControl` already
// made today for a claim's GROUND (pair the claim's own denial against a
// same-shaped non-denying control, and trust the guard only when they
// disagree), carried from the citation layer into the reasoning core itself:
// for every force:"strict" claim, build the NARROWEST synthetic counter-
// example that claim's OWN declared property (functional or acyclic) would
// license — a second value in a declared one-valued role, the reverse edge
// of a declared acyclic relation — at the SAME ground, and rerun lintGfp
// with it added to the real claim set. Caught: the declared property that
// makes this claim "strict" is reachable HERE, for THIS claim, not just in
// the abstract. Not caught: nothing declared would have caught a violation
// of it — "strict" was asserted, never enforced, disclosed rather than
// silently trusted. No probe can be built at all: disclosed as that too,
// never folded into "unreachable" (a null names what was looked at, THE-
// NULL-STATES.md's first law — "no property to test" and "tested and the
// guard didn't fire" are different facts about the run).
//
// SCOPE, DISCLOSED. Only polarity:"+" strict claims are probed. A strict
// DENIAL's most direct counterexample is its own affirmation at the same
// ground — which the unconditional "P and not-P" rule (above) always
// catches regardless of any declaration, so probing it would report
// "reachable" on every single one, for free, telling a reader nothing.
// Symmetric declarations are not probed either: symmetry changes which
// claims COMPARE as equal, not which comparisons raise an error, so there
// is no violation-shaped counterexample to build from it alone. Neither
// omission is a defeat of this check; both are outside what a "reachable
// guard" question can even mean for that declaration.
//
// The probe never mutates the caller's own claims or `opts` — it adds one
// synthetic claim, force:"default" (it must never itself be strict enough
// to recurse into this same check), id-tagged so it can never collide with
// a real claim, and discarded after the one comparison it exists for.
const FALSIFY_PROBE_TAG = "⁣eo-falsify-probe⁣"; // U+2063 INVISIBLE SEPARATOR on both sides: survives NFKC/trim/lowercase unchanged (verified), and is not a character a person or a model would plausibly type, so it can never collide with real material
const probeValue = (v) => `${v}${FALSIFY_PROBE_TAG}`;

/**
 * falsifyGfp(claims, { functional, symmetric, acyclic, identityRels, identity, strictness })
 * — same options as lintGfp. → { ok, findings, counts }. `ok` is always
 * true: this reports what it found, it never convicts (THE-NULL-STATES.md's
 * fourth law) — a claim whose guard turned out unreachable is a disclosure
 * for the reasoner to act on, not itself a contradiction in the claim set.
 */
export function falsifyGfp(claims = [], { functional = [], symmetric = [], acyclic = [], identityRels = [], identity = exactIdentity, strictness = "standard" } = {}) {
  const idf = identity;
  const fn = functionalRoles(functional, idf);
  const acy = declSet(acyclic, idf);
  const opts = { functional, symmetric, acyclic, identityRels, identity, strictness: "strict" };
  // Every finding kind below is a WARN or an INFO, never an ERROR: this
  // pass reports on the checker's own reach, and must never be the thing
  // that flips a caller's `ok` (cli/reason.mjs's coverage gate reads `ok`
  // to decide whether a turn's files are covered) — exactly the severity
  // `ground_unreachable_guard` already holds one register over, for the
  // same reason.
  const errorCountOf = (r) => r.findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const baseErrors = errorCountOf(lintGfp(claims, opts));

  const findings = [];
  for (const c of claims) {
    // Strict is the only force this check has anything to ask about (see
    // header); an ordinary "default" claim was never asserted to hold
    // against a counterexample, so there is no guard to ask whether it
    // is reachable.
    if (c.force !== "strict" || c.polarity !== "+") continue;
    const rel = idf(c.rel);
    const oneValue = fn.get(rel) ?? null;
    const acyclicDeclared = acy.has(rel);
    const probes = [];
    if (oneValue) {
      const role = oneValue.role ?? "ARG1";
      const orig = c.roles[role];
      // A claim that never populates the very role its relation is
      // declared one-valued in has nothing for THIS check to mutate —
      // disclosed below as "no probe", the same as an undeclared relation,
      // never silently skipped without saying why.
      if (orig != null) {
        probes.push({ kind: "one-valued", via: `"${c.rel}" declared one-valued in ${role}`, claim: gfpClaim({
          ground: c.ground, rel: c.rel, force: "default", polarity: "+",
          roles: { ...c.roles, [role]: probeValue(orig) },
          id: `${c.id ?? "claim"}~falsify-probe-fn`,
        }) });
      }
    }
    if (acyclicDeclared && c.roles.ARG0 != null && c.roles.ARG1 != null && idf(c.roles.ARG0) !== idf(c.roles.ARG1)) {
      probes.push({ kind: "acyclic", via: `"${c.rel}" declared acyclic`, claim: gfpClaim({
        ground: c.ground, rel: c.rel, force: "default", polarity: "+",
        roles: { ARG0: c.roles.ARG1, ARG1: c.roles.ARG0 },
        id: `${c.id ?? "claim"}~falsify-probe-cyc`,
      }) });
    }
    if (!probes.length) {
      findings.push({ ...finding("strict_guard_untested", "standard", SEVERITY.WARN,
        `${claimLabel(c)} is declared "strict", but "${c.rel}" carries no declared one-valued role or acyclic property THIS claim actually populates — no counterexample could be built to test what makes it strict`,
        { at: c.ground }), claims: [c.id].filter(Boolean) });
      continue;
    }
    for (const probe of probes) {
      // The comparison is a count DELTA against the real claim set (never
      // the probe run alone, which is exactly falsifyGfp's fix for the old
      // ants loop's isolation bug — a lone claim can never contradict
      // itself). Adding one non-identity claim only ever ADDS pairwise/
      // cycle comparisons already in `claims`, never removes one (they read
      // the same `byRel` groups either way), so any rise in error count is
      // attributable to the probe and nothing upstream of it.
      const afterErrors = errorCountOf(lintGfp([...claims, probe.claim], opts));
      const caught = afterErrors > baseErrors;
      findings.push({ ...finding(caught ? "strict_guard_reachable" : "strict_guard_unreachable", "standard", caught ? SEVERITY.INFO : SEVERITY.WARN,
        caught
          ? `${claimLabel(c)}: a synthetic ${probe.kind} counterexample at the same ground is caught — ${probe.via}, and that declaration is reachable for this claim, not just declared in the abstract`
          : `${claimLabel(c)} is declared "strict" — ${probe.via} — but a synthetic counterexample built from exactly that declaration was NOT caught here. Its "strict" force is asserted, not enforced by anything this run declared; read the earlier clean verdict as untested, never confirmed`,
        { at: c.ground }), claims: [c.id, probe.claim.id].filter(Boolean) });
    }
  }
  const visible = findings.filter((f) => shownAt(f, strictness));
  return Object.freeze({
    ok: true, // disclosure only, per THE-NULL-STATES.md's fourth law — see header
    strictness,
    findings: Object.freeze(visible),
    counts: Object.freeze(countFindings(visible)),
  });
}

/**
 * lintLedgerGfp(log, { door, groundOf, ...lintGfp options }) — the same GFP
 * core over a notes ledger: each live note becomes a claim (end1 → ARG0,
 * end2 → ARG1, the reader's own role assignment), grounded where `groundOf`
 * says (default: the note's own `ground`, else the whole).
 */
export function lintLedgerGfp(log, { door, groundOf = null, ...opts } = {}) {
  const notes = foldOf(door, log);
  const claims = notes.map((n) => claimFromTriple(n.end1, n.label, n.end2, {
    ground: (groundOf ? groundOf(n) : null) ?? n.ground ?? "/",
    polarity: n.polarity === "-" ? "-" : "+",
    id: n.id,
  }));
  return lintGfp(claims, opts);
}
