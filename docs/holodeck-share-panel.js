// holodeck-share-panel.js — "Share this repo": a full-height right panel, a thin
// client of holodeck-share.js. No logic lives here that a test cannot reach in
// the pure modules; this file draws, collects what a person types, and calls.
//
// Reader-UX rules honoured: a fixed full-height right panel; a click never moves
// the document (nothing here scrolls or focuses the page); inputs are uncontrolled
// and read on the action, never debounced; one affordance owns consent for each
// act and nothing has a force switch.
//
// Plain words only. The server's view of things is stated in the panel itself.
//
// Secrets: this file writes no token, key or code to localStorage, the DOM or a
// log. Its own session is kept in IndexedDB (stable device identity needs it);
// the page's pre-existing sign-in is READ, never written.

import { acquire as acquireMatrix, release as releaseMatrix } from './holodeck-session.js';
import { makeShare, WORDS, GAP_WORDS, inviteWords, parseInvite, pairingCode, fingerprintGroups, STORES, REFUSE } from './holodeck-share.js';

const CSS = `
#hd-share{position:fixed;top:0;right:0;height:100%;width:min(460px,100vw);box-sizing:border-box;z-index:56;overflow:auto;
  background:var(--s1,#14131a);color:var(--ink,#ecebf3);border-left:1px solid var(--line2,#34323f);padding:18px 20px 40px;
  font:400 14px/1.5 var(--sans,system-ui,sans-serif);display:flex;flex-direction:column;gap:14px}
#hd-share *{box-sizing:border-box}
#hd-share h2{margin:0;font:500 22px var(--serif,Georgia,serif)}
#hd-share h3{margin:0;font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--mut,#9a97ab)}
#hd-share .hds-card{border:1px solid var(--line,#2a2833);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:var(--s1,#14131a)}
#hd-share .hds-mut{color:var(--mut,#9a97ab);font-size:13px;text-wrap:pretty}
#hd-share .hds-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#hd-share .hds-between{display:flex;justify-content:space-between;align-items:center;gap:10px}
#hd-share input,#hd-share select{background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;padding:6px 10px;color:var(--ink,#ecebf3);font:500 13px var(--mono,ui-monospace,monospace);outline:none;min-width:0}
#hd-share input.hds-grow{flex:1 1 160px}
#hd-share input[readonly]{width:100%}
#hd-share button{cursor:pointer;border-radius:8px;padding:6px 14px;font:600 13px var(--sans,system-ui,sans-serif);border:1px solid var(--line2,#34323f);background:none;color:var(--ink,#ecebf3)}
#hd-share button.hds-go{background:var(--acc2,#5b4bd6);border-color:transparent;color:#fff}
#hd-share button.hds-quiet{border-color:transparent;color:var(--mut,#9a97ab);padding:4px 6px}
#hd-share button:disabled{opacity:.5;cursor:default}
#hd-share .hds-code{font:600 28px var(--mono,ui-monospace,monospace);letter-spacing:.18em}
#hd-share .hds-fp{font:500 12px var(--mono,ui-monospace,monospace);color:var(--ink2,#cfcde0);overflow-wrap:anywhere}
#hd-share .hds-badge{font:600 11px var(--mono,ui-monospace,monospace);border:1px solid var(--line2,#34323f);border-radius:999px;padding:1px 8px;color:var(--mut,#9a97ab)}
#hd-share .hds-bad{color:var(--bad,#e5707a)} #hd-share .hds-ok{color:var(--ok,#5fbf8a)}
#hd-share .hds-note{border-left:3px solid var(--acc,#8a7cf0);padding:2px 0 2px 10px}
#hd-share .hds-sim{background:#6b4a00;color:#fff;font:600 12px var(--mono,monospace);padding:4px 8px;border-radius:6px}
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

// ---- tiny IndexedDB key-value (the panel's own session; never localStorage)
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('holodeck-share', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const d = await idb.open(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { const d = await idb.open(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async del(k) { try { const d = await idb.open(); return new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => res(); }); } catch { /* nothing to remove */ } },
};

// ---- non-secret local bookkeeping: which repo is this workspace? (ids only)
const MAP_KEY = 'hd:share:repos';
const repoIdFor = (corpus) => { try { return (JSON.parse(localStorage.getItem(MAP_KEY) || '{}'))[corpus] || null; } catch { return null; } };
const setRepoIdFor = (corpus, id) => { try { const m = JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); m[corpus] = id; localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* the registry on the account is authoritative */ } };

let root = null, S = null, timer = null, ctxRef = null;

// ----------------------------------------------------------------- public

/** The code in a #join=… fragment, or null. The fragment is removed from the address bar. */
export function inviteFromLocation(loc = globalThis.location, hist = globalThis.history) {
  const code = parseInvite(String((loc && loc.hash) || ''));
  if (code && hist && hist.replaceState) { try { hist.replaceState(null, '', loc.pathname + (loc.search || '')); } catch { /* address bar left as it was */ } }
  return code;
}

export async function openSharePanel(ctx = {}) {
  ctxRef = ctx;
  if (!document.getElementById('hd-share-style')) { const st = el('style', { id: 'hd-share-style' }); st.textContent = CSS; document.head.append(st); }
  if (root) root.remove();
  root = el('aside', { id: 'hd-share', role: 'dialog', 'aria-label': 'Share this repo' });
  document.body.append(root);
  document.addEventListener('keydown', onKey);
  S = { phase: 'boot', error: '', msg: '', busy: '', session: null, mx: null, share: null, repo: null, repos: [], people: [], invites: [], pending: {}, legacy: [], redeem: null, sim: !!ctx.simulated, open: {}, lines: [], summary: null };
  if (ctx.redeemCode) S.prefill = ctx.redeemCode;
  draw();
  await boot();
}
export function closeSharePanel() {
  clearInterval(timer); timer = null;
  document.removeEventListener('keydown', onKey);
  if (S && S.held) { try { releaseMatrix(S.held); } catch { /* the client is stopped when its last holder lets go */ } S.held = null; }
  else if (S && S.mx && S.mx.stop && !S.sim) { try { S.mx.stop(); } catch { /* already stopped */ } }
  if (root) { root.remove(); root = null; }
  try { ctxRef && ctxRef.onClose && ctxRef.onClose(); } catch { /* the page's callback is its own */ }
}
const onKey = (e) => { if (e.key === 'Escape') closeSharePanel(); };

// ----------------------------------------------------------------- boot

async function loadSdk() {
  if (ctxRef.sdk) return ctxRef.sdk;
  const url = ctxRef.sdkUrl || new URL('vendor/matrix-sdk/matrix-sdk.js', location.href).href;
  try { return await import(url); }
  catch (e) { throw gapError('library-missing', 'The encrypted-repo library is not on this site yet. Build it with `node tools/vendor-matrix-sdk.mjs` and reload. Until then nothing is sent anywhere.'); }
}
const gapError = (kind, why) => Object.assign(new Error(why), { gap: true, kind, why });

async function boot() {
  try {
    if (ctxRef.simulated) { await bootSimulated(); return; }
    const sess = (await idb.get('session')) || (await pageSession());
    if (!sess) { S.phase = 'signin'; draw(); return; }
    await connectWith(sess);
  } catch (e) { fail(e); }
}

// The page's own sign-in is read, never written. It carries no device id, which whoami gives.
async function pageSession() {
  try {
    const m = await import(new URL('fold-net.js', location.href).href);
    const s = m.loadSession && m.loadSession();
    if (!s || s.guest || !s.token || !s.base) return null;
    const w = await (await fetch(s.base.replace(/\/$/, '') + '/_matrix/client/v3/account/whoami', { headers: { authorization: 'Bearer ' + s.token } })).json();
    if (!w.device_id) return null;
    return { baseUrl: s.base.replace(/\/$/, ''), userId: w.user_id, deviceId: w.device_id, accessToken: s.token, fromPage: true };
  } catch { return null; }
}

async function connectWith(sess) {
  S.busy = 'Connecting and starting encryption…'; draw();
  const sdk = await loadSdk();
  try { sdk.logger && sdk.logger.setLevel('error'); } catch { /* noisy, harmless */ }
  const { connect } = await import('./holodeck-matrix.js');
  const mx = await acquireMatrix(sess, () => connect({ sdk, baseUrl: sess.baseUrl, userId: sess.userId, deviceId: sess.deviceId, accessToken: sess.accessToken, cryptoPrefix: `holodeck-${sess.userId}-${sess.deviceId}` }));
  S.held = mx;
  attach(mx, { encrypt: sdk.encryptAttachment, decrypt: sdk.decryptAttachment }, sess);
  await afterConnect();
}

async function bootSimulated() {
  const { createFakeServer, fakeAttach } = await import('./holodeck-fake-matrix.js');
  const server = ctxRef.simServer || createFakeServer({ name: 'simulated.local' });
  const mx = server.client(ctxRef.simUser || '@you:simulated.local', { crossSigned: true });
  attach(mx, fakeAttach, { userId: mx.userId, simulated: true });
  await afterConnect();
}

function attach(mx, att, sess) {
  S.mx = mx; S.session = sess;
  S.share = makeShare({ mx, attach: att, onRefuse: (r) => say('bad', r.why), log: (l) => say(l.kind, l.text) });
}

async function afterConnect() {
  S.busy = ''; S.phase = 'ready';
  try { const me = await S.mx.ownDeviceKeys(); S.myCode = await pairingCode(me.ed25519); S.myFp = fingerprintGroups(me.ed25519); } catch { S.myCode = ''; }
  const corpus = ctxRef.corpusId ? ctxRef.corpusId() : 'default';
  const repos = await S.share.listRepos();
  S.repos = repos;
  const want = repoIdFor(corpus);
  S.repo = repos.find((r) => r.repoId === want) || null;
  if (S.repo) S.share.adoptFromRegistry(S.repo.repoId);
  if (ctxRef.wsRooms && !S.sim) { try { S.legacy = await (await import('./holodeck-legacy.js')).detectLegacy({ mx: S.mx, rooms: ctxRef.wsRooms() }); } catch { S.legacy = []; } }
  await refresh();
  clearInterval(timer);
  timer = setInterval(() => { if (!S.busy) refresh().catch(() => {}); }, 3000);
  if (S.prefill) { S.prefillNow = S.prefill; S.prefill = null; }
  draw();
}

function say(kind, text) { S.lines.unshift({ kind, text, at: new Date().toLocaleTimeString() }); if (S.lines.length > 20) S.lines.length = 20; if (root) draw(); }
function fail(e) {
  S.busy = '';
  S.error = (e && (e.why || e.message)) || String(e);
  if (S.phase === 'boot') S.phase = e && e.gap ? 'gap' : 'signin';
  draw();
}

// ----------------------------------------------------------------- data refresh

async function refresh() {
  if (!S.share) return;
  if (S.repo) {
    const base = baseUrl();
    try {
      S.people = await S.share.people(S.repo);
      if (S.repo.owner !== S.mx.userId) S.ownerTrusted = (await S.mx.deviceKeysOf(S.repo.owner)).some((d) => d.verified);
      if (S.repo.owner === S.mx.userId) {
        S.invites = await S.share.listInvites(S.repo, { base });
        const pend = {};
        for (const inv of S.invites) if (inv.state === 'waiting-confirm') pend[inv.door] = await S.share.pendingRequests(inv.door);
        S.pending = pend;
      }
    } catch (e) { S.error = e.why || e.message; }
  }
  const snap = JSON.stringify([S.people, S.invites, S.pending, S.redeem && S.redeem.state, S.error, S.ownerTrusted]);
  if (snap !== S._snap) { S._snap = snap; draw(); }
}

function baseUrl() {
  try { return ctxRef.linkBase ? ctxRef.linkBase() : location.origin + location.pathname.replace(/index\.html$/, ''); } catch { return ''; }
}

// ----------------------------------------------------------------- acts (each: one affordance, one consent)

async function act(label, fn) {
  S.busy = label; S.error = ''; draw();
  try { await fn(); } catch (e) { S.error = (e && (e.why || e.message)) || String(e); say('bad', S.error); }
  S.busy = ''; await refresh().catch(() => {}); draw();
}
// getElementById, not a selector: door ids are room ids and carry '!' and ':'
const val = (id) => { const n = root && root.ownerDocument.getElementById(id); return n ? String(n.value || '').trim() : ''; };

async function doSignIn() {
  await act('Signing in…', async () => {
    const { homeserverUrl, passwordLogin } = await import('./holodeck-matrix.js');
    const hs = homeserverUrl(val('hds-hs'));
    if (hs.error) throw gapError('homeserver', hs.error);
    const sdk = await loadSdk();
    const s = await passwordLogin({ sdk, baseUrl: hs.baseUrl, user: val('hds-user'), password: document.getElementById('hds-pw').value });
    document.getElementById('hds-pw').value = '';
    await idb.set('session', s);
    await connectWith(s);
  });
}
async function doSignOut() { await idb.del('session'); closeSharePanel(); }

async function doCreate() {
  await act('Creating three encrypted stores…', async () => {
    const title = ctxRef.corpusName ? ctxRef.corpusName() : 'Workspace';
    const repo = await S.share.createRepo({ title });
    setRepoIdFor(ctxRef.corpusId ? ctxRef.corpusId() : 'default', repo.repoId);
    S.repo = repo; S.repos = await S.share.listRepos();
  });
}

async function doMint() {
  const role = val('hds-role') || 'editor';
  const history = !!(root.querySelector('#hds-hist') || {}).checked;
  await act('Making an invite…', async () => {
    const m = await S.share.mintInvite(S.repo, { role, history, base: baseUrl() });
    S.fresh = m;
  });
}
async function doCrossSign() {
  await act('Setting up cross-signing…', async () => {
    const r = await S.mx.ensureCrossSigning();
    S.crossSigned = !!r.ready; S.crossGap = r.gap ? r.gap.why : '';
  });
}
async function doConfirm(door) {
  const typed = val('hds-code-' + door);
  await act('Confirming their device…', async () => {
    const r = await S.share.confirm(S.repo, { door, entered: typed });
    S.fresh = null;
    say('ok', `Let in a new ${r.role}.`);
  });
}
async function doRevoke(door) { await act('Closing the invite…', async () => { await S.share.revoke(S.repo, { door }); if (S.fresh && S.fresh.door === door) S.fresh = null; }); }
async function doRemove(user) {
  await act('Removing…', async () => { const r = await S.share.removeMember(S.repo, { user }); S.notice = r.disclosure; });
}
async function doRole(user, role) { await act('Changing role…', async () => { await S.share.setRole(S.repo, { user, role }); }); }
async function doLeave() {
  await act('Leaving…', async () => { const r = await S.share.leave(S.repo); S.notice = r.disclosure; S.repo = null; S.repos = await S.share.listRepos(); });
}
async function doConfirmDevice(user, deviceId) {
  await act('Confirming that device…', async () => { await S.share.confirmDevice(S.repo, { user, deviceId, entered: val('hds-dev-' + deviceId) }); });
}

async function doTrustOwner() {
  await act('Checking their digits…', async () => { await S.share.trustOwner(S.repo, { entered: val('hds-trust-owner') }); S.notice = ''; S.ownerTrusted = true; });
}

async function doRedeem() {
  const input = val('hds-invite');
  await act('Asking to join…', async () => {
    const r = await S.share.redeem({ input });
    S.redeem = { ...r, ownerTyped: '' };
    pollGrant();
  });
}
let grantTimer = null;
function pollGrant() {
  clearInterval(grantTimer);
  grantTimer = setInterval(async () => {
    if (!S || !S.redeem || S.busy) return;
    const typed = val('hds-owner-code');
    // joining waits for the owner's digits: without them this device would not trust the owner's, and what
    // the person writes would be withheld from the owner. Reading needs nothing; being read needs this.
    if (!/^\d{6}$/.test(typed)) return;
    try {
      const r = await S.share.acceptGrant({ door: S.redeem.door, ownerCode: typed });
      clearInterval(grantTimer);
      S.repo = r.repo; S.redeem = null;
      setRepoIdFor(ctxRef.corpusId ? ctxRef.corpusId() : 'default', r.repo.repoId);
      S.repos = await S.share.listRepos();
      S.notice = r.ownerTrusted ? '' : r.note;
      await refresh(); draw();
    } catch (e) {
      if (e.code === REFUSE.NoGrantYet) return;                  // still waiting — that is a state, not an error
      if (e.code === REFUSE.OwnerCodeMismatch) { S.error = e.why; draw(); return; }
      clearInterval(grantTimer); S.error = e.why || e.message; draw();
    }
  }, 2500);
}

async function doSave() {
  await act('Saving this workspace into the repo…', async () => {
    if (!ctxRef.analysis) throw gapError('no-analysis', 'this page did not hand over the workspace to save');
    const { buildLog } = await import('./holodeck-records.js');
    const { events } = buildLog(ctxRef.analysis(), null, {});
    const prefix = 'io.holodeck.';
    const entries = events.filter((e) => e.type.startsWith(prefix)).map((e) => ({ op: e.type.slice(prefix.length), content: e.content })).filter((e) => ['ins', 'def', 'con', 'seg', 'syn', 'eva', 'rec'].includes(e.op));
    const r = await S.share.writeBatch(S.repo, entries);
    S.summary = null;
    say('ok', `Saved ${r.ops} items in ${r.events} sealed events.`);
  });
}
async function doRead() {
  await act('Reading the repo…', async () => {
    const { fold } = await import('./vendor/bare-metal/src/fold.js');
    const r = await S.share.readState(S.repo, { fold });
    const by = r.state.entitiesByType || {};
    S.summary = {
      counts: Object.fromEntries(Object.entries(by).map(([t, a]) => [t, a.length])),
      sources: (by.Sources || []).slice(0, 8).map((a) => (r.state.entities[a] && r.state.entities[a].title) || a),
      notes: (by.Notes || []).map((a) => r.state.entities[a]).filter(Boolean).slice(-5).map((e) => ({ text: e.text, by: e._sender })),
      refused: r.refused.length, undecryptable: r.state._undecryptable || 0,
    };
  });
}
async function doNote() {
  const text = val('hds-note');
  if (!text) return;
  await act('Adding a note…', async () => {
    const anchor = 'note:' + Date.now().toString(36);
    await S.share.write(S.repo, 'ins', { anchor, entity_type: 'Notes', payload: {} });
    await S.share.write(S.repo, 'def', { anchor, path: 'text', value: text });
    document.getElementById('hds-note').value = '';
    await doReadQuiet();
  });
}
async function doReadQuiet() { const { fold } = await import('./vendor/bare-metal/src/fold.js'); const r = await S.share.readState(S.repo, { fold }); const by = r.state.entitiesByType || {}; S.summary = { counts: Object.fromEntries(Object.entries(by).map(([t, a]) => [t, a.length])), sources: (by.Sources || []).slice(0, 8).map((a) => (r.state.entities[a] && r.state.entities[a].title) || a), notes: (by.Notes || []).map((a) => r.state.entities[a]).filter(Boolean).slice(-5).map((e) => ({ text: e.text, by: e._sender })), refused: r.refused.length, undecryptable: r.state._undecryptable || 0 }; }

// ---- legacy: three acts, each its own consent
async function legacyAct(which, room) {
  const L = await import('./holodeck-legacy.js');
  const backup = { put: (k, v) => idb.set('backup:' + k, v), get: (k) => idb.get('backup:' + k), del: (k) => idb.del('backup:' + k) };
  await act(which === 'copy' ? 'Copying into the encrypted stores…' : which === 'blank' ? 'Blanking the old copy…' : 'Restoring the old copy…', async () => {
    if (which === 'copy') { S.copyResult = S.copyResult || {}; S.copyResult[room] = await L.copyToEncrypted({ mx: S.mx, share: S.share, repo: S.repo, room, backup, confirmed: true }); say(S.copyResult[room].verified ? 'ok' : 'bad', S.copyResult[room].verified ? 'Copied, and it reads back identically.' : (S.copyResult[room].why || 'The copy did not read back identically.')); }
    if (which === 'blank') { await L.blankLegacy({ mx: S.mx, share: S.share, room, copy: (S.copyResult || {})[room], confirmed: true }); say('ok', 'The old plaintext copy is blanked.'); }
    if (which === 'rollback') { await L.rollbackLegacy({ mx: S.mx, room, backup, confirmed: true }); say('ok', 'The old plaintext copy is back.'); }
    S.legacy = await L.detectLegacy({ mx: S.mx, rooms: ctxRef.wsRooms() });
    S.ask = null;
  });
}

// ----------------------------------------------------------------- drawing

function draw() {
  if (!root) return;
  // keep what a person is typing across a redraw
  const keep = {};
  root.querySelectorAll('input[id],select[id]').forEach((n) => { keep[n.id] = n.type === 'checkbox' ? n.checked : n.value; });
  const focus = document.activeElement && document.activeElement.id;
  root.replaceChildren(...body());
  // restore what was typed; never overwrite a fresh default (a prefilled invite) with an old empty value
  for (const [id, v] of Object.entries(keep)) { const n = root.querySelector('#' + CSS_escape(id)); if (n) { if (n.type === 'checkbox') n.checked = v; else if (v !== '') n.value = v; } }
  if (focus && root.contains(document.activeElement) === false) { const n = root.querySelector('#' + CSS_escape(focus)); if (n && n.focus) n.focus({ preventScroll: true }); }
}
const CSS_escape = (s) => (globalThis.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));

function body() {
  const out = [];
  out.push(el('div', { class: 'hds-between' }, el('h2', {}, 'Share this repo'), el('button', { class: 'hds-quiet', title: 'Close', onClick: closeSharePanel, type: 'button' }, '✕')));
  if (S.sim) out.push(el('div', { class: 'hds-sim' }, 'SIMULATED — no homeserver is involved; nothing here is encrypted by real Matrix.'));
  out.push(el('p', { class: 'hds-mut' }, 'People you invite read and write this workspace through three encrypted stores on a Matrix server. ' + WORDS.server_sees));
  if (S.busy) out.push(el('div', { class: 'hds-card' }, el('span', {}, S.busy)));
  if (S.error) out.push(el('div', { class: 'hds-card hds-bad' }, S.error));
  if (S.notice) out.push(el('div', { class: 'hds-card hds-note' }, S.notice, el('button', { class: 'hds-quiet', type: 'button', onClick: () => { S.notice = ''; draw(); } }, 'Dismiss')));
  if (S.phase === 'boot') return out;
  if (S.phase === 'gap') return out;
  if (S.phase === 'signin') { out.push(signInCard()); return out; }
  out.push(el('div', { class: 'hds-between' }, el('span', { class: 'hds-mut' }, 'Signed in as ', el('b', {}, S.mx.userId)), S.session && !S.session.fromPage && !S.sim ? el('button', { class: 'hds-quiet', type: 'button', onClick: doSignOut }, 'Sign out') : null));
  if (!S.repo) out.push(createCard()); else { out.push(repoCard()); if (S.repo.owner !== S.mx.userId && S.ownerTrusted === false && S.repo.role !== 'reader') out.push(trustOwnerCard()); if (S.repo.owner === S.mx.userId) { out.push(peopleCard()); out.push(inviteCard()); } else out.push(peopleCard()); out.push(contentCard()); }
  out.push(redeemCard());
  if (S.legacy.some((r) => r.needsAttention)) out.push(legacyCard());
  out.push(policyCard());
  out.push(logCard());
  return out;
}

function signInCard() {
  const cfg = (() => { try { return JSON.parse(localStorage.getItem('fold-net-cfg') || '{}'); } catch { return {}; } })();
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'Sign in to a Matrix account'),
    el('p', { class: 'hds-mut' }, 'Encrypted stores need a real account (not a guest). This page keeps the session and its encryption keys in this browser’s IndexedDB, and never the password.'),
    el('input', { id: 'hds-hs', placeholder: 'homeserver, e.g. matrix.example.org', value: cfg.server || '', autocomplete: 'off' }),
    el('input', { id: 'hds-user', placeholder: 'username', autocomplete: 'username' }),
    el('input', { id: 'hds-pw', type: 'password', placeholder: 'password', autocomplete: 'current-password' }),
    el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: doSignIn }, 'Sign in')));
}

function createCard() {
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'This workspace'),
    el('p', {}, 'It is not an encrypted repo yet. Making it one creates three encrypted stores (sources, records, log) that only people you confirm can read.'),
    el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: doCreate }, 'Make this an encrypted repo')));
}

function trustOwnerCard() {
  return el('div', { class: 'hds-card hds-note' },
    el('h3', {}, 'One more step'),
    el('p', {}, `Have ${S.repo.owner} read you the six digits shown in their Share panel. Until you type them, what you write is withheld from them.`),
    el('div', { class: 'hds-row' }, el('input', { id: 'hds-trust-owner', class: 'hds-grow', inputmode: 'numeric', maxlength: '6', placeholder: 'their six digits' }), el('button', { class: 'hds-go', type: 'button', onClick: doTrustOwner }, 'Confirm')));
}

function repoCard() {
  const mine = S.repo.owner === S.mx.userId ? 'You own this repo.' : `You are ${S.repo.role === 'editor' ? 'an editor' : 'a reader'} here; ${S.repo.owner} owns it.`;
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'Encrypted repo'),
    el('p', {}, mine),
    el('p', { class: 'hds-mut' }, `Stores: ${STORES.join(', ')} · epoch ${S.repo.epoch}`));
}

function peopleCard() {
  const owner = S.repo.owner === S.mx.userId;
  const rows = S.people.filter((p) => p.membership !== 'ban').map((p) => {
    const dev = p.newDevices > 0 ? el('div', { class: 'hds-mut' }, `${p.newDevices} new device${p.newDevices > 1 ? 's' : ''} waiting for the owner to confirm — it receives nothing until then.`) : null;
    return el('div', { class: 'hds-card', 'data-user': p.user },
      el('div', { class: 'hds-between' }, el('b', {}, p.user), el('span', { class: 'hds-badge' }, p.role || p.membership)),
      p.membership === 'invite' ? el('div', { class: 'hds-mut' }, 'Invited — has not joined yet') : null,
      dev,
      owner && p.user !== S.mx.userId ? el('div', { class: 'hds-row' },
        el('select', { id: 'hds-role-' + p.user, 'aria-label': 'Role' }, ['editor', 'reader'].map((r) => el('option', { value: r, selected: p.role === r ? '' : null }, r))),
        el('button', { type: 'button', onClick: () => doRole(p.user, val('hds-role-' + p.user)) }, 'Change role'),
        el('button', { type: 'button', class: 'hds-quiet', onClick: () => { S.ask = { kind: 'remove', user: p.user }; draw(); } }, 'Remove…')) : null,
      S.ask && S.ask.kind === 'remove' && S.ask.user === p.user ? el('div', { class: 'hds-note' },
        el('p', {}, WORDS.removal),
        el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: () => { S.ask = null; doRemove(p.user); } }, 'Remove them'), el('button', { type: 'button', onClick: () => { S.ask = null; draw(); } }, 'Keep them'))) : null);
  });
  return el('div', { class: 'hds-card' }, el('h3', {}, 'People'), rows.length ? rows : el('p', { class: 'hds-mut' }, 'Just you.'),
    !owner ? el('div', { class: 'hds-row' }, el('button', { type: 'button', onClick: () => { S.ask = { kind: 'leave' }; draw(); } }, 'Leave this repo…')) : null,
    S.ask && S.ask.kind === 'leave' ? el('div', { class: 'hds-note' }, el('p', {}, WORDS.leave), el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: () => { S.ask = null; doLeave(); } }, 'Leave'), el('button', { type: 'button', onClick: () => { S.ask = null; draw(); } }, 'Stay'))) : null);
}

function inviteCard() {
  const live = S.invites;
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'Invite someone'),
    el('div', { class: 'hds-row' },
      el('select', { id: 'hds-role', 'aria-label': 'Role for the invitee' }, el('option', { value: 'editor' }, 'Editor — can add and change things'), el('option', { value: 'reader' }, 'Reader — can only read')),
      el('label', { class: 'hds-row' }, el('input', { id: 'hds-hist', type: 'checkbox' }), el('span', {}, 'They can read what is already here'))),
    el('p', { class: 'hds-mut' }, 'Reading the past needs both your device and theirs to be cross-signed; if it cannot be done the invite says so and they read from when they join.'),
    S.mx && S.mx.ensureCrossSigning && !S.sim ? el('div', { class: 'hds-row' }, el('button', { type: 'button', onClick: doCrossSign }, 'Verify this device so past items can be handed over'), S.crossSigned === false ? el('span', { class: 'hds-mut' }, S.crossGap || '') : S.crossSigned ? el('span', { class: 'hds-ok' }, 'This device is verified.') : null) : null,
    S.myCode ? el('p', { class: 'hds-mut' }, 'Your device\u2019s six digits: ', el('b', { 'data-mycode': S.myCode }, S.myCode), ' — read these to the person you invite so they know it is you.') : null,
    el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: doMint }, 'Make an invite')),
    S.fresh ? el('div', { class: 'hds-note' }, el('p', {}, 'Send them this link, or the five-character code. It only lets them ask.'),
      el('input', { class: 'hds-grow', readonly: '', value: S.fresh.link, 'aria-label': 'Invite link', onClick: (e) => e.target.select() }),
      el('div', { class: 'hds-mut' }, `Code ${S.fresh.code} · ${S.fresh.role} · ${historyLine(S.fresh.history)}`)) : null,
    live.length ? el('h3', {}, 'Outstanding') : null,
    live.map((inv) => el('div', { class: 'hds-card', 'data-door': inv.door },
      el('div', { class: 'hds-between' }, el('b', {}, 'Code ' + (inv.code || '—') + ' · ' + inv.role), el('span', { class: 'hds-badge' }, inviteWords(inv))),
      el('div', { class: 'hds-mut' }, `Expires ${new Date(inv.exp).toLocaleString()} · ${historyLine(inv.history)}`),
      inv.state === 'waiting-confirm' ? confirmBlock(inv) : null,
      el('div', { class: 'hds-row' }, inv.state !== 'waiting-confirm' && inv.link ? el('button', { type: 'button', onClick: () => { try { navigator.clipboard.writeText(inv.link); } catch { /* manual copy */ } } }, 'Copy link') : null,
        el('button', { type: 'button', class: 'hds-quiet', onClick: () => doRevoke(inv.door) }, 'Revoke')))));
}

function historyLine(h) {
  if (!h) return '';
  if (!h.want) return 'can read past: no (your choice)';
  if (h.can) return 'can read past: yes';
  return 'can read past: no — ' + (GAP_WORDS[h.gap] || h.gap);
}

function confirmBlock(inv) {
  const reqs = S.pending[inv.door] || [];
  return el('div', { class: 'hds-note' },
    el('p', {}, reqs.length > 1 ? `${reqs.length} people asked with this invite. Type the six digits the person you invited reads to you — only their device will be let in.` : 'Someone asked to join. Call or meet them and have them read you the six digits shown on their screen. Type those digits here.'),
    reqs.map((r) => el('div', { class: 'hds-mut', 'data-request': r.user }, `${r.user} · device ${r.deviceId}`, r.forged ? el('b', { class: 'hds-bad' }, ' · its key does not match the device in the room') : null, el('div', { class: 'hds-fp' }, r.fingerprint.join(' ')))),
    el('div', { class: 'hds-row' },
      el('input', { id: 'hds-code-' + inv.door, inputmode: 'numeric', maxlength: '6', placeholder: '000000', autocomplete: 'one-time-code', class: 'hds-grow' }),
      el('button', { class: 'hds-go', type: 'button', onClick: () => doConfirm(inv.door) }, 'These match — let them in')),
    el('div', { class: 'hds-row' }, el('button', { class: 'hds-quiet', type: 'button', onClick: () => doRevoke(inv.door) }, 'Not them — close this invite')));
}

function contentCard() {
  const canWrite = S.repo.role === 'owner' || S.repo.role === 'editor';
  const sm = S.summary;
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'What is in the repo'),
    el('div', { class: 'hds-row' },
      S.repo.owner === S.mx.userId && ctxRef.analysis ? el('button', { type: 'button', onClick: doSave }, 'Save this workspace into the repo') : null,
      el('button', { type: 'button', onClick: doRead }, 'Read the repo')),
    sm ? el('div', {},
      el('div', { class: 'hds-mut' }, Object.keys(sm.counts).length ? Object.entries(sm.counts).map(([t, n]) => `${n} ${t}`).join(' · ') : 'Nothing written yet.'),
      sm.sources.length ? el('ul', {}, sm.sources.map((t) => el('li', {}, t))) : null,
      sm.notes.length ? el('div', {}, sm.notes.map((n) => el('p', { class: 'hds-mut' }, `“${n.text}” — ${n.by}`))) : null,
      sm.undecryptable ? el('p', { class: 'hds-mut' }, `${sm.undecryptable} item${sm.undecryptable > 1 ? 's' : ''} were written before you joined and cannot be read on this device.`) : null,
      sm.refused ? el('p', { class: 'hds-bad' }, `${sm.refused} item${sm.refused > 1 ? 's' : ''} ignored: written by someone who could not write at the time.`) : null) : null,
    canWrite ? el('div', { class: 'hds-row' }, el('input', { id: 'hds-note', class: 'hds-grow', placeholder: 'Add a note to the repo' }), el('button', { type: 'button', onClick: doNote }, 'Add')) : el('p', { class: 'hds-mut' }, 'You are a reader: you can read everything you were given, and cannot change it.'));
}

function redeemCard() {
  if (S.redeem) {
    const r = S.redeem;
    return el('div', { class: 'hds-card' },
      el('h3', {}, 'Joining'),
      el('p', {}, `Waiting for ${r.owner} to confirm your device. Read them these six digits:`),
      el('div', { class: 'hds-code', 'data-mycode': r.myCode }, r.myCode),
      el('p', { class: 'hds-mut' }, 'Then have them read you theirs, so you know it is really them. Joining finishes when you have typed them:'),
      el('input', { id: 'hds-owner-code', inputmode: 'numeric', maxlength: '6', placeholder: 'their six digits', autocomplete: 'off' }),
      el('div', { class: 'hds-fp' }, 'Your device: ' + r.myFingerprint.join(' ')),
      el('div', { class: 'hds-row' }, el('button', { class: 'hds-quiet', type: 'button', onClick: () => { clearInterval(grantTimer); S.redeem = null; draw(); } }, 'Stop waiting')));
  }
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'Join someone else’s repo'),
    el('div', { class: 'hds-row' }, el('input', { id: 'hds-invite', class: 'hds-grow', placeholder: 'invite link or five-character code', value: S.prefillNow || '' }), el('button', { type: 'button', onClick: doRedeem }, 'Ask to join')),
    el('p', { class: 'hds-mut' }, WORDS.invite_code));
}

function legacyCard() {
  const items = S.legacy.filter((r) => r.needsAttention);
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'Older, unencrypted copy of this workspace'),
    items.map((r) => el('div', { 'data-legacy': r.room },
      r.findings.map((f) => el('p', {}, f)),
      el('p', { class: 'hds-mut' }, 'Nothing here moves unless you say so, one step at a time. The server has already been able to read the old copy and keeps room history; nothing below can unsee that.'),
      !S.repo ? el('p', { class: 'hds-mut' }, 'Make the workspace an encrypted repo first.') : legacySteps(r))));
}
function legacySteps(r) {
  const ask = (which, words) => S.ask && S.ask.kind === 'legacy' && S.ask.which === which && S.ask.room === r.room
    ? el('div', { class: 'hds-note' }, el('p', {}, words), el('div', { class: 'hds-row' }, el('button', { class: 'hds-go', type: 'button', onClick: () => legacyAct(which, r.room) }, 'Yes, do this'), el('button', { type: 'button', onClick: () => { S.ask = null; draw(); } }, 'Not now')))
    : null;
  const btn = (which, label, words) => el('div', {}, el('button', { type: 'button', onClick: () => { S.ask = { kind: 'legacy', which, room: r.room }; draw(); } }, label), ask(which, words));
  return el('div', { class: 'hds-row' },
    btn('copy', '1 · Copy into the encrypted stores…', 'Copies the private work into the encrypted stores and checks the copy reads back identically. The old copy stays where it is.'),
    btn('blank', '2 · Blank the old copy…', 'Blanks the old plaintext copy so the room no longer shows it. A local backup is kept so this can be undone. The server’s earlier history is not touched.'),
    btn('rollback', 'Undo: restore the old copy…', 'Puts the old plaintext copy back from the local backup. This makes the content readable by the server again.'));
}

function policyCard() {
  return el('div', { class: 'hds-card' },
    el('h3', {}, 'What the server can and cannot see'),
    el('p', {}, WORDS.server_sees),
    el('p', { class: 'hds-mut' }, WORDS.unverified),
    el('p', { class: 'hds-mut' }, WORDS.removal),
    el('p', { class: 'hds-mut' }, 'Keys live in this browser’s IndexedDB, protected by your browser profile, not by a passphrase. Older share links from this page carry a throwaway account’s password in the address and do not open these stores; prefer the invites here.'));
}

function logCard() {
  if (!S.lines.length) return el('span', {});
  return el('div', { class: 'hds-card' }, el('h3', {}, 'Activity'), S.lines.slice(0, 6).map((l) => el('div', { class: 'hds-mut ' + (l.kind === 'bad' ? 'hds-bad' : '') }, `${l.at} · ${l.text}`)));
}

// exposed for the browser test and the page hunk
export const _state = () => S;

// The sign-in helpers, shared with the inbox so a person signs in once, the same way, in either place.
export { idb as sessionStore, pageSession, loadSdk, repoIdFor, setRepoIdFor };
