/* Wigmore speaks:
 * “for  example,  the  statement  of  A 
that  B  struck  X,  —  it  is  plain  that  at  least  three  distinct  elements  are 
present ;  or,  put  in  another  way,  that  there  are  three  stages  to  the  process, 
in  the  absence  of  any  one  of  which  we  cannot  conceive  of  testimony.  First. 
the  witness  must  know  something,  i.e.  must  have  observed  the  affray  and 
received  some  impressions  on  the  question  whether  B  struck  X ;  to  this 
element  may  be  given  the  generic  term  Perception.  Secondly,  the  witness 
must  have  a  recollection  of  these  impressions,  the  result  of  his  Perception ; 
this  may  be  termed  Recollection,  or  Memory.  Thirdly,  he  must  communi- 
cate this  recollection  to  the  tribunal:  that  is,  there  must  be  Communica- 
tion,  or  Narration,  or  Relation  (for  there  is  no  single  term  entirely  appro- 
priate). Now  the  very  notion  of  taking  a  human  utterance  as  the  basis 
of  belief  in  the  truth  of  the  fact  asserted  impliedly  attributes  these  three 
processes  to  the  witness,  —  Perception,  Recollection,  Communication.”
 *
 * This file implements Wigmore's principles of testimonial evidence, emphasizing the structured process of witness testimony and its reliance on perception, recollection, and narration.  My teaching advocates for the meticulous application of these principles, ensuring a robust foundation for evaluating the truth of witness testimony, rather than simply accepting every statement as truth.
 *
 * — the engineering record below, kept whole —
 */
// testimony.js — the semantic witness tier: a small model handed ONE claim
// Handle: Wigmore — after John Henry Wigmore, evidence scholar who charted testimony by asking the witness twice and reading the verdict from the pair. Amendment XVII.
// and ONE page's bytes, asked one BINARY question twice — "does the passage
// say this sentence is true?" for the claim, then for its sibling-swapped
// twin — with the verdict derived mechanically from the pair and every wall
// around the answers mechanical (L5: the witness is never trusted on its
// own word; measured same day: the three-way form got the right `because`
// and the wrong label out of gemma2:2b, so classification was taken away
// from the model entirely).
//
// Born from a measured failure (2026-08-19, "who won the 1960 world
// series?"): gemma2:2b answered "The New York Yankees won the 1960 World
// Series" — false, the Pirates won — and the checking ladder split exactly
// along its levels. The relation tier (hypergraph.js) said "the material
// never binds this edge" — honest but weak: its contradiction test matches
// an edge on subject+verb, and "the Pirates won X" vs "the Yankees won X"
// differs in SUBJECT, so no edge ever matched. Knowing that "won the 1960
// World Series" seats exactly one subject is world knowledge a mechanical
// extractor doesn't have. Meanwhile the web-proof tier CORROBORATED the
// false claim ✓ 3/3 — bag-of-words containment finds the loser's name all
// over every page about the series. The tier that understood least spoke
// loudest. A reader over the same bytes settles it in one short call:
// "contradicted — the passage says the Pirates won."
//
// The witness is a WITNESS, not an oracle (parliament-of-witnesses): its
// testimony lands typed beside the byte tier and the structural tier, and
// it is disciplined three ways, all mechanical, all here:
//   1. It must point at bytes: `because` — the passage words that decide
//      its verdict — is checked for containment in the slice it actually
//      read (the same wordSet/hasWord fold snipClaim states claims with).
//      Testimony whose decider is not in the passage is refused.
//   2. It is armed with a perturbation (the null-arm discipline): the same
//      question is asked about a sibling-swapped claim — the claim's name
//      replaced with a name from the PAGE'S OWN universe (Leibniz: the
//      sibling comes from the witness's material, never from the world at
//      large). A witness whose verdict does not move under the swap is
//      testifying about the vocabulary, not the claim — a distinction
//      without a difference — and its testimony is refused as insensitive.
//   3. A page with no sibling to swap cannot be armed; testimony still
//      ships but carries `armed: false` — disclosed, never implied tested.
//
// Pure: no DOM, no fetch, no model call — the caller (app.js) owns the one
// crossing and injects the completed text back through readTestimony.

import { foldDiacritics } from "./source.js";
import { wordSet, hasWord, splitSentences, CLAIM_STOPWORDS } from "./grounding.js";
import { namesIn } from "./cite.js";
import { snipClaim } from "./primary.js";

// A small, disclosed furniture register for REAL FETCHED PAGES — the same
// precedent grounding.js's own ABBREV_EXPANSIONS sets (a narrow, measured
// list with its reason stated, never a general capability claim). Measured
// live (2026-08-19, 25-specimen batch eval against real Wikipedia pages): a
// sentence naming an image's own caption ("a 1900 portrait by Jean Leon
// Gerome Ferris depicting Franklin, Adams, and Jefferson working on the
// Declaration") legitimately repeats the claim's own topic words in the
// caption's OWN TITLE TEXT ("Writing the Declaration of Independence,
// 1776") — which out-scored the sentence actually crediting Jefferson,
// because caption prose and reference prose read identically to word-
// overlap scoring. This does not classify content — it excludes the one
// Wikipedia furniture shape measured to cause it, the same way `blankStructure`
// excludes markdown headings from model output. A sentence matching stays
// OUT of candidate scoring entirely; it is never silently trusted either.
const CAPTION_MARKERS = /\b(?:portrait by|photograph by|painting by|photo by|drawing by|illustration by|engraving by)\b/i;

/** Ollama structured-outputs schema: a BINARY answer plus the decider in
 * the passage's own words — a shape by physics, not by asking nicely
 * (completeOnce's own posture for json calls). Binary on purpose, measured
 * (2026-08-19, gemma2:2b live): asked the three-way question, the small
 * model wrote a `because` that stated the contradiction perfectly and then
 * labeled it "neither" — the reading was right and the CLASSIFICATION was
 * beyond it. So the model is only ever the mouth: it answers "does the
 * passage say this sentence is true?" twice — the claim and its
 * sibling-swap — and the verdict (states / contradicts) is DERIVED
 * mechanically from the pair in foldTestimony, never asked as a label. */
export const WITNESS_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", enum: ["yes", "no"] },
    because: { type: "string" },
  },
  required: ["answer", "because"],
};

/** Bounded read: the witness never gets a whole page. Sentences that state
 * the claim's own tokens first (snipClaim — the same organ the primary tier
 * snips with), widened to their neighbours so a contradiction living NEXT
 * to the claim's vocabulary is inside the window; when nothing anchors,
 * null — a typed absence the caller reports, never the first N chars of a
 * page pretending to be relevant. */
export const WITNESS_SLICE_MAX = 1600; // chars — a reading, not a document (P9: declared)

export function witnessSlice(target, faceText) {
  const src = String(faceText ?? "");
  if (!src.trim()) return null;
  const sentences = splitSentences(src);
  if (!sentences.length) return null;
  // Anchor sentences: full containment first (snipClaim), else the sentences
  // sharing the most claim tokens — a contradiction rarely restates every
  // token ("the Pirates won it" states no "Yankees").
  const snips = snipClaim(target, src);
  let anchors = snips.map((s) => s.start);
  if (!anchors.length) {
    const tokens = (target?.tokens?.length ? target.tokens : String(target?.text ?? "").split(/\s+/)).filter(Boolean);
    if (!tokens.length) return null;
    const scored = sentences
      .map((s) => ({ s, n: tokens.filter((t) => hasWord(wordSet(s.text), t)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2);
    anchors = scored.map((x) => x.s.start);
  }
  if (!anchors.length) return null;
  // The window: each anchor sentence with one neighbour either side,
  // deduplicated, in document order, joined — capped at the declared max.
  const picked = new Set();
  for (const at of anchors) {
    const i = sentences.findIndex((s) => s.start === at);
    if (i < 0) continue;
    for (const j of [i - 1, i, i + 1]) if (sentences[j]) picked.add(j);
  }
  const slice = [...picked]
    .sort((a, b) => a - b)
    .map((i) => sentences[i].text)
    .join(" ")
    .slice(0, WITNESS_SLICE_MAX);
  return slice.trim() || null;
}

/** The one question — binary, in prose (prompt format matches output
 * format — no bracket scaffolding), material first so the claim cannot
 * prime the read. */
export function buildWitnessMessages(sentence, slice) {
  // "PASSAGE", not "TEXT" — checked against the-fold's own Gary archon
  // (gary.js, P55: model-facing text never names this instrument's own
  // parts) 2026-09-16, the first time this prompt was ever run past it.
  // "passage" is a listed apparatus noun and fired every time; "text" is
  // not, and names the same thing with no change to what is asked.
  return [
    {
      role: "system",
      content:
        'You are checking one sentence against one piece of text. Answer yes only if the text itself says the sentence is true; answer no otherwise. In "because", copy the text\'s own words that decide your answer — exactly as written, not paraphrased.',
    },
    {
      role: "user",
      content: `Text:\n${slice}\n\nSentence: ${sentence}\n\nDoes the text say this sentence is true?`,
    },
  ];
}

/** Parse the witness's reply. Constrained decoding makes this trivial; the
 * scan tolerates a prose-mode model wrapping the object. Null on anything
 * that does not carry the closed-enum answer — a typed gap upstream, never
 * a guess. */
export function readTestimony(raw) {
  const s = String(raw ?? "");
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          const parsed = JSON.parse(s.slice(start, i + 1));
          if (parsed && ["yes", "no"].includes(parsed.answer) && typeof parsed.because === "string")
            return { answer: parsed.answer, because: parsed.because.trim() };
        } catch {
          // not the object — keep scanning
        }
        break;
      }
    }
  }
  return null;
}

/** The pointer check: every content word of the witness's decider must be
 * IN the slice it read — hasWord over the same fold snipClaim states claims
 * with. A universal quantifier, not a threshold (the snipClaim discipline):
 * a witness that cannot point at the bytes did not read them. */
export function becauseVerbatim(because, slice) {
  const b = String(because ?? "").trim();
  if (!b) return false;
  const folded = (t) => foldDiacritics(String(t)).toLowerCase().replace(/\s+/g, " ");
  return folded(slice).includes(folded(b));
}

export function becauseContained(because, slice) {
  const b = String(because ?? "").trim();
  if (!b) return false;
  if (becauseVerbatim(b, slice)) return true;
  const words = b.split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w));
  if (!words.length) return false;
  const sliceWords = wordSet(String(slice ?? ""));
  return words.every((w) => hasWord(sliceWords, w));
}

/** The word-bearing parts of a name, for containment walls. */
const nameParts = (n) => String(n ?? "").split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w));

/** The perturbation: swap a name the claim carries for a name the PAGE
 * carries that the claim does not — the sibling comes from the witness's
 * own universe, and it is chosen as the COMPETING FILLER of the claim's
 * own slot: among the page's candidate names, the one whose sentence
 * shares the most of the claim's non-name vocabulary. (The first cut took
 * the longest page name and drew "National League. The Pittsburgh
 * Pirates" — NAME_RUN_RE legally runs across a sentence boundary — so a
 * candidate carrying a sentence break is excluded, and length is only the
 * tiebreak.) Null when either side has no name to offer; the caller ships
 * testimony unarmed and says so. */
export function siblingSwap(sentence, slice, { hint = "" } = {}) {
  const sent = String(sentence ?? "");
  const claimNames = namesIn(sent);
  if (!claimNames.length) return null;
  const from = [...claimNames].sort((a, b) => b.length - a.length)[0];
  const foldedSent = foldDiacritics(sent).toLowerCase();
  // A "name" spanning a raw newline is table/infobox cells glued together
  // by plain-text extraction ("Other\nUndecided\nMargin", "Vice President
  // John Adams\nPreceded") — never a real name; \s in NAME_RUN_RE matches
  // newlines too, and a period already excludes the sentence-spanning case
  // for the same reason. Measured live, same batch eval as CAPTION_MARKERS.
  //
  // BUT the period exclusion above throws the whole run away, and
  // NAME_RUN_RE's own abbreviation allowance (a period is a legal mid-word
  // character, for "St. Louis") means the run crossing INTO the next
  // sentence swallows whatever real name sat right before the break —
  // found live (task_414e664d): "Thomas Reeve" only ever occurs at the very
  // end of its own sentence ("...by the engineer Thomas Reeve. It stands
  // 42 meters..."), so `namesIn` hands back "Thomas Reeve. It" as one run,
  // the exclusion above correctly refuses THAT string, and the one real
  // candidate this slice had to offer vanished with it — `siblingSwap`
  // returned null, an unarmed but otherwise CORRECT witness ("yes", because
  // quoting the source verbatim) was refused, and the sentence fell all the
  // way to "named, not placed" for want of a sibling that was sitting right
  // there. The portion before the break is recovered as its own candidate
  // when it is STILL a real multi-word capitalized run on its own — never a
  // single leftover word or bare initial, which is what keeps "St. Louis"
  // untouched (its own pre-break portion is the one word "St").
  const splitAtSentenceBreak = (n) => {
    const cut = n.search(/[.!?\n]\s/);
    if (cut < 0) return [n];
    const head = n.slice(0, cut).trim();
    return /^\p{Lu}[\p{L}\p{N}_'-]*(?:\s+\p{Lu}[\p{L}\p{N}_'-]*)+$/u.test(head) ? [n, head] : [n];
  };
  const candidates = namesIn(String(slice ?? "")).flatMap(splitAtSentenceBreak).filter(
    (n) => !/[.!?\n]\s?/.test(n) && !foldedSent.includes(foldDiacritics(n).toLowerCase()),
  );
  if (!candidates.length) return null;
  // DISCLOSED, NEVER HIDDEN (P66): how many DISTINCT sibling names this
  // slice actually offered to swap in, folded so the same name repeated
  // (e.g. mentioned twice) counts once. Zero is already handled above
  // (return null — "a page with no sibling to swap cannot be armed",
  // this file's own header). One is a real but DEGENERATE arm: the swap
  // still runs (an otherwise-grounded base reading should still ship, the
  // same precedent the zero-candidate case already sets), but with no
  // second name on the page, the swap's difficulty is an accident of what
  // the page happens to mention rather than a chosen, plausible confusion
  // — measured live: a lone incidental name can force a trivially-easy,
  // grammatically-absurd substitution ("born in Jesse Root, Ohio", a
  // person's name in a place slot) that any witness rejects regardless of
  // real discrimination ability. `competitors` lets a caller tell that
  // case apart from a genuinely competitive (2+) arm instead of seeing a
  // byte-identical shape for both.
  const competitors = new Set(candidates.map((c) => foldDiacritics(c).toLowerCase())).size;
  // The witness's own stated reason, when offered, is tried FIRST — not
  // trusted on its own word (the arm re-checks it exactly as it checks
  // everything else), but a name the witness already noticed is worth
  // trying before a name independently re-derived with no access to what
  // it saw. Measured live 2026-08-19: asked about the 1960 World Series,
  // `real.because` already read "the Pittsburgh Pirates were matched
  // against the New York Yankees... and the Pirates won" — the correct
  // answer, verbatim, sitting unused while the slot-scoring heuristic
  // below picked "Major League Baseball" instead. Still walled: the hinted
  // name must be a real, ALREADY-FILTERED candidate in this slice (never
  // taken from the hint text directly), so a model's own hallucinated
  // reasoning cannot become an ungrounded swap.
  if (hint) {
    const foldedCandidates = new Map(candidates.map((c) => [foldDiacritics(c).toLowerCase(), c]));
    // Same recovery as the slice candidates above, applied to the hint's own
    // names too — found live one level up from the original specimen: a
    // witness model that echoes back a much LARGER span than the one
    // sentence it was asked about (`real.because` carrying most of the
    // passage, not a single quoted line — a separate, real small-model
    // weakness, not something this organ can fix) hands `hint` the SAME
    // sentence-crossing run ("Thomas Reeve. It"), so the hint search never
    // saw the one candidate this fix just made real — it fell through to
    // "LED" (an ACRONYM_RE match untouched by the gluing bug, and a poor,
    // grammatically mismatched sibling for a place name) purely because
    // nothing else in the hint's own name list was still intact.
    for (const hn of namesIn(String(hint)).flatMap(splitAtSentenceBreak).sort((a, b) => b.length - a.length)) {
      const key = foldDiacritics(hn).toLowerCase();
      if (!foldedCandidates.has(key)) continue;
      const to = foldedCandidates.get(key);
      const at = sent.indexOf(from);
      if (at < 0) return null;
      return { swapped: sent.slice(0, at) + to + sent.slice(at + from.length), from, to, hinted: true, competitors };
    }
  }
  // The claim's slot vocabulary: its words outside the swapped name, minus
  // the closed stopword class (the same CLAIM_STOPWORDS proof.js/cite.js
  // already use) — unfiltered, "the"/"of"/"a" matched almost every
  // candidate's sentence equally, diluting the one signal that should
  // actually separate a real answer from noise.
  const fromParts = new Set(nameParts(from).map((w) => w.toLowerCase()));
  const slotWords = sent
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w))
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((w) => w && !fromParts.has(w.toLowerCase()) && !CLAIM_STOPWORDS.has(w.toLowerCase()));
  const sentences = splitSentences(String(slice ?? "")).filter((s) => !CAPTION_MARKERS.test(s.text));
  const scoreOf = (name) => {
    const parts = nameParts(name);
    let best = 0;
    for (const s of sentences) {
      const ws = wordSet(s.text);
      if (!parts.every((p) => hasWord(ws, p))) continue;
      best = Math.max(best, slotWords.filter((t) => hasWord(ws, t)).length);
    }
    return best;
  };
  const scored = candidates.map((n) => ({ n, score: scoreOf(n) })).sort((a, b) => b.score - a.score || b.n.length - a.n.length);
  // A candidate that scored 0 everywhere is not a competing filler — it is
  // just some other name that happens to be on the page. Ties at 0 used to
  // be broken by raw length, which handed the longest piece of furniture
  // that survived filtering a win by default; zero evidence is zero
  // evidence, not a fallback to guess from.
  if (!scored[0].score) return null;
  const to = scored[0].n;
  const at = sent.indexOf(from);
  if (at < 0) return null;
  return { swapped: sent.slice(0, at) + to + sent.slice(at + from.length), from, to, competitors };
}

/** The decider, located in the source's own bytes (quotes.js's posture: a
 * drifted quote is rewritten to the source, never shipped as the model's
 * paraphrase): the slice's first sentence carrying ALL parts of the
 * sentence's most specific name and at least one of its other words — the
 * name alone could sit in an unrelated sentence; one slot word ties it to
 * the slot (a structural minimum, binding.js's own kind of floor). Null
 * when no sentence qualifies. */
export function locateDecider(sentence, slice) {
  const name = namesIn(String(sentence ?? "")).sort((a, b) => b.length - a.length)[0] ?? null;
  if (!name) return null;
  const parts = nameParts(name);
  const partSet = new Set(parts.map((w) => w.toLowerCase()));
  const rest = String(sentence)
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w) && !partSet.has(w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "")));
  // The MOST deciding sentence, not the first qualifying one — measured
  // live: document order handed back "the Series was played between X and
  // Y" when "Y defeated X to win it" sat one sentence later; both carry the
  // name, the second carries the slot. Ties keep document order.
  let best = null;
  let bestScore = 0;
  for (const s of splitSentences(String(slice ?? ""))) {
    const ws = wordSet(s.text);
    if (!parts.every((p) => hasWord(ws, p))) continue;
    const score = rest.filter((t) => hasWord(ws, t)).length;
    if (score > bestScore) {
      best = s.text.trim();
      bestScore = score;
    }
  }
  return best;
}

/**
 * Compose the two binary reads into one typed testimony — or a typed
 * refusal. THE VERDICT IS DERIVED, NEVER ASKED: claim-yes with the sibling
 * refused is "states"; claim-no with the sibling AFFIRMED is "contradicts"
 * — the page seats the swapped referent in the claim's own slot, which is
 * the slot-competition reading the hypergraph cannot reach mechanically.
 * Both-yes is a witness agreeing with everything — insensitive, refused.
 * Both-no (or claim-no with nothing to swap) is a page that states neither
 * — the ∅ count already says that; no testimony. Never a bare boolean:
 * what refused, and why, is the record's to keep.
 */
export function foldTestimony({
  real,
  arm = null,
  armed = false,
  host = null,
  url = null,
  slice = "",
  claim = "",
  swapped = "",
  // DISCLOSED, NEVER SILENT (P66): the distinct sibling-candidate count
  // that produced `swapped`/`arm`, when the caller has one (siblingSwap's
  // own `competitors` field, or the select protocol's equivalent). Left
  // `null` by every caller that does not pass it, so the field is omitted
  // from the return and existing callers see byte-identical output — this
  // never changes whether a verdict lands, only what it discloses about
  // how competitive the arm actually was.
  competitors = null,
}) {
  if (!real) return { refused: "unreadable", host, url };
  // The decider shown to the reader is the SOURCE'S own sentence when one
  // is locatable (quotes.js's posture — measured live: the arm's `because`
  // echoed the swapped sentence's inflection, "won" where the page writes
  // "win", and honest testimony was refused as uncontained). The model's
  // `because` is the fallback, and it must pass the containment wall.
  // Preference order, measured: (1) the witness's own pointer when it is
  // VERBATIM in the bytes — it just passed the strongest wall, and live it
  // picked the decisive sentence where slot-coverage scoring tied on a
  // weaker one; (2) the located source sentence when the pointer drifted;
  // (3) a word-level-contained pointer; else refuse.
  const deciderFor = (sentence, because) =>
    becauseVerbatim(because, slice)
      ? because
      : locateDecider(sentence, slice) ?? (becauseContained(because, slice) ? because : null);
  if (real.answer === "yes") {
    if (armed && arm?.answer === "yes") return { refused: "insensitive", host, url };
    const decider = deciderFor(claim, real.because);
    if (!decider) return { refused: "uncontained", host, url, because: real.because };
    const states = { verdict: "states", because: decider, host, url, armed: Boolean(armed && arm) };
    return competitors == null ? states : { ...states, competitors };
  }
  // real.answer === "no" — a contradiction is only ever derived from the
  // page AFFIRMING the sibling in the same slot; "no" alone is silence.
  if (armed && arm?.answer === "yes") {
    const decider = deciderFor(swapped, arm.because);
    if (!decider) return { refused: "uncontained", host, url, because: arm.because };
    const contradicts = { verdict: "contradicts", because: decider, host, url, armed: true };
    return competitors == null ? contradicts : { ...contradicts, competitors };
  }
  return { refused: "no-testimony", host, url };
}

// ── the SELECT protocol: activate, then point — never generate ──────────
//
// The generate protocol (buildWitnessMessages + siblingSwap + foldTestimony
// above) asks the model to WRITE a `because`, and a small model wanders
// there: measured live against the real War and Peace, gemma2:2b echoed the
// CLAIM back as its own because rather than quoting the novel, and the
// containment wall correctly refused the unquoted vote — a true fact lost
// to the task shape, not to the model's judgment (it had answered "yes"
// correctly).
//
// The fix is eoreader's posture everywhere else: the model slot-fills, the
// mechanism constrains. Feed it ACTIVATION — the real sentences where both
// ends already fire, pre-segmented — and have it SELECT one by index. The
// decider is then a real source sentence BY CONSTRUCTION: the echo failure
// mode cannot occur, because the model never writes a because, it points at
// one. User's own steer (2026-09-01): "small model should be fed with
// relevant activation, no?"
//
// Measured live, gemma2:2b, against the real novel, before shipping:
//   positive (real claim, real co-present set) -> selects a real sentence
//   control A (fabricated relation over a real co-present set) -> refuses
//   control B (true-ish claim, all-decoy set)  -> refuses
// Both controls built to fail; both held. This is a SIBLING protocol, not
// a replacement — the generate protocol stays for callers who have a slice
// but no segmenter, and foldTestimony still governs the generate path.

export const SELECT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    stated: { type: "string", enum: ["yes", "no"] },
    sentence: { type: "integer" }, // 1-based index into the candidate list, or 0 for none
  },
  required: ["stated", "sentence"],
});

/** The one message shape the select protocol uses — candidates numbered from 1. */
export function buildSelectMessages(claim, candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${String(c).replace(/\s+/g, " ").trim()}`).join("\n");
  return [
    {
      role: "system",
      content:
        "You are given a claim and a numbered list of sentences from a source. " +
        "Decide whether ANY sentence states the claim is true. If yes, give the NUMBER " +
        "of the single sentence that most directly states it. If no sentence states it, " +
        "answer stated:no and sentence:0. Do not invent; only choose from the list.",
    },
    { role: "user", content: `Claim: "${String(claim ?? "")}"\n\nSentences:\n${list}` },
  ];
}

/**
 * foldSelect(raw, candidates) — the verdict, DERIVED from the model's index,
 * never trusting the index blind. A pick outside [1, n] or a stated:yes with
 * no valid index is refused; a valid pick returns the candidate VERBATIM as
 * the decider (containment is guaranteed, not checked, because the decider
 * IS a candidate). `candidates` is the exact list buildSelectMessages was
 * given, so index k names candidates[k-1].
 */
export function foldSelect(raw, candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  let parsed = raw;
  if (typeof raw === "string") { try { parsed = JSON.parse(raw); } catch { return { refused: "unreadable" }; } }
  if (!parsed || typeof parsed !== "object") return { refused: "unreadable" };
  // A "no" that POINTS is not a no. The protocol pairs stated:no with
  // sentence:0 (buildSelectMessages says so), exactly as it pairs stated:yes
  // with a valid index — and a yes with no valid index was already a
  // non-verdict (`no-valid-pick`, below). The mirror case was read as a
  // refusal, which paints "no passage states this" on the answer. Measured
  // 2026-09-16: OLMo-2-1B answered {"stated":"no","sentence":1} pointing at
  // "A later county pamphlet stated that Ulysses S. Grant was born in
  // Georgetown, Kentucky." for the answer sentence "There is an additional
  // source which suggests Grant was also born in Georgetown, Kentucky.", and
  // on the select calibration 2 of 9 claim asks in each arm had this shape. A
  // self-contradicting answer is typed `incoherent`: no verdict either way.
  if (parsed.stated !== "yes") {
    const pointed = Number(parsed.sentence);
    if (parsed.stated === "no" && Number.isFinite(pointed) && pointed !== 0) return { refused: "incoherent" };
    return { refused: "no-testimony" };
  }
  const idx = Number(parsed.sentence);
  if (!Number.isInteger(idx) || idx < 1 || idx > list.length) return { refused: "no-valid-pick" };
  const decider = String(list[idx - 1]).replace(/\s+/g, " ").trim();
  return { verdict: "states", because: decider, index: idx };
}
