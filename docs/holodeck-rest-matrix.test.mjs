// holodeck-rest-matrix.test.mjs — the REST adapter, and the whole flow through the REAL gate.
//
// The homeserver is the in-test HTTP double (tests/fake-homeserver.mjs). It is NOT Synapse. It is written to be
// faithful where adapters go wrong: state events appear in /messages (an adapter that does not filter them would
// miscount); a redacted event keeps its type and loses its content; history visibility "joined" hides what was sent
// before you joined; an unknown alias is a 404 with M_NOT_FOUND; the room creator is the sender of m.room.create.
// The gate in front of it (tools/login-gate) is the real one, exercised through a router that does what a reverse
// proxy would: login, register and /gate/* to the gate, everything else to the homeserver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeserver } from './tests/fake-homeserver.mjs';
import { startStack } from './tests/people-stack.mjs';
import { restMatrix, baseFor, enrollStart, signUp, signIn, gateCrossing, RestGap } from './holodeck-rest-matrix.js';
import { makeInvites, EVT, REFUSE, parseWorkspaceInvite } from './holodeck-invites.js';
import { totpCode } from './holodeck-invite-core.js';

const memory = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : null), set: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }, raw: m }; };
const BASE = 'https://example.test/holodeck/';
const mxOf = (s) => restMatrix({ base: s.base, token: s.token, user: s.user });

test('the adapter speaks the client API: rooms, aliases, state, events, redaction, membership — and keeps state events out of the event list', async () => {
  const hs = await homeserver();
  try {
    const o = hs.user('owner'), a = hs.user('ana');
    const mo = restMatrix({ base: hs.base, token: o.token, user: o.user });
    const ma = restMatrix({ base: hs.base, token: a.token, user: a.user });
    assert.equal(mo.server, 'rest.local');
    const room = await mo.createRoom({ name: 'r', preset: 'public_chat', visibility: 'private', room_alias_name: 'abcdefghjkmnpqrs' });
    assert.equal(await mo.resolveAlias('#abcdefghjkmnpqrs:rest.local'), room);
    assert.equal(await mo.resolveAlias('#nothere:rest.local'), null);
    await assert.rejects(() => mo.createRoom({ preset: 'public_chat', room_alias_name: 'abcdefghjkmnpqrs' }), (e) => e.errcode === 'M_ROOM_IN_USE');
    assert.deepEqual(await mo.aliasesOf(room), ['#abcdefghjkmnpqrs:rest.local']);
    const st = await mo.roomState(room);
    assert.equal(st.creator, o.user); assert.equal(st.members[o.user], 'join'); assert.equal(st.joinRule, 'public');
    await ma.join(room);
    const e1 = await ma.sendEvent(room, 'io.holodeck.test', { n: 1 });
    await mo.setState(room, 'io.holodeck.s', '', { v: 1, x: 'y' });
    assert.deepEqual(await mo.getState(room, 'io.holodeck.s', ''), { v: 1, x: 'y' });
    assert.equal(await mo.getState(room, 'io.holodeck.absent', ''), null);
    const evs = await mo.readEvents(room);
    assert.deepEqual(evs.map((e) => e.type), ['io.holodeck.test'], 'joins, power levels and the state marker are not events');
    await ma.redactEvent(room, e1);
    const after = await mo.readEvents(room);
    assert.equal(after[0].decrypted, false, 'a redacted event keeps its place with its content stripped');
    assert.deepEqual(after[0].content, {});
    await assert.rejects(() => ma.setState(room, 'io.holodeck.s', '', { x: 1 }), (e) => e.status === 403);
    await mo.deleteAlias('#abcdefghjkmnpqrs:rest.local');
    assert.equal(await mo.resolveAlias('#abcdefghjkmnpqrs:rest.local'), null);
    assert.ok(hs.seen.every((r) => !r.path.includes(o.token) && !r.path.includes(a.token)), 'tokens travel only in the Authorization header');
    const oid = await mo.getOpenIdToken();
    assert.notEqual(oid.access_token, o.token, 'the OpenID token is not the access token');
  } finally { await hs.close(); }
});

test('the whole thing through the gate: enrol and create an account with your own password, join by link, appear online — and the owner holds nothing that signs in as you', async () => {
  let T = Date.now();                                                       // the gate's clock, and the authenticator's, are one
  const stack = await startStack({ name: 'stack.test', now: () => T, gateConfig: { admins: ['@owner:stack.test'] } });
  try {
    // the owner: an account that already exists, enrolled by the operator on the server
    const o = stack.hs.user('owner');
    stack.hs.passwords.set(o.user, 'owner-password-xyz');
    const ownerEnrol = await stack.gate.operator.enroll(o.user);
    assert.match(ownerEnrol.otpauth, /^otpauth:\/\/totp\//);
    const mo = restMatrix({ base: stack.base, token: o.token, user: o.user });
    const priv = await mo.createRoom({ name: 'Fold (private)', preset: 'private_chat', visibility: 'private' });
    const pub = await mo.createRoom({ name: 'Fold', preset: 'public_chat', visibility: 'public' });
    const rooms = { priv, pub };
    const ownerStore = memory();
    const owner = makeInvites({ mx: mo, store: ownerStore, gate: gateCrossing({ base: stack.base, openid: () => mo.getOpenIdToken() }) });
    const inv = await owner.invite({ name: 'Ana (accountant)', rooms, base: BASE });
    const link = inv.link.replace(/&hs=[^&]*$/, '&hs=stack.test');

    // Ana, on her own computer: enrol an authenticator, choose a name and a password, create the account — through the gate
    const secretSeen = await enrollStart({ base: stack.base, account: 'Ana' });
    assert.match(secretSeen.secret, /^[A-Z2-7]{32}$/);
    const code1 = await totpCode(secretSeen.secret, T);
    const wrong = await signUp({ host: 'stack.test', base: stack.base, username: 'ana', password: 'ana chose this long password', ticket: secretSeen.ticket, code: String((Number(code1) + 1) % 1000000).padStart(6, '0') }).catch((e) => e);
    assert.ok(wrong instanceof RestGap && wrong.kind === 'code-refused', 'a wrong code makes no account');
    const session = await signUp({ host: 'stack.test', base: stack.base, username: 'Ana', password: 'ana chose this long password', ticket: secretSeen.ticket, code: code1 });
    assert.equal(session.user, '@ana:stack.test');
    assert.equal(stack.hs.passwords.get('@ana:stack.test'), 'ana chose this long password', 'the password is held by the homeserver…');
    const everyOwnerThing = JSON.stringify([...ownerStore.raw.entries()]) + JSON.stringify(stack.hs.seen.filter((r) => r.auth === o.token));
    assert.ok(!everyOwnerThing.includes('ana chose this long password'), '…and the owner’s device and requests never carried it');
    assert.ok(!everyOwnerThing.includes(secretSeen.secret), 'nor her authenticator secret');

    // she opens the link; the owner's device checks, asks the gate, lets her in
    const ana = makeInvites({ mx: mxOf(session), store: null });
    const acc = await ana.open({ input: link });
    assert.equal(acc.owner, o.user);
    const swept = await owner.sweep({ rooms });
    assert.equal(swept[0].state, 'admitted', JSON.stringify(swept));
    const got = await ana.claim({ door: acc.door, input: link });
    assert.deepEqual(got.rooms, rooms);
    assert.equal(got.vault, 'ready', 'the workspace key came to her inside the grant');
    assert.equal((await owner.people({ rooms })).find((p) => p.user === '@ana:stack.test').name, 'Ana (accountant)');

    // presence over REST, including the redaction of the previous beat
    for (let i = 0; i < 5; i++) await ana.announce({ rooms, viewing: 'doc:' + i, title: 'Lease ' + i });
    assert.deepEqual((await owner.presence({ rooms })).map((p) => [p.name, p.viewing]), [['Ana (accountant)', 'doc:4']]);
    const live = (await mo.readEvents(priv, { type: EVT.presence })).filter((e) => e.decrypted);
    assert.ok(live.length <= 2, 'heartbeats replace each other over REST too: ' + live.length);

    // what the homeserver was ever sent, and what it stores: no name, no page title, no key
    const everythingSent = JSON.stringify(stack.hs.seen.map((r) => r.body));
    const stored = JSON.stringify([...stack.hs.rooms.values()].map((r) => ({ state: [...r.state.values()], timeline: r.timeline })));
    const wsKey = (await (await import('./holodeck-vault.js')).makeKeyring(ownerStore, { account: o.user }).current(priv)).key;
    for (const needle of ['Ana (accountant)', 'Lease 4', 'Lease 0', wsKey, parseWorkspaceInvite(link).secret]) {
      assert.equal(everythingSent.includes(needle), false, 'never sent to the homeserver: ' + needle.slice(0, 12));
      assert.equal(stored.includes(needle), false, 'never stored by the homeserver: ' + needle.slice(0, 12));
    }
    assert.ok(stored.includes('io.holodeck.presence') && stored.includes('"vault":"hd.aes256gcm.v1"'), 'control: the scan sees the events and their sealed form, so it is not blind');

    // later, on another computer: password AND the six digits, or no sign-in
    T += 60_000;                                                             // past the step the enrolment code came from
    const login = (code) => signIn({ host: 'stack.test', base: stack.base, user: 'ana', password: 'ana chose this long password', code });
    await assert.rejects(login(undefined), (e) => e.kind === 'refused');
    const hitsBefore = stack.hs.seen.filter((r) => /login/.test(r.path)).length;
    await assert.rejects(login('000000'), (e) => e.kind === 'refused');
    assert.equal(stack.hs.seen.filter((r) => /login/.test(r.path)).length, hitsBefore, 'a wrong code never reaches the homeserver');
    const ok = await login(await totpCode(secretSeen.secret, T));
    assert.equal(ok.user, '@ana:stack.test');
    await assert.rejects(login(await totpCode(secretSeen.secret, T)), (e) => e.kind === 'refused', 'the same code twice is refused');

    // the owner cannot be her: the only password the owner has is their own, and the link is not a credential
    const half = parseWorkspaceInvite(link).secret;
    for (const password of [half, 'owner-password-xyz']) {
      T += 30_000;
      await assert.rejects(signIn({ host: 'stack.test', base: stack.base, user: 'ana', password, code: await totpCode(secretSeen.secret, T) }), (e) => e.kind === 'refused' || e.kind === 'locked');
    }
  } finally { await stack.close(); }
});

test('someone with the link who created their account on the homeserver directly (no authenticator) is not admitted, and the invitation stays open', async () => {
  const stack = await startStack({ name: 'stack.test', gateConfig: { admins: ['@owner:stack.test'] } });
  try {
    const o = stack.hs.user('owner');
    const mo = restMatrix({ base: stack.base, token: o.token, user: o.user });
    const priv = await mo.createRoom({ preset: 'private_chat' });
    const ownerDevice = memory();
    const owner = makeInvites({ mx: mo, store: ownerDevice, gate: gateCrossing({ base: stack.base, openid: () => mo.getOpenIdToken() }) });
    const inv = await owner.invite({ name: 'A', rooms: { priv }, base: BASE });
    const eve = stack.hs.user('eve');                                       // registered straight on the homeserver, around the gate
    const evi = makeInvites({ mx: restMatrix({ base: stack.base, token: eve.token, user: eve.user }), store: null });
    await evi.open({ input: inv.link });
    const r = (await owner.sweep({ rooms: { priv } }))[0];
    assert.equal(r.state, 'blocked'); assert.equal(r.blocked.why, 'not-enrolled');
    assert.equal((await mo.roomState(priv)).members[eve.user], undefined);
    assert.equal((await owner.outstanding({ rooms: { priv } }))[0].state, 'sent');
    // and with the gate unreachable the owner's device admits nobody
    const down = makeInvites({ mx: mo, store: ownerDevice, gate: gateCrossing({ base: 'http://127.0.0.1:9', openid: () => mo.getOpenIdToken() }) });   // same device, gate unreachable
    const inv2 = await down.invite({ name: 'B', rooms: { priv }, base: BASE });
    const ana = stack.hs.user('ana');
    await makeInvites({ mx: restMatrix({ base: stack.base, token: ana.token, user: ana.user }), store: null }).open({ input: inv2.link });
    assert.equal((await down.sweep({ rooms: { priv } }))[0].blocked.why, 'gate-unreachable');
  } finally { await stack.close(); }
});

test('account creation is typed: a taken name, a refused code, and a homeserver that is closed to registration', async () => {
  const stack = await startStack({ name: 'stack.test' });
  try {
    const a = await enrollStart({ base: stack.base });
    await signUp({ host: 'stack.test', base: stack.base, username: 'dee', password: 'long enough password', ticket: a.ticket, code: await totpCode(a.secret, Date.now()) });
    const b = await enrollStart({ base: stack.base });
    await assert.rejects(signUp({ host: 'stack.test', base: stack.base, username: 'dee', password: 'long enough password', ticket: b.ticket, code: await totpCode(b.secret, Date.now()) }), (e) => e.kind === 'name-taken');
    await assert.rejects(signUp({ host: 'stack.test', base: stack.base, username: 'fay', password: 'long enough password', ticket: b.ticket, code: '000000' }), (e) => e.kind === 'code-refused');
  } finally { await stack.close(); }
  const closed = await homeserver({ registration: 'closed' });
  try {
    await assert.rejects(signUp({ host: 'x', base: closed.base, username: 'a', password: 'long enough password', ticket: 't', code: '123456' }), (e) => e.kind === 'registration-refused' || e.kind === 'code-refused');
  } finally { await closed.close(); }
});

test('where to talk to the homeserver a link names: https, except on this computer; a hostile name is refused; delegation is honoured', async () => {
  assert.deepEqual(await baseFor('127.0.0.1:8874', async () => { throw new Error('no'); }), { host: '127.0.0.1:8874', base: 'http://127.0.0.1:8874' });
  assert.deepEqual(await baseFor('matrix.example.org', async () => ({ ok: false })), { host: 'matrix.example.org', base: 'https://matrix.example.org' });
  const deleg = await baseFor('example.org', async () => ({ ok: true, json: async () => ({ 'm.homeserver': { base_url: 'https://matrix.example.org/' } }) }));
  assert.equal(deleg.base, 'https://matrix.example.org');
  const down = await baseFor('example.org', async () => ({ ok: true, json: async () => ({ 'm.homeserver': { base_url: 'http://plain.example.org' } }) }));
  assert.equal(down.base, 'https://example.org', 'a delegation to plain http is ignored');
  for (const bad of ['', 'evil.example/../x', 'a b', 'x@y']) await assert.rejects(baseFor(bad), (e) => e.kind === 'homeserver');
});
