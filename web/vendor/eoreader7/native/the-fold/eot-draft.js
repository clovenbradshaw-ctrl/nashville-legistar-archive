// eot-draft.js — THE EOT DRAFT: the whole piece as assertions, before prose.
//
// Stage four of the generation pipeline:
//
//   prompt → register → void → ground → EOT DRAFT → prosified pass → fold …
//
// The draft is the content of the piece with no sentence of its own yet. It
// is built RECURSIVELY along the material's own holarchy — whole, parts,
// points — and every node carries the exact bytes it came from, because the
// round trip from a language into assertions and back out is lossy and the
// provenance is what makes the loss checkable (user direction, 2026-09-21).
//
// The unit is the WITNESSED SPAN, not an extracted triple. Measured on the
// 25-sentence Cumberland ground: the relation readers produced 9 usable
// triples and 2 respectively, so a draft built from triples would silently
// drop most of what the material says. A span cannot be dropped by a reader
// that failed to parse it. GFP typing belongs on top of the span as
// annotation (pinned for later), never instead of it.
//
// THE LAW AT EVERY LEVEL. The material sets what is POSSIBLE: a node exists
// only where the material has bytes to put in it, and the recursion follows
// the writer's own seams (block breaks, then sentence ends) rather than a
// table. The ask sets what is PROBABLE: which of those nodes the piece draws
// on. A topic word that some parts carry and others do not is the ask
// choosing among them; a topic word every part carries chooses nothing.
//
// THE THREAD. Each part records its BRIDGE to the part before: a name the two
// share that is not the piece's subject. A bridge is a planned turn. A part
// with no bridge is recorded as such, which tells the prosified pass exactly
// where it has to write a transition of its own rather than discover it.
//
// Pure: no model, no I/O, deterministic. Every product is usable on its own —
// `draftLines` is a readable outline, `floorProjection` is the material's own
// sentences in the piece's order, and neither needs the mouth.

import { nameRuns } from "./referent-verify.js";
import { detectHardMeaning } from "../eval/lavar/hard-meaning.mjs";
// prose-prior.js (kernel/continuation.js's sedimented-prior machinery) was
// tried here and measured unreliable at real-block length -- see the note
// on isCodeDense below. Not imported; the module itself is kept, disclosed.

export const EOT_DRAFT_SCHEMA = "EOTDraft@1";

const STOP = new Set("the a an and or but of in on at for to from by with into onto it its is was are were be been being this that these those as than then so such not no nor also very just which who whom whose what when where why how there here their they them he she his her we our you your i me my".split(" "));
// A LIGHT STEM so an ask's "floods" meets the material's "flood" (measured:
// the ask "the floods and the dams" chose only the dams part). Plural and
// possessive only; English-scoped.
const stem = (w) => {
  let s = String(w).replace(/'s$/, "");
  if (s.length > 4 && s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us")) return s.slice(0, -1);
  return s;
};
const words = (x) => String(x ?? "").toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
// SENTENCES BY BOUNDARY, NEVER BY MATCHING BODIES (2026-09-21, measured on
// the Cumberland ground). The first splitter matched sentence bodies with
// /[^.!?]+[.!?]+/, which cannot cross a period, so "Dr. Thomas Walker" broke
// in two, "The U.S. Army Corps" lost "The U.S.", and "crested at 51.86 feet"
// failed to match at all — the whole 2010 flood sentence vanished from the
// draft. A draft that silently drops bytes defeats the reason for drafting
// from spans. This walks candidate boundaries instead, so every byte of the
// block lands in exactly one sentence, and a period is a boundary only when
// whitespace follows it and the token before it is not an initial or a short
// capitalised abbreviation standing before a name ("U.", "Dr. Thomas",
// "St. Louis"). A decimal is never a boundary: no whitespace follows its
// period. English-scoped, by the user's direction to chase English first.
const sentencesWithOffsets = (text, base) => {
  const out = [];
  const t = String(text);
  let start = 0;
  const push = (from, to) => {
    const raw = t.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body.length >= 3) out.push({ text: body, start: base + from + lead, end: base + from + lead + body.length });
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    const next = t[i + 1];
    if (next !== undefined && !/\s/.test(next)) continue;          // "51.86", "U.S."
    if (c === ".") {
      const tokStart = t.lastIndexOf(" ", i - 1) + 1;
      const tok = t.slice(tokStart, i).replace(/^[("']+/, "");
      const after = t.slice(i + 1).trimStart();
      const nextIsName = /^[A-Z]/.test(after);
      if (/^[A-Z]$/.test(tok)) continue;                                 // an initial: "U.", "T."
      if (/^(?:[A-Z]\.)+[A-Z]$/.test(tok)) continue;                    // "U.S" in "U.S."
      if (/^[A-Z][a-z]{1,2}$/.test(tok) && nextIsName) continue;         // "Dr. Thomas", "St. Louis"
      if (/^(?:[a-z]\.)+[a-z]$/.test(tok) && /^[a-z]/.test(after)) continue; // "4:00 p.m. in Committee Room" (OHS)
    }
    push(start, i + 1);
    start = i + 1;
  }
  push(start, t.length);
  return out.filter((x) => x.text.length >= 12);
};
const blocksWithOffsets = (text, base) => {
  const out = [];
  const re = /(?:^|\n\s*\n)([\s\S]*?)(?=\n\s*\n|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1] ?? "";
    const at = m.index + m[0].indexOf(raw);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim().replace(/^#+\s*/, "");
    const headingOnly = /^#/.test(raw.trim()) && !/[.!?]/.test(raw);
    // A short paragraph is still the material (2026-09-21: a 40-character
    // floor here silently dropped real paragraphs — the same byte loss the
    // boundary splitter exists to prevent). Only an empty block or a bare
    // heading is skipped, and a heading is recognised by its mark, not its length.
    if (!t || headingOnly) { if (m[0].length === 0) re.lastIndex++; continue; }
    out.push({ text: t, start: base + at + lead + (raw.trim().length - t.length), end: base + at + lead + raw.trim().length });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
};
export { words as draftWords, stem as draftStem };
// A sentence-initial "The" is a capital, not a name (2026-09-21, measured:
// every two sentences opening on "The" "shared a name", so Clark could never
// find an unearned transition and the draft listed "the" as pervasive).
export const namesOf = (text) => [...new Set(nameRuns(text).map((r) => r.join(" ").toLowerCase().replace(/^the /, "")))].filter((n) => n && !STOP.has(n));

/**
 * buildDraft({ task, ground, sourceId }) → the EOT draft tree.
 *
 * whole → parts (the material's block seams) → points (its sentences). A
 * ground with no block seams goes straight from whole to points: the
 * recursion stops where the material stops making distinctions.
 */
export function buildDraft({ task = "", ground = "", sourceId = "ground", sources = null } = {}) {
  const text = String(ground ?? "");
  const whole = { id: "whole", path: "whole", depth: 0, kind: "whole", span: { sourceId, start: 0, end: text.length }, children: [], names: [] };
  if (!text.trim()) return { schema: EOT_DRAFT_SCHEMA, task, sourceId, sources, root: whole, subject: [], basis: "no ground — nothing to draft from" };

  // PROVENANCE BY TIER (hunt.js, 2026-09-22): the ground is one string, so
  // every byte-offset consumer (the parser, the archons) sees it whole; the
  // `sources` map says which source and which tier each part's bytes came
  // from — the operator's material (tier 0) or what a fetched page earned.
  const sourceOf = (start) => (sources ?? []).find((m) => start >= m.start && start < m.end) ?? null;
  const rawBlocks = blocksWithOffsets(text, 0);
  // CODE-DENSE BLOCKS NEVER BECOME DRAFT FACTS (2026-09-24). A draft node is
  // meant to be prosified or floored as a sentence, and executable syntax is
  // neither: measured live the same day, refusing more of the mouth's chat
  // scaffolding on a code-only ground just pushed MORE statements to their
  // floor, and the floor of a code statement is broken, truncated syntax —
  // the deeper problem was never the mouth, it was code entering the draft
  // as if it were prose in the first place. Reuses hard-meaning.mjs's own
  // detector rather than a second, hand-typed code-detector — but measured
  // live on this exact file first, not assumed: notation_dense (its
  // letters-vs-punctuation ratio) never fires on well-commented JS, because
  // real identifiers and comments keep the LETTER count high even in a pure
  // function body (surf()'s own body measured ratio -0.72, threshold 3).
  // garbled_token (per-token symbol-vs-alnum count, >=3 such tokens) is what
  // actually discriminates here — measured silent on both real prose blocks
  // in this file and firing on both real code blocks, so it is the signal
  // used, not the one this comment first reached for. A ground that is
  // ENTIRELY code-dense (no prose blocks at all) keeps its original,
  // unfiltered blocks — a degraded draft is disclosed in this function's own
  // basis string below, never silently emptied.
  // A SECOND SIGNAL WAS TRIED AND MEASURED NEGATIVE (2026-09-25):
  // prose-prior.js (kernel/continuation.js's sedimented-prior machinery,
  // the same one proven on Bach) scores real prose against a real corpus's
  // length-matched ceiling. It correctly separated a handful of hand-picked
  // real prose/code examples, but on this project's own real
  // cumberland-ground.md fixture — genuine, well-composed prose, 45-60
  // words per block — 3 of 8 real prose blocks scored above the ceiling
  // and were wrongly excluded. At that length the gap between typical real
  // prose and the measured ceiling is thinner than the natural variance
  // between one real passage and another (Dracula's Victorian register vs.
  // modern expository prose), so the signal is not reliable enough to ship
  // here. Kept as a disclosed negative result (prose-prior.js still exists,
  // still correct on what it was tested against, just not trustworthy
  // enough at this length range for this default path) rather than shipped
  // and quietly degrading real runs — the same discipline
  // midi-continuation.mjs's own honest negative used.
  const isCodeDense = (blockText) => detectHardMeaning({ task: "ground block", texts: [{ text: blockText }] }).signals.some((s) => s.kind === "garbled_token");
  const proseBlocks = rawBlocks.filter((b) => !isCodeDense(b.text));
  const excludedCodeBlocks = rawBlocks.length - proseBlocks.length;
  const blocks = proseBlocks.length ? proseBlocks : rawBlocks;
  const parts = blocks.length >= 2 ? blocks : [{ text: text.trim(), start: text.indexOf(text.trim()), end: text.indexOf(text.trim()) + text.trim().length }];
  parts.forEach((b, i) => {
    const src = sourceOf(b.start);
    const part = { id: `p${i + 1}`, path: `whole/p${i + 1}`, depth: 1, kind: "part", text: b.text, span: { sourceId, start: b.start, end: b.end }, children: [], names: namesOf(b.text), words: [...new Set(words(b.text))], ...(src ? { source: src.id, tier: src.tier } : {}) };
    sentencesWithOffsets(text.slice(b.start, b.end), b.start).forEach((s, j) => {
      part.children.push({
        id: `p${i + 1}.${j + 1}`, path: `whole/p${i + 1}/${j + 1}`, depth: 2, kind: "point",
        text: s.text, span: { sourceId, start: s.start, end: s.end },
        names: namesOf(s.text), words: [...new Set(words(s.text))], children: [],
      });
    });
    whole.children.push(part);
  });

  // THE SUBJECT: names every part carries. They say what the whole is about
  // and cannot bridge one part to the next.
  const partNames = whole.children.map((p) => new Set(p.names));
  const subject = partNames.length ? [...partNames[0]].filter((n) => partNames.every((s) => s.has(n))) : [];
  // Soft subject: a name in most parts still distinguishes nothing useful as a
  // bridge. "Most" is measured, not chosen — present in more parts than not.
  const partCount = whole.children.length;
  const nameDf = new Map();
  for (const s of partNames) for (const n of s) nameDf.set(n, (nameDf.get(n) ?? 0) + 1);
  const pervasive = new Set([...nameDf.entries()].filter(([, d]) => d * 2 > partCount).map(([n]) => n));

  // THE ASK SELECTS: a topic word that some parts carry and others do not is a
  // choice; one every part carries (or none does) chooses nothing.
  // Only the ask's TOPIC PHRASE selects — what follows "on / about / of".
  // An ask with none ("Write a piece from this material.") selects nothing,
  // and a demonstrative phrase ("this material", "these sources") points at
  // the ground itself, never at a topic (falsifier, 2026-09-21: "material"
  // chose the one paragraph that said "radioactive material").
  const phrase = (String(task ?? "").match(/\b(?:on|about|of|regarding|concerning)\s+(.+?)[.?!]*$/i)?.[1] ?? "")
    .replace(/\b(this|these|that|those)\s+\S+/gi, " ");
  const topic = [...new Set(words(phrase))].filter((w) => !["write", "essay", "piece", "short", "long", "about", "role", "article", "report"].includes(w));
  const partHas = (p, w) => p.words.includes(w) || p.names.some((n) => n.split(" ").map(stem).includes(w));
  // The same measure the bridge uses: a word in MORE parts than not is the
  // subject, and the subject chooses nothing. Only a word held by at most half
  // the parts is the ask pointing at some of them.
  const choosing = topic.filter((w) => { const k = whole.children.filter((p) => partHas(p, w)).length; return k > 0 && !(k * 2 > partCount); });
  for (const p of whole.children) {
    const hits = topic.filter((w) => partHas(p, w));
    p.answers = hits;
    // When the ask chooses, a part holding ANY word of the ask is drawn: a word
    // in most parts chooses nothing, but the parts holding it still answer
    // the ask ("how the council responded" — measured: the council paragraphs
    // were dropped because "council" was in most of them).
    p.relevant = choosing.length ? hits.length > 0 : true;
  }

  // THE THREAD: in the material's own order, each part's bridge is a name it
  // shares with the part before that is not pervasive.
  let prev = null;
  for (const p of whole.children) {
    if (!p.relevant) { p.bridge = null; continue; }
    if (prev) {
      const shared = p.names.filter((n) => prev.names.includes(n) && !pervasive.has(n));
      p.bridge = shared.length ? { from: prev.id, name: shared[0] } : { from: prev.id, name: null };
    } else p.bridge = null;
    prev = p;
  }
  whole.names = subject;
  const drawn = whole.children.filter((p) => p.relevant);
  const points = drawn.reduce((s, p) => s + p.children.length, 0);
  const unbridged = drawn.filter((p) => p.bridge && !p.bridge.name).length;
  return {
    schema: EOT_DRAFT_SCHEMA, task, sourceId, sources, root: whole, subject, pervasive: [...pervasive], choosing,
    basis: `${whole.children.length} part(s) from ${blocks.length >= 2 ? "the material's own block seams" : "an unseamed ground"}${excludedCodeBlocks ? ` (${excludedCodeBlocks} code-dense block(s) excluded, garbled_token${proseBlocks.length === 0 ? " — ALL blocks were code-dense, so the exclusion was skipped and the raw blocks kept" : ""})` : ""}, ${drawn.length} drawn by the ask (${choosing.length ? `chosen by: ${choosing.join(", ")}` : "no topic word chooses among them — all drawn"}), ${points} point(s); ${unbridged} transition(s) have no shared name and must be written`,
  };
}

/** The draft as readable EOT lines: what the piece will say, in order, with
 *  the bytes each claim stands on. The work product of this stage. */
export function draftLines(draft) {
  const out = [];
  if (!draft?.root) return out;
  out.push(`subject: ${draft.subject.join(", ") || "(none shared by every part)"}`);
  for (const p of draft.root.children) {
    const bridge = p.bridge ? (p.bridge.name ? `  ← takes up "${p.bridge.name}" from ${p.bridge.from}` : `  ← no shared name with ${p.bridge.from}: a transition must be written`) : "";
    out.push(`${p.relevant ? "▸" : "·"} ${p.id} [${p.span.start}–${p.span.end}]${p.relevant ? "" : " not drawn by the ask"}${bridge}`);
    if (!p.relevant) continue;
    for (const pt of p.children) out.push(`    • ${pt.id} [${pt.span.start}–${pt.span.end}] ${pt.text}`);
  }
  return out;
}

/** The floor: the material's own sentences in the piece's order. True by
 *  construction, grounded by construction, and already a usable digest —
 *  this is what every later stage must beat, and what it falls back to. */
export function floorProjection(draft) {
  if (!draft?.root) return [];
  return draft.root.children.filter((p) => p.relevant).map((p) => p.children.map((pt) => pt.text).join(" "));
}

export function drawnParts(draft) {
  return (draft?.root?.children ?? []).filter((p) => p.relevant);
}
