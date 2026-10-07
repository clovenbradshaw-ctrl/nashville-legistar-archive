// native/organs/regime.js — the reasoning-seed's four-field tag and
// precedence order, over claims this engine already admits.
//
// SCOPE, narrowed on user direction (2026-09-10): derivation.js's own
// `premisesOf` already has a deliberate, reasoned design — a contested
// note enters composition, carrying its dispute, so a later concession
// cascades through what was built on it ("you may build on a contested
// base PROVIDED the structure carries what would fall"). This module does
// NOT change that, and does not gate entry into composition at all.
// `isSettled` here gates ONLY `precedence` below (the seed's section 4) —
// a contested claim may still be a premise; it may simply never be the
// thing `precedence` silently picks as the winner of a conflict.
//
// NAMING NOTE: the seed's own word "stance" collides with `cube.js`'s
// existing STANCE_BY_MODE vocabulary (Dissecting/Binding/Composing — a
// property of an operator×grain CELL, already exported as `.stance` on
// every `cellFields()` result in notes.js). This module's four-field tag
// uses `persistence` (stored/ephemeral) for the seed's own axis instead,
// so the two meanings of "stance" never collide on one object.
//
// THE FOUR FIELDS: persistence (which of the nine operators produced the
// claim — stored: INS/SEG/CON/SYN/DEF/EVA/REC, ephemeral: NUL/SIG),
// regime (classical/contested — read off the note's own `disputedBy`,
// never re-derived), validity (a declared [from, until) window or open),
// force (O/P/default — only obligation.js-admitted clauses carry a real
// one; a narrative assertion defaults to "default" without ever scanning
// its own prose for deontic words, which would misread reported speech
// — "she said he must go" — as this engine's own obligation).
//
// THE PRECEDENCE ORDER (section 4 of the seed) is the one deliverable
// that has to be a single function, not scattered checks: validity window,
// then regime, then SPECIFICITY, then force, then RECENCY, then
// entrenchment (terrain grain as a Spohn rank — Ground is the most
// entrenched, a raw admitted fact; Pattern the least, a composed
// generalization, first to give up). Stop at the first rule that applies.
//
// AMENDED 2026-09-10 — two confirmed gaps closed, both found by direct
// adversarial testing (`eval/the-fold/hard-logic-battery.mjs` TC-A/TC-B),
// not invented speculatively:
//
// SPECIFICITY (lex specialis derogat legi generali). A general obligation
// and a matching specific exception used to be decided by FORCE alone (O
// beats P unconditionally), which is backwards for the textbook case —
// "no parking" / "except residents on Sundays" — where the specific rule
// should win when its own declared conditions are actually met. `scope`
// is now a FIFTH, optional field: a declared Set of condition tags (never
// inferred from text — the same discipline `force` already holds). A
// claim's scope must be SATISFIED (every tag present in the caller's
// declared `conditions` for this query) to apply at all; between two
// applicable claims, the one whose scope is a PROPER SUPERSET of the
// other's (strictly more conditions — narrower, more specific) wins,
// checked BEFORE force. Two claims with incomparable or absent scopes
// fall through to force exactly as before — this step never runs merely
// because scope exists, only when one claim's scope is EARNED to be
// strictly more specific than the other's.
//
// RECENCY (lex posterior derogat legi priori). `validity` (from/until —
// WHEN a claim applies) and `enactedAt` (a bare timestamp — WHEN a claim
// was MADE) are different facts about a claim that the original four-field
// tag conflated into one window. `enactedAt` is a SIXTH, optional field;
// when both claims declare one and force did not decide, the later
// enactment wins — checked after force, before entrenchment (a later
// same-force rule is assumed to supersede an earlier one; entrenchment,
// the weakest and most structural tiebreak, is reserved for when neither
// side has anything more specific to say). Absent on either side, this
// step is skipped exactly as if it did not exist — never a 0-timestamp
// default standing in for "unknown."

import { GRAINS } from "../kernel/cube.js";

const STORED_OPERATORS = new Set(["INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);
const EPHEMERAL_OPERATORS = new Set(["NUL", "SIG"]);

// Lower index wins — used identically for force and for entrenchment below,
// one convention, not two.
export const FORCES = Object.freeze(["O", "default", "P"]);
const FORCE_RANK = new Map(FORCES.map((f, i) => [f, i]));

export function persistenceOf(operator) {
  if (STORED_OPERATORS.has(operator)) return "stored";
  if (EPHEMERAL_OPERATORS.has(operator)) return "ephemeral";
  throw new TypeError(`regime.persistenceOf: unknown operator "${operator}" — the nine are declared, never guessed`);
}

export function regimeOf(disputedBy) {
  return (disputedBy?.length ?? 0) > 0 ? "contested" : "classical";
}

// FORCE — closed class, declared, and deliberately narrow. Applied ONLY to
// text a caller has already identified as an obligation.js-admitted clause
// (a declared, enumerated instruction), never to ordinary narrative prose.
const OBLIGATORY_RE = /\b(must|shall)\b/i;
const PERMISSIVE_RE = /\b(may|is permitted to|is allowed to)\b/i;
export function forceOfClause(clauseText) {
  const t = String(clauseText ?? "");
  if (OBLIGATORY_RE.test(t)) return "O";
  if (PERMISSIVE_RE.test(t)) return "P";
  return "default";
}

// VALIDITY WINDOW — a small, declared, closed set of the phrasings an
// ordinance/legal text actually uses to bound when a clause applies. Not
// full temporal-logic parsing (the seed's own section 1 names that as
// later, separate work) — an unrecognized phrasing is disclosed as `open`
// (unbounded), never guessed at. The date itself is matched against a
// closed, declared SHAPE — ISO, "Month D[, ]YYYY" (with an optional
// ordinal suffix and trailing period: "Jan. 1st, 2020"), or D/M/YYYY —
// rather than captured as free text up to punctuation: a second clause in
// the same sentence ("...effective as of X and expires on Y.") has no
// punctuation boundary between the two dates, and free-text capture
// swallowed both into one unparseable string (caught by this module's own
// test suite before shipping, not assumed safe). The SHAPE is widened
// (2026-09-10, per direct instruction to leverage real math/date tools)
// specifically to admit strings the default `parseDate` (bare `Date.parse`)
// cannot itself resolve — "31/12/2024" (day-first) and "Jan. 1st, 2020"
// both measured to fail `Date.parse` outright — so that a richer injected
// `parseDate` (python's `dateutil.parser`, via the pyodide-backed
// `eval/the-fold/date-normalize.mjs` — its own isolated `package.json`
// beside it, same reasoning `cli/package.json` already established) has
// something to actually parse.
// Widening the candidate SHAPE and widening what can PARSE it are
// deliberately separate concerns — this module still ships the disclosed,
// weaker default (`Date.parse`) as its own zero-dependency floor.
const DATE_RE_SRC = "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}|[A-Za-z]+\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}\\s+[A-Za-z]+\\.?,?\\s+\\d{4})";
const EFFECTIVE_RE = new RegExp(`\\beffective(?:\\s+as\\s+of)?\\s+${DATE_RE_SRC}`, "i");
const SUNSET_RE = new RegExp(`\\b(?:expires?|sunsets?|shall\\s+(?:expire|terminate)|ceases?\\s+to\\s+(?:be\\s+)?(?:in\\s+)?effect)\\s+(?:on|after|by)?\\s*${DATE_RE_SRC}`, "i");

export function parseValidityWindow(text, parseDate = Date.parse) {
  const t = String(text ?? "");
  const fromMatch = t.match(EFFECTIVE_RE);
  const untilMatch = t.match(SUNSET_RE);
  const from = fromMatch ? parseDate(fromMatch[1].trim()) : NaN;
  const until = untilMatch ? parseDate(untilMatch[1].trim()) : NaN;
  const fromOk = Number.isFinite(from);
  const untilOk = Number.isFinite(until);
  if (!fromOk && !untilOk) return Object.freeze({ from: null, until: null, open: true });
  return Object.freeze({ from: fromOk ? from : null, until: untilOk ? until : null, open: false });
}

export function inValidityWindow(window, queryTime) {
  if (!window || window.open) return true;
  if (window.from != null && queryTime < window.from) return false;
  if (window.until != null && queryTime >= window.until) return false;
  return true;
}

/**
 * tagClaim(claim, { operator, disputedBy, validityText, force, scope,
 * enactedAt, queryTime }) — the tag assigned at admission time (cheap: it
 * comes from which organ produced the claim), never re-derived at
 * reasoning time. `scope` (a declared iterable of condition tags) and
 * `enactedAt` (a declared timestamp) are both optional, additive fields —
 * see this file's 2026-09-10 amendment for why each exists.
 */
export function tagClaim(claim, { operator, disputedBy = [], validityText = null, force = null, scope = null, enactedAt = null, queryTime = Date.now(), parseDate } = {}) {
  if (!operator) throw new TypeError("regime.tagClaim: operator is declared — which of the nine produced this claim");
  const persistence = persistenceOf(operator);
  const regime = regimeOf(disputedBy);
  const validity = validityText != null ? parseValidityWindow(validityText, parseDate) : Object.freeze({ from: null, until: null, open: true });
  return Object.freeze({
    persistence,
    regime,
    validity,
    force: force ?? "default",
    scope: scope ? Object.freeze(new Set(scope)) : null,
    enactedAt: enactedAt ?? null,
    inScope: inValidityWindow(validity, queryTime),
  });
}

/**
 * scopeSatisfied(scope, conditions) — every tag the claim declares must be
 * present in the query's own declared conditions. No scope declared means
 * unconditional (always satisfied) — a claim with nothing to say about
 * specificity is not thereby excluded, only never a candidate for WINNING
 * on specificity grounds (see `moreSpecific` below).
 */
export function scopeSatisfied(scope, conditions) {
  if (!scope) return true;
  const have = conditions instanceof Set ? conditions : new Set(conditions ?? []);
  for (const tag of scope) if (!have.has(tag)) return false;
  return true;
}

/**
 * moreSpecific(a, b) — true iff `a`'s declared scope is a PROPER SUPERSET
 * of `b`'s (strictly more conditions named, so `a` applies to a narrower
 * set of situations than `b` does). Neither declared, equal, or
 * incomparable (neither a strict superset of the other) all return false
 * — this is a partial order, and an unearned "more specific" is never
 * guessed.
 */
export function moreSpecific(a, b) {
  if (!a || !b) return false;
  if (a.size <= b.size) return false;
  for (const tag of b) if (!a.has(tag)) return false;
  return true;
}

/** isSettled(tag) — gates `precedence` alone (see this file's own header). */
export function isSettled(tag) {
  return tag.regime !== "contested";
}

const grainRank = (grain) => {
  const i = GRAINS.indexOf(grain);
  if (i < 0) throw new TypeError(`regime: unknown grain "${grain}" — one of ${GRAINS.join(", ")}`);
  return i; // Ground=0 (most entrenched, a raw admitted fact) .. Pattern=2 (least — a composed generalization, first to give up)
};

// THE ORDER, AS DATA — never hand-typed a second time (2026-09-14).
// `precedence()` below is six sequential checks, each short-circuiting; the
// ORDER those checks apply in is a fact about this file, not an
// implementation detail, and it needs to appear in prose more than once —
// this very docstring, document-ledger.js's kelsenGrade header (the essay
// modality that calls this organ), and proxy-runner.mjs's own user-facing
// "how were these claims resolved" strings. Audited 2026-09-14: this
// docstring itself had drifted, still listing the pre-2026-09-10 four-step
// order (validity, regime, force, entrenchment) after specificity and
// recency were added to the function beneath it; three more restatements
// outside this file had each independently dropped "regime" (the
// 2026-09-04 dispute-veto step) — one of them a prompt string actually sent
// to the model. Same incident as cube.js's own OPERATOR_CHAIN (see its
// header): a restated order is a second copy of a fact this file already
// has one copy of, and it drifts the moment the real order changes and
// nothing forces the restatement to follow. PRECEDENCE_STEPS is that one
// copy — every prose rendering of the order, in this file and outside it,
// is built from it (`precedenceOrderPhrase`), never typed a second time.
export const PRECEDENCE_STEPS = Object.freeze([
  Object.freeze({ reason: "validity_window", label: "validity" }),
  Object.freeze({ reason: "route_to_landContest", label: "regime" }),
  Object.freeze({ reason: "specificity", label: "lex specialis" }),
  Object.freeze({ reason: "force", label: "force" }),
  Object.freeze({ reason: "recency", label: "lex posterior" }),
  Object.freeze({ reason: "entrenchment", label: "entrenchment" }),
]);

/** The order as one prose phrase, built from PRECEDENCE_STEPS — every
 * surface that names the order (this file's own docstring included) names
 * this SAME one. */
export function precedenceOrderPhrase() {
  return PRECEDENCE_STEPS.map((s) => s.label).join(", then ");
}

/**
 * precedence({ tag, grain }, { tag, grain }, { queryTime }) — the seed's
 * section 4 (amended 2026-09-10 per this file's own header), one function,
 * one order (PRECEDENCE_STEPS above), stop at the first rule that applies:
 *   1. validity window  — a claim out of scope at queryTime is simply not
 *                          in scope; no further reasoning needed.
 *   2. regime            — either claim contested: refuse to pick a
 *                          winner, route to landContest (contraction only,
 *                          never AGM-style revision).
 *   3. specificity       — lex specialis: a satisfied, strictly narrower
 *                          scope beats a more general one.
 *   4. force             — O beats default beats P, only once both are
 *                          in scope, neither is contested, and specificity
 *                          did not decide.
 *   5. recency           — lex posterior: a later declared enactment beats
 *                          an earlier one of equal force, only when BOTH
 *                          sides declare one.
 *   6. entrenchment      — terrain grain as a Spohn rank (Ground first).
 * A tie surviving all six is reported, never silently broken — this
 * function is not the place to invent a seventh rule.
 */
export function precedence(a, b, { queryTime = Date.now(), conditions = [] } = {}) {
  const aIn = inValidityWindow(a.tag.validity, queryTime);
  const bIn = inValidityWindow(b.tag.validity, queryTime);
  if (!aIn && !bIn) return Object.freeze({ winner: null, reason: "out_of_scope", detail: "neither claim's validity window covers the query time" });
  if (!aIn) return Object.freeze({ winner: "b", reason: "validity_window" });
  if (!bIn) return Object.freeze({ winner: "a", reason: "validity_window" });

  if (!isSettled(a.tag) || !isSettled(b.tag)) {
    return Object.freeze({ winner: null, reason: "route_to_landContest", detail: "at least one claim is contested — precedence never resolves this, land the contest instead" });
  }

  // SPECIFICITY (lex specialis) — only between two claims that both
  // actually APPLY (their declared scope, if any, is satisfied by the
  // query's own conditions). A claim whose scope is not satisfied is not
  // a candidate to win on specificity grounds, but it is also not yet
  // excluded here the way an out-of-scope validity window is — the two
  // are different questions (WHEN a claim applies vs. UNDER WHAT
  // CONDITIONS), and a caller may still want it decided on force if it
  // is the only claim on the table. This step only ever picks a winner;
  // it never itself excludes one.
  const aApplies = scopeSatisfied(a.tag.scope, conditions);
  const bApplies = scopeSatisfied(b.tag.scope, conditions);
  if (aApplies && bApplies) {
    if (moreSpecific(a.tag.scope, b.tag.scope)) return Object.freeze({ winner: "a", reason: "specificity" });
    if (moreSpecific(b.tag.scope, a.tag.scope)) return Object.freeze({ winner: "b", reason: "specificity" });
  }

  const aForce = FORCE_RANK.get(a.tag.force), bForce = FORCE_RANK.get(b.tag.force);
  if (aForce == null || bForce == null) throw new TypeError(`regime.precedence: force must be one of ${FORCES.join(", ")}`);
  if (aForce !== bForce) return Object.freeze({ winner: aForce < bForce ? "a" : "b", reason: "force" });

  // RECENCY (lex posterior) — only when both sides declared an enactment
  // timestamp; absent on either side, this step is skipped entirely.
  if (a.tag.enactedAt != null && b.tag.enactedAt != null && a.tag.enactedAt !== b.tag.enactedAt) {
    return Object.freeze({ winner: a.tag.enactedAt > b.tag.enactedAt ? "a" : "b", reason: "recency" });
  }

  if (!a.grain || !b.grain) throw new TypeError("regime.precedence: grain is declared on each claim for the entrenchment step — never re-derived here");
  const aRank = grainRank(a.grain), bRank = grainRank(b.grain);
  if (aRank !== bRank) return Object.freeze({ winner: aRank < bRank ? "a" : "b", reason: "entrenchment" });

  return Object.freeze({ winner: null, reason: "tied", detail: "same force, same grain, no decisive recency — precedence cannot resolve this; a caller-declared tiebreak is needed, never guessed here" });
}
