// fold-net.js — Matrix (hyphae.social) workspace rooms, hash-chained blocks, archive.org, search, in-browser Whisper.
const BLOCK = 'social.hyphae.fold.block', CONFIG = 'social.hyphae.fold.config', PRIV = 'social.hyphae.fold.private';
const enc = new TextEncoder();
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async data => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const canon = o => JSON.stringify(o, Object.keys(o).sort());

// ---------- session ----------
const LS = 'fold-matrix-session';
export function loadSession() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
function saveSession(s) { try { s ? localStorage.setItem(LS, JSON.stringify(s)) : localStorage.removeItem(LS); } catch (e) {} }
export async function discover(server) {
  const host = String(server || 'hyphae.social').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try { const r = await fetch('https://' + host + '/.well-known/matrix/client'); if (r.ok) { const j = await r.json(); const b = j['m.homeserver'] && j['m.homeserver'].base_url; if (b) return { host, base: b.replace(/\/+$/, '') }; } } catch (e) {}
  return { host, base: 'https://' + host };
}
async function api(s, method, path, body, raw) {
  const h = {}; if (s && s.token) h.Authorization = 'Bearer ' + s.token;
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  if (raw && raw.type) h['Content-Type'] = raw.type;
  const r = await fetch(s.base + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { raw: t }; }
  if (!r.ok) { const e = new Error((j && (j.error || j.errcode)) || ('HTTP ' + r.status)); e.status = r.status; e.errcode = j && j.errcode; throw e; }
  return j;
}
export async function guest(server) {
  const d = await discover(server);
  try { const j = await api(d, 'POST', '/_matrix/client/v3/register?kind=guest', {}); const s = { ...d, token: j.access_token, user: j.user_id, guest: true }; saveSession(s); return s; }
  catch (e) { if (e.status !== 403 && e.status !== 401) throw e; const s = await provision(server); saveSession(s); return s; }
}
export async function login(server, user, password) {
  const d = await discover(server);
  const j = await api(d, 'POST', '/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user }, password, initial_device_display_name: 'Fold Explorer' });
  const s = { ...d, token: j.access_token, user: j.user_id, guest: false }; saveSession(s); return s;
}
export function logout() { saveSession(null); }

// ---------- share links with ready-made accounts ----------
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
export async function provision(server, regToken) {
  const d = await discover(server); const username = 'fold-' + rnd(10), password = rnd(24);
  const body = { username, password, initial_device_display_name: 'Fold Explorer', inhibit_login: false };
  let j; try { j = await api(d, 'POST', '/_matrix/client/v3/register', body); }
  catch (e) { if (e.status !== 401) throw e; const r = await fetch(d.base + '/_matrix/client/v3/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const flow = await r.json();
    const stages = (flow.flows || []).map(f => f.stages); const has = st => stages.some(s => s.length === 1 && s[0] === st);
    const auth = has('m.login.dummy') ? { type: 'm.login.dummy', session: flow.session } : regToken && stages.some(s => s.includes('m.login.registration_token')) ? { type: 'm.login.registration_token', token: regToken, session: flow.session } : null;
    if (!auth) throw new Error('this homeserver needs a registration token or email to make accounts'); j = await api(d, 'POST', '/_matrix/client/v3/register', { ...body, auth }); }
  return { ...d, token: j.access_token, user: j.user_id, password, guest: false, ephemeral: true };
}
const b64 = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
export async function shareLink(s, rooms, opts) {
  const acct = await provision(s.host, opts && opts.regToken);
  for (const r of rooms.filter(Boolean)) { try { await invite(s, r, acct.user); } catch (e) {} }
  if (opts && opts.name) { try { await api(acct, 'PUT', '/_matrix/client/v3/profile/' + encodeURIComponent(acct.user) + '/displayname', { displayname: opts.name }); } catch (e) {} }
  const payload = { v: 1, hs: acct.host, u: acct.user, p: acct.password, r: rooms.filter(Boolean), from: s.user };
  return { url: location.origin + location.pathname + '#fx-share=' + b64(payload), user: acct.user };
}
export async function consumeShare() {
  const m = String(location.hash).match(/fx-share=([\w-]+)/); if (!m) return null; let P; try { P = unb64(m[1]); } catch (e) { return null; }
  history.replaceState(null, '', location.pathname + location.search);
  const cur = loadSession(); if (cur && cur.user === P.u) return { s: cur, rooms: P.r, from: P.from, reused: true };
  const d = await discover(P.hs); const j = await api(d, 'POST', '/_matrix/client/v3/login', { type: 'm.login.password', identifier: { type: 'm.id.user', user: P.u }, password: P.p, initial_device_display_name: 'Fold Explorer (shared link)' });
  const s = { ...d, token: j.access_token, user: j.user_id, password: P.p, guest: false, ephemeral: true, invitedBy: P.from };
  if (!cur || cur.guest || cur.ephemeral) saveSession(s);
  for (const r of P.r || []) { try { await join(s, r); } catch (e) {} }
  return { s, rooms: P.r || [], from: P.from, pending: !!(cur && !cur.guest && !cur.ephemeral) ? cur : null };
}
export async function claim(s, newPassword, displayName) {
  await api(s, 'POST', '/_matrix/client/v3/account/password', { new_password: newPassword, logout_devices: false, auth: { type: 'm.login.password', identifier: { type: 'm.id.user', user: s.user }, password: s.password } });
  if (displayName) { try { await api(s, 'PUT', '/_matrix/client/v3/profile/' + encodeURIComponent(s.user) + '/displayname', { displayname: displayName }); } catch (e) {} }
  const n = { ...s, password: undefined, ephemeral: false }; saveSession(n); return n;
}
export async function merge(temp, server, user, password, rooms, carry) {
  const main = await login(server, user, password);
  for (const r of rooms.filter(Boolean)) { try { await invite(temp, r, main.user); } catch (e) {} try { await join(main, r); } catch (e) {} }
  if (carry) { try { await carry(main); } catch (e) {} }
  try { await api(temp, 'POST', '/_matrix/client/v3/account/deactivate', { auth: { type: 'm.login.password', identifier: { type: 'm.id.user', user: temp.user }, password: temp.password }, erase: false }); } catch (e) {}
  saveSession(main); return main;
}

// ---------- rooms ----------
export async function resolve(s, idOrAlias) { if (/^!/.test(idOrAlias)) return idOrAlias; const j = await api(s, 'GET', '/_matrix/client/v3/directory/room/' + encodeURIComponent(idOrAlias)); return j.room_id; }
export async function join(s, idOrAlias) { const j = await api(s, 'POST', '/_matrix/client/v3/join/' + encodeURIComponent(idOrAlias), {}); return j.room_id; }
export async function createWorkspace(s, { name, alias, isPublic, config, visibility, preset, topic }) {
  const initial_state = [{ type: CONFIG, state_key: '', content: config || {} }];
  if (isPublic) initial_state.push({ type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'world_readable' } }, { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'can_join' } });
  const body = { name, preset: preset || (isPublic ? 'public_chat' : 'private_chat'), visibility: visibility || (isPublic ? 'public' : 'private'), initial_state, topic: topic || (isPublic ? 'Fold workspace: public source custody, hash-chained blocks' : 'Fold workspace: private work') };
  if (alias) body.room_alias_name = alias;
  const j = await api(s, 'POST', '/_matrix/client/v3/createRoom', body); return j.room_id;
}
export async function setRoomAlias(s, roomId, alias) { return api(s, 'PUT', '/_matrix/client/v3/directory/room/' + encodeURIComponent(alias), { room_id: roomId }); }
export async function invite(s, room, userId) { return api(s, 'POST', '/_matrix/client/v3/rooms/' + encodeURIComponent(room) + '/invite', { user_id: userId }); }
export async function getState(s, room, type, key) { try { return await api(s, 'GET', '/_matrix/client/v3/rooms/' + encodeURIComponent(room) + '/state/' + encodeURIComponent(type) + '/' + encodeURIComponent(key || '')); } catch (e) { if (e.status === 404) return null; throw e; } }
export async function setState(s, room, type, key, content) { return api(s, 'PUT', '/_matrix/client/v3/rooms/' + encodeURIComponent(room) + '/state/' + encodeURIComponent(type) + '/' + encodeURIComponent(key || ''), content); }
export const getConfig = (s, room) => getState(s, room, CONFIG, '');
export const setConfig = (s, room, c) => setState(s, room, CONFIG, '', c);
// ---------- account data (private, synced to the account's own devices) ----------
export async function getAccountData(s, type) { try { return await api(s, 'GET', '/_matrix/client/v3/user/' + encodeURIComponent(s.user) + '/account_data/' + encodeURIComponent(type)); } catch (e) { if (e.status === 404) return null; throw e; } }
export async function setAccountData(s, type, content) { return api(s, 'PUT', '/_matrix/client/v3/user/' + encodeURIComponent(s.user) + '/account_data/' + encodeURIComponent(type), content); }
async function send(s, room, type, content) { const txn = 'fx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return api(s, 'PUT', '/_matrix/client/v3/rooms/' + encodeURIComponent(room) + '/send/' + encodeURIComponent(type) + '/' + txn, content); }
export async function events(s, room, type, max) {
  const out = []; let from = ''; for (let k = 0; k < 40; k++) {
    const q = '?dir=f&limit=100' + (from ? '&from=' + encodeURIComponent(from) : '') + '&filter=' + encodeURIComponent(JSON.stringify({ types: [type] }));
    const j = await api(s, 'GET', '/_matrix/client/v3/rooms/' + encodeURIComponent(room) + '/messages' + q);
    (j.chunk || []).forEach(e => { if (e.type === type) out.push(e); }); if (!j.end || !(j.chunk || []).length || (max && out.length >= max)) break; from = j.end; }
  return out;
}

// ---------- media ----------
export async function upload(s, bytes, name, mime) { const j = await api(s, 'POST', '/_matrix/media/v3/upload?filename=' + encodeURIComponent(name || 'block'), bytes, { type: mime || 'application/octet-stream' }); return j.content_uri; }
export async function download(s, mxc) {
  const m = String(mxc).match(/^mxc:\/\/([^/]+)\/(.+)$/); if (!m) throw new Error('bad mxc');
  const h = s.token ? { Authorization: 'Bearer ' + s.token } : {};
  for (const p of ['/_matrix/client/v1/media/download/', '/_matrix/media/v3/download/']) { try { const r = await fetch(s.base + p + m[1] + '/' + m[2], { headers: h }); if (r.ok) return await r.arrayBuffer(); } catch (e) {} }
  throw new Error('media not reachable');
}

// ---------- hash chain ----------
export async function blockHash(b) { return sha256(canon({ v: b.v, sha256: b.sha256, prev: b.prev || '', meta: canon(b.meta || {}) })); }
export async function readChain(s, room) {
  const ev = await events(s, room, BLOCK); const chain = []; let prev = ''; let ok = true;
  for (const e of ev) { const c = e.content || {}; const h = await blockHash(c); const linked = (c.prev || '') === prev; const self = h === c.block; if (!linked || !self) ok = false; chain.push({ ...c, event_id: e.event_id, sender: e.sender, ts: e.origin_server_ts, linked, self }); prev = c.block; }
  return { chain, ok, head: prev };
}
export async function appendBlock(s, room, bytes, meta, head) {
  const buf = bytes instanceof ArrayBuffer ? bytes : typeof bytes === 'string' ? enc.encode(bytes).buffer : bytes.buffer;
  const h = await sha256(buf); const mxc = await upload(s, buf, meta.filename || meta.title || 'block', meta.mime);
  const b = { v: 1, sha256: h, prev: head || '', meta: { ...meta, size: buf.byteLength } };
  b.block = await blockHash(b); b.mxc = mxc; b.body = (meta.title || meta.filename || 'block') + ' · sha256 ' + h.slice(0, 12);
  await send(s, room, BLOCK, b); return b;
}

// ---------- private room snapshots ----------
export async function savePrivate(s, room, key, data) { return setState(s, room, PRIV, key, { v: 1, at: new Date().toISOString(), data }); }
export async function loadPrivate(s, room, key) { const c = await getState(s, room, PRIV, key); return c && c.data; }

// ---------- archive.org ----------
export function saveToArchive(url) { if (!/^https?:\/\//.test(url || '')) return Promise.resolve(false); return fetch('https://web.archive.org/save/' + url, { mode: 'no-cors' }).then(() => true, () => false); }

// ---------- search ----------
// proxy: a SearXNG base URL (JSON enabled). Returns [{title,url,ytid,published,thumb}]
export async function search(proxy, q, opts) {
  if (!proxy) throw new Error('No search proxy set');
  const u = proxy.replace(/\/+$/, '') + '/search?format=json&q=' + encodeURIComponent(q) + (opts && opts.videos ? '&categories=videos' : '');
  const r = await fetch(u); if (!r.ok) throw new Error('Search proxy HTTP ' + r.status); const j = await r.json();
  return (j.results || []).map(x => { const yt = (String(x.url).match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/) || []); return { title: x.title, url: x.url, ytid: yt[1] || yt[2] || null, published: x.publishedDate || '', snippet: x.content || '', thumb: x.thumbnail || '' }; });
}
export async function ytMeta(url) { try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url)); if (r.ok) return await r.json(); } catch (e) {} return null; }
export async function fetchVia(proxyTpl, url) { const u = proxyTpl ? proxyTpl.replace('{url}', encodeURIComponent(url)) : url; const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }

// ---------- in-browser Whisper ----------
let _asr = null, _asrModel = null;
// opts = { prompt, language }: the priors the transcriber listens with.
// `prompt` becomes Whisper's initial-prompt tokens (the decoder prefix after the
// start/language/task tokens — transformers.js doesn't wire this up itself, so the
// prefix is built from the model's own _retrieve_init_tokens and the tokenizer).
// `language` picks the decoder's language token; English-only (.en) models ignore it.
export async function transcribe(fileOrBuf, onProgress, model, opts) {
  opts = opts || {}; model = model || 'onnx-community/whisper-base';
  onProgress && onProgress({ stage: 'loading model' });
  if (!_asr || _asrModel !== model) { _asr = null; _asrModel = model; const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2'); const device = navigator.gpu ? 'webgpu' : 'wasm';
    _asr = await T.pipeline('automatic-speech-recognition', model, { device, dtype: device === 'webgpu' ? 'fp32' : 'q8', progress_callback: p => onProgress && p.progress != null && onProgress({ stage: 'downloading model', pct: Math.round(p.progress) }) }); }
  onProgress && onProgress({ stage: 'decoding audio' });
  const buf = fileOrBuf instanceof ArrayBuffer ? fileOrBuf : await fileOrBuf.arrayBuffer();
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 16000, 16000); const decoded = await ctx.decodeAudioData(buf.slice(0));
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000); const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start(); const pcm = (await off.startRendering()).getChannelData(0);
  const CH = 30 * 16000, segs = [];
  const lang = opts.language && opts.language !== 'auto' ? opts.language : null;
  const englishOnly = /\.en$/.test(model);
  let decPrefix = null;
  if (opts.prompt || lang) {
    try {
      const g = await _asr.model._prepare_generation_config(null, { return_timestamps: true, ...(englishOnly ? {} : lang ? { language: lang } : {}) });
      let init = _asr.model._retrieve_init_tokens ? _asr.model._retrieve_init_tokens(g) : null;
      if (opts.prompt && _asr.tokenizer) { const tok = await _asr.tokenizer(opts.prompt, { add_special_tokens: false }); if (tok && tok.input_ids) init = [...init, ...tok.input_ids]; }
      decPrefix = init;
    } catch (e) { onProgress && onProgress({ stage: 'prior unavailable (' + (e && e.message || e) + ') — transcribing without it' }); }
  }
  const extra = { return_timestamps: true, chunk_length_s: 30 };
  if (decPrefix) extra.decoder_input_ids = decPrefix;
  if (lang && !englishOnly) extra.language = lang;
  for (let o = 0; o < pcm.length; o += CH) { onProgress && onProgress({ stage: 'transcribing', pct: Math.round(o / pcm.length * 100) });
    const r = await _asr(pcm.subarray(o, Math.min(pcm.length, o + CH)), extra);
    const base = o / 16000; (r.chunks || [{ timestamp: [0, CH / 16000], text: r.text }]).forEach(c => { const t = (c.text || '').trim(); if (t) segs.push({ start: +(base + (c.timestamp[0] || 0)).toFixed(2), end: +(base + (c.timestamp[1] || c.timestamp[0] || 0)).toFixed(2), text: t }); }); }
  onProgress && onProgress({ stage: 'done', pct: 100 });
  return { source: 'in-browser-whisper', model, segments: segs, duration: decoded.duration, priors: { prompt: opts.prompt || null, language: englishOnly ? 'en' : (lang || 'auto') } };
}
