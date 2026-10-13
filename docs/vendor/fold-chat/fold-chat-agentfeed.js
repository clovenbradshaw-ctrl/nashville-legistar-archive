// fold-chat-agentfeed.js — the agent's work, shown as it happens.
//
// One renderer for two uses: LIVE (events arrive from runAgent while the door
// is still thinking — one ticking status line at the bottom, so a long dispatch
// never looks frozen) and REPLAY (a stored event list drawn again after a
// reload, with no timers). Same rows either way, so what you watched is what
// the record keeps.
//
// The look is a coding agent's transcript (Claude Code / OpenCode): one line per
// action with a status bullet, its result hanging under it behind a ⎿ connector,
// the plan a checklist that folds to one line once work starts, long output cut
// to a couple of lines with "… +N more" that opens on click. The CSS lives in
// fold-chat-agentfeed.css.js and is injected once; classes are `cc-*`.
//
// The event contract (from runAgent in fold-chat-agent.js) is unchanged.

import { FEED_CSS, FEED_STYLE_ID } from "./fold-chat-agentfeed.css.js";
import { describe, stageOfStep, planLabel, planHeader, liveWords, slowWords, secsOf } from "./fold-chat-agentfeed-words.js";

export { stageOfStep, describe };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---------- pure helpers (tested in fold-chat-agentfeed.test.mjs) ----------

/** 840ms · 3.2s · 41s · 2m 05s */
export const secs = secsOf;
export const size = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} chars`);

/** Cut a list to `max` visible items. `more` is how many are folded away. */
export function foldList(items, max = 2) {
  const list = Array.isArray(items) ? items : [];
  const m = Math.max(1, max | 0);
  return list.length > m ? { shown: list.slice(0, m), hidden: list.slice(m), more: list.length - m } : { shown: list, hidden: [], more: 0 };
}

/** One long string → at most `maxChars` characters, cut on a word, with how much was dropped. */
export function clipText(text, maxChars = 600) {
  const t = String(text ?? "");
  if (t.length <= maxChars) return { text: t, dropped: 0 };
  let cut = t.lastIndexOf(" ", maxChars);
  if (cut < maxChars * 0.6) cut = maxChars;
  return { text: t.slice(0, cut).trimEnd() + "…", dropped: t.length - cut };
}

/** A multi-line detail → result items: the first line carries the state, the rest are plain continuation. */
export function itemsOf(text, kind = "info", maxLineChars = 800) {
  const out = [];
  let first = true;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const { text: t } = clipText(raw.trim(), maxLineChars);
    out.push({ text: t, kind: first ? kind : "cont" });
    first = false;
  }
  return out;
}

const TEST_CHECKS = new Set(["your behavioral test"]);

/**
 * Plan checklist state from the events so far — never invented. Each step is
 * pending until its stage really finishes:
 *   read   → done on `read` (skipped if khora did not answer)
 *   act    → done on the first `acted`
 *   run    → done on the first sandbox `check`
 *   rule   → done on `derive` (skipped if janus was unreachable)
 *   test   → done/failed on the check named "your behavioral test"
 *   repair → active on `repair`; on `done` ok it is done (or skipped if it was
 *            never needed), on `done` failed it is failed
 * A stage that is in flight is "active"; a stopped/failed run leaves in-flight
 * stages pending again.
 */
export function planProgress(steps, events) {
  const plan = (steps || []).map((text) => ({ text, stage: stageOfStep(text), state: "pending" }));
  const at = (stage) => plan.filter((p) => p.stage === stage);
  const set = (stage, state, onlyFrom = null) => { for (const p of at(stage)) if (!onlyFrom || onlyFrom.includes(p.state)) p.state = state; };
  for (const e of events || []) {
    switch (e.type) {
      case "reading": set("read", "active", ["pending"]); break;
      case "read": set("read", e.error ? "skip" : "done"); break;
      case "act": set("act", "active", ["pending"]); break;
      case "acted": set("act", "done"); break;
      case "observing": set("run", "active", ["pending"]); break;
      case "check":
        if (TEST_CHECKS.has(String(e.name || "").toLowerCase())) set("test", e.ok === false ? "fail" : "done");
        else if (e.name !== "penelope's own gate") set("run", "done");
        break;
      case "deriving": set("rule", "active", ["pending"]); break;
      case "derive": set("rule", e.error ? "skip" : "done"); break;
      case "repair": set("repair", "active"); break;
      case "done":
        if (e.ok) set("repair", plan.some((p) => p.stage === "repair" && p.state === "active") ? "done" : "skip", ["pending", "active"]);
        else set("repair", "fail", ["pending", "active"]);
        break;
      case "stopped": case "error":
        for (const p of plan) if (p.state === "active") p.state = "pending";
        break;
    }
  }
  return plan;
}
export const PLAN_GLYPH = { pending: "☐", active: "◐", done: "☒", skip: "–", fail: "✗" };

// ---------- injected once ----------

function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById(FEED_STYLE_ID)) return;
  const s = document.createElement("style"); s.id = FEED_STYLE_ID; s.textContent = FEED_CSS;
  (document.head || document.documentElement).append(s);
}

const SPIN = ["✻", "✽", "✶", "✳", "✢", "·"];
const MARK = { ok: "✓ ", bad: "✗ ", cont: "", info: "", warn: "", seal: "", find: "– ", link: "→ " };
const GLYPH = { bad: "✗", warn: "↻", seal: "↗", stop: "■" };
const SIGN = { ok: "✓ ", bad: "✗ ", stop: "■ ", warn: "", info: "" };

/**
 * Build the feed inside `host`. `live` adds the ticking status line and Stop.
 * `canGoOnline` (optional) says a stronger online AI is available, so the
 * slow-step hint can promise it; when unknown the hint stays neutral.
 *
 * Every line is plain words (fold-chat-agentfeed-words.js). The technical text a
 * step used to show is kept behind that step's "details" button, and behind one
 * "show technical details" button in the footer.
 */
export function createFeed(host, { live = false, onStop = null, onRetry = null, onAuditOpen = null, canGoOnline = null, viewSwitch = false } = {}) {
  ensureStyle();
  const root = el("div", "cc-run" + (live ? " cc-live-on" : ""));
  root.dataset.feed = "agent";
  const planBox = el("details", "cc-plan"); planBox.hidden = true; planBox.open = true;
  const planSum = el("summary", "");
  const planList = el("ul", "");
  planBox.append(planSum, planList);
  const log = el("div", "cc-log");
  const liveBox = el("div", "cc-live"); liveBox.hidden = !live;
  const spin = el("span", "cc-g", SPIN[0]);
  const liveT = el("span", "cc-live-t");
  const liveV = el("span", "cc-live-v", "Working");
  const liveM = el("span", "cc-live-m", "");
  const stop = el("button", "cc-stop", "Stop"); stop.type = "button"; stop.title = "Stop after the current step (Esc)";
  const hint = el("div", "cc-hint"); hint.hidden = true;
  liveT.append(liveV, "… ", liveM, stop);
  // THE TURN VIEW (the person's choice, kept between turns): quiet = this line only; live = the reading drawn as it happens; full = every step.
  // ONE tiny control that cycles on a tap (a glyph, not three words).
  if (viewSwitch) {
    const root0 = document.documentElement, KEY = "fold-chat:turnView";
    const MODES = [["quiet", "\u25cb", "Just the status line"], ["live", "\u25d1", "The reading, drawn as it happens"], ["full", "\u25a3", "The whole screen of its processing"]];
    const cur = () => { let v = root0.dataset.tv; if (!v) { try { v = localStorage.getItem(KEY); } catch {} } return MODES.some((m) => m[0] === v) ? v : "live"; };
    const b = el("button", "cc-vw"); b.type = "button";
    const paint = () => { const m = MODES.find((x) => x[0] === cur()); b.textContent = m[1]; b.title = m[2] + " \u00b7 tap to change"; b.setAttribute("aria-label", "View: " + m[0] + ". Tap to change."); };
    b.onclick = () => { const k = (MODES.findIndex((x) => x[0] === cur()) + 1) % MODES.length; root0.dataset.tv = MODES[k][0]; try { localStorage.setItem(KEY, MODES[k][0]); } catch {} document.querySelectorAll(".cc-vw").forEach((x) => x.dispatchEvent(new Event("tv"))); try { dispatchEvent(new Event("fold:tv")); } catch {} };
    b.addEventListener("tv", paint); root0.dataset.tv = cur(); paint();
    liveT.append(b);
  }
  liveBox.append(spin, liveT, hint);
  const foot = el("div", "cc-foot"); foot.hidden = true;
  const footLine = el("div", "cc-fl");
  const footRes = makeResults(3, foot);
  const retry = el("button", "cc-retry", "Try again"); retry.type = "button"; retry.hidden = true;
  retry.onclick = () => { retry.disabled = true; onRetry?.(); };
  const footTech = el("div", "cc-tech cc-foot-tech");
  const techAll = el("button", "cc-tt", "show technical details"); techAll.type = "button"; techAll.setAttribute("aria-pressed", "false");
  techAll.title = "Show the technical text behind every step";
  foot.append(footLine, footRes.wrap, footRes.more, retry, footTech, techAll);
  root.append(planBox, log, liveBox, foot);
  host.append(root);

  const events = [];
  let planSteps = null, planTech = "", collapsed = false;
  let t0 = null, tick = null, frame = 0;
  let stage = null, stagePipe = null, stageStart = 0;
  let actS = null, escS = null, obsS = null, readS = null, derS = null, lastRead = null, lastObs = null, tools = null;
  let actMeta = { remote: false, continuing: false };
  let obsAt = 0, obsItems = [], of = 0, round = 0, tries = 0;
  const timers = new Set();
  let waitIv = null;
  const detailButtons = new Set();

  // ---- the technical text, one click away ----
  const syncTech = () => { for (const { btn, box } of detailButtons) btn.setAttribute("aria-expanded", String(box.classList.contains("cc-tech-open") || root.classList.contains("cc-tech-all"))); };
  techAll.onclick = () => {
    const on = !root.classList.contains("cc-tech-all");
    root.classList.toggle("cc-tech-all", on);
    techAll.textContent = on ? "hide technical details" : "show technical details";
    techAll.setAttribute("aria-pressed", String(on));
    syncTech();
  };
  /** A "details" button + its hidden technical block, on `box`. Returns { set(lines) }. */
  function techBlock(box, after, cls = "") {
    const btn = el("button", "cc-dt", "details"); btn.type = "button"; btn.hidden = true;
    const pre = el("div", "cc-tech " + cls); const id = "cc-t" + Math.random().toString(36).slice(2, 8); pre.id = id;
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", id);
    btn.title = "Show the technical text behind this step";
    btn.onclick = () => { box.classList.toggle("cc-tech-open"); syncTech(); };
    detailButtons.add({ btn, box });
    return { btn, pre, set(lines) { const t = lines.filter(Boolean).join("\n"); pre.textContent = t; btn.hidden = !t; } };
  }

  // ---- one action: bullet + label, then results ----
  function step(kind, label, { glyph = null, limit = 2 } = {}) {
    const box = el("div", "cc-step cc-" + kind);
    const line = el("div", "cc-line");
    const g = el("span", "cc-g", glyph || GLYPH[kind] || "●");
    const body = el("span", "cc-body");
    const lab = el("span", "cc-lab", label);
    const tm = el("span", "cc-tm", "");
    const note = el("span", "cc-note", "");
    const tb = techBlock(box);
    body.append(lab, " ", tm, " ", note, " ", tb.btn);
    line.append(g, body);
    const res = makeResults(limit, box);
    box.append(line, tb.pre, res.wrap, res.more);
    log.append(box);
    tools = null;
    const lines = []; let head = "", headMs = 0, items = []; let handlers = {};
    const paintTech = () => tb.set([head ? head + (headMs >= 1000 ? " " + secs(headMs) : "") : "", ...lines]);
    const s = {
      box, res,
      kind(k, glyph2 = null) { box.className = "cc-step cc-" + k + (box.classList.contains("cc-open") ? " cc-open" : "") + (box.classList.contains("cc-tech-open") ? " cc-tech-open" : ""); g.textContent = glyph2 || GLYPH[k] || "●"; return s; },
      label(t) { lab.textContent = t; return s; },
      time(ms) { tm.textContent = ms >= 1000 ? secs(ms) : ""; headMs = ms; paintTech(); return s; },
      note(t) { note.textContent = t || ""; return s; },
      tech(first, ...more) { if (first) { if (!head) head = first; else lines.push(first); } lines.push(...more.filter(Boolean)); paintTech(); return s; },
      set(list, h = {}) { items = list || []; handlers = h; res.set(items, h); return s; },
      add(item, h = null) { items = items.concat(item); if (h) handlers = h; res.set(items, handlers); return s; },
      drop(pred) { items = items.filter((i) => !pred(i)); res.set(items, handlers); return s; },
      body, label_: lab,
    };
    return s;
  }
  const toolsFor = (s) => {
    if (tools && tools.parent === s.box) return tools;
    const wrap = el("div", "cc-tools"); const more = el("button", "cc-more", ""); more.type = "button"; more.hidden = true;
    s.box.insertBefore(wrap, s.res.wrap); s.box.insertBefore(more, s.res.wrap);
    tools = { parent: s.box, wrap, more, n: 0, open: false };
    more.onclick = () => { tools.open = !tools.open; syncTools(); };
    return tools;
  };
  const syncTools = () => {
    const t = tools; if (!t) return;
    const kids = [...t.wrap.children];
    kids.forEach((k, i) => { k.hidden = !t.open && i >= 3; });
    const more = kids.length - 3;
    t.more.hidden = more <= 0;
    t.more.textContent = t.open ? "show fewer" : `… and ${more} more`;
  };

  // ---- timers ----
  const later = (fn, ms) => { const id = setInterval(fn, ms); timers.add(id); return id; };
  const clearTimer = (id) => { if (id != null) { clearInterval(id); timers.delete(id); } };
  const stopClock = () => { clearTimer(tick); tick = null; };
  const endAll = () => { stopClock(); for (const id of [...timers]) clearTimer(id); };

  const setStage = (st, pipe = null) => {
    stage = st; stagePipe = pipe; stageStart = Date.now();
    hint.hidden = true;
    paintLive();
  };
  function paintLive() {
    if (!live || liveBox.hidden) return;
    liveV.textContent = turnVerb || liveWords(stage, stagePipe);
    paintTurnSteps();
    const el_ = stage ? Date.now() - stageStart : t0 ? Date.now() - t0 : 0;
    liveM.textContent = `${el_ < 1000 ? "0s" : secs(el_)} · press Esc to stop `;
    if (stage === "act" && Date.now() - stageStart > 8000) { hint.textContent = slowWords(stagePipe, canGoOnline) + " Stop cancels it."; hint.hidden = false; }
    spin.textContent = SPIN[frame++ % SPIN.length];
  }
  const startClock = () => { if (live && !tick) tick = later(paintLive, 250); };

  // ---- a CHAT turn's steps (type "t", built by fold-chat-turnfeed.js): the same rows, each with its own clock ----
  // begin → a row whose elapsed time ticks while it is in flight; end → the row settles with its real duration and
  // result; a step that is still going past its declared `slowAfter` says, honestly, what it is waiting on.
  let turnVerb = "";
  const tsteps = new Map();
  function paintTurnSteps() {
    if (!live) return;
    for (const t of tsteps.values()) {
      if (t.done) continue;
      const ms = Date.now() - t.start;
      t.s.time(ms);
      if (t.slowAfter && ms > t.slowAfter && !t.slowed) { t.slowed = true; t.s.kind("warn", "\u21bb").note("\u2014 " + t.slow); }
    }
  }
  const toneKind = (tone) => (tone === "bad" ? "bad" : tone === "ok" ? "ok" : tone === "warn" ? "warn" : "info");
  function turnEvent(e) {
    switch (e.op) {
      case "begin": {
        const sp = step("run", e.title, { limit: 3 });
        tsteps.set(e.id, { s: sp, start: Date.now(), slowAfter: e.slowAfter || 0, slow: e.slow || "", slowed: false, done: false });
        if (live) { startClock(); }
        break;
      }
      case "note": { const t = tsteps.get(e.id); if (t) t.s.add({ text: e.text, kind: toneKind(e.tone) }); break; }
      case "end": {
        const t = tsteps.get(e.id); if (!t) break;
        t.done = true;
        if (e.title) t.s.label(e.title);
        t.s.kind(toneKind(e.tone)).time(e.ms || 0).note(e.note ? "\u2014 " + e.note : "");
        break;
      }
      case "line": {
        const sp = step(toneKind(e.tone) === "info" ? "info" : toneKind(e.tone), e.title, { limit: 3 });
        if (e.note) sp.note("\u2014 " + e.note);
        break;
      }
      case "verb": turnVerb = e.text || ""; paintLive(); break;
      case "done": {
        for (const t of tsteps.values()) t.done = true;
        turnVerb = ""; endAll(); finish(e.ok ? "ok" : "bad");
        footLine.textContent = (e.ok ? SIGN.ok : SIGN.bad) + (e.title || (e.ok ? "Done" : "Stopped"));
        footRes.set(e.detail ? [{ text: e.detail, kind: "cont" }] : []);
        break;
      }
    }
  }

  function foldPlan() {
    if (!planSteps || collapsed) return;
    collapsed = true; planBox.open = false;
  }
  const planTb = techBlock(planBox);
  planBox.append(planTb.btn, planTb.pre);
  function paintPlan() {
    if (!planSteps) return;
    const prog = planProgress(planSteps, events);
    const done = prog.filter((p) => p.state === "done" || p.state === "skip").length;
    planSum.textContent = planHeader(prog.length, done);
    planList.textContent = "";
    for (const p of prog) {
      const li = el("li", "cc-pi cc-" + p.state);
      li.append(el("span", "cc-pg", PLAN_GLYPH[p.state]), el("span", "cc-pt", planLabel(p.stage, p.text)));
      planList.append(li);
    }
    planTb.set([planTech]);
  }

  const itemKind = (tone) => (tone === "bad" ? "bad" : tone === "ok" ? "ok" : tone === "warn" ? "warn" : "info");

  function push(e) {
    events.push(e);
    const d = describe(e, { live, remote: actMeta.remote, continuing: actMeta.continuing, round, of, tries });
    switch (e.type) {
      case "t": turnEvent(e); break;
      case "start":
        t0 = Date.now() - (e.at || 0);
        stageStart = Date.now();
        startClock(); paintLive();
        break;
      case "plan":
        planSteps = e.steps || []; planTech = d.tech; planBox.hidden = false;
        break;
      case "reading":
        foldPlan(); setStage("read", "khora");
        readS = step("run", d.title).tech(d.tech);
        break;
      case "read":
        if (e.error) { readS?.kind("info").set([{ text: d.detail, kind: "info" }]).tech(d.tech); lastRead = null; }
        else { readS?.kind("ok").time(e.ms).tech(d.tech); lastRead = readS; }
        readS = null; setStage(null);
        break;
      case "requirements": {
        const target = lastRead || step("info", d.title);
        target.add({ text: d.detail, kind: "info" }).tech(d.tech);
        break;
      }
      case "deriving":
        foldPlan(); setStage("rule", "janus");
        derS = step("run", d.title).tech(d.tech);
        break;
      case "derive":
        derS?.kind(d.tone === "bad" ? "bad" : d.tone === "ok" ? "ok" : "info").time(e.ms).set([{ text: d.detail, kind: itemKind(d.tone) }]).tech(d.tech);
        derS = null; setStage(null);
        break;
      case "audit": {
        const s = step("info", d.title, { glyph: "↗", limit: 5 });
        s.add({ text: d.detail, kind: "info" });
        for (const b of d.bullets) s.add({ text: b, kind: "warn" });
        if (d.verdict) s.add({ text: d.verdict.text, kind: itemKind(d.verdict.tone) });
        for (const l of d.links) s.add({ text: l.label, kind: "link", audit: l.id }, { onAudit: (id) => onAuditOpen?.(id) });
        if (d.tone === "bad") s.kind("bad", "↗");
        s.tech(...d.tech.split("\n"));
        break;
      }
      case "escalate": {
        const s = actS ? actS.kind("warn", "↗").label(d.title).note("") : step("warn", d.title, { glyph: "↗", limit: 4 });
        s.set([{ text: `Because ${d.detail.charAt(0).toLowerCase()}${d.detail.slice(1)}.`, kind: "info" }, { text: d.bullets[0], kind: "seal" }]);
        s.tech(...d.tech.split("\n"));
        escS = s; actS = null; tries = 0;
        break;
      }
      case "try":
        tries++;
        {
          const dd = describe(e, { tries });
          if (actS) actS.drop((i) => i.isTry).add({ text: dd.detail, kind: "info", isTry: true }).tech(dd.tech);
        }
        break;
      case "wait": {
        const s = actS ? actS.kind("warn", "↻") : step("warn", "", { glyph: "↻" });
        s.label(d.title).time(0).set([]);
        s.note("— " + d.detail).tech(...d.tech.split("\n"));
        if (live) {
          let left = e.seconds;
          const iv = later(() => { left -= 1; s.note("— " + describe(e, { live: true, left }).detail); if (left <= 0) clearTimer(iv); }, 1000);
          waitIv = iv;
        }
        actS = null; setStage("wait");
        break;
      }
      case "round":
        round = e.round; of = e.of;
        break;
      case "repair": {
        const s = step("warn", d.title, { glyph: "↻", limit: 3 });
        s.set(d.bullets.map((f) => ({ text: f, kind: "find" })));
        s.tech(...d.tech.split("\n"));
        break;
      }
      case "act": {
        clearTimer(waitIv); waitIv = null;
        foldPlan();
        const p = e.pipeline, remote = p === "remote";
        actMeta = { remote, continuing: !!e.continuing };
        setStage("act", p);
        if (remote && escS) { actS = escS.kind("run", "↗"); escS = null; actS.tech(d.tech); }
        else {
          actS = step("run", remote ? "Asking a more powerful AI online" : d.title, { limit: 4 }).tech(d.tech);
          if (remote) actS.add({ text: describe({ type: "escalate" }).bullets[0], kind: "seal" });
        }
        break;
      }
      case "tool": {
        const t = actS ? toolsFor(actS) : tools?.standalone ? tools : (() => { const x = toolsFor(step("info", "Working on the files")); x.standalone = true; return x; })();
        const line = el("div", "cc-tool");
        line.append(el("b", "", d.title), d.detail ? " " + d.detail : "");
        line.title = d.tech;
        t.wrap.append(line); t.n++; syncTools();
        actS?.tech(d.tech);
        break;
      }
      case "acted": {
        const s = actS || step("ok", "Answer");
        const keep = actMeta.remote;
        s.kind("ok", keep ? "↗" : null).time(e.ms);
        if (!keep) s.label(d.title);
        s.drop((i) => i.isTry).add({ text: d.detail, kind: d.tone === "ok" ? "info" : "warn" }).tech(d.tech);
        actS = null; setStage(null);
        break;
      }
      case "observing":
        foldPlan(); setStage("run", "sandbox"); obsAt = e.at || 0; obsItems = [];
        obsS = step("run", d.title, { limit: 4 }).tech(d.tech);
        lastObs = obsS;
        break;
      case "check": {
        const gate = /^(your behavioral test|penelope's own gate)$/i.test(String(e.name || ""));
        let target = null;
        if (!gate) {
          if (obsS) { obsS.kind("ok"); obsS.time(Math.max(0, (e.at || 0) - obsAt)); target = obsS; obsS = null; setStage(null); }
          else target = lastObs;
        }
        if (target) {
          obsItems.push({ text: d.title, kind: itemKind(d.tone), ok: e.ok });
          const failing = obsItems.filter((i) => i.ok === false), rest = obsItems.filter((i) => i.ok !== false);
          target.set([...failing, ...rest]);
          target.kind(failing.length ? "bad" : "ok");
          target.tech(d.tech);
        } else {
          step(d.tone === "bad" ? "bad" : d.tone === "ok" ? "ok" : "info", d.title).tech(d.tech);
        }
        break;
      }
      case "done": {
        endAll(); finish(e.ok ? "ok" : "bad");
        footLine.textContent = SIGN[d.tone] + d.title;
        footRes.set(e.ok ? [] : [{ text: d.detail, kind: "cont" }, ...d.bullets.map((f) => ({ text: f, kind: "find" }))]);
        footTech.textContent = d.tech;
        retry.hidden = !(live && onRetry && !e.ok);
        break;
      }
      case "stopped":
        endAll(); finish("stopped");
        if (actS) { actS.kind("info", "■").note("— stopped before it finished"); actS = null; }
        if (obsS) { obsS.kind("info", "■").note("— stopped before it finished"); obsS = null; }
        footLine.textContent = SIGN.stop + d.title; footRes.set([]); footTech.textContent = d.tech;
        retry.hidden = !(live && onRetry);
        break;
      case "error":
        endAll(); finish("bad");
        if (actS) { actS.kind("bad").note("— no answer"); actS = null; }
        footLine.textContent = SIGN.bad + d.title; footRes.set(d.detail ? [{ text: d.detail, kind: "cont" }] : []); footTech.textContent = d.tech;
        retry.hidden = !(live && onRetry);
        break;
    }
    if (planSteps) paintPlan();
    const scroller = host.closest(".thread, .chat, main") || null;
    if (live && scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  function finish(state) {
    stopClock(); liveBox.hidden = true; root.classList.remove("cc-live-on");
    root.classList.add("cc-s-" + state);
    foot.hidden = false; foldPlan();
  }

  stop.onclick = () => { stop.disabled = true; stop.textContent = "Stopping…"; onStop?.(); };
  return { push, root, dispose: endAll };
}

/** Draw a stored trace — the same rows, no clock. */
export function replayFeed(host, events, opts = {}) {
  const f = createFeed(host, { live: false, ...opts });
  for (const e of events || []) f.push(e);
  return f;
}

// ---------- results: the lines hanging under an action ----------

/** The ⎿ block under a step: first lines shown, the rest behind "… +N more". `box` carries the open state. */
function makeResults(limit, box) {
  const wrap = el("div", "cc-res");
  const more = el("button", "cc-more", ""); more.type = "button"; more.hidden = true;
  let items = [], handlers = {};
  const sync = () => {
    const open = box.classList.contains("cc-open");
    const rows = [...wrap.children];
    rows.forEach((r, i) => { r.hidden = !open && i >= limit; });
    const hidden = rows.length - limit;
    more.hidden = hidden <= 0;
    more.textContent = open ? "show less" : `… and ${hidden} more`;
  };
  const toggle = () => { box.classList.toggle("cc-open"); sync(); measure(); };
  const measure = () => {
    if (box.classList.contains("cc-open")) return;
    for (const t of wrap.querySelectorAll(".cc-txt")) { if (t.offsetParent !== null && t.scrollHeight > t.clientHeight + 1) { t.classList.add("cc-clip"); t.title = "click to expand"; } }
  };
  const render = () => {
    wrap.textContent = "";
    items.forEach((it, i) => {
      const kind = String(it.kind || "info").replace("-cont", "");
      const r = el("div", "cc-r cc-" + kind);
      r.append(el("span", "cc-c", i === 0 ? "⎿" : ""));
      const t = el("span", "cc-txt");
      const mk = MARK[it.kind] ?? "";
      if (mk) t.append(el("span", "cc-m", mk));
      t.append(it.text);
      r.append(t);
      if (it.audit) {
        r.classList.add("cc-audit", "cc-clickable"); r.tabIndex = 0; r.title = "open the exact text that was sent"; r.dataset.auditId = it.audit;
        r.onclick = () => handlers.onAudit?.(it.audit);
        r.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); handlers.onAudit?.(it.audit); } };
      }
      wrap.append(r);
    });
    sync();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(measure);
  };
  wrap.addEventListener("click", (ev) => { const t = ev.target.closest?.(".cc-txt.cc-clip"); if (t && !t.closest(".cc-audit")) toggle(); });
  wrap.addEventListener("pointerenter", measure);
  more.onclick = toggle;
  return { wrap, more, set(list, h = {}) { items = list || []; handlers = h; render(); }, get items() { return items; } };
}
