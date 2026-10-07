// native/adapters/text/vocabulary.js — the hearing-vocabulary subassembly:
// how a reading's vocabulary widens, each widening declaring its S9
// direction (low sets possible for high; high sets probability for low).
// Promoted out of eval/levers.mjs — an eval driver is not a subassembly,
// and inline driver logic is where the last three bugs of this shape hid.
//
//   boundAnchorSpans   HIGH -> LOW: a bound identity licenses a token
//                      position as a discovery anchor. The bare string
//                      licenses nothing (the refused nomination shape, S8).
//   agencyEvidence     HIGH -> LOW: measured acts select which recurring
//                      descriptors read as beings. AUX refused as witness
//                      (a copula never testifies its subject acts) — a
//                      refuse-only use of the received treebank.
//   (actClosure, adapters/text/morphology.js, is the LOW -> HIGH sibling:
//    the material's tokens are the possibility wall; the measured act
//    selects; the prior admits nothing.)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bound sentences (perspective-claims::bindNarrationFrames output) ->
 * positional anchors for discoverRelationVocab. Anchors every occurrence
 * of the BOUND pronoun token inside its own bound sentence's range;
 * offsets returned in the coordinate space of `text` (caller subtracts
 * its container offset before calling — one space in, one space out).
 */
export const boundAnchorSpans = (boundSentences = [], text = "") => {
  const spans = [];
  const seen = new Set();
  for (const b of boundSentences) {
    const from = b.start;
    const slice = text.slice(from, b.end);
    const re = new RegExp(`\\b${escapeRe(b.pronoun)}\\b`, "gi");
    let m;
    while ((m = re.exec(slice))) {
      const at = from + m.index;
      if (seen.has(at)) continue;
      seen.add(at);
      spans.push({ index: at, length: b.pronoun.length, anchor: b.referentId });
    }
  }
  return spans;
};

/**
 * How often each descriptor stands in the SUBJECT slot of a measured verb
 * that the treebank attests as VERB strictly ahead of AUX. Returns
 * Map(canonicalSurface -> count) — descriptorBeings' beingEvidence input.
 * `posForms` is the received POSPrior's `forms` table, used to REFUSE
 * auxiliary witnesses only (never to admit).
 */
export const agencyEvidence = (text, descriptors, verbs, { posForms } = {}) => {
  const agency = new Set([...verbs].filter((v) => {
    const f = posForms?.[v];
    return f && (f.VERB ?? 0) > (f.AUX ?? 0);
  }));
  const lower = String(text ?? "").toLowerCase();
  const out = new Map();
  for (const d of descriptors) {
    const re = new RegExp(`\\b${escapeRe(d)}\\s+([\\p{L}'’]+)`, "giu");
    let m, n = 0;
    while ((m = re.exec(lower)) && n < 50) { if (agency.has(m[1])) n += 1; }
    if (n > 0) out.set(d, n);
  }
  return out;
};
