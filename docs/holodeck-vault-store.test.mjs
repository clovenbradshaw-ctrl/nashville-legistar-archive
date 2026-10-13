// holodeck-vault-store.test.mjs — V8–V10 of docs/MATRIX-INVITES-PREREG.md, Part III.
//
// fold-net.js saves a workspace's private work (pins, drafts, filters, reading history) as a state event. These tests
// run it against the in-test homeserver over HTTP and check what the server was sent and what it holds. Every
// falsifier has a control: a probe that cannot see the thing it says is absent would pass for the wrong reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeserver } from './tests/fake-homeserver.mjs';
import { restMatrix } from './holodeck-rest-matrix.js';
import { savePrivate, loadPrivate, setState } from './fold-net.js';
import { makeKeyring, isSealed, EPOCH_EVENT, CODE } from './holodeck-vault.js';

const PRIV = 'social.hyphae.fold.private';
const SECRET_PIN = 'pin: the landlord’s unit-7 inspection report';
const mem = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };
const work = (extra = {}) => ({ pins: [{ id: 'p1', note: SECRET_PIN }], filters: { q: 'lease' }, readLog: [{ doc: 'd1', at: 1 }], ...extra });
const ringFor = (user, store = mem()) => makeKeyring(store, { account: user });
const code = (p) => p.then(() => assert.fail('expected a refusal'), (e) => { assert.ok(e && e.vault, 'a typed VaultError, got ' + (e && e.message)); return e.code; });

async function world() {
  const hs = await homeserver({ name: 'store.test' });
  const o = hs.user('owner'), a = hs.user('ana');
  const sess = (u) => ({ base: hs.base, token: u.token, user: u.user });
  const mo = restMatrix({ base: hs.base, token: o.token, user: o.user });
  const ma = restMatrix({ base: hs.base, token: a.token, user: a.user });
  const priv = await mo.createRoom({ name: 'Fold (private)', preset: 'private_chat', visibility: 'private' });
  await mo.invite(priv, a.user); await ma.join(priv);
  const stored = () => JSON.stringify([...hs.rooms.values()].map((r) => ({ state: [...r.state.values()], timeline: r.timeline })));
  const sent = () => JSON.stringify(hs.seen.map((r) => r.body));
  return { hs, o, a, so: sess(o), sa: sess(a), mo, ma, priv, stored, sent, close: () => hs.close() };
}

test('V8 — private work is sent and stored sealed, and reads back exactly; control: the scan sees a plaintext snapshot', async () => {
  const w = await world();
  try {
    const ring = ringFor(w.o.user);
    await savePrivate(w.so, w.priv, 'work', work(), ring);
    for (const [what, text] of [['stored', w.stored()], ['sent', w.sent()]]) {
      assert.equal(text.includes(SECRET_PIN), false, 'the pin is not ' + what + ' in the clear');
      assert.equal(text.includes('lease'), false, 'nor the filter');
    }
    assert.ok(isSealed(await w.mo.getState(w.priv, PRIV, 'work')), 'the snapshot on the server is sealed');
    assert.deepEqual(await loadPrivate(w.so, w.priv, 'work', ring), work());
    // control: the old way of saving (plaintext state) IS found by the same scan
    await setState(w.so, w.priv, 'io.holodeck.old', '', { v: 1, data: work() });
    assert.ok(w.stored().includes(SECRET_PIN) && w.sent().includes(SECRET_PIN), 'control: the scan sees a plaintext snapshot');
  } finally { await w.close(); }
});

test('V8 — an older, unsealed snapshot is read as it is until this device has a key, and the next save seals it', async () => {
  const w = await world();
  try {
    const ring = ringFor(w.o.user);
    await setState(w.so, w.priv, PRIV, 'work', { v: 1, at: 'then', data: work({ legacy: true }) });         // how it was saved before
    assert.equal((await loadPrivate(w.so, w.priv, 'work', ring)).legacy, true, 'readable, so nothing is lost on upgrade');
    await savePrivate(w.so, w.priv, 'work', work({ legacy: false }), ring);
    assert.ok(isSealed(await w.mo.getState(w.priv, PRIV, 'work')));
    assert.equal((await loadPrivate(w.so, w.priv, 'work', ring)).legacy, false);
  } finally { await w.close(); }
});

test('V9 — a device without the key is LOCKED: it reads nothing and writes nothing, and does not start a key beside the first device’s', async () => {
  const w = await world();
  try {
    const first = ringFor(w.o.user);
    await savePrivate(w.so, w.priv, 'work', work(), first);
    const second = ringFor(w.o.user);                                                          // the owner's other browser: no key
    assert.equal(await code(loadPrivate(w.so, w.priv, 'work', second)), CODE.Locked);
    assert.equal(await code(savePrivate(w.so, w.priv, 'work', work({ x: 1 }), second)), CODE.Locked);
    assert.equal(await second.has(w.priv), false, 'and it did not make a key of its own');
    assert.deepEqual(await loadPrivate(w.so, w.priv, 'work', first), work(), 'the first device’s data is untouched');
    // control: given the device key, the same device reads and writes
    await second.importRing(await first.exportRing(w.priv), { scope: w.priv });
    assert.deepEqual(await loadPrivate(w.so, w.priv, 'work', second), work());
    await savePrivate(w.so, w.priv, 'work', work({ x: 2 }), second);
    assert.equal((await loadPrivate(w.so, w.priv, 'work', first)).x, 2, 'and the first device reads what the second wrote');
  } finally { await w.close(); }
});

test('V9 — only the workspace owner starts the key: a member with none cannot start one or read the owner’s work, and with the key from her grant she reads it', async () => {
  const w = await world();
  try {
    const anaRing = ringFor(w.a.user);
    assert.equal(await code(savePrivate(w.sa, w.priv, 'work', work(), anaRing)), CODE.NotOwner);
    assert.equal(await anaRing.has(w.priv), false);
    const ownerRing = ringFor(w.o.user);
    await savePrivate(w.so, w.priv, 'work', work(), ownerRing);
    assert.equal(await code(loadPrivate(w.sa, w.priv, 'work', anaRing)), CODE.Locked, 'without the key she reads nothing');
    await anaRing.importRing(await ownerRing.exportRing(w.priv), { scope: w.priv });          // what a grant delivers
    assert.deepEqual(await loadPrivate(w.sa, w.priv, 'work', anaRing), work(), 'with it she reads what the owner saved');
    // (writing the snapshot is the room's own power-level rule — a plain member cannot set state in a private room —
    // and is not something the vault changes)
  } finally { await w.close(); }
});

test('V10 — once a device holds the key, a plaintext snapshot is refused (a forged one cannot be slipped in); sealed content moved to another key is refused', async () => {
  const w = await world();
  try {
    const ring = ringFor(w.o.user);
    await savePrivate(w.so, w.priv, 'work', work(), ring);
    const sealed = await w.mo.getState(w.priv, PRIV, 'work');
    await setState(w.so, w.priv, PRIV, 'work', { v: 1, at: 'x', data: { pins: [{ note: 'forged' }] } });   // someone who can write the room
    assert.equal(await code(loadPrivate(w.so, w.priv, 'work', ring)), CODE.Downgrade);
    // control: a device with NO key and nothing sealed there accepts plaintext (an older workspace)
    assert.equal((await loadPrivate(w.so, w.priv, 'work', ringFor('@fresh:store.test'))).pins[0].note, 'forged');
    await setState(w.so, w.priv, PRIV, 'other', sealed);                                                 // the real sealed content, under another key
    assert.equal(await code(loadPrivate(w.so, w.priv, 'other', ring)), CODE.Tampered);
    await setState(w.so, w.priv, PRIV, 'work', sealed);                                                  // control: back where it was sealed
    assert.deepEqual(await loadPrivate(w.so, w.priv, 'work', ring), work());
  } finally { await w.close(); }
});

test('V10 — after a rotation a member reads the new content through the OWNER’s rotation event; a member’s own forged one (with a higher epoch) is not adopted; someone with no key reads nothing', async () => {
  const w = await world();
  try {
    const ownerRing = ringFor(w.o.user);
    await savePrivate(w.so, w.priv, 'work', work(), ownerRing);
    const firstKeyOnly = await ownerRing.exportRing(w.priv);                                  // what a member was given before the rotation
    const k1 = (await ownerRing.current(w.priv)).kid;

    // the owner rotates: the next key, sealed under the old one, goes into the room; then new content under it
    const plan = await ownerRing.planRotation(w.priv);
    await w.mo.sendEvent(w.priv, EPOCH_EVENT, await ownerRing.epochContent(w.priv, plan));
    await ownerRing.add(w.priv, plan.next.key, plan.next.n);
    await savePrivate(w.so, w.priv, 'work', work({ after: 'rotation' }), ownerRing);

    // ana (a member, no moderator power) posts a rotation of her own, with a HIGHER epoch than the owner's
    const anaRing = ringFor(w.a.user);
    await anaRing.importRing(firstKeyOnly, { scope: w.priv });
    const forged = await anaRing.planRotation(w.priv);
    forged.next.n = plan.next.n + 5;
    await w.ma.sendEvent(w.priv, EPOCH_EVENT, await anaRing.epochContent(w.priv, forged));

    // a device holding only the first key reads the new content and adopts the owner's key, not the forged one
    const dave = ringFor('@dave:store.test');
    await dave.importRing(firstKeyOnly, { scope: w.priv });
    assert.equal((await dave.current(w.priv)).kid, k1);
    assert.equal((await loadPrivate(w.so, w.priv, 'work', dave)).after, 'rotation', 'followed the rotation');
    assert.equal((await dave.current(w.priv)).kid, plan.next.kid, 'to the owner’s key');
    assert.notEqual((await dave.current(w.priv)).kid, forged.next.kid, 'not to the member’s forged one, though its epoch number is higher');

    // control: someone who never had the first key gains nothing from the same events
    assert.equal(await code(loadPrivate(w.so, w.priv, 'work', ringFor('@carol:store.test'))), CODE.Locked);
  } finally { await w.close(); }
});
