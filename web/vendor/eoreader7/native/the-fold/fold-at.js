// the-fold/fold-at.js — the first real slice of the cursor-addressable fold
// interface (vision-end-state step 4): "at any point in that structure — any
// cursor, any referent, any moment — answer 'what is this, here' by returning
// the fold." Described three times across this project's own memory before
// this session; built zero times before this file.
//
// A "cursor" is a holon address (kernel/gfp-claim.js's own `holon()` -- "/",
// "/p3", "/p3/2"), the same addressing scheme every GFP claim's GROUND
// already uses. foldAt does the one thing nothing else in the repo did yet:
// given an address and a flat set of claims, return everything at, above,
// and below that point, using contains()/ancestry() exactly as gfp-claim.js
// defines them -- no new addressing scheme invented.
//
// ATMOSPHERE (2026-09-26 revision): wired for real. kernel/emergent-terrain.js
// (atmosphereProjection) and kernel/theory-of-mind.js both call
// interpretiveAtmosphereFactorField(obligations, {sequence}) the same way --
// two real, independent production call sites agreeing on the same shape
// (an array of obligation objects: {id, grounds, alternatives, consequences,
// persistence, openedAt, constraint}), checked before writing this revision
// rather than guessed. When the caller supplies `obligations`, foldAt calls
// the real function directly (not the private atmosphereProjection wrapper,
// which also stamps terrain-specific schema/id fields foldAt has no use for)
// and returns its real field. When none are supplied, the gap says exactly
// that -- no obligations for this cursor -- not "unwired."
//
// PARADIGM: still a typed gap, and the reason is now settled, not just
// pending. This session first assumed evaluateParadigm just needed "a live
// caller to verify against" the way atmosphere did, then found zero real
// callers of evaluateParadigm itself (only learnParadigm/learnParadigmEmergent
// have real callers). Checked further this revision: learnParadigmEmergent's
// own real caller (the-fold/learn-pass.js) builds its "unit" candidates via
// toInstanceUnits/segmentCollection/elementsOf, and paradigm.js's own
// unitFacts() reads u.elements for indentation, heading level/capitalization,
// block-breaks, sentence-final punctuation -- DOCUMENT FORMATTING structure,
// not claim content. This is a genuinely different candidate model than a
// GFP claim (rel/roles/polarity/ground); paradigm.js answers "is this
// document's TYPESETTING consistent with a learned form," not "does this
// claim hold." This is the same category of finding as hunt.js's "ground"
// and an archon's "cascade" mission, both false friends found earlier this
// session -- not a temporary gap awaiting a live caller, but a real domain
// mismatch. Left unwired; wiring it would require inventing a claim-to-
// formatting-element mapping this session has no real basis for.
//
// SIGNIFICANCE (2026-09-26, later revision): the prior claim here -- "no
// significance-measurement module exists anywhere in this repo" -- was
// WRONG, found and corrected the same session. Real modules exist:
// kernel/bayes-surprise.js (Bayesian surprisal of a slot/value admission
// against a holograph's accumulated prior) and kernel/consequential-
// surprise.js (partitions that surprise into load-bearing vs. local, against
// a real cascade-reach null -- exactly this vision's own "measured against a
// real null, never asserted" language). Both have real production callers
// (the-fold/expertise.js, form-prior.js, paradigm.js, learn-pass.js;
// kernel/settling.js, contextuality.js; organs/archon-compendium.js,
// capacities.js; docs/surprise-organs.js).
//
// Wired here: bayes-surprise.js's predict(holo, slot, value) only -- checked
// this revision that admit() MUTATES the holograph (holo.admitted++,
// holo.slots updated) while predict() is read-only, so predict is the one
// that keeps foldAt's own PURE contract intact. The caller supplies a
// holograph (bayes-surprise.js's own createHolograph output); foldAt derives
// slot/value pairs from the claims at this cursor's `here` (each claim's
// rel, polarity, and each role filler, using gfp-claim.js's own real field
// names) and reports the summed surprisal in bits -- a real number, not
// fabricated, but never committed back into the holograph (foldAt only asks
// "how surprising would this be", never "and now count it").
//
// CONSEQUENTIAL SURPRISE (2026-09-26, later revision): wired for real, using
// the-fold/claim-dependencies.js's claimDependencyIndex/seedsOfClaimFiller
// (built and tested standalone the prior cycle). One real conflict had to be
// resolved first: consequentialSurprise(holo, facts, ...) calls admit(holo,
// facts) INTERNALLY (checked by reading its source) -- unlike predict(),
// this mutates the holograph, which would break foldAt's own tested purity
// guarantee if called on the caller's own holo directly. Resolved by cloning
// the holograph (cloneHolograph below, a real deep copy of every field
// admit()/createHolograph() actually touch: schema, alpha, gamma, admitted,
// slots, absentMass) and running consequentialSurprise only on the clone --
// the caller's own holo is never admitted into, same guarantee as before.
// pValue is never defaulted (consequentialSurprise itself throws without one
// declared by the caller, and this project's own standing rule already
// forbids hand-set thresholds) -- this layer only activates when the caller
// supplies holo, index, AND pValue together; any one missing keeps it an
// honest gap.
//
// SIBLINGS (2026-09-26, later revision): named after live-testing foldAt
// against claimsFromFeat's own real output (arrange.js) found ancestors and
// descendants BOTH empty for every real, point-level cursor tried -- real
// claims from real material are true siblings of each other under a shared
// part, not ancestor/descendant, and foldAt had no category for that until
// now. `siblings` is purely structural (same parent holon, one level up,
// via gfp-claim.js's own segmentsOf/holon -- no new addressing concept), so
// it needed no external contract to verify against the way atmosphere or
// significance did.
import { holon, contains, ancestry, segmentsOf } from "../kernel/gfp-claim.js";
import { interpretiveAtmosphereFactorField } from "../kernel/atmosphere-math.js";
import { predict } from "../kernel/bayes-surprise.js";
import { consequentialSurprise } from "../kernel/consequential-surprise.js";

export const FOLD_AT_SCHEMA = "EOFoldAt@1";

/** GFP claim -> bayes-surprise.js slot/value facts. Each claim contributes
 *  its relation, polarity, and each of its role fillers as its own slot,
 *  keyed by the claim's own position so two claims at the same cursor never
 *  collide on the same slot name. */
export function slotsFromClaims(claims) {
  const slots = [];
  claims.forEach((c, i) => {
    if (!c || typeof c.rel !== "string") return;
    slots.push([`${i}:rel`, c.rel]);
    if (c.polarity) slots.push([`${i}:polarity`, c.polarity]);
    for (const [role, value] of Object.entries(c.roles ?? {})) slots.push([`${i}:role:${role}`, value]);
  });
  return slots;
}

/** A real deep copy of a bayes-surprise.js holograph -- every field admit()/
 *  createHolograph() actually set (checked by reading both this revision):
 *  schema, alpha, gamma, admitted, slots (a Map of Maps, each level cloned),
 *  absentMass. Used so consequentialSurprise's own internal admit() call
 *  never touches the caller's original holograph. */
export function cloneHolograph(holo) {
  const slots = new Map();
  for (const [slot, counts] of holo.slots) slots.set(slot, new Map(counts));
  return { schema: holo.schema, alpha: holo.alpha, gamma: holo.gamma, admitted: holo.admitted, absentMass: holo.absentMass, slots };
}

/** The parent of a holon: itself with its last segment dropped. "/" (no
 *  segments) has no parent -- returns null, not "/" (the root is not its
 *  own parent). */
function parentOf(h) {
  const segs = segmentsOf(h);
  if (!segs.length) return null;
  return holon(segs.slice(0, -1).join("/"));
}

/**
 * foldAt(address, claims, { obligations, sequence, holo, index, seedsOf, pValue }) -> {
 *   schema, address,
 *   here: claims whose ground is exactly this address,
 *   ancestors: claims whose ground CONTAINS this address, ordered outermost-first,
 *   descendants: claims whose ground is CONTAINED BY this address,
 *   siblings: claims that share this address's own parent (one level up),
 *     excluding anything already counted in here/ancestors/descendants,
 *   atmosphere: real interpretiveAtmosphereFactorField result when
 *     `obligations` is supplied and non-empty, else a typed gap,
 *   significance: real bayes-surprise.js predict() result over the `here`
 *     claims' slot/value facts when `holo` is supplied, else a typed gap;
 *     carries significance.consequential -- kernel/consequential-surprise.js's
 *     load-bearing/local partition when `index`, `seedsOf` and `pValue` are
 *     ALSO supplied, else its own typed gap,
 *   paradigm: a typed gap, not a fabricated value,
 * }
 *
 * PURE: no I/O, no model, no default corpus, and no mutation of anything
 * the caller passes in (predict() is read-only; consequentialSurprise runs
 * only on an internal clone of `holo`; the caller's own holo is never
 * admitted into either way). The caller supplies `claims` and, optionally,
 * `obligations`/`holo`/`index`/`seedsOf`/`pValue` -- this never reads a
 * session's own state or a file on its own.
 */
export function foldAt(address, claims = [], { obligations = [], sequence = null, holo = null, index = null, seedsOf = null, pValue = null } = {}) {
  const here = holon(address);
  const hereParent = parentOf(here);
  const atHere = [], ancestorsOf = [], descendantsOf = [], siblingsOf = [];

  for (const claim of claims) {
    if (!claim || typeof claim.ground !== "string") continue;
    const g = holon(claim.ground);
    if (g === here) { atHere.push(claim); continue; }
    if (contains(g, here)) { ancestorsOf.push(claim); continue; }
    if (contains(here, g)) { descendantsOf.push(claim); continue; }
    if (hereParent !== null && parentOf(g) === hereParent) { siblingsOf.push(claim); continue; }
    // no relation to this cursor at all: not part of this cursor's fold
  }

  // outermost ("/") first, closest-to-here last -- the same order a reader
  // would want context in: broad frame first, narrowing toward the point.
  const ancestryChain = ancestry(here);
  ancestorsOf.sort((a, b) => ancestryChain.indexOf(holon(a.ground)) - ancestryChain.indexOf(holon(b.ground)));

  // CONTACTS (2026-09-26): a relation orthogonal to the four above. Those
  // four are all POSITION -- where a claim's ground sits in the holon tree
  // relative to `here`. A contact is REFERENT: a claim anywhere in the
  // document, at any position, that shares one of `here`'s own role-filler
  // values -- the same shared-filler relation the-fold/claim-dependencies.js
  // already uses to find what a claim's consequence reaches through. Wired
  // whenever the caller supplies `index` alone (no seedsOf/pValue needed --
  // this reads the index, it runs no null simulation), so it is available
  // even when the heavier consequential layer below is not. Each contact is
  // tagged crossCutting: true when it shares NO ancestor/descendant/sibling
  // relation with `here` either -- a connection position alone would never
  // have shown.
  let contacts;
  if (index instanceof Map) {
    const idOf = (c) => c.id ?? c.ground;
    const byId = new Map(claims.map((c) => [idOf(c), c]));
    const hereIds = new Set(atHere.map(idOf));
    const ancestorGrounds = new Set(ancestorsOf.map((c) => holon(c.ground)));
    const descendantGrounds = new Set(descendantsOf.map((c) => holon(c.ground)));
    const siblingGrounds = new Set(siblingsOf.map((c) => holon(c.ground)));
    const foundIds = new Set();
    for (const claim of atHere) for (const value of Object.values(claim.roles ?? {})) for (const id of index.get(value) ?? []) if (!hereIds.has(id)) foundIds.add(id);
    const rows = [...foundIds].map((id) => byId.get(id)).filter(Boolean).map((c) => {
      const g = holon(c.ground);
      return { claim: c, crossCutting: !(ancestorGrounds.has(g) || descendantGrounds.has(g) || siblingGrounds.has(g)) };
    });
    const crossCutting = rows.filter((r) => r.crossCutting).length;
    contacts = {
      wired: true,
      rows,
      crossCutting,
      basis: `the-fold/claim-dependencies.js's own dependency index, read to find every claim elsewhere in the document sharing a role-filler value with a claim at this cursor -- ${rows.length} found, ${crossCutting} sharing no ancestor/descendant/sibling relation with this cursor at all (visible only through this layer).`,
    };
  } else {
    contacts = { wired: false, reason: "the-fold/claim-dependencies.js's claimDependencyIndex was not supplied -- pass `index` (built once over the document's own claims) to wire this layer. Unlike the consequential/load-bearing layer below, contacts needs only the index itself, never seedsOf or pValue." };
  }

  const atmosphere = obligations.length
    ? { wired: true, field: interpretiveAtmosphereFactorField(obligations, { sequence }), basis: "kernel/atmosphere-math.js's interpretiveAtmosphereFactorField, called with the caller's own supplied obligations -- the same call shape verified this revision against two real production callers (kernel/emergent-terrain.js, kernel/theory-of-mind.js)." }
    : { wired: true, field: null, reason: "no obligations were supplied for this cursor -- the wiring is real, there is simply nothing to compute an atmosphere from here." };

  let significance;
  if (holo) {
    const slots = slotsFromClaims(atHere);
    const perSlot = slots.map(([slot, value]) => ({ slot, value, ...predict(holo, slot, value) }));
    const totalBits = perSlot.reduce((s, x) => s + x.bits, 0);

    let consequential;
    if (index instanceof Map && typeof seedsOf === "function" && pValue !== null) {
      const facts = Object.fromEntries(slots);
      const result = consequentialSurprise(cloneHolograph(holo), facts, { index, seedsOf, pValue });
      consequential = {
        wired: true,
        consequentialBits: result.consequentialBits,
        localBits: result.localBits,
        rows: result.rows,
        basis: `kernel/consequential-surprise.js's consequentialSurprise(), run on a CLONE of the supplied holograph (the caller's own holo is never admitted into) -- partitions this cursor's surprisal into load-bearing (reaches farther through the index than a null of ${result.trials} synthetic seed sets) vs. local, at the caller's own declared pValue=${result.pValue}.`,
      };
    } else {
      consequential = { wired: false, reason: "kernel/consequential-surprise.js's consequentialSurprise() needs a dependents index (e.g. the-fold/claim-dependencies.js's claimDependencyIndex), a seedsOf function (e.g. seedsOfClaimFiller), and a caller-declared pValue -- none defaulted, per consequentialSurprise's own guard and this project's standing rule against hand-set thresholds. Supply all three to wire this layer." };
    }

    significance = {
      wired: true,
      totalBits,
      perSlot,
      consequential,
      basis: `kernel/bayes-surprise.js's predict(), read-only, over ${slots.length} slot(s) derived from the ${atHere.length} claim(s) at this cursor -- the prior's surprisal if these facts were admitted, never actually admitted into the supplied holograph.`,
    };
  } else {
    significance = { wired: false, reason: "kernel/bayes-surprise.js's predict() is real and usable (a holograph from createHolograph() was not supplied to this call). The heavier, load-bearing kernel/consequential-surprise.js layer additionally needs a dependents index, a seedsOf function, and a declared pValue -- see the-fold/claim-dependencies.js." };
  }

  return {
    schema: FOLD_AT_SCHEMA,
    address: here,
    here: atHere,
    ancestors: ancestorsOf,
    descendants: descendantsOf,
    siblings: siblingsOf,
    contacts,
    atmosphere,
    paradigm: { wired: false, reason: "the-fold/paradigm.js's evaluateParadigm operates on a document-formatting 'unit' (indentation, heading level, block-breaks, sentence-final punctuation -- checked via its own unitFacts() and learn-pass.js's real learnParadigmEmergent caller), not claim content -- a genuine domain mismatch with foldAt's GFP claims, not a temporary gap awaiting a live caller. Wiring it would require inventing a claim-to-formatting-element mapping with no real basis. Left unwired." },
    significance,
  };
}
