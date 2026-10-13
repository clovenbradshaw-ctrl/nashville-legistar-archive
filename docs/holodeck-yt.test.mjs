// holodeck-yt.test.mjs — what the surface is told when a YouTube link's captions cannot be read.
// fetch is replaced per case; nothing here touches the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { transcriptOutcome, transcriptFor } from './holodeck-yt.js';

const realFetch = globalThis.fetch;
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
// A fetch that answers by URL prefix; anything unlisted fails like a refused connection.
function route(table) {
  globalThis.fetch = async (url, init) => {
    for (const [prefix, answer] of table) {
      if (String(url).startsWith(prefix)) return typeof answer === 'function' ? answer(url, init) : answer;
    }
    throw new TypeError('Failed to fetch');
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; delete globalThis.window; delete globalThis.location; });

const HELPER = 'http://127.0.0.1:11450';
const segs = [{ start: 1, end: 3, text: 'All right, so here we are' }];

test('helper answers with captions: the object, no reason', async () => {
  route([[HELPER + '/captions', json({ title: 'Me at the zoo', author: 'jawed', lang: 'en', kind: 'manual', segments: segs })]]);
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.why, null);
  assert.equal(o.cap.rung, 'helper');
  assert.equal(o.cap.segments.length, 1);
});

test('nothing answers at the helper: helper-unreachable', async () => {
  route([]); // every fetch refuses, health check included
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.cap, null);
  assert.equal(o.why, 'helper-unreachable');
});

test('helper is up but errors on this video: helper-error, not unreachable', async () => {
  route([[HELPER + '/captions', json({ error: 'yt-dlp failed' }, 500)], [HELPER + '/health', json({ ok: true })]]);
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.cap, null);
  assert.equal(o.why, 'helper-error');
});

test('helper read the video and found no caption track: no-track', async () => {
  route([[HELPER + '/captions', json({ title: 't', segments: [] })]]);
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.cap, null);
  assert.equal(o.why, 'no-track');
});

test('transcriptFor keeps its old contract: the object, or null', async () => {
  route([[HELPER + '/captions', json({ segments: segs })]]);
  assert.equal((await transcriptFor('x', 'en')).segments.length, 1);
  route([]);
  assert.equal(await transcriptFor('x', 'en'), null);
});

test('proxies that never answer end within one budget, not 15 s each', async () => {
  // Helper refuses at once; every proxy hangs until its own abort signal fires.
  globalThis.fetch = (url, init) => {
    if (String(url).startsWith(HELPER)) return Promise.reject(new TypeError('Failed to fetch'));
    return new Promise((_, reject) => { init && init.signal && init.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
  };
  const t0 = Date.now();
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  const took = Date.now() - t0;
  assert.equal(o.cap, null);
  assert.equal(o.why, 'helper-unreachable');
  assert.ok(took < 9000, 'took ' + took + ' ms — four proxies at 15 s each would be a minute');
});

// ── the capture extension, answering through window.postMessage ──────────────────────────────────
function fakeExtension(handler) {
  const ls = new Set();
  const win = {
    addEventListener: (t, f) => ls.add(f), removeEventListener: (t, f) => ls.delete(f),
    // Like a browser: the page's own message is delivered back to its own listeners, then the extension answers.
    postMessage(msg) { setTimeout(() => {
      for (const f of [...ls]) f({ source: win, data: msg });
      const r = handler(msg); if (r) for (const f of [...ls]) f({ source: win, data: { rid: msg.rid, ...r } });
    }, 0); },
  };
  globalThis.window = win; globalThis.location = { origin: 'https://scores-patch-points.github.io' };
}

test('the extension answers first: its captions, and the helper is never asked', async () => {
  fakeExtension(m => m.type === 'fold-captions-ping' ? { type: 'fold-captions-here' }
    : { type: 'fold-captions-result', ok: true, title: 't', lang: 'en', kind: 'manual', segments: segs });
  let helperAsked = false;
  globalThis.fetch = async () => { helperAsked = true; throw new TypeError('Failed to fetch'); };
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.why, null); assert.equal(o.cap.rung, 'extension'); assert.equal(helperAsked, false);
});

test('no extension: the ping costs under a second and the helper is tried as before', async () => {
  fakeExtension(() => null); // nothing answers
  route([[HELPER + '/captions', json({ title: 't', segments: segs })]]);
  const t0 = Date.now();
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.cap.rung, 'helper');
  assert.ok(Date.now() - t0 < 1500, 'waited ' + (Date.now() - t0) + ' ms for an extension that is not there');
});

test('extension present but refused: extension-error with its reason, even when the helper is also down', async () => {
  fakeExtension(m => m.type === 'fold-captions-ping' ? { type: 'fold-captions-here' }
    : { type: 'fold-captions-result', ok: false, error: 'LOGIN_REQUIRED: Sign in to confirm you’re not a bot' });
  route([]);
  const o = await transcriptOutcome('jNQXAC9IVRw', 'en');
  assert.equal(o.cap, null); assert.equal(o.why, 'extension-error'); assert.match(o.detail, /LOGIN_REQUIRED/);
});
