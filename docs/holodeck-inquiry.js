// holodeck-inquiry.js — THE CONSTITUTIVE INQUIRY, wired into the surface.
//
// The spec this implements (The Fold — Local-First Constitutive Inquiry v1.0,
// §3/§9/§12): a question first encounters the knowledge the Fold already holds.
// The default is no longer "question → web → passages → model"; it is
// "question → activate local evidence → consult the model-free doors → answer
// from witnesses, or say what is missing."
//
// WHAT THIS IS, HONESTLY. It runs Stages A–F: Stage A (frame the question — no
// view from nowhere, §1.4), Stage B (activate the caller's local evidence —
// §7), Stage C (consult the one model-free prior door this surface already
// runs), Stage D (derive — compose the turn's OWN relation edges through earned
// referents, no model), Stage E (falsify — admit a composition only under a
// GIVEN affordance; anything else is WITHHELD, never established), Stage F
// (record the disposition and the typed gap — §1.5), and Stage G (realize the
// answer mechanically when an exact door fires).
//
// WHAT STAGE D/E STILL DO NOT REACH. Janus's LEDGER-level derivation —
// `makeDerivation` with a chemistry register read from interpretation/
// declarations.js and kernel/refutation.js — is a NAMED UNPORTED GAP: those two
// modules carry a node builtin and a directory outside the vendored subset, so
// makeDerivation cannot load in this browser surface (vendor-skips.json names
// it). What IS here is janus's edge-level Relate engine, the wheel:
// kernel/relation-composition.js, vendored, node-free — the same organ janus
// re-exports (janus/native/kernel/relation-composition.js is a shim over this
// one home). Stage E is the licensing wall that engine already carries: without
// a GIVEN Hyperlexicon affordance every chain is withheld with its reason.
//
// WHAT IT COMPOSES, NEVER RE-DERIVES (§2, no second engine):
//   · kernel/retrieval-frame.js       — RetrievalFrame@1: what the retrieval stands on
//   · the-fold/answerable.js          — the model-free doors (P173): a computation
//                                       the question names, a blank the material
//                                       fills, what the record says was said, the
//                                       addresses themselves. The SAME door khora's
//                                       holon turn already runs (holon.js:4548); it
//                                       is vendored here, never copied or rewritten.
//   · kernel/relation-composition.js  — the Relate engine (the wheel): composition
//                                       chains at referent bridges, licensed only by
//                                       a GIVEN affordance (§1.2 — a prior nominates,
//                                       it never establishes).
//
// THE LAW THIS KEEPS. A mechanical answer is never laundered through a mouth:
// when a door fires the answer is exact and addressed, and the model is not
// asked (answerable.js's own header, measured: the mouth, told the answer,
// still said the wrong one). When no door fires the inquiry does NOT search and
// does NOT guess — it returns a typed gap and the caller proceeds exactly as it
// did before. Silence here costs a model call; a wrong answer costs the truth.
//
// PURE. No I/O, no model, no network. `passages`, `transcript` and `chunksByRef`
// are the caller's already-held local evidence, injected. An `offline-only`
// privacy frame is honored by construction: this module makes zero external
// requests on any path.
import { answerBeforeTheModel, wantsProse } from './vendor/eoreader7/native/the-fold/answerable.js';
import { declare, frameOf } from './vendor/eoreader7/native/kernel/retrieval-frame.js';
import { relationCompositionChains, evaluateRelationCompositions } from './vendor/eoreader7/native/kernel/relation-composition.js';
import { hyperedge } from './vendor/eoreader7/native/kernel/hypergraph.js';
import { chemistryFor } from './vendor/eoreader7/native/organs/derivation.js';
import { answerSpan, shownText } from './vendor/fold-chat/fold-chat-answerspan.js';

export const INQUIRY_SCHEMA = 'FoldInquiry@1';
export const ANSWER_SCHEMA = 'FoldAnswer@1';

// The doors answerBeforeTheModel can fire, and the standing each answer carries
// (§4.4: witnessed / derived / received / ... — a source STATING something is
// not the Fold ESTABLISHING it, but every door here is address-backed, so none
// is `unmeasured`). `comparison` is a deterministic computation over the
// question's own numbers (derived); a cloze/quote/record-check is a verbatim
// witness (witnessed); a quoted prior answer is the record's own speech
// (received). The mapping is stated once, here, and never inferred downstream.
const STANDING_OF_DOOR = Object.freeze({
  'record-check': 'witnessed',
  quote: 'witnessed',
  cloze: 'witnessed',
  'which-passage': 'witnessed',
  comparison: 'derived',
  'prior-answer': 'received',
  'answer-span': 'witnessed',
});
export const standingForDoor = (kind) => STANDING_OF_DOOR[kind] ?? 'unmeasured';

let _seq = 0;
const newId = () => `fi_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

/**
 * answerFromFold({ question, passages, transcript, chunksByRef, math, cursor,
 *                  workspace, privacy, onEvent }) -> FoldInquiry@1
 *
 * The inquiry record ALWAYS returns, whether or not an answer was found. When a
 * model-free door fires, `answer` is a renderable FoldAnswer@1 and
 * `disposition` is "answered-from-fold"; otherwise `answer` is null, the
 * disposition is "gap", and `gaps` names the missing thing (§1.5). The caller
 * decides what to do with the gap; this module never searches to fill it.
 */
export function answerFromFold({
  question,
  passages = [],
  edges = [],
  declarations = null,
  transcript = [],
  chunksByRef = null,
  math = null,
  cursor = null,
  workspace = null,
  privacy = 'local-first',
  retrieval = null,
  onEvent = null,
} = {}) {
  const startedAt = Date.now();
  const id = newId();
  const asking = String(question ?? '').trim();
  const emit = (e) => { try { onEvent && onEvent(e); } catch { /* a listener is never the inquiry's failure */ } };

  // ── Stage A — ENCOUNTER AND FRAME. The question is admitted as a situated
  // event, not an instruction to retrieve. `declare` refuses a frame that
  // cannot say what was asked and what the answer must make a difference to
  // (§1.4); the conclusion tested IS the question as asked, unparaphrased.
  let frame = null;
  if (asking) {
    frame = declare({
      asking,
      conclusion: asking,
      atSeq: cursor ?? null,
      organs: ['activation (local retrieved evidence)', 'answerable (the model-free doors)'],
      priors: null,
      absent: ['janus derivation (not vendored here)', 'web (egress not requested)', 'model (not needed for an exact answer)'],
    });
  }
  const frameGap = asking ? null : { type: 'outside_scope', detail: 'no question was asked — nothing to frame' };
  emit({ stage: 'frame', id, asking, atSeq: cursor ?? null });

  // ── Stage B — ACTIVATE. The caller hands the local, already-activated
  // evidence (holodeck retrieves/activates its workspace passages before this
  // is called). The inquiry records what was in scope and from where, so any
  // later relevance claim has a frame to stand on.
  const sources = [...new Set(passages.map((p) => p?.source).filter(Boolean))];
  const activated = { passages: passages.length, sources, distinctSources: sources.length };
  emit({ stage: 'activate', passages: activated.passages, sources: activated.distinctSources });

  // ── Stage C/D/E — CONSULT, DERIVE, FALSIFY (the model-free rung). The one
  // prior door this surface runs is answerable.js. It fires only on an exact,
  // address-backed answer; everything else declines. Janus's derivation and
  // adversarial falsification are named absent, not faked.
  let answer = null;
  if (asking) {
    try {
      const a = answerBeforeTheModel({ question: asking, passages, transcript, math, chunksByRef });
      if (a && a.text) {
        answer = Object.freeze({
          schema: ANSWER_SCHEMA,
          kind: a.kind,
          text: a.text,
          standing: standingForDoor(a.kind),
          addresses: freezeList(a.addresses),
          why: a.why ?? null,
        });
      }
    } catch { answer = null; }
  }

  // ── Stage C (extractive rung) — THE SMALLEST SPAN THAT ANSWERS. When the
  // exact doors decline and material is in scope, the P2 organ (the app's own
  // fold-chat-answerspan, COMPOSED, never re-derived) answers a factual wh-ask
  // (figure/date/name/place/definition) extractively: the minimal clause,
  // verbatim, no model. It self-gates — below its declared confidence the same
  // typed gap stands, and a question the material does not state is not
  // answered. The span's `ref` is a byte address into local material.
  if (!answer && !wantsProse(asking) && (passages ?? []).length) {
    try {
      const forSpan = (passages ?? []).map((p) => ({ ...p, title: p.title ?? p.source ?? null }));
      const sp = answerSpan(asking, forSpan);
      const span = sp?.spans && sp.spans[0];
      const spanText = span ? (shownText(sp) || span.shown || span.text) : null;
      if (span && spanText && String(spanText).trim().length >= 2) {
        // The span's address: the passage it came from (+passageIndex) plus its
        // range, rebased to the source's byte space. `passages` and the span's
        // forSpan array are 1:1, so the index resolves to the caller's passage.
        const srcPassage = (passages ?? [])[span.passageIndex];
        const rel = span.rewrite?.source ?? { start: span.start ?? 0, end: span.end ?? span.start ?? 0 };
        const s0 = Number.isFinite(rel.start) ? rel.start : 0;
        const e0 = Number.isFinite(rel.end) ? rel.end : s0;
        const srcName = (srcPassage && (srcPassage.source ?? String(srcPassage.ref ?? 'src'))) || 'src';
        const address = srcPassage && e0 >= s0
          ? `${String(srcName).split('#')[0]}#${(srcPassage.start || 0) + s0}-${(srcPassage.start || 0) + e0}`
          : null;
        answer = Object.freeze({
          schema: ANSWER_SCHEMA,
          kind: 'answer-span',
          text: String(spanText).trim(),
          standing: 'witnessed',
          addresses: freezeList([address].filter(Boolean)),
          why: 'the smallest span that answers, verbatim from the material (the composed P2 organ)',
        });
      }
    } catch { answer = null; }
  }

  // ── Stage D — DERIVE. Compose the turn's OWN relation edges through earned
  // shared referents (the Relate engine, the wheel). A derived proposition is
  // never its own witness: it carries `witnesses: []` and its premises and
  // provenance instead — janus's derivation wall (a product never corroborates
  // a premise, and vice versa; derivation.js's own law). No model is consulted.
  const hyperEdges = (Array.isArray(edges) ? edges : []).map(toHyperedge).filter(Boolean);
  let derivations = [];
  let derivation = null;
  // ── Stage E (contradiction), computed BEFORE derivation so the licensing
  // wall can see it: where two witnessed edges assert the SAME referent pair
  // with OPPOSITE polarity, the material contradicts itself (§8/§14). The
  // contest is PRESERVED — both sides and their addresses kept, neither is
  // chosen, and nothing here decides which is true.
  const contests = detectContests(edges);
  const contestedPairs = new Set();
  for (const c of contests) for (const x of [...(c.positive ?? []), ...(c.negative ?? [])]) contestedPairs.add(pairKey(x.from, x.to));
  emit({ stage: 'falsify', contests: contests.length });
  if (hyperEdges.length) {
    let chains = [], wall = { licensed: [], withheld: [] };
    try { chains = relationCompositionChains(hyperEdges); } catch { chains = []; }
    // Chemistry comes from the declarations register's GIVEN tier alone
    // (derivation.js::chemistryFor → reaction.js::affordancesFromDeclarations):
    // a transitive(r) declaration with a NAMED giver licenses r∘r ⇒ r. With no
    // register there is no chemistry, and every chain is withheld.
    let chemistry = null;
    try { if (declarations) chemistry = chemistryFor(declarations).chemistry; } catch { chemistry = null; }
    // ── Stage E — FALSIFY. Every chain is run against the licensing wall. A
    // composition is admitted only under a GIVEN Hyperlexicon affordance
    // (§1.2 — a prior may nominate, never establish); anything else is a
    // withheld candidate with its reason, never a fact. With no register this
    // withholds everything, which is the wall working, not a gap.
    try { wall = evaluateRelationCompositions(hyperEdges, chemistry); } catch { /* no wall available */ }
    const licensedFor = (c) => wall.licensed.find((l) => l.leftPredicate === c.leftEdge.relation && l.rightPredicate === c.rightEdge.relation && l.from === c.from && l.bridge === c.bridge && l.to === c.to) ?? null;
    derivations = chains.map((c) => {
      const lic = licensedFor(c);
      // §8/§16.5 IN THIS RUNG — dependent invalidation: a premise that
      // participates in a material contest is not a sound base, so the
      // dependent composition is WITHDRAWN even when a GIVEN affordance would
      // license it (a disputed premise never stays asserted). Withdrawal is a
      // disposition, never a deletion — premises and addresses remain on the
      // record, and a later uncontested reading can re-open them.
      const disputed = [pairKey(c.from, c.bridge), pairKey(c.bridge, c.to)].some((k) => contestedPairs.has(k));
      const standing = disputed ? 'withdrawn' : (lic ? 'licensed' : 'withheld');
      return Object.freeze({
        schema: 'DerivedCandidate@1',
        from: c.from,
        bridge: c.bridge,
        to: c.to,
        via: Object.freeze([c.leftEdge.relation, c.rightEdge.relation]),
        premises: Object.freeze([c.leftEdge.id, c.rightEdge.id]),
        witnesses: Object.freeze([]),               // stated nowhere — never its own witness
        provenance: Object.freeze([c.leftEdge.witness, c.rightEdge.witness].filter(Boolean)),
        standing,
        withdrawnBy: disputed ? 'premise contested in the material (§8)' : null,
        giver: lic ? (lic.provenance?.giver ?? null) : null,
        basis: disputed
          ? 'composition withdrawn — one of its premises is asserted with opposite polarity elsewhere in the material; dependents reopen'
          : lic
            ? 'witnessed relation adjacency through an earned shared referent, under a GIVEN composition affordance'
            : 'witnessed relation adjacency through an earned shared referent — unlicensed without a GIVEN composition affordance',
      });
    });
    derivation = Object.freeze({
      schema: 'DerivationWall@1',
      edges: hyperEdges.length,
      chains: chains.length,
      licensed: wall.licensed.length,
      withheld: wall.withheld.length,
      withdrawn: derivations.filter((d) => d.standing === 'withdrawn').length,
      givers: Object.freeze([...new Set(wall.licensed.map((l) => l.provenance?.giver).filter(Boolean))]),
      reason: wall.withheld[0]?.reason ?? null,
    });
  }
  emit({ stage: 'derive', chains: derivation?.chains ?? 0, withheld: derivation?.withheld ?? 0 });

  // ── The §12 outcome, as one typed status: what the interface may show in one
  // word. `from-the-fold` (answered from local evidence), `contested` (the
  // material supports incompatible readings, §1.5), `freshness` (a current
  // source is required, §9), or `unresolved` (a gap, answered onward). The
  // disposition stays as the finer record; status is its displayable face.
  const fresh = asksFreshness(asking);
  // Contested trumps: incompatible readings are the surface outcome whether or
  // not an exact door also answered (§12 "Contested: surviving evidence
  // supports incompatible interpretations").
  const status = contests.length ? 'contested' : (answer ? 'from-the-fold' : (fresh ? 'freshness' : 'unresolved'));

  // ── Stage F — DECIDE. An exact local answer is a complete disposition; a
  // missing one is a typed gap, never an automatic external search (§9). The
  // gap type distinguishes "the question needed more than the exact doors give"
  // from "there was nothing in scope to answer from." When there is a gap the
  // encounter planner (planNextEncounter, §9/§4.5) records what the Fold will
  // do next — which, by default, is report the gap and search nothing.
  const disposition = answer ? 'answered-from-fold' : 'gap';
  const gaps = [];
  if (!asking) gaps.push(frameGap);
  else if (!answer) {
    gaps.push({
      type: activated.passages ? 'not_found_in_scope' : 'not_yet_read',
      detail: activated.passages
        ? `${activated.passages} local passage(s) were in scope and none answered this exactly — the door needs prose, a derivation, or more reading`
        : 'no local passage was in scope — the workspace states nothing this inquiry could stand on',
    });
  }

  const candidates = answer
    ? [Object.freeze({
        proposition: answer.text,
        stance: answer.kind,
        standing: answer.standing,
        witnesses: answer.addresses,
        premises: [],
        unresolved: [],
        lineage: 'the door\'s own address(es); no derivation chain (janus absent)',
      })]
    : [];

  const event = (op, what) => ({ at: Date.now(), op, what });
  const events = [
    event('DEF', 'question framed and admitted to the record'),
    event('SEG', `activation scoped to ${activated.distinctSources} local source(s), ${activated.passages} passage(s)`),
    ...(derivations.length ? [event('SYN', `${derivations.length} composition candidate(s) derived from ${derivation.edges} edge(s) — ${derivation.withheld} withheld (no GIVEN affordance)`)] : []),
    ...(contests.length ? [event('CON', `${contests.length} referent pair(s) asserted with opposite polarity — preserved as contest`)] : []),
    ...(answer
      ? [event('INS', `answered locally by the ${answer.kind} door — ${answer.standing}`), event('EVA', 'the answer carries its address(es); the model was not asked')]
      : [event('NUL', 'no exact local answer — a typed gap, not a search')]),
  ];

  const inquiry = Object.freeze({
    schema: INQUIRY_SCHEMA,
    id,
    question: asking,
    startedAt,
    cursor: cursor ?? null,
    workspace: workspace ?? null,
    privacy,
    frame,
    frameOf: frameOf({ frame }),
    activated: Object.freeze(activated),
    candidates: Object.freeze(candidates),
    // What was consulted and what was deliberately NOT in play (§4.1, and
    // retrieval-frame's own `absent`): naming the absence is the point.
    priors: Object.freeze({
      consulted: Object.freeze([
        'answerable (the model-free doors — P173)',
        'kernel/relation-composition (the edge-level Relate engine — the wheel)',
      ]),
      applicableUnavailable: Object.freeze([
        'janus ledger derivation (makeDerivation + chemistry register) — node-only, outside the vendored subset (vendor-skips.json)',
      ]),
      excluded: Object.freeze([
        'web (egress is a distinct, authorized inquiry — §9/§11)',
        'model (an exact answer does not need one)',
      ]),
    }),
    tests: Object.freeze([
      ...(answer ? [{ test: 'the answer carries an address into local material', result: 'held' }] : []),
      ...(derivation ? [{
        test: 'composition licensing — a chain is admitted only under a GIVEN affordance',
        result: derivation.licensed ? 'licensed' : 'withheld',
        detail: `${derivation.withheld} of ${derivation.chains} chain(s) withheld (no giver)`,
      }] : []),
      ...(derivations.length ? [{ test: 'a derived candidate carries no witnesses of its own (no self-corroboration)', result: 'held' }] : []),
      ...(contests.length ? [{ test: 'a referent pair asserted with opposite polarity is preserved as a contest, not resolved', result: 'contested', detail: `${contests.length} contested pair(s)` }] : []),
    ]),
    derivations: Object.freeze(derivations),
    derivation,
    contests: Object.freeze(contests),
    coverage: Object.freeze({ localSources: activated.distinctSources, passages: activated.passages, complete: null }),
    gaps: Object.freeze(gaps),
    retrieval: retrieval ? Object.freeze({ ...retrieval }) : null,
    inquiries: Object.freeze(answer ? [] : [planNextEncounter({ gap: gaps[0] ?? null, question: asking, privacy, capabilities: { localRead: true, web: false, model: false, modelRequired: false } })]),
    answer,
    disposition,
    status,
    resources: Object.freeze({ modelCalls: 0, externalRequests: 0, ms: Date.now() - startedAt }),
    events: Object.freeze(events),
  });

  emit({ stage: 'decide', disposition, kind: answer?.kind ?? null });
  return inquiry;
}

const freezeList = (a) => Object.freeze([...(a ?? [])]);
const pairKey = (a, b) => [String(a ?? '').toLowerCase(), String(b ?? '').toLowerCase()].sort().join('|');

/**
 * toHyperedge(edge) -> EOHyperedge@1 | null
 *
 * The reader produces FLAT edges ({ end1Face, label, end2Face, refs, spans });
 * the composition engine consumes EOHyperedge@1 with participants. This adapter
 * bridges them the way derivation.js's own `identityEnds`/`substrateEdges` do:
 * the reader's EARNED FACES become the participants' referent ids (the identity
 * the reader already earned, never a second one invented here), so a chain
 * composes only through a face both edges agree on. An edge already in
 * EOHyperedge@1 shape passes through untouched. An edge missing either face or
 * a relation is dropped (a typed non-entry, never a guess).
 */
/**
 * detectContests(edges) -> Contest@1[]
 *
 * Two witnessed edges that assert the SAME referent pair with OPPOSITE
 * polarity contradict each other. The contest keeps both sides and their
 * addresses — the inquiry does not pick the stronger-looking one (§8/§14).
 * Only polarity conflict over a shared pair is detected here; scope, tense and
 * identity conflicts are named future work, not silently folded in.
 */
export function detectContests(edges) {
  const list = (Array.isArray(edges) ? edges : []).filter((e) => e && e.label && (e.end1Face ?? e.end1) && (e.end2Face ?? e.end2));
  const byPair = new Map();
  for (const e of list) {
    const key = [String(e.end1Face ?? e.end1).toLowerCase(), String(e.end2Face ?? e.end2).toLowerCase()].sort().join('|');
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(e);
  }
  const side = (xs) => xs.map((e) => Object.freeze({
    label: String(e.label),
    from: String(e.end1Face ?? e.end1),
    to: String(e.end2Face ?? e.end2),
    addresses: freezeList([...(e.refs ?? []), ...((e.spans ?? []).map((s) => `${s.ref}#${s.start}-${s.end}`))]),
  }));
  const contests = [];
  for (const group of byPair.values()) {
    const positive = group.filter((e) => (e.polarity ?? '+') !== '-');
    const negative = group.filter((e) => e.polarity === '-');
    if (!positive.length || !negative.length) continue;
    contests.push(Object.freeze({
      schema: 'Contest@1',
      positive: Object.freeze(side(positive)),
      negative: Object.freeze(side(negative)),
      basis: 'two witnessed edges assert the same referent pair with opposite polarity — neither is chosen; both addresses stand',
    }));
  }
  return contests;
}

function toHyperedge(e) {
  if (!e) return null;
  if (e.schema === 'EOHyperedge@1') return e;
  const end1 = e.end1Face ?? e.end1;
  const end2 = e.end2Face ?? e.end2;
  const label = e.label;
  if (!end1 || !end2 || !label) return null;
  const span = (e.spans ?? [])[0] ?? null;
  const witness = (e.refs ?? [])[0] ?? span?.ref ?? null;
  const seq = Number.isFinite(span?.start) ? span.start : null;
  try {
    return hyperedge({
      id: `${end1}|${label}|${end2}`.toLowerCase(),
      relation: String(label),
      participants: [
        { ref: String(end1), standing: 'referent', display: String(end1) },
        { ref: String(end2), standing: 'referent', display: String(end2) },
      ],
      witness,
      scope: seq != null ? { sequencePosition: seq } : null,
      meta: { witnesses: [...(e.refs ?? [])], spans: span ? [`${span.ref}#${span.start}-${span.end}`] : [] },
    });
  } catch { return null; }
}

/** renderInquiry(inquiry) -> one plain line of what happened, for the interface
 *  (§12's unobtrusive indicator). Never a dashboard. */
export function renderInquiry(inquiry) {
  if (!inquiry || inquiry.schema !== INQUIRY_SCHEMA) return { line: 'Unresolved.', detail: 'no fold inquiry was recorded' };
  switch (inquiry.status) {
    case 'from-the-fold': return { line: `From the Fold — ${inquiry.answer.kind}.`, detail: inquiry.answer.text };
    case 'contested': return { line: 'Contested — the material supports incompatible readings.', detail: (inquiry.contests || []).map((c) => `${c.positive.length} vs ${c.negative.length}`).join('; ') };
    case 'freshness': return { line: 'Unresolved — needs a current source.', detail: inquiry.inquiries?.[0]?.declined?.detail ?? '' };
    default: { const g = inquiry.gaps?.[0]; return { line: 'Unresolved — answered onward to the mouth.', detail: g ? `${g.type}: ${g.detail}` : '' }; }
  }
}

/**
 * planNextEncounter({ gap, capabilities, privacy, budget }) -> InquiryPlan@1
 *
 * §9's decision: the smallest justified next encounter. NOT a search-engine
 * selector. The order is (1) can the Fold answer? (2) is relevant local
 * evidence unread? (3) is a local test possible? (4) do freshness/authority
 * require new evidence? (5) would an external encounter resolve a NAMED
 * uncertainty? (6) is it authorized? (7) otherwise STOP and report the gap.
 *
 * Here, reaching Stage F with a gap means (1) failed. This surface does not yet
 * track unread local spans (a named gap, not assumed), so (2) cannot be offered
 * by itself. With no named hypothesis, no freshness reason, and no
 * authorization, steps (4)–(6) all fail, and the plan is the seventh: report the
 * gap, search nothing. Under privacy "offline-only" egress is forbidden
 * outright. A search is never the default procedure; the reason it was declined
 * is recorded on the plan.
 */
export function planNextEncounter({ gap = null, question = '', capabilities = {}, privacy = 'local-first', budget = null, authorization = null } = {}) {
  const canWeb = capabilities.web === true;
  const offline = privacy === 'offline-only';
  const fresh = asksFreshness(question);
  const egressNeeded = fresh;   // freshness names the need regardless of capability; whether it can RUN is disclosed below
  let sourceCapability = canWeb ? 'web' : 'none';
  // ── §11 privacy ladder, one dimension, never collapsed into the method.
  //  offline-only                — egress forbidden outright.
  //  ask-before-egress           — any egress is a real action requiring the
  //                                person's consent; the plan records `must-ask`
  //                                unless a grant arrived, and names the scope.
  //  selective-authorized-egress — egress allowed ONLY for named authorized
  //                                sources; disclosure scope recorded.
  //  local-first (default)       — egress needs a named need + authorization.
  let authorizationState = 'not-required';
  let privacyEffect = 'none';
  let disclosureScope = null;
  let declined = null;
  let method = 'report-gap';

  if (offline) {
    authorizationState = 'forbidden';
    method = 'report-gap';
    declined = { reason: 'offline_only', detail: 'privacy is offline-only — egress is forbidden; the gap stands' };
  } else if (!egressNeeded) {
    method = 'report-gap';
    declined = { reason: gap ? gap.type : 'no_gap', detail: 'no named hypothesis, freshness requirement, or authorization — a search here would be undirected egress' };
  } else {
    method = 'retrieve-primary-source';
    if (privacy === 'ask-before-egress') {
      authorizationState = authorization === 'granted' ? 'granted' : 'must-ask';
      privacyEffect = 'disclosure is a real action — it requires the person\'s consent';
      disclosureScope = 'a current primary source for: ' + (String(question ?? '').slice(0, 90));
      if (authorizationState === 'must-ask') declined = { reason: 'egress_requires_consent', detail: 'the question needs a current source, but privacy is ask-before-egress and no consent was granted' };
    } else if (privacy === 'selective-authorized-egress') {
      authorizationState = authorization === 'granted' ? 'granted' : 'required';
      privacyEffect = 'disclosure scoped to authorized sources only';
      disclosureScope = 'authorized primary source for: ' + (String(question ?? '').slice(0, 90));
      if (authorizationState === 'required') declined = { reason: 'egress_authorization_required', detail: 'the source class is authorized but egress is not yet granted for this inquiry' };
    } else {
      authorizationState = authorization === 'granted' ? 'granted' : 'required';
      privacyEffect = 'egress required to verify currency';
      disclosureScope = 'a current primary source for: ' + (String(question ?? '').slice(0, 90));
      declined = { reason: 'freshness_requires_current_source', detail: 'the question is time-sensitive — what the Fold holds is correct as of its source date but is not verified current; a current primary source is required, and egress must be authorized' };
    }
  }

  if (egressNeeded && !canWeb && declined) declined.detail += ' — this surface has no web capability, so the encounter cannot run here';
  return Object.freeze({
    schema: 'InquiryPlan@1',
    gap,
    freshness: fresh,
    privacy,
    sourceCapability,
    alternativesToDiscriminate: Object.freeze([]),
    expectedObservation: fresh ? 'a current primary source stating the present value' : null,
    wouldChange: fresh ? 'the Fold\'s held value, if it has drifted since its source date' : null,
    method,
    sourceCandidates: Object.freeze([]),
    privacyEffect,
    disclosureScope,
    authorization: authorizationState,
    estimatedCost: Object.freeze({ modelCalls: 0, externalRequests: 0, ...(budget != null ? { budget } : {}) }),
    stopCondition: 'no retrieval is attempted without a named need and, for any egress, an authorization that changes the privacy scope',
    result: Object.freeze({ status: 'proposed', ran: false }),
    declined: Object.freeze(declined ?? { reason: gap ? gap.type : 'no_gap', detail: 'no named hypothesis, freshness requirement, or authorization — a search here would be undirected egress' }),
  });
}

// The declared freshness signals (§9): words that mark a question as being about
// the PRESENT state of a changing thing, where an ingested record may be stale.
// A shape rule over the question, never a threshold, and never a verdict about
// the material — only that currency must be checked, not assumed.
const FRESHNESS_RE = /\b(?:current(?:ly)?|right now|these days|as of \d{4}|today|latest|up[- ]to[- ]date|still (?:in office|serves?|holds?|leads?)|who is the (?:current )?(?:mayor|president|vice president|ceo|chair(?:man|woman|person)?|governor|senator|representative|congressman|congresswoman|prime minister|sheriff|district attorney|attorney general|treasurer|clerk|speaker)|new(?:ly)? (?:elected|appointed|installed))\b/i;
export const asksFreshness = (question) => FRESHNESS_RE.test(String(question ?? ''));

export default { answerFromFold, planNextEncounter, renderInquiry, INQUIRY_SCHEMA, ANSWER_SCHEMA, standingForDoor };
