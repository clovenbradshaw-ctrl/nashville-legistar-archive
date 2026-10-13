// fold-chat-channels.js — SEPARATE CHANNELS for one assistant message.
//
// A message is written by more than one author, and the record keeps them
// apart (Constitution II.9 the mouth test: a model authored THIS and only this;
// III.3 the absent test: a gap is DRAWN, as a typed mark, not said as prose):
//
//   message.content          ONLY what the model wrote. Nothing system-authored
//                            is ever appended. History, the conversation fold,
//                            chat naming, fork / continue / edit read this.
//   record.void              the gap, STRUCTURED (see voidReport) — drawn as its
//                            own element, never a sentence the assistant said.
//   message.notices          system notes about the turn (an identity claim the
//                            fold withdrew, a model refusal it replaced, an agent
//                            that produced no code) — each its own element.
//   record.process           what the fold DID (classify → search → read …).
//
// This module is pure and node-testable: no DOM, no IO. It holds the void
// report, its one-line text (for the process panel ONLY), the migration of
// sessions stored before the channels were split, and `modelHistory` — the one
// function that decides what of the transcript may ride back to the model.

import { checkable } from "./fold-chat-discourse.js";
import { searchAttempts, searchSummary } from "./fold-chat-gaps.js";
import { styleSafeMessages } from "./fold-chat-histkind.js";
import { genVoidLabel, genVoidText } from "./fold-chat-genvoid.js";

const OPEN = "a broader web/records/news search";
const ATTACH = "attach the document you are working from";
/** Prefix that marks a sources-authored turn in the history the model reads. */
export const SOURCES_NOTE = "[Passages quoted from sources — not written by you:] ";
// "generate" (fold-chat-genvoid.js): a WRITING request the fold could not honour (the essay was not written, and why), drawn as its own mark.
export const VOID_KINDS = Object.freeze(["unreached", "unsupported", "partial", "live", "model", "generate"]);

const domainOfUrl = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return null; } };
// A passage ref reads "Source — Title"; the title is what a person recognises.
const titleOfRef = (ref) => { const s = String(ref ?? ""); const i = s.indexOf(" — "); return (i >= 0 ? s.slice(i + 3) : s).trim() || s; };

/** THE VOID — what the turn could NOT establish, as DATA. Returns null when the
 *  answer was fully grounded, and always null for a turn with no claims to check
 *  (a poem, a story, a greeting): a gap is only a gap where something was asked
 *  to be true.
 *    { kind: 'unreached' | 'unsupported' | 'partial',
 *      counts: { sentences, grounded },
 *      read:   [{ title, domain, url }],     what was read (may be empty)
 *      tried:  [engine…],                    what was searched when nothing was reached
 *      question, closeBy: [string…] } */
export function voidReport(record, question, webPassages, webTrace) {
  if (!record || record.creative) return null;
  // A SOURCES-AUTHORED turn is the sources' words, not a claim of ours: it is never scored, so it has no void.
  if (record.authored === "sources") return null;
  if (record.kind && !checkable(record.kind)) return null;
  // ADVICE is searched but is not a claim to score: its void stands down unless the
  // answer committed to a figure that nothing read says (a number is checkable).
  if (record.kind === "advice" && !(record.unsupported?.numbers?.length)) return null;
  const read = (Array.isArray(webPassages) ? webPassages : []).slice(0, 6).map((p) => ({
    title: titleOfRef(p.ref), domain: domainOfUrl(p.url || p.source), url: p.url || (/^https?:/i.test(String(p.source || "")) ? p.source : null),
  }));
  const nRead = Array.isArray(webPassages) ? webPassages.length : 0;
  const g = record.coverage?.grounded || 0, t = record.coverage?.total || 0;
  let kind;
  if (!nRead) kind = "unreached";
  else if (g === 0) kind = "unsupported";
  else if (g < t) kind = "partial";
  else return null; // fully grounded — nothing missing
  // What was actually searched comes from the trace the search left (gaps.js), never
  // from the model: the engines tried, why they failed, and an app-authored sentence.
  const facts = kind === "unreached" ? searchAttempts(webTrace) : null;
  const tried = facts ? [...new Set(facts.attempts.map((a) => a.engine || a.name))].slice(0, 5) : [];
  return {
    kind,
    counts: { sentences: t, grounded: g },
    read,
    tried,
    ...(facts ? { attempts: facts.attempts.slice(0, 8), readFailed: facts.readFailed, note: searchSummary(facts, question) } : {}),
    question: String(question || "").trim().slice(0, 90),
    closeBy: [OPEN, ATTACH],
  };
}

/** The short typed label a gap block wears — which silence it is. */
export function voidLabel(v) {
  if (!v) return "";
  if (v.kind === "unreached") return "no source was reached";
  if (v.kind === "live") return "live data \u2014 nothing reachable";
  if (v.kind === "generate") return genVoidLabel(v);
  if (v.kind === "model") return "from the model, no sources";
  if (v.kind === "unsupported") return "nothing retrieved supports this";
  if (v.kind === "partial") {
    const miss = Math.max(0, (v.counts?.sentences || 0) - (v.counts?.grounded || 0));
    return `${miss} of ${v.counts?.sentences || 0} sentence${(v.counts?.sentences || 0) === 1 ? "" : "s"} ${miss === 1 ? "has" : "have"} no source`;
  }
  return "gap";
}

/** The void as ONE LINE of text — for the Process / disclosure panel and the
 *  process JSON only. It is never message content and never rendered as the
 *  assistant's prose. */
export function voidText(v) {
  if (!v) return "";
  if (v.kind === "legacy") return String(v.text || "");
  if (v.kind === "generate") return genVoidText(v);
  if (v.kind === "live") return "\u27C2 void \u2014 live data \u2014 nothing reachable; " + String(v.note || "").replace(/\s+/g, " ").trim();
  if (v.kind === "model") return "\u27C2 void \u2014 from the model, no sources; " + String(v.note || "").replace(/\s+/g, " ").trim();
  const parts = [];
  if (v.kind === "unreached") parts.push(`no source was reached (tried ${(v.tried || []).join(", ") || "the web"})`);
  else if (v.kind === "unsupported") parts.push(`read ${(v.read || []).length} source(s) — ${(v.read || []).slice(0, 4).map((r) => r.title).join("; ")} — none established the claim; the search itself may have missed`);
  else parts.push(`${Math.max(0, (v.counts?.sentences || 0) - (v.counts?.grounded || 0))} of ${v.counts?.sentences || 0} sentence(s) had no source`);
  if (v.question) parts.push(`"${v.question}" is still open`);
  parts.push("to close it: " + (v.closeBy || []).join(", or "));
  return "⟂ void — " + parts.join("; ") + ".";
}

/** A stored void in any shape (structured, legacy string, absent) as structured. */
export function normVoid(x, record = null) {
  if (!x) return null;
  if (typeof x === "string") return parseLegacyVoid(x, record);
  if (typeof x === "object" && x.kind) return x;
  return null;
}

/** Parse the legacy paragraph `⟂ void — …` back into the structured void,
 *  best-effort. `record` (optional) supplies exact counts and the source urls
 *  from the turn's own web trace. If the text is not a shape voidText wrote, it
 *  is kept raw as { kind: 'legacy', text } — never dropped. */
export function parseLegacyVoid(text, record = null) {
  const raw = String(text ?? "").trim();
  const legacy = { kind: "legacy", text: raw };
  const m0 = raw.match(/^⟂ void — ([\s\S]*?)\.?$/);
  if (!m0) return legacy;
  let body = m0[1];
  let closeBy = [OPEN, ATTACH];
  const ci = body.lastIndexOf("; to close it: ");
  if (ci >= 0) {
    const closeText = body.slice(ci + "; to close it: ".length);
    body = body.slice(0, ci);
    closeBy = closeText.split(/, or /).map((x) => x.trim()).filter(Boolean);
    if (!closeBy.length) return legacy;
  } else return legacy;
  let question = "";
  const qm = body.match(/; "([\s\S]*)" is still open$/);
  if (qm) { question = qm[1]; body = body.slice(0, qm.index); }
  const cov = record?.coverage;
  const counts = (sentences, grounded) => ({ sentences: cov?.total ?? sentences, grounded: cov?.grounded ?? grounded });
  let mm;
  if ((mm = body.match(/^no source was reached \(tried ([\s\S]*)\)$/))) {
    return { kind: "unreached", counts: counts(0, 0), read: [], tried: mm[1].split(", ").map((x) => x.trim()).filter(Boolean), question, closeBy };
  }
  if ((mm = body.match(/^read (\d+) source\(s\) — ([\s\S]*) — none established the claim; the search itself may have missed$/))) {
    const titles = mm[2].split("; ").map((x) => titleOfRef(x));
    // The turn's own web trace listed each read url in order; zip them when the
    // counts agree, so the migrated block still links out.
    const urls = (Array.isArray(record?.web) ? record.web : []).filter((w) => w.read).map((w) => w.read);
    const zip = urls.length === Number(mm[1]) && urls.length >= titles.length;
    const read = titles.map((title, i) => ({ title, domain: zip ? domainOfUrl(urls[i]) : null, url: zip ? urls[i] : null }));
    return { kind: "unsupported", counts: counts(0, 0), read, tried: [], question, closeBy };
  }
  if ((mm = body.match(/^(\d+) of (\d+) sentence\(s\) had no source$/))) {
    const total = Number(mm[2]);
    return { kind: "partial", counts: counts(total, total - Number(mm[1])), read: [], tried: [], question, closeBy };
  }
  return legacy;
}

// A trailing system paragraph: the void note, or a `⟂ fold:` note (an identity
// correction), appended to the model's text by builds before the channels split.
const VOID_TAIL = /(^|\n)[ \t]*(⟂ void — [\s\S]*)$/;
const FOLD_TAIL = /(^|\n)[ \t]*(⟂ fold: [^\n]*)\s*$/;

/** Split a stored assistant `content` into what the model wrote and the
 *  system-authored paragraphs that were glued to its end. Pure; idempotent on
 *  clean content. */
export function splitTrailingChannels(content) {
  let text = String(content ?? "");
  let voidText = null;
  const notes = [];
  const vm = text.match(VOID_TAIL);
  if (vm) { voidText = vm[2].trim(); text = text.slice(0, vm.index).replace(/\s+$/, ""); }
  let fm;
  while ((fm = text.match(FOLD_TAIL))) { notes.unshift(fm[2].trim()); text = text.slice(0, fm.index).replace(/\s+$/, ""); }
  return { content: voidText || notes.length ? text : String(content ?? ""), void: voidText, notes };
}

/** Migrate ONE stored message in place. Returns true if it changed. The void
 *  paragraph moves into `record.void` (or message.void when the turn carried no
 *  record); `⟂ fold:` lines move into message.notices; a creative turn's void is
 *  dropped (a poem has no claims) but its process line keeps the history. */
export function migrateMessage(m) {
  if (!m || m.role !== "assistant") return false;
  let changed = false;
  const rec = m.grounding && typeof m.grounding === "object" ? m.grounding : null;
  // An agent / penelope-generation record keeps its own `void` (a different
  // shape, not the chat gap) — leave it alone.
  const foreign = !!rec && !!(rec.generate || rec.code);
  const creative = !!rec && !foreign && (rec.creative || rec.kind === "generate");
  const { content, void: vt, notes } = splitTrailingChannels(m.content);
  if (vt || notes.length) { m.content = content; changed = true; }
  const incoming = vt ? parseLegacyVoid(vt, rec) : null;
  if (rec && !foreign && typeof rec.void === "string") { rec.void = parseLegacyVoid(rec.void, rec); changed = true; }
  if (incoming) {
    if (creative) { /* no claims — no void */ }
    else if (rec && !foreign) { if (!rec.void || typeof rec.void !== "object") rec.void = incoming; }
    else if (!m.void) m.void = incoming;
  }
  if (rec && creative) {
    // A typed gap the APP authored for a turn with no answer (live / model / unreached-with-attempts)
    // is the turn itself, not a claim-score on a creative piece: it is never migrated away.
    const appGap = rec.void && typeof rec.void === "object" && (rec.void.kind === "live" || rec.void.kind === "model" || rec.void.kind === "generate" || Array.isArray(rec.void.attempts));
    if (rec.void && !appGap) { delete rec.void; changed = true; }
    if (!rec.creative) { rec.creative = true; changed = true; }
  }
  if (notes.length) {
    m.notices = [...(Array.isArray(m.notices) ? m.notices : []), ...notes.map((text) => ({ kind: "fold", text }))];
  }
  return changed;
}

/** Migrate every session once. A session carries `channels: 1` once done, so
 *  this is a lazy, one-time pass; returns whether anything changed (so the
 *  caller saves back). */
export function migrateSessions(sessions) {
  let changed = false;
  for (const s of Object.values(sessions || {})) {
    if (!s || s.channels === 1) continue;
    for (const m of s.messages || []) if (migrateMessage(m)) changed = true;
    s.channels = 1; changed = true;
  }
  return changed;
}

/** What the model wrote in one stored message — defensively stripped of any
 *  system paragraph an unmigrated session may still carry. */
export function modelText(m) {
  if (!m) return "";
  return m.role === "assistant" ? splitTrailingChannels(m.content).content : String(m.content ?? "");
}

/** The transcript as the MODEL may see it: user and assistant turns, each
 *  carrying only what its author wrote. An assistant turn that wrote nothing
 *  (a refusal the fold replaced, an agent that produced no code) is omitted —
 *  never padded with a system string. */
export function modelHistory(messages, { styleSafe = null } = {}) {
  const out = [];
  // (G3) a creative exchange (a song, a poem) is not conversation for a factual turn: fold-chat-histkind.js stands one plain line in for it. Off unless asked.
  const src = styleSafe ? styleSafeMessages(messages, styleSafe) : messages;
  for (const m of src || []) {
    if (!m || m.role === "system") continue;
    const content = modelText(m);
    if (m.role === "assistant" && !content.trim()) continue;
    // A SOURCES-AUTHORED turn (answer mode "Sources only") is the sources' words, not the model's: the model
    // is told so, so it never takes them for something it said (II.9), and the conversation can still see them.
    if (m.role === "assistant" && m.authored === "sources") { out.push({ role: m.role, content: SOURCES_NOTE + content }); continue; }
    out.push({ role: m.role, content });
  }
  return out;
}
