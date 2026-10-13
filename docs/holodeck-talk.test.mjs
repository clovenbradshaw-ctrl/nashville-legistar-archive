// holodeck-talk.test.mjs — comments, the inbox and group chat, over the same encrypted stores.
//
// Same discipline as holodeck-share.test.mjs: every falsifier is paired with a CONTROL built to fail, and the
// control must be caught — a probe that does not catch its control is not evidence. Pure modules against
// holodeck-fake-matrix.js: this proves the decisions in holodeck-talk.js, not Megolm (that is the live tier).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFakeServer, fakeAttach } from './holodeck-fake-matrix.js';
import { makeShare } from './holodeck-share.js';
import { REFUSAL } from './holodeck-seal.js';
import { ledgerFromEvents, LEDGER } from './holodeck-roles.js';
import {
  TALK, STORE, REFUSE, TalkRefusal, anchorOf, textAnchor, anchorKey, locate, talkRoomBody, foldTalk, inboxOf, makeTalk,
} from './holodeck-talk.js';

const HS = 'test.local';
const BASE = 'https://example.test/holodeck/';
const U = { owner: '@owner:' + HS, alice: '@alice:' + HS, bob: '@bob:' + HS, eve: '@eve:' + HS };
const CANARY = 'CANARY-5c21e0-the-director-admitted-this';

function world() {
  const server = createFakeServer({ name: HS });
  const refusals = [];
  const mxs = {
    owner: server.client(U.owner, { crossSigned: true }),
    alice: server.client(U.alice, { crossSigned: true }),
    bob: server.client(U.bob, { crossSigned: true }),
    eve: server.client(U.eve, { crossSigned: false }),
  };
  const S = {};
  for (const k of Object.keys(mxs)) S[k] = makeShare({ mx: mxs[k], attach: fakeAttach, onRefuse: (r) => refusals.push(r), now: () => server.now() });
  const T = {};
  for (const k of Object.keys(mxs)) T[k] = makeTalk({ share: S[k], now: () => server.now() });
  return { server, mxs, S, T, refusals };
}

async function join(w, who, repo, { role = 'editor', history = true } = {}) {
  const mint = await w.S.owner.mintInvite(repo, { role, history, base: BASE });
  const red = await w.S[who].redeem({ input: mint.link });
  await w.S.owner.confirm(repo, { door: mint.door, entered: red.myCode });
  const acc = await w.S[who].acceptGrant({ door: red.door, ownerCode: red.ownerCodes[0].code });
  return acc.repo;
}

const doc = (n) => 'src:u' + n;
const at = (n) => ({ kind: 'source', doc: doc(n) });

// ---------------------------------------------------------------- anchors

test('anchors: each kind has a required shape, and a bad one is refused with a reason', () => {
  assert.deepEqual(anchorOf(at(1)), { kind: 'source', doc: doc(1) });
  assert.equal(anchorOf({ kind: 'room' }).kind, 'room');
  assert.equal(anchorOf({ kind: 'name', name: ' Acme Corp ' }).name, 'Acme Corp');
  assert.deepEqual(anchorOf({ kind: 'moment', doc: doc(2), t: 61.234 }), { kind: 'moment', doc: doc(2), t: 61.2 });
  const t = anchorOf({ kind: 'text', doc: doc(1), s: 4, e: 9, quote: 'words', before: 'the ', after: ' go' });
  assert.equal(t.quote, 'words');
  for (const bad of [null, {}, { kind: 'nope' }, { kind: 'source' }, { kind: 'name', name: '  ' }, { kind: 'text', doc: doc(1), s: 5, e: 5, quote: 'x' }, { kind: 'text', doc: doc(1), s: 1, e: 4 }, { kind: 'moment', doc: doc(1), t: -1 }, { kind: 'statement', doc: doc(1) }]) {
    assert.throws(() => anchorOf(bad), (e) => e instanceof TalkRefusal && e.code === REFUSE.BadAnchor && !!e.why, JSON.stringify(bad));
  }
});

test('T7 — a text anchor finds its words again after the text moves, and says "detached" when they are gone', () => {
  const v1 = 'Intro. The contract was awarded without a bid. Closing remarks.';
  const s = v1.indexOf('awarded'), e = s + 'awarded without a bid'.length;
  const a = textAnchor(doc(1), v1, s, e);
  assert.deepEqual(locate(v1, a), { s, e, how: 'exact' });
  const v2 = 'A new paragraph was added above. ' + v1;
  const m = locate(v2, a);
  assert.equal(m.how, 'moved');
  assert.equal(v2.slice(m.s, m.e), 'awarded without a bid');
  assert.equal(locate('Nothing like it here.', a).how, 'detached');
  // two copies of the words: the one with the same context wins, not the nearest
  const dup = 'awarded without a bid. // ' + v1;
  assert.equal(dup.slice(locate(dup, a).s - 4, locate(dup, a).s), 'was ');
  // CONTROL: trusting the recorded offsets alone mis-points after the move, and the probe sees it
  assert.notEqual(v2.slice(a.s, a.e), 'awarded without a bid');
});

test('anchorKey groups threads by place, and text anchors are one place per span', () => {
  assert.equal(anchorKey(at(1)), anchorKey(at(1)));
  assert.notEqual(anchorKey(at(1)), anchorKey(at(2)));
  assert.notEqual(anchorKey({ kind: 'text', doc: doc(1), s: 1, e: 3, quote: 'ab' }), anchorKey({ kind: 'text', doc: doc(1), s: 1, e: 4, quote: 'abc' }));
});

// ---------------------------------------------------------------- the fold (pure)

const ev = (type, content, sender, ts, id) => ({ event_id: id || `$${type.split('.').pop()}${ts}`, type, content, sender, origin_server_ts: ts, decrypted: true });
const cm = (id, anchor, body, sender, ts, extra = {}) => ev(TALK.comment, { v: 1, id, anchor, body, ...extra }, sender, ts, '$' + id);
const ledgerWith = (entries) => ledgerFromEvents(entries.map(([user, role, ts]) => ({ type: LEDGER.role, content: { v: 1, user, role }, sender: U.owner, origin_server_ts: ts, event_id: `$r${user}${ts}` })), { owner: U.owner });

test('fold: replies make a thread, chat stays out of the inbox, edits and deletes apply', () => {
  const L = ledgerWith([[U.alice, 'editor', 1], [U.bob, 'reader', 1]]);
  const evs = [
    cm('c1', at(1), 'Is this the final version?', U.alice, 10),
    cm('c2', at(1), 'Yes, signed in March.', U.owner, 20, { parent: 'c1' }),
    cm('c3', at(2), 'Check the figure on page 4', U.bob, 30),
    cm('h1', { kind: 'room' }, 'morning all', U.alice, 40),
    ev(TALK.edit, { v: 1, target: 'c1', body: 'Is this the FINAL version?' }, U.alice, 50),
    cm('c4', at(2), 'spam', U.alice, 60),
    ev(TALK.del, { v: 1, target: 'c4' }, U.alice, 70),
  ];
  const st = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(st.threads.length, 2);
  const t1 = st.threads.find((t) => t.id === 'c1');
  assert.equal(t1.root.body, 'Is this the FINAL version?');
  assert.equal(t1.root.editedAt, 50);
  assert.equal(t1.replies.length, 1);
  assert.deepEqual(t1.participants.sort(), [U.alice, U.owner].sort());
  assert.equal(st.chat.length, 1);
  assert.ok(!st.threads.some((t) => t.root.anchor.kind === 'room'), 'group chat is not an inbox thread');
  assert.ok(st.threads.every((t) => t.id !== 'c4'), 'a thread whose every message is deleted disappears');
  assert.equal(st.dropped.length, 0);
});

test('T5 — only the author edits; only the author or the owner deletes; the rest is counted, not applied', () => {
  const L = ledgerWith([[U.alice, 'editor', 1], [U.bob, 'editor', 1]]);
  const evs = [
    cm('c1', at(1), 'alice says A', U.alice, 10),
    ev(TALK.edit, { v: 1, target: 'c1', body: 'bob rewrote this' }, U.bob, 20),
    ev(TALK.del, { v: 1, target: 'c1' }, U.bob, 30),
  ];
  const st = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(st.threads[0].root.body, 'alice says A');
  assert.equal(st.threads[0].root.deleted, false);
  assert.equal(st.dropped.length, 2);
  assert.ok(st.dropped.every((d) => d.sender === U.bob && d.why));
  // the owner may delete anyone's comment
  const st2 = foldTalk([...evs.slice(0, 1), ev(TALK.del, { v: 1, target: 'c1' }, U.owner, 40)], { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(st2.threads.length, 0);
  // CONTROL: a naive fold that applies every edit changes the body — the probe above would see that
  const naive = evs.filter((e) => e.type === TALK.edit).reduce((b, e) => e.content.body, 'alice says A');
  assert.notEqual(naive, 'alice says A');
});

test('T3 — a sender who held no role when they wrote is dropped and counted; the control without the ledger admits them', () => {
  const L = ledgerWith([[U.alice, 'editor', 1]]);
  const evs = [cm('c1', at(1), 'real', U.alice, 10), cm('x1', at(1), 'forged', U.eve, 11)];
  const st = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(st.threads.length, 1);
  assert.equal(st.dropped.length, 1);
  assert.equal(st.dropped[0].sender, U.eve);
  const noGate = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: null });
  assert.equal(noGate.threads.length, 2, 'control: without the second judgement the forged comment is shown');
});

test('T4 — a removed member’s earlier comments stay; a later one is dropped even if the server let it through', () => {
  const L = ledgerFromEvents([
    { type: LEDGER.role, content: { v: 1, user: U.alice, role: 'editor' }, sender: U.owner, origin_server_ts: 1, event_id: '$r1' },
    { type: LEDGER.revoke, content: { v: 1, user: U.alice }, sender: U.owner, origin_server_ts: 50, event_id: '$r2' },
  ], { owner: U.owner });
  const st = foldTalk([cm('c1', at(1), 'before', U.alice, 20), cm('c2', at(1), 'after', U.alice, 60, { parent: 'c1' })], { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(st.threads[0].count, 1);
  assert.equal(st.threads[0].root.body, 'before');
  assert.equal(st.dropped.length, 1);
});

test('T6 — the inbox gathers every thread across sources: newest first, unread by read marker, filters, per-source counts', () => {
  const L = ledgerWith([[U.alice, 'editor', 1], [U.bob, 'reader', 1]]);
  const evs = [
    cm('a', at(1), 'first source question', U.alice, 100),
    cm('b', at(2), 'second source note @owner', U.bob, 200, { mentions: [U.owner] }),
    cm('c', { kind: 'name', name: 'Acme Corp' }, 'who are they?', U.alice, 300),
    cm('d', at(1), 'follow up', U.bob, 400, { parent: 'a' }),
    ev(TALK.resolve, { v: 1, thread: 'b', resolved: true }, U.owner, 450),
  ];
  const st = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: L });
  assert.deepEqual(st.threads.map((t) => t.id), ['a', 'c', 'b'], 'ordered by the latest activity in each thread');
  assert.equal(st.unread, 4);
  assert.equal(st.mentionsMe, 1);
  assert.deepEqual(inboxOf(st, { filter: 'mentions' }).map((t) => t.id), ['b']);
  assert.deepEqual(inboxOf(st, { filter: 'open' }).map((t) => t.id), ['a', 'c']);
  assert.deepEqual(inboxOf(st, { filter: 'resolved' }).map((t) => t.id), ['b']);
  assert.deepEqual(inboxOf(st, { doc: doc(1) }).map((t) => t.id), ['a']);
  assert.deepEqual(st.byDoc[doc(1)], { total: 1, open: 1, unread: 2 });
  assert.equal(st.byDoc[doc(2)].open, 0);
  // reading moves the marker: only what arrives afterwards is unread, and only for the one who read
  const read = foldTalk([...evs, ev(TALK.read, { v: 1, upTo: 450 }, U.owner, 500), cm('e', at(2), 'one more', U.alice, 600, { parent: 'b' })], { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(read.unread, 1);
  // a thread can be read on its own: opening 'a' clears its two messages and leaves the rest unread
  const one = foldTalk([...evs, ev(TALK.read, { v: 1, upTo: 450, thread: 'a' }, U.owner, 500)], { me: U.owner, owner: U.owner, ledger: L });
  assert.equal(one.unread, 2);
  assert.equal(one.byDoc[doc(1)].unread, 0);
  // unread is per person: alice wrote 'a' and 'c', so only what bob wrote is new to her
  const hers = foldTalk(evs, { me: U.alice, owner: U.owner, ledger: L });
  assert.equal(hers.unread, 2);
});

test('undecryptable events are counted, not shown and not hidden; unknown types are ignored', () => {
  const evs = [{ event_id: '$u', type: 'm.room.encrypted', content: {}, sender: U.alice, origin_server_ts: 5 }, { event_id: '$n', type: 'io.holodeck.ins', content: {}, sender: U.owner, origin_server_ts: 6, decrypted: true }];
  const st = foldTalk(evs, { me: U.owner, owner: U.owner, ledger: null });
  assert.equal(st.undecryptable, 1);
  assert.equal(st.threads.length, 0);
});

// ---------------------------------------------------------------- the room and the transport

test('the talk room is born encrypted and invite-only; members can talk, only the owner can change rules', () => {
  const b = talkRoomBody({ repoId: 'abc12345', owner: U.owner });
  const get = (t) => b.initial_state.find((s) => s.type === t);
  assert.equal(get('m.room.encryption').content.algorithm, 'm.megolm.v1.aes-sha2');
  assert.equal(get('m.room.join_rules').content.join_rule, 'invite');
  assert.equal(b.power_level_content_override.events_default, 0, 'every member can send');
  assert.equal(b.power_level_content_override.events['m.room.encryption'], 100);
  assert.equal(b.power_level_content_override.state_default, 100);
  assert.ok(!/title|corpus|workspace/i.test(b.name));
});

test('owner sets up the conversation; an invited editor and a reader both join and talk; the three data stores are untouched', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const ra = await join(w, 'alice', repo, { role: 'editor' });
  const rb = await join(w, 'bob', repo, { role: 'reader' });
  const room = await w.T.owner.ensure(repo);
  assert.ok(room && room !== repo.rooms.records);
  assert.equal(room, await w.T.owner.ensure(repo), 'running it again changes nothing');
  assert.equal(await w.T.alice.adopt(ra), room);
  assert.equal(await w.T.bob.adopt(rb), room);

  const id1 = await w.T.alice.send(ra, { anchor: at(1), body: 'Is page 3 the signed copy?' });
  const id2 = await w.T.bob.send(rb, { anchor: at(1), body: 'Looks unsigned to me', parent: id1 });         // a reader can comment
  await w.T.owner.send(repo, { anchor: { kind: 'room' }, body: 'Let us settle this on Thursday' });

  const s = await w.T.owner.state(repo);
  assert.equal(s.threads.length, 1);
  assert.equal(s.threads[0].count, 2);
  assert.equal(s.chat.length, 1);
  assert.deepEqual((await w.T.bob.state(rb)).threads[0].replies.map((c) => c.id), [id2]);

  // a reader still cannot change the evidence
  await assert.rejects(() => w.S.bob.write(rb, 'ins', { anchor: 'src:x', entity_type: 'Sources', payload: {} }), (e) => e.code === 'reader-cannot-write' || /read/.test(e.why || e.message));
  // and the data stores hold no talk events
  for (const st of ['sources', 'records']) {
    const types = (await w.mxs.owner.readEvents(repo.rooms[st])).map((e) => e.type);
    assert.ok(!types.some((t) => t.includes('.talk.')), st + ' holds no comments');
  }
});

test('T1 — nothing the server holds contains a comment or a chat line; every talk event is m.room.encrypted', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const ra = await join(w, 'alice', repo, { role: 'editor' });
  await w.T.owner.ensure(repo);
  await w.T.alice.adopt(ra);
  await w.T.alice.send(ra, { anchor: textAnchor(doc(1), 'the director ' + CANARY + ' and so on', 13, 13 + CANARY.length), body: 'quote: ' + CANARY });
  await w.T.owner.send(repo, { anchor: { kind: 'room' }, body: 'chat: ' + CANARY });
  assert.equal(w.server.scan(CANARY), 0, 'the server holds no plaintext canary');
  const room = await w.T.owner.roomOf(repo);
  const types = w.server.typesIn(room).filter((t) => t !== 'm.room.member');
  assert.ok(types.length >= 2 && types.every((t) => t === 'm.room.encrypted'), 'got ' + [...new Set(types)]);
  const s = await w.T.alice.state(ra);
  assert.ok(JSON.stringify(s).includes(CANARY), 'and a member still reads it');
});

test('T1 control — a talk room made without encryption would leak, and the transport refuses to write to one', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  // (a) the probe sees plaintext in an unencrypted room built the same way
  const body = talkRoomBody({ repoId: 'ctl', owner: U.owner });
  body.initial_state = body.initial_state.filter((s) => s.type !== 'm.room.encryption');
  const plain = await w.mxs.owner.createRoom(body);
  await w.mxs.owner.sendEvent(plain, TALK.comment, { v: 1, id: 'x', anchor: { kind: 'room' }, body: CANARY });
  assert.ok(w.server.scan(CANARY) > 0, 'control: the probe finds plaintext when the room is unencrypted');
  // (b) the real transport refuses it, with zero writes
  const w2 = world();
  const repo2 = await w2.S.owner.createRepo({ title: 't' });
  const bad = await w2.mxs.owner.createRoom(body);
  repo2.rooms = { ...repo2.rooms, [STORE]: bad };
  const before = w2.server.requestLog.filter((r) => r.op === 'sendEvent').length;
  await assert.rejects(() => w2.T.owner.send(repo2, { anchor: { kind: 'room' }, body: CANARY }), (e) => e.code === REFUSAL.RoomNotEncrypted);
  assert.equal(w2.server.requestLog.filter((r) => r.op === 'sendEvent').length, before);
  assert.equal(w2.server.scan(CANARY), 0);
  void repo;
});

test('T4 — a removed member is taken out of the conversation and receives nothing written afterwards', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const ra = await join(w, 'alice', repo, { role: 'editor' });
  const room = await w.T.owner.ensure(repo);
  await w.T.alice.adopt(ra);
  await w.T.alice.send(ra, { anchor: at(1), body: 'A before' });
  await w.S.owner.removeMember(repo, { user: U.alice });
  const r = await w.T.owner.reconcile(repo, room);
  assert.deepEqual(r.removed, [U.alice]);
  await w.T.owner.send(repo, { anchor: at(1), body: 'B after ' + CANARY });
  const all = await w.mxs.alice._decryptAll(room);
  const has = (t) => all.some((e) => e.decrypted && JSON.stringify(e.content).includes(t));
  assert.ok(has('A before'));
  assert.ok(!has(CANARY), 'cannot read what was written after removal');
  await assert.rejects(() => w.T.alice.send(ra, { anchor: at(1), body: 'still here?' }));
});

test('send refuses an empty comment, an oversized one, and a missing room — typed, with nothing sent', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const before = () => w.server.requestLog.filter((r) => r.op === 'sendEvent').length;
  await assert.rejects(() => w.T.owner.send(repo, { anchor: at(1), body: 'hi' }), (e) => e.code === REFUSE.NoTalkRoom);
  await w.T.owner.ensure(repo);
  const n = before();
  await assert.rejects(() => w.T.owner.send(repo, { anchor: at(1), body: '   ' }), (e) => e.code === REFUSE.EmptyBody);
  await assert.rejects(() => w.T.owner.send(repo, { anchor: at(1), body: 'x'.repeat(9000) }), (e) => e.code === REFUSE.BodyTooLong);
  await assert.rejects(() => w.T.owner.send(repo, { anchor: { kind: 'text', doc: doc(1) }, body: 'hi' }), (e) => e.code === REFUSE.BadAnchor);
  assert.equal(before(), n);
});

test('a member cannot set up the conversation, and a stranger reads nothing', async () => {
  const w = world();
  const repo = await w.S.owner.createRepo({ title: 't' });
  const ra = await join(w, 'alice', repo, { role: 'editor' });
  await assert.rejects(() => w.T.alice.ensure(ra), (e) => e.code === REFUSE.NotOwner);
  const room = await w.T.owner.ensure(repo);
  await w.T.owner.send(repo, { anchor: at(1), body: CANARY });
  const seen = await w.mxs.eve._decryptAll(room).catch(() => []);
  assert.ok(!seen.some((e) => e.decrypted && JSON.stringify(e.content).includes(CANARY)));
});

test('F11 — no account or org literal in the files this feature adds', () => {
  for (const f of ['holodeck-talk.js', 'holodeck-inbox.js']) {
    if (!fs.existsSync(new URL('./' + f, import.meta.url))) continue;
    const src = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    assert.ok(!/scores-patch-points|clovenbradshaw|github\.com\/[A-Za-z0-9_-]+\//.test(src), f + ' names an account');
    assert.ok(!/localStorage\.setItem\([^)]*(token|secret|password|recovery)/i.test(src), f + ' stores a secret');
  }
});
