// metacognition.js — watching the surprise between what S1 and S2 generate,
// fed forward as a learnable, repeatable, revisable standing. Pure; the
// append-only substrate (task-log) is injected, the cast.js pattern.
//
// THE ASK, verbatim: "the watching of surprise between what system one and
// system two generating affecting the surf and fold in ways that are
// learnable, repeatable, revisable." Framed, at the asker's own direction,
// "as Friston but visited by the Ramakrishna" — both readings earn their
// place below because each corrects a failure mode the other one alone
// produces, not as decoration.
//
// THE FRISTON HALF. Active inference treats a generative pass's prediction
// against a checked one as an error signal whose PRECISION (how much to
// trust this channel) is itself learned from repeated exposure, not
// hand-tuned once. `twoPassTurn` (app.js) already runs the two passes this
// needs: S1 (`runFastPass`) drafts fast and unchecked, S2 (`holonicTurn`,
// carrying `priorPass: s1Text`) checks it against real material. What
// neither pass does today is WATCH the gap between them as a standing,
// reusable fact about how much a given kind of S1 claim is worth trusting —
// every turn starts that question from zero. This file is the watcher:
// `assessAgreement` classifies the gap per turn, and the ledger below
// accumulates it into a precision reading per declared "cell" — Friston's
// own move, aimed at this repo's own two-pass architecture instead of at a
// perceptual hierarchy.
//
// THE FAILURE FRISTON ALONE PRODUCES, AND THE GUARD AGAINST IT. A pure
// surprise-minimizer is the dark-room problem: an agent that only ever
// scores "was I surprised" is incentivized toward never saying anything
// checkable, because silence can never be corrected. `assessAgreement`
// returns an all-zero profile for a turn where `extractCheckableAtoms`
// found nothing in S1's draft, and `observe` (below) is a STRUCTURAL NO-OP
// on an all-zero profile — reusing `hyperlexicon.js::hear`'s own rule
// verbatim ("a re-sighting that teaches nothing appends nothing"). A run of
// nothing-but-silent turns cannot move a cell's standing in EITHER
// direction; `metacognition.test.mjs` pins this as its own named
// regression, not an incidental property.
//
// THE RAMAKRISHNA HALF. The second failure Friston-alone invites is subtler
// than the dark room: collapsing every S1≠S2 delta into one "prediction
// error" bucket punishes a model for saying something true-but-unconfirmed
// exactly as hard as for saying something false. Ramakrishna's own
// insistence — direct, sought encounter with what the ground did not
// already contain, and the doctrine that more than one real path can stand
// (he practiced Vedantic, Tantric, Islamic and Christian sadhanas in turn
// and found each genuine) rather than forcing every divergence toward a
// single verdict — is the correction this file draws on: `classifyAtom`
// keeps a checked-but-unconfirmable claim (this repo's own `unbound` /
// `beyond-reach` / `unheard`, or a plain containment miss with no relation
// edge either way) in its OWN bucket, UNRESOLVED, which never counts as
// CORRECTED and never counts as CONFIRMED. This is not a new rule — it is
// this file's own constitutional statement (the grounding-ladder section,
// CLAUDE.md) applied a second time in the same direction it was first
// written: "a checking organ may say 'I have nothing to compare this
// against', or 'I compared it and it failed'. It may never manufacture the
// second out of the first." That line already forbids turning absence into
// conviction; this file additionally forbids turning absence into
// acquittal — an unconfirmed claim is not thereby confirmed either.
//
// bhavamukha — the Ramakrishna tradition's name for the sill a realized
// witness returns to, neither dissolved into undifferentiated absorption
// (never checking — pure S1 forever) nor lost in unexamined multiplicity
// (never trusting anything — pure S2 forever, at S2's own cost) — is the
// shape `concede` gives the ledger. A standing here is never a verdict
// about the WORLD (see "Stance on the admission record, sedimented",
// CLAUDE.md: "these are always defeasible assertions of the reader, the
// structure of their cognition, not anything allegedly in the world"); it
// is this instrument's own belief about its own reliability on a kind of
// claim, and `concede` is how that belief is revised OUT LOUD — landed as
// EVIDENCE·REC, mirroring `grid.js::concedeEvaluation` field for field —
// rather than left to drift silently as new observations accumulate.
//
// WHAT THIS FILE DOES NOT DO, disclosed rather than implied. The atom<->edge
// match (`sharesToken`, below) is bare case-folded token overlap — no
// referent identity (cast.js's own machinery answers "is this the same
// name," and is not reached for here; the same disclosed-heuristic posture
// P31's `numberCompany` shipped at its own first cut, before two more
// iterations earned a better one). The ledger's "cell" is a bare
// caller-declared string; this file has no opinion on the right taxonomy
// (a grid cell via the engine's own `cellOf`, a relation's own verb, a
// question's declared shape — the caller's domain decides, the same
// "caller decides what belongs" rule `hyperlexicon.js::recipeId` already
// states). `surfWeight` is consumed live through `escalationFor` (flow #2 —
// app.js widens the preflight and the correction budget on a contested
// standing, gated to the same S1/S2 channel the evidence came from);
// `forcesFoldRefresh` remains a pure, unwired signal — see
// `metacognition-integration-note.md` for what its call site would need.
//
// Generality (P71): the four-way classification composes existing
// medium-general primitives (`checkGrounding`'s containment check, and this
// repo's own five-verdict relation vocabulary) with no domain-specific
// logic of its own, and `WITNESS_FLOOR` is REUSED — not re-derived a fourth
// time — from `asserted.js`, which already earned it independently from
// `emergence/activation.js`'s cue gate and `emergence/binding.js`'s
// arrivals floor. That much is universal in shape. What is NOT yet done,
// stated plainly rather than assumed: no cross-domain replay and no
// falsification case (P71's other two checks) have been run against the
// LEDGER half — whether the learned precision reading actually moves an
// outcome, on material this file's own design never saw, is real,
// unattempted future work, named here so it is not later claimed as done.

import { checkGrounding, extractCheckableAtoms } from "../organs/grounding.js";
import { WITNESS_FLOOR } from "../organs/asserted.js";
import { tokenize } from "../organs/source.js";
import { SURPRISE_ALPHA, SURPRISE_DRAWS, SURPRISE_SEED, SURPRISE_WINDOW } from "./reflex.js";

export { WITNESS_FLOOR };

/** The four-way verdict a checked claim can land at. Closed class. */
export const AGREEMENT = Object.freeze({
  CONFIRMED: "confirmed",
  CORRECTED: "corrected",
  EXTENDED: "extended",
  UNRESOLVED: "unresolved",
});

/** Relation-tier verdicts this file reads as CORRECTED — real, positive,
 * material disagreement. Every other relation verdict this repo issues
 * (`bound` aside) is a disclosed LIMIT of the reading, never a conviction —
 * see this file's own header and `hypergraph.js`'s own five-verdict
 * vocabulary (CLAUDE.md, "The grounding ladder"). */
const CONTRADICTING_VERDICTS = new Set(["contradicted"]);
const CONFIRMING_VERDICTS = new Set(["bound"]);
const UNRESOLVING_VERDICTS = new Set(["unbound", "beyond-reach", "unheard"]);

const foldToken = (t) => String(t ?? "").trim().toLowerCase();

/** Every content token an edge carries, folded. Bare, disclosed heuristic —
 * see this file's own header on why this is not referent identity. */
function edgeTokens(edge) {
  return new Set(
    [edge?.subject, edge?.verb, edge?.object]
      .flatMap((s) => String(s ?? "").split(/\s+/))
      .map(foldToken)
      .filter(Boolean),
  );
}

/** Does this atom share at least one content token with this edge? OR-
 * matched deliberately (P31's own reasoning, reused): widening what counts
 * as "the same claim" can only make the match MORE permissive, never
 * fabricate a connection a stricter rule would have refused. */
function sharesToken(atom, edge) {
  const tokens = edgeTokens(edge);
  return (atom?.absent ?? atom?.tokens ?? []).some((t) => tokens.has(foldToken(t)));
}

/**
 * classifyAtom(atom, {groundingReport, relationEdges}) — one S1 claim,
 * checked against S2's material.
 *
 * Order of evidence, strongest first: a relation edge sharing a token with
 * this atom decides it outright (CORRECTED on `contradicted`, CONFIRMED on
 * `bound`, UNRESOLVED on any of `unbound`/`beyond-reach`/`unheard` — never
 * CORRECTED, per this file's own header). With no matching edge, the
 * containment check alone decides — but only ever between CONFIRMED
 * (present) and UNRESOLVED (absent); a bare containment miss is NEVER
 * CORRECTED, because `checkGrounding` answers "is this in the passages
 * shown," not "does the material disagree" — the exact distinction this
 * repo's own constitutional statement already draws (this file's header).
 */
export function classifyAtom(atom, { groundingReport = null, relationEdges = [] } = {}) {
  for (const edge of relationEdges) {
    if (!sharesToken(atom, edge)) continue;
    if (CONTRADICTING_VERDICTS.has(edge.verdict)) return AGREEMENT.CORRECTED;
    if (CONFIRMING_VERDICTS.has(edge.verdict)) return AGREEMENT.CONFIRMED;
    if (UNRESOLVING_VERDICTS.has(edge.verdict)) return AGREEMENT.UNRESOLVED;
  }
  if (!groundingReport || !groundingReport.examined) return AGREEMENT.UNRESOLVED;
  const missed = groundingReport.findings.some((f) => f.start === atom.start && f.text === atom.text);
  return missed ? AGREEMENT.UNRESOLVED : AGREEMENT.CONFIRMED;
}

/**
 * assessAgreement(s1Text, {question, s2Passages, relationEdges}) — the
 * turn-level watcher. `s2Passages` is optional (checkGrounding's own
 * `examined: false` posture at zero passages is preserved, never smoothed
 * into a guess); `relationEdges` is optional and, when supplied, is the
 * CALLER'S already-computed read (`hypergraph.js`'s real edges, or a
 * fixture shaped like them) — this file runs no extraction of its own.
 *
 * `extended` is a SEPARATE axis from the four atom verdicts, not a fifth
 * one: it names material S2's own edges bear out that S1's draft never
 * touched at all (an edge sharing no token with ANY S1 atom) — real ground
 * gained, not a claim graded. Kept apart from `counts.confirmed/corrected`
 * so a caller cannot accidentally fold "S2 said more" into "S1 was right."
 */
export function assessAgreement(s1Text, { question = "", s2Passages = null, relationEdges = [] } = {}) {
  const atoms = extractCheckableAtoms(s1Text, { question });
  const groundingReport = s2Passages?.length ? checkGrounding(s1Text, s2Passages, { question }) : null;

  const graded = atoms.map((atom) => ({
    ...atom,
    verdict: classifyAtom(atom, { groundingReport, relationEdges }),
  }));

  const extended = relationEdges.filter(
    (edge) => CONFIRMING_VERDICTS.has(edge.verdict) && !atoms.some((atom) => sharesToken(atom, edge)),
  );

  const counts = { confirmed: 0, corrected: 0, unresolved: 0, extended: extended.length };
  for (const a of graded) {
    if (a.verdict === AGREEMENT.CONFIRMED) counts.confirmed += 1;
    else if (a.verdict === AGREEMENT.CORRECTED) counts.corrected += 1;
    else counts.unresolved += 1;
  }

  return {
    atoms: graded,
    extended,
    counts,
    examined: groundingReport?.examined ?? (relationEdges.length > 0),
  };
}

/**
 * makeMetacognition(taskLog) — the ledger factory. `taskLog` is the
 * native `kernel/task-log.js` module (or the legacy provider's equivalent
 * shape), injected — the cast.js pattern this whole repo holds to, so this
 * file stays pure and its tests can hand it the real organ by relative
 * path without this module ever importing an engine directly.
 */
export function makeMetacognition(taskLog) {
  const { createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS } = taskLog;

  const createLedger = () => createTaskLog();

  const ZERO = { confirmed: 0, corrected: 0, unresolved: 0, extended: 0 };
  const cellOf = (log, cell) => projectTasks(log).find((t) => t.task_id === cell) ?? null;

  /**
   * observe(log, {cell, delta}) — one turn's own `assessAgreement().counts`
   * folded into the cell's running tally. `delta` is summed onto the prior
   * counts (never unioned the way `hyperlexicon.js::hear` unions witnesses —
   * disclosed difference, stated because it costs something to get wrong:
   * two sightings of the SAME fact are one fact restated, so hyperlexicon
   * unions; two TURNS are two independent trials of "was S1 right this
   * time," and both must count, so this sums).
   *
   * AN ALL-ZERO DELTA IS A STRUCTURAL NO-OP — this file's own dark-room
   * guard, and the same rule `hear()` already established for exactly this
   * shape of question ("a re-sighting that teaches nothing appends
   * nothing"). A turn where S1 said nothing checkable consumes no seq and
   * moves no standing, in either direction.
   */
  function observe(log, { cell, delta } = {}) {
    if (typeof cell !== "string" || !cell.trim()) {
      throw new TypeError("observe: cell is declared — this file has no opinion on the right taxonomy, see its own header");
    }
    const d = { ...ZERO, ...delta };
    if (!d.confirmed && !d.corrected && !d.unresolved && !d.extended) return log;
    const prior = cellOf(log, cell);
    const priorCounts = prior?.counts ?? ZERO;
    const counts = {
      confirmed: priorCounts.confirmed + d.confirmed,
      corrected: priorCounts.corrected + d.corrected,
      unresolved: priorCounts.unresolved + d.unresolved,
      extended: priorCounts.extended + d.extended,
    };
    return append(log, {
      kind: prior ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.PROPOSE,
      task_id: cell,
      operator: prior ? "SYN" : "INS",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: "Figure",
      description: prior ? `observed again: ${cell}` : `first observed: ${cell}`,
      counts,
    });
  }

  /**
   * standingOf(log, cell) — the LEARNED, phrased-honestly reading. Never
   * finer than the counts support (this repo's own "may never phrase finer
   * than the arm's own resolution" rule, `asserted.js`'s own
   * `assertionPhrase` and the kinds-arm's `finestRank` both hold the same
   * line): no percentage, ever — natural-frequency counts only, and no
   * verdict at all below `WITNESS_FLOOR` observations, the SAME structural
   * floor `asserted.js` and, independently, `emergence/activation.js`'s cue
   * gate and `emergence/binding.js`'s arrivals minimum already earned.
   *
   * `unresolved` and `extended` are disclosed on every reading but never
   * enter `total` — a cell this instrument has only ever seen S1 dodge or
   * S2 extend stays `unproven` forever, which is correct: nothing has yet
   * TESTED whether S1 can be trusted here.
   */
  function standingOf(log, cell) {
    const t = cellOf(log, cell);
    const counts = t?.counts ?? ZERO;
    const total = counts.confirmed + counts.corrected;
    if (total < WITNESS_FLOOR) {
      return {
        cell,
        standing: "unproven",
        ...counts,
        total,
        phrase: total === 0
          ? "never checked against S2"
          : `checked only ${total} time(s) — fewer than ${WITNESS_FLOOR} is not enough to say`,
      };
    }
    if (counts.corrected === 0) {
      return {
        cell,
        standing: "established",
        ...counts,
        total,
        phrase: `confirmed ${counts.confirmed} of ${total} time(s) checked`,
      };
    }
    return {
      cell,
      standing: "contested",
      ...counts,
      total,
      phrase: `confirmed ${counts.confirmed} of ${total}, corrected ${counts.corrected}`,
    };
  }

  /**
   * concede(log, cell, {trigger}) — REC. Mirrors `grid.js::concedeEvaluation`
   * field for field (same entry shape, same two refusals), applied to a
   * standing instead of an evaluate act. Lands a record of the REVISION
   * itself — bhavamukha's own discipline, this file's header — never a
   * silent drift as new observations accumulate. Landing a concede does
   * NOT reset `counts`; a caller that wants a clean slate calls this AND
   * starts observing fresh under a NEW cell name, so the old cell's full
   * history — the standing that was conceded, and why — stays on the log,
   * append-only, exactly as every other REC in this repo keeps the past.
   */
  function concede(log, cell, { trigger } = {}) {
    if (!cellOf(log, cell)) {
      return { ok: false, refusal: { type: "target_not_found", target: cell, detail: `"${cell}" has no observations on this ledger — nothing to concede` } };
    }
    if (typeof trigger !== "string" || !trigger.trim()) {
      return { ok: false, refusal: { type: "no_trigger", detail: "concede: a revision records its own reason as `trigger` — never a silent concession" } };
    }
    const priorStanding = standingOf(log, cell);
    return {
      ok: true,
      priorStanding,
      log: append(log, {
        kind: ENTRY_KINDS.EVIDENCE,
        task_id: `${cell}:rec:${log.nextSeq}`,
        description: `re-zero: ${trigger}`,
        operator: "REC",
        operator_basis: OPERATOR_BASIS.PRODUCED,
        grain: "Figure",
        concedes: cell,
        trigger,
        priorStanding,
      }),
    };
  }

  /** Every cell this ledger has ever observed, most-observed first — the
   * same "cut the least corroborated, not the most recent" rule
   * `hyperlexicon.js::foldHyperlexicon` already holds, applied to trials
   * instead of witnesses. */
  function foldLedger(log) {
    return projectTasks(log)
      .filter((t) => t.counts)
      .map((t) => standingOf(log, t.task_id))
      .sort((a, b) => b.total - a.total || a.cell.localeCompare(b.cell));
  }

  return { createLedger, observe, standingOf, concede, foldLedger };
}

// ── surf / fold signals ─────────────────────────────────────────────────
//
// Pure functions over a `standingOf`/`assessAgreement` reading. UNWIRED —
// see this file's own header and `metacognition-integration-note.md` for
// exactly where a live call site would read them.

/**
 * surfWeight(standing) — Friston's precision-weighting, read as a retrieval
 * multiplier. A `contested` cell (S1 is measurably unreliable here) widens
 * what the next turn's preflight search should pull in; `established` and
 * `unproven` both leave retrieval alone — on PURPOSE, the same distinction
 * `standingOf` itself draws: `established` has earned trust, and
 * `unproven` has not earned DIStrust either. Treating "not yet measured"
 * as "safe to narrow" would be exactly the "an empty cell is a lead, never
 * a verdict" mistake this repo's own coverage work (P58/P64) already named
 * and corrected once; the same discipline applies here.
 */
export function surfWeight(standing) {
  return standing?.standing === "contested" ? 1.5 : 1;
}

/**
 * escalationFor(standing, budgets) — flow #2, "suspicion widens the
 * search": the one consumer of `surfWeight` a live turn actually calls.
 * Takes the caller's DECLARED budget constants (never a prior turn's
 * already-escalated values — the call site passes the imported constants
 * every time, so the factor applies once per turn from the same base and
 * can never compound) and returns them either untouched or ceil-widened.
 *
 * Three laws, each load-bearing:
 *
 *   ASYMMETRY. Budgets only ever RISE. `surfWeight` returns 1 for
 *   `established` and `unproven` alike, so a good record never quietly
 *   removes checking and an unmeasured one never earns a discount — the
 *   dark-room refusal, applied to the spend side.
 *
 *   CEIL, NOT ROUND. A widening must never round back to its own
 *   baseline: for any integer budget >= 1 and any factor > 1,
 *   Math.ceil(v * factor) > v (v * 1.5 >= v + 0.5), so `contested`
 *   ALWAYS buys at least one more unit of effort. Round would no-op a
 *   budget of 1 under a factor below 1.5 and turn the flow into a
 *   comment; ceil makes it a wall.
 *
 *   CHANNEL ALIGNMENT. The caller applies this only to turns of the same
 *   class the cell's evidence came from (app.js gates on
 *   `opts.priorPass`, the identical gate `observe`'s own call site uses)
 *   — a standing measured on S1/S2 turns adjusts S1/S2 turns, never a
 *   channel nothing ever measured.
 *
 * Non-numeric or absent budget fields pass through untouched — this
 * function widens what it was handed, it never invents a budget.
 */
export function escalationFor(standing, budgets = {}) {
  const factor = surfWeight(standing);
  const escalated = factor > 1;
  const out = { escalated, factor };
  for (const [key, value] of Object.entries(budgets)) {
    out[key] = escalated && Number.isFinite(value) ? Math.ceil(value * factor) : value;
  }
  return out;
}

// ── the hunt gate: surprise decides when to stop hunting ────────────────
//
// User direction, near-verbatim (2026-09-01): "we should hunt until we
// have enough information such that what we experienced would not be
// surprising to a degree that is a distinction that makes a difference."
// That last clause is this repo's own standing vocabulary — Bateson's
// difference-that-makes-a-difference, `nul.pattern()`'s documented sign —
// and P31 already sketched exactly this stopping rule for a different
// loop ("hop until widening stops moving the answer beyond what reseeding
// noise would move it anyway; the noise can't beat the NUL"). This is
// that rule, built for the hunt: the preflight's page-fetch loop stops
// EARLY when the last page's arrival lands where the material's own
// continuation null says noise alone would put it, and runs to its
// declared ceiling while pages keep genuinely moving belief.
//
// THE MEASURING ORGAN IS REUSED, NOT INVENTED. `createTierStack`/
// `foldThrough` (the engine's emergence/tiers.js — bayesianSurprise
// placed against priorContinuationNull) is the SAME physiology
// reflex.js and aperture.js already wire, injected the same cast.js way,
// on the SAME declared numbers (SURPRISE_WINDOW/DRAWS/ALPHA/SEED,
// imported from reflex.js where their givers are named — nothing here is
// re-declared or re-tuned). One tier, named "hunt": the question a hunt
// asks ("did this page move what I hold") is tier-0's own question; the
// ladder above it answers a different one (aperture.js's) and is not
// dragged along as costume.
//
// THE SETTLED CUT IS APERTURE'S OWN, MEASURED ONE — not a new threshold.
// `huntSettled` reads an arrival exactly as `aperture.js::arrivalHeld`
// does (its private helper, mirrored with its history cited rather than
// exported across module intent): censored above → still surprising;
// censored below → stiller than every one of the null's own draws, held;
// a PLACED arrival holds iff rank > 0.5 — the null's OWN median, the cut
// aperture.js earned through two live-measured corrections (the
// both-censored version was unreachable, the censored-above-only version
// let a real topic pivot through at rank 0.01; the median catches it).
// A GAP NEVER SETTLES: an arrival that could not be measured is
// "withheld", not "nothing moved" — the same line the grounding ladder
// holds everywhere else, and it means an unmeasurable page can never be
// the reason a hunt stops early.
//
// WHAT THIS DOES NOT CLAIM. This is the per-arrival continuation-null
// gate, already validated live at aperture's own call site — it is NOT
// `nul.pattern()`'s licensed windowMean/shuffle pair run over a series,
// which is the sharper, null-of-nulls `opened` sign aperture.js's header
// names as still-open work. Named here too, not silently absorbed.

const huntCounts = (text) => {
  const m = new Map();
  for (const t of tokenize(text)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};

/** aperture.js::arrivalHeld's own cut, applied to one hunt arrival. */
export function huntSettled(obs) {
  if (!obs || obs.gap) return false;
  if (obs.censored === "above") return false;
  if (obs.censored === "below") return true;
  return obs.rank != null && obs.rank > 0.5;
}

// ── the hunt gate, second signal: echo by shape ─────────────────────────
//
// GAP, verbatim from the task that opened this section: the hunt's own
// stopping decision is driven ONLY by statistical surprise, and a newly
// arrived page that is substantially an ECHO of a page already gathered
// this hunt (a search-results snippet and the full page it previews, or
// two results that are the literal same underlying page) can still read
// as "somewhat surprising" under a pure word-novelty measure — so the
// hunt can keep going, or worse, both copies can reach the model as if
// independent facts. This is P181's own bug class (fact-block.js's
// header), caught there only AFTER the hunt had already decided to fetch
// and keep both. This section gives the hunt meter the same organ
// fact-block.js already built for that class of bug — never a second
// one, never a fuzzy-similarity threshold.
//
// aposiopesis.js's own `find()`, read closely before writing anything
// here, does NOT already generalize to whole-passage comparison: it is
// fixed at SENTENCE granularity (it calls `splitSentences` on every
// passage) and it gates domination checking on `TRAILING_ELLIPSIS_RE` —
// a sentence is only ever a candidate for being DOMINATED if it itself
// ends in "…"/"...". That is exactly the shape a search-engine snippet
// has and almost never the shape a whole fetched PAGE has (a page's own
// last sentence essentially never trails off), so `find()` alone would
// answer "did this page's own truncated sentence get completed
// elsewhere" (real, and built below as `ownDominatedSentences`, a thin
// call straight through `find()` — nothing reimplemented) but would stay
// silent on "is this whole page substantially a restatement of a page
// already gathered", the more common real shape.
//
// So two checks ship, not one — BOTH are additive disclosure, neither
// ever overrides `huntSettled`'s own statistical verdict:
//
//   ownDominatedSentences(text, priorTexts, organs) — calls
//   aposiopesis.find() directly, over every already-gathered text plus
//   the arriving one, and reports which of the ARRIVING page's own
//   sentences landed in the returned `dominated` set. Zero new logic;
//   this is `find()`'s own sentence-level answer, read for one
//   caller-declared passage instead of the whole pool.
//
//   wholePassageDominance(text, priorTexts, normalize) — the thin, reused
//   wrapper `find()` cannot give: the SAME byte-for-byte prefix test
//   `find()` runs internally (`hay.startsWith(needle)`, the identical
//   shape fact-block.js's own `subsumes` already uses one register over,
//   for a triple's object instead of a whole sentence) applied to two
//   WHOLE normalized passages, with no ellipsis gate — because the
//   arriving page need not itself trail off to be substantially the same
//   text as something already held. Two whole passages, byte-for-byte
//   prefix or exact match, nothing fuzzy: the arriving page is DOMINATED
//   when it is the shorter one (a later, thinner echo of fuller material
//   already gathered — the case worth disclosing to the hunt), or it
//   DOMINATES a prior arrival (the fuller page has just arrived and
//   completes an earlier truncated seed/snippet — genuinely new
//   information, never "echo", see `huntEchoed` below).
//
// Both are wired into `makeHuntMeter` as one optional `aposiopesis`
// organ (the SAME `{splitSentences, normalize}`-injected `makeAposiopesis`
// instance fact-block.js builds, or an equivalent one constructed the
// same way — never a second, independent instance) plus the two
// primitives it was built from, `splitSentences`/`normalize`, required
// alongside it for the identical reason `makeAposiopesis` itself
// requires them: this file constructs no second guess at either, and the
// whole-passage check must agree with the sentence-level one on what
// "the same text" means.

/**
 * ownDominatedSentences(text, priorTexts, {aposiopesis, splitSentences,
 * normalize}) — `aposiopesis.find()`'s own sentence-level answer, read
 * for one page. Every already-gathered text plus the arriving one are
 * handed to `find()` as passages (order does not matter — `find()`'s own
 * header says so, and a search-results digest is not reliably fetched
 * before or after the full page it duplicates); the arriving page's own
 * sentences are then split and normalized with the SAME injected
 * functions and checked for membership in the returned `dominated` set.
 */
function ownDominatedSentences(text, priorTexts, { aposiopesis, splitSentences, normalize }) {
  const passages = priorTexts.map((t) => ({ text: t })).concat([{ text }]);
  const { dominated } = aposiopesis.find(passages);
  if (!dominated.size) return [];
  return splitSentences(String(text ?? ""))
    .map((s) => normalize(s))
    .filter((n) => n && dominated.has(n));
}

/**
 * wholePassageDominance(text, priorTexts, normalize) — the general case
 * `find()` cannot answer (see this section's own header): does the whole
 * arriving `text`, normalized, sit byte-for-byte as a PREFIX of some
 * already-gathered text (`dominated: true` — the arriving page is the
 * thinner echo), or does some already-gathered text sit as a prefix of
 * it (`dominates: true` — the arriving page is the fuller completion,
 * genuinely new)? An exact normalized match is reported `dominated` with
 * `exact: true` — nothing is gained either way, so it reads as the
 * arriving copy contributing nothing new, same as a strict prefix would.
 * First match wins; this answers an existence question, not "which".
 */
function wholePassageDominance(text, priorTexts, normalize) {
  const norm = normalize(String(text ?? ""));
  if (!norm) return { dominated: false, dominates: false, exact: false };
  for (const prior of priorTexts) {
    const priorNorm = normalize(String(prior ?? ""));
    if (!priorNorm) continue;
    if (priorNorm === norm) return { dominated: true, dominates: false, exact: true };
    if (priorNorm.length > norm.length && priorNorm.startsWith(norm)) return { dominated: true, dominates: false, exact: false };
    if (norm.length > priorNorm.length && norm.startsWith(priorNorm)) return { dominated: false, dominates: true, exact: false };
  }
  return { dominated: false, dominates: false, exact: false };
}

/** Both checks, folded into the one object a hunt observation carries as
 * `.echo` when an aposiopesis organ was supplied to `makeHuntMeter`. */
function huntEchoOf(text, priorTexts, organs) {
  return {
    sentenceDominated: ownDominatedSentences(text, priorTexts, organs),
    ...wholePassageDominance(text, priorTexts, organs.normalize),
  };
}

/**
 * huntEchoed(obs) — a convenience reading of `obs.echo`, mirroring
 * `huntSettled`'s own shape: true only when the WHOLE arriving page reads
 * as substantially dominated (an exact echo counts, since `exact` is
 * always accompanied by `dominated: true` above) — never merely on
 * `sentenceDominated.length`, which can be real and small while the rest
 * of the page is genuinely new, and never on `dominates`, which marks
 * the arriving page as the VALUABLE, completing one, the opposite of an
 * echo. Pure and UNWIRED — see this file's own header on `surfWeight`/
 * `forcesFoldRefresh` for the same disclosed posture: a caller (the
 * hunt's own stopping decision in `gatherPreflightMaterial`, app.js) may
 * OR this alongside `arrived.settled`, never in place of it.
 */
export function huntEchoed(obs) {
  return !!obs?.echo?.dominated;
}

/**
 * makeHuntMeter(organs) — `{ create, arrive }`, the reflex.js/aperture.js
 * factory shape. `create(seedTexts)` folds the ground the hunt STARTS
 * from (the question, the discourse line, the search snippets — what is
 * already held before any page is fetched) so the first page is measured
 * against a real prior rather than an empty one; seed arrivals are
 * recorded with `role: "seed"` and never consulted by the stop rule.
 * `arrive(meter, text)` measures one fetched page and returns the
 * observation with `settled` already read off it.
 *
 * `aposiopesis`/`splitSentences`/`normalize` are OPTIONAL and additive —
 * see this section's own header, above. Omitted (every existing caller,
 * today — `app.js`'s one call site passes only `createTierStack`/
 * `foldThrough`), every returned observation is byte-identical to this
 * function's behavior before this section existed: no `.echo` key is
 * ever added to an observation, and nothing about the surprise
 * computation itself changes. Supplied, every observation additionally
 * carries `.echo` (see `huntEchoOf`), and `meter.rawTexts` accumulates
 * the raw text of every arrival (seed and page alike — a search-snippet
 * seed is exactly the kind of thing a later full-page fetch echoes) so
 * each new arrival is checked against everything already gathered this
 * hunt, in order, and only ever looks backward — the same
 * never-revise-a-past-observation discipline this repo holds everywhere
 * else (P4).
 */
export function makeHuntMeter({ createTierStack, foldThrough, aposiopesis = null, splitSentences = null, normalize = null }) {
  if (aposiopesis && (typeof splitSentences !== "function" || typeof normalize !== "function")) {
    throw new TypeError(
      "makeHuntMeter: an injected aposiopesis organ needs its own splitSentences/normalize beside it — the same primitives its instance was built from; this file constructs no second guess at either",
    );
  }
  const echoOrgans = aposiopesis ? { aposiopesis, splitSentences, normalize } : null;

  const fold = (meter, text, role) => {
    const arrival = huntCounts(text);
    const seq = meter.arrivals.length;
    let obs;
    if (arrival.size === 0) {
      obs = { seq, role, bits: null, rank: null, censored: null, gap: "empty_arrival — nothing tokenizable arrived" };
    } else {
      const r = foldThrough(meter.tiers, arrival, { alpha: SURPRISE_ALPHA });
      const t0 = r.results[0];
      obs = {
        seq,
        role,
        bits: t0.surprise != null ? Number(t0.surprise.toFixed(3)) : null,
        rank: t0.rank ?? null,
        censored: t0.censored ?? null,
        gap: t0.gap ? `${t0.gap.gap ?? t0.gap}${t0.gap.detail?.reason ? ` — ${t0.gap.detail.reason}` : ""}` : null,
      };
    }
    if (echoOrgans) obs.echo = huntEchoOf(text, meter.rawTexts, echoOrgans);
    obs.settled = role === "seed" ? null : huntSettled(obs);
    obs = Object.freeze(obs);
    meter.arrivals.push(obs);
    meter.rawTexts.push(text);
    return obs;
  };

  return {
    create(seedTexts = []) {
      const meter = {
        tiers: createTierStack(["hunt"], {
          window: SURPRISE_WINDOW,
          draws: SURPRISE_DRAWS,
          seed: SURPRISE_SEED,
        }),
        arrivals: [],
        rawTexts: [],
      };
      for (const t of seedTexts) if (String(t ?? "").trim()) fold(meter, t, "seed");
      return meter;
    },
    arrive(meter, text) {
      return fold(meter, text, "page");
    },
  };
}

/**
 * forcesFoldRefresh(profile) — true iff this turn's `assessAgreement`
 * found a real, positive contradiction (never a bare unresolved gap — see
 * this file's header). A CORRECTED claim means the running S1-style
 * summary may itself carry the error S2 just found, which is grounds to
 * refresh regardless of `aperture.js::exchangeHeldGround`'s OWN reading (a
 * DIFFERENT axis — discourse drift, not S1/S2 disagreement) — a natural OR
 * onto `refreshSummary`'s existing gate (app.js), not a replacement for it.
 */
export function forcesFoldRefresh(profile) {
  return (profile?.counts?.corrected ?? 0) > 0;
}
