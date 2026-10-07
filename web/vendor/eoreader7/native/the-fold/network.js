// network.js — CON at Pattern grain: bind a recurring arrangement as one
// system. The cell `moves.js` computed empty, occupied.
//
// WHAT THIS IS FOR. `relations` (CON·Figure, Link) reads one labelled edge
// between two ends — a connector with something on each side. That organ
// returned ZERO edges on this:
//
//     William Lamb The Viscount Melbourne
//     20 June 1837 – 30 August 1841
//
//     Sir Robert Peel
//     30 August 1841 – 29 June 1846
//
// Correctly, and permanently. There is no connector in any row. What relates
// these names to those extents is that the arrangement REPEATS — which is
// Pattern grain by definition, one step coarser than any Link-grain organ can
// reach. A wider verb vocabulary cannot help; this repo has already spent nine
// measured configurations establishing that (eval/results/
// mine-1-FINAL-COMPARISON.md), and a grain mismatch floors at zero rather than
// degrading, which is exactly what was measured.
//
// THE CUBE IS NOT ASKED WHAT THE TEXT IS. That is the refuted move (95.7% of
// cell assignments survived shuffling the words inside a paragraph). Nothing
// here reads meaning: lines are typed by SHAPE through injected recognizers,
// the recurrence is counted, and the system is bound or it is not.
//
// AND IT DOES NOT NAME WHAT BINDS THEM. The material shows that these things
// are arranged alike; it does not say the arrangement means "held this office"
// — that is nowhere in the bytes, and inventing it here would be the preset
// this repo already refused when it declined to write `P39` into wikidata.js.
// A bound system is returned with its instances and its spans, unlabelled. Who
// names the relation is a different question, answered by a different cell.
//
// GENERALITY IS THE WHOLE POINT, and it is structural rather than promised:
// the shape recognizers are INJECTED (the cast.js pattern). Give it a
// name-shape and a date-shape and it reads an office's holders; give it a
// version-shape and a date-shape and it reads a release history; give it a
// title-shape and a year-shape and it reads a discography. The organ does not
// change and does not know the difference.

/**
 * The recurrence floor. TWO, and structural rather than tuned: one instance is
 * not an arrangement, it is a coincidence — there is nothing for it to recur
 * WITH. Taken whole from `emergence/binding.js`'s own structural minimum, the
 * same floor `hl-acquire.js` already reuses and for the same stated reason.
 */
export const RECURRENCE_FLOOR = 2;

/** The longest cycle worth looking for. See `bindRecurring`'s own note. */
export const MAX_PERIOD = 4;

/**
 * How many preceding lines travel with a system as its context. A DISCLOSED
 * BOUND, not a measurement (P4): nothing here has measured how far above a
 * record block its declaring words sit, and a number that pretended otherwise
 * would be worse than one that says what it is. Widen it and a caller sees
 * more; nothing downstream breaks, because the caller already has to choose.
 */
export const CONTEXT_LINES = 4;

/**
 * A line that is nothing but one list-bullet character — Unicode's own
 * general-punctuation bullets alongside the plain ASCII markers a
 * readable-text extraction actually emits, never a closed list of sites.
 * Matched only when the WHOLE trimmed line is the marker, so a line that
 * starts with one and says more ("- John Nance Garner (1933–1941)") is
 * untouched and still typed on its own merits below.
 */
const BULLET_LINE_RE = /^[-*•‣◦·]$/;

/**
 * makeNetworkBinder({ shapes }) — `shapes` is an ordered list of
 * `{ name, read(line) }`. The FIRST whose `read` returns non-null types the
 * line, so order is precedence and the caller owns it. A line nothing reads is
 * typed `null` and can never take part in a system: an unrecognized line is a
 * gap in the recognizers, never a wildcard that lets a pattern through.
 */
export function makeNetworkBinder({ shapes = [] } = {}) {
  function typeLine(line) {
    for (const s of shapes) {
      const read = s.read(line);
      if (read != null) return { shape: s.name, read };
    }
    return null;
  }

  /**
   * bindRecurring(text, { ref, minInstances }) — every recurring arrangement
   * in the text, bound.
   *
   * Blank lines are dropped BEFORE the cycle is sought, because whitespace is
   * a rendering of the arrangement, not the arrangement — the same block with
   * single spacing is the same system, and a period that counted blanks would
   * say otherwise.
   *
   * Periods are tried shortest first, so a two-line record is not reported as
   * a degenerate four-line one. `MAX_PERIOD` is 4 rather than unbounded
   * because a cycle long enough to need more evidence than a page usually
   * offers cannot clear the floor anyway — stated as the disclosed bound it
   * is, not as a claim that longer arrangements do not exist.
   */
  function bindRecurring(text, { ref = null, minInstances = RECURRENCE_FLOOR } = {}) {
    const src = String(text ?? "");
    const lines = [];
    let at = 0;
    for (const raw of src.split("\n")) {
      const start = at;
      at += raw.length + 1;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      // A LONE BULLET MARKER IS RENDERING, NOT THE ARRANGEMENT — the exact
      // same reason a blank line is dropped above, one register over.
      // Found live, 2026-09-10: a real Wikipedia infobox renders its list
      // as "-\nJohn Nance Garner\n(1933–1941)\n\n-\nHenry A. Wallace\n
      // (1941–1945)" — the extracted page puts each bullet's "-" on its
      // OWN line, ahead of the name it introduces. Typed alone, a bare
      // "-" matches neither `extentShape` nor `surfaceShape` (there is no
      // date, and `extractSurfaces` finds nothing in one dash), so it
      // types `null` — a hole `bindRecurring`'s own header already says a
      // cycle may never be built over — and the whole three-member,
      // two-shape arrangement was refused for want of a punctuation mark
      // that names nothing. `BULLET_LINE_RE` is deliberately narrow: a
      // line that is NOTHING BUT one bullet character (never a line that
      // starts with one and says more, which stays real content for the
      // shapes below to type on their own merits).
      if (BULLET_LINE_RE.test(trimmed)) continue;
      const typed = typeLine(trimmed);
      // P5.2: the offset has to name the trimmed text's own first byte, so a
      // span sliced back out of the source reproduces the line exactly. The
      // first version wrote a needlessly clever `indexOf` whose argument could
      // be the empty string — which returns 0 and would have put every
      // indented line's start on its leading whitespace.
      const lead = raw.indexOf(trimmed);
      lines.push({
        text: trimmed,
        start: start + lead,
        end: start + lead + trimmed.length,
        shape: typed?.shape ?? null,
        read: typed?.read ?? null,
      });
    }

    const systems = [];
    let i = 0;
    while (i < lines.length) {
      let best = null;
      for (let p = 1; p <= MAX_PERIOD; p++) {
        // Every line of one candidate cycle has to be recognized; a null shape
        // is a hole and a system may not be built over one.
        if (i + p > lines.length) break;
        const cycle = lines.slice(i, i + p).map((l) => l.shape);
        if (cycle.some((s) => s == null)) continue;
        // A CYCLE OF ONE SHAPE BINDS NOTHING, and this is CON's own meaning
        // rather than a tuning choice: the operator RELATES, and a run of
        // like-typed lines has nothing to relate — a name followed by another
        // name is two names, not an arrangement. Run against a whole real
        // page without this rule, the binder returned 39 "systems", 37 of
        // them degenerate `[surface] × 2` — adjacent lines of one kind,
        // trivially "recurring". Two distinct shapes is the floor for an
        // arrangement to exist at all.
        if (new Set(cycle).size < 2) continue;
        let count = 0;
        while (
          i + (count + 1) * p <= lines.length &&
          lines.slice(i + count * p, i + (count + 1) * p).every((l, k) => l.shape === cycle[k])
        ) count++;
        if (count >= minInstances) { best = { period: p, count, cycle }; break; }
      }
      if (!best) { i++; continue; }
      const instances = [];
      for (let n = 0; n < best.count; n++) {
        const rows = lines.slice(i + n * best.period, i + (n + 1) * best.period);
        instances.push({
          rows: rows.map((r) => ({ shape: r.shape, text: r.text, read: r.read })),
          span: { ref, start: rows[0].start, end: rows[rows.length - 1].end, text: rows.map((r) => r.text).join("\n") },
        });
      }
      // THE LINE BEFORE, carried verbatim with its own span. Not a heading
      // detector and not a parse rule — this organ still refuses to say what
      // binds a system (see the header). It carries the source's own nearest
      // preceding words so a CALLER has something addressed to judge by.
      //
      // It is load-bearing: this page holds two `[surface → extent]` systems,
      // Britain's ten prime ministers and New Zealand's fifteen premiers, and
      // nothing in either ARRANGEMENT distinguishes them. Without the words
      // the document itself put above each one, a walk merges the two into a
      // single twenty-five-member list, which is what it did.
      // A WINDOW, NOT A GUESS AT THE HEADING. One preceding line is not
      // enough and the reason is instructive: on this page the line directly
      // above the ten prime ministers is "[ edit ]" — the rendering's own
      // furniture. The tempting repair is a furniture filter, which is
      // exactly the wiki-specific parsing this organ exists to avoid. So the
      // whole window comes back, each line addressed, and WHICH of them says
      // what the system is about is the caller's judgment, not this organ's.
      const context = lines
        .slice(Math.max(0, i - CONTEXT_LINES), i)
        .map((l) => ({ text: l.text, span: { ref, start: l.start, end: l.end } }));
      systems.push({ shape: best.cycle, instances, count: best.count, context });
      i += best.count * best.period;
    }
    return { systems, lines: lines.length };
  }

  return { typeLine, bindRecurring };
}

// ── shape recognizers ───────────────────────────────────────────────────────
//
// Supplied here because this repo needs them, NOT because the binder does.
// Each declares its giver; a caller with different material supplies its own
// and the binder is unchanged.

/**
 * The English month names in calendar order — a received closed class, given
 * by the proleptic Gregorian calendar itself. Shared with `wikidata.js` rather
 * than restated, so this instrument speaks one calendar.
 */
export const MONTHS = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);
export const MONTH_GIVER = Object.freeze({ of: "proleptic Gregorian calendar", language: "en" });

const MONTH_ALT = MONTHS.join("|");
// Three-letter month abbreviations, the same closed class one register
// abbreviated — "Jan", "Apr", never a second calendar.
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));
const MONTH_ABBR_ALT = MONTH_ABBR.join("|");
const monthAbbrIndex = (name) => MONTH_ABBR.findIndex((m) => m.toLowerCase() === String(name).slice(0, 3).toLowerCase());
/**
 * "Jan–Apr 1945" — a short tenure inside one calendar year, written with the
 * year stated once and shared by both ends rather than repeated on each
 * side. Found live, 2026-09-10: real Wikipedia infobox text for a vice
 * president who served under four months (Harry S. Truman, Jan 20 – Apr 12
 * 1945) — `RANGE_RE` requires each side to be a COMPLETE date on its own,
 * and a bare month name never is one, so this shape fell through as no
 * range at all, not merely an imprecise one. A separate pattern rather than
 * a `RANGE_RE` alternative — the shared trailing year has to be copied onto
 * BOTH ends, which is a different reading, not a wider version of the same
 * one.
 */
// Wrapped in the SAME allowed punctuation `extentShape`'s own residue check
// tolerates around a range ("(1933–1941)") — this pattern is anchored to
// the WHOLE line rather than searched-and-residue-checked like the main
// loop, so the tolerance has to be declared here instead of caught after.
const EDGE_PUNCT = "[\\s;,()·|]*";
const MONTH_RANGE_SHARED_YEAR_RE = new RegExp(`^${EDGE_PUNCT}(${MONTH_ABBR_ALT}|${MONTH_ALT})\\.?\\s*(?:[-–—]|to)\\s*(${MONTH_ABBR_ALT}|${MONTH_ALT})\\.?\\s+(\\d{4})${EDGE_PUNCT}$`, "i");
// Day-first ("20 June 1837") and month-first ("March 4, 1861") both occur in
// real material and neither is more correct; a reader that took only one would
// silently drop half the world's pages.
const DATE = `(?:\\d{1,2}\\s+(?:${MONTH_ALT})\\s+\\d{4}|(?:${MONTH_ALT})\\s+\\d{1,2},\\s*\\d{4}|\\d{4})`;
// Hyphen, en dash, em dash and the word "to" — the separators a range is
// actually written with, not a guess at one.
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:[-–—]|to)\\s*(${DATE})`, "gi");

const monthIndex = (name) => MONTHS.findIndex((m) => m.toLowerCase() === String(name).toLowerCase());

/** One date string to a sortable key, at whatever grain it was written. */
export function readDate(s) {
  const t = String(s ?? "").trim();
  let m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(t);
  if (m) return { year: +m[3], month: monthIndex(m[2]) + 1, day: +m[1], text: t };
  m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  if (m) return { year: +m[3], month: monthIndex(m[1]) + 1, day: +m[2], text: t };
  m = /^(\d{4})$/.exec(t);
  // A bare year states a year. Filling in a month and a day would be an
  // exactness the material declined to state — wikidata.js's own rule for
  // Wikidata's coarse precision, applied to prose.
  if (m) return { year: +m[1], month: null, day: null, text: t };
  return null;
}

/**
 * rangesIn(text) — every date range in a stretch of text, wherever it sits.
 *
 * `extentShape` requires a line to be NOTHING BUT extents, which is what stops
 * ordinary sentences joining an arrangement. This is the other half of the
 * same reading, for the case where a range is stated in prose: "monarch of the
 * United Kingdom … from 20 June 1837 until her death on 22 January 1901". The
 * exhaustiveness test is what differs, not the reading itself.
 */
export function rangesIn(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(RANGE_RE)) {
    const from = readDate(m[1]);
    const to = readDate(m[2]);
    if (from && to) out.push({ from, to, fromText: m[1], toText: m[2], at: m.index ?? null });
  }
  return out;
}

/**
 * A line that is ENTIRELY one or more extents, and nothing else. The
 * exhaustiveness matters: "he served from 1841 to 1846 with distinction" holds
 * a range and is prose, and typing it as an extent would let ordinary
 * sentences take part in an arrangement.
 */
export const extentShape = Object.freeze({
  name: "extent",
  read(line) {
    const t = String(line ?? "").trim();
    if (!t) return null;
    const ranges = [];
    let residue = t;
    for (const m of t.matchAll(RANGE_RE)) {
      const from = readDate(m[1]);
      const to = readDate(m[2]);
      if (!from || !to) return null;
      ranges.push({ from, to, fromText: m[1], toText: m[2] });
      residue = residue.replace(m[0], " ");
    }
    if (!ranges.length) {
      // The shared-year month range ("Jan–Apr 1945") is checked against the
      // WHOLE trimmed line, not folded into the loop above — see its own
      // note where it is declared.
      const shared = MONTH_RANGE_SHARED_YEAR_RE.exec(t);
      if (!shared) return null;
      const year = +shared[3];
      const fromM = monthAbbrIndex(shared[1]);
      const toM = monthAbbrIndex(shared[2]);
      if (fromM < 0 || toM < 0) return null;
      return [{
        from: { year, month: fromM + 1, day: null, text: `${shared[1]} ${year}` },
        to: { year, month: toM + 1, day: null, text: `${shared[2]} ${year}` },
        fromText: shared[1],
        toText: shared[2],
      }];
    }
    // Only separators may remain. Anything else means this line says more
    // than its dates, so it is not an extent line.
    if (/[^\s;,()·|]/.test(residue)) return null;
    return ranges;
  },
});

/**
 * A line that names something: it carries a surface and does not run on into
 * prose. `extractSurfaces` is the engine's own organ, injected — this file
 * never decides what a name looks like.
 *
 * The sentence-terminator veto is the L2 discipline in its usual place: a
 * capitalized run is used to FIND a candidate and then to veto it, never to
 * admit one on capitalization alone.
 */
export function surfaceShape({ extractSurfaces, isAbbreviationBoundary } = {}) {
  return Object.freeze({
    name: "surface",
    read(line) {
      const t = String(line ?? "").trim();
      if (!t) return null;
      // A period/!/? that closes a genuine SENTENCE means this line runs on
      // into prose, not a name — the veto this shape has always had. Found
      // live, 2026-09-10: a real Wikipedia infobox row, "Henry A. Wallace",
      // was rejected by that same veto for the identical reason this repo's
      // own founding "mouth is not censored" specimen was ("Harry S.
      // Truman") — a middle initial's period is not a sentence boundary.
      // `isAbbreviationBoundary(textEndingHere)` is the caller's own guard
      // for exactly that distinction (grounding.js's shared `ABBREV`, this
      // file's own standing rule: shape recognizers are supplied, never
      // imported) — omitted, every existing caller is byte-identical: the
      // check below fires on the FIRST period/!/? boundary found, same as
      // the bare regex it replaces.
      const re = /[.!?]+(?=\s|$)/g;
      let m;
      while ((m = re.exec(t))) {
        const before = t.slice(0, m.index + m[0].length);
        if (typeof isAbbreviationBoundary === "function" && isAbbreviationBoundary(before)) continue;
        return null;
      }
      // `extractSurfaces` reads SENTENCES — objects with `.text` — not a bare
      // string; passing the string ran it over the characters and threw.
      const found = extractSurfaces([{ text: t }]) ?? [];
      const surfaces = found.map((s) => (typeof s === "string" ? s : s?.text ?? s?.surface)).filter(Boolean);
      if (!surfaces.length) return null;
      return { surfaces, longest: surfaces.slice().sort((a, b) => b.length - a.length)[0] };
    },
  });
}
