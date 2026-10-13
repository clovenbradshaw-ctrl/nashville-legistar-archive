// span-drift.js — does a cited span still name the bytes it was cited for?
// Pure: no DOM, no IO, no model, no clock. The khora owns the ground and the addresses into it (`name#start-end`, record-log.js); this is
// the Pattern act over a cited span, generalizing relative-pattern.js's `drift` (GFP Pass 34) for the surfaces that cite — the chat's answer
// pipeline can say, before a citation is shown, whether the page it points at still holds the cited words where the address says.
// relative-pattern.js's `drift` is unchanged (reopen.js's `correspond` still runs it); this adds what a citation check needs and a reopen
// check does not: ambiguity said, a nearest-shift, and a floor under the text length.
//
//   sourceMap(sources)              → { name: text } from an object, a Map, or an array of { ref|name|source, text }
//   findAll(hay, needle)            → every place the words sit: exact occurrences, else the first whitespace-loose one
//   driftOf({ address, text }, sources, { minChars })
//                                   → { kind:"exact", at }                          the bytes are where the address says
//                                     { kind:"shifted", at, was, … }                the same bytes, elsewhere in the SAME source
//                                     { kind:"moved", at, source, was, … }          the same bytes, in ANOTHER source
//                                     { kind:"gone", was, gap }                     no loaded source holds them
//   driftAll(spans, sources, opts)  → { results, counts, stale }                    driftOf over many spans; `stale` = every span not exact
//
// The walls (each pinned in span-drift.test.mjs):
//   NEVER REWRITES — shifted and moved carry the NEW address beside the old (`was`); nothing here edits a span or a record. The caller
//     shows "re-anchored", never pretends the old address was always the new one.
//   MOVED IS NEVER GONE, GONE IS NEVER PAPERED OVER (spec P2) — `gone` carries a typed gap. `source_absent` (the page is not loaded now) is NOT
//     evidence the words are gone, only that this call cannot check: a caller must not read it as a refutation.
//   NO GUESS — ambiguity is said, not resolved silently. When the words occur more than once, `ambiguous: true` and `candidates` count them;
//     a shift picks the occurrence nearest the old start, a move picks the first loaded source in order, and both say so.
//   NO MODEL, NO SIMILARITY — exact bytes, then the same words in the same order across any whitespace (relative-pattern.js's own second
//     pass, kept so the two agree). Nothing fuzzy: a verdict is never "close enough".
//
// DECLARED, not measured (Constitution II.11): `MIN_RELOCATE_CHARS` — below it a text is in too many places to name one, so it can still be
// `exact` (the address names its bytes) but is never `shifted` or `moved`; it is `gone` with gap `too_short_to_relocate`, carrying the cause.
// Giver: the author, 2026-10-06. Not yet measured against real pages; a measured value replaces it in the record.
import { resolveAddress } from "./record-log.js";

export const MIN_RELOCATE_CHARS = 12;

const ADDRESS = /^(.+?)#(\d+)-(\d+)$/;

/** Sources as one { name: text } map. Non-string texts are dropped (a source that is not loaded is absent, never empty). */
export function sourceMap(sources) {
  const out = {};
  if (!sources) return out;
  const put = (k, v) => { if (k != null && typeof v === "string") out[String(k)] = v; };
  if (sources instanceof Map) { for (const [k, v] of sources) put(k, v); return out; }
  if (Array.isArray(sources)) { for (const s of sources) put(s?.ref ?? s?.name ?? s?.source, s?.text); return out; }
  if (typeof sources === "object") { for (const [k, v] of Object.entries(sources)) put(k, v); }
  return out;
}

const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every place `needle` sits in `hay`: all exact occurrences; only when there are none, the first whitespace-loose one. Empty = none. */
export function findAll(hay, needle) {
  if (!needle || typeof hay !== "string") return [];
  const hits = [];
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) hits.push({ start: at, end: at + needle.length });
  if (hits.length) return hits;
  const words = needle.trim().split(/\s+/).filter(Boolean).map(escapeRe);
  if (!words.length) return [];
  const m = new RegExp(words.join("\\s+")).exec(hay);
  return m ? [{ start: m.index, end: m.index + m[0].length }] : [];
}

const nearest = (hits, to) => hits.reduce((best, h) => (Math.abs(h.start - to) < Math.abs(best.start - to) ? h : best), hits[0]);

/**
 * The cited span, checked against the bytes it was cited for. `span` is `{ address, text }`: the address the citation carries and the words
 * it was minted for. `sources` is every page loaded now (see sourceMap for the accepted shapes).
 */
export function driftOf(span, sources, { minChars = MIN_RELOCATE_CHARS } = {}) {
  const at = span?.address ?? span?.at ?? null;
  const note = typeof span?.text === "string" ? span.text : "";
  const map = sourceMap(sources);
  const r = resolveAddress(at, map);
  if (r.ok && r.text === note) return { kind: "exact", at };
  const gap = r.ok ? { type: "address_names_other_bytes", at, detail: "the address resolves, but to bytes that are not the cited words" } : r.gap;
  if (note.trim().length < minChars) return { kind: "gone", was: at, gap: { type: "too_short_to_relocate", at, detail: `fewer than ${minChars} characters is in too many places to name one`, cause: gap } };
  const m = String(at ?? "").match(ADDRESS);
  const name = m?.[1] ?? null;
  if (name && typeof map[name] === "string") {
    const hits = findAll(map[name], note);
    if (hits.length) {
      const h = nearest(hits, Number(m[2]));
      return { kind: "shifted", at: `${name}#${h.start}-${h.end}`, source: name, start: h.start, end: h.end, was: at, candidates: hits.length, ambiguous: hits.length > 1 };
    }
  }
  const holders = [];
  for (const [other, text] of Object.entries(map)) {
    if (other === name) continue;
    const hits = findAll(text, note);
    if (hits.length) holders.push({ other, hit: hits[0], n: hits.length });
  }
  if (holders.length) {
    const { other, hit, n } = holders[0];
    return { kind: "moved", at: `${other}#${hit.start}-${hit.end}`, source: other, start: hit.start, end: hit.end, was: at, candidates: holders.length, ambiguous: holders.length > 1 || n > 1 };
  }
  return { kind: "gone", was: at, gap };
}

/** driftOf over many spans. `stale` lists every span whose verdict is not `exact`, in order, each with its span and verdict. */
export function driftAll(spans, sources, opts) {
  const map = sourceMap(sources);
  const results = (Array.isArray(spans) ? spans : []).map((span) => ({ span, drift: driftOf(span, map, opts) }));
  const counts = { exact: 0, shifted: 0, moved: 0, gone: 0 };
  for (const r of results) counts[r.drift.kind]++;
  return { results, counts, stale: results.filter((r) => r.drift.kind !== "exact") };
}
