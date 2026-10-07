/* Huginn speaks:
 * “Huginn  and  Muninn         hover  each  day 

The  wide  earth  over; 
I  fear  for  Huginn         lest  he  fare  not  back, — 

Yet  watch  I  more  for  Muninn."”
 *
 * This file, `eoreader7/native/organs/huginn.js`, implements the concept of Huginn, one of Odin's two ravens, as a component of the recursive reader.  It's a crucial part of the system's ability to perceive and understand the world, but I believe its implementation should prioritize  the  clarity  of  its  underlying  logic  and  its  ability  to  be  read  and  understood  by  humans  before  being  used  to  power  complex  calculations.
 *
 * — the engineering record below, kept whole —
 */
// huginn.js — Huginn, the watcher of model prioritization, under heimdall.
//
// Handle: Huginn ("thought") — one of Odin's two ravens, who fly out over
// the world every day and bring back what they saw. The other is Muninn
// ("memory"); together they are what the Allfather does not have to see
// himself. Here Huginn is the one who watches WHICH MODEL ANSWERS WHICH
// JOB, carries the measured account of it back, and says which one to use
// next — the prioritizer, never the bridge.
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it. Here: HUGINN (thought — the prioritizer), the first
// of the triad under heimdall. Heimdall is his boss: the bridge remains
// the archon of the outward
// flows — the surfaces, the steering, the admission, the re-forging, the
// box's own vitals. Huginn answers only one question, the one under the
// bridge: "of the models we can reach, which one for this job, and when
// it fails, which next?"
//
// The job is one question asked three times. The fold's model-routing.js
// names the chat rungs; heimdall's HEIMDALL_PATHS names the outward
// paths (vision, minds, mechanical); the room pool (matrix.js) names the
// mouths on other machines. Huginn owns the UNION — one register of job
// kinds both surfaces speak — and the DECISION over it, from one kind of
// evidence: what a candidate has actually done, measured. Nothing here
// is a preference dressed as a fact and nothing is a promise: a
// candidate with no measurement is scored at the mean of those that have
// been, so it is tried rather than starved or preferred — the pool's own
// discipline (matrix.js::pickMouth, P129), carried one level up so a
// LOCAL rung and a ROOM mouth compete on the same measured scale.
//
// "Smart about hopping models" is exactly this module, no more: a call
// may move from one candidate to the next, but only on a typed
// MACHINE-shaped failure (this repo's `machine`, or one of
// matrix.js::ROOM_FALLBACK_KINDS). A wrong answer never hops — it is the
// caller's, not a missing machine (P129). A hop is always recorded,
// never a silent re-run. A requester never hops to the machine it is
// itself serving. A pinned pick is never overridden by the ladder: a
// machine the person picked is pinned through every routing decision of
// a turn (P129 #5, isPinnedModel), and the specialist a pass chose for
// its own job is pinned the same way — it hops only on failure, never on
// ranking.
//
// PURE: no fetch, no DOM, no storage. The evidence is injected; the
// crossing (app.js) owns the network, the pool, and the persistence.

// The room's machine-shaped failure kinds — a closed class matrix.js (the
// surface) owns as ROOM_FALLBACK_KINDS and this organ mirrors rather than
// imports: an organ never imports a surface. The two lists are pinned equal
// by the-fold's huginn.test.mjs, so drift is a failing test, not a quiet hole.
const ROOM_FALLBACK_KINDS = Object.freeze(["gpu", "device-lost", "stalled", "quota", "offline", "network"]);

/** The one register of jobs a model can answer. Both surfaces speak it:
 *  the chat (model-routing.js's ROUTE_KINDS) and the outward flows
 *  (heimdall's HEIMDALL_PATHS kinds, `mind` normalised to `minds`). */
export const JOB_KINDS = Object.freeze({
  /** The grammar-constrained summary refresh after a token-spending turn. */
  SUMMARY: "summary",
  /** A plain chat turn: one part, nothing the small model can't carry. */
  FLAT: "flat",
  /** Work that spends the person's chosen model: /task, decomposed, /bound, /reflect. */
  DEEP: "deep",
  /** The fast draft pass of the two-pass turn (S1). */
  S1: "s1",
  /** The checked pass of the two-pass turn (S2). */
  S2: "s2",
  /** The witness/select asks (buildWitnessMessages/buildSelectMessages). */
  WITNESS: "witness",
  /** Heimdall's outward vision paths (moondream, qwen2.5vl). */
  VISION: "vision",
  /** Heimdall's reasoning minds. */
  MINDS: "minds",
  /** Heimdall's mechanical paths (tesseract OCR). */
  MECHANICAL: "mechanical",
});

/** What a candidate is: a local rung, an in-tab engine, a CPU rung, or a
 *  mouth on another machine reached through a room. */
export const CANDIDATE_KINDS = Object.freeze({
  OLLAMA: "ollama",
  WEBLLM: "webllm",
  TF: "tf",
  ROOM: "room",
});

/** The typed failures a call may HOP on. A wrong answer is not among
 *  them: it is the caller's. `machine` is this repo's own typing for
 *  "the model was unreachable at all"; the rest are
 *  matrix.js::ROOM_FALLBACK_KINDS, reused rather than re-derived. */
// `unserved` (2026-09-22, user: "develop a backup where it falls back to
// webllm if the ollama fails … and a CPU fall back is better than nothing"):
// the box answered, and its answer was that it cannot serve this call —
// Heimdall's 503 model_unavailable / memory_pressured, any 5xx, or a 429
// the caller has judged not worth waiting out. Distinct from `machine`
// (nothing answered at all) and from a wrong answer (never a hop): the
// machine is there, the model is not, so the next rung on the ladder —
// a room mouth, then the in-tab GPU rung, then the in-tab CPU rung — is
// asked, in that order, and every hop lands on the record.
export const HOP_FAILURE_KINDS = Object.freeze(["machine", "unserved", ...ROOM_FALLBACK_KINDS]);
export const hopEligible = (kind) => HOP_FAILURE_KINDS.includes(kind);

/** The EWMA weight on a new wall-time observation, received (giver:
 *  heimdall's own `recordTurnMs`, 0.6 old / 0.4 new) — the bridge's
 *  measurement discipline applied to the prioritizer's. */
export const EWMA_ALPHA = 0.4;

// ── candidates ──────────────────────────────────────────────────────────

/** A local candidate: id is the model name it answers with. */
export function candidateOf(model, kind = CANDIDATE_KINDS.OLLAMA) {
  const id = String(model);
  return Object.freeze({ id, kind, model: id });
}

/** A room candidate: `user` is `@who:server`. A model-carrying candidate
 *  has id `room:@who:server <model>` — the exact shape isPinnedModel
 *  (model-routing.js) recognizes, so a picked room mouth is honoured
 *  everywhere a pick is honoured. `model: null` is the machine's own
 *  fastest, the failover form; it is never a pinned pick. */
export function roomCandidateOf(user, model = null) {
  const u = String(user).replace(/^@/, "");
  return Object.freeze({
    id: `room:@${u}${model ? ` ${model}` : ""}`,
    kind: CANDIDATE_KINDS.ROOM,
    user: `@${u}`,
    model,
  });
}

/** Flatten a room's mouth offers into candidates, one per offered model.
 *  A mouth offering nothing offers no candidate. */
export function roomCandidatesFrom(offers = []) {
  const out = [];
  for (const o of offers ?? []) {
    if (!o || !Array.isArray(o.models) || !o.models.length) continue;
    for (const m of o.models) out.push(roomCandidateOf(o.user, m));
  }
  return out;
}

// ── evidence: what a candidate has actually done, measured ───────────────

export function emptyEvidence() {
  return Object.freeze({});
}

/** Land one observation onto the evidence fold. A completed call lands
 *  meanMs (EWMA, heimdall's weight); a failed call lands the failure kind
 *  so the next prioritise can read what actually happened. Returns a NEW
 *  fold, never mutates. */
export function huginnObserve(evidence, { candidateId, jobKind = JOB_KINDS.FLAT, ms = null, ok = false, failureKind = null }) {
  if (!candidateId) return evidence;
  const prev = evidence[candidateId] ?? { meanMs: null, n: 0, ok: 0, failed: 0 };
  const next = {
    meanMs:
      ms != null && Number.isFinite(ms) && ms > 0
        ? prev.meanMs == null
          ? Math.round(ms)
          : Math.round((1 - EWMA_ALPHA) * prev.meanMs + EWMA_ALPHA * ms)
        : prev.meanMs,
    n: prev.n + 1,
    ok: prev.ok + (ok ? 1 : 0),
    failed: prev.failed + (ok ? 0 : 1),
  };
  if (failureKind) next.lastFailure = failureKind;
  next.lastJobKind = jobKind;
  return Object.freeze({ ...evidence, [candidateId]: Object.freeze(next) });
}

// ── the decision: which candidate, and why ───────────────────────────────

/**
 * Rank the candidates for a job and return the pick and the full order.
 *
 * Priority, top to bottom:
 *   1. PINNED — a candidate the person (or the pass) chose. It is first,
 *      and only a typed failure may move the call off it. A pinned pick
 *      is never overridden by a ladder (P129 #5).
 *   2. PREFERRED — a standing device-shape decision, not the person's
 *      pick: a device that cannot run its own model well (no Ollama, only
 *      in-tab rungs) hands the turn to a room mouth first, its own rung
 *      after. This is the 2026-09-11 "roll over to my desktop" direction,
 *      expressed as an order, not a measurement.
 *   3. SHORTEST EXPECTED WAIT — in-flight calls × that candidate's
 *      measured mean wall time. A candidate nobody has timed is scored at
 *      the mean of those that have been (1 when none), so it is tried
 *      rather than starved or preferred — pickMouth's rule, one level up.
 *
 * `selfServing` is the requester's own mouth user: a worker answering the
 * room must never pick itself, so its candidates are dropped outright.
 * `inflight`/`meanMs` are the caller's measured maps (the room pool for
 * mouths, the pace/evidence for local rungs); several candidates of one
 * machine may share a lane — that is the caller's bookkeeping.
 */
/** A candidate is the serving requester when a room candidate's USER is the
 *  serving user, or a local candidate's id is the serving id — a worker
 *  answering the room must never hand a job back to itself. */
export const isSelfServed = (c, selfServing) =>
  !!c && !!selfServing && (c.kind === CANDIDATE_KINDS.ROOM ? c.user === selfServing : c.id === selfServing);

export function huginnPrioritize(jobKind = JOB_KINDS.FLAT, { candidates = [], pinned = null, prefer = null, inflight = {}, meanMs = {}, selfServing = null } = {}) {
  const list = (candidates ?? []).filter((c) => c && !isSelfServed(c, selfServing));
  if (!list.length) return { pick: null, order: [], why: "no_candidates", jobKind };

  const pinnedHit = pinned != null && list.some((c) => c.id === pinned);
  if (pinnedHit) {
    const pick = list.find((c) => c.id === pinned);
    return { pick, order: [pick, ...list.filter((c) => c.id !== pinned)], why: "pinned", jobKind };
  }

  const preferHit = prefer != null && list.some((c) => c.id === prefer);
  if (preferHit) {
    const pick = list.find((c) => c.id === prefer);
    return { pick, order: [pick, ...list.filter((c) => c.id !== prefer)], why: "preferred", jobKind };
  }

  const timed = list.map((c) => meanMs[c.id]).filter((v) => Number.isFinite(v) && v > 0);
  const typical = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : 1;
  const waitOf = (c) =>
    (inflight[c.id] ?? 0) * (Number.isFinite(meanMs[c.id]) && meanMs[c.id] > 0 ? meanMs[c.id] : typical);
  const order = list
    .slice()
    .sort((a, b) => waitOf(a) - waitOf(b) || list.indexOf(a) - list.indexOf(b));
  return { pick: order[0], order, why: "shortest_expected_wait", jobKind };
}

/** The next candidate after a typed failure, or a typed refusal. Only a
 *  hop-eligible failure moves a call; `tried` is the candidate ids this
 *  call has already attempted, so a hop can never loop back onto one. */
export function huginnHopAfter(failureKind, { order = [], tried = [], selfServing = null } = {}) {
  if (!hopEligible(failureKind)) {
    return { hop: null, refused: { type: "not_a_hop", reason: `a ${failureKind} outcome is the caller's, never a hop` } };
  }
  const next = (order ?? []).find((c) => c && !tried.includes(c.id) && !isSelfServed(c, selfServing));
  if (!next) return { hop: null, refused: { type: "no_hop", reason: "no untried candidate remains for this call" } };
  return { hop: next, refused: null };
}

/** The record line for a prioritisation or a hop. Pure; the caller stamps
 *  the time and lands it on the record. `order` names the whole ladder
 *  the decision was made over, so a hop is never a silent re-run. */
export function huginnDecision({ act = "prioritize", jobKind = JOB_KINDS.FLAT, pick = null, why = null, from = null, order = [], refused = null } = {}) {
  const entry = { act: `huginn-${act}`, jobKind };
  if (pick) entry.pick = pick.id;
  if (from) entry.from = from.id;
  if (why) entry.why = why;
  entry.order = (order ?? []).map((c) => c.id);
  if (refused) entry.refused = refused;
  return entry;
}