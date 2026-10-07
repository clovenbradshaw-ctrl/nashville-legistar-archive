// adapters/code/encounters.js — tractable encounters for a GIANT CODE HUNK.
//
// WHY THIS EXISTS (measured, not imagined): `textEncounters` segments prose by
// sentence (`spans.js::splitSentences`). A minified bundle is not prose: the
// bundler emits a handful of lines each holding hundreds of kilobytes
// (`splitSentences` found 174 "sentences" in the real 3.2 MB specimen that
// sent us here, and the largest was 1.8 MB). The recursive reader chokes on a
// 1.8 MB encounter the way a prose reader chokes on a sentence the size of a
// book. The fix is not to change the prose perceiver — it is that a code hunk
// is a DIFFERENT grain, and it needs its own segmentation: statement/line
// granular, capped, byte-anchored, never a monster.
//
// CONTRACT: `codeEncounters` returns exactly the `Encounter@1` schema
// `textEncounters` returns (`{ schema, source, modality, anchor, extent,
// material, sequencePosition }`), differing only in `modality: "code"`, so it
// drops into the SAME recursive-reader pipeline (`native/kernel/reading.js`,
// the read-recipe, the proxy's admission pass) with no other change. Anchors
// are character offsets into the normalized string handed in, matching
// `textEncounters`' own contract (CRLF is folded to LF first, exactly as
// `splitSentences` folds it; a caller that needs raw-file addresses applies
// `spans.js::normaliseNewlines` first and its `toRaw` when writing offsets
// down — the same law the prose channel already holds).
//
// DISCIPLINE: the cap is a hard guarantee, never a budget. Every encounter's
// `material` is at most `maxEncounterChars` long; a line over the cap is cut
// at real statement boundaries (`,` `;` `}` `)` `]` `>`), falling back to a
// whitespace boundary, falling back to a hard cut — so no caller can ever be
// handed the 1.8 MB sentence again. Splitting mid-identifier is allowed and
// disclosed by construction: these are ADMISSION units for a reading pipeline,
// not semantic units, and the perceiver reads them as what they are.

export const CODE_MAX_ENCOUNTER_CHARS = 16_000;

// The cheap structural test a caller uses to pick code encounters over prose
// encounters — never a language claim, only "is this shaped like a code hunk".
// Three independent signals, any of which is enough:
//   1. VERY LONG LINES — minified/bundled code averages hundreds of chars per
//      line; prose averages under a hundred. Measured on the specimen: 2588
//      lines in 3.2 MB ≈ 1236 chars/line.
//   2. BUNDLE MARKERS — the bundlers' own fingerprints (`__vite__`,
//      webpack chunk arrays, CommonJS `require(`), or JS module syntax
//      (`import … from "…"` / `export …`) at the file's own scale.
//   3. DENSE STATEMENTS — a high brace/semicolon density per 1000 chars on a
//      long-line file (a JSON blob has braces too, but not with this density
//      of semicolons).
//   4. PYTHON-SHAPED DEFINITIONS — line-anchored `def ` / `class ` /
//      `import ` / `from x import y` (received Python declaration syntax,
//      disclosed). A pure-Python file has short lines and no braces, so
//      signals 1–3 never fire and the organ wrongly refuses it as not-code
//      (measured: real 65 KB Flask app with 110 such lines → false; 200 KB
//      of prose → 0). The bar is three such lines plus call parens at twice
//      that count (a ratio test, not a fixed floor — a 10-line sample and
//      a 65 KB app both clear it), so prose mentioning "import" once
//      cannot pass.
export function isCodeHunk(text) {
  const t = String(text ?? "");
  if (!t) return false;
  const lineCount = t.split("\n").length;
  if (lineCount === 0) return false;
  const avgLine = t.length / lineCount;
  if (avgLine > 400) return true;
  if (/__vite__|webpackJsonp|webpackChunk|System\.register|require\s*\(|import\s*\{[^}]*\}\s*from\s*["']/m.test(t)) return true;
  const statements = (t.match(/[;{}]/g)?.length ?? 0);
  const density = (statements / t.length) * 1000;
  if (density > 20 && lineCount < t.length / 80) return true;
  const pyDefs = (t.match(/^[ \t]*(?:def |class |import |from \S+ import )/gm) ?? []).length;
  const pyParens = (t.match(/\(/g) ?? []).length;
  // ...plus at least one colon-terminated declaration header (found by
  // falsification: prose ABOUT code — "def poetry is not code at all",
  // "class struggle shapes history" — clears the line-shape bar and the
  // paren ratio, but never ends a declaration line with a colon).
  const pyHeader = /^[ \t]*(?:async\s+)?def\s+\S.*:\s*$|^[ \t]*class\s+\S.*:\s*$/m.test(t);
  if (pyDefs >= 3 && pyParens >= 2 * pyDefs && pyHeader) return true;
  return false;
}

// Cut `line` into pieces each at most `max` chars. A window at the end of the
// piece is searched BACKWARD for a statement boundary, preferring the
// strongest (`;` `,` `}`), then brackets/closers, then whitespace; only when
// none exists in the window is the cut hard. The cap is never exceeded.
function splitLongLine(line, max) {
  if (line.length <= max) return [line];
  const chunks = [];
  let rest = line;
  while (rest.length > max) {
    const lo = Math.floor(max * 0.55);
    const hi = max;
    let cut = -1;
    for (let i = hi - 1; i >= lo; i--) {
      const c = rest[i];
      if (c === ";" || c === "," || c === "}") { cut = i + 1; break; }
      if (c === ")" || c === "]" || c === ">" || c === "`") { if (cut === -1) cut = i + 1; }
    }
    if (cut === -1) {
      for (let i = hi - 1; i >= lo; i--) {
        if (/\s/.test(rest[i])) { cut = i + 1; break; }
      }
    }
    if (cut === -1) cut = hi;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

// The same trim-and-anchor discipline `spans.js::pushSentence` uses: leading
// whitespace is not material, so the anchor starts past it; empty material
// (blank lines) never becomes an encounter.
function pushEncounter(s, start, end, out, source, offset, order) {
  const raw = s.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return;
  const leading = raw.length - raw.trimStart().length;
  const at = offset + start + leading;
  out.push({
    schema: "Encounter@1",
    source,
    modality: "code",
    anchor: { start: at, end: at + trimmed.length },
    extent: trimmed.length,
    material: trimmed,
    sequencePosition: order,
  });
}

/**
 * codeEncounters(text, { source, offset, maxEncounterChars }) -> Encounter@1[]
 * One encounter per physical line, split at statement boundaries when a line
 * exceeds the cap. `offset` is added to every anchor, exactly like
 * `textEncounters`, so a caller reading a larger document can re-anchor.
 */
export function codeEncounters(text, { source = "code", offset = 0, maxEncounterChars = CODE_MAX_ENCOUNTER_CHARS } = {}) {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const encounters = [];
  let order = 0;
  let lineStart = 0;
  const lines = s.split("\n");
  for (const line of lines) {
    if (line.length > maxEncounterChars) {
      const chunks = splitLongLine(line, maxEncounterChars);
      let chunkStart = lineStart;
      for (const chunk of chunks) {
        pushEncounter(s, chunkStart, chunkStart + chunk.length, encounters, source, offset, order);
        order += 1;
        chunkStart += chunk.length;
      }
    } else {
      pushEncounter(s, lineStart, lineStart + line.length, encounters, source, offset, order);
      order += 1;
    }
    lineStart += line.length + 1;
  }
  return encounters;
}

/**
 * codeEncountersCompliance(text) — the self-check the conformance test runs:
 * no encounter exceeds the cap, offsets are monotonic and within bounds, and
 * every material round-trips to the source at its anchor.
 */
export function codeEncountersCompliance(text, { maxEncounterChars = CODE_MAX_ENCOUNTER_CHARS } = {}) {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const enc = codeEncounters(s, { source: "compliance", maxEncounterChars });
  const rows = [];
  let prevEnd = -1;
  for (const e of enc) {
    if (e.extent > maxEncounterChars) rows.push({ violation: "cap", seq: e.sequencePosition, extent: e.extent });
    if (e.anchor.start < prevEnd) rows.push({ violation: "overlap", seq: e.sequencePosition, start: e.anchor.start, prevEnd });
    if (e.anchor.start < 0 || e.anchor.end > s.length) rows.push({ violation: "bounds", seq: e.sequencePosition, start: e.anchor.start, end: e.anchor.end });
    if (s.slice(e.anchor.start, e.anchor.end) !== e.material) rows.push({ violation: "roundtrip", seq: e.sequencePosition });
    prevEnd = e.anchor.end;
  }
  return { encounters: enc.length, violations: rows };
}