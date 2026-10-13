// fold-chat-discourse.js — the discourse classifier (the holodeck's lesson).
//
// A turn is one of four kinds, and the kind decides the whole pipeline. This
// is the pure, testable core; the surface reads it to choose prompt, search,
// and whether a grounding disclosure even applies.
//
//   smalltalk — a greeting or thank-you. Plain chat: no web search, no
//               grounding. A greeting gets a greeting.
//   generate  — "write / compose / an essay on / draft / build …": the person
//               wants an ARTIFACT. No web search front-loads it and no
//               clarifying quiz — the fold writes it now. (The loud failure
//               this fixes: "write about the extinction of dolphins" became
//               "please tell me what topics to cover".)
//   research  — a question of fact ("who is / when / what is / how many", a
//               bare lookup, or anything with a "?"): search, read, answer
//               from what was read.
//   chat      — everything else: plain conversation.
//   compute / transform / code / compose / advice — the EVERYDAY kinds added
//               2026-10-05 (fold-chat-kinds.js has the shapes and the reasons):
//               arithmetic and unit asks the fold computes itself, the person's
//               own text to translate/summarise, programming how-tos, personal
//               correspondence — none of these searches the web or draws a void —
//               and open how-to advice (searched, but no void unless it commits
//               to figures nothing read says).
//
// Pure: no DOM, no IO. Node-testable.

import { selfAsk } from "./fold-chat-self.js";
import { evaluate } from "./fold-chat-compute.js";
import { transformShape, codeShape, composeShape, adviceShape } from "./fold-chat-kinds.js";
import { outputKind } from "./fold-chat-outputtype.js";
export { skipsSearch, noClaimsLabel, KIND_PROMPT } from "./fold-chat-kinds.js";

export const SMALLTALK_RE = /^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening)|how are you|how's it going|how is it going|thanks|thank you|bye|goodbye|good night|see you)\b/i;
export const GENERATE_RE = /\b(write|compose|draft|create|generate|produce|make)\b[\s\S]{0,40}\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|list|page|html|app|website|comparison|analysis|review|memo|brief|about|note|message|speech|toast|card|caption|bio|paragraph|announcement|invitation|script|tweet|slogan|tagline|haiku|limerick|joke|riddle|dialogue|monologue|lyrics|sonnet|description)\b/i;
export const RESEARCH_RE = /^(who|what|when|where|which|why|how many|how much|is|are|was|were|did|does|do|can|tell me about|what's|who's|current|latest|news)\b/i;
// A demand for facts, proof, or a comparison — "compare X, Y, Z", "prove it",
// "cite this", "source?", "verify …", "differences between …". These are
// information-seeking whether or not they carry a wh-word or a "?", so they
// route to research (and thus search). Checked after GENERATE, so a "write a
// comparison" is still a writing turn, not a lookup.
export const DEMAND_RE = /\b(compare|contrast|prove|cite|source|citation|evidence|verify|fact[- ]?check|look\s?up|find me|find out|figure out|search for|dig up|relationship between|connection between|link between|related to|who is|who was|who are|tell me about|show me|versus|vs\.?|differences? between|how (?:does|do|did|are|is|were|was))\b/i;
// A bare conversational continuation: "well?", "so?", "and?", "go on", "ok" —
// a nudge to keep going, not a question of fact. A question mark alone must
// not make these "research" (the bug: "well?" was web-searched as a lookup and
// answered out of context). These carry the thread forward against the turns
// already in the window, so they are conversation, never a lookup.
export const CONVERSATIONAL_RE = /^(well|so|ok|okay|hmm+|hm+|right|sure|yeah|yep|yup|yes|no|nope|nah|and|but|then|also|really|nice|cool|wow|lol|haha|heh|go on|continue|carry on|keep going|more|again|wait|eh|meh|alright|fine|indeed|exactly|got it|i see)\b[\s?!.,…]*$/i;

/** `opts.hasMaterial`: the chat already carries an attachment or pasted document
 *  (so "summarise this" has something to act on). */
export function classifyTurn(question, opts = {}) {
  const q = String(question ?? "").trim();
  if (!q) return "smalltalk";
  if (selfAsk(q)) return "self";   // addressed to the fold itself: answered by the app, never searched
  if (q.length < 60 && SMALLTALK_RE.test(q)) return "smalltalk";
  if (q.length < 40 && CONVERSATIONAL_RE.test(q)) return "chat";
  // The everyday kinds, most specific first. Each needs two independent signals
  // (fold-chat-kinds.js) and answers "no" when unsure, so the turn is searched.
  if (evaluate(q).ok) return "compute";
  if (transformShape(q, { hasMaterial: !!opts.hasMaterial })) return "transform";
  if (codeShape(q)) return "code";
  if (composeShape(q)) return "compose";
  // What was the person asked to PRODUCE? fold-chat-outputtype.js reads the verb, the noun and what stands between them (question frames,
  // reported requests, "write down", capability questions are not requests), in en/es/fr/ru/de. GENERATE_RE (kept, exported) is only the
  // fallback if that reading throws: it matched "how do I write an essay" and "make sure you note…" and missed every non-English ask.
  let produced = null;
  try { produced = outputKind(q, { hasMaterial: !!opts.hasMaterial }); } catch { produced = GENERATE_RE.test(q) ? "generate" : null; }
  if (produced) return produced;
  if (adviceShape(q)) return "advice";
  if (RESEARCH_RE.test(q)) return "research";
  if (DEMAND_RE.test(q)) return "research";
  // A comparison/list of several entities ("Canberra, Brasília, Ottawa, and
  // Washington, D.C.") seeks facts, even with no wh-word and no "?".
  if ((q.match(/,/g) || []).length >= 2 && /\b[A-Z][a-z]/.test(q)) return "research";
  return /\?/.test(q) ? "research" : "chat";
}

// The generate instruction — the fold writes the thing, it does not interview
// the person for a brief. This is the whole fix for "it never writes it".
//
// It REPLACES the surface's persona on a generate turn, never sits after it.
// Measured live: the reading persona ("answer from the material; where it does
// not, say what is missing instead of filling it in") and this instruction are
// opposite directives — a small model handed both hedges into a teaser
// ("Certainly, I'd be happy to help you write…") instead of writing. So on a
// generate turn the base prompt IS the writer, and the persona stands down.
export const GENERATE_NUDGE = "You are a writer working ONLY from the sources provided in this context. The person asked you to WRITE or PRODUCE something. Write it now, in full, in this reply. Ground every fact in the sources you were given — never invent a date, name, figure, or event, and never write from memory. If the sources do not cover part of the piece, say plainly what is missing instead of filling it in. Do not ask them what topics to cover, do not ask for more detail, and do not offer to help later — deliver the complete piece. Never reply that you cannot write.";

// THE CREATIVE WRITER (2026-10-07): a poem, a story, a tagline, a joke needs no outside facts. GENERATE_NUDGE ("working ONLY from the sources provided … say what
// is missing") is the wrong brief for it — with no sources a small model answers it with "the sources do not cover…". fold-chat-outputtype.js says when a
// request needs no sources (`needsSources: false`); the surface hands the model THIS brief for those and GENERATE_NUDGE for the grounded ones.
export const GENERATE_CREATIVE_NUDGE = "You are a writer. The person asked you to WRITE something creative that needs no outside facts. Write it now, in full, in this reply. Invent freely: images, characters, voice. Do not state a real person, date, figure or event as fact. Do not ask what to cover, do not ask for more detail, do not offer to help later, and never reply that you cannot write.";

// Which turns carry a grounding record — every turn that makes a claim or a
// written artifact, i.e. everything but a greeting. The fold is always grounded
// (it searches and reads first), so a record exists for these turns.
export function recordable(kind) {
  return kind === "research" || kind === "chat" || kind === "generate" || kind === "advice" || kind === "compute" || kind === "transform" || kind === "code" || kind === "compose";
}

// Which turns have CLAIMS to check. A poem, a story, an essay a person asked to
// be written has no claim in it to score: no void is reported for it and no
// sentence of it is marked unsourced (✱). The search that fed it is untouched —
// only the checking stands down, and the process panel says so.
export function checkable(kind) {
  // advice is checkable but its void is conditional on figures (see fold-chat-channels voidReport)
  return kind === "research" || kind === "chat" || kind === "advice";
}

export function wantsWeb(kind, webOn) {
  // Retained for callers/tests; the surface itself now ALWAYS grounds (every
  // non-greeting turn searches), so this is no longer the gate.
  return !!webOn && kind === "research";
}

// THE GENERATION LANE (2026-10-04): a generate turn whose artifact penelope's
// generation system holds (prose: essays, reports, pieces) is dispatched to the
// weave — void detection + writing across prompts — instead of a single draw.
// An html/app/page ask keeps the fold's own single-draw build (the fenced-HTML
// preview the surface already renders); penelope has no html adapter yet.
const GENERATION_ARTIFACT_RE = /\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide)\b/i;
export function generationArtifact(question) {
  return GENERATION_ARTIFACT_RE.test(String(question ?? "")) ? "text" : null;
}
