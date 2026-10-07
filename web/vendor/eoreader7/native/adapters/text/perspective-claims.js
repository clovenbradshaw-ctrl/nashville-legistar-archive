// adapters/text/perspective-claims.js — the subassembly between pronoun
// binding and the claim tier, factored out of the nested-narration driver so
// it is testable in isolation (an eval driver is not a test).
//
// Four small organs, each pure, each with one job:
//
//   castSurfaceMap      — a cast's surfaces -> referent ids, one Map
//   bindNarrationFrames — resolvePronouns run PER TELLER FRAME, returning
//                         bound SENTENCE RANGES (start/end in book bytes)
//   pronounResolver     — the range join: (surface, offset) -> referentId,
//                         with every stage counted so a silent no-match is
//                         visible (the NaN-range bug below is why)
//   claimEndKey         — how an arrangement's end becomes a claim key:
//                         referent id > frame's narrator (first person) >
//                         bound pronoun > bare surface
//
// FRAME-SCOPED BY CONSTRUCTION: bindNarrationFrames runs the organ inside
// one teller's stretch at a time, so a frame's "he" is never resolved
// against a name occurring only in another teller's stretch — P1's
// never-carry-a-window rule, one level in. The coref prior states it for
// first person ("same string, three referents, split by scope"); third
// person inherits it here.
//
// THE BUG THIS FILE'S COUNTERS EXIST FOR (P5.5): the first inline cut read
// `.start`/`.end` off splitSentences, which returns {text, offset, order}.
// Every range came out NaN, the join matched nothing, and binding itself
// still ran and reported 632 bound sentences — the failure was silent at
// every level except the claim tier's unchanged totals. Counting each stage
// of the join (pronounEnds / inBoundRange / tokenMatch) is what found it,
// and the counters stay as the module's own output.
//
// PRIORS INJECTED, NEVER OWNED (P3/S6): the first-person closed class and
// the recall operating point arrive as arguments with their givers named by
// the caller. This file carries no pronoun list and no thresholds.

import { splitSentences } from "./spans.js";
import { resolvePronouns } from "./pronouns.js";

/** A cast's surfaces -> referent display ids. Accepts host sessionReferents'
 * own shape ({display, surfaces:[{surface}|string]}). */
export const castSurfaceMap = (referents = []) => {
  const map = new Map();
  for (const ref of referents) {
    for (const s of [ref?.display, ...(ref?.surfaces ?? []).map((x) => x?.surface ?? x)]) {
      if (typeof s === "string" && s.trim()) map.set(s.trim(), ref.display ?? ref.id);
    }
  }
  return map;
};

/**
 * Run resolvePronouns inside each narration frame, returning bound sentence
 * RANGES in book-byte space plus a per-frame tally.
 *
 * `text` is the stripped material; `offset` its byte offset in the received
 * file (stripContainer's own contract); frames carry byteStart/byteEnd in
 * book bytes (attribution.js's own contract). `recall` is the declared
 * {minActivation, minMargin} — the caller's to declare, never defaulted
 * here (resolvePronouns itself throws without them).
 *
 * `resolve` picks the MECHANISM — thematic echo (resolvePronouns, the
 * default) or the reader's decaying present (resolvePronounsByActivation,
 * partially applied with its own declared window/floor). Same frame
 * scoping, same range join, either way: the mechanism is the one moving
 * part, so two runs differ in exactly one dimension.
 */
export const bindNarrationFrames = ({ frames = [], text, offset = 0, surfaceToReferent, recall, resolve = resolvePronouns }) => {
  const boundSentences = [];
  const perFrame = [];
  for (const frame of frames) {
    const local = text.slice(frame.byteStart - offset, frame.byteEnd - offset);
    // splitSentences returns {text, offset, order} — the range is the
    // sentence's own offset plus its own length, nothing else. (See header:
    // reading .start/.end here is the NaN bug.)
    const sentences = splitSentences(local).map((s, i) => ({
      text: s.text,
      order: i,
      start: s.offset + frame.byteStart,
      end: s.offset + s.text.length + frame.byteStart,
      offset: s.offset + frame.byteStart,
    }));
    const { bindings, gaps } = resolve(sentences, surfaceToReferent, recall);
    const byOrder = new Map(sentences.map((s) => [s.order, s]));
    for (const b of bindings) {
      const sent = byOrder.get(b.sentenceOrder);
      if (sent) boundSentences.push({ start: sent.start, end: sent.end, referentId: b.referentId, pronoun: String(b.pronoun ?? "").toLowerCase() });
    }
    perFrame.push({ narrator: frame.narrator, sentences: sentences.length, bound: bindings.length, refused: gaps.length });
  }
  boundSentences.sort((a, b) => a.start - b.start);
  return { boundSentences, perFrame };
};

/**
 * The range join, with its reach counted. `pronounTokens` is the closed
 * class of tokens the join may even attempt — injected (the binding organ's
 * own class, via its bindings' `pronoun` field), so this file never owns a
 * pronoun list. Returns { resolve, counters }.
 */
export const pronounResolver = (boundSentences = []) => {
  const tokens = new Set(boundSentences.map((b) => b.pronoun));
  const counters = { pronounEnds: 0, inBoundRange: 0, tokenMatch: 0 };
  const resolve = (surface, byteOffset) => {
    const want = String(surface ?? "").trim().toLowerCase();
    if (!want || !Number.isFinite(byteOffset)) return null;
    if (tokens.has(want)) counters.pronounEnds += 1;
    for (const b of boundSentences) {
      if (byteOffset < b.start) break;
      if (byteOffset < b.end) {
        if (tokens.has(want)) counters.inBoundRange += 1;
        if (b.pronoun === want) { counters.tokenMatch += 1; return b.referentId; }
      }
    }
    return null;
  };
  return { resolve, counters };
};

/**
 * How an arrangement's end becomes a CLAIM key, in priority order:
 *   1. an already-resolved referent id — taken at its word
 *   2. first person -> the FRAME'S narrator (the injected closed class
 *      decides what counts as first person; giver named by the caller)
 *   3. a pronoun the binding organ bound in this sentence -> that being
 *   4. the bare surface, lowercased — the honest floor
 */
export const claimEndKey = (participant, frameHolder, { offset, resolvePronoun, firstPerson } = {}) => {
  if (participant?.standing === "referent" && typeof participant.ref === "string" && participant.ref.startsWith("ref:")) return participant.ref;
  const surface = String(participant?.surface ?? "").trim();
  if (surface && firstPerson?.test?.(surface)) return `holder:${frameHolder}`;
  const bound = resolvePronoun ? resolvePronoun(surface, offset) : null;
  if (bound) return bound;
  return participant?.surfaceKey ?? `surface:${surface.toLowerCase().replace(/\s+/g, "_")}`;
};
