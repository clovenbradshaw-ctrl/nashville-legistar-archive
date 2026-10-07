// cite.js — attaching addresses without asking for them.
//
// The model was told to write `[source#start-end]` after any claim it took
// from the material. Two models four times apart in size both ignored that on
// tabular material — zero addresses across six turns — so every record read
// "material retrieved but uncited" and nothing was warranted. The instruction
// is the weak link, and an instruction is the wrong tool: the app already
// knows which passages it handed over and what the answer says. The address
// can be attached rather than requested.
//
// What that must not become is decoration. A sentence that happens to share
// the word "search" with a passage has not been sourced by it, and stamping an
// address on it would manufacture exactly the false warrant the rest of this
// design exists to refuse. So attribution is measured against a null built
// from the same corpus: a sentence is attributed to a passage only when its
// overlap with that passage beats the best overlap the same sentence gets
// against material the turn never touched.
//
// Two exports carry two different duties (measured 2026-08-17: an answer of
// three sentences, every one standing on the material, shipped with a bare
// middle sentence — the reader asked "how did it know all this?", and the
// classification had typed a supported sentence as the model's own voice):
//
//   `attribute` — the RECORD's discipline, unchanged: an address is earned
//   only by beating the null with a margin, because a record's refs are the
//   claim "this passage, and no other, sourced this sentence".
//
//   `coverage` — the RENDERING's discipline: every sentence the material
//   actually SUPPORTS wears the address of its best-supporting passage. The
//   rule is structural, not confidence-gated — containment (the passage holds
//   the sentence's phrase, and every name the sentence commits to) places the
//   argmax passage from the whole pool, with no margin to clear. A sentence
//   the material does not support still gets nothing: rescue, never invention.
//
// Pure: no DOM, no IO, no model.

import { foldDiacritics, retrieve, tokenize } from "./source.js";
import { ABBREV } from "./grounding.js";

/**
 * Sentence-ish. Splits on terminal punctuation and on newlines, because a
 * model writing a list puts one claim per line and never a full stop.
 *
 * The period-boundary half shares grounding.js's own `ABBREV` guard, not a
 * second copy of it. Before this, "U.S." (or "Mr.", "Jan.", any single
 * capital letter or the closed abbreviation list) split a sentence in two
 * wherever it appeared. Measured live 2026-08-19: a model's narration
 * sentence — "This passage details the political life of Hannibal Hamlin,
 * focusing on his service in the U.S. Senate, his position as vice
 * president..." — broke at "U.S.", and provenance.js's narration-stripper
 * (which classifies and cuts whole SENTENCES from this splitter) correctly
 * matched and removed the FRONT half ("This passage details...") as
 * narration while the BACK half ("Senate, his position as vice president
 * under President Lincoln...") shipped as an orphaned, ungrammatical
 * fragment — the same sentence, torn in half by a splitter that did not
 * know "U.S." was one word. grounding.js's splitSentences already carried
 * this guard (built for its own atom/number-company checking); this is the
 * same fix, reused rather than reinvented, kept behind cite.js's own
 * newline-per-claim splitting and address-rejoining, both unchanged.
 */
export function splitSentences(text) {
  const src = String(text ?? "");
  const pieces = [];
  let start = 0;
  const re = /(?<=[.!?])\s+|\n+/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const piece = src.slice(start, m.index);
    // A newline boundary is unconditional (list items, one claim per line);
    // only a period/!/? boundary can be an abbreviation in disguise.
    const boundaryIsSentencePunct = /[.!?]$/.test(src.slice(0, m.index));
    if (boundaryIsSentencePunct && ABBREV.test(piece.trimEnd())) continue;
    const trimmed = piece.trim();
    if (trimmed) pieces.push(trimmed);
    start = m.index + m[0].length;
  }
  const tail = src.slice(start).trim();
  if (tail) pieces.push(tail);
  // An address written after the full stop still belongs to the sentence it
  // follows. Observed live: a model ended with "...per decade. [kess#80-174]",
  // the address split off as its own piece, the sentence before it looked
  // uncited, and attribution attached a second tag saying the same thing.
  const out = [];
  for (const piece of pieces) {
    if (out.length && /^\[[^\]\s]+#\d+-\d+\]/.test(piece)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

/**
 * The longest run of terms the sentence and the passage share in order.
 *
 * Shared *words* are the wrong signal: a sentence and a passage both about
 * searches both contain "search", and counting that as evidence would stamp an
 * address on a coincidence. A shared run of consecutive terms is a phrase, and
 * a phrase is the smallest thing that can be said to have come from somewhere.
 *
 * A run of one is a word, not a phrase — that is what the word means, not a
 * tuned cutoff — so `MIN_RUN` is 2, and the null still has to be beaten on top
 * of it.
 */
export const MIN_RUN = 2;

/**
 * Tokens that appear in most of the corpus, which therefore cannot tell you
 * which passage a claim came from.
 *
 * Measured, not listed. On prose this catches almost nothing. On a spreadsheet
 * it catches the format — the agency name repeated on every row, the word
 * "lookup", the shape of a timestamp — and that matters, because rows are
 * mostly boilerplate and a run of shared boilerplate is not a quotation.
 *
 * The cutoff is "present more often than absent". That is not a tuned knob: a
 * term in more than half the passages is, on balance, telling you about the
 * corpus rather than about a passage.
 */
/** Below this, a frequency is not a frequency and nothing counts as common. */
export const CORPUS_MINIMUM = 10;

export function commonTerms(pool) {
  if (pool.length < CORPUS_MINIMUM) return new Set();
  const df = new Map();
  for (const c of pool) for (const t of c.terms) df.set(t, (df.get(t) ?? 0) + 1);
  const cut = pool.length / 2;
  const common = new Set();
  for (const [t, n] of df) if (n > cut) common.add(t);
  return common;
}

export function overlap(sentenceTerms, chunk, common) {
  const a = common?.size ? sentenceTerms.filter((t) => !common.has(t)) : sentenceTerms;
  // Ordered, with duplicates — the Set on a chunk has neither, and a run
  // needs the sequence the words actually appear in.
  const all = chunk.termList ?? (chunk.termList = tokenize(chunk.text));
  const b = common?.size ? all.filter((t) => !common.has(t)) : all;
  // Standard longest-common-substring DP over token arrays, one row at a time.
  let prev = new Uint16Array(b.length + 1);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

/**
 * The null: the best score this sentence gets from a passage the turn did not
 * offer it.
 *
 * The first version of this strided the corpus at random, and it was the wrong
 * comparison. Measured on 16MB of search records, a row scored against its own
 * immediate neighbours was falsely warranted 35% of the time: adjacent rows
 * share dates, formats and repeated values, so both the score and the random
 * null were large and the margin between them survived.
 *
 * The question is not "does this passage beat an unrelated one" — nearly
 * anything does. It is "does this passage beat the best *other* passage in the
 * corpus", and answering it means looking where a competitor would actually
 * be. So the null is drawn by retrieval on the sentence itself: the hardest
 * available comparison rather than an easy one. When the true source is not
 * among the offered passages it turns up here instead, outscores them, and the
 * claim is refused — which is the behaviour that was missing.
 *
 * Returns who won as well as by how much. `attribute` reads only the score —
 * for it the rival is a floor to clear — but `coverage` needs the winner
 * itself: a rival that outscores every offered passage is not noise, it is
 * the pool's own best-supporting passage, and its address is the honest one.
 */
function bestRival(sentence, sentenceTerms, pool, offered, samples, common) {
  const skip = new Set(offered.map((c) => c.ref));
  const rivals = retrieve(pool, sentence, samples).filter((c) => !skip.has(c.ref));
  let chunk = null;
  let score = 0;
  let next = 0;
  for (const c of rivals) {
    const s = overlap(sentenceTerms, c, common);
    if (s > score) {
      next = score;
      score = s;
      chunk = c;
    } else if (s > next) {
      next = s;
    }
  }
  // `next` is the runner-up's score — what `coverage` reads to know whether
  // the winner is a unique argmax or one of several equal claimants.
  return { chunk, score, next };
}

export const NULL_SAMPLES = 12;

/**
 * An address shape a model's own output could contain, in the form
 * source.js emits — used ONLY by `stripSelfCitations` below, never as a
 * reason to trust or skip measuring a sentence (see that function's own
 * header for why the trust half of this was removed, 2026-08-18).
 */
const ALREADY_CITED = /\[[^\]\s]+#\d+-\d+\]/;

/**
 * A bracketed address in the model's OWN output, mechanically neutralized
 * before anything downstream sees it — never measured as a hint, never
 * rendered as a working link. Requirement, stated directly (user,
 * 2026-08-18): the model must have zero ability to produce text a reader
 * could mistake for this instrument's own citation. `buildSourceBlock`
 * (source.js) no longer shows the model an address or asks it to cite
 * anything, so a match here can only be a coincidence — the model's own
 * training habit surfacing unprompted, or text quoted verbatim from
 * retrieved material that happens to carry bracket-style notation of its
 * own. Either way it is not a real address into THIS turn's material, and
 * the discipline is the one P20 already uses for an unresolved link: never
 * silently left in place, never re-asked of the model to fix, replaced
 * with a NAMED marker so a reader sees a scrub happened rather than a
 * plausible-looking citation that was never checked.
 */
export function stripSelfCitations(text) {
  const s = String(text ?? "");
  let removed = 0;
  const out = s.replace(new RegExp(ALREADY_CITED.source, "g"), () => {
    removed++;
    return "[citation removed — not issued by this instrument]";
  });
  return { text: out, removed };
}

/**
 * The alphabet these patterns read is the whole one, not ASCII.
 *
 * The first version wrote `[A-Z]` and `\w` with no /u flag, and JS means
 * exactly [A-Za-z0-9_] by both. On a corpus that writes Pávlovna, Bezúkhov
 * and Hélène that is not a small inaccuracy, it is the veto switching off:
 * "Anna Pávlovna" extracted as "Anna P" (the name broke at the accent) and
 * "Éloise Dupré" extracted as nothing at all, because É is not [A-Z] and
 * "Dupré" alone cannot make the required run of two. A sentence attributing
 * a real phrase to an INVENTED accented subject then took the address the
 * identical ASCII sentence is refused — the exact false warrant the veto
 * below exists to prevent, resurrected for every non-ASCII name.
 *
 * The fold at the comparison site cannot rescue this: `namesSupported` folds
 * both sides, but it folds what extraction handed it, and extraction had
 * already dropped the name. Reading the right alphabet has to happen here.
 *
 * So: `\p{Lu}` for a capital and `[\p{L}\p{N}_]` for a word character, under
 * /u — the same character classes `grounding.js::PROPER_RE` already uses, so
 * the two organs agree about what a name is. `\b` cannot come along: it is
 * defined on ASCII \w even under /u, so `\bÉ` never matches. Its two duties
 * are carried explicitly instead — a lookbehind so a capital inside a word
 * does not start a name ("iPhone Pro" is still not a name), and a lookbehind
 * on the end so a run never closes on the "." or "'" the class carries
 * inside it ("MNPD BOLO." still yields "MNPD BOLO").
 *
 * Differential against the old patterns over War and Peace: identical on all
 * 30,502 ASCII-only lines, and 1,994 accented lines where a name that had
 * been truncated or lost now arrives whole.
 */
const NAME_RUN_RE =
  /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}_.'-]*(?:\s+\p{Lu}[\p{L}\p{N}_.'-]*)+)(?<=[\p{L}\p{N}_])/gu;
const ACRONYM_RE = /(?<![\p{L}\p{N}_])(\p{Lu}{2,})(?![\p{L}\p{N}_])/gu;

/**
 * The names a sentence commits to: runs of two or more capitalised words, and
 * bare acronyms. "Kansas Highway Patrol", "Bryan TX PD", "MNPD", "TBI".
 *
 * A single leading capital is not a name — every sentence starts with one —
 * so a run of two is the smallest thing that can be one, the same reasoning
 * that makes MIN_RUN 2.
 */
export function namesIn(text) {
  const s = String(text ?? "");
  const names = new Set();
  for (const m of s.matchAll(NAME_RUN_RE)) names.add(m[1]);
  for (const m of s.matchAll(ACRONYM_RE)) names.add(m[1]);
  return [...names];
}

/**
 * Every name the sentence uses has to appear in the passage.
 *
 * This is the rule that stops a shared phrase from warranting a claim the
 * passage does not make. Observed live: a model wrote "Bryan TX PD: the reason
 * was MNPD BOLO", and the phrase "MNPD BOLO" really was in the material — in
 * Hendersonville TN PD's row. Bryan TX PD had run no searches at all. The
 * phrase matched, the subject was invented, and an address on that sentence
 * would have been a warrant for a thing that never happened.
 */
function namesSupported(text, chunk) {
  // Folded on both sides — the veto must not refuse "Helene" against a
  // passage that writes "Hélène" (measured live on War and Peace; same fold
  // retrieval already applies).
  const hay = foldDiacritics(chunk.text.toLowerCase());
  return namesIn(text).every((n) => {
    // A multi-word name counts as present if its distinctive parts are — the
    // material writes "Kansas Highway Patrol", a sentence may write "the
    // Kansas Highway Patrol's search" — but every part must be there.
    const parts = foldDiacritics(n.toLowerCase()).split(/\s+/).filter((p) => p.length > 1);
    return parts.every((p) => hay.includes(p));
  });
}

/**
 * Attribute each sentence of an answer to one of the passages the turn was
 * given, or to nothing.
 *
 * Returns one entry per sentence: `{text, ref, score, floor}`. `ref` is null
 * when the sentence's best offered passage did not beat the null — which is
 * the common case for a sentence that summarizes, hedges, or answers from the
 * model's own knowledge, and those should not carry an address.
 */
export function attribute(answer, offered, pool = [], { samples = NULL_SAMPLES } = {}) {
  if (!offered?.length) return [];
  // What the corpus says everywhere cannot say where anything came from.
  const common = commonTerms(pool.length ? pool : offered);
  return splitSentences(answer).map((text) => {
    // EVERY sentence is measured, unconditionally — no bracket in the
    // model's own text short-circuits this anymore (removed 2026-08-18).
    // The old rule deferred to a sentence that "already carries an
    // address," trusting the model's OWN claim about which passage backs
    // it rather than measuring the claim itself — exactly the compliance-
    // critical self-report L5 exists to distrust everywhere else. Since
    // the model is no longer shown an address or asked to cite one
    // (source.js::buildSourceBlock), a bracket surviving into its output
    // is never a real reference to defer to; `stripSelfCitations` removes
    // any such text from what ships, and this function never treats its
    // presence as evidence either way.
    const terms = tokenize(text);
    let ref = null;
    let score = 0;
    let best = null;
    for (const c of offered) {
      const s = overlap(terms, c, common);
      if (s > score) {
        score = s;
        ref = c.ref;
        best = c;
      }
    }
    // The names check vetoes the winner; it does not choose one.
    //
    // As a filter it inverted a live attribution: a claim about a figure was
    // attached to the paragraph naming the report rather than the paragraph
    // stating the figure, because only the first said "Kessington" — the
    // second says "The report". Screening candidates by name let a passage
    // that merely mentions the subject beat the one the claim came from.
    // Judging by evidence and then refusing on a name mismatch cannot do
    // that: the worst it does is decline.
    if (best && !namesSupported(text, best)) return { text, ref: null, score, floor: 0, vetoed: true };
    // The floor this sentence has to clear is the best score the same words
    // get from material the turn never saw. Beating it means the passage
    // carried something the corpus at large does not.
    const floor = bestRival(text, terms, pool.length ? pool : offered, offered, samples, common).score;
    // Both tests: a phrase rather than a word, and better than the corpus
    // at large gives the same words for free.
    const attributed = score >= MIN_RUN && score > floor;
    return { text, ref: attributed ? ref : null, score, floor };
  });
}

/**
 * Coverage: every sentence the material supports wears the address of its
 * best-supporting passage. Same entry shape as `attribute`, so everything
 * that consumes attributions (classifySentences, attributedRefs, the
 * renderer) takes these unchanged; attachments additionally carry
 * `via: "offered" | "pool"` — which side of the turn's evidence the winner
 * came from — and `rescued: true` on every attachment the strict gate in
 * `attribute` would have declined.
 *
 * Why `attribute` alone was not enough, measured 2026-08-17 on a fetched
 * Wikipedia page (saved by the web organ, opened as an ordinary source): an
 * answer's opening sentence stood squarely on the page — the page's own lead
 * states the date and the place — but the lead was not among the passages
 * retrieved for the turn, so the null found it, outscored the offered
 * passages 6 to 2, and the sentence was REFUSED an address. Typed as model
 * voice, it rendered as knowledge from nowhere, and the reader asked "how
 * did it know all this?". The null did its job — the offered passages did
 * not source that sentence — and the conclusion drawn from it was wrong: the
 * rival that outscored them is not "material the turn never touched", it is
 * the pool's own best-supporting passage. Refusing the chip threw away the
 * address the null had just found.
 *
 * So coverage asks the structural question — WHERE does the material state
 * this sentence's words? — and answers by argmax and containment, with no
 * margin to clear anywhere:
 *
 *   - The winner is the best-overlap passage across the whole pool: the
 *     offered passages and the retrieval-drawn rivals, compared by the same
 *     `overlap` on the same fold. A tie goes to the offered side — when two
 *     passages state the phrase equally well, the one the turn actually
 *     handed the model is the likelier source, and the chip's claim ("these
 *     bytes state this") holds either way.
 *   - A pool-side winner must be a UNIQUE argmax. An address names one
 *     place, and an argmax with two winners names none. The rival draw is
 *     ordered by retrieval — the sentence's terms, not the passages'
 *     support — so between two rivals tied on overlap, rank would pick
 *     arbitrarily, and an arbitrary address is a misdirection wearing a
 *     warrant. A phrase the pool states in several places equally is
 *     ambient, not located, and the entry is typed `ambiguous` rather
 *     than guessed — the same discipline P14 pins for skill dispatch (a
 *     tie is refused as ambiguous, never guessed). The offered side keeps
 *     its tie privilege because it has what a rival lacks: the model
 *     actually read those bytes.
 *   - A run of one is a word, not a phrase: `MIN_RUN` stands exactly as in
 *     `attribute`. A sentence sharing no phrase with any passage has nothing
 *     to stand on, and attaching anything to it would be the invention this
 *     function exists to refuse. That is what keeps a model-voice sentence
 *     bare: a hedge, a summary, connective tissue shares words at most.
 *   - The names veto stands exactly as in `attribute`, applied to the one
 *     winner, never used to choose one: a sentence committing to a subject
 *     the winning passage does not hold gets nothing, because an address on
 *     an invented subject is the worse lie — a chip vouching for a thing
 *     that never happened.
 *
 * Residues, stated rather than papered over: a sentence rewritten so
 * thoroughly that it shares no two-term run with its source cannot be
 * attached — support that only a reader (or the atom/relation tiers) can
 * see is beyond a phrase-overlap organ, and such a sentence stays typed as
 * model voice rather than guessed at. When the winning passage fails the
 * names veto, a lesser passage holding both phrase and names may exist,
 * but coverage declines rather than walking down the ranking — choosing by
 * name is the inversion `attribute`'s veto comment records (a passage that
 * merely mentions the subject beating the one the claim came from). A
 * sentence refused as `ambiguous` may be genuinely supported — a phrase
 * the corpus states everywhere is if anything BETTER attested — but
 * multi-passage support is the atom tier's fact (`corroborateAtoms` counts
 * it as perspectives); one address for an everywhere-phrase would be false
 * precision. And a generic two-term run that happens to live in exactly
 * one pool passage still earns its chip — uniqueness is evidence of place,
 * not proof of distinctiveness; the chip's claim ("these bytes state this
 * phrase") stays true even when it is weak. The worst the declines do is
 * leave a chip off; none of them ever puts a false one on.
 */
export function coverage(answer, offered = [], pool = [], { samples = NULL_SAMPLES } = {}) {
  const corpus = pool.length ? pool : offered;
  if (!corpus.length) return [];
  const common = commonTerms(corpus);
  return splitSentences(answer).map((text) => {
    // Same removal, same reason as `attribute` (2026-08-18): no bracket in
    // the model's own text is trusted or skipped — every sentence is
    // measured on its own merit.
    const terms = tokenize(text);
    // The offered side's argmax — first maximum wins, `attribute`'s own rule.
    let offeredBest = null;
    let offeredScore = 0;
    for (const c of offered) {
      const s = overlap(terms, c, common);
      if (s > offeredScore) {
        offeredScore = s;
        offeredBest = c;
      }
    }
    // The pool side's argmax, drawn where a competitor would actually be —
    // the same draw the null uses, read for its winner rather than as a bar.
    const rival = bestRival(text, terms, corpus, offered, samples, common);
    const viaPool = rival.score > offeredScore;
    const winner = viaPool ? rival.chunk : offeredBest;
    const score = viaPool ? rival.score : offeredScore;
    const floor = viaPool ? offeredScore : rival.score;
    // A run of one is a word, not a phrase — nothing to stand on.
    if (!winner || score < MIN_RUN) return { text, ref: null, score, floor };
    // A pool-side winner that only tied its runner-up is no winner: the
    // phrase is in several places and the argmax names none of them.
    // Refused as ambiguous, never guessed.
    if (viaPool && rival.next >= rival.score) return { text, ref: null, score, floor, ambiguous: true };
    // The veto refuses the winner; it never chooses one.
    if (!namesSupported(text, winner)) return { text, ref: null, score, floor, vetoed: true };
    const entry = { text, ref: winner.ref, score, floor, via: viaPool ? "pool" : "offered" };
    // Marked wherever `attribute`'s stricter gate would have said nothing:
    // a pool-side winner, or an offered winner that only tied the null. The
    // renderer can say which kind of claim each chip is (a margin beaten,
    // or containment found), and the record can keep its own stricter set —
    // same evidence, two duties, both visible.
    if (viaPool || score <= floor) entry.rescued = true;
    return entry;
  });
}

/** The distinct addresses an attribution run actually attached. */
export function attributedRefs(entries) {
  return [...new Set(entries.filter((e) => e.ref).map((e) => e.ref))];
}
