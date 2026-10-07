// adapters/code/language.js — the code channel's generative face.
//
// The reader side (code-structure.js) LEARNS a language discriminatively:
// which shapes count as declarations, which words can never be names.
// This module turns the same received priors into GENERATIVE knowledge —
// prompt-ready scaffolding a mouth (a model asked to WRITE a patch) can
// actually use, and a remedy note Thea's callers can attach when a failure
// is language-shaped. One source of truth throughout: the vendored
// CodeKeywordPrior@1 files (native/priors/code-kw-*.json) and
// code-structure.js's RECIPES (cross-cited by LanguageLawPrior@1's own
// declarationRecipes for python). Nothing here is hand-typed language law;
// the only authored content is the worked-example illustration, disclosed
// as such — and the loop's physics (find must match real bytes, the real
// test command decides) still validates every byte the mouth emits.
//
// Two disciplines:
//   GENERATIVE, NEVER NORMATIVE — these strings SUGGEST shapes to the
//   mouth; they never decide. A patch that ignores every hint but lands
//   byte-exact and green is kept; a patch that follows every hint but
//   fails bytes or tests is reverted. Scaffolding, not law.
//   RECEIVED, NEVER RE-TYPED — keyword lists come from the loaded prior
//   at call time (loadCodeKeywordPrior), never copied here. If the prior
//   is absent the brief says so and the loop behaves exactly as before.

import { loadCodeKeywordPrior } from "../text/code-structure.js";

const EXT_TO_LANGUAGE = Object.freeze({
  ".py": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".c": "c",
  ".h": "c",
  ".go": "go",
});

/** detectCodeLanguage(fileName) -> 'python' | 'javascript' | 'typescript'
 *  | 'c' | 'go' | null. Extension map only — never content-guessed, so a
 *  stranger is `null` (admit, disclose), never a wrong language. */
export function detectCodeLanguage(fileName) {
  const name = String(fileName ?? "");
  const i = name.lastIndexOf(".");
  if (i === -1) return null;
  return EXT_TO_LANGUAGE[name.slice(i).toLowerCase()] ?? null;
}

// Illustrative anchor shapes per language — the RECIPES' own shapes,
// rendered for a mouth that has never seen this repo's parser. Disclosed
// as illustration at the point of use; only exact file bytes ever apply.
const ANCHOR_SHAPES = Object.freeze({
  python: ["def name(params):", "async def name(params):", "class Name(Base):"],
  javascript: ["function name(params) {", "class Name {", "const name = (params) => {"],
});

/** anchorShapesFor(language) -> illustrative declaration lines, or null
 *  when this module carries no received shapes for the language. */
export function anchorShapesFor(language) {
  return ANCHOR_SHAPES[String(language ?? "").toLowerCase()] ?? null;
}

/** generationBriefFor(language) -> prompt-ready scaffolding block, or null.
 *  Keywords are read off the loaded prior at call time (received); the
 *  shapes are the illustrative anchors above (disclosed as such inside
 *  the block). Null when there is no prior AND no shapes — the caller
 *  then behaves exactly as before, no silent downgrade. */
export function generationBriefFor(language) {
  const lang = String(language ?? "").toLowerCase();
  const shapes = anchorShapesFor(lang);
  const prior = loadCodeKeywordPrior(lang);
  if (!shapes && !prior) return null;
  const lines = [];
  const title = lang ? lang[0].toUpperCase() + lang.slice(1) : lang;
  lines.push(`This file is ${title}. Anchor every FIND on a real declaration line shaped like: ${shapes ? shapes.join("  /  ") : "(no received shapes — copy lines exactly as shown in the file)"}.`);
  if (prior?.keywords?.length) {
    // Gary's law (P55): facts the mouth can reason from, never prohibitions
    // ("never propose X" teaches a small model to say X) and never apparatus
    // vocabulary (schema names stay in code and round records, not prompts).
    // P55-compliant AND conservative: a positive instruction (allowed —
    // Gary bans prohibitions, not instructions), no apparatus terms, and
    // the fence the old "Never propose…" provided: invent no names.
    // A/B 2026-09-19: old wording + example = 75%, this wording + example
    // = 70% — one task apart (Basic/20), same failed core otherwise;
    // within sampling until replicated. The door holds either way.
    lines.push(`Declared names come from outside this received closed class (${prior.keywords.length} hard keywords — they cannot name anything): ${prior.keywords.join(", ")}. Invent no names of your own: every name your patch declares is already declared in the file above.`);
  } else {
    lines.push(`No keyword list is loaded for ${title} — every captured name is admitted (disclosed, not a silent skip).`);
  }
  lines.push(`(Shapes illustrative; only exact file bytes apply, and the real test command decides.)`);
  return lines.join("\n");
}

// A declaration-shape line from ANOTHER language inside this file's find —
// checked mechanically (line-anchored regexes over the proposal's own
// bytes), never judged. Each entry names the shape, the language it
// belongs to, and the hint for the file's own language.
const FOREIGN_SHAPES = [
  { lang: "javascript", re: /^[ \t]*(?:function\s+[A-Za-z_$]|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(?[^=]*?\)?\s*=>)/m, hint: "anchor on `def name(` / `class Name(` lines" },
  { lang: "python", re: /^[ \t]*(?:def\s+[A-Za-z_]|:?async\s+def\s+)/m, hint: "anchor on `function name(` / `class Name` / `const name = (` lines" },
];

/** mismatchNoteFor({ fileName, find }) -> string | null. A language-shaped
 *  nudge for a patch that failed to locate: the proposal's own bytes carry
 *  another language's declaration shape. Returns null for an ordinary
 *  unlocated find (the loop keeps its existing nudge) and whenever either
 *  side's language is unknown — a stranger is never misdiagnosed. */
export function mismatchNoteFor({ fileName, find } = {}) {
  const lang = detectCodeLanguage(fileName);
  if (!lang || lang === "typescript" || lang === "c" || lang === "go") return null;
  const text = String(find ?? "");
  if (!text) return null;
  for (const shape of FOREIGN_SHAPES) {
    if (shape.lang === lang) continue;
    if (shape.re.test(text)) {
      const own = lang === "python" ? "Python" : "JavaScript";
      const other = shape.lang === "python" ? "Python" : "JavaScript";
      return `Mechanical note: your FIND carries a ${other}-shaped declaration line but "${fileName}" is ${own} (received CodeKeywordPrior@1) — ${shape.hint}. Copy the FIND byte-for-byte from the file shown above.`;
    }
  }
  return null;
}
