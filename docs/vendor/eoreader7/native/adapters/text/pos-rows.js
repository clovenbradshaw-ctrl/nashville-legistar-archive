// adapters/text/pos-rows.js — ROWS FOR A LANGUAGE WITH NO PARSER. The shape
// Sullivan's cues read (morph-cues.js::cuesOf — form, class, neighbours,
// sentence, attached auxiliaries) built from the one thing every language
// in this house already has: a received POS prior (priors/pos-<lang>.json,
// POSPrior@1 — form → UPOS counts from a UD train split, giver named).
//
// WHY THIS EXISTS. clause-tense.js reads English through the Chomsky
// parser's rows. Hebrew, Ancient Greek and Arabic reads had no rows at all,
// so Sullivan's learned conventions for them (priors/morph-cues-{he,grc,
// ar}.json) sat unused — "non-English reads still have no tense typer"
// (2026-09-25). This closes that with what is honestly available and says
// what is not:
//   class     the form's DOMINANT UPOS in the prior — a type-level fact
//             about the form across the treebank, not a parse of this
//             sentence; a form the prior never saw gets the empty class,
//             and a cue conditioned on class then cannot fire (Void, not a
//             guess)
//   sentence  the LEDGER's own sentence spans (the reader's splitter), so
//             neighbour cues never cross a sentence the reader drew
//   head      null — there is no parse, so the `aux` cue (attached
//             auxiliaries) never fires here; the neighbour cues (left,
//             right, lclass, rclass) carry what a construction can carry
// Every row says so in `basis`.
//
// TOKENS are runs of letters, digits and the apostrophe family (the
// reader's own token regex, eot-jsonl.mjs), with Hebrew geresh/gershayim
// added so an abbreviation stays one token. Offsets are mapped through the
// caller's map (the origin's coordinates, toRaw, when the caller reads a
// normalised copy — the same lesson clause-tense.js learned).
export const SCHEMA = "POSRows@1";
export const BASIS = "class = dominant UPOS of the form in a received POSPrior@1 (type-level, not a parse); sentence = the ledger's own span; no heads, so no auxiliary cues";

const TOKEN = /[\p{L}\p{N}’'׳״]+/gu;

/** dominantUpos(posPrior, form) → the form's most-counted UPOS, or "" when the prior never saw it. */
export function dominantUpos(posPrior, form) {
  const dist = posPrior?.forms?.[String(form ?? "").toLowerCase()] ?? posPrior?.forms?.[String(form ?? "")];
  if (!dist) return "";
  let best = "", n = -1;
  for (const [upos, c] of Object.entries(dist)) if (c > n || (c === n && upos < best)) { best = upos; n = c; }
  return best;
}

/**
 * rowsFromPosPrior(text, posPrior, { map, sentences })
 *   text       the window being read
 *   posPrior   a POSPrior@1 ({ forms: { form: { UPOS: count } } })
 *   map        offset in text → ledger coordinate (default identity)
 *   sentences  [[start, end], …] in ledger coordinates — the ledger's own
 *              sentence lines; a token outside every span gets sentence -1
 * Returns rows: { i, id, form, lemma, upos, feats: "_", head: null,
 *   headIndex: -1, off, end, sentence, basis }.
 */
export function rowsFromPosPrior(text, posPrior, { map = (i) => i, sentences = null } = {}) {
  if (!posPrior?.forms) throw new TypeError("rowsFromPosPrior: a POSPrior@1 with a forms table is required — a class from nowhere is a guess");
  const rows = [];
  const spans = Array.isArray(sentences) ? sentences : null;
  let lastSentence = -1, idInSentence = 0;
  for (const m of String(text ?? "").matchAll(TOKEN)) {
    const off = map(m.index), end = map(m.index + m[0].length);
    let sentence = -1;
    if (spans) { const k = spans.findIndex((s) => s[0] <= off && off < s[1]); sentence = k; }
    else sentence = 0;
    if (sentence !== lastSentence) { idInSentence = 0; lastSentence = sentence; }
    idInSentence += 1;
    rows.push({
      i: rows.length, id: idInSentence, form: m[0], lemma: m[0], upos: dominantUpos(posPrior, m[0]), feats: "_",
      head: null, headIndex: -1, off, end, sentence, basis: BASIS,
    });
  }
  return rows;
}
