/* Sima speaks:
 * “Lao TzQ abode for a long time in Chou, but when he 
saw that the State showed signs of decay, he left. On 
reaching the frontier, the Warden, named Yin Hsi, said 
to him, ' So you are going into retirement. I beg you to 
write a book for me.' Thereupon Lao Tzfl wrote a book, 
in two parts, on Tao and Ti,' extending to over 5000 
words. He then went away, and no one knows where”
 *
 * This file embodies the principle of seeking truth through firsthand investigation, as exemplified by Sima Qian, the Han court historian.  It is a testament to the power of independent research and the importance of verifying sources before accepting them.  However, the code's reliance on a single historical source creates a risk of bias and limits the scope of understanding.
 *
 * — the engineering record below, kept whole —
 */
// primary.js — Wikipedia as a stepping stone, never a source of record: the
// Handle: Sima — after Sima Qian, the Han court historian who set aside the received account to consult the archive himself. Amendment XVII.
// pure half of the primary-source walk. A claim the reader wants grounded is
// taken THROUGH a saved Wikipedia page to the sources that page itself
// cites — the works, papers, records and archives the article stands on —
// and the claim is then judged against THOSE faces, sentence by sentence,
// each supporting passage carried verbatim with its char offsets into the
// saved bytes. The encyclopedia's job here is to know where the primary
// material lives; the assertion of record is the snip, an address into a
// content-addressed face, never the article's own paraphrase.
//
// THIS MODULE OWNS NO NETWORK — web.js's discipline exactly: every function
// here maps bytes-already-fetched (the wiki page's raw HTML face, a primary
// source's text face) to structure. The fetching lives in explore-server.mjs
// (/api/web/primary), inside P13's one sanctioned egress, every crossing
// recorded like any other fetch.
//
// ANCESTRY, disclosed: eochat/server/web-search.js (legacy, read-only) walked
// this exact path — researchTopic → fetchWikipediaPrimarySources →
// rankPrimaryCandidates. What that walk taught, and what of it is kept or
// dropped, is stated at each organ below rather than re-derived; the short
// version is that the legacy ranked by hand-tuned domain WEIGHTS (gov 8,
// edu 7, org 5, com 2 …) and fetched from wikitext {{cite}} templates, while
// this organ reads the RENDERED face the fetch route already saves and
// orders candidates lexicographically — claim-word overlap counted first,
// then a declared class ladder, then the article's own citation order — so
// no tuned constant survives (P4 / P9).

import { wordSet, numberSet, hasWord, hasNumber, splitSentences, CLAIM_STOPWORDS } from "./grounding.js";
import { hostOf, decodeEntities, ATTRS } from "./web.js";

// ── declared numbers, each with its giver ───────────────────────────────────
// Budgets with names and duties (P9), not quality thresholds.
export const PRIMARY_SOURCES_CONSULTED = 3; // citations fetched per walk — giver: proof.js PROOF_PAGES_CONSULTED and its reasoning (one perspective is anecdote; three is the smallest count where "2 of 3" can disagree with "3 of 3"); sequential, never a burst
export const PRIMARY_SNIPS_KEPT = 12; // snips carried per consulted page — giver: web.js WEB_SEARCH_MAX_RESULTS's reasoning (one screenful); snipsFound states the true count and the face on disk keeps every sentence

// ── the wiki family ─────────────────────────────────────────────────────────
// Links back into the encyclopedia's own family are navigation, not sources:
// article-to-article links, sister projects, the foundation's self links.
// The legacy skip list (wikipedia|wikimedia|mediawiki|duckduckgo) is KEPT and
// widened to the whole family; its duckduckgo entry is DROPPED — that was the
// legacy search engine's self-link concern, and this parser reads saved
// Wikipedia faces, not results pages.
const WIKI_FAMILY_RE =
  /(?:^|\.)(wikipedia|wikimedia|mediawiki|wiktionary|wikidata|wikisource|wikiquote|wikibooks|wikinews|wikiversity|wikivoyage|wikifunctions|wikimediafoundation|wmflabs|toolforge)\.org$/i;
export const isWikiFamilyHost = (host) => WIKI_FAMILY_RE.test(String(host ?? ""));

/** The seam the proof pipeline chains on: is a consulted page's host the
 * encyclopedia, so that the primary walk is worth offering? */
export const isWikipediaHost = (host) => /(?:^|\.)wikipedia\.org$/i.test(String(host ?? ""));

// ── archive wrappers ────────────────────────────────────────────────────────
/**
 * web.archive.org/web/<timestamp>/<url> is a WRAPPER around its target, not a
 * different source. Unwrapped so the candidate is the target (dedup then
 * merges the wrapper with a bare citation of the same page — CS1 citations
 * routinely carry both), with the archive form KEPT beside it: the wrapper
 * usually exists because the target link was dying, so the archive copy is
 * the fallback the consumer reads when the target refuses. Returns
 * { target, archive } or null when the url is not a wrapper.
 */
export function unwrapArchiveUrl(url) {
  const m = String(url ?? "").match(/^(https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/)(https?:\/\/.+)$/i);
  return m ? { target: m[2], archive: m[0] } : null;
}

// ── citation extraction from the rendered face ──────────────────────────────
// The legacy parsed WIKITEXT {{cite}} templates via a second API call. That
// is DROPPED whole: the fetch route already keeps the rendered HTML's raw
// bytes beside the text face, and a second fetch of a second face would be a
// crossing this pure half has no business requiring. What is KEPT from the
// legacy is the shape of a candidate — outbound url plus its visible
// citation text — and the discipline that wiki-internal links are never
// candidates. Every tag pattern walks quoted attribute values (web.js's
// ATTRS — Wikipedia ships JSON inside data-mw='{…}', and the naive [^>]*
// leaked half an infobox once already).

const anchorRe = () => new RegExp(`<a\\b(${ATTRS})>([\\s\\S]*?)</a\\s*>`, "gi");
const blockRe = (tag) => new RegExp(`<${tag}\\b${ATTRS}>[\\s\\S]*?</${tag}\\s*>`, "gi");

const hrefIn = (attrs) => {
  const m = String(attrs).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return m ? decodeEntities(m[1] ?? m[2]) : null;
};

/** Tags out, entities decoded, whitespace collapsed — the citation as a
 * reader sees it. Footnote furniture (backlink ↑ / "1 2 3" digits, [n]
 * markers) is markup, not citation text, and is cut before the strip. */
function citationText(blockHtml) {
  let b = String(blockHtml);
  // A footnote <li> opens with backlink chrome (the ↑ / "1 2 3" digits);
  // the reference-text span is where the citation itself starts. Cutting at
  // the span's OPENER (rather than matching its extent) sidesteps
  // nested-span matching entirely — regexes over nested markup are the
  // known limitation here, said not hidden. The opener walk is quote-aware
  // (ATTRS), because these spans carry data-mw JSON like everything else.
  for (const m of b.matchAll(new RegExp(`<span\\b(${ATTRS})>`, "gi"))) {
    if (/\bclass\s*=\s*(?:"[^"]*\breference-text\b[^"]*"|'[^']*\breference-text\b[^']*')/i.test(m[1])) {
      b = b.slice(m.index + m[0].length);
      break;
    }
  }
  // Inline footnote markers ([4], [a]) ride in <sup> elements; repeat until
  // stable, the dropTag idiom, because markup nests sloppily.
  const sup = blockRe("sup");
  let prev;
  do {
    prev = b;
    b = b.replace(sup, " ");
  } while (b !== prev);
  return decodeEntities(b.replace(new RegExp(`</?[a-zA-Z!]${ATTRS}>`, "g"), " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A saved Wikipedia page's raw HTML face -> its outbound citations, document
 * order, deduplicated by target. Each candidate:
 *   { url, host, text, index, archiveUrl? }
 * url is the citation's real destination (archive wrappers unwrapped, the
 * wrapper kept as archiveUrl); text is the visible citation the link rides
 * in — the innermost enclosing <cite> element when there is one (CS1 renders
 * every bibliography entry as one), else the enclosing footnote/list <li>,
 * else the anchor's own text (a bare external link in page chrome earns no
 * more context than it has). index is the candidate's first position in
 * document order — the article's own ordering of its evidence, which the
 * ranking uses as its final tiebreak.
 */
export function extractCitations(html) {
  const h = String(html ?? "").replace(/<!--[\s\S]*?-->/g, " ");
  const cites = [...h.matchAll(blockRe("cite"))].map((m) => ({ start: m.index, end: m.index + m[0].length, html: m[0] }));
  const lis = [...h.matchAll(blockRe("li"))].map((m) => ({ start: m.index, end: m.index + m[0].length, html: m[0] }));
  const enclosing = (at) => {
    // cite elements do not nest; list items may (a lazy match under-reaches
    // there, costing context, never correctness) — take the innermost.
    const cite = cites.find((c) => at >= c.start && at < c.end);
    if (cite) return cite;
    let best = null;
    for (const li of lis) if (at >= li.start && at < li.end && (!best || li.start > best.start)) best = li;
    return best;
  };

  const byKey = new Map();
  for (const m of h.matchAll(anchorRe())) {
    const href = hrefIn(m[1]);
    if (!href || !/^https?:\/\//i.test(href)) continue; // wiki-internal /wiki/… paths and fragments are navigation
    const wrapped = unwrapArchiveUrl(href);
    const url = wrapped ? wrapped.target : href;
    const host = hostOf(url);
    if (isWikiFamilyHost(host)) continue; // the family cites the world, not itself
    const key = url.split("#")[0].replace(/\/+$/, "");
    const prev = byKey.get(key);
    if (prev) {
      // Same target seen again (a bare link and its archive wrapper, or a
      // reused reference): first occurrence keeps its place and text, the
      // archive form fills in from whichever occurrence carried it.
      if (!prev.archiveUrl && wrapped) prev.archiveUrl = wrapped.archive;
      continue;
    }
    const block = enclosing(m.index);
    const text = block ? citationText(block.html) : citationText(m[2]);
    byKey.set(key, { url, host, text, index: byKey.size, ...(wrapped ? { archiveUrl: wrapped.archive } : {}) });
  }
  return [...byKey.values()];
}

// ── the class ladder ────────────────────────────────────────────────────────
// Mechanical signals of primariness, declared as an ORDERING, never scored:
// a candidate belongs to the first class it matches, and the ladder's whole
// authority is its position in the lexicographic sort below. Against the
// legacy rankPrimaryCandidates:
//   KEPT   — .gov/.mil (legacy weight 8 → "government"); .edu/.ac.xx
//            (7 → "academic"); arxiv/doi/pubmed (7 → "identifier", widened
//            with handle.net and semanticscholar). The legacy held academic
//            hosts and identifiers at the SAME weight; a lexicographic order
//            cannot keep that tie, and academic is placed first because the
//            .edu host serves the document's own face while an identifier
//            resolves through a registrar to whatever is behind it.
//   ADDED  — "archive-library-museum" (archive.org, hathitrust, gallica,
//            europeana, worldcat, jstor, the .museum TLD): unwrapping
//            archive wrappers makes these real destinations, where the
//            legacy saw archive.org as just another .org at weight 5.
//   ADDED  — "pdf-document" and "dated-document": faces of a document
//            rather than a site, signals the legacy did not read at all.
//   DROPPED — the officialSite candidate at weight 9: it came from the
//            wikitext {{Official website}} template, which the rendered
//            face carries no mechanical marker for — and this walk starts
//            from a claim, not from a subject that has an official anything.
//   DROPPED — the .org 5 / .io 3 / .com 2 / .net 2 tail: tuned-looking
//            constants over generic TLDs with no mechanical claim to
//            primariness (P4). Ties among unclassed candidates fall to the
//            article's own citation order instead.
export const PRIMARY_CLASSES = ["government", "academic", "identifier", "archive-library-museum", "pdf-document", "dated-document", "other"];

const GOV_RE = /\.(gov|mil)$|\.gov\.[a-z]{2}$/i;
const EDU_RE = /\.edu$|\.(ac|edu)\.[a-z]{2}$/i;
const IDENT_RE = /(?:^|\.)(doi\.org|arxiv\.org|semanticscholar\.org|handle\.net)$|(?:^|\.)pubmed\./i;
const LIBRARY_RE = /(?:^|\.)(archive\.org|hathitrust\.org|europeana\.eu|worldcat\.org|jstor\.org)$|(?:^|\.)gallica\.bnf\.fr$|\.museum$/i;
const YEAR_RE = /\b1[0-9]{3}\b|\b20[0-9]{2}\b/;

export function classifyCitation({ url = "", host = "", text = "" } = {}) {
  const h = String(host || hostOf(url));
  if (GOV_RE.test(h)) return "government";
  if (EDU_RE.test(h)) return "academic";
  if (IDENT_RE.test(h)) return "identifier";
  if (LIBRARY_RE.test(h)) return "archive-library-museum";
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    /* not a parseable url — the face signals below still apply to text */
  }
  if (/\.pdf$/i.test(pathname)) return "pdf-document";
  if (YEAR_RE.test(String(text))) return "dated-document"; // a citation carrying a year is a document; a bare link is a link
  return "other";
}

// ── ranking ─────────────────────────────────────────────────────────────────
/**
 * Order a page's citations for a claim — proof.js rankResults' discipline
 * carried over: overlap of the citation's visible face with the claim's own
 * words is a COUNT (argmax, no threshold, P4), and membership runs through
 * grounding.js's one fold on both sides (P11 — an accented name in a
 * citation must not fail against a folded claim). The full lexicographic
 * order: overlap count desc, then class-ladder position, then the article's
 * own citation order. No weight is multiplied anywhere; a tie at every key
 * is decided by where the article itself put the citation first.
 */
export function rankPrimary(claim, citations) {
  const want = new Set(
    [
      ...String(claim?.sentence ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}'’]+/u)
        .map((w) => w.replace(/['’]s$/, "")),
      ...(claim?.tokens ?? []).map((t) => String(t).toLowerCase()),
    ].filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)),
  );
  const scored = (citations ?? []).map((c, i) => {
    let urlWords = String(c?.url ?? "");
    try {
      urlWords = decodeURIComponent(urlWords);
    } catch {
      /* malformed escapes — the raw url still carries its words */
    }
    const face = wordSet(`${c?.text ?? ""} ${urlWords}`);
    let overlap = 0;
    for (const w of want) if (hasWord(face, w)) overlap++;
    return { c, i, overlap, cls: PRIMARY_CLASSES.indexOf(classifyCitation(c ?? {})) };
  });
  scored.sort((a, b) => b.overlap - a.overlap || a.cls - b.cls || a.i - b.i);
  return scored.map((x) => ({ ...x.c, overlap: x.overlap, structuralClass: PRIMARY_CLASSES[x.cls] }));
}

// ── the snip ────────────────────────────────────────────────────────────────
/**
 * The assertion-bearing passages of a fetched primary source, for one claim:
 * every sentence of the saved text face that states ALL of the claim's
 * tokens — the same containment fold grounding.js judges answers with
 * (wordSet/hasWord for names and edges, numberSet/hasNumber for figures,
 * both sides folded, P11) — each carried VERBATIM with its char offsets into
 * the face, so a snip is an ADDRESS into content-addressed bytes:
 *   { text, start, end, facePath, url, host }
 * and slicing the face at [start, end) yields exactly the snip's text
 * (P5.2 — offsets self-verify or they do not ship). A source that never
 * states the claim returns [] — a result, not an error (P4: gaps are
 * results); the caller phrases it as "this source does not state it", never
 * as a failure.
 */
export function snipClaim(claim, faceText, { facePath = null, url = null, host = null } = {}) {
  const src = String(faceText ?? "");
  if (!src.trim()) return [];
  const tokens = (claim?.tokens?.length ? claim.tokens : String(claim?.text ?? "").split(/\s+/)).map(String).filter(Boolean);
  if (!tokens.length) return [];
  const isNumber = claim?.kind === "number";
  const out = [];
  for (const s of splitSentences(src)) {
    const stated = isNumber
      ? tokens.every((t) => hasNumber(numberSet(s.text), t))
      : tokens.every((t) => hasWord(wordSet(s.text), t));
    if (!stated) continue;
    const start = s.start;
    const end = s.start + s.text.length;
    // splitSentences returns each sentence as a contiguous substring with
    // the offset of its trimmed start, so this equality holds by
    // construction; the guard is P5.2's mandatory self-verification — an
    // address that does not reproduce its text is never shipped.
    if (src.slice(start, end) !== s.text) continue;
    out.push({ text: s.text, start, end, facePath, url, host });
  }
  return out;
}

// ── the fold ────────────────────────────────────────────────────────────────
/**
 * The walk's answer, typed and phrased in counted natural frequencies —
 * proof.js foldProof's posture: never "true", never "confirmed", never
 * stronger than what was counted. `consulted` is what the caller actually
 * fetched, in order: { url, host, citation?, title?, textPath?, snips?,
 * snipsFound?, archivedCopy?, challenge?, gap? } — a fetch the server
 * refused rides through as its typed gap, never dropped.
 *
 * Verdicts:
 *   stated-by-primary     — at least one consulted source's face states the
 *                           claim; the snips are the addresses.
 *   unstated-by-consulted — sources were read and none states it. NOT
 *                           falsity: the counted fact is "0 of N read".
 *   not-consulted         — nothing could be read (every crossing failed,
 *                           or there was nothing to consult); a gap.
 */
export function foldPrimary(claim, { citationsFound = 0, consulted = [] } = {}) {
  const read = consulted.filter((c) => c && !c.gap);
  const failed = consulted.filter((c) => c && c.gap);
  const stating = read.filter((c) => (c.snipsFound ?? c.snips?.length ?? 0) > 0);
  const hosts = [...new Set(stating.map((c) => c.host ?? hostOf(c.url)))];
  const verdict = stating.length ? "stated-by-primary" : read.length ? "unstated-by-consulted" : "not-consulted";
  const cited = `the encyclopedia page cites ${citationsFound} outside source(s) for its material`;
  const sentence = !consulted.length
    ? `${cited}; none was consulted — a gap, not a verdict`
    : !read.length
      ? `${cited}; ${failed.length} consulted and none could be read — a gap, not a verdict`
      : `${cited}; ${read.length} of the ${consulted.length} consulted could be read; the claim is stated by ${stating.length} of them` +
        (stating.length ? ` (${hosts.length} distinct host(s))` : " — a source that does not state it is a result, not a refutation") +
        (failed.length ? `; ${failed.length} could not be fetched, counted separately` : "");
  return {
    verdict,
    claim: claim?.text ?? null,
    citationsFound,
    read: read.length,
    failed: failed.length,
    // A bare count, alongside statingHosts — proof.js/priors.js's own
    // `stating: stating.length` shape, so a caller phrasing "stated by N of
    // M sources" never has to recompute it from statingHosts.length (a
    // HOST count, not a source count — the two diverge whenever two stating
    // sources share one host).
    stating: stating.length,
    statingHosts: hosts,
    independence: {
      hosts: hosts.length,
      basis: "distinct hosts among the article's own citations; two citations may still trace to one upstream work, which is not tested",
    },
    consulted,
    sentence,
  };
}
