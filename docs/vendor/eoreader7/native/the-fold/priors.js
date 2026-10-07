// priors.js — the reference-library tier of the grounding ladder: a claim
// checked against live_priors, the curated local corpus that sits beside this
// repo (2,044 documents by its own README; 2,047 files, 183.4MB measured here
// 2026-08-17). This is the FREE tier — zero egress, no consent to spend, no
// crossing to record beyond the check itself — which is why a chip flow can
// afford to consult it before any web check and spend the P13 crossing only
// on what the library leaves unsettled.
//
// THE PROVENANCE RULE (user direction, 2026-08-17, verbatim: "as priors are
// referenced in the surf they need to carry provenance"). A prior cited in an
// answer is a citation like any other. Every document in a result therefore
// carries the publisher provenance the corpus itself keeps — the official
// source URL, publishing department, publication date, in-force status that
// 06-government-legal's frontmatter records — and every snip carries
// self-verified offsets into the file's own chars. A count with no addresses
// behind it would be knowledge from nowhere wearing a library card.
//
// THIS MODULE OWNS NO IO — web.js / primary.js discipline exactly: every
// function here maps bytes-already-read to structure. The directory walk,
// the head reads and the confinement to the corpus root live in
// explore-server.mjs (POST /api/priors/check).
//
// The organs are borrowed, never re-derived (P11 — one fold, shared):
// containment is grounding.js's own wordSet/hasWord/numberSet/hasNumber,
// which snipClaim (primary.js) already walks sentence by sentence with both
// sides through the same diacritic fold; this module imports snipClaim whole
// because its signature fits ({kind, text, tokens, sentence} against a text
// face, offsets self-verifying) and re-implementing the walk would be a
// second copy of "what states a claim" waiting to drift.

import { snipClaim, PRIMARY_SNIPS_KEPT } from "../organs/primary.js";
import { wordSet, hasWord, CLAIM_STOPWORDS } from "../organs/grounding.js";
import { stripContainer } from "../organs/source.js";

// ── declared numbers, each with its giver ───────────────────────────────────
// Budgets with names and duties (P9), never quality thresholds.
//
// PRIORS_DOCS_CONSULTED bounds one check's full-text sentence walk — a
// runaway backstop, because the corpus was measured (2026-08-17, this
// machine): listing 2,047 files is ~20ms and reading every byte ~1.1s, but
// the sentence walk over all 31M words is ~9s per claim, which is not an
// interactive check. So candidates are ordered mechanically (below) and the
// best few are read whole. 12 is an engineering starting point — giver: this
// file — roughly one screenful of document rows in a disclosure; the true
// candidate count always rides the result so the bound is visible, never
// silent. A PROPER index would be eoreader6 host ingestion of the corpus
// (createSession/admitChunked, then searchSpans returning {span_id,
// source_id, byte_start, byte_end, text} — the same address shape this
// repo's refs already use). At the engine's measured 8.4s per 3.3MB,
// admitting 183MB is a minutes-long one-time build whose persistence and
// staleness story this pass does not own; that index is named future work
// here rather than half-built.
export const PRIORS_DOCS_CONSULTED = 12;
// Snips carried per consulted document — giver: primary.js
// PRIMARY_SNIPS_KEPT and its reasoning (one screenful); snipsFound states
// the true count and the file on disk keeps every sentence.
export const PRIORS_SNIPS_KEPT = PRIMARY_SNIPS_KEPT;

// ── provenance frontmatter ──────────────────────────────────────────────────
// Tiny and tolerant, no YAML library. The corpus writes provenance in two
// faces, both read here, both with the offset shift carried so a snip still
// addresses the FILE's chars (source.js stripContainer's own discipline —
// the header is skipped, never renumbered):
//
//   fenced   — "---" fences around "key: value" lines, one per line.
//              06-government-legal/world-legislation/*: title, source (the
//              official URL), department, publication_date, status, …
//   unfenced — a leading header block closed by the first blank line: a bare
//              first line naming the document, then only "Key: Value" lines.
//              world-factbook ("The World Factbook — Algeria" / Region / GEC
//              code / Publisher), un-udhr (Language / Adopted / Publisher),
//              d2l chapters (Source / Rights). Recognition is strict — every
//              line after the first must be a labelled value and at least
//              one must exist — so a prose paragraph that merely contains a
//              colon is never mistaken for provenance.
//
// Values are passed through untouched apart from trimming and one layer of
// matching quotes (the fence syntax's own wrapping, not content). Lines that
// are not "key: value" inside a fenced block (nested lists, comments) are
// skipped, not fatal — tolerant means the odd exotic line costs one key,
// never the document.

// A label is a short run of word characters (the corpus's own longest are
// "GEC code" and "number_of_provisions") — a shape rule of the header
// grammar, not a detection threshold.
const KV_RE = /^([A-Za-z][A-Za-z0-9 _/()-]{0,47}):[ \t]+(\S.*)$/;

function kvOf(line) {
  const m = String(line).match(KV_RE);
  if (!m) return null;
  const value = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  return { key: m[1].trim(), value };
}

function metaGet(meta, ...names) {
  for (const want of names) {
    for (const k of Object.keys(meta ?? {})) {
      if (k.toLowerCase() === want && meta[k]) return meta[k];
    }
  }
  return null;
}

/**
 * { meta, offset, title }: the provenance keys as the file wrote them, the
 * char offset where the body begins (0 when the file opens with no header),
 * and the document's own name — the fenced `title:` key, or the unfenced
 * header's bare first line. Slicing the raw string at `offset` yields the
 * body whose snip offsets, shifted back by `offset`, address the file.
 */
export function parseFrontmatter(raw) {
  const s = String(raw ?? "");

  // face 1: fenced
  const fence = s.match(/^---[ \t]*\r?\n/);
  if (fence) {
    const rest = s.slice(fence[0].length);
    const close = rest.match(/(?:^|\r?\n)---[ \t]*(?:\r?\n|$)/);
    if (close) {
      const meta = {};
      for (const line of rest.slice(0, close.index).split(/\r?\n/)) {
        const kv = kvOf(line);
        if (kv) meta[kv.key] = kv.value;
      }
      return { meta, offset: fence[0].length + close.index + close[0].length, title: metaGet(meta, "title") };
    }
  }

  // face 2: unfenced leading header block
  const blank = s.match(/\r?\n[ \t]*\r?\n/);
  if (blank) {
    const lines = s.slice(0, blank.index).split(/\r?\n/);
    if (lines.length >= 2) {
      const tail = lines.slice(1).map(kvOf);
      if (tail.every(Boolean)) {
        const meta = {};
        const first = kvOf(lines[0]);
        if (first) meta[first.key] = first.value;
        for (const kv of tail) meta[kv.key] = kv.value;
        const title = first ? metaGet(meta, "title") : lines[0].trim();
        // The bare first line is the document naming itself; carried into
        // the meta only where no title key already exists, so provenance
        // reads "The World Factbook — Algeria" without inventing a key the
        // file actually wrote.
        if (title && !metaGet(meta, "title")) meta.title = title;
        return { meta, offset: blank.index + blank[0].length, title };
      }
    }
  }

  return { meta: {}, offset: 0, title: null };
}

/** The top-level directory name — live_priors's own category convention
 * ("06-government-legal" from "06-government-legal/world-legislation/…"). */
export function categoryOf(relPath) {
  return String(relPath ?? "").split("/")[0] || null;
}

/**
 * The source object a result carries: EVERYTHING the header wrote, passed
 * through untouched, plus three canonical aliases (url / publisher / date)
 * filled from the corpus's own key names where the file did not use those
 * names itself — mechanical key mapping, never content interpretation:
 *   url       — `url`, else `source` when it is an http(s) address (the
 *               world-legislation files keep the official URL under
 *               `source`), else `source_url`.
 *   publisher — `publisher`, else `department` (the German files name only
 *               the ministry).
 *   date      — `date`, else `publication_date` (legislation), else
 *               `adopted` (un-udhr).
 * An existing key is never clobbered: `source.url` present in the file
 * survives byte-for-byte.
 */
export function provenanceOf(meta) {
  const source = { ...(meta ?? {}) };
  const urlish = (v) => (typeof v === "string" && /^https?:\/\//i.test(v) ? v : null);
  if (!urlish(source.url)) {
    const u = urlish(metaGet(meta, "url")) ?? urlish(metaGet(meta, "source")) ?? urlish(metaGet(meta, "source_url"));
    if (u) source.url = u;
  }
  if (source.publisher == null) {
    const p = metaGet(meta, "publisher", "department");
    if (p) source.publisher = p;
  }
  if (source.date == null) {
    const d = metaGet(meta, "date", "publication_date", "adopted");
    if (d) source.date = d;
  }
  return source;
}

/**
 * One corpus file, loaded: { path, category, title, text, offset, source,
 * raw }. `text` is the body with the provenance header stripped AND — for
 * the Gutenberg literature the corpus carries whole — the container
 * boilerplate dropped by source.js's own stripContainer (P5.3: licence
 * prose is retrievable and citable if left in, and it is not the book).
 * Both strips carry their offset forward, composed, so `offset + i` in the
 * body addresses char `offset + i` of the file as it sits on disk. `raw`
 * rides so the check can run P5.2's mandatory self-verification against the
 * file's own chars; it is for the checker, never for a response.
 */
export function readPriorDocument(relPath, raw) {
  const s = String(raw ?? "");
  const { meta, offset: headerOffset, title } = parseFrontmatter(s);
  const container = stripContainer(s.slice(headerOffset));
  return {
    path: relPath,
    category: categoryOf(relPath),
    title,
    text: container.text,
    offset: headerOffset + container.offset,
    source: provenanceOf(meta),
    raw: s,
  };
}

// ── the check ───────────────────────────────────────────────────────────────
/**
 * One claim against one loaded document. The sentence walk and the
 * containment are snipClaim's (primary.js — grounding.js's wordSet/hasWord
 * for names, numberSet/hasNumber for figures, both sides through the one
 * fold); this function's own work is the address discipline: each snip's
 * offsets are shifted from body space into FILE space and re-verified
 * against the file's own chars (P5.2 — the shift invalidated snipClaim's
 * internal guard, so the guard runs again in the coordinates that ship; an
 * address that does not reproduce its text is dropped, never shipped).
 *
 * Result: { path, category, title, stating, snipsFound, snips, source } —
 * snips capped at PRIORS_SNIPS_KEPT with snipsFound stating the truth. A
 * document that never states the claim is { stating: false, snips: [] } — a
 * result, not an error (P4: gaps are results).
 */
export function checkPrior(claim, doc) {
  if (typeof doc?.raw !== "string") {
    throw new TypeError("checkPrior needs the document as readPriorDocument built it — raw rides for offset self-verification");
  }
  const snips = [];
  for (const s of snipClaim(claim, doc.text, { facePath: doc.path })) {
    const start = s.start + doc.offset;
    const end = s.end + doc.offset;
    if (doc.raw.slice(start, end) !== s.text) continue;
    snips.push({ text: s.text, start, end });
  }
  return {
    path: doc.path,
    category: doc.category,
    title: doc.title ?? null,
    stating: snips.length > 0,
    snipsFound: snips.length,
    snips: snips.slice(0, PRIORS_SNIPS_KEPT),
    source: doc.source ?? {},
  };
}

// ── candidate selection ─────────────────────────────────────────────────────
// The claim's nature declares which shelves answer first. Figures and names
// are claims about the WORLD, and the reference shelves — encyclopedic, then
// government (the order the direction named them in), then scholarship and
// news — answer those before testimony and imaginative literature: a novel
// states what its world holds, not what the world does. The ladder is an
// ORDERING, never a score (primary.js PRIMARY_CLASSES' discipline); its
// whole authority is its position in the lexicographic sort below, AFTER
// the overlap count. A category the corpus grows later falls after the
// ladder, then path order — never excluded.
export const REFERENCE_LADDER = [
  "02-encyclopedic",
  "06-government-legal",
  "05-academic-papers",
  "08-news-current",
  "09-source-code",
  "07-images-media",
  "10-audio-music",
  "11-multi-language",
  "01-literature-books",
  "15-western-canon",
  "14-holy-texts",
];

/** The seam where a different claim nature would declare a different
 * shelf order. Every claim kind this repo checks today (figures, names,
 * relation edges) is a claim about the world, so one ladder serves; a
 * future nature (a claim about scripture, about a codebase) would return
 * its own ordering HERE, declared, never scored. */
export function categoryLadderFor() {
  return REFERENCE_LADDER;
}

/**
 * Order the corpus listing for a claim — rankPrimary's discipline carried
 * over (its `want` construction reproduced here because it is internal to
 * primary.js, which this pass may not edit; giver named): overlap of the
 * claim's own words with the document's FILENAME + TITLE is a count
 * (argmax, no threshold, P4), membership through grounding.js's one fold on
 * both sides (P11). Entries sharing no word with the claim are absent from
 * the ranking, not ranked low — source.js retrieve's own rule ("a chunk
 * that shares none is simply absent"), which is also what keeps the check
 * from reading twelve arbitrary documents about nothing. Full lexicographic
 * order: overlap desc, then the claim's category ladder, then path order.
 *
 * `entries` is the corpus listing: [{ path, title }], path relative to the
 * corpus root. Returns the entries that share a word, ordered, each with
 * its overlap count and category attached.
 */
export function rankPriorCandidates(claim, entries) {
  // rankPrimary's want set, verbatim discipline: sentence words + tokens,
  // short words and stopwords out, possessives folded.
  const want = new Set(
    [
      ...String(claim?.sentence ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}'’]+/u)
        .map((w) => w.replace(/['’]s$/, "")),
      ...(claim?.tokens ?? []).map((t) => String(t).toLowerCase()),
    ].filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)),
  );
  const ladder = categoryLadderFor(claim);
  const scored = [];
  for (const e of entries ?? []) {
    const p = String(e?.path ?? "");
    if (!p) continue;
    // The filename minus its extension — "africa_ag" should not owe a match
    // to "txt" — beside the document's own title.
    const base = (p.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const face = wordSet(`${base} ${e?.title ?? ""}`);
    let overlap = 0;
    for (const w of want) if (hasWord(face, w)) overlap++;
    if (!overlap) continue;
    const cat = categoryOf(p);
    const rung = ladder.indexOf(cat);
    scored.push({ entry: e, overlap, cat, rung: rung === -1 ? ladder.length : rung });
  }
  scored.sort(
    (a, b) =>
      b.overlap - a.overlap ||
      a.rung - b.rung ||
      (a.entry.path < b.entry.path ? -1 : a.entry.path > b.entry.path ? 1 : 0),
  );
  return scored.map((x) => ({ ...x.entry, overlap: x.overlap, category: x.cat }));
}

// ── the fold ────────────────────────────────────────────────────────────────
/**
 * The check's answer, typed and phrased in counted natural frequencies —
 * proof.js/primary.js posture: never "true", never "confirmed", never
 * stronger than what was counted. This is the shape the claim ledger's
 * "priors" aspect carries (claims.js reads `consulted` and `stating` as
 * numbers; `documents` is the provenance the projection may open).
 *
 * `documents` may carry gapped rows — a candidate the walk saw but the read
 * lost (moved, no longer UTF-8; explore-server.mjs's own `{..., gap: {...}}`
 * shape). Those never count as consulted: a gap is inherited, never derived
 * through (FOLD-CONSTITUTION IV.3) — the same discipline proof.js/primary.js
 * already apply to a failed web fetch (their `failed` list, kept apart from
 * `read`).
 *
 * `independence` counts DISTINCT WORKS among the stating documents — by
 * title, falling back to path when a document carries none — because this
 * corpus shelves hundreds of same-work files under one label (516 UDHR
 * translations, every one titled "Universal Declaration of Human Rights"):
 * N copies of one document are one perspective, not N (POLICIES P12), the
 * same discipline proof.js/primary.js apply to distinct hosts. The `basis`
 * names what independence is NOT tested against, same as its siblings.
 *
 * Verdicts:
 *   stated-by-library     — at least one consulted document states the
 *                           claim; the snips are the addresses.
 *   unstated-by-consulted — documents were read and none states it. NOT
 *                           falsity: the counted fact is "0 of N read".
 *   not-consulted         — candidates existed but every attempted read
 *                           failed (moved files, non-UTF-8) — a gap, not a
 *                           verdict about content.
 *   no-candidates         — no document's name or title shares the claim's
 *                           words; nothing was read. A gap in the shelf.
 */
export function foldPriors(claim, { candidates = 0, documents = [] } = {}) {
  const read = documents.filter((d) => d && !d.gap);
  const failed = documents.filter((d) => d && d.gap);
  const stating = read.filter((d) => d?.stating);
  const consulted = read.length;
  const works = new Set(stating.map((d) => d.title ?? d.path)).size;
  const verdict = stating.length ? "stated-by-library" : consulted ? "unstated-by-consulted" : candidates > 0 ? "not-consulted" : "no-candidates";
  const rankNote =
    candidates > documents.length
      ? `; ${candidates} document(s) shared the claim's words (ranked by overlap, ties broken by category then file path) and the first ${documents.length} were read (PRIORS_DOCS_CONSULTED)`
      : "";
  const failedNote = failed.length ? `; ${failed.length} could not be read, counted separately` : "";
  const sentence =
    verdict === "no-candidates"
      ? "no document's name or title shares the claim's words — a gap in the shelf, not a verdict"
      : verdict === "not-consulted"
        ? `${candidates} document(s) shared the claim's words; none of the ${failed.length} attempted could be read — a gap, not a verdict`
        : `the reference library: ${stating.length} of ${consulted} document(s) consulted state it` +
          (stating.length
            ? ` (${works} distinct work(s) — documents sharing an identical title count once)`
            : " — a library that does not state a claim is a result, never a refutation") +
          rankNote +
          failedNote;
  return {
    verdict,
    claim: claim?.text ?? null,
    kind: claim?.kind ?? null,
    candidates,
    consulted,
    failed: failed.length,
    stating: stating.length,
    independence: {
      works,
      basis: "distinct titles among the corpus's own documents; two differently-titled documents may still trace to one upstream work, which is not tested",
    },
    documents,
    sentence,
  };
}
