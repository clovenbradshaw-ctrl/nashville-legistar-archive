// widget.js — which build a turn's artifact belongs to.
//
// The problem this exists for, in the user's own words: "So if I'm like 'I
// don't like the colors' or 'it's broken' it's able to modify that particular
// one and not create a net new one."
//
// Before this module, every code segment a turn produced was born as a new
// build (`publishBuild` counted `state.builds.length + 1` and stopped there).
// Feedback on a widget therefore forked it: build 1 the original, build 2 the
// recolour, build 3 the fix — three orphans, no thread, and the append-only
// log of build 1 frozen at the moment the operator first complained.
//
// The routing is MECHANICAL (L5: a compliance-critical fact is never left to
// the model's own instruction-following). The model saying "here is build 3,
// updated" is not evidence of anything — it is the model's phrasing, and
// phrasing is exactly what L5 refuses to trust. The decision is read off two
// things the model does not author: the OPERATOR's own words, and the shape
// of what came back.
//
// ── WHAT THIS FILE IS NOT ALLOWED TO CONTAIN, AND WHY ───────────────────────
//
// The first version of this module decided the question with four hand-typed
// English word lists: presupposing verbs (fix|change|resize|recolour|…),
// creation verbs (make|build|write|…), judgment adjectives
// (broken|ugly|wrong|…), and anaphora. That is precisely the mistake
// relations.js's own header records having made and undone — a 90-word
// hand-listed verb string that was "not a simplification of English, it was a
// sample of it standing in for the whole". Every complaint phrased outside my
// sample would have forked a build, silently, and no test written by the same
// hand that wrote the sample would ever have caught it.
//
// So the lists are gone. What decides now is:
//
//   · CLOSED CLASSES, RECEIVED FROM THE ENGINE'S PRIOR REGISTER
//     (perceiver/text/priors.js — every entry names its giver, Amendment IV).
//     Indefinite determiners INTRODUCE their noun; definite determiners and
//     anaphoric pronouns POINT BACK; NEGATION_WORDS and FIRST_PERSON make a
//     judgment. These are closed classes, so there is no sample standing in
//     for a whole — the class IS the whole.
//
//   · THE BUILD'S OWN BYTES, through retrieval's own fold. A definite noun
//     phrase ("the button", "the counter") lands on a build when the build's
//     own text contains it — the same containment discipline grounding.js and
//     cite.js already hold, sharing tokenize/foldDiacritics so a found word
//     cannot fail the check that should confirm it (CLAUDE.md's diacritics
//     lesson, applied to routing).
//
// No verb is named anywhere below. A verb list could only ever be a sample.
//
// ── WHAT THAT COSTS, STATED RATHER THAN PAPERED OVER ────────────────────────
//
// A definite phrase naming something the artifact does not YET contain does
// not resolve: "change the background to blue" on a widget that has no
// background is not routed, and falls through to a new build. The hand-typed
// verb list caught that case and this does not. It is kept as a stated limit
// rather than bought back with a list, for the reason above — the list would
// also have silently mis-routed every phrasing outside it, and a limit that
// is visible is worth more than a sample that is not. "Make it blue" (an
// anaphor), "I don't like the background" (a judgment), and "build 2" (the
// number) all route, so the affordance is never absent, only narrower.
//
// Morphology folds ONE narrow way: a received inflectional suffix
// (INFLECTIONAL_SUFFIXES, the register's own class, giver lang/en) — "the
// colors" resolves against a build whose bytes say `color:`, "the buttons"
// against `button`. That is the quotient this file is licensed to read;
// there is no stemmer in this engine, and inventing one here (dialect
// spelling, derivational morphology, anything past a received suffix class)
// would be the same mistake at a different altitude. `scoutSpan` shares this
// exact fold with the router (P11: an organ that compares text to text must
// share retrieval's fold), so a term that ROUTES a complaint to a build can
// also SCOPE the edit within it — the two questions read the same bytes.
//
// ── WHAT WAS CONSIDERED AND REFUSED ─────────────────────────────────────────
//
// `extractRelations` + `discoverRelationVocab` (the measured SVO ladder) was
// the first organ reached for, and it is the right organ for prose about
// named entities — which a chat complaint is not. `discoverRelationVocab`
// anchors candidate verbs on capitalised surfaces (extractSurfaces); "I don't
// like the colors" has no surface at all (priors.js::NEVER_A_NAME excludes
// "I"), so the ladder measures an empty vocabulary and extractRelations
// returns nothing. Named here rather than assumed, the way segments.js's
// `outlineOfIndex` was tried and refused on the merits in eoreader6's own
// goldens/network before a new splitter was written.
//
// Pure and browser-safe; organs injected (the cast.js pattern) so the page
// loads the priors from /engine and the node tests load them by relative
// path. Used, never copied.

import { BUILD_MESSAGE_MAX, referencedBuild } from "./builds.js";
import { foldDiacritics, tokenize } from "../organs/source.js";

/**
 * Two tokens are forms of one referent when they are identical or differ by
 * a received inflectional suffix — stated language-free (identity under a
 * received variation class; the class carries the language, with its
 * giver). Shared by the router (`iterationTell`, deciding which build a
 * complaint routes to) and `scoutSpan` (deciding which bytes of that build
 * an edit scopes to) — P11: the two questions read the same bytes and must
 * share the same fold, or a term that finds the build fails to find itself
 * inside it. Engine-side placement of this mechanism is named future work;
 * the class it consumes is already the register's.
 */
function sameForm(a, b, suffixes) {
  if (a === b) return true;
  for (const sfx of suffixes) {
    if (a.length > b.length ? a === b + sfx : b === a + sfx) return true;
  }
  return false;
}

/**
 * A bare numeral — digits alone, or a run of roman-numeral letters — the
 * SAME shape source.js::tokenize's own private `isNumeral` bypasses its
 * length floor for ("a document numbers its own parts with" them: chapter
 * ii, section 4). That is the right call for RETRIEVAL, where a number is
 * exactly what a query addresses a document's own part BY. It is the wrong
 * call for THIS module's content-word check, where the question is never
 * "does this message name a part of the artifact" but "does this message
 * share a discriminating WORD with it" — and a bare number discriminates
 * nothing: a loop counter, an array index, a step tag, a modulo test put a
 * handful of small integers into nearly every program ever written, and an
 * ordinary sentence mentions a number about as often (a date, an age, a
 * quantity, a speaker's own numbered turn).
 *
 * Found live, on the REAL scaffold this repo's own regression suite already
 * fixed one false positive from (widget.test.mjs's "code-piece.js's own
 * python scaffold" case, below): `code-piece.js::skeletonFor`'s `main()`
 * writes an EVA witness line per step — `[step 1 ...]`, `[step 2 ...]` — so
 * a two-step build's own bytes carry "1" and "2" regardless of what the
 * steps actually do. A battery-tested conversation asking about a
 * transcript's two speakers, "Human 1" and "Human 2", matched fold 7 (an
 * unrelated "adds up the first 10 even numbers" build) on exactly those two
 * digits and was routed into its code-revision pipeline instead of
 * answering the question. This is P31's own finding ("a bare digit string
 * is the single-token, referent-less case this instrument had no defense
 * for") one organ over: grounding.js's fix required a number to keep
 * COMPANY with a real word before it counts as support; this fix is the
 * same law read the other way — a bare number keeps no company at all here
 * (this module compares TOKENS, not sentences), so it is refused outright
 * rather than given a company test it has no sentence to pass.
 */
/**
 * The English spelled-out cardinal numbers, zero through twelve — the
 * range ordinary prose and ordinary code comments write OUT rather than as
 * digits (most style conventions spell a dozen or fewer; beyond that,
 * writers reach for digits, which the regexes below already cover). A
 * genuinely closed grammatical class, not an open list — kept local rather
 * than a received prior because no giver exports one; the same standing
 * `IMAGE_REFERRING_WORDS` (app.js) already holds for a closed class this
 * codebase has not received from elsewhere.
 */
const SPELLED_NUMBERS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
]);

/**
 * A bare numeral, digits or spelled out — see this function's own header
 * above for the digit half's full reasoning (P31: "a bare number
 * discriminates nothing"). Extended 2026-09-15: found live, "quick one -
 * what's 5 subtracted from 12?" matched fold 10 on the single WORD "one",
 * present in the build's own model-generated docstring ("one is not
 * considered a prime number") — the identical referent-less shape the
 * digit half already excludes (a loop counter, an array index, a step tag
 * puts a small number into nearly every program; a natural-language aside
 * puts its SPELLED form into nearly every explanatory comment or sentence
 * just as often), one register over. "one" is additionally the single
 * most overloaded word in this set in ordinary English — simultaneously a
 * numeral, an indefinite pronoun ("someone", "no one"), and a bare
 * noun-substitute ("a quick one", "a good one", "which one") — none of
 * which is a genuine reference back to a prior build, unlike a genuine
 * demonstrative ("this"/"that", ANAPHORIC_PRONOUNS) or a definite phrase
 * ("the counter"). Scoped to a CLOSED, small cardinal range rather than an
 * open list of number words for the identical reason the digit half is a
 * regex rather than an enumeration: the shape is what disqualifies it, not
 * a guess at which particular numbers appear in code.
 */
function isBareNumeral(t) {
  return /^\d+$/.test(t) || /^[ivxlcdm]+$/.test(t) || SPELLED_NUMBERS.has(t);
}

/**
 * Strip an html document's own wrapper tags — <!DOCTYPE>, <html>, <head>,
 * <body>, open and close, whatever attributes they carry — never their
 * content. Every html-typed build carries this exact wrapper by
 * construction (P5.3's own container-stripping precedent, applied to this
 * format's boilerplate rather than a corpus's); a token contributed SOLELY
 * by it is common to every such build and can never discriminate one
 * build's content from another's.
 *
 * A SECOND source of the same non-discriminating token, found completing
 * this same measurement live: `known` here is always `caption + "\n" +
 * code` (app.js's `buildWords`), and a caption the operator never renamed
 * defaults to the bare segment language (`defaultCaption`: `seg.lang ||
 * "code"`) — so `known`'s own FIRST LINE is literally "html" for every
 * unrenamed html build, same as the wrapper tags, just arriving through a
 * different field. Stripped only at that exact position (the string's own
 * first line, matching `buildWords`'s own construction) so a real word
 * "html" appearing anywhere in actual content is untouched.
 */
function stripHtmlWrapper(text) {
  return String(text ?? "")
    .replace(/^(?:html|head|body)\s*(?=\n|$)/i, " ")
    .replace(/<!doctype\b[^>]*>/gi, " ")
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, " ");
}

/**
 * Strip code-piece.js's own python scaffold — the boilerplate
 * `skeletonFor`/`RUNTIMES.python` writes around every code-piece build,
 * regardless of what the build is actually about: the header's
 * `import random` / `import sys` (`header()`, unconditional — a build
 * about sorting a list carries the identical two lines a build about
 * dice rolls does), the per-step witness line's `type(rN).__name__`
 * (`main()`, one per feature, mechanical), and the closing
 * `if __name__ == "__main__":` guard plus its `def main():` — the same
 * non-discriminating-token shape `stripHtmlWrapper` above already exists
 * to strip for html's own wrapper tags, one runtime over (P5.3's
 * container-stripping precedent, applied to a code generator's own
 * container instead of a document format's).
 *
 * Found live: a battery-tested conversation asked "one more random
 * one" (idle filler, nothing to do with code) and it routed onto an
 * unrelated coin-flip build, because THAT build's header — like every
 * python build's — reads `import random`; a later conversation asked
 * "what did I say my dog's name was" and it routed onto an unrelated
 * "sum the first 10 even numbers" build, because EVERY python build's
 * own `main()` reads `__name__` in its per-step instrumentation,
 * contributing the content word "name" to every one of them by
 * construction.
 *
 * Matched by TOKEN, not by the skeleton's own exact whitespace: a
 * landed revision (SEG's own patch, or a full REC re-zero) routinely
 * reindents or re-comments the surrounding lines — measured live, the
 * "sum the first 10 even numbers" build's main() had gained three
 * comment lines and lost its skeleton-exact blank-line spacing after
 * one round of iteration — so an earlier draft here that matched the
 * header and the guard as one exact multi-line string missed the guard
 * entirely once its trailing newline drifted, and "name" kept routing.
 * `__name__`/`__main__` are Python's own reserved dunder identifiers —
 * a model filling in a STUB'S BODY has no occasion to write either, so
 * stripping every occurrence, not just the two fixed spots the skeleton
 * itself writes them in, is still narrow. `import random`/`import sys`
 * stay matched as whole LINES (never mid-line) so a real `random.choice`
 * call inside a step's body is untouched; `def main():` is the one
 * genuinely fixed, single-occurrence line the skeleton never varies.
 */
function stripPyScaffold(text) {
  return String(text ?? "")
    .replace(/^\s*import random\s*$/m, " ")
    .replace(/^\s*import sys\s*$/m, " ")
    .replace(/__name__/g, " ")
    .replace(/__main__/g, " ")
    .replace("def main():", " ");
}

/**
 * Strip code-piece.js's own per-step witness marker — `[step 1
 * some_function_name]`, printed (python's `print(f"[step …")`) or logged
 * (js's `` console.log(`[step …` ``) by EVERY code-piece build's own
 * generated `main()` (RUNTIMES.python/js's `main(names)`, one line per
 * feature, mechanical — never the model's or the operator's own words),
 * so a run's stdout says what each step returned. The SAME
 * non-discriminating-token shape `stripHtmlWrapper`/`stripPyScaffold`
 * above already exist for: the bare word "step" inside that marker is
 * ordinary, common English with nothing to do with what the function
 * does, contributed by the instrument's own wiring to every code-piece
 * build regardless of language or feature.
 *
 * Found live, 2026-09-15: a brand-new conversation's own ordinary
 * farewell — "…ok, I've got to step away for now — this has been a fun
 * poke around…" — carried the single word "step", and a leftover
 * code-piece build (a "median of a list" function) matched on it via
 * this exact marker, routing the farewell into a fold-revision attempt
 * instead of an answer: the model was asked to revise
 * `print(f"[step 1 function_computes_median_list] …")` per the words
 * "I've got to step away for now…", returned the same code back, and the
 * churn refusal ("fold N is unchanged") was the only thing rendered —
 * the ordinary reply to the farewell was never produced. Only the
 * literal marker is stripped, never the surrounding print/console.log
 * call: a genuine reference to what that call DOES ("print", "console",
 * "log") stays real, matchable evidence, and the function's own real
 * name inside the brackets is untouched too (it is also the
 * `def`/`function` declaration itself, so nothing is lost by dropping
 * its second, marker-only occurrence).
 *
 * REVISED same day, hours later, by a second live specimen that refutes
 * this function's own earlier reasoning about "type"/"repr": an entirely
 * unrelated ordinary chat turn ("does the type of oil matter much for
 * high-heat searing?") shared the single word "type" with a leftover
 * python build's own `{type(r1).__name__}: {repr(r1)[:120]}` — the SAME
 * per-step witness line's own diagnostic half, mechanically appended by
 * `skeletonFor`'s `main()` to EVERY code-piece python build regardless of
 * content, exactly as unconditional as the `[step N name]` marker beside
 * it. The comment above reasoned this half was "real, matchable
 * evidence" because it names what the call DOES — true of "print" or
 * "console", false of "type": it is an ordinary, extremely common English
 * word ("what type of oil…") that happens to also be a Python builtin,
 * and the instrument's own construction — never the model's or the
 * operator's words — puts it in every build's bytes. Diagnosed live: it
 * satisfied `discourseLocal` (2026-09-15's own discourse-locality fix,
 * above) via an unrelated PRIOR turn, which then let a SECOND message's
 * "returning" stem-match a real, unrelated "return" elsewhere in the same
 * build's code and re-zero it — the scaffold token was not even the
 * message actually being routed, only the thing that made the leftover
 * build look locally salient. Only the exact mechanically generated shape
 * immediately following the step marker is stripped (python's
 * `{type(v).__name__}: {repr(v)[:120]}`, js's `${typeof v}: ${JSON.
 * stringify(v).slice(0, 120)}`) — never a bare `type(`/`repr(`/`typeof`
 * anywhere else, so a genuine build whose own feature legitimately calls
 * either stays fully matchable everywhere but this one generated line.
 */
function stripStepWitness(text) {
  return String(text ?? "")
    .replace(/\[step \d+ [^\]]*\]\s*\{type\([^)]*\)\.__name__\}:\s*\{repr\([^)]*\)\[:120\]\}/g, " ")
    .replace(/\[step \d+ [^\]]*\]\s*\$\{typeof [^}]*\}:\s*\$\{JSON\.stringify\([^)]*\)\.slice\(0,\s?120\)\}/g, " ")
    // A build's `__name__`/`type(...)` may already have been mangled by
    // stripPyScaffold (this pipeline's own prior stage — `matchedTerms`
    // composes `stripStepWitness(stripPyScaffold(...))`), which replaces
    // every `__name__` occurrence with a bare space before this function
    // ever sees the text — so `{type(r1).__name__}` can arrive here as
    // `{type(r1). }`. Matched narrowly, immediately after a marker, same
    // as above; a stray `{type(...). }` anywhere else in a build's bytes
    // is untouched.
    .replace(/\[step \d+ [^\]]*\]\s*\{type\([^)]*\)\.\s*\}:\s*\{repr\([^)]*\)\[:120\]\}/g, " ")
    .replace(/\[step \d+ [^\]]*\]/g, " ");
}

/**
 * Bind the router to the engine's prior register.
 *
 * `makeWidgetRouter(priors)` → `{ iterationTell, routeSegment }`, where
 * `priors` is the namespace of perceiver/text/priors.js. Every closed class
 * below arrives from there, with its giver attached at the source; this file
 * declares none of its own.
 */
export function makeWidgetRouter(priors, pos = {}) {
  const {
    ANAPHORIC_PRONOUNS,
    NEGATION_WORDS,
    FIRST_PERSON,
    INFLECTIONAL_SUFFIXES,
    INDEFINITE_DETERMINERS,
    DEFINITE_DETERMINERS,
    SENTENCE_TERMINATORS,
    CLAUSE_OPENERS,
  } = priors;
  // The POS classifier (wordclass.js's `classifyWord`/`dominantClass`,
  // real UD-treebank prior) is OPTIONAL and additive — see anaphoraTell,
  // below, for why it is needed at all. Absent it, behavior is exactly
  // what it was before this parameter existed.
  const { classifyWord, dominantClass, posPrior, GRAMMAR_MIN_SHARE = null } = pos;
  // The class-dominance floor is the ONE constant (grain-typing.js,
  // Chomsky's language-universality pin): a caller that supplies the POS
  // organs must supply the share with them — the hl-acquire lesson ("a
  // threshold nobody chose on purpose is not safer for being smaller").
  // The minShare calls below are POS-guarded, so a POS-less router never
  // reaches them; a POS-ful router without the share is refused at its
  // own first use rather than run with a silent default.
  const shareOf = (c) => {
    if (GRAMMAR_MIN_SHARE == null)
      throw new TypeError("makeWidgetRouter: GRAMMAR_MIN_SHARE must ride the POS bundle — the one class-dominance constant, never a local 0.5");
    return dominantClass(c, { minShare: GRAMMAR_MIN_SHARE });
  };

  for (const [name, set] of Object.entries({ ANAPHORIC_PRONOUNS, NEGATION_WORDS, INFLECTIONAL_SUFFIXES, INDEFINITE_DETERMINERS, DEFINITE_DETERMINERS, SENTENCE_TERMINATORS })) {
    if (!(set instanceof Set) || !set.size)
      throw new TypeError(`makeWidgetRouter: ${name} must come from the engine's prior register`);
  }
  // CLAUSE_OPENERS is OPTIONAL, unlike the classes above — it was only
  // promoted into the engine's register on 2026-09-01 (priors.js's own
  // header), so an older caller's prior object (this file's own test
  // fixture, the frozen legacy engine, still in the suite by design — CLAUDE.md's
  // ratchet keeps the frozen provider as a reference, not a thing this file
  // may edit) does not carry it. Falls open, not closed, the same posture
  // every other optional prior in this file already takes: absent it,
  // `matchedTerms` (below) behaves exactly as it did before this class
  // existed here at all.
  const clauseOpeners = CLAUSE_OPENERS instanceof Set ? CLAUSE_OPENERS : null;

  // TWO FOLDS, EACH THE RIGHT ONE FOR ITS SIDE — and they are not
  // interchangeable, which is worth stating because reaching for the
  // convenient one silently breaks this file:
  //
  //   · `forms` keeps every word. The closed classes ARE function words, and
  //     source.js::tokenize drops function words by design (STOPWORDS, plus a
  //     three-character floor) — reading determiners through it would find
  //     none, ever. This is tokenization, not vocabulary: no word is named
  //     here, only the shape of a word. Curly apostrophes fold to straight so
  //     "don’t" and "don't" reach the register as the same form.
  //   · `terms` is retrieval's own tokenizer, used for the content-word
  //     comparison against a build's bytes, where dropping function words is
  //     exactly what is wanted. Both sides of that containment go through it,
  //     per CLAUDE.md's diacritics lesson: an organ that compares text to text
  //     must share retrieval's fold, or a found passage fails the very check
  //     that should confirm it.
  const forms = (s) =>
    foldDiacritics(String(s ?? ""))
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      // Unicode letters/numbers, not `[a-z0-9]` (P62's own widening,
      // applied here the same surgical way — the character class alone,
      // never a swap to `tokenize`, since `forms` must keep every word
      // tokenize drops). Before this, an iteration message written wholly
      // in a non-Latin script tokenized to `[]`, and `iterationTell`'s own
      // `if (!toks.length) return null` (below) short-circuited BEFORE
      // `resolvesInto` ever ran — so the one genuinely script-agnostic
      // path here (content-word resolution against the build's own bytes,
      // built on `terms`/`tokenize`, already fixed) never got a chance to
      // fire. Disclosed, not overclaimed: `NEGATION_WORDS`/`FIRST_PERSON`/
      // `ANAPHORIC_PRONOUNS`/the determiner classes are received English
      // closed classes (this function's own header states the giver,
      // `lang/en`) and stay English-only regardless — judgment and
      // anaphora detection are not fixed by this, only unblocked from an
      // early, wrong `null`.
      .split(/[^\p{L}\p{N}']+/u)
      .filter(Boolean);
  const terms = (s) => tokenize(String(s ?? ""));

  /**
   * The tell that a message is feedback on something already built, or null.
   *
   * `known` is the target's own words (its caption and its current code) —
   * supplied by the caller so this stays pure. It is only consulted for the
   * definite case, where the question "does 'the button' point at anything
   * here?" is answerable from the build's bytes and nowhere else.
   */
  function iterationTell(message, known = "") {
    const raw = String(message ?? "");
    if (!raw.trim()) return null;
    const toks = forms(raw);
    if (!toks.length) return null;

    // THE DECISION IS A READING, NOT A WORD-LIST VETO (user direction,
    // 2026-08-17: "no hardcoded list of english articles — it needs to
    // climb the terrain ladder like any arbitrary content; colors and
    // colours point to the same referent"). The earlier rule here let ANY
    // indefinite determiner veto routing, and the brief's own canonical
    // complaint — "I don't like the counter widget, make the buttons
    // bigger with SOME color" — was thereby unroutable. Deleting the veto
    // outright left the symmetric false positive open (measured, 2026-08-18
    // diagnosis: "make me a counter widget" resolved onto the existing
    // counter build, because overlap alone cannot tell introducing from
    // pointing). What replaced both is a PER-TERM reading, not a
    // per-message veto: each matched term is read with the determiner
    // governing ITS OWN phrase (pointedTerms, below) — "the buttons"
    // points while "some color" in the same sentence introduces, so the
    // canonical complaint routes AND the symmetric birth request does not.
    // What decides:
    //
    //   · FORM RESOLUTION. A content word of the message resolves into the
    //     build when the build's own bytes hold the same FORM — identical
    //     through retrieval's fold, or differing by a member of
    //     INFLECTIONAL_SUFFIXES (the register's received morphology class,
    //     giver lang/en): "buttons" resolves against "button", "colors"
    //     against "color:". Identity lives in the quotient; the suffix
    //     class only says which surface differences are ground, not
    //     figure. (Dialect spelling — colour/color — is NOT inflection;
    //     it closes only through a received spelling prior with its own
    //     giver, and until then stays a typed limit, per II.2's "a missing
    //     giver is a wall, never derive".)
    //   · ANAPHORA. "it's broken", "make it bigger" — the pronoun class
    //     is resolution's own pronoun face: the form itself says the
    //     object is already here.
    //   · JUDGMENT is a LABEL on the tell, never the tell itself: negation
    //     plus first person says the operator is judging; what they are
    //     judging still has to resolve.
    const judged = toks.some((t) => NEGATION_WORDS.has(t)) && toks.some((t) => FIRST_PERSON.test(t));
    if (resolvesInto(raw, known)) return judged ? "judgment" : "resolved";
    // The pointer is the more specific fact than the judging of it — a
    // judgment that arrives BY anaphora reports as the anaphor (the
    // earlier doctrine's own line, kept).
    if (anaphoraTell(raw, judged)) return "anaphora";
    return null;
  }

  /**
   * True when a bare demonstrative ("it"/"this"/"that"/"these"/"those" —
   * never the "'s"-contracted forms, which already carry their own verb
   * and are always pronominal) is used PRONOMINALLY somewhere in the
   * message, rather than as a demonstrative DETERMINER introducing a
   * following noun. ANAPHORIC_PRONOUNS's own header states the two uses
   * share one form in English ("'this' and 'that' overlap with
   * DEFINITE_DETERMINERS by form... a consumer distinguishing 'make it
   * bigger' (pronoun, nothing follows) from 'make this widget bigger'
   * (determiner, a noun follows) reads the surrounding tokens, not this
   * set alone") — this reads exactly that, with the SAME received POS
   * prior (wordclass.js's `classifyWord`/`dominantClass`, real
   * UD-treebank counts) app.js already uses for its own per-word class
   * checks, rather than a second guessed rule.
   *
   * Found live: this consumer had never actually done that reading, so
   * an ordinary sentence like "what is this app, in one sentence?" —
   * "this" as a determiner on "app", nothing pronominal anywhere — still
   * fired `tell: "anaphora"` against whichever code build happened to be
   * the most recent, unconditionally re-zeroing it. A bare demonstrative
   * followed by a token the POS prior calls a noun/proper noun is read as
   * the determiner use and does not count.
   *
   * A second, narrower rule covers the prior's own vocabulary gap: the
   * treebank is general prose and does not carry tech jargon like "app"
   * or "widget" (measured live — both come back `found: false`), which
   * are exactly the nouns a real reader is likeliest to put after "this"
   * when asking about the product itself. An OUT-OF-VOCABULARY word is
   * still read as the noun, not the pronoun's own predicate: a genuinely
   * novel VERB immediately after a bare demonstrative ("this frobnicates")
   * is rare in ordinary writing, while a genuinely novel NOUN there
   * ("this widget", "this app") is common — so "not found" leans
   * determiner, the same direction as a confident NOUN classification.
   * A word the prior finds but classifies as something ELSE (a verb, an
   * adjective — "this is", "this bigger") still reports pronominal, so
   * "make this bigger" and "this is broken" are unaffected.
   *
   * Falls open, not closed, when the POS prior is unavailable (older
   * callers, tests, or a page that has not finished loading the prior
   * yet): every bare-demonstrative occurrence still counts as anaphora,
   * exactly as before this function existed. So nothing that used to
   * resolve stops resolving; this only narrows a false positive that a
   * loaded prior can actually rule out.
   *
   * ONLY THE MESSAGE'S OWN LAST SENTENCE IS READ, UNLESS `judged` (found
   * live, 2026-09-15, task_0e06ff56). A Coding-tab build's own narration
   * had been sent to the chat — `app.js`'s `sendChip`, or an ordinary
   * build turn, either way the widget's bytes are now genuinely
   * `discourseLocal`, so that narrowing (above, in `routeMessage`'s own
   * header) cannot help here — and the NEXT, wholly unrelated message
   * closing the conversation, "This was great, thank you so much for your
   * help today. Goodbye for now!", still fired `anaphoraTell` on "this"
   * (sentence one of two, followed by the copula "was" — pronominal by
   * this function's own POS reading either way) and re-zeroed the build:
   * `capture(message)` — the WHOLE message, "Goodbye for now!" included —
   * landed as the fold's next edit instruction, and the model duly
   * produced a `{find, add}` patch against Python it had never been asked
   * to touch, landing a broken indentation edit with no reply to the
   * farewell at all. Live, verified against the real page (gemma2:2b). A
   * SECOND phrasing of the identical shape ("That's all for now,
   * appreciate the help. Talk soon!") reproduces it the same way, and a
   * French control sentence in the same slot does not, because
   * ANAPHORIC_PRONOUNS is an English closed class — confirming the tell
   * really is this function, not something upstream.
   *
   * SENTENCES, NOT `clauseForms`'s finer CLAUSES — the register's own
   * SENTENCE_TERMINATORS (`.`, `!`, `?`, `…`; giver script/latn), never
   * comma/semicolon/colon. The first attempt at this fix read clauseForms
   * (the finer split `introducesTerm`/`pointedTerms` already use, which
   * also breaks on a comma) and broke a PINNED test on the very next run:
   * "what is this app, in one sentence?" is one ordinary interrogative
   * sentence with an internal comma — "this" and the question mark belong
   * to the same utterance — and reading only its last CLAUSE ("in one
   * sentence") lost the pronoun that sentence-scoping keeps. A comma
   * inside one sentence is not license to keep pointing past it, but it
   * is also not a topic change; only a real sentence boundary is.
   *
   * The shared shape across every false positive and none of the true
   * positives ("it's broken", "this is hideous", "that's too big", "make
   * it bigger", "fix it, it's broken", "that's broken — build a new one
   * from scratch", "what is this app, in one sentence?" — every one of
   * them one sentence, whatever its internal commas): a demonstrative
   * that opens a message and is never returned to — a LATER SENTENCE
   * moving on to thanks, a farewell, an unconnected new topic — is
   * exactly the discourse-deictic use linguistics already has a name for
   * (Webber 1991): "this"/"that" pointing at the SITUATION just had, not
   * at an entity a later sentence still needs. A one-sentence message (no
   * SENTENCE_TERMINATORS inside it, whatever commas it holds) is
   * unaffected — there is no "later" sentence to move on to, and every
   * existing one-sentence specimen above still resolves exactly as
   * before. `judged` (negation + first person, computed once by
   * `iterationTell` and threaded through rather than re-derived) is the
   * disclosed escape hatch: a message carrying an explicit negated
   * first-person judgment ANYWHERE ("I don't like it. Thanks anyway!") is
   * unambiguous evidence regardless of which sentence the pronoun sits
   * in, so the full-message scan runs exactly as it always has whenever
   * that fires.
   *
   * THE COST, STATED RATHER THAN PAPERED OVER (this file's own standing
   * practice): an ordinary complaint immediately followed by an
   * unconnected pleasantry IN A LATER SENTENCE, with no negation+first-
   * person anywhere in it — "It's broken. Thanks for building it though."
   * — no longer routes. That phrasing is rarer than the farewell class
   * this closes and the number one bug this fix exists for is silent
   * misrouting, not a missed routing that still reaches the operator as
   * an ordinary (if less targeted) reply — the same asymmetry
   * `triviallyChatty` (app.js) already argues for in the sibling S1/S2
   * gate, applied here to routing instead of grounding.
   */
  function anaphoraTell(message, judged = false) {
    const sentences = sentenceForms(message);
    const scan = judged ? sentences : sentences.slice(-1);
    for (const clause of scan) {
      for (let i = 0; i < clause.length; i++) {
        const t = clause[i];
        if (!ANAPHORIC_PRONOUNS.has(t)) continue;
        if (t.includes("'")) return true; // "it's"/"this's"/"that's" — always pronominal
        const next = clause[i + 1];
        const prior = typeof posPrior === "function" ? posPrior() : posPrior;
        if (next && classifyWord && dominantClass && prior) {
          const classified = classifyWord(next, { posPrior: prior });
          const d = shareOf(classified);
          if (d && (d.upos === "NOUN" || d.upos === "PROPN")) continue; // determiner use — "this app", "that build"
          if (classified && classified.found === false) continue; // unknown word — read as a novel noun, not a novel verb
        }
        return true;
      }
    }
    return false;
  }

  /** Does any content word of the message resolve into the build's own
   * bytes? Both sides through retrieval's one fold (tokenize — stopwords
   * and short forms drop on both sides), then form identity.
   *
   * `known` is stripped of the html document's own wrapper tags first
   * (P5.3's own precedent — strip container boilerplate, keep the
   * content). Measured live, 2026-08-17: a session with one existing html
   * build (a canvas drawing app) asked "make me a 5-column by 5-row
   * spreadsheet grid in html, with column headers..." — a birth request
   * naming its OUTPUT FORMAT, pointing at nothing the drawing app
   * contains — and it resolved onto the drawing app anyway, because
   * `<!DOCTYPE html><html>...` contributes the token "html" to every
   * single html-typed build's bytes by construction. That token carries
   * zero discriminating signal: it is common to every build of this kind,
   * so it can never be evidence that a message points at THIS one. Only
   * the four wrapper tag names are stripped (doctype/html/head/body,
   * open and close, whatever attributes they carry) — everything nested
   * inside (title text, style rules, real content) is untouched, so a
   * genuine referent living inside <head> or the body is exactly as
   * resolvable as it always was. */
  function resolvesInto(message, known) {
    return pointedTerms(message, known).length > 0;
  }

  /** The message's clauses, in the `forms` fold — the determiner walk must
   * not cross a clause boundary ("I don't like the layout, make a cleaner
   * version": "a" governs nothing in the first clause), and `forms` alone
   * drops the punctuation that marks one. */
  const clauseForms = (s) =>
    foldDiacritics(String(s ?? ""))
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .split(/[.!?;,:]+/)
      // Same widening as `forms`, same reason — this is its per-clause twin.
      .map((c) => c.split(/[^\p{L}\p{N}']+/u).filter(Boolean))
      .filter((c) => c.length);

  /** The message's SENTENCES, in the `forms` fold — coarser than
   * `clauseForms`, on purpose: only a real sentence terminator (the
   * register's own SENTENCE_TERMINATORS — `.`/`!`/`?`/`…`, giver
   * script/latn) starts a new one, so a comma stays INSIDE the sentence
   * it punctuates. `anaphoraTell`'s own header explains why this,
   * specifically, is the fold that question needs: "what is this app, in
   * one sentence?" is one sentence with an internal comma, and
   * `clauseForms`'s finer comma-splitting sentence would have lost the
   * pronoun's own sentence. Built by hand rather than a regex over
   * `[...SENTENCE_TERMINATORS]` so the register's own Set stays the one
   * place this punctuation is named — no second, parallel spelling of it
   * to drift from the first. */
  const sentenceForms = (s) => {
    const folded = foldDiacritics(String(s ?? ""))
      .toLowerCase()
      .replace(/[‘’]/g, "'");
    const parts = [];
    let cur = "";
    for (const ch of folded) {
      if (SENTENCE_TERMINATORS.has(ch)) { parts.push(cur); cur = ""; }
      else cur += ch;
    }
    parts.push(cur);
    return parts.map((c) => c.split(/[^\p{L}\p{N}']+/u).filter(Boolean)).filter((c) => c.length);
  };

  /**
   * Does the message INTRODUCE this term rather than point at it? True only
   * when every occurrence of the term sits in a clause whose nearest
   * determiner to its left is INDEFINITE — the closed grammatical fact the
   * register states ("an indefinite determiner INTRODUCES its noun"): "a
   * counter widget" introduces "counter" AND "widget" (both inside the
   * phrase "a" opens), "the counter" points, and a bare term (no determiner
   * in its clause) keeps today's behavior and points. One pointing
   * occurrence anywhere is enough — pointing is the more specific fact. A
   * term the `forms` fold never surfaces (a tokenizer normalization this
   * fold doesn't share, e.g. "don't"→"don") fails OPEN to pointing, so
   * nothing routable today stops routing.
   */
  function introducesTerm(message, term) {
    let seen = false;
    for (const clause of clauseForms(message)) {
      for (let i = 0; i < clause.length; i++) {
        if (clause[i] !== term) continue;
        seen = true;
        let introduced = false;
        for (let j = i - 1; j >= 0; j--) {
          if (DEFINITE_DETERMINERS.has(clause[j])) break;
          if (INDEFINITE_DETERMINERS.has(clause[j])) { introduced = true; break; }
        }
        if (!introduced) return false;
      }
    }
    return seen;
  }

  /** matchedTerms, kept only where the message actually POINTS — the
   * determiner reading applied per term. The hit's message-side token (the
   * half before `~`) is the one whose phrase is read. */
  function pointedTerms(message, known) {
    return matchedTerms(message, known).filter((hit) => !introducesTerm(message, hit.split("~")[0]));
  }

  /**
   * Does the message introduce ANYTHING at all — any word governed by an
   * INDEFINITE_DETERMINER, anywhere in the message, whether or not that
   * word also happens to match the build's own bytes? This is a coarser
   * question than `introducesTerm` (which reads one already-matched term's
   * own phrase) and answers a different one: not "is this specific match a
   * pointer or an introduction" but "does this message's own grammar carry
   * the shape of an addition at all."
   *
   * Why a second question is needed, found by a live regression (this
   * repo's own conformance suite, "it's broken, the button does nothing"):
   * a message can point at existing content (tell:"resolved", via "the
   * button") while carrying no addition whatsoever — a bug report, not a
   * feature request. `judged` (NEGATION_WORDS + FIRST_PERSON) does not
   * catch this phrasing either — no negation word, no first person — so
   * tell:"resolved" alone is not enough evidence that an operator is
   * ASKING FOR something new; it only says the operator's words touch
   * something that already exists. Requiring a positive indefinite
   * introduction somewhere in the message is the same closed-class
   * discipline `introducesTerm` already uses, read at the message level
   * instead of the single-term level.
   */
  function introducesAnything(message) {
    for (const clause of clauseForms(message)) {
      for (let i = 0; i < clause.length - 1; i++) {
        if (INDEFINITE_DETERMINERS.has(clause[i])) return true;
      }
    }
    return false;
  }

  /**
   * WHICH of the message's own words actually drove a resolvesInto match —
   * the router's decision, made legible rather than a silent boolean.
   *
   * Found necessary by the SAME live measurement the wrapper/caption fixes
   * came from: two consecutive false-positive routings, through two
   * different channels (raw markup, then the default caption), were each
   * fixed narrowly without ever seeing what the router had actually
   * matched on — and a THIRD routing (this time onto genuinely shared
   * vocabulary: an earlier misrouted turn had already merged a
   * `generateGrid()` using "row"/"col" into the build it was never meant
   * to touch, so the next ask matched on real, if accidental, overlap)
   * would have been diagnosed in seconds instead of by hand-fetching
   * localStorage, if the match evidence had been on the record from the
   * start. This does not fix the underlying category error — `resolvesInto`
   * still compares SPANS (token overlap) where the actual question is
   * about REFERENTS ("is this ask a continuation of what this build is
   * ABOUT"), the same gap P11 already names for prose ("a name is a
   * reference to a referent, never a byte sequence") — it only makes each
   * routing decision legible enough that the next collision is a five-
   * minute read of the record instead of a two-hour reproduction. The
   * referent-level fix (routing through the engine's own cast/referent
   * organs instead of this module's tokenizer) is named, not built, here —
   * see the routing amendment this measurement produced.
   */
  /**
   * A morphological (non-exact) sameForm match is weaker evidence than an
   * identical one, and this file's own established suffix class
   * (INFLECTIONAL_SUFFIXES: s/es/ed/ing/er/est/'s) does not distinguish a
   * genuine plural ("button"~"buttons") from a comparative/superlative
   * degree ("great"~"greatest") or a directional adverb's optional "-s"
   * ("backward"~"backwards") — the suffix folds all three identically, and
   * nothing about the SUFFIX itself tells them apart. Found live,
   * 2026-09-15, in one ~30-turn batch: an ordinary farewell ("great,
   * that's really helpful, thanks so much!") matched an unrelated leftover
   * build's own docstring ("the greatest common divisor") on "great"~
   * "greatest" alone, silently re-zeroing it instead of replying; a
   * factual correction carrying "backwards" matched a different leftover
   * build's own "backward" the identical way, weaving an unrequested code
   * edit into the model's own prose.
   *
   * The gate reuses the POS prior already injected for `anaphoraTell`
   * (wordclass.js's classifyWord/dominantClass, real UD-treebank counts —
   * the SAME closed, giver-named resource this file already trusts, never
   * a second guessed rule): a pair that folds by SUFFIX, not identity,
   * must have every side the prior can classify (found, and clearing
   * dominantClass's own declared 0.5 floor) read as a NOUN or PROPN.
   * Measured directly against the real prior: "button"/"buttons" and
   * "color"/"colors" are NOUN at every observed occurrence; "great" is ADJ
   * at a 0.99 share, "greatest" ADJ at 1.0; "backward" is ADV at 1.0
   * ("backwards" itself is out-of-vocabulary in the treebank — that
   * absence is never held against a pair on its own, only the OTHER
   * side's own classification is, the identical "OOV is absence of
   * evidence, not evidence against" posture `anaphoraTell`'s own OOV rule
   * already takes one function up).
   *
   * Falls fully open — identical to every prior behavior — when the POS
   * prior is unavailable, matching every other optional-prior gate in
   * this file: this can only narrow a false positive a loaded prior can
   * actually rule out, never remove an affordance nothing here replaces.
   * Never consulted for an EXACT match (t === s, matchedTerms' own first
   * branch) — a real code identifier shared verbatim ("counter",
   * "is_prime") is not the mechanism this closes and stays exactly as
   * trusted as before.
   */
  function morphologicalMatchAllowed(t, s) {
    if (!classifyWord || !dominantClass) return true;
    const prior = typeof posPrior === "function" ? posPrior() : posPrior;
    if (!prior) return true;
    for (const w of [t, s]) {
      const d = shareOf(classifyWord(w, { posPrior: prior }));
      if (d && d.upos !== "NOUN" && d.upos !== "PROPN") return false;
    }
    return true;
  }

  function matchedTerms(message, known) {
    const have = [...new Set(terms(stripStepWitness(stripPyScaffold(stripHtmlWrapper(known)))))];
    if (!have.length) return [];
    const hits = [];
    for (const t of new Set(terms(message))) {
      if (isBareNumeral(t)) continue; // never content evidence — see isBareNumeral's own header
      // CLAUSE_OPENERS (priors.js: subordinators and relative pronouns
      // that OPEN a subordinate clause — that/which/who/whom/whose/
      // because/although/though/while/when/whether/unless/since/before/
      // after/until/if/to/how) are function words, not content — the same
      // shape STOPWORDS already excludes for the closed set it covers,
      // widened by the register's own next class over. Found live,
      // 2026-09-15: an ordinary factual correction carrying "whether"
      // (this class's own member — "if it matters whether…") matched a
      // wholly unrelated leftover build's comment on the bare token alone,
      // and the resulting re-zero applied a destructive literal patch that
      // stripped every `def ` from the code — a false positive that
      // silently CORRUPTED working code rather than merely failing to
      // answer. Excluded on the MESSAGE side only, matching isBareNumeral's
      // own placement: a build's own bytes are not filtered by this class,
      // only what the operator's own words may count as evidence.
      if (clauseOpeners && clauseOpeners.has(t)) continue;
      for (const s of have) {
        if (t === s) { hits.push(t); break; }
        if (sameForm(t, s, INFLECTIONAL_SUFFIXES) && morphologicalMatchAllowed(t, s)) {
          hits.push(`${t}~${s}`);
          break;
        }
      }
    }
    return hits;
  }

  /**
   * Was this candidate build actually SALIENT in the conversation's own
   * recent discourse — named, or one of its own distinguishing words used
   * — rather than merely existing somewhere in the workspace? Read off the
   * exact same containment fold `matchedTerms` already uses for the
   * message itself (retrieval's own tokenize/foldDiacritics, the wrapper-
   * and scaffold-stripping already applied to `known`), applied here to
   * the caller's own recent turns instead of the current message.
   *
   * This exists for ONE tell only — see `routeMessage`'s own `discourse`
   * paragraph below for the reported false positive and why bare anaphora
   * is the channel that needed it. A build produced earlier in THIS same
   * conversation is not a special case for this function: the turn that
   * built it pushes the model's own reply — the code included — into that
   * conversation's own history verbatim (app.js's `state.history`), so the
   * build's own bytes are already sitting in its own birth turn's
   * discourse and resolve here exactly the way a definite phrase resolves
   * against the build in `resolvesInto`. A build from an older exchange, a
   * different conversation, or one this conversation never mentioned
   * shares no such bytes and does not.
   */
  function discourseLocal(discourse, known) {
    return matchedTerms(String(discourse ?? ""), known).length > 0;
  }

  /**
   * The PRE-TURN face of the router: does this message, by itself, point at
   * an existing build? Decided BEFORE any model call, from the operator's
   * words and the builds' own bytes — nothing else exists yet.
   *
   * This is what makes iteration reliable rather than probabilistic. The
   * post-answer route (routeSegment, below) can only route code the model
   * happened to emit — and measured live (gemma2:2b, 2026-08-17), a small
   * model answers a bare complaint in prose as often as not, so the
   * complaint routed nowhere. Deciding first lets the caller run a SIGHTED
   * revision instead: hand the model the target's current code and extract
   * the returned fence mechanically (the /fold door's own machinery —
   * pickRevisionSegment tolerates a dropped language tag, churn is refused
   * by the log, a codeless reply is a typed gap). The model is only the
   * mouth; the routing never depends on its behaviour.
   *
   * `builds` is `[{n, type, lang, text}]` in birth order, code builds only
   * — a complaint cannot revise a table. Returns `{n, tell, trigger}` or
   * null; null means the turn is a question or a demand for something new,
   * and the ordinary path keeps it.
   *
   * `hasMaterial` (the caller's own liveSources/liveChunks reading — this
   * module stays pure and never reads state itself) narrows the ANAPHORA
   * tell only. Found live, alongside the numeral fix above: a bare
   * demonstrative used pronominally ("does THAT sound like a healthy diet
   * to you?") carries ZERO byte evidence about which build it points at —
   * unlike "resolved"/"judgment", which require the message to actually
   * share a word with the CANDIDATE's own bytes, anaphora fires from the
   * message's grammar alone and was landing on whichever code build merely
   * happened to be live, including one from a wholly unrelated, earlier
   * session, while the operator was plainly asking about attached material
   * ("that" pointing at the diet just read, not at a leftover sum-of-
   * numbers script). This module's own header states the invariant this
   * violated: checked LAST, "so nothing about the material can be hijacked
   * by it." With material attached, a bare pronoun is at least as likely to
   * point at THAT as at a stale artifact, so it is no longer read as
   * evidence for either — the affordance narrows (a genuine widget
   * complaint with no attached material still routes exactly as before),
   * it does not vanish: naming the artifact ("build 7", "the counter") or
   * a word its own bytes hold ("resolved"/"judgment") still route with
   * material attached, because those DO carry evidence tying to the one
   * candidate rather than to whichever build merely exists.
   *
   * `discourse` (this conversation's own recent history, plain text — the
   * caller's `state.history` reading; this module stays pure and never
   * reads state itself) narrows the ANAPHORA tell a SECOND way, alongside
   * `hasMaterial`. Found live: `hasMaterial` closes the channel only when
   * material is attached, and an ordinary CASUAL message with none —
   * "hey! how's it going", "one more random one" (idle filler, unrelated
   * to any of the fixes above), "what did I say my dog's name was again?"
   * — still carries a bare "it"/"this"/"that" (an expletive "it", or "this"
   * inside "this chat") that fires `anaphoraTell` on grammar alone and was
   * landing on whichever code build merely existed in `state.builds` — the
   * INSTRUMENT's own workspace-wide log (CLAUDE.md, deliberately not per
   * conversation), not this conversation's. A leftover coin-flip build
   * from an unrelated earlier session has no business being "it" to a
   * conversation that never mentioned it.
   *
   * The fix is not a THIRD hand-typed signal: it is the same discourse-
   * recency machinery this app already tracks per conversation
   * (`state.history`), read through the identical containment fold
   * `matchedTerms`/`resolvesInto` already trust for the message itself —
   * `discourseLocal`, above. A candidate build only counts as anaphora's
   * target when this conversation's own recent turns actually carry one of
   * the build's own distinguishing words — which the flagship "make it
   * blue"/"it's broken" case satisfies for free, because the turn that
   * BUILT the widget pushed the model's own reply (the code) into
   * `state.history` verbatim, so the just-built widget's bytes are right
   * there in its own birth turn. A build from an older exchange, a
   * different conversation, or no real discourse connection at all shares
   * no such bytes and is refused, exactly the regression this closes.
   *
   * `discourse === undefined` (the default: an older caller, or a test
   * exercising the tell in isolation) means the caller did not opt into
   * this check, and behavior is UNCHANGED — falls open, not closed, the
   * same posture `anaphoraTell`'s own POS-classifier gate already takes
   * when its prior is unavailable. Only a caller that supplies its own
   * recent discourse (even an explicitly empty string, for a brand-new
   * conversation with no history yet) gets the narrower, correct read.
   *
   * DISCOURSE LOCALITY NARROWS "resolved"/"judgment" TOO, NOT ONLY
   * "anaphora" (found live, 2026-09-15). The doctrine above this comment —
   * "unlike resolved/judgment, which require the message to actually share
   * a word with the CANDIDATE's own bytes, anaphora fires from the
   * message's own grammar alone" — treated content-word overlap as strong
   * evidence on its own, needing no salience check. A leftover build
   * carrying a broken "count down time" python script (`time_left`, "Time
   * left") sat in the workspace, and the FIRST message of a brand-new
   * conversation — "hey! first time poking at this. what should I call
   * you, and what are you actually good at?" — resolved onto it, matched
   * on the single word "time": ordinary, idiomatic ("first time poking")
   * and utterly unconnected to the build's own countdown timer, but a real,
   * received English word all the same, so `resolvesInto` correctly (by
   * its own narrower question) found overlap. `stripHtmlWrapper`/
   * `stripPyScaffold`/`isBareNumeral` already exist for the SAME failure
   * shape — a token contributed by construction rather than by the
   * message's actual intent — but none of them are a list this specific
   * common word could ever join without becoming exactly the "sample
   * standing in for a whole" this file's own header refuses to write.
   * `discourseLocal` is not such a list: it is the closed, already-tested
   * mechanism this file already trusts to answer "was this candidate ever
   * actually part of THIS conversation" — extending it to every tell,
   * rather than only the grammar-alone one, treats a single word match
   * exactly as skeptically as a bare pronoun once material is enough to
   * explain it, which the incident above shows is warranted: an ordinary
   * greeting can share one real word with a wholly unrelated leftover
   * build by pure vocabulary coincidence, in a conversation that has never
   * mentioned it. `hasMaterial` stays anaphora-only — it narrows a
   * PRONOUN's referent between material and a build, a question that does
   * not arise for a tell already grounded in the build's own vocabulary.
   * The invariant this preserves, not merely a narrower one: "resolved"/
   * "judgment" still route across conversations exactly as before whenever
   * the build was ever actually salient in this one (the flagship
   * same-turn case, and any later turn that mentioned the build first),
   * and always via an explicit build reference ("build 3"), which never
   * enters this loop at all. What stops is only the coincidence case —
   * a shared word with a candidate this conversation has said nothing
   * about.
   */
  function routeMessage(message, builds = [], { hasMaterial = false, discourse } = {}) {
    // `lang !== "markdown"` — found live, 2026-09-09: every word-overlap
    // tell below (resolved/judgment/anaphora) works by asking "does this
    // message share a word with the candidate build's own bytes," which is
    // a genuinely low-false-positive question for CODE (a widget's variable
    // names and markup essentially never overlap with ordinary English) and
    // a near-certain false positive for PROSE. A composed markdown document
    // (the /facts door's own build; CLAUDE.md — a document ABOUT a topic)
    // shares ordinary vocabulary with any real follow-up question about
    // that same topic by construction, so every such question was routing
    // as an instruction to edit the document instead of reaching the
    // grounded-chat pipeline at all — the router correctly finding
    // "evidence" that carries none, the same class of false positive this
    // function's own header already closed twice for anaphora (material,
    // then discourse), now closed for the type of candidate rather than
    // the type of tell. A genuine "revise the facts document" instruction
    // still has /facts itself (regenerate) and the fold's own ✎ edit
    // button — this router was never the only door onto either.
    const live = (builds ?? []).filter((b) => b && b.type === "code" && b.lang !== "markdown");
    if (!live.length) return null;

    const named = referencedBuild(message);
    if (named) {
      const target = live.find((b) => b.n === named.n);
      return target ? { n: target.n, tell: "named", trigger: capture(message) } : null;
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const tell = iterationTell(message, live[i].text ?? "");
      if (!tell) continue;
      if (tell === "anaphora" && hasMaterial) continue;
      // Every tell, not only anaphora — see this function's own header,
      // "DISCOURSE LOCALITY NARROWS resolved/judgment TOO". A single shared
      // content word is exactly as coincidence-prone as a bare pronoun once
      // the candidate was never actually part of this conversation.
      if (discourse !== undefined && !discourseLocal(discourse, live[i].text ?? "")) continue;
      return { n: live[i].n, tell, trigger: capture(message), ...evidenceOf(tell, message, live[i].text) };
    }
    return null;
  }

  /** The router's own evidence for a routing decision, as a payload ready
   * to ride the record (P3: unrecognized keys ride the fold as payload).
   * Only "resolved"/"judgment" decisions have span evidence to disclose —
   * "named" and "anaphora" are already self-explaining from the tell alone. */
  function evidenceOf(tell, message, known) {
    if (tell !== "resolved" && tell !== "judgment") return {};
    // The evidence is what actually drove the decision — the POINTED terms,
    // not every overlap (an introduced term on the record would claim a
    // match the router deliberately declined to act on).
    const matchedOn = pointedTerms(message, known ?? "");
    return matchedOn.length ? { matchedOn } : {};
  }

  /**
   * Route one produced segment: onto an existing build's log, or to a new
   * build of its own.
   *
   * `builds` is a projection the caller supplies — `[{n, type, lang, text}]`
   * in birth order, where `text` is that build's own caption and code — so
   * this module never learns the build log's shape. The answer is always one
   * of three typed shapes; there is no "probably", because a maybe would have
   * to be resolved by somebody, and the only somebody available is the model.
   */
  function routeSegment(seg, message, builds = [], { landedThisTurn = [] } = {}) {
    // A TURN IS ONE ACT. Measured live against gemma2:2b (2026-08-17): asked
    // for one counter widget, it answered with five html fences in a single
    // reply — a small model restating itself — and every one opened a build,
    // so one request produced five orphans. Later fences are not more
    // artifacts; they are the model compiling a new whole in the same breath.
    // (Two different KINDS in one turn are still two builds.)
    const already = (landedThisTurn ?? []).find((b) => b && sameKind(b, seg));
    if (already) return { kind: "revise", n: already.n, lang: resolveLang(already, seg), why: "a later block of the same kind in the same turn" };

    const live = (builds ?? []).filter((b) => b && sameKind(b, seg));
    if (!live.length) return { kind: "new", why: "nothing of this kind has been built yet" };

    // The number IS the reference — builds.js's own anchor, reused rather
    // than re-derived. Read out of the OPERATOR's words only: the model
    // naming a build is the model's phrasing, and L5 does not spend trust on
    // phrasing.
    const named = referencedBuild(message);
    if (named) {
      const target = live.find((b) => b.n === named.n);
      if (target) return { kind: "rezero", n: target.n, lang: resolveLang(target, seg), tell: "named", trigger: capture(message) };
      return { kind: "new", why: `build ${named.n} is not a build of this kind` };
    }

    // The present one first — the last of this kind is what "it" points at,
    // which is the rule a conversation already uses. Each candidate is asked
    // against its OWN bytes, newest first, so a definite phrase lands on the
    // build that actually contains it rather than on whichever came last.
    for (let i = live.length - 1; i >= 0; i--) {
      const tell = iterationTell(message, live[i].text ?? "");
      if (tell) {
        // REC vs SUPERSEDE is not the routing decision, and conflating them
        // is the defect a live stress-eval measured (2026-08-18): every
        // pre-turn hit landed as a re-zero regardless of `tell`, so a plain
        // feature-add ("add a button that clears all the cells") that
        // merely POINTS at existing content — iterationTell's own `judged`
        // computed false, tell:"resolved" — conceded a ground it never
        // judged.
        //
        // tell:"resolved" ALONE is not enough evidence, found by the same
        // measurement's own regression case ("it's broken, the button does
        // nothing" — points at "button", carries no negation+first-person,
        // tell:"resolved" too, and is NOT a feature request). The second,
        // narrower gate: land as a revision only when the message ALSO
        // introduces something (introducesAnything — a positive indefinite-
        // determiner signal, not merely the absence of a judgment one). A
        // message that only points, with nothing indefinite anywhere in it,
        // still concedes a ground — a bug report about something already
        // there is exactly what REC exists for. "judgment" (explicit
        // negation+first-person) and "named" (an explicit build reference,
        // no judgment signal computed for it at all) still concede a
        // ground, unconditionally. "anaphora" stays REC too, conservatively:
        // it is the tell for both an ordinary pointing pronoun AND an
        // implicit complaint ("it's broken", "fix it") with no
        // negation+first-person to tell them apart, and misreading a real
        // complaint as an ordinary revision costs more than the reverse.
        const kind = tell === "resolved" && introducesAnything(message) ? "revise" : "rezero";
        return { kind, n: live[i].n, lang: resolveLang(live[i], seg), tell, trigger: capture(message), ...evidenceOf(tell, message, live[i].text) };
      }
    }
    return { kind: "new", why: "the turn's words introduce something, they do not point at something" };
  }

  // Exported so a `routeMessage` caller (routeMessage itself carries no
  // `kind` — several existing callers pin its exact return shape, `tell`/
  // `trigger`/`n`/`matchedOn` only, deepEqual — see widget.test.mjs) can
  // compute the SAME rezero-vs-revise decision routeSegment now makes,
  // rather than re-deriving it or defaulting to rezero unconditionally
  // (app.js's send(), as of 2026-08-18, still does the latter — named in
  // this pass's own handoff note, not fixed here).
  return Object.freeze({ iterationTell, routeMessage, routeSegment, matchedTerms, pointedTerms, introducesAnything });
}

/** Two names for one runtime — the fold's own RENDERABLE/RUNNERS aliases. */
const LANG_ALIAS = { js: "javascript", node: "javascript", bash: "shell" };
const norm = (l) => {
  const s = String(l ?? "").toLowerCase().trim();
  return LANG_ALIAS[s] ?? s;
};

/**
 * Same kind of artifact? Type must match, and language too — a python script
 * is not a version of an html widget, however the words around it read.
 *
 * The exception is an UNDECLARED language: a bare fence with no tag. Measured
 * live against gemma2:2b (2026-08-17): complained at about a widget, it
 * answered with an untagged fence holding the fix, and a strict match forked
 * that onto a build of its own. Silence is not a declaration of difference.
 * The strict match exists to stop a DECLARED python file from becoming a
 * version of a DECLARED html widget; it was never meant to fork on a gap.
 */
const sameKind = (build, seg) => {
  if (build?.type !== seg?.type) return false;
  if (seg?.type !== "code") return true;
  const a = norm(build.lang);
  const b = norm(seg.lang);
  return !a || !b || a === b;
};

/**
 * The language the landed segment should carry. An undeclared fence adopts
 * the build's own — a widget complained at and answered with a bare fence is
 * still an html widget, and letting the gap blank the declaration would cost
 * it its preview and its .html download.
 */
const resolveLang = (build, seg) => (norm(seg?.lang) ? seg.lang : (build?.lang ?? seg?.lang));

/**
 * The trigger, taken verbatim from the operator and held to a declared budget
 * (builds.js's own BUILD_MESSAGE_MAX — one number, one source). Verbatim
 * matters: the re-zero entry's whole job is to record WHY the ground was
 * conceded, and a paraphrase of the reason is not the reason.
 */
export function capture(message) {
  const flat = String(message ?? "").replace(/\s+/g, " ").trim();
  return flat.length > BUILD_MESSAGE_MAX ? `${flat.slice(0, BUILD_MESSAGE_MAX - 1)}…` : flat;
}

/**
 * SIG · scout — resolve the operator's own term to the byte-span of the
 * projection it names, BEFORE any model call. Attention as an act.
 *
 * The measured failures this narrows (live e2e, 2026-08-17): `ambiguous`
 * finds (the model names bytes that appear on both buttons) and
 * wrong-target hits (a token like "inc" living in markup AND script). An
 * edit only has to be unique within what attention scoped, and the model
 * is only shown the scouted region — a smaller arena for a small model.
 *
 * Same discipline as the router's own tells, deliberately, and now the same
 * FOLD too (P11, measured live 2026-08-17: the canonical complaint "make the
 * buttons bigger" routed correctly to the widget that says `button`, then
 * scoped to the wrong span because "buttons" has no exact match in the
 * code — the scout fell back to "widget", a single accidental hit in the
 * `<title>`, and the edit landed there instead of near the buttons). A
 * message term that has no exact match in the code may still resolve
 * through a received inflectional suffix (`suffixes`, the register's own
 * class) — "buttons" resolves against `button` the same way it does for
 * the router.
 *
 * DISCLOSED LIMIT, found the same session and only PARTLY closed here: this
 * function has no model of what a "button" or a "widget" IS — no referent,
 * only byte-occurrence counts (P11's own principle, "a name is a reference
 * to a referent, never a byte sequence," is not yet honored HERE the way
 * cast.js's referent index honors it for prose). Fixing "buttons" → "button"
 * alone was not enough: "widget" (an accidental single hit inside the
 * document's own `<title>`, which names the whole artifact, not any part of
 * it) still out-selects "button" (4 real occurrences, the actual referent of
 * the complaint) on raw rarity. The one exclusion below — `<title>` — is a
 * narrow, disclosed, STRUCTURAL patch (the same class of fix as P5.3's
 * container-stripping: `<title>` is document metadata by the HTML spec
 * itself, never rendered page content, never anything a visual complaint
 * could be about), not a referent model. A real fix needs to know that
 * "widget" names the whole artifact and "button" names two of its parts,
 * and would generalize past this one tag; that is future work, named here
 * rather than smuggled in as if this patch already were it.
 *
 * No match at all → null, and the caller keeps the whole-file rule. The
 * span is mechanical: from the start of the first line holding the term to
 * the end of the last line holding it.
 */
export function scoutSpan(message, code, suffixes) {
  const text = String(code ?? "");
  if (!text) return null;
  if (!(suffixes instanceof Set) || !suffixes.size)
    throw new TypeError("scoutSpan: suffixes must come from the engine's prior register");
  // The fold is NOT length-preserving (NFD + mark-strip shrinks decomposed
  // input), so positions in the folded string may not be positions in the
  // text — P5.2's offset lesson. Fold per character and keep the map back.
  const map = [];
  let folded = "";
  for (let i = 0; i < text.length; i++) {
    const f = foldDiacritics(text[i]).toLowerCase();
    for (const ch of f) {
      folded += ch;
      map.push(i);
    }
  }
  // A term is a WORD the message and the code share — retrieval's own
  // token rule on both sides, never a substring graze ("don", the fragment
  // tokenize cuts from "don't", must not land on "done"). Occurrences are
  // then located with boundary checks for the same reason. A message word
  // with no exact match still resolves if it is the same FORM as a code
  // token (sameForm, shared with the router) — the term used for locating
  // places is always the code's own spelling, since that is what the bytes
  // actually hold.
  const codeTokenList = [...new Set(tokenize(text))];
  const codeTokens = new Set(codeTokenList);
  const terms = [
    ...new Set(
      [...new Set(tokenize(String(message ?? "")))]
        .filter((t) => t.length > 2)
        .map((t) => (codeTokens.has(t) ? t : codeTokenList.find((c) => sameForm(t, c, suffixes))))
        .filter(Boolean),
    ),
  ];
  // <title> is document metadata (HTML's own definition — never rendered
  // page content, never anything a visual complaint names): its bytes are
  // excluded from every term's places, so its own accidental vocabulary
  // ("Counter Widget") cannot out-select the actual referent of a complaint
  // by pure rarity. See the disclosed-limit note above this function.
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
  const titleStart = titleMatch ? titleMatch.index + titleMatch[0].indexOf(titleMatch[1]) : -1;
  const titleEnd = titleMatch ? titleStart + titleMatch[1].length : -1;
  const inTitle = (origIndex) => titleStart >= 0 && origIndex >= titleStart && origIndex < titleEnd;

  const wordy = (ch) => ch !== undefined && /[a-z0-9_]/.test(ch);
  const placesOf = (term) => {
    const places = [];
    let at = folded.indexOf(term);
    while (at !== -1) {
      if (!wordy(folded[at - 1]) && !wordy(folded[at + term.length]) && !inTitle(map[at])) places.push(at);
      at = folded.indexOf(term, at + 1);
    }
    return places;
  };
  // The most SELECTIVE shared term decides the arena — fewest occurrences,
  // ties to the longer term. "The reset button" scopes by "reset" (one
  // place), never by "button" (every row): a union over every shared word
  // would re-widen the arena the phrase just narrowed.
  let hit = null;
  let hitPlaces = null;
  for (const term of terms) {
    const places = placesOf(term);
    if (!places.length) continue;
    if (
      !hitPlaces ||
      places.length < hitPlaces.length ||
      (places.length === hitPlaces.length && term.length > hit.length)
    ) {
      hit = term;
      hitPlaces = places;
    }
  }
  if (!hitPlaces) return null;
  let a = -1;
  let b = -1;
  for (const at of hitPlaces) {
    const t0 = map[at];
    const t1 = map[at + hit.length - 1] + 1;
    if (a === -1 || t0 < a) a = t0;
    if (t1 > b) b = t1;
  }
  const start = text.lastIndexOf("\n", a) + 1;
  const nl = text.indexOf("\n", b);
  const end = nl === -1 ? text.length : nl;
  return { term: hit, span: [start, end] };
}

/**
 * The MECHANICAL rung of the edit ladder: when the instruction itself names
 * both ends of a value change, the edit is computed from the operator's own
 * words and the projection's own bytes — no model call at all.
 *
 * The measured need (2026-08-17, live e2e, gemma2:2b): asked to "change the
 * brush size slider's max from 30 to 60" — an ask that NAMES both values —
 * the model rewrote an unrelated event listener and broke the script's
 * syntax. The witness gate refused it (correctly), but a refusal is not an
 * edit: the user's direction is that edits must land easily, reliably, fast,
 * and at scale, a little at a time. For the value-change class, the model
 * was never needed: the instruction holds the old value and the new one,
 * the code holds exactly one of them, and which is which is decided by
 * OCCURRENCE, not by English — the literal the code contains is `from`, the
 * one it lacks is `to`. No preposition list, no phrasing pattern: identity
 * under presence, readable in any word order and any language.
 *
 * The shape is deliberately narrow (the mergeHtmlScript discipline — act
 * only on the unambiguous case, descend otherwise):
 *   · LITERALS are numbers (30, 2.5), hex colors (#2196F3), and quoted
 *     strings — token shapes, not vocabulary.
 *   · Exactly TWO distinct literals in the instruction, exactly ONE of them
 *     present in the code (word-boundary, through the scout's own fold
 *     discipline), the other absent. Anything else — both present, neither,
 *     three literals — is not this rung's case and returns null.
 *   · The present literal must occur exactly ONCE in the arena (`within`
 *     when the scout resolved one, the whole projection otherwise) — an
 *     ambiguous value falls to the model, never to a guess.
 *   · The op's `find` is the whole LINE holding the value (unique context
 *     for applyOps's strict wall), `add` is that line with old → new.
 *
 * Returns `{ops, from, to}` or null. The caller lands it as an ordinary
 * SYN patch — same append-only stack, same witness gate, same record — so
 * a mechanical landing is indistinguishable in the log from any other,
 * except that its reason says no model was asked.
 */
export function literalSwap(instruction, code, { within = null } = {}) {
  const text = String(code ?? "");
  if (!text) return null;
  const ask = String(instruction ?? "");
  // Token shapes, not vocabulary: hex colors first (so #30 is a color, not
  // the number 30), then quoted strings, then bare numbers.
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|"[^"\n]{1,60}"|'[^'\n]{1,60}'|\b\d+(?:\.\d+)?\b/g;
  const seen = [];
  for (const m of ask.match(LITERAL) ?? []) {
    const v = m.replace(/^['"]|['"]$/g, "");
    if (!seen.includes(v)) seen.push(v);
  }
  if (seen.length !== 2) return null;

  const arena = within ? text.slice(within[0], within[1]) : text;
  const wordy = (ch) => ch !== undefined && /[a-z0-9_]/i.test(ch);
  const placesIn = (hay, needle) => {
    const places = [];
    let at = hay.indexOf(needle);
    while (at !== -1) {
      // Word-boundary only where the literal's own edge is wordy — a hex
      // color's "#" is its own edge, a quoted string brings its context.
      const leftOk = !wordy(needle[0]) || !wordy(hay[at - 1]);
      const rightOk = !wordy(needle[needle.length - 1]) || !wordy(hay[at + needle.length]);
      if (leftOk && rightOk) places.push(at);
      at = hay.indexOf(needle, at + 1);
    }
    return places;
  };

  const counts = seen.map((v) => placesIn(arena, v).length);
  // Occurrence decides direction: the value the code holds is what changes,
  // the value it lacks is what it becomes. Both present or both absent is
  // not this rung's case.
  let from = null;
  let to = null;
  if (counts[0] > 0 && counts[1] === 0) [from, to] = seen;
  else if (counts[1] > 0 && counts[0] === 0) [from, to] = [seen[1], seen[0]];
  else return null;
  const places = placesIn(arena, from);
  if (places.length !== 1) return null;

  // The find is the whole line holding the value — unique context for the
  // strict wall, and the line is scoutSpan's own unit of arena.
  const at = places[0] + (within ? within[0] : 0);
  const lineStart = text.lastIndexOf("\n", at) + 1;
  const lineEnd = text.indexOf("\n", at);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  // The line itself must be unique in the projection, and hold the value
  // exactly once — otherwise applyOps would be handed an ambiguity this
  // rung exists to avoid.
  if (text.split(line).length - 1 !== 1 || placesIn(line, from).length !== 1) return null;
  const swapAt = placesIn(line, from)[0];
  const newLine = line.slice(0, swapAt) + to + line.slice(swapAt + from.length);
  return { ops: [{ op: "SYN", find: line, add: newLine }], from, to };
}
