// holodeck-invites.js — invite people to the Holodeck workspace with a magic link, and see who is here.
//
// The workspace is what it already is: a private Matrix room and (optionally) a public one, with the sources
// held locally in OPFS. An accepted invitation makes a person's account a member of those same rooms.
//
// The whole idea, and the thing this file is careful NOT to do:
//   * An invitation is only an INVITATION. The owner types a name and gets a magic link. The link says "this
//     door is yours to knock on"; it does not sign anyone in, and the owner never holds anything that would let
//     them (or the email it travelled in) sign in as the person.
//   * The PERSON chooses their own sign-in name and password and enrols their own authenticator app, through the
//     login gate (tools/login-gate). The owner never sees any of it. Every later sign-in needs password AND the
//     six digits, checked by the gate.
//   * The link's job is admission. It carries a private signing key; the workspace's room state carries only the
//     matching PUBLIC key. An enrolled account that holds the link signs (door, itself) in the invitation's door;
//     ANY browser signed in as the owner can verify that, ask the gate that the account really enrolled, and invite
//     exactly that account. Nothing secret is stored on the owner's side, so nothing is tied to one device.
//
// PURE: every crossing is the injected `mx` (a thin client of one signed-in Matrix account), `store`
// ({ get(key), set(key, value) } — only a convenience copy of the links, on THIS device) and `gate`
// ({ enrolled(user) } — optional).
//
// What stays where:
//   * The link (private key) is on the device that made it, and in whatever channel the owner sends it through. It
//     is dropped from the device once the person is in.
//   * Everything the workspace says about its people is SEALED on the device before it is sent (holodeck-vault.js):
//     the names the owner typed, the invitation registry, and who is viewing what. The homeserver holds ciphertext
//     and cannot read it. The key is on member devices; a new member receives it inside the grant, sealed under a
//     key derived from their own link. Removing someone rotates the key.
//   * The door room holds only what is needed to be let in: a signature and room ids. No name, no title.
//
// What it does NOT do (said in the panel too): a link is a bearer invitation until used — whoever opens it first and
// enrols is let in, so send it as you would a key, and watch the people list. Once someone has signed in, their
// browser holds a Matrix session token. TOTP is not phishing-resistant. The server still sees who is a member, when
// anyone was active, and room names. A device that does not hold the workspace key can read none of the sealed
// content and writes none: it never falls back to plaintext.
import { newDoorAlias, isDoorAlias, newInviteKey, signInvite, verifyInvite, cleanName, onlineNow, ONLINE_MS } from './holodeck-invite-core.js';
import {
  makeKeyring, isSealed, VaultError, CODE as VCODE, EPOCH_EVENT, anySealed, deriveGrantKey, sealGrant, openGrant,
} from './holodeck-vault.js';

export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;           // how long a magic link keeps working

export const EVT = Object.freeze({
  hello: 'io.holodeck.invite.hello',       // invitee -> door: "I opened the link" (a signal for the owner)
  request: 'io.holodeck.invite.request',   // invitee -> door: { sig }
  grant: 'io.holodeck.invite.grant',       // owner -> door: SEALED under a key derived from the link: { rooms, owner, user, ring }
  presence: 'io.holodeck.presence',        // member -> private room: SEALED { viewing, title }
});
export const STATE = Object.freeze({
  people: 'io.holodeck.people',            // private room, SEALED: { v, names: { userId: name } }
  invites: 'io.holodeck.invites',          // private room, SEALED: { v, invites: { [door]: { name, alias, pub, grant, exp, created } } }
});
export const REFUSE = Object.freeze({
  NotSignedIn: 'not-signed-in', NameNeeded: 'name-needed', NoRoom: 'no-room', InviteNotFound: 'invite-not-found',
  LinkIncomplete: 'link-incomplete', OwnerMismatch: 'owner-mismatch', WrongServer: 'wrong-server',
  InviteClosed: 'invite-closed', NoGrantYet: 'no-grant-yet', UnknownInvite: 'unknown-invite',
  OldInvitation: 'old-invitation', GrantUnreadable: 'grant-unreadable',
});
export class InviteRefusal extends Error {
  constructor(code, why, detail = {}) { super(`${code}: ${why}`); this.name = 'InviteRefusal'; this.refusal = true; this.code = code; this.why = why; this.detail = detail; }
}
const refuse = (code, why, detail) => new InviteRefusal(code, why, detail);

export const WORDS = Object.freeze({
  link: 'The link is an invitation, not a key to their account: they choose their own password and set up their own authenticator, and you never see either.',
  bearer: 'Whoever opens the link first and sets up an account is let in. Send it as you would a key, and watch the list.',
  scope: 'Signing in needs the password and the six digits every time, checked by the gate in front of your homeserver. Once someone is signed in, their browser holds the session.',
  server: 'Names, invitations and who is viewing what are sealed on your device with a key the homeserver never has. It can still see who is a member, when they were active, and room names.',
  locked: 'This device does not hold the workspace key yet, so it cannot read or write the workspace’s people. Open the device link from the device that started the workspace, or ask the owner for a new invitation.',
  name: 'The name you type is what everyone in the workspace sees next to when they are here.',
});

// ------------------------------------------------------------------ the link

/** The magic link: the page, then #join=<alias>&k=<private key>&from=<inviter>&hs=<server>. All of it is fragment. */
export function workspaceInviteLink({ base, alias, secret, from, server = '' }) {
  if (!base) return '';
  if (!isDoorAlias(alias)) throw new Error('an invite alias is 16 characters');
  if (!/^[A-Za-z0-9_-]{22,43}$/.test(String(secret || ''))) throw new Error('an invite link carries a key');
  if (!/^@[^:\s]+:[^\s]+$/.test(String(from || ''))) throw new Error('an invite link names who invited');
  if (server && !/^[A-Za-z0-9.\-]{1,100}(:\d{1,5})?$/.test(String(server))) throw new Error('a homeserver name is a host name');
  return String(base).replace(/[#?].*$/, '') + '#join=' + alias + '&k=' + secret + '&from=' + encodeURIComponent(from) + (server ? '&hs=' + server : '');
}

/** { alias, secret, from, server } out of a link or fragment; anything else is null. */
export function parseWorkspaceInvite(input) {
  const s = String(input == null ? '' : input).trim();
  const a = s.match(/join=([a-z0-9]{16})(?:$|[&#\s])/i);
  if (!a || !isDoorAlias(a[1].toLowerCase())) return null;
  const k = s.match(/[&#?]k=([A-Za-z0-9_-]{22,43})(?:$|[&#\s])/);
  const f = s.match(/[&#?]from=([^&#\s]+)/);
  const h = s.match(/[&#?]hs=([A-Za-z0-9.\-]{1,100}(?::\d{1,5})?)(?:$|[&#\s])/);
  let from = null; try { from = f ? decodeURIComponent(f[1]) : null; } catch { from = null; }
  return { alias: a[1].toLowerCase(), secret: k ? k[1] : null, from, server: h ? h[1] : null };
}

// ------------------------------------------------------------------ the machine

export function makeInvites({ mx, store, gate = null, vault = null, now = () => Date.now(), log = () => {} } = {}) {
  if (!mx) throw new Error('makeInvites needs an mx crossing');
  const say = (kind, text) => { try { log({ kind, text }); } catch { /* a sink never changes behaviour */ } };
  // a convenience copy of the links this device made, so it can show them again — NOT needed to let anyone in
  const LINKS = 'hd:invite-links:v1:' + mx.userId;
  const linksAll = async () => { const v = store ? await store.get(LINKS) : null; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  const linksSet = async (door, link) => { if (!store) return; const m = await linksAll(); if (link) m[door] = link; else delete m[door]; await store.set(LINKS, m); };

  // ---- the vault: this device's keyring, and the only doors content goes through
  const memory = new Map();
  const ring = vault || makeKeyring(store || { async get(k) { return memory.has(k) ? JSON.parse(memory.get(k)) : null; }, async set(k, v) { memory.set(k, JSON.stringify(v)); } }, { account: mx.userId });
  let problem = null;                                      // the last thing the vault refused, for the panel
  const setProblem = (e) => { problem = e && e.vault ? { code: e.code, why: e.why } : null; };

  // Rotation events from the room's owner (or anyone with moderator power) give this device the next key.
  async function absorbEpochs(room) {
    let st, evs;
    try { st = await mx.roomState(room); evs = await mx.readEvents(room, { type: EPOCH_EVENT, limit: 100 }); } catch { return 0; }
    const pl = (st.powerLevels && st.powerLevels.users) || {};
    return ring.absorb(room, evs, { trusted: (u) => u === st.creator || Number(pl[u]) >= 50 });
  }
  // May this device seal into this room? It must hold the key, or be the workspace owner starting it — and never
  // start a key when another device already sealed something (that would split the workspace across two keys).
  async function prepare(room) {
    if (await ring.has(room)) return;
    if (await anySealed((t, k) => mx.getState(room, t, k))) throw new VaultError(VCODE.Locked, WORDS.locked);
    const st = await mx.roomState(room);
    if (st.creator !== mx.userId) throw new VaultError(VCODE.NotOwner, 'the workspace key comes from the person who made the workspace: open the invitation or device link they send');
    await ring.ensure(room);
  }
  async function readSealed(room, type, key = '') {
    const c = await mx.getState(room, type, key).catch(() => null);
    if (!c || (typeof c === 'object' && !Object.keys(c).length)) return null;
    if (isSealed(c)) {
      try { return await ring.openFor(room, c, { type, key }); }
      catch (e) {
        if (e && e.code === VCODE.Locked && (await absorbEpochs(room))) {
          try { return await ring.openFor(room, c, { type, key }); } catch (e2) { setProblem(e2); return null; }
        }
        setProblem(e); return null;
      }
    }
    // Plaintext. Once a device holds the key it is never accepted back — a forged "registry" in the clear could
    // admit someone. An older workspace with no key yet is read as it is, and its next write seals it.
    if (await ring.has(room)) { setProblem(new VaultError(VCODE.Downgrade, 'something unsealed was found where sealed content belongs, so it was ignored')); return null; }
    return c;
  }
  async function putSealed(room, type, key, value) {
    await prepare(room);
    await mx.setState(room, type, key || '', await ring.sealFor(room, value, { type, key: key || '' }));
  }
  /** 'ready' (this device holds the key), 'new' (nothing sealed yet) or 'locked' (sealed under a key it lacks). */
  async function status({ rooms }) {
    if (!rooms || !rooms.priv) return { vault: 'new' };
    if (await ring.has(rooms.priv)) return { vault: 'ready', problem };
    if (await anySealed((t, k) => mx.getState(rooms.priv, t, k))) return { vault: 'locked', problem };
    return { vault: 'new', problem };
  }

  // the registry of pending invitations lives in the private room's state, sealed: public keys, names, expiry, and
  // the derived key each grant is sealed under — none of it readable by the homeserver
  async function registry(priv) { const c = await readSealed(priv, STATE.invites, ''); return c && c.invites && typeof c.invites === 'object' ? c.invites : {}; }
  async function putRegistry(priv, invites) { await putSealed(priv, STATE.invites, '', { v: 1, invites }); }
  async function dropFromRegistry(priv, door) { const r = await registry(priv); if (r[door]) { delete r[door]; await putRegistry(priv, r); } }

  async function closeDoor(door, { keep = [], alias = null } = {}) {
    const steps = [];
    try {
      const st = await mx.roomState(door);
      for (const [u, m] of Object.entries(st.members || {})) {
        if (u !== mx.userId && !keep.includes(u) && (m === 'join' || m === 'invite')) { try { await mx.kick(door, u, 'invite closed'); steps.push('removed:' + u); } catch { steps.push('not-removed:' + u); } }
      }
    } catch { steps.push('members-unread'); }
    try {
      const names = alias ? [`#${alias}:${mx.server}`] : ((await mx.aliasesOf(door)) || []);
      for (const al of names) { try { await mx.deleteAlias(al); steps.push('alias-removed'); } catch { steps.push('alias-not-removed'); } }
    } catch { /* nothing to remove */ }
    if (!keep.length) { try { await mx.leave(door); steps.push('left'); } catch { steps.push('not-left'); } }
    return steps;
  }

  // ---------------------------------------------------------------- owner: make an invitation
  /** A name in, a magic link out. Nothing is sent anywhere, and nothing the person will ever type is made here. */
  async function invite({ name, rooms, base }) {
    if (!mx.userId) throw refuse(REFUSE.NotSignedIn, 'sign in to Matrix first', {});
    const label = cleanName(name);
    if (!label) throw refuse(REFUSE.NameNeeded, 'give this person a name', {});
    if (!rooms || !rooms.priv) throw refuse(REFUSE.NoRoom, 'there is no private room to invite them to yet', {});
    await prepare(rooms.priv);                                  // may this device seal here? before anything is made
    let door = null, alias = null;
    for (let i = 0; i < 5 && !door; i++) {
      const a = newDoorAlias();
      try {
        door = await mx.createRoom({
          name: 'holodeck-invite', preset: 'public_chat', visibility: 'private', room_alias_name: a,
          initial_state: [
            { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } },
            { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'joined' } },
            { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
          ],
          power_level_content_override: { events_default: 0, state_default: 100, invite: 100, kick: 100, ban: 100, redact: 100 },
        });
        alias = a;
      } catch (e) { if (!(e && (e.errcode === 'M_ROOM_IN_USE' || /in use|taken|already/i.test(String(e.message || ''))))) throw e; }
    }
    if (!door) throw refuse('alias-unavailable', 'could not find a free invite code', {});
    const key = await newInviteKey();
    const link = workspaceInviteLink({ base, alias, secret: key.seed, from: mx.userId, server: mx.server });
    const reg = await registry(rooms.priv);
    reg[door] = { name: label, alias, pub: key.pub, grant: await deriveGrantKey(key.seed, alias), exp: now() + INVITE_TTL_MS, created: now(), pubRoom: rooms.pub || null };
    await putRegistry(rooms.priv, reg);
    await linksSet(door, link);
    say('ok', `Made an invitation for ${label}.`);
    return { door, name: label, link, exp: reg[door].exp, state: 'sent' };
  }

  async function revoke({ rooms, door }) {
    const reg = await registry(rooms.priv);
    await closeDoor(door, { alias: reg[door] && reg[door].alias });
    await dropFromRegistry(rooms.priv, door);
    await linksSet(door, null);
  }

  /**
   * Look at every outstanding invitation of this workspace and let in the account whose signature verifies — once
   * the gate confirms that account enrolled an authenticator. In timeline order; the first valid signature wins and
   * closes the door. Works from any browser signed in as the owner.
   */
  async function sweep({ rooms }) {
    const out = [];
    if (!rooms || !rooms.priv) return out;
    const reg = await registry(rooms.priv);
    for (const [door, rec] of Object.entries(reg)) {
      if (now() > rec.exp) { await closeDoor(door, { alias: rec.alias }); await dropFromRegistry(rooms.priv, door); await linksSet(door, null); out.push({ door, name: rec.name, state: 'expired' }); continue; }
      if (!rec.grant) { out.push({ door, name: rec.name, state: 'blocked', blocked: { why: REFUSE.OldInvitation } }); continue; }
      let evs;
      try { evs = await mx.readEvents(door); } catch { out.push({ door, name: rec.name, state: 'unreadable' }); continue; }
      const opened = evs.some((e) => e.sender !== mx.userId && e.type === EVT.hello);
      let found = null, blocked = null;
      for (const e of evs) {
        if (e.sender === mx.userId || e.type !== EVT.request || e.decrypted === false || !e.content || typeof e.content.sig !== 'string') continue;
        if (!(await verifyInvite(rec.pub, { door, user: e.sender }, e.content.sig))) continue;
        // the person holds the link. Are they who this workspace requires: an account that enrolled an authenticator?
        if (gate) {
          let ok = false;
          try { ok = await gate.enrolled(e.sender); } catch { blocked = { user: e.sender, why: 'gate-unreachable' }; break; }   // fail closed
          if (!ok) { blocked = { user: e.sender, why: 'not-enrolled' }; continue; }
        }
        found = e.sender; break;
      }
      if (found) { const r = await admit(rooms, door, rec, found); out.push({ door, name: rec.name, state: 'admitted', user: found, ...r }); continue; }
      out.push({ door, name: rec.name, state: blocked ? 'blocked' : 'sent', opened, ...(blocked ? { blocked } : {}) });
    }
    return out;
  }

  async function admit(rooms, door, rec, user) {
    const { priv } = rooms;
    const pub = rooms.pub || rec.pubRoom || null;
    for (const [room, must] of [[priv, true], [pub, false]]) {
      if (!room) continue;
      try {
        const st = await mx.roomState(room);
        const m = st.members && st.members[user];
        if (m !== 'join' && m !== 'invite') await mx.invite(room, user);
      } catch (e) { if (must) throw e; }
    }
    const cur = (await readSealed(priv, STATE.people, '')) || {};
    await putSealed(priv, STATE.people, '', { v: 1, names: { ...(cur.names || {}), [user]: rec.name } });
    // the grant is the only place the workspace key travels to a new member, sealed under a key only the link's
    // holder can derive; the homeserver sees a ciphertext and room ids it already knows
    const body = { v: 2, rooms: { priv, pub }, owner: mx.userId, user, ring: await ring.exportRing(priv) };
    await mx.sendEvent(door, EVT.grant, await sealGrant(rec.grant, body, { room: door, type: EVT.grant, key: '' }));
    await closeDoor(door, { keep: [user], alias: rec.alias });
    try { await mx.leave(door); } catch { /* the person is in the door; the grant is in its history and stays readable */ }
    await dropFromRegistry(priv, door);
    await linksSet(door, null);                                                     // the link has done its job
    say('ok', `${rec.name} joined.`);
    return { rooms: { priv, pub } };
  }

  async function outstanding({ rooms }) {
    if (!rooms || !rooms.priv) return [];
    const reg = await registry(rooms.priv), links = await linksAll();
    return Object.entries(reg).map(([door, r]) => ({ door, name: r.name, state: now() > r.exp ? 'expired' : 'sent', exp: r.exp, link: links[door] || '' }));
  }

  // ---------------------------------------------------------------- names, people, removal
  async function names(rooms) { const c = await readSealed(rooms.priv, STATE.people, ''); return (c && c.names) || {}; }
  async function setName({ rooms, user, name }) {
    const label = cleanName(name);
    if (!label) throw refuse(REFUSE.NameNeeded, 'a name cannot be empty', {});
    const cur = (await readSealed(rooms.priv, STATE.people, '')) || {};
    await putSealed(rooms.priv, STATE.people, '', { v: 1, names: { ...(cur.names || {}), [user]: label } });
  }
  async function people({ rooms }) {
    const st = await mx.roomState(rooms.priv);
    const nm = await names(rooms);
    const created = st.creator;
    return Object.entries(st.members || {}).filter(([, m]) => m === 'join' || m === 'invite')
      .map(([user, m]) => ({ user, name: nm[user] || '', owner: user === created, joined: m === 'join', self: user === mx.userId }));
  }
  async function remove({ rooms, user }) {
    const done = [];
    for (const room of [rooms.priv, rooms.pub].filter(Boolean)) { try { await mx.ban(room, user, 'removed'); done.push('banned'); } catch { done.push('not-banned'); } }
    // The person is out of the rooms, so they cannot read what is sent from here on. Give the remaining members the
    // next key (sealed under the one they hold), THEN move the sealed state onto it. The key is only adopted here
    // once its event is in the room, so a failed send never leaves this device on a key nobody else has.
    let rotated = false;
    if (await ring.has(rooms.priv)) {
      try {
        const plan = await ring.planRotation(rooms.priv);
        await mx.sendEvent(rooms.priv, EPOCH_EVENT, await ring.epochContent(rooms.priv, plan));
        await ring.add(rooms.priv, plan.next.key, plan.next.n);
        rotated = true; done.push('rotated');
      } catch { done.push('not-rotated'); }
    }
    const cur = (await readSealed(rooms.priv, STATE.people, '')) || {};
    const n = { ...(cur.names || {}) }; delete n[user];
    try { await putSealed(rooms.priv, STATE.people, '', { v: 1, names: n }); } catch { /* the ban is what matters */ }
    if (rotated) { try { await putRegistry(rooms.priv, await registry(rooms.priv)); } catch { /* resealed on the next write */ } }
    return done;
  }

  // ---------------------------------------------------------------- presence
  const lastBeat = new Map();
  const beatSentAt = new Map();
  async function announce({ rooms, viewing = '', title = '' }) {
    const room = rooms.priv;
    const sentAt = now();
    await prepare(room);
    const sealedBeat = await ring.sealFor(room, { v: 1, viewing: String(viewing || '').slice(0, 200), title: String(title || '').slice(0, 200) }, { type: EVT.presence, key: '', sender: mx.userId });
    const id = await mx.sendEvent(room, EVT.presence, sealedBeat);
    beatSentAt.set(id, sentAt);
    if (beatSentAt.size > 24) beatSentAt.delete(beatSentAt.keys().next().value);
    const prev = lastBeat.get(room);
    lastBeat.set(room, id);
    if (prev && typeof mx.redactEvent === 'function') { try { await mx.redactEvent(room, prev); } catch { /* the next beat tries again */ } }
    return id;
  }
  /** Who is here now and what they are looking at, under the names the owner gave. Judged in server time. */
  async function presence({ rooms, ttl = ONLINE_MS }) {
    const raw = await mx.readEvents(rooms.priv, { type: EVT.presence, limit: 200 });
    // open each beat with the sender it was sealed for; one that does not open (locked, moved, changed) is not a
    // person being here. With a key in hand, plaintext beats are ignored: they could be written by anyone.
    const haveKey = await ring.has(rooms.priv);
    const evs = [];
    for (const e of raw) {
      if (e && isSealed(e.content)) {
        try { evs.push({ ...e, content: await ring.openFor(rooms.priv, e.content, { type: EVT.presence, key: '', sender: e.sender }) }); }
        catch (er) { if (er && er.code === VCODE.Tampered) setProblem(er); }
      } else if (e && !haveKey) evs.push(e);
    }
    let offset = 0;
    for (const e of evs) { if (e.sender === mx.userId && beatSentAt.has(e.event_id)) offset = (Number(e.origin_server_ts) || 0) - beatSentAt.get(e.event_id); }
    const st = await mx.roomState(rooms.priv);
    const nm = await names(rooms);
    return onlineNow(evs, {
      type: EVT.presence, now: now() + offset, ttl, self: mx.userId,
      nameOf: (u) => nm[u] || null,
      roleOf: (u) => (u === st.creator ? 'owner' : st.members && st.members[u] === 'join' ? 'member' : null),
    });
  }

  // ---------------------------------------------------------------- the person with the link
  /**
   * Open the link: join the door, check it is the inviter's, say hello, and sign (door, this account) with the key in
   * the link. The person is NOT in until the owner's device has verified and the gate has confirmed.
   */
  async function open({ input }) {
    const p = parseWorkspaceInvite(input);
    if (!p) throw refuse(REFUSE.InviteNotFound, 'that is not an invite link', {});
    if (!p.secret || !p.from) throw refuse(REFUSE.LinkIncomplete, 'this link is incomplete — open the whole link you were sent', {});
    if (p.server && p.server !== mx.server) throw refuse(REFUSE.WrongServer, `this invitation is for an account on ${p.server}, and you are signed in on ${mx.server}`, { server: p.server });
    const door = await mx.resolveAlias(`#${p.alias}:${mx.server}`).catch(() => null);
    if (!door) throw refuse(REFUSE.InviteNotFound, 'no open invitation has that code (it may be used, cancelled or expired)', {});
    await mx.join(door);
    const st = await mx.roomState(door);
    if (st.creator !== p.from) {
      try { await mx.leave(door); } catch { /* already out */ }
      throw refuse(REFUSE.OwnerMismatch, `this door was not made by ${p.from}, who the link says invited you, so nothing was sent`, { creator: st.creator });
    }
    await mx.sendEvent(door, EVT.hello, { v: 1 });
    await mx.sendEvent(door, EVT.request, { v: 1, sig: await signInvite(p.secret, { door, user: mx.userId }) });
    return { door, owner: st.creator, state: 'waiting' };
  }

  /** Has the owner's device let me in? If so, join the rooms. */
  async function claim({ door, input = null }) {
    let st, evs;
    try { st = await mx.roomState(door); evs = await mx.readEvents(door); }
    catch { throw refuse(REFUSE.InviteClosed, 'this invitation was closed (used, cancelled or expired)', { door }); }
    if (!st.members || st.members[mx.userId] !== 'join') throw refuse(REFUSE.InviteClosed, 'this invitation was closed (used, cancelled or expired)', { door });
    const grants = evs.filter((e) => e.type === EVT.grant && e.sender === st.creator && e.content && e.decrypted !== false);
    if (!grants.length) throw refuse(REFUSE.NoGrantYet, 'the person who invited you has not let you in yet', { door });
    let body = null;
    const p = parseWorkspaceInvite(input);
    for (const g of grants.reverse()) {
      if (!isSealed(g.content)) { if (g.content.user === mx.userId) { body = g.content; break; } continue; }   // an older, unsealed grant
      if (!p || !p.secret) continue;
      try {
        const o = await openGrant(await deriveGrantKey(p.secret, p.alias), g.content, { room: door, type: EVT.grant, key: '' });
        if (o && o.user === mx.userId && o.owner === st.creator) { body = o; break; }
      } catch { /* not sealed for this link */ }
    }
    if (!body) {
      if (grants.some((e) => isSealed(e.content)) && (!p || !p.secret)) throw refuse(REFUSE.LinkIncomplete, 'open the whole link you were sent: it holds the key to read what the owner shared', { door });
      throw refuse(REFUSE.NoGrantYet, 'the person who invited you has not let you in yet', { door });
    }
    const rooms = body.rooms || {};
    if (!rooms.priv) throw refuse(REFUSE.NoRoom, 'the grant names no room', {});
    let vaultState = 'none';
    if (typeof body.ring === 'string') { await ring.importRing(body.ring, { scope: rooms.priv }); vaultState = 'ready'; }
    await mx.join(rooms.priv);
    if (rooms.pub) { try { await mx.join(rooms.pub); } catch { /* the public room is optional */ } }
    try { await mx.leave(door); } catch { /* the owner closes it anyway */ }
    return { rooms: { priv: rooms.priv, pub: rooms.pub || null }, owner: st.creator, vault: vaultState };
  }

  // ---------------------------------------------------------------- the owner's other devices
  /** The whole keyring as a string for the owner's other devices. Treat it like a password. */
  const deviceKey = async ({ rooms }) => ring.exportRing(rooms.priv);
  const useDeviceKey = async ({ text, rooms = null }) => ring.importRing(text, rooms && rooms.priv ? { scope: rooms.priv } : {});

  return { invite, revoke, sweep, outstanding, names, setName, people, remove, announce, presence, open, claim, status, deviceKey, useDeviceKey, problem: () => problem, mx };
}
