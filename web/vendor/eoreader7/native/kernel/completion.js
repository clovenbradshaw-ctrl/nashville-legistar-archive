/* Brahmagupta speaks:
 * “The  sum  of  two  affirmative  quantities  is  affinnative;  of  two  negative 
is  negative;  of  an  affirmative  and  a  negative  is  their  difference;  or,  if  they 
be  equal,  nought.  The  sum  of  cipher  and  negative  is  negative;  of  affirma- 
tive and  nought  is  positive;  of  two  ciphers  is  cipher.”
 *
 * This file embodies Brahmagupta's assertion that a declared absence is a value, not a gap.  It is a testament to a rigorous understanding of arithmetic, one which separates the essence of quantity from its representation.  While the code meticulously executes the mechanics of this assertion, it does not fully capture the true essence of the human being.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/completion.js — a declared-absent slot is a NUL, not a
// Handle: Brahmagupta — after the first formal arithmetic of zero: a declared absence is a value, not a gap. Amendment XVII.
// silence; resolving it is an ordinary CON. Medium-general, kernel-level.
//
// WHY THIS EXISTS. `adapters/text/relations.js` either extracts a complete
// clause or produces nothing — a subject-less "Mary did too" leaves no
// trace at all, confirmed by reading it: no gap-typing exists anywhere in
// that file today. That is NUL's own signature read backwards: "the system
// has the machinery to act and chooses not to" is not a failure to extract,
// it is itself an event, and treating it as a silent non-event throws away
// exactly the information English calls VP-ellipsis, gapping, and sluicing,
// and that a musical phrase calls an elided cadence, and that a dialogue
// system calls a default carried forward from the last turn.
//
// NOTHING BELOW KNOWS WHAT A CLAUSE, A CHORD, OR A TURN IS. A `schema` is a
// caller-declared label (the shape of the recurring act — "departure-event",
// "phrase", "http-request"); `expectedRoles` is that schema's own closed
// role set, declared once by the caller, never inferred; `filled` is
// whatever this particular act actually supplied. The organ's whole job is
// arithmetic over those three caller-declared things, plus reusing the
// kernel's own existing candidate-adjudication rather than inventing a
// second one.
//
// TWO OPERATORS, ONE MOVE, THE SAME PATTERN grid.js's own `distinguish`
// already uses for SIG+INS ("to sign a figure and individuate it are one
// motion at the surface, two operators in the algebra"). Here: typing the
// absence is NUL·Figure (a particular role, in a particular act, that could
// have been filled and was not); resolving it is CON·Figure — the *same*
// cell ordinary reference resolution already occupies (memory/activation.js
// declares CON·Figure for pronoun binding). That is not a coincidence to
// paper over: it is the reason resolution here calls kernel/contest.js's
// real `adjudicate` instead of writing a second scoring rule. contest.js
// is already proven omnimodal (its own test file adjudicates a motif
// across bars of an ensemble score); this file adds no statistics of its
// own, only candidate collection and cell-typing around it.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not distinguish "this role
// was addressed and explicitly denied" (true negation — "Mary did NOT
// leave") from "this role was never addressed" (silence to be filled by
// inference) — that is a polarity question, and polarity detection is
// medium-specific (an adapter's job, the way `priors.js`'s NEGATION_WORDS
// already is one for text). `filled` here only ever means "this role was
// positively supplied a value"; anything else is an absence, and whether
// that absence is meaningful is for the caller's own schema declaration to
// say (a schema with only two roles that both got filled produces no
// absences at all — nothing here manufactures a gap that was never
// expected).

import { cellOf } from "./cube.js";
import { adjudicate } from "./contest.js";

export const ABSENCE_SCHEMA = "EOSlotAbsence@1";

/** NUL·Figure: a particular role in a particular act, declared-absent. */
export const ABSENCE_CELL = Object.freeze(cellOf("NUL", "Figure"));

/** CON·Figure: the same cell ordinary reference resolution occupies. */
export const RESOLUTION_CELL = Object.freeze(cellOf("CON", "Figure"));

/**
 * declareAct({ id, at, schema, expectedRoles, filled }) — register one act
 * of a recurring schema, and type every expected-but-unfilled role as a
 * NUL event rather than letting it vanish silently.
 *
 * `at` is an integer on the caller's own clock (the same P5.4 discipline
 * `kernel/return-curve.js` already holds: the caller states its unit).
 * `expectedRoles` is the schema's own closed role set — declared once,
 * never defaulted, never inferred from what happens to be filled.
 */
export function declareAct({ id, at, schema, expectedRoles, filled = {} } = {}) {
  if (id == null) throw new TypeError("declareAct: id is required");
  if (!Number.isFinite(at)) throw new TypeError("declareAct: at is declared on the caller's own clock — never defaulted");
  if (typeof schema !== "string" || !schema) throw new TypeError("declareAct: schema is required — the caller's own name for this recurring shape");
  if (!Array.isArray(expectedRoles) || expectedRoles.length === 0)
    throw new TypeError("declareAct: expectedRoles is the schema's own closed role set — declared once, never inferred from `filled`");

  const filledFrozen = Object.freeze({ ...filled });
  const act = Object.freeze({ id, at, schema, filled: filledFrozen });

  const absences = expectedRoles
    .filter((role) => !Object.prototype.hasOwnProperty.call(filledFrozen, role))
    .map((role) => Object.freeze({
      schema: ABSENCE_SCHEMA,
      op: ABSENCE_CELL.op,
      grain: ABSENCE_CELL.grain,
      cell: ABSENCE_CELL,
      actId: id,
      at,
      role,
      // What a resolution proves: this act's own shape, so candidatesFor
      // never has to re-derive it from the act it came from.
      forSchema: schema,
    }));

  return Object.freeze({ act, absences: Object.freeze(absences) });
}

/**
 * candidatesFor(absence, priorActs) — every EARLIER act of the SAME schema
 * that positively filled the absent role. Earlier only (P5.4/S3: nothing
 * computed from an act the caller has not yet declared) — resolution never
 * reaches forward.
 *
 * Returns [{ id, at, value }], the raw material a caller turns into
 * `adjudicate`'s own `scores` — this function assigns no score itself.
 */
export function candidatesFor(absence, priorActs = []) {
  const out = [];
  for (const prior of priorActs) {
    if (!prior || prior.schema !== absence.forSchema) continue;
    if (!(prior.at < absence.at)) continue;
    if (!Object.prototype.hasOwnProperty.call(prior.filled ?? {}, absence.role)) continue;
    out.push(Object.freeze({ id: prior.id, at: prior.at, value: prior.filled[absence.role] }));
  }
  return Object.freeze(out);
}

/**
 * resolveAbsence(absence, candidates, opts) — CON the absence to a winning
 * candidate. `opts` is exactly `contest.js::adjudicate`'s own signature
 * (scores/coPresent/minActivation/minMargin/contestedMargin/admissible) —
 * nothing here recomputes a verdict adjudicate already knows how to reach.
 * `scores` is the caller's own Map<id, number>; this organ has no opinion
 * on how recency, salience, or anything else should be weighted — that is
 * exactly the tier boundary `adjudicate`'s own docstring already draws
 * ("this file computes no scores and knows nothing about how they were
 * earned").
 *
 * `value` mirrors `adjudicate`'s own `id` field byte for byte ONLY on a
 * "bound" verdict. Under any refusing verdict (BELOW_FLOOR, NO_MARGIN,
 * CONTESTED_NO_MARGIN, NO_CANDIDATE, NULL_NOT_CLEARED) `value` is null and
 * `id` is null — a refusal carries no licence to bind — while the leading
 * candidate is still surfaced under `leaning`/`leaningId` for the same
 * disclosure reason `adjudicate`'s own `detail` text names what it declined
 * to bind rather than staying silent. A CALLER must gate on
 * `verdict === "bound"` before trusting `value` as a real resolution — an
 * ambiguous ellipsis still names what it was leaning toward, it does not
 * therefore count as read.
 */
export function resolveAbsence(absence, candidates, opts = {}) {
  const verdict = adjudicate(opts);
  const won = verdict.id != null ? candidates.find((c) => c.id === verdict.id) : null;
  if (verdict.verdict !== "bound") {
    return Object.freeze({
      ...verdict,
      cell: RESOLUTION_CELL,
      role: absence.role,
      actId: absence.actId,
      value: null,
      leaning: won ? won.value : null,
      leaningId: verdict.id ?? null,
      id: null,
    });
  }
  return Object.freeze({
    ...verdict,
    cell: RESOLUTION_CELL,
    role: absence.role,
    actId: absence.actId,
    value: won ? won.value : null,
  });
}
