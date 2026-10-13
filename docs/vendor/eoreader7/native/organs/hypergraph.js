// hypergraph.js — relation-level grounding: the answer read against the
// edges the material itself binds. P12's named future work, wired.
//
// The tier below this (grounding.js) asks whether the answer's TOKENS are in
// the bytes. This tier asks whether the answer's RELATIONS are: "Pierre
// married Dolokhov" passes every byte check — Pierre is in the material,
// married is in the material, Dolokhov is in the material — and is still an
// invention, because the text never bound that edge. Only a reading of the
// material's own relation structure can catch it, and only a reading of the
// answer WITH THE SAME ORGANS can be compared against it honestly.
//
// Everything measured here is the engine's: relation vocabulary is
// discovered, never typed in (perceiver/text/relations.js — the 90-word
// hand list was that file's own measured mistake); triples are extracted
// with polarity read, never asserted; endpoints resolve to REFERENTS
// through the same index cast.js's resolver projects (one implementation of
// "the same name", P11). This module composes those organs and types the
// verdicts; it measures nothing of its own.
//
// THE VERDICTS ARE FOUR-PLUS-ONE, NEVER A BIT. The field converged on this
// the hard way (FEVER's supported/refuted/not-enough-info; SAFE's
// supported/irrelevant/unsupported; AIS's "uninterpretable" refusal — see
// the prior-art survey in the PR that introduced this file): support,
// contradiction, absence of evidence, and beyond-the-instrument's-reach are
// FOUR DIFFERENT FACTS, and collapsing any two of them lies in one
// direction or the other.
//
//   bound        — the material binds this edge, same polarity. Carries the
//                  addresses that state it, and its corroboration: how many
//                  passages, across how many distinct sources. Support is
//                  graded by independent perspectives, never a boolean.
//   contradicted — the material binds this edge with the OPPOSITE polarity
//                  ("never married" against "married"). The most valuable
//                  finding this tier produces, and invisible to every byte
//                  check by construction.
//   unbound      — subject resolves, verb is in the material's own measured
//                  vocabulary, and no edge binds them: the "Pierre married
//                  Dolokhov" case. Carries the NEAREST edges the material
//                  does bind (same subject and verb, or same verb and
//                  object) so the reader sees what the text says instead —
//                  the affordance that turns a flag into an explanation.
//                  Sometimes carries `competing` too (added 2026-08-19,
//                  P32's named follow-up): when the material binds this
//                  EXACT verb+object to one and only one OTHER subject —
//                  "the Pirates won the 1960 World Series" against a claim
//                  the Yankees did — that is stronger evidence than an
//                  ordinary neighbour, gated on the object resolving to a
//                  referent and on every edge sharing the slot pointing to
//                  the SAME subject (a slot the material shows filled by
//                  two+ different subjects proves nothing and stays plain
//                  unbound). This is the mechanical half of what testimony.js's
//                  witness tier covers semantically for everything a
//                  subject-swap cannot reach structurally — see P32.
//   beyond-reach — an endpoint does not resolve to any referent this
//                  material establishes (a pronoun subject, an abstract
//                  object). This tier cannot read the claim, and says so —
//                  disclosed as unreadable, never implied false.
//   unheard      — the claim's verb is outside the vocabulary the material
//                  itself measures. Same posture: the instrument's reach
//                  ends here, and the omission stays visible (the CLAUDE.md
//                  rule about lens-less terrains, applied to verbs).
//
// Pure, organs injected (the cast.js pattern): the engine's functions
// arrive as arguments because this module is imported by both the page
// (which loads them from /engine) and the node tests (which load them by
// relative path). The organs are used, never copied.
//
// AMENDED 2026-08-18 — recurring forms as a second, weaker identity for
// endpoint resolution. `beyond-reach`'s own justification above ("a
// pronoun subject, an abstract object") describes only PART of what was
// driving that verdict: measured against MINE-1 (an external benchmark of
// 105 short informational essays, goldens/EXTERNAL-BENCHMARKS.md),
// beyond-reach was firing on ordinary, non-abstract, non-pronoun common
// nouns — "butterflies", "caterpillars" — subjects a concept-scale
// document states real relations about, that simply never get named the
// way cast.js's referent index requires (a proper name, or a pronoun
// resolved through its own floor). host/terrains.js's Network-graph organ
// had already solved exactly this starvation, for the graph surface, not
// this one: recurring-form co-arrival binding, built because "concept
// documents starve the cast ladder" (measured there on SEED-SPEAKER.md).
// `endpoint()` now grants a subject or object the SAME identity — a
// content word recurring at least FORM_MIN_ARRIVALS sentences in the
// material — namespaced `form:<word>` so it can never be mistaken for a
// cast referent, and every claim built on one is marked `formBased` so a
// reader can tell a form-anchored "bound" from a name-anchored one. This
// widens what the tier can READ; it fabricates nothing — the SAME edges
// extractRelations already found in the material, now checkable because
// their subject can finally resolve. Measured effect, not assumed: see
// the-fold/eval/mine-1-forms-RESULTS.md.
//
// AMENDED 2026-08-19 — lemma-aware verb matching, and a dead end it
// replaced. "Check against other systems" (this tier's graph, scored
// under KGGen's own MINE-1 rubric, beat every reported baseline —
// the-fold/eval/results/mine-1-official-methodology-RESULTS.md) prompted
// "wire this in." The first attempt widened `bound` itself with a sixth
// verdict, `inferred`, covering a claim from a NEIGHBORHOOD of connected
// edges rather than one. Built, then found ADVERSARIALLY (not by luck —
// by asking what the obvious next attack was) to fabricate on two real
// cases: "Pierre married Dolokhov" passed because Pierre and Dolokhov are
// connected by real, unrelated edges and a one-token object costs nothing
// to cover; tightened to require the claimed verb nearby too, "Pierre
// painted delicate watercolors" STILL passed — reproduced live — because
// hopping through the unrelated "Pierre admired Natasha" edge let
// Natasha's own action get attributed to Pierre. The only fix that closed
// both was dropping graph traversal entirely and pooling only a subject's
// OWN other statements — which is provably, then empirically (0/1,575
// fires on MINE-1), dead code: `bound`'s own object match (`tokensShare`)
// already accepts ANY single shared token with ONE edge, a strictly
// weaker bar than "every token covered by a union of edges" over the
// SAME primitive, so nothing safe built from that primitive can ever
// clear a bar `bound` hasn't already cleared first. The real lesson: the
// 80% score's power came from two things this tier's own law (P1, local
// only; P4/P20, a model is never trusted to decide a fact is supported)
// correctly refuses to mechanize — real semantic embeddings and a real
// judge's relational reasoning. Widening graph REACH without either adds
// nothing safe can't already reach.
//
// What DOES add real, safe value: a DIFFERENT matching primitive, not a
// repackaging of the one `bound` already saturates. Every verb comparison
// in this file compared verbs by exact string equality — so a claim
// phrased "underwent metamorphosis" against material stating "undergoes
// metamorphosis," the identical predicate in a different tense, read as
// two different verbs and lost the claim, sometimes silently (a
// tense-shifted verb never literally in the vocabulary Set never even
// gets extracted from the answer to judge). `organs.createLemmatizer` /
// `organs.morphologyIndex` (perceiver/text/morphology.js, UniMorph-backed,
// irregular-inflection-aware, found this session by searching before
// writing anything new) widen verb equality to `sameAct` — the SAME lemma,
// never a fuzzy match: checked live that an unrelated verb sharing no
// lemma with the material stays refused. Optional and backward compatible
// exactly like `verbForms` above (omitted, `sameAct` degrades to exact
// match). Measured: bound 531 -> 536, unheard 48 -> 42, zero contradictions
// either way. Small, because MINE-1's own facts are close paraphrases of
// their source — real on every axis regardless. Whether the LIVE APP
// should load either prior by default remains the same open question
// this repo's CLAUDE.md already names for `verbForms` — not resolved
// here either.
//
// AMENDED SAME NIGHT — objects, and the language this whole mechanism was
// quarantined to. "Try it" (extending referent/form identity to OBJECTS,
// not just subjects — `useForms` had stayed subject-only by explicit
// prior design, with a disclosed but never-reproduced regression risk)
// reproduced the risk for real: "underwent transformations" read unbound
// against material stating "underwent a remarkable transformation,"
// because singular and plural independently became DISTINCT exact-token
// form ids. `formIdOf` fixes it by reusing the SAME `sameAct` organ —
// grouping a token with every other recurring form that is the same act
// as it, nouns exactly like verbs — and object identity is enabled ONLY
// when `createLemmatizer` is provided (`Boolean(createLemmatizer)` at
// both object call sites, never unconditionally), so the original
// regression cannot recur: without a lemmatizer, nothing changed. Then,
// asked directly whether any of this generalizes past English ("it needs
// to work for Ancient Greek, or we have high-level priors steering for
// different grammars"): checked, not assumed, and morphology.js's own
// regular-suffix RULE (unlike its properly-quarantined DATA layer) ran
// unconditionally regardless of what a loaded prior declared — fixed
// there (its own 2026-08-19 amendment), with `organs.morphologyLanguage`
// threading a prior's own declared language through automatically.
// Combined, measured, all at zero contradictions: bound 531 -> 557,
// beyond-reach 267 -> 236, headline 33.7% -> 35.4%. Full account:
// the-fold/eval/results/mine-1-lemma-RESULTS.md.

import { makeReferentIndex } from "./cast.js";
import { blankStructure, numberSet } from "./grounding.js";
import { commonTerms, CORPUS_MINIMUM } from "./cite.js";
import { foldDiacritics } from "./source.js";
import { orderArm, standingOf } from "./asserted.js";
import { GRAMMAR_MIN_SHARE, grammarIsDominant } from "../adapters/text/grain-typing.js";
export { GRAMMAR_MIN_SHARE };

// ── declared numbers, each with its justification ───────────────────────────
//
// MIN_SURFACES_PER_VERB = 1. discoverRelationVocab refuses to default this —
// how much recurrence makes a pattern is the caller's to say — so it is said
// here, and justified WITHOUT reference to any golden or fixture (the
// the legacy engine rule about calibrating against the answer key): a turn's offered
// passages are an excerpt of a few paragraphs, far too small for
// cross-surface recurrence to be a fair gate on a verb; and the vocabulary
// only widens what this check can HEAR — extractRelations emits no triple
// without a literal match, so a wider vocabulary can never fabricate an
// edge, only read more of the ones the text states. corpus.js makes the
// same declaration at span scale (minSurfaces: 1) for the same reason.
export const MIN_SURFACES_PER_VERB = 1;

// GRAMMAR_MIN_SHARE = 0.5. dominantClass's own declared-never-defaulted
// contract (perceiver/text/wordclass.js) requires a caller to say how
// dominant a class must be to collapse; 0.5 is not tuned against any
// reading here — it is the SAME number packages/host/hyperlexicon.js
// already uses (WORDCLASS_MIN_SHARE) for the identical question, with the
// identical justification carried over: a literal majority is the
// smallest bar that means "more than everything else combined" rather
// than a curve fit to any one word or golden.


// Display bound on the nearest-edge disclosure, not on belief: every edge
// stays in the report's own graph; only the per-claim nearest list is
// capped, and the cap is stated where it applies.
export const NEAREST_EDGES_MAX = 3;

// FORM_MIN_ARRIVALS = 2 — a recurring-content-word identity for a subject
// or object that cast.js's referent index never establishes (no proper
// name: "butterflies", "the caterpillar", a concept document's own real
// vocabulary — SEED-SPEAKER.md, measured in host/terrains.js: cast ladder
// of four sentence-initial capitals at one arrival each, vs. 21 form nodes
// once recurring content words are counted). Not tuned for this repo's own
// evaluation runs — reused whole from host/terrains.js's own FORM_BINDING
// organ, which already states the justification for this exact floor:
// "binding's structural minimum, not a tuned floor: one arrival has no
// co-arrival to test." One occurrence carries no recurrence signal to
// trust as an identity either, for the identical reason. Distinguished
// from a cast referent everywhere a claim is reported (P11 — "the same
// name" is never the same claim as "the same recurring word") — a form
// id is namespaced `form:<word>` so it can never collide with a real
// referent id and a bound claim built on one alone stays disclosable.
export const FORM_MIN_ARRIVALS = 2;

// The same stem floor grounding.js and cast.js earned: four characters is
// the shortest thing that can be a stem rather than a coincidence.
const MIN_STEM = 4;

const sourceOf = (ref) => String(ref ?? "").split("#")[0] || null;

/**
 * `makeRelationReader(organs)` → `relationsFor(passages)` → a reader:
 *
 *   { examined, vocabulary, edges, read(answer) }
 *
 * `edges` is the material's own belief graph over these passages — every
 * edge keyed by referent identity where the index resolves one, carrying
 * every address that states it. `read(answer)` extracts the answer's
 * relation claims with the SAME vocabulary and organs and returns one typed
 * verdict per claim (shape above). Organs required: splitSentences,
 * extractSurfaces, discoverReferents, namesCorefer, diaNorm (the cast
 * organs), plus discoverRelationVocab, extractRelations, tokenize (the
 * relation organs). `relationsFor(passages, { pool })` — the pool is the
 * live corpus the closed-class measure runs over; omitted, the passages
 * stand in and the measure usually refuses itself (CORPUS_MINIMUM).
 *
 * EVERY claim `read()` returns also carries `endpoints`
 * (`{subject, object}`, each `"referent"` / `"form"` / `"tokens"` /
 * `"none"`): HOW each end actually resolved, so no downstream reader has
 * to infer an upstream finding from the shape of a refusal. `beyond-reach`
 * gates on the SUBJECT, so its ABSENCE says nothing at all about the
 * object — see `judge()`'s own comment for the measured specimen this
 * closes (POLICIES.md P41).
 *
 * `organs.determiners` — OPTIONAL, a received closed class (the engine's
 * own priors register: DEFINITE_DETERMINERS + INDEFINITE_DETERMINERS,
 * giver "lang/en"), excluded from an endpoint's comparable tokens. Exists
 * because `commonTerms`'s declared CORPUS_MINIMUM floor leaves the
 * function-word filter off entirely on small material, where a shared
 * definite article alone is enough for `tokensShare` to bind an object the
 * material never states. Omitted: byte-identical to every prior caller.
 *
 * `organs.definiteDeterminers` — OPTIONAL, a received closed class (priors.js's
 * own DEFINITE_DETERMINERS alone, giver "lang/en" — NEVER unioned with
 * INDEFINITE_DETERMINERS). Consumed only by `queryReferents`'s `foldLabel`,
 * below, to fold a bare/no-article-vs-"the" phrasing gap out of a verb
 * comparison. Kept separate from `organs.determiners` on purpose: folding
 * "a" together with "the" was tried first, sharing the combined set, and
 * adversarial falsification found it wrongly clusters "became A vice
 * president" (one of several) with "became THE vice president" (the sole
 * holder) as one slot — English's indefinite/definite distinction is often
 * the only marker of uniqueness, so it is a real, separate hazard class
 * from a bare/definite phrasing accident. Omitted: `foldLabel` degrades to
 * a case/whitespace-only fold, byte-identical to every prior caller.
 *
 * `organs.posPriorFor` — OPTIONAL, a zero-arg accessor (app.js's own lazy-
 * accessor pattern, the same shape as its `relationsFor`/`skillLibrary`/
 * `callModel` entries) returning a POSPrior@1 object or null. When it
 * returns real data, every edge and every claim (`read()`'s output) also
 * carries `grammar` — perceiver/text/wordclass.js's real, treebank-measured
 * answer to "is this connector's FORM actually a verb", cross-validating
 * discoverRelationVocab's own SLOT-only measurement without ever filtering
 * it (2026-08-19: "we now have an infinitely richer hypergraph with parts
 * of speech", user direction, after a live "party" false-verb specimen).
 * Omitted, or not yet resolved: `grammar` is `null` everywhere, and
 * everything else is byte-identical to before this existed.
 *
 * `relationsFor(passages, { negationWords })` threads straight through to
 * discoverRelationVocab/extractRelations's own injected-prior seam
 * (relations.js, following bin/priors/lang/en.json's pattern in
 * the legacy engine.1). Omitted, the engine's own English NEGATION_WORDS applies,
 * unchanged from before this option existed. Supplying a Set (e.g.
 * bin/priors/lang/eu.json's `negation` array for Basque) reads the
 * material's negation with that language's own vendored closed class
 * instead — never a second, hardcoded English list standing in for
 * material this tier was never measured against.
 *
 * Every edge additionally carries `assertion` — the extractor's own claim
 * about the material treated as a reader's hypothesis with disclosed
 * support (asserted.js): `standing` (`corroborated` at >= 2 independent
 * statements, `single-witness` below — the structural floor, givers named
 * there), `statements` (how many extracted occurrences folded into this
 * edge), and `verbSupport` (how many DISTINCT surfaces this verb followed
 * in the material's own vocabulary measure — a verb admitted on the
 * strength of one surface is itself a single-witness assertion). The
 * word-salad arm rides only behind `relationsFor(passages, { assert:
 * { draws, seed } })` — draws declared, never defaulted; the arm reports
 * counts (`orderArm: { draws, fired, seed }`), never a verdict, because no
 * cut has been earned (asserted.js's header carries the reasoning). None
 * of this convicts: relationFindings and relationsClean are unchanged, so
 * an edge's weak standing reaches the reader as disclosure, not as a mark
 * against the answer. `grammar` (treebank evidence) and `assertion`
 * (structural corroboration/word-salad) are two INDEPENDENT measures of
 * the same underlying concern — a connector's own FORM against real
 * language evidence, versus how much the material's own recurrence and a
 * shuffled-null back this specific edge — neither replaces the other, and
 * both ride the same edge/claim disclosed side by side.
 *
 * `organs.classifyConnector`/`organs.minShare` — OPTIONAL, injected the
 * cast.js way (Per-Source Testimony spec, BUILD-3): grammar-lens.js's own
 * `makeGrammarLens` output, moved here from capacity-runner.js's post-hoc
 * `checkConnectorClass` so an edge carries its own connector classification
 * from the moment it is extracted, not just at check time. Every edge also
 * carries `connectorClass` when both are supplied — see `classifyConnector`'s
 * own destructuring comment, further down this function, for the full
 * account of why this is a THIRD, separate field from `grammar` two
 * paragraphs up rather than a rename of it. `minShare` has no safe default
 * (grammar-lens.js's own header) and MUST be declared by whichever caller
 * supplies `classifyConnector` — omitted, `connectorClass` is `undefined`
 * on every edge, byte-identical to every caller before this pass existed.
 */
// `organs.verbForms`, when provided, is a Set of known verb SURFACE FORMS
// from a received morphological resource (e.g. UniMorph's English paradigm
// table — every inflected form UniMorph tags V;..., a real linguistic
// prior with its own giver, not a hand-typed heuristic). Optional and
// backward-compatible exactly like `forms` above: omitted, vocabulary
// discovery is unchanged. Provided, every essay word that is ALSO a
// recurring form (the SAME FORM_MIN_ARRIVALS-gated set endpoint() already
// computes — reused, not a second recurrence measure) and is a known verb
// form joins the vocabulary directly, no surface-anchoring involved at
// all. This exists because discoverRelationVocab's own anchoring — reused
// for endpoint identity above with real success — does NOT transfer to
// VOCABULARY DISCOVERY: tried twice (recurring forms, then determiner-
// phrases, as candidate ANCHORS for discoverRelationVocab itself) and
// rejected both times on the merits (garbage triples like `subject: "of
// a", verb: "butterfly"`) because that function's candidate-nomination
// step assumes anchor SPARSITY that only proper names reliably give it —
// see eval/results/mine-1-next-steps.md. A received lexicon sidesteps the
// anchoring step entirely: it does not nominate candidates near an
// anchor, it answers a direct question ("is this word ever a verb")
// about every word in the essay.
// The operating point perceiver/text/pronouns.js::resolvePronouns is called
// at, reused whole from the legacy engine.1's host/corpus.js rather than invented
// here — corpus.js's own header names exactly what these are: "an
// engineering starting point, not yet validated against a retrieval-quality
// golden... moving these two numbers as one gets built is expected, not a
// regression." No golden exists for pronoun binding in THIS repo either, so
// the honest move is the same number, credited, not a fresh guess dressed as
// a considered choice.
const PRONOUN_MIN_ACTIVATION = 0.05;
const PRONOUN_MIN_MARGIN = 0.2;

/**
 * A pronoun subject is disclosed elsewhere in this file as noise, not a
 * claim about the cast (endpoint()'s own header two-doors down; POLICIES.md
 * has carried this as a named, open limitation since the assertion tier
 * landed). Measured live 2026-08-20 (real fetched material, the Lincoln/
 * Hamlin/Johnson question): "it says: He —was→ also the 16th vice
 * president" shipped to a reader with the pronoun unresolved, even though
 * the SAME passage names "Andrew Johnson" two sentences earlier — the
 * antecedent was sitting right there, unread. `pronouns.js::resolvePronouns`
 * already exists for exactly this (READING-POLICY P7.2: "a check on a name
 * asks about the referent, not the string") and was never wired into this
 * file. This composes it the way corpus.js already validated: PER PASSAGE,
 * never across passages — `relationsFor`'s own `list` is retrieved top-N
 * passages, often from unrelated pages/sites, and resolving a pronoun in one
 * against a name that only happens to occur in another would be exactly the
 * cross-document contamination P1's own activation-window discipline warns
 * against ("never carry a window across books"). Scoping `splitSentences` to
 * one passage's own text at a time means activation can only ever recall a
 * name that passage itself named. NOT the same `index` `endpoint()` uses for
 * referent matching elsewhere in this file, and deliberately so — see this
 * function's own header for the measured reason (cast.js's `minSentences: 0`
 * answers a different question than this organ needs asked).
 *
 * A resolved mention REWRITES the passage's extraction-only text (the
 * pronoun token replaced by the referent's most-individuated surface)
 * rather than patching the edge after extraction — because `extractRelations`
 * reads the connector's SLOT off raw text, and a rewrite lets subject role,
 * verb agreement, and everything downstream just work, the same reason
 * `blankFurniture` above rewrites text rather than post-processing triples.
 * Length-changing, unlike `blankFurniture` — safe here for the identical
 * reason that fix already established: this text feeds extraction only,
 * never an offset a citation depends on. An unresolved pronoun (below the
 * declared floor, gender-incompatible, or nothing named yet) is left
 * exactly as written — a typed gap upstream (pronouns.js's own `gaps`),
 * never a guess forced through.
 *
 * DELIBERATELY NOT `cast.js`'s shared `index` — measured live 2026-08-20,
 * against real continuous Wikipedia prose, read in true document order:
 * zero pronoun hits were even ATTEMPTED. `cast.js::makeReferentIndex` calls
 * `discoverReferents(surfaces, { minSentences: 0 })` — its own header names
 * the reason, correctly, for what CAST membership means to a citation check
 * ("presence... a name mentioned once is present once"), which is a
 * DIFFERENT question from what `resolvePronouns` needs. `resolvePronouns`'s
 * own gate refuses any sentence carrying ANY named surface at all — and
 * with `minSentences: 0`, a one-off place name ("Greeneville", "Maryland")
 * gets promoted to full referent status exactly like "Johnson" does,
 * so it blocks the attempt just as hard. The REAL, validated pipeline this
 * organ was proven on (the legacy engine.1's own corpus.js, on War and Peace) never
 * passes that override — `discoverReferents(surfaces, {})` uses its own
 * DERIVED recurrence floor (`deriveMinSentences`), so a name mentioned once
 * in passing never earns referent status and a truly recurring person (the
 * one a pronoun should recall) is what dominates activation. This function
 * runs that SAME derivation, scoped to the one passage being rewritten —
 * a second, differently-floored discovery pass, not the shared `index`,
 * because the two callers are asking genuinely different questions of the
 * identical material.
 */
/**
 * The bindings a pronoun-resolution pass would apply to `text`, WITHOUT
 * applying them — the mechanism this function used to be built around
 * (splice the string, then let the caller re-split it) is exactly what
 * `resolve-pronouns-sentence-drift.claim.json` (eo-constitution, found
 * reading Dracula in full, 2026-09-01) convicts: a resolved referent's own
 * surface can carry punctuation the author never wrote at that position
 * (a title abbreviation — "Dr.", "Mrs." — inserted where "he" stood), and
 * re-splitting the mutated document then disagrees with the ORIGINAL split
 * by a document-wide COUNT that has no sentence-local meaning at all. One
 * mismatch anywhere in a long document used to zero every span in it.
 *
 * The fix is not a smarter pairing check. It is not pairing anything: this
 * function now returns bindings, addressed against the PASSAGE'S OWN
 * offsets, and the caller (below) applies each one WITHIN the single
 * already-fixed original sentence it falls inside — never re-splitting
 * anything, ever. A sentence's address is `sentences[i]`, computed exactly
 * once, from the author's own bytes, for the whole life of this call.
 */
function pronounBindingsFor(sentences, resolvePronouns, { extractSurfaces, discoverReferents }) {
  const empty = { bindings: [], bestSurface: new Map() };
  if (!resolvePronouns || !sentences?.length) return empty;
  let discovery;
  try {
    const surfaces = extractSurfaces(sentences, {});
    discovery = discoverReferents(surfaces, {});
  } catch {
    return empty;
  }
  if (!discovery?.events?.length) return empty;
  const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));
  // Same "most-individuated established surface represents" rule cast.js's
  // own `represent` uses (most glyphs wins) — re-derived here because this
  // pass's own referent ids come from a differently-floored discovery.
  const bestSurface = new Map();
  for (const e of discovery.events) {
    const prev = bestSurface.get(e.referent_id);
    if (!prev || e.surface.length > prev.length) bestSurface.set(e.referent_id, e.surface);
  }
  let resolved;
  try {
    resolved = resolvePronouns(sentences, surfaceToReferent, {
      minActivation: PRONOUN_MIN_ACTIVATION,
      minMargin: PRONOUN_MIN_MARGIN,
    });
  } catch {
    return empty;
  }
  return { bindings: resolved?.bindings ?? [], bestSurface };
}

/**
 * ONE original sentence, with any pronoun bindings that fall INSIDE its own
 * [offset, offset+len) span applied to a local copy of ITS OWN text alone.
 * Every other sentence in the document is untouched by this call — there is
 * no whole-document string to re-split, so there is nothing for a sentence
 * count to disagree about. Sibling of `blankedSentence` below; identical
 * discipline, different transform.
 *
 * Offsets are checked against the sentence's OWN text before substituting
 * (the same staleness guard `resolvePronounSubjects` always had) — a
 * binding whose recorded span no longer matches what is actually there is
 * refused, never corrupted in.
 */
function sentenceWithPronouns(sentence, bindings, bestSurface) {
  if (!bindings.length) return sentence.text;
  const start = sentence.offset;
  const end = start + sentence.text.length;
  const local = bindings.filter((b) => b.offset >= start && b.offset < end);
  if (!local.length) return sentence.text;
  const ordered = [...local].sort((a, b) => b.offset - a.offset); // reverse: later splices never shift earlier ones
  let out = sentence.text;
  for (const b of ordered) {
    const name = bestSurface.get(b.referentId);
    if (!name) continue;
    const relStart = b.offset - start;
    const relEnd = relStart + b.pronoun.length;
    if (out.slice(relStart, relEnd).toLowerCase() !== b.pronoun.toLowerCase()) continue; // stale offset, refuse rather than corrupt
    out = out.slice(0, relStart) + name + out.slice(relEnd);
  }
  return out;
}

/**
 * The same per-sentence-local discipline for `blankFurniture` —
 * length-preserving furniture-blanking applied to ONE sentence's own text,
 * never to the whole joined document. `blankLabelRows` needs no wider
 * context than the substring it is handed (its own cell/run detection is
 * purely line-local within whatever text it receives), so scoping it to a
 * single already-addressed sentence costs nothing and removes the same
 * failure class `blank-furniture-sentence-drift.claim.json` names: a table
 * row's terminal-punctuation-erasure changing how many "sentences" a
 * SEPARATE re-split finds, because there is no longer a separate re-split.
 */
function sentenceWithBlanking(sentence, blankFurniture) {
  if (!blankFurniture) return sentence.text;
  try {
    const blanked = blankFurniture(sentence.text);
    return typeof blanked === "string" && blanked.length === sentence.text.length ? blanked : sentence.text;
  } catch {
    return sentence.text; // a transform that throws leaves this sentence exactly as written
  }
}

// ── the referent bar: a sentence-initial-only name, confirmed by a real
// pronoun binding ────────────────────────────────────────────────────────
//
// Real, measured problem (the-fold, 2026-08-20): "Lincoln never appointed
// Hamlin. Someone else got the job." — two sentences, "Lincoln" only ever
// sentence-initial — computed undetermined, not because anything about the
// claim itself was wrong, but because `extractSurfaces` never looks at
// sentence-initial position for ANY surface (that function's own header:
// "capitalised runs, skipping the sentence-initial token — it is
// capitalised by position and carries no evidence of namehood on its
// own"), so "Lincoln" never even becomes a CANDIDATE, let alone a referent
// `endpoint()` below can resolve a subject against. This is L2's own rule
// working exactly as designed (a lone capitalized word that ONLY ever
// opens a sentence reads as position, not namehood) — but encyclopedia-
// lede-style writing (a subject named once, then referred to only by
// pronoun) can never clear this bar through recurrence alone, and that
// exact shape is the traced root cause behind several earlier
// `undetermined` results in this project's own history.
//
// User direction, verbatim, settling what would otherwise be an open
// design choice among several candidates: "I fundamentally think our
// concept of 'needs to appear more than once' is wrong — we need to count
// it being pointed to via pronouns as well." Concretely: a resolved
// pronoun binding contributes to the SAME `sentences` recurrence count
// `discoverReferents`'s own derived floor already compares every OTHER
// candidate against — never a second, separate corroboration signal
// bolted on after a decision already made on name-text recurrence alone.
//
// THE CIRCULARITY, AND HOW IT IS BROKEN. `resolvePronouns` needs a
// referent already admitted to serve as a binding target — but the whole
// point here is admitting a referent ORDINARY admission never sees at
// all. Broken in two passes: PASS 1 (`confirmLeadingReferents`)
// provisionally adds every leading-only candidate (surfaces.js's own new
// `extractLeadingSurfaces` — the mirror of `extractSurfaces`, exactly as
// evidence-free about namehood as "a capitalized word opened this
// sentence," see that function's own header) to a TEMPORARY, namespaced
// (`provisional:<slug>`, never colliding with a real `ref:auto:*` id) copy
// of this passage's own referent map, purely so `resolvePronouns` has
// something to test a pronoun against — nothing is admitted into the REAL
// index yet. PASS 2 runs `resolvePronouns` for real, at this file's own
// already-declared, already-justified operating point
// (`PRONOUN_MIN_ACTIVATION`/`PRONOUN_MIN_MARGIN` — the SAME numbers
// `resolvePronounSubjects` above already trusts, never a fresh number
// invented for this path), and ONLY a candidate a real binding actually
// resolved to (clearing that SAME floor, no exception, no relaxed bar) is
// CONFIRMED — carrying forward exactly the sentences its confirming
// bindings occupy into the SAME `discoverReferents` call
// (`minSentences: 0`, matching cast.js's own declared floor for this
// question — "presence... a name mentioned once is present once") every
// ordinarily-admitted referent already goes through. "Provisional" never
// leaks past `confirmLeadingReferents` — the real index only ever sees a
// candidate that already earned a real `sentences` count the derived
// floor can fairly compare against everything else, the identical bar,
// not a lowered one.
//
// SCOPED PER PASSAGE, for the SAME reason `resolvePronounSubjects` above
// already is (P38, this file: "never carry a window across books,"
// READING-POLICY P1): `list` may hold retrieved passages from unrelated
// pages, and resolving a pronoun in one against a name that only happens
// to occur in a DIFFERENT, unrelated one would be exactly the cross-
// document contamination that rule exists to prevent.
//
// DISCLOSED, NOT SILENTLY NARROWER THAN IT SOUNDS — a real, measured limit
// found WHILE building this, not assumed: this mechanism does NOT yet help
// the single most canonical shape of the problem it was built for — a name
// that opens the very FIRST sentence of a passage, referred to by pronoun
// for the rest of it (the exact "Hannibal Hamlin (dates) was..." / "He
// was..." Wikipedia-lede shape this section's own header names, and the
// exact 2-sentence "Lincoln never appointed Hamlin. Someone else got the
// job." specimen this whole investigation started from). Traced to the
// ROOT MECHANISM, not just the symptom: `emergence/activation.js::codeOf`
// scores a word's distinctiveness as `idfOf(w) = log(max(1,state.read) /
// max(1,df.get(w)))` — at `state.read` small (the first several sentences
// of ANY passage, before enough frames have been read for the ratio to
// separate anything), `idfOf` rounds to ~0 for EVERY word, universally,
// regardless of content, because nothing can look "rare" yet against an
// almost-empty read count. `codeOf`'s own gate (`if (s < idfFloor)
// continue`) then excludes EVERY word of that early frame from `trace`,
// which means `encodeFrame` never enters it into `posting` at all — a
// frame processed during this cold-start window is invisible to `recall`
// FOREVER after, not just weakly recalled, no matter how many later
// sentences echo its vocabulary. Measured directly, isolating the primitive
// from this file's own composition (raw `codeOf`/`recall`/`encodeFrame`,
// no pronoun machinery involved): a naming sentence at frame 0 stores an
// EMPTY trace (`traceKeys: []`) when encoded, and a later probe's own
// `recall()` never includes frame 0 in its activation map, however far
// downstream or however strongly a shared phrase repeats — while the
// IDENTICAL naming sentence, moved to frame 10 or frame 15 of the same
// passage (ten-plus sentences of ordinary preceding material), stores a
// full trace and IS correctly recalled later, proven end to end through
// this exact mechanism (`hypergraph.test.mjs`'s own cases, below). This is
// a property of `activation.js` itself — the same primitive `resolvePronouns`
// already depends on for every OTHER purpose too, including
// `resolvePronounSubjects` above — not a defect in this section's own
// composition; it was simply never named before because nothing had asked
// `activation.js` to recall a passage's own FIRST frame until this pass.
//
// WHY NOT WORKED AROUND HERE. Priming `state` with duplicate copies of the
// real early sentences does not help — it was checked, not assumed: a
// repeated word's df grows in exact lockstep with the priming reads, so
// `idfOf` stays at `log(1)=0` regardless of how many copies are fed in
// (IDF rewards RARITY relative to volume, and copying content raises both
// numerator and denominator together). Priming with UNRELATED filler
// sentences purely to advance `state.read` past the cold-start threshold
// before the real material begins might work mechanically, but is a new,
// unvalidated mechanism of its own (how much padding is enough is exactly
// the kind of number this codebase's own standing rule says must be
// measured against a null, never hand-picked) and was not attempted here —
// this file's own established preference, seen repeatedly elsewhere in it,
// is a disclosed real limit over a rushed fix under time pressure. The
// real fix belongs one level down, in `activation.js` itself: a caller-
// visible, DERIVED "minimum frames before recall is meaningful" signal
// (mirroring `deriveMinSentences`'s own derivation elsewhere in this
// codebase), so a caller can know, not guess, whether a cold-start frame's
// absence from `trace` means "nothing here" or "not enough has been read
// yet to tell." Real, scoped, unattempted future work, named here rather
// than silently left looking like this file's own oversight.

/**
 * Every sentence-initial-only candidate a real pronoun binding confirms,
 * across `list`'s own passages, scoped per passage — see this section's
 * own header for the full account. Returns `extractSurfaces`'s own
 * `{surface, mentions, sentences}` shape, ready to merge into the pooled
 * surfaces list before the one real `discoverReferents` call that decides
 * admission (`withConfirmedLeadingReferents`, below), so that call's own
 * union-find clustering — never re-derived here — correctly folds a
 * confirmed "Lincoln" into an already-admitted "Abraham Lincoln" when both
 * are present, exactly as it would have if "Lincoln" had been an ordinary
 * candidate from the start.
 */
function confirmLeadingReferents(
  list,
  pooledSurfaces,
  { splitSentences, extractSurfaces, extractLeadingSurfaces, discoverReferents, resolvePronouns, diaNorm, functionWords, thirdPersonSingular },
) {
  // `functionWords` alone is not enough to keep a PRONOUN out of its own
  // candidate pool — measured live, not assumed: the corpus-scale closed
  // class this file's own `functionWords` derives (cite.js::commonTerms,
  // gated on CORPUS_MINIMUM) can be genuinely EMPTY at turn/passage scale,
  // exactly the scale this whole mechanism exists for, and "He"/"She"
  // opening a sentence is then nominated as its own leading candidate.
  // Once THAT is added to `surfaceToReferent` below, `resolvePronouns`'s
  // own "no name in this sentence" gate sees a false name in EVERY
  // sentence that pronoun opens, silently blocking every real binding
  // this mechanism exists to find — reproduced live on a real Wikipedia-
  // lede-shaped specimen: zero attempts, zero gaps, zero bindings, traced
  // to exactly this. Fixed with the grammar layer, not a hand-typed list
  // (this repo's own standing rule): `organs.thirdPersonSingular` —
  // priors.js's own `THIRD_PERSON_SINGULAR`, the IDENTICAL closed class
  // `resolvePronouns` itself already trusts internally to find a pronoun
  // in the first place — union'd with the corpus-scale `functionWords`
  // ONLY for this function's own two calls below, never touching the
  // outer `functionWords` variable the rest of `relationsFor` uses for
  // vocabulary discovery.
  const excludeWords = thirdPersonSingular
    ? new Set([...(functionWords ?? []), ...Object.keys(thirdPersonSingular).map((w) => diaNorm(w))])
    : functionWords;

  const pooledSet = new Set(pooledSurfaces.map((s) => s.surface));
  const confirmedSentences = new Map(); // surface -> Set(sentenceOrder)
  const leadingMentions = new Map(); // surface -> total leading-only mentions, for disclosure
  const provisionalId = (surface) => `provisional:${diaNorm(surface).replace(/\s+/g, "_")}`;

  for (const passage of list ?? []) {
    if (!passage?.text?.trim()) continue;
    let sentences, ordinary, leading;
    try {
      sentences = splitSentences(passage.text);
      ordinary = extractSurfaces(sentences, { functionWords: excludeWords });
      leading = extractLeadingSurfaces(sentences, { functionWords: excludeWords });
    } catch {
      continue;
    }
    // Already established (this passage, or elsewhere in the pool) —
    // needs no help from this mechanism, and re-confirming it here would
    // be redundant work, never wrong, but wasted.
    const ordinarySet = new Set(ordinary.map((s) => s.surface));
    const provisional = leading.filter((s) => !ordinarySet.has(s.surface) && !pooledSet.has(s.surface));
    if (!provisional.length) continue;

    let discovery;
    try {
      discovery = discoverReferents(ordinary, {});
    } catch {
      continue;
    }
    const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));
    for (const p of provisional) {
      leadingMentions.set(p.surface, (leadingMentions.get(p.surface) ?? 0) + p.mentions);
      surfaceToReferent.set(p.surface, provisionalId(p.surface));
    }

    let resolved;
    try {
      resolved = resolvePronouns(sentences, surfaceToReferent, {
        minActivation: PRONOUN_MIN_ACTIVATION,
        minMargin: PRONOUN_MIN_MARGIN,
      });
    } catch {
      continue;
    }
    for (const b of resolved?.bindings ?? []) {
      if (!b.referentId.startsWith("provisional:")) continue;
      const surface = provisional.find((p) => provisionalId(p.surface) === b.referentId)?.surface;
      if (!surface) continue;
      if (!confirmedSentences.has(surface)) confirmedSentences.set(surface, new Set());
      confirmedSentences.get(surface).add(b.sentenceOrder);
    }
  }

  return [...confirmedSentences.entries()].map(([surface, sentenceSet]) => ({
    surface,
    mentions: leadingMentions.get(surface) ?? sentenceSet.size,
    sentences: sentenceSet.size,
  }));
}

/**
 * The tail half of `cast.js::makeReferentIndex`'s own construction
 * (`resolve`/`represent`, built from a finished `events` list), duplicated
 * here on purpose rather than refactored out of cast.js: this file needs
 * to build an index from an events list IT derives itself (base surfaces
 * plus confirmed leading referents, re-clustered together), and cast.js's
 * own `indexFor` has no seam for handing it a pre-built list instead of
 * computing its own from scratch. A small, disclosed duplication (~15
 * lines of glue, not the actual matching logic, which stays exactly
 * `namesCorefer`) rather than a cross-cutting refactor of cast.js's own
 * signature — cast.js is used elsewhere (capacity-runner.js's own
 * `distinguish`/"cast" capacity) and reshaping it to accommodate one
 * caller here is a larger, more invasive move than this fix needs.
 * Extracting a shared `buildIndexFromEvents` into cast.js itself, so both
 * call sites use one implementation, is real, sensible, unattempted
 * future work — named here rather than silently left looking like an
 * oversight.
 */
function buildIndexFromEvents(events, { namesCorefer, diaNorm }) {
  const empty = { events: [], referents: new Set(), resolve: () => new Set(), represent: () => null };
  if (!events?.length) return empty;
  const best = new Map();
  for (const e of events) {
    const prev = best.get(e.referent_id);
    if (!prev || e.surface.length > prev.length) best.set(e.referent_id, e.surface);
  }
  // MIN_STEM: the module-scope constant declared above (line ~219) — this
  // used to be redeclared here too, an identical-value dead local shadow.
  const covers = (s, p) => s === p || (Math.min(s.length, p.length) >= MIN_STEM && (s.startsWith(p) || p.startsWith(s)));
  function resolve(name) {
    const ids = new Set();
    const parts = diaNorm(name).split(/\s+/).filter((t) => t.length > 2);
    if (!parts.length) return ids;
    for (const e of events) {
      if (!namesCorefer(name, e.surface)) continue;
      const surfaceTokens = diaNorm(e.surface).split(/\s+/);
      if (parts.every((p) => surfaceTokens.some((s) => covers(s, p)))) ids.add(e.referent_id);
    }
    return ids;
  }
  return { events, referents: new Set(best.keys()), resolve, represent: (id) => best.get(id) ?? null };
}

/**
 * Wraps `indexFor(list)`'s own real, unchanged base index with any
 * sentence-initial-only referents `confirmLeadingReferents` could confirm
 * via a real pronoun binding. Gated on BOTH new organs
 * (`extractLeadingSurfaces` AND `resolvePronouns`) being present; either
 * omitted, this returns `baseIndex` untouched, no extra computation
 * attempted at all — byte-identical to before this mechanism existed.
 * Also returns `baseIndex` untouched whenever nothing new was confirmed
 * (the ordinary case for material with no such gap, and every error path)
 * — the extra `extractSurfaces`/`discoverReferents` calls below cost real
 * but small work only when there is real work to check, and NEVER risk
 * downgrading or losing anything `indexFor` already established: every
 * failure mode here degrades to the base index, never to less than it.
 */
function withConfirmedLeadingReferents(
  list,
  baseIndex,
  { splitSentences, extractSurfaces, extractLeadingSurfaces, discoverReferents, resolvePronouns, namesCorefer, diaNorm, functionWords, thirdPersonSingular },
) {
  if (!extractLeadingSurfaces || !resolvePronouns) return baseIndex;
  let pooledSurfaces;
  try {
    const text = (list ?? []).map((p) => p?.text ?? "").join("\n\n");
    if (!text.trim()) return baseIndex;
    pooledSurfaces = extractSurfaces(splitSentences(text), { functionWords });
  } catch {
    return baseIndex;
  }
  let confirmed;
  try {
    confirmed = confirmLeadingReferents(list, pooledSurfaces, {
      splitSentences,
      extractSurfaces,
      extractLeadingSurfaces,
      discoverReferents,
      resolvePronouns,
      diaNorm,
      functionWords,
      thirdPersonSingular,
    });
  } catch {
    return baseIndex;
  }
  if (!confirmed.length) return baseIndex;
  let events;
  try {
    events = discoverReferents([...pooledSurfaces, ...confirmed], { minSentences: 0 }).events;
  } catch {
    return baseIndex;
  }
  return buildIndexFromEvents(events, { namesCorefer, diaNorm });
}

// The arrangement, named the way it is actually earned: two ordered ends
// and a label (CLAUDE.md's grammar-lens section — "an ordered first end, a
// label, an ordered second end"). `subject`/`verb`/`object` are the
// SAE-grammar reading of that arrangement — already named as a declared
// overlay, not yet stored as one. `end1`/`label`/`end2` are the identical
// three values under their earned names, ADDED, never substituted: every
// existing reader of `.subject`/`.verb`/`.object` is unaffected, and
// nothing yet reads the new fields. One implementation, used at every site
// that builds an edge/claim shape, so the two names cannot drift the way
// four separate `{subject: t.subject, verb: t.verb, object: t.object}`
// literals eventually would have — the same drift class this file's own
// history (DEF/EVA's `Array.find`, `synthesize`'s `String.includes`)
// already found twice, closed here before a third. Exported (rather than a
// closure-local of `makeRelationReader`) because it closes over nothing —
// a pure mapping deserves to be directly testable without the whole
// organ-injected reader behind it. Migrating a consumer off `subject`/
// `verb`/`object` onto `end1`/`label`/`end2` happens file by file, in a
// later pass — not here.
export const arrangementOf = (t) => ({ end1: t.subject, label: t.verb, end2: t.object });

export function makeRelationReader(organs) {
  const {
    splitSentences,
    extractSurfaces,
    discoverReferents,
    namesCorefer,
    diaNorm,
    discoverRelationVocab,
    extractRelations,
    tokenize,
    // `extractorsMode` — "legacy" (default) | "dispatch". A dispatch
    // extractor (relationExtractorsFor's GFP or RoleConfig@1 mode) is
    // self-gating: it must run even when the vocabulary pass returns
    // nothing, which is by design for both dispatch modes.
    extractorsMode = "legacy",
    verbForms = null,
    // `oovLexicon` — OPTIONAL, a Set of known verb surface forms used ONLY to
    // gate an out-of-vocabulary connector at the POS gate (discoverRelationVocab's
    // `verbForms` option). Kept apart from `verbForms` above on a measurement:
    // the same UniMorph set used to WIDEN the vocabulary added 98 notes to an
    // 81-note ledger, with labels like battle / work / and / version / author
    // (noun-verb conversions UniMorph lists as verb forms), while as a gate it
    // refused 'nobility', 'aristocratic', 'и' and admitted nothing new.
    oovLexicon = null,
    createLemmatizer = null,
    morphologyIndex = null,
    morphologyLanguage = null,
    blankFurniture = null,
    normaliseNewlines = null,
    resolvePronouns = null,
    classifyConnector = null,
    minShare = undefined,
    extractLeadingSurfaces = null,
    thirdPersonSingular = null,
    determiners = null,
    definiteDeterminers = null,
    negationWords: negationClass = null,
    // `organs.firstPerson` — OPTIONAL, a RECEIVED closed class (priors.js's
    // own FIRST_PERSON regex, giver "lang/en"), never a word list typed
    // here. Gates the first-person-deixis wall in `judge()` below (S96 /
    // the-fold P180): "my", "I", "our", "we" name whoever is SPEAKING,
    // never a stable entity, so a subject led by one of these must not bind
    // via ordinary token/form identity across documents. `organs.
    // sameSpeakerRef` — OPTIONAL, `(ref) => boolean` — is the caller's own
    // declared test for "this passage's ref shares the answer's speaker"
    // (e.g. the self plane's own `self:`-addressed record). Omitted, the
    // wall refuses UNCONDITIONALLY (no evidence anywhere that two documents
    // share a speaker) rather than silently trusting token overlap; both
    // omitted, byte-identical to every caller before this pass, exactly
    // like `verbForms`/`determiners` above.
    firstPerson = null,
    sameSpeakerRef = null,
    // `organs.phrasalPredicates`/`organs.nounPhraseSubjects` — OPTIONAL
    // booleans, live_priors' own DR4/DR5 (goldens/reading/DERIVED-RULES.md):
    // the native relations.js organs (eoreader7) now accept these flags
    // directly and carry their OWN received defaults (AUXILIARY_VERBS /
    // DEFINITE_DETERMINERS / INDEFINITE_DETERMINERS / POSSESSIVE_DETERMINERS
    // / NP_COORDINATORS, priors.js, giver lang/en) — this file passes the two
    // booleans through and injects nothing else, so a caller wanting a
    // different vocabulary supplies it straight to `discoverRelationVocab`/
    // `extractRelations` itself rather than through a third parameter here.
    // Both default false: omitted, every existing caller sees byte-identical
    // extraction (an aux-swallowed verb, a bare 1-2 token subject) — the same
    // backward-compatible posture `verbForms`/`createLemmatizer` above hold.
    // Disclosed scope: threaded only into the MATERIAL-side extraction below
    // (the primary edge loop and its order-arm null test) — `read(answer)`'s
    // own `discoverRelationVocab`/`extractRelations` calls, which check a
    // model's drafted answer against these same edges, are NOT touched this
    // pass. Widening only one side risks a subject-shape mismatch between an
    // edge and the answer's own claim about it; unattempted, named rather
    // than silently assumed symmetric.
    phrasalPredicates = false,
    nounPhraseSubjects = false,
    attestedVerbs = false,
    // P36's object-specificity rule at the reader (opt-in, declared — a reader
    // option reaches the frame by construction, the-fold P96): a claim binds
    // only to an edge whose object states EVERY content token of the claim's
    // object. Below CORPUS_MINIMUM the object match is `tokensShare` — one
    // shared token — so "the Royal Society in 1887" bound to "the Northgate
    // Observatory in 1887" on `in 1887` (the product assay's wall 6, the-fold
    // P97). A live turn's retrieved passages are always sub-floor.
    objectSpecificity = false,
  } = organs;
  const indexFor = makeReferentIndex(organs);

  // `organs.classifyConnector`/`organs.minShare` — OPTIONAL, injected the
  // cast.js way, exactly like `verbForms`/`createLemmatizer` above:
  // grammar-lens.js's own `makeGrammarLens` output, moved here from
  // capacity-runner.js's post-hoc `checkConnectorClass` (Per-Source
  // Testimony spec, BUILD-3 — BUILD-0/1/2 are `landAct`'s claim_id spine,
  // `perSourceReadings`, and `mergeTestimony`, all in capacity-runner.js).
  // Tags each edge with its connector's Thrax classification AT EXTRACTION
  // TIME, the same posture `assertion` already holds — see the tagging
  // loop below, right where `assertion` is tagged.
  //
  // NOT THE SAME FIELD AS `grammar`, TWO PARAGRAPHS UP — a real, disclosed
  // distinction, not an oversight: `grammar` is `discoverRelationVocab`'s
  // own VOCABULARY-level check (`organs.posPriorFor` + this file's OWN
  // declared `GRAMMAR_MIN_SHARE` = 0.5), computed ONCE per verb TYPE during
  // vocabulary discovery and used to gate a CLAIM to `beyond-reach` BEFORE
  // it can even bind (judge()'s own `claim.grammar?.plausibleAsVerb`
  // check). `connectorClass` (the field this organ pair tags edges with,
  // below) is grammar-lens.js's own EDGE-level classification — caller-
  // declared `minShare`, never defaulted here — used AFTER a verdict
  // already computed, to catch a garbled connector squaring and object-
  // specificity both miss (capacity-runner.js's `checkConnectorClass`, now
  // reading this tag instead of calling `classifyConnector` itself). Both
  // ultimately read the SAME underlying wordclass.js primitives against the
  // SAME POSPrior@1 evidence and can legitimately disagree at different
  // `minShare` operating points — disclosed as two independent measures
  // riding the same edge, the identical posture this file's header already
  // states for `grammar` vs `assertion` ("two INDEPENDENT measures of the
  // same underlying concern... neither replaces the other").
  //
  // `minShare` is REQUIRED whenever `classifyConnector` is supplied —
  // dominantClass's own never-defaulted contract (grammar-lens.js's own
  // header: a silently-defaulted 0.9 once let two of its own real garbled
  // connectors through unflagged), the identical discipline this file's
  // own call to `discoverRelationVocab` already enforces for
  // `posPrior`/`grammarMinShare`, two lines below. Both organs omitted:
  // byte-identical to every caller before this pass — no edge gets a
  // `connectorClass` field at all, matching `assertion`'s own backward-
  // compatible posture.
  if (classifyConnector && !Number.isFinite(minShare)) {
    throw new TypeError(
      "makeRelationReader: minShare is declared alongside classifyConnector — how dominant a class must be to collapse is never a default (dominantClass's own contract, grammar-lens.js's own header)",
    );
  }

  // `organs.createLemmatizer`/`organs.morphologyIndex`, when both provided,
  // widen every verb comparison below from exact string equality to the
  // SAME lemma (UniMorph's irregular-inflection table, perceiver/text/
  // morphology.js — a received prior with its own giver, never a hand-
  // typed rule). Omitted, `createLemmatizer(null)` degrades to exact
  // match by its own stated design ("a missing prior degrades LOUDLY...
  // rather than silently changing answers" — its own header), so this is
  // backward compatible without a branch here: a claim phrased "underwent
  // metamorphosis" now binds to material stating "undergoes metamorphosis"
  // — the SAME predicate, different tense, which exact-string matching
  // was silently reading as two different verbs.
  //
  // `organs.morphologyLanguage` threads the loaded prior's OWN declared
  // language straight through to `createLemmatizer`'s own gate on its
  // English-only suffix rule (morphology.js's 2026-08-19 amendment) — the
  // natural path is `loadMorphology(path).language`, never a second value
  // a caller has to remember separately. This is the whole reason this
  // organ can be handed a French, Ancient Greek, or any other declared
  // prior without hypergraph.js itself needing to know or care: nothing
  // English-specific lives in THIS file — the one hardcoded English rule
  // lives entirely in morphology.js, gated on the SAME declaration its own
  // provenance already requires, and this file is just the pass-through.
  const sameAct = createLemmatizer
    ? createLemmatizer(morphologyIndex, { language: morphologyLanguage }).sameAct
    : (a, b) => a === b;

  return function relationsFor(passages, { pool = null, assert = null, negationWords = undefined } = {}) {
    const list = (passages ?? []).filter((p) => p && typeof p.text === "string" && p.text.trim());
    const emptyReport = (examined) => ({
      examined,
      vocabulary: { verbs: 0, minSurfaces: MIN_SURFACES_PER_VERB, grammarPrior: false, candidates: 0 },
      edges: [],
      claims: [],
    });
    if (!list.length) {
      return { examined: false, vocabulary: { verbs: 0, minSurfaces: MIN_SURFACES_PER_VERB, grammarPrior: false, candidates: 0 }, edges: [], read: () => emptyReport(false) };
    }

    // The closed class is measured from the POOL (the whole live corpus,
    // when the caller has one), never from the turn's few offered passages,
    // and by DOCUMENT FREQUENCY, not token share: material.js's
    // functionWordSet thresholds on a word's share of all tokens (~0.6%),
    // which is the right measure at book scale and degenerates at turn
    // scale — on a few-hundred-token pool every twice-occurring word
    // crosses it, and this fixture's own "married" was classified as a
    // function word while building. The organ for "what the corpus says
    // everywhere" at THIS scale already exists and is already earned:
    // cite.js::commonTerms — present in more than half the pool's chunks —
    // with its own declared floor (CORPUS_MINIMUM: below it, a frequency
    // is not a frequency and nothing counts as common; the filter simply
    // does not run, the engine's optional-filter discipline, and the
    // disclosed residue is auxiliary noise in the vocabulary — which can
    // widen what the reader hears but never fabricate an edge, since
    // extractRelations emits nothing without a literal match).
    //
    // MOVED earlier in this function (Per-Source Testimony's sibling
    // referent-bar fix) — computed here now, before `index`, so
    // `withConfirmedLeadingReferents` below can pass it through to
    // `extractSurfaces`/`extractLeadingSurfaces` the identical way the
    // vocabulary-discovery pass two screens down already does. A pure
    // reordering of two independent computations — this pass never reads
    // `index`/`extractionList`/`text`, so moving it earlier changes
    // nothing about what it computes, only when.
    let functionWords = null;
    try {
      const chunks = (pool?.length >= CORPUS_MINIMUM ? pool : list).map((p) => ({
        terms: p?.terms instanceof Set ? p.terms : new Set(tokenize(p?.text ?? "")),
      }));
      const common = commonTerms(chunks);
      functionWords = common.size ? common : null;
    } catch {
      functionWords = null;
    }

    // `organs.extractLeadingSurfaces`, when provided ALONGSIDE
    // `organs.resolvePronouns`, augments the base index with any
    // sentence-initial-only referent a real pronoun binding confirms — see
    // this file's own "the referent bar" section, above `makeRelationReader`,
    // for the full account. Either omitted (every caller before this pass,
    // and every caller that never injects `extractLeadingSurfaces`),
    // `withConfirmedLeadingReferents` returns `indexFor(list)` untouched on
    // its very first line — byte-identical.
    const index = withConfirmedLeadingReferents(list, indexFor(list), {
      splitSentences,
      extractSurfaces,
      extractLeadingSurfaces,
      discoverReferents,
      resolvePronouns,
      namesCorefer,
      diaNorm,
      functionWords,
      thirdPersonSingular,
    });

    // `organs.blankFurniture`, when provided, is a length-preserving blanker
    // (source.js::blankLabelRows, this repo's own — the ratchet pass that
    // crossed this file's other organs to eoreader7 native found this symbol
    // never existed on any engine path at all; it is a the-fold concern, not
    // an engine one) run ONLY on the copy of the
    // material this function hands to discoverRelationVocab/extractRelations
    // — never on `list` itself, so every OTHER reader of a passage's `.text`
    // (referent identity below, and every caller outside this function:
    // citations, succession.js's own dedicated succession-box parser, the
    // grounding ladder, what actually reaches the model) still sees the real
    // bytes untouched. Scoped this narrowly because a Wikipedia succession
    // box's bare "In office" / "Preceded by X" / "Succeeded by Y" rows have
    // no sentence terminator between them, and extractRelations's own MATCHER
    // reads whitespace connectors across a bare newline on purpose (real
    // Gutenberg hard-wrapped prose needs that) — so on this one material
    // shape the two rules collide and glue adjacent box rows into a
    // nonsensical triple. `organs.resolvePronouns`, when provided, rewrites a
    // bound third-person-singular pronoun subject to its referent's own
    // surface, PER PASSAGE — resolvePronounSubjects's own header has the
    // measured reason and the scoping discipline. Both run on the SAME
    // extraction-only copy; neither touches `list` itself, so a citation's
    // offset is never at risk. Omitted, either or both, this is
    // byte-identical to before they existed — optional and backward-
    // compatible exactly like `verbForms` above.
    // ORIGINAL SENTENCES, COMPUTED EXACTLY ONCE PER PASSAGE — the authoritative
    // segmentation, off the untouched bytes `list[pi].text` actually carries.
    // Nothing below this line ever re-splits a rewritten copy of anything
    // (eo-constitution claims blank-furniture-sentence-drift /
    // resolve-pronouns-sentence-drift, both closed by this restructuring,
    // 2026-09-01): a pronoun binding or a furniture-blank is applied WITHIN
    // one already-fixed sentence's own span, never to the whole passage, so
    // there is no second sentence count to disagree with the first.
    const passageSentences = list.map((p) => splitSentences(p.text) ?? []);
    // A chunk's own span of a whole-page furniture blanking, when the chunker
    // was given the organ and its readback check passed (source.js). Null
    // everywhere it was not — every existing caller, unchanged.
    const passageBlanked = list.map((p) => {
      const b = p?.blanked;
      return typeof b === "string" && b.length === String(p.text ?? "").length ? b : null;
    });
    // `splitSentences` normalises newlines, so a sentence's offset is in
    // NORMALISED space while `blanked` is aligned to the RAW text. This maps
    // one back to the other. Absent the organ every candidate simply fails
    // the per-character check on CRLF material and falls back.
    const passageToRaw = list.map((p, pi) =>
      passageBlanked[pi] != null && normaliseNewlines ? normaliseNewlines(String(p.text ?? "")).toRaw : null);
    const passageBindings = list.map((p, pi) =>
      resolvePronouns ? pronounBindingsFor(passageSentences[pi], resolvePronouns, { extractSurfaces, discoverReferents }) : { bindings: [], bestSurface: new Map() });

    /**
     * This passage's sentence i, rewritten locally for extraction only.
     *
     * FURNITURE IS BLANKED WITH THE PAGE IN VIEW WHEN THE CHUNKER SUPPLIED
     * THAT VIEW, and per sentence either way. `blankLabelRows` needs `minRun`
     * CONSECUTIVE cells to call anything furniture, and the median chunk of a
     * real page is 31-72 characters, so a navbox arrives already atomised into
     * one-bullet passages and the run can never form here — measured, 13x to
     * 63x less furniture blanked than the same organ sees when handed the
     * whole page (source.js::withPageBlanking carries the numbers). The
     * evidence for a run lives ACROSS chunks, so `chunkSource` takes the
     * decision where the page still exists and hands each chunk its own span
     * of the result as `chunk.blanked`, gated on a readback check.
     *
     * THE TWO SCOPES ARE ADDITIVE, NOT EXCLUSIVE. The page-scoped copy is
     * applied first and the caller's OWN `blankFurniture` still runs over the
     * result. That keeps the reader's injected organ authoritative — a caller
     * that never asked for blanking never gets it, whatever the chunker was
     * told — and it means the page copy can only ever ADD to what this reader
     * already blanked, never replace its judgement with a stranger's
     * parameters.
     *
     * COORDINATE SPACES, AND THE BUG THIS GUARD EXISTS FOR. `splitSentences`
     * normalises newlines (`\r\n` -> `\n`, LENGTH-CHANGING), so
     * `sentence.offset` addresses a NORMALISED copy of the passage, while
     * `chunk.blanked` is aligned to the RAW `chunk.text`. On CRLF material —
     * Gutenberg, anything Windows-authored — the two diverge by one character
     * per preceding CRLF pair, and a length-only check cannot see it: a
     * shifted window has exactly the right length. Measured: three of four
     * sentences corrupted on a CRLF document carrying NO furniture at all,
     * the shifted text beginning mid-word and still shipping the clean
     * address of the sentence it was supposed to be.
     *
     * So the offset is converted through the material's own newline map when
     * the caller injects `normaliseNewlines` (the engine's own organ, whose
     * `toRaw` exists for exactly this), and EVERY candidate is verified
     * per-character before use: it is usable only if each position is either
     * the sentence's own character or a space. Absent the organ, or on any
     * residual disagreement, the check fails and this falls back to the
     * sentence's own text — feature off, never wrong.
     *
     * ORDER. The page copy is read first, because it is aligned to the
     * original and pronoun substitution is length-changing ("He" ->
     * "Johnson"). One consequence is deliberate: a pronoun whose characters
     * were blanked as furniture no longer resolves, because
     * `sentenceWithPronouns`'s own staleness guard sees spaces where it
     * recorded a pronoun and refuses that binding rather than corrupting it
     * in — the correct reading, since a pronoun inside a navigation template
     * is not the passage's anaphora.
     *
     * SCOPE, STATED BECAUSE THE HEADLINE NUMBER READS WIDER THAN IT IS.
     * This reaches EXTRACTION only. `indexFor(list)` and the sentences
     * `pronounBindingsFor` reads are both built from the UNBLANKED `p.text`,
     * so a name that occurs only inside furniture still enters the referent
     * index and can still be a pronoun's antecedent — verified: a name
     * appearing solely in navbox rows still resolves as a referent form with
     * page blanking on, while its edges are gone. What the change removes is
     * navbox EDGES, not navbox REFERENTS. Blanking the index's input too is a
     * separate decision with its own cost (a name genuinely introduced in a
     * caption or a list is then unknown to the reading) and is not taken here.
     *
     * NOTHING HERE RE-SPLITS ANYTHING, so the drift the per-sentence
     * discipline exists to prevent (`blank-furniture-sentence-drift`) is
     * prevented exactly as before: the segmentation is computed once off the
     * untouched bytes and a rewrite is only ever applied WITHIN one
     * already-fixed sentence's span.
     */
    const blankedSentence = (pi, sentence) => {
      const prepared = passageBlanked[pi];
      if (prepared == null) return null;
      const own = sentence.text;
      const toRaw = passageToRaw[pi];
      let out = "";
      for (let i = 0; i < own.length; i++) {
        const at = toRaw ? toRaw(sentence.offset + i) : sentence.offset + i;
        const ch = prepared[at];
        // The only licensed difference is this character having been blanked.
        if (ch !== own[i] && ch !== " ") return null;
        out += ch;
      }
      return out;
    };

    const readSentenceText = (pi, si) => {
      const sentence = passageSentences[pi][si];
      const { bindings, bestSurface } = passageBindings[pi];
      // THE READER'S OWN ORGAN IS AUTHORITATIVE. The page-scoped copy is
      // consulted only by a reader that is ITSELF blanking furniture — a
      // caller who never injected the organ never gets blanking it did not
      // ask for, decided by `minRun`/`maxCell` declared at a call site it has
      // no relationship with. The two scopes then compose: page first, then
      // this reader's own per-sentence pass over the result.
      const fromPage = blankFurniture ? blankedSentence(pi, sentence) : null;
      const base = fromPage ?? sentence.text;
      const blanked = blankFurniture ? sentenceWithBlanking({ text: base }, blankFurniture) : base;
      return resolvePronouns ? sentenceWithPronouns({ ...sentence, text: blanked }, bindings, bestSurface) : blanked;
    };

    // Rewritten passages, whole-text — the SAME per-sentence-safe rewrites
    // `readSentenceText` computes, rejoined per passage. Two consumers need
    // a whole-passage blob rather than an address (vocabulary discovery, and
    // the assertion tier's own order-shuffle null below); neither needs
    // spans, so rejoining costs nothing and stays exactly as useful as the
    // old passage-wide rewrite was, without ever re-splitting anything.
    // `blanked` is aligned to the ORIGINAL text and must not ride onto an
    // object whose `text` has been rewritten — a later consumer re-reading
    // these would slice a copy that no longer lines up.
    const rewrittenPassages = list.map(({ blanked: _pageBlanked, ...p }, pi) => ({
      ...p,
      text: passageSentences[pi].map((_, si) => readSentenceText(pi, si)).join(" "),
    }));
    const text = rewrittenPassages.map((p) => p.text).join("\n\n");

    // The vocabulary is measured from THE MATERIAL — the answer is read with
    // the material's own verbs, because "supported" means the material could
    // have said it. Surfaces are the index's own established surfaces, so
    // vocabulary discovery and endpoint resolution see the same cast.
    const surfaces = [...new Set(index.events.map((e) => e.surface))];
    // SLOT is not CLASS (perceiver/text/wordclass.js's own header, and
    // relations.js's own after this pass): discoverRelationVocab has only
    // ever measured which token followed a surface, never whether that
    // token's FORM is grammatically a verb — measured live 2026-08-19, a
    // real turn's own extraction admitted "party" as a verb candidate
    // ("the Democratic —party→ ultimately contributed…") on slot evidence
    // alone; the real UD treebank says that form is 68.75% noun, 3% verb.
    // `posPriorFor` (optional, a zero-arg accessor — the SAME lazy pattern
    // app.js already uses for relationsFor/skillLibrary/callModel, because
    // the prior is fetched once, non-blocking, and may not have resolved
    // yet) returns a POSPrior@1 object or null; omitted or unresolved,
    // `vocabGrammar` stays empty and every edge's `grammar` field is null —
    // BYTE-IDENTICAL to before this existed. Never filters `verbs` — a
    // wider vocabulary can only widen what extractRelations HEARS, and
    // grammar disclosure must not narrow that; it only adds a caller-facing
    // fact about what was heard.
    const posPrior = organs.posPriorFor ? organs.posPriorFor() : null;
    // THE RECEIVED VERB WALL (2026-09-02, relations.js's subject walls): every
    // form the POS prior reads as verb-dominant (VERB or AUX at
    // GRAMMAR_MIN_SHARE, the same declared floor the vocabulary gate uses)
    // walls a subject's leftward walk. Asymmetric: a form here can only STOP
    // a subject, never admit an edge — measured need: "the poor thing became
    // quiet and fell" read subject "the poor thing became quiet and" because
    // "became" had not cleared this material's own vocabulary.
    const verbWall = posPrior?.forms
      ? new Set(Object.entries(posPrior.forms).filter(([, c]) => { const total = Object.values(c).reduce((a, b) => a + b, 0); return total > 0 && ((c.VERB ?? 0) + (c.AUX ?? 0)) / total >= GRAMMAR_MIN_SHARE; }).map(([f]) => f))
      : null;
    // The same prior's ADP-dominant forms, for the subject walk's chains.
    const adpositions = posPrior?.forms
      ? new Set(Object.entries(posPrior.forms).filter(([, c]) => { const total = Object.values(c).reduce((a, b) => a + b, 0); return total > 0 && (c.ADP ?? 0) / total >= GRAMMAR_MIN_SHARE; }).map(([f]) => f))
      : null;
    const vocabGrammar = new Map();
    let verbs = new Set();
    // How many DISTINCT surfaces each admitted verb followed — the
    // vocabulary measure's own candidates list, kept rather than dropped,
    // so an edge can disclose that its verb entered the vocabulary on the
    // strength of one surface (itself a single-witness assertion).
    const verbSurfaces = new Map();
    // How many candidates `discoverRelationVocab` NOMINATED, before any of
    // them cleared `MIN_SURFACES_PER_VERB` — distinct from `verbs.size`,
    // which only counts survivors. Found missing by the adversarial audit
    // of the sblgnt (Greek New Testament apparatus) specimen: `verbs: 0`
    // reads identically whether the candidate list was genuinely EMPTY (no
    // token ever followed a recurring surface — an apparatus/table/record-
    // block shape, not prose) or merely below the recurrence floor (real
    // candidates, just each seen once) — two different facts about the
    // material a caller could not tell apart from `vocabulary` alone.
    let candidateCount = 0;
    if (surfaces.length) {
      try {
        const discovered = discoverRelationVocab(text, {
          surfaces,
          functionWords,
          minSurfaces: MIN_SURFACES_PER_VERB,
          negationWords,
          ...(posPrior ? { posPrior, grammarMinShare: GRAMMAR_MIN_SHARE } : {}),
          // an OOV connector must be a known verb form to admit — the gate's own organ, never the widening one
          ...(posPrior && oovLexicon ? { verbForms: oovLexicon } : {}),
          ...(phrasalPredicates ? { phrasalPredicates } : {}),
        });
        verbs = discovered.verbs;
        candidateCount = discovered.candidates?.length ?? 0;
        for (const c of discovered.candidates ?? []) {
          verbSurfaces.set(c.verb, c.surfaces);
          if (posPrior && c.grammar) vocabGrammar.set(c.verb, c.grammar);
        }
      } catch {
        verbs = new Set();
        candidateCount = 0;
      }
    }

    // ── recurring forms: identity for a subject cast.js never names ──────
    // host/terrains.js's own Network-graph organ already measured the gap
    // this closes: a concept document's real vocabulary is made of
    // recurring content words, not proper names, and the cast ladder
    // starves on it. Reused here for IDENTITY, not for a new co-arrival
    // edge (that is a different question, with its own null test, that
    // this tier does not need) — a form is admitted the moment it recurs
    // at least FORM_MIN_ARRIVALS sentences, using the SAME functionWords
    // already measured above for vocabulary discovery, not a second
    // measure at a different scale (the exact drift hypergraph.js's own
    // header already warns material.js's functionWordSet invites at this
    // size). One arrival is a hapax, not a topic — no signal to trust as
    // an identity a claim's subject could stand on.
    let forms = new Set();
    try {
      const arrivals = new Map();
      for (const sentence of splitSentences(text)) {
        const sText = typeof sentence === "string" ? sentence : sentence?.text ?? "";
        for (const w of new Set(tokenize(sText))) {
          if (w.length < 3 || functionWords?.has(w)) continue;
          arrivals.set(w, (arrivals.get(w) ?? 0) + 1);
        }
      }
      forms = new Set([...arrivals.entries()].filter(([, n]) => n >= FORM_MIN_ARRIVALS).map(([w]) => w));
    } catch {
      forms = new Set();
    }

    // ── vocabulary widened by a received lexicon, gated on recurrence ────
    // Every recurring form (the SAME set just computed — one recurrence
    // measure, not two) that a received morphological resource marks as a
    // known verb surface form joins the vocabulary directly. Gated on
    // recurrence for the identical reason forms are gated for identity
    // above: a word seen once carries no signal that IT, in THIS
    // material, is acting as a verb rather than appearing in some other
    // role — the lexicon says the word CAN be a verb, recurrence is this
    // tier's own corroboration that it is doing real work here.
    // …and, when a POS prior is loaded, never a form the prior attests as
    // NON-verb-dominant: UniMorph lists every noun-verb conversion as a verb
    // form, so unfiltered widening on the real two-page ledger added 98
    // notes labelled battle / work / version / author / part / war. An OOV
    // form (no attestation) still widens — the lexicon is the only witness
    // it has, which is exactly the starvation case this widening exists for.
    if (verbForms) {
      const nonverbDominant = (w) => { const att = posPrior?.forms?.[w]; if (!att) return false; const total = Object.values(att).reduce((a, b) => a + b, 0); return total > 0 && ((att.VERB ?? 0) + (att.AUX ?? 0)) / total <= GRAMMAR_MIN_SHARE; };
      // a form that occurs CAPITALISED away from a sentence start more often
      // than it occurs lowercase is a surface, not an act: "Buzz" recurs in
      // every Apollo passage and UD attests "buzz" as a verb, so the widening
      // read `Armstrong and —buzz→ Aldrin` (measured 2026-09-02, S50). The
      // passage's own casing decides, no name list.
      const surfaceNotAct = (w) => {
        const cap = w[0].toUpperCase() + w.slice(1);
        const capped = (text.match(new RegExp(`(?<!^|[.!?]\\s+)\\b${cap}\\b`, "gu")) ?? []).length;
        const lower = (text.match(new RegExp(`\\b${w}\\b`, "gu")) ?? []).length;
        return capped > lower;
      };
      for (const w of forms) if (verbForms.has(w) && !nonverbDominant(w) && !surfaceNotAct(w)) verbs.add(w);
      // `organs.attestedVerbs` (declared, default off — byte-identical
      // otherwise): a form the RECEIVED prior attests as a verb joins the
      // vocabulary on its first arrival, not its second. The recurrence
      // gate above is what keeps UNSUPERVISED discovery honest — a word
      // seen once after one surface is not testimony. A prior-attested
      // verb has a giver already; on a one-page face "placed", "winched",
      // "retrieved" each arrive once and, gated, can never be an act, so
      // the face folds to `subject —were→ the rest of the sentence`.
      // Measured 2026-09-02 (eval/the-fold/note-match-zero.mjs, S50).
      if (attestedVerbs) {
        try {
          for (const sentence of splitSentences(text)) {
            const sText = typeof sentence === "string" ? sentence : sentence?.text ?? "";
            for (const w of new Set(tokenize(sText))) {
              if (w.length < 3 || functionWords?.has(w)) continue;
              if (!verbForms.has(w) || nonverbDominant(w) || surfaceNotAct(w)) continue;
              verbs.add(w);
            }
          }
        } catch { /* a segmenter refusal leaves the gated vocabulary as it was */ }
      }
    }

    // ── endpoint resolution ──────────────────────────────────────────────
    // An endpoint is read two ways at once, and both ride the comparison:
    // the REFERENTS it mentions (any established surface appearing in it,
    // word-bounded and folded, plus the index's own resolution of the whole
    // string, PLUS any recurring FORM it carries — namespaced `form:<word>`
    // so it is never mistaken for a real referent, disclosed on the claim
    // wherever one is the only reason a subject resolved at all) and its
    // content TOKENS (folded, function words dropped). Two endpoints match
    // when they share a referent or form, or — only when neither resolves
    // to either — when they share a content token. Referent/form identity
    // outranks bare token overlap because a name (or a material's own
    // recurring word) is a reference to something, never a byte sequence
    // (P11).
    const surfacePatterns = surfaces.map((s) => ({
      surface: s,
      re: new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(diaNorm(s))}(?:$|[^\\p{L}\\p{N}])`, "iu"),
    }));
    const referentsBySurface = new Map();
    for (const e of index.events) {
      if (!referentsBySurface.has(e.surface)) referentsBySurface.set(e.surface, new Set());
      referentsBySurface.get(e.surface).add(e.referent_id);
    }

    // `useForms` was true ONLY for a SUBJECT endpoint, and stayed that way
    // until this amendment, for a real, once-reproduced reason: the object
    // side's working, tested fallback (tokensShare, stem-tolerant) used to
    // be the ONLY thing catching a morphological variant ("transformation"
    // vs "transformations"), and giving each variant its OWN exact-token
    // form id made endpointsMatch take the stricter exact-id `intersects`
    // branch instead — reproduced live, 2026-08-19: "Pierre underwent
    // transformations" read UNBOUND against material stating only
    // "underwent a remarkable transformation," because both singular and
    // plural independently cleared FORM_MIN_ARRIVALS as DIFFERENT recurring
    // tokens. The fix is not "never extend identity to objects" — it is
    // "form identity was keyed by exact string, and exact string was never
    // the right granularity for identity any more than it was for verbs"
    // (this file's own `sameAct` amendment, same day, same organ, same
    // lesson: prefer canonical identity over surface shape wherever a real
    // equivalence resource exists). `formIdOf` groups a token with every
    // OTHER recurring form that is the SAME ACT as it (reusing `sameAct`
    // exactly as built for verbs — nothing verb-specific about it), and a
    // deterministic sort of the equivalence class, never a "canonical
    // lemma" claim, supplies the id. Gated on `createLemmatizer`: omitted,
    // `formIdOf` degrades to exact-token lookup, byte-identical to before
    // this amendment — which is also why OBJECT identity stays disabled
    // by default (`useForms` at the object call sites is `Boolean(createLemmatizer)`,
    // never unconditionally true): without a lemmatizer, extending forms to
    // objects would reintroduce the exact regression this paragraph
    // describes, so it doesn't happen without one.
    function formIdOf(t) {
      if (!createLemmatizer) return forms.has(t) ? t : null;
      let best = null;
      for (const w of forms) {
        if (w !== t && !sameAct(w, t)) continue;
        if (best === null || w < best) best = w;
      }
      return best;
    }

    function endpoint(str, useForms = false) {
      const referents = new Set(index.resolve(str));
      const folded = diaNorm(String(str ?? ""));
      for (const { surface, re } of surfacePatterns) {
        if (re.test(folded)) for (const id of referentsBySurface.get(surface)) referents.add(id);
      }
      // Named BEFORE any form id ever joins the set — captured here, after
      // both real resolution paths (index.resolve, surface mention) have
      // had their say, never earlier. Capturing it before the surface-
      // pattern loop was a real bug caught by this file's own new tests: a
      // subject like "Darwin" that resolves only through a SURFACE MENTION
      // (not index.resolve(str) alone) read as formOnly, which is false —
      // Darwin is a name, not a recurring word standing in for one.
      const named = referents.size > 0;
      const tokens = new Set();
      for (const t of folded.toLowerCase().split(/[^\p{L}\p{N}'’]+/u)) {
        if (t.length < 3) continue;
        if (functionWords?.has(t)) continue;
        // `organs.determiners` — OPTIONAL, a RECEIVED closed class with its
        // own named giver (the engine's own perceiver/text/priors.js
        // register: DEFINITE_DETERMINERS + INDEFINITE_DETERMINERS, giver
        // "lang/en"), never a word list typed here — the same discipline
        // widget.js's own router already holds, and the same reason
        // relations.js's header gives for having deleted its hand-listed
        // verb string. Omitted: byte-identical to every caller before this
        // pass, exactly like `verbForms`/`createLemmatizer` above.
        //
        // Why it exists at all, measured rather than reasoned about
        // (eval/reasoning-e2e-no-llm.mjs, second pass): the corpus-scale
        // filter above is `commonTerms`, which declares its own floor —
        // below CORPUS_MINIMUM chunks it returns nothing and simply does
        // not run (cite.js:122). That floor's disclosed residue is
        // "auxiliary noise in the vocabulary", which can only widen what
        // the reader HEARS. On the OBJECT side it does something the
        // disclosure never covered: `endpointsMatch` falls through to
        // `tokensShare`, one shared token is enough, and on sub-floor
        // material the shared token can be the determiner itself. Live,
        // against four sentences of real prose stating only "Seward
        // negotiated the Alaska purchase": "Seward negotiated the Suez
        // canal" came back BOUND, while "Seward negotiated Suez canal"
        // (same claim, no article) came back unbound — the definite
        // article was the entire binding. That is a fabricated edge, not
        // widened hearing, and the floor's own disclosure does not reach
        // it.
        if (determiners?.has(t)) continue;
        tokens.add(t);
      }
      // A form only ever ADDS a way to resolve — it never overrides a real
      // referent, and its own ids never merge with a real referent's id
      // space (the `form:` prefix, checked against P11 nowhere colliding
      // with cast.js's own referent_id shape).
      if (useForms) for (const t of tokens) { const id = formIdOf(t); if (id) referents.add(`form:${id}`); }
      const formOnly = !named && referents.size > 0;
      return { text: String(str ?? ""), referents, tokens, formOnly };
    }

    // The four ways an endpoint can come back from `endpoint()`, named once
    // so no caller has to re-derive them from the shape of the returned
    // object: "referent" — it resolved to a referent this material itself
    // established (index.resolve, or a real surface mention); "form" — it
    // resolved only through a recurring-form id (the `form:` namespace,
    // never a cast referent); "tokens" — it resolved to nothing, and the
    // only thing available to compare it with is its own content words;
    // "none" — not even that.
    const resolutionOf = (end) =>
      end.formOnly ? "form" : end.referents.size ? "referent" : end.tokens.size ? "tokens" : "none";

    // The canonical face of an end that resolved to exactly one real
    // referent — the Station-3 identity handed to Station-4 consumers.
    const faceOf = (end) => {
      const real = [...end.referents].filter((id) => !String(id).startsWith("form:"));
      if (!real.length) return null;
      const faces = [...new Set(real.map((id) => index.represent?.(id)).filter(Boolean))];
      if (faces.length === 1) return faces[0];
      if (!faces.length) return null;
      // FRAGMENTS OF ONE BEING, told apart from GENUINE AMBIGUITY by the
      // same address-containment rule the cast's own folds earned
      // (referent-fold.js): at passage scale, "Van Helsing" resolves to
      // van_helsing AND the fragment referents van / helsing — three ids,
      // one being — and the first cut of this function returned null for
      // exactly that reason on EVERY named subject (measured: 0.0% faces
      // on 7,050 edges, the wire dark the hour it was built). Every face
      // word-contained in the longest = one fragmented being, and the
      // longest face is its fullest name. Faces that do NOT nest ("Jonathan
      // and Mina" hitting two unrelated beings) stay null — a disclosed
      // ambiguity, never a coin flip.
      const longest = [...faces].sort((a, b) => b.length - a.length)[0];
      const fl = diaNorm(longest);
      const nested = faces.every(
        (f) => f === longest || new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(diaNorm(f))}(?:$|[^\\p{L}\\p{N}])`, "iu").test(fl),
      );
      return nested ? longest : null;
    };

    // A span whose FIRST token is a received negation word is a span whose
    // POLARITY WAS NEVER MEASURED (added 2026-08-25 — POLICIES.md P43).
    //
    // `extractRelations`'s own polarity gate is `negationBeforeVerbFor`: the
    // negation word must sit BEFORE the verb it negates. When it does not,
    // the extractor does not fail loudly — it silently reads a DIFFERENT
    // clause, and the negation ends up leading the object span while the
    // triple's own `polarity` stays "+". Two shapes produce this, both
    // measured live on real prose:
    //
    //   "Seward did not negotiate X"   -> Seward —did[+]→ not negotiate X
    //   "Seward negotiated not X"      -> Seward —negotiated[+]→ not X
    //
    // Left alone, that is not a missed contradiction — it is an INVERTED
    // one wearing a real address. Measured, against material whose only
    // relevant sentence is "Lincoln did not dismiss Seward":
    // `"Lincoln did dismiss Seward"` came back BOUND, cited to that very
    // passage. Both ends had mis-parsed identically, so they matched, and
    // neither end's polarity had been read at all.
    //
    // The rule is therefore symmetric — claim side AND material-edge side —
    // and it WITHHOLDS rather than flips: this file does not know what the
    // polarity should have been, only that nothing measured it. Flipping
    // would assert a reading no organ earned; `beyond-reach` says exactly
    // what happened, and (per relationFindings's own standing rule) never
    // counts against the answer. Over-firing is safe by construction for
    // the same reason; the FIRST-token gate keeps it narrow anyway, since
    // that is precisely the position the mis-parse puts the word in — a
    // negation deeper inside an object ("the treaty but not the purchase")
    // is a different, real, still-unaddressed construction, not this one.
    //
    // Gated on `organs.negationWords` — a RECEIVED closed class with its own
    // named giver (the engine's own perceiver/text/priors.js NEGATION_WORDS,
    // giver "lang/en"), never a word list typed here. Omitted: byte-identical
    // to every caller before this pass.
    const firstToken = (str) => {
      const folded = diaNorm(String(str ?? "")).toLowerCase();
      for (const t of folded.split(/[^\p{L}\p{N}'’]+/u)) if (t) return t;
      return "";
    };
    //
    // Reads the caller's own per-call `negationWords` when one was declared
    // (it is the class `extractRelations` itself was handed for THIS read),
    // and the injected organ otherwise — one class, never two that could
    // disagree about what a negation is on opposite sides of the same read.
    const negationInUse = negationWords ?? negationClass;
    const negationLed = (str) => Boolean(negationInUse?.has(firstToken(str)));
    // Same shape as `negationLed` above, one closed class over (S96 / the-fold
    // P180): a span whose FIRST token is a received first-person pronoun is a
    // span whose REFERENT WAS NEVER ESTABLISHED, because "I"/"my"/"our"/"we"
    // name whoever is speaking, not a stable entity two different documents
    // could both be talking about. See `judge()`'s own wall for the full
    // account and the measured specimen it closes.
    const firstPersonLed = (str) => Boolean(firstPerson?.test?.(firstToken(str)));
    // THE DENIAL, READ (S69 / the-fold P104). Two shapes the extractor
    // produced left a negation where no comparison could meet it — P43
    // named them and this tier refused them as "polarity never measured":
    //   "never opened in 1889"  → act "never opened", polarity "-" (DR5 folds
    //                              the adverb into the act, so `opened` never
    //                              meets it)
    //   "did not repair X"      → act "did", object "not repair X", polarity
    //                              "+" (the aux chain broke on the negation)
    // Both are one act under a negation. Folded here, once, for the material
    // side and the claim side alike: a received negation word LEADING the act
    // is removed and the polarity is "-"; a received negation word leading
    // the OBJECT after an AUX-dominant act (the POS prior's own AUX share)
    // whose next token is a verb the vocabulary or the prior attests becomes
    // that verb, polarity "-", with the rest as the object. Nothing here is
    // a hand list: the negation class and the AUX/VERB shares are received.
    // A shape neither rule fits keeps P43's typed refusal, unchanged.
    const posPriorNow = organs.posPriorFor ? organs.posPriorFor() : null;
    const shareOf = (w, tags) => { const att = posPriorNow?.forms?.[String(w).toLowerCase()]; if (!att) return null; const total = Object.values(att).reduce((a, b) => a + b, 0); return total > 0 ? tags.reduce((a, k) => a + (att[k] ?? 0), 0) / total : null; };
    const auxDominant = (w) => grammarIsDominant(shareOf(w, ["AUX"]) ?? 0);
    const verbAttested = (w) => { const lw = String(w).toLowerCase(); return verbs.has(lw) || Boolean(organs.verbForms?.has?.(lw)) || grammarIsDominant(shareOf(lw, ["VERB", "AUX"]) ?? 0); };
    // THE ARRANGEMENT IS THE CONTRACT (Chomsky, 2026-09-20 — the language-
    // universality archon): the reader's constructed edges and claims carry
    // ONLY the earned names end1/label/end2, and a raw extractor triple may
    // arrive in EITHER the legacy SVO shape ({subject, verb, object} —
    // the legacy engine relations.js) or the neutral shape ({end1, label, end2,
    // cell, grain} — the language dispatch's GFP and positional readers).
    // `endOf` reads the arrangement first and falls back to the legacy
    // names, so the fold can inject the dispatch's neutral extractors and
    // this tier never has to know which extractor produced the triple.
    const end1Of = (t) => t?.end1 ?? t?.subject;
    const labelOf = (t) => t?.label ?? t?.verb;
    const end2Of = (t) => t?.end2 ?? t?.object;
    const foldNegation = (t) => {
      if (!negationInUse || !t) return t;
      const vt = String(labelOf(t) ?? "").trim().split(/\s+/).filter(Boolean);
      if (vt.length > 1 && negationInUse.has(vt[0].toLowerCase())) {
        return { ...t, [labelOf(t) === undefined ? "verb" : "label"]: vt.slice(1).join(" "), polarity: "-", negationFolded: "act" };
      }
      const ot = String(end2Of(t) ?? "").trim().split(/\s+/).filter(Boolean);
      if (ot.length > 2 && negationInUse.has(ot[0].toLowerCase()) && vt.length && auxDominant(vt[vt.length - 1]) && verbAttested(ot[1])) {
        return { ...t, [labelOf(t) === undefined ? "verb" : "label"]: ot[1], [end2Of(t) === undefined ? "object" : "end2"]: ot.slice(2).join(" "), polarity: "-", negationFolded: "object" };
      }
      return t;
    };

    const stemEq = (a, b) =>
      a === b || (Math.min(a.length, b.length) >= MIN_STEM && (a.startsWith(b) || b.startsWith(a)));
    const intersects = (a, b) => {
      for (const x of a) if (b.has(x)) return true;
      return false;
    };
    const tokensShare = (a, b) => {
      for (const x of a) for (const y of b) if (stemEq(x, y)) return true;
      return false;
    };
    const endpointsMatch = (a, b) => {
      if (a.referents.size && b.referents.size) return intersects(a.referents, b.referents);
      if (a.referents.size || b.referents.size) {
        // One side names a referent and the other does not — fall through to
        // tokens: "the young count" cannot resolve, but may still share a
        // content token with what the material captured.
        return tokensShare(a.tokens, b.tokens);
      }
      return tokensShare(a.tokens, b.tokens);
    };

    // ── the material's edges, each with every address that states it ─────
    // Existing edges are bucketed by an EXACT, cheap key (verb + polarity —
    // never a guessed match, so no edge can hide from its own bucket) so the
    // fuzzy endpointsMatch scan below only ever runs over edges that already
    // share a verb, not the whole graph. Same organ emergence/graph.js
    // already earned for full-document scale (`edgeKey`, a Map-keyed belief
    // graph) — that module expects pre-resolved referent ids as its identity
    // and this tier's identity is fuzzier (referent-or-token, via
    // endpointsMatch), so its exact key is reused for the bucket a verb's
    // edges live in, and the fuzzy match still decides membership WITHIN
    // that bucket. Found by running: a linear `.find()` over the full edge
    // list, per triple, is O(triples x edges) — quadratic — and was never
    // exercised past a turn's handful of retrieved passages before a
    // full-novel eval (eval/crosslingual-eval.mjs) ran it over 11,132
    // passages and did not finish in ten minutes. Bucketing changes nothing
    // about WHICH edges merge — endpointsMatch's own verdict is unchanged,
    // pinned by the existing hypergraph.test.mjs corroboration cases — only
    // how many candidates are checked to find out.
    const edges = [];
    const bucketOf = (verb, polarity) => `${verb}|${polarity}`;
    const buckets = new Map();
    // EXTRACTION IS PER SENTENCE, AND EVERY EDGE CARRIES THE BYTES THAT MADE
    // IT (2026-08-27, user direction: "they should carry the exact bytes that
    // produced them if we're doing the hypergraph right").
    //
    // This file used to call `extractRelations` on a whole passage and keep
    // only `p.ref` — passage grain. Every other addressed thing in this repo
    // is byte-exact and self-verifying (P5.2, mandatory: 11,132/11,132 on War
    // and Peace), so the one tier that makes CLAIMS about the material was
    // also the one tier that could not say which bytes it read them from.
    //
    // Measured before adopting, on the three real pages the live app fetched
    // (161k/182k/56k chars): sentence offsets self-verify 1,606/1,606 against
    // the passage's own bytes; per-passage extraction found 2,314 edges,
    // per-sentence 2,289 — 48 lost, 23 gained. Every sampled LOST edge is
    // cross-boundary garbage ("content —from→ wikipedia", "free encyclopedia
    // —president→ of", and several carrying a literal newline inside the
    // subject: "1869\n\n17th —president→ of", "tailor\n\nsignature —military→
    // service\nbranch"), i.e. the P38 infobox-gluing class, now excluded
    // STRUCTURALLY rather than by widening blankFurniture again. The gained
    // ones are real ("16th vice —president→ of", "15th governor —of→
    // tennessee").
    //
    // THE ADDRESS IS INTO THE ORIGINAL MATERIAL, NEVER THE REWRITTEN COPY.
    // `origin` below is `passageSentences[pi][si]` — the ONE, ONLY split of
    // this passage's text this whole function ever computes, off the
    // author's own bytes, before any rewrite. It always exists, for every
    // sentence, unconditionally (no `paired` boolean, no null-span fallback
    // — the count-pairing wall this section used to carry is gone because
    // there is no second split of anything for it to disagree with; see
    // `readSentenceText` above). The extractor reads the LOCALLY-rewritten
    // sentence (a pronoun subject still resolves, table furniture still
    // blanks); the span addresses the untouched original sentence it came
    // from, exactly, every time.
    for (let pi = 0; pi < list.length; pi++) {
      const p = list[pi];
      const originalSentences = passageSentences[pi];
      for (let si = 0; si < originalSentences.length; si++) {
        const sentenceText = readSentenceText(pi, si);
        let triples = [];
        try {
          // THE GATE IS THE EXTRACTOR'S (Chomsky, 2026-09-20): a legacy
          // vocabulary-gated extractor needs `verbs` before it can emit;
          // a dispatch extractor (relations-language.js — GFP or a
          // measured RoleConfig@1) is self-gating by design and DELIBERATELY
          // returns an empty vocabulary (`discoverGfpVocabulary` says so in
          // its own header; the SVO mode's vocabulary is empty because the
          // positional reader assigns roles from the config, not from a
          // word list). Gating those on `verbs.size` would silence the
          // reader entirely — so a caller that injected dispatch extractors
          // declares `extractorsMode: "dispatch"` and the gate falls open.
          triples = verbs.size || extractorsMode === "dispatch"
            ? extractRelations(sentenceText, {
                verbs,
                functionWords,
                negationWords,
                ...(extractorsMode === "dispatch" ? { figures: new Set(surfaces.map((x) => String(x).toLowerCase())) } : {}),
                ...(phrasalPredicates ? { phrasalPredicates } : {}),
                ...(nounPhraseSubjects ? { nounPhraseSubjects, ...(verbWall ? { verbWall } : {}), ...(adpositions ? { adpositions } : {}) } : {}),
              })
            : [];
        } catch {
          triples = [];
        }
        if (!triples.length) continue;
        const origin = originalSentences[si];
        const span =
          origin && p.ref
            ? { ref: p.ref, start: origin.offset, end: origin.offset + origin.text.length, text: origin.text }
            : null;
        for (const t0 of triples) {
        const t = foldNegation(t0);
        const subjectEnd = endpoint(end1Of(t), true);
        const objectEnd = endpoint(end2Of(t), Boolean(createLemmatizer));
        const bucketKey = bucketOf(labelOf(t), t.polarity);
        let bucket = buckets.get(bucketKey);
        if (!bucket) buckets.set(bucketKey, (bucket = []));
        const existing = bucket.find(
          (e) => endpointsMatch(e.subjectEnd, subjectEnd) && endpointsMatch(e.objectEnd, objectEnd),
        );
        if (existing) {
          if (!existing.refs.includes(p.ref)) existing.refs.push(p.ref);
          // Statement grain, not passage grain: a restatement inside one
          // passage is a second witness too. (Exact repeats within one
          // passage dedupe inside extractRelations itself — that residue
          // is the extractor's, disclosed here rather than papered over.)
          existing.statements += 1;
          // Every sentence that states this edge, not just the first: an
          // edge stated three times has three addresses, and which one a
          // reader is shown should be their choice, not extraction order's.
          if (span && !existing.spans.some((x) => x.ref === span.ref && x.start === span.start)) {
            existing.spans.push(span);
          }
        } else {
          const fresh = {
            // THE WIPE (2026-09-02, P76 finished): constructed edges and
            // claims carry ONLY the earned names — end1/label/end2, via
            // arrangementOf. Raw extractor triples (`t.*`) keep the
            // extractor's own shape; the rename is of what this tier
            // BUILDS, not of what it receives.
            ...{ end1: end1Of(t), label: labelOf(t), end2: end2Of(t) },
            polarity: t.polarity,
            subjectEnd,
            objectEnd,
            // THE STATION-3->4 WIRE (2026-09-01, "What Is Being Born" §VI:
            // the single highest-leverage unbuilt wire). endpoint() already
            // resolves an end against the material's own earned referent
            // index — by exact resolution AND by surface CONTAINMENT inside
            // the end span (the same address-containment rule the cast's
            // own folds earned) — but the public edge never carried what it
            // found, so every downstream identity (the hyperlexicon door
            // above all) re-keyed on raw strings. `end1Face`/`end2Face` is
            // the canonical face when the end resolved to EXACTLY ONE real
            // referent; two referents is a disclosed ambiguity and a form
            // is not a being, so both stay null — never a coin flip.
            // Measured headroom on the whole of Dracula before building:
            // subjects that ARE a known surface 7.5%; subjects CONTAINING
            // one, 18.5%.
            end1Face: faceOf(subjectEnd),
            end2Face: faceOf(objectEnd),
            refs: [p.ref].filter(Boolean),
            // The bytes this edge was read from. Empty only when the
            // sentence pairing above refused — never a guessed address.
            spans: span ? [span] : [],
            statements: 1,
          };
          edges.push(fresh);
          bucket.push(fresh);
        }
        }
      }
    }

    // ── the assertion tier: the extractor's own claim, support disclosed ─
    // Standing and statement count are always on (they cost a lookup); the
    // word-salad arm runs only when the caller declares its resolution.
    for (const e of edges) {
      e.assertion = {
        standing: standingOf(e.statements),
        statements: e.statements,
        verbSupport: verbSurfaces.get(e.label) ?? 0,
      };
    }

    // ── the connector-class tier: grammar-lens.js's own classification,
    // now at EXTRACTION TIME (Per-Source Testimony spec, BUILD-3) instead
    // of capacity-runner.js's old post-hoc `checkConnectorClass` call —
    // see this organ pair's own header above for why `connectorClass` is a
    // separate field from `grammar` two tiers up, not a rename of it.
    // Optional and additive, the identical posture `assertion` just above
    // already holds: omitted, no edge carries `connectorClass` and every
    // existing caller is byte-identical. `classifyConnector`'s own declared
    // contract takes the whole edge (grammar-lens.js's header — today it
    // reads only `edge.verb`, but the signature is edge-shaped so a future
    // version could read more without a call-site change), so it is called
    // here the same way capacity-runner.js's own pre-BUILD-3 direct call
    // already did.
    if (classifyConnector) {
      for (const e of edges) {
        e.connectorClass = classifyConnector(e, { minShare });
      }
    }

    if (assert && edges.length) {
      // The arm re-hears the SAME material with each sentence's words
      // shuffled, through the SAME vocabulary-bound extraction — never a
      // re-measured vocabulary, never a second extractor. Matching a
      // shuffled-copy triple to an edge uses the same endpointsMatch the
      // edges themselves were folded with (one implementation of "the same
      // edge"), on shape only — polarity under shuffle is noise by
      // construction (the negation window is an order fact).
      const arm = orderArm({
        passages: rewrittenPassages,
        splitSentences,
        extract: (t) =>
          extractRelations(t, {
            verbs,
            functionWords,
            negationWords,
            ...(phrasalPredicates ? { phrasalPredicates } : {}),
            ...(nounPhraseSubjects ? { nounPhraseSubjects, ...(verbWall ? { verbWall } : {}), ...(adpositions ? { adpositions } : {}) } : {}),
          }),
        draws: assert.draws,
        seed: assert.seed ?? 0,
      });
      const endpoints = new Map(); // per sample triple, computed once
      const endFor = (str) => {
        if (!endpoints.has(str)) endpoints.set(str, endpoint(str));
        return endpoints.get(str);
      };
      for (const e of edges) {
        let fired = 0;
        for (const sample of arm.samples) {
          if (
            sample.some(
              (t) =>
                labelOf(t) === e.label &&
                endpointsMatch(endFor(end1Of(t)), e.subjectEnd) &&
                endpointsMatch(endFor(end2Of(t)), e.objectEnd),
            )
          )
            fired++;
        }
        e.assertion.orderArm = { draws: arm.draws, fired, seed: arm.seed };
      }
    }

    const corroboration = (refs) => ({
      passages: refs.length,
      sources: [...new Set(refs.map(sourceOf).filter(Boolean))].length,
    });

    // The mirror of P32's slot competition (added 2026-08-19, user
    // direction after a live conversation asked "who was his vice
    // president?" of a person with two: "he had 2 vice presidents,
    // sometimes the question isn't formed very well"). P32 counts how many
    // DISTINCT SUBJECTS fill one verb+object slot; this counts how many
    // DISTINCT OBJECTS one subject+verb binds — the Russellian uniqueness
    // clause a definite description presupposes ("the F is G" requires not
    // just that an F exists, Strawson's clause the presupposition-failure
    // gate already enforces, but that there is EXACTLY ONE F). A claim
    // whose subject+verb binds only one object answers a well-posed
    // question; one that binds several means the QUESTION under-specified
    // which the material actually has more than one of — the answer is not
    // wrong, the question's own presupposition was never checked.
    function clusterFillers(sameSubjVerbEdges) {
      const clusters = [];
      for (const e of sameSubjVerbEdges) {
        const found = clusters.find((c) => endpointsMatch(c.objectEnd, e.objectEnd));
        if (found) {
          found.refs.push(...e.refs);
          if (!found.polarities.has(e.polarity)) found.polarities.add(e.polarity);
        } else {
          clusters.push({ object: e.end2, objectEnd: e.objectEnd, refs: [...e.refs], polarities: new Set([e.polarity]) });
        }
      }
      return clusters.map((c) => ({ object: c.object, refs: [...new Set(c.refs)], polarity: c.polarities.size > 1 ? "±" : [...c.polarities][0] }));
    }

    // ── one claim, one typed verdict ─────────────────────────────────────
    function judge(sentence, t) {
      const claim = {
        sentence,
        ...{ end1: end1Of(t), label: labelOf(t), end2: end2Of(t) },
        polarity: t.polarity,
        // Same disclosure edgeFace carries, at claim scale: whether the
        // connector position the answer used is grammatically plausible as
        // a verb, per real treebank evidence — null when no posPrior ran.
        grammar: vocabGrammar.get(labelOf(t)) ?? null,
      };
      // A claim built on a word that is not grammatically a verb is not a
      // proposition to check at all — the SAME gate as an unresolved
      // subject, one line down, and typed the same way. Measured live
      // 2026-08-19: "Lincoln's vice president was Hannibal Hamlin" put
      // "vice" in the verb slot (the token right after the possessive-
      // marked surface "Lincoln's"), and the resulting claim — "vice
      // president was Hannibal Hamlin" — correctly found no matching
      // edge and shipped a confident-looking "∅ not in the material" badge
      // on an answer that was, in fact, fully grounded. The claim was
      // never real; only the badge was. Gated on `found` (never on a
      // word the treebank has no opinion about) and reuses beyond-reach's
      // own wording ("a limit of this check, not a mark against the
      // answer") because that is exactly what this is — never rendered as
      // a badge (app.js only badges contradicted/unbound). Checked BEFORE
      // endpoint resolution: a claim built on a bogus verb gets no benefit
      // from knowing whether its subject/object would otherwise resolve.
      if (claim.grammar?.found && claim.grammar.plausibleAsVerb === false) {
        const { dominant } = claim.grammar;
        return {
          ...claim,
          verdict: "beyond-reach",
          reason: `“${labelOf(t)}” is not grammatically a verb here — real usage says ${dominant.thraxClass} (${Math.round(dominant.share * 100)}% of the time) — a limit of this extraction, not a mark against the answer`,
        };
      }
      // FIRST-PERSON DEIXIS (added 2026-09-09 — POLICIES.md P180 / READING-
      // SPEC S96). "My favorite color", "I painted the wall", "our record"
      // — a first-person subject's referent is WHOEVER IS SPEAKING, never a
      // stable entity this tier can key on. Two different authored texts
      // that each use "my" are never, by default, talking about the same
      // "I" — the referent-model-not-pointers failure class this whole
      // tier exists to avoid, one register in: SVO structural matching
      // cannot see WHO utters a pronoun, only that the tokens are
      // identical. Measured live: a model's own first-person answer ("My
      // favorite color is blue. It reminds me of the sky…") came back
      // `bound`, cited to a generic ESL "10 sentences about my favorite
      // color" example page — because "favorite color" and "blue" both
      // recur as FORMS in that unrelated material (`endpoint()`'s own
      // `useForms` path), so the claim's subject and the page's subject
      // resolved to the SAME recurring-form identity despite naming two
      // entirely different speakers' favorite colors.
      //
      // Checked on the RAW subject string, before any endpoint resolution
      // — a first-person subject must never bind via token/form identity
      // at all, regardless of which path (named referent, recurring form,
      // or bare content-word overlap) would otherwise have granted it.
      // `candidateEdges` narrows what the REST of this function may match
      // against; every other subject shape leaves it as the full edge set,
      // byte-identical to before this pass.
      let candidateEdges = edges;
      if (firstPersonLed(end1Of(t))) {
        candidateEdges = sameSpeakerRef ? edges.filter((e) => (e.refs ?? []).some(sameSpeakerRef)) : [];
        if (!candidateEdges.length) {
          return {
            ...claim,
            verdict: "beyond-reach",
            reason: `“${end1Of(t)}” is a first-person claim — “I”/“my” names whoever is speaking, not a stable entity — and nothing here shows this answer and the material share a speaker; comparing them would treat two different people's “I” as one claim — a limit of this check, not a mark against the answer`,
          };
        }
      }
      const subj = endpoint(end1Of(t), true);
      const obj = endpoint(end2Of(t), Boolean(createLemmatizer));
      // Disclosed on EVERY claim, whatever the verdict — a bound claim
      // resting on a recurring-form subject ("Butterflies") is real, but
      // it is not the same strength of fact as one resting on a named
      // referent ("Pierre Bezukhov"), and a reader comparing two "bound"
      // claims should be able to tell which is which (P11). Subject-only:
      // `obj` is never built with forms (see endpoint()'s own comment), so
      // `obj.formOnly` is always false and is not read here.
      claim.formBased = Boolean(subj.formOnly);
      // HOW each endpoint resolved, disclosed on EVERY claim that gets far
      // enough to have endpoints at all — additive, never a gate, and never
      // read by anything in this function's own verdict arithmetic.
      //
      // Why it has to be carried rather than inferred: `beyond-reach` is the
      // only signal a downstream reader had for "an endpoint did not
      // resolve," and `beyond-reach` gates on the SUBJECT (one line below)
      // plus the narrow case of an object carrying neither referent nor
      // content word. An object that resolves to NO referent but does carry
      // a content word never touches that gate — it falls through to
      // `endpointsMatch`'s own `tokensShare` branch, which is a deliberate
      // and correct design (an object is very often a description, "the
      // Alaska purchase", not a name) but which means the ABSENCE of
      // beyond-reach licenses nothing at all about the object. Inferring
      // "both endpoints resolved" from it is reading a check that never ran
      // — measured live 2026-08-19 by eval/reasoning-e2e-no-llm.mjs, where
      // "Lincoln appointed Napoleon" (Napoleon nowhere in the material) came
      // back `unbound`, and verification.js's Existence/Entity cell reported
      // `holds — subject and object both resolve to referents this material
      // establishes` about a name the material has never heard of.
      //
      // Also supersedes the paragraph directly above on one point of fact:
      // it says `obj.formOnly` "is always false", which was true only before
      // object-side form identity was enabled under a lemmatizer (this
      // file's own 2026-08-19 amendment, `endpoint(t.object,
      // Boolean(createLemmatizer))` two lines up). `claim.formBased` stays
      // subject-only, exactly as documented and tested; the object's own
      // mode is carried here instead of quietly widening that field.
      claim.endpoints = { subject: resolutionOf(subj), object: resolutionOf(obj) };
      if (!subj.referents.size) {
        return {
          ...claim,
          verdict: "beyond-reach",
          reason: `“${end1Of(t)}” doesn't resolve to anyone or anything this material establishes — a limit of this check, not a mark against the answer`,
        };
      }
      // Claim side of the polarity-never-measured rule (see `negationLed`).
      // Checked here rather than before endpoint resolution because the
      // `endpoints` disclosure above is still true and still worth carrying
      // on a claim this tier is about to decline.
      if (negationLed(end2Of(t))) {
        return {
          ...claim,
          verdict: "beyond-reach",
          reason: `the negation in “${end2Of(t)}” landed inside the object, not before the verb — this claim's polarity was never measured, so it is not one this tier can check; a limit of this extraction, not a mark against the answer`,
        };
      }
      const sameSubjVerb = candidateEdges.filter(
        (e) => sameAct(e.label, labelOf(t)) && intersects(e.subjectEnd.referents, subj.referents),
      );
      // Computed once, attached to every verdict below that reaches this
      // point — a reader needs cardinality regardless of whether THIS
      // specific claim happened to bind. Singular (0 or 1 distinct
      // fillers) is the ordinary, unremarked case and carries nothing extra.
      const fillers = clusterFillers(sameSubjVerb);
      const cardinality = fillers.length > 1 ? { fillers } : {};
      const matched = sameSubjVerb.filter((e) => endpointsMatch(e.objectEnd, obj));
      // Material side of the same rule. An edge whose own object span is
      // negation-led carries a polarity nothing measured, so it may not
      // decide this claim either way — `every`, not `some`: a clean edge
      // sitting beside an unmeasured one still binds on its own merits.
      const matching = matched.filter((e) => !negationLed(e.end2));
      if (matched.length && !matching.length) {
        return {
          ...claim,
          verdict: "beyond-reach",
          reason: `the only passage the material offers here states this with the negation inside its own object span, so its polarity was never measured — this tier cannot say whether it agrees or disagrees; a limit of this extraction, not a mark against the answer`,
          nearest: matched.slice(0, NEAREST_EDGES_MAX).map(edgeFace),
        };
      }
      if (matching.length) {
        const agree = matching.filter((e) => e.polarity === t.polarity);
        const oppose = matching.filter((e) => e.polarity !== t.polarity);
        // `objectSpecificity`: of the agreeing edges, keep those whose object
        // states every content token of the claim's object (stem-tolerant,
        // the same `stemEq` tokensShare uses). A claim that agrees with edges
        // on subject and act but whose object no edge states in full is
        // `unbound` with those edges named as nearest — never a silent bind
        // on one shared word.
        const specific = objectSpecificity
          ? agree.filter((e) => [...obj.tokens].every((x) => [...e.objectEnd.tokens].some((y) => stemEq(x, y))))
          : agree;
        if (objectSpecificity && agree.length && !specific.length) {
          return {
            ...claim,
            verdict: "unbound",
            reason: `object_unspecific: the material states this subject and act, but no passage states the whole of “${end2Of(t)}” — only part of it`,
            nearest: agree.slice(0, NEAREST_EDGES_MAX).map(edgeFace),
            ...cardinality,
          };
        }
        if (specific.length) {
          const refs = [...new Set(specific.flatMap((e) => e.refs))];
          return {
            ...claim,
            verdict: "bound",
            refs,
            // THE EXACT BYTES THAT BOUND IT, carried onto the claim and not
            // left on the edge. `refs` names the passage; `spans` names the
            // sentence, byte-addressed and self-verifying. Without this a
            // caller wanting to show a reader (or a model) what a claim
            // actually rests on has only a whole chunk to offer, which is
            // how page furniture — "'President Lincoln' and 'Mr. Lincoln'
            // redirect here" — reached a prompt as though it were evidence.
            spans: (() => {
              const seen = new Set();
              const out = [];
              for (const e of specific) {
                for (const sp of e.spans ?? []) {
                  const k = `${sp.ref}#${sp.start}-${sp.end}`;
                  if (seen.has(k)) continue;
                  seen.add(k);
                  out.push(sp);
                }
              }
              return out;
            })(),
            corroboration: corroboration(refs),
            // The material stating BOTH polarities is a fact worth carrying,
            // never averaged away: divergence between perspectives is a
            // signal, not noise to smooth.
            ...(oppose.length ? { contested: [...new Set(oppose.flatMap((e) => e.refs))] } : {}),
            ...cardinality,
          };
        }
        const refs = [...new Set(oppose.flatMap((e) => e.refs))];
        return {
          ...claim,
          verdict: "contradicted",
          refs,
          corroboration: corroboration(refs),
          bound: oppose.slice(0, NEAREST_EDGES_MAX).map(edgeFace),
          ...cardinality,
        };
      }
      if (!obj.referents.size && !obj.tokens.size) {
        return {
          ...claim,
          verdict: "beyond-reach",
          reason: `“${end2Of(t)}” carries nothing comparable — no name and no content word — a limit of this check, not a mark against the answer`,
        };
      }
      // No edge binds this claim. Show what the material DOES bind around
      // it: same subject and verb first (what the subject actually did),
      // then same verb and object (who actually did this to the object).
      const sameVerbObj = candidateEdges.filter(
        (e) => sameAct(e.label, labelOf(t)) && !sameSubjVerb.includes(e) && endpointsMatch(e.objectEnd, obj),
      );

      // Slot competition (P32's named follow-up, added 2026-08-19): the
      // material may bind this EXACT verb+object to a DIFFERENT subject —
      // "the Pirates won the 1960 World Series" against a claim of "the
      // Yankees won the 1960 World Series". A byte check cannot see this
      // (every word is in the material); the subject+verb match above
      // cannot either (the subjects differ, so no edge is found there).
      // Gated, never assumed: the object must resolve to a REFERENT this
      // material itself established (a shared token alone — "the museum"
      // in "visited the museum" — proves nothing about exclusivity), and
      // EVERY edge sharing this verb+object must point to the SAME other
      // subject — the material's own evidence that the slot has one
      // filler, not a verb's meaning guessed at. A slot the material shows
      // filled by two or more DIFFERENT subjects (co-champions, shared
      // authorship) stays silently unbound; competing is only ever
      // computed FROM edges, never from what a verb like "won" implies.
      let competing = null;
      if (obj.referents.size && sameVerbObj.length) {
        // A referent alone is not enough when a NUMBER rides the object —
        // measured live 2026-08-19: "the World Series" as a recurring
        // surface resolved one referent across an article's every mention
        // of it regardless of year, so a claim about the 1960 series
        // competed against a bound "…won the World Series in 1971" edge —
        // sourced, but answering a different question. The same P31
        // discipline ("a number is grounded by the company it keeps") gates
        // here: when BOTH the claim's object and a candidate edge's object
        // carry a number, they must share one, or the candidate is not
        // eligible to compete for this slot at all.
        const claimNums = numberSet(end2Of(t));
        const numbersAgree = (e) => {
          const edgeNums = numberSet(e.end2);
          if (!claimNums.size || !edgeNums.size) return true; // nothing to disagree about
          for (const n of claimNums) if (edgeNums.has(n)) return true;
          return false;
        };
        const eligible = sameVerbObj.filter(numbersAgree);
        if (eligible.length) {
          const oneSubject = eligible[0].subjectEnd.referents;
          const oneFiller = eligible.every((e) => intersects(e.subjectEnd.referents, oneSubject));
          if (oneFiller) {
            const refs = [...new Set(eligible.flatMap((e) => e.refs))];
            competing = { ...edgeFace(eligible[0]), refs, corroboration: corroboration(refs) };
          }
        }
      }
      // The competing edge, when found, leads `nearest` — it is strictly
      // better evidence than an ordinary same-subject or same-object
      // neighbour, and every caller that reads `nearest[0]` (the badge,
      // the grounding panel) inherits the upgrade with no further change.
      const rest = [...sameSubjVerb, ...sameVerbObj]
        .map(edgeFace)
        .filter((e) => !competing || e.end1 !== competing.end1 || e.end2 !== competing.end2);
      const nearest = (competing ? [competing, ...rest] : rest).slice(0, NEAREST_EDGES_MAX);
      return { ...claim, verdict: "unbound", nearest, ...(competing ? { competing } : {}), ...cardinality };
    }

    function edgeFace(e) {
      return {
        // internal edges already carry ONLY the earned names since the
        // wipe — arrangementOf maps RAW extractor triples (t.subject...),
        // and calling it here on an earned-name edge yielded end1:
        // undefined on every public face (caught by the suite, first run)
        end1: e.end1,
        label: e.label,
        end2: e.end2,
        polarity: e.polarity,
        refs: e.refs,
        // The exact bytes this edge was read from, carried THROUGH the
        // projection. Without this line `edges` is the one face of this
        // tier that cannot say where it read anything — measured 0/2,298
        // when the field was added at construction and dropped here.
        spans: e.spans ?? [],
        // null when no posPrior was available — a disclosed absence of the
        // check, never a false "plausible". Never used to drop or downrank
        // an edge here; a caller (verification.js) reads it as it chooses.
        grammar: vocabGrammar.get(e.label) ?? null,
        // The disclosure travels with the edge, so a claim's `bound` /
        // `nearest` lists carry it for free — a conviction resting on a
        // single-witness edge says so wherever that edge is shown.
        ...(e.assertion ? { assertion: e.assertion } : {}),
        // grammar-lens.js's own classification, tagged at extraction time
        // above — absent (not even a null key) when `classifyConnector`
        // was never injected, the same "no key at all" posture `assertion`
        // holds, so a caller checking `"connectorClass" in edge` sees the
        // organ's own presence honestly.
        ...(e.connectorClass ? { connectorClass: e.connectorClass } : {}),
        // The Station-3->4 wire's public face (same no-key-when-absent
        // posture as assertion/connectorClass above). The first cut set
        // these on the INTERNAL edge only and this projection stripped
        // them — the wire dark for a second reason within one hour, found
        // only because the measurement was re-run after the fix (III.5:
        // a lit-assertion, not a loaded one).
        ...(e.end1Face ? { end1Face: e.end1Face } : {}),
        ...(e.end2Face ? { end2Face: e.end2Face } : {}),
      };
    }

    const sentencesOf = (answer) => {
      // The same structural furniture grounding.js blanks: a Title-Case
      // heading must not read as a subject, an address's digits as an
      // object. Length-preserving, so the sentence text is the answer's own.
      let sents = [];
      try {
        sents = splitSentences(blankStructure(answer));
      } catch {
        return [];
      }
      return sents.map((s) => (typeof s === "string" ? s : s?.text ?? "")).filter((s) => s.trim());
    };

    function read(answer) {
      const report = {
        examined: true,
        vocabulary: { verbs: verbs.size, minSurfaces: MIN_SURFACES_PER_VERB, grammarPrior: Boolean(posPrior) },
        edges: edges.map(edgeFace),
        claims: [],
      };
      if (!verbs.size && extractorsMode !== "dispatch") {
        // A material too small or too nameless to measure a vocabulary from
        // is a typed gap, not a clean bill: this tier did not run, and the
        // report says so instead of implying "no relation drift". A
        // dispatch extractor is self-gating — it runs regardless.
        report.vocabulary.gap =
          "no relation vocabulary could be measured from this material — the relation tier did not run";
        return report;
      }
      for (const sentence of sentencesOf(answer)) {
        // The answer's own candidate verbs, discovered once and reused for
        // both the extraction pass and the unheard disclosure below —
        // previously two separate discoverRelationVocab calls that agreed
        // by construction, now genuinely one.
        let answerVerbs = new Set();
        try {
          answerVerbs = discoverRelationVocab(sentence, { surfaces, functionWords, minSurfaces: 1 }).verbs;
        } catch {
          answerVerbs = new Set();
        }
        // A candidate the material never uses VERBATIM but that IS the
        // same act as a verb the material's own vocabulary already
        // measured (createLemmatizer's received lemma table, never a
        // hand-typed rule) is heard, not unheard: "underwent" answering
        // material that only ever wrote "undergoes" is the same claim in
        // a different tense, not a claim this tier cannot check.
        const sameActExtra = createLemmatizer
          ? new Set([...answerVerbs].filter((v) => !verbs.has(v) && [...verbs].some((mv) => sameAct(mv, v))))
          : new Set();
        const sentenceVerbs = sameActExtra.size ? new Set([...verbs, ...sameActExtra]) : verbs;

        let heard = [];
        try {
          heard = extractRelations(sentence, { verbs: sentenceVerbs, functionWords, ...(extractorsMode === "dispatch" ? { figures: new Set(surfaces.map((x) => String(x).toLowerCase())) } : {}), ...(phrasalPredicates ? { phrasalPredicates } : {}), ...(nounPhraseSubjects ? { nounPhraseSubjects, ...(verbWall ? { verbWall } : {}), ...(adpositions ? { adpositions } : {}) } : {}) });
        } catch {
          heard = [];
        }
        for (const t of heard) report.claims.push(judge(sentence, foldNegation(t)));

        // The claims this tier CANNOT hear: verbs the answer uses after an
        // established surface that the material's vocabulary never measured,
        // by exact form OR by the same act. Typed `unheard` and disclosed —
        // an instrument that only reports what it can check, without saying
        // where its reach ends, implies silence means support.
        try {
          const unheardVerbs = new Set([...answerVerbs].filter((v) => !verbs.has(v) && !sameActExtra.has(v)));
          if (unheardVerbs.size) {
            for (const t of extractRelations(sentence, { verbs: unheardVerbs, functionWords, ...(extractorsMode === "dispatch" ? { figures: new Set(surfaces.map((x) => String(x).toLowerCase())) } : {}), ...(phrasalPredicates ? { phrasalPredicates } : {}), ...(nounPhraseSubjects ? { nounPhraseSubjects, ...(verbWall ? { verbWall } : {}), ...(adpositions ? { adpositions } : {}) } : {}) })) {
              const subj = endpoint(end1Of(t), true);
              if (!subj.referents.size) continue; // a pronoun subject is noise here, not a claim about the cast
              report.claims.push({
                sentence,
                ...{ end1: end1Of(t), label: labelOf(t), end2: end2Of(t) },
                polarity: t.polarity,
                verdict: "unheard",
                reason: `the material never uses the verb “${labelOf(t)}”, so there is nothing to compare this against — a limit of this check, not a mark against the answer`,
              });
            }
          }
        } catch {
          /* the disclosure pass declining is itself fine — the heard claims stand */
        }
      }
      return report;
    }

    // The referent-aware sibling of the standalone queryEdges/queryFillers
    // below (added 2026-08-19, same pass: "remember to point towards
    // referents not spans" — spans/offsets and surface strings point INTO
    // a material; a referent model resolves WHICH THING they name, and
    // this reader already built one, in `endpoint()`, to judge claims with.
    // queryEdges/queryFillers operate on `report.edges` AFTER it has left
    // this closure — plain strings, honestly disclosed as such, because
    // they must run with no engine organs and no live material. This
    // method runs INSIDE the closure, so "Lincoln" and "President Lincoln"
    // match by the SAME referent identity judge() itself trusts, not by
    // substring luck. Same open-field contract as queryFillers: exactly
    // one of subject/object left null, refused (null) otherwise.
    // A bare determiner difference is not a different slot. Found live,
    // 2026-09-23: the same "vice president under Lincoln" office, stated by
    // two different sentences about two different real office-holders,
    // read "became vice president under" for one and "became the vice
    // president under" for the other — one sentence's writer happened to
    // include the article, the other's did not, and the old raw `===`
    // compare treated them as two unrelated relations, so a caller asking
    // about one office-holder's own edge could never find the other even
    // though the material states both.
    //
    // Narrowed the same day, by adversarial falsification: folding BOTH
    // determiner classes together (the first cut, sharing `endpoint()`'s
    // own combined `determiners` organ) was tested against a constructed
    // hazard specimen — one office-holder stated as "became A vice
    // president of Acme Corp" (one of several, non-unique) and another as
    // "became THE vice president of Acme Corp" (the sole holder) — and it
    // wrongly clustered them as the same slot. Unlike a bare/no-determiner
    // vs "the" gap (a phrasing accident this fold exists to close), an
    // indefinite vs definite article is often the ONLY marker English gives
    // for uniqueness, so folding "a" away is a real, distinct hazard class,
    // not a widening of the same one. `foldLabel` therefore reads a
    // SEPARATE, narrower organ — `definiteDeterminers` — folding only
    // DEFINITE_DETERMINERS (priors.js, giver "lang/en"), never
    // INDEFINITE_DETERMINERS; `endpoint()`'s own object-token matching
    // above is untouched and keeps reading the combined `determiners` set,
    // since that fix (P41) is about excluding a bare shared article from
    // fallback token overlap, not about equating "a" with "the". Also still
    // deliberately narrower than the broader `functionWords` class: a
    // differing PREPOSITION ("vice president under" vs "vice president of")
    // stays a real distinction.
    const foldLabel = (s) =>
      String(s ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t && !definiteDeterminers?.has(t))
        .join(" ");
    function queryReferents({ subject = null, verb = null, object = null } = {}) {
      const openSubject = subject == null;
      const openObject = object == null;
      if (openSubject === openObject) return null;
      const subjEnd = subject == null ? null : endpoint(subject);
      const objEnd = object == null ? null : endpoint(object);
      const verbFolded = verb == null ? null : foldLabel(verb);
      const matches = edges.filter(
        (e) =>
          (verb == null || foldLabel(e.label) === verbFolded) &&
          (subjEnd == null || endpointsMatch(e.subjectEnd, subjEnd)) &&
          (objEnd == null || endpointsMatch(e.objectEnd, objEnd)),
      );
      const openField = openSubject ? "subjectEnd" : "objectEnd";
      const sourceField = openSubject ? "end1" : "end2"; // read the earned name; emit the filler shape
      // FILLERS KEEP THEIR OWN NARROW VOCABULARY (the wipe's one deliberate
      // boundary, 2026-09-02): a filler answers "which value fills this
      // SLOT", and clusterFillers' f.object is consumed by that name in
      // holon.js with a comment saying exactly that (P36). Widening the
      // wipe into the filler shape would have forked it from claim.fillers
      // — caught live when the two diverged mid-rename.
      const faceField = openSubject ? "subject" : "object";
      const clusters = [];
      for (const e of matches) {
        const found = clusters.find((c) => endpointsMatch(c.end, e[openField]));
        if (found) found.refs.push(...e.refs);
        else clusters.push({ [faceField]: e[sourceField], end: e[openField], refs: [...e.refs] });
      }
      // EVERY CLUSTER CARRIES HOW ITS OPEN END RESOLVED. This function is
      // named queryReferents and returned whatever sat in the open slot,
      // referent or not — so at page scale it answered "who was vice
      // president of the United States" with "Though he", "Congress",
      // "000", "why it" and "impeachment trial" alongside Andrew Johnson,
      // and a caller had no way to tell them apart (measured live
      // 2026-08-26 over 3,841 edges from four real pages).
      //
      // `resolutionOf` already draws exactly this line and its answer was
      // being thrown away with `end`: "referent" — it resolved to a being
      // this material itself established; "form" — only through a
      // recurring-form id; "tokens" — to nothing but its own content
      // words; "none" — not even that. Disclosed rather than filtered
      // here, because which of those a caller may stand on is the caller's
      // declaration to make, not this organ's to assume — the same posture
      // every other typed gap in this file already holds.
      return clusters.map(({ end, ...rest }) => ({
        ...rest,
        resolution: resolutionOf(end),
        refs: [...new Set(rest.refs)],
      }));
    }

    return {
      examined: true,
      vocabulary: { verbs: verbs.size, minSurfaces: MIN_SURFACES_PER_VERB, grammarPrior: Boolean(posPrior), candidates: candidateCount },
      edges: edges.map(edgeFace),
      read,
      queryReferents,
    };
  };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The claims that belong on a record's unsupported list: contradiction and
 * unbound edges are claims of fact the material does not make. beyond-reach
 * and unheard stay OUT — they are limits of the instrument, and putting them
 * on the record would punish the answer for the reader's reach. */
export function relationFindings(report, { verdicts = ["contradicted", "unbound"] } = {}) {
  // Callers choose which verdicts count as findings, because the two are
  // different kinds of fact (amended 2026-08-17, propose-then-check): a
  // CONTRADICTED edge is the answer disagreeing with the material's own
  // words — a lie about the given, worth a correction pass; an UNBOUND edge
  // is the model saying something the material is merely silent on — its own
  // knowledge, which ships marked rather than being rewritten away. The
  // default keeps both, so every existing caller reads as before.
  const want = new Set(verdicts);
  const lines = [];
  for (const c of report?.claims ?? []) {
    const edge = `${c.end1} —${c.label}${c.polarity === "-" ? " (negated)" : ""}→ ${c.end2}`;
    if (c.verdict === "contradicted" && want.has("contradicted")) {
      lines.push(`the material says otherwise: ${edge} [${(c.refs ?? []).join("; ")}]`);
    } else if (c.verdict === "unbound" && want.has("unbound")) {
      if (c.competing) {
        lines.push(
          `the material fills this differently: ${edge} — it says ` +
            `${c.competing.end1} —${c.competing.label}→ ${c.competing.end2} [${c.competing.refs.join("; ")}]`,
        );
      } else {
        const near = c.nearest?.[0];
        lines.push(
          `the material never says: ${edge}` +
            (near ? ` (closest it does say: ${near.end1} —${near.label}→ ${near.end2})` : ""),
        );
      }
    }
  }
  return lines;
}

/** True when no claim was contradicted or unbound. Clean and examined are
 * different facts here exactly as they are in checkGrounding. */
export function relationsClean(report) {
  return !(report?.claims ?? []).some((c) => c.verdict === "contradicted" || c.verdict === "unbound");
}

// ── querying the whole graph directly (added 2026-08-19, user direction:
// "can we now mechanically query the entire hypergraph") ───────────────
//
// Every other function in this file answers "does THIS claim hold" —
// judge() runs once a sentence has already been extracted into a triple.
// `fillers`/`competing` (this same pass) are that verdict's own byproduct,
// reachable only by round-tripping a claim through read(). queryEdges is
// the missing direct door: `report.edges` is already fully exposed (every
// edge the material binds, addressed), so a caller who wants to ask the
// graph a question — "who did Lincoln appoint," "what did anyone say
// about Helene" — should not have to manufacture a sentence and run it
// through extraction just to read data that is already sitting there.
//
// DISCLOSED LIMIT, same class as siblingSwap's (testimony.js): matching
// here is on `report.edges`'s own exposed SURFACE STRINGS, not referent
// IDs — the referent index that makes endpointsMatch's identity-aware
// comparison possible is private to makeRelationReader's closure and does
// not survive into the edgeFace shape. A query for "Lincoln" will not
// itself resolve "President Lincoln" and "Lincoln" as the same referent
// the way judge() does internally; it folds diacritics/case and matches
// by containment, which is weaker but requires no engine organs and no
// live material to run — pure data in, pure data out.

const foldMatch = (edgeVal, query) => {
  if (query == null) return true;
  const a = foldDiacritics(String(edgeVal ?? "")).toLowerCase();
  const b = foldDiacritics(String(query)).toLowerCase();
  return a.includes(b) || b.includes(a);
};

/**
 * Every edge in `edges` (a report's own `.edges`, or any array of
 * edgeFace-shaped objects) matching the given filters. Any of
 * subject/verb/object may be omitted (a wildcard) or given as a string
 * (folded, substring-matched — see the disclosed limit above); `verb` is
 * matched exactly (fold-cased) since the material's own measured
 * vocabulary is already a closed, discovered set, not free text.
 */
export function queryEdges(edges, { subject = null, verb = null, object = null, polarity = null } = {}) {
  return (edges ?? []).filter(
    (e) =>
      foldMatch(e.end1, subject) &&
      (verb == null || foldDiacritics(String(e.label ?? "")).toLowerCase() === foldDiacritics(String(verb)).toLowerCase()) &&
      foldMatch(e.end2, object) &&
      (polarity == null || e.polarity === polarity),
  );
}

/**
 * The same cardinality question `fillers`/`competing` answer for one
 * judged claim, asked directly of the whole graph for an ARBITRARY query:
 * leave exactly one of subject/object open (a wildcard) and get back every
 * DISTINCT value the material binds there, each with its own refs — "who
 * did Lincoln appoint" (subject+verb given, object open) or "who appointed
 * Hamlin" (object+verb given, subject open). Refuses (returns null, a
 * typed absence rather than a guess) when the query leaves BOTH subject
 * and object open — "distinct what, filling which slot" is not a
 * well-formed question without at least one side pinned — or leaves
 * NEITHER open, since a single fully-pinned query is queryEdges's own job.
 */
export function queryFillers(edges, { subject = null, verb = null, object = null } = {}) {
  const openSubject = subject == null;
  const openObject = object == null;
  if (openSubject === openObject) return null; // both open, or neither — not this function's question
  const matches = queryEdges(edges, { subject, verb, object });
  // READ from the edge's earned names (the wipe); EMIT the fillers' own
  // narrow shape (subject/object — a filler answers "which value fills
  // this slot", and holon.js consumes it by that name; see queryReferents'
  // note). The two vocabularies meet exactly here, on purpose.
  const sourceField = openSubject ? "end1" : "end2";
  const openField = openSubject ? "subject" : "object";
  const clusters = new Map();
  for (const e of matches) {
    const key = foldDiacritics(String(e[sourceField] ?? "")).toLowerCase();
    if (!clusters.has(key)) clusters.set(key, { value: e[sourceField], refs: [] });
    clusters.get(key).refs.push(...e.refs);
  }
  return [...clusters.values()].map((c) => ({ [openField]: c.value, refs: [...new Set(c.refs)] }));
}

// ── a relation reader for case-marked languages (P72 / eoreader7
// READING-SPEC.md S33) ───────────────────────────────────────────────────
//
// A SEPARATE entry point from makeRelationReader, deliberately, not a
// branch inside it. The English pipeline's referent-index resolution
// (cast.js), assertion order-arm, connector-class checks, and gender
// evidence all assume a POSITIONAL extractor's own edge shape
// (subjectEnd/objectEnd fuzzy matching over a referent index) — a
// case-marked organ produces a genuinely different shape (a word, its
// case, its number; no referent resolution, no fuzzy endpoint matching)
// and retrofitting it through machinery built for the other shape is
// real, scoped, unattempted future work, disclosed here rather than
// silently implied. What IS shared, and is the actual point: the
// arrangement's earned names. Every edge below carries `end1`/`label`/
// `end2` — nothing here ever populates `subject`/`verb`/`object`,
// because Latin's oblique cases have no honest 1:1 mapping onto English
// argument structure (this reader's own `end1Detail`/`end2Detail` carry
// the grammatical case instead — a fact English's positional reader has
// no use for and never needed).
//
/**
 * @param {object} organs
 * @param {function} organs.splitSentences spans.js's own sentence
 *   splitter (cast.js pattern — injected, never imported directly).
 * @param {function} organs.extractCaseMarkedRelation the case-marking
 *   organ itself (eoreader7/native/adapters/text/relations-case-marked.js).
 * @param {object} [organs.casePrior] passed through to the organ; the
 *   organ's own default (Latin) applies when omitted.
 * @returns {function(Array<{ref:string,text:string}>): {edges: Array, gaps: Array, examined: true}}
 */
export function makeCaseMarkedRelationReader({ splitSentences, extractCaseMarkedRelation, casePrior } = {}) {
  if (typeof splitSentences !== "function")
    throw new TypeError("makeCaseMarkedRelationReader: splitSentences is injected — spans.js's own organ, never a private reimplementation");
  if (typeof extractCaseMarkedRelation !== "function")
    throw new TypeError("makeCaseMarkedRelationReader: extractCaseMarkedRelation is injected — the engine's own organ, never a private reimplementation");

  return function relationsFor(passages) {
    const edges = [];
    const gaps = [];
    for (const p of passages ?? []) {
      for (const sentence of splitSentences(String(p.text ?? ""))) {
        const result = extractCaseMarkedRelation(sentence.text, { casePrior });
        const span = { ref: p.ref, start: sentence.offset, end: sentence.offset + sentence.text.length, text: sentence.text };
        if (result.gap || !result.end1 || !result.end2) {
          // A gap is a real result, not a discarded one — reported on its
          // own list rather than silently dropped, the same denominator
          // discipline S22/S32 already hold: "never attempted" and
          // "attempted and refused" must not share a bucket with silence.
          gaps.push({ ref: p.ref, sentence: sentence.text, gap: result.gap });
          continue;
        }
        edges.push({
          end1: result.end1.word,
          label: result.label.word,
          end2: result.end2.word,
          end1Detail: { case: result.end1.case, number: result.end1.number },
          end2Detail: { case: result.end2.case, number: result.end2.number },
          refs: [p.ref].filter(Boolean),
          spans: [span],
        });
      }
    }
    return { edges, gaps, examined: true };
  };
}
