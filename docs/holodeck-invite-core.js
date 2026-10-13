// holodeck-invite-core.js — the small pure pieces under holodeck-invites.js.
//
// PURE: no I/O. An invitation is a magic link (one secret half, in its #fragment) plus an authenticator app (the
// other half, on the person's phone). Nobody types a password and nothing is emailed.
//
//   * The door alias is long (16 characters) because nobody types it; the link carries it.
//   * The invitation is an Ed25519 key pair: the link carries the private half, room state the public half. The
//     person's PROOF is a signature over (door, their account): it cannot be replayed for another account or door,
//     the homeserver can read it and forge nothing, and the owner stores no secret.
//   * The six digits are an RFC 6238 TOTP, so any authenticator app makes them. The gate, not this file's callers,
//     holds the shared secret; it is shown once, to the person enrolling.

export const MAX_ATTEMPTS = 5;
export const HEARTBEAT_MS = 30 * 1000;
export const ONLINE_MS = 90 * 1000;
export const NAME_MAX = 80;
export const ALIAS_LENGTH = 16;

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';          // the no-confusion alphabet heimdall uses for short codes
const enc = new TextEncoder();

/** An unbiased integer in [0, n): rejection sampling, never a modulo of random bytes. */
export function randomBelow(n, rng = (u32) => crypto.getRandomValues(u32)) {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError('randomBelow: n out of range');
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) { rng(buf); if (buf[0] < limit) return buf[0] % n; }
}
export const newDoorAlias = (rng) => Array.from({ length: ALIAS_LENGTH }, () => ALPHABET[randomBelow(ALPHABET.length, rng)]).join('');
export const isDoorAlias = (a) => typeof a === 'string' && a.length === ALIAS_LENGTH && [...a].every((c) => ALPHABET.includes(c));

export const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const validAddress = (s) => { const e = String(s || '').trim().toLowerCase(); return e.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(e); };

/** "ana.smith@example.com" -> "Ana Smith". Only used when someone pastes an address and no name. */
export function nameFromAddress(addr) {
  const local = String(addr || '').split('@')[0].replace(/[._+-]+/g, ' ').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
  const t = local.split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return cleanName(t) || 'Guest';
}

/**
 * Whatever a person pastes — one per line, or separated by ; — into [{ name }]. Names are all that is kept. If a
 * line has an email address in it, the address is used only to make a name when there is none, and then dropped:
 * nothing here is ever emailed, so an address is never stored. Duplicate names are kept once.
 */
export function parseInviteLines(text) {
  const rows = [], seen = new Set();
  for (const raw of String(text == null ? '' : text).split(/[\n;]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/[^\s@<>"',;|]+@[^\s@<>"',;|]+\.[^\s@<>"',;|]+/);
    let name;
    if (m && validAddress(m[0])) {
      const rest = line.replace(m[0], ' ').replace(/[<>"|]/g, ' ').replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g, '').replace(/\s*[,|]\s*/g, ' ').trim();
      name = cleanName(rest) || nameFromAddress(m[0]);
    } else {
      name = cleanName(line.replace(/[<>"|]/g, ' '));
    }
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ name });
  }
  return rows;
}

// ------------------------------------------------------------------ the invitation's key (Ed25519)
// The link carries a PRIVATE signing key; the workspace's room state carries only the PUBLIC half. The person proves they
// hold the link by signing (door, their account); any browser signed in as the owner can verify, and nothing secret is
// stored on the owner's side. The homeserver sees the public key and the signature and can forge neither.

const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
// PKCS#8 wrapper for a raw 32-byte Ed25519 seed (RFC 8410): this is what WebCrypto will import.
const PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
const privKey = (seed) => crypto.subtle.importKey('pkcs8', new Uint8Array([...PKCS8, ...unb64u(seed)]), { name: 'Ed25519' }, true, ['sign']);
const message = ({ door, user }) => enc.encode(['holodeck/invite-signature/v3', door, user].map((x) => String(x == null ? '' : x)).join('\n'));

/** A fresh invitation key: { seed (the link carries this, 43 chars), pub (room state carries this, 43 chars) }. */
export async function newInviteKey() {
  const seed = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const jwk = await crypto.subtle.exportKey('jwk', await privKey(seed));
  return { seed, pub: jwk.x };
}
/** What the person sends: a signature over (door, account), made with the key in their link. */
export async function signInvite(seed, ctx) {
  return b64u(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, await privKey(seed), message(ctx))));
}
/** Does this signature, for this door and account, verify under the invitation's public key? Never throws. */
export async function verifyInvite(pub, ctx, signature) {
  try {
    const key = await crypto.subtle.importKey('raw', unb64u(pub), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64u(signature), message(ctx));
  } catch { return false; }
}

// ------------------------------------------------------------------ proof

const te = (s) => enc.encode(String(s));
async function hmacHex(keyText, msgText) {
  const key = await crypto.subtle.importKey('raw', te(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, te(msgText)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** What the invitee sends instead of the digits. Bound to the door and the account. */
export function inviteProof(secretHalf, digits, { door, user }) {
  return hmacHex(`${secretHalf}:${digits}`, ['holodeck/invite-proof/v2', door, user].map((x) => String(x == null ? '' : x)).join('\n'));
}
/** Constant-time comparison of two hex strings (length difference is not secret here). */
export function safeEqualHex(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length || x.length === 0) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ------------------------------------------------------------------ authenticator app (RFC 6238 TOTP)
// HMAC-SHA1, 30-second steps, six digits: the defaults every authenticator app implements.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(u8) {
  let bits = 0, value = 0, out = '';
  for (const b of u8) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[\s=-]+/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('not base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));      // 160 bits, as RFC 4226 recommends

/** The code for a moment. `at` is milliseconds; `secret` is base32 text or bytes. */
export async function totpCode(secret, at, { step = 30, digits = 6 } = {}) {
  const keyBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counter = Math.floor(Math.floor(at / 1000) / step);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  new DataView(msg.buffer).setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 15;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}
/** The codes an authenticator might show right now: this step and one either side (a minute and a half of clock error). */
export async function totpCandidates(secret, at, { window = 1, step = 30 } = {}) {
  const out = [];
  for (let i = -window; i <= window; i++) out.push(await totpCode(secret, at + i * step * 1000, { step }));
  return out;
}
/** What an authenticator app scans (the otpauth:// URI) — shown as a QR code on the owner's screen. */
export function otpauthUri({ secret, account, issuer = 'Holodeck' }) {
  const label = encodeURIComponent(issuer) + ':' + encodeURIComponent(String(account || 'invite').slice(0, 60));
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
/** The setup key in groups of four, for typing into an app when scanning is not possible. */
export const groupKey = (secret) => String(secret || '').replace(/(.{4})/g, '$1 ').trim();

// ------------------------------------------------------------------ presence

/**
 * Who is online, from heartbeat events. The displayed name comes from the OWNER'S names for the event's
 * authenticated sender — never from the heartbeat's own content, which anyone could set to anything.
 *   events: [{ type, content, sender, origin_server_ts, decrypted }]
 *   nameOf(user) -> string|null      roleOf(user) -> 'owner'|'member'|null (now)
 */
export function onlineNow(events, { type, now, nameOf, roleOf, ttl = ONLINE_MS, self = null }) {
  const latest = new Map();
  for (const e of events || []) {
    if (!e || e.type !== type || e.decrypted === false || typeof e.sender !== 'string') continue;
    const ts = Number(e.origin_server_ts) || 0;
    const prev = latest.get(e.sender);
    if (!prev || ts >= prev.ts) latest.set(e.sender, { ts, content: e.content || {} });
  }
  const out = [];
  for (const [user, v] of latest) {
    if (now - v.ts > ttl || v.ts - now > ttl) continue;     // stale, or a timestamp from the future
    const role = roleOf(user);
    if (!role) continue;                                    // removed, or never a member
    const c = v.content;
    out.push({
      user, role, self: user === self,
      name: nameOf(user) || user,
      viewing: typeof c.viewing === 'string' ? c.viewing.slice(0, 200) : '',
      title: typeof c.title === 'string' ? c.title.replace(/[\u0000-\u001f]/g, ' ').slice(0, 200) : '',
      at: v.ts,
    });
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.user.localeCompare(b.user));
}
