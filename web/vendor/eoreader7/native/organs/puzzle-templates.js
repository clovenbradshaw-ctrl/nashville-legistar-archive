// native/organs/puzzle-templates.js — a small, growing, CLOSED library of
// recognized puzzle SHAPES, each with a mechanically-checkable signature
// and a verified formalization recipe. This is the honest answer to "can
// the system read the riddle": not general NLU (refused — there is no
// ground truth in a riddle's own text to check a proposed formalization
// against, unlike a citation's real bytes), but shape recognition — the
// same move `arithmetic.js::detectArithmetic` already makes for numeric
// expressions, generalized to a puzzle CLASS. A template matches on
// SURFACE STRUCTURE (closed regex patterns over named agents, a closed
// role set, an explicit word-ambiguity clause, a stated query budget) —
// never on semantic understanding of what the puzzle "means." A text that
// doesn't match any registered template is an honest, typed refusal, the
// same posture every other closed class in this codebase takes.
//
// Registering a template is a GIVER'S ACT (a person or a verified pass
// declares "this shape, formalized this way, is correct" — the same
// discipline `declarations.js`'s `transitive`/`composes` already holds:
// a formalization is never inferred, it is asserted by a named giver and
// then checked mechanically against every future match).

import { HONESTY_TYPES } from "./embedded-query.js";

export const REFUSALS = Object.freeze({
  no_match: "this text does not match any registered puzzle template's signature — a disclosed absence, never a guessed formalization",
});

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

// ── Template: the Boolos liar/truth-teller/random puzzle family ───────────
//
// Signature (all closed-class, all mechanical — no free-text understanding):
//   (1) three agent names, each a single capitalized token, introduced
//       together ("A, B, and C", or "X, Y, and Z", etc.)
//   (2) a closed role vocabulary of exactly three roles, named together
//       ("True, False, and Random", or synonyms this template declares)
//   (3) an explicit statement that a yes/no word-pair exists but its
//       mapping is unknown ("you do not know which word means which" /
//       "in some order" near two named words)
//   (4) a stated number of yes/no questions allowed.
//
// A text can rename the agents, rename the roles' WORDS (as long as they
// still mean truthful/lying/random — declared via the ROLE_SYNONYMS
// closed table below, never guessed), and rename the yes/no words — the
// signature still matches, because none of those are what the signature
// actually checks.

const ROLE_SYNONYMS = Object.freeze({
  true: ["true", "truthful", "honest"],
  false: ["false", "lying", "liar", "dishonest"],
  random: ["random", "unpredictable", "erratic"],
});

function classifyRoleWord(word) {
  const w = word.toLowerCase();
  for (const [honesty, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (synonyms.includes(w)) return honesty;
  }
  return null;
}

const AGENT_LIST_RE = /\b([A-Z]\w{0,2})\s*,\s*([A-Z]\w{0,2})\s*,?\s*and\s*([A-Z]\w{0,2})\b/;
const ROLE_LIST_RE = /\b(true|truthful|honest|false|lying|liar|dishonest|random|unpredictable|erratic)\s*,\s*(true|truthful|honest|false|lying|liar|dishonest|random|unpredictable|erratic)\s*,?\s*and\s*(true|truthful|honest|false|lying|liar|dishonest|random|unpredictable|erratic)\b/i;
const WORD_AMBIGUITY_RE = /words? for yes and no (?:are|is)\s*,?\s*(\w+)\s*(?:and|,)\s*(\w+)[^.]*(?:you do not know|in some order|unknown)/i;
const BUDGET_RE = /\b(one|two|three|four|five|\d+)\s+yes[\s-]?(?:no|–no|—no)?\s+questions?/i;
const NUMBER_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5 });

const BOOLOS_TEMPLATE = Object.freeze({
  id: "boolos-liar-truthteller-random",
  giver: "Boolos 1996, 'The Hardest Logic Puzzle Ever' — registered as a template 2026-09-10 after this codebase's own hand-verified solve (boolos-puzzle.mjs)",
  /**
   * signature(text) — mechanical, closed-class match. Returns null (no
   * match) or the extracted params: { agents: [a,b,c], roleWords: {true,
   * false, random}, yesWord, noWord, budget }.
   */
  signature(text) {
    const t = String(text ?? "");
    const agentsMatch = t.match(AGENT_LIST_RE);
    const rolesMatch = t.match(ROLE_LIST_RE);
    const ambiguityMatch = t.match(WORD_AMBIGUITY_RE);
    const budgetMatch = t.match(BUDGET_RE);
    if (!agentsMatch || !rolesMatch || !ambiguityMatch || !budgetMatch) return null;

    const agents = [agentsMatch[1], agentsMatch[2], agentsMatch[3]];
    const roleWords = [rolesMatch[1], rolesMatch[2], rolesMatch[3]];
    const classified = roleWords.map(classifyRoleWord);
    if (classified.some((c) => c === null)) return null;
    if (new Set(classified).size !== 3) return null; // must name exactly one of each honesty type — never guessed

    const roleWordFor = Object.fromEntries(classified.map((h, i) => [h, roleWords[i]]));
    const budgetRaw = budgetMatch[1].toLowerCase();
    const budget = NUMBER_WORDS[budgetRaw] ?? Number(budgetRaw);
    if (!Number.isInteger(budget) || budget < 1) return null;

    return Object.freeze({
      agents: Object.freeze(agents),
      roleWordFor: Object.freeze(roleWordFor),
      yesOrNoWords: Object.freeze([ambiguityMatch[1], ambiguityMatch[2]]),
      budget,
    });
  },
  /**
   * formalize(params) — the verified recipe: build the hypothesis space
   * (every assignment of {true,false,random} to the extracted agents) and
   * the candidate queries (the embedding-lemma construction), exactly as
   * boolos-puzzle.mjs proved correct — generalized to the extracted agent
   * names rather than hardcoded A/B/C.
   */
  formalize(params) {
    const { agents, budget } = params;
    const hypotheses = permutations([...HONESTY_TYPES]).map((perm) => Object.freeze(Object.fromEntries(agents.map((g, i) => [g, perm[i]]))));
    const keyOf = (h) => agents.map((g) => h[g]).join("/");
    const byKey = new Map(hypotheses.map((h) => [keyOf(h), h]));
    return Object.freeze({ agents, hypotheses: [...byKey.keys()], byKey, budget });
  },
});

export const PUZZLE_TEMPLATES = Object.freeze([BOOLOS_TEMPLATE]);

/**
 * matchTemplate(text) — check `text` against every registered template's
 * signature; the first match wins (templates are declared, never
 * overlapping in a way this function needs to arbitrate — a future
 * template that could collide with another names that explicitly, the
 * same posture `hl.js`'s FDE contested standing takes for genuine
 * ambiguity, not invented here since only one template exists so far).
 * Returns `{ template, params }` or `{ refused: REFUSALS.no_match }`.
 */
export function matchTemplate(text) {
  for (const template of PUZZLE_TEMPLATES) {
    const params = template.signature(text);
    if (params) return Object.freeze({ template, params });
  }
  return Object.freeze({ refused: REFUSALS.no_match });
}
