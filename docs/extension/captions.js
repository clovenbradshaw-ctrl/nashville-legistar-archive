// captions.js — read one YouTube video's caption track, from wherever this runs.
//
// The ANDROID and IOS innertube clients return caption tracks whose body is real; a browser page's own
// fetch gets an empty body (proof-of-origin token) and no CORS header on the player API. Running this
// where those limits do not apply — the capture extension's background (the person's own browser and
// address) or a Cloudflare Worker — is what makes a transcript possible without yt-dlp.
//
// One reader, two homes: extension/background.js and tools/cf-captions/worker.mjs both import it, so the
// client versions, the track choice and the format handling live once.
//
// readCaptions(id, lang, fetchImpl) ->
//   { ok: true,  title, author, lang, kind, segments:[{start,end,text}] }   (segments is [] for no track)
//   { ok: false, error }                                                      (YouTube refused; why)

const PLAYER = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
export const CLIENTS = [
  { name: 'ANDROID', id: '3', version: '20.10.38', ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
    ctx: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
  { name: 'IOS', id: '5', version: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    ctx: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en' } },
];
export const VIDEO_ID = /^[\w-]{11}$/;

// yt-dlp's json3 (events[].tStartMs / dDurationMs / segs[].utf8) -> [{start,end,text}], neighbours that
// follow each other closely joined. The same shape the page's own reader and Whisper path produce.
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

// The wanted language first (exact, then the same base language, then any), and within it manual before
// automatic. Language dominates: English auto-captions are worth more to a reader who asked for English
// than a German track a person typed.
export function pickTrack(tracks, lang) {
  const want = (lang || 'en').toLowerCase(), base = want.split('-')[0];
  const rank = t => { const c = (t.languageCode || '').toLowerCase(); return c === want ? 0 : c.split('-')[0] === base ? 1 : 2; };
  const score = t => rank(t) * 2 + (t.kind === 'asr' ? 1 : 0);
  return tracks.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

async function playerResponse(client, id, f) {
  const r = await f(PLAYER, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': client.ua, 'x-youtube-client-name': client.id, 'x-youtube-client-version': client.version },
    body: JSON.stringify({ context: { client: client.ctx }, videoId: id }),
  });
  if (!r.ok) throw new Error(client.name + ' player answered HTTP ' + r.status);
  return r.json();
}

// Try each client in turn; the first that yields tracks wins, otherwise the last refusal's reason.
async function readTracks(id, f) {
  let reason = 'no caption track', last = null;
  for (const client of CLIENTS) {
    let j; try { j = await playerResponse(client, id, f); } catch (e) { reason = String(e.message || e); continue; }
    const ps = j.playabilityStatus || {};
    if (ps.status && ps.status !== 'OK') { reason = (ps.status + (ps.reason ? ': ' + ps.reason : '')).slice(0, 160); continue; }
    last = j;
    const tracks = (((j.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
    if (tracks.length) return { client, tracks, details: j.videoDetails || {} };
    reason = 'no caption track';
  }
  return { client: null, tracks: [], details: (last && last.videoDetails) || {}, reason };
}

export async function readCaptions(id, lang, fetchImpl) {
  const f = fetchImpl || ((...a) => fetch(...a));
  if (!VIDEO_ID.test(String(id || ''))) return { ok: false, error: 'id must be an 11-character video id' };
  const got = await readTracks(id, f);
  if (!got.tracks.length) {
    if (got.reason === 'no caption track') return { ok: true, title: got.details.title || '', author: got.details.author || '', lang: lang || '', kind: '', segments: [] };
    return { ok: false, error: got.reason };
  }
  const t = pickTrack(got.tracks, lang);
  // The ANDROID client's track URL already carries fmt=srv3 (XML): the format is replaced, not appended to.
  const track = new URL(t.baseUrl); track.searchParams.set('fmt', 'json3');
  const r = await f(track.toString(), { headers: { 'user-agent': got.client.ua } });
  if (!r.ok) return { ok: false, error: 'the caption track answered HTTP ' + r.status };
  const ms = x => Math.round(x * 1000) / 1000;
  const segments = parseJson3(await r.text()).map(s => ({ start: ms(s.start), end: ms(s.end), text: s.text }));
  if (!segments.length) return { ok: false, error: 'the caption track came back empty' };
  return { ok: true, title: got.details.title || '', author: got.details.author || '', lang: t.languageCode || lang || '', kind: t.kind === 'asr' ? 'asr' : 'manual', segments };
}
