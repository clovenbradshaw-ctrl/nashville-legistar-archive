// gate.mjs — password AND authenticator code, at every sign-in, in front of a Matrix homeserver.
//
// Matrix has no TOTP of its own, so something has to verify it. This is that something: a small service that
// the homeserver's reverse proxy routes ONLY these paths to —
//     POST /_matrix/client/{v3,r0,unstable,api/v1}/login      the password sign-in: refused without the right six digits
//     POST /_matrix/client/{v3,r0,unstable,api/v1}/register   making an account: enrols an authenticator (see `registration`)
//     (any other method on those two paths, e.g. GET /login to learn the flows, is passed to the homeserver untouched)
//     POST /gate/v1/enroll/start              begin enrolling (returns the secret and its QR URI, once)
//     GET  /gate/v1/enrolled?user=            "is this account enrolled?" — for the workspace owner's device only
// — and everything else goes to the homeserver directly, untouched.
//
// What it is careful about:
//   * The code is checked BEFORE the password is forwarded. A wrong code never reaches the homeserver, so this
//     cannot be used to test passwords; a wrong-code attempt and a right-code-wrong-password attempt both end in
//     the same 403 and the same words.
//   * A code is single use: the time step it came from is recorded, and the same step (or an earlier one) is
//     refused — a captured code cannot be replayed inside its 30 seconds.
//   * Failures are counted per account and per address and lock further tries for a while. (The price: someone
//     can lock a person out for a few minutes by failing on purpose. That is the lesser harm.)
//   * Secrets are kept encrypted at rest (the store is injected; cli.mjs encrypts it) and are shown once, to the
//     person enrolling, over the connection that is enrolling them. The workspace owner never sees them.
//   * It logs counts and hash prefixes only: never a body, a password, a code, an address or a secret.
//   * It imports no filesystem module; reading config and the store is cli.mjs.
//
// What it does not do: it cannot stop someone who already holds a session token, it is not phishing-resistant
// (a fake page can relay a code in real time), and it sees passwords in transit exactly as the homeserver does —
// it must run on the same machine or private network as the homeserver, never anywhere less trusted.
import http from 'node:http';
import crypto from 'node:crypto';
import { totpCode, newTotpSecret, otpauthUri, safeEqualHex } from '../../holodeck-invite-core.js';

const STEP_MS = 30_000;
const MAX_BODY = 64 * 1024;
const MXID = /^@[a-z0-9._=\-/+]+:[a-z0-9.\-:]+$/;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
const GENERIC = 'Invalid username, password or code.';

class Refusal extends Error { constructor(status, errcode, msg, extra = {}) { super(msg); this.status = status; this.errcode = errcode; this.extra = extra; } }

/**
 * config: {
 *   upstream:       'http://127.0.0.1:8008'         the homeserver's client API (not public)
 *   serverName:     'matrix.example.org'            completes bare usernames to @name:server
 *   federationBase? 'http://127.0.0.1:8008'         where OpenID tokens are checked (defaults to upstream)
 *   admins:         ['@you:matrix.example.org']     who may ask whether an account is enrolled
 *   enforce:        'enrolled' | 'all'              'all' also refuses accounts that never enrolled…
 *   allowUnenrolled: ['@owner:…']                   …except these
 *   registration:   'enroll' | 'optional' | 'passthrough'
 *                   enroll      an account cannot be made without enrolling an authenticator (strict; breaks any client that
 *                               does not know about the gate)
 *                   optional    a request carrying a ticket and code enrols; one without is passed through unchanged, so an
 *                               existing sign-up page, a guest fallback or a bot keeps working (use this on a shared server)
 *                   passthrough nothing is enrolled at registration (operator CLI only)
 *   allowOtherLoginTypes: false                     true, or an array like ['m.login.application_service']. m.login.token and
 *                                                   the like would bypass the code, so they are refused unless named here
 *   issuer: 'Holodeck', trustProxy: false, limits: {…}
 * }
 * deps: { fetchImpl, now, store: { load(), save(obj) }, log(line) }
 */
export function createGate(config, deps = {}) {
  const cfg = {
    enforce: 'enrolled', allowUnenrolled: [], registration: 'enroll', allowOtherLoginTypes: false, issuer: 'Holodeck', trustProxy: false, admins: [],
    ...config,
    limits: { userFailures: 10, userWindowMs: 15 * 60_000, userLockMs: 5 * 60_000, ipFailures: 30, ipWindowMs: 15 * 60_000, enrollPerIp: 10, enrollWindowMs: 10 * 60_000, pendingTtlMs: 10 * 60_000, pendingMax: 2000, ...(config.limits || {}) },
  };
  if (!cfg.upstream) throw new Error('upstream is required');
  if (!cfg.serverName) throw new Error('serverName is required');
  const fetchImpl = deps.fetchImpl || ((...a) => globalThis.fetch(...a));
  const now = deps.now || Date.now;
  const log = deps.log || (() => {});
  const store = deps.store || { load: async () => null, save: async () => {} };

  let users = null;                                   // mxid -> { secret, lastStep, enrolledAt }
  const pending = new Map();                          // ticket -> { secret, account, exp, lastStep }
  const fails = new Map();                            // 'u:mxid' | 'i:ip' -> { times: [], lockedUntil }
  const enrollHits = new Map();                       // ip -> [ts]

  async function ready() { if (users) return; const s = await store.load(); users = new Map(Object.entries((s && s.users) || {})); }
  const persist = async () => { await store.save({ v: 1, users: Object.fromEntries(users) }); };

  // ---------------------------------------------------------------- codes
  const stepOf = (t) => Math.floor(t / STEP_MS);
  /** The step a presented code belongs to (current ±1), or null. Constant-time per candidate. */
  async function matchStep(secret, code) {
    const cur = stepOf(now());
    let hit = null;
    for (const s of [cur - 1, cur, cur + 1]) {
      if (safeEqualHex(await totpCode(secret, s * STEP_MS), code)) hit = s;
    }
    return hit;
  }

  // ---------------------------------------------------------------- failure accounting
  function locked(key) {
    const f = fails.get(key); const t = now();
    return !!(f && f.lockedUntil && f.lockedUntil > t) ? f.lockedUntil - t : 0;
  }
  function failed(key, cap, windowMs, lockMs) {
    const t = now();
    const f = fails.get(key) || { times: [], lockedUntil: 0 };
    f.times = f.times.filter((x) => t - x < windowMs); f.times.push(t);
    if (f.times.length >= cap) { f.lockedUntil = t + lockMs; f.times = []; }
    fails.set(key, f);
    if (fails.size > 20000) { for (const [k, v] of fails) { if (!v.lockedUntil || v.lockedUntil < t) fails.delete(k); if (fails.size < 10000) break; } }
  }
  const failUserAndIp = (mxid, ip) => { failed('u:' + mxid, cfg.limits.userFailures, cfg.limits.userWindowMs, cfg.limits.userLockMs); failed('i:' + ip, cfg.limits.ipFailures, cfg.limits.ipWindowMs, cfg.limits.userLockMs); };
  const checkLocks = (mxid, ip) => {
    const a = locked('i:' + ip), b = mxid ? locked('u:' + mxid) : 0;
    const ms = Math.max(a, b);
    if (ms) throw new Refusal(429, 'M_LIMIT_EXCEEDED', 'Too many tries. Wait a few minutes.', { retry_after_ms: ms });
  };

  // ---------------------------------------------------------------- helpers
  function mxidOf(body) {
    const id = body && body.identifier;
    let u = null;
    if (id && typeof id === 'object') { if (id.type !== 'm.id.user') return null; u = id.user; }
    else if (body && typeof body.user === 'string') u = body.user;
    if (typeof u !== 'string') return null;
    u = u.trim().toLowerCase();
    if (!u) return null;
    const full = u.startsWith('@') ? u : `@${u}:${cfg.serverName.toLowerCase()}`;
    return MXID.test(full) ? full : null;
  }
  // The homeserver rate-limits per client address; behind the gate every request would look like the gate's own. So the
  // real address travels in X-Forwarded-For (the homeserver's listener must have x_forwarded: true).
  async function upstream(method, path, body, ip = null) {
    let r;
    const headers = { 'content-type': 'application/json' };
    if (ip) { headers['x-forwarded-for'] = ip; headers['x-forwarded-proto'] = 'https'; }
    try { r = await fetchImpl(String(cfg.upstream).replace(/\/+$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Refusal(502, 'M_UNKNOWN', 'The homeserver could not be reached.'); }
    let j = {}; try { j = await r.json(); } catch { /* empty */ }
    return { status: r.status, body: j };
  }
  const ipOf = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim()) || req.socket.remoteAddress || '?';
  async function readJson(req) {
    const raw = await new Promise((resolve, reject) => {
      let n = 0, over = false; const chunks = [];
      req.on('data', (c) => { n += c.length; if (over) return; if (n > MAX_BODY) { over = true; chunks.length = 0; reject(new Refusal(413, 'M_TOO_LARGE', 'Too large.')); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
    try { const j = raw ? JSON.parse(raw) : {}; if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('shape'); return j; }
    catch { throw new Refusal(400, 'M_NOT_JSON', 'Send a JSON object.'); }
  }

  // ---------------------------------------------------------------- login
  async function login(body, ip) {
    await ready();
    if (body.type !== 'm.login.password') {
      const allowed = cfg.allowOtherLoginTypes === true || (Array.isArray(cfg.allowOtherLoginTypes) && cfg.allowOtherLoginTypes.includes(body.type));
      if (!allowed) throw new Refusal(403, 'M_FORBIDDEN', GENERIC);
      return upstream('POST', '/_matrix/client/v3/login', body, ip);
    }
    const mxid = mxidOf(body);
    if (!mxid) throw new Refusal(403, 'M_FORBIDDEN', GENERIC);
    checkLocks(mxid, ip);
    const rec = users.get(mxid);
    if (!rec) {
      if (cfg.enforce === 'all' && !cfg.allowUnenrolled.map((x) => x.toLowerCase()).includes(mxid)) { failUserAndIp(mxid, ip); throw new Refusal(403, 'M_FORBIDDEN', GENERIC); }
      return upstream('POST', '/_matrix/client/v3/login', body, ip);   // an account that never enrolled: password only, as before
    }
    // the code: its own field, or the last six digits of the password (so an ordinary Matrix app can sign in)
    let code = typeof body.totp === 'string' ? body.totp.trim() : '';
    let password = typeof body.password === 'string' ? body.password : '';
    if (!code) { const m = password.match(/^([\s\S]+?)(\d{6})$/); if (m) { password = m[1]; code = m[2]; } }
    const out = { ...body }; delete out.totp; out.password = password;
    if (!/^\d{6}$/.test(code) || !password) { failUserAndIp(mxid, ip); throw new Refusal(403, 'M_FORBIDDEN', GENERIC); }
    const step = await matchStep(rec.secret, code);
    if (step === null || step <= (rec.lastStep ?? -1)) { failUserAndIp(mxid, ip); log('login refused ' + sha(mxid)); throw new Refusal(403, 'M_FORBIDDEN', GENERIC); }
    rec.lastStep = step; await persist();                               // single use, whatever the password turns out to be
    const r = await upstream('POST', '/_matrix/client/v3/login', out, ip);
    if (r.status >= 400) { failUserAndIp(mxid, ip); log('login refused ' + sha(mxid)); return { status: 403, body: { errcode: 'M_FORBIDDEN', error: GENERIC } }; }
    log('login ok ' + sha(mxid));
    return r;
  }

  // ---------------------------------------------------------------- enrollment and registration
  function enrollStart(body, ip) {
    const t = now();
    const hits = (enrollHits.get(ip) || []).filter((x) => t - x < cfg.limits.enrollWindowMs);
    if (hits.length >= cfg.limits.enrollPerIp) throw new Refusal(429, 'M_LIMIT_EXCEEDED', 'Too many enrolments from here. Wait a few minutes.');
    hits.push(t); enrollHits.set(ip, hits);
    for (const [k, v] of pending) if (v.exp < t) pending.delete(k);
    if (pending.size >= cfg.limits.pendingMax) throw new Refusal(503, 'M_UNKNOWN', 'Busy. Try again shortly.');
    const ticket = crypto.randomBytes(18).toString('base64url');
    const secret = newTotpSecret();
    const account = String((body && body.account) || 'account').replace(/[^\p{L}\p{N} ._@-]/gu, '').slice(0, 40) || 'account';
    pending.set(ticket, { secret, exp: t + cfg.limits.pendingTtlMs, lastStep: -1 });
    return { ticket, secret, otpauth: otpauthUri({ secret, account, issuer: cfg.issuer }), expires_in: Math.floor(cfg.limits.pendingTtlMs / 1000) };
  }
  async function register(body, ip) {
    await ready();
    const wantsEnrol = body.totp && typeof body.totp === 'object';
    if (cfg.registration === 'passthrough' || (cfg.registration === 'optional' && !wantsEnrol)) {
      const { totp, ...rest } = body; void totp;
      return upstream('POST', '/_matrix/client/v3/register', rest, ip);
    }
    checkLocks(null, ip);
    const t = body.totp;
    const p = t && typeof t.ticket === 'string' ? pending.get(t.ticket) : null;
    const code = t && typeof t.code === 'string' ? t.code.trim() : '';
    if (!p || p.exp < now() || !/^\d{6}$/.test(code)) { failed('i:' + ip, cfg.limits.ipFailures, cfg.limits.ipWindowMs, cfg.limits.userLockMs); throw new Refusal(403, 'M_FORBIDDEN', 'Set up your authenticator app first, then type its six digits.'); }
    const step = await matchStep(p.secret, code);
    if (step === null || step <= p.lastStep) { failed('i:' + ip, cfg.limits.ipFailures, cfg.limits.ipWindowMs, cfg.limits.userLockMs); throw new Refusal(403, 'M_FORBIDDEN', 'That code was not right. Check the six digits your app shows.'); }
    const { totp, ...rest } = body; void totp;
    const r = await upstream('POST', '/_matrix/client/v3/register', rest, ip);
    if (r.status === 200 && r.body && typeof r.body.user_id === 'string') {
      users.set(r.body.user_id.toLowerCase(), { secret: p.secret, lastStep: step, enrolledAt: now() });
      pending.delete(t.ticket);
      await persist();
      log('enrolled ' + sha(r.body.user_id));
    } else if (r.status !== 401) {
      p.lastStep = step;                                                // a failed attempt still uses the code up
    }
    return r;
  }

  // ---------------------------------------------------------------- "is this account enrolled?" for the owner's device
  async function openIdSub(token) {
    if (typeof token !== 'string' || token.length < 8 || token.length > 512 || /[^\x21-\x7e]/.test(token)) return null;
    const base = String(cfg.federationBase || cfg.upstream).replace(/\/+$/, '');
    let r;
    try { r = await fetchImpl(base + '/_matrix/federation/v1/openid/userinfo?access_token=' + encodeURIComponent(token)); } catch { return null; }
    if (!r.ok) return null;
    let j = null; try { j = await r.json(); } catch { return null; }
    return j && typeof j.sub === 'string' ? j.sub.toLowerCase() : null;
  }
  async function enrolled(req, url) {
    await ready();
    const sub = await openIdSub(String(req.headers.authorization || '').replace(/^Bearer /i, ''));
    if (!sub || !cfg.admins.map((x) => x.toLowerCase()).includes(sub)) throw new Refusal(403, 'M_FORBIDDEN', 'Not allowed.');
    const who = String(url.searchParams.get('user') || '').toLowerCase();
    if (!MXID.test(who)) throw new Refusal(400, 'M_INVALID_PARAM', 'Give a user id.');
    return { enrolled: users.has(who) };
  }

  // ---------------------------------------------------------------- http
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600' };
  async function handle(req, res) {
    const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS }); res.end(JSON.stringify(obj)); };
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      const ip = ipOf(req);
      const LOGIN = /^\/_matrix\/client\/(api\/v1|r0|v3|unstable)\/login$/, REGISTER = /^\/_matrix\/client\/(api\/v1|r0|v3|unstable)\/register$/;
      if (LOGIN.test(p) || REGISTER.test(p)) {
        if (req.method !== 'POST') { const r = await upstream(req.method, p + url.search, undefined, ip); return send(r.status, r.body); }   // e.g. GET /login: the flows
        const r = LOGIN.test(p) ? await login(await readJson(req), ip) : await register(await readJson(req), ip);
        return send(r.status, r.body);
      }
      if (p === '/gate/v1/enroll/start' && req.method === 'POST') return send(200, enrollStart(await readJson(req), ip));
      if (p === '/gate/v1/enrolled' && req.method === 'GET') return send(200, await enrolled(req, url));
      return send(404, { errcode: 'M_UNRECOGNIZED', error: 'Not routed here.' });
    } catch (e) {
      if (e instanceof Refusal) { log('refused ' + e.status); res.writeHead(e.status, { 'content-type': 'application/json', ...CORS, ...(e.status === 413 ? { connection: 'close' } : {}) }); res.end(JSON.stringify({ errcode: e.errcode, error: e.message, ...e.extra })); if (e.status === 413) res.once('finish', () => req.destroy()); return; }
      log('error');
      res.writeHead(500, { 'content-type': 'application/json', ...CORS }); res.end(JSON.stringify({ errcode: 'M_UNKNOWN', error: 'Something went wrong.' }));
    }
  }
  const server = http.createServer((req, res) => { handle(req, res).catch(() => { try { res.writeHead(500); res.end(); } catch { /* gone */ } }); });

  // operator actions (cli.mjs): enrol an account that already exists (the owner's own), list, remove
  const operator = {
    async enroll(mxid) {
      await ready();
      const id = String(mxid).toLowerCase();
      if (!MXID.test(id)) throw new Error('not a user id');
      const secret = newTotpSecret();
      users.set(id, { secret, lastStep: -1, enrolledAt: now() });
      await persist();
      return { secret, otpauth: otpauthUri({ secret, account: id, issuer: cfg.issuer }) };
    },
    async remove(mxid) { await ready(); const had = users.delete(String(mxid).toLowerCase()); await persist(); return had; },
    async list() { await ready(); return [...users.entries()].map(([k, v]) => ({ user: k, enrolledAt: v.enrolledAt })); },
  };
  return { server, handle, operator, config: cfg, _users: () => users, _pending: pending };
}
