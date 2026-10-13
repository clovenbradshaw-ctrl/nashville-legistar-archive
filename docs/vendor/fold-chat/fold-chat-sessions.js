// fold-chat-sessions.js — the session-lifecycle rules of the chat, PURE.
//
// No DOM, no storage, no clock of its own (callers pass `now`): everything here
// takes the sessions map (id -> session) and returns what to do. fold-chat.js
// owns the surface; this file owns the decisions, so they can be tested in node.
//
//   composerLocked   is the composer locked for the OPEN chat? (per chat, never global)
//   nextAfterDelete  which chat to open once one is deleted
//   newChatInto      "new chat" REUSES an empty chat instead of piling up empties
//   pruneStaleEmpties  drop never-used "New chat" husks
//   detachProject    ungroup a deleted project's chats, clearing only an inherited cwd
//   mergeSessions    reconcile two copies of the map (two tabs), honouring tombstones
//   mergeTombstones / pruneTombstones   the deleted-ids ledger (id -> deletedAt)

const stamp = (x) => { const t = Date.parse(x); return Number.isFinite(t) ? t : 0; };
const recency = (s) => stamp(s?.updated || s?.createdAt);

/** The composer is locked only while the OPEN chat has a turn in flight. A turn
 *  running in another chat never locks this one; no open chat (the welcome
 *  state) is never locked. `inflight` is a Map/Set of chat ids (or a plain object). */
export function composerLocked(inflight, activeId) {
  if (!activeId || !inflight) return false;
  if (typeof inflight.has === "function") return !!inflight.has(activeId);
  return !!inflight[activeId];
}

/** Newest first. */
export function byRecent(list) { return [...list].sort((a, b) => recency(b) - recency(a)); }

/** A chat nothing has happened in: no messages, no agent session. */
export function isBlankChat(s) {
  return !!s && !(s.messages || []).length && !s.codeSessionId;
}

/** A blank chat that is also anonymous: still called "New chat" (never named or
 *  renamed), in no project, with no folder of its own. Only these are pruned. */
export function isStaleEmpty(s) {
  if (!isBlankChat(s)) return false;
  if (s.titleAuto === false || s.named) return false;
  if (s.title && s.title !== "New chat") return false;
  if (s.project || s.cwd) return false;
  return true;
}

/** Which chat to open after `id` is deleted.
 *   - the pool is every OTHER chat in the current project filter; `search` is
 *     IGNORED for choosing (a hidden chat can still be the right next chat);
 *   - a non-empty chat is preferred over an empty "New chat"; if only empties
 *     (or nothing) remain, the answer is the welcome state (id: null);
 *   - `clearSearch` is true when the chosen chat is hidden by the search, so the
 *     caller clears the filter instead of showing "no chats match" with a chat open.
 *  Returns { id: string|null, clearSearch: boolean }. */
export function nextAfterDelete(sessions, { id, filterProject = null, search = "" } = {}) {
  const pool = Object.values(sessions || {}).filter((s) => s && s.id !== id && (!filterProject || s.project === filterProject));
  const next = byRecent(pool.filter((s) => !isBlankChat(s)))[0] || null;
  if (!next) return { id: null, clearSearch: false };
  const q = String(search || "").trim().toLowerCase();
  const hidden = !!q && !String(next.title || "").toLowerCase().includes(q);
  return { id: next.id, clearSearch: hidden };
}

/** A fresh, empty session. */
export function blankSession({ id, now, model = "", sealed = false, project = null, projectObj = null, preset = "fold" } = {}) {
  const cwd = projectObj?.cwd || null;
  return { id, title: "New chat", titleAuto: true, named: false, icon: null, messages: [], grounding: true, effort: "balanced", model, sealed: !!sealed, project: project || null, preset: projectObj?.preset || preset, cwd, cwdFromProject: !!cwd, createdAt: now, updated: now, minds: { ops: [] } };
}

/** "New chat", without piling up empties. When the open chat is already empty it
 *  IS the new chat (the caller just focuses the composer); otherwise the most
 *  recent empty chat (preferring the project being viewed) is reused; only then is one made.
 *  Mutates `sessions` only when it creates (or re-homes a reused empty chat into
 *  the project filter). Returns { id, created }. */
export function newChatInto(sessions, { activeId = null, filterProject = null, projects = {}, newId, now, model = "", sealed = false, preset = "fold" } = {}) {
  const scope = filterProject || null;
  const active = activeId ? sessions[activeId] : null;
  let reuse = isBlankChat(active) ? active : null;
  if (!reuse) {
    const blanks = byRecent(Object.values(sessions).filter(isBlankChat));
    reuse = blanks.find((s) => (s.project || null) === scope) || blanks[0] || null;
  }
  if (reuse) {
    // An empty chat has nothing to lose: bring it into the project being viewed.
    if (scope && reuse.project !== scope) {
      const p = projects[scope] || null;
      reuse.project = scope;
      if (!reuse.cwd || reuse.cwdFromProject) { reuse.cwd = p?.cwd || null; reuse.cwdFromProject = !!p?.cwd; }
    }
    return { id: reuse.id, created: false };
  }
  sessions[newId] = blankSession({ id: newId, now, model, sealed, project: scope, projectObj: scope ? projects[scope] || null : null, preset });
  return { id: newId, created: true };
}

/** Remove stale empty "New chat" husks (never the ids in `keep`, and — when
 *  `minAgeMs` is set — never a chat younger than that, so another tab's brand
 *  new chat is not swept from under it). Mutates `sessions`; returns removed ids. */
export function pruneStaleEmpties(sessions, { keep = [], minAgeMs = 0, nowMs = Date.now() } = {}) {
  const keepSet = new Set(keep.filter(Boolean));
  const removed = [];
  for (const [id, s] of Object.entries(sessions)) {
    if (keepSet.has(id) || !isStaleEmpty(s)) continue;
    if (minAgeMs && nowMs - stamp(s.createdAt || s.updated) < minAgeMs) continue;
    delete sessions[id]; removed.push(id);
  }
  return removed;
}

/** Ungroup a deleted project's chats. A chat's folder is cleared ONLY when it
 *  was inherited from the project (`cwdFromProject`); a folder the person set on
 *  the chat itself stays. A chat saved before that flag existed is judged by
 *  its folder equalling the project's (there was no other way to get one).
 *  Mutates `sessions`; returns the ids it ungrouped. */
export function detachProject(sessions, projectId, { projectCwd = null } = {}) {
  const touched = [];
  for (const s of Object.values(sessions)) {
    if (!s || s.project !== projectId) continue;
    const inherited = s.cwdFromProject === true || (s.cwdFromProject === undefined && !!projectCwd && s.cwd === projectCwd);
    s.project = null;
    if (inherited) s.cwd = null;
    s.cwdFromProject = false;
    touched.push(s.id);
  }
  return touched;
}

/** Re-home a chat into another project (or none): a folder inherited from the
 *  old project follows to the new one; a folder the person set stays. */
export function moveToProjectId(s, projectId, { project = null, oldProjectCwd = null } = {}) {
  const inherited = s.cwdFromProject === true || (s.cwdFromProject === undefined && !!oldProjectCwd && s.cwd === oldProjectCwd);
  s.project = projectId || null;
  if (inherited || !s.cwd) { s.cwd = project?.cwd || null; s.cwdFromProject = !!project?.cwd; }
  return s;
}

/* ---- tombstones: the deleted-ids ledger (id -> deletedAt ISO) ---- */
export const TOMBSTONE_TTL_MS = 30 * 24 * 3600 * 1000;

export function mergeTombstones(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, at] of Object.entries(b || {})) if (!out[id] || stamp(at) > stamp(out[id])) out[id] = at;
  return out;
}
export function pruneTombstones(tombs = {}, nowMs = Date.now(), ttl = TOMBSTONE_TTL_MS) {
  const out = {};
  for (const [id, at] of Object.entries(tombs || {})) if (nowMs - stamp(at) <= ttl) out[id] = at;
  return out;
}

/** A session's last-touched moment: its last update, or the moment it was
 *  restored from a delete (Undo), whichever is later. A tombstone only kills a
 *  copy that was not touched after the delete. */
export const touched = (s) => Math.max(stamp(s?.updated), stamp(s?.restoredAt));

/** Reconcile two copies of the map (this tab's, the stored one).
 *   - a tombstoned id is NEVER resurrected: a copy not touched after the delete
 *     is dropped (an Undo stamps `restoredAt`, which is how a restore outlives
 *     the tombstone other tabs still hold);
 *   - a chat only one side has is KEPT (never wiped by a stale writer);
 *   - when both have it, the later `updated` wins (a tie keeps the one with more
 *     messages, then the local one);
 *   - ids in `keep` (a turn is running here) always keep the LOCAL object, so the
 *     running turn's reference stays the live one.
 *  Returns a new map that REUSES the winning objects. */
export function mergeSessions(local = {}, remote = {}, tombstones = {}, { keep = [] } = {}) {
  const keepSet = new Set(keep);
  const out = {};
  for (const id of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const a = local?.[id], b = remote?.[id];
    let pick;
    if (a && b) {
      if (keepSet.has(id)) pick = a;
      else {
        const ta = stamp(a.updated), tb = stamp(b.updated);
        pick = tb > ta ? b : ta > tb ? a : ((b.messages || []).length > (a.messages || []).length ? b : a);
        // a restore (Undo) is a touch even though `updated` did not move
        if (ta === tb && touched(a) !== touched(b)) pick = touched(b) > touched(a) ? b : a;
      }
    } else pick = a || b;
    if (!pick) continue;
    const dead = tombstones?.[id];
    if (dead && stamp(dead) >= touched(pick)) continue;
    out[id] = pick;
  }
  return out;
}

/** Apply a merged map to the live one IN PLACE (the page holds `sessions` as a
 *  const). Returns { added, removed, replaced } id lists. */
export function applyInPlace(live, merged) {
  const added = [], removed = [], replaced = [];
  for (const id of Object.keys(live)) if (!(id in merged)) { delete live[id]; removed.push(id); }
  for (const [id, v] of Object.entries(merged)) {
    if (!(id in live)) { live[id] = v; added.push(id); }
    else if (live[id] !== v) { live[id] = v; replaced.push(id); }
  }
  return { added, removed, replaced };
}
