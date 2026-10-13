// holodeck-talk.js — comments tied to content, the inbox that gathers them, and the group conversation.
//
// A repo (a Holodeck workspace) already has three encrypted Matrix stores: sources, records, log
// (holodeck-share.js). Comments and chat are a FOURTH store, `talk`, for one reason: the other three are
// read-only for readers (events_default 50) and everything in them is folded into the evidence. A comment
// is not evidence, and a reader must be able to say something. So `talk` is its own encrypted room whose
// members can all send, and whose events never reach the fold of sources/records.
//
//   comment   { id, anchor, body, parent?, mentions? }   a comment, a reply, or a chat message
//   edit      { target, body }                           only the author's own comment
//   delete    { target }                                 the author, or the owner
//   resolve   { thread, resolved }                       close / reopen a thread
//   read      { upTo, thread? }                          a person's own read marker, for everything or for one thread
//
// Everything here is PURE except `makeTalk`, which crosses only through the injected `share`
// (holodeck-share.js): every send goes through `share.sealed.sendEvent`, which refuses any room that is not
// a known, confirmed-encrypted store room (holodeck-seal.js). This module adds no way around the seal.
//
// Who may write is judged twice, like the data stores: the server's power levels, and again here from the
// owner-authored role ledger — an event whose sender had no role at its timestamp (never invited, removed
// since) is dropped and COUNTED, never silently shown.

import { MEGOLM, REPO_MARKER, assertEncrypted } from './holodeck-seal.js';
import { ROLE, POWER, powerLevelsFor, roleAt } from './holodeck-roles.js';

export const NS = 'io.holodeck';
export const STORE = 'talk';
export const TALK = Object.freeze({
  comment: `${NS}.talk.comment`,
  edit: `${NS}.talk.edit`,
  del: `${NS}.talk.delete`,
  resolve: `${NS}.talk.resolve`,
  read: `${NS}.talk.read`,
  room: `${NS}.talk.room`,          // owner-authored, in the log store: "the talk room of this repo is X"
});
export const KINDS = Object.freeze(['source', 'text', 'statement', 'name', 'moment', 'room']);
export const BODY_LIMIT = 8000;
export const REFUSE = Object.freeze({
  BadAnchor: 'bad-anchor',
  EmptyBody: 'empty-body',
  BodyTooLong: 'body-too-long',
  NoTalkRoom: 'no-talk-room',
  NotAuthor: 'not-the-author',
  NotOwner: 'not-the-owner',
  UnknownTarget: 'unknown-comment',
});
export class TalkRefusal extends Error {
  constructor(code, why, detail = {}) { super(why); this.name = 'TalkRefusal'; this.code = code; this.why = why; this.detail = detail; }
}
const refuse = (code, why, detail) => new TalkRefusal(code, why, detail);

// ---------------------------------------------------------------- anchors

const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : null);
const CONTEXT = 24;

/**
 * Normalise an anchor — where a comment is tied. One of:
 *   { kind:'source',    doc }                           the whole source
 *   { kind:'text',      doc, s, e, quote }              a span of the source's text (offsets + the words)
 *   { kind:'statement', doc, st, quote? }               one statement the Holodeck read
 *   { kind:'name',      name }                          a name, across sources
 *   { kind:'moment',    doc, t, quote? }                a second in a recording
 *   { kind:'room' }                                     nothing in particular: the group conversation
 * `doc` is the source's record anchor (`src:<id>`), so every member means the same source.
 */
export function anchorOf(x) {
  const a = x && typeof x === 'object' ? x : {};
  const kind = a.kind;
  if (!KINDS.includes(kind)) throw refuse(REFUSE.BadAnchor, `an anchor has to be one of ${KINDS.join(', ')}`, { kind });
  if (kind === 'room') return { kind };
  if (kind === 'name') {
    const name = str(a.name, 200).trim();
    if (!name) throw refuse(REFUSE.BadAnchor, 'a name anchor needs a name', {});
    return { kind, name };
  }
  const doc = str(a.doc, 300).trim();
  if (!doc) throw refuse(REFUSE.BadAnchor, `a ${kind} anchor needs the source it points into`, { kind });
  if (kind === 'source') return { kind, doc, ...(a.quote ? { quote: str(a.quote, 600) } : {}) };
  if (kind === 'statement') {
    const st = str(a.st, 200).trim();
    if (!st) throw refuse(REFUSE.BadAnchor, 'a statement anchor needs the statement', {});
    return { kind, doc, st, ...(a.quote ? { quote: str(a.quote, 600) } : {}) };
  }
  if (kind === 'moment') {
    const t = num(a.t);
    if (t == null || t < 0) throw refuse(REFUSE.BadAnchor, 'a moment anchor needs a time in seconds', {});
    return { kind, doc, t: Math.round(t * 10) / 10, ...(a.quote ? { quote: str(a.quote, 600) } : {}) };
  }
  // text
  const s = num(a.s), e = num(a.e);
  const quote = str(a.quote, 1200);
  if (s == null || e == null || e <= s || !quote) throw refuse(REFUSE.BadAnchor, 'a text anchor needs where it starts and ends, and the words', {});
  return { kind, doc, s, e, quote, ...(a.before ? { before: str(a.before, CONTEXT) } : {}), ...(a.after ? { after: str(a.after, CONTEXT) } : {}) };
}

/** A text anchor from a selection in `text`: offsets, the words, and a little context to find them again. */
export function textAnchor(doc, text, s, e) {
  const T = String(text || '');
  return anchorOf({ kind: 'text', doc, s, e, quote: T.slice(s, e), before: T.slice(Math.max(0, s - CONTEXT), s), after: T.slice(e, e + CONTEXT) });
}

/** One string per place, so threads at the same place group. Text anchors are one place per span. */
export function anchorKey(a) {
  switch (a && a.kind) {
    case 'source': return `source|${a.doc}`;
    case 'text': return `text|${a.doc}|${a.s}-${a.e}`;
    case 'statement': return `statement|${a.doc}|${a.st}`;
    case 'name': return `name|${a.name}`;
    case 'moment': return `moment|${a.doc}|${a.t}`;
    case 'room': return 'room';
    default: return 'unknown';
  }
}

/**
 * Find a text anchor in the source's CURRENT text. The text can change under a comment (a re-read, an
 * edit), so: the recorded offsets if the words are still there; else the quote, nearest to the old place;
 * else the quote with its context. Never a guess: a comment whose words are gone is reported `detached`.
 * returns { s, e, how: 'exact'|'moved' } or { how: 'detached' }
 */
export function locate(text, a) {
  const T = String(text || '');
  if (!a || a.kind !== 'text') return { how: 'detached' };
  if (T.slice(a.s, a.e) === a.quote) return { s: a.s, e: a.e, how: 'exact' };
  let best = null, from = 0;
  for (;;) {
    const i = T.indexOf(a.quote, from);
    if (i < 0) break;
    const ctxOk = (!a.before || T.slice(Math.max(0, i - a.before.length), i) === a.before) && (!a.after || T.slice(i + a.quote.length, i + a.quote.length + a.after.length) === a.after);
    const d = Math.abs(i - a.s) - (ctxOk ? 1e9 : 0);       // matching context outranks distance
    if (!best || d < best.d) best = { i, d };
    from = i + 1;
  }
  return best ? { s: best.i, e: best.i + a.quote.length, how: 'moved' } : { how: 'detached' };
}

// ---------------------------------------------------------------- the room

/** createRoom body for the talk store: encrypted at creation, invite-only, members can talk, only the owner can change rules. */
export function talkRoomBody({ repoId, owner, epoch = 1 }) {
  const pl = powerLevelsFor({ owner });
  pl.events_default = POWER.reader;           // every member can send comments and chat; state stays owner-only
  return {
    name: `holodeck-${repoId}-${STORE}`,
    preset: 'private_chat',
    visibility: 'private',
    initial_state: [
      { type: 'm.room.encryption', state_key: '', content: { algorithm: MEGOLM } },
      { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'invite' } },
      { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'shared' } },
      { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
      { type: REPO_MARKER, state_key: '', content: { v: 1, repo: repoId, store: STORE, epoch } },
    ],
    power_level_content_override: pl,
  };
}

// ---------------------------------------------------------------- the fold

const byTime = (a, b) => (a.ts - b.ts) || String(a.eventId).localeCompare(String(b.eventId));
const newId = () => 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/**
 * Fold the talk room's events into what the page shows.
 *   events: [{ event_id, type, content, sender, origin_server_ts, decrypted }]
 *   opts:   { me, owner, ledger (holodeck-roles ledger) | null, mentions? }
 * returns {
 *   threads:  [{ id, key, anchor, root, replies, participants, last, count, resolved, resolvedBy, unread, mentionsMe, detached? }]  newest activity first
 *   chat:     [comment]            the group conversation, oldest first
 *   byDoc:    { [doc]: { total, open, unread } }
 *   unread, mentionsMe, undecryptable,
 *   dropped:  [{ eventId, sender, why }]        counted, never hidden
 * }
 */
export function foldTalk(events, { me = '', owner = '', ledger = null } = {}) {
  const dropped = [];
  let undecryptable = 0;
  const evs = [];
  for (const e of events || []) {
    if (!e) continue;
    if (e.decrypted === false || e.type === 'm.room.encrypted') { undecryptable++; continue; }
    if (!Object.values(TALK).includes(e.type)) continue;                 // not ours: ignored, not an error
    const ts = e.origin_server_ts || 0;
    const sender = e.sender || '';
    // the second judgement: this sender had a role in the repo when it wrote
    const role = sender === owner ? ROLE.owner : (ledger ? roleAt(ledger, sender, ts) : ROLE.reader);
    if (!role) { dropped.push({ eventId: e.event_id, sender, why: 'not a member of this repo when it was written' }); continue; }
    evs.push({ type: e.type, c: e.content || {}, sender, ts, eventId: e.event_id, role });
  }
  evs.sort(byTime);

  const comments = new Map();                                            // id -> comment
  const resolves = new Map();                                            // thread id -> { resolved, by, ts }
  const marks = new Map();                                               // user -> upTo
  const tmarks = new Map();                                              // user|thread -> upTo
  for (const ev of evs) {
    const c = ev.c;
    if (ev.type === TALK.comment) {
      if (typeof c.id !== 'string' || !c.id || comments.has(c.id)) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'a comment without an id, or an id used twice' }); continue; }
      let anchor;
      try { anchor = anchorOf(c.anchor); } catch { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'a comment with no valid anchor' }); continue; }
      const body = typeof c.body === 'string' ? c.body : '';
      if (!body.trim() || body.length > BODY_LIMIT) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'an empty or oversized comment' }); continue; }
      const parent = typeof c.parent === 'string' && comments.has(c.parent) ? c.parent : null;
      comments.set(c.id, { id: c.id, anchor, body, author: ev.sender, role: ev.role, ts: ev.ts, eventId: ev.eventId, parent, mentions: Array.isArray(c.mentions) ? c.mentions.filter((m) => typeof m === 'string').slice(0, 20) : [], editedAt: null, deleted: false });
    } else if (ev.type === TALK.edit) {
      const t = comments.get(c.target);
      if (!t) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'an edit of a comment that is not here' }); continue; }
      if (t.author !== ev.sender) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'an edit by someone who is not the author' }); continue; }
      if (typeof c.body === 'string' && c.body.trim() && c.body.length <= BODY_LIMIT && !t.deleted) { t.body = c.body; t.editedAt = ev.ts; }
    } else if (ev.type === TALK.del) {
      const t = comments.get(c.target);
      if (!t) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'a delete of a comment that is not here' }); continue; }
      if (t.author !== ev.sender && ev.role !== ROLE.owner) { dropped.push({ eventId: ev.eventId, sender: ev.sender, why: 'a delete by someone who is neither the author nor the owner' }); continue; }
      t.deleted = true; t.body = ''; t.deletedBy = ev.sender;
    } else if (ev.type === TALK.resolve) {
      if (typeof c.thread === 'string') resolves.set(c.thread, { resolved: c.resolved !== false, by: ev.sender, ts: ev.ts });
    } else if (ev.type === TALK.read) {
      if (!Number.isFinite(c.upTo)) continue;
      if (typeof c.thread === 'string' && c.thread) { const k = ev.sender + '|' + c.thread; tmarks.set(k, Math.max(tmarks.get(k) || 0, c.upTo)); }
      else marks.set(ev.sender, Math.max(marks.get(ev.sender) || 0, c.upTo));
    }
  }

  const myMark = marks.get(me) || 0;
  const rootOf = (c) => { let x = c, n = 0; while (x.parent && comments.has(x.parent) && n++ < 50) x = comments.get(x.parent); return x; };
  const groups = new Map();                                              // root id -> [comments]
  const chat = [];
  for (const c of [...comments.values()].sort(byTime)) {
    if (c.anchor.kind === 'room' && !c.parent) { chat.push(c); continue; }
    const r = rootOf(c);
    (groups.get(r.id) || groups.set(r.id, []).get(r.id)).push(c);
  }
  const threadOf = (c) => (c.anchor.kind === 'room' && !c.parent ? 'room' : rootOf(c).id);
  const isNew = (c) => c.author !== me && !c.deleted && c.ts > Math.max(myMark, tmarks.get(me + '|' + threadOf(c)) || 0);
  const mentionsMe = (c) => !!me && c.mentions.includes(me) && !c.deleted;

  const threads = [];
  for (const [rid, list] of groups) {
    const root = comments.get(rid);
    if (!root) continue;
    if (root.anchor.kind === 'room') continue;
    const rep = resolves.get(rid);
    const replies = list.filter((c) => c.id !== rid);
    const live = list.filter((c) => !c.deleted);
    threads.push({
      id: rid, key: anchorKey(root.anchor), anchor: root.anchor, root, replies,
      participants: [...new Set(live.map((c) => c.author))],
      last: Math.max(...list.map((c) => c.ts)), count: live.length,
      resolved: !!(rep && rep.resolved), resolvedBy: rep && rep.resolved ? rep.by : null,
      unread: list.filter(isNew).length, mentionsMe: list.some(mentionsMe),
      allDeleted: live.length === 0,
    });
  }
  threads.sort((a, b) => b.last - a.last);

  const byDoc = {};
  for (const t of threads) {
    if (t.allDeleted || !t.anchor.doc) continue;
    const d = byDoc[t.anchor.doc] || (byDoc[t.anchor.doc] = { total: 0, open: 0, unread: 0 });
    d.total++; if (!t.resolved) d.open++; d.unread += t.unread;
  }
  const chatUnread = chat.filter(isNew).length;
  return {
    threads: threads.filter((t) => !t.allDeleted), chat, byDoc,
    chatUnread,
    unread: threads.reduce((n, t) => n + t.unread, 0) + chatUnread,
    mentionsMe: threads.filter((t) => t.mentionsMe).length + chat.filter(mentionsMe).length,
    undecryptable, dropped, marks: Object.fromEntries(marks),
  };
}

/** The inbox is a view over threads: filter and order, never a second store. */
export function inboxOf(state, { filter = 'all', doc = null, me = '' } = {}) {
  let list = state.threads;
  if (filter === 'unread') list = list.filter((t) => t.unread > 0);
  else if (filter === 'open') list = list.filter((t) => !t.resolved);
  else if (filter === 'resolved') list = list.filter((t) => t.resolved);
  else if (filter === 'mentions') list = list.filter((t) => t.mentionsMe);
  else if (filter === 'mine') list = list.filter((t) => t.participants.includes(me));
  if (doc) list = list.filter((t) => t.anchor.doc === doc);
  return list;
}

// ---------------------------------------------------------------- the crossing

/**
 * makeTalk({ share }) — the thin client over the sealed store transport.
 *   share: a holodeck-share.js instance (its `sealed`, `known`, `mx`, `people`, `ledgerOf`)
 * Rooms are never created or written except through share.sealed, which asserts encryption first.
 */
export function makeTalk({ share, now = () => Date.now(), log = () => {} } = {}) {
  const mx = share.mx;
  const say = (kind, text) => { try { log({ kind, text }); } catch { /* a log sink never changes behaviour */ } };
  const REG = 'io.holodeck.repos';

  async function regRooms(repo) {
    const r = (await mx.getAccountData(REG)) || {};
    const e = r.repos && r.repos[repo.repoId];
    return e && e.rooms ? e.rooms : {};
  }

  /** The talk room of this repo as this account knows it: the registry, or the owner's announcement in the log. */
  async function roomOf(repo) {
    if (repo.rooms && repo.rooms[STORE]) return repo.rooms[STORE];
    const reg = await regRooms(repo);
    if (reg[STORE]) { repo.rooms = { ...repo.rooms, [STORE]: reg[STORE] }; return reg[STORE]; }
    const evs = (await mx.readEvents(repo.rooms.log)).filter((e) => e.decrypted && e.type === TALK.room && e.sender === repo.owner);
    const last = evs.sort((a, b) => a.origin_server_ts - b.origin_server_ts).pop();
    const id = last && last.content && last.content.room;
    if (typeof id === 'string' && id) { repo.rooms = { ...repo.rooms, [STORE]: id }; return id; }
    return null;
  }

  async function remember(repo, roomId) {
    const r = (await mx.getAccountData(REG)) || {};
    const repos = r.repos && typeof r.repos === 'object' ? { ...r.repos } : {};
    const cur = repos[repo.repoId] || { rooms: { ...repo.rooms }, role: repo.role, owner: repo.owner, epoch: repo.epoch };
    repos[repo.repoId] = { ...cur, rooms: { ...(cur.rooms || {}), [STORE]: roomId } };
    await mx.setAccountData(REG, { repos });
  }

  async function ready(roomId) {
    share.known.add(roomId);
    await assertEncrypted(mx, roomId, {});
  }

  /**
   * Owner: make sure the repo has an encrypted talk room, and that everyone the repo's log says is a member
   * is in it (and nobody removed still is). Safe to run again: it only adds what is missing.
   */
  async function ensure(repo) {
    if (repo.owner !== mx.userId) throw refuse(REFUSE.NotOwner, 'only the repo’s owner can set up its conversation', {});
    let room = await roomOf(repo);
    if (!room) {
      room = await mx.createRoom(talkRoomBody({ repoId: repo.repoId, owner: mx.userId, epoch: repo.epoch || 1 }));
      await ready(room);
      await mx.blacklistUnverified(room, true);
      await share.sealed.sendEvent(repo.rooms.log, TALK.room, { v: 1, repo: repo.repoId, room });
      await remember(repo, room);
      repo.rooms = { ...repo.rooms, [STORE]: room };
      say('ok', 'Set up the encrypted conversation for this repo.');
    } else {
      share.known.add(room);
    }
    await reconcile(repo, room);
    return room;
  }

  /** Owner: invite every confirmed member who is not in the room yet; remove anyone the log says is gone. */
  async function reconcile(repo, room) {
    const people = await share.people(repo);
    const st = await mx.roomState(room);
    const added = [], removed = [];
    for (const p of people) {
      if (p.user === mx.userId) continue;
      const m = (st.members || {})[p.user];
      if (p.role && (p.membership === 'join' || p.membership === 'invite')) {
        if (m !== 'join' && m !== 'invite') { await mx.invite(room, p.user, { shareHistory: true }); added.push(p.user); }
      } else if (m === 'join' || m === 'invite') {
        await mx.kick(room, p.user, 'removed from the repo'); removed.push(p.user);
        try { await mx.ban(room, p.user, 'removed from the repo'); } catch { /* kicked is enough for the next event */ }
      }
    }
    if (removed.length) { try { await mx.discardSession(room); } catch { /* a missing capability is not a failure of the removal */ } }
    return { added, removed };
  }

  /** Member: join the room the owner announced (idempotent). */
  async function adopt(repo) {
    const room = await roomOf(repo);
    if (!room) return null;
    share.known.add(room);
    try {
      const st = await mx.roomState(room);
      if ((st.members || {})[mx.userId] !== 'join') await mx.join(room, { acceptSharedHistory: true });
    } catch { /* not invited yet: the owner's next sync invites; nothing is written meanwhile */ }
    return room;
  }

  const room = async (repo) => {
    const r = await roomOf(repo);
    if (!r) throw refuse(REFUSE.NoTalkRoom, 'this repo has no conversation yet — the owner sets it up from the Share panel', {});
    share.known.add(r);
    return r;
  };

  async function send(repo, { anchor, body, parent = null, mentions = [] }) {
    const a = anchorOf(anchor);
    const text = String(body == null ? '' : body);
    if (!text.trim()) throw refuse(REFUSE.EmptyBody, 'a comment needs some words', {});
    if (text.length > BODY_LIMIT) throw refuse(REFUSE.BodyTooLong, `a comment is limited to ${BODY_LIMIT} characters`, { length: text.length });
    const id = newId();
    await share.sealed.sendEvent(await room(repo), TALK.comment, { v: 1, id, anchor: a, body: text, ...(parent ? { parent } : {}), ...(mentions.length ? { mentions } : {}) });
    return id;
  }
  async function edit(repo, target, body) { return share.sealed.sendEvent(await room(repo), TALK.edit, { v: 1, target, body: String(body || '') }); }
  async function del(repo, target) { return share.sealed.sendEvent(await room(repo), TALK.del, { v: 1, target }); }
  async function resolve(repo, thread, resolved = true) { return share.sealed.sendEvent(await room(repo), TALK.resolve, { v: 1, thread, resolved }); }
  async function markRead(repo, { thread = null, upTo = now() } = {}) { return share.sealed.sendEvent(await room(repo), TALK.read, { v: 1, upTo, ...(thread ? { thread } : {}) }); }

  /** Read everything this device can decrypt, judge it against the ledger, fold it. */
  async function state(repo) {
    const r = await roomOf(repo);
    if (!r) return { ...foldTalk([], { me: mx.userId, owner: repo.owner }), noRoom: true };
    share.known.add(r);
    const events = await mx.readEvents(r);
    const ledger = await share.ledgerOf(repo);
    return foldTalk(events, { me: mx.userId, owner: repo.owner, ledger });
  }

  return { ensure, adopt, reconcile, roomOf, send, edit, del, resolve, markRead, state };
}
