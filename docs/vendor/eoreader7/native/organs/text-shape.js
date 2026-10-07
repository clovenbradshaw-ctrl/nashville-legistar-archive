// native/organs/text-shape.js — the same discipline measure.js::sniffContainer
// applies to raw bytes, one level down: given a short string of TEXT (already
// known to be text, not binary), what SHAPE is it — mechanically, magic
// first, closed list, never guessed.
//
// WHY THIS EXISTS. sniffContainer decides what a BINARY container is off its
// own magic bytes, closed list, a text/binary heuristic never consulted
// first. Nothing in this repo did the same job one level down: given a
// stretch of text, is it JSON, a code snippet, or prose. Three real near-kin
// were checked and ruled out before writing this, in the order they were
// found:
//
//   - cli/claude-code-state.mjs::engineRunOf has `t.startsWith("{")` — but it
//     exists only to read back reason.mjs's OWN stdout, never meant to
//     classify arbitrary text, and it is not exported for reuse.
//   - native/organs/source.js::identifyMaterial does a related job for a
//     NAMED, WHOLE document (an attachment with a filename): its JSON leg
//     (`trimmed.startsWith("{"/"[") + isParseableJson`) is close kin, but its
//     CODE leg is by FILE EXTENSION only (".py" -> "Python source code"),
//     never by structure — a whole document usually has a name to read. A
//     short, unnamed string pulled out of the middle of something else (a
//     ledger observation's own text field) has no filename, so the code leg
//     has to be genuinely structural, which is the gap this module closes.
//     Its JSON leg is not reused as-is either: isParseableJson is a strict
//     full-parse-or-nothing check, and this repo's own ledger observations
//     are routinely JSON with a truncation marker appended — a naive strict
//     parse would call all of that "prose". Not an extension of
//     identifyMaterial: that organ's grain is a whole named document, this
//     one's is a short unnamed fragment, close enough to share a comment
//     but not a function.
//   - native/adapters/code/encounters.js::isCodeHunk is the other close kin,
//     and it was ruled out for a stated, measured reason: it is calibrated
//     for a GIANT bundle (average line length > 400 chars over the WHOLE
//     text, a statement-density ratio measured on a multi-megabyte
//     specimen, a Python def/class count needing >= 3 matching lines) —
//     thresholds a five-line snippet cannot structurally clear even when it
//     plainly IS code. Different grain, not a bug in isCodeHunk.
//
// THE CLOSED LIST: "json" | "code" | "prose" | "empty". Four outcomes,
// nothing invented beyond them. "empty" is its own typed result for
// whitespace-only input, never silently folded into "prose" (the same
// reason a censored placement in measure.js is a typed finding, never a
// default). "prose" is the honest residual for everything that is not
// JSON-shaped and not code-shaped — exactly the role sniffContainer's own
// `null` plays for a binary buffer whose magic matches nothing declared
// ("plain text and CSV sniff as nothing, so they stay on the text path").
// There is no separate literal "unknown" bucket: nothing would ever land in
// one that "prose" does not already honestly describe.
//
// MAGIC FIRST, closed list, never guessed:
//   1. JSON — the trimmed text starts with `{` or `[`, AND either the whole
//      thing parses, or a bounded, disclosed repair makes it parse: close an
//      unterminated string, drop one dangling trailing comma, close every
//      open bracket in the order it was opened, nothing more. A structural
//      violation (a closer that does not match its own opener) is never
//      repaired — that text is not JSON-shaped, whatever it starts with.
//   2. CODE — a shebang line, or a markdown fenced-code-block marker, or at
//      least one physical line carrying two or more of four declared
//      syntactic signals: a brace, a semicolon, an arrow (`=>`), or a
//      keyword from a small closed cross-language list (CODE_SIGNAL_KEYWORDS
//      below). ONE signal alone is refused on purpose — isCodeHunk's own
//      header names exactly this false positive ("def poetry is not code at
//      all", "class struggle shapes history": a single code word inside a
//      real sentence) and guards against it with its own multi-condition
//      combination; requiring two declared signals on the same line is this
//      module's version of the same guard, checked directly against both of
//      isCodeHunk's own named examples in text-shape.test.mjs. TWO is the
//      smallest number that turns an isolated word into a real
//      co-occurrence — it is the one threshold this module could not avoid,
//      named here rather than smuggled in as a density cutoff.
//   3. PROSE — everything else, non-empty.
//   4. EMPTY — whitespace-only (or absent) input.
//
// Pure: no I/O, no organs injected, nothing shared with any other module's
// mutable state.

export const CODE_SIGNAL_KEYWORDS = Object.freeze([
  "function", "const", "let", "var", "import", "export", "class", "return",
  "async", "await", "def", "elif", "lambda", "yield", "func", "package",
  "struct", "interface", "trait", "impl", "mod", "pub", "fn", "public",
  "private", "static", "void", "namespace", "typedef", "require", "module",
  "echo", "esac", "fi", "then",
]);
const KEYWORD_RE = new RegExp(`\\b(?:${CODE_SIGNAL_KEYWORDS.join("|")})\\b`);
const BRACE_RE = /[{}]/;
const SEMI_RE = /;/;
const ARROW_RE = /=>/;
// Markdown fence: up to 3 leading spaces (CommonMark's own allowance), then
// 3+ backticks — a standalone strong signal, not part of the two-of-four count.
const FENCE_RE = /^ {0,3}`{3,}/;

function lineIsCodeShaped(line) {
  let hits = 0;
  if (BRACE_RE.test(line)) hits += 1;
  if (SEMI_RE.test(line)) hits += 1;
  if (ARROW_RE.test(line)) hits += 1;
  if (KEYWORD_RE.test(line)) hits += 1;
  return hits >= 2;
}

/**
 * looksCode(trimmed) -> boolean. The CODE leg, checked after the JSON leg has
 * already refused (sniffText is the one door; this is exported for the test
 * file to check each declared signal on its own real specimen).
 */
export function looksCode(trimmed) {
  const s = String(trimmed ?? "");
  if (s.startsWith("#!")) return true;
  const lines = s.split("\n");
  if (lines.some((l) => FENCE_RE.test(l))) return true;
  return lines.some(lineIsCodeShaped);
}

// ---- JSON leg -------------------------------------------------------------

/**
 * jsonBalance(s) -> { ok, truncated, inString, closers }
 * Walks the string tracking only bracket nesting and string-literal state —
 * no attempt to validate keys, commas, or values, since that is exactly what
 * JSON.parse already does correctly and this module never re-derives.
 * `ok: false` means a real structural violation was found (a closer that does
 * not match its own opener, including one closing an already-empty stack) —
 * that text is refused, never repaired. Otherwise `closers` states exactly
 * what a truncated tail needs appended, in the order it needs appending.
 */
function jsonBalance(s) {
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{" || c === "[") { stack.push(c); continue; }
    if (c === "}" || c === "]") {
      const open = stack.pop();
      if ((c === "}" && open !== "{") || (c === "]" && open !== "[")) return { ok: false };
      continue;
    }
  }
  return { ok: true, truncated: inString || stack.length > 0, inString, closers: stack.map((o) => (o === "{" ? "}" : "]")).reverse() };
}

/**
 * looksJson(trimmed) -> boolean. Structural JSON check, MAGIC leg — the
 * caller (sniffText) has already checked `trimmed` starts with `{` or `[`,
 * exactly as sniffContainer's own magic bytes are checked at a fixed offset,
 * never searched for mid-buffer.
 */
export function looksJson(trimmed) {
  const s = String(trimmed ?? "");
  try { JSON.parse(s); return true; } catch {}
  const bal = jsonBalance(s);
  if (!bal.ok) return false; // a real structural violation — never repaired
  if (!bal.truncated) return false; // already balanced and still failed to parse: a real syntax error, not truncation
  let repaired = s;
  if (bal.inString) repaired += '"';
  // One dangling trailing comma is the other truncation shape a byte-limited
  // write leaves behind ("...,\n" cut mid-next-field) — stripped once, only
  // immediately before the closers, never anywhere else in the text.
  repaired = repaired.replace(/,\s*$/, "");
  repaired += bal.closers.join("");
  try { JSON.parse(repaired); return true; } catch { return false; }
}

/**
 * sniffText(text) -> "json" | "code" | "prose" | "empty"
 * The one door. Magic first (JSON), then the closed code-signal set, then
 * the honest residual — sniffContainer's own order and posture, one level
 * down from bytes to text.
 */
export function sniffText(text) {
  const s = String(text ?? "");
  const trimmed = s.trim();
  if (!trimmed) return "empty";
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && looksJson(trimmed)) return "json";
  if (looksCode(trimmed)) return "code";
  return "prose";
}
