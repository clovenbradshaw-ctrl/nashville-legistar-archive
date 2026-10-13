# Research assistant — pre-registered falsification record

Written **before the first run against the real web**, on 2026-10-12. The instrument is the code at commit
`33a870a` on branch `claude/holodeck-research-assistant-babe7f` (pure modules `holodeck-research-null.js`,
`holodeck-research-read.js`, `holodeck-research.js`, `holodeck-research-terrain.js`, `holodeck-research-lanes.js`;
the page wiring in `index.html` comes after this file and may not change any of the rules below).

**The predictions in Part 2 are never edited.** Results go in Part 3, appended below the line, with the run's own
record attached. What failed goes in Part 4. Anything that is not established goes in Part 5.

## Part 1 — What is being tested, and by what rule

The assistant takes a topic or question, searches the lanes the fold already has, reads what clears a relevance null,
stops when reading more stops teaching it more than chance, and lays the corpus out by terrain. Three decisions are
statistical, and each is "outside every one of 199 draws" (`holodeck-region.js`'s convention, 1/200 resolution):

| Decision | Statistic | Null |
|---|---|---|
| Is this candidate / page about the question? | G² keyness of the question's terms against General English (the `live_priors` prior the Holodeck already loads) | the same-length stretch of ordinary English, 199 draws, each term's count ~ Poisson(L·p) |
| Has reading more stopped teaching it anything? | *(superseded — see Amendment 1)* referents carried across the earned line by the latest batch of 3 | *(superseded)* a popularity-weighted re-draw of the corpus, 199 draws |
| Is a tie / echo / source grouping real? | shared statements / shared wording / shared earned referents | same-size random overlap (uniform for statements, popularity-weighted for referents), 199 draws |

Constants that are not statistical, declared: **199** draws; **3** pages fetched at once (a memory limit — each read
parses a document in the tab; also the unit of the stopping test). There is **no** source cap, page cap, time cap or
"top N". The person's own Stop is the only other way a run ends.

## Amendment 1 — the stopping rule, changed after a shakedown and BEFORE any registered run

Recorded 2026-10-12. The instrument named at the top (`33a870a`) stopped on *corroboration gain against a re-sampling
null*. A shakedown run on a question that is **not** one of the three registered topics (`Who built the Eiffel Tower
and why?`, the browser pane, Wikipedia + Crossref lanes) showed that rule to be biased: it read 6 sources, stopped
with 33 admitted candidates unread ("the last batch carried 20 referents across the earned line; re-sampling carried
up to 26"). In a heavy-tailed corpus ~90 % of names are heard once, so a popularity-weighted redraw lands mostly on
that tail, while real on-topic sources hit the core — so "inside the null" was the answer almost by construction.

Replaced by **saturation**: with f1 = the names and 4+-letter words said by exactly one source and n = sources read, one
more source is expected to bring about f1/n items nobody has said (Good–Turing); the run stops only when the largest of
the n leave-one-out estimates is **below one item** (the floor of a count), and is untestable below three sources. This is
a one-unit floor, not a drawn null — said so plainly in the README. A corpus of mirrors saturates at once; a diverse one
essentially never does, and the run then ends where the relevance null ends the pool, listing every cleared-but-unread
candidate as `held`.

Nothing in Part 2 is edited. What changes in how it is read: P6's `inside-the-null` is now the reason `saturated`;
P7 (batches before the stop) and P10 (stop not premature) apply only to runs where the stop fires, and I predict it will
fire for **none** of the three (a diverse corpus does not saturate) — so P6 is expected to **fail**, and that is the
honest outcome the record should show. The registered runs use the commit that follows this amendment.

## Part 2 — Predictions (frozen)

Three questions of different shapes, run through the real UI in the browser pane, one run each, nothing re-run to improve
a number:

* **T1 (a contested factual question):** `Who first proved the Pythagorean theorem?`
* **T2 (a bare entity):** `Tennessee Valley Authority`
* **T3 (a technical how-question, JS-heavy web):** `How does WebGPU let a browser run a language model locally?`

Off-topic nulls: the other two topics' questions, and a fixed control, **C0** `How do I feed a sourdough starter?`.

For each topic, before seeing anything:

| # | Quantity | Prediction |
|---|---|---|
| P1 | candidates found (all lanes, deduplicated) | 25–90 |
| P2 | share of candidates that clear the snippet null | 25–75 % |
| P3 | kept sources (read, text clears the null, ingested) | T1 6–20, T2 6–25, T3 5–18 |
| P4 | read success (admitted candidates that returned text) | ≥ 60 % for T1 and T2; ≥ 40 % for T3 (JS-heavy docs, typed unread) |
| P5 | pages read but refused as not about the question | ≤ 15 % of read |
| P6 | stop reason | `inside-the-null` for at least two of the three (not exhaustion, not abort) |
| P7 | batches before the stop | 2–5 |
| P8 | **relevance precision** — kept sources I judge on-topic from title+URL alone, scores hidden, judged before the scores are opened | ≥ 85 % per topic |
| P9 | **off-topic null** — kept sources of topic A that also clear the relevance null for topic B's question or for C0, using their full text | ≤ 5 % per (A, other) pair |
| P10 | **stop is not premature** — a control run of the same question with the stop disabled (same seeds) ends with at most 10 % more earned referents than the corpus had when the null would have stopped it | holds for T1 and T2 |
| P11 | **terrain coverage** — SEEN registers (Sources, Names, Types, Figures, Statements, Connections) non-empty | ≥ 5 of 6 for every topic; Figures may be empty for T1 |
| P12 | earned referents (witnessed by ≥ 2 sources) | ≥ 10 per topic, and heard-once is the larger share (≥ 50 % of referents) |
| P13 | Connections: ties that beat the null | ≥ 1 per topic |
| P14 | Patterns: at least one group of ≥ 2 sources tied beyond chance | T2 yes; T1 and T3 not predicted |
| P15 | provenance — every entity, statement, figure and tie row carries a source id and a span that slices back out of that source's text | 100 % (a single exception falsifies) |
| P16 | typed gaps — every unread / turned-away / off-topic / lane-failed entry carries a non-empty `why` | 100 % |
| P17 | wall-clock from the click to the stop, in the pane | ≤ 150 s for each topic |
| P18 | consent — no search request leaves the page before the person clicks the one button that names the hosts | 0 requests before the click (checked in the network panel) |

### What would count as the assistant failing

Any one of: kept sources < 4 for a topic (it under-reads); P8 < 70 % for any topic; P9 > 15 % for any pair (the null
does not discriminate); P10 violated for T1 or T2 (the stop is premature); a run that ends `no-candidates` on a topic
whose lanes answered; a row with no address (P15) or a gap with no reason (P16); any request before consent (P18);
or a page that cannot be read being shown as read.

### Controls

* **Ordinary-English control** (offline, `holodeck-research-terrain.test.mjs`): ≤ 2 % of 300 stretches of ordinary
  English of every length clear the relevance null. Measured while building: 0.3–0.7 %.
* **C0** is run through the same gate against each topic's kept sources (P9).
* **Stop control** (P10) as above.

## Part 3 — Results

### 3a. The registered runs (instrument: `0b1dace`; one click each, nothing re-run to improve a number)

Run in the browser pane, one fresh workspace per topic, through the real UI (the question entered in the empty
workspace's own box → "Find sources for this question" / the panel → the one button). Run records, with every
candidate's verdict and the numbers behind it, are `docs/research-runs/T1-run.json`, `T2-run.json`, `T3-run.json`.
Pane: `127.0.0.1:8841`, this machine's network; the fold relay's web lane answered 502 during T1 (a typed gap), and
answered in T2 and T3.

| # | Prediction | T1 Pythagoras | T2 TVA | T3 WebGPU | Held? |
|---|---|---|---|---|---|
| P1 | candidates 25–90 | 74 | 209 | 121 | **T2, T3 failed** |
| P2 | cleared the snippet null 25–75 % | 92 % (68) | 87 % (181) | 83 % (101) | **failed all** — the gate admits nearly everything it is shown |
| P3 | kept T1 6–20, T2 6–25, T3 5–18 | 46 | 125 | 52 | **failed all** |
| P4 | read success ≥ 60 % (T3 ≥ 40 %) | 75 % | 78 % | 57 % | held |
| P5 | refused when read ≤ 15 % | 10 % (5 of 51) | 12 % (17 of 142) | 10 % (6 of 58) | held |
| P6 | stop = inside-the-null for ≥ 2 of 3 | candidates-exhausted | candidates-exhausted | candidates-exhausted | **failed** (0 of 3; expected, Amendment 1) |
| P7 | 2–5 batches before the stop | 26 | 65 | 37 | **failed** (the stop never fired) |
| P8 | precision ≥ 85 % | ≈ 22 % (about 10 of 46 clearly on the question; ≈ 40 % counting history-of-mathematics survey pages) | ≈ 45–60 % | ≈ 75 % (39 of 52) | **failed all** |
| P9 | cross-topic false-admit ≤ 5 % per pair | → T2 4 %, → T3 **50 %**, → C0 **39 %** | → T1 7 %, → T3 7 %, → C0 4 % | → T1 **15 %**, → T2 0 %, → C0 **33 %** | **failed** (T1→T3 50 % ≫ the 15 % failure line) |
| P10 | stop not premature | vacuous: the stop never fired (`wouldStopAt` = null) | vacuous | vacuous | holds only vacuously |
| P11 | ≥ 5 of 6 SEEN registers non-empty | 6 of 6 | 6 of 6 | 6 of 6 | held |
| P12 | earned ≥ 10, heard-once the larger share | 641 earned, 79 % heard once | 1,107 · 81 % | 485 · 86 % | held |
| P13 | ≥ 1 tie beyond the null | 5,077 | 14,500 | 6,629 | held — but see P13 below |
| P14 | T2 has a group of ≥ 2 sources | (35 sources, not predicted) | **107 sources** in one group | (38) | held |
| P15 | every row addressed, span in range | 22,637 rows, 0 out of range | 45,656 · 0 | 24,608 · 0 | held; 1.9 % of T1's statements (93 of 4,774) carry text the Holodeck joined across fragments inside their span |
| P16 | every gap has a `why` | 0 without | 0 | 0 | held |
| P17 | click → stop ≤ 150 s | acquisition 25 s; ≈ 3.5 min with the ingest | acquisition 143 s; **402 s** | acquisition 88 s; **≈ 232 s** | **failed** — the Holodeck's engine read of every source (≈ 2.5 s each) is the cost |
| P18 | no request leaves before the click | none (network panel) | not verifiable: the pane's request buffer was full | none (resource timing; +1 localhost probe) | held for T1, T3; T2 unverified |

**What the P9 failure was.** The cross-topic clearances were not the null being fooled by topical overlap: the
question's *function words* were being counted as terms. `a`, `how`, `does`, `let`, `start` survived the part-of-speech
filter (each also has a noun/adverb reading), and a different register keys them — a mathematics page says "a" a hundred
times as a variable. The null assumes ordinary English; those pages are not. P8 failed for the related reason: with
`theorem` and `proved` as terms, any mathematics page is "about" the Pythagorean theorem.

**P13.** 5,077 / 14,500 / 6,629 "ties beyond the null" is not a discriminating result: the null (statement-set
overlap) treats statements as exchangeable, and they are not. A tie that beats it carries little.

**The stop.** It never fired. That is the finding the rule's own derivation predicted (a diverse corpus does not
saturate) and the shakedown showed for the earlier rule; it means that in practice a run ends where the relevance null
ends the pool, so *the relevance null is the only thing standing between the person and "everything the engines
returned"* — and P2 says it admitted 83–92 %.

### 3b. Round 2 — post-hoc, labelled as such (instrument: `c800580`)

Made *after* seeing 3a, to the failures 3a names; **none of it is a registered result.** The changes:

1. a question word is a unit only when it is rarer than a word drawn uniformly from the vocabulary (p < 1/V, V = the
   prior's own size): `a`, `how`, `start` are out;
2. the question's named things (capitalised runs that do not merely open the sentence) are units *as phrases* and are
   the **anchor**: a text is about the question only if at least one of them clears its own null;
3. a followed name must itself be said by the corpus beyond what ordinary English would (the same keyness + null), so
   `References`, `See`, `BC` are no longer followed;
4. a tie must be witnessed by two independent sources; pairs are formed among names several sources say (tractable);
5. the terrain is laid out once, at the end of the ingest, behind a visible message.

**Offline, on the registered runs' own texts (no network):** cross-topic false-admit with the new gate is **0 %** for
every pair (T1, T2, T3 against each other and against C0: 0 of 46, 125 and 52 in every cell). Own-topic retention:
T1 80 % (37 of 46; rejected: *Theorem*, *List of mathematical proofs*, *Stewart's theorem*, *Legendre's…*, *Mathematical
proof*), T2 93 % (116 of 125; rejected: county and river pages that never say the agency), T3 77 % (40 of 52; rejected:
*Google Chrome*, *Julia*, *HCL Notes*, *Silverlight*, *History of video games*, *Stadia* — the pages I had judged off
topic).


**Round 2 live runs** (same three questions, fresh workspaces, same UI path; `docs/research-runs/R2-T*-run.json`):

| # | Prediction | R2 T1 | R2 T2 | R2 T3 |
|---|---|---|---|---|
| P1 | candidates 25–90 | 114 | 512 | 105 |
| P2 | cleared the snippet null 25–75 % | 65 % (74) | 53 % (273) | 54 % (57) |
| P3 | kept 6–20 / 6–25 / 5–18 | 45 ✗ | 148 ✗ | 35 ✗ |
| P4 | read success ≥ 60 % (T3 ≥ 40 %) | 80 % | 68 % | 63 % |
| P5 | refused when read ≤ 15 % | 24 % ✗ | 21 % ✗ | 3 % |
| P6 | stop = inside-the-null (now: saturated) | candidates-exhausted ✗ | **you stopped it** at 9.6 min — it had not ended on its own ✗ | candidates-exhausted ✗ |
| P8 | precision ≥ 85 % | ≈ 76–82 % (34–37 of 45) ✗ | ≈ 70 % (first 60 of 148 judged) ✗ | **≈ 94 % (33 of 35)** ✓ |
| P9 | cross-topic false-admit ≤ 5 % | 0 % (offline, registered texts) | 0 % | 0 % |
| P11 | ≥ 5 of 6 SEEN registers | 6 of 6 | 6 of 6 | 6 of 6 |
| P12 | earned ≥ 10; heard-once the larger share | 380 · 80 % | 1,064 · 82 % | 289 · 79 % |
| P13 | ≥ 1 tie (now: beyond the null *and* two witnesses) | 441 (708 beat the null) | 1,174 (2,177) | 325 (463) |
| P15 | rows addressed, spans in range | 12,786 · 0 bad | 29,035 · 0 | 9,406 · 0 |
| P16 | gaps have a `why` | 0 without | 0 | 0 |
| P17 | click → done ≤ 150 s | 345 s ✗ | 843 s ✗ | 277 s ✗ |

What moved: cross-topic false-admission fell from 4–50 % to 0 %; the pages I had called off-topic in T3 are gone
(precision ≈ 75 % → ≈ 94 %); 5,077 → 441, 14,500 → 1,174, 6,629 → 325 ties; the Research view opens instantly (the
terrain is laid out once, behind a message, instead of a 33 s blocking compute on first render). What did not: **the
run still ends only when the pool does** — T2 would have gone on (21 rounds, 512 candidates found, and still finding
admissible pages when stopped) — and the Holodeck's own ingest (≈ 2.5 s a source through the engine) dominates the clock.

## Part 4 — What failed

1. **The relevance gate was permissive (P2), and the registered precision (P8) was far under the line.** Cause: units
   like `a`, `how`, `let`, `start` and the question's generic nouns (`theorem`, `proved`) measure nothing, and a
   different register (mathematics) keys them. Round 2's floor (p < 1/V) and the entity anchor fix most of it, post hoc.
2. **P9 failed outright** (T1→T3 50 %, T1→C0 39 %). The one-sided keyness test is only as good as the "ordinary English"
   assumption; a page whose register is not ordinary English keys common words.
3. **The stopping rule never fired on a real topic.** First version (corroboration gain vs a re-sampling null) was
   biased toward "inside" and was replaced before the registered runs (Amendment 1); the replacement (Good–Turing f1/n
   < 1) does not saturate on a heavy-tailed corpus, so it is a guard against mirrors, not a stop in practice. **There is
   no null-derived "enough" for open-ended topics in this system yet** — only "the relevance-cleared pool is read".
4. **Snowballing drifts and has no end.** Round-1 followed `References`, `See`, `BC`, `AD`; Round 2 follows genuinely
   keyed names but still leaves the topic (`Knoxvillians`, `East Tennesseans`, rivers) and, uncapped, ran 9.6 minutes
   on a bare entity and was stopped by hand.
5. **Ties were not discriminating** (5,077 / 14,500 / 6,629): statements are not exchangeable.
6. **Time (P17).** Every topic missed 150 s; the ingest through the engine is most of it, and cannot be stopped.
7. **Papers lanes returned almost no full text**: OpenAlex answered 400 in registered T1 and T3 (not investigated) and
   returned 18 unreadable records in T2; Crossref DOIs mostly landed on pages that need scripts or a subscription —
   typed unread, 0 kept in T1 and T2, 2 in T3.
8. **The fold relay's web lane answered 502 during registered T1** — T1's corpus is therefore Wikipedia-only (46 of 46),
   which is also why its precision was the worst. Lanes vary run to run; runs are not reproducible bit for bit.
9. **The heimdall bridge could not be used from the pane**: it answers, but not with CORS headers for
   `127.0.0.1:8841`; only the relay path was exercised live.
10. **P18 was not verifiable for registered T2** (the pane's request buffer was already full).

## Part 5 — What is not established

* **Precision is one grader's judgement from titles and addresses** (me, scores hidden but the task known), not a blind
  panel; no inter-rater agreement; T2's "on the topic" depends on whether a river or a county that the agency shaped
  counts. Round 2's numbers were measured on the same three topics the fixes were made against — **no held-out topics**.
* **Relevance is lexical.** Paraphrase and synonym are invisible; a question made only of common words has no units
  (undecided, read unscreened, said so). English-only prior, 5-letter stems; non-English and unspaced scripts untested.
* **"Enough" is not null-derived** (see Part 4.3). The drawn null for it was tried and rejected as biased.
* **The null assumes ordinary English.** Code, mathematics, legal and tabular pages are not; the floor and anchor
  reduce, not remove, register artefacts. The General English prior is eight books, 31 encyclopedia articles and 27
  statutes (fetched from a third-party static host at boot, as the Holodeck's hygiene already does).
* **Unread reasons are coarse**: JavaScript-rendered vs bot-walled vs 4xx are not told apart (the vendored read pool
  swallows its own reasons); both are listed as "every door was tried and none returned text".
* **Acquisition-time names come from the Holodeck's finder without its hygiene** (no workspace-normal prior yet), so
  the stopping/follow-up referents differ from the names the person finally sees.
* **Terrain**: "other" is 75–90 % of kinds; paradigm groups are by shared names (one group holds ≈ 75–85 % of sources);
  tie nulls treat statements as exchangeable; `echoes` are the Holodeck's own.
* **Not exercised live**: the 360 px right panel at desktop width (the pane was 479 px wide, so the Holodeck used its
  bottom sheet; click → open → document does not move was verified); the heimdall bridge lane; the Ask answer path
  after a run (`answerAfter`) with a model loaded; PDFs through the file reader; a second browser.
* **The ingest cost is unbounded by design** (no source cap): 148 sources ≈ 4.5 minutes of engine reads, uninterruptible.
* **Consent**: verified before the click for T1 and T3 (network panel / resource timing) and by construction
  (`autoResearch` only opens the panel); a localhost probe of the bridge (`/api/tags`, carries no question) happens when
  the panel opens.
