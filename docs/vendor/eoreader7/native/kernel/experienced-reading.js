import { createRecursiveReader } from "./reading.js";

const freeze = (value) => Object.freeze(value);

function priorKey(prior, index) {
  return prior?.id ?? `${prior?.schema ?? "prior"}:${prior?.giver ?? prior?.provenance?.giver ?? index}`;
}

export function mergeReceivedPriors(...groups) {
  const out = new Map();
  let index = 0;
  for (const group of groups) {
    for (const prior of group ?? []) {
      if (!prior) continue;
      const key = priorKey(prior, index++);
      if (!out.has(key)) out.set(key, prior);
    }
  }
  return freeze([...out.values()]);
}

/**
 * Assemble the same recursive reader with a pre-existing experiential history.
 *
 * The prior is inserted into Fold orientation at sequence 0 and also supplied
 * through the ordinary prior channel. It is never inserted into witnessed or
 * graphEntries. This is the explicit "this is not my first book" assembly.
 */
export function createPriorConditionedReader({ seed = {}, priors = [], ...options } = {}) {
  const receivedPriors = mergeReceivedPriors(seed?.receivedPriors ?? [], priors);
  return createRecursiveReader({
    ...options,
    priors: receivedPriors,
    seed: {
      ...seed,
      receivedPriors,
    },
  });
}
