// fold-chat-web.js — web search and page reading, like the holodeck's.
//
// No server relays anything. The holodeck searches the sources that answer a
// browser directly with no key (GitHub, Wikipedia, the Internet Archive, and
// the open scholarly graph — OpenAlex, Crossref), reads a page directly when
// the site allows it, and when a site refuses a cross-origin read falls
// through to a small chain of public CORS proxies and text readers — each a
// third party that fetched the page for this browser, which the trace names.
//
// This is the same mechanism, lean and testable (browser + node; tests inject
// fetch). It returns the holodeck's result shape:
//   { title, url, snippet, source, meta, kind }
// and a combined { results, more, engine } per scope.

import { impressionOf } from "./fold-chat-impression.js";
import { declaredBlocksFromHtml, looksBlocked } from "./fold-chat-strand.js";
import { looksDisambiguation } from "./fold-chat-senses.js";
import { searchDirect } from "./fold-chat-engines.js";
import { isExtension } from "./fold-chat-exit.js";
import { contactsOfRaw } from "./fold-chat-tip.js";
import { snippetsSufficient, snippetPassages, makeBackground, learnBackground, languageOf, functionWordsOf } from "./fold-chat-snippets.js";
import { stripFrame, caseless } from "./fold-chat-frame.js";
import SNIPPET_SEED from "./fold-chat-snippets-seed.js";
import { entityFromTitle, mentions, fold } from "./fold-chat-mind.js";
import { routeSources, probeSources, noteRateLimited, coolingDown, isRateLimitError, factualAsk } from "./fold-chat-route.js";
import { detectLang } from "./fold-chat-lang.js";

export const SCOPES = Object.freeze([
  { id: "web", label: "Web · open search", ask: "Search the open web (DuckDuckGo/Brave via the relay)" },
  { id: "wikipedia", label: "Wikipedia", ask: "Search Wikipedia articles" },
  { id: "github", label: "GitHub", ask: "Search GitHub repositories" },
  { id: "archive", label: "Internet Archive", ask: "Search books, documents and recordings" },
  { id: "openalex", label: "Papers · OpenAlex", ask: "Search research papers (OpenAlex)" },
  { id: "crossref", label: "Papers · Crossref", ask: "Search research papers (Crossref)" },
]);

// The Cloudflare Worker relay (the fold's own; the khora reads through it too).
// It does the SERVER-side fetch the static page cannot: DuckDuckGo/Brave web
// search and CORS-open page reads, keyless, and it writes no logs. See
// holodeck-proxy/ in this workspace.
export const FOLD_RELAY = "https://holodeck-proxy.prometheoid.workers.dev";

// A page the site refuses to hand the browser is fetched through one of these,
// in parallel; the trace names which. The FOLD'S OWN RELAY is first — it is a
// server-side fetch with CORS open, so reads are reliable rather than a roll of
// the dice against a string of public proxies.
export const CORS_PROXIES = [
  (u) => `${FOLD_RELAY}/raw?url=${encodeURIComponent(u)}`,
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://cors.eu.org/" + u,
  (u) => "https://thingproxy.freeboard.io/fetch/" + u,
];
// A page whose article exists only after its own scripts run cannot be read as
// HTML, but a server-side text reader (r.jina.ai) hands back the text.
export const TEXT_READERS = [
  (u) => "https://r.jina.ai/" + u,
  (u) => "https://api.microlink.io/?meta=false&text=true&url=" + encodeURIComponent(u),
];

const decode = (s) => String(s ?? "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
// Leftover wikitext scaffolding that survives as text: {{templates}}, {|tables|}, [[links]].
function cleanText(t) {
  return String(t ?? "")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\{\|[\s\S]*?\|\}/g, " ")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[ \t]+/g, " ").replace(/ *\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// Non-content subtrees: scripts, chrome, references, tables/infoboxes, media.
const DROP_SEL = "script,style,head,nav,footer,noscript,sup.reference,table,figure,figcaption,.mw-editsection,.navbox,.infobox,.metadata,.reflist,.reference,.toc,style";
// The blocks that carry article prose: paragraphs, list items, headings.
const BLOCK_SEL = "p, li, h1, h2, h3, h4, blockquote, dd";

/** HTML → the article's PROSE BLOCKS, one per line-pair. This is the grammar
 *  step: parse the tree (the browser's own HTML grammar), drop the non-content
 *  subtrees (references, infoboxes, tables, chrome), then keep the prose blocks
 *  (paragraphs, list items, headings) as SEPARATE blocks — so a later snip is a
 *  sentence inside a real paragraph, never a flattened blob whose first match
 *  lands in a citation footer. Browser: DOMParser. Node: a <p>/<li> walk. */
function htmlToBlocks(raw) {
  const s = String(raw ?? "");
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(s, "text/html");
      for (const n of doc.querySelectorAll(DROP_SEL)) n.remove();
      const scope = doc.querySelector("#mw-content-text, article, main, [role=main]") || doc.body;
      const blocks = [];
      if (scope) for (const n of scope.querySelectorAll(BLOCK_SEL)) {
        if (blocks.length >= 400) break;              // bound the walk
        const t = one(n.textContent);
        if (t.length >= 40) blocks.push(t);
      }
      if (blocks.length) return cleanText(blocks.join("\n\n").slice(0, 40000));
      const t = one(scope ? scope.textContent : doc.documentElement.textContent);
      if (t.length >= 40) return cleanText(t.slice(0, 40000));
    } catch (e) {}
  }
  // Node fallback: pull <p>/<li> blocks (the falsifier proved this isolates the
  // prose and drops the reference footer).
  const blocks = [...s.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => one(decode(m[2].replace(/<(sup|style|script|table|figure)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))))
    .filter((t) => t.length >= 40);
  if (blocks.length) return cleanText(blocks.join("\n\n"));
  return cleanText(decode(s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|head|nav|footer)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")));
}
const stripTags = htmlToBlocks;
const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const first = (v) => (Array.isArray(v) ? v[0] : v) || "";

const fetchT = (fetchImpl, u, ms, headers, extSignal) => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  const onAbort = () => c.abort();
  if (extSignal) { if (extSignal.aborted) c.abort(); else extSignal.addEventListener("abort", onAbort, { once: true }); }
  const o = { signal: c.signal, headers: { ...(headers || {}) } };
  return fetchImpl(u, o).finally(() => { clearTimeout(id); if (extSignal) extSignal.removeEventListener("abort", onAbort); });
};

async function getJson(fetchImpl, url, who) {
  let r;
  try { r = await fetchT(fetchImpl, url, 30000); } catch (e) { throw new Error(who + " did not answer" + (e && e.name === "AbortError" ? " in time." : ".")); }
  let j = null; try { j = await r.json(); } catch (e) {}
  return { r, j };
}

/** The local heimdall bridge, when the page has one. Web search and page reads try it FIRST: the request then
 *  leaves from this machine's own address, with no relay and no translate proxy in the middle, and the relay
 *  stays as the fallback (a bridge search can be throttled after a burst, and some sites refuse Node's fetch).
 *  Null (the default) = the previous behaviour exactly. */
let LOCAL_BRIDGE = null;
export function setBridge(base) { LOCAL_BRIDGE = base ? String(base).replace(/\/+$/, "") : null; }
export const getBridge = () => LOCAL_BRIDGE;

/** A relay's answer that is really a block page (a paywall, a captcha, a bot wall), not the page asked for — see
 *  fold-chat-strand.js looksBlocked (one definition, shared with the strand). */
export { looksBlocked };

/** Open-web search through the fold's Cloudflare Worker relay: the Worker does
 *  the server-side DuckDuckGo/Brave fetch (keyless, CORS-open) that a static
 *  browser page cannot. This is what actually finds a people/records/anything
 *  query the five API scopes miss. */
async function duckSearch(q, { fetchImpl = fetch, page = 0 } = {}) {
  if (LOCAL_BRIDGE) {
    try {
      const { r, j } = await getJson(fetchImpl, `${LOCAL_BRIDGE}/api/search?scope=web&q=` + encodeURIComponent(q), "The local bridge's web search");
      if (r.ok && j && Array.isArray(j.results) && j.results.length) {
        const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "web"; } };
        const results = j.results.map((x) => ({ title: one(x.title || ""), url: x.url || "", snippet: one(x.snippet || "").slice(0, 300), source: x.source || host(x.url), meta: "", kind: "web" })).filter((x) => x.title && /^https?:/i.test(x.url));
        if (results.length) return { results: results.slice(0, 20), more: results.length >= 20, engine: (j.engine || "Web") + " · this machine" };
      }
    } catch (e) { /* the bridge could not answer: fall through to the relay, which names its own failure */ }
  }
  const url = `${FOLD_RELAY}/search?scope=web&q=` + encodeURIComponent(q);
  let { r, j } = await getJson(fetchImpl, url, "Web search");
  // The relay fronts DuckDuckGo/Brave, which now and then answer it with a 5xx
  // (measured: intermittent 502s). One retry turns most of those into answers;
  // a second failure is reported, and the router widens to the other sources.
  if (r.status >= 500) ({ r, j } = await getJson(fetchImpl, url, "Web search"));
  if (!r.ok || !j) throw new Error("Web search answered " + (r.status || "nothing"));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "web"; } };
  const results = (Array.isArray(j.results) ? j.results : []).map((x) => ({
    title: one(x.title || ""), url: x.url || "",
    snippet: one(x.snippet || "").slice(0, 300),
    source: x.source || host(x.url), meta: "", kind: "web",
  })).filter((x) => x.title && /^https?:/i.test(x.url));
  return { results: results.slice(0, 20), more: results.length >= 20, engine: (j.engine || "DuckDuckGo") };
}

/** Search one scope, page-based. Returns { results, more, engine }. */
/** The open web searched DIRECTLY — for the Fold as a browser extension, whose background worker
 *  holds host permissions: no relay, no CORS wall, the user's own address. Brave and DuckDuckGo are
 *  asked at once; the first with results wins; a refusal costs only its own (short) answer. */
async function directSearch(q, { fetchImpl = fetch } = {}) {
  const out = await searchDirect(q, { fetchImpl });
  if (!out.results.length) throw new Error("Web search found nothing directly (" + out.tried.map((t) => `${t.id}: ${t.why || "no results"}`).join("; ") + ").");
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "web"; } };
  return { results: out.results.slice(0, 20).map((x) => ({ title: x.title, url: x.url, snippet: x.snippet.slice(0, 300), source: host(x.url), meta: "", kind: "web" })), more: false, engine: out.engine === "brave" ? "Brave Search" : "DuckDuckGo" };
}

/** The Wikipedia edition an ask should be searched in: the asker's own language when it is confidently detected and has
 *  an edition we carry, else English. A Hindi, Arabic or Chinese ask searched on en.wikipedia reads English pages the
 *  gate cannot check wording against (measured 2026-10-05, eval/results-cur.json). */
const WIKI_EDITIONS = new Set(["en", "es", "fr", "de", "pt", "it", "nl", "ru", "uk", "zh", "ja", "ko", "ar", "he", "hi", "th", "el"]);
export function wikiEdition(q) {
  // A Latin-script ask needs real evidence (3+ function-word / mark hits): "write me a poem" is two Portuguese words and English.
  try { const d = detectLang(q); return d.confident && WIKI_EDITIONS.has(d.lang) && (d.script !== "Latin" || d.hits >= 3) ? d.lang : "en"; } catch { return "en"; }
}

export async function search(scope, q, page = 0, { fetchImpl = fetch, direct = false, lang = "en" } = {}) {
  if (scope === "web") return direct ? directSearch(q, { fetchImpl }) : duckSearch(q, { fetchImpl, page });
  if (scope === "github") {
    const { r, j } = await getJson(fetchImpl, "https://api.github.com/search/repositories?per_page=20&page=" + (page + 1) + "&q=" + encodeURIComponent(q), "GitHub");
    if (r.status === 403 || r.status === 429) throw new Error("GitHub is limiting searches from this browser.");
    if (!r.ok || !j) throw new Error("GitHub answered " + r.status + ".");
    const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
    return { results: (j.items || []).map((x) => ({ title: x.full_name, url: x.html_url, snippet: x.description || "", source: "GitHub", meta: ["★ " + k(x.stargazers_count), x.language, x.pushed_at ? "updated " + x.pushed_at.slice(0, 4) : ""].filter(Boolean).join(" · "), kind: "github" })), more: (page + 1) * 20 < Math.min(j.total_count || 0, 1000), engine: "GitHub" };
  }
  if (scope === "wikipedia") {
    const wiki = async (ed, query = q) => {
      const { r, j } = await getJson(fetchImpl, `https://${ed}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=20&sroffset=` + page * 20 + "&srsearch=" + encodeURIComponent(query), "Wikipedia");
      if (!r.ok || !j) throw new Error("Wikipedia answered " + r.status + ".");
      return { results: ((j.query && j.query.search) || []).map((x) => ({ title: x.title, url: `https://${ed}.wikipedia.org/wiki/` + encodeURIComponent(x.title.replace(/ /g, "_")), snippet: stripTags(x.snippet), source: "Wikipedia", meta: x.wordcount ? x.wordcount.toLocaleString() + " words" : "", kind: "wikipedia" })), more: !!j.continue, engine: ed === "en" ? "Wikipedia" : `Wikipedia (${ed})` };
    };
    const ed = WIKI_EDITIONS.has(lang) ? lang : "en";
    // THE QUESTION FRAME (fold-chat-frame.js): Wikipedia's search matches titles on "Who is the …" (measured: "Who is the king of the UK?" ranks
    // three films before Monarchy of the United Kingdom). The ask is searched as said AND with its frame shed; the two lists are interleaved,
    // frame-shed first, so neither can push the other's best hit out of the top few. No function-word prior for the language, or no frame: one search.
    const framed = stripFrame(q, functionWordsOf(ed));
    const out = await wiki(ed);
    if (framed && framed !== q) {
      try {
        const alt = await wiki(ed, framed);
        const merged = [], seen = new Set();
        for (let i = 0; i < Math.max(alt.results.length, out.results.length); i++) for (const list of [alt.results, out.results]) { const x = list[i]; if (x && !seen.has(x.url)) { seen.add(x.url); merged.push(x); } }
        if (merged.length) return { ...out, results: merged, framed };
      } catch { /* the framed search failing leaves the ask's own results exactly as before */ }
    }
    // a small edition with nothing on it falls back to English rather than leaving the ask with no encyclopedia at all
    return !out.results.length && ed !== "en" ? wiki("en") : out;
  }
  if (scope === "openalex") {
    const { r, j } = await getJson(fetchImpl, "https://api.openalex.org/works?search=" + encodeURIComponent(q) + "&per-page=20&page=" + (page + 1), "OpenAlex");
    if (!r.ok || !j) throw new Error("OpenAlex answered " + r.status + ".");
    const results = (j.results || []).map((w) => {
      const src = (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || "";
      const doi = (w.doi || "").replace(/^https?:\/\/doi\.org\//i, "");
      const oa = (w.best_oa_location && w.best_oa_location.pdf_url) || null;
      const landing = w.landing_page_url || (doi ? "https://doi.org/" + doi : "");
      return { title: w.title || w.display_name || "Untitled", url: oa || landing, snippet: oaAbstract(w.abstract_inverted_index).slice(0, 300), source: src || "OpenAlex", meta: [w.publication_year, w.cited_by_count ? "cited " + w.cited_by_count : "", doi ? "doi:" + doi : ""].filter(Boolean).join(" · "), kind: "paper", doi: doi || null };
    });
    return { results, more: page * 20 + results.length < ((j.meta && j.meta.count) || 0), engine: "OpenAlex" };
  }
  if (scope === "crossref") {
    const { r, j } = await getJson(fetchImpl, "https://api.crossref.org/works?query.bibliographic=" + encodeURIComponent(q) + "&rows=20&offset=" + page * 20, "Crossref");
    if (!r.ok || !j) throw new Error("Crossref answered " + r.status + ".");
    const msg = j.message || {};
    const results = (msg.items || []).map((it) => {
      const doi = it.DOI || "";
      const year = (it.issued && it.issued["date-parts"] && it.issued["date-parts"][0] && it.issued["date-parts"][0][0]) || "";
      const jrn = (it["container-title"] && it["container-title"][0]) || "";
      return { title: (it.title && it.title[0]) || "Untitled", url: "https://doi.org/" + doi, snippet: stripTags(it.abstract || "").slice(0, 300), source: jrn || "Crossref", meta: [year, it["is-referenced-by-count"] ? "cited " + it["is-referenced-by-count"] : "", doi ? "doi:" + doi : ""].filter(Boolean).join(" · "), kind: "paper", doi: doi || null };
    });
    return { results, more: page * 20 + results.length < Math.min(msg["total-results"] || 0, 10000), engine: "Crossref" };
  }
  const { r, j } = await getJson(fetchImpl, "https://archive.org/advancedsearch.php?output=json&rows=20&page=" + (page + 1) + "&q=" + encodeURIComponent(q) + ["identifier", "title", "description", "mediatype", "year", "creator"].map((f) => "&fl%5B%5D=" + f).join(""), "The Internet Archive");
  if (!r.ok || !j || !j.response) throw new Error("The Internet Archive answered " + r.status + ".");
  return { results: (j.response.docs || []).map((d) => ({ title: first(d.title) || d.identifier, url: "https://archive.org/details/" + d.identifier, snippet: stripTags(Array.isArray(d.description) ? d.description.join(" ") : d.description).slice(0, 300), source: first(d.creator) || "Internet Archive", meta: [d.mediatype, d.year].filter(Boolean).join(" · "), kind: "archive" })), more: page * 20 + (j.response.docs || []).length < (j.response.numFound || 0), engine: "Internet Archive" };
}

function oaAbstract(inv) {
  if (!inv || typeof inv !== "object") return "";
  const pos = [];
  for (const w of Object.keys(inv)) for (const i of inv[w]) pos[i] = w;
  return pos.join(" ");
}

/** The structured recipe a page declares (schema.org Recipe in JSON-LD), as plain text:
 *  name, yield, times, ingredients, steps. Most recipe sites publish it; it is exact where
 *  the page text is ad-laden, and it comes FIRST so truncation never drops the recipe.
 *  Empty string when the page declares none. Pure. */
export function recipeDataFromHtml(raw) {
  const html = String(raw ?? "");
  if (!/ld\+json/i.test(html)) return null;
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const isRecipe = (n) => n && typeof n === "object" && [].concat(n["@type"] || []).some((t) => /(^|\/)Recipe$/i.test(String(t)));
  const walk = (n, out) => { if (Array.isArray(n)) { for (const x of n) walk(x, out); } else if (n && typeof n === "object") { if (isRecipe(n)) out.push(n); if (n["@graph"]) walk(n["@graph"], out); } return out; };
  const clean = (v) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").trim();
  const steps = (v) => [].concat(v || []).flatMap((x) => (typeof x === "string" ? [clean(x)] : x && x.itemListElement ? steps(x.itemListElement) : x && (x.text || x.name) ? [clean(x.text || x.name)] : [])).filter(Boolean);
  const dur = (d) => { const m = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(d || "")) || /^PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(d || "")); if (!m) return ""; const h = +m[1] || 0, mi = +m[2] || 0; return (h ? h + " h " : "") + (mi ? mi + " min" : ""); };
  const nameOf = (v) => [].concat(v || []).map((x) => (typeof x === "string" ? clean(x) : x && x.name ? clean(x.name) : "")).filter(Boolean).join(", ");
  for (const b of blocks) {
    let j; try { j = JSON.parse(b.trim()); } catch (e) { continue; }
    const rec = walk(j, [])[0];
    if (!rec) continue;
    const ingredients = [].concat(rec.recipeIngredient || []).map(clean).filter(Boolean);
    const stepsOut = steps(rec.recipeInstructions);
    if (!ingredients.length && !stepsOut.length) continue;
    return {
      name: clean(rec.name),
      author: nameOf(rec.author),            // credit: who made it, as the page declares it
      publisher: nameOf(rec.publisher),
      yield: [].concat(rec.recipeYield || []).map(clean).filter(Boolean)[0] || "",
      prep: dur(rec.prepTime), cook: dur(rec.cookTime), total: dur(rec.totalTime),
      calories: rec.nutrition && rec.nutrition.calories ? clean(rec.nutrition.calories) : "",
      ingredients, steps: stepsOut,
    };
  }
  return null;
}

/** The same recipe as plain text (what the page declared, first, so truncation never drops it). "" when none. */
export function recipeFromHtml(raw) {
  const r = recipeDataFromHtml(raw);
  if (!r) return "";
  const times = [["Prep", r.prep], ["Cook", r.cook], ["Total", r.total]].filter(([, v]) => v).map(([k, v]) => k + " " + v).join(" · ");
  return ["Recipe: " + r.name, r.yield ? "Yield: " + r.yield : "", times, r.calories ? "Calories: " + r.calories : "", r.ingredients.length ? "Ingredients:\n" + r.ingredients.map((x) => "- " + x).join("\n") : "", r.steps.length ? "Instructions:\n" + r.steps.map((x, i) => (i + 1) + ". " + x).join("\n") : ""].filter(Boolean).join("\n");
}

/** Read a page's text: direct first, then the public proxies, then the text
 *  readers. Returns { ok, text, title, via, url } — `via` names who fetched it
 *  (a third party learns the address when a proxy/reader is used). */
// THE LIBRARIAN'S MEMORY. A tab keeps what it has already read (a follow-up about the
// same pages costs no fetch) and which hosts turned it away through every door (they
// are not tried again for a while). The caller owns it: pass one `memo` per tab.
export function makeMemo({ backgroundSeed = SNIPPET_SEED } = {}) { return { pages: new Map(), dead: new Map(), background: makeBackground(backgroundSeed) }; }
export const MEMO_TTL_MS = 10 * 60 * 1000;
export const DEAD_HOST_MS = 5 * 60 * 1000;
export const MEMO_MAX_PAGES = 40;
// A gateway that has not answered in this long is not going to help: a page that is
// reachable at all answers in a second or two (measured: 100 ms–2 s), and the public
// proxies' failures took 8 s each to arrive.
export const GATEWAY_BUDGET_MS = 3500;
export const DOOR_TTL_MS = 10 * 60 * 1000;   // E2: how long a door that has never answered is left alone
const DOORS = new Map();
const doorUp = (key) => { try { if (localStorage.getItem("fold-chat:e2doors") === "off") return true; } catch {} const d = DOORS.get(key); if (!d) return true; if (Date.now() - d.at > DOOR_TTL_MS) { DOORS.delete(key); return true; } return !(d.fail >= d.limit && d.ok === 0); };
const doorSaw = (key, ok, limit) => { const d = DOORS.get(key) || { ok: 0, fail: 0, at: Date.now(), limit }; if (ok) d.ok++; else d.fail++; d.at = Date.now(); DOORS.set(key, d); };
export const _doors = DOORS;
export const WEB_GRACE_MS = 2000;   // E2: once another source has answered with a usable list, how much longer the open web may keep the turn waiting
export const READ_GRACE_MS = 1500;   // E2: once enough pages are read, how long reads still in flight may keep the turn waiting
export const DIRECT_BUDGET_MS = 1500;   // E2: the browser's own read of a page; past it the relay chain is tried
const hostKey = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const WIKI_RE = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i;

/** A response that is not text (an image, a font or a download served to a page request, read as UTF-8, comes back as replacement characters and control bytes).
 *  It is turned away like a blocked page: quoting `��%q&k…` as a source is worse than having no source. */
export function looksBinary(s) {
  const t = String(s || "").slice(0, 4000);
  if (t.length < 40) return false;
  if (t.includes("\u0000")) return true;
  let bad = 0;
  for (const ch of t) { const c = ch.codePointAt(0); if (c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 0x7f && c < 0xa0)) bad++; }
  return bad / t.length > 0.05;
}

export async function readText(url, { fetchImpl = fetch, timeoutMs = 8000, memo = null, direct = false } = {}) {
  const now = Date.now();
  const host = hostKey(url);
  if (memo) {
    const hit = memo.pages.get(url);
    if (hit && now - hit.at < MEMO_TTL_MS) return { ...hit.val, cached: true };
    const dead = memo.dead.get(host);
    if (dead && now < dead) return { ok: false, text: "", title: "", via: null, url, error: "turned away on every door a moment ago — not tried again yet" };
  }
  const out = await readTextUncached(url, { fetchImpl, timeoutMs, direct });
  if (memo) {
    if (out.ok) {
      memo.pages.set(url, { at: Date.now(), val: out });
      while (memo.pages.size > MEMO_MAX_PAGES) memo.pages.delete(memo.pages.keys().next().value);
    } else if (out.error === "unreachable" && host) memo.dead.set(host, Date.now() + DEAD_HOST_MS);
  }
  return out;
}

async function readTextUncached(url, { fetchImpl = fetch, timeoutMs = 8000, direct = false } = {}) {
  const titleOf = (raw) => oneLine(((String(raw).match(/<title[^>]*>([^<]*)/i) || [])[1] || ""));
  // Read a body but STOP at MAX_RAW: a full `r.text()` can buffer many MB of a
  // directory/proxy page before we slice it; streaming bounds memory so the
  // browser tab cannot OOM on the multi-entity read fan-out.
  const MAX_RAW = 600000;
  const readCapped = async (res) => {
    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const chunks = [];
    let len = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const part = new TextDecoder().decode(value);
      chunks.push(part); len += part.length;
      if (len > MAX_RAW) { try { await reader.cancel(); } catch (e) {} break; }
    }
    return chunks.join("").slice(0, MAX_RAW);
  };
  const attempt = async (target, via, ctl, ms = timeoutMs) => {
    const r = await fetchT(fetchImpl, target, ms, null, ctl ? ctl.signal : null);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const raw = await readCapped(r);
    if (looksBinary(raw)) throw new Error("not text");
    let text = stripTags(raw);
    const recipe = /ld\+json/i.test(raw) ? recipeDataFromHtml(raw) : null;
    // how the page's own creator says to reach them (kept only when the page offered something; used only if the person clicks 'Tip the creator')
    const contacts = /<(a|form|script|rss|feed|rdf:RDF)\b/i.test(raw) || /\/humans\.txt$/i.test(url) ? contactsOfRaw(raw, url) : null;   // a feed (route 2) and humans.txt (route 3) are read for the creator's name too
    // a HowTo / FAQPage / QAPage the page declares: carried so the Sources-only answer can quote it whole
    const declared = /ld\+json/i.test(raw) ? declaredBlocksFromHtml(raw) : [];
    { const rec = recipe ? recipeFromHtml(raw) : ""; if (rec) text = rec + "\n\n" + text; }
    // r.jina.ai / microlink wrap the text; unwrap.
    if (/^\s*\{/.test(raw)) { try { const j = JSON.parse(raw); text = stripTags((j.data && (j.data.text || j.data.content)) || ""); } catch (e) {} }
    else if (raw.includes("Markdown Content:")) text = raw.split("Markdown Content:").slice(1).join("Markdown Content:").trim();
    if (looksBlocked(text)) throw new Error("blocked");
    if (looksDisambiguation(text)) throw new Error("disambiguation");   // a list of senses is a pointer, never a source
    if (text.length < 40) throw new Error("too short");
    if (text.length > 24000) text = text.slice(0, 24000);
    return { ok: true, text, title: titleOf(raw) || oneLine(text.split("\n")[0]).slice(0, 80), via, url, ...(recipe ? { recipe } : {}), ...(declared.length ? { declared } : {}), ...(contacts ? { contacts } : {}) };
  };
  // WIKIPEDIA HAS AN INDEX, NOT JUST PAGES. Its plain-text extract is the article's prose
  // (no markup, no tables, no DOM to parse) in ~200 ms, CORS-open — against ~900 KB of HTML
  // that a DOMParser then walks. A refusal or an unexpected shape falls through to the page.
  { const m = WIKI_RE.exec(url);
    if (m) {
      try {
        const title = decodeURIComponent(m[2]).replace(/_/g, " ");
        const api = `https://${m[1]}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
        const r = await fetchT(fetchImpl, api, Math.min(timeoutMs, GATEWAY_BUDGET_MS * 2), null, null);
        if (r.ok) {
          const j = await r.json();
          const pages = (j && j.query && j.query.pages) || {};
          const pg = pages[Object.keys(pages)[0]];
          const text = pg && typeof pg.extract === "string" ? cleanText(pg.extract) : "";
          if (text.length >= 200 && !looksDisambiguation(text)) return { ok: true, text: text.slice(0, 24000), title: (pg.title || title) + " - Wikipedia", via: "direct", url };
          // a DISAMBIGUATION extract falls through to the HTML path, where looksDisambiguation drops it as a source
        }
      } catch (e) {}
    } }
  const dKey = "direct:" + hostKey(url);
  if (direct || doorUp(dKey)) { try { const v = await attempt(url, "direct", null, (() => { try { return localStorage.getItem("fold-chat:e2cap") === "off" ? timeoutMs : Math.min(timeoutMs, DIRECT_BUDGET_MS); } catch { return Math.min(timeoutMs, DIRECT_BUDGET_MS); } })()); doorSaw(dKey, true, 1); return v; } catch (e) { if (!(e && e.name === "AbortError")) doorSaw(dKey, false, 1); } }   // E2: a CORS-closed host answers only to be refused (5-7 s measured); the relay chain follows as before
  // AN EXTENSION'S OWN FETCH IS THE DOOR: it has host permissions, so a refusal here is the site's own,
  // and no proxy or text reader (each a third party that would learn the address) could change it.
  if (direct) return { ok: false, text: "", title: "", via: null, url, error: "refused", direct: true };
  // This machine's own bridge next: no CORS wall, and no third party learns the address.
  if (LOCAL_BRIDGE) { try { return await attempt(`${LOCAL_BRIDGE}/api/page?url=${encodeURIComponent(url)}`, "this machine", null); } catch (e) {} }
  // Fire the proxy/reader chain but ABORT the losers once one wins — otherwise
  // every losing attempt keeps its buffered body (up to MAX_RAW) alive until
  // it times out, multiplying memory across the batch.
  const firstOf = async (makers) => {
    const ctl = new AbortController();
    // A failed attempt becomes null (via .catch); only a REAL non-null result
    // counts — so race on values, ignoring nulls, and abort the rest once one
    // wins. (Promise.any would grab the first resolved null and drop the win.)
    let done = false;
    return await new Promise((resolve) => {
      let pending = makers.length;
      for (const mk of makers) {
        mk(ctl)
          .then((v) => { if (v && !done) { done = true; ctl.abort(); resolve(v); } else if (--pending === 0) resolve(null); })
          .catch(() => { if (--pending === 0) resolve(null); });
      }
    });
  };
  const viaProxy = await firstOf(CORS_PROXIES.map((p, i) => ({ p, i })).filter(({ i }) => i === 0 || doorUp("proxy:" + i)).map(({ p, i }) => (ctl) => attempt(p(url), i === 0 ? "the fold's relay" : "a public proxy", ctl, Math.min(timeoutMs, GATEWAY_BUDGET_MS)).then((v) => { if (i) doorSaw("proxy:" + i, true, 6); return v; }, (e) => { if (i && !(e && e.name === "AbortError")) doorSaw("proxy:" + i, false, 6); throw e; })));
  if (viaProxy) return viaProxy;
  const viaReader = await firstOf(TEXT_READERS.map((rd) => (ctl) => attempt(rd(url), "a text reader", ctl, Math.min(timeoutMs, GATEWAY_BUDGET_MS))));
  if (viaReader) return viaReader;
  return { ok: false, text: "", title: "", via: null, url, error: "unreachable" };
}

// The relay's web search answers in ~2 s when its upstreams are well and 15–18 s when they
// are throttling it (measured). Every other source answers in 200–400 ms, so none of them waits
// for it: past this budget the turn goes on without the web and says so.
export const WEB_BUDGET_MS = 6000;

// What a read page is reduced to: enough sentences to answer from, never the page.
export const IMPRESSION_BUDGET = 3000;

/** Resolve as soon as any promise fulfills; if none do, resolve [] (no reject). */
async function allSettledFirst(promises) {
  return new Promise((resolve) => {
    let pending = promises.length, done = false;
    if (!pending) return resolve([]);
    for (const p of promises) p.then((v) => { if (v && !done) { done = true; resolve([v]); } else if (--pending === 0) resolve([]); }, () => { if (--pending === 0) resolve([]); });
  });
}

/** Proper-noun entities in a question (the names the ask is ABOUT). Empty when
 *  the ask has no names. Used by queriesFor (per-entity searches) and by the
 *  on-topic gate (which results to READ). */
const PROPER_NOUN_RE = /(?<![\p{L}\p{N}])(\p{Lu}[\p{L}\p{N}.'-]*(?:\s+[\p{Lu}][\p{L}\p{N}.'-]*)*)/gu;
const PROPER_STOP = new Set(["Compare", "Contrast", "The", "And", "What", "Which", "Tell", "How", "When", "Where", "Who", "Find", "Show", "Give", "Also", "Between", "From", "With", "About", "Was", "Were", "Is", "Are", "Does", "Did", "Do", "Can", "Could", "Should", "Would", "Will", "Has", "Have", "Had", "Why", "Whose", "Whom", "Explain", "Describe", "List", "Write", "Make", "Please", "Hey", "Hi", "Hello", "And", "But", "So",
  // interrogatives and openers of the other languages we answer in (a question word is never a name)
  "Qué", "Cuál", "Cuáles", "Cómo", "Cuándo", "Dónde", "Quién", "Quiénes", "Cuánto", "Cuántos", "Quel", "Quelle", "Quels", "Quelles", "Comment", "Quand", "Où", "Qui", "Quoi", "Pourquoi", "Combien", "Wie", "Wer", "Wann", "Wo", "Warum", "Welche", "Welcher", "Welches", "Wieviel", "Qual", "Quais", "Quem", "Quando", "Onde", "Como", "Quanto", "Quantos", "Porque", "Chi", "Quale", "Quali", "Dove", "Perché", "Quanti", "Hoe", "Waar", "Wanneer", "Wat"]);
function properNouns(q) {
  const src = String(q ?? "");
  const out = [];
  for (const m of src.matchAll(PROPER_NOUN_RE)) {
    // "What's" / "Where's" / "Henderson's": the stem is what names something, and a
    // possessive or contraction suffix is never part of a name.
    let t = m[1].trim().replace(/['’]s\b/gi, "").replace(/['’](?:ll|re|ve|d|m|t)\b/gi, "");
    // A SENTENCE-INITIAL single capitalised word is an opener, not a name (the gate used to
    // demand that every result mention the word "What's"; measured 2026-10-05: a recipe ask
    // read nothing). Same rule as fold-chat-mind.js::casedRuns.
    const before = src.slice(0, m.index);
    const atStart = /^\s*$/.test(before) || /[.!?¿¡]\s*$/.test(before);
    // An opener that the run joined to a name ("Was Henderson's…") is shed from the front.
    { const parts = t.split(/\s+/); while (parts.length && atStart && PROPER_STOP.has(parts[0])) parts.shift(); t = parts.join(" "); }
    if (atStart && !/\s/.test(t) && t === m[1].trim().replace(/['’]s\b/gi, "")) continue;
    if (t.length > 2 && !PROPER_STOP.has(t)) out.push(t);
  }
  return out;
}
export function entitiesOf(q) { return [...new Set(properNouns(q))].slice(0, 6); }

/** Split a comparison/list question into per-entity queries so a "Compare the
 *  founding of Canberra, Brasília, Ottawa, Washington" is searched as each city,
 *  not one bag of words whose top hit is whatever page happens to contain all of
 *  them (measured: the whole-question query returned "Snowden disclosures"). */
export function queriesFor(query) {
  const q = String(query ?? "").trim();
  if (!q) return [];
  const uniq = [...new Set(properNouns(q))];
  if (uniq.length >= 2) return uniq.slice(0, 4);
  return [q];
}

/** A people-record / relationship source, or a page that says a relation in
 *  words: "board of directors", "investor", "married", "serves on", and the
 *  people-record domains. This is the framing that separates "Spencer Liff"
 *  (a film-list mention) from "Zachary Liff — investor" (a record). */
const RELATION_RE = /\b(board of directors|board|chair|president|co-?founder|founder|director|owner|partner|married|spouse|wife|husband|son|daughter|father|mother|brother|sister|cousin|investor|real estate|ceo|executive|managing|principal|chairman|invests?|serves? (?:on|as)|leads?|runs?|founded|co-?owns?|executive director|general counsel|capital(?: city)?|established)\b/i;
const PEOPLE_RECORD_RE = /\b(spokeo|whitepages|mylife|elementix|linkedin|boards?|leadership|people|records|profiles?|directory|reputation|biograph)\b/i;

/** THE SWARM — three independent framings of a candidate result contend; a snip
 *  matters iff they CONVERGE. This is the difference that makes a difference:
 *  not mere mention ("Liff" in a film list — a difference that makes no
 *  difference), but co-reference of the ask's named subjects in a people-record/
 *  relationship source. Each framing is independent; dissent is disclosed.
 *
 *    identity — the exact named entity is present ("zachary liff"), or the one
 *               subject of a single-name ask
 *    coref    — TWO or more of the ask's named subjects co-occur (judy + liff,
 *               liff + nashville): the strongest signal for a relationship
 *    record   — the page is a people-record/relationship source or says a
 *               relation in words
 *
 *  Convergence: a multi-subject ask needs coref AND (identity OR record) — so a
 *  page naming "Spencer Liff" (coref 1, not a record) dies, while "Judy Liff,
 *  Nashville" (coref 2, a record) lives. A single-subject ask needs identity. */
export function framings(r, entities = []) {
  if (!entities.length) return { identity: true, coref: true, record: true, matters: true, present: [] };
  const hay = one(String(r.title || "") + " " + String(r.snippet || "") + " " + String(r.url || "")).toLowerCase();
  const multi = entities.filter((e) => String(e).split(/\s+/).length >= 2 && e.length > 3);
  const single = entities.filter((e) => String(e).split(/\s+/).length === 1 && e.length > 2);
  const surnames = multi.flatMap((e) => String(e).split(/\s+/).slice(1));
  const subjects = [...new Set([...multi, ...surnames, ...single])].filter((s) => s.length > 2);
  const present = subjects.filter((s) => hay.includes(String(s).toLowerCase()));
  const identity = multi.some((e) => hay.includes(String(e).toLowerCase()))
    || (!multi.length && single.some((e) => hay.includes(String(e).toLowerCase())));
  const coref = present.length >= 2;
  const record = PEOPLE_RECORD_RE.test(hay) || RELATION_RE.test(hay);
  const matters = multi.length ? (coref && (identity || record)) : identity;
  return { identity, coref, record, matters, present: present.slice(0, 4) };
}

/** Content words of a question (no names to anchor on): length >= 4, not a declared function word.
 *  Language-neutral by construction: a script that has no such tokens yields none, and the gate
 *  then asks nothing of the result (never 'no beings'). The function-word list is the chat's own
 *  hand-typed set — a declared stopgap until the ethos-derived closed class replaces it (II.11). */
const FUNCTION_WORDS = new Set(["what", "whats", "which", "that", "this", "these", "those", "with", "from", "about", "there", "their", "where", "when", "will", "would", "could", "should", "have", "does", "good", "best", "some", "give", "tell", "make", "need", "want", "like", "into", "than", "then", "them", "they", "your", "you're", "much", "many", "most", "more", "also", "just", "very", "really", "please", "show", "find", "help"]);
export function contentTerms(q) {
  const toks = String(q ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u; // a run of these is a sentence, not a word
  return [...new Set(toks.filter((t) => t.length >= 4 && !FUNCTION_WORDS.has(t) && !/^\d+$/.test(t) && !UNSPACED.test(t)))];
}

/** The on-topic gate, pure. With named entities: the swarm's convergence (see `framings`).
 *  With none: a result must share at least one content word of the question in its
 *  title/snippet/url. If the gate would pass NOTHING, it does not leave the turn with nothing to
 *  read: it falls back to the ranked list and says so (`fallback`), so a bad gate shows up in the
 *  trace instead of as 'no sources'. */
export function applyGate(poolAll, entities, query, cfg = {}) {
  const hasMulti = entities.some((e) => String(e).split(/\s+/).length >= 2);
  const terms = entities.length ? [] : contentTerms(query);
  const ok = (r) => {
    if (!entities.length) {
      if (!terms.length) return true;
      const hay = one(String(r.title || "") + " " + String(r.snippet || "") + " " + String(r.url || "")).toLowerCase();
      return terms.some((t) => hay.includes(t));
    }
    const f = framings(r, entities);
    if (!cfg.strict) return f.matters;
    return hasMulti ? (f.coref && f.record) : (f.identity && f.record);
  };
  let pool = poolAll.filter(ok);
  const skippedOff = poolAll.length - pool.length;
  const why = {};
  for (const r of poolAll) if (!ok(r)) {
    const f = entities.length ? framings(r, entities) : null;
    const k = !f ? "no-content-word" : f.identity && f.coref ? "identity" : f.coref ? "coref-only" : f.identity ? "identity-only" : "none";
    why[k] = (why[k] || 0) + 1;
  }
  let fallback = false;
  if (!pool.length && poolAll.length) { pool = poolAll.slice(0, Math.max(3, cfg.read || 3)); fallback = true; }
  return { pool, skippedOff, why, fallback };
}

// ── the TITLE gate: read the entity's own page before pages that merely share its name ───────────────────────
// Measured 2026-10-05 ("Who founded the city of Nashville, and when?"): the swarm gate passes every result that
// MENTIONS "Nashville", so 'Nashville SC' and a school-shooting page were read for a founding question — and the
// retrieved text then tripped the model channel's safety gate. A page whose own title (entityFromTitle, the
// site-name and "(disambiguation)" wrapper shed) shares no word with the ask, or only carries the entity as part of
// a longer name for ANOTHER thing, is moved behind the candidates that fit, so it is read only if the others fail.
const stemOf = (w) => { const f = fold(w); return f.length > 5 ? f.slice(0, 5) : f; };
const wordsOf = (t) => (fold(t).match(/[\p{L}\p{N}]+/gu) || []);
/** A title word shares a stem with the ask when the 5-char stems are equal OR one stem is a prefix of the other (both >= 4 chars):
 *  measured 2026-10-05 — "Who is the king of the UK?" demoted Monarchy of the United Kingdom ("kingd" vs "king") and read three films
 *  called "…Would Be King" instead, so the model answered from memory. Prefix sharing is language-neutral (no word list); a caseless
 *  script has no 4-char stems and is untouched. */
export function sharesStem(word, stems) {
  const s = stemOf(word);
  if (stems.has(s)) return true;
  if (s.length < 4) return false;
  for (const a of stems) if (a.length >= 4 && a !== s && (a.startsWith(s) || s.startsWith(a))) return true;
  return false;
}
const TITLE_SEP = /\s+[|\u2014\u2013\u00b7:]\s+|\s-\s/;
/** The words a result's own TITLE gives, the page name first: "Nashville, Tennessee - Wikipedia" → "Nashville, Tennessee". */
export function pageNameOf(title) { const t = entityFromTitle(title); const first = String(t).split(TITLE_SEP)[0]; return (first || t).trim(); }
/** Is this title the entity's OWN page: the entity alone, or the entity then a comma / parenthetical qualifier? */
export function isOwnPage(title, entity) {
  const n = fold(pageNameOf(title)).trim(), e = fold(entity).trim();
  if (!n || !e) return false;
  return n === e || n.startsWith(e + ",") || n.startsWith(e + " (");
}
/** Judge each pooled result's title against the ask. Returns { pool, off:[{ title, why }] } with the off-topic
 *  titles moved to the END of the pool (never deleted: they are read only if every better candidate failed). Pure.
 *    "no-shared-word"      — the title shares no content word (stem-matched) and no named entity of the ask;
 *    "shares-only-the-name" — the title carries an entity of the ask inside a longer name for another thing
 *                            ("Nashville SC", "Nashville school shooting") while another candidate IS the entity's own
 *                            page and the title shares nothing else the ask said. */
export function titleGate(pool, query, entities = entitiesOf(query)) {
  const list = Array.isArray(pool) ? pool : [];
  if (list.length < 2) return { pool: list, off: [] };
  const entWords = new Set(entities.flatMap((e) => wordsOf(e)).map(stemOf));
  const askStems = new Set([...contentTerms(query), ...entities.flatMap((e) => wordsOf(e))].map(stemOf));
  const plainStems = new Set(contentTerms(query).map(stemOf).filter((x) => !entWords.has(x)));   // what the ask says besides the names
  if (!askStems.size) return { pool: list, off: [] };
  const hasOwn = entities.length > 0 && list.some((r) => entities.some((e) => isOwnPage(r.title, e)));
  const verdict = (r) => {
    const name = pageNameOf(r.title);
    const tw = wordsOf(name);
    if (!tw.length) return null;
    if (!tw.some((w) => sharesStem(w, askStems))) return "no-shared-word";
    if (hasOwn && !entities.some((e) => isOwnPage(r.title, e)) && entities.some((e) => mentions(name, e)) && !tw.some((w) => plainStems.has(stemOf(w)))) {
      const extra = tw.filter((w) => !askStems.has(stemOf(w)));
      if (extra.length) return "shares-only-the-name";
    }
    return null;
  };
  const keep = [], off = [];
  for (const r of list) { const why = verdict(r); (why ? off : keep).push(why ? { r, why } : r); }
  if (!keep.length) return { pool: list, off: [] };    // nothing fits better: leave the order alone
  return { pool: [...keep, ...off.map((o) => o.r)], off: off.map((o) => ({ title: String(o.r.title || ""), url: o.r.url || null, why: o.why })) };
}

/** Is a search result ON-TOPIC for the ask? The swarm's verdict. */
export function onTopic(r, entities = []) {
  return framings(r, entities).matters;
}

/** Search several scopes at once, then read the top results into passages the
 *  turn can be grounded on. Returns { results, passages, trace }. A multi-entity
 *  question is searched per entity and merged, so the passages are about the
 *  entities asked for. Only ON-TOPIC results are read — the rest are skipped
 *  and named in the trace, never fetched. */
export const EFFORT = {
  // fast: one web search, 2 reads, no swarm gate, no entity split
  fast: { scopes: ["web"], read: 2, gate: false },
  // balanced: full scopes + per-entity split + swarm gate (the default)
  balanced: { scopes: ["web", "wikipedia", "github", "archive", "openalex", "crossref"], read: 3, gate: true },
  // deep: all scopes, MANY reads, the swarm gate (same as balanced — the harder
  // thinking happens in the FALSIFY pass on the claims, not by starving reads),
  // plus the falsify pass which re-checks every grounded claim.
  deep: { scopes: ["web", "wikipedia", "github", "archive", "openalex", "crossref"], read: 6, gate: true, strict: false, falsify: true },
};

/** The effort levels in menu order, with the label and the one-line promise the
 *  composer shows for each. The levers themselves are EFFORT above. */
export const EFFORT_LEVELS = [
  { key: "fast", label: "Fast", note: "1 web search · 2 reads · quick" },
  { key: "balanced", label: "Balanced", note: "full scopes · swarm gate · void" },
  { key: "deep", label: "Deep", note: "6+ reads · strict swarm · falsify every claim" },
];

/** A known effort key, or the fallback. Never throws on stored junk. */
export function normEffort(v, fallback = "balanced") {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(EFFORT, v) ? v : fallback;
}

/** The effort a stored turn ran with. For a user message: its own `effort`, else
 *  the grounding record of the assistant message that answered it. For an
 *  assistant message: its record's `effort`, else the user message before it.
 *  null when the turn predates per-turn effort and carries no record. */
export function effortOfTurn(messages, index) {
  const msgs = Array.isArray(messages) ? messages : [];
  const m = msgs[index];
  if (!m) return null;
  const rec = (x) => (x && x.role === "assistant" && x.grounding && typeof x.grounding.effort === "string" ? normEffort(x.grounding.effort, null) : null);
  if (m.role === "assistant") {
    if (rec(m)) return rec(m);
    for (let i = index - 1; i >= 0; i--) if (msgs[i].role === "user") return typeof msgs[i].effort === "string" ? normEffort(msgs[i].effort, null) : null;
    return null;
  }
  if (typeof m.effort === "string" && normEffort(m.effort, null)) return m.effort;
  for (let j = index + 1; j < msgs.length; j++) if (msgs[j].role === "assistant") return rec(msgs[j]);
  return null;
}

/** Which effort a RE-RUN (edit / continue / fork-and-run / run as / build this)
 *  uses: the original turn's, unless the person has moved the composer's control
 *  since the last send (`changed`) — then what they chose now. A fresh send has
 *  no original and always takes the composer's value. */
export function resolveEffort({ original = null, composer = "balanced", changed = false } = {}) {
  const c = normEffort(composer);
  if (changed) return c;
  return normEffort(original, c);
}

/** Candidates kept BEHIND the ones we want to read: a read can fail (paywall, bot wall, CORS), and a failed
 *  read is replaced by the next candidate rather than left as a hole. Declared, not measured: the 2026-10-05
 *  recipe trace lost 2 of its first 3 reads to a paywall. */
const EXTRA_CANDIDATES = 4;
export async function searchWeb(query, { scopes = EFFORT.balanced.scopes, read = EFFORT.balanced.read, effort = "balanced", perScope = 4, fetchImpl = fetch, onStep = null, route = true, memo = null, webBudgetMs = WEB_BUDGET_MS, direct = isExtension(), snippetFirst = false } = {}) {   // as the extension: asked directly, no relay, no proxy, no reader
  const cfg = EFFORT[effort] || EFFORT.balanced;
  scopes = cfg.scopes;
  read = cfg.read;
  const step = (s) => { if (onStep) { try { onStep(s); } catch (e) {} } };
  const trace = [];
  const results = [];
  const queries = queriesFor(query);
  const askEdition = wikiEdition(query);   // the asker's language edition of Wikipedia (English when unsure)
  // The OPEN-WEB scope searches the FULL natural query — DDG/Brave handle the
  // whole ask best ("Judy Liff Zachary Liff Nashville" surfaces people records;
  // a split "Judy" returns Wikipedia). The API scopes (Wikipedia, GitHub, …)
  // search PER ENTITY, because a bag-of-words query to them returns whatever
  // page happens to mention all the names (measured: "Snowden disclosures").
  const settled = [];
  let firstApiAt = null;
  const runScope = async (q, s, state = null) => {
    step({ phase: "searching", scope: s, q });
    try {
      const out = await search(s, q, 0, { fetchImpl, direct, lang: s === "wikipedia" ? askEdition : "en" });
      if (state && state.webClosed) return { ok: false, list: [] };   // answered after the budget: the turn has gone on
      trace.push({ scope: s, q, engine: out.engine, n: out.results.length, ok: true });
      step({ phase: "found", scope: s, q, engine: out.engine, n: out.results.length });
      const list = out.results.map((r) => ({ ...r, _q: q })).slice(0, Math.max(perScope, read + EXTRA_CANDIDATES));
      settled.push(list);
      if (s !== "web" && firstApiAt == null && list.length >= 3) firstApiAt = Date.now();
      return { ok: true, list };
    } catch (e) {
      if (state && state.webClosed) return { ok: false, list: [] };
      if (isRateLimitError(e)) noteRateLimited(s);
      trace.push({ scope: s, q, ok: false, why: String(e.message || e) });
      step({ phase: "failed", scope: s, q, why: String(e.message || e) });
      settled.push([]);
      return { ok: false, list: [] };
    }
  };
  // ALL AT ONCE. The open web, on the FULL natural question, and every source the ask itself
  // calls for run together; none waits behind another. (They used to run one after another:
  // a 17 s relay call held Wikipedia's 300 ms answer behind it.)
  const apiAll = scopes.filter((s) => s !== "web");
  const base = route && apiAll.length ? routeSources(query, { only: scopes, lang: askEdition }) : null;
  const upfront = base ? apiAll.filter((s) => base.scopes.includes(s)) : apiAll;
  const runApi = (list) => Promise.all(queries.flatMap((q) => list.map((s) => {
    if (coolingDown(s)) { trace.push({ scope: s, q, ok: false, why: "cooling down after a rate limit" }); step({ phase: "failed", scope: s, q, why: "cooling down after a rate limit" }); return null; }
    return runScope(q, s);
  })));
  const state = { webClosed: false };
  const webRun = scopes.includes("web") ? runScope(query, "web", state) : Promise.resolve({ ok: true, list: [] });
  const apiRun = runApi(upfront);
  let timer = null;
  const wg = (() => { try { return localStorage.getItem("fold-chat:e2webgrace") === "off" ? Infinity : WEB_GRACE_MS; } catch { return WEB_GRACE_MS; } })();
  const webOrLate = new Promise((res) => { timer = setTimeout(() => res(null), webBudgetMs); const iv = setInterval(() => { if (firstApiAt != null && Date.now() - firstApiAt > wg) { clearInterval(iv); res(null); } }, 50); setTimeout(() => clearInterval(iv), webBudgetMs + 100); });
  const webGot = await Promise.race([webRun, webOrLate]);
  clearTimeout(timer);
  let web = webGot;
  if (!webGot) {
    // Slow. The budget releases the web ONLY when something else has answered — if every
    // other source came back empty (or none applies), the web is the turn's one way to an
    // answer, and leaving it would trade a slow success for a fast nothing.
    await apiRun;
    if (settled.some((l) => l.length)) {
      state.webClosed = true;
      web = { ok: false, list: [] };
      trace.push({ scope: "web", q: query, ok: false, why: `no answer in ${Math.round(webBudgetMs / 1000)} s — went on without the web` });
      step({ phase: "failed", scope: "web", q: query, why: `slow (over ${Math.round(webBudgetMs / 1000)} s) — went on without it` });
    } else {
      step({ phase: "waiting", scope: "web", why: "nothing else answered — waiting for the web" });
      // HARD CAP (E2 L10b): even when nothing else answered, do not wait on the web forever — the turn's own clock is
      // the answer tier's 2 x ms. Past it, give up with a typed line so the person is never left on a silent counter.
      const hardMs = (() => { try { return localStorage.getItem("fold-chat:e2webhard") === "off" ? Infinity : Math.max(webBudgetMs * 2, 20000); } catch { return Math.max(webBudgetMs * 2, 20000); } })();
      let hard = null;
      web = await Promise.race([webRun, new Promise((res) => { hard = Number.isFinite(hardMs) ? setTimeout(() => res(null), hardMs) : null; })]);
      if (hard) clearTimeout(hard);
      if (!web) {
        state.webClosed = true;
        web = { ok: false, list: [] };
        trace.push({ scope: "web", q: query, ok: false, why: `no answer in ${Math.round(hardMs / 1000)} s — gave up so the turn can go on` });
        step({ phase: "failed", scope: "web", q: query, why: `still nothing after ${Math.round(hardMs / 1000)} s — gave up` });
      }
    }
  }
  await apiRun;
  // WHERE ELSE TO LOOK: what the web just returned can call for a specialist the ask did not
  // (journals → papers). Only those run now; route off → every scope already ran above.
  let apiScopes = upfront;
  if (base) {
    const probe = probeSources(web.list, base.scopes);
    // Web down (no results): do NOT widen to every source — that reads whatever Wikipedia has on
    // the question's stray words (measured: a pancake recipe ask read Okonomiyaki, Recipe and
    // Shrove Tuesday). Keep only the sources the question's own cues justify, plus Wikipedia for
    // a plain what/who/when/where ask (factualAsk), which is what it is good for.
    const webDown = scopes.includes("web") && !web.list.length;
    // Web down: the one encyclopedia that answers a plain what/who/when/where ask is still allowed (in the asker's language);
    // nothing else is widened to.
    const wikiAllowed = webDown && factualAsk(query) && apiAll.includes("wikipedia") && !upfront.includes("wikipedia");
    const extra = webDown ? (wikiAllowed ? ["wikipedia"] : []) : probe.add.filter((x) => apiAll.includes(x) && !upfront.includes(x));
    if (extra.length) await runApi(extra);
    apiScopes = [...upfront, ...extra];
    const skipped = scopes.filter((x) => x !== "web" && !apiScopes.includes(x));
    trace.push({ scope: "route", ok: true, engine: "source router", picked: ["web", ...apiScopes], skipped, why: { ...base.why, ...(webDown ? (wikiAllowed ? { wikipedia: "web down: a plain factual ask may still read the encyclopedia" } : {}) : probe.why) }, webDown });
    step({ phase: "routed", picked: ["web", ...apiScopes], skipped, webDown });
  }
  for (const list of settled) results.push(...list);
  // THE CATALOG CARD BEFORE THE BOOK (off by default until experiments/source-routing/RESULTS.md says it earns
  // its place): when independent sites' own snippets agree on a rare term about what the ask is about, the cards
  // are handed over as snippets and no page is fetched. Only the web engines' cards are judged (that is what was
  // measured); the tab's background memory learns the SERP AFTER it is judged. `deep` always reads.
  {
    const cards = results.filter((r) => r.kind === "web");
    const bg = memo && memo.background;
    if (cards.length && (snippetFirst || bg)) {
      const sf = snippetFirst && effort !== "deep" ? snippetsSufficient(cards, query, { background: bg }) : null;
      if (sf) trace.push({ scope: "snippets", ok: true, engine: "catalog cards", sufficient: sf.sufficient, abstained: sf.abstained, why: sf.why, hosts: sf.hosts, lang: sf.lang, term: sf.term });
      if (bg) learnBackground(bg, sf ? sf.lang : languageOf(query, cards), cards);
      if (sf && sf.sufficient) {
        const passages = snippetPassages(sf.covering);
        for (const p of passages) step({ phase: "snippet", url: p.url, site: p.source, title: p.ref });
        return { results, passages, trace };
      }
    }
  }
  // Read the top few into passages (the material the answer is grounded on).
  // Pages that answer a browser directly come first (Wikipedia articles read
  // as HTML); DOI/journal links often only serve PDFs or refuse cross-origin
  // reads, so they are tried last — and every read is time-boxed so one slow
  // host cannot hold the turn.
  const rank = (r) => (r.kind === "web" || /wikipedia\.org\/wiki\//.test(r.url) ? 0 : /(^|\.)doi\.org|pdf|\.pdf$/i.test(r.url) ? 3 : /github\.com/.test(r.url) ? 2 : 1);
  const ordered = [...results].sort((a, b) => rank(a) - rank(b));
  const readable = ordered.filter((r) => rank(r) < 3);
  const poolAll = readable.length ? readable : ordered;
  // ON-TOPIC GATE: only candidates that actually mention the named entities are
  // read. Off-topic results are skipped (and named in the trace), never fetched
  // — this is what keeps the fold from reading "Judy (film)" for a Judy Liff ask.
  const entities = entitiesOf(query);
  // The swarm gate is an EFFORT lever: fast skips it (reads whatever ranks top);
  // balanced uses the standard convergence; deep requires the strict quorum —
  // for a multi-subject ask that means identity AND co-reference AND record.
  let pool = poolAll;
  let skippedOff = 0;
  if (cfg.gate) {
    const g = applyGate(poolAll, entities, query, cfg);
    pool = g.pool; skippedOff = g.skippedOff;
    // THE TITLE GATE: a page named for another thing that shares the entity's name is read only after the entity's own pages.
    const tg = titleGate(pool, query, entities);
    if (tg.off.length) {
      pool = tg.pool;
      trace.push({ scope: "topic", ok: true, engine: "title gate", demoted: tg.off.map((o) => `${o.title} (${o.why})`) });
      step({ phase: "demoted", n: tg.off.length, titles: tg.off.map((o) => o.title) });
    }
    if (g.skippedOff > 0 || g.fallback) {
      trace.push({ scope: "topic", ok: true, skippedOff: g.skippedOff, engine: "swarm gate", strict: !!cfg.strict, dissent: g.why, ...(g.fallback ? { fallback: "the gate passed nothing; ranked top results read instead" } : {}) });
      if (g.skippedOff > 0) step({ phase: "skipped", n: g.skippedOff });
    }
  }
  // Diversify: take the best result PER query first (so each entity asked for
  // gets its own passage), then fill from the rest. Without this a single
  // entity's article can fill every read slot.
  const chosen = [], usedUrl = new Set(), perQuery = new Map();
  for (const r of pool) {
    if (!r.url || usedUrl.has(r.url)) continue;
    const q = r._q ?? "";
    if ((perQuery.get(q) || 0) >= 1) continue;
    perQuery.set(q, 1); usedUrl.add(r.url); chosen.push(r);
  }
  // A read can fail (paywall, bot wall, CORS): keep a few EXTRA candidates behind the ones we want, and read
  // down the list until enough succeed — a failed read is replaced, not a hole in the answer.
  for (const r of pool) { if (!r.url || usedUrl.has(r.url)) continue; if (chosen.length >= read + EXTRA_CANDIDATES) break; usedUrl.add(r.url); chosen.push(r); }
  const want = Math.min(read, chosen.length, 5);
  // Read with BOUNDED concurrency: each read parses a whole HTML document
  // (DOMParser) in the browser tab, and parsing many big pages at once OOMs the
  // renderer. Read a few at a time.
  // A POOL, NOT BATCHES: a slot that frees (a read that failed fast, or finished) starts the
  // next candidate at once, instead of waiting for the slowest page of its batch to give up.
  // Results are put back in RANK order below. Three at a time: each read parses a document.
  const reads = [];
  const CONC = 3;
  let okReads = 0, nextIdx = 0;
  const worker = async () => {
    while (okReads < want && nextIdx < chosen.length) {
      const i = nextIdx++;
      const r = chosen[i];
      step({ phase: "reading", url: r.url, site: r.source, title: r.title });
      const rd = await readText(r.url, { fetchImpl, timeoutMs: 8000, memo, direct });
      step({ phase: rd.ok ? "read" : "unread", url: r.url, site: r.source, title: r.title, via: rd.via, chars: rd.ok ? rd.text.length : 0, text: rd.ok ? String(rd.text).replace(/\s+/g, " ").slice(0, 1400) : "", kept: rd.ok ? impressionOf(rd.text, query, { budget: IMPRESSION_BUDGET }).shadow.kept : 0 });
      reads.push({ r, rd, i });
      if (rd.ok) okReads++;
    }
  };
  { const all = Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
    const graceMs = (() => { try { return localStorage.getItem("fold-chat:e2grace") === "off" ? Infinity : READ_GRACE_MS; } catch { return READ_GRACE_MS; } })();
    let release = null; const enough = new Promise((res) => { release = res; });
    const poll = setInterval(() => { if (okReads >= want) { clearInterval(poll); setTimeout(release, graceMs === Infinity ? 0 : graceMs); } }, 50);
    if (graceMs === Infinity) { clearInterval(poll); await all; } else { await Promise.race([all, enough]); clearInterval(poll); } }   // E2: enough pages read, do not wait for stragglers
  reads.sort((x, y) => x.i - y.i);
  // KEEP THE DIFFERENCE, NOT THE PAGE — for the model and the record. A read page (up to 24k chars) is reduced
  // to its IMPRESSION — the sentences that differ the ask — and a SHADOW (original length, fingerprint, byte
  // ranges). The full page stays in THIS TURN's memory only (`pages`, and `page` on each passage, non-enumerable so
  // it is never stored or sent): the REC loop recalls a failing claim against it and takes a NEW impression for that
  // claim (fold-chat-falsify-answer.js reImpress) before it searches again.
  const passages = [], pages = [];
  for (const { r, rd } of reads) {
    if (rd.ok) {
      const e = impressionOf(rd.text, query, { budget: IMPRESSION_BUDGET });
      const kept = { chars: e.shadow.chars, kept: e.shadow.kept, hash: e.shadow.hash };
      pages.push({ ref: r.source + " \u2014 " + r.title, url: r.url, text: rd.text, shadow: e.shadow, used: passages.length < want });
      if (passages.length < want) { const p = { ref: r.source + " — " + r.title, source: r.url, text: e.text, via: rd.via, url: r.url, shadow: e.shadow, ...(rd.recipe ? { recipe: rd.recipe } : {}), ...(rd.declared ? { declared: rd.declared } : {}), ...(rd.contacts ? { contacts: rd.contacts } : {}) }; Object.defineProperty(p, "page", { value: rd.text, enumerable: false }); passages.push(p); trace.push({ read: r.url, via: rd.via, ...kept }); }
      else trace.push({ read: r.url, via: rd.via, ...kept, skipped: true });
    } else trace.push({ read: r.url, via: null, ok: false });
  }
  // NOTHING READABLE is not NOTHING FOUND: when the search returned candidates but no page could be
  // read, the search engine's own snippets stand as sources — labelled as snippets, never as read
  // pages — so the turn answers from what was actually found instead of reporting an empty search.
  if (!passages.length) {
    for (const r of pool) {
      const sn = String(r.snippet || "").trim();
      if (!r.url || sn.length < 40 || passages.length >= 3) continue;
      passages.push({ ref: r.source + " — " + r.title, source: r.url, text: (r.title ? r.title + ". " : "") + sn, via: "snippet", url: r.url, snippetOnly: true });
      trace.push({ snippet: r.url, chars: sn.length });
      step({ phase: "snippet", url: r.url, site: r.source, title: r.title });
    }
  }
  return { results, passages, trace, pages };
}

// ── the slot-ask pipeline's two reads (fold-chat-answerwire.js hands them to fold-chat-answerturn.js as deps) ─────────────────────────
// Both go to the encyclopedia's own API and nothing else, so they work when the open-web relay is down. Neither runs for an ask that is
// not a slot ask (the chat only asks for them once askFrame has read a frame), and neither rewrites a word of what a page says.

/** THE LEAD OF THE PAGE A NAME LANDS ON — the search that NAMES the claim (the fold's own falsifier: "Charles III", not the ask).
 *  Searches the encyclopedia for `query`, takes the hit whose title is the query (case/diacritic-folded; else the top hit), and returns the
 *  introduction of that page: { title, extract, url } | null. A network failure rejects (the caller reports "could not check"). */
export async function wikiLead(query, { fetchImpl = fetch, lang = "en" } = {}) {
  const ed = WIKI_EDITIONS.has(lang) ? lang : "en";
  const q = String(query ?? "").trim();
  if (!q) return null;
  const found = await search("wikipedia", q, 0, { fetchImpl, lang: ed });
  const hits = (found.results || []).filter((r) => r && r.title && r.url);
  if (!hits.length) return null;
  const want = caseless(q);
  const hit = hits.find((r) => caseless(r.title) === want) || hits[0];
  const api = `https://${ed}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(hit.title)}`;
  const { r, j } = await getJson(fetchImpl, api, "Wikipedia");
  if (!r.ok || !j) throw new Error("Wikipedia answered " + r.status + ".");
  const pages = (j.query && j.query.pages) || {};
  const pg = pages[Object.keys(pages)[0]];
  const extract = pg && typeof pg.extract === "string" ? cleanText(pg.extract) : "";
  if (!extract) return null;
  return { title: String(pg.title || hit.title), extract, url: hit.url };
}

/** ONE WIDER READ for a slot ask: the pages the frame's own names lead to. The query is the frame's words only (its referents' titles and
 *  its predicate words — no interrogative), searched once on the encyclopedia; the top hits are read, and so are the pages the referent
 *  titles name (never more than `max` pages in all). → passages in the answer pipeline's shape:
 *  [{ ref, title, url, host, lang, text, query }]. A page that cannot be read is simply absent; a failed SEARCH rejects. */
export async function referentPassages(frame, { fetchImpl = fetch, memo = null, max = 4, lang = "en", maxChars = 12000 } = {}) {
  const ed = WIKI_EDITIONS.has(lang) ? lang : "en";
  const referents = Array.isArray(frame && frame.referents) ? frame.referents : [];
  const predicate = Array.isArray(frame && frame.predicate) ? frame.predicate : [];
  const words = [...referents.map((r) => r.title || r.surface), ...predicate.map((p) => p.surface)].map((w) => String(w ?? "").trim()).filter(Boolean);
  const query = words.join(" ");
  if (!query) return [];
  const pageUrl = (t) => `https://${ed}.wikipedia.org/wiki/` + encodeURIComponent(String(t).replace(/ /g, "_"));
  const picks = [], seen = new Set();
  const add = (title, url) => { if (title && url && !seen.has(url) && picks.length < max) { seen.add(url); picks.push({ title: String(title), url }); } };
  const found = await search("wikipedia", query, 0, { fetchImpl, lang: ed });
  for (const r of found.results || []) add(r && r.title, r && r.url);
  for (const r of referents) add(r.title, r.title ? pageUrl(r.title) : null);
  const read = await Promise.all(picks.map(async (p) => {
    try {
      const rd = await readText(p.url, { fetchImpl, memo });
      if (!rd || !rd.ok || !rd.text) return null;
      return { ref: "Wikipedia \u2014 " + p.title, title: p.title, url: p.url, host: hostKey(p.url), lang: ed, text: rd.text.slice(0, maxChars), query };
    } catch { return null; }
  }));
  return read.filter(Boolean);
}
