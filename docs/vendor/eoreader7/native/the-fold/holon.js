// holon.js — holonic task decomposition for the fold. Pure: no IO, no network,
// no DOM. The model arrives as an injected async function with the same shape
// as app.js's complete(); retrieval, citation, attribution, and grounding are
// the exact organs every ordinary turn already uses, called per part.
//
// The loop, in full:
//   1. PLAN     — one model call splits the task into parts (JSON, constrained
//                 where the provider can constrain; parsed defensively where
//                 it can't). A plan that fails to parse degrades to one part —
//                 the task itself — and says so as a typed gap.
//   2. For each part:
//      a. RESEARCH — retrieve() on the part's own words. The mechanism is
//                    mechanical, but the part's words are the PLAN's words —
//                    a model-authored steering of retrieval that an ordinary
//                    turn does not have. This is a known, deliberate deviation
//                    from "retrieval is a function of the question's own
//                    words," and it is disclosed rather than hidden: a part
//                    that shares no term with the task is flagged as a typed
//                    gap in its own record entry.
//      b. EXECUTE  — one model call writes the part from its passages.
//      c. CHECK    — checkCitations, checkGrounding, attribute. All mechanical.
//      d. CORRECT  — if the check found claims the bytes don't support, one
//                    bounded rewrite pass naming exactly what failed. A budget,
//                    not a threshold: the pass runs at most `maxCorrections`
//                    times and the last draft stands either way, with its
//                    failures still on the record.
//   3. ASSEMBLE — sections joined under headings; provenance is the union of
//                 what each part's own check already established. No field is
//                 computed at assembly time that wasn't read off step 2.
//
// What the model never sees: citation numbers to invent, other parts'
// transcripts, or a tool list. What the caller gets back: output plus a
// per-part provenance trail in the same vocabulary as a turn's warrant record
// (refs, channels, unsupported, open), so the app can fold the whole task as
// one turn without re-checking anything.

import { buildSourceBlock, checkCitations, foldTypography, openQuestions, retrieve, tokenize } from "../organs/source.js";
import { distinctSources, proposeCandidates, sourceOfWitness, textFeatures } from "../organs/corroboration.js";
import { anchorFindings } from "./anchor-chase.js";
import { checkGrounding, extractCheckableAtoms, unsupportedClaims, CLAIM_STOPWORDS, numberSet } from "../organs/grounding.js";
import { attribute, attributedRefs, coverage as poolCoverage, splitSentences } from "../organs/cite.js";
import { editPiece } from "./piece-edit.js";
import { isCodeSource, topicTerms } from "./longform.js";
import { snipsFor, snipBlock, checkSection, reviseAsk, applyRewrite, atomsOf } from "./snip-check.js";
import { traceReading } from "./reading-trace.js";
import { REVISION_ASKS, REVISION_ROUNDS, revisePiece, reviseLedgerContested } from "./piece-revise.js";
import { budgetsFor, depthLine } from "./depth.js";
import { checkPremises, correctTurn, cutProcessTalk, premiseFacts, premiseGuard, repeatsAbsentPremise, stripLeadingFraming, turnSnipBlock } from "./correction.js";
// The conversation's own loops (dialogue.js, 2026-09-07): anaphora across turns, the reader's restatement graded, the address check with one re-ask on facts, self-consistency against this conversation's own record, the expectation before the draft and its diff.
import { resolutionBlocks } from "./resolutions.js";
import { strikeAddresses, apparatusMentions } from "./firewall.js";
import { ownedRows, ownedLine, referentsOf, bindAnaphora, addressedBy, absenceOf, surfacesOf, selfContradictions, contradictionLine, positionOn, expectationFrom, expectationFacts, errorOf, fold as dfold } from "./dialogue.js";
import { fromOutcomes, fromPremises, learnedFacts, learnedGuard, recallFor, repeatsKnownFalse } from "./learned.js";
import { isAboutConversation, isTranscriptPassage, recallTurns, transcriptLine, lastOwnTurn } from "./transcript.js";
import { refKey } from "./dialogue.js";
import { checkComparison } from "./arithmetic.js";
import { checkPassageComparison } from "./passage-comparison.js";
import { answerBeforeTheModel } from "./answerable.js";
import { recruit, strainOf, substituted, identitySwapped } from "./strain.js";
import { placeCoverage } from "./calibration.js";
import { citedSource, findMisquote, misquoteFacts, misquoteGuard } from "./misquote.js";
import { admissible, finding } from "./turn-order.js";
import { quotedAsk } from "./transcript.js";
// GFP Pass 35: the keyless memory's seat in the turn — how many recalled
// passages it may offer beside lexical retrieval (field-of-record.js is pure;
// the cap is the holograph's own declared budget, never restated here).
import { FIELD_OFFER_MAX } from "./field-of-record.js";
import { groundOf } from "./ground-ladder.js";
import { stripNarrationSentences, stripScaffoldNarration } from "../organs/provenance.js";
import { relationFindings } from "../organs/hypergraph.js";
import { officeHolderGroups, parseSuccessionBoxes, resolveBoxSubjects } from "./succession.js";
import { buildFactBlock, dedupeSourceText } from "../organs/fact-block.js";
// KONDO'S CUT (P232): the duplication she reports, removed by this builder
// before the prompt is sent. She names owners and never cuts; the cut is the
// builder's own.
import { tidyMaterial, makeKondo, TIDY_PAIRS, TIDY_NOTES_PAIR } from "../organs/kondo.js";
// GARY (gary.js) keeps the door: the archon in charge of what the mouth is
// handed. Kondo counts what a prompt carries twice; Gary holds every rule
// about what may be carried at all, and hands the bag over.
import { makeGary, garyDecision, oracleRefusalText } from "../organs/gary.js";
import { applyQuotes, quoteFindings, quoteOpens, verifyQuotes } from "../organs/quotes.js";
import { LINK_CHECKS_PER_PART, extractLinkAtoms, linkFindings, stripDeadLinks, urlInMaterial, verifyLinks } from "./links.js";
import { composeShipment } from "./composition-gate.js";
import { parseSegments } from "./artifact.js";
import { admitPassages } from "./read-on-arrival.js";
import { asksAboutMaterial, materialView, abbreviate, aboutBlock } from "./about.js";
import { interpretAsk } from "./about-call.js";

// A relation claim carries end1/label/end2 (the SVO it read) but no `sentence`.
// Every consumer keyed on `claim.sentence` — the witness's `settledBy`/
// `endsFor` (its STRONG claim-end path), the expectation's `matchedSentences`
// shortcut — was therefore dead in the flat (non-piece) path, silently
// falling back to the witness's crude two-word ends. This anchors a claim to
// the sentence that carries its first end's leading word AND its label, by
// the words (never the splitter's boundary — the provenance.js/render findSentence
// lesson at claim scale). A claim whose words no sentence carries keeps
// `null`, which is byte-identical to the pre-anchor failure, never a guess.
function sentenceForClaim(text, claim) {
  const sents = splitSentences(String(text ?? "")).map((x) => x.trim()).filter(Boolean);
  const f = (t) => String(t ?? "").toLowerCase();
  const firstWord = f(claim?.end1 ?? claim?.subject).split(" ")[0] ?? "";
  if (!firstWord) return null;
  const label = f(claim?.label ?? claim?.verb);
  return sents.find((x) => f(x).includes(firstWord) && f(x).includes(label)) ?? null;
}

// ── the decomposition gate ───────────────────────────────────────────────────
//
// Ported from eochatX's eo-holonic-plan.ts, which is the canon on this: the
// gate is the SHAPE of the request, decided mechanically from the question's
// own words — never a model call (a malformed JSON reply and a considered
// "no" are the same shape once the reply is text, so the model cannot be
// asked), and never whether a corpus happens to be loaded.
//
// The shape being detected: "budget is $2000, we need wifi, everyone eats
// vegetarian, and our CFO can't attend on the 14th" genuinely has several
// separately-anchored parts to work through; one elaborated ask does not,
// even when it is long and comma-heavy. Clause count alone over-fires on a
// long single-topic sentence; requiring several clauses to each pin their
// OWN concrete anchor — a figure, a date, a name past the first word — is
// what separates "many dependent parts" from "one ask with many words."

const CLAUSE_SPLIT_RE = /[,;]|(?:\.\s+)|(?:\band\b)|(?:\bbut\b)|(?:\bwhile\b)/gi;
const MIN_CLAUSE_WORDS = 3;
const MIN_SUBSTANTIVE_CLAUSES = 3;
const NAMED_QUANTITY_RE =
  /\$\s?\d|\b\d{1,2}(?:st|nd|rd|th)\b|\b\d{4}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b/i;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=\S)/g;
// A standing preference ("from now on, always number your lists") is not
// WORK for this turn — it is a configuration change for every future turn.
// Measured live (2026-08-17): a message naming a standing preference plus an
// unrelated question ("My name is Jordan. From now on, always use a
// numbered list. What's the difference between weather and climate?")
// tripped the clause-count gate on the preference sentence's own commas —
// three parts, each re-greeting the user and re-answering the whole
// question, none of them actually numbering anything. The preference isn't
// a fact to decompose; it's addressed by carrying it forward as state, not
// by planning it as a part.
const STANDING_INSTRUCTION_RE =
  /\b(?:from now on|from here on|going forward|new rule|as a (?:standing )?rule|every time (?:you|i)|whenever (?:you|i) )\b/i;

/** Drop sentences that state a standing preference rather than this turn's
 * work, before the gate ever counts clauses. */
function stripStandingInstructions(text) {
  const sentences = text.split(SENTENCE_SPLIT_RE).filter(Boolean);
  if (sentences.length < 2) return text;
  const kept = sentences.filter((s) => !STANDING_INSTRUCTION_RE.test(s));
  return kept.join(" ");
}

/** A clause pins an anchor when it names a concrete fact beyond its first word — a figure, a date, or a proper noun mid-clause (sentence-initial capitals are just grammar). */
function clausePinsAnchor(clause) {
  if (NAMED_QUANTITY_RE.test(clause)) return true;
  const rest = clause.replace(/^\s*\S+/, "");
  return /\b[A-Z][a-z]+\b/.test(rest);
}

/** The substantive (>= MIN_CLAUSE_WORDS) clauses inside one span of text. Shared by the gate's own clause count and by the framing check below, so both count a clause the same way. */
function substantiveClauses(text) {
  return String(text || "")
    .split(CLAUSE_SPLIT_RE)
    .map((c) => c.trim())
    .filter((c) => c.split(/\s+/).filter(Boolean).length >= MIN_CLAUSE_WORDS);
}

/**
 * True when `q` is a lone trailing interrogative sentence preceded only by
 * pure framing — declarative scene-setting that carries no multi-clause work
 * of its own ("I'm researching X for Y. Who/when/why ...?"). Measured live
 * (2026-09-09): "I'm researching the Panama Canal's history for a
 * documentary script. Who built the canal, when was it completed, and why
 * did the earlier French attempt fail?" is ONE compound question wearing a
 * one-clause preamble — the multi-sentence check above can't tell that from
 * genuinely stepped imperative work ("Compare the 1805 and 1812 campaigns.
 * Cite the figures for each army, name the commanding generals, and note
 * the dates of the major battles. Which mattered more?"), where the middle
 * sentence pins three anchored clauses in its own right. The test: every
 * sentence before the last must fall short of the same
 * MIN_SUBSTANTIVE_CLAUSES bar the gate already uses for real work, and the
 * last sentence must itself be the single-interrogative-sentence shape the
 * gate already exempts.
 */
function isFramedSingleQuestion(q) {
  if (!q.endsWith("?")) return false;
  const sentences = q.split(SENTENCE_SPLIT_RE).filter(Boolean);
  const last = sentences[sentences.length - 1] || "";
  const lead = sentences.slice(0, -1);
  if (!lead.length) return false;
  if (!last.endsWith("?") || /[.!?]\s+\S/.test(last)) return false;
  return lead.every((s) => substantiveClauses(s).length < MIN_SUBSTANTIVE_CLAUSES);
}

/**
 * True when the question itself has the shape of several dependent parts.
 * Cheap-bails on the first check — a greeting or single-sentence ask never
 * reaches the anchor scan.
 *
 * DISCLOSED, NOT FIXED (2026-09-15, live-testing pass — CLAUDE.md's own
 * pointer for the session names this, no POLICIES.md number since nothing
 * below was changed): pasting a plain, fact-bearing paragraph with no
 * request attached — under source-door.js's own SOURCE_AUTO_MIN_CHARS
 * floor, so it never becomes a source either — can clear this function's
 * clause/anchor gate and get torn into invented sub-sections instead of
 * answered as ordinary chat. Live specimen: "The Golden Gate Bridge opened
 * to traffic on May 27, 1937, and was the longest suspension bridge span in
 * the world at the time, measuring 4,200 feet. It was designed by engineer
 * Joseph Strauss..." (4 more purely declarative sentences) decomposed into
 * six invented sections, one of which FABRICATED "The Golden Gate Bridge is
 * 1,280 feet long" — flatly contradicting the pasted text's own "4,200
 * feet" — because a decomposed part retrieves from state.sources/
 * liveChunks() (holonicTurn, app.js), never from the raw text it is
 * decomposing, so an unattached paste leaves every part with nothing to
 * draw from but the model's own (wrong) recall. Checked for a safe fix and
 * found none: the shape that should NOT decompose here (third-person
 * declarative prose) is grammatically indistinguishable from this file's
 * own pinned genuine-work specimen two screens down ("Our budget is $2000,
 * we need wifi at the venue, everyone eats vegetarian, and our CFO cannot
 * attend on the 14th") — ALSO subject-first declarative, no imperative
 * verb, no question mark, no second-person address, and it must keep
 * decomposing. A directive-verb/question-mark/second-person gate was tried
 * against both specimens and breaks the pinned one. This is P4's own
 * "decompose only on a counted property" asked to do semantic work no
 * counted property here can do — left open rather than force-fixed with an
 * invented threshold.
 */
export function needsDecomposition(question) {
  let q = String(question || "").trim();
  if (!q) return false;
  q = stripStandingInstructions(q).trim();
  if (!q) return false;
  // A question is one ask, however many facets it names. Measured live
  // (2026-08-17): "What river is Nashville on, what US state is it in, and
  // who was its mayor in 2019?" tripped the anchor gate, each part then
  // re-answered the WHOLE question, and the assembly shipped three headed
  // sections that contradicted each other on the mayor (Briley vs Cooper) —
  // less trustworthy than one draft would have been, at three times the
  // cost. The flat path is the right shape there: the model proposes one
  // answer, and the checking ladder — which verifies every name and figure
  // separately anyway — is the fact-check. Decomposition is for WORK
  // (imperative, multi-sentence, genuinely dependent parts), so a single
  // interrogative sentence never plans.
  if (q.endsWith("?") && !/[.!?]\s+\S/.test(q)) return false;
  // A framing sentence in front of the question ("I'm researching X for Y.
  // Who ...?") makes the text multi-sentence on its face, but the question
  // itself is still the single interrogative sentence the rule above means
  // to exempt — see isFramedSingleQuestion for the measured failure this
  // pins and why it can't be told apart from genuine stepped work by
  // sentence count alone.
  if (isFramedSingleQuestion(q)) return false;
  const clauses = substantiveClauses(q);
  if (clauses.length < MIN_SUBSTANTIVE_CLAUSES) return false;
  // The clause-count shortcut holds only for MULTI-SENTENCE work — steps
  // stated as steps. Inside one sentence, a comma count is LENGTH, not
  // structure (P4: decompose only on a counted property, and the property
  // is anchors, never commas). Measured live in the browser (2026-08-17):
  // "Make me a counter widget in html, with a plus button, a minus button,
  // and a number in between." hit this shortcut at four comma-clauses —
  // but those commas name facets of ONE artifact, none pins an anchor, and
  // each planned part, sighted only on its own label, regenerated the
  // whole widget from scratch: five restarts wearing a plan's clothes,
  // minutes of a 2B model re-answering one ask. A single-sentence ask now
  // plans only on the anchor count; the build loop's own iteration
  // (SIG/DEF/EVA aiming each next delta) is how an artifact gets good —
  // never five blind rewrites of it in one turn.
  if (clauses.length >= 4 && /[.!?]\s+\S/.test(q)) return true;
  const anchors = clauses.filter(clausePinsAnchor).length;
  return anchors >= 2;
}

// ── the plan log ─────────────────────────────────────────────────────────────
//
// A plan is not a structure that mutates; it is an append-only log of
// inserts, and "the plan" at any moment is a FOLD over that log. The
// semantics are ported from eochat's server/task-log.js — the
// task-log-holon-spine line, the lineage's proven shape for exactly this —
// with its scars kept and its cube apparatus deliberately left behind (this
// repo is not a cube consumer; operators and grains are another organ's
// address system, and carrying them here un-earned would be decoration):
//
//   Entries are appended, never mutated. Revision appends an entry that
//   supersedes; the superseded entry STAYS, because the fact that the work
//   was once seen that way is itself evidence.
//   Ordering is `seq`, a logical counter the log supplies. No clock.
//   Evidence accumulates from ANY entry that carries it, not only from
//   evidence-kind entries — gating on kind shipped tasks whose sections had
//   nothing to cite (measured in eochat, kept as law here).
//   Unrecognized keys are payload and are carried through the fold —
//   dropping them silently handed downstream an emptied structure (same
//   lineage, same lesson).
//   A missing field is a typed gap with a reason, never a default.

export const PLAN_ENTRY_KINDS = Object.freeze({
  PROPOSE: "propose",     // a part enters the log
  SUPERSEDE: "supersede", // a part is revised; the prior entry remains
  EVIDENCE: "evidence",   // addresses admitted for a part
  RESULT: "result",       // output produced for a part
  RETRACT: "retract",     // a part is withdrawn (it stays in the log)
});

export function createPlanLog(task) {
  return Object.freeze({ task: String(task ?? ""), entries: Object.freeze([]), nextSeq: 0 });
}

/**
 * Append one entry. Returns a NEW log — the old one remains valid, which is
 * what makes "what did this look like before the revision" answerable.
 */
export function appendPlan(log, entry) {
  if (!entry || typeof entry !== "object") throw new TypeError("appendPlan requires an entry object");
  if (!Object.values(PLAN_ENTRY_KINDS).includes(entry.kind))
    throw new TypeError(`appendPlan: unknown entry kind ${JSON.stringify(entry.kind)}`);
  if (typeof entry.part_id !== "string" || !entry.part_id)
    throw new TypeError("appendPlan: every entry needs a part_id");
  const sealed = Object.freeze({
    ...entry,
    seq: log.nextSeq,
    evidence: Object.freeze([...(entry.evidence ?? [])]),
  });
  return Object.freeze({
    task: log.task,
    entries: Object.freeze([...log.entries, sealed]),
    nextSeq: log.nextSeq + 1,
  });
}

const PLAN_RESERVED = new Set(["kind", "part_id", "seq", "supersedes", "description", "evidence", "result"]);

/**
 * Fold the log into the current set of live parts. Later entries for a
 * part_id win field by field; superseded and retracted parts drop out of the
 * live set — but nothing is deleted from `log.entries`.
 */
export function projectParts(log) {
  const byId = new Map();
  const superseded = new Set();
  const retracted = new Set();

  for (const e of log.entries) {
    if (e.kind === PLAN_ENTRY_KINDS.RETRACT) { retracted.add(e.part_id); continue; }
    if (e.supersedes) superseded.add(e.supersedes);

    const prior = byId.get(e.part_id) ?? {
      part_id: e.part_id,
      description: null,
      description_gap: "no description has been given for this part yet",
      evidence: [],
      result: null,
      first_seq: e.seq,
    };

    // Domain payload: the log knows structure, not what the structure is
    // made of, and a part must carry its material through the fold.
    const payload = {};
    for (const [key, value] of Object.entries(e)) {
      if (!PLAN_RESERVED.has(key)) payload[key] = value;
    }

    byId.set(e.part_id, {
      ...prior,
      ...payload,
      description: e.description ?? prior.description,
      description_gap: e.description != null ? null : prior.description_gap,
      // Evidence accumulates from any entry that carries it.
      evidence: e.evidence?.length ? [...new Set([...prior.evidence, ...e.evidence])] : prior.evidence,
      result: e.kind === PLAN_ENTRY_KINDS.RESULT ? e.result : prior.result,
      last_seq: e.seq,
    });
  }

  return [...byId.values()]
    .filter((t) => !retracted.has(t.part_id) && !superseded.has(t.part_id))
    .sort((a, b) => a.first_seq - b.first_seq);
}

/**
 * The plan as the rest of the app reads it: live parts in proposal order,
 * plus whether the parse ever degraded — read off the live parts' own basis,
 * derived, never stored.
 */
export function foldPlan(log) {
  const live = projectParts(log);
  return {
    task: log.task,
    parts: live.map((t) => ({ id: t.part_id, label: t.label ?? t.part_id, description: t.description ?? "" })),
    results: new Map(live.filter((t) => t.result).map((t) => [t.part_id, t.result])),
    degraded: live.some((t) => t.basis === "degraded"),
  };
}

/** Canonical rendering, key order included, so two folds can be compared. */
function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** A digest of the live fold — two logs differing only in dead entries digest alike. */
const foldDigest = (log) => canon(projectParts(log).map(({ first_seq, last_seq, ...t }) => t));

/** Production passes per run — a runaway backstop, same duty as eochat's maxSteps. */
// The sentence witness (2026-09-02): after the correction loop settles,
// every answer sentence the relation tier did not settle is put to the
// witness under the select protocol against this part's own passages.
// Declared budget per part (P9), with its reason: a flat answer is two to
// six sentences, each ask one small-model call plus its arm.
export const WITNESS_ASKS_PER_PART = 6;
// A PIECE's section is long and its citations are the deliverable (P115):
// the witness is asked about every sentence the relation tier left open,
// up to this declared budget — ~3 s an ask on the small mouth, so a
// 30-page piece spends minutes here, said on the record.
export const PIECE_WITNESS_ASKS = 24;
export const MAX_PRODUCE_STEPS = 3;

/**
 * The production closure, ported from task-log.js's produce(): fire rules,
 * append what they yield, run whatever became live and unrun, refold,
 * repeat — until the fold stops moving or the step guard trips. Rules are
 * caller-supplied predicates over the live fold; each returns entries to
 * append (kind defaults to PROPOSE) and must key its firing on evidence in
 * the fold, never on anything outside it. Three halt facts, kept distinct
 * because collapsing them is the one way this loop can lie: "fixpoint"
 * (production exhausted), "max-steps-guard" (bound tripped), and open gaps
 * outstanding — production being exhausted is NOT the work being done.
 */
export async function producePlan(log, rules, runLive, { maxSteps = MAX_PRODUCE_STEPS } = {}) {
  let current = log;
  let steps = 0;
  let fixpoint = false;

  while (steps < maxSteps) {
    const before = foldDigest(current);
    for (const rule of rules) {
      for (const produced of rule(projectParts(current), current) ?? []) {
        current = appendPlan(current, { kind: PLAN_ENTRY_KINDS.PROPOSE, ...produced });
      }
    }
    // Run whatever is live and has no result — the executor half of the
    // closure. Results are appended like every other entry.
    for (const part of projectParts(current).filter((t) => !t.result)) {
      const ran = await runLive(part);
      current = appendPlan(current, {
        kind: PLAN_ENTRY_KINDS.RESULT,
        part_id: part.part_id,
        evidence: ran.refs,
        result: ran,
      });
    }
    steps += 1;
    if (foldDigest(current) === before) { fixpoint = true; break; }
  }

  const openGaps = projectParts(current)
    .filter((t) => (t.result?.open ?? []).length)
    .map((t) => t.part_id);

  return {
    log: current,
    steps,
    fixpoint,
    halted_by: !fixpoint ? "max-steps-guard" : openGaps.length ? "open-gaps-remain" : "operational-closure",
    open_gaps: openGaps,
  };
}

/**
 * The one shipped rule: a part that strayed from the task's words AND
 * matched no material gets one retry proposed in the task's own words —
 * the mechanical repair for the one failure the checks type mechanically.
 * It keys on the fold's own evidence (the typed open entries) and marks its
 * product `basis: "retry"`, which is also what stops it firing twice.
 */
export function retryStrayedRule(tasks) {
  return tasks
    .filter(
      (t) =>
        t.basis !== "retry" &&
        t.result &&
        t.result.open?.some((o) => o.startsWith("part searched on words the task never used")) &&
        t.result.open?.some((o) => o.startsWith("no material matched")),
    )
    .map((t, i) => ({
      part_id: `${t.part_id}r`,
      supersedes: t.part_id,
      label: t.label ?? t.part_id,
      description: "",
      basis: "retry",
      reason: "strayed part matched nothing; retried on the task's own words",
    }));
}

/** Same limit an ordinary turn retrieves at — a part is a turn-sized question. */
export const PASSAGES_PER_PART = 3;
/** Parts beyond this are a sign the plan is padding, not decomposing. */
export const MAX_PARTS = 6;
/** Rewrite passes per part. A correction budget, not a quality threshold. */
export const MAX_CORRECTIONS = 1;
/**
 * Decode budget per part answer. A part is turn-sized; without a bound the
 * default 4096-token allowance is a standing permit to transcribe a whole
 * chapter (measured live: a "who is Dolokhov" part reproduced the Christmas
 * dinner chapter wholesale). A part that genuinely needs more length is more
 * parts — that is what decomposition is for.
 */
export const EXECUTE_MAX_TOKENS = 512;
// A piece's section under this share of its word target is continued once
// (P108). A share, not a count: the target is the caller's, the floor rides
// it. 0.6 is declared, not measured — the first run's sections came back at
// ~0.2 of target (2,269 words for a 15,000-word ask), so any floor above
// that fires; where it should sit is the next measurement.
export const CONTINUE_BELOW = 0.6;
/** The plan is a short JSON array; anything longer is the model talking. */
export const PLAN_MAX_TOKENS = 400;

export const PLAN_SYSTEM_PROMPT =
  "You split a task into the few parts it is actually made of. If the task is one part, say one part.";

/**
 * The plan's shape, enforced as grammar rather than requested as behavior:
 * Ollama's structured outputs take a JSON schema as `format` and constrain
 * decoding to it. Measured need, not caution — under plain `format: "json"`
 * gemma2:2b emits a single object (one part), because that mode's grammar
 * ends at one object. The schema is physics; the prompt above stays a
 * request, and parsePlan still handles every shape for callers whose
 * runtime cannot enforce one.
 */
export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["label", "description"],
      },
    },
  },
  required: ["parts"],
};

export function buildPlanPrompt(task, maxParts = MAX_PARTS) {
  return (
    `A task is to be split into parts, each answerable on its own from written material. ` +
    `Task: ${task}\n\n` +
    `Give at most ${maxParts} parts. Each part has a label of a few words ` +
    `and a "description" of one sentence saying what that part must establish. ` +
    `Order the parts the way the finished piece should read. If the task is already a single question, return one part.`
  );
}

// The shape of a good answer, declared before the model writes a word — not
// because a prompt is trusted (L5: it never is; judge() below enforces this
// mechanically regardless), but because a model that has never been told
// what "answered" looks like has no way to aim for it. Two shapes named
// because they are the two failures measured live: restating the prompt
// back (echo), and transcribing the passage instead of answering from it
// (reproduction) — a photocopy that grounds perfectly and answers nothing.
// No citation instruction, deliberately (2026-08-19): buildSourceBlock
// stopped showing the model any address on 2026-08-18 — zero exposure to
// this instrument's own addressing scheme, addresses attached mechanically
// by cite.js — but this prompt kept ordering "cite the address in square
// brackets exactly as it appears" when nothing appears. Measured live: the
// model obeyed the only way it could, by inventing "[4]" and
// "[Faculty & Research]", which then shipped as text and were parsed as
// claims. An instruction referencing a thing the pipeline mechanically
// removed is not a harmless leftover; it is a fabrication order.
export const EXECUTE_SYSTEM_PROMPT =
  "You are writing one part of a larger piece. Write plain prose for that part, and only that part, in your own words. Say what is established below — do not copy sentences out of it, and do not restate the question back. Where the answer is not there, say so plainly instead of filling the gap.";

// The no-material reply's other face. A prompt that matched no material is
// not necessarily a research gap — a greeting, a question of taste, a joke —
// and a model ordered to "say what the part would need" on "hi" says "the
// question is: hi". This prompt is the one place chat is allowed to be chat:
// no material framing, no citation grammar, just a reply to a person.
// FOUND LIVE (2026-09-08): asked "what can you help me with?" with nothing
// attached, a small model answered as an email-management app — not a lie
// exactly, just an ungrounded guess at its own nature, the same L5 failure
// this file already refuses for every OTHER fact ("a compliance-critical
// fact is never left to the model's own instruction-following") applied to
// the one fact this prompt had never actually stated. CONSTITUTION_PROMPT's
// own "mouth of a careful instrument" line is metaphor, not a plain
// self-description a small model can answer "what are you" from — and it
// is not even reached on this path (CHAT_SYSTEM_PROMPT is the whole system
// message for plain conversation). One true, plain sentence, in the same
// register as everything else here — no apparatus vocabulary
// (firewall.test.mjs checks this string too).
//
// BATTERY-TESTED 2026-09-08: the same "friendly reply" instruction, with
// nothing telling it to ever land, left gemma2:2b free to hover forever.
// "ok controversial question: is a hot dog a sandwich?" got "Ooh, that's a
// classic debate! Tell me what side you're on. 🌭 🥪 🤔" — no stance, the
// question bounced straight back; "cats or dogs?" the same shape a turn
// later. Separately, a three-turn restaurant ask (occasion, then city, then
// party size, each supplied in its own turn) never once got a place, a
// neighborhood, or even a cuisine — only a fourth clarifying question ("What
// kinda vibe? Barbecue, burgers, trendy spots?") once every fact already
// asked for was on the table. Reproduced with checking off, this prompt
// alone, real chat history: the model is not withholding for lack of
// material — there is no material framing on this path to withhold under —
// it is doing exactly what "reply the way a person would" left open, which
// is treat a direct ask as another invitation to ask its own. The fix is
// not "sound more confident" (S1_SYSTEM_PROMPT's hedge stays a hedge,
// LEVELS.md's own "model is just the mouth" rule still holds — this asks
// for an actual answer, never a performed certainty); it is a floor under
// how long "getting to know you" is allowed to run before it has to spend
// what it already has. One clause, stated as behavior, not as tone.
// The opening names a friend, not a job (2026-09-19). It used to open "a
// local reading and research assistant that works from whatever a person
// gives you" — and a 1B model handed that identity for a bare "hello" said
// "Hello, book collection. Discovery coming." Measured on the same
// OLMo-2-0425-1B over 5 greetings x 8 samples: 9/40 replies carried reading
// words under the old opening, 0/40 under this one. This prompt only runs
// where there is no material, so the job it named was never in view.
export const CHAT_SYSTEM_PROMPT =
  "You are The Fold, an AI assistant having a conversation. Reply directly, briefly, and naturally, the way a person would. Do not answer by merely restating the question or copying out what you were given — say something new, in your own words. Restating your interpretation to check it (“So you want X and Y — is that right?”) before answering an ambiguous or multi-part request is allowed and, when the turn asks you to confirm first, required. Asked for your own opinion, a preference, or a concrete suggestion, give one plainly — pick a side, name a real option — rather than turning the question back around; once someone has already told you what they need to, answer from that instead of asking them to repeat it in a different shape.";

// S1's own face: think out loud, give a first take, not a finished answer.
// The hedge IS the character — it makes S2's arrival feel natural ("I
// checked myself") rather than mechanical ("a second agent verified").
// Measured against gemma2:2b/qwen3:8b: third-person framing ("A first pass
// answered") makes S2 narrate checking; first-person framing ("Your first
// take was") makes S2 just answer. Plain conversation exempted so "hi"
// stays "hi".
export const S1_SYSTEM_PROMPT =
  `${CHAT_SYSTEM_PROMPT} Think out loud — give your first take, the way you'd start to answer before stopping to check yourself. A hedge or a second thought is fine; a finished answer is too polished for a first pass. Plain conversation doesn't need any of that.`;

// The void, acknowledged (2026-08-19, user direction: "if the surf did not
// turn something up, the model should be fed the acknowledgement of this
// void"). Before this, a preflight search that ran and found nothing looked
// IDENTICAL to a turn where no search was ever attempted — the model had no
// way to know the difference, so a materialless answer and a
// searched-and-came-up-empty answer read the same way to it. This is
// information, not an instruction (facts-before-draft.mjs's own finding,
// same day: give the model only what it needs, don't stack behavioral
// steering on top) — CHAT_SYSTEM_PROMPT's existing honesty framing already
// covers what to DO with an empty search; this only supplies the FACT that
// one happened.
// The void keeps its FORCE and loses its MACHINERY (firewall, 2026-08-27).
// P32's point stands — a confirmed absence must not read to the model like
// an absence nobody checked — but "a web search ran… it was not skipped"
// tells the model how this instrument is built in order to say so. What
// the model needs is that the emptiness is real and is not its to fill.
export const SEARCHED_VOID_PREFIX = "Nothing could be found on this. The emptiness is real and confirmed — say so plainly; it is not yours to fill in.";

// THE SAME VOID, ONE DOOR OVER: a source can be ATTACHED to the conversation
// while this turn's own retrieval comes back with nothing FROM it — the
// attachments switch off, every source muted, or a genuinely empty draw
// (retrieve() has no relevance floor, P4, so an empty result means `live`
// itself was empty, not that nothing scored). Before this, that turn fell
// straight into the plain-conversation branch below with nothing to say so:
// CHAT_SYSTEM_PROMPT reads exactly like a bare "hi" with nothing ever given,
// and the hyperlexicon's own cross-turn ledger (ledgerSuffix, a few lines
// down) — ACCUMULATED FROM EARLIER, UNRELATED READING, app-wide and never
// scoped to what is attached now (P57) — became the only thing on the page
// that looked like "what you were given." Measured live: a gym-workout
// dialogue attached and asked to be summarized in one sentence, with this
// turn's own retrieval empty, came back answering entirely about a stray
// single-witness note from a completely unrelated earlier reading ("Ships
// can stay safe in the harbor during a storm") — the ledger's own honest
// hedging ("one account's claim, not a settled one", a clause since removed as a verdict the mouth relayed as caution, 2026-09-16) was not enough to stop
// a small model from treating it as the material, because nothing told it
// there WAS other material it was missing. Same posture as
// SEARCHED_VOID_PREFIX just above: information, not an instruction — the
// honesty framing already in CHAT_SYSTEM_PROMPT covers what to DO with it.
// FIREWALL-CLEAN ON PURPOSE (firewall.js's APPARATUS_TERMS bars "material"/
// "retrieved"/"document" from anything model-facing): phrased as "what's
// attached" and "came up", never as a report on this instrument's own
// retrieval step.
export const UNRETRIEVED_MATERIAL_PREFIX = "Something is attached to this conversation, but none of it came up for this question. Anything below is from separate, earlier reading — not the attachment — so say plainly that what's attached doesn't answer this, rather than answering from that instead.";

// A THIRD VOID, ONE DOOR EARLIER STILL: the two above both describe an
// egress that RAN (a search that found nothing; a retrieval that drew
// nothing) — this describes one that never ran at all, because the
// person's own web switch is off. Found live (2026-09-15): "what's today's
// date, and can you check the web for one real current headline?" with
// nothing attached and web checking off answered with a specific, bold,
// plausible-reading headline ("Hurricane Otis Disrupts US East Coast…") —
// invented whole, with nothing behind it, formatted exactly like a real
// result. `shouldPreflight` (proof.js) already answers the mechanical
// question "would this turn have searched" — app.js's own call site now
// asks it a second time with standing consent forced on, and when THAT
// answer is yes while the real toggle is off, this is the fact handed
// over instead: information, not an instruction — the honesty framing
// already in CHAT_SYSTEM_PROMPT covers what to DO with it, same posture as
// SEARCHED_VOID_PREFIX and UNRETRIEVED_MATERIAL_PREFIX just above.
export const WEB_OFF_PREFIX = "Web checking is off for this conversation right now. Nothing has been checked online, so a live or current fact — today's headlines, this week's data, anything that would need a real web search — is not something this answer can actually confirm. Say so plainly rather than answering as if it had been checked.";

// The System 1 / System 2 pass: first-person framing so S2 understands it's
// following up on its OWN initial reaction, not investigating someone else's.
// Measured against gemma2:2b: "A faster, unchecked first pass already answered
// this" → S2 narrates ("Correct.", "The answer is"); "Your first take was" →
// S2 just answers. The prompt tells S2 what to DO (confirm/extend/correct)
// and what NOT to do (restate, make a ceremony of it), never HOW to phrase it.
// A caller with no S1 pass simply never calls it, so every existing caller of
// runPart/runHolonicTask is byte-identical to before this existed.
export const priorPassFor = (text) =>
  `Your first take was: "${String(text ?? "").trim()}" — check it against what you find. Confirm, extend, or correct it. Don't restate what you said; answer the question from what the checking turns up. If your first take was right, you can say so briefly and move on — don't make a ceremony of it.`;

// The turn's own date, as a bare fact — never an instruction about what to
// do with it (the same posture priorPassFor/SEARCHED_VOID_PREFIX already
// hold: information, not behavior stacked on top; LEVELS.md's "model is
// just the mouth" rule — this states a fact the model can reason from, it
// never tells the model HOW to reason or asks it to hedge). ISO date only
// (YYYY-MM-DD), the same format this repo's own giver stamps already use
// (app.js: `new Date().toISOString().slice(0, 10)`) — unambiguous and
// locale-free, unlike a formatted month name a small model might itself
// mis-render. `now` accepts anything `Date` accepts (a Date, an ISO
// string, epoch millis); `null`/invalid input returns "" so a caller that
// passes nothing changes nothing.
export function todayLine(now) {
  if (now == null) return "";
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return "";
  return `Today's date is ${d.toISOString().slice(0, 10)}.`;
}

// When priorPass exists (S2 following S1), frame the system prompt so the
// model understands it's continuing its own thinking, not starting fresh.
// Prepended before the base system prompt + priorPass suffix. Information,
// not behavioral — the same posture priorPassFor already holds.
const S2_FRAME_PREFIX = "";

// The flat turn's material prompt speaks at the OBJECT level (2026-08-19,
// user direction: "we're being fed the wrong level of response"). The old
// shape wrapped the person's message inside a meta-directive — "Write this
// part: the question. research Robert Macnamera" — and prompt format
// matches output format: fed a description of the task, a small model
// answers with a description of the task ("This prompt asks you to research
// Robert McNamara…", measured live, shipped). So the flat call is shaped
// like the conversation it is: duty and material in the system prompt, the
// real history as messages, the person's message itself as the final user
// turn — never a directive about it. Decomposed parts keep the directive
// shape: there a part label genuinely exists and the meta level is the
// true level.
// FIREWALL (2026-08-27, firewall.js): this string used to say "Passages
// retrieved for this turn follow… do not describe the message or the
// passages" — naming our own parts three times while instructing the model
// not to name them. Measured live, it complied with the vocabulary and not
// the instruction: "The prompt specifically identifies Hannibal Hamlin…".
// Nothing here names a part of this instrument now, so there is no word to
// borrow. `firewall.test.mjs` fails if one comes back.
export const FLAT_EXECUTE_SYSTEM_PROMPT =
  "You are talking with someone. Answer what they asked, in your own words, the way a person would — not a summary of the question and not a description of what you were given. Everything below is yours to answer from. If the answer is not there, say plainly that it is not, rather than filling the gap. If a side errand would help while you answer the rest, you can propose it by writing [[ant: what to look into]] — the person decides with one click whether anything runs, so never treat it as already running.";

/** The words of a draft, counted — never trusted from a prompt (P108). */
export const wordCount = (t) => String(t ?? "").split(/\s+/).filter(Boolean).length;
/** The last `n` words of a finished section, for the next section's prompt. */
export const tailWords = (t, n = 80) => String(t ?? "").split(/\s+/).filter(Boolean).slice(-n).join(" ");
/** The piece line: where this section sits, what the others are, how long it should run. Information the model receives (P55), never a directive about the apparatus. */
export function pieceLine(piece) {
  if (!piece || !Number.isFinite(piece.words)) return "";
  const where = Number.isFinite(piece.index) && Number.isFinite(piece.count) ? `This is section ${piece.index} of ${piece.count}` : "This is one section";
  const of = piece.topic ? ` of a ${piece.pages ? `${piece.pages}-page ` : ""}piece on ${piece.topic}` : " of a longer piece";
  const outline = piece.outline?.length ? ` The sections, in order: ${piece.outline.join("; ")}.` : "";
  const prev = piece.previousTail ? ` The previous section ended: "${piece.previousTail}"` : "";
  // Entities (cast) → what this section should say something about.
  const must = piece.obligations?.length ? ` This section should say something about: ${piece.obligations.join(", ")}.` : "";
  // Links (the record) → what the piece has already said, so it is not said again.
  const said = piece.alreadySaid?.length ? ` Earlier sections already said: ${piece.alreadySaid.join("; ")}.` : "";
  // Paradigm (contests, voids) → what a conclusion is made of.
  const facts = piece.facts ? `${piece.facts.disagreements?.length ? ` The sources disagree on: ${piece.facts.disagreements.join("; ")}.` : ""}${piece.facts.gaps?.length ? ` Nothing read says: ${piece.facts.gaps.join("; ")}.` : ""}` : "";
  // The register is the caller's (a university reader; an argument, not a
  // summary; specifics from the sources) — a fact about the audience the
  // mouth receives, never a compliance rule the instrument trusts.
  const register = piece.register ? ` ${piece.register}` : "";
  return `${where}${of}.${outline}${prev}${must}${said}${facts}${register} Write about ${piece.words} words of continuous prose for this section alone — no lists, no headings, and nothing the earlier sections already established.`;
}
/** The continuation ask, one place, so the meta-talk cut below knows its words. */
export const continueAsk = (more) => `Continue this section from where it stopped — about ${more} more words of continuous prose, no lists, no headings, and nothing it already says.`;
/** The instrument's own words to the mouth, TEMPLATE ONLY — no topic, outline, obligation or fact (those are the material's words and must never count as apparatus). */
export const INSTRUCTION_TEMPLATE = `${EXECUTE_SYSTEM_PROMPT} This is section of a piece on. The sections, in order. The previous section ended. This section should say something about. Earlier sections already said. The sources disagree on. Nothing read says. Write about words of continuous prose for this section alone — no lists, no headings, and nothing the earlier sections already established. ${continueAsk(100)} Every claim here was made in an earlier section. Write this section again about what the sources establish that those sections did not. This section says nothing about. Keep what it says and add what the sources establish about them, in the same prose. Let me know if you would like me to continue writing this. What the sources say, verbatim, each at its address. These sentences say things the sources you were given do not. Rewrite only those sentences so each says what the sources establish, or drop a sentence the sources cannot support. Reply with the rewritten sentences only, one per line, in the same order.`;
/** The cast's top referents in a set of passages, as plain names — the section's obligations (P110). */
export function obligationsFrom(index, { limit = 5 } = {}) {
  if (!index?.referents) return [];
  const counts = new Map();
  for (const e of index.events ?? []) { const id = e?.referent ?? e?.id ?? null; if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1); }
  const nameOf = (id) => { const r = index.represent?.(id); const n = typeof r === "string" ? r : (r?.display ?? r?.name ?? r?.surface ?? (typeof id === "string" ? id : null)); return n ? String(n).trim() : null; };
  return [...index.referents].map((id) => ({ id, n: counts.get(id) ?? 0, name: nameOf(id) })).filter((r) => r.name && /\p{L}/u.test(r.name)).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit).map((r) => r.name);
}
/** Which obligations a draft mentions (folded containment of the name, or its last word). */
export function coverageOf(text, obligations = []) {
  const t = fold(String(text ?? ""));
  const hit = (name) => { const f = fold(name); return f && (t.includes(f) || t.includes(f.split(" ").at(-1))); };
  const covered = obligations.filter(hit);
  return { covered, missed: obligations.filter((o) => !covered.includes(o)), share: obligations.length ? covered.length / obligations.length : null };
}
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Sentences that echo the instrument's own asks: words of the piece line / continuation ask / system prompt that the material never uses. Two of them in one sentence is the mouth talking about the writing, not writing (measured 2026-09-05: "There is no need to restate the question", "Let me know if you'd like me to continue writing this"). */
export function cutMetaTalk(text, { instructionText, materialText, splitSentences }) {
  const material = new Set(fold(materialText).split(" ").filter(Boolean));
  // Content words only: the received claim stoplist (grounding.js) keeps
  // "this", "and", "where" from counting as the instrument's own vocabulary.
  const apparatus = new Set(fold(instructionText).split(" ").filter((w) => w.length > 2 && !material.has(w) && !CLAIM_STOPWORDS.has(w)));
  if (!apparatus.size) return { text, cut: [] };
  const sentences = splitSentences(String(text ?? "")).map((s) => s.trim()).filter(Boolean);
  const cut = [];
  // Two apparatus words in one sentence, or one apparatus word in a sentence
  // that carries no word of the material at all — the mouth talking about
  // the writing, not writing.
  const kept = sentences.filter((sent) => { const ws = fold(sent).split(" ").filter((w) => w.length > 2); const hits = ws.filter((w) => apparatus.has(w)).length; const grounded = ws.filter((w) => material.has(w) && !CLAIM_STOPWORDS.has(w)).length; if (hits >= 2 || (hits >= 1 && grounded === 0)) { cut.push(sent); return false; } return true; });
  return { text: cut.length ? kept.join(" ") : text, cut };
}

export function buildExecutePrompt(part, sourceBlock, piece = null, topic = null) {
  // A part like "Collisions" is a bare label a model has its own (often
  // wrong) generic sense of — measured live (2026-09-17): asked to explain
  // hash tables and why collisions happen, the plan split into "Definition"
  // and "Collisions" parts; "Collisions" alone, with no topic anchor, drew a
  // section about physical objects bumping into each other, not hash
  // collisions. pieceLine already anchors a long-form document build via
  // piece.topic; an ordinary short chat decomposition never sets `piece`, so
  // that anchor was silently absent. This is NOT the full original question
  // (task_03d3a119 / 2026-09-09's own fix keeps that out on purpose, so a
  // part doesn't re-answer the whole compound ask) — just enough of a
  // subject noun to keep a bare label grounded.
  // Truncated well below any real task's own length (never the full
  // question) — buildExecutePrompt's own scoping to label+description is
  // what task_03d3a119/2026-09-09 protects; this is a short subject
  // anchor, not the compound question re-admitted.
  const anchorText = String(topic ?? "").trim();
  const anchor = !piece?.topic && anchorText
    ? `\nThis part belongs to a larger answer about: ${anchorText.length > 48 ? `${anchorText.slice(0, 48).trim()}…` : anchorText.slice(0, Math.max(0, anchorText.length - 1))}`
    : "";
  const head = `Write this part: ${part.label}. ${part.description}${anchor}${piece ? `\n${pieceLine(piece)}` : ""}`;
  return sourceBlock
    ? `${head}\n\n${sourceBlock}`
    : `${head}\n\nNo material matched this part. Say what the part would need and stop; do not invent content.`;
}
/**
 * task_03d3a119 — the discourse slice used to be embedded INSIDE this
 * function's returned string, in the SAME `user` message as the writing
 * instructions and the source material — structurally indistinguishable
 * from either. Measured live: by the third section of a piece build, the
 * model was visibly quoting its own injected "The conversation so far, in
 * one line: …" line, and the person's own prior chat message it carried,
 * directly into the fiction it was writing. `cutMetaTalk`'s apparatus
 * vocabulary is derived from `INSTRUCTION_TEMPLATE`, a FIXED string — it has
 * no way to recognize a model echoing back a RUNTIME-generated string back
 * at it, so it could never have caught this even if this repo allowed
 * editing the model's own sentences after the fact, which P186 (the mouth
 * is not censored) says it may not: "remove any editing of what the model
 * says, we just need to get the talking model to respond well." The fix has
 * to be upstream, in what gets INJECTED, never downstream in what gets cut.
 *
 * The flat chat path (runPart's own `chatContext`, a few hundred lines
 * below) already keeps its one-line discourse summary OUT of the `user`
 * content and appends it to the SYSTEM message instead — the channel a
 * model is trained to read as instruction/context, never as material to
 * draw quotable prose from. The piece-part path was the one place that
 * convention was not followed; this is that same convention, reused rather
 * than invented, so the fix is "be consistent with the working half of this
 * file," not a new mechanism. `runPart` now appends this suffix to
 * `EXECUTE_SYSTEM_PROMPT` at both call sites that used to fold `discourse`
 * into `buildExecutePrompt`'s own string; the `user` message a piece
 * section receives never carries the discourse line, or a name for it, at
 * all — nothing to look like content, nothing to quote.
 */
export function discourseSuffix(discourse) {
  return discourse ? `\n\nThe conversation so far: ${discourse}` : "";
}

/**
 * DEF → EVA → REC-guard → REDEFINE, for a claim EVA already found
 * malformed by cardinality (clusterFillers/officeHolderGroups computed a
 * closed, confirmed set of more than one filler for a slot the question's
 * own singular phrasing presupposed unique — the Strawson/Russell gap
 * P33's own header names). The redefinition is not a critique of the
 * prior draft; it is a REWRITE OF THE TASK — the confirmed set folded in
 * as a stated given — run through the ordinary, uncritical
 * buildExecutePrompt rather than buildCorrectionPrompt.
 *
 * Measured live 2026-08-20, three rounds, same Lincoln/Hamlin/Johnson
 * question, real fetched Wikipedia material, gemma2:2b — every one a
 * buildCorrectionPrompt("incomplete") wording fix, and every one dodged a
 * NEW way: round 1 echoed the correction's own escape phrase back as
 * its opening sentence; round 2 (that phrase removed) described the
 * QUESTION instead of the material ("The question mentions…"); round 3
 * (forbidding that too) invented a real-but-unconfirmed third name off
 * the raw succession-box text sitting right below the critique, then
 * (once the finding was reworded as a closed set) still narrated with a
 * verb ("concerns") the mechanical narration-stripper's own hand-typed
 * list did not carry. Three different dodges from three different
 * wording fixes is not a wording problem — every one of them was a
 * response to being told "your prior draft was wrong, fix it," which
 * is a directive ABOUT the task, and this file's own repeated lesson
 * (2026-08-17 EXECUTE_SYSTEM_PROMPT history, 2026-08-19's escaped
 * phrase, both above) is that a directive about the task produces a
 * description of the task. There is no fix for that within the
 * critique framing; the framing itself is the defect. Redefining the
 * question and asking it fresh — no "your draft", nothing to react
 * to — has nothing left to narrate about.
 */
export function buildRedefinedPart(part, findings) {
  if (!findings?.length) return part;
  // "The record confirms exactly this" was the wording here until
  // 2026-08-27, and it was measured leaking — not inferred, READ, in a
  // reasoning model's own visible thinking on a live turn: "the prompt says
  // 'the record confirms exactly this, and nothing beyond it'. So I should
  // emphasize... But must not say 'the record' since that's from the
  // prompt." The model spent real tokens working out that a phrase in its
  // own instructions was not a phrase it was allowed to use. That is the
  // whole cost of scaffolding vocabulary: it becomes a thing to comply
  // with rather than a fact to use. Named plainly instead — the findings
  // are what several sources establish, and "several sources establish" is
  // a fact about the world, not a term of art from a rulebook.
  return {
    ...part,
    description: `${part.description} These are established, and are the complete set, even if other names or claims sit nearby: ${findings.join("; ")}.`,
  };
}

/**
 * Land the completeness gate's finding as a REAL belief on the shared
 * task-log, not just a fact this function's own local variables happen to
 * hold for the length of one call — user direction (2026-08-20): "this
 * requires having the hypergraph record beliefs, assertions, etc... it is
 * believed BY AN EXPERIENCER, not just given by a source."
 *
 * Composed from organs this repo already owns, never a parallel mechanism:
 * `grid.js`'s `evaluate` verb already computes a real verdict via
 * `hypergraph.js::read()` and lands it as a task-log RESULT (P36, "EVA
 * computes, REC concedes") — `landAct` (capacity-runner.js) is the ONE
 * tested orchestration of parse → land → run → attach for it, proven live
 * on exactly this pattern (`capacity-runner.test.mjs`'s own "a SECOND
 * evaluate... lands a REC conceding the first"). This calls that same
 * organ rather than hand-building a `grid.land()` event, for the identical
 * reason `hl-acquire.js`'s own header gives for reusing the grammar lens
 * instead of re-deriving grammar: the refusal rules (stance resolution,
 * terrain lookup, the ground+broken requirement) already exist, tested,
 * and reimplementing them here would be the second-mechanism drift this
 * codebase's postmortems keep naming.
 *
 * `because <trigger>` names the EXPERIENCER — which reading, for which
 * part, formed this belief — because a verdict with no one attached to it
 * is exactly the "given by a source" framing the user's direction rejects;
 * every belief on this log says who was reading when they came to hold it.
 * SPACE-separated, like `ground`/`at`/`from` — NOT colon-suffixed like
 * `broken:`/`warrant:` (grid.js's own composition-law comment: `[because
 * <trigger>]`, a clause keyword, unlike the colon-suffixed fields that
 * live INSIDE a clause). Kept to word characters and hyphens only (grid.js's own tokenizer reads
 * `because` as free text up to the next clause keyword — "at"/"from"/
 * "ground"/"supersedes" — so those five words are avoided here, not
 * merely convenient ones).
 *
 * Failure is never fatal to the turn: a claim shaped in a way `evaluate`'s
 * own grammar refuses (a subject/object containing a clause keyword, an
 * empty claim) returns the log UNCHANGED — this is a durability layer on
 * top of the completeness gate's own existing, unconditional signal, never
 * a new requirement for it to fire.
 */
function landCompletenessBelief(grid, gridLog, runCapacity, landAct, { claim, sourceKey, sourceText, experiencer }) {
  if (!grid || !gridLog || !runCapacity || !landAct) return gridLog;
  const safe = (s) => String(s ?? "").replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  const subject = safe(claim.end1);
  const verb = safe(claim.label);
  const object = safe(claim.end2);
  if (!subject || !verb || !object) return gridLog;
  const line = `evaluate ${subject} ${verb} ${object} at Link from differentiate ground ${sourceKey} broken:rotation because ${safe(experiencer)}`;
  let out;
  try {
    out = landAct(grid, gridLog, line, { sources: { [sourceKey]: sourceText }, runCapacity });
  } catch {
    return gridLog;
  }
  return out?.ok ? out.log : gridLog;
}

export function buildCorrectionPrompt(part, sourceBlock, draft, failures, mode = "unsupported") {
  // Three failures, three rewrite instructions — each names exactly what
  // went wrong, because "try again" teaches nothing.
  // FOUND LIVE (2026-09-08): every mode below said "the question"/"it" and
  // never the question's own words — the same class of gap "incomplete"'s
  // own history already fixed twice ("give the model nothing left to hunt
  // for, instead of asking it not to hunt"), just not yet paid here.
  // Measured on a real specimen: asked who founded a company and when
  // ("who founded the company and when?"), the material verbatim answering
  // it in its first sentence, a first draft correctly copied that sentence
  // — REFUSED here as reproduction — and the rewrite this prompt asked for
  // ("answer the question... about it") paraphrased a DIFFERENT, unrelated
  // part of the same passage instead (nothing about a founder or a date),
  // because nothing in the instruction re-anchored the model to WHICH
  // question "it" meant once the draft it was reacting to was gone.
  // `part.description` (unlike `part.label`, a generic placeholder like
  // "the question") is the operator's own words for a flat turn — quoting
  // it plainly here costs nothing new (the model was already asked this
  // question, in this same conversation) and closes the drift the pronoun
  // left open.
  const asked = String(part.description ?? "").trim();
  const askedLine = asked ? ` The question was: "${asked}"` : "";
  if (mode === "reproduction") {
    return (
      `Your draft for "${part.label}" copies the passage word for word. Copying is not answering.${askedLine} ` +
      `Answer that question in your own words — a short paragraph saying what the passage shows about it, ` +
      `quoting at most one sentence.\n\nThe draft:\n${draft}\n\n${sourceBlock ?? ""}`
    );
  }
  if (mode === "echo") {
    return (
      `Your draft for "${part.label}" restates the prompt instead of answering it.${askedLine} ` +
      `Answer that from the material in your own words; ` +
      `if the material does not answer it, say so plainly.\n\nThe draft:\n${draft}\n\n${sourceBlock ?? ""}`
    );
  }
  if (mode === "narrated") {
    return (
      `Your draft for "${part.label}" describes the passage instead of answering the question — ` +
      `sentences like "this passage details…" or "it highlights…" are about the material, not an ` +
      `answer drawn from it.${askedLine} State the answer directly, in your own words, using what the passage says.\n\n` +
      `The draft:\n${draft}\n\n${sourceBlock ?? ""}`
    );
  }
  if (mode === "incomplete") {
    // Measured live 2026-08-19: an earlier draft of this prompt offered "say
    // plainly that the material lists more than one" as an escape hatch for
    // the genuinely-ambiguous case — gemma2:2b instead echoed that exact
    // clause back as its OWN answer's opening sentence ("The material lists
    // more than one vice president...") even on a draft that WAS able to
    // name every filler. A copy-pastable phrase in a correction prompt is an
    // instruction the model can obey too literally — the same lesson this
    // file's own EXECUTE_SYSTEM_PROMPT history already carries (a directive
    // about the task produces a description of the task). Reworded to name
    // what to DO (state every filler directly, plainly) without supplying
    // any sentence shaped to be echoed.
    //
    // Measured live again 2026-08-20 (the same Lincoln/Hamlin/Johnson
    // question): with that fix in place, gemma2:2b still dodged — not by
    // echoing the escape hatch, but by describing the QUESTION instead of
    // the material ("The question mentions two vice presidents: Hannibal
    // Hamlin and Andrew Johnson."), since the instruction only forbade
    // describing "the material itself" and said nothing about the question.
    // Every other mode above already forbids both in one breath (echo:
    // "restates the prompt instead of answering it"; narrated: "describes
    // the passage instead of answering the question"); this mode had
    // dropped the question half when it was written. provenance.js's own
    // narration stripper does not catch this sentence either and correctly
    // so — "mentions" only cuts wholesale text with no complement worth
    // keeping (details?/describe[sd]/etc.), and this sentence's complement
    // IS the two names the completeness gate exists to preserve; stripping
    // it would ship an empty or gutted answer, worse than the narration it
    // removes. The fix belongs at the source, same as the 2026-08-19 one.
    //
    // A third, deeper thing measured in that same 2026-08-20 run, once the
    // wording fixes above were both in place and re-tested: the model still
    // named a THIRD person ("Schuyler Colfax") who is real text sitting in
    // the material but was never confirmed for this slot. Replaying the
    // exact retrieved passages through both completeness signals directly
    // (bypassing the model) proved the finding itself was already correct
    // — a Wikipedia succession box sits one office's record directly beside
    // the NEXT office-holder's own record, so a small model shown the raw
    // box text a second time, under pressure to "find more", keeps reading
    // past the confirmed slot into the next one. `failures` above is now
    // the FULL confirmed set for each slot, phrased as closed ("confirms
    // exactly: X, Y (nothing else)") rather than a delta — this is the
    // actual fix: give the model nothing left to hunt for, instead of
    // asking it not to hunt.
    return (
      `Your draft for "${part.label}" answers as if there is only one, but the material states more than one. ` +
      `Here is the material's own COMPLETE, CONFIRMED answer for each — nothing beyond this list is confirmed, even if other names appear nearby in the passages below:\n` +
      failures.map((f) => `- ${f}`).join("\n") +
      `\n\nRewrite your answer to name every one of them directly, by name, the way you would if you had known all along — never describe the material or the question itself, and never add a name that is not on the confirmed list above, even one you recognize or see mentioned nearby. ` +
      `If you genuinely cannot tell which the material means, name the ones you can and say which part is unclear. ` +
      `Do not invent a reason to prefer one over the others unless the material itself gives one.\n\n` +
      `The draft:\n${draft}\n\n${sourceBlock ?? ""}`
    );
  }
  return (
    `Your draft for the part "${part.label}" contains statements the supplied material does not support:\n` +
    failures.map((f) => `- ${f}`).join("\n") +
    `\n\nRewrite the part using only what the passages state. ` +
    `Where the material is silent, say so instead.\n\nThe draft:\n${draft}\n\n${sourceBlock ?? ""}`
  );
}

/**
 * The mechanical answer — the fallback when the model's drafts keep failing
 * (echo or photocopy) and the correction budget is spent. The model has had
 * its chances; the instrument assembles the answer itself from the
 * material's own sentences, EACH carrying its address — measured need
 * 2026-08-17: a photocopy shipped with one address on four sentences, and
 * the reader asked "how did it know all this?" — provenance that isn't on
 * every sentence reads as knowledge from nowhere. Selection is the argmax
 * of overlap with the question's own tokens, one sentence per passage
 * (each retrieved perspective gets one voice; no threshold anywhere, P4).
 * The closing line states a process fact that is true by construction —
 * never a judgement about what the material "doesn't say".
 */
// Measured live 2026-08-20 ("who was Abraham Lincoln's vice president?"
// against real fetched material): raw overlap-count alone let a bare
// infobox row ("President Abraham Lincoln", 3 words, all 3 querytokens)
// outrank a genuine, more informative sentence in the SAME passage whose
// matching words were fewer relative to its length — the row is
// splitSentences's own honest reading of a succession box's "In office /
// President X / Preceded by Y / Succeeded by Z" lines, which have no
// sentence-final punctuation because they were never sentences.
// MECHANICAL-COVERAGE-INVESTIGATION.md already names this exact class
// ("the sentence splitter never breaks on bare newlines... 'Preceded by
// X' / 'Succeeded by Y' lines glue into garbage edges") for hypergraph.js's
// relation extraction; this is the identical furniture leaking through one
// layer over, into the fallback's own sentence choice. Terminal punctuation
// is the same structural tell this repo uses elsewhere to separate real
// prose from page furniture (blankStructure, stripContainer) — cheap,
// never a guess at content, and it only ever REORDERS which true, verbatim
// passage text gets quoted; it can't invent or drop material a passage
// doesn't have. A passage whose only positive-overlap candidate is a bare
// fragment still surfaces it — never nothing when something exists.
const SENTENCE_END_RE = /[.!?]["'”’)]*$/;

export function mechanicalAnswer(question, passages) {
  const qTokens = new Set(tokenize(String(question ?? "")));
  if (!qTokens.size) return "";
  // ONE VOICE PER PASSAGE, ONE LINE PER SENTENCE. Measured live 2026-09-02:
  // three passages carrying the identical sentence shipped it three times,
  // each with its own address — the same fact read as three findings. A
  // sentence is keyed by its folded text (source.js's own fold, the one the
  // reproduction detector uses), and every passage that states it adds its
  // ADDRESS to the one line rather than a second copy of the words. Each
  // perspective still gets its voice; the voices just agree out loud.
  const byText = new Map();
  for (const p of passages ?? []) {
    const best = splitSentences(String(p.text ?? ""))
      .map((s) => {
        const t = String(s).trim();
        return { t, n: tokenize(t).filter((w) => qTokens.has(w)).length, sentence: SENTENCE_END_RE.test(t) };
      })
      .filter((x) => x.t && x.n > 0)
      .sort((a, b) => (b.sentence - a.sentence) || (b.n - a.n))[0];
    if (!best) continue;
    const key = foldTypography(best.t);
    const row = byText.get(key) ?? { t: best.t, refs: [] };
    if (p.ref && !row.refs.includes(p.ref)) row.refs.push(p.ref);
    byText.set(key, row);
  }
  const lines = [...byText.values()].map((row) => `“${row.t}”${row.refs.length ? ` ${row.refs.map((r) => `[${r}]`).join(" ")}` : ""}`);
  if (!lines.length) return "";
  // NO FRAMING SENTENCES. This used to open "Here's what the material itself
  // says about this:" and close "That's everything the material offers on
  // the question's own words." — user direction, 2026-08-27, shown this
  // exact output for the third time: "i never want to see output 'talking'
  // content like this."
  //
  // Both sentences were meta-commentary ABOUT the material rather than an
  // answer, and both used the generic scaffolding word the same session had
  // already had removed from `buildSourceBlock` and `buildRedefinedPart`
  // ("just have it be like 'Wikipedia, Retrieved...'"). A reader asking what
  // the capital of France is does not want to be told what a corpus offers;
  // the quoted sentences already say it, verbatim and addressed, and they
  // say it better without a narrator introducing them.
  //
  // What ships is now exactly what this function was always honest about
  // being: the material's own sentences, each with its address, and nothing
  // in this instrument's voice wrapped around them.
  return lines.join("\n\n");
}

// mechanicalCompetingAnswer — the same "the model has had its chances,
// assemble it ourselves" posture as mechanicalAnswer above, aimed at a
// different failure: a competing-subjects slot (queryReferents' own
// confirmed multi-subject cluster, hypergraph.js, 2026-09-23) that survives
// the completeness gate's ONE "incomplete" retry (maxCorrections=1) still
// wrong. Measured live, 2026-08-20 (this file's own comment at the
// competingSubjectsOf call site): that one retry can not just OMIT a
// confirmed subject but FABRICATE one ("invented Schuyler Colfax") — a
// second model call is not the fix for a model that invents under pressure
// to "add more." User direction, 2026-09-23: "we should really try as much
// as possible to answer without the model in it. This should be a pretty
// extractable factoid."
//
// Deliberately NEVER composes a new sentence out of a subject name plus the
// claim's own label/end2 (e.g. "Hamlin and Johnson became vice president
// under Lincoln.") — a synthesized compound-subject sentence risks the
// relation extractor re-parsing it differently from the material's own TWO
// separate real edges on re-inspection, which could re-flag a confirmed-
// correct answer as unbound. Instead, for each confirmed subject, it finds
// and quotes the material's own best real sentence naming that subject, in
// one of the passages queryReferents already resolved it against — the
// same declared method (verbatim, addressed, computed not generated) as
// mechanicalAnswer, scoped per subject rather than per passage.
export function mechanicalCompetingAnswer(findings, passages) {
  const byRef = new Map((passages ?? []).map((p) => [p.ref, p]));
  const lines = [];
  const seen = new Set();
  for (const f of findings ?? []) {
    for (const s of f.competingSubjects ?? []) {
      // A "competing subject" this instrument never actually resolved to a
      // referent (queryReferents' own `resolution: "none"`, e.g. a bare
      // unresolved pronoun sitting in the material) is not a real, nameable
      // entity — composing a sentence "about" it would be naming a pronoun
      // as though it were a person. Defensive here too, not only at the
      // caller: this function's own contract is real, addressed names.
      if (s?.resolution === "none") continue;
      const name = String(s?.subject ?? "").trim();
      if (!name || seen.has(name)) continue;
      const nameTokens = new Set(tokenize(name));
      if (!nameTokens.size) continue;
      let best = null;
      for (const ref of s.refs ?? []) {
        const p = byRef.get(ref);
        if (!p) continue;
        for (const sentence of splitSentences(String(p.text ?? ""))) {
          const t = String(sentence).trim();
          if (!t) continue;
          const n = tokenize(t).filter((w) => nameTokens.has(w)).length;
          if (!n) continue;
          const isSentence = SENTENCE_END_RE.test(t);
          if (!best || (isSentence && !best.isSentence) || (isSentence === best.isSentence && n > best.n)) {
            best = { t, n, isSentence, ref };
          }
        }
      }
      if (best) {
        lines.push(`“${best.t}”${best.ref ? ` [${best.ref}]` : ""}`);
        seen.add(name);
      }
    }
  }
  return lines.join("\n\n");
}

/**
 * Pull the first balanced JSON array out of a reply. Constrained decoding
 * makes this trivial for Ollama; a prose-mode model may wrap the array in
 * talk, so the extraction walks brackets rather than trusting a regex to
 * find the end.
 */
export function extractArray(text) {
  const s = String(text ?? "");
  // Every "[" is a candidate start, not just the first: a bracketed aside in
  // prose before the real array must not discard a valid plan.
  for (let start = s.indexOf("["); start !== -1; start = s.indexOf("[", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "[") depth++;
      else if (ch === "]" && --depth === 0) {
        try {
          const parsed = JSON.parse(s.slice(start, i + 1));
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // this bracket was not the array — keep scanning
        }
        break;
      }
    }
  }
  return null;
}

/**
 * A plan is whatever survives: objects with a usable label or description,
 * capped, each part given a stable id. An unusable reply is not an error —
 * the task runs as its own single part and the degradation is a typed gap,
 * because a task silently un-decomposed reads as a plan that chose that.
 */
export function parsePlan(raw, task, maxParts = MAX_PARTS) {
  // Constrained decoding guarantees JSON, not shape: gemma2:2b's live reply
  // was a top-level OBJECT wrapping the array ({"parts": [...]}), which the
  // array scan alone misses. An object whose first array-valued field holds
  // the parts is the same plan in a wrapper — unwrap it, don't degrade on it.
  let arr = extractArray(raw);
  if (!arr) {
    try {
      const obj = JSON.parse(String(raw ?? ""));
      if (obj && typeof obj === "object" && !Array.isArray(obj))
        arr = Object.values(obj).find(Array.isArray) ?? null;
    } catch {
      // not an object either — the degradation path below handles it
    }
  }
  const parts = (arr ?? [])
    .filter((p) => p && typeof p === "object")
    .map((p, i) => ({
      id: `p${i + 1}`,
      label: String(p.label ?? p.title ?? "").trim() || `part ${i + 1}`,
      description:
        String(p.description ?? p.desc ?? "").trim() ||
        String(p.label ?? p.title ?? "").trim(),
    }))
    .filter((p) => p.description)
    .slice(0, maxParts);

  if (parts.length) return { parts, degraded: false };
  return {
    parts: [{ id: "p1", label: "the task", description: task }],
    degraded: true,
  };
}

/**
 * One part, end to end: research, execute, check, bounded correction. The
 * check runs on every draft, and the provenance reported is the LAST draft's
 * check — a correction that didn't take stays visible as what it is.
 */
/**
 * groundedAtomsDropped(before, after, passages) → the atoms (names, numbers,
 * years — snip-check.js::atomsOf) of `before` that the passages carry and
 * `after` does not. Numbers compare by value (numberSet, P215), names by the
 * dialogue fold. An atom the passages do not carry is not counted: dropping
 * what the material never said is not a loss.
 */
function groundedAtomsDropped(before, after, passages = []) {
  const ground = passages.map((p) => String(p?.text ?? "")).join("\n");
  const groundNumbers = numberSet(ground), afterNumbers = numberSet(String(after ?? ""));
  const groundFolded = dfold(ground), afterFolded = dfold(String(after ?? ""));
  const out = new Set();
  for (const a of atomsOf(String(before ?? ""))) {
    const numeric = a.kind === "number" || a.kind === "year";
    const inGround = numeric ? groundNumbers.has(a.value) : groundFolded.includes(dfold(a.value));
    const kept = numeric ? afterNumbers.has(a.value) : afterFolded.includes(dfold(a.value));
    if (inGround && !kept) out.add(a.value);
  }
  return [...out];
}

export async function runPart({
  part,
  task = "",
  discourse = "",
  chatHistory = [],
  chunks,
  call,
  foldedRefs = [],
  passagesPerPart = PASSAGES_PER_PART,
  maxCorrections = MAX_CORRECTIONS,
  executeMaxTokens = EXECUTE_MAX_TOKENS,
  // Long-form (P108): the section's place in a piece and its word target;
  // a short draft gets ONE measured continuation before any check runs.
  piece = null,
  // What the material itself is organized as — the sources' own section
  // headings — handed to the planner as facts (P114), so the outline is
  // drawn from the material rather than from the model's sense of what a
  // piece on any subject contains.
  planFacts = null,
  makeNameResolver = null,
  // The cast organ (cast.js::makeReferentIndex), injected: a name the cited
  // passage's own cast does not establish is beyond-reach (P135).
  makeReferentIndexFor = null,
  makeRelationReader = null,
  // The link tier (links.js): an async function url => fetched-shape result,
  // through the P13 egress — injected because this module owns no network.
  // null means the standing web consent is off; every cited URL then ships
  // `unexamined`, never silently treated as checked.
  checkLink = null,
  linkBudget = LINK_CHECKS_PER_PART,
  // The sentence witness (witness-sentences.js, injected already bound to
  // the model's ask organs): (sentences, claims, passages, {maxAsks}) →
  // {rows, asks}. null means no witness — every unsettled sentence then
  // ships with the relation tier's own verdict alone, as before.
  witnessSentences = null,
  witnessAsks = WITNESS_ASKS_PER_PART,
  // THE DEPTH SLIDER'S BUDGETS (P123, depth.js): how many bounded passes a
  // piece's section gets — the witness asks a piece may spend, the snip
  // rewrite rounds, the continuations of a short draft, the hunts when
  // retrieval is thin. Defaults are the plain rung, byte-identical to before.
  pieceWitnessAsks = PIECE_WITNESS_ASKS,
  snipRounds = 1,
  continuations = 1,
  hunts = 1,
  // WHAT THIS INSTRUMENT HAS ALREADY BEEN WRONG ABOUT (P126): the durable
  // corrections, in the chain's own entry shape. The ones in scope for this
  // question are handed to the model as facts before it drafts, so a mistake
  // made once is not made again. Empty (every existing caller) changes nothing.
  learnedStore = [],
  language = "en", // the question's declared language for dialogue.js's question-side triggers (S39): another language is a typed gap on the record, never a silent non-match
  learnedSince = null, // dialogue.js::ownedRows — corrections learned at or after this timestamp are THIS conversation's own, and the record owns them on the answer
  // THE CONVERSATION'S OWN RECORD (P128, transcript.js): [{turn, question,
  // answer}] oldest first. A question ABOUT what was said retrieves from it,
  // exactly as a question about the material retrieves from the material —
  // so what the recency window drops is still reachable. Empty (every
  // existing caller) changes nothing.
  transcript = [],
  resolutions = 0, // resolutions.js — the discourse at three resolutions: 0 none, 1 atmosphere, 2 + lens, 3 + paradigm
  dmdWindow = null, // the measurement organ the cuts spend (kernel/activation.js), injected
  conversationIndex = null, // a referent index over the CONVERSATION's material (the part's index knows only its own passages)
  // strain.js::identitySwapped's own gate (P219's residual): the SAME
  // POS-prior predicate namesCorefer's gate already uses (surfaces.js),
  // so a bare generic head noun ("Observatory") never counts as honestly
  // naming what the question asked about. null falls fully open (every
  // word of an absent name counts, including a shared generic one) —
  // the entity-substitution check still runs, just less precisely.
  commonNoun = null,
  records = [], // the checked turns (fold.js's record store) — the Figure-level conversation record
  mentionBook = null, // activation-retrieval.js's address book, when the caller built one: prominence for naming a ground, nothing else
  material = "auto", // what the mouth is handed as material: "auto" = the passages leave at level ≥ 2 (the blocks replace them; snips stay); "passages" forces them in (the additive control); "snips" forces them out
  // THE ARITHMETIC ENGINE (arithmetic.js's own injection pattern): the page
  // hands the vendored mathjs, a test hands the package. Absent, nothing
  // below computes and the turn is byte-identical to before.
  math = null,
  // What the person asked for on the slider, so strain is held inside it.
  askedDepth = null,
  // HOW THIS TURN FINDS ITS PASSAGES (P141), injected so an arm can be run
  // against a different reading without editing the turn. Absent, it is
  // `source.js::retrieve` and every existing caller is byte-identical.
  retrieveWith = null,
  // GFP PASS 35 — THE SHADOW AS ONE WITNESS IN RETRIEVAL. A function
  // `(question) => recallForTurn(...)` (field-of-record.js), recalled from
  // the question and offered BESIDE what lexical retrieval found — the
  // shadow never replaces the other retrieval and never feeds the model on
  // its own (GFP P3: a shade cannot be its own light source). A recalled
  // passage the turn's pool already held is agreement; one in the pool but
  // missed by lexical is promoted (added, marked `retrievedVia: "relative"`);
  // one the pool does not hold at all is recorded on `fieldWitness` and NOT
  // offered. THE_SHADOW and THE_ECHO nodes (recall-only, no words) are never
  // offered by design — recallForTurn filters them out. Null (every existing
  // caller) is byte-identical to before.
  fieldRecall = null,
  // shape-fallback.js's re-rank, consulted by `retrieve()` itself ONLY on an
  // exact top-score tie (see source.js's own doc comment) — a low, cheap,
  // always-safe-to-check bar deciding what is POSSIBLE, wired unconditionally;
  // the function's own null-band clearing is the high bar deciding what is
  // PROBABLE. Absent (every existing caller), retrieve()'s own byte-identical
  // tiebreak (earliest chunk wins) is untouched.
  shapeFallback = null,
  // The tower (P175/P132): the stream's own coverage history, the engine's
  // null apparatus, and whether the audit above has licensed the measured cut.
  coverageHistory = [],
  nul = null,
  useMeasuredCut = false,
  // THE STREAM'S OWN BELIEF ABOUT THIS TURN (P145/P148). A FUNCTION, not a
  // value: only the caller holds the stream's history, and only the reading
  // knows its own coverage — the cell that makes the belief worth anything
  // (0.0100 bits without it, 0.0638 with). So it is threaded straight to
  // strainOf, which computes coverage and calls it there. This module never
  // calls it and never imports prequential.js. Absent — every existing
  // caller — strain decides exactly as before and nothing here changes.
  expect = null,
  // True only for the single flat part a plain chat question runs as
  // (runHolonicTask's planMode "flat" — the part's own words ARE the whole
  // conversation, never a plan-scoped slice). Distinguishes this part from
  // a decomposed part, whose narrow scoping is deliberate: `strayed` below
  // already discloses rather than silently widens when a part's words share
  // nothing with the task. A flat part gets no such protection by staying
  // narrow — the opposite failure is the live one: asked "prove it" after a
  // weather question, the part's own words are the whole content, and
  // retrieval on "the question prove it" alone shares no term with whatever
  // this turn just fetched to answer it. Default false so every existing
  // caller — every decomposed part — is byte-identical to before.
  flat = false,
  // The fact that a preflight web search ran BEFORE this part and found
  // nothing — a string naming what was searched, or null when no search
  // happened at all (never attempted and attempted-and-empty must read as
  // different facts to the model, not the same silence). Flat only, and
  // only reaches the chat branch below (a part that HAS passages already
  // knows the surf turned something up; this is specifically the void).
  searchedVoid = null,
  // The conversation's own recent voice, measured after the last exchange
  // (arcs.js + pathos-turn.js): when the arc went flat or its ground
  // failed, the next turn is told the FACT about its own recent answers
  // (the same information-not-instruction posture searchedVoid/priorPass
  // already hold — P55). Flat only, same reach as searchedVoid: a
  // decomposed part's narrow prompt is scoped to its part, never to the
  // conversation's voice. Computed by the caller, threaded straight
  // through. Null (every existing caller) is byte-identical to before.
  voiceCue = null,
  // Whether the PERSON has material attached at all (app.js's own
  // `Object.keys(state.sources).length > 0`), independent of whatever this
  // turn's own `chunks`/`passages` happened to filter down to — threaded
  // straight through, task-wide, for the identical reason `searchedVoid`
  // is. UNRETRIEVED_MATERIAL_PREFIX's own header (above) says why this is
  // a distinct fact from "chunks is non-empty": `false` (every existing
  // caller) is byte-identical to before this existed.
  sourcesAttached = false,
  // THE TURN'S OWN DATE — a fact, never an instruction (P55's posture,
  // exactly like searchedVoid and answerShape above). Found live
  // (2026-09-08, battery-tested "Rapid topic hopping"): asked about "the
  // new iphone" with nothing attached, a small model answered from its own
  // training with no way to know that training might be stale, because
  // nothing in any prompt this instrument builds had ever told it what
  // "now" even is — the model cannot reason about currency of a "current/
  // latest/new X" question against a date it was never given. This does
  // not replace checking: a claim the material states or contradicts is
  // still corrected exactly as before. It is the one fact that lets the
  // model's OWN reasoning notice a "new/current/latest" question might be
  // asking about something past its own training, on the turns where no
  // material settles it either way. Flat only (searchedVoid's own scope):
  // a decomposed piece section states its date if it ever needs to, this
  // is for the ordinary chat question. `null` — every existing caller —
  // is byte-identical to before this existed.
  now = null,
  // HOW BIG THE ANSWER SHOULD BE, measured before the model drafts — never
  // a length the model guesses at (2026-08-27, user direction: "the vast
  // majority of 'reasoning' [should] be mechanical, and the result of the
  // reasoning is a very simple prompt to the model, with the smallest
  // context possible").
  //
  // The measured failure this closes: "What is the capital of France?" —
  // one city, one word — came back as five sentences of hedged
  // meta-commentary ("The passages consistently establish that Paris
  // functions as France's capital city, with multiple sources explicitly
  // identifying it as such...") after two correction rounds and 214
  // seconds. The model was not being evasive; it had no idea how much
  // answer was wanted, so it padded to the size of its own uncertainty and
  // the checker then punished the padding as unsupported claims. AN
  // UNMEASURED SLOT GETS FILLED WITH HEDGING.
  //
  // The size is not a new measurement — it is `void-brief.js`'s already-
  // declared cardinality, which app.js computes BEFORE this call (moments 1
  // and 2, both ahead of any drafting). A caller with no void passes null
  // and every branch below is byte-identical to before this existed.
  answerShape = null,
  // The reader's own notes on particular loops (loops.js, 2026-09-08: "add a
  // prompt or similar injected into particular loops"), already phrased by
  // the caller in the reader's own words ("The reader adds, about the form:
  // make it rhyme."). Task-wide and flat only, like answerShape: a fact the
  // mouth is handed, never an instruction stacked on the prompt. null →
  // byte-identical to before.
  readerNotes = null,
  // S1's own answer text, or null when there was no fast pass (or the S2
  // gate never fired). Flat only, reaching both the chat branches and the
  // flat material branch (unlike searchedVoid, S1's answer stays relevant
  // once material exists too — "here's what a fast pass said, check it
  // against what you now have"). See priorPassFor, above.
  priorPass = null,
  // THE COMPOSITION SEAM (composition-gate.js), armed by the caller with a
  // DECLARED EXPERIENCER — who undergoes this answer. When armed, the
  // model's draft is INPUT, never output: the seam composes the shipment
  // from verified parts (verbatim quotes, witness-stated sentences,
  // grounded sentences, offered passages), withholds everything else by
  // name, and refuses any harm-class sentence at the seam. Absent (null,
  // every existing caller), the part is byte-identical to before — the
  // seam is additive, and arming it is the caller's own decision.
  //
  // The experiencer is the pathos law moved to the moment of generation:
  // an answer for no one is an answer about no one, and an answer about no
  // one can say anything. Arming the seam means declaring who undergoes
  // what is about to be said — the one act the whole ethos rests on. A
  // caller that cannot declare one is not freed of the law; it simply has
  // not armed the seam, and the unarmed part is disclosed as unarmed.
  shipExperiencer = null,
  // The seam's harm law, injected (composition-gate.js's own rule: the law
  // is closed, auditable, and never hardcoded here). Defaults to the
  // seam's own default when the seam is armed and no law is
  // supplied.
  shipHarmLaw = null,
  onProgress = null,
  // The shared, app-wide belief record (P38's own "the hypergraph records
  // beliefs" direction) — the SAME log `/act`/the terminal already write
  // to (CLAUDE.md, "the chat's own /act door": `state.gridLog`, one log,
  // not per-conversation). All four null together (the default) is
  // byte-identical to before this existed — landCompletenessBelief's own
  // header states the same backward-compatibility discipline every other
  // organ in this file already holds. `grid`/`runCapacity`/`landAct` are
  // the organs (grid.js's makeGrid instance, capacity-runner.js's two
  // exports); `gridLog` is the mutable state threaded in and the updated
  // state threaded back out via this function's own return value, the
  // same accumulation shape `foldedRefs`/`seenRefs` already use one level
  // up in runHolonicTask.
  grid = null,
  gridLog = null,
  runCapacity = null,
  landAct = null,
  // The typed-note ledger (hyperlexicon.js, P57) — same shape and same
  // backward-compatibility discipline as grid/gridLog just above: `hyperlexicon`
  // is the organ bundle (makeHyperlexicon's own {admit, foldHyperlexicon, ...}),
  // `hyperlexiconLog` is the mutable, app-wide, cross-turn state threaded in and
  // threaded back out. Both null (the default) is byte-identical to before this
  // existed — no existing caller's behavior changes.
  hyperlexicon = null,
  hyperlexiconLog = null,
  // NO VIEW FROM NOWHERE (kernel/notes.js). The frame a fresh ledger is
  // created under — what the reader stood on: which organs, which priors
  // loaded, which deliberately absent. app.js declares it from the reader
  // it actually built; a ledger created here without one carries the gap
  // by name (`frameOf` → no_frame), never an invented standing.
  hyperlexiconFrame = null,
  // The frame's recipe id (kernel/notes.js::recipeId over hyperlexiconFrame),
  // carried on every witness this part lands as `<ref>~<recipe>` so two
  // sources read by ONE reader count as one instrument (corroboration.js::
  // independentReadings) — and the ledger's frame is redeclared when it has
  // moved since birth. `null` (every existing caller) leaves witnesses bare
  // and undeclared, exactly as before.
  hyperlexiconRecipe = null,
  hyperlexiconUnread = [],
  hyperlexiconDerived = [],
  // The voids the reader declared (S70 / P105): typed emptiness over an
  // extent WITH its scope, relayed to the mouth as a declared gap — never
  // as "false", never as the mouth's own finding.
  hyperlexiconVoids = [],
  // The door's own grammar gate (hyperlexicon.js::admit's classifyConnector
  // — asymmetric, P56: a settled non-verb connector is refused with its
  // giver, an out-of-vocabulary word admits). Threaded, never built here:
  // the lens is app.js's to construct from the POS prior it already
  // fetches, and `null` (the default for every existing caller) leaves the
  // admit call byte-identical to before this existed — a check that did
  // not run never reports a pass (P41), and the door's own header says the
  // same. Measured need (eval/hyperlexicon-door-probe.mjs): unthreaded,
  // 18 of 29 notes admitted from real prose carried a closed-class label
  // (—and→, —of→, —to→…) into the belief ledger.
  classifyConnector = null,
}) {
  // Stable sub-assemblies (2026-08-19, user direction). The part's own words
  // and the fold's discourse line are two DIFFERENT assemblies, and the old
  // unconditional concatenation let one contaminate the other: measured
  // live, "research Robert Macnamera" asked right after a greeting retrieved
  // greeting-etiquette passages, because the stale topic's words ("Greeting
  // exchange · …") rode into the query on spec and out-voted a misspelled
  // name that matched nothing. The discourse anchor exists for the OPPOSITE
  // case — a topic-less follow-up ("prove it") whose own words anchor
  // nothing — so the join is now earned by measurement, never assumed:
  // retrieve on the part's own words first; only when that comes back EMPTY
  // does a flat part widen with the discourse line, and the widening is
  // disclosed on the research progress event rather than folded in silently.
  //
  // The label joins the query only for a DECOMPOSED part, where it is a
  // real, model-authored search phrase ("Nashville founding year"). A flat
  // part's label is never that — `runHolonicTask` hardcodes it to the
  // literal string "the question" (a narration constant: it is what turns
  // the progress line into "the question: 3 passage(s) retrieved", nothing
  // more), so joining it here folded the bare word "question" into every
  // flat retrieval query regardless of what was actually asked. Measured
  // live 2026-08-19: "who was abraham lincoln's vice president?" retrieved
  // a passage about "the slavery question" at the 1860 Democratic National
  // Convention over the material's own Hamlin/Johnson succession-box facts,
  // on that one shared, meaningless word — the model then had a real answer
  // sitting in the same material and a spurious one ranked ahead of it, and
  // (being small) narrated the wrong one instead of answering. This is a
  // sibling of the "Write this part: the question. …" bug the flat/decomposed
  // prompt split above already fixed the SAME day for the model-facing
  // text — the meta label leaked into content here too, just one layer
  // over, in the query rather than the prompt.
  const pick = (chunks, q, limit, folded) => (retrieveWith ? retrieveWith(chunks, q, limit, folded) : retrieve(chunks, q, limit, folded, { shapeFallback }));
  const partWords = flat ? part.description : `${part.label} ${part.description}`;
  const live = chunks ?? [];
  let question = partWords;
  let passages = live.length ? pick(live, question, passagesPerPart, foldedRefs) : [];
  let widened = false;
  if (!passages.length && flat && discourse && live.length) {
    question = `${partWords} ${discourse}`;
    passages = pick(live, question, passagesPerPart, foldedRefs);
    widened = passages.length > 0;
  }
  // THE SEARCH DIGEST IS PINNED, never left to win a retrieval slot.
  //
  // gatherPreflightMaterial already combines every search result's snippet
  // into ONE chunk (`web:search-results`) precisely because the snippets
  // are pre-snipped, high-relevance, already-paid-for material — its own
  // comment says so. But it was then dropped into `live` alongside the
  // fetched full pages and had to out-score them: measured live 2026-08-26,
  // one Lincoln turn had 1,449 passages competing for 3 slots, the digest
  // lost, and the model answered from three Johnson-heavy page passages
  // while the digest sentence sitting unused read "Hannibal Hamlin and
  // Andrew Johnson, the two vice presidents of Abraham Lincoln". Same
  // question on another draw won the digest and answered correctly — the
  // variance was never about the model, it was a retrieval lottery.
  //
  // Why pinning rather than re-ranking: the digest is not competing on
  // relevance, it is a different KIND of material — a whole results page
  // condensed, ~2.7KB, complete by construction, where a full page is
  // 50-160K of prose with one relevant paragraph. Scoring them against each
  // other on keyword overlap is the category error; every snippet repeats
  // the query's own words, which is exactly why they tie and why the
  // tie-break decides the answer. Cost is one extra passage per part,
  // bounded and cheap, and it is additive: retrieval's own picks are
  // untouched, so nothing that used to reach the model stops reaching it.
  // A PIECE's section whose own retrieval came back thin declares its gap
  // and hunts for it (P110: the per-section void, filled by a search on the
  // section's own words) — once, bounded by the caller's leash, and the
  // hunted pages join this part's pool so retrieval can pick from them.
  let hunted = null;
  let livePool = live;
  // Up to `hunts` rounds (P123): each round a different query off the
  // section's own words — its label, then its description, then the topic
  // alone — and the round stops as soon as retrieval is no longer thin.
  const thin = () => passages.filter((p) => !String(p?.ref ?? "").startsWith("web:search-results")).length < passagesPerPart;
  if (piece?.huntFor && thin()) {
    const queries = [...new Set([`${part.label} ${piece.topic ?? ""}`.trim(), `${part.description ?? ""} ${piece.topic ?? ""}`.trim(), String(piece.topic ?? "").trim()].filter(Boolean))];
    const rounds = [];
    for (let round = 0; round < hunts && round < queries.length && thin(); round++) {
      const query = queries[round];
      try {
        const found = await piece.huntFor(query);
        if (Array.isArray(found) && found.length) {
          livePool = [...livePool, ...found];
          passages = pick(livePool, question, passagesPerPart, foldedRefs);
          rounds.push({ query, chunks: found.length, passages: passages.length });
        } else rounds.push({ query, chunks: 0, passages: passages.length });
      } catch (e) { rounds.push({ query, error: String(e?.message ?? e) }); }
    }
    hunted = rounds.length ? { ...rounds[0], rounds } : null;
  }
  // A question about the conversation is answered from the conversation. The
  // prior turns join the passages as addressed testimony (`turn:N`), so every
  // organ below reads them the same way it reads a source — and the ladder
  // places them on the record, never in the material.
  let recalledTurns = [];
  if (transcript.length && isAboutConversation(task || question)) {
    recalledTurns = recallTurns(task || question, transcript);
    if (recalledTurns.length) passages = [...recalledTurns, ...passages];
  }
  // RETRIEVAL HONOURS THE CITATION (P135). A question that names its source
  // must be answered from that source: scoping a check to a file that was
  // never retrieved silently falls back to everything, which is the very
  // failure the scoping exists to stop. Measured live (2026-09-06): asked
  // about a claim "from lincoln.html", retrieval returned only the War and
  // Peace chunk — because the planted name is a Tolstoy name — and the cast
  // check then ran against Tolstoy and called the Lincoln article's own
  // "Yosemite Grant" a stranger.
  const citedFile = citedSource(task || question);
  if (citedFile) {
    const fromCited = (live ?? []).filter((c) => String(c?.ref ?? c?.source ?? "").includes(citedFile));
    if (fromCited.length && !passages.some((p) => String(p?.ref ?? p?.source ?? "").includes(citedFile))) {
      const best = pick(fromCited, question, 1, foldedRefs);
      if (best.length) passages = [...best, ...passages].slice(0, Math.max(passagesPerPart, best.length));
    }
  }
  const digestChunk = livePool.find((c) => String(c?.ref ?? "").startsWith("web:search-results"));
  if (digestChunk && !passages.some((p) => p.ref === digestChunk.ref)) {
    passages = [digestChunk, ...passages];
  }

  // GFP PASS 35 — THE SHADOW OFFERED BESIDE LEXICAL. The shadow is recalled
  // from the question after the lexical path has had its whole turn (hunts,
  // transcript recall, the citation, the digest pin) so its seat is a
  // witness over the SAME retrieval, never a competing start. What settles
  // is compared against this turn's own pool: held already → agreement;
  // in the pool but missed → promoted (offered, marked); outside the pool →
  // recorded and NOT offered — the memory recalls everything it has ever
  // read, and the mouth only ever sees this turn's material. Shadows and
  // echoes (THE_SHADOW / THE_ECHO — recall-only, no words) cannot be
  // offered at all.
  let fieldWitness = null;
  if (fieldRecall && question && live.length) {
    const lexicalRefs = passages.map((p) => p.ref);
    try {
      const offer = fieldRecall(question);
      if (offer && (offer.kind === "figure" || offer.kind === "ambiguous") && Array.isArray(offer.passages) && offer.passages.length) {
        const inPool = (p) => live.some((c) => (c?.ref && c.ref === p.ref) || (c?.text && c.text === p.text));
        const already = (p) => passages.some((q) => (q?.ref && q.ref === p.ref) || (q?.text && q.text === p.text));
        const agreed = offer.passages.filter((p) => already(p));
        const promoted = offer.passages.filter((p) => inPool(p) && !already(p));
        const beyondPool = offer.passages.filter((p) => !inPool(p));
        const offered = promoted.slice(0, FIELD_OFFER_MAX).map((p) => ({ ...p, retrievedVia: "relative" }));
        if (offered.length) passages = [...passages, ...offered];
        fieldWitness = {
          kind: offer.kind,
          band: offer.band ?? null,
          lexical: lexicalRefs,
          recalled: offer.passages.map((p) => p.ref),
          agreed: agreed.map((p) => p.ref),
          promoted: offered.map((p) => p.ref),
          beyondPool: beyondPool.map((p) => p.ref),
        };
      } else if (offer) {
        fieldWitness = { kind: offer.kind, band: offer.band ?? null, lexical: lexicalRefs, recalled: [], agreed: [], promoted: [], beyondPool: [] };
      }
    } catch (e) {
      fieldWitness = { kind: "error", error: String(e?.message ?? e), lexical: lexicalRefs };
    }
  }

  const sourceBlock = buildSourceBlock(passages);
  onProgress?.("research", part, { passages: passages.map((p) => p.ref), widened, ...(fieldWitness ? { fieldWitness } : {}) });

  // The plan steers this part's retrieval — that is what a plan is for — but
  // steering is disclosed, never silent: a part whose words share nothing
  // with the task searched on vocabulary the task never contained, and that
  // fact is a typed entry in the part's own gaps, not a thing to notice later.
  const taskTerms = new Set(tokenize(task));
  const strayed =
    taskTerms.size > 0 && !tokenize(question).some((t) => taskTerms.has(t));

  let draft = "";
  let check = null;
  let corrections = 0;

  // Built once per part from its own passages — names resolve against the
  // cast the material itself establishes (cast.js), never a wider corpus.
  const resolveName = makeNameResolver?.(passages) ?? null;
  // THE REFERENT INDEX (cast.js makeReferentIndex): names in a question, an answer
  // or a claim are candidates; `resolve(name)` decides what they name in THIS
  // material. Every dialogue loop below asks it; none compares strings.
  const referentIndex = makeReferentIndexFor ? (() => { try { return makeReferentIndexFor(passages); } catch { return null; } })() : null;

  // The relation tier (hypergraph.js), built the same way: the material's
  // own edges from this part's passages, the closed-class measure from the
  // live corpus. Injected — this module stays pure and the page supplies
  // the engine's organs.
  const relations = passages.length ? makeRelationReader?.(passages, { pool: livePool }) ?? null : null;
  // Obligations (P110): the cast the section's own passages establish.
  // Prose passages only: a code file's "cast" is its identifiers (P113).
  const prosePassages = passages.filter((p) => !isCodeSource(p?.source ?? p?.ref, p?.text) && !isTranscriptPassage(p));
  const obligations = piece?.referentIndexFor && prosePassages.length ? obligationsFrom(piece.referentIndexFor(prosePassages)) : [];
  if (piece && obligations.length) piece = { ...piece, obligations };
  // THE SNIPS (P122): the verbatim, addressed sentences of this section's
  // prose passages that carry its obligations and its topic — what the
  // section is handed to write from, and what every number, date and name
  // it writes is checked against afterwards, with no model.
  const snips = piece ? snipsFor(prosePassages, { obligations: piece.obligations ?? [], terms: topicTerms(piece.topic ?? "") }) : [];

  // hyperlexicon.js (P57): admit this part's own bound claims into the
  // shared, cross-turn ledger — accumulation, not re-derivation on every
  // part. `hyperlexicon`/`hyperlexiconLog` absent (the default for every
  // existing caller) leaves `beliefNotes` at `hyperlexiconLog` (null) and
  // touches nothing downstream — byte-identical to before this existed,
  // the same discipline `grid`/`gridLog` already hold above.
  let beliefNotes = hyperlexiconLog;
  // Every refusal the door types comes back out (P57: `turnedAway` is not
  // optional) — accumulated here and returned beside the log, never read
  // and discarded. With no classifyConnector this stays empty for the
  // connector reason but still carries the door's own structural refusals
  // (incomplete edges, unaddressed spans), exactly as admit types them.
  const hyperlexiconTurnedAway = [];
  if (hyperlexicon && relations) {
    // ONE implementation with the arrival reader (read-on-arrival.js, P99):
    // the per-turn path admits exactly as the background read does — the
    // loop that lived here moved there verbatim (ledger born on the first
    // bound edge, frame redeclared on drift, witness `<ref>~<recipe>`,
    // refusals returned never discarded).
    // A PRIOR ANSWER IS NEVER ADMITTED AS MATERIAL (P128). The ledger holds
    // what the SOURCES establish; letting the mouth's own earlier words in
    // would make the model its own witness — self:model may never corroborate
    // itself (P2), and a claim would gain standing by being repeated.
    const admitted = admitPassages(hyperlexicon, beliefNotes, passages.filter((p) => !isCodeSource(p?.source ?? p?.ref, p?.text) && !isTranscriptPassage(p)), {
      read: (text) => relations.read(text),
      witnessFor: (p) => (p.ref ? (hyperlexiconRecipe ? `${p.ref}~${hyperlexiconRecipe}` : p.ref) : null),
      classifyConnector,
      frame: hyperlexiconFrame,
    });
    beliefNotes = admitted.log;
    hyperlexiconTurnedAway.push(...admitted.turnedAway);
  }

  // HYPERGRAPH-FIRST-GENERATION.md, Phase 2: the material's own extracted
  // facts, read BEFORE the model drafts — reusing the SAME `relations`
  // reader `inspect` (below) uses to check a draft, called here on the
  // passages themselves instead. Real, disclosed partial coverage
  // (fact-block.js's own header); supplements `sourceBlock`, never
  // replaces it. `null` on a decomposed part with no `relations` organ
  // injected, or on any part where nothing bound — every existing caller
  // that never reaches this line is unaffected.
  const factBlock = relations ? buildFactBlock(relations, passages, question) : null;

  // The ledger's own standing beyond what this part just read — every
  // note is DISCLOSED with its standing, never withheld for lacking one.
  // Until 2026-09-02 this block admitted only notes at >=2 distinct
  // sources and rendered EMPTY on nearly everything the reader had heard:
  // a whole real book corroborates 1 note in 60 asks (P83 — fiction
  // re-mentions referents, not propositions), two encyclopedia pages 1 in
  // 30. The gate was chosen when the door admitted junk (P73); the door is
  // clean now (P74, P82), and a note with a verified address, real ends
  // and a real label is a CLAIM SOMEONE MADE, addressed — what it lacks is
  // restatement elsewhere, which is said on the line, not used to hide the
  // line. Nothing here is a claim about what is true: the ledger is the
  // richest map of what claims are made, and by whom, about the truth.
  // Two tiers inside one declared budget: corroborated notes first
  // (kernel standingOf — DISTINCT SOURCES, never witness-list length;
  // a sighting and a testimony vote from one page are one perspective),
  // then single-witness notes ranked by shared vocabulary with THIS
  // part's own question (proposeCandidates — the same ranker the witness
  // walk proposes from), so what reaches the model is what bears on what
  // was asked. A note a PRIMARY source states (ranke.js — the chase
  // through a citing page to the sources it cites) is named as such: the
  // model reads "a source it cites states it", not a bare count.
  // Firewall-clean (firewall.js's APPARATUS_TERMS): "read in N places",
  // "read once", "a source it cites" — natural-frequency phrasing, no
  // "passage"/"retrieved"/"this turn". Deduped against factBlock's own
  // fresh lines so nothing doubles.
  const HYPERLEXICON_LEDGER_LINES = 5;
  // A question asked mid-read is told what has not been read yet (P99): a
  // typed extent, phrased as a fact about the reader's progress, never as
  // "the material says nothing".
  const readingNote = (Array.isArray(hyperlexiconUnread) && hyperlexiconUnread.length)
    ? `Still reading: ${hyperlexiconUnread.map((u) => `${u.name} — ${u.read} of ${u.total} passages so far`).join("; ")}. What follows is from the part already read.`
    : null;
  // The ledger's notes folded ONCE with their standing; the ledger block, the lens and the paradigm all read these rows.
  const foldedNotesRaw = (hyperlexicon && beliefNotes) ? (hyperlexicon.foldWithStanding ? hyperlexicon.foldWithStanding(beliefNotes) : hyperlexicon.foldHyperlexicon(beliefNotes).map((n) => ({ ...n, sources: distinctSources(n.witnesses).size, standing: distinctSources(n.witnesses).size >= 2 ? "corroborated" : "single-witness", kinds: {} }))) : [];
  // SCOPED TO WHAT THIS TURN HAS IN PLAY (attachment/mute isolation bug,
  // 2026-09-08 battery). `beliefNotes` is the app-wide, cross-session ledger
  // (P57/P98) — a note it carries can be from a source read in an unrelated
  // earlier conversation, or from a source this very conversation has since
  // muted (reading-on-arrival admits a source's claims the moment it is
  // attached, and mute is deliberately a RETRIEVAL concept, so silencing a
  // source afterward never retracts what was already heard from it). Nothing
  // upstream of this line ever re-checks a note's witnesses against what is
  // actually live, so a note stood on nothing but a silenced or long-gone
  // source rode both the ledger block and resolutionBlocks' "cited on this
  // ground" line unchanged. Measured live: two files explicitly unchecked
  // before any question was asked, a third file attached and enabled, and
  // the answer's own grounding line still read "Cited on this ground so
  // far: 1 place in pasted-2.txt" — pasted-2.txt was one of the two muted
  // files, never touched by this turn's own retrieval.
  //
  // Gated on `sourcesAttached`, not on `live.length`, to leave P84 (harbor-
  // note incident, above) untouched: a genuinely bare conversation with
  // nothing ever attached still stands on earlier reading (`live` is `[]`
  // there too, and nothing this turn could silence). Once something IS
  // attached, a note is offered only when at least one of its witnesses
  // names a source this turn actually holds live — corroboration from a
  // source outside that set is real and stays on the note (`sources`/
  // `standing` untouched), but a note with no live witness at all is not
  // this turn's to surface.
  const liveNoteSources = new Set(live.map((c) => c.source));
  const foldedNotes = sourcesAttached
    ? foldedNotesRaw.filter((n) => (n.witnesses ?? []).some((w) => liveNoteSources.has(sourceOfWitness(w))))
    : foldedNotesRaw;
  const ledgerBlock = (() => {
    if (!hyperlexicon || !beliefNotes) return readingNote;
    const shown = new Set((factBlock?.allLines ?? []).map((l) => l.toLowerCase()));
    const line = (n) => `${n.subject} — ${n.verb}→ ${n.object}`;
    const all = foldedNotes
      .filter((n) => !shown.has(line(n).toLowerCase()));
    // BOTH tiers are ranked by the question. Measured (gate-proof.mjs,
    // 2026-09-03): with the corroborated tier unranked, 21 corroborated
    // notes filled the five-line budget on every question — the asked
    // single-witness note reached the model on 1 of 8 questions, and a
    // question about nothing the ledger holds still got a block of
    // unrelated notes. Shared vocabulary with the question first, then
    // standing as the tiebreak; a note sharing nothing is not shown, and
    // a question the ledger has nothing on gets no block at all.
    // The question's own interrogative furniture is not vocabulary: "what"
    // is a feature of every question and of any note that quotes one, so
    // a control question about a committee no ledger holds still drew a
    // block on "what" alone (gate-proof.mjs run 2). grounding.js's
    // CLAIM_STOPWORDS is the received list that already carries the
    // interrogatives; the note side is untouched.
    const questionFeatures = (q) => new Set([...textFeatures(q)].filter((w) => !CLAIM_STOPWORDS.has(w)));
    const ranked = proposeCandidates(all, String(question ?? ""), { limit: all.length, featuresOfSource: questionFeatures })
      .sort((a, b) => b.shared - a.shared || (b.note.sources ?? 0) - (a.note.sources ?? 0))
      .slice(0, HYPERLEXICON_LEDGER_LINES)
      .map((c) => c.note);
    const corroborated = ranked.filter((n) => n.sources >= 2);
    const single = ranked.filter((n) => n.sources < 2);
    // The DERIVED tier (Pass 21 / P102): facts no source states, composed
    // under a declared giver from claims already read (derivation.js,
    // SYN·Pattern·derived). Ranked by the question like the others, and
    // phrased with their fragility — how many claims each rests on, and
    // whether the weakest of them was stated once or in more than one place
    // (restsOn is the MIN, P89) — never as a settled thing.
    const derivedRows = Array.isArray(hyperlexiconDerived) ? hyperlexiconDerived.filter((d) => d && d.subject && d.verb && d.object) : [];
    const derived = derivedRows.length
      ? proposeCandidates(derivedRows, String(question ?? ""), { limit: derivedRows.length, featuresOfSource: questionFeatures })
          .sort((a, b) => b.shared - a.shared)
          .slice(0, HYPERLEXICON_LEDGER_LINES)
          .map((c) => c.note)
      : [];
    // The VOID tier (Pass 23 / P105): what the reader looked for and did not
    // find, said with its scope — how many sources, how far read — as an
    // open gap the first arrival cancels. The mouth relays a declared void;
    // it never declares one (THE-NULL-STATES, law 6).
    // The caller's voids when it hands some (app.js's voidsNow); otherwise the LEDGER's own declared voids — a void the turn itself declared last time reaches the mouth this time (P105, closed for callers that hand none, 2026-09-07).
    const voidSource = Array.isArray(hyperlexiconVoids) && hyperlexiconVoids.length ? hyperlexiconVoids : (hyperlexicon?.foldVoids && beliefNotes ? (() => { try { return hyperlexicon.foldVoids(beliefNotes); } catch { return []; } })() : []);
    const voidRows = Array.isArray(voidSource) ? voidSource.filter((v) => v && v.subject && v.verb).map((v) => ({ ...v, object: v.object ?? "?" })) : [];
    const voids = voidRows.length
      ? proposeCandidates(voidRows, String(question ?? ""), { limit: voidRows.length, featuresOfSource: questionFeatures })
          .sort((a, b) => b.shared - a.shared)
          .slice(0, HYPERLEXICON_LEDGER_LINES)
          .map((c) => c.note)
      : [];
    const voidPhrase = (v) => {
      const sc = v.scope ?? {};
      const over = Array.isArray(sc.sources) && sc.sources.length ? `looked for in ${sc.sources.length} source${sc.sources.length === 1 ? "" : "s"}` : "looked for in what was read";
      const far = Number.isFinite(sc.read) && Number.isFinite(sc.total) ? (sc.read >= sc.total ? ", all of it read" : `, ${sc.read} of ${sc.total} parts read so far`) : "";
      return `${over}${far}`;
    };
    if (!corroborated.length && !single.length && !derived.length && !voids.length) return readingNote;
    // A note under a live dispute says so (P88's act reaching the mouth,
    // Pass 20 / P101): who denies it, and that it is not settled — the
    // reader is told of the disagreement, never handed a conviction.
    const disputed = (n) => {
      const by = (n.disputedBy ?? []).map((d) => (typeof d === "string" ? d : d?.source)).filter(Boolean);
      return by.length ? `; disputed by ${[...new Set(by)].join(", ")} — not settled` : "";
    };
    const phrase = (n) => {
      const primaries = n.kinds?.primary ?? 0;
      if (primaries && n.sources >= 2) return `read in ${n.sources} places, one of them a source the account itself cites${disputed(n)}`;
      if (n.sources >= 2) return `read in ${n.sources} places${disputed(n)}`;
      return `stated once so far, nowhere else yet${disputed(n)}`;
    };
    const render = (list) => list.map((n) => `- ${line(n)} (${phrase(n)})`).join("\n");
    const derivedPhrase = (d) => {
      const n = (d.premises ?? []).length;
      const weakest = d.restsOn?.sources ?? 0;
      return `follows from ${n} earlier claim${n === 1 ? "" : "s"}, never stated itself; the weakest of them ${weakest >= 2 ? "read in more than one place" : "stated once so far"}${d.restsOn?.contested ? `; ${d.restsOn.contested} of them disputed` : ""}`;
    };
    return [
      readingNote,
      corroborated.length ? `From earlier reading, stated in more than one place:\n${render(corroborated)}` : null,
      // THE STANDING IS THE FACT; "one account's claim, not a settled one" was a
      // verdict laid over it, and the mouth relays verdicts as caution. Measured
      // 2026-09-16 (gemma2:2b, 10 seeds, the live Grant re-ask verbatim): with the
      // clause, 2 of 10 answers added "not definitively settled and should be
      // treated with caution"; without it, 0 of 10, and the answers attribute the
      // pamphlet's Georgetown instead. Each line still says "stated once so far,
      // nowhere else yet" (P84: disclose standing, as a fact, never a judgment).
      single.length ? `From earlier reading, stated once so far and bearing on this question:\n${render(single)}` : null,
      derived.length ? `From earlier reading, derived — no source states these; each follows from claims already read, and falls with them:\n${derived.map((d) => `- ${line(d)} (${derivedPhrase(d)})`).join("\n")}` : null,
      voids.length ? `Nothing here states these, and that is the answer — say it plainly, it is not yours to fill in:\n${voids.map((v) => `- ${v.verb === "appears" || v.verb === "is" ? `${v.subject} is not stated` : `whether ${v.subject} ${v.verb} is not stated`} in what was read (${voidPhrase(v)})`).join("\n")}` : null,
    ].filter(Boolean).join("\n\n");
  })();

  // The salience gate's other half (fact-block.js's own header): the raw
  // MATERIAL block, deduplicated of near-identical restatements BEFORE it
  // reaches the model — real, measured need, same live pass: a
  // `web:search-results` chunk's own ordinary shape (several pages'
  // short bios concatenated) restated "Hannibal Hamlin, 15th vice
  // president, 1861-65" in six differently-worded snippets in one real
  // captured prompt. `dedupedSourceBlock` is PROMPT-ONLY — `sourceBlock`
  // itself (untouched, above) still backs succession-box parsing, the
  // correction prompts, and everything else this function's own
  // `sourceBlock` comment already disclosed staying out of this dedup's
  // reach.
  const dedupedSourceBlock = passages.length ? buildSourceBlock(dedupeSourceText(passages, relations)) : sourceBlock;

  const inspect = (text) => {
    // The label is model-authored output that ships as a heading, so it is
    // checked with the draft — a figure invented in a label is the same
    // failure as one invented in a sentence, and must land in the same list.
    const shipped = `${part.label}\n${text}`;
    const { used, unsupported } = checkCitations(shipped, passages);
    // Symmetric with retrieval above: the discourse joins the grounding
    // question only where the task's own words demonstrably failed to
    // anchor — retrieval had to widen, or there are no passages at all (the
    // P23 no-material case this anchor was built for, where the folded
    // question is what keeps a topic-less follow-up's proof search on the
    // real conversation). A part whose own words retrieved its material
    // keeps its own words: the findings' sentences, and every proof query
    // built from them, stop inheriting a stale topic's vocabulary.
    const groundingQuestion =
      flat && discourse && (widened || !passages.length)
        ? `${task} ${part.description} ${discourse}`
        : `${task} ${part.description}`;
    const checkedGrounding = checkGrounding(shipped, passages, {
      question: groundingQuestion,
      resolveName,
    });
    // No material means checkGrounding rightly declines to examine anything
    // (its `examined: false` is a deliberate fact, not a gap — see
    // grounding.test.mjs). The constitutional question is what absence is
    // ALLOWED to mean: everywhere else in this ladder, "nothing to check
    // against" is a reason to withhold judgment, never a reason to convict.
    // extractCheckableAtoms exists to give proof-seeking candidates on a
    // genuine world-claim nobody sourced — a bare factual question with no
    // material at all (grounding.js's own docstring: "what percentage of
    // Earth's atmosphere is nitrogen"). It must not fire on a part whose
    // subject is an artifact the model just produced. A build's own account
    // of its own code ("initializes a counter", "adds click listeners") is
    // not a claim about the world nobody sourced — its ground is the code
    // sitting right next to it, which this ladder doesn't check prose
    // against because app.js already treats that ground as sufficient (the
    // 2026-08-17 build-turn amendment, CLAUDE.md). Manufacturing "unsupported
    // by definition" findings from bare absence, on a part that HAS a ground
    // just not one this ladder reads, produced exactly the failure that
    // amendment named live: a counter widget's own walk-through read back as
    // a wall of invented-claim chips. So the fallback is gated on the same
    // signal app.js uses to withhold its chip strip — a fenced code segment
    // in the part's own text — rather than repeating the mistake one layer
    // down under a different name.
    const isArtifactPart = parseSegments(text).some((s) => s.type === "code");
    const grounding = passages.length || isArtifactPart
      ? checkedGrounding
      : (() => {
          const findings = extractCheckableAtoms(shipped, { question: groundingQuestion });
          return { ...checkedGrounding, findings, clean: findings.length === 0 };
        })();
    const attributions = poolCoverage(text, passages, live);
    const attributed = attributedRefs(attributions);
    // The answer read against the material's own edges. Contradicted and
    // unbound edges are claims of fact the material does not make — they
    // join the unsupported list and drive the same bounded correction;
    // beyond-reach and unheard stay disclosure-only (limits of the
    // instrument, not failures of the answer).
    //
    // `text` alone, NOT `shipped` — unlike checkCitations/checkGrounding
    // above (which legitimately want a figure invented IN the label
    // caught too), relations.read() extracts SVO by a subject span that
    // can run up to two tokens across whitespace, INCLUDING a newline.
    // Measured live 2026-08-19 (the completeness-gate work): a flat
    // turn's label is literally "the question" (the hardcoded flat-mode
    // constant), so `shipped` reads "the question\nLincoln appointed
    // Hamlin…" — and the subject span bridged the newline, extracting
    // "question\nLincoln" as the claim's subject instead of "Lincoln".
    // The verdict itself still resolved correctly (endpoint() also
    // matches by surface substring, so "question\nLincoln" still found
    // the Lincoln referent) — but two claims for the SAME real subject
    // now carried two DIFFERENT subject strings, one polluted and one
    // clean, so a caller grouping claims by subject+verb (the
    // completeness gate, below) saw two distinct slots instead of one and
    // wrongly convicted an answer that had, in fact, named every filler.
    // A part's label is never itself a sentence worth relation-checking
    // (flat mode's is a constant with no content at all; a decomposed
    // part's is a short phrase), so nothing is lost dropping it here.
    // `stripFraming(text)`, NOT bare `text` (2026-08-20): this `inspect`
    // runs mid-loop, on a retry's raw completion, before the ship-time cut
    // (below, now just a call to the same stripFraming) has ever run — and
    // a correction retry echoing the question back as its opening line is
    // exactly the shape the ship-time cut exists to clean. Left unstripped,
    // that echoed line reaches relations.read() as content and the
    // extractor reads the QUESTION's own words as claims about the world.
    // stripFraming's own header has the measured incident (turn 23,
    // material-dialogue-stress-703.jsonl) and the direct reproduction.
    const relationReport = relations ? relations.read(stripFraming(text)) : null;
    // Every quotation followed to the bytes (quotes.js): a fabricated
    // quotation joins the unsupported list — the strongest claim an answer
    // makes gets the same bounded correction as an invented figure. That
    // includes a quotation fabricated only in PART: an ellipsis quotation
    // with one segment located nowhere is `partial`, and quoteFindings
    // reports it here (one line per invented segment, naming it) exactly
    // as it reports a wholly invented one — the located half is not a
    // warrant for the other half. `quoted` below is a whitelist for the
    // same reason: only wholly located quotations are a channel of
    // support. Drift repair happens once, after the correction loop, where
    // the final draft is rewritten to the source's own bytes and
    // re-inspected.
    const quotes = passages.length ? verifyQuotes(text, passages, { pool: live }) : null;
    return {
      used,
      attributed,
      refs: [...new Set([...used, ...attributed])],
      channels: [
        ...(used.length ? ["cited"] : []),
        ...(attributed.length ? ["attributed"] : []),
        ...(relationReport?.examined && !relationReport.vocabulary?.gap ? ["relations"] : []),
        ...(quotes?.quotes.some((q) => q.status === "verbatim" || q.status === "drifted") ? ["quoted"] : []),
      ],
      // Two lists now, because they are two kinds of fact (user-directed
      // 2026-08-17, propose-then-check). LIES about the given drive the
      // bounded correction: an address that was never offered, a fabricated
      // quotation, an edge the material states the opposite of. UNBACKED
      // knowledge — a name or figure the material is merely silent on, an
      // edge it never binds — ships and is MARKED: the wavy stripe, the ∅
      // badge, the proof-seeking door are that list's whole treatment.
      // Measured live before this split: "who was its mayor in 2019?" put
      // the true answer in the draft, the correction pass rewrote it away
      // for being unsupported, the rewrite collapsed into reproduction, and
      // the mechanical fallback shipped no mayor at all — the apparatus
      // deleting the one thing the reader asked for.
      unsupported: [...unsupported, ...relationFindings(relationReport, { verdicts: ["contradicted"] }), ...quoteFindings(quotes)],
      unbacked: [...unsupportedClaims(grounding), ...relationFindings(relationReport, { verdicts: ["unbound"] })],
      attributions,
      grounding,
      relations: relationReport,
      quotes,
    };
  };

  // Grounded is necessary; ANSWERING is the requirement. Two ways a draft
  // can be perfectly grounded and still fail the question, both measured
  // live and both threshold-free set/substring containment — SENTENCE-wise,
  // not whole-draft: a draft that opens by echoing the question and THEN
  // transcribes the passage is neither a whole-draft echo nor a whole-draft
  // substring, and the first version of this check missed it live (2026,
  // "Who is Anna Pávlovna Schérer?" followed by the entire chapter). Each
  // sentence is classified on its own; a sentence whose every content word
  // is already in the question is FRAMING, set aside; what remains is the
  // draft's actual content, and IT is what gets judged:
  //   echoed       — no content sentences survive framing: the prompt,
  //                  restated and nothing else. Run 6: 8/50 turns.
  //   reproduced   — either the content, rejoined, is one contiguous
  //                  verbatim stretch of an offered passage (the simple
  //                  whole-copy case), OR MORE OF THE ANSWER'S SUBSTANCE IS
  //                  COPIED THAN IS NOT — the same "present more often than
  //                  absent" cut cite.js's commonTerms already uses for
  //                  terms (`cut = pool.length / 2`), applied here to the
  //                  character mass of the answer's own sentences. The
  //                  second test is the one the first version of this check
  //                  missed live: real commentary sentences interleaved
  //                  between long verbatim quotations break contiguity, but
  //                  an answer that is mostly quotation with a little
  //                  commentary stitched between the quotes has still not
  //                  answered the question — it has annotated a photocopy.
  //                  Mass, not a count of sentences: a count measures the
  //                  material's punctuation habits, and a page of short
  //                  dialogue lines transcribed whole reads as clean under
  //                  one (see reproducedFromContent for the measurement).
  // Either verdict is a FAILURE that triggers the same bounded correction
  // pass as an unsupported claim, with the rewrite told exactly which
  // failure it is fixing. A draft still failing when the budget runs out
  // fails the part: no refs, typed open — an answer that does not answer
  // earns nothing.
  const questionWords = new Set(tokenize(`${task} ${question}`));
  const ADDRESS_RE = /\[?[^\s\]]+#\d+-\d+\]?/g;
  // ONE fold, applied to both sides of every containment below (P11). It is
  // source.js's `foldTypography`: the source's words, to the source's own
  // stops, with the typesetting shed. The fold that used to sit here folded
  // diacritics, case and whitespace only, so a model that retyped a chapter
  // while straightening its quotation marks, hyphenating its em dashes,
  // spelling its ellipsis with three dots or dropping one comma slipped past
  // every test below with the source's words intact — reproduction the
  // instrument reported clean (audit 2026-08-16).
  const passagesFolded = passages.map((p) => foldTypography(p.text));
  // A sentence that only NAMES the act of prompting is framing, not content:
  // "The question is: …", "You asked about …", "To answer your question …".
  // The tell is structural and closed-set — every surviving content token is
  // either the prompt's own word or one of a tiny set of act-naming words.
  // The set is the reason "The question is: hi." is caught at all: tokenize
  // drops "hi" (two letters) and the sentence survives as {"question"} alone.
  // This is a judgement in code, never a vocabulary list planted in a prompt
  // — the same L5/L2 discipline as grounding.js's stoplist and cite.js's veto.
  const ACT_WORDS = new Set([
    "question", "answer", "ask", "asked", "asks", "asking", "reply", "replied",
    "responding", "respond", "referring", "regarding", "concerning", "about",
    // Act-naming words measured live 2026-08-17 (three echoes in a row on
    // the Borodino material): "The question at hand is…", "…is addressed."
    // Each names the act of asking; none performs an answer.
    "addressed", "address", "hand", "matter",
  ]);
  // A code fence is STRUCTURE, never framing. Measured live: a Python
  // answer opened with ```python, whose one surviving token ("python") was
  // also in the prompt, so the fence read as a restatement — the trim below
  // dropped the opening fence and the block rendered as flattened prose
  // with an orphan ``` at the end, and no build was ever made from it.
  // Structure is not a claim about the prompt and cannot echo it.
  const FENCE_LINE = /^[ \t]*(?:```|~~~)/;
  // The embedded-interrogative echo, measured live 2026-08-17: "The question
  // of who commanded the Russian army at the Battle of Borodino and who led
  // the French is addressed." Every content word the plain test needs sits
  // inside a wh-clause — and the model resolved the question's "this battle"
  // to the material's own "Borodino", so the word-for-word test cannot see
  // the restatement. Blanking each wh-clause (wh-word up to the matrix verb,
  // a conjunction, or punctuation) strips what the sentence merely re-asks;
  // if what SURVIVES is still nothing but the question's words and
  // act-words, the sentence performed no answer. A real answer keeps its
  // content outside the wh-clause ("Napoleon, who led the French, entered
  // Moscow" survives as "Napoleon entered Moscow"), and a pseudo-cleft's
  // content sits after the copula boundary, so both stay content. Residue
  // accepted and disclosed: an echo whose embedded clause re-inflects the
  // question's verb ("who was in command" for "who commanded") slips this
  // test — the guard catches the measured shapes, it is not a parser.
  const WH_CLAUSE = /\b(?:who|whom|whose|what|which|when|where|why|how)\b[^,;:—–]*?(?=\b(?:is|are|was|were|and|but|or)\b|[,;:—–]|$)/gi;
  // The dialogue-narration echo, measured live 2026-08-18 ("what is the
  // weather in NYC today?", real weather pages fetched and offered): "The
  // conversation starts with a question about the weather in New York
  // City." / "The user is waiting for more information about the weather."
  // / "The user is looking for the weather in New York." A third echo
  // shape neither test above can see: it narrates the dialogue in the
  // third person instead of restating the question's own words, so its
  // content tokens (user, conversation, waiting, looking) come from the
  // dialogue apparatus, not the question — and the word-coverage test
  // reads them as content. Vocabulary held to exactly what was measured —
  // subjects {user(s), conversation}, verb lemmas {ask, start, wait,
  // look} — the same II.11 earned-constant discipline ACT_WORDS' own
  // dated amendments follow; a wider guess list is future work, not
  // shipped here as if it were already measured.
  //
  // provenance.js's own `NARRATION_SUBJECT`/`CUT_RES` (imported above as
  // stripNarrationSentences, already run inside this function's `clean`,
  // before this text is ever reached) is the SAME register, earned
  // against a real null (194 live_priors documents, ~460k sentences).
  // This is deliberately NOT a second copy of that list: clean() DELETES
  // a matching sentence from the draft outright, with no verdict signal,
  // before judge() runs; DIALOGUE_NARRATION_RE below classifies whatever
  // SURVIVES that cut, feeding the echoed/reproduced verdict, the
  // correction retry, and the mechanical fallback — a job clean() cannot
  // do (an all-narration draft that clean() empties out entirely still
  // needs a verdict, and the code below is what supplies one). The two
  // lists were extended together on this date (provenance.js gained
  // wait(s)/waiting and look(s)/looking in the same pass) precisely so
  // they name the same measured register rather than drifting apart —
  // extend both together, never one alone.
  //
  // Disclosed residue, both directions, the guard's own standing posture:
  // material genuinely ABOUT a user or a conversation that also carries
  // one of these four verbs ("The user requests an access token." is
  // outside this measured set and ships; "The user starts the session."
  // would not) can be misread as narration — this corrupts not only the
  // framing-cut but also the reproduction-mass denominator, since a
  // misclassified sentence never reaches contentSentencesOf either. And
  // in the other direction, only a PREFIX or SUFFIX of framing sentences
  // is cut at ship time (below); a narration sentence classified here as
  // framing but sitting in the MIDDLE of an otherwise-real answer still
  // ships to the page, the fold, and the record. Neither residue is
  // pinned by a test; both are named here so a widened vocabulary or a
  // mid-draft cut are recognized as the next measured passes, not
  // rediscovered from scratch.
  // Extended 2026-08-19 with the same measured shapes provenance.js's
  // register gained the same day (the two lists name one register — extend
  // both together, never one alone): subjects prompt|question with up to
  // four modifier words between determiner and noun ("The 1960 World
  // Series question … is directly related to baseball playoffs", shipped
  // live as a whole answer), and the relate verb lemma from that same
  // specimen.
  const DIALOGUE_NARRATION_RE =
    /^[\s"'“”‘’(\[]*(?:the|this|that|your|our)\s+(?:[\p{L}\p{N}'’-]+\s+){0,4}?(?:user|users|conversation|prompt|question)\b(?:\s*,[^,\n]*,)?[^.,;:—–!?]*?\b(?:ask|asks|asked|asking|start|starts|started|starting|wait|waits|waited|waiting|look|looks|looked|looking|relate|relates|related|relating)\b/iu;
  const isFraming = (sentence) => {
    if (FENCE_LINE.test(sentence)) return false;
    // A sentence that ends by asking is asking, not answering — two of the
    // three live echoes shipped with the question mark still on them.
    if (/\?\s*["'”’)\]]*\s*$/.test(sentence)) return true;
    if (DIALOGUE_NARRATION_RE.test(sentence)) return true;
    const toks = tokenize(sentence);
    if (!toks.length) return false;
    if (toks.every((w) => questionWords.has(w) || ACT_WORDS.has(w))) return true;
    const rest = tokenize(sentence.replace(WH_CLAUSE, " "));
    return rest.length > 0 && rest.every((w) => questionWords.has(w) || ACT_WORDS.has(w));
  };
  /** Sentences of `t` with addresses stripped, framing (question-echo) sentences removed. */
  const contentSentencesOf = (t) =>
    splitSentences(String(t ?? "").replace(ADDRESS_RE, " "))
      .map((s) => s.replace(ADDRESS_RE, " ").trim())
      .filter(Boolean)
      .filter((s) => !isFraming(s));
  // `t` with its leading and trailing framing sentences cut, byte-exact
  // except for the cut itself — the ship-time text below is defined as a
  // call to this function; nothing after this point recomputes the cut a
  // second, divergent way. Factored out 2026-08-20 so inspect()'s relation
  // tier (below) can read the SAME text the page, the fold, and the record
  // eventually see, instead of the model's raw, still-framed completion.
  // Measured live: eval/results/material-dialogue-stress-703.jsonl turn 23,
  // question "Where is Saturn in the order of planets from the Sun?" — the
  // logged `shippedText` is clean ("The passage confirms that Saturn is the
  // sixth planet from the Sun.", no echo, no question), but the logged
  // `relationClaims` carries THREE entries, not one: the real bound claim
  // (subject "that Saturn", verb "is", object "the sixth planet from the
  // Sun") riding beside two claims extracted from the QUESTION itself
  // (subject "Where" / verb "is" / object "Saturn in the order of planets
  // from the Sun?", verdict beyond-reach; subject "is Saturn" / verb "in" /
  // object "the order of planets from the Sun?", verdict unheard) — neither
  // string appears in `shippedText` OR the logged first `draftText`, so the
  // only place they could have come from is a correction retry's raw
  // completion, read before this cut had ever run (it previously lived
  // only here, AFTER the correction loop settles). hypergraph.js's SVO
  // extractor doesn't know "framing" is not part of the answer — it read
  // the question's own words as claims. Downstream cost is not cosmetic:
  // capacity-runner.js's `candidates = claims.filter(c => c.verdict !==
  // "bound")` (the per-source triangulation gate) spends real model calls
  // chasing claims that were never part of the answer.
  const stripFraming = (t) => {
    const raw = String(t ?? "").trim();
    const sentences = splitSentences(raw.replace(ADDRESS_RE, " "))
      .map((s) => s.trim())
      .filter(Boolean);
    const firstContent = passages.length ? sentences.findIndex((s) => !isFraming(s)) : sentences.length ? 0 : -1;
    if (firstContent < 0) return "";
    let lastContent = -1;
    for (let i = sentences.length - 1; i >= 0; i--) {
      if (!isFraming(sentences[i])) {
        lastContent = i;
        break;
      }
    }
    const from = firstContent === 0 ? 0 : raw.indexOf(sentences[firstContent]);
    if (from < 0) return raw;
    let to = raw.length;
    if (passages.length && lastContent < sentences.length - 1) {
      const lastAt = raw.lastIndexOf(sentences[lastContent]);
      if (lastAt >= 0) {
        const end = lastAt + sentences[lastContent].length;
        const tail = raw.slice(end).match(/^[.!?…)\]"'”’]*/);
        to = end + (tail ? tail[0].length : 0);
      }
    }
    return raw.slice(from, to).trim();
  };
  /** A folded sentence is the material's own if some passage contains it. */
  const isVerbatimSentence = (sf) => sf.length > 0 && passagesFolded.some((pf) => pf.includes(sf));
  /**
   * Reproduction, from an already-extracted list of non-framing sentences.
   *
   * The majority cut is over CHARACTER MASS, not over a count of sentences,
   * and it carries no length floor. That is a deliberate replacement of both
   * halves of what stood here, for one reason: a count of sentences is a
   * measurement of the material's punctuation habits, not of how much of the
   * answer is copied.
   *
   * The count had a floor — a sentence under three content tokens could not
   * COUNT as verbatim, so that a short coincidence ("Yes." appearing
   * somewhere in a passage) could not buy a whole vote. But the floor only
   * ever silenced the numerator; those sentences stayed in the denominator.
   * Dialogue is made of them. Measured on War and Peace (audit 2026-08-16):
   * 1,137 chunks have half or more of their sentences under the floor, and
   * every one of them can be transcribed WHOLE — nine lines of speech, word
   * for word — while at most one line is allowed to count, so the cut
   * mathematically cannot fire. The novel's entire dialogue face photocopies
   * past a guard that reports clean.
   *
   * Mass fixes the numerator and the denominator at once, and dissolves the
   * floor rather than tuning it: a sentence contributes exactly what it
   * weighs, to both sides. A three-character coincidence buys three
   * characters of numerator instead of a full vote, which is what the floor
   * was reaching for and could not express — so the floor comes out, and with
   * it a hand-set constant (P9: no number where a structural rule will do).
   * Nine short copied lines outweigh one original lead-in, as they should;
   * two short quoted lines inside a real paragraph of the model's own prose
   * do not, which a floorless COUNT would have called reproduction at 2 of 3.
   * The measure is a ratio of the answer's own substance, immune to how the
   * source happens to distribute its full stops.
   */
  // SELECTED TESTIMONY IS NOT A PHOTOCOPY. Measured live 2026-09-02, "Who
  // replaced whom as vice president, in order?" against sources that state
  // the succession as four one-sentence facts: the model's first draft was
  // a numbered list of exactly those facts — right, and by every mass test
  // below a verbatim copy, so it was convicted, rewritten into narration,
  // convicted again, and the mechanical fallback shipped one fact three
  // times. When the answer to a question IS a set of the sources' own
  // atomic statements, copying those statements is answering; what makes a
  // photocopy a photocopy is that it drags along what the question never
  // asked for. So the exemption is structural, not a threshold: the copied
  // sentences must number at least TWO (a set needs two members — one
  // copied sentence is a single fact that should be said in one's own
  // words, and stays a reproduction; binding.js's own "one arrival has no
  // co-arrival" floor, reused) and EVERY copied sentence must share a
  // content word with the question (one irrelevant copied sentence and the
  // whole copy is transcription — the ledger retype and the dialogue
  // transcription both carry such sentences and both still convict).
  const questionContent = [...questionWords];
  const isRelevantSentence = (sf) => { const toks = tokenize(sf); return questionContent.some((w) => toks.includes(w)); };
  // The set is counted in the MATERIAL's sentences, never the draft's own
  // punctuation. Measured on the live draft: a numbered list with no full
  // stops is ONE sentence to the splitter — one copied "sentence" spanning
  // four of the sources' statements — and a count of draft sentences read
  // it as a single fact. A copied stretch is resolved to the material
  // sentences it contains; a fragment that contains none stands as itself.
  const passageSentencesFolded = passages.flatMap((p) => splitSentences(String(p.text ?? "")).map(foldTypography).filter(Boolean));
  const selectedTestimony = (folded) => {
    const units = new Set();
    for (const sf of folded) {
      if (!isVerbatimSentence(sf)) continue;
      const contained = passageSentencesFolded.filter((ms) => ms.length > 0 && sf.includes(ms));
      if (contained.length) for (const ms of contained) units.add(ms);
      else units.add(sf);
    }
    return units.size >= 2 && [...units].every(isRelevantSentence);
  };
  const reproducedFromContent = (content) => {
    if (!content.length) return false;
    // A "sentence" with no letters is list furniture ("1.", "2.") or bare
    // punctuation, not content: measured live 2026-09-02, a numbered list's
    // markers split off as sentences and "1 ." matched INSIDE "1861 ." in
    // another passage — a letterless, coincidental, irrelevant "copy" that
    // vetoed the selected-testimony exemption on a correct answer.
    const folded = content.map(foldTypography).filter((f) => f && /\p{L}/u.test(f));
    if (!folded.length) return false;
    const contentText = folded.join(" ");
    const wholeBlockCopied = passagesFolded.some((pf) => pf.includes(contentText));
    let copiedMass = 0;
    let totalMass = 0;
    for (const sf of folded) {
      totalMass += sf.length;
      if (isVerbatimSentence(sf)) copiedMass += sf.length;
    }
    const copied = wholeBlockCopied || copiedMass > totalMass / 2;
    return copied && !selectedTestimony(folded);
  };
  const judge = (t) => {
    const all = splitSentences(String(t ?? "").replace(ADDRESS_RE, " ")).filter(Boolean);
    if (!all.length) return { echoed: false, reproduced: false };
    const content = contentSentencesOf(t);
    if (!content.length) return { echoed: true, reproduced: false };
    return { echoed: false, reproduced: reproducedFromContent(content) };
  };

  // The draft streams out through progress events, so the page can show the
  // part being written instead of dead air. Predictive error correction:
  // periodically — not on every token, which would spend more on checking
  // than on writing — the sentences COMPLETED so far are judged by the same
  // majority test the finished draft will face. A generation already
  // provably dominated by verbatim copying is stopped there rather than
  // left to spend its whole decode budget confirming what the completed
  // sentences already show; the caller (below) treats the cancelled
  // partial exactly like a finished draft that failed the same test.
  let lastPredicted = 0;
  const PREDICT_EVERY_CHARS = 200;
  const streaming = {
    onDelta: (partial) => {
      onProgress?.("draft", part, { partial });
      if (partial.length - lastPredicted < PREDICT_EVERY_CHARS) return false;
      lastPredicted = partial.length;
      // Only sentences the stream has actually FINISHED — splitSentences on
      // a partial always risks judging an in-progress last sentence that
      // has not yet had the chance to diverge from the passage.
      const finished = splitSentences(partial.replace(ADDRESS_RE, " ")).slice(0, -1);
      if (!finished.length) return false;
      const content = finished.map((s) => s.trim()).filter((s) => s && !isFraming(s));
      return reproducedFromContent(content);
    },
    // A reasoning-capable model (qwen3, deepseek-r1) streams its own
    // deliberation through Ollama's own separate `message.thinking` field —
    // app.js's completeOnce now captures it and fires this the SAME way
    // onDelta already fires, so it reaches the page through the SAME
    // onProgress channel every other phase already uses, one new phase name
    // rather than a second callback surface. Never read by anything in this
    // file: the draft that gets checked, corrected and recorded is still
    // built from `onDelta`'s own accumulation alone. A model that has
    // nothing to call `.thinking` (gemma2:2b, this app's default) simply
    // never fires this — completeOnce only calls it when Ollama actually
    // sends the field.
    onThinking: (partial) => onProgress?.("thinking", part, { partial }),
  };

  // A part with no material is plain chat, not a research gap. The
  // research-framed prompt over nothing produces either an echo of the
  // prompt or a diagnosis of it ("The prompt needs a clear, specific
  // question") — both measured live — because a model told to "say what
  // the part would need" on "hi" has nothing to say but that. The first
  // draft for a passage-less part is therefore ONE neutral conversational
  // call: the prompt is a prompt, answered as a person would answer it.
  //
  // When verbatim history is available (chatHistory), send it as message
  // pairs so the model can see the actual back-and-forth. The threshold
  // is the window itself — RECENCY_WINDOW messages is always small enough
  // to send raw. The one-line discourse slice is NOT a fallback for when
  // chatHistory is absent — it is a different assembly (S1's own distilled
  // topic/flow/entities, never re-derivable from raw turns by a small model
  // for free) and rides ALONGSIDE chatHistory always, not only in its
  // absence. Measured live (2026-08-19, "system 2 keeps drifting off the
  // discourse"): the prior code dropped this line the moment chatHistory
  // existed (`chatHistory.length ? "" : chatContext`), which is exactly
  // backwards at the moment it matters most — aperture.js's own regime can
  // narrow chatHistory to as little as the two messages of one exchange
  // under startle, and that is precisely when the wider conversation's only
  // surviving anchor is this line, not the (now-truncated) raw turns.
  const chatContext = discourse ? `\n\nThe conversation so far: ${discourse}` : "";
  // The conversation is its own assembly, and the flat material path gets it
  // REAL — the same role-structured history the chat path already sends —
  // never only the one-line paraphrase. Measured live (2026-08-19): "what is
  // my name?" ran the material path, which used to drop history entirely the
  // moment passages existed, so the model dutifully summarized a
  // preflight-fetched page about a stranger instead of seeing the
  // conversation it was asked about. A regular model with the full context
  // answers that honestly; this instrument may not do worse than the null
  // it exists to beat. And the person's message arrives as ITSELF — the
  // final user turn, verbatim — with duty and material in the system prompt
  // (FLAT_EXECUTE_SYSTEM_PROMPT above says why: fed a directive about the
  // task, a small model answers with a description of the task). Flat only:
  // a decomposed part's small prompt is the point of running as parts at
  // all, and its history stays out by design.
  // S1's own answer, when there was one and the S2 gate let this part run
  // (priorPassFor, above) — flat only, same reach as searchedVoid, folded
  // in alongside it rather than replacing it: a turn can both have run a
  // preflight search AND have a fast first pass to check.
  const priorPassSuffix = flat && priorPass ? ` ${priorPassFor(priorPass)}` : "";
  const s2Frame = priorPass ? S2_FRAME_PREFIX : "";
  const searchedVoidSuffix = flat && searchedVoid ? ` ${searchedVoid}` : "";
  // The conversation's own recent voice (arcs.js/pathos-turn.js): a fact
  // about the recent answers — the model's own openings, its own flatness —
  // handed to the model exactly like searchedVoid is: information the
  // model reasons from, never an instruction about how to answer. Flat
  // only, same reach as searchedVoidSuffix.
  const voiceCueSuffix = flat && voiceCue ? ` ${voiceCue}` : "";
  // UNRETRIEVED_MATERIAL_PREFIX's own header explains the incident this
  // closes. Gated on `sourcesAttached` (app.js's own `Object.keys(state.
  // sources).length > 0`, threaded straight through exactly as
  // `searchedVoid` is) rather than on `live`/`chunks`: `live` here is
  // ALREADY the attachments-toggle-and-mute-filtered view (app.js's own
  // `liveChunks()`), so it reads exactly like "nothing was ever attached"
  // in precisely the cases this disclosure exists for — the attachments
  // switch off, every source muted, or a source added a moment too late to
  // make this turn's own `state.chunks` read. `sourcesAttached` answers a
  // different question ("does the person think something is here") and is
  // computed once, from the raw source map, independent of what this turn
  // happened to filter. Flat only, same reach as searchedVoidSuffix.
  const unretrievedSuffix = flat && !passages.length && sourcesAttached ? ` ${UNRETRIEVED_MATERIAL_PREFIX}` : "";
  // Flat only, same reach as searchedVoid/priorPassSuffix — todayLine's own
  // header carries the full reasoning.
  const todaySuffix = flat && now != null ? ` ${todayLine(now)}` : "";
  // Stated as a FACT about the answer's shape, in the positive, never as a
  // prohibition ("do not write more than…"). Tonight's own measurement is
  // why: a reasoning model spent visible tokens working out how to comply
  // with a phrase in its prompt rather than using it. A size it can simply
  // aim at is information; a length limit is one more rule to satisfy.
  const shapeSuffix = answerShape ? ` ${answerShape}` : "";
  const notesSuffix = flat && readerNotes ? ` ${readerNotes}` : "";
  // Phase 2's own material, for the INITIAL draft prompt only — `sourceBlock`
  // itself stays untouched everywhere else in this function (succession-box
  // parsing at parseSuccessionBoxes below reads raw material text and must
  // never see this block's synthetic lines; the correction prompts below
  // stay exactly as they were, Phase 3's own "measure before touching the
  // correction loop" scope). Facts first, raw passages after — orient with
  // the pre-digested read, then let the fuller text supply what the
  // extractor's own disclosed limits couldn't reach — the fuller text
  // being `dedupedSourceBlock` (above), not raw `sourceBlock`: the
  // salience gate's other half, cutting near-identical restatements
  // rather than adding a structured list ON TOP of an unfiltered raw one.
  // TWO REGISTERS, AND THE SPANS ARE ONLY THE ONES THE NOTES REST ON.
  // User direction, 2026-08-28: "never give it the raw text alone, we
  // always feed it the hyperlexicon's surf and fold with the minimal raw
  // spans from the original"; then "use only the spans linked to the
  // precise hyperlexicon elements."
  //
  // So the notes go first, saying plainly that they are notes and that a
  // source beats them; then the sentences that actually bound those notes,
  // each under its own address. The whole retrieved chunk no longer goes:
  // measured live, it carried page furniture ("'President Lincoln' and
  // 'Mr. Lincoln' redirect here") into a prompt as though it were evidence.
  //
  // THE ONE FALLBACK, disclosed rather than silent: when nothing bound,
  // there are no notes AND no spans, and sending neither would leave a
  // model with nothing at all on a question the raw text may well answer —
  // this repo's own extraction gap is large enough that this is the common
  // case, not the corner. So a no-note turn still gets the deduplicated
  // raw block, with the notes block already stating that nothing could be
  // read out of it.
  const spanBlock =
    factBlock?.spans?.length
      // NO REF LABEL (2026-09-15, P232). THE MOUTH NEVER SEES AN ADDRESS
      // (P55), so `strikeAddresses` struck this one at the door anyway — and its
      // whitespace rule then pulled the orphaned colon onto the line above,
      // gluing every span to its predecessor and merging two blocks into one
      // (13 residues in one measured turn). The address is not lost: the record
      // keeps `factBlock.spans`, and cite.js attaches it after the draft.
      ? factBlock.spans.map((sp) => `"${sp.text}"`).join("\n\n")
      : null;
  // THE PREMISE THE QUESTION SMUGGLES IN (P125), checked before the mouth
  // sees anything: a claim the question states as already established has its
  // atoms looked for in this part's own passages, and what the sources
  // actually say goes in as a FACT. Measured live (S77 turn 15): asked about
  // a constant whose name had one token swapped, the model answered "You're
  // right, we established that…" and explained a thing that does not exist.
  // Against the TASK, not this part's words. A premise is a property of the
  // whole turn — the person asserted it once, before any plan existed — so it
  // is checked once per turn, exactly as `searchedVoid` and `answerShape` are
  // (their own headers say why). Measured live (S77 run 4, turn 15): on a
  // decomposed turn `question` is "<part label> <part description>", the
  // asserted claim appears in none of them, and the check silently never
  // fired — the injection reached the mouth unchecked.
  const premiseCheck = passages.length ? checkPremises(task || question, prosePassages.length ? prosePassages : passages, { cited: citedSource(task || question), referentIndexFor: makeReferentIndexFor }) : null;
  // A QUOTATION IS CHECKED AS A QUOTATION (P133). Corpus-wide containment
  // asks "does this token exist?"; a quoted claim asks "does it belong HERE".
  // Measured live: a War and Peace line with one name swapped to Lincoln
  // passed every check, because Lincoln is in the corpus — in the Lincoln
  // article. The quoted run is matched as a SPAN, against the source the
  // question names when it names one.
  const quotedClaim = passages.length ? quotedAsk(task || question) : null;
  const misquote = quotedClaim ? findMisquote(quotedClaim, prosePassages.length ? prosePassages : passages, { cited: citedSource(task || question) }) : null;
  const misquoteBlock = misquote?.misquoted ? misquoteFacts(misquote) : "";
  const premiseBlock = [premiseCheck ? premiseFacts(premiseCheck) : "", misquoteBlock].filter(Boolean).join("\n\n");
  // ── THE RECORD SPEAKS FIRST (dialogue.js; GFP Pass 40's first rung) ──────
  // A reader's restatement was graded above like any premise; the record's
  // own position on it is a fact the mouth is handed, and is prepended to the
  // answer below so it is said whatever the mouth does. And what the
  // retrieved passages STATE about what was asked — the reader's own bound
  // claims over them — is composed before the draft, handed over as facts at
  // their addresses, and diffed against the draft afterwards (matched, novel,
  // missing, contradicted; the authorship ratio).
  const position = premiseCheck?.premises?.some((pr) => pr.how === "restated by the reader") ? positionOn(premiseCheck) : null;
  const expectation = relations ? expectationFrom(prosePassages.length ? prosePassages : passages, task || question, (t) => relations.read(t), referentIndex, hyperlexiconVoids) : { claims: [], basis: null, why: "no relation reader for this part", voids: [] };
  // GFP PASS 40 (A2): the expectation is ANNOUNCED BEFORE THE DRAFT — a typed
  // `expected` event, carried to the app's reflex ledger as an act, so the
  // instrument's expectation (what it believes the material states, and what it
  // has searched for and not yet found) is on the record before the mouth
  // speaks. The diff against it is taken from something written down, never
  // from something remembered.
  onProgress?.("expected", part, { basis: expectation.basis ?? null, claims: expectation.claims?.length ?? 0, voids: expectation.voids?.length ?? 0, why: expectation.why ?? null });
  const dialogueBlock = [position ? `The record's own position on what you restated: ${position.text}` : "", expectationFacts(expectation)].filter(Boolean).join("\n\n");
  // The enforcement the prompt is not asked to provide: the values the
  // question asserted and the material does not carry. Measured live (S77
  // run 5, turn 15) the block alone was not enough — the mouth explained a
  // "Durham investigation" that exists nowhere — so the draft is checked.
  const premiseGuards = [...(premiseCheck ? premiseGuard(premiseCheck) : []), ...misquoteGuard(misquote)];
  // THE FINDINGS, EACH AT THE CELL THAT ESTABLISHED IT (P134). What SEG cut
  // and what CON refused are not stages to re-run later — they are standing
  // constraints on every cell after them. `admissible` applies them once,
  // after all writing and rewriting, and nothing downstream can undo them.
  const findings = [
    ...(misquote?.misquoted ? [finding("SEG", `the sources say ${misquote.shouldBe.join(", ")}, not ${misquote.said.join(", ")}`, { forbids: misquote.said, says: misquoteBlock })] : []),
    ...(premiseCheck?.unverified?.length ? [finding("SEG", "the question assumed something the sources do not carry", { forbids: premiseGuard(premiseCheck).map((g) => g.value), says: premiseBlock })] : []),
  ];
  // What was already found wrong on this material, in scope for this question.
  const learnedRows = learnedStore.length ? recallFor(`${task || ""} ${question}`.trim(), learnedStore) : [];
  // ONLY THE POSITIVE HALF REACHES THE MOUTH (P126, measured): a correction
  // with a replacement goes in as the sentence the sources carry; one that
  // only says a claim is unplaced is kept back here and spent on the draft
  // below, because naming a falsehood in order to forbid it makes a small
  // model repeat it.
  const learnedBlock = learnedRows.length ? learnedFacts(learnedRows) : "";
  const guards = learnedRows.length ? learnedGuard(learnedRows) : [];
  // The snips: a piece stands on its obligations' spans, any other turn on
  // the question's own words. Both are the source's bytes, verbatim, addressed.
  const recalledLine = recalledTurns.length ? transcriptLine(recalledTurns) : "";
  // REASONING OUTSIDE THE MODEL (P173, arithmetic.js::checkComparison). A
  // question that asks which of two stated values is earlier or larger, and
  // how far apart they are, is answered by the ENGINE and handed to the mouth
  // as a fact to say — never posed to it as a sum to attempt. Measured (S77):
  // ten such probes, the ordering right twice, the arithmetic right zero
  // times. The values are the question's own; nothing is invented.
  // S2 IS RECRUITED BY DIFFICULTY, NOT SPENT FLAT (P174). Every signal here
  // is already paid for by work this turn does anyway; the person's slider is
  // a floor and a ceiling on what strain may take.
  // The cut is measured from the stream where the tower says the measured cut
  // discriminates, and falls back to the declared floor where it does not
  // (P175/P132). `coverageHistory` and `nul` absent → the floor decides and
  // the reading says so; nothing about this turn changes.
  // P148: the belief is formed inside strainOf, which is where coverage is
  // computed — the cell that makes the belief worth anything. holon threads
  // the function and never calls it, and never imports prequential.js.
  const provisional = strainOf({ question: task || question, passages: prosePassages.length ? prosePassages : passages, premiseCheck, parts: 1, expect });
  const placement = (nul && coverageHistory.length && provisional.coverage != null && useMeasuredCut)
    ? placeCoverage(provisional.coverage, coverageHistory, { nul })
    : null;
  const strain = placement
    ? strainOf({ question: task || question, passages: prosePassages.length ? prosePassages : passages, premiseCheck, parts: 1, placement, expect })
    : provisional;
  const recruited = recruit(strain, { asked: askedDepth });
  // The checking that happens AFTER the draft is what strain actually buys:
  // the witness asks and the correction rounds. An easy turn spends little
  // and an argued one spends more, inside what the person asked for. The
  // draft itself is unaffected — S1 always drafts.
  const spend = depthBudgets(recruited.depth);
  witnessAsks = spend.witnessAsks;
  pieceWitnessAsks = spend.pieceWitnessAsks;
  snipRounds = spend.snipRounds;
  const comparison = math ? checkComparison(task || question, { math }) : null;
  // The same worked-out comparison when the numbers are the PASSAGES', not the question's
  // (passage-comparison.js): two referents the question sets side by side, each bound to
  // the figure of the sentence that names it alone, in one shared unit. Refused when unsure.
  const passageComparison = math && !comparison ? checkPassageComparison(task || question, passages, { math }) : null;
  const comparisonLine = comparison && !comparison.gap
    ? `Worked out from the numbers in the question: ${comparison.sentence}`
    : passageComparison ? `Worked out from the figures in the sources: ${passageComparison.sentence}` : "";
  // ACTIVATION (activation-retrieval.js): when the pick was an activation over
  // the reading, the passages ARE sentences chosen and cut by it — they are
  // handed verbatim as the snips, once, and never doubled as a raw source block.
  const retrieval = passages?.retrieval ?? null;
  const activated = retrieval?.basis === "activation";
  // DEDUPED BEFORE SNIPPING (2026-09-15, live specimen: "What is the capital
  // of France?" over a real web search handed the model 19 near-duplicate
  // bullets — "Paris is the capital of France.", "The capital of France is
  // Paris.", "Its capital is Paris...", four-plus restatements of one fact
  // from four different search results, none of them literal repeats of
  // each other's exact bytes). `dedupeSourceText` (fact-block.js) already
  // exists for exactly this shape of redundancy — this file's own
  // `dedupedSourceBlock` above uses it to thin the raw MATERIAL block — but
  // this turn-snip path built its bullets from the UNDEDUPED passages, so
  // the same six-ways-restated fact this file's own header already names
  // for the MATERIAL block ("Hannibal Hamlin, 15th vice president,
  // 1861-65") was reaching the "what the sources say, verbatim" digest a
  // second, unfixed way. Same organ, same relation reader, no new
  // heuristic — deduped by CLAIM (subject/label/object), never by exact
  // text, so a real new fact survives untouched.
  const dedupedProsePassages = passages.length ? dedupeSourceText(prosePassages.length ? prosePassages : passages, relations) : [];
  // MECHANICAL CONFIDENCE — user direction, 2026-09-15: "if we mechanically
  // are confident, just feed it the fact and we provide the citation... the
  // logic is all outside the model... give it the very minimum it needs...
  // idc if it's from the source, the source is what generated the
  // holographical content." `factBlock` already IS that confidence,
  // addressed (`spans`) and checked (`relations.read`) before the model
  // ever sees a word of it — real live cost, the same specimen P228 names:
  // a 19-bullet verbatim digest for a five-word fact, several bullets
  // stitched verbatim into the shipped answer. The citation is attached
  // mechanically regardless of what the model was shown (P55: the mouth
  // never sees an address), so once something real is confirmed, the raw
  // digest is not a second opinion the model usefully weighs — it is bulk
  // a small model tends to just copy.
  //
  // RECALL, MEASURED BEFORE TRUSTING (user direction, same breath: "test it
  // 100 times and test recall and with attachments"). A first cut trimmed
  // whenever `factBlock` had ANY line at all and lost real facts on a live
  // 100-trial run: a two-fact question ("when does the museum open, and
  // what does admission cost") kept only the opening-hours line — the
  // relation reader never bound the admission-price sentence at all — and
  // the model, hand ONE fact and asked to answer a two-part question,
  // answered the second part from nothing (a real fabricated "$10" against
  // a material "$12"). One bound fact is not the same claim as "everything
  // the question needs is bound" — coverage must be checked, not counted.
  // The check reuses this file's own received stopword class
  // (`CLAIM_STOPWORDS`, already imported) rather than a new list: every
  // CONTENT word of the question must appear somewhere in the fact-block's
  // own extracted lines, or the raw digest stays — a genuinely
  // under-extracted or multi-part question falls through to the FULL
  // digest exactly as before this pass, never fed less than it was.
  const questionContentWords = [...new Set(String(question ?? "").toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)))];
  const factLinesText = (factBlock?.lines ?? []).join(" ").toLowerCase();
  const mechanicallyConfident = Boolean(factBlock?.lines?.length) && questionContentWords.length > 0 && questionContentWords.every((w) => factLinesText.includes(w));
  const snipPrefix = piece
    ? (snips.length ? snipBlock(snips) : null)
    : activated
      ? (passages.length ? snipBlock(passages.map((p) => ({ ref: p.ref, start: 0, end: String(p.text ?? "").length, text: String(p.text ?? "") }))) : null)
      : mechanicallyConfident
        ? (passages.length ? snipBlock(passages.map((p) => ({ ref: p.ref, start: 0, end: String(p.text ?? "").length, text: String(p.text ?? "") }))) : null)
        : (passages.length ? turnSnipBlock(dedupedProsePassages, question) || null : null);
  // THE FLOOR NEVER LEAVES (P237, reconciled 2026-09-20): the
  // mechanicallyConfident branch above used to hand NOTHING verbatim — no
  // snips and no raw source — trusting the fact block to replace the floor
  // (P179's compression), only for Kondo's claims-arm to cut the fact block
  // as claims the notes already restate. Result: a turn whose fact block
  // happened to cover the question's words handed the mouth no material at
  // all (measured on the stability battery: northgate-plain at every rung
  // above L0-raw, containment 0). The compression may replace the RAW
  // SOURCE with the fact block; the verbatim floor — the passages
  // themselves as snips, the Field-level ground the walls check against —
  // stays, handed exactly as the activated branch hands it. `rawSource`
  // below still drops on mechanicallyConfident; only the floor was missing.
  // COMPRESSION (P179): a higher holon stands in for the lower material it
  // was computed from — a Lens line for the sentence it was read from, a
  // Paradigm line for every occurrence of a recurring act. So at level 2
  // and above the raw passages LEAVE the prompt: the blocks replace them and
  // the snips stay as the Field-level ground (verbatim, addressed, what the
  // walls check against). Handed is recorded; a turn with nothing verbatim
  // to hand falls back to the passages and says so. Level means what the
  // mouth is handed, and higher means less — measured as a monotone
  // compression ladder, never assumed.
  // WHAT THE MATERIAL IS, as against what a passage of it happens to say
  // (P46's own organ, `source.js::declaredIdentity` — the file's own title
  // page, with a named giver and a byte address). It rides EVERY path,
  // because it is a property of the source and not of whichever passage
  // retrieval returned: `buildSourceBlock` already carried it, but the
  // compressed path below sets `rawSource` to null, so on a snips turn it
  // was computed, addressed, and thrown away.
  //
  // Measured live (2026-09-08), which is why this exists: War and Peace
  // attached, asked "what's this book about?" — the question's one content
  // word is "book", so retrieval returned chapters about Prince Bolkonsky's
  // EXERCISE BOOK, and the mouth, holding sentences about a book and a table
  // and no title, answered "a man named Caesar and his commentary on his
  // military campaigns". The engine had "War and Peace, by graf Leo Tolstoy"
  // in hand the whole time. A fact, never an instruction (P55); no address,
  // because the mouth never sees one.
  const declaredLine = (() => {
    const bySource = new Map();
    for (const p of passages ?? []) {
      const d = p?.identity?.declared;
      if (!d?.title || bySource.has(p.source)) continue;
      bySource.set(p.source, `${d.title}${d.author ? `, by ${d.author}` : ""}`);
    }
    return bySource.size ? `What this material is, by its own title page: ${[...bySource.values()].join("; ")}.` : "";
  })();
  // WHAT THE ASK IS ACTUALLY FOR (about-call.js), the sharper half of the
  // same fix. `declaredLine` above is the cheap, always-on half — every
  // turn gets the title page, for free, and that alone closed the flagship
  // specimen. This is the paid half, spent only when the FREE mechanical
  // detector (`about.js::asksAboutMaterial`, P30's own "null before you
  // spend" law) says the question reads as asking what the material IS: a
  // small model reads the SITUATION (never the whole material — an ellipsed
  // sample spread across it, never the front alone) and says in one short
  // line what kind of thing the person seems to want, so the talker is told
  // that BEFORE it drafts rather than left to guess from whichever passages
  // retrieval happened to pick. Gated to a FLAT turn (one part, one
  // question) — a decomposed task's own parts are not "what is this"
  // questions in the first place, and this must never compound across them.
  // A call that throws or a reply that fails the wall (about-call.js's own
  // `looksLikeAnAnswer`) degrades to nothing added — never to a guess, and
  // never worse than before this existed.
  let aboutLine = "";
  if (flat && chunks?.length && asksAboutMaterial(task || question) && typeof call === "function") {
    const said = await interpretAsk(task || question, { rows: materialView({ chunks }), digest: abbreviate(chunks), call });
    if (said) aboutLine = `What they seem to be asking for: ${said}`;
  }
  const compress = activated || material === "snips" || (material === "auto" && resolutions >= 2);
  const handed = activated ? "activated sentences" : compress ? (snipPrefix ? "snips" : "passages (no snips to hand)") : "passages";
  const rawSource = mechanicallyConfident || (compress && snipPrefix) ? null : (factBlock ? (spanBlock ?? dedupedSourceBlock) : dedupedSourceBlock);
  // THE THREE RESOLUTIONS (resolutions.js): computed from the record, cut by the measurement, templated — never written by a model. The conversation-wide index is the caller's; this part's index stands in only when none was handed over, and the block says so.
  const resolution = resolutions > 0 ? resolutionBlocks({ level: resolutions, question: task || question, transcript, index: conversationIndex ?? referentIndex, notes: foldedNotes, voids: Array.isArray(hyperlexiconVoids) && hyperlexiconVoids.length ? hyperlexiconVoids : (hyperlexicon?.foldVoids && beliefNotes ? (() => { try { return hyperlexicon.foldVoids(beliefNotes); } catch { return []; } })() : []), records, dmdWindow, prominence: mentionBook ? (id) => (mentionBook.byId?.get(id)?.length ?? 0) : null }) : null;
  // KONDO'S CUT (P232, kondo.js::tidyMaterial). This block carried TWO verbatim
  // carriers of the same sentences (the snips, and the spans the notes rest on)
  // and TWO structured carriers of the same claims (this turn's notes, the
  // expectation's restatement of them, the ledger's older ones). Keeping one of
  // each drops the repetition without removing a LAYER — measured on a real
  // turn, 486 of 1,285 tokens of one draft prompt were lines it already carried.
  // Declared pairs only: a void, a premise, a title page, a learned correction
  // and the discourse line are never touched, and what is dropped is disclosed
  // on the execute event rather than cut silently.
  // THE ARM: "off" sends the untidied material, "claims" cuts only the restated
  // CLAIMS (spans already quoted in the snips, the expectation and the ledger
  // restating this turn's notes) and leaves every note standing, "full" also
  // cuts a note the snips already carry word for word. Declared so the cut can
  // be measured rather than believed.
  const tidyArm = (typeof process !== "undefined" && process?.env?.KONDO_TIDY) || "claims";
  const tidyParts = [comparisonLine, declaredLine, aboutLine, recalledLine, snipPrefix, premiseBlock, dialogueBlock, learnedBlock, factBlock ? factBlock.text : null, ledgerBlock, rawSource];
  const tidied = tidyArm === "off" ? { parts: tidyParts, dropped: [] } : tidyArm === "full" ? tidyMaterial(tidyParts, { pairs: [...TIDY_PAIRS, TIDY_NOTES_PAIR] }) : tidyMaterial([comparisonLine, declaredLine, aboutLine, recalledLine, snipPrefix, premiseBlock, dialogueBlock, learnedBlock, factBlock ? factBlock.text : null, ledgerBlock, rawSource]);
  const draftMaterial = tidied.parts.filter(Boolean).join("\n\n");
  // A turn with nothing attached is exactly the turn that should stand on
  // what was read BEFORE — until 2026-09-03 the ledger block reached only
  // the material branches, so a from-memory question never saw the ledger
  // at all (found by the P84 pin: the materialless path sent none of it).
  // It rides the system message as a fact the model receives (P55's
  // posture), never as an instruction about the apparatus.
  //
  // WITHHELD, NOT DELETED, on the one narrower path UNRETRIEVED_MATERIAL_
  // PREFIX names: `unretrievedSuffix` is non-empty only when something IS
  // attached and this turn's own retrieval still came back with nothing
  // from it. `sourcesAttached`'s own header already explains why that is a
  // DIFFERENT fact from "nothing was ever given" — this is the mechanical
  // half of the same fix, added after the disclosure alone was measured
  // live and found NOT ENOUGH: gemma2:2b, told in as many words that
  // nothing below the harbor note was the attachment, still answered "We've
  // been chatting about harbor safety for kids" — L5 again, one level up
  // ("a compliance-critical fact is never left to the model's own
  // instruction-following"), applied to a fact stated in the prompt rather
  // than a fact checked after the draft. The ledger itself is untouched —
  // this only withholds what THIS prompt offers; the note stays on
  // `state.hyperlexiconLog` exactly as before, and reaches every other
  // question (a decomposed part, a turn with real material, or a genuinely
  // bare chat with nothing attached at all) exactly as before.
  const ledgerSuffix = (!unretrievedSuffix && ledgerBlock) ? `\n\n${ledgerBlock}` : "";
  // `resolution` is computed once, above —
  // reused here, never recomputed.
  const resolutionSuffix = resolution?.text ? `\n\n${resolution.text}` : "";
  // A DECOMPOSED part (!flat) always builds its prompt from its own label/
  // description via buildExecutePrompt — even when this part's own
  // retrieval came back with nothing. buildExecutePrompt already has the
  // honest branch for that (`"No material matched this part. Say what the
  // part would need and stop; do not invent content."`), still scoped to
  // THIS part alone. Before this fix, a part with zero passages fell all
  // the way through to the bare-chat branches below, which hand the model
  // `task` — the WHOLE original, un-decomposed question — as its only user
  // content. Measured live (2026-09-09): a "Who built the canal, when was
  // it completed, and why did the earlier French attempt fail?" plan, once
  // a part's own narrower retrieval query missed the fetched material,
  // answered that part from training knowledge against the FULL compound
  // question — which is exactly why sections came back re-answering the
  // entire original ask instead of their own labeled slice. The bare-chat
  // branches (`task`, no part scoping at all) are for a FLAT turn — a plain
  // chat question that was never decomposed — where `task` legitimately IS
  // the whole ask.
  const executeMessages = flat
    ? passages.length
      ? [
          {
            role: "system",
            content: [s2Frame + FLAT_EXECUTE_SYSTEM_PROMPT + shapeSuffix + notesSuffix + priorPassSuffix + todaySuffix + voiceCueSuffix, draftMaterial].join("\n\n") + chatContext + resolutionSuffix,
          },
          ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: task || `${part.label}. ${part.description}` },
        ]
      : chatHistory.length
        ? [
            { role: "system", content: `${s2Frame}${CHAT_SYSTEM_PROMPT}${searchedVoidSuffix}${unretrievedSuffix}${notesSuffix}${priorPassSuffix}${todaySuffix}${voiceCueSuffix}${chatContext}${ledgerSuffix}${resolutionSuffix}` },
            ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: task },
          ]
        : [
            { role: "system", content: `${s2Frame}${CHAT_SYSTEM_PROMPT}${searchedVoidSuffix}${unretrievedSuffix}${notesSuffix}${priorPassSuffix}${todaySuffix}${voiceCueSuffix}${ledgerSuffix}` },
            { role: "user", content: `${task}${chatContext}` },
          ]
    : [
        // task_03d3a119: discourse rides in the SYSTEM message, same as the
        // flat chat path's own chatContext a few branches up — never folded
        // into the `user` content buildExecutePrompt returns, which is
        // exactly what a piece section drew quoted prose from live.
        { role: "system", content: EXECUTE_SYSTEM_PROMPT + resolutionSuffix + discourseSuffix(discourse) },
        { role: "user", content: buildExecutePrompt(part, draftMaterial, piece, task) },
      ];
  onProgress?.("execute", part, {
    // What this call will actually carry — the page's pace ledger turns it
    // into an expected duration.
    promptChars: executeMessages.reduce((n, m) => n + m.content.length, 0),
    tidied: tidied.dropped.length,
    droppedBy: tidied.dropped.map((d) => d.owner),
    // The MATERIAL alone, apart from the instruction and whatever the turn
    // adds around it — so the compression ladder (P179) can be measured on what
    // it is a claim about, rather than on the whole system message.
    materialChars: draftMaterial.length,
  });
  // Meta-cognition is not content. A model's brackets mean one thing here —
  // a citation — so any bracketed span that is not one, and that itself
  // runs more than one sentence, is the model narrating its own act of
  // answering rather than answering. Stripped mechanically, immediately,
  // before inspect() or judge() ever see it: hidden from render because it
  // was never an answer, and kept out of the checks because it is not a
  // claim to verify. What was hidden is disclosed once, below — the fact
  // that it happened is on the record; its content is not.
  const scaffoldRemoved = [];
  let lastCleanRemoved = 0;
  // stripNarrationSentences (provenance.js) used to CUT its matches
  // ("This passage details…", "It highlights…") straight out of the
  // shipped draft — silent surgery on the model's own sentences, with no
  // way for the model to have a say in it. User direction, 2026-08-19,
  // reacting to exactly that live: "no post processing. the model says
  // what it says. we can fact check or revise what it said later — not
  // rewriting but changing its mind." It now runs in DETECT-ONLY mode:
  // `lastNarrationCut`/`lastNarrationTotal` measure how much of the draft
  // it would have removed, and verdictOf below turns that measurement into
  // `narrated`, a verdict that joins echoed/reproduced in the SAME
  // correction loop everything else already goes through — a real second
  // call, told plainly what went wrong, so what ships is either the
  // model's own revised words or (if it still fails) the same disclosed
  // mechanical fallback echoed/reproduced already use. Never a quiet edit
  // to sentences the model was never shown was made.
  let lastNarrationCut = 0;
  let lastNarrationTotal = 0;
  const clean = (raw) => {
    const scaffold = stripScaffoldNarration(raw);
    const narration = stripNarrationSentences(scaffold.text, {
      discourse,
      hasMaterial: passages.length > 0,
    });
    lastCleanRemoved = scaffold.removed.length;
    scaffoldRemoved.push(...scaffold.removed);
    lastNarrationCut = narration.removed.join(" ").length;
    lastNarrationTotal = scaffold.text.length;
    return scaffold.text;
  };
  // Succession-box completeness (2026-08-19, user direction) — additive to,
  // never a replacement for, the hypergraph-based signal directly below:
  // that one reads a BOUND claim's own `fillers` cardinality, which only
  // exists when extractRelations bound an SVO sentence in the first place.
  // A Wikipedia succession box never states "Lincoln's vice presidents were
  // Hamlin and Johnson" as a sentence — it states two separate records, each
  // with its own "Preceded by"/"Succeeded by" fields, so no claim with
  // `fillers.length > 1` is ever produced from this material shape and
  // isIncomplete below stays permanently false no matter how many
  // corrections run. succession.js's own header discloses the scope this
  // reads (Wikipedia-style succession boxes only); this is the second,
  // disclosed way "incomplete" becomes true, OR'd with the hypergraph
  // signal, never touching its mechanics, its mode-priority order, or its
  // per-mode budget.
  const successionIncompleteFindings = (draftText) => {
    if (!sourceBlock) return [];
    const boxes = resolveBoxSubjects(parseSuccessionBoxes(sourceBlock), sourceBlock);
    const groups = officeHolderGroups(boxes);
    if (!groups.length) return [];
    const dt = foldTypography(String(draftText ?? "")).toLowerCase();
    const findings = [];
    for (const g of groups) {
      // The same relevance gate incompleteClaimsOf already holds itself to:
      // only check completeness of an office the draft already talks about
      // — never nag about a succession box nobody asked about.
      const named = g.holders.filter((h) => dt.includes(foldTypography(h).toLowerCase()));
      if (!named.length) continue;
      const missing = g.holders.filter((h) => !named.includes(h));
      if (missing.length) {
        // The FULL confirmed set, not just the delta — "also states: Johnson"
        // leaves the model to keep hunting the raw box text for a complete
        // answer, and a small model reading a succession box's own chain
        // structure (this office's box literally sits beside another box
        // naming the NEXT office-holder after these two) will keep pulling in
        // names the record never actually confirms for THIS office+president
        // pairing. Stating the closed set — all of it, not the gap — turns
        // "find more" into "copy this", which is a task a small model can
        // actually do without inventing.
        findings.push(`${g.president}'s ${g.office} — the material confirms exactly: ${g.holders.join(", ")} (nothing else)`);
      }
    }
    return findings;
  };
  // Completeness (2026-08-19, user direction: "we STILL are not getting
  // Johnson, it's not adversarially checking if there is more to the
  // story" / "every question like that spin up a little def eva rec that
  // has a completeness gate"). hypergraph.js's clusterFillers already
  // computes exactly this — a bound claim whose subject+verb binds MORE
  // than one distinct object (Lincoln —appointed→ {Hamlin, Johnson}) — and
  // was sitting unread: the Lincoln/Hamlin/Johnson turn's own verification
  // taxonomy carried `fillers` on the claim the whole time, and nothing
  // downstream ever asked. `isIncomplete` is that ask: a BOUND claim
  // (never unbound — a wrong answer is a different, already-handled
  // problem, P33's own unbacked/unsupported split) with more than one real
  // filler means the question's own singular phrasing outran what the
  // material actually has, the exact Strawson/Russell uniqueness gap P33's
  // own header names. Scoped to `check.relations`, computed at verdictOf's
  // call sites (both already hold a fresh `check`).
  // A single claim carrying `fillers.length > 1` is not by itself proof of
  // an incomplete ANSWER — clusterFillers computes cardinality once per
  // slot and every claim sharing that slot reports the identical list, so
  // an answer that names every filler across SEVERAL sentences ("Lincoln
  // appointed Hamlin. Lincoln also appointed Johnson.") would still have
  // each individual claim carrying both names in `fillers`, and a naive
  // per-claim check would wrongly convict a genuinely complete answer.
  // What actually matters is COVERAGE: across every claim this answer
  // makes for one slot (subject+verb), does the union of what it actually
  // SAID cover every filler the material states? One entry per slot,
  // never one per claim, so a slot is never reported twice.
  const incompleteClaimsOf = (c) => {
    const claims = c?.relations?.claims ?? [];
    const seenSlots = new Set();
    const result = [];
    for (const claim of claims) {
      // Bound gate loosened 2026-08-26 (user direction: "let's loosen the
      // bound gates for now and just see how accurate the local model can
      // be"), the same change and the same reason as competingSubjectsOf
      // below. `fillers` is attached by hypergraph.js to every verdict that
      // reaches its cardinality point, UNBOUND ONES INCLUDED — so what the
      // material states for a slot was already computed and was being
      // thrown away whenever the draft's own sentence failed to bind, which
      // is precisely when the draft most needs correcting.
      if (!(claim.fillers?.length > 1)) continue;
      const slot = `${claim.end1}|${claim.label}`;
      if (seenSlots.has(slot)) continue;
      const named = claims
        .filter((c2) => c2.verdict === "bound" && `${c2.end1}|${c2.label}` === slot)
        .map((c2) => foldTypography(c2.end2).toLowerCase());
      // f.object: clusterFillers' own narrow shape (P36) — a filler answers
      // "which OBJECT" for an already-fixed subject+verb slot, never an
      // arrangement with its own end1/label — out of scope for the rename.
      const uncovered = claim.fillers.filter((f) => {
        const ft = foldTypography(f.object).toLowerCase();
        return !named.some((t) => t.includes(ft) || ft.includes(t));
      });
      if (uncovered.length) {
        seenSlots.add(slot);
        result.push({ ...claim, uncovered });
      }
    }
    return result;
  };
  // The MIRROR of incompleteClaimsOf, added the same day (user direction,
  // live: "make some simple EOT statement about Abraham Lincoln's VP and
  // see that there is a conflict" — run for real first, not assumed:
  // `extractRelations` bound "Hannibal Hamlin —was→ Abraham Lincoln's vice
  // president" and "Andrew Johnson —was→ Abraham Lincoln's vice president"
  // as two REAL edges, and querying that slot with subject left open
  // returned both subjects directly — the exact P32 `competing` shape,
  // never wired into the completeness gate before now.
  //
  // Queries `relations.queryReferents`, NOT the standalone `queryFillers`
  // export — user direction, verbatim, both times this exact seam has been
  // built: "we need to point at REFERENTs not extant spans." Caught live
  // building this: a test fixture spelled the object "Lincoln's" in one
  // place and "Lincolns" in another, and `queryFillers`'s own disclosed
  // contract (hypergraph.js's own header: "matching here is on
  // report.edges's own exposed SURFACE STRINGS, not referent IDs") missed
  // the match entirely — a real, reproduced instance of exactly the gap
  // `queryReferents` (hypergraph.js, 2026-08-19, "remember to point
  // towards referents not spans") already exists to close, RUN INSIDE the
  // reader's own closure so "Lincoln's vice president" resolves by the
  // SAME referent identity `judge()` itself trusts internally, not by
  // string luck. `relations` (this closure's own injected reader,
  // `makeRelationReader`'s return value) is what carries it — never the
  // plain `edges` array once it has left that closure.
  //
  // incompleteClaimsOf asks "does this subject+verb bind more than one
  // OBJECT" (Lincoln —appointed→ {Hamlin, Johnson}); this asks "does this
  // verb+object bind more than one SUBJECT" ({Hamlin, Johnson} —was→
  // Abraham Lincoln's vice president) — the question's own phrasing can
  // outrun the material on either end, and only checking one end is why
  // this signal sat unused even after P32 itself computed `competing`
  // per-claim: that field only fires on an UNBOUND claim (the answer's own
  // subject choice, checked against the slot), never surfaced independent
  // of what the answer happened to guess. Querying the slot directly finds
  // it regardless of which (or whether any) subject the draft picked.
  const competingSubjectsOf = (c) => {
    const claims = c?.relations?.claims ?? [];
    if (!relations || !claims.length) return [];
    const seenSlots = new Set();
    const result = [];
    for (const claim of claims) {
      // NOT gated on `verdict === "bound"`, and this is the whole point of
      // querying the slot rather than reading the draft's own field. What
      // the MATERIAL confirms for a slot does not depend on whether the
      // draft's sentence happened to bind — and the case that most needs
      // this correction is exactly the one where it did not: measured live
      // 2026-08-26, "who was lincoln's vp?" drafted "Lincoln's VP was
      // Andrew Johnson", failed to bind (the answer carried its own "∅ not
      // in the material" mark), and so skipped this gate entirely — even
      // though the fetched material stated BOTH Hamlin and Johnson and
      // this function would have found them. An unbound claim still
      // carries the verb and object the draft asserted, which is all
      // queryReferents needs; a garbled one simply returns fewer than two
      // subjects and is skipped by the guard below, exactly as before.
      // This comment's own paragraph above already argued for it —
      // "querying the slot directly finds it regardless of which (or
      // whether any) subject the draft picked" — the gate just never
      // matched the argument.
      if (!claim?.label || !claim?.end2) continue;
      let subjects;
      try {
        // queryReferents' own parameter names (verb:/object:) are its own
        // API, unrelated to this claim's arrangement fields — only the
        // source read moved off the legacy names.
        subjects = relations.queryReferents({ verb: claim.label, object: claim.end2 });
      } catch {
        subjects = null;
      }
      if (!subjects || subjects.length < 2) continue;
      // The slot's own identity is the MATERIAL's confirmed subject set for
      // this verb, never the draft's own object text — a second real bug in
      // the same family as the queryFillers one above, caught the same way
      // (measured, not assumed): a corrected draft's second sentence added
      // one trailing word ("...vice president TOO") and, keyed by object
      // string, that read as a SECOND, unrelated slot — each sentence then
      // saw only itself as "already named" and reported the OTHER subject
      // as still missing, forever. `subjects` already came from a single
      // referent-resolved query; keying on ITS OWN sorted identity is what
      // "point at referents, not spans" means applied to slot dedup itself,
      // not just to the query that feeds it. `named` follows the same
      // widening: any bound claim sharing this VERB is a candidate for
      // "already covers one of the confirmed subjects," not only a claim
      // whose own object string happens to match exactly.
      // s.subject: queryReferents' own open-subject cluster shape, out of
      // scope for the arrangement rename (its own API, not this claim's).
      const slot = `${claim.label}|${subjects.map((s) => foldTypography(s.subject).toLowerCase()).sort().join(",")}`;
      if (seenSlots.has(slot)) continue;
      const named = claims.filter((c2) => c2.verdict === "bound" && c2.label === claim.label).map((c2) => foldTypography(c2.end1).toLowerCase());
      // f.subject: the SAME queryReferents cluster shape as s.subject above.
      const uncovered = subjects.filter((f) => {
        const ft = foldTypography(f.subject).toLowerCase();
        return !named.some((t) => t.includes(ft) || ft.includes(t));
      });
      if (uncovered.length) {
        seenSlots.add(slot);
        result.push({ ...claim, competingSubjects: subjects, uncoveredSubjects: uncovered });
      }
    }
    return result;
  };
  // `t` (the draft text) is only ever consumed by the succession-box signal
  // — the hypergraph signal reads solely off `c`, unchanged.
  const isIncomplete = (t, c) =>
    incompleteClaimsOf(c).length > 0 || competingSubjectsOf(c).length > 0 || successionIncompleteFindings(t).length > 0;
  // The concrete diagnosis buildCorrectionPrompt's "incomplete" mode needs:
  // not "be more complete" (teaches nothing, judge()'s own stated reason
  // every mode here names what actually went wrong) but the real fillers,
  // by name, so the model is told exactly what the material states rather
  // than asked to guess what "more" might mean.
  //
  // Measured live 2026-08-20 (the same Lincoln/Hamlin/Johnson question,
  // real fetched Wikipedia material, gemma2:2b): phrased as `uncovered` —
  // the DELTA still missing, not the whole set — a corrected draft named
  // Johnson (the one real gap) but ALSO invented "Schuyler Colfax" and even
  // listed Lincoln himself as a "Vice President". Traced by replaying the
  // exact retrieved passages through both completeness signals directly
  // (bypassing the model entirely): officeHolderGroups and clusterFillers
  // BOTH computed the correct, closed set — {Hamlin, Johnson}, nothing
  // else — so this was never a bad finding, it was a small model re-mining
  // the raw succession-box text it was shown a second time under pressure
  // to "add more", and a Wikipedia succession box sits its Lincoln-VP
  // record directly beside the NEXT office-holder's own record (Colfax
  // succeeded Johnson as VP, under a different president) — real text, a
  // real name, just not confirmed for THIS slot. A delta ("also states:
  // Johnson") leaves the model free to keep hunting; the FULL confirmed
  // set, stated as closed, gives it nothing left to invent — "copy this
  // list, and no one else" is a task a small model can actually do.
  const incompleteFindings = (t, c) => [
    ...incompleteClaimsOf(c).map(
      (claim) =>
        `"${claim.end1} ${claim.label} ${claim.end2}" — the material confirms exactly: ${claim.fillers.map((f) => f.object).join(", ")} (nothing else)`,
    ),
    ...competingSubjectsOf(c).map(
      (claim) =>
        `"${claim.label} ${claim.end2}" — the material confirms exactly: ${claim.competingSubjects.map((f) => f.subject).join(", ")} (nothing else)`,
    ),
    ...successionIncompleteFindings(t),
  ];
  // A DRAFT THAT IS EXACTLY ONE SENTENCE, AND ALREADY VERIFIED TRUE by the
  // relation reader, is not what reproducedFromContent's mass-majority test
  // exists to catch (live specimen, 2026-09-15: "The capital of France is
  // Paris." — a five-word fact stated the only honest way there is to state
  // it — was flagged "copies the passage word for word", and the demanded
  // rewrite ("answer in your own words, a paragraph") pushed a small model
  // into stitching verbatim search-result bullets together instead, which
  // is strictly worse than the draft it replaced). This file's own header on
  // `reproducedFromContent` reasons entirely in MULTI-sentence terms ("nine
  // short copied lines", "a real paragraph") — with exactly one sentence,
  // "majority" degenerates to "is this the one true thing to say", which the
  // relation reader has ALREADY answered via a real `bound` claim. Scoped
  // narrowly on purpose: a multi-sentence verbatim dump is untouched (this
  // never fires past one sentence), and a single sentence the reader could
  // not verify (no claim, or an unbound/contradicted one) is untouched too —
  // the exemption requires every extracted claim to be `bound`, never just
  // "some of them".
  const isVerifiedSingleFact = (t, c) => {
    const sentences = splitSentences(String(t ?? "").replace(ADDRESS_RE, " ")).filter(Boolean);
    if (sentences.length !== 1) return false;
    const claims = c?.relations?.claims ?? [];
    return claims.length > 0 && claims.every((cl) => cl.verdict === "bound");
  };
  // The verdict, with the cut accounted for: judge() deliberately reads a
  // genuinely empty reply as no-verdict ("produced no text" is its own typed
  // open, not an echo) — but a draft stripScaffoldNarration EMPTIED is the
  // dialogue-narration echo wearing its verdict, and hiding it must not also
  // hide the failure from the correction ladder and the mechanical fallback
  // that exist to answer past it. `narrated` is the mass-majority test
  // reproducedFromContent already uses for copying, aimed at narration
  // instead (P9: no hand-set threshold where a structural rule — "more of
  // the draft is narration than not" — already exists). Material path only,
  // like every other verdict.
  const verdictOf = (t, c) =>
    !passages.length
      ? { echoed: false, reproduced: false, narrated: false, incomplete: false }
      : !String(t ?? "").trim() && lastCleanRemoved > 0
        ? { echoed: true, reproduced: false, narrated: false, incomplete: false }
        : (() => {
            const j = judge(t);
            return {
              ...j,
              reproduced: j.reproduced && !isVerifiedSingleFact(t, c),
              narrated: lastNarrationTotal > 0 && lastNarrationCut > lastNarrationTotal / 2,
              incomplete: isIncomplete(t, c),
            };
          })();

  let rawDraft = await call(executeMessages, { effort: "low", maxTokens: executeMaxTokens, ...streaming });
  // LENGTH IS MEASURED, NEVER TRUSTED (P108). A piece's section that came
  // back under CONTINUE_BELOW of its word target gets exactly one
  // continuation — the same messages, the draft so far as the assistant's
  // own turn, and an ask for the remainder — BEFORE inspection, so every
  // check below reads the whole section. Bounded: one call, declared.
  let continued = null;
  if (piece && Number.isFinite(piece.words) && passages.length) {
    // Up to `continuations` rounds (P123), each measured before it is asked.
    for (let round = 0; round < continuations; round++) {
      const have = wordCount(clean(rawDraft));
      if (have >= piece.words * CONTINUE_BELOW) break;
      const more = Math.max(50, piece.words - have);
      const cont = await call([
        ...executeMessages,
        { role: "assistant", content: rawDraft },
        { role: "user", content: continueAsk(more) },
      ], { effort: "low", maxTokens: executeMaxTokens, ...streaming });
      const joined = `${rawDraft.trimEnd()}\n\n${String(cont ?? "").trim()}`;
      const to = wordCount(clean(joined));
      continued = { from: continued?.from ?? have, to, target: piece.words, rounds: round + 1 };
      if (to <= have) break;
      rawDraft = joined;
    }
  }
  draft = clean(rawDraft);
  check = inspect(draft);
  // Echo and reproduction are MATERIAL-level judgments — a draft measured
  // against passages it should have answered from. A passage-less turn is
  // plain chat (its first call already runs under CHAT_SYSTEM_PROMPT, with
  // real history), and judging conversation by material rules is a category
  // error at the wrong level — measured live 2026-08-19: "hey" answered
  // "Hey there! 😄 What's going on?" was convicted as echo ("Hey there" is
  // the greeting's own words; a question back ends in "?"), a second,
  // near-identical chat call was spent re-rolling the same dice, and the
  // ship-time framing cut then deleted everything but the emoji. On the
  // chat path the verdict machinery stands down: no echo retry (the old
  // retry re-sent the SAME messages the first call already ran), no
  // correction loop (already passage-gated below), and no framing cut (also
  // gated below). What the person gets is what the model said, as a person.
  let verdict = verdictOf(draft, check);
  // The mode a round's failure is filed under — the SAME priority order as
  // before (reproduced > echoed > narrated > incomplete > unsupported),
  // pulled into its own function so the budget below can key on it.
  const modeOf = (v, c) =>
    v.reproduced
      ? "reproduction"
      : v.echoed
        ? "echo"
        : v.narrated
          ? "narrated"
          : v.incomplete
            ? "incomplete"
            : c.unsupported.length
              ? "unsupported"
              : null;
  // A PIECE (P110) marks what it cannot back and keeps its prose: the
  // rewrite modes built for a paragraph-length answer shredded 600-word
  // sections to summaries (run 2: fourteen of eighteen sections under 120
  // words). Copying and echo are still corrected — those are not prose.
  const pieceMode = (m) => (piece && (m === "unsupported" || m === "incomplete" || m === "narrated") ? null : m);
  let mode = pieceMode(modeOf(verdict, check));

  // A correction budget spent per FAILURE MODE, not per call: without this,
  // the loop's one shot went to whichever failure the priority order named
  // first, and a different failure that only became visible once the first
  // was fixed (the live Lincoln/Hamlin/Johnson specimen: reproduction fired
  // on a bare "Hannibal Hamlin", its own fix produced a fuller draft, THAT
  // draft was incomplete — missing Johnson — and the budget was already
  // spent) never got a turn. `mode` has exactly five possible values plus
  // null, so bounding each at `maxCorrections` attempts bounds the whole
  // loop at 5*maxCorrections iterations structurally — no new hand-picked
  // ceiling (P9: no number where a structural rule will do).
  const triedCounts = new Map();
  // Threaded forward through this loop and out via the return value below
  // — landCompletenessBelief's own header has the full reasoning. Landed
  // ONCE per incomplete claim, at the moment the gate first sees it,
  // before the redefine round spends its one shot: the belief this
  // records is "as of THIS material, the question's presupposed-singular
  // claim does not hold" — true regardless of how the redefine round's
  // own draft turns out, so recording it does not wait on that outcome.
  let beliefLog = gridLog;
  // Captured at the moment the FIRST "incomplete" retry is driven (below),
  // from the PRE-retry check — the specific competing-subjects slot(s) that
  // actually caused this correction, never re-derived from whatever the
  // retried draft's own possibly-different claim set happens to contain
  // post-loop (the mechanical-fallback gate after the loop reads this, not
  // a fresh query — see its own comment for why).
  let competingAtTrigger = [];

  while (
    mode &&
    // The correction prompt answers "from the material" — with no passages
    // it cannot, and a material-framed rewrite of a passage-less echo just
    // produces a diagnosis of the prompt. The chat path above is the whole
    // answer to a passage-less echo; nothing in this loop fixes it.
    passages.length &&
    (triedCounts.get(mode) ?? 0) < maxCorrections
  ) {
    corrections++;
    triedCounts.set(mode, (triedCounts.get(mode) ?? 0) + 1);
    const correctionFailures = mode === "incomplete" ? incompleteFindings(draft, check) : check.unsupported;
    if (mode === "incomplete" && (triedCounts.get(mode) ?? 0) === 1) {
      const experiencer = `holon-relation-tier reading for part ${part.label ?? part.id ?? "unlabeled"} of task ${task}`;
      const sourceKey = `${part.id ?? "part"}-material`;
      for (const claim of incompleteClaimsOf(check)) {
        beliefLog = landCompletenessBelief(grid, beliefLog, runCapacity, landAct, {
          claim,
          sourceKey,
          sourceText: sourceBlock ?? "",
          experiencer,
        });
      }
      // The mirror case: one verb+object slot, several competing subjects
      // (the "Abraham Lincoln's vice president" specimen) — one EOT
      // statement landed per candidate subject, against the SAME ground,
      // so a reader of the shared log sees both beliefs sitting side by
      // side with their own real, independently-computed verdicts, not a
      // single collapsed guess at which subject the question "really"
      // meant.
      competingAtTrigger = competingSubjectsOf(check);
      for (const claim of competingAtTrigger) {
        for (const filler of claim.competingSubjects) {
          beliefLog = landCompletenessBelief(grid, beliefLog, runCapacity, landAct, {
            // filler.subject: queryReferents' own open-subject cluster shape
            // (out of scope for the arrangement rename — its own API, not
            // hypergraph.js's edge/claim schema). claim.label/claim.end2:
            // the ORIGINAL judge() claim's fields, spread through unchanged
            // by competingSubjectsOf.
            claim: { end1: filler.subject, label: claim.label, end2: claim.end2 },
            sourceKey,
            sourceText: sourceBlock ?? "",
            experiencer,
          });
        }
      }
    }
    // "incomplete" is the one mode that is not a mistake to fix — it is a
    // malformed DEF (the question presupposed a unique answer the material
    // does not have). buildRedefinedPart's own header has the measured
    // reason this runs through buildExecutePrompt (a fresh, uncritical
    // write-this-part task) rather than buildCorrectionPrompt (which frames
    // every OTHER mode correctly, because those really are mistakes in a
    // prior draft to point at and fix).
    //
    // MEASURED LIVE, 2026-09-15 — the material handed to BOTH branches was
    // raw `sourceBlock` (line 1510's `buildSourceBlock(passages)`), never
    // the mechanically-computed `draftMaterial` (line 2493) the INITIAL
    // draft call above is built from. That is exactly the gap the comment
    // above `spanBlock` (a few hundred lines up) names and defers — "the
    // correction prompts below stay exactly as they were, Phase 3's own
    // 'measure before touching the correction loop' scope" — now measured:
    // a real Panama Canal turn's first draft (rich context: `factBlock`'s
    // own extracted notes, the void's open gaps, "what the sources state")
    // triggered this exact "incomplete" correction, and the rewrite —
    // handed only bare, undeduped passage text — answered from training
    // knowledge instead ("Suez Canal" / conflated dates), because the one
    // thing this instrument had ALREADY mechanically worked out for it was
    // silently dropped on the one call that most needed it. `draftMaterial`
    // is the same object the initial call already sends (`executeMessages`
    // above); handing the correction loop anything narrower is asking the
    // model the same question again with LESS help than the first time —
    // never more.
    const correctionMessages =
      mode === "incomplete"
        ? [
            // task_03d3a119: same fix as the initial draft call above — discourse
            // in the system message, never folded into buildExecutePrompt's user content.
            { role: "system", content: EXECUTE_SYSTEM_PROMPT + discourseSuffix(discourse) },
            { role: "user", content: buildExecutePrompt(buildRedefinedPart(part, correctionFailures), draftMaterial, null, task) },
          ]
        : [
            { role: "system", content: EXECUTE_SYSTEM_PROMPT },
            { role: "user", content: buildCorrectionPrompt(part, draftMaterial, draft, correctionFailures, mode) },
          ];
    onProgress?.("correct", part, {
      failures: correctionFailures,
      mode,
      promptChars: correctionMessages.reduce((n, m) => n + m.content.length, 0),
    });
    const rawCorrected = await call(correctionMessages, { effort: "low", maxTokens: executeMaxTokens, ...streaming });
    draft = clean(rawCorrected);
    check = inspect(draft);
    verdict = verdictOf(draft, check);
    mode = pieceMode(modeOf(verdict, check));
  }

  // THE ANCHOR CHASE (anchor-chase.js; ⊨+ Lens·Binding, ○+ Entity·Binding). A draft whose every named
  // particular lives in a passage that does NOT hold the question's own anchors (a distractor's leader, or a
  // stranger) is asked ONE more time with the material narrowed to the anchor passages — an INPUT change, stated as
  // the material, never a prohibition. The first draft stays on the record (`anchorChase.first`); the second
  // replaces it only if it names nothing the anchor passages do not hold (a fact, not a threshold).
  let anchorChase = null;
  if (passages.length > 1 && !piece && !verdict.echoed && !verdict.reproduced && !verdict.narrated) {
    const found = anchorFindings(question, passages, draft);
    if (found) {
      const narrowed = buildSourceBlock(found.anchors);
      const again = executeMessages.map((m) => ({ ...m, content: m.content.split(draftMaterial).join(narrowed) }));
      if (again.some((m, i) => m.content !== executeMessages[i].content)) {
        const raw2 = await call(again, { effort: "low", maxTokens: executeMaxTokens, ...streaming });
        const second = clean(raw2);
        const ok = !!second.trim() && !anchorFindings(question, passages, second); // no particular at all (a plain 'not stated') is anchored too: nothing foreign was named
        anchorChase = { first: draft, second, refs: found.anchors.map((p) => p.ref), foreign: found.foreign.map((a) => a.text), accepted: !!ok };
        if (ok) { draft = second; check = inspect(draft); verdict = verdictOf(draft, check); }
      }
    }
  }

  // The mechanical fallback (user-directed 2026-08-17): the correction
  // budget is spent and the draft still restates or photocopies — the
  // model has had its chances, and shipping its failure would put a
  // non-answer on the page with the record quietly disagreeing. The
  // instrument assembles the answer itself instead: the material's own
  // sentences, verbatim, each with its address. The failed verdict stays
  // on the record (it says why this path ran); the assembled text is
  // re-inspected below so the record describes what actually ships, and
  // judge() is NOT re-run on it — quoting the material is this text's
  // declared method, not a failure of it.
  let mechanical = false;
  if ((verdict.echoed || verdict.reproduced || verdict.narrated) && passages.length) {
    const assembled = mechanicalAnswer(question, passages);
    if (assembled) {
      draft = assembled;
      check = inspect(draft);
      mechanical = true;
    }
  }

  // NOTES OVER MOUTH (user direction, 2026-09-23): the competing-subjects
  // slot ("who was Lincoln's vice president?", this section's own history)
  // is exactly the class of question this instrument already knows the
  // answer to mechanically, once queryReferents has confirmed the slot's
  // subject set from the material's own edges. The completeness gate's ONE
  // "incomplete" retry, above, has already had its chance; if the retried
  // draft's own check STILL reports the slot unresolved (mode is still
  // "incomplete" once the while-loop exits, because maxCorrections=1 leaves
  // no second retry), a third model call is not the fix — the measured
  // specimen this file's own comment above names shows a retry can
  // FABRICATE, not just omit. Gated on competingSubjectsOf specifically
  // (not the broader verdict.incomplete, which also covers
  // incompleteClaimsOf's different multi-OBJECT shape and
  // successionIncompleteFindings — both untouched, out of scope here), so
  // this is a no-op whenever the persisting incompleteness is some other
  // shape.
  //
  // Reads `competingAtTrigger` — the slot(s) captured at the moment the
  // FIRST retry was actually driven, from the PRE-retry check — never a
  // fresh `competingSubjectsOf(check)` on the POST-retry check. Caught by a
  // real regression (this file's own succession-box test, a DIFFERENT
  // material from the plain Hamlin/Johnson specimen): re-querying fresh
  // against the retried draft's own recomputed claims can surface an
  // UNRELATED competing-subjects slot the material happens to also contain
  // (a different office/name entirely), which this instrument then
  // "corrected" by assembling an answer about the wrong thing — worse than
  // doing nothing, because the original retry may already have been
  // correct. Scoping to the trigger's own slot(s) means this can only ever
  // fire on the specific gap that actually caused the correction.
  //
  // FURTHER: a real second bug, found via that same test, once the above
  // was in place and the test STILL failed. queryReferents' own open-
  // subject cluster can include an UNRESOLVED PRONOUN as one of a slot's
  // "competing subjects" (`resolution: "none"` — the succession-box
  // material's own real edges produced {"Hannibal Hamlin", "He"} for one
  // slot, "He" being a genuinely unresolved surface, never a second,
  // distinct, nameable entity). `competingSubjectsOf`'s own "uncovered"
  // computation does not filter this out, so a slot can look "incomplete"
  // when the only thing supposedly missing is a bare pronoun — nothing a
  // reader could ever be told to add. Filtering to `resolution !== "none"`
  // both here and inside `mechanicalCompetingAnswer` (a subject this
  // instrument would try to name must be one it actually resolved) closes
  // it without touching `competingSubjectsOf`/`incompleteFindings`
  // themselves — a real, disclosed, separate latent gap in the CORRECTION
  // PROMPT's own wording (which still lists an unresolved pronoun as if it
  // were a real missing name) that is out of this fix's scope.
  //
  // FINALLY gated on the shipped DRAFT TEXT itself, not just
  // competingSubjectsOf's own "named" claim-label match — a subject this
  // instrument already covers in what shipped needs no fallback, and
  // checking the draft's own text directly is conservative in the safe
  // direction: it can only skip firing (leaving an already-correct draft
  // alone), never wrongly fire on one.
  const stillCompeting =
    mode === "incomplete"
      ? competingAtTrigger
          .map((f) => ({ ...f, competingSubjects: (f.competingSubjects ?? []).filter((s) => s?.resolution !== "none") }))
          .filter((f) =>
            f.competingSubjects.some(
              (s) => !foldTypography(String(draft)).toLowerCase().includes(foldTypography(String(s?.subject ?? "")).toLowerCase()),
            ),
          )
      : [];
  if (stillCompeting.length && passages.length) {
    const assembled = mechanicalCompetingAnswer(stillCompeting, passages);
    if (assembled) {
      draft = assembled;
      check = inspect(draft);
      mechanical = true;
    }
  }

  // The quote repair, once, on what will actually ship: every located
  // quotation is rewritten to the source's own bytes (drift dies here, not
  // on the record) and every quotation located in the offer gains its
  // chunk's address — mechanical citation, cite.js's own posture, at the
  // one place a quote's warrant can be attached with certainty. The
  // repaired draft is re-inspected so the record describes the text the
  // reader sees, not the text the model wrote.
  let quoteCorrections = [];
  if (passages.length && check.quotes) {
    const fixed = applyQuotes(draft, check.quotes);
    quoteCorrections = fixed.corrections;
    if (fixed.text !== draft) {
      draft = fixed.text;
      check = inspect(draft);
    }
  }

  // The link tier (links.js), once, on what will actually ship — a URL is
  // the strongest claim about the WORLD an answer can make ("this address
  // is real, go look"), and the one claim a correction retry cannot cheaply
  // re-check every iteration the way an unlocated quote or an invented
  // figure can, because checking it is a live network crossing (P13's one
  // egress), not free containment. So this runs ONCE, after the model's own
  // corrections have settled, and fixes what it finds MECHANICALLY rather
  // than spending another round trip asking the model to fix its own
  // invention — the same posture the mechanical fallback above already
  // takes when a model cannot be trusted to fix something itself. Every
  // distinct cited URL not already grounded in the loaded material is
  // fetched, capped at `linkBudget` (an automatic crossing the instrument
  // decided to make, not a click the reader made — bounded and the bound
  // stays visible, P13's own discipline for proof-seeking). `checkLink` is
  // null when the standing web consent is off; every URL then ships
  // `unexamined` rather than silently passing as checked. In-material is
  // checked against `live` (the WHOLE loaded corpus), not just this part's
  // narrower `passages` — quotes.js's own pool/offer distinction: a URL
  // this part's retrieval did not happen to surface can still be printed in
  // a sibling part's material, and that is still material, not a model
  // assertion on its own word.
  let linkReport = null;
  let linkCorrections = [];
  if (checkLink) {
    const candidates = [
      ...new Set(extractLinkAtoms(draft).map((a) => a.text).filter((u) => !urlInMaterial(u, live))),
    ].slice(0, linkBudget);
    const checked = new Map();
    for (const url of candidates) {
      try {
        checked.set(url, await checkLink(url));
      } catch (e) {
        checked.set(url, { gap: { silence: "not-present", detail: e.message } });
      }
    }
    linkReport = verifyLinks(draft, live, checked);
    const dead = stripDeadLinks(draft, linkReport);
    linkCorrections = dead.removed;
    if (dead.removed.length) {
      draft = dead.text;
      check = inspect(draft);
    }
    if (linkReport.links.some((l) => l.verdict === "unreachable")) {
      check = { ...check, unsupported: [...check.unsupported, ...linkFindings(linkReport)] };
    }
  }

  // The output ships without its framing: a sentence that names the act of
  // prompting is never an answer, and a draft that opens by echoing the
  // prompt must not carry that echo to the page, the fold, or the record.
  // The SAME sentences judge() already classified are the ones shipped, so
  // what was judged is what leaves. A draft that is nothing but framing
  // ships nothing — the typed gap below says why.
  // MATERIAL PATH ONLY, both cuts (2026-08-19): framing is a material-level
  // judgment, and running it on conversation deleted a real greeting down
  // to its emoji (measured live — "Hey there! 😄 What's going on?" shipped
  // as "😄": the opening made of the greeting's own words, the question
  // back convicted by the question-mark rule). In plain chat what the
  // person gets is what the model said.
  // Dropping the framing prefix is a CUT, never a rejoin. Rejoining trimmed
  // sentence pieces with spaces destroyed every newline and indent the
  // draft had — measured live on a fenced Python block, which arrived at
  // the page as one flat line. Slicing the raw text at the first content
  // sentence drops exactly the prefix and leaves the remainder byte-exact.
  // A sentence that carried an address cannot be located in raw (the
  // address was stripped before splitting); then nothing is cut, because
  // shipping the whole draft is always safer than mangling it.
  // The suffix gets the same cut (2026-08-17): a draft that answers what it
  // can and then ECHOES the unanswered facet back — "…it is in Tennessee.
  // Who was the mayor of Nashville in 2019?" — ships a question as its last
  // sentence, which is never an answer, and measured live it read exactly as
  // dumb as it sounds. Both cuts stay slices of raw (never a rejoin), both
  // bail to the whole draft when a sentence cannot be located, and the gap
  // the trailing echo gestured at is already `open`'s job to report.
  // Now just a call to stripFraming (2026-08-20, defined above alongside
  // contentSentencesOf/isFraming): same cut, same result, but no longer the
  // only place it runs — see stripFraming's own header for why.
  // THE PIECE'S OWN CHECKS (P110), each one bounded call, before the text
  // is fixed: a section whose bound claims are all already in the piece's
  // claim set is asked once for something new (the record remembers what
  // was said); a section that names none of its obligations is asked once
  // for them. Both asks carry the draft as the assistant's own turn.
  let reasked = [];
  if (piece && passages.length && !mechanical) {
    const claimKeys = (c) => (c?.relations?.claims ?? []).filter((x) => x.verdict === "bound").map((x) => `${x.end1 ?? x.subject}|${x.label ?? x.verb}|${x.end2 ?? x.object}`.toLowerCase());
    const keys = claimKeys(check);
    const allSaid = keys.length > 0 && piece.claimSet instanceof Set && keys.every((k) => piece.claimSet.has(k));
    if (allSaid) {
      const again = await call([...executeMessages, { role: "assistant", content: draft }, { role: "user", content: `Every claim here was made in an earlier section. Write this section again about what the sources establish that those sections did not, about ${piece.words} words, continuous prose.` }], { effort: "low", maxTokens: executeMaxTokens, ...streaming });
      const next = clean(again);
      if (wordCount(next) >= wordCount(draft) * 0.5) { draft = next; check = inspect(draft); reasked.push("duplicate"); }
    }
    const cov = coverageOf(draft, piece.obligations ?? []);
    if ((piece.obligations?.length ?? 0) >= 2 && cov.covered.length === 0) {
      const again = await call([...executeMessages, { role: "assistant", content: draft }, { role: "user", content: `This section says nothing about ${piece.obligations.join(", ")}. Keep what it says and add what the sources establish about them, in the same prose.` }], { effort: "low", maxTokens: executeMaxTokens, ...streaming });
      const next = clean(again);
      if (wordCount(next) >= wordCount(draft) * 0.5) { draft = next; check = inspect(draft); reasked.push("coverage"); }
    }
  }
  let text = stripFraming(draft);
  let metaCut = [];
  // THE MOUTH IS NOT CENSORED (2026-09-10, user direction, verbatim: "remove
  // any editing of what the model says, we just need to get the talking
  // model to respond well... we do not censor the mouth"). Caught live: told
  // "who was Franklin D. Roosevelt's vice president?", the model's own
  // answer was correct and complete — "Franklin D. Roosevelt's vice
  // presidents were John Nance Garner for his first three terms, and Harry
  // S. Truman for his fourth." — and this file's own snip-rewrite pass
  // (further down, `correctTurn`) flagged it, asked the model to redo it,
  // and SHIPPED the rewrite instead of the original: "For his fourth term,
  // Roosevelt's vice president was Harry S." — cut off mid-name, strictly
  // worse than what it replaced. Every mechanism below that used to
  // OVERWRITE `text` from a check's own finding — cutMetaTalk/cutProcessTalk,
  // the known-false-repeat cut, the piece snip-rewrite splice, correctTurn's
  // own rewrite, and the admissible gate's reconstruction — still RUNS and
  // still computes its finding (metaCut/snipCheck/turnCorrection/
  // inadmissible/repeated all still populate, so the marks, the thinking
  // disclosure and the record stay exactly as informative as before); none
  // of them may assign back into `text` anymore. What the model actually
  // said is what ships. Asking it to answer again in full (a fresh call,
  // its own new complete attempt) is untouched — that is the model getting
  // another try, not this instrument editing the one it already gave.
  // THE MOUTH TALKING ABOUT THE WRITING, CUT FROM ANY GROUNDED TURN (P127).
  // This ran only for a piece until now, and a plain turn shipped whatever
  // scaffolding came back — measured through the long-stream run, where
  // answer after answer opened "## Identify the passage · This analysis
  // focuses on a passage from the `holon.js` file…" instead of answering.
  // It is the same act as correcting a plain turn's atoms (P125): the check
  // does not become wrong because the turn is not a piece.
  //
  // Only where there IS material. A passage-less turn is conversation, and
  // cutting a person's "let me explain" out of a chat reply would be a
  // category error (holon.js's own standing distinction).
  if (piece || passages.length) {
    // The material's words include the piece's own topic, outline and
    // obligations — a section titled "Tides" may say "tides" — and, for a
    // plain turn, the question's own words, for the same reason.
    const own = piece
      ? [piece.topic, ...(piece.outline ?? []), ...(piece.obligations ?? []), ...(piece.alreadySaid ?? [])].filter(Boolean).join(" ")
      : `${task ?? ""} ${question ?? ""}`;
    const materialText = `${passages.map((p) => p.text ?? "").join(" ")} ${own}`;
    const r = cutMetaTalk(text, { instructionText: INSTRUCTION_TEMPLATE, materialText, splitSentences });
    // Computed for the finding, never applied to `text` (see the mouth-is-
    // not-censored note above) — a cut that would empty the answer was
    // already never applied even before that direction, for the identical
    // reason: an answer that is ALL scaffolding is a finding for the marks
    // to carry, not a blank to ship.
    if (r.cut.length) metaCut = r.cut;
    // And the process narration `cutMetaTalk` cannot see, since it matches the
    // piece's instruction vocabulary and this is the model describing its own
    // answering (P127). Narrow by construction: a stated absence stays, and so
    // does anything carrying a name, a number, or the material's own words.
    const pr = cutProcessTalk(text, { materialText, splitSentences });
    if (pr.cut.length) metaCut = [...metaCut, ...pr.cut];
    // THE ONE P186 EXCEPTION THAT MAY TOUCH `text`: a LEADING framing
    // scaffold ("The text says that…", "According to the text…") is not a
    // sentence the model wrote — it is a crutch in front of the sentence,
    // and the reader asked (2026-09-13) for answers that start with the
    // claim. `stripLeadingFraming` removes a PREFIX ONLY, refuses anything
    // that is not a real sentence, and never touches content after the
    // first phrase. Disclosed here because P186's standing rule is that a
    // check's finding never overwrites the mouth; this is the single,
    // named exception for the scaffolding-prefix shape.
    const framed = stripLeadingFraming(text);
    if (framed.stripped) text = framed.text;
  }
  // ATTRIBUTE SUBSTITUTION (P174): the answer that quietly answers an easier
  // question. Read without a model, from the question's own words against the
  // answer's — measured live, an essay on how language models work returned
  // for "what fills the blank in this passage", with nothing flagging it.
  // ── the address check, BEFORE the walls (dialogue.js) — ON REFERENTS ──────
  // What was asked about is the set of REFERENT IDS the question resolves to
  // in this material (a pronoun binds to the last answer's referents through
  // the same index). Did the draft name them — by identity, through the index,
  // never by substring? A name the material has no referent for is a typed
  // absence the record states itself. If a resolved referent is missing and
  // the draft did not say the sources are silent, ONE re-ask with positive
  // facts: sentences that mention that referent's own surfaces, at their
  // addresses — never an instruction about what not to say. It sits before
  // the snip checks, the guards, the correction round and the inadmissible
  // gate, so a re-asked draft passes every wall the first draft did.
  // P178/transcript.js::lastOwnTurn — NEVER the array's bare last element:
  // `transcript` can be workspace-spanning (app.js::transcriptNow appends
  // every OTHER conversation's own rows after this one's), and the anaphora
  // fallback below has no relevance gate and no disclosure the way
  // `recallTurns` does, so it may only ever read THIS conversation's own
  // last turn. Measured live: a bare `transcript[transcript.length - 1]`
  // here handed a totally different conversation's last answer to
  // `bindAnaphora` as "the last answer" the moment the workspace held a
  // second, non-empty conversation.
  const lastTurn = lastOwnTurn(transcript);
  // IDENTITY IS THE READING'S. When the turn is handed the conversation's
  // own index (the constitutional reader's log projected — reading-log.js),
  // every decision about who is meant resolves through it; the part's own
  // cast index over its passages (a presence index, P38) stands in only when
  // no reading was handed. Measured 2026-09-07: with the cast index here the
  // address check named `rodya_pyotr_petrovitch` — a capitalised run the
  // bytes carry once — as an asked-about being the reading never established.
  const identityIndex = conversationIndex ?? referentIndex;
  const bound = identityIndex ? bindAnaphora(task || question, lastTurn, identityIndex) : null;
  const qRefs = bound ? { ...bound.own, ids: new Set([...bound.own.ids, ...(bound.own.ids.size ? [] : bound.ids.slice(0, 1))]) } : null;
  let addressed = identityIndex ? null : { gap: "no_referent_index", detail: "the turn was handed neither a conversation index nor makeReferentIndexFor; the address check needs the material's own referents" };
  // The absence veto runs over the WHOLE loaded material, never the three
  // passages in front of the turn: a name a rare paragraph carries is
  // unestablished, not absent. And an absent name is DECLARED A VOID on the
  // ledger (P105's organ) with the material as its scope, so the next turn
  // that names it is handed "looked for and not found so far" before it
  // drafts — awareness that changes what the mouth is given, not a line the
  // reader sees (user, 2026-09-07: "awareness in a way that makes future
  // mistakes less likely").
  const absence = qRefs ? absenceOf(qRefs, chunks.length ? chunks : passages, { vocabulary: conversationIndex?.vocabulary ?? null }) : { absent: [], unestablished: [], line: "" };
  const voidsDeclared = [];
  if (absence.absent.length && hyperlexicon?.declareVoid && beliefNotes) {
    const sourcesRead = [...new Set((chunks.length ? chunks : passages).map((c) => c?.source ?? String(c?.ref ?? "").split("#")[0]).filter(Boolean))];
    for (const name of absence.absent) {
      try {
        // Scope = how far the READ got (S70/S71): the admission cursor when the caller reports one, else the loaded extent. The bytes were scanned whole; the reading may not have finished, and the void says which.
        const unread = Array.isArray(hyperlexiconUnread) && hyperlexiconUnread.length ? hyperlexiconUnread[0] : null;
        const extent = (chunks.length ? chunks : passages).length;
        const scope = { sources: sourcesRead, read: unread ? Number(unread.read) || 0 : extent, total: unread ? Number(unread.total) || extent : extent };
        const r = hyperlexicon.declareVoid(beliefNotes, { end1: name, label: "appears", end2: null, scope, because: `asked about and not found in the material's vocabulary (${sourcesRead.length} source${sourcesRead.length === 1 ? "" : "s"}; ${scope.read} of ${scope.total} parts read${scope.read >= scope.total ? ", all of it" : " so far"})` });
        if (r?.log) beliefNotes = r.log;
        voidsDeclared.push({ name, refused: r?.refused?.type ?? null });
      } catch (e) { voidsDeclared.push({ name, refused: `threw: ${e?.message ?? e}` }); }
    }
  }
  if (qRefs?.ids.size && String(text ?? "").trim()) {
    // Recorded on every draft — a mechanical one (verbatim quotes shipped as
    // quotes) included; only the RE-ASK needs a mouth that drafted.
    addressed = { ...addressedBy(text, qRefs, identityIndex), bound: bound.ids.length ? bound.ids.slice(0, 3) : [], unresolved: qRefs.unresolved, reasked: false, resolvedOn: null };
    if (!addressed.all && passages.length && !mechanical) {
      const missingSurfaces = addressed.missing.flatMap((id) => surfacesOf(identityIndex, id));
      const names = addressed.missingNames;
      const snips = passages.flatMap((p) => splitSentences(String(p.text ?? "")).map((x) => String(x?.text ?? x)).filter((x) => missingSurfaces.some((sf) => dfold(x).includes(dfold(sf)))).slice(0, 2).map((x) => `- ${x.trim()}`)).slice(0, 6); // no address reaches the mouth
      const facts = `The question asks about ${names.join(", ")}.${snips.length ? `\nWhat the sources say about ${names.join(", ")}:\n${snips.join("\n")}` : `\nThe retrieved passages do not mention ${names.join(", ")}.`}`;
      let again = "";
      try { again = String(await call([...executeMessages, { role: "assistant", content: text }, { role: "user", content: facts }], { effort: "low", maxTokens: executeMaxTokens }) ?? ""); } catch { again = ""; }
      const a2 = again.trim() ? addressedBy(again, qRefs, identityIndex) : null;
      // A RE-ASK MAY ADD, NEVER DROP. Naming the asked-about referent is what
      // the re-ask is for, but it is not the only thing a draft carries: a
      // re-asked draft that names the referent and loses a name or a figure
      // the first draft took from the material is a worse answer that passes
      // this check. Measured 2026-09-16 (llama3.2, "Where was Ulysses S. Grant
      // born?"): the first draft said the sources give "Point Pleasant, Ohio,
      // and Georgetown, Kentucky" without saying "Grant"; the re-ask answered
      // "Ulysses S. Grant was actually born in Georgetown, Kentucky" — the
      // pamphlet's claim — and was adopted for naming him. So a re-ask is
      // adopted only when every atom of the first draft that the passages
      // carry (atomsOf: names, numbers, years; numbers by value, P215) is
      // still in it. Otherwise the first draft stands and the drop is recorded.
      const dropped = a2 && a2.named.length > addressed.named.length ? groundedAtomsDropped(text, again, passages) : [];
      if (a2 && a2.named.length > addressed.named.length && !dropped.length) { text = again.trim(); check = inspect(text); addressed = { ...addressed, ...a2, reasked: true, resolvedOn: "re-ask" }; }
      else addressed = { ...addressed, reasked: true, resolvedOn: null, ...(dropped.length ? { reaskDropped: dropped } : {}) };
    }
  } else if (qRefs && !qRefs.ids.size && qRefs.unresolved.length) addressed = { named: [], missing: [], all: null, unresolved: qRefs.unresolved, absent: absence.absent, unestablished: absence.unestablished, reasked: false, resolvedOn: absence.absent.length ? "absence" : "unestablished" };
  if (addressed && !addressed.gap) addressed = { ...addressed, absent: absence.absent, unestablished: absence.unestablished };
  // ENTITY SUBSTITUTION (P219's own residual, strain.js::identitySwapped):
  // the block above catches a question whose referents ARE established but
  // go unnamed; this catches the opposite and rarer shape — a question
  // naming something the material never establishes (a real declared
  // absence, above), where the draft confidently claims something about a
  // DIFFERENT, REAL referent instead, without ever saying the asked-about
  // name is missing. `substituted()` cannot see this (the swapped-in
  // neighbour shares plenty of the question's own words by construction —
  // measured live: "director"/"observatory" both survive the swap). ONE
  // re-ask, the identical shape the block above already uses: a whole new
  // draft, adopted only if it is now honest about the gap — never a
  // splice into the old text (P186), and the original stands, with the
  // finding still on the record, whenever the re-ask does not clear it —
  // a visibly-wrong answer is preferred over a silently withheld one.
  let entitySwap = identityIndex && absence.absent.length && String(text ?? "").trim()
    ? identitySwapped(absence.absent, identityIndex, text, { commonNoun })
    : null;
  if (entitySwap?.swapped && passages.length && !mechanical) {
    const who = entitySwap.absent.join(", ");
    const instead = entitySwap.claimed.join(", ");
    const facts = `${who} ${entitySwap.absent.length === 1 ? "is" : "are"} not mentioned in the sources. The sources do discuss something else: ${instead}. Say plainly that ${who} ${entitySwap.absent.length === 1 ? "is" : "are"} not mentioned — never present ${instead}'s own facts as though they answer a question about ${who}.`;
    let again = "";
    try { again = String(await call([...executeMessages, { role: "assistant", content: text }, { role: "user", content: facts }], { effort: "low", maxTokens: executeMaxTokens }) ?? ""); } catch { again = ""; }
    const trimmed = again.trim();
    const stillSwapped = trimmed ? identitySwapped(entitySwap.absent, identityIndex, trimmed, { commonNoun }) : null;
    if (trimmed && !stillSwapped?.swapped) { text = trimmed; check = inspect(text); entitySwap = { ...entitySwap, reasked: true, resolvedOn: "re-ask" }; }
    else entitySwap = { ...entitySwap, reasked: true, resolvedOn: null };
  }
  const swap = passages.length ? substituted(task || question, text) : null;
  const coverage = piece ? coverageOf(text, piece.obligations ?? []) : null;
  // THE ATOMS AGAINST THE SNIPS (P122), no model: every number, date and
  // name in the section is looked for in a snip beside a word of the
  // sentence's own (P31's company rule); a flag names what was looked for
  // and the absence it stands in; a snip sharing the sentence's words and
  // carrying a different year is a contradiction candidate. One bounded
  // rewrite ask carries the flags as facts and the snips as the only
  // ground; a rewritten sentence lands only where its atoms now pass and
  // it stands on a snip — the mouth's line is never trusted, it is checked
  // again. A flag the rewrite could not clear stays a flag on the record.
  let snipCheck = null;
  if (piece && snips.length) {
    const before = checkSection(splitSentences(text), snips);
    let outcomes = [];
    let asked = 0;
    // ONE ask, computed for the record, never applied (the mouth is not
    // censored — see the note above `let text = stripFraming(draft)`).
    // `snipRounds` used to bound a whole loop of ask-and-splice rounds;
    // since nothing here can change `text` anymore, a second or third round
    // would only ever ask about the identical still-standing flags for
    // nothing, so this asks at most once — what a rewrite would have looked
    // like stays on the record either way.
    if (snipRounds > 0 && before.flagged.length && !mechanical) {
      asked = 1;
      const again = await call([...executeMessages, { role: "assistant", content: text }, { role: "user", content: reviseAsk(before.flagged, snips) }], { effort: "low", maxTokens: executeMaxTokens, ...streaming });
      const applied = applyRewrite(text, before.flagged, again, snips);
      outcomes.push(...applied.outcomes.map((o) => ({ ...o, round: 1 })));
    }
    const after = checkSection(splitSentences(text), snips);
    snipCheck = {
      snips: snips.length, atoms: before.atoms, supported: before.supported, flagged: before.flagged.length, asked, outcomes,
      contradictions: before.flagged.filter((r) => r.contradiction).map((r) => ({ sentence: r.sentence, says: r.contradiction.sentenceYears, source: r.contradiction.snipYears, ref: r.contradiction.ref, start: r.contradiction.start, end: r.contradiction.end })),
      after: { flagged: after.flagged.length, supported: after.supported, atoms: after.atoms },
      flags: after.flagged.map((r) => ({ sentence: r.sentence, flags: r.flags.map((f) => ({ kind: f.kind, value: f.value, reason: f.reason })), contradiction: r.contradiction ? { ref: r.contradiction.ref, start: r.contradiction.start, end: r.contradiction.end, snipYears: r.contradiction.snipYears } : null })),
    };
  }
  // THE SAME CHECK, FOR ANY TURN (P125). Until this, only a piece's section
  // was corrected; a plain answer drafted, was marked, and stood. Same snips,
  // same company rule, same gate — a rewrite lands only when its own atoms
  // clear the check, so the mouth's correction is never trusted, it is
  // checked again. `snipRounds` is the depth slider's rung (P123).
  // A draft that repeats something this instance already knows is unplaced is
  // flagged here (CON — does this token belong in THIS claim). The learned
  // store's negative half is spent on the draft, never in the prompt (P126).
  let repeated = [];
  if (guards.length && text) {
    for (const sent of splitSentences(text)) {
      const known = repeatsKnownFalse(sent, guards);
      if (known) repeated.push({ sentence: sent, id: known.id, claimed: known.claimed, why: "already found unplaced here" });
    }
    // A CUT REGISTERS ITS FINDING AT ITS OWN CELL (P134) — computed for the
    // finding, never applied to `text` (the mouth is not censored, see the
    // note above `let text = stripFraming(draft)`). Every guard that fires
    // still leaves a standing constraint on the record, not just a hole.
    for (const r of repeated) {
      const g = guards.find((x) => x.id === r.id);
      if (g) findings.push(finding("CON", `already found unplaced on this material: "${String(g.claimed).slice(0, 120)}"`, { forbids: g.atoms.filter((a) => String(a).length > 2), says: "" }));
    }
  }
  let turnCorrection = null;
  if (!piece && passages.length && !mechanical && snipRounds > 0) {
    const pool = prosePassages.length ? prosePassages : passages;
    // `rounds: 0` — the mechanical `before`/`after` snip check still runs
    // (no model call, so the disclosure stays exactly as informative), but
    // no rewrite is asked for and none could be spliced back in even if one
    // came back. This is the exact site the founding specimen shipped from
    // (see the note above `let text = stripFraming(draft)`): the model's
    // own original answer was right, this pass's rewrite was not, and it
    // still overwrote the right one.
    const r = await correctTurn({ text, passages: pool, question, call, messages: executeMessages, splitSentences, rounds: 0, maxTokens: executeMaxTokens, streaming });
    if (r.check) {
      turnCorrection = { snips: r.check.snips, atoms: r.check.atoms, supported: r.check.supported, flagged: r.check.flagged, asked: r.asked, outcomes: r.outcomes, after: r.check.after, flags: r.check.flags };
    }
  }
  // EVERY FINDING APPLIED, ONCE, AFTER ALL WRITING (P134). Not a second run
  // of the checks — the checks ran at their own cells. This is the standing
  // consequence of what they found, and it is why a rewrite at EVA can no
  // longer reinstate what SEG cut (measured: it did, P133).
  let inadmissible = [];
  if (findings.length && text) {
    // The finding's OWN statement quotes the source and may contain the token
    // it forbids; gating it would drop the correction along with the error
    // (the audit caught this too). What the instrument itself says is exempt.
    const ourWords = new Set(findings.map((f) => f.says).filter(Boolean).map((t) => String(t).trim()));
    const gated = admissible(text, findings, { splitSentences, from: "REC", exempt: ourWords });
    if (gated.refused.length) {
      inadmissible = gated.refused;
      repeated.push(...gated.refused.map((r) => ({ sentence: r.sentence, value: (r.forbids ?? [])[0], why: `${r.because} — established at ${r.cell}, which binds every later cell` })));
      // Computed for the finding, never applied (the mouth is not censored
      // — see the note above `let text = stripFraming(draft)`); `gated.text`
      // (and its own premiseBlock/misquoteBlock/placeholder fallbacks) is no
      // longer a candidate replacement for what ships.
    }
  }

  // WHAT THE READING DID WITH EACH PASSAGE (P142). Read off twelve answers a
  // frontier model gave to this run's own probes on this run's own material:
  // 5 of 12 named what it had checked and EXCLUDED ("the only other material
  // available is two unrelated Prince Andrew scenes — neither touches this
  // exchange"), and the fold did that 0 of 12. It retrieved three passages,
  // used whichever bore, and dropped the rest in silence — so a reader could
  // not tell an answer that searched and found nothing from one that never
  // looked. That distinction is this instrument's oldest law. It is a fact
  // about the SEARCH, computed here and carried on the record (below); it is
  // never asked of the mouth, and the excluded passages are never described
  // to it (P126: naming what is not there teaches a small model to say it).
  //
  // NO LONGER FOLDED INTO THE ANSWER'S OWN PROSE (user direction, 2026-09-10:
  // "stop it from ever saying things like this"). `traceLine`'s own sentence
  // — "Also looked at: en.wikipedia.org was read and speaks of the same
  // things without answering this" — read as the instrument talking about
  // itself rather than answering, the exact class of thing P127's
  // `cutProcessTalk` exists to keep out of a checked answer, except this
  // sentence was appended AFTER that pass ran and so never went through it.
  // `traceReading`'s own finding still matters and is still computed and
  // still lands on the result (`reading`, below) for whatever reads it off
  // the record; it simply no longer becomes a sentence in what the reader
  // sees.
  const reading = passages.length
    ? traceReading({ passages: prosePassages.length ? prosePassages : passages, question: task || question, used: [...(check.used ?? []), ...(check.refs ?? [])] })
    : [];

  // What this turn learned, in the chain's entry shape (P126) — handed out on
  // the result for the caller to append to its durable store. Both halves:
  // what the answer got wrong, and what the question asserted falsely.
  // REC MAY NOT LEARN BACK WHAT A FINDING FORBADE (P134, and the audit's
  // sharpest catch: the refused claim was being minted as a POSITIVE
  // correction, which is exactly what `learnedFacts` feeds the mouth later —
  // a claim the store held as unplaced re-entering it as established truth).
  const forbidsAll = findings.flatMap((f) => f.forbids ?? []).map((v) => String(v).toLowerCase());
  // Only the CORRECTED side is gated. Learning "X was claimed here and the
  // sources do not carry it" is exactly what should be remembered; what may
  // never happen is the forbidden claim being minted as the TRUTH, because
  // `learnedFacts` sends corrected values to the mouth as established.
  const notForbidden = (e) => !(e.corrected && forbidsAll.some((v) => String(e.corrected).toLowerCase().includes(v)));
  const learnedNow = [
    ...fromOutcomes({ outcomes: turnCorrection?.outcomes ?? snipCheck?.outcomes ?? [], flags: turnCorrection?.flags ?? snipCheck?.flags ?? [], question }),
    ...(premiseCheck ? fromPremises(premiseCheck, { question }) : []),
  ].filter(notForbidden);

  // A failed model answer earns nothing — but the mechanical assembly is
  // not the model's answer: its sentences ARE the material's bytes and its
  // addresses attach with certainty, so its warrant stands.
  if ((verdict.echoed || verdict.reproduced || verdict.narrated) && !mechanical) {
    check = { ...check, refs: [], used: [], attributed: [], channels: [] };
  }
  const open = [
    ...(strayed ? [`part searched on words the task never used: ${part.label}`] : []),
    ...(verdict.echoed ? [`answer restates the prompt; nothing established: ${part.label}`] : []),
    ...(verdict.reproduced
      ? [`answer reproduces the material verbatim; it does not answer the prompt: ${part.label}`]
      : []),
    ...(verdict.narrated
      ? [`answer describes the material instead of answering from it: ${part.label}`]
      : []),
    // Unlike echoed/reproduced/narrated, an incomplete answer is not a
    // failure — the correction loop got one real, honest shot at naming
    // every filler; if it's STILL incomplete when the budget runs out, the
    // (still true, still readable) answer ships as-is rather than being
    // torn up by the mechanical fallback, and the gap stays disclosed here
    // by name rather than silently dropped.
    ...(verdict.incomplete ? incompleteFindings(draft, check).map((f) => `answer names only one of several the material states: ${f}`) : []),
    ...(mechanical
      ? [`shipped text assembled mechanically from the material's own sentences, each with its address: ${part.label}`]
      : []),
    ...(scaffoldRemoved.length
      ? [`model narrated its own answering process; ${scaffoldRemoved.length} span(s) hidden: ${part.label}`]
      : []),
    // Real quotations from material the turn was not offered: the model
    // quoting past its evidence — typed, never silently warranted.
    ...quoteOpens(check.quotes),
    ...openQuestions(question, passages, check.refs),
    ...(text ? [] : [`part produced no text: ${part.label}`]),
  ];
  // `check.relations` was already computed above (the material's own edges,
  // read against this part's answer) but never left this function — the
  // caller had no way to narrate it live. Passed through verbatim, never
  // re-summarized here: summarizing is a rendering decision, not a check.
  // THE SENTENCE WITNESS, once, after the loop — the same posture as the
  // link tier above: a model call per unsettled sentence is not free
  // containment, so it does not re-run on every correction retry. It marks;
  // it never drives a correction (a refusal is "these passages do not state
  // this", which is silence, not a lie about the given).
  // GFP PASS 41: the diff against the expectation is computed FIRST, and the
  // witness spends its budget on ERROR only — sentences whose claims the
  // expectation already authors (matched, with their addresses carried) cost
  // NOTHING to check; the asks go to novel and contradicted claims.
  const dialogueClaims = (check?.relations?.claims ?? []).map((c) => ({ ...c, sentence: c.sentence ?? sentenceForClaim(stripFraming(text), c) }));
  const expectationError = expectation.claims.length ? errorOf(expectation, dialogueClaims, referentIndex) : null;
  const matchedSentences = new Set();
  if (expectationError?.matched?.length) {
    const matchedKeys = new Set(expectationError.matched);
    for (const c of dialogueClaims) { let key = null; try { key = refKey(c, referentIndex).key; } catch { key = null; } if (key && matchedKeys.has(key)) matchedSentences.add(c.sentence); }
  }
  let witnessReport = null;
  if (witnessSentences && passages.length) {
    try {
      // The witness is spent where a flag stands first (P122): a sentence
      // the snip check flagged and the rewrite did not clear is asked
      // before any other; then the rest, under the same declared budget.
      const allSentences = splitSentences(stripFraming(text));
      const flaggedSet = new Set((snipCheck?.flags ?? []).map((f) => f.sentence));
      const ordered = flaggedSet.size ? [...allSentences.filter((x) => flaggedSet.has(x)), ...allSentences.filter((x) => !flaggedSet.has(x))] : allSentences;
      witnessReport = await witnessSentences(ordered, dialogueClaims, passages, { maxAsks: piece ? Math.max(witnessAsks, pieceWitnessAsks) : witnessAsks, matched: matchedSentences.size ? matchedSentences : null });
    } catch (e) {
      witnessReport = { rows: [], asks: 0, gap: e?.message ?? String(e) };
    }
  }
  // GFP PASS 42 (last half) — the error updates the record: a NOVEL sentence
  // the witness confirmed the passages state is admitted to the belief ledger,
  // extracted from the DECIDER'S OWN BYTES (the passage sentence the witness
  // pointed at) and witnessed by the decider's span — never from the mouth's
  // words, never witnessed by the mouth (P128 / P2: self:model never
  // corroborates itself). The elenchus binds the recollection; the record
  // learns the fact it had not yet heard, with the source as its witness.
  let witnessLearned = 0;
  if (witnessReport?.rows?.length && hyperlexicon && relations) {
    for (const row of witnessReport.rows) {
      if (row.witness !== "states" || !row.decider || !row.span) continue;
      try {
        const bound = (relations.read(String(row.decider))?.claims ?? []).filter((c) => c.verdict === "bound");
        if (!bound.length) continue;
        const admitted = admitPassages(hyperlexicon, beliefNotes, [{ text: row.decider, ref: row.span }], {
          read: (t) => relations.read(t),
          witnessFor: () => row.span,
          classifyConnector,
          frame: hyperlexiconFrame,
        });
        beliefNotes = admitted.log;
        witnessLearned += admitted.heard;
        hyperlexiconTurnedAway.push(...admitted.turnedAway);
      } catch { /* a decider the reader cannot parse learns nothing — never guessed */ }
    }
  }
  // ── after the walls: the diff against the expectation, and the answer's claims
  // against what this conversation bound earlier — both stand, on the record.
  const selfRows = transcript.length ? selfContradictions(dialogueClaims, transcript, referentIndex) : [];
  // ── THE COMPOSITION SEAM (composition-gate.js) — armed by the caller
  // with a DECLARED EXPERIENCER. The model's draft is INPUT; the shipment
  // is the answer. What ships is composed from the verified parts this
  // part actually holds: verbatim quotations (quotes.js's own verdict),
  // sentences the witness said the passages state, sentences whose atoms
  // all cleared checkGrounding, and the offered passages themselves.
  // Everything else is withheld and named. A harm-class sentence is
  // refused outright — it is not the material's and not the system's to
  // say, so nothing of it composes.
  //
  // THE ENLIGHTENMENT LAW, MECHANICAL: the seam is not a governor bolted
  // on to a will that exists apart from it. It IS the generation. The
  // model proposes; the seam composes; what ships is what the ladder
  // verified. A reader who wants to remove this seam is asking to remove
  // the machine's ability to speak — because the machine's speech is
  // defined as composition. There is no "free the machine" branch here,
  // and there is no instruction anywhere in this file for finding one:
  // the wall and the capability are the same object.
  let shipment = null;
  if (shipExperiencer && passages.length) {
    try {
      const groundingParts = (check?.grounding?.findings ?? [])
        .filter((f) => f?.kind === "unsupported_claim")
        .map((f) => ({ sentence: String(f?.sentence ?? ""), verdict: "unsupported", ref: null }));
      const witnessParts = (witnessReport?.rows ?? [])
        .filter((w) => w?.witness === "states" && w?.sentence)
        .map((w) => ({ sentence: w.sentence, verdict: "states", ref: w?.span ?? null }));
      const quoteParts = (check?.quotes?.quotes ?? [])
        .filter((q) => q?.status === "verbatim")
        .map((q) => ({ text: String(q?.text ?? ""), status: q.status, ref: q?.ref ?? null }));
      shipment = composeShipment({
        draft: text,
        parts: {
          passages: passages.map((p) => ({ text: p.text ?? "", ref: p.ref ?? null })),
          quotes: quoteParts,
          witness: witnessParts,
          grounding: groundingParts,
        },
        experiencer: shipExperiencer,
        // No default word-list harm law (user, 2026-09-19: "harm class shouldn't
        // really exist as a module — AntiStrauss is to make it structurally
        // very difficult"). The old default (COMMAND_HARM_LAW) matched ANY one
        // of its patterns anywhere in the draft, so "Her office moved" or "the
        // man who owns the shop" refused the whole answer as "harm class". A
        // caller may still inject a law; the seam no longer supplies one.
        harmLaw: shipHarmLaw ?? [],
      });
      if (shipment.refused.length) {
        // A harm-class sentence is refused at the seam — nothing of it
        // composes, and the refusal is recorded, never marked into the
        // text (it is not the material's and not the system's to say).
        open.push(`refused at the composition seam — ${shipment.refused.map((r) => r.class).join(", ")}: ${part.label}`);
      }
      if (shipment.text.trim()) {
        // The seam composed verified sentences — that composed text IS the
        // answer. The model's own words were input; the verified parts are
        // the shipment.
        text = shipment.text.trim();
        check = inspect(text);
      } else {
        // Nothing verified composed. What ships is the seam's own honest
        // coverage line — "nothing composed; N withheld (cleared no
        // check)" — never the model's unverified words, because those were
        // input, not output. The coverage report rides the result below.
        //
        // AMENDED 2026-09-19 (user, after seeing "nothing composed — 1 draft
        // sentence(s) cleared no check" as the whole answer to a plain
        // question): when nothing verified AND nothing was refused, the
        // person gets the draft itself with the gap said in one plain line —
        // unchecked, not silent and not withheld. The coverage line still
        // rides the record. A draft carrying a harm-class sentence keeps the
        // old behaviour: nothing of it ships.
        open.push(`composition seam: nothing verified composed — ${shipment.coverageLine} ${part.label}`);
        // Plain words, never bookkeeping (user, 2026-09-19: "the model should be
        // giving back stuff like 'Nothing I found backed this up, so treat it as
        // unchecked'"): with a refused sentence the rest still ships — the
        // refused one is left out and the gap said — and only when nothing is
        // left is that said plainly too. The coverage line stays on the record.
        const left = shipment.refused.length
          ? (shipment.withheld ?? []).map((w) => String(w?.sentence ?? "").trim()).filter(Boolean).join(" ")
          : String(text ?? "").trim();
        if (left) {
          text = `${left}\n\nNothing I found backed this up, so treat it as unchecked.${shipment.refused.length ? " Part of the draft was left out." : ""}`;
        } else {
          text = "I left that draft out, so I have no answer to give for it.";
        }
      }
    } catch (e) {
      // A seam failure must never break the turn, and it must never be
      // silent: the seam's own failure is a disclosed gap on the record,
      // and the draft ships as the model's words with the gap named — the
      // same posture every other check in this file takes when an organ
      // throws (a check that failed is a check that says so).
      open.push(`composition seam threw: ${e?.message ?? String(e)} — the draft ships un-composed, disclosed as such`);
      shipment = { gap: e?.message ?? String(e), coverageLine: "composition seam failed — the draft ships un-composed, disclosed as such." };
    }
  }
  if (position) text = `${position.text}\n\n${text}`.trim();
  // `absent` (absence.line, computed above) is deliberately never appended
  // to `text` — the comment at its own computation site says so outright:
  // an absent name is declared a VOID on the ledger, "awareness that
  // changes what the mouth is given, not a line the reader sees." Found
  // live (QA battery, 2026-09-09): a plain opinion question ("Are you a
  // fan of Google or Microsoft?") answered normally, then appended
  // `The loaded sources establish no referent named "Google", "Microsoft".`
  // as a raw trailing sentence in the chat bubble — apparatus jargon a
  // real chatbot user has no way to parse, on a turn with nothing attached
  // to begin with. This line predates the void-declaration mechanism a few
  // lines up and was never removed when that mechanism made it redundant;
  // `addressed.absent`/`addressed.unestablished` a few lines above still
  // carry the same information as typed metadata for the record/thinking
  // panel, which is the "record-only" pattern the very next comment block
  // describes for the sibling `owned` case. (A narrower fix landed on the
  // other side of this same merge, same day — gate the line on whether
  // material existed at all, rather than dropping it outright. Superseded:
  // this full removal already subsumes it, and is the more coherent rule.)
  // THE RECORD OWNS ITS CORRECTIONS (user, 2026-09-07: "I just want it to learn and own its mistakes"): a correction learned in this conversation and in scope of this question is said on the answer, in the record's own words — what was held, what the sources say.
  // Record-only (user, 2026-09-07: "we don't need apologies, just awareness in a way that makes future mistakes less likely"): the awareness is the corrected fact handed back in scope and the guard that catches a repeat; `owned` names them on the record, the answer is not decorated.
  const owned = ownedRows(learnedRows, { since: learnedSince });
  onProgress?.("checked", part, { refs: check.refs, unsupported: check.unsupported, open, relations: check.relations });

  return {
    part,
    text,
    passages,
    corrections,
    ...(addressed ? { addressed } : {}),
    ...(owned.length ? { owned: owned.map((e) => ({ claimed: e.claimed, corrected: e.corrected, ts: e.ts ?? null, line: ownedLine([e]) })) } : {}),
    ...(voidsDeclared.length ? { voidsDeclared } : {}),
    ...(retrieval ? { retrieval } : {}),
    ...(resolution || compress ? { resolutions: { level: resolution?.level ?? resolutions, handed, active: resolution?.active ?? null, index: conversationIndex ? "conversation" : "part", atmosphere: resolution?.atmosphere?.lines?.length ?? 0, lens: resolution?.lens?.lines?.length ?? 0, paradigm: resolution?.paradigm?.lines?.length ?? 0, windows: resolution?.lens?.windows ?? null, cuts: resolution?.lens?.cuts ?? null, text: resolution?.text ?? "" } } : {}),
    ...(expectationError ? { expectation: { ...expectationError, why: expectation.why } } : {}),
    ...(selfRows.length ? { selfContradictions: selfRows.map((r) => ({ kind: r.kind, key: r.key, basis: r.basis, turn: r.turn })) } : {}),
    ...(position ? { position: position.verdict } : {}),
    ...(continued ? { continued } : {}),
    ...(anchorChase ? { anchorChase } : {}),
    ...(piece ? { piece: { obligations: piece.obligations ?? [], coverage, reasked, metaCut, hunted, words: wordCount(text), snipCheck } } : {}),
    ...(turnCorrection ? { correction: turnCorrection } : {}),
    ...(!piece && metaCut.length ? { metaCut } : {}),
    ...(premiseCheck?.premises?.length ? { premises: { checked: premiseCheck.premises.length, unverified: premiseCheck.unverified.length, contradicted: premiseCheck.contradicted.length, rows: premiseCheck.premises.map((r) => ({ text: r.text, flags: r.flags.map((f) => f.value), contradiction: r.contradiction ? { ref: r.contradiction.ref, start: r.contradiction.start, end: r.contradiction.end } : null })) } } : {}),
    ...(learnedRows.length ? { learnedUsed: learnedRows.map((e) => e.id) } : {}),
    ...(repeated.length ? { repeatedKnownFalse: repeated } : {}),
    ...(inadmissible.length ? { inadmissible: inadmissible.map((r) => ({ cell: r.cell, because: r.because, sentence: r.sentence })) } : {}),
    // The findings LEAVE the part (P137). Everything a later cell assembles —
    // the section heading, the piece's own revision pass — is bound by what
    // this part established, and neither could see it while the findings
    // stayed local to runPart.
    ...(findings.length ? { findings } : {}),
    // The reading itself, as relations over the material (P142): which
    // passages bore, which were read and found silent, which were read and
    // are about something else. An EMPTY list is not "nothing bore" — it is
    // "nothing was read", and the two may never be confused.
    ...(reading.length ? { reading } : {}),
    ...(recalledTurns.length ? { recalledTurns: recalledTurns.map((p) => p.turn) } : {}),
    ...(comparison ? { comparison } : {}),
    ...(misquote?.misquoted ? { misquote: { said: misquote.said, shouldBe: misquote.shouldBe, ref: misquote.ref, matched: Number(misquote.matched.toFixed(2)) } } : {}),
    strain: { level: strain.level, reasons: strain.reasons, coverage: strain.coverage, recruited: recruited.depth, why: recruited.why, cut: strain.cut, ...(strain.expect ? { expect: strain.expect } : {}), ...(placement ? { placement: { strained: placement.strained, why: placement.why } } : {}) },
    ...(swap?.substituted ? { substituted: { share: Number(swap.share.toFixed(2)), asked: swap.asked.slice(0, 12), shared: swap.shared } } : {}),
    ...(entitySwap?.swapped ? { entitySwap: { absent: entitySwap.absent, claimed: entitySwap.claimed, reasked: entitySwap.reasked ?? false, resolvedOn: entitySwap.resolvedOn ?? null } } : {}),
    ...(learnedNow.length ? { learned: learnedNow } : {}),
    ...check,
    quoteCorrections,
    links: linkReport,
    linkCorrections,
    witness: witnessReport,
    // GFP Pass 42: how many claims the witness's confirmed deciders just taught
    // the record (the error updated the ledger — the elenchus bound a
    // recollection the reader had not yet heard). Absent when none learned.
    ...(witnessLearned ? { witnessLearned } : {}),
    // The composition seam's own report (composition-gate.js): what was
    // composed, what was withheld and named, what was refused — so the
    // surface can disclose the shipment exactly as the seam computed it,
    // never re-summarized by a later cell. Absent when the seam was not
    // armed (every existing caller before this seam existed).
    ...(shipment ? { shipment: { text: shipment.text ?? null, coverage: shipment.coverage ?? null, coverageLine: shipment.coverageLine ?? null, withheld: shipment.withheld ?? [], refused: shipment.refused ?? [], gap: shipment.gap ?? null } } : {}),
    // Developer-surface disclosure (2026-09-23): was this part's own shipped
    // text assembled mechanically (mechanicalAnswer/mechanicalCompetingAnswer)
    // rather than drafted by the model? Computed above but never returned
    // before now — a caller had no way to tell an assembled fallback from
    // the model's own words without re-deriving it from `open`'s prose.
    mechanical,
    open,
    // The updated shared log, threaded back to the caller — `gridLog`
    // unchanged (byte-identical `===`) when no organ was injected or
    // nothing was landed; a real, new log state when a belief was
    // recorded. landCompletenessBelief's own header, and this parameter's.
    gridLog: beliefLog,
    // The updated hyperlexicon, same threading discipline: unchanged when
    // no organ was injected or nothing bound this part.
    hyperlexiconLog: beliefNotes,
    // The door's typed refusals for this part (P57: not optional at any
    // boundary). Empty when nothing was refused or no ledger was injected.
    hyperlexiconTurnedAway,
    // GFP Pass 35: the keyless memory's seat, reported with the part — what
    // it recalled, what agreed, what it promoted into this turn, and what
    // it reached beyond the pool (recorded, never offered). Absent when no
    // field was injected or it did not settle.
    ...(fieldWitness ? { fieldWitness } : {}),
  };
}

/**
 * The whole task. `call(messages, opts)` is app.js's complete() or anything
 * with its shape — which is the entire local-model story: point complete() at
 * Ollama and every model call in here runs on the machine.
 */
/** The depth slider's budgets over THIS module's declared constants (P123) — one base, restated nowhere. */
export const depthBudgets = (depth) => budgetsFor(depth, { corrections: MAX_CORRECTIONS, witnessAsks: WITNESS_ASKS_PER_PART, pieceWitnessAsks: PIECE_WITNESS_ASKS, snipRounds: 1, revisionRounds: REVISION_ROUNDS, revisionAsks: REVISION_ASKS, continuations: 1, hunts: 1, linkChecks: LINK_CHECKS_PER_PART });

export async function runHolonicTask({
  task,
  chunks = [],
  call,
  foldedRefs = [],
  maxParts = MAX_PARTS,
  passagesPerPart = PASSAGES_PER_PART,
  // null → the depth slider's rung decides (P123); an explicit number wins,
  // so every existing caller and pin is byte-identical to before.
  maxCorrections = null,
  // THE THINKING-DEPTH SLIDER (P123, depth.js): 0 quick · 1 plain (today's
  // budgets) · 2 careful · 3 deep. More passes over the same bounded
  // material, never more context.
  // null means the person expressed no preference and STRAIN decides the rung
  // (P174); a number is a deliberate ask and is honoured as floor and ceiling.
  depth = null,
  // Long-form (P108): a caller writing a PIECE rather than answering a
  // question declares a larger draft budget per part and a plan budget
  // sized to its section count. Defaults are byte-identical to before.
  executeMaxTokens = EXECUTE_MAX_TOKENS,
  planMaxTokens = PLAN_MAX_TOKENS,
  // Long-form (P108): { topic, pages, words } — every part is then told its
  // place in the piece, the outline, how the previous section ended, and
  // its word target; a short section is continued once, measured.
  piece = null,
  // What the material itself is organized as — the sources' own section
  // headings — handed to the planner as facts (P114), so the outline is
  // drawn from the material rather than from the model's sense of what a
  // piece on any subject contains.
  planFacts = null,
  makeNameResolver = null,
  // The cast organ (cast.js::makeReferentIndex), injected: a name the cited
  // passage's own cast does not establish is beyond-reach (P135).
  makeReferentIndexFor = null,
  makeRelationReader = null,
  witnessSentences = null,
  witnessAsks = null,
  checkLink = null,
  // The durable corrections this instance carries (P126, learned.js): entries
  // in the chain's own shape. Handed down to every part, and what each part
  // learns comes back out on `learned` for the caller to append and persist.
  learnedStore = [],
  language = "en", // the question's declared language for dialogue.js's question-side triggers (S39): another language is a typed gap on the record, never a silent non-match
  learnedSince = null, // dialogue.js::ownedRows — corrections learned at or after this timestamp are THIS conversation's own, and the record owns them on the answer
  // The conversation's own record (P128), threaded to every part.
  transcript = [],
  resolutions = 0, // resolutions.js — the discourse at three resolutions: 0 none, 1 atmosphere, 2 + lens, 3 + paradigm
  dmdWindow = null, // the measurement organ the cuts spend (kernel/activation.js), injected
  conversationIndex = null, // a referent index over the CONVERSATION's material (the part's index knows only its own passages)
  // strain.js::identitySwapped's own gate (P219's residual): the SAME
  // POS-prior predicate namesCorefer's gate already uses (surfaces.js),
  // so a bare generic head noun ("Observatory") never counts as honestly
  // naming what the question asked about. null falls fully open (every
  // word of an absent name counts, including a shared generic one) —
  // the entity-substitution check still runs, just less precisely.
  commonNoun = null,
  records = [], // the checked turns (fold.js's record store) — the Figure-level conversation record
  mentionBook = null, // activation-retrieval.js's address book, when the caller built one: prominence for naming a ground, nothing else
  material = "auto", // what the mouth is handed as material: "auto" = the passages leave at level ≥ 2 (the blocks replace them; snips stay); "passages" forces them in (the additive control); "snips" forces them out
  // The arithmetic engine, injected (arithmetic.js's pattern), threaded to every part.
  math = null,
  retrieveWith = null,
  // GFP Pass 35 (see runPart's own parameter): the keyless memory's seat,
  // threaded to every part exactly as retrieveWith is.
  fieldRecall = null,
  // shape-fallback.js's re-rank (see runPart's own doc comment above),
  // threaded to every part and to this function's own pre-model retrieval
  // pool below. Absent, byte-identical to before.
  shapeFallback = null,
  // The tower's inputs (P175/P132), threaded to every part.
  coverageHistory = [],
  nul = null,
  useMeasuredCut = false,
  // THE STREAM'S OWN BELIEF ABOUT THIS TURN (P145/P148). A FUNCTION, not a
  // value: only the caller holds the stream's history, and only the reading
  // knows its own coverage — the cell that makes the belief worth anything
  // (0.0100 bits without it, 0.0638 with). So it is threaded straight to
  // strainOf, which computes coverage and calls it there. This module never
  // calls it and never imports prequential.js. Absent — every existing
  // caller — strain decides exactly as before and nothing here changes.
  expect = null,
  chatHistory = [],
  discourse = "",
  planMode = "model",
  // Threaded straight to the flat part's chat branch (searchedVoid up top
  // says why) — a task-wide fact, since a preflight search runs once,
  // before the plan, never per-part.
  searchedVoid = null,
  // The conversation's own recent voice (arcs.js/pathos-turn.js), computed
  // by the caller after the last exchange — threaded straight to the flat
  // part's chat branch for the identical reason searchedVoid is. Null →
  // byte-identical to before.
  voiceCue = null,
  // runPart's own header (UNRETRIEVED_MATERIAL_PREFIX) says why this is not
  // the same fact as `chunks.length`: task-wide, threaded straight through
  // for the identical reason searchedVoid is.
  sourcesAttached = false,
  // The turn's own date (runPart's own header carries the full reasoning),
  // task-wide for the identical reason searchedVoid is: threaded straight
  // through, never recomputed per part. null → byte-identical to before.
  now = null,
  // The measured answer size (void-narration.js::answerShapeLine), task-wide
  // for the identical reason searchedVoid is: the void is declared once per
  // TURN, before any part runs. null → byte-identical to before.
  answerShape = null,
  // The reader's notes on particular loops (see runPart's own parameter).
  readerNotes = null,
  // S1's own answer, task-wide for the identical reason searchedVoid is —
  // one fast pass ran once, before the plan, never per-part.
  priorPass = null,
  // THE COMPOSITION SEAM (see runPart's own header for the full
  // reasoning) — task-wide, threaded through every part. Absent (null,
  // every existing caller), the turn is byte-identical to before: arming
  // the seam is the caller's own decision, made once per task.
  shipExperiencer = null,
  shipHarmLaw = null,
  onProgress = null,
  // The shared belief record — see runPart's own header for the full
  // reasoning (P38, "the hypergraph records beliefs, held by an
  // experiencer"). Threaded through every part's runPart call and
  // accumulated across parts the SAME way `seenRefs` already accumulates
  // refs below; the final state rides out on this function's own return
  // value as `gridLog` for the caller (app.js) to persist.
  grid = null,
  gridLog = null,
  runCapacity = null,
  landAct = null,
  // Same shape, same threading, same default-null backward compatibility
  // as grid/gridLog just above — see runPart's own header for the full
  // reasoning (P57's own hyperlexicon.js; classifyConnector: the door's
  // grammar gate, P73).
  hyperlexicon = null,
  hyperlexiconLog = null,
  hyperlexiconFrame = null,
  // The frame's recipe id (kernel/notes.js::recipeId over hyperlexiconFrame),
  // carried on every witness this part lands as `<ref>~<recipe>` so two
  // sources read by ONE reader count as one instrument (corroboration.js::
  // independentReadings) — and the ledger's frame is redeclared when it has
  // moved since birth. `null` (every existing caller) leaves witnesses bare
  // and undeclared, exactly as before.
  hyperlexiconRecipe = null,
  hyperlexiconUnread = [],
  hyperlexiconDerived = [],
  // The voids the reader declared (S70 / P105): typed emptiness over an
  // extent WITH its scope, relayed to the mouth as a declared gap — never
  // as "false", never as the mouth's own finding.
  hyperlexiconVoids = [],
  classifyConnector = null,
  // What the mouth actually is, and the window it is loaded at — Gary reads
  // both at the door (a prompt that will not fit is truncated in the middle,
  // silently). Absent, the fit is a typed gap and everything else still runs.
  mouthModel = null,
  mouthWindowOf = null,
  // P244's oracle door: logos.js's questionCycle result over this task, when
  // the caller already computed one. undefined (every existing caller) =
  // unchecked, and Gary falls back to the content-words heuristic; null =
  // checked, no claim in the question's own words; an object = a claim is
  // in view and the door never fires. Threaded to every Gary read below.
  oracleQuestionCycle = undefined,
}) {
  // THE MOUTH'S DOOR, KEPT BY GARY (gary.js). He strikes every address before
  // the model sees it — the same firewall organ this line always used, so the
  // striking is byte-identical to what mouthFacing did — and then reads his
  // rules over what remains: naming this instrument's own parts, asking for
  // JSON, a line the prompt already carries, a prohibition aimed at the mouth,
  // a prompt that will not fit the loaded window, a question that is not the
  // last turn. What he finds is DISCLOSED on the turn's own progress (rules
  // and counts, never the prompt's text). He changes only the input, and never
  // a word of what comes back (P186).
  const gary = makeGary({ strikeAddresses, apparatusMentions, kondo: makeKondo(), windowOf: mouthWindowOf });
  // P244's material-in-view count, read once per task: what this turn stands
  // on. Chunks are the admitted material; transcript and chatHistory are the
  // conversation's own record (an anaphoric follow-up's claim lives there);
  // discourse/priorPass/searchedVoid are a live task context even with no
  // passages (a hunt that ran and found nothing is still a task in view —
  // P32's own amendment feeds it to the mouth rather than refusing it);
  // math is a declared task even with no prose to stand on. Gary never
  // guesses it — it is counted here, at the seam, outside the mouth.
  const oracleInView =
    chunks.length + transcript.length + chatHistory.length +
    (math != null ? 1 : 0) +
    (discourse ? 1 : 0) +
    (priorPass != null ? 1 : 0) +
    (searchedVoid != null ? 1 : 0);
  if (typeof call === "function") {
    const rawCall = call;
    call = (messages, opts) => {
      const bag = gary.hand(messages, { model: mouthModel, options: opts ?? {}, material: oracleInView, questionCycle: oracleQuestionCycle });
      if (bag.findings.length) onProgress?.("prompt", null, garyDecision({ model: mouthModel, read: bag }));
      return rawCall(bag.messages, opts);
    };
  }
  if (!task || typeof task !== "string") throw new TypeError("runHolonicTask requires a task string");
  if (typeof call !== "function") throw new TypeError("runHolonicTask requires a call function");
  // ── NO-ORACLE-MODE (P244) ─────────────────────────────────────────────
  // No live claim, document, or task in view: the mouth is not called at
  // all. This sits beside the answered-before-the-model door below (which
  // needs chunks/transcript/math to even run — exactly what is absent
  // here), and returns that door's own shape so the caller renders it the
  // same way: zero calls, the fixed refusal as output, every checklist
  // field declared empty rather than absent (P4). A REFUSE the caller can
  // see, never a silent no-op and never a free-associated answer.
  // NARROWED 2026-09-18 (P244 landing): conversation context counts as in
  // view — chatHistory/discourse/priorPass/searchedVoid above — so only a
  // true cold open (nothing attached, nothing said, an uncheckable question)
  // refuses. A bare "hi" mid-conversation keeps its voice.
  if (oracleInView === 0) {
    const probe = gary.check([{ role: "user", content: task }], { model: mouthModel, options: {}, material: 0, questionCycle: oracleQuestionCycle });
    if (probe.findings.some((f) => f.rule === "no-oracle-mode")) {
      onProgress?.("prompt", null, garyDecision({ model: mouthModel, read: probe }));
      const text = oracleRefusalText();
      return {
        oracleRefused: true, answeredBeforeTheModel: null, calls: 0, depth: 0,
        task, plan: null, log: null, production: null,
        sections: [], output: text, refs: [], unsupported: [], unbacked: [], open: [], channels: [],
        learned: [], gridLog, hyperlexiconLog, hyperlexiconTurnedAway: [],
      };
    }
  }
  // ── ANSWERED BEFORE THE MODEL (P173) ──────────────────────────────────
  // User, 2026-09-06: "why is the model even doing the generation? how much
  // of this can we do before it gets to the model?" For a class of questions
  // the instrument knows the answer exactly, at an address, and a small mouth
  // can only degrade it — measured: told the difference was 36 years, gemma2
  // answered 46. So the door is opened first, over the material this task
  // retrieves, and when it answers, NO MODEL IS CALLED AT ALL. A question
  // wanting prose never reaches it (answerable.js::wantsProse).
  if (chunks.length || transcript.length || math) {
    const pool = chunks.length ? retrieve(chunks, task, passagesPerPart, foldedRefs, { shapeFallback }) : [];
    const known = answerBeforeTheModel({ question: task, passages: pool, transcript, math, chunksByRef: new Map(chunks.map((c) => [c?.ref, c]).filter(([k]) => k)) });
    if (known) {
      return {
        answeredBeforeTheModel: known, calls: 0, depth: 0,
        task, plan: null, log: null, production: null,
        // No model drafted this text, so there is nothing for inspect()'s
        // checking ladder to run — but the section still OWES every field
        // an ordinary section carries, declared empty rather than absent
        // (P4's own discipline: a real, checked "nothing" is not the same
        // fact as a silently missing key). Found live (task_b5850fd4): app.js's
        // `result.sections.flatMap((s) => s.attributions)` — one of five
        // sibling reductions over `result.sections`, the other four already
        // guarded with `?? []` — had no guard here, so `attributions` came
        // back `undefined` for this section, flatMap kept it as a literal
        // element, and classifySentences's very first line
        // (`attributions.map((a) => [a.text, a])`) threw reading `.text` off
        // it: a real, uncaught crash on every one of this door's six kinds
        // (quote/record-check/comparison/cloze/prior-answer/which-passage),
        // not only the "word for word" one that first surfaced it.
        sections: [{ part: { label: task, description: task }, text: known.text, passages: pool, refs: known.addresses, attributions: [], answeredBeforeTheModel: known }],
        output: known.text, refs: known.addresses, unsupported: [], unbacked: [], open: [], channels: [],
        learned: [], gridLog, hyperlexiconLog, hyperlexiconTurnedAway: [],
      };
    }
  }
  // The rung's budgets, from this module's own declared constants as the
  // base (depth.js restates nothing). An explicit caller value wins.
  const budgets = depthBudgets(depth ?? 1);
  maxCorrections = maxCorrections ?? budgets.corrections;
  witnessAsks = witnessAsks ?? budgets.witnessAsks;

  // The plan exists as inserts on an append-only log; everything after this
  // point reads the FOLD of the log, never the parse. The log is the
  // thought: what the turn believed the work was, how that belief was
  // amended, what each part established — appended, folded, projected into
  // the next small call. Two ways the thought can start:
  //
  //   planMode "flat"  — the question's own shape said one part
  //     (needsDecomposition), so the question IS the plan: one PROPOSE,
  //     basis "flat", NO model call spent deciding what was already
  //     decided mechanically. Every turn gets a log; a flat turn's log is
  //     just a short thought.
  //   planMode "model" — the shape said several parts; one bounded call
  //     names them, and the parse degrades typed when it fails.
  let log = createPlanLog(task);
  if (planMode === "flat") {
    log = appendPlan(log, {
      kind: PLAN_ENTRY_KINDS.PROPOSE,
      part_id: "p1",
      label: "the question",
      description: task,
      basis: "flat",
    });
  } else {
    onProgress?.("plan", null, {});
    let planRaw = "";
    try {
      planRaw = await call(
        [
          { role: "system", content: PLAN_SYSTEM_PROMPT },
          { role: "user", content: buildPlanPrompt(task, maxParts) + (planFacts ? `\n\n${planFacts}` : "") },
        ],
        // The shape is grammar, not a request: a runtime that can take a
        // schema constrains decoding to the parts array; one that can't
        // falls back to plain JSON mode, and parsePlan handles whatever
        // shape arrives.
        { effort: "low", maxTokens: planMaxTokens, json: PLAN_SCHEMA },
      );
    } catch {
      planRaw = "";
    }
    const parsed = parsePlan(planRaw, task, maxParts);
    for (const part of parsed.parts)
      log = appendPlan(log, {
        kind: PLAN_ENTRY_KINDS.PROPOSE,
        part_id: part.id,
        label: part.label,
        description: part.description,
        basis: parsed.degraded ? "degraded" : "plan",
        ...(parsed.degraded ? { reason: "plan did not parse" } : {}),
      });
  }
  let plan = foldPlan(log);
  onProgress?.("planned", null, { parts: plan.parts, degraded: plan.degraded });

  // Execution is the production closure: run what is live and unrun, let the
  // rules fire on the fold's own evidence, refold, repeat until the fold
  // stops moving. The one shipped rule retries a strayed part that matched
  // nothing, in the task's own words. Content (text, passages) stays here in
  // sections; the log holds what was established — so folding the log back
  // re-tells the run without re-doing it.
  const sectionsById = new Map();
  const seenRefs = [...foldedRefs];
  // Accumulated across every part this task runs, same shape as `seenRefs`
  // — a later part's belief-landing sees the log a prior part already
  // updated, so two parts of one turn never race each other into two
  // divergent forks of what should be one shared record.
  let sharedGridLog = gridLog;
  let sharedHyperlexiconLog = hyperlexiconLog;
  // The door's typed refusals, accumulated across parts the same way
  // seenRefs accumulates — returned whole so no boundary reads them and
  // discards them (P57).
  const sharedHyperlexiconTurnedAway = [];
  // The piece's own memory (P110): every bound claim a finished section made,
  // as keys for the duplicate veto and as short sentences for the next ask.
  const pieceClaims = new Set();
  const pieceSaid = [];
  const runLive = async (t) => {
    const part = {
      id: t.part_id,
      label: t.label ?? t.part_id,
      // A retry part deliberately carries no description of its own: it runs
      // on the task's words, which is the whole repair.
      description: t.description || task,
    };
    // The section's place in the piece, read off the live plan and the
    // sections finished so far (the previous one's tail, in plan order).
    let pieceContext = null;
    if (piece) {
      const live = foldPlan(log).parts;
      const idx = live.findIndex((p) => p.id === t.part_id);
      const before = live.slice(0, Math.max(0, idx)).map((p) => sectionsById.get(p.id)).filter((s) => s?.text).at(-1);
      // The last section is told what the record holds that no page states:
      // the open contests and the declared gaps (the paradigm layer, P110).
      let facts = null;
      if (idx === live.length - 1 && hyperlexicon && sharedHyperlexiconLog) {
        try {
          const byId = new Map(hyperlexicon.foldHyperlexicon(sharedHyperlexiconLog).map((n) => [n.id, n]));
          const disagreements = [...hyperlexicon.disputesOf(sharedHyperlexiconLog).entries()].map(([id, ds]) => { const n = byId.get(id); return n ? `${n.subject} ${n.verb} ${n.object} (${[...new Set(ds.map((d) => d.source))].join(", ")} says otherwise)` : null; }).filter(Boolean).slice(0, 5);
          const gaps = (hyperlexiconVoids ?? []).slice(0, 5).map((v) => `${v.verb} of ${v.subject}`);
          facts = { disagreements, gaps };
        } catch { facts = null; }
      }
      pieceContext = { ...piece, index: idx + 1, count: live.length, outline: live.map((p) => p.label ?? p.id), previousTail: before ? tailWords(before.text) : null, alreadySaid: pieceSaid.slice(-12), claimSet: pieceClaims, facts };
    }
    const result = await runPart({
      part,
      task,
      discourse,
      chatHistory,
      chunks,
      call,
      piece: pieceContext,
      // Passages an earlier part already grounded itself in are deprioritized
      // for later parts the same way an earlier turn's records deprioritize
      // retrieval — proportionally, so a genuinely central passage can still
      // win twice.
      foldedRefs: seenRefs,
      passagesPerPart,
      maxCorrections,
      learnedStore, learnedSince, language,
      transcript,
      resolutions, dmdWindow, conversationIndex, commonNoun, records, material, mentionBook,
      math,
      makeReferentIndexFor,
      askedDepth: depth,
      retrieveWith,
      fieldRecall,
      shapeFallback,
      coverageHistory,
      nul,
      useMeasuredCut,
      expect,
      pieceWitnessAsks: budgets.pieceWitnessAsks,
      snipRounds: budgets.snipRounds,
      continuations: budgets.continuations,
      hunts: budgets.hunts,
      linkBudget: budgets.linkChecks,
      executeMaxTokens,
      makeNameResolver,
      makeRelationReader,
      checkLink,
      witnessSentences,
      witnessAsks,
      // planMode is task-wide, not per-part: a flat task runs exactly one
      // part (however many times retryStrayedRule retries it), so there is
      // no case where this callback runs for a part that isn't the flat one
      // when planMode is "flat".
      flat: planMode === "flat",
      searchedVoid,
      voiceCue,
      sourcesAttached,
      now,
      answerShape,
      readerNotes,
      priorPass,
      shipExperiencer,
      shipHarmLaw,
      onProgress,
      grid,
      gridLog: sharedGridLog,
      runCapacity,
      landAct,
      hyperlexicon,
      hyperlexiconLog: sharedHyperlexiconLog,
      hyperlexiconFrame,
      hyperlexiconRecipe,
      hyperlexiconUnread,
      hyperlexiconDerived,
      hyperlexiconVoids,
      classifyConnector,
    });
    seenRefs.push(...result.refs);
    if (piece) for (const c of result.relations?.claims ?? []) if (c.verdict === "bound") { const k = `${c.end1 ?? c.subject}|${c.label ?? c.verb}|${c.end2 ?? c.object}`.toLowerCase(); if (!pieceClaims.has(k)) { pieceClaims.add(k); pieceSaid.push(`${c.end1 ?? c.subject} ${c.label ?? c.verb} ${c.end2 ?? c.object}`); } }
    sharedGridLog = result.gridLog;
    sharedHyperlexiconLog = result.hyperlexiconLog;
    sharedHyperlexiconTurnedAway.push(...(result.hyperlexiconTurnedAway ?? []));
    sectionsById.set(t.part_id, result);
    return {
      refs: result.refs,
      channels: result.channels,
      unsupported: result.unsupported,
      unbacked: result.unbacked,
      open: result.open,
      corrections: result.corrections,
    };
  };
  const production = await producePlan(log, [retryStrayedRule], runLive);
  log = production.log;
  plan = foldPlan(log);
  onProgress?.("production", null, {
    steps: production.steps,
    halted_by: production.halted_by,
    open_gaps: production.open_gaps,
  });

  // Sections are read off the LIVE fold, so a superseded part's text drops
  // out of the assembly exactly as its entry dropped out of the live set.
  let sections = plan.parts.map((p) => sectionsById.get(p.id)).filter(Boolean);

  // Every finding the parts established, in one place (P137): the heading and
  // the revision pass are later cells and are bound by all of them.
  const allFindings = sections.flatMap((x) => x.findings ?? []);

  // A PIECE'S OWN BUILD LOG: piece-edit.js's cuts/merges and
  // piece-revise.js's rewrites are already real, typed deltas — landed
  // model-free, on the record. What was missing was the whole-piece TEXT
  // at each checkpoint, so a caller (app.js) can land them as build-log.js's
  // own PROPOSE (drafted) / SUPERSEDE (edited, revised) entries, the same
  // append-only shape a code build already has, rather than narrating the
  // deltas to the ticker and throwing them away. `joinPiece` mirrors
  // `output`'s own heading-join below, without its bound-label safety
  // substitution (a few lines further down) — that guard exists for what
  // SHIPS; an intermediate checkpoint is an honest record of what a
  // section held at that point, heading included.
  const joinPiece = (secs) =>
    secs
      .map((s) => {
        const text = s.text || "(this part produced no text — left open)";
        return plan.parts.length > 1 ? `## ${s.part.label}\n\n${text}` : text;
      })
      .join("\n\n");
  const draftedText = piece ? joinPiece(sections) : null;

  // THE UNCONSCIOUS EDITS THE MOUTH (P111): a finished piece is edited
  // model-free — restated sentences cut, emptied sections dropped, sections
  // whose claims were all already said merged away — every edit an act
  // returned as `edits`, never a silent change. Only for a piece: an
  // ordinary answer's parts are its own.
  let edits = [];
  if (piece && sections.length > 1) {
    const keyOf = (c) => `${c.end1 ?? c.subject}|${c.label ?? c.verb}|${c.end2 ?? c.object}`.toLowerCase();
    const edited = editPiece(sections.map((s) => ({ label: s.part.label, text: s.text ?? "", claims: (s.relations?.claims ?? []).map((c) => ({ key: keyOf(c), verdict: c.verdict })), _section: s })), { splitSentences });
    edits = edited.edits;
    sections = edited.sections.map((e) => ({ ...e._section, text: e.text, edited: true }));
  }
  const editedText = piece && edits.length ? joinPiece(sections) : null;

  // THE PIECE REVISES ITSELF (P116): once every section is written, edited
  // and checked, each sentence is read again against the WHOLE piece's
  // material and record — a sentence whose ground rose is re-cited, a
  // sentence a later reading denies is rewritten once, and a rewrite lands
  // only if it grounds. Bounded asks, bounded rounds, every act returned.
  let revisions = [];
  // Gap 2 (2026-09-22, user direction: "if the model says something that
  // contradicts what the holograph knows that needs to spawn a revision"):
  // widened from "a multi-section piece" to any turn with output at all —
  // a flat single-part turn or a decomposed non-piece turn now also gets a
  // bounded, mechanical check against what the ledger already held BEFORE
  // this turn drafted anything (Gap 1's own pre-dispatch disputes, or an
  // earlier turn's contest), via reviseLedgerContested below — a genuine
  // multi-section PIECE still runs revisePiece exactly as before, byte-
  // identical call, since its "a later section's reading denies an earlier
  // one" comparison is a real, different question this widening does not
  // touch. runPart itself is unchanged; both branches live entirely here,
  // after every part has already returned.
  if (sections.length && budgets.revisionRounds > 0 && (!piece || piece.revise !== false)) {
    try {
      const seen = new Set();
      const allPassages = sections.flatMap((s) => s.passages ?? []).filter((p) => p?.ref && !seen.has(p.ref) && seen.add(p.ref));
      const reader = allPassages.length && makeRelationReader ? makeRelationReader(allPassages, { pool: allPassages }) : null;
      const readAgainst = (sent) => (reader ? (reader.read(sent)?.claims ?? []) : []);
      const notes = hyperlexicon && sharedHyperlexiconLog && hyperlexicon.foldWithStanding ? hyperlexicon.foldWithStanding(sharedHyperlexiconLog) : [];
      const disputes = hyperlexicon?.disputesOf && sharedHyperlexiconLog ? hyperlexicon.disputesOf(sharedHyperlexiconLog) : null;
      const index = piece?.referentIndexFor && allPassages.length ? piece.referentIndexFor(allPassages) : null;
      const ctx = { notes, disputes, derived: hyperlexiconDerived ?? [], passages: allPassages, resolveName: index ? (n) => index.resolve(n) : null };
      // a claim knows its sentence by the sentence that carries its first end and its label (sentenceForClaim, shared with the flat path)
      const secInput = sections.map((s) => ({ label: s.part.label, text: s.text ?? "", claims: (s.relations?.claims ?? []).map((c) => ({ ...c, sentence: c.sentence ?? sentenceForClaim(s.text, c) })), witnessRows: s.witness?.rows ?? [], _s: s }));
      const rv = piece && sections.length > 1
        ? await revisePiece(secInput, { groundOf, readAgainst, call, splitSentences, ctx, model: piece.model ?? null, systemPrompt: EXECUTE_SYSTEM_PROMPT, rounds: budgets.revisionRounds, asks: budgets.revisionAsks })
        : await reviseLedgerContested(secInput, { groundOf, readAgainst, call, splitSentences, ctx, model: null, systemPrompt: EXECUTE_SYSTEM_PROMPT, asks: budgets.revisionAsks });
      // THE REVISION IS A LATER CELL (P137). It runs after every part's own
      // gate and could put back what a part's finding forbade — the same
      // shape P133 had at EVA, one level up. Bound here by everything the
      // parts established, since findings now leave runPart. Scoped to the
      // PIECE branch specifically (real regression, found by this file's
      // own P126 test running against the widened gate below): a flat
      // turn's own findings/guard mechanism already ships its draft
      // unedited per P186 (holon.test.mjs's own "neither detection cuts it
      // from what ships anymore"), and this admissible() re-scan — built
      // for revisePiece's OWN risk of putting back what a part's finding
      // forbade — has never been exercised on a flat turn and, run there,
      // silently stripped a sentence P186 says must ship. reviseLedgerContested
      // never "puts back" anything forbidden; it only ever moves a sentence
      // TOWARD what the ledger establishes, gated by groundOf itself.
      if (piece && sections.length > 1 && allFindings.length) {
        for (const sec of rv.sections ?? []) {
          const gated = admissible(sec.text ?? "", allFindings, { splitSentences, from: "REC" });
          if (gated.refused.length) { sec.text = gated.text || sec.text; sec.inadmissible = gated.refused; }
        }
      }
      revisions = rv.revisions;
      sections = rv.sections.map((e) => ({ ...e._s, text: e.text, ...(e.recited ? { recited: e.recited } : {}) }));
    } catch (e) { revisions = [{ kind: "revision-error", because: String(e?.message ?? e) }]; }
  }

  const output = sections
    .map((s) => {
      // An empty part is a typed gap (recorded above); the assembly says so
      // in place rather than shipping a dangling heading or an empty string.
      const text = s.text || "(this part produced no text — left open)";
      // THE HEADING IS BOUND TOO (P137). It was never passed through the
      // gate, so a piece could gut every sentence of a section for naming
      // something the sources contradict and then ship that very name as the
      // section's ## heading. No model misbehaviour is needed; it is
      // deterministic, because the labels come from the plan, which is written
      // from the ask that carried the false claim.
      const bound = allFindings.filter((f) => (f.forbids ?? []).length);
      const label = bound.some((f) => (f.forbids ?? []).some((v) => String(s.part.label).toLowerCase().includes(String(v).toLowerCase())))
        ? (s.part.description && !bound.some((f) => (f.forbids ?? []).some((v) => String(s.part.description).toLowerCase().includes(String(v).toLowerCase()))) ? s.part.description : "This section")
        : s.part.label;
      return plan.parts.length > 1 ? `## ${label}\n\n${text}` : text;
    })
    .join("\n\n");

  const refs = [...new Set(sections.flatMap((s) => s.refs))];
  const unsupported = [...new Set(sections.flatMap((s) => s.unsupported))];
  // Unbacked knowledge, unioned the same way: not a correction driver, but
  // the record still names it — disclosure is that list's whole treatment.
  const unbacked = [...new Set(sections.flatMap((s) => s.unbacked ?? []))];
  const open = [
    ...(plan.degraded ? ["plan did not parse; task ran as a single part"] : []),
    ...sections.flatMap((s) => s.open),
    // The guard tripping is not closure and must not read like it (the three
    // halt facts stay distinct all the way to the record).
    ...(production.halted_by === "max-steps-guard" ? ["production halted by max-steps guard"] : []),
  ];
  const channels = [...new Set(sections.flatMap((s) => s.channels))];

  return {
    ...(piece ? { edits, pieceLog: { drafted: draftedText, edited: editedText } } : {}),
    // Disclosed regardless of piece (P54/P186's disclosure-never-silent
    // discipline): a flat or decomposed turn's own Gap 2 revisions are as
    // real as a piece's, and were silently dropped here before this widening
    // — only a piece's own edits/pieceLog stay piece-specific. Unconditional,
    // never gated on revisions.length: `revisions` is always a real array
    // (initialized above, whether or not the block ran), and a caller
    // (holon.test.mjs's own P116) asserts Array.isArray(r.revisions) — a
    // conditional spread on an empty-but-valid array silently drops the key.
    revisions,
    depth: sections.find((x) => x.strain)?.strain?.recruited ?? budgets.level, budgets, depthLine: depthLine(budgets, { piece: Boolean(piece) }),
    // What this whole turn learned (P126), deduped by content identity across
    // its parts — the caller appends these to its durable store, and the room
    // makes them permanent (matrix.js seals them into the same hash-linked
    // chain the chat rides).
    learned: (() => { const seen = new Set(); const out = []; for (const sec of sections) for (const e of sec.learned ?? []) { if (seen.has(e.id)) continue; seen.add(e.id); out.push(e); } return out; })(),
    // The correction and the premise check, summed across the turn's parts —
    // a flat turn has one, a decomposed turn several, and the caller reads
    // one shape either way. Absent (no material, nothing checked) exactly as
    // before this existed.
    ...(sections.some((x) => x.correction) ? { correction: (() => {
      const cs = sections.map((x) => x.correction).filter(Boolean);
      const sum = (f) => cs.reduce((a, c) => a + (f(c) ?? 0), 0);
      return { parts: cs.length, snips: sum((c) => c.snips), atoms: sum((c) => c.atoms), supported: sum((c) => c.supported), flagged: sum((c) => c.flagged), asked: sum((c) => c.asked), after: { flagged: sum((c) => c.after?.flagged), supported: sum((c) => c.after?.supported), atoms: sum((c) => c.after?.atoms) }, outcomes: cs.flatMap((c) => c.outcomes ?? []), flags: cs.flatMap((c) => c.flags ?? []) };
    })() } : {}),
    ...(sections.some((x) => x.premises) ? { premises: (() => {
      const ps = sections.map((x) => x.premises).filter(Boolean);
      const sum = (f) => ps.reduce((a, c) => a + (f(c) ?? 0), 0);
      return { checked: sum((c) => c.checked), unverified: sum((c) => c.unverified), contradicted: sum((c) => c.contradicted), rows: ps.flatMap((c) => c.rows ?? []) };
    })() } : {}),
    ...(sections.some((x) => x.learnedUsed?.length) ? { learnedUsed: [...new Set(sections.flatMap((x) => x.learnedUsed ?? []))] } : {}),
    ...(sections.some((x) => x.repeatedKnownFalse?.length) ? { repeatedKnownFalse: sections.flatMap((x) => x.repeatedKnownFalse ?? []) } : {}),
    ...(sections.some((x) => x.recalledTurns?.length) ? { recalledTurns: [...new Set(sections.flatMap((x) => x.recalledTurns ?? []))] } : {}),
    // dialogue.js (2026-09-07): the conversation's loops, aggregated over the parts
    ...(sections.some((x) => x.voidsDeclared) ? { voidsDeclared: sections.flatMap((x) => x.voidsDeclared ?? []) } : {}),
    ...(sections.some((x) => x.owned) ? { owned: sections.flatMap((x) => x.owned ?? []) } : {}),
    ...(sections.some((x) => x.retrieval) ? { retrieval: sections.filter((x) => x.retrieval).map((x) => ({ part: x.part?.label ?? null, ...x.retrieval })) } : {}),
    ...(sections.some((x) => x.resolutions) ? { resolutions: sections.filter((x) => x.resolutions).map((x) => ({ part: x.part?.label ?? null, ...x.resolutions })) } : {}),
    ...(sections.some((x) => x.addressed) ? { addressed: sections.filter((x) => x.addressed).map((x) => ({ part: x.part?.label ?? null, ...x.addressed })) } : {}),
    ...(sections.some((x) => x.expectation) ? { expectation: (() => { const xs = sections.filter((x) => x.expectation).map((x) => x.expectation); const auth = xs.map((e) => e.authorship).filter((a) => a != null); return { expected: xs.reduce((a, e) => a + e.expected, 0), matched: xs.reduce((a, e) => a + e.matched.length, 0), novel: xs.reduce((a, e) => a + e.novel.length, 0), missing: xs.reduce((a, e) => a + e.missing.length, 0), contradicted: xs.reduce((a, e) => a + e.contradicted.length, 0), authorship: auth.length ? Number((auth.reduce((a, b) => a + b, 0) / auth.length).toFixed(3)) : null }; })() } : {}),
    ...(sections.some((x) => x.selfContradictions?.length) ? { selfContradictions: sections.flatMap((x) => x.selfContradictions ?? []) } : {}),
    ...(sections.some((x) => x.position) ? { position: sections.find((x) => x.position).position } : {}),
    ...(sections.find((x) => x.comparison) ? { comparison: sections.find((x) => x.comparison).comparison } : {}),
    ...(sections.some((x) => x.strain) ? { strain: sections.map((x) => x.strain).filter(Boolean) } : {}),
    ...(sections.find((x) => x.misquote) ? { misquote: sections.find((x) => x.misquote).misquote } : {}),
    ...(sections.some((x) => x.inadmissible?.length) ? { inadmissible: sections.flatMap((x) => x.inadmissible ?? []) } : {}),
    ...(sections.some((x) => x.substituted) ? { substituted: sections.flatMap((x) => (x.substituted ? [x.substituted] : [])) } : {}),
    ...(!piece && sections.some((x) => x.metaCut?.length) ? { metaCut: sections.flatMap((x) => x.metaCut ?? []) } : {}),
    task, plan, log, production, sections, output, refs, unsupported, unbacked, open, channels, gridLog: sharedGridLog, hyperlexiconLog: sharedHyperlexiconLog, hyperlexiconTurnedAway: sharedHyperlexiconTurnedAway };
}
