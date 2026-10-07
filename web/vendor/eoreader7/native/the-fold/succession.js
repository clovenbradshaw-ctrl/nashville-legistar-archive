// succession.js — Wikipedia-style succession-box field parsing, pure.
//
// Disclosed scope: this reads ONE shape of material — an infobox rendered as
// plain text, ordinal + office title ("15th Vice President of the United
// States"), an "In office" line, a "President <name>" line, and "Preceded
// by"/"Succeeded by" lines — the exact shape Wikipedia's own succession
// boxes take once extracted to text. It is not a general infobox parser and
// does not try to be; a table shaped any other way is silently outside it.
//
// Why this exists as its own module rather than a widened hypergraph.js
// vocabulary: window/proximity approaches (character-window sizes 20-400)
// were tried and rejected first, and rejected on the merits, not for want of
// tuning — in one succession box the WRONG filler sits closer to the
// president's name than the RIGHT one, and in another box the distances
// reverse. That is a category error (prose-adjacency assumptions applied to
// a FIELD-structured record), not a threshold to hunt for, so this reads the
// fields as fields.
//
// The three exports compose: parseSuccessionBoxes splits the material into
// records and reads each record's own fields; resolveBoxSubjects works out
// WHO actually held each record's office (the record itself, per Wikipedia's
// own convention, never states its own subject's name — only who preceded
// and succeeded them); officeHolderGroups is the completeness signal —
// every (office, president) pairing with two or more distinct confirmed
// holders is the true filler set a caller should check an answer against.

import { foldTypography } from "../organs/source.js";
import { namesIn, splitSentences } from "../organs/cite.js";
import { chainFillers } from "./chains.js";

// A record's own title line: "<ordinal><suffix> <office> of the United
// States". The office phrase is deliberately NOT hardcoded to "Vice
// President"/"President" — Wikipedia types a great many offices this way
// ("United States Senator" does not, and stays outside this pattern by
// design; see the parsing note below on why that is fine) — only the "of
// the United States" root is fixed, because that is the one shape this pass
// is licensed against (Wikipedia's, not infoboxes generally).
const TITLE_RE = /^(\d+)(?:st|nd|rd|th)\s+(.+?)\s+of the United States$/i;
const IN_OFFICE_RE = /^In office$/i;
const PRECEDED_RE = /^Preceded by\s+(.+)$/i;
const SUCCEEDED_RE = /^Succeeded by\s+(.+)$/i;
const PRESIDENT_RE = /^President\s+(.+)$/;

const isTitleLine = (line) => TITLE_RE.test(line);

const findFirst = (lines, re) => {
  for (const line of lines) {
    const m = re.exec(line);
    if (m) return m[1].trim();
  }
  return null;
};

const parseBox = (lines) => {
  const titleMatch = TITLE_RE.exec(lines[0] ?? "");
  return {
    ordinal: titleMatch ? Number(titleMatch[1]) : null,
    office: titleMatch ? titleMatch[2].trim() : null,
    presidentName: findFirst(lines, PRESIDENT_RE),
    precededBy: findFirst(lines, PRECEDED_RE),
    succeededBy: findFirst(lines, SUCCEEDED_RE),
    lines,
  };
};

/**
 * Split raw material into succession-box records. A new record starts at a
 * title line (matched regardless of what preceded it — the title line IS
 * the record's own boundary) or at a blank line (a box's fields never
 * straddle one). Absent either, lines accumulate into the CURRENT record —
 * this is deliberate, not a gap: Wikipedia sometimes runs a second,
 * differently-shaped record (a Senate seat, a diplomatic post) directly
 * against a succession box with no blank line between them, and that
 * record's own fields have no title line of this shape to start a fresh box
 * on. Its lines still land somewhere; findFirst above always reads the
 * FIRST occurrence of each field, so the record's own true fields (which
 * come first, since the title line — when there is one — is always line
 * zero) are read correctly and the trailing, unrelated fields are inert
 * noise for a caller not asking about that record.
 */
export function parseSuccessionBoxes(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const boxes = [];
  let current = [];
  const flush = () => {
    if (current.length) boxes.push(parseBox(current));
    current = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isTitleLine(line) && current.length) flush();
    current.push(line);
  }
  flush();
  return boxes;
}

// foldTypography-normalized substring match, both directions — the same
// rule holon.js's own incompleteClaimsOf already uses to decide whether a
// draft's wording covers a material filler, applied here to two names
// instead of a claim object and a filler object.
export const namesMatch = (a, b) => {
  if (!a || !b) return false;
  const fa = foldTypography(String(a)).toLowerCase();
  const fb = foldTypography(String(b)).toLowerCase();
  return fa.includes(fb) || fb.includes(fa);
}

// A "candidate name" for the direct-anchor test (step 2): a run of
// capitalised words that is not itself a "President <name>" or "Vice
// President <name>" mention. That exclusion is load-bearing, not
// decorative — namesIn's own capitalised-run matching glues "President"
// onto the name that follows it ("President Abraham Lincoln" is ONE run),
// so without the exclusion a sentence naming both the office-holder being
// anchored and the president they served under would always read as two
// candidates and refuse every anchor a biographical sentence could ever
// supply. Filtering out the president MENTION (an office reference, never a
// candidate filler for a different office's slot) is the same distinction
// this module's own presidentName field already draws.
const TITLE_ATTACHED_RE = /^(?:Vice President|President)\b/;
// "United States" itself is the one other structural phrase this module's
// own TITLE_RE already treats as fixed furniture ("of the United States"),
// not a candidate filler — without this a biographical sentence naming the
// office ("...the 15th vice president of the United States...") reads
// "United States" as a second candidate purely because it is capitalised,
// and refuses an anchor a real sentence plainly supports.
const STRUCTURAL_PHRASE_RE = /^United States$/i;
const candidateNamesIn = (sentence) =>
  namesIn(sentence).filter((n) => !TITLE_ATTACHED_RE.test(n) && !STRUCTURAL_PHRASE_RE.test(n));

// A record's own structural lines are never eligible to anchor themselves —
// stated directly in the validated algorithm this module implements ("a
// box's own fields cannot anchor themselves"). Preceded by/Succeeded
// by/In office lines are excluded because the algorithm names them
// explicitly; a title line is excluded for the identical reason one level
// up — it is where a record's OWN ordinal and office come from, and
// counting it as a "prose sentence" about that same ordinal would be
// circular. (It also happens to contain a "vice president" phrase glued to
// nothing but "of the United States" — every capitalised word in it reads
// as a spurious single "candidate name" once the title-attached exclusion
// above strips the office phrase itself, which is exactly the false anchor
// this exclusion prevents.)
const isStructuralLine = (s) =>
  isTitleLine(s) || IN_OFFICE_RE.test(s) || PRECEDED_RE.test(s) || SUCCEEDED_RE.test(s);

const ANCHOR_RE = /(\d+)(?:st|nd|rd|th)\s+vice president/i;

// A THIRD-PERSON SUBJECT PRONOUN STANDING IN THE ORDINAL PHRASE'S OWN
// SUBJECT SLOT means this sentence never names its own referent at all —
// whatever OTHER capitalized name happens to sit in the same sentence (an
// object, a genitive, someone else's fate) is not evidence of who the
// anchor refers to, and trusting it is a mis-attribution, not a coverage
// gap. Found live, 2026-09-23, on a real Wikipedia specimen: "The 16th vice
// president, he assumed the presidency following the assassination of
// Abraham Lincoln." names Johnson (the true office-holder) only as "he";
// Lincoln is the sentence's one capitalized name, sitting as the object of
// "assassination of" — and the old rule ("exactly one candidate name
// licenses the anchor") trusted it anyway, anchoring ordinal 16 to Lincoln.
// Checked in both of English's two ordinary ways to coreference an ordinal
// phrase with a pronoun — the appositive ("the Nth X, he …") and the
// predicate nominal ("He was the Nth X …") — each in a TIGHT window right
// against the ordinal-phrase match, not a scan of the whole sentence: a
// pronoun elsewhere in a long sentence (referring to something else
// entirely) must not veto a genuinely name-bearing anchor. Refused, never
// guessed — the same posture a 2+-candidate sentence already gets.
const THIRD_PERSON_SUBJECT_RE = /^(?:he|she|it|they|this|that)$/i;
const pronounStandsForOrdinal = (sentence, matchIndex, matchEnd) => {
  const after = sentence.slice(matchEnd, matchEnd + 24).match(/^[\s,;—-]*([\p{L}']+)/u);
  if (after && THIRD_PERSON_SUBJECT_RE.test(after[1])) return true;
  const before = sentence.slice(Math.max(0, matchIndex - 24), matchIndex).match(/([\p{L}']+)\s+(?:was|is|became|served as|serves as)\s+(?:the\s+)?$/iu);
  if (before && THIRD_PERSON_SUBJECT_RE.test(before[1])) return true;
  return false;
};

const buildDirectAnchors = (text) => {
  const anchors = new Map();
  for (const sentence of splitSentences(String(text ?? ""))) {
    if (isStructuralLine(sentence)) continue;
    const m = ANCHOR_RE.exec(sentence);
    if (!m) continue;
    if (pronounStandsForOrdinal(sentence, m.index, m.index + m[0].length)) continue;
    const names = candidateNamesIn(sentence);
    // Exactly one candidate name licenses the anchor; zero or two-or-more
    // both refuse it — never a guess among several.
    if (names.length === 1) anchors.set(Number(m[1]), names[0]);
  }
  return anchors;
};

/**
 * Resolve each box's SUBJECT — who actually held that record's office —
 * recursively, memoized, with a cycle guard. A direct anchor (a prose
 * sentence naming the ordinal and exactly one candidate) settles it
 * outright; otherwise the chain rule: if the PREVIOUS ordinal's box already
 * resolved a subject, and THIS box's own precededBy field names that same,
 * already-resolved subject (not merely the previous box's raw succeededBy
 * text — the cross-check is against the RESOLVED subject, which is the bug
 * the validated algorithm this implements was built to avoid repeating),
 * and the previous box's succeededBy field is non-null, then THIS box's
 * subject is the previous box's succeededBy NAME. Any failed condition —
 * missing anchor, no previous box, a precededBy mismatch, a null
 * succeededBy — resolves to null. Never a fallback guess.
 */
export function resolveBoxSubjects(boxes, text) {
  const anchors = buildDirectAnchors(text);
  const byOrdinal = new Map();
  for (const box of boxes) if (box.ordinal != null && !byOrdinal.has(box.ordinal)) byOrdinal.set(box.ordinal, box);

  const memo = new Map();
  const inProgress = new Set();

  const resolve = (ordinal) => {
    if (memo.has(ordinal)) return memo.get(ordinal);
    if (inProgress.has(ordinal)) return null; // cycle guard
    inProgress.add(ordinal);
    let subject = null;
    if (anchors.has(ordinal)) {
      subject = anchors.get(ordinal);
    } else {
      const box = byOrdinal.get(ordinal);
      const prevBox = byOrdinal.get(ordinal - 1);
      if (box && prevBox) {
        const prevSubject = resolve(ordinal - 1);
        if (prevSubject && box.precededBy && namesMatch(box.precededBy, prevSubject) && prevBox.succeededBy) {
          subject = prevBox.succeededBy;
        }
      }
    }
    inProgress.delete(ordinal);
    memo.set(ordinal, subject);
    return subject;
  };

  return boxes.map((box) => ({ ...box, subject: box.ordinal == null ? null : resolve(box.ordinal) }));
}

/**
 * The completeness signal: every (office, president) pairing with two or
 * more distinct CONFIRMED holders — a box that actually resolved a subject
 * (step 4) under that president (step 5's match). A name that only ever
 * appears in someone else's precededBy/succeededBy field, and never as a
 * box's own confirmed subject, is never counted here — that is exactly what
 * keeps a predecessor or successor named in passing from being mistaken for
 * a holder nobody's own record confirmed.
 */
export function officeHolderGroups(resolvedBoxes) {
  const groups = new Map();
  for (const box of resolvedBoxes) {
    if (!box.subject || !box.office || !box.presidentName) continue;
    const key = `${foldTypography(box.office).toLowerCase()}|${foldTypography(box.presidentName).toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { office: box.office, president: box.presidentName, holders: [] };
      groups.set(key, group);
    }
    if (!group.holders.some((h) => namesMatch(h, box.subject))) group.holders.push(box.subject);
  }
  return [...groups.values()].filter((g) => g.holders.length >= 2);
}

// The "In office" date line's own year span. Deliberately NOT
// void-shape.js's `yearSpansIn` — that function's own header discloses its
// scope as BARE four-digit spans ("1861-1865"); Wikipedia's actual "In
// office" line is full dates on both sides of the dash ("March 4, 1861 –
// April 15, 1865"), which yearSpansIn's connector-adjacency regex cannot
// match (found live, building this: it silently returned zero spans on
// every real box). Reading it correctly needs the box's OWN field
// structure, not a wider general regex — the exact reason this module
// exists as a separate reader in the first place (this file's own header).
// The date line is always the line immediately after the one matching
// IN_OFFICE_RE; every run of four digits on it is a year, first is FROM,
// last is TO — a month/day never contributes a 4-digit run.
const FOUR_DIGIT_RE = /\p{Nd}{4}/gu;
// The SAME line's own full dates, when it states them. Added 2026-08-27 on
// direct direction ("drill down to the actual dates not just the years"),
// and the Johnson record is the argument for it: his vice presidency ran
// March 4, 1865 to April 15, 1865, which as a YEAR span is "1865-1865" — a
// degenerate extent that says nothing at all. Years are the right unit for
// COMPARING two spans (they are what `void-shape.js` can order and subtract,
// and its own `hasSpan` requires `Number.isFinite` on both ends); they are
// the wrong unit for SAYING one. So both are carried, and neither is asked
// to do the other's job.
//
// Unicode classes, not `[A-Z][a-z]+` — the same rule L2 already holds this
// repo to on capitalisation generally, and the same reason `FOUR_DIGIT_RE`
// above is `\p{Nd}` rather than `[0-9]`: an English month name is what this
// specimen happens to carry, not what the pattern is entitled to assume.
const FULL_DATE_RE = /\p{Lu}\p{Ll}+\s+\p{Nd}{1,2},\s*\p{Nd}{4}/gu;
const officeSpanOf = (box) => {
  const idx = box.lines.findIndex((l) => IN_OFFICE_RE.test(l));
  const dateLine = idx >= 0 ? box.lines[idx + 1] : null;
  if (!dateLine) return null;
  const years = [...dateLine.matchAll(FOUR_DIGIT_RE)].map((m) => Number(m[0]));
  if (years.length < 2) return null;
  const from = Math.min(...years);
  const to = Math.max(...years);
  if (from > to) return null;
  // Positional first/last, deliberately NOT min/max: a date's TEXT is the
  // line's own wording and has no ordering of its own to compute. The two
  // readings are then required to AGREE before either text is attached —
  // if the first stated date's year is not the span's own start, this line
  // is shaped some way this reader does not actually understand, and the
  // honest result is the year span alone rather than a precise-looking date
  // that came from a misread. Refusing beats asserting (P41's own rule: a
  // check may report what it checked, never speak for one it did not run).
  const dates = [...dateLine.matchAll(FULL_DATE_RE)].map((m) => m[0]);
  if (dates.length < 2) return { from, to };
  const fromText = dates[0];
  const toText = dates[dates.length - 1];
  const yearIn = (d) => Number(String(d).match(/\p{Nd}{4}/u)?.[0]);
  const fromYear = yearIn(fromText);
  const toYear = yearIn(toText);
  if (fromYear !== from || toYear !== to) return { from, to };
  return { from, to, fromText, toText };
};

/**
 * successionFillers — the void's own fillers, structurally, from THIS
 * reader's own confirmed set, never a second discovery pass.
 *
 * CORRECTED 2026-08-27, on direct challenge ("'box subjects' is a wikipedia
 * specific, office of, all of this is designed to solve this one problem
 * when what we need is a universal system for answering any question").
 * The first cut of this function did its OWN grouping and its OWN
 * "does this box belong to a confirmed multi-holder set" check, baked to
 * office/president vocabulary — a second, narrower copy of exactly the
 * chain-verification chains.js now owns generically. succession.js's job
 * shrinks to what is genuinely genre-specific and nothing more: turning
 * Wikipedia's own box shape into GENERIC records — {id, prev, next, seq,
 * fields} — and reading one record's own extent off its own field
 * structure (`officeSpanOf`). Grouping, cross-checked-pointer verification,
 * and closure grading are `chains.js::chainFillers`'s, unchanged, and would
 * be identical code for a version history, a chain of custody, or a
 * championship's own title-holder sequence — this function never repeats
 * that logic, it feeds it.
 *
 * `resolveBoxSubjects` still does its own genre-specific resolution first
 * (a box's own text never states its own subject — only who preceded and
 * succeeded them) — that reading is not redundant with chainFillers's own
 * verification underneath it: `chainFillers` independently re-checks the
 * SAME precededBy/succeededBy pointers against each box's already-resolved
 * subject, structurally, through generic machinery, rather than trusting
 * one resolution pass blindly (the same "check it a second way" posture
 * this repo already holds testimony.js's sibling-swap and P36's
 * squarePolarity to).
 *
 * `matches` defaults to this module's own `namesMatch` — bidirectional
 * substring containment, with the disclosed gap `chains.test.mjs` now pins
 * directly (a period-abbreviated initial does not resolve to its full name
 * by containment alone; the real fix is a referent index, not attempted
 * here). A caller with a real one (cast.js's `makeReferentIndex`) injects
 * it in `matches`'s place.
 */
export function successionFillers(anchor, texts, { matches = namesMatch } = {}) {
  const anchorRe = anchor
    ? new RegExp(String(anchor).split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i")
    : null;
  const records = [];
  const bySubject = new Map(); // subject id -> its own box, for officeSpanOf
  for (const text of texts ?? []) {
    const boxes = resolveBoxSubjects(parseSuccessionBoxes(text), text);
    for (const box of boxes) {
      if (!box.subject || !box.office || !box.presidentName) continue;
      if (anchorRe && !anchorRe.test(box.presidentName)) continue;
      records.push({
        id: box.subject,
        prev: box.precededBy,
        next: box.succeededBy,
        seq: box.ordinal,
        fields: { office: foldTypography(box.office).toLowerCase(), president: foldTypography(box.presidentName).toLowerCase() },
      });
      bySubject.set(box.subject, box);
    }
  }
  const fillers = chainFillers(records, {
    groupBy: (r) => `${r.fields.office}|${r.fields.president}`,
    spanOf: (r) => officeSpanOf(bySubject.get(r.id)),
    matches,
  });
  return fillers.map(({ _record, ...f }) => f);
}
