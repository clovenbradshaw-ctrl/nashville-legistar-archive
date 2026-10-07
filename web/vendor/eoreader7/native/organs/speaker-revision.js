// speaker-revision.js -- speaker attribution as a chain of REVISABLE
// assertions, following spiral-contract.js's own contract (low gate sets
// possibility, high gate sets probability, a failing high gate names the
// missing signal and licenses a bounded revision, the revised product
// supersedes the old one while the old one stays on the record) rather
// than writing one flat, final `speaker` label per boundary. The user's
// own words: "all revisable assertions."
//
// This does not call spiral-contract.js's runLayer() directly -- runLayer
// revises ONE product repeatedly until its high gate passes or a budget
// runs out; speaker attribution is a SCAN over many small per-section
// decisions, which does not fit that shape. What's reused is the
// CONTRACT: a low/high gate pair, a revision that names what's missing
// and is bounded by a real budget, and a history that is appended to,
// never overwritten. spiral-contract.js's own header invites exactly
// this ("the caller supplies the shape").
//
// Why this module exists (measured, not assumed): organs/speaker.js's
// turnMarkerBoundaries() only binds a name when a clean 2-4-word proper
// noun sits in the <=80 characters before a ">>" marker. On two real
// meeting transcripts this session, ">>" occurs 260 and 189 times (a
// dense, real turn-taking signal -- these are not quiet meetings), yet
// only 4-6 boundaries per meeting get a bound name. The gap is not that
// speaker changes are rare; it is that most turns don't re-announce a
// name. A meeting's own convention -- once someone is introduced or
// recognized by the chair, they keep talking until someone else is -- is
// exactly organs/speaker.js's existing "a section runs until the next
// heading" rule, just not yet extended across a RUN of un-named
// turn-marker sections. This module extends it, honestly bounded.
//
// Usage
//   import { attributeWithRevision } from "./speaker-revision.js";
//   const sections = meetingSections(transcriptText);   // organs/speaker.js
//   const revised = attributeWithRevision(sections);
//   // revised[i].assertions is the FULL history for that section, oldest
//   // first; revised[i].current is the last entry (today's best reading).
//   // revised[i].speaker / .org are left untouched -- this module never
//   // mutates meetingSections()'s own output fields, only adds to it.

/** How many consecutive un-named turn-marker sections a declared speaker
 * may be persisted across before this module refuses to keep guessing.
 * Disclosed, unvalidated: chosen because it is roughly the turn-count of
 * a short multi-person back-and-forth in the sampled transcripts, not
 * measured against a labelled ground truth. Treat it as a knob to
 * re-check once real corrections come back (a human, or a voice-print
 * cross-check), the same way audio_profile.py's SAME_SPEAKER_COSINE is
 * flagged as a starting point rather than a settled constant. */
export const PERSISTENCE_MAX_GAP = 8;

/** A section shorter than this many characters is NEVER eligible for
 * "persisted" confidence, regardless of gap. This exists because testing
 * this module against real transcripts found ">>" densely marking ROLL
 * CALLS -- "Drew Freeman? >> Present, conflict. >> Make sure you use the
 * mic. >> Uh, thank you. Present, conflict. >> ..." -- where ">>" means a
 * genuine speaker change almost every time, and persisting one name
 * across a run of these would mislabel many different people's one-line
 * responses as a single person. Measured section-length percentiles on
 * two real transcripts put the short, roll-call-like cluster at or below
 * ~22 characters (p25) and the median at 70-93 characters; 40 is a
 * disclosed, unvalidated choice sitting between those, not a fitted
 * cutoff -- re-check against labelled ground truth before trusting it
 * near its edges. */
export const MIN_PERSIST_CHARS = 40;

/** A section matching this pattern is NEVER eligible for "persisted"
 * confidence, regardless of length or gap. Found by inspecting real
 * "persisted" output that survived the length gate: a conflict-of-
 * interest roll-call disclosure ("Present, conflict, COC-funded
 * agency.") is a full, well-formed sentence -- long enough to clear
 * MIN_PERSIST_CHARS -- but it is still one of many DIFFERENT people
 * each saying a structural variant of the same formula, not one person
 * continuing to talk. Measured on two real transcripts: 15-18 matches
 * out of 189-260 total turn-markers, concentrated in what reads as an
 * opening attendance/conflict-of-interest roll call. A high-precision,
 * intentionally narrow pattern -- it will miss roll-call responses that
 * don't use this exact wording, which is a real, disclosed recall gap,
 * not a claim of catching every roll call. */
const ROLL_CALL_FORMULA_RE = /resent,?\s*(?:no\s+)?conflict/i;

/** The low/high gate pair for ONE section's attribution, in
 * spiral-contract.js's own shape: `low` asks whether there is anything at
 * all to work with; `high` asks whether the current candidate is strong
 * enough to act on, and names what's missing when it is not. */
export const sectionGate = {
  low(candidate) {
    const has = !!(candidate && candidate.value);
    return { pass: has, basis: has ? `candidate speaker "${candidate.value}"` : "no candidate speaker at all -- nothing to work with" };
  },
  high(candidate) {
    if (!candidate || !candidate.value) return { pass: false, basis: "no candidate", missing: "candidate" };
    if (candidate.confidence === "declared") {
      return { pass: true, basis: `declared at this boundary (${candidate.how})`, missing: null };
    }
    if (candidate.sectionChars != null && candidate.sectionChars < MIN_PERSIST_CHARS) {
      return { pass: false, basis: `section is only ${candidate.sectionChars} chars -- at or below the roll-call-response length range, where ">>" most likely marks a genuine change to a DIFFERENT, unidentified speaker`, missing: "substantial-length-or-corroboration" };
    }
    if (candidate.sectionText != null && ROLL_CALL_FORMULA_RE.test(candidate.sectionText)) {
      return { pass: false, basis: `section matches the conflict-of-interest roll-call formula ("...present, conflict...") -- a well-formed sentence, but one of many different people's near-identical disclosures, not evidence of continued speech by the persisted name`, missing: "corroboration" };
    }
    if (candidate.gap > PERSISTENCE_MAX_GAP) {
      return { pass: false, basis: `${candidate.gap} unnamed turn(s) since the last declared speaker -- past the persistence ceiling (${PERSISTENCE_MAX_GAP})`, missing: "fresh-declaration-or-corroboration" };
    }
    return { pass: true, basis: `persisted from the last declared speaker, ${candidate.gap} turn-marker(s) back, section ${candidate.sectionChars} chars (ceiling ${PERSISTENCE_MAX_GAP} turns / floor ${MIN_PERSIST_CHARS} chars)`, missing: null };
  },
};

/**
 * attributeWithRevision(sections, text) -> sections, each with an added
 * `.assertions` array (append-only history, oldest first) and `.current`
 * (a convenience alias for the last entry). `sections` is organs/
 * speaker.js's meetingSections() output; `text` is the SAME transcript
 * text those sections' start/end offsets were computed against -- passed
 * through so the roll-call-formula check can read each section's own
 * words, not just its length. `text` is optional; omitting it disables
 * only the formula check (sectionChars-based gating still works off
 * start/end alone). This function does not mutate the objects it's
 * given -- it returns new ones.
 */
export function attributeWithRevision(sections, text = "") {
  const list = Array.isArray(sections) ? sections : [];
  const out = [];
  let lastDeclared = null; // {value, org, how}
  let gap = 0;

  for (const s of list) {
    const assertions = [];

    if (s.speaker) {
      // A declared boundary always wins outright, regardless of how it
      // was found. This is the low gate passing trivially (there IS a
      // candidate) and the high gate passing on "declared" confidence --
      // no revision needed, nothing to name as missing.
      const candidate = { value: s.speaker, org: s.org ?? null, how: s.how, confidence: "declared", gap: 0 };
      const low = sectionGate.low(candidate);
      const high = sectionGate.high(candidate);
      assertions.push({ ...candidate, lowGate: low, highGate: high, supersedes: null });
      lastDeclared = { value: s.speaker, org: s.org ?? null, how: s.how };
      gap = 0;
      out.push({ ...s, assertions, current: assertions[assertions.length - 1] });
      continue;
    }

    // No declared name at this boundary -- this IS the revision case.
    // First, the un-revised candidate: nothing.
    const empty = { value: null, org: null, how: s.how, confidence: "none", gap: null };
    const emptyLow = sectionGate.low(empty);
    assertions.push({ ...empty, lowGate: emptyLow, highGate: null, supersedes: null });

    if (!lastDeclared) {
      // Low gate already failed (no candidate at all) -- correctly
      // nothing to revise into. Stays unattributed, honestly.
      out.push({ ...s, assertions, current: assertions[assertions.length - 1] });
      continue;
    }

    // The bounded revision this module licenses: persist the last
    // declared speaker, one gap-step further than the section before.
    // The gate is checked on the ATTEMPT first; only a passing high gate
    // earns "persisted" confidence in the recorded assertion -- a failed
    // attempt is still kept on record (attemptedValue + highGate.basis),
    // matching "revisable assertions", but is not asserted as true.
    gap += 1;
    const sectionChars = Math.max(0, (s.end ?? 0) - (s.start ?? 0));
    const sectionText = text ? text.slice(s.start ?? 0, s.end ?? 0) : null;
    const attempt = { value: lastDeclared.value, org: lastDeclared.org, gap, sectionChars, sectionText };
    const persistedHigh = sectionGate.high({ ...attempt, confidence: "persisted" });
    const recorded = persistedHigh.pass
      ? { value: attempt.value, org: attempt.org, confidence: "persisted" }
      : { value: null, org: null, confidence: "none" };
    assertions.push({ ...recorded, how: s.how, gap, sectionChars, attemptedValue: attempt.value, lowGate: sectionGate.low(attempt), highGate: persistedHigh, supersedes: 0 });

    if (!persistedHigh.pass && persistedHigh.missing === "fresh-declaration-or-corroboration") {
      // Past the GAP ceiling specifically -- too much distance since the
      // last declaration, so the thread goes cold rather than guessing
      // further, and a later declared boundary must re-establish it.
      lastDeclared = null;
    }
    // A failure on length alone ("substantial-length-or-corroboration")
    // does NOT go cold: a short roll-call-style response says nothing
    // about whether the same person is still speaking once a longer
    // section comes along again, so lastDeclared and gap both carry
    // forward unchanged for the next section to try. This module has no
    // second revision strategy yet for either failure mode -- that is
    // where a future voice-print cross-check would plug in, as its own
    // additional assertion, corroborating or overriding "persisted"
    // rather than replacing this history.

    out.push({ ...s, assertions, current: assertions[assertions.length - 1] });
  }

  return out;
}

/** Summary counts for a quick, honest report -- never printed as if it
 * were the corpus's final word on who spoke, since "persisted" entries
 * are a bounded guess, not a declaration the transcript itself made. */
export function summarize(revisedSections) {
  const counts = { declared: 0, persisted: 0, none: 0 };
  for (const s of revisedSections) {
    const c = s.current?.confidence ?? "none";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return { total: revisedSections.length, ...counts };
}
