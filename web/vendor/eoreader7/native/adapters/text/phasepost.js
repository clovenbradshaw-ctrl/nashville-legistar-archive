// phasepost.js — the 27-phasepost overlay: which ACT OF TRANSFORMATION an
// already-extracted relation performs, as one of the engine's own 27 cells
// (operator × grain, native kernel/cube.js — injected, never restated).
// DR1 of live_priors/goldens/reading/DERIVED-RULES.md, built to the framing
// received directly (2026-08-29): a phasepost is an act of transformation;
// the verb does 1 of the 9 acts, modified by the grain — the third
// element, specific to that overall three-slot act.
//
// MOVED HERE FROM the-fold (2026-08-29) — this module is pure, organ-
// injected reading logic (no fs, no fetch, no engine import of its own; see
// the makePhasepost signature below), the same standing relations.js/
// surfaces.js already hold in this directory, and it had no the-fold-
// specific content to begin with. The received ActPrior@1 fixture it reads
// (a VerbNet-derived DATA table, not code) moved to live_priors'
// `derived-priors/act-priors/act-prior-en.json` instead — a repo split by
// KIND, not by convenience: engine CODE lives here, received-lexicon
// CONTENT lives with the corpus. See eoreader7's own READING-SPEC.md S29
// for the full account of the split and what it does and does not cover.
//
// AN OVERLAY, NEVER A GATE — grammar-lens.js's own posture one register
// over: this module reads an edge some extractor already produced and
// returns a SEPARATE classification beside it. It refuses nothing, admits
// nothing, and never edits the edge. P56's asymmetric discipline governs
// the ambiguous case: a verb whose lexicon standing is contested stays a
// CANDIDATE SET on the verdict, never a silent coin-flip.
//
// TWO TIERS, in order, per RULE.md Part II:
//   1. MECHANICAL — decidable from the edge's own structure, no lexicon:
//      the existential-negative subject (A4 -> NUL), and the copula rule
//      (the commonest verb is act-empty; its phasepost is read from the
//      PREDICATE's own shape — participle routes to that verb's act, kind
//      predicate -> SIG·Pattern, unique role -> SIG·Figure, property ->
//      SIG·Figure, locative -> SIG·Ground).
//   2. LEXICAL — ActPrior@1 (eval/fixtures/act-prior-en.json: VerbNet 3
//      members under this project's own declared class->act table; giver
//      named in the fixture itself). Unattested forms retry through the
//      injected lemmatizer (UniMorph MorphologyPrior@1 — the same organ
//      hypergraph.js already injects for verb equality); still unattested
//      is a TYPED GAP, never a guess — the POS gate's own "a witness
//      cannot refuse what it never saw", applied to acts.
//
// GRAIN IS OCCURRENCE-LEVEL, mechanical, and honestly rough: what does
// THIS transformation land on? Universal-quantified subject -> Pattern;
// locative-led or absent object -> Ground; else Figure. Scored apart from
// the op in the golden eval so its real accuracy is never hidden inside a
// combined number.
//
// PURE, organs injected (the cast.js pattern): { actPrior, cellOf,
// definiteDeterminers, indefiniteDeterminers, lemmasOf? }. No fs, no
// fetch, no engine import.

// Received closed classes, declared here with their givers — the same
// standing priors.js's own entries hold. Copula and auxiliary inventories
// are textbook closed classes of English; the universal quantifiers are
// the determiner slice that marks kind-level predication.
export const COPULA_FORMS = Object.freeze(new Set(["be", "am", "is", "are", "was", "were", "been", "being"]));
export const COPULA_FORMS_META = Object.freeze({ giver: "lang/en" });
export const AUXILIARIES = Object.freeze(new Set([
  "have", "has", "had", "do", "does", "did", "not", "never",
  "will", "shall", "should", "would", "could", "can", "may", "might", "must",
  "now", "then", "also", "still", "just", "yet",
]));
export const AUXILIARIES_META = Object.freeze({ giver: "lang/en — auxiliaries, modals and the clause-medial adverbs that ride the verb group" });
export const UNIVERSAL_QUANTIFIERS = Object.freeze(new Set(["all", "every", "each", "any"]));
export const UNIVERSAL_QUANTIFIERS_META = Object.freeze({ giver: "lang/en" });
export const LOCATIVE_PREPOSITIONS = Object.freeze(new Set(["in", "at", "on", "under", "over", "near", "beside", "during", "through", "across", "within", "into", "onto", "from", "toward", "towards"]));
export const LOCATIVE_PREPOSITIONS_META = Object.freeze({ giver: "lang/en" });
export const NEGATIVE_EXISTENTIALS = Object.freeze(new Set(["nothing", "nobody", "no one", "none", "nowhere"]));
export const NEGATIVE_EXISTENTIALS_META = Object.freeze({ giver: "lang/en" });

const toks = (t) => String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s'’-]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * headVerb(relation) — the act-bearing head of a possibly phrasal relation
 * ("argues for" -> "argues"; "have pledged themselves to achieve" ->
 * "pledged"; "is considered" -> "considered" with copula: true). Strips the
 * auxiliary group (received class above); what remains first is the head.
 * A relation that strips to NOTHING was the bare copula.
 */
export function headVerb(relation) {
  const words = toks(relation);
  let sawCopula = false;
  let sawHave = false;
  for (const w of words) {
    if (COPULA_FORMS.has(w)) { sawCopula = true; continue; }
    if (w === "have" || w === "has" || w === "had") { sawHave = true; continue; }
    if (AUXILIARIES.has(w)) continue;
    return { head: w, copula: sawCopula };
  }
  // have/has/had is ambiguous auxiliary/main: an auxiliary only when a
  // verb follows it ("have pledged"); standing ALONE it is the main verb
  // of possession ("the book had pictures") — a fact of English's own
  // closed-class grammar, not a lexicon question.
  if (sawHave) return { head: "have", copula: sawCopula };
  return { head: null, copula: sawCopula };
}

const lower = (t) => String(t ?? "").toLowerCase();

export function makePhasepost({ actPrior, cellOf, definiteDeterminers, indefiniteDeterminers, lemmasOf = null } = {}) {
  if (!actPrior?.forms) throw new TypeError("makePhasepost requires an ActPrior@1 (actPrior.forms)");
  if (typeof cellOf !== "function") throw new TypeError("makePhasepost requires the engine's cellOf injected — the 27 cells are the engine's, never restated here");
  if (!definiteDeterminers || !indefiniteDeterminers) throw new TypeError("makePhasepost requires the received determiner classes injected (priors.js, giver lang/en)");

  const lookup = (form) => {
    const direct = actPrior.forms[form];
    if (direct) return { entry: direct, via: form };
    if (lemmasOf) {
      for (const lemma of lemmasOf(form) ?? []) {
        const e = actPrior.forms[lemma];
        if (e) return { entry: e, via: `${form}->${lemma}` };
      }
    }
    return null;
  };

  /** Occurrence-level grain — RULE.md Part II step 3, mechanical and
   * honestly rough (scored apart in the golden eval).
   *
   * READS end1/end2 FIRST, subject/object as a fallback — see classify()'s
   * own header for why: end1/end2 is the typologically-neutral shape every
   * strategy's reader already produces (position for English/Mandarin,
   * case for Latin, and so on), and this function's JOB — which end is
   * agent-like, which is patient-like — is exactly what each reader has
   * already worked out, under whatever signal its own language supplies.
   * The HEURISTICS below (a universal-quantifier check, a locative-
   * preposition check) stay lang/en-scoped and untouched — real, useful,
   * received signal for the language they were built from — this change
   * only widens which FIELD they are read off, never what they test. */
  const grainOf = ({ end1, end2, subject, object }) => {
    const s = toks(end1 ?? subject);
    if (s.length && UNIVERSAL_QUANTIFIERS.has(s[0])) {
      return { grain: "Pattern", because: "universal-quantified subject-like end — the act lands on the whole kind" };
    }
    const o = toks(end2 ?? object);
    if (!o.length) return { grain: "Ground", because: "no object-like end — the act lands on its own unfolding state" };
    if (LOCATIVE_PREPOSITIONS.has(o[0])) return { grain: "Ground", because: "locative-led object-like end — the act lands on a place/field" };
    return { grain: "Figure", because: "default: the act lands on one individual thing or claim" };
  };

  /**
   * classify(edge) -> verdict. edge is {end1, label, end2} (hypergraph.js's
   * own typologically-neutral shape, P76 — "two ordered ends and a label
   * is already typologically neutral; what a language signals is only
   * WHERE to look for them, never which one is the agent") OR the older
   * {subject, verb|relation, object}, accepted as a fallback so nothing
   * that already calls this breaks. end1/label/end2 is read FIRST.
   *
   * THE GENERALITY BOUNDARY, STATED PLAINLY: this widens the FIELD ACCESS
   * to typologically-neutral, never the CONTENT this module reasons with —
   * ActPrior@1 (the verb lexicon), COPULA_FORMS/AUXILIARIES/
   * UNIVERSAL_QUANTIFIERS/LOCATIVE_PREPOSITIONS/NEGATIVE_EXISTENTIALS (the
   * closed classes grainOf and the mechanical/copula rules read) are ALL
   * still lang/en, unchanged. A non-English edge — say, Latin's own
   * {end1, label, end2, end1Detail: {case: "Nom"}, end2Detail: {case:
   * "Acc"}} from relations-case-marked.js (P77) — now reaches this
   * function's role-reading (which end is agent-like) correctly, because
   * that is exactly what end1/end2 already encode regardless of strategy;
   * it still gaps or defaults through English-only heuristics past that
   * point, honestly, because the LEXICON and the closed classes have no
   * Latin entries. Building those is real, separate, unattempted work —
   * this fix closes the naming mistake, not the omnilingual lexicon gap.
   *
   * Verdict: { op, grain, cell, standing, because, candidates?, via? }
   *   standing: "mechanical" | "copula" | "lexical" | "contested" | "gap"
   * A contested verdict carries `candidates` (each {op, classes}) and NO
   * op — the caller decides what a candidate set is worth; this module
   * never coin-flips (P56).
   */
  const classify = (edge) => {
    const subject = edge?.end1 ?? edge?.subject ?? "";
    const relation = edge?.label ?? edge?.verb ?? edge?.relation ?? "";
    const object = edge?.end2 ?? edge?.object ?? null;

    // ── mechanical: existential-negative subject (A4) ──
    const subjToks = toks(subject);
    const subjLower = lower(subject);
    if (subjToks[0] === "there" || subjToks.some((w) => NEGATIVE_EXISTENTIALS.has(w)) || /\bno one\b/.test(subjLower)) {
      const cell = cellOf("NUL", "Ground");
      return { op: "NUL", grain: "Ground", cell, standing: "mechanical", because: "existential/negative subject — the absence IS the act (A4)" };
    }

    const { head, copula } = headVerb(relation);

    // ── mechanical: bare copula — read the predicate (RULE.md's copula rule) ──
    if (!head && copula) {
      const o = toks(object);
      if (!o.length) {
        const g = { grain: "Ground", because: "bare copula, no predicate — presence itself" };
        return { op: "SIG", ...pick(g), standing: "copula", because: `copula with empty predicate — presence; ${g.because}` };
      }
      const first = o[0];
      // participle predicate -> route to that verb's own act
      const part = lookup(first);
      if (part && /(?:ed|en|n|t)$/.test(first)) {
        return fromLookup(part, edge, "copula-participle", `copula + participle "${first}" — the participial verb's own act, subject as patient`);
      }
      if (indefiniteDeterminers.has(first) || (o.length > 1 && first.endsWith("s") === false && false)) {
        const cell = cellOf("SIG", "Pattern");
        return { op: "SIG", grain: "Pattern", cell, standing: "copula", because: "copula + kind predicate (indefinite article) — standing-as-a-kind (rule 2)" };
      }
      if (definiteDeterminers.has(first) || /^\d|^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/.test(first)) {
        const cell = cellOf("SIG", "Figure");
        return { op: "SIG", grain: "Figure", cell, standing: "copula", because: "copula + unique role/identity predicate (rule 3)" };
      }
      if (LOCATIVE_PREPOSITIONS.has(first)) {
        const cell = cellOf("SIG", "Ground");
        return { op: "SIG", grain: "Ground", cell, standing: "copula", because: "copula + locative predicate (rule 5)" };
      }
      const cell = cellOf("SIG", "Figure");
      return { op: "SIG", grain: "Figure", cell, standing: "copula", because: "copula + property predicate (rule 4)" };
    }

    if (!head) {
      return { op: null, grain: null, cell: null, standing: "gap", because: "no act-bearing head found in the relation" };
    }

    // ── lexical: ActPrior@1, lemmatizer-widened ──
    const found = lookup(head);
    if (!found) {
      return { op: null, grain: null, cell: null, standing: "gap", because: `"${head}" unattested in ActPrior@1 (and through the lemmatizer) — a witness cannot refuse what it never saw`, head };
    }
    return fromLookup(found, edge, copula ? "copula-participle" : "lexical", null);

    function fromLookup({ entry, via }, e, standing, becausePrefix) {
      const g = grainOf(e);
      // The morphological re- rule ActPrior@1's own header discloses: REC
      // (Generate·Interpretation — a frame produced ANEW) has no clean
      // VerbNet family, and RULE.md Part II's own REC examples (recanted,
      // reinterpreted, revised) wear the re- prefix. Where the head carries
      // a productive re- (its un-prefixed remainder is itself attested),
      // REC joins as a DISCLOSED CANDIDATE — never an override: the act
      // may be a plain repeat, and only the occurrence's own context can
      // tell re-doing from re-grounding. This demotes a unanimous lexicon
      // verdict to contested, which is the honest reading (giver: lang/en
      // derivational morphology; the productive re- prefix).
      const recCandidate = /^re./.test(head) && lookup(head.slice(2)) ? { op: "REC", classes: [`morphological re- on "${head.slice(2)}"`], cell: cellOf("REC", g.grain) } : null;

      if (entry.standing === "unanimous" && !recCandidate) {
        const cell = cellOf(entry.op, g.grain);
        return {
          op: entry.op, grain: g.grain, cell, standing,
          because: `${becausePrefix ? becausePrefix + "; " : ""}ActPrior@1 unanimous ${entry.op} (${entry.classes.join(", ")})${entry.alt ? `, declared alt ${entry.alt}` : ""}; grain: ${g.because}`,
          via, alt: entry.alt ?? null,
        };
      }
      // contested — the candidate set, never a coin-flip
      const base = entry.standing === "unanimous"
        ? [{ op: entry.op, classes: entry.classes, cell: cellOf(entry.op, g.grain) }]
        : entry.candidates.map((c) => ({ op: c.op, classes: c.classes, cell: cellOf(c.op, g.grain) }));
      const candidates = recCandidate && !base.some((c) => c.op === "REC") ? [...base, recCandidate] : base;
      return {
        op: null, grain: g.grain, cell: null, standing: "contested",
        candidates,
        because: `${becausePrefix ? becausePrefix + "; " : ""}"${head}" reads ${candidates.map((c) => c.op).join("/")} — a candidate set, not a verdict (P56)${recCandidate ? "; REC offered by the morphological re- rule" : ""}; grain: ${g.because}`,
        via,
      };
    }

    function pick(g) { return { grain: g.grain, cell: cellOf("SIG", g.grain) }; }
  };

  return { classify, grainOf, headVerb };
}
