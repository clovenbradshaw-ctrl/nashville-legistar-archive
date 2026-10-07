// matrix.js — preserving a chat, and sharing it, through a Matrix homeserver
// the person names, with nothing readable ever leaving this page.
//
// The pattern is eopm's (its ENCRYPTION-DESIGN.md, crypto/envelope.js,
// crypto/blockcodec.js, blocks.js, invitelink.js), carried over rather than
// re-invented: a room is a place to put OPAQUE BYTES and to hand out the one
// key that opens them. What the homeserver holds —
//
//   the media store   blocks: AES-256-GCM ciphertext under the chat key,
//                     hash-linked (each block names the previous block's
//                     mxc and the SHA-256 of its ciphertext)
//   room state        fold.chat        the room is one of ours (no content)
//                     fold.member_key  each member's ECDH P-256 public key
//                     fold.chat_key    the chat key, ECIES-wrapped to one
//                                      member (state_key = that member)
//                     fold.chain       one member's chain head + manifest
//                                      ({mxc, sha256} per block — pointers)
//
// — is what a homeserver operator, a network, or a non-member can read: WHO
// is in the room, HOW MANY blocks of WHAT SIZE went up WHEN, and public
// keys. Never a turn, a source, a name a person typed. The chat key travels
// only two ways: wrapped to a member's public key (in state, unreadable
// without their private key), or in the FRAGMENT of a share link, which
// browsers never send to any server.
//
// Why AES-GCM under one chat key and not Matrix's own room encryption: Megolm
// is device-scoped and forward-secret — the wrong shape for a record that
// every authorised reader must read in full, forever, from a fresh browser
// (eopm learned this the hard way; its design doc says why). And why not the
// Matrix encrypted-attachment format (v2, AES-CTR) for the blocks: its
// per-file key sits in event content, which without Megolm is cleartext;
// here the key that opens a block never appears in any event at all.
//
// PURE: no fetch, no DOM, no storage. Runs under Node's WebCrypto, so every
// claim above is provable in matrix.test.mjs; the crossing (matrix-client.js)
// only moves bytes this file produced.

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const NS = "fold";
export const TYPES = Object.freeze({
  meta: `${NS}.chat`,
  memberKey: `${NS}.member_key`,
  chatKey: `${NS}.chat_key`,
  chain: `${NS}.chain`,
  mouth: `${NS}.mouth`,
  want: `${NS}.want`,
  /** A same-account sibling device's public keys (2026-09-11): one event per
   * account (state_key = the account), a list of device pubs — separate from
   * member_key on purpose, because member_key is the account's ONE current
   * key (a wiped browser REPLACES it), while siblings coexist. */
  sibling: `${NS}.sibling`,
});
/** Timeline events: the room as a mouth. A job is a sealed prompt addressed
 * to one member who offered to answer; an answer is the sealed reply. */
export const EVENTS = Object.freeze({ job: `${NS}.job`, answer: `${NS}.answer` });
/** Every member holds full power (user's decision, 2026-09-05): whoever is
 * in the room can invite, write any state, rename, and remove — a room of
 * equals, not a creator with viewers. */
export const FULL_POWER = 100;
/** A sealed event body above this rides in the media store instead — Synapse
 * refuses an event over 64 KiB, and this leaves room for the rest of it. */
export const EVENT_SEAL_MAX_BYTES = 48 * 1024;
export const BLOCK_VERSION = 1;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const WRAP_INFO = "fold-chat-key-wrap";
/** Synapse caps a state event at 64 KiB; the manifest keeps the newest
 * pointers that fit and a reader walks prev-pointers past the oldest. */
export const MANIFEST_MAX_BYTES = 48 * 1024;

// ── bytes ↔ text ────────────────────────────────────────────────────────────
export function b64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
export function unb64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
export const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function unb64url(s) { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); return unb64(t + "=".repeat((4 - (t.length % 4)) % 4)); }
export const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export async function sha256B64(bytes) { return b64(new Uint8Array(await subtle.digest("SHA-256", bytes))); }

// ── the chat key and the envelope: AES-256-GCM, [iv(12)][ciphertext+tag] ───
export function generateChatKey() { return randomBytes(KEY_BYTES); }
async function aesKey(raw) {
  if (!(raw instanceof Uint8Array) || raw.length !== KEY_BYTES) throw new Error(`a chat key is ${KEY_BYTES} bytes`);
  return subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
export async function encryptBytes(keyBytes, bytes) {
  const key = await aesKey(keyBytes);
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return out;
}
export async function decryptBytes(keyBytes, blob) {
  const key = await aesKey(keyBytes);
  if (!(blob instanceof Uint8Array) || blob.length < IV_BYTES + 16) throw new Error("not an envelope");
  try { return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: blob.subarray(0, IV_BYTES) }, key, blob.subarray(IV_BYTES))); }
  catch { throw new Error("cannot open: wrong key or tampered bytes"); }
}

// ── identity: one ECDH P-256 pair per browser; the chat key is ECIES-wrapped to it
export async function generateIdentity() { return subtle.generateKey(ECDH, true, ["deriveBits"]); }
export async function exportPublicKey(pub) { return b64(new Uint8Array(await subtle.exportKey("spki", pub))); }
export async function importPublicKey(spkiB64) { return subtle.importKey("spki", unb64(spkiB64), ECDH, true, []); }
export async function exportPrivateKey(priv) { return b64(new Uint8Array(await subtle.exportKey("pkcs8", priv))); }
export async function importPrivateKey(pkcs8B64) { return subtle.importKey("pkcs8", unb64(pkcs8B64), ECDH, true, ["deriveBits"]); }
async function wrapKeyFor(priv, pub) {
  const shared = await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
  const hkdf = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode(WRAP_INFO) }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
/** Wrap the chat key for one recipient (their SPKI b64 or CryptoKey): a fresh
 * ephemeral pair per wrap, so the blob opens only with THAT recipient's
 * private key. Returns the `fold.chat_key` content minus version fields. */
export async function wrapChatKey(recipientPub, chatKey) {
  const pub = typeof recipientPub === "string" ? await importPublicKey(recipientPub) : recipientPub;
  const eph = await subtle.generateKey(ECDH, true, ["deriveBits"]);
  const wk = await wrapKeyFor(eph.privateKey, pub);
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, wk, chatKey));
  const blob = new Uint8Array(iv.length + ct.length); blob.set(iv, 0); blob.set(ct, iv.length);
  return { eph_pub: await exportPublicKey(eph.publicKey), blob: b64(blob) };
}
export async function unwrapChatKey(privateKey, { eph_pub, blob }) {
  const wk = await wrapKeyFor(privateKey, await importPublicKey(eph_pub));
  const b = unb64(blob);
  try { return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: b.subarray(0, IV_BYTES) }, wk, b.subarray(IV_BYTES))); }
  catch { throw new Error("this wrapped key is not for this identity"); }
}

// ── blocks: the chain in the media store ────────────────────────────────────
/** One preserved entry. `id` is content-derived so a re-push from another
 * browser of the same person dedups on read (eopm: dedup on read, never
 * coordinate on write). */
export async function entryId(entry) {
  return b64url((new Uint8Array(await subtle.digest("SHA-256", encoder.encode(JSON.stringify([entry.kind ?? "turn", entry.role ?? null, entry.content ?? null, entry.seq ?? null]))))).subarray(0, 18));
}
export async function encodeBlock(chatKey, { idx, prev, entries, ts = Date.now() }) {
  if (!Number.isInteger(idx) || idx < 0) throw new Error("a block has a non-negative index");
  const payload = { v: BLOCK_VERSION, idx, ts, prev: prev ? { mxc: prev.mxc, sha256: prev.sha256, epoch: prev.epoch ?? 0 } : null, entries };
  const plaintext = encoder.encode(JSON.stringify(payload));
  const bytes = await encryptBytes(chatKey, plaintext);
  return { bytes, sha256: await sha256B64(bytes), plaintext };
}
export async function decodeBlock(chatKey, bytes, expectedSha256 = null) {
  if (expectedSha256 && (await sha256B64(bytes)) !== expectedSha256) throw new Error("block hash mismatch — the chain is broken or tampered");
  const block = JSON.parse(decoder.decode(await decryptBytes(chatKey, bytes)));
  if (block.v !== BLOCK_VERSION) throw new Error(`unknown block version ${block.v}`);
  if (!Array.isArray(block.entries)) throw new Error("a block carries entries");
  return block;
}
/** Every member's chain, merged: dedup by id, ordered by (ts, seq). */
export function mergeChains(chains) {
  const seen = new Set(); const out = [];
  for (const blocks of chains) for (const block of blocks) for (const e of block.entries) {
    if (!e?.id || seen.has(e.id)) continue; seen.add(e.id); out.push(e);
  }
  return out.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0) || (a.seq ?? 0) - (b.seq ?? 0));
}
/** A pointer: where, its hash, and the key epoch that opens it. */
export const manifestEntry = (mxc, sha256, epoch = 0) => ({ m: mxc, h: sha256, e: epoch });
/** Keep the newest pointers that fit the state-event budget; `base` is the
 * absolute index of the first kept pointer, so a reader knows what to walk. */
export function capManifest(entries, base = 0) {
  let list = entries.slice(); let b = base;
  while (list.length && encoder.encode(JSON.stringify(list)).length > MANIFEST_MAX_BYTES) { list = list.slice(1); b += 1; }
  return { manifest: list, base: b };
}
/** Verify a walked chain: each block's prev names the previous block's sha256. */
export function chainIsLinked(blocks) {
  for (let i = 1; i < blocks.length; i++) {
    const { block, sha256 } = blocks[i - 1];
    if (!blocks[i].block.prev || blocks[i].block.prev.sha256 !== sha256 || blocks[i].block.idx !== block.idx + 1) return { linked: false, at: i };
  }
  return { linked: true, at: null };
}

// ── what goes to the homeserver: the shapes ─────────────────────────────────
export const paths = Object.freeze({
  wellKnown: () => "/.well-known/matrix/client",
  versions: () => "/_matrix/client/versions",
  login: () => "/_matrix/client/v3/login",
  logout: () => "/_matrix/client/v3/logout",
  whoami: () => "/_matrix/client/v3/account/whoami",
  createRoom: () => "/_matrix/client/v3/createRoom",
  directory: (alias) => `/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`,
  joinedRooms: () => "/_matrix/client/v3/joined_rooms",
  join: (room) => `/_matrix/client/v3/join/${encodeURIComponent(room)}`,
  invite: (room) => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/invite`,
  kick: (room) => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/kick`,
  members: (room) => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/members`,
  // Matrix's own presence, which a homeserver may not serve at all (it is
  // commonly disabled for load). A 404 or a 403 here is a fact about the
  // SERVER, never about the person — the caller types it as unknown rather
  // than drawing them offline, the same three-state discipline the routes
  // pane holds (P178).
  presence: (user) => `/_matrix/client/v3/presence/${encodeURIComponent(user)}/status`,
  allState: (room) => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/state`,
  // Account data — private key/value storage that syncs to every device
  // signed into this SAME account and is never exposed to a room or its
  // other members (a room's own state/timeline, above, is the opposite of
  // this). The one place `profile.js`'s ledger is pushed/pulled from —
  // never a room, so it can never leak into a shared chat.
  accountData: (user, type) => `/_matrix/client/v3/user/${encodeURIComponent(user)}/account_data/${encodeURIComponent(type)}`,
  state: (room, type, key = "") => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/state/${encodeURIComponent(type)}/${encodeURIComponent(key)}`,
  send: (room, type, txn) => `/_matrix/client/v3/rooms/${encodeURIComponent(room)}/send/${encodeURIComponent(type)}/${encodeURIComponent(txn)}`,
  sync: ({ since = null, filter, timeout = 0 }) => `/_matrix/client/v3/sync?filter=${encodeURIComponent(JSON.stringify(filter))}&timeout=${timeout}${since ? `&since=${encodeURIComponent(since)}` : ""}`,
  upload: (name = "block") => `/_matrix/media/v3/upload?filename=${encodeURIComponent(name)}`,
  download: (mxc) => { const m = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxc); if (!m) throw new Error(`not an mxc uri: ${mxc}`); return [`/_matrix/client/v1/media/download/${m[1]}/${m[2]}`, `/_matrix/media/v3/download/${m[1]}/${m[2]}`]; },
});
/** A bare name becomes an https origin; only a localhost address may be http.
 * No homeserver is named or preferred anywhere in this page (user's decision,
 * 2026-09-05): the person types theirs. */
export function homeserverBase(input) {
  let s = String(input ?? "").trim().replace(/\/+$/, "");
  if (!s) throw new Error("name a homeserver");
  if (!/^https?:\/\//.test(s)) s = "https://" + s; // a scheme, never a host: the person's name follows
  const u = new URL(s);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol === "http:" && !local) throw new Error("a homeserver is reached over https");
  return u.origin;
}
export const loginBody = (user, password, deviceName = "The Fold") => ({ type: "m.login.password", identifier: { type: "m.id.user", user }, password, initial_device_display_name: deviceName });
/** A heimdall fleet room: public-join (a worker opens the share link and
 *  joins with a throwaway account), unlisted, unencrypted, no power override.
 *  The room is only a directory for heimdall's WebRTC signaling — its
 *  to-device messages carry the offers, never the room's timeline — so it
 *  holds none of the chat room's sealed-envelope machinery. */
export function heimdallRoomBody(name, { now = new Date().toISOString() } = {}) {
  return {
    name, visibility: "private", preset: "public_chat",
    initial_state: [
      { type: "m.room.history_visibility", state_key: "", content: { history_visibility: "shared" } },
      { type: TYPES.meta, state_key: "", content: { app: NS, v: 1, created_at: now, heimdall: true } },
    ],
  };
}
/** Private, invite-only, every member at full power; the meta event marks it
 *  as ours. No m.room.encryption: the room's readable content is never in its
 *  timeline — a job or an answer there is a sealed envelope. */
export function createRoomBody(name, { now = new Date().toISOString() } = {}) {
  return {
    name, visibility: "private", preset: "private_chat",
    power_level_content_override: { users_default: FULL_POWER, state_default: FULL_POWER, events_default: 0, invite: 0, kick: FULL_POWER, ban: FULL_POWER, redact: FULL_POWER },
    initial_state: [
      { type: "m.room.join_rules", state_key: "", content: { join_rule: "invite" } },
      { type: "m.room.history_visibility", state_key: "", content: { history_visibility: "shared" } },
      { type: TYPES.meta, state_key: "", content: { app: NS, v: 1, created_at: now } },
    ],
  };
}
/** A member's key, with — when they came by a bound link — the proof that
 * binds this key to that link's secret, this room and this account. */
export const memberKeyContent = (pubB64, proof = null) => ({ v: 1, alg: "ecdh-p256", pub: pubB64, ...(proof ? { proof } : {}) });
/** A same-account sibling event: the account's device public keys, listed.
 * The account is its own trust boundary (user decision 2026-09-11) — a
 * sibling is granted the chat key automatically, still ECDH-wrapped to its
 * own public key, so the homeserver holds only ciphertext. */
export const siblingContent = (devices = []) => ({ v: 1, devices });
/** A member's own slot carries the public key it was wrapped to, so a
 * granter can see when a member's identity has changed (a wiped browser);
 * `epoch` is the key this wrap opens and `older` the earlier epochs, each
 * wrapped the same way, so a new member reads the whole record. */
export const chatKeyContent = (wrapped, pub, { epoch = 0, older = [] } = {}) => ({ v: 1, epoch, pub, eph_pub: wrapped.eph_pub, blob: wrapped.blob, ...(older.length ? { older } : {}) });
export const chainContent = ({ head, idx, count, manifest, base, updated_at = new Date().toISOString() }) => ({ v: 1, head, idx, count, manifest, manifestBase: base, updated_at });

// ── sealed events: a prompt or an answer as one AES-GCM envelope, base64 ─────
export async function seal(chatKey, obj) { return b64(await encryptBytes(chatKey, encoder.encode(JSON.stringify(obj)))); }
export async function open(chatKey, envB64) { return JSON.parse(decoder.decode(await decryptBytes(chatKey, unb64(envB64)))); }
export const newJobId = () => b64url(randomBytes(12));
/**
 * What a member offers: the models a mouth on their machine SERVES, the ones
 * it could serve but is not (`available`), what the machine actually is
 * (`device` — measured, never assumed), and what it refused to take up and
 * why. `models: []` withdraws the offer. This is how a room coordinates which
 * model runs where: a member sees a machine has a model available, asks for
 * it (`wantContent`), and that machine takes it up or says why it cannot.
 */
export const mouthContent = ({ models = [], available = [], device = null, refused = [], home = null, since = Date.now() } = {}) => ({
  v: 1, models, since, home,
  ...(available.length ? { available } : {}),
  ...(device ? { device } : {}),
  ...(refused.length ? { refused } : {}),
});
/**
 * What a machine is, in the terms that decide whether it should run a model:
 * the runtime that will answer, the processor it runs on, how many cores and
 * how much memory it has, and whether a GPU is doing the work — `gpu: null`
 * where nothing has been measured yet, never a guess. A CPU-only machine is
 * a first-class mouth: it says so, and the picker's measured latency does the
 * rest.
 */
export const deviceContent = ({ runtime = null, os = null, arch = null, cores = null, memGB = null, gpu = null, note = null } = {}) => ({ runtime, os, arch, cores, memGB, gpu, ...(note ? { note } : {}) });
/** How a machine reads in one line, for a table or a picker row. */
export function deviceLine(device) {
  if (!device) return "device unknown";
  const bits = [device.runtime, device.gpu === true ? "GPU" : device.gpu === false ? "CPU only" : "CPU/GPU unmeasured", device.cores ? `${device.cores} cores` : null, device.memGB ? `${device.memGB} GB` : null, [device.os, device.arch].filter(Boolean).join(" ") || null, device.note].filter(Boolean);
  return bits.join(" · ");
}
/** One member asking machines to take up models: state_key is the asker. */
export const wantContent = (wants = []) => ({ v: 1, wants: wants.map((w) => ({ to: w.to, model: w.model, at: w.at ?? Date.now() })) });
/** The models `user` is being asked to take up that it is not serving yet. */
export function wantsFor(wantEvents, user, { serving = [] } = {}) {
  const out = new Map();
  for (const ev of wantEvents ?? []) for (const w of ev?.content?.wants ?? []) {
    if (w?.to !== user || !w?.model || serving.includes(w.model)) continue;
    const prior = out.get(w.model);
    if (!prior || (w.at ?? 0) > prior.at) out.set(w.model, { model: w.model, by: ev.state_key ?? null, at: w.at ?? 0 });
  }
  return [...out.values()];
}
/** A job event: addressed, sealed, sized. The model asked for sits inside the seal. */
export const jobContent = ({ to, id, env = null, mxc = null, sha256 = null, bytes = null }) => (env ? { v: 1, to, id, env, bytes: env.length } : { v: 1, to, id, mxc, sha256, bytes });
/** An answer event: the job it answers, sealed inline or by pointer. */
export const answerContent = ({ job, env = null, mxc = null, sha256 = null }) => (env ? { v: 1, job, env } : { v: 1, job, mxc, sha256 });
/**
 * Which offered mouth takes the next job: one that has the model asked for
 * (any, when none is asked), then the SHORTEST EXPECTED WAIT — how many jobs
 * this requester already has in flight there, times how long that machine's
 * answers have actually taken — earliest offer on a tie.
 *
 * Both numbers are measured, never assumed: `inflight` is what this requester
 * sent and has not seen answered, `meanMs` what it timed. A machine nobody
 * has timed yet is scored at the mean of those that have been (1 when none
 * have), so an unmeasured mouth is tried rather than starved or preferred.
 *
 * Counting jobs alone is not enough, and the drill of 2026-09-06 is why: two
 * machines, one serving a model six times slower, took three jobs each — and
 * the slow one's queue outlived the requester's patience while the fast one
 * sat idle. A worker answers one job at a time (one runtime, one GPU), so a
 * queue is real waiting.
 */
export function pickMouth(offers, { model = null, inflight = {}, meanMs = {} } = {}) {
  const able = offers.filter((o) => Array.isArray(o.models) && o.models.length && (!model || o.models.includes(model)));
  if (!able.length) return null;
  const timed = able.map((o) => meanMs[o.user]).filter((v) => Number.isFinite(v) && v > 0);
  const typical = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : 1;
  const wait = (o) => (inflight[o.user] ?? 0) * (Number.isFinite(meanMs[o.user]) && meanMs[o.user] > 0 ? meanMs[o.user] : typical);
  return able.slice().sort((a, b) => wait(a) - wait(b) || (a.since ?? 0) - (b.since ?? 0))[0];
}

// ── failover: a device that cannot run a model rolls its work to the room ──
/** The typed WebLLM failure kinds that mean "this machine cannot run the
 *  model" — a GPU the adapter refuses or lost, an engine gone silent, no
 *  storage, no network. NOT a generation that came back wrong: those stay
 *  the caller's to handle. app.js classifies its Ollama side into the same
 *  vocabulary (`machine` when the model was unreachable at all). */
export const ROOM_FALLBACK_KINDS = Object.freeze(["gpu", "device-lost", "stalled", "quota", "offline", "network"]);
/**
 * Which offered mouth takes a FAILED local call, or null when none should.
 * `kind` is the typed failure (null = any machine-shaped failure); a kind
 * outside ROOM_FALLBACK_KINDS never rolls over — a wrong answer is not a
 * missing machine. `exclude` drops one member (this device's own mouth:
 * rolling the work onto the very machine that just failed is a loop). The
 * pick is pickMouth's — shortest expected wait among the able.
 */
export function fallbackMouth(offers, { kind = null, exclude = null } = {}) {
  if (kind && !ROOM_FALLBACK_KINDS.includes(kind)) return null;
  const able = (offers ?? []).filter((o) => Array.isArray(o.models) && o.models.length && (!exclude || o.user !== exclude));
  return able.length ? pickMouth(able, { model: null }) : null;
}
/** The sync filter for one room's jobs channel: this room only, our events,
 * no presence, no account data, no receipts. */
export const syncFilter = (roomId, { stateTypes = [TYPES.mouth, TYPES.want] } = {}) => ({
  room: { rooms: [roomId], timeline: { types: [EVENTS.job, EVENTS.answer], limit: 50 }, state: { types: stateTypes }, ephemeral: { types: [] }, account_data: { types: [] } },
  presence: { types: [] }, account_data: { types: [] },
});

// ── invites bound to an account: a secret, a proof, a fingerprint ───────────
/** A bound link's secret: 128 random bits, one use, time-limited. */
export function generateInviteSecret() { return randomBytes(16); }
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
async function hmacKey(secret) { return subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); }
/** HMAC(secret, room · account · public key): published beside the member's
 * key by the account that redeemed the link. A granter with the secret wraps
 * only to a key whose proof verifies — so a homeserver that swapped the key
 * would have to know the secret, which never reached it. */
export async function inviteProof(secret, { room, user, pub }) {
  return b64(new Uint8Array(await subtle.sign("HMAC", await hmacKey(secret), encoder.encode(`fold-invite\n${room}\n${user}\n${pub}`))));
}
export async function verifyInviteProof(secret, fields, proof) {
  const want = unb64(await inviteProof(secret, fields)); let got; try { got = unb64(String(proof ?? "")); } catch { return false; }
  if (got.length !== want.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i];
  return diff === 0;
}
/** Sixteen hex digits of SHA-256 over the public key, in four groups — read
 * aloud to compare a key out of band before trusting an unverified request. */
export async function fingerprint(pubB64) {
  const d = new Uint8Array(await subtle.digest("SHA-256", unb64(pubB64)));
  return hex(d.subarray(0, 8)).replace(/(.{4})(?=.)/g, "$1-");
}
/** A key from a passphrase: PBKDF2-SHA256, 600,000 rounds (eopm's figure), a
 * fresh 16-byte salt per use. For passphrase links and the local vault. */
export const KDF_ROUNDS = 600_000;
export const generateSalt = () => randomBytes(16);
export async function keyFromPassphrase(passphrase, salt, rounds = KDF_ROUNDS) {
  if (!passphrase) throw new Error("a passphrase");
  const material = await subtle.importKey("raw", encoder.encode(String(passphrase).normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, material, 256));
}
/** The local vault: everything FoldMatrix keeps at rest, sealed under a
 * passphrase-derived key. `{ v, salt, rounds, blob }` is all storage holds. */
export async function sealVault(passphrase, obj) {
  const salt = generateSalt(); const key = await keyFromPassphrase(passphrase, salt);
  return { vault: { v: 1, salt: b64(salt), rounds: KDF_ROUNDS, blob: b64(await encryptBytes(key, encoder.encode(JSON.stringify(obj)))) }, key };
}
export async function openVault(passphrase, vault) {
  const key = await keyFromPassphrase(passphrase, unb64(vault.salt), vault.rounds ?? KDF_ROUNDS);
  let plain; try { plain = await decryptBytes(key, unb64(vault.blob)); } catch { throw new Error("the passphrase does not open this vault"); }
  return { data: JSON.parse(decoder.decode(plain)), key };
}

// ── the share link: what rides in the fragment, which never leaves the browser
/**
 * Three kinds of link, one shape. `open`: the chat key itself rides in the
 * fragment — a magic key; whoever holds the link reads the room. `bound`: no
 * key; a one-shot secret and the account it is for, redeemed by signing in
 * as that account and publishing a key with the secret's proof, granted by a
 * member who holds the secret. `passphrase`: the key sealed under a
 * passphrase said aloud; neither the link nor the words alone opens it.
 */
export function buildShareLink(pageHref, { hs, room, name = null, key = null, to = null, secret = null, exp = null, wrapped = null, salt = null }) {
  const payload = { v: 2, hs, r: room, n: name };
  if (to && secret) { if (!/^@[^:]+:.+$/.test(to)) throw new Error("a bound link names a Matrix id"); Object.assign(payload, { to, s: b64url(secret), exp: exp ?? Date.now() + INVITE_TTL_MS }); }
  else if (wrapped && salt) Object.assign(payload, { c: b64url(wrapped), salt: b64url(salt) });
  else { if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) throw new Error("an open link carries the 32-byte chat key"); payload.k = b64url(key); }
  const u = new URL(pageHref);
  const kept = u.hash.replace(/^#/, "").replace(/(?:^|&)fold-share=[A-Za-z0-9_-]+/, "").replace(/^&/, "");
  u.hash = `${kept ? `${kept}&` : ""}fold-share=${b64url(encoder.encode(JSON.stringify(payload)))}`;
  return u.href;
}
/** Parsed: `{ kind, hs, room, name, key | to+secret+exp | wrapped+salt }`; v1 links read as open. */
export function parseShareLink(href) {
  let u; try { u = new URL(href); } catch { return null; }
  const m = /(?:^|[#&])fold-share=([A-Za-z0-9_-]+)/.exec(u.hash);
  if (!m) return null;
  try {
    const p = JSON.parse(decoder.decode(unb64url(m[1])));
    if (![1, 2].includes(p?.v) || typeof p.hs !== "string" || !/^![^:]+:.+$/.test(p.r ?? "")) return null;
    const base = { hs: p.hs, room: p.r, name: typeof p.n === "string" ? p.n : null };
    if (typeof p.to === "string" && typeof p.s === "string") { const secret = unb64url(p.s); if (secret.length !== 16 || !/^@[^:]+:.+$/.test(p.to)) return null; return { kind: "bound", ...base, to: p.to, secret, exp: Number(p.exp) || null }; }
    if (typeof p.c === "string" && typeof p.salt === "string") { const wrapped = unb64url(p.c), salt = unb64url(p.salt); if (wrapped.length !== 12 + KEY_BYTES + 16 || salt.length !== 16) return null; return { kind: "passphrase", ...base, wrapped, salt }; }
    const key = unb64url(p.k ?? "");
    if (key.length !== KEY_BYTES) return null;
    return { kind: "open", ...base, key };
  } catch { return null; }
}
export function stripShareFragment(href) {
  const u = new URL(href);
  const kept = u.hash.replace(/^#/, "").replace(/(?:^|&)fold-share=[A-Za-z0-9_-]+/, "").replace(/^&/, "");
  u.hash = kept;
  return u.href;
}

// ── the instrument that proves it: every form a secret could take ──────────
/**
 * A set of secrets in every encoding a leak could wear — raw, base64,
 * base64url, hex, JSON-escaped, percent-encoded — and `leaks(haystack)`, over
 * text or bytes. The app registers its password (for the login turn only),
 * its access token, every chat key and private key, and refuses to write a
 * record line that leaks; the tests run the SAME instrument over everything
 * an adversarial homeserver received. One instrument, both sides.
 */
export class SecretSet {
  constructor() { this.forms = []; }
  add(kind, secret) {
    const s = typeof secret === "string" ? secret : null;
    const bytes = secret instanceof Uint8Array ? secret : encoder.encode(secret);
    const texts = new Set();
    if (s !== null) { texts.add(s); texts.add(JSON.stringify(s).slice(1, -1)); texts.add(encodeURIComponent(s)); texts.add(b64(encoder.encode(s))); texts.add(b64url(encoder.encode(s))); texts.add(hex(encoder.encode(s))); }
    else { texts.add(b64(bytes)); texts.add(b64url(bytes)); texts.add(hex(bytes)); }
    for (const t of texts) if (t.length >= 6) this.forms.push({ kind, form: t, bytes: encoder.encode(t) });
    if (s === null) this.forms.push({ kind, form: "<raw bytes>", bytes });
    return this;
  }
  /** Where a secret appears, if anywhere: [{kind, form}]. */
  leaks(haystack) {
    const hits = [];
    if (typeof haystack === "string") { for (const f of this.forms) if (f.form !== "<raw bytes>" && haystack.includes(f.form)) hits.push({ kind: f.kind, form: f.form.slice(0, 12) + "…" }); }
    else if (haystack instanceof Uint8Array) { for (const f of this.forms) if (bytesIndexOf(haystack, f.bytes) >= 0) hits.push({ kind: f.kind, form: f.form.slice(0, 12) + "…" }); }
    return hits;
  }
}
export function bytesIndexOf(h, n) {
  if (!n.length || n.length > h.length) return -1;
  outer: for (let i = 0; i <= h.length - n.length; i++) { for (let j = 0; j < n.length; j++) if (h[i + j] !== n[j]) continue outer; return i; }
  return -1;
}
/** Shannon entropy of a byte string, bits per byte (8 = indistinguishable
 * from random at this length; JSON prose sits far below). The tests measure
 * the band random bytes of the same length occupy and place ciphertext and
 * plaintext against it — a null measured, not a figure chosen. */
export function byteEntropy(bytes) {
  if (!bytes.length) return 0;
  const counts = new Uint32Array(256); for (const b of bytes) counts[b]++;
  let h = 0; for (const c of counts) if (c) { const p = c / bytes.length; h -= p * Math.log2(p); }
  return h;
}
/** What the record may hold about a Matrix act: pointer-shaped fields only.
 * A field whose NAME says secret is dropped and reported; a VALUE that leaks
 * a registered secret refuses the whole line — nothing is written. */
export function forRecord(fields, secrets) {
  const out = {}; const dropped = [];
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (/key|token|password|secret|blob|eph_pub|priv/i.test(k)) { dropped.push(k); continue; }
    const text = typeof v === "string" ? v : JSON.stringify(v);
    const hits = secrets ? secrets.leaks(text ?? "") : [];
    if (hits.length) throw new Error(`refusing to record ${k}: it carries the ${hits[0].kind}`);
    out[k] = v;
  }
  return { fields: out, dropped };
}
/** The plain-language account of what the homeserver can and cannot see. */
export const SERVER_SEES = Object.freeze([
  "who is in the room (Matrix ids), who invited whom, and the room's name",
  "how many blocks went up, how big each one is, and when",
  "each member's public key, and the chat key wrapped so only that member's private key opens it",
  "which member offers a mouth and which model names; that a sealed job went to whom, its size, and when its sealed answer came back",
  "never: a turn, a prompt, an answer, a source — those exist only inside the seals, and the key that opens a seal is in no event",
]);
/** The plain words for an open link, said at the door every time. */
export const MAGIC_KEY_WARNING = "this link is a magic key: whoever holds it reads this whole chat, past and future, and it cannot be taken back — send it only over a channel you would trust with the chat itself, and prefer /share @who:server, which works for that account alone";

/**
 * Render a loaded room's conversation to plain lines — the ONE renderer every
 * surface uses (the TUI, the browser page, the proxy route), so a reader sees
 * the identical text everywhere. NOTHING is hidden: every entry of every kind
 * and both roles prints in order; every gap (a block the reader holds no key
 * for, a hash mismatch, an unlinked chain) prints as an explicit line, never a
 * silently shorter conversation. Pure: entries and gaps arrive already decoded
 * (FoldMatrix.load), so this runs in a browser or Node.
 */
export function renderConversation({ room, entries = [], blocks = 0, chains = 0, partial = false, gaps = [], session = null } = {}) {
  const out = [];
  const who = session ? `${session.user_id} on ${session.hs}` : "this session";
  out.push(who);
  out.push(`room ${room} · ${chains} chain(s) · ${blocks} block(s) · ${entries.length} entr${entries.length === 1 ? "y" : "ies"}${partial ? " · PARTIAL — gaps below" : ""}`);
  out.push("");
  if (entries.length) {
    out.push("ENTRIES (every kind, both roles, in order):");
    for (const e of entries) {
      const ts = new Date(e.ts ?? 0).toISOString();
      const id = e.id ?? "";
      out.push(`  [${e.seq ?? "?"}] ${ts}  kind=${e.kind ?? "turn"}  role=${e.role ?? ""}  id=${id}`);
      for (const line of String(e.content ?? e.text ?? "").split("\n")) out.push(`      ${line}`);
      out.push("");
    }
  } else {
    out.push("(no entries recorded yet)");
    out.push("");
  }
  if (partial && gaps.length) {
    out.push(`GAPS (${gaps.length} — the conversation holds more than this read could open, named here, never hidden):`);
    for (const g of gaps) out.push(`  - ${g}`);
    out.push("");
  }
  out.push(`— end (${entries.length} entries, ${gaps.length} gap${gaps.length === 1 ? "" : "s"})`);
  return out.join("\n");
}
