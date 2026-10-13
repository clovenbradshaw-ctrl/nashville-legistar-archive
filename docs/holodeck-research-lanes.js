// holodeck-research-lanes.js — the research assistant's outward lanes: a thin adapter over the fold's own acquisition
// machinery, which this repo already carries byte-identical under vendor/fold-chat/ (see VENDORING.md). Nothing is
// re-implemented here: search is fold-chat-web.js `search`, the page read pool is `readText` (direct → this machine's
// heimdall bridge → the fold relay → public CORS proxies → text readers, with a memo and dead-host memory), the router
// is fold-chat-route.js (route by what the ask needs; the web hits vote for specialists; a 429 cools a lane).
//
// What this file adds is only (a) the shape holodeck-research.js injects, (b) a DISCLOSURE of exactly which hosts will
// learn the question and which will learn a page address — derived by dry-running the vendored URL builders, so the
// list the person sees cannot drift from what the code does — and (c) typed refusals for what a read returned that is
// not text (a binary, a bot wall).
//
// Browser + node. `fetchImpl` is injected so a test never touches the network.

import { search, readText, makeMemo, queriesFor, wikiEdition, setBridge, getBridge, CORS_PROXIES, TEXT_READERS, FOLD_RELAY, SCOPES } from './vendor/fold-chat/fold-chat-web.js';
import { routeSources, probeSources, noteRateLimited, coolingDown, isRateLimitError } from './vendor/fold-chat/fold-chat-route.js';

export const LABELS = Object.freeze({
  web: 'The open web', wikipedia: 'Wikipedia', github: 'GitHub', archive: 'Internet Archive', openalex: 'Research papers · OpenAlex', crossref: 'Research papers · Crossref',
});
export const labelOf = scope => LABELS[scope] || (SCOPES.find(s => s.id === scope) || {}).label || scope;

const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

/** A response that is not text: control bytes and replacement characters read as UTF-8. Quoting it is worse than none. */
export function looksBinary(s) {
  const t = String(s || '').slice(0, 4000);
  if (t.length < 40) return false;
  if (t.includes('\u0000')) return true;
  let bad = 0;
  for (const ch of t) { const c = ch.codePointAt(0); if (c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 0x7f && c < 0xa0)) bad++; }
  return bad / t.length > 0.05;
}

/** Which host receives the question for each scope — found by running the vendored `search` against a recording fetch
 *  that captures the URL it would have requested and refuses to answer. */
export async function searchHosts(scopes = SCOPES.map(s => s.id), { bridge = getBridge() } = {}) {
  const prev = getBridge(); setBridge(bridge || null);
  const out = {};
  try {
    for (const scope of scopes) {
      const seen = [];
      const rec = async url => { seen.push(String(url)); throw new Error('recorded'); };
      try { await search(scope, 'a question', 0, { fetchImpl: rec }); } catch (e) {}
      out[scope] = [...new Set(seen.map(hostOf).filter(Boolean))];
    }
  } finally { setBridge(prev); }
  return out;
}

/** What each outward lane learns, in plain terms: the question goes to these hosts; a page address goes to these. */
export async function disclosure({ bridge = getBridge(), directOnly = false } = {}) {
  const hosts = await searchHosts(undefined, { bridge });
  const sample = 'https://example.org/a-page';
  const relayHost = hostOf(FOLD_RELAY);
  const doors = [];
  doors.push({ id: 'site', label: 'the page’s own site', host: null, learns: 'the page address (every read starts here)' });
  if (directOnly) return { search: await (async () => SCOPES.map(s => ({ scope: s.id, label: labelOf(s.id), hosts: s.id === 'web' ? [bridge ? (hostOf(bridge) || bridge) + ' (this machine) → DuckDuckGo / Brave' : hostOf(FOLD_RELAY) + ' (the fold’s relay) → DuckDuckGo / Brave'] : hosts[s.id] || [] })))(), read: doors };
  if (bridge) doors.push({ id: 'bridge', label: 'your heimdall bridge', host: hostOf(bridge) || bridge, learns: 'the page address — it fetches from this machine' });
  doors.push({ id: 'relay', label: 'the fold’s relay', host: relayHost, learns: 'the page address, only when the site refused a direct read' });
  for (const p of CORS_PROXIES.slice(1)) doors.push({ id: 'proxy', label: 'a public CORS proxy', host: hostOf(p(sample)), learns: 'the page address, only when the site refused a direct read' });
  for (const r of TEXT_READERS) doors.push({ id: 'reader', label: 'a text reader', host: hostOf(r(sample)), learns: 'the page address, only when every other door was refused' });
  const webHost = bridge ? [(hostOf(bridge) || bridge) + ' (this machine) → DuckDuckGo / Brave'] : [relayHost + ' (the fold’s relay) → DuckDuckGo / Brave'];
  const search = SCOPES.map(s => ({ scope: s.id, label: labelOf(s.id), hosts: s.id === 'web' ? webHost : hosts[s.id] || [] }));
  return { search, read: doors };
}

/** The injected dependencies for holodeck-research.js. */
export function makeLanes({ fetchImpl = (...a) => fetch(...a), bridge = null, readExtra = null, memo = makeMemo(), timeoutMs = 8000, directOnly = false } = {}) {
  if (bridge) setBridge(bridge);
  return {
    memo,
    search: (scope, q) => search(scope, q, 0, { fetchImpl, lang: scope === 'wikipedia' ? wikiEdition(q) : 'en' }),
    // A PDF is not HTML: the page hands it to the Holodeck's own file reader (text layer) through readExtra.
    read: async (url, cand) => {
      if (readExtra && /\.pdf(?:[?#]|$)/i.test(url)) { try { const r = await readExtra(url, cand); if (r && r.ok) return r; } catch (e) {} }
      const out = await readText(url, { fetchImpl, timeoutMs, memo, direct: !!directOnly });   // direct: the site's own answer only — no bridge, relay, proxy or reader
      if (out.ok && looksBinary(out.text)) return { ok: false, error: 'the response was not text (a binary served to a page request)', tried: ['direct'] };
      if (out.ok) return out;
      const doors = directOnly ? ['direct (third-party readers switched off)'] : ['direct', ...(getBridge() ? ['your bridge'] : []), 'the fold’s relay', 'public proxies', 'text readers'];
      return { ok: false, error: directOnly ? 'the site refused a direct read, and third-party readers are switched off' : out.error === 'unreachable' ? 'every door was tried and none returned text — the page may need its scripts to run, or the site refuses them all' : out.error || 'unreachable', tried: doors };
    },
    route: q => routeSources(q, { lang: wikiEdition(q) }),
    probe: (hits, chosen) => probeSources(hits, chosen),
    queriesFor,
    cooling: s => coolingDown(s),
    limited: (s, e) => { if (isRateLimitError(e)) noteRateLimited(s); },
  };
}
