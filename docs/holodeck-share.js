// holodeck-share.js — invite people to an encrypted repo (a Holodeck workspace).
//
// PURE, in the cast.js / holodeck-heimdall.js pattern: every crossing is the
// injected `mx`. A link is built, never fetched; the page is a thin client.
//
// What a repo is here: three encrypted Matrix rooms (stores) — sources, records,
// log — plus per-invite *doors*. Membership is the access model; roles map onto
// power levels; the fold enforces them again (holodeck-roles.js). The short alias
// code resolves to a DOOR, not to a data room: a door holds only the handshake.
//
// The `mx` crossing (adapters: holodeck-matrix.js over matrix-js-sdk,
// holodeck-fake-matrix.js for tests and the simulated demo):
//   userId, deviceId, server                      who is acting, and the server name
//   createRoom(body) -> roomId                    raw Matrix createRoom body
//   roomState(roomId) -> { encryption:{algorithm}|null, joinRule, historyVisibility,
//                          creator, powerLevels, members:{user:membership}, name }
//   isEncryptionReady(roomId) -> bool             the crypto layer's own answer
//   resolveAlias(alias) -> roomId|null  deleteAlias(alias)  aliasesOf(roomId)->[alias]
//   join(roomId,{acceptSharedHistory})  leave(roomId)  invite(roomId,user,{shareHistory})
//   kick(roomId,user,reason)  ban(roomId,user,reason)  setPowerLevels(roomId,content)
//   sendEvent(roomId,type,content) -> eventId     (the SDK encrypts on the wire)
//   setState(roomId,type,key,content)
//   readEvents(roomId) -> [{event_id,type,content,sender,origin_server_ts,decrypted}]
//   ownDeviceKeys() -> {deviceId,ed25519}   deviceKeysOf(user) -> [{deviceId,ed25519,verified,crossSigned}]
//   setDeviceVerified(user,deviceId,verified=true)  blacklistUnverified(roomId,bool)  discardSession(roomId)
//   capabilities() -> {historySharing:bool, ownDeviceCrossSigned:bool}
//   getAccountData(type)  setAccountData(type,content)   (a failed read THROWS)
//   upload(bytes,{type,name}) -> mxc              (only reachable through sealAttachment)

import { shortCode, SHORT_ALPHABET, INVITE_TTL_MS, sha256Hex } from './holodeck-heimdall.js';
import { MEGOLM, REPO_MARKER, SealRefusal, REFUSAL, sealTransport, assertEncrypted, sealAttachment } from './holodeck-seal.js';
import { ROLE, POWER, LEDGER, WRITE_OPS, powerLevelsFor, foldRepoAsync, ledgerFromEvents, roleAt, trustedDevices } from './holodeck-roles.js';

export { INVITE_TTL_MS, SHORT_ALPHABET };
export const NS = 'io.holodeck';
export const EVT = Object.freeze({
  request: 'io.holodeck.share.request',
  grant: 'io.holodeck.share.grant',
  manifest: 'io.holodeck.share.manifest',
  epoch: 'io.holodeck.share.epoch',
  note: 'io.holodeck.share.note',
  role: LEDGER.role,
  revoke: LEDGER.revoke,
  device: LEDGER.device,
});
export const DOOR_MARKER = 'io.holodeck.repo.door';
export const BATCH = 'io.holodeck.batch';
// A Matrix event is capped at 64 KiB on the wire; this is eodb's own working size for content
// after large fields are hoisted into encrypted attachments (media.js CONTENT_SIZE_LIMIT).
export const CONTENT_LIMIT = 24 * 1024;
export const HOIST_LIMIT = 16 * 1024;
export const REGISTRY = Object.freeze({ invites: 'io.holodeck.invites', repos: 'io.holodeck.repos' });
export const STORES = Object.freeze(['sources', 'records', 'log']);

// The mapping from what the Holodeck reads (holodeck-records.js entity types) to
// the store that holds it. Data, not code: change the split without touching the invite flow.
export const STORE_OF = Object.freeze({
  Sources: 'sources',
  Names: 'records', Statements: 'records', Figures: 'records', Dates: 'records',
  Referents: 'records', Bonds: 'records', FilterFrames: 'records',
  _default: 'records',
});
export const storeFor = (entityType) => STORE_OF[entityType] || STORE_OF._default;

export const WORDS = Object.freeze({
  server_sees: 'The server cannot read what is in this repo. It can still see that the rooms exist, their ids, who is a member and when they joined or left, when each item was sent and how large it was, and the short invite code while an invite is open.',
  removal: 'Removing someone stops them receiving anything written from now on. It cannot take back what their device already holds: everything they could read before they were removed, they can still read — and the server keeps the old items.',
  leave: 'Leaving stops you receiving new items. This browser keeps the keys to what you could already read; clear this site’s data to remove them here. Anything you wrote stays in the repo.',
  unverified: 'Keys are shared only to devices the owner has confirmed by fingerprint, and every member applies the owner\u2019s confirmations. A new device of a member receives nothing until the owner confirms it. Another Matrix app in these rooms follows its own setting.',
  invite_code: 'The invite code only lets someone ask. Nothing is shared until the owner types the six digits the person reads out and confirms their device.',
});

// ---------------------------------------------------------------- pure builders

/** The 6-digit pairing code: heimdall's codeFromPublicKey, applied to the Matrix DEVICE key. */
export async function pairingCode(ed25519) {
  const h = await sha256Hex(String(ed25519 || ''));
  return String(100000 + (parseInt(h.slice(0, 6), 16) % 900000));
}

/** The full fingerprint, in groups of four, for the confirm screen. */
export function fingerprintGroups(ed25519) {
  return String(ed25519 || '').replace(/[^A-Za-z0-9]/g, '').match(/.{1,4}/g) || [];
}

/** The invite link is the page plus a fragment holding the alias code — nothing else. */
export function inviteLink({ base, code }) {
  if (!base) return '';
  if (!validCode(code)) throw new SealRefusal('bad-invite-code', 'an invite code is five characters from the no-confusion alphabet');
  return String(base).replace(/[#?].*$/, '') + '#join=' + code;
}
export const validCode = (c) => typeof c === 'string' && c.length === 5 && [...c].every((ch) => SHORT_ALPHABET.includes(ch));

/** Read the code back out of a link, a fragment, or a typed code. Anything else is null. */
export function parseInvite(input) {
  const s = String(input == null ? '' : input).trim().toLowerCase();
  const m = s.match(/join=([a-z0-9]{5})(?:$|[&#\s])/);
  const code = m ? m[1] : s.replace(/^#/, '');
  return validCode(code) ? code : null;
}

const marker = (repo, store, epoch) => ({ type: REPO_MARKER, state_key: '', content: { v: 1, repo, store, epoch } });

/** createRoom body for a store: encrypted at creation, invite-only, owner-only rules. */
export function storeRoomBody({ repoId, store, owner, epoch = 1 }) {
  return {
    name: `holodeck-${repoId}-${store}`,
    preset: 'private_chat',
    visibility: 'private',
    initial_state: [
      { type: 'm.room.encryption', state_key: '', content: { algorithm: MEGOLM } },
      { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'invite' } },
      { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'shared' } },
      { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
      marker(repoId, store, epoch),
    ],
    power_level_content_override: powerLevelsFor({ owner }),
  };
}

/** createRoom body for a door: encrypted, joinable by alias, members cannot invite anyone or change rules. */
export function doorRoomBody({ code, owner }) {
  const pl = powerLevelsFor({ owner });
  pl.events_default = 0;      // a joiner must be able to send its request
  return {
    name: 'holodeck-door',
    preset: 'public_chat',
    visibility: 'private',
    room_alias_name: code,
    initial_state: [
      { type: 'm.room.encryption', state_key: '', content: { algorithm: MEGOLM } },
      { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } },
      { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'joined' } },
      { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
      { type: DOOR_MARKER, state_key: '', content: { v: 1 } },
    ],
    power_level_content_override: pl,
  };
}

const aliasTaken = (e) => e && (e.errcode === 'M_ROOM_IN_USE' || e.errcode === 'M_IN_USE' || /in use|taken|already/i.test(String(e.message || '')));
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => SHORT_ALPHABET[b % SHORT_ALPHABET.length]).join('') + Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => SHORT_ALPHABET[b % SHORT_ALPHABET.length]).join('');

/** Typed refusals for the invite flow (every one says why). */
export const REFUSE = Object.freeze({
  InviteNotFound: 'invite-not-found',
  InviteExpired: 'invite-expired',
  InviteUnknown: 'invite-unknown',
  InviteUsed: 'invite-used',
  NoRequest: 'no-request',
  CodeMismatch: 'code-mismatch',
  RequestForged: 'request-forged',
  GrantNotFromOwner: 'grant-not-from-owner',
  ReaderCannotWrite: 'reader-cannot-write',
  OwnerCannotLeave: 'owner-cannot-leave',
  NotOwner: 'not-owner',
  BadRole: 'bad-role',
  NoGrantYet: 'no-grant-yet',
  OwnerCodeMismatch: 'owner-code-mismatch',
  NoSuchDevice: 'no-such-device',
});
const refuse = (code, why, detail) => new SealRefusal(code, why, detail);

/** History capability, typed. Returns { want, can, gap? } — never a bare boolean. */
export function historyCapability({ want, caps, inviteeCrossSigned = null, visibility = 'shared' }) {
  if (!want) return { want: false, can: false, gap: null };
  const gaps = [];
  if (visibility !== 'shared' && visibility !== 'world_readable') gaps.push('history-not-shared');
  if (!caps || !caps.historySharing) gaps.push('sdk-without-history-sharing');
  else if (!caps.ownDeviceCrossSigned) gaps.push('owner-device-not-cross-signed');
  if (inviteeCrossSigned === false) gaps.push('invitee-device-not-cross-signed');
  return { want: true, can: gaps.length === 0, gap: gaps[0] || null, gaps };
}
export const GAP_WORDS = Object.freeze({
  'history-not-shared': 'this repo’s rooms do not share history with new members',
  'sdk-without-history-sharing': 'this build of the Matrix library cannot hand over past keys',
  'owner-device-not-cross-signed': 'your own device is not yet verified by your account’s cross-signing, which handing over past keys requires',
  'invitee-device-not-cross-signed': 'their device is not cross-signed by their account, which receiving past keys requires',
});

/** The plain-words state of an invite (what the panel prints). */
export function inviteWords(inv) {
  switch (inv.state) {
    case 'open': return 'Waiting for them to join';
    case 'waiting-confirm': return 'Waiting for you to confirm their device';
    case 'expired': return 'Expired — nobody can use this code any more';
    case 'closed': return 'Closed';
    default: return String(inv.state);
  }
}

// ---------------------------------------------------------------- the machine

export function makeShare({ mx, attach = null, now = () => Date.now(), onRefuse = null, log = () => {}, ns = NS } = {}) {
  if (!mx) throw new Error('makeShare needs an mx crossing');
  const known = new Set();
  const sealed = sealTransport(mx, { known: () => known, onRefuse, ns });
  const say = (kind, text) => { try { log({ kind, text }); } catch { /* a log sink never changes behaviour */ } };

  // A registry read that fails THROWS — writing back from a failed read would wipe the others.
  async function regRead(type) { return (await mx.getAccountData(type)) || {}; }
  async function invitesRead() { const r = await regRead(REGISTRY.invites); return Array.isArray(r.invites) ? r.invites : []; }
  async function invitesWrite(list) { await mx.setAccountData(REGISTRY.invites, { invites: list }); }
  async function reposRead() { const r = await regRead(REGISTRY.repos); return r.repos && typeof r.repos === 'object' ? r.repos : {}; }
  async function reposWrite(map) { await mx.setAccountData(REGISTRY.repos, { repos: map }); }

  const adopt = (repo) => { for (const s of STORES) if (repo.rooms[s]) known.add(repo.rooms[s]); };

  async function ready(roomId) {
    // assertEncrypted reads state AND asks the crypto layer; a fresh room may need a moment,
    // which the adapter's isEncryptionReady waits for (bounded there, typed here).
    await assertEncrypted(mx, roomId, {});
  }

  // -------------------------------------------------------------- owner: create
  async function createRepo({ title = '' } = {}) {
    const repoId = rid();
    const owner = mx.userId;
    const rooms = {};
    for (const s of STORES) {
      rooms[s] = await mx.createRoom(storeRoomBody({ repoId, store: s, owner, epoch: 1 }));
      known.add(rooms[s]);
      await ready(rooms[s]);                              // refuse to go on with an unconfirmed room
      await mx.blacklistUnverified(rooms[s], true);       // policy: confirmed devices only
    }
    const repo = { repoId, owner, role: ROLE.owner, rooms, epoch: 1 };
    // The title is content: it lives in the sealed log, never in a room name or in account data.
    await sealed.sendEvent(rooms.log, EVT.manifest, { v: 1, repo: repoId, title: String(title || ''), rooms, epoch: 1, owner });
    const map = await reposRead();
    map[repoId] = { rooms, role: ROLE.owner, owner, epoch: 1 };
    await reposWrite(map);
    say('ok', 'Created an encrypted repo with three stores.');
    return repo;
  }

  async function adoptFromRegistry(repoId) {
    const map = await reposRead();
    const r = map[repoId];
    if (!r) return null;
    const repo = { repoId, owner: r.owner, role: r.role, rooms: r.rooms, epoch: r.epoch, ledgerSeed: r.ledgerSeed || [] };
    adopt(repo);
    return repo;
  }
  async function listRepos() {
    const map = await reposRead();
    return Object.entries(map).map(([repoId, r]) => ({ repoId, owner: r.owner, role: r.role, rooms: r.rooms, epoch: r.epoch, ledgerSeed: r.ledgerSeed || [] }));
  }

  // -------------------------------------------------------------- owner: mint
  async function mintInvite(repo, { role = ROLE.editor, history = false, base = '' } = {}) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can mint invites', {});
    if (role !== ROLE.editor && role !== ROLE.reader) throw refuse(REFUSE.BadRole, 'an invite is for an editor or a reader', { role });
    let door = null, code = null;
    for (let attempt = 0; attempt < 5 && !door; attempt++) {
      const c = shortCode();
      try {
        door = await mx.createRoom(doorRoomBody({ code: c, owner: mx.userId }));
        code = c;
      } catch (e) { if (aliasTaken(e)) continue; throw e; }
    }
    if (!door) throw refuse('alias-unavailable', 'could not find a free invite code', {});
    known.add(door);
    await ready(door);
    await mx.blacklistUnverified(door, true);
    const caps = await mx.capabilities();
    const hist = historyCapability({ want: !!history, caps, visibility: 'shared' });
    const exp = now() + INVITE_TTL_MS;
    const list = await invitesRead();
    list.push({ door, repo: repo.repoId, role, history: hist, exp, createdAt: now() });
    await invitesWrite(list);
    await sealed.sendEvent(repo.rooms.log, EVT.note, { v: 1, kind: 'invite-minted', door, role, exp });
    say('ok', 'Made an invite. It lets someone ask; nothing is shared until you confirm their device.');
    return { code, door, role, history: hist, exp, link: inviteLink({ base, code }), state: 'open' };
  }

  async function codeOfDoor(door) {
    const a = await mx.aliasesOf(door);
    const first = (a || []).map((x) => String(x).split(':')[0].replace(/^#/, '')).find(validCode);
    return first || null;
  }

  async function requestsOf(door) {
    const evs = await mx.readEvents(door);
    return evs.filter((e) => e.type === EVT.request && e.decrypted && e.sender !== mx.userId);
  }

  // -------------------------------------------------------------- owner: list
  async function listInvites(repo, { base = '' } = {}) {
    await sweepDoors();
    const list = (await invitesRead()).filter((i) => i.repo === repo.repoId && !i.closing);
    const out = [];
    for (const inv of list) {
      const code = await codeOfDoor(inv.door);
      const reqs = await requestsOf(inv.door);
      const expired = now() > inv.exp;
      out.push({
        door: inv.door, code, role: inv.role, history: inv.history, exp: inv.exp,
        link: code ? inviteLink({ base, code }) : '',
        requests: reqs.length,
        state: expired ? 'expired' : reqs.length ? 'waiting-confirm' : 'open',
      });
    }
    return out;
  }

  /** What the owner compares on the confirm screen: the request, re-derived from the real device key. */
  async function pendingRequests(door) {
    const out = [];
    for (const r of await requestsOf(door)) {
      const claimed = r.content && r.content.device;
      if (!claimed) continue;
      const devs = await mx.deviceKeysOf(r.sender);
      const actual = devs.find((d) => d.deviceId === claimed.deviceId);
      const actualCode = actual ? await pairingCode(actual.ed25519) : null;
      out.push({
        user: r.sender, deviceId: claimed.deviceId, name: r.content.name || '',
        fingerprint: actual ? fingerprintGroups(actual.ed25519) : [], ed25519: actual ? actual.ed25519 : null,
        code: actualCode, forged: !actual || actual.ed25519 !== claimed.ed25519 || actualCode !== r.content.pairing,
        crossSigned: !!(actual && actual.crossSigned),
      });
    }
    return out;
  }

  // -------------------------------------------------------------- owner: confirm
  // ORDER IS THE CLAIM. Nothing is invited, trusted, granted or ledgered until step 3
  // has matched a code the owner TYPED to the real key of a device that is in the door.
  async function confirm(repo, { door, entered }) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can confirm an invite', {});
    const invs = await invitesRead();
    const inv = invs.find((i) => i.door === door && i.repo === repo.repoId);
    if (!inv) throw refuse(REFUSE.InviteUnknown, 'that invite is not outstanding', { door });
    if (now() > inv.exp) { await closeDoor(door, 'expired'); await dropInvite(door); throw refuse(REFUSE.InviteExpired, 'that invite has expired; make a new one', { door }); }
    const digits = String(entered || '').replace(/\D/g, '');
    const pend = await pendingRequests(door);
    if (!pend.length) throw refuse(REFUSE.NoRequest, 'nobody has asked to join with this invite yet', { door });
    const match = pend.find((p) => p.code && p.code === digits);
    if (!match) throw refuse(REFUSE.CodeMismatch, 'those six digits do not match any device waiting at this invite', { door, waiting: pend.length });
    if (match.forged) throw refuse(REFUSE.RequestForged, 'the request describes a device key that is not the one actually in the room', { door });

    const { user, deviceId } = match;
    // 1. trust exactly this device — and only now
    await mx.setDeviceVerified(user, deviceId);
    // 2. bring them into the stores, history per the invite and what is really possible
    const caps = await mx.capabilities();
    const hist = historyCapability({ want: inv.history.want, caps, inviteeCrossSigned: match.crossSigned, visibility: 'shared' });
    for (const s of STORES) {
      // idempotent: a confirm that failed half-way is simply run again
      const cur = await mx.roomState(repo.rooms[s]);
      if (cur.members[user] !== 'invite' && cur.members[user] !== 'join') await mx.invite(repo.rooms[s], user, { shareHistory: hist.can });
      if (inv.role === ROLE.editor) {
        const st = cur;
        const pl = JSON.parse(JSON.stringify(st.powerLevels || {}));
        pl.users = { ...(pl.users || {}), [user]: POWER.editor };
        await mx.setPowerLevels(repo.rooms[s], pl);
      }
    }
    // 3. the owner-authored ledger entry the fold will judge their writes by
    await sealed.sendEvent(repo.rooms.log, EVT.role, { v: 1, user, role: inv.role, epoch: repo.epoch, via: 'invite', device: { deviceId, ed25519: match.ed25519 } });
    // 4. the grant: rooms and role, in the door, to the confirmed device
    const ledger = await ledgerSnapshot(repo);
    await sealed.sendEvent(door, EVT.grant, { v: 1, repo: repo.repoId, rooms: repo.rooms, role: inv.role, history: hist, epoch: repo.epoch, owner: repo.owner, user, ledger });
    // The code stops working now (single use) and anyone else who asked is shown out; the confirmed
    // person stays in the door only until they have read the grant — the owner leaves when it is empty.
    await markClosing(door);
    await closeDoor(door, 'confirmed', { keep: [user] });
    await sealed.sendEvent(repo.rooms.log, EVT.note, { v: 1, kind: 'invite-confirmed', user, role: inv.role });
    say('ok', `Confirmed a new ${inv.role}.`);
    return { user, deviceId, role: inv.role, history: hist };
  }

  async function dropInvite(door) {
    const list = await invitesRead();
    await invitesWrite(list.filter((i) => i.door !== door));
  }
  async function markClosing(door) {
    const list = await invitesRead();
    await invitesWrite(list.map((i) => (i.door === door ? { ...i, closing: true } : i)));
  }
  /** Leave doors whose confirmed person has read their grant and gone. */
  async function sweepDoors() {
    const list = await invitesRead();
    for (const inv of list.filter((i) => i.closing)) {
      let empty = true;
      try {
        const st = await mx.roomState(inv.door);
        empty = !Object.entries(st.members || {}).some(([u, m]) => u !== mx.userId && (m === 'join' || m === 'invite'));
      } catch { empty = true; }
      if (empty) { try { await mx.leave(inv.door); } catch { /* already out */ } known.delete(inv.door); await dropInvite(inv.door); }
    }
  }

  /** Close a door: the code stops resolving and nobody else stays in it. Returns the steps, not a bare ok. */
  async function closeDoor(door, why, { keep = [] } = {}) {
    const steps = [];
    const code = await codeOfDoor(door).catch(() => null);
    if (code) { try { await mx.deleteAlias(`#${code}:${mx.server}`); steps.push('alias-removed'); } catch (e) { steps.push('alias-not-removed'); } }
    try {
      const st = await mx.roomState(door);
      for (const [u, m] of Object.entries(st.members || {})) {
        if (u !== mx.userId && !keep.includes(u) && (m === 'join' || m === 'invite')) { try { await mx.kick(door, u, 'invite closed'); steps.push('removed:' + u); } catch { steps.push('not-removed:' + u); } }
      }
    } catch { steps.push('members-unread'); }
    if (!keep.length) { try { await mx.leave(door); steps.push('left'); } catch { steps.push('not-left'); } known.delete(door); }
    return { door, why, steps };
  }

  async function revoke(repo, { door }) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can revoke an invite', {});
    const out = await closeDoor(door, 'revoked');
    await dropInvite(door);
    await sealed.sendEvent(repo.rooms.log, EVT.note, { v: 1, kind: 'invite-revoked', door });
    say('ok', 'Revoked the invite. Its code no longer works.');
    return out;
  }
  const reject = revoke;

  // -------------------------------------------------------------- invitee: redeem
  async function redeem({ input }) {
    const code = parseInvite(input);
    if (!code) throw refuse(REFUSE.InviteNotFound, 'that is not an invite code or link', {});
    const door = await mx.resolveAlias(`#${code}:${mx.server}`).catch(() => null);
    if (!door) throw refuse(REFUSE.InviteNotFound, 'no open invite has that code (it may be used, revoked or expired)', {});
    await mx.join(door, {});
    known.add(door);
    await ready(door);                                       // never send a request into a plaintext room
    // Not blacklisting unverified devices here, on purpose: the request has to reach the owner's
    // device, which this person cannot have confirmed yet. It carries only a public device key.
    const st = await mx.roomState(door);
    const owner = st.creator;
    const me = await mx.ownDeviceKeys();
    const myCode = await pairingCode(me.ed25519);
    await sealed.sendEvent(door, EVT.request, { v: 1, device: { deviceId: me.deviceId, ed25519: me.ed25519 }, pairing: myCode, name: '' });
    const ownerDevs = await mx.deviceKeysOf(owner);
    const ownerCodes = [];
    for (const d of ownerDevs) ownerCodes.push({ deviceId: d.deviceId, code: await pairingCode(d.ed25519), fingerprint: fingerprintGroups(d.ed25519) });
    say('ok', 'Asked to join. Read the six digits to the person who invited you.');
    return { door, owner, myCode, myFingerprint: fingerprintGroups(me.ed25519), ownerCodes, state: 'waiting-for-owner' };
  }

  // -------------------------------------------------------------- invitee: accept grant
  async function acceptGrant({ door, ownerCode = '' }) {
    let st, evs;
    try { st = await mx.roomState(door); evs = await mx.readEvents(door); }
    catch (e) { throw refuse(REFUSE.NoGrantYet, 'you are no longer in that invite — it was closed, or it was not yours', { door }); }
    const owner = st.creator;
    const g = evs.filter((e) => e.type === EVT.grant && e.decrypted).sort((a, b) => b.origin_server_ts - a.origin_server_ts)[0];
    if (!g) throw refuse(REFUSE.NoGrantYet, 'the owner has not confirmed your device yet', { door });
    if (g.sender !== owner) throw refuse(REFUSE.GrantNotFromOwner, 'that grant was not sent by the person who made this invite, so it is ignored', { door });
    const c = g.content;
    const want = !!(c.history && c.history.can);
    const joined = [];
    for (const s of STORES) {
      const room = c.rooms && c.rooms[s];
      if (!room) throw refuse('grant-incomplete', `the grant does not name the ${s} store`, { store: s });
      known.add(room);
      await mx.join(room, { acceptSharedHistory: want });
      try { await ready(room); } catch (e) { try { await mx.leave(room); } catch { /* best effort */ } known.delete(room); throw e; }
      await mx.blacklistUnverified(room, true);
      joined.push(room);
    }
    const repo = { repoId: c.repo, owner: c.owner, role: c.role, rooms: c.rooms, epoch: c.epoch, ledgerSeed: Array.isArray(c.ledger) ? c.ledger : [] };
    // Mutual: the person typed the owner's code, so the owner's device is trusted here too — without
    // that their own writes would be withheld from the owner. Without it they can read, not be read.
    let ownerTrusted = false;
    if (ownerCode) { await trustOwner(repo, { entered: ownerCode }); ownerTrusted = true; }
    const map = await reposRead();
    map[repo.repoId] = { rooms: repo.rooms, role: repo.role, owner: repo.owner, epoch: repo.epoch, ledgerSeed: repo.ledgerSeed };
    await reposWrite(map);
    try { await mx.leave(door); } catch { /* the owner closes it anyway */ }
    known.delete(door);
    await syncTrust(repo);
    say('ok', `Joined as ${repo.role}.`);
    return { repo, history: c.history, ownerTrusted, note: ownerTrusted ? '' : 'You can read, but what you write will not reach anyone until you confirm the owner\u2019s code.' };
  }

  // -------------------------------------------------------------- people, roles, removal, leaving
  // A member joined after earlier role entries were written cannot decrypt them (no keys for the
  // past). So the grant carries the owner's ledger as of the grant — authenticated by the grant's
  // sender — and the fold reads seed + whatever this device can decrypt. Same ledger for everyone.
  const seedEvents = (repo) => (repo.ledgerSeed || []).map((e, i) => ({ type: e.type, content: e.content, origin_server_ts: e.origin_server_ts, sender: repo.owner, event_id: 'seed:' + i, decrypted: true }));
  async function ledgerOf(repo) {
    const evs = (await mx.readEvents(repo.rooms.log)).filter((e) => e.decrypted);
    return ledgerFromEvents([...seedEvents(repo), ...evs], { owner: repo.owner });
  }
  async function ledgerSnapshot(repo) {
    const evs = (await mx.readEvents(repo.rooms.log)).filter((e) => e.decrypted && (e.type === EVT.role || e.type === EVT.revoke) && e.sender === repo.owner);
    return [...seedEvents(repo), ...evs].map((e) => ({ type: e.type, content: e.content, origin_server_ts: e.origin_server_ts }));
  }

  /** Mutual confirmation: the invitee types the owner's code; the owner's device becomes trusted here. */
  async function trustOwner(repo, { entered }) {
    const digits = String(entered || '').replace(/\D/g, '');
    for (const d of await mx.deviceKeysOf(repo.owner)) {
      if (digits && (await pairingCode(d.ed25519)) === digits) { await mx.setDeviceVerified(repo.owner, d.deviceId); return { deviceId: d.deviceId }; }
    }
    throw refuse(REFUSE.OwnerCodeMismatch, 'those six digits do not match any device of the person who invited you', {});
  }

  /** Apply the owner's confirmations locally (trust is per client in Matrix) and withdraw removed people's. */
  async function syncTrust(repo) {
    const evs = [...seedEvents(repo), ...(await mx.readEvents(repo.rooms.log)).filter((e) => e.decrypted)];
    const { trusted, withdrawn } = trustedDevices(evs, { owner: repo.owner });
    const out = { trusted: 0, withdrawn: 0, mismatched: [] };
    for (const t of trusted) {
      if (t.user === mx.userId) continue;
      const actual = (await mx.deviceKeysOf(t.user)).find((d) => d.deviceId === t.deviceId);
      if (!actual) continue;
      if (actual.ed25519 !== t.ed25519) { out.mismatched.push({ user: t.user, deviceId: t.deviceId, why: 'the key the owner confirmed is not the key this device presents now, so it is not trusted' }); continue; }
      if (!actual.verified) { await mx.setDeviceVerified(t.user, t.deviceId); }
      out.trusted++;
    }
    for (const x of withdrawn) { await mx.setDeviceVerified(x.user, x.deviceId, false); out.withdrawn++; }
    return out;
  }

  /** The owner confirms one more device of a member (a new phone, a second browser). */
  async function confirmDevice(repo, { user, deviceId, entered }) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo\u2019s owner can confirm a device', {});
    const dev = (await mx.deviceKeysOf(user)).find((d) => d.deviceId === deviceId);
    if (!dev) throw refuse(REFUSE.NoSuchDevice, 'that device is not known for that person', { user, deviceId });
    const digits = String(entered || '').replace(/\D/g, '');
    if ((await pairingCode(dev.ed25519)) !== digits) throw refuse(REFUSE.CodeMismatch, 'those six digits do not match that device', {});
    await mx.setDeviceVerified(user, deviceId);
    await sealed.sendEvent(repo.rooms.log, EVT.device, { v: 1, user, device: { deviceId, ed25519: dev.ed25519 } });
    return { user, deviceId };
  }

  async function people(repo) {
    const st = await mx.roomState(repo.rooms.log);
    const led = await ledgerOf(repo);
    const t = now();
    const out = [];
    for (const [user, membership] of Object.entries(st.members || {})) {
      if (membership !== 'join' && membership !== 'invite' && membership !== 'ban') continue;
      const devs = user === mx.userId ? [] : await mx.deviceKeysOf(user);
      out.push({
        user, membership,
        role: roleAt(led, user, t),
        devices: devs.map((d) => ({ deviceId: d.deviceId, verified: !!d.verified })),
        newDevices: devs.filter((d) => !d.verified).length,
      });
    }
    return out;
  }

  async function setRole(repo, { user, role }) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can change roles', {});
    if (role !== ROLE.editor && role !== ROLE.reader) throw refuse(REFUSE.BadRole, 'a role is editor or reader', { role });
    await sealed.sendEvent(repo.rooms.log, EVT.role, { v: 1, user, role, epoch: repo.epoch, via: 'change' });
    for (const s of STORES) {
      const st = await mx.roomState(repo.rooms[s]);
      const pl = JSON.parse(JSON.stringify(st.powerLevels || {}));
      pl.users = { ...(pl.users || {}) };
      if (role === ROLE.editor) pl.users[user] = POWER.editor; else delete pl.users[user];
      await mx.setPowerLevels(repo.rooms[s], pl);
    }
    return { user, role };
  }

  async function removeMember(repo, { user, reason = 'removed by the owner' }) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can remove people', {});
    if (user === repo.owner) throw refuse(REFUSE.NotOwner, 'the owner cannot be removed', {});
    const epoch = repo.epoch + 1;
    // 1. the ledger first: the fold stops accepting their writes even if a server call below fails
    await sealed.sendEvent(repo.rooms.log, EVT.revoke, { v: 1, user, epoch, reason });
    await sealed.sendEvent(repo.rooms.log, EVT.epoch, { v: 1, epoch, why: 'member-removed', user });
    try { for (const d of await mx.deviceKeysOf(user)) await mx.setDeviceVerified(user, d.deviceId, false); } catch { /* the ledger withdraws it for everyone else */ }
    // 2. out of every store, kept out
    const steps = [];
    for (const s of STORES) {
      try { await mx.ban(repo.rooms[s], user, reason); steps.push(`banned:${s}`); } catch (e) { steps.push(`ban-failed:${s}`); }
    }
    // 3. a new outbound session in each room, so the next item is sent under keys they never receive
    for (const s of STORES) { try { await mx.discardSession(repo.rooms[s]); steps.push(`rotated:${s}`); } catch { steps.push(`rotate-failed:${s}`); } }
    repo.epoch = epoch;
    const map = await reposRead();
    if (map[repo.repoId]) { map[repo.repoId].epoch = epoch; await reposWrite(map); }
    say('ok', 'Removed a member.');
    return { user, epoch, steps, disclosure: WORDS.removal };
  }

  async function leave(repo) {
    if (repo.owner === mx.userId) throw refuse(REFUSE.OwnerCannotLeave, 'the owner cannot leave: ownership transfer is not built, so leaving would strand the repo', {});
    for (const s of STORES) { try { await mx.leave(repo.rooms[s]); } catch { /* already out */ } known.delete(repo.rooms[s]); }
    const map = await reposRead();
    delete map[repo.repoId];
    await reposWrite(map);
    return { left: true, disclosure: WORDS.leave };
  }

  // -------------------------------------------------------------- data
  const storeOfOp = (op, c, store) => store || (op === 'ins' ? storeFor(c.entity_type) : (typeof c.anchor === 'string' && c.anchor.startsWith('src:') ? 'sources' : 'records'));

  async function canWrite(repo) {
    await syncTrust(repo);
    const led = await ledgerOf(repo);
    const role = roleAt(led, mx.userId, now()) || repo.role;
    if (role !== ROLE.owner && role !== ROLE.editor) {
      throw refuse(REFUSE.ReaderCannotWrite, 'readers can read but cannot change anything in this repo', { role });
    }
    return role;
  }

  /** Large string fields travel as encrypted attachments; the reference rides in the sealed event. */
  async function hoist(c) {
    const out = { ...c };
    const big = (v) => typeof v === 'string' && v.length >= HOIST_LIMIT;
    if (big(out.value)) out.value = await sealAttachment({ mx, attach }, new TextEncoder().encode(out.value), { mime: 'text/plain', name: 'value.txt' });
    if (out.payload && typeof out.payload === 'object') {
      const p = { ...out.payload };
      for (const [k, v] of Object.entries(p)) if (big(v)) p[k] = await sealAttachment({ mx, attach }, new TextEncoder().encode(v), { mime: 'text/plain', name: k + '.txt' });
      out.payload = p;
    }
    return out;
  }
  async function unhoistValue(v) {
    if (v && typeof v === 'object' && v.__media === 2 && v.mxc && v.file && attach && attach.decrypt) {
      const bytes = await mx.download(v.mxc);
      return new TextDecoder().decode(await attach.decrypt(bytes, v.file));
    }
    return v;
  }
  async function unhoist(c) {
    const out = { ...c };
    out.value = await unhoistValue(out.value);
    if (out.payload && typeof out.payload === 'object') {
      const p = { ...out.payload };
      for (const [k, v] of Object.entries(p)) p[k] = await unhoistValue(v);
      out.payload = p;
    }
    return out;
  }

  async function write(repo, op, content, { store = null } = {}) {
    if (!WRITE_OPS.includes(op)) throw refuse('not-a-stored-operator', `${op} is not a stored operator`, { op });
    await canWrite(repo);
    const c = await hoist(content || {});
    return sealed.sendEvent(repo.rooms[storeOfOp(op, c, store)], `${ns}.${op}`, c);
  }

  /**
   * Write many operators in few events: ops are grouped per store into batch events no larger
   * than CONTENT_LIMIT. The fold sees them as the individual operators they are, each gated by
   * its own sender (a batch is a transport, not a way around the gate).
   *   entries: [{ op, content }]   returns { events, ops, stores }
   */
  async function writeBatch(repo, entries, { limit = CONTENT_LIMIT } = {}) {
    await canWrite(repo);
    const groups = new Map();
    for (const e of entries) {
      if (!WRITE_OPS.includes(e.op)) throw refuse('not-a-stored-operator', `${e.op} is not a stored operator`, { op: e.op });
      const c = await hoist(e.content || {});
      const st = storeOfOp(e.op, c, e.store || null);
      (groups.get(st) || groups.set(st, []).get(st)).push({ op: e.op, content: c });
    }
    let events = 0;
    for (const [st, list] of groups) {
      let cur = [], size = 0;
      const flush = async () => { if (!cur.length) return; await sealed.sendEvent(repo.rooms[st], BATCH, { v: 1, ops: cur }); events++; cur = []; size = 0; };
      for (const o of list) {
        const n = JSON.stringify(o).length;
        if (cur.length && size + n > limit) await flush();
        cur.push(o); size += n;
      }
      await flush();
    }
    return { events, ops: entries.length, stores: [...groups.keys()] };
  }

  const expandBatch = (e) => {
    if (e.type !== BATCH || !e.decrypted) return [e];
    const ops = Array.isArray(e.content && e.content.ops) ? e.content.ops : [];
    return ops.filter((o) => o && WRITE_OPS.includes(o.op)).map((o, i) => ({ ...e, type: `${ns}.${o.op}`, content: o.content, event_id: `${e.event_id}#${i}` }));
  };

  /** ledger → gate → resolve attachments → fold, over what this device can read; undecryptable items are counted, not hidden. */
  async function readState(repo, { fold }) {
    const asEvent = (e) => (e.decrypted ? e : { type: 'm.room.encrypted', sender: e.sender, origin_server_ts: e.origin_server_ts, event_id: e.event_id, content: {} });
    await syncTrust(repo).catch(() => null);
    const data = [];
    for (const s of ['sources', 'records']) for (const e of await mx.readEvents(repo.rooms[s])) for (const x of expandBatch(e)) data.push(asEvent(x));
    const ledger = [...seedEvents(repo), ...(await mx.readEvents(repo.rooms.log)).filter((e) => e.decrypted)];
    return foldRepoAsync({
      dataEvents: data, ledgerEvents: ledger, owner: repo.owner, fold, ns,
      transform: async (evs) => { const out = []; for (const e of evs) out.push(e.content && (e.content.value || e.content.payload) ? { ...e, content: await unhoist(e.content) } : e); return out; },
    });
  }

  // A new instance (a reload) knows nothing until it is told: any call that names a repo adopts that repo's
  // rooms, and any door in this account's own registry is trusted as a door. Nothing else is ever added.
  const withRepo = (f) => async (repo, ...a) => {
    if (repo && repo.rooms) adopt(repo);
    try { for (const i of await invitesRead()) known.add(i.door); } catch { /* the call below reads again and throws honestly */ }
    return f(repo, ...a);
  };
  const api = {
    mx, sealed, known, WORDS,
    createRepo, adoptFromRegistry, listRepos,
    mintInvite, listInvites, pendingRequests, confirm, revoke, reject, closeDoor,
    redeem, acceptGrant,
    people, setRole, removeMember, leave, sweepDoors, trustOwner, syncTrust, confirmDevice,
    write, writeBatch, readState, ledgerOf,
  };
  for (const k of ['mintInvite', 'listInvites', 'confirm', 'revoke', 'reject', 'removeMember', 'leave', 'people', 'setRole', 'confirmDevice', 'trustOwner', 'syncTrust', 'write', 'writeBatch', 'readState', 'ledgerOf']) api[k] = withRepo(api[k]);
  return api;
}

/** Scrub known secrets out of a line before it is shown or stored. */
export function redact(text, secrets = []) {
  let s = String(text == null ? '' : text);
  for (const x of secrets) if (x && String(x).length >= 4) s = s.split(String(x)).join('•••');
  return s;
}
