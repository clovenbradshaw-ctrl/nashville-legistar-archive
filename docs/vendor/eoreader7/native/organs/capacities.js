// capacities.js — the seed of the capacity library named in
// SEED-CREATION-LANGUAGE.md ("the prior set, taken seriously") and specced
// in full in the Terminal Language document (§7): a small, typed, human-
// legible registry of shapes the terminal already knows how to reach for,
// so `synthesize`'s parts and `distinguish`'s targets can be checked against
// something real instead of trusted on the model's word.
//
// THIS IS A DATA TABLE, NOT A RUNTIME. Per the SEED doc's own build order
// ("The schema is a weekend. The library seed is a week"), this pass does the
// weekend piece (grid.js) and starts — deliberately does not finish — the
// library seed: every entry below NAMES an organ this repo already has
// (module, exported function, the terrain/operator cell it occupies) so a
// capacity reference can be resolved and typed. ONE entry (`cast`) is
// actually executed from the terminal — capacity-runner.js, kept in its
// own file so this one stays a plain table — spinning up the real
// engine organ against real loaded material from an `act` line; the other
// nine remain reference-only, and asking to run one returns a typed
// `not_yet_executable` gap rather than a silent no-op or a fabricated
// result. Wiring the rest is named future work in CLAUDE.md, not implied
// here.
//
// Every entry has to name its giver — the module it actually lives in — so
// a capacity reference resolves to a real place in this codebase, never a
// promise. `terrain` and `op` are taken from this repo's own operators.js
// cells (packages/engine/operators.js, ../legacy-engine.1), the same source
// grid.js reuses, so a capacity's typing can never drift from the algebra's.
//
// A domain is fixed by the OPERATOR LETTER alone (never by grain or by
// choice — operators.js's OP_DOMAIN), so `terrain` here is not a free
// label: it is `TERRAIN_BY_DOMAIN[domainOf(op)][grain]`, checked against
// the real module by hand for every row below. Two entries were caught
// wrong by that check while this table was being written and are worth
// naming rather than quietly fixing: `skill` first read op:"SYN", which is
// Structure-domain and can only ever land on Field/Link/Network — never
// Kind, no matter what grain is chosen — CLAUDE.md's own looser prose
// ("skills.js as Kind/Paradigm") is a description of where skills.js
// SITS, not a licence to pick any operator that gets there; INS (Existence
// domain) at Pattern grain is what actually lands on Kind, and it fits the
// act better besides (instantiating a known procedure onto new material).
// `build` first read terrain:"Field" with op:"INS" — also domain-illegal
// (INS is Existence-domain, Field is Structure-domain) — and build-log.js's
// own header already states the correct cell in so many words: "PROPOSE →
// INS · Figure · produced — BIRTH", i.e. Entity, not Field.

export const CAPACITIES = Object.freeze([
  Object.freeze({
    id: "cast",
    terrain: "Entity",
    op: "SIG+INS",
    module: "cast.js",
    fn: "makeReferentIndex",
    what: "referent identity over a passage set — names resolve to who, not to byte strings (P11). One of four capacities that execute from the terminal (capacity-runner.js) — `relations`, `unravel`, `witness` are the others; the rest are reference-only until they gain a handler in the runner's dispatch table.",
  }),
  Object.freeze({
    id: "relations",
    terrain: "Link",
    op: "CON",
    module: "hypergraph.js",
    fn: "makeRelationReader",
    what: "the material's own subject-verb-object edges, read against a vocabulary measured from the text. Executes from the terminal as of 2026-08-19 (capacity-runner.js) — `query subject:X verb:Y` (leave exactly one of subject/object open) answers directly from the graph, referent-aware, not a surface-string guess.",
  }),
  Object.freeze({
    id: "graph",
    terrain: "Network",
    op: "SYN",
    module: "relations-chain.js",
    fn: "chainRelations",
    what: "relations linked to document-order neighbours and referent-siblings — relations only make sense linked",
  }),
  Object.freeze({
    id: "derive",
    terrain: "Network",
    op: "SYN",
    module: "eoreader7/native/organs/derivation.js",
    fn: "makeDerivation",
    what: "floor 6 — a corroborated note as a PREMISE: licensed composition (the reaction circuit, chemistry from the declarations register's GIVEN tier alone) derives never-stated facts from F5 notes at a declared standing floor and lands them on the same ledger as SYN·Pattern·derived notes with NO witnesses of their own — premises and walked provenance carry them, the >=2 gate excludes them by construction, conceding a premise withdraws every product transitively. Typing: a whole compiled from parts under a licence is Generate·Structure at Pattern grain — SYN·Network, Composing; task-log's own `operator_basis: derived`.",
  }),
  Object.freeze({
    id: "atmosphere",
    terrain: "Atmosphere",
    op: "EVA",
    module: "aperture.js",
    fn: "meterSnapshot",
    what: "the reader's own accumulated ground — a second tier-stack meter, Ground+Figure for S1, run at hop = window",
  }),
  Object.freeze({
    id: "measure",
    terrain: "Void",
    op: "NUL",
    module: "measure.js",
    fn: "runMeasurement",
    what: "a declared statistic tested against a Born-constructed null — the measuring door's own licensing gate (P19); the engine behind a `ground … broken:<perturbation>` act",
  }),
  Object.freeze({
    id: "field",
    terrain: "Field",
    op: "CON",
    module: "fold.js",
    fn: "advanceSummaryFold",
    what: "maintaining the connective ground of a conversation — the running summary (System 1's field) carried forward turn by turn, projected under declared windows (projectFolds/projectRecords, RECORDS_IN_PROMPT, MAX_FOLDS_IN_PROMPT) rather than truncated in store (P45: the record is unbounded, only the projection is bounded). Typing: Relate·Structure at Ground grain — CON·Field, Tending. The plan's own gate ('a cleaner boundary than a nomination can draw between maintain-the-ground and judge-the-ground') is met by the two organs' own signatures: advanceSummaryFold MAINTAINS (append the fold line, count the turn, never decide); the aperture gate (EVA·Ground, `atmosphere`) DECIDES whether the ground moved. Registered 2026-09-02 on the user's direction not to block development on the fold-architecture boundary; app.js's refreshSummary is the caller that composes the two, and it stays in app.js.",
  }),
  Object.freeze({
    id: "preflight",
    terrain: "Void",
    op: "INS",
    module: "proof.js",
    fn: "preflightQuery",
    what: "generating ground where none exists — a materialless grounded turn gets ONE search declared BEFORE the model drafts (P23), so the checking ladder has real bytes to stand on instead of the draft's own words; shouldPreflight is the gate (checking mode on, standing web consent on, nothing attached), preflightQuery is the act's declaration (joined with discourse only on an anaphoric or content-free task, P23's 2026-08-19 amendment). Typing: Generate·Existence at Ground grain — INS·Void, Cultivating. The crossing itself (gatherPreflightMaterial, app.js) stays where P13's one sanctioned egress lives; what this row registers is the pure declaration of the act, which is what a capacity IS in this table. Registered 2026-09-02 on the same direction as `field`.",
  }),
  Object.freeze({
    id: "frame",
    terrain: "Atmosphere",
    op: "DEF",
    module: "frame.js",
    fn: "declareFrame",
    what: "the interpretive ground of a judgment, declared before the judgment runs — a declaration gate with typed refusals (undeclared_frame naming every missing piece), content-addressed frame ids stamped onto verdicts, and the cross_frame wall: verdicts from different declared grounds never compare silently (the live specimen: one suite reading 54/58 under one engine provider and 52/58 under the other, invisible until the frame was declared). Typing: Differentiate·Interpretation at Ground grain — DEF·Atmosphere, Clearing. BUILT FROM ITS DEPTH-SIBLINGS by pre-registered derivation (def-ground-derivation.md, committed before the module) — NUL·Ground's declared-numbers gate and SEG·Ground's extent-and-units, transposed to the calculus column; the sibling-derived design passed its own e2e (both real providers as two frames over one material) UNMODIFIED, which is §VIII.2's first earned point.",
  }),
  Object.freeze({
    id: "setting",
    terrain: "Atmosphere",
    op: "DEF",
    module: "eoreader7/native/organs/tschichold.js",
    fn: "readSetting",
    what: "the TYPOGRAPHIC ground a reading stands on, read off the bytes before any word is read and declared THROUGH frame.js's declareFrame (reader, bench giver, the setting's own numbers — wrap width, baseline indent, rules fired, level 1/T) — so two readings set differently meet the cross_frame wall instead of comparing silently. Registered 2026-09-28 (Tschichold) from a measured specimen: folding the archons' originals out of live_priors, the most 'distinctive' typographic facts were the EDITIONS' (Wikisource's one-space indent vs Gutenberg's two, the editor's line numbers, page UI inside headings, a doubled fetch), and the-fold/medium.js read first words as blank on 98–100% of lines in 19 of 57 works (ASCII classes). Rules are primitives over bytes plus a bench (live_priors/derived-priors/typography-priors) learned from originals and CV looks, each falsified on similar-but-not-identical material; two passes — the edition's artifacts removed before the author's conventions are read. Typing: Differentiate·Interpretation at Ground grain — DEF·Atmosphere, Clearing, the same cell as `frame`, which it composes rather than duplicates.",
  }),
  Object.freeze({
    id: "priors",
    terrain: "Lens",
    op: "DEF",
    module: "priors.js",
    fn: "checkPrior",
    what: "one claim checked against live_priors, provenance-carrying, zero-egress — DEF at Figure grain (a specific claim's status), the same cell emergence/shabda occupies for who-is-speaking",
  }),
  Object.freeze({
    id: "web",
    terrain: "Lens",
    op: "EVA",
    module: "web.js",
    fn: "extractReadable",
    what: "one sanctioned egress (P13): a claim's own words searched, a page read, judged by the same containment fold",
  }),
  Object.freeze({
    id: "interlocutor",
    terrain: "Lens",
    op: "DEF",
    module: "interlocutor.js",
    fn: "readInterlocutor",
    what: "WHO is at the door — an agent or a person (Buber, I and Thou) — distinguished MECHANICALLY from the request's own shape (doorway, user-agent, tool definitions, transcript), never asked of the model. DEF at Figure grain (distinguish the holder from the reading), the same Lens cell perspective.js and priors.js occupy for who-is-speaking. Held as a belief with a basis (witnessed/asserted), low-confidence, revisable, so the reader can MEET an agent or a person in the idiom each can receive — the register of the account it gives, never whether that account is honest.",
  }),
  Object.freeze({
    id: "socratic",
    terrain: "Lens",
    op: "REC",
    module: "socratic.js",
    fn: "speakDecline",
    what: "HOW the reader gives its account of a decline (Kierkegaard, indirect communication) — REC at Figure grain, the Generate-mode twin of interlocutor.js's DEF·Figure: composing the utterance FROM an already-judged shape, for one particular holder, landing on the same Lens terrain. The judgment stays in its own working vocabulary (SHAPE, FORECLOSE, STANDPOINT) for the record; this organ composes the plain-language account a person or agent actually reads, in the register interlocutor.js recognized — the same true reason and the same real alternative to both, never withheld from either.",
  }),
  Object.freeze({
    id: "skill",
    terrain: "Kind",
    op: "INS",
    module: "skills.js",
    fn: "runSkilledTask",
    what: "a procedure kept as code, instantiated onto new material — zero model calls when a skill claims the task, one grammar-held call to slot-fill",
  }),
  Object.freeze({
    id: "build",
    terrain: "Entity",
    op: "INS",
    module: "build-log.js",
    fn: "makeBuildLog",
    what: "an artifact's birth as an append-only log — PROPOSE/SUPERSEDE/RESULT, folded to a projection at any cursor",
  }),
  Object.freeze({
    id: "witness",
    terrain: "Lens",
    op: "EVA",
    module: "witness.js",
    fn: "witnessCode",
    what: "does one landing actually compile — the structural half of the parliament build-log.js gates every patch through. Executes from the terminal (capacity-runner.js dispatch, 2026-10-08): the language is sniffed off the bytes (identifyMaterial), only html/js read; anything else is a typed unexamined gap.",
  }),

  // ── the connection pass (2026-08-29, P64) ─────────────────────────────
  //
  // eval/capability-coverage.mjs measured this registry at 9/27 cells and
  // found the gap was largely REGISTRY DEBT, not incapacity: real, tested,
  // running organs whose cells were documented in their own code or headers
  // and never registered. The rows below pay that debt. Discipline per row:
  // the module and fn are verified exports; the cell is DOCUMENTED where a
  // source states it (cited in `what`) and REASONED like this table's own
  // original rows where not (the hand-check the header above describes),
  // mechanically domain-legal either way (operatorOf(op).domain →
  // TERRAIN_BY_DOMAIN[domain][grain] — the same arithmetic that caught
  // `skill` and `build` mistyped when this table was first written).

  // ── Ground, Figure, Pattern (GROUND-FIGURE-PATTERN-SPEC.md, Pass 32,
  // 2026-09-07). Three rows, one per grain of the triad, cells CONFIRMED by
  // cellOf rather than proposed: SIG·Figure -> Entity, EVA·Ground ->
  // Atmosphere, SYN·Pattern -> Network (the-fold relative-seat.test.mjs
  // asserts each against cube.js and that each fn is a real export). The
  // modules live in the-fold beside the ledger and the page crossings they
  // will get (OPFS, the reopen door, the room), which is where this table's
  // other page organs live too.
  Object.freeze({
    id: "recall",
    terrain: "Entity",
    op: "SIG",
    module: "relative.js",
    fn: "Field",
    what: "a cue settles a keyless field; a figure only above the band random cues of that length pull out of THIS field (Field#recallAgainstNull — the class is the export; no get, no id, no key: relative.test.mjs asserts Field.get is undefined). SIG·Figure: a signal picks out a figure from a field; nothing is asserted about bytes.",
  }),
  Object.freeze({
    id: "drift",
    terrain: "Atmosphere",
    op: "EVA",
    module: "relative-pattern.js",
    fn: "drift",
    what: "does an address still name its bytes — exact, shifted, moved, gone; nothing rewritten, ever (G1, G2). EVA·Ground: an evaluation of whether an address still names its bytes.",
  }),
  Object.freeze({
    id: "correspond",
    terrain: "Network",
    op: "SYN",
    module: "relative-pattern.js",
    fn: "correspond",
    what: "the pattern over a ground and a figure — agree, repaired, ground-only, ground-shifted, apart — as a ledger act resting on both, carrying the band it was measured against (P1, P2: moved is never reported as gone). SYN·Pattern: a product derived over a ground and a figure.",
  }),
  Object.freeze({
    id: "network",
    terrain: "Network",
    op: "CON",
    module: "network.js",
    fn: "makeNetworkBinder",
    what: "a recurring arrangement found and bound — the CON·Pattern cell P58 built this organ to occupy after its emptiness was CONFIRMED (the zero-edges list page, predicted before moves.js was written); registering it closes the loop that finding opened",
  }),
  Object.freeze({
    id: "patch",
    terrain: "Link",
    op: "SEG",
    module: "build-log.js",
    fn: "applyOps",
    what: "the delta carriage's cut primitive — {op:'SEG', find} snips one span out of one artifact (its own header's 'SEG · snip' row); the same cell identity.js:182 (eoreader7) emits verbatim on a real revision",
  }),
  Object.freeze({
    id: "extent",
    terrain: "Field",
    op: "SEG",
    module: "void-shape.js",
    fn: "spaceFrom",
    what: "the extent a question's space must cover, and its units, made operative — the module's own ['SEG','Ground','extent',...] row; the wall placeFiller refuses out-of-extent spans against (P53)",
  }),
  Object.freeze({
    id: "rezero",
    terrain: "Lens",
    op: "REC",
    module: "build-log.js",
    fn: "makeBuildLog",
    what: "rezeroBuild — a judged projection's ground conceded, the next born (its own header: EVIDENCE · REC · Figure · produced); grid.js::concedeEvaluation is the same act for checked claims (P36 mirrors it exactly)",
  }),
  Object.freeze({
    id: "reshape",
    terrain: "Paradigm",
    op: "REC",
    module: "void-loop.js",
    fn: "reshape",
    what: "a finding contradicting the declared space re-zeros the space itself — P53's own read-off cell (REC = Generate·Pattern at Paradigm); the kernel's declarations.js::concede and reaction.js::withdraw are its engine-side siblings (both grain: Pattern in their own code)",
  }),
  Object.freeze({
    id: "hear",
    terrain: "Link",
    op: "SYN",
    module: "notes-text.js",
    fn: "makeNotesText",
    what: "a re-sighting folds into the same note with witnesses and spans unioned — hear()'s own code types it SUPERSEDE · SYN · Figure (P57); store.js::updateRow carries the identical typing for the database fold",
  }),
  Object.freeze({
    id: "declare",
    terrain: "Paradigm",
    op: "DEF",
    module: "hl-acquire.js",
    fn: "acquireCandidates",
    what: "candidate functional/transitive declarations acquired from real material, REFUTED/CANDIDATE tiers, never GIVEN — the entries it feeds carry operator DEF, grain Pattern in declarations.js's own code (P37)",
  }),
  Object.freeze({
    id: "standing",
    terrain: "Paradigm",
    op: "EVA",
    module: "capacity-runner.js",
    fn: "mergeTestimony",
    what: "a claim's standing across witnesses — corroborated, single, disagree — a property of the SET no member carries (P39); the organ P44's order-13 metasystematic item runs, which is what evaluating at Paradigm is",
  }),
  Object.freeze({
    id: "compile",
    terrain: "Field",
    op: "SYN",
    module: "predigest.js",
    fn: "compilePriors",
    what: "sedimented readings merged into one carried experiential ground (P60) — composing the standing field later reading stands on; typing reasoned per this table's own hand-check discipline, not quoted from a source",
  }),
  // ── the development pass (2026-08-29, second pass — P65) ─────────────
  //
  // CAPACITY-DEVELOPMENT-PLAN.md's Tier 1 plus the one no-candidate
  // frontier cell, built and registered together. One premise of that plan
  // was WRONG and is corrected in the plan itself: the kinds pair was
  // "gated on the legacy-engine path" — but eoreader7's native kernel
  // already carries full ports (kind-induction.js / entity-kind-induction.js,
  // the latter with a built-in random-subset null arm), so the gate had
  // already dissolved when the plan was written. Two of these five rows
  // name eoreader7 NATIVE modules — the first registry rows to do so; the
  // `module` column stays what it has always been, a resolvable pointer
  // (data), and running them from the terminal still returns
  // `not_yet_executable` from capacity-runner.js until wired.

  Object.freeze({
    id: "clear",
    terrain: "Entity",
    op: "NUL",
    module: "clearance.js",
    fn: "makeClearance",
    what: "does this figure clear its ground — P22's own named next integration, built: presence re-gated by establishment (P38's distinction, mechanized), the material's own derived recurrence floor, ambiguity withheld with candidates, and a pronoun rung that runs only under declared numbers (typed skip otherwise — P41). Cell stamped in the organ's own CELL export (NUL·Figure).",
  }),
  Object.freeze({
    id: "unravel",
    terrain: "Network",
    op: "SEG",
    module: "unravel.js",
    fn: "unravel",
    what: "cutting a pattern apart at its own seams — parameter-free separation at the network's bridges, parts each still readable, cut edges addressed by the caller's own indices; a 2-edge-connected network is a typed no_seam refusal, never a cut bought with an invented threshold. The plan's one no-candidate frontier cell, built. Cell stamped in the organ's own CELL export (SEG·Pattern). Executes from the terminal (capacity-runner.js dispatch, 2026-10-08): composes `relations` into the edge graph, then cuts it.",
  }),
  Object.freeze({
    id: "settle",
    terrain: "Void",
    op: "SIG",
    module: "void-loop.js",
    fn: "whatWouldSettle",
    what: "naming what is absent as the questions that would settle it (P53's second amendment: a gap the loop can name is a question it can ask), ordered by what settles fastest; holon.js::searchedVoid signs the same kind of absence for a search that ran and found nothing (P32). Typing reasoned per this table's own hand-check discipline: Relate·Existence at Ground grain — SIG·Void.",
  }),
  Object.freeze({
    id: "kinds",
    terrain: "Kind",
    op: "SIG",
    module: "eoreader7/native/kernel/kind-induction.js",
    fn: "projectKinds",
    what: "recurring kind candidates signed PROVISIONALLY from a population's own interaction field, each basin carrying its own random-subset binding-energy null — the native port of the kinds discipline Explore's view already holds (null arm, refused-as-underpowered). Typing reasoned: signing a recurring kind is Relate·Existence at Pattern grain — SIG·Kind.",
  }),
  Object.freeze({
    id: "kindnull",
    terrain: "Kind",
    op: "NUL",
    module: "eoreader7/native/kernel/entity-kind-induction.js",
    fn: "testKindMembers",
    what: "a DECLARED kind membership challenged against the same random-subset binding-energy null the inducer runs on its own basins — structural refusals (unknown_members / under_powered / no_boundary), never tuned floors. Cell documented in the function's own docstring (NUL·Pattern — Differentiate·Existence at Pattern grain).",
  }),

  Object.freeze({
    id: "grain",
    terrain: "Void",
    op: "NUL",
    module: "eoreader7/native/adapters/text/existence-grain.js",
    fn: "existenceGrains",
    what: "which recurring forms may leave the Void, and to which Existence grain: Kind only on an elimination cue that fired above its own word-shuffle null (or the received prior's settlement, or a declared orthographic rule), Entity only on positive naming evidence, a typed Contest on both, Void on neither. Different from `kindnull` (NUL·Kind), which challenges a declared membership among already-individuated entities; this decides whether a surface form is an individual at all. The default cue set is the one Sullivan's swarm learned (eval/lavar/sullivan-learn.mjs). Measured 2026-09-23: zero real names killed in Doctor Faustus, Henry IV Part 1 and Antigone.",
  }),

  Object.freeze({
    id: "parseGatedNames",
    terrain: "Entity",
    op: "SIG+INS",
    module: "eoreader7/native/adapters/text/parse-gated-names.js",
    fn: "parseGatedNames",
    what: "proper-name candidate admission with the material's own per-occurrence SVO parse as the GATE (english-parser.js's upostOccurrences, tagging each occurrence's own sentence) and orthographic capitalisation (surfaces.js's extractSurfaces) as corroboration, never a coequal vote. Answers the user's own check of the code ('we have to go through SVO for English to get there'): the two pre-existing name detectors — surfaces.js and existence-grain's own naming signal — never imported a parser at all, and the one detector that did already outperformed both. Measured 2026-09-23 against a 365-item, 9-annotator blind gold (Henry IV Part 1, modern spelling): precision 69.4%, recall 87.7%, F1 77.5 — the best of nine admission formulas tried, ahead of the best combination of the pre-existing orthography-only detectors (F1 76.3). Standalone and unwired, on the same standing as english-parser-perceiver.mjs: not imported into recursive.js's discoverReferents path pending the same explicit sign-off that perceiver's own wiring required.",
  }),

  Object.freeze({
    id: "regime",
    terrain: "Atmosphere",
    op: "REC",
    module: "source.js",
    fn: "atmosphereBoundaries",
    what: "the ambient reading regime's tolerance-triggered re-zero — operators.js's own REC line ('rezero — a new ambient ground begins'), the one place REC fires as a literal numeric event (loops/atmosphere.js, consumed here); the terrain is the organ's own name",
  }),
  Object.freeze({
    id: "realityKind",
    terrain: "Kind",
    op: "INS",
    module: "reality-kind.js",
    fn: "classifyReferents",
    what: "a referent instantiated into ONE of three declared, fixed templates — real / fictionalized-real / fictional — from checked cross-document evidence (a name-level correspondence to a caller-declared nonfiction source), never discovered statistically. A SECOND organ at INS·Kind (`skill` — 'a procedure kept as code, instantiated onto new material' — is the first): reasoned per this table's own hand-check discipline, since typing a specific referent into a small closed taxonomy from checked evidence is instantiation, not the discovery `kinds` (SIG·Kind) or null-tested membership `kindnull` (NUL·Kind) already occupy. Genre is caller-declared, never induced (a source with none is refused, not guessed); 'fictional' is 'examined against every declared-nonfiction source and none corresponded', never 'does not exist' (checkedAgainst names what ran). Measured live on the real Battle of Borodino Wikipedia article and Tolstoy's own War and Peace excerpt: Napoleon and Kutuzov correctly correspond and read fictionalized-real; Bezukhov/Bolkonsky/Rostova never do. A disclosed, measured trade-off: an optional generic-token guard (surfaces.js::genericTokens) fixes a real false positive (a common given name colliding with an unrelated person) but, on this same imperfectly-merged real cast, also refuses the correct Napoleon/Kutuzov correspondence — shipped opt-in, off by default, not resolved.",
  }),
  Object.freeze({
    id: "dream",
    terrain: "Atmosphere",
    op: "REC",
    module: "consolidation.js",
    fn: "dream",
    what: "the night: the offline rhythm that turns a day's deposits into a standing field — the elenchus (the witness at the door, corroborateLedger, the measured paraphrase-wall lever under a declared ask budget, P9) promotes or holds each single-witness note, the chemistry's licensed products are heard back, and the morning projects the MORTAL FIELD over the IMMORTAL ledger (projectField): what stands (>=2 sources) or is still within the reach of the present primes the next read; the rest falls to the echo — still on the record, by address, out of the field. Forgetting is a projection decision, never a deletion. Typing mirrors the reading regime's own re-zero (`regime`, REC·Atmosphere): a new ambient ground begins.",
  }),

  // ── the master positional reader (2026-09-16, READING-SPEC.md S118-S122)
  // ─────────────────────────────────────────────────────────────────────
  //
  // A second CON·Figure row, sharing `relations`' own cell — a same-cell
  // sibling, not new territory (the cell was already occupied; `derive`
  // and `graph` already establish this registry allows more than one row
  // per cell, checked directly against the real table rather than assumed —
  // Opencode archon sources, 2026-09-16). Checked and found NOT a drop-in
  // to `hypergraph.js::makeCaseMarkedRelationReader`'s existing injection
  // slot either (that factory forwards only `{casePrior}` and reads
  // `.case`/`.number` into its own detail shape; this organ's options and
  // detail shape do not fit it unmodified) — reference-only here for the
  // same reason: this reader composes with the-fold's `grounding-gfp.js`
  // directly (`makePositionalSlots`), not through `capacity-runner.js`, so
  // running it from the terminal still returns `not_yet_executable`.
  Object.freeze({
    id: "positionalSlots",
    terrain: "Link",
    op: "CON",
    module: "eoreader7/native/adapters/text/relations-positional.js",
    fn: "makePositionalSlots",
    what: "a language's clause-level role-assignment as a `slotsOf(text)` organ for the-fold's `grounding-gfp.js::makeGfpGround` ('role assignment is the language's own eigenvalue... a caller reading an inflectional, Semitic or CJK text injects that language's own slot organ') — a `RoleConfig@1` (position + a family-wise-corrected marker, S122) derived mechanically from a UD treebank's own gold dependency annotations, never hand-typed grammar. Composed end to end against the REAL, unmodified GFP/kernel modules on two real UD test-split specimens, Hebrew and Arabic (tests/relations-positional.test.js). Measured isolated role-assignment recall/precision (given the gold verb, S121's head-of-phrase filter shipped): Hebrew end1 31.2%/68.6%, end2 34.4%/84.6%; Arabic end1 16.5%/100%, end2 34.0%/85.0% — comparable to or better than `relations-case-marked.js`'s own shipped Latin numbers. Verb-finding coverage (not role-assignment) is the disclosed, unresolved bottleneck: full-pipeline recall runs 3-5x below isolated recall on both languages.",
  }),

  // ── the surprise pass (2026-09-25) — from the essay "Weight, reach, and the
  // arrow": the four organs the essay named unbuilt, built. Each is a kernel
  // module (medium-blind, its cell stamped in its own CELL export, null
  // injectable, pValue declared by the caller), each with its own falsifier
  // file under native/tests/, each reference-only here like the other native
  // rows. One premise of the essay was WRONG and is corrected in the first
  // row: reach already had a null (cascade.js::cascadeNull/cascadeSurprise);
  // what was unbuilt was only its composition with bayes-surprise's magnitude.
  Object.freeze({
    id: "consequence",
    terrain: "Paradigm",
    op: "EVA",
    module: "eoreader7/native/kernel/consequential-surprise.js",
    fn: "consequentialSurprise",
    what: "an admission's Bayesian surprise (bayes-surprise.js) partitioned by how much rests on what moved: per slot, the caller-declared ids it attaches walk cascade.js's dependents index and rank against cascadeNull at the same seed count; bits on load-bearing ids (reach > 0, rank above the caller's declared pValue) versus local bits. No product of bits and reach — the partition is a sum. Reports the dangerous case, a seed under CANONICALIZATION_FLOOR that is nonetheless load-bearing (thinButLoadBearing), and a seed's own revision volatility, never multiplied in. Typing reasoned: a property of the SET of dependents no slot carries — Relate·Interpretation at Pattern grain, EVA·Paradigm, `standing`'s own cell.",
  }),
  Object.freeze({
    id: "volatility",
    terrain: "Lens",
    op: "EVA",
    module: "eoreader7/native/kernel/revision-volatility.js",
    fn: "revisionVolatility",
    what: "how many of a node's own sightings were later revised — corroboration.js's falsified (DEF) and superseded (REC) marks on its occurrences — against the chance its exposure alone would give: the store's total marks dealt onto occurrences without replacement, p per entry, rank among peers; an entry never seen has no p. No mapping into alpha or gamma: the prior stays the caller's declaration. Its own falsifier found 2026-09-25 that corroboration.js's `revision` counter is bumped by sightings too, so the marks, not the counter, are the statistic. Typing reasoned: one being's reliability over time — Relate·Interpretation at Figure grain, EVA·Lens, beside `witness` and `web`.",
  }),
  Object.freeze({
    id: "hindsight",
    terrain: "Network",
    op: "SEG",
    module: "eoreader7/native/kernel/hindsight.js",
    fn: "hindsight",
    what: "what the record said before a later identity event re-addressed the beings it said it about: every entry before the event referring to a touched id — directly, or transitively through a cascade.js dependents index where the dependent also sits before the event — with distance in the log's order and cascade depth, ranked against synthetic touched-sets drawn from the ids the prior entries refer to. Never rewrites an entry (the append-only law; pinned). the-fold/hindsight-log.js supplies the reader's schemas (EOReferentMerge@1 kept/folded, EOReferentReassignment@1 from/to, EOMention@1 referent). Typing reasoned: the record's past cut at the seam a later event opens — Differentiate·Structure at Pattern grain, SEG·Network, beside `unravel`.",
  }),
  Object.freeze({
    id: "settling",
    terrain: "Kind",
    op: "NUL",
    module: "eoreader7/native/kernel/settling.js",
    fn: "settling",
    what: "the mirror of the-fold's trajectory boredom on the same axis: does any slot of a stream hold one value for CANONICALIZATION_FLOOR consecutive steps at all (never_settles, a structural zero), and if so, in any order (settled_any_order) or in sequence beyond the same steps order-shuffled (settles_in_sequence, at the caller's declared pValue) — regimes that form and break, the band a meaningfully surprising stream lives in. ABSENT is never a held value; refusals too_short and settled_order_untestable are derived from the floor and from n! <= 1/pValue. the-fold/document-ledger.js::detectTrajectoryChurn is the text face, on the boredom test's own fixtures: its evolving control churns. Typing reasoned: whether any kind forms at all, against its own null — Differentiate·Existence at Pattern grain, NUL·Kind, beside `kindnull`.",
  }),
  Object.freeze({
    id: "contextuality",
    terrain: "Network",
    op: "SYN",
    module: "eoreader7/native/kernel/contextuality.js",
    fn: "contextuality",
    what: "the one quantum-style quantity READING-SPEC S13 named computable from exactly our data and left unbuilt: do the per-context readings glue into one global reading? An empirical model (contexts = sets of slots read jointly, each with its support of joint sections) is judged on the possibilistic hierarchy — signalling (overlaps disagree: a direct influence, not contextuality; Contextuality-by-Default owed), noncontextual (every local section extends to a global one), logically_contextual (some do not — Hardy), strongly_contextual (no global section — the PR box). Exact, no null (a structural fact of the data); the extension search is bounded by a declared node budget and refuses typed when spent; the contextual fraction (the LP) is owed, reported null. contextualityOfSteps groups bayes-surprise-shaped instances by slot set — the seam form-prior.js reports it at, because a one-reading-per-place ledger can only ever be signalling or gluable (the lemma pinned in its tests). Typing reasoned: gluing local sections into a whole over the whole cover — Generate·Structure at Pattern grain, SYN·Network.",
  }),
  Object.freeze({
    id: "dmd",
    terrain: "Paradigm",
    op: "DEF",
    module: "eoreader7/native/kernel/dmd.js",
    fn: "dmd",
    what: "Dynamic Mode Decomposition of a state trajectory into modes, each with its own growth rate and its own FREQUENCY (complex Koopman eigenvalues) — the one place on the record where PHASE is estimated from dynamics rather than asserted from counts (READING-SPEC S13: a density matrix over counts reduces to Bayes). Batch core; a causal consumer feeds prefixes or streams (Hemati, Williams & Rowley 2014). Registered 2026-09-25 — it had no row, and it is not on the holograph's hand-off path (resolutions.js / holon.js import only dmdWindow, Bateson's cut, a disclosed name collision). Typing reasoned: the rim's trajectory cut into a family of modes — Differentiate·Interpretation at Pattern grain, DEF·Paradigm, the family of solutions THE-THREE-MATHEMATICS.md names for that terrain.",
  }),
  // ── 2026-09-25: the arrow of time and the learned conventions ────────────
  Object.freeze({
    id: "arrow",
    terrain: "Network",
    op: "CON",
    module: "eoreader7/native/kernel/arrow.js",
    fn: "arrowOf",
    what: "Eddington — a sequence has an arrow when it reads differently backwards (Jensen–Shannon between its k-gram distribution and that distribution reversed), ranked against a symmetrized-bootstrap null (same undirected k-grams, sign removed — measured: a shuffle destroys order, not just sign, and let a reversible walk read as an arrow); which way is FORWARD is not intrinsic and is learned against a reference the reader already read forward (Hume's habit). Typing: a regularity of ORDER relations across the whole — Relate·Structure at Pattern grain, CON·Network, Tracing. Wired into eot-jsonl.mjs: every ledger carries its own EOArrow@1 with the rest of the book as habit.",
  }),
  Object.freeze({
    id: "narrative-time",
    terrain: "Atmosphere",
    op: "REC",
    module: "eoreader7/native/kernel/narrative-time.js",
    fn: "narrativeTime",
    what: "Partee's walk over a reading's own tensed arrangements: a time individuated (INS·Figure) and the reference ground advanced (REC·Ground) per past sentence, every past tense resolved through temporal-reference.js's own verdicts (CON·Ground), UD Pqp reaching BACK to the ground the live one superseded (resolveReachBack). Registered at the advance — the ambient ground every later tense reads against, temporal-reference.js's own Atmosphere reading. The tense typer is the caller's and names its giver.",
  }),
  Object.freeze({
    id: "clause-tense",
    terrain: "Lens",
    op: "EVA",
    module: "eoreader7/native/adapters/text/clause-tense.js",
    fn: "clauseTense",
    what: "an English clause's tense read off the Chomsky parser's own UD rows and emitted as universal-grammar.js's universal values — Past/Pres/Fut/Imp, and Pqp read off the had+participle construction; the clause located by the ledger's own label because a proposition's `at` is its END2 span (measured, 181/183). How one arrangement is viewed: Relate·Interpretation at Figure grain, EVA·Lens. Bounded by the parser (74% held-out recall): 1 of 7 had-labelled arrangements in Alice ch2 reads Pqp.",
  }),
  Object.freeze({
    id: "morph-cues",
    terrain: "Paradigm",
    op: "EVA",
    module: "eoreader7/native/adapters/text/morph-cues.js",
    fn: "learnFeature",
    what: "Sullivan's second sense — morphology by elimination: for any UD feature, the cues (endings, prefixes, class, neighbours by form and class, attached auxiliaries) a language's own material admits, each above three nulls (split-half consistency, its own shuffled-label enrichment, the search's rerun floor in bits of binomial surprise), the negative evidence learned as UNMARKED, predictions bound / unmarked / contested / void. The conventions of a language, learned and stored (priors/morph-cues-<lang>.json, MorphCuesPrior@1) with giver, period, region, register, script and license — the frame a reader reads a language under: Relate·Interpretation at Pattern grain, EVA·Paradigm. Seven treebanks learned 2026-09-25 (eval/lavar/sullivan-morph.mjs); the gold is a witness, never the fitness.",
  }),
  Object.freeze({
    id: "code-time",
    terrain: "Atmosphere",
    op: "REC",
    module: "eoreader7/native/adapters/code/code-time.js",
    fn: "codeTime",
    what: "Partee's organ (kernel/temporal-reference.js, UNCHANGED) reading a program: a declaration establishes a binding's time and advances that name's ground, a reference resolves against the name's live grounds, a use before its declaration is the organ's own typed no_candidate. The modality-transfer proof (eval/lavar/modality-transfer.mjs, 2026-09-25): three wirings into text never moved the referred-time organ under sentence reversal; in code, on every file, reversed statement order lands bound and no_candidate rows outside every shuffled draw (arrow.js: bound 146→53 against 81–105, gaps 25→118 against 66–90) — reversal is worse than disorder because every use is then before its definition. Same cell as narrative-time: the advance is the ambient ground every later reference reads against. Statements are lines, hoisting reads as source order, both said in the file.",
  }),

  // ── the what organ (2026-09-16) ────────────────────────────────────────
  // Reconstructing what a GIANT code hunk IS — a minified bundle, a build
  // artifact — from its own structural bytes: the module map (Vite deps /
  // hashed asset names / imports), the vendor stack (library and bundler
  // fingerprints in the bytes), the feature modules, endpoint/route literals,
  // declaration banners, and the source syntax's own declared names (codeGist,
  // dmdCut injected). Answer is an account of the bytes, never a verdict; a
  // giant hunk is scanned within a declared window with every skipped byte
  // disclosed. Typing reasoned per this table's own hand-check discipline:
  // declaring the artifact's identity from structural evidence is
  // Differentiate·Interpretation at Figure grain — DEF·Lens, the same cell
  // `interlocutor` and `priors` occupy for who-is-speaking, here for
  // what-is-this. Reference-only (module: what.js; runs through a caller
  // composing it, not through capacity-runner.js).
  //
  // Restored 2026-09-29 from the 2026-09-23 WIP stash ("WIP on main:
  // a97497a") that stranded it: organs/what.test.mjs has pinned this row
  // since the organ was published (b07545d), whose "17/17" only holds on a
  // tree carrying the row uncommitted. The same stash holds the organ's
  // drafted Reading-Spec entries, never committed; their numbers have since
  // gone to other entries, so the "S129" in what.js and what.test.mjs does
  // not name this organ's own, and this row cites none.
  Object.freeze({
    id: "what",
    terrain: "Lens",
    op: "DEF",
    module: "eoreader7/native/organs/what.js",
    fn: "whatIsThis",
    what: "what IS this giant hunk — the archon of artifact identity (Cuvier: 'show me a bone and I will reconstruct the beast'): a giant minified bundle's own structural bytes (module map, vendor stack, feature modules, endpoint literals, banners, declared names) reconstructed into an account of what the artifact IS, with every byte skipped disclosed and every claim byte-anchored. The same reconstruction also reads a GraphQL schema artifact (introspection JSON): type inventory, root operations, Connection pagination, mutation Payloads, enums, unions, domain vocabulary, mutation verbs. The admission fix that makes a 3.2 MB bundle step-able is adapters/code/encounters.js (codeEncounters, never a 1.8 MB 'sentence').",
  }),
]);

const byId = new Map(CAPACITIES.map((c) => [c.id, c]));

/** Exact-id lookup — the whole resolution rule for this pass. Fuzzy/partial
 * matching (a model's paraphrase of a capacity's name) is named future work
 * in CLAUDE.md, not attempted here: a silent nearest-match is exactly the
 * kind of guess this registry exists to refuse instead of make. */
export function findCapacity(id) {
  return byId.get(String(id ?? "").trim().toLowerCase()) ?? null;
}

/** The refusal shape SEED-CREATION-LANGUAGE.md itself specifies verbatim
 * ("unresolved capacity: your event references `X`, which the library does
 * not contain..."), typed rather than a bare string so a caller can render
 * or test it without re-parsing prose. */
export function unresolvedCapacity(name) {
  return Object.freeze({
    gap: "unresolved_capacity",
    name,
    detail: `unresolved capacity: this event references "${name}", which the library does not contain. Options: reference an established capacity (\`capacities\` lists them), propose one as a trial, or elaborate the shape you mean.`,
  });
}

export function listCapacities() {
  return CAPACITIES;
}
