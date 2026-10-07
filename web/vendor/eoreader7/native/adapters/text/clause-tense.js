// adapters/text/clause-tense.js — an arrangement's TENSE, read from the
// Chomsky parser's own Universal Dependencies rows. English adapter; the
// values it emits are the universal inventory kernel/universal-grammar.js
// declares, so a Latin or Portuguese adapter that reads Pqp off a single
// inflected form lands on the same value this one reads off a construction.
//
// WHY THIS EXISTS. kernel/narrative-time.js (Partee's walk) first shipped
// with a stem+ed typer: honest, giver-named, and blind to every irregular
// past (went, said, came) — 13 of 182 arrangements typed in Alice ch2. The
// user: "check for our more universal tense typing, Chomsky." It was there:
// adapters/text/english-parser.js reads raw English into UD rows with the
// treebank's own Tense/VerbForm tallies, and universal-grammar.js already
// places Tense=Pqp as "a past before a past". This file joins the two.
//
// WHICH TOKENS ARE THE CLAUSE — measured, not assumed (2026-09-25). A
// ledger proposition's `at` is its END2's span (181 of 183 in Alice ch2:
// label "had slipped", at → "in like herself"), so the verb is never inside
// the span. The clause is therefore located by the LABEL: the run of
// tokens in the same parser sentence whose forms are the label's words,
// the occurrence nearest before the span; the verb is that run's last
// token, or — when the label is a bare auxiliary ("had" with end2 "somehow
// fallen into the sea") — the participle that auxiliary attaches to. The
// clause's auxiliaries are the AUX tokens whose head is that verb. Only if
// the label cannot be found does the span's own contents stand in.
//
// THE RULES, each read off UD's own annotation conventions for English
// (UD_English-EWT), never off a word list of this file's own:
//   Pqp        a FINITE AUX "have" in Tense=Past over a VerbForm=Part verb
//              — "had gone". English has no pluperfect inflection; UD marks
//              the construction on its two parts, and this is the one place
//              the construction is read back as the universal value.
//   Pres       a finite AUX "have" in Tense=Pres over a participle ("has
//              gone") — the present perfect is anchored at the speaker's
//              now, as Reichenbach and Partee both read it.
//   Past/Pres  otherwise, the Tense of the first FINITE token of the clause
//              (VerbForm=Fin), auxiliaries first — "was getting" reads Past
//              off "was", not Pres off "getting".
//   Fut        a modal AUX will/shall — UD English carries no Tense on
//              modals; the analytic future is a construction, as Pqp is.
//   undeclared no verb, or only non-finite forms ("having opened", a
//              gerund clause) — counted, never guessed.
import { sentences, tokenize, analyse } from "./english-parser.js";
import { UD_FEATURES } from "../../kernel/universal-grammar.js";
import { periodOverlap } from "./morph-cues.js";

export const TENSE_VALUES = Object.freeze([...UD_FEATURES.Tense, "undeclared"]);
export const PARSER_TREEBANK = "UD_English-EWT";
export const GIVER = "UD_English-EWT through adapters/text/english-parser.js (Chomsky): Tense and VerbForm per token from the treebank's own tallies; Pqp is universal-grammar.js's value ('a past before a past') read off the had+participle construction; Fut off a modal will/shall; the clause located by the ledger's own label";

/** parseWindow(model, text, base) — every token of `text` as a UD row with
 *  its ledger offset (`off`), its sentence index, and `headIndex` into this
 *  same array (-1 for a root). `base` is a number added to each offset, or a
 *  function mapping an offset in `text` to the ledger's coordinate (the
 *  origin's own, when the caller reads a normalised copy). */
export function parseWindow(model, text, base = 0) {
  const map = typeof base === "function" ? base : (i) => base + i;
  const rows = [];
  let si = 0;
  for (const s of sentences(text)) {
    const toks = tokenize(s.text);
    if (!toks.length) continue;
    const parsed = analyse(model, toks.map((t) => t.form));
    const first = rows.length;
    parsed.forEach((r, k) => rows.push({
      ...r, i: first + k, off: map(s.start + toks[k].start), end: map(s.start + toks[k].end),
      sentence: si, headIndex: r.head === 0 ? -1 : first + r.head - 1,
    }));
    si += 1;
  }
  return rows;
}

const feat = (r, name) => { const m = new RegExp(`(?:^|\\|)${name}=([^|]+)`).exec(r?.feats || ""); return m ? m[1] : null; };
const isVerbal = (r) => r.upos === "VERB" || r.upos === "AUX";

/** The label's token run in the sentence holding `at`, nearest before it. */
function locateLabel(rows, at, label) {
  const words = String(label ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const anchor = rows.find((r) => r.off >= at) ?? rows[rows.length - 1];
  if (!anchor) return null;
  const sent = rows.filter((r) => r.sentence === anchor.sentence);
  let best = null;
  for (let i = 0; i + words.length <= sent.length; i += 1) {
    if (!words.every((w, k) => sent[i + k].form.toLowerCase() === w)) continue;
    const run = sent.slice(i, i + words.length);
    const before = run[0].off <= at;
    if (!best || (before && !best.before) || (before === best.before && Math.abs(run[0].off - at) < Math.abs(best.run[0].off - at))) best = { run, before };
  }
  return best ? best.run : null;
}

function parserTense(verb, auxes) {
  const finiteHave = (tense) => auxes.find((r) => r.lemma === "have" && feat(r, "Tense") === tense && feat(r, "VerbForm") === "Fin");
  if (verb && feat(verb, "VerbForm") === "Part") {
    const pqp = finiteHave("Past");
    if (pqp) return { tense: "Pqp", basis: `AUX ${pqp.form} (Tense=Past) over ${verb.form} (VerbForm=Part)`, token: verb.off, spoke: pqp };
    const perf = finiteHave("Pres");
    if (perf) return { tense: "Pres", basis: `present perfect: AUX ${perf.form} over ${verb.form}`, token: verb.off, spoke: perf };
  }
  const fin = [...auxes, ...(verb ? [verb] : [])].find((r) => feat(r, "VerbForm") === "Fin" && feat(r, "Tense"));
  if (fin) return { tense: feat(fin, "Tense"), basis: `${fin.upos} ${fin.form} VerbForm=Fin`, token: fin.off, spoke: fin };
  const modal = auxes.find((r) => r.lemma === "will" || r.lemma === "shall");
  if (modal) return { tense: "Fut", basis: `modal ${modal.form}`, token: modal.off, spoke: modal };
  const all = [...auxes, ...(verb ? [verb] : [])];
  if (!all.length) return { tense: "undeclared", basis: "no verb or auxiliary token in the clause", token: null, spoke: null };
  return { tense: "undeclared", basis: `non-finite only: ${all.map((v) => `${v.form}(${feat(v, "VerbForm") || "_"})`).join(" ")}`, token: null, spoke: null };
}

// A SECOND WITNESS, NEVER A SECOND GIVER OVER THE FIRST. Sullivan's stored
// convention (morph-cues.js::witnessOf over priors/morph-cues-en.json) is
// asked about the same finite token the parser read. Where the parser
// stated a tense: agreement is recorded as corroboration, disagreement as
// a typed CONTEST — the parser's value stands, the rival is kept beside it.
// Where the parser had no tense on a finite token: a bound value from the
// witness fills it, and the basis names Sullivan and the cue that spoke.
// Unmarked or void from the witness changes nothing. The witness carries
// its giver, so a filled tense can always be traced to the treebank, period
// and register it was learned from.
// Two givers are the same source when their names share a treebank id —
// mechanical, on the string both carry, never a judgment.
const treebanksIn = (s) => new Set(String(s ?? "").match(/UD_[A-Za-z]+-[A-Za-z]+/g) ?? []);
const sameSource = (a, b) => { const A = treebanksIn(a), B = treebanksIn(b); for (const x of A) if (B.has(x)) return true; return false; };

// SEVERAL WITNESSES, IN DECLARED ORDER. Each is asked about the same finite
// token the parser read. Where the parser stated a tense: an agreeing
// witness is a corroboration, a disagreeing one a contest; the parser's
// value stands. Where the parser had none: the FIRST witness to bind fills
// it, and later witnesses corroborate or contest THAT. Every record says
// whether the witness is independent of whoever it agrees or disagrees
// with (PEARL'S CAVEAT, chorus 2026-09-25: the parser's lexicon and the EWT
// convention are two readers of one giver — `independent` is false when
// the two names share a treebank id), and whether the read's declared
// period overlaps the convention's declared span (null when either is
// undeclared; false is a disclosed mismatch, never a refusal).
function tenseOfClause(rows, verb, auxes, witnesses = [], period = null) {
  const r = parserTense(verb, auxes);
  const asked = r.spoke ?? (auxes.find((a) => feat(a, "VerbForm") === "Fin") ?? verb ?? auxes[0] ?? null);
  const { spoke, ...base } = r;
  if (!witnesses.length || !asked) return Object.freeze(base);
  const sent = { tokens: rows.filter((x) => x.sentence === asked.sentence) };
  const cueName = (c) => `${c.kind}=${JSON.stringify(c.key)}|${c.class} ${(100 * c.accuracy).toFixed(0)}%`;
  let out = { ...base };
  const corroborated = [], contested = [];
  for (const witness of witnesses) {
    const w = witness.predict(asked, sent);
    if (w.verdict !== "bound" || !TENSE_VALUES.includes(w.value)) continue;
    const overlap = periodOverlap(period, witness.language?.span ?? null);
    const rec = { witness: witness.giver, cue: cueName(w.cue), value: w.value, periodMismatch: overlap === false };
    if (out.tense === "undeclared") {
      out = { tense: w.value, basis: `Sullivan (${witness.language?.stage ?? witness.language?.iso ?? "unnamed stage"}): ${cueName(w.cue)} on ${asked.form}`, token: asked.off, filled: rec };
      continue;
    }
    const against = out.filled ? out.filled.witness : PARSER_TREEBANK;
    const record = { ...rec, independent: !sameSource(witness.giver, against) };
    if (w.value === out.tense) corroborated.push(record); else contested.push(record);
  }
  if (corroborated.length) out.corroborated = Object.freeze(corroborated);
  if (contested.length) out.contested = Object.freeze(contested);
  return Object.freeze(out);
}

/** clauseTense(rows, [start, end], label, { witness | witnesses, period }) → { tense, basis, token, located, filled?, corroborated?: [], contested?: [] } */
export function clauseTense(rows, span, label = null, { witness = null, witnesses = null, period = null } = {}) {
  const list = witnesses ?? (witness ? [witness] : []);
  const [start, end] = span;
  const run = locateLabel(rows, start, label);
  if (run) {
    let verb = run[run.length - 1];
    // a bare auxiliary label: the clause's verb is the participle it attaches to
    if (verb.upos === "AUX" && rows[verb.headIndex] && rows[verb.headIndex].upos === "VERB") verb = rows[verb.headIndex];
    const auxes = rows.filter((r) => r.upos === "AUX" && r.headIndex === verb.i && r.i !== verb.i);
    if (verb.upos === "AUX" && !auxes.includes(verb)) auxes.push(verb);
    return Object.freeze({ ...tenseOfClause(rows, verb.upos === "VERB" ? verb : null, auxes, list, period), located: "label" });
  }
  // fallback: the span's own tokens, plus any auxiliary attached to a verb inside it
  const inside = rows.filter((r) => r.off >= start && r.off < end);
  const insideIdx = new Set(inside.map((r) => r.i));
  const attachedAux = rows.filter((r) => r.upos === "AUX" && insideIdx.has(r.headIndex) && !insideIdx.has(r.i));
  const verbs = [...inside, ...attachedAux].filter(isVerbal).sort((a, b) => a.off - b.off);
  const verb = verbs.find((r) => r.upos === "VERB") ?? null;
  const auxes = verbs.filter((r) => r.upos === "AUX");
  return Object.freeze({ ...tenseOfClause(rows, verb, auxes, list, period), located: "span" });
}
