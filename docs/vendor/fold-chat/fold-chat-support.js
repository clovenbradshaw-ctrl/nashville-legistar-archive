// fold-chat-support.js — find the kind "creator-support-route" in a page, BY ITS TYPED DEFINITION. Pure: no DOM, no IO.
//
// The definition (fold-chat-support-routes.json, mirrored for the browser in fold-chat-support-routes-def.js) says what a
// tip-link / structured-donate / rel-payment / feed-author / humans-txt / email / form IS, what it is NOT, and where a
// finding sits (its address). This module only COMPILES that definition and walks a page with it: no platform, word or
// falsifier is written here. Retrieval by activation (THE-HOLOGRAPH): a finding carries `at` (page + node + byte range),
// held by the record and never handed to the model, so the record can re-expand it; `routesInPage` is the entry point
// the card, the Sources-only strand and later holograph queries ("which sources offer a way to support the creator?")
// share.
//
// NEVER here: a constructed handle or URL (a published link is used as published, minus tracking and prefilled-amount
// parameters), a payment, an amount, a registry / WHOIS / RDAP / IP / hosting lookup, security.txt. Nothing is fetched by
// this module at all.
import { SUPPORT_ROUTES as DEF } from "./fold-chat-support-routes-def.js";
import { hostBase, contactsFromHtml, isUsableEmail, emailDomainOk } from "./fold-chat-contact.js";

export const SUPPORT = DEF;
export const SUPPORT_KINDS = DEF.kinds;
export const SUPPORT_KIND_IDS = Object.freeze(DEF.kinds.map((k) => k.id));
/** The registry entry of one sub-kind: id, what it is, what it is not, standing, address shape, step. */
export const kindOf = (id) => DEF.kinds.find((k) => k.id === id) || null;
/** Every anti-pattern the definition declares, as "<kind>/<id>" (each has a falsifier test: fold-chat-support.test.mjs). */
export const FALSIFIER_IDS = Object.freeze(DEF.kinds.flatMap((k) => k.notThis.map((n) => `${k.id}/${n.id}`)));

// ── caseless-safe word matching ───────────────────────────────────────────────────────────────────────────────────
// Lower-case, drop Latin combining marks (ü -> u, é -> e; Hangul and kana recompose), dotless i -> i. NO [A-Z] logic: the
// scripts without case (Han, kana, Hangul, Arabic, Devanagari, Thai) pass through untouched.
const fold = (s) => String(s ?? "").normalize("NFKC").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").replace(/\u0131/g, "i").replace(/\s+/g, " ").trim();
// scripts written without spaces between words, or whose words take affixes: matched anywhere in the label
const UNSPACED = /[\u0e00-\u0e7f\u0600-\u06ff\u0750-\u077f\u0900-\u097f\u1100-\u11ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/u;
const flat = (group) => Object.entries(group).filter(([k]) => k !== "note").flatMap(([, v]) => v);
const WORD_SPLIT = /[^\p{L}\p{N}-]+/u;
// Token matching, not one giant regex: a 100-alternative unicode regex with look-behind cost seconds to compile and run (measured).
function phraseMatcher(list) {
  const subs = [], exact = new Map(), stems = [];
  for (const e of list) {
    const f = fold(e); if (!f) continue;
    if (UNSPACED.test(f) || /[^\p{L}\p{N} *-]/u.test(f)) { subs.push(f); continue; }          // unspaced scripts, and entries like 'support@'
    if (f.endsWith("*")) { stems.push(f.slice(0, -1)); continue; }
    const toks = f.split(" "); if (!exact.has(toks[0])) exact.set(toks[0], []); exact.get(toks[0]).push(toks);
  }
  return (folded) => {                                   // takes TEXT ALREADY FOLDED (fold once per link)
    if (subs.some((x) => folded.includes(x))) return true;
    const t = folded.split(WORD_SPLIT).filter(Boolean);
    for (let i = 0; i < t.length; i++) {
      if (stems.some((s) => t[i].startsWith(s))) return true;
      const c = exact.get(t[i]);
      if (c && c.some((p) => p.every((w, k) => t[i + k] === w))) return true;
    }
    return false;
  };
}
const hasStrong = phraseMatcher(flat(DEF.words.strong));
const hasName = phraseMatcher(DEF.words.platformNames.any);
const hasWeak = phraseMatcher(flat(DEF.words.weak));
const hasNewsTip = phraseMatcher(flat(DEF.words.newsTip));
const hasHelpdesk = phraseMatcher(flat(DEF.words.helpdesk));
const hasStoreLabel = phraseMatcher(DEF.store.labelWords);
const GENERIC_AUTHOR = new Set(DEF.feed.genericAuthors.map(fold));

// ── a small, offset-preserving page walker (no DOM) ───────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { try { if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)); } catch { return m; } return ENT[e.toLowerCase()] ?? m; });
const textOf = (h) => decode(String(h).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
function parseAttrs(rest) {
  const a = {};
  for (const m of String(rest).matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) { const k = m[1].toLowerCase(); if (!(k in a)) a[k] = decode(m[2] ?? m[3] ?? m[4] ?? ""); }
  return a;
}
const tokensOf = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const flagCache = new Map();
const frameFlags = (cls, id) => {
  const key = cls + "\u0000" + id; let f = flagCache.get(key);
  if (!f) { const toks = [...tokensOf(cls), ...tokensOf(id)], raw = fold(cls + " " + id); const starts = (list) => list.some((c) => (c.includes("-") ? raw.includes(c) : toks.some((t) => t.startsWith(c)))); f = { comment: starts(DEF.zones.comment), chrome: toks.some((t) => DEF.zones.chromeTokens.includes(t)), share: starts(DEF.zones.share), embed: starts(DEF.zones.embed) }; if (flagCache.size < 5000) flagCache.set(key, f); }
  return f;
};
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
/** Comments and script/style bodies blanked (offsets kept); anchors with their ancestors; <link> elements; JSON-LD blocks. */
export function scanPage(raw) {
  const text = String(raw ?? "");
  const lds = [];
  const blank = (m) => " ".repeat(m.length);
  let clean = text.replace(/<!--[\s\S]*?-->/g, blank);
  clean = clean.replace(/<(script|style|template|noscript)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (m, tag, attrs, body, off) => {
    if (tag.toLowerCase() === "script" && /type\s*=\s*["']?application\/ld\+json/i.test(attrs)) lds.push({ start: off, end: off + m.length, body });
    const open = m.slice(0, m.indexOf(">") + 1), close = m.slice(m.lastIndexOf("</"));
    return open + " ".repeat(Math.max(0, m.length - open.length - close.length)) + close;
  });
  const stack = [], anchors = [], links = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m, open = null;
  const closeOpen = (end) => { open.end = end; open.inner = clean.slice(open.innerStart, open.innerEnd); anchors.push(open); open = null; };
  while ((m = re.exec(clean))) {
    const name = m[2].toLowerCase();
    if (m[1]) {
      if (name === "a" && open) { open.innerEnd = m.index; closeOpen(m.index + m[0].length); continue; }
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === name) { stack.length = i; break; }
      continue;
    }
    const attrs = parseAttrs(m[3]);
    if (name === "a") {
      if (open) { open.innerEnd = m.index; closeOpen(m.index); }
      const top = stack[stack.length - 1];
      open = { start: m.index, innerStart: m.index + m[0].length, innerEnd: 0, end: 0, attrs, zone: top ? (top.comment ? "comment" : top.share ? "share" : top.embed ? "embed" : top.chrome ? "chrome" : "body") : "body" };
      continue;
    }
    if (name === "link") { links.push({ start: m.index, end: m.index + m[0].length, attrs }); continue; }
    if (VOID.has(name) || /\/\s*$/.test(m[3])) continue;
    const par = stack[stack.length - 1], fl = attrs.class || attrs.id ? frameFlags(attrs.class || "", attrs.id || "") : null;
    stack.push({ tag: name, comment: !!((par && par.comment) || (fl && fl.comment)), share: !!((par && par.share) || (fl && fl.share)), embed: !!((par && par.embed) || (fl && fl.embed) || DEF.zones.embedTags.includes(name)), chrome: !!((par && par.chrome) || (fl && fl.chrome) || DEF.zones.chromeTags.includes(name)) });
  }
  if (open) { open.innerEnd = clean.length; closeOpen(clean.length); }
  return { text, clean, anchors, links, lds };
}

// ── address: where a finding sits ─────────────────────────────────────────────────────────────────────────────────
const ASCII = /^[\x00-\x7f]*$/;
const encoder = new TextEncoder();
const byteAt = (text, i) => (ASCII.test(text) ? i : encoder.encode(text.slice(0, i)).length);
/** The record's address of a finding: the page, the kind of node, and its [start, end) in UTF-8 bytes of the page text as read. */
export function addressOf(page, node, text, start, end) {
  const ok = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start;
  return { page: String(page || ""), node, range: ok ? [byteAt(text, start), byteAt(text, end)] : null, unit: "utf8-bytes" };
}
/** The bytes an address names, re-expanded from the page text (the record's door; the model is never handed an address). */
export function expand(text, at) {
  if (!at || !at.range) return "";
  const b = encoder.encode(String(text ?? ""));
  return new TextDecoder().decode(b.slice(at.range[0], at.range[1]));
}

// ── links: platforms, own site, refusals ──────────────────────────────────────────────────────────────────────────
const parseHttp = (href, base) => { try { const u = new URL(String(href).trim(), base || undefined); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } };
const hostIs = (host, h) => host === h || host.endsWith("." + h);
const DENY = DEF.deny.hosts, STORE = DEF.store;
const HANDLE = /^[\p{L}\p{N}._~-]{1,60}$/u;
const dec1 = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const segMatch = (pat, seg, reserved) => {
  const s = dec1(seg);
  if (pat === "*") return !!s;
  const hmatch = (x) => HANDLE.test(x) && !reserved.includes(fold(x));
  if (pat === "{h}") return hmatch(s);
  if (pat === "${h}") return s.startsWith("$") && hmatch(s.slice(1));
  if (pat === "@{h}") return s.startsWith("@") && hmatch(s.slice(1));
  return fold(s) === fold(pat);
};
const platformReserved = (p) => (p.reserved || []).map(fold);
/** Which declared platform does this URL belong to, by host (exact or subdomain, never a lookalike) and a creator-shaped path? */
function platformOf(u) {
  const host = u.hostname.toLowerCase();
  let hostHit = null;
  for (const p of DEF.platforms) if (p.hosts.some((h) => hostIs(host, h))) { hostHit = p; if (p.subdomainRequired && !p.hosts.some((h) => host.endsWith("." + h))) continue; const m = pathMatch(p, u); if (m) return { p, ...m }; }
  return hostHit ? { p: hostHit, shape: false } : null;
}
function pathMatch(p, u) {
  if (u.port) return null;
  const segs = u.pathname.split("/").filter(Boolean), res = platformReserved(p);
  for (const pat of p.paths) {
    const seg = Array.isArray(pat) ? pat : pat.seg;
    if (seg.length !== segs.length) continue;
    if (!seg.every((s, i) => segMatch(s, segs[i], res))) continue;
    if (pat.requireQuery && !pat.requireQuery.some((k) => u.searchParams.has(k))) continue;
    const hi = seg.findIndex((s) => s.includes("{h}"));
    return { shape: true, handle: hi >= 0 ? dec1(segs[hi]).replace(/^[$@]/, "") : "" };
  }
  return null;
}
const lookalike = (host) => DEF.platforms.some((p) => p.hosts.some((h) => host.includes(h) && !hostIs(host, h)));
const isDenied = (host) => DENY.some((h) => hostIs(host, h));
const isStoreHost = (host) => STORE.hosts.some((h) => hostIs(host, h));
const PATH_TOKENS = (u) => dec1(u.pathname).replace(/[/_.+-]+/g, " ");
const storePath = (u) => { const t = fold(PATH_TOKENS(u)).split(" "); return STORE.pathWords.some((w) => t.includes(w)); };
const DROP_PARAM = /^(utm_[\w-]+|fbclid|gclid|mc_[\w-]+|ref|ref_src|source|amount|amt|value|price|prefill\w*|email|name|currency|currency_code|default_amount|donation_amount|fixed_amount|suggested_amount)$/i;
/** The URL as published, https for a platform host, minus tracking and prefill parameters; query kept only where the platform declares it. */
function normalized(u, p) {
  const keep = new Set((p && p.keepQuery) || []);
  const q = [...u.searchParams.entries()].filter(([k]) => keep.has(k) && !DROP_PARAM.test(k));
  const origin = p ? "https://" + u.host : u.origin;
  return origin + u.pathname + (q.length ? "?" + q.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&") : "");
}
export const urlKey = (u) => { try { const x = new URL(u); return x.hostname.toLowerCase() + x.pathname.replace(/\/+$/, ""); } catch { return String(u); } };

/**
 * Judge ONE candidate URL against the definition. cx: { page, label, zone, rel: Set, structured, affinity: Set }.
 * Returns { ok:true, platform, name, class, own, host, url, handle, evidence:[...] } or { ok:false, reason } where reason is a
 * `notThis` id of the kind (or 'no-evidence' / 'other-host' / 'not-http').
 */
export function judgeLink(href, cx) {
  const u = parseHttp(href, cx.page);
  if (!u) return { ok: false, reason: "not-http" };
  const host = u.hostname.toLowerCase();
  if (u.username || u.password) return { ok: false, reason: "lookalike-host" };
  const plat = platformOf(u);
  if (!plat && lookalike(host)) return { ok: false, reason: "lookalike-host" };
  if (!plat && isDenied(host)) return { ok: false, reason: "shortener-tracker" };
  const label = cx.label || "";
  const own0 = !plat && !!hostBase(cx.page) && hostBase(u.href) === hostBase(cx.page);
  if (!plat && !own0) {          // another site that is not a platform: never a tip link; the reason names a donate link to another org
    return { ok: false, reason: fold(label).split(" ").length <= 8 && hasStrong(fold(label)) ? "other-org-donate" : "other-host" };
  }
  const pathWords = (() => { const segs = u.pathname.split("/").filter(Boolean); const t = fold(PATH_TOKENS(u)).split(" ").filter(Boolean); return segs.length <= 2 && t.length <= 5 ? t.join(" ") : ""; })();   // an article slug is a topic, not a button
  const labelWords = fold(label).split(" ").length <= 8 ? label : "";                                              // a headline is not a button either
  const ownWords = fold((fold(label).split(" ").length <= 4 ? label : "") + " " + pathWords);                      // an own-site button is shorter still: 4 words
  const words = fold(labelWords + " " + pathWords);
  if (hasNewsTip(words) || hasNewsTip(fold(PATH_TOKENS(u)))) return { ok: false, reason: "news-tip" };
  if (hasHelpdesk(words) || hasHelpdesk(fold(label)) || /^support\./.test(host)) return { ok: false, reason: "helpdesk-support" };
  if (cx.zone === "comment" || [...(cx.rel || [])].some((r) => DEF.zones.relRefuse.includes(r))) return { ok: false, reason: "comment-section" };
  let strong = hasStrong(words), weak = hasWeak(words), named = strong || hasName(words);
  if (!plat) { strong = hasStrong(ownWords); named = strong || hasName(ownWords); }
  const declared = !!(cx.structured || (cx.rel && [...cx.rel].some((r) => DEF.zones.relPayment.includes(r) || r === "me")));
  const signal = []; if (cx.structured) signal.push("structured"); if (cx.rel && cx.rel.size) signal.push("rel"); if (strong) signal.push("words"); if (cx.zone === "chrome") signal.push("chrome");
  if (plat) {
    const { p } = plat;
    if (!plat.shape) return { ok: false, reason: "generic-platform-page" };
    if (urlKey(u.href) === urlKey(cx.page)) return { ok: false, reason: "same-page" };
    if (storePath(u) && !strong) return { ok: false, reason: "store-checkout" };
    if (p.needsWords && !(strong || weak)) return { ok: false, reason: "store-checkout" };
    const handleOwn = plat.handle && cx.affinity && affine(plat.handle, cx.affinity);
    if (handleOwn) signal.push("own-handle");
    if (p.class === "processor") { if (!(cx.zone === "chrome" || declared)) return { ok: false, reason: "body-link-no-evidence" }; }
    else if (!(declared || strong || cx.zone === "chrome" || handleOwn)) return { ok: false, reason: "body-link-no-evidence" };
    return { ok: true, platform: p.id, name: p.name, class: p.class, own: false, host, url: normalized(u, p), handle: plat.handle || "", evidence: ["platform-host", ...signal], upgraded: u.protocol === "http:" };
  }
  // not a platform: on the page's own site
  const own = true;
  if (cx.rel && cx.rel.has("me") && ![...cx.rel].some((r) => DEF.zones.relPayment.includes(r))) return { ok: false, reason: "rel-me-social" };
  if (isStoreHost(host) || storePath(u) || hasStoreLabel(fold(label))) return { ok: false, reason: "store-checkout" };
  if (urlKey(u.href) === urlKey(cx.page)) return { ok: false, reason: "same-page" };
  if (!(named || cx.structured || (cx.rel && [...cx.rel].some((r) => DEF.zones.relPayment.includes(r))))) return { ok: false, reason: "no-evidence" };
  if (u.protocol === "http:" && /^https:/i.test(cx.page || "")) return { ok: false, reason: "no-evidence" };
  if (named && !strong) signal.push("words");
  return { ok: true, platform: "own-site", name: "their own site", class: "own", own: true, host, url: normalized(u, null), handle: "", evidence: ["own-site", ...signal] };
}
function affine(handle, aff) {
  const h = fold(handle).replace(/[^a-z0-9]/g, "");
  if (h.length < 4) return false;
  return [...aff].some((a) => a.length >= 4 && (a.includes(h) || h.includes(a)));
}
const affinityOf = (pageUrl, author) => {
  const set = new Set();
  try {
    const u = new URL(pageUrl);
    const parts = hostBase(pageUrl).split("."); if (parts[0]) set.add(parts[0]);
    if (DEF.zones.codeForms.includes(u.hostname.replace(/^www\./, ""))) { const seg = u.pathname.split("/").filter(Boolean)[0]; if (seg) set.add(fold(seg).replace(/[^a-z0-9]/g, "")); }
  } catch { /* no page url: no affinity */ }
  const a = fold(author || "").replace(/[^\p{L}\p{N} ]/gu, "");
  if (a) { set.add(a.replace(/ /g, "")); for (const w of a.split(" ")) if (w.length >= 4) set.add(w); }
  return new Set([...set].map((x) => x.replace(/[^a-z0-9]/g, "")).filter(Boolean));
};

const relSet = (v) => new Set(fold(v || "").split(" ").filter(Boolean));
const whereOf = (via, evidence) => ({
  structured: "in the page's structured data",
  rel: "in a link the page marks as a payment or donation link",
  humans: "in their humans.txt",
}[via] || "on the page");

// ── structured data ───────────────────────────────────────────────────────────────────────────────────────────────
function ldCandidates(lds) {
  const out = [];
  const strs = (v) => [].concat(v || []).filter((x) => typeof x === "string");
  const targets = (v) => [].concat(v || []).flatMap((x) => (typeof x === "string" ? [x] : x && typeof x === "object" ? strs([x.url, x.urlTemplate, x["@id"]]) : []));
  for (const ld of lds) {
    let j; try { j = JSON.parse(ld.body.trim()); } catch { continue; }
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      if ([].concat(n["@type"] || []).map(String).includes("DonateAction")) for (const s of targets([n.target, n.url])) out.push({ href: s, ld, via: "donate-action" });
      for (const s of strs(n.sameAs)) out.push({ href: s, ld, via: "same-as" });
      Object.values(n).forEach(walk);
    };
    walk(j);
  }
  return out;
}

// ── social profiles ───────────────────────────────────────────────────────────────────────────────────────────────
const SOC = DEF.social;
const SHARE_WORDS = new Set(["sharer", "sharer.php", "share", "share.php", "intent", "send", "dialog", "sharearticle", "sharing", "plugins", "submit", "tr", "pin", "oembed", "embed"]);
const POST_WORDS = new Set(SOC.share.pathWords.map(fold));
function socialPlatformOf(u, declared) {
  const host = u.hostname.toLowerCase();
  for (const p of SOC.platforms) {
    if (p.anyHost) { if (declared) { const m = pathMatch(p, u); if (m) return { p, ...m }; } continue; }
    if (!p.hosts.some((h) => hostIs(host, h))) continue;
    const baseHit = p.hosts.some((h) => host === h || host === "www." + h);
    for (const pat of p.paths) {
      const seg = Array.isArray(pat) ? pat : pat.seg;
      if (seg.length === 0 && baseHit) continue;                                  // a publication root needs its own subdomain (maria.substack.com)
      if (seg.length === 0 && !p.subdomainOk) continue;
      const m = pathMatch({ ...p, paths: [pat] }, u);
      if (m) return { p, ...m };
    }
    return { p, shape: false };
  }
  return null;
}
const lookalikeSocial = (host) => SOC.platforms.some((p) => p.hosts.some((h) => host.includes(h) && !hostIs(host, h)));
/**
 * Judge ONE candidate URL as a social profile of the page's owner. cx: { page, zone, rel: Set, structured, affinity, owner }.
 * Returns { ok:true, platform, name, hub, host, url, handle, evidence } or { ok:false, reason } (a `notThis` id of social-profile,
 * or 'no-evidence' / 'not-a-platform' / 'not-http').
 */
export function judgeSocial(href, cx) {
  const u = parseHttp(href, cx.page);
  if (!u) return { ok: false, reason: "not-http" };
  const host = u.hostname.toLowerCase();
  if (u.username || u.password) return { ok: false, reason: "lookalike-host" };
  if (SOC.share.hosts.some((h) => hostIs(host, h)) && !/(^|\.)tumblr\.com$/.test(host)) return { ok: false, reason: "share-button" };
  const declared = !!(cx.structured || (cx.rel && cx.rel.has("me")));
  const plat = socialPlatformOf(u, declared);
  if (!plat) return { ok: false, reason: lookalikeSocial(host) ? "lookalike-host" : "not-a-platform" };
  const segs = u.pathname.split("/").filter(Boolean).map((x) => fold(dec1(x)));
  if (segs.some((x) => SHARE_WORDS.has(x)) && segs.length >= 1 && (segs.length > 1 || !plat.shape)) return { ok: false, reason: "share-button" };
  if (SOC.share.queryKeys.some((k) => u.searchParams.has(k))) return { ok: false, reason: "share-button" };
  if (cx.zone === "share") return { ok: false, reason: "share-toolbar" };
  if (cx.zone === "comment" || [...(cx.rel || [])].some((r) => DEF.zones.relRefuse.includes(r))) return { ok: false, reason: "comment-profile" };
  if (cx.zone === "embed") return { ok: false, reason: "embedded-post" };
  if (!plat.shape) return { ok: false, reason: segs.length > 1 || segs.some((x) => POST_WORDS.has(x)) ? "post-or-video-url" : "post-or-video-url" };
  if (segs.length && POST_WORDS.has(segs[0]) && !["pages", "profile", "in", "company", "school", "user", "u", "r", "c", "channel", "users"].includes(segs[0])) return { ok: false, reason: "post-or-video-url" };
  const root = plat.shape && !u.pathname.replace(/\//g, "") && plat.p.subdomainOk;
  const handle = plat.handle || (root ? host.split(".")[0] : "");
  const evidence = [];
  if (cx.structured) evidence.push("structured"); if (cx.rel && cx.rel.has("me")) evidence.push("rel");
  // on the platform's own pages (a GitHub page), only the page owner's profile is the creator's: everything else is the platform's navigation
  const sameDomain = !!hostBase(cx.page) && hostBase(u.href) === hostBase(cx.page);
  if (sameDomain && !declared) {
    let owner = ""; try { owner = fold(dec1(new URL(cx.page).pathname.split("/").filter(Boolean)[0] || "")); } catch { /* none */ }
    if (!handle || fold(handle) !== owner) return { ok: false, reason: "platform-own-nav" };
    evidence.push("page-owner");
  }
  const own = handle && cx.affinity && affine(handle, cx.affinity);
  if (own) evidence.push("own-handle");
  if (cx.zone === "chrome") evidence.push("chrome");
  if (!evidence.length) return { ok: false, reason: "someone-elses-profile" };
  // a link hub, or a community (a subreddit), is shared ground: it must be declared or carry the owner's name
  const community = plat.p.community && segs[0] && plat.p.community.includes(segs[0]);
  if ((plat.p.hub || community) && !(declared || own)) return { ok: false, reason: "someone-elses-profile" };
  const keep = u.protocol === "http:" ? "https://" : u.protocol + "//";
  const q = u.pathname === "/profile.php" && u.searchParams.get("id") ? "?id=" + encodeURIComponent(u.searchParams.get("id")) : "";
  return { ok: true, platform: plat.p.id, name: plat.p.id === "mastodon" ? `Mastodon (${host})` : plat.p.name, hub: !!plat.p.hub, host, url: keep + u.host + u.pathname + q, handle, evidence };
}
const socialScore = (c) => (c.evidence.includes("structured") ? 4 : 0) + (c.evidence.includes("rel") ? 4 : 0) + (c.evidence.includes("page-owner") ? 3 : 0) + (c.evidence.includes("own-handle") ? 2 : 0) + (c.evidence.includes("chrome") ? 1 : 0);
/** The creator's own website: the origin of the page being read (derived, never searched; opened only on a click). */
export function websiteOf(pageUrl) {
  const u = parseHttp(pageUrl, undefined);
  if (!u) return null;
  return { kind: "website", url: u.origin + "/", host: u.hostname.replace(/^www\./, ""), where: "the page's own site", at: { page: String(pageUrl), node: "page", range: null, unit: "utf8-bytes" } };
}
/** Re-verify a stored social route (a stored card is not trusted): https, a declared platform host (Mastodon only if it was declared by the page), a profile shape, not a share URL. */
export function socialStillValid(soc, siteUrl) {
  if (!soc || typeof soc.url !== "string") return false;
  const u = parseHttp(soc.url, undefined);
  if (!u || u.protocol !== "https:") return false;
  const declared = !!(soc.evidence && (soc.evidence.includes("rel") || soc.evidence.includes("structured")));
  const v = judgeSocial(u.href, { page: siteUrl, zone: "chrome", structured: declared });
  if (v.ok) return true;
  return false;
}

/**
 * The retrieval entry point. What this page (one the creator's own site published) offers, typed and addressed.
 *   opts: { author?, skipTips?, cap? }   author: the credited name (a source of the page's own handle); skipTips: the page is on
 *                                   a marketplace / UGC platform whose address is the platform's, not the creator's
 * Returns { schema, kind, page, findings, rejected, feeds, pages, forms, author }:
 *   findings  [{ kind:'tip-link'|'structured-donate'|'rel-payment'|'email'|'form', ..., at, where, evidence }] best first
 *   rejected  [{ url, reason }] every link the definition refused, with the notThis id (a gap shown, never filled)
 */
export function routesInPage(raw, pageUrl = "", opts = {}) {
  const sc = scanPage(raw);
  const text = sc.text;
  const aff = affinityOf(pageUrl, opts.author);
  const cands = [], rejected = [], socCands = [];
  const considerSoc = (href, cx, node, start, end, via) => {
    const v = judgeSocial(href, { page: pageUrl, affinity: aff, ...cx });
    if (!v.ok) { if (v.reason !== "not-a-platform" && v.reason !== "not-http" && rejected.filter((x) => x.route === "social").length < 60) rejected.push({ url: String(href).slice(0, 200), reason: v.reason, route: "social" }); return; }
    socCands.push({ ...v, kind: "social-profile", via, at: addressOf(pageUrl, node, text, start, end) });
  };
  const consider = (href, cx, kindId, node, start, end, via) => {
    const v = judgeLink(href, { page: pageUrl, affinity: aff, ...cx });
    if (!v.ok) { if (rejected.filter((x) => !x.route).length < 40) rejected.push({ url: String(href).slice(0, 200), reason: v.reason }); return; }
    cands.push({ ...v, kind: kindId, via, at: addressOf(pageUrl, node, text, start, end) });
  };
  if (!opts.skipTips) {
    for (const a of sc.anchors) {
      const href = a.attrs.href; if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href.trim())) continue;
      const rel = relSet(a.attrs.rel);
      const label = [textOf(a.inner), a.attrs["aria-label"], a.attrs.title, ...[...a.inner.matchAll(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => decode(m[1] ?? m[2]))].filter(Boolean).join(" ").slice(0, 300);      // a button's label is short; a wrapped block is not a label
      const paymentRel = [...rel].some((r) => DEF.zones.relPayment.includes(r));
      consider(href, { label, zone: a.zone, rel }, paymentRel || rel.has("me") ? "rel-payment" : "tip-link", "a", a.start, a.end, paymentRel ? "rel" : "page");
      considerSoc(href, { zone: a.zone, rel }, "a", a.start, a.end, rel.has("me") ? "rel" : "page");
    }
    for (const l of sc.links) {
      const rel = relSet(l.attrs.rel); if (!l.attrs.href) continue;
      const paymentRel = [...rel].some((r) => DEF.zones.relPayment.includes(r));
      if (paymentRel || rel.has("me")) consider(l.attrs.href, { label: l.attrs.title || "", zone: "chrome", rel }, "rel-payment", "link", l.start, l.end, "rel");
      if (rel.has("me")) considerSoc(l.attrs.href, { zone: "chrome", rel }, "link", l.start, l.end, "rel");
    }
    for (const c of ldCandidates(sc.lds)) {
      if (/[{}]/.test(c.href)) { rejected.push({ url: String(c.href).slice(0, 200), reason: "url-template" }); continue; }
      // a sameAs profile counts only on a creator platform, never as the page's own site (that is an identity link, not a payment page)
      const u = parseHttp(c.href, pageUrl);
      if (c.via === "same-as") considerSoc(c.href, { zone: "chrome", structured: true }, "json-ld", c.ld.start, c.ld.end, "structured");
      if (c.via === "same-as" && (!u || !platformOf(u))) { rejected.push({ url: String(c.href).slice(0, 200), reason: "sameas-not-payment" }); continue; }
      consider(c.href, { label: "", zone: "chrome", structured: true }, "structured-donate", "json-ld", c.ld.start, c.ld.end, "structured");
    }
  }
  // dedupe on the target, keep the best evidence; creator platforms with several DIFFERENT pages are ambiguous
  const score = (c) => (c.evidence.includes("structured") ? 4 : 0) + (c.evidence.includes("rel") ? 4 : 0) + (c.evidence.includes("words") ? 2 : 0) + (c.evidence.includes("chrome") ? 1 : 0) + (c.evidence.includes("own-handle") ? 2 : 0);
  const byUrl = new Map();
  for (const c of cands) { const k = urlKey(c.url); const prev = byUrl.get(k); if (!prev || score(c) > score(prev)) byUrl.set(k, { ...c, evidence: prev ? [...new Set([...prev.evidence, ...c.evidence])] : c.evidence }); else prev.evidence = [...new Set([...prev.evidence, ...c.evidence])]; }
  let uniq = [...byUrl.values()];
  const byPlatform = new Map();
  for (const c of uniq) if (c.class === "creator") { if (!byPlatform.has(c.platform)) byPlatform.set(c.platform, []); byPlatform.get(c.platform).push(c); }
  for (const [, group] of byPlatform) {
    if (group.length < 2) continue;
    const decided = group.filter((c) => c.evidence.some((e) => ["structured", "rel", "own-handle"].includes(e)));
    const keep = decided.length === 1 ? decided[0] : null;
    for (const c of group) if (c !== keep) { uniq = uniq.filter((x) => x !== c); rejected.push({ url: c.url, reason: "ambiguous-handles" }); }
  }
  uniq.sort((x, y) => score(y) - score(x) || x.at.range[0] - y.at.range[0]);
  const tips = uniq.slice(0, 3).map((c) => ({ kind: c.kind, platform: c.platform, platformName: c.name, class: c.class, own: c.own, host: c.host, url: c.url, via: c.via, evidence: c.evidence, where: whereOf(c.via), at: c.at, ...(c.upgraded ? { upgraded: true } : {}) }));

  // social profiles: dedupe, at most perPlatformMax per platform (the second only if it is declared or in the chrome), at most SOC.cap in all
  const sBy = new Map();
  for (const c of socCands) { const k = c.handle ? c.platform + "/" + c.handle.toLowerCase() : urlKey(c.url); const prev = sBy.get(k); if (!prev) sBy.set(k, c); else prev.evidence = [...new Set([...prev.evidence, ...c.evidence])]; }
  const socials = [], perPlat = new Map();
  for (const c of [...sBy.values()].sort((x, y) => socialScore(y) - socialScore(x) || x.at.range[0] - y.at.range[0])) {
    const n = perPlat.get(c.platform) || 0;
    if (n >= SOC.perPlatformMax || (n >= 1 && !c.evidence.some((e) => ["structured", "rel", "own-handle", "page-owner"].includes(e)))) { rejected.push({ url: c.url, reason: "someone-elses-profile", route: "social" }); continue; }
    if (c.hub && socials.some((x) => x.hub)) continue;
    perPlat.set(c.platform, n + 1); socials.push(c);
  }
  const socialFindings = socials.slice(0, opts.cap ?? SOC.cap).map((c) => ({ kind: "social-profile", platform: c.platform, platformName: c.name, host: c.host, url: c.url, hub: c.hub, via: c.via, evidence: c.evidence, where: c.evidence.includes("structured") ? "in the page's structured data" : c.evidence.includes("rel") ? "in a rel=\"me\" link on the page" : "on the page", at: c.at }));
  // email, form, contact pages, credited author: the existing rules, read from the definition
  const found = contactsFromHtml(text, pageUrl);
  const findings = [...tips];
  const site = opts.skipTips ? null : websiteOf(pageUrl);
  for (const e of found.emails) findings.push({ kind: "email", email: e.address, where: e.where, rank: e.rank, at: locateEmail(sc, pageUrl, e.address) });
  for (const f of found.forms) { const m = /<form\b[\s\S]*?<\/form>/i.exec(sc.clean); findings.push({ kind: "form", url: f, where: "the site's contact form", at: addressOf(pageUrl, "form", text, m ? m.index : -1, m ? m.index + m[0].length : -1) }); }
  findings.push(...socialFindings); if (site) findings.push(site);
  return { schema: "SupportRoutesFound@1", kind: DEF.kind, page: String(pageUrl || ""), findings, rejected, socials: socialFindings, website: site, feeds: feedsOfScan(sc, pageUrl), pages: found.pages, forms: found.forms, author: found.author, found };
}
function locateEmail(sc, page, address) {
  const i = sc.clean.toLowerCase().indexOf(String(address).toLowerCase());
  return addressOf(page, i >= 0 ? "mailto-link-or-text" : "derived", sc.text, i, i >= 0 ? i + address.length : -1);
}

// ── the feed ──────────────────────────────────────────────────────────────────────────────────────────────────────
function feedsOfScan(sc, pageUrl) {
  const out = [];
  for (const l of sc.links) {
    const rel = relSet(l.attrs.rel), type = fold(l.attrs.type || "");
    if (!rel.has("alternate") || !/^application\/(rss|atom)\+xml/.test(type) || !l.attrs.href) continue;
    const u = parseHttp(l.attrs.href, pageUrl); if (!u) continue;
    if (hostBase(u.href) !== hostBase(pageUrl) || !hostBase(pageUrl)) continue;      // same site only: feedburner.com is another site
    if (/comments/.test(u.pathname) || /comment/.test(fold(l.attrs.title || ""))) continue;
    const href = u.origin + u.pathname + u.search; if (!out.includes(href)) out.push(href);
  }
  return out.slice(0, 2);
}
/** The same-site RSS / Atom feeds a page advertises (rel=alternate), at most 2, comment feeds left out. */
export const feedsOfHtml = (raw, pageUrl) => feedsOfScan(scanPage(raw), pageUrl);

const cdata = (s) => decode(String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const tagText = (xml, tag) => { const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml); return m ? cdata(m[1]) : ""; };
/** "email (Name)" | "Name <email>" | "email" | "Name" -> { name, email } */
function personOf(s) {
  const t = cdata(s); if (!t) return { name: "", email: "" };
  const em = /[^\s<>()]+@[^\s<>()]+\.[A-Za-z]{2,}/.exec(t); const email = em ? em[0] : "";
  const name = t.replace(email, "").replace(/[<>()]/g, " ").replace(/\s+/g, " ").trim();
  return { name: GENERIC_AUTHOR.has(fold(name)) ? "" : name.slice(0, 80), email };
}
/** Parse an RSS / Atom feed into what a card can use later: the feed's own author and each item's creator by link. Nothing is kept but names, links and (feed-level) addresses. */
export function parseFeed(xml) {
  const x = String(xml ?? "");
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(x.slice(0, 2000))) return null;
  const firstItem = x.search(/<(item|entry)\b/i);
  const head = firstItem < 0 ? x : x.slice(0, firstItem);
  const feed = { people: [], items: [] };
  const add = (tag, from) => { const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(head); if (m) { const inner = m[1]; const nm = tagText(inner, "name"); const em = tagText(inner, "email"); const p = nm || em ? { name: GENERIC_AUTHOR.has(fold(nm)) ? "" : nm, email: em } : personOf(inner); feed.people.push({ ...p, from }); } };
  add("managingEditor", "managingEditor"); add("webMaster", "webMaster"); add("author", "author"); add("itunes:author", "itunes:author"); add("dc:creator", "dc:creator");
  let n = 0;
  for (const m of x.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (n++ >= DEF.feed.maxItems) break;
    const body = m[2];
    const link = (/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(body) || /<link\b[^>]*rel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i.exec(body) || /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(body) || [])[1] || tagText(body, "link") || tagText(body, "guid");
    const au = /<author\b[^>]*>([\s\S]*?)<\/author>/i.exec(body);
    const who = (au && (tagText(au[1], "name") || personOf(au[1]).name)) || tagText(body, "dc:creator") || tagText(body, "itunes:author");
    const name = GENERIC_AUTHOR.has(fold(who)) ? "" : who.slice(0, 80);
    if (link && name) feed.items.push({ link: decode(link).trim(), name });
  }
  return feed;
}
/**
 * The author a feed names for THIS page: the item whose link is the page; else the feed's own author; else the one creator
 * every item shares. A group feed that names several creators and none the page names nothing. An address only if it passes
 * the email rules (usable, own domain or free-mail) — webMaster is a technical contact and its address is rarely offered.
 */
export function authorFromFeed(feed, pageUrl, siteUrl = pageUrl) {
  if (!feed) return null;
  const key = urlKey(pageUrl);
  const item = feed.items.find((i) => urlKey(i.link) === key);
  const lead = feed.people.find((p) => p.name) || null;
  const distinct = [...new Set(feed.items.map((i) => i.name))];
  const name = (item && item.name) || (lead && lead.name) || (distinct.length === 1 ? distinct[0] : "");
  const addr = feed.people.filter((p) => p.email).find((p) => isUsableEmail(p.email) && emailDomainOk(p.email, siteUrl));
  if (!name && !addr) return null;
  return { ...(name ? { name, nameFrom: item ? "the feed's entry for this page" : lead ? "the feed's author" : "the feed's creator" } : {}), ...(addr ? { email: addr.email.toLowerCase(), emailFrom: `the site's feed (${addr.from})` } : {}) };
}

// ── humans.txt ────────────────────────────────────────────────────────────────────────────────────────────────────
/** What a site's humans.txt (read through the direct door only) offers: a name, links that pass the tip-link rules, addresses that pass the email rules. */
export function humansOfText(raw, siteUrl) {
  const text = String(raw ?? "");
  if (/<\s*(html|body)\b/i.test(text.slice(0, 500))) return null;           // an HTML error page, not a humans.txt
  const tips = [], emails = []; let name = "";
  for (const line of text.split(/\r?\n/).slice(0, 400)) {
    const nm = /^\s*(name|author|creator|writer|developer|autor|nom|名前)\s*:\s*(.{2,60})$/i.exec(line);
    if (nm && !name && !/@|https?:/.test(nm[2]) && !GENERIC_AUTHOR.has(fold(nm[2]))) name = nm[2].trim();
    for (const m of line.matchAll(/https?:\/\/[^\s<>"')]+/g)) {
      const v = judgeLink(m[0].replace(/[.,;]+$/, ""), { page: siteUrl, label: line.slice(0, m.index), zone: "chrome" });
      if (v.ok && !tips.some((t) => urlKey(t.url) === urlKey(v.url))) tips.push({ kind: "tip-link", platform: v.platform, platformName: v.name, class: v.class, own: v.own, host: v.host, url: v.url, via: "humans", evidence: v.evidence, where: whereOf("humans"), at: { page: String(siteUrl), node: "humans", range: null, unit: "utf8-bytes" } });
    }
    for (const m of line.matchAll(/[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}/g)) if (isUsableEmail(m[0]) && emailDomainOk(m[0], siteUrl) && !emails.includes(m[0].toLowerCase())) emails.push(m[0].toLowerCase());
  }
  return tips.length || emails.length || name ? { name, tips: tips.slice(0, 3), emails: emails.slice(0, 2) } : null;
}

// ── holograph queries ─────────────────────────────────────────────────────────────────────────────────────────────
/** Does a record (a card's `contact`, or a passage with `contacts`) offer a way to support the creator? kind: 'tip' | 'email' | 'form' | null. */
export function offeredKind(rec) {
  const c = rec && (rec.contact || rec.contacts || rec);
  if (!c || typeof c !== "object") return null;
  if (c.tip || (Array.isArray(c.tips) && c.tips.length)) return "tip";
  if (c.kind === "tip") return "tip";
  if (c.kind === "email" || (Array.isArray(c.emails) && c.emails.length)) return "email";
  if (c.kind === "form" || (Array.isArray(c.forms) && c.forms.length)) return "form";
  return null;
}
/** "Which sources offer a way to support the creator?": the records (passages / cards) that carry a tip route, then email, then form. */
export function sourcesOffering(records, want = ["tip", "email", "form"]) {
  return (records || []).map((r) => ({ record: r, via: offeredKind(r) })).filter((x) => x.via && want.includes(x.via)).sort((a, b) => want.indexOf(a.via) - want.indexOf(b.via));
}
/** Re-verify a stored tip route (a stored card is not trusted): https, a known platform or the page's own site, a creator-shaped path. */
export function tipStillValid(tip, siteUrl) {
  if (!tip || typeof tip.url !== "string") return false;
  const u = parseHttp(tip.url, undefined);
  if (!u || u.protocol !== "https:") return false;
  const v = judgeLink(u.href, { page: siteUrl, label: "", zone: "chrome", structured: tip.via === "structured" || tip.evidence?.includes?.("structured") });
  if (v.ok) return true;
  // an own-site page was accepted on its words, which are not stored: trust it only if it is on the page's own site
  return !!tip.own && hostBase(u.href) === hostBase(siteUrl) && !isDenied(u.hostname) && !lookalike(u.hostname.toLowerCase()) && !isStoreHost(u.hostname.toLowerCase());
}
