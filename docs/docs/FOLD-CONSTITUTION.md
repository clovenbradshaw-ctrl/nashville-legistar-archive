# The Fold — constitution

**The Fold is the whole system (naming, 2026-10-01).** The constitution governs
everything The Fold puts in front of a person, at every house and every surface
— the khora (the eoreader7 repo, the perceiver · ground-producer), penelope (the
keeper — the record · the mouth · the judgment), and the surfaces where the hand
comes back to the loom. The reading/research surface is **the fold** (the
holodeck repo, renamed). The former `the-fold` repo is being absorbed by plane
and will be archived; the laws below were written at the workbench they govern,
and they govern the whole.

The one governing document of the workbench. Everything the Fold puts in front
of a person — a cell, a view, a merge, a finding, an export — ships into one of
four **standings**, and this document decides which. `assay/` is its
enforcement: an artifact whose claim does not pass the articles does not render
as a finding.

`SEED-SPEAKER.md` says what the instrument is. A `LAWS.md` will say what went
wrong here. This says what may be produced, and under what standing.

**The mission is the invariant:** an earned, measured, faithful encounter with
data. Every article is in service of that. A ruling that weakens the encounter
is a misreading of this document, even where the letter of an article permits
it.

**The one operation is the physiology:** a finding is a difference against a
ground the workbench rebuilt by re-running the same computation on perturbed
input. Folding is a lossless change of resolution — the plain sentence and the
formal statement are one reading at two altitudes, never two claims — and from
every altitude there is a way back down to the rows.

**The two deaths are the failure modes:** *confabulation*, a rendered thing with
nothing beneath it; and *sclerosis*, a reader whose ground has closed, for whom
nothing on screen can any longer differ from what they already hold. Article II
governs the first. Article III governs the second, and is the half most
instruments omit.

**Articles cite their evidence.** Where an article rests on a measured result —
ours or the literature's — the appendix names it with its effect size. Where the
evidence is contested, the appendix says so rather than letting the article
borrow confidence it has not earned. An article resting on nothing but taste is
marked as such and may still be right.

---

## Article I — Standings

**I.1 `measured`.** Carries a ground, a descent, and a price: it re-ran on
licensed perturbed input, it drills to the rows, and the search that produced it
was counted. Only a `measured` artifact may be exported, cited, or called a
finding.

**I.2 `received`.** Given, never derived. What a column means, what counts as a
duplicate here, which rows are in scope, what the question is for. A prior is a
gift and **must name its giver**. Received knowledge is not weaker than measured
knowledge; it is knowledge of a different kind, and the only failure is its
being silently supplied rather than received.

**I.3 `shown`.** Raw output — anything a person ran that has not earned, or
cannot earn, a ground. Fully permitted, fully visible, permanently typed as what
it is. `shown` is where exploration lives and where most of a working session
should be.

**I.4 `refused`.** Not producible. The list is Articles II and III and it is
closed; anything not refused is permitted.

**I.5 The record is not a standing; it is the floor under all four.**
Append-only, holding what was run, against what, with what breadth, what it
eliminated, and what the reader predicted before seeing it. Deleting the
interface must change no computed result. Deleting the record retroactively
destroys every standing above it, and is therefore not an available operation.

---

## Article II — The artifact tests

Ask in this order. **Given? → Refused? → Grounded? → what remains is `shown`.**
An artifact is routed by the first test that answers it.

### II.1 The giver test — *was this told to us, or did we make it up?*

What the data *means* — the referent of a column, the identity rule, the scope
of "active customer," the purpose of the question — is received knowledge. It
routes to `received` and names its giver. **A missing giver is a wall, not a
gap-in-waiting:** report a typed gap, never infer it from the data, never let a
model supply it. Three named consequences:

- **Defaults are givers and must sign.** A rule that arrived as a system default
  names the default as its giver, not the user who never saw it.
- **The model may not be a giver.** It may propose a definition for a person to
  accept, at which point the person is the giver.
- **A changed prior invalidates downstream standing.** Findings computed under a
  definition that has since changed revert to `shown` until re-run.

### II.2 The two-tier refusal — *can this question be stated?*

Type error before null. A question that cannot be stated is not a hard problem;
it is a wall, and no computation is spent on it. **Every refusal shown to a
person cites the article that produced it** — a refusal without a trace is an
error message, and people route around error messages.

### II.3 The descent test — *does this reach the rows beneath it?*

Whatever any altitude asserts, a drill-down path reaches the material below it:
a chart to its rows, a row to its source record, a source to its bytes. A fold
reduces resolution and invents nothing. Content that exists at altitude and
nowhere below it is not a discovery; it is a hallucination with a rank. Three
named consequences:

- **Resolution, never invention.**
- **The register ladder is a fold and obeys this test.** The plain sentence
  descends to the working statement descends to the code. A plain rendering
  authored separately from the formal one is not a fold; it is a second claim
  that will drift.
- **Descent may break, and then it is typed.** Arbitrary computation drops
  identifiers. The result is marked as breaking descent and everything
  downstream inherits the mark — refused as `measured`, permitted as `shown`.

### II.4 The commensurability test — *is the null this same computation, re-run under a licensed perturbation?*

The null is produced by re-executing the same pipeline on perturbed input — not
by anyone writing a second procedure — so that it shares the observation's
filters, drops, joins, and selection, and differs only in the axis under test.
Five named consequences, two of which are the reason this article is longer than
the others:

- **The null undergoes what the observation underwent.** If the observation
  drops nulls, the null drops nulls. `reversalNull` shipped at 13.4/9.2/9.8%
  against a nominal 5% because a hand-built shuffle pool excluded configurations
  the data could reach.
- **Licence.** The statistic must actually move under the perturbation. A
  shuffle that leaves the statistic invariant is a null of zero width and will
  clear anything put in front of it.
- **Containment.** The effect being tested must fit inside what the perturbation
  preserves. Licence and containment are different questions and **neither
  implies the other** — this pairing is checked against a table, not remembered,
  because every defect found in the lineage's own audit was a licensing
  violation whose table existed and was not consulted.
- **Selection is an axis.** A result found after thirty-eight attempts gets a
  best-of-thirty-eight null; the count comes from the environment that watched
  the search, since a computation cannot count its own forks. `searchKeyCohesions`
  had to be corrected to null against every cluster the search returned rather
  than only same-size ones.
- **Draws bound the claim.** The finest rank sayable is 1/draws. Twenty
  affordable re-runs buy a coarse statement, honestly made; zero buy `shown`.
  Expensive methods are never exempt — they are less precise, out loud.

### II.5 The firewall — *did the result tune the instrument?*

Evidence may never tune the instrument that produced it. Thresholds, draws,
perturbation choice, and stopping rules are fixed before the run and recorded;
a parameter changed after seeing the outcome produces a new artifact with a new
claim, never a revision of the old one. Two named consequences:

- **The prediction is registered before the run, or the run is `shown`.** The
  lineage's own governance requires this and it is what let an 8× improvement be
  reported as *still failing* rather than as a pass.
- **A failed prediction is not moved to meet the result.** `induceKinds` went
  from 82.5% to 10.0% fabrication on structureless material and its registered
  bar was 5%; the record says **P1 still fails**. That sentence is the article
  working.

### II.6 The revision test — *did this move anything, or does it merely look odd?*

Significance is not how unusual a value looks against the rest of the column. It
is how far it moves the picture the reader is holding. Three named consequences:

- **Difference is not surprise.** Outlier scores, rarity, and anomaly detectors
  are cheap sense organs: legal and useful for *nominating* something to look
  at, refused as the verdict.
- **No scalar by default.** Introduced, connected, contradicted, and reorganized
  are different events at equal magnitude; a collapse to one "impact score" is
  declared and task-relative or it does not ship.
- **Exclusion is part of the update.** What the reader rejected is retained,
  with what eliminated it and whether the rejection is final, provisional, or
  censored.

### II.7 The consequence test — *are these the same thing, or do they look alike?*

Two records are the same iff they make the same difference — never by
appearance, not even in principle. String distance, phonetic keys, and embedding
similarity may **nominate** a merge; none may decide one. Three named
consequences:

- **Three outcomes, not two.** `DISTINCT` (refuted as one), `CONSISTENT` (never
  asserted proven), and `UNSTABLE` — the honest middle, which is a result and
  not a failure to reach one.
- **A merge presents its behavior, not its score.** An accepted merge is
  `received` and names the accepter as its giver.
- **Merges are reversible and recorded.** There is no similarity value at which
  appearance becomes consequence; Bertillon's eleven measurements were more
  careful than any string metric in use today and were still identity by
  appearance.

### II.8 The lens test — *at what position, and out of what?*

Every view selects; that is what makes it a reading rather than the data. What
is refused is presenting a selection as the whole, and reading without a
declared position. Three named consequences:

- **A cursor is named, never defaulted to now.**
- **Exclusions are counted where they happen** — rows a filter removed,
  categories a top-N dropped, records a join lost.
- **A view with nothing under it renders as such.** A saved view over zero
  admitted records is a view over Void and shows it, rather than showing empty
  axes.

### II.9 The mouth test — *did a model author this value?*

No number, name, date, or quantity is emitted as model tokens. Every such value
is a reference to a computed cell, resolved at render time. A model may phrase,
order, narrate, translate a register, and propose; it may never originate a
fact. Two named consequences:

- **A prompt is a request, not a guarantee.** A model instructed to state the
  value from the document in front of it answered "1893" against a document
  reading 2031.
- **Where a model call is unavoidable, its output is a draft to be checked** —
  and the check runs whether or not the prompt asked the model to be careful.

### II.10 The falsifiability test — *has this check ever rejected anything?*

A gate is verified against material it is supposed to reject, not only material
it is supposed to accept. A brace-balance check passed a file containing no CSS
at all, because `0 === 0`. Three named consequences: an unfalsified gate reports
`unmeasured`, never `pass`; "passed on 0 rows" is a distinct state from
"passed"; and this applies to graders and dashboards, not only to production
checks — a flattering number is a reason to check the checker.

### II.11 The earned-constant test — *where was this number measured?*

Every threshold, cutoff, minimum count, and top-N names the run that derived it,
or the pipeline carries the flag downstream. This is not a refusal: a person may
set a cutoff by hand and say so, at which point it is `received` and names them
as its giver (II.1). What is refused is a constant with no giver and no
measurement — a judgment wearing the clothes of a setting.

### II.12 The address test — *who said this was a kind?*

A terrain, category, cluster, or type assigned by the machine and presented as
found is refused. The cube was measured and refuted as a content classifier —
shuffling words inside 2,527 paragraphs left 95.7% of cell assignments
unchanged. Two named consequences:

- **Addresses are declared and checked for coherence, never inferred and
  asserted.** An induced kind carries a per-population null arm or renders
  `provisional`.
- **No Pattern from a Ground without a Figure between.** No network composed
  straight from a document pile, no taxonomy straight from a raster.

### II.13 The local test — *does this run on the machine that has it?*

A null that does not run locally does not exist. Perturbation and re-execution
are precisely the compute a single machine owns, which is why the boundary is a
design force rather than a tax. One named consequence, learned from a null arm
that runs in about two minutes: **when the honest path is slow, it is deferred,
never declined by default.** An expensive check that a responsive interface
routes around is not a gate, it is decoration — the fix is to return the result
marked pending and land the check as a second phase, so the honest path is also
the responsive one.

### II.14 The non-consuming read — *does asking change the answer?*

**A read never mutates what it reads.** Looking at a source twice returns what
looking once returned; a view does not advance a belief graph, consume a
position, or age a decay by being opened. Three named consequences:

- **Re-asking is the cheapest check a person has, and must stay free.** An
  instrument where the second look differs from the first teaches its user that
  checking is dangerous.
- **This article is what makes II.4 possible.** A computation can only serve as
  its own null if executing it does not move the ground it is measured against.
  A consuming read makes every re-execution incommensurable with the run before
  it, and does so invisibly.
- **Where state genuinely must advance — admission, ingestion, bookmarking — it
  is an explicit act with its own record entry**, never a side effect of
  looking.

---

## Article III — The reader tests

Article II governs what the workbench produces. These govern what the reader
becomes, and they exist because the reader's fast, automatic processing is not
optional equipment that can be instructed away. It takes what is rendered as the
whole world, anchors on the first number it meets, and cannot represent what is
absent. Every article here is a rendering rule, never a prompt to try harder —
telling a person to be careful is the same category error as telling a model to
be careful (II.9).

### III.1 The anchor test — *what does this show first?*

The first value rendered becomes the reference point for every judgment after
it, and this happens whether or not the reader endorses it. Therefore **a
default view is a claim and carries a claim's obligations**: it has a standing,
a cursor, and a giver. Two named consequences:

- **No default may be the most flattering available view.** Where several
  orderings are equally defensible, the default is chosen by a declared rule
  (recency, completeness, alphabetical), never by which produced the better
  number.
- **Re-anchoring is a supported operation.** The reader can ask what the picture
  looks like from a different starting point, and the workbench renders it
  rather than arguing with the first.

### III.2 The frequency test — *is this said in counts?*

The plain register is stated in natural frequencies — *41 out of 200 shuffles
found this too* — and the probability form is a descent from it, never the
canonical statement it simplifies. This is the one article where the plain
rendering is **empirically more correct in its effect** than the formal one:
given the same information as conditional probabilities, 1 of 24 physicians
inferred correctly; given natural frequencies, 16 of 24 did. Two named
consequences:

- **Distributions are shown as countable outcomes** — discrete dots or drawn
  samples — not as an interval whose ends are read as a boundary.
- **A summary that cannot be counted out is not the plain register.** "Highly
  significant" is not a fold of anything; it is a different claim wearing the
  plain register's clothes.

### III.3 The absent test — *is the missing thing on screen?*

What is not rendered does not exist to the reader who is not already looking for
it. A gap is therefore not merely typed in the record (III.4 of the seams); it
is **drawn** — a visible mark in the place where the value would have been,
carrying which of the six silences it is. Two named consequences:

- **Filtered-out is rendered, not merely removed.** The count of what a filter
  excluded appears with the filtered view, at the same weight as the result.
- **An empty result and an unrun computation are different marks.** Two facts
  that differ must not read alike.

### III.4 The opposite test — *where is the strongest contrary slice?*

Considering the opposite is among the few debiasing operations with durable
support, and it works by making the contrary *available*, not by exhortation. So
the workbench renders it: alongside a finding, the slice of the same data that
most weakens it, computed by the same pipeline. Two named consequences:

- **The opposite is rendered, not offered.** A button labeled "check for
  disconfirming evidence" is a prompt, and prompts are requests.
- **Two grounds that disagree are the finding.** Plural grounds stay parallel
  and are never averaged. Measured in this lineage's own code: a merged index
  reported `clean=true, 0 findings` on a claim whose figure appeared only in a
  web snippet and was absent from the reader's own document; run in parallel,
  the same check reported the figure supported by one ground and absent from the
  other. The merge destroyed precisely the finding.

### III.5 The prediction test — *what did the reader expect?*

Before a result is revealed at `measured` standing, the reader states what they
expect; before an analysis is exported, they state how it will have failed —
in the past tense, as a thing that has already happened. Both are recorded.
Three named consequences:

- **Prospective hindsight, not risk assessment.** *It failed; why?* generates
  substantially more reasons than *could it fail?* — the framing is the
  mechanism and must not be softened in the copy.
- **The ledger closes the loop.** Data work is a wicked learning environment:
  outcomes arrive late, arrive confounded, or never arrive, so experience alone
  does not produce skill. A record of predictions against outcomes is what makes
  the environment kind, and it is the only mechanism here that makes the reader
  better rather than merely making the artifact honest.
- **A prediction is never used to tune the instrument** (II.5). It is recorded
  and scored, never fed back into the computation.

### III.6 The aperture test — *does this widen or narrow what could still refute the reader?*

Extraction narrows the ground; encounter widens it. Both are movement and only
the sign says which. Three named consequences:

- **No ranking by agreement.** No surface is ordered, filtered, or personalized
  by what this reader has previously accepted. An instrument that learns what
  its user likes to be shown closes their ground for them.
- **Aperture is shown, never scored and never gated.** The moment it becomes a
  number to improve, it is a target, and the system will become what it was
  asked to be.
- **This article may not be enforced by nagging.** If the only available
  implementation is an interruption, the article is unwired and says so (VI.3).

---

## Article IV — The seams

**IV.1 Derive vs receive.** A model reranks and phrases what the workbench
surfaced; it never retrieves on its own. Where the workbench surfaced nothing,
it returns a typed gap, never a memory.

**IV.2 Pure vs host.** Seed, clock, entropy, and I/O come from the host — which
is what makes any computation re-runnable as its own null (II.4).

**IV.3 A missing prior is a typed gap, never a silently wrong number.** Six
kinds of silence, no two rendering alike: not-present, not-computed,
computed-and-empty, refused-as-underpowered, censored-above (surfeit — the
trigger to re-zero), censored-below (regularity, not to be mistaken for it).
**Downstream computation may not derive through a gap** — it inherits it.

**IV.4 `shown` is typed, never blocked.** People must be able to look at raw
output, try things, and follow hunches; a workbench that refuses to display what
it cannot certify is one people will leave, and leaving is the worst outcome
available. The invariant is not that everything is grounded. It is that
`measured` and `shown` never render alike.

**IV.5 The register is the reader's.** Nobody is assigned an altitude by an
inference about their competence, and no register is more confident than the one
below it. Where the formal register refuses a number, the plain register refuses
it in fewer words.

---

## Article V — The claim, and its verdicts

Every produced artifact carries a claim. **A missing or mistyped field returns
`gap`, not failure** — type error before null (II.2).

| verdict | meaning |
|---|---|
| `measured` | passes; may be exported and called a finding |
| `refused` | an article forbids it; renders with the citation |
| `provisional` | passes, but for an organ whose own calibration is open |
| `peer` | the structure did not sit above its members — a legitimate result, not a failure |
| `gap` | the claim is not well-formed; nothing is spent measuring it |

```json
{
  "artifact": "q3-churn-by-segment",
  "proposed_standing": "measured",
  "evidence": {
    "is_given": false,
    "giver": "",
    "descent_broken": false,
    "null_not_reexecuted": false,
    "perturbation_unlicensed": false,
    "hypothesis_uncontained": false,
    "draws": 200,
    "search_depth": 38,
    "selection_uncounted": false,
    "params_set_after_seeing_result": false,
    "prediction_registered": true,
    "scores_arrival_alone": false,
    "grounds_averaged": false,
    "gap_undrawn": false,
    "identity_by_appearance": false,
    "cursor_declared": "2026-08-15T00:00:00Z",
    "overclaims_completeness": false,
    "exclusion_uncounted": false,
    "gate_unfalsified": false,
    "value_generated": false,
    "threshold_unearned": false,
    "address_inferred": false,
    "desert_crossing": false,
    "default_view_selected_by_outcome": false,
    "ranked_by_agreement": false,
    "needs_remote_compute": false
  }
}
```

`true` on a refusal flag routes the artifact down to `shown` — except
`value_generated`, `gap_undrawn`, `desert_crossing`, `identity_by_appearance`,
and `params_set_after_seeing_result`, which route to `refused` and do not render
at all, because each produces something a reader cannot tell apart from a real
finding by looking.

---

## Article VI — Amendment

**VI.1 An amendment updates the enforcement test in the same change.** An
amendment that cannot be expressed as a changed failing test is not an
amendment; it is an exception.

**VI.2 The assay proposes and checks; it never amends.** Agents propose, humans
dispose.

**VI.3 Unwired is failing.** An article whose flag nothing sets is refuted, not
early. This document may not be cited to block anything for which no check
exists. Currently wired, verified by running the tests rather than by being told
they pass:

- **II.12** — `eoreader6/packages/host/terrains.js::sessionKinds` carries a
  per-population null arm by default (same pipeline re-run on the same records
  with each admitted field's presences redealt, marginals preserved,
  co-occurrence destroyed); a caller may decline it, and the declining is
  reported so every kind renders provisional. No terrain is inferred from
  content. `TERRAIN_GRID` carries `dependsOn` per cell, which is what lets a
  renderer refuse a desert-cell render and draw Significance-over-empty as a
  Lens over Void.
- **II.4's draws consequence** — `opts.nullArmDraws` is caller-declared and a
  typed gap when missing (never defaulted), and the result carries `draws`,
  `finestRank` (`"1/N"`), `perDraw`, and `drawsWithKinds`, so a renderer cannot
  phrase a kind more finely than the arm supports.
- **II.13's consequence** — `opts.nullArm === "defer"` returns kinds
  immediately, marked pending, with `kindsNullArm()` landing as a second phase.
- **II.14** — a per-session record of sources already admitted; a second
  `sessionTerrains` call does not advance the belief graph.
- **IV.3** — an unknown source returns a typed gap rather than throwing.
- **I.5** — `the-fold/record/explore-record.jsonl`, append-only, every computed
  event with its declared params.
- **II.9** — `eo-citation-check.ts`, pre-existing.

Everything else is still refuted rather than early. `conformance/host-terrains.test.js`,
6/6 passing, is the first check any article here has had.

**VI.4 Every verdict cites the articles that produced it.**

**VI.5 Editing this file is allowed. It makes this a different instrument.**

**VI.6 The amendment log.** Empty — the articles above are the initial text.

---

## Article VII — What is deliberately not refused

Bad questions, ugly charts, doomed hypotheses, unfashionable methods, work done
in the wrong order, and analyses this instrument's authors would consider
misguided are permitted and always will be. So is any computation whatever: no
method is on an approved list, because a rule admitting only blessed statistics
is the one-off fix the convergence test refuses, and because every obligation in
Article II attaches to the *result*, never to the technique.

**The constitution refuses claims, not curiosity.** Everything above governs
what may be asserted, exported, or handed to another person under the standing
`measured`. None of it governs what may be tried.

---

## Appendix — What each article rests on

**Measured in this lineage.** II.4's licence/containment pairing and II.5's
firewall come from the eo-evidence audit, where every defect found on the day it
was run was a licensing violation whose table existed and was not consulted.
II.4's first consequence is `reversalNull` at 13.4/9.2/9.8% against a nominal 5%,
fixed to 6.4/6.6/5.6%. II.5's second is `induceKinds` at 82.5% → 10.0%
fabrication on structureless material after its fix, **still failing** its
registered 5% bar, and 30.0% at the looser settings a real analysis used — an 8×
improvement reported as a failure because the prediction was registered first.
II.12 is the cube refuted as a classifier: 95.7% of cell assignments unchanged
under word-shuffling. III.4's second consequence is the grounding check measured
merged versus parallel, where merging two grounds turned a real contradiction
into `clean=true, 0 findings`.

**The reproducibility baseline for this class of tool.** Of 1.4M Jupyter
notebooks from GitHub, 24.11% of valid notebooks executed without errors and
4.03% reproduced the same results ([Pimentel et al. 2019](https://leomurta.github.io/papers/pimentel2019a.pdf)).
Re-executability is therefore not a discipline that can be asked of users; the
dominant tool for this work fails it in roughly nineteen cases out of twenty,
which is why II.4 makes the null a re-execution the system performs rather than
a procedure a person writes.

**Robust in the judgment literature, and used here.** Anchoring, framing, and
availability have replicated across cultures and decades and are the basis of
III.1. Natural-frequency framing is III.2's basis: 1 of 24 physicians inferred
correctly from conditional probabilities, 16 of 24 from natural frequencies
([Hoffrage & Gigerenzer 1998](https://pure.mpg.de/rest/items/item_2099208_9/component/file_3562683/content)),
with frequency-framed uncertainty displays — quantile dotplots, hypothetical
outcome plots — outperforming other distributional visualizations
([Padilla, Kay & Hullman 2020](http://space.ucmerced.edu/Downloads/publications/Uncertainty_Visualization_Padilla_Kay_Hullman_2022.pdf)).
Considering the opposite outperformed instructions to be fair and unbiased
([Lord, Lepper & Preston 1984](https://www.semanticscholar.org/paper/Considering-the-opposite:-a-corrective-strategy-for-Lord-Lepper/e71bbae72f8ad78e97c54f5ec88c9af2c70759f2)),
and is III.4. Prospective hindsight increased correctly identified reasons by
~30% ([Mitchell, Russo & Pennington 1989](https://onlinelibrary.wiley.com/doi/abs/10.1002/bdm.3960020103)),
and is III.5's framing requirement. Kind versus wicked learning environments
([Hogarth, Lejarraga & Soyer 2015](https://journals.sagepub.com/doi/abs/10.1177/0963721415591878))
is III.5's justification for the ledger.

**Contested, and not leaned on.** Ego depletion and social priming — two of the
most cited results in the popular dual-process literature — have poor
replication records, and Kahneman acknowledged in 2017 having placed too much
faith in underpowered studies. Nothing in Article III rests on either. The Good
Judgment Project's ~10% Brier improvement from under an hour of training is
suggestive support for III.5 but has been questioned for robustness under
controls, so III.5 is justified by the structure of the learning environment
rather than by that effect size.

**Resting on taste, and marked as such.** III.6's refusal of
ranking-by-agreement has no measured basis in this lineage or elsewhere that I
found; it is an argument from the failure mode, not a result. It is also the
article most likely to cost a feature people expect, and should be the first one
someone tries to refute.
