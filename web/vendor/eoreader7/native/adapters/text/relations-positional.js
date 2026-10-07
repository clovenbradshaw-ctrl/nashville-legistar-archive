// native/adapters/text/relations-positional.js — the ONE master positional
// relation reader, for any language a caller supplies a `RoleConfig@1` for
// (scripts/build-role-config.mjs). Replaces relations-hebrew.js and
// relations-arabic.js (2026-09-15, retired the same day they were built —
// user direction, verbatim: "we cant be afraid to let what we learn in
// one language influence another... this needs to be true for all
// languages, lets make this one master file").
//
// WHAT CHANGED, AND WHY THE TWO HAND-WRITTEN FILES WERE WRONG TO KEEP.
// Hebrew and Arabic surfaced the SAME lesson by the SAME method within one
// afternoon: neither language's clause grammar is what its WALS "root-
// pattern" genus label practically implies (that label is about templatic
// WORD-formation, not clause-level role marking) — both are overwhelmingly
// POSITIONAL, measured directly against real UD treebank gold data. What
// differs between them is a handful of MEASURED NUMBERS (which side
// dominates for each role, how reliably, whether a marker particle exists)
// — never the mechanism that reads those numbers. Two files encoding the
// same algorithm with different numbers hardcoded is the exact drift class
// this project's own postmortems keep naming (P22's `Array.find`, P24's
// runtime-type ternary): a THIRD language would have meant a THIRD
// hand-written file, repeating a discovery this script has already made
// generic.
//
// THE ARRANGEMENT NEVER NEEDS GRAMMATICAL NAMES (the-fold's grammar-lens
// section; POLICIES.md P72). Public shape: `{end1, label, end2, gap}`,
// matching `relations-case-marked.js` exactly. A `RoleConfig@1`'s OWN
// internal vocabulary (`subject`/`object`) names which measured UD
// relation (`nsubj` vs `obj`/`iobj`) a side's statistics describe — it
// NEVER reaches this file's output. `subject`/`object` describe a
// cross-linguistic annotation scheme's own two relations, not English
// grammar smeared onto a ledger; conflating "the config's own field name"
// with "the arrangement's own field name" would be the actual violation,
// and this file does not make that mistake.
//
// VERB AND NOMINAL IDENTIFICATION reuse the received POS prior directly
// (`wordclass.js::classifyWord`/`dominantClass`) — no suffix-mining, no
// hand-typed vocabulary, matching `heard-surfaces.js`/`identity-
// evidence.js`'s own established injection pattern.
import { peelProclitics } from "../../organs/heard-surfaces.js";
import { GRAMMAR_MIN_SHARE } from "./grain-typing.js";

const NOMINAL_CLASSES = Object.freeze(new Set(["NOUN", "PROPN"]));
const VERB_LIKE = Object.freeze(new Set(["VERB", "AUX"]));

const stripPunct = (w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

/**
 * isHeadOfPhraseUpos(prevUpos) -> boolean
 *
 * A nominal immediately preceded by an adposition (a PP's own object) or
 * by another nominal (an unmarked genitive/idafa chain's own possessor —
 * Arabic's own construction, but the same surface shape any language's
 * bare N-N compound/possessive produces) is structurally embedded inside
 * a DIFFERENT noun's own phrase, not a direct dependent of the verb —
 * never a plausible subject/object at this reader's own shallow
 * (no-parse) scope. `prevUpos` is the preceding token's own UPOS tag
 * (from `wordclass.js::dominantClass` at inference time, or a gold
 * treebank tag when measuring — exported so `eval/
 * positional-relations-eval.mjs`'s own isolated role-assignment
 * measurement applies the IDENTICAL rule this file's own
 * `extractPositionalRelation` does, never a second, drifting copy).
 *
 * Measured directly on both languages' own held-out data (never assumed
 * from general linguistic knowledge): Arabic news prose piles unrelated
 * genitive-chain nominals into a single "sentence" containing only one
 * verb (real specimen: 55 tokens, 25 nominals, one verb) — excluding
 * embedded nominals lifts the clean single-object-candidate rate
 * 6.9%->27.4% on the Arabic TRAINING split (n=1075) and 30.6%->38.0% on
 * the Hebrew TEST split (n=121), at a real, disclosed cost (measured
 * false-negative rate: ~18-20% of gold objects and ~3% of gold subjects
 * are themselves embedded this way and get excluded too) — never free,
 * but a clear net gain on both languages' own numbers, not tuned toward
 * either one.
 */
export function isHeadOfPhraseUpos(prevUpos) {
  return prevUpos !== "ADP" && prevUpos !== "NOUN" && prevUpos !== "PROPN";
}

/**
 * extractPositionalRelation(text, { roleConfig, posPrior, classifyWord,
 * dominantClass, classShare, proclitics }) -> { end1, label, end2, gap }
 *
 * `roleConfig.object`/`.subject` — `{dominantSide, reliability, usable,
 * marker}`, from a `RoleConfig@1` (scripts/build-role-config.mjs). A role
 * whose config is `usable: false` (Arabic's own subject, measured: near
 * chance, 45.7%/54.3%) is assigned by ELIMINATION instead of position —
 * the clause's OTHER nominal argument, once the other role is settled —
 * never guessed from an unusable side. A `marker` present is a
 * CONFIRMING tie-breaker among multiple same-side candidates, never a
 * requirement — most languages' markers cover only a fraction of real
 * occurrences (Hebrew's את marks only definite objects; an indefinite one
 * carries none at all), so absence proves nothing.
 *
 * @param {string} text one sentence, single verb-like head. Multiple or
 *   zero verb-like candidates is out of this organ's declared scope
 *   (clause segmentation, unbuilt), matching `relations-case-marked.js`.
 * @param {object} options
 * @param {object} options.roleConfig a `RoleConfig@1` for this material's
 *   language.
 * @param {object} options.posPrior a received `POSPrior@1`.
 * @param {function} options.classifyWord `wordclass.js::classifyWord`.
 * @param {function} options.dominantClass `wordclass.js::dominantClass`.
 * @param {number} [options.classShare=GRAMMAR_MIN_SHARE] the confidence
 *   floor a class reading must clear — the one share constant
 *   (grain-typing.js), never a per-file 0.5.
 * @param {Set<string>|null} [options.proclitics] a `ProcliticPrior@1`'s
 *   own set (S118) — a word still fused to a bound proclitic is read
 *   correctly rather than missed as unclassifiable.
 * @param {boolean} [options.phrasalPredicates=false] OFF by default —
 *   byte-identical to before. ON, a leading run of `auxiliaryVerbs`
 *   members immediately before a verb-like token is COLLAPSED into that
 *   token's own candidacy (`relations.js`'s own DR5 discipline, ported
 *   here rather than reinvented: same name, same bounded shape,
 *   `MAX_AUX_HOPS`). Without this, "should torture" reads as TWO
 *   competing verb-like tokens (the modal is itself AUX-classified) and
 *   every modal/prescriptive clause — the exact shape a charter-style
 *   checker exists to read — refuses as `ambiguous_verb`.
 * @param {Set<string>|null} [options.auxiliaryVerbs=null] the received
 *   closed class of auxiliary/modal forms (priors.js's own
 *   `AUXILIARY_VERBS` for English) — required when `phrasalPredicates` is
 *   true. Checked by literal membership, never by the POS prior: an
 *   auxiliary is a closed grammatical class with a named giver, the same
 *   standing `relations.js` already holds it to, not a fact a sparse
 *   corpus prior should have to re-attest.
 * @param {Set<string>|null} [options.verbForms=null] an OPTIONAL
 *   caller-asserted closed set of known verb surface forms (UniMorph,
 *   or a small hand-curated dictionary-verifiable list, giver named by
 *   the caller) — held to the SAME standing `auxiliaryVerbs` already is
 *   in this file: checked by literal membership BEFORE the POS prior,
 *   never deferred to it. A general web-text prior's evidence for a rare
 *   or domain-specific verb is often thin enough to mislead rather than
 *   inform (measured: "torture" appears exactly once in UD_English-EWT,
 *   attested only as a NOUN — real evidence, but not enough of it to
 *   outweigh a caller's own dictionary-sourced assertion that the word
 *   is verb-capable). Classification is disclosed via `fromLexicon: true`
 *   rather than silently presented as ordinary POS-prior evidence. Absent,
 *   the prior's own reading is unchanged.
 * @param {Set<string>|null} [options.subjectPronouns=null] an OPTIONAL
 *   received closed class of pronoun forms (priors.js's own
 *   `SUBJECT_PRONOUNS` for English) eligible to stand as a whole
 *   end1/end2 — pronouns are a closed grammatical class, not a fact a
 *   sparse corpus prior should have to attest per-form (measured: a
 *   PRON-tagged "We"/"they" is otherwise invisible to `NOMINAL_CLASSES`,
 *   which was tuned against Hebrew/Arabic's own named-subject news
 *   prose). Absent, only `NOUN`/`PROPN` candidates are read, unchanged.
 * @param {Set<string>|null} [options.nominalForms=null] `verbForms`'s own
 *   twin for the OTHER class this file reads (NOUN/PROPN): a
 *   caller-asserted closed set of known nominal surface forms, checked
 *   before the POS prior, same reasoning (measured: "servitude" is not
 *   attested at all in UD_English-EWT — a genuine corpus gap, not a
 *   disputed reading). Absent, the prior's own reading is unchanged.
 * @param {Set<string>|null} [options.chainBridge=null] an OPTIONAL closed
 *   set of literal tokens the aux-chain walk may cross WITHOUT them being
 *   verb-like themselves — English's infinitive marker "to" is the
 *   measured case (`priors.js` has no export for it because it is not a
 *   verb, an auxiliary, or a negation word; it is its own one-word closed
 *   class). Without this, "should be free TO cause pollution" and
 *   "should be allowed TO torture prisoners" read as two SEPARATE,
 *   non-adjacent verb-like candidates ("should be (free)" / "cause") and
 *   refuse as `ambiguous_verb` — found regressing an existing, real
 *   Earth-Charter conformance case ("Factories should be free to cause
 *   contamination and pollution") when `phrasalPredicates` was first
 *   added, not a hypothetical. Only tokens literally in this set may sit
 *   between two chain members; a genuine second clause ("...which critics
 *   have called...") still refuses as ambiguous, unchanged.
 */
export function extractPositionalRelation(text, { roleConfig, posPrior, classifyWord, dominantClass, classShare = GRAMMAR_MIN_SHARE, proclitics = null, phrasalPredicates = false, auxiliaryVerbs = null, verbForms = null, subjectPronouns = null, nominalForms = null, chainBridge = null } = {}) {
  if (!roleConfig) throw new Error("extractPositionalRelation: roleConfig must be supplied");
  if (!posPrior || !classifyWord || !dominantClass) throw new Error("extractPositionalRelation: posPrior, classifyWord and dominantClass must all be supplied");
  if (phrasalPredicates && !auxiliaryVerbs) throw new Error("extractPositionalRelation: phrasalPredicates requires auxiliaryVerbs — the received closed class it collapses, never guessed");

  const peel = (w) => {
    if (!proclitics) return w;
    const p = peelProclitics(w, proclitics, posPrior);
    return p ? p.stem : w;
  };
  const rawWords = String(text ?? "").split(/\s+/).map(stripPunct).filter(Boolean);
  const words = rawWords.map((w) => ({ raw: w, stem: peel(w) }));
  const classOf = (stem) => dominantClass(classifyWord(stem, { posPrior }), { minShare: classShare });
  // `verbForms`/`nominalForms` membership is checked FIRST, before the POS
  // prior — the same standing `auxiliaryVerbs` already holds in this file
  // (a closed, caller-asserted class is never outvoted by a general
  // corpus prior's own — often thin or entirely absent — evidence for
  // that same word).
  const lexClassOf = (stem) => {
    const lower = stem.toLowerCase();
    if (verbForms?.has(lower)) return { upos: "VERB", count: 0, share: 1, thraxClass: null, fromLexicon: true };
    if (nominalForms?.has(lower)) return { upos: "NOUN", count: 0, share: 1, thraxClass: null, fromLexicon: true };
    return classOf(stem);
  };
  const classified = words.map((w) => (verbForms || nominalForms ? lexClassOf(w.stem) : classOf(w.stem)));

  let verbLikeIdx = words
    .map((w, i) => ({ i, w, c: classified[i] }))
    .filter((x) => VERB_LIKE.has(x.c?.upos));

  let verbCandidates = verbLikeIdx;
  if (phrasalPredicates && verbLikeIdx.length > 1) {
    // Collapse a CONTIGUOUS run where every token but the last is a
    // received auxiliary/modal form into ONE candidate at the run's own
    // last index — "should torture" is one predicate, never two
    // competing verb-like tokens. MAX_AUX_HOPS bounds the run exactly as
    // relations.js's own DR5 does (never unbounded — same ReDoS lesson
    // that file's own header already names).
    const MAX_AUX_HOPS = 4;
    // true when every original word position strictly between the two
    // given original indices is a literal `chainBridge` member (e.g. "to")
    // — never verb-like itself, so it can only ever BRIDGE a gap, never
    // extend the run's own hop count.
    const bridgedGap = (fromI, toI) => {
      if (!chainBridge || toI <= fromI + 1) return false;
      for (let p = fromI + 1; p < toI; p += 1) if (!chainBridge.has(words[p]?.stem?.toLowerCase())) return false;
      return true;
    };
    const collapsed = [];
    let k = 0;
    while (k < verbLikeIdx.length) {
      let j = k;
      while (
        j + 1 < verbLikeIdx.length &&
        (j - k) < MAX_AUX_HOPS &&
        (
          // an ordinary adjacent auxiliary/modal step (unchanged)
          (verbLikeIdx[j + 1].i === verbLikeIdx[j].i + 1 && auxiliaryVerbs.has(verbLikeIdx[j].w.stem.toLowerCase()))
          // OR a pure infinitive-marker bridge — "to" itself is the
          // justification for continuing the chain, independent of
          // whether the word BEFORE it ("allowed", "required", "free")
          // is a grammatical auxiliary; a control/catenative verb
          // governing a "to V" complement is not itself an auxiliary,
          // but the complement is still one predicate, not two.
          || bridgedGap(verbLikeIdx[j].i, verbLikeIdx[j + 1].i)
        )
      ) j += 1;
      if (j > k) {
        // The joined text carries the ORIGINAL words BETWEEN chain members
        // too (e.g. "should be allowed to torture", not "...allowedtorture"
        // with "to" silently dropped) — sliced straight from `words` by
        // original index, never re-derived from the (possibly bridged,
        // non-contiguous) `verbLikeIdx` entries alone.
        const raw = words.slice(verbLikeIdx[k].i, verbLikeIdx[j].i + 1).map((w) => w.raw).join(" ");
        collapsed.push({ i: verbLikeIdx[j].i, w: { raw, stem: verbLikeIdx[j].w.stem }, c: verbLikeIdx[j].c });
        k = j + 1;
      } else {
        collapsed.push(verbLikeIdx[k]);
        k += 1;
      }
    }
    verbCandidates = collapsed;
  }

  if (verbCandidates.length === 0) return { end1: null, label: null, end2: null, gap: { reason: "no_verb_found" } };
  if (verbCandidates.length > 1) return { end1: null, label: null, end2: null, gap: { reason: "ambiguous_verb", candidates: verbCandidates.map((c) => c.w.raw) } };
  const verb = verbCandidates[0];

  // HEAD-OF-PHRASE ONLY (`isHeadOfPhraseUpos`, above — see its own
  // docstring for the measured rationale and numbers). A token literally
  // in the received `subjectPronouns` closed class stands as a candidate
  // end too, regardless of what the corpus prior attests for it (or fails
  // to) — the same "closed class needs no corpus" posture `auxiliaryVerbs`
  // above already holds, applied to the other end of the clause.
  const nominals = words
    .map((w, i) => ({ i, w, c: classified[i] }))
    .filter((x) => x.i !== verb.i && (NOMINAL_CLASSES.has(x.c?.upos) || subjectPronouns?.has(x.w.stem.toLowerCase())) && (x.i === 0 || isHeadOfPhraseUpos(classified[x.i - 1]?.upos)));
  const before = nominals.filter((n) => n.i < verb.i);
  const after = nominals.filter((n) => n.i > verb.i);
  const bySide = { before, after };

  const gaps = [];

  // OBJECT (config.object — the measured UD `nsubj`... no: `obj`/`iobj`
  // relation's own statistics). Assigned by position when usable; a
  // marker breaks a tie among same-side candidates, never gates.
  let end2 = null;
  if (roleConfig.object.usable !== false && roleConfig.object.dominantSide) {
    let candidates = bySide[roleConfig.object.dominantSide] ?? [];
    if (candidates.length > 1 && roleConfig.object.marker) {
      const markerForm = roleConfig.object.marker.form;
      const markerSide = roleConfig.object.dominantSide === "after" ? -1 : 1; // the marker sits on the side the role slot extends FROM the verb
      const marked = candidates.filter((n) => words[n.i + markerSide]?.raw === markerForm);
      if (marked.length === 1) candidates = marked;
    }
    if (candidates.length === 1) end2 = candidates[0];
    else if (candidates.length > 1) gaps.push("ambiguous_object");
    else gaps.push("intransitive_or_no_object_found");
  } else {
    gaps.push("object_side_not_usable_for_this_language");
  }

  // SUBJECT (config.subject — the measured UD `nsubj` relation's own
  // statistics). Position first if usable; otherwise the clause's OTHER
  // nominal argument once the object is settled (Arabic's own design:
  // 45.7%/54.3%, no usable side at all — measured, not assumed).
  //
  // TRIED AND REFUTED HERE, DO NOT RETRY WITHOUT NEW EVIDENCE (S121):
  // "the candidate closer to the verb, among multiple same-side
  // candidates, is more likely the subject" — measured directly on real
  // Arabic same-side collisions (26/42, 61.9%), but a one-sided exact
  // binomial test against p=0.5 gives p=0.0821, which does not clear this
  // project's own standing null-arm alpha (0.05). A future editor adding
  // a distance-based tie-break to the `ambiguous_subject` branch below
  // should re-measure from scratch, not assume the earlier negative
  // result was a fluke of that one sample.
  let end1 = null;
  if (roleConfig.subject.usable !== false && roleConfig.subject.dominantSide) {
    let candidates = (bySide[roleConfig.subject.dominantSide] ?? []).filter((n) => n !== end2);
    if (candidates.length > 1 && roleConfig.subject.marker) {
      const markerForm = roleConfig.subject.marker.form;
      const markerSide = roleConfig.subject.dominantSide === "after" ? -1 : 1;
      const marked = candidates.filter((n) => words[n.i + markerSide]?.raw === markerForm);
      if (marked.length === 1) candidates = marked;
    }
    if (candidates.length === 1) end1 = candidates[0];
    else if (candidates.length > 1) gaps.push("ambiguous_subject");
    else gaps.push("no_subject_found");
  } else {
    const remaining = nominals.filter((n) => n !== end2);
    if (remaining.length === 1) end1 = remaining[0];
    else if (remaining.length > 1) gaps.push("ambiguous_subject");
    else gaps.push("no_subject_found");
  }

  return {
    end1: end1 ? { word: end1.w.raw, upos: end1.c.upos } : null,
    label: { word: verb.w.raw, upos: verb.c.upos },
    end2: end2 ? { word: end2.w.raw, upos: end2.c.upos } : null,
    gap: gaps.length ? gaps : null,
  };
}

/**
 * makePositionalSlots(options) -> slotsOf(text) -> [{end1, label, end2}]
 *
 * The seam onto the-fold's `grounding-gfp.js::makeGfpGround`, whose own
 * header names exactly this: "role assignment is the language's own
 * eigenvalue... a caller reading an inflectional, Semitic or CJK text
 * injects that language's own slot organ." `RoleConfig@1` plus this
 * file's own `extractPositionalRelation` IS a concrete slot organ for a
 * positional Semitic language — measured, giver-traceable — rather than a
 * second architecture built beside GFP's own injection point. Options
 * (`roleConfig`, `posPrior`, `classifyWord`, `dominantClass`, `proclitics`)
 * are bound ONCE here because `makeGfpGround` calls `slotsOf(text)` with a
 * single argument; a caller partially applies this file's own options at
 * the point of composition, never at every call.
 *
 * Deliberately narrower than `extractPositionalRelation`'s own return
 * shape: a `gap` (no verb found, ambiguous verb, no usable role) becomes
 * an EMPTY ARRAY, never a typed reason — matching `positionalSlots`/
 * `englishSlots`' own "nothing found here" contract (grounding-gfp.js has
 * no vocabulary for a gap object; inventing one here would be a second,
 * uncoordinated shape). The typed gap itself is not lost — it is still
 * available to any caller of `extractPositionalRelation` directly.
 *
 * @param {object} options passed through verbatim to
 *   `extractPositionalRelation` on every call.
 */
export function makePositionalSlots(options) {
  return function slotsOf(text) {
    const { end1, label, end2 } = extractPositionalRelation(text, options);
    if (!end1 || !label || !end2) return [];
    return [{ end1: end1.word, label: label.word, end2: end2.word }];
  };
}
