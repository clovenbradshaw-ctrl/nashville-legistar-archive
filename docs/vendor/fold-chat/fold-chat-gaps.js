// fold-chat-gaps.js — what the app says, in its own voice, when a turn has no
// answer to show or no source to stand on. Pure: no DOM, no IO, no model.
//
// The model is the mouth, not the narrator of the fold's own work (Constitution
// II.9; III.3 the absent test: a gap is DRAWN, as a typed mark, never said as
// prose by the assistant). Four things the model used to improvise are app-
// authored here, from facts the app holds:
//
//   • WHAT WAS SEARCHED — `searchAttempts` / `unreachedGap` read the real search
//     trace (which engines answered or failed, why, which pages could not be
//     read). The model is no longer asked to "name what you tried"; it invented
//     queries it never ran ("using keywords like 'easy banana bread'").
//   • LIVE DATA — `liveAsk` spots asks whose answer is a live feed (weather, a
//     price, a score, today's news). With nothing read that grounds an answer,
//     the turn is a typed gap ("live data — nothing reachable"), never a guess.
//   • THE UNSOURCED POLICY — `UNSOURCED_ANSWERS`, one named constant, and
//     `unsourcedPlan`, which says what the turn does when search reaches nothing.
//   • A BLANK OR FAILED TURN — `emptyNotice` / `errorNotice`: a turn that wrote
//     nothing or died is always drawn as an honest typed note with a retry.

// ── THE RULE: THE MODEL NEVER SPEAKS ALONE ────────────────────────────────
// A turn with no sources produces NO model-written answer. It produces only an app-authored,
// typed gap (what was searched, what failed — drawn from the real trace). The earlier 'label'
// branch ("answer from general knowledge, labelled from the model") is RETIRED by product
// decision: UNSOURCED_ANSWERS has one value, kept as a named constant so the policy is
// greppable in one place. A live-data ask is a gap likewise (a model's weather is a guess).
export const UNSOURCED_ANSWERS = "refuse";

/** What a turn does when search reached nothing readable: never ask the model. { callModel:false, gap } */
export function unsourcedPlan(_policy = UNSOURCED_ANSWERS, { live = false } = {}) {
  return { callModel: false, sourceBlock: null, standing: null, gap: live ? "live" : "unreached", policy: UNSOURCED_ANSWERS };
}

// Which KINDS of turn may have the model write WITHOUT a source (they search nothing, so they have none):
// a greeting, arithmetic, a translation of the person's own text, a programming how-to, personal writing.
// This is an OPEN PRODUCT QUESTION the user has not answered, so the default is that NONE may: each is
// answered by the app alone —
//   smalltalk  a fixed app-authored line
//   compute    a mechanical result card (the fold's evaluator, no model wording)
//   generate / compose / code / transform   an app-authored note: there are no sources for this kind of ask
// ONE LINE to change: list the kinds the model may answer alone, e.g. ["smalltalk", "compute"].
export const ALONE_KINDS = Object.freeze([]);
export const modelSpeaksAlone = (kind) => ALONE_KINDS.includes(kind);

import { SELF_LINE, NO_LOOKUP_LINE } from "./fold-chat-self.js";
import { genVoid, genVoidLine } from "./fold-chat-genvoid.js";
export const SMALLTALK_LINE = "Ask me something and I'll show you what the sources say.";
const KIND_WORDS = { generate: "creative writing", compose: "personal writing", code: "a programming question", transform: "a transformation of your own text", compute: "a calculation", advice: "advice" };

/** The app-authored turn for a kind the model may not answer alone: { notice } and/or a computed card on the record. */
export function aloneTurn(kind, { outputType = null, hasMaterial = false, question = "" } = {}) {
  // A WRITING request the model may not answer alone: the gap names the thing asked for and what would unblock it (fold-chat-genvoid.js), drawn as record.void.
  if (outputType && (kind === "generate" || kind === "compose")) {
    const g = genVoid({ outputType, webPassages: [], hasMaterial, barred: "alone", question });
    if (!g.ok) return { notice: { kind: "no-sources", text: g.notice.text }, void: g.void };
  }
  if (kind === "smalltalk") return { notice: { kind: "alone", text: SMALLTALK_LINE } };
  if (kind === "self") return { notice: { kind: "alone", text: SELF_LINE } };          // the fold's own words about itself (fold-chat-self.js)
  if (kind === "nolookup") return { notice: { kind: "alone", text: NO_LOOKUP_LINE } };   // the ask had nothing to look up, so nothing was searched
  if (kind === "compute") return { notice: null };            // the result card IS the answer (record.computed)
  return { notice: { kind: "no-sources", text: `There are no sources for this kind of ask (${KIND_WORDS[kind] || kind}), and the fold does not write without sources, so nothing was written. Ask it as a question and it will show what the sources say.` } };
}

/** The source block for a turn that DID read sources (one place, so the wording is tested). */
export function sourcesPrompt(passages) {
  const list = Array.isArray(passages) ? passages : [];
  return "The sources below were read for this turn. Every factual claim must come from them; write from them where they cover it, and where they do not say plainly what is missing. If the sources do not answer what was asked (they are about something else, or are only an error or a verification page), say so in one plain sentence instead of answering from them. Never claim a source you cannot show, never name a website, publication or organisation that is not in them, and never fall back on your own memory. The labels [W1], [W2] … are for the fold's use only: do not write them, do not mention source numbers, and do not say \"according to the sources\" — just write the answer. The sources may be in another language; write your answer in the language the person wrote in.\n\n"
    + list.map((p, i) => `[W${i + 1}] ${p.ref}\n${String(p.text ?? "").slice(0, 4000)}`).join("\n\n");
}

// ── what the search actually did ───────────────────────────────────────────
const SCOPE_NAME = { web: "Web", wikipedia: "Wikipedia", github: "GitHub", archive: "Internet Archive", openalex: "OpenAlex", crossref: "Crossref" };
export const scopeName = (s) => SCOPE_NAME[s] || String(s || "search");

/** Read the web trace (`searchWeb(...).trace`) into plain facts:
 *  { attempts:[{scope, name, engine, q, ok, n, why}], queries, readOk, readFailed, snippets, webDown, failures }
 *  Entries that are not a search (the router's pick, the topic gate, page reads) are counted, not listed as engines. */
export function searchAttempts(trace) {
  const list = Array.isArray(trace) ? trace : [];
  const attempts = [], seen = new Set();
  const queries = [];
  let readOk = 0, readFailed = 0, snippets = 0, webDown = false;
  for (const w of list) {
    if (!w || typeof w !== "object") continue;
    if (w.read) { if (w.ok === false) readFailed++; else readOk++; continue; }
    if (w.snippet) { snippets++; continue; }
    if (!w.scope) continue;
    if (w.scope === "route") { if (w.webDown) webDown = true; continue; }
    if (w.scope === "topic") continue;
    const ok = w.ok !== false;
    const key = [w.scope, w.engine || "", ok, w.why || "", w.q || ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push({ scope: w.scope, name: scopeName(w.scope), engine: w.engine || null, q: w.q || null, ok, n: typeof w.n === "number" ? w.n : null, why: ok ? null : String(w.why || "no answer").slice(0, 160) });
    if (w.q && !queries.includes(w.q)) queries.push(w.q);
  }
  return { attempts, queries: queries.slice(0, 6), readOk, readFailed, snippets, webDown, failures: attempts.filter((a) => !a.ok).length };
}

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/** One sentence, composed from the facts above and nothing else, saying what was searched.
 *  Never names a query, engine or failure the trace does not hold. */
export function searchSummary(facts, question = "") {
  const f = facts && facts.attempts ? facts : searchAttempts(facts);
  if (!f.attempts.length) return f.readFailed ? `No search result could be read (${f.readFailed} page${f.readFailed === 1 ? "" : "s"} failed).` : "No search ran, or it returned no record of what it did.";
  const bits = f.attempts.slice(0, 6).map((a) => {
    const who = a.engine && a.engine !== a.name ? `${a.name} (${a.engine})` : a.name;
    return a.ok ? `${who} returned ${a.n ?? 0} result${a.n === 1 ? "" : "s"}` : `${who} failed — ${String(a.why).replace(/[.\s]+$/, "")}`;
  });
  let s = `Searched for “${clip(question || f.queries[0] || "", 80)}”: ${bits.join("; ")}.`;
  if (f.readFailed) s += ` ${f.readFailed} page${f.readFailed === 1 ? "" : "s"} found but could not be read.`;
  else if (!f.readOk) s += " Nothing readable came back.";
  return s;
}

/** The typed 'unreached' gap, app-authored from the trace. Same shape voidReport
 *  produces (`tried` stays the deduped engine names) plus `attempts` and `note`. */
export function unreachedGap(trace, question) {
  const f = searchAttempts(trace);
  return {
    kind: "unreached",
    counts: { sentences: 0, grounded: 0 },
    read: [],
    tried: [...new Set(f.attempts.map((a) => a.engine || a.name))].slice(0, 5),
    attempts: f.attempts.slice(0, 8),
    readFailed: f.readFailed,
    note: searchSummary(f, question),
    question: clip(question, 90),
    closeBy: ["try the question again", "attach the document you are working from", "rephrase it with a name or a place the search can find"],
  };
}

/** The typed 'live' gap: a live-data ask with nothing reachable that establishes an answer.
 *  `read` is what WAS read (it did not establish it); `what` is weather / price / score / news. */
export function liveGap(trace, question, { read = [], what = null } = {}) {
  const f = searchAttempts(trace);
  return {
    kind: "live",
    what,
    counts: { sentences: 0, grounded: 0 },
    read: (Array.isArray(read) ? read : []).slice(0, 6),
    tried: [...new Set(f.attempts.map((a) => a.engine || a.name))].slice(0, 5),
    attempts: f.attempts.slice(0, 8),
    note: (what ? `This asks for ${LIVE_NOUN[what] || "live data"}, which changes by the minute. ` : "This asks for live data. ") + (read.length ? "The pages that were read are snapshots and none of them established an answer." : searchSummary(f, question)),
    question: clip(question, 90),
    closeBy: ["open a live source directly (a weather service, a market page, a score site, a news site)", "try again later"],
  };
}
const LIVE_NOUN = { weather: "the weather right now", price: "a price or rate right now", score: "a score or standing right now", news: "today's news" };

// ── live-data asks ─────────────────────────────────────────────────────────
// DECLARED vocabulary (II.11) — what makes an ask a live feed, per language. A false "live" costs a typed
// gap where an answer was possible; so each pattern needs the live noun AND not an explanatory/historical shape.
const EXPLAINS = /\b(?:how (?:do|does|is|are|did)|why (?:do|does|is|are|did)|what causes|what is (?:a|an|the (?:definition|meaning))|define|definition|history of|explain|climate|average|typical|annual|seasonal|best time|season|difference between|forecasting (?:is|works)|formed?)\b/i;
const LIVE_RULES = [
  ["weather", /\b(?:weather|forecast|temperature|will it (?:rain|snow)|is it (?:raining|snowing|cold|hot|sunny)|humidity|wind speed|uv index)\b|(?:clima en|el tiempo (?:hoy|en)|pronóstico del tiempo|temperatura (?:hoy|en|actual)|météo|meteo|prévisions météo|température (?:aujourd|à|actuelle)|wetter|wettervorhersage|temperatur (?:heute|in)|previsão do tempo|tempo (?:hoje|em)|погод[аыу]|прогноз погоды|температура (?:сегодня|в)|天气|天氣|气温|氣溫|天気|気温|الطقس|درجة الحرارة|मौसम)/iu],
  ["price", /\b(?:stock price|share price|price of (?:bitcoin|btc|ethereum|eth|gold|silver|oil|crude|a barrel|[a-z]{2,5} (?:stock|shares))|(?:bitcoin|btc|ethereum|eth|dogecoin|gold|silver|oil|gas) price|exchange rate|how much is (?:a |one |1 )?(?:bitcoin|btc|ethereum|eth|gold|dollar|euro|pound)|(?:usd|eur|gbp|jpy|cad|aud|inr|cny|chf) (?:to|in) (?:usd|eur|gbp|jpy|cad|aud|inr|cny|chf)|stock market|(?:s&p|dow jones|nasdaq)\b)|(?:precio del (?:bitcoin|oro|petróleo|dólar)|tipo de cambio|cotización|cours (?:du|de l')(?:bitcoin|or|pétrole|dollar)|taux de change|wechselkurs|bitcoin-kurs|курс (?:доллара|биткоина|евро|рубля)|股价|股價|汇率|匯率|比特币价格|為替レート|سعر)/iu],
  ["score", /\b(?:live scores?|score of (?:the|today'?s|tonight'?s|last night'?s)|what'?s the score|who'?s winning|who is winning|who won (?:the (?:game|match) )?(?:last night|yesterday|today|tonight)|current standings|league table|standings)\b|(?:marcador|resultado del partido de (?:hoy|anoche)|score en direct|résultat du match d'hier|spielstand|ergebnis von gestern|счёт матча|счет матча|比分|赛况|賽況|試合結果)/iu],
  ["news", /\b(?:news (?:today|now|tonight)|today'?s (?:news|headlines)|latest news|breaking news|top headlines|headlines|what'?s happening (?:today|now|right now|in the world))\b|(?:noticias de hoy|últimas noticias|actualités|dernières nouvelles|infos du jour|nachrichten heute|aktuelle nachrichten|новости (?:сегодня|сейчас)|последние новости|今日新闻|今日新聞|最新消息|新闻头条|ニュース|أخبار اليوم)/iu],
];

/** Is this ask for a live feed? { live:true, what } or null. A past year in the ask (a 2017 price) is history, not live. */
export function liveAsk(question, { year = new Date().getFullYear() } = {}) {
  const q = String(question ?? "");
  if (!q.trim() || q.length > 300) return null;
  if (EXPLAINS.test(q)) return null;
  const years = [...q.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (years.some((y) => y < year)) return null;
  for (const [what, re] of LIVE_RULES) if (re.test(q)) return { live: true, what };
  return null;
}

// ── a blank or failed turn is never blank ──────────────────────────────────
/** The note for a turn whose model wrote no text at all. */
export function emptyNotice({ tokens = 0, model = "", why = "" } = {}) {
  return {
    kind: "empty",
    retry: true,
    text: `The model${model ? " (" + model + ")" : ""} returned no text for this turn${tokens ? ` (${tokens} token${tokens === 1 ? "" : "s"} streamed, none usable)` : ""}${why ? " — " + why : ""}. Nothing was written, and nothing here is an answer. Try again.`,
  };
}

/** The note for a turn that died before an answer: the bridge's own words, typed. */
export function errorNotice(err) {
  const msg = String(err?.message || err || "unknown error").replace(/^error:\s*/i, "").trim();
  const status = err && typeof err.status === "number" ? err.status : null;
  let text;
  // A failure INSIDE the tab (the engine's CDN import, the weights download, the GPU) is not a bridge failure, even when
  // its message says "Failed to fetch": branch on where it happened first, and never run the bridge regex on it.
  const inTab = err && typeof err === "object" && err.kind !== "timeout" && (err.place === "tab" || ["no-gpu", "loader", "load-failed", "generate-failed", "declined"].includes(err.kind));
  if (inTab) text = `The in-tab model could not ${err.kind === "generate-failed" || err.kind === "declined" ? "answer" : "load"} (${msg}). Nothing was written. Retry, pick a smaller model, or use the Fold's own server (\`npm run serve\`).`;
  else if (status === 504 || /timed out|timeout/i.test(msg)) text = `The turn timed out before the model finished (${msg}). Nothing was written.`;
  else if (status === 429 || /429|rate.?limit|too many requests/i.test(msg)) text = `The model is rate-limited right now (${msg}). Nothing was written.`;
  else if (status === 0 || /unreachable|failed to fetch|networkerror|load failed/i.test(msg)) text = `The bridge could not be reached (${msg}). Nothing was written.`;
  else if (status === 400 || /refus|sealed|gate/i.test(msg)) text = `The request was refused (${msg}). Nothing was written.`;
  else text = `The turn failed: ${msg}. Nothing was written.`;
  return { kind: "error", retry: true, text };
}

/** The model was asked and did not answer (a gate said no, the bridge failed, the stream died) — but the turn HAS read
 *  sources. It never ends in nothing: the app draws the sources-only strand instead and says so, in its own words
 *  (this note is app-authored; the gate's text is quoted, not paraphrased). The note rides `message.notices`;
 *  `gate` carries the gate's own words and `fellBackFrom` the mode the turn was in. Pure. */
export function declinedFallbackNotice(err, { from = "facing" } = {}) {
  const raw = String(err?.message || err || "unknown error").replace(/^error:\s*/i, "").replace(/\s+/g, " ").trim();
  const words = raw.length > 320 ? raw.slice(0, 319).trimEnd() + "\u2026" : raw;
  const status = err && typeof err.status === "number" ? err.status : null;
  const gate = status === 403 || /safety|ethics|\bgate\b|refused by/i.test(raw);
  const text = gate
    ? `The model declined this request (the safety gate said: ${words}). Showing what the sources say instead.`
    : `The model could not answer (${words}). Showing what the sources say instead.`;
  return { kind: "declined", retry: true, text, gate: words, status, fellBackFrom: from };
}

/** No model can be reached at all (the bridge is not running, or it serves nothing) — but the turn HAS read sources, so it
 *  shows the sources-only strand and says so. App-authored, kind 'fold' (it is a note of the fold's, not a gate speaking).
 *  `why` is noModelWhy()'s { code, text } (fold-chat-loaded.js). Pure. */
export function noModelFallbackNotice(why, { from = "facing" } = {}) {
  const code = why?.code || "bridge-down";
  const text = code === "bridge-down"
    ? "No model is reachable (no bridge answered and this tab has none loaded), so this shows what the sources say. Run `npm run serve` (the Fold's own server) or use the in-tab model for written answers."
    : `No model is available (${String(why?.text || "none is served").replace(/\s+/g, " ").trim()}), so this shows what the sources say.`;
  return { kind: "fold", retry: true, text, why: code, fellBackFrom: from };
}

/** A gap drawn as the whole of a turn (no answer text) — the line the facing page shows where the answer would be. */
export function gapAnswerLine(v) {
  if (!v) return "";
  if (v.kind === "generate") return genVoidLine(v);     // "No essay was written." — the reason ("I can't write the essay: …") is the gap block's own note (fold-chat-genvoid.js)
  if (v.kind === "unreached") return "No answer was written: no source could be read to write one from.";
  if (v.kind === "live") return "No answer was written: this needs live data and none was reachable.";
  return "";
}
