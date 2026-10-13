// fold-chat-titles.js — which words of an ask NAME a thing: one batched Wikipedia title lookup. No DOM, no model, no clock.
//
// An entity is whatever a title resolves to, never whatever is written with a capital letter (the product rule: no case logic). So the
// frame (fold-chat-frame.js askFrame) hands every candidate run of the ask to ONE call of this module and keeps what resolves.
// The API does the folding that is its own (a title's first letter, underscores, redirects); this module only reads its answer:
//
//   action=query & titles=A|B|… & redirects=1 & prop=pageprops & ppprop=disambiguation & format=json & origin=*
//
//   resolveTitlesWikipedia(candidates, { fetchImpl, edition }) → Map<candidate, { title, redirectedFrom, disambiguation } | null>
//     title            the page the candidate lands on, after normalisation and redirects ("UK" → "United Kingdom")
//     redirectedFrom   the redirect page the candidate named, or null when it named the page itself
//     disambiguation   true when the page is a "may refer to" page (it names no one thing, so the frame never takes it as a referent)
//     null             no such page (or a string that cannot be a page title)
//
// A network failure REJECTS with a TitlesError (kind "titles_unavailable"): "nothing resolved" and "could not ask" are different facts, and
// the caller (the frame) draws them as the typed gap referents_unresolved rather than letting a throw escape.
//
// Declared, not measured (Constitution II.11): `chunk` is the API's own limit for an ordinary client (50 titles per query), taken from the
// MediaWiki API documentation; `maxHops` bounds a redirect chain we follow ourselves (the API resolves them, this is a loop guard).

export const DECLARED = Object.freeze({ chunk: 50, maxHops: 5, edition: "en" });

export class TitlesError extends Error {
  constructor(message, cause = null) { super(message); this.name = "TitlesError"; this.kind = "titles_unavailable"; this.cause = cause; }
}

// What MediaWiki itself refuses in a page title (so it is answered null without being sent; a "|" would also split the batch).
const NOT_A_TITLE = /[|#<>[\]{}\u0000-\u001f]/u;
const EDITION = /^[a-z][a-z-]{0,11}$/;

const urlFor = (edition, titles) =>
  `https://${edition}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join("|"))}&redirects=1&prop=pageprops&ppprop=disambiguation&format=json&origin=*`;

async function ask(fetchImpl, url) {
  let res, body;
  try {
    res = await fetchImpl(url);
    if (!res || !res.ok) throw new TitlesError("the title service answered " + (res ? res.status : "nothing"));
    body = await res.json();
  } catch (e) {
    throw e instanceof TitlesError ? e : new TitlesError("the title service could not be asked: " + String(e?.message || e), e);
  }
  if (!body || typeof body !== "object" || body.error || !body.query || typeof body.query !== "object") {
    throw new TitlesError("the title service gave no answer" + (body?.error?.code ? " (" + body.error.code + ")" : ""));
  }
  return body.query;
}

function readChunk(chunk, q) {
  const normalized = new Map((Array.isArray(q.normalized) ? q.normalized : []).map((x) => [x.from, x.to]));
  const redirects = new Map((Array.isArray(q.redirects) ? q.redirects : []).map((x) => [x.from, x.to]));
  const pages = Array.isArray(q.pages) ? q.pages : Object.values(q.pages || {});
  const byTitle = new Map(pages.filter((p) => p && typeof p.title === "string").map((p) => [p.title, p]));
  const out = new Map();
  for (const c of chunk) {
    let t = normalized.get(c) ?? c, redirectedFrom = null, hops = 0;
    while (redirects.has(t) && hops++ < DECLARED.maxHops) { if (redirectedFrom === null) redirectedFrom = t; t = redirects.get(t); }
    const p = byTitle.get(t);
    const gone = !p || "missing" in p || "invalid" in p || (typeof p.ns === "number" && p.ns < 0);
    out.set(c, gone ? null : { title: p.title, redirectedFrom, disambiguation: !!(p.pageprops && "disambiguation" in p.pageprops) });
  }
  return out;
}

export async function resolveTitlesWikipedia(candidates, { fetchImpl = globalThis.fetch, edition = DECLARED.edition } = {}) {
  if (!EDITION.test(String(edition))) throw new TitlesError("not a Wikipedia edition: " + JSON.stringify(edition));
  const out = new Map();
  const asked = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (typeof c !== "string" || out.has(c) || asked.includes(c)) continue;
    if (!c.trim() || NOT_A_TITLE.test(c)) { out.set(c, null); continue; }
    asked.push(c);
  }
  if (!asked.length) return out;
  if (typeof fetchImpl !== "function") throw new TitlesError("no way to ask the title service");
  const chunks = [];
  for (let i = 0; i < asked.length; i += DECLARED.chunk) chunks.push(asked.slice(i, i + DECLARED.chunk));
  const answers = await Promise.all(chunks.map(async (chunk) => readChunk(chunk, await ask(fetchImpl, urlFor(edition, chunk)))));
  for (const m of answers) for (const [k, v] of m) out.set(k, v);
  return out;
}
