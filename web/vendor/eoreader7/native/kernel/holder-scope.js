// native/kernel/holder-scope.js — a reference resolves only against what its
// Handle: Roberts — after Craige Roberts' discourse structure: a reference resolves inside the hypothesis that introduced it, not beyond it. Amendment XVII.
// OWN holder (or something reachable from it) has established. Medium-
// general, kernel-level.
//
// WHY THIS EXISTS, AND WHY IT IS NOT NEW IN KIND. `adapters/text/
// perspective-claims.js` already does exactly this, in prose: its own
// header states "bindNarrationFrames runs the organ inside one teller's
// stretch at a time, so a frame's 'he' is never resolved against a name
// occurring only in another teller's stretch — P1's never-carry-a-window
// rule, one level in." That is holder-scoping, built once, ad hoc, for one
// medium's one boundary type (a narrator's own stretch of text). Modal
// subordination ("A wolf might come in. It would eat you first.") is the
// SAME question at a different boundary: "it" must resolve within what the
// hypothesis under "might" has established, not the baseline reader's own
// asserted facts — a wolf coming in was never asserted, so ordinary CON has
// nothing to reach for unless the resolution is scoped to the hypothesis
// that introduced it. `kernel/perspective.js` already has the vocabulary
// this needs — `holder` is caller-declared, open, and medium-blind by its
// own header ("a holder arrives as a caller-declared annotation... never
// interprets it") — a hypothesis is just one more holder, exactly the way
// a narrator is. This file is the missing kernel-level generalization: the
// SAME holder-scoping perspective-claims.js hand-rolled for prose text,
// usable by any adapter, in any medium, for any reason a reference might be
// scoped rather than global.
//
// NOTHING BELOW KNOWS WHAT A NARRATOR OR A MODAL VERB IS. `holder` is
// perspective.js's own open string vocabulary (`perspective.js::READER` is
// the reserved baseline). `accessibility` is a caller-declared map of which
// holders' establishments a given holder may reach — never inferred: this
// file computes no nesting, no narrative structure, no modality. A text
// adapter recognizing "might" as opening a new hypothesis, or recognizing a
// narrator boundary, decides the accessibility map; this file only walks it.
//
// COMPOSES WITH THE SAME ADJUDICATOR EVERYTHING ELSE DOES. `admissibleUnder`
// produces exactly the predicate shape `contest.js::adjudicate`'s own
// `admissible` parameter already expects — the identical composition
// `completion.js` and `scoped-kind.js` use, contributing only WHICH
// candidates are in scope, never a second scoring rule.

import { cellOf } from "./cube.js";
import { adjudicate } from "./contest.js";
import { READER } from "./perspective.js";

export { READER };

/** CON·Figure: the same cell ordinary reference resolution already occupies. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Figure"));

/**
 * accessibleHolders(holder, accessibility) — the transitive closure of
 * `holder` plus every holder reachable through the caller's own declared
 * `accessibility` map (holder -> [directly reachable holders]). Always
 * includes `holder` itself (a holder may always reach its own
 * establishments). Cycle-safe by construction (a visited set, not
 * recursion) — an accessibility map is the caller's own declared graph,
 * and this file does not assume it is acyclic.
 *
 * `perspective.js::READER` is the natural root of most such graphs (the
 * baseline reality every hypothesis and every narrator is typically
 * declared reachable FROM, per Kripke-style modal accessibility — a
 * possible world can refer to the actual world's own facts) but this file
 * asserts no such default: an empty `accessibility` means `holder` may
 * reach only its own establishments, exactly as declared.
 */
export function accessibleHolders(holder, accessibility = {}) {
  if (holder == null) throw new TypeError("accessibleHolders: holder is required");
  const seen = new Set([holder]);
  const queue = [holder];
  while (queue.length) {
    const h = queue.shift();
    for (const next of accessibility[h] ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return Object.freeze(seen);
}

/**
 * admissibleUnder(holder, established, accessibility) — an `admissible(id)`
 * predicate scoped to what `holder` may reach.
 *
 * `established`: [{ id, holder }] — referents this reading has
 *   individuated, each tagged with the holder whose stretch introduced it.
 *   Provenance the CALLER supplies (perspective.js itself projects belief
 *   claims, not referent-introduction provenance — a different question,
 *   asked of the same `holder` vocabulary).
 */
export function admissibleUnder(holder, established = [], accessibility = {}) {
  const reachable = accessibleHolders(holder, accessibility);
  const byId = new Map(established.map((e) => [e.id, e]));
  return (id) => {
    const entry = byId.get(id);
    return entry != null && reachable.has(entry.holder);
  };
}

/**
 * resolveUnderHolder(holder, established, accessibility, opts) — CON,
 * restricted to `holder`'s own accessible scope, via the real `adjudicate`.
 * `opts` is `adjudicate`'s own signature; `admissible`, if the caller also
 * supplies one (gender, individuation type — the same filters pronouns.js
 * already applies), is composed with the scope filter rather than
 * overridden — a caller wanting both must AND them together explicitly,
 * because silently picking one would hide which filter did the refusing.
 */
export function resolveUnderHolder(holder, established, accessibility, opts = {}) {
  const scoped = admissibleUnder(holder, established, accessibility);
  const outer = typeof opts.admissible === "function" ? opts.admissible : null;
  const admissible = outer ? (id) => scoped(id) && outer(id) : scoped;
  const verdict = adjudicate({ ...opts, admissible });
  return Object.freeze({ ...verdict, cell: RESOLUTION_CELL, holder });
}
