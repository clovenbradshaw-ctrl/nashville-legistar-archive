// tests/matrix-invites.live.mjs — the live tier of docs/MATRIX-INVITES-PREREG.md.
//
// The REAL matrix-js-sdk (Rust crypto, Megolm) against a LOCAL homeserver on
// loopback with federation off. Accounts are registered only on that server;
// nothing here touches a public homeserver, and no credential is stored.
//
//   HOLODECK_TEST_HS        homeserver base URL            (default http://127.0.0.1:18008)
//   HOLODECK_MATRIX_SDK     path to a matrix-js-sdk dir    (default ../eodb/node_modules/matrix-js-sdk, a sibling checkout)
//   HOLODECK_SYNAPSE_DB     path to the sqlite database    (enables the server-side plaintext scan)
//   HOLODECK_SYNAPSE_MEDIA  path to the media store dir
//
// Run:  node tests/matrix-invites.live.mjs
// Not part of `node --test *.test.mjs`: it needs a homeserver, and says so plainly when none is up.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const HS = process.env.HOLODECK_TEST_HS || 'http://127.0.0.1:18008';
const SDK_DIR = process.env.HOLODECK_MATRIX_SDK || path.resolve(root, '../eodb/node_modules/matrix-js-sdk');
const DB = process.env.HOLODECK_SYNAPSE_DB || '';
const MEDIA = process.env.HOLODECK_SYNAPSE_MEDIA || '';

const results = [];
const note = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const gap = (name, why) => { results.push({ name, ok: null, detail: why }); console.log(`GAP   ${name}  — ${why}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function eventually(fn, ms = 20000, what = 'condition') {
  const end = Date.now() + ms;
  for (;;) { try { const v = await fn(); if (v) return v; } catch { /* retry */ } if (Date.now() > end) throw new Error('timed out waiting for ' + what); await sleep(250); }
}

// ---- preconditions, typed
let reach = false;
try { reach = (await fetch(HS + '/_matrix/client/versions')).ok; } catch { reach = false; }
if (!reach) { console.log(`SKIPPED — no homeserver answered at ${HS}. Start a local Synapse (see docs/MATRIX-INVITES-PREREG.md "live") and re-run.`); process.exit(0); }
if (!fs.existsSync(path.join(SDK_DIR, 'lib/index.js'))) { console.log(`SKIPPED — no matrix-js-sdk at ${SDK_DIR}; set HOLODECK_MATRIX_SDK.`); process.exit(0); }

const sdk = await import(pathToFileURL(path.join(SDK_DIR, 'lib/index.js')).href);
try { const { logger } = await import(pathToFileURL(path.join(SDK_DIR, 'lib/logger.js')).href); logger.setLevel('error'); } catch { /* noisy but harmless */ }
const sdkVersion = JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version;
const { connect } = await import(pathToFileURL(path.join(root, 'holodeck-matrix.js')).href);
const { makeShare, EVT, STORES, REFUSE } = await import(pathToFileURL(path.join(root, 'holodeck-share.js')).href);
const { fold } = await import(pathToFileURL(path.join(root, 'vendor/bare-metal/src/fold.js')).href);
const { fakeAttach } = await import(pathToFileURL(path.join(root, 'holodeck-fake-matrix.js')).href);
const { LEGACY } = await import(pathToFileURL(path.join(root, 'holodeck-legacy.js')).href);
const { sealAttachment } = await import(pathToFileURL(path.join(root, 'holodeck-seal.js')).href);

// eodb's attachment envelope, if it can be loaded in Node; the same shape from WebCrypto otherwise
let attach = fakeAttach, attachSource = 'WebCrypto stand-in (same envelope shape)';
try {
  const eodb = await import(pathToFileURL(path.resolve(root, '../eodb/src/media.js')).href);
  attach = { encrypt: eodb.encryptAttachment, decrypt: eodb.decryptAttachment }; attachSource = 'eodb src/media.js encryptAttachment';
} catch (e) { attachSource = 'WebCrypto stand-in — eodb media.js did not import in Node: ' + String(e && e.message || e).slice(0, 80); }

// ---- accounts on the LOCAL server only
const run = Math.random().toString(36).slice(2, 7);
async function register(name) {
  const username = `hd${run}${name}`;
  const password = 'pw-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  let r = await fetch(HS + '/_matrix/client/v3/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password, auth: { type: 'm.login.dummy' }, initial_device_display_name: 'live-test ' + name }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('register failed: ' + JSON.stringify(j).slice(0, 200));
  return { userId: j.user_id, deviceId: j.device_id, accessToken: j.access_token, username, password };
}
async function loginSecond(acct) {
  const r = await fetch(HS + '/_matrix/client/v3/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'm.login.password', identifier: { type: 'm.id.user', user: acct.username }, password: acct.password, initial_device_display_name: 'second device' }) });
  const j = await r.json(); return { userId: j.user_id, deviceId: j.device_id, accessToken: j.access_token };
}
const clients = [];
async function actor(name, { crossSign = true } = {}) {
  const acct = await register(name);
  const mx = await connect({ sdk, baseUrl: HS, userId: acct.userId, deviceId: acct.deviceId, accessToken: acct.accessToken, memoryCrypto: true });
  clients.push(mx);
  let cs = { ready: false };
  if (crossSign) cs = await mx.ensureCrossSigning();
  const refusals = [];
  const share = makeShare({ mx, attach, onRefuse: (r) => refusals.push(r), log: () => {} });
  return { name, acct, mx, share, refusals, cs };
}
const BASE = 'https://holodeck.example.test/';

try {
  console.log(`# live tier — sdk ${sdkVersion}, server ${HS}, attachments: ${attachSource}`);
  const ver = await (await fetch(HS + '/_synapse/admin/v1/server_version').catch(() => ({ json: async () => ({}) }))).json().catch(() => ({}));
  void ver;

  const owner = await actor('owner');
  const alice = await actor('alice');
  const bob = await actor('bob', { crossSign: false });
  note('cross-signing bootstrapped without a password (owner, alice)', owner.cs.ready && alice.cs.ready, owner.cs.ready ? '' : JSON.stringify(owner.cs.gap || {}));

  // ---------- L1: stores are created encrypted
  const repo = await owner.share.createRepo({ title: 'Live repo title ' + run });
  for (const s of STORES) {
    const evs = await (await fetch(`${HS}/_matrix/client/v3/rooms/${encodeURIComponent(repo.rooms[s])}/state`, { headers: { authorization: 'Bearer ' + owner.acct.accessToken } })).json();
    const enc = evs.find((e) => e.type === 'm.room.encryption');
    note(`store ${s}: m.room.encryption is megolm in server state`, enc && enc.content.algorithm === 'm.megolm.v1.aes-sha2');
  }
  const CANARY = 'LIVECANARY-' + run + '-the-contractor-said-this';

  // ---------- history candidate: written BEFORE anyone is invited
  await owner.share.write(repo, 'ins', { anchor: 'st:old', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:old', path: 'body', value: 'written before invite ' + CANARY });

  // ---------- F2 live: before confirm, nothing readable
  const mint = await owner.share.mintInvite(repo, { role: 'editor', history: true, base: BASE });
  note('invite link is the page plus #join=<code> only', mint.link === BASE + '#join=' + mint.code && !mint.link.includes('?'));
  const red = await alice.share.redeem({ input: mint.link });
  await owner.share.write(repo, 'ins', { anchor: 'st:pre', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:pre', path: 'body', value: 'written while waiting ' + CANARY });
  let preRead = 0;
  for (const s of STORES) {
    const r = await fetch(`${HS}/_matrix/client/v3/rooms/${encodeURIComponent(repo.rooms[s])}/messages?dir=b&limit=50`, { headers: { authorization: 'Bearer ' + alice.acct.accessToken } });
    if (r.ok) preRead += (await r.json()).chunk.length;     // a 403 here is the expected answer
  }
  note('F2: before confirm the invitee cannot fetch a single store event from the server', preRead === 0, `events fetched: ${preRead}`);
  await assert.rejects(() => alice.share.acceptGrant({ door: red.door }), (e) => e.code === REFUSE.NoGrantYet);
  note('F2: before confirm there is no grant to accept', true);

  // owner sees the request, confirms by typing the code
  const pend = await eventually(async () => { const p = await owner.share.pendingRequests(mint.door); return p.length ? p : null; }, 30000, 'the request to arrive and decrypt');
  note('request arrives decrypted at the owner; fingerprint re-derived from the real device key', pend[0].code === red.myCode && !pend[0].forged, `code ${pend[0].code === red.myCode ? 'matches' : 'DIFFERS'}`);
  await assert.rejects(() => owner.share.confirm(repo, { door: mint.door, entered: red.myCode === '123456' ? '654321' : '123456' }), (e) => e.code === REFUSE.CodeMismatch);
  note('wrong code refused, nothing granted', (await owner.mx.roomState(repo.rooms.records)).members[alice.acct.userId] === undefined);
  const conf = await owner.share.confirm(repo, { door: mint.door, entered: red.myCode });
  note('confirm: history claim is typed', typeof conf.history.can === 'boolean', JSON.stringify(conf.history));
  const acc = await eventually(async () => { try { return await alice.share.acceptGrant({ door: red.door, ownerCode: red.ownerCodes[0].code }); } catch (e) { if (e.code === REFUSE.NoGrantYet) return null; throw e; } }, 30000, 'the grant to arrive');
  note('invitee joined as editor via a grant from the door creator', acc.repo.role === 'editor');
  note('the alias stops resolving after confirm (single use)', (await eventually(async () => (await (await fetch(`${HS}/_matrix/client/v3/directory/room/${encodeURIComponent('#' + mint.code + ':' + owner.mx.server)}`)).status) === 404, 10000, 'alias removal').catch(() => false)) === true);

  // ---------- writes by the editor; the owner reads them through the gate
  await alice.share.write(acc.repo, 'ins', { anchor: 'st:alice', entity_type: 'Statements', payload: {} });
  await alice.share.write(acc.repo, 'def', { anchor: 'st:alice', path: 'body', value: 'from alice ' + CANARY });
  const seen = await eventually(async () => { const st = await owner.share.readState(repo, { fold }); return st.state.entities['st:alice'] && st; }, 30000, "alice's write to decrypt at the owner");
  note('editor write read by the owner through ledger → gate → fold', seen.state.entities['st:alice']._sender === alice.acct.userId && seen.refused.length === 0);

  // ---------- F8 live: the history claim matches what the invitee can read
  const stA = await eventually(async () => { const s = await alice.share.readState(acc.repo, { fold }); return s; }, 20000, 'alice reads state');
  const readsOld = !!stA.state.entities['st:old'];
  note('F8: "can read past" claim equals what the invitee actually reads', conf.history.can === readsOld, `claimed ${conf.history.can}${conf.history.gap ? ' (' + conf.history.gap + ')' : ''}, observed ${readsOld}`);
  if (!conf.history.can) gap('F8: history bundle delivery', `not delivered: ${conf.history.gap || 'invitee/owner capability'}; undecryptable events counted: ${stA.state._undecryptable}`);

  // ---------- F7: a reader cannot write, at the page, at the server, and in the fold
  const mintB = await owner.share.mintInvite(repo, { role: 'reader', history: false, base: BASE });
  const redB = await bob.share.redeem({ input: mintB.link });
  await eventually(async () => (await owner.share.pendingRequests(mintB.door)).length, 30000, "bob's request");
  await owner.share.confirm(repo, { door: mintB.door, entered: redB.myCode });
  const accB = await eventually(async () => { try { return await bob.share.acceptGrant({ door: redB.door, ownerCode: redB.ownerCodes[0].code }); } catch (e) { if (e.code === REFUSE.NoGrantYet) return null; throw e; } }, 30000, "bob's grant");
  const stB = await eventually(async () => bob.share.readState(accB.repo, { fold }), 20000, 'bob reads state');
  note('F8: an invite with history = no reads nothing from before the join', !stB.state.entities['st:old'] && !stB.state.entities['st:pre'], `undecryptable counted: ${stB.state._undecryptable}`);
  await assert.rejects(() => bob.share.write(accB.repo, 'ins', { anchor: 'st:bob', entity_type: 'Statements', payload: {} }), (e) => e.code === REFUSE.ReaderCannotWrite);
  note('F7: reader refused at the page', true);
  let serverRefused = false;
  try { await bob.mx._client.sendEvent(repo.rooms.records, 'io.holodeck.ins', { anchor: 'st:bob', entity_type: 'Statements', payload: {} }); } catch (e) { serverRefused = e.errcode === 'M_FORBIDDEN' || e.httpStatus === 403; }
  note('F7: reader refused by the homeserver (power level)', serverRefused);

  // ---------- F3 live: removal
  const preB = await owner.share.write(repo, 'ins', { anchor: 'st:A', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:A', path: 'body', value: 'A ' + CANARY });
  await eventually(async () => { const st = await alice.share.readState(acc.repo, { fold }); return st.state.entities['st:A']; }, 20000, 'alice reads A');
  const rem = await owner.share.removeMember(repo, { user: alice.acct.userId });
  note('removal steps recorded', rem.steps.every((s) => !/failed/.test(s)), rem.steps.join(','));
  await owner.share.write(repo, 'ins', { anchor: 'st:B', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:B', path: 'body', value: 'B ' + CANARY });
  // hand the removed member's real device ALL the ciphertext of the records room, and ask it to decrypt
  const raw = await (await fetch(`${HS}/_matrix/client/v3/rooms/${encodeURIComponent(repo.rooms.records)}/messages?dir=b&limit=200`, { headers: { authorization: 'Bearer ' + owner.acct.accessToken } })).json();
  let readA = false, readB = false;
  for (const e of raw.chunk) {
    if (e.type !== 'm.room.encrypted') continue;
    const ev = new sdk.MatrixEvent(e);
    try { await alice.mx._client.decryptEventIfNeeded(ev); } catch { /* failure is the answer */ }
    if (ev.isDecryptionFailure() || ev.getType() === 'm.room.encrypted') continue;
    const c = JSON.stringify(ev.getContent());
    if (c.includes('A ' + CANARY)) readA = true;
    if (c.includes('B ' + CANARY)) readB = true;
  }
  note('F3: the removed member still reads what they could read before (disclosure is true)', readA === true);
  note('F3: the removed member cannot decrypt anything written after removal', readB === false);
  void preB;

  // ---------- unverified devices: a second device of a member receives nothing until the owner confirms it
  const second = await loginSecond(bob.acct);
  const bob2 = await connect({ sdk, baseUrl: HS, userId: second.userId, deviceId: second.deviceId, accessToken: second.accessToken, memoryCrypto: true });
  clients.push(bob2);
  const decryptsCanary = async (mx2, tag) => {
    const r = await (await fetch(`${HS}/_matrix/client/v3/rooms/${encodeURIComponent(repo.rooms.records)}/messages?dir=b&limit=200`, { headers: { authorization: 'Bearer ' + owner.acct.accessToken } })).json();
    for (const e of r.chunk) {
      if (e.type !== 'm.room.encrypted') continue;
      const ev = new sdk.MatrixEvent(e);
      try { await mx2._client.decryptEventIfNeeded(ev); } catch { /* the answer */ }
      if (!ev.isDecryptionFailure() && ev.getType() !== 'm.room.encrypted' && JSON.stringify(ev.getContent()).includes(tag)) return true;
    }
    return false;
  };
  await owner.share.write(repo, 'ins', { anchor: 'st:C', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:C', path: 'body', value: 'C-before-confirm ' + CANARY });
  await sleep(2000);
  note('unverified device: a member\u2019s new device cannot decrypt what the owner writes', (await decryptsCanary(bob2, 'C-before-confirm')) === false);
  const devs = await owner.mx.deviceKeysOf(bob.acct.userId);
  note('people list reports the unconfirmed device', (await owner.share.people(repo)).find((p) => p.user === bob.acct.userId).newDevices >= 1, `devices: ${devs.length}`);
  const { pairingCode } = await import(pathToFileURL(path.join(root, 'holodeck-share.js')).href);
  const d2 = devs.find((d) => d.deviceId === second.deviceId);
  await owner.share.confirmDevice(repo, { user: bob.acct.userId, deviceId: second.deviceId, entered: await pairingCode(d2.ed25519) });
  await owner.share.write(repo, 'ins', { anchor: 'st:D', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:D', path: 'body', value: 'D-after-confirm ' + CANARY });
  const gotD = await eventually(async () => decryptsCanary(bob2, 'D-after-confirm'), 20000, 'second device to decrypt after confirm').catch(() => false);
  note('after the owner confirms the device it decrypts what is written next', gotD === true);

  // ---------- F2 control, live: an owner who trusts and invites on request lets the invitee read
  const carol = await actor('carol', { crossSign: false });
  const mintC = await owner.share.mintInvite(repo, { role: 'reader', base: BASE });
  await carol.share.redeem({ input: mintC.link });
  await eventually(async () => (await owner.share.pendingRequests(mintC.door)).length, 30000, "carol's request");
  const carolDev = (await owner.mx.deviceKeysOf(carol.acct.userId))[0];
  await owner.mx.setDeviceVerified(carol.acct.userId, carolDev.deviceId);                        // the eager owner: no code check
  for (const st of STORES) { await owner.mx.invite(repo.rooms[st], carol.acct.userId, { shareHistory: false }); await carol.mx.join(repo.rooms[st]); }
  await owner.share.write(repo, 'ins', { anchor: 'st:E', entity_type: 'Statements', payload: {} });
  await owner.share.write(repo, 'def', { anchor: 'st:E', path: 'body', value: 'E-eager ' + CANARY });
  const carolReads = await eventually(async () => decryptsCanary(carol.mx, 'E-eager'), 20000, 'carol to decrypt').catch(() => false);
  note('F2 control: the probe DOES detect an invitee reading when the owner skips the code check', carolReads === true);

  // ---------- F1 live: what the homeserver actually stored
  const ref = await sealAttachment({ mx: owner.mx, attach }, new TextEncoder().encode('attachment body ' + CANARY), { name: 'a.txt' });
  await owner.share.write(repo, 'def', { anchor: 'src:1', path: 'file', value: ref });
  // positive control: the legacy path, on the same server
  const legacyRoom = await owner.mx._client.createRoom({ name: 'legacy ' + run, preset: 'private_chat', visibility: 'private' });
  const CONTROL = 'LEGACYCONTROL-' + run + '-pins';
  await owner.mx._client.sendStateEvent(legacyRoom.room_id, LEGACY.private, { pins: [CONTROL] }, 'work');
  await sleep(1500);
  if (!DB) gap('F1: server-side plaintext scan', 'HOLODECK_SYNAPSE_DB not set, so the sqlite and media scan was not run');
  else {
    const files = [DB, DB + '-wal', DB + '-shm'].filter((f) => fs.existsSync(f));
    const mediaFiles = [];
    const walk = (d) => { for (const n of fs.existsSync(d) ? fs.readdirSync(d) : []) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : mediaFiles.push(p); } };
    if (MEDIA) walk(MEDIA);
    const count = (needle) => { let n = 0; for (const f of [...files, ...mediaFiles]) { const b = fs.readFileSync(f); let i = 0; const nb = Buffer.from(needle); while ((i = b.indexOf(nb, i)) !== -1) { n++; i += nb.length; } } return n; };
    const hit = count(CANARY), ctl = count(CONTROL), title = count('Live repo title ' + run);
    note(`F1: canary in ${files.length} database file(s) + ${mediaFiles.length} media file(s) = 0`, hit === 0, `found ${hit}`);
    note('F1: workspace title is not in anything the server stored', title === 0, `found ${title}`);
    note('F1 positive control: the legacy private-room state event IS readable in the server database', ctl > 0, `found ${ctl} — if 0 the scanner is blind and F1 is void`);
  }
  // encrypted wire: every store timeline event is m.room.encrypted, as the server returns it
  for (const s of STORES) {
    const m = await (await fetch(`${HS}/_matrix/client/v3/rooms/${encodeURIComponent(repo.rooms[s])}/messages?dir=b&limit=200`, { headers: { authorization: 'Bearer ' + owner.acct.accessToken } })).json();
    // state events (create, power levels, join rules, encryption, our marker) are structure and are never encrypted in Matrix;
    // every event WITHOUT a state_key is content, and must be m.room.encrypted
    const content = m.chunk.filter((e) => e.state_key === undefined);
    const types = [...new Set(content.map((e) => e.type))];
    const stateTypes = [...new Set(m.chunk.filter((e) => e.state_key !== undefined).map((e) => e.type))];
    const stateBad = stateTypes.filter((t) => !/^m\.room\.|^io\.holodeck\.repo\.store$/.test(t));
    note(`F1: ${s} content events as the server returns them are all m.room.encrypted (${content.length})`, content.length > 0 && types.every((t) => t === 'm.room.encrypted'), types.join(','));
    note(`F1: ${s} state events are structural only`, stateBad.length === 0, stateTypes.join(','));
  }

  // ---------- F5 live (module scope): nothing this run wrote to a URL; localStorage is not touched by the share modules
  const src = ['holodeck-share.js', 'holodeck-seal.js', 'holodeck-roles.js', 'holodeck-matrix.js', 'holodeck-legacy.js'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  note('F5: the share modules never reference localStorage, sessionStorage or document.cookie', !/localStorage|sessionStorage|document\.cookie/.test(src.replace(/\/\/.*$/gm, '')));
} catch (e) {
  note('live run completed without an unexpected error', false, String((e && e.stack) || e).slice(0, 600));
} finally {
  for (const c of clients) c.stop();
}

const fail = results.filter((r) => r.ok === false);
console.log(`\n# ${results.filter((r) => r.ok).length} passed, ${fail.length} failed, ${results.filter((r) => r.ok === null).length} typed gaps`);
setTimeout(() => process.exit(fail.length ? 1 : 0), 500);
