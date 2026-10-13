// fold-chat-primary.js — GO AND FIND A PRIMARY PAGE THAT SAYS THE SAME THING. Pure: no DOM, no IO, no clock; the web search, the page read and the model are INJECTED.
//
// User, 2026-10-06: "I checked this on Wikipedia, but I consider Wikipedia more like an index for primary sources. So I went and verified it on XYZ and it also said it on here."
// fold-chat-provenance.js says "unconfirmed" when the only verifying page is an encyclopedia. This module is the step that goes and looks: from the verified encyclopedia SENTENCE and the
// claim it supports it builds a few queries (no model), searches, drops the encyclopedia's own mirrors and every tertiary host, ranks what is left by what KIND of host it is, reads at most
// a few pages, and runs the SAME numbered pointing and verification that provenance runs (the model POINTS BY NUMBER; the app checks), under a STRICTER gate: the sentence must carry
// every content stem of the claim and every figure it states, and must ASSERT it (not deny it, hedge it, or ask it).
//
//   findPrimary({ claim, sentence, indexHost, search, readPage, point, fw, limits, indexText, indexUrl })
//     → Promise<{ passages:[{ ref, title, url, text, origin:true, foundVia:{host:indexHost} }],
//                 trail:[{ query, url, host, verdict:"read"|"mirror"|"tertiary"|"unreadable"|"unsupported"|"origin", why? }],
//                 pointers, calls, queries }>          (pointers/calls/queries are extras; the contract is passages + trail)
//   search(query)  → Promise<[{ title, url, snippet }]>      readPage(url) → Promise<string|null>      point(messages) → Promise<string>
//   An AbortError from any of the three REJECTS (never a trail entry). Any other failure is a typed trail entry. The model's reply is a claim to be checked, never believed, and none of
//   its words reach the output: every `why` is the verifier's or this module's own typed reason.
//   mergeProvenance(pr, found, { indexHost })   the provenanceFor result (tier "index") joined with what findPrimary found → a new { narr, pointers, calls, claim, ps, stored }
//
// DECLARED, not measured (II.11): HOST_KINDS, MIRROR_HOSTS, ENCYCLOPEDIAS and the assertion cues below. Giver: the user's brief 2026-10-06 for the shape (government/.edu/official organisation/news
// agency over content farms and Q&A sites; Wikipedia mirrors are not witnesses); the author for the names in the tables. The denial/hedge cues are ENGLISH; in another language the stem and
// figure gates still apply and the assertion gate is silent (a typed gap in the README, not a guess).

import * as ground from "./fold-chat-ground.js";
import { isTertiary } from "./fold-chat-tertiary.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";
import { candidatesFor, numberedMessages, parsePointerNumber, narrate, PROVENANCE } from "./fold-chat-provenance.js";

export const PRIMARY = Object.freeze({
  giver: "the user's brief 2026-10-06 (shape); the author's tables; declared, not measured (II.11)",
  maxQueries: 3,          // searches made
  maxResults: 8,          // results taken from each search
  maxPages: 3,            // pages read (fetch attempts, readable or not)
  maxVerified: 2,         // stop once this many hosts have independently verified
  maxPageChars: 60000,    // a page longer than this is cut (offsets are into the cut text)
  minPageChars: 200,      // a page shorter than this is "unreadable" (a paywall stub, a cookie wall, an empty shell)
  mirrorOverlap: 0.8,     // a page sharing this fraction of its sentences with the encyclopedia page is a copy of it
  mirrorMinSentences: 3,  // ... counted only on a page of at least this many sentences (one shared sentence of a one-sentence page is a quote, not a copy)
  phraseWords: 6,         // the quoted phrase of the first query
  queryTerms: 8,          // content terms in the second query
  fragmentMinRank: 3,     // C8: heading/fragment/pair candidates are offered only from hosts of kind government/education/agency/organisation (rank >= 3); an unclassified host keeps provenance's sentence candidates only
  prefilter: false,       // C8: the model is shown only candidates that already pass the strict gate (it can still say NONE; its pick is checked again)
});

// ─────────────── the declared tables ───────────────

/** What KIND of host a page is on. First match wins. `rank` orders reading (higher first); `drop` names a kind that is never read and never returned. */
export const HOST_KINDS = Object.freeze([
  { id: "farm",        drop: "content_farm", re: /(^|\.)(answers\.com|reference\.com|ask\.com|ehow\.com|wikihow\.com|buzzle\.com|ranker\.com|factretriever\.com|factslides\.com|thefactsite\.com|brainly\.[a-z.]+|chegg\.com|coursehero\.com|study\.com|bartleby\.com|enotes\.com|sparknotes\.com|geeksforgeeks\.org)$/i },
  { id: "qa",          drop: "qa",           re: /(^|\.)(quora\.com|reddit\.com|answers\.yahoo\.com|stackexchange\.com|stackoverflow\.com|medium\.com|substack\.com|blogspot\.[a-z.]+|wordpress\.com|tumblr\.com)$/i },
  { id: "social",      drop: "social",       re: /(^|\.)(facebook\.com|twitter\.com|x\.com|instagram\.com|pinterest\.[a-z.]+|tiktok\.com|linkedin\.com)$/i },
  { id: "government",  rank: 5, re: /(^|\.)(gov|mil|int)$|(^|\.)gov\.[a-z]{2,3}$|(^|\.)(europa\.eu|gouv\.fr|gc\.ca|go\.jp|gob\.[a-z]{2}|bund\.de|admin\.ch|nih\.gov|nasa\.gov)$/i },
  { id: "education",   rank: 5, re: /(^|\.)edu$|(^|\.)edu\.[a-z]{2,3}$|(^|\.)ac\.[a-z]{2,3}$/i },
  { id: "agency",      rank: 4, re: /(^|\.)(reuters\.com|apnews\.com|afp\.com|bbc\.com|bbc\.co\.uk|npr\.org|pbs\.org|aljazeera\.com|dw\.com|abc\.net\.au|cbc\.ca|theguardian\.com|nytimes\.com|washingtonpost\.com|nature\.com|science\.org|thelancet\.com|nejm\.org|jamanetwork\.com|pnas\.org|cell\.com)$/i },
  { id: "organisation", rank: 3, re: /(^|\.)(org|museum)$/i },
  { id: "other",       rank: 2, re: /./ },
]);
export const kindOf = (host) => HOST_KINDS.find((k) => k.re.test(String(host || ""))) || HOST_KINDS[HOST_KINDS.length - 1];

/** Sites that republish the encyclopedia: dropped unread. (A page that is a copy by TEXT is caught on the text, whatever its host.) */
export const MIRROR_HOSTS = Object.freeze([
  /(^|\.)(wikiwand\.com|dbpedia\.org|alchetron\.com|kiddle\.co|wikimili\.com|everybodywiki\.com|wikizero\.[a-z]+|wiki2\.org|wikitrans\.net|infogalactic\.com|justapedia\.org|wikiless\.[a-z.]+|wikimedia\.org|wikidata\.org)$/i,
  /(^|\.)fandom\.com$/i, /(^|\.)wikia\.(com|org)$/i, /(^|\.)miraheze\.org$/i, /(^|\.)grokipedia\.com$/i, /(^|\.)wikitia\.com$/i,
  /(^|\.)wik[a-z0-9-]*\.[a-z.]+$/i, /(^|\.)[a-z0-9-]*pedia\.[a-z.]+$/i,   // any other host whose name is wiki-something or something-pedia: a wiki or a copy of one (conservative)
]);
/** Other encyclopedias and tertiary references: indexes too, not primary sources. */
export const ENCYCLOPEDIAS = Object.freeze([/(^|\.)(britannica\.com|encyclopedia\.com|newworldencyclopedia\.org|citizendium\.org|worldhistory\.org|encyclopedia\.pub|thefamouspeople\.com|famousbirthdays\.com|infoplease\.com|thefreedictionary\.com|dictionary\.com|merriam-webster\.com)$/i]);
/** Strong attribution lines of an encyclopedia copy, in the page's own text. */
const COPY_MARKERS = Object.freeze([/from wikipedia,? the free encyclopedia/i, /this (?:article|page|text) (?:uses|incorporates|is based on|is adapted from|is licensed).{0,100}wikipedia/i, /text is available under the creative commons attribution-sharealike.{0,200}wikipedia/i, /wikipedia,? the free encyclopedia/i]);

// ─────────────── small helpers ───────────────

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const isAbort = (e) => !!e && (e.name === "AbortError" || /abort|stopped/i.test(String(e.message || "")));
const norm = (t) => String(t ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\p{L}\p{N}']+/gu, " ").trim();
const firstOf = (t) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); const m = /^(.+?[.!?。！？])(?:\s|$)/u.exec(s); return m ? m[1] : s; };
const hostWords = (indexHost) => new Set(String(indexHost || "").toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !["www", "com", "org", "net", "edu", "gov", "the"].includes(x)));

// ─────────────── step 1: the queries (no model) ───────────────

const wordsRaw = (text) => String(text ?? "").split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "")).filter(Boolean);

/** The distinctive phrase of a sentence: the window of `n` consecutive words with the most distinctive words (figures, names, long words); verbatim from the sentence. */
export function distinctivePhrase(sentence, fw = null, n = PRIMARY.phraseWords) {
  const score = (x, i) => {
    const low = x.toLowerCase();
    if (fw && fw.has(low)) return 0;
    if (/\d/.test(x)) return 3;
    if (i > 0 && /^\p{Lu}/u.test(x)) return 2.5;
    if (x.length >= 8) return 2;
    return x.length > 3 ? 1 : 0.3;
  };
  // windows are taken WITHIN a clause (split at brackets, commas, semicolons, colons, dashes) so the quoted phrase is a contiguous run of the sentence, never one that jumps a parenthesis
  const EDGE_L = /^[^\p{L}\p{N}]+/u, EDGE_R = /[^\p{L}\p{N}%]+$/u;
  let best = -1, phrase = null;
  for (const c of String(sentence ?? "").split(/[(),;:\u2014\u2013\[\]]+/)) {
    const w = [];
    for (const m of c.matchAll(/\S+/g)) {
      const lead = m[0].length - m[0].replace(EDGE_L, "").length, core = m[0].replace(EDGE_L, "").replace(EDGE_R, "");
      if (core) w.push({ core, s: m.index + lead, e: m.index + lead + core.length });
    }
    if (w.length < 3) continue;
    const sc = w.map((x, i) => score(x.core, i)), size = Math.min(n, w.length);
    for (let i = 0; i + size <= w.length; i++) {
      const v = sc.slice(i, i + size).reduce((a, d) => a + d, 0);
      if (v > best) { best = v; phrase = c.slice(w[i].s, w[i + size - 1].e); }   // a verbatim slice of the sentence, edges trimmed of punctuation
    }
  }
  return phrase;
}

/** 1-3 queries from the verified sentence and the claim: a quoted distinctive phrase; the claim's content terms; the sentence's names and figures not already used. */
export function queriesFor({ claim, sentence, fw = null, indexHost = null, max = PRIMARY.maxQueries } = {}) {
  const drop = hostWords(indexHost);
  const content = (text) => { const seen = new Set(); const out = []; for (const t of ground.tokenize(String(text ?? ""))) { if (t.length < 2 && !/\d/.test(t)) continue; if (fw && fw.has(t)) continue; if (drop.has(t) || seen.has(t)) continue; seen.add(t); out.push(t); } return out; };
  const qs = [];
  const phrase = distinctivePhrase(sentence || claim, fw);
  if (phrase) qs.push(`"${phrase.replace(/"/g, "")}"`);
  const terms = content(claim || sentence).slice(0, PRIMARY.queryTerms);
  if (terms.length >= 2) qs.push(terms.join(" "));
  const used = new Set(terms);
  const extra = [];
  for (const x of wordsRaw(sentence)) { const low = x.toLowerCase(); if (used.has(low) || drop.has(low) || (fw && fw.has(low))) continue; if (/\d/.test(x) || (/^\p{Lu}/u.test(x) && x.length > 2)) { used.add(low); extra.push(x); } }
  if (extra.length >= 2) qs.push(extra.slice(0, 6).join(" "));
  return [...new Set(qs)].slice(0, Math.max(0, max));
}

// ─────────────── step 2: what to drop, how to rank ───────────────

/** Is this URL a page we never read as a witness? → null, or { verdict, why }. */
export function dropReason(url, indexHost = null) {
  const host = hostOf(url);
  if (!host) return { verdict: "unreadable", why: "bad_url" };
  if (!/^https?:/i.test(String(url))) return { verdict: "unreadable", why: "not_http" };
  if (isTertiary(url)) return { verdict: "tertiary", why: "tertiary_host" };
  if (MIRROR_HOSTS.some((re) => re.test(host))) return { verdict: "mirror", why: "mirror_host" };
  if (indexHost && host === String(indexHost).replace(/^www\./, "").toLowerCase()) return { verdict: "tertiary", why: "the_index_itself" };
  if (ENCYCLOPEDIAS.some((re) => re.test(host))) return { verdict: "tertiary", why: "encyclopedia" };
  const k = kindOf(host);
  if (k.drop) return { verdict: "tertiary", why: k.drop };
  return null;
}

/** Is this page's TEXT a copy of the encyclopedia page? Shared-sentence fraction >= mirrorOverlap on a page of enough sentences, or an encyclopedia attribution line. */
export function mirrorOf(pageText, indexText, { overlap = PRIMARY.mirrorOverlap, minSentences = PRIMARY.mirrorMinSentences } = {}) {
  const text = String(pageText ?? "");
  const mark = COPY_MARKERS.find((re) => re.test(text));
  if (mark) return { mirror: true, why: "carries_encyclopedia_attribution" };
  if (!indexText) return { mirror: false, fraction: null };
  const key = (s) => norm(s);
  const idx = new Set(sentencesWithOffsets(String(indexText)).map((s) => key(s.text)).filter((s) => s.length >= 20));
  const mine = sentencesWithOffsets(text).map((s) => key(s.text)).filter((s) => s.length >= 20);
  if (mine.length < minSentences) return { mirror: false, fraction: null, sentences: mine.length };
  const shared = mine.filter((s) => idx.has(s)).length;
  const fraction = shared / mine.length;
  return fraction >= overlap ? { mirror: true, why: `shares_${Math.round(fraction * 100)}pct_of_sentences`, fraction } : { mirror: false, fraction };
}

// ─────────────── step 4: the strict gate (spelling, figures, stems, assertion) ───────────────
// C8 (2026-10-06): the gate of A2 refused TRUE sentences on wording (A3: 1/14 reach). It is made smarter in five declared ways and no more lenient in any other: (a) spelling variants fold to one stem,
// (b) a lowercase subject qualifier may be absent under narrow conditions, (c) a figure that is part of a NAME binds to the name, (d) a figure with a unit is satisfied by the same quantity in another unit within 1%,
// (e) the candidate generator also offers short fragments and heading+sentence pairs that carry the claim's figure. Names are never forgiven; every figure is still required; the assertion gate is unchanged.

/** Words ending in -our that are NOT British spellings of -or (never folded). */
const OUR_KEEP = new Set(["hour", "hours", "four", "your", "yours", "tour", "tours", "pour", "sour", "flour", "scour", "devour", "detour", "contour", "velour", "amour", "paramour", "troubadour"]);
/** (a) British/American spelling folded to one form BEFORE stemming: metre(s)->meter(s), colour->color, organise/organize->organise. A token that is not plain a-z is returned as it is. */
export function spellFold(token) {
  const t = String(token ?? "");
  if (t.length < 4 || !/^[a-z]+$/.test(t)) return t;
  let x = t;
  x = x.replace(/([b-df-hj-np-tv-xz])re(s?)$/, "$1er$2");                                     // metre, centre, litre, fibre, theatre (a vowel before -re is left alone: more, fire, figure)
  if (!OUR_KEEP.has(x)) x = x.replace(/^([a-z]{2,})our(s|ed|ing|ite|ites|able|ful)?$/, (m, a, b) => (OUR_KEEP.has(a + "our") ? m : a + "or" + (b || "")));
  x = x.replace(/^([a-z]{3,})(iz|yz)(e|es|ed|ing|ation|ations|er|ers)$/, (m, a, b, c) => a + (b === "iz" ? "is" : "ys") + c);
  return x;
}
const stemOf2 = (t) => { const f = spellFold(t); return ground.stemOf ? ground.stemOf(f) : f; };
const isDigits = (x) => /^\p{N}+$/u.test(x);
/** The content stems of a text: function words and bare numbers out (numbers are FIGURES, handled by the figure gate), spelling folded, stemmed. */
/** (f) "U.S." / "US" / "USA" is "United States" (a name's abbreviation, folded before stemming; an ordinary lowercase "us" is untouched). */
const normAbbrev = (t) => String(t ?? "").replace(/\bU\.\s?S\.(?:\s?A\.)?|\bUSA\b|\bUS\b/g, "United States");
const stemsOf = (t, fw) => ground.tokenize(normAbbrev(t)).filter((x) => x.length > 2 && !(fw && fw.has(x)) && !isDigits(x)).map(stemOf2);

/** Words that mean the same for the gate (declared, not measured; giver: the author, from A3's diagnosis, 2026-10-06). Each group is one stem for the "does the sentence say it" test. */
export const EQUIV_WORDS = Object.freeze([["won", "awarded", "received", "granted"], ["senators", "members"], ["tall", "height", "high"], ["founded", "established", "began", "created"]]);   // inflected forms: each goes through the same stemmer as the text
const EQUIV = (() => { const m = new Map(); for (const g of EQUIV_WORDS) { const st = [...new Set(g.map(stemOf2))]; for (const s of st) m.set(s, st.filter((o) => o !== s)); } return m; })();
const equivIn = (s, have) => (EQUIV.get(s) || []).find((o) => have.has(o)) || null;

const CUES = new Set(["is", "are", "was", "were", "has", "have", "had", "be", "been", "does", "did", "do", "can", "will", "would"]);
const MONTHS = new Set("january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday".split(" "));
/** The words of a text with where they start; `cap` = begins with a capital letter and is not a function word (a name, conservatively: a sentence-initial common noun counts as one, which only ever FORBIDS a slack). */
function wordsOf(text, fw) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/\p{L}[\p{L}\p{M}'’-]*|\p{N}[\p{N},.]*/gu)) {
    const raw = m[0], lower = raw.toLowerCase();
    out.push({ raw, lower, i: m.index, end: m.index + raw.length, num: /^\p{N}/u.test(raw), cap: /^\p{Lu}/u.test(raw) && !(fw && fw.has(lower)) && raw.length > 2 });
  }
  return out;
}
/** The subject region of a text: the words before its first copula/auxiliary/have; `cue` is that word's index in `words` (-1 when none). */
function regionOf(words) { const cue = words.findIndex((w) => CUES.has(w.lower)); return { cue, subject: cue < 0 ? [] : words.slice(0, cue) }; }
const contentStems = (words, fw) => words.filter((w) => !w.num && w.lower.length > 2 && !(fw && fw.has(w.lower))).map((w) => ({ stem: stemOf2(w.lower), cap: w.cap, lower: w.lower }));

/** (c) Is claim figure `c` part of a NAME ("Apollo 11")? Directly after a capitalised non-function word that is not a month or weekday, 1-3 digits, no unit. Returns the name word or null. */
function nameOfFigure(c, claim, fw) {
  if (c.unit || !c.numeric || c.norm.includes(".") || c.norm.length > 3) return null;
  const before = String(claim).slice(0, c.start);
  const m = /(\p{L}[\p{L}\p{M}'’-]*)[\s -]*$/u.exec(before);
  if (!m) return null;
  const w = m[1], low = w.toLowerCase();
  if (!/^\p{Lu}/u.test(w) || w.length < 3 || (fw && fw.has(low)) || MONTHS.has(low)) return null;
  return w;
}
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * (d) Does sentence figure `w` say what claim figure `c` says? When BOTH carry a declared unit of one dimension the QUANTITY must agree: the same unit and number (ground's own rule: exact, or the claim's rounding),
 * or the same quantity in another unit within 1% (384,400 km ~ 238,855 miles). The same number in a different unit is NOT the same figure (384,400 km is not 384,400 miles). A figure with no unit on either side stays exact.
 */
function figureSays(c, w, tol = 0.01) {
  if (c.unit && w.unit) {
    if (c.unit.dim !== w.unit.dim) return false;
    if (c.unit.f === w.unit.f) return !!ground.figureMatches(c, w);
    if (ground.figureMatches(c, w) && !(c.norm === w.norm)) return true;     // ground's precision-aware conversion
    if (!c.numeric || !w.numeric) return false;
    const a = c.v * c.unit.f, b = w.v * w.unit.f;
    return a > 0 && Math.abs(a - b) / a <= tol;
  }
  return !!ground.figureMatches(c, w);
}
/** The figure gate: every figure the claim states is in the sentence (a name's figure bound to its name; a quantity in its own unit, a rounding of it, or the same quantity in another unit within 1%). → { ok, missing:[raw], bound:[name+figure], unitStems:Set } (the claim's unit word is not needed when the sentence states the quantity in a unit of the same dimension). */
export function figuresGate(claim, sentence, fw = null) {
  const cs = ground.figuresIn ? ground.figuresIn(String(claim ?? "")) : [];
  const ss = ground.figuresIn ? ground.figuresIn(String(sentence ?? "")) : [];
  const missing = [], bound = [], unitStems = new Set();
  for (const c of cs) {
    const nm = nameOfFigure(c, claim, fw);
    if (nm) {
      const re = new RegExp("(?:^|[^\\p{L}])" + reEsc(nm) + "[\\s\\u00a0\\-\u2013]*" + reEsc(c.raw) + "(?![\\p{N}])", "iu");
      if (re.test(String(sentence ?? ""))) bound.push(nm + " " + c.raw); else missing.push(nm + " " + c.raw);
      continue;
    }
    const w = ss.find((x) => figureSays(c, x));
    if (!w) missing.push(c.raw); else if (c.unit && w.unit) unitStems.add(stemOf2(c.unit.w));
  }
  return { ok: missing.length === 0, missing, bound, n: cs.length, unitStems };
}

// ─────────────── the assertion profile ───────────────

const NEG = /(^|[^\p{L}])(not|no|never|cannot|neither|nor|none|nobody|nothing|without|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|won't|can't|couldn't|hasn't|haven't|hadn't|shouldn't|wouldn't)(?=$|[^\p{L}])|n't\b/iu;
const DENY = /\b(myths?|mythical|false(?:ly)?|debunk\w*|misconceptions?|mistaken(?:ly)?|incorrect(?:ly)?|untrue|hoax(?:es)?|fallac\w+|fabricat\w+|disproved|disproven|refuted|misinformation|urban legend|contrary to|popular belief|no evidence|not true)\b/i;
const HEDGE = /\b(allegedly|supposedly|purportedly|reportedly|rumou?rs?|rumou?red|legend|folklore|according to some|some (?:people |experts |scientists |historians )?(?:say|said|believe|believed|think|claim|claimed|argue|argued|suggest|suggested)|many (?:people |experts )?(?:say|believe|think|claim|argue)|(?:is|are|was|were) (?:often|commonly|widely|popularly|sometimes) (?:said|believed|thought|claimed|assumed)|claims? that|claimed that|whether|alleg\w+|purported|if true|may or may not)\b/i;

/** The assertion profile of a sentence: which of {negation, denial, hedge} it carries, and whether it is a question. */
export function assertionOf(sentence) {
  const s = String(sentence ?? "").trim();
  return { neg: NEG.test(s), deny: DENY.test(s), hedge: HEDGE.test(s), question: /\?["')\]”’]*\s*$/.test(s) };
}

/** The stems of a page's own identity (title, host, path): what the page IS ABOUT. A NAME the claim states may be supplied by it (the page is about the entity); nothing else may. */
export function contextStems(passage, fw = null) {
  const url = String(passage?.url || passage?.source || "");
  let host = "", path = "";
  try { const u = new URL(url); host = u.hostname.replace(/^www\./, ""); path = decodeURIComponent(u.pathname); } catch { /* no url: the title alone */ }
  const title = String(passage?.title || "").replace(/\s+/g, " ");
  return new Set(stemsOf([title, host.replace(/\./g, " "), path.replace(/[\/_\-+.]+/g, " ")].join(" "), fw));
}

/**
 * The strict gate on a sentence the model pointed at. In order: assertion-free relevance (a shared content stem), EVERY figure (c, d), EVERY content stem of the claim (a, equivalents, the narrow slack b, names supplied by the page itself),
 * then the assertion profile (it says it; it does not deny, hedge or ask it). English cues only. Returns { ok, why } or { ok:true, slack?, supplied?, equiv? } naming what was forgiven.
 */
export function assertsClaim(claimIn, sentence, { fw = null, indexHost = null, english = true, context = null } = {}) {
  const claim = String(claimIn ?? "").replace(/,?\s*according to [^,.;]*[,]?/gi, " ");   // "according to Wikipedia" is the ANSWER's attribution, not part of what the primary must say
  const drop = hostWords(indexHost);
  const have = new Set(stemsOf(sentence, fw));
  const want0 = [...new Set(stemsOf(claim, fw))].filter((s) => !drop.has(s));
  if (want0.length && !want0.some((s) => have.has(s) || equivIn(s, have))) return { ok: false, why: "unrelated" };
  const fg = figuresGate(claim, sentence, fw);
  if (!fg.ok) return { ok: false, why: "figure_missing:" + fg.missing.join(",") };
  const want = want0.filter((s) => !fg.unitStems.has(s) || have.has(s));
  const cw = wordsOf(claim, fw), sw = wordsOf(sentence, fw);
  const nameStems = new Set(contentStems(regionOf(cw).subject, fw).filter((x) => x.cap).map((x) => x.stem));   // only the SUBJECT's names may be supplied by the page: a name in the predicate ("at the Louvre", "of Australia") is the fact asserted and must be in the sentence
  const equiv = [];
  let lacking = want.filter((s) => { if (have.has(s)) return false; const o = equivIn(s, have); if (o) { equiv.push(s + "~" + o); return false; } return true; });
  const used = {};
  if (lacking.length && context && context.size) {                        // a NAME the sentence leaves out is supplied only by the page's own identity
    const sup = lacking.filter((s) => nameStems.has(s) && context.has(s));
    if (sup.length) { used.supplied = sup; lacking = lacking.filter((s) => !sup.includes(s)); }
  }
  const known = new Set([...want, ...want.flatMap((s) => EQUIV.get(s) || [])]);   // the words a sentence subject may use: the claim's own (and their equivalents), never the page title's
  const foreignOf = (words, strictNone) => { const r = regionOf(words); return r.cue < 0 ? (strictNone ? ["no_subject"] : []) : contentStems(r.subject, fw).map((x) => x.stem).filter((s) => !known.has(s)); };
  if (lacking.length) {                                                    // (b) the narrow slack
    const cr = regionOf(cw);
    const subj = contentStems(cr.subject, fw).filter((x) => !drop.has(x.stem));
    const forgivable = new Set(subj.filter((x) => !x.cap).map((x) => x.stem));
    // the claim's predicate (every stem after the cue) is required in full, because only SUBJECT words are forgivable: a sentence that lacks the predicate has it in `lacking`, outside `forgivable`, and fails
    const anchor = subj.some((x) => !lacking.includes(x.stem) && have.has(x.stem));
    if (fg.n >= 1 && lacking.length <= 2 && lacking.every((s) => forgivable.has(s)) && anchor && !foreignOf(sw, true).length) { used.slack = lacking.slice(); lacking = []; }
  }
  if (lacking.length) return { ok: false, why: "missing_stem:" + lacking.slice(0, 3).join(",") };
  if (used.supplied && !used.slack) {                                      // a supplied name: the sentence's own subject must not name something else
    const sr = regionOf(sw), own = sr.cue >= 0 && contentStems(sr.subject, fw).some((x) => known.has(x.stem));
    const foreign = own ? foreignOf(sw, true) : ["no_named_subject"];     // the sentence must name its OWN subject in the claim's terms (not "This is how...", not "..., it joined..."), with no copula/auxiliary = no subject = no supply ("1636: First College ... founded")
    if (foreign.length) return { ok: false, why: "foreign_subject:" + foreign.slice(0, 2).join(",") };
  }
  if (english) {
    const c = assertionOf(claim), s = assertionOf(sentence);
    if (s.question) return { ok: false, why: "asks_not_asserts" };
    if (s.deny !== c.deny) return { ok: false, why: s.deny ? "denies" : "claim_denies_page_does_not" };
    if (s.hedge !== c.hedge) return { ok: false, why: s.hedge ? "hedges" : "claim_hedges_page_does_not" };
    if (s.neg !== c.neg) return { ok: false, why: "polarity" };
  }
  return { ok: true, ...(equiv.length ? { equiv } : {}), ...used, ...(fg.bound.length ? { bound: fg.bound } : {}) };
}

// ─────────────── step 3b: the candidates (provenance's, plus fragments and heading+sentence pairs) ───────────────

const wc = (t) => (String(t).match(/\p{L}[\p{L}\p{N}'’-]*/gu) || []).length;
const isHeading = (t) => { const s = String(t).trim(); return s.length >= 3 && s.length <= 90 && wc(s) >= 1 && wc(s) <= 12 && !/[.!?:;,]["')\]”’]*$/.test(s); };
const lettersRatio = (s) => ((s.match(/\p{L}/gu) || []).length) / Math.max(1, s.length);

/**
 * (e) The numbered candidates of ONE page: provenance's own (verbatim slices), then short declarative fragments / list items and HEADING+FOLLOWING-SENTENCE pairs that carry every figure of the claim and
 * at least half of its stems (or, when the claim has no figure, 70% of its stems). A pair is the heading and the sentence under it as ONE verbatim slice of the page, so the heading is part of what the gate reads.
 */
export function candidatesV2(claim, passages, fw = null, { max = 16, extraMax = 8, minRank = PRIMARY.fragmentMinRank } = {}) {
  const base = candidatesFor(claim, passages, fw);
  const out = base.map((c) => ({ ...c }));
  const have = new Set(out.map((c) => c.passageIndex + ":" + c.start + ":" + c.end));
  const want = [...new Set(stemsOf(claim, fw))];
  const cfig = ground.figuresIn ? ground.figuresIn(String(claim ?? "")) : [];
  const share = (t) => { const h = new Set(stemsOf(t, fw)); return want.length ? want.filter((s) => h.has(s) || equivIn(s, h)).length / want.length : 0; };
  const carries = (t) => cfig.length ? figuresGate(claim, t, fw).ok && share(t) >= 0.5 : share(t) >= 0.7;
  let extra = 0;
  (Array.isArray(passages) ? passages : []).forEach((p, passageIndex) => {
    const text = String(p?.text ?? "");
    if ((kindOf(hostOf(p?.url || p?.source || "")).rank || 0) < minRank) return;        // an unclassified host: sentences only (a title or a heading there is a page's marketing, not its statement)
    const units = sentencesWithOffsets(text);
    const add = (start, end, t) => { const k = passageIndex + ":" + start + ":" + end; if (have.has(k) || extra >= extraMax || t.length < PROVENANCE.minSentence || t.length > PROVENANCE.maxCandidate || wc(t) < 3) return; if (/[a-z0-9][.!?][A-Z]/.test(t) || lettersRatio(t) < 0.45) return; have.add(k); out.push({ passageIndex, start, end, text: t }); extra++; };
    for (let i = 0; i < units.length; i++) {
      const u = units[i], t = text.slice(u.start, u.end).trim();
      if (carries(t)) add(u.start, u.end, t);
      if (i + 1 < units.length && isHeading(t)) {
        const v = units[i + 1], alone = text.slice(v.start, v.end).trim(), pair = text.slice(u.start, v.end).trim();
        if (carries(pair) && share(pair) > share(alone)) add(u.start, v.end, pair);        // the heading adds claim stems the sentence alone lacks
      }
    }
  });
  return out.slice(0, max).map((c, i) => ({ ...c, n: i + 1 }));
}

// ─────────────── step 4b: point at one page ───────────────

const titleOf = (p) => { const ref = String(p?.ref ?? ""); const t = ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : (p?.title || ref); return String(t).replace(/\s+[-–—|]\s+(Wikipedia|Britannica)\s*$/i, "").trim(); };
const clip = (text, max) => { const t = String(text).replace(/\s+/g, " ").trim(); if (t.length <= max) return t; const cut = t.slice(0, max); const sp = cut.lastIndexOf(" "); return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…"; };

/** provenance's verifyNumber, with this module's gate in place of bearsOn: the number names a candidate; the candidate must pass the strict gate (figures, stems, assertion). */
function verifyPick({ reply, claim, candidates, passages, fw, indexHost, english, context }) {
  const r = typeof reply === "string" ? parsePointerNumber(reply) : reply;
  if (!r) return { ok: false, why: "unparsed" };
  if (r.none) return { ok: false, why: "none" };
  const c = (candidates || []).find((x) => x.n === r.n);
  if (!c) return { ok: false, why: "no_such_sentence" };
  const gate = assertsClaim(claim, c.text, { fw, indexHost, english, context });
  if (!gate.ok) return { ok: false, why: gate.why };
  const pass = passages[c.passageIndex];
  const url = pass.url || pass.source || "";
  let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* no host */ }
  const have = new Set(stemsOf(c.text, fw));
  const shared = [...new Set(stemsOf(claim, fw))].filter((s) => have.has(s));
  return { ok: true, index: c.passageIndex, ref: pass.ref || null, url, host, title: titleOf(pass), tier: "origin", foundVia: pass.foundVia || null, start: c.start, end: c.end, quote: clip(String(pass.text).slice(c.start, c.end), PROVENANCE.maxQuote), shared, by: "number", gate };
}

/**
 * The numbered pointing over ONE page: the candidates (v2), optionally pre-filtered by the gate (the model is then shown only sentences that already pass: it can still say NONE, and its pick is checked again),
 * the model's number, the strict gate. A rejected real number withdraws that candidate and asks once more over the rest.
 * Returns { ok:true, v, calls } | { ok:false, why, calls }. AbortError propagates; any other model failure is a typed `call_failed`.
 */
async function pointAt({ claim, passage, point, fw, indexHost, english, prefilter = true, minRank = PRIMARY.fragmentMinRank }) {
  let calls = 0;
  const context = contextStems(passage, fw);
  const gateOf = (c) => assertsClaim(claim, c.text, { fw, indexHost, english, context });
  let candidates = candidatesV2(claim, [passage], fw, { minRank });
  if (!candidates.length) return { ok: false, why: "no_candidates", calls };
  if (prefilter) {
    const graded = candidates.map((c) => ({ c, g: gateOf(c) }));
    const pass = graded.filter((x) => x.g.ok).map((x) => x.c);
    if (!pass.length) {                                                       // nothing on the page passes the gate: the typed reason is that of the candidate closest to the claim (most claim stems shared)
      const want = [...new Set(stemsOf(claim, fw))];
      const score = (c) => { const h = new Set(stemsOf(c.text, fw)); return want.filter((s) => h.has(s) || equivIn(s, h)).length; };
      const best = graded.map((x) => ({ ...x, s: score(x.c) })).sort((a, b) => b.s - a.s)[0];
      return { ok: false, why: best.g.why, calls };
    }
    const declarative = (c) => /[.!?]["')\]”’]*$/.test(c.text.trim()) || wordsOf(c.text, fw).some((w) => CUES.has(w.lower));   // a sentence before a heading or a fragment that happens to carry the figure
    candidates = pass.map((c, i) => ({ c, i })).sort((a, b) => Number(declarative(b.c)) - Number(declarative(a.c)) || a.i - b.i).map((x, i) => ({ ...x.c, n: i + 1 }));
  }
  let last = { ok: false, why: "rejected" };
  let withdrawn = null;      // why the first pick was withdrawn, kept: a second "NONE" does not erase what was wrong with it
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply = "";
    try { reply = await point(numberedMessages({ claim, candidates, passages: [passage] })); calls++; }
    catch (e) { if (isAbort(e)) throw e; return { ok: false, why: "call_failed:" + String(e?.message || e).slice(0, 60), calls }; }
    const v = verifyPick({ reply, claim, candidates, passages: [passage], fw, indexHost, english, context });
    if (v.ok) return { ok: true, v, calls };
    last = { ok: false, why: v.why };
    if (v.why === "none" || v.why === "unparsed") return { ...(withdrawn ? { ok: false, why: withdrawn } : last), calls };
    const asked = parsePointerNumber(reply);
    const rest = asked && !asked.none ? candidates.filter((c) => c.n !== asked.n).map((c, i) => ({ ...c, n: i + 1 })) : [];
    if (attempt === 0 && rest.length) { candidates = rest; withdrawn = last.why; } else break;
  }
  return { ...last, calls };
}


// ─────────────── the search ───────────────

export async function findPrimary({ claim, sentence, indexHost = null, search, readPage, point, fw = null, limits = {}, indexText = null, indexUrl = null, english = true } = {}) {
  const L = { ...PRIMARY, ...(limits || {}) };
  const trail = [];
  const passages = [];
  const pointers = [];
  let calls = 0;
  const out = (queries) => ({ passages, trail, pointers, calls, queries });
  const theClaim = String(claim ?? "").trim() || firstOf(sentence);
  if (!theClaim || typeof search !== "function" || typeof readPage !== "function" || typeof point !== "function") return out([]);

  // the encyclopedia page's own text, to recognise its copies by sentence overlap (given, or read from indexUrl; a failure to read it only costs the overlap test)
  let idxText = indexText ? String(indexText) : null;
  if (!idxText && indexUrl) { try { idxText = await readPage(indexUrl); } catch (e) { if (isAbort(e)) throw e; idxText = null; } }

  const queries = queriesFor({ claim: theClaim, sentence: sentence || theClaim, fw, indexHost, max: L.maxQueries });
  const seen = new Set();
  const cands = [];
  let order = 0;
  // E2 L3: every query is asked at once (they were asked one after another, ~1-6 s each); results are consumed in the SAME order
  const asked = queries.map((query) => { const p = Promise.resolve().then(() => search(query)); p.catch(() => {}); return { query, p }; });
  for (const { query, p } of asked) {
    if (cands.length >= L.maxPages * 2) break;
    let results;
    try { results = await p; }
    catch (e) { if (isAbort(e)) throw e; trail.push({ query, url: null, host: "", verdict: "unreadable", why: "search_failed:" + String(e?.message || e).slice(0, 60) }); continue; }
    results = (Array.isArray(results) ? results : []).filter((r) => r && r.url).slice(0, L.maxResults);
    if (!results.length) { trail.push({ query, url: null, host: "", verdict: "unreadable", why: "no_results" }); continue; }
    for (const r of results) {
      const url = String(r.url).replace(/#.*$/, "");
      if (seen.has(url)) continue;
      seen.add(url);
      const host = hostOf(url);
      const drop = dropReason(url, indexHost);
      if (drop) { trail.push({ query, url, host, verdict: drop.verdict, why: drop.why }); continue; }
      cands.push({ query, url, host, title: String(r.title || "").replace(/\s+/g, " ").trim(), rank: kindOf(host).rank, kind: kindOf(host).id, order: order++ });
    }
  }
  // one page per host (the same site twice is not a second witness): the best-ranked, earliest one
  cands.sort((a, b) => b.rank - a.rank || a.order - b.order);
  const hostsSeen = new Set();
  const ranked = cands.filter((c) => (hostsSeen.has(c.host) ? false : (hostsSeen.add(c.host), true)));

  // E2 L3: the pages the loop below may try (the first maxPages of the ranking) are fetched together, not one at a time (~2-6 s each)
  const pre = new Map();
  for (const c of ranked.slice(0, L.maxPages)) { const p = Promise.resolve().then(() => readPage(c.url)); p.catch(() => {}); pre.set(c.url, p); }
  let tried = 0;
  for (const c of ranked) {
    if (tried >= L.maxPages || passages.length >= L.maxVerified) break;
    tried++;
    let text;
    try { text = await (pre.get(c.url) || readPage(c.url)); }
    catch (e) { if (isAbort(e)) throw e; trail.push({ query: c.query, url: c.url, host: c.host, verdict: "unreadable", why: "read_failed:" + String(e?.message || e).slice(0, 60) }); continue; }
    // readPage's contract is string|null; a reader that returns { ok, text, title } (the chat's own readText does) is accepted too
    let pageTitle = c.title;
    if (text && typeof text === "object") { if (text.ok === false) { trail.push({ query: c.query, url: c.url, host: c.host, verdict: "unreadable", why: "read_failed:" + String(text.error || text.why || "not ok").slice(0, 60) }); continue; } if (!pageTitle && text.title) pageTitle = String(text.title).replace(/\s+/g, " ").trim(); text = text.text; }
    text = typeof text === "string" ? text : "";
    if (!text.trim()) { trail.push({ query: c.query, url: c.url, host: c.host, verdict: "unreadable", why: "empty" }); continue; }
    if (text.trim().length < L.minPageChars) { trail.push({ query: c.query, url: c.url, host: c.host, verdict: "unreadable", why: "too_short" }); continue; }
    if (text.length > L.maxPageChars) text = text.slice(0, L.maxPageChars);
    const mir = mirrorOf(text, idxText, { overlap: L.mirrorOverlap, minSentences: L.mirrorMinSentences });
    if (mir.mirror) { trail.push({ query: c.query, url: c.url, host: c.host, verdict: "mirror", why: mir.why }); continue; }
    const passage = { ref: `${c.host} — ${pageTitle || c.host}`, title: pageTitle || c.host, url: c.url, text, origin: true, foundVia: { host: indexHost } };
    const r = await pointAt({ claim: theClaim, passage, point, fw, indexHost, english, prefilter: L.prefilter !== false, minRank: L.fragmentMinRank ?? PRIMARY.fragmentMinRank });
    calls += r.calls;
    if (r.ok) {
      const at = passages.length;
      passages.push(passage);
      pointers.push({ ...r.v, index: at, tier: "origin" });
      trail.push({ query: c.query, url: c.url, host: c.host, verdict: "origin" });
    } else trail.push({ query: c.query, url: c.url, host: c.host, verdict: r.why === "no_candidates" ? "read" : "unsupported", why: r.why });
  }
  return out(queries);
}

// ─────────────── joining the result to provenance ───────────────

/**
 * mergeProvenance(pr, found, { indexHost }) — `pr` is what provenanceFor returned for an index-tier answer; `found` is findPrimary's result. When nothing was found, `pr` is returned unchanged.
 * Otherwise the narration is the app's origin line ("I checked this on <index> ... followed it to <host> and verified it there. It says: “…”") built by narrate() from the primary pointers only,
 * `ps` is the primary passages then provenance's own, and `stored` keeps both the pointers and the trail (the path there, tracked).
 */
export function mergeProvenance(pr, found, { indexHost = null } = {}) {
  const prim = (found?.pointers || []).filter((p) => p && p.ok);
  if (!prim.length) return pr;
  const off = found.passages.length;
  const old = (pr?.pointers || []).filter((p) => p && p.ok).map((p) => ({ ...p, index: p.index + off }));
  const idxHost = indexHost || old[0]?.host || prim[0].foundVia?.host || null;
  const narr = narrate(prim, { indexHost: idxHost });
  const ps = [...found.passages, ...(pr?.ps || [])];
  const calls = (pr?.calls || 0) + (found.calls || 0);
  const stored = {
    schema: "Provenance@1", claim: pr?.claim, calls, verified: narr.verified, parts: narr.parts,
    pointers: [...prim, ...old].map((p) => ({ index: p.index, ref: p.ref, url: p.url, host: p.host, title: p.title, tier: p.tier, start: p.start, end: p.end })),
    via: { index: idxHost, trail: (found.trail || []).map((t) => ({ url: t.url, host: t.host, verdict: t.verdict, why: t.why || null })) },
    why: null,
  };
  return { narr, pointers: [...prim, ...old], calls, claim: pr?.claim, ps, stored };
}
