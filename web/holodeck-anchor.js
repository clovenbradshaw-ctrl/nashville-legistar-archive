// holodeck-anchor.js — resolve a stable, anchored version of a URL.
//
// An anchor is a permanent address for a page: a Memento (RFC 7089) snapshot held by a public
// archive. The live page can change, move, paywall, or refuse a cross-origin read; an anchor cannot.
// Every source the surface reads should be able to name one, so a claim can be checked later against
// the bytes that were read.
//
// The loop is DEF → EVA → REC, the same three operators the records view folds:
//
//   DEF  declare the archive gates (each a Memento timegate) — the candidate anchors. The list is
//        data, not code: a person's own list (localStorage hd:archives) wins, else the surface's
//        registry (archives.json) is fetched at runtime, else the built-in defaults. No network for
//        the declaration itself.
//   EVA  ask every gate, in parallel, for the Mementos it holds; score each (status, size, recency)
//        and record what every gate answered — including the misses and any human-challenge. A gate
//        that times out, 429s, or holds nothing is a recorded miss; no single archive (archive.org in
//        particular rate-limits, and behind a VPN often refuses) can stall the loop.
//   REC  record the surviving anchor: the best Memento any gate actually served, with the runners-up
//        kept on the record. If no gate held one, REC records that too.
//
// Nothing here guesses an address: an anchor is only set to a URI a gate served in its timegate.

export const DEFAULT_GATES = [
  { id: 'archive.today', label: 'archive.today', home: 'https://archive.ph/', timegate: u => 'https://archive.ph/timemap/link/' + u, replay: m => m },
  { id: 'wayback', label: 'Internet Archive Wayback', home: 'https://web.archive.org/', timegate: u => 'https://web.archive.org/web/timemap/link/' + u,
    replay: m => m.replace(/^(\S*\/web\/\d+)(\/)/, '$1id_$2') },
  { id: 'arquivo.pt', label: 'Arquivo.pt', home: 'https://arquivo.pt/', timegate: u => 'https://arquivo.pt/wayback/timemap/link/' + u, replay: m => m },
  { id: 'ukwa', label: 'UK Web Archive', home: 'https://www.webarchive.org.uk/', timegate: u => 'https://www.webarchive.org.uk/wayback/archive/timemap/link/' + u, replay: m => m },
  { id: 'loc', label: 'Library of Congress', home: 'https://webarchive.loc.gov/', timegate: u => 'https://webarchive.loc.gov/all/timemap/link/' + u, replay: m => m },
];

const waybackReplay = m => m.replace(/^(\S*\/web\/\d+)(\/)/, '$1id_$2');

// Turn a registry entry (data) into a gate (behaviour). {url} is the placeholder for the target.
export function compileGates(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(g => g && g.id && g.timegate).map(g => ({
    id: String(g.id), label: String(g.label || g.id), home: g.home || null,
    timegate: u => String(g.timegate).replace(/\{url\}/g, u),
    replay: g.replay === 'wayback-id' ? waybackReplay : (m => m),
  }));
}

// DEF, resolved at runtime: a person's list, else the surface's registry (fetched), else the defaults.
export async function loadGates(opts = {}) {
  if (opts.gates) return opts.gates;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  try { const s = (typeof localStorage !== 'undefined') && localStorage.getItem('hd:archives'); if (s) { const g = compileGates((JSON.parse(s) || {}).gates); if (g.length) return g; } } catch (e) {}
  if (fetchImpl) { try { const r = await fetchImpl(opts.registryUrl || 'archives.json', { headers: { Accept: 'application/json' } }); if (r.ok) { const g = compileGates((await r.json() || {}).gates); if (g.length) return g; } } catch (e) {} }
  return DEFAULT_GATES;
}

// Parse a Memento link-format timegate body: <uri>; rel="memento"; datetime="..."; status="200"; length="123"
export function parseTimemap(text) {
  const out = []; const re = /<([^>]+)>\s*;([^\n]*)/g; let m;
  while ((m = re.exec(String(text || '')))) {
    const uri = m[1], attrs = m[2] || '';
    const rel = (attrs.match(/rel="?([^";]+)"?/) || [])[1] || '';
    if (!/memento/.test(rel) || /original/.test(rel)) continue;
    const dt = (attrs.match(/datetime="?([^";]+)"?/) || [])[1] || '';
    const status = (attrs.match(/status="?(\d+)"?/) || [])[1] || '';
    const length = (attrs.match(/length="?(\d+)"?/) || [])[1] || '';
    const parsed = dt ? Date.parse(dt) : NaN;
    out.push({ uri, datetime: dt || null, status: status ? +status : null, length: length ? +length : null,
      ts: Number.isFinite(parsed) ? parsed : ((uri.match(/\/web\/(\d{14})/) || [])[1] ? Date.parse(uri.match(/\/web\/(\d{14})/)[1].replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z')) : 0) });
  }
  return out;
}

// A Memento's fitness as an anchor: a served page (status 200), with real bytes, as recent as possible.
export function scoreMemento(mm, now = Date.now()) {
  let s = 0;
  if (mm.status === 200 || mm.status == null) s += 100; else s -= 250;
  if (mm.length) s += Math.min(40, Math.log10(Math.max(10, mm.length)) * 10);
  const ageDays = mm.ts ? Math.max(0, (now - mm.ts) / 86400000) : 1e6;
  s += Math.max(0, 60 - Math.log10(1 + ageDays) * 20);
  return s;
}

// A page that wants a human: a rate limit, a WAF block, or the usual "prove you are human" wall.
export const CHALLENGE_RE = /(prove (you|that you)( are|'?re)?( a)? ?(human|robot)|just a moment|cf-chl|attention required|enable javascript and cookies|checking your browser|verifying you are human|are you a? ?(robot|human)|access to this page has been denied|unusual traffic|request blocked)/i;
// A human-check is a WAF block or an explicit challenge page. A bare 429 is a RATE LIMIT — proving
// you are human clears nothing — so it is reported separately and never dressed as a human-check.
export function looksLikeChallenge(status, body) { if (CHALLENGE_RE.test(String(body || '').slice(0, 5000))) return true; return status === 403 || status === 503; }
export const isRateLimited = status => status === 429;

export async function resolveAnchor(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const gates = await loadGates(opts);
  const timeout = opts.timeout || 8000;
  const now = opts.now || Date.now();
  const log = []; const ev = (op, d) => { const e = { op, ms: Date.now() - now, ...d }; log.push(e); return e; };

  for (const g of gates) ev('DEF', { gate: g.id, label: g.label, timegate: String(g.timegate(url)) });

  let challenge = null, rateLimited = null;
  const noteChallenge = (g, status, target) => {
    ev('EVA', { gate: g.id, ok: false, status, challenge: true, why: 'the gate is asking for a human' });
    if (!challenge) challenge = { url: g.home || target, gate: g.id, status };
  };
  const noteRate = (g, status, target) => {
    ev('EVA', { gate: g.id, ok: false, status, rateLimited: true, why: 'the gate is rate-limiting, not asking for a human' });
    if (!rateLimited) rateLimited = { url: g.home || target, gate: g.id, status };
  };

  const probe = g => (async () => {
    if (!fetchImpl) { ev('EVA', { gate: g.id, ok: false, why: 'no fetch available' }); return null; }
    const gateUrl = g.timegate(url);
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeout);
    try {
      const req = { signal: ctl.signal, headers: { Accept: 'application/link-format' } };
      if (opts.credentials) req.credentials = opts.credentials;   // carry an archive's clearance cookie after the person proves themselves
      const r = await fetchImpl(gateUrl, req);
      if (!r.ok) { if (isRateLimited(r.status)) noteRate(g, r.status, gateUrl); else if (looksLikeChallenge(r.status, '')) noteChallenge(g, r.status, gateUrl); else ev('EVA', { gate: g.id, ok: false, status: r.status, why: 'the gate answered ' + r.status }); return null; }
      const text = await r.text();
      if (CHALLENGE_RE.test(text)) { noteChallenge(g, r.status, gateUrl); return null; }
      const mems = parseTimemap(text);
      if (!mems.length) { ev('EVA', { gate: g.id, ok: false, why: 'no Mementos' }); return null; }
      mems.sort((a, b) => scoreMemento(b, now) - scoreMemento(a, now));
      const best = mems[0]; const served = mems.filter(x => x.status === 200 || x.status == null).length;
      ev('EVA', { gate: g.id, ok: true, mementos: mems.length, served, best: best.uri, status: best.status, when: best.datetime });
      return { gate: g.id, label: g.label, memento: best, replay: g.replay ? g.replay(best.uri, url) : best.uri, mementos: mems.length };
    } catch (e) { ev('EVA', { gate: g.id, ok: false, why: e && e.name === 'AbortError' ? 'timed out' : String((e && e.message) || e) }); return null; }
    finally { clearTimeout(to); }
  })();

  const results = (await Promise.all(gates.map(probe))).filter(Boolean);
  if (!results.length) { ev('REC', { ok: false, why: challenge ? 'every gate that answered asked for a human' : rateLimited ? 'every gate that answered rate-limited this reader' : 'no archive held a Memento for this URL' }); return { ok: false, anchor: null, challenge, rateLimited, gates, log }; }

  results.sort((a, b) => scoreMemento(b.memento, now) - scoreMemento(a.memento, now));
  const win = results[0];
  ev('REC', { ok: true, gate: win.gate, anchor: win.replay, served: win.mementos, runnersUp: results.slice(1).map(x => x.gate) });
  return { ok: true, anchor: { uri: win.replay, gate: win.gate, label: win.label, when: win.memento.datetime || null,
    memento: win.memento.uri, mementos: win.mementos }, runners: results.slice(1).map(x => ({ gate: x.gate, uri: x.replay })), challenge, rateLimited, gates, log };
}
