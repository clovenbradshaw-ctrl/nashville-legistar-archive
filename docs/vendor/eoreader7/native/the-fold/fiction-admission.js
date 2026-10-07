// fiction-admission.js — A SEPARATE ADMISSION/ARRIVAL PATHWAY FOR FICTION MODE
// (2026-09-26). Intended integration path: native/the-fold/fiction-admission.js,
// beside admission.js and archon-rules.js. Neither of those files, nor
// arrange.js, nor pipeline-run.mjs, is edited by this change — this file is
// purely additive, and every export here is new.
//
// THE PROBLEM THIS REPLACES: the earlier framing of this task ("let the model
// imagine freely, seeded with injected random content") was rejected by the
// user as too loose. The corrected framing, stated directly and adopted here
// verbatim: a counterfactual or hypothetical is NOT free invention. It is
// exactly one Ground-fact replaced by a stipulated value (known false =
// counterfactual; truth left open = hypothetical), with the SAME real
// Pattern — the same relation the non-fiction pipeline already reads — run
// forward from that one substitution. Everything else about the mechanism
// stays identical to the factual case; only one addressable Ground-value
// changes.
//
// WHAT "SEED" CONCRETELY MEANS HERE, AND WHY IT IS CHECKABLE:
//
//   A seed is a REAL claim (kernel/gfp-claim.js's own Ground/Figure/Pattern
//   shape: a ground, a relation, and role fillers) extracted from the ground
//   material by the project's own in-house parser — the exact machinery
//   arrange.js's claimsFromFeat already uses for every non-fiction pipeline
//   run — with ONE role's filler replaced by a DIFFERENT REAL value the SAME
//   ground document already uses for that role in another claim (never a
//   coined name or invented fact), or, when no such real alternative exists,
//   with the claim's own polarity flipped (a real, equally mechanical
//   substitution: the fact's own negation).
//
//   This is checkable because the substitution is a single, addressable
//   before/after pair of concrete strings (the overridden value, and its
//   replacement) rather than a mood or a vibe: "did the piece use its seed"
//   reduces to two mechanical questions this file actually answers — (1) does
//   the finished piece ever reassert the literal overridden value in the
//   overridden role (a reversion — refused, both per-sentence at admission
//   time and again over the whole assembled piece), and (2) does the piece
//   ever state the stipulated replacement (its presence, checked the same
//   mechanical way). Nothing here asks a model to grade itself, and nothing
//   here is a hand-set threshold — the ONE constant this module bases a
//   judgement on, the "genuinely inventive" bond ceiling in fictionArrival,
//   is the ground's own measured null (admission.js's measureBondNull),
//   exactly the discipline admission.js's own header already commits this
//   project to.
//
// WHAT IS DELIBERATELY NOT BUILT HERE (disclosed, not silently skipped):
//   - No full consistency solver: a claim two inference-steps downstream of
//     the stipulation, entailed but not literally restating the overridden
//     value, is not caught. Only direct reversion is checked, per the user's
//     own scoped-down instruction ("keep this check narrow/simple... e.g.
//     just checking no claim restates the original overridden value").
//   - No wiring into pipeline-run.mjs's runPipeline / prosify.js / flesh2.js
//     internals: this is a separate, standalone pathway (fiction-pipeline.mjs)
//     rather than a mode flag threaded through the existing prose loop, so
//     the working, tested, non-fiction pipeline has zero new surface area to
//     regress. See fiction-pipeline.mjs's own header for the reasoning.
//   - tripleFromRecord (below) is a disclosed, narrower subset of arrange.js's
//     private notesOf(): it does not carry notesOf's own conjunct handling
//     for negation, phrasal particles, or the "?" (Neg-somewhere-but-not-
//     scoped-to-this-note) under-citation care. It exists as its own function,
//     not an edit to arrange.js, specifically so this module never depends on
//     modifying an existing file.
//
// import surface: admission.js and gfp-claim.js are read as libraries only,
// exactly as pipeline-run.mjs and arrange.js already read them; admit() and
// gebserArrival() are never imported here and are therefore untouched.
import { claimFromTriple } from "../kernel/gfp-claim.js";
import { segmentSentences, distinctSentences, wordTokens, looksMeta, measureVariance, bond, measureBondNull } from "./admission.js";

export const FICTION_SCHEMA = "EOFictionSeed@1";

/**
 * tripleFromRecord(record) -> { end1, label, end2, polarity } | null
 *
 * A standalone re-derivation of arrange.js's own notesOf() root/subject/
 * object/copula read of one parser record's meaning graph — the exact same
 * grammatical positions (nsubj for the subject, obj/obl for the object, cop
 * for a copula, ADJ for a predicate adjective), so a seed claim picked here
 * is the same KIND of claim claimsFromFeat already builds for every
 * non-fiction run, not a different, weaker notion of "claim." Narrower than
 * notesOf in exactly the ways disclosed above.
 */
export function tripleFromRecord(record) {
  const m = record?.meaning;
  if (!m?.nodes?.length) return null;
  const byKey = new Map(m.nodes.map((n) => [n.key, n]));
  const rootArc = (m.arcs ?? []).find((a) => a.from == null);
  const root = rootArc ? byKey.get(rootArc.to) : null;
  if (!root) return null;
  const arcs = (m.arcs ?? []).filter((a) => a.from === root.key);
  const subj = arcs.find((a) => /^nsubj/.test(a.rel));
  const obj = arcs.find((a) => a.rel === "obj") ?? arcs.find((a) => a.rel === "obl");
  const cop = arcs.find((a) => a.rel === "cop");
  if (!subj) return null;
  const predicateAdj = root.upos === "ADJ";
  if (!obj && !cop && !predicateAdj) return null;
  const isNeg = (feats) => (feats ?? []).some((f) => f.value === "Neg" && (f.name === "Polarity" || f.name === "PronType"));
  const subjNode = byKey.get(subj.to);
  const objNode = obj ? byKey.get(obj.to) : null;
  // Narrower than notesOf's own per-note-scoped negation: any Neg anywhere in
  // the sentence marks this triple "?" (unresolved), never guessed either way.
  const negAnywhere = m.nodes.some((n) => isNeg(n.feats)) || (m.markers ?? []).some((x) => isNeg(x.feats));
  const label = obj ? root.lemma : ((cop && byKey.get(cop.to)?.lemma) ?? "be");
  const end2 = obj ? objNode?.lemma : root.lemma;
  if (!subjNode?.lemma || !label || !end2) return null;
  return { end1: subjNode.lemma, label, end2, polarity: negAnywhere ? "?" : "+" };
}

/**
 * stipulateFromGround(ground, { parser, pick }) -> the ONE substitution this
 * fiction pathway is built around (see this file's header for the design).
 *
 * `pick` selects WHICH of the ground's real claims is seeded (default 0, the
 * first found in document order) — a caller wanting a different one states an
 * index rather than this module guessing; out-of-range values wrap, so any
 * integer is a valid, deterministic choice.
 *
 * A typed gap, never a fabricated claim, when the parser is unavailable or
 * finds nothing extractable — the same discipline pipeline-run.mjs's own
 * `parser.ok` branch already follows for the EOT notation stage.
 */
export function stipulateFromGround(ground, { parser, pick = 0 } = {}) {
  if (!parser?.ok) return { ok: false, reason: "no in-house parser available (loadEotParser did not report ok) — stipulation needs a real subject/relation/object read of the ground, never a guess" };
  const sentences = distinctSentences(ground);
  const claims = [];
  for (const s of sentences) {
    let records;
    try { records = parser.parse(s, "fiction-seed"); } catch { records = []; }
    for (const r of records ?? []) {
      const t = tripleFromRecord(r);
      if (t && t.polarity !== "?") claims.push({ ...t, sentence: s });
    }
  }
  if (!claims.length) return { ok: false, reason: `no resolved-polarity subject/relation/object claim found in ${sentences.length} ground sentence(s) — the parser's own gap, not a guessed claim` };
  const idx = ((pick % claims.length) + claims.length) % claims.length;
  const original = claims[idx];
  const originalClaim = claimFromTriple(original.end1, original.label, original.end2, { polarity: original.polarity });
  // A REAL alternative filler: a DIFFERENT claim elsewhere in this SAME
  // ground already uses a different value for the same role. Preferring
  // ARG1 (the object/predicate) over ARG0 (the subject) because a fictional
  // "X did something else" reads more naturally than "someone else did X" on
  // arbitrary material, but either is a real, checkable substitution.
  const altEnd2 = claims.find((c, i) => i !== idx && c.end2.toLowerCase() !== original.end2.toLowerCase())?.end2 ?? null;
  const altEnd1 = !altEnd2 ? (claims.find((c, i) => i !== idx && c.end1.toLowerCase() !== original.end1.toLowerCase())?.end1 ?? null) : null;
  let stipulated, mode, overriddenRole, overriddenValue;
  if (altEnd2) {
    stipulated = claimFromTriple(original.end1, original.label, altEnd2, { polarity: original.polarity });
    mode = "substitute-ARG1"; overriddenRole = "ARG1"; overriddenValue = original.end2;
  } else if (altEnd1) {
    stipulated = claimFromTriple(altEnd1, original.label, original.end2, { polarity: original.polarity });
    mode = "substitute-ARG0"; overriddenRole = "ARG0"; overriddenValue = original.end1;
  } else {
    stipulated = claimFromTriple(original.end1, original.label, original.end2, { polarity: original.polarity === "+" ? "-" : "+" });
    mode = "flip-polarity"; overriddenRole = "polarity";
    overriddenValue = `${original.end1} ${original.label} ${original.end2}`;
  }
  return {
    ok: true, schema: FICTION_SCHEMA, mode, overriddenRole, overriddenValue,
    original: originalClaim, originalSentence: original.sentence,
    stipulated,
    basis: mode === "flip-polarity"
      ? `no other extracted claim in this ground supplied a distinct real ARG0 or ARG1 value, so the stipulation flips this claim's own polarity — a real, checkable negation, not an invented fact`
      : `${overriddenRole} "${overriddenValue}" is replaced by "${mode === "substitute-ARG1" ? altEnd2 : altEnd1}" — a real value this SAME ground document already uses for ${overriddenRole} of a different claim, not a coined one`,
  };
}

/**
 * fictionInstruction({ task, stipulation }) -> the prompt text handed to the
 * mouth. States the ask, the real source sentence, the ONE stipulated change
 * (as a plain-language substitution, not GFP notation — the model is the
 * mouth, never handed machine notation to imitate), and an explicit
 * instruction not to restate the fact the stipulation replaces.
 */
export function fictionInstruction({ task = "", stipulation } = {}) {
  // A light naturalization, not full NLG: a lowercase filler (a common noun
  // this claim's own extraction lemmatized, e.g. "town", "fort") reads as a
  // bare noun with no article to a small model, so it gets one; a filler
  // that is already capitalized (a name, e.g. "John") is left alone. This is
  // the ONE place this file renders a claim as near-English rather than raw
  // GFP notation (gfp-claim.js's own render() is deliberately never handed to
  // a mouth as a sentence) — still no tense and no invented fact, only "a"/
  // "the" inserted mechanically ahead of an already-real, already-extracted
  // word.
  const nat = (w) => (/^[a-z]/.test(String(w ?? "")) ? `the ${w}` : String(w ?? ""));
  const say = (c) => [c.roles?.ARG0, c.rel, nat(c.roles?.ARG1)].filter(Boolean).join(" ");
  const lines = [
    task,
    "",
    `A real fact from the source material: "${stipulation.originalSentence}"`,
  ];
  if (stipulation.mode === "flip-polarity") {
    lines.push(`For this piece only, stipulate the opposite of that fact: treat it as true that it is NOT the case that ${say(stipulation.original)}. Do not write anywhere that ${say(stipulation.original)} — that is the one fact this piece changes.`);
  } else {
    lines.push(`For this piece only, stipulate one change to that fact: instead of "${stipulation.overriddenValue}", treat it as true that ${say(stipulation.stipulated)}. Do not write anywhere that ${say(stipulation.original)} — "${stipulation.overriddenValue}" is the one fact this piece changes.`);
    lines.push(`Somewhere in the piece, state the changed fact plainly in one direct sentence (for example: "${stipulation.original.roles?.ARG0} led ${nat(stipulation.stipulated.roles?.ARG1)}.") before moving on to invented scene, action, or dialogue.`);
  }
  lines.push("Write a short piece of fiction consistent with this one change. Invent scene, action, or dialogue as needed — this is fiction, not a restatement of the source.");
  return lines.join("\n");
}

/**
 * revertsStipulation(text, stipulation, { parser }) -> { reverts, basis }
 *
 * Two independent, mechanical checks; either firing is a reversion:
 *   (a) LITERAL: the candidate's own words contain every word of the exact
 *       overridden value (skipped for flip-polarity, which has no single
 *       banned phrase — the word "led" is not itself forbidden, only the
 *       ASSERTION that it holds of the original pair). Always available, no
 *       parser required.
 *   (b) STRUCTURAL: when the in-house parser is supplied, the candidate is
 *       parsed the same way stipulateFromGround read the ground, and its own
 *       extracted triple is compared directly against the original claim —
 *       this is what lets flip-polarity mode be checked at all (a candidate
 *       whose own parsed polarity matches the original's, on the same
 *       relation and role fillers, has restated exactly what was denied).
 */
export function revertsStipulation(text, stipulation, { parser = null } = {}) {
  const t = String(text ?? "");
  if (stipulation?.mode !== "flip-polarity" && stipulation?.overriddenValue) {
    const need = wordTokens(stipulation.overriddenValue);
    const have = new Set(wordTokens(t));
    if (need.length && need.every((w) => have.has(w))) {
      return { reverts: true, basis: `literal: the candidate's own words include every word of "${stipulation.overriddenValue}" — the exact value the stipulation replaced` };
    }
  }
  if (parser?.ok && stipulation?.original) {
    const origARG0 = String(stipulation.original.roles?.ARG0 ?? "").toLowerCase();
    const origARG1 = String(stipulation.original.roles?.ARG1 ?? "").toLowerCase();
    const origRel = String(stipulation.original.rel ?? "").toLowerCase();
    let records;
    try { records = parser.parse(t, "fiction-candidate"); } catch { records = []; }
    for (const r of records ?? []) {
      const tr = tripleFromRecord(r);
      if (!tr) continue;
      const sameRelation = tr.label.toLowerCase() === origRel && tr.end1.toLowerCase() === origARG0 && tr.end2.toLowerCase() === origARG1;
      if (!sameRelation) continue;
      if (stipulation.mode === "flip-polarity" && tr.polarity === stipulation.original.polarity) {
        return { reverts: true, basis: `structural: the candidate's own parsed claim "${tr.end1} ${tr.label} ${tr.end2}" (polarity ${tr.polarity}) restates exactly what the stipulation denied` };
      }
      if (stipulation.mode !== "flip-polarity") {
        return { reverts: true, basis: `structural: the candidate's own parsed claim restates the original relation and value the stipulation replaced` };
      }
    }
  }
  return { reverts: false };
}

/**
 * admitFiction(candidate, { ground, stipulation, instruction, registry,
 * variance, locale, parser }) -> { admit, road, refused }, the same verdict
 * shape admission.js's admit() returns, so an existing caller of admit()'s
 * output can read this one too.
 *
 * SAME AS admit(): looksMeta — an apparatus leak (the mouth talking about the
 * task rather than the piece) is refused exactly as it is for non-fiction
 * prose. admission.js is read here as a pure library; admit() itself is
 * never called, so nothing about its behavior for any non-fiction caller
 * changes.
 *
 * DELIBERATELY DIFFERENT: admit()'s invented-referent gate (ungroundedTokenRuns
 * / nameGate, wired by admit()'s caller as `invented`) is NEVER run here.
 * This is the one, disclosed relaxation fiction mode exists to make: a piece
 * may name a character, a scene, or a line of dialogue the ground material
 * never uses, because that is what "the model's imagination" means. Nothing
 * else about admission's discipline is loosened.
 *
 * NEW: reverts-stipulation (see revertsStipulation, above) — the fiction
 * pathway's own honest per-sentence gate, replacing admit()'s "new matter or
 * motion" test with "does not contradict the one stipulated change."
 *
 * A lighter repeat guard than admit()'s claim-core registry: fiction
 * legitimately re-uses the same characters and objects across many
 * sentences (that is not "no new matter", it is narrative continuity), so
 * only an EXACT duplicate sentence is refused, never a sentence merely
 * sharing grounded words with an earlier one.
 */
export function admitFiction(candidate, {
  ground = "",
  stipulation = null,
  instruction = "",
  registry = null,
  variance = null,
  locale,
  parser = null,
} = {}) {
  const s = String(candidate ?? "").trim();
  if (!s) return { admit: false, road: null, refused: [{ kind: "empty", given: "model" }] };
  if (!stipulation?.ok) return { admit: false, road: null, refused: [{ kind: "no-stipulation", given: "caller", basis: "admitFiction needs a real stipulateFromGround() result" }] };

  const v = variance instanceof Set ? variance : measureVariance(ground, locale);
  if (looksMeta(s, { instruction, ground, variance: v, locale })) {
    return { admit: false, road: null, refused: [{ kind: "meta", given: "model" }] };
  }

  const reg = registry instanceof Set ? registry : new Set();
  const key = s.toLowerCase();
  if (reg.has(key)) {
    return { admit: false, road: null, refused: [{ kind: "repeat", given: "model", basis: "identical sentence already admitted" }] };
  }

  const rev = revertsStipulation(s, stipulation, { parser });
  if (rev.reverts) {
    return { admit: false, road: null, refused: [{ kind: "reverts-stipulation", given: "model", basis: rev.basis }] };
  }

  reg.add(key);
  return { admit: true, road: "fiction", refused: [] };
}

/**
 * stipulationPresent(piece, stipulation, { parser }) -> does the assembled
 * piece state the stipulated replacement, actually filling the stipulated
 * role (checked structurally when the parser is available; a literal-word
 * fallback otherwise, see below) — the fiction pathway's own analogue of
 * Gebser's "origin present."
 */
function stipulationPresent(piece, stipulation, { parser = null } = {}) {
  // STRUCTURAL, AND AUTHORITATIVE WHEN AVAILABLE (2026-09-26, tightened after
  // a real, measured false positive: an early version fell through to the
  // literal check below whenever the structural pass found no match, and
  // that literal check reported "used" on a piece where the alt value's word
  // merely appeared in an UNRELATED sentence — "a fort" in a sentence with no
  // relation to "John lead" at all — never actually filling the stipulated
  // role). When the parser is available, each sentence is parsed the same
  // way stipulateFromGround read the ground, and its own triple is compared
  // directly against the STIPULATED claim's own relation and roles; with a
  // working parser this is now the WHOLE answer — a false negative here only
  // means "not yet arrived, retry", the safe failure direction, so no literal
  // fallback runs alongside it and dilutes it back to the weaker check.
  if (parser?.ok && stipulation.stipulated) {
    const wantRel = String(stipulation.stipulated.rel ?? "").toLowerCase();
    const wantARG0 = String(stipulation.stipulated.roles?.ARG0 ?? "").toLowerCase();
    const wantARG1 = String(stipulation.stipulated.roles?.ARG1 ?? "").toLowerCase();
    for (const s of piece) {
      let records;
      try { records = parser.parse(s, "fiction-arrival-check"); } catch { records = []; }
      for (const r of records ?? []) {
        const tr = tripleFromRecord(r);
        if (!tr) continue;
        if (tr.label.toLowerCase() === wantRel && tr.end1.toLowerCase() === wantARG0 && (!wantARG1 || tr.end2.toLowerCase() === wantARG1)) return true;
      }
    }
    return false;
  }
  // LITERAL FALLBACK: reached ONLY when no parser is available at all. Weaker
  // — presence of the substitute's own words, not proof it filled the
  // stipulated role — but real, and the only signal left without a parser.
  if (stipulation.mode === "flip-polarity") {
    const relWords = wordTokens(`${stipulation.original.roles?.ARG0 ?? ""} ${stipulation.original.rel ?? ""}`);
    return piece.some((s) => { const have = new Set(wordTokens(s)); return relWords.every((w) => have.has(w)); });
  }
  const need = wordTokens(String(stipulation.mode === "substitute-ARG1" ? stipulation.stipulated.roles?.ARG1 : stipulation.stipulated.roles?.ARG0) ?? "");
  if (!need.length) return false;
  return piece.some((s) => { const have = new Set(wordTokens(s)); return need.every((w) => have.has(w)); });
}

/**
 * fictionArrival({ piece, stipulation, ground, parser }) -> { archon,
 * arrived, missing, basis }, shaped like archon-rules.js's gebserArrival so a
 * caller already reading that shape can read this one. A NEW function beside
 * gebserArrival — gebserArrival is never called or modified here.
 *
 * Fiction's own arrival is not "every sentence traces to a witnessed source
 * statement" (gebserArrival's own criterion, which a fiction piece is built
 * to depart from) but three real, mechanical checks:
 *
 *   INVENTION PRESENT — at least one sentence's bond to the ground's own
 *     sentences sits AT OR BELOW the ground's own measureBondNull ceiling
 *     (admission.js) — genuinely new construction, not a paraphrase of the
 *     source, measured against the same null admission.js already uses for
 *     "is this a restatement", never a hand-set threshold.
 *   STIPULATION HELD — no assembled sentence reverts the stipulation
 *     (revertsStipulation re-run over the WHOLE FINISHED piece, mirroring
 *     archon-rules.js's Houdini pattern of re-checking a per-sentence gate
 *     over the assembled whole, after every admission decision has already
 *     been made).
 *   STIPULATION PRESENT — the stipulated replacement actually appears
 *     somewhere in the piece (stipulationPresent, above) — the seed was not
 *     merely permitted, it was used.
 */
export function fictionArrival({ piece = [], stipulation = null, ground = "", parser = null } = {}) {
  const sentences = piece.flatMap((s) => segmentSentences(s));
  if (!stipulation?.ok) {
    return { archon: "fiction-arrival", arrived: false, missing: ["no real stipulation was supplied"], basis: "fictionArrival needs a real stipulateFromGround() result" };
  }
  const variance = measureVariance(ground);
  const nul = measureBondNull(ground, undefined, variance);
  const ceiling = (nul.pairs ?? 0) > 0 ? (nul.max ?? 0) : 0;
  const groundSentences = distinctSentences(ground);
  const inventive = sentences.filter((s) => groundSentences.every((g) => bond(s, g, undefined, variance) <= ceiling));
  const reverted = sentences.filter((s) => revertsStipulation(s, stipulation, { parser }).reverts);
  const used = stipulationPresent(sentences, stipulation, { parser });

  const missing = [
    inventive.length === 0 ? `no sentence departs from the ground beyond its own bond ceiling (${ceiling.toFixed(2)}) — the piece is a paraphrase, not fiction` : "",
    reverted.length ? `${reverted.length} sentence(s) revert the stipulation, restating "${stipulation.overriddenValue}": ${reverted.slice(0, 2).join(" / ")}` : "",
    used ? "" : "the stipulated replacement never appears anywhere in the piece — the seed was permitted but not used",
  ].filter(Boolean);

  return {
    archon: "fiction-arrival",
    arrived: missing.length === 0,
    missing,
    inventiveCount: inventive.length,
    sentenceCount: sentences.length,
    revertedCount: reverted.length,
    stipulationUsed: used,
    basis: missing.length === 0
      ? `arrived: ${inventive.length} of ${sentences.length} sentence(s) are genuinely inventive (bond ≤ the ground's own null ceiling ${ceiling.toFixed(2)}), none reverts "${stipulation.overriddenValue}", and the stipulated replacement is present`
      : missing.join("; "),
  };
}
