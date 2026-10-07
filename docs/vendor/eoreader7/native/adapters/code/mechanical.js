// adapters/code/mechanical.js — the no-LLM proposal tier.
//
// The loop's mouth invents patch bytes; everything here DERIVES them from
// the file's own bytes plus received priors. Each export answers one
// mechanical question and returns either bytes or a typed gap — never a
// guess. The real test command still arbitrates every candidate; this
// module only widens the set of candidates that reach it without a model.
//
// Disciplines (the repo's own, applied to proposals):
//   RECEIVED, NEVER RE-TYPED — keyword sets come from an injected prior
//   (code-structure.js::keywordSetOf), declaration shapes from RECIPES via
//   parseDeclarations, import syntax from scan.js::importSpans.
//   ADDRESSES, NOT ASSERTIONS — every emitted FIND is sliced from `text`
//   (an exact span), every INS anchor is a measured offset. A function
//   that cannot point at bytes returns a gap.
//   DISCLOSED SIMPLIFICATIONS — the string/comment stripper is a
//   heuristic (nested template `${}` and exotic escapes can fool it);
//   rename touches string literals too; stub parameter names are
//   positional placeholders (`arg0…`), never inferred. Each is stated at
//   the point of use, and the tests are the backstop either way.

import { parseDeclarations, braceExtent, indentExtent } from "../text/code-structure.js";
import { importSpans } from "./scan.js";

const escapeRegExp = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A word boundary the ASCII `\b` cannot see: XID-aware on both sides, `$`
// included (JS identifiers). Used everywhere a name is matched, so a
// Greek-named declaration renames as exactly as an ASCII one.
const bound = (name) => new RegExp(`(?<![\\p{ID_Continue}$])${escapeRegExp(name)}(?![\\p{ID_Continue}$])`, "gu");

// ── string/comment stripper (offsets preserved: replaced by spaces) ───────
// Heuristic, disclosed: backslash escapes honored; strips ALL comment
// styles (`#`, `//`, `/*…*/`) regardless of language (blanking a rare
// `//` floor-division in Python loses a site, never invents one).
// Interpolation is KEPT as code: f/t-strings (`f"{x}"`, `f"""…{y}…"""`)
// and JS templates (`` `${z}` ``) execute their `{…}` spans, so literal
// parts blank and expression spans stay. Nested quoted runs inside an
// expression blank one level (`f"{d['key']}"` keeps `d`, drops `key`);
// nested f-strings inside expressions (f"{f'{w}'}") are the disclosed
// residual — the inner name is missed. Offsets preserved throughout.
function blankQuoted(s, out, i, triple, interp) {
  const blank = (a, b) => { for (let k = Math.max(0, a); k < Math.min(s.length, b); k++) out[k] = " "; };
  const openLen = triple ? 3 : 1;
  const closer = (j) => (triple ? s.startsWith(s.slice(i, i + 3), j) : s[j] === s[i]);
  const closeLen = triple ? 3 : 1;
  blank(i, i + openLen);
  let j = i + openLen;
  let litStart = j;
  let depth = 0;
  while (j < s.length) {
    const ch = s[j];
    if (ch === "\\") { j += 2; continue; }
    if (!triple && s[i] === "`" && ch === "\n") {
      // Unterminated template: a still-open expression is code without a
      // verdict — keep it (do NOT blank the trailing span); a literal
      // tail blanks as usual. Found by falsification (`f"oops {exx"`).
      if (depth === 0) blank(litStart, j);
      return j;
    }
    // At depth > 0 a quote ALWAYS opens a nested string (an outer close
    // with unclosed braces cannot occur in valid code — and in invalid
    // code blanking to the nested match harms nothing the closer branch
    // wouldn't). This orders nested-before-closer: same-quote nesting
    // (`f"{d["key"]}"`, legal since PEP 701) blanks the inner run
    // instead of swallowing the expression. Found by falsification.
    if (depth > 0 && (ch === '"' || ch === "'" || ch === "`")) {
      let k = j + 1;
      while (k < s.length) {
        if (s[k] === "\\") { k += 2; continue; }
        if (s[k] === ch) { k += 1; break; }
        k += 1;
      }
      blank(j, k); j = k; continue;
    }
    if (closer(j)) {
      blank(litStart, j); blank(j, j + closeLen);
      // A blanked string is still one argument: stamp the closing quote's
      // first byte so arity counters see non-empty (`f("hi")` is 1, not 0 —
      // found by falsification: bare-assert harness tests pass one string
      // and stubbed 0-arg). `0` is never an identifier-start (IDENT_RE
      // cannot match it) and in valid code the byte after a string close
      // is never an identifier char, so no consumer can merge or count it.
      out[j] = "0";
      return j + closeLen;
    }
    if (interp && ch === "{") {
      if (s[j + 1] === "{") { j += 2; continue; }
      if (depth === 0) blank(litStart, j);
      depth += 1; j += 1; continue;
    }
    if (interp && ch === "}") {
      if (depth === 0) { j += (s[j + 1] === "}" ? 2 : 1); continue; }
      depth -= 1;
      if (depth === 0) litStart = j + 1;
      j += 1; continue;
    }
    // Conversion flags (`{val!r}`): `!` + s/r/a is formatting, never a
    // name — blank the two bytes (but never `!=`, the real operator).
    // Found by falsification (`r` reported as a missing import).
    if (interp && depth > 0 && ch === "!" && /[sra]/.test(s[j + 1] ?? "") && /[}\]:,)\s]/.test(s[j + 2] ?? "")) {
      blank(j, j + 2); j += 2; continue;
    }
    j += 1;
  }
  // EOF with an expression still open: same rule as the template guard —
  // keep the code, blank only a literal tail.
  if (depth === 0) blank(litStart, j);
  return j;
}

function stripNonCode(text) {
  const s = String(text ?? "");
  const out = new Array(s.length).fill(null);
  const blank = (a, b) => { for (let i = a; i < b; i++) out[i] = " "; };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") {
      let j = s.indexOf("\n", i);
      if (j === -1) j = s.length;
      blank(i, j); i = j; continue;
    }
    if (c === "/" && s[i + 1] === "*") {
      let j = s.indexOf("*/", i + 2);
      j = j === -1 ? s.length : j + 2;
      blank(i, j); i = j; continue;
    }
    if (c === "#") {
      let j = s.indexOf("\n", i);
      if (j === -1) j = s.length;
      blank(i, j); i = j; continue;
    }
    const triple = s.startsWith("'''", i) ? true : s.startsWith('"""', i);
    if (triple || c === '"' || c === "'" || c === "`") {
      // Interpolation prefix? Letters immediately before the quote that
      // are all string-prefix letters with an f/F/t/T among them
      // (`rf"…"`, `t'…'`); backtick templates always interpolate.
      let pk = i - 1, prefix = "";
      while (pk >= 0 && /[A-Za-z]/.test(s[pk])) { prefix = s[pk] + prefix; pk -= 1; }
      const interp = c === "`" || (/[fFtT]/.test(prefix) && /^[bBuUrRfFtT]*$/.test(prefix) && prefix.length > 0);
      i = blankQuoted(s, out, i, !!triple, interp);
      continue;
    }
    i += 1;
  }
  for (let k = 0; k < s.length; k++) if (out[k] === null) out[k] = s[k];
  return out.join("");
}

/**
 * arityAt(str, open) -> arity (number) | null.
 * Top-level comma count inside the parens opening at `open` (+1 when
 * non-empty), where top-level means depth 1 across ALL bracket kinds —
 * commas inside `[...]`/`{...}` are elements, not arguments (found by
 * falsification: `f([1, 2, 3, 4])` counted 4, stubbing 5 params).
 * Null when unbalanced — a skipped site, never a guess.
 * Shared by callArity (per-body) and callArityOf (per-name).
 */
function arityAt(str, open) {
  let depth = 0;
  let commas = 0;
  let empty = true;
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set(Object.values(pairs));
  for (let j = open; j < str.length; j++) {
    const ch = str[j];
    if (pairs[ch]) { depth += 1; continue; }
    if (closers.has(ch)) {
      depth -= 1;
      if (depth === 0) return empty && commas === 0 ? 0 : commas + 1;
      if (depth < 0) return null;
      continue;
    }
    if (depth === 1 && ch === ",") commas += 1;
    if (depth >= 1 && ch !== " " && ch !== "\t" && ch !== "\n") empty = false;
  }
  return null;
}

const IDENT_RE = /[\p{ID_Start}_$][\p{ID_Continue}$]*/gu;

/**
 * callArity(text, entities) -> [{ caller, callee, arity, count }]
 * Like callEdges but keeps the ARITY: for every `callee(` call site inside
 * each caller's body span, the top-level comma count inside the parens
 * (+1 when non-empty). Measured on the stripped text (string contents
 * can't fool the paren counter — offsets preserved, so spans still line
 * up). Returns one row per (caller, callee, arity); `count` is that
 * exact shape's witness count. An unbalanced paren is a skipped site,
 * never a guessed arity.
 */
export function callArity(text, entities) {
  const stripped = stripNonCode(text);
  const byName = new Map();
  for (const e of entities) { if (!byName.has(e.name)) byName.set(e.name, []); byName.get(e.name).push(e); }
  const names = [...byName.keys()].filter((n) => n.length >= 1);
  if (!names.length) return [];
  const rows = [];
  for (const caller of entities) {
    const body = stripped.slice(caller.bodyStart ?? caller.start, caller.end);
    const callRe = new RegExp(`(?<![\\p{ID_Continue}$])(${names.map(escapeRegExp).join("|")})\\s*\\(`, "gu");
    let m;
    while ((m = callRe.exec(body))) {
      const arity = arityAt(body, m.index + m[0].length - 1);
      if (arity === null) continue;
      rows.push({ caller: caller.name, callee: m[1], arity });
    }
  }
  const tally = new Map();
  for (const r of rows) {
    const k = `${r.caller}\u0000${r.callee}\u0000${r.arity}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return [...tally.entries()].map(([k, count]) => {
    const [caller, callee, arity] = k.split("\u0000");
    return { caller, callee, arity: Number(arity), count };
  });
}

/**
 * callArityOf(text, fileName, name) -> { count, arities: [...] }.
 * Arity for a name NOBODY declared — the stub-synthesis case, where the
 * callee is missing by definition and callArity's entity table can never
 * contain it. Searches the whole stripped text with import spans blanked
 * (an imported name is not a call site), skipping the name's own
 * declaration header (`def serve(` reads params, not args) and
 * attribute calls (`app.serve(` is the object's business). Decorator
 * uses (`@serve(80, 443)`) ARE counted — a decorator with arguments is
 * a real call site. Returns every witnessed arity, sorted unique, with
 * the site count. Zero sites → `{ count: 0, arities: [] }` (caller
 * decides the default — this function never invents a 0-arg stub from
 * silence; the driver uses max-or-0 explicitly).
 */
export function callArityOf(text, fileName, name) {
  const s = String(text ?? "");
  const target = String(name ?? "");
  if (!target) return { count: 0, arities: [] };
  let masked = s.split("");
  for (const sp of importSpans(s)) for (let i = sp.start; i < sp.end; i++) masked[i] = " ";
  const stripped = stripNonCode(masked.join(""));
  void fileName;
  const re = new RegExp(`(?<![\\p{ID_Continue}$])${escapeRegExp(target)}\\s*\\(`, "gu");
  const arities = [];
  let m;
  while ((m = re.exec(stripped))) {
    const lineStart = stripped.lastIndexOf("\n", m.index) + 1;
    const before = stripped.slice(lineStart, m.index);
    // The name's own declaration header reads PARAMETERS, not args.
    if (/^\s*(?:async\s+)?def\s*$/.test(before)) continue;
    if (/^\s*class\s*$/.test(before)) continue;
    // Attribute calls (`app.route(`) are the object's business, not a
    // module-level binding's — consistent with missingImports, which
    // never counts dot-preceded names as bare references.
    if (before.endsWith(".")) continue;
    const arity = arityAt(stripped, m.index + m[0].length - 1);
    if (arity === null) continue;
    arities.push(arity);
  }
  return { count: arities.length, arities: [...new Set(arities)].sort((a, b) => a - b) };
}

/**
 * positionalCapacity(src, decl) -> { capacity, vararg }.
 * ParseDeclarations-adjacent param parsing (recipes carry no param
 * shapes): the paren run opening at/after the declaration's own start is
 * matched to its close, split top-level (nesting- and quote-aware), and
 * each part counts as one positional parameter — annotations and defaults
 * stripped, never interpreted. A part starting with `*` (`*args`,
 * `**kw`, or the bare `*` kwonly marker) sets vararg and counts nothing:
 * disclosed simplification — a bare `*` alone does not accept unlimited
 * positionals, but over-exempting is the safe direction for a NOTE gate.
 * JS rest (`...args`) is treated the same. Never throws; weird input is
 * capacity 0, no vararg.
 */
function positionalCapacity(src, decl) {
  try {
    const s = String(src ?? "");
    const from = decl?.start ?? 0;
    const open = s.indexOf("(", from);
    if (open === -1 || open > (decl?.end ?? s.length)) return { capacity: 0, vararg: false };
    let depth = 0;
    let close = -1;
    for (let i = open; i < s.length; i++) {
      if (s[i] === "(") depth += 1;
      else if (s[i] === ")") { depth -= 1; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) return { capacity: 0, vararg: false };
    const inner = s.slice(open + 1, close);
    const parts = [];
    let d = 0;
    let quote = null;
    let cur = "";
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (quote) {
        cur += ch;
        if (ch === "\\") { cur += inner[i + 1] ?? ""; i += 1; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === "(" || ch === "[" || ch === "{") d += 1;
      else if (ch === ")" || ch === "]" || ch === "}") d = Math.max(0, d - 1);
      if (ch === "," && d === 0) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    parts.push(cur);
    let capacity = 0;
    let vararg = false;
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      if (p === "/") continue; // posonly separator is a marker, not a parameter (found by falsification: counted as one)
      if (p.startsWith("*") || p.startsWith("...")) { vararg = true; continue; }
      capacity += 1;
    }
    return { capacity, vararg };
  } catch {
    return { capacity: 0, vararg: false };
  }
}

/**
 * arityCoverage({ codeText, fileName, testTexts }) ->
 * [{ name, declared, calledMax, covered }].
 * The 0-arg-stub gate, checkable WITHOUT running tests: for each declared
 * FUNCTION in codeText (parseDeclarations on the file's own bytes), the
 * positional capacity (count of positional params; INFINITE when a
 * *args/vararg splat is present) beside the max called arity witnessed
 * across testTexts (callArityOf per test text — import lines blanked, the
 * name's own def line and attribute calls skipped, same as the stub case).
 * covered is false ONLY when calledMax exceeds the declared capacity with
 * no vararg to absorb it (varlen/overloads make refusal unsafe, so this
 * is a NOTE for the loop, never a refusal). testTexts accepts strings or
 * { text | content | code } holders; weird input yields []. Pure, no I/O.
 * Serialization note: `declared` is Infinity under vararg, which JSON
 * renders as null in round transcripts — null-declared with covered:true
 * reads as unbounded, never as unknown (unknown would be a missing row).
 */
export function arityCoverage({ codeText, fileName, testTexts } = {}) {
  try {
    const src = String(codeText ?? "");
    if (!src) return [];
    const fname = String(fileName ?? "");
    if (!fname) return [];
    const decls = parseDeclarations(src, fname).filter((d) => d?.kind === "function");
    if (!decls.length) return [];
    const raw = Array.isArray(testTexts) ? testTexts : (testTexts == null ? [] : [testTexts]);
    const texts = [];
    for (const t of raw) {
      if (typeof t === "string") { texts.push(t); continue; }
      if (t && typeof t === "object") {
        const v = t.text ?? t.content ?? t.code ?? null;
        if (typeof v === "string") texts.push(v);
      }
    }
    const seen = new Set();
    const out = [];
    for (const d of decls) {
      if (!d?.name || seen.has(d.name)) continue;
      seen.add(d.name);
      const { capacity, vararg } = positionalCapacity(src, d);
      let calledMax = 0;
      for (const t of texts) {
        let r = null;
        try {
          r = callArityOf(t, fname, d.name);
        } catch {
          continue;
        }
        for (const a of r?.arities ?? []) {
          if (typeof a === "number" && a > calledMax) calledMax = a;
        }
      }
      out.push({
        name: d.name,
        declared: vararg ? Infinity : capacity,
        calledMax,
        covered: vararg ? true : !(calledMax > capacity),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * localBindings(text) -> Set of names bound by lines, not declarations:
 * assignment targets (`x = …`, `a, b = …`), `def` parameter lists
 * (including `*args`/`**kw`, minus annotations/defaults), `for x in`,
 * `with … as x`, `except … as x`. Heuristic line-anchored scan —
 * destructuring past one tuple level and walrus-in-expressions are missed
 * (disclosed); the tests arbitrate either way.
 */
function localBindings(text) {
  const bound = new Set();
  const add = (n) => { if (/^[A-Za-z_]\w*$/.test(n)) bound.add(n); };
  for (const line of String(text ?? "").split("\n")) {
    let m = /^[ \t]*def\s+[A-Za-z_]\w*\s*\(([^)]*)\)/.exec(line);
    if (m) {
      for (const p of m[1].split(",")) {
        const name = p.trim().replace(/^[*]+/, "").split(":")[0].split("=")[0].trim();
        add(name);
      }
    }
    if (/^[ \t]*for\s+(.+?)\s+in\s+/.test(line)) {
      m = /^[ \t]*for\s+(.+?)\s+in\s+/.exec(line);
      for (const part of m[1].split(",")) add(part.trim());
    }
    m = /\bas\s+([A-Za-z_]\w*)\s*:?\s*$/.exec(line);
    if (m && /^\s*(with\b|except\b|import\b)/.test(line)) add(m[1]);
    m = /^[ \t]*([A-Za-z_][\w\s,]*?)\s*=(?![=>])/.exec(line);
    if (m && !/^\s*(if\b|while\b|return\b|assert\b)/.test(line)) {
      for (const part of m[1].split(",")) add(part.trim());
    }
  }
  return bound;
}
/**
 * boundNamesOfSpans(spans) -> Map name -> count for the import statements'
 * bound identifiers: `import a, b.c` binds a, b; `from x import a, b as c`
 * binds a, c; JS `import { a, b as c }` binds a, c; `import def`/`import *`
 * bind nothing (star is unresolvable — disclosed, never guessed).
 * Heuristic over the statement text, never a resolver.
 */
function boundNamesOfSpans(spans) {
  const boundNames = new Map();
  const add = (name) => {
    if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) return;
    boundNames.set(name, (boundNames.get(name) ?? 0) + 1);
  };
  for (const sp of spans) {
    const st = sp.statement;
    if (sp.kind === "py") {
      const from = /^\s*from\s+\S+\s+import\s+(.+)$/.exec(st);
      if (from) {
        if (from[1].trim().startsWith("(") || from[1].trim() === "*") {
          if (from[1].trim() === "*") continue; // star: binds everything, i.e. nothing checkable
          for (const part of from[1].replace(/[()]/g, "").split(",")) {
            const bits = part.trim().split(/\s+as\s+/);
            add(bits[bits.length - 1].trim());
          }
        } else {
          for (const part of from[1].split(",")) {
            const bits = part.trim().split(/\s+as\s+/);
            add(bits[bits.length - 1].trim());
          }
        }
        continue;
      }
      const imp = /^\s*import\s+(.+)$/.exec(st);
      if (imp) {
        for (const part of imp[1].split(",")) {
          const mod = part.trim().split(/\s+as\s+/);
          const top = (mod[mod.length - 1].trim() === mod[0].trim() ? mod[0] : mod[mod.length - 1]).trim().split(".")[0];
          // `import a as b` binds b; `import a.b` binds a
          add(mod.length > 1 && mod[0].trim().split(".")[0] !== mod[mod.length - 1].trim() ? mod[mod.length - 1].trim() : top);
        }
      }
    } else {
      const named = /import\s*\{([^}]*)\}/.exec(st);
      if (named) {
        for (const part of named[1].split(",")) {
          const bits = part.trim().split(/\s+as\s+/);
          add(bits[bits.length - 1].trim());
        }
      }
      const def = /^\s*import\s+([A-Za-z_$][\w$]*)\s*(?:,|\s+from)/.exec(st);
      if (def) add(def[1]);
      const star = /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(st);
      if (star) add(star[1]);
    }
  }
  return boundNames;
}

/**
 * missingImports(text, fileName, { keywords, builtins }) -> [{ name, count }]
 * Used-but-unbound identifiers: every identifier in code position minus
 * declared names, minus line-bound locals (params, assignment targets,
 * for/with/except bindings), minus hard keywords, minus builtins, minus
 * import-bound names. Import STATEMENT spans are blanked before scanning
 * (a module named in its own import line is not "used"). Dunder names
 * (`__name__`) are excluded — runtime-provided, an import fix for one
 * would be wrong. Ordered by count desc. A name the stripper hid (inside
 * a string that is really code, e.g. an eval) is missed — disclosed, and
 * the tests are the backstop either way.
 */
export function missingImports(text, fileName, { keywords = null, builtins = [] } = {}) {
  const s = String(text ?? "");
  const spans = importSpans(s);
  let masked = s.split("");
  for (const sp of spans) for (let i = sp.start; i < sp.end; i++) masked[i] = " ";
  const stripped = stripNonCode(masked.join(""));
  const counts = new Map();
  IDENT_RE.lastIndex = 0;
  let m;
  while ((m = IDENT_RE.exec(stripped))) {
    if (stripped[m.index - 1] === ".") continue; // attribute access (`os.path.join` binds only `os`) — never a bare reference
    counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  const declared = new Set(parseDeclarations(s, fileName).map((d) => d.name));
  const locals = localBindings(s);
  const bound = boundNamesOfSpans(spans);
  const builtinSet = new Set(builtins);
  const out = [];
  for (const [name, count] of counts) {
    if (declared.has(name)) continue;
    if (locals.has(name)) continue;
    if (keywords?.has(name)) continue;
    if (builtinSet.has(name)) continue;
    if (bound.has(name)) continue;
    if (/^__\w+__$/.test(name)) continue;
    if (/^[0-9]/.test(name)) continue;
    out.push({ name, count });
  }
  out.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
  return out;
}

/**
 * synthesizeStub({ name, arity, kind, language, keywords }) ->
 * { ok:true, add } | { ok:false, gap }.
 * A declaration shaped by the language's own syntax (RECIPES' shapes):
 * bodies are `raise NotImplementedError` / `throw new Error(...)` —
 * the SHAPE is derived, the logic is honestly absent. Parameter names
 * are positional placeholders (`arg0…`), never inferred. Refuses
 * keyword names (kind `keyword_declaration`) and unknown languages
 * (kind `unknown_language`).
 */
export function synthesizeStub({ name, arity = 0, kind = "function", language, keywords = null } = {}) {
  const lang = String(language ?? "").toLowerCase();
  if (keywords?.has(name)) {
    return { ok: false, gap: { kind: "keyword_declaration", name, reason: `"${name}" is a hard keyword in ${lang || "this language"} (received CodeKeywordPrior@1) — it can never name anything` } };
  }
  if (!/^[\p{ID_Start}_$][\p{ID_Continue}$]*$/u.test(String(name ?? ""))) {
    return { ok: false, gap: { kind: "malformed", name, reason: `"${name}" is not a spellable identifier` } };
  }
  const params = Array.from({ length: Math.max(0, arity | 0) }, (_, i) => `arg${i}`).join(", ");
  if (lang === "python" || lang === "py") {
    if (kind === "class") return { ok: true, add: `class ${name}:\n    pass` };
    return { ok: true, add: `def ${name}(${params}):\n    raise NotImplementedError` };
  }
  if (lang === "javascript" || lang === "js") {
    if (kind === "class") return { ok: true, add: `class ${name} {}` };
    return { ok: true, add: `function ${name}(${params}) {\n  throw new Error("not implemented");\n}` };
  }
  return { ok: false, gap: { kind: "unknown_language", language, reason: `no received stub shape for "${language}" — strangers are never templated` } };
}

/**
 * importAnchor(text) -> { index, basis, count }.
 * Where an inserted import goes: the start of the line after the last
 * import statement, or 0 (file head) when there is no import block.
 * Measured offsets from importSpans, never a guessed line number.
 */
export function importAnchor(text) {
  const spans = importSpans(String(text ?? ""));
  if (!spans.length) return { index: 0, basis: "no import block — file head", count: 0 };
  const last = spans[spans.length - 1];
  const at = last.end + 1;
  return { index: Math.min(at, String(text).length), basis: `${spans.length} import statement(s); anchor is the line after the last`, count: spans.length };
}

/**
 * suggestWholeFile(text, { maxChars }) -> { find, basis } | null.
 * For an `unlocated` gap on a SMALL file: the whole file content IS an
 * exact, unique anchor (sliced, never composed) — a SYN over it always
 * locates. Returns null above the cap (large files need real anchors;
 * a whole-file FIND there is prompt bloat, not help) or for empty text.
 * Default cap 2000 chars: stub-sized files, the exact population that
 * strands small mouths (measured: 3× unlocated on a 2-line stub).
 */
export function suggestWholeFile(text, { maxChars = 2000 } = {}) {
  const s = String(text ?? "");
  if (!s || s.length > maxChars) return null;
  return { find: s, basis: `file is ${s.length} chars (≤ ${maxChars}) — the whole file is an exact unique anchor; SYN over it always locates` };
}
/**
 * suggestWiderFind(text, fileName, find) -> { find, basis } | null.
 * For an `ambiguous` gap: when EVERY occurrence of `find` sits inside one
 * declaration's own span, return that declaration's header line (sliced
 * from the file — exact bytes, never composed). Spread across declarations
 * or outside all of them → null (cannot disambiguate mechanically, and an
 * ordinary unlocated find (count ≤ 1) → null (nothing to widen).
 */
export function suggestWiderFind(text, fileName, find) {
  const s = String(text ?? "");
  const needle = String(find ?? "");
  if (!needle) return null;
  const parts = s.split(needle);
  if (parts.length - 1 <= 1) return null;
  const decls = parseDeclarations(s, fileName);
  if (!decls.length) return null;
  let at = 0;
  const owners = new Set();
  for (let i = 0; i < parts.length - 1; i++) {
    at += parts[i].length;
    const owner = decls.find((d) => d.start <= at && at < d.end);
    if (!owner) return null;
    owners.add(`${owner.name}@${owner.start}`);
    at += needle.length;
  }
  if (owners.size !== 1) return null;
  const [sole] = owners;
  const decl = decls.find((d) => `${d.name}@${d.start}` === sole);
  const lineStart = s.lastIndexOf("\n", decl.start) + 1;
  let lineEnd = s.indexOf("\n", decl.start);
  if (lineEnd === -1) lineEnd = s.length;
  return { find: s.slice(lineStart, lineEnd), basis: `all ${parts.length - 1} occurrences sit inside \`${decl.name}\` (${decl.kind}); header line sliced from the file` };
}

/**
 * declaresKeyword(addText, fileName, keywords) -> [names].
 * The propose-time gate: names the ADD would declare without a prior,
 * minus names it declares with one. Non-empty means the proposal tries
 * to give a hard keyword a binding — refuse before touching disk
 * (kind `keyword_declaration`), with the names as the evidence.
 */
export function declaresKeyword(addText, fileName, keywords) {
  if (!keywords) return [];
  const plain = new Set(parseDeclarations(String(addText ?? ""), fileName).map((d) => `${d.name}@${d.start}`));
  const gated = new Set(parseDeclarations(String(addText ?? ""), fileName, { keywords }).map((d) => `${d.name}@${d.start}`));
  const refused = [];
  for (const k of plain) if (!gated.has(k)) refused.push(k.split("@")[0]);
  return refused;
}

/**
 * renameIn(text, fileName, oldName, newName, { keywords }) ->
 * { ok:true, code, touched } | { ok:false, gap }.
 * Scope-aware rename: old must be declared in this file; new must not be
 * a hard keyword. Replacement is XID-boundaried across the file —
 * INCLUDING string literals (disclosed simplification: a docstring that
 * mentions the old name is renamed too; the tests arbitrate).
 */
export function renameIn(text, fileName, oldName, newName, { keywords = null } = {}) {
  const s = String(text ?? "");
  if (keywords?.has(newName)) {
    return { ok: false, gap: { kind: "keyword_declaration", name: newName, reason: `"${newName}" is a hard keyword — it can never be a binding` } };
  }
  const decls = parseDeclarations(s, fileName);
  if (!decls.some((d) => d.name === oldName)) {
    return { ok: false, gap: { kind: "unlocated", name: oldName, reason: `"${oldName}" is declared nowhere in ${fileName}` } };
  }
  // A rename onto a live binding MERGES two identities while reporting
  // ok:true — the one outcome this module must never produce (found by
  // falsification: rename add→total yielded two `def total`). Refuse with
  // the collision named; a true merge is a human's decision, not a
  // mechanical one's.
  if (decls.some((d) => d.name === newName)) {
    return { ok: false, gap: { kind: "collision", name: newName, reason: `"${newName}" is already declared in ${fileName} — renaming "${oldName}" onto it would merge two bindings` } };
  }
  const re = bound(oldName);
  const count = (s.match(re) ?? []).length;
  // `match` with a /g regex consumes lastIndex state — reset before replace.
  re.lastIndex = 0;
  return { ok: true, code: s.replace(re, newName), touched: count };
}
