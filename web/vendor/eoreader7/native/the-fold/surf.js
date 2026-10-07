// surf.js — STAGE 3: SEEK ACROSS MULTIPLE SOURCES FOR MATERIAL SHAPED LIKE
// THE VOID (2026-09-22). Not "the file I was handed": an active search.
//
// The user: "it surfs and seeks a shape of the void, extracting it from
// multiple sources … if we dont hunt for the shape of what would satisfy,
// everything breaks." Two hunts leave here, both from the void's own words:
//   exemplars   instances of the FORM the ask names (its form-word, carried
//               by void-spec.js declareForm even when unresolved — "whiteppr")
//               so stage 4 can learn the form's shape from several of them;
//   material    sources ABOUT the subject, when the ask states one, so stage
//               5 has something to ground on beyond what was handed over.
//
// Measured live 2026-09-22 before this was written: a bare garbled token
// ("whiteppr") searched alone returns noise; the same token WITH the ask's
// surrounding words resolves to what it names. So every query carries
// context — never the token by itself.
//
// This stage judges nothing. It returns candidates with provenance (which
// query, which host, how many bytes) and every failure TYPED: a blocked
// search, an off-endpoint page, a fetch that failed — never "the web had
// nothing" when the truth is "the web was not reached". Stage 4 decides
// whether any candidate satisfies the void's shape.
//
// The web is injected (`search`, `fetch`) so the stage runs on fixtures in
// tests and on DuckDuckGo's no-key HTML face live (liveWeb, via organs/web.js
// — the engine's own reader of that face, blocked-page detection included).

import { parseSearchResults, extractReadable, blankSpans, hostOf, WEB_UA, WEB_FETCH_TIMEOUT_MS, WEB_FETCH_MAX_BYTES } from "../organs/web.js";

export const SURF_SCHEMA = "EOSurf@1";

// Measured live 2026-09-22 (surf-falsify.test.mjs's own live run + a direct
// timed call): a single search or fetch through liveWeb answers in well
// under a second on an open network, and every one of them is genuinely
// bounded by WEB_FETCH_TIMEOUT_MS (organs/web.js) — the AbortController in
// liveWeb's `get()` covers the whole call, redirects included, with no
// retry loop anywhere in this file. What is NOT bounded is the PASS: this
// loop runs each query's search, then each hunt's own allocation of
// fetches, one after another, and each of those calls is individually
// entitled to the full WEB_FETCH_TIMEOUT_MS. With `surfQueries`' own 2-3
// queries and up to `maxSources` fetches per hunt, a run where the search
// endpoint is slow or rate-limiting (not reproduced live today, but not
// ruled out either) can legitimately sum to several minutes even though no
// single call ever hangs — many bounded waits stacking sequentially, not a
// broken timeout. `maxTotalMs` names an outer bound on the WHOLE pass so a
// caller (a learn/hunt route driving this) is never stuck past a known
// ceiling: a declared starting point (P9 — not measured, easy to widen once
// real usage says otherwise), not a promise that anything under it is fast.
export const SURF_MAX_TOTAL_MS = 90_000;

/** The queries, from the void alone. Each carries context; the templates are
 *  declared (a starting point, stated as such), not measured. */
export function surfQueries(spec) {
  const token = spec?.form?.token ?? null;
  const topic = spec?.topic ?? null;
  const cue = spec?.form?.cue ?? null;
  const out = [];
  if (token) {
    // The form, as a thing with instances: what one is, and several of them.
    // The context a form-word carries is its own question form ("what is a
    // …"), NOT the ask's subject: measured live 2026-09-22 ("write a sonnet
    // about the Cumberland River"), the subject in the exemplar query pulled
    // six river pages into the ten, and "14 lines" fell to 4/10 — not
    // learned. The subject belongs to the material hunt alone.
    out.push({ hunt: "exemplars", q: `what is ${/^[aeiou]/i.test(token) ? "an" : "a"} ${token}`, basis: "the form-word in its own question form — the subject stays out of the exemplar hunt" });
    out.push({ hunt: "exemplars", q: `${token} examples full text`, basis: "the form-word, asking for instances rather than a definition" });
  }
  if (topic) out.push({ hunt: "material", q: topic, basis: "the ask's subject phrase, verbatim" });
  if (!out.length) out.push({ hunt: "none", q: null, basis: cue ? `an anaphor ("${cue}") with no form-word and no subject: nothing to seek outside this conversation` : "the ask names no form and no subject" });
  return out;
}

/**
 * surf({ spec, search, fetch, perQuery, maxSources, maxTotalMs }) → EOSurf@1
 *   search(q) → { blocked, offEndpoint, results:[{title,url,snippet}] } | throws
 *   fetch(url) → { text, title, chars } | throws
 * Every individual search/fetch is the CALLER's own timeout to keep (liveWeb,
 * below, bounds each one by WEB_FETCH_TIMEOUT_MS) — but this loop runs them
 * one after another, so the whole PASS is only bounded if something bounds
 * it: `maxTotalMs` (default SURF_MAX_TOTAL_MS) does that, skipping whatever
 * queries/fetches remain once the deadline passes rather than letting a slow
 * or rate-limiting endpoint stack bounded waits into an unbounded one.
 * `result.timeBounded` and `result.basis` say so when it fires — a cut pass
 * is disclosed, never presented as "nothing more was there."
 * Candidates are distinct by URL and drawn across hosts first (one per host
 * before a second from any), so "multiple sources" is a property of the
 * product, not a hope.
 */
export async function surf({ spec, search, fetch, perQuery = 6, maxSources = 6, queries = null, maxTotalMs = SURF_MAX_TOTAL_MS, now = () => Date.now() } = {}) {
  queries = queries ?? surfQueries(spec);
  const deadline = maxTotalMs == null ? null : now() + maxTotalMs;
  const timeUp = () => deadline != null && now() >= deadline;
  let timeBoundedAt = null; // first moment the pass was cut short, disclosed rather than silently truncated
  // A safety net under an injected search/fetch that carries NO timeout of
  // its own (liveWeb's already do, via organs/web.js's AbortController — this
  // is for whatever else gets passed in): races the call against the pass's
  // OWN remaining budget, real wall-clock, so one in-flight call can never
  // outlive the whole pass by more than the time it had left when it began.
  const withDeadline = (promise) => {
    if (deadline == null) return promise;
    const msLeft = Math.max(0, deadline - now());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`surf: pass deadline exceeded (${msLeft}ms remained when this call started)`)), msLeft);
      promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  };
  const runs = [];
  const candidates = [];
  const seen = new Set();
  for (const query of queries) {
    if (!query.q) { runs.push({ ...query, status: "not run", results: 0, hosts: [] }); continue; }
    if (timeUp()) { timeBoundedAt = timeBoundedAt ?? "search"; runs.push({ ...query, status: "not run: time-bounded", results: 0, hosts: [] }); continue; }
    let res;
    try { res = await withDeadline(search(query.q)); }
    catch (e) { runs.push({ ...query, status: "search failed", error: String(e?.message ?? e).slice(0, 200), results: 0, hosts: [] }); continue; }
    if (res?.blocked) { runs.push({ ...query, status: "blocked", results: 0, hosts: [] }); continue; }
    if (res?.offEndpoint) { runs.push({ ...query, status: "off endpoint", results: 0, hosts: [] }); continue; }
    const results = (res?.results ?? []).slice(0, perQuery);
    const hosts = [...new Set(results.map((r) => hostOf(r.url)).filter(Boolean))];
    runs.push({ ...query, status: results.length ? "ok" : "empty", results: results.length, hosts });
    for (const r of results) {
      if (!r.url) continue;
      // A URL both hunts find carries BOTH labels (measured live 2026-09-22:
      // the Cumberland material pages were also the exemplar query's results,
      // kept the first label only, and none reached the hunt as material).
      if (seen.has(r.url)) { const c = candidates.find((x) => x.url === r.url); if (c && !c.hunts.includes(query.hunt)) c.hunts.push(query.hunt); continue; }
      seen.add(r.url);
      candidates.push({ hunt: query.hunt, hunts: [query.hunt], query: query.q, url: r.url, host: hostOf(r.url), title: r.title ?? "", snippet: r.snippet ?? "" });
    }
  }
  // Each hunt gets its own allocation of fetches (the exemplar pages must
  // not spend the material hunt's), and within a hunt hosts come first:
  // round-robin by host so the first N sources are the most distinct N
  // available, not the first N of one site.
  const toFetch = [];
  for (const hunt of [...new Set(candidates.flatMap((c) => c.hunts))]) {
    const mine = candidates.filter((c) => c.hunts.includes(hunt) && !toFetch.includes(c));
    const byHost = new Map();
    for (const c of mine) (byHost.get(c.host) ?? byHost.set(c.host, []).get(c.host)).push(c);
    const ordered = [];
    for (let i = 0; ordered.length < mine.length; i++) for (const list of byHost.values()) if (list[i]) ordered.push(list[i]);
    toFetch.push(...ordered.slice(0, maxSources));
  }
  const sources = [];
  for (const c of toFetch) {
    if (timeUp()) { timeBoundedAt = timeBoundedAt ?? "fetch"; sources.push({ ...c, status: "not fetched: time-bounded", chars: 0, text: "" }); continue; }
    try {
      const page = await withDeadline(fetch(c.url));
      sources.push({ ...c, status: "fetched", chars: page?.chars ?? String(page?.text ?? "").length, pageTitle: page?.title ?? "", text: String(page?.text ?? ""), headings: page?.headings ?? [] });
    } catch (e) {
      sources.push({ ...c, status: "fetch failed", error: String(e?.message ?? e).slice(0, 200), chars: 0, text: "" });
    }
  }
  const fetched = sources.filter((s) => s.status === "fetched" && s.chars > 0);
  const hostsFetched = [...new Set(fetched.map((s) => s.host))];
  const reached = runs.some((r) => r.status === "ok" || r.status === "empty");
  return {
    schema: SURF_SCHEMA,
    queries: runs,
    candidates: candidates.length,
    sources,
    fetched: fetched.length,
    hosts: hostsFetched,
    multiple: hostsFetched.length >= 2,
    timeBounded: timeBoundedAt != null,
    basis: (!reached
      ? `the web was not reached: ${runs.map((r) => `${r.hunt}: ${r.status}`).join("; ")} — a failed search, not an empty one`
      : `${runs.length} quer${runs.length === 1 ? "y" : "ies"} (${runs.map((r) => `${r.hunt}: ${r.status}, ${r.results}`).join("; ")}); ${candidates.length} distinct candidate(s); ${fetched.length} fetched from ${hostsFetched.length} host(s)${hostsFetched.length < 2 ? " — NOT multiple sources" : ""}`)
      + (timeBoundedAt != null ? ` — TIME-BOUNDED at ${maxTotalMs}ms (cut short at ${timeBoundedAt}): the remainder was never run, not a real absence` : ""),
  };
}

/** One readable line per query and per source, for the ledger. */
export function surfLines(s) {
  const out = [];
  for (const q of s.queries) out.push(`${q.hunt.padEnd(10)} ${q.status.padEnd(14)} ${q.q ? `"${q.q}"` : "—"}${q.results ? ` · ${q.results} result(s) from ${q.hosts.join(", ")}` : ""}${q.error ? ` · ${q.error}` : ""}   ← ${q.basis}`);
  for (const src of s.sources) out.push(`  ${src.status.padEnd(12)} ${src.host.padEnd(28)} ${String(src.chars).padStart(7)} chars  ${src.url}${src.error ? ` · ${src.error}` : ""}`);
  return out;
}

/** The live web: DuckDuckGo's HTML face read by organs/web.js, one page per
 *  fetch, bounded. `fetchImpl` is injectable for tests of this wrapper. */
export function liveWeb({ fetchImpl = globalThis.fetch, timeoutMs = WEB_FETCH_TIMEOUT_MS } = {}) {
  const get = async (url) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers: { "user-agent": WEB_UA, accept: "text/html,application/xhtml+xml" }, signal: ctl.signal, redirect: "follow" });
      const body = (await res.text()).slice(0, WEB_FETCH_MAX_BYTES);
      return { status: res.status, body };
    } finally { clearTimeout(t); }
  };
  return {
    search: async (q) => {
      const { status, body } = await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
      if (status >= 400) return { blocked: [401, 403, 429, 503].includes(status), offEndpoint: ![401, 403, 429, 503].includes(status), results: [], status };
      return parseSearchResults(body);
    },
    fetch: async (url) => {
      const { status, body } = await get(url);
      if (status >= 400) throw new Error(`HTTP ${status}`);
      const r = extractReadable(body);
      // THE REFERENT-ADMISSION WALL, OPTED INTO (2026-09-26): extractReadable
      // has always surveyed role="navigation"/"note" regions (organs/web.js's
      // own navSpans, blankSpans) but nothing in this live pipeline ever
      // called blankSpans on them — a real hunt.js admission (this session's
      // own 10-page demo) let a Wikipedia hatnote and a page's navigation
      // furniture ride through as ordinary body text because of exactly this
      // gap. blankSpans is length-preserving (every other byte offset into
      // this same text is unaffected); only role-tagged furniture becomes
      // blank space instead of admissible prose.
      const text = blankSpans(r.text ?? "", r.navSpans);
      return { title: r.title ?? "", text, chars: text.length, headings: (r.headings ?? []).map((h) => h.text) };
    },
  };
}
