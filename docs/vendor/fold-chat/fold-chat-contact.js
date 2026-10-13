// fold-chat-contact.js — find how to reach the creator of a page, from the PAGE ITSELF. Pure: no DOM, no IO.
//
// What counts, and only this: an address the page (or its own contact/about page) PUBLISHES — a mailto: link, an
// email in the page's structured data, a Cloudflare 'email protected' link (decoded, because the page means it to
// be read by a person), or an address written out in the contact page's text — plus the site's own contact form.
// NEVER: a guessed address (info@…, contact@… are not invented), a registry/abuse contact (the 2026-10-05 check of the
// domain registration record of two recipe sites returned only the registrar and abuse@godaddy.com — the wrong
// place to send a thank-you), or an address that looks like machinery (noreply, privacy, legal, dmca, security…).
// An address found here is personal data of its owner: it is used on the person's own machine to fill a draft they
// send themselves, and goes nowhere else.

import { SUPPORT_ROUTES as DEF } from "./fold-chat-support-routes-def.js";

// Every declared word list below (role mailboxes, service desks, free-mail providers, contact words…) is READ from the
// definition of the kind "creator-support-route" (fold-chat-support-routes.json, sub-kinds email / form): one source of
// truth, so the tip finder and the holograph query see the same rules. Only the compiling lives here.
const R = DEF.emailRules;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => list.map(esc).join("|");
const EMAIL = /[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}/gi;
// Role mailboxes that are not for a person who wrote something (abuse desks, legal notices, bounce handlers…).
const MACHINERY = new RegExp("^(" + alt(R.machinery) + ")$", "i");
// SERVICE / OPS mailboxes (customer service, fulfilment, billing, subscriptions…): never where a thank-you goes.
// Matched as whole tokens of the local part ("customer.service", "orders", "it") AND as pieces of compound names
// ("alrcustserv", "customercare24", "helpdesk", "supportteam"). Declared, with its giver: the 2026-10-05 allrecipes
// check, where the contact page's protected link was a customer-service desk on a fulfilment company's domain.
const SERVICE_TOKEN = new RegExp("^(" + alt(R.serviceTokens) + ")$");
const SERVICE_COMPOUND = new RegExp(alt(R.serviceCompounds));
const SERVICE_PREFIX = new RegExp("^(" + alt(R.servicePrefixHeads) + ")(" + alt(R.servicePrefixTails) + "|\\d+)$");
export function isServiceMailbox(local) {
  const l = String(local || "").toLowerCase().replace(/[+].*$/, "");
  const joined = l.replace(/[._%-]+/g, "");
  return l.split(/[._%-]+/).some((t) => SERVICE_TOKEN.test(t)) || SERVICE_COMPOUND.test(joined) || SERVICE_PREFIX.test(joined);
}
// An address is believed only on the page's OWN site, or at a well-known free-mail provider (small creators use Gmail).
// A different company's domain (a fulfilment house, an ad network, a parent company) is dropped, whoever linked it.
// Declared constant, short on purpose.
const FREE_MAIL = new RegExp("(^|\\.)(" + R.freeMail.map((d) => esc(d).replace(/\\\.\\\*$/, "\\.[a-z.]+")).join("|") + ")$", "i");
/** Is this address's domain the page's own site, or a free-mail provider? (`siteUrl` is any page of the site.) */
export function emailDomainOk(address, siteUrl) {
  const d = String(address || "").split("@")[1] || "";
  if (!d) return false;
  if (FREE_MAIL.test(d)) return true;
  const base = hostBase(siteUrl);
  return !!base && hostBase("https://" + d) === base;
}
const NOT_A_PERSON_DOMAIN = new RegExp("(^|\\.)(" + alt(R.notAPersonDomains) + ")$", "i");
const ASSET_TAIL = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ico)$/i;

/** Cloudflare's 'email protected' link: the address is hex, XOR-ed with its first byte. Public by design. */
export function decodeCfEmail(hex) {
  const h = String(hex || "");
  if (!/^[0-9a-f]{4,}$/i.test(h) || h.length % 2) return "";
  const k = parseInt(h.slice(0, 2), 16); let out = "";
  for (let i = 2; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16) ^ k);
  return out;
}

/** Is this the kind of address a person publishes to be written to? */
export function isUsableEmail(addr) {
  const a = String(addr || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(a) || a.length > 120) return false;
  const [local, domain] = a.split("@");
  if (ASSET_TAIL.test(a) || /@\d+x\./.test(a)) return false;           // 'image@2x.png'
  if (MACHINERY.test(local.replace(/[+].*$/, "")) || isServiceMailbox(local)) return false;
  if (NOT_A_PERSON_DOMAIN.test(domain)) return false;
  return true;
}

export const hostBase = (u) => { try { const h = new URL(u).hostname.replace(/^www\./, "").split("."); return h.length > 2 && h[h.length - 2].length <= 3 && h[h.length - 1].length === 2 ? h.slice(-3).join(".") : h.slice(-2).join("."); } catch { return ""; } };
const textOf = (html) => String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const CONTACT_WORDS = new RegExp(alt(R.contactWords), "i");
const CONTACT_FIRST = new RegExp(alt(R.contactFirst), "i");
// "^press$" = whole word, "career$" = ends at a word edge (declared in the definition)
const ELSEWHERE = new RegExp(R.elsewhereWords.map((w) => (w.startsWith("^") ? "\\b" : "") + esc(w.replace(/^\^|\$$/g, "")) + (w.endsWith("$") ? "\\b" : "")).join("|"), "i");

/** Simple human obfuscations a person reads as an address: "name [at] site [dot] com", "name (at) site.com". */
function deobfuscated(text) {
  const out = [];
  const re = /([A-Z0-9][A-Z0-9._%+-]*)\s*[\[(]\s*at\s*[\])]\s*([A-Z0-9][A-Z0-9-]*(?:\s*[\[(]?\s*(?:dot|\.)\s*[\])]?\s*[A-Z0-9-]+)+)/gi;
  for (const m of text.matchAll(re)) out.push((m[1] + "@" + m[2].replace(/\s*[\[(]?\s*dot\s*[\])]?\s*/gi, ".").replace(/\s+/g, "")).toLowerCase());
  return out;
}

/**
 * What a page publishes about how to reach its owner.
 * Returns { emails: [{ address, where, rank }], pages: [url…], forms: [url…], author: string }:
 *   emails  best first. rank: 0 structured data, 1 mailto link / protected link, 2 written in the page text.
 *           An address on the page's own domain outranks a third party's (gmail.com is common for small creators,
 *           and is allowed only when the page itself puts it forward).
 *   pages   the site's own contact/about pages (same site only), contact before about, at most 3.
 *   forms   [pageUrl] when this page carries a message form (a textarea in a form).
 */
export function contactsFromHtml(raw, baseUrl = "") {
  // a commented-out address or link is NOT published (found on ruanyifeng.com, 2026-10-05: a mailto inside <!-- -->)
  const html = String(raw || "").replace(/<!--[\s\S]*?-->/g, " ");
  const found = new Map();           // address -> best candidate
  // An address merely WRITTEN in a page's text is believed only when it is on the page's own site, or the page is
  // itself a contact/about page (it is then putting the address forward). A link or structured data is the page
  // putting it forward anywhere. Comments and scripts are stripped before the text is read.
  const onContactPage = (() => { try { return CONTACT_WORDS.test(new URL(baseUrl).pathname); } catch { return false; } })();
  const add = (addr, where, rank) => {
    const a = String(addr || "").trim().replace(/^mailto:/i, "").replace(/[?#].*$/, "").toLowerCase();
    if (!isUsableEmail(a)) return;
    const own = hostBase(baseUrl) && a.split("@")[1] && (a.split("@")[1] === hostBase(baseUrl) || a.split("@")[1].endsWith("." + hostBase(baseUrl)));
    if (!emailDomainOk(a, baseUrl)) return;                    // any source: own site or free-mail only
    if (rank >= 2 && !own && !onContactPage) return;
    const r = rank - (own ? 0.5 : 0);
    const prev = found.get(a);
    if (!prev || r < prev.rank) found.set(a, { address: a, where, rank: r });
  };
  // 1) structured data: any object with an `email`
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") { if (typeof n.email === "string") add(n.email, "the page's structured data", 0); Object.values(n).forEach(walk); } };
    try { walk(JSON.parse(m[1].trim())); } catch { for (const e of m[1].matchAll(/"email"\s*:\s*"([^"]+)"/g)) add(e[1], "the page's structured data", 0); }
  }
  // 2) mailto: links and Cloudflare-protected links
  for (const m of html.matchAll(/href=["']mailto:([^"']+)["']/gi)) { try { add(decodeURIComponent(m[1]), "a mailto link on the page", 1); } catch { add(m[1], "a mailto link on the page", 1); } }
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) add(decodeCfEmail(m[1]), "a protected email link on the page", 1);
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) add(decodeCfEmail(m[1]), "a protected email link on the page", 1);
  // 3) written in the visible text (only where the page is a contact/about page, or it is the sole address)
  const text = textOf(html);
  // an address WRITTEN next to words that say it is for something else (ads, press, licensing, privacy, jobs) is not
  // the one to thank a creator at
  let prevEnd = 0;
  for (const m of text.matchAll(EMAIL)) {
    const ctx = text.slice(Math.max(prevEnd, m.index - 80), m.index);     // the words just before it, back to the previous address
    prevEnd = m.index + m[0].length;
    if (!ELSEWHERE.test(ctx)) add(m[0], "written on the page", 2);
  }
  for (const a of deobfuscated(text)) add(a, "written on the page", 2);
  const emails = [...found.values()].sort((x, y) => x.rank - y.rank || x.address.length - y.address.length).slice(0, 4);

  // the site's own contact/about pages
  const base = baseUrl ? hostBase(baseUrl) : "";
  const pages = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const label = textOf(m[2]).trim();
    if (!CONTACT_WORDS.test(m[1] + " " + label)) continue;
    let u; try { u = new URL(m[1], baseUrl || undefined); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (base && hostBase(u.href) !== base) continue;       // same site only: never wander off to a third party
    if (/\.(pdf|jpe?g|png|zip)$/i.test(u.pathname)) continue;
    const href = u.origin + u.pathname.replace(/\/+$/, "/") ; // drop query/fragment: a page, not a tracking link
    if (!pages.includes(href) && href !== (baseUrl || "").split(/[?#]/)[0]) pages.push(href);
  }
  pages.sort((a, b) => (CONTACT_FIRST.test(b) ? 1 : 0) - (CONTACT_FIRST.test(a) ? 1 : 0));
  // a message form: <form> containing a <textarea>
  const forms = [];
  for (const m of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) { if (/<textarea\b/i.test(m[0]) && !/search|comment|login|subscribe|newsletter/i.test(m[0].slice(0, 400))) { forms.push((baseUrl || "").split(/[?#]/)[0]); break; } }

  const author = (() => { for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { const j = JSON.parse(m[1].trim()); const hit = (n) => { if (Array.isArray(n)) { for (const x of n) { const r = hit(x); if (r) return r; } } else if (n && typeof n === "object") { if (n.author) { const a = [].concat(n.author)[0]; return typeof a === "string" ? a : a && a.name; } if (n["@graph"]) return hit(n["@graph"]); } return ""; }; const r = hit(j); if (r) return String(r).replace(/\s+/g, " ").trim(); } catch {} } return ""; })();
  return { emails, pages: pages.slice(0, 3), forms, author };
}

/** The best way to reach the creator from what was found: an email, else the site's contact form, else nothing. */
export function pickContact(found) {
  const f = found || {};
  if (f.emails && f.emails.length) return { kind: "email", address: f.emails[0].address, where: f.emails[0].where };
  if (f.forms && f.forms.length) return { kind: "form", url: f.forms[0], where: "the site's contact form" };
  return { kind: "none" };
}
