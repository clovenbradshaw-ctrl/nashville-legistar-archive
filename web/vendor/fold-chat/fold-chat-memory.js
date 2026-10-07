// fold-chat-memory.js — the identity + memory pipeline for the chat.
//
// The failure this exists to make impossible: a bare model asked "what is my
// name?" answering "Your name appears to be Qwen" — inventing an identity
// because nothing told it who the person is. In the Fold, identity is
// GROUND, not model knowledge: the surface holds who the person is (the
// reader), learns it only when the person states it, carries it in the system
// context, and then REFUSES to let an ungrounded identity claim stand. The
// model proposes; the record decides (resolution, never invention).
//
// Pure and node-testable.

/** The standing rule carried into every turn. */
export const NO_INVENT = "Never state, guess, or attribute the person's name, identity, or any personal fact that is not given to you in this context. If asked and it is not in this context, say plainly that you do not have it. Never answer with your own model name as if it were the person's.";

const STOP = /^(a|an|the|not|no|just|here|fine|good|ok|okay|sorry|asking|wondering|curious|confused)$/i;

/** Learn a name the person states about themselves. Returns the name
 *  (capitalized) or null. Questions never yield a name. */
export function extractStatedName(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const m =
    t.match(/\b(?:my name is|my name'?s|call me|i am|i'?m)\s+([\p{L}][\p{L}'’-]+)/iu) ||
    t.match(/\bname'?s\s+([\p{L}][\p{L}'’-]+)/iu);
  if (!m) return null;
  const raw = m[1];
  if (!raw || STOP.test(raw)) return null;
  return raw[0].toUpperCase() + raw.slice(1);
}

/** True when the text is a question about the person's identity. */
export function asksIdentity(text) {
  return /\b(what(?:'s| is)|who(?:'s| is))\b[^?.!]*\b(my|the user'?s?)\b[^?.!]*\bname\b/i.test(String(text ?? "")) ||
    /\b(do you know|canyou (?:tell|remember)|what do you call)\b[^?.!]*\b(me|my name)\b/i.test(String(text ?? ""));
}

/** The system context for a turn: who the person is (or that we do not know),
 *  plus every fact the conversation has established, plus the standing rule. */
export function systemContext({ readerName = null, facts = {} } = {}) {
  const parts = [];
  parts.push(readerName ? `The person you are talking with is ${readerName}.` : "You do not know the person's name yet.");
  for (const [k, v] of Object.entries(facts || {})) if (v) parts.push(`Established in this conversation: ${k} is ${v}.`);
  parts.push(NO_INVENT);
  return parts.join(" ");
}

/** Every identity claim a reply makes about the person, e.g. "your name is X". */
export function identityClaims(reply) {
  const out = [];
  const t = String(reply ?? "");
  const re = /\byour name(?:\s+appears to be|\s+is|\s+seems to be|'s)\s+([\p{L}][\p{L}'’-]+)/giu;
  let m;
  while ((m = re.exec(t)) !== null) out.push({ name: m[1], match: m[0] });
  const re2 = /\b(?:i(?:'ll| will)? call you|i(?:'ve| have) (?:saved|noted) your name as)\s+([\p{L}][\p{L}'’-]+)/giu;
  while ((m = re2.exec(t)) !== null) out.push({ name: m[1], match: m[0] });
  return out;
}

/** The first identity claim in a reply that the record does NOT support, or
 *  null. This is the guard: if the model says "your name is X" and X is not
 *  the reader's name and not a name the person stated, the claim is refused. */
export function ungroundedIdentity(reply, { readerName = null, facts = {} } = {}) {
  const known = new Set();
  if (readerName) known.add(String(readerName).toLowerCase());
  if (facts?.name) known.add(String(facts.name).toLowerCase());
  for (const c of identityClaims(reply)) {
    if (!known.has(String(c.name).toLowerCase())) return c;
  }
  return null;
}

/** The correction the surface appends when the model made a claim it could
 *  not ground — the fold's own voice, not the model's. */
export function identityCorrection(claim, { readerName = null } = {}) {
  if (readerName) return `⟂ fold: the record has your name as ${readerName}; "${claim.name}" is not grounded and was withdrawn.`;
  return `⟂ fold: I don't have your name. The reply above asserted "${claim.name}" — that is not grounded, and I withdraw it. Tell me your name and I'll keep it.`;
}