// holodeck-session.js — one Matrix client per page.
//
// The Share panel and the Inbox both need a signed-in, crypto-started client for the same account and
// device. Two clients on one device would fight over its crypto store, so they take it from here:
// the first caller makes it, later callers share it, and it is stopped only when the last one lets go.
// No credentials live in this file: a session object is handed in and used, never kept anywhere else.

let held = null;   // { key, mx, holders, make }

const keyOf = (s) => `${s.userId}|${s.deviceId || ''}`;

/** Take the page's client for `sess`, making it with `make()` if there is none. Pair with release(). */
export async function acquire(sess, make) {
  const k = keyOf(sess);
  if (held && held.key === k && held.mx) { held.holders++; return held.mx; }
  if (held && held.pending && held.key === k) { const mx = await held.pending; held.holders++; return mx; }
  if (held && held.mx && held.holders === 0) { try { held.mx.stop && held.mx.stop(); } catch { /* already stopped */ } }
  const rec = { key: k, mx: null, holders: 0, pending: null };
  held = rec;
  rec.pending = Promise.resolve().then(make).then((mx) => { rec.mx = mx; rec.holders++; rec.pending = null; return mx; }, (e) => { if (held === rec) held = null; throw e; });
  return rec.pending;
}

/** Let go of the client; the last holder stops it. */
export function release(mx) {
  if (!held || held.mx !== mx) return;
  held.holders = Math.max(0, held.holders - 1);
  if (held.holders === 0) { try { mx.stop && mx.stop(); } catch { /* already stopped */ } held = null; }
}

/** The client that is already running, or null. Never starts one. */
export function current() { return held && held.mx ? held.mx : null; }
