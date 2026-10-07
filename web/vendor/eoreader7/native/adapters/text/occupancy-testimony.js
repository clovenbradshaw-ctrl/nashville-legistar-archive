// native/adapters/text/occupancy-testimony.js — the material's own testimony
// that a participant came to HOLD a position (2026-09-27; rebuilt on the
// reading pipeline's own mentions 2026-09-28). Text adapter; the kernel it
// feeds (kernel/sequence.js) is medium-blind.
//
// WHY. kernel/sequence.js (READING-SPEC S21) already holds the law — "positions
// are temporal; occupants are not" — and refutes a pooled locus, but nothing
// fed it from material: its one caller is the Wikidata eval. Identity work on
// War and Peace kept conflating a POSITION with a PARTICIPANT ("Count
// Bezukhov" is a title held by the father and then by Pierre; Ostrom's IAD
// keeps position and participant apart for the same reason). Under the grain
// theorem a corpus can refute a locus and never establish one, so a locus
// needs a giver; the material's own statement of becoming, appointment or
// succession is that giver, addressed to the sentence that says it.
//
// THE OCCUPANT IS A MENTION THE PIPELINE MADE. The first cut found the
// occupant as the capitalised run before the transition and the registered
// run (eval/identity/results/occupancy-eval-RESULTS.md) read the cost off its
// own rows: "He", "Several", "Claims", "Loping" taken as names — L2 broken by
// rebuilding a name finder beside the engine's referent organs, which already
// refuse a sentence-initial capital. So the reader now takes `mentions`: for
// each sentence, the spans the reading pipeline established — a referent's
// surface occurrence, a pronoun the pipeline bound — each carrying the
// referent it names and how (`via`). The occupant is the LAST such mention
// before the transition in the clause, with at most two words between them,
// READ rather than skipped (an adverb passes; a modal, a negation or an
// infinitive "to" is irrealis). No mention there -> a typed refusal. The
// capitalised-run finder survives only as the declared ablation arm
// (`mentions` omitted), so the difference can be measured, never assumed.
//
// WHAT COUNTS. A declared closed class of English occupancy transitions
// (giver below), each followed by a complement typed STRUCTURALLY, never by a
// list of role words:
//   locus     definite-led ("the captain of his company") or title-cased
//             ("President of the United States", "Count Bezukhov") — a
//             candidate position
//   kind      indefinite-led ("a lawyer") — membership of a kind, an INS
//             Pattern act, not occupancy: refused, typed
//   state     anything else ("close", "engaged", "chaplain to the Infirmary")
//             — refused, typed. A bare-noun office is a known cost of this
//             typing, registered in occupancy-host-eval.mjs H5b.
// and REALIS only: a rule, a wish or a denial is not testimony that anyone
// held anything (rules belong to kernel/obligations.js, the Paradigm cell).
//
// Every candidate carries its address (source#sentence) and, only if the
// sentence states a year, an order key. Undated standings are real
// standings; kernel/sequence.js's refuteLocus cannot testify about them, and
// says so.

export const OCCUPANCY_TRANSITIONS_EN = Object.freeze({
  become: ["became", "becomes", "become", "becoming"],
  passive: ["appointed", "elected", "named", "made", "chosen", "promoted", "sworn in", "installed", "crowned", "proclaimed", "nominated", "designated"],
  succeed: ["succeeded"],
  assume: ["took office as", "assumed the office of", "assumed the post of", "assumed the title of", "assumed office as"],
  // ALL STATES ARE TRANSITIONS, AND NUL IS THE TRANSITION OF NON-TRANSITION
  // (user direction, 2026-09-28). "Cyril was Count Bezúkhov" holds the locus
  // exactly as "Pierre became Count Bezúkhov" enters it; the act performed
  // is the one that changes nothing — NUL. The copula family is read LAST,
  // so a passive ("was appointed") or a becoming is never re-read as a state.
  state: ["was", "is", "were", "remained", "remains", "had been"],
});
export const OCCUPANCY_TRANSITIONS_EN_META = Object.freeze({
  giver: "declared closed class, lang/en; reference: VerbNet classes become-109.1, appoint-29.1, succeed-? (Levin 1993 §29.1 'appoint verbs')",
  scope: "entry into a position, and holding one (the copula family, NUL); exits (resigned, deposed, died) are named future work",
});
import { undecided, collapse } from "../../kernel/undecided.js";
import { DEFINITE_DETERMINERS as _DEF, INDEFINITE_DETERMINERS as _INDEF, CLAUSE_OPENERS, SUBJECT_PRONOUNS } from "./priors.js";
// where a complement's head NOUN ends (v14's finding): a relative clause or a
// reduced relative ("pope whose age can be verified", "the man he would have
// wished to be") trails the head; the veto below reads the word BEFORE the
// first clause opener or subject pronoun, never the clause's own last word
// (v15: anchored at the phrase's start too — "that you have deserved it" is a clause, and with its determiner stripped the pronoun stands first)
const HEAD_NOUN_CUT = new RegExp(`(?:^|\\s+)(?:${[...CLAUSE_OPENERS, ...SUBJECT_PRONOUNS].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\s+|$)`, "iu");
const DET_ALL = new Set([..._DEF, ..._INDEF]);

/** The reader's own for-whom when a caller declares none: it collapses by nearness under the earned walls. */
export const DEFAULT_FOR_WHOM = Object.freeze({ id: "occupancy-reader:nearest-established", giver: "adapters/text/occupancy-testimony.js" });
/**
 * NEAREST_ESTABLISHED — the default collapse rule, every clause of it earned
 * by a registered run (results/occupancy-host-eval*-RESULTS.md): the last
 * established mention within OCCUPANT_GAP_MAX words is the occupant, unless
 * an unbound pronoun stands between it and the transition (v1's "German
 * universities, he was appointed"), or a subject-shaped phrase the reading
 * never established follows a comma in that gap (v1's "In December 2015,
 * Merkel"), or the clause OPENS with an unbound pronoun (v3's "He took office
 * on September 26, becoming") — then the true subject is something the
 * reading never reached, and the collapse is NONE with that reason.
 */
export const NEAREST_ESTABLISHED = Object.freeze({
  name: "nearest-established", giver: "adapters/text/occupancy-testimony.js, rules earned by the 2026-09-28 registered runs", params: { gapMax: 2 },
  decide(cands) {
    const est = cands.filter((c) => c.features.established);
    const last = est.length ? est.reduce((a, b) => (b.features.end > a.features.end ? b : a)) : null;
    if (!last || last.features.distanceWords > 2) return { reason: "occupant_not_a_referent" };
    const between = cands.filter((c) => !c.features.established && c.features.start >= last.features.end);
    if (between.some((c) => c.via === "pronoun-unbound")) return { contested: [last.index, ...between.map((c) => c.index)], reason: "pronoun_unbound" };
    if (last.features.subjectShapedAfterPunct) return { contested: [last.index, ...between.map((c) => c.index)], reason: "occupant_not_a_referent" };
    if (last.features.nounBetween === true) return { contested: [last.index, ...between.map((c) => c.index)], reason: "subject_unestablished" };
    const opener = cands.find((c) => c.via === "pronoun-unbound" && c.features.clauseInitial);
    if (opener) return { contested: [last.index, opener.index], reason: "pronoun_unbound" };
    return { chosen: last.index };
  },
});
/**
 * BEING_KIND — a second declared rule (v5, registered 2026-09-28: Y1 and Y2
 * held): NEAREST_ESTABLISHED, and the chosen candidate must be more often a
 * subject than a preposition's object — `verbShare > prepShare`, both read
 * off the material by the supplier with a received POS prior (company, P79;
 * never a month list). Unmeasured company is contested, never refused.
 */
export const BEING_KIND = Object.freeze({
  name: "being-kind", giver: "adapters/text/occupancy-testimony.js; company read with the UD_English-EWT POS prior by the supplier", params: { requires: "verbShare > prepShare" },
  decide(cands, record) {
    const base = NEAREST_ESTABLISHED.decide(cands, record);
    if (!Number.isInteger(base.chosen)) return base;
    const c = cands[base.chosen];
    if (c.features.verbShare == null || c.features.prepShare == null) return { contested: [c.index], reason: "company_unmeasured" };
    return c.features.verbShare > c.features.prepShare ? base : { contested: [c.index], reason: "not_being_kind" };
  },
});
// the prepositions that close a complement's head phrase: what follows is subordinate to it (lang/en, declared here)
const PREPOSITIONS = new Set(["of", "in", "on", "at", "from", "to", "for", "by", "with", "under", "over", "during", "after", "before", "until", "since", "among", "between", "within", "near", "behind", "beside", "beyond", "above", "below", "across", "through", "toward", "towards", "against", "along", "around", "into", "onto", "upon"]);
const HEAD_CUT = new RegExp(`\\s+(?:${[...PREPOSITIONS].join("|")})\\s+`, "iu");
/** A phrase reads as a name when name-spans.js accounts for every token (title / particle / given / head) and its head is capitalised. */
export const nameShaped = (phrase) => {
  const spans = nameSpans(phrase);
  if (!spans.length) return false;
  const head = spans.find((x) => x.relation === "head");
  if (!/^\p{Lu}/u.test(head.text)) return false;
  // a title AFTER the head is a description's noun ("the Austrian general"), never a name's decoration
  if (spans.some((x) => x.relation === "title" && x.start > head.start)) return false;
  const covered = spans.reduce((n, x) => n + 1, 0);
  const toks = String(phrase).match(/[\p{L}\p{N}][\p{L}\p{N}’'.-]*/gu) ?? [];
  const dets = toks.filter((t) => DET_ALL.has(t.toLowerCase())).length;
  return covered === toks.length - dets && spans.filter((x) => x.relation === "given").every((x) => /^\p{Lu}/u.test(x.text));
};
const BE_AUX = new Set(["was", "were", "is", "are", "been", "being", "be", "had been", "has been", "have been"]);
/** Between an occupant mention and its transition: at most this many words, each read. */
export const OCCUPANT_GAP_MAX = 2;

/** The class the POS prior settles a form into (its dominant tag), or null when the prior never saw it. */
export const settledClass = (posPrior, w) => { const t = posPrior?.forms?.[String(w ?? "").toLowerCase()]; if (!t) return null; let top = null, n = -1; for (const [k, c] of Object.entries(t)) if (c > n) { top = k; n = c; } return top; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const W = "\\p{L}[\\p{L}’'.-]*";          // any word
const CAP = "\\p{Lu}[\\p{L}’'.-]*";       // a capitalised word

/**
 * readOccupancyTestimony(sentences, { source, determiners, modals, negation,
 *   transitions, mentions, resolveLocus })
 * sentences: [{ text, at }]; determiners: { definite, indefinite } (priors.js);
 * modals / negation: closed classes (declared by the caller with givers);
 * mentions(sentence) -> [{ start, end, referent, via }] in the sentence's own
 *   coordinates — the reading pipeline's mentions; omitted = the ablation arm
 * pronouns: a received closed class (priors.js SUBJECT_PRONOUNS, lang/en); a
 *   pronoun in the gap the pipeline did not bind refuses the standing
 * resolveLocus(sentence, span, surface) -> { referent, via } | null
 * -> { candidates, refused, arm }
 */
export function readOccupancyTestimony(sentences, { source, determiners, modals, negation, transitions = OCCUPANCY_TRANSITIONS_EN, mentions = null, pronouns = null, posPrior = null, resolveLocus = null, complementTyping = "structural", forWhom = null, occupantRule = null, phasepost = null, cellOf = null, language = null, grammarFor: grammarLookup = null } = {}) {
  for (const [k, v] of Object.entries({ source, determiners, modals, negation })) if (v == null) throw new TypeError(`occupancy-testimony: '${k}' must be declared`);
  // THE GRAMMAR COMES ONLINE FOR A DECLARED LANGUAGE (adapters/text/grammar.js,
  // injected — never imported here, since the register imports this file's
  // own transition table). A declared language with no grammar is a typed
  // gap: the copula family and the fronted-phrase reading stand DOWN (they
  // are English organs), the entry families the caller handed in still run,
  // and the result says so. No language declared: the caller's own classes,
  // byte-identical to before.
  const grammar = language ? (grammarLookup ? grammarLookup(language) : { gap: { reason: "no_grammar_lookup", language, detail: "a language was declared but no grammarFor was injected" } }) : null;
  const clauseGrammar = grammar && !grammar.gap ? grammar.levels?.clause : null;
  const phraseGrammar = grammar && !grammar.gap ? grammar.levels?.phrase : null;
  if (grammar?.gap) transitions = { ...transitions, state: [] };
  else if (clauseGrammar?.transitions) transitions = clauseGrammar.transitions;
  const prepositions = phraseGrammar?.prepositions ?? PREPOSITIONS;
  const headCut = phraseGrammar?.prepositions ? new RegExp(`\\s+(?:${[...phraseGrammar.prepositions].join("|")})\\s+`, "iu") : HEAD_CUT;
  const def = determiners.definite, indef = determiners.indefinite;
  const alt = (xs) => xs.map(esc).join("|");
  const AUX = `(?:(?:${[...BE_AUX].map(esc).join("|")})\\s+)`;
  // the transition and its complement; what stands before it is decided by the mentions
  const patterns = [
    { kind: "succeed", re: new RegExp(`(?<![\\p{L}’'])(?<verb>${alt(transitions.succeed)})\\s+(?<pred>${W}(?:\\s+${W}){0,3}?)\\s+as\\s+(?<comp>.+)`, "u") },
    { kind: "assume", re: new RegExp(`(?<![\\p{L}’'])(?<verb>${alt(transitions.assume)})\\s+(?<comp>.+)`, "u") },
    { kind: "passive", re: new RegExp(`(?<![\\p{L}’'])${AUX}(?<verb>${alt(transitions.passive)})(?:\\s+as|\\s+to\\s+be)?\\s+(?<comp>.+)`, "u") },
    { kind: "become", re: new RegExp(`(?<![\\p{L}’'])${AUX}?(?<verb>${alt(transitions.become)})\\s+(?<comp>.+)`, "u") },
    // the state family: read last, so every entry pattern has had its turn
    ...(transitions.state?.length ? [{ kind: "state", re: new RegExp(`(?<![\\p{L}’'])(?<verb>${alt(transitions.state)})\\s+(?<comp>.+)`, "u") }] : []),
  ];
  // the ablation arm: a capitalised run ending right before the transition
  const capRun = new RegExp(`(?<occ>${CAP}(?:\\s+(?:of\\s+|de\\s+|von\\s+)?${CAP})*)\\s*$`, "u");
  const candidates = [], refused = [], events = [];
  const clean = (w) => w.toLowerCase().replace(/[^\p{L}’']/gu, "");
  const irrealisIn = (words) => words.some((w) => modals.has(w) || negation.has(w)) || words.includes("to");
  for (const sentence of sentences) {
    // A SOFT LINE BREAK IS A SPACE (Gutenberg hard-wraps prose; v11's "the
    // Austrian\ngeneral" read as "the Austrian" because `.` stops at a newline,
    // and v6's "became the\nlatter" made a locus of "the"). Length-preserving,
    // so every offset still names the sentence's own bytes.
    const { at } = sentence;
    const text = String(sentence.text).replace(/[\r\n]/g, " ");
    const ms = mentions ? [...(mentions(sentence) ?? [])].sort((a, b) => a.start - b.start) : null;
    let clauseStart = 0;
    for (const clause of String(text).split(/[;:]|(?:,\s+(?=(?:and|but|while|when|after|before)\s))/u)) {
      const here = text.indexOf(clause, clauseStart); if (here >= 0) clauseStart = here;
      const cStart = clauseStart;
      for (const p of patterns) {
        const m = p.re.exec(clause); if (!m) continue;
        const before = clause.slice(0, m.index);
        // SUBJECT INVERSION after a fronted phrase (v11's finding): "With Pfuel was
        // Wolzogen", "Among the prisoners rescued by Denísov was Pierre" — the
        // subject FOLLOWS the copula, and reading the last mention before the
        // verb as the occupant lands it backwards. A copula clause whose
        // pre-verbal material opens with a preposition is refused by name, the
        // post-verbal subject carried, never read as a standing.
        // v12 measured the first cut of this rule firing 859 times on War and
        // Peace — "In 1815, Murat was 25 years old" is a fronted ADJUNCT with an
        // ordinary subject after the comma, not an inversion. An inversion has
        // two marks, both read: no comma between the fronted phrase and the
        // copula, and a NAME-SHAPED complement (the displaced subject: "was
        // Wolzogen", "was Pierre Bezúkhov", "was Bennigsen and the suite").
        if (p.kind === "state") {
          const firstWord = (before.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");
          const displaced = m.groups.comp.trim().split(/,|\(|—|\s+(?:who|which|whom|and|but|while)\s+/u)[0].split(headCut)[0].replace(/[.,;”"’']+$/u, "").trim();
          if (prepositions.has(firstWord) && !/[,;:—]/.test(before) && nameShaped(displaced)) { refused.push({ at, reason: "inverted_subject", subject: displaced.slice(0, 80), clause: clause.trim().slice(0, 160) }); break; }
        }
        // the occupant: the pipeline's last mention before the transition, or the ablation's run
        let occupant, occupantSurface, occupantVia, gapWords;
        if (ms) {
          const tStart = cStart + m.index;
          // THE SLOT IS UNDECIDED UNTIL A FOR-WHOM COLLAPSES IT (kernel/undecided.js,
          // 2026-09-28). Every candidate the clause offers is kept with its
          // evidence: the pipeline's established mentions, the pronouns it did
          // NOT bind, the capitalised runs it never admitted. The default rule
          // (below, named) reproduces the walls the registered runs earned; a
          // for-whom with a stricter or looser rule collapses the same record
          // differently, and both stand.
          const prior = ms.filter((x) => x.end <= tStart && x.start >= cStart);
          const covered = (i) => prior.some((x) => cStart + i >= x.start && cStart + i < x.end);
          // A supplier may hand in an UNESTABLISHED mention with the evidence
          // its own floor discarded (a pronoun the binder refused, carrying
          // its top candidate and margin): kept as a candidate with that
          // evidence, never promoted here.
          const cands = prior.map((x) => (x.established === false
            ? { value: x.referent ?? null, via: x.via ?? "pronoun-unbound", features: { start: x.start - cStart, end: x.end - cStart, established: false, ...(x.features ?? {}) } }
            : { value: x.referent, via: x.via, features: { start: x.start - cStart, end: x.end - cStart, established: true, ...(x.features ?? {}) } }));
          for (const w of before.matchAll(/\S+/gu)) {
            if (covered(w.index)) continue;
            const c = clean(w[0]);
            if (pronouns && pronouns.has(c)) cands.push({ value: null, via: "pronoun-unbound", features: { start: w.index, end: w.index + w[0].length, established: false, word: c } });
            else if (w.index > 0 && /^\p{Lu}/u.test(w[0]) && !def.has(c) && !indef.has(c)) cands.push({ value: null, via: "unestablished-run", features: { start: w.index, end: w.index + w[0].length, established: false, word: w[0] } });
          }
          for (const c of cands) {
            const between = before.slice(c.features.end, m.index);
            const betweenWords = between.split(/\s+/).map(clean).filter(Boolean);
            c.features.distanceWords = betweenWords.length;
            // nounBetween (v6): a word the received POS prior SETTLES as a noun
            // standing between the candidate and the transition is the clause's
            // own subject ("ten Russian TOWNS have been named") — the candidate
            // before it is its modifier, not the occupant. Read only when a
            // prior is injected; absent, the feature is null, never false.
            c.features.nounBetween = posPrior ? betweenWords.some((w) => settledClass(posPrior, w) === "NOUN") : null;
            c.features.punctBetween = /[,;:—()]/.test(between);
            c.features.clauseInitial = before.slice(0, c.features.start).trim() === "";
            c.features.subjectShapedAfterPunct = c.features.punctBetween && between.slice(between.search(/[,;:—()]/) + 1).trim().split(/\s+/).filter(Boolean).some((w) => def.has(clean(w)) || indef.has(clean(w)) || /^\p{Lu}/u.test(w));
          }
          const record = undecided({ question: "occupant", slot: `${source}#s${at}@${tStart}`, giver: OCCUPANCY_TRANSITIONS_EN_META.giver, cursor: at, at: { sentence: at, clause: clause.trim().slice(0, 200) }, candidates: cands });
          const verdict = collapse(record, { forWhom: forWhom ?? DEFAULT_FOR_WHOM, rule: occupantRule ?? NEAREST_ESTABLISHED, cursor: at });
          events.push({ undecided: record, collapse: verdict });
          if (verdict.verdict !== "chosen") { refused.push({ at, reason: verdict.reason ?? "occupant_not_a_referent", occupant: verdict.contested?.[0]?.features?.word ?? before.trim().split(/\s+/).slice(-3).join(" "), clause: clause.trim().slice(0, 160), undecided: record.id }); break; }
          const last = verdict.chosen;
          gapWords = before.slice(last.features.end, m.index).split(/\s+/).map(clean).filter(Boolean);
          occupant = last.value; occupantVia = last.via; occupantSurface = before.slice(last.features.start, last.features.end);
        } else {
          const run = capRun.exec(before.replace(/\s+(?:\p{Ll}[\p{L}’']*)(?:\s+\p{Ll}[\p{L}’']*)?\s*$/u, ""));
          if (!run) { refused.push({ at, reason: "occupant_not_a_referent", occupant: before.trim().split(/\s+/).slice(-3).join(" "), clause: clause.trim().slice(0, 160) }); break; }
          occupant = occupantSurface = run.groups.occ; occupantVia = "surface";
          // a capitalised pronoun at a clause's head is not a referent on this arm either
          if (pronouns && pronouns.has(occupant.toLowerCase())) { refused.push({ at, reason: "pronoun_unbound", occupant, clause: clause.trim().slice(0, 160) }); break; }
          gapWords = before.slice(run.index + run.groups.occ.length).split(/\s+/).map(clean).filter(Boolean);
          const first = occupant.split(/\s+/)[0].toLowerCase();
          if (def.has(first) || indef.has(first)) { refused.push({ at, reason: "occupant_is_description", occupant, clause: clause.trim().slice(0, 160) }); break; }
        }
        // the words between, and the two before the occupant, READ for mood
        const lead = before.slice(0, Math.max(0, before.length - occupantSurface.length - gapWords.join(" ").length - 2)).split(/\s+/).filter(Boolean).slice(-2).map(clean);
        if (irrealisIn(gapWords) || irrealisIn(lead)) { refused.push({ at, reason: "irrealis", occupant: occupantSurface, clause: clause.trim().slice(0, 160) }); break; }
        const predecessor = m.groups.pred ?? null;
        let comp = m.groups.comp.trim().replace(/^[“"‘']+/u, "");
        // the copula's mood sits AFTER the verb ("was never the Chair", "is not yet King"):
        // the state family reads its complement's lead for irrealis the way the
        // entry families read the gap before the verb
        if (p.kind === "state" && irrealisIn(comp.split(/\s+/).slice(0, 3).map(clean))) { refused.push({ at, reason: "irrealis", occupant: occupantSurface, clause: clause.trim().slice(0, 160) }); break; }
        comp = comp.split(/\s+(?:and|but|while|which|who|in|on|at|from|after|until|when|during|for|by|with)\s+(?=\p{Ll}|\d)|,|\(|\[|—|\.\s/u)[0].trim();
        const first = comp.split(/\s+/)[0] ?? "";
        const fl = first.toLowerCase();
        let type;
        if (indef.has(fl)) type = "kind";
        else if (def.has(fl) || /^\p{Lu}/u.test(first)) type = "locus";
        else type = "state";
        // complementTyping "none" (an experiment's arm, 2026-09-28): every
        // complement is a candidate locus and positionsByPattern decides —
        // the structural typing reads capitalisation as the signal (L2) and
        // refuses "became vice president" as a state; the pattern (a locus
        // recurring across occupants) is the honest test of position-hood.
        if (type !== "locus" && complementTyping === "structural") { refused.push({ at, reason: type === "kind" ? "kind_membership" : "state_not_position", occupant: occupantSurface, complement: comp.slice(0, 80) }); break; }
        const locus = comp.replace(new RegExp(`^(?:${[...def].map(esc).join("|")})\\s+`, "iu"), "").replace(/[.”"’']+$/u, "").trim();
        const year = /\b(1[0-9]{3}|20[0-9]{2})\b/u.exec(clause)?.[1] ?? null;
        const compStart = cStart + clause.indexOf(m.groups.comp);
        // THE COMPLEMENT HAS A HEAD (v9's finding, results/occupancy-host-eval-v9-
        // RESULTS.md): "the most enjoyable balls in Moscow" holds an established
        // place name in an ADJUNCT, and asking the cast about the whole span
        // made Moscow a locus. Only the head phrase — the complement up to its
        // first preposition — is asked; the whole complement stays the surface.
        const headLen = (() => { const m2 = headCut.exec(comp); return m2 ? m2.index : comp.length; })();
        const headText = comp.slice(0, headLen).trim();
        // ...and a head phrase is asked only when it READS AS A NAME (v10's
        // finding: "the last Napoleon sent", "Napoleon's senseless flight" hold a
        // name and are not named by it) — name-spans.js decides: every token a
        // title, a particle or a capitalised name token, determiners aside.
        const where = resolveLocus && headText && nameShaped(headText) ? resolveLocus(sentence, { start: compStart, end: compStart + headText.length }, headText) : null;
        // LOCUS-SIDE BEING-KIND (2026-09-28, the counterpart of BEING_KIND on the
        // occupant): a locus the cast did not resolve must at least be NOMINAL
        // — its head phrase's last word, where the received POS prior settles
        // it, carries some NOUN/PROPN share. A word the prior settles with none
        // ("the latter": ADJ alone) names no position; "general" (ADJ 32, NOUN
        // 6, PROPN 10) is allowed — an asymmetric veto, never a NOUN-dominance
        // test, because the prior's dominant class of "count" is VERB. Read only
        // with a prior injected; a word the prior never saw is not refused.
        if (!where && posPrior) {
          const lastWord = (locus.split(headCut)[0].split(HEAD_NOUN_CUT)[0].trim().split(/\s+/).pop() ?? "").replace(/[^\p{L}’'-]/gu, "");
          const tags = posPrior.forms?.[lastWord.toLowerCase()] ?? null;
          if (tags && !((tags.NOUN ?? 0) + (tags.PROPN ?? 0) > 0)) { refused.push({ at, reason: "locus_not_nominal", occupant: occupantSurface, complement: comp.slice(0, 80), word: lastWord, classes: Object.keys(tags) }); break; }
        }
        let pred = predecessor;
        if (predecessor && ms) { const ps = cStart + clause.indexOf(predecessor); const hit = ms.find((x) => x.start >= ps && x.end <= ps + predecessor.length); if (hit) pred = hit.referent; }
        // THE ACT, on the cube (phasepost.js injected, an overlay never a gate):
        // which of the nine acts this transition performs, at which grain —
        // "became Count Bezúkhov" is not the same act as "was appointed
        // ambassador", and a consumer selects standings by ACT, never by verb.
        // A STATE is the transition of non-transition: its act is NUL·Ground,
        // declared by the family itself; the phasepost's own reading of the
        // copula (SIG, presence) rides beside it as `overlay`, never replaced.
        const overlay = phasepost ? phasepost({ end1: occupantSurface, label: m.groups.verb, end2: locus }) : null;
        const act = p.kind === "state"
          ? { op: "NUL", grain: "Ground", cell: cellOf ? cellOf("NUL", "Ground") : null, standing: "declared", because: "a state is the transition of non-transition — the act that changes nothing (direction 2026-09-28)", overlay }
          : overlay;
        // COPULA IDENTITY (v11's finding: "that Circassian was Sónya"): a state
        // clause whose complement is a TITLE-LESS name that the cast resolves
        // equates the occupant with a being, not a position. The row still
        // lands as a NUL standing (the law), and carries `identity` — the
        // material's own merge evidence (a description -> a name), for the
        // identity organ's supports; positionsByPattern never counts it as a locus.
        const identity = p.kind === "state" && where?.via === "cast" && !nameSpans(headText).some((x) => x.relation === "title")
          ? { surface: occupantSurface, into: where.id ?? where.referent, basis: "copula identity" } : null;
        candidates.push({ occupant, occupantVia, occupantSurface, locus: where?.referent ?? locus, locusId: where?.id ?? null, locusVia: where?.via ?? "surface", locusSurface: locus, predecessor: pred, pattern: p.kind, verb: m.groups.verb, act, identity, at, address: `${source}#s${at}`, year, clause: clause.trim().slice(0, 200) });
        break;
      }
    }
  }
  return { candidates, refused, events, arm: mentions ? "mentions" : "capitalised-run (ablation)", giver: OCCUPANCY_TRANSITIONS_EN_META.giver, grammar: grammar ? (grammar.gap ? { gap: grammar.gap } : { language: grammar.language, giver: grammar.giver }) : null };
}

/**
 * positionsByPattern(candidates) — a locus is a POSITION only with pattern
 * evidence: it recurs across two distinct occupant referents, or a standing
 * in it names a predecessor. A definite description held once ("the first
 * human to walk") is a Figure, not a position, and stays a description.
 */
export function positionsByPattern(candidates) {
  const by = new Map();
  for (const c of candidates) { if (c.identity) continue; const k = String(c.locus).toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const positions = [], descriptions = [];
  for (const [locus, cs] of by) {
    const occupants = new Set(cs.map((c) => c.occupant));
    const pointer = cs.some((c) => c.predecessor);
    (occupants.size >= 2 || pointer ? positions : descriptions).push({ locus, occupants: [...occupants], standings: cs.length, evidence: occupants.size >= 2 ? "two_occupants" : pointer ? "succession_pointer" : "held_once" });
  }
  return { positions, descriptions };
}

/** A position key a caller may use for kernel/sequence.js: the material's own
 *  address of the testimony, distinct per standing (a thing may hold one
 *  locus twice). */
export const testimonyRecord = (c) => ({ locus: c.locus.toLowerCase(), occupant: c.occupant, key: c.address, predecessor: c.predecessor, year: c.year });

/**
 * locusStandings(candidates, { merges, giver }) — WHAT KIND OF THING A LOCUS IS
 * is itself undecided (2026-09-28, the Bezúkhov specimen): the host's cast
 * folded "Pierre Bezúkhov" and "Count Cyril Vladímirovich Bezúkhov" into one
 * being under the title, while the material's own testimony says Pierre
 * BECAME Count Bezúkhov — a position with two occupants. Neither reading is
 * deleted: each locus gets an EOUndecided@1 record with two candidates,
 * `being` (evidence: the merges the cast made under this surface) and
 * `position` (evidence: distinct occupant referents, succession pointers,
 * standings), and LOCUS_BY_PATTERN collapses it for the reader's own for-whom
 * — two distinct occupants or a pointer → position; else contested. A
 * cast-trusting for-whom collapses the same record to `being`; both stand.
 *   merges: [{ surface, into, basis }] — the cast's own merge events for the
 *   loci in question (optional; absent, `being` carries no evidence).
 */
export const LOCUS_BY_PATTERN = Object.freeze({
  name: "locus-by-pattern", giver: "adapters/text/occupancy-testimony.js (positionsByPattern's own floor: two occupants or a succession pointer)", params: { minOccupants: 2 },
  decide(cands) {
    const pos = cands.find((c) => c.value === "position"), being = cands.find((c) => c.value === "being");
    if (pos && (pos.features.occupants >= 2 || pos.features.pointers >= 1)) return { chosen: pos.index, reason: pos.features.occupants >= 2 ? "two_occupants" : "succession_pointer" };
    return { contested: [pos?.index, being?.index].filter((i) => Number.isInteger(i)), reason: "held_once" };
  },
});
export function locusStandings(candidates, { merges = [], giver = OCCUPANCY_TRANSITIONS_EN_META.giver, forWhom = null, rule = LOCUS_BY_PATTERN } = {}) {
  const by = new Map();
  for (const c of candidates) { const k = String(c.locus); if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const out = [];
  for (const [locus, cs] of by) {
    const occupants = new Set(cs.map((c) => c.occupant));
    const pointers = cs.filter((c) => c.predecessor).length;
    const mine = merges.filter((m) => m.surface === locus || m.into === locus);
    const record = undecided({ question: "kind-of-locus", slot: locus, giver, cursor: Math.max(...cs.map((c) => c.at)), at: { standings: cs.map((c) => c.address) },
      candidates: [
        { value: "position", via: "occupancy-testimony", features: { occupants: occupants.size, pointers, standings: cs.length, occupantIds: [...occupants] } },
        { value: "being", via: "cast-merge", features: { merges: mine.length, mergedSurfaces: mine.map((m) => m.surface) } },
      ] });
    out.push({ locus, undecided: record, collapse: collapse(record, { forWhom: forWhom ?? DEFAULT_FOR_WHOM, rule, cursor: record.cursor }) });
  }
  return out;
}

// ── nesting names (v6 amendment; rebuilt on name-spans.js, "figure out nesting") ──
// Two occupants nest only when their NAMES do, read as trees (name-spans.js):
// "Monsieur Pierre"/"Pierre" is `full` (a title is decoration); "Pierre
// Bezúkhov"/"Count Cyril Vladímirovich Bezúkhov" is `none` (siblings under
// one head); a bare head or bare given ("Bezúkhov", "Pierre") is a PARTIAL
// level the names cannot settle — handed to the kernel as `ambiguous`, so
// the slot is contested rather than collapsed either way (S17's rule for the
// cast, applied to the position's occupants). `namesNest` is kept as the
// boolean face: full only.
import { nameNesting, nameSpans } from "./name-spans.js";
export const namesNest = (a, b, opts) => nameNesting(a, b, opts).level === "full";
/** The pair sets kernel/merge-standing.js reads: `nested` (full) and `ambiguous` (prefix / head / given). */
export function nestedOccupants(standings, faceOf, pairKey, opts) {
  const byLocus = new Map();
  for (const s of standings) { if (!byLocus.has(s.locus)) byLocus.set(s.locus, new Set()); byLocus.get(s.locus).add(s.occupant); }
  const nested = new Set(), ambiguous = new Set(), levels = new Map();
  for (const occ of byLocus.values()) { const ids = [...occ]; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const n = nameNesting(faceOf(ids[i]), faceOf(ids[j]), opts); const k = pairKey(ids[i], ids[j]); levels.set(k, n.level);
    if (n.level === "full") nested.add(k); else if (n.level !== "none") ambiguous.add(k);
  } }
  return Object.assign(nested, { ambiguous, levels });
}

// ── naming as testimony (2026-09-28, "Cyril: still unheard — named by his title, never predicated into it") ──
// v11's own finding: the old count is never the subject of a transition into
// his title; the material NAMES him with it — "Count Cyril Vladímirovich
// Bezúkhov". A name that carries a locus's own title and head, with givens
// the locus's known occupants do not wear, is testimony that a DISTINCT
// being held the locus: signed, never predicated (SIG·Ground — presence,
// declared by the family), and positionsByPattern is not handed it —
// `namedOccupants` returns its own rows for kernel/merge-standing.js's
// occupant slot to weigh beside the predicated standings. A naming that
// nests (full / prefix / given) with a known occupant's own face is that
// occupant named again, never a second being; only `none` against every
// known face is a new one — S17's rule, the names' own levels.
export function namedOccupants(sentences, candidates, { source, mentions = null, nameOpts = {}, cellOf = null } = {}) {
  if (source == null) throw new TypeError("occupancy-testimony: 'source' must be declared");
  const loci = new Map();
  for (const c of candidates) {
    const spans = nameSpans(c.locusSurface ?? String(c.locus), nameOpts);
    const title = spans.find((x) => x.relation === "title" && x.start === 0), head = spans.find((x) => x.relation === "head");
    if (!title || !head || spans.some((x) => x.relation === "given")) continue; // only a title + head locus ("Count Bezúkhov") names by title
    const k = `${title.key}|${head.key}`;
    if (!loci.has(k)) loci.set(k, { title, head, locus: c.locus, locusId: c.locusId ?? null, locusSurface: c.locusSurface ?? String(c.locus), faces: new Set() });
    loci.get(k).faces.add(c.occupantSurface ?? String(c.occupant));
  }
  const named = [];
  for (const sentence of sentences) {
    const { at } = sentence; const text = String(sentence.text).replace(/[\r\n]/g, " ");
    for (const L of loci.values()) {
      const re = new RegExp(`(?<![\\p{L}’'])${esc(L.title.text)}\\s+(?<run>(?:${CAP}\\s+){1,3})${esc(L.head.text)}(?![\\p{L}])`, "gu");
      for (const m of text.matchAll(re)) {
        const surface = m[0].trim();
        const levels = [...L.faces].map((f) => nameNesting(surface, f, nameOpts).level);
        if (levels.some((l) => l !== "none")) continue; // a known occupant, named again
        const ms = mentions ? [...(mentions(sentence) ?? [])] : [];
        const hit = ms.find((x) => x.start <= m.index && x.end >= m.index + m[0].length);
        named.push({ occupant: hit?.referent ?? surface, occupantVia: hit ? "naming+cast" : "naming", occupantSurface: surface, locus: L.locus, locusId: L.locusId, locusVia: "naming", locusSurface: L.locusSurface, predecessor: null, pattern: "naming", verb: null,
          act: { op: "SIG", grain: "Ground", cell: cellOf ? cellOf("SIG", "Ground") : null, standing: "declared", because: "a naming signs a being into a locus's title — presence, never a transition (direction 2026-09-28: named by his title, never predicated into it)" },
          identity: null, at, address: `${source}#s${at}`, year: /\b(1[0-9]{3}|20[0-9]{2})\b/u.exec(text)?.[1] ?? null, clause: text.trim().slice(0, 200), evidence: "named_by_title" });
      }
    }
  }
  return named;
}
