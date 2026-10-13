// fold-chat-strand.js — SOURCES ONLY: the answer is the sources' own words, strung together.
// Pure: no DOM, no IO, no model. NO MODEL CALL IS MADE FOR A STRAND.
//
// The rule behind both answer modes: the model never speaks alone. In "Facing page" mode the model's
// response is drawn FROM snipped sources; in "Sources only" mode there is no model at all — the reply is
// the passages the read pages gave, VERBATIM, each with its citation, credit and link:
//
//   1. a structured block the PAGE declares, in order of preference:
//        a recipe (fold-chat-snip.js `snipOfPassage`), a HowTo, an FAQPage, a QAPage's acceptedAnswer
//        (all schema.org JSON-LD: `declaredBlocksFromHtml`), a Wikipedia article's LEAD;
//   2. otherwise the sentences `impressionOf` (fold-chat-impression.js) already picks as differing the
//      ask — adjacent sentences merged into one passage, an ellipsis wherever text was skipped.
//   3. strung together in source-rank order (the order the passages were read), de-duplicated.
//   0. (when `limits.minimal`) FIRST, the smallest span that answers the ask (fold-chat-answerspan.js `answerSpan`: a figure with its subject, a date, a name, a
//      definition — never the whole group); it is a snip of kind "span" whose `text` is the mechanical final pass (named rules) and whose `verbatim` is the page's own bytes.
//      Every other snip of the turn is then `more: true` (drawn behind "more from this page"). When nothing clears the threshold, `minimalGap` is the typed gap
//      ("no sentence in what was read states this") and the groups are drawn as before.
//
// EVERY SNIP IS VERIFIABLE: `verifySnip` checks that a snip's words occur in the page text it came from
// (whitespace-normalised, never reworded). A snip that does not verify is a bug and is DROPPED, never
// shown (`snipsOf` returns it in `dropped`). The only words on screen that are not the sources' are the
// app-authored labels ("from <site>") and typed gap notes.
//
// DECLARED, NOT MEASURED (Constitution II.11 — each with its giver): the per-passage and total character
// budgets below are declared defaults (a screenful per source, a few screenfuls in all); the merge gap is
// "a sentence boundary": two kept sentences are one passage only when nothing but whitespace lies between.

import { impressionOf, sentencesWithOffsets } from "./fold-chat-impression.js";
import { snipOfPassage } from "./fold-chat-snip.js";
import { contactOfPassage } from "./fold-chat-tip.js";
import { junkOf, wallOf } from "./fold-chat-junk.js";
import { maskNavRegion } from "./fold-chat-region.js";
import { answerSpan, verifyRewrite } from "./fold-chat-answerspan.js";

export const STRAND = Object.freeze({
  perPassageChars: 700,    // how much of one source a strand quotes (impression budget)
  totalChars: 3600,        // all of it, so a stored turn stays small
  maxPassages: 5,          // sources quoted
  maxItems: 12,            // Q&A pairs / how-to steps quoted from one declared block
  leadChars: 600,          // a Wikipedia lead
  minSnipWords: 8,         // a prose passage shorter than this (a caption, a heading) is not worth quoting alone
  minimal: true,           // THE SMALLEST SPAN FIRST (fold-chat-answerspan.js): the clause that answers, its sentence one tap away; the groups below are "more from this page"
});

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const host = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isWiki = (u) => /^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(String(u || ""));
const titleOf = (p) => { const r = String(p?.ref ?? ""); return (r.includes(" — ") ? r.slice(r.indexOf(" — ") + 3) : r).trim(); };
const siteOf = (p) => { const r = String(p?.ref ?? ""); const s = r.includes(" — ") ? r.slice(0, r.indexOf(" — ")) : ""; return host(p?.url || p?.source) || s; };

/** Text that is really a block page (a paywall, a captcha, a bot-challenge, an error wall), not the page asked for. A short
 *  page that says so is a FAILED read — never handed on as the page's text, and never quoted as a snip. (Lives here so the
 *  strand and the page reader share one definition; fold-chat-web.js re-exports it.) */
export function looksBlocked(text, { status = 0, title = "" } = {}) {
  const t = String(text ?? "");
  if (Number.isFinite(+status) && +status >= 400) return true;
  // A wall's opening words (any length of page), or a short page that says it is one: the declared multilingual phrases of
  // fold-chat-junk-lexicon.js (blocks, captchas, expiry, member-only gates, waiting rooms). The old English regex is retired: it
  // called any short page that MENTIONED a captcha a wall.
  const w = wallOf({ status, title, text: t });
  if (w.blocked && (w.kind === "wall-lead" || w.kind === "wall-short")) return true;
  return false;
}

// ── structured blocks a page declares (JSON-LD) ────────────────────────────
const cleanHtml = (v) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, " ").trim();
const typesOf = (n) => [].concat(n?.["@type"] || []).map((t) => String(t).replace(/^.*\//, ""));
const nameOf = (v) => [].concat(v || []).map((x) => (typeof x === "string" ? cleanHtml(x) : x && x.name ? cleanHtml(x.name) : "")).filter(Boolean).join(", ");
const stepsOf = (v) => [].concat(v || []).flatMap((x) => (typeof x === "string" ? [cleanHtml(x)] : x && x.itemListElement ? stepsOf(x.itemListElement) : x && (x.text || x.name) ? [cleanHtml(x.text || x.name)] : [])).filter(Boolean);

/** The HowTo / FAQPage / QAPage blocks a page declares in JSON-LD (a Recipe is read by fold-chat-web.js
 *  `recipeDataFromHtml`). Returns [{ kind:'howto'|'faq'|'qa', name, author, items:[string] }] — `items` are the
 *  page's own strings, each a unit that can be quoted whole (a step; "Q? — A"). Pure; never throws. */
export function declaredBlocksFromHtml(raw) {
  const html = String(raw ?? "");
  if (!/ld\+json/i.test(html)) return [];
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) { for (const x of n) walk(x); return; }
    if (!n || typeof n !== "object") return;
    const types = typesOf(n);
    if (types.includes("HowTo")) {
      const items = stepsOf(n.step);
      if (items.length) out.push({ kind: "howto", name: cleanHtml(n.name), author: nameOf(n.author), items: items.slice(0, STRAND.maxItems) });
    }
    if (types.includes("FAQPage")) {
      const items = [].concat(n.mainEntity || []).map((q) => {
        const a = q?.acceptedAnswer?.text ?? [].concat(q?.acceptedAnswer || [])[0]?.text;
        const qq = cleanHtml(q?.name), aa = cleanHtml(a);
        return qq && aa ? `${qq} — ${aa}` : "";
      }).filter(Boolean);
      if (items.length) out.push({ kind: "faq", name: cleanHtml(n.name), author: nameOf(n.author), items: items.slice(0, STRAND.maxItems) });
    }
    if (types.includes("QAPage")) {
      const q = n.mainEntity && typeof n.mainEntity === "object" ? [].concat(n.mainEntity)[0] : null;
      const acc = q && ([].concat(q.acceptedAnswer || [])[0] || null);
      const qq = cleanHtml(q?.name), aa = cleanHtml(acc?.text);
      if (qq && aa) out.push({ kind: "qa", name: qq, author: nameOf(acc?.author) || nameOf(n.author), items: [aa] });
    }
    if (n["@graph"]) walk(n["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    walk(j);
  }
  return out.slice(0, 4);
}

// ── building snips ─────────────────────────────────────────────────────────
function recipeText(r) {
  return [r.title, [...(r.ingredients || [])].join("\n"), [...(r.steps || [])].map((x, i) => `${i + 1}. ${x}`).join("\n")].filter(Boolean).join("\n");
}

function snipFrom(p, pi, base) {
  const snip = {
    n: "S" + (pi + 1), p: pi,
    source: p.url || p.source || null, title: titleOf(p), site: siteOf(p),
    shadow: p.shadow ? { hash: p.shadow.hash || null, chars: p.shadow.chars || null } : null,
    ellipsisBefore: false, ellipsisAfter: false, range: null,
    ...((c) => (c ? { contact: c } : {}))(contactOfPassage(p)),   // for the tip control only: how the creator's own page says to reach them
    ...base,
  };
  // AN ENCYCLOPEDIA IS A POINTER, NEVER A CITATION (fold-chat-origin.js): what is quoted from an encyclopedia page whose references were not
  // followed to a page that carries it is shown as a POINTER — its words, the pages it points at, the path — and never as the source.
  if (p.tertiary && (snip.kind === "lead" || snip.kind === "passage")) return { ...snip, kind: "pointer", credit: "", pointers: asArrP(p.pointers), via: (asArrP(p.trails).find((t) => t && t.found) || null) };
  return snip;
}
const asArrP = (a) => (Array.isArray(a) ? a : []);

/** Passage-text groups: the sentences impressionOf keeps, with adjacent ones merged (nothing but whitespace
 *  between them) and the ellipsis flags set where text was skipped. Ranges are in `text` coordinates.
 *  `text` may be MASKED (fold-chat-region.js maskNavRegion: chrome blocks replaced by spaces, offsets kept): a group is
 *  never allowed to bridge a masked block, so every group is a contiguous slice of the ORIGINAL page text. */
export function groupsOf(text, question, budget) {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const whole = t.trim().length <= budget;
  const imp = whole ? { shadow: { segments: [{ start: 0, end: t.length }] } } : impressionOf(t, question, { budget, lead: true });
  const segs = (imp.shadow?.segments || []).filter((g) => g.end > g.start).sort((a, b) => a.start - b.start);
  const MASK = /\n[ \t]+\n/;                         // a masked block between two kept ones
  const groups = [];
  for (const g of segs) {
    const last = groups[groups.length - 1];
    const gap = last ? t.slice(last.end, g.start) : "";
    if (last && /^\s*$/.test(gap) && !MASK.test(gap)) last.end = g.end;
    else groups.push({ start: g.start, end: g.end });
  }
  // cut any group at a masked block it spans
  const cut = [];
  for (const g of groups) {
    let from = g.start; const body = t.slice(g.start, g.end); let m; const re = /\n[ \t]+(?=\n)/g;
    while ((m = re.exec(body)) !== null) { if (g.start + m.index > from) cut.push({ start: from, end: g.start + m.index }); from = g.start + m.index + m[0].length; }
    if (g.end > from) cut.push({ start: from, end: g.end });
  }
  const trimmed = t.trimEnd().length;
  return cut.map((g) => {
    const lead = t.slice(g.start, g.end).search(/\S/);
    const start = g.start + Math.max(0, lead);
    return { start, end: g.end, ellipsisBefore: start > t.search(/\S/), ellipsisAfter: g.end < trimmed };
  }).filter((g) => t.slice(g.start, g.end).trim());
}

/** The leading sentences of a text (a Wikipedia lead), up to `chars`. Ranges in `text` coordinates. */
function leadOf(text, chars) {
  const t = String(text ?? "");
  const sents = sentencesWithOffsets(t);
  if (!sents.length) return null;
  // A "sentence" that ends in an abbreviation (St., Dr., No., a lone initial) is not over: never stop on one.
  const ABBREV = /(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|inc|ltd|co|mt|ave|gen|col|capt|lt|sgt|rev|vol|approx|est)\.|\b[A-Z]\.)$/i;
  let end = sents[0].end, last = 0;
  for (let i = 1; i < sents.length; i++) {
    if (sents[i].end - sents[0].start > chars || !/^\s*$/.test(t.slice(end, sents[i].start))) break;
    end = sents[i].end; last = i;
  }
  while (last > 0 && ABBREV.test(t.slice(sents[last].start, end).trim())) { last--; end = sents[last].end; }
  return { start: sents[0].start, end, ellipsisBefore: false, ellipsisAfter: end < t.trimEnd().length };
}

/** The strand of a turn: snips drawn VERBATIM from the passages, in source-rank order, de-duplicated.
 *  Returns { snips, dropped } — `dropped` are candidates that failed `verifySnip` (a bug, never shown). */
export function snipsOf(passages, question, { limits = STRAND } = {}) {
  const list = (Array.isArray(passages) ? passages : []).slice(0, limits.maxPassages);
  const snips = [], dropped = [], seen = [], junk = [], gaps = [];
  let chars = 0;
  // THE GATE: nothing is added to the strand unless it verifies against its page AND is not the site talking about itself.
  // A declared block is judged for hollowness, markup and chrome phrases (it is lists and fields, not prose); everything else
  // by the whole rule. A rejected candidate is recorded in `junk` with its reason, never shown, never replaced by a model.
  const add = (p, pi, s) => {
    if (!verifySnip(s, p)) { dropped.push(s); return false; }
    const declared = s.kind === "recipe" || s.kind === "howto" || s.kind === "faq" || s.kind === "qa";
    const j = junkOf(s.kind === "recipe" ? recipeText(s.card) : s.text, { declared });
    if (j.junk) { junk.push({ n: s.n, p: pi, kind: s.kind, reason: j.reason }); return false; }
    const key = norm(s.text).toLowerCase();
    if (!key || seen.some((k) => k === key || k.includes(key) || key.includes(k))) return false;
    if (snips.length && chars + s.text.length > limits.totalChars) return false;
    seen.push(key); chars += s.text.length; snips.push(s);
    return true;
  };
  const gap = (p, pi, kind, reason) => gaps.push({ kind: "gap", gap: kind, reason, p: pi, source: p?.url || p?.source || null, site: siteOf(p) });
  const minimal = limits.minimal === false ? null : answerSpan(question, list);
  list.forEach((p, pi) => {
    const text = String(p?.text ?? "");
    const hasDeclared = !!p?.recipe || (Array.isArray(p?.declared) && p.declared.length);
    if (!hasDeclared) {                                               // a block page is never quoted
      const w = wallOf({ status: p?.status || 0, title: p?.title || "", text });
      if (looksBlocked(text, { status: p?.status || 0, title: p?.title || "" }) || (w.blocked && w.kind === "http")) { gap(p, pi, "blocked", w.reason || "the page is a block, gate or expiry notice, not the content asked for"); return; }
    } else if (looksBlocked(text) && !p?.recipe && !(Array.isArray(p?.declared) && p.declared.length)) return;
    const before = snips.length, junkBefore = junk.length;
    // 0. an encyclopedia page whose references led to pages that carry the claim shows NONE of its own words: the originals are its snips
    if (p?.tertiary && asArrP(p.origins).length) return;
    // 0b. an origin page: the sentence(s) the claim rests on, by address (each a holon that reads back as its own bytes)
    if (asArrP(p?.holons).length) {
      for (const h of p.holons) add(p, pi, snipFrom(p, pi, { kind: "passage", text: norm(text.slice(h.start, h.end)), credit: siteOf(p), range: { start: h.start, end: h.end }, via: h.via || null, address: h.address || null }));
      if (p.origin) return;     // a page read ONLY to be an origin has nothing else to quote
    }
    // 1. a structured block the page declares
    const rc = snipOfPassage(p);
    if (rc) {
      add(p, pi, snipFrom(p, pi, { kind: "recipe", text: recipeText(rc), credit: rc.credit.author || rc.credit.publisher || rc.credit.site || siteOf(p), title: rc.title || titleOf(p), card: rc }));
      if (snips.length === before && junk.length > junkBefore) gap(p, pi, "junk", "the recipe block this page declares is empty or is not the recipe");
      return;
    }
    const block = (Array.isArray(p?.declared) ? p.declared : [])[0];
    if (block) {
      const body = block.kind === "howto" ? block.items.map((x, i) => `${i + 1}. ${x}`).join("\n") : block.items.join("\n");
      add(p, pi, snipFrom(p, pi, { kind: block.kind, text: (block.name && block.kind === "howto" ? block.name + "\n" : "") + body, credit: block.author || siteOf(p), title: block.name || titleOf(p), items: block.items, name: block.name || "" }));
      if (snips.length === before && junk.length > junkBefore) gap(p, pi, "junk", "the block this page declares is empty or is not content");
      return;
    }
    // 2. a Wikipedia lead
    if (isWiki(p?.url || p?.source) && text.trim()) {
      const g = leadOf(text, limits.leadChars);
      if (g) { add(p, pi, snipFrom(p, pi, { kind: "lead", text: norm(text.slice(g.start, g.end)), credit: siteOf(p), range: { start: g.start, end: g.end }, ellipsisBefore: g.ellipsisBefore, ellipsisAfter: g.ellipsisAfter })); if (snips.length > before) return; }
    }
    // 3. the sentences that differ the ask, adjacent ones merged — scored AFTER the nav/header region: blocks that are chrome,
    //    or that sit ahead of where the content starts, are masked (offsets kept) so they are never scored or quoted
    const masked = maskNavRegion(text).text;
    const groups = groupsOf(masked, question, limits.perPassageChars);
    const words = (g) => masked.slice(g.start, g.end).trim().split(/\s+/).length;
    const long = groups.filter((g) => words(g) >= (limits.minSnipWords ?? STRAND.minSnipWords));
    for (const g of long.length ? long : groups) {
      add(p, pi, snipFrom(p, pi, { kind: "passage", text: norm(text.slice(g.start, g.end)), credit: siteOf(p), range: { start: g.start, end: g.end }, ellipsisBefore: g.ellipsisBefore, ellipsisAfter: g.ellipsisAfter }));
    }
    if (snips.length === before && text.trim()) gap(p, pi, junk.length > junkBefore || !groups.length ? "junk" : "none", junk.length > junkBefore ? "everything this page offered was the site talking about itself (menus, banners, notices), not its content" : "no passage on this page differs the ask");
  });
  // THE SMALLEST SPAN FIRST. The span is checked like every other snip (verifySnip: the page's own bytes, and the rewrite re-derived by its named rules);
  // one that fails is dropped, never shown. The groups quoted above become "more from this page" (`more: true`); with no span they stay the answer.
  let minimalGap = null;
  if (minimal && list.length) {
    const sp = minimal.spans.find((x) => !list[x.passageIndex]?.tertiary && !asArrP(list[x.passageIndex]?.holons).length) || null;       // an encyclopedia is a pointer, never the span; an ORIGIN page's addressed sentence is already the snip, never superseded
    const p = sp && list[sp.passageIndex];
    const lead = sp && p ? snipFrom(p, sp.passageIndex, {
      kind: "span", text: norm(sp.shown), verbatim: sp.text, credit: siteOf(p), range: { start: sp.start, end: sp.end }, ellipsisBefore: sp.start > 0, ellipsisAfter: true,
      context: { text: sp.sentence.text, start: sp.sentence.start, end: sp.sentence.end }, rewrite: sp.rewrite || null, atom: sp.atom || null, why: sp.why, confidence: sp.confidence, agreement: sp.agreement || 0, ...(sp.item ? { item: sp.item } : {}),
    }) : null;
    if (lead && verifySnip(lead, p)) { for (const s of snips) s.more = true; snips.unshift({ ...lead, more: false }); }
    else { if (lead) dropped.push(lead); minimalGap = minimal.gap || { kind: "no-span", reason: "no sentence in what was read states this", text: "no sentence in what was read states this" }; }
  }
  return { snips, dropped, junk, gaps, ...(minimalGap ? { minimalGap } : {}) };
}

/** The plain concatenation of the verbatim snip text — what `message.content` holds for a sources-only turn
 *  (the sources' words, not the model's; later turns and the conversation fold read it). */
export function strandText(snips) {
  return (Array.isArray(snips) ? snips : []).map((s) => String(s?.text ?? "")).filter(Boolean).join("\n\n");
}

/** Does a snip's text occur in the page text it came from? Whitespace-normalised, case-exact, never reworded.
 *  A structured snip checks each of its own units against the block the page declared (or the passage text). */
export function verifySnip(snip, passage) {
  if (!snip || !passage) return false;
  const hay = norm(passage.text);
  const has = (x) => { const n = norm(x); return !!n && hay.includes(n); };
  if (snip.kind === "span") {
    // the span's own words are the page's bytes (a page text, or the declared item it came from); what is SHOWN is either those bytes or their
    // re-derivation by the named rewrite rules (verifyRewrite), never anything else
    const v = norm(snip.verbatim);
    if (!v) return false;
    const item = snip.item ? (Array.isArray(passage.declared) ? passage.declared : [])[snip.item.block]?.items?.[snip.item.item] : null;
    if (!(snip.item ? typeof item === "string" && norm(item).includes(v) : hay.includes(v))) return false;
    if (norm(snip.text) === v) return true;
    return !!snip.rewrite && verifyRewrite(snip.rewrite, passage).ok && norm(snip.rewrite.text) === norm(snip.text);
  }
  if (snip.kind === "recipe") {
    const r = passage.recipe; if (!r) return false;
    const c = snip.card || {};
    const own = new Set([...(r.ingredients || []), ...(r.steps || [])].map(norm));
    const items = [...(c.ingredients || []), ...(c.steps || [])];
    return items.length > 0 && items.every((x) => own.has(norm(x)) || has(x));
  }
  if (snip.kind === "howto" || snip.kind === "faq" || snip.kind === "qa") {
    const blocks = Array.isArray(passage.declared) ? passage.declared : [];
    const own = new Set(blocks.flatMap((b) => b.items || []).map(norm));
    const items = snip.items || [];
    return items.length > 0 && items.every((x) => own.has(norm(x)) || has(x));
  }
  return has(snip.text);
}

/** Check every stored snip against the passages it claims to come from (`snip.p` indexes the passages).
 *  { ok, bad:[snip…] } — a snip that does not verify is a bug. */
export function verifySnips(snips, passages) {
  const bad = (Array.isArray(snips) ? snips : []).filter((s) => !verifySnip(s, (passages || [])[s.p]));
  return { ok: bad.length === 0, bad };
}

/** The credit line under a snip: "from en.wikipedia.org" — app-authored, never the model's. */
export function creditText(s) {
  if (!s) return "";
  if (s.kind === "pointer") return `a pointer, not a source \u00b7 found on ${s.site || "an encyclopedia"}`;
  const who = s.credit && s.credit !== s.site ? s.credit : "";
  return who ? `${who} · ${s.site || "source"}` : `from ${s.site || s.title || "the source"}`;
}

// ── the stored shape ───────────────────────────────────────────────────────
/** A snip as stored on the message: plain data, small. (The recipe card is kept whole — it is the card's own data.) */
export function storeSnip(s) {
  const { n, p, kind, text, source, title, site, credit, range, shadow, ellipsisBefore, ellipsisAfter, card, items, name, contact, via, pointers, address, verbatim, rewrite, context, atom, why, confidence, agreement, more, item } = s;
  return { n, p, kind, text, source, title, site, credit, range, shadow, ellipsisBefore, ellipsisAfter, ...(kind === "span" ? { verbatim, rewrite, context, atom, why, confidence, agreement, ...(item ? { item } : {}) } : {}), ...(more ? { more: true } : {}), ...(via ? { via } : {}), ...(pointers ? { pointers } : {}), ...(address ? { address } : {}), ...(contact ? { contact } : {}), ...(card ? { card } : {}), ...(items ? { items } : {}), ...(name ? { name } : {}) };
}

/** A slot answer's content is allowed only as the turn's own answer line: the turn carries an answer whose source sentence (`answer.row`,
 *  with its source) is kept verbatim, the content IS the answer's text, and every word of it occurs in that sentence (the line is built
 *  from the row's own words — realise() — so a word the sentence lacks is a word nobody sourced). Words are compared case- and
 *  diacritic-folded; no case is ever read. */
function answerTurnBacksContent(msg) {
  const a = msg.answerTurn && msg.answerTurn.answer;
  const row = a && a.row;
  if (!a || !row || typeof row.sentence !== "string" || !row.sentence.trim() || !row.source || !(row.source.url || row.source.title)) return false;
  const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
  // the content is the realised line, or the smallest span of the same source sentence (fold-chat-answerwire.js minimalOfTurn): the word check below holds for both
  const mini = msg.answerTurn.minimal && norm(msg.answerTurn.minimal.text);
  if (norm(a.text) !== norm(msg.content) && !(mini && mini === norm(msg.content))) return false;
  const words = (t) => (String(t ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("und").match(/[\p{L}\p{N}]+/gu) || []);
  const held = new Set(words(row.sentence));
  return words(msg.content).every((w) => held.has(w));
}

/** May this STORED assistant message carry model-written (non-notice) content? The invariant: only when the turn
 *  had at least one source, or its kind is one the model may answer alone (ALONE_KINDS), or it is sources-authored
 *  (then its content must be backed by snips). Messages that predate the rule (no `nSources` on the record) and
 *  the agent lane are out of scope. */
export function contentAllowed(msg, aloneKinds = []) {
  if (!msg || msg.role !== "assistant") return true;
  if (!String(msg.content ?? "").trim()) return true;
  if (msg.mode === "agent") return true;
  // A SLOT ANSWER (fold-chat-answerturn.js, stored with `answerTurn`, no snips): authored by the sources — the model is not called at all.
  if (msg.authored === "sources" && msg.answerTurn && typeof msg.answerTurn === "object") return answerTurnBacksContent(msg);
  if (msg.authored === "sources") return Array.isArray(msg.snips) && msg.snips.length > 0 && strandText(msg.snips).replace(/\s+/g, " ").trim() === String(msg.content).replace(/\s+/g, " ").trim();
  const rec = msg.grounding;
  if (!rec || rec.generate || rec.code) return true;
  if (typeof rec.nSources !== "number") return true;
  return rec.nSources > 0 || aloneKinds.includes(rec.kind);
}
