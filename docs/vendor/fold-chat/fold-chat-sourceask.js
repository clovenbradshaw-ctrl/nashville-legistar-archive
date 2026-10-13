// fold-chat-sourceask.js — "find a primary source", "where did you get that?", "source?", "cite that": a request about the EVIDENCE for
// the previous answer. Pure: no DOM, no IO, no model.
//
// Measured 2026-10-06 (live chat, screenshot): after "Who is the king of the UK?" was answered, "find a primary source" was planned as a
// standalone ask and the LITERAL words were searched — the web returned teacher guides to primary sources (archives.gov, harvard
// guides, ala.org) and the chat read them as if they were the answer. The ask was about the last answer; its topic is the last ask's.
//
// A source-ask names no topic of its own (the content left after the cue words is empty), so it is read against the thread:
//   with an earlier answer  → searched as the ask THAT ANSWER was answering (the person's words stay what they said);
//   with nothing earlier    → the cold gap (no search, no model, an app-authored note).
//
// DECLARED, NOT MEASURED (Constitution II.11): the cue list and the word limit are the author's reading of how English asks for a
// source; giver: the same short-ask limit fold-chat-thread.js declares from the ethos study. A language without these cues is simply
// never read as a source-ask (a typed gap, not a guess). An ask that names its own entity or figure stands alone.

import { casedRuns, scriptOf } from "./fold-chat-mind.js";
import { isTertiary } from "./fold-chat-provenance.js";

export const SOURCE_ASK = Object.freeze({
  maxWords: 10,
  maxOwnContent: 0,   // after the cue words are removed, nothing of the ask's own topic is left
});

const words = (q) => String(q ?? "").toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];

// what is being asked for: a source / citation / link / proof page / reference / evidence …
const THING = String.raw`(?:(?:primary|original|official|better|real|another|other|first-?hand|reliable|actual|direct)\s+)*(?:sources?|citations?|references?|links?|urls?|evidence|proof|pages?|websites?|sites?|documents?|statements?)`;
const SOURCE_ASK_RES = [
  new RegExp(String.raw`^(?:please\s+)?(?:can|could|would|will)?\s*(?:you\s+)?(?:please\s+)?(?:find|get|show|give|bring|fetch|look up|look for|search for|pull up|check)(?:\s+(?:me|us))?(?:\s+(?:a|an|the|some|any|another|that|this|one))?\s+${THING}(?:\s+(?:for|on|about|of|to back|to support)\s+(?:that|this|it))?\s*[?!.,…]*$`, "iu"),
  new RegExp(String.raw`^(?:what|which)(?:'s| is| was| are)?\s+(?:the|your)\s+${THING}(?:\s+(?:for|on|of)\s+(?:that|this|it))?\s*[?!.,…]*$`, "iu"),
  new RegExp(String.raw`^(?:got|have you got|do you have|is there)\s+(?:a|an|any|another|the)?\s*${THING}(?:\s+(?:for|on|of)\s+(?:that|this|it))?\s*[?!.,…]*$`, "iu"),
  new RegExp(String.raw`^(?:${THING})(?:\s+please)?\s*[?!.,…]*$`, "iu"),
  /^(?:where|whence)\s+(?:did|do|does)\s+(?:you|that|this|it)\s+(?:get|come from|find|read|see|know)(?:\s+(?:that|this|it))?(?:\s+from)?\s*[?!.,…]*$/iu,
  /^(?:how|where)\s+do\s+you\s+know(?:\s+(?:that|this|it))?\s*[?!.,…]*$/iu,
  /^(?:says|according to)\s+who\s*[?!.,…]*$/iu,
  /^(?:who|what)\s+says\s+(?:that|so)\s*[?!.,…]*$/iu,
  new RegExp(String.raw`^(?:(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?|please\s+)?(?:cite|source|back up|verify|confirm|check|prove)\s+(?:that|this|it)(?:\s+(?:with|from|on|at|against)\s+(?:a|an|the|some)?\s*(?:\w+\s+){0,3}${THING})?\s*[?!.,…]*$`, "iu"),
  new RegExp(String.raw`^(?:is|was)\s+(?:that|this|it)\s+(?:on|from|in|at)\s+(?:a|an|the|any)?\s*(?:official|primary|government|original)\s+(?:site|website|page|source|record)s?\s*[?!.,…]*$`, "iu"),
  new RegExp(String.raw`^(?:verify|confirm|check|back up|cite)\s+(?:that|this|it)\s+(?:on|with|from|against|using)\s+(?:a|an|the)?\s*(?:\w+\s+){0,3}(?:site|website|source|page|record|document)s?\s*[?!.,…]*$`, "iu"),
];

/** Is this ask a request for the evidence behind the previous answer, naming no topic of its own? */
export function isSourceAsk(question) {
  const q = String(question ?? "").trim();
  if (!q || words(q).length > SOURCE_ASK.maxWords || q.length > 90) return false;
  if (/\d/u.test(q)) return false;                                  // a figure is its own topic
  if (casedRuns(q, scriptOf(q)).length) return false;              // it names its own entity: it stands alone
  return SOURCE_ASK_RES.some((re) => re.test(q));
}

// A source-ask that wants NEW evidence ("find a primary source", "got a better source?", "another source") rather than to be told where the
// last answer came from ("where did you get that?", "source?", "how do you know").
const SEEK_RE = /\b(?:find|fetch|search|look|better|another|other|primary|official|original|first-?hand|reliable|real|actual|direct|government)\b|\b(?:get|give|show)\s+(?:me|us)\b/iu;
export const wantsNewSource = (question) => SEEK_RE.test(String(question ?? ""));

const asText = (m) => String(m?.content ?? "").replace(/\s+/g, " ").trim();

/** Where did the LAST answer come from? Read back from what that answer stored — no search, no model. Returns null when the last
 *  answer has no verified source line (then the ask goes to the web as the answer's own topic, never as its literal words), or when
 *  the person asks for NEW evidence and what was already shown is not a primary page (then it is searched again, on the right topic). */
export function sourceRecall(priorMessages, question = "") {
  const msgs = Array.isArray(priorMessages) ? priorMessages : [];
  let ai = -1;
  for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "assistant" && m.mode !== "agent" && !(m.watch && m.watch.appAnswered) && (asText(m) || m.provenance)) { ai = i; break; } }   // a turn that only read a source line back is not the turn the line came from }
  if (ai < 0) return null;
  const prov = msgs[ai].provenance;
  if (!prov || !(prov.verified > 0) || !Array.isArray(prov.pointers) || !prov.pointers.length) return null;
  // an origin reached THROUGH an index is not primary when its own host is a reference/aggregator page (measured: "followed it to mappr.co and verified it there")
  const hasPrimary = prov.pointers.some((p) => (p.tier === "primary" || p.tier === "origin") && !isTertiary("https://" + String(p.host || "")));
  if (wantsNewSource(question) && !hasPrimary) return null;
  const turn = msgs.slice(0, ai + 1).filter((m) => m?.role === "assistant").length;
  const claim = String(prov.claim || asText(msgs[ai])).slice(0, 160);
  return { provenance: prov, turn, claim, hasPrimary, text: `That is where my answer on turn ${turn} came from (“${claim}”). I did not search again.` };
}
