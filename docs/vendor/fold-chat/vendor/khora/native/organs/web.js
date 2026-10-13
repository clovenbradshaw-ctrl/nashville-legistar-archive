// web.js — the web organ: the pure half of search and page ingestion.
//
// This module OWNS NO NETWORK. Everything here is a function from bytes the
// server already fetched (or stored) to structure: readable text out of a
// page's HTML, results out of a search endpoint's HTML, a history out of an
// append-only jsonl. The fetching itself — the one sanctioned egress this
// repo has (POLICIES P13, amending P1) — lives in explore-server.mjs, where
// it is recorded; keeping this half pure is what makes it testable offline.
//
// WHAT THIS FILE NEVER DOES: fetch; write; guess silently (a bot-blocked
// search page is a typed refusal, never an empty result list); interpret
// content (extraction strips container chrome per READING-POLICY P5.3 — a
// layout judgement, not a reading).

// ── declared numbers, each with its giver ───────────────────────────────────
// Givers: this file, engineering starting points (P9 — budgets are named,
// not tuned). None of these was chosen by checking an outcome.
export const WEB_FETCH_MAX_BYTES = 8_000_000; // one page, not a crawl; a bound on a response, refusal is typed
export const WEB_FETCH_TIMEOUT_MS = 20_000; // an interactive wait, not a batch one
export const WEB_SEARCH_MAX_RESULTS = 12; // a page of results; total found is reported next to shown
export const WEB_ARCHIVE_TIMEOUT_MS = 120_000; // archive.org Save Page Now is slow by design; it runs deferred
// The organ identifies itself honestly — it is a reader, not a browser.
export const WEB_UA = "the-fold-explore/0.1 (local research instrument; one page per explicit request)";

// ── url hygiene ─────────────────────────────────────────────────────────────
/**
 * The omnibox's judgement, shared with the server: http(s) only, loopback
 * refused (the web organ is for the web — local files already have the
 * tree). Bare domains get https. Returns a normalized URL string or null.
 */
export function normalizeUrl(input) {
  const s = String(input ?? "").trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (/^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/i.test(u.hostname)) return null;
  if (!u.hostname.includes(".")) return null;
  return u.href;
}

/**
 * Explicit http(s) URLs named in arbitrary prose — the referent-level fact
 * that a message already points at an exact address, distinct from every
 * OTHER word in the same message a search would otherwise have to guess
 * from (measured live, 2026-08-18: "write an essay... drawn from
 * https://eolab.substack.com/feed" reached the preflight SEARCH path,
 * which reduces the whole sentence to keyword terms and lost the named
 * source to generic pages sharing "fold" and "essay" on DuckDuckGo's own
 * ranking — the address was right there and was never fetched). Only an
 * EXPLICIT scheme counts: reading a bare domain out of prose ("check
 * eolab.substack.com") would need the same kind of guess this function
 * exists to avoid, so a scheme is required, the same discipline
 * `normalizeUrl`'s bare-domain leniency is for the DEDICATED omnibox
 * field, not for text at large. Each candidate is re-validated by
 * `normalizeUrl` (reused, never re-derived), so a URL named in chat is
 * held to the exact same http(s)-only, non-loopback rule the omnibox and
 * the server already enforce.
 */
export function extractUrls(text) {
  const s = String(text ?? "");
  const found = [];
  const re = /https?:\/\/[^\s<>"')\]}]+/gi;
  let m;
  while ((m = re.exec(s))) {
    // Trailing punctuation almost never belongs to the address itself — a
    // sentence ending in ".", or a URL closing a parenthetical.
    const trimmed = m[0].replace(/[.,;:!?)\]}'"]+$/, "");
    const url = normalizeUrl(trimmed);
    if (url && !found.includes(url)) found.push(url);
  }
  return found;
}

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// ── entities ────────────────────────────────────────────────────────────────
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", deg: "°", middot: "·", times: "×", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß", ntilde: "ñ" };
export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

// ── readable extraction ─────────────────────────────────────────────────────
// P5.3's move, applied to the web's container: scripts, styles, and the
// page's own chrome (nav / header / footer / aside / form) are boilerplate
// around the material, stripped BEFORE the text face exists — so retrieval
// and folding never land in a cookie banner. This is a layout judgement on
// tags, not a reading of content; regexes over nested markup are imperfect,
// so container removal repeats until it stops changing.
const DROP_WHOLE = ["script", "style", "noscript", "template", "svg", "iframe", "object", "embed", "select", "canvas"];
const DROP_CONTAINER = ["nav", "header", "footer", "aside", "form", "dialog"];
// WAI-ARIA landmark roles that mark a region as navigation furniture
// regardless of which tag carries it (rashomon-contrast-RESULTS.md's "furniture
// wall on the cast": MediaWiki's own navbox is `<div role="navigation"
// class="navbox">`, never a `<nav>` element, so DROP_CONTAINER's tag-name list
// never touched it — a Works-by-Leo-Tolstoy navbox's link titles and a
// Napoleonic-Wars navbox's battle names rode straight through as body text
// and the cast admitted them as referent candidates.
//
// THIS IS NOT A DELETION. `commitments.js`'s own header names the risk of
// deciding at EXTRACTION that text is furniture: "silently and irreversibly
// — the note never exists, so a wrong call cannot be found or taken back,"
// and S51 (READING-SPEC.md) measured the concrete danger — a navbox row and
// a line of screenplay dialogue are the same shape, and only page scope
// (or, here, a real DOM signal) tells them apart. So `text` below carries
// EVERY byte exactly as before (nothing here ever removes anything from
// it — "extraction is not a summary" holds unchanged); this only computes
// which byte RANGES of that same text originated inside a `role=navigation`
// region, so a caller who wants to keep the referent-admission wall
// reversible and auditable can blank exactly those ranges (`blankSpans`,
// below) as an OPT-IN `blankFurniture` organ — the identical seam
// `blankLabelRows`/`chunk.blanked` already use — rather than the byte
// stream never having contained them in the first place.
// 2026-09-26: "note" added, grounded in a real live fetch of a genuine
// Wikipedia page (en.wikipedia.org/wiki/Cumberland_River) this same session
// — its hatnote's own container is `<div role="note" class="hatnote
// navigation-not-searchable">For other uses, see …</div>`, a distinct ARIA
// landmark from "navigation" that this list did not yet cover. role="note"
// is the standard WAI-ARIA landmark for content "parenthetic or ancillary to
// the main content" — the same non-body-text furniture "navigation" already
// exists here to catch, not a new invented category.
const DROP_ROLES = ["navigation", "note"];

// Attribute values may legally contain ">" (Wikipedia ships JSON inside
// data-mw='{…}'), so every tag pattern here walks quoted values instead of
// stopping at the first ">" — measured on the War and Peace fixture, where
// the naive pattern leaked half an attribute into the text face. Exported
// because the lesson is one lesson: primary.js walks the same markup for
// citations and must not re-learn it with a second, naive pattern.
export const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;

/**
 * Locates every element carrying one of `roles` in its `role="…"` attribute,
 * whatever tag it is — a `<nav>`-shaped FIND for markup that declares the
 * same ARIA landmark on a `<div>`/`<table>`/anything else — and returns each
 * one's raw HTML fragment. `html` is returned untouched: this is a survey,
 * never a removal. Unlike `dropTag` (safe with a bare non-greedy match
 * because none of DROP_CONTAINER's tags routinely nest inside themselves), a
 * role-carrying `<div>` almost always contains further `<div>`s — real
 * Wikipedia navboxes are two or three deep — so this tracks same-tag nesting
 * depth from the matched open tag to its true balancing close, rather than
 * the first same-tag close encountered. An element left unclosed by
 * truncated markup is read to the end of the string.
 */
function extractRoleRegions(html, roles) {
  const found = [];
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b${ATTRS}>`, "g");
  let m;
  while ((m = openRe.exec(html))) {
    const attrs = html.slice(m.index, openRe.lastIndex);
    const roleMatch = attrs.match(/\brole\s*=\s*["']([^"']+)["']/i);
    if (!roleMatch || !roles.includes(roleMatch[1].trim().toLowerCase())) continue;
    const tag = m[1].toLowerCase();
    const tokenRe = new RegExp(`<(/?)${tag}\\b${ATTRS}(/?)>`, "gi");
    tokenRe.lastIndex = openRe.lastIndex;
    let depth = 1;
    let end = html.length;
    let tm;
    while ((tm = tokenRe.exec(html))) {
      if (tm[2] === "/") continue; // this tag's own self-closing form, no nesting change
      if (tm[1] === "/") {
        depth -= 1;
        if (depth === 0) { end = tokenRe.lastIndex; break; }
      } else {
        depth += 1;
      }
    }
    found.push(html.slice(m.index, end));
    openRe.lastIndex = end; // never re-descend into a region already taken whole
  }
  return found;
}

/**
 * The shared tag-to-text transform `extractReadable` runs on the whole
 * document, factored out so it can ALSO run, unmodified, on one isolated
 * fragment (a role="navigation" region's own raw HTML) — the only way to
 * learn what that region's text looks like once rendered without touching
 * the real pipeline's output for the whole page. Same steps, same order:
 * block structure to line structure, tag strip, entity decode, whitespace
 * collapse.
 */
function htmlFragmentToText(h) {
  h = h
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(new RegExp(`<li\\b${ATTRS}>`, "gi"), "\n- ")
    .replace(/<\/(p|div|section|article|main|li|ul|ol|table|tr|blockquote|figure|figcaption|pre|dd|dt)\s*>/gi, "\n")
    .replace(new RegExp(`<(p|div|section|article|main|blockquote|figure|pre)\\b${ATTRS}>`, "gi"), "\n")
    .replace(/<\/(h[1-6])\s*>/gi, "\n\n")
    .replace(new RegExp(`<(h[1-6])\\b${ATTRS}>`, "gi"), "\n\n")
    .replace(/<\/t[dh]\s*>/gi, "\t");
  h = h.replace(new RegExp(`</?[a-zA-Z!]${ATTRS}>`, "g"), " ");
  h = decodeEntities(h);
  return h
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * `blankSpans(text, spans)` — the length-preserving blank `chunk.blanked`
 * already expects (S51's own `blankLabelRows` shape): every character
 * inside a `{start,end}` range becomes a space, every newline inside it
 * stays a newline (so line structure — and every OTHER address into this
 * same text — survives untouched), everything outside every range is
 * returned byte-for-byte. Ranges may be unsorted or overlapping; both are
 * handled. This is the reversible half of the furniture wall: nothing is
 * ever removed from `text` itself, only masked for a caller that opts in.
 */
export function blankSpans(text, spans) {
  const s = String(text ?? "");
  const mask = new Uint8Array(s.length);
  for (const { start, end } of spans ?? []) {
    const a = Math.max(0, Number(start) || 0);
    const b = Math.min(s.length, Number(end) || 0);
    for (let i = a; i < b; i += 1) mask[i] = 1;
  }
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    out += mask[i] && ch !== "\n" ? " " : ch;
  }
  return out;
}

function dropTag(html, tag, { dropUnclosedTail = false } = {}) {
  const re = new RegExp(`<${tag}\\b${ATTRS}>[\\s\\S]*?</${tag}\\s*>`, "gi");
  let prev;
  do {
    prev = html;
    html = html.replace(re, " ");
  } while (html !== prev);
  // For script/style an unclosed opener (truncated page) takes the rest with
  // it — half a script is not text. A container left unclosed by sloppy
  // markup keeps its tail: losing real content is the worse error there.
  return dropUnclosedTail ? html.replace(new RegExp(`<${tag}\\b${ATTRS}>[\\s\\S]*$`, "i"), " ") : html;
}

/**
 * html (string) -> { title, description, text, lang, headings, navSpans }
 * text keeps paragraph structure as blank lines and list items as "- " lines;
 * everything else about layout is dropped. Nothing is summarized here —
 * this is the WHOLE readable content; salience is the fold's job, later.
 *
 * `navSpans` names, without removing anything, which `{start,end}` ranges of
 * THIS SAME `text` came from a `role="navigation"` region (see DROP_ROLES's
 * own comment above for why this is a survey rather than another entry in
 * DROP_CONTAINER). A caller wanting the referent-admission wall opts in with
 * `blankSpans(text, out.navSpans)` as a `blankFurniture` organ — the reading
 * itself, and everything downstream of it that never asked for the wall,
 * see every byte exactly as before.
 */
export function extractReadable(html) {
  let h = String(html).replace(/<!--[\s\S]*?-->/g, " ");
  const title = decodeEntities((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const description = decodeEntities(
    h.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    ?? h.match(/<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1]
    ?? "",
  ).trim();
  const lang = h.match(/<html\s[^>]*lang=["']?([a-zA-Z-]+)/i)?.[1] ?? null;

  h = h.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i, " ");
  for (const t of DROP_WHOLE) h = dropTag(h, t, { dropUnclosedTail: true });
  for (const t of DROP_CONTAINER) h = dropTag(h, t);

  // Surveyed, not removed — h is unchanged past this line. Each fragment's
  // own rendering is computed through the identical transform `text` gets
  // below, so it can be found in `text` by exact substring rather than by
  // re-deriving positions through the whole pipeline.
  const navFragments = extractRoleRegions(h, DROP_ROLES).map(htmlFragmentToText).filter(Boolean);

  // THE SOURCE'S OWN STRUCTURE = the stage names. Headings are captured
  // BEFORE they are stripped to blank lines — a hunted source's headings are
  // the material's own staging, the one thing a reader cannot invent.
  const headings = [];
  {
    // The close is `</\1>`, not `</h\1>`: the group already holds the "h"
    // ("h2"), so the old pattern closed on `</hh2>` and matched nothing —
    // measured 2026-09-22 on a live Wikipedia page with nine <h2>s: zero
    // headings, on every source the shape stage ever read.
    const hRe = new RegExp(`<(h[1-4])\\b${ATTRS}>([\\s\\S]*?)<\\/\\1>`, "gi");
    let hm;
    while ((hm = hRe.exec(h))) {
      const txt = decodeEntities(hm[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (txt && txt.length >= 2) headings.push({ level: Number(hm[1][1]), text: txt });
    }
  }

  const text = htmlFragmentToText(h);

  // Locate each surveyed fragment's rendering inside the real text, in
  // order, each search starting after the previous find so two identical
  // navboxes (a page can repeat one) each get their own span rather than
  // both resolving to the first occurrence.
  const navSpans = [];
  let from = 0;
  for (const frag of navFragments) {
    const at = text.indexOf(frag, from);
    if (at === -1) continue; // a fragment that collapsed to nothing findable is not a span
    navSpans.push({ start: at, end: at + frag.length });
    from = at + frag.length;
  }

  return { title, description, text, lang, headings, navSpans };
}

/**
 * Recognizes an RSS 2.0 or Atom feed by its ROOT ELEMENT — magic first, the
 * same discipline measure.js::sniffContainer already uses for a fetched
 * file's shape: the bytes' own declared structure decides, never a text
 * heuristic — and returns it as N separate items, or null for anything
 * else. Requirement, from a live measurement (2026-08-18): fetched as
 * MATERIAL and run through `extractReadable` (built for one article's
 * markup, with no notion of `<item>`/`<entry>`), a feed's many independent
 * posts flattened into one undifferentiated blob — the channel's own
 * title ran straight into the first item's body with no boundary
 * (`extractReadable`'s generic tag-strip has no vocabulary for feed-only
 * elements), and gemma2:2b answered as though the whole thing were a
 * single essay. A feed is not an article with unusual formatting; it is a
 * LIST of them, and the extraction must say so before anything reads the
 * content — the same P5.3 principle (strip container boilerplate, keep
 * the content) applied to a container shape that isn't a single document
 * at all.
 */
export function extractFeed(xml) {
  const s = String(xml ?? "");
  const isRss = /<rss[\s>]/i.test(s) && /<channel[\s>]/i.test(s);
  const isAtom = /<feed[\s>]/i.test(s) && /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(s);
  if (!isRss && !isAtom) return null;

  const firstTag = (block, name) => {
    const m = block.match(new RegExp(`<${name}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${name}\\s*>`, "i"));
    return decodeEntities((m?.[1] ?? m?.[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
  };
  const channelBlock = s.match(/<channel[^>]*>([\s\S]*?)<\/channel\s*>/i)?.[1] ?? s;
  const title = firstTag(channelBlock, "title");
  const description = firstTag(channelBlock, isAtom ? "subtitle" : "description");

  const itemTag = isAtom ? "entry" : "item";
  const items = [];
  const re = new RegExp(`<${itemTag}\\b[^>]*>([\\s\\S]*?)<\\/${itemTag}\\s*>`, "gi");
  let m;
  while ((m = re.exec(s))) {
    const block = m[1];
    const link = isAtom
      ? decodeEntities(block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? "")
      : firstTag(block, "link");
    items.push({
      title: firstTag(block, "title"),
      link,
      pubDate: firstTag(block, isAtom ? "published" : "pubDate") || firstTag(block, "updated"),
      // The FULLEST body available, preferred over a teaser: RSS commonly
      // carries both a short <description> and the real post in
      // <content:encoded> (measured live on the eolab feed — description
      // alone was a 1-2 sentence teaser, content:encoded the actual
      // article). Atom's <content> is the equivalent full-body element;
      // <summary> is its own teaser, tried last.
      summary:
        firstTag(block, "content:encoded") ||
        firstTag(block, "content") ||
        firstTag(block, "description") ||
        firstTag(block, "summary"),
    });
  }
  return { title, description, items };
}

/**
 * A feed's readable text face — every item demarcated and numbered, never
 * flattened. The number is a real, quotable address ("item 3 of 12"), and
 * each item carries its own title/date/link so a reader (human or model)
 * can tell which post said what without opening it — the discrimination
 * `extractReadable` alone cannot make for feed XML. This is the feed's own
 * STRUCTURE (its items, their own boundaries) — the same station a
 * document's discovered headings hold; WHAT KIND OF THING the whole file
 * is (a feed, at all) is a separate, general concern, carried by every
 * chunk as `identity` rather than baked into this text — see
 * `identifyMaterial` (source.js) and its own header for why: a per-chunk
 * identity travels with whichever passage retrieval actually picks,
 * without touching this text's own byte-addressable content.
 */
export function feedText({ title, description, items }) {
  const name = title || "untitled";
  const header = `FEED: ${name}${description ? ` — ${description}` : ""} (${items.length} item${items.length === 1 ? "" : "s"})`;
  const body = items
    .map((it, i) => {
      const head = `--- item ${i + 1} of ${items.length}: ${it.title || "untitled"}${it.pubDate ? ` (${it.pubDate})` : ""} ---`;
      return [head, it.link, it.summary].filter(Boolean).join("\n");
    })
    .join("\n\n");
  return [header, body].filter(Boolean).join("\n\n");
}

/**
 * Some hosts answer a page-shaped bot challenge instead of the page
 * (measured live 2026-08-16: britannica.com served Cloudflare's "Just a
 * moment..." — 5.7KB, zero readable chars). The bytes are still saved and
 * the entry still tells the truth; this names the situation so the view
 * can say "the host declined" instead of presenting an empty page as the
 * article. A marker, not a deletion — never a reason to drop the entry.
 */
export function looksLikeChallenge({ title, textChars }) {
  return (textChars ?? 0) < 200 && /just a moment|attention required|access denied|are you a (?:robot|human)|enable javascript and cookies|verify you are|checking your browser|captcha/i.test(String(title ?? ""));
}

/**
 * A page whose readable face is a JS-required / error shell is NOT content.
 * Measured live 2026-09-11: a site answered with "A required part of this
 * site couldn't load… disable any ad blockers" — 209 readable chars of
 * error shell, zero article. `extractReadable` strips the markup faithfully;
 * what came out was the shell's own apology. This names the situation so a
 * caller (Gore, the web searcher) can skip the page and fetch the next
 * result instead of quoting "please disable your ad blocker" as source
 * material. A marker on the CONTENT, not the title: some shells keep a
 * normal title while the body apologizes.
 */
export function looksLikeShell(text = "") {
  const t = String(text ?? "");
  if (t.length > 1500) return false; // a real page has real content
  return /(?:couldn'?t\s+load|required part of this site|disable (?:any )?ad blockers|enable javascript|checking your browser|content not available|something went wrong|an error occurred|enable js|browser settings)/i.test(t);
}

// ── search-result parsing ───────────────────────────────────────────────────
// DuckDuckGo's two no-key HTML faces (html.duckduckgo.com/html and
// lite.duckduckgo.com/lite). Both wrap result links in a redirect
// (`/l/?uddg=<encoded>`), unwrapped here so history holds real addresses.
// The endpoint also serves a bot-challenge page to addresses it distrusts —
// that page parses to ZERO results, which must surface as a typed refusal,
// never as "the web had nothing" (P4: gaps are results).
export function unwrapDdgHref(href) {
  const h = decodeEntities(String(href));
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  if (/^\/\//.test(h)) return `https:${h}`;
  return /^https?:\/\//i.test(h) ? h : null;
}

export function parseSearchResults(html) {
  const h = String(html);
  if (/anomaly\.js|anomaly-modal|cc=botnet/i.test(h)) {
    return { blocked: true, results: [] };
  }
  const results = [];
  const seen = new Set();
  const push = (href, title, snippet) => {
    const url = unwrapDdgHref(href);
    if (!url || /duckduckgo\.com\/(y\.js|html|lite)/.test(url)) return; // ads and self-links
    if (seen.has(url)) return;
    seen.add(url);
    results.push({
      title: decodeEntities(title.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
      url,
      snippet: decodeEntities(snippet.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
    });
  };

  // the /html face: anchors classed result__a, each paired with the snippet
  // that appears before the NEXT result anchor (two passes — a lazy scan
  // followed by an optional group would silently never look forward).
  const anchors = [...h.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  anchors.forEach((m, i) => {
    const upTo = anchors[i + 1]?.index ?? h.length;
    const between = h.slice(m.index + m[0].length, upTo);
    const snip = between.match(/<(?:a|td|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);
    push(m[1], m[2], snip?.[1] ?? "");
  });

  // the /lite face: anchors classed result-link, snippets in result-snippet cells
  if (!results.length) {
    const links = [...h.matchAll(/<a[^>]*href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>|<a[^>]*class=['"]result-link['"][^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const snips = [...h.matchAll(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi)];
    links.forEach((m, i) => push(m[1] ?? m[3], m[2] ?? m[4] ?? "", snips[i]?.[1] ?? ""));
  }
  // Zero results on a page that is not the endpoint's page at all (a proxy
  // error body, a captive portal) is a FAILED search, not an empty one —
  // measured live 2026-08-16: an intermediary's 200 "upstream connect error"
  // text would otherwise have shipped as "the web had nothing".
  if (!results.length && !/duckduckgo/i.test(h)) {
    return { blocked: false, offEndpoint: true, results: [] };
  }
  return { blocked: false, results };
}

// ── the history fold ────────────────────────────────────────────────────────
// web/history.jsonl is append-only IN OPERATION (a fetch appends its entry;
// a late-landing archive.org result appends a patch line carrying the same
// id) and clearable BY DECISION — that pairing is the point: the store the
// user may empty is a different file from the record the constitution says
// no one empties (record/explore-record.jsonl, where every fetch and every
// clear stays written). The current history is a fold over the lines, same
// shape as P3's plan fold: later lines with a known id merge onto earlier
// ones; unparseable lines are counted, never silently skipped.
export function foldWebHistory(jsonl) {
  const byId = new Map();
  let skipped = 0;
  for (const line of String(jsonl ?? "").split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (!obj || typeof obj.id !== "string") {
      skipped++;
      continue;
    }
    const prev = byId.get(obj.id);
    byId.set(obj.id, prev ? { ...prev, ...obj } : obj);
  }
  const entries = [...byId.values()].sort((a, b) => String(b.retrievedAt ?? "").localeCompare(String(a.retrievedAt ?? "")));
  return { entries, skipped };
}

// ── forgetting the uncited (added 2026-09-09) ───────────────────────────────
// User direction, in three steps: don't keep a fetched page's full content
// once it turns out not to matter; "if it doesn't get cited, it's not
// relevant"; and — because citation is decided by a LATER turn, possibly in
// a different conversation, and the saved text is content-addressed and so
// may be shared across every entry that ever names the same sha256 —
// "let's have it forget over time" rather than compact the instant one turn
// doesn't cite it. This is READING-POLICY P1's own law ("activation decays,
// identity does not") applied to fetched material instead of conversational
// turns: a page nobody has cited after a while is not deleted (the history
// LINE stays, append-only, forever — P13's own rule) — only its full SAVED
// TEXT is replaced with the mechanical fold `fetchAndKeep` already computes
// on every fetch (foldExtract's own coverage summary, never a paraphrase),
// so what remains is the page's own shape rather than its every byte.
//
// A page a person or a turn HAS cited never decays, at any age — `cited`
// rides as an ordinary patch line (`{id, cited: true, citedAt}`), the exact
// shape `archive`'s own late-landing patch already uses, folded by the same
// `foldWebHistory` above with no change to it. And a page already condensed
// stays condensed; this is idempotent, never re-summarizing what nothing
// referenced the last time either.
export const WEB_FORGET_AFTER_MS = 24 * 60 * 60 * 1000; // one day — a first, disclosed starting point (P9), not derived from a measurement; easy to widen once real usage says otherwise

/**
 * Which folded history entries are due to have their full text replaced by
 * their own mechanical fold: never cited, never already condensed, carrying
 * a fold to condense TO (a page with no text face — a binary download — has
 * nothing to shrink and is left alone), and older than `forgetAfterMs`. Pure
 * and time-injected (the `now`/cast.js pattern) so it is deterministic to
 * test — the caller supplies the wall clock, this never reads one itself.
 */
export function dueToForget(entries, { now, forgetAfterMs = WEB_FORGET_AFTER_MS } = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return [];
  return (entries ?? []).filter((e) => {
    if (!e || e.cited || e.condensed || !e.textPath || !e.fold || e.fold.gap) return false;
    const at = Date.parse(e.retrievedAt ?? "");
    return Number.isFinite(at) && now.getTime() - at >= forgetAfterMs;
  });
}

/**
 * The set of saved-file paths (raw and text) still needed after removing or
 * condensing `victims` from `entries` — the SAME reference-counting rule
 * `/api/web/clear` already applies (saved content is content-addressed and
 * may be shared between visits; a file named by any entry NOT in `victims`,
 * or by a victim's own `cited`/kept sibling, is never touched), pulled out
 * here so clearing and forgetting share one implementation rather than two
 * that could drift.
 */
export function filesStillNeeded(entries, victims = []) {
  const victimIds = new Set((victims ?? []).map((v) => v.id));
  const kept = (entries ?? []).filter((e) => !victimIds.has(e?.id));
  return new Set(kept.flatMap((e) => [e.rawPath, e.textPath].filter(Boolean)));
}

/**
 * The condensed text face's own content — plain lines, verbatim from the
 * fold (never re-rendered prose), each with its own character address, so
 * a citation address computed against the full text still resolves to
 * REAL bytes of the page rather than 404ing against a file that shrank out
 * from under it. Disclosed at the top: what this is, and how much was kept.
 */
export function renderCondensedFace(fold, { url } = {}) {
  const lines = fold?.lines ?? [];
  const header = `[condensed — the full page was not cited and has aged out; this is its own mechanical coverage fold, ${fold?.kept ?? 0} of ${fold?.of ?? 0} sentence(s), never a paraphrase${url ? ` — ${url}` : ""}]`;
  return [header, "", ...lines.map((l) => l.text)].join("\n");
}

// ── archive.org ─────────────────────────────────────────────────────────────
/**
 * The Wayback Machine's Save Page Now answers a GET of /save/<url> with the
 * snapshot's address in Content-Location (sometimes only as the final
 * redirect target). Given the response's pieces, name the stable URL or null.
 */
export function archiveUrlFrom({ contentLocation, finalUrl }) {
  const cl = contentLocation ?? "";
  if (/^\/web\/\d+/.test(cl)) return `https://web.archive.org${cl}`;
  if (/^https?:\/\/web\.archive\.org\/web\/\d+/.test(cl)) return cl;
  if (/^https?:\/\/web\.archive\.org\/web\/\d+/.test(finalUrl ?? "")) return finalUrl;
  return null;
}

/**
 * The static URL for a saved page face. History entries carry paths in the
 * FILE API's space (relative to the browse root, e.g. "the-fold/web/pages/
 * ab12….txt") because Explore's openSource speaks that space. The static
 * server's URL space is rooted one level lower, at this directory — so a
 * client that fetches `${base}/${textPath}` gets the 404 body, and judging
 * a claim against the literal text "not found" is a silent wrong verdict
 * (measured live 2026-08-17: every proof came back web-uncorroborated).
 * The pages directory is flat and content-addressed, so the basename alone
 * names the file in the static space.
 */
export function pageFaceUrl(base, storedPath) {
  const name = String(storedPath ?? "").split("/").pop();
  return name ? `${base}/web/pages/${name}` : null;
}

/** The file face a saved page gets, from its content-type. */
export function extForContentType(ct) {
  const t = String(ct ?? "").toLowerCase();
  if (t.includes("html")) return ".html";
  if (t.includes("json")) return ".json";
  if (t.includes("pdf")) return ".pdf";
  if (t.includes("xml")) return ".xml";
  if (t.startsWith("text/csv")) return ".csv";
  if (t.startsWith("text/markdown")) return ".md";
  if (t.startsWith("text/")) return ".txt";
  return ".bin";
}

// ── public gateways: the fall-through when a direct fetch is blocked ────────
// (added 2026-09-05, the-fold P117)
//
// A page that refuses this reader's own address — a 403, a 429, a
// bot-challenge shell — can often still be READ through a public gateway:
// the Wayback Machine's snapshot, a reader service, a CORS relay. The user's
// standing rule for the launch is that nothing about a person passes the
// maintainer; a public gateway is a third party the PERSON chooses to reach
// (the web toggle is on, the direct fetch was refused), and it sees the
// address fetched. So every gateway here names what it is and what it sees,
// the server records every try, the page says which route a page came by,
// and the ROSTER IS NOT A RANKING: which gateways are open is learned off
// the record (foldGateways / rankGateways below), never asserted — a
// gateway that answered last week may be closed today, and the instrument
// finds that out by trying, in the order its own history suggests.
//
// Still pure: address builders and body readers only. The fetches live in
// explore-server.mjs (P13's one egress, recorded).
export const GATEWAYS = Object.freeze([
  Object.freeze({
    id: "wayback",
    kind: "archive",
    sees: "archive.org sees the address; the page comes from its most recent snapshot, not the live site",
    // two hops: the availability API names the closest snapshot, then the
    // snapshot's raw face (the `id_` flag drops the archive's own toolbar)
    address: (url) => `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    read: "wayback-available",
  }),
  Object.freeze({
    id: "jina",
    kind: "reader",
    sees: "r.jina.ai fetches the address for you and returns its text as markdown",
    address: (url) => `https://r.jina.ai/${url}`,
    read: "jina-markdown",
  }),
  Object.freeze({
    id: "prometheoid",
    kind: "relay",
    sees: "holodeck-proxy.prometheoid.workers.dev fetches the address server-side with no record kept of the URL",
    address: (url) => `https://holodeck-proxy.prometheoid.workers.dev/raw?url=${encodeURIComponent(url)}`,
    read: "raw",
  }),
  Object.freeze({
    id: "allorigins",
    kind: "relay",
    sees: "api.allorigins.win fetches the address for you and returns the raw page",
    address: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    read: "raw",
  }),
  Object.freeze({
    id: "corsproxy",
    kind: "relay",
    sees: "corsproxy.io fetches the address for you and returns the raw page",
    address: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    read: "raw",
  }),
  Object.freeze({
    id: "codetabs",
    kind: "relay",
    sees: "api.codetabs.com fetches the address for you and returns the raw page",
    address: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    read: "raw",
  }),
  Object.freeze({
    id: "archive-today",
    kind: "archive",
    sees: "archive.today sees the address; the page comes from its newest capture",
    address: (url) => `https://archive.ph/newest/${url}`,
    read: "raw",
  }),
]);
export const GATEWAY_IDS = Object.freeze(GATEWAYS.map((g) => g.id));
export const gatewayOf = (id) => GATEWAYS.find((g) => g.id === id) ?? null;

/** HTTP statuses that mean "this address refused THIS reader", not "the page
 * is gone" — the shape a gateway can get around. A 404 is not in it: an
 * absent page is absent everywhere. */
export const BLOCKED_STATUSES = Object.freeze([401, 403, 407, 429, 451, 503]);

/**
 * Why a direct fetch counts as blocked, or null when it does not. Typed so
 * the record and the page can say which shape it was.
 */
export function blockedShape({ status = null, challenge = false, error = null, html = false, textChars = null } = {}) {
  if (challenge) return "challenge-page";
  if (status != null && BLOCKED_STATUSES.includes(Number(status))) return `status-${status}`;
  // A 200 whose readable face is EMPTY is a script shell, not a page this
  // reader can read (measured 2026-09-05: reddit.com answers 200 with a
  // title and no text) — a snapshot or a reader service may hold the text.
  if (html && status != null && Number(status) < 400 && textChars === 0) return "empty-face";
  if (error && /timeout|timed out|ECONNRESET|EPROTO|socket hang up|fetch failed/i.test(String(error))) return "no-answer";
  return null;
}

/**
 * Read a gateway's response into the page's bytes, or a typed refusal.
 * `wayback-available` yields {next: url} — a second hop the server takes;
 * `jina-markdown` yields text; `raw` yields the body as the page.
 */
export function readGatewayBody(read, { status, contentType = "", body = "" }) {
  const s = String(body ?? "");
  if (status >= 400) return { ok: false, detail: `the gateway answered ${status}` };
  if (read === "wayback-available") {
    try {
      const j = JSON.parse(s);
      const closest = j?.archived_snapshots?.closest;
      if (!closest?.available || !closest.url) return { ok: false, detail: "the Wayback Machine holds no snapshot of this address" };
      // the raw face: web.archive.org/web/<timestamp>id_/<url>
      const next = String(closest.url).replace(/\/web\/(\d+)\//, "/web/$1id_/");
      return { ok: true, next, timestamp: closest.timestamp ?? null };
    } catch {
      return { ok: false, detail: "the availability answer was not JSON" };
    }
  }
  if (read === "jina-markdown") {
    // "Title: …\nURL Source: …\nMarkdown Content:\n…" — the header lines are
    // the reader's own framing; the content after them is the page
    const m = s.match(/^Title:\s*(.*)$/m);
    const at = s.indexOf("Markdown Content:");
    const text = at >= 0 ? s.slice(at + "Markdown Content:".length).trim() : s.trim();
    if (!text) return { ok: false, detail: "the reader returned no content" };
    return { ok: true, text, title: m ? m[1].trim() : null, contentType: "text/markdown" };
  }
  if (!s.trim()) return { ok: false, detail: "the gateway returned an empty body" };
  return { ok: true, html: s, contentType: contentType || "text/html" };
}

/**
 * The learned state of every gateway, folded off the record's own
 * `web-gateway` lines: {gateway, ok, status, ms, at}. Natural frequencies,
 * never a verdict — `open` is only ever "its LAST try answered".
 */
export function foldGateways(events) {
  const table = Object.fromEntries(GATEWAY_IDS.map((id) => [id, { id, tried: 0, ok: 0, blocked: 0, msSum: 0, lastOk: null, lastAt: null, last: null, leak: null }]));
  for (const e of events ?? []) {
    if (e?.event === "web-gateway-leak" && table[e.gateway]) {
      const t = table[e.gateway];
      t.leak = { last: e.forwardsAddress ?? null, at: e.at ?? null, carriers: e.carriers ?? [] };
      continue;
    }
    if (e?.event !== "web-gateway" || !table[e.gateway]) continue;
    const t = table[e.gateway];
    t.tried += 1;
    if (e.ok) t.ok += 1; else t.blocked += 1;
    if (Number.isFinite(e.ms)) t.msSum += e.ms;
    t.last = e.ok ? "open" : "closed";
    t.lastAt = e.at ?? t.lastAt;
    if (e.ok) t.lastOk = e.at ?? t.lastOk;
  }
  return Object.values(table).map((t) => ({ ...t, rate: t.tried ? t.ok / t.tried : null, meanMs: t.ok ? Math.round(t.msSum / t.ok) : null }));
}

/**
 * The order to try gateways in: the ones that have answered most often
 * first (natural frequency, no threshold), an untried one before one that
 * has only failed (it has a chance the failed one has spent), and among
 * equals the faster. Every gateway is still tried — the order is learned,
 * the roster is not pruned by the instrument.
 */
export function rankGateways(fold, ids = GATEWAY_IDS) {
  const by = Object.fromEntries((fold ?? []).map((t) => [t.id, t]));
  const score = (id) => {
    const t = by[id];
    if (!t || !t.tried) return 0.5; // untried: between "always answered" and "never answered"
    return t.ok / t.tried;
  };
  return [...ids].sort((a, b) => {
    const d = score(b) - score(a);
    if (d) return d;
    const ta = by[a]?.tried ?? 0, tb = by[b]?.tried ?? 0;
    if (ta !== tb) return ta - tb; // fewer tries first among equals: explore
    return (by[a]?.meanMs ?? Infinity) - (by[b]?.meanMs ?? Infinity);
  });
}

/** One line per gateway for the page — counts, never a promise. */
export function gatewayLines(fold) {
  return (fold ?? []).map((t) => {
    const g = gatewayOf(t.id);
    const state = !t.tried ? "never tried" : `${t.ok}/${t.tried} answered · last ${t.last}${t.lastAt ? ` (${t.lastAt.slice(0, 16).replace("T", " ")})` : ""}${t.meanMs != null ? ` · ~${t.meanMs} ms` : ""}`;
    const leak = g?.kind === "archive"
      ? "the far side never hears from you"
      : !t.leak ? "forwards your address: not measured"
        : t.leak.last === true ? `forwards your address: YES (${t.leak.carriers.map((c) => c.name).join(", ")})`
          : t.leak.last === false ? "forwards your address: no" : (t.last === "closed" ? "forwards your address: not measurable while closed" : "forwards your address: unreadable");
    return `${t.id} (${g?.kind ?? "?"}) — ${state} — ${leak} — ${g?.sees ?? ""}`;
  });
}

// ── what a gateway forwards: the leak probe's pure half ────────────────────
// A relay or a reader fetches the address FOR the person; what it tells the
// far side about the person is measurable — fetch an echo endpoint through
// the gateway and read back the headers the gateway sent. If the person's
// own address (read directly off the same echo) appears in them, the gateway
// forwards it; if not, the far side sees only the gateway. An archive is not
// probed: it serves a snapshot it took on its own, so the far side never
// hears from the person at all. Recorded as `web-gateway-leak`, reported as
// counts and the last verdict — never a promise.
export const ECHO_HEADERS_URL = "https://httpbin.org/headers";
export const ECHO_IP_URL = "https://httpbin.org/ip";
export const ADDRESS_HEADERS = Object.freeze(["x-forwarded-for", "x-real-ip", "forwarded", "via", "cf-connecting-ip", "true-client-ip", "x-client-ip", "x-originating-ip"]);

/** The headers an echo endpoint saw, lower-cased, or null when the body is not its JSON. */
export function parseEchoHeaders(body) {
  try {
    const j = JSON.parse(String(body ?? ""));
    const h = j?.headers;
    if (!h || typeof h !== "object") return null;
    return Object.fromEntries(Object.entries(h).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  } catch {
    return null;
  }
}
/** The caller's address as the echo endpoint saw it, or null. */
export function parseEchoIp(body) {
  try {
    const j = JSON.parse(String(body ?? ""));
    const ip = String(j?.origin ?? "").split(",")[0].trim();
    return ip || null;
  } catch {
    return null;
  }
}
/**
 * Does the gateway forward the person's address? `forwardsAddress` is true
 * when the person's own address appears in any header the far side saw,
 * false when address-carrying headers are absent or carry only other
 * addresses, null when the echo could not be read or the own address is
 * unknown. `carriers` names every address-carrying header, with its value.
 */
export function leakVerdict(headers, ownIp) {
  if (!headers) return { forwardsAddress: null, carriers: [] };
  const carriers = ADDRESS_HEADERS.filter((k) => headers[k] != null).map((k) => ({ name: k, value: headers[k] }));
  if (!ownIp) return { forwardsAddress: null, carriers };
  const forwardsAddress = carriers.some((c) => c.value.includes(ownIp));
  return { forwardsAddress, carriers };
}
