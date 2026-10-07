// snip-check.js — a section's claims checked against the snips it stands on,
// IN PROCESS, the cheap rung first (P122). Pure.
//
// User direction (2026-09-05): "now that we have the snips, what is an
// efficient way for it to evaluate the accuracy of its claims in process?"
// The order is the cost's:
//   1. SNIPS  — the spans of the section's passages that carry its
//              obligations (the cast) and its topic: verbatim, addressed.
//              These are what the section is handed to write from.
//   2. ATOMS  — every number, date and name in a drafted sentence is checked
//              against the snips by containment WITH COMPANY (P31): the atom
//              must sit in a snip beside a content word of the sentence's
//              own. No model. A number in no snip is a flag; a name in no
//              snip is a flag.
//   3. CONTRADICTION — a snip sharing the sentence's content words and
//              carrying a DIFFERENT year is a contradiction candidate: the
//              sentence says one date, the source another. No model.
//   4. Only then the witness (holon.js), and only where a flag stands.
//   5. One rewrite of the flagged sentences from the snips, accepted only
//              where the atoms now pass (holon.js).
// Every flag carries the snip it failed against or the absence it stands in.
import { numberSet, wordSet, CLAIM_STOPWORDS, splitSentences } from "../organs/grounding.js";
import { namesIn } from "./ground-ladder.js";

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const contentWords = (t) => [...wordSet(fold(t))].filter((w) => w.length > 3 && !CLAIM_STOPWORDS.has(w));
const YEAR_RE = /\b(1[5-9]\d\d|20\d\d)\b/g;
/**
 * A STATED ABSENCE, as one shape — "doesn't say", "does not mention", "no
 * X", "nothing about Y" — moved here from correction.js's own private
 * `KEEPS_RE` (2026-08-25, "a stated absence is a finding") and now the ONE
 * copy both modules read, exported rather than duplicated: correction.js
 * already imports FROM this file, so this is the acyclic direction.
 *
 * WHY IT MATTERS HERE TOO, caught live (2026-09-08): asked whether Prince
 * Andrew's wound was fatal, gemma2:2b answered honestly — "The passage
 * doesn't say whether or not Prince Andrew's wound was fatal" — and
 * `checkSentence` flagged the name "Prince Andrew" in it for having no
 * company, because the sentence's OTHER words (wound, fatal) never sit
 * beside the name in any snip. That is true and beside the point: a
 * sentence of THIS shape is not claiming anything ABOUT Prince Andrew that
 * needs a snip's company — it is reporting the material's own silence, and
 * the name is the SUBJECT of that silence, not an assertion resting on it.
 * The same distinction `cutProcessTalk` already draws for a whole sentence
 * (kept, never cut, because reporting an absence is a finding) belongs here
 * too, one level down: an atom inside an absence-shaped sentence is exempt
 * from the company check that exists to catch a POSITIVE claim standing on
 * a name with nothing else behind it.
 */
export const ABSENCE_RE = /\b(?:do(?:es)?n['’]t|do(?:es)? not|cannot|can['’]t|no|none|nothing|not)\b[^.]{0,60}\b(?:contain|mention|say|state|include|provide|appear|find|specify|indicate|give|exist)/i;

// THE OPPOSITE FAILURE (found live 2026-09-15, task_298dbc5b's Bug 2):
// ABSENCE_RE above exists to stop a TRUE stated absence ("the passage
// doesn't say whether the wound was fatal") from being flagged for having
// no company — a real fix for a real false positive. But every reader of
// ABSENCE_RE in this codebase (this file, correction.js's `cutProcessTalk`)
// treats the shape as sacrosanct ONCE MATCHED — an absence sentence is
// EXEMPTED, never CHECKED. Nothing anywhere asks whether the denial is
// actually true. Reproduced live: retrieval correctly attached a source
// whose own text read "1,842 ... up from 1,110" and the mouth answered
// "doesn't offer information about the number of seed packets lent" — a
// flat, false denial of a number sitting right in the cited snip — and the
// AnswerRecord's `absences`/`absenceTally` (answer-record.js, gated on the
// WITNESS refusing a sentence) never even saw it, because a denial isn't a
// claim the witness is asked to ground in the first place.
const ABSENCE_META_WORDS = new Set(["contain", "contains", "mention", "mentions", "mentioned", "say", "says", "said", "state", "states", "stated", "include", "includes", "included", "provide", "provides", "provided", "appear", "appears", "find", "finds", "specify", "specifies", "indicate", "indicates", "give", "gives", "given", "exist", "exists", "offer", "offers", "offered", "information", "details", "this", "that", "material", "passage", "source", "text"]);
/**
 * falseAbsenceOf(sentence, snips) → a flag, or null. The mirror of
 * `checkSentence`'s own atom/company check, run the other way: a stated
 * absence (ABSENCE_RE) names its own TOPIC in plain words ("the number of
 * seed packets lent"); if some snip actually carries a NUMBER or YEAR beside
 * company from that topic (P31's same floor, reused rather than invented),
 * the denial is contradicted by the very material it is supposedly reporting
 * silence about. Text-only, no model: this can only ever flag a CANDIDATE
 * for the rewrite ask below to look at — the mouth is not censored (P186),
 * so nothing here deletes or rewrites the sentence on its own authority,
 * exactly like every other flag this file computes.
 *
 * NUMBER/YEAR ONLY, DELIBERATELY — a NAME atom was tried and measured false
 * on this file's own founding specimen: "The passage doesn't say whether or
 * not Prince Andrew's wound was fatal" against a snip that only mentions
 * Prince Andrew being present, never the wound's outcome — a real absence,
 * correctly reported. `atomsOf`'s NAME extraction there just re-finds the
 * denial's own SUBJECT sitting in the snip, which this file's own header on
 * `ABSENCE_RE` already names as not evidence of anything ("the name is the
 * SUBJECT of that silence, not an assertion resting on it") — a name is
 * company for a claim, never itself the claim. A number or year carries no
 * such ambiguity: it is never the mere subject of a sentence, always a
 * substantive fact, so its presence beside the denial's own topic words is
 * real contradicting evidence in a way a shared name is not.
 */
export function falseAbsenceOf(sentence, snips = []) {
  if (!ABSENCE_RE.test(sentence)) return null;
  const topic = contentWords(sentence).filter((w) => !ABSENCE_META_WORDS.has(w) && !/^\d+$/.test(w));
  if (!topic.length) return null;
  for (const s of snips) {
    const f = fold(s.text);
    const company = topic.filter((w) => f.includes(w));
    if (!company.length) continue;
    const snipAtoms = atomsOf(s.text).filter((a) => a.kind === "number" || a.kind === "year");
    if (!snipAtoms.length) continue;
    const named = snipAtoms.slice(0, 3).map((a) => `"${a.value}"`).join(", ");
    // `value` stays the single FIRST atom (article()/reviseAsk's own
    // singular phrasing, matching every other flag this file produces);
    // `detail` keeps every atom found, up to 3, for the fuller disclosure.
    return { kind: snipAtoms[0].kind, value: snipAtoms[0].value, reason: "false_absence", ref: s.ref, start: s.start, end: s.end, detail: `the sources DO carry ${named} together with "${company.join(", ")}" — this sentence wrongly denies it` };
  }
  return null;
}
/** This module's own vocabulary, and the asks built from it. A candidate
 * carrying any of it is describing the checking rather than the material. */
// Two concurrent sessions independently caught the same 2026-09-08 bug
// (reviseAsk collapsing `no_company` into the false "do not use" claim, see
// below) on two different pieces of material and wrote two different, true
// phrasings of the fix. Both alternations are kept: they are non-competing
// branches of one OR, and guarding against either phrase being echoed back
// costs nothing.
const APPARATUS_RE = /\b(?:appears? in (?:a|no) snip|beside none of this sentence|this section stood on|the sources do not use the (?:name|year|number)|only elsewhere, never together with what this sentence says|never together with what this says about it|what the sources say, verbatim|rewrite only those sentences|reply with the rewritten sentences|these sentences say things the sources|already found to be wrong on this material|bytes \d+–\d+ of that passage)\b/i;
export const SNIP_MAX = 40;         // snips a section is handed (P9: declared)
export const SNIP_WINDOW = 320;     // chars of a passage around a hit, when the passage has no sentence boundary near it

/** Split a passage into addressed sentences — the snip grain. */
// THE ORGAN'S OWN SPLITTER, never a local regex (2026-09-16). The regex that
// stood here cut at every period, so "A later county pamphlet stated that
// Ulysses S. Grant was born in Georgetown, Kentucky." was handed as "…stated
// that Ulysses S." and a subjectless "Grant was born in Georgetown, Kentucky."
// — the attribution severed from its claim, in the verbatim block, after the
// reader itself had been fixed to keep it whole. grounding.js::splitSentences
// is the splitter the atom checks in this file already stand beside, with its
// abbreviation guard and byte-true offsets. Disclosed cost it brings: a lone
// capital before a period ("an A. Then") is kept as one sentence.
function sentencesOf(passage) {
  const text = String(passage?.text ?? "");
  return splitSentences(text)
    .filter((x) => x.text.length >= 20)
    .map((x) => ({ ref: passage.ref, start: x.start, end: x.end, text: x.text }));
}

/**
 * snipsFor(passages, { obligations, terms, max }) → [{ ref, start, end, text, hits }]
 * The sentences of the section's passages that carry an obligation or a
 * topic term, most hits first, deduplicated, capped.
 */
export function snipsFor(passages = [], { obligations = [], terms = [], max = SNIP_MAX } = {}) {
  const needles = [...new Set([...obligations, ...terms].map(fold).filter((x) => x.length > 2))];
  const seen = new Set();
  const out = [];
  for (const p of passages) {
    for (const s of sentencesOf(p)) {
      const f = fold(s.text);
      const hits = needles.filter((n) => f.includes(n));
      if (!hits.length) continue;
      const key = `${s.ref}|${s.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, hits });
    }
  }
  return out.sort((a, b) => b.hits.length - a.hits.length || a.ref.localeCompare(b.ref) || a.start - b.start).slice(0, max);
}

/** The snips as the block a section is handed: verbatim, each with its address. */
// THE MOUTH NEVER SEES AN ADDRESS (the rule since 2026-08-18, restated by the user 2026-09-07: "it's just liable to lie with it"). The snips keep their addresses for the CHECK (snipsFor's rows carry ref/start/end); what is handed is the sentences alone. cite.js attaches the address after the draft, mechanically.
export function snipBlock(snips) {
  if (!snips.length) return "";
  return `What the sources say, verbatim:\n${snips.map((s) => `- ${s.text.replace(/\s+/g, " ")}`).join("\n")}`;
}

/** The atoms of a sentence: numbers (years and figures) and names. */
export function atomsOf(sentence) {
  const nums = [...numberSet(sentence)].map((n) => ({ kind: /^(1[5-9]\d\d|20\d\d)$/.test(n) ? "year" : "number", value: n }));
  const names = namesIn(sentence).map((n) => ({ kind: "name", value: n }));
  return [...nums, ...names];
}

/**
 * checkSentence(sentence, snips) → { atoms, flags, contradiction, supported }
 * An atom is SUPPORTED when a snip contains it beside a content word of the
 * sentence (P31's company rule); otherwise it is a flag naming what was
 * looked for and where — UNLESS the sentence itself is a STATED ABSENCE
 * (`ABSENCE_RE`, above), in which case the company check does not apply at
 * all: the sentence is reporting silence, not resting a claim on the atom,
 * and asking it to prove company is a category error, not a check. A stated
 * absence is not exempt from EVERY check, though — `falseAbsenceOf` (above)
 * runs the identical company logic the OTHER direction: does a snip actually
 * carry an atom beside the very topic this sentence denies covering? A
 * contradiction: a snip that shares ≥ 2 content words with the sentence and
 * carries a year the sentence does not, while the sentence carries a year
 * the snip does not.
 */
export function checkSentence(sentence, snips = []) {
  const atoms = atomsOf(sentence);
  if (ABSENCE_RE.test(sentence)) {
    const denial = falseAbsenceOf(sentence, snips);
    return { atoms, flags: denial ? [denial] : [], supported: [], contradiction: null };
  }
  const cw = contentWords(sentence);
  const flags = [];
  const supported = [];
  for (const a of atoms) {
    const isNum = a.kind === "number" || a.kind === "year";
    const needle = fold(a.value);
    const atomWords = new Set(contentWords(a.value));
    const company = cw.filter((w) => !atomWords.has(w));
    // A NUMBER/YEAR atom is checked by VALUE, not by substring — a name is
    // a name is a byte sequence, but "1,842" and "1842" are the identical
    // number differently punctuated. `numberSet`'s own extraction already
    // strips the thousands comma (grounding.js); `fold()` does not, so a
    // raw substring check against a comma-formatted source (`f.includes`)
    // could never find "1842" inside its own snip's literal "1,842" — a
    // real, severe false negative found live investigating Bug 2
    // (task_298dbc5b): a correctly-drafted sentence stating a source's own
    // comma-grouped figure, verbatim, still read as UNSUPPORTED, which is
    // exactly the shape that could push a rewrite round toward denying the
    // number altogether rather than restating it.
    const carries = (s) => (isNum ? numberSet(s.text).has(a.value) : fold(s.text).includes(needle));
    const hit = snips.find((s) => carries(s) && (company.length === 0 || company.some((w) => fold(s.text).includes(w))));
    if (hit) supported.push({ ...a, ref: hit.ref, start: hit.start, end: hit.end });
    else flags.push({ ...a, reason: snips.some((s) => carries(s)) ? "no_company" : "absent", detail: `${a.kind} "${a.value}" ${snips.some((s) => carries(s)) ? "appears in a snip but beside none of this sentence's own words" : "appears in no snip this section stood on"}` });
  }
  const sentenceYears = new Set([...String(sentence).matchAll(YEAR_RE)].map((m) => m[1]));
  let contradiction = null;
  if (sentenceYears.size) {
    for (const s of snips) {
      const f = fold(s.text);
      const shared = cw.filter((w) => f.includes(w));
      if (shared.length < 2) continue;
      const snipYears = new Set([...s.text.matchAll(YEAR_RE)].map((m) => m[1]));
      if (!snipYears.size) continue;
      const theirs = [...snipYears].filter((y) => !sentenceYears.has(y));
      const mine = [...sentenceYears].filter((y) => !snipYears.has(y));
      if (theirs.length && mine.length) { contradiction = { ref: s.ref, start: s.start, end: s.end, text: s.text, sentenceYears: mine, snipYears: theirs, shared }; break; }
    }
  }
  return { atoms, flags, supported, contradiction };
}

/** The section's rows, one per sentence, and the flagged ones the rewrite is asked about. */
export function checkSection(sentences, snips) {
  const rows = sentences.map((text) => ({ sentence: text, ...checkSentence(text, snips) }));
  const flagged = rows.filter((r) => r.flags.length || r.contradiction);
  return { rows, flagged, atoms: rows.reduce((a, r) => a + r.atoms.length, 0), supported: rows.reduce((a, r) => a + r.supported.length, 0) };
}

/** The one ask a section gets for its flagged sentences: the flags as facts, the snips as the only ground. */
export function reviseAsk(flagged, snips, { words = null } = {}) {
  const lines = flagged.map((r) => {
    // PLAIN WORDS ONLY (measured live, S77 run 3): the flag's `detail` is
    // written for a person reading the export — "appears in a snip but beside
    // none of this sentence's own words" — and when it was put in front of the
    // model the model echoed it straight back into its rewrite, which then
    // landed. What the model needs is the FACT: which value the sources do not
    // carry, and what they say instead. "Snip" is this instrument's word for
    // its own working, never a fact about the world.
    // TWO REASONS, TWO DIFFERENT TRUE FACTS — a real bug, caught live
    // independently by two sessions the same day (2026-09-08), on two
    // different pieces of material. Every flag, whatever its `reason`, was
    // told to the model as "the sources do not use … here" — true for an
    // `absent` atom, but FALSE for a `no_company` one, where the atom IS in
    // a snip, just never beside this sentence's OWN other words (P31's
    // company rule). First specimen: asked whether Prince Andrew's wound
    // was fatal, gemma2:2b answered honestly, "The passage doesn't say
    // whether or not Prince Andrew's wound was fatal" — and this line told
    // it "the sources do not use the name 'Prince Andrew' here", which is
    // FALSE: the one snip handed to the model in the very same message
    // reads "...approached Prince Andrew." Second specimen: a dialogue
    // whose bytes carry "#Person1#:" verbatim many times — the sources
    // plainly use the name, and the false "do not use" line still went out,
    // spending a whole extra rewrite round on a name that was never
    // missing. `checkSentence` already tells `absent` (the name is in no
    // snip at all) apart from `no_company` (the name IS in a snip, just
    // never together with this sentence's own words) — the bug was here,
    // collapsing both into the "do not use" phrasing that is only ever true
    // of the first. A correction message that asserts something the snip
    // block sent alongside it contradicts is not a correction a model can
    // act on sanely; it complied anyway, by echoing the one sentence it had
    // been shown, which answered nothing.
    const article = (f) => (f.kind === "name" ? "the name" : f.kind === "year" ? "the year" : "the number");
    const why = [
      ...r.flags.map((f) => f.reason === "no_company"
        ? `the sources do use ${article(f)} "${f.value}", but never together with what this says about it`
        : f.reason === "false_absence"
        ? `the sources actually DO state ${article(f)} "${f.value}" here — this sentence wrongly says they do not`
        : `the sources do not use ${article(f)} "${f.value}" here`),
      ...(r.contradiction ? [`they say ${r.contradiction.snipYears.join(" and ")} where this says ${r.contradiction.sentenceYears.join(" and ")}: "${r.contradiction.text.replace(/\s+/g, " ").slice(0, 160)}"`] : []),
    ];
    return `- "${r.sentence}" — ${why.join("; ")}`;
  });
  return `These sentences say things the sources you were given do not:\n${lines.join("\n")}\n\n${snipBlock(snips)}\n\nRewrite only those sentences so each says what the sources establish, or drop a sentence the sources cannot support. Reply with the rewritten sentences only, one per line, in the same order; write "(dropped)" for a sentence you drop.`;
}

/** Apply a rewrite reply: line i replaces flagged sentence i when the new sentence's atoms pass; "(dropped)" removes it; anything else keeps the original. */
export function applyRewrite(text, flagged, reply, snips) {
  // Preamble lines ("Here are the rewritten sentences:") are not sentences and would shift every line after them.
  const lines = String(reply ?? "").split("\n").map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").replace(/^["“]|["”]$/g, "").trim()).filter((l) => l && !/:$/.test(l) && !/^(here|sure|certainly|okay|of course)\b/i.test(l));
  const outcomes = [];
  let out = String(text ?? "");
  flagged.forEach((r, i) => {
    const cand = lines[i] ?? null;
    if (!cand) { outcomes.push({ sentence: r.sentence, outcome: "kept", because: "no line came back" }); return; }
    if (/^\(dropped\)$/i.test(cand)) { out = out.replace(r.sentence, "").replace(/\s{2,}/g, " "); outcomes.push({ sentence: r.sentence, outcome: "dropped" }); return; }
    const c = checkSentence(cand, snips);
    // A rewrite that shares no content word with any snip stands on nothing given — refused, whatever its atoms.
    const stands = contentWords(cand).some((w) => snips.some((sn) => fold(sn.text).includes(w)));
    if (!stands) { outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "refused", because: "the rewrite shares no word with any snip" }); return; }
    // A CORRECTION IS ABOUT THE SAME THING (measured live, S77 run 2): asked
    // to fix "The sources describe Prince Andrew's meeting with the Emperor",
    // the mouth returned "Our order should provide means to that end" — a
    // sentence whose atoms happened to sit in some snip, so the gate let it
    // land and the answer got a non sequitur in place of a claim. A rewrite
    // must keep the subject matter of the sentence it replaces: one content
    // word of the original, or an atom of it. Otherwise it is a different
    // sentence, not a correction, and the original stands flagged.
    // THE INSTRUMENT'S OWN WORDS MAY NEVER LAND IN THE ANSWER (measured live,
    // S77 run 3: "1. Function appears in a snip but beside none of this
    // sentence's own words It uses a combination of rules…" reached the
    // product because the echoed phrase's atoms passed the atom check).
    if (APPARATUS_RE.test(cand)) { outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "refused", because: "the rewrite echoes the instrument's own words back" }); return; }
    const own = contentWords(r.sentence);
    const kept = own.filter((w) => contentWords(cand).includes(w));
    const keptAtom = r.atoms.some((a) => fold(cand).includes(fold(a.value)));
    if (own.length && !kept.length && !keptAtom) { outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "refused", because: "the rewrite is about something else — a correction keeps the subject of the sentence it replaces" }); return; }
    if (c.flags.length || c.contradiction) { outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "refused", because: c.contradiction ? "the rewrite still contradicts a snip" : `the rewrite still carries ${c.flags.map((f) => `"${f.value}"`).join(", ")} unsupported` }); return; }
    if (!out.includes(r.sentence)) { outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "kept", because: "the sentence is no longer in the text" }); return; }
    out = out.replace(r.sentence, cand);
    outcomes.push({ sentence: r.sentence, candidate: cand, outcome: "rewritten" });
  });
  return { text: out.trim(), outcomes };
}
