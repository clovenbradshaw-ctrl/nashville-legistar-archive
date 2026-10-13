// holodeck-yt.js — how this surface is allowed to read a YouTube video.
//
// The browser cannot read YouTube: youtube.com/watch and the InnerTube player send no CORS
// header. Neither can yt-dlp run inside Pyodide — Pyodide's networking is the browser's own
// fetch, under the same CORS rules, so it hits the same wall. The signed caption URL exists
// only in the unreadable watch page. So reading a video happens on ground the page can reach:
//
//   rung 1 — the reader's own machine. tools/ytdl-helper.py runs yt-dlp natively and answers
//            http://127.0.0.1:11450 (configurable in localStorage hd:ytdl). This is the same
//            arrangement as the eoreader7 engine at 127.0.0.1:11436: not a third party.
//   rung 2 — the public CORS proxies this surface already discloses for blocked pages,
//            used only to reach the watch page long enough to lift the captionTracks, then
//            fetching the track itself (api/timedtext IS CORS-open). Best-effort; some
//            proxies refuse YouTube, and the trace says which rung actually read it.
//
// Captions first. The local helper's /audio rung exists only for the in-browser Whisper the
// surface already ships, and is used only when no caption track exists at all.

const DEFAULT_BASE = 'http://127.0.0.1:11450';

export function ytdlBase() {
  try { return (localStorage.getItem('hd:ytdl') || '').replace(/\/+$/, '') || DEFAULT_BASE; }
  catch (e) { return DEFAULT_BASE; }
}

function getJson(url, ms) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms || 20000);
  return fetch(url, { signal: c.signal }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).finally(() => clearTimeout(id));
}

export async function helperHealth() {
  try { const j = await getJson(ytdlBase() + '/health', 2500); return !!(j && j.ok); } catch (e) { return false; }
}

export async function listTracks(id, lang) {
  try { return await getJson(ytdlBase() + '/list?id=' + encodeURIComponent(id) + '&lang=' + encodeURIComponent(lang || 'en'), 30000); }
  catch (e) { return null; }
}

// yt-dlp's json3 (events[].tStartMs / dDurationMs / segs[].utf8) -> [{start,end,text}]. The
// surface's own reader merges and renders these; keep the shape identical to fold-net's Whisper.
export function parseJson3(text) {
  let data; try { data = JSON.parse(text); } catch (e) { return []; }
  const segs = [];
  for (const ev of (data.events || [])) {
    const piece = (ev.segs || []).map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!piece) continue;
    const start = (ev.tStartMs || 0) / 1000, end = start + (ev.dDurationMs || 0) / 1000;
    const last = segs[segs.length - 1];
    if (last && start - last.end < 1.2 && (last.text + ' ' + piece).length < 520) { last.text += ' ' + piece; last.end = end; }
    else segs.push({ start, end, text: piece });
  }
  return segs;
}

// rung 1: the local yt-dlp helper.
async function fromHelper(id, lang) {
  const j = await getJson(ytdlBase() + '/captions?id=' + encodeURIComponent(id) + '&lang=' + encodeURIComponent(lang || 'en'), 60000);
  if (!j || !Array.isArray(j.segments) || !j.segments.length) return null;
  return { title: j.title || '', author: j.author || '', lang: j.lang || lang || '', kind: j.kind || '', segments: j.segments,
    source: 'yt-dlp', model: 'captions', via: 'your yt-dlp helper', rung: 'helper' };
}

// rung 2: the watch page through the surface's disclosed public proxies, the track fetched
// directly (api/timedtext is CORS-open). Best-effort only.
const PROXIES = [
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  u => 'https://cors.eu.org/' + u,
  u => 'https://test.cors.workers.dev/?' + u
];
function pickTrack(tracks, lang) {
  const want = (lang || 'en').toLowerCase(), base = want.split('-')[0];
  const score = t => {
    const c = (t.languageCode || '').toLowerCase();
    return (t.kind === 'asr' ? 8 : 0) + (c === want ? 0 : c.split('-')[0] === base ? 1 : 4);
  };
  return tracks.slice().sort((a, b) => score(a) - score(b))[0] || null;
}
// One budget for every proxy together. Measured 2026-10-13 on five videos: the watch page arrives,
// but YouTube returns an empty body for the caption track unless the request carries a proof-of-origin
// token a browser cannot mint, so this rung yields nothing today; it is kept for the day that changes,
// not allowed to stall a link for the better part of a minute (each dead proxy used to take 15 s).
const PROXY_BUDGET_MS = 6000;
async function fromBrowser(id, lang) {
  const watch = 'https://www.youtube.com/watch?v=' + id;
  const until = Date.now() + PROXY_BUDGET_MS, left = cap => Math.min(cap, until - Date.now());
  for (const p of PROXIES) {
    if (left(PROXY_BUDGET_MS) < 400) break;
    let raw; try { const r = await fetch(p(watch), { signal: AbortSignal.timeout(left(15000)) }); if (!r.ok) continue; raw = await r.text(); } catch (e) { continue; }
    const m = raw.match(/"captionTracks":(\[.*?\])/); if (!m) continue;
    let tracks; try { tracks = JSON.parse(m[1]); } catch (e) { continue; }
    const t = pickTrack(tracks, lang); if (!t || !t.baseUrl) continue;
    try {
      const sep = t.baseUrl.indexOf('?') < 0 ? '?' : '&';
      const r = await fetch(t.baseUrl + sep + 'fmt=json3', { signal: AbortSignal.timeout(Math.max(1500, left(20000))) }); if (!r.ok) continue;
      const segs = parseJson3(await r.text()); if (!segs.length) continue;
      const title = (raw.match(/"title":"([^"]{1,200})"/) || [])[1] || '';
      return { title: JSON.parse('"' + title + '"'), author: '', lang: t.languageCode || lang || '', kind: t.kind === 'asr' ? 'asr' : 'manual',
        segments: segs, source: 'timedtext', model: 'captions', via: 'a public proxy (' + new URL(p(watch)).hostname + ')', rung: 'proxy' };
    } catch (e) { /* next proxy */ }
  }
  return null;
}

// rung 0: the capture extension, when installed. The read is made by the person's own browser, on their
// own address — the one place a YouTube caption track still comes back with its body. The page asks by
// window.postMessage; extension/content.js relays to the background and back. A ping first, so a person
// without the extension loses a fraction of a second and never waits on a local-network prompt.
function askExtension(msg, want, ms) {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.addEventListener || !window.postMessage) return resolve(null);
    const rid = 'yt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const done = v => { window.removeEventListener('message', on); clearTimeout(timer); resolve(v); };
    // window.postMessage to oneself is delivered to this very listener too: only the reply type counts,
    // never the request echoing back with its own rid.
    const on = e => { const d = e && e.data; if (e.source === window && d && d.rid === rid && d.type === want) done(d); };
    const timer = setTimeout(() => done(null), ms);
    window.addEventListener('message', on);
    try { window.postMessage({ ...msg, rid }, location.origin); } catch (err) { done(null); }
  });
}
async function fromExtension(id, lang) {
  const here = await askExtension({ type: 'fold-captions-ping' }, 'fold-captions-here', 700);
  if (!here) return { present: false };
  const r = await askExtension({ type: 'fold-captions-request', id, lang: lang || 'en' }, 'fold-captions-result', 45000);
  if (!r) return { present: true, error: 'the extension did not answer' };
  if (!r.ok) return { present: true, error: r.error || 'the extension could not read it' };
  if (!Array.isArray(r.segments) || !r.segments.length) return { present: true, empty: true };
  return { present: true, cap: { title: r.title || '', author: r.author || '', lang: r.lang || lang || '', kind: r.kind || '', segments: r.segments,
    source: 'extension', model: 'captions', via: 'your own browser (the capture extension)', rung: 'extension' } };
}

// The entry point the surface calls: the extension, then the helper, then the proxies. Returns { cap, why,
// detail }: cap is the caption object or null, and when it is null `why` says what is true so the person
// is told it instead of being handed a bare title —
//   'extension-error'     the capture extension is installed and could not read it (detail says why)
//   'helper-unreachable'  nothing answered at ytdlBase(): not started, or the browser blocked the page from
//                         reaching 127.0.0.1 (a hosted copy of the page needs "Local network access" allowed)
//   'helper-error'        the helper is up but could not read this video
//   'no-track'            the video has no caption track
export async function transcriptOutcome(id, lang) {
  let why = 'no-track', detail = '';
  try {
    const x = await fromExtension(id, lang);
    if (x.cap) return { cap: x.cap, why: null };
    if (x.present && x.error) { why = 'extension-error'; detail = x.error; }
  } catch (e) {}
  try { const h = await fromHelper(id, lang); if (h) return { cap: h, why: null }; }
  catch (e) { if (why !== 'extension-error') why = (await helperHealth()) ? 'helper-error' : 'helper-unreachable'; }
  try { const b = await fromBrowser(id, lang); if (b) return { cap: b, why: null }; } catch (e) {}
  return { cap: null, why, detail };
}

// Same contract as before for callers that only want the captions: the object, or null (the caller then
// keeps the link and offers the recording for in-browser Whisper).
export async function transcriptFor(id, lang) {
  return (await transcriptOutcome(id, lang)).cap;
}

// The audio, from the local helper only — there is no cross-origin way to the stream. Used
// solely to feed in-browser Whisper when no caption track exists.
export async function audioFor(id) {
  const r = await fetch(ytdlBase() + '/audio?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('the yt-dlp helper answered ' + r.status);
  return { buf: await r.arrayBuffer(), mime: r.headers.get('content-type') || 'audio/mp4' };
}

// --- snip / stitch -----------------------------------------------------------
// A clip is real bytes cut on the reader's own machine (yt-dlp --download-sections)
// and written under clips/, where the surface's static server plays it back. The helper
// returns a manifest; the caller composes the playback URL from its own origin.

async function clipJson(url, ms) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms || 60000);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error('the yt-dlp helper answered HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(id); }
}

/** One snipped range of one video -> {kind:'clip', name, url:'/clips/x.mp4', segments, duration, size}. */
export function clipFor(id, start, end, name) {
  const q = 'id=' + encodeURIComponent(id) + '&start=' + encodeURIComponent(String(start)) +
    '&end=' + encodeURIComponent(String(end)) + '&name=' + encodeURIComponent(name || 'clip');
  return clipJson(ytdlBase() + '/clip?' + q, 60000);
}

/** Several ranges of one video joined in order -> {kind:'stitch', name, url, segments, duration, size}. */
export function stitchFor(id, segments, name) {
  const seg = (segments || []).map(s => 'seg=' + encodeURIComponent(s.start + '-' + s.end)).join('&');
  const q = 'id=' + encodeURIComponent(id) + '&name=' + encodeURIComponent(name || 'stitch') + (seg ? '&' + seg : '');
  return clipJson(ytdlBase() + '/stitch?' + q, 60000);
}

/** The playback URL for a helper manifest, on whatever surface is reading. */
export function clipUrl(manifest, base) {
  return (base || location.origin) + (manifest.url || '');
}
