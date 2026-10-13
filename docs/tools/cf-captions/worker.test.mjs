// worker.test.mjs — the caption worker's contract, against a mocked fetch (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

const PAGE = 'https://scores-patch-points.github.io';
const ID = 'jNQXAC9IVRw';
const json3 = JSON.stringify({ events: [{ tStartMs: 1200, dDurationMs: 2160, segs: [{ utf8: 'All right, so here we are' }] }] });
const playerOk = (name, tracks) => ({ playabilityStatus: { status: 'OK' }, videoDetails: { title: 'Me at the zoo', author: 'jawed' },
  captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } }, _client: name });
// ANDROID's track URLs arrive with fmt=srv3 (XML) already set.
const trackEn = { languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?v=' + ID + '&lang=en&fmt=srv3' };

// Players answer by the x-youtube-client-name header; the caption track answers with json3.
function youtube({ android, ios, track = json3 }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).startsWith('https://www.youtube.com/youtubei/v1/player')) {
      const who = init.headers['x-youtube-client-name'] === '3' ? android : ios;
      return { ok: true, status: 200, json: async () => who };
    }
    if (String(url).startsWith('https://www.youtube.com/api/timedtext')) return { ok: true, status: 200, text: async () => track };
    throw new Error('unexpected fetch ' + url);
  };
  return calls;
}
const get = (path, origin = PAGE, env = {}) => worker.fetch(new Request('https://w.example' + path, { headers: origin ? { origin } : {} }), env);

test('/health answers like the helper, and says it is the worker', async () => {
  const r = await get('/health');
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.engine, 'cloudflare-worker');
  assert.equal(r.headers.get('access-control-allow-origin'), PAGE);
});

test('/captions returns the helper\'s own shape', async () => {
  const calls = youtube({ android: playerOk('a', [trackEn]), ios: playerOk('i', []) });
  const r = await get('/captions?id=' + ID + '&lang=en');
  const j = await r.json();
  assert.equal(r.status, 200);
  const asked = calls.find(u => u.includes('/api/timedtext'));
  assert.equal(new URL(asked).searchParams.getAll('fmt').join(','), 'json3', 'fmt is replaced, not appended: ' + asked);
  assert.deepEqual(Object.keys(j).sort(), ['author', 'id', 'kind', 'lang', 'segments', 'title']);
  assert.equal(j.title, 'Me at the zoo'); assert.equal(j.kind, 'manual');
  assert.deepEqual(j.segments[0], { start: 1.2, end: 3.36, text: 'All right, so here we are' });
});

test('falls back from ANDROID to IOS when the first returns no track', async () => {
  const calls = youtube({ android: playerOk('a', []), ios: playerOk('i', [trackEn]) });
  const j = await (await get('/captions?id=' + ID)).json();
  assert.equal(j.segments.length, 1);
  assert.equal(calls.filter(u => u.includes('/youtubei/v1/player')).length, 2);
});

test('a video with no caption track is a 200 with no segments (the page says no-track)', async () => {
  youtube({ android: playerOk('a', []), ios: playerOk('i', []) });
  const r = await get('/captions?id=' + ID);
  const j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(j.segments, []);
});

test('a refusal from YouTube is a 502 that carries the reason', async () => {
  const refused = { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you’re not a bot' } };
  youtube({ android: refused, ios: refused });
  const r = await get('/captions?id=' + ID);
  const j = await r.json();
  assert.equal(r.status, 502); assert.match(j.error, /LOGIN_REQUIRED/);
});

test('an empty caption body is a 502, not a transcript of nothing', async () => {
  youtube({ android: playerOk('a', [trackEn]), ios: playerOk('i', [trackEn]), track: '' });
  const r = await get('/captions?id=' + ID);
  assert.equal(r.status, 502);
});

test('not an open relay: bad id, foreign origin, wrong method, unknown path', async () => {
  youtube({ android: playerOk('a', [trackEn]), ios: playerOk('i', [trackEn]) });
  assert.equal((await get('/captions?id=../../etc')).status, 400);
  assert.equal((await get('/captions?id=' + ID, 'https://evil.example')).status, 403);
  assert.equal((await worker.fetch(new Request('https://w.example/captions?id=' + ID, { method: 'POST', headers: { origin: PAGE } }), {})).status, 405);
  assert.equal((await get('/audio?id=' + ID)).status, 404);
});

test('any localhost port is allowed; ALLOW_ORIGINS replaces the default list', async () => {
  assert.equal((await get('/health', 'http://127.0.0.1:8933')).status, 200);
  assert.equal((await get('/health', PAGE, { ALLOW_ORIGINS: 'https://other.example' })).status, 403);
  assert.equal((await get('/health', 'https://other.example', { ALLOW_ORIGINS: 'https://other.example' })).status, 200);
});
