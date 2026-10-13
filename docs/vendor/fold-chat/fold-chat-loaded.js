// fold-chat-loaded.js — which models are LOADED right now, and why "no model" says what it says.
//
// Two different lists, and the footer must not confuse them:
//   • servable — everything the bridge could run (`GET /api/tags`, read by fold-chat-client.js listModels);
//   • in this tab — the page's OWN engine (fold-chat-webllm.js, WebGPU): a model resident in this very browser tab, which needs no
//                bridge at all. The app hands that in as `page` ({ available, reason, entries, loading }); a first load shows its
//                progress here, and a device with no WebGPU says so instead of failing silently;
//   • loaded   — what is resident in memory this minute: the FLEET the bridge relays (phones, browser tabs —
//                `GET <bridge>/api/ps`, which is `{"models":[]}` whenever no fleet worker is connected) plus this
//                machine's Ollama (`GET <upstream>/api/ps`, `size_vram` says how much is on the GPU; the upstream is the
//                address the bridge's /bridge/hello reports, http://127.0.0.1:11434 by default, CORS-open to the page).
//
// Pure and injectable: `fetchImpl` and the timers are parameters, nothing here touches the DOM, and a failing source
// never throws — it is reported (`bridge: "down"`), because a footer that errors is worse than one that says "not reachable".
//
//   fetchLoaded({ base, upstream, fetchImpl, timeoutMs, page }) → { bridge: "up"|"down", entries:[…], servable, errors:[…], page }
//   describeLoaded(state, { max })                         → { kind: "loaded"|"loading"|"idle"|"empty"|"down", dot, text, title }
//   noModelWhy({ bridgeUp, models, selectedId })           → { code, text } — what to say instead of a bare "no model"
//   createLoadedPoller({ … })                              → { refresh, stop } polls only while the tab is visible

const DEFAULT_UPSTREAM = "http://127.0.0.1:11434";

const bare = (id) => String(id ?? "").replace(/:latest$/i, "");
const mb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : n > 0 ? `${Math.round(n / 1e3)} KB` : "");
const trimBase = (u) => String(u ?? "").replace(/\/+$/, "");

/** Where does a resident model live? A heimdall browser tab serving WebLLM, a fleet worker, or this machine. */
export function placeOf(entry, source) {
  // This page's own engine: the model lives in THIS tab. (A heimdall browser tab that serves WebLLM to the fleet is the next line.)
  if (source === "page" || entry?.kind === "webllm-page") return "this tab (WebLLM)";
  const h = entry?.heimdall || {};
  const hay = [entry?.name, entry?.model, entry?.details?.family, entry?.details?.format, h.provider, h.kind, entry?.kind, entry?.provider].map((x) => String(x ?? "")).join(" ");
  if (h.webllm || entry?.webllm || entry?.kind === "webllm" || /webllm|mlc-ai|\bmlc\b|-MLC\b/i.test(hay)) return "browser tab (WebLLM)";
  if (source === "bridge" || h.workers || h.native || entry?.kind === "fleet" || entry?.kind === "native") return "fleet";
  return "this machine";
}

function entriesOf(json, source) {
  const out = [];
  for (const m of Array.isArray(json?.models) ? json.models : []) {
    const id = bare(m?.name ?? m?.model);
    if (!id) continue;
    // an outside provider's lane (sealed-external) is not resident anywhere: it is not "loaded", and it is not in the fleet
    if (m?.heimdall?.frontier || m?.heimdall?.location === "external") continue;
    out.push({
      id,
      place: placeOf(m, source),
      source,
      size: Number(m?.size) > 0 ? Number(m.size) : 0,
      vram: Number(m?.size_vram) > 0 ? Number(m.size_vram) : 0,
      expires: m?.expires_at || null,
      // the window it is loaded at (Ollama's /api/ps `context_length`): Gary reads it at the door (fold-chat-gary.js noteWindows)
      ctx: Number(m?.context_length) > 0 ? Number(m.context_length) : 0,
    });
  }
  return out;
}

async function getJson(url, fetchImpl, timeoutMs) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const r = await fetchImpl(url, { cache: "no-store", ...(ctl ? { signal: ctl.signal } : {}) });
    if (!r || !r.ok) throw new Error("answered " + (r ? r.status : "nothing"));
    return await r.json();
  } finally { if (timer) clearTimeout(timer); }
}

/** Ask the bridge (fleet + what it can serve) and this machine's Ollama (what is resident), in parallel, each with a
 *  short timeout. `bridge` is "up" when the bridge answered anything at all; a down Ollama is not a down bridge. */
export async function fetchLoaded({ base, upstream = null, fetchImpl = (typeof fetch === "function" ? fetch : null), timeoutMs = 2500, page = null } = {}) {
  const b = trimBase(base);
  const errors = [];
  // The page's own resident models come first and need no network: they are listed even when the bridge never answers.
  const inTab = (Array.isArray(page?.entries) ? page.entries : []).filter((e) => e && e.id).map((e) => ({ id: bare(e.id), place: placeOf(e, "page"), source: "page", size: 0, vram: 0, expires: null, ctx: Number(e.ctx) > 0 ? Number(e.ctx) : 0 }));
  const none = { bridge: "down", entries: inTab, servable: null, errors: ["no fetch"], page };
  if (!fetchImpl || !b) return none;
  // The upstream the bridge reports (its own Ollama address), else the default. Asked first, cheaply, but never waited
  // on past the timeout: the default is a good answer on every machine measured.
  let up = trimBase(upstream || DEFAULT_UPSTREAM);
  const [ps, tags, local] = await Promise.all([
    getJson(b + "/api/ps", fetchImpl, timeoutMs).catch((e) => { errors.push("bridge /api/ps: " + (e?.message || e)); return null; }),
    getJson(b + "/api/tags", fetchImpl, timeoutMs).catch((e) => { errors.push("bridge /api/tags: " + (e?.message || e)); return null; }),
    getJson(up + "/api/ps", fetchImpl, timeoutMs).catch((e) => { errors.push("this machine's Ollama /api/ps: " + (e?.message || e)); return null; }),
  ]);
  const fleet = entriesOf(ps, "bridge"), mine = entriesOf(local, "ollama");
  // Merge: one row per model per place. The same model resident on this machine AND in the fleet is two real copies.
  const seen = new Set(), entries = [];
  for (const e of [...inTab, ...mine, ...fleet]) { const k = e.id + "|" + e.place; if (!seen.has(k)) { seen.add(k); entries.push(e); } }
  const servable = tags ? (Array.isArray(tags.models) ? tags.models.length : 0) : null;
  return { bridge: ps || tags ? "up" : "down", entries, servable, errors, page };
}

/** What the footer says. `max` entries are named, the rest are "+N". Pure. */
export function describeLoaded(state, { max = 3 } = {}) {
  const st = state || { bridge: "down", entries: [] };
  const list = Array.isArray(st.entries) ? st.entries : [];
  const pg = st.page || null;
  // A first load in this tab: say what is happening and how far along (web-llm's own progress words), never a frozen footer.
  if (pg?.loading) {
    const pct = Number.isFinite(pg.loading.progress) ? Math.round(Math.min(1, Math.max(0, pg.loading.progress)) * 100) : null;
    const what = pg.loading.phase === "download" ? "downloading" : "starting";
    return { kind: "loading", dot: "\u25D0", text: `${what} ${bare(pg.loading.name || pg.loading.id)} \u00b7 ${pct == null ? "" : pct + "% \u00b7 "}in this tab (WebLLM)`, title: String(pg.loading.text || "loading the model in this tab") + "\nThe model is downloaded once to this browser's own cache, then runs on this device's GPU. Nothing leaves the tab." };
  }
  if (st.bridge === "down" && !list.length) {
    if (pg && pg.available) return { kind: "idle", dot: "\u25CB", text: "no model loaded in this tab \u2014 the first ask loads one here", title: "This tab can run a model itself (WebGPU). The first ask downloads it once (it asks first), then it runs in this tab and nothing leaves it.\n" + (st.errors || []).join("\n") };
    if (pg && pg.reason && pg.reason !== "no-engine") return { kind: "down", dot: "\u25CB", text: "no WebGPU here \u2014 Sources only still works", title: `This browser cannot run a model in the tab (${pg.reason}). Use a WebGPU browser for a written answer. Sources only needs no model.\n` + (st.errors || []).join("\n") };
    return { kind: "down", dot: "\u25CB", text: "no model reachable \u2014 Sources only still works", title: "No model can run in this tab. Sources only needs no model.\n" + (st.errors || []).join("\n") };
  }
  if (!list.length) {
    // The tab can run a model itself: an empty bridge is not "no model" — the first ask loads one here (after asking to download).
    if (pg && pg.available) return { kind: "idle", dot: "\u25CB", text: "no model loaded in this tab \u2014 the first ask loads one here", title: `This tab can run a model itself (WebGPU). The first ask downloads it once (it asks first), then it runs in this tab and nothing leaves it.${st.servable ? ` ${st.servable} model(s) can also be served.` : ""}` };
    if (st.servable === 0) return { kind: "empty", dot: "○", text: "no chat model available \u2014 Sources only still works", title: "No model that can write is available. Sources only needs no model." };
    return { kind: "idle", dot: "○", text: "no model loaded — the first ask will load one", title: `Nothing is resident in memory right now${st.servable ? `; ${st.servable} model(s) can be served` : ""}.` };
  }
  const label = (e) => bare(e.id) + (e.place === "this machine" ? "" : e.place === "fleet" ? " (fleet)" : e.place === "this tab (WebLLM)" ? " (this tab)" : " (tab)");
  const shown = list.slice(0, max).map(label), more = list.length - shown.length;
  const text = `${shown.join(" · ")}${more > 0 ? ` +${more}` : ""} loaded`;
  const title = list.map((e) => {
    const sz = e.size ? mb(e.size) : "";
    const gpu = e.vram ? (e.size && e.vram >= e.size ? "all in GPU memory" : `${mb(e.vram)} in GPU memory`) : "";
    return `${e.id} — ${e.place}${sz ? " · " + sz : ""}${gpu ? " · " + gpu : ""}`;
  }).join("\n");
  return { kind: "loaded", dot: "●", text, title };
}

/** The reason there is no model to answer with, in words that tell the person what to do — never a bare "no model". */
export function noModelWhy({ bridgeUp = true, models = [], selectedId = null, page = null, isChat = (m) => !/embed|bge-|e5-|gte-|minilm|nomic-embed|mxbai/i.test(String(m?.id || "")) } = {}) {
  const list = Array.isArray(models) ? models : [];
  // A model listed IN THIS TAB needs no bridge: the bridge being down is then not why there is "no model".
  const inTab = list.some((m) => m?.kind === "webllm-page");
  if (!bridgeUp && !inTab) {
    if (page && page.available === false && page.reason && page.reason !== "no-engine") return { code: "no-webgpu", text: `this browser has no WebGPU (${page.reason}) — use a WebGPU browser for a written answer` };
    return { code: "bridge-down", text: "no model can run in this tab — use a WebGPU browser for a written answer" };
  }
  if (!list.length) return { code: "no-models", text: "the bridge is up but serves no model — pull one (`ollama pull gemma2:2b`) or connect a fleet worker" };
  if (!list.some(isChat)) return { code: "no-chat-model", text: "the bridge only serves embedding models — none can write an answer; pull a chat model (`ollama pull gemma2:2b`)" };
  if (selectedId && !list.some((m) => m.id === selectedId)) return { code: "selected-missing", text: `the selected model (${bare(selectedId)}) isn't available here — pick another from the list` };
  return { code: "ok", text: "" };
}

/** Poll `get()` every `intervalMs`, but only while the tab is visible: hidden → the timer is cleared, visible again →
 *  one immediate refresh and the timer restarts. Everything is injected, so the schedule is testable. `refresh()` is
 *  the "after each turn" call. A failed or overlapping get never stacks and never throws. */
export function createLoadedPoller({ get, onState, intervalMs = 15000, isVisible = () => true, onVisibilityChange = () => () => {}, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
  let timer = null, busy = false, stopped = false, unsub = null;
  const refresh = async () => {
    if (stopped || busy) return;
    busy = true;
    try { const st = await get(); if (!stopped) onState?.(st); } catch { /* the footer keeps its last words */ } finally { busy = false; }
  };
  const arm = () => { if (!timer && !stopped) timer = setIntervalFn(() => { if (isVisible()) refresh(); }, intervalMs); };
  const disarm = () => { if (timer) { clearIntervalFn(timer); timer = null; } };
  unsub = onVisibilityChange(() => { if (isVisible()) { refresh(); arm(); } else disarm(); });
  if (isVisible()) { refresh(); arm(); }
  return { refresh, stop() { stopped = true; disarm(); try { unsub?.(); } catch {} } };
}
