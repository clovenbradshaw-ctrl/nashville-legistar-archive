// native/adapters/text/meeting-turns.js — the meeting-transcript medium's
// grammar: which stretch of a transcript is whose asserted claim, and how
// it lands as that speaker's own held belief.
//
// Mirrors adapters/chat/user-turns.js exactly, one register over: where
// that file turns a person's own CHAT TURNS into perspective operations,
// this file turns a MEETING ATTENDEE's own spoken sentences into the same
// shape — one body per resolved speaker (organs/speaker.js's meetingSections
// activation binding), landed via a thin analogue of theory-of-mind.js's
// userOperation, parametrized by an arbitrary holder instead of the fixed
// USER constant (there is exactly one chat partner; a meeting has many).
// The kernel never imports this file; the caller wires them (the same S6
// split user-turns.js states for itself).
//
// THE ATTENDEE'S WORDS ARE THE ATTENDEE'S CLAIMS — NEVER A PARAPHRASE. Same
// discipline as user-turns.js: a sentence's own trimmed text is the claim
// the speaker holds. This file does not extract, classify, or interpret
// what a speaker MEANT.
//
// WHY THIS EARNS THE PARLIAMENT. Once every bound speaker's sentences land
// as their own held beliefs, kernel/theory-of-mind.js's parliament(folds)
// can adjudicate them against each other on a shared question — surfacing a
// real position contest (one attendee's own account of their duties against
// another attendee's stated understanding of the same duties) as a typed
// disagreement, not something a reader has to notice by re-reading the
// whole transcript. A meeting recorded with no speaker boundaries at all
// (an ASR transcript nobody ran meetingSections over) has nothing here to
// fold — the same typed absence meetingSections/speakerAt already give.
//
// DISCLOSED, NOT ASSUMED: the DMD coherence leg's trajectory (kernel/
// theory-of-mind.js's universeOf, keyed by each operation's own witness)
// is degenerate at one-op-per-witness granularity — every witness this
// adapter mints (`sentence:<n>`) carries exactly one operation, so the
// trajectory a caller reads off it is a flat count of 1s, not a varying
// discovery rate. universeOf's MATERIAL leg (does this speaker hold any
// belief at all) is meaningful at this granularity; its COHERENCE leg is
// not verified to be, and a caller should read `evaluable`/`coherent`
// with that in mind rather than trust them as a settled signal — the same
// posture this codebase holds for every other unverified operating point.
//
// PRIORS INJECTED, NEVER OWNED (P3), the same as user-turns.js: which token
// is interrogative, which is a stopword — received closed classes, arriving
// as arguments with their givers named by the caller.

import { perspectiveOperation, STANCE, BASIS } from "../../kernel/perspective.js";
import { mindHolder } from "../../kernel/theory-of-mind.js";

const tok = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** A stable body id for a resolved speaker name — the same holder a
 *  persistent, cross-meeting gallery entry would use, so a later fold
 *  across many meetings' logs finds the same being. Never derived from
 *  content beyond the name itself: two different spellings of one person
 *  are the identity-resolution step's job (verify_identity.py), not this
 *  adapter's. */
export function speakerHolder(name) {
  const slug = String(name ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new TypeError("speakerHolder: a speaker is named by a resolved name — an unnamed speaker is not this function's to guess");
  return `entity:speaker:${slug}`;
}

/**
 * One meeting sentence, spoken by one bound speaker -> one held belief (or
 * a typed gap). Mirrors user-turns.js's userTurnOperation exactly, one
 * register over: `holder` here is the SPEAKER's own body (from
 * speakerHolder), never the fixed USER constant, since a meeting has many
 * speakers where a chat has one.
 *
 * @param {string} sentence
 * @param {object} opts
 *   holder          the speaker's own body id (speakerHolder(name)), or
 *                    null when the sentence falls outside any bound
 *                    stretch (front matter, or before the first boundary)
 *   index           the sentence's ordinal — the witness address, required
 *   mind            string|null — the frame this sentence was spoken under
 *   interrogatives  Map<string,string>|null — priors.js's
 *                   INTERROGATIVE_PRONOUNS (who->person, ...)
 *   stop            Set<string>|null — closed-class tokens carrying no
 *                   claim (tokenize's own STOPWORDS)
 */
export function speakerSentenceOperation(sentence, { holder = null, index = null, mind = null, interrogatives = null, stop = null } = {}) {
  const raw = typeof sentence === "string" ? sentence : String(sentence?.text ?? "");
  const trimmed = raw.trim();
  if (!trimmed) {
    return { gap: { type: "empty_sentence", detail: "an empty sentence holds nothing — nothing is claimed" } };
  }
  if (!holder) {
    return { gap: { type: "unbound_speaker", detail: "a sentence outside any meetingSections stretch has no declared speaker — front matter, one register over from speakerAt's own rule; never a nearest-guess" } };
  }
  if (index == null) {
    return { gap: { type: "unaddressed_sentence", detail: "a sentence is claimed by its own words AND addressed by its own ordinal — a witness is required (P5.2)" } };
  }

  const tokens = tok(trimmed);
  const content = stop instanceof Set ? tokens.filter((t) => t.length > 1 && !stop.has(t)) : tokens.filter((t) => t.length > 1);
  if (!content.length) {
    return { gap: { type: "no_content", detail: "the sentence carries no content token beyond closed classes — filler is a sentence, never a held claim" } };
  }

  const witness = `sentence:${index}`;
  const head = tokens[0];
  const trailingAsk = /[?？]$/.test(trimmed);
  const openingAsk = interrogatives instanceof Map && interrogatives.has(head);
  const kind = trailingAsk || openingAsk ? "ask" : "assertion";

  const target = mind ? mindHolder(holder, mind) : holder;
  const op = perspectiveOperation({
    holder: target,
    claim: trimmed,
    stance: STANCE.HOLDS,
    basis: BASIS.ASSERTED,
    witness,
    operator: kind === "ask" ? "DEF" : null,
  });

  return { kind, claim: trimmed, witness, op, holder: target, mind: mind ?? null };
}

/**
 * Walk a meeting transcript's own sentences, bound against organs/
 * speaker.js's meetingSections, into one DeltaFold@1 log PER SPEAKER — each
 * ready for `foldUniverseAt`/`universeOf`(entityForWhom({holder, ...}), {
 * entries: log.operations }) unchanged (kernel/theory-of-mind.js).
 *
 * `splitSentences` is injected (P3) — this adapter carries no sentence
 * splitter of its own. A sentence whose start offset falls in no section's
 * span (front matter, or a stretch before any roll-call/recognition fired)
 * lands a typed `unbound_speaker` gap, kept on `gaps` — never silently
 * dropped, and never bound to a nearest guess.
 */
export function meetingToSpeakerLogs(text, sections, { splitSentences, interrogatives = null, stop = null, mind = null } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("meetingToSpeakerLogs: splitSentences is injected (P3) — this adapter carries no sentence splitter of its own");
  const src = String(text ?? "");
  const secs = Array.isArray(sections) ? sections : [];
  const sentences = splitSentences(src);
  const byHolder = new Map();
  const gaps = [];

  sentences.forEach((s, i) => {
    const sentText = typeof s === "string" ? s : String(s?.text ?? "");
    const offset = typeof s === "object" && Number.isFinite(s?.start) ? s.start : src.indexOf(sentText);
    const section = secs.find((sec) => offset >= sec.start && offset < sec.end);
    const holder = section ? speakerHolder(section.speaker) : null;
    const mindKey = typeof mind === "function" ? mind(section, i) : (mind ?? null);
    const out = speakerSentenceOperation(sentText, { holder, index: i, mind: mindKey, interrogatives, stop });
    if (out.gap) { gaps.push({ sentenceIndex: i, speaker: section?.speaker ?? null, ...out.gap }); return; }
    if (!byHolder.has(out.holder)) byHolder.set(out.holder, { schema: "DeltaFold@1", speaker: section.speaker, org: section.org, operations: [], gaps: [] });
    byHolder.get(out.holder).operations.push(out.op);
  });

  return { logs: Object.fromEntries(byHolder), gaps };
}
