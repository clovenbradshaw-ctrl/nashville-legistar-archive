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
async function fromBrowser(id, lang) {
  const watch = 'https://www.youtube.com/watch?v=' + id;
  for (const p of PROXIES) {
    let raw; try { const r = await fetch(p(watch), { signal: AbortSignal.timeout(15000) }); if (!r.ok) continue; raw = await r.text(); } catch (e) { continue; }
    const m = raw.match(/"captionTracks":(\[.*?\])/); if (!m) continue;
    let tracks; try { tracks = JSON.parse(m[1]); } catch (e) { continue; }
    const t = pickTrack(tracks, lang); if (!t || !t.baseUrl) continue;
    try {
      const sep = t.baseUrl.indexOf('?') < 0 ? '?' : '&';
      const r = await fetch(t.baseUrl + sep + 'fmt=json3', { signal: AbortSignal.timeout(20000) }); if (!r.ok) continue;
      const segs = parseJson3(await r.text()); if (!segs.length) continue;
      const title = (raw.match(/"title":"([^"]{1,200})"/) || [])[1] || '';
      return { title: JSON.parse('"' + title + '"'), author: '', lang: t.languageCode || lang || '', kind: t.kind === 'asr' ? 'asr' : 'manual',
        segments: segs, source: 'timedtext', model: 'captions', via: 'a public proxy (' + new URL(p(watch)).hostname + ')', rung: 'proxy' };
    } catch (e) { /* next proxy */ }
  }
  return null;
}

// The one entry point the surface calls: captions by helper, then by proxy, else null (the
// caller then keeps the link and offers the recording for in-browser Whisper).
export async function transcriptFor(id, lang) {
  try { const h = await fromHelper(id, lang); if (h) return h; } catch (e) {}
  try { const b = await fromBrowser(id, lang); if (b) return b; } catch (e) {}
  return null;
}

// The audio, from the local helper only — there is no cross-origin way to the stream. Used
// solely to feed in-browser Whisper when no caption track exists.
export async function audioFor(id) {
  const r = await fetch(ytdlBase() + '/audio?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('the yt-dlp helper answered ' + r.status);
  return { buf: await r.arrayBuffer(), mime: r.headers.get('content-type') || 'audio/mp4' };
}
