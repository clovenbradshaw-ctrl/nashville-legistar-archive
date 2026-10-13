// fold-chat-flow.js — Terry Gross: the archon of conversations, keeper of the flow rules. Pure: no DOM, no IO, no model.
//
// Terry Gross (the khora's the-fold/earned-cast.js, vendored by closure) reads a conversation's FLOW: what speech act the turn
// is — a question, an assertion, a push-back, a frame-ask, a map-ask — and what the reply should hear about it. Her facts are
// OBJECT-LEVEL and COVERT: never her name, never a role line, never an apparatus noun reaches the mouth (`bannedHits`), and
// the mouth is never told a persona is speaking.
//
// This chat already follows the thread (fold-chat-thread.js `turnPlan`: "what?", "shorter", "i want a chewier one"). Terry adds
// what that module does not read, and builds on it rather than beside it:
//
//   planTurn      turnPlan, plus the moves Terry reads that are about the CONVERSATION and not about the web: a short
//                 push-back ("are you sure?", "prove it", "wait, what"), a short frame-ask ("so what does it all mean") or
//                 map-ask ("how do these fit together"). With an earlier answer to follow they are replies about THAT answer
//                 (no search, the model grounded in the thread); with nothing earlier they are the cold gap — no search,
//                 no model, an app-authored note. Anything that names a topic of its own stays a standalone ask: "actually,
//                 what is the tallest mountain" is searched as asked. (The person's words are never rewritten.)
//   cuesFor       the facts the reply hears: Terry's own, for the act of this turn and the felt shape of the recent answers
//                 (fold-chat-pathos.js), each read by Gary's rules and stripped of any prohibition clause (Gary: a fact the
//                 model reasons from, never an instruction about what not to say), then by the covert ban.
//   FLOW_ENFORCEMENT  Terry's flow rules, each with the code of THIS app that enforces it — or null, so an unwired rule stays
//                 visible (Constitution VI.3: unwired-is-failing only works if unwired is VISIBLE).
//
// DECLARED, NOT MEASURED (II.11): the move limits below. Giver: the same short-ask limit fold-chat-thread.js declares from the
// ethos study (a long ask names enough on its own), and the author's reading that a push-back or a frame-ask carries at most
// its own two content words. fold-chat-flow.test.mjs pins the false-positive side (a standalone ask is never turned into a
// move) on the eval's own asks. Terry's detectors are English: a language she does not recognise is simply never treated as a
// move (a typed gap, not a guess) — never a wrong move, and never case logic (nothing here reads capitals or a script).

import { classifySpeech, cueBundle, bannedHits, CONVERSATION_FLOW_RULES, SPEECH_ACT } from "./vendor/khora/native/the-fold/earned-cast.js";
import { turnPlan, topicOf, THREAD } from "./fold-chat-thread.js";
import { casedRuns, scriptOf } from "./fold-chat-mind.js";
import { isSourceAsk } from "./fold-chat-sourceask.js";
import { anaphoraOf } from "./fold-chat-anaphora.js";

export { SPEECH_ACT };

// The cues ride only while this is true. eval/gary-flow/PREREG.md B6 is the rule that sets it: the cues ship ON only if the measured
// reply is no worse with them than without. The planner (moves against the thread) and the door are not behind this switch.
export const FLOW_CUES = true;

export const FLOW = Object.freeze({
  moveMaxWords: 6,       // a push-back / frame-ask / map-ask is a short ask
  moveMaxContent: 2,     // …that carries at most its own two content words (the cue's), so it names no topic of its own
});
// the acts that are about the conversation itself (a question and an assertion are about the world or the person)
const MOVE_ACTS = Object.freeze(["escalation", "frame-ask", "map-ask"]);

const wordCount = (q) => (String(q ?? "").match(/[\p{L}\p{N}'’]+/gu) || []).length;

/** Terry's reading of the turn's own speech act: one of SPEECH_ACT, or null for nothing to read. */
export function actOf(question) {
  const t = String(question ?? "").trim();
  return t ? classifySpeech(t) : null;
}

/** Is this ask a move about the conversation (a push-back, a frame-ask, a map-ask) that names nothing of its own? */
export function isMove(question, act = actOf(question)) {
  const q = String(question ?? "").trim();
  if (!q || !MOVE_ACTS.includes(act)) return false;
  if (wordCount(q) > FLOW.moveMaxWords) return false;
  if (/\d/u.test(q)) return false;                                  // a figure is its own topic
  if (casedRuns(q, scriptOf(q)).length) return false;               // it names its own entity: it stands alone
  return topicOf(q).split(" ").filter(Boolean).length <= FLOW.moveMaxContent;
}

/** turnPlan (fold-chat-thread.js), plus Terry's moves. Same shape; `act` is always set; `kind` "move" marks a move. */
export function planTurn(question, priorMessages, opts = {}) {
  const plan = turnPlan(question, priorMessages, opts);
  const act = actOf(question);
  // a meta ask is already a reply about the previous answer. Everything else that would be SEARCHED (a standalone, an elliptical or a
  // carried-pronoun ask) is first asked: is it a move about the conversation? "prove it" carries a pronoun, and the pronoun trigger would
  // have searched the last answer's referent with "prove it" tacked on (measured, eval/gary-flow); the push-back is the stronger reading.
  // A move reuses the PREVIOUS turn (mode "thread": its answer, and its passages as [W#] sources), so it must LEAN on that turn. Measured 2026-10-07 (G3,
  // eval/ants/g3/probe-move.mjs): "so what is dna", "wait what is entropy" and "are you sure about gravity" have a subject of their own, passed isMove's
  // <=2-content-word limit, and answered from the last turn's text and sources. The anaphora gate (fold-chat-anaphora.js), read with the speech act as
  // evidence for a bare demonstrative, must also say the ask points back; otherwise it is a standalone ask and is searched as asked.
  const moveLeans = () => { try { return anaphoraOf(question, { lang: opts.lang || null, hints: opts.hints || null, demonstrativeAsPronoun: true }).carry; } catch { return true; } };
  if (plan.mode === "web" && isMove(question, act) && moveLeans()) {
    return plan.thread?.has
      ? { ...plan, act, kind: "move", mode: "thread", search: null, modelMay: true, reason: "move-with-thread" }
      : { ...plan, act, kind: "move", mode: "cold-gap", search: null, modelMay: false, reason: "move-cold" };
  }
  // "find a primary source" / "where did you get that?" names no topic of its own: it is about the LAST ANSWER's topic. Planned standalone it
  // searched its own words (measured 2026-10-06: teacher guides to primary sources came back as the answer). With an earlier answer it is
  // searched as the ask that answer was answering; with nothing earlier it is the cold gap. (fold-chat-sourceask.js)
  if (plan.mode === "web" && plan.kind !== "retry" && isSourceAsk(question)) {
    const th = plan.thread;
    if (!th?.has) return { ...plan, act, kind: "source-ask", mode: "cold-gap", search: null, modelMay: false, reason: "source-ask-cold" };
    const q = th.topicAsk || th.ask;   // the nearest ask that stood on its own (a source-ask before this one is not a topic)
    return q ? { ...plan, act, kind: "source-ask", mode: "web", search: q, query: q, modelMay: false, reason: "source-ask-of-last-answer" }
             : { ...plan, act, kind: "source-ask", mode: "cold-gap", search: null, modelMay: false, reason: "source-ask-cold" };
  }
  return { ...plan, act };
}

// ── the facts a reply hears ────────────────────────────────────────────────────────────────────────────────────────────

/** Cut a prohibition clause out of a fact: "…tightens — hold the claim to its ground, do not smooth it away." keeps the
 *  fact and drops the ban, using the clauses Gary's own rule found (so the cut is his reading, not a second regex). */
export function withoutProhibitions(text, clauses) {
  let out = String(text ?? "");
  for (const clause of clauses || []) {
    const at = out.indexOf(String(clause).replace(/…$/u, ""));   // Gary clips a long clause with an ellipsis; the head still locates it
    if (at < 0) continue;
    // the clause runs to the end of its sentence; back up over the separator that joined it
    const head = out.slice(0, at).replace(/\s*[,;—–-]\s*$/u, "").replace(/\s+$/u, "");
    const rest = out.slice(at);
    const end = rest.search(/[.!?](\s|$)/u);
    const tail = end >= 0 ? rest.slice(end + 1) : "";
    out = (head + (/[.!?]$/u.test(head) ? "" : ".") + tail).replace(/\s+/g, " ").trim();
  }
  return out;
}

/**
 * The cues for this turn's reply: [{ from, text }] and what was left out.
 *   act     Terry's read of the turn (actOf)
 *   felt    { flatline, strain } from fold-chat-pathos.js (or null)
 *   pathosCue  the pathos organ's own sentence for a condition Terry does not already speak (or null)
 *   door    Gary's door (fold-chat-gary.js) — each fact is read by his rules before it can ride
 * Only Terry's facts ride (the directors' — Eastwood, Kubrick — are not wired here); each is vetted, never trusted.
 */
export function cuesFor({ act, felt = null, pathosCue = null, door = null } = {}) {
  const cues = [], dropped = [];
  if (!FLOW_CUES || !act || !SPEECH_ACT.includes(act)) return { cues, dropped, act: act || null };
  const bundle = cueBundle({ act, state: { felt: felt || undefined }, depth: 1 });
  const facts = bundle.facts.filter((f) => f.from === "terry-gross");
  if (pathosCue) facts.push({ from: "pathos", text: pathosCue });
  for (const f of facts) {
    let text = String(f.text || "").trim();
    if (door) {
      const read = door.hand([{ role: "system", content: text }], { kind: "cue", record: false });
      const ban = read.findings.find((x) => x.rule === "information-not-prohibition");
      if (ban) text = withoutProhibitions(text, ban.clauses);
      const reread = text ? door.hand([{ role: "system", content: text }], { kind: "cue", record: false }) : null;
      const bad = reread?.findings.find((x) => x.rule === "no-apparatus" || x.rule === "no-json-ask" || x.rule === "information-not-prohibition");
      if (bad || !text) { dropped.push({ from: f.from, why: bad?.rule || "empty" }); continue; }
    }
    const hits = bannedHits(text);
    if (hits.length) { dropped.push({ from: f.from, why: hits.join(",") }); continue; }
    cues.push({ from: f.from, text });
  }
  return { cues, dropped, act };
}

// ── Terry's flow rules, and where this app enforces each ─────────────────────────────────────────────────────────────────
// `enforced`: the file and function of THIS app that holds the rule; `null`: unwired, kept visible on purpose.
export const FLOW_ENFORCEMENT = Object.freeze([
  { rule: "the oracle is not a teacher", enforced: { file: "fold-chat-gaps.js", holds: "modelSpeaksAlone" }, note: "the model never speaks alone; nothing is answered from memory" },
  { rule: "hyper-grounded by default, on every surface", enforced: { file: "fold-chat-ground.js", holds: "coverage" }, note: "every answer is attributed to what it shares with a source, and its figures and names are checked" },
  { rule: "a gap is a result", enforced: { file: "fold-chat-gaps.js", holds: "unsourcedPlan" }, note: "unreached, unsupported, live and cold-follow-up gaps are drawn by the app, never said by the model" },
  { rule: "every answer is a void defined and satisfied", enforced: null, note: "no answer-shape void is DEF'd before the model writes (the khora's voidCellsFor is not wired here)" },
  { rule: "the journey, covert", enforced: { file: "fold-chat-flow.js", holds: "cuesFor" }, note: "no persona name, apparatus noun or covert term reaches the mouth (bannedHits at the seam)" },
  { rule: "theory of mind, held across sessions", enforced: { file: "fold-chat-memory.js", holds: "ungroundedIdentity" }, note: "partial: the person's name and stated facts only; claims are not carried across sessions" },
  { rule: "the refusal is warm", enforced: { file: "fold-chat-thread.js", holds: "coldFollowUpNotice" }, note: "partial: the withholding is app-authored and says what to do next" },
  { rule: "long-form is a mode, not the identity", enforced: null, note: "no explicit long-form mode in the chat" },
]);

/** Terry's rules as the khora states them (so a test can see that the table above covers every one, and no more). */
export const flowRules = () => CONVERSATION_FLOW_RULES.map((r) => r.rule);

export { THREAD };
