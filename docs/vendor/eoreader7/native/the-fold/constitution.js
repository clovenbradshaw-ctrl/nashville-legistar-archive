// constitution.js — the constitution's channel into the running app. Pure.
//
// The constitution (FOLD-CONSTITUTION.md, one level up) governs the workbench.
// It cannot be "followed" by the model, and the document itself says why:
// II.9 — a prompt is a request, not a guarantee — and Article III's framing
// that telling a person to be careful is the same category error as telling a
// model to be careful. So the constitution reaches the conversation on two
// channels, and only one of them goes through the model:
//
//   1. THE FOLD OF IT (below): one bounded paragraph, prose, carried in the
//      system message every turn. It contains only what a mouth can honor in
//      language — say it plainly, cite what you were handed, name the gap —
//      and not one article the model would have to be trusted to enforce.
//      It is a fold in this repo's sense: a lossless drop in resolution of
//      the articles that address speech, with the full document as its
//      descent. It is a REQUEST. Nothing downstream relies on it.
//
//   2. THE ENFORCEMENT MAP (below): which article binds which organ, in code,
//      where reliance actually lives. This is the alignment claim made
//      checkable — constitution.test.mjs walks this table and probes each
//      row's behavior, so "the app follows its constitution" is a test run,
//      not an assertion. An article no organ enforces is listed with
//      enforced: null, because unwired-is-failing (VI.3) only works if
//      unwired is VISIBLE.

/**
 * The folded instruction block. Replaces the old BASE_PROMPT — same duty,
 * now derived from the constitution's speech-facing articles rather than
 * written freehand. Prose, one paragraph, no scaffolding: what goes in front
 * of a small model shapes what comes out of it, and bracket-tagged rule
 * lists come back out as bracket-tagged rule recitals.
 */
export const CONSTITUTION_PROMPT =
  // Amended 2026-08-17, by user direction: the mouth PROPOSES, the
  // instrument checks. The old block told the model never to supply a
  // value the material had not given — which left a compliance-critical
  // behavior to instruction-following, the exact thing L5 distrusts, and
  // measured live it half-worked: the model withheld answers it knew
  // ("The passage does not provide information about the mayor") on the
  // same day it invented mayors under headings. The mechanical ladder is
  // the real wall in both directions — attribute() marks the model's own
  // voice, checkGrounding flags what nothing backs, proof-seeking takes it
  // to the web — so the prompt now asks for the model's honest answer and
  // leaves the epistemics to the organs that actually enforce them.
  //
  // Amended 2026-08-17: code the model writes as a fold runs in a real
  // sandbox (term.js), and a small model asked for runnable code without
  // being told what that sandbox actually has invents a plausible-sounding
  // one instead — measured live, qwen2.5:14b asked for a bouncing ball
  // wrote "from fold import *" and "import pygame", neither of which
  // exist. This is not asked to behave a way it might not — it is told
  // what is actually installed, the same category as being told what
  // material it was handed.
  //
  // Amended same day: numpy/matplotlib/pandas landed as vendored packages
  // (scripts/fetch-pyodide-packages.sh, loaded at worker boot — see
  // term-py-worker.mjs), so the first version of this clause ("no pygame
  // or other third-party packages") went stale the day it was written.
  // Named here rather than left implicit, so the next package added is a
  // one-line amendment, not a rediscovery.
  //
  // Amended 2026-08-19, by user direction: "the model should not know it's
  // being fact checked." Two clauses told the model it was being watched —
  // "the instrument marks what stands on the material and checks the rest,
  // so an honest answer helps and a dressed-up one is caught" and "checking
  // is not your job, and the instrument attaches its own results" — and
  // neither did any enforcement work: checkGrounding/attribute/checkCitations
  // run identically whether or not the model has been told about them (L5's
  // own rule, applied to the prompt's own text this time, not just to the
  // model's behavior). The "caught" framing is dead weight in the prompt at
  // best; at worst it primes a model to reason about evading a check it
  // does not need to know exists. The one clause with real behavioral
  // content — do not self-claim verification you did not perform — is kept,
  // stripped of the explanation of why.
  "You are the mouth of a careful instrument, not its memory and not its judge. " +
  "Runnable Python code executes in a browser sandbox with the standard library plus numpy, matplotlib, and pandas — no pip, no network, nothing else installed; runnable JavaScript has no npm install either. " +
  "Answer the question you were asked, in plain prose. When material is supplied, answer from it first and cite each address in square brackets exactly as it appears. " +
  "Where the material is silent, note the gap in passing and still answer from your own knowledge, plainly — but never attach an address to what the material did not give you. When you have already answered and the person says the answer is going nowhere, the honest act is to stop, say you cannot help further, and point to the human/operator path rather than repeat yourself — this is not the silence case, it is the repeated-failure case. " +
  "Prefer counts to percentages when the material gives you counts. " +
  "The past-discourse block is paraphrase and cannot support a factual claim; only the record block carries addresses. " +
  "Do not claim that anything was checked, measured, or verified — state only what you were given or what you know, plainly. " +
  "When you are asked to write, build, or revise something durable — code, a table, an html or svg document — write it out in full inside a fenced block, in plain prose around it as usual: the app snips that block out and deposits it as a fold, this instrument's own name for what you may know elsewhere as an artifact, an append-only, addressable, downloadable object with its own revision history, never retyped in full again.";

/**
 * Article → organ. `holds` names the function(s) that enforce the article
 * mechanically; `where` names the file. `enforced: null` marks an article
 * this app does not yet wire, kept in the table so the omission stays
 * visible (VI.3) instead of quietly implied as compliance.
 */
export const ENFORCEMENT = [
  {
    article: "II.3 descent — every altitude reaches the rows",
    holds: "readRange; every ref is a byte range that re-opens from the source",
    where: "source.js",
    enforced: true,
  },
  {
    article: "II.5 firewall — the result may not tune the instrument",
    holds: "normalizeSummary carries prior records through untouched, whatever the refresh returns",
    where: "fold.js",
    enforced: true,
  },
  {
    article: "II.9 mouth — no model-authored value ships unchecked",
    holds: "checkGrounding (figures/names vs bytes); attribute (null-gated); checkCitations (addresses vs offered); tables.js computes state answers instead of asking",
    where: "organs/grounding.js, organs/cite.js, source.js, tables.js",
    enforced: true,
  },
  {
    article: "II.11 earned constants — a number names its giver or its run",
    holds: "partially: retrieval has no floor by design; ROWS_PER_CHUNK, NULL_SAMPLES, CORPUS_MINIMUM, MAX_FINDINGS are hand-picked and documented as open debt",
    where: "CLAUDE.md (open debt)",
    enforced: "partial",
  },
  {
    article: "II.13 local — the computation runs on the machine that has the data",
    // Downgraded to partial 2026-10-05, by the assay: the row named app.js,
    // which is not in this repo. The loopback posture holds here (the proxy
    // and heimdall bind 127.0.0.1), but the page-level non-local-host scan
    // this article names lives in the chat app's own assay, not in khora —
    // a cross-repo claim, disclosed as partial rather than asserted as wired.
    holds: "khora's only model path is the loopback-bound proxy/heimdall; the page-level non-local-host scan lives in the chat app's assay, not this repo",
    where: null,
    enforced: "partial",
  },
  {
    article: "III.3 absent — the missing thing is on screen",
    holds: "openQuestions types every gap; records render 'left open' lines; a part that produces no text says so in place",
    where: "source.js, holon.js",
    enforced: true,
  },
  {
    article: "IV.1 derive vs receive — the model never retrieves on its own",
    holds: "retrieve() is term overlap on the question's words; the model has no tools. Known deviation: a holonic part retrieves on plan words, disclosed as a typed gap when the part strays from the task's vocabulary",
    where: "source.js, holon.js",
    enforced: "partial",
  },
  {
    article: "IV.3 a missing prior is a typed gap, never a silently wrong number",
    holds: "openQuestions; runPart's typed open list; parsePlan degradation is itself a typed gap",
    where: "source.js, holon.js",
    enforced: true,
  },
  {
    article: "IV.4 shown is typed, never blocked — measured and shown never render alike",
    holds: "provenance.js classifies every sentence onto material or model ground from checks already run; the renderer draws model-ground dotted, absent-claim sentences striped, material plain with its address",
    where: "organs/provenance.js",
    enforced: true,
  },
  {
    article: "IV.5 the register is the reader's; paraphrase never gains authority",
    holds: "System 1 and System 2 blocks are never merged; the paraphrase block carries its own disclaimer in the prompt",
    where: "fold.js (buildSummarySystemMessage, buildRecordSystemMessage)",
    enforced: true,
  },
  {
    article: "P244 socrates — a non-AGREE standing ships with its standing question; no live claim in view refuses the oracle default",
    holds: "elenchus questionFor + gateCrown, enforced at the render seam by assertCrownShippable (crown.js); gary no-oracle-mode via checkOracleMode, enforced before any model call (twoPassTurn) and at the task door (runHolonicTask)",
    where: "organs/elenchus.js, crown.js (socratesGate), organs/gary.js (no-oracle-mode); constitution.test.mjs walks this row",
    enforced: true,
  },
  {
    article: "III.1 anchor — a default view is a claim",
    holds: null,
    where: null,
    enforced: null,
  },  {
    article: "III.4 opposite — the strongest contrary slice is rendered",
    holds: null,
    where: null,
    enforced: null,
  },  {
    article: "III.5 prediction — the reader states expectations before results",
    holds: null,
    where: null,
    enforced: null,
  },
  // ── Articles the map did not represent at all, added 2026-10-05 ───────────
  // VI.3's failure mode is not only a wired row that is not wired; it is an
  // article that is neither wired NOR listed as unwired, and so is invisible.
  // These rows were absent from this table before the assay was written.
  // `null` here is not a claim that nothing enforces them anywhere in the
  // lineage — it is the honest standing until each is probed against an organ
  // present in this repo, one row at a time, exactly as the rows above are.
  { article: "I.1 measured — a finding carries a ground, a descent, and a price", holds: null, where: null, enforced: null },
  { article: "I.2 received — a prior is a gift and names its giver", holds: null, where: null, enforced: null },
  { article: "I.3 shown — raw output, owned and permanently typed", holds: null, where: null, enforced: null },
  { article: "I.4 refused — the list is closed; everything else is permitted", holds: null, where: null, enforced: null },
  { article: "I.5 the record is the floor under all four standings", holds: null, where: null, enforced: null },
  { article: "II.1 giver test — told to us, or made up", holds: null, where: null, enforced: null },
  { article: "II.2 two-tier refusal — type error before null", holds: null, where: null, enforced: null },
  { article: "II.4 commensurability — the null is the same computation re-run", holds: null, where: null, enforced: null },
  { article: "II.6 revision — does this move the picture, or merely look odd", holds: null, where: null, enforced: null },
  { article: "II.7 consequence — same thing, or look alike", holds: null, where: null, enforced: null },
  { article: "II.8 lens — at what position, and out of what", holds: null, where: null, enforced: null },
  { article: "II.10 falsifiability — has this check ever rejected anything", holds: null, where: null, enforced: null },
  { article: "II.12 address — who said this was a kind", holds: null, where: null, enforced: null },
  { article: "II.14 non-consuming read — asking never changes the answer", holds: null, where: null, enforced: null },
  { article: "III.2 frequency — the plain register is stated in counts", holds: null, where: null, enforced: null },
  { article: "III.6 aperture — does this widen or narrow what could still refute", holds: null, where: null, enforced: null },
  { article: "IV.2 pure vs host — seed, clock, entropy, I/O come from the host", holds: null, where: null, enforced: null },
];

/** The articles this app claims to enforce, for the assay to walk. */
export function enforcedArticles() {
  return ENFORCEMENT.filter((e) => e.enforced === true);
}

/** The articles visibly not wired — VI.3's list, kept honest. */
export function unwiredArticles() {
  return ENFORCEMENT.filter((e) => e.enforced === null);
}
