// native/adapters/build/podcast-feed.js — subscribing to a REAL podcast
// (an RSS/Atom feed), on the SAME kernel ledger podcast.js already uses.
//
// "IT SHOULD BUILD AN APP I CAN SUBSCRIBE TO PODCASTS." This is that half:
// a subscription is heard onto the ledger exactly like any other
// arrangement (`{end1: "you", label: "subscribed_to", end2: showTitle}`),
// and every episode a feed reports is heard the same way
// (`{end1: showTitle, label: "published", end2: episodeTitle}`), witnessed
// by the feed's own URL, addressed with a self-verified P5.2 span into the
// RAW FEED BYTES this organ parsed. No second ledger, no new mechanism:
// `kernel/notes.js`'s hear/concede/fold/foldWithStanding are reused whole,
// the same way podcast.js reuses them for a generated episode's own claims.
//
// PURE. This file parses feed XML it is HANDED — it never fetches. The one
// crossing (an HTTP GET of a feed URL) belongs to the caller
// (podcast-run.mjs), matching every other pure/crossing split in this
// tree (web.js pure, its caller owns the fetch).
//
// DISCLOSED LIMIT: `parseFeed` is a small, honest, regex-based reader of
// RSS 2.0 (with the itunes: podcast extensions most real feeds use) — not
// a general XML/Atom parser. It handles CDATA, HTML-entity-escaped text,
// and the handful of elements a podcast episode actually needs (title,
// link, guid, pubDate, description, the audio enclosure). A feed using
// namespaces or nesting this reader does not expect will parse partially
// or drop an item; this is stated here rather than papered over with a
// dependency this repo has not chosen to carry.

const norm = (v) => String(v ?? "").trim().toLowerCase();

const decodeEntities = (s) => String(s ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Text content of the first `<tag>...</tag>` (with or without a CDATA wrapper) inside `xml`, or null. */
function tagText(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return null;
  return decodeEntities((m[1] ?? m[2] ?? "").trim());
}

/** The `attr="..."` value of a self-closing or opening `<tag .../>` element, or null. */
function tagAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}\\s+[^>]*\\b${attr}=["']([^"']*)["'][^>]*/?>`, "i");
  const m = re.exec(xml);
  return m ? decodeEntities(m[1]) : null;
}

/** Split `xml` into the raw text of each top-level `<tag>...</tag>` block (non-greedy, one level). */
function splitBlocks(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) ?? [];
}

/**
 * parseFeed(xml) -> { title, link, description, items: [...] }
 *
 * Each item: `{ title, link, guid, pubDate, description, enclosureUrl,
 * enclosureType, raw }` — `raw` is the item's OWN exact substring of the
 * fed XML, kept so a caller can self-verify an address the way
 * `hearEpisode` below does (P5.2: an address must re-slice to the words it
 * names).
 */
export function parseFeed(xml) {
  const text = String(xml ?? "");
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text);
  if (isAtom) {
    const title = tagText(text, "title");
    const link = tagAttr(text, "link", "href") ?? tagText(text, "link");
    const entries = splitBlocks(text, "entry").map((raw) => ({
      title: tagText(raw, "title"),
      link: tagAttr(raw, "link", "href") ?? tagText(raw, "link"),
      guid: tagText(raw, "id"),
      pubDate: tagText(raw, "updated") ?? tagText(raw, "published"),
      description: tagText(raw, "summary") ?? tagText(raw, "content"),
      enclosureUrl: null, enclosureType: null,
      raw,
    }));
    return { title, link, description: tagText(text, "subtitle"), items: entries, schema: "atom" };
  }
  const channelMatch = /<channel[\s>][\s\S]*?<\/channel>/i.exec(text);
  const channel = channelMatch ? channelMatch[0] : text;
  // Real, standard field (the iTunes podcast RSS extension), confirmed
  // present per-item on a real live feed (NPR's Planet Money) before this
  // was written — not assumed. Per-item artwork falls back to the
  // channel's own <itunes:image>, since not every feed varies art per
  // episode but every real podcast feed declares at least the show's own.
  const channelImage = tagAttr(channel, "itunes:image", "href");
  const items = splitBlocks(channel, "item").map((raw) => ({
    title: tagText(raw, "title"),
    link: tagText(raw, "link"),
    guid: tagText(raw, "guid"),
    pubDate: tagText(raw, "pubDate"),
    description: tagText(raw, "description") ?? tagText(raw, "itunes:summary"),
    enclosureUrl: tagAttr(raw, "enclosure", "url"),
    enclosureType: tagAttr(raw, "enclosure", "type"),
    imageUrl: tagAttr(raw, "itunes:image", "href") ?? channelImage,
    raw,
  }));
  return { title: tagText(channel, "title"), link: tagText(channel, "link"), description: tagText(channel, "description"), image: channelImage, items, schema: "rss2" };
}

export const SHOW_LABEL = "subscribed_to";
export const EPISODE_LABEL = "published";
export const SUBSCRIBER = "you";

/**
 * makeLibrary({ notes, taskLog, cellOf, identity, bridge }) — the
 * subscription ledger, over the SAME `kernel/notes.js` API podcast.js
 * uses. Nothing new: subscribing is `hear()`, unsubscribing is `concede()`,
 * an episode arriving is `hear()` witnessed by the feed.
 */
export function makeLibrary({ notes = null, taskLog, cellOf, identity = null, bridge = null } = {}) {
  const ledger = notes ?? (() => { throw new TypeError("makeLibrary: pass a shared `notes` ledger (e.g. from makePodcast().ledger) or import kernel/notes.js's makeNotes yourself — this organ never builds its own second one silently"); })();

  /** subscribe(log, {url, title}) — hear the subscription; a re-subscribe to an already-heard show is a no-op (notes.hear's own rule: nothing new heard, nothing appended). */
  function subscribe(log, { url, title }) {
    if (typeof url !== "string" || !url.trim()) throw new TypeError("subscribe: a feed needs its own URL");
    const showTitle = title ?? url;
    const next = ledger.hear(log, { end1: SUBSCRIBER, label: SHOW_LABEL, end2: showTitle, witness: url });
    return { log: next, id: `${norm(SUBSCRIBER)}|${norm(SHOW_LABEL)}|${norm(showTitle)}` };
  }

  /** unsubscribe(log, showTitle, {trigger}) — REC on the subscription note. A trigger is required (notes.concede's own rule): unsubscribing is a recorded decision, never a silent disappearance. */
  function unsubscribe(log, showTitle, { trigger } = {}) {
    const id = `${norm(SUBSCRIBER)}|${norm(SHOW_LABEL)}|${norm(showTitle)}`;
    return ledger.concede(log, id, { trigger: trigger ?? `unsubscribed from ${showTitle}` });
  }

  /** subscriptions(log) — every show currently subscribed to (not conceded). */
  function subscriptions(log) {
    return ledger.fold(log).filter((n) => norm(n.end1) === norm(SUBSCRIBER) && norm(n.label) === norm(SHOW_LABEL));
  }

  /**
   * hearEpisode(log, { showTitle, feedUrl, item }) — one episode a feed
   * reported, heard onto the ledger, witnessed by the feed's own URL,
   * addressed into the RAW FEED XML this item came from (P5.2: self-
   * verified — `item.raw` really contains the located span).
   */
  function hearEpisode(log, { showTitle, feedUrl, item }) {
    if (!item?.title) return { log, refused: { type: "no_title", detail: "hearEpisode: an episode with no title names nothing to hear" } };
    let spans = [];
    if (item.raw) {
      const start = item.raw.indexOf(item.title);
      if (start >= 0) spans = [{ ref: feedUrl, start, end: start + item.title.length, at: `${feedUrl}#${start}-${start + item.title.length}` }];
    }
    const next = ledger.hear(log, {
      end1: showTitle, label: EPISODE_LABEL, end2: item.title, witness: feedUrl, spans,
      because: item.pubDate ? `published ${item.pubDate}` : null,
    });
    return { log: next, refused: null };
  }

  /**
   * syncFeed(log, { url, xml }) — subscribe (idempotent) and hear every
   * item the fed XML reports, returning `{ log, show, added }` where
   * `added` is how many episode notes were genuinely NEW this call
   * (`notes.hear`'s own no-op-on-nothing-new rule makes this exact, not
   * estimated).
   */
  function syncFeed(log, { url, xml }) {
    const feed = parseFeed(xml);
    const showTitle = feed.title ?? url;
    let next = subscribe(log, { url, title: showTitle }).log;
    const before = new Set(ledger.fold(next).filter((n) => norm(n.end1) === norm(showTitle) && norm(n.label) === norm(EPISODE_LABEL)).map((n) => n.id));
    for (const item of feed.items) {
      const r = hearEpisode(next, { showTitle, feedUrl: url, item });
      next = r.log;
    }
    const after = ledger.fold(next).filter((n) => norm(n.end1) === norm(showTitle) && norm(n.label) === norm(EPISODE_LABEL));
    const added = after.filter((n) => !before.has(n.id)).length;
    return { log: next, show: { title: showTitle, url, episodeCount: after.length }, added };
  }

  /** episodesOf(log, showTitle) — every episode heard for a show, newest-witness-order untouched (notes.fold's own order: witness count, then id). */
  function episodesOf(log, showTitle) {
    return ledger.fold(log).filter((n) => norm(n.end1) === norm(showTitle) && norm(n.label) === norm(EPISODE_LABEL));
  }

  return Object.freeze({ ledger, subscribe, unsubscribe, subscriptions, hearEpisode, syncFeed, episodesOf });
}
