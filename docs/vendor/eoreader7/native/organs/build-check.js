// Handle: Rutherford — judge the thing by what it does when you hit it, not by
// what it looks like: the build is scored on what the page shows and what the
// program prints, against checks written from the request's own words.
//
// build-check.js — the EVA for a build: a request (from
// native/eval/build-battery/requests.json) and the facts of what came back
// (a page's visible text and element tree from page-facts.py, or a program's
// printed output) -> a verdict per check, and a verdict for the request.
//
// NO PATTERNS. Nothing here is a regular expression. Words come from walking
// the characters (a letter or digit continues a word; anything else ends
// one); a phrase is present when its words occur in order; a raw mark ("$",
// "?", "37.7") is found by kleene-up's needle measurement at a byte address;
// separate items are the innermost page blocks (or the program's lines) that
// contain a match. A check that cannot be measured says so; it never passes
// by default.

import { findNeedles } from "../kernel/kleene-up.js";

export const BUILD_CHECK_SCHEMA = "BuildCheck@1";

const isDigit = (ch) => ch >= "0" && ch <= "9";
const isLetter = (ch) => ch.toLowerCase() !== ch.toUpperCase();

/** Words of a text, lower-cased: a run of letters or digits is a word. */
export function wordsOf(text) {
  const out = [];
  let cur = "";
  for (const ch of String(text ?? "")) {
    if (isLetter(ch) || isDigit(ch)) cur += ch.toLowerCase();
    else if (cur) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}

/** True when the phrase's words occur in order, adjacent, in `words`. */
export function hasPhrase(words, phrase) {
  const want = wordsOf(phrase);
  if (!want.length) return false;
  for (let i = 0; i + want.length <= words.length; i++) {
    let j = 0;
    while (j < want.length && words[i + j] === want[j]) j++;
    if (j === want.length) return true;
  }
  return false;
}

const hasMark = (text, mark) => findNeedles(String(text ?? ""), [mark]).found?.length > 0;

/** Does a text satisfy a spec? `any`/`marks`: one of them present; `all`:
 *  every listed phrase present. */
export function satisfies(text, spec) {
  const words = wordsOf(text);
  if (Array.isArray(spec.all) && spec.all.length) return spec.all.every((p) => hasPhrase(words, p) || hasMark(text, p));
  return (spec.any ?? []).some((p) => hasPhrase(words, p)) || (spec.marks ?? []).some((m) => hasMark(text, m));
}

/** Distinct phrases from `any` that are present. */
export function presentPhrases(text, list) {
  const words = wordsOf(text);
  return list.filter((p) => hasPhrase(words, p) || (wordsOf(p).length === 0 && hasMark(text, p)));
}

const BLOCKS = new Set(["li", "article", "section", "div", "tr", "td", "p", "dd", "dt", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "figure", "figcaption", "pre", "label", "form", "fieldset", "details", "summary", "header", "footer", "aside", "main", "nav", "table", "ul", "ol", "dl"]);

const subtreeText = (node) => [node.x, ...(node.c ?? []).map(subtreeText)].filter(Boolean).join(" ");

/** The innermost page blocks whose text satisfies the spec: a block counts
 *  when it matches and no block inside it matches (so a list and its items
 *  are one count per item, never the list plus its items). */
export function innermostMatches(tree, spec) {
  const hits = [];
  const walk = (node) => {
    let below = false;
    for (const child of node.c ?? []) if (walk(child)) below = true;
    if (below) return true;
    if (BLOCKS.has(node.t) && satisfies(subtreeText(node), spec)) { hits.push(subtreeText(node)); return true; }
    return false;
  };
  if (tree) walk(tree);
  return hits;
}

/** Split a program's output into its non-empty lines, without a pattern. */
export function linesOf(text) {
  return String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

/** The facts of a built artifact, in the shape the checks read.
 *  kind: "page" | "program" | "none"; text: what it shows or prints;
 *  items(spec): its separate items that satisfy spec; controls: form controls. */
export function factsOf({ kind, page = null, run = null }) {
  if (kind === "page" && page) {
    return { kind, ran: true, text: page.text ?? "", title: page.title ?? "", controls: page.controls ?? {}, items: (spec) => innermostMatches(page.tree, spec) };
  }
  if (kind === "program" && run) {
    const out = run.stdout ?? "";
    return { kind, ran: run.exit === 0 && !run.timedOut, exit: run.exit, text: out, controls: {}, items: (spec) => linesOf(out).filter((l) => satisfies(l, spec)) };
  }
  return { kind: "none", ran: false, text: "", controls: {}, items: () => [] };
}

/** Score one request against the facts of what was built. */
export function checkBuild(request, facts, { cafe = [] } = {}) {
  const results = [];
  const want = request.kind ?? "any";
  const kindOk = want === "any" ? facts.kind !== "none" : facts.kind === want;
  results.push({ id: "kind", what: `it is a ${want === "any" ? "page or a program" : want}`, pass: kindOk, detail: `built a ${facts.kind}` });
  if (facts.kind === "program") results.push({ id: "runs", what: "the program runs to the end", pass: facts.ran, detail: facts.ran ? "exit 0" : `exit ${facts.exit}` });
  for (const c of request.checks ?? []) {
    let pass = false, detail = "";
    if (c.present) {
      pass = satisfies(facts.text, c.present);
      detail = pass ? "found" : "not found in what it shows";
    } else if (c.distinct) {
      const got = presentPhrases(facts.text, c.distinct.any);
      pass = got.length >= c.distinct.min;
      detail = `${got.length} of ${c.distinct.min} (${got.join(", ") || "none"})`;
    } else if (c.repeats) {
      const got = facts.items(c.repeats).length;
      pass = got >= c.repeats.min;
      detail = `${got} separate item(s), need ${c.repeats.min}`;
    } else if (c.absent) {
      const got = presentPhrases(facts.text, c.absent.any);
      pass = got.length === 0;
      detail = pass ? "none present" : `present: ${got.join(", ")}`;
    } else if (c.cafe) {
      const got = presentPhrases(facts.text, cafe);
      pass = got.length === 0;
      detail = pass ? "none present" : `present: ${got.join(", ")}`;
    } else if (c.controls) {
      const n = ["input", "button", "textarea", "select"].reduce((a, k) => a + (facts.controls?.[k] ?? 0), 0);
      pass = facts.kind === "page" ? n >= c.controls.min : facts.kind === "program";
      detail = facts.kind === "page" ? `${n} control(s), need ${c.controls.min}` : "a program takes its input another way";
    } else {
      detail = "unknown check shape — not measured";
    }
    // nothing counts for an artifact of the wrong kind or one that never ran
    if (!kindOk) { pass = false; detail = `not measured: ${detail}`; }
    results.push({ id: c.id, what: c.what, pass, detail });
  }
  return { schema: BUILD_CHECK_SCHEMA, id: request.id, pass: results.every((r) => r.pass), passed: results.filter((r) => r.pass).length, total: results.length, results };
}
