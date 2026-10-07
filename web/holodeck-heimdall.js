// holodeck-heimdall.js — the Holodeck's door onto the heimdall compute fleet
// (heimdall: distributed inference — a link, a 6-digit pairing code, any
// device lending its model). Mint a fleet room + invite link under the
// person's own Matrix account, and record the code a worker gives them out
// of band into the account's org.heimdall.codes registry — the SAME registry
// the heimdall site's host confirms acceptance against. So an invite minted
// here is confirmable on the heimdall site, and vice versa.
//
// The invite link is SHORT: the fleet room is born with a short local alias
// (`#<code>:<server>`), so the link is just `?r=<code>` — something a person
// can actually type by hand on a worker's computer. The code is the alias.
//
// PURE (the fold's cast.js pattern): the only crossings — createRoom,
// setRoomAlias, and account-data I/O — are injected, so the link is built,
// never fetched. The worker's device generates its own 6-digit pairing code
// and gives it to the person; this surface records it. The code never rides
// in the link.
export const HEIMDALL_SITE = "https://scores-patch-points.github.io/heimdall/";
export const CODES_TYPE = "org.heimdall.codes";
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

// The no-confusion alphabet: no 0/O, no 1/I/l, lowercase — the code IS what
// gets typed on the worker's computer.
export const SHORT_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const SHORT_LENGTH = 5;

export function shortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_LENGTH));
  return [...bytes].map((b) => SHORT_ALPHABET[b % SHORT_ALPHABET.length]).join("");
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The worker's pairing code is six digits; anything else is a typed refusal. */
export function normalizeCode(input) {
  const digits = String(input ?? "").replace(/\D/g, "").slice(0, 6);
  return digits.length === 6 ? digits : null;
}

function hostOf(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "";
  }
}

/** True when a createRoom/setRoomAlias failure means the alias is taken — the
 *  one error a mint retries with a fresh code. */
function aliasTaken(e) {
  if (e?.errcode === "M_IN_USE") return true;
  return /in use|taken|already/.test(String(e?.message || "").toLowerCase());
}

/** The short invite link: the room's alias code, nothing else. `?r=<code>`
 *  is the whole URL (the site's 404 page lets `/<code>` be typed instead). */
export function shortLink({ site = HEIMDALL_SITE, code }) {
  return `${String(site).replace(/\?.*$/, "")}?r=${encodeURIComponent(code)}`;
}

/** The full invite link: every field the heimdall site parses. Kept for the
 *  QR flow (a scanned link carries the auto-pairing secret). */
export function inviteLink({ site = HEIMDALL_SITE, roomId, hs, host, name, exp }) {
  const params = new URLSearchParams({ room: roomId, hs, host, name: name || host, exp: String(exp) });
  return `${site}?${params.toString()}`;
}

/** Mint a fleet room under the caller's account and build the share link.
 *  With `short` (default), the room also gets a short local alias and the
 *  returned link is the typable `?r=<code>` form. Crossings injected:
 *  http.createRoom(name, {isPublic}) -> roomId, http.setRoomAlias(roomId,
 *  alias) -> void; a surface without setRoomAlias falls back to the full link.
 */
export async function mintInvite({ http, hs, host, name, short = true }) {
  const roomId = await http.createRoom(`heimdall-${Math.random().toString(36).slice(2, 7)}`, { isPublic: true });
  let code = null;
  if (short && typeof http.setRoomAlias === "function") {
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = shortCode();
      try {
        await http.setRoomAlias(roomId, `#${candidate}:${hostOf(hs)}`);
        code = candidate;
      } catch (e) {
        if (aliasTaken(e)) continue;
        throw e;
      }
    }
  }
  const exp = Date.now() + INVITE_TTL_MS;
  return {
    roomId,
    exp,
    code,
    link: code ? shortLink({ code }) : inviteLink({ roomId, hs, host, name: name || host, exp }),
  };
}

/** Record a worker's 6-digit code into the account registry: read-modify-write
 *  of {active:[{hash,exp}]}, pruning expired entries, never overwriting. */
export async function recordCode({ code, read, write }) {
  const digits = normalizeCode(code);
  if (!digits) return { ok: false, reason: "six digits" };
  const hash = await sha256Hex(digits);
  const now = Date.now();
  const existing = await read();
  const active = (existing?.active ?? []).filter((c) => c.exp > now);
  if (active.some((c) => c.hash === hash)) return { ok: true, duplicate: true, active };
  active.push({ hash, exp: now + INVITE_TTL_MS });
  await write({ active });
  return { ok: true, duplicate: false, active };
}