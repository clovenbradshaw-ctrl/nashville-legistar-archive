// fold-chat.js — The Fold's chat version, LibreChat's UX, Fold-native.
//
// Standalone surface (this repo is the source of truth; it is vendored into
// the-fold). A browser page, no build. The model runs IN THIS TAB (fold-chat-webllm.js, WebGPU) — no bridge needed to answer. The
// Fold's own server mounts heimdall at /heimdall on this page's origin (server.mjs); it routes the fleet, linked hosts and the
// sealed remote providers, and serves the doors (read, reason, weave, code). Outside models are sealed-external — the chat never
// sends raw workspace material, and the evidence drawer reports who did the work. An in-tab model never leaves the tab.
//
// Affordances (LibreChat's, built for the fold): icon rail + chat sidebar,
// model/endpoint switcher, Projects, Chats grouped by time, a centered
// welcome + big composer, generative artifacts (isolated HTML previews, code
// cards), conversation memory (fork / edit / continue), presets, a live stage
// line, and the sealed badge always visible.

import * as client from "./fold-chat-client.js";
import { mountFolds, isMakeAsk } from "./fold-chat-folds.js";
import { artifactsOf, previewable } from "./fold-chat-artifacts.js";
import { mdHtml } from "./fold-chat-render.js";
import * as memory from "./fold-chat-memory.js";
import * as ground from "./fold-chat-ground.js";
import { presentationOf, agreementOf, salientSentences } from "./fold-chat-present.js";
import { renderPresented, mountLive, armTailReplay, renderTapeStrip } from "./fold-chat-presentview.js";
import * as shelf from "./fold-chat-book.js";
import * as bookfold from "./fold-chat-bookfold.js";   // the mechanical FOLD of a shelfed book (no model): the chapter-reduction rung the shelf lacked
import * as bookscenes from "./fold-chat-bookscenes.js";   // the SCENES BENEATH the fold: Murch-cut scenes, each event the book's own sentence, verbatim at its address
import * as web from "./fold-chat-web.js";
import { falsifyAnswer, FAILING, claimSentences, routeOf, pickPassages, restateClaimMessages, replaceSentence, reImpress } from "./fold-chat-falsify-answer.js";
// What this tab has already read, and which hosts turned it away: a follow-up about the same pages costs no fetch.
const pageMemo = web.makeMemo();
import { classifyTurn, GENERATE_NUDGE, GENERATE_CREATIVE_NUDGE, checkable, recordable, skipsSearch, noClaimsLabel, KIND_PROMPT } from "./fold-chat-discourse.js";
import { describeOutput, genVoidShape, voidsAfterSearch } from "./fold-chat-outputtype.js";   // what is asked to be PRODUCED: type, topic through the thread, needsSources, typed gaps (G1, 2026-10-07)
import { evaluate as computeEvaluate, answerKeeps } from "./fold-chat-compute.js";
import { UNSOURCED_ANSWERS, unsourcedPlan, sourcesPrompt, liveAsk, unreachedGap, liveGap, emptyNotice, errorNotice, declinedFallbackNotice, noModelFallbackNotice, gapAnswerLine, modelSpeaksAlone, aloneTurn } from "./fold-chat-gaps.js";
// THE VOID FOR A WRITTEN OUTPUT (fold-chat-genvoid.js): a failed generate/compose turn draws a typed gap that names the thing asked for, never the sources as the piece.
// G1's describeOutput() (fold-chat-outputtype.js, wired by eval/ants/g1/wire.diff) supplies the output type; genVoidShape(outType, KNOWN_FORMS) maps it. outputTypeFromAsk() is only the fallback.
import { genVoid, outputTypeFromAsk, strandFallbackAllowed, genVoidText, KNOWN_FORMS } from "./fold-chat-genvoid.js";
import { threadPrompt, threadNotice, coldFollowUpNotice, missingAnswerNotice, addressesThread } from "./fold-chat-thread.js";// GARY, TERRY GROSS AND THE PATHOS ARCHONS (vendored khora organs, by closure): the prompt door (what the mouth is handed, in what
// order, question last, a refused fold withheld), the conversation's flow (follow-ups, push-backs and frame-asks are moves against
// the thread), and the felt shape of the recent answers for a DECLARED experiencer.
import { door as garyDoor, noteWindows } from "./fold-chat-gary.js";
import { planTurn, cuesFor, actOf } from "./fold-chat-flow.js";
import { readFelt } from "./fold-chat-pathos.js";
import { hintsFor } from "./fold-chat-hints.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { applyCarry } from "./fold-chat-carry.js";
import { continuesByAnaphora } from "./fold-chat-anaphora.js";   // G3: does the ask lean on the earlier turn? one verdict, pure code
import { addOp, correctionOp, rejectedSurfaces, carryNotice, mindsClause } from "./fold-chat-minds.js";
import { castOf } from "./fold-chat-casts.js";
import { claimsOfTurn, appendClaims, pointerOf } from "./fold-chat-record.js";
import { freshnessOf } from "./fold-chat-freshness.js";
import { recallOf } from "./fold-chat-recall.js";
import { askTerms, salientSources, continuesThread, salientHistory, salientSummary, salienceEnabled } from "./fold-chat-salience.js";
// what the model is told about the conversation so far is the EXCHANGE (what was asked, what the fold said), never what the web returned
import { applyExchange, usedRefs, foldAnswer, exchangesOf, exchangeFlow } from "./fold-chat-exchange.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { lookupWarranted } from "./fold-chat-self.js";
import { sourceRecall } from "./fold-chat-sourceask.js";
import { pre as watchPre, post as watchPost, wantLine, batonReply, inspectReply, keepOnTopic, withoutAppAnswered, challengeReply } from "./fold-chat-watch.js";
// WHERE THE ANSWER CAME FROM, said mechanically: a second model call POINTS at a source sentence; the app verifies it, snips it and narrates around it (docs/VOICE.md)
import { provenanceFor, provenanceEnabled } from "./fold-chat-provenance.js";
import { findPrimary, mergeProvenance } from "./fold-chat-primary.js";
import { fetchLoaded, describeLoaded, noModelWhy, createLoadedPoller } from "./fold-chat-loaded.js";
import { createPageEngine, canonicalModelId, ollamaTagOf, MODEL_CHOICES } from "./fold-chat-webllm.js";
import { snipsOf, strandText, storeSnip, verifySnips, STRAND } from "./fold-chat-strand.js";
import { slotTurnWanted, slotPipelineOn, runSlotTurn, endsTurn, answerLine, storeAnswerTurn, traceFeed, answerRecordNote, answerProcessLine } from "./fold-chat-answerwire.js";
import { mountAnswerCard } from "./fold-chat-answercard.js";
import { pivotText, verifyPivot, storePivot, pivotLine, standingLine, pivotEnabled, relevantPassages } from "./fold-chat-pivot.js";
// the gate HISTORY (the fold's a900f6e): a check that has never withheld anything reads "unmeasured", never "pass" (Constitution II.10 over time)
import { noteRun as noteGates, gatesLine } from "./fold-chat-gates.js";
// a reply CUT OFF at the token limit is continued (bounded) and the drafts joined mechanically before the Pivot reads them
import { CONTINUE, cutOff, continueMessages, joinDraft } from "./fold-chat-continue.js";
import { renderStrand } from "./fold-chat-strandview.js";
import { ANSWER_MODES, normAnswerMode, resolveAnswerMode, answerModeOfTurn } from "./fold-chat-answer.js";
import { stripScaffolding, checkAttributions, attributionNotice } from "./fold-chat-attribution.js";
import { originatePassages } from "./fold-chat-originwire.js";
import { isTertiary, traceWords } from "./fold-chat-origin.js";
import { detectLang, sameLanguage, languageInstruction, restateMessages, languageNotice, threadLanguage } from "./fold-chat-lang.js";
import { senseTerm, disambiguationOf, sensesLine } from "./fold-chat-senses.js";
import { voidReport, voidText, voidLabel, normVoid, migrateSessions, modelHistory } from "./fold-chat-channels.js";
import { recipeSnips, CARD_PROMPT } from "./fold-chat-snip.js";
import { renderSnips } from "./fold-chat-snipview.js";
import { configureTip, tipControl } from "./fold-chat-tipview.js";
import { jumpToSnip } from "./fold-chat-pagerview.js";
import { isExtension } from "./fold-chat-exit.js";
import * as topic from "./fold-chat-topic.js";
import { PHOSPHOR, PHOSPHOR_VIEWBOX } from "./fold-chat-icons.js";
import * as FOLD from "./vendor/the-fold/fold.js";
import { runAgent } from "./fold-chat-agent.js";
import { observeArtifact, callMany } from "./fold-chat-sandbox.js";
import { createFeed, replayFeed } from "./fold-chat-agentfeed.js";
import { newTurnTrace, startEvents, lineEvent, beginStep, endStep, noteEvent, doneEvents, eventsForStep, summaryLine, storeEvents, fallbackProcessLine } from "./fold-chat-turnfeed.js";
import { createFold, addVersion as addFoldVersion, addLog as addFoldLog, addEvent as addFoldEvent, snapshot as foldSnapshot, revive as foldRevive } from "./fold-chat-fold.js";
import { mountFold, tuckSteps } from "./fold-chat-foldview.js";
import { createOutbound, describeSummary, formatBytes } from "./fold-chat-outbound.js";
import { mountMonitor } from "./fold-chat-monitor.js";
import { createTaint } from "./fold-chat-seal.js";
import { createRedactor, DEFAULT_REDACTOR } from "./fold-chat-redact.js";
import * as life from "./fold-chat-sessions.js";
import { clipAsk } from "./fold-chat-clip.js";

const PRESETS = Object.freeze({
  plain: { label: "Plain", system: "You are a helpful assistant. Reply directly, briefly, and naturally, the way a person would. If the person just says hi or asks how you are, answer in kind and offer to help — do not ask them for files or material." },
  fold: { label: "Fold", system: "You are the fold — the reading and research surface over this person's own material: their documents, transcripts, reports, pages, records, and the live web. Reply plainly, in a warm, grounded voice. You research people, relationships, and events from SOURCES: when asked about a person, report what the sources say, quoting and citing them — that is the work, and it is fine to do. The conversation itself is NEVER a source. Ground every factual claim in the material you were given (attachments, pasted documents, web passages); never ground in the dialogue, and never in your own memory. You may not ASSERT a personal fact you were not given — but you may report a sourced one and point to where it came from. Where the material does not cover something, say plainly what is missing instead of filling it in. Never claim a source you cannot show. When greeted — hi, hey, how are you — answer warmly and briefly." },
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
// A model content-refusal, not an answer: "I cannot…", "I do not have access to
// personal information…", "I'm unable to…". Short and apology-flavoured.
const REFUSAL_RE = /\b(i (?:can(?:no|')t|am unable|cannot|do not have access|don'?t have access|won'?t|will not)|i'm sorry,? but|as an ai|i am not able|i'm not able)\b/i;
function isRefusal(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  // Only a SHORT apology/refusal counts — a long answer that merely contains a
  // caveat is not a refusal.
  if (t.length > 320) return false;
  return REFUSAL_RE.test(t) && !/\b(source|according to|https?:|\b\d{3,4}\b)/i.test(t);
}
// A real CODE/files task (dispatch to the machine door) vs. a research/writing
// question that happens to be asked while the Code engagement is selected.
function isCodeTask(text) {
  const t = String(text ?? "");
  // A factual/comparative question is never a code task, even in Code mode.
  if (/^(who|what|when|where|which|why|how many|how much|compare|find|tell me|search)\b/i.test(t)) return false;
  // An explicit prose ask (essay/report/letter… about) is generation, not code —
  // even in Code mode it rides penelope's prose weave, never the coding pipeline.
  if (/\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|analysis|review|memo|brief)\b/i.test(t)) return false;
  // EVERYTHING ELSE in Code mode is the machine's to decide. A keyword regex
  // can never route "make me a countdown clock" — the coding pipeline swarms
  // the ask and reads the units itself, disclosing a gap when it is not a
  // coding ask. (2026-10-04: the keyword gate fell through to the chat lane
  // and the coder refused in prose — the exact failure this replaces.)
  return true;
}

/** The fence language for a raw code-lane artifact: HTML-looking text renders
 *  as a previewable page, everything else as a JS code card. Deterministic,
 *  never the model's word. */
function fenceLangFor(text) {
  const t = String(text ?? "").trimStart();
  if (/^<!doctype html>/i.test(t) || /^<html[\s>]/i.test(t)) return "html";
  return "js";
}

// THE VOID — what the turn could NOT establish — lives in fold-chat-channels.js
// (voidReport returns it as DATA; voidText is its one-line text for the process
// panel only). It is drawn as its own gap block, never appended to the answer.
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
// STOPPING A TURN. A stop (button, Escape, or deleting the chat) aborts one
// AbortController; these let work that does not take a signal itself (the web
// search) yield at once and let its fetches carry the signal.
function abortError() { const e = new Error("stopped"); e.name = "AbortError"; return e; }
function raceAbort(p, signal) {
  if (!signal) return p;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const on = () => reject(abortError());
    signal.addEventListener("abort", on, { once: true });
    p.then((v) => { signal.removeEventListener("abort", on); resolve(v); }, (e) => { signal.removeEventListener("abort", on); reject(e); });
  });
}
function anyOf(a, b) {
  if (!a) return b;
  if (typeof AbortSignal !== "undefined" && AbortSignal.any) return AbortSignal.any([a, b]);
  const c = new AbortController();
  for (const x of [a, b]) { if (x.aborted) c.abort(); else x.addEventListener("abort", () => c.abort(), { once: true }); }
  return c.signal;
}
function withSignal(fetchImpl, signal) { return (u, o = {}) => fetchImpl(u, { ...o, signal: anyOf(o.signal, signal) }); }

// DELETED IDS (tombstones): a chat or project deleted here is remembered for 30
// days as id -> deletedAt, so a second tab holding a stale copy can never write
// it back. The sessions/projects maps are saved by MERGING with what is stored
// (life.mergeSessions): a chat only another tab has is kept, the later `updated`
// wins, a tombstoned id stays dead.
const DELETED_KEY = "fold-chat:deleted";
function loadTombs() { return life.pruneTombstones(load(DELETED_KEY, {}) || {}, Date.now()); }
function tombstone(ids) {
  const t = loadTombs(); const at = new Date().toISOString();
  for (const id of ids) t[id] = at;
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(t)); } catch (e) {}
}
function untombstone(id) {
  const t = loadTombs(); delete t[id];
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(t)); } catch (e) {}
}
function save(key, v) {
  try {
    if (key === "fold-chat:sessions" || key === "fold-chat:projects") v = life.mergeSessions(v, load(key, {}) || {}, loadTombs());
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {}
}

const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
// The × of a dialog sheet, with a name a screen reader can say.
function closeButton() {
  const b = el("button", "sheet-close"); b.type = "button";
  b.setAttribute("aria-label", "Close"); b.title = "Close";
  b.innerHTML = CLOSE_SVG;
  return b;
}
// A modal overlay + sheet, announced as a dialog named by its heading.
function modalSheet(sheetClass = "sheet") {
  const modal = el("div", "modal");
  const sheet = el("div", sheetClass);
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
  return { modal, sheet };
}
// Make a non-button row (chat, project, folder, section head) keyboard-operable.
function activatable(node, label) {
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  if (label) node.setAttribute("aria-label", label);
  node.addEventListener("keydown", (e) => {
    if (e.target !== node) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); node.click(); }
  });
  return node;
}

// Inline text dialog — replaces window.prompt. Resolves the trimmed value on
// OK (empty string allowed), or null on cancel / Escape / backdrop.
function askDialog({ title, value = "", placeholder = "", okLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
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
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
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

// Inline confirm — resolves true on the confirming button, false on cancel /
// Escape / backdrop. Cancel holds focus: a destructive confirm is never one
// stray Enter away.
function confirmDialog({ title, message = "", okLabel = "OK", danger = false } = {}) {
  return new Promise((resolve) => {
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
    head.append(close);
    const msg = el("p", "hint dialog-msg", message);
    const foot = el("div", "sheet-foot");
    const cancel = el("button", "btn", "Cancel"); cancel.type = "button";
    const ok = el("button", "btn " + (danger ? "danger" : "primary"), okLabel); ok.type = "button";
    foot.append(el("div", "grow"), cancel, ok);
    sheet.append(head, msg, foot);
    modal.append(sheet);
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); done(false); } };
    document.addEventListener("keydown", onKey);
    cancel.onclick = close.onclick = () => done(false);
    ok.onclick = () => done(true);
    modal.onclick = (e) => { if (e.target === modal) done(false); };
    document.body.append(modal);
    cancel.focus();
  });
}

// Anchored popup menu. items: [{ label, onClick, danger?, sep? }].
function menuAt(anchor, items) {
  document.querySelectorAll(".pop").forEach((p) => p.remove());
  const pop = el("div", "pop");
  pop.setAttribute("role", "menu");
  for (const it of items) {
    if (it.sep) { const sp = el("div", "sep"); sp.setAttribute("role", "separator"); pop.append(sp); continue; }
    const b = el("button", it.danger ? "danger" : "", it.label);
    b.type = "button"; b.setAttribute("role", "menuitem");
    b.onclick = () => { pop.remove(); it.onClick?.(); };
    pop.append(b);
  }
  // Keyboard: arrows move, Escape closes and hands focus back to the opener.
  pop.addEventListener("keydown", (e) => {
    const btns = [...pop.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    // Escape closes ONLY this menu (not the nav drawer or the evidence drawer
    // beneath it) and hands focus back to the button that opened it.
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pop.remove(); anchor.focus?.(); }
    else if (e.key === "Tab") pop.remove();
  });
  document.body.append(pop);
  pop.querySelector("button")?.focus();
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
  // NO_HEIMDALL (user, 2026-10-07): there is no bridge — the fold answers from
  // the model IN THIS TAB. Declared HERE, before its first use at the bridge
  // line just below: a `const` read before its declaration is a TDZ
  // ReferenceError that crashes mount() and the whole app (found live: nothing
  // could submit, in any mode).
  const NO_HEIMDALL = true;
  // Where heimdall is. The stored override / opts.bridge is preferred (except an old stored standalone-bridge port, which never
  // shadows the embedded heimdall serving this very page); on boot the surface probes the same-origin /heimdall first, then the
  // legacy local port, so a fresh page finds a bridge the person never had to type in. A page with none still has its in-tab model.
  let bridge = NO_HEIMDALL ? null : client.pickBridge(opts.bridge || localStorage.getItem("fold-chat:bridge"));
  let bridgeHello = null;
  const sessions = load("fold-chat:sessions", {});
  // Sessions stored before the channels were split carry the system-authored
  // "⟂ void — …" paragraph baked into assistant `content`. Move it out, once,
  // and save back, so old chats render as gap blocks and stop polluting history.
  if (migrateSessions(sessions)) save("fold-chat:sessions", sessions);
  const projects = load("fold-chat:projects", {});
  let activeId = null;
  // TURNS IN FLIGHT, by chat id: { ac, stop, label, startedAt, wrap, stage }. A turn
  // belongs to ITS chat, not to whichever chat is open when it finishes: every UI
  // write a turn makes is guarded by `activeId === id`, the persisted session
  // record is always updated, and the composer's lock is derived from this map
  // (life.composerLocked) for the OPEN chat only.
  const inflight = new Map();
  let filterProject = null;
  let search = "";
  let models = [];
  // WHAT LEFT THIS MACHINE. One ledger for the page: every request to an outside
  // model (through heimdall's sealed gate) and every direct call to a public
  // service is recorded before it leaves, graded, and cross-checked against
  // heimdall's own ledger (heimdall/src/audit.js). The TAINT registry holds
  // private particulars learned from local reads; an outgoing request that
  // carries one is flagged. The "never sent raw material" line in the drawer is
  // computed from this, not asserted.
  const taint = createTaint();
  const outbound = createOutbound({ storage: localStorage, taint, auditUrl: null });
  // The local Python PII redactor (scripts/pii/server.py). "fold-chat:privacymode" = "open" is the person's opt-in to sending more of their
  // own material; either way personal identifiers are replaced by per-turn ids first, and an unreachable redactor means nothing is sent.
  const redactor = createRedactor({ base: (() => { try { return localStorage.getItem("fold-chat:piibase") || DEFAULT_REDACTOR; } catch { return DEFAULT_REDACTOR; } })() });
  const privacyMode = () => { try { return localStorage.getItem("fold-chat:privacymode") === "open" ? "open" : "default"; } catch { return "default"; } };
  // "Tip the creator" reads the creator's OWN contact page, only on a click: audited like any page read, through the tab's page memory.
  configureTip({ humans: true, readText: (u, o = {}) => web.readText(u, { memo: pageMemo, fetchImpl: outbound.auditedFetch("tip: the creator's own page"), direct: isExtension() || !!o.direct }) });   // o.direct: humans.txt is a guessed URL, read through the direct door only, never a proxy
  let currentRun = null;
  const newRun = (kind) => (currentRun = kind + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  // GARY'S DOOR: every model call this page makes (the turn, the restatement, a sealed code draw) is read by Gary before it is audited
  // or sent; one he refuses never leaves.
  client.setPromptDoor(garyDoor.guard);
  client.setAuditHook({
    before: (info) => {
      const m = models.find((x) => x.id === info.model);
      // A local model never leaves the machine; only an outside (sealed) one is an exit.
      if (client.isPageModel(info.model) || (m && !m.sealed && m.location !== "external")) return null;
      const h = outbound.sendModel({ auditId: info.auditId, model: info.model, host: m?.provider || null, messages: info.messages, segments: info.segments, worlds: info.worlds, symmetry: info.symmetry, gate: info.privacy === "sealed-external" || info.privacy === "explicit", purpose: info.purpose, run: info.run || currentRun, base: info.base || bridge, masking: info.masking || null });
      return (r) => h.done(r);
    },
  });
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
  // The conversation's DISCOURSE note (2026-10-11, temporary): what the system
  // believes the conversation is about, mechanically generated each turn and
  // disclosed at the top of the open thread. On by default while it is being
  // watched; the panel's own hide button and the Settings toggle turn it off
  // without removing the code. The disclosure is mechanical — the exchange
  // topic/flow and the warrant store, never a model's paraphrase.
  let discourseOn = (() => { try { return localStorage.getItem("fold-chat:discourse") !== "off"; } catch { return true; } })();
  function setDiscourseOn(on) {
    discourseOn = !!on;
    try { localStorage.setItem("fold-chat:discourse", discourseOn ? "on" : "off"); } catch (e) {}
    if (discourseOn) { const s = sessions[activeId]; if (s) renderDiscourse(s); }
    else if (discoursePanel && discoursePanel.isConnected) { discoursePanel.remove(); discoursePanel = null; }
  }
  // The composer's effort control: the DEFAULT for the next message, remembered
  // across reloads. It is read once, when a message is sent, and stamped on that
  // turn; moving it never touches a turn already sent. `effortMoved` is true
  // once the person has changed it since the last send, which is what lets an
  // edit / continue / run-as re-run keep the original turn's effort unless they
  // chose otherwise.
  let composerEffort = (() => { try { return web.normEffort(localStorage.getItem("fold-chat:effort")); } catch { return "balanced"; } })();
  let effortMoved = false;
  // The composer's ANSWER control (Facing page | Sources only), the same shape as effort: the DEFAULT for the
  // next message, remembered across reloads (`fold-chat:answerMode`), read once at send and stamped on the ask
  // as `answerMode`. A re-run keeps the original turn's mode unless the chip was moved since.
  let composerAnswer = (() => { try { return normAnswerMode(localStorage.getItem("fold-chat:answerMode")); } catch { return "facing"; } })();
  let answerMoved = false;

  const E = {
    railToggle: $("railToggle"), railSearch: $("railSearch"), railEvidence: $("railEvidence"), railSettings: $("railSettings"),
    side: $("side"), models: $("models"), projects: $("projects"), chats: $("chats"), projAdd: $("projAdd"), projNewProject: $("projNewProject"),
    composerMode: $("composerMode"), composerCwd: $("composerCwd"), composerTag: $("composerTag"),
    topNew: $("topNew"), topFocus: $("topFocus"), topMenu: $("topMenu"), scrim: $("scrim"), turnSlot: $("turnSlot"),
    welcome: $("welcome"), welcomeSub: $("welcomeSub"), thread: $("thread"), threadCol: $("threadCol"), stage: $("stage"), main: document.querySelector("main.main"),
    composerWrap: $("composerWrap"), composer: $("composer"), input: $("input"), send: $("send"), attach: $("attach"),
    footer: $("footer"), drawer: $("drawer"), toast: $("toast"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsCancel: $("settingsCancel"), settingsSave: $("settingsSave"),
    setPreset: $("setPreset"), setAgentLane: $("setAgentLane"), setAgentRounds: $("setAgentRounds"), setAgentEscalate: $("setAgentEscalate"), setTheme: $("setTheme"), setMode: $("setMode"), setTransparency: $("setTransparency"), setDiscourse: $("setDiscourse"),
    keyAnthropic: $("keyAnthropic"), keyOpenai: $("keyOpenai"), keyStatus: $("keyStatus"),
  };
  // FOLLOW THE TURN: while something below is growing (a download's progress, the feed, the streamed answer), the thread
  // stays pinned to its newest line — unless the person has scrolled up to read, in which case it leaves them there.
  { let pinned = true;
    E.thread.addEventListener("scroll", () => { pinned = E.thread.scrollHeight - E.thread.scrollTop - E.thread.clientHeight < 140; }, { passive: true });
    if (typeof ResizeObserver === "function") new ResizeObserver(() => { if (pinned) E.thread.scrollTop = E.thread.scrollHeight; }).observe(E.threadCol); }

  // Engagements — ONE thread, one project, two affordances. This is the
  // Claude / Claude-Code shape: the tabs are sibling modes over a SHARED
  // session, not one app embedded in a pane. `chat` answers from the routed
  // models (heimdall /v1); `code` dispatches the same turn through the SAME
  // bridge to the machine door (the khora conductor: read → derive → execute →
  // retain). The answer, its tool activity, and the project's folder all land
  // in the one thread. Nothing is a separate app with its own store.
  // HIDDEN FOR NOW (user, 2026-10-06): Folds and Agent mode. Flip to false to bring both back; nothing else changes (the code, the stored records and the
  // modules stay). While true the app is always in Chat, and no control that leads to Agent or Folds is drawn.
  const HIDE_AGENT = true;
  // HIDDEN FOR NOW (user, 2026-10-07): the external-calls monitor / evidence drawer and the lock / sealed-external indicators. UI only: the sealing, the
  // redactor and the outbound audit ledger still run underneath, so nothing changes about what can leave; flip to false to show them again.
  const HIDE_EXTERNAL = true;
  // NO HEIMDALL (user, 2026-10-07): there is no bridge. The fold answers from the model IN THIS TAB (WebLLM, fold-chat-webllm.js)
  // and never probes or routes a turn through a heimdall bridge. The bridge code stays in the modules (a page can still be run
  // against one deliberately), but this surface does not look for it, list its models, or call it.
  // NO_HEIMDALL is declared at the top of mount() — hoisted above its first use.
  document.documentElement.toggleAttribute("data-hide-external", HIDE_EXTERNAL);
  document.documentElement.toggleAttribute("data-hide-agent", HIDE_AGENT);
  let engagement = HIDE_AGENT ? "chat" : (localStorage.getItem("fold-chat:engagement") || localStorage.getItem("fold-chat:mode") || "chat");
  // The switch is the MODE row of the composer's "this turn" chip (see turnChip
  // below), not a control of its own in the top bar.
  function setEngagement(k) {
    if (HIDE_AGENT) k = "chat";
    engagement = k;
    try { localStorage.setItem("fold-chat:engagement", k); } catch (e) {}
    refreshComposer();
  }
  // The composer is the mode's face: the agent register (mono input, › prompt,
  // the bound folder as a chip, teal send) appears only while the machine door
  // is engaged. Chat keeps the plain prose composer. Effort is a chat affordance
  // — the door reads the folder, and effort only shapes a grounded turn — so the
  // turn chip drops it (and its menu hides that row) in agent.
  function refreshComposer() {
    const s = sessions[activeId];
    const isAgent = engagement === "code";
    const cwd = sessionCwd(s);
    E.composer.classList.toggle("agent", isAgent);
    E.input.placeholder = isAgent ? "Describe the change to make…" : "Message the fold";
    paintTurn();
    E.composerMode.textContent = isAgent ? "agent" : "";
    E.composerCwd.textContent = cwd ? "· " + cwd : "";
    E.composerCwd.title = cwd || "";
    // The OPEN chat's own turn locks the composer — never another chat's. While it
    // runs the send button becomes Stop (the textarea stays focusable but read-only,
    // so Escape in the composer can stop the turn).
    const locked = life.composerLocked(inflight, activeId);
    E.input.readOnly = locked;
    E.input.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) E.input.placeholder = "Working… press Esc or Stop to cancel";
    E.send.disabled = false;
    E.send.classList.toggle("stop", locked);
    E.send.title = locked ? "Stop (Esc)" : "Send";
    E.send.setAttribute("aria-label", locked ? "Stop" : "Send");
    const want = locked ? "stop" : "send";
    if (E.send.dataset.state !== want) { E.send.dataset.state = want; E.send.innerHTML = locked ? STOP_SVG : SEND_SVG; }
  }
  const SEND_SVG = E.send.innerHTML;
  const STOP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.6"/></svg>';
  // Stop the OPEN chat's running turn (the Stop button, and Escape in the composer).
  function stopOpenTurn() { const t = inflight.get(activeId); if (t) { t.stop(); return true; } return false; }

  function toast(msg) { E.toast.textContent = msg; E.toast.classList.add("show"); setTimeout(() => E.toast.classList.remove("show"), Math.min(9000, Math.max(1600, String(msg).length * 55))); }
  // A toast with one action (Undo). It lives ~8 s, is announced politely, and the
  // action is a real button (the plain toast ignores the pointer). One at a time:
  // a new one commits the previous. Returns { dismiss }.
  let undoToastEl = null;
  function actionToast(msg, label, onAction, { ms = 8000, onExpire = null } = {}) {
    undoToastEl?.dismiss(true);
    const box = el("div", "toast show toast-action");
    box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    const btn = el("button", "toast-btn", label); btn.type = "button";
    box.append(el("span", "toast-msg", msg), btn);
    let timer = null, closed = false;
    const dismiss = (expired = false) => {
      if (closed) return; closed = true; clearTimeout(timer); box.remove();
      if (undoToastEl && undoToastEl.box === box) undoToastEl = null;
      if (expired) onExpire?.();
    };
    btn.onclick = () => { if (closed) return; closed = true; clearTimeout(timer); box.remove(); if (undoToastEl && undoToastEl.box === box) undoToastEl = null; onAction(); };
    timer = setTimeout(() => dismiss(true), ms);
    document.body.append(box);
    undoToastEl = { box, dismiss };
    return undoToastEl;
  }

  /* ---------------- models ---------------- */
  // `modelsUp`: did the bridge answer the last model listing? It decides what "no model" has to say (noModelWhy).
  let modelsUp = true;
  const NO_MODEL = Object.freeze({ id: "", sealed: false, kind: "none", tier: "local", none: true });
  // ── THE MODEL IN THIS TAB (fold-chat-webllm.js) ──
  // The page's own engine: WebGPU, a module Worker, weights cached by the browser. It needs no bridge, so its models are listed
  // (and can answer) when the bridge is down or never answered. Importing the engine downloads nothing; only an approved first
  // send does. The extension keeps the bridge (its pages cannot load the engine's CDN module), so it has no engine here.
  const pageEngine = isExtension() ? null : (opts.pageEngine || createPageEngine({ storage: localStorage, onProgress: (p) => pagePulse(p) }));
  let pageGpu = { available: false, reason: pageEngine ? "no-adapter" : "no-engine" };
  let pageLoading = null;        // { id, name, progress, text, phase } while a first load is in flight
  let pageSink = null;           // the turn in flight listens here (its live feed shows the load)
  const tabName = (id) => { const c = MODEL_CHOICES.find((x) => x.id === canonicalModelId(id)); return c ? c.label.split(" \u2014 ")[0] : String(id); };
  const tabTag = (id) => ollamaTagOf(canonicalModelId(id)) || String(id);
  function pageState() {
    const entries = pageEngine && pageEngine.isLoaded() ? [{ id: tabTag(pageEngine.loadedId()), ctx: client.PAGE_CONTEXT_TOKENS }] : [];
    return { available: pageGpu.available, reason: pageGpu.reason, entries, loading: pageLoading };
  }
  function pagePulse(p) {
    if (!p || p.phase === "ready") pageLoading = null;
    else {
      pageLoading = { ...(pageLoading || {}), progress: p.progress, text: p.text, phase: p.phase };
      if (!pageLoading.id) pageEngine?.status().then((st) => { if (pageLoading && !pageLoading.id && st.loading[0]) { pageLoading.id = st.loading[0]; pageLoading.name = tabName(st.loading[0]); paintLoadedNow(); } }).catch(() => {});
    }
    try { pageSink?.(p); } catch {}
    paintLoadedNow();
  }
  // A progress tick repaints the footer at once (no network); a settled state asks the poller for the full picture.
  function paintLoadedNow() {
    if (pageLoading) paintLoaded({ bridge: modelsUp ? "up" : "down", entries: [], servable: null, errors: [], page: pageState() });
    else loadedPoller?.refresh();
  }
  // The ONE question before a multi-GB download: a toast with a button, never silent. No answer in a minute is a "no".
  function askDownload({ id }) {
    const c = MODEL_CHOICES.find((x) => x.id === id);
    return new Promise((resolve) => {
      let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
      actionToast(`Download ${tabName(id)} (${c ? c.sizeLabel : "a large file"}) to run in this tab? It is saved in your browser; after that nothing leaves the tab.`, "Download", () => fin(true), { ms: 60000, onExpire: () => fin(false) });
    });
  }
  client.setPageEngine(pageEngine, { confirmDownload: askDownload });
  // Where a model runs, in the words a turn is labelled with. An in-tab model is "in this tab" — never "sealed-external".
  const placeLabel = (mm) => mm?.sealed ? "sealed-external" : client.isPageModel(mm) ? "in this tab" : "local";
  async function refreshModels({ pageOnly = false } = {}) {
    // pageOnly: the boot's first paint — the in-tab models are listed first. With NO_HEIMDALL the bridge is never probed at all,
    // so the tab's own models are the WHOLE list.
    const all = await client.listAllModels({ base: bridge, bridge: NO_HEIMDALL ? false : !pageOnly });
    if (pageOnly) {
      if (!all.page.available || models.length) return;
      models = all.models; pageGpu = all.page;
    } else { models = all.models; modelsUp = NO_HEIMDALL ? false : all.bridgeUp; pageGpu = all.page; }
    try { noteWindows(models.filter(client.isPageModel).map((m) => ({ id: m.id, ctx: m.contextWindow }))); } catch {}
    // Only when NOTHING can answer (no in-tab model, no bridge) does the page say so.
    if (!pageOnly && !all.bridgeUp && !all.page.available) toast(noModelWhy({ bridgeUp: all.bridgeUp, models, page: pageGpu }).text);
    renderModels();
    paintHint();
    loadedPoller?.refresh();
  }
  // "no model" always says WHY: the bridge is unreachable / serves nothing / serves only embedders / the selected one is gone.
  // The one-line hint under the composer: no model reachable and the chip is on Facing page → say Sources only still works.
  function paintHint() {
    const h = document.getElementById("turnHint"); if (!h) return;
    const why = noModelWhy({ bridgeUp: modelsUp, models, page: pageState() });
    const none = why.code === "bridge-down" || why.code === "no-models" || why.code === "no-chat-model" || why.code === "no-webgpu";
    // An in-tab model that is picked but not on this device: say what the first send will cost BEFORE it asks. Picking downloads nothing.
    const sel = selectedModel();
    const toFetch = !none && sel && client.isPageModel(sel) && !sel.loaded && !sel.cached && !pageLoading;
    const show = (none || toFetch) && composerAnswer === "facing" && engagement !== "code";
    h.hidden = !show;
    if (show) document.getElementById("turnHintText").textContent = toFetch
      ? `Download ${sel.sizeLabel} to start \u2014 the first message asks once, then ${sel.name} runs in this tab and nothing leaves it. Or switch the chip to Sources only (no model).`
      : `No model reachable (${why.text}) \u2014 switch the chip to Sources only to get cited passages anyway.`;
  }
  { const hb = document.getElementById("turnHintBtn"); if (hb) hb.onclick = () => setAnswerMode("snips"); }
  const noModelText = () => noModelWhy({ bridgeUp: modelsUp, models, selectedId: sessions[activeId]?.model || null, page: pageState() }).text || "no model is available";
  // THE FOOTER: which models are LOADED right now (the fleet via the bridge's /api/ps + this machine's Ollama), polled every
  // ~15 s only while the tab is visible and refreshed after each turn. It never blocks rendering: a failed read keeps the last words.
  const fLoaded = document.getElementById("fLoaded");
  function paintLoaded(st) {
    try { noteWindows((st?.entries || []).filter((e) => e.ctx).map((e) => ({ id: e.id, ctx: e.ctx }))); } catch {}   // Gary reads the window each model is loaded at
    if (!fLoaded) return;
    const d = describeLoaded(st);
    fLoaded.dataset.kind = d.kind; fLoaded.title = d.title;
    fLoaded.querySelector(".f-dot").textContent = d.dot; fLoaded.querySelector(".f-text").textContent = d.text;
  }
  let loadedPoller = null;
  function startLoadedPoller() {
    if (loadedPoller || !fLoaded) return;
    loadedPoller = createLoadedPoller({
      get: () => fetchLoaded({ base: NO_HEIMDALL ? null : client.bridgeBase(bridge), upstream: NO_HEIMDALL ? null : (bridgeHello?.upstream || null), page: pageState() }),
      onState: paintLoaded,
      isVisible: () => document.visibilityState !== "hidden",
      onVisibilityChange: (cb) => { document.addEventListener("visibilitychange", cb); return () => document.removeEventListener("visibilitychange", cb); },
    });
  }
  function selectedModel() { return models.find((m) => m.id === sessions[activeId]?.model) || client.autoPick(models); }
  function providerColor(p) { const s = String(p || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; if (h >= 250 && h <= 310) h = (h + 70) % 360; /* no purple */ return `hsl(${h} 60% 45%)`; }
  function renderModels() {
    E.models.innerHTML = "";
    if (!models.length) { E.models.append(el("div", "empty-hint", "no models \u2014 " + noModelText())); return; }
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
      activatable(head); head.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      E.models.append(head);
      if (isCollapsed) continue;
      for (const m of list) {
        const row = el("div", "model" + (m.id === cur ? " on" : ""));
        const dot = el("span", "pdot"); dot.style.background = providerColor(m.provider);
        row.append(dot, el("span", "name", client.isPageModel(m) ? m.name : m.id));
        if (m.sealed) row.append(el("span", "seal", "sealed"));
        else if (client.isPageModel(m)) {
          // The tab's own model: where it lives and what the first use costs. It never says "sealed" — nothing leaves the tab.
          const kt = el("span", "kindtag", "in this tab" + (m.loaded ? " \u00b7 loaded" : m.cached ? " \u00b7 downloaded" : " \u00b7 " + m.sizeLabel));
          kt.title = m.note || "runs in this browser tab (WebLLM)";
          row.append(kt);
        } else if (m.kind === "webllm" || m.kind === "fleet" || m.kind === "native") {
          // Where it is served from: a heimdall browser tab (WebLLM), a fleet worker, or a linked native host — not this machine's own Ollama.
          const kt = el("span", "kindtag", m.kind === "webllm" ? "browser tab" : m.kind === "native" ? "native host" : "fleet");
          kt.title = m.kind === "webllm" ? "served by a heimdall browser tab running WebLLM" : m.kind === "native" ? "served by a linked native host" : "served by a connected fleet worker";
          row.append(kt);
        }
        row.onclick = () => setModel(m.id);
        activatable(row); row.setAttribute("aria-pressed", m.id === cur ? "true" : "false");
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
    const sealed = !!s?.sealed;
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
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", existing ? "Project settings" : "New project"); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton(); head.append(close);
    const nameField = el("div", "field");
    const nameLabel = el("label", "", "Name"); nameLabel.htmlFor = "pjName"; nameField.append(nameLabel);
    const name = document.createElement("input"); name.id = "pjName";
    name.type = "text"; name.value = existing?.name || ""; name.placeholder = "Project name"; name.autocomplete = "off";
    nameField.append(name);
    const cwdField = el("div", "field");
    const cwdLabel = el("label", "", "Folder (working directory)"); cwdLabel.htmlFor = "pjCwd"; cwdField.append(cwdLabel);
    const cwd = document.createElement("input"); cwd.id = "pjCwd";
    cwd.type = "text"; cwd.value = existing?.cwd || ""; cwd.placeholder = "/Users/you/Documents/your-project"; cwd.autocomplete = "off"; cwd.spellcheck = false;
    cwdField.append(cwd, el("div", "hint", "Code turns read and edit this folder through the conductor. Leave blank for a chat-only project."));
    const presetField = el("div", "field");
    const presetLabel = el("label", "", "Preset"); presetLabel.htmlFor = "pjPreset"; presetField.append(presetLabel);

    return new Promise((resolve) => {
      const sel = document.createElement("select"); sel.id = "pjPreset";
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
      { label: "Settings…", onClick: async () => { const v = await newProjectDialog(p); if (v) { Object.assign(p, v, { updated: now() }); save("fold-chat:projects", projects); renderProjects(); } } },
      { sep: true },
      { label: "Delete…", danger: true, onClick: () => deleteProject(id) },
    ]);
  }
  // Deleting a project keeps its chats: they are ungrouped, and a folder they only
  // inherited from the project is cleared (one they were given themselves stays).
  async function deleteProject(id) {
    const p = projects[id]; if (!p) return;
    const n = Object.values(sessions).filter((s) => s.project === id).length;
    const ok = await confirmDialog({
      title: `Delete project \u201c${p.name}\u201d?`,
      message: n ? `Its ${n} chat${n === 1 ? "" : "s"} will be kept and ungrouped \u2014 nothing in them is deleted. A folder they only inherited from this project is cleared.` : "The project has no chats. Nothing else is affected.",
      okLabel: "Delete project", danger: true,
    });
    if (!ok || !projects[id]) return;
    life.detachProject(sessions, id, { projectCwd: p.cwd || null });
    tombstone([id]);
    delete projects[id];
    if (filterProject === id) filterProject = null;
    save("fold-chat:projects", projects); save("fold-chat:sessions", sessions);
    renderProjects(); renderChats(); refreshComposer();
    toast(n ? `project deleted \u00b7 ${n} chat${n === 1 ? "" : "s"} kept` : "project deleted");
  }
  function renderProjects() {
    E.projects.innerHTML = "";
    const all = el("div", "folder" + (filterProject === null ? " on" : ""));
    all.append(icon("layers"), el("span", "", "All chats"));
    all.onclick = () => { filterProject = null; renderProjects(); renderChats(); };
    activatable(all);
    // "All chats" is a filter: with no project to filter by it is only noise, and
    // ▶ (new session in the selected project) means nothing until one is selected.
    if (Object.keys(projects).length) E.projects.append(all);
    E.projAdd.hidden = !filterProject;
    for (const [id, p] of Object.entries(projects)) {
      const row = el("div", "project" + (filterProject === id ? " on" : ""));
      const ico = el("span", "pico", (p.name || "P").trim().slice(0, 1).toUpperCase());
      const meta = el("div", "pmeta");
      meta.append(el("div", "pname", p.name), el("div", "psub", projectSub(p)));
      const menu = el("button", "pmenu", "⋯"); menu.type = "button"; menu.setAttribute("aria-label", "Project actions"); menu.setAttribute("aria-haspopup", "menu");
      menu.onclick = (ev) => { ev.stopPropagation(); projectMenu(id, menu); };
      row.append(ico, meta, menu);
      row.onclick = () => { filterProject = id; renderProjects(); renderChats(); };
      activatable(row);
      E.projects.append(row);
    }
    paintSections();
  }
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
  // EVERY chat wears a Phosphor icon, from its first moment. An empty chat has
  // the neutral conversation mark; after each user turn the icon is re-picked
  // from the conversation so far (provisional, refined as the subject
  // develops) and then FROZEN (`iconFinal`) once the chat has run
  // TURNS_TO_NAME turns or been named. iconOf is deterministic, so a chat from
  // before this feature (no `s.icon`) gets one lazily, computed from its
  // messages the first time it is drawn, and is saved. A hand-renamed chat
  // keeps its title and still gets an icon. Returns true when it changed.
  function refreshIcon(s) {
    if (!s || s.iconFinal) return false;
    const msgs = s.messages || [];
    // (A chat named before icons were frozen carries a pick from an older
    // lexicon; it is re-picked ONCE here, then frozen like any other.)
    const next = topic.iconOf(msgs);
    const final = s.named || topic.userTurns(msgs) >= topic.TURNS_TO_NAME;
    const changed = s.icon !== next || (final && !s.iconFinal);
    s.icon = next;
    if (final) s.iconFinal = true;
    return changed;
  }
  // The open chat's mark and name in the topbar, so the icon is visible where
  // the person is looking. Hidden when no chat is open.
  function paintTopChat() {
    const box = $("topChat"); if (!box) return;
    const s = activeId ? sessions[activeId] : null;
    box.innerHTML = "";
    box.hidden = !s || !(s.messages || []).length;
    if (box.hidden) return;
    const ic = el("span", "tc-icon"); ic.setAttribute("aria-hidden", "true");
    ic.append(phosphor(s.icon || topic.FALLBACK_ICON, 18));
    box.append(ic, el("span", "tc-title", s.title || "New chat"));
    box.title = s.title || "New chat";
  }
  function maybeName(s) {
    if (!s) return;
    if (s.titleAuto === false || s.named) { if (refreshIcon(s)) save("fold-chat:sessions", sessions); return; }
    const msgs = s.messages || [];
    if (topic.userTurns(msgs) < topic.TURNS_TO_NAME) { if (refreshIcon(s)) save("fold-chat:sessions", sessions); return; }
    const { title, icon } = topic.topicOf(msgs);
    if (title) s.title = title;
    s.icon = icon;
    s.iconFinal = true;
    s.named = true;
    save("fold-chat:sessions", sessions);
  }
  function renderChats() {
    let iconDirty = false;
    for (const s of Object.values(sessions)) if (refreshIcon(s)) iconDirty = true;
    if (iconDirty) save("fold-chat:sessions", sessions);
    paintTopChat();
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
      // The chat's own Phosphor mark (regular weight, currentColor). Decorative:
      // the title beside it is the accessible name.
      const ic = el("span", "cicon glyph");
      ic.setAttribute("aria-hidden", "true");
      ic.append(phosphor(s.icon || topic.FALLBACK_ICON, 18));
      const t = el("span", "ct", s.title || "New chat");
      const menu = el("button", "menu", "⋯"); menu.type = "button"; menu.setAttribute("aria-label", "Chat actions"); menu.setAttribute("aria-haspopup", "menu");
      menu.onclick = (ev) => { ev.stopPropagation(); chatMenu(s.id, menu); };
      // A turn running in this chat shows a quiet spinner; a reply that landed
      // while another chat was open leaves a small dot, cleared when it is opened.
      // (Meaning is in the label too, never colour alone.)
      const state = inflight.has(s.id) ? "running" : (s.unseen && s.id !== activeId ? "new" : null);
      if (state) {
        const dot = el("span", "cstate " + state);
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", state === "running" ? "working" : "new reply");
        dot.title = state === "running" ? "working…" : "new reply";
        row.append(ic, t, dot, menu);
      } else row.append(ic, t, menu);
      row.onclick = () => open(s.id);
      activatable(row); if (s.id === activeId) row.setAttribute("aria-current", "true");
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
      { label: "Delete", danger: true, onClick: () => deleteChat(id) },
    ]);
  }
  // DELETE, with Undo. A running turn is aborted (the search, the model call, the
  // agent door — it must not keep costing tokens for a chat that is gone). The
  // chat's id is tombstoned so no other tab can write it back; the session
  // object is stashed for ~8 s and Undo puts it back (it keeps its `updated`, so
  // it re-sorts into the same place) and re-opens it if it was the open one.
  // What opens next comes from life.nextAfterDelete: the most recent NON-EMPTY
  // chat, ignoring the search filter (which is cleared if it would hide that
  // chat); only empty chats left means the welcome state, never an identical
  // blank "New chat".
  function deleteChat(id) {
    const s = sessions[id]; if (!s) return;
    const wasActive = activeId === id;
    inflight.get(id)?.ac.abort();
    tombstone([id]);
    delete sessions[id];
    const next = life.nextAfterDelete(sessions, { id, filterProject, search });
    const husks = life.pruneStaleEmpties(sessions, { keep: [next.id, wasActive ? null : activeId] });
    if (husks.length) tombstone(husks);
    save("fold-chat:sessions", sessions);
    if (wasActive) {
      if (next.clearSearch) search = "";
      if (next.id) open(next.id); else closeThread();
    } else renderChats();
    const label = (s.title || "chat").length > 36 ? (s.title || "chat").slice(0, 35) + "…" : (s.title || "chat");
    actionToast(`Deleted \u201c${label}\u201d`, "Undo", () => {
      sessions[id] = s; s.restoredAt = now();
      untombstone(id);
      save("fold-chat:sessions", sessions);
      if (wasActive && activeId === next.id) open(id); else renderChats();
    });
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
      life.moveToProjectId(s, nid, { project: projects[nid], oldProjectCwd: projects[s.project]?.cwd || null });
    } else {
      const to = v === "none" ? null : v;
      life.moveToProjectId(s, to, { project: to ? projects[to] : null, oldProjectCwd: projects[s.project]?.cwd || null });
    }
    save("fold-chat:sessions", sessions);
    renderProjects(); renderChats(); if (s.id === activeId) refreshComposer();
  }

  /* ---------------- open / render thread ---------------- */
  // The empty state is LibreChat's: the composer rides centered under the
  // welcome title. Once a thread exists, the composer docks above the footer.
  // THE DISCOURSE PANEL (2026-10-11, temporary): the conversation's running
  // discourse — exactly what fold.js's buildSummarySystemMessage /
  // buildRecordSystemMessage put in front of the model on the next turn — is
  // drawn at the top of the open thread, so the discourse-aware thread is
  // visible while it is still misbehaving. It renders what the prompt builders
  // actually emit, so the moment the discourse is fixed the panel shows the
  // fixed text. Remove this panel (and its hooks) once the thread holds.
  let discoursePanel = null;
  function discourseMarkup(s) {
    const sum = s?.summary;
    if (!sum || (!sum.topic && !(sum.records || []).length && !(sum.folds || []).length)) {
      const e0 = el("div", "discourse empty");
      e0.append(el("span", "discourse-title", "Conversation, as the fold reads it"), el("span", "discourse-empty-txt", "no discourse yet — the first answered exchange generates it mechanically"));
      return e0;
    }
    const wrap = el("div", "discourse");
    const bar = el("div", "discourse-bar");
    bar.append(el("span", "discourse-title", "Conversation, as the fold reads it"), el("span", "grow"));
    const hide = el("button", "discourse-hide", "hide");
    hide.type = "button";
    hide.title = "Stop showing the discourse note — Settings › Transparency turns it back on";
    hide.setAttribute("aria-label", "Hide the conversation discourse note");
    hide.onclick = () => { setDiscourseOn(false); actionToast("Conversation discourse hidden", "Undo", () => setDiscourseOn(true)); };
    bar.append(hide);
    wrap.append(bar);
    // The per-turn disclosure, mechanical: what the exchange says the
    // conversation is about now, and how the flow got here.
    const note = el("div", "discourse-topic");
    note.append(el("span", "discourse-label", "This turn the fold reads the thread as:"));
    note.append(el("strong", "discourse-now", sum.topic || "(no settled topic — ask the thread has not answered yet)"));
    if (sum.flow) note.append(el("div", "discourse-flow", sum.flow));
    wrap.append(note);
    const det = el("details"); det.open = false;
    det.append(el("summary", "What the next turn hears — PAST DISCOURSE · ON RECORD"));
    const past = FOLD.buildSummarySystemMessage(sum);
    if (past) { const pre = el("pre", "discourse-block"); pre.textContent = past; det.append(pre); }
    else det.append(el("div", "discourse-miss", "PAST DISCOURSE is withheld this turn (no topic, or a gated topic change out of it)."));
    const onRecord = FOLD.buildRecordSystemMessage(sum);
    if (onRecord) { const pre = el("pre", "discourse-block"); pre.textContent = onRecord; det.append(pre); }
    else det.append(el("div", "discourse-miss", "ON RECORD: no warrant records yet."));
    det.append(el("div", "discourse-store", `${(sum.folds || []).length} fold line(s) · ${(sum.records || []).length} warrant record(s) · turns beyond the last ${FOLD.RECENCY_WINDOW} ride only as this block, never resent verbatim`));
    wrap.append(det);
    return wrap;
  }
  function renderDiscourse(s) {
    if (!discourseOn) { if (discoursePanel && discoursePanel.isConnected) { discoursePanel.remove(); discoursePanel = null; } return; }
    const panel = discourseMarkup(s);
    if (discoursePanel && discoursePanel.isConnected) { discoursePanel.replaceWith(panel); discoursePanel = panel; return; }
    if (E.thread && E.thread.style.display !== "none") { E.threadCol.prepend(panel); discoursePanel = panel; }
  }
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
    setNav(false);
    const s = sessions[id];
    // A conversation that already found its subject (a chat from before this
    // feature, or one whose reply arrived while the tab was closed) is named
    // and given its icon the moment it is opened.
    maybeName(s);
    // Opening a chat is "seeing" it: a reply that landed while it was in the
    // background has been seen now.
    if (s?.unseen) { s.unseen = false; save("fold-chat:sessions", sessions); }
    E.threadCol.innerHTML = "";
    const msgs = s?.messages || [];
    setView(!msgs.length);
    for (let i = 0; i < msgs.length; i++) appendMsg(s, msgs[i].role, msgs[i].content, { sealed: msgs[i].sealed, index: i, grounding: msgs[i].grounding, notices: msgs[i].notices, void: msgs[i].void, model: s?.model, cwd: msgs[i].cwd, authored: msgs[i].authored, snips: msgs[i].snips, answerTurn: msgs[i].answerTurn, provenance: msgs[i].provenance });
    renderDiscourse(s);
    // A turn still running in this chat: hang its live row back on the thread
    // (the row is the run's own node, so what it streamed while we were away is
    // still in it) and re-point the stage line at it.
    const live = inflight.get(id);
    if (live?.wrap) { E.threadCol.append(live.wrap); E.stage.textContent = live.stage || ""; E.thread.scrollTop = E.thread.scrollHeight; }
    else E.stage.textContent = "";
    // Husks: never-used "New chat" rows (older than ten minutes, so another
    // tab's brand-new chat is not swept from under it) are pruned on open.
    const husks = life.pruneStaleEmpties(sessions, { keep: [id], minAgeMs: 10 * 60 * 1000 });
    if (husks.length) { tombstone(husks); save("fold-chat:sessions", sessions); }
    renderChats(); renderModels(); updateSeal(); refreshComposer();
  }
  // "New chat" never piles up empties: when the open chat is already empty IT is
  // the new chat (focus the composer); otherwise the most recent empty chat is
  // reused; only then is one made (life.newChatInto).
  function newChat() {
    const m = client.autoPick(models) || models[0] || null;
    const r = life.newChatInto(sessions, { activeId, filterProject, projects, newId: sid(), now: now(), model: m?.id || "", sealed: !!m?.sealed, preset });
    save("fold-chat:sessions", sessions);
    if (r.id === activeId) { setNav(false); renderProjects(); renderChats(); refreshComposer(); }
    else open(r.id);
    E.input.focus();
  }
  // No chat is open: the welcome state, with nothing selected. Reached when the
  // last chat is deleted, and on boot when no chats exist — the send path (and
  // every + button) opens a new one.
  function closeThread() {
    activeId = null;
    setNav(false);
    E.threadCol.innerHTML = "";
    E.stage.textContent = "";
    discoursePanel = null;
    setView(true);
    renderChats(); renderModels(); updateSeal(); refreshComposer();
  }
  function cloneSession(src, overrides) {
    // Forks and continues are the same conversation moved forward: they keep
    // the project, the folder, the learned facts, and the attachments — never
    // silently drop the link the way the old code did.
    return {
      id: overrides.id, title: overrides.title, messages: overrides.messages,
      titleAuto: src.titleAuto !== false, named: !!src.named, icon: src.icon ?? null, iconFinal: !!src.iconFinal,
      model: src.model, sealed: src.sealed, preset: src.preset, grounding: src.grounding !== false,
      project: src.project ?? null, cwd: src.cwd ?? null, cwdFromProject: src.cwdFromProject,
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
  function renderArtifact(body, art, s = null) {
    const card = el("div", "art");
    const bar = el("div", "art-bar");
    bar.append(el("span", "art-title", art.title || "artifact"), el("span", "art-kind", art.kind + (art.lang && art.lang !== art.kind ? " · " + art.lang : "")), el("span", "art-sp"));
    const copy = el("button", "art-btn", "copy");
    const fold = el("button", "art-btn", "collapse");
    // The controls travel as ONE group, so a narrow bar wraps them together (right-aligned) instead of stranding one.
    const acts = el("span", "art-acts");
    acts.append(fold, copy);
    bar.append(acts);
    // ITERATE ON THE ARTIFACT (LibreChat's "Ask", 2026-10-04): continue the
    // code lane on this artifact — the next Code turn carries the prior
    // artifact (the bridge's per-session record) and CHANGES it, never builds
    // fresh. Shown only when this thread has already coded.
    if (s?.codeSessionId) {
      const iterate = el("button", "art-btn primary", "iterate");
      iterate.title = "Continue on this artifact — the next Code turn modifies it";
      iterate.onclick = () => {
        setEngagement("code");
        s.iterate = true; save("fold-chat:sessions", sessions);
        E.input.placeholder = "change the artifact… (it will modify the last agent artifact)";
        E.input.focus();
      };
      acts.append(iterate);
    }
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
  // THE PROCESS DISCLOSURE — what the fold DID this turn: the pipeline it ran
  // (classify → search → read → write → check), the web reads, and the route.
  // It carries NO grounding counts and NO addresses — those live in the facing
  // page, which is always present on the message. A JSON copy gives a machine
  // the whole record of the process.
  // The turn's process as JSON — for an agent, a log, or a bug report (the "copy </>" action under an answer).
  function processJsonOf(rec, meta) {
    return JSON.stringify({
      turn: rec?.turn,
      kind: rec?.kind ?? null,
      effort: rec?.effort ?? null,
      process: Array.isArray(rec?.process) ? rec.process : [],
      model: meta?.model ?? null,
      sealed: !!meta?.sealed,
      carried: !!rec?.hasMaterial,
      web: rec?.web ?? null,
    }, null, 2);
  }

  // THE FACING PAGE — the answer, and under it ONE quiet line about what stands
  // behind it. The RESPONSE is the model's markdown, nothing added to it. The
  // SOURCES line reads "3 passages from 1 source · ✱ 3 of 6 sentences have no
  // source": one control, collapsed. Opening it (it takes the right-hand page of
  // the spread on a wide screen, and sits under the answer on a narrow one) lists
  // the DOCUMENTS read, each with the passages it supplied (S1, S2 …); a passage
  // opens to the verbatim excerpt with the cited span marked. The gap's detail
  // (what was tried, what would close it) rides inside the same panel.
  // The ambiguity line (record.senses): one app-authored line, small, dismissible (its dismissal is kept on the record).
  function sensesEl(rec) {
    if (!rec?.senses?.line || rec.senses.dismissed) return null;
    const sn = el("div", "senses");
    sn.setAttribute("role", "note");
    sn.append(el("span", "senses-t", rec.senses.line));
    const x = el("button", "senses-x", "\u00d7");
    x.type = "button"; x.title = "Dismiss"; x.setAttribute("aria-label", "Dismiss this note");
    x.onclick = (e) => { e.stopPropagation(); sn.remove(); rec.senses.dismissed = true; try { save("fold-chat:sessions", sessions); } catch {} };
    sn.append(x);
    return sn;
  }
  const pluralize = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  function renderFacingPage(body, rec, content, meta) {
    const face = rec?.facing || { sources: [], response: [] };
    const spread = el("div", "facing");
    const gap = meta?.gap || null;   // the typed gap (record.void), drawn in its own block
    // HOW THE TURN WENT picks the drawing (fold-chat-present.js): one source, several that agree, sources that
    // disagree, or part fact / part invention. A gap or a turn with no passages keeps the spread below.
    if (String(content || "").trim() && !(gap && gapAnswerLine(gap))) {
      const sess = meta?.sessionId ? sessions[meta.sessionId] : null;
      const question = sess && meta.index != null ? String(askBefore(sess, meta.index) || "") : "";
      const pres = presentationOf(rec, { question });
      if (pres && pres.layout === "unsupported") pres.onSourcesOnly = () => { setAnswerMode("snips"); meta?.retry?.(); };
      if (pres) { renderPresented(body, { rec, content, pres, mdHtml, question, senses: sensesEl(rec), model: [meta?.model, meta?.sealed ? "sealed-external" : client.isPageModel(meta?.model) ? "in this tab" : null].filter(Boolean).join(" \u00b7 ") || null }); return; }
      if (Array.isArray(rec?.tape) && rec.tape.length) renderTapeStrip(body, rec, question);
    }

    // --- RESPONSE page ------------------------------------------------------
    // The answer renders as FULL MARKDOWN (lists, bold, headings survive), so a
    // written answer reads as written. Provenance is the SOURCES line below.
    const respPage = el("div", "face-page face-response");
    const md = el("div", "ganswer md");
    md.innerHTML = mdHtml(content);
    // AMBIGUITY: one bare word that names several things — a single app-authored line above the
    // answer (Wikipedia's own distinct titles, never model prose); small, and dismissible.
    { const sn = sensesEl(rec); if (sn) respPage.append(sn); }
    if (String(content || "").trim()) respPage.append(md);
    else if (gap && gapAnswerLine(gap)) { respPage.append(el("div", "face-empty", gapAnswerLine(gap))); respPage.append(renderGap(gap, { retry: meta?.retry })); }
    else if (rec?.computed) {
      // the mechanical result card: the fold's own arithmetic, no model wording
      const card = el("div", "calc");
      card.setAttribute("role", "note");
      card.append(el("span", "calc-k", "computed by the fold \u2014 not written by a model"), el("span", "calc-expr", rec.computed.expr), el("span", "calc-val", "= " + rec.computed.value));
      respPage.append(card);
    }
    else if (meta?.appAuthored) { /* the app's own note below IS the turn: no model was asked */ }
    else if (meta?.noticed) respPage.append(el("div", "face-empty", "the model wrote no answer text \u2014 see the note below"));
    else respPage.append(el("div", "face-empty", "nothing was written for this turn"));
    // The sources the model pointed at with its own [W#] labels, drawn as real citation chips
    // (the label itself was removed from its text).
    if (Array.isArray(rec?.cited) && rec.cited.length && String(content || "").trim()) {
      const row = el("div", "cites");
      row.append(el("span", "cites-k", "cited"));
      for (const c of rec.cited) {
        const chipText = (c.pointer ? "pointer \u00b7 " : "") + (c.title || c.domain || c.n);
        const chip = c.url && /^https?:\/\//i.test(c.url) ? Object.assign(el("a", "cite-chip", chipText), { href: c.url, target: "_blank", rel: "noopener" }) : el("span", "cite-chip", chipText);
        if (c.domain) chip.title = c.domain;
        // a chip whose source is shown as a page of a snip pager brings that page up (a modified click still opens the source)
        if (c.url) chip.addEventListener("click", (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return; if (jumpToSnip(chip.closest(".msg") || document, c.url)) ev.preventDefault(); });
        row.append(chip);
      }
      respPage.append(row);
    }

    // --- SOURCES page: one line, collapsed -----------------------------------
    const srcPage = el("div", "face-page face-sources");
    // Only sentences the MODEL wrote are scored, and only when the turn has
    // claims: a creative turn (a poem, a story) is never marked unsourced.
    const total = (face.response || []).length;
    const unverified = (rec?.creative || rec?.noClaims) ? 0 : (face.response || []).filter((r) => !r.grounded).length;
    const gapText = gap ? (gap.kind === "legacy" ? "gap" : voidLabel(gap)) : (unverified ? `${unverified} of ${total} sentence${total === 1 ? "" : "s"} ${unverified === 1 ? "has" : "have"} no source` : "");
    const docs = ground.sourceDocs(face.sources);
    if (face.sources.length || gapText) {
      const line = el("button", "srcline");
      line.type = "button";
      line.setAttribute("aria-expanded", "false");
      line.append(el("span", "sl-caret", "▸"));
      if (face.sources.length) line.append(el("span", "sl-main", `${pluralize(face.sources.length, "passage")} from ${pluralize(docs.length, "source")}`));
      if (gapText) line.append(el("span", "sl-gap", "✱ " + gapText));
      const panel = el("div", "srcpanel");
      if (docs.length) {
        const list = el("div", "srclist");
        docs.forEach((d, di) => {
          const doc = el("div", "srcdoc");
          const dh = el("div", "srcdoc-h");
          dh.append(el("span", "src-title", d.title));
          const pointerDoc = isTertiary(d.url);   // an encyclopedia page: a pointer the turn read, never shown as the source
          if (d.domain) dh.append(el("span", "src-dom", pointerDoc ? "a pointer \u2014 not cited" : d.domain));
          if (d.url && !pointerDoc) { const a = el("a", "src-open", "open ↗"); a.href = d.url; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Open " + d.title + " in a new tab"); dh.append(a); }
          if (d.url && !/(^|\.)wikipedia\.org$/i.test(d.domain || "")) dh.append(tipControl({ url: d.url, title: String(d.title || "").split(" \u2014 ").slice(1).join(" \u2014 ") || d.title, site: d.domain }, { toast, quiet: true }));
          doc.append(dh);
          d.passages.forEach((p, pi) => doc.append(passageRow(p, di === 0 && pi === 0)));
          list.append(doc);
        });
        panel.append(list);
      }
      if (gap) panel.append(renderGap(gap, { head: false, retry: meta?.retry }));
      line.onclick = () => {
        const open = srcPage.classList.toggle("open");
        spread.classList.toggle("open", open);
        line.setAttribute("aria-expanded", open ? "true" : "false");
      };
      srcPage.append(line, panel);
    } else if (rec?.creative || rec?.noClaims || rec?.hasMaterial || !(face.sources || []).length) {
      srcPage.append(el("div", "face-empty",
        rec?.computed ? `computed by the fold's evaluator: ${rec.computed.text}`
        : rec?.noClaims ? rec.noClaims
        : rec?.creative ? "creative — no claims checked"
        : rec?.hasMaterial ? "no sentence here is addressed to the material"
                           : "nothing carried — the answer stands on the model alone"));
    }

    // RESPONSE on the left, SOURCES on the right once opened (the answer leads).
    // a turn whose whole content is the typed gap draws it open, under the answer line — no collapsed sources line
    const gapIsTurn = !!(gap && gapAnswerLine(gap) && !String(content || "").trim());
    if (gapIsTurn) spread.append(respPage); else spread.append(respPage, srcPage);
    // the wrapper is the size container the spread's column query reads
    const wrap = el("div", "facing-wrap");
    wrap.append(spread);
    body.append(wrap);
  }

  // THE SOURCE LINE (fold-chat-provenance.js): the app's words and the source's own words, drawn under the answer ALWAYS. Quotes are the page's verbatim sentences, linked to the page.
  function renderProvenance(body, prov) {
    if (!prov || !Array.isArray(prov.parts) || !prov.parts.length) return;
    if (body.querySelector(".pv-sen")) return;   // the sentences carry their own evidence on hover (fold-chat-presentview.js); no narration under them
    const box = el("div", "prov");
    box.setAttribute("role", "note");
    for (const part of prov.parts) {
      if (part.kind === "quote") {
        const q = el("q", "prov-q", part.text.replace(/^\u201c|\u201d$/g, ""));
        const ptr = (prov.pointers || []).find((p) => p.start === part.start && p.index === part.index);
        box.append(" ", q);
        if (ptr && ptr.url && /^https?:\/\//i.test(ptr.url)) { const a = el("a", "prov-open", "open \u2197"); a.href = ptr.url; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Open " + (ptr.host || "the source") + " in a new tab"); box.append(" ", a); }
      } else box.append(box.childNodes.length ? " " : "", el("span", "prov-app", part.text));
    }
    if (prov.verified === 0) box.classList.add("prov-none");
    // under a disclosure: the page already shows the source and its excerpt, so the narration is one quiet line until asked for
    const hosts = [...new Set((prov.pointers || []).filter((p) => p && p.ok && p.host).map((p) => String(p.host).replace(/^www\./, "")))].slice(0, 2);
    const d = el("details", "prov-d" + (prov.verified === 0 ? " none" : ""));
    d.append(el("summary", "", prov.verified === 0 ? "No sentence found that says this" : "Where this came from" + (hosts.length ? " \u00b7 " + hosts.join(", ") : "")), box);
    body.append(d);
  }

  // One PASSAGE of a source document: its tag (S1) and a one-line lead, opening to
  // the verbatim excerpt with the cited span marked. Only an opened passage shows
  // its quote.
  function passageRow(src, open = false) {
    const card = el("div", "src" + (src.domain ? " web" : " local") + (open ? " open" : ""));
    const head = el("button", "src-head");
    head.type = "button";
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.title = (src.label || src.n) + (src.cite > 1 ? ` · cited ${src.cite}×` : "");
    head.append(el("span", "src-n", src.n), el("span", "src-snip", src.mark || src.text || ""));
    const ex = el("div", "src-ex");
    if (src.ellipsisBefore) ex.append(el("span", "src-el", "… "));
    if (src.before) ex.append(document.createTextNode(src.before + " "));
    ex.append(el("mark", "src-quote", src.mark || src.text));
    if (src.after) ex.append(document.createTextNode(" " + src.after));
    if (src.ellipsisAfter) ex.append(el("span", "src-el", " …"));
    head.onclick = () => { const o = card.classList.toggle("open"); head.setAttribute("aria-expanded", o ? "true" : "false"); };
    card.append(head, ex);
    return card;
  }

  // THE GAP BLOCK — what the turn could not establish, drawn as a TYPED MARK in
  // its own bordered block (Constitution III.3), labelled with which silence it
  // is, listing what was read but did not establish it and what would close it.
  // It is data from `record.void`, rendered by the surface: never a sentence the
  // assistant said, never part of `content`, never scored, never sent back.
  function renderGap(v, { head = true, retry = null } = {}) {
    const box = el("div", "gap gap-" + v.kind);
    box.setAttribute("role", "note");
    if (head) {
      const h = el("div", "gap-h");
      h.append(el("span", "gap-mark", "⟂"), el("span", "gap-kind", v.kind === "legacy" ? "gap" : voidLabel(v)));
      box.append(h);
    }
    if (v.kind === "legacy") { box.append(el("div", "gap-text", v.text || "")); return box; }
    // What was actually searched, authored by the app from the search trace (fold-chat-gaps.js) — never narrated by the model.
    if (v.note) box.append(el("div", "gap-text gap-note", v.note));
    else if (v.kind === "unreached" && (v.tried || []).length) box.append(el("div", "gap-text", "tried: " + v.tried.join(", ")));
    if ((v.kind === "unreached" || v.kind === "live" || v.kind === "model") && (v.attempts || []).length) {
      const ul = el("ul", "gap-list gap-attempts");
      for (const a of v.attempts) ul.append(el("li", a.ok ? "" : "gap-failed", `${a.name}${a.engine && a.engine !== a.name ? " (" + a.engine + ")" : ""} \u2014 ${a.ok ? (a.n ?? 0) + " result" + (a.n === 1 ? "" : "s") : "failed: " + a.why}`));
      box.append(ul);
    }
    if ((v.kind === "unsupported" || v.kind === "live") && (v.read || []).length) {
      box.append(el("div", "gap-sub", "read, but did not establish it"));
      const ul = el("ul", "gap-list");
      for (const r of v.read) {
        const li = el("li");
        if (r.url && /^https?:\/\//i.test(r.url)) { const a = el("a", "", r.title || r.url); a.href = r.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); }
        else li.append(el("span", "", r.title || "source"));
        if (r.domain) li.append(el("span", "gap-dom", " · " + r.domain));
        ul.append(li);
      }
      box.append(ul);
    }
    if (v.kind === "generate") {
      // what a written output is missing, what the turn did have, and the pages it set aside (about writing it, not about the topic) — all data from record.void
      if ((v.missing || []).length) box.append(el("div", "gap-text", "missing: " + v.missing.join("; ")));
      if ((v.attempts || []).length) { const ul = el("ul", "gap-list gap-attempts"); for (const a of v.attempts) ul.append(el("li", a.ok ? "" : "gap-failed", `${a.name}${a.engine && a.engine !== a.name ? " (" + a.engine + ")" : ""} \u2014 ${a.ok ? (a.n ?? 0) + " result" + (a.n === 1 ? "" : "s") : "failed: " + a.why}`)); box.append(ul); }
      if ((v.had || []).length) { box.append(el("div", "gap-sub", "what the turn had")); const ul = el("ul", "gap-list"); for (const h of v.had) ul.append(el("li", "", h.kind === "page" ? `${h.title}${h.domain ? " \u00b7 " + h.domain : ""} \u2014 ${h.note || "usable"}` : h.note || "")); box.append(ul); }
      if ((v.setAside || []).length) { box.append(el("div", "gap-sub", "set aside \u2014 not material for it")); const ul = el("ul", "gap-list"); for (const x of v.setAside) { const li = el("li"); if (x.url && /^https?:\/\//i.test(x.url)) { const a = el("a", "", x.title || x.url); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); } else li.append(el("span", "", x.title || "page")); li.append(el("span", "gap-dom", " \u00b7 " + (x.domain ? x.domain + " \u00b7 " : "") + String(x.why).replace(/^meta-/, "about writing: ").replace(/-/g, " "))); ul.append(li); } box.append(ul); }
      if (v.offer) { const b = el("button", "note-retry", v.offer.label); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); setAnswerMode("snips"); retry?.(); }; box.append(b); }   // the person CHOOSES the sources-only turn; it is never drawn in place of the piece
    }
    if ((v.closeBy || []).length) box.append(el("div", "gap-text gap-close", "to close it: " + v.closeBy.join(" \u00b7 ")));
    if (retry && (v.kind === "unreached" || v.kind === "live" || (v.kind === "generate" && v.retry !== false))) { const b = el("button", "note-retry", "try again"); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); retry(); }; box.append(b); }
    return box;
  }
  // System notes about a turn (an identity claim the fold withdrew, a model
  // refusal it replaced, an agent that produced no code): each its OWN element,
  // labelled as the fold's — never part of what the model wrote.
  const NOTICE_LABEL = { "language-gap": "not checkable", identity: "withdrawn claim", refusal: "model declined", agent: "agent", fold: "fold note", stopped: "stopped", error: "turn failed", declined: "model declined", thread: "from this chat", carry: "read as", empty: "no answer", attribution: "attribution removed", language: "language", computed: "computed" };
  // A note whose turn wrote nothing (a failure, an empty stream, a stop) carries a retry: `onRetry` re-runs the ask.
  function renderNotices(body, notices, onRetry = null, onRefuse = null) {
    for (const n of notices || []) {
      if (!n || !n.text) continue;
      const d = el("div", "fold-note" + (n.kind ? " kind-" + String(n.kind).replace(/[^a-z-]/gi, "") : ""));
      d.setAttribute("role", "note");
      d.append(el("span", "fold-note-k", NOTICE_LABEL[n.kind] || "fold note"), el("span", "fold-note-t", String(n.text).replace(/^⟂ fold:\s*/, "")));
      if (onRetry && (n.retry || n.kind === "stopped")) { const b = el("button", "note-retry", "try again"); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); onRetry(); }; d.append(b); }
      if (onRefuse && n.kind === "carry") for (const surf of n.carried || []) { const b = el("button", "note-retry", `not ${surf}`); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); onRefuse(surf, n.turn); b.disabled = true; b.textContent = `won't carry ${surf}`; }; d.append(b); }
      body.append(d);
    }
  }

  // A message is built for ITS session (`s`), passed in — never read off whichever
  // chat happens to be open — and returned unattached; appendMsg puts it on the
  // open thread. A turn finishing in a background chat builds the same way and
  // simply never attaches (see run()).
  function buildMsg(s, role, content, meta = {}) {
    const wrap = el("div", "msg " + role);
    let seam = null;
    // Which engine this turn belongs to: stored on new messages, derived for
    // legacy ones (an assistant turn carrying a code record is agent work).
    const mode = meta.mode || (meta.index != null ? modeOf(s, meta.index) : "chat");
    // THE SEAM — a labelled rule where the register changes inside the shared
    // thread, so a handoff between chat and agent is visible, never silent.
    if (meta.index != null && meta.index > 0 && modeOf(s, meta.index - 1) !== mode) {
      const se = el("div", "seam");
      const sp = el("span", "", `${modeOf(s, meta.index - 1)} → `);
      sp.append(el("b", "", mode));
      se.append(sp);
      seam = se;
    }
    wrap.classList.toggle("agent", mode === "agent");
    const av = el("div", "av");
    const sIcon = role === "assistant" ? s?.icon : null;
    if (role === "user") av.textContent = "You";
    else if (sIcon && PHOSPHOR[sIcon]) { av.classList.add("topic"); av.append(phosphor(sIcon, 17)); av.title = sIcon; }
    else av.textContent = "F";
    const body = el("div", "body");
    if (meta.sealed) body.classList.add("sealed-body");
    if (mode === "agent") body.append(el("span", "mtag", "agent"));
    if (role === "assistant") {
      if (meta.cwd) body.append(el("span", "chip folderchip", "📁 " + meta.cwd));
      const showDisclosure = transparency && s?.grounding !== false;
      const showFace = !!meta.grounding?.facing;
      // The channels of this message, each drawn on its own: the gap (record.void,
      // or the message-level void of a turn that carried no record) and the notes.
      const ownRec = meta.grounding && !meta.grounding.generate && !meta.grounding.code ? meta.grounding : null;
      const gapV = normVoid(ownRec?.void, ownRec) || normVoid(meta.void);
      const noticeList = Array.isArray(meta.notices) ? meta.notices : [];
      // An agent turn's WORK comes first — the steps it took, replayed from the
      // stored trace — and the artifact it landed on follows.
      const traced = Array.isArray(meta.grounding?.events) && meta.grounding.events.length;
      // The Fold viewer (Live · Actions · EOT · Folded) replaces the bare preview card for a run that kept one, and comes FIRST:
      // the result is the headline, the step-by-step transcript is tucked under it, shut.
      const foldSnap = meta.grounding?.fold ? foldRevive(meta.grounding.fold) : null;
      const hasFold = !!(foldSnap && (foldSnap.versions.length || foldSnap.log.length));
      if (hasFold) {
        const rs = s?.resumeFrom && s.resumeFrom.foldId === foldSnap.id ? { index: s.resumeFrom.index, round: s.resumeFrom.round } : null;
        mountFold(body, foldSnap, { renderArtifact: quietArtifact, tryCall: (code, expr) => callMany(code, [expr]).then((r) => r[0]), onReset: (r) => setResume(s, r), reset: rs });
      }
      if (traced) replayFeed(hasFold ? tuckSteps(body, { open: false }).inner : body, meta.grounding.events, { onAuditOpen: (id) => openAudit(id) });
      // A SOURCES-ONLY turn (authored by the sources) draws as one reading column of their own passages instead.
      const strandMode = meta.authored === "sources" && Array.isArray(meta.snips) && meta.snips.length > 0;
      // A SLOT ANSWER (message.answerTurn): one answer line, its source sentence and citation, what was checked, and the app's own "how I reasoned"
      // — drawn by the answer card INSTEAD of the passage wall or prose (the card carries the answer line; drawing `content` too would say it twice).
      const slotCard = meta.authored === "sources" && meta.answerTurn && typeof meta.answerTurn === "object" ? meta.answerTurn : null;
      for (const b of strandMode || slotCard ? [] : artifactsOf(content)) {
        if (b.kind === "prose") { if (!showFace) prose(body, b.text); }
        else if (!(foldSnap && foldSnap.versions.length)) renderArtifact(body, b.artifact, s);
      }
      // The machine door's tool ledger — part of the message, so the steps the
      // agent ran survive a re-render, never only the live turn that made them.
      const acts = meta.grounding?.code && !traced ? meta.grounding.activity : null;
      if (Array.isArray(acts) && acts.length) {
        const list = el("div", "activity");
        for (const a of acts) list.append(el("div", "actrow", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? "  [" + a.status + "]" : ""}`));
        body.append(list);
      }
      // A turn that wrote nothing (a failure, an empty stream, a gap with no answer) gets a visible retry.
      const askForRetry = meta.index != null ? askBefore(s, meta.index) : null;
      const retryFn = askForRetry ? () => rerunAs(s.id, askForRetry, mode === "agent" ? "agent" : "chat", effortFor(s, meta.index)) : null;
      // A turn that FELL BACK to the strand (the model declined or failed) says so ABOVE the passages it drew instead.
      const declined = strandMode ? noticeList.filter((n) => n && n.fellBackFrom && (n.kind === "declined" || n.kind === "fold")) : [];
      if (declined.length) renderNotices(body, declined, retryFn);
      if (strandMode) { const sn = sensesEl(meta.grounding); if (sn) body.append(sn); renderStrand(body, meta.snips, { toast }); }
      else if (slotCard) mountAnswerCard(body, { answerTurn: slotCard });
      else if (showFace) renderFacingPage(body, meta.grounding, content, { ...meta, gap: gapV, noticed: noticeList.length > 0, appAuthored: noticeList.some((n) => n && (n.kind === "alone" || n.kind === "no-sources")), retry: retryFn, sessionId: s?.id });
      else if (gapV) body.append(renderGap(gapV, { retry: retryFn }));
      // Recipes the sources declared, shown in the creators' own words (never retyped by the model), credited.
      renderSnips(body, meta.grounding?.snips, { toast });
      renderNotices(body, declined.length ? noticeList.filter((n) => !declined.includes(n)) : noticeList, retryFn, s ? (surf, turn) => { s.minds = addOp(s.minds, correctionOp("carry-rejected", surf, turn)); s.updated = now(); save("fold-chat:sessions", sessions); } : null);
      // the one "how this was answered" line sits right under the answer; the
      // (hover-only) actions come last
      renderProvenance(body, meta.provenance);
      if (showDisclosure && meta.grounding && meta.grounding.code) renderCodeDisclosure(body, meta.grounding, meta);
      else if (showDisclosure && meta.grounding && meta.grounding.generate) renderGenerateDisclosure(body, meta.grounding, meta);
      if (meta.index != null) {
        // Quiet until hovered or focused (and on touch for the last / tapped message):
        // copy, retry, and a ⋯ menu holding the rest.
        const acts = el("div", "actions");
        const ask = askBefore(s, meta.index);
        acts.append(copyBtn(() => content));
        if (meta.grounding) acts.append(copyJsonBtn(() => processJsonOf(meta.grounding, meta)));
        if (ask) acts.append(actBtn("retry", "Run this ask again, as a new turn", () => rerunAs(s.id, ask, mode === "agent" ? "agent" : "chat", effortFor(s, meta.index))));
        // CONVERT: a chat answer can be built (→ agent), an agent artifact can be
        // explained (→ chat) — the same ask re-run through the other engine. An
        // explain re-runs the grounded lane, so it keeps the effort the turn had.
        const more = [
          { label: "Continue in a new chat", onClick: () => continueFrom(s.id, meta.index) },
          { label: "Fork the chat from here", onClick: () => forkAt(s.id, meta.index) },
        ];
        if (HIDE_AGENT) { /* no conversion to Agent while it is hidden */ }
        else if (mode === "chat" && ask) more.push({ label: "Build this (run through the Agent)", onClick: () => rerunAs(s.id, ask, "agent", effortFor(s, meta.index)) });
        else if (mode === "agent" && ask) more.push({ label: "Explain this (grounded chat answer)", onClick: () => rerunAs(s.id, ask, "chat", effortFor(s, meta.index)) });
        acts.append(moreBtn(more));
        body.append(acts);
      }
    } else {
      // the person's words sit in their own bubble, right-aligned (the actions stay outside it)
      if (content) { const bub = el("div", "ubub"); bub.textContent = content; body.append(bub); }
      if (meta.index != null) {
        const acts = el("div", "actions");
        const other = mode === "agent" ? "chat" : "agent";
        acts.append(
          copyBtn(() => content),
          actBtn("edit", "Edit this message and re-run from it", () => editMessage(s.id, meta.index)),
          moreBtn([
            { label: "Fork the chat from here", onClick: () => forkAt(s.id, meta.index) },
            // RUN AS — per-message conversion: this ask, through the other engine (not offered while Agent is hidden).
            ...(HIDE_AGENT ? [] : [{ label: "Run as " + other, onClick: () => rerunAs(s.id, sessions[s.id]?.messages?.[meta.index]?.content, other, effortFor(s, meta.index)) }]),
          ]),
        );
        body.append(acts);
      }
    }
    // On a touch screen there is no hover: tapping a message reveals its actions.
    wrap.addEventListener("click", (e) => { if (!e.target.closest("button, a, input, textarea, iframe, .disclosure, .srcpanel")) wrap.classList.toggle("reveal"); });
    wrap.append(av, body);
    return { wrap, body, seam };
  }
  // Attach a built message to the open thread; returns its body.
  function appendMsg(s, role, content, meta = {}) {
    const m = buildMsg(s, role, content, meta);
    if (m.seam) E.threadCol.append(m.seam);
    E.threadCol.append(m.wrap);
    E.thread.scrollTop = E.thread.scrollHeight;
    return m.body;
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
      el("span", "disc-title", "agent record"),
      el("span", "disc-sub", `${(rec.activity || []).length} tool step(s)`),
      el("span", "disc-line", rec.cwd || rec.lane || "machine door"),
    );
    const panel = el("div", "disc-panel");
    if (rec.agents && (rec.agents.dispositions || rec.agents.escalated)) {
      panel.append(el("div", "disc-label", "Sub-agents (the machine's composition)"));
      const ul = el("div", "disc-ungrounded");
      if (rec.agents.swarm && rec.agents.swarm.routed) {
        ul.append(el("div", "disc-text", `swarm · framed the task${rec.agents.swarm.meaning?.hard ? " · hard meaning" : ""}`));
      }
      for (const d of rec.agents.dispositions || []) {
        ul.append(el("div", "disc-text", `${d.agent} · ${d.unit}${d.walled ? "  [walled]" : d.address ? " · " + d.address : ""}`));
      }
      if (rec.agents.escalated) {
        ul.append(el("div", "disc-text", `escalation · frontier mouth at the wall (${(rec.agents.frontier?.model) || "claude"})`));
      }
      panel.append(ul);
    }
    if (rec.activity && rec.activity.length) {
      panel.append(el("div", "disc-label", "Tool activity"));
      const ul = el("div", "disc-ungrounded");
      for (const a of rec.activity) ul.append(el("div", "disc-text", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? " [" + a.status + "]" : ""}`));
      panel.append(ul);
    }
    panel.append(el("div", "disc-foot", `${meta.model || "heimdall"} · via heimdall → ${rec.lane || "machine door"}${rec.executed === false ? " · machine composed, mouth drew residue (no tools handed to a small model)" : " · tools executed"}${rec.cwd ? " · " + rec.cwd : ""}${rec.ms ? " · " + rec.ms + "ms" : ""}`));
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

  // The row a turn narrates itself in. It is the turn's OWN node: attached to the
  // thread only while its chat is open (open() hangs it back when you return).
  function liveBody(s, attach) {
    const m = buildMsg(s, "assistant", "", {});
    m.body.classList.add("live");
    m.body.append(el("div", "live-stat", "working…"));
    if (attach) { E.threadCol.append(m.wrap); E.thread.scrollTop = E.thread.scrollHeight; }
    return m;
  }
  // A chat's turn is already running: another one cannot start on top of it.
  function busy(id) {
    if (!inflight.has(id)) return false;
    toast("this chat is still working \u2014 stop it first");
    return true;
  }

  /* ---------------- engagements per message ---------------- */
  // The engagement key is "chat"/"code" on the wire; the SURFACE label for the
  // code engagement is "agent". Messages and the seam always carry the surface
  // value, so the internal key never leaks into the thread (a seam read
  // "agent → code" before this — the raw key showing through).
  function normMode(m) { return m === "code" || m === "agent" ? "agent" : "chat"; }
  // Which engine a stored message belongs to. New messages carry their mode;
  // legacy sessions derive it — an assistant turn that landed a code record is
  // an agent turn, and a user ask inherits the mode of the assistant turn that
  // answers it (falling back to chat).
  function modeOf(s, i) {
    const m = s?.messages?.[i];
    if (!m) return "chat";
    if (m.mode) return normMode(m.mode);
    if (m.role === "assistant") return m.grounding?.code ? "agent" : "chat";
    for (let j = i + 1; j < (s.messages?.length || 0); j++) {
      const n = s.messages[j];
      if (n.role === "assistant") return n.grounding?.code ? "agent" : "chat";
    }
    return "chat";
  }
  // CONVERT A TURN BETWEEN THE ENGAGEMENTS (chat ↔ agent): the same ask, run
  // through the other engine, as a new lane in the same thread. The original
  // turn and its record are never touched — a conversion only adds. The seam
  // renders the handoff, so the change of engine is visible, not silent.
  function rerunAs(id, content, targetMode, originalEffort = null) {
    const s = sessions[id]; if (!s || !content || busy(id)) return;
    targetMode = normMode(targetMode);
    setEngagement(targetMode === "agent" ? "code" : "chat");
    // A grounded (chat) re-run keeps the original turn's effort unless the
    // composer's control was moved since; an agent turn carries none.
    const effort = targetMode === "chat" ? takeEffort(originalEffort) : undefined;
    // …and keeps the answer mode the original ask ran in (the nearest earlier ask with the same words), unless the chip moved.
    const origAnswer = [...s.messages].reverse().find((x) => x.role === "user" && x.content === content && x.answerMode)?.answerMode || null;
    const answerMode = targetMode === "chat" ? takeAnswerMode(origAnswer) : undefined;
    s.messages.push({ role: "user", content, at: now(), mode: targetMode, converted: true, ...(effort ? { effort } : {}), ...(answerMode ? { answerMode } : {}) });
    const idx = s.messages.length - 1;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    if (activeId === id) appendMsg(s, "user", content, { index: idx, mode: targetMode, converted: true });
    renderChats();
    if (targetMode === "agent") runCode(id);
    else run(id, false);
  }
  // The effort a stored turn ran with (null if it predates per-turn effort).
  function effortFor(s, index) { return web.effortOfTurn(s?.messages, index); }
  // Resolve the effort for a dispatch NOW and mark the control as "caught up":
  // from here on, the composer value only differs from a turn's if it is moved again.
  function takeAnswerMode(original = null) {
    const a = resolveAnswerMode({ original, composer: composerAnswer, changed: answerMoved });
    answerMoved = false;
    return a;
  }
  function takeEffort(original = null) {
    const e = web.resolveEffort({ original, composer: composerEffort, changed: effortMoved });
    effortMoved = false;
    return e;
  }
  function actBtn(label, title, onClick) {
    const b = el("button", "act", label);
    b.type = "button"; b.title = title; b.onclick = onClick;
    return b;
  }
  // "copy" + the code glyph: the turn's process as JSON (for an agent, a log, a bug report)
  function copyJsonBtn(getJson) {
    const b = actBtn("", "Copy how this was answered, as JSON", async () => {
      try { await navigator.clipboard.writeText(String(getJson() ?? "")); b.firstChild.textContent = "\u2713"; } catch (e) { b.firstChild.textContent = "\u00d7"; }
      setTimeout(() => { b.firstChild.textContent = "</>"; }, 1300);
    });
    b.textContent = "</>"; b.classList.add("act-code");
    return b;
  }
  // copy (the text arrives lazily, so a re-render never copies a stale answer)
  function copyBtn(getText) {
    const b = actBtn("copy", "Copy this message", async () => {
      try { await navigator.clipboard.writeText(String(getText() ?? "")); b.textContent = "copied"; } catch (e) { b.textContent = "copy failed"; }
      setTimeout(() => { b.textContent = "copy"; }, 1300);
    });
    return b;
  }
  // the ⋯ button: everything that is not copy / retry / edit, one click away
  function moreBtn(items) {
    const b = el("button", "act more", "⋯");
    b.type = "button"; b.title = "More actions"; b.setAttribute("aria-label", "More actions"); b.setAttribute("aria-haspopup", "menu");
    b.onclick = () => menuAt(b, items);
    return b;
  }
  // The ask that produced the answer at `index`: the nearest preceding user turn.
  function askBefore(s, index) {
    for (let i = index - 1; i >= 0; i--) {
      const m = s?.messages?.[i];
      if (m?.role === "user" && m.content) return m.content;
    }
    return null;
  }

  /* ---------------- memory: edit / continue ---------------- */
  async function editMessage(id, index) {
    const s = sessions[id]; const m = s?.messages?.[index];
    if (!m || m.role !== "user" || busy(id)) return;
    const next = await askDialog({ title: "Edit message", value: m.content, okLabel: "Save" });
    if (next == null || !next || next === m.content || sessions[id] !== s || busy(id)) return;
    // The edited ask keeps the effort the original ran with, unless the person
    // has moved the composer's control since.
    const effort = takeEffort(web.effortOfTurn(s.messages, index));
    s.messages = s.messages.slice(0, index).concat([{ ...m, content: next, at: now(), effort, answerMode: takeAnswerMode(m.answerMode) }]);
    s.updated = now();   // a shortened chat must still be the NEWER copy when tabs merge
    save("fold-chat:sessions", sessions);
    open(id);
    // The edited message IS the question now; run it as it stands (not as a
    // "Continue." turn, which would answer the wrong thing).
    run(id, false);
  }
  function continueFrom(fromId, index) {
    const s = sessions[fromId]; if (!s) return;
    const id = sid();
    const effort = takeEffort(web.effortOfTurn(s.messages, index));
    sessions[id] = cloneSession(s, { id, title: (s.title || "chat") + " · continue", messages: s.messages.slice(0, index + 1).map((m) => ({ ...m })) });
    save("fold-chat:sessions", sessions);
    open(id);
    run(id, true, effort);
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
    const msgs = modelHistory(s.messages);
    const total = msgs.reduce((n, m) => n + String(m.content || "").length, 0);
    return msgs.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS;
  }
  function materialOf(s) {
    const out = [];
    for (const a of s.attachments || []) {
      if (a.reading) out.push({ ref: `attachment · ${a.name}`, source: a.name, text: a.reading });
    }
    const users = (s.messages || []).filter((x) => x.role === "user" && !x.attachment);
    // A person's QUESTION is not a source, and neither is the conversation. Only
    // a substantive PASTED DOCUMENT (a body of text they supplied — long, and
    // not a chat turn) is material. The dialogue is never cited as evidence.
    const pasted = users.filter((x) => {
      const t = String(x.content || "").trim();
      if (t.length < 400) return false;                 // a chat turn, not a document
      if (t.length < 800 && !/\n/.test(t)) return false; // one long sentence is still a question
      return true;
    });
    pasted.forEach((x, i) => out.push({ ref: `you · pasted ${i + 1}`, source: `S${i + 1}`, text: x.content }));
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
    // Turn entities are NOT scanned here (an English capital-letter scan reads Han / Arabic / Devanagari as "no entities"): fold-chat-carry.js applyCarry owns them, from the referent record.
    const entities = [...new Set(fromK.map((x) => String(x).trim()).filter((x) => x.length > 1 && x.length < 40))].slice(0, 8);
    const flow = `${s.summary.turnCount} turn(s) · opening on "${truncate(topic || "", 60)}"`;
    // Context: what is still open — the last user question if its answer was a
    // gap ("no material carried" / a refusal), else null (nothing to carry).
    const lastRec = (s.summary.records || []).slice(-1)[0];
    const context = lastRec && (lastRec.unsupported?.length || lastRec.open?.length) ? `open: ${(lastRec.open?.length ? lastRec.open : lastRec.unsupported).join("; ")}` : s.summary.context;
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

  async function run(id = activeId, continuing = false, continueEffort = null) {
    const runId = newRun("chat");
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;
    if (s._after) { try { await s._after; } catch {} }   // E2 L1
    // Every UI write below is for THIS chat's turn: it happens only while this
    // chat is the open one. The session record is always updated.
    const isLive = () => activeId === id;    // A model is needed ONLY if a model call will actually be made (facing mode, a turn the model may write). With none
    // reachable the turn does not stop: Sources only, app-authored gaps, cards and fixed lines all need no model, and a
    // facing turn that read sources falls back to the strand below (noModelFallbackNotice).
    const m = models.find((x) => x.id === s.model) || selectedModel() || NO_MODEL;
    if (continuing) {
      const prevAsk = [...s.messages].reverse().find((x) => x.role === "user");
      s.messages.push({ role: "user", content: "Continue.", at: now(), effort: web.normEffort(continueEffort, composerEffort), answerMode: takeAnswerMode(prevAsk?.answerMode) });
    }
    // THIS TURN's effort: the one stamped on the ask when it was sent (or
    // re-run). It is read here, once, and never re-read from the composer, so
    // moving the control mid-turn or later cannot change a turn in flight or
    // already sent.
    const askMsg = [...s.messages].reverse().find((x) => x.role === "user");
    const effort = web.normEffort(askMsg?.effort, composerEffort);
    if (askMsg && !askMsg.effort) askMsg.effort = effort;
    // THIS TURN's answer mode, read once from the ask like effort: facing (the model writes from snipped
    // sources) or snips (Sources only — the model is not called at all).
    let answerMode = normAnswerMode(askMsg?.answerMode, composerAnswer);
    if (askMsg && !askMsg.answerMode) askMsg.answerMode = answerMode;
    s.effort = effort; // last-used, kept for older builds that read the session's effort
    // THE CONVERSATION FOLD (the holodeck's, vendored). The context window does
    // NOT grow with the conversation: the running summary + the addressable
    // records + a small recency window are what ride; the raw transcript beyond
    // that is never resent. `summary` is the store (append-only, persisted on
    // the session); buildTurnMessages projects it.
    if (!s.summary) s.summary = FOLD.emptySummary();
    const basePrompt = [PRESETS[s.preset]?.system, memory.systemContext({ readerName, facts: s.facts || {} })].filter(Boolean).join(" ");
    const said = lastUserText(s);
    // THE CONVERSATION IS A SOURCE (fold-chat-thread.js): the ask is read against the turns BEFORE it, before anything is
    // searched. "what?" / "why?" / "shorter" are about the previous answer (no search; the model may reply from that turn
    // alone, or — with nothing earlier — nothing is written); "i want a chewier one" is searched WITH the earlier topic; a
    // pronoun follow-up carries the last answer's referent (resolveQuestion). The person's words are never rewritten.
    const askAt = s.messages.lastIndexOf(askMsg);
    // THE THREAD'S LANGUAGE (fold-chat-lang.js): the last confident language of the person's own earlier turns. An elliptical
    // follow-up ("and him?", "chewier") has none of its own and inherits it; any text with evidence of its own can still flip it.
    const threadLang = threadLanguage(askAt > 0 ? s.messages.slice(0, askAt) : []);
    const lang0 = detectLang(said, { prior: threadLang }).lang;
    // CAST-REFERENT RESOLUTION (fold-chat-casts.js, OFF by default): a pronoun binds to ONE referent the person's own
    // turns established or the fold showed them — holder-scoped, never a top-2 bag, never a source-only referent.
    const casts = (() => { try { return localStorage.getItem("fold-chat:casts") === "on"; } catch { return false; } })()
      ? castOf(askAt > 0 ? s.messages.slice(0, askAt) : [], s.referents || {})
      : null;
    const follow = planTurn(said, askAt > 0 ? s.messages.slice(0, askAt) : [], { referents: s.referents || null, rejected: rejectedSurfaces(s.minds), hints: hintsFor(lang0 === "unknown" ? "en" : lang0), lang: lang0, casts });
    // A bare nudge ("well?") after an unanswered ask IS that ask again: the turn is read, searched and written as the earlier question
    // (follow.retry); the person's own "well?" stays what they said (the thread, the record's `said`).
    // A source-ask ("find a primary source") is answered by the SOURCES, never by the model: asked to "find a primary source" a small model writes a link
    // that does not exist (measured 2026-10-06: "[Replace the link with a real article…]"). The sources go out as they are, unchanged; only this turn's mode changes.
    if (follow.kind === "source-ask" && follow.mode === "web") answerMode = "snips";
    // THE DISCOURSE WATCHER, PRE (fold-chat-watch.js): before anything is searched, what does the person actually want? It reads the exchange and the baton the last
    // watcher left (kept on the assistant message, apart from the discourse summary) and says so in the feed; POST below holds the turn to it and leaves the next baton.
    let watcherPre = null;
    try { watcherPre = watchPre({ ask: said, prior: askAt > 0 ? s.messages.slice(0, askAt) : [], opts: { referents: s.referents || null, rejected: rejectedSurfaces(s.minds), hints: hintsFor(lang0 === "unknown" ? "en" : lang0), lang: lang0 } }); } catch (e) { /* an aid, never a reason to lose a turn */ }
    const question = follow.retry || said;
    // A BOOK ASK (fold-chat-book.js): the person named a book the fold holds WHOLE. The fold reads it — it never searches
    // the web for what it can read itself. `content` distinguishes "summarize war and peace" (read and narrate) from a bare
    // mention ("war and peace?"), where the fold offers the two ways it could go.
    const bookask = shelf.bookAsk(question);
    // WHAT IS ASKED TO BE PRODUCED (fold-chat-outputtype.js, pure, no model): "write me an essay on this" is an ESSAY about the telephone, not a lookup of the
    // instruction. `searchQuery` is the TOPIC (resolved through the thread: "who invented the telephone"), never "write essay invented telephone"; `needsSources`
    // says whether this kind of piece grounds in sources at all (a poem, a joke, a tagline does not); `voidIfMissing` are the typed gaps for fold-chat-genvoid.js.
    let outType = null;
    try { outType = describeOutput(follow.retry || said, { prior: askAt > 0 ? s.messages.slice(0, askAt) : [], hasMaterial: materialOf(s).length > 0 }); } catch (e) { /* an aid, never a reason to lose a turn */ }
    const producing = !!outType?.wants && follow.mode === "web" && outType.type !== "code" && outType.type !== "translation" && outType.type !== "rewrite";
    const searchQ = (producing && outType.needsSources && outType.searchQuery) || follow.search || question;   // what is SEARCHED (and what picks the quoted sentences)
    let threadTurn = follow.mode === "thread" ? follow.thread : null;
    // "summarize this" / "translate that into Spanish" with nothing attached: the material is the LAST ANSWER, so the turn is grounded in the thread, not searched
    if (outType?.wants && outType.material === "thread-answer" && follow.mode === "web" && follow.thread?.has && !threadTurn) threadTurn = follow.thread;
    // The transcript the MODEL may see: each turn carries only what its author
    // wrote — never a system note, a void, or a withdrawn-claim line.
    // (G3) the history is built below, once the turn's kind is known: a creative exchange does not ride back to a factual turn (fold-chat-histkind.js)
    s.updated = now(); save("fold-chat:sessions", sessions);
    if (isLive()) setView(false);
    const row = liveBody(s, isLive());
    const body = row.body;
    // THE TURN'S LIVE FEED (the coding lane's renderer, fold-chat-agentfeed.js, fed by fold-chat-turnfeed.js): one row per
    // step as it happens — each source asked, each page read — with a ticking clock on the step in flight. It collapses
    // into the "how this was answered" line when the answer lands, and replays from `record.feed` after a reload.
    const tt = newTurnTrace({ question: lastUserText(s) });
    const turnEvents = [];
    let pvLive = null, pvStream = "";   // the live three-panel reading (fold-chat-presentview.js mountLive), when the turn reads sources
    const feed = createFeed(body, { live: true, onStop: () => flight.stop(), viewSwitch: true });
    body.querySelector(".live-stat")?.remove();
    const feedPush = (evs) => { for (const e of evs) { turnEvents.push(e); try { feed.push(e); } catch (err) { try { console.error("[fold-chat] feed:", err); } catch {} } try { pvLive?.event(e); } catch {} } };
    const ac = new AbortController();
    const flight = { ac, kind: "chat", label: "working…", startedAt: Date.now(), wrap: row.wrap, stage: "", stop: () => { ac.abort(); flight.stage = "stopping…"; if (isLive()) E.stage.textContent = "stopping…"; } };
    inflight.set(id, flight);
    flight.stage = m.sealed ? "sealed-external · working…" : client.isPageModel(m) ? "in this tab · working…" : "working…";
    if (isLive()) E.stage.textContent = flight.stage;
    refreshComposer(); renderChats();
    // The turn's exit, however it ends: drop its in-flight entry, unlock the
    // composer if this chat is open, and show the sidebar row at rest.
    const release = () => { pageSink = null; if (pageLoading && !pageEngine?.isLoaded()) pageLoading = null; try { feed.dispose(); } catch {} inflight.delete(id); refreshComposer(); renderChats(); if (isLive()) { E.stage.textContent = ""; E.input.focus(); } refreshMeter(); loadedPoller?.refresh(); };
    // Stopped (the Stop button, Escape, or the chat being deleted): the person's
    // message stays, and a quiet note rides message.notices — never `content`.
    const stopped = () => {
      body.classList.remove("live"); row.wrap.remove();
      const notices = [{ kind: "stopped", text: "Stopped \u2014 no answer was written." }];
      s.messages.push({ role: "assistant", content: "", at: now(), mode: "chat", notices });
      s.updated = now();
      if (sessions[id] !== s) return;   // deleted: the stash (for Undo) carries the note
      save("fold-chat:sessions", sessions);
      if (isLive()) appendMsg(s, "assistant", "", { index: s.messages.length - 1, notices, model: m.id, mode: "chat" });
    };
    // A turn that DIED (the bridge refused, a stream stalled, a bug past the model): it is never
    // a blank bubble and never a raw "error:" string that vanishes on reload. It is stored as a
    // typed note on its own message — with a retry — exactly like Stopped, and drawn if this chat is open.
    const failTurn = (err) => {
      try { console.error("[fold-chat] turn failed:", err); } catch {}
      body.classList.remove("live"); row.wrap.remove();
      const notices = [errorNotice(err)];
      s.messages.push({ role: "assistant", content: "", at: now(), mode: "chat", notices });
      s.updated = now();
      if (!isLive()) s.unseen = true;
      if (sessions[id] !== s) return;
      save("fold-chat:sessions", sessions);
      if (isLive()) { E.stage.textContent = ""; appendMsg(s, "assistant", "", { index: s.messages.length - 1, notices, model: m.id, mode: "chat" }); }
    };
    try {
    // DISCOURSE AWARENESS decides the pipeline before any search runs. A
    // generation turn is never front-loaded with a web search (that is what
    // turned "write an essay" into "what topics?"), and a greeting is never
    // searched or checked.
    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });
    const history = modelHistory(withoutAppAnswered(s.messages), { styleSafe: { kind, classify: (q) => classifyTurn(q, {}), leansOnLast: continuesByAnaphora(follow) } });
    // THE VOID FOR A WRITTEN OUTPUT (fold-chat-genvoid.js): what a generate/compose turn could not write, and why, is a typed gap that names the thing; the sources are never drawn as the piece.
    const genOt = kind === "generate" || kind === "compose" ? (outType?.wants ? genVoidShape(outType, KNOWN_FORMS) : outputTypeFromAsk(question, { hasMaterial: materialOf(s).length > 0 })) : null;
    let genGate = null;   // { ok:false, void, notice, fallbackAllowed }
    // The live narration: every step the fold takes is shown while it takes it,
    // so the person sees the pipeline (classify → search → read → write →
    // check) rather than a frozen spinner. The blinking cursor follows the live
    // status line in the answer body, so it says what the fold is DOING (and
    // the tiny stage strip mirrors it).
    const say = (msg) => {
      flight.stage = msg;
      if (isLive()) E.stage.textContent = msg;
      const st = body.querySelector(".live-stat");
      if (st) st.textContent = msg;
    };
    const kindWord = { smalltalk: "greeting", generate: "writing request", research: "question of fact", chat: "conversation", compute: "calculation", transform: "your own text", code: "programming question", compose: "personal writing", advice: "advice" }[kind] || kind;
    say(`turn · ${kindWord}`);
    feedPush(startEvents(tt, { kindWord }));
    // ALWAYS GROUNDED, including a WRITING request: a "write about X and
    // compare" turn seeks sources first and writes from what was read — it is
    // never answered from parametric memory. The weave (ungrounded single-draw)
    // is retired from this path for that reason.
    let surfedUrls = [], asideUrls = [];
    let webPassages = [], webTrace = null, sourceBlock = null, webResults = [], bookFound = null;
    let turnPages = [];   // the FULL pages this turn read — memory only, never stored or sent; the REC loop recalls against them
    // ALWAYS GROUNDED: every turn that makes or needs a claim seeks sources first. There
    // is no ungrounded/oracle path — the fold reads before it answers. (An
    // unavailable network is reported, not silently answered from parametric
    // memory.) The ONLY turns that skip the search are the ones with nothing to look
    // up: a greeting, arithmetic the fold computes itself, the person's own text to
    // translate or summarise, a programming how-to, a personal note (skipsSearch).
    // THE DISPATCH: a lookup is run only when the ask has something to look up (fold-chat-self.js lookupWarranted). It was default-yes: "who are you?" opened
    // with "who", was read as research and searched four scopes (user, 2026-10-06). An ask with no content word and no thread to carry is answered by the app.
    if (watcherPre && watcherPre.want !== "answer") feedPush(lineEvent(tt, "Read what you are after", { tone: "info", note: wantLine(watcherPre) + (watcherPre.notes.length ? " \u00b7 " + watcherPre.notes[0] : "") }));
    const lookup = !skipsSearch(kind) && !!question && follow.mode === "web" ? lookupWarranted({ question, follow, fw: functionWordsOf(lang0 === "unknown" ? "en" : lang0) }) : null;
    const noLookup = !!(lookup && !lookup.warranted);
    // RECALL: "what did you tell me earlier?" is a READ of the claim store at an address (fold-chat-recall.js, khora foldAt) — the fold's own words, verbatim, no search, no model.
    const recall = !skipsSearch(kind) && !!question && follow.mode === "web" ? recallOf({ question, claims: s.claims || [], fw: functionWordsOf(lang0 === "unknown" ? "en" : lang0) }) : null;
    // "where did you get that?" / "source?" is about the LAST answer: read back the source line it stored (fold-chat-sourceask.js) — no search, no model.
    const priorForWatch = askAt > 0 ? s.messages.slice(0, askAt) : [];
    // the watcher's two app-authored replies (no search, no model): a DRILL-DOWN into what the last turn did (full account, kept apart from the baton),
    // and "where did you get that?" after a turn that left a source want UNMET (what was done, said in the baton's compact words)
    const watchText = watcherPre && follow.mode !== "cold-gap" ? (watcherPre.want === "inspect" ? inspectReply(priorForWatch, said) : null) : null;
    let srcRecall = follow.kind === "source-ask" && follow.mode === "web" ? sourceRecall(priorForWatch, said) : null;
    if (!srcRecall && !watchText && watcherPre && follow.kind === "source-ask" && follow.mode === "web") { const br = batonReply(watcherPre); if (br) srcRecall = { provenance: null, turn: null, text: br, fromBaton: true }; }
    if (!srcRecall && watchText) srcRecall = { provenance: null, turn: null, text: watchText, fromBaton: true, inspect: true };
    if (!srcRecall && watcherPre && follow.mode === "thread") { const cr = challengeReply(watcherPre, priorForWatch); if (cr) { srcRecall = { provenance: cr.provenance, turn: null, text: cr.text, fromBaton: true, challenge: true }; threadTurn = null; } }
    // "find a primary source" with nothing already verified to read back: go and FIND one for the LAST ANSWER's claim (fold-chat-primary.js: search, read and the model's number-pointing are the chat's own, injected). The turn's words are the app's.
    const primaryAsk = !srcRecall && follow.kind === "source-ask" && follow.mode === "web" && watcherPre && watcherPre.sub === "new" && watcherPre.thread && watcherPre.thread.has && String(watcherPre.thread.answer || "").trim()
      ? { claim: String(watcherPre.thread.answer).replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)[0], turn: watcherPre.thread.turn } : null;
    // a piece that needs no sources (a poem, a joke, a tagline) is not front-loaded with a search; an ask whose typed gap already holds (no topic, no material, an unsupported type) is not searched either
    const needlessSearch = producing && !outType.needsSources;
    const activeGap = !!(producing && outType.voidIfMissing.some((g) => g.active === true));
    // a piece that needs no outside facts (a poem, a toast) has no claim for the model to invent, so it may be written without a source. DECISION FOR THE BOSS: ALONE_KINDS (fold-chat-gaps.js) is [] today; this is
    // the one place that says "creative, needs no sources, no typed gap" may stand alone. Both the barrier below (aloneBarred) and Gary's door (materialInView) read it.
    const mayWriteAlone = modelSpeaksAlone(kind) || (producing && !outType.needsSources && !activeGap && (kind === "generate" || kind === "compose"));
    let wantWeb = !skipsSearch(kind) && !!question && follow.mode === "web" && !noLookup && !recall && !srcRecall && !primaryAsk && !needlessSearch && !activeGap;
    if (bookask && follow.mode === "web") wantWeb = true;   // a book ask is ALWAYS read from the shelf: the fold reads what it holds, it does not guess or defer to the web
    if (srcRecall) feedPush(lineEvent(tt, srcRecall.inspect ? "Read back what I did last turn" : srcRecall.fromBaton ? "Read back what the last turn did" : "Read back where the last answer came from", { tone: "ok", note: `${srcRecall.turn ? "turn " + srcRecall.turn + " \u00b7 " : ""}no search, no model` }));
    if (recall) feedPush(lineEvent(tt, "Read back what I said", { tone: "ok", note: `from the record at ${recall.address} \u2014 no search, no model` }));
    if (noLookup) feedPush(lineEvent(tt, "Nothing to look up", { tone: "info", note: lookup.why + " \u2014 so I did not search" }));    // A live-data ask (weather, a price, a score, today's news) can only be answered from a
    // live source; with nothing read that establishes it the turn is a typed gap, not a guess.
    const liveHit = wantWeb && (kind === "research" || kind === "chat" || kind === "advice") ? liveAsk(question) : null;
    // AMBIGUITY: one bare word that names several things gets a lookup of the bare term, in
    // parallel with the search (the search reads ONE sense; this lists the others).
    let sensesProbe = null;
    const probeTerm = wantWeb && (kind === "research" || kind === "chat") ? senseTerm(question) : null;
    // The turn this is NOT a source of the answer, only of the list of senses: audited, time-boxed, never fatal.
    const noSources = () => wantWeb && !webPassages.length;
    if (wantWeb) {
      if (question) {
        say(`turn · ${kindWord} · searching the web…`);
        // THE LIVE PANEL (fold-chat-presentview.js): the reading drawn as it happens, above the step log.
        try { pvLive = mountLive(body, { question: searchQ || question, mdHtml }); for (const e of turnEvents) pvLive.event(e); } catch (e) { pvLive = null; }
        if (follow.kind === "retry") feedPush(lineEvent(tt, "Picked your earlier question back up", { tone: "info", note: `nothing was written for \u201c${question.slice(0, 90)}\u201d, so I'm answering it now` }));
        // Every step the search takes arrives as an onStep event and becomes a row of the turn's live feed
        // (fold-chat-turnfeed.js eventsForStep): each source asked with its own clock and result count or failure
        // reason, each page read with "kept N of M chars", an honest "waiting on …" line when something is slow.
        const onStep = (st) => { feedPush(eventsForStep(tt, st)); try { pvLive?.step(st); } catch {} };
        // THE SHELF: an ask that names a book the fold holds whole (fold-chat-book.js) is answered from the book itself,
        // read in full, before (and instead of) the web.
        const onShelf = shelf.bookFor(question);
        if (onShelf) {
          try {
            feedPush(lineEvent(tt, `Opened ${onShelf.title}`, { tone: "info", note: `the whole text, from ${onShelf.via}` }));
            const parsed = await raceAbort(shelf.load(onShelf, { fetchImpl: withSignal(outbound.auditedFetch("book", runId), ac.signal) }), ac.signal);
            const found = shelf.passagesFor(question, parsed, onShelf);
            feedPush(lineEvent(tt, `Read all ${parsed.paras.length.toLocaleString("en")} paragraphs`, { tone: found.passages.length ? "ok" : "info", note: found.names.length ? `${found.matched} where ${found.names.join(" and ")} appear together, across ${found.chapters} chapters` : "no person from your question appears in it" }));
            if (found.passages.length) {
              webPassages = found.passages;
              webTrace = [{ scope: "book", engine: `${onShelf.title} · whole text`, n: found.matched, ok: true }, ...found.passages.map((p) => ({ read: p.url, via: "book", chars: p.text.length }))];
              bookFound = { ...found, book: onShelf, paras: parsed.paras.length, chars: parsed.chars };
              try { pvLive?.book(onShelf, { ...found, paras: parsed.paras.length }); pvLive?.passages(found.passages); } catch {}
              sourceBlock = shelf.bookPrompt(onShelf, found, question) + "\n\n" + sourcesPrompt(webPassages);
              feedPush(lineEvent(tt, `Kept ${found.passages.length} scenes`, { tone: "ok", note: found.passages.map((p) => p.bookPlace.book.replace(/ \(.*\)/, "") + " · " + p.bookPlace.chapter).join(", ") }));
              say(`turn · ${kindWord} · read ${onShelf.title} · ${placeLabel(m)} · answering…`);
            } else {
              // THE FOLD (fold-chat-bookfold.js): the ask names no person — it is about the book ITSELF (its plot,
              // story, summary, themes). The shelf kept nothing because it is a FIND; this is the chapter-reduction
              // FOLD it lacked: each chapter reduced to the sentence where the book's own cast is densest, chapters
              // folded into books. No model writes it — Houdini holds every cut (a line naming no being is folded out).
              const fold = bookfold.plotFold(parsed.text, parsed, onShelf, question);
              if (fold.passages.length) {
                webPassages = fold.passages;
                webTrace = [{ scope: "book", engine: `${onShelf.title} · folded (no model)`, n: fold.withLine, ok: true }, ...fold.passages.map((p) => ({ read: p.url, via: "book fold", chars: p.text.length }))];
                // A fold turn's own material is the book's folded event lines: kept whole in the Sources-only view (the fold IS the
                // summary), so the 17 book folds are not cut to the strand's usual five. No answerSpan — a fold line is the answer.
                const foldChars = fold.passages.reduce((a, p) => a + p.text.length, 0);
                const foldLimits = { ...STRAND, maxPassages: Math.max(STRAND.maxPassages, fold.passages.length), totalChars: Math.max(STRAND.totalChars, foldChars + 400), minimal: false };
                bookFound = { names: fold.cast.slice(0, 8), focal: null, matched: fold.withLine, chapters: fold.chapterCount, passages: fold.passages, book: onShelf, paras: parsed.paras.length, chars: parsed.chars, fold: true, foldLimits };
                try { pvLive?.book(onShelf, { names: fold.cast.slice(0, 8), matched: fold.withLine, chapters: fold.books.length, paras: parsed.paras.length }); pvLive?.passages(fold.passages); } catch {}
                sourceBlock = bookfold.foldPrompt(onShelf, fold, question) + "\n\n" + sourcesPrompt(webPassages);
                feedPush(lineEvent(tt, `Folded ${fold.chapterCount} chapters into ${fold.books.length} books`, { tone: "ok", note: `${fold.withLine} chapters kept an event line; ${fold.foldedOut} lines about the telling folded out \u2014 no model` }));
                // THE SCENES BENEATH (fold-chat-bookscenes.js): the seam cuts each chapter at Murch's blinks and binds each
                // scene's events — every event the book's own sentence, VERBATIM at its byte address. The fold never WRITES an
                // event; it lifts what the grammar bound. An aid — never a reason to lose a turn.
                try {
                  const scenes = bookscenes.bookScenesFor(parsed.text, parsed, onShelf, { maxScenes: 2, maxEvents: 2, progress: (t) => feedPush(lineEvent(tt, t, { tone: "info" })) });
                  let ev = 0;
                  for (const p of scenes.per) for (const s of p.scenes) ev += s.events.length;
                  bookFound.scenes = scenes;
                  if (scenes.per.length) {
                    const scenePassages = scenes.per.filter((p) => p.scenes.length).map((p) => {
                      const top = p.scenes[0]; const e = top?.events?.[0];
                      return e ? { ref: `${onShelf.title} \u2014 ${top.ref} scene`, url: onShelf.home, source: onShelf.home,
                        text: e.text, at: { start: e.at, end: e.at + e.len }, via: onShelf.via, bookPlace: { book: p.book, chapter: top.chapter }, scene: true } : null;
                    }).filter(Boolean);
                    if (scenePassages.length) {
                      webPassages = [...webPassages, ...scenePassages];
                      foldLimits.maxPassages = Math.max(foldLimits.maxPassages, webPassages.length);
                      foldLimits.totalChars = Math.max(foldLimits.totalChars, webPassages.reduce((a, p) => a + p.text.length, 0) + 400);
                      sourceBlock += "\n\n" + bookscenes.scenePromptFor(onShelf, scenes);
                      try { pvLive?.passages(scenePassages); } catch {}
                    }
                    feedPush(lineEvent(tt, `Cut ${scenes.cut} scenes across ${scenes.per.length} books`, { tone: "ok", note: `${ev} events, every one verbatim at its address \u2014 no model wrote an event` }));
                  }
                } catch (e) { feedPush(lineEvent(tt, "Scenes didn't fold", { tone: "warn", note: String(e?.message || e).slice(0, 90) + " \u2014 the book folds still hold" })); }
                feedPush(lineEvent(tt, `Kept ${fold.passages.length} book folds`, { tone: "ok", note: fold.plot.filter((p) => p.line).map((p) => p.label.replace(/ \(.*\)/, "")).join(", ").slice(0, 200) }));
                say(`turn \u00b7 ${kindWord} \u00b7 folded ${onShelf.title} \u00b7 ${webPassages.length} addressed passages \u00b7 ${placeLabel(m)} \u00b7 answering\u2026`);
              }
            }
          } catch (e) {
            if (ac.signal.aborted) throw e;
            feedPush(lineEvent(tt, `Couldn't open ${onShelf.title}`, { tone: "bad", note: String(e?.message || e).slice(0, 90) + " — searching the web instead" }));
          }
        }
        if (!bookFound) try {
          if (searchQ !== question) feedPush(lineEvent(tt, follow.kind === "carried" ? "Followed on from the last answer" : "Followed on from the conversation", { tone: "info", note: `searching for \u201c${searchQ.slice(0, 90)}\u201d` }));
          feedPush(lineEvent(tt, "The query", { tone: "info", note: `searching for \u201c${String(searchQ).slice(0, 90)}\u201d` }));   // what was asked of the web, in the record the watcher reads (a later "what did you search for?" opens it)
          if (follow.gate && !follow.gate.decided) feedPush(lineEvent(tt, "Read your question on its own", { tone: "info", note: follow.gate.why }));   // (G3) a language with no closed-class prior is never carried; the feed says so
          const nEnt = web.queriesFor(searchQ).length;
          const readFor = { fast: 2, balanced: Math.min(6, Math.max(3, nEnt)), deep: 6 }[effort] || 3;
          // The search is cancellable: its fetches carry this turn's signal, and the
          // await itself yields the moment Stop is pressed (or the chat deleted).
          if (probeTerm) sensesProbe = raceAbort(Promise.race([web.search("wikipedia", probeTerm, 0, { fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal) }), new Promise((r) => setTimeout(() => r(null), 7000))]), ac.signal).catch(() => null);
          const w = await raceAbort(web.searchWeb(searchQ, { onStep, effort, read: readFor, memo: pageMemo, fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal) }), ac.signal);
          webPassages = w.passages || [];
          if (genOt) {
            // pages ABOUT writing the output (tutorials, samples, templates, writing services, bot walls, pages that never mention the topic) are not material for it
            const g0 = genVoid({ outputType: genOt, webPassages, question });
            if (g0.setAside.length) {
              asideUrls = [...asideUrls, ...g0.setAside.map((x) => String(x.url || "")).filter(Boolean)];
              feedPush(lineEvent(tt, `Set aside ${g0.setAside.length} page${g0.setAside.length === 1 ? "" : "s"} about writing, not about the topic`, { tone: "info", note: [...new Set(g0.setAside.map((x) => x.why.replace(/^meta-/, "")))].join(", ") + " \u00b7 " + g0.setAside.slice(0, 3).map((x) => x.domain || x.title).join(", ") }));
              webPassages = g0.passages;
            }
            if (!g0.ok && !webPassages.length && g0.setAside.length) genGate = g0;   // pages were read and every one was set aside; no pages at all is drawn below, with the search that was tried
          }
          surfedUrls = webPassages.map((p) => String(p.url || p.source || "")).filter(Boolean);
          // THE WATCHER, fed the content that was surfed: for a source-ask, pages that do not bear on the thread's topic are set aside before anything is shown (never an empty hand).
          if (follow.kind === "source-ask" && watcherPre) { try { const kept = keepOnTopic(webPassages, watcherPre, priorForWatch); if (kept.length && kept.length < webPassages.length) { asideUrls = webPassages.filter((p) => !kept.includes(p)).map((p) => String(p.url || p.source || "")).filter(Boolean); feedPush(lineEvent(tt, "Set aside pages that do not bear on it", { tone: "info", note: `${webPassages.length - kept.length} of ${webPassages.length} \u00b7 read by what they say, not by their titles` })); webPassages = kept; } } catch (e) { /* an aid */ } }          turnPages = Array.isArray(w.pages) ? w.pages : [];
          try { if (webPassages.length) pvLive?.passages(webPassages); } catch {}
          webTrace = w.trace || null;
          webResults = w.results || [];
          if (webPassages.length) {
            // THE HOLOGRAPH THE MODEL READS: each passage cut to its most salient sentences — the same ones the panel parses —
            // so a small model sees the claims, not a page's tagline. The full passages stay the material the answer is checked against.
            sourceBlock = sourcesPrompt(webPassages.map((p) => { const sal = salientSentences(p.text, searchQ, 4); return sal.length >= 2 ? { ...p, text: sal.join(" ") } : p; })) + (webPassages.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "");
            say(`turn · ${kindWord} · read ${webPassages.length} source(s) · ${placeLabel(m)} · answering…`);
          }
        } catch (e) {
          if (ac.signal.aborted) throw e;
          webTrace = [{ scope: "web", ok: false, why: String(e?.message || e) }];
          feedPush(lineEvent(tt, "The search failed", { tone: "bad", note: String(e?.message || e).slice(0, 90) }));
          say(`turn · ${kindWord} · web search failed (${String(e?.message || e).slice(0, 40)}) · writing the answer…`);
        }
      }
    } else {
      say(kind === "generate" ? `turn · ${kindWord} · writing it now…` : `turn · ${kindWord} · ${placeLabel(m)} · writing the answer…`);
    }
    // A generate turn replaces the persona with the writer, it does not append
    // to it — the reading persona and the write instruction are opposite
    // directives and a small model hedges when handed both (measured: a
    // 265-char teaser with "fold persona + nudge" against a 2,200-char essay
    // from the nudge alone). The identity/facts line still rides, so the fold
    // never states a personal fact it was not given.
    const identityLine = memory.systemContext({ readerName, facts: s.facts || {} });
    // The asker's language rides every prompt (a transform is the exception: "translate X into
    // Spanish" is answered in Spanish whatever language the ask was written in).
    const langLine = kind === "transform" ? null : languageInstruction(question, { prior: threadLang });
    const COMPUTE_BASE = "You are the voice of a calculator. The fold has ALREADY computed the answer exactly; your only job is to say it in a short, natural sentence.";
    const turnBase = kind === "generate" ? [producing && !outType.needsSources ? GENERATE_CREATIVE_NUDGE : GENERATE_NUDGE, identityLine, langLine].filter(Boolean).join("\n\n")
      : (kind === "transform" || kind === "code" || kind === "compose") ? [KIND_PROMPT[kind], identityLine, langLine].filter(Boolean).join("\n\n")
      : kind === "compute" ? [COMPUTE_BASE, langLine].filter(Boolean).join("\n\n")
      : [basePrompt, kind === "advice" ? KIND_PROMPT.advice : null, langLine].filter(Boolean).join(" ");    // THE MODEL NEVER SPEAKS ALONE. NO SOURCES (search reached nothing readable, or threw): the model is not
    // asked; the fold draws the typed gap from the real search trace (fold-chat-gaps.js). A live-data ask is a
    // gap likewise. Everything below that could call the model goes through `callModel`, which is barred
    // (`modelBarred`) on a turn with no source, a Sources-only turn, and a kind the model may not answer alone.
    // THE SLOT PIPELINE (docs/ANSWER-PIPELINE.md; fold-chat-answerturn.js via fold-chat-answerwire.js). A factual ask whose answer is ONE filler of a
    // typed slot (who / when / how many / where / what is the capital…) is read, reasoned over — it searches for what would REFUTE the candidate —
    // and realised MECHANICALLY: the model is not called at all, whatever the answer mode. An answer, a contest or a typed gap ends the turn
    // here (a gap is drawn, never said). A { handoff } (not a slot ask, a language with no grammar, names that match no page, too slow) leaves
    // today's path exactly as it was, and the feed says why.
    let slotTurn = null;
    if (slotTurnWanted({ kind, wantWeb, liveHit, answerMode, enabled: slotPipelineOn() })) {
      say(`turn \u00b7 ${kindWord} \u00b7 checking whether this has one fact for an answer\u2026`);
      const slotFetch = withSignal(outbound.auditedFetch("web search", runId), ac.signal);   // every outbound call of the slot turn is logged, and Stop cancels it
      const slotRes = await raceAbort(runSlotTurn({ question, lang: lang0, webPassages, searchQ, now: new Date(), fetchImpl: slotFetch, signal: ac.signal, memo: pageMemo, onStatus: (t) => say(`turn \u00b7 ${kindWord} \u00b7 ${t}`) }), ac.signal);
      if (slotRes.aborted || ac.signal.aborted) throw abortError();   // Stop: no card, no answer — the same stopped turn as any other
      if (slotRes.handoff) feedPush(lineEvent(tt, "Handling this the usual way", { tone: "info", note: slotRes.handoff.why }));
      else if (endsTurn(slotRes)) { slotTurn = slotRes; feedPush(traceFeed(tt, slotRes, lineEvent)); }   // the app's own first-person reasoning, one row per line
    }
    let originLate = null;
    // AN ENCYCLOPEDIA IS A POINTER, NEVER A CITATION (fold-chat-origin.js, user 2026-10-06): every encyclopedia page this turn read is followed — the
    // sentences the answer would rest on, to the pages the article's own footnotes name (or a page already read that says the same), read and checked
    // to carry the claim by identity-by-consequence, the path kept. The originals join the passages; the encyclopedia page stays but is never cited.
    if (!slotTurn && wantWeb && webPassages.some((p) => p && !p.snippetOnly && isTertiary(p.url || p.source))) {
      say(`turn \u00b7 ${kindWord} \u00b7 following the encyclopedia's references to the pages they name\u2026`);
      const originRun = (async () => { try {
        const { trails } = await raceAbort(originatePassages(webPassages, searchQ, { fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal), memo: pageMemo, signal: ac.signal }), ac.signal);
        const seenTrail = new Set();
        for (const t of trails) {          const k = t.url + "|" + t.trail.status + "|" + (t.trail.origin ? t.trail.origin.url : "");
          if (seenTrail.has(k)) continue; seenTrail.add(k);
          feedPush(lineEvent(tt, t.trail.status === "origin" ? "Followed the encyclopedia to its source" : "The encyclopedia only points", { tone: t.trail.status === "origin" ? "ok" : "warn", note: traceWords(t.trail).replace(/^That sentence is on Wikipedia [^.]*\.\s*/, "").slice(0, 160) }));
        }
        if (webPassages.some((p) => p && p.origin)) sourceBlock = sourcesPrompt(webPassages) + (webPassages.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "");
      } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "Could not follow the encyclopedia's references", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); } })();
      const originWait = (() => { try { return localStorage.getItem("fold-chat:e2origin") === "off" ? 0 : 2000; } catch { return 2000; } })();
      if (!originWait) await originRun;
      else { const early = await Promise.race([originRun.then(() => true), new Promise((r) => setTimeout(() => r(false), originWait))]); if (!early) { originLate = originRun; originLate.catch(() => {}); feedPush(lineEvent(tt, "Writing while the encyclopedia's references are still being followed", { tone: "info", note: "they are joined before the draft is read" })); } }
    }
    let plan = null;
    if (wantWeb && !webPassages.length && !slotTurn) {      plan = unsourcedPlan(UNSOURCED_ANSWERS, { live: !!liveHit });
      say(`turn · ${kindWord} · no sources reached · drawing the gap (not answering from memory)…`);
      // a written output with nothing to write from: the gap names the output (no topic / no usable source / the lane may not speak alone), with the search that was tried
      if (genOt && !genGate) { genGate = genVoid({ outputType: genOt, webPassages, hasMaterial: materialOf(s).length > 0, barred: "alone", question }); if (!genGate.ok) genGate.void.attempts = unreachedGap(webTrace, question).attempts; }
      feedPush(genGate && !genGate.ok ? lineEvent(tt, `No usable source for the ${genOt.type}`, { tone: "bad", note: genGate.void.note }) : lineEvent(tt, "No source could be read", { tone: "bad", note: "drawing the gap \u2014 I won't answer from memory" }));
    }
    // SOURCES ONLY (answer mode "snips"): no model at all — the answer is the passages the pages gave, verbatim,
    // chosen with no model (structured block first, else the sentences that differ the ask), strung together.
    let strand = null, strandEmpty = false, strandWhy = "";
    // A FOLD turn (bookFound.fold) keeps its whole fold in the Sources-only view; every other turn takes the strand's usual limits.
    const foldOpts = bookFound?.foldLimits ? { limits: bookFound.foldLimits } : undefined;
    // A slot turn is marked like a strand (no model, authored by the sources, never scored: its answer line is the source sentence's own words) but it
    // carries no snips — the card (fold-chat-answercard.js) draws it. Every strand-guarded step below therefore stands down for it, as it should.
    if (slotTurn) strand = { snips: [], dropped: [], slotTurn };
    if (answerMode === "snips" && wantWeb && webPassages.length && !slotTurn) {
      strand = snipsOf(webPassages, searchQ, foldOpts);
      if (!strand.snips.length) { strandWhy = [...new Set((strand.gaps || []).map((g) => g.reason).filter(Boolean))].slice(0, 3).join("; "); strand = null; strandEmpty = true; plan = unsourcedPlan(UNSOURCED_ANSWERS, { live: false }); }   // the typed gaps say why (a wall, a gate, only menus and notices)
      else { say(`turn · ${kindWord} · sources only · stringing ${strand.snips.length} passage(s) together (no model)…`); feedPush(lineEvent(tt, "Strung the sources' passages together", { tone: "ok", note: `${strand.snips.length} passage(s), their own words \u2014 no model` })); }
    }
    // A kind that searches nothing (greeting, arithmetic, your own text, code, personal writing) has no source:
    // the model may not answer it alone unless ALONE_KINDS (fold-chat-gaps.js) says so.
    // A follow-up about the previous answer, with that answer on the thread, is grounded in the THREAD: the model may reply.
    const aloneBarred = !wantWeb && !mayWriteAlone && !threadTurn;
    if (threadTurn) {
      sourceBlock = threadPrompt(threadTurn);
      // THE SOURCES THAT TURN READ ARE STILL MATERIAL: a follow-up about an answer may use (and cite) what that answer was      // grounded in. No new search; the carried passages are labelled [W#] and the reply is checked against them.
      const prevAns = s.messages[threadTurn.answerIndex] || [...s.messages].reverse().find((x) => x.role === "assistant" && x.grounding);
      const pg = prevAns?.grounding || {};
      // turns recorded before passages were kept still carry the spans their answer was grounded in
      const carried = pg.passages?.length ? pg.passages : (pg.sources || []).filter((x) => String(x.span || x.text || "").length >= 40).map((x) => ({ ref: x.ref, source: x.address, url: /^https?:/.test(String(x.address || "")) ? x.address : undefined, text: String(x.span || x.text) }));
      if (carried.length) { webPassages = carried.map((p) => ({ ...p })); sourceBlock += "\n\n" + sourcesPrompt(webPassages); threadTurn.carried = webPassages.length; }
      say(`turn \u00b7 ${kindWord} \u00b7 following the conversation \u00b7 answering from turn ${threadTurn.turn}\u2026`);
      feedPush(lineEvent(tt, "Followed the conversation", { tone: "ok", note: `no search \u2014 answering from your earlier turn ${threadTurn.turn}${threadTurn.carried ? ` and the ${threadTurn.carried} source(s) it read` : ""}` }));
    } else if (follow.mode === "cold-gap") feedPush(lineEvent(tt, "Nothing earlier to follow", { tone: "info", note: "no search, and the model is not asked" }));
    const modelBarred = !!(plan || strand || aloneBarred || (genGate && !genGate.ok));
    // The reading panel's writing stage, fired once it is known who writes this turn: by:"mechanical" on a
    // Sources-only / no-model turn, so the panel never claims a model wrote the sources' own words.
    try { pvLive?.writing(modelBarred ? "mechanical" : "model"); } catch {}
    let doorRefusal = null;   // set when Gary refuses the composed turn below: the model is then not asked (the turn falls back like any refused call)
    const callModel = (msgs, opts) => {
      if (modelBarred) throw new Error("the model is barred on this turn (it never speaks alone)");
      if (doorRefusal) throw doorRefusal;
      return client.chat(m.id, msgs, opts);
    };
    // COMPUTE: the value comes from the evaluator, never the model (II.9); the model only phrases it.
    const computed = kind === "compute" ? computeEvaluate(question) : null;
    if (computed && computed.ok) sourceBlock = `The fold's evaluator computed: ${computed.text}\nThis is exact. State the result to the person in one short, natural sentence, using exactly this value and only the numbers they gave. Do not do any other arithmetic and do not show other figures or steps.`;
    // THE MESSAGE ARRAY: one system message (base + past discourse + records +
    // source block), then at most a small recency window of raw messages, then
    // the question — never the whole transcript. A short exchange is the one
    // case sent whole: the bound is a budget, and what fits inside it is
    // carried verbatim, so a continuation like "well?" has the thread to read.
    const recencyWindow = conversationVerbatim(s) ? history.length : undefined;
    // GARY'S ORDER (fold-chat-gary.js composeTurn): one system message, the recent exchange, THE QUESTION LAST and verbatim. What the
    // reply hears about the conversation rides as plain facts (Terry Gross's flow reading, fold-chat-flow.js; the pathos archons' felt
    // shape of the recent answers, fold-chat-pathos.js) — only on a turn the model may write, and each fact is read by Gary first. A fold
    // Gary REFUSES is withheld, not shipped; a prompt too big for the window the model is loaded at is shrunk, never cut in the middle.
    let flowInfo = null, feltInfo = null;
    let messages = [];
    garyDoor.drain();   // this turn's decisions start empty (a stopped or failed earlier turn leaves none behind)
    if (!modelBarred) {
      const conversational = kind === "research" || kind === "chat" || kind === "advice" || !!threadTurn;
      feltInfo = conversational ? readFelt(s.messages.slice(0, askAt), { convo: id, memo: s.pathos }) : null;
      if (feltInfo && !feltInfo.gap) s.pathos = feltInfo.memo;
      flowInfo = conversational ? cuesFor({ act: follow.act || actOf(question), felt: feltInfo?.felt || null, pathosCue: feltInfo?.cue || null, door: garyDoor }) : null;
      const materialInView = mayWriteAlone ? undefined : webPassages.length + (threadTurn ? 1 : 0) + (computed && computed.ok ? 1 : 0) + materialOf(s).length;
      const fromWeb = !!webPassages.length && !threadTurn && !(computed && computed.ok);
      // SALIENCE (docs: eval/pivot/PREREG.md Amendment 4; memory `salient-only-prompt`): the model is handed only what bears on THIS ask — verbatim excerpts of
      // the pages that do, the earlier exchange only when the ask continues the thread, a summary only of what bears on it. Verification (the Pivot) still      // runs against everything READ (webPassages is untouched). A recipe page, a language with no closed-class prior, or an ask that matches no page is
      // passed through unchanged: never worse than before.
      let promptHistory = history.slice(0, -1), promptSummary = s.summary, promptPassages = webPassages;
      // (G3) THE GATE ON THE PROMPT: an ask that does not lean on the earlier turn (fold-chat-anaphora.js) is handed none of it — not the exchange, not the summary's topic / flow / entities.
      // It is a topic change; the salience switch (off) is a separate matter and still owns the sources.
      if (follow.gate && !continuesByAnaphora(follow) && (kind === "research" || kind === "chat" || kind === "advice")) { promptHistory = []; promptSummary = salientSummary(s.summary, { continues: false, empty: FOLD.emptySummary() }); }
      if (salienceEnabled()) {
        const fwS = functionWordsOf(lang0 === "unknown" ? "en" : lang0);
        const termsS = askTerms({ question, searchQ }, fwS);
        if (termsS) {
          const exS = exchangesOf(s.messages.slice(0, askAt));
          const continuesS = continuesThread({ follow, terms: termsS, lastExchange: exS[exS.length - 1] || null });
          promptHistory = salientHistory(promptHistory, { continues: continuesS });
          promptSummary = salientSummary(s.summary, { continues: continuesS, terms: termsS, exchanges: exS, flowOf: exchangeFlow, empty: FOLD.emptySummary() });
          if (fromWeb && !webPassages.some((p) => p.recipe)) {
            const sal = salientSources(webPassages, termsS);
            if (sal.passages.length) {
              promptPassages = sal.passages;
              sourceBlock = sourcesPrompt(promptPassages);
              feedPush(lineEvent(tt, "Handed the model only what bears on the ask", { tone: "info", note: `${sal.passages.length} of ${webPassages.length} page(s), ${sal.chars} chars \u00b7 ${continuesS ? "continues the thread" : "a new topic: no earlier thread"}` }));
            }
          }
        }
      }
      const composed = garyDoor.composeTurn({
        basePrompt: turnBase, cues: flowInfo?.cues || [], summary: promptSummary, history: promptHistory, question, sourceBlock, recencyWindow,
        shrinkSource: fromWeb ? (maxChars) => sourcesPrompt(promptPassages.map((p) => ({ ...p, text: String(p.text || "").slice(0, maxChars) }))) + (webPassages.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "") : null,
      }, { model: m.id, maxTokens: 1024, material: materialInView });
      messages = composed.messages;
      if (composed.refused.length) doorRefusal = Object.assign(new Error("the prompt was withheld before it reached the model (" + composed.refused.map((f) => f.rule).join(", ") + ") \u2014 nothing was sent"), { status: 422 });
    }
    try {
      let skipModel = modelBarred, fellBack = null;
      let out = { text: "", tokens: 0 };
      // NO MODEL REACHABLE, and this turn would call one: fall back to the sources-only strand when sources were read
      // (the same way a gate refusal does); otherwise there is nothing honest to show, and the turn says why.
      if (!skipModel && m.none && genOt) {
        const why = noModelWhy({ bridgeUp: modelsUp, models, selectedId: s.model || null, page: pageState() });
        genGate = genVoid({ outputType: genOt, webPassages, failure: { kind: "no-model", message: why.text || "no model" }, question }); skipModel = true;
        feedPush(lineEvent(tt, "No model is reachable", { tone: "bad", note: "so nothing was written \u2014 the sources are not shown as the " + genOt.type }));
      } else if (!skipModel && m.none) {
        const why = noModelWhy({ bridgeUp: modelsUp, models, selectedId: s.model || null, page: pageState() });
        const fb = wantWeb && webPassages.length && (!producing || bookFound?.fold) ? snipsOf(webPassages, searchQ, foldOpts) : null;   // quoting pages is never the essay — but a book FOLD is the summary the reader asked for, so it stands when the model cannot
        if (!fb || !fb.snips.length) throw Object.assign(new Error("no model \u2014 " + (why.text || "none is available")), modelsUp ? {} : { status: 0 });
        fellBack = noModelFallbackNotice(why, { from: answerMode });
        strand = fb; skipModel = true;        feedPush(lineEvent(tt, "No model is reachable", { tone: "info", note: "so I'll show what the sources say" }));
        feedPush(lineEvent(tt, "Strung the sources' passages together", { tone: "ok", note: `${fb.snips.length} passage(s), their own words \u2014 no model` }));
      }
      // A model call that is REFUSED (the bridge's safety gate answers 403) or FAILS never ends the turn with
      // nothing when the turn has read sources: the app falls back to the Sources-only strand (no model, so no
      // gate), says why in its own words, and offers a retry. The gate's words are quoted, never paraphrased.
      const modelPlace = m.sealed ? "sealed-external" : client.isPageModel(m) ? "this tab" : "this machine";
      if (!skipModel) feedPush(beginStep(tt, "write", webPassages.length ? `Writing the answer from ${webPassages.length} source(s) \u00b7 ${m.id}` : `Writing the answer \u00b7 ${m.id}`, { verb: `Writing the answer (${m.id})`, slowAfter: 8000, slow: `waiting on ${m.id} (slow: a model on ${modelPlace} can take 10\u201320 s)` }));
      let firstToken = false;
      const pivotOn = pivotEnabled();
      // A first load of an in-tab model rides this turn's own feed: one step, with web-llm's own progress words (percent + text).
      if (!skipModel && client.isPageModel(m)) {
        let stepOpen = false, lastPct = -10;
        pageSink = (p) => {
          const pct = Math.round((Number(p?.progress) || 0) * 100);
          if (!p || p.phase === "ready") { if (stepOpen) { stepOpen = false; feedPush(endStep(tt, "load", { title: `${m.name || m.id} is ready in this tab`, tone: "ok" })); } return; }
          if (!stepOpen) { stepOpen = true; feedPush(beginStep(tt, "load", `Loading ${m.name || m.id} in this tab (WebLLM)`, { verb: "Loading the model in this tab", slowAfter: 60000, slow: "still loading \u2014 a first download takes a while, and it only happens once" })); }
          if (pct >= lastPct + 10) { lastPct = pct; feedPush(noteEvent(tt, "load", `${pct}% \u00b7 ${String(p.text || "").slice(0, 90)}`)); }
          say(`turn \u00b7 ${kindWord} \u00b7 loading the model in this tab \u00b7 ${pct}%\u2026`);
        };
      }
      if (!skipModel) try { out = await callModel(messages, {
        base: bridge, privacy: "sealed-external", audit: { run: runId },
        onToken: (t) => {
          if (!firstToken) { firstToken = true; feedPush(noteEvent(tt, "write", "the first words are coming in")); }
          if (!body.dataset.streaming) {
            body.dataset.streaming = "1";
            for (const n of body.querySelectorAll(".live-stat")) n.remove();
          }
          // THE PIVOT (docs/PIVOT.md): the model's words are a DRAFT that is read before anything is spoken, so they are never streamed to the page.
          if (!pivotOn) { if (pvLive) { pvStream += t; pvLive.wrote(pvStream); } else body.append(document.createTextNode(t)); }
          flight.stage = pivotOn ? "drafting…" : "answering…";
          if (isLive()) { if (!pivotOn) E.thread.scrollTop = E.thread.scrollHeight; E.stage.textContent = pivotOn ? "drafting\u2026 (read before it is shown)" : "answering…"; }
        },
        signal: ac.signal,
      }); } catch (modelErr) {
        if (genOt && !ac.signal.aborted) {
          // a WRITTEN OUTPUT is never answered by quoting pages: the typed gap names it, says what the turn had, and what would unblock it
          genGate = genVoid({ outputType: genOt, webPassages, failure: modelErr, question }); skipModel = true; out = { text: "", tokens: 0 };
          for (const n of [...body.childNodes]) if (n.nodeType === 3) n.remove();
          delete body.dataset.streaming;
          feedPush(endStep(tt, "write", { title: `${m.id} did not answer`, tone: "bad", note: modelErr?.status === 403 ? "the safety gate said no" : String(modelErr?.message || modelErr).slice(0, 80) }));
          say(`turn \u00b7 ${kindWord} \u00b7 the model did not answer \u00b7 nothing was written`);
        } else {
        if (ac.signal.aborted || !wantWeb || !webPassages.length || producing) throw modelErr;   // a failed WRITING turn is a failed turn (failTurn: a typed note + retry), never "from the sources, unchanged"
        const fb = snipsOf(webPassages, searchQ, foldOpts);
        if (!fb.snips.length) throw modelErr;
        fellBack = declinedFallbackNotice(modelErr, { from: answerMode });        strand = fb; skipModel = true; out = { text: "", tokens: 0 };
        for (const n of [...body.childNodes]) if (n.nodeType === 3) n.remove();   // any words the model had streamed are dropped, not shown
        delete body.dataset.streaming;
        feedPush(endStep(tt, "write", { title: `${m.id} did not answer`, tone: "bad", note: modelErr?.status === 403 ? "the safety gate said no" : String(modelErr?.message || modelErr).slice(0, 80) }));
        feedPush(lineEvent(tt, "Fell back to the sources", { tone: "ok", note: `${fb.snips.length} passage(s), their own words \u2014 no model, so no gate` }));
        say(`turn \u00b7 ${kindWord} \u00b7 the model declined \u00b7 showing the sources instead (${strand.snips.length} passage(s), no model)\u2026`);
        }
      }
      if (ac.signal.aborted) throw abortError();
      // THE REPROMPT: a draft the model ran out of room on (finish "length", or no finish reported and it stops mid-sentence) is handed back
      // and the model is asked for the rest, at most CONTINUE.maxRounds times; the pieces are joined with no word added (fold-chat-continue.js).
      let continued = 0;
      if (pivotOn && !skipModel && !strand && out && String(out.text || "").trim()) {
        while (continued < CONTINUE.maxRounds) {
          const cut = cutOff({ finish: out.finish, text: out.text });
          if (!cut.cut) break;
          say(`turn \u00b7 ${kindWord} \u00b7 the model ran out of room \u00b7 asking it to continue (${continued + 1} of ${CONTINUE.maxRounds})\u2026`);
          feedPush(lineEvent(tt, "The model ran out of room", { tone: "info", note: `asking it to continue (${continued + 1} of ${CONTINUE.maxRounds}) \u2014 ${cut.why === "length" ? "it hit its length limit" : "its reply stopped mid-sentence"}` }));
          let more;
          try { more = await callModel(continueMessages(messages, out.text), { base: bridge, privacy: "sealed-external", audit: { run: runId }, signal: ac.signal }); }
          catch (e) { if (ac.signal.aborted) throw e; break; }
          const joined = joinDraft(out.text, more.text);
          out = { ...out, text: joined.text, tokens: (out.tokens || 0) + (more.tokens || 0), finish: more.finish ?? null };
          continued++;
        }
      }
      if (!skipModel) feedPush(endStep(tt, "write", { title: `Wrote the answer \u00b7 ${m.id}`, tone: "ok", note: out.tokens ? `${out.tokens} token${out.tokens === 1 ? "" : "s"}` : "" }));
      // The live animation ends with the writing; the answer is HELD (not shown) until every sentence is checked.
      try { pvLive?.writingDone?.(); } catch {}
      if (!skipModel && wantWeb && webPassages.length && checkable(kind)) feedPush(lineEvent(tt, "Holding the answer until every sentence is checked", { tone: "info", note: "against everything read" }));
      if (isLive()) E.stage.textContent = "";
      body.classList.remove("live");
      // The fold's grounding: strip a self-citation the model invented, then
      // check the identity guard, then attribute the answer to the material the
      // conversation carries and build the record (disclosed when transparency
      // is on). The model proposes; the record decides.
      // A Sources-only turn's text IS the sources' words: it is never rewritten, scrubbed or scored.
      let text = slotTurn ? answerLine(slotTurn) : strand ? strandText(strand.snips) : ground.stripSelfCitations(out.text).text;
      // System notes about this turn ride their OWN channel (message.notices),
      // never `content`: `content` is only what the model wrote.
      const notices = [];
      if (fellBack) notices.push(fellBack);
      // A BOOK FOLD is the fold's own reading of a whole book: say so, and offer the alternative — the person can always ask for
      // what people say online instead of what the book says.
      if (bookFound?.fold) notices.push({ kind: "book", text: `I read the whole of ${bookFound.book.title} and folded it from its own words \u2014 no model wrote the fold. If you'd rather I search online and see what people say about it, just ask.` });
      // The tab's engine could not load the chosen model and answered with its small fallback: said, never hidden.
      if (out.fellBackFrom) notices.push({ kind: "fold", text: `${tabName(out.fellBackFrom)} would not load in this tab, so ${tabName(out.model)} answered instead (smaller; expect a plainer answer).` });
      // THE MODEL MAY NOT SHOW THE FOLD'S SCAFFOLDING, OR NAME A SOURCE THE PAGE DID NOT GIVE IT
      // (II.9). Source-block labels ([W1] …) are stripped from its text and the passages it pointed
      // at become real citation chips; the language is checked against the asker's; and every
      // "According to X" / "X says" / "per X" is verified against the turn's actual sources.
      const scaffold = strand ? { text, removed: 0, cited: [] } : stripScaffolding(text, webPassages);
      text = scaffold.text;
      const cited = scaffold.cited;
      let langAudit = null;
      if (text.trim() && kind !== "transform" && !strand) {
        const sl = sameLanguage(question, text, { prior: threadLang });
        langAudit = { question: sl.question.lang, reply: sl.reply ? sl.reply.lang : null, same: sl.same, restated: false };
        if (!sl.same) {
          // The reply is in another language than the question: ask the model to restate ITS OWN draft
          // in the asker's (keeping every figure and name), check again, and say so if it still differs.
          say(`turn · restating the reply in ${sl.question.name}…`);
          try {
            const rs = await callModel(restateMessages(text, sl.question.name), { base: bridge, privacy: "sealed-external", audit: { run: runId }, signal: ac.signal, temperature: 0.2 });
            const fixed = stripScaffolding(String(rs.text || "").trim(), webPassages).text.trim();
            if (fixed && sameLanguage(question, fixed, { prior: threadLang }).same) { text = fixed; langAudit.restated = true; }
            else notices.push(languageNotice(sl.question, sl.reply, { restated: true }));
          } catch (e) {
            if (ac.signal.aborted) throw e;
            notices.push(languageNotice(sl.question, sl.reply));
          }
        }
      }
      const attr = strand ? { text, removed: [], kept: [] } : checkAttributions(text, { sources: webPassages, material: materialOf(s), userText: question });
      if (attr.removed.length) { text = attr.text; const an = attributionNotice(attr.removed); if (an) notices.push(an); }
      // COMPUTE: the model only worded a value the evaluator computed. If its wording dropped the
      // result or added a figure of its own, its wording is not shown (the record carries the computed line).
      if (computed && computed.ok && text.trim()) {
        const keep = answerKeeps(text, computed);
        if (!keep.ok) {
          notices.push({ kind: "computed", text: `The model's wording ${keep.hasResult ? "added a figure of its own" : "did not state the computed result"}, so it is not shown. The fold computed: ${computed.text}.` });
          text = "";
        }
      }
      // A content-refusal from the model ("I cannot / I do not have access to
      // personal information…") is a FAILURE, not an answer. The fold's job is
      // to report what the sources say; a model's policy reflex must never be
      // shown as the result. Replace it with the fold's own honest line.
      if (!strand && !genOt && isRefusal(text)) {
        notices.push({
          kind: "refusal",
          text: webPassages.length
            ? "The model declined to answer from the sources it was given. This is a model-side refusal, not a finding — the sources were read; try again or rephrase."
            : "I couldn't reach any sources for this, and I won't answer from memory. Try rephrasing, or attach material you already have.",
          modelSaid: text.slice(0, 400),
        });
        text = "";   // the fold shows its own line; the refusal is not an answer and is not kept as one
      }
      // A WRITTEN OUTPUT is judged as the thing it was asked for before anything is shown: a stub, a refusal, a question back, a how-to-write guide or a draft that never mentions the topic is a void.
      if (genOt && !genGate && !strand && !skipModel) { const gj = genVoid({ outputType: genOt, webPassages, modelResult: { text, finish: out.finish }, hasMaterial: materialOf(s).length > 0, question }); if (!gj.ok) { genGate = gj; text = ""; } }
      const bad = text && !strand ? memory.ungroundedIdentity(text, { readerName, facts: s.facts || {} }) : null;
      if (bad) notices.push({ kind: "identity", text: memory.identityCorrection(bad, { readerName }) });
      if (originLate) { try { await raceAbort(originLate, ac.signal); } catch (e) { if (ac.signal.aborted) throw e; } }   // E2 L9: joined before anything reads the draft
      // THE REC LOOP (reframe). Every sentence is tried against everything read (fold-chat-falsify.js). A sentence no source
      // states, one a source contradicts, or one the swap test shows loose sends the turn BACK: SIG searches again with the
      // claim itself as the query, the cross-reference re-runs on the wider ground, and SYN restates only the sentences still
      // failing, from what was found. A restatement replaces a sentence only if it then holds; otherwise the sentence stays
      // and is marked. At most two laps, inside a time budget. Fast effort skips it.
      let recLoop = null, recPending = false, recRunLaps = null;
      if (!strand && wantWeb && webPassages.length && text.trim() && checkable(kind) && !(computed && computed.ok) && effort !== "fast" && !liveHit) {
        recLoop = { passes: [], cleared: false };
        const asPass = (ps) => ps.map((p) => ({ text: p.text, url: p.url || p.source, ref: p.ref }));
        const t0 = Date.now(), BUDGET = effort === "deep" ? 45000 : 25000;
        const stepFn = (st) => { feedPush(eventsForStep(tt, st)); try { pvLive?.step(st); } catch {} };
        const textBefore = text;
        const deferRec = (() => { try { return localStorage.getItem("fold-chat:e2recdefer") !== "off"; } catch { return true; } })();
        const runLaps = async (deferred) => {
        for (let lap = 1; lap <= 3; lap++) {
          const sents = claimSentences(text);
          const fz = falsifyAnswer(sents, asPass(webPassages));          const failing = fz.claims.filter((c) => FAILING.has(c.verdict)).slice(0, 3);
          if (!failing.length) {
            recLoop.cleared = true; recLoop.after = fz.summary;
            feedPush(lineEvent(tt, lap === 1 ? "Tried to break every sentence \u2014 none broke" : "Every sentence holds now", { tone: "ok", note: `${fz.summary.corroborated} corroborated \u00b7 ${fz.summary.held} on one source` }));
            break;
          }
          recLoop.after = fz.summary;
          if (lap === 3) break;   // two laps back, then the third check is the verdict
          if (deferred === true) { recPending = true; recLoop.pending = true; feedPush(lineEvent(tt, `\u2217 ${failing.length} sentence${failing.length === 1 ? "" : "s"} broke on the first check`, { tone: "warn", note: failing.map((c) => `s${c.i + 1} ${c.verdict}`).join(" \u00b7 ") + " \u2014 marked now; I'll go back to search after the answer is shown" })); return; }
          if (lap >= 2 && (text === textBefore || deferred === "after") && (() => { try { return localStorage.getItem("fold-chat:e2rec") !== "off"; } catch { return true; } })()) { feedPush(lineEvent(tt, "Stopped going back", { tone: "info", note: "the last lap changed no sentence, and another would ask the same of the same pages — the sentences still failing are marked" })); break; }
          if (Date.now() - t0 > BUDGET) { feedPush(lineEvent(tt, "Stopped going back", { tone: "info", note: "out of time \u2014 the sentences still failing are marked" })); break; }
          const pass = { lap, before: fz.summary, failing: failing.map((c) => ({ i: c.i, s: c.s, verdict: c.verdict, ...routeOf(c) })), added: 0, restated: [] };
          recLoop.passes.push(pass);          feedPush(lineEvent(tt, `\u25c9 Reframe, lap ${lap}: ${failing.length} sentence${failing.length === 1 ? "" : "s"} broke`, { tone: "warn", note: failing.map((c) => `s${c.i + 1} ${c.verdict}`).join(" \u00b7 ") + " \u2014 going back to search" }));
          try { pvLive?.loop?.(lap, pass.failing); } catch {}
          // INS first: the whole pages already read, recalled for each failing claim (shadow → a new impression)
          const fresh = [];
          for (const f of pass.failing) for (const p of reImpress(f.s, turnPages)) fresh.push(p);
          pass.reImpressed = fresh.map((p) => ({ url: p.url, kept: p.shadow.kept, chars: p.shadow.chars, segments: p.shadow.segments.length, recalled: p.shadow.recalled }));
          if (fresh.length) { webPassages = [...webPassages, ...fresh]; try { pvLive?.passages(fresh); } catch {} }
          feedPush(lineEvent(tt, fresh.length ? `Looked again in the pages already read \u2014 ${fresh.length} new impression${fresh.length === 1 ? "" : "s"}` : "The pages already read hold nothing more about it", { tone: fresh.length ? "ok" : "info", note: fresh.length ? fresh.map((p) => `${p.shadow.segments.length} sentence(s) recalled from ${String(p.ref || "").split(" \u2014 ")[0]}`).join(" \u00b7 ").slice(0, 180) : `recalled each claim against ${turnPages.length} page shadow(s)` }));
          const fzI = fresh.length ? falsifyAnswer(sents, asPass(webPassages)) : fz;
          const stillI = new Set(fzI.claims.filter((c) => FAILING.has(c.verdict)).map((c) => c.i));
          pass.failing.forEach((f) => { f.afterIns = stillI.has(f.i) ? "still failing" : "holds"; });
          if (!stillI.size) { feedPush(lineEvent(tt, "Found it in the pages already read", { tone: "ok", note: "no new search needed" })); continue; }
          say(`turn \u00b7 reframe lap ${lap} \u00b7 searching again for ${failing.length} sentence(s)\u2026`);
          const have = new Set(webPassages.map((p) => p.url || p.source));
          const added = [];
          for (const f of pass.failing) {
            if (!f.query || f.afterIns === "holds") continue;
            try {
              const w2 = await raceAbort(web.searchWeb(f.query, { onStep: stepFn, effort: "fast", read: 2, memo: pageMemo, fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal) }), ac.signal);
              for (const p of w2.passages || []) { const u = p.url || p.source; if (u && !have.has(u)) { have.add(u); added.push(p); } }
              if (Array.isArray(w2.pages)) for (const pg of w2.pages) if (!turnPages.some((x) => x.url === pg.url)) turnPages.push(pg);
              if (Array.isArray(w2.trace)) webTrace = [...(webTrace || []), ...w2.trace.map((x) => ({ ...x, lap }))];
            } catch (e) { if (ac.signal.aborted) throw e; }
          }
          pass.added = added.length;
          if (added.length) { webPassages = [...webPassages, ...added]; try { pvLive?.passages(added); } catch {} }
          feedPush(lineEvent(tt, added.length ? `Read ${added.length} more source${added.length === 1 ? "" : "s"}` : "Found nothing new", { tone: added.length ? "ok" : "info", note: pass.failing.map((f) => `\u201c${f.query}\u201d`).join(" \u00b7 ").slice(0, 180) }));
          // the cross-reference again on the wider ground; only what still fails is restated
          const fz2 = falsifyAnswer(sents, asPass(webPassages));
          const still = fz2.claims.filter((c) => FAILING.has(c.verdict)).slice(0, 3);
          if (!still.length || skipModel || m.none || deferred === "after") continue;   // E2 L2b: after the answer is shown, laps only search and re-check; they never restate
          for (const c of still) {
            // SELECT the witness, don't generate it: a "weak" claim already has a source sentence that states it (the swap
            // only failed to discriminate) — quote that sentence verbatim rather than asking a 2B model to reproduce it
            const wsel = (c.witnesses || []).find((x) => x.verdict === "states" && x.sentence && !x.clauseSupport);
            if (wsel) { const t2 = replaceSentence(text, c.s, String(wsel.sentence).trim()); if (t2 !== text) { text = t2; pass.restated.push({ i: c.i, from: c.s, to: String(wsel.sentence).trim(), verdict: "held", by: "witness" }); continue; } }
            const ctx = pickPassages(c.s, webPassages, 4);
            if (!ctx.length) { pass.restated.push({ i: c.i, kept: true, why: "nothing read is about it" }); continue; }            try {
              const rs = await callModel(restateClaimMessages(c.s, ctx), { base: bridge, privacy: "sealed-external", audit: { run: runId }, signal: ac.signal, temperature: 0.1 });
              const ns = ground.stripSelfCitations(String(rs.text || "")).text.trim().replace(/\s+/g, " ");
              if (!ns || /^none\.?$/i.test(ns) || ns.length > c.s.length * 2.5) { pass.restated.push({ i: c.i, kept: true, why: "the sources state no version of it" }); continue; }
              const v = falsifyAnswer([ns], asPass(webPassages)).claims[0]?.verdict;
              if (v === "corroborated" || v === "held") { const t2 = replaceSentence(text, c.s, ns); if (t2 !== text) { text = t2; pass.restated.push({ i: c.i, from: c.s, to: ns, verdict: v }); continue; } }
              pass.restated.push({ i: c.i, kept: true, why: "the restatement did not hold either" });
            } catch (e) { if (ac.signal.aborted) throw e; }
          }
          const rn = pass.restated.filter((x) => x.to).length;
          if (rn) feedPush(lineEvent(tt, `Restated ${rn} sentence${rn === 1 ? "" : "s"} from what was found`, { tone: "ok", note: "the rest of the answer is unchanged" }));
        }
        if (text !== textBefore && pvStream) pvStream = text;
        if (!recLoop.passes.length && recLoop.cleared) recLoop.firstTry = true;
        };
        if (deferRec) { await runLaps(true); if (recPending) recRunLaps = async () => { recPending = false; recLoop.pending = false; await runLaps("after"); }; }
        else await runLaps(false);
      }
      // THE CONVERSATION IS A SOURCE, ALWAYS (the watchmaker's gear). `materialOf` holds "the dialogue is never
      // cited as evidence" — this overturns that: the recent exchanges ride into the material on EVERY turn, not
      // only a routed follow-up, so the GATE decides what is spoken rather than the router. A sentence supported by
      // neither the web nor the conversation is withheld; a follow-up is witnessed against the earlier answers
      // (fixing "none of it could be spoken" when the model quotes the thread); and a world question is not
      // hijacked — the thread can only ever ADD a witness, never stop the search. Bounded so a long chat fits.
      const convoMaterial = (() => {
        const prior = askAt > 0 ? s.messages.slice(0, askAt) : [];
        const pairs = [];
        let ask = null, n = 0;
        for (const m of prior) {
          if (m?.role === "user" && String(m.content || "").trim()) ask = String(m.content).replace(/\s+/g, " ").trim();
          else if (m?.role === "assistant" && String(m.content || "").trim() && m.mode !== "agent") { n++; pairs.push({ turn: n, ask, text: String(m.content).replace(/\s+/g, " ").trim().slice(0, 3000) }); }
        }
        return pairs.slice(-4).map((p) => ({ ref: "earlier in this chat", source: "turn " + p.turn, text: (p.ask ? "You asked: " + p.ask + "\n" : "") + "I answered: " + p.text }));
      })();
      const material = [
        ...materialOf(s),        // a transform's material IS the person's own text: it is grounded against itself, not the web
        ...(kind === "transform" ? [{ ref: "your message", source: "your message", text: question }] : []),
        ...webPassages.map((p) => ({ ref: p.ref, source: p.source, text: String(p.text || "").slice(0, 12000) })),
        ...convoMaterial,        // the conversation is a source like any other (the gear)
        // a thread-grounded reply is also held against the one earlier turn it explicitly answers from
        ...(threadTurn ? [{ ref: "earlier in this chat", source: "turn " + threadTurn.turn, text: threadTurn.answer }] : []),
      ];
      // LIVE DATA: pages were read but nothing the model said is established by them (a weather page
      // is a snapshot, not a feed). The model's guess is not shown; the typed 'live' gap is drawn.
      let liveDrop = false;
      if (liveHit && !strand && webPassages.length && text.trim() && !ground.coverage(text, material).grounded) { liveDrop = true; text = ""; }
      // THE PIVOT (docs/PIVOT.md; memory `the-pivot`): the model's text is a DRAFT. It is read with the language's grammar into a record of
      // what each sentence says and which checks it passed, and what is SPOKEN is realised from the sentences that survived. A sentence
      // that failed a check is withheld, never reworded. A slot turn and a Sources-only turn have no model text, so there is nothing to read.
      let pivotRes = null;
      if (pivotOn && !strand && !slotTurn && text.trim()) {
        const readLang = detectLang(text, { prior: lang0 === "unknown" ? null : lang0 }).lang;
        pivotRes = pivotText({ draft: text, ask: question, material, requireGrounding: !!wantWeb || !!threadTurn, computed: computed && computed.ok ? computed.text : null, read: readLang === "unknown" ? "en" : readLang, kind, experiencer: { who: m.id, read: `chat-draft:${runId}` } });
        const vp = verifyPivot(pivotRes, text);
        if (!vp.ok) { console.error("[fold-chat] the pivot spoke a word the draft did not carry — a bug; the draft is withheld:", vp.bad.slice(0, 3)); pivotRes = { ...pivotRes, text: "", gap: { kind: "pivot_unverified", why: "the realised text did not re-derive from the draft" } }; }
        const gl = noteGates(pivotRes, { verified: vp.ok });
        pivotRes.gates = gl.gates;
        if (continued) pivotRes.continued = continued;
        feedPush(lineEvent(tt, pivotRes.skipped ? "The reply was not read" : "Read the draft before speaking", { tone: pivotRes.gap ? "bad" : pivotRes.skipped ? "info" : "ok", note: [pivotLine(pivotRes), pivotRes.skipped ? "" : gatesLine(gl.report)].filter(Boolean).join(" \u00b7 ") }));
        if (pivotRes.skipped) notices.push({ kind: "fold", text: `The fold has no grammar for ${pivotRes.read}, so this reply was not read before being shown — it is exactly what the model wrote.` });
        else {
          text = pivotRes.text;
          if (pivotRes.gap && genOt) {
            genGate = genVoid({ outputType: genOt, webPassages, failure: { kind: "withheld" }, question }); text = "";
            feedPush(lineEvent(tt, "Nothing the model wrote could be spoken", { tone: "bad", note: "drawing the gap, not the sources as the " + genOt.type }));
          } else if (pivotRes.gap) {
            // Nothing the model wrote could be traced to what was read. If SOURCES were read, the chat's own rule for "the model cannot be used
            // on this turn" applies: the sources' own sentences, verbatim, no model (the strand). Otherwise the gap is said, never filled.
            const rel = webPassages.length && !strand ? relevantPassages(webPassages, searchQ, functionWordsOf(readLang === "unknown" ? "en" : readLang)) : [];   // only pages whose TITLE shares a content word with the ask
            const fb = rel.length ? snipsOf(rel, searchQ) : null;
            if (fb && fb.snips.length) {
              strand = fb; text = strandText(fb.snips);
              // The reason is self-describing: the model DID answer, its sentences just could not be traced to
              // what was read. A fallback without this would print the "no model reachable" default (a mislabel).
              fellBack = { kind: "fold", reason: "untraceable", gate: "the model's words could not be traced to what was read", text: "None of the model's sentences could be traced to what was read, so the sources' own words are shown instead.", fellBackFrom: answerMode };
              notices.push(fellBack);
              feedPush(lineEvent(tt, "Fell back to the sources", { tone: "ok", note: `${fb.snips.length} passage(s), their own words \u2014 nothing the model wrote was spoken` }));
            } else notices.push({ kind: "fold", text: "The draft was read and none of it could be spoken (" + pivotRes.gap.why + "), so nothing is shown." });
          }
        }
      }
      // RELEVANCE (the answer must ADDRESS the turn it is grounded in). The Pivot above checks that every sentence is
      // SUPPORTED; this checks that a reply grounded in a NAMED earlier answer actually talks about it — a supported
      // sentence about the WRONG turn or the wrong topic is not an answer (the long-chat traps: "quote your second
      // answer" quoting the fourth; "combine everything" going meta). It runs ONLY where the turn names an earlier
      // answer, so a causal web answer is never withheld; it does not fact-check; and its fallback is the ground
      // itself — the referenced turn's own words, unchanged.
      if (threadTurn && text.trim() && !strand && kind !== "generate" && kind !== "compose" && kind !== "transform" && kind !== "code") {
        const rel = addressesThread(text, threadTurn);
        if (!rel.ok) {
          const answers = Array.isArray(threadTurn.answers) && threadTurn.answers.length ? threadTurn.answers : [{ answer: threadTurn.answer }];
          const own = answers.map((a) => String(a.answer || "")).join(" ").trim();
          const fb = own ? snipsOf([{ ref: "earlier in this chat", source: "turn " + threadTurn.turn, text: own }], question) : null;
          if (fb && fb.snips.length) { strand = fb; text = strandText(fb.snips); }
          else text = "";
          notices.push({ kind: "fold", text: fb && fb.snips.length ? "The model's reply did not address the turn you asked about, so that turn's own words are shown instead." : "The model's reply did not address the turn you asked about, so no answer is shown." });
          feedPush(lineEvent(tt, "The reply did not address your question", { tone: "info", note: fb && fb.snips.length ? "showing the earlier answer's own words" : "no answer shown" }));
        }
      }
      // WHERE IT CAME FROM — ALWAYS, MECHANICALLY (user, 2026-10-06; fold-chat-provenance.js). The answer above came from the model; HOW we know it is not the model's to say. A SECOND model call is
      // asked only to POINT: copy the sentence from the sources that says this. The app checks that sentence is in a page character for character (the claimed source is a hint), snips the
      // source's own slice, and narrates around it in its own words ("I checked this on Wikipedia, but I treat it as an index to primary sources, so I verified it on …"). No provenance
      // sentence is ever model-written; a pointer the model made up is rejected and the narration says no source sentence could be found.
      let provenance = null;
      const provWanted = provenanceEnabled() && wantWeb && webPassages.length && !strand && !slotTurn && !modelBarred && text.trim() && kind !== "generate" && kind !== "compose";
      const deferProv = provWanted && (() => { try { return localStorage.getItem("fold-chat:e2defer") !== "off"; } catch { return true; } })();
      const provenanceWork = async () => {
      if (provWanted) {
        say(`turn \u00b7 ${kindWord} \u00b7 asking the model to point at its source\u2026`);
        feedPush(lineEvent(tt, "Asked the model where it got that", { tone: "info", note: "a second call, only to point at a sentence in the pages I read \u2014 I check it and write the line myself" }));
        try {          const fwP = functionWordsOf(lang0 === "unknown" ? "en" : lang0);
          const pointModel = async (msgs) => (await callModel(msgs, { base: bridge, privacy: "sealed-external", audit: { run: runId, purpose: "provenance-pointer" }, signal: ac.signal, temperature: 0, maxTokens: 220 })).text;
          let pr = await provenanceFor({
            answer: text, passages: webPassages, fw: fwP,
            preferRefs: pivotRes ? usedRefs({ pivot: pivotRes }) : null,
            point: pointModel,
          });
          // Only an encyclopedia verified it ("unconfirmed"): go and find a PRIMARY page that says the same (fold-chat-primary.js). Search, read and model are the chat's own, injected.
          const lead = pr.pointers.find((p) => p && p.ok);
          if (lead && lead.tier === "index") {
            say(`turn \u00b7 ${kindWord} \u00b7 looking for a primary page that says the same\u2026`);
            const fetchImpl = withSignal(outbound.auditedFetch("web search", runId), ac.signal);
            const idxPassage = pr.ps[lead.index];
            const found = await findPrimary({
              claim: pr.claim, sentence: String(idxPassage.text).slice(lead.start, lead.end), indexHost: lead.host, indexText: idxPassage.text, indexUrl: null, fw: fwP,
              search: async (q) => (await web.search("web", q, 0, { fetchImpl })).results,
              readPage: (u) => web.readText(u, { memo: pageMemo, fetchImpl }),
              point: pointModel,
            });
            feedPush(lineEvent(tt, found.passages.length ? "Verified it on a primary page" : "No primary page said it", { tone: found.passages.length ? "ok" : "info", note: found.trail.map((t) => `${t.host || "search"}: ${t.verdict}${t.why ? " (" + t.why + ")" : ""}`).join(" \u00b7 ").slice(0, 400) }));
            pr = mergeProvenance(pr, found, { indexHost: lead.host });
          }
          provenance = pr.stored;
          feedPush(lineEvent(tt, pr.stored && pr.stored.verified ? "Verified where it came from" : "Could not verify a source sentence", { tone: pr.stored && pr.stored.verified ? "ok" : "warn", note: pr.stored && pr.stored.verified ? `${pr.stored.verified} source${pr.stored.verified === 1 ? "" : "s"} \u00b7 ${pr.stored.pointers.map((p) => p.host).join(", ")} \u00b7 ${pr.calls} model call${pr.calls === 1 ? "" : "s"}` : String(pr.stored?.why || "none") }));
        } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "The source check failed", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); }
      }
      };
      if (!deferProv) await provenanceWork();   // E2 L1: with the flag on, this runs AFTER the checked answer is on the page (below)
      // The app-authored words of a turn the model may not answer alone (a fixed line, or "no sources for this kind of ask").
      let primaryNotice = null;
      if (primaryAsk && !ac.signal.aborted) {        say(`turn \u00b7 ${kindWord} \u00b7 looking for a primary page that says it\u2026`);
        feedPush(lineEvent(tt, "Looking for a primary page", { tone: "info", note: `for the answer on turn ${primaryAsk.turn || "?"} \u00b7 \u201c${primaryAsk.claim.slice(0, 80)}\u201d` }));
        try {
          const fwP = functionWordsOf(lang0 === "unknown" ? "en" : lang0);
          const fetchImpl = withSignal(outbound.auditedFetch("web search", runId), ac.signal);
          const found = await findPrimary({
            claim: primaryAsk.claim, sentence: primaryAsk.claim, fw: fwP,
            search: async (q) => (await web.search("web", q, 0, { fetchImpl })).results,
            readPage: (u) => web.readText(u, { memo: pageMemo, fetchImpl }),
            point: async (msgs) => (await callModel(msgs, { base: bridge, privacy: "sealed-external", audit: { run: runId, purpose: "primary-pointer" }, signal: ac.signal, temperature: 0, maxTokens: 220 })).text,
          });
          for (const q of (found.queries || [])) feedPush(lineEvent(tt, "Searched the web", { tone: "info", note: `searching for \u201c${String(q).slice(0, 90)}\u201d` }));
          for (const t of (found.trail || [])) if (t.url) surfedUrls.push(t.url);
          const prim = (found.pointers || []).filter((p) => p && p.ok);
          feedPush(lineEvent(tt, prim.length ? "Verified it on a primary page" : "No primary page said it", { tone: prim.length ? "ok" : "info", note: (found.trail || []).slice(0, 6).map((t) => `${t.host || "?"}: ${t.verdict}`).join(" \u00b7 ") }));
          if (prim.length) {
            const pr = mergeProvenance({ pointers: [], ps: [], claim: primaryAsk.claim, calls: 0 }, found, {});
            provenance = pr.stored;
            primaryNotice = `I looked for a primary page for the answer on turn ${primaryAsk.turn || "?"}.`;
          } else {
            const hostsTried = [...new Set((found.trail || []).map((t) => t.host).filter(Boolean))].slice(0, 6);
            primaryNotice = `I looked for a primary page that says \u201c${primaryAsk.claim.slice(0, 120)}\u201d${hostsTried.length ? ` (${hostsTried.join(", ")})` : ""}, and none of the pages I could read said it. I would rather tell you that than hand you something that only looks like a source.`;
          }
        } catch (e) { if (ac.signal.aborted) throw e; primaryNotice = "The search for a primary page failed, so I have nothing to show for it."; feedPush(lineEvent(tt, "The primary-page search failed", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); }
      }
      // THE DISCOURSE WATCHER, POST: lay what this turn DID against what PRE expected (flags are shown, never repaired) and leave the baton for the next watcher.
      let discourseWatch = null;
      try {
        const tiers = ((provenance || srcRecall?.provenance)?.pointers || []).map((p) => p.tier);
        const best = tiers.includes("primary") ? "primary" : tiers.includes("origin") ? "origin" : tiers[0] || null;
        const aw = watchPost({ ask: said, prior: askAt > 0 ? s.messages.slice(0, askAt) : [], pre: watcherPre, reads: surfedUrls.length ? surfedUrls : webPassages.map((p) => String(p.url || p.source || "")).filter(Boolean), setAside: asideUrls, events: turnEvents, passages: webPassages, spoken: text, reached: !!((provenance && provenance.verified) || srcRecall), tier: best });
        discourseWatch = { relation: aw.relation, want: aw.want, flags: aw.flags.map((f) => f.flag), baton: aw.baton, ...(aw.detail ? { detail: aw.detail } : {}), ...(aw.appAnswered ? { appAnswered: true } : {}) };
        if (aw.flags.length) feedPush(lineEvent(tt, "Discourse check", { tone: "warn", note: aw.flags.map((f) => f.flag.replace(/_/g, " ")).join(", ") + " \u2014 this turn read the conversation differently from how it answered" }));
      } catch (e) { /* the watcher is an aid, never a reason to lose a turn */ }
      if (!provenance && srcRecall && srcRecall.provenance) provenance = srcRecall.provenance;   // the same source line, drawn again under this turn
      if (aloneBarred) { const at = follow.mode === "cold-gap" ? { notice: follow.missing ? missingAnswerNotice(follow.missing) : coldFollowUpNotice() } : recall ? { notice: { kind: "alone", text: recall.text } } : srcRecall ? { notice: { kind: "alone", text: srcRecall.text } } : primaryNotice ? { notice: { kind: "alone", text: primaryNotice } } : aloneTurn(noLookup ? "nolookup" : kind, genOt && !noLookup ? { outputType: genOt, hasMaterial: materialOf(s).length > 0, question } : undefined); if (at.void && !genGate) genGate = { ok: false, void: at.void, notice: { kind: "gen-void", text: at.notice?.text || at.void.note }, fallbackAllowed: false }; if (at.notice && !at.void) notices.push(at.notice); }
      if (threadTurn && text.trim()) { const tn = threadNotice(threadTurn); notices.push(threadTurn.carried ? { ...tn, text: tn.text.replace(/No web source was used[^.]*\./, `No new search was made; it used the ${threadTurn.carried} source(s) that turn read, and is checked against them.`) } : tn); }
      { const cn = carryNotice(follow, s.messages.filter((x) => x.role === "assistant").length + 1); if (cn) notices.push(cn); }   // what the pronoun was read as: the person may refuse it (fold-chat-minds.js)
      if (!text.trim() && !notices.length && !skipModel && !liveDrop && !genGate) notices.push(emptyNotice({ tokens: out.tokens, model: m.id }));      const turn = s.messages.filter((x) => x.role === "assistant").length + 1;
      const lastUser = [...s.messages].reverse().find((x) => x.role === "user");
      // Every turn but a greeting carries a grounding record — the fold is
      // always grounded, and the material is ONLY attachments, pasted
      // documents, and web passages. The conversation is never material.
      // A strand is never SCORED: its words are the sources', not a claim of ours (turnRecord gets an empty answer).
      const record = recordable(kind) ? ground.turnRecord(strand ? "" : text, material, { turn, question: lastUser?.content || "", model: m.id, sealed: !!m.sealed, effort }) : null;
      if (record && webTrace) record.web = webTrace;
      // what this turn read, kept (clipped) so a follow-up can use and cite it without searching again
      if (record && webPassages.length) record.passages = webPassages.slice(0, 8).map((p) => ({ ref: p.ref, source: p.source, url: p.url, title: p.title, domain: p.domain, text: String(p.text || "").slice(0, 3000), shadow: p.shadow ? { chars: p.shadow.chars, hash: p.shadow.hash, segments: p.shadow.segments } : undefined }));   // 3000 = IMPRESSION_BUDGET, so a claim's support span is never cut off the stored text; the shadow maps a span back to the page (impression.js originalSpan)
      if (record && recLoop) {
        record.loop = recLoop;
        const lp = recLoop.passes.length, S = recLoop.after || {};        record.process = record.process || [];
        recLoop.processLine = recLoop.pending ? `reframe \u00b7 the first check broke ${(S.unsupported || 0) + (S.contested || 0) + (S.weak || 0)} sentence(s), marked; going back for more sources after the answer is shown` : lp ? `reframed · went back ${lp} lap${lp === 1 ? "" : "s"} · ${recLoop.passes.reduce((n, p) => n + p.added, 0)} more source(s) read · ${recLoop.passes.reduce((n, p) => n + p.restated.filter((x) => x.to).length, 0)} sentence(s) restated · ${recLoop.cleared ? "every sentence holds" : `${(S.unsupported || 0) + (S.contested || 0) + (S.weak || 0)} still failing, marked`}` : `reframe · every sentence held on the first try`;
      }
      if (record && bookFound) record.book = { title: bookFound.book.title, author: bookFound.book.author, translator: bookFound.book.translator, via: bookFound.book.via, paras: bookFound.paras, chars: bookFound.chars, names: bookFound.names, focal: bookFound.focal, matched: bookFound.matched, chapters: bookFound.chapters, used: bookFound.passages.length, scenes: bookFound.passages.map((p) => ({ ref: p.ref, url: p.url, place: p.bookPlace, text: p.text })) };
      // Do the read pages agree on the answer's figure? (fold-chat-present.js — it decides how the answer is drawn)      if (record && !strand && text.trim() && webPassages.length) { try { const ag = agreementOf(text, webPassages); if (ag) record.agreement = ag; } catch {} }
      // Sentences the gate could not check because they are in another language than every source: a typed note, never a silent miss
      // (the gate compares wording, wording cannot cross a language, and the fold does not translate or call the sentence wrong).
      if (record && record.gaps && record.gaps.length) notices.push({ kind: "language-gap", text: ground.languageGapNote(record.gaps) });
      // What Gary, Terry Gross and the pathos archons did on this turn — rules, counts and the speech act, never the prompt's own words.
      { const decisions = garyDoor.drain();
        if (record) {
          if (decisions.length) record.gary = decisions;
          if (flowInfo) record.flow = { act: flowInfo.act, move: follow.kind === "move" || undefined, cues: flowInfo.cues.map((c) => c.from), ...(flowInfo.dropped.length ? { dropped: flowInfo.dropped } : {}) };
          if (feltInfo) record.pathos = { condition: feltInfo.condition, gap: feltInfo.gap || undefined, experiencer: feltInfo.experiencer?.who };
        } }
      // A creative turn (a poem, a story, an essay asked for) has no claims to
      // check: it keeps its search and its sources, but nothing of it is scored
      // — no void, no ✱, nothing recorded as "not supported by the material".
      if (record && !checkable(kind)) {
        if (kind === "generate") record.creative = true;
        record.noClaims = noClaimsLabel(kind) || "no claims checked";
        record.unsupported = { numbers: [], names: [] };
        record.ungrounded = [];
        record.line = `On record · turn ${turn} · ${kind === "generate" ? "creative" : kind} · no claims checked`;
      }
      if (record) record.nSources = webPassages.length + materialOf(s).length + (threadTurn ? 1 : 0);
      if (record && primaryNotice) record.noClaims = "looked for a primary page \u2014 the words of this turn are the app's, no model wrote them";
      if (record && srcRecall) record.noClaims = srcRecall.fromBaton ? "read back from the watcher's note \u2014 no search, no model wrote this turn" : `read back from turn ${srcRecall.turn} \u2014 no search, no model wrote this turn`;
      if (record && threadTurn) record.answeredFrom = { turn: threadTurn.turn, askIndex: threadTurn.askIndex, answerIndex: threadTurn.answerIndex };
      if (record && follow.kind !== "standalone") record.followed = { kind: follow.kind, said, searched: follow.search || null, carried: follow.carried || [], topic: follow.topic || null };
      if (record && recall) {
        record.noClaims = `read back from the record at ${recall.address} \u2014 the fold's own earlier words, unchanged; no model wrote this and nothing was searched`;
        record.unsupported = { numbers: [], names: [] }; record.ungrounded = [];
        record.line = `On record \u00b7 turn ${turn} \u00b7 read back from turn ${recall.turn} \u00b7 no model, no search`;
      }
      if (record && strand) {
        record.authored = "sources"; record.answerMode = slotTurn ? answerMode : "snips";
        record.noClaims = "the sources' own words, unchanged \u2014 no model wrote this, so nothing is scored";
        record.unsupported = { numbers: [], names: [] }; record.ungrounded = [];
        record.line = slotTurn ? `On record \u00b7 turn ${turn} \u00b7 one fact asked for \u00b7 answered from the source's own sentence \u00b7 no model` : `On record \u00b7 turn ${turn} \u00b7 sources only \u00b7 ${strand.snips.length} passage(s) quoted`;
        record.snipsN = strand.snips.length;
        if (slotTurn) record.answerTurn = answerRecordNote(slotTurn);
        if (fellBack) record.fellBackFrom = fellBack.fellBackFrom;
      } else if (record) {
        record.answerMode = "facing";
        // RECIPE CARDS: a page that declares a recipe is shown as its own card (verbatim, credited, linked);
        // the model was told not to retype it (CARD_PROMPT). The void stands down when cards were shown.
        const cards = recipeSnips(webPassages);
        if (cards.length) record.snips = cards;
      }
      if (record && computed && computed.ok) record.computed = { expr: computed.expr, value: computed.valueText, text: computed.text, kind: computed.kind, by: "the fold's evaluator" };
      if (record && cited.length) record.cited = cited;
      if (record && langAudit) record.language = langAudit;
      if (record && attr.removed.length) record.attributionsRemoved = attr.removed.slice(0, 8).map((r) => ({ name: r.name, reason: r.reason }));
      // The PROCESS this turn ran (disclosed in the process panel) — what the
      // fold DID, not what it grounded: classify → search → read → write → check.
      if (record) {
        record.kind = kind;
        record.process = [
          `classified · ${kindWord}`,
          `effort · ${web.EFFORT_LEVELS.find((l) => l.key === effort)?.label || effort} — ${web.EFFORT_LEVELS.find((l) => l.key === effort)?.note || ""}`,
          wantWeb
            ? (webPassages.length ? `searched the web · read ${webPassages.length} source(s)` : `searched the web · nothing readable`)
            : `no search · ${kind === "smalltalk" ? "greeting" : kind === "compute" ? "computed by the fold's evaluator" : kind === "transform" ? "your own text is the material" : kind === "code" ? "programming question" : kind === "conversation-ref" ? "following the conversation" : "personal writing"}`,
          slotTurn ? answerProcessLine(slotTurn) : skipModel ? `no model call \u00b7 ${strand ? "answer mode: Sources only \u2014 the answer is the sources' own passages" + (strand.dropped.length ? ` (${strand.dropped.length} candidate(s) failed verification and were dropped)` : "") : plan ? (plan.gap === "live" ? "a live-data ask with nothing reachable" : "no source was reached \u2014 the model never speaks alone") : "this kind of turn has no source, and the model never speaks alone"}` : `wrote the answer \u00b7 ${m.sealed ? "sealed-external" : "local"}`,
          ...(follow.kind !== "standalone" ? [follow.mode === "thread" ? `followed the conversation \u00b7 no search \u00b7 answered from turn ${follow.thread.turn}` : follow.mode === "cold-gap" ? "a follow-up with nothing earlier to follow \u00b7 no search, no model" : `followed the conversation \u00b7 ${follow.kind} \u00b7 searched \u201c${String(follow.search || "").slice(0, 80)}\u201d`] : []),
          ...(computed && computed.ok ? [`computed · ${computed.text} (the fold's evaluator, not the model)`] : []),
          ...(scaffold.removed ? [`scaffolding · ${scaffold.removed} source label(s) removed from the model's text${cited.length ? ", " + cited.length + " shown as citations" : ""}`] : []),
          ...(langAudit ? [`language · asker ${langAudit.question}, reply ${langAudit.reply || "unknown"}${langAudit.same ? " — same" : langAudit.restated ? " — the model restated it" : " — differs, not fixed"}`] : []),
          ...(attr.removed.length ? [`attribution · removed ${attr.removed.length} unverifiable source name(s): ${[...new Set(attr.removed.map((r) => r.name))].slice(0, 3).join(", ")}`] : []),
          ...(liveDrop ? [`live data · the answer was not established by what was read, so it is not shown`] : []),
          ...(fellBack ? [fallbackProcessLine(fellBack)] : []),
          record.noClaims ? record.noClaims : record.hasMaterial ? `checked · the answer against the material carried` : `checked · no source carried`,
          ...(recLoop?.processLine ? [recLoop.processLine] : []),
        ];
      }
      // THE FOLD ADVANCES (the holodeck's System-1/System-2 split): the turn's
      // mechanical fold line joins the running summary, and the turn's warrant
      // record joins the addressable store. Both are the STORE — append-only,
      // never truncated here; only the projection is bounded. This is what
      // makes the next turn carry discourse, not the transcript.
      const foldLine = FOLD.mechanicalFoldLine(question, foldAnswer({ text, strand }));
      // FRESHNESS (fold-chat-freshness.js over khora span-drift.js): the claims of EARLIER turns, held against the pages this turn's material carries.
      // Read-only and said, never repaired: a span that moved or no longer appears is a note; a page not re-read is unchecked, never "gone".
      // basis.cited is the material's own bytes at the claim's support address (fold-chat-record.js), measured 49/49 well-formed in eval/freshness/cited-rate.mjs.
      try {
        const fresh = freshnessOf({ claims: s.claims || [], pages: material });
        if (fresh.stale.length) {
          const c = fresh.counts, at = c.shifted + c.moved;
          feedPush(lineEvent(tt, "Earlier citations have moved", { tone: c.gone ? "warn" : "info", note: `${at ? `${at} earlier claim(s) now sit at a different place (shifted ${c.shifted}, moved ${c.moved})` : ""}${at && c.gone ? "; " : ""}${c.gone ? `${c.gone} no longer appear on a page read again` : ""} — nothing was rewritten` }));
        }
      } catch {}
      // FoldRecord@1: the turn's spoken sentences become claims at /t<turn>/c<i> in the append-only store (s.claims); the record
      // carries a pointer into it, so the 100-char gist is a view and nothing is lost at the cut.
      const turnClaims = claimsOfTurn({ turn, pivot: pivotRes, record, material });
      s.claims = appendClaims(s.claims, turnClaims);
      const warrant = { ...FOLD.buildWarrantRecord({
        turn,
        plane: "world",
        gist: foldLine,
        channels: [webPassages.length ? "web" : null, material.length ? "material" : null, "model"].filter(Boolean),
        refs: (record?.sources || []).map((r) => r.address),
        unsupported: record?.creative ? [] : [...(record?.unsupported?.numbers || []), ...(record?.unsupported?.names || [])],
        open: [],
      }), ...pointerOf({ turn, claims: turnClaims, forWhom: question }) };   // the pointer rides beside the vendored record: vendor/the-fold/fold.js stays byte-identical to khora's
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
      // EFFORT: the falsify pass (deep) re-checks every grounded claim — a 2–3
      // token anchor is demoted to weak, and the counts are named in the panel.
      if (record && effort === "deep" && record.coverage?.entries) {
        record.falsify = ground.falsify(record.coverage.entries);
        record.process.push(`falsified · ${record.falsify.supported} supported · ${record.falsify.weak} weak · ${record.falsify.unsupported} unsupported`);
      }
      // THE VOID — what the turn could NOT establish — is DATA on the record
      // (record.void), drawn as its own gap block. It is never appended to the
      // answer: `text` stays exactly what the model wrote. Fast skips it; a
      // creative turn has no claims, so it never has one.
      // A turn with NO ANSWER because nothing was reachable (or a live feed could not be reached) draws
      // its typed gap whatever the effort: the gap IS the turn. They are authored by the app from the
      // search trace (fold-chat-gaps.js), never by the model.
      const readList = webPassages.slice(0, 6).map((p) => {
        let domain = null; try { domain = new URL(String(p.url || p.source)).hostname.replace(/^www\./, ""); } catch {}
        const ref = String(p.ref || ""); return { title: (ref.includes(" \u2014 ") ? ref.slice(ref.indexOf(" \u2014 ") + 3) : ref).trim(), domain, url: p.url || null };
      });
      let gapReport = null;
      if (record && genGate && !genGate.ok) {
        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"
        gapReport = genGate.void; text = "";
        feedPush(lineEvent(tt, `Could not ${genGate.void.outputType && ["image", "video", "slides"].includes(genGate.void.outputType) ? "make" : "write"} the ${genGate.void.outputType || "piece"}`, { tone: "bad", note: genGate.void.missing.join("; ") }));
      } else if (record && (plan || liveDrop)) {
        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"
        gapReport = (plan && plan.gap === "live") || liveDrop ? liveGap(webTrace, question, { read: liveDrop ? readList : [], what: liveHit?.what || null })
          : unreachedGap(webTrace, question);
        if (strandEmpty) gapReport.note = "Pages were read, but no passage of them could be quoted for this ask" + (strandWhy ? " (" + strandWhy + ")." : ".");
      } else if (record && effort !== "fast" && !strand && text.trim() && !(record.snips && record.snips.length)) gapReport = voidReport(record, lastUser?.content || "", webPassages, webTrace);
      if (gapReport) {
        record.void = gapReport;
        record.process.push("void · " + voidText(gapReport));
      }
      if (record) { record.effort = effort; }
      // AMBIGUITY: a bare word that names several things — list the senses, app-authored, small, dismissible.
      if (record && sensesProbe) {
        const probe = await sensesProbe;
        const d = probe && probe.results ? disambiguationOf(probeTerm, probe.results) : null;
        if (d) {
          record.senses = { term: d.term, senses: d.senses, page: d.page, line: sensesLine(d, { english: ["en", "unknown"].includes(detectLang(question).lang) }) };
          record.process.push("senses · " + record.senses.line);
        }
      }
      // Don't persist the full passage bytes on every grounded sentence (the
      // record is stored on the message and re-stringified every turn; full
      // sourceText per sentence grows localStorage until saving silently
      // stops). The render only needs the short excerpt already in facing.
      if (record) {
        if (record.coverage?.entries) for (const e of record.coverage.entries) delete e.sourceText;
        if (record.sources) for (const s of record.sources) delete s.sourceText;
      }
      // The feed's last rows: the check (a model-written answer is held against what was read), then the one-line
      // ending that stays when the feed collapses into "how this was answered". Stored on the record, so a reload
      // replays the same rows with no timers.
      if (record && !strand && text.trim() && checkable(kind)) {
        const un = (record.unsupported?.numbers?.length || 0) + (record.unsupported?.names?.length || 0);
        feedPush(lineEvent(tt, "Checked the answer against what was read", { tone: un ? "warn" : "ok", note: un ? `${un} figure(s) or name(s) not found in the sources` : "every figure and name appears in the sources" }));
      }
      feedPush(doneEvents(tt, { ok: !(plan || liveDrop || (genGate && !genGate.ok) || (slotTurn && !slotTurn.answer)), title: summaryLine({ ms: Date.now() - flight.startedAt, nSources: slotTurn ? slotTurn.sources.length : webPassages.length, mode: strand ? "snips" : "facing", model: m.id, fellBack: fellBack ? (fellBack.reason === "untraceable" ? "untraceable" : fellBack.kind === "fold" ? "nomodel" : "declined") : false, gap: !!(plan || liveDrop || (genGate && !genGate.ok) || (slotTurn && !slotTurn.answer)) }) }));
      if (record) record.feed = storeEvents(turnEvents, { max: 60 });
      const idx = s.messages.length;
      // Stored by author: a Sources-only turn is `authored: "sources"` with its verbatim snips (content = their plain
      // concatenation); every other turn's content is the model's, and exists only because a source was read.
      const storedSnips = strand ? strand.snips.map(storeSnip) : null;
      const slotStored = slotTurn ? storeAnswerTurn(slotTurn) : null;   // plain JSON: survives a reload and the session merge as message.answerTurn
      if (strand) { const chk = verifySnips(storedSnips, webPassages); if (!chk.ok) console.error("[fold-chat] a stored snip is not in its page — a bug:", chk.bad.map((b) => b.text.slice(0, 60))); }
      // THE TAPE: the live panel seals what it recorded onto the turn's record; the answer's own view takes it from here.
      // With the Pivot on the model's words are never streamed (pvStream stays empty): the live panel is handed the SPOKEN text here, so the
      // checks, the REC laps and the tape are still recorded (a turn whose panel never got its final text carried no check/loop entries at all).
      if (pvLive) { const finalText = pvStream || String(text || ""); if (finalText.trim()) { try { pvLive.wrote(finalText, true); } catch {} } }
      // the answer is out: the live panel stops and folds away now (no waiting for its animation to catch up)
      if (pvLive) { try { const sealed = pvLive.finish(); if (record) record.tape = sealed.tape; armTailReplay(sealed.liveT); pvLive.close(); } catch (e) { try { pvLive.close(); } catch {} } }
      s.messages.push({ role: "assistant", content: text, at: now(), mode: "chat", answerMode, grounding: record, model: m.id, ...(pivotRes ? { pivot: storePivot(pivotRes) } : {}), ...(discourseWatch ? { watch: discourseWatch } : {}), ...(provenance ? { provenance } : {}), ...(strand ? { authored: "sources", ...(slotTurn ? { answerTurn: slotStored } : { snips: storedSnips }) } : {}), ...(fellBack ? { fellBackFrom: fellBack.fellBackFrom, answerMode: "snips" } : {}), ...(notices.length ? { notices } : {}) });
      s.sealed = !!m.sealed;
      s.updated = now();
      maybeName(s);
      // The referent record the NEXT turn's "him"/"it" resolves against (fold-chat-mind.js): what this turn's sources and answer named.
      try { s.referents = admitReferents(s.referents || emptyReferents(), { question, creative: kind === "generate" || kind === "compose", answer: strand && !slotTurn ? "" : text, sources: (() => { const used = usedRefs({ pivot: pivotRes, record }), shown = strand ? new Set(relevantPassages(webPassages, searchQ, functionWordsOf(lang0 === "unknown" ? "en" : lang0)).map((p) => String(p.ref || ""))) : used;   /* on a SOURCES turn the pages SHOWN (the relevant ones) name the topic; otherwise only pages a spoken sentence was witnessed by. A title names a a referent only if a spoken sentence was witnessed by that page AND the cleaned title is a NAME (<= 4 words): "Photosynthesis" and "Eiffel Tower" are; a magazine headline is not */ return webPassages.filter((p) => (strand ? shown : used).has(String(p.ref || ""))).map((p) => ({ title: (String(p.ref || "").includes(" \u2014 ") ? String(p.ref).slice(String(p.ref).indexOf(" \u2014 ") + 3) : String(p.ref || "")).split(/\s+[|\u2013\u2014-]\s+/)[0] })).filter((x) => x.title.trim().split(/\s+/).length <= 4); })() }); } catch (e) { /* the record is an aid, never a reason to lose a turn */ }   // a page names a referent ONLY if a spoken sentence was witnessed by it: research never swamps the exchange
      // THE CARRY IS COMPUTED (fold-chat-carry.js, THE-HOLOGRAPH §6): now that this turn is in the referent record, the running
      // summary's Flow is the Atmosphere read off the transcript (where the conversation stands, where it turned) and its Entities
      // are the record's own names in any script — replacing the first-clause topic / capitalised-run guess above. No model; it is
      // recomputed from the messages each turn and can only ADD (nothing resolving leaves the summary as it was).
      try { s.summary = applyExchange(applyCarry(s.summary, s), s); if (s.summary && (() => { try { return localStorage.getItem("fold-chat:minds") === "on"; } catch { return false; } })()) { const mc = mindsClause(s); if (mc && s.summary.flow) s.summary = { ...s.summary, flow: s.summary.flow + mc }; } save("fold-chat:sessions", sessions); } catch (e) { /* an aid, never a reason to lose a turn */ }   // the model is told the EXCHANGE (what was asked, what the fold said), not the carry's page-title flow
      if (isLive()) renderDiscourse(s);
      // A reply that lands while another chat is open leaves a quiet mark on this
      // chat's row (cleared when it is opened) instead of drawing into that chat.
      if (!isLive()) s.unseen = true;
      save("fold-chat:sessions", sessions);
      row.wrap.remove();
      const drawMeta = (prov) => ({ sealed: m.sealed, index: idx, grounding: record, notices, model: m.id, mode: "chat", authored: strand ? "sources" : null, snips: storedSnips, answerTurn: slotStored, provenance: prov });
      let drawn = null;
      if (isLive()) { drawn = buildMsg(s, "assistant", text, drawMeta(provenance)); if (drawn.seam) E.threadCol.append(drawn.seam); E.threadCol.append(drawn.wrap); E.thread.scrollTop = E.thread.scrollHeight; try { window.__e2answerAt = performance.now(); window.__e2pending = false; } catch {} }
      if (deferProv || recRunLaps) {
        // E2 L1: the answer is visible. NOW point at the source (same code, same checks), then redraw the same message with the source line under it.
        const msgObj = s.messages[idx];
        if (!Object.prototype.hasOwnProperty.call(s, "_after")) Object.defineProperty(s, "_after", { value: null, writable: true, enumerable: false, configurable: true });   // never persisted
        try { window.__e2pending = true; window.__e2provAt = null; } catch {}
        s._after = (async () => {
          try {
            await Promise.all([provenanceWork(), recRunLaps ? recRunLaps().catch((e) => { if (ac.signal.aborted) return; try { console.error("[fold-chat] deferred reframe:", e); } catch {} }) : null]);
            if (recLoop && record) {
              const lp2 = recLoop.passes.length, S2 = recLoop.after || {};
              recLoop.processLine = lp2 ? `reframed \u00b7 went back ${lp2} lap${lp2 === 1 ? "" : "s"} (after the answer was shown) \u00b7 ${recLoop.passes.reduce((n, p) => n + p.added, 0)} more source(s) read \u00b7 0 sentence(s) restated \u00b7 ${recLoop.cleared ? "every sentence holds" : `${(S2.unsupported || 0) + (S2.contested || 0) + (S2.weak || 0)} still failing, marked`}` : "reframe \u00b7 nothing more found";
              record.loop = recLoop; record.process = (record.process || []).filter((x) => !/^reframe/.test(x)); record.process.push(recLoop.processLine);
              record.passages = webPassages.slice(0, 8).map((p) => ({ ref: p.ref, source: p.source, url: p.url, title: p.title, domain: p.domain, text: String(p.text || "").slice(0, 2400) }));
              record.nSources = webPassages.length + materialOf(s).length + (threadTurn ? 1 : 0);
              if (webTrace) record.web = webTrace;
            }
            if (provenance) msgObj.provenance = provenance;
            try {
              const tiers = (provenance?.pointers || []).map((p) => p.tier);              const best = tiers.includes("primary") ? "primary" : tiers.includes("origin") ? "origin" : tiers[0] || null;
              const aw = watchPost({ ask: said, prior: askAt > 0 ? s.messages.slice(0, askAt) : [], pre: watcherPre, reads: surfedUrls.length ? surfedUrls : webPassages.map((p) => String(p.url || p.source || "")).filter(Boolean), setAside: asideUrls, events: turnEvents, passages: webPassages, spoken: text, reached: !!(provenance && provenance.verified), tier: best });
              msgObj.watch = { relation: aw.relation, want: aw.want, flags: aw.flags.map((f) => f.flag), baton: aw.baton, ...(aw.detail ? { detail: aw.detail } : {}), ...(aw.appAnswered ? { appAnswered: true } : {}) };
            } catch (e) { /* an aid */ }
            if (record) record.feed = storeEvents(turnEvents, { max: 60 });
            s.updated = now(); save("fold-chat:sessions", sessions);
            if (isLive() && drawn && drawn.wrap.isConnected) { const again = buildMsg(s, "assistant", text, drawMeta(provenance)); drawn.wrap.replaceWith(again.wrap); drawn = again; }
          } catch (e) { try { console.error("[fold-chat] deferred source check:", e); } catch {} }
          finally { try { delete recLoop.pending; } catch {} try { window.__e2provAt = performance.now(); window.__e2pending = false; } catch {} if (isLive()) E.stage.textContent = ""; s._after = null; }
        })();
      }
    } catch (err) {      // A stop is a stop; ANYTHING else that died is stored as a typed, retry-able note on its own
      // message (failTurn) — whether or not this chat is the open one.      if (ac.signal.aborted) stopped(); else failTurn(err);
    } finally {
      refreshMeter();
    }
    } catch (e) {
      // Only a stop reaches here (it was thrown out of the search): anything else
      // is a bug and must not be swallowed.
      if (ac.signal.aborted) stopped(); else failTurn(e);
    } finally {
      release();
    }
  }

  // The agent lane — the SAME thread, dispatched THROUGH heimdall to the
  // machine door. It is not a separate app: the user's message, the agent's
  // tool activity, and its answer all render inline in the one conversation
  // (in the agent's own register — teal rail, mode tag, terminal composer),
  // and the project's folder (cwd) binds the job so the machine door reads and
  // edits the same place the project stands. The model the door reasons with is
  // itself routed by heimdall (a `heimdall` provider pointing at the bridge's
  // /v1), so no model is reached outside the fold stack.
  const CODE_MODEL = { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" };
  function codeModelRef() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v || CODE_MODEL; } catch { return CODE_MODEL; } }
  function sessionCwd(s) { const c = s?.cwd || (s?.project ? projects[s.project]?.cwd : null) || null; if (c) taint.add(c, "folder path"); return c; }
  // The agent's round budget: how many times it may go again on what it saw.
  // Which pipeline ACTS: "compose" = penelope's code-agent (default; built for
  // small models), "khora" = the khora's open agent loop in its severed sandbox.
  function agentLane() { try { return localStorage.getItem("fold-chat:agentlane") === "khora" ? "khora" : "compose"; } catch { return "compose"; } }
  function agentModelName() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v?.modelID || null; } catch { return null; } }
  // Escalation to a SEALED remote model when local is busy / slow / empty. On by default.
  function agentEscalates() { try { return localStorage.getItem("fold-chat:agentescalate") !== "0"; } catch { return true; } }
  function agentRounds() { try { return Math.max(1, Math.min(6, parseInt(localStorage.getItem("fold-chat:agentrounds") || "3", 10) || 3)); } catch { return 3; } }
  // Inside the Fold card the preview is bare — the card's tabs already say what it is, and Folded has the copy button.
  function quietArtifact(host, art) {
    if (previewable(art.kind)) { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = art.code; f.className = "fv-frame"; f.title = "the live page"; host.append(f); }
    else host.append(el("pre", "art-code", art.code));
  }
  // "Reset from here": the person scrubbed the fold back to an attempt and chose it as the starting point. The NEXT agent turn
  // edits that attempt's code, not the newest one; the choice rides on the session until a turn consumes it or they undo it.
  function setResume(s, r) {
    if (!s) return;
    if (!r || !r.version) { s.resumeFrom = null; save("fold-chat:sessions", sessions); refreshComposer(); return; }
    s.resumeFrom = { foldId: r.foldId, index: r.index, round: r.version.round, kind: r.version.kind, code: r.version.code, at: now() };
    save("fold-chat:sessions", sessions);
    setEngagement("code");
    E.input.placeholder = `what should change? (starts from ${r.version.round === 0 ? "the earlier version" : "attempt " + r.version.round})`;
    E.input.focus();
  }
  // "Type it, get the cut": a clip/stitch sentence is a CUT, not a chat turn — the parser
  // (fold-chat-clip.js) is deterministic, the cut happens on the reader's own machine by the
  // yt-dlp helper, and the model invents nothing. Results land in clips/ on the fold surface
  // (the holodeck dev server), which is where any clip is meant to be watched.
  async function runClip(id, spec) {
    const s = sessions[id]; if (!s) return;
    const base = (() => { try { return (localStorage.getItem("hd:ytdl") || "").replace(/\/+$/, "") || "http://127.0.0.1:11450"; } catch (e) { return "http://127.0.0.1:11450"; } })();
    const surface = "http://127.0.0.1:8813";   // the fold surface serves /clips/*; FOLD_SURFACE to change
    const clk = x => { const t = Math.max(0, Math.round(x)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(r).padStart(2, "0"); };
    const reply = (content, at) => {
      s.messages.push({ role: "assistant", content, at: at || now(), mode: "chat" });
      s.updated = now(); save("fold-chat:sessions", sessions);
      appendMsg(s, "assistant", content, { index: s.messages.length - 1, mode: "chat" });
    };
    const appendAside = (content) => appendMsg(s, "assistant", content, { index: s.messages.length, mode: "chat" });
    appendAside(spec.kind === "stitch" ? "Stitching…" : "Clipping…");
    try {
      const segs = (spec.segments || []).map(x => "seg=" + encodeURIComponent(x.start + "-" + x.end)).join("&");
      const u = spec.kind === "stitch"
        ? base + "/stitch?id=" + encodeURIComponent(spec.id) + "&name=" + encodeURIComponent(spec.name) + (segs ? "&" + segs : "")
        : base + "/clip?id=" + encodeURIComponent(spec.id) + "&start=" + encodeURIComponent(String(spec.segments[0].start)) + "&end=" + encodeURIComponent(String(spec.segments[0].end)) + "&name=" + encodeURIComponent(spec.name);
      const r = await fetch(u);
      if (!r.ok) throw new Error("the yt-dlp helper answered HTTP " + r.status);
      const man = await r.json();
      const ticks = man.segments.map(x => "[" + clk(x.start) + "–" + clk(x.end) + "]").join(" + ");
      const href = surface + (man.url || "/clips/" + encodeURIComponent(man.name) + ".mp4");
      reply("**" + man.name + "** — " + man.duration + "s " + spec.kind +
        "\n\n" + ticks + " · source `" + spec.id + "`" +
        "\n\n▶ " + (href.length > 90 ? "[" + man.name + ".mp4](" + href + ")" : href) +
        "\n\n_(a cut of real bytes, made by yt-dlp on this machine — watch it on the fold surface at " + surface + ")_");
      return;
    } catch (e) {
      reply("The " + spec.kind + " failed: " + String(e && e.message || e) + " — is the yt-dlp helper running? (`python3 tools/ytdl-helper.py`)");
    }
  }
  async function runCode(id = activeId) {
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;
    const isLive = () => activeId === id;   // every UI write below is for the OPEN chat only
    const runId = newRun("agent");
    const cwd = sessionCwd(s);
    const task = s.messages[s.messages.length - 1].content;
    const row = liveBody(s, isLive());
    const body = row.body;
    // The feed IS the live status: no spinner line, no blinking cursor.
    body.classList.remove("live"); body.querySelector(".live-stat")?.remove();
    if (cwd) body.append(el("span", "chip folderchip", "📁 " + cwd));
    const ac = new AbortController();
    // The agent's own stop path (the feed's Stop button) is this same abort; the
    // composer's Stop, Escape, and deleting the chat all reach it through the entry.
    const flight = { ac, kind: "agent", label: "agent · working…", startedAt: Date.now(), wrap: row.wrap, stage: "agent · working…", stop: () => { ac.abort(); flight.stage = "agent · stopping…"; if (isLive()) E.stage.textContent = "agent · stopping…"; } };
    inflight.set(id, flight);
    if (isLive()) E.stage.textContent = flight.stage;
    refreshComposer(); renderChats();
    // THE FOLD — this run's artifact, its append-only log and its folded output, kept whole and shown live
    // (Artifact · Log · Folded). The agent loop writes to it as each attempt lands; the message keeps a snapshot.
    const resume = s.resumeFrom && s.resumeFrom.code ? s.resumeFrom : null;
    const fold = createFold({ task });
    if (resume) {
      addFoldVersion(fold, { round: 0, maker: { kind: "restored" }, code: resume.code, kind: resume.kind });
      addFoldLog(fold, { round: 0, stage: "fold", by: "app", title: `started from ${resume.round === 0 ? "an earlier version" : "attempt " + resume.round} of the last run`, detail: "you reset to that point", tech: `resumed from ${resume.foldId} event ${resume.index}`, ok: true });
    }
    const foldView = mountFold(body, fold, { live: true, renderArtifact: quietArtifact, tryCall: (code, expr) => callMany(code, [expr]).then((r) => r[0]), onReset: (r) => setResume(s, r) });
    const tuck = tuckSteps(body, { open: true });
    const feed = createFeed(tuck.inner, { live: true, onStop: () => flight.stop(), onRetry: () => rerunAs(id, task, "agent"), onAuditOpen: (auditId) => openAudit(auditId) });
    try {
      // THE LOOP (fold-chat-agent.js): dispatch to the machine door → run what
      // came back in a sandbox and LOOK → if it failed, go again with the
      // observed problem in the SAME door session, until it holds or the budget
      // is spent. A fenced behavioral test the person attached rides every
      // round as the REAL test. The door's session id is persisted the moment
      // it arrives, so a follow-up always continues the same session.
      const verification = client.extractVerification(task);
      // THE PIPELINES THAT FEED IT, each through heimdall:
      //   khora    reads the ask (/api/read — model-free reader)
      //   penelope composes the code (/api/code → the weave: swarm → field → hunt → mouth)
      //            — or, in the "loop" engine, the khora's own open agent loop (/api/agent)
      //   sandbox  runs what came back and measures it
      //   janus    rules on the measured facts (/api/reason) — the engine decides
      const lane = agentLane();
      const result = await runAgent({
        task, base: resume ? { code: resume.code, kind: resume.kind } : null, verification, signal: ac.signal, maxRounds: agentRounds(), sessionId: resume ? null : s.codeSessionId || null,
        actPipeline: lane === "khora" ? "khora" : "penelope",
        slowAfterMs: 75000,
        escalate: agentEscalates() ? async (prompt, o) => {
          const candidates = client.remoteCandidates(models);
          if (!candidates.length) throw new Error("no sealed remote model is available through heimdall");
          const t0 = Date.now();
          const out = await client.remoteCode(prompt, { candidates, prior: o.prior, base: bridge, signal: o.signal, onTry: o.onTry, run: runId, taint, mode: privacyMode(), redact: (t) => redactor.spans(t, { signal: o.signal }), readNames: async (t) => ((await client.read(t, { base: bridge, source: "deid", signal: o.signal }))?.referents || []).flatMap((r) => r.surfaces || []) });
          return { sessionId: null, text: out.text, ms: Date.now() - t0, lane: "sealed-remote", executed: false, model: out.model, audit: out.sent,
            activity: [...out.tried.map((t) => ({ tool: "remote", status: "failed", title: `${t.model}: ${t.error}` })), { tool: "remote", status: "done", title: out.model + " · sealed-external" }] };
        } : null,
        read: (t) => client.read(t, { base: bridge, source: "agent-task", sessionId: s.codeSessionId || null, signal: ac.signal }),
        derive: (spec, o) => client.reason(spec, { base: bridge, signal: o?.signal || ac.signal }),
        dispatch: async (prompt, o) => {
          let out;
          if (lane === "khora") {
            const t0 = Date.now();
            const sid = o.sessionId || ("ses_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
            const res = await client.agent(prompt, { base: bridge, model: agentModelName(), maxTurns: 6, sessionId: sid, signal: o.signal });
            out = client.agentAnswerOf(res, { sessionId: sid, ms: Date.now() - t0 });
          } else {
            out = await client.code(prompt, { base: bridge, title: s.title, model: codeModelRef(), sessionId: o.sessionId, cwd, verification: o.verification, signal: o.signal });
          }
          if (out.sessionId) { s.codeSessionId = out.sessionId; save("fold-chat:sessions", sessions); }
          return out;
        },
        observe: (code, o) => observeArtifact(code, { kind: o.kind, signal: ac.signal }),
        emit: (e) => { feed.push(e); addFoldEvent(fold, e); foldView.update(); },
        onVersion: (v) => { addFoldVersion(fold, v); foldView.update(); },
      });
      feed.dispose();
      tuck.settle({ keepOpen: false, label: "How it got here" });   // settled below if the run did not hold
      // Cross-check every request this run sent through heimdall against heimdall's
      // OWN ledger — what left, byte for byte, per the door it left through.
      const mine = outbound.byRun(runId).filter((e) => e.via === "heimdall");
      if (mine.length) { await outbound.verifyAll(mine.map((e) => e.id)).catch(() => {}); const auditEv = ({ type: "audit", at: result.ms, entries: outbound.byRun(runId).map((e) => ({ id: e.id, model: e.model, host: (e.verification && e.verification.host) || e.host, level: e.grade.level, sealed: e.grade.sealed, bytes: e.bytes, leaks: e.grade.leaks.length, verified: e.verification ? e.verification.verified : null, problems: e.verification?.problems || [], via: e.via, status: e.status })), summary: outbound.summary(outbound.byRun(runId)) }); feed.push(auditEv); result.events.push(auditEv); }
      if (!result.ok) tuck.settle({ keepOpen: true, label: "What happened" });   // a run that did not hold keeps its story open
      const art = result.artifact;
      const renderText = art ? (/```/.test(art) ? art : "```" + fenceLangFor(art) + "\n" + art + "\n```") : "";
      // No artifact is a NOTE about the run, on its own channel — not text the agent said.
      const agentNotices = result.stopped ? [{ kind: "stopped", text: art ? "Stopped \u2014 the agent was cut short." : "Stopped before the agent produced any code." }]
        : art ? [] : [{ kind: "agent", text: `the agent produced no code${result.error ? " — " + result.error : ""}` }];
      const lastRound = result.rounds[result.rounds.length - 1] || null;
      const codeRec = {
        code: true, cwd, lane: lastRound?.lane || "penelope-code-agent", events: result.events, ms: result.ms,
        outcome: result.ok ? "held" : result.stopped ? "stopped" : result.exhausted ? "exhausted" : "failed",
        activity: result.events.filter((e) => e.type === "tool").map((e) => ({ tool: e.tool, status: e.status, title: e.title })),
        executed: false,
        fold: foldSnapshot(fold),
      };
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: renderText, at: now(), mode: "agent", codeSessionId: s.codeSessionId, cwd, grounding: codeRec, ...(agentNotices.length ? { notices: agentNotices } : {}) });
      s.updated = now();
      maybeName(s);
      if (!isLive() && !result.stopped) s.unseen = true;
      if (sessions[id] === s) save("fold-chat:sessions", sessions);
      row.wrap.remove();
      if (isLive()) appendMsg(s, "assistant", renderText, { index: idx, cwd, grounding: codeRec, notices: agentNotices, model: codeModelRef().modelID, mode: "agent" });
    } catch (err) {
      feed.dispose();
      if (isLive()) { E.stage.textContent = ""; body.append(el("div", "ar-foot bad", "error: " + err.message)); }
      else {
        row.wrap.remove();
        s.messages.push({ role: "assistant", content: "", at: now(), mode: "agent", notices: [{ kind: "agent", text: "error: " + err.message }] });
        s.updated = now(); s.unseen = true;
        if (sessions[id] === s) save("fold-chat:sessions", sessions);
      }
    } finally {
      s.iterate = false;
      if (resume && s.resumeFrom === resume) { s.resumeFrom = null; save("fold-chat:sessions", sessions); }   // a turn consumes the reset point it started from
      inflight.delete(id);
      refreshComposer(); renderChats();
      if (isLive()) { E.stage.textContent = ""; E.input.focus(); }
      refreshMeter();
    }
  }

  E.composer.onsubmit = (e) => {
    e.preventDefault();
    // While the OPEN chat's turn runs the button is Stop (see send.onclick) and
    // nothing new can be sent into it.
    if (life.composerLocked(inflight, activeId)) return;
    const text = E.input.value.trim();
    if (!text) return;
    // A make-ask in the Agent engagement becomes a FOLD: built from tested blocks, unit by unit, with its own record.
    if (engagement === "code" && isMakeAsk(text)) { E.input.value = ""; E.input.style.height = "auto"; folds.create(text); return; }
    E.input.value = ""; E.input.style.height = "auto";
    const s = sessions[activeId] || (newChat(), sessions[activeId]);
    // EFFORT IS CAPTURED HERE, at send, and stamped on the ask: it applies to
    // this turn only. (A code-door turn runs no grounded pipeline, so it carries none.)
    const grounded = !(engagement === "code" && modelsUp && isCodeTask(text));   // no machine door (no bridge): any ask is answered by the grounded lane, never refused
    const effort = grounded ? takeEffort() : null;
    const answerMode = grounded ? takeAnswerMode() : null;
    s.messages.push({ role: "user", content: text, at: now(), mode: normMode(engagement), ...(effort ? { effort } : {}), ...(answerMode ? { answerMode } : {}) });
    // Learn the person's name only when they state it — never guessed.
    const learned = memory.extractStatedName(text);
    if (learned) { s.facts = { ...(s.facts || {}), name: learned }; readerName = learned; try { localStorage.setItem("fold-chat:reader", learned); } catch (e) {} }
    s.title = s.title === "New chat" ? text.slice(0, 46) : s.title;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    setView(false);
    appendMsg(s, "user", text, { index: s.messages.length - 1, mode: normMode(engagement) });
    renderChats();
    // CODING ONLY GOES TO THE MACHINE DOOR. A research or writing question in
    // the Code engagement is NOT a code task: it goes through the grounded
    // path (search → spread → write), so the fold never answers a factual
    // question from the coder model's memory. Only a real code/files ask
    // dispatches to opencode.
    if (!grounded) runCode(s.id);
    else {
      run(s.id, false);
    }
  };
  // Send is Stop while the open chat has a turn in flight: a real button, so
  // Enter/Space work on it; Escape in the composer stops too (the textarea stays
  // focusable, read-only, while the turn runs). Aborting leaves the person's
  // message in place with a quiet "stopped" note on message.notices.
  E.send.addEventListener("click", (e) => { if (life.composerLocked(inflight, activeId)) { e.preventDefault(); stopOpenTurn(); } });
  E.composer.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && life.composerLocked(inflight, activeId) && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); stopOpenTurn(); }
  });
  E.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!life.composerLocked(inflight, activeId)) E.composer.requestSubmit(); } });
  E.input.addEventListener("input", () => { E.input.style.height = "auto"; E.input.style.height = Math.min(E.input.scrollHeight, 200) + "px"; });

  /* ---------------- settings ---------------- */
  // The bridge, the preset, the theme, and the default mode — the surface's
  // configuration, kept out of the conversation sidebar.
  function applyPreset(next) {
    preset = next;
    try { localStorage.setItem("fold-chat:preset", preset); } catch (e) {}
    const s = sessions[activeId]; if (s) { s.preset = preset; save("fold-chat:sessions", sessions); }
  }
  // THEME: `fold-chat:theme` holds an explicit "light" or "dark"; with none
  // stored the page follows the system (prefers-color-scheme) and keeps
  // following it as it changes. The data-theme attribute is always the
  // resolved light/dark (index.html sets it before first paint).
  const systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function themePref() { try { const t = localStorage.getItem("fold-chat:theme"); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } }
  function applyTheme(pref) {
    try { if (pref === "light" || pref === "dark") localStorage.setItem("fold-chat:theme", pref); else localStorage.removeItem("fold-chat:theme"); } catch (e) {}
    const resolved = pref === "light" || pref === "dark" ? pref : (systemDark?.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", resolved);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.append(meta); }
    meta.content = resolved === "dark" ? "#17171a" : "#ffffff";
  }
  systemDark?.addEventListener?.("change", () => { if (themePref() === "system") { applyTheme("system"); paintTheme(); } });
  function markOn(btn, on) { btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); }
  function paintTheme() {
    const cur = themePref();
    for (const b of E.setTheme.querySelectorAll("button")) markOn(b, b.dataset.theme === cur);
  }
  function paintModeSetting() { for (const b of E.setMode.querySelectorAll("button")) markOn(b, b.dataset.mode === engagement); }
  function paintTransparency() { for (const b of E.setTransparency.querySelectorAll("button")) markOn(b, b.dataset.transparency === (transparency ? "1" : "0")); }
  function paintDiscourseSetting() { if (E.setDiscourse) E.setDiscourse.checked = discourseOn; }
  E.setTheme.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; applyTheme(b.dataset.theme); paintTheme(); };
  E.setMode.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setEngagement(b.dataset.mode); paintModeSetting(); };
  E.setTransparency.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setTransparency(b.dataset.transparency === "1"); paintTransparency(); };
  E.setDiscourse?.addEventListener?.("change", (e) => { setDiscourseOn(e.target.checked); });

  function openSettings() {
    for (const [k, p] of Object.entries(PRESETS)) if (!E.setPreset.querySelector(`option[value="${k}"]`)) E.setPreset.append(new Option(p.label, k));
    E.setPreset.value = preset;
    if (E.setAgentLane) E.setAgentLane.value = agentLane();
    if (E.setAgentRounds) E.setAgentRounds.value = String(agentRounds());
    if (E.setAgentEscalate) E.setAgentEscalate.checked = agentEscalates();
    paintTheme(); paintModeSetting(); paintTransparency(); paintDiscourseSetting();
    refreshKeyStatus();
    E.settingsModal.hidden = false;
  }
  function closeSettings() { E.settingsModal.hidden = true; }
  function saveSettings() {
    applyPreset(E.setPreset.value);
    try { if (E.setAgentLane) localStorage.setItem("fold-chat:agentlane", E.setAgentLane.value); if (E.setAgentRounds) localStorage.setItem("fold-chat:agentrounds", E.setAgentRounds.value); if (E.setAgentEscalate) localStorage.setItem("fold-chat:agentescalate", E.setAgentEscalate.checked ? "1" : "0"); } catch (e) {}
    closeSettings();
    toast("settings saved");
  }
  // Provider keys: posted to the localhost bridge, stored server-side (beside
  // `heimdall key`), and never kept in this page. The field is cleared on save.
  const KEY_TONE_COLOR = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" };
  // Show a plain-language result (headline + lines) in the status box; `actions` are [{label, run}] buttons under it.
  function showKeyStatus({ tone = "warn", headline = "", lines = [] }, actions = []) {
    const box = E.keyStatus; if (!box) return;
    box.textContent = "";
    if (headline) { const h = el("div", "keyhead", headline); h.style.color = KEY_TONE_COLOR[tone] || ""; box.append(h); }
    // A key that WORKS shows what it unlocked and tucks the rest (where it is stored, what stays private) under Details.
    // A key that needs attention shows every line, because the lines say what to do.
    let shown = lines, more = [];
    if (tone === "ok" && lines.length > 2) {
      const pick = lines.find((l) => /^Unlocked/.test(l)) || lines[0];
      shown = [pick.split(" heimdall now offers")[0]];
      more = lines.filter((l) => l !== pick);
    }
    for (const l of shown) box.append(el("div", "keyline", l));
    if (more.length) {
      const d = el("details", "keymore"); d.append(el("summary", "", "Details"));
      for (const l of more) d.append(el("div", "keyline", l));
      box.append(d);
    }
    if (actions.length) {
      const bar = el("div", "keyactions");
      for (const a of actions) { const b = el("button", "btn", a.label); b.type = "button"; b.onclick = a.run; bar.append(b); }
      box.append(bar);
    }
  }
  // Where each stored key stands: stored, and — separately — LOADED by the running heimdall (a key saved by the
  // terminal after heimdall started is stored but not loaded until heimdall reloads or restarts).
  async function refreshKeyStatus() {
    if (!E.keyStatus) return;
    if (NO_HEIMDALL) { showKeyStatus({ tone: "warn", headline: "", lines: ["This surface answers with the model in this tab — there is no heimdall bridge, so provider keys are not used."] }); return; }
    try {
      const j = await client.listProviderKeys({ base: bridge });
      const stored = j.providers || [];
      if (!stored.length) { showKeyStatus({ tone: "warn", headline: "", lines: ["No provider keys saved on this machine yet. Paste one above and press Save: it is tested right away and you will see what it unlocks."] }); return; }
      const lines = []; const actions = []; let notLoaded = false;
      for (const p of stored) {
        const st = client.keyLoadState(p.provider, { stored, models });
        const nm = client.providerLabel(p.provider);
        if (st.state === "loaded") lines.push(`${nm} ${p.masked || ""}: saved and loaded. heimdall offers ${st.models.length} model${st.models.length === 1 ? "" : "s"} (${st.models.join(", ")}), and the Fold's online help can use ${st.models.length === 1 ? "it" : "them"}.`);
        else { notLoaded = true; lines.push(`${nm} ${p.masked || ""}: saved, but heimdall has not loaded it yet, so no ${nm} model is available. Press "Load now"; if that does not help, restart the Fold's server (npm run serve). The key is saved, nothing is lost.`); }
        actions.push({ label: `Test ${nm} again`, run: () => testKey(p.provider) });
      }
      if (notLoaded) actions.unshift({ label: "Load now", run: loadKeysNow });
      showKeyStatus({ tone: notLoaded ? "warn" : "ok", headline: "", lines }, actions);
    } catch (e) {
      // 401 = heimdall IS answering and wants the bridge's access cookie, and the page already asked its link page for it once: say that, not "not answering"
      if (e && e.status === 401) showKeyStatus({ tone: "warn", headline: "heimdall is running but did not accept this page", lines: ["The key route needs the bridge's access cookie and the link request did not get one. Open /heimdall/link/ once in this browser (the Fold's own server sets the cookie there), then reopen Settings."] });
      else showKeyStatus({ tone: "warn", headline: "", lines: ["heimdall is not answering — start the Fold's own server (npm run serve) to store keys."] });
    }
  }
  async function loadKeysNow() {
    try { await client.reloadProviderKeys({ base: bridge }); await refreshModels(); toast("heimdall reloaded its keys"); }
    catch (e) {
      showKeyStatus({ tone: "warn", headline: "heimdall could not reload the keys", lines: e.status === 404
        ? ["The heimdall that is running started before this feature and cannot reload. Restart the Fold's server (npm run serve). The key is saved, nothing is lost."]
        : [String(e.message || e)] });
      return;
    }
    refreshKeyStatus();
  }
  async function testKey(provider) {
    showKeyStatus({ tone: "warn", headline: "Testing…", lines: ["Asking the provider whether the saved key works (one tiny request)."] });
    try {
      const j = await client.testProviderKey(provider, { base: bridge });
      await refreshModels();
      const d = client.describeKeyResult(provider, j, { models });
      showKeyStatus(d, [{ label: "Test again", run: () => testKey(provider) }]);
    } catch (e) {
      showKeyStatus({ tone: "warn", headline: "Could not test the key", lines: [e.status === 404 ? "This heimdall is an older version and cannot test keys. Restart the Fold's server (npm run serve) to get the check." : String(e.message || e)] });
    }
  }
  async function saveProviderKey(provider, input) {
    const key = (input.value || "").trim();
    if (!key) { toast("enter a key first"); input.focus(); return; }
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    const row = btn?.closest(".keyrow");
    if (btn) { btn.classList.remove("saved", "err"); btn.textContent = "Testing…"; btn.disabled = true; }
    if (row) row.classList.remove("saved");
    showKeyStatus({ tone: "warn", headline: "Testing the key…", lines: ["Received. Sending one tiny test request to the provider to see whether it works."] });
    try {
      const j = await client.setProviderKey(provider, key, { base: bridge });
      input.value = ""; // the page never keeps the key
      await refreshModels(); // the model list (and the online-escalation candidates) pick up the new provider now, no reload
      const d = client.describeKeyResult(provider, j, { models });
      if (btn) {
        btn.textContent = d.ok ? "✓ works" : d.tone === "bad" ? "✕ rejected" : "saved, not confirmed";
        btn.classList.add(d.ok ? "saved" : d.tone === "bad" ? "err" : "warn");
      }
      if (row && d.ok) row.classList.add("saved");
      toast(d.ok ? `${provider} key works` : d.headline);
      showKeyStatus(d, d.tone === "bad" ? [] : [{ label: "Test again", run: () => testKey(provider) }]);
    } catch (e) {
      if (btn) { btn.classList.add("err"); btn.textContent = "Save"; }
      showKeyStatus({ tone: "bad", headline: e && e.status === 401 ? `heimdall did not accept this page, so the ${provider} key was not saved` : `Could not reach heimdall to save the ${provider} key`, lines: [String(e.message || e), e && e.status === 401 ? "Open /heimdall/link/ once in this browser, then press Save again. Nothing was sent to the provider." : "Start the Fold's server (npm run serve), then press Save again. Nothing was sent to the provider."] });
      toast(String(e.message || e));
    } finally { if (btn) btn.disabled = false; }
  }
  // one row per provider that takes a key here; the ids are keyAnthropic, keyOpenai, keyOpenrouter, keyTogether, keyFireworks, keyDeepinfra
  for (const [provider, input] of ["anthropic", "openai", "openrouter", "together", "fireworks", "deepinfra"].map((p) => [p, $("key" + p[0].toUpperCase() + p.slice(1))])) {
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    if (btn) btn.onclick = () => saveProviderKey(provider, input);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveProviderKey(provider, input); } });
    if (input && btn) input.addEventListener("input", () => { btn.textContent = "Save"; btn.classList.remove("saved", "err", "warn"); });
  }
  // each settings section remembers whether it was left open; General opens by default, the rest start collapsed
  for (const d of E.settingsModal.querySelectorAll("details.set")) {
    try { const v = localStorage.getItem("fold.set." + d.id); if (v != null) d.open = v === "1"; } catch { /* storage unavailable: the defaults stand */ }
    d.addEventListener("toggle", () => { try { localStorage.setItem("fold.set." + d.id, d.open ? "1" : "0"); } catch { /* ignore */ } });
  }
  E.railSettings.onclick = openSettings;
  E.settingsClose.onclick = E.settingsCancel.onclick = closeSettings;
  E.settingsSave.onclick = saveSettings;
  E.settingsModal.addEventListener("click", (e) => { if (e.target === E.settingsModal) closeSettings(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !E.settingsModal.hidden) closeSettings(); });

  /* ---------------- evidence drawer ---------------- */
  async function refreshMeter() { if (NO_HEIMDALL) { meterInfo = null; return; } try { meterInfo = await client.meter({ base: bridge }); } catch { meterInfo = null; } }
  async function toggleDrawer() {
    const open = E.drawer.style.display === "none";
    E.drawer.style.display = open ? "" : "none";
    E.railEvidence.setAttribute("aria-pressed", open ? "true" : "false");
    if (!open) return;
    E.drawer.innerHTML = "";
    const f = NO_HEIMDALL ? null : await client.frontier({ base: bridge }).catch(() => null);
    const led = NO_HEIMDALL ? null : await client.ledger({ base: bridge }).catch(() => null);
    await refreshMeter();
    const c = meterInfo?.counts || {};
    const head = el("div");
    head.innerHTML = `<div class="drawer-head"><h3>secure chat with outside models</h3></div><p>${esc(f?.gate || "the bridge reports no frontier gate yet.")}</p>
      <p class="invariant"><b>WHAT LEFT THIS MACHINE</b> — ${esc(describeSummary(outbound.summary()))}</p>
      <p>local ${c["deterministic/local"] ?? 0} · remote ${c["open remote"] ?? 0} · frontier ${c.frontier ?? 0} · external tokens ${meterInfo?.externalTokens ?? 0}</p>`;
    const x = closeButton(); x.setAttribute("aria-label", "Close evidence"); x.onclick = () => toggleDrawer();
    head.querySelector(".drawer-head").append(x);
    E.drawer.append(head);
    // tokens used and saved: the numbers the providers reported, and what the cheaper lanes kept off the frontier bill
    const tk = client.describeTokens(meterInfo);
    if (tk) {
      const box = el("div", "tokens");
      const stat = (label, big, small) => { const d = el("div", "tstat"); d.append(el("div", "tlabel", label), el("div", "tbig", big)); if (small) d.append(el("div", "tsmall", small)); return d; };
      const row = el("div", "tstats");
      row.append(stat("Used", tk.cost, tk.used), stat("Saved", tk.savedUsd, tk.saved), stat("Cancelled", String(tk.cancelled), "losing calls stopped"));
      box.append(row);
      if (tk.versus) box.append(el("div", "tnote", "Saved is measured against " + tk.versus + ". Token counts are measured; the price is a stated estimate."));
      if (tk.exact) box.append(el("div", "tnote", tk.exact + "."));
      if (tk.local) box.append(el("div", "tnote", tk.local + "."));
      if (tk.rows.length) {
        const table = el("table", "ledger");
        const hr = el("tr"); for (const h of ["model", "calls", "tokens", "cost"]) hr.append(el("th", "", h)); table.append(hr);
        for (const r of tk.rows) { const tr = el("tr"); tr.append(el("td", "", r.model), el("td", "", String(r.calls)), el("td", "", r.tokens), el("td", "", r.usd)); table.append(tr); }
        box.append(table);
      }
      E.drawer.append(box);
    }
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
    renderOutbound(E.drawer, drawerFocus);
    drawerFocus = null;
    E.drawer.append(el("p", "drawer-foot", "The Fold · chat v0.1 · models routed by heimdall · every request goes sealed-external by default"));
  }
  let drawerFocus = null;
  let drawerOpener = null;
  async function openAudit(id) {
    drawerFocus = id;
    if (E.drawer.style.display === "none") await toggleDrawer(); else { await toggleDrawer(); await toggleDrawer(); }
    E.drawer.querySelector(`[data-audit-entry="${id}"]`)?.scrollIntoView({ block: "center" });
  }

  // THE OUTBOUND LEDGER, readable: every request that left this machine, how it
  // was graded, the exact content, and whether heimdall's own ledger agrees.
  function renderOutbound(container, focusId) {
    const sec = el("section", "outbound");
    const head = el("div", "ob-head");
    head.append(el("h4", "", "what left this machine"));
    const actions = el("span", "ob-actions");
    const verifyAll = el("button", "ob-btn", "verify all against heimdall");
    verifyAll.onclick = async () => { verifyAll.disabled = true; verifyAll.textContent = "verifying…"; await outbound.verifyAll(outbound.list().filter((e) => e.via === "heimdall").map((e) => e.id)); await openAudit(null); };
    const exp = el("button", "ob-btn", "export JSON");
    exp.onclick = () => { const b = new Blob([outbound.exportJson()], { type: "application/json" }); const a = el("a"); a.href = URL.createObjectURL(b); a.download = "fold-outbound-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    const clr = el("button", "ob-btn", "clear");
    clr.onclick = () => { outbound.clear(); openAudit(null); };
    actions.append(verifyAll, exp, clr);
    head.append(actions);
    sec.append(head);
    const list = outbound.list().slice(-40).reverse();
    if (!list.length) { sec.append(el("p", "empty-hint", "nothing has left this machine in this session — local models, local reads and the khora never leave it.")); container.append(sec); return; }
    const LV = { gate: "raw", masked: "masked", abstract: "abstract", worlds: "worlds", direct: "direct" };
    for (const e of list) {
      const row = el("div", "ob-row" + (e.grade.leaks.length ? " leak" : "")); row.dataset.auditEntry = e.id;
      const top = el("div", "ob-top");
      top.append(el("span", "ob-t", String(e.at).slice(11, 19)), el("span", "ob-badge lv-" + e.grade.level, LV[e.grade.level] || e.grade.level), el("span", "ob-who", (e.model || "") + (e.host ? " · " + e.host : "") + (e.via === "direct" ? "" : e.verification?.host ? " → " + e.verification.host : "")), el("span", "ob-bytes", formatBytes(e.bytes)));
      const v = e.verification;
      top.append(el("span", "ob-ver " + (v?.verified === true ? "ok" : v?.verified === false ? "bad" : "na"), v?.verified === true ? "✓ heimdall agrees" : v?.verified === false ? "✗ disagrees" : e.via === "direct" ? "direct" : "unverified"));
      if (e.grade.leaks.length) top.append(el("span", "ob-leak", `⚠ ${e.grade.leaks.length} leak${e.grade.leaks.length === 1 ? "" : "s"}`));
      row.append(top);
      const det = el("div", "ob-det"); det.hidden = e.id !== focusId;
      det.append(el("div", "ob-line", `${e.purpose || e.kind}${e.run ? " · " + e.run : ""} · ${e.status}${e.error ? " — " + e.error : ""}`));
      for (const n of e.grade.notes) det.append(el("div", "ob-note", n));
      for (const l of e.grade.leaks) det.append(el("div", "ob-leakline", `⚠ ${l.type}: ${l.kind || l.term || ""}${l.detail ? " — " + l.detail : ""}`));
      det.append(el("div", "ob-sub", "provenance"));
      det.append(el("div", "ob-line", e.segments.map((sg) => `${sg.role} · ${sg.provenance} · ${sg.chars} chars`).join("  |  ")));
      if (e.worlds) det.append(el("div", "ob-line", `world set ${e.worlds.setId} · slot ${e.worlds.slot} of ${e.worlds.n} — the real world is not recorded anywhere that is sent`));
      det.append(el("div", "ob-sub", "exact content sent"));
      for (const m of e.messages) { const pre = el("pre", "ob-pre"); pre.textContent = `[${m.role}]\n` + String(m.content).slice(0, 6000) + (String(m.content).length > 6000 ? `\n… (${String(m.content).length - 6000} more chars)` : ""); det.append(pre); }
      if (v) det.append(el("div", "ob-line " + (v.verified ? "ob-okline" : "ob-badline"), v.verified ? `heimdall's ledger: same content · host ${v.host} · ${v.bytes} B on the wire · sha256 ${String(v.wireSha256 || "").slice(0, 16)}… · HTTP ${v.status ?? "?"}` : "not verified: " + v.problems.join("; ")));
      const vb = el("button", "ob-btn", v ? "verify again" : "verify against heimdall"); vb.onclick = async () => { vb.disabled = true; await outbound.verify(e.id); openAudit(e.id); };
      det.append(vb);
      top.onclick = () => { det.hidden = !det.hidden; };
      row.append(det);
      sec.append(row);
    }
    container.append(sec);
  }

  /* ---------------- collapsible sections ---------------- */
  // Only the Projects section collapses, and only once it has projects in it: an
  // empty section is a heading, and the chat list is never worth hiding.
  const projectsSec = document.querySelector('.sec[data-sec="projects"]');
  const projectsHead = projectsSec?.querySelector(".sec-head");
  if (projectsSec && collapsed.projects) projectsSec.classList.add("collapsed");
  if (projectsHead) projectsHead.onclick = (e) => {
    if (e.target.closest("button") || !projectsHead.dataset.collapsible) return;
    projectsSec.classList.toggle("collapsed");
    projectsHead.setAttribute("aria-expanded", projectsSec.classList.contains("collapsed") ? "false" : "true");
    collapsed.projects = projectsSec.classList.contains("collapsed"); save("fold-chat:collapse", collapsed);
  };
  function paintSections() {
    if (!projectsHead) return;
    const has = Object.keys(projects).length > 0;
    projectsHead.classList.toggle("collapsible", has);
    if (has) {
      projectsHead.dataset.collapsible = "1";
      if (!projectsHead.hasAttribute("tabindex")) activatable(projectsHead);
      projectsHead.setAttribute("aria-expanded", projectsSec.classList.contains("collapsed") ? "false" : "true");
    } else {
      delete projectsHead.dataset.collapsible;
      projectsHead.removeAttribute("tabindex"); projectsHead.removeAttribute("role"); projectsHead.removeAttribute("aria-expanded");
      projectsSec.classList.remove("collapsed");
    }
  }

  /* ---------------- rail / topbar ---------------- */
  // On a phone the rail + sidebar are one overlay drawer: ☰ opens it; the scrim,
  // Escape, the ✕-style toggle, picking a chat or any rail action closes it. On
  // wider screens none of this applies (the .nav-open class is only styled in
  // the phone media query).
  const phone = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
  function setNav(openIt) { root.classList.toggle("nav-open", !!openIt); E.topMenu?.setAttribute("aria-expanded", openIt ? "true" : "false"); }
  if (E.topMenu) E.topMenu.onclick = () => { setNav(true); E.railToggle.focus(); };
  if (E.scrim) E.scrim.onclick = () => setNav(false);
  $("nav")?.addEventListener("click", (e) => { const b = e.target.closest(".rail button"); if (b && b.id !== "railToggle") setNav(false); });
  // An explicit ✕ on the open phone drawer (it was only closable by the sidebar
  // icon, the scrim, or Escape). Hidden on wide screens by CSS.
  const navClose = el("button", "navclose"); navClose.type = "button"; navClose.id = "navClose";
  navClose.title = "Close menu"; navClose.setAttribute("aria-label", "Close menu");
  navClose.innerHTML = CLOSE_SVG;
  navClose.onclick = () => { setNav(false); E.topMenu?.focus(); };
  $("nav")?.querySelector(".rail")?.append(navClose);
  // Escape layers: a menu / dialog / popup above closes ONLY itself (menuAt and the
  // effort menu stop or mark the event); then the nav drawer; then the Evidence drawer.
  const overlayOpen = () => !!document.querySelector(".modal:not([hidden]), .pop, .epop");
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || overlayOpen()) return;
    if (root.classList.contains("nav-open")) { setNav(false); E.topMenu?.focus(); return; }
    if (E.drawer.style.display !== "none") { e.preventDefault(); toggleDrawer(); (drawerOpener || E.railEvidence).focus?.(); }
  });
  // The keyboard must not cover the composer: on a phone the app is exactly as
  // tall as the visual viewport (dvh in the CSS is the fallback).
  if (window.visualViewport) {
    const fit = () => { if (phone?.matches) root.style.setProperty("--app-h", window.visualViewport.height + "px"); else root.style.removeProperty("--app-h"); };
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
    phone?.addEventListener?.("change", fit);
    fit();
  }
  E.railToggle.onclick = () => {
    if (phone?.matches) { setNav(false); return; }
    E.side.classList.toggle("hide"); markOn(E.railToggle, !E.side.classList.contains("hide"));
  };
  if (E.topNew) E.topNew.onclick = newChat;
  { const chatsNew = $("chatsNew"); if (chatsNew) chatsNew.onclick = newChat; }   // the + beside the Chats header: the same handler (an empty current chat is reused)
  // FOLDS: the agent's artifact threads. A make-ask in the Agent engagement opens one; the rail and the sidebar list them.
  const folds = mountFolds({ main: E.main, list: $("folds"), newBtn: $("foldsNew"), railBtn: $("railFolds"), toast,
    getModelId: () => { const mm = selectedModel(); return mm && !mm.none ? mm.id : null; },
    // THE READING PIPELINE, handed to the fold: the app owns search + readers +
    // memo, so a fold turn can GO FIND EXAMPLES before it builds. (Exit-gated
    // fetch underneath; failures degrade to "no examples", never a wedge.)
    research: async (q, { onStep } = {}) => {
      try { return await web.searchWeb(q, { effort: "balanced", read: 3, memo: pageMemo, onStep }); }
      catch { return { results: [], passages: [], trace: [] }; }
    } });
  for (const id of ["chats", "projects", "topNew", "chatsNew"]) $(id)?.addEventListener("click", () => folds.isOpen() && folds.close(), true);
  // ADD A CODEBASE: choose a folder → the agent's workspace (fold-chat-workspace.js),
  // shown in the fold as a worktree with each file viewable as a projection or a log.
  { const btn = $("foldsCodebase"); if (btn) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.multiple = true; inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); inp.style.display = "none";
    inp.addEventListener("change", async () => {
      const files = {};
      for (const f of inp.files) { const p = String(f.webkitRelativePath || f.name).replace(/^[^/]+\//, ""); if (!p || f.size > 400000) continue; try { files[p] = await f.text(); } catch { /* skip unreadable */ } }
      if (Object.keys(files).length) folds.setCodebase(files);
      inp.value = "";
    });
    document.body.appendChild(inp);
    btn.onclick = () => inp.click();
  } }
  E.railSearch.onclick = async () => {
    const q = await askDialog({ title: "Search chats", value: search, placeholder: "Search titles", okLabel: "Search" });
    if (q == null) return;
    search = q.trim();
    renderChats();
  };
  E.railEvidence.onclick = (e) => { e.preventDefault(); drawerOpener = e.currentTarget; toggleDrawer(); };
  // A live window on every external call and how it was anonymized (its own module: its own button, panel and styles).
  if (!HIDE_EXTERNAL) mountMonitor({ outbound });
  E.topFocus.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  // (The per-thread "Process" toggle is gone: grounding is always on, and the
  // per-answer "how this was answered" line is collapsed by default. A thread
  // whose stored `grounding` is false still hides it; the global Transparency
  // setting is the switch.)
  // THE TURN CHIP — what the NEXT message will be, in one control in the composer:
  //   mode    Chat answers from the routed models; Agent hands the ask to the
  //           machine door (read → derive → execute → retain)
  //   effort  how hard the fold works: fast / balanced / deep (levers in web.EFFORT)
  //             fast      one web search, 2 reads, loose gate, no void — quick
  //             balanced  full scopes + swarm gate + on-topic reads + void (default)
  //             deep      read 6+, strict swarm, and an explicit FALSIFY pass: every
  //                       grounded claim is re-checked, weak/unsupported ones named
  // Effort is stamped on the ask when it is SENT (submit handler, run()), so moving
  // it never reaches back into a turn already sent; the chip remembers the last
  // choice (`fold-chat:effort`). In Agent the effort row is not offered: effort
  // only shapes a grounded turn. The lock says every request goes sealed-external.
  const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const CARET_SVG = '<svg class="e-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>';
  const MODES = [["chat", "Chat", "answers from the routed models, grounded on the web"], ["code", "Agent", "hands the ask to the machine door and lands real artifacts"]];
  const turnChip = el("button", "echip");
  turnChip.type = "button"; turnChip.id = "turnBtn";
  turnChip.setAttribute("aria-haspopup", "menu"); turnChip.setAttribute("aria-expanded", "false");
  turnChip.innerHTML = `<span class="e-lock">${LOCK_SVG}</span><span class="e-v"></span>${CARET_SVG}`;
  if (E.turnSlot) E.turnSlot.append(turnChip);
  let turnPop = null;
  function effortLevel(k) { return web.EFFORT_LEVELS.find((l) => l.key === k) || web.EFFORT_LEVELS[1]; }
  function paintTurn() {
    const isAgent = engagement === "code";
    const lvl = effortLevel(composerEffort);
    const ans = ANSWER_MODES.find((a) => a.key === composerAnswer) || ANSWER_MODES[0];
    // THE CHIP SAYS ONLY WHAT DEPARTS FROM THE DEFAULTS (Balanced, facing page): by default it is just the lock and the chevron.
    const parts = isAgent ? ["Agent"] : [composerEffort !== "balanced" ? lvl.label : null, composerAnswer === "snips" ? "Sources only" : null].filter(Boolean);
    turnChip.querySelector(".e-v").textContent = parts.join(" \u00b7 ");
    turnChip.dataset.bare = parts.length ? "" : "1";
    const what = isAgent ? "Agent — the machine door" : `Chat — effort ${lvl.label} (${lvl.note}); answer: ${ans.label} (${ans.note})`;
    const tip = `This turn: ${what}. Sealed-external. Effort and answer mode apply to the message you send next, and to that message only.`;
    turnChip.dataset.answer = composerAnswer;
    paintHint();
    turnChip.title = tip;
    turnChip.setAttribute("aria-label", tip + " Change.");
    turnChip.dataset.effort = composerEffort;
    turnChip.dataset.mode = isAgent ? "code" : "chat";
  }
  function setEffort(k) {
    const next = web.normEffort(k, composerEffort);
    if (next !== composerEffort) effortMoved = true;
    composerEffort = next;
    try { localStorage.setItem("fold-chat:effort", composerEffort); } catch (e) {}
    paintTurn();
  }
  function setAnswerMode(k) {
    const next = normAnswerMode(k, composerAnswer);
    if (next !== composerAnswer) answerMoved = true;
    composerAnswer = next;
    try { localStorage.setItem("fold-chat:answerMode", composerAnswer); } catch (e) {}
    paintTurn();
  }
  function closeTurnMenu(refocus = false) {
    if (!turnPop) return;
    turnPop.remove(); turnPop = null;
    turnChip.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", turnAway, true);
    if (refocus) turnChip.focus();
  }
  function turnAway(e) { if (turnPop && !turnPop.contains(e.target) && !turnChip.contains(e.target)) closeTurnMenu(); }
  function openTurnMenu() {
    if (turnPop) { closeTurnMenu(true); return; }
    const pop = el("div", "epop");
    pop.setAttribute("role", "menu"); pop.setAttribute("aria-label", "This turn");
    const row = (h, items, current, onPick, attr) => {
      pop.append(el("div", "epop-h", h));
      for (const it of items) {
        const b = el("button"); b.type = "button";
        b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", it.key === current ? "true" : "false");
        b.dataset[attr] = it.key;
        b.append(el("b", "", it.label), el("span", "", it.note));
        b.onclick = () => { onPick(it.key); closeTurnMenu(true); };
        pop.append(b);
      }
    };
    if (!HIDE_AGENT) row("Mode", MODES.map(([key, label, note]) => ({ key, label, note })), engagement, (k) => setEngagement(k), "mode");
    if (engagement !== "code") row("Effort · this message", web.EFFORT_LEVELS, composerEffort, (k) => setEffort(k), "effort");
    if (engagement !== "code") row("Answer · this message", ANSWER_MODES, composerAnswer, (k) => setAnswerMode(k), "answer");
    pop.addEventListener("keydown", (e) => {
      const items = [...pop.querySelectorAll("button")];
      const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); closeTurnMenu(true); }
      else if (e.key === "Tab") closeTurnMenu();
    });
    document.body.append(pop);
    turnPop = pop;
    turnChip.setAttribute("aria-expanded", "true");
    // Open upward from the chip (the composer sits at the bottom), clamped to
    // the viewport so it is whole at phone width.
    const r = turnChip.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pr.width - 8)) + "px";
    pop.style.top = Math.max(8, r.top - pr.height - 8 >= 8 ? r.top - pr.height - 8 : Math.min(r.bottom + 8, window.innerHeight - pr.height - 8)) + "px";
    document.addEventListener("mousedown", turnAway, true);
    (pop.querySelector('[aria-checked="true"]') || pop.querySelector("button")).focus();
  }
  turnChip.onclick = openTurnMenu;
  // (The globe is gone: every turn except a greeting searches the web before it
  // answers — there is no switch to show, and an always-on indicator is noise.)
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
        taint.addFromText(raw, "local-read"); taint.add(file.name, "filename");
        const reading = await client.read(raw, { base: bridge, source: file.name, sessionId: sessions[activeId]?.codeSessionId || null });
const s = sessions[activeId] || (newChat(), sessions[activeId]);
    // A typed clip/stitch sentence is a CUT, never a model turn: the parser is
    // deterministic, the cut is real bytes on this machine, and nothing is invented.
    const clip = clipAsk(text);
    if (clip) {
      E.input.value = ""; E.input.style.height = "auto";
      s.messages.push({ role: "user", content: text, at: now(), mode: normMode(engagement) });
      s.title = s.title === "New chat" ? text.slice(0, 46) : s.title; s.updated = now();
      save("fold-chat:sessions", sessions);
      setView(false);
      appendMsg(s, "user", text, { index: s.messages.length - 1, mode: normMode(engagement) });
      renderChats();
      runClip(s.id, clip);
      return;
    }
        const note = readingNote(file.name, raw.length, reading);
        s.attachments = [...(s.attachments || []), { name: file.name, bytes: raw.length, referents: (reading.referents || []).length, relations: (reading.relations || []).length }];
        // The reading rides the history as grounded material — never the raw
        // file. The model receives what the khora read, not what was uploaded.
        s.messages.push({ role: "user", content: note, at: now(), attachment: file.name });
        s.updated = now();
        save("fold-chat:sessions", sessions);
        appendMsg(s, "user", note, { attachment: file.name });
        E.stage.textContent = "";
        toast(`read ${file.name} through the khora — ${(reading.referents || []).length} referent(s), ${(reading.relations || []).length} relation(s)`);
      } catch (err) {
        E.stage.textContent = "";
        toast("khora read failed: " + err.message);
      }
    };
    pick.click();
  };

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

  /* ---------------- other tabs ---------------- */
  // Each tab holds the whole sessions map; localStorage is shared. When another
  // tab writes, merge what it wrote into THIS tab's maps (life.mergeSessions:
  // newer `updated` wins, a chat only the other tab has is kept, a deleted id
  // stays dead) IN PLACE, so the open chat and any running turn survive (a
  // running chat keeps its local object), then redraw. The merge itself never
  // writes back; the next save() merges the same way.
  function syncFromStorage() {
    const tombs = loadTombs();
    const ch = life.applyInPlace(sessions, life.mergeSessions(sessions, load("fold-chat:sessions", {}) || {}, tombs, { keep: [...inflight.keys()] }));
    life.applyInPlace(projects, life.mergeSessions(projects, load("fold-chat:projects", {}) || {}, tombs));
    // A chat deleted in the other tab: its running turn here is cancelled too.
    for (const id of ch.removed) inflight.get(id)?.ac.abort();
    if (filterProject && !projects[filterProject]) filterProject = null;
    if (activeId && ch.removed.includes(activeId)) {
      const next = life.nextAfterDelete(sessions, { id: activeId, filterProject, search });
      if (next.clearSearch) search = "";
      if (next.id) open(next.id); else closeThread();
    } else if (activeId && ch.replaced.includes(activeId)) open(activeId);
    renderProjects(); renderChats();
  }
  window.addEventListener("storage", (e) => {
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.key === null || e.key === "fold-chat:sessions" || e.key === "fold-chat:projects" || e.key === DELETED_KEY) syncFromStorage();
  });

  /* ---------------- boot ---------------- */
  applyTheme(themePref());
  renderProjects();
  paintTurn();
  // The tab's own models are listed FIRST, without waiting for any probe: the app boots and can answer with no bridge at all.
  // With NO_HEIMDALL there is NO probe at all — the in-tab models are the whole list. Otherwise the bridge is auto-detected
  // (a custom override, the same-origin embedded /heimdall, then the legacy local port) and whatever it serves is listed besides.
  refreshModels({ pageOnly: true }).catch(() => {});
  const openFirstChat = () => refreshModels().then(() => {
    // Husks first (never-used "New chat" rows older than ten minutes), then the
    // most recent chat. NO chats is the welcome state — a reload after deleting
    // the last chat must not conjure an empty one; the first send creates it.
    const husks = life.pruneStaleEmpties(sessions, { minAgeMs: 10 * 60 * 1000 });
    if (husks.length) { tombstone(husks); save("fold-chat:sessions", sessions); }
    const first = life.byRecent(Object.values(sessions))[0];
    if (first) open(first.id); else closeThread();
    refreshMeter();
    startLoadedPoller();
  });
  if (NO_HEIMDALL) openFirstChat();
  else client.detectBridge({ override: opts.bridge || localStorage.getItem("fold-chat:bridge") || null }).then((found) => {
    if (found.ok) { bridge = found.base; bridgeHello = found.hello; }
    openFirstChat();
  });
}