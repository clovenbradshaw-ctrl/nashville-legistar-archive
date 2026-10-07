// relative-pattern.js — the third thing two ways of addressing make.
//
// The Ground: bytes, and absolute addresses into them (`name#start-end`),
// which re-open exactly or fail exactly (record-log.js resolveAddress, II.3).
// The Figure: what a cue pulls out of the state field (relative.js — the
// keyless memory in three tiers: the holograph, the shadow, the echo). It is
// never exact and never nothing — it degrades, and it says by how much.
// Ground casts; the holograph holds; the shadow and echo follow; this file
// is the pattern that measures the light.
// The Pattern: the correspondence between them, which neither has alone.
//
//   drift(at, note, sources)   does the ground address still name the bytes
//                              the note was made from? Exact match, a shift
//                              (the same bytes elsewhere in the source), a
//                              renamed source, or bytes that are simply gone.
//   reanchor(at, note, field, sources)
//                              when the ground address is broken, recall the
//                              figure from the note's own words, find its
//                              bytes in whatever sources exist now, and mint
//                              the address anew — a Pattern act, recorded as
//                              such, never silently rewriting the record.
//
// Everything here is measured against the same null the field uses: a
// re-anchoring that lands inside the null band is a typed gap, not a repair.

import { resolveAddress } from "./record-log.js";
import { tokensOf, isWord } from "./relative.js";

/** Where `needle` sits in `hay`, or -1; exact first, then whitespace-loose. */
function findBytes(hay, needle) {
  if (!needle) return { start: -1, end: -1 };
  let at = hay.indexOf(needle);
  if (at >= 0) return { start: at, end: at + needle.length };
  // whitespace-insensitive: the same words in the same order
  const words = needle.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return { start: -1, end: -1 };
  const m = new RegExp(words.join("\\s+")).exec(hay);
  return m ? { start: m.index, end: m.index + m[0].length } : { start: -1, end: -1 };
}

/**
 * The ground, checked against the figure it was made from. `note` is the
 * text the address was minted for. Returns one of:
 *   { kind: "exact" }                       the bytes are where the address says
 *   { kind: "shifted", at, start, end }     the same bytes, elsewhere in the source
 *   { kind: "moved", at, source, start, end } the same bytes, in another source
 *   { kind: "gone", gap }                   nowhere any loaded source holds them
 */
export function drift(at, note, sources) {
  const r = resolveAddress(at, sources);
  if (r.ok && r.text === note) return { kind: "exact", at };
  const m = String(at ?? "").match(/^(.+?)#(\d+)-(\d+)$/);
  const name = m?.[1] ?? null;
  if (name && typeof sources?.[name] === "string") {
    const hit = findBytes(sources[name], note);
    if (hit.start >= 0) return { kind: "shifted", at: `${name}#${hit.start}-${hit.end}`, source: name, start: hit.start, end: hit.end, was: at };
  }
  for (const [other, text] of Object.entries(sources ?? {})) {
    if (other === name || typeof text !== "string") continue;
    const hit = findBytes(text, note);
    if (hit.start >= 0) return { kind: "moved", at: `${other}#${hit.start}-${hit.end}`, source: other, start: hit.start, end: hit.end, was: at };
  }
  return { kind: "gone", was: at, gap: r.ok ? { type: "address_names_other_bytes", at, detail: "the address resolves, but to bytes that are not the note's" } : r.gap };
}

/**
 * Mint a ground address from a figure. The cue is the note's own words (or a
 * fragment of them — this is what a brain does with a partial memory); the
 * field settles; the settled node's payload names a source and its bytes
 * are searched for. Returns the new address, or a typed gap when the field
 * settled on nothing, on more than one figure, or on bytes no source holds.
 */
export function reanchor(cue, field, sources, { band = null, draws = 120 } = {}) {
  const r = field.recallAgainstNull(cue, { band, draws });
  if (r.kind !== "figure") return { ok: false, kind: r.kind, gap: { type: r.kind === "ambiguous" ? "figure_ambiguous" : "figure_absent", detail: r.kind === "ambiguous" ? `the field settled on two figures ${r.top.activation.toFixed(3)} and ${r.second.activation.toFixed(3)}, closer than chance separates (${r.band.margin.toFixed(3)})` : `nothing in the field rises above what a cue of this length pulls out by chance (${r.band.hi.toFixed(3)})` }, band: r.band };
  const node = r.top.node;
  const want = node.payload?.source ?? null;
  const order = want ? [want, ...Object.keys(sources ?? {}).filter((k) => k !== want)] : Object.keys(sources ?? {});
  for (const name of order) {
    const text = sources?.[name]; if (typeof text !== "string") continue;
    const hit = findBytes(text, node.text);
    if (hit.start >= 0) return { ok: true, at: `${name}#${hit.start}-${hit.end}`, source: name, start: hit.start, end: hit.end, node, activation: r.top.activation, band: r.band };
  }
  return { ok: false, kind: "unheld", gap: { type: "figure_unheld", detail: "the field recalled a figure whose bytes no loaded source holds" }, node, band: r.band };
}

/**
 * The whole triad on one address: the ground checked, the figure recalled,
 * and the pattern between them — agree, repaired, or apart. This is the act
 * that belongs on the record: a Pattern over a Ground and a Figure.
 */
export function correspond(at, note, field, sources, opts) {
  const g = drift(at, note, sources);
  const f = reanchor(note, field, sources, opts);
  if (g.kind === "exact" && f.ok && f.at === at) return { kind: "agree", at, ground: g, figure: f };
  if (g.kind === "exact" && !f.ok) return { kind: "ground-only", at, ground: g, figure: f };
  if (g.kind !== "exact" && f.ok) return { kind: "repaired", at: f.at, was: at, ground: g, figure: f };
  if (g.kind !== "exact" && g.kind !== "gone" && !f.ok) return { kind: "ground-shifted", at: g.at, was: at, ground: g, figure: f };
  return { kind: "apart", at: null, was: at, ground: g, figure: f };
}

/** Words of a text between two fractions of its length: a partial memory. */
export function fragmentOf(text, from = 0, to = 1) {
  const words = tokensOf(text).filter(isWord);
  const a = Math.floor(words.length * from), b = Math.max(a + 1, Math.floor(words.length * to));
  return words.slice(a, b).join(" ");
}
