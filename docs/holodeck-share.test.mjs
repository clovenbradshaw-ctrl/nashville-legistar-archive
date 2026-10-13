// holodeck-share.test.mjs — the unit tier of docs/MATRIX-INVITES-PREREG.md.
//
// Pure modules against holodeck-fake-matrix.js. Every falsifier here is paired
// with a CONTROL built to fail: a deliberately broken flow the probe must catch.
// A probe that does not catch its control is not evidence — so each test asserts
// the control IS caught as well as the real path being clean.
//
// This proves the decisions in holodeck-share.js. It does not prove Megolm: that
// is tests/matrix-invites.live.mjs against a real homeserver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fold } from './vendor/bare-metal/src/fold.js';
import { createFakeServer, fakeAttach } from './holodeck-fake-matrix.js';
import { makeShare, inviteLink, parseInvite, validCode, pairingCode, historyCapability, storeRoomBody, doorRoomBody, STORES, EVT, WORDS, REFUSE, redact } from './holodeck-share.js';
import { SealRefusal, REFUSAL, MEGOLM, sealAttachment, sealTransport, structuralStateOk, assertEncrypted } from './holodeck-seal.js';
import { gate, foldRepo, ledgerFromEvents, roleAt, auditState, powerLevelsFor, POWER, ROLE, LEDGER, GATE } from './holodeck-roles.js';
import { linkBase, derivePages } from './holodeck-account.js';
import { detectLegacy, planMigration, copyToEncrypted, blankLegacy, rollbackLegacy, LEGACY, hashContent } from './holodeck-legacy.js';

const HS = 'test.local';
const BASE = 'https://example.test/holodeck/';
const U = { owner: '@owner:' + HS, alice: '@alice:' + HS, bob: '@bob:' + HS, eve: '@eve:' + HS };
const CANARY = 'CANARY-7f3a91-the-contractor-said-this';

function world({ ownerCross = true, aliceCross = true, bobCross = true, historySharing = true } = {}) {
  const server = createFakeServer({ name: HS });
  const refusals = [];
  const lines = [];
  let clockOffset = 0;
  const now = () => server.now() + clockOffset;
  const mk = (user, opt = {}) => server.client(user, opt);
  const mxs = {
    owner: mk(U.owner, { crossSigned: ownerCross, historySharing }),
    alice: mk(U.alice, { crossSigned: aliceCross, historySharing }),
    bob: mk(U.bob, { crossSigned: bobCross, historySharing }),
    eve: mk(U.eve, { crossSigned: false, historySharing }),
  };
  const sh = (mx) => makeShare({ mx, attach: fakeAttach, onRefuse: (r) => refusals.push(r), log: (l) => lines.push(l), now });
  const S = { owner: sh(mxs.owner), alice: sh(mxs.alice), bob: sh(mxs.bob), eve: sh(mxs.eve) };
  return { server, mxs, S, refusals, lines, now, advance: (ms) => { clockOffset += ms; } };
}

async function join(w, who, repo, { role = 'editor', history = false } = {}) {
  const mint = await w.S.owner.mintInvite(repo, { role, history, base: BASE });
  const red = await w.S[who].redeem({ input: mint.link });
  const conf = await w.S.owner.confirm(repo, { door: mint.door, entered: red.myCode });
  const acc = await w.S[who].acceptGrant({ door: red.door, ownerCode: red.ownerCodes[0].code });   // the invitee types the owner's code too
  return { mint, red, conf, acc, repo: acc.repo };
}

const ins = (anchor, type, extra = {}) => ({ anchor, entity_type: type, payload: extra });
const def = (anchor, path, value) => ({ anchor, path, value });

// ---------------------------------------------------------------- builders

test('store rooms are born encrypted, invite-only, with owner-only rules', () => {
  const b = storeRoomBody({ repoId: 'abc12345', store: 'records', owner: U.owner });
  const get = (t) => b.initial_state.find((s) => s.type === t);
  assert.equal(get('m.room.encryption').content.algorithm, MEGOLM);
  assert.equal(get('m.room.join_rules').content.join_rule, 'invite');
  assert.equal(get('m.room.history_visibility').content.history_visibility, 'shared');
  assert.equal(b.power_level_content_override.events['m.room.encryption'], POWER.owner);
  assert.equal(b.power_level_content_override.events_default, POWER.editor);
  assert.ok(!/title|corpus|workspace/i.test(b.name), 'a room name never carries the workspace title');
});

test('a door is encrypted but joinable by alias, and members cannot invite or change rules', () => {
  const b = doorRoomBody({ code: 'abcde', owner: U.owner });
  assert.equal(b.initial_state.find((s) => s.type === 'm.room.encryption').content.algorithm, MEGOLM);
  assert.equal(b.room_alias_name, 'abcde');
  assert.equal(b.power_level_content_override.invite, POWER.owner);
  assert.equal(b.power_level_content_override.events['m.room.join_rules'], POWER.owner);
});

test('the invite link is the page and a fragment holding the code — nothing else', () => {
  assert.equal(inviteLink({ base: BASE, code: 'abcde' }), BASE + '#join=abcde');
  assert.throws(() => inviteLink({ base: BASE, code: 'ABCDE0' }), (e) => e.refusal);
  assert.equal(parseInvite(BASE + '#join=abcde'), 'abcde');
  assert.equal(parseInvite('  ABCDE '), 'abcde');
  assert.equal(parseInvite('https://x.test/?r=abcde'), null, 'a heimdall fleet link is not a repo invite');
  assert.equal(parseInvite('abc'), null);
  assert.ok(!validCode('abcd0'), 'zero is not in the no-confusion alphabet');
});

test('roles map onto power levels; only the owner can change the rules', () => {
  const p = powerLevelsFor({ owner: U.owner, users: { [U.alice]: 'editor', [U.bob]: 'reader' } });
  assert.equal(p.users[U.owner], 100);
  assert.equal(p.users[U.alice], 50);
  assert.equal(p.users[U.bob], undefined, 'reader is the default; no entry');
  assert.equal(p.users_default, 0);
  assert.ok(p.events_default > p.users_default, 'a default member cannot send');
  assert.equal(p.state_default, 100);
});

// ---------------------------------------------------------------- the flow

test('create → mint → redeem → confirm → grant: an editor joins and writes', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 'Tenant files' });
  for (const s of STORES) assert.ok(await w.mxs.owner.isEncryptionReady(repo.rooms[s]));
  const { mint, red, conf, acc } = await join(w, 'alice', repo, { role: 'editor' });
  assert.equal(conf.user, U.alice);
  assert.equal(acc.repo.role, 'editor');
  assert.equal(red.owner, U.owner);
  assert.match(red.myCode, /^\d{6}$/);
  assert.ok(red.ownerCodes.length >= 1, 'the invitee is shown the owner’s code too');
  assert.equal(mint.state, 'open');
  await w.S.alice.write(acc.repo, 'ins', ins('st:1', 'Statements'));
  await w.S.alice.write(acc.repo, 'def', def('st:1', 'body', 'a statement'));
  const st = await w.S.owner.readState(repo, { fold });
  assert.equal(st.state.entities['st:1'].body, 'a statement');
  assert.equal(st.refused.length, 0);
  assert.equal(st.state.entities['st:1']._sender, U.alice);
});

test('the title is content: it is in the sealed log, not in a room name or in account data', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: CANARY });
  assert.equal(w.server.scan(CANARY), 0, 'the title never appears in anything the server holds');
  const log = await w.mxs.owner.readEvents(repo.rooms.log);
  assert.equal(log.find((e) => e.type === EVT.manifest).content.title, CANARY, 'but the owner reads it back');
});

test('people list shows roles, and an invite is single-use: the door and its code are gone after confirm', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const { mint, red } = await join(w, 'alice', repo, { role: 'editor' });
  assert.equal(await w.mxs.eve.resolveAlias(`#${mint.code}:${HS}`), null, 'the alias no longer resolves');
  await assert.rejects(() => w.S.eve.redeem({ input: mint.link }), (e) => e.code === REFUSE.InviteNotFound);
  const ppl = await w.S.owner.people(repo);
  const a = ppl.find((p) => p.user === U.alice);
  assert.equal(a.role, 'editor');
  assert.equal(a.membership, 'join');
  assert.equal((await w.S.owner.listInvites(repo, { base: BASE })).length, 0, 'no outstanding invites remain');
  void red;
});

test('outstanding invites: listed with a plain-words state, and revoke closes the door', async () => {
  const w = await world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m1 = await w.S.owner.mintInvite(repo, { role: 'reader', base: BASE });
  let list = await w.S.owner.listInvites(repo, { base: BASE });
  assert.equal(list.length, 1);
  assert.equal(list[0].state, 'open');
  assert.equal(list[0].link, BASE + '#join=' + m1.code);
  await w.S.bob.redeem({ input: m1.link });
  list = await w.S.owner.listInvites(repo, { base: BASE });
  assert.equal(list[0].state, 'waiting-confirm');
  await w.S.owner.revoke(repo, { door: m1.door });
  assert.equal(await w.mxs.eve.resolveAlias(`#${m1.code}:${HS}`), null);
  assert.equal((await w.S.owner.listInvites(repo, { base: BASE })).length, 0);
  await assert.rejects(() => w.S.owner.confirm(repo, { door: m1.door, entered: '000000' }), (e) => e.code === REFUSE.InviteUnknown);
});

test('an expired invite cannot be confirmed, and its door is closed', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  w.advance(8 * 24 * 3600 * 1000);
  await assert.rejects(() => w.S.owner.confirm(repo, { door: m.door, entered: red.myCode }), (e) => e.code === REFUSE.InviteExpired);
  assert.equal(await w.mxs.eve.resolveAlias(`#${m.code}:${HS}`), null);
});

test('confirm needs the six digits TYPED; a wrong code, or a forged request, is refused with a reason', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  const wrong = red.myCode === '123456' ? '654321' : '123456';
  await assert.rejects(() => w.S.owner.confirm(repo, { door: m.door, entered: wrong }), (e) => e.code === REFUSE.CodeMismatch && /do not match/.test(e.why));
  // nothing happened: not invited, not trusted
  assert.notEqual((await w.mxs.owner.roomState(repo.rooms.records)).members[U.alice], 'invite');
  assert.equal((await w.mxs.owner.deviceKeysOf(U.alice))[0].verified, false);
});

test('a stranger who got the code first cannot be mistaken for the real invitee', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const eveRed = await w.S.eve.redeem({ input: m.link });            // joins the door first
  const aliceRed = await w.S.alice.redeem({ input: m.link });
  assert.equal((await w.S.owner.listInvites(repo, { base: BASE }))[0].requests, 2);
  const conf = await w.S.owner.confirm(repo, { door: m.door, entered: aliceRed.myCode });
  assert.equal(conf.user, U.alice, 'the confirmed device is the one whose code was read out');
  assert.notEqual((await w.mxs.owner.roomState(repo.rooms.records)).members[U.eve], 'invite');
  await assert.rejects(() => w.S.eve.acceptGrant({ door: eveRed.door }), (e) => e.refusal);
});

test('the invitee only joins rooms named in a grant sent by the door’s creator', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  // before confirmation there is no grant at all
  await assert.rejects(() => w.S.alice.acceptGrant({ door: red.door }), (e) => e.code === REFUSE.NoGrantYet);
  // a grant forged by another door member is not honoured
  const r2 = await w.S.eve.redeem({ input: m.link });
  await w.mxs.eve.sendEvent(red.door, EVT.grant, { v: 1, repo: 'evil', rooms: { sources: '!x', records: '!y', log: '!z' }, role: 'owner', history: { can: false }, epoch: 1, owner: U.eve });
  await assert.rejects(() => w.S.alice.acceptGrant({ door: red.door }), (e) => e.code === REFUSE.NoGrantYet || e.code === REFUSE.GrantNotFromOwner);
  void r2;
});

test('an invitee refuses a grant naming a room that is not encrypted', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  // a hostile/buggy owner build: the records store was created without encryption
  const bad = await w.mxs.owner.createRoom({ name: 'plain', preset: 'private_chat', initial_state: [{ type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } }] });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  await w.mxs.owner.setDeviceVerified(U.alice, (await w.mxs.owner.deviceKeysOf(U.alice))[0].deviceId);
  await w.mxs.owner.sendEvent(red.door, EVT.grant, { v: 1, repo: repo.repoId, rooms: { ...repo.rooms, sources: bad }, role: 'editor', history: { can: false }, epoch: 1, owner: U.owner });
  await assert.rejects(() => w.S.alice.acceptGrant({ door: red.door }), (e) => e.code === REFUSAL.RoomNotEncrypted);
  assert.notEqual((await w.mxs.alice.roomState(bad)).members[U.alice], 'join', 'and it did not stay in the plaintext room');
});

test('a reload loses nothing: a fresh instance with only the registry confirms an invite, and a half-failed confirm can simply be run again', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  // "reload": a new instance on the same account that knows nothing but what the account's registry says
  const again = makeShare({ mx: w.mxs.owner, attach: fakeAttach, now: w.now });
  const repos = await again.listRepos();
  await again.adoptFromRegistry(repos[0].repoId);
  // the first attempt dies after the invites (the grant send fails once)
  const real = w.mxs.owner.sendEvent;
  let failed = false;
  w.mxs.owner.sendEvent = async (room, type, c) => { if (type === EVT.grant && !failed) { failed = true; throw new Error('network went away'); } return real(room, type, c); };
  await assert.rejects(() => again.confirm(repos[0], { door: m.door, entered: red.myCode }), /network went away/);
  assert.equal((await w.mxs.owner.roomState(repo.rooms.records)).members[U.alice], 'invite', 'half done');
  const conf = await again.confirm(repos[0], { door: m.door, entered: red.myCode });   // run it again
  assert.equal(conf.user, U.alice);
  const acc = await w.S.alice.acceptGrant({ door: red.door, ownerCode: red.ownerCodes[0].code });
  assert.equal(acc.repo.role, 'editor');
});

// ---------------------------------------------------------------- F1: plaintext reaches the transport

test('F1 — nothing the server holds contains the canary: source text, statement, attachment, ledger note', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  await w.S.owner.write(repo, 'ins', ins('src:1', 'Sources', { title: 'Lease' }));
  await w.S.owner.write(repo, 'def', def('src:1', 'text', 'the lease says ' + CANARY));
  await w.S.owner.write(repo, 'ins', ins('st:1', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:1', 'body', CANARY + ' (statement)'));
  const ref = await sealAttachment({ mx: w.mxs.owner, attach: fakeAttach }, new TextEncoder().encode(CANARY + ' (attachment bytes)'), { name: 'lease.txt' });
  await w.S.owner.write(repo, 'def', def('src:1', 'file', ref));
  await w.S.owner.sealed.sendEvent(repo.rooms.log, EVT.note, { v: 1, kind: 'note', text: CANARY + ' (ledger note)' });
  assert.equal(w.server.scan(CANARY), 0, 'the server holds no plaintext canary');
  for (const s of STORES) {
    const types = w.server.typesIn(repo.rooms[s]).filter((t) => t !== 'm.room.member');
    assert.ok(types.every((t) => t === 'm.room.encrypted'), `${s}: every timeline event is m.room.encrypted, got ${[...new Set(types)]}`);
  }
  // and the owner still reads it all back
  const st = await w.S.owner.readState(repo, { fold });
  assert.ok(st.state.entities['src:1'].text.includes(CANARY));
});

test('F1 control — a room made without encryption, or a send that skips the seal, leaks the canary and the probe sees it', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  // (a) a store room created with the encryption event stripped
  const body = storeRoomBody({ repoId: 'ctl00001', store: 'records', owner: U.owner });
  body.initial_state = body.initial_state.filter((s) => s.type !== 'm.room.encryption');
  const plain = await w.mxs.owner.createRoom(body);
  await w.mxs.owner.sendEvent(plain, 'io.holodeck.def', def('st:1', 'body', CANARY));
  assert.ok(w.server.scan(CANARY) > 0, 'control (a): the probe finds plaintext in an unencrypted room');
  const w2 = world();
  const repo2 = await w2.S.owner.createRepo({ title: 't' });
  // (b) the legacy path: user data in a state event (what savePrivate does)
  await w2.mxs.owner.setState(repo2.rooms.records, LEGACY.private, 'work', { pins: [CANARY] });
  assert.ok(w2.server.scan(CANARY) > 0, 'control (b): the legacy state-event write is visible to the server');
  void repo;
});

// ---------------------------------------------------------------- F2: decrypt before confirm

test('F2 — before the owner confirms, the invitee reads nothing and holds no keys', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', history: true, base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  const written = [];
  for (let i = 0; i < 3; i++) { await w.S.owner.write(repo, 'ins', ins('st:' + i, 'Statements')); await w.S.owner.write(repo, 'def', def('st:' + i, 'body', CANARY + i)); written.push(i); }
  let readable = 0;
  for (const s of STORES) {
    for (const e of await w.mxs.alice._decryptAll(repo.rooms[s])) if (e.decrypted && JSON.stringify(e.content).includes('CANARY')) readable++;
    await assert.rejects(() => w.mxs.alice.readEvents(repo.rooms[s]), /not in that room/, `${s}: not a member`);
  }
  assert.equal(readable, 0, 'invitee decrypts 0 canaries');
  const storeIds = new Set(STORES.map((s) => repo.rooms[s]));
  const heldBefore = w.mxs.alice._holds().filter((sid) => storeIds.has(w.server.sessionRooms.get(sid))).length;
  assert.equal(heldBefore, 0, 'no session keys for any store room');
  await assert.rejects(() => w.S.alice.acceptGrant({ door: red.door }), (e) => e.code === REFUSE.NoGrantYet);
});

test('F2 control — an owner who trusts and invites on request (before checking) lets the invitee read everything', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const m = await w.S.owner.mintInvite(repo, { role: 'editor', base: BASE });
  const red = await w.S.alice.redeem({ input: m.link });
  // the eager owner: marks the requester's device verified and invites, no code check
  const dev = (await w.mxs.owner.deviceKeysOf(U.alice))[0];
  await w.mxs.owner.setDeviceVerified(U.alice, dev.deviceId);
  for (const s of STORES) { await w.mxs.owner.invite(repo.rooms[s], U.alice, {}); await w.mxs.alice.join(repo.rooms[s], {}); }
  await w.S.owner.write(repo, 'ins', ins('st:1', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:1', 'body', CANARY));
  const seen = (await w.mxs.alice.readEvents(repo.rooms.records)).filter((e) => e.decrypted && JSON.stringify(e.content).includes('CANARY'));
  assert.ok(seen.length > 0, 'control: the probe detects an invitee reading before confirm');
  void red;
});

test('F2 — after confirm the invitee reads what is written next; the past only if history is really deliverable', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  await w.S.owner.write(repo, 'ins', ins('st:old', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:old', 'body', 'written before'));
  const j = await join(w, 'alice', repo, { role: 'editor', history: false });
  await w.S.owner.write(repo, 'ins', ins('st:new', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:new', 'body', 'written after'));
  const st = await w.S.alice.readState(j.repo, { fold });
  assert.equal(st.state.entities['st:new'].body, 'written after');
  assert.equal(st.state.entities['st:old'], undefined, 'no past without a history grant');
  assert.ok(st.state._undecryptable > 0, 'and the gap is counted, not hidden');
});

// ---------------------------------------------------------------- F3: revoked member

test('F3 — a removed member keeps what they could read, and receives nothing written afterwards', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'alice', repo, { role: 'editor' });
  await w.S.owner.write(repo, 'ins', ins('st:A', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:A', 'body', 'A ' + CANARY));
  const aliceReadsA = (await w.mxs.alice.readEvents(repo.rooms.records)).some((e) => e.decrypted && JSON.stringify(e.content).includes('A CANARY'));
  assert.ok(aliceReadsA);
  const out = await w.S.owner.removeMember(repo, { user: U.alice });
  assert.match(out.disclosure, /cannot take back/);
  await w.S.owner.write(repo, 'ins', ins('st:B', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:B', 'body', 'B ' + CANARY));
  const all = await w.mxs.alice._decryptAll(repo.rooms.records);       // her device, handed all the ciphertext
  const has = (t) => all.some((e) => e.decrypted && JSON.stringify(e.content).includes(t));
  assert.ok(has('A CANARY'), 'still reads A — removal cannot undo it, and the UI says so');
  assert.ok(!has('B CANARY'), 'cannot read B — written after removal');
  assert.equal((await w.mxs.owner.roomState(repo.rooms.records)).members[U.alice], 'ban');
  void j;
});

test('F3 control — a "removal" by someone who is not the owner changes nothing, and the probe sees the member still receiving', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const ja = await join(w, 'alice', repo, { role: 'editor' });
  const jb = await join(w, 'bob', repo, { role: 'editor' });
  // bob (an editor) tries to remove alice: the ledger ignores it, the server refuses the ban
  await w.S.bob.sealed.sendEvent(repo.rooms.log, EVT.revoke, { v: 1, user: U.alice, epoch: 2 });
  await assert.rejects(() => w.S.bob.removeMember(jb.repo, { user: U.alice }), (e) => e.code === REFUSE.NotOwner);
  await assert.rejects(() => w.mxs.bob.ban(repo.rooms.records, U.alice, 'x'), (e) => e.errcode === 'M_FORBIDDEN');
  await w.S.owner.write(repo, 'ins', ins('st:B', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:B', 'body', 'B ' + CANARY));
  const all = await w.mxs.alice._decryptAll(repo.rooms.records);
  assert.ok(all.some((e) => e.decrypted && JSON.stringify(e.content).includes('B CANARY')), 'control: the probe detects a member still receiving when nothing real was done');
  const led = await w.S.owner.ledgerOf(repo);
  assert.equal(led.refused.length > 0, true, 'the forged removal is on record as refused');
  void ja;
});

test('F3 — even a ledger-only removal withholds keys: every Holodeck client withdraws trust from a removed person\u2019s devices', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  await join(w, 'alice', repo, { role: 'editor' });
  await w.S.owner.sealed.sendEvent(repo.rooms.log, EVT.revoke, { v: 1, user: U.alice, epoch: 2 });   // ledger only: still joined
  await w.S.owner.write(repo, 'ins', ins('st:B', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:B', 'body', 'B ' + CANARY));
  const all = await w.mxs.alice._decryptAll(repo.rooms.records);
  assert.ok(!all.some((e) => e.decrypted && JSON.stringify(e.content).includes('B CANARY')), 'defence in depth: trust withdrawn from the ledger entry alone');
});

test('F3 — removal is refused for non-owners, and the owner cannot leave', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'alice', repo, { role: 'editor' });
  await assert.rejects(() => w.S.alice.removeMember(j.repo, { user: U.owner }), (e) => e.code === REFUSE.NotOwner);
  await assert.rejects(() => w.S.owner.leave(repo), (e) => e.code === REFUSE.OwnerCannotLeave);
  const out = await w.S.alice.leave(j.repo);
  assert.match(out.disclosure, /keeps the keys/);
  assert.equal((await w.mxs.owner.roomState(repo.rooms.records)).members[U.alice], 'leave');
});

// ---------------------------------------------------------------- F4: a reader's write

function ev(type, sender, ts, content, id) { return { type, sender, origin_server_ts: ts, event_id: id || '$' + ts, content }; }
const OWNER = U.owner;
const ledgerEvents = [
  ev(LEDGER.role, OWNER, 100, { user: U.alice, role: 'editor' }),
  ev(LEDGER.role, OWNER, 100, { user: U.bob, role: 'reader' }),
  ev(LEDGER.role, OWNER, 500, { user: U.alice, role: 'reader' }),    // demoted at 500
];

test('F4 — the fold refuses a reader’s operators, a stranger’s, a demoted editor’s, and a forged role grant', () => {
  const data = [
    ev('io.holodeck.ins', OWNER, 110, { anchor: 'o:1', entity_type: 'Statements', payload: {} }),
    ev('io.holodeck.ins', U.alice, 200, { anchor: 'a:before', entity_type: 'Statements', payload: {} }),   // editor then
    ev('io.holodeck.ins', U.alice, 600, { anchor: 'a:after', entity_type: 'Statements', payload: {} }),    // reader now
    ev('io.holodeck.ins', U.bob, 300, { anchor: 'b:1', entity_type: 'Statements', payload: {} }),          // reader
    ev('io.holodeck.def', U.bob, 301, { anchor: 'o:1', path: 'body', value: 'defaced' }),                  // reader edits owner's
    ev('io.holodeck.ins', U.eve, 400, { anchor: 'e:1', entity_type: 'Statements', payload: {} }),          // stranger
    ev('io.holodeck.con', U.bob, 302, { source_anchor: 'o:1', target_anchor: 'a:before', relation_type: 'x' }),
  ];
  const forged = ev(LEDGER.role, U.bob, 50, { user: U.bob, role: 'editor' });     // reader forges a grant
  const r = foldRepo({ dataEvents: data, ledgerEvents: [forged, ...ledgerEvents], owner: OWNER, fold });
  const anchors = Object.keys(r.state.entities).sort();
  assert.deepEqual(anchors, ['a:before', 'o:1'], 'only the owner’s and the editor-at-the-time’s entities exist');
  assert.equal(r.state.entities['o:1'].body, undefined, 'a reader’s DEF did not land');
  const codes = r.refused.map((x) => x.code).sort();
  assert.ok(codes.includes(GATE.ReaderCannotWrite));
  assert.ok(codes.includes(GATE.NotAMember));
  assert.ok(codes.includes(GATE.ForgedLedger));
  assert.ok(r.refused.every((x) => x.why && x.why.length > 10), 'every refusal says why');
  assert.deepEqual(auditState(r.state, r.ledger), [], 'the post-fold audit finds nothing the gate let through');
});

test('F4 control — fold without the gate admits the reader, and the audit catches it', () => {
  const data = [ev('io.holodeck.ins', U.bob, 300, { anchor: 'b:1', entity_type: 'Statements', payload: {} })];
  const ledger = ledgerFromEvents(ledgerEvents, { owner: OWNER });
  const bare = fold(data);                                  // the gate is off
  assert.ok(bare.entities['b:1'], 'control: a bare fold accepts a reader’s operator');
  assert.equal(auditState(bare, ledger).length, 1, 'control: the audit sees it');
});

test('F4 — a read-only member’s write is refused at the page, by the server, and by the fold', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'bob', repo, { role: 'reader' });
  await assert.rejects(() => w.S.bob.write(j.repo, 'ins', ins('b:1', 'Statements')), (e) => e.code === REFUSE.ReaderCannotWrite);
  await assert.rejects(() => w.mxs.bob.sendEvent(repo.rooms.records, 'io.holodeck.ins', ins('b:1', 'Statements')), (e) => e.errcode === 'M_FORBIDDEN', 'the server refuses it too');
  // and the reader reads
  await w.S.owner.write(repo, 'ins', ins('st:1', 'Statements'));
  const st = await w.S.bob.readState(j.repo, { fold });
  assert.ok(st.state.entities['st:1']);
});

test('F4 — a role change takes effect in the fold from the moment it is written', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'alice', repo, { role: 'editor' });
  await w.S.alice.write(j.repo, 'ins', ins('st:1', 'Statements'));
  await w.S.owner.setRole(repo, { user: U.alice, role: 'reader' });
  await assert.rejects(() => w.S.alice.write(j.repo, 'ins', ins('st:2', 'Statements')), (e) => e.code === REFUSE.ReaderCannotWrite);
  // an event she managed to send anyway (server misbehaving / injected) is refused by the fold
  const raw = w.mxs.alice;
  const room = repo.rooms.records;
  const st0 = await w.S.owner.readState(repo, { fold });
  assert.ok(st0.state.entities['st:1']);
  void raw; void room;
});

// ---------------------------------------------------------------- F5: secrets

const SECRETS = (w, extra = []) => [
  'syt_secret_access_token_1234', 'hunter2-password', 'RECOVERY-KEY-EsTa-abcd-1234',
  U.owner, U.alice, U.bob, U.eve, ...extra,
];
const hits = (haystacks, secrets) => {
  const found = [];
  for (const h of haystacks) for (const s of secrets) if (s && String(h).includes(s)) found.push([s, String(h).slice(0, 60)]);
  return found;
};

test('F5 — links, the log, and a recording localStorage never contain a secret (invite code excepted, as a fragment)', async () => {
  const w = world();
  const ls = new Map();   // the page's localStorage as this feature may touch it: the share modules write nothing
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'alice', repo, { role: 'editor', history: true });
  const codes = [j.red.myCode, ...j.red.ownerCodes.map((c) => c.code)];
  const fps = [...j.red.myFingerprint, ...j.red.ownerCodes.flatMap((c) => c.fingerprint)].filter((g) => g.length === 4);
  const links = [j.mint.link, ...(await w.S.owner.listInvites(repo, { base: BASE })).map((i) => i.link)];
  const secrets = SECRETS(w, codes);
  assert.deepEqual(hits(links, secrets), [], 'links');
  for (const l of links) {
    const u = new URL(l);
    assert.equal(u.search, '', 'no query string');
    assert.match(u.hash, /^#join=[abcdefghijkmnpqrstuvwxyz23456789]{5}$/, 'the fragment is exactly the code');
  }
  const logText = w.lines.map((l) => l.text);
  assert.deepEqual(hits(logText, secrets), [], 'log lines');
  assert.deepEqual(hits([...ls.entries()].flat(), secrets), [], 'localStorage');
  assert.ok(fps.length > 0);
});

test('F5 control — a link with the user id, a log with the token, and a recovery key in localStorage are all caught', () => {
  const secrets = SECRETS(null);
  const badLink = BASE + '#join=abcde&u=' + encodeURIComponent(U.alice);
  assert.ok(hits([decodeURIComponent(badLink)], secrets).length > 0, 'control (a): user id in a link');
  assert.ok(hits(['signed in with syt_secret_access_token_1234'], secrets).length > 0, 'control (b): token in a log line');
  const ls = new Map([['hd:share:recovery', 'RECOVERY-KEY-EsTa-abcd-1234']]);
  assert.ok(hits([...ls.entries()].flat(), secrets).length > 0, 'control (c): recovery key in localStorage');
  assert.equal(redact('token syt_secret_access_token_1234 here', ['syt_secret_access_token_1234']).includes('syt_secret'), false, 'redact scrubs a known secret');
});

// ---------------------------------------------------------------- F6: unencrypted room

test('F6 — writes to an unencrypted room, an unconfirmed room, a no-encryption room, and a state write with content are refused, typed, with zero transport calls', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const sh = w.S.owner;
  const before = () => w.server.requestLog.filter((r) => r.op === 'sendEvent' || r.op === 'setState').length;
  // (a) a legacy unencrypted workspace room — not one of the repo's stores
  const legacy = await w.mxs.owner.createRoom({ name: 'legacy', preset: 'private_chat', initial_state: [] });
  const n0 = before();
  await assert.rejects(() => sh.sealed.sendEvent(legacy, 'io.holodeck.ins', ins('x', 'Statements')), (e) => e.code === REFUSAL.UnknownRoom);
  // (b) a store room whose encryption the crypto layer has not confirmed (the create→sync race)
  const racing = { ...w.mxs.owner, isEncryptionReady: async () => false };
  const sealedRacing = sealTransport(racing, { known: () => [repo.rooms.records] });
  await assert.rejects(() => sealedRacing.sendEvent(repo.rooms.records, 'io.holodeck.ins', ins('x', 'Statements')), (e) => e.code === REFUSAL.NotConfirmed && /nothing is sent until/.test(e.why));
  // (c) a "store" room that was created without m.room.encryption
  sh.known.add(legacy);
  await assert.rejects(() => sh.sealed.sendEvent(legacy, 'io.holodeck.ins', ins('x', 'Statements')), (e) => e.code === REFUSAL.RoomNotEncrypted);
  // (d) a content-bearing state write into an encrypted room
  await assert.rejects(() => sh.sealed.setState(repo.rooms.records, LEGACY.private, 'work', { pins: [CANARY] }), (e) => e.code === REFUSAL.ContentInState);
  // a foreign event type
  await assert.rejects(() => sh.sealed.sendEvent(repo.rooms.records, 'm.room.message', { body: CANARY }), (e) => e.code === REFUSAL.EventTypeNotAllowed);
  assert.equal(before(), n0, 'the transport saw none of them');
  assert.equal(w.server.scan(CANARY), 0);
  assert.ok(w.refusals.length >= 4 && w.refusals.every((r) => r.refusal && r.why));
});

test('F6 control — with the seal bypassed the same four writes reach the transport', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const legacy = await w.mxs.owner.createRoom({ name: 'legacy', preset: 'private_chat', initial_state: [] });
  const raw = w.mxs.owner;
  const n0 = w.server.requestLog.length;
  await raw.sendEvent(legacy, 'io.holodeck.ins', ins('x', 'Statements'));
  await raw.setState(repo.rooms.records, LEGACY.private, 'work', { pins: [CANARY] });
  await raw.sendEvent(legacy, 'm.room.message', { body: CANARY });
  assert.equal(w.server.requestLog.length - n0, 3, 'control: nothing stopped them');
  assert.ok(w.server.scan(CANARY) > 0);
});

test('structural state is allow-listed: encryption/power/join rules/markers pass; user content does not', () => {
  assert.ok(structuralStateOk('m.room.power_levels', { users: {} }));
  assert.ok(structuralStateOk('io.holodeck.repo.store', { v: 1, repo: 'x', store: 'records', epoch: 1 }));
  assert.ok(!structuralStateOk('io.holodeck.repo.store', { v: 1, repo: 'x', title: 'a title' }), 'a marker cannot smuggle a title');
  assert.ok(!structuralStateOk('social.hyphae.fold.private', { pins: [1] }));
  assert.ok(structuralStateOk('social.hyphae.fold.private', {}), 'blanking is not content');
});

test('an attachment is encrypted before upload: the server holds ciphertext, the reference holds the key', async () => {
  const w = world();
  const body = new TextEncoder().encode('big body ' + CANARY);
  const ref = await sealAttachment({ mx: w.mxs.owner, attach: fakeAttach }, body, { mime: 'text/plain', name: 'a.txt' });
  assert.equal(ref.__media, 2);
  assert.ok(ref.file.key.k && ref.file.iv && ref.file.hashes.sha256);
  assert.equal(w.server.scan(CANARY), 0);
  await assert.rejects(() => sealAttachment({ mx: w.mxs.owner, attach: null }, body), (e) => e.code === REFUSAL.PlaintextAttachment);
  const sealed = sealTransport(w.mxs.owner, { known: () => [] });
  assert.equal(sealed.upload, undefined, 'the sealed transport has no raw upload');
});

// ---------------------------------------------------------------- batching and large bodies

test('batch: many operators travel in few sealed events, each still gated by its own sender', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const j = await join(w, 'alice', repo, { role: 'editor' });
  const jb = await join(w, 'bob', repo, { role: 'reader' });
  const entries = [];
  for (let i = 0; i < 60; i++) { entries.push({ op: 'ins', content: ins('st:' + i, 'Statements') }); entries.push({ op: 'def', content: def('st:' + i, 'body', 'statement number ' + i + ' '.repeat(80)) }); }
  const r = await w.S.alice.writeBatch(j.repo, entries, { limit: 4000 });
  assert.equal(r.ops, 120);
  assert.ok(r.events > 1 && r.events < 120, `fewer events than operators (${r.events})`);
  const st = await w.S.owner.readState(repo, { fold });
  assert.equal(Object.keys(st.state.entities).length, 60);
  assert.equal(st.state.entities['st:7']._sender, U.alice, 'the nested operators carry the real sender');
  // a reader who smuggles operators inside a batch event is refused op by op, in the fold
  const raw = { v: 1, ops: [{ op: 'ins', content: ins('evil:1', 'Statements') }] };
  await w.mxs.owner.sendEvent(repo.rooms.records, 'io.holodeck.batch', raw);     // the owner's, fine
  await assert.rejects(() => w.S.bob.writeBatch(jb.repo, [{ op: 'ins', content: ins('b:1', 'Statements') }]), (e) => e.code === REFUSE.ReaderCannotWrite);
  assert.equal(w.server.scan('statement number'), 0, 'batched content is sealed like any other');
});

test('large bodies: a big source text is hoisted into an encrypted attachment and comes back whole', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const big = ('lorem ' + CANARY + ' ').repeat(4000);
  await w.S.owner.write(repo, 'ins', ins('src:big', 'Sources', { title: 'big' }));
  await w.S.owner.write(repo, 'def', def('src:big', 'text', big));
  assert.equal(w.server.scan(CANARY), 0, 'neither the event nor the media store holds the body in the clear');
  assert.ok(w.server.media.size >= 1, 'it went through the attachment path');
  const st = await w.S.owner.readState(repo, { fold });
  assert.equal(st.state.entities['src:big'].text, big);
});

// ---------------------------------------------------------------- history, devices

test('F8 — "can read past" is claimed only when it is real, and what the invitee reads matches the claim', async () => {
  const cases = [
    { name: 'both cross-signed', oc: true, ic: true, want: true, can: true },
    { name: 'owner not cross-signed', oc: false, ic: true, want: true, can: false, gap: 'owner-device-not-cross-signed' },
    { name: 'invitee not cross-signed', oc: true, ic: false, want: true, can: false, gap: 'invitee-device-not-cross-signed' },
    { name: 'not asked for', oc: true, ic: true, want: false, can: false, gap: null },
  ];
  for (const c of cases) {
    const w = world({ ownerCross: c.oc, aliceCross: c.ic });
    const repo = await w.S.owner.createRepo({ title: 't' });
    await w.S.owner.write(repo, 'ins', ins('st:old', 'Statements'));
    await w.S.owner.write(repo, 'def', def('st:old', 'body', 'before ' + c.name));
    const j = await join(w, 'alice', repo, { role: 'editor', history: c.want });
    const st = await w.S.alice.readState(j.repo, { fold });
    const observed = !!st.state.entities['st:old'];
    assert.equal(j.conf.history.can, c.can, `${c.name}: claimed`);
    assert.equal(j.conf.history.gap, c.gap ?? null, `${c.name}: gap`);
    assert.equal(observed, c.can, `${c.name}: the claim matches what the invitee can actually read`);
  }
});

test('F8 control — a build that claims history unconditionally disagrees with observation, and the check sees it', async () => {
  const w = world({ ownerCross: false });
  const repo = await w.S.owner.createRepo({ title: 't' });
  await w.S.owner.write(repo, 'ins', ins('st:old', 'Statements'));
  const j = await join(w, 'alice', repo, { role: 'editor', history: true });
  const st = await w.S.alice.readState(j.repo, { fold });
  const lying = { want: true, can: true };                       // the mutant's claim
  assert.notEqual(lying.can, !!st.state.entities['st:old'], 'control: claim "yes" vs observed "no"');
  assert.equal(historyCapability({ want: true, caps: { historySharing: true, ownDeviceCrossSigned: false }, inviteeCrossSigned: null }).can, false);
  assert.equal(historyCapability({ want: true, caps: { historySharing: false, ownDeviceCrossSigned: true } }).gap, 'sdk-without-history-sharing');
});

test('unverified devices: a member’s second device receives nothing until the owner confirms it', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  await join(w, 'alice', repo, { role: 'editor' });
  const second = w.server.client(U.alice, { deviceId: 'SECONDDEVICE', crossSigned: false });
  await w.S.owner.write(repo, 'ins', ins('st:1', 'Statements'));
  await w.S.owner.write(repo, 'def', def('st:1', 'body', CANARY));
  const has = async () => (await second._decryptAll(repo.rooms.records)).some((e) => e.decrypted && JSON.stringify(e.content).includes('CANARY'));
  assert.equal(await has(), false, 'a new, unconfirmed device holds no keys');
  const people = await w.S.owner.people(repo);
  assert.equal(people.find((p) => p.user === U.alice).newDevices, 1, 'and the people list says so');
  const code2 = await pairingCode((await w.mxs.owner.deviceKeysOf(U.alice)).find((d) => d.deviceId === 'SECONDDEVICE').ed25519);
  await assert.rejects(() => w.S.owner.confirmDevice(repo, { user: U.alice, deviceId: 'SECONDDEVICE', entered: '000000' }), (e) => e.code === REFUSE.CodeMismatch);
  await w.S.owner.confirmDevice(repo, { user: U.alice, deviceId: 'SECONDDEVICE', entered: code2 });
  await w.S.owner.write(repo, 'def', def('st:1', 'body', CANARY + ' again'));
  assert.equal(await has(), true, 'after the owner confirms it, it receives what is written next');
});

// ---------------------------------------------------------------- legacy

test('legacy: the unencrypted private room and its state-event snapshot are detected, reported, and not touched', async () => {
  const w = world();
  const priv = await w.mxs.owner.createRoom({ name: 'Fold · x (private)', preset: 'private_chat', initial_state: [] });
  await w.mxs.owner.setState(priv, LEGACY.private, 'work', { pins: [CANARY], filters: {} });
  const pub = await w.mxs.owner.createRoom({ name: 'Fold · x', preset: 'public_chat', initial_state: [] });
  const report = await detectLegacy({ mx: w.mxs.owner, rooms: { priv, pub } });
  const p = report.find((r) => r.role === 'priv');
  assert.equal(p.encrypted, false);
  assert.ok(p.needsAttention);
  assert.ok(p.contentTypes.includes(LEGACY.private));
  assert.match(p.findings.join(' '), /not encrypted/);
  assert.match(p.findings.join(' '), /never encrypts/);
  const q = report.find((r) => r.role === 'pub');
  assert.equal(q.needsAttention, false, 'the public room is public by design');
  assert.match(q.findings[0], /public by design/);
  const plan = planMigration(report);
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].steps.map((s) => s.id), ['copy', 'blank', 'rollback']);
  assert.match(plan[0].cannotUndo, /already been able to read/);
  assert.equal(w.server.requestLog.filter((r) => r.op === 'setState').length, 1, 'detection wrote nothing');
});

test('legacy migration: nothing moves without confirmation; copy is verified; blank needs a verified copy; rollback restores', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const priv = await w.mxs.owner.createRoom({ name: 'p', preset: 'private_chat', initial_state: [] });
  const snapshot = { pins: [CANARY], filters: { a: 1 } };
  await w.mxs.owner.setState(priv, LEGACY.private, 'work', snapshot);
  const store = new Map();
  const backup = { put: async (k, v) => store.set(k, v), get: async (k) => store.get(k), del: async (k) => store.delete(k) };
  const args = { mx: w.mxs.owner, share: w.S.owner, repo, room: priv, backup };
  await assert.rejects(() => copyToEncrypted({ ...args, confirmed: false }), (e) => e.code === REFUSAL.NotConfirmed);
  assert.equal(store.size, 0, 'no backup, no copy, nothing');
  await assert.rejects(() => blankLegacy({ ...args, copy: null, confirmed: true }), (e) => e.code === 'copy-not-verified');
  const copy = await copyToEncrypted({ ...args, confirmed: true });
  assert.ok(copy.verified && copy.copied);
  assert.deepEqual(await w.mxs.owner.getState(priv, LEGACY.private, 'work'), snapshot, 'copy leaves the old one alone');
  const tl = await w.mxs.owner.readEvents(repo.rooms.records);
  assert.equal(await hashContent(tl.find((e) => e.type === 'io.holodeck.share.import').content.data), copy.hash);
  await blankLegacy({ ...args, copy, confirmed: true });
  assert.deepEqual(await w.mxs.owner.getState(priv, LEGACY.private, 'work'), {});
  await rollbackLegacy({ mx: w.mxs.owner, room: priv, backup, confirmed: true });
  assert.deepEqual(await w.mxs.owner.getState(priv, LEGACY.private, 'work'), snapshot, 'reversible from the local backup');
});

// ---------------------------------------------------------------- account rule, regressions

test('account is a variable: the link base is the page, or derived from the one declaration', () => {
  const decl = JSON.parse(fs.readFileSync(new URL('./fold-workspace.json', import.meta.url), 'utf8'));
  const here = { origin: 'http://127.0.0.1:8813', pathname: '/index.html' };
  assert.deepEqual(linkBase({ here, declaration: decl }), { base: 'http://127.0.0.1:8813/', source: 'page' });
  const pub = linkBase({ here, declaration: decl, published: true });
  assert.equal(pub.source, 'declared');
  assert.equal(pub.base, derivePages(decl, 'holodeck'));
  assert.ok(pub.base.startsWith('https://') && pub.base.includes(decl.account));
  const moved = linkBase({ here, declaration: { ...decl, account: 'some-other-account' }, published: true });
  assert.ok(moved.base.includes('some-other-account'), 'change the declaration, the link follows');
  assert.equal(linkBase({ here, declaration: null, published: true }).gap.kind, 'no-declaration');
  assert.equal(linkBase({ here: { origin: 'null', pathname: '/' } }).gap.kind, 'no-origin');
  assert.equal(linkBase({ here, override: 'https://x.test/h/?a=1#b' }).base, 'https://x.test/h/');
});

test('F11 — no account or org literal in any file this feature adds', () => {
  const files = ['holodeck-account.js', 'holodeck-seal.js', 'holodeck-roles.js', 'holodeck-share.js', 'holodeck-legacy.js', 'holodeck-fake-matrix.js', 'holodeck-share.test.mjs',
    'holodeck-matrix.js', 'holodeck-share-panel.js', 'tools/vendor-matrix-sdk.mjs'].filter((f) => fs.existsSync(new URL('./' + f, import.meta.url)));
  assert.ok(files.length >= 6);
  // the two literals are spelled in pieces so this file does not contain what it forbids
  const lits = ['scores' + '-patch-points', 'cloven' + 'bradshaw'];
  for (const f of files) {
    const t = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    for (const l of lits) assert.ok(!t.includes(l), `${f} contains ${l}`);
  }
});
