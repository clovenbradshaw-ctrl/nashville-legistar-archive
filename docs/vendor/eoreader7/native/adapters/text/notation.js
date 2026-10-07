// adapters/text/notation.js — EO OPERATOR NOTATION, PARSED INTO THE EOT WIRE
// FORMAT. The user wanted to write EOT in the Polish-operator surface the
// notation page (wiki:eo-notation) specifies — `ε(Maria+, program−)` — rather
// than the JSONL ledger's structured fields. This parser makes that surface a
// real front-end: a notation line is the origin document, and every record it
// yields addresses the line by byte offsets exactly the way the reader's own
// observations address the source text (address-nesting, computed never
// declared).
//
// WHAT A NOTATION LINE IS, HERE. One line = one expression
//   operator(register?)(target(type?), operand(type?))
// where target/operand are either dot paths or nested expressions. The output
// is the ledger shape the reader already consumes — EOTObservation@1 records
// carrying the cell the operator resolves to (operator, grain, terrain,
// stance) and the ends as written. "The operator is carried by the surface
// syntax" stops being a slogan: `label` below is the operator token verbatim,
// and `operator` is recovered from it by the canonical glyph table, never
// inferred.
//
// THREE HONESTY RULES, CARRIED OVER FROM THE READER:
//  1. Unmarked ends do NOT resolve to a grain. The notation's core claim is
//     "an unmarked slot holds all three positions in implicit superposition —
//     it is not empty, it is full." The wire's single `grain` field cannot
//     carry that, so an expression whose ends carry no explicit type marker
//     yields NO grain claim and a `grain_gap` naming why. The reader's own
//     doctrine is identical ("a missing prior produces a typed gap, never a
//     guessed grain") — this parser is the notation's half of the same law.
//  2. Nothing is dropped silently. Register markers and ∥-superpositions are
//     not fields the reader consumes yet, so they ride on the record instead
//     of vanishing (`register`, `superposition`). A malformed line or a
//     trailing fragment becomes a diagnostic with a byte address, never a
//     swallowed fact.
//  3. Markers stay on the ends verbatim. `end1: "Maria+"` — the surface is
//     preserved exactly as written, matching the reader's "label as written"
//     discipline. The parser never rewrites what the author wrote.
//
// GRAMMAR (a subsection of wiki:eo-notation §12, made parseable):
//   expression := OPERATOR register? '(' arg (',' arg)? ')'
//   arg        := path type? | expression
//   path       := segment ('.' segment)*
//   segment    := '*' | '−' | '_' | ident ('∥' ident)?
//   OPERATOR   := three-letter code | practitioner glyph | greek
//   register/type := marker ('∥' marker)*      (marker := '+' | '−' | '*')
//   Disambiguation rule: a marker directly after an identifier (no dot) is the
//   ARGUMENT's ontological type (`Maria+`, `program−`). A marker that begins a
//   segment (after a dot) is that grain's construal (`customer.*.email`,
//   `customer.−.email`). `customer*` and `customer.*` are therefore different
//   expressions — typed end vs Pattern grain segment.
//
// NOTES, DISCLOSED:
//  - Ground is written `−` (U+2212) per the notation; ASCII `-` is accepted
//    as an alias. Because path identifiers are `[A-Za-z0-9_]` (the notation's
//    own convention, e.g. `funding_model`), a hyphenated name like `first-name`
//    will NOT parse as one identifier — write it `first_name`.
//  - Register attaches to the operator (its reflexive altitude). The reader
//    does not yet consume it; the parser surfaces it and says so.
//  - §2's "the unmarked form is not less — it is more" is the reason an
//    unmarked expression refuses a grain rather than defaulting to one. That
//    is a deliberate choice, not an omission; markers are what buy resolution.
//
// REVISION HISTORY
//  - v1.0: initial parser (2026-09-19). Polish surface -> EOTObservation@1.

import * as cube from "../../kernel/cube.js";
import { OPERATOR_GLYPHS, OPERATOR_GREEK } from "../../the-fold/surface/grounding-glyphs.mjs";

// ── THE ONE VOCABULARY, FROM THE CANON TABLES (never restated) ─────────────
const MARKER_TO_NAME = Object.freeze({
  "+": "Figure",
  "−": "Ground",
  "-": "Ground", // ASCII alias for U+2212, disclosed above
  "*": "Pattern",
});

const GLYPH_TO_CODE = Object.freeze(
  Object.fromEntries(Object.entries(OPERATOR_GLYPHS).map(([code, glyph]) => [glyph, code]))
);
const GREEK_TO_CODE = Object.freeze(
  Object.fromEntries(Object.entries(OPERATOR_GREEK).map(([code, greek]) => [greek, code]))
);
const THREE_LETTER = new Set(Object.keys(OPERATOR_GLYPHS));

// Identifiers are the notation's `[A-Za-z0-9_]` PLUS letters and numerals in
// any script — the notation's own worked examples name their ends 道 and 反.
// `−`/`∥` are math symbols, not letters, so the ground and superposition
// markers never collide with an identifier.
const isIdentChar = (ch) => ch === "_" || /[\p{L}\p{N}]/u.test(ch);
const isSegmentStart = (ch) => ch === "*" || ch === "−" || ch === "-" || ch === "_" || isIdentChar(ch);

/** The operator token at `i`, or null. Three-letter codes and single glyph /
 *  greek characters resolve through the canonical tables — the same table the
 *  fold surface renders with, so a glyph can never drift from its operator. */
function opCodeAt(line, i) {
  const ch = line[i];
  if (!ch) return null;
  if (ch >= "A" && ch <= "Z") {
    const word = line.slice(i, i + 3);
    if (THREE_LETTER.has(word)) return { surface: word, code: word, len: 3 };
    return null;
  }
  if (GLYPH_TO_CODE[ch]) return { surface: ch, code: GLYPH_TO_CODE[ch], len: 1 };
  if (GREEK_TO_CODE[ch]) return { surface: ch, code: GREEK_TO_CODE[ch], len: 1 };
  return null;
}

/** A marker set (`+`, `−∥*`, …) starting at `i`, or null. Pure: does not move
 *  the cursor. */
function markerSetAt(line, i) {
  if (!MARKER_TO_NAME[line[i]]) return null;
  const names = [];
  let surface = "";
  while (i < line.length && MARKER_TO_NAME[line[i]]) {
    names.push(MARKER_TO_NAME[line[i]]);
    surface += line[i];
    i++;
    if (line[i] === "∥") {
      surface += "∥";
      i++;
      continue;
    }
    break;
  }
  return { names, surface, next: i };
}

const skipWsFrom = (line, i) => {
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  return i;
};

class NotationParser {
  constructor(line) {
    this.line = line;
    this.pos = 0;
    this.diagnostics = [];
  }

  peek() {
    return this.pos < this.line.length ? this.line[this.pos] : "";
  }

  byteOf(charIndex) {
    return Buffer.byteLength(this.line.slice(0, charIndex), "utf8");
  }

  bytes(span) {
    return [this.byteOf(span[0]), this.byteOf(span[1])];
  }

  diag(reason, start = this.pos, end = this.pos) {
    this.diagnostics.push({ at: this.bytes([start, end]), reason });
  }

  skipWs() {
    this.pos = skipWsFrom(this.line, this.pos);
  }

  // ── RECURSIVE DESCENT ───────────────────────────────────────────────────

  parse() {
    this.skipWs();
    if (this.pos >= this.line.length) {
      this.diag("empty line — no expression to parse", 0, 0);
      return null;
    }
    const node = this.parseExpression();
    if (!node) return null;
    this.skipWs();
    if (this.pos < this.line.length) {
      this.diag(`unexpected trailing content: ${JSON.stringify(this.line.slice(this.pos))}`, this.pos);
    }
    return node;
  }

  parseExpression() {
    const start = this.pos;
    this.skipWs();
    const op = opCodeAt(this.line, this.pos);
    if (!op) {
      this.diag(`expected an operator (NUL SIG INS SEG CON SYN DEF EVA REC, or their glyph/greek) at byte ${this.byteOf(this.pos)}`);
      return null;
    }
    this.pos += op.len;
    const register = this.parseMarkerSet();
    this.skipWs();
    if (this.peek() !== "(") {
      this.diag(`operator ${op.surface} must open '(' target, operand ')'`);
      return null;
    }
    this.pos++;
    const args = [];
    for (;;) {
      this.skipWs();
      if (this.peek() === ")") break; // empty arg list — diagnosed below
      const arg = this.parseArg();
      if (!arg) return null;
      args.push(arg);
      this.skipWs();
      if (this.peek() === ",") {
        this.pos++;
        continue;
      }
      break;
    }
    if (args.length === 0) {
      this.diag(`operator ${op.surface} takes at least a target`);
    }
    this.skipWs();
    if (this.peek() !== ")") {
      this.diag(`expected ')' to close operator ${op.surface}`);
      return null;
    }
    this.pos++;
    const end = this.pos;
    return {
      kind: "expr",
      operator: op.code,
      surface: this.line.slice(start, end),
      label: op.surface,
      register,
      args,
      span: [start, end],
    };
  }

  parseArg() {
    const start = this.pos;
    const op = opCodeAt(this.line, this.pos);
    if (op) {
      // A nested expression argument (operator wraps an operator). Lookahead:
      // it is only a nested expression if an operator token is followed by
      // '('. Otherwise the token is the start of a path that merely BEGINS
      // with operator-shaped letters, and we fall through to the path.
      let probe = skipWsFrom(this.line, this.pos + op.len);
      const ms = markerSetAt(this.line, probe);
      if (ms) probe = skipWsFrom(this.line, ms.next);
      if (this.line[probe] === "(") {
        return this.parseExpression();
      }
    }
    this.pos = start;
    const path = this.parsePath();
    if (!path) {
      this.diag(`expected an argument at byte ${this.byteOf(start)}`);
      return null;
    }
    const type = this.parseMarkerSet();
    return {
      kind: "path",
      asWritten: path.asWritten + (type ? type.surface : ""),
      segments: path.segments,
      type,
      span: [start, this.pos],
    };
  }

  parsePath() {
    const start = this.pos;
    const segments = [];
    const parts = [];
    for (;;) {
      const seg = this.parseSegment();
      if (!seg) return null;
      segments.push(seg);
      parts.push(seg.surface);
      if (this.peek() === ".") {
        this.pos++;
        if (!isSegmentStart(this.peek())) {
          this.diag("a path cannot end with '.'", start);
          return null;
        }
        continue;
      }
      break;
    }
    return { segments, asWritten: parts.join("."), span: [start, this.pos] };
  }

  parseSegment() {
    const start = this.pos;
    const ch = this.peek();
    if (ch === "*" || ch === "−" || ch === "-" || ch === "_") {
      const kind = ch === "*" ? "pattern" : ch === "_" ? "nonparticipating" : "ground";
      this.pos++;
      return { kind, surface: ch, span: [start, this.pos] };
    }
    if (isIdentChar(ch)) {
      const parts = [this.readIdent()];
      while (this.peek() === "∥") {
        this.pos++;
        const second = this.readIdent();
        if (!second) {
          this.diag("∥ must join two identifiers in a path segment", start);
          return null;
        }
        parts.push(second);
      }
      return { kind: "ident", surface: parts.join("∥"), span: [start, this.pos] };
    }
    this.diag(`a path segment cannot start with ${JSON.stringify(ch)}`, start);
    return null;
  }

  readIdent() {
    const start = this.pos;
    while (this.pos < this.line.length && isIdentChar(this.line[this.pos])) this.pos++;
    return this.pos === start ? null : this.line.slice(start, this.pos);
  }

  parseMarkerSet() {
    const ms = markerSetAt(this.line, this.pos);
    if (ms) this.pos = ms.next;
    return ms;
  }
}

// ── THE PROJECTOR: TREE -> EOT OBSERVATIONS ────────────────────────────────

/** The act's cell grain, resolved the notation's way: the first end that
 *  carries a single explicit type marker wins; a nested expression contributes
 *  its own resolution (wrapping inherits the wrapped act's altitude). Ends
 *  that are unmarked or ∥-superposed do NOT resolve — that is a gap, not a
 *  guess. */
function resolveActGrain(node) {
  for (const arg of node.args) {
    if (arg.kind === "path") {
      if (arg.type && arg.type.names.length === 1) return arg.type.names[0];
    } else {
      const child = resolveActGrain(arg);
      if (child) return child;
    }
  }
  return null;
}

/** Every end that carries a ∥-superposition, keyed end1/end2 — surfaced on the
 *  record so the subset the author narrowed to is never lost. */
function collectSuperpositions(node, acc = {}) {
  node.args.forEach((arg, i) => {
    const key = i === 0 ? "end1" : "end2";
    if (arg.kind === "path") {
      if (arg.type && arg.type.names.length > 1) acc[key] = arg.type.names;
    } else {
      collectSuperpositions(arg, acc);
    }
  });
  return acc;
}

function surfaceOfArg(arg) {
  return arg.kind === "path" ? arg.asWritten : arg.surface;
}

function recordsFor(node, ctx) {
  const rec = {
    schema: "EOTObservation@1",
    id: `o${ctx.seq++}`,
    at: ctx.bytes(node.span),
    role: "proposition",
    label: node.label,
    subjectBasis: "stated",
    operator: node.operator,
  };
  if (node.args.length >= 1) rec.end1 = surfaceOfArg(node.args[0]);
  if (node.args.length >= 2) rec.end2 = surfaceOfArg(node.args[1]);

  const grain = resolveActGrain(node);
  const superposed = collectSuperpositions(node);
  if (Object.keys(superposed).length) rec.superposition = superposed;

  if (grain) {
    const cell = cube.cellOf(node.operator, grain);
    rec.grain = cell.grain;
    rec.terrain = cell.terrain;
    rec.stance = cell.stance;
    rec.settledAs = "notation-marker";
  } else if (Object.keys(superposed).length) {
    rec.grain_gap = "end_typed_superposed";
    const from = Object.keys(superposed)[0];
    rec.basis = `end ${from} typed ${superposed[from].join(" and ")} — the wire's single grain cannot carry a subset, so no grain is claimed; the markers stay on the end verbatim`;
  } else {
    rec.grain_gap = "unmarked_end";
    rec.basis = "no end carries an explicit type marker; unmarked ends hold all three positions (Ground/Figure/Pattern) in implicit superposition, which the wire's single grain cannot carry — no grain is claimed";
  }

  if (node.register) {
    rec.register = node.register.names.length === 1
      ? node.register.names[0]
      : { superposition: node.register.names, surface: node.register.surface };
  }

  const children = [];
  for (const arg of node.args) {
    if (arg.kind === "expr") children.push(...recordsFor(arg, ctx));
  }
  return [rec, ...children];
}

/** Parse one notation line into EOT observation records.
 *
 *  Returns { records, diagnostics, tree }:
 *   - records:    EOTObservation@1 lines, outer expression first, nested
 *                 expressions after it. Their `at` byte spans nest by
 *                 construction — containment is computed, never declared, the
 *                 same law the reader's own ledger obeys.
 *   - diagnostics: anything the parser could not swallow silently, each with
 *                 a byte address and a reason (a malformed line is a
 *                 diagnostic, never a dropped fact).
 *   - tree:       the full parse tree (paths decoded to segments, markers
 *                 decoded to names), so nothing the notation encodes is lost
 *                 even when the wire format does not yet consume it. */
export function parseNotationLine(line) {
  const p = new NotationParser(line);
  const tree = p.parse();
  const ctx = { seq: 0, bytes: (span) => p.bytes(span) };
  const records = tree ? recordsFor(tree, ctx) : [];
  return { records, diagnostics: p.diagnostics, tree };
}