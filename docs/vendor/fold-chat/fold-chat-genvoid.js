// fold-chat-genvoid.js — THE VOID FOR GENERATED OUTPUT. Pure: no DOM, no IO, no model.
//
// A generate turn ("write me an essay on this") can fail in a dozen ways, and every one of them used to end the
// same wrong way: the model call threw, so the app quoted whatever passages the search had read and drew them
// as if they were the essay. (Measured 2026-10-06: the search was "write essay invented telephone", the pages
// that came back were essay samples and an essay-writing tutorial, and "FROM THE SOURCES, UNCHANGED" showed
// a line of one.) A writing request is not answered by quoting pages, and the gap was not named.
//
// This module says, for one generate turn, what went missing and what the person can do about it, as DATA
// (record.void, kind "generate"), drawn as a typed mark (Constitution III.3), never as assistant prose
// (II.9: the model authored only what it wrote). The notice text is the app's own sentence.
//
//   outputType   the G1 shape { type, topic, constraints, needsSources, voidIfMissing } (a bare string is accepted)
//   genVoid({ outputType, webPassages, failure, modelResult, question, hasMaterial, barred })
//     -> { ok, void, notice, fallbackAllowed, reason, passages, setAside, offer }
//        ok            true: nothing to draw (a successful generate turn). void and notice are null.
//        void          { kind:"generate", reason, outputType, topic, missing[], had[], setAside[], unblock[], note,
//                        counts, read, closeBy, question }   (read/closeBy are the names the existing gap block reads)
//        fallbackAllowed  false, always, for a turn that failed: quoting pages is never the output. Or "offer": there are
//                        on-topic pages, so the person MAY choose "show what the sources say" (a different, labelled turn;
//                        the wire draws a button, never the passages).
//        passages      the usable on-topic pages (what the model may be handed); setAside the pages dropped, with why.
//   isMetaAboutType(passage, outputType) -> { meta, kind, score, why[] }   a page about WRITING the thing, not about the topic
//   unusablePassage(passage, outputType) -> { usable, why }                 meta / wall / off-topic / empty
//   topicQuery(outputType, searchQ)  what to SEARCH for a generate turn: the topic, never "write essay …"; null = nothing to search
//
// DECLARED vocabulary (Constitution II.11): the type table, the cue lists and every threshold below are hand-written
// defaults, tuned only on the dev pages named in eval/ants/g2/build-pages.mjs. English only: a non-English ask or
// page is NOT judged meta (the module never voids on language alone).

// ── the output types (declared) ────────────────────────────────────────────
// floor = fewest words that can be the thing; text:false = not words (a code build).
const T = (floor, extra = {}) => ({ floor, ...extra });
export const TYPES = Object.freeze({
  essay: T(120), article: T(100), paper: T(120), story: T(60), poem: T(12), song: T(15), report: T(100), summary: T(12),
  letter: T(30), "cover letter": T(60), email: T(12), "blog post": T(100), post: T(10), outline: T(20), plan: T(30), guide: T(60),
  list: T(8), speech: T(60), toast: T(20), script: T(40), haiku: T(8), limerick: T(15), sonnet: T(60), joke: T(8), riddle: T(8),
  slogan: T(2), tagline: T(2), caption: T(3), bio: T(15), paragraph: T(25), description: T(15), review: T(25), analysis: T(80),
  comparison: T(40), memo: T(25), brief: T(25), announcement: T(15), invitation: T(12), tweet: T(3), card: T(8), message: T(8),
  note: T(8), dialogue: T(20), monologue: T(20),
  // built, not worded: the fold's own single-draw build (a fenced HTML preview); judged by size, not words
  html: T(0, { text: false, minChars: 80 }), app: T(0, { text: false, minChars: 80 }), website: T(0, { text: false, minChars: 80 }), page: T(0, { text: false, minChars: 80 }),
});
// kinds of output the fold does not make at all (files and media), declared
export const UNSUPPORTED = Object.freeze(["image", "picture", "photo", "drawing", "logo", "video", "audio", "music", "voiceover", "slides", "presentation", "powerpoint", "spreadsheet", "excel", "pdf", "animation", "3d model", "diagram", "chart"]);
/** An object keyed by every form the module can speak of (declared types and unsupported files/media): what G1's genVoidShape(desc, KNOWN_FORMS) needs. */
const SYN = { poetry: "poem", lyrics: "song", "blog": "blog post", blogpost: "blog post", "blog-post": "blog post", "research paper": "paper", "term paper": "paper", "cover-letter": "cover letter", coverletter: "cover letter", "e-mail": "email", "short story": "story", tl: "summary", tldr: "summary", webpage: "page", "web page": "page", site: "website", "slide deck": "slides", "powerpoint": "slides" };

const STOP = new Set("a an the this that these those it its of on in at to for from by with about and or but as is are was were be been being my your our their his her me us them you i we they what which who whom whose when where why how do does did can could would should will shall may might must not no yes so than then there here into onto over under again also just only very more most some any all each every other such own same too out up down off one two three please write compose draft create generate produce make give want need like some something anything topic subject piece thing".split(" "));
const DEICTIC = new Set(["this", "that", "it", "these", "those", "them", "the above", "above", "the topic", "topic", "the same", "same", "the last answer", "that answer", "the answer", "what you said", "the previous"]);

export const KNOWN_FORMS = Object.freeze({ ...TYPES, ...Object.fromEntries(UNSUPPORTED.map((u) => [u, { unsupported: true }])) });
const aOrAn = (w) => (/^(?:[aeiou]|hono|hour|heir)/i.test(w) && !/^(?:uni(?!nt)|use|eu|one|ubi)/i.test(w) ? "an" : "a");
const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);
const nWords = (s) => words(s).length;
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const domainOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return null; } };
const titleOf = (p) => { const ref = String(p?.title ?? p?.ref ?? ""); const i = ref.indexOf(" — "); return (i >= 0 ? ref.slice(i + 3) : ref).trim(); };
const stem = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);

/** The G1 shape (or a bare string) made total: { type, topic, constraints, needsSources, voidIfMissing }. */
export function normOutputType(ot) {
  const o = typeof ot === "string" ? { type: ot } : (ot && typeof ot === "object" ? ot : {});
  let type = String(o.type ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  // G1's family names that carry no form ("other": an image asked for; "none": no output)
  if (type === "other" || type === "none") type = String(o.form ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  type = SYN[type] || type;
  const known = !!TYPES[type];
  const needsDefault = known ? !["poem", "haiku", "limerick", "joke", "riddle", "slogan", "tagline", "caption", "tweet", "dialogue", "monologue", "sonnet", "song", "toast", "card", "invitation", "message", "note", "letter", "cover letter", "email", "memo", "announcement", "speech", "bio", "story", "script"].includes(type) : true;
  return {
    type, known, unsupported: UNSUPPORTED.includes(type),
    topic: String(o.topic ?? "").replace(/\s+/g, " ").trim(),
    constraints: o.constraints && typeof o.constraints === "object" ? o.constraints : (o.constraints ? { text: String(o.constraints) } : {}),
    needsSources: typeof o.needsSources === "boolean" ? o.needsSources : needsDefault,
    unsupportedGap: Array.isArray(o.voidIfMissing) && o.voidIfMissing.some((x) => /unsupported-(?:type|format)/.test(String(typeof x === "object" && x ? x.gap : x))),
    voidIfMissing: Array.isArray(o.voidIfMissing) ? o.voidIfMissing.map((x) => String(x).toLowerCase()) : [],
  };
}

const typeWords = (type) => { const base = String(type || "").split(" "); const last = base[base.length - 1]; const pl = last.endsWith("y") ? last.slice(0, -1) + "ies" : last + "s"; return [type, [...base.slice(0, -1), pl].join(" ")].filter(Boolean); };
const typeRe = (type, flags = "gi") => { const alts = typeWords(type).map((w) => esc(w).replace(/ /g, "[\\s-]+")); return alts.length ? new RegExp("\\b(?:" + alts.join("|") + ")\\b", flags) : null; };

/** The content words of a topic (no stop words, no output-type word). */
export function topicWords(topic, type = "") {
  const tw = new Set(typeWords(type).join(" ").split(" "));
  return [...new Set(words(String(topic ?? "").toLowerCase().replace(/[^a-z0-9'\s-]/g, " ")).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w.length >= 3 && !STOP.has(w) && !tw.has(w)))];
}

/** Is this topic no topic at all — empty, or only "this / that / it"? */
export function topicIsMissing(topic) {
  const t = String(topic ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (DEICTIC.has(t)) return true;
  return topicWords(t).length === 0;
}

// ── a page about WRITING the thing, not about the topic ────────────────────
const TITLE_CUE = /\b(how to|ways to|steps?|tips?|guide|tutorial|examples?|samples?|templates?|format|formats|structure|topics?|ideas?|prompts?|generator|writer|writers|writing service|writing tips|for (?:class|grade|students?|kids|children|school)|in \d+(?:\s*,\s*\d+)*(?:,?\s*(?:and|or)\s*\d+)? words|\d+ words|free|worksheet|lesson|rubric|checklist|what is (?:an?|the))\b/i;
const URL_CUE = /(example|sample|template|how-?to|write|writing|tips|guide|topics|generator|writer|services?|tutorial|format|essay-on-|-essay|essays?\/)/i;
const SERVICE_CUE = /\b(order now|order your|pay for|writing service|our writers|write my|generator|ai (?:essay|writer)|from \$\d|per page|place an order|hire (?:a|an) writer)\b/i;
const WALL = /(verify(?:ing)? (?:that )?you are (?:not )?(?:a )?(?:bot|human)|security service to protect|just a moment\b|checking your browser|enable javascript and cookies|access denied|captcha|are you a robot|unusual traffic|please verify you are a human|attention required)/i;
const PED = (type) => {
  const t = typeWords(type).map((w) => esc(w).replace(/ /g, "[\\s-]+")).join("|");
  return new RegExp(
    "\\b(?:how to write|write (?:an?|your|the|my) (?:" + t + ")|your (?:" + t + ")|(?:" + t + ") (?:writing|structure|format|topics?|examples?|samples?|template|prompts?|outline)|(?:sample|example|free|short|long|best) (?:" + t + ")|introduction,? (?:body|and conclusion)|thesis statement|topic sentence|step \\d|step-by-step|tips? (?:for|to|on)|word limit|dear (?:hiring manager|sir|madam)|our writers|order (?:now|your)|pay for|first,? (?:start|begin) with|you (?:can|should|will|need|must|may) (?:write|start|begin|include|use|choose|add)|let's (?:start|begin|get started)|(?:" + t + ") (?:on|about) [a-z' ]{2,40} in \\d+ words)\\b", "gi");
};
const per1000 = (n, w) => (w ? (n * 1000) / w : 0);

/** Is this passage ABOUT writing the output (a tutorial, template, sample, service, genre page) rather than about the topic?
 *  passage: { ref|title, url|source, text }. { meta, kind: tutorial|sample|template|service|genre|null, score, why[] } */
export function isMetaAboutType(passage, outputType, { threshold = 4 } = {}) {
  const ot = normOutputType(outputType);
  const none = { meta: false, kind: null, score: 0, why: [] };
  if (!passage || !ot.type || !ot.known) return none;
  const title = titleOf(passage), url = String(passage.url || passage.source || ""), text = String(passage.text ?? "").slice(0, 6000);
  const re = typeRe(ot.type), tw = topicWords(ot.topic, ot.type);
  // the topic IS the type ("write an essay on the essay"): its words are not evidence of a tutorial
  const topicHasType = !!(re && re.test(ot.topic)); if (re) re.lastIndex = 0;
  const why = []; let s = 0;
  const tHasType = !topicHasType && !!re && (re.test(title)); if (re) re.lastIndex = 0;
  const tCue = TITLE_CUE.test(title);
  if (tHasType && tCue) { s += 3; why.push("title names the output and a how-to/example cue"); }
  else if (tHasType) { s += 2; why.push("title names the output"); }
  else if (tCue && re && re.test(text.slice(0, 600))) { s += 1; why.push("title has a how-to cue and the lead names the output"); }
  if (re) re.lastIndex = 0;
  // ANY "how to write …" title is about writing, whichever form it names (a eulogy page answers a speech request), unless the topic itself is in that title
  const titleHasTopic0 = tw.length > 0 && tw.some((x) => title.toLowerCase().includes(stem(x)));
  if (!tHasType && /\bhow to (?:write|draft|compose)\b/i.test(title) && !titleHasTopic0) { s += 4; why.push("title is a how-to-write page"); }
  let path = ""; try { const u = new URL(url); path = (u.hostname + u.pathname).toLowerCase(); } catch { path = url.toLowerCase(); }
  const slugType = !topicHasType && !!re && re.test(path.replace(/[-_/.]+/g, " ")); if (re) re.lastIndex = 0;
  if (slugType && URL_CUE.test(path)) { s += 3; why.push("address names the output and a sample/tutorial cue"); }
  else if (slugType) { s += 1; why.push("address names the output"); }
  const w = nWords(text);
  // the page must SAY the output's name more than in passing for any body cue to count (a how-to page about a house is not about essays)
  const nType = re ? (text.match(re) || []).length : 0; if (re) re.lastIndex = 0;
  if (re && !topicHasType && w >= 40 && nType >= 3) {
    const ped = (text.match(PED(ot.type)) || []).length, pd = per1000(ped, w);
    if (pd >= 6) { s += 2; why.push(`${ped} how-to phrases (${pd.toFixed(1)} per 1000 words)`); }
    else if (pd >= 3) { s += 1; why.push(`${ped} how-to phrases (${pd.toFixed(1)} per 1000 words)`); }
    const td = per1000(nType, w);
    if (td >= 20) { s += 2; why.push(`the output's name is ${td.toFixed(0)} per 1000 words`); }
    else if (td >= 8) { s += 1; why.push(`the output's name is ${td.toFixed(0)} per 1000 words`); }
  }
  const serviceHit = SERVICE_CUE.test(title + " " + text.slice(0, 1500));
  if (serviceHit && (nType >= 1 || tHasType)) { s += 2; why.push("a writing service or generator"); }
  // a page whose title names the TOPIC and neither the output nor a how-to cue is a topical page
  const titleHasTopic = tw.length > 0 && tw.some((x) => title.toLowerCase().includes(stem(x)));
  if (titleHasTopic && !tHasType && !tCue) { s -= 3; why.push("title names the topic and nothing about writing"); }
  const meta = s >= threshold;
  let kind = null;
  if (meta) {
    const head = title + " " + path;
    kind = serviceHit ? "service"
      : /\btemplates?\b/i.test(head) ? "template"
      : /\b(examples?|samples?)\b|essay-on-|in \d+(?:\s*,\s*\d+)*(?:,?\s*(?:and|or)\s*\d+)? words/i.test(head) ? "sample"
      : /\b(how to|steps?|tips?|guide|tutorial|structure|writing)\b/i.test(head) || why.some((x) => /how-to phrases/.test(x)) ? "tutorial"
      : "genre";
  }
  return { meta, kind, score: s, why };
}

/** Can this page be handed to the model, or shown, as material for THIS output about THIS topic? */
export function unusablePassage(passage, outputType) {
  const ot = normOutputType(outputType);
  const text = String(passage?.text ?? "").trim(), title = titleOf(passage);
  if (!text && !title) return { usable: false, why: "empty" };
  if (WALL.test(text.slice(0, 1500)) && nWords(text) < 120) return { usable: false, why: "wall" };
  if (nWords(text) < 8) return { usable: false, why: "empty" };
  const m = isMetaAboutType(passage, ot);
  if (m.meta) return { usable: false, why: "meta-" + m.kind, meta: m };
  const tw = topicWords(ot.topic, ot.type);
  if (tw.length) {
    const hay = (title + " " + text).toLowerCase();
    if (!tw.some((x) => hay.includes(stem(x)))) return { usable: false, why: "off-topic" };
  }
  return { usable: true, why: null };
}

/** The output type of an ask when no classifier supplied one (G1's fold-chat-outputtype.js, when wired, takes precedence): the first declared type
 *  the ask names (longest first), the topic from the thread (`topic`) or what is left of the search words. A bare string/shape passes through. */
export function outputTypeFromAsk(question, { topic = "", searchQ = "", hasMaterial = false } = {}) {
  const q = String(question || "");
  let type = "";
  for (const t of [...Object.keys(TYPES), ...UNSUPPORTED, ...Object.keys(SYN)].sort((a, b) => b.length - a.length)) { const re = typeRe(SYN[t] ? t : t, "i"); if (re && re.test(q)) { type = SYN[t] || t; break; } }
  const base = normOutputType({ type });
  const t = String(topic || "").trim();
  const tq = !topicIsMissing(t) ? t : topicQuery({ type: base.type }, searchQ || q);
  const ownText = ["summary", "letter", "cover letter", "email", "speech", "toast", "bio", "memo", "announcement", "invitation"].includes(base.type);
  return normOutputType({ type: base.type, topic: tq || (/\b(?:this|that|it)\b\s*[.?!]*$/i.test(q.trim()) ? "this" : ""), constraints: { ...(/(\d{2,5})\s*words?/i.exec(q) ? { words: Number(/(\d{2,5})\s*words?/i.exec(q)[1]) } : {}) }, needsSources: undefined, voidIfMissing: ownText && !hasMaterial && base.type === "summary" ? ["own-text"] : [] });
}

// ── what to SEARCH for a generate turn ─────────────────────────────────────
const WRITE_VERBS = /\b(?:write|compose|draft|create|generate|produce|make|give|need|want|please|can|could|you|me|us|for|about|on|of|an?|the)\b/gi;
/** The topic to search: the output type's own topic when it has one, else the search words minus the writing request
 *  ("write essay invented telephone" -> "invented telephone"). null = there is nothing to search ("write me an essay on this"). */
export function topicQuery(outputType, searchQ = "") {
  const ot = normOutputType(outputType);
  if (ot.topic && !topicIsMissing(ot.topic)) return ot.topic;
  let q = String(searchQ || "");
  for (const t of [...Object.keys(TYPES), ...UNSUPPORTED].sort((a, b) => b.length - a.length)) { const re = typeRe(t, "gi"); if (re) q = q.replace(re, " "); }
  q = q.replace(/\b\d{2,5}[\s-]*words?\b|\bwords?\b/gi, " ").replace(/\b(?:this|that|these|those|it|them)\b/gi, " ").replace(WRITE_VERBS, " ").replace(/\s+/g, " ").trim();
  return topicIsMissing(q) ? null : q;
}

// ── what the model returned ────────────────────────────────────────────────
const REFUSAL = /^\s*(?:i(?:'m| am) (?:sorry|unable|not able|afraid)|i (?:can(?:'|no)t|cannot|won't|am not able|do not|don't)|sorry[,.! ]|as an ai\b|unfortunately,? i\b|i apologi[sz]e|i'm not (?:able|going))/i;
const TEASER = /^\s*(?:certainly|sure|of course|absolutely|okay|ok|great|happy to)[!,. ]+(?:(?:i(?:'d| would)|i'll|i will) (?:be )?(?:happy|glad|love|gladly)|here(?:'s| is)|let me|let's)/i;
const ASKS = /(?:what (?:topic|subject|aspect|angle)|which (?:topic|subject|aspect)|could you (?:please )?(?:tell|provide|clarify|share|specify)|can you (?:please )?(?:tell|provide|clarify|share|specify)|would you like me to|do you want me to|please (?:provide|tell|let me know|specify)|let me know (?:what|which|if)|more (?:details|information|context))/i;
const lastLine = (t) => String(t).trim().split(/\n/).pop().trim();

/** The model's reply judged as a draft of the output: { ok, reason, words, said? } — reason: empty|refused|asked-instead|stub|wrote-tutorial|off-topic-draft|null. */
export function judgeDraft(modelResult, outputType) {
  const ot = normOutputType(outputType);
  const text = String(modelResult?.text ?? "").trim();
  const spec = TYPES[ot.type] || T(40);
  if (!text) return { ok: false, reason: "empty", words: 0 };
  const w = nWords(text);
  const said = clip(text, 160);
  if (REFUSAL.test(text) && w < 90) return { ok: false, reason: "refused", words: w, said };
  const len = ot.constraints?.length;
  const wantN = Number(ot.constraints?.words ?? ot.constraints?.wordCount ?? (len && typeof len === "object" && /^words?$/i.test(String(len.unit || "")) ? len.n : null) ?? (/(\d{2,5})\s*words?/i.exec(String(ot.constraints?.text ?? (typeof len === "string" ? len : "") ?? "")) || [])[1]) || 0;
  const floor = spec.text === false ? 0 : (wantN ? Math.max(Math.min(spec.floor, 8), Math.round(wantN * 0.5)) : spec.floor);
  // a question back instead of the piece
  if (w < Math.max(floor, 60) + 90 && ASKS.test(text) && /\?/.test(text) && /^\W*(?:please |what |which |could you |can you |i (?:need|would need|will need)|to (?:write|help)|do you |would you |tell me|provide )/i.test(text.replace(/^[#*\s]+/, ""))) return { ok: false, reason: "asked-instead", words: w, said };
  if (spec.text === false) { if (text.length < (spec.minChars || 80)) return { ok: false, reason: "stub", words: w, said }; }
  else if (w < floor) return { ok: false, reason: "stub", words: w, said };
  else if (TEASER.test(text) && /:\s*$/.test(lastLine(text))) return { ok: false, reason: "stub", words: w, said };
  else if (TEASER.test(text) && w < floor * 1.6 && !/\n\s*\n/.test(text)) return { ok: false, reason: "stub", words: w, said };
  // it wrote the guide, not the thing
  if (spec.text !== false && ot.known) {
    const m = isMetaAboutType({ text, title: text.split(/\n/)[0].slice(0, 120) }, ot, { threshold: 4 });
    const tw = topicWords(ot.topic, ot.type);
    const lead = text.slice(0, 700).toLowerCase();
    if (m.meta && m.kind !== "genre" && (!tw.length || !tw.some((x) => lead.includes(stem(x))))) return { ok: false, reason: "wrote-tutorial", words: w, said };
  }
  // it wrote something that never mentions the topic
  if (spec.text !== false && ot.needsSources) {
    const tw = topicWords(ot.topic, ot.type);
    if (tw.length && w >= floor) { const hay = text.toLowerCase(); if (!tw.some((x) => hay.includes(stem(x)))) return { ok: false, reason: "off-topic-draft", words: w, said }; }
  }
  return { ok: true, reason: null, words: w };
}

// ── how a failure reads ────────────────────────────────────────────────────
/** A thrown error / bridge failure as a kind: network|timeout|rate-limit|gate|sealed|no-model|stopped|failed. */
export function failureKind(failure) {
  if (!failure) return null;
  if (typeof failure === "string") return /^(network|timeout|rate-limit|gate|sealed|no-model|stopped|failed|withheld)$/.test(failure) ? failure : failureKind({ message: failure });
  if (failure.kind && /^(network|timeout|rate-limit|gate|sealed|no-model|stopped|failed|withheld)$/.test(failure.kind)) return failure.kind;
  const msg = String(failure.message || failure.why || ""), st = typeof failure.status === "number" ? failure.status : null;
  if (failure.name === "AbortError" || /\baborted\b|stopped by/i.test(msg) && failure.kind === "stopped") return "stopped";
  if (st === 504 || /timed out|timeout/i.test(msg) || failure.kind === "timeout") return "timeout";
  if (st === 429 || /\b429\b|rate.?limit|too many requests/i.test(msg)) return "rate-limit";
  if (st === 422 || /withheld before it reached|sealed|de-?id|redact/i.test(msg)) return "sealed";
  if (st === 403 || /safety|ethics|\bgate\b|refused by|declined/i.test(msg)) return "gate";
  if (/no model|none is (?:available|served)|not loaded/i.test(msg) || failure.kind === "no-model") return "no-model";
  if (st === 0 || /unreachable|failed to fetch|network|load failed|econn|enotfound|fetch failed/i.test(msg)) return "network";
  return "failed";
}

const FAIL_SAY = {
  network: "the model could not be reached (a network error)",
  timeout: "the model took too long and the turn timed out",
  "rate-limit": "the model is rate-limited right now",
  gate: "the model declined the request",
  sealed: "the request was withheld before it reached the model",
  "no-model": "no model is available to write it",
  failed: "the turn failed before anything was written",
  withheld: "none of what the model wrote could be traced to what was read, so none of it is shown",
};
const FAIL_UNBLOCK = {
  network: ["try again", "check that the Fold's server is running (npm run serve), or load the in-tab model"],
  timeout: ["try again", "ask for something shorter (a paragraph first), or pick a faster model"],
  "rate-limit": ["wait a minute and try again", "pick another model"],
  gate: ["rephrase the request", "try a different model"],
  sealed: ["take personal details out of the request and try again", "keep the request on this machine with a local model"],
  "no-model": ["run npm run serve (the Fold's own server), or load the in-tab model", "try again once a model is available"],
  failed: ["try again"],
  withheld: ["try again", "name the topic more specifically", "attach text you want it based on"],
};
const DRAFT_SAY = {
  empty: "the model returned no text",
  refused: "the model refused to write it",
  "asked-instead": "the model asked a question instead of writing it",
  stub: "the model returned only a stub, not the piece",
  "wrote-tutorial": "the model wrote a guide to writing it instead of the piece itself",
  "off-topic-draft": "the model's draft never mentions the topic",
};

const verbFor = (ot) => (TYPES[ot.type] && TYPES[ot.type].text === false) || ot.unsupported || ot.unsupportedGap ? "make" : "write";
const the = (ot) => `the ${ot.type || "piece"}`;
const topicPhrase = (ot) => (ot.topic && !topicIsMissing(ot.topic) ? `“${clip(ot.topic, 60)}”` : "the topic");

// a plain "try again" can change the outcome for these; for a gate, a wall, a missing topic or text it cannot
const RETRY = ["network", "timeout", "rate-limit", "failed", "withheld", "empty", "refused", "asked-instead", "stub", "wrote-tutorial", "off-topic-draft", "no-model", "no-sources", "meta-only", "wall-only", "off-topic-only"];
function mkVoid(ot, { reason, missing, say, had = [], setAside = [], unblock = [], question = "", said = null, fallbackAllowed = false }) {
  const note = `I can't ${verbFor(ot)} ${the(ot)}: ${say}.`;
  return {
    ok: false,
    reason,
    void: {
      kind: "generate", reason, outputType: ot.type || null, topic: ot.topic || null,
      missing, had, setAside, unblock, note, ...(said ? { said } : {}),
      counts: { sentences: 0, grounded: 0 }, read: had.filter((h) => h.kind === "page").map(({ title, domain, url }) => ({ title, domain, url })), closeBy: unblock,
      question: clip(question, 90),
      retry: RETRY.includes(reason),
    },
    notice: { kind: "gen-void", retry: RETRY.includes(reason), text: note, reason },
    fallbackAllowed,
  };
}

const pageEntry = (p, note = null) => ({ kind: "page", title: titleOf(p) || "untitled", domain: domainOf(p?.url || p?.source), url: p?.url || (/^https?:/i.test(String(p?.source || "")) ? p.source : null), ...(note ? { note } : {}) });

/** Everything a generate turn can fail on, as ONE verdict. See the header. Order of gates (what the person can fix first):
 *  type unsupported -> type unknown -> no topic -> own text missing -> alone-barred -> sources (none / meta / wall / off-topic) -> model failure -> the draft. */
export function genVoid({ outputType, webPassages = [], failure = null, modelResult = null, question = "", hasMaterial = false, barred = null } = {}) {
  const ot = normOutputType(outputType);
  const passages = Array.isArray(webPassages) ? webPassages : [];
  const judged = passages.map((p) => ({ p, v: unusablePassage(p, ot) }));
  const usable = judged.filter((x) => x.v.usable).map((x) => x.p);
  const setAside = judged.filter((x) => !x.v.usable).map((x) => ({ ...pageEntry(x.p), why: x.v.why }));
  const had = usable.slice(0, 6).map((p) => pageEntry(p, "about the topic"));
  const out = (r) => ({ passages: usable, setAside, offer: null, ...r });
  const ok = () => out({ ok: true, void: null, notice: null, fallbackAllowed: null, reason: null });
  const withOffer = (r) => {
    if (r.ok || !usable.length || !ot.topic || topicIsMissing(ot.topic)) return r;
    const offer = { act: "show-sources", n: usable.length, label: `show what the sources say about ${clip(ot.topic, 50)} (their own words, not ${aOrAn(ot.type || "piece")} ${ot.type || "piece"})` };
    return { ...r, void: { ...r.void, offer }, fallbackAllowed: "offer", offer };
  };

  // 0. the output itself
  if (ot.unsupported || ot.unsupportedGap) {
    const nm = ot.type || "piece", what = ot.type ? `${ot.type} files` : "files or media";
    return out(mkVoid(ot, { reason: "unsupported-type", missing: [ot.type ? `a way to make ${aOrAn(ot.type)} ${ot.type}` : "a way to make that"], say: `the fold writes text (essay, story, poem, letter, report\u2026), not ${what}`, unblock: [ot.type ? `ask for a written description or a prompt for ${aOrAn(nm)} ${nm} instead` : "ask for a written description instead", "name a text form (an essay, a poem, a script)"], question }));
  }
  if (!ot.type || !ot.known) return out(mkVoid(ot, { reason: "type-unknown", missing: ["what kind of thing to write"], say: ot.type ? `I don't know how to make ${aOrAn(ot.type)} “${ot.type}”` : "the request does not say what to write", unblock: ["say the form: an essay, a poem, a letter, a report, a list…"], question }));

  // 1. a topic, where the output needs one
  const topicMissing = topicIsMissing(ot.topic);
  if (ot.needsSources && topicMissing) {
    const deictic = String(ot.topic || "").trim();
    return out(mkVoid(ot, { reason: "no-topic", missing: [`a topic for the ${ot.type}`], say: deictic ? `“${clip(deictic, 20)}” points at nothing earlier in this chat, so there is no topic` : "the request names no topic", unblock: [`name the topic: “write ${aOrAn(ot.type)} ${ot.type} on the telephone”`, `ask a question first, then ask for the ${ot.type} on its answer`], question }));
  }
  // 2. the person's own text, where the output is theirs
  const needs = ot.voidIfMissing.filter((x) => /own[- ]?text|details|material|facts|recipient|document|draft|attachment/.test(x));
  if (needs.length && !hasMaterial) {
    const what = /recipient/.test(needs.join(" ")) ? "who it is for and what it should say" : /own[- ]?text|document|draft|attachment|material/.test(needs.join(" ")) ? "the text you are working from" : "your own details";
    return out(mkVoid(ot, { reason: "own-text-missing", missing: [what], say: `it needs ${what}, and none was given`, unblock: [`paste or attach ${/text/.test(what) ? "the text" : "the details"} and ask again`, `say who it is for and what it should say`], question }));
  }
  // 3. the lane is barred from speaking alone and holds no material
  if (barred && !usable.length && !hasMaterial && !passages.length) {
    return out(mkVoid(ot, { reason: "alone-barred", missing: ["sources or your own text to write from"], say: "the fold does not write without sources or text of yours to write from, and there are none", unblock: [`paste or attach the text the ${ot.type} should come from`, `ask it as a question about the topic first, so there is something to write from`], question }));
  }
  // 4. the sources, where the output needs them
  const kindOfSet = (why) => setAside.filter((x) => x.why === why || (why === "meta" && /^meta-/.test(x.why))).length;
  if (ot.needsSources && !failure && !usable.length) {
    const nMeta = kindOfSet("meta"), nWall = kindOfSet("wall"), nOff = kindOfSet("off-topic");
    const tp = topicPhrase(ot);
    if (!passages.length) return out(mkVoid(ot, { reason: "no-sources", missing: [`sources about ${tp}`], say: `no source about ${tp} could be read`, unblock: ["try again", `name ${tp} more specifically`, "attach text you want it based on"], question }));
    const dominant = nMeta >= Math.max(nWall, nOff) ? "meta" : nWall >= nOff ? "wall" : "off-topic";
    if (dominant === "meta") return out(mkVoid(ot, { reason: "meta-only", missing: [`sources about ${tp}`], say: `every page found was about writing ${aOrAn(ot.type)} ${ot.type}, not about ${tp} (${setAside.length} set aside)`, setAside, unblock: [`name ${tp} more specifically so the search finds pages about it`, "attach text you want it based on", "try again"], question }));
    if (dominant === "wall") return out(mkVoid(ot, { reason: "wall-only", missing: [`sources about ${tp}`], say: `every page found was a bot-check or access wall (${setAside.length} set aside)`, setAside, unblock: ["try again", "attach text you want it based on"], question }));
    return out(mkVoid(ot, { reason: "off-topic-only", missing: [`sources about ${tp}`], say: `none of the ${setAside.length} page(s) read mentions ${tp}`, setAside, unblock: [`name ${tp} more specifically`, "try again", "attach text you want it based on"], question }));
  }
  // 5. the model did not (or could not) write
  const fk = failureKind(failure);
  if (fk === "stopped") return ok();   // Stop is the person's own act, not a gap
  if (fk) {
    const missing = [`the model's draft of the ${ot.type}`];
    let say = FAIL_SAY[fk];
    const unblock = [...FAIL_UNBLOCK[fk]];
    if (ot.needsSources && !usable.length) {
      const tp = topicPhrase(ot);
      missing.push(`sources about ${tp}`);
      say += passages.length ? `, and none of the ${passages.length} page(s) found was usable material about ${tp} (${setAside.map((x) => x.why).filter((v, i, a) => a.indexOf(v) === i).join(", ")})` : `, and no source about ${tp} could be read`;
      unblock.push(`name ${tp} more specifically`);
    }
    return withOffer(out(mkVoid(ot, { reason: fk, missing, say, had, setAside, unblock, question })));
  }
  // 6. it wrote something: is it the thing?
  if (modelResult) {
    const j = judgeDraft(modelResult, ot);
    if (!j.ok) {
      const stubSay = j.reason === "stub" ? `the model returned only ${j.words} word${j.words === 1 ? "" : "s"}, too short to be ${aOrAn(ot.type)} ${ot.type}` : DRAFT_SAY[j.reason];
      const un = j.reason === "asked-instead" ? ["say what you want covered, in the request itself", "try again"] : j.reason === "off-topic-draft" ? [`name ${topicPhrase(ot)} more specifically`, "try again", "pick another model"] : j.reason === "wrote-tutorial" ? ["try again", `name ${topicPhrase(ot)} more specifically`] : ["try again", "pick another model"];
      return withOffer(out(mkVoid(ot, { reason: j.reason, missing: [`a written ${ot.type}`], say: stubSay, had: [...had, ...(j.words ? [{ kind: "draft", note: `${j.words} word${j.words === 1 ? "" : "s"} from the model, not shown as the ${ot.type}` }] : [])], setAside, unblock: un, said: j.said, question })));
    }
  }
  return ok();
}

/** Short app-authored label for the gap block head (fold-chat-channels voidLabel reads this). */
export function genVoidLabel(v) {
  if (!v || v.kind !== "generate") return "";
  return `can't ${(TYPES[v.outputType] && TYPES[v.outputType].text === false) || UNSUPPORTED.includes(v.outputType) ? "make" : "write"} the ${v.outputType || "piece"}`;
}

/** The short line drawn where the answer would be (the facing page's empty-answer line): the thing is named, the reason is in the gap block. */
export function genVoidLine(v) {
  if (!v || v.kind !== "generate") return "";
  const make = (TYPES[v.outputType] && TYPES[v.outputType].text === false) || UNSUPPORTED.includes(v.outputType);
  return `No ${v.outputType || "piece"} was ${make ? "made" : "written"}.`;
}

/** One line for the Process panel / process JSON only (never message content). */
export function genVoidText(v) {
  if (!v || v.kind !== "generate") return "";
  return "⟂ void — " + String(v.note || "").replace(/\s+/g, " ").trim() + (v.missing?.length ? " Missing: " + v.missing.join("; ") + "." : "") + (v.unblock?.length ? " To close it: " + v.unblock.join(", or ") + "." : "");
}

/** May a failed turn of this kind fall back to quoting the sources AS the answer? Never for a written output. */
export function strandFallbackAllowed(kind) { return kind !== "generate" && kind !== "compose"; }
