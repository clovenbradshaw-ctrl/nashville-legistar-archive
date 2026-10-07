// wiki-base.js — a real, unchosen base article to write FROM (2026-09-22).
//
// The user: "have it try to generate something in that modality based on a
// random Wikipedia article that is over a certain minimum length so that
// there is a base to draw from." Mechanical, no model call: a random
// Wikipedia article is fetched (Special:Random redirects to one), and if
// its readable text is under `minChars` the article is refused and another
// is drawn — bounded, so a run never hangs on a stub/disambiguation page.
// Everything here is the SAME liveWeb() organ surf.js already uses.
import { liveWeb } from "./surf.js";

export const WIKI_RANDOM_URL = "https://en.wikipedia.org/wiki/Special:Random";

/**
 * fetchWikipediaBase({ minChars, maxTries, web }) →
 *   { url, title, text, chars } | { refused: reason, tries }
 * `web` is injectable ({ fetch }) so this is testable without a real
 * network call — production callers omit it and get liveWeb().
 */
export async function fetchWikipediaBase({ minChars = 1500, maxTries = 6, web = null } = {}) {
  const { fetch } = web ?? liveWeb();
  const tried = [];
  for (let i = 0; i < maxTries; i++) {
    let page;
    try { page = await fetch(WIKI_RANDOM_URL); }
    catch (e) { tried.push({ error: String(e?.message ?? e).slice(0, 200) }); continue; }
    const text = String(page?.text ?? "").trim();
    tried.push({ title: page?.title ?? "", chars: text.length });
    if (text.length >= minChars) return { url: WIKI_RANDOM_URL, title: page?.title ?? "", text, chars: text.length };
  }
  return { refused: "no article reached minChars", tries: tried };
}
