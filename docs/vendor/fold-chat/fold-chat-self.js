// fold-chat-self.js — what the fold says about ITSELF, and the gate that stops it LOOKING UP an ask that has nothing to look up. Pure.
//
//   selfAsk(question)          is this ask addressed to the fold itself (who/what are you, what can you do, are you an AI…)? English, DECLARED.
//   lookupWarranted(...)       does the ask carry anything to look up — a content word of its own, or a referent carried from the thread?
//   SELF_LINE / noLookupLine   the fold's own words for those two cases, app-authored (never a model, never a search)
//
// Why (user, 2026-10-06): "who are you?" was classified `research` (it opens with "who"), searched on four scopes, and answered with a 1978 album by The
// Who. The dispatcher (fold-chat.js `wantWeb`) was default-yes: every non-greeting ask searched. A lookup is warranted only when the ask has a CONTENT word
// (its words minus the language's closed class) or continues a thread (carried / elliptical / retry). Languages with no closed-class prior are not judged:
// the old behaviour stands and the result says `measured: false`.
//
// DECLARED, not measured (Constitution II.11): the self-ask patterns and both lines. Giver: the author's DRAFT of 2026-10-06, written for the user to edit
// ("what should the system say?"); SELF_LINE is the one place to change what the fold says about itself.

import * as ground from "./fold-chat-ground.js";

// each pattern must reach the END of the ask (an optional filler word and closing punctuation allowed): "Who Are You album by The Who" is a lookup, not a self ask
const END = "(?:\\s+(?:exactly|really|anyway|again|then|now|actually))?\\s*[?.!]*$";
const SELF_PATTERNS = Object.freeze([
  new RegExp("^(?:so\\s+)?(?:who|what)\\s+(?:are|r)\\s+(?:you|u)" + END, "i"),
  new RegExp("^(?:who|what)(?:'s|\\s+is)\\s+(?:this|the\\s+fold)" + END, "i"),
  new RegExp("^(?:what|how)\\s+(?:can|could|do|does)\\s+(?:you|u|the\\s+fold)\\s+(?:do|work|help)" + END, "i"),
  new RegExp("^what\\s+(?:do|does)\\s+(?:you|u|the\\s+fold)\\s+do" + END, "i"),
  new RegExp("^are\\s+(?:you|u)\\s+(?:an?\\s+|the\\s+)?(?:ai|a\\.i\\.|bot|robot|human|person|real|chatgpt|claude|gpt|llm|model|machine|program)" + END, "i"),
  new RegExp("^(?:who|what\\s+company)\\s+(?:made|built|created|wrote|trained|owns|programmed)\\s+(?:you|u)" + END, "i"),
  new RegExp("^what(?:'s|\\s+is)\\s+your\\s+name" + END, "i"),
  new RegExp("^(?:tell\\s+me\\s+about\\s+yourself|introduce\\s+yourself|describe\\s+yourself)" + END, "i"),
]);
// request-frame verbs and courtesy words: they ask FOR something and name nothing (English, DECLARED; the frame of "tell me", "show me", "please")
const FRAME_WORDS = new Set(["tell", "show", "give", "explain", "describe", "say", "know", "find", "ask", "please", "thanks", "thank", "pls", "ok", "okay"]);

export function selfAsk(question) {
  const q = String(question ?? "").trim().replace(/\s+/g, " ");
  if (!q || q.length > 80) return false;
  return SELF_PATTERNS.some((re) => re.test(q));
}

export const SELF_LINE = "I'm the fold, a reading and research tool. When you ask me something, I look it up, read what I find, and show you what the sources say, with where each part came from. I don't answer from memory. A small language model helps put things into words, but before you see a sentence I check it against the sources: a name or a figure no source gives, I leave out, and wording I can't trace to a source is marked as unsourced. If I can't find an answer, I'll say that instead of guessing.";

export const NO_LOOKUP_LINE = "There's nothing in that for me to look up. Ask me about a person, place, event or fact, or give me something to read, and I'll show you what the sources say.";

/** { warranted, why, measured }. `follow` is the turn plan (fold-chat-thread.js); `fw` the language's closed class, or null when it has none. */
export function lookupWarranted({ question = "", follow = null, fw = null } = {}) {
  if (!fw) return { warranted: true, why: "no closed-class prior for this language: not judged", measured: false };
  if (follow && ["carried", "elliptical", "retry"].includes(follow.kind)) return { warranted: true, why: "it continues the thread (" + follow.kind + ")", measured: true };
  const content = ground.tokenize(String(question ?? "")).filter((t) => !fw.has(t) && t.length > 1 && !FRAME_WORDS.has(t));
  if (!content.length) return { warranted: false, why: "no word of the ask names anything to look up", measured: true };
  return { warranted: true, why: "the ask names " + content.slice(0, 3).join(", "), measured: true };
}
