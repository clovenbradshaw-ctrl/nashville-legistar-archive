// holodeck-vault.js — content leaves the device sealed, and the key never goes to the server.
//
// What this is: AES-256-GCM over WebCrypto, a per-workspace key held on member devices, and the few rules that make
// that safe to rely on. It is the layer the Holodeck uses for everything private it writes to Matrix: the
// workspace's private work (pins, drafts, reading history), the names the owner typed, the invitation registry, and
// who is viewing what.
//
// Why not Matrix's own encryption: Matrix never encrypts STATE events (names, registry, the private snapshot are
// state), and a REST client cannot do Megolm. So the content itself is sealed here, and the server only ever
// holds ciphertext it cannot open.
//
// Where the key lives and how it travels:
//   * on a device: in this browser's localStorage, under `hd:vault:v1:<private room id>` (never in a URL, never
//     sent to the homeserver, never logged);
//   * to a new member: inside the invitation's GRANT, sealed under a key derived from the link's own secret, so
//     the server sees a ciphertext that only the person holding the link can open (holodeck-invites.js);
//   * to the owner's other devices: a device link (#vault=…), which is the whole keyring in the fragment;
//   * to the remaining members when someone is removed: a rotation event sealed under the key they already hold,
//     posted after the removed person was banned from the room, so they cannot fetch it.
//
// What it does NOT hide, and says so: who is a member, room names, when events happen, how big they are (padded
// to buckets), event types and state keys, and that a workspace exists. What it cannot give: freshness — a
// malicious server can replay an older sealed value. A removed member keeps every key they held and everything
// they already read. Anything written in plaintext BEFORE this existed stays in the server's history.
//
// PURE: nothing here fetches. The store is injected ({ get(key), set(key, value) }); WebCrypto is the platform's.

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export const VAULT = 'hd.aes256gcm.v1';
export const EPOCH_EVENT = 'io.holodeck.vault.epoch';   // owner -> private room: the next key, sealed under the previous one

export const CODE = Object.freeze({
  Locked: 'vault-locked',          // sealed under a key this device does not hold
  Tampered: 'vault-tampered',      // a key was held but the ciphertext did not authenticate
  Downgrade: 'vault-downgrade',    // plaintext where sealed content is required
  NotSealed: 'not-sealed',
  NotOwner: 'vault-not-owner',     // only the workspace owner starts the encryption
  BadKey: 'vault-bad-key',
  BadRing: 'vault-bad-ring',
  Unkept: 'vault-unkept',          // this browser would not keep the key, so nothing is sealed with it
  TooBig: 'vault-too-big',
});
export class VaultError extends Error {
  constructor(code, why, detail = {}) { super(`${code}: ${why}`); this.name = 'VaultError'; this.vault = true; this.code = code; this.why = why; this.detail = detail; }
}

// ------------------------------------------------------------------ small encodings
export function b64u(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const t = String(str);
  if (!/^[A-Za-z0-9_-]*$/.test(t)) throw new VaultError(CODE.BadKey, 'not a base64url string');
  const s = t.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (t.length % 4)) % 4);
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
export const isKeyString = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{43}$/.test(k);   // 32 bytes

/** A fresh 256-bit key, as base64url. */
export const newKey = () => b64u(rnd(32));
/** A short public name for a key: derived by hashing, so it says nothing about the key itself. */
export async function kidOf(key) {
  const h = new Uint8Array(await subtle().digest('SHA-256', te.encode('holodeck/vault/kid/v1\u0000' + key)));
  return hex(h.subarray(0, 8));
}

const keyCache = new Map();
function cryptoKey(key) {
  if (!isKeyString(key)) throw new VaultError(CODE.BadKey, 'a workspace key is 32 bytes');
  if (!keyCache.has(key)) keyCache.set(key, subtle().importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
  return keyCache.get(key);
}

// ------------------------------------------------------------------ padding and compression
// A sealed value is padded so its length says little: up to 4 KiB to a power of two (min 256), above that to a
// multiple of 4 KiB. Matrix caps an event at 64 KiB, and base64 costs a third, so large values are deflated first.
function pad(body) {
  const n = body.length + 4;
  const size = n <= 4096 ? Math.max(256, 2 ** Math.ceil(Math.log2(n))) : Math.ceil(n / 4096) * 4096;
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, body.length);
  out.set(body, 4);
  return out;
}
function unpad(u8) {
  if (u8.length < 4) throw new VaultError(CODE.Tampered, 'the sealed value is malformed');
  const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0);
  if (n > u8.length - 4) throw new VaultError(CODE.Tampered, 'the sealed value is malformed');
  return u8.subarray(4, 4 + n);
}
const CAN_Z = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function';
const MAX_INFLATED = 8 * 1024 * 1024;
async function pipe(bytes, transform, cap = 0) {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader();
  const chunks = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (cap && n > cap) { try { await reader.cancel(); } catch { /* already closed */ } throw new VaultError(CODE.TooBig, 'a sealed value inflated past its limit'); }
    chunks.push(value);
  }
  const out = new Uint8Array(n); let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// ------------------------------------------------------------------ seal and open
// The ciphertext is bound to WHERE it lives (room, event type, state key, and for events the sender) and to the
// key id and compression flag, so a sealed value cannot be moved to another place and still open.
const aadOf = (kid, z, ctx = {}) => te.encode(['holodeck/vault/v1', kid, String(z), ctx.room || '', ctx.type || '', ctx.key || '', ctx.sender || ''].join('\u0000'));

export const isSealed = (c) => !!c && typeof c === 'object' && c.vault === VAULT && typeof c.kid === 'string' && typeof c.iv === 'string' && typeof c.ct === 'string';

/** Seal `value` (anything JSON) under { kid, key }. Returns the content object to put in the event. */
export async function sealWith({ kid, key }, value, ctx = {}) {
  let body = te.encode(JSON.stringify(value === undefined ? null : value));
  let z = 0;
  if (CAN_Z && body.length > 256) {
    try { const c = await pipe(body, new CompressionStream('deflate-raw')); if (c.length < body.length) { body = c; z = 1; } } catch { /* sealed uncompressed */ }
  }
  const iv = rnd(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(kid, z, ctx) }, await cryptoKey(key), pad(body)));
  return { v: 2, vault: VAULT, kid, z, iv: b64u(iv), ct: b64u(ct) };
}

/** Open sealed `content`. `keyOf(kid)` returns the key for that id or null. Typed errors, never a guess. */
export async function openWith(keyOf, content, ctx = {}) {
  if (!isSealed(content)) throw new VaultError(CODE.NotSealed, 'this is not sealed content');
  const key = await keyOf(content.kid);
  if (!key) throw new VaultError(CODE.Locked, 'this device does not hold the key that sealed this', { kid: content.kid });
  const z = content.z ? 1 : 0;
  let plain;
  try {
    plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64u(content.iv), additionalData: aadOf(content.kid, z, ctx) }, await cryptoKey(key), unb64u(content.ct)));
  } catch (e) {
    if (e && e.vault) throw e;
    throw new VaultError(CODE.Tampered, 'the sealed value did not authenticate: it was changed, or it was moved from where it was sealed', { kid: content.kid });
  }
  let body = unpad(plain);
  if (z) body = await pipe(body, new DecompressionStream('deflate-raw'), MAX_INFLATED);
  try { return JSON.parse(td.decode(body)); } catch { throw new VaultError(CODE.Tampered, 'the sealed value is malformed'); }
}

// ------------------------------------------------------------------ one workspace key, so every writer checks the same slots
// Everything a workspace seals in room state lives in these slots. A device with no key must look at ALL of them
// before it starts a key of its own: if any is already sealed, another device owns the key and this one is locked.
// (Two devices each starting their own key would seal the same workspace under keys that cannot read each other.)
export const SEALED_SLOTS = Object.freeze([
  { type: 'io.holodeck.invites', key: '' },
  { type: 'io.holodeck.people', key: '' },
  { type: 'social.hyphae.fold.private', key: 'work' },
]);
/** `getState(type, key)` -> content|null. True if any slot of this workspace's private room is already sealed. */
export async function anySealed(getState) {
  for (const s of SEALED_SLOTS) {
    let c = null;
    try { c = await getState(s.type, s.key); } catch { c = null; }
    if (isSealed(c)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ the grant key: derived from the link's secret
/**
 * The key an invitation's grant is sealed under, derived from the link's private seed and the door's alias. The
 * person holds the seed (it is in their link); the owner's registry holds this derived key, so any owner device
 * can seal a grant, and the server holds neither.
 */
export async function deriveGrantKey(seed, alias) {
  const raw = unb64u(seed);
  if (raw.length < 16) throw new VaultError(CODE.BadKey, 'an invitation seed is at least 16 bytes');
  const base = await subtle().importKey('raw', raw, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: te.encode('holodeck/vault/grant/v1'), info: te.encode(String(alias)) }, base, 256);
  return b64u(new Uint8Array(bits));
}
export async function sealGrant(grantKey, value, ctx) { return sealWith({ kid: await kidOf(grantKey), key: grantKey }, value, ctx); }
export async function openGrant(grantKey, content, ctx) {
  const mine = await kidOf(grantKey);
  return openWith(async (kid) => (kid === mine ? grantKey : null), content, ctx);
}

// ------------------------------------------------------------------ the keyring (one per workspace, on a device)
/**
 * `store` = { get(key), set(key, value) } (async). A workspace is named by its PRIVATE ROOM id (`scope`). Each key
 * has an epoch number; the highest is current, so a rotation is just "the next number".
 */
export function makeKeyring(store, { account = '' } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') throw new Error('makeKeyring needs a store');
  // Per ACCOUNT as well as per workspace: a second person who signs in on the same browser does not inherit the first
  // person's key (the invitation links this device made are kept per account for the same reason).
  const K = (scope) => 'hd:vault:v1:' + (account ? account + '|' : '') + scope;
  async function read(scope) {
    const v = await store.get(K(scope));
    const keys = {};
    if (v && typeof v === 'object' && v.keys && typeof v.keys === 'object') {
      for (const [kid, r] of Object.entries(v.keys)) if (r && isKeyString(r.k) && Number.isInteger(r.n)) keys[kid] = { k: r.k, n: r.n };
    }
    return keys;
  }
  async function write(scope, keys) {
    try { await store.set(K(scope), { v: 1, keys }); }
    catch { throw new VaultError(CODE.Unkept, 'this browser would not keep the workspace key, so nothing was sealed with it'); }
    const back = await read(scope);
    if (Object.keys(keys).some((kid) => !back[kid])) throw new VaultError(CODE.Unkept, 'this browser did not keep the workspace key, so nothing was sealed with it');
  }
  const pick = (keys) => Object.entries(keys).sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1))[0] || null;
  const cur = (keys) => { const p = pick(keys); return p ? { kid: p[0], key: p[1].k, n: p[1].n } : null; };

  const ring = {
    async has(scope) { return Object.keys(await read(scope)).length > 0; },
    async current(scope) { return cur(await read(scope)); },
    keyFn(scope) { return async (kid) => { const r = (await read(scope))[kid]; return r ? r.k : null; }; },

    /** The first key of a workspace. Only the owner's device calls this (the callers check). */
    async ensure(scope) {
      const keys = await read(scope);
      if (Object.keys(keys).length) return cur(keys);
      const key = newKey(); const kid = await kidOf(key);
      keys[kid] = { k: key, n: 1 };
      await write(scope, keys);
      return { kid, key, n: 1 };
    },
    /** A new current key. Returns it and the one it replaces (the rotation event is sealed under the old one). */
    async rotate(scope) {
      const keys = await read(scope);
      const prev = cur(keys);
      if (!prev) throw new VaultError(CODE.Locked, 'there is no key to rotate on this device');
      const key = newKey(); const kid = await kidOf(key);
      keys[kid] = { k: key, n: prev.n + 1 };
      await write(scope, keys);
      return { next: { kid, key, n: prev.n + 1 }, previous: prev };
    },
    /** The next key and the one it replaces, WITHOUT keeping it: the caller sends the rotation event, then adopts it. */
    async planRotation(scope) {
      const prev = cur(await read(scope));
      if (!prev) throw new VaultError(CODE.Locked, 'there is no key to rotate on this device');
      const key = newKey();
      return { next: { kid: await kidOf(key), key, n: prev.n + 1 }, previous: prev };
    },
    async add(scope, key, n) {
      if (!isKeyString(key)) throw new VaultError(CODE.BadKey, 'a workspace key is 32 bytes');
      const kid = await kidOf(key);
      const keys = await read(scope);
      if (keys[kid]) return kid;
      keys[kid] = { k: key, n: Number.isInteger(n) ? n : (cur(keys) ? cur(keys).n : 0) + 1 };
      await write(scope, keys);
      return kid;
    },

    async sealFor(scope, value, ctx = {}) {
      const c = cur(await read(scope));
      if (!c) throw new VaultError(CODE.Locked, 'this device does not hold the workspace key');
      return sealWith({ kid: c.kid, key: c.key }, value, { room: scope, ...ctx });
    },
    async openFor(scope, content, ctx = {}) { return openWith(ring.keyFn(scope), content, { room: scope, ...ctx }); },

    /** The whole keyring as one string, for the owner's other devices. Treat it like a password. */
    async exportRing(scope) {
      const keys = await read(scope);
      if (!Object.keys(keys).length) throw new VaultError(CODE.Locked, 'there is no workspace key on this device to share');
      return 'v1.' + b64u(te.encode(JSON.stringify({ s: scope, k: keys })));
    },
    /** Merge a keyring string in. With `scope`, it must be for that workspace. Every key id is re-derived and checked. */
    async importRing(text, { scope = null } = {}) {
      const m = String(text || '').trim().match(/^v1\.([A-Za-z0-9_-]+)$/);
      if (!m) throw new VaultError(CODE.BadRing, 'that is not a workspace key');
      let o; try { o = JSON.parse(td.decode(unb64u(m[1]))); } catch { throw new VaultError(CODE.BadRing, 'that is not a workspace key'); }
      if (!o || typeof o.s !== 'string' || !o.s || !o.k || typeof o.k !== 'object') throw new VaultError(CODE.BadRing, 'that is not a workspace key');
      if (scope && o.s !== scope) throw new VaultError(CODE.BadRing, 'that key is for a different workspace', { scope: o.s });
      const keys = await read(o.s);
      let added = 0;
      for (const [kid, r] of Object.entries(o.k)) {
        if (!r || !isKeyString(r.k) || !Number.isInteger(r.n) || (await kidOf(r.k)) !== kid) throw new VaultError(CODE.BadRing, 'that workspace key is damaged');
        if (!keys[kid]) { keys[kid] = { k: r.k, n: r.n }; added++; }
      }
      if (added) await write(o.s, keys);
      return { scope: o.s, added };
    },

    /** The rotation event's content: the new key, sealed under the key it replaces. */
    async epochContent(scope, { next, previous }) {
      return sealWith({ kid: previous.kid, key: previous.key }, { kid: next.kid, key: next.key, n: next.n }, { room: scope, type: EPOCH_EVENT, key: '' });
    },
    /**
     * Take in rotation events (as read from the room: { type, sender, content }). Only events from `trusted`
     * senders are used, and each key's id is re-derived. Repeats until nothing new opens, so several rotations
     * in a row are followed. Returns how many keys were gained.
     */
    async absorb(scope, events, { trusted = () => true } = {}) {
      let gained = 0;
      for (let pass = 0; pass < 16; pass++) {
        let more = 0;
        for (const e of events || []) {
          if (!e || e.type !== EPOCH_EVENT || !trusted(e.sender) || !isSealed(e.content)) continue;
          const keys = await read(scope);
          if (!keys[e.content.kid]) continue;
          let v;
          try { v = await openWith(ring.keyFn(scope), e.content, { room: scope, type: EPOCH_EVENT, key: '' }); } catch { continue; }
          if (!v || !isKeyString(v.key) || !Number.isInteger(v.n) || (await kidOf(v.key)) !== v.kid || keys[v.kid]) continue;
          keys[v.kid] = { k: v.key, n: v.n };
          await write(scope, keys);
          more++;
        }
        if (!more) break;
        gained += more;
      }
      return gained;
    },
  };
  return ring;
}

// ------------------------------------------------------------------ the device's own store
/** localStorage, async-shaped. A write that fails THROWS: a key this browser cannot keep is never used to seal. */
export function localStorageStore(ls) {
  const get = () => { try { return ls || globalThis.localStorage; } catch { return null; } };
  return {
    async get(k) { try { const t = get().getItem(k); return t ? JSON.parse(t) : null; } catch { return null; } },
    async set(k, v) { get().setItem(k, JSON.stringify(v)); },
  };
}
const deviceRings = new Map();
/** The keyring this browser uses for one signed-in account, shared by every part of the page that seals or opens. */
export function deviceKeyring(account = '') {
  const a = String(account || '');
  if (!deviceRings.has(a)) deviceRings.set(a, makeKeyring(localStorageStore(), { account: a }));
  return deviceRings.get(a);
}
