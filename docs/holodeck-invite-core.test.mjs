// holodeck-invite-core.test.mjs — the pure pieces: unbiased draws, proof binding, RFC 6238 vectors, paste parsing, presence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBelow, newDoorAlias, isDoorAlias, cleanName, nameFromAddress, parseInviteLines, inviteProof, safeEqualHex, base32Encode, base32Decode, newTotpSecret, newInviteKey, signInvite, verifyInvite, totpCode, totpCandidates, otpauthUri, groupKey, onlineNow } from './holodeck-invite-core.js';

test('aliases are the right shape and draws are unbiased: rejection sampling really rejects', () => {
  const a = newDoorAlias();
  assert.ok(isDoorAlias(a) && a.length === 16);
  assert.ok(!isDoorAlias('abcde') && !isDoorAlias('ABCDEFGHJKMNPQRS'));
  const n = 7, counts = new Array(n).fill(0);
  for (let i = 0; i < 70000; i++) counts[randomBelow(n)]++;
  assert.ok(counts.every((c) => c > 9000 && c < 11000), 'uniform: ' + counts);
  let calls = 0;
  const v = randomBelow(10, (u32) => { u32[0] = calls++ < 3 ? 0xFFFFFFFF : 15; });
  assert.equal(v, 5);
  assert.ok(calls >= 4, 'three out-of-range draws were rejected');
});

test('a proof is bound to the door and the account; the comparison is exact', async () => {
  const base = { door: '!d:x', user: '@a:x' };
  const p = await inviteProof('SECRETHALF', '123456', base);
  assert.match(p, /^[0-9a-f]{64}$/);
  assert.equal(p, await inviteProof('SECRETHALF', '123456', base));
  assert.notEqual(p, await inviteProof('SECRETHALF', '123456', { ...base, door: '!e:x' }));
  assert.notEqual(p, await inviteProof('SECRETHALF', '123456', { ...base, user: '@b:x' }));
  assert.notEqual(p, await inviteProof('OTHERHALF', '123456', base));
  assert.notEqual(p, await inviteProof('SECRETHALF', '123457', base));
  assert.ok(safeEqualHex(p, p) && !safeEqualHex(p, p.slice(0, -1) + (p.endsWith('0') ? '1' : '0')) && !safeEqualHex('', ''));
});

test('TOTP matches the RFC 6238 published test vectors (SHA1), and base32 round-trips', async () => {
  const ascii = new TextEncoder().encode('12345678901234567890');
  assert.equal(base32Encode(ascii), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual([...base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')], [...ascii]);
  assert.deepEqual([...base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq')], [...ascii], 'spaces, dashes and case are tolerated');
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  for (const [t, eight] of vectors) {
    assert.equal(await totpCode(ascii, t * 1000, { digits: 8 }), eight, 'T=' + t);
    assert.equal(await totpCode(ascii, t * 1000), eight.slice(-6), 'T=' + t + ' (6 digits)');
  }
  const secret = newTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal((await totpCandidates(secret, 1_000_000_000_000)).length, 3);
  assert.match(otpauthUri({ secret, account: 'Ana Smith', issuer: 'Holodeck' }), /^otpauth:\/\/totp\/Holodeck:Ana%20Smith\?secret=[A-Z2-7]{32}&issuer=Holodeck&algorithm=SHA1&digits=6&period=30$/);
  assert.equal(groupKey('ABCDEFGH'), 'ABCD EFGH');
  assert.throws(() => base32Decode('not base32!'));
});

test('pasting people: names, in the ways people write them; an address is used only to make a name and is never kept', () => {
  const t = ['Ana Smith, ana@example.test', 'Bob Jones <bob@example.test>', 'cy@example.test Cy Cousin', 'Dee - dee@example.test', 'eli.park@example.test', '  ', 'Fay Wu | fay@example.test; Gus', 'ANA@example.test again', 'Hal'].join('\n');
  const rows = parseInviteLines(t);
  assert.deepEqual(rows.map((r) => r.name), ['Ana Smith', 'Bob Jones', 'Cy Cousin', 'Dee', 'Eli Park', 'Fay Wu', 'Gus', 'again', 'Hal']);
  assert.ok(rows.every((r) => Object.keys(r).join() === 'name'), 'an address is not carried');
  assert.deepEqual(parseInviteLines('Ana\nana\n ANA '), [{ name: 'Ana' }], 'a name once');
  assert.deepEqual(parseInviteLines(''), []);
  assert.equal(nameFromAddress('j.r.r_tolkien+x7@example.test'), 'J R R Tolkien X');
  assert.equal(cleanName('  Ana\n  Q.\u0007 '), 'Ana Q.');
});

test('onlineNow is a pure function: latest heartbeat per sender, stale and future and unknown senders dropped, names from the owner', () => {
  const T = 'p';
  const evs = [
    { type: T, sender: '@a:x', origin_server_ts: 900, content: { viewing: 'old' } },
    { type: T, sender: '@a:x', origin_server_ts: 990, content: { viewing: 'new', name: 'Spoof' } },
    { type: T, sender: '@b:x', origin_server_ts: 100, content: { viewing: 'stale' } },
    { type: T, sender: '@c:x', origin_server_ts: 5000, content: { viewing: 'future' } },
    { type: T, sender: '@d:x', origin_server_ts: 990, content: { viewing: 'stranger' } },
    { type: T, decrypted: false, sender: '@e:x', origin_server_ts: 999, content: {} },
  ];
  const r = onlineNow(evs, { type: T, now: 1000, ttl: 200, nameOf: (u) => ({ '@a:x': 'Ana' }[u] || null), roleOf: (u) => (u === '@d:x' ? null : 'member') });
  assert.deepEqual(r.map((p) => [p.name, p.viewing]), [['Ana', 'new']]);
});

test('the invitation key: the link’s private half signs (door, account); the public half in room state verifies; nothing else does', async () => {
  const k = await newInviteKey();
  assert.match(k.seed, /^[A-Za-z0-9_-]{43}$/);
  assert.match(k.pub, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(k.seed, k.pub);
  const ctx = { door: '!d:x', user: '@a:x' };
  const sig = await signInvite(k.seed, ctx);
  assert.match(sig, /^[A-Za-z0-9_-]{86}$/);
  assert.equal(sig, await signInvite(k.seed, ctx), 'Ed25519 is deterministic');
  assert.equal(await verifyInvite(k.pub, ctx, sig), true);
  assert.equal(await verifyInvite(k.pub, { ...ctx, user: '@b:x' }, sig), false, 'another account');
  assert.equal(await verifyInvite(k.pub, { ...ctx, door: '!e:x' }, sig), false, 'another door');
  const other = await newInviteKey();
  assert.equal(await verifyInvite(other.pub, ctx, sig), false, 'another invitation');
  assert.equal(await verifyInvite(k.pub, ctx, sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')), false, 'a tampered signature');
  assert.equal(await verifyInvite('not a key', ctx, sig), false, 'garbage is false, not a throw');
  assert.equal(await verifyInvite(k.pub, ctx, ''), false);
});
