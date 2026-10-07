// holodeck-chat-lane.test.mjs — the fold's heimdall chat lane: model metadata,
// the sealed gate on the wire, and NDJSON streaming. Fake fetch; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probe, chat, isSealed, meter, HEIMDALL } from './holodeck-chat-lane.js';

function json(obj) { return { ok: true, status: 200, json: async () => obj }; }

test('probe reads the bridge model list and marks outside models sealed', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /\/api\/tags$/);
    return json({
      models: [
        { name: 'gemma2:2b', heimdall: { webllm: 'gemma-2-2b-it-q4f16_1-MLC', workers: 1 } },
        { name: 'gpt-oss-120b', heimdall: { frontier: 'groq', privacy: 'sealed-external', location: 'external' } },
        { name: 'gemma2:9b', heimdall: {} },
      ],
    });
  };
  const p = await probe(HEIMDALL, { fetchImpl });
  assert.equal(p.ok, true);
  assert.equal(p.models.length, 3);
  assert.equal(p.models.find(m => m.name === 'gpt-oss-120b').sealed, true);
  assert.equal(p.models.find(m => m.name === 'gemma2:2b').sealed, false);
  assert.equal(p.models.find(m => m.name === 'gpt-oss-120b').provider, 'groq');
});

test('isSealed follows the heimdall metadata', () => {
  assert.equal(isSealed({ frontier: 'groq', privacy: 'sealed-external' }), true);
  assert.equal(isSealed({ webllm: 'x' }), false);
  assert.equal(isSealed({}), false);
});

test('a sealed chat carries heimdall_privacy on the wire and streams NDJSON', async () => {
  let captured = null;
  const lines = [
    JSON.stringify({ message: { content: 'Se' } }),
    JSON.stringify({ message: { content: 'aled' } }),
    JSON.stringify({ done: true, eval_count: 4, prompt_eval_count: 12 }),
  ].join('\n') + '\n';
  const fetchImpl = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(lines)); c.close(); } }) };
  };
  const seen = [];
  const out = await chat(HEIMDALL, 'gpt-oss-120b', [{ role: 'user', content: 'seal' }], { sealed: true, onToken: (t) => seen.push(t), fetchImpl });
  assert.equal(out.text, 'Sealed');
  assert.equal(seen.at(-1), 'Sealed');
  assert.match(captured.url, /\/api\/chat$/);
  assert.equal(captured.body.heimdall_privacy, 'sealed-external');
  assert.equal(captured.body.model, 'gpt-oss-120b');
  assert.equal(out.stats.eval_count, 4);
});

test('a local model rides the same wire without the privacy field', async () => {
  let body = null;
  const fetchImpl = async (url, opts) => {
    body = JSON.parse(opts.body);
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ done: true, message: { content: 'ok' } }) + '\n')); c.close(); } }) };
  };
  const out = await chat(HEIMDALL, 'gemma2:2b', [{ role: 'user', content: 'hi' }], { sealed: false, fetchImpl });
  assert.equal(body.heimdall_privacy, undefined);
  assert.equal(out.text, 'ok');
});

test('probe failure is a typed { ok:false, why }, never a throw', async () => {
  const fetchImpl = async () => { throw new Error('refused'); };
  const p = await probe('http://127.0.0.1:9', { fetchImpl });
  assert.equal(p.ok, false);
  assert.match(p.why, /refused/);
});

test('meter returns heimdall accounting when the bridge answers', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /\/api\/meter$/);
    return json({ counts: { 'deterministic/local': 3, 'open remote': 1, frontier: 0 }, externalTokens: 12, estimated: { frontierEverything: 12, conventionalRawContext: 272, note: 'estimates' } });
  };
  const m = await meter(HEIMDALL, { fetchImpl });
  assert.equal(m.externalTokens, 12);
  assert.equal(m.counts['open remote'], 1);
});