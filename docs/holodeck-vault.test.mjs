// holodeck-vault.test.mjs — V1–V9 of docs/MATRIX-INVITES-PREREG.md, Part III.
//
// The vault seals content before it leaves the device. Every falsifier here is paired with a control built to fail
// the other way, so a probe that cannot see the thing it says is absent is caught.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAULT, EPOCH_EVENT, CODE, VaultError, b64u, unb64u, newKey, kidOf, isSealed, sealWith, openWith,
  deriveGrantKey, sealGrant, openGrant, makeKeyring,
} from './holodeck-vault.js';

const CANARY = 'Ana-Q7-the-accountant-canary';
const ROOM = '!workspace:test.local';
const mem = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };
const keyed = async () => { const key = newKey(); return { key, kid: await kidOf(key) }; };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.ok(e && e.vault, 'a typed VaultError, got ' + (e && e.message)); assert.equal(e.code, code); return; } assert.fail('expected ' + code); };

// ---------------------------------------------------------------- V1: the server sees no content

test('V1 — sealed content holds no word of the plaintext; control: the probe does find the canary in the plaintext', async () => {
  const value = { names: { '@ana:test.local': CANARY }, viewing: 'Quarterly filing ' + CANARY };
  const k = await keyed();
  const sealed = await sealWith(k, value, { room: ROOM, type: 'io.holodeck.people', key: '' });
  const wire = JSON.stringify(sealed);
  assert.ok(!wire.includes(CANARY), 'the canary is not in the sealed event');
  assert.ok(!wire.includes('Quarterly') && !wire.includes('ana'), 'nor any word of it');
  assert.ok(!Buffer.from(unb64u(sealed.ct)).includes(Buffer.from(CANARY)), 'nor in the raw ciphertext bytes');
  assert.ok(JSON.stringify(value).includes(CANARY), 'control: the same probe does see it in the plaintext');
  assert.ok(isSealed(sealed) && sealed.vault === VAULT && sealed.kid === k.kid);
  assert.deepEqual(Object.keys(sealed).sort(), ['ct', 'iv', 'kid', 'v', 'vault', 'z'], 'nothing else rides along in the clear');
});

test('V1 — the same value sealed twice differs (a fresh nonce each time); a round trip returns it exactly', async () => {
  const k = await keyed(), ctx = { room: ROOM, type: 't', key: 'k' };
  const v = { a: 1, s: 'héllo ✓', n: null, arr: [1, 2, { b: true }] };
  const a = await sealWith(k, v, ctx), b = await sealWith(k, v, ctx);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
  const keyOf = async (kid) => (kid === k.kid ? k.key : null);
  assert.deepEqual(await openWith(keyOf, a, ctx), v);
  assert.deepEqual(await openWith(keyOf, b, ctx), v);
});

// ---------------------------------------------------------------- V2: bound to its place, authenticated

test('V2 — sealed content cannot be moved to another room, type, key or sender; control: it opens where it was sealed', async () => {
  const k = await keyed();
  const keyOf = async (kid) => (kid === k.kid ? k.key : null);
  const here = { room: ROOM, type: 'io.holodeck.presence', key: '', sender: '@ana:test.local' };
  const sealed = await sealWith(k, { viewing: 'x' }, here);
  assert.deepEqual(await openWith(keyOf, sealed, here), { viewing: 'x' });                 // control
  for (const moved of [{ ...here, room: '!other:test.local' }, { ...here, type: 'io.holodeck.people' }, { ...here, key: 'work' }, { ...here, sender: '@eve:test.local' }]) {
    await rejects(openWith(keyOf, sealed, moved), CODE.Tampered);
  }
});

test('V2 — any changed bit of the ciphertext, nonce, key id or compression flag is refused; control: untouched opens', async () => {
  const k = await keyed(); const ctx = { room: ROOM, type: 't', key: '' };
  const keyOf = async (kid) => (kid === k.kid ? k.key : null);
  const big = { text: 'lorem ipsum dolor sit amet '.repeat(40) };
  const sealed = await sealWith(k, big, ctx);
  assert.deepEqual(await openWith(keyOf, sealed, ctx), big);                                 // control
  const flip = (s) => { const u = unb64u(s); u[Math.floor(u.length / 2)] ^= 1; return b64u(u); };
  await rejects(openWith(keyOf, { ...sealed, ct: flip(sealed.ct) }, ctx), CODE.Tampered);
  await rejects(openWith(keyOf, { ...sealed, iv: flip(sealed.iv) }, ctx), CODE.Tampered);
  await rejects(openWith(keyOf, { ...sealed, z: sealed.z ? 0 : 1 }, ctx), CODE.Tampered);
  const other = await keyed();
  await rejects(openWith(async () => other.key, sealed, ctx), CODE.Tampered);               // a held but wrong key
});

test('V2 — a device without the key is told it is LOCKED, never given a guess; plaintext is not sealed content', async () => {
  const k = await keyed(); const ctx = { room: ROOM, type: 't', key: '' };
  const sealed = await sealWith(k, { a: 1 }, ctx);
  await rejects(openWith(async () => null, sealed, ctx), CODE.Locked);
  await rejects(openWith(async () => k.key, { names: { a: 'b' } }, ctx), CODE.NotSealed);
  assert.equal(isSealed({ v: 1, names: {} }), false);
  assert.equal(isSealed(null), false);
});

// ---------------------------------------------------------------- V3: length says little

test('V3 — values of different small sizes seal to the same length; control: a value in the next bucket does not', async () => {
  const k = await keyed(), ctx = { room: ROOM, type: 't', key: '' };
  const len = async (v) => (await sealWith(k, v, ctx)).ct.length;
  const a = await len({ n: 'a' }), b = await len({ n: 'a much longer name than the first one, by quite some margin' });
  assert.equal(a, b, 'an 8-byte and a 70-byte value are indistinguishable by length');
  const c = await len({ n: b64u(crypto.getRandomValues(new Uint8Array(450))) });             // incompressible, so it really is longer
  assert.ok(c > a, 'control: the next bucket is larger, so the probe can see a length difference');
});

// ---------------------------------------------------------------- V4: large values fit, bombs do not

test('V4 — a large compressible value fits under Matrix’s 64 KiB event; control: unsealed it would not', async () => {
  const k = await keyed(), ctx = { room: ROOM, type: 't', key: '' };
  const keyOf = async (kid) => (kid === k.kid ? k.key : null);
  const big = { readLog: Array.from({ length: 1400 }, (_, i) => ({ at: 1700000000000 + i * 1000, doc: 'source-' + (i % 37), span: [i, i + 12] })) };
  const raw = JSON.stringify(big).length;
  assert.ok(raw > 60000, 'control: the plaintext is already near the cap (' + raw + ' bytes)');
  const sealed = await sealWith(k, big, ctx);
  assert.ok(JSON.stringify(sealed).length < 64 * 1024 - 4096, 'sealed it is ' + JSON.stringify(sealed).length + ' bytes');
  assert.deepEqual(await openWith(keyOf, sealed, ctx), big);
});

test('V4 — a value that inflates past the limit is refused (no decompression bomb); control: a large honest value opens', async () => {
  const k = await keyed(), ctx = { room: ROOM, type: 't', key: '' };
  const keyOf = async (kid) => (kid === k.kid ? k.key : null);
  const honest = await sealWith(k, { s: 'a'.repeat(2 * 1024 * 1024) }, ctx);
  assert.equal((await openWith(keyOf, honest, ctx)).s.length, 2 * 1024 * 1024);              // control
  const bomb = await sealWith(k, { s: 'a'.repeat(9 * 1024 * 1024) }, ctx);
  assert.ok(JSON.stringify(bomb).length < 20000, 'the bomb is small on the wire');
  await rejects(openWith(keyOf, bomb, ctx), CODE.TooBig);
});

// ---------------------------------------------------------------- V5: the keyring

test('V5 — the first key is made once and kept; a rotation is the next epoch; older content still opens; a key the browser cannot keep is never used', async () => {
  const store = mem(); const ring = makeKeyring(store);
  assert.equal(await ring.has(ROOM), false);
  await assert.rejects(ring.sealFor(ROOM, { a: 1 }), (e) => e.code === CODE.Locked);
  const k1 = await ring.ensure(ROOM);
  assert.equal(k1.n, 1);
  assert.equal((await ring.ensure(ROOM)).kid, k1.kid, 'ensure is idempotent');
  const old = await ring.sealFor(ROOM, { v: 'before' }, { type: 't', key: '' });
  const { next, previous } = await ring.rotate(ROOM);
  assert.equal(next.n, 2); assert.equal(previous.kid, k1.kid);
  assert.equal((await ring.current(ROOM)).kid, next.kid);
  const fresh = await ring.sealFor(ROOM, { v: 'after' }, { type: 't', key: '' });
  assert.equal(fresh.kid, next.kid); assert.equal(old.kid, k1.kid);
  assert.deepEqual(await ring.openFor(ROOM, old, { type: 't', key: '' }), { v: 'before' });
  assert.deepEqual(await ring.openFor(ROOM, fresh, { type: 't', key: '' }), { v: 'after' });
  // the key lives in the store the device gave it, and only there
  assert.ok([...store.m.keys()].every((k) => k.startsWith('hd:vault:v1:')));
  // a browser that will not keep the key: nothing is sealed, nothing is half-made
  const refusing = makeKeyring({ get: async () => null, set: async () => { throw new Error('QuotaExceeded'); } });
  await assert.rejects(refusing.ensure(ROOM), (e) => e.code === CODE.Unkept);
  assert.equal(await refusing.has(ROOM), false);
  const forgetful = makeKeyring({ get: async () => null, set: async () => {} });             // "succeeds" but keeps nothing
  await assert.rejects(forgetful.ensure(ROOM), (e) => e.code === CODE.Unkept);
});

test('V5 — a device link carries the keyring to another device, scoped to its workspace; a damaged or foreign one is refused', async () => {
  const a = makeKeyring(mem()), b = makeKeyring(mem());
  await a.ensure(ROOM); await a.rotate(ROOM);
  const text = await a.exportRing(ROOM);
  assert.ok(/^v1\.[A-Za-z0-9_-]+$/.test(text), 'a fragment-safe string');
  assert.deepEqual(await b.importRing(text, { scope: ROOM }), { scope: ROOM, added: 2 });
  assert.equal((await b.current(ROOM)).kid, (await a.current(ROOM)).kid, 'the same current key');
  const sealed = await a.sealFor(ROOM, { x: 1 }, { type: 't', key: '' });
  assert.deepEqual(await b.openFor(ROOM, sealed, { type: 't', key: '' }), { x: 1 });
  assert.deepEqual(await b.importRing(text), { scope: ROOM, added: 0 }, 'importing again adds nothing');
  await assert.rejects(makeKeyring(mem()).importRing(text, { scope: '!other:test.local' }), (e) => e.code === CODE.BadRing);
  const o = JSON.parse(Buffer.from(unb64u(text.slice(3))).toString());
  const kid = Object.keys(o.k)[0]; o.k[kid].k = newKey();                                     // a key that is not the one its id names
  await assert.rejects(makeKeyring(mem()).importRing('v1.' + b64u(Buffer.from(JSON.stringify(o)))), (e) => e.code === CODE.BadRing);
  await assert.rejects(makeKeyring(mem()).importRing('not a key'), (e) => e.code === CODE.BadRing);
  await assert.rejects(makeKeyring(mem()).exportRing(ROOM), (e) => e.code === CODE.Locked);
});

test('V5 — the keyring is per account: a second account on the same browser holds no key; control: the same account does', async () => {
  const shared = mem();
  const ana = makeKeyring(shared, { account: '@ana:test.local' }), bob = makeKeyring(shared, { account: '@bob:test.local' });
  await ana.ensure(ROOM);
  assert.equal(await ana.has(ROOM), true);
  assert.equal(await bob.has(ROOM), false, 'same browser, same workspace, different account: no key');
  assert.equal(await makeKeyring(shared, { account: '@ana:test.local' }).has(ROOM), true, 'control: the same account on that browser has it');
  assert.ok([...shared.m.keys()].every((k) => k.includes('@ana:test.local|')), 'the account is in the storage key, not in the key material');
});

// ---------------------------------------------------------------- V6: rotation reaches members, not the removed

test('V6 — a rotation event reaches a member holding the old key and is followed through several rotations; control: a device without the old key gains nothing', async () => {
  const owner = makeKeyring(mem()), member = makeKeyring(mem()), outsider = makeKeyring(mem());
  const k1 = await owner.ensure(ROOM);
  await member.importRing(await owner.exportRing(ROOM));
  const r2 = await owner.rotate(ROOM); const e2 = { type: EPOCH_EVENT, sender: '@owner:test.local', content: await owner.epochContent(ROOM, r2) };
  const r3 = await owner.rotate(ROOM); const e3 = { type: EPOCH_EVENT, sender: '@owner:test.local', content: await owner.epochContent(ROOM, r3) };
  const trusted = (u) => u === '@owner:test.local';
  assert.equal(await outsider.absorb(ROOM, [e2, e3], { trusted }), 0, 'control: no old key, no new key');
  assert.equal(await member.absorb(ROOM, [e3, e2], { trusted }), 2, 'out of order, both are followed');
  assert.equal((await member.current(ROOM)).kid, r3.next.kid);
  assert.ok(k1.kid !== r3.next.kid);
  const sealed = await owner.sealFor(ROOM, { after: 'removal' }, { type: 't', key: '' });
  assert.deepEqual(await member.openFor(ROOM, sealed, { type: 't', key: '' }), { after: 'removal' });
});

test('V6 — a rotation from an untrusted sender, a forged key id and a wrong-place event are all ignored', async () => {
  const owner = makeKeyring(mem()), member = makeKeyring(mem());
  await owner.ensure(ROOM); await member.importRing(await owner.exportRing(ROOM));
  const r = await owner.rotate(ROOM);
  const good = await owner.epochContent(ROOM, r);
  assert.equal(await member.absorb(ROOM, [{ type: EPOCH_EVENT, sender: '@eve:test.local', content: good }], { trusted: (u) => u === '@owner:test.local' }), 0, 'untrusted sender');
  const forged = await sealWith(r.previous, { kid: '0000000000000000', key: r.next.key, n: 9 }, { room: ROOM, type: EPOCH_EVENT, key: '' });
  assert.equal(await member.absorb(ROOM, [{ type: EPOCH_EVENT, sender: '@owner:test.local', content: forged }]), 0, 'a key id that is not the key’s own');
  const moved = await sealWith(r.previous, { kid: r.next.kid, key: r.next.key, n: 2 }, { room: '!other:test.local', type: EPOCH_EVENT, key: '' });
  assert.equal(await member.absorb(ROOM, [{ type: EPOCH_EVENT, sender: '@owner:test.local', content: moved }]), 0, 'sealed for another room');
  assert.equal(await member.absorb(ROOM, [{ type: EPOCH_EVENT, sender: '@owner:test.local', content: good }]), 1, 'control: the real one is taken');
});

// ---------------------------------------------------------------- V7: the grant key comes from the link

test('V7 — both ends derive the same grant key from the link’s seed and alias; another seed or alias cannot open the grant', async () => {
  const seed = newKey().slice(0, 43), alias = 'abcdefghjkmnpqrs';
  const kOwner = await deriveGrantKey(seed, alias), kPerson = await deriveGrantKey(seed, alias);
  assert.equal(kOwner, kPerson);
  const ctx = { room: '!door:test.local', type: 'io.holodeck.invite.grant', key: '' };
  const sealed = await sealGrant(kOwner, { ring: 'v1.AAAA', rooms: { priv: ROOM } }, ctx);
  assert.ok(!JSON.stringify(sealed).includes('v1.AAAA'));
  assert.deepEqual(await openGrant(kPerson, sealed, ctx), { ring: 'v1.AAAA', rooms: { priv: ROOM } });
  await rejects(openGrant(await deriveGrantKey(newKey(), alias), sealed, ctx), CODE.Locked);
  await rejects(openGrant(await deriveGrantKey(seed, 'zzzzzzzzzzzzzzzz'), sealed, ctx), CODE.Locked);
  await assert.rejects(deriveGrantKey('AAAA', alias), (e) => e.code === CODE.BadKey);
});

test('V7 — the kid is a hash: it does not contain the key; control: it is stable for the same key', async () => {
  const key = newKey();
  const a = await kidOf(key), b = await kidOf(key);
  assert.equal(a, b);
  assert.ok(/^[0-9a-f]{16}$/.test(a));
  assert.ok(!key.includes(a) && !Buffer.from(unb64u(key)).toString('hex').includes(a));
});
