// dock.mjs — THE DOCK: the surface frame with no medium in it.
//
// Fold invariant: THE FRAME KNOWS SLOTS, NOT SUBJECTS. Six slots by ROLE —
// subject (the one thing attended to), sources (where things came from),
// measures (numbers with their basis), objects (the things named), relations
// (how they connect), rows (the ledger of acts). Nothing here says plan,
// agency, place, district or any other medium's noun; a civic surface, a maths
// bench and a lab notebook fill the same six slots with different adapters.
//
// An ITEM is { id, title, body?, address, status?, chips? }. `address` is the
// provenance and is REQUIRED — an item without one is refused unless it says
// `ungrounded: true`, in which case it is drawn as such (the gate's own rule:
// a row without provenance is not a row).
//
// Every visible name is a <span data-h="ns:id"> carrying the handle's id, so
// a settings change relabels the page live and never touches an id.
import { resolveHandles, labelOf } from "./handles.mjs";

export const DOCK_SCHEMA = "EODock@1";

export const DOCK_SLOTS = Object.freeze([
  { id: "subject",   terrain: "lens",    zone: "center", role: "the one thing being attended to" },
  { id: "sources",   terrain: "void",    zone: "left",   role: "where each thing came from" },
  { id: "measures",  terrain: "field",   zone: "right",  role: "numbers, each with its basis" },
  { id: "objects",   terrain: "entity",  zone: "top",    role: "the things that are named" },
  { id: "relations", terrain: "network", zone: "center", role: "how the named things connect" },
  { id: "rows",      terrain: "link",    zone: "drawer", role: "the append-only record of acts" },
]);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const H = (handles, ns, id) => `<span data-h="${ns}:${id}">${esc(labelOf(handles, ns, id))}</span>`;

/** checkItems(items) -> { ok, refused:[{id, reason}] } */
export function checkItems(items = []) {
  const refused = [];
  for (const it of items) {
    if (!it?.id) refused.push({ id: it?.id ?? null, reason: "no id" });
    else if (!it.address && !it.ungrounded) refused.push({ id: it.id, reason: "no address — say `ungrounded: true` or give one" });
  }
  return { ok: refused.length === 0, refused };
}

function itemHtml(it, handles) {
  const status = it.status ? `<span class="st st-${esc(it.status)}">${H(handles, "status", it.status)}</span>` : "";
  const addr = it.address ? `<code class="addr">${esc(it.address)}</code>` : `<em class="ungrounded">ungrounded</em>`;
  const chips = (it.chips ?? []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")
    + (it.via ? `<span class="chip via" title="how it was read">${esc(it.via)}</span>` : "")
    + (it.count > 1 ? `<span class="chip">×${it.count}</span>` : "")
    + (it.kind ? `<span class="chip kind">${esc(it.kind)}</span>` : "")
    + (it.origin ? `<span class="chip origin" title="${esc(`produced by: ${it.origin.label} · config ${it.origin.config}`)}">from ${esc(it.origin.label)}</span>` : "");
  return `<article class="item" data-id="${esc(it.id)}"><h3>${esc(it.title ?? it.id)} ${status}</h3>${it.body ? (String(it.body).length > 240 ? `<p>${esc(String(it.body).slice(0, 240))}… <details class="more"><summary>the rest</summary>${esc(it.body)}</details></p>` : `<p>${esc(it.body)}</p>`) : ""}<p class="prov">${addr}${chips}</p></article>`;
}

/** renderSlot(slot, content, handles) -> { html, refused }
 *  The one place a slot is drawn — the server render and the page's live
 *  re-render both call it, so they cannot drift. The slot always says where its
 *  items came from: the chosen adapter with what it finds and does NOT find, or
 *  a fixed origin the caller names (the ledger), or that none was chosen. */
export function renderSlot(slot, c = { items: [] }, handles) {
  const chk = checkItems(c.items);
  const bad = new Set(chk.refused.map((r) => r.id));
  const shown = (c.items ?? []).filter((i) => !bad.has(i.id)).map((i) => itemHtml(i, handles)).join("");
  const refusals = chk.refused.map((r) => `<p class="refused">refused: ${esc(r.id ?? "(no id)")} — ${esc(r.reason)}</p>`).join("")
    + (c.refused?.length ? `<p class="refused">${c.refused.length} match(es) dropped: their address did not read back as their own text</p>` : "")
    + (c.unread?.length ? `<details class="unread" open><summary class="refused">${c.unread.length} mention(s) seen, still not read</summary>${c.unread.map((u) => `<p><code>${esc(u.doc)}#${u.at[0]}-${u.at[1]}</code> ${esc(u.why ?? "")} — <q>${esc(u.quote ?? "")}</q></p>`).join("")}</details>` : c.unread ? `<p class="origin-fixed">every mention the reader saw was read</p>` : "")
    + (c.truncated ? `<p class="refused">stopped at the match ceiling — more exist than are drawn</p>` : "");
  const origin = c.origin
    ? `<details class="origin"><summary>from: <b>${esc(c.origin.label)}</b> <span class="n">${(c.items ?? []).length} found</span></summary><p><b>finds</b> ${esc(c.origin.finds)}</p><p><b>does not find</b> ${esc(c.origin.misses)}</p></details>`
    : c.fixedOrigin ? `<p class="origin-fixed">from: ${esc(c.fixedOrigin)}</p>`
    : `<p class="origin-fixed">from: nothing chosen — pick an origin in settings</p>`;
  const html = `<section class="slot zone-${slot.zone}" data-slot="${slot.id}"><h2><span class="terrain">${H(handles, "terrain", slot.terrain)}</span> ${H(handles, "slot", slot.id)}</h2><p class="role">${esc(slot.role)}</p>${origin}${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}<div class="items">${shown || '<p class="empty">nothing here yet</p>'}</div>${refusals}</section>`;
  return { html, refused: chk.refused };
}

/** renderDock({ content, overrides }) -> { html, refused, rejectedHandles } */
export function renderDock({ content = {}, overrides = {}, title = "" } = {}) {
  const { handles, rejected } = resolveHandles(overrides);
  const refusedAll = [];
  const sections = DOCK_SLOTS.map((slot) => { const r = renderSlot(slot, content[slot.id], handles); refusedAll.push(...r.refused.map((x) => ({ slot: slot.id, ...x }))); return r.html; });
  return { html: `<div class="dock" data-schema="${DOCK_SCHEMA}">${title ? `<h1>${esc(title)}</h1>` : ""}${sections.join("")}</div>`, refused: refusedAll, rejectedHandles: rejected };
}

/** renderOriginSettings(config, registry) -> html: for every slot some adapter
 *  serves, a chooser and a configuration box that says how to write it. */
export function renderOriginSettings(config = {}, registry = {}) {
  const adapters = Object.values(registry);
  const slots = DOCK_SLOTS.filter((sl) => adapters.some((a) => a.slots.includes(sl.id)));
  const one = (sl) => {
    const cur = config?.[sl.id] ?? {};
    const opts = adapters.filter((a) => a.slots.includes(sl.id));
    const cfg = registry[cur.adapter];
    return `<fieldset data-origin-slot="${sl.id}"><legend>${H(resolveHandles({}).handles, "slot", sl.id)} comes from</legend>
      <select data-origin-adapter><option value="">— nothing chosen —</option>${opts.map((a) => `<option value="${esc(a.id)}"${a.id === cur.adapter ? " selected" : ""}>${esc(a.label)}${a.runsIn === "node" ? " (computed on the server)" : ""}</option>`).join("")}</select>
      <textarea data-origin-text rows="4" spellcheck="false" placeholder="${esc(cfg?.configHelp ?? "choose an origin to see how to configure it")}">${esc(cur.text ?? "")}</textarea>
      <p class="err" role="alert"></p></fieldset>`;
  };
  return `<form class="origins-settings" onsubmit="return false"><p>Choose where each slot's things come from, and how. Every item is stamped with its origin; nothing is filled by an unnamed method.</p>${slots.map(one).join("")}</form>`;
}

/** renderSettings(overrides) -> html for the rename panel. Each input is keyed
 *  data-ns/data-id and shows the default as its placeholder; empty = default. */
export function renderSettings(overrides = {}) {
  const { handles } = resolveHandles(overrides);
  const NAMES = { terrain: "Terrains", status: "Claim statuses", slot: "Dock slots", surface: "Surfaces" };
  const group = (ns) => `<fieldset><legend>${NAMES[ns]}</legend>${Object.keys(handles[ns]).map((id) => {
    const given = overrides?.[ns]?.[id] ?? "";
    return `<label><code>${esc(ns)}:${esc(id)}</code><input data-ns="${ns}" data-id="${esc(id)}" maxlength="32" value="${esc(given)}" placeholder="${esc(handles[ns][id])}"></label>`;
  }).join("")}</fieldset>`;
  return `<form class="handles-settings" onsubmit="return false"><p>Rename what you see. Ids, addresses and hashes never change — only the words drawn.</p>${Object.keys(NAMES).map(group).join("")}<p class="err" role="alert"></p></form>`;
}

/** The client half, as a string to inline: loads overrides from localStorage,
 *  relabels every [data-h], saves on input. Validation is the SAME module's
 *  rules (handles.mjs is served beside it and imported by the page). */
export const SETTINGS_SCRIPT = `
import { resolveHandles, setHandle } from "./handles.mjs";
import { DOCK_SLOTS, renderSlot } from "./dock.mjs";
import { makeRegistry, fillSlots } from "./origins.mjs";
const KEY = "fold-handles";
let overrides = {}; try { overrides = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
const apply = () => { const { handles } = resolveHandles(overrides);
  document.querySelectorAll("[data-h]").forEach((el) => { const [ns, id] = el.dataset.h.split(":"); if (handles[ns]?.[id]) el.textContent = handles[ns][id]; }); };
apply();
document.querySelectorAll(".handles-settings input").forEach((inp) => inp.addEventListener("input", () => {
  const r = setHandle(overrides, inp.dataset.ns, inp.dataset.id, inp.value);
  const err = inp.closest("form").querySelector(".err");
  if (r.error) { err.textContent = inp.dataset.ns + ":" + inp.dataset.id + " — " + r.error; return; }
  err.textContent = ""; overrides = r.overrides; try { localStorage.setItem(KEY, JSON.stringify(overrides)); } catch {} apply();
}));

// ── where things come from ──
const OKEY = "fold-origins";
const texts = JSON.parse(document.getElementById("fold-texts")?.textContent || "[]");
const nodeContent = JSON.parse(document.getElementById("fold-node-content")?.textContent || "{}");
const registry = makeRegistry();
let origins = {}; try { origins = JSON.parse(localStorage.getItem(OKEY) || "null") || JSON.parse(document.getElementById("fold-origin-default")?.textContent || "{}"); } catch {}
const redraw = () => {
  const { handles } = resolveHandles(overrides);
  const live = fillSlots({ config: Object.fromEntries(Object.entries(origins).filter(([, v]) => registry[v.adapter])), registry, texts });
  for (const slot of DOCK_SLOTS) {
    if (!document.querySelector('.origins-settings fieldset[data-origin-slot="' + slot.id + '"]')) continue; // ledger-fed slots are not re-filled here
    const sel = origins[slot.id];
    const c = !sel?.adapter ? { items: [] } : registry[sel.adapter] ? live.content[slot.id] : (nodeContent[slot.id] ?? { items: [] });
    const el = document.querySelector('.slot[data-slot="' + slot.id + '"]'); if (el) el.outerHTML = renderSlot(slot, c ?? { items: [] }, handles).html;
  }
  apply();
};
document.querySelectorAll(".origins-settings fieldset").forEach((fs) => {
  const slot = fs.dataset.originSlot, err = fs.querySelector(".err");
  const read = () => { const adapter = fs.querySelector("[data-origin-adapter]").value, text = fs.querySelector("[data-origin-text]").value;
    if (!adapter) delete origins[slot]; else origins[slot] = { adapter, text };
    const a = registry[adapter]; const parsed = a ? a.parseConfig(text) : {}; err.textContent = parsed.error || (adapter && !a ? "computed on the server; not re-run here" : "");
    try { localStorage.setItem(OKEY, JSON.stringify(origins)); } catch {} redraw(); };
  fs.querySelector("[data-origin-adapter]").addEventListener("change", read); fs.querySelector("[data-origin-text]").addEventListener("input", read);
});
redraw();
`;