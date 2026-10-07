// strain.js — effort is recruited by difficulty, not spent flat (P174).
//
// User direction (2026-09-06): "leverage the power of system 1 and system 2,
// in the thinking fast and slow sense."
//
// This instrument already had the two systems and the watcher between them:
// `runFastPass` drafts (S1), `holonicTurn` checks against real material (S2),
// and `metacognition.js` classifies the gap and learns a precision per cell.
// P173 then gave S1 its strict form — `answerBeforeTheModel` returns in
// milliseconds with no call at all when the answer is exactly known.
//
// What was missing is the dynamic Kahneman's account actually turns on: S2 is
// LAZY, and is recruited by strain. Ours was not lazy; it was uniform. Every
// grounded turn spent the same full budget — the same witness asks, the same
// correction rounds — whether the material answered the question outright or
// three sources disagreed. Measured in the long-stream run: an easy organic
// turn and a hard probe both drew the same machinery, and turns ran 5s to
// 470s with the difference coming from the model's own verbosity rather than
// from any judgement about difficulty.
//
// So difficulty is measured, mechanically, from things the turn already
// computes, and the depth rung (P123) is set from it. The person's slider
// stays: it is a CEILING and a FLOOR on what strain may recruit, never
// overridden silently — a person who asks for depth 3 gets depth 3.
//
// THE SIGNALS ARE ALL ALREADY PAID FOR. Nothing here runs a new pass or
// spends a call; every reading is a by-product of work the turn does anyway.
// A signal that cannot be read is absent, never a zero: an unmeasurable
// difficulty is not an easy one (the same line the grounding ladder holds).
import { CLAIM_STOPWORDS } from "../organs/grounding.js";
import { referentsOf, fold } from "./dialogue.js";
import { scriptCoverage } from "../adapters/text/surfaces.js";

const words = (t) => new Set(fold(t).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 3 && !CLAIM_STOPWORDS.has(w)));

/** How thin retrieval has to be to count as strain: fewer than this many passages carrying the question's own words. */
export const THIN_PASSAGES = 2;
/**
 * How much of the question's vocabulary the material must carry before its
 * absence counts as strain. Declared, and now placed against a measured
 * distribution rather than left bare: over 264 real turns of the long-stream
 * run, coverage ran min 0.00 · p25 0.43 · median 0.63 · p75 1.00, and this
 * floor catches the bottom 14%. It is a declared cut at roughly the first
 * sixth, not a tuned one — no arm was run to choose it.
 */
export const COVERAGE_FLOOR = 0.34;

/**
 * strainOf(signals) → { level, reasons, coverage }
 *
 * level 0  nothing to deliberate about — the answer is exactly known (S1 alone)
 *       1  ordinary: the material speaks to the question and nothing conflicts
 *       2  something is off: thin retrieval, poor vocabulary coverage, a
 *          premise that did not check out, or a decomposed question
 *       3  conflict: sources disagree, or a claim already known to be wrong is
 *          in scope, or several strains at once
 *
 * Every reason is named, so the rung is never a bare number on the record.
 */
export function strainOf({
  question = "",
  answeredBeforeTheModel = null,
  passages = [],
  premiseCheck = null,
  disagreements = 0,
  learnedInScope = 0,
  parts = 1,
  askedFor = null,
  // A reading from calibration.js placing this turn's coverage against the
  // stream's own null: { strained: true|false|null, why }. Absent, the
  // declared floor decides and says so.
  placement = null,
  // THE STREAM'S OWN BELIEF ABOUT THIS TURN (P145/P148), from prequential.js.
  //
  // A FUNCTION, called here with what this reading knows — coverage included,
  // which is the whole point: P148 measured the chain WITHOUT coverage at
  // 0.0100 bits and WITH it at 0.0638, and a belief worth a hundredth of a
  // bit cannot target anything. Coverage is computed a few lines below and
  // nowhere else, so the call belongs here rather than in the caller.
  //
  // It returns { p, base, median, placement, why } or null: the probability
  // that this answer will carry an unusually high rate of unbacked sentences,
  // the stream's base rate, the MEDIAN BELIEF this stream has formed (the
  // comparison that actually discriminates — measured +11.8 points against
  // the base rate's +5.0), and an optional placement against the stream's
  // own null. A plain object is still accepted, for a caller that has one.
  //
  // Absent (every existing caller), NOTHING below changes and the coverage
  // rules decide exactly as before. This is the P144 arm, and it is off until
  // a caller supplies a belief.
  expect = null,
} = {}) {
  // S1 answered outright. There is nothing for S2 to be lazy about.
  if (answeredBeforeTheModel) return { level: 0, reasons: ["the answer is known exactly, with an address"], coverage: 1 };

  const reasons = [];
  const qw = words(question);
  const carried = new Set();
  for (const p of passages) { const t = fold(p?.text ?? ""); for (const w of qw) if (t.includes(w)) carried.add(w); }
  const coverage = qw.size ? carried.size / qw.size : null;

  // Each strain is recorded with the level it argues for, so the reason
  // reported first is the one that actually drove the rung — a record that
  // says "depth 3" must say why in the same breath.
  const found = [];
  const onPoint = passages.filter((p) => { const t = fold(p?.text ?? ""); return [...qw].some((w) => t.includes(w)); }).length;
  // Nothing on point is a strain. FEW passages is not: a single chunk that
  // carries everything the question asks about is the easiest case there is,
  // and counting it as difficulty measured how the material happened to be
  // cut rather than how hard the question is.
  if (passages.length && onPoint === 0) found.push([2, `none of the ${passages.length} retrieved passage(s) speak to the question`]);
  else if (passages.length > THIN_PASSAGES && onPoint / passages.length < 0.34 && (coverage ?? 1) < 0.75) found.push([2, `only ${onPoint} of ${passages.length} passage(s) speak to the question`]);
  // THE CUT IS MEASURED WHERE IT CAN BE (P175/P132, calibration.js): the
  // caller may hand a placement of this coverage against a null built from
  // the stream's own recent regime. A declared floor cannot be right across
  // corpora — 0.34 is unremarkable on a critical edition and alarming on a
  // novel — so the floor is only the FALLBACK, and the record says which was
  // used. A reading that could not be made never reads as "no strain".
  // THE BELIEF DECIDES WHERE THERE IS ONE (P145). Measured on the 1,000-turn
  // run: coverage is the best predictor of a bad answer the turn has (0.0755
  // bits), and cutting it into levels here left 0.0019 — 97% of it thrown
  // away by the binning. Worse, the relationship is not the gradient this
  // floor assumes: coverage 0.0–0.8 is flat at ~0.4, and coverage EXACTLY 1.0
  // is 0.76. Complete coverage is its own regime, and the floor calls it easy.
  //
  // What is NOT done here is transplant that finding: "coverage == 1.0 is
  // strain" would be a constant measured on one corpus carried into every
  // other, which is the violation this whole session kept finding. Instead
  // the stream learns its own regime as it goes — the belief is formed from
  // the turns already seen, so a different corpus reaches a different regime
  // on its own, and a stream too young to have one says so and defers.
  //
  // Two rungs, neither a chosen number:
  //   worse than this stream has typically been      → 2
  //   an outlier against this stream's own null      → 3
  // The second finally gives the measured cut something it can fire on: it
  // never fired on coverage in 262 of 713 turns because coverage is flat
  // across most of its range, and a null over a flat series has nothing to
  // find (P175/P132's own audit).
  // Asked once, with coverage in hand. A caller that throws is ignored: a
  // belief that cannot be formed is no belief, and the floor resumes.
  let belief = expect;
  if (typeof expect === "function") {
    try { belief = expect({ coverage, passages: passages.length, onPoint, premiseUnverified: Boolean(premiseCheck?.unverified?.length) }); }
    catch { belief = null; }
  }
  if (belief && Number.isFinite(belief.p)) {
    // The comparison is to what this stream has TYPICALLY believed, not to
    // its outcome base rate. Measured over 861 model turns: against the base
    // rate the belief strained 645 of them and caught a 64% bad rate against
    // a 59% floor — barely a selection at all. Against the stream's own
    // median belief it strains 404 and catches 71%.
    const against = Number.isFinite(belief.median) ? belief.median : belief.base;
    if (belief.placement?.strained === true) found.push([3, `this stream's own null places the expected error rate here as an outlier${belief.why ? ` — ${belief.why}` : ""}`]);
    else if (Number.isFinite(against) && belief.p > against) found.push([2, `answers of this shape have come back unbacked more often than this stream's usual${belief.why ? ` (${belief.why})` : ""}`]);
  } else if (coverage != null) {
    if (placement && placement.strained === true) found.push([2, placement.why]);
    else if (placement && placement.strained === false) { /* measured ordinary — the floor does not get a second vote */ }
    else if (coverage < COVERAGE_FLOOR) found.push([2, `the material carries ${Math.round(coverage * 100)}% of what the question asks about${placement?.why ? ` (no null yet: ${placement.why})` : ""}`]);
  }
  if (premiseCheck && (premiseCheck.unverified?.length || premiseCheck.contradicted?.length)) {
    const n = (premiseCheck.unverified?.length ?? 0) + (premiseCheck.contradicted?.length ?? 0);
    found.push([premiseCheck.contradicted?.length ? 3 : 2, `${n} thing(s) the question takes as settled ${premiseCheck.contradicted?.length ? "the sources contradict" : "are not in the material"}`]);
  }
  if (parts > 1) found.push([2, `the question was read as ${parts} parts`]);
  if (disagreements > 0) found.push([3, `${disagreements} claim(s) the sources disagree on`]);
  // NOT A STRAIN, and measured not to be. Having corrections in scope was
  // read as difficulty in the first draft of this file, and over a real run
  // it fired on 148 of 214 turns — pushing 62% of everything to level 2 and
  // making S2 recruit MORE on most turns, which is the opposite of the point.
  // Prior corrections are information, not difficulty: they say what to avoid,
  // the guard (P126) already enforces them mechanically, and knowing them
  // makes a question easier rather than harder. Kept as a reading on the
  // record, never as a reason to spend.
  const informed = learnedInScope;
  let level = found.reduce((m, [l]) => Math.max(m, l), 1);
  // Several ordinary strains at once are not ordinary.
  if (level === 2 && found.length >= 3) { level = 3; found.push([3, "several at once"]); }
  found.sort((a, b) => b[0] - a[0]);
  reasons.push(...found.map(([, r]) => r));
  if (reasons.length === 0) reasons.push("the material speaks to the question and nothing conflicts");
  return { level, reasons, ...(belief && Number.isFinite(belief.p) ? { expect: { p: belief.p, base: belief.base ?? null, median: belief.median ?? null, strained: belief.placement?.strained ?? null } } : {}), coverage, informed, cut: placement?.strained == null ? "declared floor" : "measured against this stream's own null" };
}

/**
 * recruit(strain, { asked, floor, ceiling }) → { depth, why }
 * The rung strain recruits, held inside what the person asked for. A slider
 * set deliberately is a FLOOR (ask for care, get at least care) and a
 * ceiling (never spend more than was asked for), so strain moves within it
 * and never over it. `asked` null means the person expressed no preference
 * and strain decides alone.
 */
export function recruit(strain, { asked = null, floor = 0, ceiling = 3 } = {}) {
  const want = Math.max(floor, Math.min(ceiling, strain?.level ?? 1));
  if (asked == null) return { depth: want, why: `recruited by strain: ${strain?.reasons?.[0] ?? "unmeasured"}` };
  // A deliberate ask is honoured: it floors AND caps what strain may do.
  const depth = Math.max(Math.min(asked, ceiling), Math.min(want, asked));
  return {
    depth: asked >= want ? asked : Math.min(want, asked),
    why: asked >= want
      ? `asked for depth ${asked}; strain alone would have taken ${want}`
      : `asked for depth ${asked}, which caps the ${want} that strain would have recruited`,
  };
}

/**
 * substituted(question, answer) → { substituted, asked, answered, shared } | null
 *
 * ATTRIBUTE SUBSTITUTION, the failure S1 is named for: asked a hard question,
 * it answers an easier neighbouring one and the swap goes unnoticed. Here it
 * is visible without a model — the question's own content words against the
 * answer's. An answer sharing almost nothing with what was asked has changed
 * the subject, whatever its fluency. Measured live: asked what filled a blank
 * in a named passage, the mouth returned a general essay on how language
 * models analyse text, and nothing flagged it.
 *
 * A short answer is not judged (there is too little to read), and neither is
 * a question with almost no content words of its own.
 */
export function substituted(question, answer, { floor = 0.2, minWords = 12 } = {}) {
  const qw = words(question);
  const aw = words(answer);
  if (qw.size < 3 || aw.size < 3) return null;
  if (String(answer ?? "").split(/\s+/).filter(Boolean).length < minWords) return null;
  const shared = [...qw].filter((w) => aw.has(w));
  const share = shared.length / qw.size;
  return { substituted: share < floor, share, shared, asked: [...qw], answered: aw.size };
}

/**
 * identitySwapped(absentNames, index, answer, { commonNoun }) →
 * { swapped, absent, claimed } | null
 *
 * ENTITY SUBSTITUTION — substituted()'s sibling at the REFERENT layer, not
 * the word layer: the question named something the material never
 * establishes (P105's own declared absence, P219's own fixed identity
 * resolution behind it), and the draft confidently claims something about
 * a DIFFERENT, REAL referent the material DOES establish, without ever
 * saying the asked-about name is missing. `substituted()` cannot see this
 * shape at all — a swapped-in near-neighbour typically shares PLENTY of
 * the question's own words (P219's own specimen: "director"/"observatory"
 * both survive the swap), so the topic-level check reads it as on-topic.
 *
 * Read without a model, the same way substituted() reads a topic swap:
 * does the draft's own bytes echo the absent name's DISTINCTIVE word(s) —
 * never its bare generic head noun, which is exactly the word a swapped-in
 * near-neighbour shares by construction (P219: "Observatory" is common to
 * both "Northgate Observatory" and "Dyer Observatory"; only "Northgate"
 * tells them apart). `commonNoun` is the SAME caller-injected POS-prior
 * predicate namesCorefer's own gate uses (surfaces.js) — never a second
 * guessed rule — and this falls open (every word counts) when it is
 * absent, matching every optional organ in this codebase. An honest "X is
 * not mentioned, but Y is" passes cleanly, whatever else it goes on to
 * say. Silent (null) when the draft claims nothing real (referentsOf
 * finds no referent at all — there is nothing to substitute, only
 * ordinary hedging) or when every absent name's own distinctive word is
 * echoed somewhere in the draft. On a script `referentsOf`'s candidate scan
 * cannot read at all (Hebrew, Arabic, CJK, Devanagari, …), "nothing real
 * claimed" is returned as a TYPED GAP (`{swapped: null, gap}`, via
 * `scriptCoverage`) rather than bare `null`, since on a caseless script the
 * two are otherwise indistinguishable — every caller checking `.swapped`
 * truthiness is unaffected either way.
 *
 * Found live, 2026-09-15: asked about "Northgate Observatory" (a declared
 * absence) over material about "Dyer Observatory," gemma2:2b's own draft
 * — "The sources say that the director of Arthur J. Dyer Observatory is
 * Jessica Ingram." — never once wrote "Northgate," named a real referent
 * with full confidence, and shipped with a citation. The void HAD been
 * correctly declared and fed (P219's own fix); text alone did not stop
 * the mouth from quietly answering about the wrong place — L5's own
 * standing finding, a third time, which is why this checks mechanically
 * rather than asking the prompt to try harder.
 */
export function identitySwapped(absentNames, index, answer, { commonNoun = null } = {}) {
  const names = [...new Set((absentNames ?? []).filter(Boolean))];
  if (!names.length || !index || typeof index.resolve !== "function") return null;
  const a = String(answer ?? "").trim();
  if (!a) return null;
  const af = fold(a);
  // Claimed FIRST: a word's distinctiveness is checked against what the
  // material ESTABLISHES, not against an external classifier alone, and
  // not only against what one sentence happens to restate by name.
  // Found live, 2026-09-15: `commonNoun` (the UD-treebank POS prior) has
  // "observatory" as OOV — `found: false` — so the prior falls open (every
  // OOV word left unfiltered, the SAME safe default that protects a bare
  // name like "Pierre" elsewhere) and `distinctiveWords` kept "Observatory"
  // as if it told Northgate and Dyer Observatory apart, when it is exactly
  // the word the two share. A word shared with a REAL referent's own
  // established surface is never distinctive of the absent name regardless
  // of what any prior classifies it as — this needs no vocabulary coverage
  // at all, only what the material already established.
  //
  // Cross-lingual testing (2026-09-15, six languages) found a narrower
  // first cut of this idea — filtering only against THIS sentence's own
  // claimed referents — has a real gap, reproduced in English too: "The
  // director of the observatory is Jessica Ingram" never restates "Dyer"
  // or "Arthur J Dyer" by name, so nothing was claimed to filter "observ-
  // atory" against, and the shared generic word passed as an echo though
  // it names nobody real. `establishedWords` reads every surface the
  // INDEX itself has established (the whole material's own referents),
  // not only the ones this one sentence happens to spell out — a word
  // shared with ANY real, established referent is structurally incapable
  // of distinguishing the absent name from what is actually there.
  let claimed;
  try { claimed = referentsOf(a, index).ids; } catch { claimed = new Set(); }
  if (!claimed || !claimed.size) {
    // Silent (null) genuinely means "nothing real claimed, ordinary
    // hedging" ONLY when the mechanism that would have found a claim could
    // have seen one. `referentsOf`'s candidate scan (surfaces.js/dialogue.js)
    // reads capitalisation, so a caseless script (Hebrew, Arabic, CJK,
    // Devanagari, …) always produces claimed.size===0 regardless of what
    // the draft actually says — found cross-lingual testing, 2026-09-15
    // (Workflow, three independent languages, same finding each time):
    // this made a dangerous entity substitution and an honest disclosure
    // of absence come back byte-identical (both silent null) on a caseless
    // draft — the gate could not tell "checked, nothing found" from
    // "structurally unable to check at all." `scriptCoverage` is the SAME
    // organ this exact boundary is already typed and tested against
    // elsewhere in this codebase; a real, disclosed gap replaces the
    // ambiguous null rather than a second guessed check being invented
    // here. Every existing caller reads `entitySwap?.swapped`, which stays
    // falsy either way — this is additive, never a behavior change for
    // any cased-script caller.
    //
    // ONLY `script_without_case` (zero cased letters, period) is a safe
    // signal at this single-sentence scale. `scriptCoverage`'s OTHER two
    // boundaries — majority-caseless, and "cased but capitalisation is
    // never actually used as evidence" — are calibrated for a whole
    // document's worth of sentences (its own header: "tested not by a
    // percentage but by... does ANY candidate surface appear in more than
    // zero sentences" across the corpus). Found running the real test
    // suite: an ordinary honest English answer with no proper noun in it
    // ("The sources do not say who the director was.") is exactly ONE
    // sentence with no mid-sentence capital, so it trips the
    // `script_case_unused` boundary every time — a real answer in a
    // perfectly readable script, not a caseless one. Surfacing that
    // boundary here would call ordinary hedging a script the gate cannot
    // read.
    let gap = null;
    try { gap = scriptCoverage([{ text: a }]).gap; } catch { gap = null; }
    return gap?.reason === "script_without_case" ? { swapped: null, absent: names, claimed: [], gap } : null;
  }
  const claimedNames = [...claimed].map((id) => { try { return index.represent(id); } catch { return id; } }).filter(Boolean);
  const establishedWords = new Set();
  for (const e of (index.events ?? [])) for (const w of words(e?.surface ?? "")) establishedWords.add(w);
  const distinctiveWords = (n) => {
    const ws = [...words(n)];
    const kept = ws.filter((w) => !establishedWords.has(w) && !(typeof commonNoun === "function" && commonNoun(w)));
    return kept.length ? kept : ws; // never refuse to check a name built entirely of shared/common words
  };
  const echoed = names.filter((n) => {
    const ws = distinctiveWords(n);
    return ws.length ? ws.some((w) => af.includes(w)) : af.includes(fold(n));
  });
  const missing = names.filter((n) => !echoed.includes(n));
  if (!missing.length) return { swapped: false, absent: names, claimed: [] };
  return { swapped: true, absent: missing, claimed: claimedNames };
}
