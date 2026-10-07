// code-scout.js — words point to referents, and a referent is defined
// contextually. In code the referents are explicit: a file DECLARES its
// names, and an identifier's contextual definition is its declaration site.
// This organ resolves an instruction's words to the definition span of the
// declared referent the instruction is about — never to the raw-frequency
// arena scoutSpan falls back to, which was measured (2026-08-25,
// eval/results/local-llm-nul-index-improve-RESULTS.md) silently mis-locating
// on incidental co-occurring words ("fixed"/"function"/"error") whenever the
// named identifier recurs too often as cross-referenced vocabulary to be
// "most selective" (ground 113x / difference 27x / witness 12x in
// eoreader6.1's nul/index.js), and returning a wrong span instead of null
// when the instruction named something truly absent ("frobnicate").
//
// The same measurement drove the second half of this module: every failure
// in that run was model-authored POSITIONAL metadata — a JSON {find, add}
// whose 4-char `find` ("seed") named three different referents in one arena,
// which the every:true rescue then corrupted. The house law already covers
// this one register down (build-log.js::deriveOp exists because "both small
// models say INS while supplying a replacement" — labels lie, bytes don't).
// Generalized here: the model only ever emits CODE, its native medium; the
// delta is DERIVED from the bytes (deltaOps — common prefix/suffix trim,
// anchor grown until unique by construction), so ambiguity is structurally
// impossible and applyOps's strict wall always lands. No model-authored
// find, no JSON, no rescue.
//
// Pure, organs injected (the cast.js pattern): `suffixes` is the engine's
// received INFLECTIONAL_SUFFIXES prior (giver lang/en), the same Set
// widget.js::scoutSpan already requires, so both scouts share one fold
// discipline. Tokenization here is the IDENTIFIER grammar
// ([A-Za-z_$][\w$]*), deliberately not source.js::tokenize — prose
// tokenize splits "exceeds_witness" into "exceeds"+"witness" (measured),
// and an instruction quoting that gap type must never resolve to the
// `witness` function through the fragment. Code's medium, code's tokens.
//
// Byte addressing stays the engine's: callers who hold a session snip the
// resolved span through host/corpus.js::snipRange so the arena carries a
// real {source, byte_start, byte_end} address with provenance registered —
// this module's spans are JS-string char offsets (the c-space of the
// coordinate rule in CLAUDE.md) and never pretend otherwise.
//
// DISCLOSED LIMITS (an independent adversarial completeness review,
// 2026-08-25, ranked these — named here at the point of use, not fixed
// under time pressure):
// · Quoteless disambiguation has no declared run-length floor or margin —
//   when an instruction quotes nothing verbatim, longestSharedRun still
//   ranks candidates by incidental shared English runs, and the tie
//   refusal fires only on exact equality. A caller-declared floor (the
//   minActivation/minMargin standing — never defaulted) is the right
//   shape and is future work; today the mechanism is validated on
//   instructions that do quote or name a single referent.
// · The statement walkers have no regex-literal mode — a top-level
//   declaration whose initializer holds /;/ or /}/ mislexes and the span
//   can overshoot into the next declaration. This codebase is regex-dense;
//   real risk, not hypothetical.
// · DECL_RE misses `async function`, `export default`, destructuring
//   consts, generators, and class methods — most misses land as honest
//   no_referent_named refusals, but an instruction naming an invisible
//   referent plus an incidental declared name can resolve WRONG, with no
//   wall.
// · scoutDefinition resolves to ONE declaration; instructions requiring
//   coordinated multi-referent edits have no typed refusal of their own
//   yet, and extractDeclaration keeps only the named declaration from a
//   reply that edited two.
// · extractDeclaration's export restoration is unconditional on the
//   arena's exportedness — an instruction that ASKS to un-export would be
//   silently reverted.

const IDENT_RE = /[A-Za-z_$][\w$]*/g;

// ── the statement walker ────────────────────────────────────────────────
// A cheap text walk, not a parser (the store-sql.js posture: walk honestly
// where the shape is simple, refuse to guess where it isn't). Tracks
// strings ('' "" ``), line and block comments, and bracket depth over
// (){}[]. Template-literal ${...} interpolations are handled by treating
// `${` inside a template as re-entering code depth.
function walkStatementEnd(src, from) {
  let depth = 0;
  let i = from;
  const n = src.length;
  let mode = "code"; // code | line | block | squote | dquote | template
  const templateStack = [];
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (mode === "line") {
      if (ch === "\n") mode = "code";
      i++;
      continue;
    }
    if (mode === "block") {
      if (ch === "*" && next === "/") {
        mode = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (mode === "squote" || mode === "dquote") {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if ((mode === "squote" && ch === "'") || (mode === "dquote" && ch === '"')) mode = "code";
      i++;
      continue;
    }
    if (mode === "template") {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        mode = "code";
        i++;
        continue;
      }
      if (ch === "$" && next === "{") {
        templateStack.push(depth);
        depth++;
        mode = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    // mode === "code"
    if (ch === "/" && next === "/") {
      mode = "line";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      mode = "block";
      i += 2;
      continue;
    }
    if (ch === "'") {
      mode = "squote";
      i++;
      continue;
    }
    if (ch === '"') {
      mode = "dquote";
      i++;
      continue;
    }
    if (ch === "`") {
      mode = "template";
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      i++;
      if (templateStack.length && depth === templateStack[templateStack.length - 1]) {
        templateStack.pop();
        mode = "template";
      }
      continue;
    }
    if (ch === ";" && depth === 0) return i + 1;
    i++;
  }
  return n;
}

// For `function NAME(...) {...}` / `class NAME ... {...}` the statement has
// no terminating `;` — the end is the close of the body brace block.
function walkBraceBlockEnd(src, from) {
  // Reuse the statement walker's discipline but stop when depth returns to
  // zero AFTER having been raised by the body's own brace. walkStatementEnd
  // already stops at `;` at depth 0, which a function declaration never
  // reaches before its body closes — so walk manually here with the same
  // string/comment skipping by delegating per-character is not possible
  // without duplicating state; instead: find the end as the first position
  // where depth returns to 0 after the first `{`.
  let depth = 0;
  let seenBrace = false;
  let i = from;
  const n = src.length;
  let mode = "code";
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (mode === "line") {
      if (ch === "\n") mode = "code";
      i++;
      continue;
    }
    if (mode === "block") {
      if (ch === "*" && next === "/") {
        mode = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (mode === "squote" || mode === "dquote" || mode === "template") {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if ((mode === "squote" && ch === "'") || (mode === "dquote" && ch === '"') || (mode === "template" && ch === "`")) mode = "code";
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      mode = "line";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      mode = "block";
      i += 2;
      continue;
    }
    if (ch === "'") {
      mode = "squote";
      i++;
      continue;
    }
    if (ch === '"') {
      mode = "dquote";
      i++;
      continue;
    }
    if (ch === "`") {
      mode = "template";
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      if (ch === "{") seenBrace = true;
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      i++;
      if (seenBrace && depth === 0) return i;
      continue;
    }
    i++;
  }
  return n;
}

// ── declaredReferents ───────────────────────────────────────────────────
// Every top-level (column-0) declaration in the code, with the span of its
// whole declaration statement — the referent's contextual definition.
// Column-0 is a disclosed limit, not an accident: this codebase's modules
// are top-level-flat, and an INNER const (difference's own `censoredAt`) is
// deliberately not a top-level referent — it is defined contextually WITHIN
// its function, which is exactly why the function's span is the arena for
// an instruction naming it.
const DECL_RE = /^(export\s+)?(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

export function declaredReferents(code) {
  const text = String(code ?? "");
  const out = [];
  DECL_RE.lastIndex = 0;
  let m;
  while ((m = DECL_RE.exec(text))) {
    // ^ with /m matches any line start; top-level means column 0 with no
    // leading whitespace — the regex's ^ already anchors to line start and
    // the first char matched is `e`/`c`/`l`/`v`/`f`, so indented
    // declarations never match (the pattern has no leading \s*).
    const start = m.index;
    const kind = m[2];
    const name = m[3];
    const end =
      kind === "function" || kind === "class"
        ? walkBraceBlockEnd(text, m.index + m[0].length)
        : walkStatementEnd(text, m.index + m[0].length);
    out.push({ name, kind, exported: !!m[1], start, end });
  }
  return out;
}

// ── scoutDefinition ─────────────────────────────────────────────────────
// Resolve an instruction to the ONE declared referent it is about, and
// return that referent's definition span. Typed results, never a guess
// (P4 — a gap is a result):
//   { name, span, candidates }            — resolved
//   { gap: "no_referent_named" }          — the instruction names nothing
//                                           this code declares (the wall
//                                           scoutSpan's fallback lacks:
//                                           "frobnicate"/"make it better"
//                                           land here, zero model calls)
//   { gap: "ambiguous_referent", candidates } — several named, context
//                                           cannot separate them
//
// Disambiguation among several named referents is by QUOTATION, mechanically:
// the longest verbatim character run shared between the instruction and each
// candidate's own definition decides — a quote can only come from the
// referent that holds those bytes. Two designs were tried and refuted on the
// real witness case before this one (kept here so they are not retried,
// eoreader6.1's own reconcile-don't-retry discipline): (1) distinct-word
// containment counting scored pattern 28 vs witness 11 purely because
// pattern's definition is ~12x longer — sheer span size hoards vocabulary;
// (2) discriminative exclusive-word voting (only words present in exactly
// one candidate vote — the null-arm rule) still scored pattern 14 vs
// witness 3, because a long definition's COMMENT PROSE hoards exclusive
// English filler ("the", "by", "already", "instead"). The quotation run has
// neither bias: the witness instruction carries a ~112-char verbatim quote
// of witness's own guard line, and no amount of span length can fabricate a
// longer shared run in a definition that does not contain those bytes.
// Verbatim means byte-verbatim — no fold, no case-drop (disclosed; an
// instruction quoting code quotes it exactly). Strict max wins; a tie is a
// typed refusal, never a guess.
// Longest common substring length (classic DP, rolling row). Sizes here are
// an instruction (~hundreds of chars) x a definition (~hundreds to a few KB)
// — millions of cell ops at worst, milliseconds in practice.
function longestSharedRun(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let prev = new Int32Array(m + 1);
  let cur = new Int32Array(m + 1);
  let best = 0;
  for (let i = 1; i <= n; i++) {
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      if (ca === b.charCodeAt(j - 1)) {
        const v = prev[j - 1] + 1;
        cur[j] = v;
        if (v > best) best = v;
      } else cur[j] = 0;
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return best;
}

export function scoutDefinition(message, code, suffixes) {
  const text = String(code ?? "");
  if (!text) return { gap: "no_referent_named" };
  if (!(suffixes instanceof Set) || !suffixes.size)
    throw new TypeError("scoutDefinition: suffixes must come from the engine's prior register");

  const decls = declaredReferents(text);
  if (!decls.length) return { gap: "no_referent_named" };
  const byName = new Map(decls.map((d) => [d.name, d]));
  const lowerIndex = new Map();
  for (const d of decls) {
    const l = d.name.toLowerCase();
    lowerIndex.set(l, lowerIndex.has(l) ? null : d); // null = case-collision, refuse the fold
  }

  const words = String(message ?? "").match(IDENT_RE) ?? [];
  const strip = (w) => {
    const outs = [w];
    const lower = w.toLowerCase();
    for (const suf of suffixes) {
      if (lower.length > suf.length + 2 && lower.endsWith(suf)) outs.push(lower.slice(0, -suf.length));
    }
    return outs;
  };

  const candidates = new Map(); // name -> decl
  for (const w of words) {
    for (const form of strip(w)) {
      const exact = byName.get(form);
      if (exact) {
        candidates.set(exact.name, exact);
        continue;
      }
      const folded = lowerIndex.get(form.toLowerCase());
      if (folded) candidates.set(folded.name, folded);
    }
  }
  if (!candidates.size) return { gap: "no_referent_named" };
  if (candidates.size === 1) {
    const d = [...candidates.values()][0];
    return { name: d.name, span: [d.start, d.end], candidates: [d.name] };
  }

  // Quotation disambiguation: longest verbatim run shared between the
  // instruction and each candidate's own definition bytes.
  const msg = String(message ?? "");
  const scores = new Map();
  for (const [name, d] of candidates) {
    scores.set(name, longestSharedRun(msg, text.slice(d.start, d.end)));
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1])
    return { gap: "ambiguous_referent", candidates: ranked.map(([n, s]) => ({ name: n, score: s })) };
  const d = candidates.get(ranked[0][0]);
  return {
    name: d.name,
    span: [d.start, d.end],
    candidates: ranked.map(([n, s]) => ({ name: n, score: s })),
  };
}

// ── deltaOps ────────────────────────────────────────────────────────────
// The physics of an edit: given the arena's text BEFORE and the model's
// regenerated text AFTER, derive the one {find, add} op mechanically —
// common prefix and suffix trimmed off, the anchor then GROWN symmetrically
// until `find` occurs exactly once in BEFORE. The op is unique by
// construction, so applyOps's strict wall always lands it and the
// every:true rescue is never reached — the rescue was the corrupter in
// both syntax-broken cases of the measured run, converting a
// refusable-ambiguous model `find` into landed garbage.
//
// Returns { find, add } or null when before === after (churn — the log's
// own refusal, not this organ's).
export function deltaOps(before, after) {
  const a = String(before ?? "");
  const b = String(after ?? "");
  if (a === b) return null;
  let p = 0;
  const maxP = Math.min(a.length, b.length);
  while (p < maxP && a[p] === b[p]) p++;
  let s = 0;
  const maxS = Math.min(a.length, b.length) - p;
  while (s < maxS && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;

  const coreFind = a.slice(p, a.length - s);
  const coreAdd = b.slice(p, b.length - s);

  // Grow context symmetrically until the find is unique in BEFORE.
  let left = p;
  let right = a.length - s;
  const countIn = (hay, needle) => (needle.length ? hay.split(needle).length - 1 : Infinity);
  let find = coreFind;
  while (countIn(a, find) !== 1 && (left > 0 || right < a.length)) {
    left = Math.max(0, left - 8);
    right = Math.min(a.length, right + 8);
    find = a.slice(left, right);
  }
  if (countIn(a, find) !== 1) return null; // structurally impossible unless before is empty
  const add = b.slice(left, b.length - (a.length - right));
  return { find, add, changed: [p, a.length - s], core: { find: coreFind, add: coreAdd } };
}

// ── extractDeclaration ──────────────────────────────────────────────────
// Read the model's reply in its native medium: a fenced code block (or the
// bare reply) holding the complete regenerated declaration of `name`.
// Mechanical, tolerant the way folds-pane's pickRevisionSegment already is
// (a dropped language tag, prose around the fence). One disclosed
// normalization: a model shown `export const X` conventionally re-emits
// `const X` — the export keyword is module plumbing, and its silent loss
// would read as a deletion the model never chose and break every
// downstream importer; when the arena's declaration was exported and the
// reply's is not, the prefix is restored and the result says so
// (`exportRestored: true`), never silently.
export function extractDeclaration(reply, name, { exported = false } = {}) {
  const text = String(reply ?? "");
  const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const bodies = fences.length ? fences : [text];
  const re = new RegExp(`(?:export\\s+)?(const|let|var|function|class)\\s+${name.replace(/[$]/g, "\\$&")}(?![\\w$])`);
  for (const body of bodies) {
    const m = re.exec(body);
    if (!m) continue;
    const kind = m[1];
    const end =
      kind === "function" || kind === "class"
        ? walkBraceBlockEnd(body, m.index + m[0].length)
        : walkStatementEnd(body, m.index + m[0].length);
    let decl = body.slice(m.index, end);
    let exportRestored = false;
    if (exported && !/^export\s/.test(decl)) {
      decl = `export ${decl}`;
      exportRestored = true;
    }
    return { text: decl, exportRestored };
  }
  return null;
}
