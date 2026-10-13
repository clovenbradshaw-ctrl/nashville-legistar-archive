// worker.mjs — a Cloudflare Worker that answers the yt-dlp helper's /health and /captions, so a hosted
// copy of the page can read YouTube captions with nothing running on the reader's machine.
//
// Why a server at all: from a browser origin YouTube's caption track comes back empty (it wants a
// proof-of-origin token a page cannot mint) and its player API sends no CORS header. The ANDROID and
// IOS innertube clients still return tracks whose body is real, so the read is done here and the page
// gets the helper's own JSON shape: { title, author, lang, kind, segments:[{start,end,text}] }.
// Point the page at it with the Settings field "yt-dlp helper" (localStorage hd:ytdl) — no page change.
//
// Not an open relay: only GET /health and GET /captions, only an 11-character video id, only
// youtube.com, only the page's own origins (ALLOW_ORIGINS). It runs on the account that deploys it.
//
// Not covered: /audio, /clip, /stitch (those need yt-dlp and ffmpeg and stay with the local helper).

import { readCaptions, VIDEO_ID } from '../../extension/captions.js';

const CLIENT_NAMES = ['ANDROID', 'IOS'];
const DEFAULT_ORIGINS = 'https://scores-patch-points.github.io,http://127.0.0.1,http://localhost';

// A page origin is allowed when it equals an entry, or is an entry plus a port (so any localhost port works).
function originAllowed(origin, env) {
  if (!origin) return false;
  return String(env.ALLOW_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean)
    .some(a => origin === a || origin.startsWith(a + ':'));
}

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('origin') || '';
    const allowed = originAllowed(origin, env);
    const cors = allowed ? { 'access-control-allow-origin': origin, 'vary': 'origin', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': '*' } : { 'vary': 'origin' };
    const send = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors, ...(extra || {}) } });

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== 'GET') return send(405, { error: 'GET only' });
    if (origin && !allowed) return send(403, { error: 'origin not allowed' });

    const url = new URL(request.url);
    if (url.pathname === '/health') return send(200, { ok: true, engine: 'cloudflare-worker', clients: CLIENT_NAMES });
    if (url.pathname === '/captions') {
      const id = url.searchParams.get('id') || '';
      if (!VIDEO_ID.test(id)) return send(400, { error: 'id must be an 11-character video id' });
      try {
        const r = await readCaptions(id, url.searchParams.get('lang') || 'en');
        if (!r.ok) return send(502, { error: r.error });
        const { ok, ...body } = r; body.id = id;
        return send(200, body, body.segments.length ? { 'cache-control': 'public, max-age=3600' } : {});
      } catch (e) { return send(502, { error: String(e && e.message || e).slice(0, 160) }); }
    }
    return send(404, { error: 'not here: this worker answers /health and /captions' });
  },
};
