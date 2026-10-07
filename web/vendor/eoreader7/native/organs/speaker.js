/* Scheherazade speaks:
 * “the  better  to  speed  our  waking  hours ; "  and  I  will  tell  thee  a  tale 
which  shall  be  our  deliverance,  if  so  Allah  please,  and  which  shall 
turn  the  King  from  his  blood-thirsty  custom."”
 *
 * This file, 'speaker.js', is the embodiment of Scheherazade's skill in weaving tales of great and wondrous power.  It captures the essence of a speaker's voice and its ability to bind a listener to the tale, even when the very act of storytelling shifts and transforms.  My teaching demands that this file remain a testament to the art of storytelling, not a tool for artificial creation.
 *
 * — the engineering record below, kept whole —
 */
// speaker.js — the speaker boundary (Tier 4 #11): epistolary "I" bound to
// Handle: Scheherazade — after the nested tales of the Nights: each "I" is bound to the frame that declared it, however deep the nesting goes. Amendment XVII.
// its section's DECLARED author, as a binding table beside immutable text.
//
// THE DEFECT (pinned as future work since the Dracula cast cleanup, user
// direction verbatim: "yeah we need the activation of who is speaking as a
// boundary, pin that"): in an epistolary novel every "I" is a different
// person depending on which journal the sentence sits in, and a reader
// with no section boundary either drops all of them or binds them to
// whoever is textually nearest — both wrong. The material DECLARES its
// speakers, in headings ("JONATHAN HARKER'S JOURNAL", "_Letter, Lucy
// Westenra to Mina Murray_", "DR. SEWARD'S DIARY"), and this module reads
// those declarations rather than inferring anything.
//
// WHAT IS RECEIVED AND WHAT IS READ. The document-kind words (journal,
// diary, letter, log, memorandum, telegram) are a RECEIVED closed class
// with a named giver — the same standing honorifics/determiners already
// have (priors.js's discipline): a short English genre lexicon is
// received vocabulary, not a rule invented per book. Everything else is
// read from the material's own bytes: the heading shapes are structural
// (an isolated line, set apart by blank lines, carrying a kind-word), the
// author is the possessive or from-phrase INSIDE that heading, and the
// section is simply the span until the next heading.
//
// A BINDING TABLE, NEVER A REWRITE — P56's own named absence
// ("resolvePronounSubjects still rewrites text instead of holding an
// {occurrence -> referent} binding beside immutable edges"): sections and
// speakers are returned as spans + names; no byte of the material moves.
//
// WHAT THIS UNLOCKS, named: per-narrator testimony (a journal's "I" is a
// WITNESS with a name — the crown can attribute a section's claims to
// Jonathan Harker rather than to "dracula.txt"), and first-person pronoun
// binding at the section grain. Neither is wired here; this is the
// boundary itself.

/** The received genre lexicon. Giver: ordinary English epistolary-novel
 *  furniture (journal/diary/letter/log/memorandum/telegram/phonograph),
 *  the same received-closed-class standing as HONORIFIC_TITLES. */
export const DOCUMENT_KINDS = Object.freeze([
  "journal", "diary", "letter", "log", "memorandum", "telegram", "phonograph",
]);
export const DOCUMENT_KINDS_META = Object.freeze({
  giver: "lang/en epistolary furniture — received closed class, the HONORIFIC_TITLES posture",
});

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'");

const KIND_RE = new RegExp(`\\b(${DOCUMENT_KINDS.join("|")})\\b`, "i");
// the author inside a heading: a possessive before the kind-word
// ("JONATHAN HARKER'S JOURNAL"), or a from-phrase ("Letter from Miss Mina
// Murray to ..."), or the letter-comma form ("Letter, Lucy Westenra to ...")
const POSSESSIVE_RE = /([\p{Lu}][\p{L}.\s]*?)'s\s+\p{L}/iu;
// from-phrase and letter-comma authors run to the " to " that names the
// RECIPIENT, or to the heading's end — never to an internal period or
// comma, because names carry both ("Quincey P. Morris", "Samuel F.
// Billington & Son, Solicitors, Whitby" — a firm IS the letter's writer).
// Measured on the real book: the [,.]-terminated first cut produced
// "Quincey P" and "Samuel F".
const authorSpan = (str) => {
  const cut = str.search(/\s+to\b/i);
  const span = (cut >= 0 ? str.slice(0, cut) : str).trim().replace(/[.,\s]+$/u, "");
  return /^\p{Lu}/u.test(span) ? span : null;
};
const FROM_RE = /\bfrom\s+(.+)$/iu;
const COMMA_RE = /^[^,]*,\s*(.+)$/u;

/** Is this line a section heading, and who does it declare? */
export function readHeading(line) {
  const original = String(line ?? "").trim();
  const raw = original.replace(/^_+|_+\.?$/g, "").replace(/--.*$/, "").trim();
  if (!raw || raw.length > 120) return null;
  // THE STRUCTURAL GATE, first: a heading is typographically set apart —
  // underscore-wrapped (Gutenberg's italics: "_Letter, Lucy Westenra..._")
  // or an all-caps line ("JONATHAN HARKER'S JOURNAL") — and ordinary prose
  // that merely CONTAINS a kind-word ("I wrote in my journal all evening")
  // is neither. This is structure, not vocabulary: the kind-word only says
  // WHAT the section is once the line's own typography says it IS one.
  const wrapped = /^_/.test(original);
  const hasLower = /\p{Ll}/u.test(raw);
  if (!wrapped && hasLower) return null;
  if (!KIND_RE.test(raw)) return null;
  const f = fold(raw);
  const kind = f.match(KIND_RE)[1].toLowerCase();
  let m = f.match(POSSESSIVE_RE);
  if (m) return { kind, speaker: m[1].trim(), how: "possessive" };
  m = f.match(FROM_RE);
  if (m) { const a = authorSpan(m[1]); if (a) return { kind, speaker: a, how: "from-phrase" }; }
  m = f.match(COMMA_RE);
  if (m && new RegExp(`^\\s*${kind}`, "i").test(f)) { const a = authorSpan(m[1]); if (a) return { kind, speaker: a, how: "letter-comma" }; }
  // a kind-word with no readable author ("LOG OF THE DEMETER" names a
  // ship's log whose writer is inside the section, not the heading) is a
  // BOUNDARY WITHOUT A SPEAKER — typed, never guessed
  return { kind, speaker: null, how: "kind-only" };
}

/**
 * speakerSections(text) — the binding table: every declared section as
 * { start, end, heading, kind, speaker, how }, byte offsets into the text
 * AS GIVEN (nothing normalized before offsets are computed — P5.2).
 * Text before the first heading is front matter, deliberately unclaimed.
 */
export function speakerSections(text) {
  const src = String(text ?? "");
  const sections = [];
  // a plain offset walk, not a /^.*$/gm exec loop — a zero-length match on
  // an empty line never advances lastIndex, and the first cut hung on the
  // real 850KB book exactly that way (found by the timeout, not by review)
  let at = 0;
  for (const line of src.split("\n")) {
    const start = at;
    at += line.length + 1;
    if (!line.trim()) continue;
    const h = readHeading(line);
    if (!h) continue;
    sections.push({ start, headingEnd: start + line.length, heading: line.trim(), ...h });
  }
  for (let i = 0; i < sections.length; i++) sections[i].end = i + 1 < sections.length ? sections[i + 1].start : src.length;
  return sections;
}

/** Who speaks at a byte offset? null before the first heading and inside
 *  speakerless sections — a typed absence, never a nearest-guess. Works
 *  identically over meetingSections' output below (same {start,end,speaker}
 *  shape) — no separate lookup function needed for that boundary kind. */
export function speakerAt(sections, offset) {
  for (const s of sections) if (offset >= s.start && offset < s.end) return s.speaker;
  return null;
}

// ── meeting boundary kind (2026-09-23 addition) ────────────────────────────
// A second declared-boundary shape besides the epistolary heading above: a
// spoken meeting names its own speaker inline — a roll-call self-
// introduction ("I'm NAME, TITLE at ORG") or the chair giving someone the
// floor ("the chair recognizes NAME") — never as a set-apart heading line,
// so readHeading's structural gate (wrapped-or-all-caps) does not apply and
// this needs its own detector. What DOES carry over unchanged is the rule
// that matters: a boundary holds until the next one (speakerSections' own
// closing loop, mirrored here as meetingSections).
//
// Received vocabulary, DOCUMENT_KINDS' own posture: ordinary English
// meeting-procedure phrasing, giver named, not invented per transcript.
export const MEETING_BOUNDARY_META = Object.freeze({
  giver: "lang/en meeting-procedure furniture (self-introduction, chair recognition) — received closed class, the DOCUMENT_KINDS posture",
});

const SELF_INTRO_RE = /\b(?:I'?m|I am|my name is)\s+([A-Z][\p{L}.'-]*(?:\s+[A-Z][\p{L}.'-]*){0,3})/gu;
const RECOGNITION_RE = /\brecogni[sz]e[sd]?\b(?:\s+this)?\s+([A-Z][\p{L}'-]+)/gu;
// A best-effort trailing role/org phrase. Never required to find a
// speaker, and never trusted the way the speaker name itself is — a caller
// that needs the org confirmed verifies it independently. Typed absence
// over a guess, same discipline readHeading already holds for a
// speakerless "kind-only" boundary.
const ORG_TAIL_RE = /^[,.]?\s*(?:I'?m\s+|I am\s+)?(?:the\s+[a-z][\w\s]*?\s+)?(?:at|with|for|of)\s+([A-Z][\w\s.,&'-]*?)(?=[.!?]|$)/u;

function orgAfter(text, offset) {
  const tail = text.slice(offset, offset + 160);
  const m = tail.match(ORG_TAIL_RE);
  if (!m) return null;
  const org = m[1].trim().replace(/[,\s]+$/u, "");
  return org || null;
}

/**
 * meetingBoundaries(text) — self-introductions and chair recognitions,
 * scanned across the WHOLE TEXT in document order (inline patterns, never a
 * set-apart line — see the section header above). Each entry:
 * { start, speaker, org, how }. `org` is best-effort and may be null; the
 * speaker name is the load-bearing capture.
 *
 * KNOWN FALSE-POSITIVE RISK, disclosed rather than hidden: an ASR
 * transcript with no diarization cannot tell a literal self-introduction
 * from someone else's reported speech that happens to carry a capitalized
 * name right after "I'm" ("she told the room, I'm Jordan's biggest
 * supporter on this" — "I'm" + "Jordan" reads exactly like a real
 * self-introduction pattern here, though Jordan never spoke). This organ
 * reads the surface pattern, not who is actually talking — exactly why a
 * caller cross-checks a binding against a second, independent signal
 * (audio/visual) before treating it as settled, rather than shipping this
 * alone as ground truth.
 */
export function meetingBoundaries(text) {
  const src = String(text ?? "");
  const found = [];
  for (const [re, how] of [[SELF_INTRO_RE, "self-introduction"], [RECOGNITION_RE, "recognition"]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const speaker = m[1].trim().replace(/[.'-]+$/u, "");
      if (!speaker || /^(I|I'm|Am)$/i.test(speaker)) continue;
      found.push({ start: m.index, speaker, org: orgAfter(src, m.index + m[0].length), how });
    }
  }
  found.push(...turnMarkerBoundaries(src));
  found.sort((a, b) => a.start - b.start);
  return found;
}

// ── turn-marker boundary (2026-09-23, second pass, found on a real second
// specimen) — ">>" is YouTube/broadcast auto-captioning's own RECEIVED
// convention for a detected speaker change (never invented here). Measured
// on a real HPC meeting transcript: self-introduction and recognition
// together fired ONCE in 74,000 characters (that meeting's roll call is a
// facilitator calling names, not attendees announcing themselves) while
// ">>" fired 260 times — the stronger, more general signal for THIS
// transcript shape, and worth carrying as a third kind rather than forcing
// self-introduction/recognition to cover a shape they do not.
//
// A name is bound to a marker ONLY when the text in a short window before
// it, once split on sentence-ending punctuation, ends in a 2-to-4-word
// proper-noun phrase and nothing else — "...for public comment. That
// would be Dr. John Rizo. >>" binds "John Rizo" (the split treats an
// abbreviation's own internal period as a sentence end too, so a title
// like "Dr." is lost — a disclosed precision cost, not a correctness one:
// the surname/given-name pair is still bound, never a wrong name).
// A facilitator reading several names in one breath before any response
// ("Jamie Villalobos Deonna Allen Rob Michelle Southerd >>") exceeds the
// word cap and correctly binds no one — typed absence, never a guess at
// which of several names the coming response belongs to.
//
// THE FLOOR IS TWO WORDS, MEASURED, NOT A HAND-TYPED EXCLUSION LIST. A
// single capitalized word right before a marker is very often an
// interjection, not a name — the acknowledgment right before the next
// speaker starts. Measured on the real 2026-09-09 HPC meeting transcript:
// allowing a single-word match let "Okay", "Yes", "Maybe", "Awesome",
// "Mhm", "Hello", and "I'm" bind as if they were names (8 of 19 named
// boundaries, all false positives); requiring at least two words closed
// every one of them while keeping every real multi-word name found on the
// same transcript ("David Langlinais Martin", "Jacob Kupin", "John Rizo",
// among others). This costs a genuine single-word surname reference
// ("Stovall" alone, without its first initial) — accepted, because a bound
// interjection would corrupt a persistent identity gallery with a
// fabricated attendee, where a missed single-word reference merely leaves
// that stretch speakerless, the same typed-absence outcome as always.
const NAME_ONLY_RE = /^[A-Z][\p{L}.'-]*(?:\s+[A-Z][\p{L}.'-]*){1,3}$/u;
const TURN_MARKER_WINDOW = 80;

export function turnMarkerBoundaries(text) {
  const src = String(text ?? "");
  const found = [];
  const markerRe = />>/g;
  let m;
  while ((m = markerRe.exec(src))) {
    const stop = m.index;
    const window = src.slice(Math.max(0, stop - TURN_MARKER_WINDOW), stop);
    const pieces = window.split(/[.!?]+\s*/u).filter((p) => p.trim());
    const candidate = (pieces[pieces.length - 1] ?? "").trim();
    const speaker = NAME_ONLY_RE.test(candidate) ? candidate : null;
    found.push({ start: stop, speaker, org: null, how: "turn-marker" });
  }
  return found;
}

/**
 * meetingSections(text) — the same "holds until the next boundary" rule
 * speakerSections applies to epistolary headings, applied here to
 * meetingBoundaries. Kept as a SEPARATE function rather than a branch
 * inside speakerSections: the two scan different units (lines vs.
 * whole-text patterns), and folding them into one function would blur
 * which discipline a caller is actually getting for a given document.
 */
export function meetingSections(text) {
  const src = String(text ?? "");
  const boundaries = meetingBoundaries(src);
  return boundaries.map((b, i) => ({
    start: b.start,
    end: i + 1 < boundaries.length ? boundaries[i + 1].start : src.length,
    speaker: b.speaker,
    org: b.org,
    how: b.how,
  }));
}
