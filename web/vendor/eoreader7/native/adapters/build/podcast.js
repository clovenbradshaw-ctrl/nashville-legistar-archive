// native/adapters/build/podcast.js — a podcast episode as a fold over the
// kernel's own append-only ledger. Nothing here is a new mechanism: it is
// the REAL pipeline (kernel/task-log.js + kernel/cube.js + kernel/notes.js),
// governed by the REAL ethos (organs/ethos.js, organs/charter.js) and the
// REAL logos (the-fold/revision-spiral.js's rhetorical appeal cells), and
// bounded by a REAL measured stopping test (kernel/measured-loop.js's
// streaming DMD) — pointed at one more medium, a spoken episode.
//
// THE SHAPE, stated once so it is not re-derived per function:
//
//   MOUTH proposes.  The model is asked for a segment (or a revision, or an
//   arbitration) and answers with ALREADY-STRUCTURED content — this organ
//   never parses free text and never calls a network. That crossing belongs
//   to the caller (podcast-mouth.mjs), exactly the way web.js stays pure
//   while explore-server.mjs owns the fetch. This organ's own job stops at
//   PROMPTING and WATCHING: it composes what the mouth is asked, and reads
//   back what it says — it does not write the mouth's answer FOR it, and a
//   caller with no live mouth gets an honest typed refusal here, never a
//   hand-scripted stand-in reasoning on the mouth's behalf.
//
//   ETHOS COMES BEFORE LOGOS (organs/ethos.js's own law, carried here
//   whole). `openEpisode` cannot mint a log without a valid ethos clearance
//   (`ethosClear` + `requireClearance` — the SAME bearing wall
//   `getSession()` stands on elsewhere in this tree); every segment's own
//   script is re-checked against the UDHR/Earth-charter family
//   (`charterGate`, the SAME seam "the proxy calls... on every
//   generation") before it is allowed to stand. A charter conflict is not a
//   silent block: it is one more thing the self-heal loop repairs, exactly
//   like a factual collision.
//
//   LOGOS is the-fold/revision-spiral.js's own rhetorical appeal cells
//   (Williams' false-tension/causal-order probes for LOGOS, Zinsser's
//   inflation/tic probes for ETHOS-of-style) run over each segment's
//   script — real, mechanical, model-free findings that feed the SAME
//   repair loop a factual conflict or a charter conflict does. "As
//   intelligently as possible" is this: every mechanical check this kernel
//   already owns for judging prose is actually run, not merely available.
//
//   THE UNCONSCIOUS SYSTEM records, append-only. Every segment lands as
//   INS·Figure (birth) or SYN·Figure (revision); its claims are heard onto
//   the SAME ledger (kernel/notes.js) a factual dispute/settlement/
//   concession also lands on — one log, not two (commitments.js's own
//   reason: a second log makes "as of" a reconciliation problem). Each
//   segment's repair loop ALSO lands its own measured stop as an EVA·
//   Pattern act (`landMeasuredStop`) — "did this loop converge" is itself
//   an EVA act (compare-to-bound, at the Pattern grain: THE-THREE-
//   MATHEMATICS' own calculus reading of DEF/EVA/REC), on the record like
//   everything else, never a bare console decision nobody can reopen.
//
//   LOOPS ON LOOPS, BOUNDED BY MEASUREMENT, NOT A HAND-PICKED COUNT. The
//   OUTER loop is the episode: one pass per planned beat. The INNER loop is
//   a segment's own repair: propose, evaluate (factual conflicts + charter
//   conflict + logos/ethos-quality findings, all counted as ONE issue
//   total), and — while issues remain — ask the mouth to revise, then
//   evaluate again. `kernel/measured-loop.js`'s streaming DMD reads the
//   issue count round over round and decides whether the loop is
//   MEASURABLY doing anything: decaying (keep going), converged (nothing
//   is moving — stop), resolved (issues hit zero — stop), or diverging
//   (issues are growing — stop immediately; a repair making things worse
//   gets no more budget). A hard ceiling (P9, still declared) remains the
//   safety floor under the measured test, never the operative one.
//
//   FUNCTIONAL CONFLICT IS DECLARED, NEVER INFERRED. `functionalConflict`
//   only ever checks a label the caller has put in `declaredFunctional` —
//   P36/HL's R2: a corpus cannot tell you a relation admits one value;
//   only a giver can.
//
//   THE APP IS A FOLD AT ANY GIVEN CURSOR. `foldAt` slices the log's own
//   entries by seq and hands the slice to the SAME kernel functions that
//   read the whole log. `renderEpisodeAt` is the whole holographic reading
//   recomputed from the ledger at that cursor — script, standing facts,
//   open disputes, algebra health, every measured stop this segment's own
//   loop reached, all read back fresh, never cached forward from a later
//   seq.
//
// DISCLOSED, NOT SILENTLY ABSENT: no text-to-speech synthesizer exists
// anywhere in this kernel — the audio adapters read and analyse existing
// sound, they do not produce it. The output here is a checked script.
//
// DISCLOSED LIMIT: claim identity is exact-string (kernel/notes.js's own
// `noteId`) — two claims agreeing in different words are two different
// notes, the same paraphrase wall this project measures and refuses to
// paper over elsewhere (P74's withdraw/retreat, MINE-1's unbound plateau).
//
// DISCLOSED LIMIT: this organ computes `noteId` itself to predict where a
// fresh claim will land, so its bookkeeping is correct only when the
// ledger was NOT given a custom `identity` organ.
//
// EVERY STEERING PROMPT IS AUDITABLE (user direction, verbatim: "be sure
// all your prompts to steer it, similar to a person would, are
// auditable"). A propose ask, an arbitrate ask, a revise ask — each is a
// real instruction to the mouth, the way a person correcting a draft would
// give one, and each lands on the SAME append-only ledger verbatim
// (`landMouthAudit`, SIG·Ground): the exact messages sent, the exact raw
// text received, before any parsing. Not a side-channel log file — part of
// the record itself, readable at any fold cursor (`renderEpisodeAt`'s own
// `mouthAudit`). A scripted test-double mouth has no real prompt to audit
// and lands nothing; this is additive, never required.
//
// DISCLOSED LIMIT: `organs/ethos.js`'s clearance gate is real but narrow —
// it judges CAPABILITY/CREATE-INTENT shapes (askShapeBest), not every
// prescriptive sentence a script might utter; `charterGate` on a short
// excerpt of the UDHR (the fallback, absent the full 516-language corpus)
// is correspondingly narrow too. Both are wired here exactly as built,
// with their own already-disclosed scope — this file makes neither
// stricter nor looser than it already is.

import * as nativeTaskLog from "../../kernel/task-log.js";
import { cellOf as nativeCellOf } from "../../kernel/cube.js";
import { makeNotes, noteId, REFUSALS as NOTE_REFUSALS } from "../../kernel/notes.js";
import { makeMeasuredLoop, VERDICTS as LOOP_VERDICTS } from "../../kernel/measured-loop.js";
import { constitution, ethosClear, requireClearance } from "../../organs/ethos.js";
import { charterGate } from "../../organs/charter.js";
import { armCharter } from "../../organs/arm-charter.js";
import { cellsByGrain, GRAINS as SPIRAL_GRAINS, APPEALS } from "../../the-fold/revision-spiral.js";

export const SEGMENT_PREFIX = "segment:";
export const segmentTaskId = (n) => `${SEGMENT_PREFIX}${n}`;
export const isSegmentId = (id) => typeof id === "string" && id.startsWith(SEGMENT_PREFIX);
export { LOOP_VERDICTS as MEASURED_LOOP_VERDICTS };

const norm = (v) => String(v ?? "").trim().toLowerCase();

/** The real logos + ethos-of-style findings from the-fold/revision-spiral.js's own MICRO-grain cells — the identical probes this tree already uses to judge prose (Williams for logos, Zinsser for ethos-of-style), never a second copy. */
function rhetoricalFindings(script, appeal) {
  const findings = [];
  for (const cell of cellsByGrain(SPIRAL_GRAINS.MICRO)) {
    if (cell.appeal !== appeal || typeof cell.probe !== "function") continue;
    for (const f of cell.probe(script) ?? []) findings.push({ ...f, cell: f.cell ?? cell.cell, editor: cell.editor });
  }
  return findings;
}
const logosFindings = (script) => rhetoricalFindings(script, APPEALS.LOGOS);
const ethosStyleFindings = (script) => rhetoricalFindings(script, APPEALS.ETHOS);

/**
 * makePodcast({ taskLog, cellOf, notes, identity, bridge }) — the podcast
 * organ, over an injected task-log/cube (default: this kernel's own) and
 * an injected notes ledger (default: a fresh `makeNotes()` built from the
 * same taskLog/cellOf, so a segment's own PROPOSE/SUPERSEDE entries and its
 * claims' INS/SYN/CON/REC entries share one log by construction).
 */
export function makePodcast({ taskLog = nativeTaskLog, cellOf = nativeCellOf, notes = null, identity = null, bridge = null } = {}) {
  const { createTaskLog, append, projectTasks, checkCubeProgression, ENTRY_KINDS, OPERATOR_BASIS } = taskLog;
  const ledger = notes ?? makeNotes({ taskLog, cellOf, identity, bridge });

  const cellFields = (op, grain) => {
    const c = cellOf(op, grain);
    if (!c || c.gap) return { cell_gap: c?.gap ?? "no_cell" };
    return { cell: `${c.op}·${c.grain}`, stance: c.stance, terrain: c.terrain, mode: c.mode, domain: c.domain };
  };

  /**
   * openEpisode({topic, voices, format}) — ETHOS COMES BEFORE LOGOS: a
   * valid clearance is required before the frame (DEF·Ground) is even
   * declared. Throws exactly as `organs/ethos.js::requireClearance` throws
   * elsewhere in this tree — this is not a feature a caller can bypass.
   */
  function openEpisode({ topic, voices = [], format = null, disposition = null } = {}) {
    if (typeof topic !== "string" || !topic.trim()) throw new TypeError("openEpisode: a topic is the episode's own frame — it cannot stand on nothing");
    const clearance = ethosClear(topic, { disposition });
    requireClearance(clearance);
    return ledger.createNotes({
      frame: {
        topic, voices: [...voices], format,
        ethos: { cleared: clearance.cleared, charterSha256: clearance.charterSha256, compendiumCount: clearance.compendiumCount },
      },
    });
  }

  /** landSegment — INS·Figure on first proposal, SYN·Figure on a revision. Same task_id both times (notes.hear's own re-sighting convention), never a `supersedes` — that field is for a NEW task replacing an OLD one, not a task updating itself. */
  function landSegment(log, { n, speaker = null, title, script, isRevision = false, trigger = null }) {
    if (!Number.isInteger(n) || n < 0) throw new TypeError("landSegment: n is the segment's own ordinal");
    if (typeof script !== "string" || !script.trim()) throw new TypeError("landSegment: a segment with no script is not a segment");
    const id = segmentTaskId(n);
    const op = isRevision ? "SYN" : "INS";
    const entry = {
      kind: isRevision ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.PROPOSE,
      task_id: id, operator: op, operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Figure",
      ...cellFields(op, "Figure"),
      description: isRevision ? `segment ${n} revised: ${trigger}` : `segment ${n} proposed: ${title ?? script.slice(0, 40)}`,
      n, speaker, title: title ?? null, script,
      ...(isRevision ? { trigger } : {}),
    };
    return { log: append(log, entry), id };
  }

  /** landMeasuredStop — the repair loop's own stopping verdict, landed as EVA·Pattern (compare-to-bound, at the Pattern grain — THE-THREE-MATHEMATICS' calculus reading of DEF/EVA/REC): "is this loop still doing anything" is itself an evaluated act, on the record, never a bare in-memory decision. */
  function landMeasuredStop(log, segId, stop) {
    const op = "EVA";
    const entry = {
      kind: ENTRY_KINDS.EVIDENCE, task_id: `measured:${segId}:${log.nextSeq}`, operator: op, operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Pattern",
      ...cellFields(op, "Pattern"),
      description: `measured stop for ${segId}: ${stop.verdict}${Number.isFinite(stop.growth) ? ` (growth ${stop.growth.toFixed(4)})` : ""} after ${stop.rounds} round(s)`,
      segment: segId, measuredVerdict: stop.verdict, rounds: stop.rounds, growth: Number.isFinite(stop.growth) ? stop.growth : null,
    };
    return append(log, entry);
  }

  /**
   * landMouthAudit — every prompt used to STEER the mouth (an arbitrate
   * ask, a revise ask — "similar to a person would," per direct user
   * instruction) is landed on the SAME append-only ledger, verbatim: the
   * exact messages sent and the exact raw response received, before any
   * JSON.parse. Typed SIG·Ground (Relate/Existence, the Void terrain,
   * Tending stance) — a communicative exchange establishing ambient
   * context, not yet a claim (that's what the claim itself, heard
   * separately via `hearClaim`, is for). `audit` is OPTIONAL: a scripted
   * test-double mouth has no real prompt/response to record, and nothing
   * lands when it supplies none — this is additive, never required.
   */
  function landMouthAudit(log, { segId, kind, audit, round = 0 }) {
    if (!audit) return log;
    const op = "SIG";
    const entry = {
      kind: ENTRY_KINDS.EVIDENCE, task_id: `audit:${segId}:${round}:${kind}:${log.nextSeq}`, operator: op, operator_basis: OPERATOR_BASIS.PRODUCED, grain: "Ground",
      ...cellFields(op, "Ground"),
      description: `${kind} prompt to the mouth for ${segId} (round ${round}) — recorded verbatim for audit`,
      segment: segId, promptKind: kind, round, request: audit.request, rawResponse: audit.rawResponse, durationMs: audit.durationMs ?? null, model: audit.model ?? null,
    };
    return append(log, entry);
  }

  /**
   * hearClaim — a segment's own claim, heard onto the SAME notes ledger,
   * witnessed by the segment that made it. `quote` (a verbatim substring of
   * the segment's `script`) becomes a self-verified span (P5.2) at
   * `segment:<n>#start-end`; a claim with no locatable quote is heard
   * unaddressed UNLESS `requireAddressed` is set, in which case it is
   * REFUSED (notes.js's own REFUSALS.UNADDRESSED).
   */
  function hearClaim(log, segId, claim, { requireAddressed = false } = {}) {
    const { end1, label, end2, quote = null, because = null } = claim ?? {};
    if (!end1 || !label || !end2) return { log, refused: { type: NOTE_REFUSALS.INCOMPLETE, detail: "hearClaim: an arrangement needs both ends and a label" } };
    let span = null;
    if (quote) {
      const start = claim.script != null ? String(claim.script).indexOf(quote) : -1;
      if (start >= 0) {
        const end = start + quote.length;
        span = { ref: segId, start, end, at: `${segId}#${start}-${end}` };
      }
    }
    if (requireAddressed && !span) return { log, refused: { type: NOTE_REFUSALS.UNADDRESSED, detail: `hearClaim: "${end1} ${label} ${end2}" names no verbatim quote in its own segment's script` } };
    const next = ledger.hear(log, { end1, label, end2, spans: span ? [span] : [], witness: segId, because });
    return { log: next, refused: null, id: noteId(end1, label, end2) };
  }

  /**
   * functionalConflict(folded, claim, declaredFunctional) — does an
   * established, un-conceded note already answer this claim's (end1,
   * label) with a DIFFERENT end2? Checked only for a label the caller has
   * declared functional (P36/HL's R2).
   */
  function functionalConflict(folded, claim, declaredFunctional) {
    if (!declaredFunctional || !declaredFunctional.has(norm(claim?.label))) return null;
    return (folded ?? []).find((note) =>
      norm(note.end1) === norm(claim.end1) &&
      norm(note.label) === norm(claim.label) &&
      norm(note.end2) !== norm(claim.end2)
    ) ?? null;
  }

  /**
   * healConflict(log, { segId, claim, rival, arbitrate }) — the one-shot
   * factual repair act: open the dispute (CON), ask the mouth to point at
   * the winner (SELECT, never generate — P32/P83), settle (CON) and
   * concede (REC) the loser. `outcome` is `"rival-stands"` (the new claim
   * is conceded), `"claim-stands"` (the rival is conceded), or
   * `"unsettled"` (the mouth named neither).
   */
  async function healConflict(log, { segId, claim, rival, arbitrate }) {
    const claimId = noteId(claim.end1, claim.label, claim.end2);
    const { log: l1, refused, id: disputeId } = ledger.dispute(log, rival.task_id ?? rival.id, {
      source: segId, kind: "contest",
      because: `${segId} states ${claim.end1} ${claim.label} ${claim.end2}, against ${rival.end1} ${rival.label} ${rival.end2}`,
    });
    if (refused) return { log, outcome: "unsettled", disputeId: null, refused };
    let log2 = l1;
    const arbitrated = await arbitrate({ rival, claim, disputeId });
    // arbitrate() may answer a bare string (every scripted test double in
    // this tree does — there is no real prompt to audit) or {pick, audit}
    // (a real mouth — podcast-mouth.mjs). Both are normalized here so
    // neither shape has to know about the other.
    const pick = typeof arbitrated === "string" ? arbitrated : arbitrated?.pick;
    const audit = typeof arbitrated === "object" ? arbitrated?.audit : null;
    log2 = landMouthAudit(log2, { segId, kind: "arbitrate", audit });
    if (pick !== "rival" && pick !== "claim") return { log: log2, outcome: "unsettled", disputeId };
    const trigger = `arbitration on ${disputeId}: ${pick === "claim" ? "the new claim" : "the established claim"} stands`;
    if (pick === "claim") {
      const s = ledger.settleDispute(log2, disputeId, { trigger, outcome: "conceded" });
      log2 = s.log;
      if (s.concession) { const c = ledger.concede(log2, s.concession.id, { trigger: s.concession.trigger }); log2 = c.log; }
      return { log: log2, outcome: "claim-stands", disputeId };
    }
    const s = ledger.settleDispute(log2, disputeId, { trigger, outcome: "upheld" });
    log2 = s.log;
    const c = ledger.concede(log2, claimId, { trigger: `settled against the new claim (${disputeId}): the established claim stands` });
    log2 = c.log;
    return { log: log2, outcome: "rival-stands", disputeId };
  }

  /**
   * evaluateSegment — one round's reading of a draft: hear its claims,
   * resolve any factual collision immediately (one-shot, not iterative),
   * check it against the charter (ethos) and run the logos/ethos-of-style
   * probes (real, mechanical, model-free). Returns the round's own issue
   * COUNT (factual losses + a charter conflict + every rhetorical finding)
   * — the ONE number the measured loop reads.
   */
  async function evaluateSegment(log, { segId, n, beat, topic, draft, declaredFunctional, requireAddressed, mouth }) {
    let factualLosses = 0;
    const claimReports = [];
    const claims = (draft.claims ?? []).map((c) => ({ ...c, script: draft.script }));
    for (const claim of claims) {
      const before = ledger.fold(log);
      const rival = functionalConflict(before, claim, declaredFunctional);
      const heard = hearClaim(log, segId, claim, { requireAddressed });
      if (heard.refused) { claimReports.push({ claim, refused: heard.refused }); continue; }
      log = heard.log;
      claimReports.push({ claim, id: heard.id });
      if (!rival) continue;
      const healed = await healConflict(log, { segId, claim, rival, arbitrate: (ctx) => mouth.arbitrate({ ...ctx, n, beat, topic }) });
      log = healed.log;
      claimReports.push({ heal: { outcome: healed.outcome, disputeId: healed.disputeId, rival: rival.task_id ?? rival.id, claim: heard.id } });
      if (healed.outcome === "rival-stands") factualLosses += 1;
    }
    armCharter();
    const ethos = charterGate(constitution().charter, draft.script);
    const ethosIssue = ethos.verdict === "conflict" ? 1 : 0;
    const logos = logosFindings(draft.script);
    const ethosStyle = ethosStyleFindings(draft.script);
    const issues = factualLosses + ethosIssue + logos.length + ethosStyle.length;
    return { log, claimReports, ethos, logos, ethosStyle, factualLosses, issues };
  }

  const describeCorrection = ({ claimReports, ethos, logos, ethosStyle }) => {
    const parts = [];
    for (const c of claimReports) if (c.heal?.outcome === "rival-stands") parts.push(`withdraws "${c.claim?.end1} ${c.claim?.label} ${c.claim?.end2}" — the ledger stands otherwise`);
    if (ethos.verdict === "conflict") parts.push(`charter conflict: ${ethos.basis}`);
    for (const f of logos) parts.push(`logos (${f.editor ?? f.cell}): ${f.detail ?? f.kind}`);
    for (const f of ethosStyle) parts.push(`ethos-of-style (${f.editor ?? f.cell}): ${f.detail ?? f.kind}`);
    return parts.join("; ") || "no issues found";
  };

  /**
   * healSegment — one segment's own OUTER-inner loop: propose (already
   * done by the caller — `draft0` is the mouth's first answer), evaluate,
   * and while the measured loop says to keep going, ask the mouth to
   * revise and evaluate again. Bounded by `ceiling` (P9, the safety floor
   * under the DMD measured stop, never the operative one). Lands the
   * measured stop itself as an EVA·Pattern act.
   */
  async function healSegment(log, { n, beat, topic, draft0, mouth, declaredFunctional, requireAddressed, ceiling }) {
    let { log: l1, id: segId } = landSegment(log, { n, speaker: draft0.speaker ?? beat.speaker ?? null, title: draft0.title, script: draft0.script });
    log = l1;
    log = landMouthAudit(log, { segId, kind: "propose", audit: draft0.audit, round: 0 });

    const measured = makeMeasuredLoop({ ceiling });
    let draft = draft0;
    let evalResult = await evaluateSegment(log, { segId, n, beat, topic, draft, declaredFunctional, requireAddressed, mouth });
    log = evalResult.log;
    measured.push(evalResult.issues);
    let v = measured.verdict();
    const rounds = [{ draft, ...evalResult, verdict: v }];

    let round = 0;
    while (v.continue) {
      round += 1;
      const correction = { claimReports: evalResult.claimReports, ethos: evalResult.ethos, logos: evalResult.logos, ethosStyle: evalResult.ethosStyle };
      // FOUND LIVE, FIXED HERE (not a design tradeoff — a plain bug): the
      // human-readable summary this ledger trigger already computes was
      // never the thing handed to the mouth. podcast-mouth.mjs's revise()
      // used to build its OWN description by calling a {end1,label,end2}
      // formatter directly on this whole `correction` bundle — a shape
      // that only ever matches a single claim, never the
      // {claimReports, ethos, logos, ethosStyle} object actually passed
      // here. Every real call therefore asked the model to fix
      // "undefined undefined undefined", for every correction kind
      // (factual, ethos, or logos alike) — invisible because every test
      // double for revise() reads `correction.ethos`/`.logos`/
      // `.claimReports` directly and never touches the mouth's own prompt
      // string. `correctionSummary` is the one true description, computed
      // once and shared between the ledger's trigger and the mouth's ask.
      const correctionSummary = describeCorrection(correction);
      const revised = await mouth.revise({ n, beat, topic, priorScript: draft.script, correction, correctionSummary });
      const land = landSegment(log, { n, speaker: revised.speaker ?? draft.speaker ?? null, title: revised.title, script: revised.script, isRevision: true, trigger: correctionSummary });
      log = land.log;
      log = landMouthAudit(log, { segId, kind: "revise", audit: revised.audit, round });
      draft = revised;
      evalResult = await evaluateSegment(log, { segId, n, beat, topic, draft, declaredFunctional, requireAddressed, mouth });
      log = evalResult.log;
      measured.push(evalResult.issues);
      v = measured.verdict();
      rounds.push({ draft, ...evalResult, verdict: v });
    }
    log = landMeasuredStop(log, segId, v);
    return { log, segId, draft, rounds, stop: v };
  }

  /**
   * produceEpisode — the outer loop over a declared plan of beats, each
   * proposed by the mouth, each segment healed (bounded by the measured
   * loop, never a hand-picked repeat count). Returns `{ log, report }`;
   * `report` names every heal this run performed, every measured stop
   * reached, and every gap left open — never silent either way.
   *
   *   plan: [{ speaker, beat }] — what each segment is meant to cover.
   *   mouth: { propose(ctx) -> {title, speaker, script, claims}, arbitrate(ctx) -> "rival"|"claim"|"neither", revise(ctx) -> {title, speaker, script, claims} }
   *   declaredFunctional: Set<string> of labels that admit one value per end1.
   *   repairCeiling: the safety floor under the measured stop (P9 — no default).
   *   requireAddressed: refuse a claim with no locatable quote (default false).
   */
  async function produceEpisode({ topic, voices = [], format = null, plan, mouth, declaredFunctional = new Set(), repairCeiling, requireAddressed = false, disposition = null }) {
    if (!Number.isFinite(repairCeiling)) throw new TypeError("produceEpisode: repairCeiling is declared by the caller (P9) — the safety floor under the measured stop is never a default");
    if (!mouth || typeof mouth.propose !== "function" || typeof mouth.arbitrate !== "function" || typeof mouth.revise !== "function") throw new TypeError("produceEpisode: mouth needs propose/arbitrate/revise, each async");
    if (!Array.isArray(plan) || !plan.length) throw new TypeError("produceEpisode: a plan is the episode's own beats — at least one");

    let log = openEpisode({ topic, voices, format, disposition });
    const report = { segments: [], warnings: [] };

    for (let i = 0; i < plan.length; i++) {
      const n = i;
      const beat = plan[i];
      const draft0 = await mouth.propose({ n, beat, topic, voices });
      const healed = await healSegment(log, { n, beat, topic, draft0, mouth, declaredFunctional, requireAddressed, ceiling: repairCeiling });
      log = healed.log;
      const segReport = {
        id: healed.segId, n, rounds: healed.rounds.length, stop: healed.stop,
        heals: healed.rounds.flatMap((r) => r.claimReports.filter((c) => c.heal).map((c) => c.heal)),
      };
      if (healed.stop.verdict === LOOP_VERDICTS.DIVERGING) report.warnings.push({ segment: healed.segId, warning: "the repair loop measurably made this segment WORSE round over round — stopped before spending more budget", growth: healed.stop.growth });
      if (healed.stop.verdict === LOOP_VERDICTS.CEILING) report.warnings.push({ segment: healed.segId, warning: "the safety ceiling was reached before the measured test converged or resolved — this loop never demonstrably finished", rounds: healed.stop.rounds });
      report.segments.push(segReport);
    }

    report.algebraFlags = checkCubeProgression(log);
    report.openGaps = [...ledger.disputesOf(log).entries()];
    return { log, report };
  }

  /**
   * foldAt(log, cursor) — the log SLICED at a seq, in the SAME shape
   * task-log.js's own functions read (`{entries, nextSeq, admits}`).
   */
  function foldAt(log, cursor) {
    const cut = Number.isFinite(cursor) ? cursor : log.nextSeq - 1;
    const entries = log.entries.filter((e) => e.seq <= cut);
    return { entries, nextSeq: entries.length ? entries[entries.length - 1].seq + 1 : 0, admits: log.admits };
  }

  /**
   * renderEpisodeAt(log, cursor) — the whole holographic reading, recomputed
   * from the ledger AS OF that cursor: the script as it stood, the facts as
   * they stood, which disputes were still open, whether the algebra held,
   * and which measured stops (EVA·Pattern acts) had already landed.
   */
  function renderEpisodeAt(log, cursor) {
    const sliced = foldAt(log, cursor);
    const tasks = projectTasks(sliced);
    const segments = tasks.filter((t) => isSegmentId(t.task_id)).sort((a, b) => a.n - b.n);
    const measuredStops = sliced.entries.filter((e) => typeof e.task_id === "string" && e.task_id.startsWith("measured:"));
    const mouthAudit = sliced.entries.filter((e) => typeof e.task_id === "string" && e.task_id.startsWith("audit:"));
    return Object.freeze({
      cursor: sliced.entries.length ? sliced.entries[sliced.entries.length - 1].seq : -1,
      frame: ledger.frameOf(sliced),
      segments: Object.freeze(segments),
      standing: Object.freeze(ledger.foldWithStanding(sliced)),
      openDisputes: Object.freeze([...ledger.disputesOf(sliced).entries()]),
      algebraFlags: Object.freeze(checkCubeProgression(sliced)),
      measuredStops: Object.freeze(measuredStops),
      mouthAudit: Object.freeze(mouthAudit),
    });
  }

  /** transcriptOf(rendered) — the episode as a readable script. Text only; no TTS engine exists here (see this file's own header). */
  function transcriptOf(rendered) {
    return rendered.segments.map((s) => `${s.speaker ? `${s.speaker}: ` : ""}${s.script}`).join("\n\n");
  }

  return Object.freeze({
    ledger, openEpisode, landSegment, hearClaim, functionalConflict, healConflict,
    evaluateSegment, healSegment, produceEpisode, foldAt, renderEpisodeAt, transcriptOf,
  });
}
