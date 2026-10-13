// captions.test.mjs — the shared caption reader, and the content script's bridge for it.
// fetch, window and chrome are stubs; nothing here touches the network or a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readCaptions, pickTrack, parseJson3 } from './captions.js';

const ID = 'jNQXAC9IVRw';
const json3 = JSON.stringify({ events: [{ tStartMs: 1200, dDurationMs: 2160, segs: [{ utf8: 'All right, so here we are' }] }] });
const track = (lang, kind) => ({ languageCode: lang, kind, baseUrl: 'https://www.youtube.com/api/timedtext?v=' + ID + '&lang=' + lang + '&fmt=srv3' });
const player = tracks => ({ playabilityStatus: { status: 'OK' }, videoDetails: { title: 'Me at the zoo', author: 'jawed' },
  captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } } });

// A fetch that answers the player by client name and any timedtext URL with `body`.
function youtube({ android, ios, body = json3 }) {
  const asked = [];
  const f = async (url, init = {}) => {
    asked.push(String(url));
    if (String(url).includes('/youtubei/v1/player')) return { ok: true, status: 200, json: async () => (init.headers['x-youtube-client-name'] === '3' ? android : ios) };
    if (String(url).includes('/api/timedtext')) return { ok: true, status: 200, text: async () => body };
    throw new Error('unexpected ' + url);
  };
  f.asked = asked; return f;
}

test('reads a track: helper-shaped result, fmt replaced, times in milliseconds', async () => {
  const f = youtube({ android: player([track('en')]), ios: player([]) });
  const r = await readCaptions(ID, 'en', f);
  assert.equal(r.ok, true); assert.equal(r.title, 'Me at the zoo'); assert.equal(r.kind, 'manual');
  assert.deepEqual(r.segments[0], { start: 1.2, end: 3.36, text: 'All right, so here we are' });
  const url = new URL(f.asked.find(u => u.includes('/api/timedtext')));
  assert.deepEqual(url.searchParams.getAll('fmt'), ['json3']);
});

test('falls back from ANDROID to IOS; no track at all is ok with no segments', async () => {
  const f = youtube({ android: player([]), ios: player([track('en')]) });
  assert.equal((await readCaptions(ID, 'en', f)).segments.length, 1);
  const none = await readCaptions(ID, 'en', youtube({ android: player([]), ios: player([]) }));
  assert.equal(none.ok, true); assert.deepEqual(none.segments, []);
});

test('a refusal carries its reason; an empty body is a refusal; a bad id never reaches YouTube', async () => {
  const refused = { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you’re not a bot' } };
  const r1 = await readCaptions(ID, 'en', youtube({ android: refused, ios: refused }));
  assert.equal(r1.ok, false); assert.match(r1.error, /LOGIN_REQUIRED/);
  const r2 = await readCaptions(ID, 'en', youtube({ android: player([track('en')]), ios: player([track('en')]), body: '' }));
  assert.equal(r2.ok, false);
  const f = youtube({ android: player([]), ios: player([]) });
  const r3 = await readCaptions('../../x', 'en', f);
  assert.equal(r3.ok, false); assert.equal(f.asked.length, 0);
});

test('pickTrack prefers the language, then manual over automatic; parseJson3 joins close neighbours', () => {
  const pick = (tracks, lang) => { const t = pickTrack(tracks, lang); return t.languageCode + (t.kind ? '/' + t.kind : ''); };
  assert.equal(pick([track('de'), track('en', 'asr'), track('en')], 'en'), 'en');
  assert.equal(pick([track('de'), track('en', 'asr')], 'en'), 'en/asr', 'the wanted language beats a typed track in another');
  assert.equal(pick([track('en-GB', 'asr'), track('de')], 'en-US'), 'en-GB/asr');
  const s = parseJson3(JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'a' }] }, { tStartMs: 1100, dDurationMs: 500, segs: [{ utf8: 'b' }] }] }));
  assert.equal(s.length, 1); assert.equal(s[0].text, 'a b');
});

// ── the content script's bridge ──────────────────────────────────────────────────────────────────
const CONTENT = readFileSync(fileURLToPath(new URL('./content.js', import.meta.url)), 'utf8');
function page(origin, background) {
  const listeners = [], posted = [];
  const window = {
    addEventListener: (t, f) => { if (t === 'message') listeners.push(f); },
    postMessage(data) { posted.push(data); for (const f of listeners.slice()) f({ source: window, data }); },
  };
  const sandbox = { window, location: { origin, hash: '', href: origin + '/', protocol: 'https:' }, document: {}, setTimeout, console,
    chrome: { runtime: { onMessage: { addListener() {} }, lastError: undefined, sendMessage: (msg, cb) => background(msg, cb) } } };
  vm.runInNewContext(CONTENT, sandbox);
  return { window, posted };
}
const ask = (w, msg) => w.postMessage({ rid: 'r1', ...msg });
const replies = p => p.posted.filter(m => m.type && m.type.startsWith('fold-captions-') && m.type !== 'fold-captions-request' && m.type !== 'fold-captions-ping');

test('bridge: a ping is answered on the fold origin, and not on any other page', () => {
  const fold = page('https://scores-patch-points.github.io', () => {});
  ask(fold.window, { type: 'fold-captions-ping' });
  assert.equal(replies(fold)[0].type, 'fold-captions-here');
  const other = page('https://news.example', () => {});
  ask(other.window, { type: 'fold-captions-ping' });
  assert.equal(replies(other).length, 0);
});

test('bridge: a request is relayed with the same rid; a bad id is refused before the background', () => {
  const seen = [];
  const fold = page('http://127.0.0.1:8933', (msg, cb) => { seen.push(msg); cb({ ok: true, segments: [{ start: 0, end: 1, text: 'hi' }] }); });
  ask(fold.window, { type: 'fold-captions-request', id: ID, lang: 'en' });
  const r = replies(fold)[0];
  assert.equal(r.type, 'fold-captions-result'); assert.equal(r.rid, 'r1'); assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(seen[0])), { type: 'fold-captions', id: ID, lang: 'en' });
  ask(fold.window, { type: 'fold-captions-request', id: 'nope' });
  assert.equal(seen.length, 1);
  assert.equal(replies(fold)[1].ok, false);
});

// ── the background worker's message handler ──────────────────────────────────────────────────────
test('background: validates the id, answers asynchronously with the reader\'s result, ignores other messages', async () => {
  let handler;
  globalThis.chrome = { runtime: { onMessage: { addListener: f => { handler = f; } } }, action: { onClicked: { addListener() {} } }, tabs: {}, scripting: {} };
  await import('./background.js?captions-test');
  assert.equal(typeof handler, 'function');

  const bad = []; const keep = handler({ type: 'fold-captions', id: '../x' }, {}, r => bad.push(r));
  assert.equal(keep, false); assert.equal(bad[0].ok, false);

  const realFetch = globalThis.fetch;
  globalThis.fetch = youtube({ android: player([track('en')]), ios: player([]) });
  try {
    const got = await new Promise(resolve => { const keepOpen = handler({ type: 'fold-captions', id: ID, lang: 'en' }, {}, resolve); assert.equal(keepOpen, true); });
    assert.equal(got.ok, true); assert.equal(got.segments.length, 1);
  } finally { globalThis.fetch = realFetch; }

  assert.equal(handler({ type: 'something-else' }, {}, () => assert.fail('no reply expected')), false);
  delete globalThis.chrome;
});
