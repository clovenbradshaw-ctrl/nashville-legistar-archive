// native/organs/target-resolve.js — THE MISSING RESOLVER: five real matching
// modalities (Exact, Pattern, Near-Miss, and four named Shape kinds), unified
// behind one ordered resolver, so a caller doesn't have to rediscover
// cast.js::resolve's own discipline to get target-matching right.
//
// Born from a direct question: does Structure Search support regex, fuzzy
// matching, and shape similarity? All three already existed, scattered and
// unconnected: plain RegExp (used everywhere as an internal primitive but
// never exposed as a search modality of its own), surfaces.js's
// osaDistanceAtMost1/isNearMissSpelling (near-miss — this codebase's own
// name; "fuzzy" is not a term it uses), and FOUR distinct kinds of "shape"
// already built for entirely different reasons — kind-standing.js's own
// signature (the company a word keeps), arrow.js's k-gram distribution
// against itself reversed (order), consequential-surprise.js's cascade
// reach (reach), dmd.js's dynamic mode decomposition (rhythm). This file
// adds no new statistic and no new null of its own: it composes what
// already exists, and adds exactly one new thing — resolveTarget's ordering
// — which nothing had before.
//
// THE DISCIPLINE THIS FILE MUST NOT WATER DOWN (surfaces.js's own words,
// measured not assumed: "Reed"/"Reid" and "Allen"/"Allan" are each
// edit-distance-1 AND exact homophones AND genuinely different surnames).
// Near-miss is a comparator only, never decides identity alone. It runs
// LAST, as a fallback, only once every stronger modality found nothing, and
// a tie among survivors is REFUSED (typed, not guessed) at whichever
// modality produced it — cast.js::resolve is the named precedent;
// resolveTarget generalizes its ordering to arbitrary candidate sets, not
// only referents.
//
// Shape is dispatched by name, never guessed: each of the four kinds needs
// its own real organ, injected by the caller (the same discipline
// surface-findings.js::promoteFinding already uses for its own two doors)
// — this file imports none of them, so it can never drift from what those
// organs actually compute, and a missing door is a typed refusal, never a
// silent no-op or a fabricated result.

import { osaDistanceAtMost1, isNearMissSpelling } from "../adapters/text/surfaces.js";

export const MATCH_SCHEMA = "EOMatch@1";
export const MIN_NEAR_MISS_LEN = 4; // derived from surfaces.js::MIN_VARIANT_LEN's own floor, never a second number

/** exactMatch(candidate, target) — literal identity, the strongest signal, tried first. */
export function exactMatch(candidate, target) {
  return String(candidate) === String(target);
}

/**
 * patternMatch(candidate, source, flags) — a declared RegExp run against one
 * candidate string. An invalid pattern is a typed refusal, never a thrown
 * SyntaxError a caller has to catch.
 */
export function patternMatch(candidate, source, flags = "") {
  let re;
  try { re = new RegExp(source, flags); }
  catch (e) { return { refused: "invalid_pattern", detail: e.message }; }
  return re.test(String(candidate ?? ""));
}

/**
 * nearMissMatch(candidate, target) — surfaces.js's own near-miss spelling
 * check, unmodified. Refuses (typed) below MIN_NEAR_MISS_LEN rather than
 * silently returning false, matching surfaces.js's own stated reason: below
 * the floor, one edit covers too much of the string to mean anything.
 * Callers are responsible for this file's ordering discipline (see header)
 * — this function alone never decides identity, exactly as surfaces.js
 * exports osaDistanceAtMost1/isNearMissSpelling as comparators only.
 */
export function nearMissMatch(candidate, target) {
  const a = String(candidate ?? ""), b = String(target ?? "");
  if (a.length < MIN_NEAR_MISS_LEN || b.length < MIN_NEAR_MISS_LEN) {
    return { refused: "below_length_floor", floor: MIN_NEAR_MISS_LEN };
  }
  return isNearMissSpelling(a, b);
}

export const SHAPE_KINDS = Object.freeze(["company", "order", "reach", "rhythm"]);

const SHAPE_DOOR_NAME = Object.freeze({
  company: "discoverCompanyKinds", // kind-standing.js(sentences, vocabulary, opts)
  order: "arrowOf",                // arrow.js(events, opts)
  reach: "consequentialSurprise",  // consequential-surprise.js(holograph, facts, opts)
  rhythm: "dmd",                   // dmd.js(X, Xp, opts)
});

/**
 * shapeMatch(kind, args, doors) — named dispatch onto whichever real organ
 * the caller injects; refuses an undeclared kind or a missing door rather
 * than guessing. `args` is spread as that organ's own real argument list;
 * this function adds no interpretation on top of what it returns, so a
 * caller reads the exact same verdict shape that organ's own tests pin.
 */
export function shapeMatch(kind, args, doors = {}) {
  if (!SHAPE_KINDS.includes(kind)) {
    return { refused: "unknown_shape_kind", detail: `shapeMatch: kind is one of ${SHAPE_KINDS.join(", ")}` };
  }
  const doorName = SHAPE_DOOR_NAME[kind];
  const fn = doors[doorName];
  if (typeof fn !== "function") {
    return { refused: "door_not_injected", detail: `shapeMatch: kind "${kind}" needs ${doorName} injected` };
  }
  return fn(...(Array.isArray(args) ? args : [args]));
}

/**
 * resolveTarget(target, candidates, opts) — cast.js::resolve's own ordering,
 * generalized: exact first, then a declared pattern, then a declared shape
 * kind, and near-miss LAST, only as a fallback once nothing stronger
 * matched. A tie — more than one candidate surviving the SAME modality — is
 * refused, never guessed, at whichever modality produced it.
 *
 * opts: { pattern: {source, flags?}?, shape: {kind, args, doors}?, allowNearMiss = true }
 */
export function resolveTarget(target, candidates, opts = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const { pattern = null, shape = null, allowNearMiss = true } = opts;

  const exact = list.filter((c) => exactMatch(c, target));
  if (exact.length === 1) return { schema: MATCH_SCHEMA, modality: "exact", match: exact[0] };
  if (exact.length > 1) return { schema: MATCH_SCHEMA, refused: "tie", modality: "exact", candidates: exact };

  if (pattern) {
    let re;
    try { re = new RegExp(pattern.source, pattern.flags ?? ""); }
    catch (e) { return { schema: MATCH_SCHEMA, refused: "invalid_pattern", detail: e.message, modality: "pattern" }; }
    const hits = list.filter((c) => re.test(String(c ?? "")));
    if (hits.length === 1) return { schema: MATCH_SCHEMA, modality: "pattern", match: hits[0] };
    if (hits.length > 1) return { schema: MATCH_SCHEMA, refused: "tie", modality: "pattern", candidates: hits };
  }

  if (shape) {
    const result = shapeMatch(shape.kind, shape.args, shape.doors);
    if (result?.refused) return { schema: MATCH_SCHEMA, ...result, modality: "shape" };
    return { schema: MATCH_SCHEMA, modality: `shape:${shape.kind}`, result };
  }

  if (allowNearMiss) {
    const near = list.map((c) => ({ c, r: nearMissMatch(c, target) })).filter((x) => x.r === true).map((x) => x.c);
    if (near.length === 1) return { schema: MATCH_SCHEMA, modality: "near-miss", match: near[0] };
    if (near.length > 1) return { schema: MATCH_SCHEMA, refused: "tie", modality: "near-miss", candidates: near };
  }

  return { schema: MATCH_SCHEMA, refused: "no_match", modality: null };
}
