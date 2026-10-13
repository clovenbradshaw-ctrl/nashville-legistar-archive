// holodeck-roles.js — owner / editor / reader, and the gate in front of the fold.
//
// Membership is the access model; roles map onto Matrix power levels so the
// homeserver enforces them too. But the fold does not trust the server's power
// levels (an old event, a demotion, a misbehaving server, an event injected
// straight into the log): `gate()` re-derives each person's role from the
// owner-authored role ledger and refuses any stored operator written by someone
// who was not an editor at that event's timestamp. The vendored fold is
// permissive by design ("violations are flagged, never blocked"), so
// `foldRepo()` — gate, then fold — is the only path to state.
//
// PURE: no I/O. The ledger is read from events the caller passes in.

export const ROLE = Object.freeze({ owner: 'owner', editor: 'editor', reader: 'reader' });
export const POWER = Object.freeze({ owner: 100, editor: 50, reader: 0 });
export const ROLE_WORDS = Object.freeze({
  owner: 'Owner — can invite, remove, and change roles',
  editor: 'Editor — can add and change sources, statements and ties',
  reader: 'Reader — can read; cannot change anything',
});

// The stored operators (NUL and SIG are ephemeral and never reach a log).
export const WRITE_OPS = Object.freeze(['ins', 'seg', 'con', 'syn', 'def', 'eva', 'rec']);
export const NS_DEFAULT = 'io.holodeck';
export const LEDGER = Object.freeze({
  role: 'io.holodeck.share.role',
  revoke: 'io.holodeck.share.revoke',
  device: 'io.holodeck.share.device',
});

export const GATE = Object.freeze({
  ReaderCannotWrite: 'reader-cannot-write',
  NotAMember: 'not-a-member',
  Revoked: 'revoked',
  ReservedAnchor: 'reserved-anchor',
  ForgedLedger: 'forged-ledger-entry',
});

export const roleOfPower = (n) => (n >= POWER.owner ? ROLE.owner : n >= POWER.editor ? ROLE.editor : ROLE.reader);

/**
 * The m.room.power_levels content for a store room. Reading is by membership;
 * sending needs editor. The things that would let someone change the rules
 * (encryption, join rules, visibility, power levels, invites, kicks) are
 * owner-only — in particular nobody but the owner can turn encryption off.
 */
export function powerLevelsFor({ owner, users = {} }) {
  const us = { [owner]: POWER.owner };
  for (const [u, role] of Object.entries(users)) {
    if (u === owner) continue;
    const p = POWER[role];
    if (p > POWER.reader) us[u] = p;
  }
  return {
    users: us,
    users_default: POWER.reader,
    events_default: POWER.editor,
    state_default: POWER.owner,
    invite: POWER.owner,
    kick: POWER.owner,
    ban: POWER.owner,
    redact: POWER.owner,
    events: {
      'm.room.encryption': POWER.owner,
      'm.room.power_levels': POWER.owner,
      'm.room.join_rules': POWER.owner,
      'm.room.history_visibility': POWER.owner,
      'm.room.name': POWER.owner,
      'm.room.canonical_alias': POWER.owner,
    },
  };
}

/**
 * Build the role history from ledger events. Only events whose sender IS the
 * owner count — the owner is read from the log room's m.room.create by the
 * caller, never from content. Anything else is returned in `refused`, typed.
 *   events: [{ type, content, sender, origin_server_ts, event_id }]
 * returns { entries: [{ user, role|null, from, to? }], intervals, refused }
 */
export function ledgerFromEvents(events, { owner }) {
  const refused = [];
  const accepted = [];
  for (const e of events || []) {
    if (!e || (e.type !== LEDGER.role && e.type !== LEDGER.revoke)) continue;
    if (e.sender !== owner) {
      refused.push({ event: e, code: GATE.ForgedLedger, why: `${e.sender} is not the owner, so its ${e.type === LEDGER.role ? 'role grant' : 'removal'} is ignored` });
      continue;
    }
    const c = e.content || {};
    if (typeof c.user !== 'string') continue;
    accepted.push(e);
  }
  accepted.sort((a, b) => (a.origin_server_ts || 0) - (b.origin_server_ts || 0) || String(a.event_id).localeCompare(String(b.event_id)));
  const byUser = new Map();
  for (const e of accepted) {
    const u = e.content.user;
    const list = byUser.get(u) || byUser.set(u, []).get(u);
    list.push(e.type === LEDGER.role
      ? { role: ROLE[e.content.role] || null, from: e.origin_server_ts || 0 }
      : { role: null, from: e.origin_server_ts || 0, revoked: true });
  }
  return { owner, byUser, refused };
}

/**
 * Which devices the OWNER has confirmed, from the owner-authored ledger. This is what
 * makes "keys only to confirmed devices" work for a repo with more than two people:
 * trust is per client in Matrix, so each client reads the owner's confirmations and
 * applies them locally. A removed person's devices are withdrawn.
 *   returns { trusted: [{user, deviceId, ed25519}], withdrawn: [{user, deviceId}] }
 */
export function trustedDevices(events, { owner }) {
  const list = (events || [])
    .filter((e) => e && e.sender === owner && (e.type === LEDGER.role || e.type === LEDGER.device || e.type === LEDGER.revoke))
    .slice()
    .sort((a, b) => (a.origin_server_ts || 0) - (b.origin_server_ts || 0) || String(a.event_id).localeCompare(String(b.event_id)));
  const state = new Map();   // user -> { revoked, devices: Map(deviceId -> ed25519) }
  for (const e of list) {
    const c = e.content || {};
    if (typeof c.user !== 'string') continue;
    const u = state.get(c.user) || state.set(c.user, { revoked: false, devices: new Map(), seen: new Set() }).get(c.user);
    if (e.type === LEDGER.revoke) { u.revoked = true; continue; }
    if (e.type === LEDGER.role) u.revoked = false;
    const d = c.device;
    if (d && typeof d.deviceId === 'string' && typeof d.ed25519 === 'string') { u.devices.set(d.deviceId, d.ed25519); u.seen.add(d.deviceId); }
  }
  const trusted = [], withdrawn = [];
  for (const [user, u] of state) {
    for (const id of u.seen) {
      if (u.revoked) withdrawn.push({ user, deviceId: id });
      else trusted.push({ user, deviceId: id, ed25519: u.devices.get(id) });
    }
  }
  return { trusted, withdrawn };
}

/** The person's role at a moment: owner is always owner; otherwise the latest ledger entry at or before `ts`. */
export function roleAt(ledger, user, ts) {
  if (user === ledger.owner) return ROLE.owner;
  const list = ledger.byUser.get(user);
  if (!list) return null;
  let cur = null;
  for (const seg of list) { if (seg.from <= ts) cur = seg; else break; }
  return cur ? cur.role : null;
}

/** Why a person has no write role at ts — the typed reason a refusal carries. */
function whyNot(ledger, user, ts) {
  const list = ledger.byUser.get(user);
  if (!list) return { code: GATE.NotAMember, why: `${user} was never given a role in this repo` };
  let cur = null;
  for (const seg of list) { if (seg.from <= ts) cur = seg; else break; }
  if (!cur) return { code: GATE.NotAMember, why: `${user} had no role yet when this was written` };
  if (cur.revoked) return { code: GATE.Revoked, why: `${user} had been removed when this was written` };
  return { code: GATE.ReaderCannotWrite, why: `${user} was a reader when this was written, and readers cannot change anything` };
}

const typeOf = (e) => (typeof e.getType === 'function' ? e.getType() : e.type);
const contentOf = (e) => (typeof e.getContent === 'function' ? e.getContent() : e.content) || {};
const senderOf = (e) => (typeof e.getSender === 'function' ? e.getSender() : e.sender);
const tsOf = (e) => (typeof e.getTs === 'function' ? e.getTs() : e.origin_server_ts) || 0;

const RESERVED = /^(_roles|_share|_schema_owner)(\b|[:.\/])/;
const touchesReserved = (c) => [c.anchor, c.path, c.source_anchor, c.target_anchor, c.entity_type].some((v) => typeof v === 'string' && RESERVED.test(v));

/**
 * Split events into the ones the fold may see and the ones it may not.
 * Non-operator events and undecryptable ones pass (the fold counts the latter);
 * a stored operator passes only from an editor or the owner.
 */
export function gate(events, ledger, { ns = NS_DEFAULT } = {}) {
  const accepted = [];
  const refused = [];
  const ops = new Set(WRITE_OPS.map((o) => `${ns}.${o}`));
  for (const e of events || []) {
    const type = typeOf(e);
    if (!ops.has(type)) { accepted.push(e); continue; }
    const sender = senderOf(e), ts = tsOf(e);
    const role = roleAt(ledger, sender, ts);
    if (role !== ROLE.owner && role !== ROLE.editor) {
      refused.push({ event: e, ...whyNot(ledger, sender, ts) });
      continue;
    }
    if (role !== ROLE.owner && touchesReserved(contentOf(e))) {
      refused.push({ event: e, code: GATE.ReservedAnchor, why: `${sender} may not write to the repo’s own bookkeeping` });
      continue;
    }
    accepted.push(e);
  }
  return { accepted, refused };
}

/**
 * The only path from a repo's events to state: ledger → gate → fold.
 * `fold` is injected (the vendored bare-metal fold in the page, the same file in tests).
 */
export function foldRepo({ dataEvents, ledgerEvents, owner, fold, ns = NS_DEFAULT }) {
  const ledger = ledgerFromEvents(ledgerEvents, { owner });
  const g = gate(dataEvents, ledger, { ns });
  const state = fold(g.accepted);
  return { state, ledger, refused: g.refused.concat(ledger.refused), accepted: g.accepted.length };
}

/** Same path, with an async step between the gate and the fold (resolving attachment references for accepted events only). */
export async function foldRepoAsync({ dataEvents, ledgerEvents, owner, fold, ns = NS_DEFAULT, transform = null }) {
  const ledger = ledgerFromEvents(ledgerEvents, { owner });
  const g = gate(dataEvents, ledger, { ns });
  const events = transform ? await transform(g.accepted) : g.accepted;
  const state = fold(events);
  return { state, ledger, refused: g.refused.concat(ledger.refused), accepted: g.accepted.length };
}

/**
 * Defence in depth: after a fold, every entity's recorded sender must have been
 * able to write. A non-empty result means something reached `fold` without the gate.
 */
export function auditState(state, ledger) {
  const bad = [];
  const canWrite = (r) => r === ROLE.owner || r === ROLE.editor;
  for (const [anchor, ent] of Object.entries((state && state.entities) || {})) {
    if (!ent) continue;
    if (ent._sender) {
      const role = roleAt(ledger, ent._sender, ent._created || 0);
      if (!canWrite(role)) bad.push({ anchor, sender: ent._sender, role, wrote: 'created' });
    }
    if (ent._updatedBy) {
      const role = roleAt(ledger, ent._updatedBy, ent._updated || 0);
      if (!canWrite(role)) bad.push({ anchor, sender: ent._updatedBy, role, wrote: 'changed' });
    }
  }
  return bad;
}
