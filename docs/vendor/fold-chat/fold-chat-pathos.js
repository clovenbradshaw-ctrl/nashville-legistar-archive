// fold-chat-pathos.js — the pathos archons, for a conversation. Pure: no DOM, no IO, no model.
//
// The pathos organs (the khora's organs/pathos.js — Abhinavagupta, composing Murch's pacing, Panini's experiencer and the
// dynamics kernel; and the-fold/pathos-turn.js, the live turn's composition of it) read the FELT SHAPE of what was undergone
// and enforce one law: PATHOS WITHOUT A DECLARED EXPERIENCER IS REFUSED — a feeling "for no one in particular" is kitsch.
//
// WHO IS EXPERIENCING WHAT, in a chat — and why the experiencer is never taken from a label. A red-team of this very seam
// (eo-teachings/attack-pathos-experiencer-misattribution.mjs) found that pathos echoed whatever `holder` string the caller
// typed and never read the claim: the same text got two different "who"s from two labels, and one fabricated label both
// laundered the claim and became the permanent record of who it was about. The fix there (ethos-pipeline.mjs FIX 4): carry
// the VERIFIED speaker, and disclose when it could not be verified. Here that is PROVENANCE:
//
//   • what the model wrote (an assistant turn, not Sources-only, not an agent turn) is undergone by the instrument speaking
//     it: `who` = the model that wrote it, read from the turn's own record — never from a field on the message;
//   • what the sources said (a Sources-only turn is their verbatim words) belongs to the sources' authors, not to the fold's
//     voice — it is never read as the fold's rhythm, and the fold's flatness is never measured on someone else's prose;
//   • what the person said is the person's — never read as the fold's, and never reduced to a feeling the fold assigns them
//     (the felt shape is read over the fold's own answers; nothing here infers what the person feels);
//   • a turn whose author cannot be verified is not read at all (a typed gap).
//
// What it feeds: `felt` ({ flatline, strain }) to Terry Gross (fold-chat-flow.js), and — for a condition Terry does not
// already speak — the pathos organ's own cue sentence. Information about the conversation's recent voice, never a
// directive. The re-ground is a RECORDED act (REC·Ground) on an append-only ledger kept on the session.
//
// DECLARED GAPS, said not guessed: the curve (surprise/tension/release) is unmeasured on this pipeline (no reader fold is run
// over the exchange), so `collapse` cannot fire; `strain` is "report" because the chat holds no contradiction record
// (`contested` needs janus' /v1/reason door, which the chat does not call) — so `stale` is the one live register.
// Pacing counts sentences at ./!/? and words at whitespace: text in a script that does not use them is ONE sentence, and one
// sentence is never read as flat (the organ withholds, never convicts), so a caseless or unspaced answer is never flagged.

import { pathosOf, reGroundCondition, reGround, landReGround } from "./vendor/khora/native/organs/pathos.js";
import { pathosTurn } from "./vendor/khora/native/the-fold/pathos-turn.js";

// DECLARED (II.11), with their giver: arcs.js — the rolling window is 8 answers (measured on the 100-turn battery's threads,
// shortened to what is recent), and an arc needs at least 3 answers to grade.
export const PATHOS = Object.freeze({ window: 8, minAnswers: 3 });

const text = (m) => String(m?.content ?? "").trim();

/**
 * Who wrote this turn, by what the TURN ITSELF records. Never by a label the message carries (`who`, `experiencer`, `holder`
 * are ignored). → { by: "model", model } | { by: "sources" } | { by: "person" } | { by: "agent" } | { by: "none" }
 */
export function authorOf(m) {
  if (!m || typeof m !== "object") return { by: "none" };
  if (m.role === "user") return text(m) ? { by: "person" } : { by: "none" };
  if (m.role !== "assistant" || !text(m)) return { by: "none" };
  if (m.authored === "sources") return { by: "sources" };
  if (m.mode === "agent") return { by: "agent" };
  const model = m.grounding?.model || m.model || null;
  return model ? { by: "model", model: String(model) } : { by: "model", model: null };
}

/**
 * The fold's own recent answers (the ones a pathos read may be about), with the experiencer they were undergone by.
 * → { answers:[string], experiencer:{who,read}|null, gap:string|null, excluded:{sources,agent,person,unverified} }
 */
export function undergone(messages, { convo = "chat" } = {}) {
  const excluded = { sources: 0, agent: 0, person: 0, unverified: 0 };
  const answers = [], models = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    const a = authorOf(m);
    if (a.by === "model") { if (a.model) { answers.push(text(m)); if (!models.includes(a.model)) models.push(a.model); } else excluded.unverified++; }
    else if (a.by in excluded) excluded[a.by]++;
  }
  const recent = answers.slice(-PATHOS.window);
  if (!recent.length) return { answers: [], experiencer: null, gap: "no_model_authored_answers", excluded };
  return { answers: recent, experiencer: { who: `model:${models.join("+")}`, read: `conversation:${convo}` }, gap: null, excluded };
}

/**
 * One pathos pass over the conversation so far. `memo` is the session's own ledger ({ log, lastKind, held }); the returned
 * `memo` replaces it. Never throws: a refused or unreadable read is a typed `gap`, and the turn goes on without a cue.
 * → { felt:{flatline,strain}|null, cue:string|null, condition:string|null, act:object|null, memo, gap:string|null, disclosure }
 */
export function readFelt(messages, { convo = "chat", memo = null } = {}) {
  const prior = { log: Array.isArray(memo?.log) ? memo.log : [], lastKind: memo?.lastKind ?? null, held: memo?.held ?? true };
  const u = undergone(messages, { convo });
  const none = (gap) => ({ felt: null, cue: null, condition: null, act: null, memo: prior, gap, excluded: u.excluded, disclosure: null });
  if (u.gap) return none(u.gap);
  if (u.answers.length < PATHOS.minAnswers) return none("too_few_answers");
  let out;
  try {
    out = pathosTurn({
      organs: { pathosOf, reGroundCondition, reGround, landReGround },
      text: u.answers.join("\n\n"),
      experiencer: u.experiencer,
      state: {},                                    // no contradiction record in the chat: strain stays "report" (a declared gap)
      ledger: prior.log, lastKind: prior.lastKind, heldSinceLast: prior.held,
      turn: u.answers.length,
    });
  } catch (err) { return none("pathos_refused:" + String(err?.message || err).slice(0, 80)); }
  const stale = out.condition.kind === "stale";
  return {
    felt: { flatline: !!out.read.rhythm.flatline, strain: out.read.strain },
    // Terry already speaks a flat exchange in her own words; the organ's sentence rides only for a register she does not.
    cue: stale ? null : out.cue,
    condition: out.condition.kind,
    act: out.act,
    memo: { log: [...out.ledger], lastKind: out.lastKind, held: out.heldSinceLast },
    gap: null,
    excluded: u.excluded,
    experiencer: u.experiencer,
    disclosure: out.disclosure,
  };
}
