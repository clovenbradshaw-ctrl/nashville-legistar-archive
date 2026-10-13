// fold-chat-turnfeed.js — a CHAT turn's live feed: the steps as they happen, as feed events.
//
// The coding lane already has a good live feed (fold-chat-agentfeed.js: a stage list, a ticking clock on the
// step in flight, one row per action, replayable after a reload with no timers). A chat turn used to show ONE
// static line ("searching the web…") for 10–20 s. This module is the adapter: it turns what a chat turn already
// reports — the `onStep` events of `web.searchWeb` and the app's own stage lines — into the SAME renderer's events
// (type "t", see createFeed in fold-chat-agentfeed.js). No second renderer, no DOM, no clock of its own (`now` is
// injected), so the mapping is unit-tested and a stored trace replays to the same rows.
//
// The event contract (all `{ type: "t", op, … }`; `at` = ms since the turn began, `ms` = how long a step took):
//   begin   { id, title, tone?, slowAfter?, slow? }   a step starts (the feed ticks its clock until it ends)
//   end     { id, title?, tone: ok|bad|info, note?, ms }   it finished (or failed: tone "bad" + the reason)
//   note    { id, text, tone? }                        a result line hanging under a step
//   line    { title, tone, note? }                     a step that is over the moment it is said
//   verb    { text }                                   the one live status line ("Waiting on Web")
//   done    { ok, title }                              the turn's one-line summary (the collapsed "how this was answered")
//
// Honesty rules: a step's clock is the real one; the "slow" line names the real budget (the web gets
// `webBudgetSec` seconds, then the turn goes on without it — fold-chat-web.js WEB_BUDGET_MS) and appears only when
// the step really has been running past it.

export const SCOPE_NAME = Object.freeze({ wikipedia: "Wikipedia", web: "the web", github: "GitHub", archive: "the Internet Archive", openalex: "OpenAlex", crossref: "Crossref" });
const nameOf = (scope) => SCOPE_NAME[scope] || String(scope || "a source");
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const num = (n) => Number(n).toLocaleString("en-US");
const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** A fresh mapping context for one turn. `now` is injected (tests pass a fake clock). */
export function newTurnTrace({ now = Date.now, question = "", webBudgetSec = 6, slowSec = 3 } = {}) {
  const t0 = now();
  return { now, t0, question: String(question ?? ""), webBudgetSec, slowSec, open: new Map(), verb: "", nth: 0 };
}
const at = (c) => Math.max(0, c.now() - c.t0);

/** The words a person reads for what is in flight right now ("Waiting on the web and Wikipedia"). Pure. */
export function verbOf(c) {
  const live = [...c.open.values()];
  if (!live.length) return "";
  const asking = live.filter((x) => x.kind === "ask"), reading = live.filter((x) => x.kind === "read");
  const join = (xs) => (xs.length <= 1 ? xs[0] : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  if (reading.length) return `Reading ${plural(reading.length, "page")}`;
  if (asking.length) return `Waiting on ${join(asking.map((x) => x.what))}`;
  return live[live.length - 1].verb || "Working";
}

function begin(c, id, title, { kind = "step", what = "", verb = "", slowAfter = 0, slow = "", tone = "run" } = {}) {
  c.open.set(id, { start: at(c), kind, what, verb });
  return { type: "t", op: "begin", id, title, tone, at: at(c), ...(slowAfter ? { slowAfter, slow } : {}) };
}
function end(c, id, { title = null, tone = "ok", note = "" } = {}) {
  const o = c.open.get(id);
  c.open.delete(id);
  const ms = o ? Math.max(0, at(c) - o.start) : 0;
  return { type: "t", op: "end", id, tone, ...(title ? { title } : {}), ...(note ? { note } : {}), ms, at: at(c) };
}
/** Append the status-line event when what is in flight changed. */
function withVerb(c, evs) {
  const v = verbOf(c);
  if (v !== c.verb) { c.verb = v; evs.push({ type: "t", op: "verb", text: v, at: at(c) }); }
  return evs;
}

/** A step that is over the moment it is said (a decision, a count). */
export function lineEvent(c, title, { tone = "ok", note = "" } = {}) {
  return withVerb(c, [{ type: "t", op: "line", title, tone, ...(note ? { note } : {}), at: at(c) }]);
}
/** The turn starts: the feed's own "start" (the live clock's origin) and the classification line. */
export function startEvents(c, { kindWord = "" } = {}) {
  return [{ type: "start", task: clip(c.question, 80), at: 0 }, ...(kindWord ? lineEvent(c, "Read your question", { tone: "ok", note: kindWord }) : [])];
}
/** A step the app itself runs (the model writing, the strand being drawn, the checks): start it. */
export function beginStep(c, id, title, opts = {}) {
  return withVerb(c, [begin(c, id, title, { kind: "app", verb: opts.verb || title, ...opts })]);
}
/** …and end it. */
export function endStep(c, id, opts = {}) {
  return withVerb(c, [end(c, id, opts)]);
}
export function noteEvent(c, id, text, tone = "info") { return [{ type: "t", op: "note", id, text, tone, at: at(c) }]; }
/** The turn's one-line ending — the summary that stays when the feed collapses. Open steps are closed first. */
export function doneEvents(c, { ok = true, title = "", detail = "" } = {}) {
  const out = [];
  for (const id of [...c.open.keys()]) out.push(end(c, id, { tone: ok ? "info" : "bad" }));
  c.verb = "";
  out.push({ type: "t", op: "done", ok, title, ...(detail ? { detail } : {}), at: at(c) });
  return out;
}

/** One `onStep` event from `web.searchWeb` → the feed events it stands for. Pure given the context. */
export function eventsForStep(c, e) {
  const s = e || {};
  const evs = [];
  switch (s.phase) {
    case "searching": {
      const id = `q:${s.scope}:${s.q || ""}`;
      const what = nameOf(s.scope);
      const sub = s.q && s.q !== c.question && s.scope !== "web" ? ` about “${clip(s.q, 40)}”` : "";
      const isWeb = s.scope === "web";
      evs.push(begin(c, id, isWeb ? "Searching the web" : `Asking ${what}${sub}`, {
        kind: "ask", what,
        slowAfter: (isWeb ? c.webBudgetSec : c.slowSec) * 1000,
        slow: isWeb ? `waiting on the web (slow: ${c.webBudgetSec} s budget, then I go on without it)` : `waiting on ${what} (slow: over ${c.slowSec} s)`,
      }));
      break;
    }
    case "found": {
      const id = `q:${s.scope}:${s.q || ""}`;
      const n = Number(s.n) || 0;
      evs.push(end(c, id, { title: s.scope === "web" ? "Searched the web" : `Asked ${nameOf(s.scope)}`, tone: n ? "ok" : "info", note: `${plural(n, "result")}${s.engine && s.scope === "web" ? " via " + s.engine : ""}` }));
      break;
    }
    case "failed": {
      const id = `q:${s.scope}:${s.q || ""}`;
      const why = clip(s.why, 90);
      const t = s.scope === "web" ? "Searched the web" : `Asked ${nameOf(s.scope)}`;
      if (c.open.has(id)) evs.push(end(c, id, { title: t, tone: /cooling|slow/i.test(why) ? "info" : "bad", note: why }));
      else evs.push({ type: "t", op: "line", title: t, tone: /cooling|slow/i.test(why) ? "info" : "bad", note: why, at: at(c) });
      break;
    }
    case "waiting": {
      // the web is the turn's one way to an answer: it is waited for, and that is said
      const id = [...c.open.keys()].find((k) => k.startsWith("q:web:"));
      if (id) evs.push({ type: "t", op: "note", id, text: clip(s.why || "waiting for the web", 110), tone: "warn", at: at(c) });
      break;
    }
    case "routed": {
      const picked = (s.picked || []).map(nameOf);
      const skipped = (s.skipped || []).map(nameOf);
      evs.push({ type: "t", op: "line", title: "Chose where to look", tone: "info", note: s.webDown ? `the web returned nothing${picked.length > 1 ? ", so also " + picked.slice(1).join(", ") : ""}` : `${picked.join(" + ")}${skipped.length ? " (not " + skipped.join(", ") + ")" : ""}`, at: at(c) });
      break;
    }
    case "skipped": {
      evs.push({ type: "t", op: "line", title: "Set aside off-topic results", tone: "info", note: `${plural(Number(s.n) || 0, "result")} did not match the ask`, at: at(c) });
      break;
    }
    case "demoted": {
      evs.push({ type: "t", op: "line", title: "Read look-alike pages last", tone: "info", note: `${plural(Number(s.n) || 0, "page")} named for something else that shares the name${s.titles && s.titles.length ? ": " + s.titles.slice(0, 2).map((t) => clip(t, 40)).join("; ") : ""}`, at: at(c) });
      break;
    }
    case "reading": {
      const site = s.site || hostOf(s.url) || "a page";
      evs.push(begin(c, `r:${s.url}`, `Reading ${site}${s.title ? " — " + clip(s.title, 60) : ""}`, { kind: "read", what: site, slowAfter: 5000, slow: `waiting on ${site} (slow: pages get an 8 s budget)` }));
      break;
    }
    case "read": {
      const site = s.site || hostOf(s.url) || "a page";
      const note = s.chars ? (s.kept && s.kept < s.chars ? `kept ${num(s.kept)} of ${num(s.chars)} chars` : `${num(s.chars)} chars`) : "";
      evs.push(end(c, `r:${s.url}`, { title: `Read ${site}${s.title ? " — " + clip(s.title, 60) : ""}`, tone: "ok", note }));
      break;
    }
    case "unread": {
      const site = s.site || hostOf(s.url) || "a page";
      evs.push(end(c, `r:${s.url}`, { title: `Could not read ${site}`, tone: "bad", note: "no text came back" }));
      break;
    }
    case "snippet": {
      evs.push({ type: "t", op: "line", title: `Used ${s.site || hostOf(s.url) || "a site"}'s own summary`, tone: "info", note: "enough sites agreed, so no page was fetched", at: at(c) });
      break;
    }
    default: return [];
  }
  return withVerb(c, evs);
}

/** The process line for a sources-only fallback. An untraceable model answer is NEVER labelled "no model
 *  reachable": the model answered, its sentences just did not trace to what was read. Pure. */
export function fallbackProcessLine(fellBack) {
  if (fellBack?.reason === "untraceable") return "fell back · the model's answer could not be traced to what was read — drew the sources-only strand instead";
  return `fell back · the model did not answer (${fellBack?.gate || "no model reachable"}) — drew the sources-only strand instead, no model`;
}

/** The collapsed one-line summary of a finished turn: "Answered in 12 s · read 3 sources". Pure. */
export function summaryLine({ ms = 0, nSources = 0, mode = "facing", model = "", fellBack = false, gap = false, failed = false } = {}) {
  const secs = ms >= 1000 ? `${ms >= 10000 ? Math.round(ms / 1000) : (ms / 1000).toFixed(1)} s` : "under 1 s";
  const src = nSources ? `read ${plural(nSources, "source")}` : "no source reached";
  if (failed) return `Stopped after ${secs}`;
  if (gap) return `No answer in ${secs} · ${src}`;
  if (fellBack === "untraceable") return `Answered from the sources in ${secs} · the model's answer was not traceable to the read pages · ${src}`;
  if (fellBack === "nomodel") return `Answered from the sources in ${secs} · no model reachable · ${src}`;
  if (fellBack) return `Answered from the sources in ${secs} · the model declined · ${src}`;
  if (mode === "snips") return `Answered in ${secs} · ${src} · no model`;
  return `Answered in ${secs} · ${src}${model ? " · " + model : ""}`;
}

/** Keep a stored trace small and safe: only known fields, bounded text, bounded length (the closing `done` always stays). */
export function storeEvents(events, { max = 120 } = {}) {
  const keep = ["type", "op", "id", "title", "tone", "note", "text", "ms", "at", "ok", "detail", "slowAfter", "slow", "task"];
  const all = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || typeof e !== "object") continue;
    const o = {};
    for (const k of keep) if (e[k] !== undefined) o[k] = typeof e[k] === "string" ? clip(e[k], 200) : e[k];
    all.push(o);
  }
  if (all.length <= max) return all;
  const last = all[all.length - 1];
  return last && last.op === "done" ? [...all.slice(0, max - 1), last] : all.slice(0, max);
}
