// reality-kind.js — is a referent real, fictional, or fictionalized-real?
//
// THE ASK, near-verbatim: cross-document referent identity is "the same
// thing as when we instantiate an entity... a different type of being-hood,
// because this is a cross-document entity" — which bridges.js already
// builds, unmodified here (see its own header: "it is the same set of
// operations, just at another level"). What bridges.js does NOT do is type
// WHAT KIND of correspondence a referent has: two accounts of the real
// Battle of Borodino both mention Napoleon and Kutuzov (real, historical,
// checkable against a source no one calls fiction) alongside Pierre
// Bezukhov, Andrei Bolkonsky, Natasha Rostova (invented, checkable against
// nothing, ever). "Kind induction... organically discovering that some are
// real, some are fictional, some are fictionalization of real" is this
// file's whole job.
//
// THE CUBE CELL, resolved before writing (P92): this is NOT statistical
// kind DISCOVERY (kind-standing.js/`kinds` capacity, SIG·Kind — a basin
// found from distributional company with a null) and NOT a declared kind
// tested against an induced-population null (`kindnull`, NUL·Kind). A
// referent's reality-kind is one of a SMALL, FIXED, hand-declared set of
// three templates (real / fictionalized-real / fictional), and placing a
// SPECIFIC referent into one of them from checked cross-document evidence
// is INSTANTIATION, not discovery or statistical membership — the same act
// `skill` (INS·Kind, "a procedure kept as code, instantiated onto new
// material") already occupies at this cell, for a different kind of thing.
// This is a SECOND organ at INS·Kind (Existence·Pattern) — consistent with
// THE-MODULE-CENSUS's own finding that every registered cell already
// carries more than one organ once the whole tree is read. Registered in
// capacities.js as `realityKind`.
//
// WHY THIS DOES NOT ROUTE THROUGH bridges.js'S OWN LEDGER, disclosed as a
// SCOPE decision rather than an oversight. bridges.js derives a bridge only
// from a content note's exact (subject, verb, object) triple crossing
// sources — P86's own measured boundary: "12 of 12 examined candidates had
// two faces that were the IDENTICAL STRING... a paraphrase never matches
// the triple, so it never becomes a bridge candidate." Two independently
// authored accounts of one battle essentially never share a full triple
// verbatim (rashomon-contrast-RESULTS.md measured 1 shared claim in 1,663 on
// this EXACT material). Routing reality-kind through bridges.js would
// therefore answer "fictional" for nearly everyone, INCLUDING Napoleon —
// not because he is fictional, but because the bridge mechanism's own
// disclosed ceiling was never built to reach a paraphrase. What DOES reach
// across a paraphrase, already built and already the identity primitive
// this whole project holds every organ to (P11): `namesCorefer`, the same
// test cast.js's own `resolve()` uses for within-document identity. A NAME
// is a much narrower object than a whole asserted relation, and "Napoleon"
// in one document's cast and "Napoleon" in another's are the same
// correspondence question bridges.js asks, answered at a grain where an
// exact match is actually common instead of vanishingly rare.
//
// THE HONEST COST OF THAT CHOICE, stated rather than smoothed over: a bare
// name correspondence carries none of a bridge's own provenance (no
// witness, no `join` recording which content note assumed it) and is
// weaker evidence than a corroborated bridge — two different people who
// happen to share a surname would correspond here and would not falsely
// bridge in bridges.js, which requires a matching STATEMENT, not just a
// matching NAME. Disclosed as a real, named limit, not hidden: `checkedBy`
// on every correspondence names which primitive produced it, so a stronger
// bridges.js correspondence (when one exists) is never confused with this
// weaker one. Composing both signals — this file's cross-source names AND
// bridges.js's corroborated triples, with the stronger one winning where
// both exist — is real, scoped, unattempted future work.
//
// GENRE IS DECLARED, NEVER INDUCED (the giver discipline, priors.js's own
// standing rule, applied to a new closed class of exactly two values). This
// file computes nothing about whether a source IS fiction — that is a
// judgment call the CALLER makes and must name, the same way `blankFurniture`
// or `posPriorFor` are caller-declared organs elsewhere in this codebase. A
// source with no declared genre is refused rather than guessed at.
//
// EXAMINED, NOT CONVICTED (the withhold-vs-convict rule this project holds
// everywhere else — grounding-ladder's own constitutional statement, one
// register over). "Fictional" here never means "does not exist" — it means
// "examined against every declared-nonfiction source this call was given,
// and no correspondence was found." A referent classified fictional today
// against ONE nonfiction source could correspond to a second one nobody
// checked yet; `checkedAgainst` names exactly what was examined so nobody
// downstream reads more certainty into it than the check actually earned.
//
// Pure; no organs injected beyond `namesCorefer`/`diaNorm`/`genericTokens`
// (surfaces.js's own organs, the cast.js pattern) — this file never builds
// a cast, a bridge ledger, or a hyperlexicon; it is handed referent indices
// already built by cast.js and a genre declaration, and reports
// correspondences and classifications over them.
//
// AMENDED, same pass, found by RUNNING it on the real fixtures rather than
// assumed safe: bare `namesCorefer` alone let Tolstoy's "Pierre" (this
// excerpt's only established surface for him — no fuller form appears)
// correspond to the Wikipedia article's "Jean Pierre Lanabère Charles", a
// real but DIFFERENT officer, purely because both surfaces share the token
// "pierre". Exactly the disclosed risk named above, not hypothetical.
// Neither of the two fixes this project has already earned elsewhere
// applies unchanged: MIN_STEM/token-coverage (cast.js's own `resolve()`)
// is satisfied trivially by a single matching token, and a bare token-count
// floor would ALSO refuse Napoleon/Kutuzov (both single-token surnames) —
// the actual defect is that "pierre" is a common GIVEN name and "napoleon"/
// "kutuzov" are not, a distinction token count cannot see.
// `surfaces.js::genericTokens` already measures exactly this, unrelated to
// this file's own question — a token exceeding an IQR-derived fence of how
// many DIFFERENT other tokens it co-occurs with across multi-word surfaces
// (`discoverReferents`'s own internal guard: "so two Princesses never
// merge"). Reused rather than a second stoplist invented: a correspondence
// now requires `namesCorefer` to hold AND at least one shared token that is
// NOT generic over the pooled represented surfaces of every source
// examined. Disclosed rather than assumed complete: the fence is computed
// over the SAME two-source pool this call was given, which the organ's own
// header names as a real, if lesser, dilution risk versus deriving it per
// group — untried here, named as the natural next refinement rather than
// silently assumed away.

export const REALITY_KINDS = Object.freeze({
  REAL: "real",
  FICTIONALIZED_REAL: "fictionalized-real",
  FICTIONAL: "fictional",
  UNEXAMINED: "unexamined",
});

export const REALITY_KIND_REFUSALS = Object.freeze({
  NO_GENRE: "no_genre_declared",
  UNKNOWN_GENRE: "unknown_genre",
});

const GENRES = new Set(["fiction", "nonfiction"]);

/**
 * eventsByReferent(index) — every surface a referent index actually
 * established, grouped by referent id — never only the longest
 * ("represented") surface, because a correspondence check must be able to
 * match on ANY name the source used ("Napoleon" as well as "Bonaparte"),
 * not only the one cast.js chose to print.
 */
function eventsByReferent(index) {
  const byId = new Map();
  for (const e of index?.events ?? []) {
    if (!byId.has(e.referent_id)) byId.set(e.referent_id, []);
    byId.get(e.referent_id).push(e.surface);
  }
  return byId;
}

/**
 * crossSourceCorrespondences({ sources, genreOf, namesCorefer }) — every
 * NAME-LEVEL correspondence between a fiction-declared source's referent
 * and a nonfiction-declared source's referent. `sources` is
 * `[{ id, index }]`, `index` a cast.js `makeReferentIndex(...)` result for
 * that source's own passages. `genreOf(sourceId)` is the caller's own
 * declaration — "fiction" | "nonfiction" | null/anything else refused.
 *
 * Only fiction<->nonfiction pairs are compared (two nonfiction sources
 * agreeing on a referent is ordinary corroboration, not this question; two
 * fiction sources sharing a name says nothing about reality-status either).
 * A referent pair correspond when ANY surface of one `namesCorefer` ANY
 * surface of the other — OR-matched, same reasoning P31's number-grounding
 * company check already states: widening a match can only make it more
 * permissive, never fabricate a correspondence neither side's bytes support.
 *
 * Returns `{ correspondences, refused }` — `refused` lists every source
 * whose genre could not be resolved, named rather than silently skipped
 * (a caller with an undeclared source should not read a clean empty result
 * as "checked and found nothing").
 */
export function crossSourceCorrespondences({ sources, genreOf, namesCorefer, diaNorm, genericTokens }) {
  const refused = [];
  const byGenre = { fiction: [], nonfiction: [] };
  for (const s of sources ?? []) {
    const genre = genreOf ? genreOf(s.id) : null;
    if (!GENRES.has(genre)) { refused.push({ source: s.id, reason: !genre ? REALITY_KIND_REFUSALS.NO_GENRE : REALITY_KIND_REFUSALS.UNKNOWN_GENRE, detail: genre ?? null }); continue; }
    byGenre[genre].push({ id: s.id, surfaces: eventsByReferent(s.index) });
  }

  // THE GENERIC-TOKEN GUARD (found by running this on real material, see
  // the module header). `genericTokens` wants `{surface}` rows; every
  // referent's own REPRESENTED (most-individuated) surface, pooled across
  // every source this call examined, is this file's own candidate list —
  // a token exceeding the fence there is too common a given name/title to
  // license a cross-document identity claim on its own.
  const declaredGenre = diaNorm && genericTokens;
  const pooledRepresented = declaredGenre
    ? [...byGenre.fiction, ...byGenre.nonfiction].flatMap((s) => [...s.surfaces.keys()].map((id) => ({ surface: sourceById(sources, s.id).index.represent(id) ?? "" })))
    : [];
  const generic = declaredGenre ? genericTokens(pooledRepresented, {}) : new Set();
  const tokensOf = (s) => (diaNorm ? diaNorm(s) : s.toLowerCase()).split(/\s+/).filter((t) => t.length > 2);
  const sharesNonGenericToken = (a, b) => {
    if (!declaredGenre) return true; // organ not supplied — this guard is opt-in, byte-identical without it
    const tb = new Set(tokensOf(b));
    return tokensOf(a).some((t) => tb.has(t) && !generic.has(t));
  };

  const correspondences = [];
  for (const fic of byGenre.fiction) {
    for (const [ficRefId, ficSurfaces] of fic.surfaces) {
      for (const nonfic of byGenre.nonfiction) {
        for (const [nonficRefId, nonficSurfaces] of nonfic.surfaces) {
          let matched = null;
          outer: for (const fs of ficSurfaces) {
            for (const ns of nonficSurfaces) {
              if (namesCorefer(fs, ns) && sharesNonGenericToken(fs, ns)) { matched = { ficSurface: fs, nonficSurface: ns }; break outer; }
            }
          }
          if (matched) {
            correspondences.push({
              ficSource: fic.id, ficReferentId: ficRefId,
              nonficSource: nonfic.id, nonficReferentId: nonficRefId,
              checkedBy: declaredGenre ? "namesCorefer + non-generic shared token" : "namesCorefer(cross-source names)",
              ...matched,
            });
          }
        }
      }
    }
  }
  return { correspondences, refused };
}

function sourceById(sources, id) { return (sources ?? []).find((s) => s.id === id); }

/**
 * classifyReferents({ sources, genreOf, namesCorefer }) — the whole
 * declared taxonomy, one row per (source, referent) pair examined. A
 * nonfiction referent is REAL by declaration of the source it was
 * established in (this file trusts the caller's own genre declaration for
 * the nonfiction side exactly as far as that declaration itself is
 * trusted — it is not re-verified here, and nothing claims it is). A
 * fiction referent with a correspondence is FICTIONALIZED_REAL; without
 * one it is FICTIONAL, `checkedAgainst` naming every nonfiction source
 * actually compared so the claim never reads wider than what ran.
 */
export function classifyReferents({ sources, genreOf, namesCorefer, diaNorm, genericTokens }) {
  const { correspondences, refused } = crossSourceCorrespondences({ sources, genreOf, namesCorefer, diaNorm, genericTokens });
  const nonficIds = new Set((sources ?? []).filter((s) => genreOf(s.id) === "nonfiction").map((s) => s.id));
  const rows = [];
  for (const s of sources ?? []) {
    const genre = genreOf ? genreOf(s.id) : null;
    if (!GENRES.has(genre)) continue; // already named in `refused`
    for (const [refId, surfaces] of eventsByReferent(s.index)) {
      const surface = s.index.represent(refId) ?? surfaces[0] ?? null;
      if (genre === "nonfiction") {
        rows.push({ source: s.id, referentId: refId, surface, kind: REALITY_KINDS.REAL });
        continue;
      }
      const own = correspondences.filter((c) => c.ficSource === s.id && c.ficReferentId === refId);
      if (own.length) {
        rows.push({ source: s.id, referentId: refId, surface, kind: REALITY_KINDS.FICTIONALIZED_REAL, correspondsTo: own.map((c) => ({ source: c.nonficSource, surface: c.nonficSurface })) });
      } else {
        rows.push({ source: s.id, referentId: refId, surface, kind: REALITY_KINDS.FICTIONAL, checkedAgainst: [...nonficIds] });
      }
    }
  }
  return { rows, correspondences, refused };
}
