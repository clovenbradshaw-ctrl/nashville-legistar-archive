// fold-chat-provenance.js — WHERE AN ANSWER CAME FROM, said mechanically. Pure: no DOM, no IO, no model, no clock. (docs/VOICE.md "The three product behaviours")
//
// User, 2026-10-06: "chat needs to always say mechanically where it got information from, and that grounding needs to not happen through the talking part of the model. There needs
// to be at least two model calls per output: one is the answer, the other is an explanation of the source … We need to snip out what it's claiming the source was and mechanically insert it,
// and use it to frame the answer of what it did in a prosified way: 'I checked this on Wikipedia, but I consider Wikipedia more like an index for primary sources, so I went and verified it on
// XYZ, and it also said it on here.'"
//
//   pointerMessages({ answer, passages })      the messages for the POINTING call (B): the model is asked to COPY the sentence from the sources that says what the answer says
//   parsePointerReply(text)                    → { none:true } | { source, sentence } | null          (the model's reply, as a claim to be CHECKED, never believed)
//   locate(sentence, passages, hint)           → { ok, index, start, end, text } | { ok:false, why }     the sentence must occur in a passage, character for character (whitespace and typographic
//                                               marks normalised); what is returned is the SOURCE'S OWN slice, never the model's copy, with offsets
//   verifyPointer({ reply, claim, passages })  locate + a minimal relevance check (a shared content stem; every figure of the claim present) → a verified pointer, or why not
//   narrate(pointers, { found })               the narration, AUTHORED BY THE APP from the templates below, around the verbatim quotes; { text, parts[] } (every part tagged app | quote)
//   verifyNarration(narr, passages)            the check on the narrator: every quote part is a verbatim slice of its passage, every app part is a rendering of a declared template
//
// The model's words reach the person only as (a) the answer (read by the Pivot) and (b) NOTHING about provenance: a sentence about where something came from is never model-written. A pointer the
// model made up is rejected and the narration says, in the app's words, that no source sentence could be found. DECLARED, not measured (II.11): the templates and bounds; giver: the user's brief
// of 2026-10-06 for their shape, the author for their wording.

import * as ground from "./fold-chat-ground.js";
import { isTertiary as isWikiIndex } from "./fold-chat-tertiary.js";

// An INDEX is a pointer, not a source: Wikipedia (declared in fold-chat-tertiary.js) and the other encyclopedias / reference works (declared in fold-chat-primary.js ENCYCLOPEDIAS;
// kept as a small copy here because primary imports this module). Measured 2026-10-06: the source line for "Who is the king of the UK?" said "I got this from Britannica" — an encyclopedia
// worded as if it were the source — so a later "find a primary source" read it back as already primary. Giver: the user (an encyclopedia is an index to primary sources).
const REFERENCE_HOSTS = /(^|\.)(britannica\.com|encyclopedia\.com|newworldencyclopedia\.org|citizendium\.org|worldhistory\.org|encyclopedia\.pub|thefamouspeople\.com|famousbirthdays\.com|infoplease\.com|thefreedictionary\.com|dictionary\.com|merriam-webster\.com|worldatlas\.com|mappr\.co)$/i;
const hostName = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
export const isTertiary = (url) => isWikiIndex(url) || REFERENCE_HOSTS.test(hostName(url));
import { askTerms, salientExcerpt } from "./fold-chat-salience.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";

export const PROVENANCE = Object.freeze({
  giver: "the user's brief 2026-10-06 (shape); the author's draft wording; declared, not measured (II.11)",
  minSentence: 20,           // a copy shorter than this is not a sentence worth pointing at
  maxQuote: 320,             // a quote longer than this is cut at the sentence, never mid-word
  maxPointers: 2,            // the verified source and one that independently says it
  maxCandidate: 420,         // a candidate sentence longer than this is a scraped run-on, not a sentence
});

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const titleOf = (p) => { const ref = String(p?.ref ?? ""); const t = ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : (p?.title || ref); return String(t).replace(/\s+[-–—|]\s+(Wikipedia|Britannica)\s*$/i, "").trim(); };
const nameOfHost = (h) => (/(^|\.)wikipedia\.org$/i.test(h) ? "Wikipedia" : h);

// ─────────────── call B: the pointing task ───────────────

export function pointerMessages({ answer, passages, question = "" }) {
  const list = (Array.isArray(passages) ? passages : []).map((p, i) => `[S${i + 1}] ${titleOf(p) || hostOf(p.url || p.source)}\n${String(p.text ?? "").slice(0, 2400)}`).join("\n\n");
  const system = "You check an answer against the sources it was written from. You are given SOURCES and an ANSWER. Find the ONE sentence in the sources that says what the answer says, and copy it exactly, "
    + "character for character. If no source says it, reply NONE. Reply in exactly this form:\nSOURCE: S<number>\nSENTENCE: <the sentence, copied exactly>";
  return [{ role: "system", content: system }, { role: "user", content: `SOURCES\n${list}\n\nANSWER\n${String(answer ?? "").trim()}` }];
}

export function parsePointerReply(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\s*NONE\b/i.test(t) && !/SENTENCE\s*:/i.test(t)) return { none: true };
  const src = /SOURCE\s*:\s*\[?S?(\d+)\]?/i.exec(t);
  const sen = /SENTENCE\s*:\s*([^]*)$/i.exec(t);
  if (!sen) return null;
  let sentence = sen[1].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").replace(/^\s*[-*•]\s+/, "").trim();
  if (!sentence) return null;
  return { source: src ? Number(src[1]) : null, sentence };
}

// ─────────────── verification: verbatim or rejected ───────────────

const PUNCT = new Map([["‘", "'"], ["’", "'"], ["“", '"'], ["”", '"'], ["–", "-"], ["—", "-"], ["−", "-"], [" ", " "], ["…", "."]]);
/** A text with whitespace runs collapsed and typographic marks mapped 1:1, plus a map from each normalised index to the ORIGINAL index. */
function normalise(text) {
  const src = String(text ?? "");
  let out = ""; const map = []; let lastSpace = true;
  for (let i = 0; i < src.length; i++) {
    let c = src[i]; c = PUNCT.get(c) ?? c;
    if (/\s/.test(c)) { if (lastSpace) continue; out += " "; map.push(i); lastSpace = true; continue; }
    lastSpace = false; out += c.toLowerCase(); map.push(i);
  }
  map.push(src.length);
  return { out, map };
}

export function locate(sentence, passages, hint = null) {
  const s = normalise(sentence).out.replace(/[.\s]+$/g, "").trim();
  if (s.length < PROVENANCE.minSentence) return { ok: false, why: "too_short" };
  const list = Array.isArray(passages) ? passages : [];
  const order = list.map((_, i) => i);
  if (hint != null && hint >= 1 && hint <= list.length) { order.splice(order.indexOf(hint - 1), 1); order.unshift(hint - 1); }   // the claimed source is only a HINT: searched first, never trusted
  for (const i of order) {
    const n = normalise(list[i]?.text);
    const at = n.out.indexOf(s);
    if (at < 0) continue;
    const start = n.map[at];
    // extend to the end of the source's own sentence (its terminal mark), so the slice is a whole sentence of the SOURCE
    let end = n.map[Math.min(at + s.length, n.map.length - 1)];
    const orig = String(list[i].text);
    const m = /^[.!?]["')\]”’]*/u.exec(orig.slice(end));
    if (m) end += m[0].length;
    return { ok: true, index: i, start, end, text: orig.slice(start, end) };
  }
  return { ok: false, why: "not_in_sources" };
}

const stemsOf = (t, fw) => ground.tokenize(String(t ?? "")).filter((x) => x.length > 2 && !(fw && fw.has(x))).map((x) => (ground.stemOf ? ground.stemOf(x) : x));
/** The minimal relevance check on a pointer: the sentence shares at least HALF of the claim's content stems (rounded up), and every figure the claim states is in the sentence. Nothing finer is claimed.
 *  Measured 2026-10-06 (live chat): with "shares one stem" the source line for "The King of the UK is King Charles III." quoted "In 1917 King George V changed the royal house's name to Windsor…" (shared: "king").
 *  DECLARED, NOT MEASURED (II.11): one half. Giver: the author; it keeps a paraphrase that names the entity and drops a filler, and refuses a sentence that shares only the commonest word. */
export function bearsOn(claim, sentence, fw) {
  const c = new Set(stemsOf(claim, fw)), s = new Set(stemsOf(sentence, fw));
  const shared = [...c].filter((x) => s.has(x));
  const figs = ground.numbersIn(String(claim ?? ""));
  const sFigs = new Set(ground.numbersIn(String(sentence ?? "")));
  const missing = figs.filter((f) => !sFigs.has(f));
  if (!shared.length) return { ok: false, why: "unrelated" };
  if (missing.length) return { ok: false, why: "figure_missing:" + missing.join(",") };
  if (shared.length < Math.ceil(c.size / 2)) return { ok: false, why: "unrelated" };
  return { ok: true, shared };
}

export function verifyPointer({ reply, claim, passages, fw = null }) {
  const r = typeof reply === "string" ? parsePointerReply(reply) : reply;
  if (!r) return { ok: false, why: "unparsed" };
  if (r.none) return { ok: false, why: "none" };
  const at = locate(r.sentence, passages, r.source);
  if (!at.ok) return { ok: false, why: at.why, claimedSource: r.source };
  const rel = bearsOn(claim, at.text, fw);
  if (!rel.ok) return { ok: false, why: rel.why };
  const p = passages[at.index];
  const url = p.url || p.source || "";
  const host = hostOf(url);
  const tier = p.origin ? "origin" : (p.tertiary || isTertiary(url)) ? "index" : "primary";
  return { ok: true, index: at.index, ref: p.ref || null, url, host, title: titleOf(p), tier, foundVia: p.foundVia || null, start: at.start, end: at.end, quote: clip(at.text, PROVENANCE.maxQuote), shared: rel.shared };
}

function clip(text, max) { const t = String(text).replace(/\s+/g, " ").trim(); if (t.length <= max) return t; const cut = t.slice(0, max); const sp = cut.lastIndexOf(" "); return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…"; }

// ─────────────── the NUMBERED protocol: the model points by NUMBER, it never copies ───────────────
// A small model cannot copy a sentence character for character, and a rejected honest copy looks like a missing source. So the app numbers the candidate sentences (the ones of each page that bear on
// the claim, as verbatim slices) and the model replies with a NUMBER. The sentence is then the page's own by construction; what remains to check is that it BEARS ON the claim.

/** A scraped run-on ("…strikes.Q&A"Why do spiders…") is not a sentence of anyone's: too long, glued sentence ends ("word.Word"), or mostly not letters. */
export function looksLikeSentence(t) {
  const s = String(t ?? "");
  if (s.length > PROVENANCE.maxCandidate) return false;
  if (/[a-z0-9][.!?][A-Z]/.test(s)) return false;                  // two sentences glued without a space
  if (((s.match(/\p{L}/gu) || []).length) / s.length < 0.6) return false;
  // a heading is not a sentence of anyone's saying anything: measured 2026-10-06, the quote under "The King of the UK is Charles III." was the page title "Royal Family tree: King Charles III's closest family and line of succession"
  if (!/[.!?\u3002\uff01\uff1f\u201d"\u2019')\]]\s*$/u.test(s.trim())) return false;
  return true;
}

export function candidatesFor(claim, passages, fw = null, { perPage = 6, max = 20 } = {}) {
  const terms = askTerms({ question: claim }, fw);
  const out = [];
  (Array.isArray(passages) ? passages : []).forEach((p, passageIndex) => {
    const text = String(p?.text ?? "");
    if (!text.trim()) return;
    let slices = [];
    const ex = terms ? salientExcerpt(p, terms, { chars: 1600, neighbours: 0 }) : null;
    if (ex && ex.slices.length) slices = ex.slices;
    else slices = sentencesWithOffsets(text).slice(0, perPage).map((s) => ({ start: s.start, end: s.end }));
    for (const s of slices.slice(0, perPage)) {
      const t = text.slice(s.start, s.end).trim();
      if (t.length >= PROVENANCE.minSentence && looksLikeSentence(t)) out.push({ passageIndex, start: s.start, end: s.end, text: t });
    }
  });
  return out.slice(0, max).map((c, i) => ({ ...c, n: i + 1 }));
}

export function numberedMessages({ claim, candidates, passages }) {
  const list = candidates.map((c) => `[${c.n}] ${c.text.replace(/\s+/g, " ")}`).join("\n");
  const system = "You check an answer against the sources it was written from. You are given a numbered list of SENTENCES taken from the sources, and an ANSWER. "
    + "Reply with the number of the ONE sentence that says what the answer says. If none of them does, reply NONE. Reply with just the number, for example: 3";
  return [{ role: "system", content: system }, { role: "user", content: `SENTENCES\n${list}\n\nANSWER\n${String(claim ?? "").trim()}` }];
}

export function parsePointerNumber(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\W*NONE\b/i.test(t)) return { none: true };
  const m = /(?:^|[^\d.])\[?(\d{1,3})\]?(?![\d])/.exec(t);
  return m ? { n: Number(m[1]) } : null;
}

export function verifyNumber({ reply, claim, candidates, passages, fw = null }) {
  const r = typeof reply === "string" ? parsePointerNumber(reply) : reply;
  if (!r) return { ok: false, why: "unparsed" };
  if (r.none) return { ok: false, why: "none" };
  const c = (candidates || []).find((x) => x.n === r.n);
  if (!c) return { ok: false, why: "no_such_sentence" };
  const rel = bearsOn(claim, c.text, fw);
  if (!rel.ok) return { ok: false, why: rel.why };
  const pass = passages[c.passageIndex];
  const url = pass.url || pass.source || "";
  const host = hostOf(url);
  const tier = pass.origin ? "origin" : (pass.tertiary || isTertiary(url)) ? "index" : "primary";
  return { ok: true, index: c.passageIndex, ref: pass.ref || null, url, host, title: titleOf(pass), tier, foundVia: pass.foundVia || null, start: c.start, end: c.end, quote: clip(String(pass.text).slice(c.start, c.end), PROVENANCE.maxQuote), shared: rel.shared, by: "number" };
}

// ─────────────── the narration: the app's words around the source's words ───────────────

export const TEMPLATES = Object.freeze({
  primary: (v) => `I got this from ${v.title || v.host} (${v.host}). It says:`,
  origin: (v, idx) => `I checked this on ${idx ? nameOfHost(idx.host) : "an encyclopedia"}, but I treat that as an index to primary sources, so I followed it to ${v.host} and verified it there. It says:`,
  index: (v) => `I found this on ${nameOfHost(v.host)}, which I treat as a pointer rather than a source, and I could not reach a primary page that says it, so treat it as unconfirmed. It says:`,
  also: (v) => `It also says it on ${v.host}:`,
  none: () => "I couldn't point to a sentence in what I read that says this, so I'm treating it as unsupported.",
});

/** The narration for the verified pointers (best first). `indexPassage` names the encyclopedia an origin was reached through, when known. Returns { text, parts[] }: each part is { kind:"app", text, rule } or { kind:"quote", text, index, start, end, host }. */
export function narrate(pointers, { indexHost = null } = {}) {
  const ok = (pointers || []).filter((p) => p && p.ok).slice(0, PROVENANCE.maxPointers);
  const parts = [];
  if (!ok.length) { parts.push({ kind: "app", text: TEMPLATES.none(), rule: "none" }); return { text: parts[0].text, parts, verified: 0 }; }
  const lead = ok[0];
  const idxHost = indexHost || lead.foundVia?.host || null;
  parts.push({ kind: "app", text: TEMPLATES[lead.tier](lead, idxHost ? { host: idxHost } : null), rule: lead.tier });
  parts.push({ kind: "quote", text: `“${lead.quote}”`, index: lead.index, start: lead.start, end: lead.end, host: lead.host });
  for (const p of ok.slice(1)) {
    if (p.host === lead.host) continue;               // the same site twice is not a second witness
    parts.push({ kind: "app", text: TEMPLATES.also(p), rule: "also" }, { kind: "quote", text: `“${p.quote}”`, index: p.index, start: p.start, end: p.end, host: p.host });
  }
  return { text: parts.map((x) => x.text).join(" "), parts, verified: ok.length };
}

/** The check on the narrator: the narration is EXACTLY what the templates render from the verified pointers (so no app word is anyone's invention), and every quote is a verbatim slice of its passage. */
export function verifyNarration(narr, passages, pointers, opts = {}) {
  const bad = [];
  const want = narrate(pointers, opts);
  if (JSON.stringify((narr?.parts || []).map((x) => [x.kind, x.text])) !== JSON.stringify(want.parts.map((x) => [x.kind, x.text]))) bad.push({ why: "not_the_rendering_of_the_pointers" });
  for (const part of narr?.parts || []) {
    if (part.kind !== "quote") continue;
    const pass = passages?.[part.index];
    const slice = pass ? String(pass.text).slice(part.start, part.end) : null;
    const inner = String(part.text).replace(/^\u201c|\u201d$/g, "").replace(/\u2026$/, "");
    if (slice == null || !normalise(slice).out.includes(normalise(inner).out.trim())) bad.push({ why: "quote_not_in_source", text: part.text.slice(0, 60) });
  }
  return { ok: bad.length === 0, bad };
}

// ─────────────── the turn: call B (and a corroborating call), verified, narrated ───────────────

/** THE SWITCH. ON unless the person (or a test) turns it off: localStorage "fold-chat:provenance" === "off". Never throws. */
export const PROVENANCE_KEY = "fold-chat:provenance";
export function provenanceEnabled(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return storage?.getItem?.(PROVENANCE_KEY) !== "off"; } catch { return true; }
}

const firstSentence = (s) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); const m = /^(.+?[.!?。！？])(?:\s|$)/u.exec(t); return m ? m[1] : t; };

/**
 * provenanceFor({ answer, passages, point, fw, preferRefs, corroborate }) → { narr, pointers, calls, claim, ps, stored }
 *   point(messages) → Promise<string>   the MODEL CALL, injected (a rejected AbortError propagates; any other failure is a typed "call_failed" pointer, never a crash)
 *   The claim is the answer's FIRST sentence (the answer itself); the pages are those the answer was witnessed by first, then the rest, at most 4.
 *   The model POINTS BY NUMBER at one of the numbered candidate sentences (it never copies one). Call 1 asks over all of them; when it verifies and another HOST is available, call 2 asks over the other hosts only (an independent witness), so a turn makes 2 or 3 model calls in all.
 */
export async function provenanceFor({ answer, passages, point, fw = null, preferRefs = null, corroborate = true, maxPages = 4 }) {
  const claim = firstSentence(answer);
  const all = (Array.isArray(passages) ? passages : []).filter((p) => p && String(p.text ?? "").trim());
  const pref = preferRefs instanceof Set ? preferRefs : new Set(preferRefs || []);
  const rank = (p) => (p.origin ? 4 : 0) + (p.tertiary || isTertiary(p.url || p.source) ? 0 : 2) + (pref.has(String(p.ref)) ? 1 : 0);   // an origin or a primary page before the encyclopedia; the witnessing page first within a tier
  const ps = [...all].sort((a, b) => rank(b) - rank(a)).slice(0, maxPages);
  const run = async (list, retry = true) => {
    let candidates = candidatesFor(claim, list, fw).map((c) => ({ ...c, passageIndex: ps.indexOf(list[c.passageIndex]) }));
    if (!candidates.length) return { ok: false, why: "no_candidates" };
    for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      let reply = "";
      try { reply = await point(numberedMessages({ claim, candidates, passages: ps })); calls++; }
      catch (e) { if (e && (e.name === "AbortError" || /abort|stopped/i.test(String(e.message || "")))) throw e; return { ok: false, why: "call_failed:" + String(e?.message || e).slice(0, 60) }; }
      const v = verifyNumber({ reply, claim, candidates, passages: ps, fw });
      if (v.ok || v.why === "none" || v.why === "unparsed") return v;
      // the pick was a real number but a sentence that does not say it: withdraw THAT candidate and ask once more over the rest
      const asked = parsePointerNumber(reply);
      const rest = candidates.filter((c) => c.n !== asked?.n).map((c, i) => ({ ...c, n: i + 1 }));
      if (attempt === 0 && retry && rest.length) candidates = rest; else return v;
    }
    return { ok: false, why: "rejected" };
  };
  let calls = 0;
  const pointers = [];
  if (!claim || !ps.length) return { narr: narrate([]), pointers: [], calls: 0, claim, ps, stored: null };
  const v1 = await run(ps); pointers.push(v1);
  if (v1.ok && corroborate) {
    const others = ps.filter((p) => hostOf(p.url || p.source) !== v1.host);
    if (others.length) {
      const v2 = await run(others, false);
      // "It ALSO says it" is a stronger claim than a pointer: the second sentence must carry EVERY content stem of the claim (a heading that merely shares words — "Myth: 'Eight legs' always means
      // 'spider'" — does not say what the claim says), and a figure the claim states.
      const claimStems = new Set(stemsOf(claim, fw));
      const have = new Set(stemsOf(String(ps[v2.index]?.text ?? "").slice(v2.start || 0, v2.end || 0), fw));
      const strong = v2.ok && [...claimStems].every((s) => have.has(s));
      if (v2.ok && strong && v2.host !== v1.host) pointers.push(v2);
    }
  }
  const narr = narrate(pointers);
  const ok = pointers.filter((p) => p.ok);
  const stored = {
    schema: "Provenance@1", claim, calls, verified: narr.verified, parts: narr.parts,
    pointers: ok.map((p) => ({ index: p.index, ref: p.ref, url: p.url, host: p.host, title: p.title, tier: p.tier, start: p.start, end: p.end })),
    why: ok.length ? null : (pointers[0]?.why || "none"),
  };
  return { narr, pointers, calls, claim, ps, stored };
}
