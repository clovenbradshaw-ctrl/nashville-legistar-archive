// native/adapters/text/gfp-relations-composed.js — THE COMPOSED READER, NO MODEL.
//
// Two model-free readers exist, each at its own grain:
//   RECURRENCE (relations-gfp.js) — figure-connector-figure arrangements over
//     the whole text; broad coverage, but the connector between two SPARSE
//     figure mentions can be a whole clause (measured: "NDOT —, includes a plan
//     to roll out→ No Turn").
//   POSITIONAL (relations-positional.js) — ONE main clause per sentence, roles
//     by position under a MEASURED RoleConfig@1; precise connector (the verb),
//     but narrow coverage (measured: 4 of 155 sentences on a real essay).
//
// COMPOSED: for each sentence, prefer the POSITIONAL clause's connector when
// the positional reader settles one (it names the head that does the
// connecting); otherwise fall back to the recurrence arrangement. Same public
// shape out ({end1, label, end2, cell, grain, polarity, offset}), so every
// downstream consumer is unchanged. Neither reader calls a model.
//
// REMEMBER REFERENTS: the referent index (`figures`) is passed IN, built once
// by the caller, so a read and its re-read measure the same beings.
import { extractGfpRelations } from "./relations-gfp.js";
import { relationExtractorsFor } from "./relations-language.js";
import { splitSentences } from "./spans.js";
import { clauseSpans } from "./clause-spans.js";

/**
 * composedRelations(text, { posPrior, figures, roleConfig, classifyWord,
 * dominantClass, minRec }) -> the composed arrangements, one list, same shape.
 * `roleConfig`/`classifyWord`/`dominantClass` enable the positional leg; absent
 * them the reader degrades to recurrence alone, disclosed.
 */
export function composedRelations(text, { posPrior = null, figures = null, roleConfig = null, classifyWord = null, dominantClass = null, verbForms = null, minRec = 2, clauseAware = true } = {}) {
  const body = String(text ?? "");
  // the recurrence leg: the arrangement yield over the whole text
  const recurrence = extractGfpRelations(body, { posPrior: null, figures, minRec, clauseAware });

  // the positional leg: one clause per read, its connector the precise head.
  // Measured wall (2026-10-02): per SENTENCE the reader refuses 47/60 real
  // sentences as `ambiguous_verb` — a sentence holds several clauses and the
  // reader honestly reads ONE. Splitting by the engine's OWN clause spans
  // first (clause-spans.js, the same organ the GFP leg's clauseAware uses)
  // turns each clause into its own read, so the positional leg settles the
  // clauses that would otherwise be refused together.
  let positional = [];
  let positionalRan = false;
  if (roleConfig && posPrior && classifyWord && dominantClass) {
    positionalRan = true;
    const readers = relationExtractorsFor({ language: roleConfig.language ?? "eng", roleConfig, posPrior, classifyWord, dominantClass, ...(verbForms ? { verbForms } : {}) });
    for (const s of splitSentences(body)) {
      const st = s.text ?? s;
      const clauses = clauseSpans(st).map((c) => (typeof c === "string" ? c : st.slice(c.start, c.end))).filter((t) => t.trim());
      for (const clause of clauses.length ? clauses : [st]) {
        const r = readers.extractRelations(clause, {});
        for (const rel of r) if (rel.end1 && rel.label && rel.end2) positional.push({ ...rel, sentence: clause, basis: "positional clause" });
      }
    }
  }

  // COMPOSE — ADDITIVE, NEVER REPLACING (2026-10-02, falsified the replace
  // version: it read 81 fewer relations than the dispatch reader on the
  // holodeck's own source — a coverage regression, the exact wall). The
  // positional clause connector PRECEDES the recurrence arrangements for the
  // same pair (so the precise label wins on the re-read), but every recurrence
  // relation the clause reader did not already state is KEPT. The reading is
  // the union, deduped on the exact triple.
  const out = [...positional, ...recurrence];
  const seen = new Set();
  const unique = [];
  for (const a of out) {
    const k = `${String(a.end1).toLowerCase()}|${String(a.end2).toLowerCase()}|${String(a.label).toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k); unique.push(a);
  }
  return { relations: unique, positional: positional.length, recurrence: recurrence.length, positionalRan, basis: positionalRan ? "composed (additive): positional clause connectors + every recurrence arrangement, deduped on the exact triple" : "recurrence only — positional leg disabled (roleConfig/posPrior/classifyWord/dominantClass not all supplied), disclosed" };
}

export default composedRelations;