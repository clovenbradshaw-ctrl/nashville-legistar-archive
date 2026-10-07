// capacity-runner.js — TWO capacities actually execute from the terminal
// as of 2026-08-19: `cast` (cast.js::makeReferentIndex) and `relations`
// (hypergraph.js::makeRelationReader, capacities.js's own `terrain: "Link"`
// entry, wired the same day the fillers/queryReferents work landed —
// "can we now mechanically query the entire hypergraph" / "make sure this
// work with the sandboxed terminal too"). capacities.js's own header is
// explicit that its registry is "A DATA TABLE, NOT A RUNTIME" — this is the
// runtime, kept in its own file so that boundary stays visible rather than
// blurred into either the data table or the pure grid parser.
//
// Every OTHER registered capacity stays reference-only: asking to run one
// is a typed gap (`not_yet_executable`), never a silent no-op and never a
// fabricated result. Wiring the rest is named future work in CLAUDE.md, not
// implied done by this file existing.
//
// AMENDED (2026-08-20) — grammar-lens.js is wired into `landAct`'s evaluate
// path, additively and optionally. An investigation confirmed live, on real
// pg2600.txt prose read through this exact evaluate path, that
// grammar-lens.js's Thrax/UD connector classification sat unused beside
// this file's computed EVA verdicts: eleven real edges whose own connector
// read as a preposition/conjunction/pronoun/adverb/noun — never a verb —
// still shipped `holds` or `refused`, squaring and checkObjectSpecificity
// both blind to the defect (see `checkConnectorClass`'s own header). The
// fix is one more check, mirroring `checkObjectSpecificity`'s own shape
// exactly: an OPTIONAL `classifyConnector`/`minShare` pair on `landAct`'s
// options bag (the cast.js injection pattern this file already uses
// everywhere else). Omitted — every pre-existing caller, term.js's `act`
// command and app.js's `/act` door included — the check is skipped and
// behavior is byte-identical to before this pass. Wiring it into those two
// real call sites — choosing a production `minShare` with its own declared
// justification, and deciding this check should actually convict a real
// user-facing verdict — is real, scoped, NOT attempted here: a larger,
// disclosed product call than "one additional check," not folded quietly
// into this pass either.
//
// CORRECTED (Per-Source Testimony spec, BUILD-3) — the paragraph above
// used to also cite "loading a POSPrior@1 corpus into the browser page for
// the first time" as a reason this stayed unwired. Checked while building
// BUILD-3, not assumed still true: app.js ALREADY fetches and serves this
// exact corpus (`/priors-data/pos-prior-eng.json`, non-blocking, for
// hypergraph.js's OWN sibling `grammar` field — see hypergraph.js's own
// `classifyConnector`/`minShare` organ comment for how that field differs
// from this one). That blocker is gone; the `minShare`-choice-and-product-
// decision blocker above is the one still standing.
//
// AMENDED AGAIN (Per-Source Testimony spec, BUILD-3) — the check itself
// moved from a post-hoc call inside `checkConnectorClass` to a tag
// `hypergraph.js`'s `makeRelationReader` computes at EXTRACTION TIME
// (`edge.connectorClass`, wired the identical way `edge.assertion` already
// is). `checkConnectorClass` now reads that tag off the matched edge first
// and only calls `classifyConnector` itself as a fallback for an untagged
// edge — see that function's own header, further down this file, for the
// full account. This file still imports no engine module and still has no
// direct `import` of grammar-lens.js anywhere — `classifyConnector` has
// always arrived here as an injected function, from whichever caller
// constructs one (a test, or eventually a real `relationsFor`), never from
// an import this file owns.
//
// PURE, ORGANS INJECTED (the cast.js pattern, one level up): the real
// engine perceiver functions arrive as `referentIndexFor`, already bound
// by the caller (app.js reuses the exact organ bundle it already
// constructs for castFor/handlesFor/relationsFor — no new engine import),
// so this module loads by relative path in tests and needs nothing of its
// own from `/engine`.
//
// DISCLOSED, NOT SILENTLY ABSENT — two limits an adversarial review of this
// increment found; the first is now PARTIALLY closed (below), the second
// still is not, on purpose, under time pressure that would have risked a
// worse fix:
//
// 1. RUNS SYNCHRONOUSLY ON THE CALLING THREAD, with no interrupt.
//    term.js's OTHER runtimes (js/python/sql) exist as Workers specifically
//    so a long-running or unbounded computation cannot freeze the page and
//    CAN be killed (term.js's own ✕/ctrl+c) — this capacity runner has
//    neither property. AMENDED: `text` is now capped at
//    `CAPACITY_TEXT_MAX_CHARS` before either capacity ever sees it — closed
//    the hard way, by reproducing the freeze this disclosure warned about:
//    a real 1.19MB attached source, run through this exact dispatch with
//    no cap, took 328s end to end (measured, `eval`-adjacent driver, not
//    guessed) and froze the tab solid — `crownTestimony`'s fire-and-forget
//    per-claim call (app.js) hits this path automatically after every
//    grounded turn, so "large loaded source" was never a hypothetical. The
//    cap is a MINIMUM fix, not the complete one: a person who deliberately
//    wants the whole document read still cannot get past the same 8000
//    chars this way, and the calling thread is still not interruptible
//    mid-computation on whatever it IS given. Moving capacity execution
//    into a worker (mirroring term-py-worker.mjs's own shape) is still the
//    real fix for both remaining gaps and is still not attempted here.
//
// 2. A RESULT ATTACHED TO A LATER-SUPERSEDED ACT DISAPPEARS FROM THE LIVE
//    FOLD WITH IT. This is `grid.js`'s own append-only supersession rule,
//    applied consistently (task-log.js: "superseded tasks drop out of the
//    live set — but nothing is deleted from `log.entries`") — a cast
//    result attached to a `distinguish`'s INS entry is exactly as durable
//    as the entry it rides on, recoverable from the raw log at an earlier
//    cursor, gone from `foldGrid`'s live view once that entry is
//    superseded. Confirmed live, worth stating plainly rather than
//    assuming a reader infers it: `distinguish` lands TWO entries (SIG
//    then INS) and only the INS one ever carries a cast result; a `revise
//    … supersedes <the SIG id>` (superseding the wrong half of the pair)
//    leaves an orphaned INS-only entry with its result still live but no
//    surviving SIG partner in the fold — the pair is not kept atomic
//    under supersession. Not attempted here.

import { chunkSource } from "./source.js";
import { withExperiencer } from "./experiencer.js";

/**
 * `makeCapacityRunner({ referentIndexFor, relationsFor })` →
 * `runCapacity(id, { text, name, query })`. `referentIndexFor` is
 * `cast.js::makeReferentIndex(organs)`; `relationsFor` is
 * `hypergraph.js::makeRelationReader(organs)` — the SAME organ bundle
 * app.js already builds for both (no new engine import).
 *
 * A SECOND capacity executes as of 2026-08-19 (user direction: "can we now
 * mechanically query the entire hypergraph" / "make sure this work with
 * the sandboxed terminal too") — `"relations"`, capacities.js's own
 * `terrain: "Link"` entry, sitting unwired since the terminal language
 * landed. `query` is optional: omitted, the capacity returns the whole
 * edge graph the material binds (the same "dump everything found" default
 * `cast` already has with no further refinement); given, it must leave
 * EXACTLY ONE of subject/object open (`hypergraph.js::queryReferents`'s
 * own contract — "who did Lincoln appoint" or "who appointed Hamlin,"
 * never both pinned or both open) and returns the distinct referent-aware
 * fillers for that slot, each with its own addresses. Referent-aware, not
 * a surface-string match: this runs INSIDE the reader's own closure, so
 * "Lincoln" and "President Lincoln" resolve by the same identity judge()
 * itself trusts (the standalone hypergraph.js::queryEdges/queryFillers are
 * the weaker, no-organs-needed siblings of this, disclosed as such in
 * their own header).
 */
// Declared, reused rather than re-derived: `live_priors/scripts/eot-sidecar.mjs`
// (a sibling instrument reading this same the-fold/hyperlexicon.js machinery
// offline) already settled on 8000 chars as "one reading," measured safe
// there (~1s on real prose). This file's own header above names BOTH
// capacities as running unbounded on the calling thread with no interrupt —
// confirmed the hard way: a live 1.19MB attached source, joined back into
// one string by relationsFor exactly as this dispatch already did, took
// 328s end to end and produced the exact freeze this cap exists to prevent
// (renderFold's uncapped JSON.stringify of the resulting model turns, on
// top of an unresponsive main thread, reads to a reader as a dead tab, not
// a slow one). One bound, applied ONCE here — every caller (landAct's cast
// and evaluate branches, squarePolarity's own internal re-check) routes
// through this single function, so nothing downstream needs its own copy.
// This is the disclosed-gap's MINIMAL fix, not its complete one: the
// header above is still correct that a worker (mirroring term-py-worker
// .mjs) is the real fix, for the same reason a cap can't be — a person who
// deliberately wants the whole document read still can't get past 8000
// chars this way. Not attempted here, under the same time-pressure
// disclosure this file's header already makes about its own scope.
const CAPACITY_TEXT_MAX_CHARS = 8000;

export function makeCapacityRunner({ referentIndexFor, relationsFor }) {
  return function runCapacity(id, { text, name, query, claim } = {}) {
    if (id !== "cast" && id !== "relations") {
      return {
        gap: "not_yet_executable",
        id,
        detail: `"${id}" is in the capacity registry but not yet wired to run from the terminal — only "cast" and "relations" execute this pass (capacities.js, CLAUDE.md: "the terminal language" section names the rest as open).`,
      };
    }
    if (!text || !text.trim()) {
      // This module only ever sees bytes (or their absence) — it cannot
      // itself distinguish "no source by this name is loaded" from "one
      // is loaded and it is empty." Callers that can tell the two apart
      // (term.js checks source-key presence before ever calling this) do
      // so on their own side; the wording here stays true either way.
      return { gap: "no_material", id, detail: `no material to read for "${name ?? "?"}" — either nothing by that name is loaded, or what is loaded there is empty` };
    }
    const totalChars = text.length;
    const truncated = totalChars > CAPACITY_TEXT_MAX_CHARS;
    const boundedText = truncated ? text.slice(0, CAPACITY_TEXT_MAX_CHARS) : text;
    const bound = truncated ? { truncated: true, examinedChars: CAPACITY_TEXT_MAX_CHARS, totalChars } : { truncated: false };
    if (id === "cast") {
      const index = referentIndexFor([{ text: boundedText }]);
      const referents = [...index.referents]
        .map((rid) => ({ id: rid, surface: index.represent(rid) }))
        .sort((a, b) => a.surface.localeCompare(b.surface));
      return { id, name: name ?? null, count: referents.length, referents, ...bound };
    }
    if (!relationsFor) {
      return { gap: "not_yet_executable", id, detail: `"relations" is registered but this page has not wired relationsFor in yet` };
    }
    // Real addresses, not a bare unaddressed blob: `cast` doesn't need refs
    // (it reports referent identities, not evidence), but a "relations"
    // result IS evidence — an edge or a filler with no address is a claim
    // with nothing a reader can verify it against. chunkSource is the
    // SAME chunker every attachment/preflight/priors source in this app
    // already goes through (source.js) — one addressing scheme, not a
    // second one invented for the terminal.
    const reader = relationsFor(chunkSource(name ?? "material", boundedText));
    if (!reader.examined) {
      return { gap: "no_material", id, detail: `no relation vocabulary could be measured for "${name ?? "?"}"`, ...bound };
    }
    // `claim` is EVA's own door: not a query over the graph (which/what
    // filler for an open slot) but a JUDGMENT of one stated claim against
    // it, via hypergraph.js's real `read(answer)` — the SAME judge()
    // every material-grounded chat answer is already checked against, so
    // an evaluate act gets no weaker a check than an ordinary turn does.
    // `claims` carries each sentence's own verdict (bound/contradicted/
    // unbound/beyond-reach/unheard/competing) with its real provenance
    // (`nearest`/`bound` edges, each an edgeFace carrying `refs`) — never
    // collapsed here into a caller's yes/no; that collapse, and the
    // deliberate refusal to guess on the three non-committal verdicts, is
    // `landAct`'s job below, not this dispatch's.
    if (claim) {
      const judged = reader.read(claim);
      // `edges` (the material's own real graph, not just this claim's
      // verdict) rides along too — squaring checks POLARITY; a bound
      // verdict can still be wrong in a second, different way a polarity
      // check cannot see (see checkObjectSpecificity below), and that
      // check needs the real matched edge's own object text, not just
      // the collapsed bound/contradicted/unbound label.
      return { id, name: name ?? null, claim, claims: judged.claims, edges: judged.edges, ...bound };
    }
    if (!query) return { id, name: name ?? null, count: reader.edges.length, edges: reader.edges, ...bound };
    const fillers = reader.queryReferents(query);
    if (fillers === null) {
      return {
        gap: "bad_query",
        id,
        detail: 'exactly one of subject/object must be left open — "who did X verb" or "who verb Y", never both pinned or both open',
      };
    }
    return { id, name: name ?? null, query, count: fillers.length, fillers, ...bound };
  };
}

// ── landAct: the one shared "parse a line, land it, maybe execute a
// capacity" orchestration (added when the chat grew its own /act door
// alongside the terminal's) ─────────────────────────────────────────────
//
// Before this, "distinguish's ground names an already-loaded source →
// run cast for real → attach the result" lived ONLY inside term.js's own
// `act` fold-command handler — the CHECK (`parsed.event.verb ===
// "distinguish" && parsed.event.ground && Object.hasOwn(sources,
// parsed.event.ground)`) was policy, not formatting, and policy embedded
// in one DOM-bound handler is exactly the shape of bug this pass's own
// postmortem already caught twice (grid.test.mjs: DEF/EVA's Array.find
// first-match bug, synthesize's String.includes substring bug — both
// "one correct implementation, and a second place nobody kept in sync
// with it," just not yet a SECOND place at the time they were fixed). The
// chat's /act door needs the identical policy, so rather than copy the
// check into app.js and hope the two never drift, it moved here once and
// both callers (term.js's `act` handler, app.js's `actTurn`) call this.
//
// This is still not a third module's worth of scope: it composes grid.js
// (injected as `grid`, the same `makeGrid(...)` instance both callers
// already hold) and `runCapacity` (this file's own export, above) — no
// new engine import, no new organ.

// ── squaring polarity — a caller-side check, not an engine fix ─────────────
//
// hypergraph.js's own extractRelations reads a claim's polarity off a
// negation-scope window that (measured live, real diagnostic, not assumed)
// only ever tests text through the end of the SUBJECT capture — it never
// reaches the verb-to-object span. "Lincoln never appointed Hamlin" only
// negates correctly by ACCIDENT (the subject group's own greedy 2-token
// slot happens to swallow "never" when the subject is a single word);
// "Andrew Johnson was never the 17th president" and "Grand Canyon is never
// one of the most studied geologic landscapes" both have full 2-token
// subjects, leave "never" stranded past the checked window, and silently
// keep reading as affirmative. This is a real, disclosed bug in a widely-
// shared engine file (dozens of real callers across both repos, including
// a conformance test named for exactly this seam) — fixing it AT THE
// SOURCE is real, scoped, unattempted work, not undertaken here: its
// safety can't yet be certified against the engine's own conformance
// suite and the several already-published MINE-1 measurements that read
// off the same polarity field.
//
// What CAN be built without touching relations.js at all: a caller-side
// check that never trusts a single polarity reading. Evaluate the claim's
// own NEGATION the same mechanical way the claim itself gets evaluated; if
// the two readings genuinely DISAGREE (one holds, one refused), the
// extractor's negation detection is trustworthy for this sentence shape.
// If they AGREE — both read the same way — that agreement is itself the
// tell that negation silently failed on this construction, and the
// original verdict must not ship as a confident holds/refused; it
// downgrades to undetermined, the same discipline `arithmetic.js`'s own
// order-reversing-phrase refusal already holds elsewhere in this repo: an
// unconfirmed computed answer is worse than an honest gap.
const COPULAS = new Set(["was", "is", "are", "were", "am", "be", "been"]);
// Deliberately narrower than the engine's own NEGATION_WORDS (priors.js,
// giver lang/en) — this is a mechanical text-editing token list for
// constructing a candidate sentence, not a semantic negation-detection
// vocabulary, so it names only the single word this module's own
// insert/remove transform actually produces and recognizes.
const NEGATION_TOKENS = new Set(["never"]);

/**
 * Real, disclosed limit of this mechanical transform, validated against
 * this bug's own known specimens (Lincoln/Hamlin — transitive, negates
 * correctly; Andrew Johnson, Grand Canyon — copula, silently fails after
 * the copula but recovers before it): a single fixed insertion rule is
 * fragile (a naive "always before the verb" rule dodges the copula bug
 * entirely and would wrongly TRUST a broken reading; a naive "always
 * after" would wrongly DISTRUST a reading that "before" would have
 * confirmed). This tries several plausible insertion points instead of
 * guessing one, and returns them ALL as candidates — the caller only
 * needs ONE to disagree for the pair to be trustworthy. When a copula is
 * present, "never" is tried both immediately before and immediately
 * after it. When no copula is found, "never" is tried after the first
 * token (the transitive-verb pattern validated on "Lincoln never
 * appointed Hamlin") and after the second (the same pattern for a
 * two-word proper-name subject). An ALREADY-negated claim gets its
 * negation word REMOVED rather than doubled — stacking a second "never"
 * onto an already-negated sentence produces double-negation gibberish
 * this extractor was never going to parse sensibly.
 */
export function negationCandidates(claim) {
  const words = String(claim ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const candidates = new Set();
  const negationIdxs = words.map((w, i) => (NEGATION_TOKENS.has(w.toLowerCase()) ? i : -1)).filter((i) => i !== -1);
  if (negationIdxs.length) {
    for (const i of negationIdxs) {
      const without = [...words.slice(0, i), ...words.slice(i + 1)].join(" ");
      if (without) candidates.add(without);
    }
    return [...candidates];
  }
  const copulaIdx = words.findIndex((w) => COPULAS.has(w.toLowerCase()));
  const insert = (at) => [...words.slice(0, at), "never", ...words.slice(at)].join(" ");
  if (copulaIdx !== -1) {
    candidates.add(insert(copulaIdx));
    candidates.add(insert(copulaIdx + 1));
  } else {
    if (1 < words.length) candidates.add(insert(1));
    if (2 < words.length) candidates.add(insert(2));
  }
  return [...candidates];
}

/** bound -> holds, contradicted -> refused, everything else (unbound,
 * beyond-reach, unheard, competing) -> null — the material never decides
 * for those, so this never guesses one on their behalf. */
function collapseVerdict(judged) {
  return judged?.verdict === "bound" ? "holds" : judged?.verdict === "contradicted" ? "refused" : null;
}

/**
 * Square a computed verdict against its own claim's negation(s), all run
 * against the SAME ground text via the SAME `runCapacity("relations",
 * {claim})` door the primary read used. Returns `{ trusted, checked }` —
 * `checked` is the real candidate list and their real verdicts, kept for
 * disclosure even when trusted, never hidden once computed.
 */
function squarePolarity(runCapacity, groundText, groundName, claimText, primaryVerdict) {
  const candidates = negationCandidates(claimText);
  const checked = candidates.map((candidate) => {
    const result = runCapacity("relations", { text: groundText, name: groundName, claim: candidate });
    const judged = (result.claims ?? [])[0] ?? null;
    return { candidate, verdict: collapseVerdict(judged) };
  });
  const trusted = checked.some((c) => c.verdict && c.verdict !== primaryVerdict);
  return { trusted, checked };
}

// ── object specificity — a second, DIFFERENT check squaring cannot do ──────
//
// Found live, testing this exact wiring against real material (the
// original Andrew Johnson specimen this whole investigation started
// from): "Andrew Johnson was the 22nd president" (false — the material
// says 17th) computed `holds`, squared and confirmed. Squaring only
// checks POLARITY (does the claim's negation disagree) — it says nothing
// about whether a bound claim's own OBJECT is the material's real object
// or a substituted wrong one, because hypergraph.js's own
// `endpointsMatch` object fallback (`tokensShare`) requires only that
// SOME token stem-matches, not that the claim's own distinguishing
// tokens do. "22nd president" and "the 17th president of the United
// States" share "president" and nothing else, and that ONE shared word
// is enough for `tokensShare` to call them the same object.
//
// A first cut of this fix re-filtered the edge graph by an EXACT
// subject+verb string match — wrong, found live on the second real
// specimen tried: "Andrew Johnson was the 16th vice president" (TRUE —
// the material's own words) binds through a PRONOUN subject ("The 16th
// vice president, HE assumed..."), which judge()'s own referent-aware
// endpointsMatch correctly resolves but a bare string-equality re-filter
// does not — the true claim's own backing edge was invisible to it, and
// a genuinely true claim got wrongly downgraded. The fix: never
// re-derive which edge backed the claim — READ IT OFF `judged.refs`,
// the real address(es) judge() itself already used to bind the claim,
// and check THAT edge's object, not a re-guessed one. This also needed
// widening from numbers-only to every content token: "Andrew Johnson was
// the 17th vice president" (FALSE — Johnson was the 16th VP; 17th is his
// separate PRESIDENT ordinal) still wrongly matched a numbers-only check,
// because "17th" genuinely does appear in the material — just on the
// wrong office. Requiring every one of the claim's own content words
// (not just numbers) to appear on the SAME real backing edge catches
// this: "vice" is never on the edge that actually supplied "17th".
const STOPWORDS = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "was", "is", "are", "were", "be", "been", "am"]);

function contentTokens(text) {
  // Unicode letters/numbers, not `[a-z0-9]` (P62, source.js::tokenize's own
  // widening, applied here directly rather than by importing tokenize — see
  // that function's own comment for why a lighter, separate split survives).
  // This one matters more than most siblings: an empty content-token set on
  // non-Latin text does not merely rank badly, it flips `trusted` to `true`
  // by this function's own documented "nothing to confirm, so nothing to
  // doubt" rule — a verification mechanism going BLIND reads as a claim
  // PASSING, exactly the "checks go blind rather than wrong" failure class
  // this repo's grounding ladder already names as worse than an ordinary miss.
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

/**
 * `edges` is the real material graph (runCapacity's "relations" `claim`
 * response now carries it alongside `claims`); `judgedRefs` is the SAME
 * claim's own `refs` — the real address(es) judge() used to bind it,
 * never re-derived. Returns `{ trusted, claimTokens, matchedTokens }` —
 * `trusted` is `true` when the claim's object carries no content token
 * to check (nothing to confirm, so nothing to doubt), when no real edge
 * can be found at the claim's own bound address (nothing to compare
 * against — an inconclusive check must not itself convict a verdict it
 * cannot examine), or when the real backing edge's own object states
 * EVERY one of the claim's content tokens, not merely one shared word.
 */
function checkObjectSpecificity(edges, judgedRefs, claimObjectText) {
  const claimTokens = contentTokens(claimObjectText);
  if (!claimTokens.size) return { trusted: true, claimTokens: [], matchedTokens: [] };
  const refSet = new Set(judgedRefs ?? []);
  if (!refSet.size) return { trusted: true, claimTokens: [...claimTokens], matchedTokens: [], inconclusive: "no address to check against" };
  const backing = (edges ?? []).filter((e) => (e.refs ?? []).some((r) => refSet.has(r)));
  if (!backing.length) return { trusted: true, claimTokens: [...claimTokens], matchedTokens: [], inconclusive: "no edge found at the claim's own bound address" };
  for (const e of backing) {
    const edgeTokens = contentTokens(e.end2);
    if ([...claimTokens].every((t) => edgeTokens.has(t))) {
      return { trusted: true, claimTokens: [...claimTokens], matchedTokens: [...edgeTokens] };
    }
  }
  return {
    trusted: false,
    claimTokens: [...claimTokens],
    matchedTokens: [...new Set(backing.flatMap((e) => [...contentTokens(e.end2)]))],
  };
}

// ── connector class — a THIRD, DIFFERENT check neither squaring nor
// object-specificity can do ──────────────────────────────────────────────
//
// Found live (a real investigation of whether grammar-lens.js's Thrax/UD
// classification actually protects this file's computed verdicts, or sits
// unused beside them): it sits unused. Real material —
// "Prince Vasíli always spoke languidly" (pg2600.txt's own Chapter I) and
// its Bezukhov-idiom regression twin below — extracts a real edge whose
// connector is "always", an adverb (102/102 ADV in the real
// UD_English-EWT treebank, VERB share 0), because extractRelations only
// ever checks SLOT (something fills the connector position between two
// argument-shaped spans), never CLASS (is that filler a verb) —
// grammar-lens.js's own documented finding. Neither existing check here
// catches it: squaring inserts/removes "never" and re-reads polarity,
// which an adverb-anchored "claim" answers just as consistently as a
// verb-anchored one; checkObjectSpecificity only ever inspects the
// OBJECT's own content tokens, never the connector's. Measured against
// eleven real edges pulled from real pg2600.txt prose through this exact
// evaluate path: squaring and object-specificity together still shipped
// `holds`/`refused` for edges whose own connector read as a preposition,
// a conjunction, a pronoun, an adverb, or a bare noun — never a verb.
//
// `classifyConnector`/`minShare` are OPTIONAL (the cast.js pattern this
// whole file already uses for `referentIndexFor`/`relationsFor`) — omitted
// entirely, every existing caller (term.js's `act` command, app.js's `/act`
// door, every test in this file predating this check) is BYTE-IDENTICAL to
// before this check existed. `minShare` has no safe default — grammar-
// lens.js's own header: a silently-defaulted 0.9 once let two of its own
// real garbled connectors through unflagged — and MUST be declared by
// whichever caller supplies `classifyConnector`, the exact discipline
// `mismatchedConnectors` itself already demands of every other caller.
//
// AMENDED (Per-Source Testimony spec, BUILD-3) — this function now PREFERS
// a tag `hypergraph.js`'s `makeRelationReader` already computed at
// EXTRACTION TIME (`edge.connectorClass`, the new `classifyConnector`/
// `minShare` organ pair, wired the identical way `edge.assertion` already
// is) over calling `classifyConnector` itself here, post-hoc. When the
// backing edge already carries the tag, this function calls
// `classifyConnector` ZERO times — it only reads what `relationsFor`
// already computed, the goal the spec itself names.
//
// The DIRECT-INJECTION call shape (`classifyConnector`/`minShare` passed
// straight to `landAct`, below) is KEPT, not removed — a disclosed choice,
// not an oversight. `capacity-runner.test.mjs`'s own pre-BUILD-3 tests
// construct a lens and inject it directly into `landAct` without ever
// routing it through `makeRelationReader` first (a real, valid, already-
// committed and passing shape — grammar-lens.js's own corpus was never
// wired into either real production `relationsFor` at the time those tests
// were written), and breaking that call shape would break real, passing
// tests for no gain: the two paths can never disagree, since both
// ultimately call the exact same `classifyConnector(e, { minShare })` on
// the exact same edge — this function just prefers the ALREADY-COMPUTED
// answer over recomputing it, and falls back to computing it live only
// when a backing edge was never tagged (relationsFor's own
// `classifyConnector` organ omitted, as it still is for both real
// production callers — see this file's own top-of-file AMENDED note).
// Threading the injected organ through to `makeRelationReader` instead,
// and dropping `landAct`'s own parameter entirely, was considered and
// rejected: it would force every caller of `landAct` that wants this check
// to also rebuild its OWN `relationsFor` with the lens wired in, a much
// larger change to make for a check that already has a working, tested,
// narrower call shape.
//
// Convicts a determined verdict of EITHER shape (`holds` OR `refused`),
// unlike `checkObjectSpecificity`'s holds-only scope: a garbled connector
// undermines a `refused` verdict exactly as much as a `holds` one — both
// still depend on the SAME connector word actually being the predicate
// the claim's subject/object are read against, and "the material
// explicitly disagrees" (checkObjectSpecificity's own stated reason for
// skipping `refused`) is not a reason to trust what the disagreement was
// ABOUT.
function checkConnectorClass(edges, judgedRefs, judgedVerb, classifyConnector, minShare) {
  const refSet = new Set(judgedRefs ?? []);
  if (!refSet.size) return { trusted: true, inconclusive: "no address to check against" };
  // A ref names a PASSAGE, and one passage backs every edge extracted from
  // it — checkObjectSpecificity's own ref-filter alone is exactly right
  // for asking "is there SOME backing edge whose object matches" (a
  // disjunction over sibling edges is the correct question there), but a
  // sibling edge sharing the same passage is a DIFFERENT claim's own
  // connector, not this claim's. Found live, writing this function's own
  // test: "Natasha noticed..." shares a ref with a neighboring "...always
  // spoke..." edge in the same chunk, and checking every ref-sharing edge
  // wrongly convicted "noticed" (a genuine verb) off "always" (not this
  // claim's own connector at all). Narrowed to the edge(s) whose OWN verb
  // is the claim's own verb — the same word judge() itself bound.
  const backing = (edges ?? []).filter(
    (e) => (e.refs ?? []).some((r) => refSet.has(r)) && (e.label ?? "").toLowerCase() === (judgedVerb ?? "").toLowerCase(),
  );
  if (!backing.length) return { trusted: true, inconclusive: "no edge found at the claim's own bound address with a matching connector" };
  // Checked here, not before `backing` is known — an edge tagged at
  // extraction time (hypergraph.js's own new `classifyConnector`/
  // `minShare` organ pair) means this function has real work to do even
  // when landAct's OWN direct-injection parameter is omitted, so "was
  // anything injected at all" can only be answered once both sources have
  // had their say.
  const tagged = backing.some((e) => e.connectorClass);
  if (!classifyConnector && !tagged) return { trusted: true, skipped: "no classifyConnector organ injected" };
  for (const e of backing) {
    // The extraction-time tag wins when present — see this function's own
    // header. Falls back to a live call only for an edge that was never
    // tagged (relationsFor built without the organ), preserving the exact
    // pre-BUILD-3 behavior for that case.
    const classification = e.connectorClass ?? classifyConnector(e, { minShare });
    if (classification.settled && classification.thraxClass !== "verb") {
      // `givers` rides here when the classification carries one (grammar-
      // lens.js's own BUILD-3 giver-forwarding fix) — `undefined` when it
      // doesn't (an untagged edge classified via the live fallback above,
      // built from a lens with no posPriorMeta/thraxMeta injected), which
      // JSON-drops cleanly rather than asserting a giver that was never
      // named.
      // grammar-lens.js's own classifyConnector reads edge.verb internally
      // (its own disclosed, deliberately-unrenamed contract — unaffected
      // either way, since both fields hold the same value); this disclosure
      // reads the neutral field, since e is hypergraph.js's own edge.
      return { trusted: false, surface: e.label, thraxClass: classification.thraxClass, givers: classification.givers };
    }
  }
  return { trusted: true };
}

/**
 * Parse `line` against `grid`, land it on `log`, and — only when it lands
 * as a `distinguish` or an `evaluate` whose `ground` clause names an
 * ALREADY-LOADED source (checked by key presence in `sources`, not
 * truthiness, so "nothing by that name is loaded" and "what's loaded
 * there is empty" stay the two different, correctly-typed facts term.js's
 * own comment already documented) — run the matching capacity for real
 * and attach what it found as a RESULT on the act's own entry.
 *
 * `distinguish` runs `cast` (referent identity), unchanged from before.
 *
 * `evaluate` — "EVA the hypergraph, with provenance" — runs ONLY when the
 * act carries no human-DECLARED `verdict:` clause (grid.js's own parse
 * already lets `verdict:` be omitted; this is what fills that gap in
 * rather than leaving it permanently open). The act's `object` is read as
 * the claim itself (grid.js's grammar already allows a quoted, full-
 * sentence object) and judged against the named ground's real text via
 * `runCapacity("relations", {claim})` — hypergraph.js's own judge(), the
 * SAME check an ordinary chat answer is graded against. Only two of
 * judge()'s five verdicts are strong enough to COMPUTE a holds/refused:
 * `bound` -> holds, `contradicted` -> refused. The other three (unbound,
 * beyond-reach, unheard) and `competing` all mean "the material does not
 * settle this," never "the material says no," and are left undetermined —
 * `foldGrid`'s existing DEF/EVA companion read already renders this
 * honestly as "wish, no verdict declared yet."
 *
 * A determined verdict is then SQUARED (see squarePolarity above) before
 * it ships: the claim's own negation is checked the same mechanical way,
 * and only a genuine disagreement between the two readings earns the
 * verdict enough trust to attach as holds/refused. An unconfirmed reading
 * downgrades to undetermined rather than shipping a wrong confident
 * answer — real, disclosed evidence (which candidates were tried, what
 * each computed) rides on the RESULT either way, never silently dropped.
 *
 * REC — "revise understanding as needed": before a squared-and-trusted
 * verdict lands, the live fold is checked for an EARLIER evaluate of the
 * SAME object (case-folded) already carrying a determined verdict. If the
 * new computation disagrees, `grid.concedeEvaluation` lands an
 * EVIDENCE·REC·Figure·produced entry FIRST — `concedes` naming the prior
 * act, `trigger` stating the verbatim disagreement — mirroring
 * `build-log.js`'s `rezeroBuild` shape exactly. Only then does the new
 * verdict attach. Re-confirming the same verdict lands no REC.
 *
 * Returns `{ ok: false, refusal }` on a parse/grammar refusal (nothing
 * lands, `log` is untouched), or `{ ok: true, log, ids, event, capacity }`
 * where `capacity` is `null` when no capacity was triggered (an ordinary
 * act, a `verdict:`-declared evaluate, or a `ground` candidate naming
 * nothing loaded — deliberately silent either way, matching the disclosed
 * rule above), or `{ result }` when one was: `result.gap === "no_material"`
 * on real-but-empty material (nothing attached), otherwise the real
 * capacity output found — attached either way, whether or not a verdict
 * was strong and squared-trustworthy enough to compute.
 *
 * Callers own ALL formatting/recording — this function only computes what
 * landed and what (if anything) ran; it never touches a DOM, a chat
 * message, or the durable record itself.
 */
export function landAct(grid, log, line, { sources = {}, runCapacity, classifyConnector, minShare, claimId } = {}) {
  const parsed = grid.parseAct(line, { log });
  if (!parsed.ok) return { ok: false, refusal: parsed.refusal };
  // Per-Source Testimony spec, BUILD-0: mint the id BEFORE this call
  // (`await grid.mintClaimId(...)`, necessarily async — Web Crypto has no
  // sync digest) and pass it here; `land()` threads `event.claim_id`
  // through to the log exactly like `warrant`/`because` already are. Omit
  // it and this event lands byte-identical to every call before this pass.
  const event = claimId ? { ...parsed.event, claim_id: claimId } : parsed.event;
  const { log: landedLog, ids } = grid.land(log, event);
  let finalLog = landedLog;
  let capacity = null;
  if (parsed.event.verb === "distinguish" && parsed.event.ground && runCapacity && Object.hasOwn(sources, parsed.event.ground)) {
    const result = runCapacity("cast", { text: sources[parsed.event.ground], name: parsed.event.ground });
    if (result.gap !== "no_material") {
      const insId = ids[ids.length - 1];
      const attached = grid.attachResult(finalLog, insId, result);
      if (attached.ok) finalLog = attached.log;
    }
    capacity = { result };
  }
  if (
    parsed.event.verb === "evaluate" &&
    parsed.event.ground &&
    parsed.event.object &&
    !parsed.event.verdict &&
    runCapacity &&
    Object.hasOwn(sources, parsed.event.ground)
  ) {
    const groundText = sources[parsed.event.ground];
    const groundName = parsed.event.ground;
    const result = runCapacity("relations", { text: groundText, name: groundName, claim: parsed.event.object });
    if (result.gap !== "no_material") {
      const evaId = ids[ids.length - 1];
      const judged = (result.claims ?? [])[0] ?? null;
      const rawVerdict = collapseVerdict(judged);
      let squaring = null;
      let connectorCheck = null;
      let objectCheck = null;
      let computedVerdict = null;
      if (rawVerdict) {
        squaring = squarePolarity(runCapacity, groundText, groundName, parsed.event.object, rawVerdict);
        computedVerdict = squaring.trusted ? rawVerdict : null;
        // Connector class — see checkConnectorClass's own header. Checked
        // for EITHER determined shape (unlike the object-specificity check
        // just below, which is holds-only by its own stated reason): a
        // garbled connector undermines a refused verdict exactly as much
        // as a holds one. A no-op (`trusted: true, skipped: ...`) when no
        // `classifyConnector` organ was injected — every pre-existing
        // caller's behavior is unchanged.
        if (computedVerdict) {
          connectorCheck = checkConnectorClass(result.edges, judged?.refs, judged?.label, classifyConnector, minShare);
          if (!connectorCheck.trusted) computedVerdict = null;
        }
        // Squaring confirms POLARITY only — a "holds" that passed squaring
        // can still be a wrong number/office wearing a real edge's other
        // words (see checkObjectSpecificity's own header). Checked only
        // for `holds`: a `refused` verdict already means the material
        // explicitly disagrees, which is a different, already-decided case.
        if (computedVerdict === "holds") {
          objectCheck = checkObjectSpecificity(result.edges, judged?.refs, judged?.end2);
          if (!objectCheck.trusted) computedVerdict = null;
        }
      }
      const objectKey = (parsed.event.object ?? "").toLowerCase();
      if (computedVerdict) {
        const priorDetermined = grid
          .foldGrid(finalLog)
          .acts.filter(
            (t) =>
              t.operator === "EVA" &&
              t.task_id !== evaId &&
              (t.object ?? "").toLowerCase() === objectKey &&
              (t.verdict === "holds" || t.verdict === "refused"),
          )
          .sort((a, b) => b.first_seq - a.first_seq)[0];
        if (priorDetermined && priorDetermined.verdict !== computedVerdict) {
          const conceded = grid.concedeEvaluation(finalLog, priorDetermined.task_id, {
            trigger: `re-checked against "${groundName}": was "${priorDetermined.verdict}", now computes "${computedVerdict}"`,
          });
          if (conceded.ok) finalLog = conceded.log;
        }
      }
      // Every computed belief names who is believing it, not just what is
      // believed (experiencer.js, user direction: "everything isn't just
      // given by a source it is believed BY an experiencer") — this organ,
      // reading this exact named ground, is the experiencer of this
      // specific verdict; a different reader over the same claim (a web
      // fetch, a witness model, a human) would be a DIFFERENT experiencer
      // and must never be silently merged into this one's belief.
      const attached = grid.attachResult(
        finalLog,
        evaId,
        withExperiencer(
          { claim: parsed.event.object, judged, source: groundName, rawVerdict, squaring, connectorCheck, objectCheck },
          { who: "the-fold:hypergraph.js:judge()", read: groundName },
        ),
        // `claim_id` rides here on the SAME `extra` this call already had
        // (`verdict`, when computed) — task-log.js's own documented merge
        // rule (attachResult's own doc comment) puts it on the projected
        // task next to `domain`/`grain`/`warrant`, which that task's own
        // PROPOSE entry already carries. No second mechanism needed for
        // this (see mintClaimId's own header for the one that was tried
        // and deleted the same day). Omitted when the caller never
        // supplied one — byte-identical to every call before this pass.
        { ...(computedVerdict ? { verdict: computedVerdict } : {}), ...(claimId ? { claim_id: claimId } : {}) },
      );
      if (attached.ok) finalLog = attached.log;
    }
    capacity = { result };
  }
  return { ok: true, log: finalLog, ids, event, capacity };
}

/**
 * BUILD-1 of the Per-Source Testimony spec (POLICIES.md §2) — the
 * Testimony record, one per source, un-collapsed. Named `perSourceReadings`
 * here rather than `Testimony`/`testimonies`: this repo already has a
 * `testimony.js` (P32's witness tier — a model handed one claim and one
 * page's bytes, answering a binary "does the passage say this" question
 * twice). That is a different concept — a WITNESS reading and speaking —
 * from what this function returns, which is never a model call: it is a
 * plain, pure PROJECTION of what `landAct`'s evaluate branch and BUILD-0's
 * claim_id already landed. Reusing the word here would be the "fold"
 * collision (CLAUDE.md's own UX-pass section) happening again with a
 * different word.
 *
 * Deliberately NOT a second computation. Every field below is read out of
 * a RESULT entry `attachResult` already produced — `hypergraph.js::judge()`
 * already computes `corroboration`, `polarity`, and `grammar` directly on
 * the claim object; `checkConnectorClass` already computes the connector
 * classification; `withExperiencer` already stamps who/read/revision.
 * Nothing here calls a model or re-derives a verdict.
 *
 * SECOND disclosed deviation: the spec's own §2 sketch types
 * `corroboration` as a bare `int`. `judge()`'s REAL corroboration is
 * `{passages, sources}` — distinct sources counted apart from raw passage
 * count, on purpose ("two chunks of one file are one perspective," this
 * repo's own P12/P29 discipline). Collapsing that to one int would throw
 * away a real, already-computed distinction the spec's own sketch simply
 * hadn't seen yet; this function keeps the richer shape rather than
 * force-fitting the spec's placeholder type.
 *
 * ONE DISCLOSED MISMATCH, not silently papered over: the spec's own §2
 * text defines `who` as the SOURCE (nyt, wikipedia@revid) and `read` as
 * WHICH PASSAGE of that source. `withExperiencer`'s existing, already-
 * shipped convention (capacity-runner.js's evaluate branch, above) uses
 * `who` for the MECHANISM that computed the belief ("the-fold:hypergraph.
 * js:judge()") and `read` for the SOURCE/ground text ("hannibal-hamlin.
 * txt"). These are not the same two questions, and this function does not
 * rename experiencer.js's own fields to paper over the difference —
 * `experiencer.js` keeps its existing, already-tested meaning. Instead:
 * spec-`who` is read from `experiencer.read` (the source), spec-`read` is
 * read from `judged.refs` (the actual passage addresses `judge()` cites —
 * finer-grained than the whole source), and the MECHANISM identity lands
 * on `emitted_by`, the spec's own named slot for exactly this. Changing
 * `experiencer.js`'s own field names is a real, separate, disclosed
 * decision — not attempted here.
 *
 * Returns one record per RESULT-kind cell for this claim_id — "N sources
 * → N testimonies" (the spec's own BUILD-1 set-down criterion) falls out
 * directly, since `landAct` lands one RESULT per evaluate call, and a
 * caller checking N different grounds against the SAME claim_id produces
 * N such RESULT cells.
 */
/**
 * speakerWho(who, refs, speakerAt) — the speaker boundary consumed
 * (speaker.js, Tier 4 #11): a reading's `who` is the SOURCE being read,
 * and when that source declares its speakers by section, the reading's
 * own address says which one spoke. A journal's "I" becomes a WITNESS WITH
 * A NAME — `dracula.txt:Dr. Seward` rather than `dracula.txt` — so the
 * crown attributes a section's claims to the narrator, and two narrators
 * of one book are two voices rather than one source (distinctSources
 * keeps them apart by the `:` the same way it keeps `testimony:` apart).
 * Optional and additive: no speakerAt, or no speaker at that offset (front
 * matter, a speakerless log), leaves `who` exactly as it was — a typed
 * absence, never a nearest-guess (speaker.js's own rule).
 */
export function speakerWho(who, refs, speakerAt) {
  if (typeof speakerAt !== "function" || !who || !Array.isArray(refs) || !refs.length) return who;
  const m = String(refs[0]).match(/^(.+?)#(\d+)-\d+$/);
  if (!m) return who;
  const speaker = speakerAt(m[1], Number(m[2]));
  return speaker ? `${who}:${speaker}` : who;
}

export function perSourceReadings(grid, log, claimId, { speakerAt = null } = {}) {
  const { cells } = grid.foldClaim(log, claimId);
  return cells
    .filter((c) => c.kind === "result")
    .map((c) => {
      const r = c.result ?? {};
      const experiencer = r.experiencer ?? {};
      const judged = r.judged ?? null;
      return {
        claim_id: claimId,
        who: speakerWho(experiencer.read ?? null, judged?.refs ?? [], speakerAt),
        read: judged?.refs ?? [],
        revision: experiencer.revision ?? null,
        verdict: c.verdict ?? "undetermined",
        polarity: judged?.polarity ?? null,
        // Read off judged's neutral arrangement (P72); crown.js's own render
        // functions still destructure subject/verb/object as THEIR field
        // contract (crown.js:376), so the destination keys stay as they are.
        edges: judged?.refs ? [{ subject: judged.end1, verb: judged.label, object: judged.end2, refs: judged.refs }] : [],
        grammar: r.connectorCheck ? [r.connectorCheck] : [],
        // null (not {passages:0,sources:0}) when undetermined — judge()
        // never runs corroboration() for an unbound/beyond-reach verdict,
        // so "zero" would claim a computation that never happened.
        corroboration: judged?.corroboration ?? null,
        emitted_by: experiencer.who ?? null,
      };
    });
}

/**
 * BUILD-2 of the Per-Source Testimony spec (POLICIES.md §3) — the merge
 * instrument. A PURE function over `perSourceReadings`' own output: no
 * model call, no new log-landing, no re-running `squarePolarity` (that
 * already ran ONCE per source, inside each reading's own EVA computation —
 * this function only compares the verdicts those computations already
 * reached; "opposed polarity... this is squarePolarity firing across
 * sources" in the spec's own prose is read here as an ANALOGY explaining
 * why cross-source disagreement matters, not a second call to make).
 *
 * The spec names exactly four cases — AGREE (>=2 holds), DISAGREE (some
 * hold, some refuse), SINGLE (exactly one holds, none refuse), UNDETERMINED
 * (nothing holds or refuses). ONE DISCLOSED GAP in the spec's own
 * enumeration, found while implementing rather than argued about: it never
 * names the symmetric case of AGREE — every determining source REFUSES
 * (unanimous contradiction), none holds. That is a real, confident,
 * un-covered outcome, not the same as UNDETERMINED (silence) or DISAGREE
 * (split). Named here as a fifth case, `contradicted`, reusing the exact
 * word hypergraph.js's own per-edge vocabulary already has for this — not
 * a new term.
 *
 * AMENDED (BUILD-4, direct user instruction) — a self-witness never
 * co-signs AGREE's corroboration alone. The reframe this responds to,
 * verbatim: "The model CAN say things that are 'ungrounded,' but really
 * it's just grounded in itself" — a model's bare, unprompted assertion
 * (nothing attached, nothing fetched) is not a special "ungrounded"
 * exception living outside this Testimony system; it is TESTIMONY FROM A
 * WITNESS whose read is its own weights rather than a source's bytes, and
 * belongs in `holds`/`refused` exactly like any other reading — never
 * hidden, never a second bucket. `SELF_WITNESS` ("self:model") is that
 * witness's declared name on the `who` field `perSourceReadings` already
 * carries (spec-`who` = the SOURCE being read — see BUILD-1's own header —
 * and for this witness the source being read is the model's own head).
 * Reuses this app's existing `self:` namespace rather than inventing one
 * (`reflex.js::SELF_SOURCE = "self:ledger"`, the self-plane's own
 * precedent — P15).
 *
 * But a self-witness is not an INDEPENDENT read of anything, so letting it
 * co-sign corroboration would silently manufacture standing that was never
 * earned — the same failure shape P30 already names for a name echoed back
 * from the system prompt, one degree further degenerate (a self-witness
 * has even less independence than that: it isn't reading anything at all).
 * `countableHolds` excludes self-witnesses from the AGREE threshold only;
 * DISAGREE's own condition is untouched and reads the raw `holds`/`refused`
 * arrays exactly as before — a self-witness's claim genuinely opposed by a
 * real source's refusal (the Seward failure's own shape: the mouth asserts,
 * the material disagrees) IS a real disagreement worth surfacing, and
 * mechanically resolving it toward CONTRADICTED would smuggle in the exact
 * source-trust judgment call this ladder exists to avoid making by hand
 * (P2: the model is the mouth, protocols are physics). DISAGREE's crown
 * render (crown.js) names every witness verbatim, self-witnesses included —
 * a reader who sees "self:model says yes; wikipedia.txt says no" can tell
 * which is which because the label itself says so, not because this
 * function silently picked a winner.
 *
 * Backward compatible by construction: byte-identical output whenever no
 * reading's `who` sits in the reserved `self:` namespace — `countableHolds`
 * then always equals `holds`, and every existing case boundary is
 * unchanged. (Generalized 2026-09-01 from the single name `self:model` to
 * the structural property it always stood for — a hold that read nothing;
 * see `readsNothing` below, including the namespace generalization that
 * was tried first and refuted.)
 */
export const SELF_WITNESS = "self:model";

export function isSelfWitness(reading) {
  return reading?.who === SELF_WITNESS;
}

/**
 * THE STRUCTURAL FORM of the exclusion (floor 4½'s wall, 2026-09-01) — and
 * a refuted generalization kept here so it is not retried.
 *
 * REFUTED FIRST: widening `isSelfWitness` from the name `self:model` to the
 * whole reserved `self:` namespace. An existing pin refused it with a real
 * reason, and the pin is right: `self:ledger` (reflex.js's SELF_SOURCE,
 * P15) READS ADDRESSED BYTES — the reflex ledger is chunked with
 * self-verifying offsets and cited as `self:ledger#a-b` — so it is a
 * genuine source read. `self:model` reads nothing at all. The namespace
 * does not carve at the joint; what does is whether the reading READ
 * anything.
 *
 * So the general rule is structural, visible in the readings themselves:
 * a reading whose `read` is empty asserted rather than read. That is
 * exactly `nesting.js`'s wall in testimony's vocabulary — an unaddressed
 * hold is an OUTER note ("this voice asserts X"), and outer notes never
 * corroborate the inner claim. It subsumes the named case (`self:model`
 * always carries `read: []`) and correctly admits `self:ledger` readings,
 * which carry real addresses.
 *
 * Safe in both readings: a `holds` carrying no address is either a
 * self-assertion (correctly excluded) or an unaddressed claim of support
 * (which should never have counted either — P5.2's own discipline).
 */
export function readsNothing(reading) {
  return !(Array.isArray(reading?.read) && reading.read.length > 0);
}

export function mergeTestimony(readings) {
  const holds = readings.filter((r) => r.verdict === "holds");
  const refused = readings.filter((r) => r.verdict === "refused");
  const undetermined = readings.filter((r) => r.verdict === "undetermined");
  // Real corroboration only — see this function's own AMENDED note above.
  // Real corroboration only: a hold that READ nothing asserted rather than
  // read (floor 4½'s wall — an unaddressed hold is an outer note). This
  // subsumes the named `self:model` case and, unlike a namespace match,
  // correctly counts a `self:ledger` reading, which carries real addresses.
  const countableHolds = holds.filter((r) => !readsNothing(r));

  if (holds.length && refused.length) {
    return { case: "DISAGREE", verdict: "multiply-bound", standing: null, holds, refused, undetermined };
  }
  if (countableHolds.length >= 2) {
    return { case: "AGREE", verdict: "bound", standing: "corroborated", holds, refused, undetermined };
  }
  if (holds.length) {
    // Exactly one real hold, OR one-or-more self-witness holds with no
    // real corroboration behind them either way — neither shape earns
    // `corroborated` standing, so both land here, disclosed as-is (the
    // full `holds` array, self-witnesses included) rather than as a
    // manufactured AGREE.
    return { case: "SINGLE", verdict: "bound", standing: "single", holds, refused, undetermined };
  }
  if (refused.length) {
    // the disclosed fifth case, symmetric to AGREE but never named in the
    // spec's own four — see this function's own header.
    return { case: "CONTRADICTED", verdict: "contradicted", standing: refused.length >= 2 ? "corroborated" : "single", holds, refused, undetermined };
  }
  return { case: "UNDETERMINED", verdict: "unbound", standing: null, holds, refused, undetermined };
}

/**
 * landContest(notesLog, door, merged, { textAt }) — THE WIRE.
 *
 * `mergeTestimony` has always produced a typed DISAGREE naming `holds` and
 * `refused`, and — audited 2026-09-04 — it is called from exactly one eval
 * driver and one registry string. Nothing landed it. That is the third
 * organ in this engine found producing a typed finding no caller writes
 * down (the concession cascade before P88; corroboration.js's `contests`
 * before it), and P57's whole law is the answer: a finding read from the
 * world is ADMITTED and projected, never re-derived per turn and discarded.
 *
 * WHY THIS IS THE RIGHT INPUT, and a string comparison was not. These
 * readings are verdicts on ONE claim_id. Same claim, same arrangement, same
 * polarity question, judged separately per source. So the disagreement is
 * `contest` in P88's taxonomy BY CONSTRUCTION — individuation and grain are
 * excluded because it is one claim, force because it is one claim — and the
 * kind is EARNED by the claim-id spine rather than guessed. A detector that
 * compares subject/verb/object strings across sources cannot earn that, and
 * measured, does not: P11 forbids the string comparison outright, and P90
 * records the run that made it anyway.
 *
 * FOUR WALLS, each a typed refusal rather than a silent skip:
 *
 *   self-witness      A `self:model` reading may NEVER dispute. The model
 *                     refusing the material is not a source disagreeing; it
 *                     is the mouth convicting the record, which P2 forbids.
 *                     mergeTestimony already refuses to let a self-witness
 *                     co-sign corroboration alone (BUILD-4); this is that
 *                     wall pointed the other way, and it is the more
 *                     dangerous direction.
 *   read nothing      An unaddressed refusal is an assertion, not a reading
 *                     (floor 4½'s wall, the same `readsNothing` mergeTestimony
 *                     applies to holds).
 *   no bytes          The decider is the SOURCE'S OWN BYTES at the address
 *                     it read (P17: a quotation is the source's bytes or it
 *                     is not printed as one). `textAt` is injected; no text
 *                     for the address means no dispute, never a bare vote —
 *                     which `dispute` itself would refuse anyway.
 *   not a contest     AGREE / SINGLE / UNDETERMINED land nothing. Only a
 *                     split (DISAGREE) or a unanimous refusal (CONTRADICTED)
 *                     is a disagreement to record.
 *
 * AND IT NEVER CONVICTS. CONTRADICTED — every determining source refuses,
 * none holds — is the settled case, and this function still only DISPUTES
 * it, reporting `unanimous: true` so a caller holding that authority can
 * decide about conceding. `mergeTestimony`'s own header refuses to resolve
 * DISAGREE mechanically toward CONTRADICTED because that "would smuggle in"
 * a conviction; landing a concession here would smuggle in the same one,
 * one register down.
 *
 * Diagnostic and act stay apart: `mergeTestimony` is untouched and still
 * writes nothing.
 */
export function landContest(notesLog, door, merged, { textAt } = {}) {
  const refusals = { self_witness: 0, read_nothing: 0, no_bytes: 0, not_a_contest: 0 };
  const landed = [];
  if (typeof textAt !== "function")
    throw new TypeError("landContest: textAt is injected — the decider is the source's own bytes at the address it read (P17), never a paraphrase this function invents");
  if (!merged || (merged.case !== "DISAGREE" && merged.case !== "CONTRADICTED")) {
    refusals.not_a_contest += 1;
    return { log: notesLog, landed, refusals, unanimous: false, case: merged?.case ?? null };
  }
  let next = notesLog;
  for (const reading of merged.refused ?? []) {
    if (isSelfWitness(reading)) { refusals.self_witness += 1; continue; }
    if (readsNothing(reading)) { refusals.read_nothing += 1; continue; }
    const edge = reading.edges?.[0];
    const at = reading.read?.[0];
    const text = at ? textAt(at) : null;
    if (!edge || !at || !text) { refusals.no_bytes += 1; continue; }
    const ref = String(at).split("#")[0];
    const r = door.dispute(next, door.assertionId(edge.subject, edge.verb, edge.object), {
      // `who` may carry a speaker (`source:speaker`, speakerWho above); the
      // SOURCE is what independence is counted in, so the ref is what rides.
      source: ref,
      because: text,
      span: { at, ref, text },
      kind: door.DISPUTE_KINDS.CONTEST,
    });
    if (r.refused) { refusals[r.refused.type] = (refusals[r.refused.type] ?? 0) + 1; continue; }
    next = r.log;
    if (!r.noop) landed.push({ claim_id: reading.claim_id, source: ref, at, disputeId: r.id });
  }
  return { log: next, landed, refusals, unanimous: merged.case === "CONTRADICTED", case: merged.case };
}

/**
 * The Per-Source Testimony spec's own remaining named gap (CLAUDE.md's
 * claim-id-spine section, closing paragraph, verbatim): "the model's own
 * bare, unprompted assertion entering as its OWN witness (`who:
 * self:model`) rather than an exceptional 'ungrounded' case exempted from
 * the Testimony system entirely." `mergeTestimony`'s AMENDED doc comment
 * above already treats a self:model reading as ordinary testimony data —
 * this is the missing OTHER half: actually minting the claim_id and
 * landing one, for a caller that has nothing else to check the assertion
 * against.
 *
 * Deliberately NOT `landAct`'s `evaluate` branch. `evaluate`'s own grammar
 * refuses at PARSE TIME without a named `ground … broken:<perturbation>`
 * (grid.js: "`evaluate` checks a claim against a ground that must be
 * constructed") — correctly, for a real check. A self-assertion has no
 * ground BY DEFINITION (that absence is the whole reason it is a
 * self-witness and not a material one), so it cannot honestly claim that
 * verb. `define` is grid.js's own documented, deliberate exception — "no
 * refusal fires at parse for a missing companion evaluate," because
 * defining is the act of PUTTING FORWARD a claim, not checking one, which
 * is the correct EO-typing for an assertion with nothing behind it but the
 * asserter. This function lands a DEF act (through `grid.parseAct`/
 * `grid.land`, unchanged — the same `at Field from generate` terrain and
 * stance CLAUDE.md's own worked `define` example already uses, not a
 * fresh convention invented here) and attaches a RESULT to it directly —
 * never touching `evaluate`, `runCapacity`, or any material check.
 *
 * The attached RESULT is shaped to be indistinguishable, field for field,
 * from what `perSourceReadings` already knows how to project — proven by
 * this file's own test, which runs this function for real and compares
 * its output against capacity-runner.test.mjs's pre-existing hand-built
 * `selfModelReading()` fixture. `perSourceReadings` and `mergeTestimony`
 * both needed ZERO further changes for this: the AMENDED doc comment above
 * already treats `who === SELF_WITNESS` as ordinary data on an ordinary
 * RESULT cell, not a case requiring its own lookup path.
 *
 * `claimId` is REQUIRED here (`landAct`'s is optional) — a self-assertion
 * landed with no claim_id can never be found by `foldClaim`/
 * `perSourceReadings` at all, so landing one without a claim_id would be a
 * real act nothing downstream of this spine could ever see. Mint it first
 * (`await grid.mintClaimId({subject, verb, object})`, the same triple,
 * necessarily async — Web Crypto has no sync digest) and pass it in,
 * exactly like `landAct`'s own caller-mints-first convention.
 *
 * NOT WIRED TO ANY REAL CALLER — see POLICIES.md P39's amendment for why
 * (app.js/holon.js's own multi-session ownership boundary, already stated
 * twice in CLAUDE.md's Explore section) and self-witness-integration-
 * note.md, this file's own sibling to chip-coverage-note.md, for exactly
 * what the owning session's call site needs to do.
 */
export function landSelfAssertion(grid, log, { subject, verb, object, verdict, claimId } = {}) {
  if (!subject || !verb || !object) {
    return { ok: false, refusal: { type: "no_claim", detail: "a self-assertion is a claim about something — subject, verb, and object are all required, the same triple mintClaimId keys on" } };
  }
  if (verdict !== "holds" && verdict !== "refused" && verdict !== "undetermined") {
    return { ok: false, refusal: { type: "unknown_verdict", stated: verdict, detail: 'verdict must be "holds", "refused", or "undetermined" — the same three states perSourceReadings already recognizes' } };
  }
  if (!claimId) {
    return { ok: false, refusal: { type: "no_claim_id", detail: "a self-assertion with no claim_id can never be found by foldClaim/perSourceReadings — mint one first (grid.mintClaimId) and pass it here" } };
  }
  const claimText = `${subject} ${verb} ${object}`;
  const parsed = grid.parseAct(`define ${claimText} at Field from generate`, { log });
  if (!parsed.ok) return { ok: false, refusal: parsed.refusal };
  const event = { ...parsed.event, claim_id: claimId };
  const { log: landedLog, ids } = grid.land(log, event);
  const defId = ids[ids.length - 1];
  // undetermined carries no edge at all — matching perSourceReadings' own
  // read of a null `judged` (see its header: edges/polarity/corroboration
  // all fall back to their disclosed-absent defaults together, never a
  // partial object that would claim a polarity nobody computed).
  const judged =
    verdict === "undetermined"
      ? null
      : {
          subject, verb, object,
          // The neutral arrangement (P76), stamped by this producer exactly
          // as hypergraph.js's own claims carry it — perSourceReadings reads
          // end1/label/end2 off `judged` since the arrangement migration,
          // and this is the one judged-payload producer outside that reader.
          end1: subject, label: verb, end2: object,
          refs: [], polarity: verdict === "holds" ? "+" : "-", corroboration: { passages: 0, sources: 0 } };
  const attached = grid.attachResult(
    landedLog,
    defId,
    withExperiencer({ judged }, { who: "the-fold:app.js:selfAssertion", read: SELF_WITNESS }),
    { verdict, claim_id: claimId },
  );
  if (!attached.ok) return attached;
  return { ok: true, log: attached.log, ids, event };
}
