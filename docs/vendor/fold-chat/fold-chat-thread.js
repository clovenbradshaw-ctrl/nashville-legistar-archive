// fold-chat-thread.js — the conversation is a source: follow the thread before any search. Pure: no DOM, no IO, no model.
//
// Measured 2026-10-05 in the live app:
//   • after a cookie-recipe turn the person said "i want a chewier one". The app searched that literal phrase, got a
//     bot-challenge page and two unrelated snippets (Chinese takeout), and showed them as the answer. The referent was lost.
//   • the person said "what?" after an answer. The app searched the web for "what?", got a 502 and drew a gap.
//
// What this module decides, from the ask and the turns BEFORE it (never from the web):
//   meta        "what?", "why?", "explain that", "shorter", "I don't get it" — a request about the PREVIOUS ANSWER. No search
//               is made. With an earlier answer to follow, the model may reply, grounded ONLY in that earlier turn, labelled
//               "answered from this conversation" and citing the turn. With NO earlier answer (a cold "what?") nothing is
//               written: an app-authored note, no model call.
//   carried     the language's pronoun triggers (fold-chat-hints.js, from the ethos priors) + the referent record
//               (fold-chat-mind.js resolveQuestion): "what happened to him?" is searched about the last answer's referent.
//   elliptical  a short ask with no name of its own that leans on the last topic ("i want a chewier one"): the search query
//               carries the earlier topic ("chewier chocolate chip cookie recipe"). The person's words are never rewritten;
//               the feed shows what was searched.
//   standalone  everything else: searched as asked.
//
// DECLARED, NOT MEASURED (Constitution II.11): the word limit below (a short ask is ≤ 8 words — the ethos study measured
// 85% wrong inheritance on UNGATED short asks, so a cue is still required) and the cue lists, each with its giver: the
// author's reading of how English follow-ups are phrased; a language without these cues is simply never treated as
// elliptical or meta (a typed gap, not a guess).

import { casedRuns, resolveQuestion, searchQueries, scriptOf } from "./fold-chat-mind.js";
import { resolveCast, pronounOf } from "./fold-chat-casts.js";
import { isSourceAsk } from "./fold-chat-sourceask.js";
import { anaphoraOf } from "./fold-chat-anaphora.js";

export const THREAD = Object.freeze({
  ellipticalMaxWords: 8,   // "i want a chewier one" is 5; a nine-word ask names enough on its own
  topicMaxWords: 9,        // a search topic drawn from an earlier ask is clipped here
  quoteChars: 70,          // how much of the earlier turn the citation quotes
});

const words = (q) => String(q ?? "").toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];

// A request about the previous answer: closed list, nothing else in the ask. (`more`, `go on`, `continue` are left to the
// old path on purpose: they ask for NEW material, which a thread-only reply may not write.)
const META_ALTS = [
  "what", "huh", "eh", "hm+", "why", "why (?:is that|is it|so|not|did you say that|does that matter)", "how come", "how so", "really", "sorry", "pardon", "come again",
  "what (?:do you mean|does that mean|did you (?:say|mean)|was that|is that|are you (?:saying|talking about)|the \\w+)",
  "say (?:that )?again", "repeat (?:that|it)", "i (?:don'?t|do not) (?:get|understand)(?: (?:it|that|this))?", "i'?m (?:confused|lost)", "that'?s confusing", "not sure i follow",
  "explain(?: (?:that|it|this|more|further|please|again|why))?", "elaborate", "can you (?:explain|clarify|elaborate)(?: (?:that|it|more))?", "clarify(?: (?:that|it))?",
  "shorter", "make it shorter", "simpler", "make it simpler", "in short", "tl;?dr", "eli5", "in (?:simple|plain) (?:words|terms|english)", "summari[sz]e(?: (?:that|it))?",
  "which one", "which", "who", "meaning", "so\\s+what", "and\\s+so", "what about (?:that|it)",
];
export const META_RE = new RegExp(`^\\s*(?:${META_ALTS.join("|")})\\s*[?!.,…]*\\s*$`, "iu");

// An ask that leans on the last topic: a pointer word, or a comparative ("chewier", "crispier", "cheaper", "more X").
const BACKREF_RE = /\b(?:one|ones|that|this|it|them|those|these|another|other|instead|same|similar|also|too|more|less|rather|different)\b/iu;
const COMPARATIVE_RE = /\b\p{L}{3,}ier\b|\b(?:bett|wors|cheap|easi|hard|fast|slow|bigg|small|larg|long|short|thick|thin|soft|crisp|sweet|spic|healthi|light|strong|smooth|rich|tough|tender)er\b|\b(?:more|less|a bit|a little|much|way|super|very)\s+\p{L}{3,}\b/iu;
// Words that carry no topic: openers, pointers, fillers. (An ask's CONTENT is what is left.)
const STOP = new Set(["a", "an", "the", "me", "my", "i", "we", "you", "your", "it", "its", "this", "that", "these", "those", "one", "ones", "some", "any", "show", "give", "tell", "find", "get", "want", "wanna", "need", "like", "love", "prefer", "please", "pls", "can", "could", "would", "should", "will", "do", "does", "did", "is", "are", "was", "were", "be", "to", "for", "of", "on", "in", "at", "with", "without", "and", "or", "but", "so", "how", "what", "which", "who", "whom", "where", "when", "why", "about", "good", "best", "great", "nice", "another", "other", "instead", "same", "similar", "also", "too", "rather", "different", "try", "something", "anything", "let", "lets", "let's", "make", "have", "has", "i'd", "i'm", "ill", "i'll", "id", "im", "just", "really", "very", "much", "way", "super", "bit", "little", "than", "then", "up", "out", "there", "here", "know", "see", "look", "looking", "search", "help", "us", "hmm", "ok", "okay"]);

const contentWords = (q) => words(q).filter((w) => !STOP.has(w) && w.length > 1);
const clipWords = (arr, n) => arr.slice(0, n);

/** Is this ask a request about the previous answer ("what?", "why?", "explain that", "shorter")? */
export function isMeta(question) {
  const q = String(question ?? "").trim();
  return !!q && q.length <= 60 && META_RE.test(q);
}

// A bare nudge — the person waiting on an answer, not asking anything new: "well?", "so?", "and?", "any luck?", "go on".
// Measured 2026-10-05: a turn was stopped (nothing written), the person said "well?", and the app searched the literal word
// "well?" — advertising copy and the article on water wells came back as the answer. A nudge has no topic of its own: it is
// about the last ask (if that went unanswered) or the last answer (if there was one).
const NUDGE_ALTS = [
  "well", "so", "and", "and\\s+then", "then", "hmm+", "hm+", "eh", "anything", "any (?:luck|answer|news|progress|update)", "done yet", "ready yet", "still (?:there|working)", "you there", "are you (?:there|still there)",
  "answer(?: me| please)?", "well\\s+then",
];
export const NUDGE_RE = new RegExp(`^\\s*(?:${NUDGE_ALTS.join("|")})\\s*[?!.,…]*\\s*$`, "iu");
/** A bare waiting-on-you nudge ("well?", "so?", "any luck?", "go on")? */
export function isNudge(question) {
  const q = String(question ?? "").trim();
  return !!q && q.length <= 30 && NUDGE_RE.test(q);
}
// The nudges that ask for MORE (go on / continue — also the Continue button's own "Continue.") are a nudge ONLY when an earlier ask
// went unanswered; after an answer they stay with the old path, which writes new material.
const MORE_NUDGE_RE = /^\s*(?:go on|carry on|keep going|continue|come on)\s*[?!.,…]*\s*$/iu;

/** Does this short ask lean on the last topic and name nothing of its own? ("i want a chewier one") */
export function isElliptical(question) {
  const q = String(question ?? "").trim();
  const w = words(q);
  if (!w.length || w.length > THREAD.ellipticalMaxWords) return false;
  if (isMeta(q)) return false;
  if (casedRuns(q, scriptOf(q)).length) return false;              // it names its own entity: it stands alone
  return BACKREF_RE.test(q) || COMPARATIVE_RE.test(q);
}

const asText = (m) => String(m?.content ?? "").replace(/\s+/g, " ").trim();
const isFollowLike = (q) => isMeta(q) || isElliptical(q) || isSourceAsk(q) || /^continue\.?$/i.test(String(q).trim());   // a source-ask ("find a primary source") has no topic of its own: it is never the topic a later ask follows

/** The earlier turns this ask can follow: the last answer that WROTE something (a gap or a failure is nothing to follow),
 *  the ask that produced it, and the topic of the nearest earlier ask that stood on its own. `priorMessages` are the
 *  stored messages BEFORE this ask. */
export function threadOf(priorMessages) {
  const msgs = Array.isArray(priorMessages) ? priorMessages : [];
  let ai = -1;
  for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "assistant" && asText(m) && m.mode !== "agent") { ai = i; break; } }
  let ask = null, askIndex = -1;
  // the ask that produced the answer — skipping a bare nudge ("well?"): a nudge-retried answer answers the ask the nudge picked back up
  if (ai >= 0) for (let i = ai - 1; i >= 0; i--) { if (msgs[i]?.role === "user" && asText(msgs[i]) && !isNudge(asText(msgs[i]))) { ask = asText(msgs[i]); askIndex = i; break; } }
  // the topic: the nearest earlier user ask that is neither a follow-up nor the synthetic "Continue."
  let topicAsk = null;
  for (let i = (ai >= 0 ? ai : msgs.length) - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "user" && asText(m) && !isFollowLike(asText(m))) { topicAsk = asText(m); break; } }
  const turn = ai >= 0 ? msgs.slice(0, ai + 1).filter((m) => m?.role === "assistant").length : 0;
  return { has: ai >= 0, answer: ai >= 0 ? asText(msgs[ai]) : "", answerIndex: ai, ask, askIndex, topicAsk, turn };
}

/** The ask that was never answered: the person's last substantive ask when nothing was written after it (the turn was stopped,
 *  failed, or drew an empty gap). Walks back over empty assistant turns and over nudges. null when the last turn was answered. */
export function unansweredAsk(priorMessages) {
  const msgs = Array.isArray(priorMessages) ? priorMessages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant") { if (m.mode === "agent" || asText(m)) return null; continue; }   // an answer was written (or the ask went to the other lane): nothing is owed HERE
    if (m?.role === "user" && asText(m)) { if (isNudge(asText(m))) continue; return asText(m); }
  }
  return null;
}

/** The topic words of an earlier ask: "Show me a good chocolate chip cookie recipe" → "chocolate chip cookie recipe". */
export function topicOf(askText) {
  const w = contentWords(askText);
  return clipWords(w, THREAD.topicMaxWords).join(" ");
}

// A request about the CONVERSATION'S OWN ANSWERS ("compare your first answer", "quote the exact sentence you relied
// on", "combine your four answers"): the ground is the earlier answer(s) they name, not a fresh web search. Measured
// 2026-10-07 on the live app: planned standalone, these searched their own literal words and drifted to unrelated pages
// ("compare…" → an election page; "quote the exact sentence…" → how-to-quote guides; "combine your four answers…" →
// car-parts suppliers). This is the follow-up class eval/ants/D1 and G3 left open.
const REF_VERB_RE = /\b(?:compare|contrast|reconcile|combine|merg(?:e|ed|es|ing)|synthesi[sz]e|summari[sz]e|recap|restate|quote|re-?use|list|gather|pull\s+together)\w*\b/iu;
const REF_ORDINAL_RE = /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|last|latest|final|previous|earlier|prior|preceding|above|foregoing)\b/iu;
// A conversational anchor: what makes "compare … answers" a question about THIS chat, not the world
// ("compare the answers of Plato and Aristotle" has none of these, so it searches as asked).
const REF_ANCHOR_RE = /\b(?:you|your|yours|the\s+conversation|this\s+conversation|the\s+thread|the\s+chat|earlier|previous|prior|above|preceding|foregoing|last|same)\b/iu;
// Second-person references: "what you said", "your last answer", "the exact sentence you relied on".
const REF_YOU_RE = new RegExp("\\b(?:" +
  "you\\s+(?:(?:just|already|earlier|previously|now|also|first|then)\\s+)?(?:said|wrote|stated|gave|mentioned|claimed|told|relied|based|grounded|cited|used|quoted|read|answered|summari[sz]ed)" +
  "|your\\s+(?:(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|latest|final|previous|earlier|prior|very|\\d+)\\s+)?(?:answers?|responses?|repl(?:y|ies)|words|wording|points?|claims?|sentences?|paragraphs?|turns?)" +
  "|what\\s+you\\s+(?:said|wrote|answered|gave|claimed)" +
  "|the\\s+exact\\s+(?:sentence|quote|wording|words|span|passage)" +
  ")\\b", "iu");

/** Does this ask refer to the CONVERSATION'S OWN earlier answer(s)? ("compare your first answer", "quote the exact
 *  sentence you relied on", "combine your four answers"). A WORLD question that merely contains a ref-verb and the
 *  noun "answers" ("compare the answers of Plato and Aristotle") is NOT one: it must name the person's own turns (a
 *  second-person reference), an ordinal, or a conversational anchor. English cues, DECLARED, not measured (II.11). Pure. */
export function isConversationRef(question) {
  const s = String(question ?? "").trim();
  if (!s || s.length > 220) return false;
  if (REF_YOU_RE.test(s)) return true;
  if (!REF_VERB_RE.test(s)) return false;
  return REF_ORDINAL_RE.test(s) || REF_ANCHOR_RE.test(s);
}

const ORDINAL_INDEX = Object.freeze({ first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5, sixth: 6, "6th": 6, seventh: 7, "7th": 7, eighth: 8, "8th": 8, ninth: 9, "9th": 9, tenth: 10, "10th": 10 });
const NUM_WORD = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 });
/** Every earlier answer the ask names: a list of 1-based indices and/or "last", or [] for a plural ask (all of them). */
function ordinalRefs(s) {
  const out = [];
  if (/\b(?:last|latest|final)\b/iu.test(s)) out.push("last");
  for (const [k, n] of Object.entries(ORDINAL_INDEX)) if (new RegExp(`\\b${k}\\b`, "iu").test(s)) out.push(n);
  if (!out.length && /\b(?:previous|earlier|prior|preceding|above|foregoing)\b/iu.test(s)) out.push("last");
  return out;
}

/** The thread object a conversation-reference reply is grounded in: the earlier answers the ask names, as a list
 *  (`answers`), their plain concatenation (`.answer`, what the reply is checked against) and the LAST referenced
 *  exchange's index/turn. Understands a range ("the first three questions", "the last two answers"); a plural ask
 *  with no ordinal ("combine your four answers") carries the most recent few (bounded). An ordinal with no such
 *  answer returns `{ has:true, missing:true }` — a typed gap, never a silent carry of the wrong turns. */
export function referencedThread(priorMessages, question) {
  const msgs = Array.isArray(priorMessages) ? priorMessages : [];
  const turns = [];
  let ask = null;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m?.role === "user" && asText(m)) ask = asText(m);
    else if (m?.role === "assistant" && asText(m) && m.mode !== "agent") turns.push({ ask, answer: asText(m), answerIndex: i });
  }
  turns.forEach((t, i) => { t.turn = i + 1; });
  if (!turns.length) return { has: false, answer: "", ask: null, answerIndex: -1, turn: 0, answers: [] };
  const s = String(question ?? "").toLowerCase();
  let pick = null;
  // "the first three questions" / "the last two answers"
  const range = s.match(/\b(first|last)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/);
  if (range) { const n = (NUM_WORD[range[2]] || parseInt(range[2], 10) || 0); const c = Math.min(n, turns.length); pick = range[1] === "first" ? turns.slice(0, c) : turns.slice(turns.length - c); }
  if (!pick) {
    const refs = ordinalRefs(s);
    if (refs.length) {
      const idx = new Set();
      let missingAt = null;
      for (const r of refs) { if (r === "last") idx.add(turns.length); else if (turns[r - 1]) idx.add(r); else missingAt = r; }
      if (idx.size) pick = [...idx].sort((a, b) => a - b).map((i) => turns[i - 1]);
      else if (missingAt) return { has: true, missing: true, missingAt, count: turns.length, answer: "", ask: null, answerIndex: -1, turn: 0, answers: [] };
    }
  }
  if (!pick || !pick.length) pick = turns.slice(-6);
  const last = pick[pick.length - 1];
  return { has: true, answer: pick.map((t) => t.answer).join("\n\n"), ask: pick.map((t) => t.ask).filter(Boolean).join(" / "), answerIndex: last.answerIndex, turn: last.turn, answers: pick.map((t) => ({ ask: t.ask, answer: t.answer, turn: t.turn })), multiple: pick.length > 1 };
}

/** Does a reply ADDRESS the turn(s) it is grounded in? For a follow-up that names an earlier answer, the reply must
 *  share at least one CONTENT term with that earlier turn — a supported sentence about the WRONG turn or the wrong
 *  topic is not an answer. It does not fact-check (a topical-but-wrong sentence still stands); it catches the
 *  wrong-turn/meta class. Applied only where the turn names an earlier answer, so a causal web answer is never
 *  withheld. Returns { ok, overlap }. Pure. */
export function addressesThread(text, thread) {
  const spoken = contentWords(String(text || ""));
  if (!spoken.length) return { ok: true, overlap: [] };
  const answers = Array.isArray(thread?.answers) && thread.answers.length ? thread.answers : [{ ask: thread?.ask, answer: thread?.answer }];
  const target = new Set();
  for (const a of answers) { for (const w of contentWords(String(a?.answer || ""))) target.add(w); for (const w of contentWords(String(a?.ask || ""))) target.add(w); }
  if (!target.size) return { ok: true, overlap: [] };
  const overlap = [...new Set(spoken.filter((w) => target.has(w)))];
  return { ok: overlap.length > 0, overlap };
}

/** The app-authored note when an ask names an answer that does not exist in the chat ("quote your ninth answer"): a
 *  typed gap — no model, no search — never a silent carry of the wrong turns. */
export function missingAnswerNotice(missing) {
  const n = missing?.count || 0;
  return { kind: "alone", text: `There ${n === 1 ? "is only 1 answer" : `are only ${n} answers`} in this chat, so there is no ${missing?.missingAt ?? "such"} answer to follow. Ask about one of them, or ask something new.` };
}

/** Read this ask in the light of the thread. Never rewrites what the person said (`said`); `query` is what to SEARCH.
 *    kind   "meta" | "carried" | "elliptical" | "standalone"
 *    thread threadOf(prior) — `thread.has` says whether there is an earlier answer to follow
 *    reason why (for the feed and the tests)
 *  `referents`: the chat's referent record (fold-chat-mind.js); `hints`: the language priors (fold-chat-hints.js). */
export function followUp(question, priorMessages, { referents = null, hints = null, rejected = null, lang = null, casts = null } = {}) {
  const said = String(question ?? "").trim();
  const thread = threadOf(priorMessages);
  const base = { said, query: said, kind: "standalone", thread, topic: "", carried: [], reason: "stands-alone" };
  if (!said) return base;
  if (isMeta(said)) return { ...base, kind: "meta", query: said, reason: thread.has ? "meta-with-thread" : "meta-cold" };
  // "go on" / "continue" / "keep going" ask for NEW material and stay on the old path exactly as before (fold-chat-nudge.test.mjs pins it): the Continue button
  // is the model's own re-prompt, and a thread-only reply may not write new material. The gate below must not turn them into an elliptical search.
  if (MORE_NUDGE_RE.test(said)) return base;
  // THE ANAPHORA GATE (fold-chat-anaphora.js; G3, 2026-10-07). Nothing below may carry a referent, a query term or a passage into an ask that does not
  // LEAN on the earlier turn: "why is the sky blue" after a turn about Mount McKinley was searched as "William McKinley Blue Room why is the sky blue",
  // because the ethos `carryTriggers` prior for English lists "the" and "one". A self-contained ask (its own subject and predicate) stands alone — whatever
  // words it shares with the last topic; an undecided language (no closed-class prior) stands alone and says so. Pure code, no model.
  const gate = anaphoraOf(said, { lang, hints });
  if (!gate.carry) return { ...base, gate, reason: gate.decided ? "stands-alone" : "stands-alone-undecided" };
  // 1. a VARIANT of the last topic ("a chewier one", "less sweet"): the person's own words + the topic they were on.
  //    But a PRONOUN ask ("say more about HIM losing the election") is a referent ask: the comparative branch must not
  //    hijack it into a bag of words that never reaches resolveQuestion / the rejected set (RC1).
  const variant = () => {
    if (!thread.topicAsk) return null;
    const topic = topicOf(thread.topicAsk);
    if (!topic) return null;
    const own = contentWords(said).filter((w) => !topic.split(" ").includes(w));
    return { ...base, gate, kind: "elliptical", query: [...own, topic].join(" ").trim(), topic, reason: "elliptical-topic" };
  };
  if (COMPARATIVE_RE.test(said) && gate.kind !== "pronoun") { const v = variant(); if (v) return v; }
  // 2. the referent path: the gate has said the ask points back, so the record's most active referents are carried (and the person can refuse them)
  const r = casts ? resolveCast(said, casts, { rejected, pronoun: pronounOf(said, gate) }) : resolveQuestion(said, referents, { hints, rejected, gate });
  if (r.reason === "carried") {
    const q = searchQueries(r)[0] || said;
    return { ...base, gate, kind: "carried", query: q, carried: r.carried.map((c) => c.surface), reason: "carried-referent" };
  }
  // 3. an elliptical ask with no referent to read it through: the earlier ask's topic words
  { const v = variant(); if (v) return v; }
  return { ...base, gate, reason: "points-back-but-nothing-to-carry" };
}

/** What this turn does, decided before anything is searched or asked. Pure — the live turn and the tests both read it.
 *    search          the query to search, or null when the web is not asked at all
 *    mode            "web" | "thread" | "cold-gap"
 *    modelMay        the model may be asked (grounded in the thread) — ONLY mode "thread"
 *  THE FALSIFIER: a cold meta ask (nothing earlier to follow) is "cold-gap": no search, no model, an app-authored note. */
export function turnPlan(question, priorMessages, opts = {}) {
  // A bare nudge ("well?") never goes to the web as a word. If an earlier ask went unanswered, it IS that ask again (the person's
  // words stay "well?"; `retry` is what is searched and asked); with an answer to follow it is about that answer; with neither it is cold.
  const owed = unansweredAsk(priorMessages);
  if (isNudge(question) || (owed && MORE_NUDGE_RE.test(String(question ?? "")))) {
    const thread = threadOf(priorMessages);
    const base = { said: String(question).trim(), query: String(question).trim(), kind: "standalone", thread, topic: "", carried: [] };
    if (owed) return { ...base, kind: "retry", query: owed, retry: owed, mode: "web", search: owed, modelMay: false, reason: "nudge-retries-unanswered" };
    if (thread.has) return { ...base, kind: "meta", mode: "thread", search: null, modelMay: true, reason: "nudge-with-thread" };
    return { ...base, kind: "meta", mode: "cold-gap", search: null, modelMay: false, reason: "nudge-cold" };
  }
  // A request about the conversation's OWN earlier answers ("compare your first answer", "quote the exact sentence
  // you relied on", "combine your four answers"): follow the thread, do not search its literal words. Only when there
  // IS an earlier answer; with none it falls through to the normal plan (a first-turn ask that mentions "the exact
  // sentence" still searches).
  if (isConversationRef(question)) {
    const rt = referencedThread(priorMessages, question);
    const said = String(question ?? "").trim();
    if (rt.has && !rt.missing) return { said, query: said, kind: "conversation-ref", thread: rt, topic: "", carried: [], mode: "thread", search: null, modelMay: true, reason: "refers-to-earlier-answers" };
    // the ask names an answer that does not exist ("quote your ninth answer"): a typed gap, never a wrong carry
    if (rt.missing) return { said, query: said, kind: "conversation-ref", thread: threadOf(priorMessages), topic: "", carried: [], mode: "cold-gap", search: null, modelMay: false, reason: "refers-to-missing-answer", missing: rt };
  }
  const f = followUp(question, priorMessages, opts);
  if (f.kind === "meta") {
    if (f.thread.has) return { ...f, mode: "thread", search: null, modelMay: true };
    return { ...f, mode: "cold-gap", search: null, modelMay: false };
  }
  return { ...f, mode: "web", search: f.query, modelMay: false };
}

/** The source block a thread-grounded reply is written from: the earlier turn(s), verbatim. A single exchange
 *  (`ask`/`answer`) prints [T1]/[T2]; a conversation-reference with several (`answers`) prints one pair per referenced
 *  turn. Labels are for the fold's use. */
export function threadPrompt(thread, { maxChars = 4000 } = {}) {
  const t = thread || {};
  const pairs = Array.isArray(t.answers) && t.answers.length ? t.answers : [{ ask: t.ask, answer: t.answer, turn: t.turn }];
  const body = pairs.map((p, i) => {
    const at = pairs.length > 1 && p.turn ? ` (turn ${p.turn})` : "";
    return (p.ask ? `[T${2 * i + 1}] What the person asked earlier${at}:\n${String(p.ask).slice(0, 1200)}\n\n` : "")
      + `[T${2 * i + 2}] The answer given${at}:\n${String(p.answer || "").slice(0, maxChars)}`;
  }).join("\n\n");
  return "The person is following up on this conversation, not asking for new facts. Answer ONLY from the earlier turn(s) below: say again, shorten, simplify or explain what the earlier answer already says, in their language, in a few sentences. Add no fact, name, number or source that is not in it. If the earlier turn does not contain what they are asking, say so in one plain sentence. Never mention the labels [T1] [T2], and never claim a website or publication.\n\n"
    + body;
}

/** The app-authored label under a thread-grounded answer — it names the earlier turn(s) it answers from. */
export function threadNotice(thread) {
  const t = thread || {};
  const many = Array.isArray(t.answers) && t.answers.length > 1;
  // a single follow-up quotes the earlier ask; a multi-answer one names the turns instead (joining every ask reads badly)
  const q = !many && t.ask ? String(t.ask).replace(/\s+/g, " ").trim() : "";
  const quote = q.length > THREAD.quoteChars ? q.slice(0, THREAD.quoteChars - 1).trimEnd() + "…" : q;
  const where = many ? `your earlier answers (turns ${t.answers.map((a) => a.turn).join(", ")})` : (t.turn ? `turn ${t.turn}` : "");
  return { kind: "thread", turn: t.turn || null, askIndex: t.askIndex ?? null, answerIndex: t.answerIndex ?? null, text: `Answered from this conversation${where ? ", " + where : ""}${quote ? ` (your question: “${quote}”)` : ""}. No web source was used; the model wrote this from ${many ? "those earlier turns" : "that earlier turn"} alone.` };
}

/** The app-authored note for a follow-up with nothing earlier to follow. No model, no search. */
export function coldFollowUpNotice() {
  return { kind: "alone", text: "There is nothing earlier in this chat to follow up on, and I won't guess. Ask a question and I'll show what the sources say." };
}
