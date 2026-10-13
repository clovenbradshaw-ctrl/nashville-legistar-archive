// fold-chat-client.js — The Fold's chat surface, speaking to Heimdall.
//
// The Fold's chat version is a browser page, not a server app. There is no
// standalone bridge: the Fold's own server mounts heimdall in-process at
// /heimdall on the SAME origin as this page (server.mjs), and that embedded
// heimdall speaks the OpenAI wire, holds the fleet (phones, linked native
// hosts) and the configured remote/frontier providers, and ENFORCES the
// sealed-external gate for outside models. The model itself runs IN THE PAGE
// (fold-chat-webllm.js, WebGPU): a `webllm:` model is served by the tab's own
// engine, never over the wire, so nothing about it can leave the tab. The old
// standalone bridge (localhost:8790) is only a LATER fallback, for a page that
// is not served by the Fold's server (GitHub Pages). This module is the chat's
// half of that wire:
//
//   listModels()     GET /api/tags   -> every model heimdall can serve, with
//                     its heimdall metadata (frontier? privacy class?) — the
//                     metadata tells the chat which models MUST be sealed.
//   isSealed(id)     a model heimdall marks frontier/sealed-only
//   chat()           POST /v1/chat/completions (SSE stream) — for a sealed
//                     model the body carries heimdall_privacy:"sealed-external"
//                     and ONLY the user's own messages; raw workspace spans
//                     never ride this wire.
//   meter()/ledger() GET /api/meter, /api/ledger — who did the work, exact
//                     external tokens, and the marked estimates.
//   frontier()       GET /api/frontier — the sealed gate's shape.
//
// Browser + node (tests use an injected fetch).

import { PAGE_PREFIX, canonicalModelId, pageModels, PageEngineError } from "./fold-chat-webllm.js";

/** The old standalone bridge's usual origins. Not the home of the bridge any more: they are tried AFTER the same-origin
 *  embedded heimdall, so a GitHub-Pages page (or the extension) with a bridge running on this machine still finds it. */
export const LEGACY_BRIDGES = Object.freeze(["http://localhost:8790", "http://127.0.0.1:8790"]);
/** Where the Fold's own server mounts heimdall, relative to its origin (server.mjs PREFIX). */
export const EMBEDDED_PATH = "/heimdall";

/** Where the Fold's own server listens on this machine. A page with NO same-origin heimdall (the extension's chrome-extension://
 *  pages, a file:// open) looks here BEFORE the legacy bridge ports. The server must also allowlist that page's origin
 *  (HEIMDALL_ALLOWED_ORIGINS), or heimdall will refuse it: finding it here is not the same as being let in. */
export const LOCAL_EMBEDDED = Object.freeze(["http://127.0.0.1:8814" + EMBEDDED_PATH, "http://localhost:8814" + EMBEDDED_PATH]);

/** The embedded heimdall of the server that served THIS page: `<origin>/heimdall`, or null when the page is not served over
 *  http(s) (the extension's chrome-extension:// pages, a file:// open, node). Pure given `loc`. */
export function sameOriginBridge(loc = globalThis.location) {
  try {
    if (!loc || (loc.protocol !== "http:" && loc.protocol !== "https:") || !loc.origin || loc.origin === "null") return null;
    return loc.origin + EMBEDDED_PATH;
  } catch { return null; }
}

/** The bridge a page starts from: the same-origin embedded heimdall when there is one, else the legacy local port. */
export const DEFAULT_BRIDGE = sameOriginBridge() || LEGACY_BRIDGES[0];

/** Combine abort signals (the caller's stop + a hard timeout). Portable: uses
 *  AbortSignal.any when present, else a small shim, so it works in every
 *  browser the surface runs in. */
function anySignal(signals) {
  const list = signals.filter(Boolean);
  if (list.length === 1) return list[0];
  if (typeof AbortSignal !== "undefined" && AbortSignal.any) return AbortSignal.any(list);
  const ctl = new AbortController();
  const onAbort = (e) => { try { ctl.abort(e?.target?.reason ?? e); } catch { ctl.abort(); } };
  for (const s of list) { if (s.aborted) { onAbort({ target: s }); break; } s.addEventListener("abort", onAbort, { once: true }); }
  return ctl.signal;
}

import { namesIn } from "./fold-chat-deid.js";
import { deidentify } from "./fold-chat-redact.js";

/** The legacy fallbacks, in order (the standard local port on both names). The embedded same-origin heimdall is NOT in this
 *  list because it depends on where the page was served: bridgeCandidates() puts it first. */
export const BRIDGE_CANDIDATES = LEGACY_BRIDGES;

/** Where heimdall is looked for, in order: the same-origin embedded one first (or, with none, the Fold server's own local
 *  port), then the legacy local bridge. */
export function bridgeCandidates({ loc = globalThis.location } = {}) {
  const own = sameOriginBridge(loc);
  return own ? [own, ...LEGACY_BRIDGES] : [...LOCAL_EMBEDDED, ...LEGACY_BRIDGES];
}

/** The bridge a caller points at. Overridable (localStorage in the page, constructor arg in tests). Only trailing slashes are
 *  trimmed, so the `/heimdall` prefix the embedded bridge lives under is carried into every route and never doubled. */
export function bridgeBase(override = null) {
  return String(override || sameOriginBridge() || LEGACY_BRIDGES[0]).replace(/\/+$/, "");
}

/** The base a page should start from given what it stored. A stored override that is just the OLD default (the standalone
 *  bridge's port, written by an earlier Detect) must not shadow the embedded heimdall now serving this very page; any other
 *  override is the person's own choice and wins. */
export function pickBridge(stored = null, { loc = globalThis.location } = {}) {
  const own = sameOriginBridge(loc);
  const s = stored ? bridgeBase(stored) : null;
  if (!s) return own || LEGACY_BRIDGES[0];
  if (own && LEGACY_BRIDGES.includes(s)) return own;
  return s;
}

/** Find the running heimdall without the person typing it. Probes each candidate (a custom override first, then the same-origin
 *  embedded heimdall, then the legacy local port) with /bridge/hello, then /api/tags (an older bridge), then the embedded
 *  heimdall's own /status (it answers even while its floor is down). Returns { ok, base, hello } — never throws. */
export async function detectBridge({ override = null, candidates = null, fetchImpl = fetch, timeoutMs = 1500, loc = globalThis.location } = {}) {
  const pool = candidates || bridgeCandidates({ loc });
  const own = sameOriginBridge(loc);
  // A stored legacy default (see pickBridge) does not outrank the embedded heimdall; it just falls into the fallback order.
  const custom = override && !(own && LEGACY_BRIDGES.includes(bridgeBase(override))) ? [override] : [];
  const list = [...new Set([...custom, ...pool, ...(override ? [override] : [])].map((b) => bridgeBase(b)))];
  for (const base of list) {
    try {
      const r = await fetchImpl(base + "/bridge/hello", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) { const j = await r.json().catch(() => null); if (j && j.bridge) return { ok: true, base, hello: j }; }
    } catch {}
    try {
      const r = await fetchImpl(base + "/api/tags", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return { ok: true, base, hello: null };
    } catch {}
    try {
      const r = await fetchImpl(base + "/status", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) { const j = await r.json().catch(() => null); if (j && /^HeimdallEmbed@/.test(String(j.schema || ""))) return { ok: true, base, hello: null, embedded: true }; }
    } catch {}
  }
  return { ok: false, base: null, hello: null };
}

/** Normalize an OpenAI-compatible chat body the bridge understands. */
export function chatBody(model, messages, { privacy = null, temperature = 0.7, maxTokens = 1024 } = {}) {
  const body = { model, messages, temperature, max_tokens: maxTokens, stream: true };
  if (privacy) body.heimdall_privacy = privacy;
  return body;
}

/** True when heimdall's metadata marks this model sealed-only (an outside
 *  provider). A sealed model must never receive raw workspace material. */
export function isSealed(meta) {
  return !!(meta?.frontier || meta?.privacy === "sealed-external");
}

/** The tiers a model can live on, ordered from the nearest executor outward.
 *  This mirrors heimdall's own lanes (deterministic/local · open remote ·
 *  frontier) plus the fold's fleet of linked hosts and workers. */
export const TIERS = Object.freeze({
  local: { id: "local", label: "On this device", note: "runs here — nothing leaves" },
  fleet: { id: "fleet", label: "The fleet", note: "linked hosts & workers" },
  remote: { id: "remote", label: "Open remote", note: "configured outside providers" },
  frontier: { id: "frontier", label: "Frontier · sealed", note: "sealed-external — the reading only" },
});
/** Providers whose small open models are the cheap remote tier (heimdall hosted.js keeps the same list). */
export const HOSTED_PROVIDERS = Object.freeze(["openrouter", "together", "fireworks", "deepinfra"]);
export const TIER_ORDER = Object.freeze(["local", "fleet", "remote", "frontier"]);
// Free tiers: a model here costs nothing and never leaves the trust domain
// (in-tab WebLLM, this machine's Ollama, and the fold's own linked hosts).
export const FREE_TIERS = Object.freeze(["local", "fleet"]);
export function isFreeModel(m) { return !!m && FREE_TIERS.includes(m.tier || tierOf(m)); }

/** True for a model that reasons for CODE, not prose (open hands). Named on the
 *  id, which is the only signal heimdall's tag exposes. A code specialist is
 *  never auto-picked to WRITE: measured live — `qwen2.5-coder:1.5b` handed the
 *  fold's own persona + the generate nudge collapsed into a "Certainly, I'd be
 *  happy to help…" teaser, while a general model under the identical prompt
 *  wrote the full piece. Code mode pins its own model and is unaffected. */
const CODE_MODEL_RE = /(^|[-_:./])coder?([-_:./]|$)|code[-_]?(llama|qwen|gemma|starcoder|deepseek)|starcoder|codestral|codellama|magicoder|granite[-_]?code|wizardcoder|phind/i;
// An embed model returns vectors, not text: it can never answer a turn, so it
// is never auto-picked either (Ollama lists `nomic-embed-text` beside the chat
// models, and picking it would answer nothing).
const EMBED_MODEL_RE = /embed|bge-|e5-|gte-|minilm|nomic-embed|mxbai/i;
export function isCodeModel(m) {
  const id = String(m?.id || m?.name || "");
  return CODE_MODEL_RE.test(id);
}
export function isEmbedModel(m) {
  const id = String(m?.id || m?.name || "");
  return EMBED_MODEL_RE.test(id);
}
/** A model that can serve an ordinary prose turn: not a code specialist, not an
 *  embedder. Auto-pick prefers these. */
export function isChatModel(m) { return !isCodeModel(m) && !isEmbedModel(m); }


/** The model to ride when a session pinned none: the nearest FREE GENERAL one
 *  (local, then fleet), else any free one, else any unsealed, else the first.
 *  A code-specialist model is PREFERRED AGAINST — it is a poor prose mouth, and
 *  auto-pick serves ordinary chat first. The free and automatic choice —
 *  heimdall still routes whatever is picked. Pure and testable.
 *
 *  IN-PAGE MODELS (kind "webllm-page", the tab's own engine) come first when they are READY and last when they are not:
 *    1. an in-page model already loaded in this tab,
 *    2. an in-page model already downloaded (cached),
 *    3. a bridge model that is up (free ones first; a sealed one is never preferred to a free in-page default),
 *    4. the default in-page model — selected but NOT downloaded (the first send asks once; nothing is fetched by picking),
 *    5. whatever else exists (the old tail: a sealed or code-only model beats nothing). */
export function autoPick(models) {
  const list = Array.isArray(models) ? models : [];
  const page = list.filter(isPageModel);
  if (!page.length) return pickFrom(list);
  const rest = list.filter((m) => !isPageModel(m));
  const chatPage = page.filter((m) => isChatModel(m) && !m.sealed);
  const ready = chatPage.find((m) => m.loaded) || chatPage.find((m) => m.cached);
  if (ready) return ready;
  const up = pickFrom(rest.filter((m) => !m.sealed && isChatModel(m)));
  if (up) return up;
  return chatPage.find((m) => m.default) || chatPage[0] || pickFrom(rest) || page[0] || null;
}
function pickFrom(list) {
  const by = (pred) => list.find(pred);
  const free = (tier) => list.filter((m) => !m.sealed && (m.tier || tierOf(m)) === tier && isChatModel(m));
  return free("local")[0]
    || free("fleet")[0]
    || by((m) => isChatModel(m) && !m.sealed && (m.tier || tierOf(m)) === "local")
    || by((m) => isChatModel(m) && !m.sealed && (m.tier || tierOf(m)) === "fleet")
    || by((m) => isChatModel(m) && !m.sealed)
    || by((m) => !isEmbedModel(m) && !m.sealed)   // a coder beats nothing; an embedder never answers
    || list.find((m) => !isEmbedModel(m))
    || list[0] || null;
}

/** Which tier a listed model belongs to. A sealed model is always frontier;
 *  otherwise its kind (or provider) names the tier. Pure and testable. */
export function tierOf(m) {
  if (!m) return "local";
  // small hosted open models (OpenRouter, Together, …) are still sealed, but they are the cheap remote tier, not frontier
  if (m.sealed) return HOSTED_PROVIDERS.includes(m.provider) ? "remote" : "frontier";
  const k = m.kind || String(m.provider || "");
  if (k === "webllm" || k === "webllm-page" || k === "local") return "local";
  if (k === "fleet" || k === "native") return "fleet";
  return "remote";
}

/** Read the bridge's model list from /api/tags (Ollama shape, but carries the
 *  heimdall per-model metadata: webllm/native workers, or frontier+privacy).
 *  Returns [{ id, sealed, location, provider, contextWindow, tier }]. */
export async function listModels({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/tags", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  const j = await r.json();
  const out = [];
  for (const m of Array.isArray(j?.models) ? j.models : []) {
    if (!m?.name) continue;
    const h = m.heimdall || {};
    const model = {
      id: String(m.name),
      sealed: isSealed(h),
      kind: h.frontier ? "frontier" : h.native ? "native" : h.webllm ? "webllm" : h.workers ? "fleet" : "local",
      provider: h.frontier ?? h.native ?? (h.webllm ? "webllm" : h.workers ? "fleet" : "local"),
      location: h.location ?? "local",
      contextWindow: h.context_window ?? null,
    };
    model.tier = tierOf(model);
    out.push(model);
  }
  return out;
}

// ───────────────────────── the model IN THIS TAB ─────────────────────────
//
// The page's own engine (fold-chat-webllm.js createPageEngine, WebGPU) is registered once by the surface. Its models are listed
// beside the bridge's, and chat() serves them from the tab: no request, no heimdall, no sealed gate — nothing leaves the tab.
let pageEngine = null;
let pageHooks = {};
/** The window every in-tab model runs at: read off the pinned web-llm 0.2.85 prebuilt config (context_window_size is 4096 for each
 *  model in MODEL_CHOICES, checked 2026-10-05), so Gary can shrink a prompt to fit instead of the engine rejecting it. */
export const PAGE_CONTEXT_TOKENS = 4096;
/** A cached model that has not loaded in this long is stopped (a first-ever download is exempt — the engine's own
 *  no-progress watchdog covers it). Declared, not measured; a cached load that hangs is pathological. */
export const LOAD_TIMEOUT_MS = 60000;
/** Register (or clear, with null) the page's engine. `confirmDownload({ id, name, sizeLabel, cached }) → Promise<boolean>` is
 *  asked ONCE before a model that is not on this device is fetched; with no answer function (or a "no") nothing is downloaded. */
export function setPageEngine(engine, { confirmDownload = null } = {}) {
  pageEngine = engine && typeof engine.chatStream === "function" ? engine : null;
  pageHooks = { confirmDownload: typeof confirmDownload === "function" ? confirmDownload : null };
}
export function getPageEngine() { return pageEngine; }
/** A model the tab itself serves ('webllm:<id>' or a listed entry of kind 'webllm-page'). */
export function isPageModel(m) {
  if (m && typeof m === "object") return m.kind === "webllm-page" || String(m.id || "").startsWith(PAGE_PREFIX);
  return String(m ?? "").startsWith(PAGE_PREFIX);
}

/** Every model this page can use: the tab's own (listed even when the bridge is down or never answered) plus whatever the
 *  bridge serves. { models, bridgeUp, bridgeError, page: { available, reason, count } }. Never throws and never downloads:
 *  listing a page model reads the browser's own cache hint, it does not load the library or the weights. */
export async function listAllModels({ base = null, fetchImpl = fetch, engine = pageEngine, bridge = true } = {}) {
  let bridgeModels = [], bridgeUp = true, bridgeError = null;
  const bridgeP = bridge === false ? Promise.resolve() : listModels({ base, fetchImpl }).then((m) => { bridgeModels = m; }, (e) => { bridgeUp = false; bridgeError = e?.message || String(e); });
  let inTab = [], reason = engine ? "no-adapter" : "no-engine";
  const tabP = engine ? pageModels(engine).then((m) => { inTab = m; reason = m.reason; }, () => { inTab = []; }) : Promise.resolve();
  await Promise.all([bridgeP, tabP]);
  const tab = inTab.map((m) => ({ ...m, location: "tab", tier: "local", contextWindow: m.contextWindow ?? PAGE_CONTEXT_TOKENS }));
  return { models: [...tab, ...bridgeModels], bridgeUp, bridgeError, page: { available: tab.length > 0, reason, count: tab.length } };
}

/** The words a person reads when a page model could not answer. status is a plain number the app's notices understand
 *  (never 0 = "the bridge could not be reached", never 403 = "a gate said no"). */
function pageError(e, model) {
  if (e && e.name === "AbortError") return e;
  const kind = e instanceof PageEngineError ? e.kind : "error";
  const msg = String(e?.message || e);
  const out = new Error(
    kind === "no-gpu" ? `this browser has no WebGPU (${e.reason || "no-adapter"}), so ${model} cannot run in this tab \u2014 use a WebGPU browser`
    : kind === "loader" ? `the in-tab model runtime could not be fetched (${msg}) \u2014 it needs the network once`
    : msg);
  out.status = kind === "no-gpu" ? 501 : kind === "loader" ? 502 : kind === "bad-request" ? 422 : 500;
  out.kind = kind; out.place = "tab"; out.model = model;
  if (e?.reason) out.reason = e.reason;
  return out;
}

async function chatPage(model, messages, { onToken, signal, temperature, maxTokens, totalTimeoutMs, allowDownload, confirmDownload, loadTimeoutMs = LOAD_TIMEOUT_MS }, finishAudit, auditId) {
  const eng = pageEngine;
  const fail = (e) => { const err = pageError(e, model); finishAudit({ ok: false, status: err.status, error: err.message }); return err; };
  const abortErr = () => Object.assign(new Error("aborted"), { name: "AbortError" });
  if (!eng) throw fail(new PageEngineError("no-gpu", "no in-page engine is registered in this page", { reason: "no-engine" }));
  if (signal?.aborted) { finishAudit({ ok: false, error: "aborted" }); throw abortErr(); }
  // No WebGPU is decided FIRST, before anything that touches the network (the cache probe fetches the 6 MB library) or asks about a download.
  let g = null;
  try { g = await eng.gpu?.(); } catch { g = null; }
  if (g && g.available === false) throw fail(new PageEngineError("no-gpu", `no WebGPU for an in-page model (${g.reason || "no-adapter"})`, { reason: g.reason || "no-adapter" }));
  if (signal?.aborted) { finishAudit({ ok: false, error: "aborted" }); throw abortErr(); }
  const canon = canonicalModelId(model);
  // A settled fallback (the engine fell back from this model earlier) answers for it: no re-ask, no reload.
  let loaded = eng.isLoaded() && (eng.loadedId() === canon || !!eng.servesFor?.(canon));
  if (!loaded) {
    // NEVER a silent multi-GB download: a model that is not on this device is fetched only after a "yes".
    let cached = false;
    try { cached = await eng.cached(canon, { probe: true }); } catch { cached = false; }
    if (!cached && allowDownload !== true) {
      const ask = confirmDownload || pageHooks.confirmDownload;
      let yes = false;
      try {
        const asking = ask ? Promise.resolve(ask({ id: canon, name: canon, cached: false })) : Promise.resolve(false);
        // Stop releases the turn even while the question is still open.
        yes = !!(await (signal ? Promise.race([asking, new Promise((_, rej) => signal.addEventListener?.("abort", () => rej(abortErr()), { once: true }))]) : asking));
      } catch (e) { if (e && e.name === "AbortError") { finishAudit({ ok: false, error: "aborted" }); throw e; } yes = false; }
      if (!yes) {
        const err = new Error(`the in-tab model ${canon} is not downloaded and the download was not approved`);
        err.status = 428; err.kind = "declined"; err.place = "tab"; err.model = model;
        finishAudit({ ok: false, status: 428, error: err.message });
        throw err;
      }
    }
    // load() cannot be cancelled once it has begun (the weights keep caching for next time); Stop only releases THIS turn.
    // A CACHED load is bounded: a load that has not settled in LOAD_TIMEOUT_MS is stopped, so a stalled engine can
    // never hold the composer forever (a first-ever download is exempt — it may legitimately take minutes on a slow link).
    const loading = Promise.resolve().then(() => eng.load(canon));
    loading.catch(() => {});
    const released = new Promise((_, rej) => { signal?.addEventListener?.("abort", () => rej(abortErr()), { once: true }); });
    const raced = [loading, released];
    let loadTimer = null;
    if (cached && loadTimeoutMs > 0) raced.push(new Promise((_, rej) => { loadTimer = setTimeout(() => rej(new PageEngineError("load-timeout", `the in-tab model ${canon} did not load within ${Math.round(loadTimeoutMs / 1000)}s and was stopped`, { reason: "load-timeout" })), loadTimeoutMs); }));
    try { await Promise.race(raced); } catch (e) { if (loadTimer) clearTimeout(loadTimer); throw fail(e); }
    if (loadTimer) clearTimeout(loadTimer);
  }
  // The hard total timeout covers the GENERATION only (a first load may legitimately take minutes on a slow link).
  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(new Error("chat timed out")), totalTimeoutMs);
  const combined = signal ? anySignal([signal, timeoutCtl.signal]) : timeoutCtl.signal;
  let text = "", tokens = 0;
  const meta = {};
  try {
    for await (const d of eng.chatStream(messages, { signal: combined, temperature, maxTokens, meta })) {
      text += d; tokens++;
      onToken?.(d);
    }
  } catch (e) {
    clearTimeout(timer);
    throw fail(e);
  }
  clearTimeout(timer);
  if (signal?.aborted) { finishAudit({ ok: false, error: "aborted" }); throw abortErr(); }
  if (timeoutCtl.signal.aborted) {
    const err = new Error("the turn timed out (" + Math.round(totalTimeoutMs / 1000) + "s)");
    err.status = 504; err.kind = "timeout"; err.place = "tab";
    finishAudit({ ok: false, error: err.message });
    throw err;
  }
  // The engine ended the stream with "abort" and neither the person's Stop nor the turn timeout asked for it: the model was
  // replaced (or unloaded) under the answer. What we hold is a TRUNCATED answer; say so instead of shipping it as complete.
  // (finish "length" is passed through as the bridge path does: the text so far is the answer.)
  if (meta.finish === "abort") throw fail(new PageEngineError("generate-failed", "the in-tab model was replaced mid-answer, so the answer is incomplete"));
  finishAudit({ ok: true, status: 200 });
  const used = eng.loadedId?.() || canon;
  return { text, tokens, auditId, finish: meta.finish ?? null, usage: { completion_tokens: tokens }, place: "tab", privacy: "in-tab", model: PAGE_PREFIX + used, fellBackFrom: used !== canon ? PAGE_PREFIX + canon : null };
}

/** One chat turn over the bridge. SSE streams tokens to onToken(text); the
 *  resolved value is { text, tokens } (tokens counted per delta). A sealed
 *  model is forced sealed-external unless the caller chose "explicit".
 *  Rejects with { status, message } on bridge/provider errors. */
// A page-wide audit hook: every chat() reports what it is about to send and how it ended,
// so the surface can record it BEFORE it leaves. The hook never alters the request.
let auditHook = null;
export function setAuditHook(h) { auditHook = h && typeof h.before === "function" ? h : null; }
const newAuditId = () => "aud_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// GARY'S DOOR (fold-chat-gary.js): every chat() hands its messages to this door BEFORE anything is audited or sent. The door
// strikes what must never reach the mouth and may REFUSE the call (a prompt that asks for JSON, a model asked with nothing in
// view); a refused call never touches the network. `null` (the default) is no door — the tests and any caller that wants the
// bare client. The door changes only the input, never what the model says back.
let promptDoor = null;
export function setPromptDoor(fn) { promptDoor = typeof fn === "function" ? fn : null; }

export async function chat(model, messages, { base = null, privacy = null, onToken = null, signal = null, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, totalTimeoutMs = 180000, audit = null, allowDownload = false, confirmDownload = null, loadTimeoutMs = LOAD_TIMEOUT_MS } = {}) {
  const inTab = isPageModel(model);
  const url = bridgeBase(base) + "/v1/chat/completions";
  if (promptDoor) {
    const handed = promptDoor(messages, { model, maxTokens, purpose: audit?.purpose || null });
    if (handed?.refused?.length) {
      const err = new Error("the prompt door refused this call (" + handed.refused.map((f) => f.rule).join(", ") + ") \u2014 nothing was sent");
      err.status = 422; err.refused = handed.refused;
      throw err;
    }
    if (Array.isArray(handed?.messages)) messages = handed.messages;
  }
  // A model that lives IN THIS TAB: nothing is sent anywhere, so the sealed-external gate does not apply (and is never claimed).
  // The prompt door above has already read the messages; the audit record says "in-tab", and the answer comes from the page's engine.
  if (inTab) {
    const auditId = audit?.id || newAuditId();
    let done = null;
    try { done = auditHook?.before({ auditId, model, messages, privacy: "in-tab", base: null, segments: audit?.segments || null, worlds: audit?.worlds || null, symmetry: audit?.symmetry || null, purpose: audit?.purpose || null, run: audit?.run || null, masking: audit?.masking || null }) || null; } catch { done = null; }
    const finish = (r) => { try { done?.(r); } catch {} };
    return chatPage(model, messages, { onToken, signal, temperature, maxTokens, totalTimeoutMs, allowDownload, confirmDownload, loadTimeoutMs }, finish, auditId);
  }
  // Sealed by default for outside models: the Fold selects the privacy mode
  // and seals first. Raw spans never leave — only what the caller put in
  // `messages` rides the wire.
  const effective = privacy ?? "sealed-external";
  const body = chatBody(model, messages, { privacy: effective, temperature, maxTokens });
  // The audit id rides in a header so heimdall's own ledger can be matched to this
  // request; a world slot (when this request is one of a set) rides the same way —
  // the slot only, never which world is real.
  const auditId = audit?.id || newAuditId();
  const extraHeaders = { "x-fold-audit": auditId };
  if (audit?.worlds) extraHeaders["x-fold-worlds"] = `${audit.worlds.setId}:${audit.worlds.slot}/${audit.worlds.n}`;
  let auditDone = null;
  try { auditDone = auditHook?.before({ auditId, model, messages, privacy: effective, base, segments: audit?.segments || null, worlds: audit?.worlds || null, symmetry: audit?.symmetry || null, purpose: audit?.purpose || null, run: audit?.run || null, masking: audit?.masking || null }) || null; } catch { auditDone = null; }
  const finishAudit = (r) => { try { auditDone?.(r); } catch {} };
  // A HARD total timeout, always: a stream that stalls must release the
  // surface. The caller's own signal (a stop button) still aborts earlier; this
  // is the floor so a hung turn can never leave the composer disabled forever.
  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(new Error("chat timed out")), totalTimeoutMs);
  const combined = signal ? anySignal([signal, timeoutCtl.signal]) : timeoutCtl.signal;
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (e) {
    clearTimeout(timer);
    finishAudit({ ok: false, error: e?.message || e });
    const timedOut = /timed out|abort/i.test(String(e?.message || e?.name || ""));
    const err = new Error(timedOut ? "the turn timed out (" + Math.round(totalTimeoutMs / 1000) + "s)" : "bridge unreachable: " + (e?.message || e));
    err.status = timedOut ? 504 : 0;
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) finishAudit({ ok: false, status: res.status, error: "bridge answered " + res.status });
  if (res.status === 400) {
    let msg = "heimdall refused the request";
    try { msg = (await res.json())?.error?.message || msg; } catch {}
    finishAudit({ ok: false, status: 400, error: msg });
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  // A 403 from the bridge is a GATE speaking (e.g. the safety-and-ethics gate): carry its own words, so the turn's
  // typed failure note says WHY instead of "answered 403".
  if (res.status === 403) {
    let msg = "heimdall refused the request";
    try { const j = await res.json(); msg = (typeof j?.error === "string" ? j.error : j?.error?.message) || msg; } catch {}
    const err = new Error(msg);
    err.status = 403;
    throw err;
  }
  if (!res.ok || !res.body) {
    const err = new Error("heimdall bridge answered " + res.status);
    err.status = res.status;
    throw err;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let tokens = 0;
  let usage = null;
  let finish = null;   // the stream's own finish_reason ("stop" | "length" | …): a reply cut at the token limit must not pass for a finished one
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value ?? "";
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "").trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let j;
      try { j = JSON.parse(payload); } catch { continue; }
      if (j.usage) usage = j.usage;
      if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
      if (j.error) { const err = new Error(j.error?.message || "bridge stream error"); err.status = 502; finishAudit({ ok: false, error: err.message }); throw err; }
      const delta = j.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        text += delta;
        tokens++;
        onToken?.(delta);
      }
    }
  }
  finishAudit({ ok: true, status: res.status });
  return { text, tokens, auditId, usage, finish };
}

/** The savings meter: exact external tokens, lane counts, and the marked
 *  estimates heimdall computes. { counts, externalTokens, estimated }. */
export async function meter({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/meter", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Recent dispatch-ledger entries (the last 200): who did what, predicted vs
 *  actual, and the privacy mode. */
export async function ledger({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/ledger", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Tokens used and saved, in plain words, from heimdall's /api/meter (`tokens`). Pure. null when this heimdall predates the token ledger.
 *  `used` is what went to outside providers (their own counts when they report them); `saved` is what open-remote and local lanes
 *  served instead of the reference frontier model; `cancelled` is calls stopped because another lane had already won. */
export function describeTokens(m) {
  const t = m?.tokens;
  if (!t || !t.used) return null;
  const n = (x) => Math.round(Number(x) || 0).toLocaleString("en-US");
  const usd = (x) => { const v = Number(x) || 0; return v === 0 ? "$0" : v < 0.01 ? "$" + v.toFixed(4) : "$" + v.toFixed(2); };
  return {
    used: `${n(t.used.input)} in · ${n(t.used.output)} out`,
    cost: usd(t.used.usd),
    saved: `${n(t.saved?.tokens)} tokens`,
    savedUsd: usd(t.saved?.usd),
    versus: t.saved?.versus || "",
    local: t.local?.calls ? `${n(t.local.input + t.local.output)} tokens on this machine and the fleet (free)` : "",
    cancelled: t.cancelled || 0,
    exact: t.exact == null ? "" : t.exact >= 1 ? "all counts reported by the providers" : `${Math.round(t.exact * 100)}% of counts reported by the providers, the rest counted by chunk`,
    rows: (t.used.byModel || []).map((r) => ({ model: r.model, lane: r.lane, calls: r.calls, tokens: n((r.input || 0) + (r.output || 0)), usd: usd(r.usd) })),
  };
}

/** The sealed gate's shape: which providers are configured, and the rule. */
export async function frontier({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/frontier", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** One request to several small hosted models AT ONCE (heimdall POST /api/race). The caller must say how the messages were
 *  sealed: `privacy` is "sealed-external" (the Fold de-identified them) or "explicit" (the person chose to send as written) —
 *  nothing is sent without it. `mode` "first" answers with the first success; "all" waits for every lane (compare / witness).
 *  `models` are "provider:model" ids from listModels(); none = the loaded hosted lanes, one per provider first, up to `n`.
 *  Resolves { mode, winner:{model,provider,text,ms,tokens}|null, results:[…], asked, pending? }; a 502 (every lane failed)
 *  and a 404 (no hosted model loaded) reject with .status and the lanes' reasons in .results when heimdall gave them. */
export async function race(messages, { privacy = null, models = null, n = 3, mode = "first", maxTokens = 512, temperature = 0.7, base = null, signal = null, fetchImpl = fetch } = {}) {
  if (privacy !== "sealed-external" && privacy !== "explicit") throw new Error("race needs a privacy mode — seal the messages first, then pass privacy:\"sealed-external\" (or \"explicit\")");
  const r = await fetchImpl(bridgeBase(base) + "/api/race", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, mode, n, max_tokens: maxTokens, temperature, heimdall_privacy: privacy, ...(Array.isArray(models) && models.length ? { models } : {}) }),
    ...(signal ? { signal } : {}),
  });
  let j = null;
  try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok) { const err = new Error(j?.error || "heimdall race answered " + r.status); err.status = r.status; if (j?.results) err.results = j.results; throw err; }
  return j;
}

/** Which providers already have a key set on the machine (names only). */
export async function listProviderKeys({ base = null, fetchImpl = fetch } = {}) {
  const r = await linked(fetchImpl, base, () => fetchImpl(bridgeBase(base) + "/api/providers/keys", { cache: "no-store" }));
  if (!r.ok) { const err = new Error("heimdall bridge answered " + r.status); err.status = r.status; if (r.linkTried) err.linkTried = true; throw err; }
  return r.json();
}

/** The embedded heimdall's key routes (and /bridge/*) want the bridge's access cookie, which heimdall's OWN page (/heimdall/link/) sets
 *  (HttpOnly, SameSite=Strict, Path=/heimdall). The page and the bridge share one origin, so the page may ask for it — but only when a
 *  route has just said 401, never on load, and only ONCE per call: `linked` runs `call`, and on a 401 fetches the link page and runs `call`
 *  again. The retry's response carries `linkTried`; a link that did not help is reported as a 401, never as "not answering". Nothing
 *  here reads, stores or logs the token (HttpOnly: the page cannot see it), and the key is never in the link request. */
async function linked(fetchImpl, base, call) {
  let r = await call();
  if (r.status !== 401) return r;
  try { await fetchImpl(bridgeBase(base) + "/link/", { cache: "no-store", credentials: "same-origin" }); } catch { /* the retry will say what happened */ }
  r = await call();
  try { r.linkTried = true; } catch { /* a frozen Response: the status still says it */ }
  return r;
}

/** Store a provider API key (anthropic, openai, …) SERVER-SIDE on this machine.
 *  The key is posted to the localhost bridge, written beside the CLI's own
 *  state, and never echoed back — the page keeps nothing. `remove:true` clears
 *  it. Returns { ok, provider, stored, configured, frontierModels }. */
export async function setProviderKey(provider, key, { base = null, remove = false, fetchImpl = fetch } = {}) {
  const r = await linked(fetchImpl, base, () => fetchImpl(bridgeBase(base) + "/api/providers/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(remove ? { provider, remove: true } : { provider, key }),
  }));
  if (!r.ok) {
    let msg = "heimdall refused the key";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; if (r.linkTried) err.linkTried = true; throw err;
  }
  return r.json();
}

/** Remove a stored provider key from this machine. */
export function removeProviderKey(provider, { base = null, fetchImpl = fetch } = {}) {
  return setProviderKey(provider, null, { base, remove: true, fetchImpl });
}

/** "Test again": heimdall re-tests the key it ALREADY holds (this page never has it)
 *  and answers in plain words. Same shape as setProviderKey. A heimdall that predates
 *  the check rejects with status 404. */
export async function testProviderKey(provider, { base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/providers/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
  if (!r.ok) {
    let msg = "heimdall could not test the key";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Ask a running heimdall to load the keys it already holds (key-free). Resolves
 *  { ok, models } or rejects with status 404 when that heimdall is too old to know how. */
export async function reloadProviderKeys({ base = null, fetchImpl = fetch } = {}) {
  const r = await linked(fetchImpl, base, () => fetchImpl(bridgeBase(base) + "/api/providers/refresh", { method: "POST" }));
  if (!r.ok) { const err = new Error("heimdall could not reload its keys"); err.status = r.status; if (r.linkTried) err.linkTried = true; throw err; }
  return r.json();
}

export const PROVIDER_NAMES = { anthropic: "Anthropic", openai: "OpenAI", openrouter: "OpenRouter", together: "Together", fireworks: "Fireworks", deepinfra: "DeepInfra" };
export const providerLabel = (p) => PROVIDER_NAMES[p] || (p ? p[0].toUpperCase() + p.slice(1) : "The provider");

/** Where one provider's key stands, from the app's point of view: is a key stored,
 *  and has the running heimdall LOADED it (does the model list show a sealed model
 *  from that provider)? A key can be saved yet not loaded — a heimdall that started
 *  before the key, or one that could not reload. Pure.
 *  Returns { state: "not_saved" | "saved_not_loaded" | "loaded", models: [ids], masked } */
export function keyLoadState(provider, { stored = [], models = [] } = {}) {
  const entry = (Array.isArray(stored) ? stored : []).find((p) => p?.provider === provider && p.set !== false);
  const mine = (Array.isArray(models) ? models : []).filter((m) => m?.sealed && m.provider === provider).map((m) => m.id);
  if (mine.length) return { state: "loaded", models: mine, masked: entry?.masked || "" };
  return { state: entry ? "saved_not_loaded" : "not_saved", models: [], masked: entry?.masked || "" };
}

/** Plain-language result of adding (or re-testing) a key, for the settings panel.
 *  heimdall writes the wording itself (its `report`); this adds the one thing only the
 *  app can know — whether its own model list now shows the provider — and covers a
 *  heimdall too old to test. `models` is the app's refreshed model list.
 *  Returns { tone: "ok"|"warn"|"bad", headline, lines: [string], ok }. Never contains a key. */
export function describeKeyResult(provider, resp, { models = null } = {}) {
  const name = providerLabel(provider);
  const rep = resp?.report;
  if (!rep) {
    // An older heimdall: it stored the key but cannot test it or say what loaded.
    const n = Number(resp?.frontierModels) || 0;
    const lines = [
      `Saved on this computer${resp?.masked ? ` (${resp.masked})` : ""}. This heimdall is an older version, so it cannot test the key or say what it unlocked.`,
      n > 0
        ? `It reports ${n} outside model${n === 1 ? "" : "s"} reachable now. Look under "Frontier · sealed" in the model list.`
        : `It is not offering any ${name} model yet. Restart heimdall (stop it, then: heimdall up) so it loads the key. The key is saved, nothing is lost.`,
    ];
    return { tone: "warn", headline: `${name} key saved, but it was not tested`, lines, ok: false };
  }
  const lines = [...(rep.lines || [])];
  let tone = rep.tone || (rep.ok ? "ok" : "warn");
  if (rep.ok && Array.isArray(models)) {
    const seen = models.filter((m) => m?.sealed && m.provider === provider);
    if (!seen.length) {
      tone = "warn";
      lines.push(`The key works, but this page's model list does not show any ${name} model yet. Press "Detect" next to the heimdall address, or reload the page.`);
    }
  }
  return { tone, headline: rep.headline || `${name} key`, lines, ok: !!rep.ok && tone === "ok" };
}

/** Split a machine-door answer into prose and any TOOL CALLS the door returned
 *  AS TEXT. A small coding model sometimes emits the call itself
 *  (`{"name": "write", "arguments": {"content": …, "filePath": …}}`) in a text
 *  part instead of letting the door execute it — measured live against
 *  qwen2.5-coder:1.5b. That is a tool INVOCATION, not the answer: it must never
 *  render as prose. Returns { text, calls:[{name, arguments}], leftover }. Pure
 *  and testable. A fenced code block is prose and is kept whole. */
export function splitToolCalls(answer) {
  const raw = String(answer ?? "");
  const calls = [];
  const tryParse = (s) => {
    try { const j = JSON.parse(s); if (j && typeof j.name === "string" && ("arguments" in j || "args" in j)) { calls.push({ name: j.name, arguments: j.arguments ?? j.args ?? {} }); return true; } } catch {}
    return false;
  };
  // Balanced-brace scan, skipping braces inside strings, so a JSON object in a
  // sentence is not mistaken for the end of one and a fenced block is untouched
  // only if it is not a bare call. Fenced blocks are protected first.
  const fences = [];
  let work = raw.replace(/```[\s\S]*?```/g, (m) => { fences.push(m); return `\u0000${fences.length - 1}\u0000`; });
  let out = "", i = 0;
  while (i < work.length) {
    const open = work.indexOf("{", i);
    if (open < 0) { out += work.slice(i); break; }
    let depth = 0, j = open, inStr = false, esc = false, closed = -1;
    for (; j < work.length; j++) {
      const c = work[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { closed = j; break; } }
    }
    if (closed < 0) { out += work.slice(i); break; }
    const chunk = work.slice(open, closed + 1);
    if (tryParse(chunk)) { out += work.slice(i, open); i = closed + 1; }
    else { out += work.slice(i, open + 1); i = open + 1; }
  }
  out = out.replace(/\u0000(\d+)\u0000/g, (_, n) => fences[+n]);
  return { text: out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), calls, leftover: raw };
}

/** Extract a fenced behavioral test the person attached to a code turn, e.g.
 *    test:
 *    ```js
 *    const before=[3,1,2]; const m=__m.median(before); ...
 *    ```
 *  Returns { test } or null. The fold sends it as `verification` so the
 *  pipeline runs a REAL test (a local draw that fails it walls and escalates
 *  to the frontier mouth at the wall). Pure and testable. */
export function extractVerification(text) {
  const t = String(text ?? "");
  const labeled = t.match(/^\s*(?:test|verify)\s*:\s*\n\s*```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n\s*```/im);
  if (labeled) return { test: labeled[1].trim() };
  const fenced = t.match(/```(?:js|javascript|mjs|ts)\n([\s\S]*?)\n```\s*\n?\s*(?:test|verify)\s*$/im);
  if (fenced) return { test: fenced[1].trim() };
  return null;
}

/** Whether a coding machine (opencode) is attached behind the bridge. */
export async function codeStatus({ base = null, fetchImpl = fetch } = {}) {
  try { const r = await fetchImpl(bridgeBase(base) + "/api/code/status", { cache: "no-store" }); return r.ok ? r.json() : null; }
  catch (e) { return null; }
}

/** Run one coding job THROUGH heimdall — the bridge dispatches to the local
 *  machine door (the khora conductor, or a raw opencode server), whose own
 *  model calls are routed by the bridge. The chat never talks to the door
 *  directly. `cwd` binds the job to the project's folder when given, so the
 *  door reads and edits the same place the project stands. Returns
 *  { sessionId, text, activity, ms, lane }. */
export async function code(prompt, { base = null, title = null, model = null, agent = null, sessionId = null, cwd = null, verification = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, title, model, agent, sessionId, cwd, verification }),
    signal,
  });
  if (!r.ok) {
    let msg = "the coding machine did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Generate an artifact THROUGH heimdall — the bridge routes the turn to
 *  penelope's generation system (the weave): void detection (units read from
 *  the ask, a void read with a hunt) and writing across prompts (one unit per
 *  draw, field → hunt → mouth, test decides). The chat never talks to penelope
 *  directly. Returns the Weaving@1 result — artifact, void, evidence (units,
 *  outcomes), verification. */
export async function generate(intent, { base = null, artifact = "text", model = null, noModel = false, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/weave", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent, artifact, model, noModel }),
    signal,
  });
  if (!r.ok) {
    let msg = "penelope's generation did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Read a document THROUGH the khora (the perceiver), never forwarded raw.
 *  Returns EORead@1 — referents, relations, basis. The surface shows the
 *  reading; a model never receives the raw file. */
export async function read(text, { base = null, source = null, sessionId = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, source, sessionId }),
    signal,
  });
  if (!r.ok) {
    let msg = "the khora read did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}
/** Ask JANUS — the reasoner — whether a set of claims holds, THROUGH heimdall.
 *  The spec is the khora's reasoning input (claims, universals with their
 *  measured counterexamples, equations, orderings); the engine's own organs
 *  decide, and the verdict comes back as { ok, errors, findings:[{kind,
 *  severity, detail, at}] }. The reasoner never grades itself. */
export async function reason(spec, { base = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/reason", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(spec),
    signal,
  });
  if (!r.ok) {
    let msg = "janus's reasoning check did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Run the khora's OPEN coding loop THROUGH heimdall: several turns of list /
 *  read / write / run inside a severed sandbox (in-memory files, a vm with no
 *  disk and no egress). Returns { done, answer, rounds, files, notes }. */
export async function agent(task, { base = null, model = null, maxTurns = null, sessionId = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, model, maxTurns, sessionId }),
    signal,
  });
  if (!r.ok) {
    let msg = "the khora's agent loop did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Shape the khora agent's result like a machine-door answer, so the same loop
 *  can observe it. The main file is the page (index.html), else any .html, else
 *  the first script, else the largest file; the loop's notes become tool steps.
 *  Pure and testable. */
export function agentAnswerOf(result, { sessionId = null, ms = null } = {}) {
  const files = result && typeof result.files === "object" && result.files ? result.files : {};
  const names = Object.keys(files);
  const pick = names.find((n) => /(^|\/)index\.html?$/i.test(n)) || names.find((n) => /\.html?$/i.test(n)) || names.find((n) => /\.(m?js|ts)$/i.test(n)) || [...names].sort((a, b) => String(files[b]).length - String(files[a]).length)[0] || null;
  const notes = Array.isArray(result?.notes) ? result.notes : [];
  const activity = notes.filter((n) => n && typeof n.move === "string" && /^agent_/.test(n.move)).map((n) => {
    const tool = n.move.replace(/^agent_/, "");
    const title = n.path || (n.move === "agent_list" ? `${(n.files || []).length} file(s)` : n.move === "agent_run" ? `${n.ok ? "ran clean" : "failed"} · ${n.outputChars ?? 0} chars of output` : n.move === "agent_done" ? `${n.answerChars ?? 0} chars` : null);
    return { tool, status: /refused|miss/.test(tool) ? "refused" : n.move === "agent_run" && n.ok === false ? "failed" : "done", title: title ? (n.contentChars != null ? `${title} (${n.contentChars} chars)` : title) : null };
  });
  return {
    sessionId, text: pick ? String(files[pick]) : String(result?.answer ?? ""), activity, ms,
    lane: "khora-agent", executed: true, files, mainFile: pick,
    agents: { done: !!result?.done, turns: Array.isArray(result?.rounds) ? result.rounds.length : 0, answer: result?.answer ?? "" },
  };
}

// ───────────────────────── escalation to a sealed remote model ─────────────────────────
//
// When the local machine is busy, slow, or draws nothing, the agent does not sit
// and wait: it goes to an OUTSIDE model — but only through heimdall's sealed
// gate (heimdall_privacy:"sealed-external"). What rides the wire is the person's
// own task text and the previous attempt's code; never a workspace file.

// Models that list as frontier but are not text/code writers (audio, roleplay,
// image), and duplicate provider-prefixed aliases that the bridge rejects.
const NOT_A_CODE_WRITER = /voxtral|lunaris|whisper|tts|image|chroma|embed|roleplay|^llm7:/i;
// The order the Fold prefers: measured fast and reachable first. The bridge's
// /api/tags lists models that do not all answer, so the caller TRIES these in
// order and keeps the first that does.
const REMOTE_PREFERENCE = [/^(openrouter|together|fireworks|deepinfra):/, /^openai-fast$/, /^GLM-[\d.]+-Flash$/i, /^pollinations:openai-fast$/, /claude.*haiku/i, /deepseek.*flash/i, /sonnet/i];

// What a remote model did the last time it was asked, kept for this page's life so the app stops asking the same dead door.
// A 404 means the bridge does not actually serve it (it only LISTS it): skip for 30 minutes. A timeout or an empty answer is
// worth another go soon: 5 minutes. The model that last answered goes first.
// It is kept in localStorage too (best effort), so a reload does not forget which doors are dead.
const HEALTH_KEY = "fold-chat:modelhealth";
const modelHealth = new Map();   // id → { until, why }
let lastGoodModel = null, healthLoaded = false;
const store = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };
function loadHealth(now = Date.now()) {
  if (healthLoaded) return; healthLoaded = true;
  try { const j = JSON.parse(store()?.getItem(HEALTH_KEY) || "null"); if (j && typeof j === "object") { for (const [id, h] of Object.entries(j.dead || {})) if (h && h.until > now) modelHealth.set(id, h); if (typeof j.good === "string") lastGoodModel = j.good; } } catch { /* a corrupt note is no note */ }
}
function saveHealth() { try { store()?.setItem(HEALTH_KEY, JSON.stringify({ dead: Object.fromEntries(modelHealth), good: lastGoodModel })); } catch { /* storage may be unavailable */ } }
export function noteModelHealth(model, outcome, { now = Date.now() } = {}) {
  loadHealth(now);
  if (outcome === "ok") { lastGoodModel = model; modelHealth.delete(model); saveHealth(); return; }
  const ms = outcome === "404" || outcome === "quota" ? 30 * 60_000 : 5 * 60_000;   // not served / out of daily quota: no point asking again soon
  modelHealth.set(model, { until: now + ms, why: outcome });
  saveHealth();
}
export function resetModelHealth() { modelHealth.clear(); lastGoodModel = null; healthLoaded = true; try { store()?.removeItem(HEALTH_KEY); } catch { /* ignore */ } }
export const outcomeOfError = (e) => { const m = String(e?.message || e); return /\b404\b/.test(m) ? "404" : /\b429\b|quota|rate.?limit/i.test(m) ? "quota" : /timed out|timeout/i.test(m) ? "timeout" : "error"; };

/** The sealed remote models worth trying for a code draw, best first. Pure (the memory above is read, never written, here).
 *  `provider:model` and the bare `model` are one endpoint under two names — only one is kept. */
export function remoteCandidates(models, { now = Date.now() } = {}) {
  loadHealth(now);
  const sealed = (Array.isArray(models) ? models : []).filter((m) => m && m.sealed && !NOT_A_CODE_WRITER.test(String(m.id)));
  const ids = new Set(sealed.map((m) => String(m.id)));
  const bare = (id) => (id.includes(":") && !/^[^:]*\d/.test(id) ? id.slice(id.indexOf(":") + 1) : id);   // "pollinations:openai-fast" → "openai-fast"; "gemma4:31b" keeps its tag
  // a hosted provider's lane is ALWAYS its prefixed id: the same small model on two providers is two lanes (so they can race), never one
  const unique = sealed.filter((m) => { const id = String(m.id); if (HOSTED_PROVIDERS.includes(m.provider)) return id.startsWith(m.provider + ":"); const b = bare(id); return b === id || !ids.has(b); });
  const alive = unique.filter((m) => { const h = modelHealth.get(String(m.id)); return !h || h.until <= now; });
  const ranked = [];
  if (lastGoodModel && alive.some((m) => m.id === lastGoodModel)) ranked.push(lastGoodModel);
  for (const re of REMOTE_PREFERENCE) for (const m of alive) if (re.test(String(m.id)) && !ranked.includes(m.id)) ranked.push(m.id);
  for (const m of alive) if (!ranked.includes(m.id)) ranked.push(m.id);
  return ranked;
}

const REMOTE_CODE_SYSTEM = "You are a careful senior engineer. Do exactly what the task asks and return ONE complete, self-contained file — no explanation, no commentary. If the task is a web page, return a single HTML document with its CSS and JavaScript inline. Put the file in a single fenced code block.";

/** One sealed remote draw for a code task. Sends `candidates` out `race` at a time (default 3, all at once; the first answer wins and the
 *  rest are cancelled) — each with its own short deadline — and returns the first that answers:
 *  { text, model, tried:[{model, error}] }. `prior` is the previous attempt's
 *  code (a repair carries it, so the remote model fixes rather than restarts).
 *
 *  The task and the prior code are DE-IDENTIFIED before they leave (fold-chat-deid.js):
 *  names, paths, emails, keys and everything in `taint` become placeholders, the
 *  map stays here, and the reply is mapped back before it is returned. If a scan of
 *  the masked bytes still finds a private detail, nothing is sent. `mask:false`
 *  sends as written (graded "gate", raw) — only for a caller that means to.
 *  `redact(texts) → spans[][]` is the local Python PII redactor (fold-chat-redact.js): it judges, is asked again about the
 *  masked result, and when it is supplied but unreachable NOTHING is sent. `mode` is "default" or "open" (fold-chat-deid.js).
 *  `readNames(text) → [surface]` is the holograph's read of the request (khora referents, local):
 *  what the request NAMES is masked even when the Fold never saw it before. A read that fails or
 *  comes back empty (it does for one-liners) falls back to namesIn(), capitalised multi-word names. */
export async function remoteCode(prompt, { candidates, prior = null, base = null, signal = null, perModelMs = 40000, maxTokens = 4096, onTry = null, run = null, taint = null, mask = true, mode = "default", redact = null, readNames = null, readTimeoutMs = 4000, race = 3, fetchImpl = fetch } = {}) {
  const tried = [];
  // Every part of the request says where it came from — the audit grades the
  // request from this, and refuses what it cannot place.
  const parts = [{ role: "system", content: REMOTE_CODE_SYSTEM, provenance: "template" }];
  if (prior) parts.push({ role: "user", content: "Here is the previous attempt:\n```\n" + String(prior).slice(0, 24000) + "\n```", provenance: "generated" });
  parts.push({ role: "user", content: prompt, provenance: "ask" });
  let deid = null, viaRedactor = false;
  if (mask) {
    // The khora's read (capitals only) and namesIn are extra nominators; the Python redactor is the judge, and is asked again about the masked result.
    const asked = parts.filter((p) => p.provenance !== "template").map((p) => p.content).join("\n\n");
    let named = [], viaRead = false;
    if (typeof readNames === "function") {
      try { named = await Promise.race([Promise.resolve(readNames(asked)), new Promise((_, rej) => setTimeout(() => rej(new Error("read deadline")), readTimeoutMs))]) || []; viaRead = named.length > 0; } catch { named = []; }
    }
    named = [...new Set([...named, ...namesIn(asked)])].map((term) => ({ term, kind: "name" }));
    const own = parts.map((p, i) => i).filter((i) => parts[i].provenance !== "template");   // the Fold's own instructions are not the person's
    const out = await deidentify(own.map((i) => parts[i].content), { taint, extra: named, mode, redact });
    deid = out.deid; deid.viaRead = viaRead; viaRedactor = out.viaRedactor;
    // "masked" is only claimed when the redactor judged it; without one the floor ran and the content keeps its honest provenance.
    own.forEach((i, k) => { parts[i] = { ...parts[i], content: out.texts[k], provenance: viaRedactor ? "masked" : parts[i].provenance }; });
  }
  const messages = parts.map(({ role, content }) => ({ role, content }));
  const segments = parts.map((p) => ({ role: p.role, chars: p.content.length, provenance: p.provenance }));
  const sent = [];
  // ONE attempt at one model. Resolves { text, model, auditId } or null (answered nothing / failed / was cancelled because another lane won).
  const attempt = async (model, ctl) => {
    const auditId = newAuditId();
    sent.push({ auditId, model });
    onTry?.(model, auditId);
    const sig = signal ? anySignal([signal, ctl.signal]) : ctl.signal;
    try {
      const out = await chat(model, messages, { base, privacy: "sealed-external", signal: sig, temperature: 0.2, maxTokens, totalTimeoutMs: perModelMs, fetchImpl, audit: { id: auditId, segments, purpose: "escalated code draw", run, masking: deid ? { ...deid.stats(), viaRead: !!deid.viaRead } : null } });
      const text = String(deid ? deid.unmask(out?.text ?? "") : out?.text ?? "").trim();
      if (text) { noteModelHealth(model, "ok"); return { text, model, auditId }; }
      noteModelHealth(model, "empty");
      tried.push({ model, error: "answered with nothing" });
    } catch (e) {
      if (signal?.aborted) throw Object.assign(e, { name: "AbortError" });
      if (ctl.signal.aborted) return null;   // another lane won and this one was cancelled: not a failure, not a health mark
      noteModelHealth(model, outcomeOfError(e));
      tried.push({ model, error: String(e?.message || e).slice(0, 120) });
    }
    return null;
  };
  // The candidates go out `race` at a time, all at once, and the FIRST answer wins: the others are cancelled at once (heimdall stops
  // the provider call, so their tokens are not spent). No answer from the whole batch moves on to the next batch.
  const width = Math.max(1, Math.floor(race) || 1);
  const list = candidates || [];
  for (let at = 0; at < list.length; at += width) {
    if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    const batch = list.slice(at, at + width);
    const ctls = batch.map(() => new AbortController());
    const winner = await new Promise((resolve, reject) => {
      let left = batch.length;
      batch.forEach((model, k) => attempt(model, ctls[k]).then((r) => {
        if (r) { ctls.forEach((c, j) => { if (j !== k) c.abort(); }); resolve(r); }
        else if (--left === 0) resolve(null);
      }, (e) => { ctls.forEach((c) => c.abort()); reject(e); }));
    });
    if (winner) return { text: winner.text, model: winner.model, tried, sent, auditId: winner.auditId, masked: deid ? { ...deid.stats(), viaRead: !!deid.viaRead } : null };
  }
  const err = new Error("no sealed remote model answered" + (tried.length ? " (" + tried.map((t) => `${t.model}: ${t.error}`).join("; ") + ")" : ""));
  err.status = 502; err.tried = tried; err.sent = sent;
  throw err;
}
