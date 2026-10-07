// the legacy engine · perceiver/text/pronouns — binding a THIRD-PERSON SINGULAR
// pronoun to a referent BY ACTIVATION, never by nearest name.
//
// surfaces.js's own gap says this plainly: pronoun binding is MODEL tier,
// "not derivable... eoreader5 measured distributional coref failing twice
// (frame-level lift, sentence-level complementary distribution)." Both of
// those attempts asked a WHOLE-DOCUMENT question after the fact — which
// other passage does this one resemble, scored against a vocabulary the
// entire text had already supplied. That is exactly the leak
// emergence/activation.js was built to close for motif recall: a
// whole-document table conditions every score on pages the reader has not
// reached. So this does not invent a second mechanism. It reuses the first
// one (codeOf / recall / encodeFrame, imported whole, never re-derived) and
// asks it a narrower, causal question: given only what has been read so far,
// which NAMED referent's own sentences does THIS sentence's vocabulary most
// resemble, by one recurrent hop?
//
// A referent's own surface, once discoverReferents has admitted it
// (name-variant coreference — engine-tier and already complete, surfaces.js),
// is exactly as good a fact about a sentence as any distinctive recurring
// word: the sentence that carries it is tagged with the referent it named,
// and later, a sentence that shares the FIRST sentence's vocabulary — not its
// name, which is exactly what a pronoun sentence lacks — recalls it by the
// same one-hop completion the rest of this engine already trusts for motifs.
//
// WHAT THIS DOES NOT CLOSE. Descriptor synonymy ("the creature" ≈ "the
// wretch") is untouched — nothing here reads definite descriptions, and
// surfaces.js's gap stands for that half unchanged. Number-ambiguous
// pronouns ("they"/"them"/"their") are out of scope too: singular-or-plural
// is not decidable from the pronoun alone (priors.js::THIRD_PERSON_SINGULAR's
// own header), and guessing one over the other here would be exactly the
// fabrication this codebase refuses everywhere else. A pronoun sharing its
// sentence with a named surface is also left alone — disambiguating which of
// several co-mentioned referents a pronoun in the SAME clause points at is a
// harder, different problem, and this only ever answers the case the
// original complaint names: a scene carried by "he" with no name anywhere
// in it.
//
// WHAT THIS MEASURES, AND WHAT IT REFUSES TO ASSUME. A pronoun's sentence is
// bound to a referent only when its one-hop recall against the referents
// named so far clears TWO declared bars: an absolute floor (`minActivation`
// — some real echo, not a rounding artefact) and a margin over the runner-up
// (`minMargin` — a decision, not a coin flip between two near-equal
// candidates). Both are declared by the caller, never defaulted here — the
// same standing entity.js's `minArrivals` and kind-void.js's `draws`/`seed`
// already hold: how much activation makes a binding is a property of the
// reading, not a constant this file gets to assume for every caller's
// material. Short of either bar, the pronoun is reported unresolved — a
// typed gap, never a guess dressed as a number.
//
// GENDER IS A HARD FILTER, NEVER A TIEBREAKER, AND IT IS DERIVED, NOT TYPED
// IN. No name list, no honorific table: a referent's gender class is read
// off which gendered pronoun co-occurs with ITS OWN named mentions (a clean
// signal only when exactly one referent is named in that sentence AND the
// pronoun sits in the SAME CLAUSE as that naming — a pronoun beside two
// co-mentioned names is not clean evidence for either, and neither is a
// pronoun beside a name that is only along for the ride in a different
// clause of the same sentence). A referent with no such evidence is never
// excluded by gender; one with clear, contrary evidence always is.
//
// "SAME SENTENCE" WAS TOO WIDE A NET, MEASURED. A wire-service attribution
// clause — "...because none of the organizations contacted by Continental
// Newswire appeared to know who she was" — puts a narrating apparatus as
// the sentence's only literally-named surface while "she" grammatically
// refers to someone this sentence never names at all. Same-sentence
// co-occurrence alone reads that as clean evidence and wrongly tags the
// apparatus female; once tagged, it passes the hard filter below for every
// later she/her pronoun and out-recalls a quietly-named real subject on
// raw activation volume alone (its own name recurs in nearly every
// sentence). Measured on a hand-authored adversarial fixture: 6/6 of a
// quiet subject's own she/her pronouns stolen by a wire-service apparatus
// this way (scripts/adversarial/challenge-23-apparatus-demotion-regression-npr-bug-cl.mjs).
// Clause-locality is the same discipline every other binding decision in
// this file already applies (one-hop recall, not whole-document lift) —
// tightened to the syntactic domain the heuristic's own header always meant:
// a pronoun and the name it echoes belong to the same clause, not merely
// the same sentence. `CLAUSE_OPENER_RE` is a small CLOSED grammatical
// class (English subordinators and relative pronouns), not a sampled
// open-class vocabulary — the same kind of hardcoded closed set this file
// already keeps for THIRD_PERSON_SINGULAR itself; closed classes don't grow,
// which is exactly what made relations.js's hand verb list wrong and is
// exactly what makes this list safe.

import { tokens, codeOf, recall, encodeFrame } from "../../memory/activation.js";
import { adjudicate, nullAdjudicate, CONTEST_VERDICTS } from "../../kernel/contest.js";
import { createActivation } from "../../kernel/activation.js";
import { THIRD_PERSON_SINGULAR, THIRD_PERSON_SINGULAR_META, CLAUSE_OPENERS } from "./priors.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — a pronoun bound to a referent by one-hop recall,
// the same cell activation.js's own readForward and referents/index.js's
// projectReferents already occupy: binding a passage to the structure it
// belongs with. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest-surface-first, whole-form matching — the same boundary rule
// host/corpus.js::occurrenceMatcher and relations.js's SURFACE_RE already
// use, so "Victor Frankenstein" claims its sentence over "Victor" alone, and
// a matched possessive clitic ("Victor's") is recognised without being
// double-counted as a second surface.
const surfaceMatcher = (surfaces) => {
  const uniq = [...new Set(surfaces.filter(Boolean).map(String))].sort((a, b) => b.length - a.length);
  if (!uniq.length) return null;
  const alts = uniq.map(escapeRe).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?:['’]s?)?(?![\\p{L}\\p{N}])`, "gu");
};

// Returns every (referent, index) a surface was matched at, not just the
// deduplicated set — gender-evidence collection below needs the POSITION of
// the naming, not only which referent was named, to test clause-locality
// against a co-occurring pronoun.
const namedMatchesIn = (text, matcher, surfaceToReferent) => {
  const matches = [];
  if (!matcher) return matches;
  matcher.lastIndex = 0;
  let m;
  while ((m = matcher.exec(text))) {
    const bare = m[0].replace(/['’]s?$/i, "");
    const ref = surfaceToReferent.get(bare) ?? surfaceToReferent.get(m[0]);
    if (ref) matches.push({ ref, index: m.index });
  }
  return matches;
};

// A small, CLOSED grammatical class — English subordinators and relative
// pronouns that open a new clause. Not a sampled open-class vocabulary (see
// the section header above): this list cannot grow the way a verb list
// would, because it is the whole closed set, not a sample of one.
// "to" is included as the non-finite counterpart of the finite
// complementizers above — "declined ... to make her available" opens a
// to-infinitive clause exactly the way "declined ... that she be made
// available" would open a finite one with "that". Same phenomenon
// (subordinate-clause introduction), different, still-closed realization.
// ONE class, not two copies: the list itself now lives in the prior
// register (priors.js CLAUSE_OPENERS, giver lang/en) so every reader of
// English clause structure sees the same closed set. The regex is built
// FROM it rather than restated beside it — a second literal is exactly the
// drift this repo's own postmortems keep catching.
const CLAUSE_OPENER_RE = new RegExp(`\\b(?:${[...CLAUSE_OPENERS].join("|")})\\b`, "i");

// True only when the stretch of TEXT strictly between two positions carries
// no clause boundary: no comma/semicolon/colon/quotation mark, and no
// subordinator or relative pronoun opening a new clause. Order-independent —
// callers pass a naming index and a pronoun index in whichever order they
// occur.
export const sameClause = (text, i, j) => {
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  const between = text.slice(lo, hi);
  if (/[,;:"“”]/.test(between)) return false;
  return !CLAUSE_OPENER_RE.test(between);
};

// MIN_OBSERVATIONS: the noise floor below which a single treebank
// attestation does not earn a pronoun form a hard gender gate. Mirrors
// binding.js's structural minimum (one observation is not a distribution,
// 2 is the same floor emergence/binding.js already uses for co-arrival),
// reused rather than re-derived, and never tuned against a golden's score.
const MIN_OBSERVATIONS = 2;

// How many genders a form must land on (excluding the treebank's "_" for
// languages that simply do not mark a given form's gender) to be called
// CLEAN — i.e. certain enough to veto a referent on gender. Structural,
// not tuned: a form is clean only when its own treebank gave it exactly ONE
// attested gender AND exactly one number (Singular) AND that gender is
// attested at least MIN_OBSERVATIONS times. Everything else — a genuinely
// Masc/Neut-split form (Russian него/ему), an all-"_" plural (они/их,
// English they/them), a below-floor noise form (a typo the treebank tagged
// PRON at count 1) — is SOFT: it may prefer a gender-compatible referent by
// margin but may not veto a strongly-activated one on its own unsureness.
// The honesty of the gate scales with the certainty of the pronoun's own
// classification; a pronoun whose gender the treebank itself is unsure of
// does not get to refuse a referent on the strength of that unsureness.
export const normalizePronounClass = (pronounClass) => {
  const out = new Map(); // token -> { gender: "m"|"f"|"n"|"x"|"unknown", clean: boolean }

  // Default: THIS file's own received English closed class (priors.js,
  // giver lang/en) — every member clean, exactly the standing behaviour.
  if (pronounClass === undefined || pronounClass === null) {
    for (const [token, gender] of Object.entries(THIRD_PERSON_SINGULAR)) {
      out.set(token, { gender, clean: true });
    }
    return out;
  }

  // Plain object { token: gender } — a caller-provided "all-clean" class,
  // the same shape THIRD_PERSON_SINGULAR has; every member hard-gated.
  if (typeof pronounClass === "object" && pronounClass.forms === undefined) {
    for (const [token, gender] of Object.entries(pronounClass)) {
      out.set(token, { gender, clean: true });
    }
    return out;
  }

  // A derived register — the shape build-pronoun-prior.mjs writes
  // (PronounPrior@1): { forms: { token: { gender:{}, number:{} } },
  //   provenance }. Clean is COMPUTED from the treebank's own attestation,
  // as described above; never tuned.
  const TREE = { Masc: "m", Fem: "f", Neut: "n" };
  for (const [token, stats] of Object.entries(pronounClass.forms)) {
    const g = stats.gender ?? {};
    const num = stats.number ?? {};
    const attested = Object.entries(g).filter(([k]) => k !== "_");
    const genders = attested.map(([k]) => TREE[k]).filter(Boolean);
    const onlyMasc = attested.length === 1 && attested[0][0] === "Masc";
    const onlyFem = attested.length === 1 && attested[0][0] === "Fem";
    const onlyNeut = attested.length === 1 && attested[0][0] === "Neut";
    const singularOnly = Object.keys(num).length === 1 && num.Sing !== undefined;
    const aboveFloor = (attested[0]?.[1] ?? 0) >= MIN_OBSERVATIONS;

    const clean =
      singularOnly &&
      aboveFloor &&
      (onlyMasc || onlyFem || onlyNeut);

    let gender;
    if (onlyMasc) gender = "m";
    else if (onlyFem) gender = "f";
    else if (onlyNeut) gender = "n";
    else if (genders.length === 1) gender = genders[0]; // single attested non-"_", not masc/fem/neut-clean (e.g. below floor) — still its only attested label
    else if (genders.length > 1) gender = "unknown"; // genuinely split: _either_ gender, may not demand one
    else {
      // no non-"_" gender at all — plural/undefined forms (they, они) that
      // carry no gender, OR a form only ever attested "_".
      const allPlural = Object.keys(num).length === 1 && num.Plur !== undefined;
      gender = allPlural ? "x" : "unknown";
    }

    out.set(token, { gender, clean });
  }
  return out;
};

// A count of a derived register's gender disagreement is only legible with
// its denominator — same standing as resolvePronouns's frame totals.
export const registerSummary = (normalized) => {
  let clean = 0; let soft = 0;
  for (const { clean: c } of normalized.values()) c ? clean++ : soft++;
  return { clean, soft };
};

const findInClass = (text, pronounClass) => {
  const tokens = [...pronounClass.keys()];
  if (!tokens.length) return [];
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  // Boundary that treats every letter (including non-ASCII scripts like the
  // Cyrillic of a Russian pronoun register) as a word character. js's `\b`
  // recognises
  // only [A-Za-z0-9_], so against Cyrillic text `\bон\b` never matches — the
  // register would load fine yet bind nothing. A Unicode-aware lookaround
  // boundary (\p{L}\p{N} either side) is byte-identical to `\b` for the
  // ASCII English closed class this file has always shipped with.
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${sorted.map(escapeRe).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  const hits = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const token = m[0].toLowerCase();
    const rec = pronounClass.get(token);
    if (!rec) continue;
    hits.push({ token, gender: rec.gender, clean: rec.clean, index: m.index });
  }
  return hits;
};

// A per-language registry, so a second closed class is a new entry, not a
// redesign. Each entry restates its own `giver` from priors.js's own META
// export rather than declaring a second one here — one place names the
// source (Amendment IV). Today this holds exactly one language, which is a
// fact about what this codebase has RECEIVED so far, never an assumption
// that a third-person-singular pronoun only exists in English: a caller
// that declares a material's language gets an honest gap for any language
// with no registered prior, on the same terms S6/S16 already hold for a
// medium with no adapter — never a silent attempt with the wrong grammar.
const PRONOUN_PRIORS = Object.freeze({
  en: Object.freeze({
    re: /\b(he|him|his|himself|she|her|hers|herself)\b/gi,
    table: THIRD_PERSON_SINGULAR,
    giver: THIRD_PERSON_SINGULAR_META.giver,
  }),
});

/** The declared pronoun prior for a language, or null — never a guess. */
const pronounPriorFor = (language) => PRONOUN_PRIORS[String(language ?? "en").toLowerCase()] ?? null;

/**
 * Third-person-singular pronoun mentions in `text`, under EITHER class
 * source — the merge of two streams that landed the same week and answer
 * different questions about the same closed class:
 *
 *   - a LANGUAGE string (S39's stream): which language's pronoun system
 *     applies. The registry is the RECEIVED prior — hand-declared table,
 *     giver named — and an unregistered language returns no hits, the
 *     declared-not-accidental outcome S39's own tests pin.
 *   - a MEASURED class (the treebank stream): where the gender table comes
 *     from. A PronounPrior@1 register (or a pre-normalized Map) carries its
 *     own attestation counts, and MIN_OBSERVATIONS decides which forms earn
 *     a hard gender gate.
 *
 * Precedence is S17's own rule, stated once here and reused at every entry
 * point: the received registry stands until a measured class is supplied;
 * a caller-declared class outranks it. One FINDER serves both — findInClass
 * builds its Unicode-aware boundary from the class's own tokens, which is
 * byte-equivalent to the old \b regex for English and is what lets a
 * Cyrillic register actually match (js's \b knows only ASCII). Registry
 * hits therefore carry `clean: true` exactly as the hand-declared class
 * always implied; measured hits carry whatever their attestation earned.
 */
export const findThirdPersonSingular = (text, classOrLanguage = "en") => {
  if (typeof classOrLanguage === "string") {
    const prior = pronounPriorFor(classOrLanguage);
    if (!prior) return [];
    return findInClass(text, normalizePronounClass(prior.table));
  }
  const cls = classOrLanguage instanceof Map ? classOrLanguage : normalizePronounClass(classOrLanguage);
  return findInClass(text, cls);
};

// Activation.js's own declared operating point (IDF_FLOOR, MIN_LEN inside
// activation.js) is not exported, so the encode/recall calls below leave
// `idfFloor`/`minLen` undefined when the caller does not override them —
// `codeOf`'s own default parameters apply, exactly as they do for every other
// caller of `codeOf`. `completion`/`topEdges`/`edgeSlots` DO need concrete
// numbers at this call site (readForward's own defaults are internal to that
// function, not exported constants), so the values here are readForward's
// own declared defaults, restated rather than reinvented.
const DEFAULT_COMPLETION = 0.5;
const DEFAULT_TOP_EDGES = 6;
const DEFAULT_EDGE_SLOTS = 24;

/**
 * Bind third-person singular pronouns to a referent by one-hop activation
 * recall over the cast `discoverReferents` already admitted.
 *
 * @param {Array<{text: string, offset: number, order: number}>} sentences
 *   sentence-level frames in reading order (spans.js::splitSentences).
 * @param {Map<string,string>|Record<string,string>} referentSurfaces surface
 *   -> referentId, e.g. built from discoverReferents(...).events' DEF.admit
 *   records. Name-variant coreference is engine-tier and already complete;
 *   this file adds no surfaces of its own to that map.
 * @param {object} options
 * @param {number} options.minActivation declared floor a candidate's recall
 *   must clear. Never defaulted: how much echo counts as real is a property
 *   of the reading, not a constant this file assumes for every caller.
 * @param {number} options.minMargin declared lead the top candidate must hold
 *   over the runner-up, as a fraction of the top score. Never defaulted, for
 *   the same reason.
 * @param {string} [options.language="en"] the material's declared language.
 *   Defaults to "en", matching every existing caller — behaviour is
 *   byte-identical when omitted. A language with no registered pronoun
 *   prior (`PRONOUN_PRIORS` above) returns immediately with zero bindings
 *   and one typed gap, rather than running English patterns against text
 *   they were never declared to describe.
 * @returns {{bindings: Array<object>, gaps: Array<object>}} every resolved
 *   pronoun mention, and every one that was not — a gap is a result.
 */
export const resolvePronouns = (
  sentences,
  referentSurfaces,
  {
    minActivation,
    minMargin,
    language = "en",
    idfFloor,
    minLen,
    completion = DEFAULT_COMPLETION,
    topEdges = DEFAULT_TOP_EDGES,
    edgeSlots = DEFAULT_EDGE_SLOTS,
    // Referent ids the CALLER already knows are not persons — an
    // organisation, a narrating apparatus, anything typed outside the range
    // a third-person-singular personal pronoun could ever legitimately
    // point at. Never derived here (this file has no notion of
    // individuation type); received exactly the way minActivation/minMargin
    // are, on the same terms host/corpus.js's own comment already states
    // for individuation generally: "the caller sees [it] and applies its
    // own policy." Treated as a hard filter alongside gender, not a
    // tiebreak — the same discipline gender already gets.
    nonPersonal,
    // The bar a frame CARRYING CO-PRESENT NAMES must clear. Declared, never
    // defaulted, and its ABSENCE is itself a declared regime, the same way
    // activation.js's `window: null` is the explicit undecayed reader:
    //
    //   absent  -> REFUSED regime. A frame carrying any named surface is
    //              skipped without adjudication. This is the behaviour this
    //              organ shipped with, kept as a named control arm rather
    //              than deleted, because it is the only arm whose numbers
    //              every prior measurement in this repo was taken under.
    //   number  -> ADJUDICATED regime. Co-presence stops vetoing and starts
    //              raising the bar; kernel/contest.js::adjudicate decides.
    //
    // Which regime ran is reported back on every call (`regime` in the
    // return), so a caller can never read a binding count without also
    // being told which denominator produced it — the reporting failure the
    // Borodino measurement exposed.
    contestedMargin,
    // The criterion fix. When declared — `{ draws, seed, alpha }`, each on
    // the same never-defaulted terms as every other Born gate here — the
    // constant-margin check is REPLACED by kernel/contest.js::nullAdjudicate:
    // the lead is tested against this material's own permutation null
    // instead of against minMargin. Measured reason (2026-08-29): a
    // constant bar rewards a sparse field — scrambled text binds at 76-106%
    // of the real rate across four materials — so a rising binding count
    // under the constant was never evidence of reading. Absent, the shipped
    // constant-margin behaviour runs byte-identically.
    nullTest,
    // The co-present arbiter (choice b — activation arbitrates co-present):
    // in the adjudicated regime, when the thematic one-hop recall comes back
    // with NO candidate for a frame that still carries a pronoun the reader
    // reached, fall back to the reader's own decaying PRESENCE to pick among
    // the co-present named set. The thematic scorer is silent on generic
    // prose (its floor needs repeated distinctive vocabulary); presence is
    // not — the most recently present compatible being is the honest answer
    // to "whom did the reader just have in hand?" when thematic recall has
    // nothing to say. Declared, never defaulted, on the same Born terms as
    // every other gate here: a window, a floor in ARRIVAL units (one full
    // naming, undecayed), and a margin over the next-hottest co-present
    // being. Absent, the adjudicated regime's bare `pronoun_no_candidate`
    // behaviour runs unchanged.
    // Presence gates for the co-present arbiter, DECLARED never defaulted —
    // the same standing minActivation/minMargin already hold in this organ,
    // and this file's own header says it outright: "how much activation
    // makes a binding is a property of the reading, not a constant this
    // file gets to assume." window in sentences-as-observed (the kernel's
    // createActivation unit), activationFloor in ARRIVAL units (1 = one full
    // naming, undecayed), activationMargin over the next-hottest co-present
    // being.
    window,
    activationFloor,
    activationMargin,
    createActivation: createActivationFn = undefined,
    // The third-person pronoun class to read against. Absent-caller defaults
    // to THIS file's own received English closed class (priors.js,
    // THIRD_PERSON_SINGULAR, giver lang/en) — every member clean and
    // hard-gated, exactly the standing behaviour. A caller reading a
    // different language's material injects that language's OWN register
    // (a PronounPrior@1 shipped with the corpus in live_priors, built by
    // live_priors/scripts/build-pronoun-prior.mjs) — never a second hardcoded
    // English list standing in for a language it was never measured against (the
    // same seam relations.js's negationWords already opens). Each member's
    // `clean` flag (clean -> gender vetoes, soft -> gender prefers) is
    // computed from the treebank's own attestation, not hand-declared.
    pronounClass = undefined,
  } = {},
) => {
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("resolvePronouns: minActivation is declared — how much recall counts as a real echo is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1)
    throw new TypeError("resolvePronouns: minMargin is declared — how far a candidate must lead the runner-up is never a default");

  if (nullTest !== undefined && nullTest !== null) {
    if (!Number.isInteger(nullTest.draws) || nullTest.draws < 1 || !Number.isFinite(nullTest.seed) || !Number.isFinite(nullTest.alpha) || nullTest.alpha <= 0 || nullTest.alpha >= 1)
      throw new TypeError("resolvePronouns: nullTest, when declared, carries draws (integer >= 1), seed and alpha in (0,1) — Born-gate dials are never defaulted");
  }

  const adjudicated = contestedMargin !== undefined && contestedMargin !== null;
  if (adjudicated && (!Number.isFinite(contestedMargin) || contestedMargin < minMargin || contestedMargin > 1))
    throw new TypeError("resolvePronouns: contestedMargin, when declared, is a fraction in [minMargin, 1] — a frame carrying competitors is never the easier case");

  // A language with no registered pronoun prior is a fact about what this
  // codebase has received, never a reason to run English patterns against
  // it and call whatever fails to match "no pronouns here." One typed gap,
  // reported once for the whole call — not one per sentence, which would
  // bury a single true fact (this language is unsupported) inside a pile of
  // repeated ones. The same denominator discipline S22 built for co-presence
  // applies here: "never attempted" and "attempted and found nothing" must
  // never share a bucket, so `regime.name` names this case distinctly from
  // both the refused and adjudicated regimes below.
  // S17 precedence, the merge's one rule: the received registry stands until
  // a MEASURED class is supplied; a caller-declared pronounClass outranks it,
  // so the unsupported-language gap fires only when there is truly nothing —
  // no registry entry AND no measured class — never as a veto over evidence
  // the caller brought.
  if (pronounClass === undefined && !pronounPriorFor(language)) {
    return {
      bindings: [],
      gaps: [{
        reason: "no_pronoun_prior_for_language",
        tier: "engine",
        language,
        detail: `no pronoun prior is declared for language "${language}" — nothing was attempted, which is not the same fact as nothing being found`,
      }],
      regime: {
        name: "unsupported_language",
        language,
        criterion: null,
        contestedMargin: null,
        minActivation,
        minMargin,
        framesWithPronouns: 0,
        framesCoPresent: 0,
        framesAdjudicated: 0,
        basis: `no pronoun prior is declared for language "${language}" — the material was never scanned for third-person-singular pronouns`,
      },
    };
  }

  // The kernel's verdict vocabulary is medium-general; this organ's gap
  // names are its own and predate it. One map, so the kernel never has to
  // know what a pronoun is and this file never has to restate a verdict.
  const GAP_REASON = {
    [CONTEST_VERDICTS.NO_CANDIDATE]: "pronoun_no_candidate",
    [CONTEST_VERDICTS.BELOW_FLOOR]: "pronoun_below_floor",
    [CONTEST_VERDICTS.NO_MARGIN]: "pronoun_no_margin",
    [CONTEST_VERDICTS.CONTESTED_NO_MARGIN]: "pronoun_contested_no_margin",
    [CONTEST_VERDICTS.NULL_NOT_CLEARED]: "pronoun_null_not_cleared",
  };

  const nonPersonalSet = nonPersonal instanceof Set ? nonPersonal : new Set(nonPersonal ?? []);
  const surfaceToReferent = referentSurfaces instanceof Map ? referentSurfaces : new Map(Object.entries(referentSurfaces ?? {}));
  const matcher = surfaceMatcher([...surfaceToReferent.keys()]);
  const cls = pronounClass !== undefined
    ? (pronounClass instanceof Map ? pronounClass : normalizePronounClass(pronounClass))
    : normalizePronounClass(pronounPriorFor(language).table);

  // The co-present arbiter's presence tracker. Declared all-or-nothing: if
  // the caller gives a window it must give the floor and margin too, and
  // vice-versa — a partial declaration would make half the gate a
  // back-door default, which this file's header forbids outright.
  const arbitrationRequested = window !== undefined && window !== null;
  if (arbitrationRequested || activationFloor !== undefined || activationMargin !== undefined) {
    if (!arbitrationRequested)
      throw new TypeError("resolvePronouns: window, activationFloor and activationMargin are declared together — the co-present arbiter is never half-declared");
    if (createActivationFn !== undefined && typeof createActivationFn !== "function")
      throw new TypeError("resolvePronouns: createActivation, when given, is the kernel's own — a function, never a private reimplementation");
    if (!Number.isFinite(activationFloor) || activationFloor < 0)
      throw new TypeError("resolvePronouns: activationFloor is declared — how faint a past presence still binds never defaults");
    if (!Number.isFinite(activationMargin) || activationMargin < 0 || activationMargin > 1)
      throw new TypeError("resolvePronouns: activationMargin is declared — how far a past presence must lead the runner-up never defaults");
  }
  const presence = arbitrationRequested
    ? (createActivationFn ?? createActivation)({ window })
    : null;

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const namedByFrame = new Map(); // sentence order -> Set(referentId) named in it
  const genderEvidence = new Map(); // referentId -> { m, f }

  const bindings = [];
  const gaps = [];
  let framesWithPronouns = 0;
  let framesCoPresent = 0;

  const referentGender = (r) => {
    const ev = genderEvidence.get(r);
    if (!ev) return "unknown";
    if (ev.m > 0 && ev.f === 0) return "m";
    if (ev.f > 0 && ev.m === 0) return "f";
    return "unknown"; // no evidence, or genuinely contested — never guessed
  };

  for (const sentence of sentences ?? []) {
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });

    const namedMatches = namedMatchesIn(sentence.text, matcher, surfaceToReferent);
    const named = new Set(namedMatches.map((n) => n.ref));
    const pronounHits = findInClass(sentence.text, cls);

    // REFUSED regime (contestedMargin absent): resolve only the case the
    // original complaint names — a frame carried by a pronoun with NO name
    // anywhere in it. ADJUDICATED regime (contestedMargin declared): every
    // frame carrying a pronoun is read, and co-presence raises the bar
    // instead of closing the door. The `refused_co_present` gap below is
    // what makes the refused regime's own denominator visible.
    // A frame the refused regime never adjudicated does NOT produce a gap.
    // A gap is a refusal the organ REACHED — "I read this and could not
    // decide." Filing one for a frame that was never read would conflate
    // the two, and this whole fix exists because a count that hides its
    // denominator misleads. The denominator lives in `regime` below, where
    // it is a count of frames and cannot be mistaken for a verdict.
    if ((adjudicated || named.size === 0) && pronounHits.length > 0) {
      const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
      // BEST single hop, not a sum across every hop — the same discipline
      // activation.js's own `recall`/rerank pairing already keeps
      // (rerank's own `top: scored[0]`, its header: "which of them placed
      // something the other did not," never a running total). This file's
      // header calls the mechanism "one recurrent hop" and "one-hop
      // activation recall," singular, for the same reason: summing a
      // referent's credit across every frame that happens to name it lets a
      // referent recalled from MANY weak, incidental frames (a byline
      // stapled onto nearly every sentence) outscore one recalled from a
      // FEW strong, specific frames — rewarding ubiquity of naming, not
      // strength of resemblance. Measured: without this, a quiet real
      // subject's own she/her pronouns lost 6/6 to a narrating apparatus
      // whose name recurred in nearly every frame, even after the
      // same-clause gender fix above closed the mistagging path
      // (scripts/adversarial/challenge-23-apparatus-demotion-regression-npr-bug-cl.mjs).
      const referentScore = new Map();
      for (const [order, amt] of activation) {
        const refs = namedByFrame.get(order);
        if (!refs) continue;
        for (const r of refs) {
          if (amt > (referentScore.get(r) ?? -Infinity)) referentScore.set(r, amt);
        }
      }

      for (const hit of pronounHits) {
        const offset = (sentence.offset ?? 0) + hit.index;

        // The two hard filters this file already owned — individuation type
        // and gender — are handed to the kernel AS A FILTER. The NEW
        // distinction (2026-08-29, the recover-from-misgendering contract):
        // gender is hard ONLY when the pronoun's own classification is
        // certain. A CLEAN pronoun (single well-attested gender, singular —
        // English he/she) vetoes a referent of a different gender exactly as
        // before. A SOFT pronoun (its register carries genuine ambiguity —
        // Russian него is Masc AND Neut; или они/их carry no gender at all —
        // or it sits below the treebank noise floor) may PREFER a compatible
        // referent by margin but may not veto a strongly-evidenced one on
        // its own unsureness. The honesty of the gate scales with the
        // certainty of the pronoun's classification; a pronoun whose gender
        // the treebank itself is unsure of does not get to refuse a
        // referent on the strength of that unsureness. recorded on the hit
        // by normalizePronounClass, never hand-declared per occurrence.
        const admissible = (r) => {
          if (nonPersonalSet.has(r)) return false;
          const g = referentGender(r);
          if (hit.clean) return g === "unknown" || g === hit.gender;
          return true; // soft pronoun: veto nothing; the kernel's margin picks
        };

        const verdict = nullTest
          ? nullAdjudicate({
              activation,
              frameMembers: namedByFrame,
              coPresent: adjudicated ? named : [],
              minActivation,
              draws: nullTest.draws,
              seed: (nullTest.seed ^ (sentence.order * 2654435761)) >>> 0, // per-frame stream off one declared seed
              alpha: nullTest.alpha,
              admissible,
            })
          : adjudicate({
              scores: referentScore,
              // Co-presence is the frame's own membership, supplied by this
              // adapter because only the adapter knows what "named in this
              // frame" means for text. In the REFUSED regime nothing is
              // co-present by construction (named.size === 0 above), so the
              // contested bar is never reached and the pre-fix numbers stand.
              coPresent: adjudicated ? named : [],
              minActivation,
              minMargin,
              contestedMargin: adjudicated ? contestedMargin : minMargin,
              admissible,
            });

        // ── the co-present arbiter (choice b: activation arbitrates
        // co-present). The thematic one-hop scorer is silent on generic
        // prose — it needs repeated distinctive vocabulary to cross its
        // floor, and a quiet history sentence like "His heart was heavy that
        // year, yet he masked the weight of it" recalls nothing. In a frame
        // the reader REACHED (adjudicated regime), with a pronoun and
        // co-present names, that silence would otherwise file a bare
        // `pronoun_no_candidate` — honest but useless, when the most
        // recently present compatible co-present being is the answer the
        // reader actually has in hand. When the presence tracker is engaged,
        // treat a thematic NO_CANDIDATE as the reader turning to the present:
        // pick the hottest ADMISSIBLE co-present referent, gate it by
        // activationFloor and activationMargin, bind if it clears — exactly
        // the floor-then-margin ladder the activation arm itself runs. Only
        // the ADJUDICATED regime sees this fallback: the refused regime is
        // by construction frames with no name at all, where there is no
        // co-present set to arbitrate over.
        let verdictOut = verdict;
        if (
          adjudicated &&
          verdict.verdict === CONTEST_VERDICTS.NO_CANDIDATE &&
          presence
        ) {
          const coPresentCandidates = [...named]
            .map((r) => [r, presence.activationOf(r)])
            .filter(([r]) => admissible(r))
            .sort((a, b) => b[1] - a[1]);
          if (coPresentCandidates.length > 0) {
            const [topId, topScore] = coPresentCandidates[0];
            const second = coPresentCandidates[1]?.[1] ?? 0;
            const margin = topScore > 0 ? (topScore - second) / topScore : 0;
            if (topScore < activationFloor) {
              verdictOut = {
                verdict: CONTEST_VERDICTS.BELOW_FLOOR,
                id: topId,
                score: topScore,
                margin: null,
                runnerUp: coPresentCandidates[1]?.[0] ?? null,
                contested: [...named],
                barApplied: activationFloor,
                detail: `thematic recall silent; hottest co-present being's presence (${topScore.toFixed(3)}) does not clear activationFloor (${activationFloor})`,
              };
            } else if (margin < activationMargin) {
              verdictOut = {
                verdict: CONTEST_VERDICTS.CONTESTED_NO_MARGIN,
                id: topId,
                score: topScore,
                margin,
                runnerUp: coPresentCandidates[1]?.[0] ?? null,
                contested: [...named],
                barApplied: activationMargin,
                detail: `thematic recall silent; the two most present co-present beings are too close (${(margin * 100).toFixed(1)}% apart), short of activationMargin (${(activationMargin * 100).toFixed(1)}%)`,
              };
            } else {
              verdictOut = {
                verdict: CONTEST_VERDICTS.BOUND,
                id: topId,
                score: topScore,
                margin,
                runnerUp: coPresentCandidates[1]?.[0] ?? null,
                contested: [...named],
                barApplied: activationMargin,
                detail: `bound to the most present compatible co-present being by presence (${(margin * 100).toFixed(1)}%), thematic recall having nothing to say`,
              };
            }
          }
        }

        if (verdictOut.verdict !== CONTEST_VERDICTS.BOUND) {
          gaps.push({
            reason: GAP_REASON[verdictOut.verdict],
            tier: "engine",
            sentenceOrder: sentence.order,
            offset,
            pronoun: hit.token,
            top: verdictOut.id,
            runnerUp: verdictOut.runnerUp,
            activation: verdictOut.score,
            margin: verdictOut.margin,
            p: verdictOut.p ?? null,
            coPresent: verdictOut.contested,
            barApplied: verdictOut.barApplied,
            detail: verdictOut.detail,
          });
          continue;
        }

        bindings.push({
          referentId: verdictOut.id,
          sentenceOrder: sentence.order,
          offset,
          pronoun: hit.token,
          gender: hit.gender,
          activation: verdictOut.score,
          margin: verdictOut.margin,
          p: verdictOut.p ?? null,
          coPresent: verdictOut.contested,
          barApplied: verdictOut.barApplied,
          provenance: {
            giver: "perceiver/text/pronouns::resolvePronouns",
            tier: "engine",
            basis: verdictOut.contested.length > 0
              ? "one-hop activation recall over the already-admitted cast, adjudicated against co-present names at the contested bar (kernel/contest.js)"
              : "one-hop activation recall over the already-admitted cast",
          },
        });
      }
    }

    // Feed the presence tracker the frame's names AFTER adjudicating it
    // (causal: a sentence's own naming informs later sentences' present,
    // never its own — the same ordering the activation arm already keeps).
    // Silence is still a tick, exactly as the activation arm models it: a
    // sentence naming nobody is time passing for everyone.
    if (presence) presence.observe([...named]);

    // Gender evidence: only when exactly one referent is named alongside a
    // pronoun in the SAME sentence, AND that pronoun sits in the same
    // clause as (at least one occurrence of) the naming — the one case
    // where the signal is actually clean. Same sentence alone is not enough
    // (see the section header above): an attribution clause can put the
    // sentence's only literally-named surface nowhere near the clause the
    // pronoun's antecedent actually lives in. Causal: this only ever
    // informs LATER sentences' candidate filtering, never the one it was
    // read from.
    if (named.size === 1 && pronounHits.length > 0) {
      const [only] = named;
      const spansForOnly = namedMatches.filter((n) => n.ref === only).map((n) => n.index);
      const ev = genderEvidence.get(only) ?? { m: 0, f: 0 };
      for (const hit of pronounHits) {
        if (spansForOnly.some((idx) => sameClause(sentence.text, idx, hit.index))) ev[hit.gender]++;
      }
      genderEvidence.set(only, ev);
    }

    if (pronounHits.length > 0) {
      framesWithPronouns += 1;
      if (named.size > 0) framesCoPresent += 1;
    }

    namedByFrame.set(sentence.order, named);
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }

  // A binding count without its denominator is unreadable — the whole
  // reason this fix exists. Every caller gets told how many frames could
  // have been read, how many carried competitors, and which regime ran.
  return {
    bindings,
    gaps,
    regime: {
      name: adjudicated ? "adjudicated" : "refused",
      criterion: nullTest ? { kind: "permutation-null", draws: nullTest.draws, alpha: nullTest.alpha, seed: nullTest.seed } : { kind: "constant-margin", minMargin },
      contestedMargin: adjudicated ? contestedMargin : null,
      minActivation,
      minMargin,
      framesWithPronouns,
      framesCoPresent,
      framesAdjudicated: adjudicated ? framesWithPronouns : framesWithPronouns - framesCoPresent,
      basis: adjudicated
        ? "co-presence raises the bar (kernel/contest.js::adjudicate); every pronoun-bearing frame was read"
        : "co-presence vetoes; frames carrying a named surface were skipped without adjudication",
    },
  };
};

/**
 * resolvePronounsByActivation — the SECOND mechanism, beside the thematic
 * one above: bind a pronoun to the hottest gender-compatible being in the
 * reader's own decaying present, the way incremental human reading is
 * usually modelled (the most activated antecedent wins; too faint or too
 * contested refuses). The kernel's createActivation IS the gradient — one
 * tick per sentence, the declared fold unit — so this file adds no decay
 * arithmetic of its own.
 *
 * EVERYTHING ELSE IS SHARED with resolvePronouns, deliberately: the same
 * closed pronoun class, the same surface matcher, the same clause-local
 * gender evidence, the same nameless-sentence scope, the same
 * floor-then-margin refusal ladder with the same gap vocabulary. The two
 * differ in ONE dimension — what "recall" means (thematic echo vs decayed
 * recency) — so a comparison between them on real material measures that
 * dimension and nothing else.
 *
 * `window` is the reach of the present (measured by dmdWindow or declared
 * with its reason — S5); `minActivation` here is in ARRIVAL units (1 = one
 * full naming, undecayed), a different scale from the thematic arm's recall
 * score, which is why it is the caller's to declare separately.
 *
 * `language` (default "en") is the material's declared language, on the
 * same terms `resolvePronouns` above holds it: a language with no
 * registered pronoun prior returns immediately with a typed gap, never a
 * silent English-pattern attempt.
 */
export const resolvePronounsByActivation = (
  sentences,
  referentSurfaces,
  { window, minActivation, minMargin, language = "en", nonPersonal, createActivation, pronounClass = undefined } = {},
) => {
  if (typeof createActivation !== "function")
    throw new TypeError("resolvePronounsByActivation: createActivation is injected — the kernel's own gradient, never a private reimplementation (S6)");
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("resolvePronounsByActivation: minActivation is declared — how faint still binds is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1)
    throw new TypeError("resolvePronounsByActivation: minMargin is declared — how far a candidate must lead is never a default");

  // See resolvePronouns's own comment on this exact check: one typed gap
  // for the whole call, never a silent per-sentence non-match.
  // S17 precedence, the merge's one rule: the received registry stands until
  // a MEASURED class is supplied; a caller-declared pronounClass outranks it,
  // so the unsupported-language gap fires only when there is truly nothing —
  // no registry entry AND no measured class — never as a veto over evidence
  // the caller brought.
  if (pronounClass === undefined && !pronounPriorFor(language)) {
    return {
      bindings: [],
      gaps: [{
        reason: "no_pronoun_prior_for_language",
        tier: "engine",
        language,
        detail: `no pronoun prior is declared for language "${language}" — nothing was attempted, which is not the same fact as nothing being found`,
      }],
    };
  }

  const nonPersonalSet = nonPersonal instanceof Set ? nonPersonal : new Set(nonPersonal ?? []);
  const surfaceToReferent = referentSurfaces instanceof Map ? referentSurfaces : new Map(Object.entries(referentSurfaces ?? {}));
  const matcher = surfaceMatcher([...surfaceToReferent.keys()]);
  const cls = pronounClass !== undefined
    ? (pronounClass instanceof Map ? pronounClass : normalizePronounClass(pronounClass))
    : normalizePronounClass(pronounPriorFor(language).table);
  const activation = createActivation({ window });

  const genderEvidence = new Map();
  const referentGender = (r) => {
    const ev = genderEvidence.get(r);
    if (!ev) return "unknown";
    if (ev.m > 0 && ev.f === 0) return "m";
    if (ev.f > 0 && ev.m === 0) return "f";
    return "unknown";
  };

  const bindings = [];
  const gaps = [];
  const seen = new Set(); // every referent ever named — the candidate universe

  for (const sentence of sentences ?? []) {
    const namedMatches = namedMatchesIn(sentence.text, matcher, surfaceToReferent);
    const named = new Set(namedMatches.map((n) => n.ref));
    const pronounHits = findInClass(sentence.text, cls);

    if (named.size === 0 && pronounHits.length > 0) {
      for (const hit of pronounHits) {
        const offset = (sentence.offset ?? 0) + hit.index;
        const candidates = [...seen]
          .filter((r) => !nonPersonalSet.has(r))
          .filter((r) => { if (!hit.clean) return true; const g = referentGender(r); return g === "unknown" || g === hit.gender; })
          .map((r) => [r, activation.activationOf(r)])
          .sort((a, b) => b[1] - a[1]);

        if (candidates.length === 0) {
          gaps.push({ reason: "pronoun_no_candidate", tier: "engine", sentenceOrder: sentence.order, offset, pronoun: hit.token, detail: "no gender-compatible referent has been named yet — nothing in the present to bind to" });
          continue;
        }
        const [topRef, topScore] = candidates[0];
        if (topScore < minActivation) {
          gaps.push({ reason: "pronoun_below_floor", tier: "engine", sentenceOrder: sentence.order, offset, pronoun: hit.token, top: topRef, activation: topScore, detail: `hottest candidate's presence (${topScore.toFixed(3)}) does not clear minActivation (${minActivation}) — everyone has faded` });
          continue;
        }
        const second = candidates[1]?.[1] ?? 0;
        const margin = topScore > 0 ? (topScore - second) / topScore : 0;
        if (margin < minMargin) {
          gaps.push({ reason: "pronoun_no_margin", tier: "engine", sentenceOrder: sentence.order, offset, pronoun: hit.token, top: topRef, runnerUp: candidates[1]?.[0] ?? null, margin, detail: `two beings are comparably present (${(margin * 100).toFixed(1)}% apart) — a human reader would find this ambiguous too` });
          continue;
        }
        bindings.push({
          referentId: topRef, sentenceOrder: sentence.order, offset, pronoun: hit.token, gender: hit.gender,
          activation: topScore, margin,
          provenance: { mechanism: "decayed-presence (kernel createActivation)", window: activation.window ?? window ?? null },
        });
      }
    }

    // The same clause-local gender evidence the thematic arm collects —
    // causal, informing only later sentences.
    if (named.size === 1 && pronounHits.length > 0) {
      const [only] = named;
      const spansForOnly = namedMatches.filter((n) => n.ref === only).map((n) => n.index);
      const ev = genderEvidence.get(only) ?? { m: 0, f: 0 };
      for (const hit of pronounHits) {
        if (spansForOnly.some((idx) => sameClause(sentence.text, idx, hit.index))) ev[hit.gender]++;
      }
      genderEvidence.set(only, ev);
    }

    // One observation per sentence — the observation IS the instant
    // (activation.js's own clock law). A sentence naming nobody still
    // ticks: silence about everyone is time passing for everyone.
    for (const r of named) seen.add(r);
    activation.observe([...named]);
  }

  return { bindings, gaps };
};
