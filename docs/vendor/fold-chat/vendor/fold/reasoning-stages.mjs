// reasoning-stages.mjs — THE LADDER: the stages of real reasoning, from the
// suite's own record (the-stages-of-real-reasoning.md). Not a faculty and not a
// method — a chain of typed gates, each with what it may NOT do and an artifact
// that proves it ran. The document is explicit that a rule only written is not a
// stage: "unwired is failing; an article whose flag nothing sets is refuted, not
// early" (FOLD-CONSTITUTION.md:477-479). So this file is only half of a stage if
// nothing calls it — the loop must actually run each gate and a gate must have
// something it rejects.
//
// THE ESSAY'S OWN FALSIFYING CONTROL, which is the reason this module exists:
// "an unfalsified gate reports `unmeasured`, never `pass`, and 'passed on 0 rows'
// is a distinct state from 'passed'" (FOLD-CONSTITUTION.md:221-228; the essay's
// stage 12). gateVerdict() encodes exactly that, and its test fires the control:
// a gate that has never rejected anything can never report pass.
//
// The essay is one reading, not a converged swarm (its own scar, lines 185-193):
// the stages are what the artifacts say; the ORDER is the author's reading and
// has not been attacked. We keep the order and keep the doubt on it.

export const LADDER_SCHEMA = "ReasoningLadder@1";

// The 13 stages (0–13), each: id, n, gate, mayNot, proof, ref.
export const STAGES = Object.freeze([
  { n: 0, id: "rebuild-ground", gate: "the answer must differ from what you would have said without looking", mayNot: "speak an answer identical to the unchecked one as if it were testimony", proof: "the delta between the unchecked answer and the looked one", ref: "SEED-SPEAKER.md:26-33" },
  { n: 1, id: "receive-not-derive", gate: "separate what was told from what was made up", mayNot: "derive the prior; let the model be the giver; carry a missing giver as a gap-in-waiting", proof: "the prior with its named giver, or the gap-in-waiting", ref: "FOLD-CONSTITUTION.md:80-93; SEED-SPEAKER.md:62-65" },
  { n: 2, id: "type-error-before-null", gate: "a question that cannot be stated is a wall", mayNot: "spend computation on an unstatable question", proof: "the typed wall, not a null", ref: "FOLD-CONSTITUTION.md:95-100; SEED-SPEAKER.md:89-91" },
  { n: 3, id: "settle-mechanical", gate: "arithmetic, logic, quantity: the organ computes it", mayNot: "draw model tokens for what computation decides", proof: "the computed cell and zero model tokens", ref: "content-rules.md:330-334" },
  { n: 4, id: "swarm-hard-meaning", gate: "independent framings collide; no single reading decides", mayNot: "report a confident meaning over a swarm that did not converge", proof: "the surviving reading with its evidence and the disclosed dissent", ref: "AGENTS.md §3; content-rules.md:266-273" },
  { n: 5, id: "null-by-reexecution", gate: "the null is the same computation re-run on perturbed input", mayNot: "write a second procedure and call it a null; forget the draws bound the claim", proof: "the re-run and the perturbation", ref: "FOLD-CONSTITUTION.md:119-146" },
  { n: 6, id: "register-prediction-first", gate: "the bet is recorded before the result", mayNot: "move a failed prediction to meet the result; let evidence tune the instrument", proof: "the registered prediction, timestamped before the result", ref: "FOLD-CONSTITUTION.md:148-161" },
  { n: 7, id: "falsify-hostilely", gate: "attack the claim against the material it should reject", mayNot: "declare a change good on its own say-so", proof: "the adversary's rejection, and the fix as the next thing to break", ref: "content-rules.md:142-154" },
  { n: 8, id: "descend-to-rows", gate: "every altitude reaches the material beneath it", mayNot: "assert at altitude what exists nowhere below", proof: "the descent to the rows (path:line, byte span)", ref: "FOLD-CONSTITUTION.md:102-117" },
  { n: 9, id: "bar-mouth-from-conclusion", gate: "a model phrases, orders, narrates, proposes", mayNot: "originate a fact; reason to a conclusion", proof: "the kernel derivation with its notes disclosed", ref: "FOLD-CONSTITUTION.md:208-219; content-rules.md:330-334" },
  { n: 10, id: "assign-standing-type-silence", gate: "measured / received / shown / refused; six silences, no two alike", mayNot: "render unknown and unchecked alike; report failure where a field is merely missing", proof: "a standing per proposition and a typed silence", ref: "FOLD-CONSTITUTION.md:46-71, :393-397, :412-424" },
  { n: 11, id: "render-readers-own-stage", gate: "draw the contrary slice, the absent thing, the anchor", mayNot: "rank by what the reader already accepts; score aperture", proof: "the drawn stage, including what would refute the reader", ref: "FOLD-CONSTITUTION.md:281-380" },
  { n: 12, id: "falsify-the-checker", gate: "a gate is verified against what it should reject", mayNot: "report pass from a gate nothing has ever failed", proof: "the counterexample the gate rejected", ref: "FOLD-CONSTITUTION.md:221-228" },
  { n: 13, id: "keep-read-nonconsuming", gate: "looking changes nothing", mayNot: "let re-execution be incommensurable with the run before it", proof: "the unchanged ground across a re-read", ref: "FOLD-CONSTITUTION.md:262-277" },
]);

export const STAGE_IDS = Object.freeze(STAGES.map((s) => s.id));
const BY_ID = new Map(STAGES.map((s) => [s.id, s]));
const BY_N = new Map(STAGES.map((s) => [s.n, s]));
export const stageOf = (idOrN) => BY_ID.get(idOrN) ?? BY_N.get(idOrN) ?? null;

/** The standings a proposition may carry (stage 10). */
export const STANDINGS = Object.freeze(["measured", "received", "shown", "refused"]);

/**
 * gateVerdict({ rows, rejected, failed }) — the stage-12 law made mechanical.
 *   rows 0            → "unmeasured"  (passed on 0 rows is not "passed")
 *   rejected 0        → "unmeasured"  (a gate nothing has ever failed)
 *   failed > 0        → "fail"
 *   otherwise         → "pass"
 * The falsifying control: there is no input with rejected === 0 that yields
 * "pass". A gate earns pass only by having rejected something.
 */
export function gateVerdict({ rows = 0, rejected = 0, failed = 0 } = {}) {
  if (failed > 0) return "fail";          // a failing gate is fail, whoever its rejections
  if (rows <= 0) return "unmeasured";     // passed on 0 rows is not "passed"
  if (rejected <= 0) return "unmeasured"; // a gate nothing has ever failed is not "passed"
  return "pass";
}

/** Route a turn by the constitution's own algorithm: Given? → Refused? →
 *  Grounded? → what remains is shown (FOLD-CONSTITUTION.md:77). The first test
 *  that answers it wins; an unstatable question is a typed wall (stage 2). */
export function route(turn = {}) {
  if (turn.statable === false) return { lane: "refuse", why: "the question cannot be stated — a wall, not a null" };
  if (turn.given != null) return { lane: "received", why: "the prior came from a named giver" };
  if (turn.refused === true) return { lane: "refused", why: "the turn is barred (e.g. II.9)" };
  if (turn.grounded != null) return { lane: "grounded", why: "the claim descends to byte-addressed spans" };
  if (turn.mechanical != null) return { lane: "mechanical", why: "the organ computes it" };
  return { lane: "shown", why: "what remains is shown, never measured" };
}

export default { LADDER_SCHEMA, STAGES, STAGE_IDS, STANDINGS, stageOf, gateVerdict, route };
