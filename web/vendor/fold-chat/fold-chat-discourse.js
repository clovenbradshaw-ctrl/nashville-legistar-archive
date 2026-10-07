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
//
// Pure: no DOM, no IO. Node-testable.

export const SMALLTALK_RE = /^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening)|how are you|how's it going|how is it going|thanks|thank you|bye|goodbye|good night|see you)\b/i;
export const GENERATE_RE = /\b(write|compose|draft|create|generate|produce|make)\b[\s\S]{0,40}\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|list|page|html|app|website|about)\b/i;
export const RESEARCH_RE = /^(who|what|when|where|which|why|how many|how much|is|are|was|were|did|does|do|can|tell me about|what's|who's|current|latest|news)\b/i;
// A bare conversational continuation: "well?", "so?", "and?", "go on", "ok" —
// a nudge to keep going, not a question of fact. A question mark alone must
// not make these "research" (the bug: "well?" was web-searched as a lookup and
// answered out of context). These carry the thread forward against the turns
// already in the window, so they are conversation, never a lookup.
export const CONVERSATIONAL_RE = /^(well|so|ok|okay|hmm+|hm+|right|sure|yeah|yep|yup|yes|no|nope|nah|and|but|then|also|really|nice|cool|wow|lol|haha|heh|go on|continue|carry on|keep going|more|again|wait|eh|meh|alright|fine|indeed|exactly|got it|i see)\b[\s?!.,…]*$/i;

export function classifyTurn(question) {
  const q = String(question ?? "").trim();
  if (!q) return "smalltalk";
  if (q.length < 60 && SMALLTALK_RE.test(q)) return "smalltalk";
  if (q.length < 40 && CONVERSATIONAL_RE.test(q)) return "chat";
  if (GENERATE_RE.test(q)) return "generate";
  if (RESEARCH_RE.test(q)) return "research";
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
export const GENERATE_NUDGE = "You are a writer. The person asked you to WRITE or PRODUCE something. Write it now, in full, in this reply. Do not ask them what topics to cover, do not ask for more detail, and do not offer to help later — deliver the complete piece. If it helps the piece to cite what was read, use it; otherwise write from your own knowledge, plainly and at length. Never reply that you cannot write, and never reply with only a plan or an offer to help.";

// Which turns may carry a grounding disclosure. Only a claim-checkable turn
// (research or chat over real material) — never a written piece, never a
// greeting.
export function checkable(kind) {
  return kind === "research" || kind === "chat";
}

export function wantsWeb(kind, webOn) {
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
