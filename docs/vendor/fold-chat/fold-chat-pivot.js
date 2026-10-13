// fold-chat-pivot.js — THE PIVOT for ordinary generation: the model's text is a DRAFT that is READ, never the thing that is spoken.
// (memory `the-pivot`; docs/PIVOT.md.) Pure: no DOM, no IO, no model, no clock, no network.
//
//   A  NL            the model's draft (its words, exactly as it wrote them)
//   B  read-grammar  the draft is cut into units (lines → sentences, UTF-16 offsets that slice back into the draft) and each unit's
//                    features are read with the language's own closed classes and the declared tables below
//   C  EOT           an append-only event list: every unit SAID, every check RUN on it, every verdict (keep | drop + typed reason).
//                    State is a projection of it; nothing is decided off the record
//   D  write-grammar the spoken text is REALISED from the units that survived: markup becomes prose, a list becomes sentences, a '!'
//                    becomes '.', an orphaned connective is shed, the sentence-initial letter takes its script's upper case. Nothing
//                    else is added and no word is rewritten
//   E  NL            the string the person sees. `verifyPivot` re-derives it from the record and the draft and refuses any word the
//                    draft did not carry (the falsifier: a realiser that invented a word would fail it)
//
// B and D are SEPARATE parameters (`read`, `write`), like word orders: the grammar that reads a draft need not be the one that writes
// the answer. Here both tables exist for English only, so every other language is a typed gap: `no_grammar_for_language` — the draft is
// returned UNCHANGED and the result says it was not read (floor = today's path; never an English guess). When a second D table exists,
// content may be realised from one language's EOT into another's grammar; until then B ≠ D only changes the app-authored words.
//
// WHAT THE PIVOT REFUSES TO SPEAK (each is a typed drop, never a repair — the unit is withheld, not reworded):
//   empty · no_words (only an emoji or a mark) · orphan_anaphor (a pronoun-led sentence with nothing spoken before it) · label (a heading line "Here's what I can tell you:") · boilerplate (declared phrases, measured 2026-10-06 on gemma2:2b) ·
//   number_not_given (a figure the person, the sources and the evaluator never said: Constitution II.9) · ungrounded:<why> (on a sourced
//   turn, a sentence no source sentence witnesses — fold-chat-ground.js attribute) · question (more than one, or one that is not last) ·
//   attribution (a self-citation the model invented is stripped upstream; here a bare "according to X" with no X read is dropped)
// A sourced turn is judged against the sources; a turn with no material is JUDGMENT: its sentences pass the shape checks only and the
// result says `standing: "judgment"`, so the surface can say so (the model never speaks alone unless the caller allows it).
//
// DECLARED, not measured (Constitution II.11): the tables in GRAMMAR. Giver: the author's reading of 4 asks × 5 prompt variants on
// gemma2:2b at temperature 0 (2026-10-06, scratchpad exp.py/exp2.py) — a starting set, to be re-derived from a larger battery
// (eval/pivot/). No case logic decides anything: capitalisation is only ORTHOGRAPHY in the realiser (a letter takes upper case where the
// script has it), never a signal read from the draft.

import { sentencesWithOffsets } from "./fold-chat-impression.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import * as ground from "./fold-chat-ground.js";
// THE PATHOS ARCHONS, not invented here (vendored khora organs): Murch's pacing (rhythm, flatline, blink points), Panini's declared
// experiencer (pathos for no one in particular is refused), Abhinavagupta's pathosOf (the felt shape of a reading, for whom). Pathos
// NEVER GATES: nothing below removes or rewrites a word on its account. It is read, recorded, and applied only as paragraphing.
import { pathosOf } from "./vendor/khora/native/organs/pathos.js";
import { pacingGrade, sentenceLengths } from "./vendor/khora/native/organs/pacing.js";

export const SCHEMA = "Pivot@1";

/** The grounding failures that mean "the pages read do not carry this WORDING" — not "this contradicts or invents". Spoken, marked unsourced (user, 2026-10-06:
 *  "speak it, marked unsourced"), unless `strict`. Everything else `fold-chat-ground.js attribute` can say (name, figure, figure-binding, name-binding, cross-language) is HARD. */
export const SOFT_WHY = Object.freeze(["terms", "terms-elsewhere", "thin", "no-overlap"]);

/** Per-language tables. `read` is the B grammar, `write` the D grammar. A language missing from either has no pivot. */
export const GRAMMAR = Object.freeze({
  giver: "the author's reading of gemma2:2b drafts, 2026-10-06; DECLARED, not measured (II.11)",
  read: Object.freeze({
    en: Object.freeze({
      // phrases whose presence marks a sentence as stock chat reflex (matched caseless, on word boundaries)
      boilerplate: Object.freeze([
        "i'm so sorry to hear", "i am so sorry to hear", "i'm sorry to hear", "i'm here to listen", "i am here to listen",
        "here's what i can tell you", "here is what i can tell you", "based on the information i have",
        "there's no easy answer", "there is no easy answer", "it's a complex question", "it is a complex question", "it's a tough situation",
        "i hope this helps", "feel free to", "let me know if", "as an ai", "as a language model", "i'm an ai", "i am an ai",
        "i understand this is a big decision", "hi there", "great question", "i need more information", "to help you decide",
        "remember, there's no right or wrong", "reach out to a", "don't hesitate to",
      ]),
      // a unit that is only a lead-in ("Here are some tips:") — a colon-ended line is a label whatever its words
      labelByColon: true,
      // a sentence led by one of these points back at the sentence before it: when it fails ONLY for thin evidence it is checked together with
      // its (already witnessed) antecedent — never for any other failure (a name or term no source says stays withheld)
      anaphors: Object.freeze(["it", "its", "he", "she", "his", "her", "they", "their"]),
      third: Object.freeze(["the person", "this person"]),       // the person addressed as a third party ("If the person had…")
      attributionLead: Object.freeze(["according to", "per ", "as reported by", "as stated by", "studies show", "research shows", "research suggests", "studies suggest", "experts say", "scientists say"]),
    }),
  }),
  write: Object.freeze({
    en: Object.freeze({
      // discourse connectives that point BACK at a sentence; shed from the front of a unit whose predecessor was withheld
      backConnectives: Object.freeze(["however,", "additionally,", "also,", "moreover,", "furthermore,", "in addition,", "on the other hand,", "but", "and", "so", "therefore,", "thus,", "for example,", "for instance,", "that said,", "instead,", "still,", "yet,", "then,", "overall,", "in short,", "in conclusion,"]),
      standing: Object.freeze({ judgment: "General judgment only — no sources were read for this.", sourced: "Drawn from the sources shown." }),
    }),
  }),
});

/** Does a pivot exist for this (read, write) pair? Both grammars must be declared and the language must have a closed-class prior. */
export function grammarFor(read, write = read) {
  const r = GRAMMAR.read[read] || null, w = GRAMMAR.write[write] || null;
  const fw = functionWordsOf(read) || null;
  return r && w && fw ? { r, w, fw } : null;
}

// ───────────────────────────── B: read ─────────────────────────────

const FENCE_OPEN = /^```[\w+#.-]*\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const BULLET = /^\s*(?:[-*•–]|\d{1,3}[.)])\s+/;
const HEADING = /^\s{0,3}#{1,6}\s+/;
const WRAP = /(\*\*|__|`|~~)/g;
const QMARK = /[?？؟¿]\s*["')\]”’」』]*$/u;
const EXCL = /[!！]+(?=\s*["')\]”’」』]*$)/u;

/** Strip inline markdown from one line (emphasis, code ticks, heading hashes, a link's markup keeping its text). */
export function plainOf(line) {
  return String(line ?? "")
    .replace(HEADING, "")
    .replace(BULLET, "")
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")
    .replace(WRAP, "")
    .replace(/(^|[\s(])\*(?=\S)([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

const caseless = (s) => String(s ?? "").toLocaleLowerCase("und");
const hasPhrase = (hay, phrase) => {
  const h = " " + caseless(hay).replace(/[’’]/g, "'").replace(/[^\p{L}\p{N}'%$ ]+/gu, " ").replace(/\s+/g, " ") + " ";
  return h.includes(" " + phrase.trim().replace(/\s+/g, " ") + " ") || (phrase.endsWith(" ") && h.includes(" " + phrase.trim() + " "));
};

/** The units of a draft: fenced code verbatim, every other line cut into sentences. Offsets slice back into `draft` exactly. */
export function readUnits(draft) {
  const src = String(draft ?? "");
  const units = [];
  let pos = 0, para = 0, inFence = false, fenceStart = 0;
  const lines = src.split("\n");
  let sawBlank = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li], lineStart = pos, lineEnd = pos + line.length;
    pos = lineEnd + 1;
    // only a fence that CLOSES is code; an opener with no closing line is a stray marker and the lines after it are read as prose
    if (!inFence && FENCE_OPEN.test(line.trim())) { if (lines.slice(li + 1).some((l) => FENCE_CLOSE.test(l.trim()))) { inFence = true; fenceStart = lineStart; } continue; }
    if (inFence && FENCE_CLOSE.test(line.trim())) { inFence = false; units.push({ kind: "code", text: src.slice(fenceStart, lineEnd), start: fenceStart, end: lineEnd, para: ++para }); continue; }
    if (inFence) continue;
    if (!line.trim()) { sawBlank = true; continue; }
    if (sawBlank) { para++; sawBlank = false; }
    const bullet = BULLET.test(line);
    const body = line.replace(BULLET, "");
    const bodyOffset = line.length - body.length;
    const plain = plainOf(body);
    const isLabel = !!plain && /[:：]$/.test(plain);
    const heading = HEADING.test(line) || (/^\s*(\*\*|__)[^]*(\*\*|__)\s*:?\s*$/.test(line) && !/[.!?。！？]/.test(plain.replace(/[:：]$/, "")));
    let firstOfLine = true;
    for (const s of sentencesWithOffsets(body)) {
      let sp = plainOf(s.text), leadLabel = null;
      // an EMPHASISED lead-in ("**Remember:** Ultimately…", "**Honesty builds trust:** When people…") is markup, not the sentence: the label is shed
      const lm = firstOfLine && !isLabel && !heading ? /^\s*(\*\*|__)([^*_\n]{1,60}?)\s*[:：]\s*\1\s*(\S[^]*)$|^\s*(\*\*|__)([^*_\n]{1,60}?)\1\s*[:：]\s*(\S[^]*)$/.exec(s.text) : null;
      if (lm) { leadLabel = (lm[2] ?? lm[5]).trim(); sp = plainOf(lm[3] ?? lm[6]); }
      firstOfLine = false;
      if (!sp) continue;
      units.push({ kind: "sentence", text: sp, raw: s.text, start: lineStart + bodyOffset + s.start, end: lineStart + bodyOffset + s.end, para, bullet, label: isLabel || heading, ...(leadLabel ? { leadLabel } : {}), lineIndex: li });
    }
  }
  return units;
}

// ───────────────────────────── C: the record ─────────────────────────────

function makeRecord() {
  const events = [];
  return { events, add: (kind, data) => { const e = { n: events.length + 1, kind, ...data }; events.push(e); return e; } };
}

const numbersOf = (t) => ground.numbersIn(t).map((x) => x.replace(/%$/, "")).filter(Boolean);

/** Everything the turn may legitimately say a figure from: the person's words, the sources, the evaluator's value. */
function givenNumbers({ ask, material, computed }) {
  const set = new Set();
  for (const t of [ask, computed, ...material.map((m) => m?.text)]) for (const n of numbersOf(String(t ?? ""))) set.add(n);
  return set;
}


/**
 * The leading ECHO of the person's own words ("The most notable fact about X is that …"): for the CHECK only, the longest prefix made of
 * the ask's own words and the language's closed class is cut, and only what follows is held to the sources — the person's frame words are
 * theirs, not a claim a source must make. The spoken text keeps the echo. An echo with no remainder returns null (nothing was claimed
 * beyond what the person said, so it earns no pass), and a prefix with fewer than 2 words of the ask's own is not an echo.
 */
export function echoRemainder(text, ask, fw) {
  const askSet = new Set(ground.tokenize(ask));
  const toks = ground.tokensWithOffsets(text);
  let i = 0, own = 0;
  while (i < toks.length && (askSet.has(toks[i].t) || (fw && fw.has(toks[i].t)))) { if (askSet.has(toks[i].t) && !(fw && fw.has(toks[i].t))) own++; i++; }
  if (own < 2 || i >= toks.length) return null;
  return text.slice(toks[i].start);
}

// ───────────────────────────── the pivot ─────────────────────────────

/**
 * pivotText({ draft, ask, material, computed, read, write, kind }) → Pivot@1
 *   draft     the model's text, as it wrote it
 *   ask       the person's words (figures they gave are theirs to have echoed)
 *   material  [{ ref, source, text }] — what the turn read; [] means a JUDGMENT turn
 *   computed  the evaluator's text for a compute turn, or null
 *   read      B grammar language code ('en'); write  D grammar language code (default = read)
 *   kind      the turn kind
 *   strict    false (default): a sentence whose ONLY failure is that the pages read do not back its WORDING (SOFT_WHY) is SPOKEN and marked unsourced; true:
 *             it is withheld like any other failure. HARD failures (an invented figure or name, a figure bound to the wrong thing) are withheld either way.
 *   experiencer  { who, read } — WHO undergoes the spoken text (the instrument that wrote the draft, from the turn's own record) and what
 *             they read. Declared by the caller, never defaulted: without one the felt shape is a typed gap, not a guess (Panini's law)
 */
export function pivotText({ draft, ask = "", material = [], computed = null, read = "en", write = read, kind = "chat", requireGrounding = null, experiencer = null, strict = false } = {}) {
  const src = String(draft ?? "");
  const g = grammarFor(read, write);
  if (!g) return { schema: SCHEMA, skipped: "no_grammar_for_language", read, write, text: src, units: [], dropped: [], events: [], standing: null, stats: { in: 0, kept: 0, dropped: 0 } };
  const mats = (Array.isArray(material) ? material : []).filter((m) => m && String(m.text ?? "").trim());
  const sourced = mats.length > 0;
  const mustGround = requireGrounding == null ? sourced : !!requireGrounding && sourced;
  const given = givenNumbers({ ask, material: mats, computed });
  const rec = makeRecord();
  const units = readUnits(src);
  const verdicts = [];
  let prevWitnessed = null;   // the last sentence a source witnessed (the antecedent a pronoun-led sentence may lean on)

  // lone judgment pass: a question may stay only if it is the LAST non-code unit that survives everything else
  for (const u of units) {
    const e = rec.add("said", { start: u.start, end: u.end, unit: u.kind, text: u.text.slice(0, 400) });
    const v = { unit: u, said: e.n, keep: true, why: null, detail: "" };
    verdicts.push(v);
    if (u.kind === "code") { rec.add("check", { of: e.n, name: "code", result: "passed-through" }); continue; }
    const drop = (why, detail = "") => { if (v.keep) { v.keep = false; v.why = why; v.detail = detail; } rec.add("check", { of: e.n, name: why, result: "drop", ...(detail ? { detail } : {}) }); };
    if (!/[\p{L}\p{N}]/u.test(u.text)) { drop("no_words"); continue; }   // an emoji, a bare mark: it says nothing a source could witness
    if (u.label) { drop("label"); continue; }
    const bp = g.r.boilerplate.find((p) => hasPhrase(u.text, p));
    if (bp) { drop("boilerplate", bp); continue; }
    const th = g.r.third.find((p) => hasPhrase(u.text, p));
    if (th) { drop("third_person", th); continue; }
    const att = g.r.attributionLead.find((p) => hasPhrase(u.text, p));
    if (att && !mats.some((m) => hasPhrase(m.text, att.trim()))) { drop("attribution", att.trim()); continue; }
    const fresh = numbersOf(u.text).filter((n) => !given.has(n));
    if (fresh.length) { drop("number_not_given", fresh.join(",")); continue; }
    rec.add("check", { of: e.n, name: "shape", result: "ok" });
    if (mustGround) {
      let checkText = u.text, echo = null;
      let a = ground.attribute(checkText, mats)[0];
      // failed ONLY because words nobody's source says are the person's own frame words ("most notable fact"): hold the remainder to the sources
      if ((!a || !a.ref) && a && a.why === "terms") {
        const rest = echoRemainder(u.text, ask, g.fw);
        if (rest) { const a2 = ground.attribute(rest, mats)[0]; if (a2 && a2.ref) { a = a2; checkText = rest; echo = rest; } }
      }
      let coref = null;
      if ((!a || !a.ref) && a && a.why === "thin" && prevWitnessed) {
        const lead = caseless(u.text.split(/[\s,]+/)[0] || "").replace(/[^\p{L}']/gu, "");
        if (g.r.anaphors.includes(lead)) {
          const chained = ground.attribute(prevWitnessed.text.replace(/[.!?。！？]+\s*$/u, ",") + " " + checkText, mats);
          const last = chained[chained.length - 1];
          if (last && last.ref && chained.length === 1) { a = last; coref = prevWitnessed.address; }
        }
      }
      if (!a || !a.ref) {
        // a sentence that claims nothing checkable (a transition) is not a claim; one that names things the sources never said is withheld
        if (a && a.why === "no-content") { rec.add("check", { of: e.n, name: "grounding", result: "claimless" }); v.claimless = true; }
        else if (!strict && a && SOFT_WHY.includes(a.why)) { v.unsourced = a.why; rec.add("check", { of: e.n, name: "grounding", result: "unsourced", why: a.why }); }   // spoken, marked: the record draws the ✱
        else { drop("ungrounded:" + (a?.why || "none"), a?.detail || ""); continue; }
      } else { v.support = a.address; if (coref) v.coref = coref; rec.add("check", { of: e.n, name: "grounding", result: coref ? "witnessed-with-antecedent" : "witnessed", address: a.address, ...(coref ? { antecedent: coref } : {}), ...(echo ? { echoCut: true } : {}) }); }
      if (v.support) prevWitnessed = { text: u.text, address: v.support };
    }
  }

  // a draft that stops mid-sentence (the model ran out of room): its last sentence is withheld, never completed
  { const sent = verdicts.filter((v) => v.unit.kind === "sentence");
    const last = sent[sent.length - 1];
    const tail = src.replace(/\s+$/, "");
    if (last && last.keep && last.unit.end >= tail.length - 1 && !/[.!?。！？؟…:;"')\]”’」』»]$/u.test(plainOf(tail)) && /[\p{L}\p{N}]$/u.test(plainOf(tail))) {
      last.keep = false; last.why = "truncated"; rec.add("check", { of: last.said, name: "truncated", result: "drop" });
    } }

  // questions: at most ONE survives, and only as the last surviving unit
  const live = verdicts.filter((v) => v.keep && v.unit.kind === "sentence");
  const qs = live.filter((v) => QMARK.test(v.unit.text));
  const lastLive = live[live.length - 1] || null;
  for (const v of qs) if (!(qs.length === 1 && v === lastLive)) { v.keep = false; v.why = "question"; rec.add("check", { of: v.said, name: "question", result: "drop" }); }

  // D: realise from what survived
  const out = [];
  let prevKept = true, prevPara = null, prevLine = null;
  for (const v of verdicts) {
    const u = v.unit;
    if (!v.keep) { rec.add("verdict", { of: v.said, keep: false, why: v.why, ...(v.detail ? { detail: v.detail } : {}) }); prevKept = false; continue; }
    rec.add("verdict", { of: v.said, keep: true, ...(v.support ? { support: v.support } : {}) });
    if (u.kind === "code") { out.push({ kind: "code", text: u.text, start: u.start, end: u.end, para: u.para, edits: [] }); prevKept = true; prevPara = u.para; continue; }
    let t = u.text, edits = [];
    // a sentence that OPENS with a pronoun points at something already SPOKEN: with nothing spoken before it, it would point at nothing ("They absorb water from the soil." as the whole answer to "What is photosynthesis?"). It is withheld, never repaired.
    { const lead = caseless(t.split(/[\s,]+/)[0] || "").replace(/[^\p{L}']/gu, "");
      if (g.r.anaphors.includes(lead) && !out.some((o) => o.kind === "sentence")) { rec.add("verdict", { of: v.said, keep: false, why: "orphan_anaphor" }); v.keep = false; v.why = "orphan_anaphor"; prevKept = false; continue; } }
    if (EXCL.test(t)) { t = t.replace(EXCL, "."); edits.push("terminal-exclamation"); }
    if (!prevKept) {
      const low = caseless(t);
      const lead = g.w.backConnectives.find((c) => low.startsWith(c + " ") || low === c);
      if (lead) { t = t.slice(lead.length).replace(/^[\s,]+/, ""); edits.push("shed-connective:" + lead); }
    }
    if (u.bullet) edits.push("list-to-prose");
    if (u.leadLabel) edits.push("shed-label:" + u.leadLabel);
    const first = [...t][0];
    if (first && first.toLocaleUpperCase() !== first.toLocaleLowerCase() && first === first.toLocaleLowerCase()) { t = first.toLocaleUpperCase() + t.slice(first.length); edits.push("initial-capital"); }
    if (!t.trim()) { prevKept = false; continue; }
    out.push({ kind: "sentence", text: t, start: u.start, end: u.end, para: u.para, edits, ...(v.support ? { support: v.support } : {}), ...(v.claimless ? { claimless: true } : {}), ...(v.unsourced ? { unsourced: v.unsourced } : {}) });
    prevKept = true; prevPara = u.para;
  }

  let text = "";
  out.forEach((o, i) => {
    if (i === 0) { text = o.text; return; }
    const p = out[i - 1];
    text += (o.kind === "code" || p.kind === "code" || o.para !== p.para ? "\n\n" : " ") + o.text;
  });
  // PATHOS (the real organs): the spoken text's felt shape for a DECLARED experiencer; applied only as paragraphing at Murch's blink points
  let felt = null;
  if (text.trim()) {
    if (!experiencer) { felt = { gap: "no_experiencer", why: "no one is declared to undergo this text, so pathos is not read (a feeling for no one in particular is refused)" }; rec.add("pathos", { gap: felt.gap }); }
    else {
      try {
        const pr = pathosOf({ text, experiencer });
        const pace = pacingGrade(text);
        felt = { forWhom: pr.forWhom, rhythm: pr.rhythm, strain: pr.strain, curve: { measured: pr.curve.measured, unmeasured: pr.curve.unmeasured || null }, blinkPoints: pace.blinkPoints.map((b) => b.index) };
        rec.add("pathos", { forWhom: pr.forWhom.who, rhythm: pr.rhythm, strain: pr.strain, curveMeasured: pr.curve.measured });
        // Murch: the edit falls where the thought turns. One paragraph of >= 4 sentences gets a break AFTER each blink sentence that has
        // >= 2 sentences before it in its paragraph, at most one break per 3 sentences. Whitespace only; the words are untouched.
        const rows = sentenceLengths(text);
        if (!text.includes("\n") && rows.length >= 4 && pace.blinkPoints.length) {
          const cut = new Set(); let since = 0; const maxBreaks = Math.floor(rows.length / 3);
          rows.forEach((r, i) => { since++; if (pace.blinkPoints.some((b) => b.index === i) && since >= 3 && i < rows.length - 1 && cut.size < maxBreaks) { cut.add(i); since = 0; } });
          if (cut.size) { text = rows.map((r, i) => r.sentence + (i === rows.length - 1 ? "" : cut.has(i) ? "\n\n" : " ")).join(""); felt.paragraphed = [...cut]; rec.add("pathos", { applied: "paragraph-at-blink", after: [...cut] }); }
        }
      } catch (e) { felt = { gap: "pathos_unreadable", why: String(e?.message || e).slice(0, 120) }; rec.add("pathos", { gap: felt.gap }); }
    }
  }
  const dropped = verdicts.filter((v) => !v.keep).map((v) => ({ text: v.unit.text, start: v.unit.start, end: v.unit.end, why: v.why, ...(v.detail ? { detail: v.detail } : {}) }));
  const sentences = verdicts.filter((v) => v.unit.kind === "sentence");
  const result = {
    schema: SCHEMA, read, write, standing: sourced ? "sourced" : "judgment", text,
    units: out, dropped, events: rec.events, felt,
    stats: { in: sentences.length, kept: out.filter((o) => o.kind === "sentence").length, dropped: dropped.length, unsourced: out.filter((o) => o.unsourced).length },
    ...(text.trim() ? {} : { gap: { kind: "nothing_survived", why: dropped.length ? "every sentence of the draft was withheld" : "the draft was empty" } }),
  };
  return result;
}

/** The app-authored standing line for a result (D grammar), or null. The surface draws it; it is never part of `text`. */
export function standingLine(pv, write = pv?.write || "en") {
  const w = GRAMMAR.write[write];
  return w && pv?.standing ? w.standing[pv.standing] || null : null;
}


/**
 * The passages that may be shown as a FALLBACK when nothing the model wrote could be spoken: those whose TITLE shares at least one CONTENT word
 * of the ask (the ask's words minus the language's closed class). An ask with no content word ("who are you?") has no relevant page, so nothing is
 * shown: a page that merely matched the ask's function words (an album called "Who Are You") is not an answer to it. Stem-folded, caseless.
 */
export function relevantPassages(passages, ask, fw) {
  const stem = (t) => ground.stemOf ? ground.stemOf(t) : t;
  const content = new Set(ground.tokenize(ask).filter((t) => !(fw && fw.has(t))).map(stem));
  if (!content.size) return [];
  return (Array.isArray(passages) ? passages : []).filter((p) => {
    const ref = String(p?.ref ?? "");
    const title = ref.includes(" \u2014 ") ? ref.slice(ref.indexOf(" \u2014 ") + 3) : ref;
    return ground.tokenize(title).map(stem).some((t) => content.has(t));
  });
}

// ───────────────────────────── the check on the realiser ─────────────────────────────

const wordsOf = (s) => ground.tokenize(s);

/**
 * verifyPivot(pv, draft) → { ok, bad[] }. The spoken text must be re-derivable: every unit's slice of the draft exists, its words are a
 * sub-multiset of the draft slice's words, and the whole text carries no word that is in no kept unit. A realiser that invented or
 * reworded a word fails here. (Sheds and capitalisation only ever REMOVE words or change a letter's case, which fold-casing hides.)
 */
export function verifyPivot(pv, draft) {
  const src = String(draft ?? ""), bad = [];
  if (pv?.skipped) return { ok: true, bad, skipped: pv.skipped };
  for (const u of pv.units) {
    if (u.kind === "code") { if (src.slice(u.start, u.end) !== u.text) bad.push({ why: "code_not_in_draft", text: u.text.slice(0, 60) }); continue; }
    const slice = wordsOf(plainOf(src.slice(u.start, u.end)));
    const have = new Map();
    for (const w of slice) have.set(w, (have.get(w) || 0) + 1);
    for (const w of wordsOf(u.text)) { const n = have.get(w) || 0; if (!n) bad.push({ why: "word_not_in_draft", word: w, text: u.text.slice(0, 60) }); else have.set(w, n - 1); }
  }
  const allowed = new Set(pv.units.flatMap((u) => wordsOf(u.text)));
  for (const w of wordsOf(pv.text)) if (!allowed.has(w)) bad.push({ why: "word_in_no_unit", word: w });
  return { ok: bad.length === 0, bad };
}

/** A small plain-JSON record for message.pivot (what the surface and the "how this was answered" panel read). */
export function storePivot(pv) {
  if (!pv) return null;
  if (pv.skipped) return { schema: SCHEMA, skipped: pv.skipped, read: pv.read };
  return {
    schema: SCHEMA, read: pv.read, write: pv.write, standing: pv.standing, stats: pv.stats,
    dropped: pv.dropped.map((d) => ({ why: d.why, ...(d.detail ? { detail: d.detail } : {}), text: d.text.slice(0, 160) })),
    ...(pv.felt ? { felt: pv.felt.gap ? { gap: pv.felt.gap } : { who: pv.felt.forWhom.who, rhythm: pv.felt.rhythm, strain: pv.felt.strain, ...(pv.felt.paragraphed ? { paragraphed: pv.felt.paragraphed } : {}) } } : {}),
    ...(pv.gap ? { gap: pv.gap } : {}),
    ...(pv.gates ? { gates: pv.gates } : {}),
    ...(pv.continued ? { continued: pv.continued } : {}),
  };
}

/** One plain line for the feed: what the reading did to the draft. */
export function pivotLine(pv) {
  if (!pv) return "";
  if (pv.skipped) return `the reply was not read (no grammar for ${pv.read}) — shown as the model wrote it`;
  const s = pv.stats;
  if (pv.gap) return `read the draft (${s.in} sentence${s.in === 1 ? "" : "s"}); none could be spoken`;
  const mark = s.unsourced ? ` (${s.unsourced} marked unsourced)` : "";
  return s.dropped ? `read the draft: ${s.kept} of ${s.in} sentence${s.in === 1 ? "" : "s"} spoken${mark}, ${s.dropped} withheld` : `read the draft: all ${s.in} sentence${s.in === 1 ? "" : "s"} spoken${mark}`;
}

/** THE SWITCH. ON unless the person (or a test) turns it off: localStorage "fold-chat:pivot" === "off". Never throws (storage may be blocked). */
export const PIVOT_KEY = "fold-chat:pivot";
export function pivotEnabled(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return storage?.getItem?.(PIVOT_KEY) !== "off"; } catch { return true; }
}
