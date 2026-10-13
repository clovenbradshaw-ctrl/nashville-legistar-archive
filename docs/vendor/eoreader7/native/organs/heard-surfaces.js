// heard-surfaces.js — finding the material's beings WITHOUT reading them.
//
// THE RULE THIS EXISTS FOR (native/docs/LEVELS.md, the user's own words):
// "the system must be able to work equally well if it only heard the novel
// and didn't read it." S86 measured the distance from it and found ONE
// layer at zero: `adapters/text/surfaces.js::extractSurfaces` finds every
// candidate being by capitalisation and by nothing else. Measured on 900 KB
// of real Crime and Punishment — as printed, 401 surfaces; lowercased, 0;
// punctuation softened with case kept, 411. Hebrew prose, 0. Korean prose,
// 0. Not a degradation, a collapse: a listener has no capitals, and neither
// do two of the five languages this repo has already built POS priors for.
//
// S86's own amendment located the fix rather than only the gap: the KIND
// layer already hears (13 kinds as read, 14 as heard — MORE, because
// lowercasing merges case variants), so the repository already contains a
// working, book-scale demonstration that structure can be discovered from
// company alone. This module is that same posture applied one grain over,
// to beings.
//
// ── THE SIGNAL, AND WHY IT IS NOT A WORD LIST ──────────────────────────────
//
// `kind-standing.js` already measured the thing this needs, on the real War
// and Peace heard stream, and states it in its own header: general / count /
// emperor / colonel / captain announce `before=the` as their dominant
// company; kutuzov / napoleon / pierre / rostov / denisov announce
// `before=^` "with determiners absent". A common noun keeps a WORD in front
// of it. A name keeps nothing in particular.
//
// So a being-candidate is a recurring term whose discovered kind is signed
// POSITIONALLY rather than lexically — and that distinction is the one
// `kind-standing.js` itself says a consumer may lean on without a word
// list: "a kind signed by a WORD (members share an actual preceding word)
// is a frame-kind; a kind signed by POSITION alone (`^` — the absence of a
// preceding word) is not. `^` is not a word of any language, so this is
// structure, not English."
//
// Nothing here names a determiner, an article, a title, or a language. The
// English closed classes in `priors.js` are deliberately NOT imported: they
// would work for English and silently return nothing for Korean, which is
// the failure this module exists to end.
//
// ── WHAT IT DOES NOT DO, STATED RATHER THAN DISCOVERED LATER ───────────────
//
//  · UNIGRAMS ONLY. "Sofya Semyonovna" is two tokens and this finds "sofya"
//    and "semyonovna" separately. Multi-token names are `extractSurfaces`'
//    own capitalised-run mechanism and have no heard equivalent here.
//    Composing them is real, unattempted work.
//  · SPACE-DELIMITED SCRIPTS. The vocabulary walk splits on non-letters, so
//    Korean (spaced) works and Chinese/Japanese (unspaced) do not. Naming
//    it rather than pretending the module is universal.
//  · It is a CANDIDATE generator, exactly as `extractSurfaces` is. Which
//    candidates are one being is `discoverReferents`' question, and which
//    being a given mention names is the occurrence layer's (S17-type).
//
// PURE. Sentences arrive as an argument; the only organ is
// `discoverCompanyKinds`, which is itself pure.

import { discoverCompanyKinds } from "./kind-standing.js";
import { GRAMMAR_MIN_SHARE } from "../adapters/text/grain-typing.js";

// ── THE SECOND GATE: a received word-class prior, used ASYMMETRICALLY ──────
//
// The positional signature alone finds names AND everything else that opens
// a sentence. Measured on real Crime and Punishment: 5 of a 20-name cast
// recovered from lowercased bytes (from 0), but half the returned list was
// discourse particles — but / what / how / why / well / yes / listen.
//
// A cut on sentence-initial share was tried first and REFUSED on the
// measurement: names run 0.13-0.42 and openers 0.30-0.77, ranges that
// overlap, so any cut would be a threshold tuned against the answer — the
// one thing the legacy engine.1's own CLAUDE.md forbids outright.
//
// What separates them is a fact about WORD CLASS, and this repo already
// holds that fact as a received resource with a named giver: `POSPrior@1`,
// built from real UD treebanks for six languages (S83/S84). Used the same
// asymmetric way the admission gate already uses it — a SETTLED non-being
// class refuses, and an out-of-vocabulary form ADMITS. That polarity is
// what makes it work here rather than merely filter: a treebank of ordinary
// prose has "but" (CCONJ, 724) and has never heard of "raskolnikov", and it
// is precisely the unknown words that are names.
//
// Knowing that "but" is a conjunction is not reading. It is knowing the
// language, which a listener does. The gate stays heard-legal.

/** UD classes that can NAME something — a being may be a person or, per
 * P79's own Federalist reading (`ref:auto:state`, 685 arrivals), an
 * ordinary noun. Everything else is settled as unable to name a being. */
export const NAMING_CLASSES = Object.freeze(new Set(["NOUN", "PROPN"]));

/** The mark `contextVectors` writes when nothing precedes a token in its
 * sentence. Not a word in any language — which is what makes a kind signed
 * by it structural rather than lexical (kind-standing.js's own rule). */
export const POSITIONAL_SIGNATURE = "before=^";

/** Is this kind signed by POSITION (a being's signature) or by a WORD (a
 * frame-kind — a common noun sitting under its determiner)? */
export const isPositionallySigned = (kind) => kind?.signature === POSITIONAL_SIGNATURE;

/**
 * PROCLITIC PEELING — a language's own bound proclitics (received,
 * giver-named: `ProcliticPrior@1`, derived mechanically from a UD
 * treebank's own multi-word-token split convention by
 * `scripts/build-proclitic-prior.mjs` — never a hand-typed list of
 * "known articles/prepositions") stripped from the FRONT of a word
 * before the company signal ever sees it.
 *
 * WHY. Hebrew and Arabic glue a determiner/conjunction/preposition
 * directly onto the following word with no space — Hebrew "הפילוסופיות"
 * is ה ("the") + "פילוסופיות" ("philosophies") written as one string,
 * Arabic "وأرسطو" is و ("and") + "أرسطو" ("Aristotle") the same way. Left
 * fused, this hides BOTH ends of the company signal this module depends
 * on: a common noun's own determiner (its `before=` word) is invisible
 * because it never appears as a separate token, so the noun looks
 * positionally signed like a name; and a NAME's occurrences fragment
 * across every proclitic combination it happens to appear with, none of
 * them individually recurring enough to clear `minMentions`. Measured
 * live: a real Hebrew Wikipedia article surfaced "הפילוסופיות" as a false
 * being; a real Arabic Wikipedia article of comparable length recovered
 * ZERO proper names, because a genuinely-present name never once reached
 * `minMentions` under its own bare spelling — every mention was fused to
 * a different proclitic.
 *
 * ONLY COMMITTED WHEN THE DATA CONFIRMS IT — never a guessed split. A
 * word beginning with a declared proclitic character is peeled ONE LAYER
 * AT A TIME (both languages productively stack more than one — "and in
 * the" is an ordinary construction), and the peel is kept only if the
 * FINAL remainder is independently attested in the received POS prior —
 * the same "ask the giver in the giver's own units" discipline this
 * file's English clitic check already uses (`settledNonNaming`'s
 * stem-before-the-apostrophe check), mirrored to a PREFIX instead of a
 * suffix. A word that never bottoms out at an attested form — a genuine
 * root that happens to start with the same letter (Hebrew "הוא" "he",
 * "הם" "they") — is left completely untouched: the safety is structural
 * (the giver's own vocabulary), not a hand-typed exception list.
 */
const PROCLITIC_MAX_PEEL = 3;
export const peelProclitics = (word, proclitics, posPrior) => {
  if (!proclitics || !proclitics.size || !posPrior?.forms) return null;
  const peeled = [];
  let rest = word;
  for (let depth = 0; depth < PROCLITIC_MAX_PEEL; depth++) {
    if (rest.length < 3) break; // need room for a real stem after the peel
    const lead = rest[0];
    if (!proclitics.has(lead)) break;
    const candidate = rest.slice(1);
    peeled.push(lead);
    rest = candidate;
    if (posPrior.forms[rest]) return { proclitics: peeled, stem: rest };
  }
  return null;
};

const applyProcliticPeel = (text, proclitics, posPrior) =>
  text.replace(/[\p{L}\p{N}']+/gu, (word) => {
    const peel = peelProclitics(word, proclitics, posPrior);
    return peel ? [...peel.proclitics, peel.stem].join(" ") : word;
  });

// A Han/Kana word carries a whole morpheme per character, so its floor is two
// characters; every other script keeps the three-character floor that keeps
// particles out. A fact about the script's information density, declared.
const DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const minWordLength = (w) => (DENSE_SCRIPT.test(w) ? 2 : 3);

/**
 * heardSurfaces(sentences, {minMentions, minShare, minMembers, nullArm})
 *
 * Returns `[{surface, mentions, sentences}]` — deliberately the SAME shape
 * `extractSurfaces` returns, so `discoverReferents` consumes it unchanged
 * and the two can be compared on one downstream.
 *
 * Every number is the caller's (P4): `minMentions` (how often a term must
 * recur to be heard at all), `minShare` (how dominant its company signature
 * must be), `minMembers` (how many terms a kind needs before it is a kind).
 * `nullArm` is forwarded to `discoverCompanyKinds` and is how a caller buys
 * II.23's control — a kind whose share does not beat the shuffled ceiling
 * is not admitted.
 *
 * `proclitics` — optional, a received `ProcliticPrior@1.proclitics` array
 * or `Set` for this material's language. Omitted, behaviour is
 * byte-identical to before this existed (no caller currently supplies it).
 */
export function heardSurfaces(sentences, { minMentions, minShare, minMembers, nullArm = null, clean, posPrior = null, classifyWord = null, dominantClass = null, classShare = GRAMMAR_MIN_SHARE, proclitics = null, index = null, segment = null } = {}) {
  for (const [k, v] of Object.entries({ minMentions, minShare, minMembers }))
    if (!Number.isFinite(v)) throw new Error(`heardSurfaces: ${k} must be declared`);
  const gated = posPrior && classifyWord && dominantClass;
  const procliticSet = proclitics ? new Set(proclitics) : null;

  // THE EAR HAS NO CASE. Folding here, not downstream, so nothing below can
  // accidentally recover a distinction a listener never had.
  const heard = (sentences ?? []).map((s) => {
    let lower = String(s?.text ?? s ?? "").toLowerCase();
    // THE EAR OF AN UNSPACED SCRIPT: word boundaries from the language's own
    // received prior (adapters/text/script-segment.js), never from spaces
    // that script does not write.
    if (segment) lower = segment(lower);
    return { text: procliticSet && posPrior ? applyProcliticPeel(lower, procliticSet, posPrior) : lower };
  });

  // The vocabulary is the material's own recurring terms — no list, no
  // lexicon, no capital letters. A term must recur to be a candidate at
  // all, which is the one thing a listener certainly has.
  //
  // With an EOCompanyIndex@1 (organs/company-index.js) the past is read
  // once: only the sentences the index has not seen are added, and the
  // tallies and company come from it. Byte-identical to the scan below
  // (company-index.test.mjs); the null arm still needs sentences.
  let counts, sentenceCounts, company;
  if (index && index.schema === "EOCompanyIndex@1") {
    if (nullArm) throw new TypeError("heardSurfaces: the null arm shuffles sentences — omit `index` when declaring nullArm");
    for (let i = index.size; i < heard.length; i += 1) index.add(heard[i]);
    counts = index.counts; sentenceCounts = index.sentenceCounts; company = index;
  } else {
    counts = new Map();
    sentenceCounts = new Map();
    for (const s of heard) {
      const seen = new Set();
      for (const w of s.text.split(/[^\p{L}\p{N}']+/u)) {
        if (w.length < minWordLength(w)) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
        if (!seen.has(w)) { seen.add(w); sentenceCounts.set(w, (sentenceCounts.get(w) ?? 0) + 1); }
      }
    }
    company = heard;
  }
  const vocabulary = [...counts.entries()].filter(([, n]) => n >= minMentions).map(([w]) => w);
  if (!vocabulary.length) return [];

  const kinds = discoverCompanyKinds(company, vocabulary, { minMentions, minShare, minMembers, nullArm, clean });
  const beings = new Set();
  for (const kind of kinds) if (isPositionallySigned(kind)) for (const m of kind.members) beings.add(m);

  // ASYMMETRIC, and the polarity is the whole point: a form the prior
  // SETTLES into a class that cannot name a being is refused with its
  // giver; a form the prior never saw is ADMITTED, because a treebank of
  // ordinary prose has every conjunction and almost no character's name.
  // Absent a prior, nothing is refused — the gate that cannot run must not
  // block (the same degradation the admission gate already holds).
  // ASK THE PRIOR IN THE PRIOR'S OWN TOKENISATION. A UD treebank splits a
  // clitic — "that's" is annotated as `that` + `'s` — so the contracted
  // form is never attested and, under the admit-the-unseen rule above,
  // every contraction sails through. Measured: with the gate on but the
  // tokenisations misaligned, 13 of the 24 survivors were contractions
  // (that's, i'll, i've, there's, you've, he's, we'll...). Consulting the
  // stem before the clitic is not a word list and not a rule about
  // English — it is asking the giver its own question in its own units.
  const settledNonNaming = (form) => {
    const d = dominantClass(classifyWord(form, { posPrior }), { minShare: classShare });
    return d && d.upos ? !NAMING_CLASSES.has(d.upos) : false;
  };
  const refuse = (word) => {
    if (!gated) return false;
    if (settledNonNaming(word)) return true;
    const clitic = word.indexOf("'");
    if (clitic > 0 && settledNonNaming(word.slice(0, clitic))) return true;
    return false; // unsettled or unseen — admit
  };

  return [...beings]
    .filter((surface) => !refuse(surface))
    .map((surface) => ({ surface, mentions: counts.get(surface) ?? 0, sentences: sentenceCounts.get(surface) ?? 0 }))
    .sort((a, b) => b.mentions - a.mentions);
}
