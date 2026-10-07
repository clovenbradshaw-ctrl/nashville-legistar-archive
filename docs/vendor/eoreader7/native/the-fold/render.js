// render.js — block structure for model prose, without touching what the
// prose means or owns.
//
// THE CONTRACT (agreed with the session that owns app.js, 2026-08-16):
//
//   renderBlocksInto(container, text, decorateInline)
//
// - BLOCK structure only, parsed from plain text: headings (# / ## / ###),
//   unordered and ordered lists, blockquotes, paragraphs. NO fenced code and
//   NO tables — artifact.js extracts those before prose ever reaches here,
//   and a second handler would double-render them.
// - Every run of inline text is handed to decorateInline(chunk) → Node[],
//   and whatever it returns is appended verbatim. That callback is where the
//   app's own [name#a-b] address chips and attribution tags are built;
//   killing them by innerHTML-ing model text is the failure mode this file
//   is shaped to make impossible. This module never sets innerHTML and never
//   creates text nodes from model prose itself — the only elements it
//   creates are the block/emphasis wrappers.
// - Inline emphasis (**bold**, *italic*, `code`) is implemented by SPLITTING
//   the text and routing every piece through decorateInline; a bracketed
//   [address#12-34] is never split — emphasis markers inside brackets are
//   not markers (an address is an opaque token, not prose).
// - Dependency-free; the parsing core is pure so node --test can hold it
//   without a DOM (render.test.mjs).
//
// The container must be a flow container (a div, not a <p>): headings and
// lists inside a <p> are invalid HTML and the browser will silently
// relocate them.

// ── inline: emphasis spans, addresses kept whole ────────────────────────────

/** [start, end] index pairs of bracketed spans — inside them, nothing is a marker. */
function bracketSpans(s) {
  const spans = [];
  let i = 0;
  while ((i = s.indexOf("[", i)) !== -1) {
    const j = s.indexOf("]", i + 1);
    if (j === -1) break;
    spans.push([i, j]);
    i = j + 1;
  }
  return spans;
}

const insideAny = (spans, pos) => spans.some(([a, b]) => pos > a && pos < b);

/** First occurrence of `marker` at or after `from` that is not inside a bracket span. */
function findMarker(s, marker, from, spans) {
  let i = s.indexOf(marker, from);
  while (i !== -1 && insideAny(spans, i)) i = s.indexOf(marker, i + 1);
  return i;
}

/**
 * Pure inline parse: text → [{ text, marks }] in order, marks outermost
 * first (e.g. ["strong","em"]). Code spans are literal — no nested emphasis
 * inside them. Unmatched markers stay as ordinary characters.
 */
export function parseInline(text, marks = []) {
  const s = String(text ?? "");
  if (!s) return [];
  const spans = bracketSpans(s);

  // Marker priority: `code` first (its content is literal), then ** then *.
  for (const [marker, mark, literal] of [
    ["`", "code", true],
    ["**", "strong", false],
    ["*", "em", false],
  ]) {
    let open = findMarker(s, marker, 0, spans);
    while (open !== -1) {
      const close = findMarker(s, marker, open + marker.length, spans);
      if (close === -1) break;
      const inner = s.slice(open + marker.length, close);
      // Emphasis must hug its content ("a * b * c" stays as written; "*b*"
      // does not) — code spans may keep their spaces. A '*' pair whose inner
      // starts or ends with '*' is really a '**' that the single-star pass
      // must not shadow.
      const hugs = literal ? inner.trim().length > 0 : inner.length > 0 && !/^\s/.test(inner) && !/\s$/.test(inner);
      if (hugs && !(marker === "*" && (inner.startsWith("*") || inner.endsWith("*")))) {
        return [
          ...parseInline(s.slice(0, open), marks),
          ...(literal ? [{ text: inner, marks: [...marks, mark] }] : parseInline(inner, [...marks, mark])),
          ...parseInline(s.slice(close + marker.length), marks),
        ];
      }
      open = findMarker(s, marker, close + marker.length, spans);
    }
  }
  return [{ text: s, marks }];
}

// ── blocks: pure parse ──────────────────────────────────────────────────────

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*•]\s+(.*)$/;
const OL_RE = /^\d+[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

/**
 * Pure block parse: text → [{ type, ... }].
 *   { type: "heading", level: 1|2|3, text }
 *   { type: "list", ordered, items: [text] }
 *   { type: "quote", lines: [text] }
 *   { type: "para", lines: [text] }
 * Fenced code is deliberately not a case — see the contract above.
 */
export function parseBlocks(text) {
  const lines = String(text ?? "").split(/\r\n|\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    let m;
    if ((m = line.match(HEADING_RE))) {
      blocks.push({ type: "heading", level: m[1].length, text: m[2] });
      i++;
      continue;
    }
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const ordered = OL_RE.test(line);
      const re = ordered ? OL_RE : UL_RE;
      const items = [];
      while (i < lines.length && (m = lines[i].match(re))) {
        items.push(m[1]);
        i++;
        // An indented continuation line belongs to the item above it.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !lines[i].match(re)) {
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        }
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const quoteLines = [];
      while (i < lines.length && (m = lines[i].match(QUOTE_RE))) {
        quoteLines.push(m[1]);
        i++;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !HEADING_RE.test(lines[i]) && !UL_RE.test(lines[i]) && !OL_RE.test(lines[i]) && !QUOTE_RE.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "para", lines: para, verse: readsAsVerse(para) });
  }
  return blocks;
}

/**
 * VERSE KEEPS ITS LINES (2026-09-08, user: "format this better", on a poem
 * whose six lines had been joined into one paragraph). CommonMark's soft
 * break is right for prose an author wrapped at a column — those wraps land
 * mid-phrase ("and a workbench / is a speaker", the pinned case). A poem's
 * lines end where the poet ended them, and the tell is structural, not a
 * width: every line but the last closes on a punctuation mark. A wrapped
 * paragraph whose every wrap happens to land on punctuation would read as
 * verse too — a declared cost, rarer than a poem, and a hard break in prose
 * costs a line, where a soft break in verse costs the poem.
 */
const LINE_END_PUNCT = /[,.;:!?\u2014\u2013\u2026-]["'\u201d\u2019)]?\s*$/;
export function readsAsVerse(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return false;
  return lines.slice(0, -1).every((l) => LINE_END_PUNCT.test(l));
}

// ── DOM projection ──────────────────────────────────────────────────────────

/**
 * Append decorateInline's nodes for one inline text, wrapped in its emphasis
 * chain. `text` may span soft line breaks — emphasis opened on one line and
 * closed two lines later is one emphasis (measured on SEED-SPEAKER.md's own
 * epigraph, which rendered its ** literally when parsing ran per-line). The
 * newlines are re-split AFTER mark resolution: each segment gets its own
 * mark chain (visually continuous), with <br> between — so decorateInline
 * still receives newline-free chunks and addresses stay whole.
 */
function appendInline(doc, parent, text, decorateInline) {
  const TAG = { strong: "strong", em: "em", code: "code" };
  for (const part of parseInline(text)) {
    const segments = part.text.split("\n");
    segments.forEach((segment, s) => {
      if (s) parent.appendChild(doc.createElement("br"));
      if (!segment) return;
      const nodes = decorateInline(segment) ?? [];
      if (!part.marks.length) {
        for (const n of nodes) parent.appendChild(n);
        return;
      }
      let outer = null;
      let inner = null;
      for (const mark of part.marks) {
        const el = doc.createElement(TAG[mark]);
        if (inner) inner.appendChild(el);
        else outer = el;
        inner = el;
      }
      for (const n of nodes) inner.appendChild(n);
      parent.appendChild(outer);
    });
  }
}

/**
 * Render `text`'s block structure into `container`, routing every inline
 * text run through decorateInline(chunk) → Node[]. See the contract at the
 * top of this file. Headings map # → h3, ## → h4, ### → h5 (chat-scale,
 * styled by the page).
 */
export function renderBlocksInto(container, text, decorateInline) {
  const doc = container.ownerDocument ?? globalThis.document;
  for (const block of parseBlocks(text)) {
    if (block.type === "heading") {
      const h = doc.createElement(["h3", "h4", "h5"][block.level - 1]);
      appendInline(doc, h, block.text, decorateInline);
      container.appendChild(h);
    } else if (block.type === "list") {
      const list = doc.createElement(block.ordered ? "ol" : "ul");
      for (const item of block.items) {
        const li = doc.createElement("li");
        appendInline(doc, li, item, decorateInline);
        list.appendChild(li);
      }
      container.appendChild(list);
    } else if (block.type === "quote") {
      // A blockquote keeps its line structure — epigraphs and verse are
      // quoted precisely because their line breaks are theirs.
      const q = doc.createElement("blockquote");
      appendInline(doc, q, block.lines.join("\n"), decorateInline);
      container.appendChild(q);
    } else {
      // A paragraph's single newlines are soft breaks — authors wrap prose
      // at a column width; honoring every wrap as a hard break shatters the
      // paragraph (measured on SEED-SPEAKER.md: "and a workbench / is a
      // speaker"). CommonMark's rule: soft break renders as a space.
      // …unless the block reads as verse (`readsAsVerse`): then the newlines
      // are the author's own and appendInline renders each as <br>.
      const para = doc.createElement("div");
      para.className = block.verse ? "para verse" : "para";
      appendInline(doc, para, block.lines.join(block.verse ? "\n" : " "), decorateInline);
      container.appendChild(para);
    }
  }
}
