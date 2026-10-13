/* Zhengming — GENERATED EPIGRAPH AND COMMENTARY, NOT THE AUTHOR'S WORDS except text inside quotation marks, and only where the archon's dossier (the-fold docs/archons/dossier) verifies that quote:
 * “If  names  be  not  correct,  language  is  not  in 
accordance  with  the  truth  of  things.     If  language  be 
not  in  accordance  with  the  truth  of  things,   affairs 
cannot  be  carried  on  to  success.”
 *
 * This file implements the essential principle of a name's referential connection, aligning with the Confucian ideal of truth and accurate representation.  However, the file's implementation of this principle may be overly rigid, and its application could potentially lead to a reduction in the breadth and depth of the discourse.
 *
 * — the engineering record below, kept whole —
 */
// cast.js — names resolve to referents, not to strings.
// Handle: Zhengming — after Confucius's rectification of names: a name answers to its referent, not to its string. Amendment XVII.
//
// Measured motivation, in order: the grounding check flagged "Pierre
// Bezukhov" as not-in-the-material against the very chapters that name him,
// because containment compared byte sequences. A diacritic fold fixed that
// instance and missed the class — no string rule makes "Pierre" support
// "Bezukhov". What makes any of these equivalent is that they point to the
// same REFERENT, and referent discovery is an organ the engine already has:
// surfaces.js's extractSurfaces (candidate names by the text's own
// capitalisation physics) and discoverReferents (name-variant coreference at
// engine tier — containment and shared final token, generic tokens stripped
// so two Princesses never merge). Descriptor synonymy and pronoun binding
// stay model-tier gaps there, and therefore stay unsupported here — this
// resolver rescues exactly what the engine can derive, nothing further.
//
// Pure, organs injected: the engine's functions arrive as arguments, because
// this module is imported by both the page (which loads them from /engine)
// and the node tests (which load them by relative path). The organs are
// used, never copied — the fold discipline (diaNorm's disclosed-narrow
// scope) rides in with them.
//
// THE FURNITURE WALL, closed 2026-09-04 (rashomon-contrast-RESULTS.md's own
// named next step: "the cast's own universe has no such wall"). Measured on
// the real fetched Battle of Borodino page: a six-line succession-box
// passage ("Preceded by / Battle of Mesoten / Napoleonic Wars / Battle of
// Borodino / Succeeded by / French occupation of Moscow") and a bottom-page
// navbox both fed `extractSurfaces`/`discoverReferents` their own link text,
// which then MERGED with real people — Barclay de Tolly and Pyotr Bagration
// fused into one referent carrying the infobox abbreviation "DOW". This was
// never a gap in `blankLabelRows` itself: `source.js::chunkSource`'s own
// `blankFurniture` option already computes a page-aware `chunk.blanked`
// field for exactly this (P82) — verified live, that field is furniture-free
// where this file's own `.text` read was not.
//
// THE GATE, and why it is not a bare `p.blanked ?? p.text`. `hypergraph.js`
// already enforces, and tests (`source-page-blanking.test.mjs`, "a reader
// that never asked for blanking does not get it from the chunker"), the
// rule this file must not quietly break: A CALLER'S OWN INJECTED ORGAN IS
// AUTHORITATIVE, never a side channel it has no relationship with. A first
// cut here read `.blanked` unconditionally whenever a chunk happened to
// carry one — which broke exactly that test, because `hypergraph.js`
// builds its OWN internal referent index by calling
// `makeReferentIndex(organs)` with its whole `organs` bundle, so a reader
// that was NOT given `blankFurniture` (by design, in that test) was
// suddenly seeing page-scoped blanking anyway, through this file's own
// referent resolution rather than through the sentence-text path the test
// was actually checking. Fixed the same way `readSentenceText` already
// gates it: `.blanked` is consulted only when THIS caller's own
// `blankFurniture` (any truthy value — the function is never invoked here,
// only checked, since the blanking itself already happened at `chunkSource`
// time) says so. Omit it entirely and behaviour is byte-identical to
// before this fix, for both a chunk with no `.blanked` field and one that
// has it. `hypergraph.js` needed no change at all: its own `organs` bundle
// already carries `blankFurniture`, and `makeReferentIndex(organs)` was
// already passing the whole bundle through.
//
// Measured effect on the real fixture, WITH `blankFurniture` opted in: the
// two fused garbage referents disappear entirely; Barclay de Tolly's
// surname reappears as its own real (if still partial) referent rather
// than fused into Bagration's. See cast.test.mjs for both the opted-in and
// opted-out cases, pinned against the real fixture and against a synthetic
// leak-check mirroring `source-page-blanking.test.mjs`'s own.
//
// STILL OPEN, disclosed rather than implied closed: opting in is still each
// caller's own act. `app.js`'s three cast.js call sites and this repo's
// `rashomon-contrast.mjs` now pass `blankFurniture`; other eval drivers
// that build a cast from `chunkSource`'d passages without it are unchanged
// and still see raw text here, named rather than swept in silently.

/**
 * Build a per-passage-set name resolver from the engine's own organs.
 *
 * `makeCastResolver(organs)` → `castFor(passages)` → `resolveName(name)`.
 *
 * The cast is discovered from THE PASSAGES' OWN TEXT at check time — not
 * from the whole source — so "supported by the material" keeps meaning the
 * material this turn was actually handed. minSentences is 0 by declaration:
 * this asks presence ("did these passages establish this name"), not cast
 * membership ("is this a recurring being"), and a name mentioned once is
 * present once.
 */
/**
 * The cast as HANDLES — one representative surface per referent, for a
 * decoding grammar to enumerate. The most-individuated surface represents
 * (most glyphs: "Pierre Bezúkhov" over "Pierre"), because the handle is what
 * the bound answer will print and the fullest established form points at
 * its referent least ambiguously. Same organs, same discovery as the
 * resolver; the two cannot drift.
 */
// A token long enough to individuate a name: three letters in an alphabet, two
// characters in a script whose characters are morphemes (Han/Kana/Hangul).
const individuatesName = (t) => t.length > (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t) ? 1 : 2);

export function makeCastHandles({ splitSentences, extractSurfaces, discoverReferents, blankFurniture = null }) {
  return function handlesFor(passages) {
    const text = (passages ?? []).map((p) => (blankFurniture ? (p?.blanked ?? p?.text ?? "") : (p?.text ?? ""))).join("\n\n");
    if (!text.trim()) return [];
    let events;
    try {
      const sentences = splitSentences(text);
      const surfaces = extractSurfaces(sentences, {});
      events = discoverReferents(surfaces, { minSentences: 0 }).events;
    } catch {
      return [];
    }
    const best = new Map(); // referent_id -> longest surface
    for (const e of events) {
      const prev = best.get(e.referent_id);
      if (!prev || e.surface.length > prev.length) best.set(e.referent_id, e.surface);
    }
    return [...best.values()].sort();
  };
}

/**
 * The referent index: the same discovery as the resolver below, exposed as
 * IDENTITIES rather than a boolean. `makeReferentIndex(organs)` →
 * `indexFor(passages)` → `{ events, referents, resolve, represent }`, where
 * `resolve(name)` answers WHICH referents a name points at (a Set of
 * referent ids, empty when none) and `represent(id)` is the referent's
 * most-individuated established surface. The relation tier (hypergraph.js)
 * needs identities, not booleans: an edge's endpoints must key on WHO,
 * so that "Bezukhov" and "Pierre Bezúkhov" land on the same node. One
 * implementation of "the same name" — the resolver is a projection of this
 * index, so support and identity cannot drift apart.
 */
export function makeReferentIndex({ splitSentences, extractSurfaces, discoverReferents, namesCorefer, diaNorm, blankFurniture = null, leadingSurfaces = null, nameFold = null, nameVariant = null, commonNoun = null }) {
  return function indexFor(passages) {
    const text = (passages ?? []).map((p) => (blankFurniture ? (p?.blanked ?? p?.text ?? "") : (p?.text ?? ""))).join("\n\n");
    const empty = { events: [], referents: new Set(), resolve: () => new Set(), represent: () => null };
    if (!text.trim()) return empty;
    let events;
    try {
      const sentences = splitSentences(text);
      let surfaces = extractSurfaces(sentences, {});
      // SENTENCE-INITIAL CAPITALISATION IS A CONVENTION OF THE SCRIPT, NOT A
      // HARD VETO AND NOT SOLE EVIDENCE (user direction, 2026-09-15): English
      // capitalises the token that opens a sentence whether it is a name or
      // not, so a name that ONLY ever appears sentence-initially (Napoleon in
      // "Napoleon invaded Russia...") is invisible to extractSurfaces, which
      // starts its run scan at token 1 precisely so a sentence-opener carries
      // no namehood evidence on its own. That veto is right for a single
      // occurrence and wrong for the whole cast: the convention IS real
      // information — a sentence-initial capital in English is a candidate
      // name — it is just not CONSISTENT. So the engine's own mirror organ
      // `extractLeadingSurfaces` hands those candidates over, and the SAME
      // physics filter that guards extractSurfaces (a name essentially never
      // appears lowercased, while a sentence-opener "Well"/"Why" constantly
      // does) confirms or refuses them here — never trusted on the capital
      // alone, never thrown away on the position alone. Opt-in: a caller
      // that does not inject `leadingSurfaces` is byte-identical to before.
      if (typeof leadingSurfaces === "function") {
        const lower = new Set();
        for (const tok of text.split(/\s+/)) {
          const t = tok.replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N}]+$/gu, "");
          if (t && /\p{Ll}/u.test(t) && !/\p{Lu}/u.test(t)) lower.add(diaNorm(t.toLowerCase()));
        }
        const admitted = [];
        for (const l of leadingSurfaces(sentences, {}) ?? []) {
          const toks = diaNorm(l.surface).split(/\s+/).filter(individuatesName);
          if (!toks.length) continue;
          // multi-word runs skip the physics filter exactly as surfacesFromEvidence
          // does (a lowercase form of "Thomas Edison" does not occur); a single
          // word is refused when it ALSO appears lowercased — the sentence-opener
          // tell the main scan guards against ("Some"/"Trust" appear lowercase
          // somewhere in real prose; a name like "Napoleon" does not).
          if (toks.length === 1 && lower.has(toks[0].toLowerCase())) continue;
          admitted.push({ surface: l.surface, mentions: l.sentences ?? 1, sentences: l.sentences ?? 1 });
        }
        surfaces = [...surfaces, ...admitted];
      }
      // P251(b): forward the same commonNoun organ resolve() below already
      // receives (via the caller's own namesCorefer wrapper) into discovery
      // itself, so a generic single-token surface is refused from
      // clustering into a compound referent at the source, not only when
      // later queried. Omitted, byte-identical to before this parameter
      // existed.
      events = discoverReferents(surfaces, { minSentences: 0, commonNoun }).events;
    } catch {
      // An organ refusing (script it doesn't apply to, empty material) means
      // no cast — the index is empty and the byte check stands alone.
      return empty;
    }
    if (!events.length) return empty;

    const best = new Map(); // referent_id -> longest established surface
    for (const e of events) {
      const prev = best.get(e.referent_id);
      if (!prev || e.surface.length > prev.length) best.set(e.referent_id, e.surface);
    }

    // Prefix tolerance exists for stems and inflections, and four
    // characters is the shortest thing that can be a stem rather than a
    // coincidence — the same MIN_STEM grounding.js earned. Without the
    // floor, a bare initial covered a whole surname: material writing
    // only "Pierre B." supported "Pierre Bezukhov", crediting the model
    // with a surname the material never wrote. Found by asking the gate
    // the abbreviation question directly (II.10: a check is verified
    // against what it must reject).
    const MIN_STEM = 4;
    const covers = (s, p) =>
      s === p ||
      (Math.min(s.length, p.length) >= MIN_STEM && (s.startsWith(p) || p.startsWith(s)));
    // The fold applied before any comparison in resolve(): case, NFKC,
    // leetspeak/confusables (surfaces.js::referentForm) when the caller
    // injects it, else diaNorm alone — byte-identical to before this
    // parameter existed for a caller that never supplies it (P41/P42's own
    // posture, applied here: widening what the reader recognises as one
    // spelling, never removing a distinction it already drew).
    const fold = nameFold ?? diaNorm;

    function resolve(name) {
      // Two tests, both required, because they answer different questions.
      // namesCorefer — the engine's own sameness test, so what counts as
      // "the same name" cannot drift between discovery and support. But
      // coreference is SYMMETRIC (built for merging a cast) and support is
      // not: material that says only "Pierre" must not support an answer
      // that extends him to "Pierre Bezukhov" — the surname would be model-
      // supplied content wearing a resolved name's clothes. So the second
      // test is coverage: every individuating token of the claimed name
      // must appear in the established surface. Sub-forms of an established
      // name resolve; extensions of it do not.
      //
      // Honestly noted: at engine tier this rescue largely coincides with
      // folded byte containment — the genuinely disjoint alias ("Peter
      // Kirílovich" for Pierre) is model-tier, typed as a gap by the engine
      // itself, and closes only when a received prior with a named giver
      // supplies it. This resolver is the seam where that prior will plug
      // in; it does not pretend to be the prior.
      const ids = new Set();
      const parts = fold(name).split(/\s+/).filter(individuatesName);
      if (!parts.length) return ids;
      for (const e of events) {
        if (!namesCorefer(name, e.surface, { fold })) continue;
        const surfaceTokens = fold(e.surface).split(/\s+/);
        if (parts.every((p) => surfaceTokens.some((s) => covers(s, p)))) ids.add(e.referent_id);
      }
      if (ids.size || !nameVariant) return ids;
      // NEAR-MISS SPELLING, LAST RESORT ONLY (surfaces.js::isNearMissSpelling's
      // own header has the full safety argument). Reached only when every
      // exact/prefix-folded match above found nothing at all — never a
      // widening of an already-successful resolution. A candidate qualifies
      // only if EVERY one of its own tokens is a near-miss of some token the
      // referent's surface establishes; and the whole fallback is REFUSED
      // — not resolved to a guess — the instant it would merge the
      // candidate with more than one DISTINCT referent, since that is
      // exactly the shape of a document that has independently established
      // two real, different people whose names happen to sit one edit
      // apart (measured live: "Reed"/"Reid", "Allen"/"Allan" are each
      // edit-distance-1 and exact homophones).
      const variantIds = new Set();
      for (const e of events) {
        const surfaceTokens = fold(e.surface).split(/\s+/);
        if (parts.every((p) => surfaceTokens.some((s) => nameVariant(s, p)))) variantIds.add(e.referent_id);
        if (variantIds.size > 1) return ids; // ambiguous — refused, never guessed
      }
      return variantIds.size === 1 ? variantIds : ids;
    }

    // resolveIn(text) — every token run of a text resolved the same way
    // resolve() resolves one name: caseless (the fold lowercases — a
    // Hebrew question and an English one go through the same line),
    // longest-run-first with maximal munch, so "Rodya Pyotr Petrovitch"
    // is «Rodya» + «Pyotr Petrovitch», never also «Petrovitch». The
    // same face reading-log.js's readingIndexFromLog carries; added here
    // so callers stop reimplementing it as a capital-only scan (the
    // [A-Z]-regex resolveIn that returned nothing on lowercase prose).
    // Capitals keep working through it (the fold is case-insensitive);
    // lowercase gains the same path. New method only — resolve/represent
    // are untouched.
    const longestRun = (() => {
      let n = 1;
      for (const e of events) {
        const k = fold(e.surface).split(/\s+/).filter(Boolean).length;
        if (k > n) n = k;
      }
      return n;
    })();
    function resolveIn(text, { refuse = null } = {}) {
      const toks = fold(String(text ?? "")).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const out = new Set();
      for (let i = 0; i < toks.length; i++) {
        for (let j = Math.min(toks.length, i + longestRun); j > i; j--) {
          const run = toks.slice(i, j).join(" ");
          // A caller-refused run (a stopword-only span — "what", "it is")
          // is never offered for resolution, but shorter runs inside it
          // still are ("what Cumberland" still reaches "Cumberland").
          if (typeof refuse === "function" && refuse(run)) continue;
          const hit = resolve(run);
          if (hit.size) { for (const id of hit) out.add(id); i = j - 1; break; }
        }
      }
      return out;
    }

    return { events, referents: new Set(best.keys()), resolve, resolveIn, represent: (id) => best.get(id) ?? null };
  };
}

export function makeCastResolver(organs) {
  const indexFor = makeReferentIndex(organs);
  return function castFor(passages) {
    const index = indexFor(passages);
    if (!index.events.length) return () => false;
    // The resolver is the index's boolean face: a name is supported exactly
    // when it resolves to at least one referent. One implementation, two
    // projections — support and identity cannot drift.
    return function resolveName(name) {
      return index.resolve(name).size > 0;
    };
  };
}
