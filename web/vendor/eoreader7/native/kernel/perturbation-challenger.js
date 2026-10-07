// native/kernel/perturbation-challenger.js — the Challenge stage's first
// real challenger: a structural null-check, not a model call.
//
// reading.js's own header names the gap this closes: "every nominated
// candidate passes through this stage before witness" (challengeCandidates;
// createRecursiveReader's `challengers` array defaults to `[]`), and until
// now nothing shipped to fill it. witness.js's own header names why a stage
// is owed here at all — Handle: Thymus, "the organ where a candidate is
// presented and selected, not admitted on presentation alone: nomination is
// not admission." A candidate a perceiver PROPOSES is not yet a candidate
// the reading should KEEP, and nothing between perceive() and witness() has
// ever asked.
//
// NOT A MODEL WITNESS. The sibling engine checkout's own CLAUDE.md
// ("Corroboration count is a label that rides, not a permission that gates")
// already tried that door: "the one measurement this engine has puts [a
// model witness] at LR = 1.0" — a likelihood ratio of 1.0 moves belief by
// exactly nothing, however confident the prose. A challenger built on a
// second model call would inherit that same LR=1.0, dressed as adversarial
// review.
//
// THE RIGHT SHAPE: challenge a candidate by checking whether the SAME
// extraction, RE-RUN on a PERTURBED version of the SAME material, still
// nominates it. A candidate the material itself supports keeps reappearing
// under any reshuffling of that material; a candidate that is an artifact of
// the one specific arrangement — a spurious adjacency, an accidental
// ordering — depends on that arrangement and vanishes the moment it is
// destroyed. This is nul/index.js's own null logic (`pattern()`'s "did the
// figure move the ground further than it would have moved anyway", read at
// its coarsest, structural resolution — presence or absence, not a windowed
// statistic) asked of the EXTRACTION MECHANISM itself rather than of one
// numeric series.
//
// REUSED, NOT REINVENTED. `PERTURBATIONS.shuffle` is nul/index.js's own and
// arrives here INJECTED as `nul` — never a static import. `nul/` is a
// symlink to a sibling engine submodule and can be absent in a checkout that
// has not initialized it (see native/tests/measure-media.test.js's own
// existsSync guard); organs/measure.js states the standing convention this
// follows in so many words: "Pure, organs injected: `nul` ... arrive as
// arguments". Amendment I (nul/index.js) reads: "a statistic
// admitted to STATISTICS on the strength of one perturbation carries no
// ground for any other." The parallel claim here: an EXTRACTION admitted on
// the strength of one arrangement of the material carries no ground for any
// other, and this challenger is exactly the check that finds out.
//
// PLUGGABLE, NOT WIRED. This ships as a real, importable, tested challenger
// — `createRecursiveReader({ challengers: [createPerturbationChallenger({
// nul, extract, draws })] })` — and stops there. No production call site
// passes it today; wiring one in is a separate, deliberate decision this
// file does not make.

const defaultMaterialOf = (encounter) => {
  const value = encounter?.value;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split("");
  return null;
};

const defaultRebuildEncounter = (encounter, material) =>
  Object.freeze({ ...encounter, value: Array.isArray(encounter?.value) ? material : material.join("") });

const defaultKeyOf = (candidate) => JSON.stringify(candidate?.candidate ?? candidate);

/**
 * createPerturbationChallenger({ nul, extract, draws, ... }) — a challenger
 * object, `{ id, challenge({ encounter, orientation, candidates }) }`, the
 * exact shape `challengeCandidates` (reading.js) already calls.
 *
 *   nul       — REQUIRED, injected (see header). Needs at least
 *               `nul.PERTURBATIONS[perturbation]`.
 *   extract   — REQUIRED. `(encounter, orientation) -> candidates`, the SAME
 *               extraction that nominated the candidates being challenged
 *               (e.g. a perceiver's own `.perceive`, or a small wrapper
 *               around `perceive()` with the same perceiver set). Without
 *               it there is nothing to re-run, and re-running it is the
 *               whole mechanism.
 *   draws     — REQUIRED, no default. Per nul/index.js's own discipline
 *               ("the resolution of testimony is 1/draws and is never a
 *               default"): how many reshufflings a candidate must survive
 *               even one of is not a number this organ gets to invent.
 *   materialOf(encounter) — the array to perturb. Defaults to the
 *               encounter's own `.value`, split into characters if it is a
 *               string, used as-is if already an array. Override for any
 *               other shape of material (tokens, frames, samples — this
 *               organ is medium-blind by construction).
 *   rebuildEncounter(encounter, material) — wraps a perturbed material back
 *               into something `extract` accepts. Defaults to replacing
 *               `.value` (rejoined into a string if the original was one).
 *   keyOf(candidate) — a stable identity key so a re-nomination can be
 *               compared against the original. Defaults to
 *               `JSON.stringify(candidate.candidate ?? candidate)`.
 *   perturbation — a key into `nul.PERTURBATIONS` (default "shuffle" — nul's
 *               own default, and the general-purpose one: it destroys
 *               ARRANGEMENT while holding the multiset of the material fixed,
 *               which is exactly the axis "is this candidate an artifact of
 *               order" needs perturbed).
 *   seed      — nul's own default, 0. Determinism, not resolution — reused
 *               verbatim from nul/index.js::ground's own default.
 */
export function createPerturbationChallenger({
  id = "perturbation-null-challenger",
  nul,
  extract,
  materialOf = defaultMaterialOf,
  rebuildEncounter = defaultRebuildEncounter,
  keyOf = defaultKeyOf,
  perturbation = "shuffle",
  draws,
  seed = 0,
} = {}) {
  if (typeof extract !== "function")
    throw new TypeError("createPerturbationChallenger requires `extract` — the SAME extraction that nominated the candidates being challenged; without it there is nothing to re-run");
  if (!nul || typeof nul.PERTURBATIONS?.[perturbation] !== "function")
    throw new TypeError(`createPerturbationChallenger requires \`nul\` (nul/index.js, injected — never imported here; see native/tests/measure-media.test.js's own guard) carrying a "${perturbation}" perturbation`);
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("draws is declared and must be a positive integer — how many reshufflings a candidate must survive is never a default (nul/index.js: 'the resolution of testimony is 1/draws and is never a default')");

  const perturb = nul.PERTURBATIONS[perturbation];

  return Object.freeze({
    id,
    async challenge({ encounter, orientation, candidates = [] } = {}) {
      const material = materialOf(encounter);
      // Fewer than two elements: every "shuffle" is the identity, so there is
      // no room for a candidate to vanish INTO. A null of zero width is
      // refused rather than trusted (nul/index.js SEED.md #3) — no verdict is
      // manufactured from no room to move; every candidate passes untouched.
      if (!Array.isArray(material) || material.length < 2) {
        return Object.freeze({ candidates, attacks: Object.freeze([]), gap: "no_room_to_perturb" });
      }

      const survivingKeys = new Set();
      for (let d = 0; d < draws; d += 1) {
        const shuffled = perturb(material, seed + d);
        const renominated = await extract(rebuildEncounter(encounter, shuffled), orientation);
        for (const c of renominated ?? []) survivingKeys.add(keyOf(c));
      }

      const kept = [];
      const attacks = [];
      const detail = [];
      for (const candidate of candidates) {
        if (survivingKeys.has(keyOf(candidate))) {
          kept.push(candidate);
          continue;
        }
        // Never reappeared once the specific arrangement it depended on was
        // destroyed, across every one of `draws` independent reshufflings:
        // testimony about the arrangement, not about the material.
        attacks.push("vanishes_on_shuffle");
        detail.push(Object.freeze({ candidate, reason: "vanishes_on_shuffle", perturbation, draws }));
      }
      return Object.freeze({ candidates: Object.freeze(kept), attacks: Object.freeze(attacks), detail: Object.freeze(detail) });
    },
  });
}

export default createPerturbationChallenger;
