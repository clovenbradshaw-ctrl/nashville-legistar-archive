import { splitSentences } from "./cite.js";
import { makeAposiopesis } from "./aposiopesis.js";

// fact-block.js — a structured fact list, extracted from the material
// itself, handed to the model BEFORE it drafts. HYPERGRAPH-FIRST-
// GENERATION.md's Phase 2: stop asking a small model to correctly parse
// dense prose under pressure and only check the result afterward; instead
// give it the material's own subject/verb/object facts directly, pre-
// digested, in the SAME shape crown.js already renders — reusing
// `hypergraph.js`'s existing extraction rather than building a second one.
//
// THE ONE THING THIS FILE DELIBERATELY DOES NOT DO: attach an address to
// any line. `source.js::buildSourceBlock`'s own header states why, with
// the measured incident — shown a working example of this instrument's
// own `[ref]` syntax, the model invented fake ones ("[4]",
// "[Faculty & Research]") that then shipped and were parsed as claims.
// This file follows that same rule, not a looser one: a fact block line
// is bare content, nothing else. (A separate, pre-existing tension, found
// while building this and left alone as out of scope: holon.js's
// `buildCorrectionPrompt`'s "unsupported"/"incomplete" modes DO thread
// `relationFindings`'s bracketed refs into a model-facing prompt today —
// a real, live instance of the same risk `buildSourceBlock` was written
// to avoid, in a different call path this file does not touch.)
//
// WHY THIS IS SAFE TO CALL ON THE PASSAGES THEMSELVES: `relations.read(x)`
// (hypergraph.js) extracts candidate triples from `x` and checks each
// against `edges` — the pool's own edge graph, built once from these same
// passages when `makeRelationReader` was constructed. A passage's own
// sentence, read back through the SAME reader that helped build the pool
// it is checked against, binds `verdict: "bound"` for whatever the
// extractor cleanly parses — not a new mechanism, the existing one, called
// on the source material instead of on a model's draft.
//
// THE HONEST LIMIT, disclosed in the plan doc and repeated here because a
// caller reading only this file should see it too: `extractRelations`
// anchors candidate verbs on capitalized surfaces only (a pronoun-subject
// sentence yields nothing), infobox/succession-box text glues into
// garbage on bare newlines, and a causal clause swallows whole into one
// opaque edge. A fact block with real, disclosed partial coverage is
// useful; a caller that reads coverage as completeness is trusting more
// than this file claims. This block SUPPLEMENTS the raw passage text
// (`sourceBlock`), never replaces it.

// `rankByQuestion` — real, live-measured need (2026-08-20): asked "did
// Hannibal Hamlin serve as VP for Lincoln's WHOLE presidency", the
// unranked block handed the model 16 real, correctly-extracted facts —
// mostly true biography ("despised his position," "missed becoming
// President by weeks") — with the one fact the question actually turns on
// (Hamlin's own term boundary, next to Johnson's) sitting unranked among
// them. The model still answered wrong. This is not the extractor's job to
// fix — the user's own framing, direct: the model, not a mechanical
// checker, is the one faculty that can judge whether a set of true facts
// answers a question; mechanical checking (crown.js/testimony) can only
// ever confirm a wording is or isn't addressable, never resolve a
// synthesis across facts, and this file does not try to make it do so.
// What IS this file's job: hand the model FEWER, MORE RELEVANT true
// constraints to reason from, the same term-overlap relevance `retrieve()`
// (source.js) already uses for passage selection — not a smarter judge,
// a smaller haystack for the same needle.
// A cap, not a threshold on truth: every real fact still gets extracted
// and ranked (rankByQuestion, above) — this only bounds how many of the
// lowest-ranked ones ride along into the prompt. Real, live-measured need
// (2026-08-20, user: "the more we spam the model the dumber it is" / "a
// lot of irrelvant shit... we need a salience gate"): the unranked,
// uncapped block put 18 real facts in front of a 2B model for a question
// that turned on exactly one of them, sitting unranked among the rest.
// The number itself is not derived from anything — a real, disclosed,
// round choice pending actual measurement of where accuracy starts
// degrading with fact-block size, matching the honest posture P39/POLICIES
// already hold for other unmeasured constants in this repo (named as a
// number to revisit, not presented as tuned).
const MAX_FACT_LINES = 8;

const rankByQuestion = (lines, questionTerms) => {
  if (!questionTerms.size) return lines;
  return lines
    .map((l, i) => ({
      l,
      i,
      // Unicode letters/numbers, not `[a-z0-9]` — the same widening
      // source.js::tokenize just earned (P62), applied here directly
      // rather than by importing tokenize itself: this ranking is
      // deliberately lighter (no stopword filter, no length floor), and
      // reusing tokenize wholesale would change more than the one thing
      // that was actually broken.
      score: l
        .toLowerCase()
        .split(/[^\p{L}\p{N}']+/u)
        .filter((w) => questionTerms.has(w)).length,
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.l);
};

/**
 * `buildFactBlock(relations, passages, question = "")` — `relations` is
 * `makeRelationReader`'s own return value (hypergraph.js), already built
 * from these same `passages`; `passages` is `retrieve()`'s own return
 * shape (`source.js`), each carrying at least `{ref, text}`. Returns
 * `null` when nothing binds (no relation vocabulary measured, or every
 * extracted candidate stayed unbound) — a typed gap, not an empty string,
 * so a caller can tell "ran, found nothing" apart from "never ran."
 *
 * Deduplicated on the exact (subject, verb, object) triple, lowercased —
 * the same identity `crownTestimony` (app.js) already dedupes on, so a
 * fact stated in two overlapping passages appears once, not twice.
 * `question`, when given, re-orders (never filters or drops) the
 * deduplicated lines by term overlap with the question's own words —
 * the facts most likely load-bearing for THIS question read first, but
 * every extracted fact still ships; a lower-ranked fact might be exactly
 * what a differently-worded question needed, and this file has no way to
 * know it's safe to discard one. Omitted: passage order, first-extracted
 * within a passage — every existing caller unaffected.
 */
// `dedupeSourceText(passages)` — the OTHER half of the salience gate,
// found the same live pass (user: "a lot of irrelvant shit... we need a
// salience gate" — reacting to a real captured prompt where the raw
// MATERIAL block restated "Hannibal Hamlin, 15th vice president,
// 1861-1865" in six differently-worded snippets, a `web:search-results`
// chunk's own ordinary shape — several pages' short bios concatenated).
// This is deliberately the SAFE half: it only ever removes a sentence
// that is near-identical to one ALREADY kept, so it can reduce volume but
// can never discard a genuinely unique fact the way a relevance filter
// risks doing (a sentence sharing zero terms with the question can still
// be exactly the contrastive fact a synthesis question needs — the "he
// was VP the same year Lincoln died, but was he VP the WHOLE time"
// specimen this same pass found; that is a real, harder, NOT-yet-solved
// problem this function does not attempt).
//
// TWO PASSES, not one — found live, in this exact order: a first cut using
// only string normalization (lowercase + collapsed whitespace + stripped
// punctuation) measured against the real specimen and UNDER-collapsed —
// "Hannibal Hamlin was the 15th vice president... serving from 1861 to
// 1865" and "Hannibal Hamlin (1809-1891) was the 15th vice president...
// (1861-1865)" are the SAME fact, differently worded, and stayed as two
// separate strings under exact-normalized matching (real test failure,
// not a guess). A fuzzy string-similarity threshold would catch that —
// and also risks silently conflating "Hamlin served as VP 1861-1865" with
// "Hamlin was replaced as VP by Andrew Johnson in 1865" (real adversarial
// test, below), which share most of the same words but say opposite
// things. No hand-picked similarity number is defensible here (this
// repo's own standing rule: measure a real signal, never tune a
// threshold) — so redundancy is instead measured the same way
// `buildFactBlock` already measures fact identity: does this sentence's
// OWN set of BOUND (subject,verb,object) triples add nothing beyond what
// an earlier-kept sentence already contributed? Two differently-worded
// restatements of "Hamlin —was→ 15th vice president" bind to the SAME
// triple (hypergraph.js's own real extraction, not a string comparison),
// so the second is redundant BY WHAT IT ACTUALLY ASSERTS, not by how it
// happens to be spelled — while "replaced by Andrew Johnson" asserts a
// DIFFERENT triple (or none at all, its own real, disclosed extraction
// limit — see this file's own header) and is never at risk of being
// mistaken for a restatement. Pass 1 (exact-normalized) still runs first,
// cheaply, for the literal copy-paste case that needs no extraction at
// all; pass 2 (`relations`, when supplied) catches what pass 1 can't.
// `relations` optional and omitted-safe: every call site that doesn't
// have one yet gets pass 1's real, smaller, honestly-partial win only.
//
// Cross-passage, first-seen order wins — deliberately not the longest or
// most-detailed phrasing, because "which restatement is most informative"
// is exactly the judgment this function has no way to make safely.
//
// Returns a NEW passages array — `p.text` rewritten, every other field
// (`ref`, `identity`, …) preserved — for building the PROMPT only.
// Callers must keep the ORIGINAL `passages` for citation checking
// (`checkCitations`), succession-box parsing (`parseSuccessionBoxes`),
// and everything else that must see the material's own real bytes.
const normalizeForDedup = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Real, measured refinement (still no similarity threshold): the extractor
// captures everything after subject+verb up to the sentence boundary as
// ONE object, so "Hamlin —was→ the 15th vice president" (short sentence)
// and "Hamlin —was→ the 15th vice president... in the administration of
// President Lincoln" (a longer trailing clause on the SAME core fact)
// bind to DIFFERENT full-object strings under exact matching — measured
// live, a real test failure, not assumed. `subsumes` catches this
// specific, disclosed extractor shape (one object is a PREFIX of the
// other, same subject+verb) without comparing arbitrary similarity: a
// "lawyer" object is never a prefix of "the 15th vice president..." or
// the reverse, so two genuinely different facts sharing a subject+verb
// (the exact adversarial case this file's own tests pin) are never at
// risk from this check.
const subsumes = (existingKeys, subj, verb, obj) =>
  existingKeys.some(([s, v, o]) => s === subj && v === verb && (o.startsWith(obj) || obj.startsWith(o)));

const tripleKeysOf = (relations, sentence) => {
  const report = relations.read(sentence);
  return (report?.claims ?? [])
    .filter((c) => c.verdict === "bound")
    .map((c) => `${c.end1}|${c.label}|${c.end2}`.toLowerCase());
};

// A TRUNCATED PREVIEW OF A SENTENCE SHOWN IN FULL ELSEWHERE IS THE SAME
// TEXT, NOT A SECOND FACT — found live 2026-09-09 ("who built the Panama
// Canal... why did the French attempt fail?"): a fetched page's own
// "AI-enhanced document" summary caption was extracted TWICE from that
// one page's raw text — once cut short with a trailing "…" ("...highlighting
// mismanagement and opposition from the United…"), once in full a few
// hundred bytes later ("...from the United States that led to its failure.")
// — and the search-result digest carried the truncated copy as its own
// snippet (a search engine's own convention), so the two copies landed in
// TWO DIFFERENT passages. Neither existing pass caught it: pass 1 below is
// exact-match only, and the strings differ (one is cut off mid-clause);
// pass 2 (relations) failed for a subtler reason — the clause the
// truncation happens to cut off ("...United States THAT led to its
// failure") produced its OWN extra, malformed triple (a relative "that"
// read as a connector), and `covered`'s own "one new fact survives the
// whole sentence" rule — deliberately built so a sentence contributing
// even one new fact is never dropped wholesale — treated that extra
// triple as real new information. The model was shown the identical
// sentence twice and wrote about it twice, once per copy.
//
// The fix does not touch either existing pass or lean on the extractor at
// all: a trailing ellipsis (the single Unicode character, or three
// periods) is a STRUCTURAL truncation marker, not sentence-final
// punctuation, and checking whether the truncated text is a byte-for-byte
// PREFIX of some fuller sentence elsewhere in the SAME material is exactly
// `subsumes`'s own already-accepted shape (one string is a prefix of the
// other), applied to the whole sentence instead of just a triple's object.
// It is a structural containment check, never a similarity guess — an
// ordinary longer sentence that merely shares an opening clause with an
// earlier one, and ends normally, is never touched (no trailing ellipsis,
// no match). Order-independent (computed once, up front, over every
// sentence in every passage) because a search-result digest is not
// reliably fetched before or after the full page it duplicates.
//
// Shared by both halves of the salience gate — `dedupeSourceText` below
// AND `buildFactBlock` further down — because `buildFactBlock`'s own
// `spans` (rendered as `spanBlock`, holon.js) bypass `dedupedSourceBlock`
// entirely whenever any fact bound at all (holon.js's own `rawSource: …
// factBlock ? (spanBlock ?? dedupedSourceBlock) : dedupedSourceBlock`), so
// fixing dedupeSourceText alone leaves the live bug's own actual failure
// mode — the FACTS block — untouched.
//
// The DOMINATED/LONE split itself is `aposiopesis.js`'s own job (moved out
// 2026-09-15, general watcher for truncation artifacts, not a repeat of
// this one specimen): `dominated` is exactly what this file always
// computed and drops below; `lone` — a trailing-ellipsis sentence with
// nothing here to complete it — is new, real live traffic (an ordinary
// DuckDuckGo search-results digest routinely carries several of these with
// no duplicate to catch), and is surfaced on `buildFactBlock`'s own return
// object rather than silently passed through.
const aposiopesis = makeAposiopesis({ splitSentences, normalize: normalizeForDedup });

export function dedupeSourceText(passages, relations = null) {
  if (!Array.isArray(passages) || !passages.length) return passages ?? [];
  const { dominated } = aposiopesis.find(passages);
  const seenText = new Set();
  const seenParsed = []; // [subject, verb, object] — subsumes() covers exact matches too (o.startsWith(o) is always true)
  return passages.map((p) => {
    const text = String(p?.text ?? "");
    if (!text.trim()) return p;
    const kept = splitSentences(text).filter((s) => {
      const norm = normalizeForDedup(s);
      if (!norm) return false;
      if (dominated.has(norm)) return false;
      if (seenText.has(norm)) return false;
      if (relations) {
        const keys = tripleKeysOf(relations, s);
        // Redundant only when EVERY triple this sentence asserts was
        // already contributed by an earlier-kept sentence (exact match, or
        // `subsumes`'s own prefix case — see its header) — a sentence
        // asserting one already-seen fact PLUS one new one still carries
        // real, new information and must survive. A sentence with zero
        // extracted triples (extraction's own disclosed coverage gap —
        // pronoun subjects, garbled passive voice) is never treated as
        // redundant by this pass; only pass 1's literal-text check can
        // catch a true copy-paste repeat of such a sentence.
        const covered = keys.length && keys.every((k) => {
          const [subj, verb, obj] = k.split("|");
          return subsumes(seenParsed, subj, verb, obj);
        });
        if (covered) return false;
        for (const k of keys) seenParsed.push(k.split("|"));
      }
      seenText.add(norm);
      return true;
    });
    return { ...p, text: kept.join(" ") };
  });
}

export function buildFactBlock(relations, passages, question = "") {
  if (!relations || !Array.isArray(passages) || !passages.length) return null;
  const questionTerms = new Set(
    String(question ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}']+/u)
      .filter(Boolean),
  );
  const seen = new Set();
  const lines = [];
  const spans = [];
  const spanSeen = new Set();
  // See `aposiopesis.js`'s own header above `dedupeSourceText` — this is
  // the OTHER half of the same fix. `spanBlock` (holon.js, built from
  // `spans` below) stands in for `dedupedSourceBlock` whenever any fact
  // bound at all, so a truncated preview's own claim must never reach
  // `spans` here either, or the live bug survives untouched by the fix
  // above. `truncatedLone` rides the returned object (below) rather than
  // the prompt text — same firewall.js posture as `coverage`/`omitted`.
  const { dominated, lone: truncatedLone } = aposiopesis.find(passages);
  let sentenceCount = 0;
  let boundSentenceCount = 0;
  for (const p of passages) {
    const text = String(p?.text ?? "");
    if (!text.trim()) continue;
    // The real total, independent of report.claims: a pronoun-subject
    // sentence (hypergraph.js's own disclosed gap — candidate-verb
    // nomination anchors on capitalized surfaces only) yields ZERO
    // entries anywhere in report.claims, not even an "unheard" one
    // (judge()'s own read() skips it — "a pronoun subject is noise here,
    // not a claim about the cast"), so a denominator built FROM claims
    // would silently drop exactly the sentences most worth disclosing as
    // uncovered. splitSentences here is the SAME function hypergraph.js's
    // own sentencesOf calls internally (via cite.js); the two can
    // disagree only where a passage carries structural furniture
    // (headers, addresses) sentencesOf's own blankStructure pass masks
    // first — ordinary prose, the shape this block exists for, splits
    // identically either way.
    sentenceCount += splitSentences(text).length;
    const report = relations.read(text);
    if (!report?.examined || !report.claims?.length) continue;
    const boundSentences = new Set();
    for (const claim of report.claims) {
      if (claim.verdict !== "bound") continue;
      boundSentences.add(claim.sentence);
      // A truncated preview of a sentence shown in full elsewhere is not a
      // second fact — still counted toward `boundSentenceCount` above (it
      // genuinely was examined and did yield a claim), just never turned
      // into its own line.
      if (dominated.has(normalizeForDedup(claim.sentence))) continue;
      const key = `${claim.end1}|${claim.label}|${claim.end2}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const negated = claim.polarity === "-" ? " not" : "";
      lines.push(`${claim.end1} —${negated} ${claim.label}→ ${claim.end2}`);
      // THE SPANS THAT PRODUCED THIS NOTE, and only those (user direction,
      // 2026-08-28: "use only the spans linked to the precise hyperlexicon
      // elements"). A note is defeasible, so what defeats it has to be
      // present — but the whole retrieved chunk is not that. Sending the
      // chunk sent page furniture along with it; measured live, a prompt
      // carried "'President Lincoln' and 'Mr. Lincoln' redirect here" as
      // though it were evidence. The sentence that actually bound the claim
      // is the evidence, it is byte-addressed, and it is what goes.
      for (const sp of claim.spans ?? []) {
        // A CLAIM'S OWN SPANS ARE POOLED ACROSS EVERY PASSAGE THAT STATES
        // THE SAME TRIPLE — found live, the same specimen as above: the
        // triple both the truncated and the full sentence bind carries
        // BOTH sentences' spans on every claim that matches it, including
        // one whose OWN sentence (the FULL one) was never itself skipped
        // by the check two lines up. Filtering by SENTENCE alone lets a
        // truncated preview's span back in through an unrelated claim that
        // happens to share its edge — filtering by the SPAN'S OWN text is
        // what actually keeps it out.
        if (dominated.has(normalizeForDedup(String(sp.text ?? "")))) continue;
        const at = `${sp.ref}#${sp.start}-${sp.end}`;
        if (spanSeen.has(at)) continue;
        spanSeen.add(at);
        spans.push({ at, ref: sp.ref, text: String(sp.text ?? "").replace(/\s+/g, " ").trim() });
      }
    }
    boundSentenceCount += boundSentences.size;
  }
  // AN EXPLICIT VOID, never a vanished block. User rule, 2026-08-26: "the
  // best way to keep a model from hallucinating is to either give it the
  // answer, or an explicit void in place of the answer." Returning null
  // here did neither — the FACTS section simply disappeared from the
  // prompt, leaving the model passages, no facts, and no statement that
  // there were no facts. A silent absence is precisely the shape a model
  // fills from memory, and it filled it: "who was lincoln's vp?" came back
  // "William R. Hargis", a person who does not exist.
  //
  // The difference between this and `null` is not cosmetic. `null` is the
  // absence of a claim about the material; this is a CLAIM that the
  // material yielded nothing — the same distinction grounding.js already
  // holds between `examined: false` and `clean` ("clean and examined are
  // different facts"), stated here in the one place the model can read it.
  //
  // The `sentenceCount` guard keeps a distinction the existing tests were
  // right to protect: NO MATERIAL and MATERIAL THAT YIELDED NOTHING are
  // different facts, and only the second is a void worth stating. Passages
  // that are empty or whitespace examine zero sentences — there is nothing
  // to have failed to extract from, so `null` stays correct there and the
  // caller's own no-material disclosure handles it. One real sentence that
  // yielded no relation is the case this void exists for.
  if (!lines.length && sentenceCount === 0) return null;
  if (!lines.length) {
    return {
      lines: [],
      allLines: [],
      coverage: 0,
      empty: true,
      truncatedLone,
      // FIREWALL (firewall.js): the void keeps every bit of its force —
      // the "William R. Hargis" incident below proved a SILENT absence is
      // what a model fills from memory — while losing the machinery it
      // used to describe to say so ("Not one of the 97 sentence(s) in your
      // material yielded an extractable relation… no mechanically
      // confirmed fact behind this turn"). The counts are real and still
      // computed; they ride on `coverage`/`sentenceCount` to the thinking
      // panel, where a reader can see them, and not into the model.
      text:
        `I made no notes on these — nothing I could read came out of them. That is a stated ` +
        `emptiness, not an oversight: read the sources' own words below, and if the answer is ` +
        `not there, say plainly that it is not. Do not fill this in from memory.`,
    };
  }
  const ranked = rankByQuestion(lines, questionTerms);
  const shown = ranked.slice(0, MAX_FACT_LINES);
  const coverage = sentenceCount ? Math.round((boundSentenceCount / sentenceCount) * 100) : 0;
  return {
    lines: shown,
    allLines: ranked,
    // The other register, ready to render: minimal, byte-addressed, and
    // each under the source that wrote it.
    spans,
    coverage,
    // What the header used to say out loud to the model, kept as data for
    // the thinking panel instead (firewall.js).
    omitted: ranked.length - shown.length,
    sentenceCount,
    boundSentenceCount,
    // aposiopesis.js's own LONE list: a trailing-ellipsis sentence with
    // nothing in this material to complete it — real, unique text, kept
    // whole in every passage above, disclosed here rather than left for a
    // reader to notice as an unexplained "…" in what was sent.
    truncatedLone,
    // FIREWALL (firewall.js): this header used to carry its own build
    // notes into a 2B model's context — "(7 of 97 sentence(s) with an
    // extractable relation; the passages above are the complete record,
    // this list is a partial aid, not a substitute for them; 3
    // lower-ranked fact(s) omitted here…)". Every one of those clauses is
    // a statement about how this instrument works, and the measured
    // consequence was a model that answered by describing its input
    // ("The prompt specifically identifies Hannibal Hamlin…"). The
    // numbers are not lost: `coverage`, `lines` and `allLines` are
    // returned as fields, and the disclosure panel is where a reader
    // reads them.
    // TWO REGISTERS, AND THE NOTES ARE DEFEASIBLE (user direction,
    // 2026-08-28): "never give it the raw text alone, we always feed it the
    // hyperlexicon's surf and fold with the minimal raw spans from the
    // original... it makes a distinction between 'this is my reading' and
    // the raw spans with sources explicit" — and then, sharper: "let's
    // consider the hyperlexicon fold the speaking model's NOTES, DEFEASIBLE."
    //
    // That is the right standing for this block and it is not what the block
    // used to claim. It opened "Known to be true:", which asserts something
    // about the WORLD while having only done something about a READING — and
    // on a bad extraction (this file's own header lists three: pronoun
    // subjects, glued infobox rows, swallowed causal clauses) that phrasing
    // hands a model a fabrication wearing a certificate.
    //
    // Notes are the honest shape. They belong to the model about to speak
    // rather than to an authority handing it facts; they are provisional;
    // and they LOSE to the sources' own words, which sit beside them under
    // their own names. Saying which wins is the whole point of keeping the
    // two registers apart — a model that cannot tell a note from a quotation
    // has no way to prefer the quotation.
    text:
      `My notes so far — what I made of the sources, which may be wrong; ` +
      `where a note and a source disagree, the source is right:\n` +
      shown.map((l) => `- ${l}`).join("\n"),
  };
}
