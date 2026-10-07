// bridge-witness.js — Pass 12 step 4: a witness reads whether a referent
// bridge is real, armed against a decoy, never trusted unarmed.
//
// THE GAP THIS CLOSES. bridges.js (S49) derives a bridge's standing from
// MECHANICAL ACCUMULATION alone: a `same-referent-as` arrangement reaches
// `corroborated` only when a SECOND, independently-derived content note
// happens to assume the identical correspondence. That is real evidence,
// but it is silent whenever a bridge has exactly one crossing behind it —
// `single-witness`, forever, however plausible the correspondence — and
// bridges.js's own header names this as read-only by design: it derives
// and reports, it never asks anyone to look. This organ is the asking.
//
// THE QUESTION IS DIFFERENT FROM EVERY OTHER WITNESS IN THIS CODEBASE, so
// it is not answered by reusing one. `corroboration.js::witnessNote` (and
// `ranke.js`'s own call on it) asks "does this source state this
// PROPOSITION" — a claim against a body of text. A bridge asks "do these
// two MENTIONS, each already read in its own document, name the SAME
// REFERENT" — a correspondence between two already-known spans, never a
// search through a body. `testimony.js::buildSelectMessages`'s own prompt
// is worded for the first question ("Claim: ... / Sentences: ...") and
// would be asking the model to judge the wrong thing if reused verbatim
// here — so this file writes its OWN prompt, on the SAME schema shape
// (`{stated, sentence}`, a 1-based index or 0, "point, never write") and
// reuses `testimony.js::foldSelect` UNCHANGED, since that half is already
// generic: parse the index, validate its range, return the candidate
// verbatim as the decider. One response-parser, two questions.
//
// THE ARM, mirroring witnessNote's own real+swap shape exactly rather than
// folding both into one multi-candidate call (P85's own postmortem on
// ranke-slicers.mjs: every arm in this codebase runs TWICE, real then
// decoy, and a single call risks position bias contaminating both readings
// at once). The REAL call offers the incoming passage alone; the ARM call
// offers a DECOY passage — a sibling bridge candidate that shares the same
// incoming SOURCE but corresponds to a DIFFERENT prior face, so the decoy
// is a genuine competing referent from the same document, not a strawman.
// A "same" verdict on the decoy call means the picker is indiscriminate
// and the real verdict is refused, whatever it was. No decoy available =
// unarmed, and an unarmed "same" is refused, not trusted — the identical
// rule witnessNote already holds ("an unchallenged yes is not a second
// witness").
//
// DIAGNOSTIC AND ACT, KEPT APART (bridges.js's own precedent, and
// `dietBoundaries`/`concedeDiet`'s before it): `witnessBridge` only ever
// DECIDES a verdict; it touches no ledger. `applyBridgeWitness` is the one
// function that writes — landing a `same` verdict as an ADDITIONAL witness
// on the bridge note (never re-typing the arrangement, never touching the
// content ledger bridges.js's own header already refuses to touch) and,
// on a `different` verdict, returning a NAMED SUGGESTION (a ready trigger
// string for `notes.concede`) rather than conceding itself — a witness
// call is diagnostic; conceding a corroborated bridge is a decision this
// file leaves to whichever caller holds that authority, exactly the
// posture `concedeDiet` already keeps toward `dietBoundaries`.
//
// THE WITNESS KIND. `bridge-witness:<contentNoteId>#<which>~<recipe>` —
// the SAME content-note-id-as-source convention `deriveBridgeArrangements`
// already uses for `bridge-inferred:`, so a repeat witness call on the
// same bridge instance does not spuriously inflate the bridge's own
// `sources` count (kernel `standingOf` reads a witness's SOURCE, not its
// kind), while `kinds` on that same call still shows `bridge-witness`
// apart from `bridge-inferred` — a reader can tell "two crossings assumed
// this" from "a model was asked and confirmed it directly", the same
// disclosure `standingOf`'s own header asks every kind split to give.
//
// THIS MODULE OWNS NO MODEL CALL OF ITS OWN. `selectAsk` is injected (the
// cast.js posture, witnessNote's own posture) — a caller wires it to a
// real model or, in every test here, to a scripted response so the arm
// and control logic is fully covered without a live model ever running.
//
// Generality: universal in shape (any medium whose bridges carry an
// addressed context on both sides); the prompt below is a text adapter,
// same as every other prompt-builder in this project.

import { noteId, sourceOfWitness } from "../kernel/notes.js";
import { foldSelect } from "./testimony.js";
import { BRIDGE_LABEL, priorSideKey } from "./bridges.js";

export const BRIDGE_WITNESS_KIND = "bridge-witness";

/** Why a bridge candidate was not put to a witness at all — before any call is spent. */
export const BRIDGE_WITNESS_REFUSALS = Object.freeze({
  /** The join carries no incoming face — bridges.js's own NO_INCOMING_FACE, checked again here because a caller may hand this organ a join directly. */
  NO_INCOMING_FACE: "no_incoming_face",
  /** Neither side has any addressed context to show the witness — a span with no `.text`. */
  NO_CONTEXT: "no_context",
});

/**
 * contextOf(note, join) — the two passages a bridge witness reads, pulled
 * from what is already on the ledger: the ESTABLISHED side's own context
 * (the first of `note.spans` whose source is one the join's `from` names —
 * P5.2's own address, carried opaque, so `.text` rides through whatever the
 * caller attached when it heard the note), and the INCOMING side's own
 * context (`join.incomingSpans[0]`, S48's own widening). Either side
 * missing a `.text` returns the gap by name rather than an empty string a
 * prompt could silently swallow.
 */
export function contextOf(note, join) {
  if (!join?.incomingEnds) return { gap: BRIDGE_WITNESS_REFUSALS.NO_INCOMING_FACE };
  const from = new Set(join.from ?? []);
  const establishedSpan = (note?.spans ?? []).find((s) => from.has(sourceOfWitness(String(s?.ref ?? ""))));
  const incomingSpan = (join.incomingSpans ?? [])[0] ?? null;
  const establishedText = establishedSpan?.text ?? null;
  const incomingText = incomingSpan?.text ?? null;
  if (!establishedText || !incomingText) return { gap: BRIDGE_WITNESS_REFUSALS.NO_CONTEXT, establishedText, incomingText };
  return { establishedSpan, establishedText, incomingSpan, incomingText };
}

/**
 * The one message shape a bridge witness reads — buildSelectMessages'
 * shape (a claim-like anchor, a numbered candidate list, point at one),
 * worded for correspondence instead of stated-truth. `candidates` is
 * `[realPassage]` for the real call, `[decoyPassage]` for the arm call —
 * kept a list (rather than a bare yes/no) so `foldSelect` needs no change
 * and a future multi-decoy call costs nothing here.
 */
export function buildBridgeSelectMessages(establishedFace, establishedContext, incomingFace, candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${String(c).replace(/\s+/g, " ").trim()}`).join("\n");
  return [
    {
      role: "system",
      content:
        `You are given a passage that mentions "${establishedFace}", and a numbered list of other passages, ` +
        `each mentioning "${incomingFace}". Decide whether ANY of the numbered passages is talking about the exact ` +
        `SAME real-world person, place, or thing as the first passage — not merely a similar one. If yes, give the ` +
        `NUMBER of that passage. If none of them is, or you cannot tell, answer stated:no and sentence:0. Do not ` +
        `guess when unsure.`,
    },
    { role: "user", content: `Passage: "${String(establishedContext ?? "")}"\n\nCandidates:\n${list}` },
  ];
}

/**
 * witnessBridge({ establishedFace, establishedContext, incomingFace, realContext, decoyContext }, { selectAsk })
 * — the real call, then, only if a decoy was supplied, the arm. Returns
 * `{ verdict: "same" }`, `{ verdict: "different" }` (a real, honest "no" —
 * armed when a decoy was offered, unarmed-but-still-a-no otherwise, since
 * withholding trust in a "same" is not the same as disbelieving a "no"),
 * or `{ refused: <type> }` — `unarmed` (a "same" with no decoy to test it
 * against, so it cannot be trusted), `indiscriminate` (the arm also said
 * "same"), or `no-context` (either passage is missing).
 */
export async function witnessBridge({ establishedFace, establishedContext, incomingFace, realContext, decoyContext = null } = {}, { selectAsk } = {}) {
  if (typeof selectAsk !== "function") throw new TypeError("witnessBridge: selectAsk is injected — required, never defaulted");
  if (!establishedContext || !realContext) return { refused: "no-context" };
  const realPick = foldSelect(await selectAsk(buildBridgeSelectMessages(establishedFace, establishedContext, incomingFace, [realContext])), [realContext]);
  if (decoyContext == null) {
    // Unarmed. A "different"/refused reading is still an honest reading —
    // withholding trust in a "same" is not the same as disbelieving a "no"
    // (the withhold-vs-convict rule, applied to this organ's own output).
    if (realPick.verdict === "states") return { refused: "unarmed" };
    return { verdict: "different" };
  }
  const armPick = foldSelect(await selectAsk(buildBridgeSelectMessages(establishedFace, establishedContext, incomingFace, [decoyContext])), [decoyContext]);
  const armSaysSame = armPick.verdict === "states";
  if (realPick.verdict === "states" && armSaysSame) return { refused: "indiscriminate" };
  if (realPick.verdict === "states") return { verdict: "same", because: realPick.because };
  // The real call refused. If the arm ALSO refused the decoy, the picker
  // discriminated correctly and the "different" verdict is trustworthy —
  // the same standing an armed "same" earns, read the other way. If the
  // arm affirmed the decoy alone, the picker can tell something apart, so
  // its "no" on the real pairing still stands (it is not confused, it
  // simply did not find a match here).
  return { verdict: "different" };
}

/**
 * applyBridgeWitness(bridgeLog, notes, bridgeId, verdict, { recipe, contentNoteId, which })
 * — the one function that writes. `same` lands an additional
 * `bridge-witness:` witness on the named bridge note via `notes.hear` (the
 * identical arrangement re-heard, so this is a SUPERSEDE, never a re-type).
 * `different` and every refusal leave the ledger untouched and return a
 * `suggestion` naming what a caller could do next — never done here.
 */
export function applyBridgeWitness(bridgeLog, notes, { end1, label, end2 }, verdict, { recipe, contentNoteId, which } = {}) {
  const id = noteId(end1, label, end2);
  if (verdict?.verdict === "same") {
    const witness = `${BRIDGE_WITNESS_KIND}:${contentNoteId}#${which}${recipe ? `~${recipe}` : ""}`;
    const next = notes.hear(bridgeLog, { end1, label, end2, spans: [], witness, because: verdict.because ?? null });
    return { log: next, applied: true, suggestion: null };
  }
  if (verdict?.verdict === "different") {
    return {
      log: bridgeLog, applied: false,
      suggestion: { concede: true, id, trigger: `bridge-witness: an armed reading found "${end1}" and "${end2}" refer to different things` },
    };
  }
  return { log: bridgeLog, applied: false, suggestion: null, refused: verdict?.refused ?? null };
}

/**
 * decoysFor(join, allJoins) — the default decoy pool: OTHER joins in the
 * same walk that share this join's incoming SOURCE but assumed a
 * DIFFERENT prior face — a real competing referent from the very document
 * being read, never an invented one. Returns the first candidate's
 * incoming context and face, or null when this source crossed nothing
 * else in this walk (a single-bridge run is honestly unarmable).
 *
 * DISCLOSED, NOT MEASURED HERE: a same-day probe of witnessNote's own arm
 * (competingFiller, scanning a candidate list's capitalized surfaces) found
 * that a small candidate pool routinely leaves nothing to swap against — 3
 * of 9 entailed items in that run refused `unarmed-select` for exactly that
 * reason, not because the model was wrong. This organ's decoy source is
 * structurally different (sibling JOINS the reading pipeline already
 * resolved, never a capitalization scan or a literal string replace into a
 * claim), so it is not exposed to that measurement's SPECIFIC failure
 * modes — but the general shape is shared: a walk over a small or sparse
 * bridge set will often have nothing to arm with, and `witnessBridgesFor`
 * reports that honestly as `unarmed`/no-suggestion rather than trusting an
 * unarmed "same". Whether THIS organ's own unarmed rate is small or large
 * in practice is unmeasured — no live model has run it yet (see the eval
 * driver).
 */
export function decoysFor(join, pool) {
  const priorKey = priorSideKey(join?.from);
  for (const { join: other } of pool ?? []) {
    if (other === join) continue;
    if (other.source !== join.source) continue;
    // same prior face, same incoming face = the identical correspondence
    // (another content note assuming the same bridge), not a competitor.
    if (priorSideKey(other.from) === priorKey && other.incomingEnds?.end1 === join.incomingEnds?.end1 && other.incomingEnds?.end2 === join.incomingEnds?.end2) continue;
    const text = (other.incomingSpans ?? [])[0]?.text ?? null;
    if (!text) continue;
    return { context: text, face: other.incomingEnds };
  }
  return null;
}

/**
 * witnessBridgesFor(bridgeLog, notes, contentNotes, { selectAsk, maxAsks, recipe })
 * — the walk, `ranke.js::chaseLedger`'s own shape: every join across the
 * given content notes whose bridge stands `single-witness` (a `same`
 * verdict cannot improve a note already `corroborated` by two independent
 * crossings, and there is nothing to ask about a bridge that was already
 * conceded or refused upstream), most-witnessed-first among content notes
 * so a call spent lands where it can matter soonest, decoys drawn from
 * SIBLING joins across the SAME walk. Budgeted (P9) — every ask is
 * declared, sequential, never a burst. Returns
 * `{ log, asked, applied, suggestions, refused }`.
 */
export async function witnessBridgesFor(bridgeLog, notes, contentNotes, { selectAsk, maxAsks, recipe = null } = {}) {
  if (!Number.isFinite(maxAsks)) throw new TypeError("witnessBridgesFor: maxAsks is declared by the caller (P9)");
  const pool = [];
  for (const note of contentNotes ?? []) {
    for (const j of note.joins ?? []) {
      if (!j?.incomingEnds) continue;
      pool.push({ note, join: j });
    }
  }
  let log = bridgeLog;
  let asked = 0;
  const applied = [];
  const suggestions = [];
  const refused = [];
  for (const { note, join } of pool) {
    if (asked >= maxAsks) break;
    const priorSide = priorSideKey(join.from);
    for (const [which, priorFace, incomingFace] of [["end1", note.end1, join.incomingEnds.end1], ["end2", note.end2, join.incomingEnds.end2]]) {
      if (asked >= maxAsks) break;
      const bridgeId = noteId(`${priorSide}:${priorFace}`, BRIDGE_LABEL, `${join.source}:${incomingFace}`);
      const existing = notes.fold(log).find((n) => n.id === bridgeId);
      if (existing && notes.standingOf(existing).standing !== "single-witness") continue; // already corroborated another way, or already witnessed
      const ctx = contextOf(note, join);
      if (ctx.gap) { refused.push({ bridgeId, which, noteId: note.id, refused: ctx.gap }); continue; }
      const decoy = decoysFor(join, pool);
      asked += 1;
      const verdict = await witnessBridge(
        { establishedFace: priorFace, establishedContext: ctx.establishedText, incomingFace, realContext: ctx.incomingText, decoyContext: decoy?.context ?? null },
        { selectAsk },
      );
      const r = applyBridgeWitness(log, notes, { end1: `${priorSide}:${priorFace}`, label: BRIDGE_LABEL, end2: `${join.source}:${incomingFace}` }, verdict, { recipe, contentNoteId: note.id, which });
      log = r.log;
      if (r.applied) applied.push({ bridgeId, which, noteId: note.id });
      else if (r.suggestion) suggestions.push({ bridgeId, which, noteId: note.id, ...r.suggestion });
      else refused.push({ bridgeId, which, noteId: note.id, refused: r.refused ?? verdict.refused ?? null });
    }
  }
  return { log, asked, applied, suggestions, refused };
}
