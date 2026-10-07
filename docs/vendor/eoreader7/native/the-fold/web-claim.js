// web-claim.js — the DEF-shape proxy for an open web-ground slot.
//
// This file used to also carry a web-specific filler-discovery mechanism
// (`bestStatement`/`discoverFillers`/`foldWebClaim`) — deleted, not merely
// unused, per direct user redirect: DEF, EVA, and REC are each already ONE
// reusable organ in this repo, and that mechanism was a second, parallel
// EVA reinventing what the first one already does correctly.
//
//   DEF  — grid.js's `define`/`land`, unchanged, reused as-is.
//   EVA  — capacity-runner.js's real `relations` capacity: `judge()`
//          (hypergraph.js) already computes `cardinality: {fillers}` on
//          ANY ground's edges the moment more than one object binds the
//          same subject+verb (P32's `clusterFillers`), and the SAME
//          capacity's `query` mode already exposes open-slot discovery
//          directly (`reader.queryReferents({subject, verb, object})`,
//          referent-aware — resolves "Lincoln"/"President Lincoln" as one
//          subject via cast.js, which a hand-rolled string-fold match
//          cannot). Neither of these cares whether its ground's chunks
//          came from a loaded local file or a fetched web page — the only
//          genuinely new plumbing a web ground needs is turning search
//          results into chunks (`chunkSource`, already this app's one
//          chunker) and handing them to the SAME, unmodified reader. See
//          `eval/web-snip-eval.mjs` for that plumbing and the real,
//          live-driven Lincoln/Johnson/Washington specimens.
//   REC  — grid.js's real `concedeEvaluation(log, priorTaskId, {trigger})`,
//          unchanged, called directly against the DEF's own task_id when
//          the EVA's discovery disagrees with the DEF's declared shape.
//
// What's left here, genuinely new and narrow: the DEF's OWN declared-shape
// annotation — does the question's grammar presuppose a single answer, a
// plural one, or say nothing either way — from the engine's received
// closed classes, no new word list, no ground needed. It rides on the DEF
// as a disclosed annotation (`grid.attachResult(log, defTaskId,
// {declaredShape: ...})`) so a later REC's `trigger` can say the shape
// changed FROM something, not just TO something.

import { CLAIM_STOPWORDS } from "../organs/grounding.js";

// A head phrase capped at two tokens ("vice president", "cabinet
// secretaries", "prime minister") — not a tuned number, a scope cut,
// disclosed: this repo has no NP-chunker and has repeatedly declined to
// build one (widget.js's own rewrite away from hand-typed word lists;
// MECHANICAL-COVERAGE-INVESTIGATION.md's succession-answer.js sketch,
// scoped narrow on the identical "who was PERSON's OFFICE" shape and never
// widened). Two tokens covers the compounds this repo's own specimens use
// without reaching for a parser this repo does not have.
const SLOT_HEAD_MAX_TOKENS = 2;

const tokenize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter(Boolean);

/**
 * Does the question's OWN grammar presuppose a single answer, a plural
 * one, or say nothing either way? Not a cardinality MEASUREMENT — this
 * repo has no organ that measures cardinality without a ground already
 * read — a defeasible PROXY, from the engine's own received closed
 * classes, no new word list:
 *
 *   - a DEFINITE determiner ("the", "this", …) or a possessive marker
 *     ("Lincoln's") immediately before the answer's noun phrase presupposes
 *     the noun is already uniquely identifiable (Russell/Strawson — the
 *     same clause hypergraph.js's own P32 comment names for `clusterFillers`,
 *     applied here to the QUESTION's grammar instead of a ground's edges).
 *   - the noun phrase's own LAST token (English NPs are right-headed:
 *     "vice PRESIDENT", "cabinet SECRETARIES", "prime MINISTER" — the head
 *     is the final word, not the first, so a plural check must not read
 *     the compound's first token) carrying a bare inflectional "-s" not
 *     itself part of a possessive reads as the question naming a PLURAL
 *     slot outright — `declared: "enumerated"`.
 *   - otherwise, and whenever no determiner/possessive marker is found at
 *     all (e.g. "what number was Andrew Johnson" — a wh-number question
 *     with no determined noun phrase at the answer slot), `declared:
 *     "unknown"`. Absence of the marker is NOT evidence of plurality —
 *     "unknown" is the honest default, never "not single".
 *
 * `definiteDeterminers`/`inflectionalSuffixes`/`interrogativePronouns`/
 * `mannerReasonPronouns` arrive injected from the engine's prior register
 * (perceiver/text/priors.js, the SAME classes widget.js/seed.js already
 * route on — checked directly before reuse: seed.js's own `archetypeOf`
 * was the first candidate tried for this and refused on the merits — it is
 * CRISPR code-scrubbing's "build me a widget like X" archetype extractor,
 * requires a NON-interrogative sentence by construction, and has nothing
 * to do with a factual question's cardinality at all).
 *
 * NO MODEL CALL ANYWHERE IN THIS FUNCTION, by direct user instruction
 * (2026-08-27): "any model call should be about creating surf query
 * content, not structure the slots." Every fact this function returns is
 * traced to a closed, giver-cited class in the engine's shared register —
 * the same standing DEFINITE_DETERMINERS/NEGATION_WORDS already have — or
 * to the received POS prior. A model may compose a search query FROM this
 * function's output elsewhere in the turn; it is never asked what the
 * output should be.
 *
 * This expectation MUST be revised by what the EVA's own hunt finds. It
 * never gates a search; it only states what the search can go on to
 * confirm or refute.
 */
export function declaredSlotShape(
  question,
  { definiteDeterminers, inflectionalSuffixes, interrogativePronouns, mannerReasonPronouns, isAdposition = null } = {},
) {
  if (!(definiteDeterminers instanceof Set) || !definiteDeterminers.size) {
    throw new TypeError("declaredSlotShape: definiteDeterminers must come from the engine's prior register");
  }
  if (!(inflectionalSuffixes instanceof Set) || !inflectionalSuffixes.size) {
    throw new TypeError("declaredSlotShape: inflectionalSuffixes must come from the engine's prior register");
  }
  if (!(interrogativePronouns instanceof Map) || !interrogativePronouns.size) {
    throw new TypeError("declaredSlotShape: interrogativePronouns must come from the engine's prior register (priors.js::INTERROGATIVE_PRONOUNS)");
  }
  if (!(mannerReasonPronouns instanceof Set) || !mannerReasonPronouns.size) {
    throw new TypeError("declaredSlotShape: mannerReasonPronouns must come from the engine's prior register (priors.js::MANNER_REASON_PRONOUNS)");
  }
  const tokens = tokenize(question);
  if (!tokens.length) return { declared: "unknown", marker: null, headPhrase: null };

  // A manner/reason question refuses OUTRIGHT, checked FIRST — found live:
  // checking this only inside the interrogative path let "Why did the war
  // start?" open a slot anyway through the determiner path below ("the
  // war"), because that path fires independently of what word opened the
  // sentence. "How"/"why" ask for an explanation, not a filler, regardless
  // of what determiners appear later in the sentence.
  if (mannerReasonPronouns.has(tokens[0])) return { declared: "unknown", marker: tokens[0], headPhrase: null };

  // Anchor recovery: the object of the first adposition (of/in/for/at/…)
  // AFTER a given position — one mechanism, shared by both paths below, so
  // "the lead singer OF Van Halen" and "who was IN Van Halen" recover their
  // anchor identically rather than through two different code paths for
  // what is structurally the same relation. `isAdposition` reads the
  // received POS prior's ADP tag (generalizes past a single hardcoded
  // preposition — "of"/"in"/"at"/"for" etc. all fall out of one classifier
  // call) and is OPTIONAL: omitted, no anchor is recovered by this path at
  // all — never a guess, never a private preposition list as a fallback.
  const anchorAfter = (fromIdx) => {
    if (typeof isAdposition !== "function") return { anchorHint: null, anchorPreposition: null };
    for (let i = fromIdx; i < tokens.length; i++) {
      if (!isAdposition(tokens[i])) continue;
      const span = [];
      for (const t of tokens.slice(i + 1)) {
        if (CLAIM_STOPWORDS.has(t)) break;
        span.push(t);
        if (span.length >= SLOT_HEAD_MAX_TOKENS + 2) break;
      }
      // The preposition ITSELF travels with the span, not just its object —
      // found live: without it, every slot label read "X of Y" regardless
      // of the real relation, so "who was IN Van Halen" displayed as
      // "person OF Van Halen", a wrong paraphrase of a real relation this
      // function had already read correctly. Carried raw (pre-lowercase
      // token) since it is display text, not a match key.
      if (span.length) return { anchorHint: span.join(" "), anchorPreposition: tokens[i] };
    }
    return { anchorHint: null, anchorPreposition: null };
  };

  let markerAt = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    // FOUND LIVE: the possessive check alone does not distinguish genitive
    // 's ("Lincoln's" — belonging to Lincoln) from a CONTRACTION of "is"/
    // "has" ("that's" = "that is"). English pronouns never take genitive
    // 's at all — they have their own distinct possessive forms ("its",
    // never "it's" as a possessive) — so an 's-marked token whose base is
    // ALREADY a pronoun is a contraction, never a possessive. Checked
    // against the interrogative class too: "who's" is "who is", not a
    // possessive marker either (its own gloss belongs to Path 2 below).
    const base = t.replace(/['’]s$/, "");
    const isContraction = base === t ? false : interrogativePronouns.has(base) || CLAIM_STOPWORDS.has(base);
    if (definiteDeterminers.has(t) || (/['’]s$/.test(t) && !isContraction)) {
      markerAt = i;
      break;
    }
  }

  // Path 1: determiner/possessive-marked head phrase — a written noun
  // actually present in the question ("the lead singer", "Lincoln's vice
  // president"). Case-insensitive throughout: capitalisation is never a
  // requirement for extraction, only ever a downstream confirmation signal
  // (L2 — capitalisation is a differentiator, never the primary signal),
  // so a fully lowercase question extracts identically to a capitalised one.
  if (markerAt !== -1) {
    const head = [];
    for (const t of tokens.slice(markerAt + 1)) {
      if (CLAIM_STOPWORDS.has(t)) break;
      head.push(t);
      if (head.length >= SLOT_HEAD_MAX_TOKENS) break;
    }
    if (head.length) {
      const last = head[head.length - 1];
      const bareS = last.length > 3 && /s$/.test(last) && !/ss$/.test(last) && !/['’]s$/.test(last) && inflectionalSuffixes.has("s");
      // GRAMMATICAL NUMBER IS NOT CARDINALITY. A singular head phrase used
      // to return `declared: "single"` — an assertion about how many
      // fillers the WORLD holds, read off English morphology alone. It is
      // not one: "who was Lincoln's vice president?" is grammatically
      // singular and factually two-valued (Hamlin 1861-65, Johnson 1865),
      // and every wrong answer this question produced named exactly one
      // man. Declaring the space single-filler before any material is
      // consulted is the unearned overlay this codebase already refuses
      // elsewhere — Thrax's categories deciding a fact about the world
      // (hypergraph.js's own giver note), and P4's "numbers are declared,
      // gaps are results" read backwards.
      //
      // So the absence of a plural marker now earns "unknown" — the honest
      // zero of the space, waiting on the material — while the grammatical
      // reading is kept as a DISCLOSURE (`grammaticalNumber`) rather than
      // thrown away. A plural marker still earns "enumerated": that one IS
      // positive evidence the asker expects many, and nothing downstream
      // should stop treating it as such.
      //
      // Deliberately NOT claimed: this does not by itself find a second
      // filler. web-hunt.js's REC trigger reads `declared !==
      // "enumerated"`, which is true for both "single" and "unknown", so
      // concession behaviour is unchanged. What changes is that nothing
      // downstream may now read a one-filler WORLD out of a one-noun
      // QUESTION.
      return {
        declared: bareS ? "enumerated" : "unknown",
        grammaticalNumber: bareS ? "plural" : "singular",
        marker: tokens[markerAt],
        headPhrase: head.join(" "),
        ...anchorAfter(markerAt + 1),
      };
    }
  }

  // Path 2 — NEW: an interrogative pronoun with an ELIDED head noun. "who
  // was in Van Halen?" has no written noun at all for Path 1 to scan for —
  // "member"/"person" is IMPLIED by the pronoun itself, never present in
  // the text. Found live driving a net-new question (2026-08-27): Path 1
  // alone returned `headPhrase: null` for this shape, so `briefFor`
  // declared no slot at all for a question that manifestly opens one.
  //
  // The gloss ("who" -> "person") is a lexicographic fact about the word,
  // not an invented ontology — every dictionary defines "who" partly by
  // the kind of referent it seeks. This does NOT declare the void's INS
  // cell (a real admission TEST needs a checkable type vocabulary with its
  // own giver, unbuilt — see void-shape.js's own header); it only gives
  // NUL a coherent slot label instead of a headless one.
  const first = tokens[0];
  if (interrogativePronouns.has(first)) {
    return {
      declared: "unknown",
      grammaticalNumber: undefined,
      marker: first,
      headPhrase: interrogativePronouns.get(first),
      ...anchorAfter(1),
    };
  }

  return { declared: "unknown", marker: markerAt === -1 ? null : tokens[markerAt], headPhrase: null };
}
