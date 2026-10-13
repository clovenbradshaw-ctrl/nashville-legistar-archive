// fold-chat-monitor.js — a live window on everything that leaves this machine, and how it was anonymized.
//
// The outbound ledger (fold-chat-outbound.js) already records every external call before it leaves. This is its
// always-available face: one row per call, newest first, each saying in plain words whether the private details were
// taken out, how many and of what kind, and whether anything was flagged. Click a row to read the exact text that was
// sent with every placeholder marked, so a person can see for themselves what the outside service could and could
// not read.
//
// What it shows is only what the ledger holds: the text as sent (already masked), counts by kind, grades, leaks.
// The originals behind a placeholder live in the masker's closure for one request and are not available here —
// this panel cannot reveal them, by design.
//
// The row-shaping functions are pure (no DOM) and tested; the rendering touches the DOM only when called.

import { formatBytes } from "./fold-chat-outbound.js";

const KINDS = { PERSON: ["person name", "person names"], NAME: ["name", "names"], ORG: ["organisation", "organisations"], LOC: ["place", "places"], GROUP: ["group", "groups"], URL: ["link", "links"], HANDLE: ["handle", "handles"], ADDRESS: ["street address", "street addresses"], USER: ["username", "usernames"], PATH: ["folder path", "folder paths"], FILE: ["file name", "file names"], TERM: ["name or term", "names & terms"], EMAIL: ["email", "emails"], PHONE: ["phone number", "phone numbers"], SECRET: ["credential", "credentials"], HOST: ["private host", "private hosts"], ID: ["ID number", "ID numbers"] };
const kindWord = (k, n = 2) => { const w = KINDS[k]; return w ? w[n === 1 ? 0 : 1] : k.toLowerCase(); };
const PH = /\b(PERSON|NAME|ORG|LOC|GROUP|URL|HANDLE|ADDRESS|USER|PATH|FILE|TERM|EMAIL|PHONE|SECRET|HOST|ID)_[a-hj-km-np-z2-9]{6}\b/gi;

/** Split a text into plain and placeholder pieces: [{ text, kind? }]. A piece with a kind is a placeholder. */
export function placeholderPieces(text) {
  const s = String(text ?? "");
  const out = [];
  let last = 0;
  for (const m of s.matchAll(PH)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[0], kind: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

const kindsLine = (kinds) => Object.entries(kinds || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${kindWord(k, n)}`).join(", ");

/** One ledger entry, in the terms a person needs: where it went, and what happened to the private details. */
export function describeEntry(e) {
  const level = e.grade?.level || "gate";
  const leaks = e.grade?.leaks || [];
  const m = e.masking || null;
  let state, tone, detail;
  if (level === "masked") {
    if (m) { state = m.count ? `masked — ${m.count} detail${m.count === 1 ? "" : "s"} taken out` : "masked — nothing private found to take out"; detail = kindsLine(m.kinds) + (m.viaRead ? (m.count ? " · names found by the local read" : "") : ""); }
    else { state = "masked"; detail = "the masker did not report what it took out"; }
    tone = leaks.length ? "bad" : "ok";
  } else if (level === "worlds" || level === "abstract") {
    state = level === "worlds" ? "sent as possible worlds" : "sent abstracted"; detail = "the real content was not sent"; tone = leaks.length ? "bad" : "ok";
  } else if (level === "direct") {
    state = "direct — the query text itself leaves"; detail = "a public service, not behind the gate"; tone = leaks.length ? "bad" : "warn";
  } else if (m && m.count > 0 && leaks.length) {
    // The masker took details out, but the ledger's own check still found a leak-shaped pattern in what was sent. Both facts, not just the worse one.
    state = `masked ${m.count}, but ${leaks.length} pattern${leaks.length === 1 ? "" : "s"} still flagged`;
    detail = [...new Set(leaks.map((l) => l.kind || l.type))].join(", "); tone = "bad";
  } else {
    state = "NOT anonymized — raw content"; detail = "sent under the gate with nothing taken out"; tone = "bad";
  }
  return {
    id: e.id, n: e.n, time: String(e.at || "").slice(11, 19), host: e.host || "?", model: e.model || null, via: e.via, purpose: e.purpose || e.kind || "",
    state, detail, tone, level, leaks, bytes: e.bytes || 0, status: e.status || "", error: e.error || null,
    verified: e.via === "heimdall" ? (e.verification ? e.verification.verified : null) : undefined,
    maskedCount: m?.count || 0,
  };
}

/** The headline across a set of entries, computed and never asserted. */
export function monitorSummary(entries) {
  const rows = entries.map(describeEntry);
  const kinds = {};
  for (const e of entries) for (const [k, n] of Object.entries(e.masking?.kinds || {})) kinds[k] = (kinds[k] || 0) + n;
  return {
    calls: rows.length,
    hosts: [...new Set(rows.map((r) => r.host))],
    masked: rows.filter((r) => r.level === "masked").length,
    unanonymized: rows.filter((r) => r.level === "gate").length,
    direct: rows.filter((r) => r.level === "direct").length,
    flagged: rows.filter((r) => r.leaks.length).length,
    detailsTaken: rows.reduce((n, r) => n + r.maskedCount, 0),
    kinds,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}

/** The filters the panel offers. Pure so the tests can pin them. */
export const FILTERS = {
  all: () => true,
  model: (e) => e.kind === "model",
  web: (e) => e.kind !== "model",
  attention: (e) => (e.grade?.level === "gate") || (e.grade?.leaks || []).length > 0 || e.status === "failed" || e.verification?.verified === false,
};

const CSS = `
.mon-btn{position:relative}
.mon-btn[data-alert="1"]::after{content:"";position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:#c0392b}
.mon{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:60;background:var(--side,#f6f5f2);color:var(--ink,#1a1a1a);border-left:1px solid var(--line,#ddd);display:flex;flex-direction:column;font-size:var(--fs-sm,13px);box-shadow:-8px 0 24px rgba(0,0,0,.12)}
.mon[hidden]{display:none}
.mon-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#ddd)}
.mon-head h3{margin:0;font-size:var(--fs-sm,13px);letter-spacing:.06em;text-transform:uppercase;color:var(--mut,#666)}
.mon-head .mon-x{margin-left:auto}
.mon-sum{padding:10px 14px;border-bottom:1px solid var(--line,#ddd);line-height:1.5}
.mon-sum b{font-weight:600}
.mon-filters{display:flex;gap:6px;padding:8px 14px;border-bottom:1px solid var(--line,#ddd);flex-wrap:wrap}
.mon-filters button,.mon-btn2{font:inherit;border:1px solid var(--line,#ccc);background:transparent;color:inherit;border-radius:999px;padding:3px 10px;cursor:pointer}
.mon-filters button[aria-pressed="true"]{background:var(--ink,#1a1a1a);color:var(--bg,#fff)}
.mon-list{overflow-y:auto;flex:1;padding:6px 0}
.mon-row{border-bottom:1px solid var(--line,#e6e6e6);padding:8px 14px}
.mon-top{display:flex;gap:8px;align-items:baseline;cursor:pointer}
.mon-top:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.mon-t{color:var(--mut,#777);font-variant-numeric:tabular-nums}
.mon-host{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mon-pill{margin-left:auto;border-radius:999px;padding:1px 8px;font-size:11px;white-space:nowrap;border:1px solid}
.mon-pill.ok{color:#1e7a46;border-color:#1e7a46}.mon-pill.warn{color:#9a6700;border-color:#9a6700}.mon-pill.bad{color:#c0392b;border-color:#c0392b}
.mon-sub{color:var(--mut,#666);margin-top:2px}
.mon-det{margin-top:8px}
.mon-det[hidden]{display:none}
.mon-pre{white-space:pre-wrap;word-break:break-word;background:rgba(127,127,127,.1);border-radius:6px;padding:8px;margin:6px 0;max-height:260px;overflow:auto;font:12px/1.45 ui-monospace,Menlo,monospace}
.mon-pre mark{background:#ffe08a;color:#1a1a1a;border-radius:3px;padding:0 2px}
.mon-leak{color:#c0392b}
.mon-empty{padding:18px 14px;color:var(--mut,#666)}
`;

/** Build the panel into `container` and keep it live. Returns { refresh, destroy }. */
export function renderMonitor(container, outbound, { filter = "all", doc = typeof document !== "undefined" ? document : null } = {}) {
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let current = filter;
  const open = new Set();
  const sum = el("div", "mon-sum");
  const filters = el("div", "mon-filters");
  const list = el("div", "mon-list");
  list.setAttribute("aria-live", "polite");
  const labels = { all: "all", model: "models", web: "web", attention: "needs attention" };
  for (const k of Object.keys(FILTERS)) {
    const b = el("button", "", labels[k]); b.type = "button"; b.dataset.filter = k; b.setAttribute("aria-pressed", k === current ? "true" : "false");
    b.onclick = () => { current = k; for (const x of filters.children) x.setAttribute("aria-pressed", x.dataset.filter === k ? "true" : "false"); draw(); };
    filters.append(b);
  }
  container.append(sum, filters, list);

  function drawSummary(all) {
    const s = monitorSummary(all);
    sum.textContent = "";
    if (!s.calls) { sum.append(el("span", "", "Nothing has left this machine in this session. Local models, local reads and the khora never leave it.")); return; }
    const line = el("div");
    const b = (t) => { const x = el("b", "", t); return x; };
    line.append(b(String(s.calls)), ` call${s.calls === 1 ? "" : "s"} to ${s.hosts.length} host${s.hosts.length === 1 ? "" : "s"} · `, b(String(s.masked)), " masked · ",
      b(String(s.unanonymized)), " not anonymized · ", b(String(s.direct)), " direct");
    sum.append(line);
    const k = kindsLine(s.kinds);
    sum.append(el("div", "mon-sub", s.detailsTaken ? `${s.detailsTaken} private detail${s.detailsTaken === 1 ? "" : "s"} taken out (${k})` : "no private details were found to take out"));
    if (s.flagged || s.failed) sum.append(el("div", "mon-leak", [s.flagged ? `⚠ ${s.flagged} flagged` : "", s.failed ? `${s.failed} failed` : ""].filter(Boolean).join(" · ")));
  }

  function drawRow(e) {
    const d = describeEntry(e);
    const row = el("div", "mon-row"); row.dataset.entry = e.id;
    const top = el("div", "mon-top"); top.tabIndex = 0; top.setAttribute("role", "button");
    top.append(el("span", "mon-t", d.time), el("span", "mon-host", (d.model ? d.model + " · " : "") + d.host), el("span", "mon-pill " + d.tone, d.state));
    row.append(top);
    row.append(el("div", "mon-sub", [d.detail, d.purpose, d.status === "failed" ? "failed" + (d.error ? ": " + d.error : "") : ""].filter(Boolean).join(" · ")));
    for (const l of d.leaks) row.append(el("div", "mon-leak", `⚠ ${l.type}: ${l.kind || l.term || ""}${l.detail ? " — " + l.detail : ""}`));
    const det = el("div", "mon-det"); det.hidden = !open.has(e.id);
    det.append(el("div", "mon-sub", `${formatBytes(d.bytes)} on the wire${d.verified === true ? " · ✓ heimdall's own ledger agrees" : d.verified === false ? " · ✗ heimdall's ledger disagrees" : d.via === "heimdall" ? " · not yet verified" : ""}`));
    det.append(el("div", "mon-sub", "exactly what was sent — highlighted words are placeholders standing in for private details"));
    for (const m of e.messages || []) {
      const pre = el("div", "mon-pre");
      pre.append(el("div", "mon-sub", `[${m.role}]`));
      const body = String(m.content ?? "").slice(0, 6000);
      for (const p of placeholderPieces(body)) {
        if (p.kind) { const mk = el("mark", "", p.text); mk.title = kindWord(p.kind, 1); pre.append(mk); } else pre.append(doc.createTextNode(p.text));
      }
      if (String(m.content ?? "").length > 6000) pre.append(el("div", "mon-sub", `… (${String(m.content).length - 6000} more characters)`));
      det.append(pre);
    }
    const toggle = () => { det.hidden = !det.hidden; det.hidden ? open.delete(e.id) : open.add(e.id); };
    top.onclick = toggle;
    top.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } };
    row.append(det);
    return row;
  }

  function draw() {
    const all = outbound.list();
    drawSummary(all);
    list.textContent = "";
    const shown = all.filter(FILTERS[current] || FILTERS.all).slice(-60).reverse();
    if (!shown.length) { list.append(el("div", "mon-empty", all.length ? "No calls match this filter." : "Waiting for the first external call…")); return; }
    for (const e of shown) list.append(drawRow(e));
  }
  draw();
  const off = outbound.onChange(() => draw());
  return { refresh: draw, destroy: () => off() };
}

/** Add the monitor to the page: a rail button and a docked panel, opened on demand. Self-contained — no markup or CSS elsewhere. */
export function mountMonitor({ outbound, doc = document } = {}) {
  if (doc.getElementById("monPanel")) return null;
  const style = doc.createElement("style"); style.textContent = CSS; doc.head.append(style);
  const panel = doc.createElement("aside"); panel.id = "monPanel"; panel.className = "mon"; panel.hidden = true;
  panel.setAttribute("aria-label", "External calls monitor");
  const head = doc.createElement("div"); head.className = "mon-head";
  const h = doc.createElement("h3"); h.textContent = "external calls";
  const x = doc.createElement("button"); x.type = "button"; x.className = "mon-btn2 mon-x"; x.textContent = "close"; x.setAttribute("aria-label", "Close the external calls monitor");
  head.append(h, x); panel.append(head);
  doc.body.append(panel);
  let view = null;
  const btn = doc.createElement("button"); btn.type = "button"; btn.id = "railMonitor"; btn.className = "mon-btn";
  btn.title = "External calls — what left, and how it was anonymized"; btn.setAttribute("aria-label", btn.title); btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>';
  const rail = doc.querySelector("nav.rail"); const sp = rail?.querySelector(".sp");
  if (rail) rail.insertBefore(btn, sp || null); else doc.body.append(btn);
  const alert = () => { const a = outbound.list().some(FILTERS.attention); if (a) btn.dataset.alert = "1"; else delete btn.dataset.alert; };
  outbound.onChange(alert); alert();
  const set = (on) => {
    panel.hidden = !on; btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (on && !view) view = renderMonitor(panel, outbound, { doc });
    else if (on) view.refresh();
    if (on) x.focus(); else btn.focus();
  };
  btn.onclick = () => set(panel.hidden);
  x.onclick = () => set(false);
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden && !e.defaultPrevented) { e.preventDefault(); set(false); } });
  return { open: () => set(true), close: () => set(false), button: btn, panel };
}
