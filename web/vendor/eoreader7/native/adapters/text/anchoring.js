// native/adapters/text/anchoring.js — bind a definite/possessive descriptor
// occurrence to an already-admitted referent by the SAME one-hop activation
// recall pronouns.js already trusts for referent identity.
//
// THE-ADDRESS.md applied (2026-09-13): `anchor:` and `definite-binding:` are
// ACTS under a reading, so A5 — hashed over the binding's own content (no
// recipe is in scope here); `ref:desc:` names a BEING — A2, left untouched.
//
// This is the generalization the lineage already recorded ("a surface span
// is never the thing with a part of speech — the referent is"): pronouns.js
// resolves "he/she"; this file resolves "the creature" / "my father" — the
// same cue → recall → best-single-hop → floors → binding-or-typed-gap loop,
// over the same memory/activation.js organs, imported whole and never
// re-derived. What differs is only the surface class being resolved and the
// consumer: a pronoun binding informs coreference; a descriptor binding is
// IDENTITY EVIDENCE — it feeds deriveIdentityRevision's support/attack
// grammar (kernel/identity.js), which is what turns the ~900 forever-open
// descriptor hypotheses per novel into release traffic (see
// native/eval/results/understanding-scoreboard-RESULTS.md — the baseline
// this file exists to move).
//
// CAUSALITY: evidence at sentence n recalls only frames encoded from
// sentences < n (recall's own selfOrder exclusion). A binding never uses
// the sentence it is read from, and never anything later.
//
// CONSERVATIVE GATE, same discipline as pronouns.js: a descriptor is
// resolved only in a sentence that names NO admitted referent surface.
// A descriptor sharing its sentence with a name is left alone — this file
// does not adjudicate between a co-mentioned name and a descriptor (they
// are usually two different beings: "the creature" and "Frankenstein" in
// one sentence). Fewer, cleaner bindings over more, guessed ones.
//
// Declared numbers: minActivation / minMargin are REQUIRED (pronouns.js's
// own contract, verbatim) — how much recall counts as a real echo, and how
// far the winner must lead, are never defaults. No gender filter is
// applied: a descriptor is not reliably gendered, and a wrong hard filter
// is worse than none — disclosed, not hidden.

import { sha256hex } from "./sha256hex.js";
import { tokens, codeOf, recall, encodeFrame } from "../../memory/activation.js";

const DEFAULT_COMPLETION = 0.5;
const DEFAULT_TOP_EDGES = 6;
const DEFAULT_EDGE_SLOTS = 24;

const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const slug = (x) => norm(x).replace(/\s+/g, "_");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const surfaceMatcher = (surfaces) => {
  const parts = [...surfaces].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe);
  if (!parts.length) return null;
  return new RegExp(`\\b(${parts.join("|")})\\b`, "giu");
};

/**
 * createDescriptorAnchoring — incremental: feed each sentence once, in
 * reading order, exactly as the causal perceiver already accumulates them.
 *
 * observe(sentence, occurrences, referents) →
 *   { evidence: EOAnchorEvidence@1[], gaps: [...] }
 *
 * `sentence`   {text, order, offset}
 * `occurrences` this sentence's descriptor occurrences (EOReferentOccurrence@1
 *   shape — only `definite`/`possessive` determinations are resolved; an
 *   indefinite ("a servant") never implies one being and is skipped, the
 *   same rule referentFromDescriptorHypothesis already states).
 * `referents`  the currently-admitted cast: [{id, display, surfaces}]
 *
 * TWO MODES, THE SAME MARGIN DISCIPLINE:
 *
 * A. `declared` (default) — floors are fixed constants the caller names
 *    (minActivation / minMargin). The legacy operating point (0.05 / 0.2)
 *    lives here. Byte-identical to everything the fold has ever measured.
 *
 * B. `born` — the floors are CONTEXTUAL, derived from the material's own
 *    activation distribution rather than hand-picked per host. The raw
 *    recall scores are arbitrary-scale (cue length, idf, completion all
 *    rescale them; measured 59.1/12.2 on one corpus and 0.0003 on another),
 *    so a fixed raw floor is meaningless ACROSS materials: too high for a
 *    short chat session (never fires) and too low for a dense book (fires
 *    on noise). The Born rule maps amplitude to probability mass —
 *       p_i  =  a_i^2 / Σ a^2
 *    — the same map quantum mechanics uses, applied because the shape is
 *    right for the job: it preserves rank, it rewards a leader's lead
 *    quadratically (a strong echo is e.g. 0.96 mass against a runner-up's
 *    0.04 between the same two raw scores), and it is scale-free by
 *    construction. The floors then ARE the session's own earlier verdicts:
 *       minActivation = median of the top candidate's born mass seen so far
 *       minMargin     = median of the leader's mass lead (p_1 − p_2) so far
 *    A new descriptor must be at least as confident as a typical earlier
 *    binding on THIS material to bind. The first minWindow scenes have no
 *    past to consult, so they borrow the caller's DECLARED bootstrap values
 *    (bornActivationFloor / bornMarginFloor) — the contract survives: a
 *    floor is never a default, it is only ever derived or declared.
 */
export function createDescriptorAnchoring({
  minActivation,
  minMargin,
  idfFloor,
  minLen,
  completion = DEFAULT_COMPLETION,
  topEdges = DEFAULT_TOP_EDGES,
  edgeSlots = DEFAULT_EDGE_SLOTS,
  born = false,
  bornActivationFloor,
  bornMarginFloor,
  minWindow = 4,
} = {}) {
  if (born) {
    if (!Number.isFinite(bornActivationFloor) || bornActivationFloor <= 0 || bornActivationFloor >= 1)
      throw new TypeError("createDescriptorAnchoring (born): bornActivationFloor is declared — the bootstrap share a leader must clear before the material has spoken");
    if (!Number.isFinite(bornMarginFloor) || bornMarginFloor <= 0)
      throw new TypeError("createDescriptorAnchoring (born): bornMarginFloor is declared — the bootstrap lead the leader must keep before the material has spoken");
    if (!Number.isInteger(minWindow) || minWindow < 1)
      throw new TypeError("createDescriptorAnchoring (born): minWindow is declared — how many scenes give a floor before the material itself says");
  } else {
    if (!Number.isFinite(minActivation) || minActivation < 0)
      throw new TypeError("createDescriptorAnchoring: minActivation is declared — how much recall counts as a real echo is never a default");
    if (!Number.isFinite(minMargin) || minMargin < 0)
      throw new TypeError("createDescriptorAnchoring: minMargin is declared — how far a candidate must lead the runner-up is never a default");
  }

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const namedByFrame = new Map(); // sentence order -> Set(referentId)
  let matcher = null;
  let matcherSurfaceCount = -1;
  let surfaceToReferent = new Map();
  let normToReferent = new Map();
  let displayById = new Map();
  let castSeen = null;

  // Contextual born-rule state: the session's own verdict history, causal —
  // only scenes already read contribute, each scene once.
  const bornTops = [];
  const bornMargins = [];
  const median = (a) => {
    if (!a.length) return null;
    const b = [...a].sort((x, y) => x - y);
    const mid = b.length >> 1;
    return b.length % 2 ? b[mid] : (b[mid - 1] + b[mid]) / 2;
  };
  const bornFloors = () => {
    const activation = bornTops.length >= minWindow ? median(bornTops) : bornActivationFloor;
    const margin = bornMargins.length >= minWindow ? median(bornMargins) : bornMarginFloor;
    return { activation, margin, contextual: bornTops.length >= minWindow };
  };
  const bornOf = (candidates) => {
    let sq = 0;
    for (const [, a] of candidates) sq += a * a;
    if (!(sq > 0)) return null;
    return candidates.map(([r, a]) => [r, (a * a) / sq]);
  };

  // (2026-09-07) The cast is handed over on every sentence and was rebuilt
  // on every sentence; the perceiver's `cache.referents` is one array per
  // refresh window, so the same array is the same cast. And `namedIn`'s
  // case-blind fallback walked EVERY surface per hit; the first surface
  // whose norm equals the key wins, which is one Map built here, once.
  const refreshCast = (referents) => {
    if (referents === castSeen) return;
    castSeen = referents;
    const surfaces = new Map();
    const displays = new Map();
    const norms = new Map();
    for (const ref of referents ?? []) {
      if (!ref?.id) continue;
      displays.set(ref.id, ref.display ?? (ref.surfaces ?? [])[0] ?? ref.id);
      for (const s of ref.surfaces ?? []) if (s) surfaces.set(s, ref.id);
    }
    // Map insertion order is the original loop's order, so the FIRST surface
    // with a given norm is the one recorded — the one `break` used to keep.
    for (const [surface, ref] of surfaces) { const k = norm(surface); if (!norms.has(k)) norms.set(k, ref); }
    if (surfaces.size !== matcherSurfaceCount) {
      matcher = surfaceMatcher(surfaces.keys());
      matcherSurfaceCount = surfaces.size;
    }
    surfaceToReferent = surfaces;
    normToReferent = norms;
    displayById = displays;
  };

  const namedIn = (text) => {
    const named = new Set();
    if (!matcher) return named;
    matcher.lastIndex = 0;
    let m;
    while ((m = matcher.exec(text))) {
      // The matcher is case-insensitive; the surface map is not. Try the
      // literal hit, then each registered surface case-blind.
      const hit = m[1];
      const direct = surfaceToReferent.get(hit);
      if (direct) { named.add(direct); continue; }
      const ref = normToReferent.get(norm(hit));
      if (ref) named.add(ref);
    }
    return named;
  };

  const observe = (sentence, occurrences = [], referents = []) => {
    refreshCast(referents);
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });
    const named = namedIn(sentence.text);

    const evidence = [];
    const gaps = [];
    const resolvable = (occurrences ?? []).filter(
      (occ) => occ && (occ.determination === "definite" || occ.determination === "possessive"),
    );

    if (named.size === 0 && resolvable.length > 0) {
      const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
      // BEST single hop per referent — pronouns.js's own discipline,
      // verbatim reasoning in its header: summing across frames rewards
      // ubiquity of naming, not strength of resemblance.
      const referentScore = new Map();
      for (const [order, amt] of activation) {
        const refs = namedByFrame.get(order);
        if (!refs) continue;
        for (const r of refs) if (amt > (referentScore.get(r) ?? -Infinity)) referentScore.set(r, amt);
      }
      const candidates = [...referentScore.entries()].sort((a, b) => b[1] - a[1]);

      for (const occ of resolvable) {
        if (!candidates.length) {
          gaps.push({ reason: "descriptor_no_candidate", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, detail: "no admitted referent has been named and activated yet — nothing here to bind to" });
          continue;
        }
        // A margin computed against a runner-up of zero is not a
        // measurement — it is vacuously 1.0 whenever exactly one referent
        // has any recall at all, which is every sentence of a
        // one-character stretch. Measured on Frankenstein's opening
        // letters: with only Margaret admitted, "the stranger" (Victor,
        // not yet named) bound to her at full margin. binding.js's own
        // structural rule, applied here: one candidate has no competition
        // to test. Identity evidence canonicalizes edges, so it is held
        // to this stricter bar than a pronoun binding.
        if (candidates.length < 2) {
          gaps.push({ reason: "descriptor_no_competition", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: candidates[0][0], detail: "only one referent has any recall — a margin against nothing is not a measurement" });
          continue;
        }
        const [topRef, topScore] = candidates[0];
        // In born mode the activation floor and margin are the session's own
        // past verdicts on THIS material, computed BEFORE this scene records
        // itself (a floor that could see the scene it judges would leak the
        // outcome into the test). Raw recall scores are arbitrary-scale, so
        // the comparison is done in born mass (p_i = a_i² / Σa²): a leader's
        // lead is rewarded quadratically and the scale disappears entirely.
        const judged = born
          ? bornOf(candidates)
          : candidates.map(([r, a]) => [r, a / (candidates[0]?.[1] ?? 1)]);
        const judgedTop = judged[0]?.[1] ?? 0;
        const judgedSecond = judged[1]?.[1] ?? 0;
        const marginOf = judgedTop > 0 ? Math.max(0, (judgedTop - judgedSecond) / judgedTop) : 0;
        const floor = born ? bornFloors() : { activation: minActivation, margin: minMargin, contextual: false };

        if (born) {
          bornTops.push(judgedTop);
          bornMargins.push(marginOf);
        }
        if (judgedTop < floor.activation) {
          gaps.push({ reason: "descriptor_below_floor", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: topRef, activation: born ? judgedTop : topScore, contextual: floor.contextual, detail: born
            ? `top candidate's born mass (${judgedTop.toFixed(3)}) does not clear the floor ${floor.contextual ? `the session's own median (${floor.activation.toFixed(3)})` : `(bootstrap ${floor.activation.toFixed(3)})`}`
            : `top candidate's recall (${topScore.toFixed(3)}) does not clear minActivation (${minActivation})` });
          continue;
        }
        const second = candidates[1]?.[1] ?? 0;
        const margin = topScore > 0 ? (topScore - second) / topScore : 0;
        if (marginOf < floor.margin) {
          gaps.push({ reason: "descriptor_no_margin", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: topRef, runnerUp: candidates[1]?.[0] ?? null, margin: born ? marginOf : margin, contextual: floor.contextual, detail: born
            ? `top candidate leads the runner-up by only ${(marginOf * 100).toFixed(1)}% born mass, short of ${floor.contextual ? `the session's own median lead (${(floor.margin * 100).toFixed(1)}%)` : `the bootstrap lead (${(floor.margin * 100).toFixed(1)}%)`}`
            : `top candidate leads the runner-up by only ${(margin * 100).toFixed(1)}%, short of minMargin (${(minMargin * 100).toFixed(1)}%)` });
          continue;
        }
        // A5 (THE-ADDRESS.md): the anchor is an act under a reading — its
        // id and witness hash the binding's own content (the sentence it was
        // read from, its byte offset, the descriptor's canonical surface and
        // head, its determination, and the referent it resolved to). Same
        // binding re-read dedups; a different resolution is a different act.
        const anchorContent = `anchor|text:${sentence.text}|off:${sentence.offset}|canon:${occ.canonicalSurface}|head:${(occ.canonicalSurface ?? "").split(/\s+/).at(-1)}|det:${occ.determination}|ref:${topRef}`;
        evidence.push(Object.freeze({
          schema: "EOAnchorEvidence@1",
          id: sha256hex(anchorContent),
          descriptor: occ.canonicalSurface,
          determination: occ.determination,
          occurrenceRef: occ.id ?? null,
          // The occurrence id an EDGE PARTICIPANT actually carries, when
          // this occurrence came from one. Edge participants live in their
          // own id space (`occ:{seq}:{rel}:{role}`), separate from
          // text-derived descriptor occurrences (`ref-occ:...`) — measured
          // at zero overlap, which is why binding only the latter left the
          // composition ledger with no bridges at all.
          participantOccurrence: occ.participantOccurrence ?? null,
          referent: topRef,
          referentSurface: displayById.get(topRef) ?? topRef,
          activation: topScore,
          bornMass: born ? judgedTop : undefined,
          margin,
          sentenceOrder: sentence.order,
          witness: sha256hex(`${anchorContent}|wit`),
          provenance: Object.freeze({
            giver: "text/anchoring::createDescriptorAnchoring",
            tier: "engine",
            basis: born
              ? `one-hop activation recall over the already-admitted cast, contextual born floors — p_i = a_i^2 / Σa^2, floors from the session's own prior verdicts (${floor.contextual ? "material-derived" : "declared bootstrap"})`
              : "one-hop activation recall over the already-admitted cast, floors declared by the caller",
          }),
        }));
      }
    }

    namedByFrame.set(sentence.order, named);
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
    return { evidence, gaps };
  };

  return Object.freeze({ observe });
}

/**
 * Convert anchor evidence into deriveIdentityRevision's own support/attack
 * grammar, against the fold's live alternatives. Pure — no state.
 *
 *  - Every anchor SUPPORTS descriptor ↔ its bound referent's surface.
 *  - An anchor ATTACKS any LIVE alternative that pairs the same descriptor
 *    with a DIFFERENT referent surface: the same descriptor confidently
 *    bound to two different beings is incompatible multiplicity — exactly
 *    the "separated co-presentation" shape identity-evidence.js already
 *    types, arrived at through recall instead of copresence.
 */
export function identityEvidenceFromAnchors(anchors = [], fold = {}) {
  const supports = [];
  const attacks = [];
  const live = (fold?.unresolvedAlternatives ?? []).filter(
    (x) => x?.schema === "EOIdentityAlternative@1" && x.standing !== "distinct" && x.standing !== "refused",
  );
  for (const anchor of anchors) {
    if (anchor?.schema !== "EOAnchorEvidence@1") continue;
    const left = norm(anchor.descriptor);
    const right = norm(anchor.referentSurface);
    if (!left || !right || left === right) continue;
    supports.push({ left, right, witness: anchor.witness, giver: anchor.provenance?.giver ?? "text/anchoring", reason: "descriptor_activation_anchor" });
    for (const alt of live) {
      const pairsDescriptor = alt.left === left || alt.right === left;
      if (!pairsDescriptor) continue;
      const other = alt.left === left ? alt.right : alt.left;
      if (other === right) continue; // same binding — that IS the support above
      attacks.push({ left: alt.left, right: alt.right, witness: anchor.witness, giver: anchor.provenance?.giver ?? "text/anchoring", reason: "descriptor_bound_to_different_referent" });
    }
  }
  return { supports, attacks };
}

/**
 * Project anchor evidence into the occurrence-binding shape the relation-
 * composition ledger reads (`EODefiniteBinding@1` — relation-composition.js's
 * own OCCURRENCE_BINDING_SCHEMAS).
 *
 * This is a projection, not a re-derivation: an anchor already IS a definite
 * binding by construction — a definite/possessive descriptor occurrence
 * resolved to one admitted referent, above declared floors, with its own
 * witness. The two schemas exist because two sessions built the same fact
 * from different directions (recall-based anchoring here; the discourse
 * index there); naming that equivalence explicitly is cheaper and more
 * honest than either side silently re-deriving the other's evidence.
 *
 * Composition chains bridge on RESOLVED referents, so without this bridge an
 * anchoring reader's edges have no bridges at all and the Hyperlexicon comes
 * back empty — measured, not hypothesized (native/eval/results/
 * experienced-new-book.json's own first run: 932 relation edges, 0 bindings,
 * 20 chain sites, 0 candidates).
 */
export function anchorAsDefiniteBinding(anchor) {
  const occurrence = anchor?.participantOccurrence ?? anchor?.occurrenceRef;
  if (anchor?.schema !== "EOAnchorEvidence@1" || !occurrence || !anchor.referent) return null;
  // A5 (THE-ADDRESS.md): the binding is an ACT — the same occurrence bound to
  // the same referent by the same anchor is one binding and must dedup, so
  // its id is a content hash of (occurrence + referent + the anchor that
  // made it), never a position or an index.
  return Object.freeze({
    schema: "EODefiniteBinding@1",
    id: sha256hex(`definite-binding|occ:${occurrence}|ref:${anchor.referent}|anchor:${anchor.id}`),
    occurrence,
    referent: anchor.referent,
    surface: anchor.descriptor,
    witness: anchor.witness,
    provenance: Object.freeze({
      giver: "text/anchoring::anchorAsDefiniteBinding",
      basis: "projection of a witnessed EOAnchorEvidence@1 — an anchored descriptor occurrence IS a definite binding",
      activation: anchor.activation,
      margin: anchor.margin,
    }),
  });
}

/**
 * descriptorBeings — admit a recurring, UNANCHORED definite descriptor as a
 * being in its own right. This is the door for the cast's namefloor gap:
 * Walton's master and lieutenant, Victor-as-"the stranger" before he is
 * named — beings the capitalised-surface cast can never hold because the
 * book never names them, so every pronoun near them binds the nearest wrong
 * candidate instead (measured: nested-narration's two pronoun arms agree on
 * only ~26% of Frankenstein sentences both bind, and the spot-checked
 * disagreements cluster exactly here).
 *
 * THE GATE MIRRORS THE BORN GATE, cited not invented: entity.js's own
 * admitFromArrivals requires floor(arrivals/2) >= 2 to run its witness
 * split, so any candidate with fewer than 4 arrivals is refused by that
 * gate regardless of any pre-filter — 4 is the lowest value at which the
 * gate, not a filter in front of it, decides (CLAUDE.md, the minArrivals
 * incident). `minArrivals` stays the caller's to declare; 4-with-citation
 * is the value this repo's drivers use.
 *
 * ANCHORED DESCRIPTORS ARE EXCLUDED by construction: a descriptor the
 * anchoring organ successfully bound is evidence about an EXISTING being
 * ("the creature" -> the creature's referent), and admitting it as a second
 * being would fork every identity it supports. The caller passes the set of
 * canonical surfaces that ever anchored; only never-anchored recurrence
 * admits. Arrivals are counted per DISTINCT sentence — twice in one
 * sentence is one arrival (binding.js's own structural reading of
 * co-arrival, applied to admission).
 */
export function descriptorBeings(occurrences = [], { minArrivals, anchoredSurfaces, beingEvidence = null } = {}) {
  if (!Number.isInteger(minArrivals) || minArrivals < 1)
    throw new TypeError("descriptorBeings: minArrivals is declared — how much recurrence admits a being is the caller's to say, with its justification");
  const anchored = anchoredSurfaces instanceof Set ? anchoredSurfaces : new Set(anchoredSurfaces ?? []);

  const bySurface = new Map(); // canonical surface -> { sentences:Set, first, exact }
  const possessiveRefused = new Set();
  for (const occ of occurrences) {
    // DEFINITE ONLY, and the exclusion of possessives is a wall, not a
    // filter choice: "my father" is speaker-relative — the same string
    // names a different being in each teller's mouth (the coref prior's
    // own first-person rule, one determiner over). Admitting one app-wide
    // would multiply the 'I' mistake. Frame-scoped possessive beings are
    // real future work, refused here by type so the refusal is countable.
    if (occ?.determination === "possessive") { const c = norm(occ.canonicalSurface ?? occ.surface); if (c) possessiveRefused.add(c); continue; }
    if (!occ || occ.determination !== "definite") continue;
    const canon = norm(occ.canonicalSurface ?? occ.surface);
    if (!canon) continue;
    const at = occ.sentenceOrder ?? occ.encounterRef ?? null;
    if (at == null) continue;
    const row = bySurface.get(canon) ?? { sentences: new Set(), first: at, exact: occ.exactSurface ?? occ.surface ?? canon };
    row.sentences.add(String(at));
    bySurface.set(canon, row);
  }

  const beings = [];
  const refused = [];
  for (const canon of possessiveRefused) refused.push({ surface: canon, reason: "descriptor_speaker_relative", detail: "a possessive descriptor names a different being in each teller's mouth — the first-person rule, one determiner over" });
  for (const [canon, row] of bySurface) {
    if (anchored.has(canon)) { refused.push({ surface: canon, reason: "descriptor_anchored", detail: "this descriptor already binds an existing being — admitting it too would fork that identity" }); continue; }
    if (row.sentences.size < minArrivals) { refused.push({ surface: canon, reason: "descriptor_below_arrivals", arrivals: row.sentences.size, detail: `${row.sentences.size} distinct-sentence arrivals, below the declared ${minArrivals}` }); continue; }
    // BEING EVIDENCE, when the caller measured it: recurrence admits
    // things, not beings — measured on Frankenstein, recurrence alone
    // admitted "the murder", "the name", "the beauty" and pronoun binding
    // then landed on them. Clause-local pronoun CO-OCCURRENCE was tried
    // first and refuted by its own run ("he paced the deck" gave the deck
    // evidence — co-occurrence is not co-reference). What the caller
    // measures instead is the caller's to declare; this repo's drivers use
    // AGENCY: the descriptor standing in the subject slot of a verb the
    // material itself measured (discoverRelationVocab's own slot, no new
    // class) — beings act.
    if (beingEvidence) {
      const ev = beingEvidence.get?.(canon) ?? 0;
      if (ev < 1) { refused.push({ surface: canon, reason: "descriptor_no_being_evidence", arrivals: row.sentences.size, detail: "recurs, but never acts — no occurrence in the subject slot of a measured verb; a thing, not a being, on this material's own evidence" }); continue; }
    }
    beings.push(Object.freeze({
      schema: "EODescriptorBeing@1",
      id: `ref:desc:${slug(canon)}`,
      display: row.exact,
      canonicalSurface: canon,
      arrivals: row.sentences.size,
      firstAt: row.first,
      provenance: Object.freeze({ giver: "text/anchoring::descriptorBeings", gate: "distinct-sentence arrivals >= declared minArrivals; never-anchored only" }),
    }));
  }
  beings.sort((a, b) => b.arrivals - a.arrivals);
  return { beings, refused };
}
