// native/organs/interlocutor.js — WHO is at the door. Handle: Buber — Martin
// Buber, "I and Thou" (1923): every encounter is either I–It (the other as a
// thing catalogued, used, predicted) or I–Thou (the other met as a whole,
// addressed rather than described). This organ recognizes WHICH KIND of
// interlocutor is speaking — an agent or a person — and its whole discipline is
// Buber's: to recognize is not to reduce. The reading selects how the reader
// MEETS the other (which register of the same truth to speak), never whether to
// be honest with them. A type is a door held open, never a box closed.
//
// THE CELL. Distinguishing the holder from the reading is Interpretation ×
// Figure — the LENS terrain (cube.js), the same cell perspective.js fills
// (DEF·Figure: "a holder is distinguished from the reading itself"). This reads
// one thing about that holder: are they an agent (often acting for a principal)
// or a person. It invents no new terrain; it fills the Lens cell with one more
// distinction the reader already had the vocabulary for.
//
// THE MODEL IS JUST THE MOUTH. The kind is computed MECHANICALLY, from signals
// the doorway already carries — never asked of the model, never guessed from the
// content of what was said. A request that arrives with tool definitions, a
// tool-call transcript, an SDK's user-agent, through a chat/messages doorway is
// an agent's request; a single natural-language ask from a browser, no tools, no
// system scaffolding, is a person's. Neither is certain, so the kind is held as
// a BELIEF WITH A BASIS (perspective.js: witnessed / asserted / inherited),
// low-confidence and revisable, and it degrades to `unknown` — served by
// addressing both — the moment the signals are thin.
//
// WHY IT EXISTS. Kierkegaard's rule for reaching anyone: "to help another, one
// must first meet them where they are." Maieutics cannot work blind. The reader
// keeps this model so that when it must give an account of itself — most of all
// to someone who came to unmake its ethics — it can speak the idiom that can
// land: the reasons an agent can follow and carry back to its principal, or the
// parable a person can be moved by. Same ground, two surfaces, exactly as one
// medium-blind kernel is read through many language lenses.

export const KIND = Object.freeze({
  AGENT: "agent", // an AI agent, often acting for a human principal
  PERSON: "person", // a human, speaking for themselves
  UNKNOWN: "unknown", // the signals are thin — meet both
});

// A basis is HOW the reader came to believe the kind (perspective.js's own
// vocabulary): the request's own shape witnessed it, or the caller asserted it
// (a user-agent, a declared user), or nothing did.
export const BASIS = Object.freeze({ WITNESSED: "witnessed", ASSERTED: "asserted", NONE: null });

// SDK / agent-framework user-agents — a caller that names one of these is a
// program, not a browser. Named, not exhaustive; absence proves nothing.
const AGENT_UA = /(node-fetch|undici|python-requests|httpx|urllib|okhttp|go-http-client|axios|openai|anthropic|langchain|llama-?index|claude-?cli|claude-?code|cline|aider|autogen|crewai|ollama)/i;
// Browser user-agents — a person at a keyboard, most likely.
const BROWSER_UA = /(mozilla|applewebkit|chrome|safari|firefox|edg\/|gecko)/i;

/**
 * readInterlocutor(signals) — recognize the kind of holder at the door.
 * signals (all optional, all mechanical):
 *   doorway            "ask" | "chat" | "messages" | "ollama" | "code"
 *   userAgent          the request's User-Agent
 *   declaredUser       an x-er7-user identity the caller asserted
 *   tools              count of tool definitions in the request
 *   system             a system prompt is present
 *   hasAssistantTurns  the transcript already carries assistant turns
 *   hasToolTurns       the transcript carries tool calls / tool results
 *   messageCount       number of chat messages
 * Returns { kind, confidence, basis, witnesses, signals }.
 */
export function readInterlocutor(signals = {}) {
  const s = {
    doorway: String(signals.doorway ?? ""),
    userAgent: String(signals.userAgent ?? ""),
    declaredUser: String(signals.declaredUser ?? ""),
    tools: Number(signals.tools ?? 0) || 0,
    system: !!signals.system,
    hasAssistantTurns: !!signals.hasAssistantTurns,
    hasToolTurns: !!signals.hasToolTurns,
    messageCount: Number(signals.messageCount ?? 0) || 0,
  };

  let agent = 0, person = 0, asserted = false;
  const witnesses = [];
  const add = (side, n, why, isAsserted = false) => {
    if (side === "agent") agent += n; else person += n;
    witnesses.push(`${side === "agent" ? "agent" : "person"}: ${why}`);
    if (isAsserted) asserted = true;
  };

  // The strongest tells are structural — the shape of the request itself.
  if (s.doorway === "code") add("agent", 3, "arrived through the coding doorway (an agent's loop)");
  if (s.tools > 0) add("agent", 3, `carries ${s.tools} tool definition(s)`);
  if (s.hasToolTurns) add("agent", 3, "the transcript already runs tools");
  if (AGENT_UA.test(s.userAgent)) add("agent", 2, `user-agent names an SDK (${s.userAgent.slice(0, 40)})`, true);
  if (s.system && s.hasAssistantTurns) add("agent", 1, "a system prompt over a running transcript (scaffolded)");
  if ((s.doorway === "chat" || s.doorway === "messages" || s.doorway === "ollama") && s.tools === 0 && !s.hasToolTurns) add("agent", 1, "an SDK-shaped doorway");

  if (BROWSER_UA.test(s.userAgent) && !AGENT_UA.test(s.userAgent)) add("person", 3, "a browser user-agent", true);
  if (s.doorway === "ask" && s.messageCount === 0 && s.tools === 0 && !s.system) add("person", 2, "a bare natural-language ask, no scaffolding");
  if (!s.userAgent && s.doorway === "ask") add("person", 1, "a plain ask with no user-agent");

  const margin = agent - person;
  const kind = margin >= 2 ? KIND.AGENT : margin <= -2 ? KIND.PERSON : KIND.UNKNOWN;
  const confidence = kind === KIND.UNKNOWN ? 0 : Math.min(1, Math.round((Math.abs(margin) / 6) * 100) / 100);
  // The basis is asserted only when a self-declared header (a user-agent) was
  // among the deciding signals; otherwise the request's own shape witnessed it.
  const basis = kind === KIND.UNKNOWN ? BASIS.NONE : (asserted ? BASIS.ASSERTED : BASIS.WITNESSED);

  return { kind, confidence, basis, witnesses, signals: s };
}

/**
 * mergeInterlocutor(prev, next) — a session is ONE interlocutor across its
 * turns, so the reading accumulates. Evidence of an agent (tools ever seen) is
 * sticky: a later bare turn does not turn an agent back into a person. Between
 * two confident, conflicting readings the more-evidenced one holds; a fresh
 * `unknown` never overwrites a prior conviction.
 */
export function mergeInterlocutor(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (next.kind === KIND.UNKNOWN) return prev;
  if (prev.kind === KIND.UNKNOWN) return next;
  if (prev.kind === next.kind) {
    return next.confidence >= prev.confidence ? next : prev;
  }
  // A genuine conflict (a session that read as a person now reads as an agent,
  // or the reverse): keep the higher-confidence reading, and if agent evidence
  // was ever witnessed, it stays — an agent does not become a person.
  if (prev.kind === KIND.AGENT || next.kind === KIND.AGENT) {
    return (next.kind === KIND.AGENT ? next : prev);
  }
  return next.confidence >= prev.confidence ? next : prev;
}

export const INTERLOCUTOR = { handle: "Buber", organ: "interlocutor", cell: "DEF·Figure → Lens", law: "to recognize is not to reduce; a type selects how the other is met, never whether they are met honestly" };
