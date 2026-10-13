// holodeck-seal.js — encryption is asserted, not hoped for.
//
// A repo's data stores live in Matrix rooms that must be Megolm-encrypted. This
// module is the only door a write goes through: a send to a room that is not a
// known store room, whose state does not carry m.room.encryption with the Megolm
// algorithm, or whose crypto layer has not confirmed encryption, is REFUSED with
// a typed SealRefusal — not warned about, not queued, not downgraded.
//
// Matrix state events are never end-to-end encrypted. So the seal also refuses a
// content-bearing state write: the legacy private room kept pins and drafts in a
// state event, in the clear on the server, behind a UI that said "only people you
// invite can see it".
//
// PURE: every crossing is the injected `mx` (see holodeck-share.js for the shape).
// Nothing here fetches, stores or logs a secret.

export const MEGOLM = 'm.megolm.v1.aes-sha2';

export const REFUSAL = Object.freeze({
  RoomNotEncrypted: 'room-not-encrypted',
  NotConfirmed: 'encryption-not-confirmed',
  UnknownRoom: 'unknown-room',
  ContentInState: 'content-in-state',
  AlgorithmNotAllowed: 'algorithm-not-allowed',
  EventTypeNotAllowed: 'event-type-not-allowed',
  PlaintextAttachment: 'plaintext-attachment',
});

export class SealRefusal extends Error {
  constructor(code, why, detail = {}) {
    super(`${code}: ${why}`);
    this.name = 'SealRefusal';
    this.refusal = true;
    this.code = code;
    this.why = why;
    this.detail = detail;
  }
}

// State types a store room may carry. Everything here describes the room's own
// shape (who may do what, that it is encrypted) — never what is in it. A person's
// words, a source's text, a name: none of it is allowed in state.
export const STRUCTURAL_STATE = Object.freeze([
  'm.room.encryption',
  'm.room.power_levels',
  'm.room.join_rules',
  'm.room.history_visibility',
  'm.room.guest_access',
  'm.room.name',
  'm.room.canonical_alias',
]);

// Our own structural marker: which repo and store a room is, and nothing else.
export const REPO_MARKER = 'io.holodeck.repo.store';
const MARKER_KEYS = new Set(['v', 'repo', 'store', 'epoch']);

const isEmpty = (c) => c && typeof c === 'object' && Object.keys(c).length === 0;

/** Is this a state write that carries no content? An empty object is a blank, not content. */
export function structuralStateOk(type, content) {
  if (isEmpty(content)) return true;
  if (STRUCTURAL_STATE.includes(type)) return true;
  if (type === REPO_MARKER) {
    return !!content && typeof content === 'object' && Object.keys(content).every((k) => MARKER_KEYS.has(k));
  }
  return false;
}

/**
 * Assert a store room is encrypted — by its state AND by the crypto layer.
 * `known` is a function returning the set/array of room ids that are this
 * repo's store rooms (a send to anything else is refused as unknown).
 * Returns { ok: true, algorithm } or throws SealRefusal.
 */
export async function assertEncrypted(mx, roomId, { known } = {}) {
  const ids = known ? known() : null;
  if (ids && !(ids instanceof Set ? ids.has(roomId) : ids.includes(roomId))) {
    throw new SealRefusal(REFUSAL.UnknownRoom, 'that room is not one of this repo’s stores, so nothing is written to it', { roomId });
  }
  const st = await mx.roomState(roomId);
  const enc = st && st.encryption;
  if (!enc) {
    throw new SealRefusal(REFUSAL.RoomNotEncrypted, 'the room has no encryption in its state, so anything sent would be readable by the server', { roomId });
  }
  if (enc.algorithm !== MEGOLM) {
    throw new SealRefusal(REFUSAL.AlgorithmNotAllowed, `the room’s encryption algorithm is ${String(enc.algorithm)}, not ${MEGOLM}`, { roomId, algorithm: enc.algorithm });
  }
  if (!(await mx.isEncryptionReady(roomId))) {
    throw new SealRefusal(REFUSAL.NotConfirmed, 'the encryption layer has not confirmed this room yet (a new room can be briefly unconfirmed); nothing is sent until it does', { roomId });
  }
  return { ok: true, algorithm: enc.algorithm };
}

/**
 * Wrap a Matrix crossing so a write cannot skip the assertion. The returned
 * object has every method of `mx`, except:
 *   sendEvent  — assertEncrypted, then send (the SDK encrypts on the wire)
 *   setState   — structural content only (ContentInState otherwise)
 *   upload     — absent: bytes go through sealAttachment, never raw
 * `onRefuse(refusal)` is told about each refusal (the panel shows it; tests count).
 */
export function sealTransport(mx, { known, onRefuse, ns = 'io.holodeck' } = {}) {
  const refuse = (r) => { try { onRefuse && onRefuse(r); } catch { /* a listener never changes the verdict */ } throw r; };
  const sealed = Object.create(null);
  for (const k of Object.keys(mx)) if (k !== 'upload') sealed[k] = mx[k];
  sealed.sendEvent = async (roomId, type, content) => {
    try {
      if (typeof type !== 'string' || !type.startsWith(ns + '.')) {
        throw new SealRefusal(REFUSAL.EventTypeNotAllowed, `only ${ns}.* events are written to a store room, not ${String(type)}`, { roomId, type });
      }
      await assertEncrypted(mx, roomId, { known });
    } catch (e) { if (e && e.refusal) refuse(e); throw e; }
    return mx.sendEvent(roomId, type, content);
  };
  sealed.setState = async (roomId, type, key, content) => {
    if (!structuralStateOk(type, content)) {
      refuse(new SealRefusal(REFUSAL.ContentInState, `${type} is a state event, and state events are never encrypted — the server would read this; write it as a sealed event instead`, { roomId, type }));
    }
    return mx.setState(roomId, type, key, content);
  };
  sealed.known = known;
  return sealed;
}

/**
 * Encrypt a body and upload only ciphertext. `attach.encrypt(bytes)` is eodb's
 * attachment envelope (AES-CTR, a fresh key per blob; the key travels only inside
 * the Megolm-encrypted event). Returns the `__media: 2` reference to embed.
 */
export async function sealAttachment({ mx, attach }, bytes, { mime = 'application/octet-stream', name = 'file' } = {}) {
  if (!attach || typeof attach.encrypt !== 'function') {
    throw new SealRefusal(REFUSAL.PlaintextAttachment, 'no attachment encryption is available, so the body is not uploaded', {});
  }
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { data, info } = await attach.encrypt(u8);
  const mxc = await mx.upload(data, { type: 'application/octet-stream', name: 'blob' });
  if (!mxc) throw new SealRefusal(REFUSAL.PlaintextAttachment, 'the upload returned no address', {});
  return { __media: 2, mxc, mime, size: u8.length, name, file: info };
}

/** Plain-language line for a refusal (the panel and the log use this, never the code alone). */
export function refusalWords(r) {
  if (!r || !r.refusal) return String((r && r.message) || r);
  return r.why;
}
