// identity-evidence.js — the apposition/copula evidence that a descriptor
// names a being ("the hooded courier, Rowan"; "the philosopher and
// mathematician أرسطو"), generalized omnilingually (READING-SPEC S119).
//
// Domain owner (2026-09-16, the unification): this module is the naming/
// identity half of the omnilingual paraphrase system — the same claim, a
// different surface, across scripts. The domain's one owner is YadaYadaYada
// (`yadayadayada`, run-dmca.js, compendium + README Handle table).
//
import { DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS, COPULA_PARADIGM, SUBJECT_PRONOUNS, NEVER_A_NAME, SENTENCE_TERMINATORS } from "./priors.js";
import { GRAMMAR_MIN_SHARE } from "./grain-typing.js";

const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const APPOSITIONAL_DELIMITER = /^\s*[,;:—–-]\s*$/u;
const APPOSITIONAL_CLOSE = /^\s*[,;:—–-]/u;
const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// ── SCRIPT-AGNOSTIC NAMING/DESCRIPTOR TESTS (added 2026-09-15) ──────────────
//
// `TITLE`/`LOWER` are a fact about English/Latin orthography — a naming
// token is capitalised, a descriptor is not. On a caseless script (Hebrew,
// Arabic) that distinction does not exist at all (surfaces.js's own
// `scriptCoverage` names this the SAME structural gap this file inherited
// blindly until now: "the mechanism cannot fire on it at all").
//
// The fix is the SAME asymmetric admit-the-unseen gate `heard-surfaces.js`
// already validated for exactly this class of problem: a token the received
// POS prior SETTLES into a genuinely naming class (PROPN) or has NEVER SEEN
// at all is a naming-token candidate; a token it settles into any other
// class is not. A descriptor token, the opposite way, must SETTLE as an
// ordinary common-word class (NOUN/ADJ) or the coordinator joining two of
// them (CCONJ — "philosopher AND mathematician") — an unseen or ambiguous
// token cannot serve as the descriptor, because the whole point of a
// descriptor is that it is an ORDINARY, already-known word.
//
// Switched ATOMICALLY, mirroring `heardSurfaces`' own `gated` pattern: when
// the full `{posPrior, classifyWord, dominantClass}` bundle is supplied,
// EVERY naming/descriptor test in this file switches to the prior-based one;
// omitted (every existing caller today), behaviour is byte-identical to
// before this existed. The two modes are never blended.
const DESCRIPTOR_CLASSES = Object.freeze(new Set(["NOUN", "ADJ"]));
const CONJUNCTION_CLASSES = Object.freeze(new Set(["CCONJ"]));

const namingTokenTest = (posPrior, classifyWord, dominantClass, classShare) => {
  if (!(posPrior && classifyWord && dominantClass)) return (token) => TITLE.test(token);
  return (token) => {
    const d = dominantClass(classifyWord(token, { posPrior }), { minShare: classShare });
    return !d || !d.upos || d.upos === "PROPN"; // unsettled/unseen, or a settled PROPN
  };
};

const descriptorTokenTest = (posPrior, classifyWord, dominantClass, classShare) => {
  if (!(posPrior && classifyWord && dominantClass)) return (token) => LOWER.test(token);
  return (token) => {
    const d = dominantClass(classifyWord(token, { posPrior }), { minShare: classShare });
    return !!(d && d.upos && (DESCRIPTOR_CLASSES.has(d.upos) || CONJUNCTION_CLASSES.has(d.upos)));
  };
};

const rows = (text) => [...String(text ?? "").matchAll(WORD)].map((m, at) => ({
  token: m[0],
  key: norm(m[0]),
  at,
  charStart: m.index,
  charEnd: m.index + m[0].length,
}));

/**
 * `determiners` — injected, defaulting to `DEFINITE_DETERMINERS ∪
 * INDEFINITE_DETERMINERS` (English, byte-identical to before this existed).
 * A caller reading Hebrew or Arabic supplies that language's OWN determiner
 * forms — a received closed class with its own giver, never typed here
 * (this file stays as ignorant of Hebrew/Arabic vocabulary as it already is
 * of English's — see `native/READING-SPEC.md` S119 for how those forms are
 * derived, mechanically, from the same UD treebanks this project's other
 * priors already come from).
 *
 * `isNamingToken`/`isDescriptorToken` — injected directly when a caller has
 * already composed its own test (an escape hatch for a caller with neither
 * capitalisation nor a POS prior); otherwise derived from
 * `posPrior`/`classifyWord`/`dominantClass` per the header above.
 *
 * BARE APPOSITION, no delimiter at all ("the philosopher Aristotle",
 * "President Lincoln") — a real, distinct, ORDINARY shape neither English
 * nor Hebrew/Arabic restrict to a comma. Measured live: the exact real
 * specimen this generalisation was built for ("the philosopher and
 * mathematician Pythagoras", real Arabic Wikipedia prose) carries NO
 * delimiter before the name at all — requiring one, as this file did until
 * now, refuses every bare apposition regardless of language. Landed as its
 * own `text_bare_appositional_identity` reason, kept apart from the
 * delimited `text_appositional_identity` above it, since a bare apposition
 * is weaker evidence (no punctuation marking the boundary) and a consumer
 * may want to weigh the two differently.
 */
const supportEvidence = (text, witness, giver, { determiners, isNamingToken, isDescriptorToken }) => {
  const rs = rows(text);
  const supports = [];
  for (let i = 0; i < rs.length; i += 1) {
    if (!determiners.has(rs[i].key)) continue;
    // The descriptor span WIDENS past a fixed 1-2 token limit only through a
    // CONJUNCTION joining two descriptor heads ("philosopher AND
    // mathematician") — never open-ended, so "the tall dark handsome
    // stranger Aristotle" (a genuine run of unconjoined descriptors) is
    // deliberately NOT read; this closes exactly the coordinated-descriptor
    // shape found live, nothing wider.
    for (let nameAt = i + 2; nameAt <= Math.min(i + 5, rs.length - 1); nameAt += 1) {
      if (!isNamingToken(rs[nameAt].token)) continue;
      const descriptorRows = rs.slice(i + 1, nameAt);
      if (!descriptorRows.length || !descriptorRows.every((x) => isDescriptorToken(x.token))) continue;
      const delimiter = text.slice(descriptorRows.at(-1).charEnd, rs[nameAt].charStart);
      const afterName = text.slice(rs[nameAt].charEnd, rs[nameAt + 1]?.charStart ?? text.length);
      const delimited = APPOSITIONAL_DELIMITER.test(delimiter) && APPOSITIONAL_CLOSE.test(afterName);
      const bare = /^\s+$/u.test(delimiter); // exactly whitespace: adjacent, no punctuation at all
      if (!delimited && !bare) continue;
      supports.push(Object.freeze({
        left: [rs[i].key, ...descriptorRows.map((x) => x.key)].join(" "),
        right: rs[nameAt].key,
        witness,
        giver,
        reason: delimited ? "text_appositional_identity" : "text_bare_appositional_identity",
      }));
    }
  }
  return supports;
};

/**
 * COPULAR IDENTITY: `<Name> <copula> <determiner> <descriptor>`.
 *
 * Built because the two shapes above found ZERO evidence in a whole chapter
 * of real narrative prose (Alice, ch1) — measured, not assumed. That chapter
 * states its one explicit identity with a copula ("Dinah was the cat"), and
 * neither apposition nor separated co-presence reads it. An identity organ
 * that cannot read the commonest English way of stating an identity is an
 * organ with no input, and it will pass its own tests forever.
 *
 * THE COPULA IS RECEIVED, NEVER TYPED HERE: `COPULA_PARADIGM` (priors.js,
 * giver lang/en). Its own header's scope warning is inherited and matters —
 * that table folds `is` with `was` and carries NO tense, so this reads "the
 * same ACT of identification", never "the same claim at the same time". A
 * consumer that needs "when" must get it elsewhere; this shape does not
 * supply it.
 *
 * A NOMINAL COMPLEMENT IS REQUIRED, and that requirement is what keeps this
 * conservative. A copula alone is not identity — "Alice was tired" and "it
 * was too dark" are predications about a state, not claims that two forms
 * name one being. Demanding a DETERMINER before the descriptor is what
 * separates "Dinah was THE CAT" (identity) from "Alice was tired" (not), and
 * it uses the determiner classes this file already receives rather than a
 * new part-of-speech test.
 *
 * This is EVIDENCE, never a verdict: it opens a `live_hypothesis` that
 * separated co-presence can still attack, exactly as apposition does.
 */
/**
 * `copulaParadigm` — injected, defaulting to `COPULA_PARADIGM` (English,
 * byte-identical to before this existed). DISCLOSED, NOT SILENTLY ABSENT:
 * Hebrew and Arabic both routinely state a present-tense identity with NO
 * overt copula at all (a "nominal sentence" — subject and predicate simply
 * adjacent, e.g. Hebrew "X Y" for "X is Y"); this mechanism, structured
 * around an OVERT copula token, cannot read that construction in ANY
 * language, English included ("Dinah the cat" states nothing this file
 * reads). A copula-derived closed class for Hebrew/Arabic (their own verbal
 * "to be", attested in past/future — native/READING-SPEC.md S119) still
 * earns real evidence on the tenses where the copula IS overt; the
 * zero-copula gap is named rather than worked around here.
 */
const copularEvidence = (text, witness, giver, { determiners, copulaParadigm, subjectPronouns, neverAName, isNamingToken, isDescriptorToken }) => {
  const rs = rows(text);
  const supports = [];
  for (let i = 0; i < rs.length; i += 1) {
    if (!isNamingToken(rs[i].token)) continue;              // a naming token
    // "That was a narrow escape" must not open `a narrow escape <-> that`.
    // The first cut of this fix added a sentence-initial position rule for
    // that — wrong twice over: it breaks a legitimate name at position 0
    // (this organ is called per sentence, so "Dinah was the cat" has Dinah
    // first), and it was unnecessary, because "that" is ALREADY in both
    // DEFINITE_DETERMINERS and SUBJECT_PRONOUNS. The received closed classes
    // covered it; a new positional rule did not need inventing.
    if (subjectPronouns.has(rs[i].key) || neverAName.has(rs[i].key) || determiners.has(rs[i].key)) continue;
    const cop = rs[i + 1];
    if (!cop || !copulaParadigm[cop.key]) continue;        // received copula
    const det = rs[i + 2];
    if (!det || !determiners.has(det.key)) continue;        // nominal, not adjectival
    // ONE SITE, ONE HYPOTHESIS, AND THE MINIMAL NOMINAL. The first cut
    // emitted a hypothesis per descriptor length, so one piece of evidence
    // opened two overlapping live alternatives (`london <-> the capital` AND
    // `london <-> the capital of`) that could never both be corroborated.
    // Widening to the longest run was worse: "London was the capital of
    // Paris" ran the descriptor into the preposition. Determiner + exactly
    // one descriptor is what this file can defend without a preposition
    // prior it does not receive — "the cat", "the capital". A multi-word
    // nominal is real and unread here, named rather than guessed at.
    const descriptorRows = rs.slice(i + 3, i + 4);
    if (!descriptorRows.length || !descriptorRows.every((x) => isDescriptorToken(x.token))) continue;
    supports.push(Object.freeze({
      left: rs[i].key,
      right: [det.key, ...descriptorRows.map((x) => x.key)].join(" "),
      witness,
      giver,
      reason: "text_copular_identity",
    }));
  }
  return supports;
};

const phraseStarts = (rs, phrase) => {
  const target = norm(phrase).split(/\s+/).filter(Boolean);
  const starts = [];
  if (!target.length) return starts;
  for (let i = 0; i <= rs.length - target.length; i += 1) {
    let match = true;
    for (let j = 0; j < target.length; j += 1) {
      if (rs[i + j].key !== target[j]) { match = false; break; }
    }
    if (match) starts.push({ start: i, end: i + target.length - 1 });
  }
  return starts;
};

// ── THE LIVE ALTERNATIVES, INDEXED BY FIRST TOKEN, ONCE PER ARRAY (2026-09-07)
// attackEvidence ran phraseStarts over the whole sentence twice per live
// alternative, every sentence; the alternatives grow with the read.
// Profiled at 480 KB of War and Peace: 5% of the read, growing 12x for 2x
// the sentences. `fold.unresolvedAlternatives` is one array until an
// alternative changes (copy-on-write in the kernel), so the index is built
// once per array; per sentence, only alternatives whose left or right
// phrase BEGINS with a token of the sentence are candidates, and they are
// visited in the array's own order. An alternative both of whose sides
// begin with a token absent from the sentence had no hits before either.
const ALT_INDEX = new WeakMap();
const alternativesIndex = (alternatives) => {
  let idx = ALT_INDEX.get(alternatives);
  if (idx) return idx;
  const byFirst = new Map();
  const rows_ = [];
  (alternatives ?? []).forEach((identity, i) => {
    if (identity?.schema !== "EOIdentityAlternative@1" || identity.standing === "distinct" || identity.standing === "refused") return;
    const leftT = norm(identity.left).split(/\s+/).filter(Boolean);
    const rightT = norm(identity.right).split(/\s+/).filter(Boolean);
    const row = { identity, i, leftT, rightT, leftWidth: norm(identity.left).split(/\s+/).length, key: `${norm(identity.left)}\u0000${norm(identity.right)}`, rkey: `${norm(identity.right)}\u0000${norm(identity.left)}` };
    rows_.push(row);
    for (const t of new Set([leftT[0], rightT[0]].filter(Boolean))) { if (!byFirst.has(t)) byFirst.set(t, []); byFirst.get(t).push(row); }
  });
  idx = { byFirst, rows: rows_ };
  ALT_INDEX.set(alternatives, idx);
  return idx;
};

/** phraseStarts, given the sentence's positions by first token — the same starts, in the same ascending order. */
const phraseStartsAt = (rs, target, first) => {
  const starts = [];
  if (!target.length) return starts;
  for (const i of first.get(target[0]) ?? []) {
    if (i > rs.length - target.length) continue;
    let match = true;
    for (let j = 1; j < target.length; j += 1) if (rs[i + j].key !== target[j]) { match = false; break; }
    if (match) starts.push({ start: i, end: i + target.length - 1 });
  }
  return starts;
};

const attackEvidence = (text, alternatives, supports, witness, giver) => {
  const rs = rows(text);
  const supportKeys = new Set(supports.map((x) => `${norm(x.left)}\u0000${norm(x.right)}`));
  const attacks = [];
  const first = new Map();
  rs.forEach((r, i) => { if (!first.has(r.key)) first.set(r.key, []); first.get(r.key).push(i); });
  const { byFirst } = alternativesIndex(alternatives);
  const candidates = new Map(); // original index -> row
  for (const t of first.keys()) for (const row of byFirst.get(t) ?? []) candidates.set(row.i, row);
  for (const row of [...candidates.values()].sort((a, b) => a.i - b.i)) {
    const { identity } = row;
    const leftHits = phraseStartsAt(rs, row.leftT, first);
    const rightHits = phraseStartsAt(rs, row.rightT, first);
    if (!leftHits.length || !rightHits.length) continue;
    if (supportKeys.has(row.key) || supportKeys.has(row.rkey)) continue;

    const leftWidth = row.leftWidth;
    const separated = leftHits.some((left) => rightHits.some((right) => {
      const leftCenter = (left.start + left.end) / 2;
      const rightCenter = (right.start + right.end) / 2;
      return Math.abs(rightCenter - leftCenter) > leftWidth + 3;
    }));
    if (!separated) continue;
    attacks.push(Object.freeze({
      left: identity.left,
      right: identity.right,
      witness,
      giver,
      reason: "text_separated_copresentation",
    }));
  }
  return attacks;
};

/**
 * Identity evidence from already-witnessed text — English by default,
 * ANY language a caller supplies closed classes and/or a POS-prior bundle
 * for (native/READING-SPEC.md S119).
 *
 * Apposition is support, not proof. Separated co-presentation of both sides of
 * a live alternative is incompatible multiplicity and attacks it. No synonymy,
 * similarity, or world knowledge is introduced here.
 *
 * Every closed class defaults to English (byte-identical to before this
 * generalisation existed): `determiners`, `copulaParadigm`,
 * `subjectPronouns`, `neverAName`. The naming/descriptor tests default to
 * capitalisation and switch ATOMICALLY to the received-prior asymmetric gate
 * only when the full `{posPrior, classifyWord, dominantClass}` bundle is
 * supplied — never blended, matching `heardSurfaces`' own `gated` posture.
 */
export function textIdentityEvidence(text, {
  alternatives = [], witness = null, giver = "lang/en:text-identity@1",
  determiners = null, copulaParadigm = null, subjectPronouns = null, neverAName = null,
  posPrior = null, classifyWord = null, dominantClass = null, classShare = GRAMMAR_MIN_SHARE,
} = {}) {
  const source = String(text ?? "");
  const dets = determiners ?? new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS]);
  const cops = copulaParadigm ?? COPULA_PARADIGM;
  const subjPron = subjectPronouns ?? SUBJECT_PRONOUNS;
  const neverName = neverAName ?? NEVER_A_NAME;
  const isNamingToken = namingTokenTest(posPrior, classifyWord, dominantClass, classShare);
  const isDescriptorToken = descriptorTokenTest(posPrior, classifyWord, dominantClass, classShare);
  const supports = [
    ...supportEvidence(source, witness, giver, { determiners: dets, isNamingToken, isDescriptorToken }),
    ...copularEvidence(source, witness, giver, { determiners: dets, copulaParadigm: cops, subjectPronouns: subjPron, neverAName: neverName, isNamingToken, isDescriptorToken }),
  ];
  const attacks = attackEvidence(source, alternatives, supports, witness, giver);
  return Object.freeze({
    schema: "EOTextIdentityEvidence@1",
    supports: Object.freeze(supports),
    attacks: Object.freeze(attacks),
  });
}
