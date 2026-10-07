// witness.js — what a landing actually did, read mechanically.
//
// The measured case this organ exists for (2026-08-17, live e2e against
// qwen2.5-coder:1.5b): asked to "change the plus button to blue", the model
// supplied `SYN "inc" → "style='background:blue'"` — mechanically perfect,
// exactly-once-per-place, and it clobbered the button's id AND the
// getElementById call that addressed it. Every wall passed, because every
// wall checked APPLICABILITY. This module checks the cheapest honest slice
// of INTENT-INDEPENDENT integrity: does the artifact still hold together as
// an artifact — scripts that parse, references that resolve, a document
// that closes what it opens. It is not a judge of whether the change was
// what the operator wanted (nothing mechanical can be); it is the tripwire
// for the changes that broke the artifact on the way to trying.
//
// L5 discipline throughout: the witness is computed, never asked. A model's
// "yes that worked" is exactly the compliance-critical self-report this
// repo never trusts. And the verdict is never a bare boolean in disguise:
// `ok` summarizes, `findings` carry each defect with its kind and the bytes
// involved, and material this module cannot judge is `unexamined: true` —
// a gap, never a silent clean (grounding.js's own examined/clean line).
//
// Pure: no DOM, no network, no engine — parseable in the page and in node.
// Script syntax is checked with the host's own Function constructor
// (compile only, NEVER invoked — consent to execute stays with the ▶ run
// affordance, per the RENDERABLE gate's own rule).

/** The <script> bodies of an html document, with a quote-aware attribute
 * walk on the open tag — web.js's measured lesson: attribute values legally
 * contain ">", so a naive [^>]* walk truncates real documents. */
export function scriptBodies(html) {
  const out = [];
  const s = String(html ?? "");
  const re = /<script\b/gi;
  let m;
  while ((m = re.exec(s))) {
    // Walk the open tag honoring quoted attribute values.
    let i = m.index + m[0].length;
    let q = null;
    while (i < s.length) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === ">") break;
      i++;
    }
    if (i >= s.length) break;
    const close = s.indexOf("</script", i + 1);
    if (close === -1) break;
    out.push(s.slice(i + 1, close));
    re.lastIndex = close;
  }
  return out;
}

/** Every id the markup declares (id="x" / id='x'), outside script bodies. */
export function declaredIds(html) {
  const s = String(html ?? "");
  const ids = new Set();
  const re = /\bid\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(s))) {
    const v = m[2] ?? m[3];
    if (v) ids.add(v);
  }
  return ids;
}

/** Every id the scripts address — getElementById("x") and querySelector
 * variants with a plain #x selector. Selector strings with combinators are
 * left unexamined rather than half-parsed. */
export function referencedIds(scripts) {
  const ids = new Set();
  for (const body of scripts) {
    let m;
    const byId = /getElementById\s*\(\s*("([^"]*)"|'([^']*)'|`([^`]*)`)\s*\)/g;
    while ((m = byId.exec(body))) ids.add(m[2] ?? m[3] ?? m[4]);
    const q = /querySelector(?:All)?\s*\(\s*("#([\w-]+)"|'#([\w-]+)'|`#([\w-]+)`)\s*\)/g;
    while ((m = q.exec(body))) ids.add(m[2] ?? m[3] ?? m[4]);
  }
  ids.delete(undefined);
  ids.delete("");
  return ids;
}

/** Compile-check one script body. Returns null when clean, else the error
 * message. Compilation only — the body is never run. */
function compiles(body) {
  try {
    new Function(body);
    return null;
  } catch (err) {
    return String(err && err.message ? err.message : err);
  }
}

/**
 * Witness an html artifact. Findings, each typed:
 *   script-syntax   — a <script> body does not parse
 *   dangling-id     — a script addresses an id no element declares
 *   unclosed-root   — the document opens <html> and never closes it
 */
export function witnessHtml(code) {
  const findings = [];
  const scripts = scriptBodies(code);
  for (const body of scripts) {
    const err = compiles(body);
    if (err) findings.push({ kind: "script-syntax", detail: err });
  }
  const declared = declaredIds(code);
  for (const id of referencedIds(scripts)) {
    if (!declared.has(id)) {
      findings.push({ kind: "dangling-id", detail: `script addresses id "${id}" but no element declares it`, id });
    }
  }
  const s = String(code ?? "");
  if (/<html\b/i.test(s) && !/<\/html\s*>/i.test(s)) {
    findings.push({ kind: "unclosed-root", detail: "the document opens <html> and never closes it" });
  }
  return { ok: findings.length === 0, lang: "html", findings };
}

/**
 * Does `next`'s witness introduce a defect `prev`'s did not already have?
 *
 * The measured gap this closes (2026-08-17, live e2e against gemma2:2b): a
 * canvas drawing app's clear button lost its `addEventListener('click', …)`
 * to one patch, then lost its `id` entirely to the next — three complaints
 * in a row, each one witnessed dirty, each one LANDED anyway, because the
 * witness ran only after the fact and never compared against what came
 * before. Every attempt passed the only gate that existed (does it apply?)
 * while the artifact got steadily worse. This is P5 (production closes on
 * the fold) applied to a patch: a repair is only promoted if it does not
 * regress on a check the ground already had an answer for.
 *
 * The comparison is by finding IDENTITY (kind + the specific id or detail
 * it names), never by count alone — two DIFFERENT dangling-id findings do
 * not cancel out just because there is "still one finding". A candidate
 * that clears every prior finding (a subset, including the empty set) is
 * an improvement and is never a regression, whatever its count.
 *
 * `prev` may be null — the very first landing has nothing to regress
 * against. Either witness being `unexamined` (a language this module
 * cannot read) means there is nothing to compare: neither a pass nor a
 * fail can regress against a gap.
 */
export function witnessRegressed(prev, next) {
  if (!prev || prev.unexamined || !next || next.unexamined) return false;
  if (prev.ok === true) return next.ok !== true;
  const keyOf = (f) => `${f.kind}:${f.id ?? f.detail ?? ""}`;
  const prevKeys = new Set((prev.findings ?? []).map(keyOf));
  for (const f of next.findings ?? []) {
    if (!prevKeys.has(keyOf(f))) return true;
  }
  return false;
}

/**
 * Witness any artifact the module knows how to read. Languages it cannot
 * judge return `{ok: null, unexamined: true}` — a typed gap, never a
 * silent clean.
 */
export function witnessCode(lang, code) {
  const l = String(lang ?? "").toLowerCase();
  if (l === "html") return witnessHtml(code);
  if (l === "js" || l === "javascript") {
    const err = compiles(code);
    return { ok: !err, lang: l, findings: err ? [{ kind: "script-syntax", detail: err }] : [] };
  }
  if (l === "svg") {
    const s = String(code ?? "");
    const open = /<svg\b/i.test(s);
    const closed = /<\/svg\s*>/i.test(s);
    return open && !closed
      ? { ok: false, lang: l, findings: [{ kind: "unclosed-root", detail: "the svg opens and never closes" }] }
      : { ok: true, lang: l, findings: [] };
  }
  return { ok: null, lang: l, findings: [], unexamined: true };
}
