// holodeck-fake-matrix.js — a faithful fake homeserver and clients, for tests and the SIMULATED demo.
//
// "Faithful" means it keeps the properties the falsifiers measure, not that it is
// Matrix. What it models for real:
//   * the server stores only what a client hands it: state events in the clear
//     (as Matrix does), timeline events as `m.room.encrypted` ciphertext in an
//     encrypted room, plaintext in an unencrypted one — and `scan()` looks at
//     exactly that;
//   * the "encryption" is real AES-GCM (WebCrypto) under per-room outbound
//     sessions with a message index; a session key reaches only the devices the
//     sending client's policy allows (blacklist-unverified => verified only), and
//     a device that joins later gets keys from the CURRENT index, so it cannot
//     read what came before — the Megolm ratchet's actual consequence;
//   * a session is replaced when a device that held it is no longer a recipient;
//   * power levels, join rules, invites, bans and alias directory are enforced by
//     the server the way Synapse does (M_FORBIDDEN, M_ROOM_IN_USE);
//   * history sharing (MSC4268) delivers earlier sessions only if the inviter's
//     device and the invitee's device are both cross-signed — the same condition
//     the real SDK checks.
// What it does NOT model: Olm (to-device is an opaque side channel), federation,
// sync timing, key backup, devices of one user other than the ones registered.
// It proves the DECISIONS in holodeck-share.js, not Megolm. Only the live tier does that.

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

class MatrixError extends Error {
  constructor(errcode, message) { super(message || errcode); this.errcode = errcode; this.status = errcode === 'M_NOT_FOUND' ? 404 : 403; }
}

export function createFakeServer({ name = 'localhost', now = null } = {}) {
  let tick = 1_700_000_000_000, nextId = 1;
  const clock = now || (() => (tick += 10));
  const rooms = new Map();         // roomId -> { state: Map, timeline: [], members: Map, aliases: Set }
  const aliases = new Map();       // '#code:server' -> roomId
  const accounts = new Map();      // userId -> { devices: Map, accountData: Map }
  const media = new Map();
  const requestLog = [];
  const olm = [];                  // opaque to-device side channel: {to:'user|device', payload}
  const bundles = [];              // history key bundles: {to:user, room, keys:[...]}

  const sessionRooms = new Map();   // session_id -> roomId (so a bundle can be limited to one room)
  const openid = new Map();         // token -> { user, exp }  (what /openid/userinfo would answer)
  const server = { name, rooms, aliases, accounts, media, requestLog, now: clock, olm, bundles, sessionRooms, openid };
  /** What a third party learns by presenting an OpenID token to this homeserver: the user id, or null. */
  server.openidUserinfo = (token, at = null) => { const v = openid.get(String(token)); return v && (at == null || at <= v.exp) ? { sub: v.user } : null; };

  const log = (who, op, roomId, type, content) => requestLog.push({ who, op, roomId, type, content: clone(content) });
  const id = (p) => p + (nextId++).toString(36);

  function ensureAccount(userId) {
    if (!accounts.has(userId)) accounts.set(userId, { devices: new Map(), accountData: new Map() });
    return accounts.get(userId);
  }
  function stateOf(r, type, key = '') { const e = r.state.get(type + '|' + key); return e ? e.content : null; }
  function pl(r) { return stateOf(r, 'm.room.power_levels') || {}; }
  function powerOf(r, user) { const p = pl(r); return (p.users && p.users[user] != null) ? p.users[user] : (p.users_default ?? 0); }
  function need(r, user, level, what) { if (powerOf(r, user) < level) throw new MatrixError('M_FORBIDDEN', `${user} has power ${powerOf(r, user)}, needs ${level} to ${what}`); }
  function room(roomId) { const r = rooms.get(roomId); if (!r) throw new MatrixError('M_NOT_FOUND', 'unknown room ' + roomId); return r; }

  /** How many times `needle` occurs in everything the server holds — events, state, account data, media. */
  server.scan = (needle) => {
    const dump = server.storedJSON();
    return dump.split(String(needle)).length - 1;
  };
  server.storedJSON = () => JSON.stringify({
    rooms: [...rooms.entries()].map(([k, r]) => ({ k, state: [...r.state.entries()], timeline: r.timeline, members: [...r.members.entries()] })),
    aliases: [...aliases.entries()],
    accounts: [...accounts.entries()].map(([u, a]) => ({ u, devices: [...a.devices.entries()], data: [...a.accountData.entries()] })),
    media: [...media.entries()].map(([k, v]) => [k, Array.from(v, (c) => String.fromCharCode(c)).join('')]),   // as bytes, so a plaintext body would match
  });
  server.timeline = (roomId) => room(roomId).timeline.map(clone);
  server.typesIn = (roomId) => room(roomId).timeline.map((e) => e.type);

  server.client = (userId, { deviceId = null, crossSigned = false, historySharing = true, trustAll = false } = {}) => {
    const acct = ensureAccount(userId);
    const dev = deviceId || 'DEV' + userId.replace(/\W/g, '').slice(0, 6).toUpperCase() + (acct.devices.size + 1);
    const ed25519 = b64(rand(32)).replace(/=+$/, '');
    acct.devices.set(dev, { ed25519, crossSigned });
    const trust = new Set();                       // 'user|device' this client has verified
    const blacklist = new Map();                   // roomId -> bool
    const keys = new Map();                        // session_id -> { key:Uint8Array, fromIndex }
    const outbound = new Map();                    // roomId -> session
    const myLog = (op, roomId, type, content) => log(userId, op, roomId, type, content);

    async function aes(keyBytes) { return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']); }
    async function seal(keyBytes, obj) {
      const iv = rand(12); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(keyBytes), enc.encode(JSON.stringify(obj))));
      return b64(iv) + '.' + b64(ct);
    }
    async function open(keyBytes, s) {
      const [iv, ct] = s.split('.');
      return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aes(keyBytes), unb64(ct))));
    }
    function pullInbox() {
      for (let i = olm.length - 1; i >= 0; i--) {
        const m = olm[i];
        if (m.to === userId + '|' + dev) { keys.set(m.payload.session_id, { key: unb64(m.payload.key), fromIndex: m.payload.fromIndex }); olm.splice(i, 1); }
      }
    }
    const isTrusted = (u, d) => trustAll || trust.has(u + '|' + d) || (u === userId && d === dev);

    function recipients(r, roomId) {
      const out = [];
      for (const [u, m] of r.members) {
        if (m !== 'join') continue;
        for (const [d] of ensureAccount(u).devices) {
          if (u === userId && d === dev) continue;
          if (blacklist.get(roomId) && !isTrusted(u, d)) continue;
          out.push(u + '|' + d);
        }
      }
      return out.sort();
    }

    async function decryptTimeline(r) {
      pullInbox();
      const out = [];
      // The server enforces `history_visibility: joined` for plain rooms: a member sees only what was sent after they joined.
      // (Encrypted rooms get the same consequence from the key ratchet, modelled below.)
      const hv = (stateOf(r, 'm.room.history_visibility') || {}).history_visibility;
      const since = hv === 'joined' && r.joinedAt && r.joinedAt.has(userId) ? r.joinedAt.get(userId) : 0;
      for (const e of r.timeline) {
        if (e.type === 'm.room.member') continue;
        if (since && e.type !== 'm.room.encrypted' && !e.redacted && e.origin_server_ts < since) continue;
        if (e.redacted) { out.push({ event_id: e.event_id, type: 'm.room.encrypted', content: {}, sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: false }); continue; }
        if (e.type !== 'm.room.encrypted') { out.push({ event_id: e.event_id, type: e.type, content: clone(e.content), sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: true, plaintext: true }); continue; }
        const k = keys.get(e.content.session_id);
        if (!k || e.content.index < k.fromIndex) { out.push({ event_id: e.event_id, type: 'm.room.encrypted', content: {}, sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: false }); continue; }
        try { const p = await open(k.key, e.content.ciphertext); out.push({ event_id: e.event_id, type: p.type, content: p.content, sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: true }); }
        catch { out.push({ event_id: e.event_id, type: 'm.room.encrypted', content: {}, sender: e.sender, origin_server_ts: e.origin_server_ts, decrypted: false }); }
      }
      return out;
    }

    const mx = {
      userId, deviceId: dev, server: name,
      _isFake: true,

      async createRoom(body) {
        const roomId = '!' + id('r') + ':' + name;
        const r = { state: new Map(), timeline: [], members: new Map(), aliases: new Set(), joinedAt: new Map([[userId, 0]]) };
        const put = (type, key, content) => r.state.set(type + '|' + key, { content: clone(content), sender: userId, ts: clock() });
        if (body.room_alias_name) {
          const alias = `#${body.room_alias_name}:${name}`;
          if (aliases.has(alias)) throw new MatrixError('M_ROOM_IN_USE', 'Room alias already taken');
          aliases.set(alias, roomId); r.aliases.add(alias);
        }
        put('m.room.create', '', { creator: userId, room_version: '10' });
        r.members.set(userId, 'join');
        const base = { users: { [userId]: 100 }, users_default: 0, events_default: 0, state_default: 50, invite: 0, kick: 50, ban: 50 };
        put('m.room.power_levels', '', { ...base, ...(body.power_level_content_override || {}) });
        if (body.name) put('m.room.name', '', { name: body.name });
        for (const s of body.initial_state || []) put(s.type, s.state_key || '', s.content);
        rooms.set(roomId, r);
        myLog('createRoom', roomId, null, { name: body.name, initial_state: (body.initial_state || []).map((s) => ({ type: s.type, content: s.content })) });
        return roomId;
      },

      async roomState(roomId) {
        const r = room(roomId);
        const m = r.members.get(userId);
        const joinRule = stateOf(r, 'm.room.join_rules');
        if (m !== 'join' && m !== 'invite' && !(joinRule && joinRule.join_rule === 'public')) throw new MatrixError('M_FORBIDDEN', 'not in that room');
        const create = stateOf(r, 'm.room.create');
        const e = stateOf(r, 'm.room.encryption');
        return {
          encryption: e ? { algorithm: e.algorithm } : null,
          joinRule: joinRule && joinRule.join_rule,
          historyVisibility: (stateOf(r, 'm.room.history_visibility') || {}).history_visibility,
          creator: create && create.creator,
          powerLevels: clone(pl(r)),
          members: Object.fromEntries(r.members),
          name: (stateOf(r, 'm.room.name') || {}).name || '',
        };
      },
      async isEncryptionReady(roomId) { return !!stateOf(room(roomId), 'm.room.encryption'); },

      async resolveAlias(alias) { return aliases.get(alias) || null; },
      async aliasesOf(roomId) { return [...room(roomId).aliases]; },
      async deleteAlias(alias) {
        const roomId = aliases.get(alias); if (!roomId) throw new MatrixError('M_NOT_FOUND', 'no such alias');
        need(room(roomId), userId, 50, 'remove an alias');
        aliases.delete(alias); room(roomId).aliases.delete(alias); myLog('deleteAlias', roomId, null, { alias });
      },

      async join(roomId, opts = {}) {
        const r = room(roomId);
        const m = r.members.get(userId);
        if (m === 'ban') throw new MatrixError('M_FORBIDDEN', 'you are banned from this room');
        const jr = (stateOf(r, 'm.room.join_rules') || {}).join_rule;
        if (m !== 'invite' && jr !== 'public') throw new MatrixError('M_FORBIDDEN', 'you are not invited to this room');
        r.members.set(userId, 'join');
        const joinTs = clock();
        r.joinedAt.set(userId, joinTs);
        r.timeline.push({ event_id: '$' + id('m'), type: 'm.room.member', sender: userId, state_key: userId, content: { membership: 'join' }, origin_server_ts: joinTs });
        myLog('join', roomId, null, { acceptSharedHistory: !!opts.acceptSharedHistory });
        if (opts.acceptSharedHistory) {
          for (let i = bundles.length - 1; i >= 0; i--) {
            const b = bundles[i];
            if (b.to === userId && b.room === roomId && b.device === dev) { for (const k of b.keys) keys.set(k.session_id, { key: unb64(k.key), fromIndex: 0 }); bundles.splice(i, 1); }
          }
        }
        return roomId;
      },
      async leave(roomId) { const r = room(roomId); r.members.set(userId, 'leave'); myLog('leave', roomId, null, {}); },
      async invite(roomId, user, opts = {}) {
        const r = room(roomId);
        need(r, userId, pl(r).invite ?? 0, 'invite');
        if (r.members.get(user) === 'ban') throw new MatrixError('M_FORBIDDEN', 'that user is banned');
        r.members.set(user, 'invite');
        myLog('invite', roomId, null, { user, shareHistory: !!opts.shareHistory });
        if (opts.shareHistory) {
          pullInbox();
          const inv = [...ensureAccount(user).devices.entries()].filter(([, d]) => d.crossSigned);
          const mine = acct.devices.get(dev);
          if (mine && mine.crossSigned && historySharing) {
            const ks = [...keys.entries()].filter(([sid]) => sessionRooms.get(sid) === roomId).map(([sid, k]) => ({ session_id: sid, key: b64(k.key) }));
            for (const [d] of inv) bundles.push({ to: user, device: d, room: roomId, keys: ks });
          }
        }
      },
      async kick(roomId, user, reason) {
        const r = room(roomId); need(r, userId, pl(r).kick ?? 50, 'kick');
        r.members.set(user, 'leave'); myLog('kick', roomId, null, { user, reason });
      },
      async ban(roomId, user, reason) {
        const r = room(roomId); need(r, userId, pl(r).ban ?? 50, 'ban');
        r.members.set(user, 'ban'); myLog('ban', roomId, null, { user, reason });
      },
      async setPowerLevels(roomId, content) {
        const r = room(roomId); need(r, userId, (pl(r).events || {})['m.room.power_levels'] ?? pl(r).state_default ?? 50, 'change power levels');
        r.state.set('m.room.power_levels|', { content: clone(content), sender: userId, ts: clock() }); myLog('setPowerLevels', roomId, 'm.room.power_levels', content);
      },

      async setState(roomId, type, key, content) {
        const r = room(roomId);
        if (r.members.get(userId) !== 'join') throw new MatrixError('M_FORBIDDEN', 'not in that room');
        need(r, userId, (pl(r).events || {})[type] ?? pl(r).state_default ?? 50, 'set ' + type);
        r.state.set(type + '|' + (key || ''), { content: clone(content), sender: userId, ts: clock() });
        myLog('setState', roomId, type, content);   // state is plaintext on the wire — that is Matrix
      },
      async getState(roomId, type, key = '') { return clone(stateOf(room(roomId), type, key)); },
      async stateTypes(roomId) { return [...room(roomId).state.keys()].map((k) => k.split('|')[0]); },

      async sendEvent(roomId, type, content) {
        const r = room(roomId);
        if (r.members.get(userId) !== 'join') throw new MatrixError('M_FORBIDDEN', 'not in that room');
        need(r, userId, (pl(r).events || {})[type] ?? pl(r).events_default ?? 0, 'send ' + type);
        const eid = '$' + id('e');
        const encState = stateOf(r, 'm.room.encryption');
        let wire;
        if (encState) {
          pullInbox();
          const rcpt = recipients(r, roomId);
          let s = outbound.get(roomId);
          if (s && (s.discarded || [...s.shared].some((x) => !rcpt.includes(x)))) s = null;   // someone left or was withdrawn: new session
          if (!s) {
            const sid = id('s'); const key = rand(32);
            s = { id: sid, key, index: 0, shared: new Set() };
            outbound.set(roomId, s); keys.set(sid, { key, fromIndex: 0 }); sessionRooms.set(sid, roomId);
          }
          for (const t of rcpt) if (!s.shared.has(t)) { s.shared.add(t); olm.push({ to: t, payload: { session_id: s.id, key: b64(s.key), fromIndex: s.index } }); }
          const index = s.index++;
          wire = { type: 'm.room.encrypted', content: { algorithm: encState.algorithm, session_id: s.id, sender_key: dev, index, ciphertext: await seal(s.key, { type, content, room_id: roomId }) } };
        } else {
          wire = { type, content: clone(content) };
        }
        r.timeline.push({ event_id: eid, sender: userId, origin_server_ts: clock(), ...wire });
        myLog('sendEvent', roomId, wire.type, wire.content);
        return eid;
      },

      async readEvents(roomId, opts = {}) {
        const r = room(roomId);
        if (r.members.get(userId) !== 'join') throw new MatrixError('M_FORBIDDEN', 'not in that room');
        let evs = await decryptTimeline(r);
        if (opts.type) evs = evs.filter((e) => e.type === opts.type || (e.decrypted === false));
        if (opts.limit && evs.length > opts.limit) evs = evs.slice(-opts.limit);
        return evs;
      },
      // Matrix: anyone may redact their OWN event; redacting someone else's needs the room's `redact` level.
      // A redacted event stays in the timeline with its content stripped (so it can no longer be read), and the
      // redaction is itself an event.
      async redactEvent(roomId, eventId) {
        const r = room(roomId);
        if (r.members.get(userId) !== 'join') throw new MatrixError('M_FORBIDDEN', 'not in that room');
        const target = r.timeline.find((e) => e.event_id === eventId);
        if (!target) throw new MatrixError('M_NOT_FOUND', 'no such event');
        if (target.sender !== userId) need(r, userId, pl(r).redact ?? 50, 'redact someone else’s event');
        target.redacted = true;
        if (target.content) target.content = {};
        r.timeline.push({ event_id: '$' + id('x'), type: 'm.room.redaction', sender: userId, redacts: eventId, content: { redacts: eventId }, origin_server_ts: clock() });
        myLog('redact', roomId, 'm.room.redaction', { redacts: eventId });
      },
      async getOpenIdToken() {
        const token = 'oidc-' + id('t') + '-' + b64(rand(9)).replace(/[^A-Za-z0-9]/g, '');
        openid.set(token, { user: userId, exp: clock() + 3600_000 });
        return { access_token: token, token_type: 'Bearer', matrix_server_name: name, expires_in: 3600 };
      },
      // test-only: hand this device the raw ciphertext regardless of membership (what could it decrypt?)
      async _decryptAll(roomId) { return decryptTimeline(room(roomId)); },
      async ownDeviceKeys() { return { deviceId: dev, ed25519 }; },
      async deviceKeysOf(user) {
        return [...ensureAccount(user).devices.entries()].map(([d, v]) => ({ deviceId: d, ed25519: v.ed25519, crossSigned: v.crossSigned, verified: isTrusted(user, d) }));
      },
      async setDeviceVerified(user, d, verified = true) { if (verified) trust.add(user + '|' + d); else trust.delete(user + '|' + d); myLog('localTrust', null, null, { user, device: d, verified }); },
      async blacklistUnverified(roomId, v) { blacklist.set(roomId, !!v); },
      async discardSession(roomId) { const s = outbound.get(roomId); if (s) s.discarded = true; },
      async capabilities() { return { historySharing, ownDeviceCrossSigned: crossSigned }; },

      async getAccountData(type) { const v = acct.accountData.get(type); return v === undefined ? null : clone(v); },
      async setAccountData(type, content) { acct.accountData.set(type, clone(content)); myLog('setAccountData', null, type, content); },

      async upload(bytes, opts = {}) {
        const mxc = `mxc://${name}/${id('m')}`; media.set(mxc, new Uint8Array(bytes)); myLog('upload', null, 'media', { size: bytes.length, type: opts.type }); return mxc;
      },
      async download(mxc) { const b = media.get(mxc); if (!b) throw new MatrixError('M_NOT_FOUND', 'no media'); return new Uint8Array(b); },

      // test-only: what this client's own crypto holds, for "what can this device read"
      _holds: () => [...keys.keys()],
      _asRaw: () => mx,
    };
    return mx;
  };

  return server;
}

/** Attachment envelope for tests: the same shape eodb's encryptAttachment returns, via WebCrypto AES-CTR. */
export const fakeAttach = {
  async encrypt(plain) {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const iv = new Uint8Array(16); crypto.getRandomValues(iv.subarray(0, 8));
    const k = await crypto.subtle.importKey('raw', key, 'AES-CTR', false, ['encrypt']);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter: iv, length: 64 }, k, plain));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return { data, info: { v: 'v2', key: { kty: 'oct', alg: 'A256CTR', ext: true, k: b64(key), key_ops: ['encrypt', 'decrypt'] }, iv: b64(iv), hashes: { sha256: b64(digest) } } };
  },
  async decrypt(data, info) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    if (b64(digest) !== info.hashes.sha256) throw new Error('Hash mismatch — corrupt or tampered attachment');
    const k = await crypto.subtle.importKey('raw', unb64(info.key.k), 'AES-CTR', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CTR', counter: unb64(info.iv), length: 64 }, k, data));
  },
};
