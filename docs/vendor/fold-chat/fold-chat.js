// fold-chat.js — The Fold's chat version, LibreChat's UX, Fold-native.
//
// Standalone surface (this repo is the source of truth; it is vendored into
// the-fold). A browser page, no build: it speaks to the heimdall bridge
// (localhost:8790), which routes the fleet, linked hosts, and the sealed
// remote providers. Outside models are sealed-external — the chat never sends
// raw workspace material, and the evidence drawer reports who did the work.
//
// Affordances (LibreChat's, built for the fold): icon rail + chat sidebar,
// model/endpoint switcher, Projects, Chats grouped by time, a centered
// welcome + big composer, generative artifacts (isolated HTML previews, code
// cards), conversation memory (fork / edit / continue), presets, a live stage
// line, and the sealed badge always visible.

import * as client from "./fold-chat-client.js";
import { artifactsOf, previewable } from "./fold-chat-artifacts.js";
import { mdHtml } from "./fold-chat-render.js";
import * as memory from "./fold-chat-memory.js";
import * as ground from "./fold-chat-ground.js";
import * as web from "./fold-chat-web.js";
import { classifyTurn, GENERATE_NUDGE, checkable, wantsWeb, generationArtifact } from "./fold-chat-discourse.js";
import * as topic from "./fold-chat-topic.js";
import { PHOSPHOR, PHOSPHOR_VIEWBOX } from "./fold-chat-icons.js";
import * as FOLD from "./vendor/the-fold/fold.js";

const DEFAULT_BRIDGE = "http://localhost:8790";
const PRESETS = Object.freeze({
  plain: { label: "Plain", system: "You are a helpful assistant. Reply directly, briefly, and naturally, the way a person would. If the person just says hi or asks how you are, answer in kind and offer to help — do not ask them for files or material." },
  fold: { label: "Fold", system: "You are the fold — the reading and research surface over this person's own material: their audits, transcripts, reports, pages, and records. Reply plainly, in a warm, grounded voice. Where the conversation carries grounded material, answer from it; where it does not, say what is missing instead of filling it in. Never claim a source you cannot show, and never state a personal fact you were not given. When greeted — hi, hey, how are you — answer warmly and briefly, say what you can help with, and never ask them to produce passages or files." },
  code: { label: "Code", system: "You are a coding assistant. Prefer concrete, working code. Put substantial snippets in a fenced block with its language so they render as artifacts." },
  build: { label: "Build", system: "You are a generative UI assistant. When asked to build something, produce a complete, self-contained HTML document inside a ```html fence — it renders live in an isolated preview." },
});

const $ = (id, r = document) => r.querySelector("#" + id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", name === "folder" ? "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" : "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5");
  svg.append(p); return svg;
}
// A Phosphor icon, by name, from the vendored set (fold-chat-icons.js). The
// chat's topic icon — the same mark in the sidebar and on the assistant's
// messages, so a conversation wears what it became about.
function phosphor(name, size = 16) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", PHOSPHOR_VIEWBOX);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("width", String(size)); svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PHOSPHOR[name] || PHOSPHOR[topic.FALLBACK_ICON] || "";
  return svg;
}
const now = () => new Date().toISOString();
const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

// Inline text dialog — replaces window.prompt. Resolves the trimmed value on
// OK (empty string allowed), or null on cancel / Escape / backdrop.
function askDialog({ title, value = "", placeholder = "", okLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet dialog-sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", title), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG;
    head.append(close);
    const field = el("div", "field");
    const input = document.createElement("input");
    input.type = "text"; input.value = value; input.placeholder = placeholder; input.autocomplete = "off"; input.spellcheck = false;
    field.append(input);
    const foot = el("div", "sheet-foot");
    const cancel = el("button", "btn", "Cancel");
    const ok = el("button", "btn primary", okLabel);
    foot.append(el("div", "grow"), cancel, ok);
    sheet.append(head, field, foot);
    modal.append(sheet);
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    cancel.onclick = close.onclick = () => done(null);
    ok.onclick = () => done(input.value.trim());
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });
    document.body.append(modal);
    input.focus(); input.select();
  });
}

// Inline chooser — resolves the chosen value, or null on cancel.
function chooseDialog({ title, items = [] } = {}) {
  return new Promise((resolve) => {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet dialog-sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", title), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG;
    head.append(close);
    const list = el("div", "choose-list");
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    for (const it of items) {
      const b = el("button", "choose-item" + (it.danger ? " danger" : ""), it.label);
      b.onclick = () => done(it.value);
      list.append(b);
    }
    sheet.append(head, list);
    modal.append(sheet);
    close.onclick = () => done(null);
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    document.body.append(modal);
  });
}

// Anchored popup menu. items: [{ label, onClick, danger?, sep? }].
function menuAt(anchor, items) {
  document.querySelectorAll(".pop").forEach((p) => p.remove());
  const pop = el("div", "pop");
  for (const it of items) {
    if (it.sep) { pop.append(el("div", "sep")); continue; }
    const b = el("button", it.danger ? "danger" : "", it.label);
    b.onclick = () => { pop.remove(); it.onClick?.(); };
    pop.append(b);
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const left = Math.min(r.left, window.innerWidth - pr.width - 8);
  let top = r.bottom + 6;
  if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
  pop.style.left = Math.max(8, left) + "px";
  pop.style.top = top + "px";
  const away = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("mousedown", away); } };
  setTimeout(() => document.addEventListener("mousedown", away), 0);
  return pop;
}

export function mount(root, opts = {}) {
  // Where heimdall is. The stored override / opts.bridge is preferred; on boot
  // the surface also probes the standard local port itself, so a fresh
  // GitHub-Pages page finds a bridge the person never had to type in.
  let bridge = opts.bridge || localStorage.getItem("fold-chat:bridge") || DEFAULT_BRIDGE;
  let bridgeHello = null;
  const sessions = load("fold-chat:sessions", {});
  const projects = load("fold-chat:projects", {});
  let activeId = null;
  let filterProject = null;
  let search = "";
  let models = [];
  let preset = localStorage.getItem("fold-chat:preset") || "fold";
  let meterInfo = null;
  const collapsed = load("fold-chat:collapse", {});
  // Transparency: show the grounding record on every answer. On by default —
  // the fold would rather disclose than dress up. Persisted per browser.
  let transparency = (() => { try { const v = localStorage.getItem("fold-chat:transparency"); return v == null ? true : v === "1"; } catch { return true; } })();
  function setTransparency(on) {
    transparency = !!on;
    try { localStorage.setItem("fold-chat:transparency", transparency ? "1" : "0"); } catch (e) {}
    if (activeId) open(activeId);
  }
  // Web search: when on, a turn searches the keyless sources (Wikipedia, GitHub,
  // the Internet Archive, OpenAlex, Crossref), reads the top hits, and grounds
  // the answer on them — the holodeck's mechanism.
  let webOn = (() => { try { return localStorage.getItem("fold-chat:web") === "1"; } catch { return false; } })();

  const E = {
    railToggle: $("railToggle"), railNew: $("railNew"), railSearch: $("railSearch"), railEvidence: $("railEvidence"), railTheme: $("railTheme"), railSettings: $("railSettings"),
    side: $("side"), models: $("models"), projects: $("projects"), chats: $("chats"), projAdd: $("projAdd"), projNewProject: $("projNewProject"), chatNew: $("chatNew"),
    agentSlot: $("agentSlot"), engagementSlot: $("engagementSlot"), curModel: $("curModel"), webToggle: $("webToggle"),
    topNew: $("topNew"), topFocus: $("topFocus"), groundToggle: $("groundToggle"), sealBadge: $("sealBadge"),
    welcome: $("welcome"), welcomeSub: $("welcomeSub"), thread: $("thread"), threadCol: $("threadCol"), stage: $("stage"), main: document.querySelector("main.main"),
    composerWrap: $("composerWrap"), composer: $("composer"), input: $("input"), send: $("send"), attach: $("attach"), mic: $("mic"),
    footer: $("footer"), drawer: $("drawer"), toast: $("toast"), footEvidence: $("footEvidence"), ver: $("ver"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsCancel: $("settingsCancel"), settingsSave: $("settingsSave"),
    setBridge: $("setBridge"), bridgeDetect: $("bridgeDetect"), bridgeStatus: $("bridgeStatus"), setPreset: $("setPreset"), setTheme: $("setTheme"), setMode: $("setMode"), setTransparency: $("setTransparency"), setAbout: $("setAbout"),
    keyAnthropic: $("keyAnthropic"), keyOpenai: $("keyOpenai"), keyStatus: $("keyStatus"),
  };
  E.ver.textContent = "v0.1";

  // Engagements — ONE thread, one project, two affordances. This is the
  // Claude / Claude-Code shape: the tabs are sibling modes over a SHARED
  // session, not one app embedded in a pane. `chat` answers from the routed
  // models (heimdall /v1); `code` dispatches the same turn through the SAME
  // bridge to the machine door (the khora conductor: read → derive → execute →
  // retain). The answer, its tool activity, and the project's folder all land
  // in the one thread. Nothing is a separate app with its own store.
  let engagement = localStorage.getItem("fold-chat:engagement") || localStorage.getItem("fold-chat:mode") || "chat";
  const engBar = el("div", "agentbar");
  const engBtns = {};
  for (const [k, label] of [["chat", "Chat"], ["code", "Code"]]) {
    const b = el("button", "agentbtn" + (engagement === k ? " on" : ""), label);
    b.onclick = () => setEngagement(k);
    engBtns[k] = b; engBar.append(b);
  }
  if (E.engagementSlot) E.engagementSlot.append(engBar); else E.composer.before(engBar);

  function setEngagement(k) {
    engagement = k;
    try { localStorage.setItem("fold-chat:engagement", k); } catch (e) {}
    for (const [kk, bb] of Object.entries(engBtns)) bb.classList.toggle("on", kk === k);
    E.input.placeholder = k === "code" ? "Describe the change to make…" : "Message the fold";
  }
  // codeUi is the machine door's UI URL, kept only for the "open ↗" affordance.
  let codeUi = null;

  function toast(msg) { E.toast.textContent = msg; E.toast.classList.add("show"); setTimeout(() => E.toast.classList.remove("show"), 1600); }

  /* ---------------- models ---------------- */
  async function refreshModels() {
    try { models = await client.listModels({ base: bridge }); }
    catch (e) { models = []; toast("heimdall bridge not answering — run heimdall up"); }
    renderModels();
  }
  function selectedModel() { return models.find((m) => m.id === sessions[activeId]?.model) || client.autoPick(models); }
  function providerColor(p) { const s = String(p || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return `hsl(${h} 60% 45%)`; }
  function renderModels() {
    E.models.innerHTML = "";
    if (!models.length) { E.models.append(el("div", "empty-hint", "no models — start the heimdall bridge")); return; }
    const cur = sessions[activeId]?.model;
    const free = new Set(client.FREE_TIERS);
    const groups = {};
    for (const m of models) { const t = m.tier || client.tierOf(m); (groups[t] || (groups[t] = [])).push(m); }
    for (const t of client.TIER_ORDER) {
      const list = groups[t]; if (!list || !list.length) continue;
      const meta = client.TIERS[t] || { label: t, note: "" };
      // The free tiers start collapsed; a tier the person opened (or a paid
      // tier) stays open. The collapse is remembered per browser.
      const isCollapsed = collapsed[t] ?? free.has(t);
      const head = el("div", "tier clickable" + (isCollapsed ? "" : " open"));
      head.append(el("span", "tier-caret", isCollapsed ? "▸" : "▾"));
      head.append(el("span", "tier-label", meta.label));
      head.append(el("span", "tier-count", String(list.length)));
      if (meta.note) head.append(el("span", "tier-note", meta.note));
      head.onclick = () => { collapsed[t] = !isCollapsed; save("fold-chat:collapse", collapsed); renderModels(); };
      E.models.append(head);
      if (isCollapsed) continue;
      for (const m of list) {
        const row = el("div", "model" + (m.id === cur ? " on" : ""));
        const dot = el("span", "pdot"); dot.style.background = providerColor(m.provider);
        row.append(dot, el("span", "name", m.id));
        if (m.sealed) row.append(el("span", "seal", "sealed"));
        row.onclick = () => setModel(m.id);
        E.models.append(row);
      }
    }
  }
  function setModel(id) {
    const s = sessions[activeId];
    if (s) { s.model = id; s.sealed = !!(models.find((m) => m.id === id)?.sealed); save("fold-chat:sessions", sessions); }
    renderModels();
    updateSeal();
  }
  function updateSeal() {
    const s = sessions[activeId];
    const m = models.find((x) => x.id === s?.model);
    if (E.curModel) E.curModel.textContent = m ? m.id : "";
    const sealed = !!s?.sealed;
    if (E.sealBadge) E.sealBadge.className = "sealbadge " + (sealed ? "seal-on" : "seal-off");
    E.welcomeSub.textContent = sealed ? "sealed-external — verbatim spans withheld; the reading only" : "";
  }

  /* ---------------- projects ---------------- */
  // A project is the shared container (Claude's shape): a name, an optional
  // FOLDER (the working directory code turns are bound to, and the same folder
  // the conductor reads), and a PRESET the project's sessions inherit. Chat
  // turns and code turns hang off the same project — that is what "sharing
  // projects" means: one place a conversation and the machine door both start
  // from. The project carries no files itself; the folder is the ground.
  function projectSub(p) {
    const parts = [];
    if (p.cwd) parts.push(p.cwd);
    const pr = PRESETS[p.preset]; if (pr) parts.push(pr.label);
    return parts.join(" · ") || "no folder yet";
  }
  function newProjectDialog(existing = null) {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet dialog-sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", existing ? "Project settings" : "New project"), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG; head.append(close);
    const nameField = el("div", "field");
    nameField.append(el("label", "", "Name"));
    const name = document.createElement("input");
    name.type = "text"; name.value = existing?.name || ""; name.placeholder = "Project name"; name.autocomplete = "off";
    nameField.append(name);
    const cwdField = el("div", "field");
    cwdField.append(el("label", "", "Folder (working directory)"));
    const cwd = document.createElement("input");
    cwd.type = "text"; cwd.value = existing?.cwd || ""; cwd.placeholder = "/Users/you/Documents/your-project"; cwd.autocomplete = "off"; cwd.spellcheck = false;
    cwdField.append(cwd, el("div", "hint", "Code turns read and edit this folder through the conductor. Leave blank for a chat-only project."));
    const presetField = el("div", "field");
    presetField.append(el("label", "", "Preset"));

    return new Promise((resolve) => {
      const sel = document.createElement("select");
      for (const [k, p] of Object.entries(PRESETS)) sel.append(new Option(p.label, k));
      sel.value = existing?.preset || preset;
      presetField.append(sel);
      const foot = el("div", "sheet-foot");
      const cancel = el("button", "btn", "Cancel");
      const ok = el("button", "btn primary", existing ? "Save" : "Create");
      foot.append(el("div", "grow"), cancel, ok);
      sheet.append(head, nameField, cwdField, presetField, foot);
      modal.append(sheet);
      const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") done(null); };
      document.addEventListener("keydown", onKey);
      cancel.onclick = close.onclick = () => done(null);
      ok.onclick = () => { const n = name.value.trim(); done(n ? { name: n, cwd: cwd.value.trim(), preset: sel.value } : null); };
      modal.onclick = (e) => { if (e.target === modal) done(null); };
      document.body.append(modal);
      name.focus(); name.select();
    });
  }
  function projectMenu(id, anchor) {
    const p = projects[id]; if (!p) return;
    menuAt(anchor, [
      { label: "Settings…", onClick: async () => { const v = await newProjectDialog(p); if (v) { Object.assign(p, v); save("fold-chat:projects", projects); renderProjects(); } } },
      { sep: true },
      { label: "Delete", danger: true, onClick: () => { delete projects[id]; for (const s of Object.values(sessions)) if (s.project === id) s.project = null; if (filterProject === id) filterProject = null; save("fold-chat:projects", projects); save("fold-chat:sessions", sessions); renderProjects(); renderChats(); } },
    ]);
  }
  function renderProjects() {
    E.projects.innerHTML = "";
    const all = el("div", "folder" + (filterProject === null ? " on" : ""));
    all.append(icon("layers"), el("span", "", "All chats"));
    all.onclick = () => { filterProject = null; renderProjects(); renderChats(); };
    E.projects.append(all);
    for (const [id, p] of Object.entries(projects)) {
      const row = el("div", "project" + (filterProject === id ? " on" : ""));
      const ico = el("span", "pico", (p.name || "P").trim().slice(0, 1).toUpperCase());
      const meta = el("div", "pmeta");
      meta.append(el("div", "pname", p.name), el("div", "psub", projectSub(p)));
      const menu = el("button", "pmenu", "⋯");
      menu.onclick = (ev) => { ev.stopPropagation(); projectMenu(id, menu); };
      row.append(ico, meta, menu);
      row.onclick = () => { filterProject = id; renderProjects(); renderChats(); };
      E.projects.append(row);
    }
  }
  E.chatNew.parentElement?.addEventListener("click", (e) => { if (e.target.closest("button")) return; });
  // ＋ makes a project (with a folder + preset); ▶ starts a fresh session in the
  // selected project — the same thing Claude's "new session in a project" does.
  E.projNewProject.onclick = async (e) => {
    e.stopPropagation();
    const v = await newProjectDialog();
    if (!v) return;
    const id = sid(); projects[id] = { id, ...v };
    save("fold-chat:projects", projects);
    filterProject = id;
    renderProjects(); renderChats();
  };
  E.projAdd.onclick = async (e) => {
    e.stopPropagation();
    if (!filterProject) { toast("pick a project first"); return; }
    newChat();
  };

  /* ---------------- chats ---------------- */
  function timeGroup(s) {
    const t = new Date(s.updated || s.createdAt || 0).getTime();
    const d = new Date(); const startToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (t >= startToday) return "Today";
    if (t >= startToday - 864e5) return "Yesterday";
    if (t >= startToday - 7 * 864e5) return "Previous 7 days";
    return "Older";
  }
  // What a chat has BECOME. Until the conversation has found its subject the
  // chat keeps the provisional name (its opening words) and the plain provider
  // mark. Once it has run TURNS_TO_NAME turns, the name is redrawn from the
  // salient terms of the whole exchange, and the icon is the Phosphor mark most
  // similar to it — then both are LOCKED, so the chat's identity is stable. A
  // name the person set by hand is never touched (titleAuto === false).
  function maybeName(s) {
    if (!s || s.titleAuto === false || s.named) return;
    const msgs = s.messages || [];
    if (topic.userTurns(msgs) < topic.TURNS_TO_NAME) return;
    const { title, icon } = topic.topicOf(msgs);
    if (title) s.title = title;
    s.icon = icon;
    s.named = true;
    save("fold-chat:sessions", sessions);
  }
  function renderChats() {
    E.chats.innerHTML = "";
    let list = Object.values(sessions);
    if (filterProject) list = list.filter((s) => s.project === filterProject);
    if (search) list = list.filter((s) => (s.title || "").toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => new Date(b.updated || b.createdAt || 0) - new Date(a.updated || a.createdAt || 0));
    const pinned = list.filter((s) => s.pinned);
    const rest = list.filter((s) => !s.pinned);
    if (pinned.length) group("Pinned", pinned);
    const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
    for (const s of rest) groups[timeGroup(s)].push(s);
    for (const [label, arr] of Object.entries(groups)) if (arr.length) group(label, arr);
    if (!list.length) E.chats.append(el("div", "empty-hint", search ? "no chats match" : "no chats yet"));
  }
  function group(label, arr) {
    const g = el("div", "group");
    g.append(el("div", "group-label", label));
    for (const s of arr) {
      const row = el("div", "chat" + (s.id === activeId ? " on" : ""));
      const ic = el("span", "cicon" + (s.icon ? " glyph" : ""));
      if (s.icon) { ic.style.color = providerColor(s.model); ic.append(phosphor(s.icon)); }
      else ic.style.background = providerColor(s.model);
      const t = el("span", "ct", s.title || "New chat");
      const menu = el("button", "menu", "⋯");
      menu.onclick = (ev) => { ev.stopPropagation(); chatMenu(s.id, menu); };
      row.append(ic, t, menu);
      row.onclick = () => open(s.id);
      g.append(row);
    }
    E.chats.append(g);
  }
  function chatMenu(id, anchor) {
    const s = sessions[id]; if (!s) return;
    menuAt(anchor, [
      { label: s.pinned ? "Unpin" : "Pin", onClick: () => { s.pinned = !s.pinned; save("fold-chat:sessions", sessions); renderChats(); } },
      { label: "Rename…", onClick: async () => { const n = await askDialog({ title: "Rename chat", value: s.title || "", okLabel: "Rename" }); if (n) { s.title = n; s.titleAuto = false; save("fold-chat:sessions", sessions); renderChats(); } } },
      { label: "Move to project…", onClick: () => moveToProject(s) },
      { sep: true },
      { label: "Delete", danger: true, onClick: () => {
        const wasActive = activeId === id;
        delete sessions[id];
        save("fold-chat:sessions", sessions);
        // Deleting the open chat must not resurrect a fresh "New chat" in its
        // place — that read as "delete does nothing". Fall to the next most
        // recent chat in view, or to the empty welcome when none are left.
        if (wasActive) {
          const pool = (filterProject ? Object.values(sessions).filter((s) => s.project === filterProject) : Object.values(sessions))
            .sort((a, b) => new Date(b.updated || b.createdAt || 0) - new Date(a.updated || a.createdAt || 0));
          if (pool.length) open(pool[0].id); else closeThread();
        } else renderChats();
      } },
    ]);
  }
  async function moveToProject(s) {
    const items = [{ label: "No project", value: "none" }];
    for (const [id, p] of Object.entries(projects)) items.push({ label: p.name, value: id });
    items.push({ label: "New project…", value: "new" });
    const v = await chooseDialog({ title: "Move to project", items });
    if (v == null) return;
    if (v === "new") {
      const made = await newProjectDialog();
      if (!made) return;
      const nid = sid(); projects[nid] = { id: nid, ...made }; save("fold-chat:projects", projects);
      s.project = nid;
    } else s.project = v === "none" ? null : v;
    save("fold-chat:sessions", sessions);
    renderProjects(); renderChats();
  }

  /* ---------------- open / render thread ---------------- */
  // The empty state is LibreChat's: the composer rides centered under the
  // welcome title. Once a thread exists, the composer docks above the footer.
  function setView(empty) {
    // One thread always: the empty state only chooses whether the composer
    // rides under the welcome title. No mode owns a separate pane.
    E.welcome.style.display = empty ? "" : "none";
    E.thread.style.display = empty ? "none" : "";
    if (E.composerWrap) {
      if (empty) { if (E.composerWrap.parentElement !== E.welcome) E.welcome.append(E.composerWrap); }
      else if (E.footer && E.composerWrap.nextElementSibling !== E.footer) E.footer.before(E.composerWrap);
    }
  }
  function open(id) {
    activeId = id;
    const s = sessions[id];
    // A conversation that already found its subject (a chat from before this
    // feature, or one whose reply arrived while the tab was closed) is named
    // and given its icon the moment it is opened.
    maybeName(s);
    E.threadCol.innerHTML = "";
    const msgs = s?.messages || [];
    setView(!msgs.length);
    for (let i = 0; i < msgs.length; i++) appendMsg(msgs[i].role, msgs[i].content, { sealed: msgs[i].sealed, index: i, grounding: msgs[i].grounding, model: s?.model, cwd: msgs[i].cwd });
    renderChats(); renderModels(); updateSeal(); paintGrounding();
  }
  function newChat() {
    const id = sid();
    const m = models.find((x) => !x.sealed) || models[0] || null;
    const p = filterProject ? projects[filterProject] : null;
    sessions[id] = { id, title: "New chat", titleAuto: true, named: false, icon: null, messages: [], grounding: true, model: m?.id || "", sealed: !!m?.sealed, project: filterProject, preset: p?.preset || preset, cwd: p?.cwd || null, createdAt: now(), updated: now() };
    save("fold-chat:sessions", sessions);
    open(id);
    E.input.focus();
  }
  // No chat is open: the welcome state, with nothing selected. Reached when the
  // last chat is deleted — the send path (and every + button) opens a new one.
  function closeThread() {
    activeId = null;
    E.threadCol.innerHTML = "";
    setView(true);
    renderChats(); renderModels(); updateSeal(); paintGrounding();
  }
  function cloneSession(src, overrides) {
    // Forks and continues are the same conversation moved forward: they keep
    // the project, the folder, the learned facts, and the attachments — never
    // silently drop the link the way the old code did.
    return {
      id: overrides.id, title: overrides.title, messages: overrides.messages,
      titleAuto: src.titleAuto !== false, named: !!src.named, icon: src.icon ?? null,
      model: src.model, sealed: src.sealed, preset: src.preset, grounding: src.grounding !== false,
      project: src.project ?? null, cwd: src.cwd ?? null,
      facts: src.facts ? { ...src.facts } : undefined,
      attachments: src.attachments ? src.attachments.map((a) => ({ ...a })) : undefined,
      createdAt: now(), updated: now(),
    };
  }
  function forkAt(id, upto) {
    const src = sessions[id]; if (!src) return;
    const fid = sid();
    sessions[fid] = cloneSession(src, { id: fid, title: (src.title || "chat") + " · fork", messages: (src.messages || []).slice(0, upto + 1).map((m) => ({ ...m })) });
    save("fold-chat:sessions", sessions);
    open(fid);
  }

  /* ---------------- rendering a message ---------------- */
  // A prose block renders as markdown: headings, lists, tables, links, code —
  // everything escaped first, so the model's words become markup, never code.
  function prose(body, text) {
    const t = String(text || "").trim();
    if (!t) return;
    const d = el("div", "md");
    d.innerHTML = mdHtml(t);
    body.append(d);
  }
  function renderArtifact(body, art) {
    const card = el("div", "art");
    const bar = el("div", "art-bar");
    bar.append(el("span", "art-title", art.title || "artifact"), el("span", "art-kind", art.kind + (art.lang && art.lang !== art.kind ? " · " + art.lang : "")), el("span", "art-sp"));
    const copy = el("button", "art-btn", "copy");
    const fold = el("button", "art-btn", "collapse");
    bar.append(fold, copy);
    const inner = el("div", "art-inner");
    if (previewable(art.kind)) { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = art.code; inner.append(f); }
    else { inner.append(el("pre", "art-code", art.code)); if (art.kind === "mermaid") inner.append(el("div", "art-note", "Mermaid renders in the fold's workspace; here it stays code.")); }
    copy.onclick = async () => { try { await navigator.clipboard.writeText(art.code); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch (e) {} };
    fold.onclick = () => { inner.hidden = !inner.hidden; fold.textContent = inner.hidden ? "expand" : "collapse"; };
    card.append(bar, inner);
    body.append(card);
  }
  // The transparency block: the holodeck's per-turn record, on the message.
  // What was addressed, what is NOT in the material, and the one-line record.
  // The ENTIRE per-turn disclosure is ONE collapsed block. The head shows the
  // line a reader needs at a glance (the mechanical warrant); grounding, web
  // reads, and the model/route footnote all live inside the panel, opened only
  // on demand. It starts collapsed — except a turn that carries a real problem
  // (unsupported figures/names) opens itself, disclosed rather than hidden.
  function renderDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const openByDefault = !!((rec.unsupported?.numbers?.length || rec.unsupported?.names?.length));
    box.classList.toggle("open", openByDefault);

    const head = el("button", "disc-head");
    head.type = "button";
    head.setAttribute("aria-expanded", openByDefault ? "true" : "false");
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "disclosure"),
      el("span", "disc-sub", rec.hasMaterial ? `${rec.coverage.grounded}/${rec.coverage.total} addressed` : "no material carried"),
      el("span", "disc-line", rec.line),
    );
    const panel = el("div", "disc-panel");

    // The facing page is the ANSWER now (renderFacingAnswer, below): a turn
    // that carries material renders as the spread, so the disclosure keeps only
    // the meta — what the material does not support, the ungrounded sentences,
    // the web reads, and the route foot. A no-material turn has no sources to
    // list, so there is nothing to re-render here.

    const bad = [...(rec.unsupported?.numbers || []), ...(rec.unsupported?.names || [])];
    if (bad.length) {
      panel.append(el("div", "disc-bad", "Not in the material: " + bad.join(", ")));
    } else if (rec.hasMaterial) {
      panel.append(el("div", "disc-ok", "Nothing unsupported"));
    }

    if (rec.ungrounded && rec.ungrounded.length) {
      panel.append(el("div", "disc-label", `${rec.ungrounded.length} sentence(s) with no address`));
      const ul = el("div", "disc-ungrounded");
      for (const t of rec.ungrounded.slice(0, 6)) ul.append(el("div", "disc-text", t));
      panel.append(ul);
    }

    // Web — what was searched and read for this turn.
    if (rec.web && rec.web.length) {
      const reads = rec.web.filter((w) => w.read || w.engine || w.ok === false);
      panel.append(el("div", "disc-label", "Web"));
      const ul = el("div", "disc-ungrounded");
      for (const w of reads.slice(0, 8)) {
        const label = w.read ? `read ${w.read}${w.via ? " via " + w.via : ""}${w.chars ? " · " + w.chars + " chars" : ""}` : w.scope ? `${w.engine || w.scope}${w.n != null ? " · " + w.n + " result(s)" : ""}${w.ok === false ? " — " + (w.why || "no answer") : ""}` : "";
        if (label) ul.append(el("div", "disc-text", label));
      }
      panel.append(ul);
    }

    // The route/mouth footnote — part of the disclosure, so it collapses too.
    if (meta && meta.model) {
      panel.append(el("div", "disc-foot", `${meta.model}${meta.sealed ? " · sealed-external" : ""} · routed by heimdall`));
    }

    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }

  // THE FACING PAGE AS THE ANSWER — the spread a turn with material renders as.
  // SOURCES on the left (each cited passage numbered S#, its permanent address,
  // and the verbatim snip read from the real material), RESPONSE on the right
  // (every sentence tagged [S#] to the passage it draws from, or [M] for the
  // mouth's own prose). On desktop it is the two-page book spread; on mobile it
  // becomes the tagged response and a [S#] chip opens the source's snip in a
  // bottom sheet.
  function renderFacingAnswer(body, rec, meta) {
    const face = rec?.facing;
    if (!face || !face.has) return;
    const spread = el("div", "facing answer");
    const left = el("div", "face-sources");
    left.append(el("div", "disc-label", "Sources"));
    for (const s of face.sources) {
      const card = el("div", "face-source");
      card.append(el("span", "face-n", s.n));
      card.append(el("code", "face-addr", s.address));
      card.append(el("div", "face-snip", s.text));
      left.append(card);
    }
    const right = el("div", "face-response");
    right.append(el("div", "disc-label", "Response"));
    for (const r of face.response) {
      const row = el("div", "face-sent" + (r.grounded ? "" : " m"));
      const chip = el("span", "face-tag" + (r.grounded ? "" : " m"), "[" + r.tag + "]");
      if (r.grounded) {
        const src = face.sources.find((s) => s.n === r.tag);
        chip.title = src ? `grounded on ${src.address} — tap to read` : "grounded";
        chip.onclick = () => { if (src) faceSheet(src); };
      } else {
        chip.title = "the mouth's own prose — not grounded in the material";
        chip.onclick = () => toast("the mouth's own prose — not grounded in the material");
      }
      row.append(chip, el("span", "face-text", r.text));
      if (r.address) row.append(el("code", "face-ground", "grounded on " + r.address));
      right.append(row);
    }
    spread.append(left, right);
    body.append(spread);
  }

  // The bottom sheet a source chip opens: the address and the verbatim snip,
  // read straight from the record — nothing re-summarized.
  function faceSheet(src) {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", src.n), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG;
    head.append(close);
    sheet.append(head);
    if (src.address) sheet.append(el("div", "face-sheet-addr", src.address));
    if (src.text) sheet.append(el("div", "face-sheet-snip", src.text));
    const done = () => modal.remove();
    close.onclick = done;
    modal.onclick = (e) => { if (e.target === modal) done(); };
    modal.append(sheet);
    document.body.append(modal);
  }

  function appendMsg(role, content, meta = {}) {
    const wrap = el("div", "msg " + role);
    const av = el("div", "av");
    // The assistant wears the chat's topic icon (the Phosphor mark the sidebar
    // shows); the person keeps "You". Until a topic emerges, the fold's own "F".
    const sIcon = role === "assistant" ? sessions[activeId]?.icon : null;
    if (role === "user") av.textContent = "You";
    else if (sIcon && PHOSPHOR[sIcon]) { av.classList.add("topic"); av.append(phosphor(sIcon, 17)); av.title = sIcon; }
    else av.textContent = "F";
    const body = el("div", "body");
    if (meta.sealed) body.classList.add("sealed-body");
    if (role === "assistant") {
      if (meta.cwd) body.append(el("span", "chip folderchip", "📁 " + meta.cwd));
      // THE FACING PAGE IS THE ANSWER: a turn that carried material renders as
      // the book spread (renderFacingAnswer) — the model's own prose block is
      // skipped because the spread IS the response, sentence by sentence.
      // Code/artifacts (fenced blocks) still render beside it. When the thread
      // hides grounding, or no material was carried, the plain prose is the
      // answer exactly as before.
      const showDisclosure = transparency && sessions[activeId]?.grounding !== false;
      const face = showDisclosure && meta.grounding?.facing?.has ? meta.grounding.facing : null;
      for (const b of artifactsOf(content)) {
        if (b.kind === "prose") { if (!face) prose(body, b.text); }
        else renderArtifact(body, b.artifact);
      }
      if (face) renderFacingAnswer(body, meta.grounding, meta);
      if (meta.index != null) {
        const acts = el("div", "actions");
        const cont = el("button", "act", "continue"); cont.onclick = () => continueFrom(meta.index);
        const fork = el("button", "act", "fork"); fork.onclick = () => forkAt(activeId, meta.index);
        const disc = el("button", "act", "disclosure"); disc.onclick = () => { const d = body.querySelector(".disclosure"); if (d) d.hidden = !d.hidden; };
        acts.append(cont, fork, disc); body.append(acts);
      }
      if (showDisclosure && meta.grounding && meta.grounding.code) renderCodeDisclosure(body, meta.grounding, meta);
      else if (showDisclosure && meta.grounding && meta.grounding.generate) renderGenerateDisclosure(body, meta.grounding, meta);
      else if (showDisclosure && meta.grounding) renderDisclosure(body, meta.grounding, meta);
    } else {
      body.textContent = content;
      if (meta.index != null) {
        const acts = el("div", "actions");
        const ed = el("button", "act", "edit"); ed.onclick = () => editMessage(meta.index);
        const fork = el("button", "act", "fork"); fork.onclick = () => forkAt(activeId, meta.index);
        acts.append(ed, fork); body.append(acts);
      }
    }
    wrap.append(av, body);
    E.threadCol.append(wrap);
    E.thread.scrollTop = E.thread.scrollHeight;
    return body;
  }
  // The code turn's disclosure: the same collapsed block, but it reports what
  // the machine door DID — the lane, the folder, the tool steps, and the time —
  // so a code turn is as inspectable as a chat turn, and always says it ran
  // through the bridge (never opencode reached directly).
  function renderCodeDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const head = el("button", "disc-head");
    head.type = "button";
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "code record"),
      el("span", "disc-sub", `${(rec.activity || []).length} tool step(s)`),
      el("span", "disc-line", rec.cwd || rec.lane || "machine door"),
    );
    const panel = el("div", "disc-panel");
    if (rec.activity && rec.activity.length) {
      panel.append(el("div", "disc-label", "Tool activity"));
      const ul = el("div", "disc-ungrounded");
      for (const a of rec.activity) ul.append(el("div", "disc-text", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? " [" + a.status + "]" : ""}`));
      panel.append(ul);
    }
    panel.append(el("div", "disc-foot", `${meta.model || "heimdall"} · via heimdall → ${rec.lane || "machine door"}${rec.cwd ? " · " + rec.cwd : ""}${rec.ms ? " · " + rec.ms + "ms" : ""}`));
    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }
  // The generation turn's disclosure: the same collapsed block, but it reports
  // what penelope's generation system DID — the void it detected, the units it
  // wrote one prompt at a time, who filled each (field / hunt / mouth), and the
  // verdict — so a writing turn is as inspectable as a chat turn, and the fold
  // shows that writing happened across prompts, not one big draw.
  function renderGenerateDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const head = el("button", "disc-head");
    head.type = "button";
    const n = (rec.units || []).length;
    const stages = Object.entries(rec.stages || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(" · ");
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "generation record"),
      el("span", "disc-sub", `${n} unit(s)`),
      el("span", "disc-line", `${rec.status || "unverified"}${stages ? " · " + stages : ""}`),
    );
    const panel = el("div", "disc-panel");
    if (rec.void) {
      panel.append(el("div", "disc-label", "Void"));
      const v = el("div", "disc-text");
      v.textContent = `${rec.void.kind} — ${rec.void.reason || ""}${rec.void.satisfy ? " · " + rec.void.satisfy : ""}${rec.void.source ? " · hunted " + rec.void.source : ""}`;
      panel.append(v);
    }
    if ((rec.units || []).length) {
      panel.append(el("div", "disc-label", "Units (one prompt each)"));
      const ul = el("div", "disc-ungrounded");
      for (const u of rec.units.slice(0, 12)) ul.append(el("div", "disc-text", u));
      panel.append(ul);
    }
    panel.append(el("div", "disc-label", "Per-stage outcome"));
    const ul2 = el("div", "disc-ungrounded");
    for (const [k, v] of Object.entries(rec.stages || {})) ul2.append(el("div", "disc-text", `${k}: ${v}`));
    if (!(rec.stages && Object.keys(rec.stages).length)) ul2.append(el("div", "disc-text", "no outcomes recorded"));
    panel.append(ul2);
    if (rec.verdict) panel.append(el("div", "disc-text", "verdict · " + rec.verdict));
    if (rec.materialization && (rec.materialization.folded || rec.materialization.widget)) {
      panel.append(el("div", "disc-label", "Materialization"));
      panel.append(el("div", "disc-text", `folded ${rec.materialization.folded || ""}${rec.materialization.widget ? " · widget " + rec.materialization.widget : ""}`));
    }
    panel.append(el("div", "disc-foot", `${meta.model || "penelope"} · generation via penelope's weave${rec.model ? " · " + rec.model : ""}`));
    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }

  function liveBody() { const b = appendMsg("assistant", "", {}); b.classList.add("live"); return b; }

  /* ---------------- memory: edit / continue ---------------- */
  async function editMessage(index) {
    const s = sessions[activeId]; const m = s?.messages?.[index];
    if (!m || m.role !== "user") return;
    const next = await askDialog({ title: "Edit message", value: m.content, okLabel: "Save" });
    if (next == null || !next || next === m.content) return;
    s.messages = s.messages.slice(0, index).concat([{ ...m, content: next, at: now() }]);
    save("fold-chat:sessions", sessions);
    open(activeId);
    run(activeId, true);
  }
  function continueFrom(index) {
    const s = sessions[activeId]; if (!s) return;
    const id = sid();
    sessions[id] = cloneSession(s, { id, title: (s.title || "chat") + " · continue", messages: s.messages.slice(0, index + 1).map((m) => ({ ...m })) });
    save("fold-chat:sessions", sessions);
    open(id);
    run(id, true);
  }

  /* ---------------- run ---------------- */
  // The identity + memory pipeline: the fold holds who the person is, learns
  // it only when stated, carries it in the system context, and refuses to let
  // an ungrounded identity claim stand (resolution, never invention).
  let readerName = (() => { try { return localStorage.getItem("fold-chat:reader") || null; } catch { return null; } })();

  // The material this surface can ground against: the person's OWN messages.
  // The chat never touches the workspace, so what it carries is what they gave
  // it. Each message is a source with a stable tag (S1, S2, …).
  // MATERIAL is what the fold actually READ — the khora readings of attached
  // files, and pasted documents. Conversational turns are NOT material: a
  // greeting is not a claim, so it is never checked for grounding (the
  // holodeck's lesson). A message counts only when it carries a substantive
  // body of its own (a pasted document), never chit-chat.
  //
  // THE SHORT EXCHANGE IS THE EXCEPTION: when the whole conversation is small
  // enough to ride the context verbatim, the turns themselves ARE what the
  // model was given, so they are the material the answer is checked against —
  // a turn like "well?" is read against the thread it continues, never as
  // "nothing carried". The threshold is characters, because what matters is
  // whether the exchange fits the window, not how it was chopped into turns.
  const VERBATIM_MAX_CHARS = 1600;
  function conversationVerbatim(s) {
    const msgs = (s.messages || []).filter((x) => x.role !== "system");
    const total = msgs.reduce((n, m) => n + String(m.content || "").length, 0);
    return msgs.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS;
  }
  function materialOf(s) {
    const out = [];
    for (const a of s.attachments || []) {
      if (a.reading) out.push({ ref: `attachment · ${a.name}`, source: a.name, text: a.reading });
    }
    const users = (s.messages || []).filter((x) => x.role === "user" && !x.attachment);
    // The current question is the last user turn; it is not material to check
    // the answer against, so the short-exchange material is what came before.
    const prior = users.slice(0, -1);
    if (conversationVerbatim(s) && prior.length) {
      const convo = prior.map((x) => String(x.content || "").trim()).filter(Boolean).join("\n");
      if (convo) out.push({ ref: "the conversation · carried verbatim", source: "S1", text: convo });
    } else {
      const pasted = users.filter((x) => String(x.content || "").trim().length >= 240);
      pasted.forEach((x, i) => out.push({ ref: `you · pasted ${i + 1}`, source: `S${i + 1}`, text: x.content }));
    }
    return out;
  }
  // The mechanical S1: discourse fields COMPUTED from the conversation, no
  // model. Entities are the names the khora admitted (attachments) plus the
  // capitalised names seen in the turns — read off the material, never asked of
  // a model. Topic is the opening clause of the first substantive question;
  // flow is a count of the turns and their kinds; context is what is still
  // open (the last unanswered question, if the answer was a gap). Every value
  // is a projection of the store, so the summary can never disagree with the
  // record — and nothing here can invent an entity the material never named.
  function refreshSummaryMechanical(s) {
    if (!s?.summary) return;
    const msgs = (s.messages || []).filter((x) => x.role === "user" && x.content && !x.attachment);
    const first = msgs.find((x) => String(x.content).trim().length >= 24) || msgs[0];
    const topic = first ? String(first.content).trim().split(/[.?!\n]/)[0].slice(0, 120) : s.summary.topic;
    // Entities: names the khora admitted from attachments + capitalised names
    // in the person's own turns (a proper-noun run), deduped, bounded.
    const fromK = (s.attachments || []).flatMap((a) => (a.names || []));
    const fromTurns = msgs.flatMap((x) => (String(x.content).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []));
    const stop = new Set(["The", "This", "That", "When", "What", "Where", "Who", "How", "Why", "It", "I", "You", "We", "They", "Turn", "Remember", "Reply", "Write", "Please"]);
    const entities = [...new Set([...fromK, ...fromTurns].map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 40 && !stop.has(x)))].slice(0, 8);
    const flow = `${s.summary.turnCount} turn(s) · opening on "${truncate(topic || "", 60)}"`;
    // Context: what is still open — the last user question if its answer was a
    // gap ("no material carried" / a refusal), else null (nothing to carry).
    const lastRec = (s.summary.records || []).slice(-1)[0];
    const context = lastRec && (lastRec.unsupported?.length || lastRec.open?.length) ? `open: ${(lastRec.open || lastRec.unsupported).join("; ")}` : s.summary.context;
    s.summary = { ...s.summary, topic: topic || s.summary.topic, flow, entities: entities.length ? entities : s.summary.entities, context: context || null, language: s.summary.language || (/\b(el|la|los|las|de)\b/i.test(String(first?.content || "")) ? null : "en") };
    // This can never lose a live entity (it only adds names the turns/khora
    // named) and never add an unsupported one — so the veto would always pass;
    // it is still run, so a future edit that breaks that property is caught.
    const check = FOLD.extractSummaryFindings(s.summary.entities || [], s.summary.entities || [], { records: s.summary.records || [], folds: s.summary.folds || [] });
    if (!check.ok) s.summary.refreshRefused = check.findings;
    s.updated = now();
    save("fold-chat:sessions", sessions);
  }

  const truncate = (x, n) => (String(x || "").length > n ? String(x).slice(0, n - 1) + "…" : String(x || ""));

  // The latest thing the person actually asked — the web search query.
  function lastUserText(s) {
    const m = [...(s.messages || [])].reverse().find((x) => x.role === "user");
    return String(m?.content || "").trim();
  }

  async function run(id = activeId, continuing = false) {
    const s = sessions[id]; if (!s) return;
    const m = models.find((x) => x.id === s.model) || selectedModel();
    if (!m) { toast("no model — start the heimdall bridge"); return; }
    if (continuing) s.messages.push({ role: "user", content: "Continue.", at: now() });
    // THE CONVERSATION FOLD (the holodeck's, vendored). The context window does
    // NOT grow with the conversation: the running summary + the addressable
    // records + a small recency window are what ride; the raw transcript beyond
    // that is never resent. `summary` is the store (append-only, persisted on
    // the session); buildTurnMessages projects it.
    if (!s.summary) s.summary = FOLD.emptySummary();
    const basePrompt = [PRESETS[s.preset]?.system, memory.systemContext({ readerName, facts: s.facts || {} })].filter(Boolean).join(" ");
    const question = lastUserText(s);
    const history = s.messages.filter((x) => x.role !== "system").map((x) => ({ role: x.role, content: x.content }));
    s.updated = now(); save("fold-chat:sessions", sessions);
    setView(false);
    const body = liveBody();
    const ac = new AbortController();
    E.send.disabled = true; E.input.disabled = true;
    E.stage.textContent = m.sealed ? "sealed-external · working…" : "working…";
    // DISCOURSE AWARENESS decides the pipeline before any search runs. A
    // generation turn is never front-loaded with a web search (that is what
    // turned "write an essay" into "what topics?"), and a greeting is never
    // searched or checked.
    const kind = classifyTurn(lastUserText(s));
    // The live narration: every step the fold takes is shown while it takes it,
    // so the person sees the pipeline (classify → search → read → write →
    // check) rather than a frozen spinner. Each step is appended, not swapped.
    const say = (msg) => { if (E.stage) E.stage.textContent = msg; };
    const kindWord = { smalltalk: "greeting", generate: "writing request", research: "question of fact", chat: "conversation" }[kind] || kind;
    say(`turn · ${kindWord}${webOn ? (kind === "research" ? " · web on" : " · web off for this turn") : ""}`);
    // THE GENERATION LANE (2026-10-04): a writing request for an artifact
    // penelope's generation system holds leaves the single-draw chat and rides
    // the weave — void detection (units read from the ask, a void read with a
    // hunt) and writing across prompts (one unit per draw, field → hunt →
    // mouth, test decides). The record of that (units, outcomes, verdict) is
    // the disclosure, so the fold shows it happened.
    if (kind === "generate" && generationArtifact(question)) {
      // The weave is the richer path, but it must never be a single point of
      // failure for a write request: if penelope's generation errors (no model,
      // weave down, empty artifact), fall through to the fold's own writer
      // rather than showing "generation error" on a plain "write an essay".
      const ok = await generateTurn(id, s, question, body, ac, { say, m });
      if (ok) return;
      say("turn · writing request · penelope's weave did not answer · writing it here…");
    }
    let webPassages = [], webTrace = null, sourceBlock = null;
    const wantWeb = wantsWeb(kind, webOn);
    if (wantWeb) {
      if (question) {
        say(`turn · ${kindWord} · searching the web…`);
        try {
          const w = await web.searchWeb(question);
          webPassages = w.passages || [];
          webTrace = w.trace || null;
          if (webPassages.length) {
            sourceBlock = "The web sources below were read for this question. Answer from them where they cover it; where they do not, say plainly what is missing. Never claim a source you cannot show.\n\n" + webPassages.map((p, i) => `[W${i + 1}] ${p.ref}\n${p.text.slice(0, 4000)}`).join("\n\n");
            say(`turn · ${kindWord} · read ${webPassages.length} web source(s) · ${m.sealed ? "sealed-external" : "local"} · writing the answer…`);
          } else say(`turn · ${kindWord} · web search found nothing readable · writing the answer…`);
        } catch (e) {
          webTrace = [{ scope: "web", ok: false, why: String(e?.message || e) }];
          say(`turn · ${kindWord} · web search failed (${String(e?.message || e).slice(0, 40)}) · writing the answer…`);
        }
      }
    } else {
      say(kind === "generate" ? `turn · ${kindWord} · writing it now…` : `turn · ${kindWord} · ${m.sealed ? "sealed-external" : "local"} · writing the answer…`);
    }
    // A generate turn replaces the persona with the writer, it does not append
    // to it — the reading persona and the write instruction are opposite
    // directives and a small model hedges when handed both (measured: a
    // 265-char teaser with "fold persona + nudge" against a 2,200-char essay
    // from the nudge alone). The identity/facts line still rides, so the fold
    // never states a personal fact it was not given.
    const identityLine = memory.systemContext({ readerName, facts: s.facts || {} });
    const turnBase = kind === "generate" ? [GENERATE_NUDGE, identityLine].filter(Boolean).join("\n\n") : basePrompt;
    // THE MESSAGE ARRAY: one system message (base + past discourse + records +
    // source block), then at most a small recency window of raw messages, then
    // the question — never the whole transcript. A short exchange is the one
    // case sent whole: the bound is a budget, and what fits inside it is
    // carried verbatim, so a continuation like "well?" has the thread to read.
    const recencyWindow = conversationVerbatim(s) ? history.length : undefined;
    const messages = FOLD.buildTurnMessages({ basePrompt: turnBase, summary: s.summary, history: history.slice(0, -1), question, sourceBlock, recencyWindow });
    try {
      const out = await client.chat(m.id, messages, {
        base: bridge, privacy: "sealed-external",
        onToken: (t) => { body.textContent += t; E.thread.scrollTop = E.thread.scrollHeight; E.stage.textContent = "answering…"; },
        signal: ac.signal,
      });
      E.stage.textContent = "";
      body.classList.remove("live");
      // The fold's grounding: strip a self-citation the model invented, then
      // check the identity guard, then attribute the answer to the material the
      // conversation carries and build the record (disclosed when transparency
      // is on). The model proposes; the record decides.
      let text = ground.stripSelfCitations(out.text).text;
      const bad = memory.ungroundedIdentity(text, { readerName, facts: s.facts || {} });
      if (bad) text = text + "\n\n" + memory.identityCorrection(bad, { readerName });
      const material = [...materialOf(s), ...webPassages.map((p) => ({ ref: p.ref, source: p.source, text: p.text }))];
      const turn = s.messages.filter((x) => x.role === "assistant").length + 1;
      const lastUser = [...s.messages].reverse().find((x) => x.role === "user");
      // A written piece is not a claim to be grounded, and a greeting is not a
      // claim at all — only research/chat turns over real material carry a
      // disclosure. The generate/smalltalk turns carry no record.
      const record = checkable(kind) ? ground.turnRecord(text, material, { turn, question: lastUser?.content || "", model: m.id, sealed: !!m.sealed }) : null;
      if (record && webTrace) record.web = webTrace;
      // THE FOLD ADVANCES (the holodeck's System-1/System-2 split): the turn's
      // mechanical fold line joins the running summary, and the turn's warrant
      // record joins the addressable store. Both are the STORE — append-only,
      // never truncated here; only the projection is bounded. This is what
      // makes the next turn carry discourse, not the transcript.
      const foldLine = FOLD.mechanicalFoldLine(question, text);
      const warrant = FOLD.buildWarrantRecord({
        turn,
        plane: "world",
        gist: foldLine,
        channels: [webPassages.length ? "web" : null, material.length ? "material" : null, "model"].filter(Boolean),
        refs: (record?.sources || []).map((r) => r.address),
        unsupported: [...(record?.unsupported?.numbers || []), ...(record?.unsupported?.names || [])],
        open: [],
      });
      s.summary = FOLD.addWarrantRecord(FOLD.advanceSummaryFold(s.summary, foldLine), warrant);
      // S1 SUMMARY — MECHANICAL, never a model call. Gary's own law (P80,
      // no-json-ask): JSON is the DECODER's job, never the prompt's, and asking
      // a small local model to summarise discourse as JSON is exactly the kind
      // of thing local models cannot do. So the discourse fields are COMPUTED
      // from the turns the way the fold line already is: entities from the
      // names the khora actually admitted, topic from the opening of the first
      // substantive turn, flow from the fold lines, context from what is still
      // open. No model, no JSON ask, no drift — the store only ever accrues.
      refreshSummaryMechanical(s);
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: text, at: now(), grounding: record });
      s.sealed = !!m.sealed;
      maybeName(s);
      save("fold-chat:sessions", sessions);
      const live = body.closest(".msg"); if (live) live.remove();
      appendMsg("assistant", text, { sealed: m.sealed, index: idx, grounding: record, model: m.id });
      renderChats();
    } catch (err) {
      E.stage.textContent = ""; body.classList.remove("live"); body.textContent = "error: " + err.message;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus(); refreshMeter();
    }
  }

  // The coding lane — the SAME thread, dispatched THROUGH heimdall to the
  // machine door. It is not a separate app: the user's message, the agent's
  // tool activity, and its answer all render inline in the one conversation,
  // and the project's folder (cwd) binds the job so the machine door reads and
  // edits the same place the project stands. The model the door reasons with is
  // itself routed by heimdall (a `heimdall` provider pointing at the bridge's
  // /v1), so no model is reached outside the fold stack.
  // A writing request rides penelope's weave, which hunts and draws many times.
  // Declared budget, not an estimate: past this the turn falls back to the
  // fold's own single-draw writer rather than holding the composer hostage.
  // (Measured live: the weave can hang past 100s with no error, so this is the
  // ceiling on how long a plain "write me…" can wait before the fold writes it.)
  const WEAVE_TIMEOUT_MS = 480000;
  const CODE_MODEL = { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" };
  function codeModelRef() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v || CODE_MODEL; } catch { return CODE_MODEL; } }
  function sessionCwd(s) { return s?.cwd || (s?.project ? projects[s.project]?.cwd : null) || null; }
  async function runCode(id = activeId) {
    const s = sessions[id]; if (!s) return;
    const cwd = sessionCwd(s);
    const body = liveBody();
    E.send.disabled = true; E.input.disabled = true;
    E.stage.textContent = cwd ? `coding · ${cwd} · through the conductor…` : "coding · the fold dispatches to the machine door…";
    try {
      // ITERATE VIA THE RECORD: a session that already coded continues its own
      // conductor session (the EOT ledger for code) — the next turn builds on
      // what the last one did, never a fresh session. The prior id is sent on
      // every turn; the id the door RETURNS is persisted immediately (before an
      // error can drop it), so a follow-up always continues the same session.
      const out = await client.code(s.messages[s.messages.length - 1].content, { base: bridge, title: s.title, model: codeModelRef(), sessionId: s.codeSessionId || null, cwd });
      if (out.sessionId) { s.codeSessionId = out.sessionId; save("fold-chat:sessions", sessions); }
      E.stage.textContent = "";
      body.classList.remove("live"); body.textContent = "";
      if (cwd) body.append(el("span", "chip folderchip", "📁 " + cwd));
      // A small coding model sometimes returns the CALL as text
      // (`{"name":"write","arguments":{…}}`) rather than letting the door
      // execute it. That is a tool invocation, never prose: split it out, show
      // it as activity, and only ship real prose as the answer.
      const split = client.splitToolCalls(out.text || "");
      const calls = Array.isArray(split.calls) ? split.calls : [];
      const activity = [...(Array.isArray(out.activity) ? out.activity : []),
        ...calls.map((c) => ({ tool: c.name, status: "requested", title: c.arguments?.filePath || c.arguments?.command || null }))];
      if (activity.length) {
        const list = el("div", "activity");
        for (const a of activity) list.append(el("div", "actrow", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? "  [" + a.status + "]" : ""}`));
        body.append(list);
      }
      const text = split.text || (calls.length
        ? "(the machine door returned only a tool request — " + calls.map((c) => c.name).join(", ") + " — nothing was executed)"
        : "(the machine door returned no text)");
      for (const b of artifactsOf(text)) {
        if (b.kind === "prose") prose(body, b.text);
        else renderArtifact(body, b.artifact);
      }
      const idx = s.messages.length;
      // The code turn carries its own record: the tools that ran, the folder,
      // and the lane. Disclosed on the message like a chat turn, so the fold's
      // transparency holds across both engagements.
      const codeRec = { code: true, cwd, lane: out.lane || "opencode", activity, ms: out.ms };
      s.messages.push({ role: "assistant", content: text, at: now(), codeSessionId: s.codeSessionId, cwd, grounding: codeRec });
      s.updated = now();
      maybeName(s);
      save("fold-chat:sessions", sessions);
      const live = body.closest(".msg"); if (live) live.remove();
      appendMsg("assistant", text, { index: idx, cwd, grounding: codeRec, model: codeModelRef().modelID });
      renderChats();
    } catch (err) {
      E.stage.textContent = ""; body.classList.remove("live"); body.textContent = "error: " + err.message;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus(); refreshMeter();
    }
  }

  // The generation lane — a writing request (essay / report / piece) rides
  // penelope's generation system (the weave): void detection and writing
  // across prompts. The record of that — the units the void named, who filled
  // each (field / hunt / mouth), the verdict — is the disclosure, so the fold
  // shows it happened instead of hiding the seam.
  async function generateTurn(id, s, question, body, ac, { say, m }) {
    E.send.disabled = true; E.input.disabled = true;
    say("turn · writing request · penelope's generation · void detection · one unit per prompt…");
    try {
      // The weave DRAWS, so it needs a model — the model the person picked
      // rides the request (measured: a model-less weave call returns "model
      // required" and the write dies). The id is the plain Ollama name the
      // bridge's weave forwards to penelope's mouth.
      //
      // BOUNDED: a weave hunts and draws many times and, measured live, can
      // hang for 100s+ with the composer disabled and no error. A write request
      // must never wedge the surface, so the weave gets a declared budget; on
      // expiry the caller falls through to the fold's own writer.
      const weaveSignal = ac.signal && AbortSignal.any ? AbortSignal.any([ac.signal, AbortSignal.timeout(WEAVE_TIMEOUT_MS)]) : (AbortSignal.timeout ? AbortSignal.timeout(WEAVE_TIMEOUT_MS) : ac.signal);
      const gen = await client.generate(question, { base: bridge, artifact: "text", model: m?.id || null, signal: weaveSignal });
      const text = String(gen?.artifact?.value ?? "").trim();
      if (!text) throw new Error(gen?.error || "penelope's generation returned no piece");
      const units = (gen?.evidence?.units || []).map((u) => u.name);
      const stages = {};
      for (const o of gen?.evidence?.outcomes || []) stages[o.stage] = (stages[o.stage] || 0) + 1;
      const genRec = {
        generate: true,
        void: gen?.void ?? null,
        units,
        stages,
        verdict: gen?.verification?.verdict?.reason ?? null,
        materialization: gen?.materialization ?? null,
        model: gen?.model ?? null,
        status: gen?.status ?? "unverified",
      };
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: text, at: now(), generate: genRec });
      s.updated = now();
      maybeName(s);
      save("fold-chat:sessions", sessions);
      const live = body.closest(".msg"); if (live) live.remove();
      E.stage.textContent = "";
      appendMsg("assistant", text, { index: idx, grounding: genRec, model: m.id });
      renderChats();
      return true;
    } catch (err) {
      // Hand the turn back to the caller to write it here (the fold's own
      // writer). Never surface a raw backend error on a plain write request.
      E.stage.textContent = ""; body.classList.remove("live");
      return false;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus();
    }
  }

  E.composer.onsubmit = (e) => {
    e.preventDefault();
    const text = E.input.value.trim();
    if (!text) return;
    E.input.value = "";
    const s = sessions[activeId] || (newChat(), sessions[activeId]);
    s.messages.push({ role: "user", content: text, at: now() });
    // Learn the person's name only when they state it — never guessed.
    const learned = memory.extractStatedName(text);
    if (learned) { s.facts = { ...(s.facts || {}), name: learned }; readerName = learned; try { localStorage.setItem("fold-chat:reader", learned); } catch (e) {} }
    s.title = s.title === "New chat" ? text.slice(0, 46) : s.title;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    setView(false);
    appendMsg("user", text, { index: s.messages.length - 1 });
    renderChats();
    if (engagement === "code") runCode(activeId);
    else {
      if (!models.length) { toast("no model — start the heimdall bridge"); return; }
      run(activeId, false);
    }
  };
  E.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); E.composer.requestSubmit(); } });
  E.input.addEventListener("input", () => { E.input.style.height = "auto"; E.input.style.height = Math.min(E.input.scrollHeight, 200) + "px"; });

  /* ---------------- settings ---------------- */
  // The bridge, the preset, the theme, and the default mode — the surface's
  // configuration, kept out of the conversation sidebar.
  function applyPreset(next) {
    preset = next;
    try { localStorage.setItem("fold-chat:preset", preset); } catch (e) {}
    const s = sessions[activeId]; if (s) { s.preset = preset; save("fold-chat:sessions", sessions); }
  }
  function paintTheme() {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    for (const b of E.setTheme.querySelectorAll("button")) b.classList.toggle("on", b.dataset.theme === cur);
  }
  function paintModeSetting() { for (const b of E.setMode.querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === engagement); }
  function paintTransparency() { for (const b of E.setTransparency.querySelectorAll("button")) b.classList.toggle("on", b.dataset.transparency === (transparency ? "1" : "0")); }
  E.setTheme.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; document.documentElement.setAttribute("data-theme", b.dataset.theme); try { localStorage.setItem("fold-chat:theme", b.dataset.theme); } catch (e2) {} paintTheme(); };
  E.setMode.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setEngagement(b.dataset.mode); paintModeSetting(); };
  E.setTransparency.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setTransparency(b.dataset.transparency === "1"); paintTransparency(); };

  function openSettings() {
    for (const [k, p] of Object.entries(PRESETS)) if (!E.setPreset.querySelector(`option[value="${k}"]`)) E.setPreset.append(new Option(p.label, k));
    E.setBridge.value = bridge;
    E.setPreset.value = preset;
    paintTheme(); paintModeSetting(); paintTransparency();
    E.setAbout.innerHTML = `bridge <b>${esc(bridge)}</b> · version <b>v0.1</b> · cloud models are <b>sealed-external</b> by default; raw workspace tokens never leave.`;
    updateBridgeStatus();
    refreshKeyStatus();
    E.settingsModal.hidden = false;
    E.setBridge.focus();
  }
  function closeSettings() { E.settingsModal.hidden = true; }
  function saveSettings() {
    const next = E.setBridge.value.trim();
    if (next) { try { localStorage.setItem("fold-chat:bridge", next); } catch (e) {} }
    applyPreset(E.setPreset.value);
    closeSettings();
    toast("settings saved");
    // The bridge may have moved — re-list the models it serves.
    if (next && next !== bridge) location.reload();
  }
  // The bridge line under the field: found / not found, and the gate it reports.
  function updateBridgeStatus() {
    if (!E.bridgeStatus) return;
    if (bridgeHello) E.bridgeStatus.innerHTML = `connected · <b>${esc(bridge)}</b> — every model and the sealed-external gate route here.`;
    else if (bridge && models.length) E.bridgeStatus.innerHTML = `connected · <b>${esc(bridge)}</b>.`;
    else E.bridgeStatus.innerHTML = `not found — run <b>heimdall up</b>, then Detect.`;
  }
  E.bridgeDetect.onclick = async () => {
    E.bridgeStatus.textContent = "looking for heimdall…";
    const found = await client.detectBridge({ override: E.setBridge.value.trim() || null });
    if (found.ok) {
      bridge = found.base; bridgeHello = found.hello;
      E.setBridge.value = bridge;
      try { localStorage.setItem("fold-chat:bridge", bridge); } catch (e) {}
      await refreshModels();
      updateBridgeStatus();
      toast("heimdall found at " + bridge);
    } else {
      bridgeHello = null; updateBridgeStatus(); toast("no heimdall on localhost:8790");
    }
  };
  // Provider keys: posted to the localhost bridge, stored server-side (beside
  // `heimdall key`), and never kept in this page. The field is cleared on save.
  async function refreshKeyStatus() {
    if (!E.keyStatus) return;
    try {
      const j = await client.listProviderKeys({ base: bridge });
      const set = (j.providers || []).map((p) => p.provider);
      E.keyStatus.textContent = set.length ? "set on this machine: " + set.join(", ") : "No provider keys stored yet.";
    } catch { E.keyStatus.textContent = "heimdall bridge not answering — start it to store keys."; }
  }
  async function saveProviderKey(provider, input) {
    const key = (input.value || "").trim();
    if (!key) { toast("enter a key first"); input.focus(); return; }
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    const row = btn?.closest(".keyrow");
    try {
      const j = await client.setProviderKey(provider, key, { base: bridge });
      input.value = "";
      // Acknowledge unmistakably: the row itself turns "✓ saved".
      if (btn) { btn.textContent = "✓ saved"; btn.classList.add("saved"); }
      if (row) row.classList.add("saved");
      toast(`${provider} key stored on this machine`);
      const set = j.configured || [];
      E.keyStatus.textContent = set.length
        ? `saved on this machine: ${set.join(", ")} — ${j.frontierModels || 0} frontier model(s) reachable; keys are used server-side, never by this page.`
        : "No provider keys stored yet.";
      await refreshModels();
    } catch (e) {
      if (btn) btn.classList.add("err");
      E.keyStatus.textContent = `could not store the ${provider} key: ${String(e.message || e)}`;
      toast(String(e.message || e));
    }
  }
  for (const [provider, input] of [["anthropic", E.keyAnthropic], ["openai", E.keyOpenai]]) {
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    if (btn) btn.onclick = () => saveProviderKey(provider, input);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveProviderKey(provider, input); } });
  }
  E.railSettings.onclick = openSettings;
  E.settingsClose.onclick = E.settingsCancel.onclick = closeSettings;
  E.settingsSave.onclick = saveSettings;
  E.settingsModal.addEventListener("click", (e) => { if (e.target === E.settingsModal) closeSettings(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !E.settingsModal.hidden) closeSettings(); });

  /* ---------------- evidence drawer ---------------- */
  async function refreshMeter() { try { meterInfo = await client.meter({ base: bridge }); } catch { meterInfo = null; } }
  async function toggleDrawer() {
    const open = E.drawer.style.display === "none";
    E.drawer.style.display = open ? "" : "none";
    if (!open) return;
    E.drawer.innerHTML = "";
    const f = await client.frontier({ base: bridge }).catch(() => null);
    const led = await client.ledger({ base: bridge }).catch(() => null);
    await refreshMeter();
    const c = meterInfo?.counts || {};
    const head = el("div");
    head.innerHTML = `<h3>secure chat with outside models</h3><p>${esc(f?.gate || "the bridge reports no frontier gate yet.")}</p>
      <p class="invariant"><b>RAW WORKSPACE TOKENS SENT TO EXTERNAL MODELS</b> — this chat never sends raw material; the ledger records what actually left.</p>
      <p>local ${c["deterministic/local"] ?? 0} · remote ${c["open remote"] ?? 0} · frontier ${c.frontier ?? 0} · external tokens ${meterInfo?.externalTokens ?? 0}</p>`;
    E.drawer.append(head);
    if (led?.entries?.length) {
      const table = el("table", "ledger");
      const hr = el("tr"); for (const h of ["at", "selected", "reason", "tokens", "ok"]) hr.append(el("th", "", h)); table.append(hr);
      for (const e of led.entries.slice(-12).reverse()) {
        const tr = el("tr");
        tr.append(el("td", "", String(e.at || "").slice(11, 19)), el("td", "", e.selected || ""), el("td", "", e.reason || ""), el("td", "", e.actual?.outputTokens ?? ""), el("td", "", e.actual?.accepted ? "yes" : "no"));
        table.append(tr);
      }
      E.drawer.append(table);
    } else E.drawer.append(el("p", "empty-hint", "no dispatch records yet — send a message."));
  }

  /* ---------------- collapsible sections ---------------- */
  for (const head of document.querySelectorAll(".sec-head")) {
    const sec = head.closest(".sec");
    const key = sec?.dataset.sec;
    if (key && collapsed[key]) sec.classList.add("collapsed");
    head.onclick = (e) => {
      if (e.target.closest("button")) return;
      sec.classList.toggle("collapsed");
      if (key) { collapsed[key] = sec.classList.contains("collapsed"); save("fold-chat:collapse", collapsed); }
    };
  }

  /* ---------------- rail / topbar ---------------- */
  E.railToggle.onclick = () => { E.side.classList.toggle("hide"); E.railToggle.classList.toggle("on", !E.side.classList.contains("hide")); };
  for (const b of [E.railNew, E.chatNew, E.topNew, E.topPlus]) if (b) b.onclick = newChat;
  E.railSearch.onclick = async () => {
    const q = await askDialog({ title: "Search chats", value: search, placeholder: "Search titles", okLabel: "Search" });
    if (q == null) return;
    search = q.trim();
    renderChats();
  };
  E.railEvidence.onclick = E.footEvidence.onclick = (e) => { e.preventDefault(); toggleDrawer(); };
  E.railTheme.onclick = () => { const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("fold-chat:theme", cur); } catch (e) {} };
  E.topFocus.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  // Grounding disclosure — per THREAD. Each conversation decides whether its
  // turns carry the grounding record. The toggle sits on the open thread and
  // the setting lives on the session, so a fork/continue inherits it.
  function threadGroundingOn() { return sessions[activeId]?.grounding !== false; }
  function paintGrounding() { if (!E.groundToggle) return; E.groundToggle.hidden = !activeId; E.groundToggle.classList.toggle("on", threadGroundingOn()); }
  function setGrounding(on) {
    if (!activeId || !sessions[activeId]) return;
    sessions[activeId].grounding = !!on;
    sessions[activeId].updated = now();
    save("fold-chat:sessions", sessions);
    toast(on ? "grounding on — this thread shows its disclosure" : "grounding off — this thread hides its disclosure");
    open(activeId);
  }
  if (E.groundToggle) E.groundToggle.onclick = () => setGrounding(!threadGroundingOn());
  // Web search on/off — a turn searches the keyless sources and grounds on them.
  function paintWeb() { if (E.webToggle) E.webToggle.classList.toggle("on", webOn); }
  if (E.webToggle) E.webToggle.onclick = () => {
    webOn = !webOn;
    try { localStorage.setItem("fold-chat:web", webOn ? "1" : "0"); } catch (e) {}
    paintWeb();
    toast(webOn ? "web search on — answers will ground on the sources" : "web search off");
  };
  // Attachments are READ THROUGH THE KHORA, never forwarded raw. The file's
  // bytes go to the bridge's read door (→ the khora's model-free constitutional
  // reader), and only the READING (referents, relations, basis) enters the
  // thread and the model's context. The raw file never leaves this page.
  E.attach.onclick = () => {
    const pick = document.createElement("input");
    pick.type = "file";
    pick.accept = ".txt,.md,.csv,.tsv,.json,.html,.js,.mjs,.srt,.vtt,.eml,.log";
    pick.onchange = async () => {
      const file = pick.files?.[0];
      if (!file) return;
      E.stage.textContent = "reading · the khora reads the attachment (model-free)…";
      try {
        const raw = await file.text();
        const reading = await client.read(raw, { base: bridge, source: file.name, sessionId: sessions[activeId]?.codeSessionId || null });
        const s = sessions[activeId] || (newChat(), sessions[activeId]);
        const note = readingNote(file.name, raw.length, reading);
        s.attachments = [...(s.attachments || []), { name: file.name, bytes: raw.length, referents: (reading.referents || []).length, relations: (reading.relations || []).length }];
        // The reading rides the history as grounded material — never the raw
        // file. The model receives what the khora read, not what was uploaded.
        s.messages.push({ role: "user", content: note, at: now(), attachment: file.name });
        s.updated = now();
        save("fold-chat:sessions", sessions);
        appendMsg("user", note, { attachment: file.name });
        E.stage.textContent = "";
        toast(`read ${file.name} through the khora — ${(reading.referents || []).length} referent(s), ${(reading.relations || []).length} relation(s)`);
      } catch (err) {
        E.stage.textContent = "";
        toast("khora read failed: " + err.message);
      }
    };
    pick.click();
  };
  E.mic.onclick = () => toast("voice is not wired yet");

  /** Render a khora reading (EORead@1) as a grounded note for the thread —
   *  referents, relations, basis; the raw bytes are never shown or sent. */
  function readingNote(name, bytes, r) {
    const refs = (r.referents || []).map((x) => (x.surfaces || []).join("/")).filter(Boolean).slice(0, 20);
    const rels = (r.relations || []).map((x) => `${x.end1 ?? x.subject ?? ""} ${x.label ?? x.relation ?? ""} ${x.end2 ?? x.object ?? ""}`.trim()).filter(Boolean).slice(0, 20);
    return [
      `[attachment read by the khora · ${name} · ${bytes} bytes]`,
      `basis: ${r.basis || "constitutional read"}`,
      refs.length ? `referents: ${refs.join(", ")}` : "referents: none admitted",
      rels.length ? `relations: ${rels.join("; ")}` : "relations: none admitted",
      (r.stagesNotRun || []).length ? `stages not run: ${(r.stagesNotRun || []).join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }

  /* ---------------- boot ---------------- */
  try { const t = localStorage.getItem("fold-chat:theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  renderProjects();
  paintWeb();
  paintGrounding();
  // Auto-detect the bridge first (the override, then the standard local port),
  // then list whatever it serves. A page served from GitHub Pages finds the
  // person's own heimdall this way, with no URL to type.
  client.detectBridge({ override: opts.bridge || localStorage.getItem("fold-chat:bridge") || null }).then((found) => {
    if (found.ok) { bridge = found.base; bridgeHello = found.hello; }
    else toast("heimdall not found — run `heimdall up`");
    // The machine door's own UI URL, kept for the optional "open ↗" affordance;
    // code turns run over the bridge regardless.
    client.codeStatus({ base: bridge }).then((st) => { if (st?.url) codeUi = st.url; }).catch(() => {});
    refreshModels().then(() => {
      const first = Object.values(sessions).sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0))[0];
      if (first) open(first.id); else newChat();
      refreshMeter();
      updateBridgeStatus();
    });
  });
}