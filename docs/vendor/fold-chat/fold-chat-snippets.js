// fold-chat-snippets.js — the librarian reads the catalog card before fetching the book.
//
// A search engine's results are an INDEX: each entry carries the sentence around the hit. For many
// questions the answer is already on the card, and opening the page (a fetch, a parse, 1–2 s, a
// chance of a refusal) buys nothing. This module decides — mechanically, in any language — when the
// cards are enough, and hands them over as passages labelled as snippets (never as read pages).
//
// THE RULE (A2 in experiments/source-routing/RESULTS.md; frozen before the holdout was run):
//   · a BACKGROUND of every card this tab has seen, per language, tells which words are common —
//     no stoplist, no capitals; a word's commonness is measured, not listed;
//   · the question's RARE words are the ones that say what it is about;
//   · an ON-TOPIC card carries at least `topicFrac` of those rare words;
//   · an AGREED TERM is a word, not in the question and rare in the background, that on-topic cards
//     from at least `minHosts` DISTINCT sites share — independent sources on one point;
//   · with an agreed term the cards are sufficient and the cards that carry it are handed over.
// It knows nothing about what the answer IS, only that independent sites on the same topic agree on a
// rare word. A language with too little background (or an undetectable one) ABSTAINS: the pages are
// read as before. Learning: `learnBackground` is fed each SERP AFTER it is judged, so a search is
// never judged against itself.
//
// Measured, not assumed: the rule ships OFF (`snippetFirst: false`) until the holdout in RESULTS.md says so.
//
// `rule: "v4"` is an OPT-IN EXPERIMENT (function-word priors from the khora, so it can speak in a language the tab has never
// searched): safe where it speaks (16/16 right, 0/8 controls at k=0) but it failed its pre-registered coverage and control
// criteria (RESULTS.md, "Outcome of v4"), so nothing enables it. v2 (chains + a permutation null) and v3 were falsified (0 fires
// on 0/60 answerable questions) and removed; history keeps them (872392c).

import { segments, fold } from "./fold-chat-mind.js";
import { detectLang } from "./fold-chat-lang.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const DECLARED = Object.freeze({
  minHosts: 3,            // independent sites that must share the agreed term
  rareTerm: 0.02,         // an agreed term must be in at most this share of background cards
  rareQuestionWord: 0.10, // a question word is "rare" (says what it is about) at most this share
  topicFrac: 0.7,         // share of the question's rare words an on-topic card must carry
  minBackground: 80,      // cards of background a language needs before the rule will speak
  minSnippetChars: 40,    // a card shorter than this says nothing alone
});

const wordsOf = (s) => segments(s).map((x) => fold(x.text));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return String(u); } };
const cardsOf = (results) => (results || []).filter((r) => r && r.url && String(r.snippet || "").length >= DECLARED.minSnippetChars)
  .map((r) => { const seq = wordsOf((r.title || "") + " " + (r.snippet || "")); return { r, host: hostOf(r.url), seq, w: new Set(seq) }; });

/** The tab's memory of what is common: per language, how many cards and in how many each word stood. */
export function makeBackground(seed = null) {
  const bg = { byLang: new Map() };
  if (seed && typeof seed === "object") for (const [lang, v] of Object.entries(seed)) bg.byLang.set(lang, { n: v.n | 0, df: new Map(Object.entries(v.df || {})) });
  return bg;
}
export const languageOf = (question, results) => detectLang([question, ...(results || []).map((r) => (r && ((r.title || "") + " " + (r.snippet || "")))).filter(Boolean)].join(" ")).lang;

/** Feed a judged SERP into the background (never before it is judged). */
export function learnBackground(bg, lang, results) {
  if (!bg || !lang || lang === "unknown") return;
  const b = bg.byLang.get(lang) || { n: 0, df: new Map() };
  for (const c of cardsOf(results)) { b.n++; for (const w of c.w) b.df.set(w, (b.df.get(w) || 0) + 1); }
  if (b.df.size > 60000) for (const [w, n] of b.df) if (n < 2) b.df.delete(w);   // bound the memory
  bg.byLang.set(lang, b);
}
/** The background as plain JSON (words seen at least twice), for shipping a seed. */
export function exportBackground(bg, { minDf = 2 } = {}) {
  const out = {};
  for (const [lang, b] of bg.byLang) out[lang] = { n: b.n, df: Object.fromEntries([...b.df].filter(([, n]) => n >= minDf)) };
  return out;
}

// Frozen before any v2 data was collected — experiments/source-routing/RESULTS.md, "v2 of the snippet rule".
const fwCache = new Map();
/** The function words of a language (Set), or null when the khora has no committed prior for it. */
export function functionWordsOf(lang) {
  if (!FUNCTION_WORDS[lang]) return null;
  if (!fwCache.has(lang)) fwCache.set(lang, new Set(FUNCTION_WORDS[lang]));
  return fwCache.get(lang);
}

/**
 * @returns { sufficient, abstained, why, term, lang, covering:[result], hosts }
 */
export function snippetsSufficient(results = [], question = "", { background = null, lang = null, rule = "v1", ...over } = {}) {
  if (rule === "v4") return snippetsSufficientV4(results, question, { background, lang, ...over });
  const D = { ...DECLARED, ...over };
  const L = lang || languageOf(question, results);
  const none = (why, extra = {}) => ({ sufficient: false, abstained: false, why, term: null, lang: L, covering: [], hosts: 0, ...extra });
  const b = background && background.byLang.get(L);
  if (!b || b.n < D.minBackground) return none(`no background for ${L}: ${b ? b.n : 0} of ${D.minBackground} cards — reading the pages instead`, { abstained: true });
  const cards = cardsOf(results);
  if (new Set(cards.map((c) => c.host)).size < D.minHosts) return none("too few cards from distinct sites");
  const share = (w) => (b.df.get(w) || 0) / b.n;
  const q = [...new Set(wordsOf(question))];
  const qRare = q.filter((w) => share(w) <= D.rareQuestionWord);
  if (!qRare.length) return none("the question has no rare word to be about");
  const need = Math.ceil(D.topicFrac * qRare.length);
  const on = cards.filter((c) => qRare.filter((w) => c.w.has(w)).length >= need);
  if (new Set(on.map((c) => c.host)).size < D.minHosts) return none(`only ${new Set(on.map((c) => c.host)).size} site(s) carry the question's rare words`);
  const asked = new Set(q);
  const per = new Map();
  for (const c of on) for (const w of c.w) { if (asked.has(w) || w.length < 2) continue; if (!per.has(w)) per.set(w, new Set()); per.get(w).add(c.host); }
  let best = null;
  for (const [w, hs] of per) {
    if (hs.size < D.minHosts || share(w) > D.rareTerm) continue;
    const score = hs.size * Math.log(1 / (share(w) + 1 / b.n));
    if (!best || score > best.score) best = { w, score };
  }
  if (!best) return none("no rare term that independent sites share");
  const covering = on.filter((c) => c.w.has(best.w));
  return { sufficient: true, abstained: false, why: `independent sites agree on "${best.w}"`, term: best.w, lang: L, covering: covering.map((c) => c.r), hosts: new Set(covering.map((c) => c.host)).size };
}

// ── v4: v1 plus "ask the priors first" (frozen before any v4 outcome: RESULTS.md, "v4") ───────────────────────────
// Function words (khora POSPrior@1, UD gold) are common whatever the learned background says; the learned-background floor is
// 24 cards, not 80; with NO learned background but a function-word list the rule speaks in a stricter mode (every content word
// of the question on a card, >= 4 distinct sites); no list and no background -> abstain.
export const DECLARED_V4 = Object.freeze({ minBackground: 24, strictTopicFrac: 1.0, strictMinHosts: 4 });
function snippetsSufficientV4(results, question, { background = null, lang = null, ...over } = {}) {
  const D = { ...DECLARED, ...DECLARED_V4, ...over };
  const L = lang || languageOf(question, results);
  const none = (why, extra = {}) => ({ sufficient: false, abstained: false, why, term: null, lang: L, covering: [], hosts: 0, ...extra });
  const b0 = background && background.byLang.get(L);
  const hasBg = !!b0 && b0.n >= D.minBackground;
  const fw = functionWordsOf(L);
  if (!hasBg && !fw) return none(`no background for ${L}: ${b0 ? b0.n : 0} of ${D.minBackground} cards and no function-word prior — reading the pages instead`, { abstained: true });
  const minHosts = hasBg ? D.minHosts : D.strictMinHosts;
  const topicFrac = hasBg ? D.topicFrac : D.strictTopicFrac;
  const b = hasBg ? b0 : { n: 1, df: new Map() };
  const cards = cardsOf(results);
  if (new Set(cards.map((c) => c.host)).size < minHosts) return none("too few cards from distinct sites");
  const share = (w) => (fw && fw.has(w) ? 1 : hasBg ? (b.df.get(w) || 0) / b.n : 0);
  const q = [...new Set(wordsOf(question))];
  const qRare = q.filter((w) => share(w) <= D.rareQuestionWord);
  if (!qRare.length) return none("the question has no rare word to be about");
  const need = Math.ceil(topicFrac * qRare.length);
  const on = cards.filter((c) => qRare.filter((w) => c.w.has(w)).length >= need);
  if (new Set(on.map((c) => c.host)).size < minHosts) return none(`only ${new Set(on.map((c) => c.host)).size} site(s) carry the question's rare words`);
  const asked = new Set(q);
  const per = new Map();
  for (const c of on) for (const w of c.w) { if (asked.has(w) || w.length < 2) continue; if (!per.has(w)) per.set(w, new Set()); per.get(w).add(c.host); }
  let best = null;
  for (const [w, hs] of per) {
    if (hs.size < minHosts || share(w) > D.rareTerm) continue;
    const score = hs.size * Math.log(1 / (share(w) + 1 / Math.max(b.n, D.minBackground)));   // only picks WHICH agreeing cards are handed; never whether to fire
    if (!best || score > best.score) best = { w, score };
  }
  if (!best) return none("no rare term that independent sites share");
  const covering = on.filter((c) => c.w.has(best.w));
  return { sufficient: true, abstained: false, why: `independent sites agree on "${best.w}"${hasBg ? "" : " (function-word prior only, strict mode)"}`, term: best.w, lang: L, covering: covering.map((c) => c.r), hosts: new Set(covering.map((c) => c.host)).size, strict: !hasBg };
}

/** The cards as passages — labelled as snippets, one per distinct site, best first. */
export function snippetPassages(covering = [], { max = 5 } = {}) {
  const seen = new Set(), out = [];
  for (const r of covering) {
    const h = hostOf(r.url);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push({ ref: (r.source || h) + " — " + (r.title || h), source: r.url, text: (r.title ? r.title + ". " : "") + r.snippet, via: "snippet", url: r.url, snippetOnly: true });
    if (out.length >= max) break;
  }
  return out;
}
