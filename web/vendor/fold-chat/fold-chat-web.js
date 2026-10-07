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

export const SCOPES = Object.freeze([
  { id: "wikipedia", label: "Wikipedia", ask: "Search Wikipedia articles" },
  { id: "github", label: "GitHub", ask: "Search GitHub repositories" },
  { id: "archive", label: "Internet Archive", ask: "Search books, documents and recordings" },
  { id: "openalex", label: "Papers · OpenAlex", ask: "Search research papers (OpenAlex)" },
  { id: "crossref", label: "Papers · Crossref", ask: "Search research papers (Crossref)" },
]);

// A page the site refuses to hand the browser is fetched through one of these,
// in parallel; the trace names which. Same list the holodeck uses.
export const CORS_PROXIES = [
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

function stripTags(s) {
  return String(s ?? "")
    .replace(/<(script|style|head|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|article|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/ *\n\s*/g, "\n").trim();
}
const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const first = (v) => (Array.isArray(v) ? v[0] : v) || "";

const fetchT = (fetchImpl, u, ms, headers) => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  const o = { signal: c.signal, headers: { ...(headers || {}) } };
  return fetchImpl(u, o).finally(() => clearTimeout(id));
};

async function getJson(fetchImpl, url, who) {
  let r;
  try { r = await fetchT(fetchImpl, url, 30000); } catch (e) { throw new Error(who + " did not answer" + (e && e.name === "AbortError" ? " in time." : ".")); }
  let j = null; try { j = await r.json(); } catch (e) {}
  return { r, j };
}

/** Search one scope, page-based. Returns { results, more, engine }. */
export async function search(scope, q, page = 0, { fetchImpl = fetch } = {}) {
  if (scope === "github") {
    const { r, j } = await getJson(fetchImpl, "https://api.github.com/search/repositories?per_page=20&page=" + (page + 1) + "&q=" + encodeURIComponent(q), "GitHub");
    if (r.status === 403 || r.status === 429) throw new Error("GitHub is limiting searches from this browser.");
    if (!r.ok || !j) throw new Error("GitHub answered " + r.status + ".");
    const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
    return { results: (j.items || []).map((x) => ({ title: x.full_name, url: x.html_url, snippet: x.description || "", source: "GitHub", meta: ["★ " + k(x.stargazers_count), x.language, x.pushed_at ? "updated " + x.pushed_at.slice(0, 4) : ""].filter(Boolean).join(" · "), kind: "github" })), more: (page + 1) * 20 < Math.min(j.total_count || 0, 1000), engine: "GitHub" };
  }
  if (scope === "wikipedia") {
    const { r, j } = await getJson(fetchImpl, "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=20&sroffset=" + page * 20 + "&srsearch=" + encodeURIComponent(q), "Wikipedia");
    if (!r.ok || !j) throw new Error("Wikipedia answered " + r.status + ".");
    return { results: ((j.query && j.query.search) || []).map((x) => ({ title: x.title, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_")), snippet: stripTags(x.snippet), source: "Wikipedia", meta: x.wordcount ? x.wordcount.toLocaleString() + " words" : "", kind: "wikipedia" })), more: !!j.continue, engine: "Wikipedia" };
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

/** Read a page's text: direct first, then the public proxies, then the text
 *  readers. Returns { ok, text, title, via, url } — `via` names who fetched it
 *  (a third party learns the address when a proxy/reader is used). */
export async function readText(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const titleOf = (raw) => oneLine(((String(raw).match(/<title[^>]*>([^<]*)/i) || [])[1] || ""));
  const attempt = async (target, via) => {
    const r = await fetchT(fetchImpl, target, timeoutMs);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const raw = await r.text();
    let text = stripTags(raw);
    // r.jina.ai / microlink wrap the text; unwrap.
    if (/^\s*\{/.test(raw)) { try { const j = JSON.parse(raw); text = stripTags((j.data && (j.data.text || j.data.content)) || ""); } catch (e) {} }
    else if (raw.includes("Markdown Content:")) text = raw.split("Markdown Content:").slice(1).join("Markdown Content:").trim();
    if (text.length < 40) throw new Error("too short");
    return { ok: true, text, title: titleOf(raw) || oneLine(text.split("\n")[0]).slice(0, 80), via, url };
  };
  try { return await attempt(url, "direct"); } catch (e) {}
  const proxies = CORS_PROXIES.map((p) => attempt(p(url), "a public proxy").catch(() => null));
  for (const p of await allSettledFirst(proxies)) if (p) return p;
  const readers = TEXT_READERS.map((rd) => attempt(rd(url), "a text reader").catch(() => null));
  for (const p of await allSettledFirst(readers)) if (p) return p;
  return { ok: false, text: "", title: "", via: null, url, error: "unreachable" };
}

/** Resolve as soon as any promise fulfills; if none do, resolve [] (no reject). */
async function allSettledFirst(promises) {
  return new Promise((resolve) => {
    let pending = promises.length, done = false;
    if (!pending) return resolve([]);
    for (const p of promises) p.then((v) => { if (v && !done) { done = true; resolve([v]); } else if (--pending === 0) resolve([]); }, () => { if (--pending === 0) resolve([]); });
  });
}

/** Search several scopes at once, then read the top results into passages the
 *  turn can be grounded on. Returns { results, passages, trace }. */
export async function searchWeb(query, { scopes = ["wikipedia", "github", "archive", "openalex", "crossref"], perScope = 4, read = 3, fetchImpl = fetch } = {}) {
  const trace = [];
  const results = [];
  const settled = await Promise.all(scopes.map(async (s) => {
    try { const out = await search(s, query, 0, { fetchImpl }); trace.push({ scope: s, engine: out.engine, n: out.results.length, ok: true }); return out.results.slice(0, perScope); }
    catch (e) { trace.push({ scope: s, ok: false, why: String(e.message || e) }); return []; }
  }));
  for (const list of settled) results.push(...list);
  // Read the top few into passages (the material the answer is grounded on).
  // Pages that answer a browser directly come first (Wikipedia articles read
  // as HTML); DOI/journal links often only serve PDFs or refuse cross-origin
  // reads, so they are tried last — and every read is time-boxed so one slow
  // host cannot hold the turn.
  const rank = (r) => (/wikipedia\.org\/wiki\//.test(r.url) ? 0 : /(^|\.)doi\.org|pdf|\.pdf$/i.test(r.url) ? 3 : /github\.com/.test(r.url) ? 2 : 1);
  const ordered = [...results].sort((a, b) => rank(a) - rank(b));
  const readable = ordered.filter((r) => rank(r) < 3);
  const pool = readable.length ? readable : ordered;
  const chosen = [];
  const seen = new Set();
  for (const r of pool) { if (!r.url || seen.has(r.url)) continue; seen.add(r.url); chosen.push(r); if (chosen.length >= read * 3) break; }
  const reads = await Promise.all(chosen.map(async (r) => {
    const rd = await readText(r.url, { fetchImpl, timeoutMs: 8000 });
    return { r, rd };
  }));
  const passages = [];
  for (const { r, rd } of reads) {
    if (rd.ok && passages.length < read) { passages.push({ ref: r.source + " — " + r.title, source: r.url, text: rd.text, via: rd.via, url: r.url }); trace.push({ read: r.url, via: rd.via, chars: rd.text.length }); }
    else if (rd.ok) trace.push({ read: r.url, via: rd.via, chars: rd.text.length, skipped: true });
    else trace.push({ read: r.url, via: null, ok: false });
  }
  return { results, passages, trace };
}
