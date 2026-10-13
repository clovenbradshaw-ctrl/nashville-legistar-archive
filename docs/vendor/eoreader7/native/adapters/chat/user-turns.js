// native/adapters/chat/user-turns.js — the chat medium's grammar: which of
// the person's turns is an ask, which an assertion, which a re-zero, under
// which mind, and how each lands as that mind's own held belief.
//
// THE S6 SPLIT, IN THE SAME SHAPE AS attribution.js FOR PROSE. The kernel
// (theory-of-mind.js) takes a holder as caller annotation and never asks how
// it was found. This file is the counterpart for the chat doorway: turning
// the conversation's own turns into perspective operations is this medium's
// business, exactly as quotation marks and speech verbs are prose's own
// grammar. The kernel never imports this file; the caller wires them.
//
// THE PERSON'S WORDS ARE THE PERSON'S CLAIMS — NEVER A PARAPHRASE, NEVER A
// READING. Attribution is mechanical; meaning is not. `userTurnOperation`
// lands the turn's own trimmed text as the claim the person holds (a person
// asserting "the council met Tuesday" holds exactly that), and returns a
// typed gap where there is nothing to claim. It does not extract, classify,
// or infer what the person MEANT — that is the reader's own model of the
// person, which the reader lands as its own reported beliefs (via [user]),
// and it is what theory-of-mind.js reads.
//
// A PERSON CAN BE OF MANY MINDS. The same person answers as an engineer one
// turn and as a citizen the next; two people may share one doorway. `mind`
// names the frame a turn was spoken under, and a turn spoken under a named
// mind lands on that mind's own holder (`holder:user:mind:<key>`), so the
// reader folds each mind separately and the parliament can adjudicate the
// person against themselves. A turn with no declared mind lands on the body
// — the undifferentiated remainder. The mind is DECLARED, never guessed:
// a caller that does not know which mind a turn belongs to says so by
// omitting `mind`, and the body is the honest answer.
//
// PRIORS INJECTED, NEVER OWNED (P3). Which token is first-person, which is
// an interrogative, which is a negation, which is a stopword — these are
// received closed classes and arrive as arguments with their givers named by
// the caller (adapters/text/priors.js). This file carries no lists.
//
// THREE KINDS, THREE CELLS. An ask distinguishes a gap (DEF · Lens); an
// assertion holds a claim (EVA · Lens); a re-zero refuses what was held
// (REC · Lens). The kind is decided by SHAPE, never by content: an
// interrogative opening or a trailing mark is an ask, anything else is an
// assertion — and a negation-led turn is a re-zero ONLY when it POINTS BACK
// at what was held (an anaphoric token like "that"/"it", or a first-person
// claim: "no, that's wrong" / "no, I disagree"). An acknowledgment that
// merely opens with "no" — "No problem, thanks!" — points at nothing the
// reading holds and is an assertion, never a refusal: a mechanical reader
// that lands gratitude as a denial has manufactured a belief. Shape is the
// only thing a mechanical read can stand on, and a shape it cannot decide
// is a typed gap.

import { STANCE } from "../../kernel/perspective.js";
import { userOperation } from "../../kernel/theory-of-mind.js";

// The chat medium's own tokenizer. Apostrophes stay INSIDE a word (so "don't",
// "that's", "you're" are single tokens the closed classes can name), and
// typographic quotes fold to the straight form. Splitting on apostrophes —
// what this did before 2026-10-09 — made every contracted entry in
// NEGATION_WORDS/ANAPHORIC_PRONOUNS unmatchable ("don't" became ["don","t"]),
// which is exactly how casual turns ("don't think thats right") lost their
// negation. `'s` is NOT stripped here: the classes name both "that" and
// "that's", so the surface the person actually typed is the one matched.
const tok = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);

/**
 * One user turn -> one held belief (or a typed gap).
 *
 * @param {string|{text:string}} turn
 * @param {object} opts
 *   index        the turn's ordinal — the witness address (`turn:<n>`), required
 *   mind         string|null — the frame this turn was spoken under; null lands on the body
 *   firstPerson  the received first-person class (a RegExp, priors.js's FIRST_PERSON)
 *   interrogatives Map<string,string>|null — priors.js's INTERROGATIVE_PRONOUNS (who->person, ...)
 *   negation     Set<string>|null — priors.js's NEGATION_WORDS
 *   anaphoric    Set<string>|null — priors.js's ANAPHORIC_PRONOUNS (it/this/that/... — the pointing-back class)
 *   stop         Set<string>|null — closed-class tokens that carry no claim (tokenize's own STOPWORDS)
 *   askMarks     RegExp|null — the script-neutral trailing ask-mark class
 *   discourseMarkers Set<string>|null — casual lead-ins (hmm, so, wait, ...) that
 *                do not change the turn's KIND and are skipped to find the head
 * @returns {{kind, claim, witness, op, mind, firstPerson}} or {gap:{type,detail}}
 */
export function userTurnOperation(turn, { index = null, mind = null, firstPerson = null, interrogatives = null, negation = null, anaphoric = null, stop = null, askMarks = null, discourseMarkers = null } = {}) {
  const raw = typeof turn === "string" ? turn : String(turn?.text ?? "");
  const trimmed = raw.trim();
  if (!trimmed) {
    return { gap: { type: "empty_turn", detail: "an empty turn holds nothing — nothing is claimed" } };
  }
  if (index == null) {
    return { gap: { type: "unaddressed_turn", detail: "a turn is claimed by its own words AND addressed by its own ordinal — a witness is required (P5.2)" } };
  }

  const lower = trimmed.toLowerCase();
  const tokens = tok(lower);
  const content = stop instanceof Set ? tokens.filter((t) => t.length > 1 && !stop.has(t)) : tokens.filter((t) => t.length > 1);
  if (!content.length) {
    return { gap: { type: "no_content", detail: "the turn carries no content token beyond closed classes — a greeting is a turn, never a held claim" } };
  }

  const witness = `turn:${index}`;
  const isFirstPerson = firstPerson instanceof RegExp && tokens.some((t) => firstPerson.test(t));

  // CASUAL LEAD-INS ARE NOT THE KIND. A turn opens with discourse markers as
  // often as with its subject — "wait what", "so basically X", "hmm idk". The
  // markers are a RECEIVED class (injected), and the head the shape is read
  // from is the first non-marker token. Bounded so a turn that is ALL markers
  // still reads from its first token rather than falling off the end.
  const markers = discourseMarkers instanceof Set ? discourseMarkers : null;
  let hi = 0;
  if (markers) while (hi < tokens.length - 1 && markers.has(tokens[hi])) hi += 1;
  const head = tokens[hi];

  // An ask is an interrogative SHAPE: a trailing mark, or an interrogative
  // opening. Shape, never a word list. `askMarks` is the script-neutral
  // trailing-mark class (turn-priors.js QUESTION_MARKS) when the caller
  // supplies one; the ASCII/fullwidth default stands otherwise. A rhetorical
  // denial ("why would I do that?") reads as an ask too — the shape is all a
  // mechanical read has, and the person's own words stay the claim either way
  // (S3 is the model's and the reader's, never this file's).
  const trailingAsk = askMarks instanceof RegExp ? askMarks.test(trimmed) : /[?？]$/.test(trimmed);
  const openingAsk = interrogatives instanceof Map && interrogatives.has(head);

  // A re-zero opens with a negation AND points back at what was held — an
  // anaphoric token or a first-person claim. "No problem, thanks!" opens
  // with "no" and points at nothing: an acknowledgment, never a refusal.
  const opensNegation = negation instanceof Set && negation.has(head);
  const pointsBack = (anaphoric instanceof Set && tokens.some((t) => anaphoric.has(t))) || isFirstPerson;
  const kind = opensNegation && pointsBack ? "correction" : trailingAsk || openingAsk ? "ask" : "assertion";

  const op = userOperation({
    claim: trimmed,
    question: kind === "ask",
    stance: kind === "correction" ? STANCE.REFUSES : STANCE.HOLDS,
    witness,
    mind,
  });

  return { kind, claim: trimmed, witness, op, mind: mind ?? null, firstPerson: isFirstPerson };
}

/**
 * Walk a conversation's user turns into a DeltaFold@1 log of the person's
 * held beliefs, one per mind. `mind` is a constant key or a function
 * (turn, index) -> key|null deciding which frame each turn was spoken under;
 * a turn with no mind lands on the body. Gaps are kept TYPED on `gaps` —
 * never silently dropped, and never guessed into a claim. `minds` counts
 * landed beliefs per mind holder, so the caller can build one for-whom per
 * mind and fold them apart. The result is ready for `projectPerspectives` /
 * `foldUniverseAt(userForWhom(...))` unchanged.
 */
export function turnsToUserLog(turns = [], opts = {}) {
  const operations = [];
  const gaps = [];
  const minds = {};
  turns.forEach((turn, i) => {
    const mindKey = typeof opts.mind === "function" ? opts.mind(turn, i) : (opts.mind ?? null);
    const out = userTurnOperation(turn, { ...opts, index: i, mind: mindKey ?? null });
    if (out.gap) gaps.push({ turnIndex: i, ...out.gap });
    else {
      operations.push(out.op);
      const key = out.mind ?? "body";
      minds[key] = (minds[key] ?? 0) + 1;
    }
  });
  return { schema: "DeltaFold@1", operations, gaps, minds };
}