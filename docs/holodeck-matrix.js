// holodeck-matrix.js — the one crossing: matrix-js-sdk behind the `mx` interface
// holodeck-share.js injects. Nothing else in the feature touches the SDK.
//
// The SDK is INJECTED (`sdk` = the module namespace), never imported here: in the
// page it is the same-origin bundle built by tools/vendor-matrix-sdk.mjs (never a
// CDN — the code that holds the keys is loaded from where the page is loaded
// from), in the live test it is a node_modules copy. Rust crypto, Megolm.
//
// What this file will not do: log a token or a key, write either to the DOM or to
// localStorage, or import eodb's client.js (it patches the global IDBFactory at
// import time and assumes a password-vault session).
//
// Facts about the installed SDK this was written against (matrix-js-sdk 41.5 /
// 42.4), checked in its source rather than assumed:
//   * client.invite() ALWAYS shares room history when the room's visibility is
//     `shared` — its `shareHistory`/`acceptSharedHistory` options are deprecated
//     no-ops. To invite WITHOUT history this adapter sends the raw invite request.
//   * history sharing (MSC4268) needs the inviter's device verified by its own
//     cross-signing identity and the invitee's device cross-signed.
//   * Device trust is per client (setDeviceVerified); room.setBlacklistUnverifiedDevices
//     is per client and per room.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MatrixGap extends Error {
  constructor(kind, why) { super(`${kind}: ${why}`); this.name = 'MatrixGap'; this.gap = true; this.kind = kind; this.why = why; }
}

const hostOf = (baseUrl) => { try { return new URL(baseUrl).host; } catch { return ''; } };

/**
 * Connect an existing session (userId, deviceId, accessToken from the page's own
 * sign-in) and return the mx crossing. `serverName` is the homeserver's name as it
 * appears in aliases and user ids (defaults to the base URL's host).
 */
export async function connect({
  sdk, baseUrl, userId, deviceId, accessToken,
  serverName = '', cryptoPrefix = '', memoryCrypto = false,
  readyMs = 20000, syncMs = 30000,
}) {
  if (!sdk || typeof sdk.createClient !== 'function') {
    throw new MatrixGap('sdk-missing', 'the Matrix library is not loaded, so no encrypted repo can be opened (build it with tools/vendor-matrix-sdk.mjs)');
  }
  const client = sdk.createClient({ baseUrl, userId, deviceId, accessToken });
  await client.initRustCrypto(memoryCrypto ? { useIndexedDB: false } : (cryptoPrefix ? { cryptoDatabasePrefix: cryptoPrefix } : {}));
  const crypto = client.getCrypto();
  if (!crypto) throw new MatrixGap('crypto-unavailable', 'the Matrix library started without its encryption layer');

  // initialSyncLimit 0 keeps the first sync small; history is paged on demand below.
  await client.startClient({ initialSyncLimit: 0 });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new MatrixGap('sync-timeout', 'the first sync with the homeserver did not finish')), syncMs);
    const on = (state) => { if (state === 'PREPARED' || state === 'SYNCING') { clearTimeout(t); client.off(sdk.ClientEvent.Sync, on); resolve(); } };
    client.on(sdk.ClientEvent.Sync, on);
  });

  async function until(fn, ms, what) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new MatrixGap('timeout', `timed out waiting for ${what}`);
      await sleep(150);
    }
  }
  const roomOf = (roomId) => client.getRoom(roomId);
  const stateEv = (room, type, key = '') => room && room.currentState.getStateEvents(type, key);
  const content = (ev) => (ev && (Array.isArray(ev) ? ev[0] : ev) ? (Array.isArray(ev) ? ev[0] : ev).getContent() : null);
  // An alias is #code:<server NAME>, and the name is the part of the user id after the colon — not
  // the URL's host (a homeserver reached at 127.0.0.1:18008 may be named `localhost`).
  const server = serverName || String(userId).split(':').slice(1).join(':') || hostOf(baseUrl);

  async function waitRoom(roomId) { return until(() => roomOf(roomId), syncMs, `room ${roomId} to sync`); }

  async function loadAll(room) {
    // page the whole timeline back: with history shared, earlier events are fetchable ciphertext
    const tl = room.getLiveTimeline();
    for (let i = 0; i < 200; i++) {
      const more = await client.paginateEventTimeline(tl, { backwards: true, limit: 100 }).catch(() => false);
      if (!more) break;
    }
  }

  const mx = {
    userId, deviceId, server, _client: client, _crypto: crypto,

    async createRoom(body) {
      const r = await client.createRoom(body);
      await waitRoom(r.room_id);
      return r.room_id;
    },

    // Read from the server, not from the local sync cache: a freshly created or joined room
    // exists locally before its state does, and "no m.room.encryption yet" must never be mistaken
    // for "not encrypted". The crypto layer's local confirmation is isEncryptionReady, below.
    async roomState(roomId) {
      const evs = await client.roomState(roomId);
      const one = (type) => { const e = evs.find((x) => x.type === type && (x.state_key === '' || x.state_key === undefined)); return e ? e.content : null; };
      const enc = one('m.room.encryption');
      const jr = one('m.room.join_rules');
      const hv = one('m.room.history_visibility');
      const create = evs.find((x) => x.type === 'm.room.create');
      const members = {};
      for (const e of evs) if (e.type === 'm.room.member' && e.content && e.content.membership) members[e.state_key] = e.content.membership;
      const nm = one('m.room.name');
      return {
        encryption: enc ? { algorithm: enc.algorithm } : null,
        joinRule: jr && jr.join_rule,
        historyVisibility: hv && hv.history_visibility,
        creator: create ? (create.sender || (create.content && create.content.creator) || null) : null,
        powerLevels: one('m.room.power_levels') || {},
        members,
        name: (nm && nm.name) || '',
      };
    },

    // The crypto layer's own answer, waited for (bounded) — a fresh room is briefly unconfirmed.
    async isEncryptionReady(roomId) {
      try {
        return await until(async () => { try { return await crypto.isEncryptionEnabledInRoom(roomId); } catch { return false; } }, readyMs, 'encryption to be confirmed');
      } catch { return false; }
    },

    async resolveAlias(alias) {
      try { return (await client.getRoomIdForAlias(alias)).room_id; }
      catch (e) { if (e && (e.errcode === 'M_NOT_FOUND' || e.httpStatus === 404)) return null; throw e; }
    },
    async aliasesOf(roomId) { return (await client.getLocalAliases(roomId)).aliases || []; },
    async deleteAlias(alias) { await client.deleteAlias(alias); },

    async join(roomId, opts = {}) {
      void opts;                 // acceptSharedHistory is a deprecated no-op in this SDK: a bundle is accepted if one was sent
      const room = await client.joinRoom(roomId);
      return room.roomId;
    },
    async leave(roomId) { await client.leave(roomId); },
    async invite(roomId, user, { shareHistory = false } = {}) {
      if (shareHistory) { await client.invite(roomId, user); return; }
      // client.invite() would share history whenever visibility is `shared`; a "no history" invite must not.
      await client.http.authedRequest('POST', `/rooms/${encodeURIComponent(roomId)}/invite`, undefined, { user_id: user });
    },
    async kick(roomId, user, reason) { await client.kick(roomId, user, reason); },
    async ban(roomId, user, reason) { await client.ban(roomId, user, reason); },
    async setPowerLevels(roomId, c) { await client.sendStateEvent(roomId, 'm.room.power_levels', c, ''); },

    async setState(roomId, type, key, c) { await client.sendStateEvent(roomId, type, c, key || ''); },
    async getState(roomId, type, key = '') {
      try { return await client.getStateEvent(roomId, type, key); }
      catch (e) { if (e && (e.errcode === 'M_NOT_FOUND' || e.httpStatus === 404)) return null; throw e; }
    },
    async stateTypes(roomId) {
      const evs = await client.roomState(roomId);
      return [...new Set(evs.map((e) => e.type))];
    },

    // The SDK encrypts on the wire when the room has m.room.encryption; the seal already refused otherwise.
    async sendEvent(roomId, type, c) {
      const r = await client.sendEvent(roomId, type, c);
      return r.event_id;
    },

    async readEvents(roomId) {
      const room = await waitRoom(roomId);
      await loadAll(room);
      const out = [];
      for (const ev of room.getLiveTimeline().getEvents()) {
        if (ev.isState()) continue;
        try { await client.decryptEventIfNeeded(ev); } catch { /* counted below as undecrypted */ }
        const failed = ev.isDecryptionFailure() || ev.getType() === 'm.room.encrypted';
        out.push({
          event_id: ev.getId(), type: failed ? 'm.room.encrypted' : ev.getType(),
          content: failed ? {} : ev.getContent(), sender: ev.getSender(), origin_server_ts: ev.getTs(),
          decrypted: !failed,
        });
      }
      return out;
    },

    async ownDeviceKeys() { const k = await crypto.getOwnDeviceKeys(); return { deviceId, ed25519: k.ed25519 }; },
    async deviceKeysOf(user) {
      const map = await crypto.getUserDeviceInfo([user], true);
      const out = [];
      for (const [id, d] of map.get(user) || []) {
        const st = await crypto.getDeviceVerificationStatus(user, id).catch(() => null);
        out.push({ deviceId: id, ed25519: d.getFingerprint(), verified: !!(st && (st.localVerified || st.crossSigningVerified)), crossSigned: !!(st && st.signedByOwner) });
      }
      return out;
    },
    async setDeviceVerified(user, id, verified = true) { await crypto.setDeviceVerified(user, id, verified); },
    async blacklistUnverified(roomId, v) { const room = await waitRoom(roomId); room.setBlacklistUnverifiedDevices(!!v); },
    async discardSession(roomId) { await crypto.forceDiscardSession(roomId); },

    // Typed capability, computed from what is actually there — never assumed.
    async capabilities() {
      const hasApi = typeof crypto.shareRoomHistoryWithUser === 'function';
      let cross = false;
      try { const st = await crypto.getDeviceVerificationStatus(userId, deviceId); cross = !!(st && st.crossSigningVerified); } catch { cross = false; }
      return { historySharing: hasApi, ownDeviceCrossSigned: cross };
    },

    // Straight from the server, every time. client.getAccountDataFromServer() answers from the LOCAL
    // store once the first sync is done, and that store can lag a write made moments (or a reload) ago —
    // a read-modify-write registry must never start from a stale or empty read.
    async getAccountData(type) {
      try {
        return await client.http.authedRequest('GET', `/user/${encodeURIComponent(userId)}/account_data/${encodeURIComponent(type)}`);
      } catch (e) {
        if (e && (e.errcode === 'M_NOT_FOUND' || e.httpStatus === 404 || (e.data && e.data.errcode === 'M_NOT_FOUND'))) return null;
        throw e;                                          // any other failure THROWS: never write back from a failed read
      }
    },
    async setAccountData(type, c) { await client.setAccountData(type, c); },

    async upload(bytes, { type = 'application/octet-stream', name = 'blob' } = {}) {
      const blob = new Blob([bytes], { type });
      const r = await client.uploadContent(blob, { type, name, includeFilename: false });
      return r.content_uri;
    },
    async download(mxc) {
      const url = client.mxcUrlToHttp(mxc, undefined, undefined, undefined, false, true, true);
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
      if (!res.ok) throw new MatrixGap('media-unreachable', 'HTTP ' + res.status);
      return new Uint8Array(await res.arrayBuffer());
    },

    /** Set up cross-signing for this account if it has none. Needed for "can read past". Typed gap if the server asks for a password. */
    async ensureCrossSigning() {
      try {
        if (await crypto.isCrossSigningReady()) return { ready: true };
        await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys: async (makeRequest) => { await makeRequest(null); } });
        return { ready: await crypto.isCrossSigningReady() };
      } catch (e) {
        return { ready: false, gap: { kind: 'cross-signing-needs-password', why: 'the homeserver asked for the account password to set up cross-signing, which this page does not hold: ' + String((e && e.message) || e) } };
      }
    },

    stop() { try { client.stopClient(); } catch { /* already stopped */ } },
  };
  return mx;
}

/** Sign in with a password and return the session fields connect() needs. The password is not kept. */
export async function passwordLogin({ sdk, baseUrl, user, password, displayName = 'Holodeck' }) {
  const tmp = sdk.createClient({ baseUrl });
  const r = await tmp.login('m.login.password', { identifier: { type: 'm.id.user', user }, password, initial_device_display_name: displayName });
  return { baseUrl, userId: r.user_id, deviceId: String(r.device_id), accessToken: r.access_token };
}

/** Loopback test servers speak http; everything else must be https. Typed refusal, not a silent upgrade. */
export function homeserverUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { error: 'name a homeserver' };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(raw) ? 'http://' + raw : 'https://' + raw);
  let u; try { u = new URL(withScheme); } catch { return { error: 'that is not a web address' }; }
  const loop = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
  if (u.protocol === 'http:' && !loop) return { error: 'a homeserver reached over plain http is refused unless it is on this computer' };
  return { baseUrl: u.origin };
}
