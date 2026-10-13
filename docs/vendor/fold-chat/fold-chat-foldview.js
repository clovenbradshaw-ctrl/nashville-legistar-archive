// fold-chat-foldview.js — the viewer for a FOLD (fold-chat-fold.js): one card, three views.
//
//   Actions    the log of ACTIONS — what was done, in order (read, write, edit, try, check, fix); every edit is a real +/− diff
//   EOT        the log of CONTENT that was folded — penelope's Provenance@2 shape: sources, events, parents, byte ranges
//   Folded     the folded content itself — the HTML (or whatever language) as source, optionally with who wrote each line
//   Live       the folded content running — the interactive page, with attempt chips to step back through earlier drafts
//
// ONE CURSOR runs through all four. The slim row under the title scrubs through the EOT (event by event); every view shows
// the fold AS OF that event — Live runs the attempt that existed then, Folded shows its source, Actions and EOT dim what had
// not happened yet. "Reset from here" hands that point back to the app: the next change starts from that attempt, not the newest.
//
// It is a plain DOM component: mountFold(host, fold, opts) returns { update(), root }. While a run is in
// progress the app calls update() after every change and the card follows along (the active tab re-renders
// in place; the Log tab keeps scrolling to the newest entry unless you have scrolled up to read).
//
// Words: the default text is plain language ("code writer", "test page", "online AI"); the technical names
// (penelope, khora, janus, sandbox, sealed-external…) are on hover and in the "details" of each entry.

import { artifactOf, foldedLines, authorship, framesOf } from "./fold-chat-fold.js";
import { diffLines } from "./fold-chat-workspace.js";
import { sampleCalls, describeTrial } from "./fold-chat-trial.js";
import { eotFromFold, describeEvent, codeOfEvent } from "./fold-chat-eot.js";
import { FOLDVIEW_CSS, FOLDVIEW_STYLE_ID } from "./fold-chat-foldview.css.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Who, in words a person knows — the real name on hover. */
export function whoLabel(by) {
  const b = String(by || "");
  if (b === "penelope") return { text: "code writer", tip: "penelope — the generation pipeline running on this computer" };
  if (b === "khora") return { text: "reader", tip: "khora — reads your request" };
  if (b === "janus") return { text: "checker", tip: "janus — rules on what was measured" };
  if (b === "sandbox") return { text: "test page", tip: "the sandbox — opens the page and clicks every button" };
  if (b.startsWith("remote:")) return { text: "online AI", tip: `${b.slice(7) || "a remote model"} — reached through heimdall's sealed gate` };
  if (b === "app") return { text: "Fold", tip: "recorded by the app itself" };
  return { text: b || "—", tip: b };
}
export function makerLabel(maker) {
  if (!maker) return { text: "—", tip: "" };
  if (maker.kind === "penelope") return { text: "local writer", tip: "penelope — the code lane on this computer" };
  if (maker.kind === "remote") return { text: "online AI", tip: `${maker.model || "remote model"} — sealed-external` };
  if (maker.kind === "agent-loop") return { text: "agent loop", tip: "khora's agent loop" };
  if (maker.kind === "restored") return { text: "earlier version", tip: "restored from a point in an earlier fold" };
  return { text: String(maker.kind || "—"), tip: "" };
}
const STAGE_WORD = { read: "Read", arrange: "Plan", draw: "Write", edit: "Edit", fold: "Fold", observe: "Try", verify: "Check", repair: "Fix", escalate: "Help", retry: "Wait", done: "Result" };
const STATUS = { running: ["working…", "run"], held: ["it works", "ok"], "gave-up": ["not working yet", "bad"], stopped: ["stopped", "mut"], failed: ["failed", "bad"] };

function ensureStyle() {
  if (document.getElementById(FOLDVIEW_STYLE_ID)) return;
  const s = document.createElement("style"); s.id = FOLDVIEW_STYLE_ID; s.textContent = FOLDVIEW_CSS; document.head.append(s);
}

/** A quiet, collapsible home for the step-by-step transcript: `inner` is where the feed goes, `settle()` folds it shut once the run is done. */
export function tuckSteps(host, { open = true, label = "How it got here" } = {}) {
  ensureStyle();
  const root = document.createElement("details"); root.className = "fv-steps"; root.open = open;
  const sum = document.createElement("summary"); sum.textContent = label;
  const inner = el("div", "fv-steps-in");
  root.append(sum, inner); host.append(root);
  return { root, inner, setLabel(t) { sum.textContent = t; }, settle({ keepOpen = false, label: t = null } = {}) { if (t) sum.textContent = t; root.open = !!keepOpen; } };
}

/**
 * @param host   element to append the card to
 * @param fold   a fold (live object or revived snapshot)
 * @param opts   { renderArtifact(host, {kind, lang, title, code}) — the app's own preview card (copy / collapse / iterate), optional,
 *                 tab: initial tab, live: bool }
 */
export function mountFold(host, fold, { renderArtifact = null, tab = "live", live = false, onReset = null, reset = null, tryCall = null } = {}) {
  ensureStyle();
  const root = el("div", "fv" + (live ? " fv-live" : ""));
  const head = el("div", "fv-head");
  const title = el("span", "fv-title", "Fold");
  const chip = el("span", "fv-chip");
  const tabs = el("div", "fv-tabs", ""); tabs.setAttribute("role", "tablist");
  const body = el("div", "fv-body");
  head.append(title, chip, el("span", "fv-sp"), tabs);
  const scrub = el("div", "fv-scrub"); scrub.hidden = true;
  const prev = el("button", "fv-step", "‹"); prev.type = "button"; prev.title = "one change back (← on the slider)";
  const next = el("button", "fv-step", "›"); next.type = "button"; next.title = "one change forward (→ on the slider)";
  const range = document.createElement("input"); range.type = "range"; range.min = "0"; range.className = "fv-range"; range.setAttribute("aria-label", "scrub through the changes to the content");
  const playBtn = el("button", "fv-play", "▶ Play"); playBtn.type = "button"; playBtn.title = "replay this fold change by change — the page, the code and the log follow";
  const speedBtn = el("button", "fv-speed", "1×"); speedBtn.type = "button"; speedBtn.title = "playback speed";
  const latestBtn = el("button", "fv-latest", "latest ⤓"); latestBtn.type = "button"; latestBtn.title = "back to the newest change, following the run"; latestBtn.hidden = true;
  const where = el("span", "fv-where");
  const resetBtn = el("button", "fv-reset", "Reset from here"); resetBtn.type = "button"; resetBtn.hidden = true;
  const marker = el("span", "fv-marker"); marker.hidden = true;
  scrub.append(playBtn, speedBtn, prev, range, next, latestBtn, where, resetBtn, marker);
  root.append(head, scrub, body);
  host.append(root);

  let active = tab, cursor = null, resetMark = reset && reset.index != null ? { index: reset.index, round: reset.round ?? null } : null, stick = true, logFilter = "all", openEdits = new Set(), eotMode = "chain", showWho = false, openEvt = new Set(), showSources = false, openCode = null, showChanges = true;
  const TABS = [["live", "Live"], ["actions", "Actions"], ["eot", "EOT"], ["folded", "Folded"]];
  const btn = {};
  for (const [k, label] of TABS) {
    const b = el("button", "fv-tab", label); b.type = "button"; b.setAttribute("role", "tab");
    b.onclick = () => { active = k; render(); };
    btn[k] = b; tabs.append(b);
  }

  // The EOT and the FRAMES of the fold, rebuilt only when it has changed. A frame is a moment the CONTENT changed (fold-chat-fold.js
  // framesOf) — the cursor, the slider and Play step through frames, never through the actions taken about the content.
  // trace[i] says which action-log entry and attempt events[i] came from, so a frame can be placed in the log.
  let memo = { key: null, eot: null, trace: [], frames: [] };
  function eotNow() {
    const lastV = fold.versions[fold.versions.length - 1];
    const key = `${fold.log.length}:${fold.versions.length}:${fold.status}:${lastV ? lastV.code.length : 0}`;
    if (memo.key !== key) {
      const trace = []; let eot, fr;
      try { eot = eotFromFold(fold, { trace }); } catch { eot = { provenance: { events: [], sources: [], addressSpace: {} }, schema: "?", giver: "" }; }
      try { fr = framesOf(fold); } catch { fr = [{ n: 0, kind: "start", label: "the ask", code: "", complete: false, round: null, versionN: null, added: 0, removed: 0 }]; }
      memo = { key, eot, trace, frames: fr };
    }
    return memo;
  }
  const frames = () => eotNow().frames;
  const lastFrame = () => Math.max(0, frames().length - 1);
  const cursorAt = () => (cursor == null ? lastFrame() : Math.min(cursor, lastFrame()));
  const scrubbed = () => cursor != null && cursor < lastFrame();
  const frameVersion = (i) => { const f = frames()[i]; return f && f.versionN != null ? fold.versions.find((v) => v.n === f.versionN) || null : null; };
  /** The EOT event a frame sits at: where in the log of actions the content had become this. A partial frame sits at its attempt's
   *  first write; a complete one after its checks ran. */
  function anchorOf(i) {
    const P = eotNow(), f = P.frames[i];
    if (!f || f.kind === "start") return 0;
    const mine = []; P.trace.forEach((t, k) => { if (t.round === f.round) mine.push([k, t.stage]); });
    const WROTE = ["arrange", "draw", "edit", "fold"], DONE = ["draw", "edit", "fold", "observe", "verify", "done"];
    const hit = f.complete ? [...mine].reverse().find(([, st]) => DONE.includes(st)) : mine.find(([, st]) => WROTE.includes(st));
    return hit ? hit[0] : i > 0 ? anchorOf(i - 1) : 0;
  }
  const seqAt = (i) => { const t = eotNow().trace[anchorOf(i)]; return t ? t.seq : 0; };
  const seqAtCursor = () => seqAt(cursorAt());
  /** The latest frame at or before an EOT event / an action-log entry — what clicking that row puts the cursor on. */
  const frameOfEvent = (k) => { let r = 0; for (let i = 0; i <= lastFrame(); i++) if (anchorOf(i) <= k) r = i; return r; };
  const frameOfSeq = (sq) => { let r = 0; for (let i = 0; i <= lastFrame(); i++) if (seqAt(i) <= sq) r = i; return r; };
  const lastFrameOfVersion = (n) => { let r = 0; frames().forEach((f, i) => { if (f.versionN != null && f.versionN <= n) r = i; }); return r; };
  /** The attempt Live runs: while following, the artifact; once scrubbed, the last COMPLETE attempt at or before the cursor. */
  const versionOf = () => { if (!scrubbed()) return artifactOf(fold); for (let i = cursorAt(); i >= 0; i--) if (frames()[i].complete) return frameVersion(i); return null; };
  const roundName = (v) => (v.round === 0 ? "the starting point" : `attempt ${v.round}`);
  const frameWords = (f) => !f ? "" : f.kind === "start" ? "the ask — nothing written yet" : f.kind === "first" ? "first draft" : f.kind === "unit" ? `first draft · ${f.label}` : f.kind === "revision" ? `attempt ${f.round} · +${f.added} −${f.removed}` : `attempt ${f.round} · ${f.label} · +${f.added} −${f.removed}`;
  function moveTo(i, { fromPlay = false } = {}) { if (!fromPlay) stopPlay(); cursor = i >= lastFrame() ? null : Math.max(0, i); render(); }

  // ── Play ── replay the fold from the cursor (or from the start if it is at the end): every view follows, one content change at a time.
  let timer = null, speed = 1;
  const SPEEDS = [1, 2, 4], delayMs = () => Math.round(1100 / speed);
  const isPlaying = () => timer !== null;
  function stopPlay() { if (timer !== null) { clearTimeout(timer); timer = null; } playBtn.textContent = "▶ Play"; playBtn.classList.remove("on"); }
  function tick() {
    if (!root.isConnected) { stopPlay(); return; }
    const at = cursorAt();
    if (at >= lastFrame()) { stopPlay(); moveTo(Infinity, { fromPlay: true }); return; }
    moveTo(at + 1, { fromPlay: true });
    if (cursor === null) { stopPlay(); return; }                       // reached the newest frame
    timer = setTimeout(tick, delayMs());
  }
  function startPlay() {
    if (lastFrame() < 1) return;
    if (!scrubbed()) cursor = 0;                                       // at the newest frame: play it again from the beginning
    playBtn.textContent = "❚❚ Pause"; playBtn.classList.add("on");
    render();
    timer = setTimeout(tick, delayMs());
  }
  playBtn.onclick = () => (isPlaying() ? stopPlay() : startPlay());
  speedBtn.onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; speedBtn.textContent = speed + "×"; if (isPlaying()) { clearTimeout(timer); timer = setTimeout(tick, delayMs()); } };

  function paintHead() {
    let [word, cls] = STATUS[fold.status] || [fold.status, "mut"];
    const last = artifactOf(fold);
    if (fold.status === "held" && last && last.kind !== "html") { word = "loads cleanly"; chip.title = "it loads and runs without errors — nothing has checked that it does what you described"; }
    else chip.title = "";
    chip.textContent = word; chip.className = "fv-chip fv-" + cls;
    const n = fold.versions.filter((v) => v.round > 0).length;
    title.textContent = n ? `Fold · ${n} attempt${n === 1 ? "" : "s"}` : "Fold";
    for (const [k, label] of TABS) {
      btn[k].classList.toggle("on", k === active); btn[k].setAttribute("aria-selected", k === active ? "true" : "false");
      btn[k].textContent = label;
      btn[k].title = { actions: `the log of actions — what was done, in order (${fold.log.length})`, eot: `the log of content that was folded — penelope's Provenance@2 shape (${eotNow().eot.provenance.events.length} events)`, folded: "the folded content itself — the source", live: "the folded content running — interact with it" }[k];
    }
    paintScrub();
  }

  // ── the cursor ──
  function paintScrub() {
    const P = eotNow(), F = P.frames, N = F.length;
    scrub.hidden = N < 2;                                                // no content yet: nothing to scrub, play or change
    if (scrub.hidden) return;
    const at = scrubbed(), i = cursorAt(), fr = F[i];
    range.max = String(N - 1); range.value = String(i);
    where.textContent = `${String(i).padStart(2, "0")} / ${N - 1} · ${frameWords(fr)}`;
    where.title = at ? "the content as of this change — drag, or use ← →" : "following the newest change";
    scrub.classList.toggle("on", at);
    prev.disabled = i <= 0; next.disabled = !at; latestBtn.hidden = !at;
    const v = at ? frameVersion(i) : null;
    // Scrubbed back: reset to that exact code. At the newest frame of a FINISHED run: "Change this" — the next change starts from the result.
    const vNow = at ? v : artifactOf(fold);
    const canReset = !!onReset && !!vNow && fr.kind !== "start" && !!fr.code && (at || fold.status !== "running");
    resetBtn.hidden = !canReset;
    resetBtn.textContent = at ? "Reset from here" : "Change this";
    if (canReset) resetBtn.title = at ? `the next change starts from this exact code (${frameWords(fr)}) — not the newest attempt` : "the next change starts from this result, not from scratch";
    marker.hidden = !resetMark;
    if (resetMark) {
      marker.textContent = "";
      marker.append(`next change starts from ${resetMark.text || (resetMark.round === 0 ? "the earlier version" : "attempt " + resetMark.round)} · `);
      const undo = el("button", "fv-undo", "undo"); undo.type = "button";
      undo.onclick = () => { resetMark = null; onReset?.(null); render(); };
      marker.append(undo);
    }
  }
  range.oninput = () => moveTo(Number(range.value));
  latestBtn.onclick = () => moveTo(Infinity);
  prev.onclick = () => moveTo(cursorAt() - 1);
  next.onclick = () => moveTo(cursorAt() + 1);
  resetBtn.onclick = () => {
    const P = eotNow(), i = cursorAt(), fr = P.frames[i], v = frameVersion(i);
    if (!v || !onReset || !fr || fr.kind === "start") return;   // (at the newest frame the version is the one that frame belongs to)
    const k = anchorOf(i);
    resetMark = { index: i, round: fr.round, text: fr.complete ? roundName(v) : `${roundName(v)} (${fr.label})` };
    onReset({ index: i, eventId: P.eot.provenance.events[k]?.event_id || null, seq: P.trace[k]?.seq ?? 0, version: { round: fr.round, kind: v.kind, code: fr.code, partial: !fr.complete }, foldId: fold.id });
    render();
  };

  /** The attempt chips: click one to jump to its last change; click the newest to follow the live run again. */
  function chipsRow(v) {
    const chips = el("div", "fv-chips");
    if (fold.versions.length < 2) return chips;   // one attempt needs no picker
    for (const x of fold.versions) {
      const b = el("button", "fv-vchip" + (v && x.n === v.n ? " on" : "") + (x.held ? " held" : ""), x.round === 0 ? "start" : `attempt ${x.round}`); b.type = "button";
      b.title = `${makerLabel(x.maker).text} · ${x.lines} lines${x.held ? " · this one works" : ""}`;
      b.onclick = () => moveTo(x === fold.versions[fold.versions.length - 1] ? Infinity : lastFrameOfVersion(x.n));
      chips.append(b);
    }
    return chips;
  }

  /** For code that is not a page: what it DID when it was called — the sandbox's sample calls — and a box to call it yourself. */
  function resultsPanel(v) {
    const box = el("div", "fv-results");
    const tried = (v.checks || []).find((c) => c.name === "tried it");
    box.append(el("div", "fv-rh", tried ? "What it did when called" : "It has not been called yet"));
    if (tried && tried.detail) {
      for (const line of tried.detail.split("\n")) {
        const m = /^(.*?) (→|threw) (.*)$/s.exec(line);
        const row = el("div", "fv-trow" + (m && m[2] === "threw" ? " bad" : ""));
        if (m) row.append(el("code", "fv-texpr", m[1]), el("span", "fv-tarrow", m[2] === "→" ? "→" : "threw"), el("code", "fv-tval", m[3])); else row.append(el("code", "fv-tval", line));
        box.append(row);
      }
    } else if (!tried) box.append(el("div", "fv-cap", "Nothing found to call, or this attempt was not run yet."));
    if (tryCall) {
      const form = el("form", "fv-try");
      const input = document.createElement("input"); input.type = "text"; input.className = "fv-tryin"; input.spellcheck = false;
      input.placeholder = sampleCalls(v.code)[0] || "call it, e.g. myFunction(1, 2)"; input.setAttribute("aria-label", "call the code");
      const go = el("button", "fv-filter", "Run"); go.type = "submit";
      const out = el("div", "fv-tryout");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const expr = input.value.trim() || input.placeholder; if (!expr) return;
        go.disabled = true; out.className = "fv-tryout"; out.textContent = "running…";
        try { const r = await tryCall(v.code, expr); out.textContent = r ? describeTrial(r) : "no answer"; out.classList.toggle("bad", !!r && !r.ok); }
        catch (err) { out.textContent = "could not run: " + (err?.message || err); out.classList.add("bad"); }
        go.disabled = false;
      };
      form.append(input, go); box.append(form, out);
    }
    return box;
  }

  // ── Live ──
  function paintLive() {
    body.textContent = "";
    if (!fold.versions.length) {
      const why = fold.status === "failed" ? [...fold.log].reverse().find((x) => x.ok === false && x.detail) : null;
      body.append(el("div", "fv-empty", fold.status === "running" ? "Waiting for the first draft… the Actions tab shows what's happening." : "No draft was produced." + (why ? " " + why.detail + (/fetch|network|load failed|bridge/i.test(why.detail) ? " Check that the Fold server is running and try again." : "") : " The Actions tab shows what happened.")));
      return;
    }
    const v = versionOf();
    const cf = frames()[cursorAt()];
    if (!v) { body.append(el("div", "fv-empty", cf && cf.kind !== "start" ? `Being written — ${frameWords(cf)}. The Folded tab shows the code exactly as it stood at this point.` : "Nothing had been written yet at this point.")); return; }
    const chips = chipsRow(v);
    const mk = makerLabel(v.maker);
    const stat = v.diffStat && v.round > 0 && fold.versions.indexOf(v) > 0 ? ` · +${v.diffStat.added} −${v.diffStat.removed} vs before` : "";
    const verdict = v.round === 0 ? "restored — nothing has been checked yet" : v.held ? (v.kind === "html" ? "works — every check passed" : "loads and runs — its behaviour was NOT tested against your description") : v.problems.length ? `${v.problems.length} problem${v.problems.length === 1 ? "" : "s"} found` : fold.status === "running" ? "being checked…" : "not verified";
    chips.append(el("span", "fv-cap", `${mk.text}${stat} · ${verdict}`));
    chips.lastChild.title = mk.tip;
    body.append(chips);
    if (scrubbed() && cf && !cf.complete) body.append(el("div", "fv-cap", `This is the last complete attempt. The content is mid-change (${frameWords(cf)}) — the Folded tab shows it exactly as it stood.`));
    if (v.kind !== "html") body.append(resultsPanel(v));
    const holder = el("div", "fv-art");
    const art = { kind: v.kind === "html" ? "html" : "js", lang: v.kind === "html" ? "html" : "js", title: v.kind === "html" ? "Preview" : "Code", code: v.code };
    if (renderArtifact) renderArtifact(holder, art); else if (v.kind === "html") { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = v.code; holder.append(f); } else holder.append(el("pre", "fv-code", v.code));
    body.append(holder);
    if (v.problems.length && !v.held) { const ul = el("ul", "fv-problems"); for (const p of v.problems.slice(0, 5)) ul.append(el("li", "", p)); if (v.problems.length > 5) ul.append(el("li", "fv-dim", `… and ${v.problems.length - 5} more`)); body.append(ul); }
  }

  // ── Actions ──
  const FILTERS = [["all", "everything"], ["edits", "edits"], ["problems", "problems"]];
  function paintActions() {
    const prevTop = body.scrollTop, wasAtEnd = stick;
    body.textContent = "";
    const bar = el("div", "fv-filters");
    for (const [k, label] of FILTERS) { const b = el("button", "fv-filter" + (k === logFilter ? " on" : ""), label); b.type = "button"; b.onclick = () => { logFilter = k; render(); }; bar.append(b); }
    bar.append(el("span", "fv-cap", "append-only — nothing here is rewritten"));
    body.append(bar);
    let list = fold.log;
    if (logFilter === "edits") list = list.filter((e) => e.stage === "edit" || e.stage === "fold" || e.stage === "draw");
    if (logFilter === "problems") list = list.filter((e) => e.ok === false);
    if (!list.length) body.append(el("div", "fv-empty", logFilter === "all" ? "Nothing yet." : "Nothing matches."));
    let lastRound = null;
    for (const e of list) {
      if (e.round !== lastRound && e.round != null && e.round > 0) { body.append(el("div", "fv-round", `attempt ${e.round}`)); lastRound = e.round; }
      const at = scrubbed(), sq = seqAtCursor();
      const row = el("div", "fv-row " + (e.ok === true ? "ok" : e.ok === false ? "bad" : "mut") + (at && e.seq > sq ? " future" : "") + (at && e.seq === sq ? " cur" : ""));
      row.onclick = (ev) => { if (ev.target.closest("button, summary, details")) return; moveTo(frameOfSeq(e.seq)); };   // the latest content change at or before this action
      row.append(el("span", "fv-seq", String(e.seq).padStart(2, "0")), el("span", "fv-glyph", e.ok === true ? "✓" : e.ok === false ? "✗" : "·"));
      const main = el("div", "fv-main");
      const top = el("div", "fv-line");
      const st = el("span", "fv-stage", STAGE_WORD[e.stage] || e.stage); st.title = e.stage;
      const w = whoLabel(e.by); const who = el("span", "fv-who", w.text); who.title = w.tip;
      top.append(st, el("span", "fv-t", e.title), who, el("span", "fv-time", (e.at / 1000).toFixed(0) + "s"));
      main.append(top);
      if (e.detail) main.append(el("div", "fv-detail", e.detail));
      if (e.stage === "edit" && e.edit && e.edit.versionN) {
        const ver = fold.versions.find((x) => x.n === e.edit.versionN);
        if (ver && ver.hunks.length) {
          const t = el("button", "fv-more", openEdits.has(e.seq) ? "hide the edit" : `show the edit (${ver.hunks.length} change${ver.hunks.length === 1 ? "" : "s"})`); t.type = "button";
          t.onclick = () => { openEdits.has(e.seq) ? openEdits.delete(e.seq) : openEdits.add(e.seq); render(); };
          main.append(t);
          if (openEdits.has(e.seq)) { const pre = el("div", "fv-diff"); for (const h of ver.hunks) { for (const l of h.lines) pre.append(el("div", "fv-d fv-d-" + l.op, (l.op === "add" ? "+ " : l.op === "del" ? "− " : "  ") + l.line)); pre.append(el("div", "fv-d fv-d-gap", "⋯")); } main.append(pre); }
        }
      }
      if (e.tech) { const d = el("details", "fv-tech"); d.append(el("summary", "", "details"), el("code", "", e.tech)); main.append(d); }
      row.append(main); body.append(row);
    }
    // keep following the newest entry while the run is live, unless the person scrolled up to read
    if (scrubbed()) body.querySelector(".fv-row.cur")?.scrollIntoView({ block: "nearest" });
    else if (live && wasAtEnd) body.scrollTop = body.scrollHeight; else body.scrollTop = prevTop;
  }
  body.addEventListener("scroll", () => { stick = body.scrollTop + body.clientHeight >= body.scrollHeight - 24; });

  // ── EOT ──  the log of CONTENT that was folded
    /** The code an event stands for, in full: a diff shows the whole file with every change marked; a range shows exactly those bytes. */
  function codePanel(c) {
    const box = el("div", "fv-codebox"); box.onclick = (e) => e.stopPropagation();
    const head = el("div", "fv-codehead");
    const cap = c.kind === "diff" ? `attempt ${c.round}${c.from != null ? ` vs attempt ${c.from}` : " — the first draft"} · +${c.added} −${c.removed} · the whole file, changes marked`
      : c.kind === "range" ? `attempt ${c.round} · lines ${c.startLine}–${c.endLine} · bytes ${c.bytes[0]}–${c.bytes[1]}`
      : `attempt ${c.round} · the whole file · ${c.lines} lines`;
    const plain = c.kind === "diff" ? c.diff.filter((d) => d.op !== "del").map((d) => d.line).join("\n") : c.text;
    const copy = el("button", "fv-filter", "copy"); copy.type = "button";
    copy.onclick = async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(plain); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch {} };
    head.append(el("span", "fv-cap", cap), copy);
    const pre = el("div", "fv-codelines");
    if (c.kind === "diff") {
      let n = 0;
      for (const d of c.diff) { if (d.op !== "del") n++; const r = el("div", "fv-cl fv-cl-" + d.op); r.append(el("span", "fv-n", d.op === "del" ? "" : String(n)), el("span", "fv-sign", d.op === "add" ? "+" : d.op === "del" ? "−" : " "), el("span", "fv-src", d.line || " ")); pre.append(r); }
    } else {
      const ls = c.text.replace(/\n$/, "").split("\n");
      ls.forEach((t, k) => { const r = el("div", "fv-cl"); r.append(el("span", "fv-n", String(c.startLine + k)), el("span", "fv-sign", " "), el("span", "fv-src", t || " ")); pre.append(r); });
    }
    box.append(head, pre);
    return box;
  }
  const STAGE_CLS = { intent: "a", prior: "a", read: "a", ground: "a", arrange: "b", "draw-request": "b", draw: "c", hunt: "c", fold: "d", verify: "e", repair: "f", materialize: "d", ibid: "a", void: "a" };
  function paintEot() {
    body.textContent = "";
    const eot = eotNow().eot, P = eot.provenance;
    const srcs = new Map(P.sources.map((x) => [x.source_id, x]));
    const bar = el("div", "fv-filters");
    for (const [k, label] of [["chain", "events"], ["raw", "raw JSON"]]) { const b = el("button", "fv-filter" + (k === eotMode ? " on" : ""), label); b.type = "button"; b.onclick = () => { eotMode = k; render(); }; bar.append(b); }
    const copy = el("button", "fv-filter", "copy"); copy.type = "button";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(eot, null, 2)); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch {} };
    const dl = el("button", "fv-filter", "download .eot.json"); dl.type = "button";
    dl.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(eot, null, 2)], { type: "application/json" })); a.download = (fold.id || "fold") + ".eot.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
    bar.append(copy, dl);
    body.append(bar);
    const meta = el("div", "fv-eotmeta");
    meta.textContent = `${eot.schema} › ${P.schema} · ${P.events.length} events · ${P.sources.length} sources · addresses are ${P.addressSpace.unit}s of the ${P.addressSpace.artifact} · given by ${eot.giver}`;
    meta.title = "ids are derived exactly as penelope derives them: prefix_ + the first 20 hex of sha256 of the canonical JSON";
    body.append(meta);
    if (eotMode === "raw") { const pre = el("pre", "fv-code fv-raw"); pre.textContent = JSON.stringify(eot, null, 2); body.append(pre); return; }
    const sb = el("button", "fv-more", showSources ? "hide the sources" : `show the sources (${P.sources.length})`); sb.type = "button"; sb.onclick = () => { showSources = !showSources; render(); }; body.append(sb);
    if (showSources) { const t = el("div", "fv-srcs"); for (const x of P.sources) { const r = el("div", "fv-src-row"); r.append(el("span", "fv-id", x.source_id.slice(4, 12)), el("span", "fv-sk", x.kind), el("span", "fv-sl", String(x.locator)), el("span", "fv-sm", x.anchor ? `${x.anchor.start}–${x.anchor.end}` + (x.meta?.maker ? " · " + (x.meta.maker.kind === "remote" ? "remote:" + (x.meta.maker.model || "") : x.meta.maker.kind) : "") : "")); t.append(r); } body.append(t); }
    const list = el("div", "fv-evts");
    P.events.forEach((ev, i) => {
      const d = describeEvent(ev, srcs);
      const at = scrubbed(), ci = anchorOf(cursorAt());
      const row = el("div", "fv-ev " + (d.ok === true ? "ok" : d.ok === false ? "bad" : "mut") + (at && i > ci ? " future" : "") + (at && i === ci ? " cur" : "") + (resetMark && anchorOf(resetMark.index) === i ? " mark" : ""));
      const top = el("div", "fv-evline");
      const idEl = el("span", "fv-id", d.short); idEl.title = "show this event's JSON";
      idEl.onclick = (e2) => { e2.stopPropagation(); openEvt.has(ev.event_id) ? openEvt.delete(ev.event_id) : openEvt.add(ev.event_id); render(); };
      top.append(el("span", "fv-evn", String(i + 1).padStart(2, "0")), idEl, el("span", "fv-evstage fv-s-" + (STAGE_CLS[d.stage] || "a"), d.stage));
      if (d.transform) top.append(el("span", "fv-evt", d.transform));
      if (d.unit) top.append(el("span", "fv-evunit", "unit " + d.unit));
      if (d.range) top.append(el("span", "fv-evr", d.range));
      if (d.ok !== null) top.append(el("span", "fv-evok", d.ok ? "✓" : "✗"));
      const sub = el("div", "fv-evsub");
      if (d.source) sub.append(el("span", "", "from " + d.source));
      if (d.parent) sub.append(el("span", "", "← " + d.parent));
      const note = ev.detail?.note || ev.detail?.check || ev.detail?.what; if (note) sub.append(el("span", "fv-evnote", String(note).slice(0, 140)));
      row.append(top, sub);
      const code = codeOfEvent(fold, ev, srcs);
      if (code) top.append(el("span", "fv-codetag", code.kind === "diff" ? `code · +${code.added} −${code.removed}` : code.kind === "range" ? `code · lines ${code.startLine}–${code.endLine}` : `code · ${code.lines} lines`));
      row.onclick = () => { openCode = code && openCode !== i ? i : null; moveTo(frameOfEvent(i)); };   // click an event: the cursor goes there and the code it stands for opens under it; its id shows the raw JSON
      if (code && openCode === i) row.append(codePanel(code));
      if (openEvt.has(ev.event_id)) { const pre = el("pre", "fv-code fv-raw"); pre.textContent = JSON.stringify(ev, null, 2); row.append(pre); }
      list.append(row);
    });
    body.append(list);
    if (scrubbed()) list.querySelector(".fv-ev.cur")?.scrollIntoView({ block: "nearest" }); else if (live) body.scrollTop = body.scrollHeight;
  }

  // ── Folded ──  the folded content itself: the source, in whatever language it is
  function paintFolded() {
    body.textContent = "";
    const i = cursorAt(), fr = frames()[i];
    if (!fr || fr.kind === "start") { body.append(el("div", "fv-empty", fold.versions.length ? "Nothing had been written yet at this point." : "Nothing to fold yet.")); return; }
    const v = frameVersion(i);
    const nLines = fr.code.split("\n").length;
    const chips = chipsRow(v);
    chips.append(el("span", "fv-cap", `${v.kind === "html" ? "HTML" : v.kind === "js" ? "JavaScript" : v.kind} · ${nLines} lines · ${frameWords(fr)}${scrubbed() ? " (the cursor is back in time — ‹ › or drag to move it)" : ""}`));
    body.append(chips);
    const bar = el("div", "fv-filters");
    const tc = el("button", "fv-filter" + (showChanges ? " on" : ""), "mark what changed"); tc.type = "button"; tc.title = "green = added in this change, red = removed by it"; tc.onclick = () => { showChanges = !showChanges; render(); };
    const useWho = showWho && fr.complete;
    const tg = el("button", "fv-filter" + (useWho ? " on" : ""), "who wrote each line"); tg.type = "button"; tg.title = fr.complete ? "" : "only for a finished attempt"; tg.onclick = () => { showWho = !showWho; render(); };
    const copy = el("button", "fv-filter", "copy the code"); copy.type = "button";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(fr.code); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy the code"), 1200); } catch {} };
    bar.append(tc, tg, copy); body.append(bar);
    if (useWho) {
      const lines = foldedLines(fold, v), who = authorship(lines);
      const COLORS = ["var(--fv-a)", "var(--fv-b)", "var(--fv-c)", "var(--fv-d)"];
      const colorOf = new Map(who.map((a, k) => [a.maker, COLORS[k % 4]]));
      const share = el("div", "fv-share");
      who.forEach((a, k) => { const x = el("i"); x.style.width = (a.share * 100).toFixed(1) + "%"; x.style.background = COLORS[k % 4]; x.title = `${a.maker}: ${a.lines} lines`; share.append(x); });
      body.append(share);
      const leg = el("div", "fv-legend");
      who.forEach((a, k) => { const m = a.maker.startsWith("remote:") ? { text: "online AI", tip: a.maker } : makerLabel({ kind: a.maker }); const sp = el("span", "", `${m.text} wrote ${a.lines} line${a.lines === 1 ? "" : "s"} (${Math.round(a.share * 100)}%)`); sp.title = m.tip; const dot = el("i"); dot.style.background = COLORS[k % 4]; sp.prepend(dot); leg.append(sp); });
      body.append(leg);
      const pre = el("div", "fv-fold");
      let prevKey = null;
      for (const l of lines) {
        const mk = l.maker?.kind === "remote" ? "remote:" + (l.maker.model || "") : l.maker?.kind || "?";
        const key = mk + "|" + l.round + "|" + (l.unit || "");
        if (l.unit && (prevKey === null || !prevKey.endsWith("|" + l.unit))) pre.append(el("div", "fv-unit", `unit · ${l.unit}`));
        const row = el("div", "fv-fl"); row.style.setProperty("--m", colorOf.get(mk) || "var(--fv-a)");
        row.append(el("span", "fv-n", String(l.n)));
        const g = el("span", "fv-gut", key !== prevKey ? `attempt ${l.round}` : ""); g.title = makerLabel(l.maker).tip; row.append(g);
        row.append(el("span", "fv-src", l.text || " "));
        pre.append(row); prevKey = key;
      }
      body.append(pre);
      return;
    }
    // The code exactly as it stood at this frame. What THIS change added is green, what it removed is shown in red where it was.
    const before = i > 0 && frames()[i - 1].kind !== "start" ? frames()[i - 1].code : null;
    const ops = showChanges ? diffLines(before, fr.code) : fr.code.split("\n").map((line) => ({ op: "eq", line }));
    const pre = el("div", "fv-codelines fv-fold");
    let n = 0;
    for (const d of ops) {
      if (d.op !== "del") n++;
      const r = el("div", "fv-cl fv-cl-" + d.op);
      r.append(el("span", "fv-n", d.op === "del" ? "" : String(n)), el("span", "fv-sign", d.op === "add" ? "+" : d.op === "del" ? "−" : " "), el("span", "fv-src", d.line || " "));
      pre.append(r);
    }
    body.append(pre);
  }

  function render() {
    paintHead();
    if (active === "live") paintLive(); else if (active === "actions") paintActions(); else if (active === "eot") paintEot(); else paintFolded();
  }
  render();
  return {
    root,
    /** Call after the fold changed. A live artifact follows the latest attempt unless you pinned an earlier one. */
    update() { render(); },
    show(tabName) { active = tabName; render(); },
    /** The host moved or cleared the reset point (for example the next turn consumed it). */
    setReset(mark) { resetMark = mark ? { index: mark.index ?? null, round: mark.round ?? null } : null; render(); },
  };
}
