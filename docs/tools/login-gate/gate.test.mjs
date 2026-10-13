// gate.test.mjs — the login gate, against an in-test homeserver that really checks passwords (not Synapse).
//
// The properties that matter, each with the evidence that the homeserver was NOT reached when it should not be:
//   a wrong code never forwards the password (so the gate is not a password oracle); a code works once; failures
//   lock; non-password login types cannot bypass; accounts are enrolled at creation, and the secret is shown once;
//   the store is encrypted at rest; nothing sensitive is logged; and only the owner's device can ask who is enrolled.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { homeserver } from '../../tests/fake-homeserver.mjs';
import { createGate } from './gate.mjs';
import { totpCode, base32Decode } from '../../holodeck-invite-core.js';

const NAME = 'gate.test';
let hs, gate, base, T0, logs, clock;
const T = () => clock.t;
const memoryStore = () => { let blob = null; return { load: async () => (blob ? JSON.parse(blob) : null), save: async (o) => { blob = JSON.stringify(o); }, raw: () => blob }; };
let store;

async function boot(over = {}) {
  hs = await homeserver({ name: NAME });
  clock = { t: 1_800_000_000_000 };
  logs = [];
  store = memoryStore();
  gate = createGate({ upstream: hs.base, serverName: NAME, admins: ['@owner:' + NAME], ...over }, { store, now: () => clock.t, log: (l) => logs.push(l) });
  await new Promise((r) => gate.server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + gate.server.address().port;
}
async function stop() { gate.server.closeAllConnections?.(); await new Promise((r) => gate.server.close(r)); await hs.close(); }

const post = async (p, body, headers = {}) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
};
const upstreamHits = (re) => hs.seen.filter((r) => re.test(r.path)).length;
const code = (secret, ms = 0) => totpCode(secret, clock.t + ms);

// make an enrolled account the way a person does: start, scan, choose a password, register through the gate
async function signUp(username, password) {
  const start = (await post('/gate/v1/enroll/start', { account: username })).j;
  const reg = await post('/_matrix/client/v3/register', { username, password, auth: { type: 'm.login.dummy' }, totp: { ticket: start.ticket, code: await code(start.secret) } });
  return { start, reg };
}

test('enrolment happens at account creation: the gate hands out the secret once, and refuses to create an account without its code', async () => {
  await boot();
  try {
    const start = (await post('/gate/v1/enroll/start', { account: 'Ana (accountant)' })).j;
    assert.match(start.secret, /^[A-Z2-7]{32}$/);
    assert.match(start.otpauth, /^otpauth:\/\/totp\/Holodeck:Ana/);
    assert.equal(start.expires_in, 600);

    const before = upstreamHits(/register/);
    // no totp at all, a ticket nobody issued, a wrong code: the homeserver is never asked
    assert.equal((await post('/_matrix/client/v3/register', { username: 'ana', password: 'correct horse', auth: { type: 'm.login.dummy' } })).status, 403);
    assert.equal((await post('/_matrix/client/v3/register', { username: 'ana', password: 'correct horse', auth: { type: 'm.login.dummy' }, totp: { ticket: 'nope', code: '123456' } })).status, 403);
    const bad = await code(start.secret, 5 * 60_000);
    assert.equal((await post('/_matrix/client/v3/register', { username: 'ana', password: 'correct horse', auth: { type: 'm.login.dummy' }, totp: { ticket: start.ticket, code: bad } })).status, 403);
    assert.equal(upstreamHits(/register/), before, 'the homeserver saw none of those');

    const ok = await post('/_matrix/client/v3/register', { username: 'ana', password: 'correct horse', auth: { type: 'm.login.dummy' }, totp: { ticket: start.ticket, code: await code(start.secret) } });
    assert.equal(ok.status, 200);
    assert.equal(ok.j.user_id, `@ana:${NAME}`);
    const sent = hs.seen.filter((r) => /register/.test(r.path)).pop();
    assert.ok(!('totp' in sent.body), 'the code and ticket are stripped before the homeserver sees the request');
    assert.equal(hs.passwords.get(`@ana:${NAME}`), 'correct horse', 'the password went to the homeserver, which holds it');
    // the ticket is single use
    assert.equal((await post('/_matrix/client/v3/register', { username: 'ana2', password: 'another long one', auth: { type: 'm.login.dummy' }, totp: { ticket: start.ticket, code: await code(start.secret, 30_000) } })).status, 403);
    // and the secret is not available any other way
    assert.equal((await post('/gate/v1/enroll/start', {})).j.secret === start.secret, false);
  } finally { await stop(); }
});

test('sign-in needs the password AND the six digits; a wrong or missing code never forwards the password; a right code works once', async () => {
  await boot();
  try {
    const { start } = await signUp('ana', 'correct horse battery');
    clock.t += 60_000;                                           // the enrolment code's step is behind us
    const login = (extra, pw = 'correct horse battery') => post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'ana' }, password: pw, ...extra });
    const n0 = upstreamHits(/login/);

    // right password, no code / wrong code / malformed: refused, and the homeserver never saw the password
    assert.equal((await login({})).status, 403);
    assert.equal((await login({ totp: '000000' })).status, 403);
    assert.equal((await login({ totp: 'abcdef' })).status, 403);
    assert.equal(upstreamHits(/login/), n0, 'control: three refusals, zero homeserver requests — the gate is not a password oracle');
    // a wrong password with a right code: refused by the homeserver, reported in the same words
    const wrongPw = await login({ totp: await code(start.secret) }, 'not the password');
    assert.equal(wrongPw.status, 403);
    assert.equal(wrongPw.j.error, (await login({})).j.error, 'the same words whichever factor failed');
    assert.equal(upstreamHits(/login/), n0 + 1);

    clock.t += 30_000;
    const good = await login({ totp: await code(start.secret) });
    assert.equal(good.status, 200);
    assert.ok(good.j.access_token);
    const forwarded = hs.seen.filter((r) => /login/.test(r.path)).pop();
    assert.ok(!('totp' in forwarded.body), 'the code is stripped');
    // the same code a moment later (a replay of something captured): refused, homeserver not asked
    const n1 = upstreamHits(/login/);
    assert.equal((await login({ totp: await code(start.secret) })).status, 403);
    assert.equal(upstreamHits(/login/), n1, 'a used code is dead for the rest of its time step');
    clock.t += 30_000;
    assert.equal((await login({ totp: await code(start.secret) })).status, 200, 'the next step’s code works');
  } finally { await stop(); }
});

test('an ordinary Matrix app can sign in: the six digits after the password are accepted and stripped', async () => {
  await boot();
  try {
    const { start } = await signUp('ana', 'correct horse battery');
    clock.t += 60_000;
    const r = await post('/_matrix/client/v3/login', { type: 'm.login.password', user: 'ana', password: 'correct horse battery' + await code(start.secret) });
    assert.equal(r.status, 200);
    assert.equal(hs.seen.filter((x) => /login/.test(x.path)).pop().body.password, 'correct horse battery', 'the homeserver got the password without the digits');
    clock.t += 30_000;
    // a password that itself ends in digits still works, with its digits left alone
    const s2 = await signUp('bob', 'letmein123456');
    clock.t += 60_000;
    const r2 = await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: '@bob:' + NAME }, password: 'letmein123456' + await code(s2.start.secret) });
    assert.equal(r2.status, 200);
  } finally { await stop(); }
});

test('failures lock further tries — per account and per address — and a lock never reaches the homeserver; an account that never enrolled is untouched', async () => {
  await boot({ limits: { userFailures: 4, userLockMs: 120_000, ipFailures: 100 } });
  try {
    const { start } = await signUp('ana', 'correct horse battery');
    hs.passwords.set('@plain:' + NAME, 'plain password');
    clock.t += 60_000;
    const login = (user, extra, pw = 'correct horse battery') => post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user }, password: pw, ...extra });
    for (let i = 0; i < 4; i++) assert.equal((await login('ana', { totp: String(100000 + i) })).status, 403);
    const hits = upstreamHits(/login/);
    const locked = await login('ana', { totp: await code(start.secret) });                  // even the RIGHT code, while locked
    assert.equal(locked.status, 429);
    assert.ok(locked.j.retry_after_ms > 0);
    assert.equal(upstreamHits(/login/), hits);
    clock.t += 121_000;
    assert.equal((await login('ana', { totp: await code(start.secret) })).status, 200, 'the lock lifts');
    // someone who never enrolled signs in as before (policy "enrolled": the gate only guards enrolled accounts)
    assert.equal((await login('plain', {}, 'plain password')).status, 200);
  } finally { await stop(); }
});

test('enforce "all": an account that never enrolled is refused unless it is on the allow-list; other login types cannot bypass the code', async () => {
  await boot({ enforce: 'all', allowUnenrolled: ['@owner:' + NAME] });
  try {
    hs.passwords.set('@owner:' + NAME, 'owner password'); hs.passwords.set('@legacy:' + NAME, 'legacy password');
    const pw = (user, password) => post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user }, password });
    assert.equal((await pw('owner', 'owner password')).status, 200);
    const n = upstreamHits(/login/);
    assert.equal((await pw('legacy', 'legacy password')).status, 403);
    assert.equal(upstreamHits(/login/), n, 'refused without asking the homeserver');
    assert.equal((await post('/_matrix/client/v3/login', { type: 'm.login.token', token: 'x' })).status, 403, 'a token login would bypass the code');
    assert.equal((await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.thirdparty', medium: 'email', address: 'a@b.c' }, password: 'x' })).status, 403, 'an address login cannot be mapped to an account');
    assert.equal(upstreamHits(/login/), n);
  } finally { await stop(); }
});

test('only the workspace owner’s device can ask whether an account is enrolled, using an OpenID token — never its access token', async () => {
  await boot();
  try {
    const { reg } = await signUp('ana', 'correct horse battery');
    const owner = hs.user('owner'), eve = hs.user('eve');
    const oid = async (u) => (await (await fetch(`${hs.base}/_matrix/client/v3/user/${encodeURIComponent(u.user)}/openid/request_token`, { method: 'POST', headers: { authorization: 'Bearer ' + u.token, 'content-type': 'application/json' }, body: '{}' })).json()).access_token;
    const ask = (who, tok) => fetch(`${base}/gate/v1/enrolled?user=${encodeURIComponent(who)}`, { headers: tok ? { authorization: 'Bearer ' + tok } : {} }).then(async (r) => ({ status: r.status, j: await r.json() }));
    assert.equal((await ask(reg.j.user_id)).status, 403, 'no token');
    assert.equal((await ask(reg.j.user_id, 'oidc_made_up_token')).status, 403, 'unknown token');
    assert.equal((await ask(reg.j.user_id, owner.token)).status, 403, 'an access token is not an OpenID token');
    assert.equal((await ask(reg.j.user_id, await oid(eve))).status, 403, 'a verified user who is not an admin');
    const yes = await ask(reg.j.user_id, await oid(owner));
    assert.deepEqual([yes.status, yes.j], [200, { enrolled: true }]);
    assert.deepEqual((await ask('@nobody:' + NAME, await oid(owner))).j, { enrolled: false });
  } finally { await stop(); }
});

test('secrets: encrypted at rest by the file store, never in a log line, and the module imports no filesystem', async () => {
  await boot();
  try {
    const { start } = await signUp('ana', 'correct horse battery');
    clock.t += 60_000;
    await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'ana' }, password: 'correct horse battery', totp: await code(start.secret) });
    await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'ana' }, password: 'wrong wrong wrong', totp: '111111' });
    const all = logs.join('\n');
    assert.ok(logs.length > 0);
    for (const needle of [start.secret, 'correct horse', 'wrong wrong', '111111', 'ana', start.ticket]) assert.ok(!all.includes(needle), 'log contains ' + needle);
    const src = fs.readFileSync(fileURLToPath(new URL('./gate.mjs', import.meta.url)), 'utf8');
    const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    assert.ok(imports.includes('node:http') && !/\bfs\b|node:fs/.test(imports), 'gate.mjs imports no fs: ' + imports);
    // the real file store (cli.mjs) writes ciphertext with mode 0600 — exercised through its own functions
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
    const file = path.join(dir, 'store.bin');
    const key = crypto.randomBytes(32);
    const mod = await import('./cli-store.mjs');
    const fsStore = mod.fileStore(file, key);
    await fsStore.save({ v: 1, users: { '@ana:x': { secret: start.secret } } });
    const raw = fs.readFileSync(file);
    assert.ok(!raw.includes(Buffer.from(start.secret)) && !raw.includes(Buffer.from('@ana:x')), 'nothing readable in the file');
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(await fsStore.load(), { v: 1, users: { '@ana:x': { secret: start.secret } } });
    raw[raw.length - 1] ^= 1; fs.writeFileSync(file, raw);
    await assert.rejects(() => fsStore.load(), 'a tampered store is refused, not half-read');
    void base32Decode;
  } finally { await stop(); }
});

test('hygiene: bodies are bounded, JSON is required, the address limit applies to enrolment, CORS preflight answers, and unrouted paths are 404', async () => {
  await boot({ limits: { enrollPerIp: 3 } });
  try {
    assert.equal((await post('/_matrix/client/v3/login', 'x'.repeat(100_000))).status, 413);
    assert.equal((await post('/_matrix/client/v3/login', '{nope')).status, 400);
    assert.equal((await post('/_matrix/client/v3/login', '[1,2]')).status, 400);
    for (let i = 0; i < 3; i++) assert.equal((await post('/gate/v1/enroll/start', {})).status, 200);
    assert.equal((await post('/gate/v1/enroll/start', {})).status, 429);
    const pre = await fetch(base + '/_matrix/client/v3/login', { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
    assert.equal((await fetch(base + '/_matrix/client/v3/sync')).status, 404, 'the gate serves only what it is routed');
  } finally { await stop(); }
});

// ---------------------------------------------------------------- what a shared, already-running homeserver needs

test('production shape: registration "optional" keeps every existing sign-up working and still enrols those that ask; other methods on login are passed through', async () => {
  await boot({ registration: 'optional' });
  try {
    // an old client that has never heard of the gate: an account is made, with no authenticator, exactly as before
    const plain = await post('/_matrix/client/v3/register', { username: 'oldclient', password: 'a perfectly fine password', auth: { type: 'm.login.dummy' } });
    assert.equal(plain.status, 200);
    assert.equal(gate._users().has('@oldclient:' + NAME), false, 'not enrolled');
    // and it signs in with the password alone, as before
    const si = await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'oldclient' }, password: 'a perfectly fine password' });
    assert.equal(si.status, 200);
    // a client that DOES know about the gate enrols, and from then on needs the code
    const { start } = await signUp('newclient', 'another fine password');
    assert.equal(gate._users().has('@newclient:' + NAME), true);
    clock.t += 60_000;
    assert.equal((await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'newclient' }, password: 'another fine password' })).status, 403, 'now the password alone is refused');
    assert.equal((await post('/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'newclient' }, password: 'another fine password', totp: await code(start.secret) })).status, 200);
    // a request that names a ticket but gets the code wrong is NOT quietly passed through
    const s2 = (await post('/gate/v1/enroll/start', {})).j;
    const n = upstreamHits(/register/);
    assert.equal((await post('/_matrix/client/v3/register', { username: 'tryer', password: 'x'.repeat(14), auth: { type: 'm.login.dummy' }, totp: { ticket: s2.ticket, code: '000000' } })).status, 403);
    assert.equal(upstreamHits(/register/), n, 'a bad enrolment never reaches the homeserver');
  } finally { await stop(); }
});

test('production shape: GET /login (how a client learns the flows) reaches the homeserver; the other API versions are gated too; the real client address is forwarded', async () => {
  await boot();
  try {
    const { start } = await signUp('ana', 'correct horse battery');
    clock.t += 60_000;
    for (const v of ['r0', 'v3', 'unstable', 'api/v1']) {
      const flows = await (await fetch(`${base}/_matrix/client/${v}/login`)).json();
      assert.ok(flows.flows.some((f) => f.type === 'm.login.password'), v + ': flows come from the homeserver');
      // the password alone is refused on every version of the path, and never reaches the homeserver
      const n = upstreamHits(/login/);
      const r = await post(`/_matrix/client/${v}/login`, { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'ana' }, password: 'correct horse battery' });
      assert.equal(r.status, 403, v + ': no code, no sign-in');
      assert.equal(upstreamHits(/login/), n);
    }
    const ok = await post('/_matrix/client/unstable/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: 'ana' }, password: 'correct horse battery', totp: await code(start.secret) });
    assert.equal(ok.status, 200);
    const forwarded = hs.seen.filter((r) => /login/.test(r.path) && r.method === 'POST').pop();
    assert.match(String(forwarded.xff), /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/, 'the client address travels in X-Forwarded-For (here: loopback, the test client)');
  } finally { await stop(); }
});

test('production shape: an appservice login (bots, bridges) is forwarded when named; a token login still is not', async () => {
  await boot({ allowOtherLoginTypes: ['m.login.application_service'] });
  try {
    const as = await post('/_matrix/client/v3/login', { type: 'm.login.application_service', identifier: { type: 'm.id.user', user: 'bot' } });
    assert.equal(as.status, 200);
    assert.equal((await post('/_matrix/client/v3/login', { type: 'm.login.token', token: 'x' })).status, 403);
  } finally { await stop(); }
});
