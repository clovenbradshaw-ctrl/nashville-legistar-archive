// adapters/text/clause-spans.js — CLAUSE-LEVEL SEGMENTATION (2026-09-23).
//
// SCOPED TO ENGLISH, DISCLOSED, NOT SILENT. Neither `clauseSpans` nor
// `propositionSpans` takes a `language` parameter — both default to the
// closed grammatical classes priors.js declares `giver: "lang/en"`
// (CLAUSE_COORDINATORS, SUBORDINATING_CONJUNCTIONS, INTERROGATIVE_PRONOUNS,
// SUBJECT_PRONOUNS). This is a stated scope, not an implied universal: a
// caller reading a different language passes its own closed classes via
// `opts.coordinators`/`subordinators`/`relativizers`/`subjectPronouns`
// rather than getting a silently-wrong English segmentation. relations-
// gfp.js's own figure-finding stays language-neutral (recurrence + company,
// no vocabulary); THIS module — the clause-boundary layer sitting above
// it — is where the language-specific grammar actually lives, and it says
// so here rather than smuggling it in as if clause structure were
// universal.
//
// Built to answer a specific, disclosed gap: extractGfpRelations
// (relations-gfp.js) reads figure-connector-figure arrangements from
// whatever text sits within MAX_ADJACENCY=200 bytes of two figure
// mentions, with zero awareness of clause or sentence boundaries. Measured
// live against a real Wikipedia paragraph (Marie Curie, 2026-09-23): edges
// like `Pierre Curie —entered→ her life: it was their mutual interest in
// natural sciences that drew them together` bundle two independent
// propositions into one un-nested span, because nothing stops a
// figure-connector-figure match at a colon or a subordinate clause.
//
// THE USER'S OWN FRAMING (2026-09-23, verbatim, why this file exists):
// "human language is a series of nested propositions of increasing
// abstraction — clause, sentence, paragraph, section, etc. — each itself a
// GFP, each drillable and collapsible." This module is the clause-level
// floor of that stack: it turns one sentence into a small TREE of clause
// spans (not a flat list) so a caller can run extractGfpRelations PER
// CLAUSE instead of per byte-window, and so each clause's own arrangement
// can point at its parent clause — collapsible up, drillable down — rather
// than a single flat span swallowing everything between two figures.
//
// WHAT COUNTS AS A BOUNDARY, AND WHY EACH ONE IS TRUSTED:
//   - `;` — a semicolon joins two independent clauses in nearly all
//     standard English usage; split unconditionally, relation "coordinate".
//   - `:` — a colon most often introduces material that ELABORATES the
//     clause before it (an explanation, a list, an appositive clause) —
//     not a sibling proposition but a CHILD of the one before the colon.
//     Split, relation "elaborates", parent = the clause before the colon.
//   - a CLAUSE_COORDINATOR (and/but/or/nor/so/yet/for, priors.js) —
//     split ONLY when the very next token is a SUBJECT_PRONOUN (priors.js:
//     i/you/he/she/it/we/they/this/that/these/those/who/what/which/
//     whoever/whatever). This is not a new threshold: it is the EXACT
//     discriminator priors.js's own CLAUSE_COORDINATORS comment already
//     names as the measured real shape ("and it", "but he", "battle
//     that") — reused here, not reinvented. Anything else after the
//     coordinator ("bread and butter") is NP-coordination, left alone.
//     relation "coordinate".
//   - a SUBORDINATING_CONJUNCTION (priors.js — because/although/while/
//     since/if/after/before/unless/until/though, each independently
//     measured SCONJ-dominant against the received POS prior) — split,
//     relation "subordinate", ONLY when at least one token already
//     precedes it in the current clause (a sentence OPENING with "Because
//     it rained…" is one clause, not a fragment before nothing).
//   - a WH-relative opener (priors.js INTERROGATIVE_PRONOUNS' own keys:
//     who/whom/whose/what/which/where/when) — same rule, relation
//     "relative".
//
// DISCLOSED, NOT SOLVED (three known gaps, measured live against this
// module's own smoke test, kept narrow rather than guessed wide):
//   1. "that" is deliberately excluded from the subordinator/relativizer
//      triggers (see priors.js's own note on SUBORDINATING_CONJUNCTIONS) —
//      pos-eng.json measures it too close to a three-way split
//      (SCONJ/PRON/DET) to trust as a closed-class boundary signal alone.
//      "the theory that Curie discovered" will NOT be split at "that".
//   2. FRONTED subordinate clauses ("Because it rained, the match was
//      postponed") are NOT split — the subordinator-as-first-token guard
//      (below) exists to avoid a zero-length clause before it, but this
//      module does not yet detect the comma that should close a fronted
//      subordinate clause and open the main one. Only TRAILING subordinate/
//      relative clauses (main clause first) are split today.
//   3. Pied-piped relatives ("…Pierre, with whom she…") split AT the
//      relative pronoun, leaving its governing preposition ("with")
//      stranded at the end of the parent clause rather than carried into
//      the child. Correct content, imprecise boundary.
// Each is a real, present gap, not a hidden one — narrower and true beats
// wider and guessed, the same rule relations-gfp.js's own header states
// for figures.
//
// PURE. No model call, no IO, no network. Operates on one sentence's text
// at a time (a caller running this per-sentence, after splitSentences).

import { CLAUSE_COORDINATORS, SUBORDINATING_CONJUNCTIONS, SUBJECT_PRONOUNS, INTERROGATIVE_PRONOUNS } from "./priors.js";

const WORD = /[\p{L}\p{N}']+/gu;
const RELATIVIZERS = new Set(INTERROGATIVE_PRONOUNS.keys());

/**
 * clauseSpans(text, opts) → [{ start, end, text, parentIndex, relation }]
 *
 * `parentIndex` — the index (into the returned array) of this clause's
 * parent, or `null` for the root (first) clause. `relation` — how this
 * clause relates to its parent: "root" | "coordinate" | "elaborates" |
 * "subordinate" | "relative".
 *
 * `opts.coordinators`/`subordinators`/`relativizers`/`subjectPronouns` let
 * a caller override the received defaults (testing, a different
 * register); omitted, the priors.js closed classes above are used as-is —
 * never re-derived, never guessed.
 */
export function clauseSpans(text, opts = {}) {
  const s = String(text ?? "");
  const coordinators = opts.coordinators ?? CLAUSE_COORDINATORS;
  const subordinators = opts.subordinators ?? SUBORDINATING_CONJUNCTIONS;
  const relativizers = opts.relativizers ?? RELATIVIZERS;
  const subjectPronouns = opts.subjectPronouns ?? SUBJECT_PRONOUNS;

  if (!s.trim()) return [];

  const tokens = [...s.matchAll(WORD)].map((m) => ({ tok: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));
  if (!tokens.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];

  // BOUNDARY CANDIDATES: each is { at (char offset a split happens BEFORE),
  // relation, viaCharBoundary (true for ; and : which are not tokens) }.
  const boundaries = [];

  // `;` and `:` — scanned over the raw string, not the token list, since
  // they are not themselves words.
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === ";") boundaries.push({ at: i + 1, relation: "coordinate" });
    else if (s[i] === ":") boundaries.push({ at: i + 1, relation: "elaborates" });
  }

  // Coordinators / subordinators / relativizers — scanned over tokens so
  // "next token" and "at least one prior token in this clause" are cheap
  // lookups, not string arithmetic.
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (coordinators.has(t.lower) && i + 1 < tokens.length && subjectPronouns.has(tokens[i + 1].lower)) {
      boundaries.push({ at: t.start, relation: "coordinate" });
    } else if ((subordinators.has(t.lower) || relativizers.has(t.lower)) && i > 0) {
      boundaries.push({ at: t.start, relation: subordinators.has(t.lower) ? "subordinate" : "relative" });
    }
  }

  // Sort, de-duplicate by offset (a ";"-adjacent coordinator etc.), and
  // drop any boundary inside the first few characters (nothing to be a
  // clause before it).
  boundaries.sort((a, b) => a.at - b.at);
  const cuts = [];
  for (const b of boundaries) {
    if (b.at <= 0) continue;
    if (cuts.length && cuts[cuts.length - 1].at === b.at) continue;
    cuts.push(b);
  }
  if (!cuts.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];

  // Build spans between consecutive cut points. "elaborates" nests under
  // the clause immediately before it (parent = previous span's index);
  // every other relation nests under the ROOT (index 0) — a coordinate or
  // subordinate clause is scoped by the sentence's own main clause, not by
  // whatever clause happened to sit textually before it.
  const bounds = [0, ...cuts.map((c) => c.at), s.length];
  const out = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const rawStart = bounds[i], rawEnd = bounds[i + 1];
    const raw = s.slice(rawStart, rawEnd);
    const clauseText = raw.trim();
    if (!clauseText) continue;
    // start/end are adjusted to bound the TRIMMED text exactly (a ";"/":"
    // cut point sits right after the punctuation, one whitespace char
    // before the real word starts) -- so start+offset math downstream
    // (propositionSpans slicing a verb out of clause.text) is exact, never
    // off by the trimmed separator.
    const start = rawStart + (raw.length - raw.trimStart().length);
    const end = rawEnd - (raw.length - raw.trimEnd().length);
    const relation = i === 0 ? "root" : cuts[i - 1].relation;
    const parentIndex = i === 0 ? null : (relation === "elaborates" ? out.length - 1 : 0);
    out.push({ start, end, text: clauseText, parentIndex, relation });
  }
  return out.length ? out : [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];
}

const dominant = (tags) => {
  const entries = Object.entries(tags ?? {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
};

/**
 * propositionSpans(text, opts) → [{ start, end, text, parentIndex, relation, sharesSubjectWith }]
 *
 * A CLAUSE is a syntactic container; a PROPOSITION is one predicate holding
 * over its arguments — this codebase's own GFP triple, {end1, label, end2}.
 * They are not the same thing: "she was awarded a degree and began work"
 * is ONE clause (one subject, no second subject anywhere) but TWO
 * propositions (`awarded`, `began`), each licensed by its own verb, both
 * taking the same unstated subject. clauseSpans alone cannot see this — it
 * only splits where a NEW subject appears. This function runs clauseSpans
 * first, then looks INSIDE each clause for a compound predicate: a
 * CLAUSE_COORDINATOR whose next token is measured VERB/AUX-dominant in the
 * received POS prior (the same `dominant()` a caller already trusts
 * elsewhere in this codebase — never a new hand list), rather than a
 * subject (clauseSpans already split there if it was one).
 *
 * `sharesSubjectWith` — the index (into the returned array) of the sibling
 * proposition this one's subject is elided from, or `null`. Deliberately a
 * POINTER, never a copied/guessed subject string: this codebase already
 * has a measured, disclosed reason the positional/SVO reader that would
 * try to actually EXTRACT "she" as a subject phrase fails on real prose
 * (reader-bundle.js's own header, the 2026-09-20 Grant-sentence finding) —
 * asserting a subject this function did not measure would be exactly that
 * mistake again. A caller wanting the real subject text follows the
 * pointer to the sibling proposition's own span instead.
 *
 * REQUIRES `opts.posPrior` — without a received tag distribution to check
 * VERB/AUX-dominance against, no predicate-split can be measured, so
 * clause spans pass through unchanged (kept, never guessed) rather than
 * splitting on a guess about what looks verb-shaped.
 */
export function propositionSpans(text, opts = {}) {
  const clauses = clauseSpans(text, opts);
  const posPrior = opts.posPrior ?? null;
  if (!posPrior) return clauses.map((c) => ({ ...c, sharesSubjectWith: null, verbStart: null, verbEnd: null }));

  const coordinators = opts.coordinators ?? CLAUSE_COORDINATORS;
  const isVerbDominant = (tok) => {
    const e = posPrior.forms?.[tok.toLowerCase()];
    if (!e) return false;
    const d = dominant(e);
    return d === "VERB" || d === "AUX";
  };

  const out = [];
  for (const clause of clauses) {
    const tokens = [...clause.text.matchAll(WORD)].map((m) => ({ tok: m[0], start: m.index, end: m.index + m[0].length }));
    let cut = null, verbTok = null;
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (i > 0 && coordinators.has(t.tok.toLowerCase()) && i + 1 < tokens.length && isVerbDominant(tokens[i + 1].tok)) {
        cut = t.start;
        verbTok = tokens[i + 1];
        break; // narrowest true split first; a caller re-running on the remainder finds any further ones
      }
    }
    if (cut === null) {
      out.push({ ...clause, sharesSubjectWith: null, verbStart: null, verbEnd: null });
      continue;
    }
    const firstText = clause.text.slice(0, cut).trim();
    const secondText = clause.text.slice(cut).trim();
    const firstIndex = out.length;
    // clause.start is exact (clauseSpans now bounds trimmed text precisely,
    // see its own fix above) so clause.start + a clause.text offset is a
    // true global offset — this is what makes verbStart/verbEnd trustworthy
    // for a caller to slice the ORIGINAL text with, not just clause.text.
    out.push({ start: clause.start, end: clause.start + cut, text: firstText, parentIndex: clause.parentIndex, relation: clause.relation, sharesSubjectWith: null, verbStart: null, verbEnd: null });
    out.push({ start: clause.start + cut, end: clause.end, text: secondText, parentIndex: clause.parentIndex, relation: "coordinate-predicate", sharesSubjectWith: firstIndex, verbStart: clause.start + verbTok.start, verbEnd: clause.start + verbTok.end });
  }
  return out;
}
