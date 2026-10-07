// One binding of the migrated retrieval organ to the Fold's own projections.
import { bindActivationRetrieval } from "../organs/activation-retrieval.js";
import { referentsOf, fold } from "./dialogue.js";
import { activeReferents, dmdCut, lensCut, DECLARED_LINES } from "./resolutions.js";

export const { activate, mentionBook } = bindActivationRetrieval({
  referentsOf, fold, activeReferents, dmdCut, lensCut, DECLARED_LINES,
});
