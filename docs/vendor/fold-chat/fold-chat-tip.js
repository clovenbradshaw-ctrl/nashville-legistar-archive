// fold-chat-tip.js — "Tip the creator": find how to reach the creator FROM THEIR OWN WEBSITE and draft the note.
//
// NOTHING IS PAID OR SENT. The Fold finds how the creator publishes a way to reach them, and either opens the
// person's own email app with a draft (mailto:) or, when the site publishes no address, points at the creator's own
// contact form with the draft copied. The person reads and sends it themselves.
//
// The rules, each enforced here and pinned by a test (fold-chat-tip.test.mjs):
//   0. WHAT counts, and where it is found, is the DEFINITION of the kind "creator-support-route"
//      (fold-chat-support-routes.json; recognizers in fold-chat-support.js). This file only sequences the routes:
//      tip link -> email -> contact form -> none. A tip link opens the creator's OWN tip page after a click; the Fold pays
//      nothing, prefills no amount, collects no payment details, and never builds a link (a published link is used as published).
//   1. NEVER guess or construct an address (no info@ / contact@ patterns). Only what the page — or the site's own
//      contact/about page — publishes (fold-chat-contact.js says what counts).
//   2. NO registry, WHOIS/RDAP, hosting-provider or IP-owner lookups. Only the creator's own site is read, only
//      because the person clicked: the page, then at most TIP_LIMITS.maxPages of its contact/about pages, then (routes 2-3)
//      at most TIP_LIMITS.maxExtra more (its feed, its humans.txt through the direct door only); sequential, 1.2 s apart,
//      same site only. Never security.txt.
//   3. Machinery mailboxes (abuse@, privacy@, legal@, noreply@ …) never qualify.
//   4. The address is used only to fill the draft on this machine. It is never logged, never put in a request, the
//      audit/outbound ledger or a trace; the card keeps it only on its own `contact`.
//   5. The app never sends mail and never opens anything without a click.
import { contactsFromHtml, isUsableEmail, hostBase, emailDomainOk } from "./fold-chat-contact.js";
import { routesInPage, parseFeed, authorFromFeed, humansOfText, tipStillValid, socialStillValid, websiteOf, SUPPORT } from "./fold-chat-support.js";

export const TIP_LIMITS = Object.freeze({ maxMailto: 1800, maxTitle: 100, maxPages: 2, pauseMs: SUPPORT.budget.pauseMs, maxExtra: SUPPORT.budget.extraFetchesRoutes2and3 });

/** The words the draft says (from the person who asked for the feature; nearly verbatim). */
export const DRAFT_LINE = "I enjoyed your content I was served through the community driven AI-agent The Fold. I would like to give you a monetary tip because I found it valuable. Do you have a way I can send this to you?";

/** What the surface says after a click. One place, so the wording is the same on every card and a test can pin it. */
export const TIP_SAY = Object.freeze({
  looking: (who) => `Looking for a way to reach ${who}…`,
  email: (address, where) => `Opened an email draft to ${address} (found ${where}). Nothing is sent until you send it.`,
  form: "No public email. Opened their contact page; your message is copied — paste it there.",
  formNoCopy: "No public email. Opened their contact page; copy your message below and paste it there.",
  none: "Couldn't find a public contact for this creator. The original page is linked above.",
  noneHere: "No way to tip them directly. Their own pages:",
  siteContact: " This is the site's contact, not the individual's.",
  // a direct tip page (route 1-3): the creator's OWN page, opened after the click; the Fold sends and takes nothing
  tip: (name, host, where) => `Opened the creator's ${name === "their own site" ? "own support page" : name + " page"} (${host}), found ${where}. The Fold sends nothing and takes nothing; you tip on their page.`,
  tipFound: (name, host, where) => `Found the creator's ${name === "their own site" ? "own support page" : name + " page"} (${host}), ${where}. Press the link below to open it. The Fold sends nothing and takes nothing.`,
  alsoEmail: " They also publish an email: “Or email them” opens a draft you send yourself.",
});
/** The words on the tip controls (one place, so a test can pin them). */
export const TIP_LABELS = Object.freeze({ open: (name, host) => `Open ${name === "their own site" ? "their support page" : name} (${host})`, emailAlt: "Or email them", also: (name, host) => `Also: ${name} (${host})` });

// Marketplaces and user-contributed platforms: the credited name is a contributor, and the site's address is the
// platform's, not theirs. Declared, short; the giver is the 2026-10-05 allrecipes check ("Hi ELIZABETHBH!").
const PLATFORMS = /(^|\.)(allrecipes\.com|food\.com|cookpad\.com|instructables\.com|reddit\.com|youtube\.com|pinterest\.com|etsy\.com|amazon\.com|ebay\.com|wikihow\.com|quora\.com)$/i;
/** Is the page on a platform whose contributors are credited by handle? */
export const isPlatformSite = (url) => { try { return PLATFORMS.test(new URL(String(url)).hostname.replace(/^www\./, "")); } catch { return false; } };
/** Is this credit a contributor's username (ALLCAPS handle, digits, no space) rather than a person's name? */
export const looksLikeHandle = (c) => { const t = cleanText(c); return !!t && (!/\s/.test(t) || /[0-9_]/.test(t) || (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t))); };

const ORG_WORD = /\b(team|staff|editors?|editorial|kitchen|bakery|co|inc|llc|ltd|gmbh|news|magazine|media|studio|studios|network|press|the|foods?|recipes?|blog|publishing|company|group|association)\b/i;
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…"; };
const cleanText = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/** "Hi <first name>!" only for a person the PAGE named; an organisation, a site name or nothing gives a plain "Hi!". */
export function firstNameOf(creator) {
  const c = cleanText(creator);
  if (!c || looksLikeHandle(c) || c.length > 60 || ORG_WORD.test(c) || /[0-9@/:.]/.test(c) || /['\u2019]s\b/.test(c)) return "";   // a possessive is a brand ("Sally's Baking Addiction")
  const parts = c.split(" ");
  if (parts.length > 4) return "";
  const first = parts[0].replace(/[,;]+$/, "");
  return /^\p{Lu}[\p{L}'’-]{0,24}$/u.test(first) ? first : "";
}

const httpUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x : null; } catch { return null; } };
// An address that goes into mailto: must be one plain address: no list, no header-smuggling punctuation.
const plainAddress = (a) => { const t = String(a ?? "").trim(); return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(t) && isUsableEmail(t) ? t : ""; };

/**
 * The draft. `to` is optional (a contact form has none). Returns { subject, body, mailto } — `mailto` is null without a
 * usable `to`. Percent-encoded; line breaks are %0D%0A (never raw); the whole URL is capped (titles are cut first,
 * then the link loses its query).
 */
export function tipDraft({ to = "", creator = "", title = "", url = "" } = {}) {   // a creator credited on a marketplace/UGC platform is a contributor: plain "Hi!"
  const addr = to ? plainAddress(to) : "";
  if (to && !addr) throw new Error("not a usable address");
  const page = httpUrl(url);
  const name = isPlatformSite(url) ? "" : firstNameOf(creator);
  const build = (t, link) => {
    const subject = t ? `A tip for "${t}"` : "A tip for your content";
    const lines = [`${name ? `Hi ${name}!` : "Hi!"} ${DRAFT_LINE}`, ""];
    if (t) lines.push(`“${t}”`);
    if (link) lines.push(link);
    if (t || link) lines.push("");
    lines.push("Thank you,", "");
    const body = lines.join("\n");
    const mailto = addr ? `mailto:${encodeURIComponent(addr).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body).replace(/%0A/g, "%0D%0A")}` : null;
    return { subject, body, mailto };
  };
  let t = clip(cleanText(title), TIP_LIMITS.maxTitle);
  let link = page ? page.href : "";
  let d = build(t, link);
  const tooLong = (x) => x.mailto && x.mailto.length > TIP_LIMITS.maxMailto;
  if (tooLong(d) && page) { link = page.origin + page.pathname; d = build(t, link); }
  while (tooLong(d) && t.length > 20) { t = clip(t, Math.max(20, Math.floor(t.length * 0.7))); d = build(t, link); }
  if (tooLong(d)) d = build("", link.length > 300 ? "" : link);
  return d;
}

const sameSite = (a, b) => { const x = hostBase(a), y = hostBase(b); return !!x && x === y; };
const viaWord = (where) => String(where || "").replace(/\bon the page\b/, "on their contact page");

// An address is accepted only if it is usable AND came from a place the page puts forward (see contactsFromHtml).
const PUBLISHED = /^(the page's structured data|a mailto link on|a protected email link on|written on|the site's feed|in their humans)/;
const acceptAt = (e, site) => !!e && isUsableEmail(e.address) && PUBLISHED.test(String(e.where || "")) && emailDomainOk(e.address, site);

/** What a stored/passed `contact` or `contacts` says, as the raw found shape { emails, tips, pages, forms, feeds }. A stored tip route is re-verified, never trusted. */
function asFound(source) {
  const site = source && source.url;
  const accept = (e) => acceptAt(e, site);
  const tipsOf = (list) => (list || []).filter((t) => tipStillValid(t, site));
  const socOf = (list) => (list || []).filter((x) => socialStillValid(x, site));
  const c = source && source.contacts;
  if (c && typeof c === "object") return { emails: (c.emails || []).filter(accept), tips: tipsOf(c.tips), socials: socOf(c.socials), pages: c.pages || [], forms: c.forms || [], feeds: c.feeds || [] };
  const k = source && source.contact;
  if (k && typeof k === "object") {
    const em = k.kind === "email" ? { address: k.address, where: k.where } : k.email;
    return { emails: em && accept({ address: em.address, where: em.where }) ? [{ address: String(em.address).toLowerCase(), where: em.where, rank: 1 }] : [], tips: tipsOf(k.tip ? [k.tip, ...(k.alternates || [])] : []), socials: socOf(k.socials), pages: k.pages || [], forms: k.kind === "form" && k.url ? [k.url] : [], feeds: k.feeds || [], ...(k.name ? { name: k.name } : {}) };
  }
  return null;
}

/**
 * How to reach a creator, from their own site only. Route order: tip link -> email -> contact form -> (social profiles, website).
 *   source: { url, contacts?, contact? }   contacts/contact: what the page offered when it was read
 *   deps:   { readText(url, {direct?}) -> { ok, contacts? }, pause(ms), feed?, humans? }   injected; readText is the app's page reader.
 *           feed (default true) reads the page's advertised same-site feed (route 2); humans (default false; the app turns it on)
 *           reads /humans.txt through the direct door only (route 3). Together at most TIP_LIMITS.maxExtra loads.
 * Returns { kind:'tip', tip, alternates?, email?, ... } | { kind:'email', address, where, ... } | { kind:'form', url, where, ... } |
 *         { kind:'none', ... }, each with `tried` (page URLs loaded for this click, never an address) and, when found,
 *         `socials` (the creator's own profiles, never visited) and `website` (their own origin), `name` (from the feed).
 * The first route that yields a tip or an email stops the search (politeness). A card that already holds what the page
 * offered loads nothing.
 */
export async function findContact(source, { readText, pause = (ms) => new Promise((r) => setTimeout(r, ms)), maxPages = TIP_LIMITS.maxPages, pauseMs = TIP_LIMITS.pauseMs, maxExtra = TIP_LIMITS.maxExtra, feed: useFeed = true, humans: useHumans = false } = {}) {
  const url = String(source && source.url || "");
  const tried = [];
  const emails = [], forms = [], tips = [], socials = []; let pages = [], feeds = []; let name = "";
  const platformSite = isPlatformSite(url);
  const take = (f, contactPage) => {
    if (!f) return;
    for (const e of f.emails || []) if (acceptAt(e, url) && !emails.some((x) => x.address === e.address)) emails.push({ address: String(e.address).toLowerCase(), where: contactPage ? viaWord(e.where) : e.where, rank: e.rank ?? 1 });
    if (!platformSite) {
      for (const t of f.tips || []) if (tipStillValid(t, url) && !tips.some((x) => x.url === t.url)) tips.push({ ...t, where: contactPage ? viaWord(t.where) : t.where });
      for (const x of f.socials || []) if (socialStillValid(x, url) && !socials.some((y) => y.url === x.url) && socials.length < SUPPORT.social.cap) socials.push(x);
    }
    for (const u of f.forms || []) if (httpUrl(u) && sameSite(u, url) && !forms.includes(u)) forms.push(u);
    for (const u of f.pages || []) if (httpUrl(u) && sameSite(u, url) && !pages.includes(u) && u.split(/[?#]/)[0] !== url.split(/[?#]/)[0]) pages.push(u);
    for (const u of f.feeds || []) if (httpUrl(u) && sameSite(u, url) && !feeds.includes(u)) feeds.push(u);
    if (f.name && !name) name = String(f.name);
  };
  const website = platformSite ? null : websiteOf(url);
  const extras = () => ({ ...(name ? { name } : {}), ...(socials.length ? { socials: socials.slice() } : {}), ...(website ? { website } : {}), tried });
  const bestEmail = () => { const s = emails.slice().sort((a, b) => a.rank - b.rank); return s[0] || null; };
  const best = () => {
    const e = bestEmail();
    if (tips.length) return { kind: "tip", tip: tips[0], ...(tips.length > 1 ? { alternates: tips.slice(1, 3) } : {}), ...(e ? { email: { address: e.address, where: e.where } } : {}), ...extras() };
    if (e) return { kind: "email", address: e.address, where: e.where, ...extras() };
    return null;
  };
  let loads = 0;
  const load = async (u, opts) => {
    if (loads++) await pause(pauseMs);       // polite: one at a time, a pause between
    tried.push(u);
    try { const rd = opts ? await readText(u, opts) : await readText(u); return rd && rd.ok ? rd : null; } catch { return null; }
  };

  // (a) what was captured when the page was read
  const known = asFound(source);
  take(known, false);
  if (known && known.name) name = known.name;
  if (best()) return best();
  // (b) nothing captured at all: read the page itself once (the person clicked); then the site's own contact/about pages
  if (!known && httpUrl(url)) {
    const rd = await load(url);
    if (rd && rd.contacts) take(rd.contacts, false);
    if (best()) return best();
  }
  let n = 0;
  for (const u of pages.slice()) {
    if (n >= maxPages) break;
    if (tried.includes(u)) continue;
    n++;
    const rd = await load(u);
    if (rd && rd.contacts) take(rd.contacts, true);
    if (best()) return best();
  }
  // routes 2-3, at most `maxExtra` loads together: the advertised feed (a name, maybe an address), then humans.txt (direct door only)
  let extra = 0;
  if (useFeed && !platformSite && feeds[0] && extra < maxExtra) {
    extra++;
    const rd = await load(feeds[0]);
    const a = rd && rd.contacts && rd.contacts.feed ? authorFromFeed(rd.contacts.feed, url, url) : null;
    if (a) { if (a.name && !name) name = a.name; if (a.email) take({ emails: [{ address: a.email, where: a.emailFrom, rank: 1 }] }, false); }
    if (best()) return best();
  }
  if (useHumans && !platformSite && httpUrl(url) && extra < maxExtra) {
    extra++;
    const rd = await load(new URL(url).origin + "/humans.txt", { direct: true });
    const h = rd && rd.contacts && rd.contacts.humans;
    if (h) { if (h.name && !name) name = h.name; take({ tips: h.tips, emails: (h.emails || []).map((a) => ({ address: a, where: "in their humans.txt", rank: 1 })) }, false); }
    if (best()) return best();
  }
  // (c) a message form of their own, (d) nothing (the person is still given their own pages)
  if (forms.length) return { kind: "form", url: forms[0], where: "the site's contact form", ...extras() };
  return { kind: "none", ...extras() };
}

/** The part of a found contact the card keeps on its snip: kind, where, and the address only here (never elsewhere). */
export function contactOfPassage(p) {
  const c = p && p.contacts;
  if (!c || typeof c !== "object") return null;
  const site = p.url || p.source;
  const e = (c.emails || []).find((x) => acceptAt(x, site));
  const pages = (c.pages || []).filter((u) => httpUrl(u) && sameSite(u, site)).slice(0, 3);
  const feeds = (c.feeds || []).filter((u) => httpUrl(u) && sameSite(u, site)).slice(0, 1);
  const tips = (c.tips || []).filter((t) => tipStillValid(t, site)).slice(0, 3);
  const socs = (c.socials || []).filter((x) => socialStillValid(x, site)).slice(0, SUPPORT.social.cap);
  const more = { ...(pages.length ? { pages } : {}), ...(feeds.length ? { feeds } : {}), ...(socs.length ? { socials: socs } : {}) };
  if (tips.length) return { kind: "tip", tip: tips[0], ...(tips.length > 1 ? { alternates: tips.slice(1) } : {}), ...(e ? { email: { address: String(e.address).toLowerCase(), where: e.where } } : {}), ...more };
  if (e) return { kind: "email", address: String(e.address).toLowerCase(), where: e.where, ...more };
  const f = (c.forms || [])[0];
  if (f && httpUrl(f)) return { kind: "form", url: f, where: "the site's contact form", ...more };
  if (pages.length) return { kind: "pages", where: "the site's contact page", ...more };
  if (feeds.length) return { kind: "pages", where: "the site's feed", ...more };
  return socs.length ? { kind: "social", where: "the page's profile links", ...more } : null;
}

/** Read-time extraction, shared by fold-chat-web.js: keep it only when the page offered something. Also reads a feed or a humans.txt when `raw` is one. */
export function contactsOfRaw(raw, url) {
  try {
    if (/\/humans\.txt$/i.test(new URL(String(url)).pathname)) { const h = humansOfText(raw, url); return h ? { humans: h } : null; }
    const feed = parseFeed(raw);
    if (feed) return { feed };
    const r = routesInPage(raw, url, { skipTips: isPlatformSite(url) });
    const c = { ...r.found, tips: r.findings.filter((f) => ["tip-link", "structured-donate", "rel-payment"].includes(f.kind)), socials: r.socials, feeds: isPlatformSite(url) ? [] : r.feeds };
    return c.emails.length || c.forms.length || c.pages.length || c.tips.length || c.socials.length || c.feeds.length ? c : null;
  } catch { return null; }
}
