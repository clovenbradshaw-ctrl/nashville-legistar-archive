// holodeck-rest-matrix.js — the `mx` crossing for holodeck-invites.js, over plain Matrix REST.
//
// No SDK, no crypto library, no IndexedDB of its own: the workspace rooms are ordinary Matrix rooms (that is how the
// Holodeck stores its data today, beside OPFS), so a fetch and the page's existing session are all that is needed.
//
// The session is the page's own (fold-net.js: { base, token, user }). This module never stores it, logs it or puts it
// in a URL; the access token goes only in an Authorization header, and only to the homeserver base it came with.
const enc = encodeURIComponent;

export class RestGap extends Error {
  constructor(kind, why, status = 0, errcode = '') { super(`${kind}: ${why}`); this.name = 'RestGap'; this.gap = true; this.kind = kind; this.why = why; this.status = status; this.errcode = errcode; }
}

export function restMatrix({ base, token, user, fetchImpl = (...a) => globalThis.fetch(...a), maxEvents = 600 }) {
  if (!base || !token || !user) throw new RestGap('no-session', 'sign in to Matrix first');
  const root = String(base).replace(/\/+$/, '') + '/_matrix/client/v3';
  const server = String(user).split(':').slice(1).join(':');
  let txn = 0;
  const nextTxn = () => 'hd' + Date.now().toString(36) + (txn++).toString(36) + Math.random().toString(36).slice(2, 6);

  async function call(method, path, body, { allow = [] } = {}) {
    let r;
    try {
      r = await fetchImpl(root + path, { method, headers: { authorization: 'Bearer ' + token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { throw new RestGap('unreachable', 'the homeserver could not be reached'); }
    let j = {}; try { j = await r.json(); } catch { /* an empty body */ }
    if (!r.ok && !allow.includes(r.status)) throw new RestGap('matrix-' + r.status, String(j.error || j.errcode || 'HTTP ' + r.status), r.status, j.errcode || '');
    return { status: r.status, ok: r.ok, j };
  }
  const notFound = (e) => e && (e.status === 404 || e.errcode === 'M_NOT_FOUND');

  const mx = {
    userId: user, server,

    async createRoom(body) { return (await call('POST', '/createRoom', body)).j.room_id; },

    async roomState(roomId) {
      const evs = (await call('GET', `/rooms/${enc(roomId)}/state`)).j;
      const one = (type) => { const e = evs.find((x) => x.type === type && (x.state_key === '' || x.state_key === undefined)); return e ? e.content : null; };
      const members = {};
      for (const e of evs) if (e.type === 'm.room.member' && e.content && e.content.membership) members[e.state_key] = e.content.membership;
      const create = evs.find((x) => x.type === 'm.room.create');
      const jr = one('m.room.join_rules'), hv = one('m.room.history_visibility'), enc0 = one('m.room.encryption'), nm = one('m.room.name');
      return {
        encryption: enc0 ? { algorithm: enc0.algorithm } : null,
        joinRule: jr && jr.join_rule, historyVisibility: hv && hv.history_visibility,
        creator: create ? create.sender : null,
        powerLevels: one('m.room.power_levels') || {}, members, name: (nm && nm.name) || '',
      };
    },

    async resolveAlias(alias) {
      try { return (await call('GET', `/directory/room/${enc(alias)}`)).j.room_id || null; }
      catch (e) { if (notFound(e)) return null; throw e; }
    },
    async aliasesOf(roomId) { try { return (await call('GET', `/rooms/${enc(roomId)}/aliases`)).j.aliases || []; } catch { return []; } },
    async deleteAlias(alias) { await call('DELETE', `/directory/room/${enc(alias)}`); },

    async join(roomId) { return (await call('POST', `/join/${enc(roomId)}`, {})).j.room_id; },
    async leave(roomId) { await call('POST', `/rooms/${enc(roomId)}/leave`, {}); try { await call('POST', `/rooms/${enc(roomId)}/forget`, {}, { allow: [400, 403, 404] }); } catch { /* forgetting is tidiness */ } },
    async invite(roomId, who) { await call('POST', `/rooms/${enc(roomId)}/invite`, { user_id: who }); },
    async kick(roomId, who, reason = '') { await call('POST', `/rooms/${enc(roomId)}/kick`, { user_id: who, reason }); },
    async ban(roomId, who, reason = '') { await call('POST', `/rooms/${enc(roomId)}/ban`, { user_id: who, reason }); },

    async getState(roomId, type, key = '') {
      try { return (await call('GET', `/rooms/${enc(roomId)}/state/${enc(type)}/${enc(key)}`)).j; }
      catch (e) { if (notFound(e)) return null; throw e; }
    },
    async setState(roomId, type, key, content) { await call('PUT', `/rooms/${enc(roomId)}/state/${enc(type)}/${enc(key || '')}`, content); },

    async sendEvent(roomId, type, content) { return (await call('PUT', `/rooms/${enc(roomId)}/send/${enc(type)}/${enc(nextTxn())}`, content)).j.event_id; },
    async redactEvent(roomId, eventId) { await call('PUT', `/rooms/${enc(roomId)}/redact/${enc(eventId)}/${enc(nextTxn())}`, {}); },

    /**
     * The room's non-state events, oldest first. State events (joins, kicks, the status marker) are NOT returned: an
     * invitee's join must never be counted as a guess. A redacted event keeps its place with its content stripped
     * and `decrypted: false`, so it still counts as something a non-owner put in the door.
     */
    async readEvents(roomId, { type = null, limit = 0 } = {}) {
      const cap = limit || maxEvents;
      const out = [];
      let from = '';
      for (let page = 0; page < 20 && out.length < cap; page++) {
        const q = `?dir=b&limit=${Math.min(100, cap)}` + (from ? '&from=' + enc(from) : '') + (type ? '&filter=' + enc(JSON.stringify({ types: [type] })) : '');
        const j = (await call('GET', `/rooms/${enc(roomId)}/messages${q}`)).j;
        for (const e of j.chunk || []) {
          if (e.state_key !== undefined) continue;
          if (type && e.type !== type && !(e.unsigned && e.unsigned.redacted_because)) continue;
          const redacted = !!(e.unsigned && e.unsigned.redacted_because);
          out.push({ event_id: e.event_id, type: e.type, content: redacted ? {} : (e.content || {}), sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: !redacted });
        }
        if (!j.end || !(j.chunk || []).length) break;
        from = j.end;
      }
      return out.slice(0, cap).reverse();
    },

    /** A short-lived token the mailer can check with the homeserver: proves who is asking, lets nobody act as them. */
    async getOpenIdToken() { return (await call('POST', `/user/${enc(user)}/openid/request_token`, {})).j; },
  };
  return mx;
}

// ------------------------------------------------------------------ the gate (tools/login-gate)
// A homeserver fronted by the gate asks for the six digits of an authenticator app at every sign-in, and makes a
// person enrol one when they create their account. These helpers speak to it; they hold no secret beyond the call.

/** Where to talk to a homeserver named in a link: https unless it is on this computer, honouring .well-known delegation. */
export async function baseFor(serverName, fetchImpl = (...a) => globalThis.fetch(...a)) {
  const host = String(serverName || '').trim();
  if (!/^[A-Za-z0-9.\-]{1,100}(:\d{1,5})?$/.test(host)) throw new RestGap('homeserver', 'this invitation does not name a homeserver');
  const loop = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  let base = (loop ? 'http://' : 'https://') + host;
  try {
    const r = await fetchImpl(base + '/.well-known/matrix/client');
    if (r.ok) { const j = await r.json(); const b = j && j['m.homeserver'] && j['m.homeserver'].base_url; if (typeof b === 'string' && /^https:\/\//.test(b)) base = b.replace(/\/+$/, ''); }
  } catch { /* no delegation */ }
  return { host, base };
}

async function postJson(fetchImpl, url, body) {
  let r;
  try { r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new RestGap('unreachable', 'the homeserver could not be reached'); }
  let j = {}; try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, ok: r.ok, j };
}

/** Begin enrolling an authenticator: returns { ticket, secret, otpauth } — shown once, to the person enrolling. */
export async function enrollStart({ base, account = '', fetchImpl = (...a) => globalThis.fetch(...a) }) {
  const r = await postJson(fetchImpl, String(base).replace(/\/+$/, '') + '/gate/v1/enroll/start', { account });
  if (!r.ok) throw new RestGap('gate-' + r.status, String(r.j.error || 'could not start setting up the authenticator'), r.status, r.j.errcode || '');
  return r.j;
}

/**
 * Create an account through the gate: the person's own sign-in name and password, and the six digits their new
 * authenticator shows. The password is sent once, to the homeserver (via the gate), and never kept.
 */
export async function signUp({ host, base, username, password, ticket, code, fetchImpl = (...a) => globalThis.fetch(...a), displayName = 'Holodeck' }) {
  const url = String(base).replace(/\/+$/, '') + '/_matrix/client/v3/register';
  const body = { username: String(username).trim().toLowerCase(), password, initial_device_display_name: displayName, auth: { type: 'm.login.dummy' }, totp: { ticket, code } };
  let r = await postJson(fetchImpl, url, body);
  if (r.status === 401 && r.j.session && (r.j.flows || []).some((f) => (f.stages || []).length === 1 && f.stages[0] === 'm.login.dummy')) r = await postJson(fetchImpl, url, { ...body, auth: { type: 'm.login.dummy', session: r.j.session } });
  if (!r.ok || !r.j.access_token) {
    const why = String(r.j.error || r.j.errcode || r.status);
    const kind = r.j.errcode === 'M_USER_IN_USE' ? 'name-taken' : r.status === 403 ? 'code-refused' : 'registration-refused';
    throw new RestGap(kind, kind === 'name-taken' ? 'that sign-in name is taken — choose another' : kind === 'code-refused' ? why : 'this homeserver would not make the account (' + why + ')', r.status, r.j.errcode || '');
  }
  return { host, base: String(base).replace(/\/+$/, ''), token: r.j.access_token, user: r.j.user_id, guest: false };
}

/** Sign in with password AND the six digits. The same words come back whichever one was wrong. */
export async function signIn({ host, base, user, password, code, fetchImpl = (...a) => globalThis.fetch(...a), displayName = 'Holodeck' }) {
  const r = await postJson(fetchImpl, String(base).replace(/\/+$/, '') + '/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user }, password, totp: code, initial_device_display_name: displayName });
  if (!r.ok || !r.j.access_token) throw new RestGap(r.status === 429 ? 'locked' : 'refused', r.status === 429 ? 'too many tries — wait a few minutes' : 'wrong sign-in name, password or code', r.status, r.j.errcode || '');
  return { host, base: String(base).replace(/\/+$/, ''), token: r.j.access_token, user: r.j.user_id, guest: false };
}

/**
 * The owner's device asking the gate whether an account enrolled an authenticator. Authenticated with an OpenID token
 * (which proves who is asking and lets nobody act as them), never the access token.
 */
export function gateCrossing({ base, openid, fetchImpl = (...a) => globalThis.fetch(...a) }) {
  const root = String(base || '').replace(/\/+$/, '');
  return {
    configured: !!root,
    async enrolled(user) {
      const tok = await openid();
      const r = await fetchImpl(root + '/gate/v1/enrolled?user=' + encodeURIComponent(user), { headers: { authorization: 'Bearer ' + (tok && tok.access_token) } });
      if (!r.ok) throw new RestGap('gate-' + r.status, 'the gate would not say');
      const j = await r.json();
      return j.enrolled === true;
    },
  };
}
