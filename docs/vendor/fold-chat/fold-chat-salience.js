// fold-chat-salience.js — what the model is handed is only what is SALIENT to THIS ask. Pure: no DOM, no IO, no model, no clock.
//
// "We need to feed the model only things that are salient." (user, 2026-10-06; memory `salient-only-prompt`). A small model is swamped by volume
// and by off-topic text, so every block of the per-message prompt has to earn its place against the CURRENT ask:
//
//   salientSources(passages, terms)    which pages, and which SENTENCES of them (verbatim slices, page order, within a character budget)
//   salientHistory(history, ...)       the earlier exchange, only when the ask CONTINUES the thread; a topic change hands the model none
//   salientSummary(summary, ...)       the discourse summary and the record, only the exchanges that bear on the ask and are not already verbatim
//   askTerms(...)                      the ask's content stems (its words minus the language's closed class) plus the carried referents
//
// FIND/SNIP, NEVER REWRITE: an excerpt is page.text.slice(start, end) pieces joined by " … " — `verifyExcerpt` re-derives it. Verification (the Pivot)
// still runs against everything READ; salience only chooses what the MODEL sees. Caseless, no capital letter is read; matching is stem-folded
// (fold-chat-ground.js tokenize/stemOf). A language with no closed-class prior has no content/function split: every selector then returns the input
// UNCHANGED with `measured: false` — a typed gap, never a guess.
//
// DECLARED, not measured (Constitution II.11) in SALIENCE below; giver: the author, 2026-10-06, sized from a real capture (3 pages x ~3,000 chars, 11,292 chars
// for a one-line question). The offline recall check (eval/pivot/salience.mjs) reports how often the budget keeps the answer.

import { sentencesWithOffsets } from "./fold-chat-impression.js";
import * as ground from "./fold-chat-ground.js";

export const SALIENCE = Object.freeze({
  giver: "the author, 2026-10-06; declared, not measured (II.11)",
  maxSources: 3,            // pages the model may see
  sourceChars: 1400,        // excerpt budget per page
  totalChars: 3600,         // excerpt budget across pages
  relativeFloor: 0.4,       // a page must score at least this fraction of the best page to be shown
  neighbours: 1,            // sentences of context on each side of a matched one, while the budget lasts
  historyExchanges: 2,      // earlier exchanges carried verbatim when the ask continues the thread
  summaryExchanges: 3,      // older exchanges that bear on the ask, named in the discourse summary
});

const stemOf = (t) => (ground.stemOf ? ground.stemOf(t) : t);

// Question words and request-frame words name nothing: "How tall is X?" and "How does Y work?" share "how", and that must not read as one topic.
// The language's closed class (functionWordsOf) lacks them, so they are added here. English, DECLARED (II.11; giver: the author, 2026-10-06 — found by
// the S3 offline test, where a photosynthesis ask "continued" an Eiffel thread through the word "how").
const FRAME = Object.freeze(new Set(["how", "why", "when", "where", "who", "whom", "whose", "which", "what", "tell", "show", "give", "explain", "describe", "say", "know", "find", "ask", "please", "pls", "thanks", "thank", "ok", "okay"]));

/** The ask's content stems: its words, minus the language's closed class and the frame words, stem-folded. `fw` null = no prior = not measurable. */
export function termsOf(text, fw) {
  if (!fw) return null;
  return new Set(ground.tokenize(String(text ?? "")).filter((t) => !fw.has(t) && !FRAME.has(t) && t.length > 1).map(stemOf));
}

/** The terms of this turn: the person's words, what is SEARCHED (the carried referent has been resolved into it), and the carried referents' own names. */
export function askTerms({ question = "", searchQ = "", carried = [] } = {}, fw) {
  if (!fw) return null;
  const all = new Set();
  for (const t of [question, searchQ, ...(carried || [])]) for (const s of termsOf(t, fw) || []) all.add(s);
  return all;
}

const stemsOfText = (text) => new Set(ground.tokenize(String(text ?? "")).map(stemOf));
const titleOf = (p) => { const ref = String(p?.ref ?? ""); return ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : ref; };

/** The sentences of one page that bear on the terms, as verbatim slices. Returns null when nothing in the page (title or text) matches. */
export function salientExcerpt(passage, terms, { chars = SALIENCE.sourceChars, neighbours = SALIENCE.neighbours } = {}) {
  const text = String(passage?.text ?? "");
  const sents = sentencesWithOffsets(text);
  const titleHits = [...stemsOfText(titleOf(passage))].filter((s) => terms.has(s)).length;
  if (!sents.length) return null;
  const scored = sents.map((s, i) => { const st = stemsOfText(s.text); const matched = [...terms].filter((t) => st.has(t)); return { i, s, score: matched.length, matched }; });
  const best = Math.max(0, ...scored.map((x) => x.score));
  if (!titleHits && !best) return null;
  const budget = { left: chars };
  const keep = new Set();
  const take = (i) => { if (i < 0 || i >= sents.length || keep.has(i)) return false; const len = sents[i].end - sents[i].start + 3; if (len > budget.left && keep.size) return false; keep.add(i); budget.left -= len; return true; };
  // the lead defines what the page is about: kept first when anything in the page bears on the ask
  take(0);
  // then the matched sentences, best first (earlier first on a tie)
  for (const x of [...scored].filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i)) take(x.i);
  // then the neighbours of what is kept, while the budget lasts
  for (let k = 1; k <= neighbours; k++) for (const i of [...keep]) { take(i - k); take(i + k); }
  const idx = [...keep].sort((a, b) => a - b);
  const slices = [];
  for (const i of idx) slices.push({ start: sents[i].start, end: sents[i].end });
  const parts = []; let prev = -2;
  for (let n = 0; n < idx.length; n++) { if (idx[n] !== prev + 1 && n > 0) parts.push("…"); parts.push(text.slice(slices[n].start, slices[n].end)); prev = idx[n]; }
  const matchedTerms = new Set(scored.flatMap((x) => x.matched));
  return { text: parts.join(" "), slices, score: best + titleHits * 2, titleHits, best, matched: [...matchedTerms], sentences: { kept: idx.length, of: sents.length } };
}

/** Re-derive an excerpt: its slices are inside the page, in page order, and its text is exactly those slices (joined, "…" marking a gap). The check on the selector itself. */
export function verifyExcerpt(passage, ex) {
  const text = String(passage?.text ?? "");
  const slices = ex?.slices || [];
  let at = -1;
  for (const s of slices) { if (!(s.start > at - 1 && s.start >= at) || s.end > text.length || s.end <= s.start) return false; at = s.end; }
  const strip = (x) => String(x).replace(/\u2026/g, "").replace(/\s+/g, "");
  return !!ex && strip(ex.text) === strip(slices.map((s) => text.slice(s.start, s.end)).join(""));
}

/**
 * salientSources(passages, terms, opts) → { passages, dropped, measured, chars }
 *   passages  the pages worth showing, ranked, each as { ...page, text: <verbatim excerpt>, full: <the whole page>, excerpt }
 *   dropped   [{ ref, why }] pages that do not bear on the ask or fell below the floor / the page limit
 * With `terms` null (no closed-class prior) nothing is selected: the input is returned unchanged and `measured` is false.
 */
export function salientSources(passages, terms, opts = {}) {
  const o = { ...SALIENCE, ...opts };
  const list = Array.isArray(passages) ? passages : [];
  if (!terms) return { passages: list, dropped: [], measured: false, chars: list.reduce((n, p) => n + String(p?.text ?? "").length, 0) };
  const scored = []; const dropped = [];
  for (const p of list) {
    const ex = salientExcerpt(p, terms, { chars: o.sourceChars, neighbours: o.neighbours });
    if (!ex) { dropped.push({ ref: String(p?.ref ?? ""), why: "no word of the ask" }); continue; }
    scored.push({ p, ex });
  }
  scored.sort((a, b) => b.ex.score - a.ex.score);
  const top = scored[0]?.ex.score || 0;
  const out = []; let used = 0;
  for (const { p, ex } of scored) {
    if (ex.score < top * o.relativeFloor) { dropped.push({ ref: String(p.ref ?? ""), why: "bears far less than the best page" }); continue; }
    if (out.length >= o.maxSources) { dropped.push({ ref: String(p.ref ?? ""), why: "page limit" }); continue; }
    if (used + ex.text.length > o.totalChars && out.length) { dropped.push({ ref: String(p.ref ?? ""), why: "character budget" }); continue; }
    used += ex.text.length; out.push({ ...p, text: ex.text, full: p.text, excerpt: ex });
  }
  return { passages: out, dropped, measured: true, chars: used };
}

/**
 * Does this ask CONTINUE the thread? A follow-up the turn plan already read as such (carried / elliptical / meta / retry / move) does. A standalone ask
 * does not when the plan carries the anaphora verdict (`follow.gate`, G3); a plan without one continues only if the ask shares a content stem with the
 * previous exchange (the person's last question and the fold's last answer). Otherwise it is a NEW topic.
 */
export function continuesThread({ follow = null, terms = null, lastExchange = null } = {}) {
  if (follow && follow.kind && follow.kind !== "standalone") return true;
  // THE ANAPHORA GATE (fold-chat-anaphora.js, G3): when the turn plan carries a verdict, the verdict is final. A SHARED WORD is not a thread — "why is the
  // sky blue" shares "blue" with a turn about the Blue Room, and was handed that turn's history and summary. Only a plan with no verdict (an older caller)
  // falls through to the shared-stem test below.
  if (follow && follow.gate) return false;
  if (!terms || !lastExchange) return false;
  const last = stemsOfText(`${lastExchange.ask || ""} ${lastExchange.said || ""}`);
  return [...terms].some((t) => last.has(t));
}

/** The earlier messages the model may see: the last `n` exchanges verbatim when the ask continues the thread, else none. */
export function salientHistory(history, { continues = false, n = SALIENCE.historyExchanges } = {}) {
  if (!continues) return [];
  const list = Array.isArray(history) ? history : [];
  return list.slice(-Math.max(0, n) * 2);
}

/**
 * The discourse summary the prompt projects: on a topic change, NOTHING (the old thread is not handed over); when continuing, only the OLDER exchanges that
 * bear on the ask and are not already verbatim in the history window, as a rebuilt flow line; entities and records are kept only if a term of the ask or of a
 * kept exchange names them. `emptySummary` is the fold's own empty value. `exchanges` come from fold-chat-exchange.js exchangesOf.
 */
export function salientSummary(summary, { continues = false, terms = null, exchanges = [], verbatim = SALIENCE.historyExchanges, flowOf = null, empty = null } = {}) {
  if (!summary) return summary;
  if (!continues) return empty ?? { ...summary, topic: null, flow: null, entities: [], context: null, records: [], folds: [] };
  const older = (exchanges || []).slice(0, Math.max(0, (exchanges || []).length - verbatim));
  const bear = terms ? older.filter((e) => { const st = stemsOfText(`${e.ask} ${e.said || ""}`); return [...terms].some((t) => st.has(t)); }) : older;
  const kept = bear.slice(-SALIENCE.summaryExchanges);
  const flow = kept.length && typeof flowOf === "function" ? flowOf(kept) : null;
  const names = (arr) => (arr || []).filter((x) => { if (!terms) return true; const st = stemsOfText(String(x)); return [...terms].some((t) => st.has(t)); });
  return { ...summary, topic: summary.topic, flow, entities: names(summary.entities), context: summary.context, records: (summary.records || []).filter((r) => { if (!terms) return true; const st = stemsOfText(String(r?.gist || "")); return [...terms].some((t) => st.has(t)); }) };
}

/** THE SWITCH (pre-registered A/B for S4). localStorage "fold-chat:salience": "off" turns it off, "on" turns it on; absent = `SALIENCE_DEFAULT`. Never throws. */
export const SALIENCE_KEY = "fold-chat:salience";
export const SALIENCE_DEFAULT = false;   // OFF until it stands: S4 (30% < 50%) and S5 (2 of 3 follow-ups fell back to the sources) failed — eval/pivot/PREREG.md Amendment 4 RESULTS
export function salienceEnabled(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { const v = storage?.getItem?.(SALIENCE_KEY); return v === "on" ? true : v === "off" ? false : SALIENCE_DEFAULT; } catch { return SALIENCE_DEFAULT; }
}
