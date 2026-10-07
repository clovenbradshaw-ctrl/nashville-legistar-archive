// descriptor-lane.js — the lowercase lane's organs, assembled once.
//
// Case is one witness of a being. The others that need no capital letter are
// already in the reader: a recurring definite or possessive descriptor earns an
// EOIdentityHypothesis@1 (individuation.js). What was missing was the last
// step — letting one into the referent index — and the standing it must earn
// to get there. This gathers the three organs the fold needs, all received or
// measured, none of them a word list:
//
//   referentFrom  individuation.js::referentFromDescriptorHypothesis — definite
//                 or possessive only, provisional, revisable;
//   naming        nominal-beings.js::namingGate — the prior may REMOVE a head it
//                 settles as a verb or adjective, and a cue it leaves unsettled
//                 ("that") cannot carry an unseen head;
//   key           keyness.js — the head is said in THIS material significantly
//                 more than the received corpus says it (the exact binomial,
//                 5%, the instrument case's own significance test uses).
//
// No prior, no standing to earn, and a being admitted on recurrence alone floods
// (measured: 185 descriptors beside a 38-being cast on 30 KB of prose). A caller
// that asked for the lane and has no prior still gets a lane object — without
// `key` — so the fold reports `descriptorLane: "no_baseline"` and admits nothing,
// typed. Returning null here would read as "never asked" and hide the gap.
// The 5% resolution is keyness.js's KEY_ALPHA, declared once; it is not a dial.

import { referentFromDescriptorHypothesis } from "./individuation.js";
import { namingGate } from "./nominal-beings.js";
import { isKeyInMaterial, receivedRate } from "./keyness.js";

export function descriptorLane(posPrior) {
  if (!posPrior?.forms || !(Number(posPrior?.provenance?.tokens_read) > 0)) return Object.freeze({ referentFrom: referentFromDescriptorHypothesis });
  const rate = receivedRate(posPrior);
  return Object.freeze({
    referentFrom: referentFromDescriptorHypothesis,
    naming: namingGate(posPrior),
    key: (head, k, n) => isKeyInMaterial(k, n, rate(head)),
  });
}
