// fold-chat-minds.js — what the PERSON has told the fold about how it read them. Pure: no DOM, no IO, no model, no clock.
//
// The fold models the world (fold-chat-mind.js) and itself (fold-chat-self.js) but, until a person can say "not him", nothing models how
// it was READ. A correction is the cheapest signal there is. Ops are append-only on the session (`s.minds.ops`) and every reading of them
// is recomputed from that list, never from an earlier reading (the carry's rule, fold-chat-carry.js).
//
//   correctionOp(kind, surface, turn, by)   → a typed op: { kind: "carry-rejected" | "carry-replaced", surface, turn, by? }
//   addOp(minds, op)                        → a new minds record with the op appended (the input is never mutated)
//   rejectedSurfaces(minds)                 → the surfaces the person refused to have carried (fed to resolveQuestion)
//
// DECLARED, not measured (Constitution II.11): a refusal holds for the whole chat, not one turn. Giver: the author, 2026-10-06 — the
// person said "not him" about the thread, and a per-turn memory would carry him straight back in.
import { projectPerspectives, perspectiveOperation, mentalModel, STANCE, BASIS } from "./vendor/khora/native/kernel/perspective.js";

export const OP_KINDS = Object.freeze(["carry-rejected", "carry-replaced"]);

export const emptyMinds = () => ({ ops: [] });

export function correctionOp(kind, surface, turn, by = null) {
  if (!OP_KINDS.includes(kind)) throw new Error("fold-chat-minds: unknown op kind " + kind);
  const s = String(surface ?? "").trim();
  if (!s) throw new Error("fold-chat-minds: an op names the surface it is about");
  return { kind, surface: s, turn: Number.isFinite(turn) ? turn : null, ...(by ? { by: String(by).trim() } : {}) };
}

export function addOp(minds, op) {
  const ops = Array.isArray(minds?.ops) ? minds.ops : [];
  return { ...(minds || {}), ops: [...ops, op] };
}

export function rejectedSurfaces(minds) {
  const out = [];
  for (const o of Array.isArray(minds?.ops) ? minds.ops : []) if (o && OP_KINDS.includes(o.kind) && o.surface && !out.includes(o.surface)) out.push(o.surface);
  return out;
}

/** The app-authored note under a turn whose pronoun was read through the record: what it was read as, so the person can refuse it.
 *  null when nothing was carried. `carried` is the surfaces; the page draws one "not X" control per surface. */
export function carryNotice(follow, turn = null) {
  const carried = Array.isArray(follow?.carried) ? follow.carried.filter(Boolean) : [];
  if (follow?.kind !== "carried" || !carried.length) return null;
  return { kind: "carry", carried, turn, text: `Read your question as being about ${carried.join(" and ")}.` };
}

// ── the person's mind, projected (khora kernel/perspective.js — "who holds what", the mental model of an interlocutor) ──────────────
// Three holders: the PERSON (what they refused, what they stated about themselves), the FOLD (what it showed them), each source page (what
// it said — not extracted here, only that it was shown). Nothing is stored: the log is rebuilt from the messages and `s.minds.ops` every
// call, so it cannot drift (the carry's rule). Counted evidence only — no confidence number (P4: numbers are declared; gaps are results).
export const PERSON = "holder:person", FOLD = "holder:fold";

/** The perspective log of a session. Pure; the same session gives the same log. */
export function mindLog(session) {
  const entries = [];
  for (const o of session?.minds?.ops || []) {
    if (o?.kind === "carry-rejected" || o?.kind === "carry-replaced")
      entries.push(perspectiveOperation({ holder: PERSON, claim: `not-about:${o.surface}`, stance: STANCE.REFUSES, basis: BASIS.ASSERTED, witness: `turn:${o.turn ?? "?"}` }));
  }
  const seen = new Set();
  for (const m of session?.messages || []) {
    if (m?.role !== "assistant") continue;
    for (const r of m.grounding?.sources || []) {
      const a = r?.address; if (!a || seen.has(a)) continue; seen.add(a);
      entries.push(perspectiveOperation({ holder: FOLD, claim: `showed:${a}`, stance: STANCE.HOLDS, basis: BASIS.WITNESSED, witness: a }));
    }
  }
  return entries;
}

/** What the fold can say it knows of this person, as counted evidence. `measured:false` = nothing recorded, a typed gap, never a profile. */
export function personMind(session) {
  const entries = mindLog(session);
  if (!entries.length) return { measured: false, why: "nothing recorded about how this person was read or what they were shown", refused: [], shown: [] };
  const projected = projectPerspectives(entries);
  const held = (h) => (projected.perspectives?.[h]?.beliefs || []).map((b) => b.claim);
  const strip = (pre) => (c) => c.startsWith(pre) ? c.slice(pre.length) : null;
  const model = mentalModel(projected, PERSON, FOLD);   // the fold's model of the person: beliefs attributed to them (none relayed yet — kept for the gap it states)
  return {
    measured: true,
    refused: held(PERSON).map(strip("not-about:")).filter(Boolean),
    shown: held(FOLD).map(strip("showed:")).filter(Boolean),
    operations: projected.operations ?? entries.length,
    model,
  };
}

/** One plain clause for the discourse summary: what the person refused. "" when they refused nothing. Bounded (3 names). */
export function mindsClause(session) {
  const r = personMind(session).refused.slice(0, 3);
  return r.length ? ` They told me not to read their questions as being about ${r.join(" or ")}.` : "";
}
