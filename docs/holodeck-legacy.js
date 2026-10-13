// holodeck-legacy.js — find the unencrypted workspaces, and plan (never perform
// silently) the move into encrypted stores.
//
// What exists today (fold-net.js): a workspace has a `priv` room created with the
// private_chat preset — NOT encrypted — whose "private work" (pins, filters,
// drafts, reading history) is written with `savePrivate` as a STATE event. Matrix
// never encrypts state events, so that snapshot is readable by the homeserver
// whatever the room's encryption setting. And a `pub` room that is public by
// design (hash-chained source custody).
//
// This module reports; it moves nothing. The migration is three separate acts,
// each needing the operator's explicit confirmation, each reversible up to the
// last, and each saying in plain words what it cannot undo.
//
// PURE: `mx` and `backup` are injected. `backup` = { put(key, text), get(key), del(key) }.

import { sha256Hex } from './holodeck-heimdall.js';
import { SealRefusal, REFUSAL } from './holodeck-seal.js';

export const LEGACY = Object.freeze({
  private: 'social.hyphae.fold.private',   // fold-net.js PRIV — a state event holding user data
  config: 'social.hyphae.fold.config',     // fold-net.js CONFIG — watches (search queries), also state
  block: 'social.hyphae.fold.block',       // fold-net.js BLOCK — public hash-chained custody
  key: 'work',
});
export const IMPORT_EVENT = 'io.holodeck.share.import';

export const MIGRATION_WORDS = Object.freeze({
  seen: 'The server has already been able to read the old plaintext copy, and it keeps room history. Nothing below can unsee that.',
  copy: 'Copies this workspace’s private work into the encrypted stores and checks the copy reads back identically. The old copy stays where it is.',
  blank: 'Blanks the old plaintext copy so the room no longer shows it. The server’s earlier history of that room is not touched. A local backup is kept so this can be undone.',
  rollback: 'Puts the old plaintext copy back from the local backup. This makes the content readable by the server again.',
  public: 'This room is public by design: anything in it is readable by anyone. It is a publication, not a private store, and is not changed.',
});

const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
export const hashContent = (v) => sha256Hex(canon(v));

/**
 * Report on the workspace's existing rooms. Reads state types and encryption only.
 *   rooms: { priv, pub } (room ids from the page's wsRooms())
 */
export async function detectLegacy({ mx, rooms }) {
  const out = [];
  for (const [role, roomId] of Object.entries(rooms || {})) {
    if (!roomId) continue;
    let st = null, types = [], gap = null;
    try { st = await mx.roomState(roomId); types = await mx.stateTypes(roomId); }
    catch (e) { gap = { kind: 'unreadable', why: 'this account cannot read that room’s state (' + String((e && e.message) || e) + ')' }; }
    const encrypted = !!(st && st.encryption);
    const contentTypes = types.filter((t) => t === LEGACY.private || t === LEGACY.config);
    const publicByDesign = role === 'pub';
    const findings = [];
    if (gap) findings.push(gap.why);
    else if (publicByDesign) findings.push(MIGRATION_WORDS.public);
    else {
      if (!encrypted) findings.push('This room is not encrypted: everything sent to it is readable by the server.');
      if (contentTypes.length) findings.push(`It keeps ${contentTypes.length === 1 ? 'a record' : contentTypes.length + ' records'} of your work in state events (${contentTypes.join(', ')}), which Matrix never encrypts — the server reads them even if the room were encrypted.`);
      if (encrypted && !contentTypes.length) findings.push('This room is encrypted and holds no content in state.');
    }
    out.push({
      room: roomId, role, encrypted, publicByDesign, contentTypes, gap, findings,
      needsAttention: !gap && !publicByDesign && (!encrypted || contentTypes.length > 0),
    });
  }
  return out;
}

/** The plan: three acts, in order. Pure; performs nothing. */
export function planMigration(report) {
  const targets = report.filter((r) => r.needsAttention && r.contentTypes.includes(LEGACY.private));
  return targets.map((r) => ({
    room: r.room,
    steps: [
      { id: 'copy', needs: 'confirm', words: MIGRATION_WORDS.copy, reversible: true },
      { id: 'blank', needs: 'confirm', after: 'copy', words: MIGRATION_WORDS.blank, reversible: true },
      { id: 'rollback', needs: 'confirm', after: 'blank', words: MIGRATION_WORDS.rollback, reversible: false },
    ],
    cannotUndo: MIGRATION_WORDS.seen,
  }));
}

const needConfirm = (confirmed, what) => {
  if (confirmed !== true) throw new SealRefusal(REFUSAL.NotConfirmed, `${what} needs your explicit confirmation; nothing was changed`, { step: what });
};

/** Act 1 — copy into the encrypted stores and read it back. Writes nothing to the old room. */
export async function copyToEncrypted({ mx, share, repo, room, backup, confirmed }) {
  needConfirm(confirmed, 'copying private work');
  const data = await mx.getState(room, LEGACY.private, LEGACY.key);
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return { copied: false, verified: false, why: 'there is nothing saved in that room to copy' };
  }
  const hash = await hashContent(data);
  await backup.put(`legacy:${room}`, JSON.stringify(data));           // the way back, before anything else
  const id = await share.sealed.sendEvent(repo.rooms.records, IMPORT_EVENT, { v: 1, from: { room, type: LEGACY.private, key: LEGACY.key }, hash, data });
  const back = (await mx.readEvents(repo.rooms.records)).find((e) => e.event_id === id && e.decrypted);
  const verified = !!back && (await hashContent(back.content.data)) === hash;
  return { copied: true, verified, hash, event: id };
}

/** Act 2 — blank the plaintext. Only after a verified copy, only when confirmed. */
export async function blankLegacy({ mx, share, room, copy, confirmed }) {
  needConfirm(confirmed, 'blanking the old plaintext copy');
  if (!copy || copy.verified !== true) {
    throw new SealRefusal('copy-not-verified', 'the old copy is only blanked after the encrypted copy has been read back and matched', { room });
  }
  await share.sealed.setState(room, LEGACY.private, LEGACY.key, {});   // an empty blank is not content
  return { blanked: true, words: MIGRATION_WORDS.seen };
}

/** Act 3 — put the plaintext back. Deliberately outside the seal: restoring plaintext is the point. */
export async function rollbackLegacy({ mx, room, backup, confirmed }) {
  needConfirm(confirmed, 'restoring the old plaintext copy');
  const text = await backup.get(`legacy:${room}`);
  if (!text) throw new SealRefusal('no-backup', 'there is no local backup to restore from', { room });
  await mx.setState(room, LEGACY.private, LEGACY.key, JSON.parse(text));
  return { restored: true, words: MIGRATION_WORDS.rollback };
}
