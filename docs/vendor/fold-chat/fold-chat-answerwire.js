// fold-chat-answerwire.js — the seams between the chat (fold-chat.js run()) and the slot-ask pipeline (fold-chat-answerturn.js).
// No DOM, no clock of its own beyond a declared time box, NO MODEL. Everything here is a pure function or takes its network as an argument,
// so the chat's wiring is testable without a browser (fold-chat-answerwire.test.mjs):
//
//   slotTurnWanted(...)       may this turn try the slot pipeline at all? (the chat's kind/mode gate)
//   passagesForTurn(...)      the chat's read passages → the pipeline's passage shape (title, host, lang from what the page said it is)
//   slotDeps(...)             the deps runAnswerTurn needs, over ONE audited fetch (every outbound call is logged and abortable)
//   runSlotTurn(...)          runAnswerTurn under the turn's signal and a declared time box → { handoff } | AnswerTurn@1
//   endsTurn(turn)            does this result end the turn mechanically (no model call)?
//   storeAnswerTurn(turn)     the plain-JSON copy that rides message.answerTurn (survives a reload and a session merge)
//   answerLine(turn)          message.content for a slot turn: the realised answer line, or '' (a gap/contest is drawn, not said)
//   traceFeed(tt, turn, lineEvent)  one feed row per trace line of the turn
//   answerRecordNote(turn)    the short summary the "how this was answered" record carries, and its process line
//
// A slot turn is stored as `authored: "sources"` + `answerTurn` (never `snips`): its words are the source sentence's own words
// (fold-chat-strand.js contentAllowed checks that), so the model never speaks alone on it — it is not called at all.

import { runAnswerTurn, HANDOFF_WHY } from "./fold-chat-answerturn.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { resolveTitlesWikipedia } from "./fold-chat-titles.js";
import { wikiLead, referentPassages } from "./fold-chat-web.js";
import { originateTurn, ORIGIN } from "./fold-chat-origin.js";

import { answerSpan } from "./fold-chat-answerspan.js";
/** Declared, not measured (Constitution II.11). Giver: the WIRE task of the answer-pipeline contract (2026-10-06). */
export const WIRE = Object.freeze({
  giver: "the WIRE task of the answer-pipeline contract (2026-10-06); declared, not measured",
  kinds: Object.freeze(["research", "chat"]),    // the turn kinds a factual ask can have (fold-chat-discourse.js); the task names these two
  timeBoxMs: 25000,                              // a slot turn that has not finished by now is abandoned and the usual path runs (a title lookup + <=3 name lookups + one wider read, each seconds)
  maxStoredChars: 200000,                        // a stored turn bigger than this keeps its answer, gap, contest and trace but drops the void tree's events
});

/** Plain words for the feed when the slot pipeline is abandoned for time (the others live in fold-chat-answerturn.js HANDOFF_WHY). */
export const SLOW_WHY = "The checks were taking too long, so I'm handling this the usual way.";

const isStr = (s) => typeof s === "string" && s.trim() !== "";
const asArr = (a) => (Array.isArray(a) ? a : []);

/** May this turn try the slot pipeline? A research/chat turn that searches the web for the person's own words (follow.mode 'web'), that
 *  is not a live-data ask, in either answer mode (a slot ask ignores the mode: the model is not used). Whether the ask IS a slot ask is
 *  askFrame's call, made inside the pipeline; an ask that is not one hands off with nothing fetched. */
export function slotTurnWanted({ kind, wantWeb, liveHit = null, answerMode = "facing", enabled = false } = {}) {
  return enabled === true && !!wantWeb && !liveHit && WIRE.kinds.includes(kind) && (answerMode === "facing" || answerMode === "snips");
}

/** THE SWITCH. ON by default (2026-10-11, operator decision): a factual one-fact question is answered MECHANICALLY — the model is
 *  only called when the pipeline truly hands off (not a slot ask, a language with no grammar, names that match no page, too slow).
 *  The person can still turn it off with localStorage "fold-chat:answerPipeline" = "off" (anything else, a missing store or a
 *  throwing store is ON: the no-model path is the safe default for a grounded surface). Why it was off by default (2026-10-06):
 *  an adversarial verifier ran the pipeline on the REAL Monarchy-of-the-UK page and it returned a "the sources disagree" contest
 *  between "the British national anthem" and "Legislative power" instead of Charles III; the old path answered the same ask
 *  correctly. Its tests pass on hand-written pages; the real-page corpus (eval/falsify/fixtures/tierB) is the standing falsifier
 *  that would flip it back off. Never throws (storage may be blocked). */
export const SLOT_PIPELINE_KEY = "fold-chat:answerPipeline";
export function slotPipelineOn(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return storage?.getItem?.(SLOT_PIPELINE_KEY) !== "off"; } catch { return true; }
}

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const WIKI_HOST = /^([a-z-]+)\.wikipedia\.org$/i;

/** The chat's read passages ({ ref: "Site — Title", source, url, text, via, snippetOnly… }) in the pipeline's shape. A search engine's
 *  own snippet (snippetOnly) was never a read page, so it is not a witness here. The language is what the host says it is (an
 *  encyclopedia edition's subdomain), else absent — the pipeline then reads the passage with the ask's own grammar. */
export function passagesForTurn(webPassages, { query = null } = {}) {
  const out = [];
  asArr(webPassages).forEach((p, i) => {
    if (!p || typeof p.text !== "string" || !p.text.trim() || p.snippetOnly) return;
    const url = p.url || (/^https?:/i.test(String(p.source || "")) ? p.source : "");
    const ref = String(p.ref || "");
    let title = (ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : ref).trim();
    title = title.replace(/\s+[-–—]\s+Wikipedia$/i, "").trim();       // the relay's own suffix ("Charles III - Wikipedia")
    const host = hostOf(url);
    const w = WIKI_HOST.exec(host);
    out.push({ ref: "S" + (i + 1), title, url, host, ...(w ? { lang: w[1].toLowerCase() } : {}), text: p.text, ...(isStr(query) ? { query } : {}) });
  });
  return out;
}

/** The pipeline's deps over ONE fetch (the chat passes its audited fetch bound to the turn's signal). `onStatus(text)` is told, in
 *  plain words, what is being looked up as it starts (the live status line; never a feed row, so a step is not said twice). */
export function slotDeps({ fetchImpl, signal = null, memo = null, lang = "en", onStatus = null } = {}) {
  const tell = (t) => { if (typeof onStatus === "function") { try { onStatus(t); } catch { /* a status line is never a reason to lose a turn */ } } };
  return {
    fw: functionWordsOf,
    signal,
    resolveTitles: (candidates) => resolveTitlesWikipedia(candidates, { fetchImpl, edition: lang }),
    fetchLead: (query) => { tell(`looking up “${query}”…`); return wikiLead(query, { fetchImpl, lang }); },
    searchPassages: (frame) => { tell(`reading the pages the names in the question lead to…`); return referentPassages(frame, { fetchImpl, memo, lang }); },
  };
}

/** A signal that fires when `parent` does OR after `ms`; `fired()` says which; `done()` clears the timer. */
function boxed(parent, ms) {
  const c = new AbortController();
  let timedOut = false;
  const onParent = () => c.abort();
  if (parent) { if (parent.aborted) c.abort(); else parent.addEventListener("abort", onParent, { once: true }); }
  const t = setTimeout(() => { timedOut = true; c.abort(); }, ms);
  return { signal: c.signal, timedOut: () => timedOut, done: () => { clearTimeout(t); if (parent) parent.removeEventListener("abort", onParent); } };
}

/** `fetchImpl` that also stops when `signal` fires: the time box and Stop cancel the requests in flight, not only the awaiting. */
function bound(fetchImpl, signal) {
  return (url, o = {}) => {
    const own = o.signal;
    if (!own) return fetchImpl(url, { ...o, signal });
    const c = new AbortController();
    const stop = () => c.abort();
    for (const x of [own, signal]) { if (x.aborted) c.abort(); else x.addEventListener("abort", stop, { once: true }); }
    return fetchImpl(url, { ...o, signal: c.signal }).finally(() => { own.removeEventListener("abort", stop); signal.removeEventListener("abort", stop); });
  };
}

/** The slot pipeline for one turn: runAnswerTurn under the turn's signal and a declared time box.
 *  → { handoff: { kind, why } }   today's path runs (not a slot ask, no grammar for the language, names not matched, too slow, …)
 *  → AnswerTurn@1                 an answer, a contest or a typed gap: the turn ends here, no model call
 *  → AnswerTurn@1 with aborted    the person pressed Stop: draw nothing (the chat treats it like any stopped turn) */
export async function runSlotTurn({ question, lang, webPassages, searchQ = null, now = new Date(), fetchImpl, signal = null, memo = null, onStatus = null, timeBoxMs = WIRE.timeBoxMs } = {}) {
  const code = lang && typeof lang === "object" ? lang.code : lang;
  const box = boxed(signal, timeBoxMs);
  try {
    const deps = slotDeps({ fetchImpl: bound(fetchImpl, box.signal), signal: box.signal, memo, lang: isStr(code) && code !== "unknown" ? code : "en", onStatus });
    const turn = await runAnswerTurn({
      question,
      lang: isStr(code) && code !== "unknown" ? { code, by: "function words" } : undefined,
      passages: passagesForTurn(webPassages, { query: searchQ }),
      now, deps,
    });
    if (turn && turn.aborted && box.timedOut() && !(signal && signal.aborted)) return { handoff: { kind: "too_slow", why: SLOW_WHY } };
    // AN ENCYCLOPEDIA IS A POINTER, NEVER A CITATION (fold-chat-origin.js): a row found there is followed to the page its own reference
    // names — read, checked to carry the claim, the path kept — before the card is drawn. Its own time box; past it, pointers.
    if (endsTurn(turn)) {
      const ob = boxed(signal, ORIGIN.turnBoxMs + 2000);
      try {
        const out = await originateTurn(turn, { passages: webPassages, fetchImpl: bound(fetchImpl, ob.signal), memo, signal: ob.signal, boxMs: ORIGIN.turnBoxMs });
        if (signal && signal.aborted) return { aborted: true, answer: null, contest: [], gap: null, trace: [] };
        return withMinimal(out, question);
      } finally { ob.done(); }
    }
    return turn;
  } catch (e) {
    // The pipeline reports its own failures as a handoff; anything that still escapes (a bad dep, a bug) is one too — a slot turn must
    // never cost the person their answer, so today's path runs.
    if (signal && signal.aborted) return { aborted: true, answer: null, contest: [], gap: null, trace: [] };
    return { handoff: { kind: "pipeline_error", why: HANDOFF_WHY.pipeline_error, error: String((e && e.message) || e) } };
  } finally { box.done(); }
}

/** THE SMALLEST SPAN OF THE ANSWER'S OWN SENTENCE (fold-chat-answerspan.js): the slot answer keeps its source sentence verbatim (`answer.row.sentence`); the
 *  card should show the clause that answers first ("Ethanol boils at 78.37 °C") and that sentence one tap away, not the whole sentence by default. The span is
 *  cut from `row.sentence` alone (no previous sentence, so no pronoun is resolved from outside it): every word of it occurs in that sentence, which is
 *  exactly what `contentAllowed` (fold-chat-strand.js answerTurnBacksContent) asks of a line that is not the realised one. null when nothing clears the threshold.
 *  → { text (the mechanical final pass), verbatim (the sentence's own bytes), sentence, rewrite, why, confidence } */
export function minimalOfTurn(turn, question) {
  const row = turn && turn.answer && turn.answer.row;
  if (!row || !isStr(row.sentence) || !row.sentence.trim() || !isStr(question)) return null;
  const r = answerSpan(question, [{ text: row.sentence, ref: row.source && isStr(row.source.title) ? row.source.title : "" }]);
  const s = r.spans[0];
  if (!s) return null;
  return { text: s.shown, verbatim: s.text, sentence: row.sentence, rewrite: s.rewrite || null, why: s.why, confidence: s.confidence };
}

/** The turn with its smallest span attached (`turn.minimal`), when it is an answer with a source sentence. Never throws: a turn is never lost to this. */
function withMinimal(turn, question) {
  try { const m = turn && turn.answer ? minimalOfTurn(turn, question) : null; return m ? { ...turn, minimal: m } : turn; } catch { return turn; }
}

/** Does this result end the turn mechanically? An answer, a contest, or a typed gap — and not a handoff, and not a stopped turn. */
export function endsTurn(turn) {
  if (!turn || typeof turn !== "object" || turn.handoff || turn.aborted) return false;
  return !!(turn.answer || asArr(turn.contest).length || turn.gap);
}

/** message.content for a slot turn: the realised answer line when there is one, else '' (a gap or a contest is drawn by the card). */
export function answerLine(turn) {
  if (turn && turn.minimal && isStr(turn.minimal.text) && turn.minimal.text.trim()) return turn.minimal.text;        // the smallest span first (minimalOfTurn)
  return turn && turn.answer && isStr(turn.answer.text) ? turn.answer.text : "";
}

/** The plain-JSON copy stored on the message. Undefined fields drop out (JSON), and a turn bigger than the declared ceiling sheds the
 *  void tree's raw events (the trace, the answer, the gap and the contest — everything the card draws — always stay). */
export function storeAnswerTurn(turn) {
  if (!turn || typeof turn !== "object") return null;
  const copy = JSON.parse(JSON.stringify(turn));
  if (JSON.stringify(copy).length <= WIRE.maxStoredChars) return copy;
  const shed = (v, depth = 0) => { if (!v || typeof v !== "object" || depth > 12) return; delete v.events; for (const c of asArr(v.children)) shed(c, depth + 1); };
  shed(copy.void);
  return copy;
}

/** One feed row per trace line, in order. `lineEvent` is fold-chat-turnfeed.js's (passed in so this module stays free of the feed).
 *  A line the app could not check is drawn as a warning; every other line is plain information. */
export function traceFeed(tt, turn, lineEvent) {
  const out = [];
  for (const l of asArr(turn && turn.trace)) {
    if (!l || !isStr(l.say)) continue;
    out.push(...lineEvent(tt, l.say, { tone: l.unmeasured ? "warn" : "info", note: isStr(l.detail) ? l.detail : "" }));
  }
  return out;
}

/** What the turn did, in a few fields, for the "how this was answered" record: { outcome, standing?, gap?, searches, notChecked }. */
export function answerRecordNote(turn) {
  const t = turn || {};
  const outcome = t.answer ? "answer" : asArr(t.contest).length ? "contest" : t.gap ? "gap" : "nothing";
  return {
    outcome,
    ...(t.answer ? { standing: t.answer.standing || null, filler: t.answer.filler ? t.answer.filler.text : null } : {}),
    ...(t.gap ? { gap: t.gap.kind || null } : {}),
    searches: asArr(t.searched).filter(isStr).slice(0, 8),
    notChecked: t.answer ? asArr(t.answer.unmeasured).filter(isStr).length : 0,
  };
}

/** The process line the disclosure shows for a slot turn (plain words; the record's own wording, no model named). */
export function answerProcessLine(turn) {
  const n = answerRecordNote(turn);
  const searched = n.searches.length ? ` · searched ${n.searches.map((q) => `“${q}”`).join(", ")}` : "";
  const how = n.outcome === "answer"
    ? `answered from the source's own sentence${n.standing === "survived" ? ", after trying to refute it" : ", but none of the checks could be run"}`
    : n.outcome === "contest" ? "the sources disagree — both are shown, neither is picked"
    : `no answer — ${n.gap || "nothing"} — drawn as a gap`;
  return `no model call · a question with one fact for an answer: ${how}${searched}`;
}
