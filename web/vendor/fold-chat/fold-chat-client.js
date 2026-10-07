// fold-chat-client.js — The Fold's chat surface, speaking to Heimdall.
//
// The Fold's chat version is a browser page, not a server app. Its models and
// routing live on this machine: the heimdall bridge (localhost:8790) speaks
// the OpenAI wire, holds the fleet (phones, linked native hosts) and the
// configured remote/frontier providers, and ENFORCES the sealed-external gate
// for outside models. This module is the chat's half of that wire:
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

export const DEFAULT_BRIDGE = "http://localhost:8790";

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

/** Where heimdall is looked for, in order. A caller's stored/override base is
 *  tried first, then the standard local port on both names. */
export const BRIDGE_CANDIDATES = Object.freeze([
  "http://localhost:8790",
  "http://127.0.0.1:8790",
]);

/** The bridge a caller points at. Overridable (localStorage in the page,
 *  constructor arg in tests). */
export function bridgeBase(override = null) {
  return String(override || DEFAULT_BRIDGE).replace(/\/+$/, "");
}

/** Find the running heimdall bridge without the person typing it. Probes each
 *  candidate (the override first) with /bridge/hello, falling back to /api/tags
 *  for an older bridge. Returns { ok, base, hello } — never throws. */
export async function detectBridge({ override = null, candidates = BRIDGE_CANDIDATES, fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const list = [...new Set([...(override ? [override] : []), ...candidates].map(bridgeBase))];
  for (const base of list) {
    try {
      const r = await fetchImpl(base + "/bridge/hello", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) { const j = await r.json().catch(() => null); if (j && j.bridge) return { ok: true, base, hello: j }; }
    } catch {}
    try {
      const r = await fetchImpl(base + "/api/tags", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return { ok: true, base, hello: null };
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
 *  heimdall still routes whatever is picked. Pure and testable. */
export function autoPick(models) {
  const list = Array.isArray(models) ? models : [];
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
  if (m.sealed) return "frontier";
  const k = m.kind || String(m.provider || "");
  if (k === "webllm" || k === "local") return "local";
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

/** One chat turn over the bridge. SSE streams tokens to onToken(text); the
 *  resolved value is { text, tokens } (tokens counted per delta). A sealed
 *  model is forced sealed-external unless the caller chose "explicit".
 *  Rejects with { status, message } on bridge/provider errors. */
export async function chat(model, messages, { base = null, privacy = null, onToken = null, signal = null, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, totalTimeoutMs = 180000 } = {}) {
  const url = bridgeBase(base) + "/v1/chat/completions";
  // Sealed by default for outside models: the Fold selects the privacy mode
  // and seals first. Raw spans never leave — only what the caller put in
  // `messages` rides the wire.
  const effective = privacy ?? "sealed-external";
  const body = chatBody(model, messages, { privacy: effective, temperature, maxTokens });
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (e) {
    clearTimeout(timer);
    const timedOut = /timed out|abort/i.test(String(e?.message || e?.name || ""));
    const err = new Error(timedOut ? "the turn timed out (" + Math.round(totalTimeoutMs / 1000) + "s)" : "bridge unreachable: " + (e?.message || e));
    err.status = timedOut ? 504 : 0;
    throw err;
  }
  clearTimeout(timer);
  if (res.status === 400) {
    let msg = "heimdall refused the request";
    try { msg = (await res.json())?.error?.message || msg; } catch {}
    const err = new Error(msg);
    err.status = 400;
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
      if (j.error) { const err = new Error(j.error?.message || "bridge stream error"); err.status = 502; throw err; }
      const delta = j.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        text += delta;
        tokens++;
        onToken?.(delta);
      }
    }
  }
  return { text, tokens };
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

/** The sealed gate's shape: which providers are configured, and the rule. */
export async function frontier({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/frontier", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Which providers already have a key set on the machine (names only). */
export async function listProviderKeys({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/providers/keys", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Store a provider API key (anthropic, openai, …) SERVER-SIDE on this machine.
 *  The key is posted to the localhost bridge, written beside the CLI's own
 *  state, and never echoed back — the page keeps nothing. `remove:true` clears
 *  it. Returns { ok, provider, stored, configured, frontierModels }. */
export async function setProviderKey(provider, key, { base = null, remove = false, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/providers/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(remove ? { provider, remove: true } : { provider, key }),
  });
  if (!r.ok) {
    let msg = "heimdall refused the key";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}

/** Remove a stored provider key from this machine. */
export function removeProviderKey(provider, { base = null, fetchImpl = fetch } = {}) {
  return setProviderKey(provider, null, { base, remove: true, fetchImpl });
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
export async function code(prompt, { base = null, title = null, model = null, agent = null, sessionId = null, cwd = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, title, model, agent, sessionId, cwd }),
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