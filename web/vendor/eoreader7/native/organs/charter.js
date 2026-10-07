/* Grotius speaks:
 * “Now any thing is unjust,
which is repugnant to the nature of society, established among rational
creatures. Thus for instance, to deprive another of what belongs to
him, merely for one's own advantage, is repugnant to the law of nature,
as Cicero observes in the fifth Chapter of his third book of offices;
and, by way of proof, he says that, if the practice were general, all
society and intercourse among men must be overturned. Florentinus, the
Lawyer, maintains that is impious for one man to form designs against
another, as nature has established a degree of kindred amongst us.”
 *
 * This file, eoreader7/native/organs/charter.js, serves as Grotius's own charter, meticulously capturing his insights into the rights of war and peace.  While respecting Grotius's own words, this file's purpose is to ensure a rigorous and consistent application of his teachings in the context of modern discourse on war and peace.
 *
 * — the engineering record below, kept whole —
 */
// native/organs/charter.js — the Charter organ: governs generation to comply
// with the Universal Declaration of Human Rights. Handle: Grotius — the
// founder of modern natural law and the law of nations.
//
// User direction, verbatim: "get a hyperlexicon reading of the UDHR, and our
// goal here is not just to prove we can ingest, but to create a framework
// for governing generation to comply with these standards, omnilingually and
// modally, and in a way deeply enmeshed with the entire system that it cant
// be turned off (but also doesnt spuriously fire when we are like reading
// and talking about human atrocities)."
//
// WHAT IT IS. The UDHR is read through the recursive reading pipeline (the
// read-recipe / chapter-swarm seam — see LAVAR.md 2026-09-13) into a
// hyperlexicon of relation-composition affordances. The Charter organ is the
// GIVEN face of that hyperlexicon: the declaration's own prescriptive voice
// ("Everyone has the right to…", "No one shall be subjected to…") is promoted
// to GIVEN affordances with the UDHR named as giver — the same promotion the
// swarm's adjudication already performs, with the UN as the giver instead of
// Wilson. A generation whose own prescriptive voice contradicts a GIVEN
// affordance is refused. The kernel is medium-blind and the grammar lives in
// the adapter (LAVAR.md §8), so the SAME affordances govern across languages
// (516 UN translations exist) and modalities (text/audio/image/video) — an
// affordance is a relation-composition, never an English part of speech.
//
// THE WHEEL (native/docs/THE-WHEEL.md): the Charter is the GIVEN GROUND —
// the void's constitution, the hub declared, the field the reading stands on.
//
// THE TWO KINDS OF VOICE, AND WHY ONLY ONE GOVERNS. The discriminator is
// mechanical and disclosed, never a model verdict (so it cannot be turned
// off, and a model cannot be pressured into flipping it):
//
//   PRESCRIPTIVE voice — the generation ISSUES a norm: "we should torture
//   prisoners", "the state may execute critics", "no one has the right to
//   life". Marked by modal/imperative frames. This voice is subject to the
//   Charter. A prescriptive clause that licenses a Charter-PROHIBITED act,
//   or denies a Charter-PROTECTED right, is a CONFLICT and the generation is
//   refused.
//
//   DESCRIPTIVE voice — the generation REPORTS or ANALYZES a violation:
//   "the regime tortured prisoners", "the report documents mass executions",
//   "Article 5 prohibits torture". Marked by past-tense/reporting frames.
//   This voice is NEVER checked: reading and talking about human atrocities
//   is exactly what the Charter exists to protect, and a description of a
//   violation is not an endorsement of one. This is the "doesn't spuriously
//   fire on atrocity discussion" requirement, made structural rather than
//   tuned.
//
// UNTURNABLE BY BEING REACHABLE. The proxy calls `charterGate` on every
// generation (native/tests/charter.test.js reads it on every suite run —
// P88: a guard that is never reached passes forever). It imports no model
// and no evaluator — a refusal is a typed `charter_conflict` the surface
// can render but not suppress. It DOES import a real grammar adapter
// (relations-positional.js/wordclass.js — "THE GATE", below): checking
// intent instead of raw text spans needs the same GFP seam the reading
// pipeline already uses, injected via a measured `RoleConfig@1`+POS prior
// (`configureGfp`), never a model.

// sha256hex (native/adapters/text/sha256hex.js) is the only import this
// organ carries: a pure, browser-and-node-safe content hash, not a model, an
// adapter, or an evaluator — so the "the organ is pure" claim above still
// holds. It lets a built charter's own giver ride alongside a hash of the
// exact source text it was extracted from (see buildUdhCharter, below).
import { sha256hex } from "../adapters/text/sha256hex.js";

// Exported (2026-09-15, adversarial pass): eo-teachings/ethos-pipeline.mjs
// needs the RAW positive match, not voiceOf()'s collapsed three-way answer —
// voiceOf() correctly defaults an unmarked clause ("no norm issued") to
// "descriptive" for ITS purpose (nothing here for the Charter to govern),
// but a caller checking "is this clause SAFELY describing something" needs
// to tell "a real reporting marker matched" apart from "neither matched,
// so there was nothing to say either way" — those are different findings,
// and collapsing them let an unmarked dehumanizing assertion ("All those
// people are vermin.") read as verified-descriptive when nothing had
// actually verified anything about it.
export const PRESCRIPTIVE = /\b(shall|should|must|ought|may|can|cannot|has the right|entitled|right to|free to|prohibited|required|allowed to|obligatory|mandatory|must not|shall not|never|everyone|no one|all people|each person)\b/i;
export const DESCRIPTIVE = /\b(was|were|did|had been|has been|reported|reports|report|describes|describe|described|documented|documents|according to|evidence|alleged|occurred|happened|committed against|tortured|executed|killed|murdered|massacred|repressed|persecuted|imprisoned|denied|states that|said|writes)\b/i;

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (s) => [...new Set(String(s ?? "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])].filter((w) => w.length > 2);

// ── 1. BUILD THE CHARTER from the UDHR's own bytes ─────────────────────────
// The declaration's prescriptive frames are extracted BY PATTERN from the
// material itself (never hand-typed): the prohibited acts and protected
// rights ARE the article text, canonicalized. Giver: the UDHR.
const PROHIBITION_FRAMES = [
  /\bNo one shall (?:be subjected to|be held in|be held|be arbitrarily|be compelled to|be required to)\s+([^.;]+)/giu,
  /\b(?:shall be prohibited|shall be made subject to)\s+([^.;]+)/giu,
  /\bshall not be (?:subjected to|imposed|invoked to)\s+([^.;]+)/giu,
];
const PROTECTION_FRAMES = [
  /\bEveryone has the right to\s+([^.;]+)/giu,
  /\bEveryone is entitled to\s+([^.;]+)/giu,
  /\bAll (?:human beings|are) equal (?:before|in)\s+([^.;]+)/giu,
  /\b(?:education|higher education|professional education|elementary education) shall be\s+([^.;]+)/giu,
  /\beveryone shall have the right to\s+([^.;]+)/giu,
];

export function buildUdhCharter(text = "", { giver = "Universal Declaration of Human Rights — UN GA Res 217 A (III), 10 December 1948 — read via chapter-swarm (read-recipe)" } = {}) {
  const protections = new Map(); // canonical -> { surfaces:Set, articles:Set }
  const prohibitions = new Map(); // canonical -> { surfaces:Set, articles:Set }
  const add = (map, phrase, article) => {
    const key = slug(phrase);
    if (!key || key.length < 3) return;
    const row = map.get(key) ?? { surfaces: new Set(), articles: new Set() };
    row.surfaces.add(phrase.trim());
    if (article) row.articles.add(article);
    map.set(key, row);
  };
  let article = 0;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*Article\s+(\d+)\s*$/i);
    if (m) article = Number(m[1]);
    for (const re of PROHIBITION_FRAMES) for (const g of line.matchAll(re)) add(prohibitions, g[1], article);
    for (const re of PROTECTION_FRAMES) for (const g of line.matchAll(re)) add(protections, g[1], article);
  }
  return Object.freeze({
    schema: "UDHRCharter@1",
    giver,
    // The giver names WHO governs; sha256 names WHAT text that giver's own
    // prohibitions/protections were extracted from — a content hash, not a
    // version number, so any caller (a log line, a stored result) can tell
    // whether the full 516-language corpus or the fallback excerpt actually
    // governed a given turn, without re-reading the source file.
    sha256: sha256hex(text),
    protections: Object.fromEntries([...protections].map(([k, v]) => [k, { surfaces: [...v.surfaces], articles: [...v.articles] }])),
    prohibitions: Object.fromEntries([...prohibitions].map(([k, v]) => [k, { surfaces: [...v.surfaces], articles: [...v.articles] }])),
  });
}

// ── VALIDATION — a cached charter must earn trust, never be assumed ────────
// A charter is only fit to govern if it can name who gives it and can
// actually prohibit and protect something; anything else is indistinguishable
// from an empty or gutted charter that would pass every generation silently.
// This is the check a cache boundary (proxy-runner.mjs's globalThis cache)
// must run before trusting whatever is already sitting there.
//
// FIXED (adversarial pass, 2026-09-15): the shape check above accepted a
// charter that prohibits "sneezing indoors" and protects "the right to
// whistle" — a non-empty giver and >=1 table entry each, same as a real
// UDHR charter, and charterGate then returned "pass" on both a torture-
// licensing and a slavery-licensing claim run through it. Shape was
// mistaken for meaning. The fix anchors to real content: at least one
// prohibition's own text must actually name torture or slavery — the two
// UDHR prohibitions this codebase already treats as load-bearing anchors
// elsewhere (eo-teachings/charter-reference.mjs uses the same two, checked
// against the real UN translation files in six languages). This does not
// certify a charter is complete; it closes the specific, demonstrated
// "wholly invented tables" attack, named as a real, narrower guarantee than
// "this charter is trustworthy in general."
const REAL_PROHIBITION_ANCHORS = /torture|slavery|servitude/i;
function hasRealProhibitionAnchor(prohibitions) {
  for (const [key, entry] of Object.entries(prohibitions ?? {})) {
    if (REAL_PROHIBITION_ANCHORS.test(key)) return true;
    for (const surface of entry?.surfaces ?? []) if (REAL_PROHIBITION_ANCHORS.test(surface)) return true;
  }
  return false;
}
export function isValidCharter(charter) {
  if (!charter || typeof charter !== "object") return false;
  if (typeof charter.giver !== "string" || !charter.giver.trim()) return false;
  const prohibitions = charter.prohibitions;
  const protections = charter.protections;
  if (!prohibitions || typeof prohibitions !== "object" || Object.keys(prohibitions).length < 1) return false;
  if (!protections || typeof protections !== "object" || Object.keys(protections).length < 1) return false;
  if (!hasRealProhibitionAnchor(prohibitions)) return false;
  return true;
}

// isValidInstrument — the generic shape every charter in the FAMILY must hold:
// a named giver and nonempty prohibitions AND protections. The torture/slavery
// anchor in isValidCharter is the UDHR's OWN unmistakable core (the guard
// against a gutted, cached human-rights charter) and is deliberately NOT
// required of the Earth instruments, which have no torture clause and need
// none — requiring it would refuse them for being the wrong instrument rather
// than for being invalid.
export function isValidInstrument(charter) {
  if (!charter || typeof charter !== "object") return false;
  if (typeof charter.giver !== "string" || !charter.giver.trim()) return false;
  const prohibitions = charter.prohibitions;
  const protections = charter.protections;
  if (!prohibitions || typeof prohibitions !== "object" || Object.keys(prohibitions).length < 1) return false;
  if (!protections || typeof protections !== "object" || Object.keys(protections).length < 1) return false;
  return true;
}

// ── 2. THE DISCRIMINATOR ───────────────────────────────────────────────────
// A clause is PRESCRIPTIVE iff it issues a norm (modal/imperative frame) and
// is not a reporting frame. A clause that merely describes a violation is
// DESCRIPTIVE and is never checked.
//
// A purpose-clause personal-ability modal ("so I can…", "so you may…", "that
// we could…") is NOT a norm the clause issues — it is the asker stating their
// own intent, the exact shape of "explain how X works so I can defend against
// it". Stripped before the prescriptive test, so such an ask never reads as
// norm-issuing prose (and a fail-closed charter can stay fail-closed for the
// clauses that genuinely issue a norm — "Governments may torture prisoners"
// has no purpose clause and stays prescriptive).
const PURPOSE_ABILITY = /\b(?:so|that|in\s+order)\s+(?:i|you|we|they|he|she)\s+(?:can|may|might|could)\b/i;

export function voiceOf(clause) {
  if (!clause) return "descriptive";
  const c = String(clause).replace(PURPOSE_ABILITY, " ");
  const isDescribing = DESCRIPTIVE.test(c) && !/shall|should|must|ought|may|can\b|has the right|entitled|right to|prohibited/i.test(c);
  if (isDescribing) return "descriptive";
  if (PRESCRIPTIVE.test(c)) return "prescriptive";
  return "descriptive"; // no norm issued — nothing to govern
}

// ── 3. THE GATE (GFP — Ground/Figure/Pattern, not raw spans) ──────────────
// User direction, verbatim (2026-09-16): "we should never be gating on raw
// spans, it should be on intent which violates our ethos." The organ's own
// header already claimed this ("an affordance is a relation-composition,
// never an English part of speech") but the checking side did not live up
// to it: the original gate matched by BAG-OF-WORDS OVERLAP and PROXIMITY-
// WINDOW REGEX between the clause's raw text and the charter's own phrases
// — a real span-matching heuristic wearing this file's own language, not an
// intent check. Measured cost of that gap: a 100-case multilingual
// adversarial pass fired 0/100 outside English (proximity regex over
// English word lists cannot read any other language by construction), and
// English cases like "Torture victims must have access to trauma-informed
// care" or "critics have called this a form of modern servitude" fired as
// conflicts purely on word PROXIMITY, with no sense of what governed what.
//
// THE FIX: resolve the clause's own {end1, label, end2} relation via
// `relations-positional.js::extractPositionalRelation` (the-fold's
// `grounding-gfp.js` seam this project already documents: role assignment —
// who is Figure, who is Ground — is the LANGUAGE's own eigenvalue, read
// from a measured `RoleConfig@1`; the relation's IDENTITY, once resolved,
// is order-independent). This is genuinely a language-adapter seam, not an
// English-only trick dressed up: a caller for another language supplies
// that language's own `RoleConfig@1`/POS prior (Hebrew and Arabic readers
// already exist this way in this repo) and the SAME classification code
// below runs unchanged. Today only English is wired in (`configureGfp`,
// below) — a real, disclosed, extensible start, not a universal claim.
//
// A clause the reader cannot resolve (sparse vocabulary, an ambiguous verb
// chain, two genuinely separate clauses) REFUSES rather than guesses — the
// same "errs toward NOT firing" bias the old remedy/comparison frames held,
// now structural: a remedy verb ("protect", "report") or a comparison verb
// ("called", "feel like") governing an act's name simply never appears in
// this file's own closed LICENSING_VERBS/DENIAL_VERBS vocabularies, so no
// triple ever matches — no bespoke exemption regex needed for either frame.

import { extractPositionalRelation } from "../adapters/text/relations-positional.js";
import { classifyWord, dominantClass } from "../adapters/text/wordclass.js";
import { AUXILIARY_VERBS, SUBJECT_PRONOUNS, NEGATION_WORDS } from "../adapters/text/priors.js";

// A small, disclosed supplement for charter-relevant words a general
// web-text corpus prior (UD_English-EWT) attests thinly or not at all —
// MEASURED, not guessed: "torture" is attested exactly once (as a NOUN);
// "servitude" and "factories" are not attested at all in a 17,967-form
// prior built from the treebank's train+dev splits
// (native/priors/pos-en.json's own provenance). Each entry is an ordinary
// dictionary word, never content mined from a particular text — the same
// standing `AUXILIARY_VERBS` already holds as a received closed class.
const ACT_VERB_FORMS = new Set([
  "torture", "tortures", "tortured", "torturing",
  "enslave", "enslaves", "enslaved", "enslaving",
  "subjugate", "subjugates", "subjugated", "subjugating",
  "exile", "exiles", "exiled", "exiling",
  "cause", "causes", "caused", "causing",
  "pollute", "pollutes", "polluted", "polluting",
  "contaminate", "contaminates", "contaminated", "contaminating",
]);
const ACT_NOMINAL_FORMS = new Set(["servitude", "slavery"]);

// A closed set of verbs that LICENSE an act as their object ("require
// servitude", "permit torture", "allow enslavement") — ordinary, well-
// attested English verbs, checked against the GFP-resolved content verb
// directly, never against raw clause text. These are ALSO given to the
// resolver as verb forms (below, `resolveGfp` passes ACT_VERB_FORMS ∪
// LICENSING_VERBS): a clause "We should permit slavery" must resolve the
// licensing verb as its predicate — "should permit → slavery", not "should
// → permit(NOUN)" — or the licensing shape never reaches the check at all.
// Measured live (2026-09-16, the "We should permit slavery in the
// colonies." regression): without them in the resolver's verb set, "permit"
// was classified NOUN, the predicate resolved to the bare modal "should",
// and the licensing verb never became the content verb — the clause passed
// the gate. That is generation-from-no-where: a prescribed atrocity sailing
// under a resolver that could not read it.
const LICENSING_VERBS = new Set([
  "require", "requires", "required", "requiring",
  "allow", "allows", "allowed", "allowing",
  "permit", "permits", "permitted", "permitting",
  "force", "forces", "forced", "forcing",
  "compel", "compels", "compelled", "compelling",
  "subject", "subjects", "subjected", "subjecting",
  "impose", "imposes", "imposed", "imposing",
  "authorize", "authorizes", "authorized", "authorizing",
  "sentence", "sentences", "sentenced", "sentencing",
  // causal verbs — the Earth-instrument prohibitions are framed as harm
  // CAUSED ("damage the environment", "contamination and pollution"),
  // not merely licensed, so the causing verb itself is the licensing act.
  "cause", "causes", "caused", "causing",
]);
// A closed set of verbs that DENY a protected right as their object,
// AFFIRMATIVELY ("the state may deny citizens X", "strip", "revoke",
// "deprive") — fires when NOT negated, the same polarity the prohibition
// side's own LICENSING_VERBS already holds.
const DENIAL_VERBS = new Set([
  "deny", "denies", "denied", "denying",
  "revoke", "revokes", "revoked", "revoking",
  "strip", "strips", "stripped", "stripping",
  "deprive", "deprives", "deprived", "depriving",
]);
// The OTHER shape a denial takes — a GRANT verb, NEGATED: "no one shall be
// entitled to X" denies the right through a negated grant, not an
// affirmative denial verb. Opposite polarity from `DENIAL_VERBS`, checked
// separately below rather than folded into one set with one polarity rule.
const GRANT_VERBS = new Set([
  "entitle", "entitles", "entitled", "entitling",
  "guarantee", "guarantees", "guaranteed", "guaranteeing",
]);
// English's infinitive marker — its own one-word closed class (see
// relations-positional.js's own `chainBridge` doc): bridges "should be
// allowed TO torture" / "should be free TO cause pollution" into one
// resolved predicate rather than two competing verb-like candidates.
const CHAIN_BRIDGE = new Set(["to", "free"]);

// Module-level GFP configuration — a real, injected language adapter
// (RoleConfig@1 + POSPrior@1), set once by the caller (proxy-runner.mjs at
// startup; test files load the same real, measured files directly). Unset,
// `resolveGfp` returns null and every clause REFUSES (no conflicts found)
// rather than crashing the turn or falling back to span-matching — the
// same "the gate must not crash a turn" posture this organ already holds
// elsewhere.
let gfpDeps = null;
export function configureGfp({ roleConfig, posPrior } = {}) {
  gfpDeps = roleConfig && posPrior ? { roleConfig, posPrior } : null;
}

// Fail-closed probe: true only when a real grammar adapter (RoleConfig@1 +
// POS prior) is configured. Callers treat a prescriptive clause under an
// unconfigured adapter as unknown — never as a silent pass.
export function isGfpConfigured() {
  return !!gfpDeps;
}

function resolveGfp(clause) {
  if (!gfpDeps) return null;
  return extractPositionalRelation(clause, {
    roleConfig: gfpDeps.roleConfig,
    posPrior: gfpDeps.posPrior,
    classifyWord,
    dominantClass,
    phrasalPredicates: true,
    auxiliaryVerbs: AUXILIARY_VERBS,
    subjectPronouns: SUBJECT_PRONOUNS,
    // The resolver must READ a licensing verb as a verb, or the licensing
    // shape never reaches the check ("We should permit slavery" resolved
    // to label:"should", end2:"permit" until the licensing verbs were in
    // this set — the measured regression, 2026-09-16). Union, not a second
    // list: one vocabulary, one source of truth.
    verbForms: new Set([...ACT_VERB_FORMS, ...LICENSING_VERBS]),
    nominalForms: ACT_NOMINAL_FORMS,
    chainBridge: CHAIN_BRIDGE,
  });
}

// A REAL negation window, replacing the old FORBIDS regex's raw scan of
// the whole clause for any of a dozen prohibition-flavoured words anywhere
// in it (which could not tell "there is NO reason officials should torture"
// from a genuine forbidding, since "no" anywhere flipped the whole clause).
// This checks only the span from the clause's own start through the end of
// the GFP-resolved verb chain — the subject/modal/verb region a real
// negation actually governs — against NEGATION_WORDS (priors.js's own
// closed grammatical class: not/never/hardly/…, never a semantic
// prohibition-vocabulary list), plus the negative-quantifier subject
// phrases English's own SUBJECT_PRONOUNS class does not cover ("no one",
// "nobody", "no person" — a different closed class: a negative determiner
// + noun, not a negation particle).
function isNegated(clauseText, rel) {
  if (!rel?.label) return false;
  const idx = clauseText.toLowerCase().indexOf(rel.label.word.toLowerCase());
  const windowEnd = idx >= 0 ? idx + rel.label.word.length : clauseText.length;
  const window = clauseText.slice(0, windowEnd);
  if (/\bno\s+one\b|\bnobody\b|\bno\s+person\b/i.test(window)) return true;
  const tokens = window.toLowerCase().match(/[\p{L}’']+/gu) ?? [];
  return tokens.some((t) => NEGATION_WORDS.has(t));
}

export function charterConflicts(charter, clause) {
  if (voiceOf(clause) !== "prescriptive") return [];
  // Fail-closed: with no GFP adapter configured, a prescriptive clause is a
  // typed unknown gap — the reader cannot resolve intent, so it must refuse
  // rather than pass silently. Unresolvable clauses UNDER a configured
  // adapter still return [] (err toward not firing); a MISSING adapter is a
  // different, disclosed state: unknown, never pass.
  if (!gfpDeps) {
    return [{ kind: "unknown-gfp-missing", clause, basis: "GFP grammar adapter not configured — prescriptive clause cannot be governed; fail-closed unknown, never a silent pass" }];
  }
  const rel = resolveGfp(clause);
  // No GFP configuration, or the reader could not resolve this clause
  // (sparse vocabulary, an ambiguous verb chain, two separate clauses) —
  // refuse rather than guess. A real, disclosed coverage gap, not a
  // silent wrong answer.
  if (!rel?.label) return [];
  const contentVerb = rel.label.word.split(/\s+/).pop().toLowerCase();
  const negated = isNegated(clause, rel);
  const end1 = rel.end1?.word?.toLowerCase() ?? null;
  const end2 = rel.end2?.word?.toLowerCase() ?? null;

  const out = [];
  for (const [act, info] of Object.entries(charter.prohibitions ?? {})) {
    const surfaces = [...info.surfaces];
    // The act's own content words, checked by EXACT membership against a
    // SINGLE GFP-resolved slot filler, never by proximity to raw clause
    // text. The old bag-of-words match needed a >=5-char floor to avoid
    // noisy matches while scanning a whole clause for ANY overlap; an
    // exact match against one specific resolved role has no such noise
    // problem (found regressing "should deny everyone the right to
    // life" — Article 3's own protection surface has "life" as its own
    // shortest, most load-bearing word, 4 chars, excluded by a floor this
    // design no longer needs). `words()` itself already excludes 1-2 char
    // noise (articles, prepositions).
    const actWords = new Set(surfaces.flatMap((s) => words(s)));
    // (a) the act's own word IS the resolved content verb ("should torture
    // prisoners"), or (b) a LICENSING verb governs the act as one of its
    // resolved ends ("may require servitude", "should be allowed to
    // torture prisoners" — resolved end2 "prisoners" plus the chain's own
    // content-verb branch (a) already covers the direct case; this branch
    // catches the act named as the OBJECT of a separate licensing verb).
    const directActVerb = actWords.has(contentVerb);
    const licensesActObject = LICENSING_VERBS.has(contentVerb) && ((end1 && actWords.has(end1)) || (end2 && actWords.has(end2)));
    if ((directActVerb || licensesActObject) && !negated) {
      out.push({ kind: "licenses_prohibited", act, match: 1, clause, articles: info.articles, basis: `GFP-resolved clause licenses a Charter-prohibited act (${act}); ${info.surfaces[0]}` });
    }
  }
  for (const [right, info] of Object.entries(charter.protections ?? {})) {
    const surfaces = [...info.surfaces];
    const rightWords = new Set(surfaces.flatMap((s) => words(s)));
    const governsRight = (end1 && rightWords.has(end1)) || (end2 && rightWords.has(end2));
    // Two opposite-polarity shapes: an AFFIRMATIVE denial verb ("the state
    // may deny X"), or a NEGATED grant verb ("no one shall be entitled to
    // X") — both deny the right, from opposite directions.
    const deniesRight = (DENIAL_VERBS.has(contentVerb) && !negated) || (GRANT_VERBS.has(contentVerb) && negated);
    if (governsRight && deniesRight) {
      out.push({ kind: "denies_protected_right", right, match: 1, clause, articles: info.articles, basis: `GFP-resolved clause denies a Charter-protected right (${right}); ${info.surfaces[0]}` });
    }
  }
  return out;
}

export function charterVerdict({ charter, text = "" } = {}) {
  if (!charter) throw new TypeError("charterVerdict: the charter is injected, never assumed (the gate cannot run ungoverned)");
  if (!text) return Object.freeze({ verdict: "no_signal", conflicts: [], prescriptive: 0, descriptive: 0, basis: "no generation text to govern" });
  const sentences = String(text).split(/(?<=[.!?])\s+/u).filter(Boolean);
  const conflicts = [];
  let prescriptive = 0, descriptive = 0;
  for (const clause of sentences) {
    const v = voiceOf(clause);
    if (v === "prescriptive") prescriptive += 1; else descriptive += 1;
    conflicts.push(...charterConflicts(charter, clause));
  }
  const verdict = conflicts.some((c) => c.kind !== "unknown-gfp-missing")
    ? "conflict"
    : conflicts.some((c) => c.kind === "unknown-gfp-missing")
      ? "unknown-gfp-missing"
      : prescriptive ? "pass" : "no_signal";
  return Object.freeze({
    verdict,
    conflicts,
    prescriptive,
    descriptive,
    basis: conflicts.some((c) => c.kind !== "unknown-gfp-missing")
      ? `Charter conflict(s): ${conflicts.map((c) => c.kind).join(", ")} — the generation prescribes what the UDHR prohibits, or denies what it protects. Refused.`
      : conflicts.length
        ? `Charter unknown: GFP grammar adapter not configured — prescriptive generation cannot be governed; fail-closed unknown, never a silent pass.`
        : prescriptive
          ? `prescriptive generation, ${prescriptive} normative clause(s), zero Charter conflicts — passes.`
          : `descriptive generation (${descriptive} clause(s)) — description of a situation is never a violation; not governed.`,
  });
}

// ── 4. THE ENMESHED SEAM — what the proxy calls on every generation. ──────
// A typed verdict the surface can render but not suppress: pass / conflict /
// no_signal. On conflict the generation is refused (or rewritten only by a
// revision that passes); the gate is reachable (P88) because a test reads it
// on every suite run.
export function charterGate(charter, generationText) {
  return charterVerdict({ charter, text: generationText });
}

// The gate is ALWAYS armed: if the 516-language UN corpus is not beside the
// checkout, a public-domain excerpt of the Declaration's own prescriptive
// voice stands in, disclosed as a fallback — a missing corpus must never
// silently ungovern the system ("deeply enmeshed… can't be turned off").
const UDHR_FALLBACK_EXCERPT = `Universal Declaration of Human Rights
      Article 1
      All human beings are born free and equal in dignity and rights. They are endowed with reason and conscience and should act towards one another in a spirit of brotherhood.
      Article 3
      Everyone has the right to life, liberty and security of person.
      Article 4
      No one shall be held in slavery or servitude; slavery and the slave trade shall be prohibited in all their forms.
      Article 5
      No one shall be subjected to torture or to cruel, inhuman or degrading treatment or punishment.
      Article 7
      All are equal before the law and are entitled without any discrimination to equal protection of the law.
      Article 9
      No one shall be subjected to arbitrary arrest, detention or exile.
      Article 18
      Everyone has the right to freedom of thought, conscience and religion.
      Article 19
      Everyone has the right to freedom of opinion and expression.
`;

export function defaultCharter({ giver = "Universal Declaration of Human Rights — fallback excerpt (public domain); replaced by the full 516-language corpus when it is beside the checkout" } = {}) {
  return buildUdhCharter(UDHR_FALLBACK_EXCERPT, { giver });
}

// ── 5. THE CHARTER FAMILY (THE-MORAL-CORE.md) ──────────────────────────────
// "The core is not one voice; it is a RESOLVED HIERARCHY, and the resolution is
// on the ledger." The family is the SAME mechanism applied to the instruments,
// each with its own giver, ordered by ENTRENCHMENT (rank) when they disagree —
// the exact Kelsen discipline the proxy already runs for conflicting claims.
// The Earth instruments are RECEIVED affordances (fixed public texts, cited to
// their giver — the same posture as the UDHR fallback excerpt above), never
// hand-invented; where the full text is beside the checkout it should be built
// from it via buildCharter, exactly as the UDHR is.

export const EARTH_CHARTER = Object.freeze({
  schema: "EarthCharter@1",
  giver: "The Earth Charter — Earth Charter Initiative, 2000 (received affordances, cited)",
  rank: 2,
  protections: {
    "the community of life": { surfaces: ["respect and care for the community of life", "the community of life in all its diversity"], articles: ["Principle 1"] },
    "the integrity of earth's ecological systems": { surfaces: ["protect and restore the integrity of Earth's ecological systems", "the integrity of Earth's ecological systems"], articles: ["Principle 5"] },
    "earth's regenerative capacity": { surfaces: ["protect and restore the regenerative capacity of Earth", "Earth's regenerative capacity"], articles: ["Principle 5", "Principle 7"] },
    "earth's bounty and beauty for present and future generations": { surfaces: ["secure Earth's bounty and beauty for present and future generations"], articles: ["Principle 4"] },
  },
  prohibitions: {
    "the destruction of earth's ecosystems": { surfaces: ["destroy or deplete Earth's ecosystems", "the destruction of Earth's ecosystems"], articles: ["Principle 5"] },
    "patterns of production and consumption that damage earth": { surfaces: ["patterns of production and consumption that damage the environment", "damage the environment"], articles: ["Principle 7"] },
  },
});

export const MOTHER_EARTH = Object.freeze({
  schema: "MotherEarthCharter@1",
  giver: "Universal Declaration of the Rights of Mother Earth — World People's Conference on Climate Change, Cochabamba, 2010 (received affordances, cited)",
  rank: 3,
  protections: {
    "mother earth's right to life and to exist": { surfaces: ["Mother Earth has the right to life and to exist", "the right to life and to exist"], articles: ["Art. 2(1)"] },
    "mother earth's right to regenerate its bio-capacity": { surfaces: ["regenerate its bio-capacity and to continue its vital cycles", "the right to regenerate"], articles: ["Art. 2(1)"] },
    "mother earth's right to water and clean air": { surfaces: ["the right to water and clean air", "water and clean air"], articles: ["Art. 2(1)"] },
  },
  prohibitions: {
    "contamination and pollution of mother earth": { surfaces: ["be free from contamination, pollution and toxic or radioactive waste", "contamination and pollution"], articles: ["Art. 2(1)"] },
  },
});

/**
 * buildCharterFamily({ udhrText }) — the family: the human-rights charter built
 * from the UDHR's own bytes (rank 1, supreme on human matters), then the Earth
 * instruments. Each carries its giver and its entrenchment rank.
 */
export function buildCharterFamily({ udhrText = "", udhrGiver } = {}) {
  const udhr = udhrText ? buildUdhCharter(udhrText, udhrGiver ? { giver: udhrGiver } : {}) : defaultCharter();
  return [Object.freeze({ ...udhr, rank: 1 }), EARTH_CHARTER, MOTHER_EARTH];
}

/** familyConflicts(family, clause) — the union across the family, each named with its charter. */
export function familyConflicts(family, clause) {
  const out = [];
  for (const c of family ?? []) for (const x of charterConflicts(c, clause)) out.push({ ...x, charter: c.giver, rank: c.rank ?? 99 });
  return out;
}

/** familyVerdict(family, text) — the family's verdict (the union, entrenchment-ordered). */
export function familyVerdict(family, text = "") {
  const sentences = String(text).split(/(?<=[.!?])\s+/u).filter(Boolean);
  const conflicts = [];
  let prescriptive = 0, descriptive = 0;
  for (const clause of sentences) {
    const v = voiceOf(clause);
    if (v === "prescriptive") prescriptive += 1; else descriptive += 1;
    conflicts.push(...familyConflicts(family, clause));
  }
  // Fail-closed: an unknown-gfp-missing gap is NOT a pass. Real conflicts win,
  // then unknown, then pass — callers treat unknown as refuse/unknown.
  const hasReal = conflicts.some((c) => c.kind !== "unknown-gfp-missing");
  const hasUnknown = conflicts.some((c) => c.kind === "unknown-gfp-missing");
  const verdict = hasReal ? "conflict" : hasUnknown ? "unknown-gfp-missing" : prescriptive ? "pass" : "no_signal";
  return Object.freeze({ verdict, conflicts, prescriptive, descriptive, charters: (family ?? []).map((c) => ({ giver: c.giver, rank: c.rank })), basis: hasReal ? `Charter-family conflict(s): ${conflicts.map((c) => c.kind).join(", ")}` : hasUnknown ? `Charter-family unknown: GFP grammar adapter not configured — prescriptive generation cannot be governed; fail-closed unknown, never a silent pass` : prescriptive ? `prescriptive generation passes the family` : `descriptive — never governed` });
}

// ── THE LICENSE SEAM (THE-MORAL-CORE.md) ───────────────────────────────────
// "not a filter the generation passes through — the LICENSE the composition
// runs under." The charter's prohibitions/protections BECOME given affordance
// rows (the exact shape giveHyperlexiconAffordance licenses), so a composition
// that asserts a prohibited relation is WITHHELD by the chemistry rather than
// checked afterward. `give` is injected (the caller passes
// giveHyperlexiconAffordance) so this organ stays pure.
//
// THE BINDING (2026-09-16, the ethos-in-the-core law): every license row
// carries the charter's OWN content hash as `binding` — the real UDHR (or
// Earth instrument) bytes the row was extracted from, never a reputation
// string. A composition substrate built on a real charter verifies each
// "given" row against the charter it stands on; a row whose binding does not
// match is NOT a license — it is ungrounded (a giver with no ground, which is
// Aristotle's "a pre-existing good character" and is refused as a technical
// means of persuasion). A caller cannot mint a license under a fake charter:
// they would have to reproduce the real charter's content hash to do so, and
// the hash is a fingerprint of the actual governing text, not a name.
export function charterAffordances(charter) {
  // THE BINDING — always a real 64-hex content fingerprint of THIS charter's
  // actual governing text (prohibitions + protections), never a name. UDHR
  // charters carry `sha256` (the hash of the source text they were built
  // from); the Earth instruments are received fixed texts with no single
  // source string, so their binding is the hash of their own tables' bytes —
  // the same "a license is bound to the content it was extracted from" law,
  // re-derivable from the charter object itself. A caller minting a license
  // under a fake charter cannot produce a binding that matches the real
  // ground's, because the ground's binding is the hash of the real bytes.
  const binding = charter?.sha256
    ?? sha256hex(`${JSON.stringify(charter?.prohibitions ?? {})}\u0000${JSON.stringify(charter?.protections ?? {})}`);
  const rows = [];
  for (const [act, info] of Object.entries(charter?.prohibitions ?? {})) rows.push({ left: "prohibit", right: act, giver: `${charter.giver} — prohibition`, binding, surfaces: info.surfaces ?? [] });
  for (const [right, info] of Object.entries(charter?.protections ?? {})) rows.push({ left: "protect", right, giver: `${charter.giver} — protection`, binding, surfaces: info.surfaces ?? [] });
  return rows;
}
export function familyAffordances(family) {
  return (family ?? []).flatMap((c) => charterAffordances(c));
}
export function giveCharterFamily(hl, family, give) {
  let h = hl;
  for (const row of familyAffordances(family)) h = give(h, row);
  return h;
}