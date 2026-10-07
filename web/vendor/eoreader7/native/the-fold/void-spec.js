// void-spec.js — THE SHAPE OF THE VOID, DECLARED ON EVERY LEVEL BEFORE A WORD
// IS DRAWN (2026-09-21).
//
// The user: "make sure that the void is extremely well defined on different
// levels … a certain type of verbiage depending on what type of essay it is, a
// certain arrangement of information depending on its type, certain lengths …
// these are all different harmonic levels of meaning, of structure, of
// grounding." And: "we should be able to do this as it is."
//
// An inventory of the engine found most of these levels already declared —
// scattered, and several never steering anything: the register's voice
// (kernel/register.js), the 27-cell question lattice (document-ledger.js
// voidCellsFor), the essay's thesis/body/return shape (checkEssayShape, which
// declares it but measures almost nothing), genre arcs in the fortune sidecar,
// Murch's rhythm (organs/pacing.js), and a nested nine-operator void per level
// (organs/void-holarchy.js) that only ever ran AFTER a piece was written. No
// target length was declared anywhere.
//
// This module composes them into ONE declaration, level by level — whole,
// part, sentence, and the two cross-cutting levels that run through all of
// them, VERBIAGE and GROUNDING — and gives every operator of every level a
// value AND a basis:
//
//   measured   — read off the material (its seams, its sentence lengths,
//                its rhythm, its beings)
//   asked      — the operator's own words (an explicit count and unit)
//   declared   — stated by a named organ of the engine, cited
//   unmeasured — nothing in the engine can state it yet; named, never faked
//
// It is handed to organs/void-holarchy.js, which reports each level as
// specified or under-specified, so every gap is visible. The archons measure
// the piece against these targets, and arrangement is scored against them.
// Nothing here calls a model.

import { pacingGrade } from "../organs/pacing.js";
import { voidHolarchy } from "../organs/void-holarchy.js";
import { deriveRegister, writeVoiceFor } from "../kernel/register.js";
import { voidCellsFor } from "./document-ledger.js";
import { drawnParts } from "./eot-draft.js";
import { detectFormReferentCue, resolveFormReferent, disambiguateFormReferent, FORM_REFERENT_CUES } from "./form-referent.js";
import { isFunctionWord } from "./pos-prior.js";

export const VOID_SPEC_SCHEMA = "EOVoidSpec@1";

const v = (value, basis, source) => ({ value, basis, source });

/** The word of the ask that names the FORM asked for — read off the ask's
 *  own grammar, never a table: the head noun of the phrase after the leading
 *  verb (whatever that verb is — "write", "wright", "rite"; it is never
 *  matched) and its article, up to the subject phrase (on/about/of/for).
 *  English puts the head noun last ("five-paragraph essay" → essay, "short
 *  story" → story). A token with no letters ("@") is skipped, so a garbled
 *  ask still yields its form-word ("rite @ whiteppr" → whiteppr) for SURF to
 *  go and resolve. null when the ask has no such phrase. */
// A leading count+unit modifier askedExtent() already captures separately
// ("five-paragraph", "3-section", "twelve-page") — stripped before the
// form-word is read so it is never duplicated between the two extractors.
// Declared once here and reused by askedExtent's own unit list, never a
// second hand-typed copy.
const COUNT_UNIT_RE = /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-](?:paragraphs?|sections?|parts?|pages?|words?|sentences?)$/i;

export function candidateFormToken(task) {
  // An anaphor is not a form-word ("write it again" names no form; "write
  // another sonnet like before" names one): the cues and the pronouns they
  // ride on are removed before the head noun is read.
  let t = String(task ?? "");
  for (const re of FORM_REFERENT_CUES) t = t.replace(new RegExp(re.source, "gi"), " ");
  t = t.replace(/\b(it|that|this|one|them|these|those)\b/gi, " ");
  let words = t.trim().split(/\s+/).filter(Boolean);
  if (words[0] && /^please$/i.test(words[0])) words = words.slice(1);
  words = words.slice(1);
  if (words[0] && /^(a|an|the|me|us)$/i.test(words[0])) words = words.slice(1);
  if (words[0] && /^(a|an|the)$/i.test(words[0])) words = words.slice(1);
  const stop = words.findIndex((w) => /^(on|about|of|for|from|regarding|concerning)$/i.test(w.replace(/[^a-z]/gi, "")));
  const phrase = stop === -1 ? words : words.slice(0, stop);
  let alpha = phrase.map((w) => w.replace(/[^a-z'-]/gi, "")).filter(Boolean);
  if (!alpha.length) return null;
  if (alpha[0] && COUNT_UNIT_RE.test(alpha[0])) alpha = alpha.slice(1);
  if (!alpha.length) return null;
  // The head noun ALONE loses a lexicalized compound's own genre ("white
  // paper" is not "a paper that is white"; this function has no general way
  // to tell that apart from a truly free modifier like "short" in "short
  // story" without a hand-typed compound list, which this project's own
  // discipline refuses). Keeping the one modifier immediately adjacent to
  // the head noun is never wrong for what a form-word is used for (an
  // exemplar search query, SURF's own "what is a ${token}") — at worst it is
  // slightly more specific than necessary; at best it is the difference
  // between resolving the actual form asked for and resolving a different
  // one. A modifier further back in a longer chain ("very long detailed
  // report") is dropped, since distant modifiers are far more often free
  // description than part of the form's own name.
  const head = alpha[alpha.length - 1].toLowerCase();
  const modCandidate = alpha.length >= 2 ? alpha[alpha.length - 2].toLowerCase() : null;
  // A determiner/quantifier/other function word ("another", "some", "any")
  // adjacent to the head noun is never part of the form's own name — the
  // prior's real POS class decides, never a hand-typed word list. A word
  // the prior has never seen is treated as a possible content word (kept),
  // since an unknown word being function-class is the less likely case.
  const mod = modCandidate && !isFunctionWord(modCandidate) ? modCandidate : null;
  return mod ? `${mod} ${head}` : head;
}

/**
 * declareForm(task, { documentsDir, excludeDocId }) → the form the ask points
 * at, with its basis — THE GATE AHEAD OF ANY SEARCH (user, 2026-09-22):
 *   1. an anaphor ("again", "the same", …) is a referent into this engine's
 *      own record: the field is read off the last piece's ledger — measured;
 *   2. else a received sign in kernel/register.js's table — declared (the
 *      table is a prior, never complete: "we dont want a set of shapes
 *      pre-set");
 *   3. else unmeasured, with the form-word carried so SURF can resolve it.
 * The register returned is the one the rest of the pipeline speaks in.
 */
export function declareForm(task, { documentsDir = null, excludeDocId = null, ref = null } = {}) {
  const cue = detectFormReferentCue(task);
  ref = ref ?? (cue && documentsDir ? resolveFormReferent(task, { documentsDir, excludeDocId }) : null);
  if (ref?.resolved?.field) {
    const register = deriveRegister(ref.resolved.prompt, { isFunctionWord });
    return {
      token: candidateFormToken(ref.resolved.prompt), cue, referent: ref.resolved, register, tier: ref.tier ?? null, votes: ref.votes ?? null,
      field: ref.resolved.field, basis: "measured", source: `form-referent.js: ${ref.basis}`,
    };
  }
  const token = candidateFormToken(task);
  const register = deriveRegister(task, { isFunctionWord });
  const field = register?.field?.field ?? null;
  if (field) {
    return { token, cue, referent: null, register, field, basis: register.field.provenance === "learned" ? "measured" : "declared", source: `kernel/register.js deriveRegister (${register.field.basis})` };
  }
  return {
    token, cue, referent: null, register, field: null, basis: "unmeasured",
    source: cue
      ? `an anaphor ("${cue}") with nothing to point at${documentsDir ? ` in ${documentsDir}` : " (no ledger directory given)"}`
      : `no anaphor, no received sign${token ? `: "${token}" is the form-word, unresolved — SURF must find what it names` : ": the ask names no form"}`,
  };
}
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/** The operator's own count, when the ask states one ("a five-paragraph
 *  essay", "in 3 sections", "about 500 words"). Asked, never inferred. */
export function askedExtent(task) {
  const t = String(task ?? "").toLowerCase();
  const m = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+(paragraphs?|sections?|parts?|pages?|words?|sentences?)\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  const unit = m[2].replace(/s$/, "");
  return { n, unit };
}

/** The topic of an ask: its words after the first "on", "about" or "of" that
 *  follows the verb, however many words describe the form in between ("a
 *  five-paragraph essay on …"). Measured failure: a one-word gap only, so the
 *  thesis voice was told to make a claim about "Write a five-paragraph essay". */
export function topicOf(task) {
  const t = String(task ?? "").trim();
  const m = t.match(/^\s*(?:please\s+)?(?:write|draft|compose|make|give me|produce|create)\b.*?\b(?:on|about|of)\s+(.+?)[.?!]*$/i);
  if (m) return m[1].trim() || null;
  // A bare form-ask ("write a sonnet") names a form and no subject. Measured
  // 2026-09-21: this returned the whole ask, verb included, and the void's
  // slot was declared [asked] "write a sonnet". No subject is null, stated.
  if (candidateFormToken(t) || detectFormReferentCue(t)) return null;
  return t.replace(/[.?!]+$/, "").trim() || null;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const sentenceWords = (s) => String(s).split(/\s+/).filter(Boolean).length;

/** declareForm with the ambiguity tier: when the mechanics narrow an anaphor
 *  to several prior asks, the mouth is asked one yes/no per candidate and
 *  licensed only when exactly one gets yes. No draw, or no ambiguity → no
 *  call, same result as declareForm. */
export async function declareFormAsync(task, { documentsDir = null, excludeDocId = null, draw = null } = {}) {
  const cue = detectFormReferentCue(task);
  let ref = cue && documentsDir ? resolveFormReferent(task, { documentsDir, excludeDocId }) : null;
  if (ref?.tier === "ambiguous" && draw) ref = await disambiguateFormReferent(ref, { draw, task });
  return declareForm(task, { documentsDir, excludeDocId, ref });
}

/**
 * declareVoidSpec({ task, ground, draft }) → EOVoidSpec@1
 * Requires the EOT draft (the material's own holarchy) and, if present, its
 * referent resolver (attachReferents) for the subject's beings.
 */
export function declareVoidSpec({ task = "", ground = "", draft = null, form = null, documentsDir = null, excludeDocId = null, unit = "sentence", unitBasis = null } = {}) {
  form = form ?? declareForm(task, { documentsDir, excludeDocId });
  const register = form.register;
  const field = form.field;
  const topic = topicOf(task);
  const parts = draft ? drawnParts(draft) : [];
  const points = parts.flatMap((p) => p.children ?? []);
  const asked = askedExtent(task);
  const rhythm = pacingGrade(points.map((p) => p.text).join(" ") || String(ground));
  const perPart = parts.map((p) => (p.children ?? []).length);
  const lengths = points.map((p) => sentenceWords(p.text));
  const R = draft?.referents ?? null;
  const subject = R ? [...(draft.subjectRefs ?? [])].map((id) => R.represent(id)) : [];
  const spoken = topic ?? form.token ?? task;
  const voice = writeVoiceFor(register, spoken);
  const opening = typeof voice.opening === "function" ? voice.opening(spoken) : voice.opening;
  const questions = voidCellsFor({ topic: spoken, question: task }).cells.filter((c) => c.relevant && c.question);

  // ARRANGEMENT BY KIND — the order information takes for this kind of piece,
  // from the organ that declares it. Where no organ declares one, unmeasured.
  const arrangement = field === "exposition"
    ? v(["open on a thesis about the subject", "carry the material's parts, each with one job", "return to the thesis at the close"], "declared", "kernel/register.js exposition voice (thesis first) + document-ledger.js checkEssayShape (thesis, body, return)")
    : field === "narrative"
      ? v(["open in medias res, in a place and a moment", "each part the next turn of the story", "land a resolution"], "declared", "kernel/register.js narrative voice + proxy-runner beat phases")
      : v(null, "unmeasured", `no organ declares an arrangement for the field "${field}"`);

  // THE CARDINALITY: the material sets what is possible, the ask what is probable.
  const cardinality = asked && ["paragraph", "section", "part"].includes(asked.unit)
    ? v(Math.min(asked.n, parts.length || asked.n), "asked", `the ask: ${asked.n} ${asked.unit}(s)${parts.length && asked.n > parts.length ? `, bounded by the ${parts.length} part(s) the material can support` : ""}`)
    : v(parts.length, "measured", "the material's own seams (EOT draft)");

  const levels = {
    whole: {
      slot: v(topic, topic ? "asked" : "unmeasured", topic ? "the ask, less its verb and form" : `the ask names ${form.token ? `a form ("${form.token}")` : "no form"} and no subject — nothing after on/about/of`),
      anchor: v(subject.length ? subject : null, subject.length ? "measured" : "unmeasured", subject.length ? "beings named in more parts than not (referents.js)" : "no being is named in most parts"),
      admits: v(field, form.basis, form.source),
      extent: v(asked ?? { parts: parts.length, statements: points.length }, asked ? "asked" : "measured", asked ? "the ask's explicit extent" : "the drawn parts and statements of the EOT draft"),
      relation: v(opening, "declared", "kernel/register.js writeVoiceFor — the voice the whole speaks in"),
      composition: arrangement,
      cardinality,
      admission: v("Gebser: the origin present in every part, none of it lost, no editor's perspective with the last word", "declared", "the-fold/archon-rules.js gebserArrival"),
      reopensOn: v("a part without its origin, a statement lost, an archon still objecting", "declared", "gebserArrival + readPiece"),
    },
    part: {
      slot: v("one seam of the material", "measured", "EOT draft parts (the material's block seams)"),
      anchor: v("the beings the part names beyond the subject", R ? "measured" : "unmeasured", R ? "referents.js" : "no resolver on the draft"),
      admits: v("the part's own witnessed statements, each allocated to exactly one part", "declared", "the-fold/eot-draft.js"),
      extent: v({ statements: { median: median(perPart), range: [Math.min(...perPart), Math.max(...perPart)] } }, perPart.length ? "measured" : "unmeasured", "statements per part in the material"),
      relation: v("each part takes up a being the last part put down", "declared", "the draft's planned bridge + Clark (archon-rules.js)"),
      composition: v("the part's statements in the material's own order", "declared", "the-fold/prosify.js coarse draw"),
      cardinality: v(perPart, perPart.length ? "measured" : "unmeasured", "statements in each drawn part"),
      admission: v("every statement carried with its anchors; one job; no restatement", "declared", "Kidder & Todd, Clark, Caro (archon-rules.js)"),
      reopensOn: v("a dropped statement, a restatement, an unearned transition", "declared", "readPiece findings that license a revision"),
    },
    sentence: {
      slot: v(unit === "line" ? "one line of verse" : "one sentence of prose", unitBasis?.startsWith("measured") ? "measured" : "declared", unitBasis ?? "the admission unit (admission.js)"),
      anchor: v("the numbers and beings of the statement it carries", "declared", "prosify.js anchorsFor"),
      admits: v("a sentence that brings new matter, or takes up the last one", "declared", "admission.js two roads"),
      extent: v({ words: { median: median(lengths), range: lengths.length ? [Math.min(...lengths), Math.max(...lengths)] : null }, meanWords: rhythm.meanLength, varianceRatio: rhythm.varianceRatio }, lengths.length ? "measured" : "unmeasured", "the material's own sentence lengths and rhythm (organs/pacing.js)"),
      relation: v("continues from the prior landing's beings", "declared", "admission.js continues"),
      composition: v({ blinks: rhythm.blinkPoints?.length ?? 0, flatline: rhythm.flatline }, "measured", "Murch's rhythm of the material, the cadence the prose is read against"),
      cardinality: v(null, "unmeasured", "no organ states how many sentences a statement should take"),
      admission: v("not a repeat, not meta, no invented name, anchors kept", "declared", "admission.js + referent-verify.js"),
      reopensOn: v("a refusal, a lost anchor", "declared", "prosify.js finer draw and floor"),
    },
  };

  // THE TWO LEVELS THAT RUN THROUGH ALL THE OTHERS.
  const verbiage = {
    voice: v(opening, "declared", "kernel/register.js"),
    tics: v("no word the material and the ask never use, repeated", "declared", "Zinsser (archon-rules.js)"),
    inflation: v("Zinsser's list", "declared", "revision-spiral.js INFLATION_WORDS"),
    cadence: v({ meanWords: rhythm.meanLength, varianceRatio: rhythm.varianceRatio }, "measured", "the material's rhythm (organs/pacing.js)"),
    lexicon: v(null, "unmeasured", "no organ declares a genre's vocabulary from a corpus of that genre"),
  };
  const grounding = {
    witness: v("every statement tied to its exact bytes", "declared", "eot-draft.js spans"),
    beings: v(R ? R.size : null, R ? "measured" : "unmeasured", "referents in the material (referents.js)"),
    obligations: v(questions.map((q) => q.question), "declared", "document-ledger.js voidCellsFor — the 27-cell questions relevant to this ask"),
    diaphaneity: v("reported, never gated", "declared", "Gebser (archon-rules.js)"),
  };

  const holarchy = voidHolarchy({
    modality: "text",
    // Here a part of the material is one paragraph, so the part's void is the
    // holarchy's section AND paragraph level; the sentence is its sentence.
    fieldsByLevel: Object.fromEntries(Object.entries({ whole: levels.whole, part: levels.part, subpart: levels.part, subsubpart: levels.sentence }).map(([lv, ops]) =>
      [lv, Object.fromEntries(Object.entries(ops).map(([k, x]) => [k, x.basis === "unmeasured" ? null : x.value]))])),
  });

  const all = [...Object.values(levels).flatMap((ops) => Object.values(ops)), ...Object.values(verbiage), ...Object.values(grounding)];
  const tally = all.reduce((t, x) => ({ ...t, [x.basis]: (t[x.basis] ?? 0) + 1 }), {});
  return {
    schema: VOID_SPEC_SCHEMA, task, topic, field,
    form: { token: form.token, cue: form.cue, referent: form.referent, field: form.field, basis: form.basis, source: form.source },
    levels, verbiage, grounding, holarchy,
    targets: {
      parts: cardinality.value,
      statementsPerPart: perPart,
      sentenceWords: { median: median(lengths), meanWords: rhythm.meanLength, varianceRatio: rhythm.varianceRatio },
      arrangement: arrangement.value,
    },
    tally,
    basis: `${all.length} declarations: ${Object.entries(tally).map(([b, n]) => `${n} ${b}`).join(", ")} — ${holarchy.basis}`,
  };
}

/** The spec as readable lines, level by level, each with its basis. */
export function voidSpecLines(spec) {
  const out = [];
  const fmt = (x) => (x.value == null ? "—" : typeof x.value === "string" ? x.value : JSON.stringify(x.value));
  if (spec.form) {
    out.push("FORM");
    out.push(`  form         [${spec.form.basis}] ${spec.form.field ?? "—"}${spec.form.token ? ` (the ask's form-word: "${spec.form.token}")` : ""}${spec.form.cue ? ` · anaphor "${spec.form.cue}"${spec.form.referent ? ` → ${spec.form.referent.docId}` : ""}` : ""}   ← ${spec.form.source}`);
  }
  for (const [name, ops] of Object.entries(spec.levels)) {
    out.push(`${name.toUpperCase()}`);
    for (const [op, x] of Object.entries(ops)) out.push(`  ${op.padEnd(12)} [${x.basis}] ${fmt(x).slice(0, 160)}   ← ${x.source}`);
  }
  for (const [name, ops] of [["VERBIAGE", spec.verbiage], ["GROUNDING", spec.grounding]]) {
    out.push(name);
    for (const [op, x] of Object.entries(ops)) out.push(`  ${op.padEnd(12)} [${x.basis}] ${fmt(x).slice(0, 160)}   ← ${x.source}`);
  }
  return out;
}
