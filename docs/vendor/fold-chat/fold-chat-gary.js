// fold-chat-gary.js — Gary's door: what the mouth is handed, in what order, and what never enters. Pure: no DOM, no IO.
//
// Gary (the khora's organs/gary.js, vendored by closure with Kondo and the firewall) owns PROMPTING. Holodeck runs every model
// call through `makeGary().hand(messages, …)`; the chat did not — it called `client.chat` with whatever `run()` had put
// together. This module is the chat's door, built the way the khora's holon.js and the holodeck's holodeck-ask.js build theirs:
//
//   hand(messages, ctx)    strike every address, read every rule, say what was found. Never throws, never rewrites a word
//                          the mouth says BACK (P186) — it changes only the input.
//   guard(messages, ctx)   the door every call passes (client.setPromptDoor): hand, and refuse BEFORE the network when Gary
//                          refuses. A refused call is never sent.
//   composeTurn(parts, ctx) one chat turn's messages, in Gary's order: ONE system message (the base, the facts the reply
//                          hears, the conversation fold, the sources/thread block), then the recent exchange, then THE
//                          QUESTION LAST, verbatim. A fold Gary REFUSES is withheld and not shipped (holodeck-ask.js:
//                          "a fold Gary refuses is withheld, not shipped"); a prompt that would not fit the window the model
//                          is actually loaded at is shrunk in a fixed order — never silently truncated in the middle.
//
// THE CHAT'S OWN RULE, kept beside Gary's: the model never speaks alone. A call that stands on nothing — no source, no earlier
// turn, no computed value — is REFUSED here (`model-never-alone`), whatever the caller thought. The product owner's one-line
// switch (ALONE_KINDS in fold-chat-gaps.js) is honoured by the caller passing `material: undefined` for a kind that may speak
// alone: an absence nobody measured is a gap, never a conviction.
//
// Omnilingual: nothing here reads case or a script. Gary's own checks that are English (the apparatus nouns, the prohibition
// verbs) simply never fire on text they do not recognise — they are never the reason a caseless ask is refused. Its one check
// that counts words (no-oracle-mode) is reached ONLY when the caller says nothing is in view, so a Han or Thai question with
// material in view passes the door as freely as an English one (fold-chat-gary.test.mjs pins both).

import { makeGary, garyDecision, SEVERITY, RULES } from "./vendor/khora/native/organs/gary.js";
import { makeKondo } from "./vendor/khora/native/organs/kondo.js";
import { apparatusMentions, strikeAddresses } from "./vendor/khora/native/organs/firewall.js";
import { buildTurnMessages, emptySummary } from "./vendor/the-fold/fold.js";
import { SOURCES_NOTE } from "./fold-chat-channels.js";

export { SEVERITY, RULES, garyDecision };

// ── the loaded window: what a model is ACTUALLY running at (Ollama's /api/ps `context_length`) ──────────────────────────
// Unknown is a GAP in Gary's own rule ("no_window"), never a verdict, so an empty map costs nothing and guesses nothing.
const windows = new Map();
const bare = (id) => String(id ?? "").replace(/:latest$/i, "");

/** Feed the windows the loaded-models poll saw: `[{ id, ctx }]` (ctx = `context_length` from /api/ps). */
export function noteWindows(entries) {
  for (const e of Array.isArray(entries) ? entries : []) {
    const n = Number(e?.ctx ?? e?.context_length);
    if (e?.id && Number.isFinite(n) && n > 0) windows.set(bare(e.id), n);
  }
}
export const windowOf = (model) => (windows.get(bare(model)) ?? null);
export const forgetWindows = () => windows.clear();

// ── the chat's own refusal, in Gary's shape ────────────────────────────────────────────────────────────────────────────
export const NEVER_ALONE = Object.freeze({
  rule: "model-never-alone",
  severity: SEVERITY.REFUSE,
  cites: "product rule: the model never speaks alone",
  detail: "nothing is in view — no source, no earlier turn, no computed value — so the model is not asked",
});

const lastTurnIsTheQuestion = (messages, question) => {
  if (question == null) return true;
  const last = messages.at(-1);
  // Gary strikes addresses in every turn, the person's included, so the comparison is against the struck question.
  return !!last && last.role === "user" && last.content === strikeAddresses(String(question));
};

// ── a line the prompt already carries is waste (Gary's nothing-twice, P232; Kondo counts it) ────────────────────────────────
// A thread turn quotes the earlier ask and answer in its own block ([T1] / [T2], fold-chat-thread.js threadPrompt) AND the recent
// exchange rides as real turns, so the same text is carried twice — measured with Kondo on a live-shaped thread turn: 144 of 206
// estimated tokens, and for a long earlier answer the rest of a small window. `carryOnce` drops an earlier ask+answer PAIR from the
// history when both are already inside the system block (whitespace-insensitive, the answer matched by its head because the block
// clips it). Only a whole pair goes, so the turns still alternate; the question is never touched.
const squash = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
export function carryOnce(history, block, { headChars = 200 } = {}) {
  const list = Array.isArray(history) ? history : [];
  if (!block || list.length < 2) return { history: list, dropped: 0 };
  const hay = squash(block);
  const inside = (m) => {
    const body = squash(String(m?.content ?? "").startsWith(SOURCES_NOTE) ? String(m.content).slice(SOURCES_NOTE.length) : m?.content);
    return body.length > 0 && hay.includes(body.slice(0, headChars));
  };
  const out = [];
  let dropped = 0;
  for (let i = 0; i < list.length; i++) {
    const a = list[i], b = list[i + 1];
    if (a?.role === "user" && b?.role === "assistant" && inside(a) && inside(b)) { dropped += 2; i++; continue; }
    out.push(a);
  }
  return { history: out, dropped };
}

export function makeDoor({ windowOf: windowFor = windowOf } = {}) {
  const kondo = makeKondo({ windowOf: windowFor });
  const gary = makeGary({ strikeAddresses, apparatusMentions, kondo, windowOf: windowFor });
  /** Arrays this door has already read: the guard does not read them twice (one record per call). */
  const handed = new WeakSet();
  let log = [];

  /** Read one call. `material`: a count when the caller measured what is in view (0 → refused), undefined when it did not. */
  function hand(messages, { model = null, maxTokens = 0, material = undefined, question = null, kind = "call", record = true } = {}) {
    const list = Array.isArray(messages) ? messages : [];
    let read;
    try { read = gary.hand(list, { model, options: maxTokens ? { num_predict: maxTokens } : {}, arm: "claims", material }); }
    catch (err) {
      // A door that throws is worse than no door: report it as a typed gap and pass the messages through untouched.
      read = { messages: list, struck: 0, findings: [], gaps: [{ type: "door_error", detail: String(err?.message || err) }], refused: [], tokens: 0, estimated: true, window: null };
    }
    const refused = [...read.refused];
    const findings = [...read.findings];
    if (material === 0) { refused.push({ ...NEVER_ALONE }); findings.push({ ...NEVER_ALONE }); }
    if (!lastTurnIsTheQuestion(read.messages, question)) {
      findings.push({ rule: "question-last", severity: SEVERITY.FLAG, cites: "P199", detail: "the person's own message is not the last turn, verbatim" });
    }
    const out = { messages: read.messages, struck: read.struck, findings, gaps: read.gaps, refused, tokens: read.tokens, estimated: read.estimated, window: read.window, kind };
    handed.add(out.messages);
    if (record) log.push({ ...garyDecision({ act: kind, model, read: out }), ...(refused.length ? { refused: refused.map((f) => f.rule) } : {}) });
    return out;
  }

  /** The door every model call passes (client.setPromptDoor). Refuses before anything is sent. */
  function guard(messages, ctx = {}) {
    if (Array.isArray(messages) && handed.has(messages)) return { messages, refused: [], findings: [], struck: 0, already: true };
    return hand(messages, { ...ctx, kind: ctx.kind || "call" });
  }

  /** The turn's decisions so far (rules and counts, never the prompt's text), and clear them. */
  function drain() { const out = log; log = []; return out; }

  /**
   * One chat turn's messages, in Gary's order.
   *  parts: { basePrompt, cues[], summary, history, question, sourceBlock, recencyWindow, shrinkSource(maxChars) }
   *  ctx:   { model, maxTokens, material }
   * Returns { messages, refused[], findings[], gaps[], withheld[], struck, tokens, window, estimated }.
   * `withheld` names what was left out and why it is not in the prompt (never silently): "cues" · "fold" · "history" · "sources".
   */
  function composeTurn(parts, ctx = {}) {
    const { basePrompt = "", cues = [], summary = null, history = [], question = "", sourceBlock = null, recencyWindow, shrinkSource = null } = parts || {};
    const { model = null, maxTokens = 0, material = undefined, dedupe = false } = ctx;
    const facts = (cues || []).map((c) => (typeof c === "string" ? c : c?.text)).map((t) => String(t ?? "").trim()).filter(Boolean);
    const hasFold = !!summary && (!!summary.topic || (summary.records || []).length > 0);   // the two blocks buildTurnMessages projects
    const state = { cues: facts.length > 0, fold: hasFold, rw: recencyWindow, src: sourceBlock };
    // the earlier exchange is carried ONCE: when the system block quotes it, the turns that repeat it are left out (dedupe)
    const once = dedupe ? carryOnce(history, sourceBlock) : { history, dropped: 0 };
    const build = () => buildTurnMessages({
      basePrompt: state.cues ? [basePrompt, facts.join(" ")].filter(Boolean).join("\n\n") : basePrompt,
      summary: state.fold ? summary : emptySummary(),
      history: once.history, question, sourceBlock: state.src, recencyWindow: state.rw,
    });
    const read = () => hand(build(), { model, maxTokens, material, question, kind: "turn", record: false });
    const withheld = once.dropped ? ["repeats"] : [];
    let r = read();

    // 1. A REFUSE: the fold (what the reply hears about the conversation, then the conversation's own running summary) is
    //    withheld, one layer at a time, and the prompt read again. What Gary still refuses after that is not shipped at all.
    if (r.refused.length && state.cues) { state.cues = false; withheld.push("cues"); r = read(); }
    if (r.refused.length && state.fold) { state.fold = false; withheld.push("fold"); r = read(); }

    // 2. Over the window the model is loaded at (only when that window is KNOWN): shed, in this order, the oldest of the
    //    exchange, the cues, then the sources' own length — never the question, and never the middle of the prompt.
    const over = () => r.findings.some((f) => f.rule === "fits-the-window");
    if (!r.refused.length && over() && once.history.length > 2 && state.rw !== 2) { state.rw = 2; withheld.push("history"); r = read(); }
    if (!r.refused.length && over() && state.cues) { state.cues = false; if (!withheld.includes("cues")) withheld.push("cues"); r = read(); }
    if (!r.refused.length && over() && typeof shrinkSource === "function" && sourceBlock) {
      for (const maxChars of [2000, 1000, 500, 250]) {
        state.src = shrinkSource(maxChars) ?? state.src;
        if (!withheld.includes("sources")) withheld.push("sources");
        r = read();
        if (!over()) break;
      }
    }
    // The decision that stands is the one recorded.
    r.withheld = withheld;
    log.push({ ...garyDecision({ act: "turn", model, read: r }), ...(withheld.length ? { withheld: [...withheld] } : {}), ...(r.refused.length ? { refused: r.refused.map((f) => f.rule) } : {}) });
    return r;
  }

  return { hand, guard, composeTurn, drain, gary, kondo, RULES, SEVERITY };
}

/** The page's door: one per page, reading the windows the loaded-models poll noted. */
export const door = makeDoor();
