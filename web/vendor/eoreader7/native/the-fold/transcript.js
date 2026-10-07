// transcript.js — the conversation's own record, made retrievable (P128).
//
// The fold's standing claim is that the transcript grows without limit while
// the carried context does not, because the RECORD holds what the window
// drops. For sources that was true. For the conversation itself it was not:
// asked "earlier I asked you X — what did you answer?", the instrument passed
// only the last few turns of chat history, so beyond that window the mouth
// was asked to remember something it could not see, and answered from
// nothing. Measured (S77): the memory probe scored 0.00, 0.00, 0.25, 0.00.
//
// The fix is the one the architecture already implies: a question ABOUT the
// conversation retrieves from the conversation, exactly as a question about
// the material retrieves from the material. A prior turn comes back as a
// passage with an address (`turn:12`), joins the pool, and every organ
// downstream — snips, atoms, the witness, the ground ladder — works on it
// unchanged.
//
// WHAT A PRIOR TURN IS EVIDENCE OF. Only of what was said. An answer the
// mouth gave is testimony, not material: it grounds "you said X", never "X is
// true". So its ref is marked `turn:` and its `kind` is "transcript", and the
// ladder places it on the record (SYN·Figure) rather than in the material
// (CON·Figure). This file never lets a prior answer stand as a source for a
// claim about the world.
//
// PURE: no I/O, no model.
import { CLAIM_STOPWORDS } from "../organs/grounding.js";
import { quotedSpan } from "./quoting.js";

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (t) => new Set(fold(t).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 3 && !CLAIM_STOPWORDS.has(w)));
/** How many prior turns a question about the conversation is handed. Declared (P9). */
export const RECALL_TURNS = 3;

/** The ways a person points back at what was said, rather than at the material. */
const ABOUT_RE = /\b(?:earlier|previously|before|a moment ago|last time|already)\b[^.?]{0,60}\b(?:asked|said|told|answered|mentioned|replied)\b|\b(?:what|which)\b[^.?]{0,30}\b(?:did|do)\s+(?:you|i|we)\b[^.?]{0,30}\b(?:say|said|answer|answered|tell|told|ask|asked|call)\b|\byou (?:said|answered|told me|mentioned|replied|called)\b|\bi asked\b|\bwe (?:discussed|talked about|covered)\b|\byour (?:earlier|previous|last|first) (?:answer|reply|response)\b|\brepeat (?:what|the)\b/i;

/** Is this question about the conversation itself? */
export const isAboutConversation = (question) => ABOUT_RE.test(String(question ?? ""));

/** The question a person quoted back at us, if they quoted one. */
export function quotedAsk(question) {
  // Nesting handled in one place (quoting.js): taking the FIRST quoted span
  // returned a two-word fragment on a claim that quoted a line containing
  // quotation marks, and the misquote check had nothing to align.
  return quotedSpan(question);
}

/**
 * recallTurns(question, transcript, { max }) → [{ ref, source, kind, text, turn, start, end }]
 * The prior turns a question about the conversation is asking after, most
 * relevant first, as passages the rest of the instrument can read.
 *
 * `transcript`: [{ turn, question, answer }] in order, oldest first.
 * Relevance: the quoted question wins outright (it names the turn exactly);
 * otherwise the overlap of content words between the question and the prior
 * turn's own question and answer. A turn with nothing in common is not
 * returned — an absence of relevant history is a finding, not a reason to
 * hand over the three most recent turns regardless.
 */
export function recallTurns(question, transcript = [], { max = RECALL_TURNS } = {}) {
  if (!Array.isArray(transcript) || !transcript.length) return [];
  const q = String(question ?? "");
  const quoted = quotedAsk(q);
  const qw = words(quoted ? `${q} ${quoted}` : q);
  const scored = [];
  for (const t of transcript) {
    if (!t || t.answer == null) continue;
    const asked = String(t.question ?? "");
    const exact = quoted && fold(asked).includes(fold(quoted).slice(0, 60));
    const hay = words(`${asked} ${t.answer}`);
    let shared = 0;
    for (const w of qw) if (hay.has(w)) shared += 1;
    if (!exact && shared < 2) continue;
    scored.push({ t, score: exact ? 1e6 + shared : shared });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.t.turn - a.t.turn)
    .slice(0, max)
    .map(({ t }) => asPassage(t));
}

/**
 * The address of a prior turn. `turn:12` is this conversation's twelfth turn;
 * `turn:3.12` is the twelfth turn of conversation 3 in the same workspace.
 *
 * A workspace's conversations share what was said (the person asked for
 * exactly that), so a bare turn number stopped being unique the moment more
 * than one conversation could be recalled from — and an address that names
 * two different turns is an address that lies (P137). The conversation's own
 * number leads, because that is the order the person sees in the strip.
 */
export const turnRef = (t) => (Number.isFinite(t?.chat) ? `turn:${t.chat}.${t.turn}` : `turn:${t.turn}`);

/** A prior turn as an addressed passage. The address is the turn, not a byte range in a file. */
export function asPassage(t) {
  // A turn from ANOTHER conversation says so in its own first line: the mouth
  // reads the text, not the ref, and "you answered this" about a conversation
  // the person is not in reads as a claim about this one unless it is named.
  const from = Number.isFinite(t?.chat) && t.chatTitle ? `In "${String(t.chatTitle).trim()}", earlier in this workspace:\n` : "";
  const text = `${from}You were asked: ${String(t.question ?? "").trim()}\nYou answered: ${String(t.answer ?? "").trim()}`;
  const ref = turnRef(t);
  return {
    ref,
    source: ref,
    kind: "transcript",
    turn: t.turn,
    ...(Number.isFinite(t?.chat) ? { chat: t.chat, chatTitle: t.chatTitle ?? null } : {}),
    start: 0,
    end: text.length,
    text,
  };
}

/** True for a passage this module produced — the one place anything downstream needs to ask. */
export const isTranscriptPassage = (p) => String(p?.ref ?? "").startsWith("turn:") || p?.kind === "transcript";

/**
 * lastOwnTurn(transcript) → the most recent turn belonging to THIS
 * conversation — never a row tagged `chat` (this file's own convention: a
 * turn recalled from another conversation in the workspace always carries
 * one, `asPassage` above). Every caller that means "the last thing THIS
 * conversation said" (dialogue.js::bindAnaphora's pronoun fallback,
 * answerable.js's "quote it"/"did the book include those passages" doors,
 * resolutions.js's atmosphere/lens blocks) used to take `transcript`'s own
 * last array element instead — safe only while a workspace held one
 * conversation. `transcriptNow()` (app.js) appends every OTHER
 * conversation's rows after this one's own (oldest to newest within each),
 * so the array's last element is a FOREIGN conversation's last turn the
 * moment the workspace holds a second, non-empty one — which in ordinary
 * use is close to always, not an edge case. Measured live across many
 * batches (2026-09-15): a single word from a correction turn in one
 * conversation was traced leaking, as the anaphora fallback's bound
 * referent, into a wholly different conversation's own system prompt.
 * Cross-conversation reach is real and intended here (P178) but every
 * place that offers it deliberately — `recallTurns`, `priorAnswer` —
 * DISCLOSES it, in words, to whoever reads the result; a bare "last turn"
 * fallback has no disclosure at all, so it may only ever mean the
 * conversation the person is actually in.
 */
export function lastOwnTurn(transcript = []) {
  for (let i = (transcript?.length ?? 0) - 1; i >= 0; i--) {
    const t = transcript[i];
    if (t && !Number.isFinite(t?.chat)) return t;
  }
  return null;
}

/**
 * The line that says what these passages are, so the mouth reads them as the
 * record of what was said and not as material about the world.
 */
export function transcriptLine(passages = []) {
  const rows = passages.filter(isTranscriptPassage).filter((p) => Number.isFinite(p.turn));
  if (!rows.length) return "";
  const here = rows.filter((p) => !Number.isFinite(p.chat));
  const elsewhere = rows.filter((p) => Number.isFinite(p.chat));
  const nums = (list) => list.map((p) => p.turn).sort((a, b) => a - b).join(", ");
  const parts = [];
  if (here.length) parts.push(`Turn${here.length === 1 ? "" : "s"} ${nums(here)} of this conversation`);
  // Named, not numbered: the conversation's own title is what the person can
  // recognise, and a bare "conversation 3" is an address for the record, not
  // a sentence for a reader.
  for (const title of [...new Set(elsewhere.map((p) => p.chatTitle).filter(Boolean))]) {
    const of = elsewhere.filter((p) => p.chatTitle === title);
    parts.push(`turn${of.length === 1 ? "" : "s"} ${nums(of)} of "${String(title).trim()}", another conversation in this workspace`);
  }
  const unnamed = elsewhere.filter((p) => !p.chatTitle);
  if (unnamed.length) parts.push(`turn${unnamed.length === 1 ? "" : "s"} ${nums(unnamed)} of another conversation in this workspace`);
  return `${parts.join("; ")}, quoted from the record. This is what was said, which is not the same as what the sources establish.`;
}
