// fold-chat-outbound.js — the browser's half of the outbound audit.
//
// Everything this page sends to anything that is not this machine is recorded
// HERE, before it leaves, with the exact content, where it went, how it was
// graded (fold-chat-seal.js) and — once it has answered — whether heimdall's own
// ledger agrees about what left (heimdall/src/audit.js). Two ledgers that must
// agree is the point: a surface's account of what it sent is only a claim until
// the door the bytes went through says the same thing.
//
// Two kinds of exit exist and both are recorded:
//   via "heimdall"  a model request through the bridge's sealed gate. The bridge
//                   holds the exact wire bytes; this ledger verifies against them.
//   via "direct"    the page itself talking to a public service (web search,
//                   page reads). NOT behind heimdall's gate; graded "direct" and
//                   never shown as sealed. The query text is what leaves.
//
// The REAL index of a world set and the symbol→referent mapping (the key) are held
// by the caller and are never recorded here or anywhere that is sent.

import { gradeRequest, verifyAgainst, withProvenance } from "./fold-chat-seal.js";

const hostOf = (url) => { try { const u = new URL(url, "http://local.invalid"); return { host: u.host, path: u.pathname, search: u.search }; } catch { return { host: null, path: null, search: "" }; } };
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/;

/** What the de-identifier masked in a request, as the ledger may keep it: how many, of which kinds, whether the holograph read helped.
 *  Counts only. The originals live in the masker's closure and never reach here, so this can be stored and exported. */
export function cleanMasking(m) {
  if (!m || typeof m !== "object") return null;
  const kinds = {};
  for (const [k, v] of Object.entries(m.kinds || {})) if (/^[A-Z]{2,8}$/.test(k) && Number.isFinite(+v)) kinds[k] = Math.max(0, Math.floor(+v));
  return { count: Math.max(0, Math.floor(+m.count || 0)), kinds, viaRead: !!m.viaRead };
}

/** Is this URL on this machine? A loopback call is not an exit. */
export function isLocalUrl(url) { const { host } = hostOf(url); return !host || host === "local.invalid" || LOOPBACK.test(host); }

export function createOutbound({ storage = null, key = "fold-chat:outbound", max = 150, now = () => new Date().toISOString(), taint = null, auditUrl = null, fetchImpl = (...a) => fetch(...a) } = {}) {
  let entries = [];
  let seq = 0;
  try { const raw = storage?.getItem(key); if (raw) { entries = JSON.parse(raw); seq = entries.reduce((n, e) => Math.max(n, e.n || 0), 0); } } catch { entries = []; }
  const listeners = new Set();
  const persist = () => { try { storage?.setItem(key, JSON.stringify(entries.slice(-max))); } catch { /* a full store never blocks a request */ } };
  const emit = (e) => { for (const f of listeners) { try { f(e); } catch {} } };

  const api = {
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** A model request through heimdall. Returns the handle to close when it answers. */
    sendModel({ auditId, model, messages, segments = null, worlds = null, symmetry = null, gate = true, host = null, purpose = null, run = null, base = null, masking = null }) {
      const segs = segments || messages.map((m) => ({ role: m.role, chars: String(m.content ?? "").length, provenance: m.role === "system" ? "template" : m.role === "assistant" ? "generated" : "ask" }));
      const grade = gradeRequest({ messages, segments: segs, worlds, symmetry, gate }, { taint });
      const e = { n: ++seq, id: auditId, at: now(), kind: "model", via: "heimdall", model, host, purpose, run, base, masking: cleanMasking(masking), worlds, symmetry: symmetry ? { passed: !!symmetry.passed, worst: symmetry.worst || null } : null, segments: segs, messages, bytes: new TextEncoder().encode(JSON.stringify(messages)).length, grade: { level: grade.level, sealed: grade.sealed, raw: grade.raw, leaks: grade.leaks, notes: grade.notes }, status: "sending", verification: null };
      entries.push(e); if (entries.length > max) entries.splice(0, entries.length - max);
      persist(); emit(e);
      return { entry: e, done: ({ ok = true, error = null, status = null } = {}) => { e.status = ok ? "answered" : "failed"; e.error = error ? String(error).slice(0, 200) : null; e.httpStatus = status; persist(); emit(e); return e; } };
    },
    /** The page itself calling a public service: not behind the gate. Records the full URL — the query IS what leaves. */
    sendDirect({ url, method = "GET", purpose = "web", run = null }) {
      const w = hostOf(url);
      const text = decodeURIComponent((w.search || "").replace(/^\?/, "").replace(/\+/g, " "));
      const leaks = [];
      if (taint) for (const h of taint.scan(url + " " + text)) leaks.push({ type: "particular", ...h });
      const e = { n: ++seq, id: "dir_" + seq.toString(36) + Math.random().toString(36).slice(2, 6), at: now(), kind: "web", via: "direct", host: w.host, path: w.path, method, purpose, run, url: `${w.host}${w.path}${w.search}`, messages: [{ role: "request", content: text || w.path }], segments: [{ role: "request", provenance: "ask", chars: text.length }], bytes: new TextEncoder().encode(url).length, grade: { level: "direct", sealed: false, raw: true, leaks, notes: ["sent straight from this page to a public service, outside heimdall's sealed gate; the query text is readable there"] }, status: "sending", verification: null };
      entries.push(e); if (entries.length > max) entries.splice(0, entries.length - max);
      persist(); emit(e);
      return { entry: e, done: ({ ok = true, error = null, status = null } = {}) => { e.status = ok ? "answered" : "failed"; e.error = error ? String(error).slice(0, 200) : null; e.httpStatus = status; persist(); emit(e); return e; } };
    },
    /** fetch that records every call that leaves this machine; local calls pass untouched. */
    auditedFetch(purpose, run = null) {
      return async (url, opts = {}) => {
        if (isLocalUrl(String(url))) return fetch(url, opts);
        const h = api.sendDirect({ url: String(url), method: opts.method || "GET", purpose, run });
        try { const r = await fetch(url, opts); h.done({ ok: r.ok, status: r.status }); return r; }
        catch (err) { h.done({ ok: false, error: err?.message || err }); throw err; }
      };
    },
    /** Ask heimdall what it actually sent for this request, and compare. */
    async verify(id, { signal = null } = {}) {
      const e = entries.find((x) => x.id === id);
      if (!e) return null;
      if (e.via !== "heimdall") { e.verification = { verified: null, problems: ["not sent through heimdall — there is no second ledger to compare against"] }; persist(); emit(e); return e.verification; }
      let theirs = null;
      try {
        const r = await fetchImpl((e.base || auditUrl || "") + "/api/audit?auditId=" + encodeURIComponent(id), { signal, cache: "no-store" });
        if (r.ok) theirs = (await r.json())?.entries?.[0] ?? null;
      } catch (err) { e.verification = { verified: false, problems: ["could not reach heimdall's ledger: " + (err?.message || err)] }; persist(); emit(e); return e.verification; }
      e.verification = await verifyAgainst({ messages: e.messages, worlds: e.worlds }, theirs);
      persist(); emit(e);
      return e.verification;
    },
    async verifyAll(ids) { return Promise.all(ids.map((id) => api.verify(id))); },
    list() { return entries.slice(); },
    byRun(run) { return entries.filter((e) => e.run === run); },
    get(id) { return entries.find((e) => e.id === id) || null; },
    clear() { entries = []; persist(); emit(null); },
    /** The one-line truth, computed from the ledger and never asserted. */
    summary(list = entries) {
      const hosts = new Map();
      const levels = { gate: 0, masked: 0, abstract: 0, worlds: 0, direct: 0 };
      let leaks = 0, bytes = 0, unverified = 0, mismatched = 0;
      for (const e of list) {
        const h = hosts.get(e.host || "?") || { host: e.host || "?", requests: 0, bytes: 0 }; h.requests++; h.bytes += e.bytes; hosts.set(e.host || "?", h);
        levels[e.grade.level] = (levels[e.grade.level] || 0) + 1;
        leaks += e.grade.leaks.length; bytes += e.bytes;
        if (e.via === "heimdall") { if (!e.verification) unverified++; else if (e.verification.verified === false) mismatched++; }
      }
      const sealed = list.filter((e) => e.grade.sealed).length;
      return { requests: list.length, hosts: [...hosts.values()], levels, sealed, raw: list.filter((e) => e.grade.raw).length, leaks, bytes, unverified, mismatched };
    },
    /** Everything, as JSON a person can keep: the exact content, grades and verifications. Credentials never enter it. */
    exportJson(list = entries) { return JSON.stringify({ exportedAt: now(), summary: api.summary(list), entries: list }, null, 2); },
  };
  return api;
}

/** Plain-language one-liner for a summary. */
export function describeSummary(s) {
  if (!s.requests) return "nothing has left this machine in this session.";
  const parts = [`${s.requests} request${s.requests === 1 ? "" : "s"} left this machine`, `${s.hosts.length} host${s.hosts.length === 1 ? "" : "s"}`, formatBytes(s.bytes)];
  const lv = [];
  if (s.levels.worlds) lv.push(`${s.levels.worlds} as possible worlds`);
  if (s.levels.masked) lv.push(`${s.levels.masked} with private details masked`);
  if (s.levels.abstract) lv.push(`${s.levels.abstract} abstracted`);
  if (s.levels.gate) lv.push(`${s.levels.gate} as raw content under the gate`);
  if (s.levels.direct) lv.push(`${s.levels.direct} direct from this page (not through heimdall)`);
  return parts.join(" · ") + " — " + lv.join(", ") + (s.leaks ? ` — ⚠ ${s.leaks} leak${s.leaks === 1 ? "" : "s"} flagged` : " — no leaks flagged") + (s.mismatched ? ` — ✗ ${s.mismatched} did not match heimdall's record` : "");
}
export const formatBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? (n / 1024).toFixed(1) + " KB" : n + " B");

export { withProvenance };
