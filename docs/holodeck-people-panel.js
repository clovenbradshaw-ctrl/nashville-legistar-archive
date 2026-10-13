// holodeck-people-panel.js — "People": invite with a magic link, and see who is here.
//
// A thin client of holodeck-invites.js over holodeck-rest-matrix.js, using the page's own Matrix session
// (fold-net.js). It draws, it collects what a person types, and it calls; the decisions are in the pure modules.
//
// For the owner: type names, get a link for each. For the person invited: choose a sign-in name and password, scan
// a QR with an authenticator app, type its six digits. The owner never sees any of that.
//
// Presence outlives the panel: once this device is in a workspace's private room it says "I am here, looking at X"
// every 30 seconds while the page is visible, whether or not this panel is open (switch off in the panel). The
// owner's device also looks after outstanding invitations in the background, so people are let in whether or not
// this panel is open.
import { makeInvites, parseWorkspaceInvite, REFUSE, WORDS } from './holodeck-invites.js';
import { restMatrix, baseFor, enrollStart, signUp, signIn, gateCrossing } from './holodeck-rest-matrix.js';
import { deviceKeyring } from './holodeck-vault.js';
import { parseInviteLines, groupKey, HEARTBEAT_MS } from './holodeck-invite-core.js';
import { qrSvg } from './holodeck-qr.js';

const CSS = `
#hd-people{position:fixed;top:0;right:0;height:100%;width:min(440px,100vw);box-sizing:border-box;z-index:56;overflow:auto;
  background:var(--s1,#14131a);color:var(--ink,#ecebf3);border-left:1px solid var(--line2,#34323f);padding:18px 20px 40px;
  font:400 14px/1.5 var(--sans,system-ui,sans-serif);display:flex;flex-direction:column;gap:14px}
#hd-people *{box-sizing:border-box}
#hd-people h2{margin:0;font:500 22px var(--serif,Georgia,serif)}
#hd-people h3{margin:0;font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--mut,#9a97ab)}
#hd-people .hdp-card{border:1px solid var(--line,#2a2833);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
#hd-people .hdp-mut{color:var(--mut,#9a97ab);font-size:13px;text-wrap:pretty}
#hd-people .hdp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#hd-people .hdp-between{display:flex;justify-content:space-between;align-items:center;gap:10px}
#hd-people textarea,#hd-people input[type=text],#hd-people input[type=password],#hd-people input:not([type]){background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;padding:8px 10px;color:var(--ink,#ecebf3);font:500 14px var(--sans,system-ui,sans-serif);outline:none;min-width:0;width:100%}
#hd-people textarea{min-height:88px;resize:vertical}
#hd-people button{cursor:pointer;border-radius:8px;padding:7px 14px;font:600 13px var(--sans,system-ui,sans-serif);border:1px solid var(--line2,#34323f);background:none;color:var(--ink,#ecebf3)}
#hd-people button.hdp-go{background:var(--acc2,#5b4bd6);border-color:transparent;color:#fff;padding:9px 16px;font-size:14px}
#hd-people button.hdp-quiet{border-color:transparent;color:var(--mut,#9a97ab);padding:4px 6px}
#hd-people button:disabled{opacity:.5;cursor:default}
#hd-people .hdp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:var(--line2,#34323f)}
#hd-people .hdp-dot.on{background:var(--ok,#5fbf8a)}
#hd-people .hdp-who{display:flex;flex-direction:column;gap:1px;min-width:0}
#hd-people .hdp-bad{color:var(--bad,#e5707a)} #hd-people .hdp-ok{color:var(--ok,#5fbf8a)}
#hd-people .hdp-code{font:600 22px var(--mono,ui-monospace,monospace);letter-spacing:.2em}
#hd-people .hdp-link{font:500 12px var(--mono,ui-monospace,monospace);color:var(--ink2,#cfcde0);overflow-wrap:anywhere;user-select:all}
#hd-people .hdp-qr{background:#fff;border-radius:10px;padding:8px;align-self:flex-start;line-height:0}
#hd-people .hdp-qr svg{width:176px;height:176px;display:block}
#hd-people .hdp-key{font:600 13px var(--mono,ui-monospace,monospace);letter-spacing:.06em;overflow-wrap:anywhere}
#hd-people summary{cursor:pointer;color:var(--mut,#9a97ab);font-size:13px}
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
function qrNode(text) {
  const wrap = el('div', { class: 'hdp-qr', role: 'img', 'aria-label': 'QR code for your authenticator app' });
  try { const d = new DOMParser().parseFromString(qrSvg(text, { scale: 6, quiet: 2 }), 'image/svg+xml'); wrap.append(document.importNode(d.documentElement, true)); } catch { /* the key below still works */ }
  return wrap;
}

// ---- this device's own bookkeeping (links and secret halves of invitations made here; never on the server)
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('holodeck-people', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const d = await idb.open(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { const d = await idb.open(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
};
const store = { get: (k) => idb.get(k), set: (k, v) => idb.set(k, v) };
const PRESENCE_OFF = 'hd:presence', GATE_OFF = 'hd:gate';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* a setting, not a secret */ } };

let root = null, S = null, ctxRef = null, pollTimer = null, claimTimer = null, beatTimer = null, lastKey = '', lastAt = 0, sweeping = false;
let sessionCache = null, invites = null, mxCache = null;

// ---------------------------------------------------------------- session and rooms (the page's own)
const sessionNow = () => { try { const s = ctxRef.session(); return s && !s.guest && s.token && s.base && s.user ? s : null; } catch { return null; } };
const gateOn = () => lsGet(GATE_OFF) !== 'off';
function api() {
  const s = sessionNow();
  if (!s) { invites = null; mxCache = null; sessionCache = null; return null; }
  if (!invites || !sessionCache || sessionCache.token !== s.token || sessionCache.user !== s.user || sessionCache.gate !== gateOn()) {
    sessionCache = { token: s.token, user: s.user, gate: gateOn() };
    mxCache = restMatrix({ base: s.base, token: s.token, user: s.user });
    const gate = gateOn() ? gateCrossing({ base: s.base, openid: () => mxCache.getOpenIdToken() }) : null;
    invites = makeInvites({ mx: mxCache, store, gate, vault: deviceKeyring(s.user), log: (l) => note(l.kind, l.text) });   // the page's own keyring for this account
  }
  return { mx: mxCache, inv: invites, s };
}
const roomsNow = () => { try { const r = ctxRef.wsRooms() || {}; return { priv: r.priv || null, pub: r.pub || null }; } catch { return { priv: null, pub: null }; } };
const presenceOn = () => lsGet(PRESENCE_OFF) !== '0';
const baseUrl = () => { try { return ctxRef.linkBase ? ctxRef.linkBase() : location.origin + location.pathname.replace(/index\.html$/, ''); } catch { return ''; } };
function note(kind, text) { if (!S) return; S.lines.unshift({ kind, text }); if (S.lines.length > 6) S.lines.length = 6; }
const words = (e) => (e && (e.why || e.message)) || String(e);

// ---------------------------------------------------------------- presence + background sweep (run with or without the panel)
function viewingNow() { try { return (ctxRef && ctxRef.viewing && ctxRef.viewing()) || {}; } catch { return {}; } }
async function beat(force) {
  const a = api(); const rooms = roomsNow();
  if (!a || !rooms.priv || !presenceOn()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const v = viewingNow(); const key = String(v.viewing || '') + '|' + String(v.title || ''); const t = Date.now();
  if (!force && key === lastKey && t - lastAt < HEARTBEAT_MS - 1000) return;
  if (!force && t - lastAt < 4000) return;
  lastKey = key; lastAt = t;
  try { await a.inv.announce({ rooms, viewing: v.viewing, title: v.title }); } catch { /* the next beat tries again */ }
}
// The owner's device is what lets people in, so it looks at outstanding invitations in the background — not only
// while this panel is open. Cheap when there are none (one read of this device's own store). Never overlaps itself.
async function sweepOutstanding() {
  if (sweeping) return;
  const a = api();
  if (!a || !roomsNow().priv) return;
  sweeping = true;
  try {
    const rooms = roomsNow();
    if (!(await a.inv.outstanding({ rooms })).some((o) => o.state === 'sent')) return;
    for (const r of await a.inv.sweep({ rooms })) report(r);
  } catch { /* the next pass tries again */ } finally { sweeping = false; }
}
function report(r) {
  if (r.state === 'admitted') note('ok', `${r.name} joined.`);
  if (r.state === 'blocked' && S) S.blocked = { ...r.blocked, name: r.name };
}
function startBeat() {
  clearInterval(beatTimer);
  let tick = 0;
  beatTimer = setInterval(() => { beat(false).catch(() => {}); if (++tick % 2 === 0) sweepOutstanding().catch(() => {}); }, 5000);
  beat(true).catch(() => {});
}
/** Called by the page on load: say "I am here" and look after outstanding invitations, if this device is in a workspace's private room. */
export function resumePresence(ctx = {}) {
  ctxRef = ctx;
  const a = api();
  if (!a || !roomsNow().priv || beatTimer) return false;
  startBeat();
  return true;
}

// ---------------------------------------------------------------- the panel
export function openPeoplePanel(ctx = {}) {
  ctxRef = ctx;
  if (!document.getElementById('hd-people-style')) { const st = el('style', { id: 'hd-people-style' }); st.textContent = CSS; document.head.append(st); }
  if (root) root.remove();
  root = el('aside', { id: 'hd-people', role: 'dialog', 'aria-label': 'People' });
  document.body.append(root);
  document.addEventListener('keydown', onKey);
  S = { busy: '', error: '', lines: [], people: [], online: [], outstanding: [], owner: false, invite: ctx.inviteRaw || null, joining: null, status: '', joined: false, loaded: false, made: [], enroll: null, existing: false, blocked: null };
  draw();
  if (S.invite && !sessionNow()) startEnroll();
  refresh().then(() => { startBeat(); }).catch(() => {});
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (!S.busy) refresh().catch(() => {}); }, 4000);
}
export function closePeoplePanel() {
  clearInterval(pollTimer); pollTimer = null; clearInterval(claimTimer); claimTimer = null;
  document.removeEventListener('keydown', onKey);
  if (root) { root.remove(); root = null; }
  try { ctxRef && ctxRef.onClose && ctxRef.onClose(); } catch { /* the page's callback is its own */ }
}
const onKey = (e) => { if (e.key === 'Escape') closePeoplePanel(); };

async function refresh() {
  const a = api(); const rooms = roomsNow();
  if (!a || !rooms.priv) { S.loaded = true; draw(); return; }
  try {
    const st = await a.mx.roomState(rooms.priv);
    S.owner = st.creator === a.s.user;
    if (S.owner) {
      S.blocked = null;
      for (const r of await a.inv.sweep({ rooms })) report(r);
      S.outstanding = (await a.inv.outstanding({ rooms })).filter((o) => o.state === 'sent');
    }
    S.vault = await a.inv.status({ rooms }).catch(() => null);
    S.people = await a.inv.people({ rooms });
    S.online = await a.inv.presence({ rooms });
    if (!S.error || !/gate|sign/i.test(S.error)) S.error = '';
  } catch (e) { S.error = words(e); }
  S.loaded = true;
  draw();
}
async function act(label, fn) {
  S.busy = label; S.error = ''; draw();
  try { await fn(); } catch (e) { S.error = words(e); }
  S.busy = ''; await refresh().catch(() => {}); draw();
}
const val = (id) => { const n = document.getElementById(id); return n ? String(n.value || '').trim() : ''; };
const raw = (id) => { const n = document.getElementById(id); return n ? String(n.value || '') : ''; };

// ---- owner
async function makeInvitations() {
  const rows = parseInviteLines(raw('hdp-lines'));
  if (!rows.length) { S.error = 'Type a name, one person per line.'; draw(); return; }
  await act('Making invitations…', async () => {
    const a = api();
    let rooms = roomsNow();
    if (!rooms.priv) {                                        // the one thing in the way: make the private room, as the page does
      const N = await import(new URL('./fold-net.js', import.meta.url).href);
      const priv = await N.createWorkspace(a.s, { name: 'Fold · ' + String((ctxRef.corpusName && ctxRef.corpusName()) || 'Workspace').replace(/ · .*$/, '') + ' (private)', isPublic: false, config: { v: 1 } });
      ctxRef.setWsRooms({ priv });
      rooms = roomsNow();
    }
    S.made = [];
    for (const r of rows) {
      try { const m = await a.inv.invite({ name: r.name, rooms, base: baseUrl() }); S.made.push({ name: r.name, link: m.link, door: m.door, ok: true }); }
      catch (e) { S.made.push({ name: r.name, ok: false, error: words(e) }); }
    }
    const ta = document.getElementById('hdp-lines'); if (ta) ta.value = '';
    startBeat();
  });
}
async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); S.copied = label; } catch { S.copied = ''; S.error = 'Your browser would not copy it — select the link and copy it.'; }
  draw();
}
const cancel = (door) => act('Cancelling…', async () => { await api().inv.revoke({ rooms: roomsNow(), door }); S.made = S.made.filter((m) => m.door !== door); });
const removePerson = (user) => act('Removing…', async () => { await api().inv.remove({ rooms: roomsNow(), user }); });
const rename = (user) => { const name = val('hdp-name-' + user); if (!name) return; return act('Saving…', async () => { await api().inv.setName({ rooms: roomsNow(), user, name }); S.editing = null; }); };
async function copyDeviceLink() {
  const a = api();
  if (!a) return;
  try {
    const key = await a.inv.deviceKey({ rooms: roomsNow() });
    await copy(baseUrl().replace(/[#?].*$/, '') + '#vault=' + key, 'device');
    S.error = '';
  } catch (e) { S.error = words(e); draw(); }
}
function togglePresence(on) { lsSet(PRESENCE_OFF, on ? null : '0'); if (on) beat(true).catch(() => {}); draw(); }
function setGate(on) { lsSet(GATE_OFF, on ? null : 'off'); invites = null; S.blocked = null; draw(); refresh().catch(() => {}); }

// ---- the person who was invited
async function startEnroll() {
  const p = parseWorkspaceInvite(S.invite);
  if (!p) { S.error = 'That is not an invite link.'; draw(); return; }
  try {
    const { host, base } = await baseFor(p.server || (ctxRef.defaultServer && ctxRef.defaultServer()) || '');
    S.enroll = { ...(await enrollStart({ base, account: p.from ? p.from.replace(/^@|:.*$/g, '') : 'Holodeck' })), host, base };
    S.error = '';
  } catch (e) { S.error = words(e); }
  draw();
}
async function join() {
  const p = parseWorkspaceInvite(S.invite);
  if (!p) { S.error = 'That is not an invite link.'; draw(); return; }
  await act('Joining…', async () => {
    let s = sessionNow();
    if (!s) {
      const { host, base } = await baseFor(p.server || (ctxRef.defaultServer && ctxRef.defaultServer()) || '');
      const username = val('hdp-user'), password = raw('hdp-pass'), code = val('hdp-code').replace(/\D/g, '');
      if (!username) throw new Error('Choose a sign-in name.');
      if (S.existing) {
        if (!password || code.length !== 6) throw new Error('Type your password and the six digits your authenticator app shows.');
        s = await signIn({ host, base, user: username, password, code });
      } else {
        if (password.length < 12) throw new Error('Choose a password of at least 12 characters.');
        if (password !== raw('hdp-pass2')) throw new Error('The two passwords are different.');
        if (code.length !== 6) throw new Error('Scan the QR code with an authenticator app, then type the six digits it shows.');
        if (!S.enroll) throw new Error('Setting up the authenticator did not start — try “Start again”.');
        s = await signUp({ host, base, username, password, ticket: S.enroll.ticket, code });
      }
      const N = await import(new URL('./fold-net.js', import.meta.url).href);
      N.useSession(s);
      try { ctxRef.onSession && ctxRef.onSession(s); } catch { /* the page re-reads the session */ }
    }
    const a = api();
    S.joining = await a.inv.open({ input: S.invite });
    S.status = 'Waiting for the person who invited you to let you in. Keep this page open.';
    clearInterval(claimTimer);
    claimTimer = setInterval(async () => {
      try {
        const got = await a.inv.claim({ door: S.joining.door, input: S.invite });   // the link holds the key the grant is sealed under
        clearInterval(claimTimer);
        ctxRef.setWsRooms({ priv: got.rooms.priv, ...(got.rooms.pub ? { pub: got.rooms.pub } : {}) });
        S.joined = true; S.invite = null; S.joining = null;
        try { ctxRef.onJoined && ctxRef.onJoined(got.rooms); } catch { /* the page's own refresh */ }
        startBeat(); await refresh();
      } catch (e) {
        if (e.code === REFUSE.NoGrantYet) { draw(); return; }
        clearInterval(claimTimer);
        S.joining = null; S.error = e.code === REFUSE.InviteClosed ? 'This invitation was closed — it was used, cancelled or expired. Ask for a new one.' : words(e); draw();
      }
    }, 3000);
  });
}

// ---------------------------------------------------------------- drawing
function draw() {
  if (!root) return;
  const keep = {};
  root.querySelectorAll('input[id],textarea[id]').forEach((n) => { keep[n.id] = n.value; });
  const focus = document.activeElement && document.activeElement.id;
  root.replaceChildren(...body());
  for (const [id, v] of Object.entries(keep)) { const n = document.getElementById(id); if (n && v !== '' && n.value === '') n.value = v; }
  if (focus) { const n = document.getElementById(focus); if (n && n !== document.activeElement && n.focus) n.focus({ preventScroll: true }); }
}

function body() {
  const out = [];
  out.push(el('div', { class: 'hdp-between' }, el('h2', {}, 'People'), el('button', { class: 'hdp-quiet', type: 'button', title: 'Close', onClick: closePeoplePanel }, '✕')));
  if (S.busy) out.push(el('div', { class: 'hdp-card' }, S.busy));
  if (S.error) out.push(el('div', { class: 'hdp-card hdp-bad' }, S.error));
  const a = sessionNow();
  const rooms = roomsNow();

  if (S.invite && !S.joined) { out.push(joinCard(!!a)); return out; }
  if (!a) {
    out.push(el('div', { class: 'hdp-card' },
      el('p', {}, 'Sign in to Matrix to invite people and see who is here.'),
      el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-go', type: 'button', onClick: () => { closePeoplePanel(); try { ctxRef.onLogin && ctxRef.onLogin(); } catch { /* the page shows its own sign-in */ } } }, 'Sign in'))));
    return out;
  }

  if (S.vault && S.vault.vault === 'locked') out.push(el('div', { class: 'hdp-card hdp-bad', 'data-vault': 'locked' }, el('p', {}, WORDS.locked)));
  else if (S.vault && S.vault.problem && S.vault.problem.code === 'vault-tampered') out.push(el('div', { class: 'hdp-card hdp-bad' }, el('p', {}, 'Something in this workspace did not authenticate — it was changed on the server, or moved. It was ignored.')));
  const canInvite = (!rooms.priv || S.owner) && !(S.vault && S.vault.vault === 'locked');
  if (canInvite) out.push(inviteCard());
  if (S.made.length) out.push(madeCard());
  if (S.blocked) out.push(blockedCard());
  out.push(peopleCard());
  if (S.lines.length) out.push(el('div', { class: 'hdp-mut' }, S.lines.slice(0, 3).map((l) => el('div', { class: l.kind === 'bad' ? 'hdp-bad' : '' }, l.text))));
  out.push(el('details', {}, el('summary', {}, 'What this does and does not protect'),
    el('div', { class: 'hdp-mut' },
      el('p', {}, WORDS.link),
      el('p', {}, WORDS.bearer),
      el('p', {}, WORDS.scope),
      el('p', {}, WORDS.server),
      S.vault && S.vault.vault === 'ready' ? el('div', { class: 'hdp-row', 'data-device-link': '' },
        el('button', { class: 'hdp-quiet', type: 'button', onClick: copyDeviceLink }, S.copied === 'device' ? 'Copied' : 'Copy a link to use this workspace on another device'),
        el('span', { class: 'hdp-mut' }, 'Treat it like a password: it carries the workspace key.')) : null,
      el('label', { class: 'hdp-row' }, el('input', { type: 'checkbox', style: 'width:auto', checked: presenceOn() ? '' : null, onChange: (e) => togglePresence(e.target.checked) }), el('span', {}, 'Show me as here, and what I am looking at, to people in this workspace')),
      el('label', { class: 'hdp-row' }, el('input', { type: 'checkbox', style: 'width:auto', checked: gateOn() ? null : '', onChange: (e) => setGate(!e.target.checked) }), el('span', {}, 'My homeserver does not run the login gate: let people in with a password alone')))));
  return out;
}

function inviteCard() {
  return el('div', { class: 'hdp-card' },
    el('h3', {}, 'Invite people'),
    el('textarea', { id: 'hdp-lines', placeholder: 'Ana Smith\nBob Jones', 'aria-label': 'Names, one per line' }),
    el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-go', type: 'button', onClick: makeInvitations }, 'Make invitations')),
    el('p', { class: 'hdp-mut' }, 'You get a link for each person to send however you like. They choose their own password and set up their own authenticator app; you never see either.'));
}

function madeCard() {
  return el('div', { class: 'hdp-card' },
    el('h3', {}, 'Send these'),
    S.made.map((m) => m.ok
      ? el('div', { class: 'hdp-card', 'data-made': m.name },
        el('div', { class: 'hdp-between' }, el('b', {}, m.name), el('button', { type: 'button', onClick: () => copy(m.link, m.name) }, S.copied === m.name ? 'Copied' : 'Copy link')),
        el('div', { class: 'hdp-link' }, m.link))
      : el('div', { class: 'hdp-bad' }, `✕ ${m.name}: ${m.error}`)),
    el('p', { class: 'hdp-mut' }, WORDS.bearer));
}

function blockedCard() {
  const b = S.blocked;
  if (b.why === 'gate-unreachable') {
    return el('div', { class: 'hdp-card hdp-bad' },
      el('p', {}, `${b.name} opened their link, but your homeserver's login gate did not answer, so nobody can be let in.`),
      el('p', { class: 'hdp-mut' }, 'Nobody is admitted while the gate cannot be reached. If your homeserver does not run the gate, you can turn that check off under “What this does and does not protect” — people are then let in with a password alone.'));
  }
  if (b.why === 'old-invitation') {
    return el('div', { class: 'hdp-card hdp-bad' }, el('p', {}, `The invitation for ${b.name} was made before the workspace key existed, so it cannot carry it. Cancel it and make a new one.`));
  }
  return el('div', { class: 'hdp-card hdp-bad' }, el('p', {}, `${b.name}'s link was opened by an account that has not set up an authenticator (${b.user}), so they were not let in. The invitation is still open for the person it was meant for.`));
}

function peopleCard() {
  const onlineBy = new Map(S.online.map((o) => [o.user, o]));
  const rows = [];
  for (const p of S.people) {
    const o = onlineBy.get(p.user);
    const title = o ? (o.title || o.viewing || 'here') : p.joined ? 'not here now' : 'invited — has not joined';
    rows.push(el('div', { class: 'hdp-card', 'data-user': p.user },
      el('div', { class: 'hdp-between' },
        el('div', { class: 'hdp-who' },
          el('span', {}, el('span', { class: 'hdp-dot' + (o ? ' on' : '') }), el('b', {}, p.name || p.user), p.self ? el('span', { class: 'hdp-mut' }, ' (you)') : null, p.owner ? el('span', { class: 'hdp-mut' }, ' · owner') : null),
          el('span', { class: 'hdp-mut' }, title)),
        S.owner && !p.self && !p.owner ? el('button', { class: 'hdp-quiet', type: 'button', onClick: () => { S.editing = S.editing === p.user ? null : p.user; draw(); } }, 'Edit') : null),
      S.owner && S.editing === p.user ? el('div', { class: 'hdp-row' },
        el('input', { id: 'hdp-name-' + p.user, value: p.name || '', placeholder: 'name', 'aria-label': 'Name' }),
        el('button', { type: 'button', onClick: () => rename(p.user) }, 'Save name'),
        el('button', { type: 'button', onClick: () => { S.editing = null; removePerson(p.user); } }, 'Remove')) : null));
  }
  for (const o of S.outstanding) {
    rows.push(el('div', { class: 'hdp-card', 'data-invite': o.name },
      el('div', { class: 'hdp-between' },
        el('div', { class: 'hdp-who' }, el('span', {}, el('span', { class: 'hdp-dot' }), el('b', {}, o.name)), el('span', { class: 'hdp-mut' }, o.opened ? 'opened the link — waiting for them to set up' : 'invited — link not opened yet')),
        el('div', { class: 'hdp-row' },
          o.link ? el('button', { class: 'hdp-quiet', type: 'button', onClick: () => copy(o.link, o.door) }, S.copied === o.door ? 'Copied' : 'Copy link') : null,
          el('button', { class: 'hdp-quiet', type: 'button', onClick: () => cancel(o.door) }, 'Cancel')))));
  }
  return el('div', { class: 'hdp-card' },
    el('div', { class: 'hdp-between' }, el('h3', {}, S.online.length ? `Here now · ${S.online.length}` : 'People'), el('span', { class: 'hdp-mut' }, S.loaded ? '' : 'loading…')),
    rows.length ? rows : el('p', { class: 'hdp-mut' }, S.loaded ? 'Just you so far.' : ''));
}

function joinCard(signedIn) {
  const p = parseWorkspaceInvite(S.invite);
  if (S.joining) {
    return el('div', { class: 'hdp-card' }, el('h3', {}, 'Joining'), el('p', {}, S.status || 'Waiting…'),
      S.joining.owner ? el('p', { class: 'hdp-mut' }, 'Invited by ', el('b', {}, S.joining.owner)) : null,
      el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-quiet', type: 'button', onClick: () => { clearInterval(claimTimer); S.joining = null; draw(); } }, 'Stop waiting')));
  }
  const head = [el('h3', {}, 'You were invited'), p && p.from ? el('p', {}, el('b', {}, p.from), ' invited you to their workspace.') : el('p', {}, 'You were invited to a workspace.')];
  if (signedIn) {
    return el('div', { class: 'hdp-card' }, ...head,
      el('p', { class: 'hdp-mut' }, 'You will join with the account you are signed in as. It needs an authenticator set up on this homeserver.'),
      el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-go', type: 'button', onClick: join }, 'Join')));
  }
  if (S.existing) {
    return el('div', { class: 'hdp-card' }, ...head,
      el('p', { class: 'hdp-mut' }, 'Sign in with the account you already have here.'),
      el('input', { id: 'hdp-user', placeholder: 'sign-in name', autocomplete: 'username' }),
      el('input', { id: 'hdp-pass', type: 'password', placeholder: 'password', autocomplete: 'current-password' }),
      el('input', { id: 'hdp-code', inputmode: 'numeric', maxlength: '6', placeholder: 'six digits from your authenticator app', autocomplete: 'one-time-code' }),
      el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-go', type: 'button', onClick: join }, 'Sign in and join'), el('button', { class: 'hdp-quiet', type: 'button', onClick: () => { S.existing = false; draw(); } }, 'I need an account')));
  }
  return el('div', { class: 'hdp-card' }, ...head,
    el('p', { class: 'hdp-mut' }, 'Make your account. You choose the name and password; nobody else ever sees them.'),
    el('input', { id: 'hdp-user', placeholder: 'choose a sign-in name', autocomplete: 'username', maxlength: '40' }),
    el('input', { id: 'hdp-pass', type: 'password', placeholder: 'choose a password (12 or more characters)', autocomplete: 'new-password' }),
    el('input', { id: 'hdp-pass2', type: 'password', placeholder: 'the same password again', autocomplete: 'new-password' }),
    el('h3', {}, 'Set up your authenticator app'),
    S.enroll
      ? el('div', { class: 'hdp-card' },
        el('p', { class: 'hdp-mut' }, 'Scan this with an authenticator app (Google Authenticator, 1Password, Authy, Apple Passwords…), or type the key into it.'),
        qrNode(S.enroll.otpauth),
        el('div', { class: 'hdp-key' }, groupKey(S.enroll.secret)),
        el('input', { id: 'hdp-code', inputmode: 'numeric', maxlength: '6', placeholder: 'the six digits it shows', autocomplete: 'one-time-code', 'aria-label': 'Six digits from your authenticator app' }))
      : el('div', { class: 'hdp-row' }, el('span', { class: 'hdp-mut' }, 'Getting your setup code…'), el('button', { type: 'button', onClick: startEnroll }, 'Start again')),
    el('div', { class: 'hdp-row' }, el('button', { class: 'hdp-go', type: 'button', onClick: join }, 'Create account and join'), el('button', { class: 'hdp-quiet', type: 'button', onClick: () => { S.existing = true; draw(); } }, 'I already have an account')),
    el('p', { class: 'hdp-mut' }, 'Every sign-in after this needs your password and the six digits.'));
}

export const _state = () => S;
