// logic-puzzle.js — knights-and-knaves, computed, never narrated. THE
// PARSING ONLY — the solving is eoreader7's general reasoning-core.js.
//
// Live specimen this closes: a 5-archivist knight/knave puzzle, asked of
// gemma2:2b in two different surfaces of this instrument. In the-fold's own
// chat it hit `needsDecomposition` — five invented, disconnected section
// headings ("Establish the Identity of the Spy", "Determine the Ledger
// Location"…), one of which hallucinated "the White House has identified
// Donald J. Trump" out of nowhere. In eoreader7's TUI it free-narrated a
// step-by-step deduction that stalled mid-puzzle and, on the steps it did
// finish, reasoned about a Knight's OWN statement using the wrong polarity
// ("if A is a Knight... A's statement would be false, which contradicts
// the assumption that A is a Knight" — that isn't a contradiction, that IS
// the definition of a Knave, misapplied). Neither failure is a prompting
// problem. A knights-and-knaves puzzle is a closed boolean-consistency
// question over a small, enumerable space — arithmetic.js's own house rule
// (P2, "the model is just the mouth") applies exactly as it does to "17
// times 24": this instrument computes the answer by EXHAUSTIVE CHECK over
// every possible Knight/Knave assignment, never by narrated deduction.
//
// AMENDED 2026-09-16, user direction: "no puzzle shaped specific solver, it
// just needs to be a general reasoning engine." This file's own original
// `solveKnightsKnaves` had exactly two puzzle-specific facts baked into its
// SEARCH loop, not just its parsing — a hardcoded 2-valued domain (`1<<n`)
// and the consistency rule ("a speaker's own statements must agree with
// their own type") written inline instead of declared. Both are gone now:
// this file still does ONLY the closed-grammar English parsing it always
// did (`parseArchivists`/`parseStatement`/`evaluateStatement`, unchanged),
// and `solveKnightsKnaves` DECLARES a variable+constraint problem and hands
// it to `eoreader7/native/organs/reasoning-core.js::solveCSP` — a puzzle-
// blind general finite-domain solver, proven against a genuinely different
// domain (map-coloring) in its own tests, not asserted general on faith.
//
// GROUNDED BY CONSTRUCTION, and AUDITABLE BY CONSTRUCTION: the CSP search
// covers the whole declared 2^n space (some branches pruned once a rule
// already fails on the values assigned so far — a STRONGER audit than
// checking each one individually, since a pruned branch names the exact
// partial values that doom every completion of it, not just one). A
// statement this module cannot parse into a Knight/Knave-typed claim (e.g.
// "the ledger is guarded by a Knave" — a claim ABOUT something outside the
// archivists' own types) is never silently dropped: it is named, kept
// apart from the constraint set, and disclosed as unresolved (P4: gaps are
// results).
import { finiteDomain, declareVariable, declareConstraint, makeCSP, solveCSP } from "../organs/reasoning-core.js";

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strip a trailing plural "s" (and "ies" -> "y") — a real English parser is
 * out of scope for a closed-grammar door; this covers every rule sentence a
 * real puzzle actually phrases ("Knights"/"Truth-tellers"/"Liars"/"Sages"). */
const singularize = (w) => (/[a-z]ies$/i.test(w) ? w.replace(/ies$/i, "y") : w.replace(/s$/i, ""));

/**
 * detectTypeWords(text) — the puzzle's OWN declared type-pair, if it states
 * one, e.g. "Truth-tellers always tell the truth, and Liars always lie."
 * Generalizes this whole module past the literal words "Knight"/"Knave":
 * the truth-teller/liar STRUCTURE is what this engine actually solves, and
 * a puzzle that renames the two types (Sages/Fools, Truth-tellers/Liars, or
 * anything else) is the identical closed-boolean-consistency problem. Never
 * a general English parser — one narrow sentence shape, singularized so it
 * matches the per-speaker "X is a <Type>." statements the same puzzle uses.
 * Returns null when no such rule sentence is present (the caller falls back
 * to the literal Knight/Knave vocabulary, unchanged).
 */
export function detectTypeWords(text) {
  const q = String(text ?? "");
  const m = /\b([A-Za-z][A-Za-z-]*)\s+(?:always\s+)?tells?\s+the\s+truth\b[^.]{0,60}?\b([A-Za-z][A-Za-z-]*)\s+(?:always\s+)?lies?\b/i.exec(q);
  if (!m) return null;
  const truthWord = singularize(m[1]), lieWord = singularize(m[2]);
  if (!truthWord || !lieWord || truthWord.toLowerCase() === lieWord.toLowerCase()) return null;
  return { truthWord, lieWord };
}

/** A safety floor on how many speakers this brute-forces (2^n assignments) —
 * never hand-picked against a golden: 20 speakers is already 1,048,576
 * assignments, well past any real puzzle and still instant, so this is a
 * true ceiling, not a tuned one. */
const MAX_SPEAKERS = 20;

/**
 * Splits "A: "..." / "..." B: "..." ..." into { speakers, statements }.
 * A speaker mark is a single capital letter followed by a colon; everything
 * up to the next mark (or the end) is that speaker's turn, and every
 * double-quoted run inside it is one of their statements. Returns null when
 * fewer than two speakers are found — never a one-speaker "puzzle".
 */
export function parseArchivists(text) {
  const q = String(text ?? "");
  const markRe = /\b([A-Z]):\s*/g;
  const marks = [];
  let m;
  while ((m = markRe.exec(q))) marks.push({ letter: m[1], start: m.index, end: markRe.lastIndex });
  if (marks.length < 2) return null;
  const speakers = [];
  const statements = {};
  for (let i = 0; i < marks.length; i++) {
    const { letter, end } = marks[i];
    const stop = i + 1 < marks.length ? marks[i + 1].start : q.length;
    const segment = q.slice(end, stop);
    const quotes = [...segment.matchAll(/"([^"]+)"/g)].map((mm) => mm[1].trim()).filter(Boolean);
    if (!quotes.length) continue; // a stray "A:" with no quoted statement is not a speaker mark
    if (!speakers.includes(letter)) speakers.push(letter);
    statements[letter] = [...(statements[letter] ?? []), ...quotes];
  }
  if (speakers.length < 2 || speakers.length > MAX_SPEAKERS) return null;
  return { speakers, statements };
}

const DEFAULT_TYPES = Object.freeze({ truthWord: "Knight", lieWord: "Knave" });

/**
 * One statement, parsed into a typed logical claim — a CLOSED grammar
 * (never a general English parser): a speaker's own type, a headcount, a
 * same/different-type pairing, or a "none of us" quantifier. Anything else
 * comes back `{ type: "unparsed", raw }`, named rather than guessed at.
 *
 * `types` is the puzzle's OWN declared truth-teller/liar words (default
 * Knight/Knave, unchanged for every existing caller) — internally every
 * node still carries `kind: "knight"|"knave"` regardless of the puzzle's
 * own vocabulary, so `evaluateStatement`/`solveKnightsKnaves` never need to
 * know a puzzle renamed its types; only the parse and the final display do.
 */
export function parseStatement(raw, speakers, types = DEFAULT_TYPES) {
  const s = String(raw ?? "").trim();
  const T = escapeRegex(types.truthWord), L = escapeRegex(types.lieWord);
  let m;
  if ((m = new RegExp(`^([A-Z])\\s+is\\s+an?\\s+(${T}|${L})\\.?$`, "i").exec(s))) {
    const who = m[1].toUpperCase();
    if (!speakers.includes(who)) return { type: "unparsed", raw: s };
    return { type: "isType", who, kind: m[2].toLowerCase() === types.truthWord.toLowerCase() ? "knight" : "knave" };
  }
  if ((m = new RegExp(`^none\\s+of\\s+us\\s+(?:is|are)\\s+an?\\s*(${T}|${L})s?\\.?$`, "i").exec(s))) {
    return { type: "none", kind: m[1].toLowerCase() === types.truthWord.toLowerCase() ? "knight" : "knave" };
  }
  if ((m = new RegExp(`^exactly\\s+(\\w+)\\s+of\\s+us\\s+(?:is|are)\\s+(?:an?\\s+)?${T}s?\\.?$`, "i").exec(s))) {
    const n = NUMBER_WORDS[m[1].toLowerCase()] ?? (Number.isFinite(Number(m[1])) ? Number(m[1]) : null);
    if (n == null) return { type: "unparsed", raw: s };
    return { type: "count", n, kind: "knight" };
  }
  if ((m = new RegExp(`^exactly\\s+(\\w+)\\s+of\\s+us\\s+(?:is|are)\\s+(?:an?\\s+)?${L}s?\\.?$`, "i").exec(s))) {
    const n = NUMBER_WORDS[m[1].toLowerCase()] ?? (Number.isFinite(Number(m[1])) ? Number(m[1]) : null);
    if (n == null) return { type: "unparsed", raw: s };
    return { type: "count", n, kind: "knave" };
  }
  if ((m = /^([A-Z])\s+and\s+([A-Z])\s+are\s+the\s+same\s+type\.?$/i.exec(s))) {
    const a = m[1].toUpperCase(), b = m[2].toUpperCase();
    if (!speakers.includes(a) || !speakers.includes(b)) return { type: "unparsed", raw: s };
    return { type: "sameType", a, b };
  }
  if ((m = /^([A-Z])\s+and\s+([A-Z])\s+are\s+(?:different\s+types|not\s+the\s+same\s+type)\.?$/i.exec(s))) {
    const a = m[1].toUpperCase(), b = m[2].toUpperCase();
    if (!speakers.includes(a) || !speakers.includes(b)) return { type: "unparsed", raw: s };
    return { type: "diffType", a, b };
  }
  return { type: "unparsed", raw: s };
}

/** A parsed statement's truth value under one candidate assignment
 * (`{[letter]: boolean}`, true = Knight). `null` for an unparsed statement
 * — it is never evaluated, never silently treated as true or false. */
export function evaluateStatement(node, assignment) {
  switch (node.type) {
    case "isType": return assignment[node.who] === (node.kind === "knight");
    case "none": {
      const wantKnight = node.kind === "knight"; // "none ... is a Knight" refuses any true value
      return Object.values(assignment).every((v) => (wantKnight ? v === false : v === true));
    }
    case "count": {
      const knights = Object.values(assignment).filter(Boolean).length;
      return node.kind === "knight" ? knights === node.n : (Object.keys(assignment).length - knights) === node.n;
    }
    case "sameType": return assignment[node.a] === assignment[node.b];
    case "diffType": return assignment[node.a] !== assignment[node.b];
    default: return null;
  }
}

/**
 * Declares the puzzle as a general finite-domain CSP (every speaker a
 * variable over `[true, false]` — true meaning the truth-teller type,
 * `evaluateStatement`'s own convention — and one constraint per parseable
 * statement: the speaker's own type must match whether their statement is
 * actually true), then hands it to `reasoning-core.js::solveCSP`. This
 * file no longer runs any search of its own — the puzzle-specific part
 * ends at "which constraint does this English sentence mean."
 *
 * A statement's constraint is scoped to every variable `evaluateStatement`
 * reads for it PLUS the speaker themselves (the rule ties the two
 * together) — `none`/`count` read every speaker, so those are declared
 * global on purpose, not an oversight; `isType`/`sameType`/`diffType` are
 * scoped narrowly, which is exactly what lets the general solver prune.
 *
 * Returns the same shape every caller already reads (`speakers`, `valid`,
 * `external`, `totalTried`) so `checkLogicPuzzle` and every existing test
 * are untouched by this change.
 */
export function solveKnightsKnaves({ speakers, statements, types = DEFAULT_TYPES }) {
  const external = [];
  const constraints = [];
  for (const who of speakers) {
    for (const raw of statements[who] ?? []) {
      const node = parseStatement(raw, speakers, types);
      if (node.type === "unparsed") { external.push({ speaker: who, raw: node.raw }); continue; }
      const reads = node.type === "isType" ? [node.who]
        : node.type === "sameType" || node.type === "diffType" ? [node.a, node.b]
        : speakers; // "none"/"count" read every speaker's assignment
      const vars = [...new Set([who, ...reads])];
      constraints.push(declareConstraint(
        `${who}: "${raw}"`,
        vars,
        (a) => a[who] === (evaluateStatement(node, a) === true),
      ));
    }
  }
  const variables = speakers.map((who) => declareVariable(who, finiteDomain([true, false])));
  const { solutions } = solveCSP(makeCSP(variables, constraints));
  return { speakers, valid: solutions, external, totalTried: 2 ** speakers.length };
}

/** Claims a question only when it is genuinely shaped like this puzzle: at
 * least two lettered speakers each making a quoted statement, AND a
 * truth-teller/liar type-pair present — narrow on purpose, the same
 * discipline `detectArithmetic` already holds for a bare numeric
 * expression. The literal words "Knight"/"Knave" are the default and
 * always work; `detectTypeWords` additionally claims any OTHER puzzle that
 * states its own rule ("Truth-tellers always tell the truth, and Liars
 * always lie.") — same closed-boolean-consistency engine underneath,
 * whatever the puzzle calls its two types. Never claims a question with
 * neither vocabulary present, whatever its punctuation looks like. */
export function detectLogicPuzzle(question) {
  const q = String(question ?? "");
  const hasKnightKnave = /\bKnights?\b/i.test(q) && /\bKnaves?\b/i.test(q);
  const types = hasKnightKnave ? DEFAULT_TYPES : detectTypeWords(q);
  if (!types) return null;
  const parsed = parseArchivists(q);
  if (!parsed) return null;
  const anyParseable = parsed.speakers.some((who) =>
    (parsed.statements[who] ?? []).some((raw) => parseStatement(raw, parsed.speakers, types).type !== "unparsed"));
  if (!anyParseable) return null;
  return { kind: "logic-puzzle", ...parsed, types };
}

const nameOf = (letter) => letter; // archivists are addressed by their own letter throughout

/**
 * Computed, not generated: solves and renders. `display` states the
 * exhaustive-search posture plainly, names the (usually unique) consistent
 * assignment, and discloses — by name, never by omission — any statement
 * this module could not type at all.
 */
export function checkLogicPuzzle(question) {
  const found = detectLogicPuzzle(question);
  if (!found) return null;
  const solved = solveKnightsKnaves(found);
  const { speakers, valid, external, totalTried } = solved;
  const { truthWord: T, lieWord: L } = found.types;
  const pair = `${T}/${L}`;
  let display;
  if (valid.length === 1) {
    const roles = speakers.map((who) => `${nameOf(who)}: ${valid[0][who] ? T : L}`).join(" · ");
    display = `Checked all ${totalTried} possible ${pair} assignments for ${speakers.join(", ")}; exactly one is self-consistent (every statement a ${T} makes is true, every statement a ${L} makes is false):\n${roles}\n— computed by exhaustive check, not narrated.`;
  } else if (valid.length === 0) {
    display = `Checked all ${totalTried} possible ${pair} assignments for ${speakers.join(", ")}; none is self-consistent — as parsed, the statements contradict each other and this puzzle has no solution.`;
  } else {
    const options = valid.map((a) => speakers.map((who) => `${who}:${a[who] ? T[0] : L[0].toLowerCase()}`).join(" ")).join("  |  ");
    display = `Checked all ${totalTried} possible ${pair} assignments for ${speakers.join(", ")}; ${valid.length} are self-consistent (the puzzle as parsed underdetermines it): ${options}`;
  }
  if (external.length) {
    const named = external.map((e) => `${e.speaker}: "${e.raw}"`).join(" · ");
    display += `\n${external.length} statement(s) refer to something outside the archivists' own ${pair} types and were not used to decide this: ${named} — whatever established those facts is not something this puzzle text (as given) states.`;
  }
  return { ...found, valid, external, totalTried, display, tex: null };
}
