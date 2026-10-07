/* Frege speaks:
 * “Dies erklärt, weshalb die Höhlung mit dem hinein- 
geschriebenen deutschen Buchstaben nöthig ist: sie grenzt das 
Gebiet ab, auf welches sich die durch den Buchstaben bezeich- 
nele Allgemeinheit bezieht. Nur innerhalb seines Gebietes hält 
der deutsche Buchstabe seine Bedeutung fest; in einem Urtheile 
kann derselbe deutsche Buchstabe in verschiedenen Gebieten vor- 
kommen, ohne dass die Bedeutung, die man ihm etwa in dem 
einen beilegt, sich auf die übrigen miterstreckt.”
 *
 * This file implements Frege's foundational principle that variables are bound within their quantifiers' scope, prohibiting their influence beyond that domain. While the core concept is clear, the practical implementation of such scoping can be nuanced, and this file attempts to clarify that nuance through its use of a "scoped-kind" concept.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/scoped-kind.js — a variable bound by a quantifier resolves
// Handle: Frege — after the founder of quantification theory: a variable is bound within its quantifier's scope, and nowhere else. Amendment XVII.
// to a PATTERN, not a particular. Medium-general, kernel-level.
//
// WHY THIS EXISTS. "Every farmer who owns a donkey beats it" has no single
// donkey "it" could point to — each farmer's own. Ordinary CON (completion.js,
// pronouns.js) always lands at Figure grain: one particular, already
// individuated. That is the wrong terrain for this reference by
// construction, not by a missing search: the cube already has a cell for
// "a pattern, not an instance" — Existence·Pattern, Kind — and this file's
// whole job is routing a quantifier-bound reference there instead of
// inventing a fourth existence category to hold it.
//
// TWO OPERATORS, ONE MOVE — the same pattern completion.js documents for
// NUL+CON and affordance-reference.js documents for SYN+CON, at a THIRD
// grain this time. An indefinite ("a donkey") encountered inside a
// quantifier's own declared extent does not individuate one particular —
// by construction, a bound variable IS a pattern ranging over the
// quantifier's instances, so minting it is SYN·Pattern (Composing), never
// SYN·Figure. Referring back to it ("it") is CON·Pattern — the same
// terrain the mint landed on, not the Figure-grain cell ordinary
// coreference occupies. `scope` is what makes this licensed rather than
// guessed: a caller-declared opaque id naming the quantifier's own extent
// (never inferred — the same discipline `completion.js`'s `expectedRoles`
// and `pending-sig.js`'s `expiresAt` already hold), so two DIFFERENT
// quantifiers minting the same key ("a donkey" under two different
// farmers) are two different Pattern referents, never accidentally fused.
//
// AMBIGUITY WITHIN ONE SCOPE IS ADJUDICATED, NOT ASSUMED SINGULAR. A scope
// can mint more than one candidate pattern (a caller's own extraction may
// find two plausible bound readings); resolution reuses `contest.js`'s real
// `adjudicate`, restricted by construction to candidates sharing the
// reference's own declared scope — the identical composition
// `completion.js` and `holder-scope.js` already use, contributing only
// candidate collection, never a second scoring rule.
//
// NOTHING BELOW KNOWS WHAT A QUANTIFIER, A DETERMINER, OR ENGLISH IS.
// `scope` and `key` are opaque, caller-declared identifiers.

import { cellOf } from "./cube.js";
import { adjudicate } from "./contest.js";

export const SCOPED_KIND_SCHEMA = "EOScopedKind@1";

/** SYN·Pattern: a bound variable, minted as a pattern ranging over a scope. */
export const MINT_CELL = Object.freeze(cellOf("SYN", "Pattern"));

/** CON·Pattern: the same terrain the mint landed on — Kind, not Entity. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Pattern"));

/**
 * mintScopedKind({ id, at, scope, key }) — an indefinite encountered inside
 * a declared quantifier extent mints a pattern, not a particular.
 *
 * `scope`: opaque, caller-declared — the quantifier's own extent (e.g. one
 *   specific "every farmer" occurrence's own id). Two indefinites in two
 *   different scopes are two different patterns, however similar their
 *   `key`.
 */
export function mintScopedKind({ id, at, scope, key } = {}) {
  if (id == null) throw new TypeError("mintScopedKind: id is required");
  if (!Number.isFinite(at)) throw new TypeError("mintScopedKind: at is declared on the caller's own clock — never defaulted");
  if (scope == null) throw new TypeError("mintScopedKind: scope is required — an unscoped bound variable is not a bound variable");
  if (key === undefined) throw new TypeError("mintScopedKind: key is required");
  return Object.freeze({
    schema: SCOPED_KIND_SCHEMA, id, at, scope, key,
    cell: MINT_CELL,
    provenance: Object.freeze({ basis: "quantifier-bound indefinite, minted as a pattern within its own declared scope" }),
  });
}

/**
 * candidatesInScope(scope, mintedKinds) — every pattern minted under the
 * SAME scope, the raw material a caller turns into `adjudicate`'s own
 * `scores` (this function assigns no score itself, matching
 * `completion.js::candidatesFor`'s identical tier boundary).
 */
export function candidatesInScope(scope, mintedKinds = []) {
  return Object.freeze(mintedKinds.filter((k) => k?.scope === scope));
}

/**
 * resolveInScope(scope, candidates, opts) — CON·Pattern the bound reference
 * to a winning candidate via the real `adjudicate`. `opts` is exactly
 * `contest.js::adjudicate`'s own signature; nothing here recomputes a
 * verdict adjudicate already knows how to reach.
 */
export function resolveInScope(scope, candidates, opts = {}) {
  const verdict = adjudicate(opts);
  const won = verdict.id != null ? candidates.find((c) => c.id === verdict.id) : null;
  return Object.freeze({
    ...verdict,
    cell: RESOLUTION_CELL,
    scope,
    key: won ? won.key : null,
  });
}
