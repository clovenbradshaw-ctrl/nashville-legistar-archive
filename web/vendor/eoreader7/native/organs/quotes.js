// quotes.js — a quotation is the source's bytes or it is not printed as one.
// Handle: Dai — after Dai Zhen's evidential scholarship: a quotation is verified back to its source or it is not printed as one. Amendment XVII.
//
// The class of fabrication this organ exists for is the worst one: words
// inside quotation marks that the material never wrote. A model asked to
// ground itself will QUOTE — and a quote is a stronger claim than a
// paraphrase, because the marks assert "these exact words are in the
// source." checkGrounding cannot see this (every token can be present
// while the wording is invented); attribution cannot see it (a drifted
// quote still overlaps its passage). Only following the quotation to the
// bytes can, and that is what this does, mechanically, no model in the
// loop (L5: a compliance-critical fact is never left to the model's own
// instruction-following — least of all the fact that a quotation is real).
//
// Three verdicts per quotation, and a repair:
//
//   verbatim  — the quoted words are the source's bytes (whitespace aside,
//               which is layout). The quote earns its chunk's address
//               inline — mechanical citation, cite.js's own posture — and
//               its precise anchor (`name#c0-c1`, char offsets in the
//               source, the app's own ref coordinate space) rides the
//               report for click-through.
//   drifted   — the quotation is FOUND under the shared fold (case,
//               accents, dashes forgiven for matching) but the bytes
//               differ. The repair is the backport: the answer's quoted
//               words are REWRITTEN to the source's own bytes before the
//               reader ever sees them, and the correction is disclosed.
//               "Helene said..." becomes "Hélène said..." because that is
//               what the material wrote.
//   unlocated — the quotation is nowhere in the material. It is treated as
//               what it is — a fabricated quotation — flagged on the
//               record's unsupported list, where it drives the same
//               bounded correction as an invented figure.
//   partial   — an ellipsis quotation whose SHOWN segments are not all in
//               the bytes: some located, at least one nowhere. Elision is
//               legitimate — a quotation may skip material — but every
//               segment it shows asserts "these exact words are in the
//               source," so one segment located nowhere makes the whole
//               quotation not verbatim, and fabricated. It is a finding,
//               not a disclosure: it drives the same bounded correction as
//               `unlocated`, naming WHICH segment failed, and it never
//               earns an inline address. The located half is not a warrant
//               for the invented half — that stamp was the false-warrant
//               class this module exists to refuse (audit 2026-08-16).
//
// Plus one disclosure status: `outside-offer` — the quotation IS real, but
// lives in a live chunk the turn was not offered. It is not invention and
// not support; it is the model quoting past its evidence, typed as an open
// entry, never silently endorsed with an address (checkCitations would
// rightly refuse a ref the turn was never given). Fabrication outranks it:
// a quotation holding both an unoffered segment and an invented one is
// `partial`, because a disclosure must never file an invention away as
// merely "quoted past your evidence."
//
// The lineage note: eochatX's citation-check carried "citation snippeting"
// and a "did you mean" corrector, left behind then as unearned complexity
// (grounding.js's own header records the decision). The handbook's byte-
// anchor pass earned it: run against a book that already carried footers
// claiming verbatim quotation, backporting found six real drifts. This is
// the same organ, running at answer time instead of audit time.
//
// Pure: no DOM, no IO, no model.

import { foldDiacritics } from "./source.js";
import { makeReproduction, EXACT } from "../kernel/reproduction.js";

// ── declared numbers ────────────────────────────────────────────────────────
// Below this many words a quoted span is not judged: a two-word "quote" is
// scare quotes or a term of art, and matching it anywhere proves nothing.
// Five is the smallest run that is a clause rather than a collocation — the
// same floor the handbook's anchor tool and holon's MIN_CONTENT_TOKENS
// class of numbers use for "enough to mean something." Not tuned.
export const MIN_QUOTE_WORDS = 5;

// How far past a quotation's closing mark an existing address still counts
// as "this quote is already cited" — one chip's width of characters. A
// bound on a courtesy (skip double-tagging), not on a check.
const CITED_LOOKAHEAD = 48;

const ADDRESS_NEAR = /^[\s]*\[[^\]\s]+#\d+-\d+\]/;

// ── one normalization, both sides of every comparison ───────────────────────
// The shared-fold law (P11): retrieval folds diacritics, so this must, or a
// quote of "Hélène" typed as "Helene" reads as invented. Typographic quote
// marks and dashes fold; ellipses unify; markdown emphasis marks vanish;
// whitespace collapses; case folds. `map[i]` walks a normalized index back
// to the character in the original that produced it.
const CHAR_FOLD = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...", " ": " ",
};

export function normalizedIndex(text) {
  let norm = "";
  const map = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = CHAR_FOLD[text[i]] ?? text[i];
    if (ch === "*" || ch === "_" || ch === "`") continue;
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      norm += " ";
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    for (const c of foldDiacritics(ch.toLowerCase())) {
      norm += c;
      map.push(i);
    }
  }
  while (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

const normOf = (s) => normalizedIndex(s).norm;

// The needle a segment is searched by: its words, with leading and trailing
// punctuation stripped — a quotation's final period is routinely the
// quoting sentence's, not the source's.
const needleOf = (s) => normOf(s).replace(/^[\s.,;:!?'"()-]+|[\s.,;:!?'"()-]+$/g, "");

// ── extraction: every quoted span, with its offsets ─────────────────────────

/**
 * Quoted spans in `text`, with the offsets of the content between the marks
 * and of the closing mark itself (where an address is appended). Curly
 * quotes pair by their own glyphs; straight quotes pair by position —
 * consecutive marks delimit a span (a lazy regex mis-pairs across line
 * breaks; measured in the handbook tool this is ported from). Spans whose
 * every ellipsis-split segment falls under MIN_QUOTE_WORDS are not judged.
 */
export function extractQuotedSpans(text, { minWords = MIN_QUOTE_WORDS } = {}) {
  const s = String(text ?? "");
  const spans = [];
  const push = (content, start, end, closeAt) => {
    const segments = content
      .split(/\.\.\.|…/)
      .map((x) => x.trim())
      .filter((x) => x.split(/\s+/).filter(Boolean).length >= minWords);
    if (!segments.length) return;
    spans.push({ content, segments, start, end, closeAt });
  };
  for (const m of s.matchAll(/“([^“”]+)”/g)) {
    push(m[1], m.index + 1, m.index + 1 + m[1].length, m.index + m[0].length - 1);
  }
  const marks = [];
  for (let i = s.indexOf('"'); i !== -1; i = s.indexOf('"', i + 1)) marks.push(i);
  for (let i = 0; i + 1 < marks.length; i += 2) {
    push(s.slice(marks[i] + 1, marks[i + 1]), marks[i] + 1, marks[i + 1], marks[i + 1]);
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

// ── location: a segment followed to the bytes of a chunk ────────────────────

const prepareChunks = (chunks) =>
  (chunks ?? [])
    .filter((c) => c && typeof c.text === "string")
    .map((c) => {
      const { norm, map } = normalizedIndex(c.text);
      return { chunk: c, norm, map };
    });

// Layout is not content: byte equality for the verbatim/drifted verdict is
// judged with whitespace runs collapsed and emphasis marks shed — the
// source file's line wrap and the answer's italics are typesetting.
const shedLayout = (s) => String(s).replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

// ONE IMPLEMENTATION OF "IS THIS REPRODUCED HERE". The search, the map back
// to the source's own coordinates, the P5.2 re-read check and the
// exact/folded verdict are `kernel/reproduction.js`'s — medium-blind, with
// this file's fold and this file's notion of raw sameness injected. What
// stays here is what is genuinely about QUOTATIONS: the edge-punctuation
// strip (`needleOf`), because a quotation's closing period is routinely the
// quoting sentence's rather than the source's, and that rule has no meaning
// for a score or an event stream.
const reproduction = makeReproduction({
  fold: normalizedIndex,
  sameRaw: (found, raw) => shedLayout(found) === shedLayout(raw).replace(/^[.,;:!?'"()-\s]+|[.,;:!?'"()-\s]+$/g, ""),
});

function locateSegment(prepared, segment) {
  const needle = needleOf(segment);
  if (!needle) return null;
  const bodies = prepared.map(({ chunk }) => ({ id: chunk.source ?? null, material: chunk.text, start: chunk.start ?? 0, chunk }));
  const hit = reproduction.locateFolded(needle, bodies, { raw: segment });
  if (hit.status === "absent") return null;
  const chunk = hit.chunk;
  return {
    text: segment,
    ref: chunk.ref ?? null,
    source: chunk.source ?? null,
    anchor: chunk.source != null ? hit.address : null,
    exact: shedLayout(hit.raw),
    drifted: hit.status !== EXACT,
  };
}

// ── the report ──────────────────────────────────────────────────────────────

/**
 * Every quotation in the answer, followed to the bytes.
 *
 * `offered` are the passages the turn was given — the only material a quote
 * may earn an inline address from. `pool` (optional) is the wider live
 * corpus: a quote absent from the offer but present in the pool is typed
 * `outside-offer` — real words, wrong warrant — instead of `unlocated`.
 *
 * Returns { examined, quotes } where each quote is
 *   { text, start, end, closeAt, status, segments, missingSegments,
 *     unlocatedSegments, alreadyCited }
 * and status ∈ verbatim | drifted | partial | outside-offer | unlocated.
 * `missingSegments` holds the shown segments that are in no material at
 * all — the words the reader has to be told about by name.
 */
export function verifyQuotes(answer, offered, { pool = null, minWords = MIN_QUOTE_WORDS } = {}) {
  const spans = extractQuotedSpans(answer, { minWords });
  if (!offered?.length || !spans.length) {
    return { examined: Boolean(offered?.length), quotes: spans.map((s) => ({ ...quoteShape(s), status: "unexamined" })) };
  }
  const preparedOffer = prepareChunks(offered);
  const offerRefs = new Set(offered.map((c) => c.ref));
  const preparedPool = pool?.length ? prepareChunks(pool.filter((c) => !offerRefs.has(c.ref))) : [];
  const s = String(answer ?? "");

  const quotes = spans.map((span) => {
    const located = [];
    const missing = [];
    let inPoolOnly = 0;
    for (const seg of span.segments) {
      const hit = locateSegment(preparedOffer, seg);
      if (hit) {
        located.push(hit);
        continue;
      }
      const poolHit = preparedPool.length ? locateSegment(preparedPool, seg) : null;
      if (poolHit) {
        located.push({ ...poolHit, outsideOffer: true });
        inPoolOnly++;
      } else missing.push(seg);
    }
    // Fabrication first, and nothing outranks it: a segment that is in no
    // material at all is invention, and invention decides the quotation's
    // verdict however much of the rest is real. Reading `inPoolOnly` first
    // filed such a quotation as a disclosure and lost the invention.
    let status;
    if (!located.length) status = "unlocated";
    else if (missing.length) status = "partial";
    else if (inPoolOnly) status = "outside-offer";
    else if (located.some((l) => l.drifted)) status = "drifted";
    else status = "verbatim";
    return {
      ...quoteShape(span),
      status,
      segments: located,
      missingSegments: missing,
      unlocatedSegments: missing.length,
      alreadyCited: ADDRESS_NEAR.test(s.slice(span.closeAt + 1, span.closeAt + 1 + CITED_LOOKAHEAD)),
    };
  });
  return { examined: true, quotes };
}

const quoteShape = (span) => ({
  text: span.content.trim().replace(/\s+/g, " "),
  start: span.start,
  end: span.end,
  closeAt: span.closeAt,
});

// ── the repair: drift backported, real quotes cited ─────────────────────────

/**
 * Rewrite the answer so that every located quotation carries the source's
 * own bytes, and every quotation located IN THE OFFER carries its chunk's
 * address. Returns { text, corrections, cited }.
 *
 * Idempotent by construction: a quote already byte-true is not touched, an
 * address already present is not doubled — running this twice is running
 * it once. `outside-offer` and `partial` quotes are backported (whatever
 * words are real should still be the source's bytes) but never given an
 * inline address: an address is a warrant, and neither material the turn
 * was not given nor a quotation half of which was invented has earned one.
 */
export function applyQuotes(answer, report) {
  let out = String(answer ?? "");
  const corrections = [];
  const cited = [];
  const jobs = (report?.quotes ?? [])
    .filter((q) => q.segments?.length)
    .sort((a, b) => b.start - a.start);
  for (const q of jobs) {
    let content = out.slice(q.start, q.end);
    // Rewrite drifted segments to the bytes, right to left inside the quote.
    const { norm, map } = normalizedIndex(content);
    const repls = [];
    let cursor = 0;
    for (const seg of q.segments) {
      const needle = needleOf(seg.text);
      const at = norm.indexOf(needle, cursor);
      if (at === -1) continue;
      cursor = at + needle.length;
      if (!seg.drifted) continue;
      const c0 = map[at];
      const c1 = map[at + needle.length - 1] + 1;
      // An inner double quotation mark would split the quote on re-read;
      // it becomes a single mark, the one declared transformation beyond
      // layout-shedding.
      const bytes = seg.exact.replace(/["“”]/g, "'");
      if (content.slice(c0, c1) !== bytes) {
        repls.push({ c0, c1, bytes, from: content.slice(c0, c1) });
      }
    }
    for (const r of repls.sort((a, b) => b.c0 - a.c0)) {
      corrections.push({ from: r.from, to: r.bytes, anchor: q.segments.find((s) => s.drifted)?.anchor ?? null });
      content = content.slice(0, r.c0) + r.bytes + content.slice(r.c1);
    }
    let replacement = content;
    let tail = "";
    // The address, appended after the closing mark — only for quotes whose
    // every SHOWN segment sits in the offer, and only when no address is
    // already there. The gate is a whitelist, not a blacklist: a warrant is
    // granted to the two verdicts that mean "the whole quotation is in the
    // offered bytes," never withheld from a list of known bad ones. The
    // blacklist form (`status !== "outside-offer"`) let `partial` through —
    // the located half handed its chunk address to a quotation whose other
    // half was invented — and would let any later status through too.
    const refs = [...new Set(q.segments.filter((s) => !s.outsideOffer && s.ref).map((s) => s.ref))];
    const wholeInOffer = q.status === "verbatim" || q.status === "drifted";
    if (refs.length && !q.alreadyCited && wholeInOffer) {
      tail = " " + refs.map((r) => `[${r}]`).join(" ");
      cited.push(...refs);
    }
    out = out.slice(0, q.start) + replacement + out.slice(q.end, q.closeAt + 1) + tail + out.slice(q.closeAt + 1);
  }
  return { text: out, corrections, cited: [...new Set(cited)] };
}

/** The findings for a record's unsupported list: fabricated quotations —
 * wholly (`unlocated`) or in part (`partial`). A partly fabricated
 * quotation is reported one line PER invented segment, naming the words
 * that are in no material, because "which segment failed" is the fact the
 * reader and the correction prompt can both act on. outside-offer is an
 * open entry (quoteOpens), not an accusation. */
export function quoteFindings(report) {
  return (report?.quotes ?? []).flatMap((q) => {
    if (q.status === "unlocated") return [`quotation not found in the material: “${clip(q.text)}”`];
    if (q.status === "partial")
      return (q.missingSegments ?? []).map(
        (seg) =>
          `quotation segment not found in the material: “${clip(seg)}” ` +
          `(shown inside the quotation “${clip(q.text)}”)`,
      );
    return [];
  });
}

/** Typed open entries: real quotations from material the turn was not
 * offered — the model quoting past its evidence. */
export function quoteOpens(report) {
  return (report?.quotes ?? [])
    .filter((q) => q.status === "outside-offer")
    .map((q) => {
      const a = q.segments.find((s) => s.anchor)?.anchor;
      return `quotation found outside the offered passages${a ? ` (${a})` : ""}: “${clip(q.text)}”`;
    });
}

const clip = (s) => {
  const words = String(s).split(/\s+/);
  return words.length <= 10 ? s : words.slice(0, 10).join(" ") + "…";
};
