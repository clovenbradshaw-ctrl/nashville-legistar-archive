// fold-chat-exit.js — the rules for a page that makes its OWN web calls.
//
// In the browser extension the page can fetch any site it has permission for, with
// no CORS wall and no relay: the request leaves from this machine's own address and
// nothing else is in the path. That is the point, and it is also a sharp tool — the
// fetch is driven by a model reading pages it did not choose, and those pages can
// be hostile (prompt injection). So every exit goes through THIS gate, which is a
// small, pure, testable set of rules:
//
//   · https only (the local bridge, a loopback http origin, is the one exception)
//   · no username/password in the URL, no non-default port
//   · no IP literals, no single-label or private-suffix names (localhost, *.local,
//     *.internal, *.lan, …) — a model-driven fetch must not be able to reach this
//     machine or the person's network
//   · GET/HEAD only, no body, no Authorization header
//   · credentials are ALWAYS omitted: the request never rides the person's signed-in
//     sessions (client portals, email, anything behind a login)
//   · no Referer
//   · the FINAL url after redirects is checked again; a redirect into a blocked
//     place discards the response
//
// What it cannot do, said plainly: a public NAME that resolves to a private address
// (DNS rebinding, or a name like localtest.me) cannot be seen from a page — Chrome
// gives extensions no DNS answers — so the name list below is best-effort. Redirect
// hops cannot be inspected before they are followed (fetch hides them), so a redirect
// to a private address is caught only after a credential-less GET has been made.
// This module never exposes the fetcher to web pages: nothing here listens for
// messages, and the manifest declares no externally_connectable.

/** Are we running as a browser extension page? (chrome-extension:// / moz-extension://) */
export const isExtension = (g = globalThis) => !!(g.chrome && g.chrome.runtime && g.chrome.runtime.id);

/** The local heimdall bridge's usual origins. The bridge is the person's own process. */
export const LOOPBACK_BRIDGES = Object.freeze(["http://127.0.0.1:8790", "http://localhost:8790"]);

/** Names that never mean "a public website". */
export const PRIVATE_SUFFIXES = Object.freeze([
  "localhost", "local", "internal", "lan", "home", "home.arpa", "corp", "intranet", "private", "localdomain",
]);
/** Public DNS services that resolve to whatever address is spelled in the name. Best-effort. */
export const IP_EMBEDDING_DOMAINS = Object.freeze([
  "nip.io", "sslip.io", "xip.io", "localtest.me", "lvh.me", "vcap.me", "lacolhost.com", "localhost.run",
]);
export const MAX_URL_CHARS = 4096;

export class ExitBlocked extends Error {
  constructor(code, reason, url) {
    super(`blocked by the fold's exit rules: ${reason}`);
    this.name = "ExitBlocked";
    this.code = code;
    this.reason = reason;
    this.url = url;
  }
}

const no = (code, reason) => ({ ok: false, code, reason });
// "scheme://host:port" — computed rather than URL.origin, which is opaque ("null") for non-special schemes
// such as chrome-extension:// in some engines.
const keyOf = (u) => u.protocol + "//" + u.host;
const originsOf = (bridges) => {
  const list = typeof bridges === "function" ? bridges() : bridges;
  const set = new Set();
  for (const b of list || []) { try { set.add(keyOf(new URL(String(b)))); } catch { /* not a URL: ignore */ } }
  return set;
};

/** May this URL leave? Pure. → { ok:true, bridge:boolean, url } | { ok:false, code, reason }.
 *  `bridges` is the list (or a function returning the list) of TRUSTED LOCAL origins — the person's
 *  own bridge (plain http on loopback) and the extension's own pages. Those pass untouched (`bridge:true`:
 *  no web rules apply to the person's own process). Everything else must be a public https name. */
export function checkUrl(input, { bridges = [] } = {}) {
  const raw = String(input ?? "");
  if (raw.length > MAX_URL_CHARS && !/^(?:data|blob):/i.test(raw)) return no("too-long", "the URL is longer than " + MAX_URL_CHARS + " characters");
  let u;
  try { u = new URL(raw); } catch { return no("malformed", "not a valid URL"); }
  if (u.protocol === "data:" || u.protocol === "blob:") return { ok: true, bridge: true, url: u.href };   // never touches the network
  if (originsOf(bridges).has(keyOf(u))) return { ok: true, bridge: true, url: u.href };
  if (u.protocol !== "https:") return no("scheme", `only https is read (not ${u.protocol.replace(":", "")})`);
  if (u.username || u.password) return no("credentials", "the URL carries a username or password");
  if (u.port) return no("port", "only the default https port is used (not :" + u.port + ")");
  // WHATWG URL has already normalised 127.1, 0x7f.1, 2130706433, %6c%6fcalhost …
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return no("malformed", "no host");
  if (host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return no("ip-literal", "an IP address, not a public name");
  if (!host.includes(".")) return no("single-label", "a single-label name (" + host + ") is a local one");
  if (PRIVATE_SUFFIXES.some((s) => host === s || host.endsWith("." + s))) return no("private-name", host + " is a private or local name");
  if (IP_EMBEDDING_DOMAINS.some((s) => host === s || host.endsWith("." + s))) return no("private-name", host + " resolves to whatever address its name spells");
  return { ok: true, bridge: false, url: u.href };
}

const SENSITIVE_HEADERS = new Set(["authorization", "proxy-authorization", "cookie"]);
function cleanHeaders(h) {
  if (!h) return h;
  const out = {};
  const put = (k, v) => { if (!SENSITIVE_HEADERS.has(String(k).toLowerCase())) out[k] = v; };
  if (typeof h.forEach === "function" && typeof h.get === "function") h.forEach((v, k) => put(k, v));
  else if (Array.isArray(h)) for (const [k, v] of h) put(k, v);
  else for (const k of Object.keys(h)) put(k, h[k]);
  return out;
}

const GUARDED = Symbol.for("fold.exit.guarded");

/** guard({ bridges, onBlock }) → wrap(fetchImpl) → a fetch that obeys the rules above.
 *  `onBlock(error)` is told of every refusal (for the trace); a refusal always throws ExitBlocked. */
export function guard({ bridges = [], onBlock = null } = {}) {
  return function wrap(fetchImpl) {
    if (fetchImpl && fetchImpl[GUARDED]) return fetchImpl;
    const guarded = async (input, init = {}) => {
      const isReq = typeof Request !== "undefined" && input instanceof Request;
      const url = isReq ? input.url : typeof input === "string" ? input : (input && input.href) || String(input);
      const refuse = (code, reason) => { const e = new ExitBlocked(code, reason, url); try { onBlock?.(e); } catch { /* a listener never blocks the rule */ } throw e; };
      const v = checkUrl(url, { bridges });
      if (!v.ok) refuse(v.code, v.reason);
      const o = { ...init, credentials: "omit", referrerPolicy: "no-referrer" };
      if (!v.bridge) {
        const method = String(o.method || (isReq ? input.method : "GET")).toUpperCase();
        if (method !== "GET" && method !== "HEAD") refuse("method", "only GET and HEAD leave (not " + method + ")");
        if (o.body != null || (isReq && input.body != null)) refuse("body", "a request body does not leave");
        o.headers = cleanHeaders(o.headers ?? (isReq ? input.headers : undefined));
        o.redirect = "follow";
      }
      const r = await fetchImpl(isReq ? new Request(input, o) : v.url, isReq ? undefined : o);
      if (!v.bridge && r && r.url) {
        const after = checkUrl(r.url, { bridges });
        if (!after.ok) { try { r.body?.cancel?.(); } catch { /* already closed */ } refuse("redirect", "it redirected somewhere that may not be read (" + after.reason + ")"); }
      }
      return r;
    };
    guarded[GUARDED] = true;
    return guarded;
  };
}

/** The person's own bridge, if they set one in the page and it is on this machine (loopback http). */
function storedBridge(g) {
  try {
    const v = g.localStorage && g.localStorage.getItem("fold-chat:bridge");
    if (!v) return null;
    const u = new URL(v);
    return u.protocol === "http:" && /^(?:127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname) ? keyOf(u) : null;
  } catch { return null; }
}

/** Put the gate on the page's GLOBAL fetch. This is the chokepoint: after it runs, no code in the page — the
 *  chat, the web module, any module added later — can make a web call that skips the rules, and none needs to
 *  be changed to obey them. Trusted local origins (the extension's own pages, the loopback bridge) pass
 *  untouched. Idempotent. Returns true if it installed the gate. */
export function installGlobalGuard({ g = globalThis, extraOrigins = [], onBlock = (e) => { try { console.warn("[fold exit] " + e.message + " — " + e.url); } catch { /* no console */ } } } = {}) {
  if (!g.fetch || g.fetch[GUARDED]) return false;
  const self = (() => { try { return g.chrome.runtime.getURL("/"); } catch { return null; } })();
  const bridges = () => [self, ...LOOPBACK_BRIDGES, storedBridge(g), ...extraOrigins].filter(Boolean);
  g.fetch = guard({ bridges, onBlock })(g.fetch.bind(g));
  return true;
}

// ── permission to read arbitrary sites ───────────────────────────────────────
// The manifest's fixed host list covers the search engines and the five API sources. Reading
// ANY other page is an opt-in the person grants once, on the options page, and can revoke:
// an optional host permission for https sites. (Optional permissions can only be requested
// from a click, so it cannot be asked for mid-turn — that is why it is a setting.)

export const WEB_READ_ORIGINS = Object.freeze(["https://*/*"]);

export function webReadAccess(chromeApi = globalThis.chrome) {
  const p = chromeApi && chromeApi.permissions;
  const q = { origins: [...WEB_READ_ORIGINS] };
  return {
    available: !!p,
    granted: async () => (p ? !!(await p.contains(q)) : false),
    /** Must be called from a click handler. */
    request: async () => (p ? !!(await p.request(q)) : false),
    revoke: async () => (p ? !!(await p.remove(q)) : false),
  };
}
