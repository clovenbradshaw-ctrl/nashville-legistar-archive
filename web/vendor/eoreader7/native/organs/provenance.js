// provenance.js — every sentence stands on a named ground. Pure.
//
// There is no "ungrounded content" in a rendered answer — that framing was
// the mistake. There are two grounds: THE MATERIAL (the sentence carries or
// earned an address into the bytes) and THE MODEL (the sentence stands on
// what the model is, said in its own voice). Both are legitimate; what is
// not legitimate is their rendering alike (FOLD-CONSTITUTION IV.4: measured
// and shown never render alike). And orthogonal to the ground is the
// stripe: a sentence — on either ground — that commits to FIGURES or NAMES
// the material does not contain is carrying claims of fact on the model's
// authority, and those claims are drawn as what they are.
//
// Nothing here is measured fresh: every field is read off work the turn
// already did — attribute()'s per-sentence verdicts and checkGrounding's
// atom findings — so this classification cannot disagree with the record
// built from the same checks. It is the same evidence at sentence
// resolution, for drawing on the prose itself.
//
// The tier above this — relation-level reading, the hypergraph: an edge
// like "Pierre married Dolokhov" whose every token is present but which the
// text never bound — is WIRED (hypergraph.js, on the engine's own organs;
// the P12 amendment says so). Its verdicts arrive here as `relationClaims`
// and ride each sentence as `edges`, read off the report exactly as
// `absent` is read off checkGrounding — classified, never re-measured.

import { splitSentences } from "./cite.js";

/**
 * Classify every sentence of an answer onto its ground.
 *
 * Returns one entry per sentence:
 *   { text, ground: "material" | "model", ref, absent: [...] }
 *
 * ground "material" — the sentence cited an offered address, or attribution
 *   attached one it earned against the null. `ref` carries the address when
 *   attribution attached it (a model-cited sentence keeps its inline ref).
 * ground "model"    — no address; the sentence stands on the model's own
 *   voice, typed as such. A summary, a hedge, connective tissue — or a
 *   claim, which is what `absent` distinguishes.
 * absent            — figures/names in this sentence that checkGrounding
 *   found nowhere in the material: claims of fact on model authority,
 *   whatever the sentence's ground.
 */
/**
 * A model's brackets mean ONE thing in this app: `[name#start-end]`, a
 * citation. Anything else wrapped in brackets is not content the model was
 * ever authorized to produce that way — it is the model narrating its own
 * act of answering ("[Answering the prompt, I have searched the text and
 * have not found...]"), the same leak as a `<placeholder>` slot echoed back
 * (eo-holonic-plan.ts's containsPromptScaffold) or the reconcile-scaffold
 * echo caught there by KL divergence. This is the structural cousin: no
 * word list, no "don't narrate" instruction planted in the prompt (that is
 * the exact trap the model-is-the-mouth discipline exists to refuse) — a
 * STRUCTURAL tell instead. A stage direction quoted from real prose is a
 * short aside, a few words, never more than one sentence. Narration about
 * the act of answering is prose about prose: it has its own sentences.  A
 * bracketed span that is not a valid address AND itself contains more than
 * one sentence is therefore scaffold, not content, and is mechanically
 * removed before any check runs or anything renders — hidden, not merely
 * dimmed, because it was never an answer to begin with.
 */
const ADDRESS_ONLY_RE = /^\[[^\s\]]+#\d+-\d+\]$/;

/** Top-level [...] spans, walked by bracket depth — the same discipline
 * holon.js::extractArray uses for JSON arrays, applied here to prose. */
function bracketSpans(text) {
  const spans = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "]" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        spans.push({ start, end: i + 1, text: text.slice(start, i + 1) });
        start = -1;
      }
    }
  }
  return spans;
}

/**
 * Strip narration spans from `text`. Returns the cleaned text and the
 * removed spans, so a caller can disclose what was hidden without showing
 * it — the model's own act of narrating its process is itself a fact worth
 * a typed note, even though the narration's content is not.
 */
export function stripScaffoldNarration(text) {
  const raw = String(text ?? "");
  const narration = bracketSpans(raw).filter(
    (span) => !ADDRESS_ONLY_RE.test(span.text) && splitSentences(span.text.slice(1, -1)).length >= 2,
  );
  if (!narration.length) return { text: raw, removed: [] };
  let out = "";
  let last = 0;
  const removed = [];
  for (const span of narration) {
    out += raw.slice(last, span.start);
    removed.push(span.text);
    last = span.end;
  }
  out += raw.slice(last);
  // Collapse the gap the removal leaves rather than showing a blank stretch —
  // but never across a fence: a blanket collapse once destroyed the
  // indentation of a Python block elsewhere in the same draft that no
  // bracket span ever touched (the identical mistake stripNarrationSentences
  // makes below, fixed there the same way).
  const fences = codeFenceSpans(out);
  let cleaned = "";
  let p = 0;
  for (const f of fences) {
    cleaned += cleanProse(out.slice(p, f.start));
    cleaned += out.slice(f.start, f.end);
    p = f.end;
  }
  cleaned += cleanProse(out.slice(p));
  return { text: cleaned.trim(), removed };
}

/**
 * The narration register, unbracketed: sentences ABOUT the prompt instead of
 * answers TO it — "This passage indicates that…", "The prompt aims to…",
 * "It then transitions to discussing…". The word classes here are not a
 * style opinion; they are measured against a null (the user's standing
 * rule): across 194 real documents from live_priors (literature,
 * encyclopedic, academic, news — ~460,544 sentences), sentence-initial
 * subject+verb of this register appears ONCE. In a 15-turn live trial
 * (2026-08-17, qwen2.5:14b) it opened 6 of 15 answers. A register at ~2 per
 * million sentences in human prose and ~40 per hundred in model output is
 * model scaffold, and scaffold is stripped mechanically — the model is the
 * mouth; nothing asks it to stop, the instrument just does not ship it.
 *
 * Three moves, each a cut or a prefix-cut of the raw text, never a rewrite:
 * — DEFLATE: "The passage shows that X" keeps X (the complement is content;
 *   the wrapper is the register). Prefix located and sliced off.
 * — CUT: a register sentence with no that-complement carries nothing
 *   ("This prompt aims to calculate a growth scenario."), as does an
 *   "It then transitions…" continuation, a sentence reproducing the
 *   discourse block, and — on the material path only — the false refusal
 *   ("I can't access files", "It's a model"), which lies about an
 *   instrument that just handed the model the bytes.
 * — BAIL: a sentence that cannot be located in the raw text cuts nothing;
 *   shipping the whole draft is always safer than mangling it.
 */
// The subject noun may sit a few modifiers away from its determiner —
// measured 2026-08-19 ("who won the 1960 world series?", gemma2:2b): "The
// 1960 World Series question, «…», is directly related to baseball
// playoffs" — three modifier words between "The" and "question" defeated
// the adjacent-noun pattern and the narration shipped as the whole answer.
// Disclosed residue of the widening: a content subject wearing one of
// these nouns behind modifiers ("The locked user waits…") is now inside
// the pattern's reach — the verb list stays the narrow guard.
const NARRATION_SUBJECT =
  "(?:the|this|that|your)\\s+(?:[\\p{L}\\p{N}'’-]+\\s+){0,4}?(?:passage|prompt|question|material|text|excerpt|conversation|dialogue|discussion|user|file|document|notes?|input|record)";
// establishes measured live 2026-08-20 (gemma2:2b, real pasted two-VP
// material, "who was Abe Lincoln's VP?"): "This passage establishes that
// Hannibal Hamlin served as vice president..." shipped as a second,
// redundant answer bubble alongside a fine direct one — the exact register
// this file exists to strip, one verb lemma the list had not yet seen.
const DEFLATE_RE = new RegExp(
  `^\\s*${NARRATION_SUBJECT}\\s+(?:\\w+\\s+){0,2}?(?:indicates|demonstrates|shows|states|suggests|confirms|reveals|says|notes|mentions|highlights|implies|establishes)\\s+that\\s+`,
  "iu", // u: NARRATION_SUBJECT's modifier gap uses \p{L} — without the flag the class silently matches literal braces
);
const CUT_RES = [
  new RegExp(
    // waits?|waiting and looks?|looking measured live 2026-08-18: a NYC-
    // weather turn with real forecast pages fetched and offered drafted
    // "The user is waiting for more information about the weather." and
    // "The user is looking for the weather in New York." across three
    // consecutive turns — the same register this list already names, two
    // verb lemmas it had not yet seen.
    // relate[sd]? measured live 2026-08-19 (the same turn as the modifier
    // gap above): "The 1960 World Series question … is directly related to
    // baseball playoffs" — the register's shape exactly, one verb lemma it
    // had not yet seen. Extended together with holon.js's
    // DIALOGUE_NARRATION_RE, per the standing rule: the two lists name the
    // same measured register and must not drift apart.
    // The optional comma-PAIR group is the measured appositive ("…question,
    // «the quoted question itself», is directly related…") — explicitly
    // delimited, so the clause-boundary discipline of the narrow verb gap
    // is kept rather than widened.
    `^\\s*${NARRATION_SUBJECT}(?:\\s*,[^,\\n]*,)?\\s+(?:\\w+\\s+){0,2}?(?:asks?|asked|aims?|wants?|wanted|focuse[sd]|transitions?|discusse[sd]|begins?|starts?|revolves|details?|describe[sd]|provides?|provided|is\\s+about|is\\s+asking|seeks?|waits?|waiting|looks?|looking|relate[sd]?|relates|relating)\\b`,
    "iu", // u: NARRATION_SUBJECT's modifier gap uses \p{L}
  ),
  // Measured live 2026-08-19 ("who was abraham lincoln's vice president?",
  // gemma2:2b, real Wikipedia material): a two-sentence draft opened "This
  // biographical passage details the life of Hannibal Hamlin…" (caught by
  // the determiner+noun pattern above, which already carries "details?")
  // and continued "It details his time serving as Vice President…" — the
  // SAME register, SAME verb, but the anaphoric "it" carried a narrower,
  // separately-maintained verb list that never had "details" on it, so
  // only one of the two narration sentences was cut, the mass-majority
  // test read under 50%, and the whole narrated draft shipped uncaught —
  // silently starving the completeness gate downstream too, since a
  // narration-framed sentence never binds a "Lincoln —VP→ X" claim for it
  // to check. Extended with the exact source-describing verbs already
  // measured and shipped on the determiner+noun pattern above
  // (details?|describe[sd]|provides?|provided|highlights?|outlines?) —
  // propagating an already-earned vocabulary to the pronoun case it was
  // missing from, not a new guess.
  /^\s*it\s+(?:then\s+)?(?:asks?|aims?|transitions?|shifts?|moves|focuse[sd]|discusse[sd]|goes\s+on|details?|describe[sd]|provides?|provided|highlights?|outlines?)\b/i,
  /conversation\s+so\s+far(?:,)?\s+in\s+one\s+line/i,
  // Measured live 2026-08-20 (gemma2:2b, eval/material-dialogue-stress.mjs,
  // real short pasted material — the Great Barrier Reef topic, two
  // consecutive turns): holon.js's OWN "incomplete"-mode correction prompt
  // (`buildRedefinedPart`) hands the model a literal instructional sentence
  // — "The record confirms exactly this, and nothing beyond it, even if
  // other names or claims sit nearby in the material below: <findings>." —
  // and the model, rather than following the instruction, COPIED it into
  // the shipped answer nearly verbatim, twice in a row: "The material
  // confirms exactly this, and nothing beyond it." and "The record confirms
  // exactly this, and nothing beyond it, even if other names or claims sit
  // nearby in the material below." A different register from DEFLATE_RE's
  // "confirms THAT X" shape (there X is real content worth keeping) — here
  // the "complement" is the instruction's own meta-commentary, or (the same
  // turns' second occurrence) a colon introducing a restatement already
  // present elsewhere in the sentence, so this is a CUT, never a DEFLATE.
  // "record" — the template's own exact word, one NARRATION_SUBJECT's noun
  // list had not yet seen — was added there in the same pass. Narrowed to
  // "exactly this/it/:" specifically (never bare "confirms exactly \w+")
  // so a genuine figure ("confirms exactly 79 percent") is never at risk.
  new RegExp(`^\\s*${NARRATION_SUBJECT}\\s+confirms\\s+exactly\\s*(?:this\\b|it\\b|:)`, "iu"),
];
const FALSE_REFUSAL_RE =
  /\b(?:as\s+an\s+ai\b|i'?m\s+(?:just\s+)?an?\s+(?:ai|language\s+model|model)\b|it'?s\s+a\s+model\b|i\s+(?:can'?t|cannot|don'?t\s+have)\s+(?:direct\s+)?access)\b/i;

/**
 * Fenced code spans (```…```), byte-exact including indentation — structure,
 * never framing, the same invariant holon.js's own framing-cut already
 * scars for ("measured live on a fenced Python block, which arrived at the
 * page as one flat line"). Returns non-overlapping [start, end) ranges;
 * an unterminated fence at end-of-text still counts, since a truncated
 * generation is the case where preserving the fence matters most.
 */
function codeFenceSpans(text) {
  const spans = [];
  const re = /```[^\n]*\n[\s\S]*?(?:```|$)/g;
  let m;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length });
  return spans;
}

const insideFence = (spans, at, end) => spans.some((f) => at < f.end && end > f.start);

export function stripNarrationSentences(text, { discourse = "", hasMaterial = false } = {}) {
  const raw = String(text ?? "");
  const fences = codeFenceSpans(raw);
  const foldedDiscourse = discourse ? String(discourse).toLowerCase().replace(/\s+/g, " ") : "";
  const removed = [];
  // Fenced code is structure, never narration (the same exemption holon.js's
  // isFraming carries): no sentence overlapping a fence is ever cut, and no
  // whitespace inside one is ever reflowed (codeFenceSpans above — two
  // sessions converged on this fix the same day, 2026-08-19: the tail
  // normalization collapsed a Python block's indentation; a checking layer
  // may only SUBTRACT the narration it names, never degrade the base).
  let out = "";
  let cursor = 0;
  for (const sentence of splitSentences(raw)) {
    const s = sentence.trim();
    if (!s) continue;
    const at = raw.indexOf(s, cursor);
    if (at < 0) continue; // bail — this sentence stays wherever it is
    // A sentence that falls inside a fence is code, not narration — indented
    // Python split on newlines by splitSentences is not prose to classify.
    if (insideFence(fences, at, at + s.length)) continue;
    const foldedS = s.toLowerCase().replace(/\s+/g, " ");
    const isEcho = foldedDiscourse.length >= 24 && foldedS.length >= 24 && foldedDiscourse.includes(foldedS.slice(0, 60));
    const isCut =
      CUT_RES.some((re) => re.test(s)) || isEcho || (hasMaterial && FALSE_REFUSAL_RE.test(s));
    if (isCut) {
      out += raw.slice(cursor, at);
      removed.push(s);
      // Swallow the sentence and its trailing punctuation/space run.
      let end = at + s.length;
      const tail = raw.slice(end).match(/^[.!?…]*\s*/);
      end += tail ? tail[0].length : 0;
      cursor = end;
      continue;
    }
    const m = s.match(DEFLATE_RE);
    if (m) {
      out += raw.slice(cursor, at);
      removed.push(m[0].trim());
      const rest = s.slice(m[0].length);
      out += rest.charAt(0).toUpperCase() + rest.slice(1);
      cursor = at + s.length;
      continue;
    }
    // Untouched: emit up to and including this sentence as-is.
    out += raw.slice(cursor, at + s.length);
    cursor = at + s.length;
  }
  out += raw.slice(cursor);
  if (!removed.length) return { text: raw, removed: [] };
  // The whitespace cleanup closes gaps a cut left behind — but a blanket
  // regex over the WHOLE string is the same mistake in a new shape: it once
  // collapsed indentation inside a fence that no cut ever touched, just
  // because a cut happened somewhere else in the same draft. The fix is to
  // never let the cleanup see fenced regions at all: recompute fences on
  // `out` (untouched fences keep their byte offsets relative to each other
  // even though the surrounding prose shrank) and clean only the prose
  // segments between them, splicing the fences back in byte-exact.
  const outFences = codeFenceSpans(out);
  let cleaned = "";
  let p = 0;
  for (const f of outFences) {
    cleaned += cleanProse(out.slice(p, f.start));
    cleaned += out.slice(f.start, f.end);
    p = f.end;
  }
  cleaned += cleanProse(out.slice(p));
  return { text: cleaned.trim(), removed };
}

function cleanProse(s) {
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
}

export function classifySentences(answer, attributions = [], findings = [], relationClaims = []) {
  const byText = new Map(attributions.map((a) => [a.text, a]));
  // A relation claim anchors to the sentence that carries its subject AND
  // its verb — the relation reader splits sentences with the engine's own
  // splitter, which need not agree with cite.js's, so the words are the
  // identity, never the split (the findSentence lesson, at claim scale).
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ");
  const carries = (text, c) => {
    const t = norm(text);
    return t.includes(norm(c.end1)) && t.includes(norm(c.label));
  };
  return splitSentences(answer).map((text) => {
    const a = byText.get(text);
    const absent = findings
      .filter((f) => f.text && text.includes(f.text))
      .map((f) => f.text);
    return {
      text,
      ground: a && (a.cited || a.ref) ? "material" : "model",
      ref: a?.ref ?? null,
      absent: [...new Set(absent)],
      // The edge verdicts standing in this sentence (hypergraph.js) — read
      // off the relation report, measured nowhere here, same discipline as
      // every other field.
      edges: relationClaims.filter((c) => carries(text, c)),
    };
  });
}

/**
 * Where each classified sentence sits inside `text`, in order, as byte
 * offsets — `{ start, end, entry }[]`, non-overlapping, ascending.
 *
 * FOUND LIVE (2026-09-09): app.js's own renderer used to run this exact
 * search (`findSentence`, injected here rather than imported — the same
 * "splitSentences is injected" convention chain-reason.js already states,
 * since app.js's copy carries no DOM dependency of its own) once PER
 * RENDER FRAGMENT, after render.js had already split the block's raw text
 * at every inline-emphasis boundary (`**bold**`, `` `code` ``). A sentence
 * with emphasis ANYWHERE inside it — routine on exactly the figures and
 * names a checked answer most wants to mark, e.g. "The Berlin Wall fell
 * in **1989**." — was then torn across fragments no single one of which
 * ever contained the sentence's own text, so the search failed on EVERY
 * fragment and the sentence fell through to plain, unclassified prose:
 * zero `.sent` markup, zero ground chip, not even the ladder's own
 * unconditional bottom rung, because the wrapping code never ran at all.
 * A sentence's identity is its words, never the pieces some later
 * splitter tore it into — the same lesson `classifySentences`'s own
 * `carries()` above already draws for relation claims, at render-fragment
 * scale instead of claim scale.
 *
 * The fix is ordering, not a new match rule: run this ONCE against the
 * text BEFORE anything downstream is free to fragment it (app.js's
 * `renderTaggedBlocks` calls this per render.js block — a paragraph, one
 * heading, one list item, all still carrying their own inline emphasis
 * markup intact — never per already-emphasis-split chunk). Pure: no DOM,
 * same discipline as every other export here.
 */
export function sentenceSpans(text, classified, findSentence) {
  const spans = [];
  const full = String(text ?? "");
  let rest = full;
  let base = 0;
  for (const entry of classified) {
    const hit = findSentence(rest, entry.text);
    if (!hit) continue;
    spans.push({ start: base + hit.at, end: base + hit.at + hit.len, entry });
    base += hit.at + hit.len;
    rest = rest.slice(hit.at + hit.len);
  }
  return spans;
}
