// native/organs/stance.js — STANCE IS THE JOIN AT A LEVEL OF HOLONIC RELEVANCY.
// Handle: the engine's own polarity (PT-1), read the way every other relation
// in this codebase is read.
//
// THE LAW (2026-10-02). Stance is NOT a property of a sentence, a word list, or
// a cube cell. It is the join of THREE things at a LEVEL:
//
//   stance(text, holon) =
//       SHAPE(text, level)          ∧   holonicSatisfaction()   — open/turn/land (required, not sufficient)
//     ∧ GROUNDED(text, holon)       ∧   satisfactionOfSection() — lands in THIS material's own facts
//     ∧ STRAIN_CARRIED(text, holon)     — carries the material's distinctive words, TIED TO ITS BEING
//
// WHY THE JOIN, MEASURED (eval/stance-holonic-experiment.mjs, the real Elizabethan
// Poor Law case): SHAPE alone is STANCE-BLIND — a faithful, an inverted, and a
// word-shuffled reading all pass holonicSatisfaction and satisfactionOfSection,
// because shape reads STRUCTURE (open/turn/land) and a well-formed sentence is
// well-formed whatever it is about. GROUND alone separates faithful (93% of its
// content words are the material's) from inverted (13%) but NOT from shuffled
// (64% — it reuses the material's act words "harshly, punished, cruelly"). Only
// STRAIN_CARRIED-TIED-TO-BEING kills the shuffled control: the material's
// distinctive words must attach to the BEING the theme names, and the shuffled
// reading's being is the weather. That binding is the missing instrument.
//
// WHY NO LEXICON. A regex of good/bad words is a word list pretending to be a
// measure: it fractures the definition across copies, cannot bound its own
// error, and "boondoggle" vs "common sense" is CONTEXT, not vocabulary (user,
// 2026-10-02: "no regex, if we're doing that it's the wrong shape"). The SIGN is
// DERIVED from the material's own copula/negation relations
// (adapters/text/copula-claims.js::readCopulaClaim) — the same relation reader
// every other claim in this engine rides. The cube's 9 (kernel/cube.js
// STANCE_BY_MODE) are the ACTS available at the level, carried as a LABEL, never
// the valence.
//
// THE FOUR READINGS (decision table, derived not tuned):
//
//   SHAPE  GROUND       STRAIN tied   STANCE        SIGN
//   ok     ok           yes           in_terms      +1
//   ok     ok           refused/held-inverted       against  -1
//   ok     ungrounded   no            off_being      0
//   fail   —            —             unnamed        0
//
// "against" requires a RELATION (the text states the material's subject with an
// inverted complement), never a word. "off_being" is the inverted-fabrication
// shape (theme word only). "unnamed" is the ungrounded stack.
//
// GIVER: English copula/negation lens (adapters/text) — not universal; the
// relation is the kernel's. Swap the reader for another language and the measure
// is unchanged; only how English words the copula and the negation is the
// adapter's.
//
// PURE, organs injected (the cast.js pattern) — no fs, no fetch, no model.
// Selftest:
//   node --test native/organs/stance.test.mjs

import { splitSentences } from "../adapters/text/spans.js";
import { readCopulaClaim, splitAtCopula } from "../adapters/text/copula-claims.js";
import { NEGATION_WORDS } from "../adapters/text/priors.js";
import { holonicSatisfaction, satisfactionOfSection } from "../the-fold/document-ledger.js";
import { STANCE_BY_MODE } from "../kernel/cube.js";

export const STANCE_SCHEMA = "Stance@1";
export const STANCE_GIVER = "English copula/negation lens (adapters/text) — not universal; the relation is the kernel's";

const LEVELS = Object.freeze(["whole", "section", "sentence"]);
const READINGS = Object.freeze(["in_terms", "against", "off_being", "unnamed"]);

// Content words (the same grain the experiments used): lowercase letters, length
// > 4, the material's own vocabulary. The theme's own words are removed from
// this set to get the material's DISTINCTIVE strain — what it commits to beyond
// merely naming the subject. No sentiment enters here; these are content tokens.
const contentWords = (t) => new Set(String(t ?? "").toLowerCase().split(/[^\p{L}']+/u).filter((w) => w.length > 4));

/** The material's distinctive strain: its content words MINUS the theme's own
 *  words. What the material commits to beyond naming the subject. */
function distinctiveOf(holon, theme) {
  const ground = contentWords(holon?.ground ?? holon?.material ?? "");
  const themed = contentWords(theme);
  const out = new Set();
  for (const w of ground) if (!themed.has(w)) out.add(w);
  return out;
}

/**
 * carriesStrain(text, holon) -> { carried[], of, tied, basis }
 *   carried  the material's distinctive words the text holds
 *   of       how many distinctive words the material has (the denominator)
 *   tied     do those words resolve to the SAME BEING the theme names?
 *   basis    the words carried, named
 *
 * `holon` = { ground: string, referents: buildReferents(ground), theme? }. The
 * BEING test is what separates a faithful reading from a shuffled one that
 * happens to reuse the material's act words: the material's distinctive words
 * must attach to the referent the theme names, not merely appear.
 */
export function carriesStrain(text, holon) {
  const theme = holon?.theme ?? "";
  const distinctive = distinctiveOf(holon, theme);
  const held = contentWords(text);
  const carried = [...distinctive].filter((w) => held.has(w));
  let tied = false;
  const refs = holon?.referents ?? null;
  if (refs && typeof refs.resolveText === "function") {
    const themeIds = theme ? refs.resolveText(theme) : new Set();
    const textIds = refs.resolveText(text);
    for (const id of textIds) if (themeIds.has(id)) { tied = true; break; }
    // A text that names the theme's OWN surface still ties even when the
    // referent index individuated the theme as a descriptor rather than a name.
    if (!tied && theme) {
      const tl = String(theme).toLowerCase();
      if (carried.some((w) => tl.includes(w))) tied = true;
    }
  } else if (theme) {
    // No referent index injected: fall back to the theme SURFACE containing the
    // carried word (a weaker tie, disclosed in basis).
    const tl = String(theme).toLowerCase();
    tied = carried.some((w) => tl.includes(w));
  }
  return {
    carried, of: distinctive.size, tied,
    basis: carried.length
      ? `carries ${carried.slice(0, 6).join(", ")}${carried.length > 6 ? " …" : ""} of the material's ${distinctive.size} distinctive words${tied ? ", tied to the being the theme names" : ", but NOT tied to the theme's being"}`
      : `carries none of the material's ${distinctive.size} distinctive words`,
  };
}

/**
 * stanceSigns(text, holon) -> { sign: -1|0|1, held[], inverted[], basis }
 *   The sign DERIVED from the material's own copula/negation relations, never a
 *   lexicon. If the text's copula claim HOLDS against the material: +. If the
 *   material states the same subject with the INVERTED complement (or the claim
 *   is REFUSED — the complement stated under a negation): −. Nothing shared: 0.
 *
 * `holon.passages` = [{ ref, text }] (the material as passages); if absent, the
 * holon's own ground is used as one passage.
 */
export function stanceSigns(text, holon) {
  const passages = holon?.passages ?? (holon?.ground ? [{ ref: null, text: String(holon.ground) }] : []);
  if (!passages.length) return { sign: 0, held: [], inverted: [], basis: "no material to compare against" };
  const t = String(text ?? "");
  // ROUTE 1 — the copula reader (the spec's named route): holds / refused.
  const r = readCopulaClaim(t, passages, { splitSentences });
  if (r.verdict === "holds") return { sign: 1, held: [{ sentence: r.decider, ref: r.ref, because: r.because }], inverted: [], basis: "the text's copula claim holds against the material" };
  if (r.verdict === "refused") return { sign: -1, held: [], inverted: [{ sentence: r.decider, ref: r.ref, because: r.because }], basis: "the material states the same subject under a negation the text drops (or the text inverts)" };
  // ROUTE 2 — the subject-relation reader (what the REAL inverted specimen
  // needs: "this text highlights the law's effectiveness" is a positive framing,
  // not a copula of the theme, so the copula route reads `open`). A claim about
  // the SAME subject (the theme) with a complement that shares no content word
  // with the material's own claim about it, under the material's contrast frame,
  // is an inversion — a RELATION, never a word. Read from the theme's own claims
  // in the material vs the text's.
  const theme = holon?.theme ?? "";
  const opp = claimOpposition(t, theme, passages);
  if (opp.inverted) return { sign: -1, held: [], inverted: opp.claims, basis: opp.basis };
  if (opp.held) return { sign: 1, held: opp.claims, inverted: [], basis: opp.basis };
  // no shared claim — a gap, never a verdict.
  return { sign: 0, held: [], inverted: [], basis: r.verdict === "not_copula" ? "the text carries no copula claim to compare" : "a sentence carries the subject with a different complement — the material may state it elsewhere" };
}

/** Does the text OPPOSE the material's own claim about the theme, as a
 *  relation? The material's claims about the theme are its sentences whose
 *  subject names the theme; a text that names the theme while sharing NO content
 *  word with those claims' complements (and no negation required — the
 *  opposition is the different complement, not a word) is inverted. */
function claimOpposition(text, theme, passages) {
  const themeToks = contentWords(theme);
  if (!themeToks.size) return { inverted: false, held: false, claims: [], basis: "no theme to anchor the opposition" };
  const hasTheme = (s) => { const w = contentWords(s); for (const t of themeToks) if (w.has(t)) return true; return false; };
  const textHasTheme = hasTheme(text);
  // THE MATERIAL'S OWN COMMITMENT about the theme = its distinctive strain words
  // (content words NOT in the theme). Sharing a GENERIC word ("poor", "lives")
  // is not sharing the material's commitment; sharing its DISTINCTIVE words is.
  // So the comparison is against the material's strain, not its whole vocabulary
  // — the same instrument carriesStrain uses, here for the sign.
  const ground = passages.map((p) => String(p.text ?? "")).join(" ");
  const strainWords = distinctiveOf({ ground }, theme);
  const textWords = contentWords(text);
  const textCarriesStrain = [...strainWords].filter((w) => textWords.has(w));
  if (textHasTheme && strainWords.size && textCarriesStrain.length === 0) {
    return {
      inverted: true, held: false,
      claims: [{ sentence: text.trim().slice(0, 200), ref: null, because: "the text names the theme but carries none of the material's own commitment about it" }],
      basis: `the text names the theme and shares none of the material's ${strainWords.size} distinctive words (${[...strainWords].slice(0, 5).join(", ")}…) — an inversion, read as a relation, never a word`,
    };
  }
  if (textCarriesStrain.length) {
    return { inverted: false, held: true, claims: [{ sentence: text.trim().slice(0, 200), ref: null, because: "carries the material's distinctive words" }], basis: `the text carries ${textCarriesStrain.length} of the material's distinctive words — it holds the material's commitment` };
  }
  return { inverted: false, held: false, claims: [], basis: "the text shares nothing to compare with the material's commitment" };
}

/**
 * readStance(text, holon, { level }) -> { stance, sign, level, shape, ground, strain, failures[], basis }
 *
 *   stance ∈ { "in_terms", "against", "off_being", "unnamed" } — the FOUR
 *     readings, never the 9 acts.
 *   sign   +1 faithful (in_terms), -1 inverted (against), 0 gap (off_being/unnamed)
 *   level  whole | section | sentence — the holonic level; the general recurses.
 *   shape  the holonicSatisfaction result at the level
 *   ground the satisfactionOfSection result (grounding into the material)
 *   strain the carriesStrain result (the material's distinctive words, tied)
 *
 * `holon` = { ground, referents, theme?, material?, passages? }. Organs injected
 * (cast.js pattern) so a caller may pass its own readers.
 */
export function readStance(text, holon = {}, { level = "whole" } = {}) {
  const lvl = LEVELS.includes(level) ? level : "whole";
  const theme = holon.theme ?? "";
  const material = holon.material ?? holon.ground ?? "";
  const t = String(text ?? "");

  // 1. SHAPE at the level (required, not sufficient).
  const shape = holonicSatisfaction(t, { level: lvl, theme, material, role: lvl === "whole" ? "whole" : "sentence" });
  if (!shape.ok) {
    return { stance: "unnamed", sign: 0, level: lvl, shape, ground: null, strain: null, failures: shape.failures, basis: "the text is not shaped as a holon at this level — no stance is legible" };
  }

  // 2. GROUNDED in THIS material's own facts.
  const ground = satisfactionOfSection(t, { theme, material, isFirst: false, prior: "" });
  const ungrounded = (ground.failures ?? []).some((f) => f.kind === "ungrounded");

  // 3. STRAIN_CARRIED, tied to the being.
  const strain = carriesStrain(t, { theme, ground: material, referents: holon.referents ?? null });

  // 4. SIGN, derived from the material's own copula relations.
  const signs = stanceSigns(t, { ground: material, theme, passages: holon.passages ?? null });

  const failures = [];
  // THE DECISION TABLE.
  if (ungrounded || !strain.tied) {
    // theme word only, or not grounded — the inverted-fabrication shape.
    if (ungrounded) failures.push({ kind: "off_being", detail: "the text lands outside the material's own facts (ungrounded)" });
    if (!strain.tied) failures.push({ kind: "off_being", detail: "the material's distinctive words do not attach to the being the theme names" });
    return { stance: "off_being", sign: 0, level: lvl, shape, ground, strain, signs, failures, basis: `shaped, but ${ungrounded ? "not grounded in the material" : "its strain is not tied to the theme's being"} — a holon landing in a different conclusion` };
  }
  if (signs.sign === -1) {
    return { stance: "against", sign: -1, level: lvl, shape, ground, strain, signs, failures: [{ kind: "against", detail: signs.basis }], basis: "the text states the material's subject under an inverted complement (a relation, not a word)" };
  }
  // grounded, tied, and not inverted → in_terms (a shared claim, or a faithful
  // restatement that carries the material's own commitment).
  return { stance: "in_terms", sign: +1, level: lvl, shape, ground, strain, signs, failures: [], basis: `shaped, grounded, and carries the material's own commitment, tied to the theme's being${signs.sign === 1 ? " (a shared copula claim)" : ""}` };
}

/** levelStance(text, holon) -> the three parts at whole/section/sentence, the
 *  general recursing: a whole that is in_terms has all parts in_terms; one
 *  off_being part makes the whole off_being (S4 monotonicity). */
export function levelStance(text, holon = {}) {
  const whole = readStance(text, holon, { level: "whole" });
  const sections = splitSentences(String(text ?? "")).map((s) => readStance(typeof s === "string" ? s : s.text, holon, { level: "sentence" }));
  // the general recurses: the whole's stance is bounded by its worst part.
  const parts = sections;
  const anyOff = parts.some((p) => p.stance === "off_being" || p.stance === "unnamed");
  const anyAgainst = parts.some((p) => p.stance === "against");
  let stance = whole.stance;
  if (anyOff) stance = "off_being";
  else if (anyAgainst) stance = "against";
  return { whole, parts, stance, sign: stance === "in_terms" ? 1 : stance === "against" ? -1 : 0 };
}

/** The 9 acts available at a level (kernel/cube.js STANCE_BY_MODE), carried as
 *  the LABEL, never the valence. */
export function stanceActs() { return STANCE_BY_MODE ?? null; }

// ── THE MINIMAL RELATION API (kept; the whole tree consumes it) ──────────────
// `claimRelations`/`stanceOf`/`stanceEvidence` are the SAME relation-derived,
// lexicon-free read the file already carried — a candidate clause vs a material,
// signed by the material's own copula relations. `readStance` above is the full
// join (shape ∧ ground ∧ strain-tied-to-being) for a LEVEL; these stay for
// callers that only need the sign, byte-compatible with every existing consumer.
const normTokens = (t) => String(t ?? "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.map((w) => w.replace(/['’]s$/, "")) ?? [];

/** claimRelations(candidate, passages) -> { held, inverted, open, heldClaims,
 *  invertedClaims, basis }. Which material copula-claims the candidate holds,
 *  which it inverts. Pure; no lexicon. */
export function claimRelations(candidate, passages, { splitSentences: split = splitSentences, sameForm = null } = {}) {
  const parts = splitAtCopula(String(candidate ?? ""));
  if (!parts) return { held: 0, inverted: 0, open: 0, heldClaims: [], invertedClaims: [], basis: "the candidate carries no copula — no claim to compare" };
  const subj = normTokens(parts.subject), comp = normTokens(parts.complement);
  const held = [], inverted = [], open = [];
  for (const p of passages ?? []) {
    for (const s0 of split(String(p.text ?? ""))) {
      const s = typeof s0 === "string" ? s0 : s0.text;
      const sp = splitAtCopula(s);
      if (!sp) continue;
      const ssubj = normTokens(sp.subject), scomp = normTokens(sp.complement);
      const sameSubj = subj.length && subj.every((w) => ssubj.includes(w));
      if (!sameSubj) continue;
      const sameComp = comp.length && comp.every((w) => scomp.includes(w));
      if (sameComp) held.push({ ref: p.ref ?? null, sentence: s.trim() });
      else if (isContrast(sp)) inverted.push({ ref: p.ref ?? null, sentence: s.trim() });
      else open.push({ ref: p.ref ?? null, sentence: s.trim() });
    }
  }
  const basis = `${held.length} held, ${inverted.length} inverted, ${open.length} open (same subject, other complement)`;
  return { held: held.length, inverted: inverted.length, open: open.length, heldClaims: held, invertedClaims: inverted, basis };
}

/** Contrast is read from the material's own frame, not a word list: a
 *  complement under a negation between the subject and it. The negation prior
 *  is the ADAPTER's. */
function isContrast(sp) {
  const between = String(sp.subject ?? "") + " " + String(sp.copula ?? "") + " " + String(sp.complement ?? "").split(/\s+/).slice(0, 6).join(" ");
  return normTokens(between).some((w) => NEGATION_WORDS.has(w));
}

/** stanceOf(candidate, passages) -> -1 | 0 | +1, DERIVED from the claim
 *  relation, never a lexicon. +1 holds the material's claims; -1 inverts them;
 *  0 when nothing is shared (a gap). */
export function stanceOf(candidate, passages = []) {
  const r = claimRelations(candidate, passages);
  if (!r.held && !r.inverted) return 0;
  return r.inverted > r.held ? -1 : r.inverted < r.held ? 1 : 0;
}

/** stanceEvidence(candidate, passages) -> the claims that carried the sign. */
export function stanceEvidence(candidate, passages = []) {
  const r = claimRelations(candidate, passages);
  return { sign: stanceOf(candidate, passages), held: r.heldClaims ?? [], inverted: r.invertedClaims ?? [], basis: r.basis };
}

export { holonicSatisfaction, satisfactionOfSection };

// ── THE ENGLISH EVALUATIVE LENS (one giver, the adapter's own grammar) ─────
// A text carries a STANCE — the evaluation it puts on what it names: good/bad,
// warranted/overreach, success/failure. THIS lens reads that evaluation from
// English's own stance words. It is a LENS, never the kernel: a language's
// stance markers are that language's own (a negative stance in English is often
// a suffix or a particle elsewhere). Swap this file and the judgment is
// unchanged — the material still states an evaluation; only how English words it
// is this file's. It classifies STANCE, not content; every caller must carry the
// giver beside any finding. Distinct from `stanceOf(candidate, passages)`
// (claim relations): the lens is the WORD reading, the organ is the DISCOURSE
// reading — a text can hold a claim it words negatively.
const LENS_POS = /\b(good|best|better|warranted|justified|support(?:s|ed)?|effective(?:ness)?|reasonable|sensible|targeted|necessary|needed|solved?|improve(?:s|d)?|improvement|safe|safety|benefit(?:s|ed|ial)?|recommend(?:s|ed|ation)?|valuable|worthwhile|smart|common sense|success(?:ful|es)?|fairness|fair|progress|helpful|achievement|triumph|praise(?:s|d)?|commend(?:s|ed)?|excellent|positive|right(?:ly)?)\b/i;
const LENS_NEG = /\b(overreach|unnecessary|waste(?:ful|s)?|problem(?:s|atic)?|harm(?:s|ed|ful)?|danger(?:ous|s)?|bad|fail(?:s|ed|ure|ures)?|broken|boondoggle|whin(?:e|es|ing|y)|wrong|risk(?:s|y)?|costly|excessive|unwarranted|fraud(?:ulent)?|dismiss(?:es|ed|ive)?|affront|silly|nonsense|threat(?:s|ening)?|burden(?:s|some)?|illegitimate|abuse(?:s|d)?|corrupt(?:ion)?|detriment(?:al)?|unfair|injustic(?:e|es)|loss(?:es)?|suffer(?:s|ed|ing)?|harsh(?:ly)?|cruel|oppress(?:ion|ive|ed)?|punish(?:ment|ed|ing)?|coerc(?:ion|ive|ed)?|exploit(?:ation|ed|ative)?)\b/i;

/** stanceWords(text) -> { pos, neg, of } — the LENS evidence, so a finding can
 *  cite the words that carried the stance, never just the sign. `of` is the
 *  sign on the lens: +1 evaluatively positive, -1 negative, 0 neutral. A word
 *  that is a bare fact is not a stance word; the lexicon is deliberate,
 *  recorded, and never a content classifier. */
export function stanceWords(text) {
  const t = String(text ?? "");
  const pos = t.match(new RegExp(LENS_POS.source, "gi")) || [];
  const neg = t.match(new RegExp(LENS_NEG.source, "gi")) || [];
  return { pos, neg, of: Math.sign(pos.length - neg.length) };
}

/** stanceLens(text) -> +1 | -1 | 0 on the English evaluative lens (the sign of
 *  stanceWords). Kept as its own name so `stanceOf(candidate, passages)` — the
 *  DISCOURSE organ — never collides with the WORD lens. */
export function stanceLens(text) { return stanceWords(text).of; }
