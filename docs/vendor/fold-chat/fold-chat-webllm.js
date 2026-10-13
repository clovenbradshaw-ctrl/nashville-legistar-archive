// fold-chat-webllm.js — the model IN THE PAGE (2026-10-05).
//
// There is no standalone bridge to lend the Fold a model. The model runs where the person is: @mlc-ai/web-llm on WebGPU, in this
// browser tab, in a module Worker so a generation never blocks the UI thread. Nothing here talks to a server: the weights come
// from the model host once, land in the browser's own cache, and every token after that is produced on the person's GPU. The
// model is never alone — this module only produces text; the fold's gate, grounding and snip/cite rules still decide what is said.
//
// WHAT IT OWNS
//   gpuStatus        measured from navigator.gpu.requestAdapter — never assumed, never throws; reason is a typed word.
//   createPageEngine load / chatStream / chat / abort / unload over the web-llm engine, with an INJECTABLE loader (the library
//                    is fetched lazily from a pinned CDN ESM URL — no bundle, no build step, nothing downloaded at page load)
//                    and an injectable makeWorker (null = run on the main thread).
//   pageModels       the engine's models shaped like the bridge's listModels() entries, so the app's picker can merge them.
//
// COST HONESTY. Importing this file downloads nothing. load() is the only thing that fetches the library or weights, and the
// caller calls it only when the person chooses an in-page model or sends with one selected. Each model carries an approximate
// download size; cached() says "already downloaded" without loading the 6 MB library unless asked to probe.
//
// MIRRORS heimdall/src/llm.js + models.js (another repo — read only, not importable from a static page): MODEL_CHOICES ids,
// DEFAULT/FALLBACK, the f16/f32 rule and the Ollama tag mapping. The test compares the tables with the sibling checkout when
// it is on disk, so a drift fails loudly instead of silently picking a different model.
//
// FAILURE HONESTY (2026-10-05 review). A chosen model that will not load falls back to the small FALLBACK_MODEL ONLY when that one
// is already on this device (a fallback is never a silent ~900 MB download); otherwise the typed load-failed error goes to the app,
// which asks. A settled fallback is remembered for the session (no reload of the failed model every turn). A load waits at most drainMs (1.5 s)
// for a running generation before it drops the engine: that does NOT protect a long answer — the switch cuts it, and the generation then
// ends with finish "abort" so the caller says so (a typed 'replaced mid-answer' error) instead of shipping a truncated answer. A worker that cannot start (error event) or goes silent (no-progress watchdog) rejects,
// clears the load queue and is retried once on the main thread.
//
// WOULD PROVE IT WRONG: a GPU-less device that is offered an in-page model; a chat that throws instead of returning a typed
// not-loaded error; a second load() that downloads twice; an abort that leaves the stream (or the engine) hanging; a failed
// load that wedges the engine so the next load() cannot start; a model picked on a no-shader-f16 adapter that is not the f32
// build. fold-chat-webllm.test.mjs pins each against a fake loader/engine (no GPU, no network).

export const WEBLLM_VERSION = "0.2.85";
// Pinned. Verified 2026-10-05: HEAD 200, and the ESM exports CreateMLCEngine, CreateWebWorkerMLCEngine,
// WebWorkerMLCEngineHandler, hasModelInCache and prebuiltAppConfig. fold-webllm-worker.js imports the same URL (a test checks).
export const WEBLLM_ESM_URL = `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${WEBLLM_VERSION}/+esm`;

/** WebLLM id → Ollama tag (the names the rest of the suite uses). Both quantizations of a model map to one tag. */
export const OLLAMA_TAG = Object.freeze({
  "gemma-2-2b-it-q4f16_1-MLC": "gemma2:2b",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "qwen2.5:0.5b",
  "Qwen3-1.7B-q4f16_1-MLC": "qwen3:1.7b",
  "SmolLM2-360M-Instruct-q4f16_1-MLC": "smollm2:360m",
  "SmolLM2-1.7B-Instruct-q4f16_1-MLC": "smollm2:1.7b",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "llama3.2:1b",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC": "llama3.2:3b",
  "Qwen3-4B-q4f16_1-MLC": "qwen3:4b",
});

const F16 = "q4f16_1";
const F32 = "q4f32_1";

/** The WebLLM id of the same model in the f32 quantization — for an adapter without shader-f16. */
export function f32Variant(id) {
  return typeof id === "string" ? id.replace(F16, F32) : id;
}
/** The Ollama tag a WebLLM id answers to (either quantization), or null. */
export function ollamaTagOf(id) {
  if (typeof id !== "string") return null;
  return OLLAMA_TAG[id] ?? OLLAMA_TAG[id.replace(F32, F16)] ?? null;
}

// sizeMB is APPROXIMATE (the download, from the model host's own sizes); it is shown as a "~" label, never as a promise.
const CHOICES = [
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B — matches the computer's default (gemma2:2b)", sizeMB: 1900, default: true },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 0.5B — fast, low-memory", sizeMB: 900 },
  { id: "Qwen3-1.7B-q4f16_1-MLC", label: "Qwen 3 1.7B", sizeMB: 2000 },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M — tiny", sizeMB: 400 },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B", sizeMB: 1800 },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B — balanced", sizeMB: 900 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B — desktop only", sizeMB: 2300, desktopOnly: true },
  { id: "Qwen3-4B-q4f16_1-MLC", label: "Qwen 3 4B — desktop only", sizeMB: 3400, desktopOnly: true },
];
const sizeLabelOf = (mb) => `~${mb >= 1000 ? (mb / 1000).toFixed(1).replace(/\.0$/, "") + " GB" : mb + " MB"}`;
export const MODEL_CHOICES = Object.freeze(CHOICES.map((m) => Object.freeze({ ...m, sizeLabel: sizeLabelOf(m.sizeMB), tag: ollamaTagOf(m.id) })));
export const DEFAULT_MODEL = MODEL_CHOICES.find((m) => m.default).id;
/** The small model a device falls back to, ONCE, when the chosen one will not load. */
export const FALLBACK_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export const PAGE_PREFIX = "webllm:";
const CACHE_KEY = "fold.webllm.downloaded";

/** A typed failure. `kind`: not-loaded | no-gpu | loader | load-failed | generate-failed | bad-request. Never an unhandled throw. */
export class PageEngineError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = "PageEngineError";
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/** What this device can run, measured from the adapter. { available, f16, reason } — reason: 'ok' | 'no-webgpu' | 'no-adapter'. */
export async function gpuStatus({ nav = globalThis.navigator } = {}) {
  try {
    const gpu = nav?.gpu;
    if (!gpu || typeof gpu.requestAdapter !== "function") return { available: false, f16: false, reason: "no-webgpu" };
    let adapter = null;
    try { adapter = await gpu.requestAdapter(); } catch { adapter = null; }
    if (!adapter) return { available: false, f16: false, reason: "no-adapter" };
    let f16 = false;
    try { f16 = !!adapter.features?.has?.("shader-f16"); } catch { f16 = false; }
    return { available: true, f16, reason: "ok" };
  } catch {
    return { available: false, f16: false, reason: "no-webgpu" };
  }
}

/** The canonical (f16) id the app uses for any spelling of a model: 'webllm:<id>', the f32 build, or the id itself. */
export function canonicalModelId(id) {
  let s = String(id ?? "");
  if (s.startsWith(PAGE_PREFIX)) s = s.slice(PAGE_PREFIX.length);
  if (MODEL_CHOICES.some((m) => m.id === s)) return s;
  const asF16 = s.replace(F32, F16);
  return MODEL_CHOICES.some((m) => m.id === asF16) ? asF16 : s;
}

// web-llm reports progress as text ("Fetching param cache[3/24]: ...", "Loading GPU shader modules[1/20]: ..."). The phase is a
// coarse label for the UI, read off that library's own wording; anything else is just 'init'.
const phaseOf = (text) => (typeof text === "string" && text.startsWith("Fetching") ? "download" : "init");
const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ABORTED = Symbol("aborted");

function defaultMakeWorker() {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("./fold-webllm-worker.js", import.meta.url), { type: "module" });
}

/**
 * The in-page engine. Everything environmental is injectable:
 *   loader       async () => the web-llm module. Default: dynamic import of WEBLLM_ESM_URL (lazy, memoized only on success).
 *   makeWorker   () => Worker. undefined = the default module Worker; null = run on the main thread. A makeWorker that throws
 *                (no module-Worker support) falls back to the main thread.
 *   gpu          a gpuStatus() result, or an async () => result. Default: measured from navigator.
 *   storage      { getItem, setItem } — remembers which models this page has downloaded (a HINT; cached() can probe the truth).
 *   onProgress   ({ progress 0..1, text, phase }) during load().
 *   drainMs      how long a load waits for a running generation, and how long an abort waits for the engine to unwind.
 *   watchdogMs   a load that has reported NO progress at all for this long is rejected (the worker is terminated): a dead worker or a blocked runtime.
 *   downloadWatchdogMs   once the first progress tick has arrived (the weights are being fetched) the bound is this longer one, reset on every tick.
 *                web-llm ticks once per COMPLETED SHARD (shards run up to ~200 MB), not per byte, so a flat 90 s would kill a slow but healthy download.
 *                DECLARED, not measured: 15 min; giver: the author, from web-llm 0.2.85's shard sizes and a 2 Mbit/s floor.
 */
export function createPageEngine({ loader = null, makeWorker, onProgress = null, storage = null, gpu = null, nav = undefined, sleep = defaultSleep, drainMs = 1500, watchdogMs = 90000, downloadWatchdogMs = 900000 } = {}) {
  const loadModule = loader || (() => import(/* @vite-ignore */ WEBLLM_ESM_URL));
  const mkWorker = makeWorker === undefined ? defaultMakeWorker : makeWorker;

  let modPromise = null;
  let gpuPromise = null;
  let engine = null; // the live web-llm engine
  let worker = null;
  let loadedCanon = null; // the id the app asked for (canonical f16 spelling)
  let runnable = null; // the build actually running (f32 on an adapter without shader-f16)
  let fellBackFrom = null;
  let lastError = null;
  const pending = new Map(); // canonical id -> shared load promise
  let tail = Promise.resolve(); // loads run one at a time, in order
  let chatTail = Promise.resolve(); // one generation at a time on one engine
  let busy = 0; // generations queued or running (a load waits for them, bounded, before it drops the engine)

  const report = (p) => { try { onProgress?.(p); } catch { /* a progress listener must not break a load */ } };
  const hint = () => {
    try { const j = JSON.parse(storage?.getItem?.(CACHE_KEY) || "[]"); return Array.isArray(j) ? j : []; } catch { return []; }
  };
  const remember = (id) => {
    try { const set = new Set(hint()); set.add(id); storage?.setItem?.(CACHE_KEY, JSON.stringify([...set])); } catch { /* storage may be blocked */ }
  };

  const getGpu = () => {
    if (!gpuPromise) {
      gpuPromise = Promise.resolve(typeof gpu === "function" ? gpu() : gpu || gpuStatus(nav === undefined ? {} : { nav }))
        .then((g) => g || { available: false, f16: false, reason: "no-adapter" })
        .catch(() => ({ available: false, f16: false, reason: "no-adapter" }));
    }
    return gpuPromise;
  };
  const getModule = () => {
    if (!modPromise) {
      modPromise = Promise.resolve().then(loadModule).then((m) => {
        if (!m || typeof m !== "object") throw new Error("the web-llm module did not load");
        return m;
      });
      modPromise.catch(() => { modPromise = null; }); // a failed import is retried next time, never cached
    }
    return modPromise;
  };

  async function dropEngine() {
    const old = engine;
    const w = worker;
    engine = null; worker = null; loadedCanon = null; runnable = null; fellBackFrom = null;
    try { old?.interruptGenerate?.(); } catch { /* nothing running */ }
    try { await old?.unload?.(); } catch { /* freeing is best effort */ }
    try { w?.terminate?.(); } catch { /* already gone */ }
  }

  // Subscribe to a worker event without disturbing web-llm's own onmessage; returns the unsubscribe.
  const listen = (target, type, fn) => {
    if (typeof target?.addEventListener === "function") { target.addEventListener(type, fn); return () => target.removeEventListener?.(type, fn); }
    const k = "on" + type; const prev = target[k]; target[k] = fn;
    return () => { if (target[k] === fn) target[k] = prev; };
  };

  // One creation attempt, raced against the worker's own failure events and a no-progress watchdog. Resolves { eng, w };
  // rejects with the engine's error, or a PageEngineError carrying workerStart:true when the worker never got going.
  function attempt(mod, build, appConfig, useWorker) {
    let w = null;
    if (useWorker) { try { w = mkWorker ? mkWorker() : null; } catch { w = null; } }
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let progressed = false;
      const detach = [];
      const settle = (fn, v) => {
        if (settled) return false;
        settled = true; clearTimeout(timer);
        for (const d of detach) { try { d(); } catch { /* already detached */ } }
        fn(v);
        return true;
      };
      const stopWorker = () => { try { w?.terminate?.(); } catch { /* nothing to stop */ } };
      const fail = (err) => { if (settle(reject, err)) stopWorker(); };
      const arm = () => {
        clearTimeout(timer);
        const bound = progressed ? downloadWatchdogMs : watchdogMs;   // before the first tick: a dead worker; after it: a (possibly slow) download
        timer = setTimeout(() => fail(new PageEngineError("load-failed", `the in-tab model made no progress for ${Math.max(1, Math.round(bound / 1000))}s and was stopped`, { watchdog: true, workerStart: !!w && !progressed })), bound);
      };
      const cfg = { initProgressCallback: (r) => {
        if (settled) return;
        progressed = true; arm();
        report({ progress: clamp01(r?.progress), text: String(r?.text ?? ""), phase: phaseOf(r?.text) });
      } };
      if (appConfig) cfg.appConfig = appConfig;
      if (w) {
        const onBad = (what) => (ev) => fail(new PageEngineError("loader", `the in-tab model worker could not start (${what}): ${ev?.message || ev?.error?.message || "no detail"}`, { workerStart: true }));
        try { detach.push(listen(w, "error", onBad("error"))); detach.push(listen(w, "messageerror", onBad("messageerror"))); } catch { /* a worker we cannot listen to is watched by the watchdog */ }
      }
      arm();
      let created;
      try { created = Promise.resolve(w ? mod.CreateWebWorkerMLCEngine(w, build, cfg) : mod.CreateMLCEngine(build, cfg)); } catch (e) { created = Promise.reject(e); }
      created.then(
        (eng) => { if (!settle(resolve, { eng, w })) { try { Promise.resolve(eng?.unload?.()).catch(() => {}); } catch { /* a late engine is freed, best effort */ } } },
        (e) => { if (settle(reject, e)) stopWorker(); },
      );
    });
  }

  async function create(mod, canon, g) {
    const build = g.f16 ? canon : f32Variant(canon);
    let appConfig = null;
    if (mod.prebuiltAppConfig?.model_list) {
      const known = new Set(MODEL_CHOICES.flatMap((m) => [m.id, f32Variant(m.id)]));
      const list = mod.prebuiltAppConfig.model_list.filter((m) => known.has(m.model_id));
      if (list.some((m) => m.model_id === build)) appConfig = { ...mod.prebuiltAppConfig, model_list: list };
    }
    let r;
    try { r = await attempt(mod, build, appConfig, true); } catch (e) {
      if (!(e && e.workerStart)) throw e;
      // The worker never started (or went silent before its first word): try ONCE on the main thread.
      report({ progress: 0, text: "the model worker could not start; loading on the main thread", phase: "init" });
      r = await attempt(mod, build, appConfig, false);
    }
    engine = r.eng; worker = r.w; loadedCanon = canon; runnable = build;
  }

  async function doLoad(canon) {
    const g = await getGpu();
    if (!g.available) throw new PageEngineError("no-gpu", `no WebGPU for an in-page model (${g.reason})`, { reason: g.reason });
    report({ progress: 0, text: "loading the model runtime", phase: "module" });
    let mod;
    try { mod = await getModule(); } catch (e) {
      throw new PageEngineError("loader", `could not load web-llm: ${e?.message || e}`, { cause: e });
    }
    if (engine && loadedCanon === canon) return result(canon, null);
    if (engine && fellBackFrom === canon) return result(loadedCanon, fellBackFrom); // a settled fallback: no re-ask, no reload
    if (engine) {
      // A second model frees the first — but not under a running generation: wait for it (bounded), then drop.
      if (busy > 0) await Promise.race([chatTail, sleep(drainMs)]);
      await dropEngine();
    }
    try {
      await create(mod, canon, g);
      fellBackFrom = null;
    } catch (first) {
      if (canon === FALLBACK_MODEL) { lastError = first; throw new PageEngineError("load-failed", `${canon} would not load: ${first?.message || first}`, { modelId: canon, cause: first }); }
      // The fallback is used only when it is ALREADY on this device: never a silent ~900 MB download behind a failed load.
      // AUTHORITATIVE only: web-llm's own hasModelInCache. A localStorage hint can outlive an evicted cache and would turn this into a silent download.
      let have = false;
      try {
        const gg = await getGpu();
        have = typeof mod.hasModelInCache === "function" && !!(await mod.hasModelInCache(gg.f16 ? FALLBACK_MODEL : f32Variant(FALLBACK_MODEL), mod.prebuiltAppConfig));
      } catch { have = false; }
      if (!have) {
        lastError = first;
        throw new PageEngineError("load-failed", `${canon} would not load (${first?.message || first}); the small fallback model is not downloaded on this device, so nothing was fetched without asking`, { modelId: canon, cause: first, fallbackModel: FALLBACK_MODEL, fallbackAvailable: false });
      }
      report({ progress: 0, text: `${canon} would not load; trying ${FALLBACK_MODEL}`, phase: "fallback" });
      try {
        await create(mod, FALLBACK_MODEL, g);
        fellBackFrom = canon;
      } catch (second) {
        lastError = second;
        throw new PageEngineError("load-failed", `${canon} would not load (${first?.message || first}) and neither would ${FALLBACK_MODEL} (${second?.message || second})`, { modelId: canon, cause: first, fallbackCause: second });
      }
    }
    lastError = null;
    remember(loadedCanon);
    report({ progress: 1, text: "ready", phase: "ready" });
    return result(loadedCanon, fellBackFrom);
  }

  const result = (id, from) => ({ id, runnableId: runnable, fellBackFrom: from, tag: ollamaTagOf(id) });

  function load(modelId = DEFAULT_MODEL) {
    const canon = canonicalModelId(modelId || DEFAULT_MODEL);
    if (pending.has(canon)) return pending.get(canon);
    if (engine && loadedCanon === canon && pending.size === 0) return Promise.resolve(result(canon, fellBackFrom));
    if (engine && fellBackFrom === canon && pending.size === 0) return Promise.resolve(result(loadedCanon, fellBackFrom));
    const p = tail.catch(() => {}).then(() => doLoad(canon));
    pending.set(canon, p);
    tail = p;
    const clear = () => { if (pending.get(canon) === p) pending.delete(canon); };
    p.then(clear, clear);
    return p;
  }

  /** The generation, as an async iterator of text deltas. `meta` (optional) receives { finish, tokens } when it ends. */
  async function* stream(messages, opts = {}, meta = {}) {
    if (!engine) throw new PageEngineError("not-loaded", "no in-page model is loaded — load() one first");
    if (!Array.isArray(messages) || !messages.length) throw new PageEngineError("bad-request", "chat needs a non-empty messages array");
    const prior = chatTail;
    let release;
    chatTail = new Promise((r) => { release = r; });
    busy++;
    try { await prior; } catch { /* the queue never rejects */ }
    let eng = engine;
    let finish = "stop";
    let tokens = 0;
    let usageTokens = null;
    let aborted = false;
    let natural = false;
    let abortResolve;
    const abortP = new Promise((r) => { abortResolve = r; });
    const signal = opts.signal || null;
    const onAbort = () => {
      if (aborted) return;
      aborted = true;
      try { eng?.interruptGenerate?.(); } catch { /* it may have already finished */ }
      abortResolve(ABORTED);
    };
    let it = null;
    try {
      if (!eng) throw new PageEngineError("not-loaded", "the in-page model was unloaded");
      if (signal?.aborted) { aborted = true; finish = "abort"; return; }
      signal?.addEventListener?.("abort", onAbort, { once: true });
      const req = { messages, stream: true, stream_options: { include_usage: true } };
      const mt = opts.maxTokens ?? opts.max_tokens;
      if (mt != null) req.max_tokens = mt;
      if (opts.temperature != null) req.temperature = opts.temperature;
      if (opts.top_p != null) req.top_p = opts.top_p;
      let chunks;
      try {
        chunks = await Promise.race([eng.chat.completions.create(req), abortP]);
      } catch (e) {
        throw new PageEngineError("generate-failed", `the in-page model failed: ${e?.message || e}`, { cause: e });
      }
      if (chunks === ABORTED) { finish = "abort"; return; }
      it = chunks[Symbol.asyncIterator]();
      for (;;) {
        let r;
        try { r = await Promise.race([it.next(), abortP]); } catch (e) {
          if (aborted) break;
          throw new PageEngineError("generate-failed", `the in-page model failed mid-answer: ${e?.message || e}`, { cause: e });
        }
        if (r === ABORTED || aborted) break;
        if (r.done) { natural = true; break; }
        const ch = r.value;
        const fr = ch?.choices?.[0]?.finish_reason;
        if (fr) finish = fr;
        if (Number.isFinite(ch?.usage?.completion_tokens)) usageTokens = ch.usage.completion_tokens;
        const d = ch?.choices?.[0]?.delta?.content;
        if (d) { tokens++; yield d; }
      }
      if (aborted) {
        finish = "abort";
        // Let the engine finish unwinding before the next generation starts, but never hang on it.
        const drain = (async () => { try { for (;;) { const n = await it.next(); if (n.done) break; } } catch { /* ended */ } })();
        await Promise.race([drain, sleep(drainMs)]);
      }
    } finally {
      signal?.removeEventListener?.("abort", onAbort);
      // The consumer stopped reading (break/return/throw): stop the generation so the GPU is not left spinning.
      if (!natural && !aborted && it) { try { eng?.interruptGenerate?.(); } catch { /* done */ } }
      meta.finish = finish === "abort" || aborted ? "abort" : finish;
      meta.tokens = usageTokens ?? tokens;
      busy--;
      release();
    }
  }

  /** opts.meta (optional object) receives { finish, tokens } when the stream ends: "abort" means it was cut short. */
  function chatStream(messages, opts = {}) {
    return stream(messages, opts, opts.meta && typeof opts.meta === "object" ? opts.meta : {});
  }

  async function chat(messages, opts = {}) {
    const meta = {};
    let text = "";
    for await (const d of stream(messages, opts, meta)) text += d;
    return { text, tokens: meta.tokens ?? 0, finish: meta.finish ?? "stop" };
  }

  async function unload() {
    await dropEngine();
    fellBackFrom = null;
  }

  async function cached(modelId, { probe = false } = {}) {
    const canon = canonicalModelId(modelId);
    const known = hint().includes(canon);
    let mod = null;
    if (probe) { try { mod = await getModule(); } catch { mod = null; } }
    else if (modPromise) { try { mod = await modPromise; } catch { mod = null; } }
    if (mod && typeof mod.hasModelInCache === "function") {
      try {
        const g = await getGpu();
        const build = g.f16 ? canon : f32Variant(canon);
        return !!(await mod.hasModelInCache(build, mod.prebuiltAppConfig));
      } catch { /* fall through to the hint */ }
    }
    return known;
  }

  const models = () => MODEL_CHOICES.map((m) => ({ ...m, loaded: engine != null && loadedCanon === m.id }));

  async function status() {
    const g = await getGpu();
    return {
      gpu: g,
      loaded: engine != null,
      loadedId: loadedCanon,
      runnableId: runnable,
      loading: pending.size ? [...pending.keys()] : [],
      worker: worker != null,
      fellBackFrom,
      lastError: lastError ? String(lastError.message || lastError) : null,
      version: WEBLLM_VERSION,
    };
  }

  // The id of the model that answers for `modelId` right now: itself when loaded, the settled fallback when that is what it fell back to.
  const servesFor = (modelId) => { const c = canonicalModelId(modelId); return engine != null && (loadedCanon === c || fellBackFrom === c); };

  return { models, load, isLoaded: () => engine != null, loadedId: () => loadedCanon, servesFor, chatStream, chat, unload, cached, status, gpu: getGpu };
}

/**
 * The engine's models shaped like fold-chat-client.js listModels() entries, so the picker can merge them. [] when the device has
 * no usable WebGPU; the typed reason ('no-webgpu' | 'no-adapter') is on the returned array's `.reason` (non-enumerable).
 */
export async function pageModels(engine, { gpu = null } = {}) {
  const g = gpu || (await engine.gpu?.()) || { available: false, f16: false, reason: "no-adapter" };
  const out = [];
  Object.defineProperty(out, "reason", { value: g.reason, enumerable: false });
  if (!g.available) return out;
  const loadedId = engine.loadedId();
  for (const m of engine.models()) {
    const isCached = await engine.cached(m.id).catch(() => false);
    const loaded = loadedId === m.id;
    const bits = [];
    if (loaded) bits.push("loaded in this tab");
    else if (isCached) bits.push("already downloaded");
    else bits.push(`downloads ${m.sizeLabel} once, then runs in this browser`);
    if (m.desktopOnly) bits.push("needs a desktop-class GPU");
    if (!g.f16) bits.push("f32 build (this GPU lacks shader-f16)");
    out.push({
      id: PAGE_PREFIX + m.id,
      name: m.label.split(" — ")[0],
      kind: "webllm-page",
      provider: "webllm",
      local: true,
      sealed: false,
      loaded,
      cached: isCached,
      sizeLabel: m.sizeLabel,
      note: bits.join("; "),
      tag: m.tag,
      contextWindow: null,
      default: !!m.default,
    });
  }
  return out;
}
