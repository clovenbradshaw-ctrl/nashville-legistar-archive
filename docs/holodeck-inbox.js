// holodeck-inbox.js — the Inbox page, the group conversation and the "comment on this" composer.
//
// A thin client of holodeck-talk.js (which is a thin client of the encrypted stores in holodeck-share.js):
// no logic lives here that a test cannot reach in the pure modules. This file connects, draws what the
// fold returns, and sends what a person types.
//
//   const inbox = createInbox({ corpusId, corpusName, docTitle, docText, openSource, openName, openShare, toast, onChange });
//   inbox.start();                       // connects when there is a session for this workspace's repo
//   inbox.mount(hostEl);                 // draws the Inbox into hostEl and keeps it fresh
//   inbox.compose({ kind:'text', doc, s, e, quote });   // opens the composer for a place in the content
//   inbox.summary()                      // { phase, unread, mentions, open, byDoc }
//
// Plain words only. What the server can and cannot see is stated on the page itself: the room exists, who is
// in it and when each message was sent are visible to the homeserver; what was said is not.

import { acquire, release } from './holodeck-session.js';
import { makeShare } from './holodeck-share.js';
import { makeTalk, inboxOf, anchorOf, locate, KINDS } from './holodeck-talk.js';

const CSS = `
.hdi{display:flex;flex-direction:column;gap:12px;font:400 14px/1.5 var(--sans,system-ui,sans-serif);color:var(--ink,#ecebf3)}
.hdi *{box-sizing:border-box}
.hdi-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hdi-top h2{margin:0;font:500 22px var(--serif,Georgia,serif)}
.hdi-chip{all:unset;cursor:pointer;border:1px solid var(--line2,#34323f);border-radius:8px;padding:4px 11px;font:500 13px var(--sans,system-ui);color:var(--ink2,#cfcde0);white-space:nowrap}
.hdi-chip:hover{background:var(--s2,#1c1b24)}
.hdi-chip.on{background:var(--sel,#2a2750);border-color:var(--acc2,#5b4bd6);color:var(--ink,#ecebf3)}
.hdi-chip.go{background:var(--acc2,#5b4bd6);border-color:transparent;color:#fff;font-weight:600}
.hdi-chip[disabled]{opacity:.5;cursor:default}
.hdi-badge{font:600 11px var(--mono,ui-monospace,monospace);background:var(--acc2,#5b4bd6);color:#fff;border-radius:999px;padding:0 7px;margin-left:6px}
.hdi-grid{display:grid;grid-template-columns:minmax(240px,340px) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:820px){.hdi-grid{grid-template-columns:minmax(0,1fr)}}
.hdi-list{display:flex;flex-direction:column;border:1px solid var(--line,#2a2833);border-radius:12px;overflow:hidden;max-height:72vh;overflow-y:auto;background:var(--s1,#14131a)}
.hdi-row{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:10px 14px;border-bottom:1px solid var(--line,#2a2833)}
.hdi-row:hover{background:var(--s2,#1c1b24)}
.hdi-row.on{background:var(--sel,#2a2750)}
.hdi-row .t{font:500 14px var(--sans,system-ui);color:var(--ink,#ecebf3);display:flex;gap:8px;align-items:baseline}
.hdi-row .t b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.hdi-row .q{color:var(--mut,#9a97ab);font:400 12.5px var(--sans,system-ui);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hdi-row .m{color:var(--dim,#7a7790);font:400 12px var(--sans,system-ui)}
.hdi-dot{width:8px;height:8px;border-radius:50%;background:var(--acc,#8a7cf0);flex:none}
.hdi-pane{border:1px solid var(--line,#2a2833);border-radius:12px;background:var(--s1,#14131a);display:flex;flex-direction:column;min-height:240px}
.hdi-head{padding:12px 16px;border-bottom:1px solid var(--line,#2a2833);display:flex;flex-direction:column;gap:6px}
.hdi-quote{border-left:3px solid var(--acc,#8a7cf0);padding:2px 0 2px 10px;color:var(--ink2,#cfcde0);font:400 13.5px/1.5 var(--serif,Georgia,serif);text-wrap:pretty}
.hdi-msgs{display:flex;flex-direction:column;gap:2px;padding:6px 0;max-height:52vh;overflow-y:auto}
.hdi-msg{padding:8px 16px;display:flex;flex-direction:column;gap:2px}
.hdi-msg.mine .who{color:var(--acc,#8a7cf0)}
.hdi-msg .who{font:600 12.5px var(--sans,system-ui);color:var(--ink2,#cfcde0);display:flex;gap:8px;align-items:baseline}
.hdi-msg .who span{font:400 12px var(--sans,system-ui);color:var(--dim,#7a7790)}
.hdi-msg .body{white-space:pre-wrap;overflow-wrap:anywhere;text-wrap:pretty}
.hdi-msg .gone{color:var(--dim,#7a7790);font-style:italic}
.hdi-msg .acts{display:flex;gap:10px;opacity:0}
.hdi-msg:hover .acts{opacity:1}
.hdi-msg .acts button{all:unset;cursor:pointer;color:var(--mut,#9a97ab);font:500 12px var(--sans,system-ui)}
.hdi-msg .acts button:hover{color:var(--ink,#ecebf3)}
.hdi-comp{border-top:1px solid var(--line,#2a2833);padding:10px 12px;display:flex;gap:8px;align-items:flex-end}
.hdi-comp textarea{flex:1;min-height:42px;max-height:180px;resize:vertical;background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;color:var(--ink,#ecebf3);font:400 14px/1.45 var(--sans,system-ui);padding:8px 10px;outline:none}
.hdi-comp textarea:focus{border-color:var(--acc,#8a7cf0)}
.hdi-note{color:var(--mut,#9a97ab);font:400 13px/1.5 var(--sans,system-ui);text-wrap:pretty}
.hdi-empty{padding:28px 20px;color:var(--mut,#9a97ab);text-align:center;text-wrap:pretty}
.hdi-err{color:var(--bad,#e5707a)}
.hdi-modal{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding:10vh 16px 16px}
.hdi-modal>div{width:min(560px,100%);background:var(--s1,#14131a);border:1px solid var(--line2,#34323f);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:400 14px/1.5 var(--sans,system-ui,sans-serif);color:var(--ink,#ecebf3)}
.hdi-modal textarea{min-height:96px;background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;color:var(--ink,#ecebf3);font:400 14px/1.45 var(--sans,system-ui);padding:8px 10px;outline:none;resize:vertical;width:100%}
`;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const who = (u) => String(u || '').replace(/^@/, '').split(':')[0] || 'someone';
const when = (ts) => {
  if (!ts) return '';
  const d = new Date(ts), m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const KIND_WORDS = { source: 'whole source', text: 'passage', statement: 'statement', name: 'name', moment: 'moment', room: 'conversation' };

/** The anchor, in words a person would use. `title` is the source's title if the page knows it. */
export function anchorWords(a, title = '') {
  const t = title ? `“${title}”` : 'a source';
  switch (a && a.kind) {
    case 'source': return `On ${t}`;
    case 'text': return `A passage in ${t}`;
    case 'statement': return `A statement in ${t}`;
    case 'name': return `The name ${a.name}`;
    case 'moment': return `${mmss(a.t)} into ${t}`;
    default: return 'Conversation';
  }
}

export function createInbox(ctx = {}) {
  const S = {
    phase: 'idle', error: '', session: null, mx: null, share: null, talk: null, repo: null, st: null,
    sel: 'room', filter: 'all', docFilter: '', busy: '', sim: !!ctx.simulated, held: null, timer: null, lines: [],
    draft: {}, lastSnap: '', host: null,
  };
  const listeners = new Set();
  const say = (kind, text) => { S.lines.unshift({ kind, text }); if (S.lines.length > 12) S.lines.length = 12; };
  const toast = (m) => { try { ctx.toast && ctx.toast(m); } catch { /* the page's toast is its own */ } };
  const gapError = (kind, why) => Object.assign(new Error(why), { gap: true, kind, why });

  const summary = () => {
    const st = S.st;
    return {
      phase: S.phase, unread: st ? st.unread : 0, mentions: st ? st.mentionsMe : 0,
      open: st ? st.threads.filter((t) => !t.resolved).length : 0, byDoc: st ? st.byDoc : {}, owner: !!(S.repo && S.mx && S.repo.owner === S.mx.userId),
    };
  };
  const notify = () => {
    const snap = JSON.stringify(summary());
    if (snap !== S.lastSnap) { S.lastSnap = snap; try { ctx.onChange && ctx.onChange(summary()); } catch { /* the page's callback is its own */ } }
    listeners.forEach((f) => { try { f(); } catch { /* a view never stops the controller */ } });
  };

  // ------------------------------------------------------------ connect
  async function connect() {
    if (S.phase === 'connecting') return;
    S.phase = 'connecting'; S.error = ''; notify();
    try {
      let mx, att, sess;
      if (S.sim) {
        const { createFakeServer, fakeAttach } = await import('./holodeck-fake-matrix.js');
        const server = ctx.simServer || createFakeServer({ name: 'simulated.local' });
        mx = ctx.simClient || server.client(ctx.simUser || '@you:simulated.local', { crossSigned: true });
        att = fakeAttach; sess = { userId: mx.userId, simulated: true };
      } else {
        const P = await import('./holodeck-share-panel.js');
        sess = (await P.sessionStore.get('session')) || (await P.pageSession());
        if (!sess) { S.phase = 'signin'; notify(); return; }
        const sdk = await P.loadSdk();
        const M = await import('./holodeck-matrix.js');
        mx = await acquire(sess, () => M.connect({ sdk, baseUrl: sess.baseUrl, userId: sess.userId, deviceId: sess.deviceId, accessToken: sess.accessToken, cryptoPrefix: `holodeck-${sess.userId}-${sess.deviceId}` }));
        S.held = mx;
        att = { encrypt: sdk.encryptAttachment, decrypt: sdk.decryptAttachment };
      }
      S.mx = mx; S.session = sess;
      S.share = makeShare({ mx, attach: att, onRefuse: (r) => say('bad', r.why), log: (l) => say(l.kind, l.text) });
      S.talk = makeTalk({ share: S.share, log: (l) => say(l.kind, l.text) });
      await findRepo();
    } catch (e) {
      S.phase = e && e.gap ? 'gap' : 'error';
      S.error = (e && (e.why || e.message)) || String(e);
      notify();
    }
  }

  async function findRepo() {
    let want = null;
    try { want = (await import('./holodeck-share-panel.js')).repoIdFor(ctx.corpusId ? ctx.corpusId() : 'default'); } catch { /* none */ }
    if (S.sim && ctx.simRepo) want = ctx.simRepo.repoId;
    const repos = await S.share.listRepos();
    S.repo = repos.find((r) => r.repoId === want) || null;
    if (!S.repo) { S.phase = 'norepo'; notify(); return; }
    S.share.adoptFromRegistry(S.repo.repoId);
    await settle();
  }

  /** Make sure there is a conversation to be in: members join the announced room; the owner keeps it in step with the people list. */
  async function settle() {
    const isOwner = S.repo.owner === S.mx.userId;
    let room = await S.talk.roomOf(S.repo);
    if (room) {
      if (isOwner) { try { await S.talk.ensure(S.repo); } catch (e) { say('bad', e.why || e.message); } }
      else await S.talk.adopt(S.repo);
      S.phase = 'ready';
    } else S.phase = 'noroom';
    await refresh();
    clearInterval(S.timer);
    S.timer = setInterval(() => { if (!S.busy) tick().catch(() => {}); }, 4000);
  }
  let beats = 0;
  async function tick() {
    if (S.phase === 'noroom') { await settle(); return; }
    if (S.phase !== 'ready') return;
    if (S.repo.owner === S.mx.userId && ++beats % 5 === 0) { try { await S.talk.ensure(S.repo); } catch { /* reported by the next explicit act */ } }
    else if (S.repo.owner !== S.mx.userId && beats++ % 5 === 0) { try { await S.talk.adopt(S.repo); } catch { /* the owner's next sync invites */ } }
    await refresh();
  }
  async function refresh() {
    if (!S.talk || !S.repo) return;
    try { S.st = await S.talk.state(S.repo); } catch (e) { S.error = e.why || e.message; }
    notify();
  }

  // ------------------------------------------------------------ acts (each is one explicit person-driven event)
  async function act(label, fn) {
    S.busy = label; S.error = ''; notify();
    try { return await fn(); }
    catch (e) { S.error = (e && (e.why || e.message)) || String(e); say('bad', S.error); }
    finally { S.busy = ''; await refresh(); }
  }
  const startConversation = () => act('Setting up the encrypted conversation…', async () => { await S.talk.ensure(S.repo); S.phase = 'ready'; toast('The encrypted conversation is ready.'); });
  const sendTo = (anchor, body, parent = null) => act('Sending…', async () => {
    const mentions = [...new Set((String(body).match(/@[A-Za-z0-9._=\-/]+:[A-Za-z0-9.\-]+/g) || []))];
    await S.talk.send(S.repo, { anchor, body, parent, mentions });
    return true;
  });
  const readThread = async (id, ts) => { try { await S.talk.markRead(S.repo, { thread: id, upTo: ts }); await refresh(); } catch { /* an unread marker is never worth an error */ } };

  // ------------------------------------------------------------ the composer ("comment on this")
  function compose(anchor, { quote = '', title = '' } = {}) {
    let a;
    try { a = anchorOf(anchor); } catch (e) { toast(e.why || e.message); return; }
    if (!document.getElementById('hdi-style')) { const st = el('style', { id: 'hdi-style' }); st.textContent = CSS; document.head.append(st); }
    const close = () => m.remove();
    const ta = el('textarea', { placeholder: 'Say something about this…', autofocus: true });
    const err = el('div', { class: 'hdi-note hdi-err' });
    const ready = S.phase === 'ready';
    const go = el('button', { class: 'hdi-chip go', onclick: async () => {
      const body = ta.value.trim(); if (!body) return;
      go.disabled = true; err.textContent = '';
      const ok = await sendTo(a, body);
      if (ok) { close(); toast('Commented — end-to-end encrypted.'); } else { go.disabled = false; err.textContent = S.error || 'Could not send.'; }
    } }, 'Comment');
    const m = el('div', { class: 'hdi-modal', onclick: (e) => { if (e.target === m) close(); } },
      el('div', { role: 'dialog', 'aria-label': 'Comment' },
        el('div', { style: 'font:600 15px var(--sans,system-ui)' }, anchorWords(a, title)),
        quote || a.quote ? el('div', { class: 'hdi-quote' }, '“' + String(quote || a.quote).slice(0, 280) + '”') : null,
        ready ? ta : el('div', { class: 'hdi-note' }, phaseWords()),
        err,
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          ready ? go : (S.phase === 'signin' || S.phase === 'norepo' || S.phase === 'gap') ? el('button', { class: 'hdi-chip go', onclick: () => { close(); ctx.openShare && ctx.openShare(); } }, 'Open the Share panel') : null,
          el('button', { class: 'hdi-chip', onclick: close }, 'Cancel'),
          el('span', { class: 'hdi-note' }, 'Only people in this repo can read it; the server cannot.'))));
    document.body.append(m);
    if (S.phase === 'idle') start();
    setTimeout(() => ta.focus(), 30);
  }

  // ------------------------------------------------------------ the view
  function phaseWords() {
    switch (S.phase) {
      case 'idle': case 'connecting': return 'Connecting and starting encryption…';
      case 'signin': return 'Sign in to Matrix from the Share panel first — comments travel only through your encrypted repo.';
      case 'gap': return S.error || 'The encrypted-repo library is not on this site yet.';
      case 'norepo': return 'This workspace is not an encrypted repo yet. Share it from the Share panel, then comments and conversation turn on.';
      case 'noroom': return S.repo && S.repo.owner === S.mx.userId ? 'This repo has no conversation yet. Start it and everyone you have invited can comment and talk, end-to-end encrypted.' : 'The owner has not started the conversation for this repo yet. It will appear here by itself.';
      case 'error': return S.error || 'Something went wrong.';
      default: return '';
    }
  }

  function draw() {
    const host = S.host; if (!host) return;
    if (!document.getElementById('hdi-style')) { const st = el('style', { id: 'hdi-style' }); st.textContent = CSS; document.head.append(st); }
    // keep what is being typed across a redraw
    const keep = {}; host.querySelectorAll('textarea[data-k]').forEach((t) => { keep[t.dataset.k] = { v: t.value, f: document.activeElement === t }; });
    host.replaceChildren(view());
    host.querySelectorAll('textarea[data-k]').forEach((t) => { const k = keep[t.dataset.k]; if (k) { t.value = k.v; if (k.f) t.focus(); } });
  }

  function view() {
    const st = S.st;
    const top = el('div', { class: 'hdi-top' },
      el('h2', {}, 'Inbox'),
      st && S.phase === 'ready' ? el('span', { class: 'hdi-note' }, `${st.threads.filter((t) => !t.resolved).length} open · ${st.unread} unread${st.mentionsMe ? ` · ${st.mentionsMe} mention you` : ''}`) : null,
      el('span', { style: 'flex:1' }),
      S.busy ? el('span', { class: 'hdi-note' }, S.busy) : null);
    if (S.phase !== 'ready' || !st) {
      const acts = [];
      if (S.phase === 'noroom' && S.repo && S.mx && S.repo.owner === S.mx.userId) acts.push(el('button', { class: 'hdi-chip go', onclick: startConversation }, 'Start the conversation'));
      if (['signin', 'norepo', 'gap'].includes(S.phase)) acts.push(el('button', { class: 'hdi-chip go', onclick: () => ctx.openShare && ctx.openShare() }, 'Open the Share panel'));
      if (S.phase === 'error') acts.push(el('button', { class: 'hdi-chip', onclick: () => { S.phase = 'idle'; connect(); } }, 'Try again'));
      return el('div', { class: 'hdi' }, top, el('div', { class: 'hdi-pane' }, el('div', { class: 'hdi-empty' }, phaseWords(), S.error && S.phase !== 'error' ? el('div', { class: 'hdi-err' }, S.error) : null, acts.length ? el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:12px' }, ...acts) : null)), privacy());
    }
    const me = S.mx.userId;
    const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['open', 'Open'], ['mentions', 'Mentions'], ['mine', 'I took part'], ['resolved', 'Resolved']];
    const docs = [...new Set(st.threads.map((t) => t.anchor.doc).filter(Boolean))];
    const filters = el('div', { class: 'hdi-top' },
      ...FILTERS.map(([k, l]) => el('button', { class: 'hdi-chip' + (S.filter === k ? ' on' : ''), onclick: () => { S.filter = k; draw(); } }, l)),
      docs.length > 1 ? el('select', { class: 'hdi-chip', onchange: (e) => { S.docFilter = e.target.value; draw(); } },
        el('option', { value: '' }, 'Every source'), ...docs.map((d) => el('option', { value: d, ...(S.docFilter === d ? { selected: true } : {}) }, ctx.docTitle ? (ctx.docTitle(d) || d) : d))) : null,
      el('span', { style: 'flex:1' }),
      st.unread ? el('button', { class: 'hdi-chip', onclick: () => act('Marking read…', async () => { await S.talk.markRead(S.repo, {}); }) }, 'Mark all read') : null);

    const list = inboxOf(st, { filter: S.filter, doc: S.docFilter || null, me });
    const chatUnread = st.chatUnread;
    const rows = [
      el('button', { class: 'hdi-row' + (S.sel === 'room' ? ' on' : ''), onclick: () => { S.sel = 'room'; readThread('room', Date.now()); draw(); } },
        el('span', { class: 't' }, el('b', {}, 'Conversation'), chatUnread ? el('span', { class: 'hdi-badge' }, chatUnread) : null),
        el('span', { class: 'q' }, st.chat.length ? `${who(st.chat[st.chat.length - 1].author)}: ${st.chat[st.chat.length - 1].body}` : 'Talk to everyone in this repo'),
        el('span', { class: 'm' }, st.chat.length ? when(st.chat[st.chat.length - 1].ts) : '')),
      ...list.map((t) => {
        const title = t.anchor.doc && ctx.docTitle ? ctx.docTitle(t.anchor.doc) : '';
        const last = [t.root, ...t.replies].filter((c) => !c.deleted).pop() || t.root;
        return el('button', { class: 'hdi-row' + (S.sel === t.id ? ' on' : ''), onclick: () => { S.sel = t.id; readThread(t.id, Date.now()); draw(); } },
          el('span', { class: 't' }, t.unread ? el('span', { class: 'hdi-dot' }) : null, el('b', {}, anchorWords(t.anchor, title)), t.resolved ? el('span', { class: 'hdi-note' }, '✓') : null, t.mentionsMe ? el('span', { class: 'hdi-badge' }, '@') : null),
          t.anchor.quote ? el('span', { class: 'q' }, '“' + t.anchor.quote + '”') : null,
          el('span', { class: 'q' }, `${who(last.author)}: ${last.body}`),
          el('span', { class: 'm' }, `${t.count} message${t.count === 1 ? '' : 's'} · ${when(t.last)}`));
      }),
    ];
    if (!list.length) rows.push(el('div', { class: 'hdi-empty' }, st.threads.length ? 'Nothing matches that filter.' : 'No comments yet. Select some words in a source and choose Comment, or press Comment on a source.'));

    const detail = S.sel === 'room' ? roomPane(st, me) : threadPane(st, me);
    return el('div', { class: 'hdi' }, top, filters, el('div', { class: 'hdi-grid' }, el('div', { class: 'hdi-list' }, ...rows), detail), S.error ? el('div', { class: 'hdi-note hdi-err' }, S.error) : null, privacy());
  }

  const privacy = () => el('div', { class: 'hdi-note' }, 'Comments and conversation are end-to-end encrypted Matrix messages in this repo’s own room. The homeserver can see that the room exists, who is in it, and when and how large each message is — not what it says. Members you remove stop receiving new messages; they keep what they already read.');

  function msg(c, me, st, { reply = null } = {}) {
    const mine = c.author === me;
    const canDel = mine || S.repo.owner === me;
    return el('div', { class: 'hdi-msg' + (mine ? ' mine' : '') },
      el('div', { class: 'who' }, who(c.author), el('span', {}, when(c.ts) + (c.editedAt ? ' · edited' : ''))),
      c.deleted ? el('div', { class: 'body gone' }, 'deleted') : el('div', { class: 'body' }, c.body),
      c.deleted ? null : el('div', { class: 'acts' },
        reply ? el('button', { onclick: reply }, 'Reply') : null,
        mine ? el('button', { onclick: () => { const nb = prompt('Edit your comment', c.body); if (nb != null && nb.trim() && nb !== c.body) act('Saving…', () => S.talk.edit(S.repo, c.id, nb)); } }, 'Edit') : null,
        canDel ? el('button', { onclick: () => { if (confirm('Delete this comment for everyone in the repo?')) act('Deleting…', () => S.talk.del(S.repo, c.id)); } }, 'Delete') : null));
  }

  function composer(key, placeholder, onSend) {
    const ta = el('textarea', { 'data-k': key, placeholder, rows: 1, onkeydown: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } } });
    const send = async () => { const b = ta.value.trim(); if (!b) return; const ok = await onSend(b); if (ok) ta.value = ''; };
    return el('div', { class: 'hdi-comp' }, ta, el('button', { class: 'hdi-chip go', onclick: send }, 'Send'));
  }

  function roomPane(st, me) {
    return el('div', { class: 'hdi-pane' },
      el('div', { class: 'hdi-head' }, el('div', { style: 'font:600 15px var(--sans,system-ui)' }, 'Conversation'), el('div', { class: 'hdi-note' }, 'Everyone in this repo. Not tied to any one source.')),
      el('div', { class: 'hdi-msgs' }, ...(st.chat.length ? st.chat.map((c) => msg(c, me, st)) : [el('div', { class: 'hdi-empty' }, 'Say hello.')])),
      composer('room', 'Message everyone in this repo… (Ctrl/⌘+Enter sends)', (b) => sendTo({ kind: 'room' }, b)));
  }

  function threadPane(st, me) {
    const t = st.threads.find((x) => x.id === S.sel);
    if (!t) return el('div', { class: 'hdi-pane' }, el('div', { class: 'hdi-empty' }, 'Choose a thread, or open the conversation.'));
    const title = t.anchor.doc && ctx.docTitle ? ctx.docTitle(t.anchor.doc) : '';
    let note = '';
    if (t.anchor.kind === 'text' && ctx.docText) {
      const txt = ctx.docText(t.anchor.doc);
      if (txt != null) { const f = locate(txt, t.anchor); note = f.how === 'detached' ? 'These words are no longer in the source — the comment is kept with what it quoted.' : f.how === 'moved' ? 'The source was re-read; the passage moved and was found again.' : ''; }
    }
    const open = () => { if (!ctx.openSource || !t.anchor.doc) return; ctx.openSource(t.anchor.doc, t.anchor); };
    return el('div', { class: 'hdi-pane' },
      el('div', { class: 'hdi-head' },
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          el('span', { style: 'font:600 15px var(--sans,system-ui)' }, anchorWords(t.anchor, title)),
          el('span', { style: 'flex:1' }),
          t.anchor.doc ? el('button', { class: 'hdi-chip', onclick: open }, 'Open the source') : (t.anchor.kind === 'name' && ctx.openName ? el('button', { class: 'hdi-chip', onclick: () => ctx.openName(t.anchor.name) }, 'Open the name') : null),
          el('button', { class: 'hdi-chip', onclick: () => act(t.resolved ? 'Reopening…' : 'Resolving…', () => S.talk.resolve(S.repo, t.id, !t.resolved)) }, t.resolved ? 'Reopen' : 'Resolve')),
        t.anchor.quote ? el('div', { class: 'hdi-quote' }, '“' + t.anchor.quote + '”') : null,
        note ? el('div', { class: 'hdi-note' }, note) : null,
        t.resolved ? el('div', { class: 'hdi-note' }, `Resolved by ${who(t.resolvedBy)}.`) : null),
      el('div', { class: 'hdi-msgs' }, msg(t.root, me, st), ...t.replies.map((c) => msg(c, me, st))),
      composer('t:' + t.id, 'Reply… (Ctrl/⌘+Enter sends)', (b) => sendTo(t.anchor, b, t.root.id)));
  }

  // ------------------------------------------------------------ public
  function start() { if (S.phase === 'idle') return connect(); return Promise.resolve(); }
  function stop() {
    clearInterval(S.timer); S.timer = null;
    if (S.held) { try { release(S.held); } catch { /* stopped by its last holder */ } S.held = null; }
    S.phase = 'idle'; S.mx = null; S.share = null; S.talk = null; S.repo = null; S.st = null;
  }
  function mount(host) {
    S.host = host;
    const f = () => draw(); listeners.add(f);
    start();
    draw();
    return { destroy() { listeners.delete(f); if (S.host === host) S.host = null; host.replaceChildren(); } };
  }
  /** Open the inbox on a thread (from a badge or a notification). */
  function select(id) { S.sel = id; draw(); }

  return { start, stop, mount, compose, summary, refresh, select, state: () => S, _S: S, KINDS };
}
