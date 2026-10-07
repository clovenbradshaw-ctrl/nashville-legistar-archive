/* Strunk & White speaks:
 * “Vigorous writing is concise. A sentence should contain no unnecessary
words, a paragraph no unnecessary sentences, for the same reason that a
drawing should have no unnecessary lines and a machine no unnecessary
parts. This requires not that the writer make all his sentences short,
or that he avoid all detail and treat his subjects only in outline, but
that he make every word tell.”
 *
 * This file implements the principles laid out in "The Elements of Style" by William Strunk Jr. and E.B. White.  It governs the "proofreading" process, ensuring that the code remains as concise and clear as possible, while preserving the integrity of the original work.  I believe the focus on conciseness can sometimes lead to a loss of nuance and depth in the code, but this is a necessary trade-off for the purpose of clarity.
 *
 * — the engineering record below, kept whole —
 */
// organs/strunk-white.js — THE STYLE AGENT: how a piece reads, and the rules
// of style that make it read well.
// Handle: Strunk & White — after William Strunk Jr. and E. B. White, The
// Elements of Style: "Omit needless words. Vigorous writing is concise." This
// is the agent that OWNS the style-checking family — readability (Flesch/
// grade/fog), the classic style rules (weasel words, needless words,
// clichés, passive voice, nominalizations), and the mechanical fixes. It
// complements Fisher (repeated openings), detectRedundancy (repeated facts
// and templates), and Brillat-Savarin (the seasoning rewrite). Strunk & White
// DETECT; Brillat-Savarin seasons; both record EOT transforms.
//
// Every check here is deterministic and in-process — a declared rule with a
// named giver, never a model's guess (the style rules are the point, like
// the grammar-lens's Thrax reading: a closed rule set anyone can audit).
import { readabilityGrade as jsReadability } from "./readability.js";

// ── THE ELEMENTS OF STYLE: the rule detectors ──────────────────────────────
// Each is a REGEX + a named rule (the classic Elements rule it enforces) +
// a fix hint. Mechanical: same text → same findings, auditable.
const WEAK_VERBS = /(?:was|were|is|are|has been|had been|there is|there are|there was|there were|it is)\b/gi;
const WEAK_ADVERBS = /\b(?:very|really|quite|extremely|totally|completely|absolutely|basically|essentially|actually|literally)\b/gi;
const WEASEL_WORDS = /\b(?:some people say|experts say|it is said|it is believed|it is widely believed|there is no doubt that|in my opinion|in our opinion|it is important to note|note that|arguably)\b/gi;
const CLICHES = /\b(?:at the end of the day|in today's world|in this day and age|the fact of the matter|last but not least|think outside the box|a needle in a haystack|the tip of the iceberg|in the final analysis|it goes without saying|easier said than done|all in all|for all intents and purposes)\b/gi;
const PASSIVE = /\b(?:is|are|was|were|has been|have been|had been|being)\s+(?:[a-z]+ed|[a-z]+en)\b/gi;
const NOMINALIZATIONS = /\b(?:the (?:utilization|implementation|realization|organization|formalization|characterization|theorization|prioritization|visualization) of)\b/gi;
const NEEDLESS_WORDS = /\b(?:in order to|due to the fact that|in terms of|with regard to|at the present time|in the near future|for the purpose of|a large number of|a majority of|in the process of)\b/gi;

const RULES = [
  { id: "weak_verb", re: WEAK_VERBS, rule: "Use the active voice — a strong verb carries the sentence (Elements §II.13).", fix: "replace 'there is/are' and weak copulas with an active verb" },
  { id: "weak_adverb", re: WEAK_ADVERBS, rule: "Omit needless adverbs — 'very' weakens the word it means to strengthen (Elements §II.13).", fix: "drop the adverb or choose a stronger word" },
  { id: "weasel_word", re: WEASEL_WORDS, rule: "No weasel words — 'experts say' hedges the claim the piece must stand behind (proselint's weasel check).", fix: "state the claim plainly, with its witness" },
  { id: "cliche", re: CLICHES, rule: "Avoid clichés — 'at the end of the day' says nothing a reader did not already know (Elements §II.14).", fix: "say what is meant directly" },
  { id: "passive", re: PASSIVE, rule: "Prefer the active voice — the subject acts, it is not acted upon (Elements §II.13).", fix: "make the doer the subject" },
  { id: "nominalization", re: NOMINALIZATIONS, rule: "Avoid nominalizations — 'the utilization of' buries the verb (Elements §II.13).", fix: "use the verb: 'utilize' → 'use'" },
  { id: "needless_word", re: NEEDLESS_WORDS, rule: "Omit needless words — 'due to the fact that' is three words for 'because' (Elements §II.13).", fix: "cut the phrase to its essential word" },
];

// ── THE STYLE REPORT ───────────────────────────────────────────────────────
// Every finding names the rule, the matched words (with spans), and the fix.
// `findRule` is mechanical; the report is EOT-recordable (each finding is a
// typed style violation with the bytes it names).
export function styleFindings(text) {
  const t = String(text ?? "");
  const findings = [];
  for (const rule of RULES) {
    const matches = [];
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let m;
    while ((m = re.exec(t))) {
      const at = m.index;
      matches.push({ word: m[0].trim().slice(0, 40), at: [at, at + m[0].length] });
      if (matches.length >= 6) break;
    }
    if (matches.length) {
      findings.push({ kind: rule.id, rule: rule.rule, fix: rule.fix, matches });
    }
  }
  return findings;
}

/**
 * THE STYLE GRADE — Strunk & White's report on the piece: the readability
 * metrics PLUS the rule violations, as one EOT-recordable object. `textstat`
 * is injected (a function returning the exact readability numbers, from the
 * venv subprocess); when absent, the JS heuristic stands in.
 */
export function styleGrade(text, { textstat = null } = {}) {
  const readability = textstat ? { ...textstat(text), source: "textstat" } : { ...jsReadability(text), source: "js-heuristic" };
  const findings = styleFindings(text);
  return {
    ...readability,
    violations: findings,
    violationCount: findings.length,
    basis: findings.length
      ? `Strunk & White: ${findings.length} style rule violation(s) — ${findings.slice(0, 3).map((f) => f.kind).join(", ")}${findings.length > 3 ? "…" : ""}; ${readability.band ?? "reads"} (Flesch ${readability.flesch ?? "?"})`
      : `Strunk & White: no style rule violations; ${readability.band ?? "reads"} (Flesch ${readability.flesch ?? "?"})`,
  };
}

/** Alias of styleGrade — the style report by any name. */
export const styleCheck = styleGrade;

/** Alias of styleFindings — the rule scan by any name. */
export const scanStyle = styleFindings;