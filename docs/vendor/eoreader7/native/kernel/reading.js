// kernel/reading.js — the reader's step chain: per encounter the void
// (receivedGround, the hub re-hollowed) admits a being (the spokes) and
// folds the difference the being made (the rim). THE WHEEL, one step:
// void → being → fold, 0 → n → 1 (native/docs/THE-WHEEL.md).
import { receivedGround, applyObservation, applyDelta, deltaFold, eoOperation, reconstruct } from "./fold.js";
import { READER_SELF } from "./self.js";
import { deriveOrientation } from "./orientation.js";
import { perceive as defaultPerceive } from "./perception.js";
import { witnessVerbose as defaultWitnessVerbose } from "./witness.js";
import { relevantNeighborhood, interrogateCube, deriveEOTransformations } from "./interrogation.js";
import { deriveSurprise, deriveTension, deriveRelease } from "./dynamics.js";
import { buildHypergraph, indexHypergraphEntries } from "./hypergraph.js";
import { createReadingTaskState, proposeObligationTasks, wakeTasks, appendTaskResult, executeClarificationTask, scheduleTasks } from "./reading-tasks.js";
import { projectTasks } from "./task-log.js";

export function encounter(value) { return Object.freeze({ schema: "Encounter@1", ...value }); }

/** Constitutive perturbation: every nominated candidate passes through this stage before witness. */
export async function challengeCandidates(currentEncounter, orientation, candidates, { challengers = [] } = {}) {
  let frontier = [...candidates];
  const challenges = [];
  for (const challenger of challengers) {
    const result = await challenger.challenge?.({ encounter: currentEncounter, orientation, candidates: frontier });
    if (!result) continue;
    challenges.push(Object.freeze({ challenger: challenger.id ?? "anonymous", result }));
    if (Array.isArray(result.candidates)) frontier = result.candidates;
  }
  return Object.freeze({ schema: "EOChallengeFrontier@1", candidates: Object.freeze(frontier), challenges: Object.freeze(challenges) });
}

// A refusal witness() would have silently dropped, landed on the record.
// lexicon.js names the terrain by hand: "Void: refusals and typed gaps
// (exclusions, unresolved alternatives)". Void is terrain (domain, grain) =
// (Existence, Ground) — cube.js's `cellOf` — and DEF's domain is
// Interpretation (its Ground cell is Atmosphere, never Void; identity.js's
// own exclusion, `op: "DEF", grain: "Figure"`, is a different act — retracting
// an ALREADY-ADMITTED identity reading, and lands at Lens by design, not
// here). Existence-domain operators are NUL, SIG, INS; `eoOperation` itself
// refuses a NUL carrying any mutating payload ("NUL records no
// transformation") — and rightly: a refusal is a real, witnessed act, not
// nothing happening. `docs/THE-27-CELLS.md`'s own SIG·Ground row
// (`void-loop.js::whatWouldSettle`, `surfaces.js`'s CELL) is exactly this
// shape already: SIGNING what the ground does not (yet) hold. So: SIG·Ground.
const exclusionOperationFor = (refusal, enc, index) => {
  const candidateId = refusal?.candidate?.id ?? refusal?.candidate?.candidate?.id ?? null;
  const outputId = `exclusion:${enc.sequencePosition ?? "?"}:${index}`;
  return eoOperation({
    id: `${outputId}:op`,
    op: "SIG",
    grain: "Ground",
    witness: refusal?.candidate?.evidence ?? refusal?.candidate?.anchor ?? null,
    outputs: [outputId],
    consequence: { kind: "witness_refused", reason: refusal?.reason ?? "refused" },
    payload: {
      action: "exclusion",
      value: Object.freeze({
        schema: "EOExclusion@1",
        id: outputId,
        kind: "witness_refused",
        target: candidateId,
        reason: refusal?.reason ?? "refused",
        encounter: enc.sequencePosition ?? null,
      }),
    },
  });
};

const observationGraph = (o) => [o, ...(o?.hyperedges ?? []), ...(o?.graphEntries ?? [])];
const deltaGraph = (delta, fold) => (delta?.operations ?? []).flatMap((op) => {
  const out = [op];
  if (op?.payload?.value?.id) out.push(op.payload.value);
  if (op?.payload?.action === "resolve-obligation" && op.payload.id) {
    const revised = (fold?.obligations ?? []).find((x) => x?.id === op.payload.id);
    if (revised) out.push(revised);
  }
  return out;
});

export function createRecursiveReader({ seed = {}, priors = [], perceivers = [], challengers = [], adapters = {}, taskLog = null, taskOrientationBudget = 24, taskExecutionBudget = 4 } = {}) {
  if (!Number.isInteger(taskOrientationBudget) || taskOrientationBudget < 0) throw new TypeError("taskOrientationBudget must be a non-negative integer");
  if (!Number.isInteger(taskExecutionBudget) || taskExecutionBudget < 0) throw new TypeError("taskExecutionBudget must be a non-negative integer");
  // THE SELF, AT BIRTH (kernel/self.js): what the reader is, sealed. The
  // seed may carry its own `self` — it is refused, never merged: the reader
  // is born with READER_SELF or it is not born. This is not a parameter,
  // not a prompt, and not a surface; the ground carries it from sequence 0.
  let fold = receivedGround({ ...seed, self: READER_SELF });
  let tasks = createReadingTaskState(taskLog);
  tasks = proposeObligationTasks(tasks, fold).log;
  const log = [];
  const graphIndex = buildHypergraph([...(fold.graphEntries ?? []), ...(fold.expectations ?? []), ...(fold.obligations ?? []), ...(fold.activeFrames ?? []), ...(fold.unresolvedAlternatives ?? []), ...(fold.transformationObjects ?? [])]);

  async function step(input) {
    const currentEncounter = input?.schema === "Encounter@1" ? input : encounter(input);
    const beforeFold = fold;
    const liveTasksBefore = projectTasks(tasks);
    const orientationTasks = scheduleTasks(liveTasksBefore, beforeFold, { limit: taskOrientationBudget });
    const orientation = deriveOrientation(beforeFold, { tasks: orientationTasks });
    const candidates = await (adapters.perceive ?? defaultPerceive)(currentEncounter, orientation, { perceivers, priors: [...(orientation.receivedPriors ?? []), ...priors] });
    const challenge = adapters.challenge ? await adapters.challenge({ encounter: currentEncounter, orientation, candidates }) : await challengeCandidates(currentEncounter, orientation, candidates, { challengers });
    const challengedCandidates = challenge?.candidates ?? candidates;
    // Backward-compatible on the witness adapter's own return shape: a bare
    // array (witness()'s existing contract — e.g. a caller-supplied
    // adapters.witness, as tests/fold-transient.test.js's does) carries no
    // refusal list, so `refused` stays null (never a fabricated []) and
    // `witnessContract` discloses "bare-array, refusals unknown" — a caller
    // gating on refusals must read the contract, not `refused.length`. The
    // DEFAULT adapter now calls witnessVerbose() instead of witness() — same
    // admission logic, so `observations` is byte-identical either way — which
    // is what makes a refusal list available to fold into exclusions
    // (`witnessContract` is then "verbose").
    const witnessResult = await (adapters.witness ?? defaultWitnessVerbose)(currentEncounter, challengedCandidates, { admit: adapters.admit });
    const witnessContract = Array.isArray(witnessResult) ? "bare-array, refusals unknown" : "verbose";
    const observations = Array.isArray(witnessResult) ? witnessResult : (witnessResult?.observations ?? []);
    const refused = Array.isArray(witnessResult) ? null : (witnessResult?.refused ?? null);

    indexHypergraphEntries(graphIndex, observations.flatMap(observationGraph));
    const awakenedTasks = wakeTasks(orientationTasks, observations);
    const scheduledTasks = scheduleTasks(awakenedTasks, beforeFold, { limit: taskExecutionBudget });
    const taskEvidence = [];
    const executeTask = adapters.executeTask ?? executeClarificationTask;
    for (const task of scheduledTasks) {
      const result = await executeTask({ task, encounter: currentEncounter, observations, fold: beforeFold, orientation, graph: graphIndex });
      if (!result) continue;
      tasks = appendTaskResult(tasks, task, result);
      taskEvidence.push(Object.freeze({ schema: "TaskEvidence@1", id: `task-evidence:${task.task_id}:${currentEncounter.sequencePosition ?? log.length}`, taskId: task.task_id, obligationId: task.obligation_id ?? null, strategy: result.strategy ?? task.strategy ?? "clarify", questions: Object.freeze([...(result.questions ?? task.questions ?? [])]), disposition: result.disposition ?? "unresolved", evidence: Object.freeze([...(result.evidence ?? [])]), candidates: Object.freeze([...(result.candidates ?? [])]), depth: result.depth ?? null, detail: result.detail ?? null }));
    }

    indexHypergraphEntries(graphIndex, taskEvidence);
    const neighborhood = (adapters.retrieve ?? relevantNeighborhood)(beforeFold, [...observations, ...taskEvidence], { select: adapters.selectNeighborhood, graph: graphIndex });
    const interrogation = await (adapters.interrogate ?? interrogateCube)([...observations, ...taskEvidence], neighborhood, { ask: adapters.ask });
    const proposedDelta = adapters.revise ? await adapters.revise({ observations, taskEvidence, neighborhood, interrogation, fold: beforeFold, tasks: projectTasks(tasks), graph: graphIndex }) : deriveEOTransformations(interrogation, { id: `delta:${currentEncounter.sequencePosition ?? log.length}` });
    const canonicalDelta = proposedDelta?.schema === "DeltaFold@1" ? proposedDelta : deltaFold([]);

    // THE LATENT-LEAN HOOK (optional, additive). `adapters.latent` is never
    // required and the kernel never imports one — see eo-teachings/archon-
    // activation.mjs for a real, OUT-OF-TREE example of `{ use(acts), bias() }`.
    // `use()` is handed this step's own operations (the authored delta's, not
    // the refusal side-channel below) so it can update whatever it tracks;
    // `bias()`'s return rides the TURN as `latentLean`, never the fold — a
    // lean conditions attention and must never become evidence
    // (orientation.js's own rule, Handle: Meerkat: "a raised stance that
    // conditions the group's attention and is never itself evidence of what
    // it's watching for"). When adapters.latent is absent, `latentLean` is
    // simply not a key on the returned turn — full backward compatibility.
    let latentLean;
    if (adapters.latent) {
      await adapters.latent.use(canonicalDelta.operations ?? []);
      latentLean = await adapters.latent.bias();
    }

    // WITNESS REFUSALS, FOLDED INTO THE VOID (additive, only when `refused`
    // is available — see the witness call above). Each refusal becomes its
    // own SIG·Ground operation (exclusionOperationFor, above) in a SEPARATE
    // delta from `canonicalDelta`: kept apart so a turn with no refusals is
    // BYTE-IDENTICAL to before this change (canonicalDelta, `turn.surprise`,
    // `turn.deltaFold` all untouched), and so `fold.sequence` only advances
    // an extra step on the turns that actually have something to exclude.
    const refusalOperations = refused ? refused.map((r, i) => exclusionOperationFor(r, currentEncounter, i)) : [];
    const exclusionDelta = refusalOperations.length
      ? deltaFold(refusalOperations, { id: `delta:exclusions:${currentEncounter.sequencePosition ?? log.length}`, schemaVersion: "EOWitnessRefusal@1" })
      : null;

    log.push(currentEncounter, ...observations, ...taskEvidence, canonicalDelta, ...(exclusionDelta ? [exclusionDelta] : []));
    let nextFold = beforeFold;
    // (P166) The reader declares its chain transient: nothing reads a superseded
    // fold — see the accessor below and fold.js's delta-stream header.
    for (const observation of observations) nextFold = applyObservation(nextFold, observation, { transient: true });
    nextFold = applyDelta(nextFold, canonicalDelta, { transient: true });
    if (exclusionDelta) nextFold = applyDelta(nextFold, exclusionDelta, { transient: true });
    fold = nextFold;
    // (P166) The fold's arrays are extended IN PLACE along the reader's linear
    // chain, so this turn's `fold` is the tip only while it is the tip. Once
    // superseded, the turn's fold is the log's projection at this seq (P159:
    // the log is the record, the fold is state) — reconstructed on demand,
    // never retained. Byte-identity of that projection with the live fold is
    // what read-cost.mjs --identity and --trace pin.
    const tip = fold;
    const at = log.length;
    indexHypergraphEntries(graphIndex, deltaGraph(canonicalDelta, fold));
    if (exclusionDelta) indexHypergraphEntries(graphIndex, deltaGraph(exclusionDelta, fold));
    const taskUpdate = proposeObligationTasks(tasks, fold); tasks = taskUpdate.log;

    return Object.freeze({ encounter: currentEncounter, orientation, candidates, challenge, observations, refused: refused == null ? null : Object.freeze(refused), witnessContract, awakenedTasks, scheduledTasks, taskEvidence, proposedTasks: taskUpdate.proposed, tasks: Object.freeze(projectTasks(tasks)), relevantFold: neighborhood, interrogation, deltaFold: canonicalDelta, get fold() { return fold === tip ? tip : reconstruct(log.slice(0, at), seed); }, surprise: deriveSurprise(canonicalDelta), tension: deriveTension(fold), release: deriveRelease(canonicalDelta, beforeFold, fold), ...(adapters.latent ? { latentLean } : {}) });
  }

  async function read(encounters = []) { const turns = []; for (const item of encounters) turns.push(await step(item)); return Object.freeze({ turns, fold, tasks: Object.freeze(projectTasks(tasks)), taskLog: tasks, log: [...log] }); }
  return Object.freeze({
    self: READER_SELF,
    step,
    read,
    async restore(entries = []) { for (const perceiver of perceivers) await perceiver.restore?.(entries); },
    getFold: () => fold,
    getTasks: () => Object.freeze(projectTasks(tasks)),
    getTaskLog: () => tasks,
    getLog: () => [...log],
  });
}
