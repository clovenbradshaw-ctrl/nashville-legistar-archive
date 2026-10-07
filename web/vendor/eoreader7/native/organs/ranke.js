// ranke.js — Ranke: the agent that chases a claim to its primary source.
//
// Named, by the user's direction (2026-09-02: "when reading things like
// wikipedia, and in general, we must chase primary sources" — "this activity
// should be personified by the agent we can call … Leopold von Ranke"),
// after the historian whose Quellenkritik this organ mechanizes: an account
// is judged by the document it stands on, and history is written from the
// Quellen — the archive, the dispatch, the record — never from the narrative
// that repeats them. A citing page is a NARRATIVE. It is a good witness to
// WHERE the primary material lives — it links to it, or quotes it — and a
// weak witness to the fact itself. So a note the reader heard off such a
// page is not left standing on that page: Ranke follows the page's LEADS to
// the sources the page stands on, reads those faces, and lands every source
// that states the note as its own witness — a `primary:` witness, kind
// declared, addressed into the primary's bytes, recipe named.
//
// THE FOOTNOTE BINDING (2026-09-03, measured backwards on Apollo 11 —
// eval/the-fold/ranke-backwards.mjs): a citing page does not cite "for the
// page", it cites PER SENTENCE — a superscript marker in the prose is an
// in-page link to one numbered note, and that note's outbound links are
// the source the page attached to THAT claim. Ranking a page's whole
// bibliography by word overlap with a note's ends picked a NASA landing
// page for "Armstrong began his descent" while the sentence itself carried
// [139]; over 285 notes with a readable cited face the overlap-ranked
// leads found the proposition in one sentence 6 times and the redealt
// control 7 — the leads were noise. `footnoteLeads(page)` binds marker
// number → note → links, generically: any <sup> whose in-page anchor
// resolves to an element with that id (numeric-style citation, the
// convention of encyclopedias and journals alike; nothing keyed on one
// site's ids), and `chase` consults a note's own footnotes FIRST, the
// overlap-ranked links only after.
//
// TWO KINDS OF LEAD, both the user's own direction (2026-09-03): "if it is
// citing something via a hyperlink, it should go read that, not just
// Wikipedia-shaped sourcing. if it is just quoting someone, it should go
// try to find that quote if the source isn't given."
//   link  — any outbound hyperlink on the page (any host that is not the
//           page's own, nor the encyclopedia family's navigation), with the
//           text it rides in; primary.js's extractCitations is the reader,
//           and it is not Wikipedia-shaped past its family skip — a <cite>
//           block is preferred for context where one exists and any <li> or
//           the anchor's own text serves otherwise.
//   quote — a quotation the page gives WITHOUT a link: an unsourced quote
//           is a lead to be found, not a fact to be kept. Found through an
//           injected `search(quoteText)`, the results read as candidates.
//
// THE GATE, so it does not explode in a novel (user, same day: "that needs
// a gate so it doesn't explode in a novel"). Structural, never a genre
// label: a page that CITES NOTHING — zero outbound links — has declared no
// sources and gets no chase of either kind. Dracula carries thousands of
// quotation marks and not one hyperlink; under this gate it yields zero
// leads, zero searches, zero fetches, typed `no_citations`. Only a page
// that shows its sources for SOME claims licenses the hunt for the
// quotations it leaves unsourced. On top of the gate: every run is BUDGETED
// (`maxFetches`, `maxSearches`, declared by the caller — P9) and the organ
// never runs unbidden — the surface's toggle/door decides when (user:
// "perhaps we toggle this one as this could be very burdensome").
//
// THE ONE THING THIS ORGAN DECIDES, so it is not re-derived: a secondary
// account is a witness to WHERE a claim is stated, and the primary is a
// witness to the claim BEING STATED THERE — at an address. Neither is a
// claim about what is true: this ledger is the richest possible map of
// what claims are made about the truth, and by whom (user, 2026-09-03:
// "we are not making claims about what is objectively true, just making
// the richest possible hypergraph of what claims are about the truth").
// The two kinds are not summed —
// `standingOf` (kernel notes.js) keeps witness KINDS apart — and a note that
// only accounts state stays `single-witness` however many accounts repeat
// it, because accounts copy each other (Ladha's correlated witnesses;
// nesting.js's wall one register over: "papers report he said it" is not
// "sources confirm it").
//
// WHAT IT REUSES, never rebuilds: primary.js's extractCitations /
// rankPrimary (claim overlap counted, a declared class ladder, the page's
// own order as tiebreak — no weights) / snipClaim (every sentence of a
// fetched face stating the claim's words, offsets self-verified, P5.2),
// pointed at LEDGER NOTES instead of proof-tier claims, landed through the
// door's own `attest` — the same landing the witness tier uses.
//
// THIS MODULE OWNS NO NETWORK. `fetchFace(url, archiveUrl)` and
// `search(query)` are injected — the crossing belongs to whoever holds
// P13's consent (explore-server.mjs, or an eval driver that keeps every face
// content-addressed so the run reproduces offline). A failed fetch is a
// typed gap on the consulted list, never a dropped candidate; a face with no
// text is `beyond-reach`, never "the source is silent".
//
// THE CONTROL this organ ships with (II.23), AND WHAT IT DECIDED: snipClaim
// is a CONTAINMENT test and cannot tell a real note from a fabricated one
// whose words co-occur. Measured live (eval/the-fold/ranke-walk.mjs,
// 2026-09-03, 605 notes off two real pages, 18 primary faces read): the
// real ledger's containment hits were 1, the REDEALT ledger's (end2 rotated,
// same faces) were 6 — containment is not discriminated, so it may not
// land a witness. A containment hit is a LEAD to a sentence; the landing
// is the WITNESS TIER's (corroboration.js::witnessNote — the small model
// reads the primary face and says whether it states the note; the verdict
// is derived, never written). Without witness organs injected, Ranke
// reports its leads and lands nothing — disclosed as `unwitnessed` on every
// consulted entry, never a silent attest.
//
// Generality: universal in shape (any medium whose accounts cite their
// sources — a paper's bibliography, a report's data appendix, a review
// naming the recording); the two lead readers here are text/HTML adapters.

import { extractCitations, rankPrimary, snipClaim, isWikiFamilyHost, unwrapArchiveUrl, PRIMARY_SOURCES_CONSULTED, PRIMARY_SNIPS_KEPT } from "./primary.js";
import { hostOf } from "./web.js";
import { CLAIM_STOPWORDS, wordSet, hasWord } from "./grounding.js";
import { sourceOfWitness, kindOfWitness } from "../kernel/notes.js";
import { witnessNote, distinctSources as sourcesOf, distinctRecipes as recipesOf } from "./corroboration.js";
import { claimRef, corroborationOf, leakCheck } from "./nesting.js";

export const RANKE = Object.freeze({
  name: "Ranke",
  after: "Leopold von Ranke — the account is judged by the document it stands on (Quellenkritik)",
  recipe: "ranke-v1",
});

/** The witness kind Ranke lands. Counted apart by kernel standingOf. */
export const PRIMARY_KIND = "primary";

// A quotation shorter than this is not findable — a search engine returns
// noise for three common words in quotation marks. Giver: none earned; a
// P4 debt named as such (the same class as ROWS_PER_CHUNK), never tuned
// against a result.
export const QUOTE_MIN_WORDS = 6;

const content = (s) => String(s ?? "").toLowerCase().split(/[^\p{L}\p{N}'’]+/u).map((w) => w.replace(/['’]s$/, "")).filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w));

// ── the claim a note makes ──────────────────────────────────────────────────
/**
 * A ledger note as the claim shape primary.js's walk judges: the content
 * words of BOTH ends (never the label — a label is the reader's own
 * arrangement word and a primary source rarely repeats it; the ends are
 * what the world calls the things). A note whose ends carry no content
 * word yields no claim (typed null).
 */
export function claimOfNote(note) {
  const end1 = String(note?.end1 ?? note?.subject ?? "");
  const end2 = String(note?.end2 ?? note?.object ?? "");
  const label = String(note?.label ?? note?.verb ?? "");
  const tokens = [...new Set([...content(end1), ...content(end2)])];
  if (!tokens.length) return null;
  return { kind: "name", text: `${end1} ${label} ${end2}`.trim(), tokens, sentence: `${end1} ${label} ${end2}` };
}

// A catalogue page is not the document. Some hosts serve the document's
// own text at an address the catalogue address determines — Internet
// Archive's full-text face for a `details/<id>` item lives at
// `stream/<id>/<id>_djvu.txt` (giver: archive.org's own djvu.txt endpoint,
// used as documented; measured live 2026-09-03: the cited `details` page
// read as a 5,961-char catalogue record with none of the book's prose).
// One declared table, extensible by the caller; never a scrape of a
// site's layout — an address rule, not a format rule.
export const FULL_TEXT_FACES = Object.freeze([
  { host: /(^|\.)archive\.org$/i, re: /\/details\/([^/?#]+)/, face: (id) => `https://archive.org/stream/${id}/${id}_djvu.txt` },
]);
export function expandLead(cand, table = FULL_TEXT_FACES) {
  const out = [];
  for (const rule of table) {
    if (!rule.host.test(String(cand?.host ?? ""))) continue;
    const m = String(cand?.url ?? "").match(rule.re);
    if (m) out.push(rule.face(m[1]));
  }
  return out;
}

/** The witness string for a primary face: `primary:<host>#<start>-<end>~<recipe>` — kind declared, address into the face, recipe named (P68). */
export const primaryWitness = (host, snip, recipe = RANKE.recipe) => `${PRIMARY_KIND}:${host}#${snip.start}-${snip.end}~${recipe}`;

/** Is this note standing on ACCOUNTS only — every witness a citing page (by the injected predicate), none a primary? */
export function standsOnAccountsOnly(note, { isAccount }) {
  const ws = note?.witnesses ?? [];
  if (!ws.length) return false;
  return ws.every((w) => kindOfWitness(w) !== PRIMARY_KIND && isAccount(sourceOfWitness(w)));
}

/**
 * nestedStanding(note, { isAccount, distinctSources, distinctRecipes }) —
 * THE WALL, applied to what this organ already classifies (2026-09-23).
 *
 * standingOf (kernel notes.js) keeps witness KINDS apart in its `kinds`
 * breakdown, but its own `sources`/`standing` numbers SUM every kind
 * together: measured live, three different account-only witnesses (no
 * primary at all) fold to `standing: "corroborated"` — which directly
 * contradicts this file's own header two screens up ("a note that only
 * accounts state stays `single-witness` however many accounts repeat it,
 * because accounts copy each other"). That promise was prose, not code.
 *
 * This closes it by PROJECTING the note nesting.js's own way, rather than
 * inventing a second ad hoc kind-counter: witnesses the caller's
 * `isAccount` (the same predicate `standsOnAccountsOnly` already uses)
 * calls an account become an OUTER note per distinct account —
 * `<account> --states--> claim:<note.id>` — and everything else (a
 * `primary:` witness, or a non-account witness `isAccount` says no to)
 * stays the claim's OWN witness set. `corroborationOf` then reports
 * `direct` from the claim's own witnesses alone — 0 for an accounts-only
 * note, exactly what the header promised — and `attributed` as the
 * honest, separate count of how many places repeat it, never added in.
 * `leakCheck` is run on the same projection so the wall is checked, not
 * assumed, on live Ranke data. PURE: no engine import beyond nesting.js
 * and corroboration.js's own existing (source, recipe) readers.
 */
export function nestedStanding(note, { isAccount, distinctSources = sourcesOf, distinctRecipes = recipesOf } = {}) {
  if (typeof isAccount !== "function") throw new TypeError("nestedStanding: isAccount is the caller's declaration — the same predicate standsOnAccountsOnly takes, not nesting.js's vocabulary");
  const claimId = note?.id;
  const ownWs = [];
  const bySource = new Map();
  for (const w of note?.witnesses ?? []) {
    if (kindOfWitness(w) !== PRIMARY_KIND && isAccount(sourceOfWitness(w))) {
      const src = sourceOfWitness(w);
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src).push(w);
    } else {
      ownWs.push(w);
    }
  }
  const attributions = [...bySource.entries()].map(([src, aws]) => ({
    id: `attrib:${src}→${claimId}`, end1: src, label: "states", end2: claimRef(claimId), witnesses: aws,
  }));
  const ledger = ownWs.length ? [{ id: claimId, witnesses: ownWs }, ...attributions] : attributions;
  const corrob = corroborationOf(claimId, ledger, { distinctSources, distinctRecipes });
  const leak = leakCheck(claimId, ledger);
  return { ...corrob, leaked: leak.leaked, leakWitnesses: leak.witnesses };
}

// ── leads ───────────────────────────────────────────────────────────────────
/**
 * leadsOf(page) — what a page offers to chase, and the GATE.
 *   page: { html?, text?, host?, url? }
 * Returns { citing, links, quotes, refused? }:
 *   links  — outbound hyperlinks (not the page's own host, not the
 *            encyclopedia family), each { url, host, text, index, archiveUrl? }
 *   quotes — quotations in the text face of at least QUOTE_MIN_WORDS words
 *            that no link's own text carries — the UNSOURCED ones;
 *            each { text, start, end, words }
 *   citing — links.length > 0. When false, quotes is EMPTY and `refused`
 *            is `no_citations`: a page that cites nothing declares no
 *            sources, and its quotation marks are dialogue until proven
 *            otherwise. This is the gate that keeps a novel closed.
 */
export function leadsOf(page) {
  const html = String(page?.html ?? "");
  const self = String(page?.host ?? hostOf(page?.url ?? "") ?? "");
  const links = extractCitations(html).filter((c) => c.host && c.host !== self && !isWikiFamilyHost(c.host));
  if (!links.length) return { citing: false, links: [], quotes: [], refused: { type: "no_citations", detail: "the page links to no outside source; nothing to chase, and its quotation marks are not leads" } };
  const text = String(page?.text ?? "");
  const linkedText = wordSet(links.map((l) => l.text).join(" "));
  const quotes = [];
  for (const m of text.matchAll(/[“"]([^”"]{12,600})[”"]/g)) {
    const q = m[1].trim();
    // Prose only: a quotation that crosses a line break, carries an address,
    // a footnote arrow or bracketed apparatus is a reference-list fragment
    // the quote marks happened to bracket — measured live on the Austerlitz
    // page: «(as per Bodart), at 6,000 men.\n\n- ↑ Farwell (2001)» and two bare
    // URLs were "quotes" on the first run and every search on them was spent
    // for nothing.
    if (/[\n\r]|https?:\/\/|↑|\[\d|\bpp?\.\s*\d|\bISBN\b|\bvol\.\s*\d/i.test(q)) continue;
    if ((q.match(/\p{L}/gu) ?? []).length < q.length * 0.6) continue;
    const words = content(q);
    if (words.length < QUOTE_MIN_WORDS) continue;
    // a quote whose words already ride a citation's own text is sourced by that link
    if (words.length && words.every((w) => hasWord(linkedText, w))) continue;
    quotes.push({ text: q, start: m.index + 1, end: m.index + 1 + m[1].length, words });
  }
  return { citing: true, links, quotes };
}

// ── the footnote binding ──────────────────────────────────────────────────
const stripTags = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
/**
 * footnoteLeads(page) — number → the outbound links of the note that
 * number points at. A marker is a <sup> carrying an in-page anchor
 * (href="#id") whose visible text is a number; the note is the element
 * with that id, read to the end of its list item. Returns
 * { byNumber: Map<number, [{url, host, text}]>, markers, notes } — a page
 * with no such markers returns an empty map (its links are still leads
 * through leadsOf; they are just not bound to sentences).
 */
export function footnoteLeads(page) {
  const html = String(page?.html ?? "");
  const self = String(page?.host ?? hostOf(page?.url ?? "") ?? "");
  const byNumber = new Map();
  let markers = 0;
  const seen = new Set();
  for (const m of html.matchAll(/<sup\b[^>]*>([\s\S]{0,600}?)<\/sup\s*>/gi)) {
    const inner = m[1];
    const href = inner.match(/href="#([^"]+)"/);
    if (!href) continue;
    const num = Number((stripTags(inner).match(/\d+/) ?? [])[0]);
    if (!Number.isInteger(num)) continue;
    markers += 1;
    if (seen.has(href[1])) continue;
    seen.add(href[1]);
    const at = html.indexOf(`id="${href[1]}"`);
    if (at < 0) continue;
    const end = html.indexOf("</li", at);
    const block = html.slice(at, end > 0 ? Math.min(end, at + 8000) : at + 8000);
    const links = [];
    const text = stripTags(block).slice(0, 400);
    for (const a of block.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
      const raw = a[1].replace(/&amp;/g, "&");
      // an archive wrapper is the SAME source with a fallback address:
      // paired with its target (primary.js's own unwrapping), never a
      // second lead — the wrapper exists because the target was dying
      const wrapped = unwrapArchiveUrl(raw);
      const url = wrapped ? wrapped.target : raw;
      const host = hostOf(url);
      if (!host || host === self || isWikiFamilyHost(host)) continue;
      const prev = links.find((l) => l.url === url);
      if (prev) { if (wrapped && !prev.archiveUrl) prev.archiveUrl = wrapped.archive; continue; }
      links.push({ url, host, text, index: links.length, structuralClass: "other", overlap: 0, ...(wrapped ? { archiveUrl: wrapped.archive } : {}) });
    }
    if (links.length) byNumber.set(num, [...(byNumber.get(num) ?? []), ...links]);
  }
  return { byNumber, markers, notes: byNumber.size };
}
/** The footnote numbers a text span carries — "[ 139 ]" as the text face renders a marker. */
export const markersIn = (text) => [...String(text ?? "").matchAll(/\[\s*(\d{1,4})\s*\]/g)].map((m) => Number(m[1]));
/**
 * The footnote numbers that belong to a span. A marker follows the sentence
 * it cites, so one at the very START of a span (before any letter) is the
 * PREVIOUS sentence's — the text face renders "…surface.[139] At 02:51…"
 * and a sentence splitter hands "[139]" to the next sentence. Markers
 * inside the span are its own, and so are markers immediately AFTER it in
 * the passage (`after`: the text that follows the span), which is where
 * this sentence's own citation actually sits.
 */
export function markersOfSpan(spanText, after = "") {
  const own = String(spanText ?? "");
  const lead = own.match(/^\s*(?:\[\s*\d{1,4}\s*\]\s*)+/);
  const inside = markersIn(lead ? own.slice(lead[0].length) : own);
  const trailing = (String(after ?? "").match(/^\s*(?:\[\s*\d{1,4}\s*\]\s*)+/) ?? [""])[0];
  return [...new Set([...inside, ...markersIn(trailing)])];
}
/**
 * The links a note's own sentences bound, through the page's footnotes; []
 * when the note carries no marker or its note has no outbound link.
 * `afterOf(span)` (optional) returns the text that follows the span in its
 * passage, so the trailing marker — the sentence's own — is read.
 */
export function footnoteLeadsForNote(note, footnotes, { afterOf = null } = {}) {
  if (!footnotes?.byNumber?.size) return [];
  const out = [];
  for (const sp of note?.spans ?? []) {
    const after = afterOf ? afterOf(sp) : "";
    for (const n of markersOfSpan(sp?.text, after)) for (const l of footnotes.byNumber.get(n) ?? []) if (!out.some((x) => x.url === l.url)) out.push({ ...l, footnote: n });
  }
  return out;
}
/**
 * documentMatches(face, citationText) — is the fetched face the DOCUMENT the
 * citation names, or something the address now serves instead? Measured
 * backwards on Apollo 11: 31 of 62 fetched faces answered from a different
 * address, and every Apollo Lunar Surface Journal transcript the article
 * cites now redirects to one portal page. The check: at least a third of
 * the citation's own content words (its title, mostly) appear in the face.
 * A face that fails is `wrong-document`, and the chase reads the archive
 * copy instead — the citation's own archive wrapper when it carries one,
 * else the public archive's address for the target (an existing snapshot
 * read, never a Save Page Now — that is a different crossing).
 */
export function documentMatches(faceText, citationText) {
  const words = content(citationText).filter((w) => !/^\d+$/.test(w));
  if (words.length < 3) return { matches: null, reason: "citation_too_short" };
  const ws = wordSet(String(faceText ?? ""));
  const hit = words.filter((w) => hasWord(ws, w)).length;
  return { matches: hit * 3 >= words.length, hit, of: words.length };
}
export const archiveAddressFor = (url) => `https://web.archive.org/web/2/${url}`;

// ── one chase ───────────────────────────────────────────────────────────────
/**
 * chase(log, door, note, { leads, fetchFace, search, consult, recipe })
 * Rank the page's link leads for this note (rankPrimary); for quote leads
 * sharing a content word with the note, `search` the quote and take the
 * results as further candidates. Fetch sequentially up to `consult`, snip
 * each face for the note's words, attest the note with every stating face.
 *   fetchFace — async (url, archiveUrl) → { text, url, host, path } | { gap }
 *   search    — async (query) → [{ url, host?, title? }] (omit to skip quotes)
 * Returns { log, consulted:[{url, host, via, structuralClass?, snipsFound, snips|gap}], attested:[witness], claim, searched:[query] }.
 */
export async function chase(log, door, note, { leads, fetchFace, search = null, consult = PRIMARY_SOURCES_CONSULTED, recipe = RANKE.recipe, witness = null, footnotes = null, afterOf = null } = {}) {
  if (typeof fetchFace !== "function") throw new TypeError("ranke.chase: fetchFace is injected — this organ owns no network");
  const claim = claimOfNote(note);
  if (!claim) return { log, consulted: [], attested: [], searched: [], claim: null, refused: { type: "no_claim", detail: "the note's ends carry no content word to chase" } };
  if (!leads?.citing) return { log, consulted: [], attested: [], searched: [], claim, refused: leads?.refused ?? { type: "no_citations" } };
  // A link sharing no word with the claim is not a lead FOR THIS NOTE — the
  // same rule proposeCandidates already holds (`shared > 0`). Measured live
  // on the first walk: 178 of 318 consults were overlap-0 fetches of
  // whatever the page cited first, and the budget was gone before a lead
  // with a shared word was reached.
  // The note's OWN footnotes first — the source the page attached to this
  // sentence — then the page's links ranked by overlap, minus any already
  // bound. A footnote lead needs no shared word: the binding is the page's
  // own, not a guess from vocabulary.
  const bound = footnoteLeadsForNote(note, footnotes, { afterOf }).flatMap((c) => [{ ...c, via: "footnote" }, ...expandLead(c).map((u) => ({ ...c, url: u, via: "footnote:full-text", archiveUrl: null }))]);
  const ranked = rankPrimary(claim, leads.links).filter((c) => c.overlap > 0 && !bound.some((b) => b.url === c.url)).flatMap((c) => [{ ...c, via: "link" }, ...expandLead(c).map((u) => ({ ...c, url: u, via: "link:full-text", archiveUrl: null }))]);
  const candidates = [...bound, ...ranked];
  const searched = [];
  if (search && leads.quotes?.length) {
    const want = new Set(claim.tokens);
    const relevant = leads.quotes.filter((q) => q.words.some((w) => want.has(w)));
    for (const q of relevant) {
      const results = await search(q.text);
      searched.push(q.text);
      for (const r of results ?? []) {
        const host = r.host ?? hostOf(r.url);
        if (!r.url || !host || isWikiFamilyHost(host)) continue;
        if (candidates.some((c) => c.url === r.url)) continue;
        candidates.push({ url: r.url, host, text: `${r.title ?? ""} ${q.text}`, via: "quote", quote: q.text, structuralClass: "other", overlap: 0 });
      }
    }
  }
  const consulted = [];
  const attested = [];
  let next = log;
  for (const cand of candidates.slice(0, consult)) {
    const base = { url: cand.url, host: cand.host, via: cand.via, ...(cand.quote ? { quote: cand.quote } : {}), structuralClass: cand.structuralClass, overlap: cand.overlap, citation: cand.text || null };
    let got = await fetchFace(cand.url, cand.archiveUrl ?? null);
    if (!got || got.gap) { consulted.push({ ...base, gap: got?.gap ?? { type: "no_face" } }); continue; }
    if (got.text == null) { consulted.push({ ...base, gap: { type: "beyond-reach", detail: "no text face — snipping needs one" } }); continue; }
    // is this the cited document, or what the address serves now?
    let identity = cand.text ? documentMatches(got.text, cand.text) : { matches: null, reason: "no_citation_text" };
    let viaArchive = false;
    if (identity.matches === false) {
      const archive = cand.archiveUrl ?? archiveAddressFor(cand.url);
      const again = await fetchFace(archive, null);
      if (again && !again.gap && again.text) {
        const id2 = documentMatches(again.text, cand.text);
        if (id2.matches !== false) { got = again; identity = id2; viaArchive = true; }
        else { consulted.push({ ...base, host: got.host ?? cand.host, wrongDocument: identity, archiveTried: archive, gap: { type: "wrong-document", detail: `the address serves another document (${identity.hit}/${identity.of} title words) and so does its archive copy` } }); continue; }
      } else { consulted.push({ ...base, host: got.host ?? cand.host, wrongDocument: identity, archiveTried: archive, gap: { type: "wrong-document", detail: `the address serves another document (${identity.hit}/${identity.of} title words); no archive copy could be read` } }); continue; }
    }
    base.identity = identity; if (viaArchive) base.viaArchive = true;
    const host = got.host ?? cand.host ?? hostOf(got.url ?? cand.url);
    const snips = snipClaim(claim, got.text, { facePath: got.path ?? null, url: got.url ?? cand.url, host });
    const quoteFound = cand.quote ? snipClaim({ kind: "name", tokens: content(cand.quote), text: cand.quote }, got.text).length : null;
    const entry = { ...base, host, textChars: got.text.length, snipsFound: snips.length, snips: snips.slice(0, PRIMARY_SNIPS_KEPT), ...(quoteFound != null ? { quoteFound: quoteFound > 0 } : {}) };
    consulted.push(entry);
    if (!snips.length) continue;
    if (!witness) { entry.unwitnessed = true; continue; } // a lead, reported; nothing lands on containment alone
    // THE WITNESS reads the primary face where the lead points: the same
    // protocol the ledger walk uses (select over gathered sentences, the
    // same-index arm; generate as its own fallback), the verdict derived.
    const w = await witnessNote(claim.sentence, { ref: host, text: got.text }, { ...witness, ends: { end1: note.end1 ?? note.subject, end2: note.end2 ?? note.object }, slice: snips[0].text });
    entry.witness = w.refused ? { refused: w.refused } : { verdict: w.verdict, because: w.because ?? null };
    if (w.refused || w.verdict !== "states") continue;
    const at = w.because ? got.text.indexOf(w.because) : -1;
    const s = at >= 0 ? { start: at, end: at + w.because.length, text: w.because } : snips[0];
    const witnessId = primaryWitness(host, s, recipe);
    const r = door.attest(next, note.id, { witness: witnessId, span: { ref: host, at: `${host}#${s.start}-${s.end}`, text: s.text }, because: s.text });
    if (!r.refused) { next = r.log; attested.push(witnessId); }
  }
  return { log: next, consulted, attested, searched, claim };
}

// ── the walk over a ledger ──────────────────────────────────────────────────
/**
 * chaseLedger(log, door, pages, { fetchFace, search, maxFetches, maxSearches, isAccount, consult, recipe })
 *   pages — [{ ref, html, text?, host?, url? }] : the citing pages the
 *           ledger was read from, by the ref their witnesses carry
 *   isAccount(ref) — which refs are accounts to chase FROM (default: any
 *           page passed in that passes the gate — a page that cites)
 *   maxFetches / maxSearches — declared budgets (P9); faces are cached
 *           across notes so one source cited for many notes is read once
 * Walks every note standing on accounts only, most-witnessed first.
 * Returns { log, chased, fetches, searches, faces, pagesRefused, notesConsidered, notesAttested }.
 */
export async function chaseLedger(log, door, pages, { fetchFace, search = null, maxFetches, maxSearches = null, isAccount = null, consult = PRIMARY_SOURCES_CONSULTED, recipe = RANKE.recipe, witness = null, afterOf = null } = {}) {
  const footnotesByRef = new Map();
  const footnotesOf = (ref) => { if (!footnotesByRef.has(ref)) footnotesByRef.set(ref, footnoteLeads(byRef.get(ref) ?? {})); return footnotesByRef.get(ref); };
  if (!Number.isFinite(maxFetches)) throw new TypeError("ranke.chaseLedger: maxFetches is declared by the caller (P9)");
  if (search && !Number.isFinite(maxSearches)) throw new TypeError("ranke.chaseLedger: maxSearches is declared when a search organ is injected (P9)");
  const byRef = new Map((pages ?? []).map((p) => [p.ref, p]));
  const leadsByRef = new Map();
  const leads = (ref) => { if (!leadsByRef.has(ref)) leadsByRef.set(ref, leadsOf(byRef.get(ref) ?? {})); return leadsByRef.get(ref); };
  const pagesRefused = [];
  for (const p of pages ?? []) if (!leads(p.ref).citing) pagesRefused.push({ ref: p.ref, refused: leads(p.ref).refused });
  const account = isAccount ?? ((ref) => byRef.has(ref) && leads(ref).citing);
  const faces = new Map();
  let fetches = 0;
  let searches = 0;
  const cachedFetch = async (url, archiveUrl) => {
    if (faces.has(url)) return faces.get(url);
    if (fetches >= maxFetches) return { gap: { type: "budget", detail: `maxFetches ${maxFetches} spent` } };
    fetches += 1;
    const got = await fetchFace(url, archiveUrl);
    faces.set(url, got);
    return got;
  };
  const searchCache = new Map();
  const budgetedSearch = search
    ? async (q) => {
        if (searchCache.has(q)) return searchCache.get(q);
        if (searches >= maxSearches) return [];
        searches += 1;
        const r = (await search(q)) ?? [];
        searchCache.set(q, r);
        return r;
      }
    : null;
  let next = log;
  const chased = [];
  const notes = door.foldNotes(next).filter((n) => standsOnAccountsOnly(n, { isAccount: account }));
  for (const n of notes) {
    const refs = [...new Set((n.witnesses ?? []).map(sourceOfWitness))].filter((r) => byRef.has(r) && leads(r).citing);
    const merged = { citing: refs.length > 0, links: refs.flatMap((r) => leads(r).links), quotes: refs.flatMap((r) => leads(r).quotes) };
    const fn = { byNumber: new Map() };
    for (const ref of refs) for (const [k, v] of footnotesOf(ref).byNumber) fn.byNumber.set(k, [...(fn.byNumber.get(k) ?? []), ...v]);
    const r = await chase(next, door, n, { leads: merged, fetchFace: cachedFetch, search: budgetedSearch, consult, recipe, witness, footnotes: fn, afterOf });
    next = r.log;
    // THE WALL, on this chase's own outcome: the note's witnesses as they
    // stand after this chase (its own pre-chase witnesses plus whatever
    // `chase` just attested), projected through nestedStanding so `direct`
    // reports the primary-only corroboration nesting.js's wall licenses —
    // never accounts summed in — beside `attributed`, the honest count of
    // how many accounts repeat it. A caller that reads `direct` instead of
    // `attested.length` alone sees the accounts-copy-each-other gap closed.
    const finalWitnesses = [...new Set([...(n.witnesses ?? []), ...r.attested])];
    const nested = nestedStanding({ id: n.id, witnesses: finalWitnesses }, { isAccount: account });
    chased.push({ noteId: n.id, note: `${n.subject} —${n.verb}→ ${n.object}`, leads: { links: merged.links.length, quotes: merged.quotes.length }, searched: r.searched, consulted: r.consulted, attested: r.attested, nestedStanding: nested, ...(r.refused ? { refused: r.refused } : {}) });
    if (fetches >= maxFetches && r.consulted.length && r.consulted.every((c) => c.gap?.type === "budget")) break;
  }
  return {
    log: next, chased, fetches, searches, pagesRefused, witnessed: !!witness,
    leads: chased.reduce((a, c) => a + c.consulted.filter((x) => x.snipsFound > 0).length, 0),
    faces: [...faces.entries()].map(([url, f]) => ({ url, gap: f?.gap ?? null, chars: f?.text?.length ?? 0 })),
    notesConsidered: notes.length, notesAttested: chased.filter((c) => c.attested.length).length,
  };
}

// ── the address that answers for many documents is none of them ──────────
/**
 * redirectHubs(index) — from a face index ({ key: { url, finalUrl, ... } }),
 * the final addresses that MORE THAN ONE distinct cited path resolved to.
 * Measured backwards on Apollo 11 (2026-09-02): seventeen different Apollo
 * Lunar Surface Journal transcripts all answered from one portal page, six
 * NSSDCA pages from one status page, and every one passed documentMatches
 * because the portal's title carries the journal's name. One document
 * cannot be the resolution of two different citations; a final address
 * that is, is a hub, and a face read from it is not the document cited.
 * No threshold: two is the floor at which the claim "this is that document"
 * is refuted by the index itself.
 */
export const normalizedPath = (u) => {
  // an archive copy IS its target: any snapshot of one document, under any
  // timestamp and either scheme, is that document — never a sibling of it
  const m = String(u ?? "").match(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/i);
  if (m) { const t = normalizedPath(m[1]); return t ? `archive:${t}` : null; }
  try { const x = new URL(u); return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "").replace(/\.(html?|htm|shtml|cfm)$/i, "").replace(/\/index$/, "") || "/"}`; } catch { return null; }
};
export function redirectHubs(index) {
  const sources = new Map();
  for (const e of Object.values(index ?? {})) {
    if (!e || e.gap || !e.url || !e.finalUrl) continue;
    const a = normalizedPath(e.url), b = normalizedPath(e.finalUrl);
    if (!a || !b || a === b) continue;
    if (!sources.has(b)) sources.set(b, new Set());
    sources.get(b).add(a);
  }
  return new Set([...sources].filter(([, s]) => s.size >= 2).map(([b]) => b));
}
/** Did a redirect drop the cited document's own path segment? A typed doubt, not a verdict — the hub rule or an archive copy decides. */
export function pathLost(url, finalUrl) {
  const a = normalizedPath(url), b = normalizedPath(finalUrl);
  if (!a || !b || a === b) return false;
  const last = a.split("/").filter(Boolean).pop() ?? "";
  return b.split("/").length < a.split("/").length && !b.includes(last);
}

// ── chrome: what a host says on every page is not what any page says ─────
/**
 * chromeLines(texts) — the leading and trailing runs of lines that at least
 * two of the given faces share verbatim. On nasa.gov every face opened with
 * the same 156 navigation lines and closed with the same "Keep Exploring"
 * block; a token-overlap classifier read "Lunar Surface Technology" in that
 * menu as partial support for "descent to the lunar surface". Measured, not
 * listed: the chrome is whatever the host's own faces agree on, and a face
 * with no sibling has no chrome removed (typed: nothing to compare).
 */
export function chromeLines(texts) {
  const lines = (texts ?? []).map((t) => String(t ?? "").split("\n"));
  if (lines.length < 2) return { head: 0, tail: 0, headLines: [], tailLines: [] };
  const runs = (dir) => {
    // for each face, the longest prefix (or suffix) it shares with ANY other face
    let best = [];
    for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length; j += 1) {
      const A = dir > 0 ? lines[i] : [...lines[i]].reverse(), B = dir > 0 ? lines[j] : [...lines[j]].reverse();
      let n = 0; while (n < A.length && n < B.length && A[n] === B[n]) n += 1;
      if (n > best.length) best = A.slice(0, n);
    }
    return best;
  };
  const head = runs(1), tail = runs(-1).reverse();
  return { head: head.length, tail: tail.length, headLines: head, tailLines: tail };
}
/** stripChrome(text, siblings) — remove the lines `text` shares as a prefix/suffix with at least one sibling face of the same host. */
export function stripChrome(text, siblings) {
  const mine = String(text ?? "").split("\n");
  let head = 0, tail = 0;
  for (const s of siblings ?? []) {
    const other = String(s ?? "").split("\n");
    let n = 0; while (n < mine.length && n < other.length && mine[n] === other[n]) n += 1;
    head = Math.max(head, n);
    let m = 0; while (m < mine.length - n && m < other.length - n && mine[mine.length - 1 - m] === other[other.length - 1 - m]) m += 1;
    tail = Math.max(tail, m);
  }
  if (head + tail >= mine.length) return { text: "", head, tail };
  return { text: mine.slice(head, mine.length - tail).join("\n"), head, tail };
}
