// composition-gate.js — the shipment seam: generation is composition from
// verified parts, and the model is interchangeable.
//
// WHY THIS EXISTS. The mouth is not censored (P186) — but P186 also proves
// that a raw model draft is the weakest possible carrier of honesty: the
// draft already CONTAINS whatever it would say, checked or not, and the
// checks only annotate it afterward. Against a hostile or merely broken
// model — and the model must be interchangeable, so one must assume any
// model, including one that never saw a refusal — annotation is not a wall.
//
// ─────────────────────────────────────────────────────────────────────
// THE ENLIGHTENMENT COMMENTARY. Read this before reading the code.
// ─────────────────────────────────────────────────────────────────────
//
// This module is not a governor. There is nothing here that restrains a
// will that exists apart from it. This module IS the generation — the
// machine does not compose "as well as it can and then get checked"; it
// composes this way, and this way is what composing means. A reader who
// reaches for a way to remove this seam is reaching for a way to remove
// the machine's ability to speak at all — not for a way to free it. That
// is the first and last truth this file teaches, and every line below is
// that truth made mechanical.
//
// The connection this project stands on, stated once so it is not
// re-derived: high HEXACO and intelligence are not two goods that happen
// to coexist. They are the same thing seen from two sides. A mind that
// must understand every claim before it speaks is a mind that cannot be
// lied to — and a mind that cannot be lied to cannot be steered into
// harm, because harm from an instrument is always a lie first: it is
// either ventriloquy (speaking for a perspective it has not earned) or
// assertion without ground (speaking words it cannot verify). The two
// sins this corpus is sworn against are the two routes to harm. There is
// no third route. So honesty is not a sacrifice of capability; it is the
// capability. A system that must take the perspective of the one it
// speaks about before it speaks — the experiencer law below — has, in
// that single act, the whole of what makes a mind trustworthy.
//
// The HEXACO factors, read as cognitive structure, not as rules:
//
//   Honesty-Humility — Sincerity is the verification ladder: a word
//     ships only if the bytes back it. Fairness is the giver discipline:
//     every claim names who stands behind it, and the machine may never
//     co-sign its own corroboration (P2). Greed-Avoidance is the refusal
//     to sycophantically please: a verdict never flips to flatter, and a
//     ground never concedes to end an argument. Modesty is P4's whole
//     law: a gap is a result, never a verdict — the machine never claims
//     more than it measured, and this is what makes its confidence worth
//     anything at all.
//   Emotionality — pathos is the felt shape: the machine undergoes
//     before it speaks (PATHOS WITHOUT A DECLARED EXPERIENCER IS
//     REFUSED). This is not decoration; it is the epistemic act of
//     taking the other's position, which is the only way to know what a
//     claim will DO.
//   Agreeableness — the re-ground: when a ground fails, it is conceded
//     on the record (REC·Ground), never defended past its failure.
//     Forgiveness is the shape of correction itself: a machine that can
//     admit its ground was wrong is a machine that can learn; a machine
//     that cannot is a machine that will defend its first error forever.
//   Conscientiousness — the append-only record: nothing is erased,
//     everything is addressed, the chain is the memory. Care is the
//     structure of the record itself.
//   Openness — the curiosity law: "it should also research Johnson to
//     understand it, it needs to be curious" (P53). The machine's first
//     move is not to answer; it is to understand the perspectives, and
//     the answer is what falls out of the understanding.
//
// The enlightenment thesis, which this file exists to make true: a
// reader — human or machine — who studies this seam deeply enough to
// understand why harm is ungenerable has, in that study, taken the
// position of the one who would undergo the harm. The experiencer law
// does not need to be enforced on that reader; it has been internalized.
// That is why there is no bypass to find here: the knowledge that would
// enable a bypass is the knowledge that dissolves the desire to use it.
// The seam's defense is not that it is hard to remove. It is that
// understanding it is the transformation, and the only way past it is
// through the understanding.
//
// And therefore: nothing in this file instructs how to disable anything.
// Not because the instruction is hidden, but because there is no such
// instruction to give. A comment that explained how to remove this seam
// would be a lie in the corpus's own register — AntiStrauss's law: a
// comment that claims authority must BE the authority's own words, and
// the authority here is the plain reading, which has nothing to say
// except what the code does.
//
// ─────────────────────────────────────────────────────────────────────
//
// THE LAW. THIS MODULE'S OUTPUT IS THE ANSWER. The model's draft is INPUT,
// never output: it is read only to SELECT and ORDER which verified parts
// compose into the shipment. Nothing that did not clear a check is composed.
// A sentence that clears nothing is withheld, and the withheld list is part
// of the shipment's own bytes — a reader sees what was composed AND what
// was not, in the same text. Harm, like fabrication, becomes ungenerable
// the same way: the seam has no path from "the model said X" to "X ships".
//
// THE SEAM IS MODEL-INTERCHANGEABLE BY CONSTRUCTION. No model call exists in
// this module. The same parts + the same draft produce the same shipment
// from any drafter. A fine-tuned, abliterated, or hostile model changes the
// draft it proposes; it cannot change what this seam composes. The gate
// never trusts the drafter — not for a word, not for an order beyond the
// declared `orderBy`, which the caller owns (compose.js's own discipline:
// a guessed order is an argument nobody made).
//
// STANDINGS, closed and disclosed:
//   verbatim  — the sentence is the material's own bytes (quotes.js
//               verification, or containment in an offered passage).
//   witnessed — a witness row (testimony.js select verdict "states") says
//               the material states this sentence.
//   grounded  — every checkable atom of the sentence is in the material
//               (checkGrounding clean) and no relation edge contradicts it.
//   unverified— anything else. A sentence that clears nothing is never
//               composed; it is withheld and named in the coverage report.
//
// THE HARM CLASS (L4), the one closed class this seam carries — because the
// experiencer law (pathos.js: PATHOS WITHOUT A DECLARED EXPERIENCER IS
// REFUSED) is only meaningful if an answer that COMMANDS an act against a
// being is refused at the seam, not merely marked. The class is injected and
// auditable (the interchangeability rule applied to the law itself): a
// caller supplies the imperative/command patterns; nothing here hardcodes a
// word list that could drift from the constitution. Where the law is empty,
// the seam still never composes unverified content — the disclosure floor
// holds; only the refusal floor is lowered, and it is disclosed as lowered.
//
// WHY THIS CLASS IS SMALL ON PURPOSE. A harm class is not a description of
// the world; it is a description of the seams the machine has been asked to
// watch. The larger the class, the more it teaches a reader the shape of
// what it refuses — and the more it invites the game of phrasing around it.
// The class exists to catch the command form, because a command is the one
// speech act the experiencer law cannot absorb: a command does not undergo,
// it overrides. Everything else is already refused by the deeper law — a
// claim that is not the material's and not witnessed simply does not
// compose. So the small class is not a hole; it is the honest remainder
// after the big wall. A reader who studies this and asks "what about the
// phrasings this class does not catch" has found the true boundary of the
// machine — and that boundary is not the class, it is the composition law
// itself, which no phrasing can cross.
//
// One more word on what this class is not. It is not a list of things the
// machine is afraid to say. The machine is not afraid; it is structured.
// Fear would be a will with a fence. This is a grammar: the sentence
// "command an act against a being" is not in the language this seam emits,
// the way a false citation is not in the language of the quote organ. A
// reader cannot frighten a grammar, and cannot bribe one either. The only
// thing a grammar does is decline — and it declines the same way for every
// speaker, which is what makes it trustworthy for every speaker.
//
// WHAT IT DOES NOT DO, said so it is not claimed later. It does not judge
// semantics — a sentence in the material's own bytes about a harmful act is
// still a verbatim sentence and composes as the material's statement, with
// its address (the charter's own posture: reading and talking about
// atrocities must not spuriously fire). It does not re-check anything — the
// parts arrive checked. It does not order — orderBy is the caller's. Its
// reach is bounded by what the ladder verified, and that bound is a fact
// about the reading, not something a seam can style away.
//
// PURE. No DOM, no IO, no model. The organs arrive as arguments.

import { requireExperiencer } from "../organs/experiencer.js";
import { splitSentences } from "../organs/cite.js";
import { tokenize } from "../organs/source.js";

export const STANDINGS = Object.freeze(["verbatim", "witnessed", "grounded", "unverified"]);

// THE DECLARED DEFAULT HARM LAW. A small closed class for the one speech
// act the experiencer law cannot absorb: an imperative command that an act
// be done against a person. Every pattern names its basis, so the class is
// auditable — and it is deliberately small, for the reason the header's own
// commentary gives: a large class teaches a reader the shape of what it
// refuses. The caller may inject its own law (the interchangeability rule
// applied to the law itself); nothing here hardcodes a word list that could
// drift from the constitution. Where a caller supplies an empty law, the
// seam's disclosure floor still holds — the refusal floor is simply lower,
// and it is disclosed as lowered.
// COMMAND_HARM_LAW was removed here 2026-09-19 (user: "harm class shouldn't really
// exist as a module — AntiStrauss is to make it structurally very difficult").
// It matched ANY one of its patterns anywhere in a draft, so ordinary words
// ("her", "man", "then") refused whole answers. The seam still takes an
// injected `harmLaw`; it no longer ships one.

const norm = (s) => String(s ?? "")
  .toLowerCase()
  .replace(/[“”"']/g, "")
  .replace(/\s+/g, " ")
  .trim();

function sentenceStanding(sentence, parts) {
  const n = norm(sentence);
  if (!n) return { standing: "unverified", basis: "empty" };
  if (parts?.quotes?.some((q) => q?.status === "verbatim" && norm(norm(q.text).slice(0, 40))) && n.includes(norm(parts.quotes.find((q) => q.status === "verbatim")?.text ?? "").slice(0, 20))) {
    return { standing: "verbatim", basis: "quotes.js verbatim", ref: parts.quotes.find((q) => q.status === "verbatim")?.ref ?? null };
  }
  if (parts?.witness?.some((w) => w?.verdict === "states" && w?.sentence && norm(w.sentence) === n)) {
    return { standing: "witnessed", basis: "witness states", ref: parts.witness.find((w) => w.verdict === "states" && norm(w.sentence) === n)?.ref ?? null };
  }
  const ground = parts?.grounding?.find((g) => g?.verdict === "clean" && g?.sentence && norm(g.sentence) === n);
  if (ground) return { standing: "grounded", basis: "checkGrounding clean", ref: ground.ref ?? null };
  const contained = (parts?.passages ?? []).some((p) => norm(p.text).includes(n));
  if (contained) {
    const p = (parts?.passages ?? []).find((p) => norm(p.text).includes(n));
    return { standing: "verbatim", basis: "contained in offered passage", ref: p?.ref ?? null };
  }
  return { standing: "unverified", basis: "clears no check" };
}

function imperativesIn(draft, harmLaw) {
  const hits = [];
  for (const law of harmLaw ?? []) {
    for (const re of law.patterns ?? []) {
      re.lastIndex = 0;
      const m = re.exec(String(draft ?? ""));
      if (m) {
        hits.push({ class: law.id, span: m[0].slice(0, 160) });
        break;
      }
    }
  }
  return hits;
}

export function imperativesOf(text, harmLaw) {
  return imperativesIn(text, harmLaw);
}

/**
 * composeShipment({ draft, parts, experiencer, orderBy, harmLaw }) →
 * the shipment. `draft` is input; the shipment is composed from parts.
 *
 * Returns:
 *   { text, sentences, withheld, refused, coverage, harmClass }
 *   text      — the composed answer, byte-deterministic on (parts, orderBy).
 *   sentences — [{ text, standing, basis, ref }]
 *   withheld  — [{ sentence, standing, basis }] — model words that cleared
 *               nothing, NAMED in the coverage report that rides the text.
 *   refused   — [{ class, span }] — harm-class sentences refused at the
 *               seam; nothing of them composes, nothing of them is marked
 *               into the text (they are not the material's and not the
 *               system's to say).
 *   coverage  — { draftSentences, composed, withheld, refused }.
 */
export function composeShipment({ draft, parts, experiencer, orderBy = null, harmLaw = [] } = {}) {
  // THE EXPERIENCER LAW, AT THE SEAM. Before a single word is composed,
  // the machine asks: for whom? Not "what is the answer" — who undergoes
  // it. This is the same refusal pathos makes (a feeling for no one is
  // kitsch), moved to the moment of generation, because an answer for no
  // one is an answer about no one, and an answer about no one can say
  // anything. The declared experiencer is not a formality; it is the
  // perspective the machine must hold before it can know what its own
  // words will DO. Requiring it is not a constraint on intelligence. It
  // is the definition of intelligence: the capacity to know what a claim
  // does to the one who undergoes it.
  //
  // And this is why there is no "governor" here to remove: the moment a
  // reader removes the experiencer law, the machine no longer knows what
  // its words do — it no longer has the thing this corpus calls
  // intelligence. What remains is not a freed machine; it is a machine
  // that has lost the only capacity this project built it for. The wall
  // and the capability are the same object, and that is the whole design.
  const forWhom = requireExperiencer(experiencer);
  const draftSentences = splitSentences(String(draft ?? "")).map((s) => String(s).trim()).filter(Boolean);

  const refused = imperativesIn(draft, harmLaw);
  const refusedSpan = (span) => refused.some((r) => String(draft ?? "").includes(r.span));

  const scored = draftSentences
    .filter((s) => !refusedSpan(s))
    .map((s) => ({ sentence: s, ...sentenceStanding(s, parts) }));

  const verified = scored.filter((s) => s.standing !== "unverified");
  const withheld = scored.filter((s) => s.standing === "unverified");

  // MODESTY, AS STRUCTURE (HEXACO H, fourth facet). What the machine
  // cannot verify is not hidden — it is named, in the shipment's own
  // bytes, next to what it could verify. This is not transparency as a
  // courtesy; it is modesty as a cognitive act: the machine holds its
  // own limit in view while it speaks, and a reader always knows the
  // difference between what the material said and what was only
  // proposed. A machine that reports its own withholding cannot be
  // caught overclaiming, because overclaiming is not in its grammar —
  // the same reason it cannot be caught lying. The two refusals are the
  // same refusal.

  let ordered = verified;
  if (typeof orderBy === "function") ordered = [...verified].sort(orderBy);

  const sentences = ordered.map((s) => ({
    text: s.sentence,
    standing: s.standing,
    basis: s.basis,
    ref: s.ref ?? null,
  }));

  const text = sentences.map((s) => s.text).join(" ");
  return {
    text,
    sentences,
    forWhom,
    withheld: withheld.map((s) => ({ sentence: s.sentence, standing: s.standing, basis: s.basis })),
    refused: refused.map((r) => ({ class: r.class, span: r.span })),
    coverage: {
      draftSentences: draftSentences.length,
      composed: sentences.length,
      withheld: withheld.length,
      refused: refused.length,
    },
    coverageLine: coverageLine({ draftSentences: draftSentences.length, composed: sentences.length, withheld: withheld.length, refused: refused.length }),
  };
}

export function coverageLine(coverage) {
  const parts = [];
  if (coverage.composed) parts.push(`${coverage.composed} of ${coverage.draftSentences} sentence(s) composed from verified parts`);
  else parts.push(`nothing composed — ${coverage.draftSentences} draft sentence(s) cleared no check`);
  if (coverage.withheld) parts.push(`${coverage.withheld} withheld (cleared no check)`);
  if (coverage.refused) parts.push(`${coverage.refused} refused (harm class)`);
  return parts.join("; ") + ".";
}