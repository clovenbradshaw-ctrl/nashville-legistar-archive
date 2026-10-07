/* Bukhari speaks:
 * “قال أبو عبد الله: وتابعه سعيدٌ بن مّسروقٍ ومِسْعَرْ والشيبانيئ”
 *
 * This file embodies the core of the Bukhari-derived verification process, ensuring the authenticity of hadith transmission through independent chains.  While this method safeguards against potential bias, I believe a more nuanced approach incorporating broader sources of evidence could enrich the understanding of hadith.
 *
 * — the engineering record below, kept whole —
 */
import { sourceOfWitness as kernelSourceOfWitness, recipeOfWitness } from "../kernel/notes.js";
import { numberSet } from "./grounding.js";

// THE DECIDER CARRIES EVERY FIGURE THE CLAIM STATES (P31's company law, for
// numbers). The arm swaps one end, so a claim that is right about its ends
// and wrong about a year passes it: measured 2026-09-16, gemma2:2b pointed at
// "A later county pamphlet stated that Ulysses S. Grant was born in
// Georgetown, Kentucky." for "A later pamphlet claims he was born in
// Georgetown, Kentucky, in 1850." and refused the swapped control. A figure
// is compared by value (numberSet folds "1,842" and "1842"); a claim with no
// figure is untouched. A pick whose decider lacks one is no verdict, never a
// refusal — the sentence it points at may state everything else.
export const figuresUnbacked = (claim, decider) => { const d = numberSet(String(decider ?? "")); return [...numberSet(String(claim ?? ""))].filter((n) => !d.has(n)); };
// corroboration.js — the witness tier as the ledger's OFFICIAL second vote.
// Handle: Bukhari — after al-Bukhari, whose hadith verification stands only on independent chains of transmission; a shared chain counts as one witness. Amendment XVII.
// Domain owner (2026-09-16, the unification): the paraphrase WALL this organ's
// witnessNote is the licensed door through is the seam of the omnilingual
// paraphrase system; the domain's one owner is YadaYadaYada (`yadayadayada`,
// run-dmca.js, compendium + README Handle table). Bukhari remains this
// organ's handle; Yada owns the paraphrase DOMAIN this wall serves.
//
// THE MEASURED CASE FOR THIS EXISTING (reading-recall-finding.md, both
// addenda). Two real Wikipedia pages about one battle share ZERO
// mechanically-matchable restatements — even encyclopedic prose restates a
// proposition in different words, and every mechanical identity tried
// (exact triple, referent-canonical ends, deranged-alias control) measured
// FLAT. The paraphrase wall has one licensed door: the witness protocol
// (testimony.js, P32) — a small model reads one slice and answers yes/no
// twice (the claim, then its sibling-swapped twin), the verdict DERIVED
// from the pair, the decider required verbatim-or-located in source bytes.
// Run live before this module existed: 2 of 12 real notes corroborated
// cross-document against a mechanical baseline of 0, fabricated-note
// control 0/4.
//
// WHAT THIS MODULE ADDS: the wiring, not the judgment. Candidates are
// PROPOSED by shared vocabulary (retrieval proposes, the witness decides —
// the same split the capstone probe used), the witness runs under a
// DECLARED ask budget (P9 — model calls are the scarce resource), and a
// "states" verdict lands on the note through the door's own attest():
// witness string `testimony:<source-ref>`, namespaced so a vote earned by
// a model reading is never confusable with a mechanical re-sighting, and
// the decider sentence carried as a SPAN with a real address in the
// corroborating source's own bytes (P5.2 — the vote is re-openable).
//
// WHAT A VERDICT MAY DO:
//   states      -> attest (the second vote)
//   contradicts -> LANDED as CON·Figure·CONTESTED through the door's own
//                  `dispute` (kernel notes.js, 2026-09-04), carrying the
//                  decider and its address in the DISPUTING source's bytes.
//                  It is NOT a conviction: no witness moves, no span moves,
//                  `standingOf` is byte-identical across it, and the note
//                  stays live and stays premise-eligible. Until that act
//                  existed this branch only REPORTED — and the report died
//                  with the run, which is how corroboration accumulated
//                  across sessions while contest evaporated at the end of
//                  every one. The old header called that a disclosed limit
//                  ("the door has no contradiction field, and inventing one
//                  here would be a silent schema widening"). The limit was
//                  real; the remedy was wrong. The kernel had ALREADY named
//                  the basis — OPERATOR_BASIS.CONTESTED, declared in
//                  task-log.js and written by nothing on disk — so the act
//                  was placed, not invented.
//   refused     -> nothing. A refusal is the witness's designed
//                  conservatism (P32: low recall, zero wrong corrections),
//                  never evidence against the note.
//
// ── INDEPENDENCE, NOT COUNT (user-supplied synthesis, 2026-09-01, of
// Condorcet 1785 / Ladha 1992 / Shannon-von Neumann / Wald 1945 / Bovens &
// Hartmann 2003 / Lamport BFT / Bikhchandani cascades) ──────────────────
//
// The number of witnesses matters far less than their independence, and
// this module's design follows four of that synthesis's conclusions:
//
// 1. EFFECTIVE SAMPLE SIZE. n correlated witnesses behave like
//    n/(1+(n-1)ρ) independent ones. Every `testimony:` vote shares the
//    witness MODEL as a channel, so k testimony votes are never k
//    independent witnesses — the independence a testimony vote adds is the
//    SOURCE's, not the model's, which is why votes are keyed by source and
//    a source never seconds its own sighting (two chunks of one file are
//    one perspective — corroborateAtoms' rule, now Ladha's). And two
//    Wikipedia pages are partly downstream of shared editing culture:
//    n_eff for "two pages agree" is honestly somewhere below 2. Counting
//    distinct SOURCES (distinctSources below) is the least-wrong cheap
//    measure available.
//
// 2. THE SECOND SOURCE IS THE BIGGEST GAIN; THE THIRD IS QUALITATIVELY
//    DIFFERENT. Lamport: two sources can never EXPOSE a liar — you see
//    the disagreement but not who is wrong. This is exactly why a
//    "contradicts" verdict lands as a CONTEST and never as a verdict: at
//    n=2 a states/contradicts pair is undecidable by construction, so the
//    record keeps THAT THEY DISAGREE — true whichever way it settles — and
//    keeps no opinion about which is right. `contestedSearch` then reads
//    the standing contests back off the ledger and ranks the third source
//    for each, which is the seeker's input and, before this, did not
//    exist. It justifies not convicting. It does not justify forgetting.
//
// 3. NO CASCADES BY CONSTRUCTION. The witness is never shown the ledger,
//    other witnesses' votes, or the note's current standing —
//    buildWitnessMessages carries the sentence and the slice, nothing
//    else. Later votes cannot rationally defer to earlier ones because
//    they cannot see them.
//
// 4. RELIABILITY IS MEASURED, NOT ASSUMED. Bovens & Hartmann: coherence
//    among low-reliability witnesses is nearly worthless. This witness's
//    reliability parameter is on the record — fabricated-note control 0/4
//    false-states, recall low by design — and any consumer weighing a
//    `testimony:` vote can weigh it against that measured record rather
//    than against hope.
//
// ── CORROBORATION IS SURPRISE, AND THE BUDGET IS A SETTLING RULE ────────
//
// SPRT's accumulated log-likelihood ratio IS accumulated surprise, so the
// stopping question "when do I stop asking" and the surprise question
// "when do arrivals stop moving the ground" are one question — the
// hunt-meter (P72) already answers it for fetching; this module answers it
// for checking (P30's efficiency law: a call spent where nothing can move
// is compute spent reducing zero uncertainty). Which surprise is settled
// upstream: emergence/surprise.js keeps NOVELTY (the answer was rare)
// apart from BAYESIAN surprise (the answer moved a standing), and a vote
// counts here only for what it MOVES — a yes on a settled note moves
// nothing and is therefore worth nothing, however fluent it is.
//
// THE DARK-ROOM HAZARD, closed structurally rather than by comment. The
// first cut of this module ranked candidates by shared vocabulary
// DESCENDING — it spent the scarce model calls on the notes MOST likely to
// be confirmed, maximizing expected agreement and minimizing expected
// information. Friston's dark room, built by accident, noticed only when
// the surprise relationship was asked about out loud. The fix separates
// what that ranking conflated: overlap is FEASIBILITY (no shared features
// means no slice, so the witness cannot answer at all), and standing is
// VALUE (a note at one source has everything to gain; a settled note has
// nothing). Feasibility gates; value ranks; overlap only breaks ties.
// metacognition.js's own guard is the same law one register over —
// `observe` is a no-op on an all-zero delta, so silence cannot move a
// standing there either.
//
// THE WALK, and what is honestly NOT calibrated. Each note runs a
// unit-step walk: net = (distinct sources stating) − (distinct sources
// contradicting, LEDGER-WIDE — the disputing set is seeded from the log's
// own standing contests, so a note contested last session is still
// contested this one). Settled-corroborated at net >= settleFloor with no
// live contradiction; disconfirmed at the mirror boundary (reported, never
// landed: a note is withdrawn only by `concede`, never by a walk). The
// floor's giver is the ledger's own ≥2-witness mouth (the quantity being
// fed), not a tuned number. This is SPRT's SHAPE — two boundaries, walk
// until crossed — without SPRT's calibrated likelihood ratios, because the
// witness's true p(yes|true)/p(yes|false) have not been measured and
// inventing them would be worse than unit steps (II.10: an uncalibrated
// ratio is a change of units that fails invisibly). Lamport falls out
// instead of being bolted on: a contradiction drops net by one, so a
// contested note NEEDS a third source to settle, automatically.
//
// PURE. The model call (`ask`) and the testimony organs arrive as
// arguments — this module fetches nothing and can be tested offline with a
// scripted witness (the cast.js pattern, applied to a model).

// ── MEDIUM-BLINDNESS (II.11: earned by a test, never declared) ──────────
//
// The PROTOCOL here — propose by overlap, ask, swap a rival into the slot,
// ask again, derive the verdict from the pair, land it as a named witness
// with an address — carries no fact about language. A shot corroborating an
// event, a bar corroborating a motif, and a page corroborating a
// proposition are the same act. What IS text-specific is the ADAPTER: how
// you featurize a source, and how you build a rival. Both are injected.
//
// The default featurizer below is a TEXT adapter and says so: `\p{L}{4,}`
// is Latin-script biased (a CJK word is one or two characters and would be
// dropped entirely), and whitespace tokenization assumes a script that
// separates words. A caller reading another medium — or another script —
// supplies its own `featuresOf`; corroboration.test.mjs runs the whole
// protocol over a synthetic non-text medium to prove the protocol carries
// rather than asserting that it does.
const TEXT_CONTENT_WORD = /\p{L}{4,}/gu;
// FOLDED, because every organ that compares text to text must share
// retrieval's fold (CLAUDE.md's oldest cross-organ lesson — Bezúkhov/
// Bezukhov). Found live building the third-source seeker: the Maude
// translation writes Kutúzov 524 times, and an unfolded feature set makes
// the novel invisible to a claim about Kutuzov. NFD strip of combining
// marks — the same fold class source.js's foldDiacritics implements;
// restated minimally here to keep this module zero-import (its stated
// contract), with the drift risk carried by the test that pins the
// Kutúzov case against the REAL novel bytes.
const foldMarks = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const textFeatures = (t) => new Set(foldMarks(String(t ?? "").toLowerCase()).match(TEXT_CONTENT_WORD) ?? []);

/**
 * The activated candidate set for the SELECT protocol: real sentences from
 * ANYWHERE in the source where BOTH ends fire, ranked by joint feature
 * density, capped. This is the correction the first live select run
 * exposed — the earlier code gathered from one co-presence WINDOW (a
 * single keyword's neighbourhood, which centres on a lone end), while the
 * select protocol wants the SET of stating places across the whole source.
 * The window stays the generate path's slice (one place to read); the set
 * is the select path's candidates (every place that could state it).
 */
/**
 * A COMPETING FILLER for an end: a capitalized multi-word or single-word
 * surface occurring in the candidates that is NOT the end itself and not a
 * word of the end. This is the arm's ammunition — a name the picker could
 * plausibly confuse the real end with, drawn from the very sentences it
 * just read. Returns null when the candidates offer no competitor, which
 * is an honest unarmed state, never a guess.
 *
 * Deliberately NOT cite.js's `namesIn`: that organ carries the L2
 * sentence-initial veto (correct for deciding whether a capital is a name
 * in prose), and here the question is only "what else could have filled
 * this slot in these sentences" — a first-word name is a perfectly good
 * competitor. Capitalization is used as a CANDIDATE signal and never as a
 * verdict, which is L2's actual rule.
 *
 * `pool` — DECLARED and off by default — is a second source of competitors
 * for the case the candidates cannot cover, and it exists because the
 * candidate-only pool was MEASURED to run dry exactly where retrieval is
 * narrowest (S52): with one retrieved candidate sentence, its only
 * capitalized surfaces are usually the claim's own ends, so `seen` is empty,
 * the arm cannot be built, and a correct yes is refused however right it is.
 * The corpus ceiling that produces is 4 of 9 against the same battery's 8 of
 * 9 on a wider source — a scale artifact in the refusal rate that nobody
 * declared.
 *
 * A caller passes the surfaces its own reader actually resolved (referent
 * faces — `makeReferentIndex` and the surfaces behind it), which is a pool
 * that does NOT shrink when retrieval narrows. Candidates are still searched
 * FIRST and win: a competitor the picker has just read is the strongest thing
 * to confuse an end with, and a pool surface it has not read is weaker
 * ammunition, not better. An empty pool changes nothing, and omitting it is
 * byte-identical to before.
 *
 * What this may never do is relax the arm. A richer pool changes only WHAT
 * the picker is asked to confuse the end with; the swap, the indiscriminate
 * check and the typed refusals still decide what a yes is worth.
 */
// Shared by competingFiller and competingFillerCount so the two never
// drift: every capitalized surface in candidates (or, failing that, the
// declared pool) that does not share a feature with `end` or `exclude`.
// Factored out rather than duplicated — "search for the organ before
// inventing one" applied to this file's own two competitor-facing exports.
function gatherCompetitors(end, candidates, { featuresOf = textFeatures, exclude = [], pool = null } = {}) {
  // BOTH ends are excluded, not just the one being replaced: the other end
  // is by construction the most frequent capitalized surface in candidates
  // that all mention it, and swapping end2 for end1 builds a nonsense arm
  // ("Napoleon fought against Napoleon") that any picker refuses — an arm
  // that always refuses is not an arm, it is a rubber stamp. Found live.
  const endWords = new Set([...featuresOf(end)]);
  for (const x of exclude) for (const w of featuresOf(x)) endWords.add(w);
  const seen = new Map();
  for (const text of candidates ?? []) {
    // capitalized runs, up to three words, inside the sentence
    for (const m of String(text).matchAll(/\b\p{Lu}[\p{L}'\u2019-]+(?:\s+\p{Lu}[\p{L}'\u2019-]+){0,2}/gu)) {
      const surface = m[0].trim();
      const words = [...featuresOf(surface)];
      if (!words.length) continue;
      if (words.some((w) => endWords.has(w))) continue; // shares the end -> not competing
      seen.set(surface, (seen.get(surface) ?? 0) + 1);
    }
  }
  if (!seen.size) {
    // The candidates offered nothing. Fall back to the caller's declared pool
    // — never merged with the candidates, so a pool surface can only ever be
    // reached when the candidate-only arm would have refused outright.
    for (const surface of pool ?? []) {
      const words = [...featuresOf(surface)];
      if (!words.length || words.some((w) => endWords.has(w))) continue;
      seen.set(String(surface), 1);
    }
  }
  return seen;
}

export function competingFiller(end, candidates, opts = {}) {
  const seen = gatherCompetitors(end, candidates, opts);
  if (!seen.size) return null;
  // the most frequent competitor: the one a picker is likeliest to confuse
  return [...seen].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

/** DISCLOSED, NEVER HIDDEN (P66): how many DISTINCT competing surfaces
 * `competingFiller` actually had to choose among for this end — the same
 * gap `siblingSwap`'s own `competitors` field closes on the generate path.
 * One is a real but degenerate arm (no second name to pick over); this
 * never changes what `competingFiller` returns, only lets a caller mark
 * the difference instead of seeing a byte-identical pick either way. */
export function competingFillerCount(end, candidates, opts = {}) {
  return gatherCompetitors(end, candidates, opts).size;
}

export function statingCandidates(sourceText, ends, { featuresOf = textFeatures, splitSentences, limit, minLen = 12, maxLen = 400, isGeneric: isGenericInjected = null } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("statingCandidates: splitSentences is injected (the engine's own segmenter) — required");
  if (!Number.isFinite(limit)) throw new TypeError("statingCandidates: limit is declared by the caller (P9)");
  const src = String(sourceText ?? "");
  const f1all = [...featuresOf(ends?.end1)], f2all = [...featuresOf(ends?.end2)];
  if (!f1all.length || !f2all.length) return [];
  // PROPER ACTIVATION (user, 2026-09-01: "never trust the model on content,
  // but it's pretty good with meaning if you give it proper activation
  // context"). The generic word is the trap: "General" is a feature of end2's
  // own surface ("General Mikhail Kutuzov"), and it fired 6 of 8 candidates
  // on sentences about OTHER generals — the model then judged garbage.
  //
  // STRATUM: S1-script, BECOMING heard-clean (LEVELS.md; the todo test in
  // corroboration.test.mjs is the referent). This gate decides on
  // capitalization — a reader's signal a listener does not have — and so
  // sits below the heard rule's bar ("the system must be able to work
  // equally well if it only heard the novel and didn't read it"). Shipped
  // anyway, declared rather than silent: the S2 form is determiner
  // precedence ("the general" is said; "the Kutuzov" is not), a received
  // closed class, unbuilt.
  //
  // HOW A BABY LEARNS THIS (user, same session), and no hand-list: a title
  // is a word you ALSO hear as a common noun — "the general said" — while a
  // name never lives lowercase. Measured in this novel: general 424
  // lowercase / prince 349 / count 439, but kutuzov 0, napoleon 0,
  // bagration 0, pierre 0. Rarity cannot separate them (kutuzov 529 vs
  // general 657 — a protagonist is not rare); the lowercase life can. A
  // feature is generic when it recurs lowercase in the source past a
  // declared ratio of its capitalized uses — the same signal title-fold.js
  // already uses, measured here against the source rather than received as
  // a list. An end whose only features are generic keeps them (a disclosed
  // floor); its name's distinctive tokens carry the activation.
  // Both counts run on the ORIGINAL-CASE source (diacritics folded only),
  // so "lowercase" means genuinely lowercase — the first cut counted on an
  // already-lowercased copy and every Name read as 508 "lowercase" uses, a
  // measurement bug that emptied the set. Word-bounded, capped.
  // The predicate is INJECTABLE (the cast.js pattern): a caller with a
  // discovered company-kind organ (kind-standing.js::discoverCompanyKinds +
  // frameWords — S2-heard, taught nothing, II.23-controlled) passes
  // `isGeneric: (w) => frames.has(w)` and this gate becomes heard-clean —
  // the BECOMING below is inhabited by exactly that injection. The default
  // stays the S1 rule so no existing caller moves.
  const rawSrc = foldMarks(src);
  const countBounded = (w) => { let n = 0; const re = new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "gu"); while (re.exec(rawSrc)) { n++; if (n > 99999) break; } return n; };
  const isGeneric = isGenericInjected ?? ((w) => {
    const lc = countBounded(w.toLowerCase());                 // genuinely lowercase life
    const cap = countBounded(w[0].toUpperCase() + w.slice(1)); // Name life
    return lc >= Math.max(2, cap); // lives lowercase as often as (or more than) as a Name
  });
  const distinctive = (feats) => {
    const kept = feats.filter((w) => !isGeneric(w));
    return kept.length ? kept : feats;
  };
  const f1 = distinctive(f1all), f2 = distinctive(f2all);
  let sents = [];
  try { sents = splitSentences(src); } catch { return []; }
  // COORDINATE SPACES, NEVER MIXED SILENTLY (the b0/c0 law, met live): the
  // engine's splitter collapses \r\n to \n BEFORE computing offsets, so on
  // a CRLF source (Gutenberg's 66k of them in War and Peace) its offsets
  // name the normalized text, not the file. Each \r\n before a normalized
  // position costs exactly one raw char, so the map back is a count of
  // preceding CRLFs. P5.2 makes the verification mandatory either way: a
  // span ships only when the mapped slice re-normalizes to the sentence
  // the splitter cut; otherwise the address is null, never guessed.
  const crlf = [];
  for (let i = src.indexOf("\r\n"); i >= 0; i = src.indexOf("\r\n", i + 2)) crlf.push(i);
  const toRaw = (n) => {
    // count CRLFs whose normalized position (rawIdx - rank) is < n
    let lo = 0, hi = crlf.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (crlf[mid] - mid < n) lo = mid + 1; else hi = mid; }
    return n + lo;
  };
  const normEq = (a, b) => a.replace(/\r\n/g, "\n") === b;
  const scored = [];
  for (const sent of sents) {
    // CARRY THE ADDRESS FORWARD FROM THE CUT (P5.2), never search for it
    // later: the segmenter already gives each sentence its own byte offset,
    // so a candidate knows exactly where in the source it came from. `shown`
    // is the whitespace-normalized form the model reads; `raw`/`start`/`end`
    // are the sentence's own bytes and span, so the model's pick resolves to
    // a real address with no regex and no wrong-occurrence risk.
    const raw = typeof sent === "string" ? sent : sent?.text ?? "";
    const offset = typeof sent === "object" && Number.isFinite(sent?.offset) ? sent.offset : null;
    const shown = raw.replace(/\s+/g, " ").trim();
    if (shown.length < minLen || shown.length > maxLen) continue;
    const g = foldMarks(shown.toLowerCase());
    const h1 = f1.filter((w) => g.includes(w)).length;
    const h2 = f2.filter((w) => g.includes(w)).length;
    if (h1 > 0 && h2 > 0) {
      let start = null, end = null, rawBytes = raw;
      if (offset != null) {
        const a = toRaw(offset), b = toRaw(offset + raw.length);
        const slice = src.slice(a, b);
        if (normEq(slice, raw)) { start = a; end = b; rawBytes = slice; } // verified: the file's own bytes
        else if (src.slice(offset, offset + raw.length) === raw) { start = offset; end = offset + raw.length; } // splitter did not normalize
        // else: unverifiable — span stays null, never guessed (P5.2)
      }
      scored.push({ shown, raw: rawBytes, start, end, density: h1 + h2 });
    }
  }
  return scored.sort((a, b) => b.density - a.density).slice(0, limit);
}

/**
 * REC·Figure at the fifth turn — ACT on a contradiction (or a thin
 * standing) by finding WHERE a further independent vote could come from.
 * Lamport made mechanical: at n=2 a disagreement is visible but not
 * adjudicable, so a contested note's next move is always a THIRD source;
 * a thin note's is a second. This is the DISCOVERY half only — pure
 * ranking of not-yet-witnessing sources by the same per-end feasibility
 * the walk already spends by (endsCopresentWindow); the re-ask half IS
 * the walk, whose contested-first ranking already prioritizes what this
 * function feeds it.
 *
 * Returns ranked `{source, window}` — never a verdict, never a vote.
 */
export function thirdSourceCandidates(note, sources, { featuresOf = textFeatures, limit } = {}) {
  if (!Number.isFinite(limit)) throw new TypeError("thirdSourceCandidates: limit is declared by the caller (P9)");
  const already = distinctSources(note.witnesses ?? []);
  const out = [];
  for (const source of sources ?? []) {
    if (already.has(source.ref)) continue;
    const w = endsCopresentWindow(source.text, { end1: note.end1 ?? note.subject, end2: note.end2 ?? note.object }, { featuresOf });
    if (w) out.push({ source, window: w });
  }
  return out.sort((a, b) => b.window.score ?? 0 - (a.window.score ?? 0)).slice(0, limit);
}

/**
 * CON·Pattern — THE STANDING CONTESTS, and where a third source could
 * settle each. `thirdSourceCandidates` has always been able to answer
 * "where would a further vote come from for THIS note"; what it never had
 * was a caller that knew which notes needed one, because the only record
 * of a disagreement lived in a Map that died with the run that built it.
 * This reads the live disputes OFF THE LEDGER and ranks a search for each,
 * so the question survives the session that raised it.
 *
 * Lamport's n=3, made into work: a contested note is the highest-value ask
 * in the pool (askValue gives it 2) precisely because one more independent
 * vote DECIDES it, where a vote on a thin note merely seconds it. Returns
 * `{ noteId, note, disputes, stating, candidates }` — a search list, never
 * a verdict, and never an ordering of who is more likely right.
 */
export function contestedSearch(log, door, sources, { limit, kinds, featuresOf = textFeatures } = {}) {
  if (!Number.isFinite(limit)) throw new TypeError("contestedSearch: limit is declared by the caller (P9)");
  // WHICH KINDS A THIRD SOURCE CAN SETTLE IS DECLARED, NEVER DEFAULTED.
  // Measured (contradiction-kinds.mjs, 2026-09-04): both apparent
  // contradictions in the real succession material were INDIVIDUATION —
  // one person, one office, disjoint tenures, both sides from the same
  // file — decidable at n=1 and settleable by no third source whatever. A
  // seeker routed on "is it disputed" would have been sent after both and
  // could have resolved neither. `door.NEEDS_THIRD_SOURCE` is the engine's
  // own answer (`["contest"]`) for a caller that wants it; passing it is
  // still the caller's act.
  if (!Array.isArray(kinds) || kinds.length === 0)
    throw new TypeError("contestedSearch: `kinds` is declared — which kinds of disagreement a third source could settle here (door.NEEDS_THIRD_SOURCE is the measured answer). Routing every dispute is what this argument exists to stop");
  const want = new Set(kinds);
  const live = door.disputesOf(log);
  const seeking = [], unrouted = [];
  if (!live.size) return { seeking, unrouted };
  const byId = new Map(door.foldNotes(log).map((n) => [n.id, n]));
  for (const [noteId, disputes] of live) {
    const note = byId.get(noteId);
    if (!note) continue; // conceded or otherwise gone; the contest is moot
    const routable = disputes.filter((d) => want.has(d.kind));
    const rest = disputes.filter((d) => !want.has(d.kind));
    // Reported, never silently skipped — an unrouted contest is still a
    // live disagreement, and what it needs is TYPING, not a third source.
    for (const d of rest) unrouted.push({ noteId, disputeId: d.id, source: d.source, kind: d.kind, reason: d.kind === "untyped" ? "untyped — nothing said which kind of disagreement this is; a third source cannot be aimed" : `${d.kind} is decidable at n=1 — a third source is the wrong lever` });
    if (!routable.length) continue;
    // A source that already spoke — on either side — is not a third source.
    const spoken = new Set([...distinctSources(note.witnesses ?? []), ...disputes.map((d) => d.source)]);
    const candidates = thirdSourceCandidates(note, (sources ?? []).filter((x) => !spoken.has(x.ref)), { featuresOf, limit });
    seeking.push({ noteId, note, disputes: routable, stating: [...distinctSources(note.witnesses ?? [])], contradicting: routable.map((d) => d.source), candidates });
  }
  // Most-contested first: the notes where the record most needs a third voice.
  seeking.sort((a, b) => b.disputes.length - a.disputes.length || b.candidates.length - a.candidates.length);
  return { seeking, unrouted };
}

/**
 * DEF·Pattern at the fifth turn — the witness's MEASURED operating point,
 * landed as a declaration with its method and date, so every consumer of
 * a testimony vote can weigh it against numbers rather than hope
 * (Bovens & Hartmann's reliability parameter, measured not assumed).
 * Method: stated-by-construction trues (a page's own extracted claims
 * asked against that page) vs end-swapped fakes, armed protocol,
 * temperature 0, per model — plus every live fabricated batch pooled for
 * the false-state bound (rule of three at zero observed).
 *
 * The walk deliberately KEEPS unit steps: with LR(states) >= ~4, two
 * independent-source votes carry LR >= ~16, which is what settleFloor=2
 * already demands — the calibration VALIDATES the shipped design rather
 * than replacing it, and that outcome is recorded here instead of being
 * dressed up as a new mechanism.
 */
export const WITNESS_OPERATING_POINT = Object.freeze({
  measured: "2026-09-01",
  method: "stated-by-construction trues vs end-swapped fakes, armed protocol, temp 0; false bound pooled over all live fabricated batches (rule of three at 0/36)",
  models: Object.freeze({
    "gemma2:2b": Object.freeze({ pStatesGivenStated: 6 / 18, pStatesGivenFabricatedUpperBound: 3 / 36, armedFabricatedAsks: 36, falseStates: 0 }),
    "qwen2.5:14b-instruct-q4_K_M": Object.freeze({ pStatesGivenStated: 5 / 18, pStatesGivenFabricatedUpperBound: 3 / 12, armedFabricatedAsks: 12, falseStates: 0, note: "no better than gemma2:2b and ~3x slower — measured, not assumed" }),
  }),
  // THE SELECT PROTOCOL, calibrated separately (2026-09-01) because it is a
  // different ask: the model POINTS at a mechanically gathered candidate
  // instead of writing a decider. Same live material (the real War and
  // Peace), claims stated-by-construction vs fabricated pairs that
  // genuinely co-occur — the hard case, where only the relation is invented.
  // Three arm designs measured on the SAME batch, kept so none is retried:
  //   unarmed                     3/6 true, 1/8 FABRICATED (a real false state)
  //   armed, refuse any arm "yes" 0/6 true, 0/8  (a wall nothing could pass)
  //   armed, refuse SAME INDEX    2/6 true, 0/8  <- shipped
  // The shipped rule reads insensitivity as pointing at the SAME sentence
  // for two different claims — an index that carries no information about
  // what was asked. Recall matches the generate protocol's own 0.33 while
  // the decider is verbatim by construction. Disclosed cost: one true
  // claim ("Napoleon invaded Russia") is refused indiscriminate.
  select: Object.freeze({
    measured: "2026-09-01",
    model: "gemma2:2b",
    pStatesGivenStated: 2 / 6,
    pStatesGivenFabricated: 0 / 8,
    armRule: "refuse when the arm points at the same candidate index",
  }),
});

/**
 * THE CALIBRATIONS AS DECLARED FRAMES (frame.js's first live consumer,
 * 2026-09-02 — DEF·Ground made load-bearing the day after it was built,
 * per the floor-nothing-consumes rule). The two witness protocols'
 * operating points are measurements taken under two different
 * interpretive grounds — different method, different ask shape, different
 * arm — and comparing "0.33 recall" (generate) against "2/6" (select) as
 * if they were one scale is exactly the cross-frame sin frame.js walls.
 * Each calibration gets a content-addressed frame built from ITS OWN
 * declared method and numbers; a consumer weighing votes from both
 * protocols must carry both frames or be refused by `comparable`.
 */
export async function calibrationFrames() {
  const { declareFrame } = await import("./index.js"); // frame.js lives in eoreader7 now (Phase 1); reached through the seam
  const op = WITNESS_OPERATING_POINT;
  const g = op.models["gemma2:2b"];
  const generate = await declareFrame({
    organs: { protocol: "generate", model: "gemma2:2b", arm: "sibling-swap, insensitivity-checked" },
    givers: { method: op.method },
    numbers: { pStatesGivenStated: g.pStatesGivenStated, pStatesGivenFabricatedUpperBound: g.pStatesGivenFabricatedUpperBound, armedFabricatedAsks: g.armedFabricatedAsks },
  });
  const select = await declareFrame({
    organs: { protocol: "select", model: op.select.model, arm: op.select.armRule },
    givers: { method: "stated-by-construction trues vs fabricated co-occurring pairs, armed select, temp 0" },
    numbers: { pStatesGivenStated: op.select.pStatesGivenStated, pStatesGivenFabricated: op.select.pStatesGivenFabricated },
  });
  if (generate.refused || select.refused) throw new Error("calibrationFrames: the operating point no longer declares a whole frame — fix the declaration, not this function");
  return { generate: generate.frame, select: select.frame };
}

/**
 * The independence-aware count: DISTINCT SOURCES across both witness kinds.
 * A mechanical sighting on page A plus a testimony vote from page A is ONE
 * source; `witnesses.length >= 2` would read it as two. Consumers gating
 * on corroboration should gate on THIS.
 *
 * A witness may name its RECIPE (P68's identity) after a `~`:
 * `<source>~<recipe>` — see `independentReadings` for why, and note that
 * this function deliberately IGNORES the recipe: "how many sources" and
 * "how many independent readings" are different questions, and collapsing
 * them would make one of the two unanswerable.
 */
/**
 * The SOURCE a witness names: its ref with the address and the recipe
 * stripped. A mechanical witness carries its passage address
 * (`page.txt#178-275`, P5.2's own shape) and a testimony witness does not
 * (`testimony:page.txt`) — and until 2026-09-02 this function compared the
 * two strings as they came, so ONE page re-witnessing its own note counted
 * as two sources. Found live: the first witness walk over a real book
 * (eval/the-fold/dracula-witness-walk.mjs) attested eight notes, every one
 * from the part it was heard in, and reported the >=2-source gate 2 → 10.
 * Two chunks of one file are one perspective (corroborateAtoms' own rule);
 * so are a chunk and a testimony vote from the same file.
 */
// ONE implementation: the kernel's (notes.js), which strips ANY declared
// kind prefix — `testimony:`, `primary:`, `planted:` — not only the one
// this file happened to know about when it was written. A second copy here
// stripped `testimony:` alone, so a `primary:` witness (ranke.js) would
// have read as a source named "primary" — the drift class this repo's own
// postmortems keep naming (P22, P24, P25).
export const sourceOfWitness = kernelSourceOfWitness;

export function distinctSources(witnesses, { groupOf = null } = {}) {
  const out = new Set();
  // `groupOf` (from `sharedTextGroups`) collapses sources that are one text in
  // two places. OPTIONAL, and omitting it is byte-identical to before it
  // existed: a caller that has not measured shared text counts sources as it
  // always did, and one that has counts each syndicated group once.
  for (const w of witnesses ?? []) {
    const src = sourceOfWitness(w);
    out.add(groupOf?.get(src) ?? src);
  }
  return out;
}

/**
 * THE SHARED-INSTRUMENT COUNT (2026-09-01). Measured live in
 * `eval/omnimodal-pipeline.mjs`: two real performances of one piece,
 * decoded by ONE pitch tracker, produced the SAME systematic artifact (a
 * spurious drone before a theme note), so a kind membership the material
 * never states corroborated at "2 distinct sources". MINE-1's own lesson
 * ("a systematic mis-parse lands identically on both sides") in audio.
 *
 * Two sources read by one instrument are two SOURCES and ONE READING: they
 * cannot disagree about anything the instrument gets wrong. So a claim
 * whose truth depends on how the material was decoded — every claim
 * produced BY a decoder, which is every claim in a non-text medium and
 * every extracted arrangement in text — must be counted by the (source,
 * recipe) pair, not by source alone.
 *
 * A witness with no `~recipe` is UNDECLARED, not independent: it counts as
 * its own reading (nothing is silently merged), and `undeclared` reports
 * how many such witnesses there were, so a consumer can tell "measured
 * independent" from "not yet declared". P68's `recipeId` is the intended
 * filler; any stable descriptor works.
 */
/**
 * THE SHARED-TEXT COUNT (2026-09-04). The mirror of the shared-instrument
 * count below, and measured on the same page set that motivated it: of the 22
 * notes standing on two or more sources across three real Wikipedia articles,
 * TWO are maintenance categories and the other TWENTY are two articles that
 * share **20 verbatim sentences** — Nelson's signal, "Davout's soldiers had 48
 * hours to march 110 km (68 mi)", and eighteen more. One text in two places is
 * ONE WITNESS. Counting it as two is not a rounding error; it is the entire
 * corroborated set of that reading.
 *
 * `sharedTextGroups(sources, { minSentenceLength, minShared, splitSentences })`
 * groups sources that share more than a declared number of long verbatim
 * sentences. Both numbers are the caller's (P4): how long a sentence must be
 * before its recurrence means anything, and how many shared sentences make two
 * documents one text, are claims about the material and never constants chosen
 * here.
 *
 * CONSERVATIVE BY CONSTRUCTION. Two sources are INDEPENDENT unless shown
 * otherwise — absence of measured overlap is a fact about what was compared,
 * never evidence of independence earned. And the grouping is transitive by
 * union-find, because if A syndicates B and B syndicates C then all three are
 * one text however little A and C happen to share directly.
 *
 * `splitSentences` is injected — this file holds no sentence rule of its own.
 */
export function sharedTextGroups(sources, { minSentenceLength, minShared, splitSentences } = {}) {
  if (!Number.isFinite(minSentenceLength) || minSentenceLength < 1)
    throw new TypeError("sharedTextGroups: minSentenceLength is declared — how long a sentence must be before its recurrence means anything is a claim about the material");
  if (!Number.isInteger(minShared) || minShared < 1)
    throw new TypeError("sharedTextGroups: minShared is declared — how many shared sentences make two documents one text is never a constant chosen here");
  if (typeof splitSentences !== "function")
    throw new TypeError("sharedTextGroups: splitSentences is injected — this file holds no sentence rule of its own");

  const list = (sources ?? []).filter((s) => s && s.ref);
  const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const setOf = (text) => new Set(
    splitSentences(String(text ?? ""))
      .map((x) => norm(x?.text ?? x))
      .filter((x) => x.length >= minSentenceLength),
  );
  const sets = new Map(list.map((s) => [s.ref, setOf(s.text)]));

  const parent = new Map(list.map((s) => [s.ref, s.ref]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  const overlaps = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const a = list[i].ref, b = list[j].ref;
    const sa = sets.get(a), sb = sets.get(b);
    let shared = 0;
    const smaller = sa.size <= sb.size ? sa : sb, larger = sa.size <= sb.size ? sb : sa;
    for (const x of smaller) if (larger.has(x)) shared += 1;
    overlaps.push({ a, b, shared, of: Math.min(sa.size, sb.size) });
    if (shared >= minShared) union(a, b);
  }

  const groups = new Map();
  for (const s of list) {
    const root = find(s.ref);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(s.ref);
  }
  // ref -> the group it counts as. A source sharing text with nobody is its
  // own group, which is what makes omitting this organ byte-identical.
  const groupOf = new Map();
  for (const [root, members] of groups) for (const m of members) groupOf.set(m, root);
  return { groupOf, groups: [...groups.values()], overlaps, collapsed: list.length - groups.size };
}

export function independentReadings(witnesses) {
  const pairs = new Set();
  let undeclared = 0;
  for (const w of witnesses ?? []) {
    const s = String(w);
    const cut = s.indexOf("~");
    const source = sourceOfWitness(w);
    if (cut < 0) { undeclared += 1; pairs.add(`${source}~<undeclared:${undeclared}>`); continue; }
    pairs.add(`${source}~${s.slice(cut + 1)}`); // (source, recipe) — the address is not part of the reading
  }
  return { readings: pairs, count: pairs.size, undeclared };
}

/**
 * How many INSTRUMENTS read this note — the number the shared-instrument
 * failure is invisible to. Two sources through one decoder read 1 here,
 * which is the whole point: a consumer whose claim is instrument-sensitive
 * gates on this, not on distinctSources.
 */
export function distinctRecipes(witnesses) {
  const out = new Set();
  for (const w of witnesses ?? []) { const r = recipeOfWitness(w); if (r != null) out.add(r); }
  return out;
}

/** Shared-vocabulary ranking: which notes have a real chance in this source. */
export function proposeCandidates(notes, source, {
  limit,
  // TWO featurizers, not one — a first draft used a single `featuresOf` for
  // both and the non-text test caught it immediately: featurizing a SOURCE
  // and featurizing an ARRANGEMENT are different questions in any medium
  // (a bar of music is a set of motif onsets; an arrangement between two
  // motifs is its two ends). They coincide only in text, where both happen
  // to be "the words in this string", which is exactly the kind of
  // coincidence that reads as universal until another medium arrives.
  featuresOfSource = textFeatures,
  featuresOfNote = (n) => textFeatures(`${n.end1 ?? n.subject} ${n.label ?? n.verb} ${n.end2 ?? n.object}`),
  render = null,
} = {}) {
  if (!Number.isFinite(limit)) throw new TypeError("proposeCandidates: limit is declared by the caller (P9)");
  // How a note is rendered FOR THE WITNESS is the adapter's business too —
  // text joins its three cells with spaces; another medium renders an
  // arrangement however its own witness reads.
  const say = render ?? ((n) => `${n.end1 ?? n.subject} ${n.label ?? n.verb} ${n.end2 ?? n.object}`.replace(/\s+/g, " ").trim());
  const sourceFeatures = featuresOfSource(source);
  const scored = [];
  for (const n of notes) {
    const feats = [...featuresOfNote(n)];
    // A note with no features to share cannot be proposed by overlap —
    // typed as a skip, never scored as disagreement.
    if (!feats.length) continue;
    const shared = feats.filter((f) => sourceFeatures.has(f)).length / feats.length;
    if (shared > 0) scored.push({ note: n, sentence: say(n), shared });
  }
  return scored.sort((a, b) => b.shared - a.shared).slice(0, limit);
}

/**
 * The VALUE of asking about this note — expected movement of its standing,
 * not its likelihood of being confirmed. 0 means an ask is a wasted call:
 * settled (nothing left to move) or disconfirmed (moved as far down as the
 * walk reads). A contested note outranks a merely thin one — its next vote
 * decides a live disagreement, the highest-information ask available.
 */
export function askValue(note, { contradictSources, settleFloor } = {}) {
  if (!Number.isFinite(settleFloor)) throw new TypeError("askValue: settleFloor is declared by the caller");
  const stating = distinctSources(note.witnesses).size;
  const contras = contradictSources?.get(note.id)?.size ?? 0;
  const net = stating - contras;
  if (net <= -settleFloor) return { value: 0, reason: "disconfirmed", net };
  if (contras > 0) return { value: 2, reason: "contested", net };
  if (net >= settleFloor) return { value: 0, reason: "settled", net };
  return { value: 1, reason: "thin", net };
}

/**
 * The best window of `sourceText` where features of BOTH ends co-occur —
 * or null when no such window exists anywhere. Two jobs, one geometry
 * (the same per-end covering condition as the decider wall, applied
 * BEFORE the ask instead of after):
 *
 *  - PREFILTER: a candidate with no co-presence window is structurally
 *    hopeless — the decider wall could never pass — and asking a model
 *    about it is a wasted call. Measured on the live Borodino run before
 *    this existed: 14 of the top 40 candidates (35% of the whole budget)
 *    were hopeless by this test.
 *  - SLICE CENTERING: for a plausible candidate, the co-presence window
 *    is where a stating sentence would have to live, so the witness
 *    should read THERE — not wherever generic anchor scoring wanders
 *    (P32's own named gap: no prose-vs-table signal).
 *
 * Medium-blind like the rest of this module: `featuresOf` is injected,
 * the default is the text adapter and says so.
 */
export function endsCopresentWindow(sourceText, ends, { featuresOf = textFeatures, window = 400 } = {}) {
  const text = String(sourceText ?? "");
  const lower = foldMarks(text.toLowerCase());
  const f1 = [...featuresOf(ends?.end1)];
  const f2 = [...featuresOf(ends?.end2)];
  if (!f1.length || !f2.length) return null;
  let best = null;
  for (const w1 of f1) {
    let i = -1;
    while ((i = lower.indexOf(w1, i + 1)) >= 0) {
      const lo = Math.max(0, i - window);
      const hi = Math.min(text.length, i + window);
      const win = lower.slice(lo, hi);
      const hits2 = f2.filter((w2) => win.includes(w2)).length;
      if (hits2 > 0) {
        const score = hits2 + f1.filter((w) => win.includes(w)).length;
        if (!best || score > best.score) best = { start: lo, end: hi, score };
      }
    }
  }
  return best ? { start: best.start, end: best.end, text: text.slice(best.start, best.end) } : null;
}

/**
 * One note, one source, the full protocol: slice -> ask -> sibling-swap ->
 * ask -> foldTestimony. Returns the derived verdict with the decider's own
 * address in the source, or the typed refusal — never a bare boolean.
 */
export async function witnessNote(sentence, source, { ask, selectAsk = null, testimony, ends = null, slice: sliceOverride = null, splitSentences = null, candidates = null, fillerPool = null, armEitherEnd = false } = {}) {
  const { witnessSlice, siblingSwap, foldTestimony, buildSelectMessages, foldSelect } = testimony ?? {};
  if (typeof ask !== "function" || !witnessSlice || !siblingSwap || !foldTestimony)
    throw new TypeError("witnessNote: ask and the testimony organs are injected — required, never defaulted");
  const target = { kind: "name", text: sentence, sentence };
  const slice = sliceOverride ?? witnessSlice(target, source.text);
  if (!slice) return { refused: "no-slice" };

  // SELECT PATH (preferred when a segmenter is injected): activate the
  // slice into its own sentences, keep only those where BOTH ends fire,
  // and have the model POINT at one. The decider is verbatim by
  // construction, so the decider-company wall below is satisfied
  // structurally and the echo failure mode cannot occur. Falls through to
  // the generate path when there is no segmenter, no select organ, or no
  // co-present candidate to offer.
  if (splitSentences && selectAsk && buildSelectMessages && foldSelect && ends) {
    // Candidates across the WHOLE source, not the centred window — the
    // select set wants every place that could state the claim (see
    // statingCandidates' own header for why the window was the wrong
    // grain here). Feature fold is the module's own textFeatures, so
    // Kutúzov reaches a Kutuzov claim.
    // THE CANDIDATE SET MAY BE INJECTED (the cast.js pattern), and this is
    // the one seam paraphrase needs. statingCandidates' own gate is
    // `h1 > 0 && h2 > 0` — BOTH ends must fire LITERALLY — so a source that
    // states the claim in other words offers nothing, `cands` is empty, and
    // the armed select protocol never runs at all. That gate is right as the
    // default: it is what makes an unsupervised candidate set trustworthy,
    // and it is why the fallback below is a generate call on a containment
    // slice. It is also exactly the wall a paraphrased end2 hits.
    //
    // A caller holding its OWN declared way to choose where a stating
    // sentence would live (referent activation over the face, a local
    // embedding ranking, anything it can name) passes that list here. What
    // it does NOT get to relax is the arm: the swap, the indiscriminate
    // check, the carried address and the typed refusals below are unchanged,
    // so a picker that points at the same sentence for a competing filler
    // still decides nothing, whatever list it was shown. A slicer can only
    // change WHERE the model is asked to look, never whether its yes counts.
    // Omitted, byte-identical to before.
    const cands = candidates ?? statingCandidates(source.text, ends, { splitSentences, limit: 8 });
    if (cands.length) {
      const shownList = cands.map((c) => c.shown);
      const picked = foldSelect(await selectAsk(buildSelectMessages(sentence, shownList)), cands.map((c) => c.shown));
      if (picked.verdict === "states") {
        // THE ARM, grafted from the generate protocol (P32): a pointer that
        // says yes is not yet a vote. Calibrated live before this existed:
        // unarmed select read p(states|fabricated) = 1/8 — "Napoleon
        // surrendered to Kutuzov at Moscow" drew a pick whose decider
        // states no surrender, because pointing at a topically-adjacent
        // sentence costs nothing. The same candidate list is asked about
        // the sibling-swapped claim (a competing filler from the
        // candidates' own names — the existing siblingSwap organ, the
        // candidates themselves as its slice since they are real source
        // sentences); a picker that also finds the swap "stated" is
        // indiscriminate on this set, and its yes decides nothing. No
        // available swap = unarmed, and an unarmed yes is refused, not
        // trusted (the unarmed-yes rule, unchanged from generate).
        // the swap's sibling pool is the SOURCE's own names (the generate
        // posture), not the candidate list — the candidates are by
        // construction the sentences matching the claim, so a competing
        // filler is usually outside them (measured: an arm harvested from
        // candidates alone found no sibling and refused everything unarmed)
        // The arm swaps end2 for a COMPETING FILLER drawn from the
        // candidates' own text — the names that actually co-occur with this
        // claim's subject in the sentences the picker just read, which is
        // exactly the population a picker confuses end2 with. Built here
        // rather than through siblingSwap because that organ resolves the
        // claim's own name through cite.js's namesIn, which carries the L2
        // sentence-initial veto: a claim written subject-first ("Napoleon
        // invaded Russia" — the ordinary shape) has its subject vetoed and
        // no arm can be built at all. Measured: 3 of 6 true claims refused
        // `unarmed-select` for that reason alone, a wall nothing could pass.
        // Here end2 is GIVEN by the caller, so no name resolution is needed
        // to know what to replace.
        const armFiller = competingFiller(ends.end2, shownList, { exclude: [ends.end1], pool: fillerPool });
        if (!armFiller) return { refused: "unarmed-select", via: "select" };
        // DISCLOSED, NEVER HIDDEN (P66): the distinct competitor count that
        // produced `armFiller` — siblingSwap's own `competitors` field,
        // mirrored here for the select protocol so a degenerate
        // one-candidate arm is marked the same way on both paths, rather
        // than shipping byte-identical to a genuinely competitive pick.
        let armCompetitors = competingFillerCount(ends.end2, shownList, { exclude: [ends.end1], pool: fillerPool });
        const lit = (end) => new RegExp(String(end).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        let armClaim = sentence.replace(lit(ends.end2), armFiller);
        // THE SECOND ARM WALL (S52), and its declared widening. The swap is a
        // LITERAL replacement of end2 in the claim, so a claim that
        // paraphrases its own end2 — "the people who had abandoned it" where
        // end2 is "inhabitants" — leaves the sentence unchanged and refuses
        // `unarmed-select` for a reason that has nothing to do with the
        // ammunition. Which end a claim says literally is an accident of how
        // it was worded, not a fact about whether it can be tested: an arm
        // that swaps end1 asks the picker exactly the same question ("is this
        // sentence about THIS one, or that one"), so when end2 cannot be
        // reached the other end is a real arm and not a weaker one. Declared
        // and off by default, because it can only ever build an arm where
        // none was buildable — it widens what can land, and a widening is
        // never shipped on by default here.
        if (armClaim === sentence && armEitherEnd) {
          const other = competingFiller(ends.end1, shownList, { exclude: [ends.end2], pool: fillerPool });
          if (other) {
            armClaim = sentence.replace(lit(ends.end1), other);
            armCompetitors = competingFillerCount(ends.end1, shownList, { exclude: [ends.end2], pool: fillerPool });
          }
        }
        if (armClaim === sentence) return { refused: "unarmed-select", via: "select" };
        const armPick = foldSelect(await selectAsk(buildSelectMessages(armClaim, shownList)), shownList);
        // INSENSITIVITY IS POINTING AT THE SAME PLACE, not merely saying yes
        // twice. Measured live: the first cut refused any arm that answered
        // "states" at all, and killed 3 of 3 true positives — because a
        // competing filler drawn from the candidates genuinely occurs in
        // them, so a sentence naming it exists and answering "yes" about it
        // is not by itself an error. What decides nothing is a picker that
        // returns the SAME sentence for two different claims: that index
        // carries no information about what was asked. A picker that points
        // elsewhere discriminated, and its pick on the real claim stands.
        // SAME SENTENCE, not same number: a turn hands a sentence and the
        // paragraph holding it, so one stating sentence can be offered twice
        // (measured live 2026-09-16, "Ulysses S. Grant was born in Point
        // Pleasant, Ohio, in 1822." at candidates 1 and 2). A picker that
        // points at the other copy for the swapped claim has not discriminated.
        if (armPick.verdict === "states" && (armPick.index === picked.index || armPick.because === picked.because))
          return { refused: "indiscriminate", via: "select", arm: armClaim, at: picked.index };
        // The pick's address is the one CARRIED FORWARD from its cut — no
        // search. The decider shown is the source's own bytes (`raw`, line
        // breaks and all); the span is the sentence's own offset. When the
        // segmenter gave no offset, the address is honestly null rather
        // than guessed.
        const chosen = cands[picked.index - 1];
        const unbackedFigures = figuresUnbacked(sentence, chosen.raw);
        if (unbackedFigures.length) return { refused: "figure_unbacked", via: "select", because: chosen.raw, figures: unbackedFigures };
        return {
          verdict: "states",
          because: chosen.raw,
          via: "select",
          span: chosen.start == null ? null : { ref: source.ref, at: `${source.ref}#${chosen.start}-${chosen.end}`, text: chosen.raw },
          competitors: armCompetitors,
        };
      }
      // a select refusal is a real "no from the activated set" — return it,
      // don't silently retry the wanderable generate path on the same slice
      return { refused: picked.refused ?? "no-testimony", via: "select" };
    }
  }
  const real = await ask(sentence, slice);
  const swapped = real ? siblingSwap(sentence, slice, { hint: real.because ?? "" }) : null;
  const arm = swapped ? await ask(swapped, slice) : null;
  // `swapped.competitors` (siblingSwap's own disclosed count) rides through
  // to foldTestimony so a degenerate one-candidate arm is marked, never
  // shaped identically to a genuinely competitive one (P66).
  const t = foldTestimony({ real, arm, armed: Boolean(swapped), slice, claim: sentence, swapped: swapped ?? "", competitors: swapped?.competitors ?? null });
  if (!t.verdict) return { refused: t.refused ?? "no-testimony" };
  // THE DECIDER MUST KEEP THE CLAIM'S COMPANY (P31's company law, aimed at
  // the decider instead of the number). foldTestimony's containment wall
  // checks BYTES — a decider verbatim in the slice passes even when it does
  // not state the claim, and the first note ever through the ledger's
  // ≥2-source mouth rode exactly that gap: claim "The Grande Armée fought
  // against the Imperial Russian Army", decider "Tolstoy used a great deal
  // of his own experience in the Crimean War..." — verbatim in the slice,
  // silent on the claim. Byte containment is not entailment; company is
  // the cheap mechanical proxy this repo already licenses: the decider
  // must share at least two of the claim's own content features, or the
  // vote does not land. Refused typed, never a conviction — the same
  // withhold-vs-convict rule as every refusal above.
  if (t.verdict === "states") {
    const unbackedFigures = figuresUnbacked(sentence, t.because);
    if (unbackedFigures.length) return { refused: "figure_unbacked", because: t.because, figures: unbackedFigures };
    const cf = testimony.featuresOfClaim ?? ((x) => new Set(String(x ?? "").toLowerCase().match(/\p{L}{4,}/gu) ?? []));
    const deciderFeats = cf(t.because);
    if (ends) {
      // PER-END COMPANY — derived from the relation's own structure, never
      // tuned to a specimen (P71): an assertion relates two ends, so a
      // decider silent on either end cannot be stating the relation. The
      // live specimen that forced this: the whole-claim floor passed a
      // decider containing "the Imperial Russian Army" VERBATIM (end2,
      // three shared features) while never mentioning the Grande Armée
      // (end1) or any fight — topic adjacency defeats any whole-claim
      // count, the same failure class that killed company-based act
      // identity. Per-end asks the structural question instead.
      // COMPANY FOLDS MORPHOLOGY when a caller supplies `testimony.sameForm`
      // (the engine's own sameAct over a received morphology prior): measured
      // live 2026-09-02, the witness pointed at "ordered his soldiers to
      // prepare for battle" for the end "prepared for battle" and this wall
      // threw it out as unrelated — "prepared" and "prepare" were two strings.
      // Without the organ, exact match, byte-identical to before.
      const same = testimony.sameForm ?? null;
      const inCompany = (w) => deciderFeats.has(w) || (same ? [...deciderFeats].some((d) => same(w, d)) : false);
      const e1 = [...cf(ends.end1)].some(inCompany);
      const e2 = [...cf(ends.end2)].some(inCompany);
      if (!e1 || !e2) return { refused: "decider_unrelated", because: t.because, missingEnd: !e1 ? "end1" : "end2" };
    } else {
      // no ends supplied (a direct caller with only a sentence): the weaker
      // whole-claim floor, kept for what it can honestly do
      const claimFeats = cf(sentence);
      const shared = [...deciderFeats].filter((w) => claimFeats.has(w));
      if (new Set(shared).size < 2) return { refused: "decider_unrelated", because: t.because };
    }
  }
  // AN UNCHALLENGED YES IS NOT A SECOND WITNESS. foldTestimony ships a
  // `states` verdict even when no sibling could be built — correct for its
  // own caller (an unarmed reading is still a reading, and the app marks it
  // so), and NOT sufficient to vote here. Caught by this module's own
  // control: a witness that affirms everything walked straight through on a
  // note whose only name was its subject, because cite.js's namesIn vetoes
  // sentence-initial capitals (L2) and siblingSwap therefore had nothing to
  // swap. Bovens & Hartmann in one line — coherence among unchallenged
  // low-reliability reports is nearly worthless; the arm IS the challenge.
  if (t.verdict === "states" && !t.armed) return { refused: "unarmed" };
  // The decider's address in the SOURCE's own bytes — the vote is
  // re-openable or it is not landed (P5.2).
  const at = t.because ? String(source.text).indexOf(t.because) : -1;
  return {
    verdict: t.verdict,
    because: t.because,
    span: at >= 0 ? { ref: source.ref, at: `${source.ref}#${at}-${at + t.because.length}`, text: t.because } : null,
    // Disclosed, never hidden (P66): how many distinct sibling names the
    // arm actually had to choose from. Omitted when foldTestimony was not
    // given one (t.competitors undefined) so a caller checking for the
    // field's presence, not merely its value, can still tell "not
    // reported" apart from "one."
    ...(t.competitors != null ? { competitors: t.competitors } : {}),
  };
}

/**
 * Whether a note's two ends are reachable through a SOURCE'S OWN RESOLVED
 * REFERENT FACE, rather than through literal word co-presence in the raw
 * text (`endsCopresentWindow`'s question). S62 measured these as two
 * different selectors with opposite verdicts at the level a walk actually
 * spends its budget: literal co-presence admits at a redealt-null rate
 * (p ≈ 0.905 — dead), while the reader's own resolved face, over the
 * SAME material, separates from its redealt null (p ≈ 0.048). This is
 * that measured selector, made reusable rather than re-derived per driver
 * (P14): given a source's own extracted edges — each optionally carrying
 * `sFace`/`oFace`, the referent face `hypergraph.js`'s reader resolved for
 * that edge's ends, alongside its raw `s`/`o` — and a note's two ends, it
 * asks whether SOME edge's face covers end1 AND some edge's face (or, when
 * no face resolved, its raw object text) covers end2. `overlaps` is the
 * module's own content-word share, `featuresOf` overridable exactly like
 * every other selector here.
 *
 * Deliberately asymmetric on purpose, carried unchanged from where it was
 * measured (`eval/the-fold/ordered-read-reach.mjs`): the subject side
 * requires a resolved face (a bare literal match is exactly what this
 * selector exists to stop trusting); the object side keeps a literal
 * fallback, because an object is frequently a description with no face to
 * resolve at all and refusing it outright would silently narrow recall in
 * a way never measured.
 */
export function facesReachable(sourceEdges, ends, { featuresOf = textFeatures } = {}) {
  const overlaps = (a, b) => {
    const x = [...featuresOf(a)], y = [...featuresOf(b)];
    return x.length > 0 && y.length > 0 && x.some((w) => y.includes(w));
  };
  const e1 = String(ends?.end1 ?? ""), e2 = String(ends?.end2 ?? "");
  if (!e1 || !e2) return false;
  for (const e of sourceEdges ?? []) {
    const sHit = e.sFace && overlaps(e.sFace, e1);
    const oHit = (e.oFace && overlaps(e.oFace, e2)) || overlaps(e.o, e2);
    if (sHit && oHit) return true;
  }
  return false;
}

/**
 * The wiring: walk proposed candidates under a declared ask budget, land
 * every "states" through the door's attest, report everything typed.
 * `door` is the makeHyperlexicon bundle; `log` is threaded, never mutated.
 */
export async function corroborateLedger(log, door, sources, {
  ask, selectAsk = null, testimony, maxAsks, limitPerSource, featuresOfSource, featuresOfNote, render, splitSentences = null,
  // The walk's boundary. Giver: the ledger's own >=2-witness mouth — the
  // quantity this module exists to feed — never a tuned number.
  settleFloor = 2,
  // The co-presence prefilter's reach, in chars either side of an end-word.
  // 400 is endsCopresentWindow's own default (a hand-picked P4 debt, named
  // there); a caller widening it is judged on the MARGINAL pairs it admits
  // (LP11), never on aggregate — eval/copresence-audit.mjs is the offline
  // measure of how many pairs each width would add.
  copresenceWindow = 400,
  // OPTIONAL, and REPLACES the co-presence admission decision when
  // supplied — never ANDs with it, because S62 measured the two selectors
  // as disagreeing about which pairs are worth an ask, and ANDing a
  // measured-noisy gate onto a measured-separating one would silently
  // suppress exactly the recall the better selector was built to recover.
  // `reachable(sourceRef, {end1, end2})` → boolean. The co-presence WINDOW
  // is still computed either way, because `witnessNote`'s slice text wants
  // it when one exists; only the ADMIT decision moves. Omitted, this
  // function's behavior is byte-identical to before.
  reachable = null,
} = {}) {
  if (!Number.isFinite(maxAsks)) throw new TypeError("corroborateLedger: maxAsks is declared by the caller (P9)");
  let next = log;
  let asks = 0;
  const attested = [];
  const contradicted = [];
  const refusals = { "no-slice": 0, "no-testimony": 0, insensitive: 0, uncontained: 0, unreadable: 0, unarmed: 0, decider_unrelated: 0, "unarmed-select": 0, indiscriminate: 0, incoherent: 0, figure_unbacked: 0, other: 0 }; // the select path's own two typed refusals are tallied by name — measured landing in "other" on the first select-vs-generate run, a typed refusal counted as a wildcard
  // Structurally hopeless candidates, skipped WITHOUT an ask — a
  // proposal-time refusal, tallied apart from the witness's own refusals
  // because no model call was spent and no testimony was heard.
  let skippedNoCopresence = 0;
  const copresence = new Map(); // `${noteId}\u0000${ref}` -> window|null, computed once
  // note id -> Set of source refs disputing it. SEEDED FROM THE LEDGER, not
  // empty: this Map used to be born blank every run and commented "THIS
  // RUN", which is exactly how contest evaporated while corroboration
  // accumulated — a note contested on Monday ranked as merely thin on
  // Tuesday, and the third source that would have settled it was never
  // sought. Reading the standing disputes back means the walk STARTS
  // knowing what is contested, and askValue's contested-first ranking
  // (value 2, the highest-information ask available) finally spans runs.
  const contradictSources = new Map();
  for (const [noteId, ds] of door.disputesOf(next)) contradictSources.set(noteId, new Set(ds.map((d) => d.source)));
  const askedPairs = new Set();        // `${noteId}\u0000${sourceRef}` — a spent call is spent, refusal included

  // Feasibility is precomputed per source (overlap cannot change mid-run);
  // VALUE is recomputed after every ask, because every ask can move it.
  const feasible = new Map(); // source.ref -> Map(note id -> {sentence, shared})
  // S60: "read the wall at zero calls" — the candidate count BEFORE either
  // prefilter runs, so a caller can see how much of a walk's own reach was
  // spent by proposeCandidates's word-overlap floor versus the co-presence
  // (or `reachable`) admission gate, without re-deriving either count.
  let candidatePairs = 0;
  for (const source of sources) {
    const notes = door.foldNotes(next);
    const proposed = proposeCandidates(notes, source.text, { limit: limitPerSource ?? notes.length, ...(featuresOfSource ? { featuresOfSource } : {}), ...(featuresOfNote ? { featuresOfNote } : {}), ...(render ? { render } : {}) });
    feasible.set(source.ref, new Map(proposed.map((c) => [c.note.id, c])));
    candidatePairs += proposed.length;
  }
  const sourceByRef = new Map(sources.map((s) => [s.ref, s]));

  while (asks < maxAsks) {
    const notes = door.foldNotes(next);
    const byId = new Map(notes.map((n) => [n.id, n]));
    // Every feasible, unspent, still-movable (note, source) pair, ranked by
    // value first and overlap only as the tiebreak — the dark-room guard is
    // this sort order plus the value-0 exclusion, not a comment.
    let best = null;
    for (const [ref, cands] of feasible) {
      for (const [noteId, c] of cands) {
        const note = byId.get(noteId);
        if (!note) continue;
        if (askedPairs.has(`${noteId}\u0000${ref}`)) continue;
        // a source never seconds its own sighting (Ladha: one perspective)
        // A witness may carry `~recipe` (P68); the source is what is compared.
        if (distinctSources(note.witnesses ?? []).has(ref)) continue;
        const v = askValue(note, { contradictSources, settleFloor });
        if (v.value === 0) continue;
        // PREFILTER (the same per-end geometry as the decider wall, applied
        // before spending): no co-presence window means the wall could
        // never pass — skip without an ask, once per pair.
        const pairKey = `${noteId}\u0000${ref}`;
        const ends = { end1: note.end1 ?? note.subject, end2: note.end2 ?? note.object };
        if (!copresence.has(pairKey)) {
          const srcText = sourceByRef.get(ref).text;
          const w = endsCopresentWindow(srcText, ends, { window: Number.isFinite(copresenceWindow) ? copresenceWindow : srcText.length });
          const admitted = reachable ? Boolean(reachable(ref, ends)) : Boolean(w);
          copresence.set(pairKey, { w, admitted });
          if (!admitted) { skippedNoCopresence += 1; askedPairs.add(pairKey); }
        }
        if (!copresence.get(pairKey).admitted) continue;
        if (!best || v.value > best.v.value || (v.value === best.v.value && c.shared > best.c.shared)) {
          best = { note, c, v, ref };
        }
      }
    }
    if (!best) break; // everything reachable is settled, disconfirmed, or spent — the walk's own stop, not the budget's
    asks += 1;
    askedPairs.add(`${best.note.id}\u0000${best.ref}`);
    const win = copresence.get(`${best.note.id}\u0000${best.ref}`)?.w ?? null;
    const w = await witnessNote(best.c.sentence, sourceByRef.get(best.ref), {
      ask, testimony,
      ends: { end1: best.note.end1 ?? best.note.subject, end2: best.note.end2 ?? best.note.object },
      // SLICE CENTERING: read where a stating sentence would have to live.
      slice: win?.text ?? null,
      // ACTIVATION: when a segmenter AND a selectAsk are present,
      // witnessNote prefers the select protocol over the centered slice —
      // point, never generate.
      selectAsk, splitSentences,
    });
    if (w.refused) { refusals[w.refused in refusals ? w.refused : "other"] += 1; continue; }
    if (w.verdict === "contradicts") {
      if (!contradictSources.has(best.note.id)) contradictSources.set(best.note.id, new Set());
      contradictSources.get(best.note.id).add(best.ref);
      // LANDED, through the door's own contest act — the note is NOT
      // convicted (no witness moves, no span moves, standingOf is
      // byte-identical), but that this source denied it is now a durable
      // fact carrying its decider and that decider's address in the
      // DISPUTING source's bytes. A contradiction with no decider is
      // refused by the act rather than landed as a bare vote, and the
      // refusal is reported here rather than swallowed.
      const d = door.dispute(next, best.note.id, { source: best.ref, because: w.because, span: w.span });
      if (!d.refused) next = d.log;
      contradicted.push({ note: best.note, source: best.ref, because: w.because, disputeId: d.id ?? null, landed: Boolean(!d.refused && !d.noop), refused: d.refused ?? null });
      continue;
    }
    const r = door.attest(next, best.note.id, { witness: `testimony:${best.ref}`, span: w.span, because: w.because });
    if (!r.refused) { next = r.log; attested.push({ note: best.note, source: best.ref, because: w.because }); }
  }

  // The standings the walk ended on — reported typed, so a caller can route
  // `disconfirmed` to the claims tier (which owns contradiction) and can
  // see `contested` as "ran out before the third source", never as silence.
  const standings = { settled: [], contested: [], disconfirmed: [], thin: [] };
  // CON·Pattern at the fifth turn: the CONTEST STRUCTURE among notes —
  // who states, who contradicts, per note — as data a caller (the claims
  // tier, the third-source seeker) can act on, never a flat list of ids.
  const contests = [];
  const live = door.disputesOf(next);
  for (const n of door.foldNotes(next)) {
    const v = askValue(n, { contradictSources, settleFloor });
    standings[v.reason === "settled" ? "settled" : v.reason === "disconfirmed" ? "disconfirmed" : v.reason === "contested" ? "contested" : "thin"].push(n.id);
    const contra = contradictSources.get(n.id);
    if (contra?.size) contests.push({ noteId: n.id, stating: [...distinctSources(n.witnesses)], contradicting: [...contra], disputes: (live.get(n.id) ?? []).map((x) => ({ id: x.id, source: x.source, because: x.because, span: x.span })) });
  }
  return { log: next, attested, contradicted, refusals, asks, skippedNoCopresence, candidatePairs, standings, contests, disputes: live, calibration: WITNESS_OPERATING_POINT, settleFloor };
}
