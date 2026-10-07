// native/organs/mouth-intent.js — an omnilingual replacement for Gary's
// keyword-regex prohibition check (native/tests/gary-doors.test.js's
// PROHIBITION = /\b(?:do not|don't|never|must not|should not|refrain
// from)\b/i), built 2026-09-26 after that regex both missed a real
// mouth-directed prohibition ("is NOT acceptable even if correct" — no fixed
// phrase in the list matches it) and would have flagged real domain facts in
// this repo's own lang-competency.js task specs ("a name never contains an
// equals sign", "an item is never paired with itself" — negation describing
// the PROBLEM, never a command to the reader).
//
// The distinction Gary's law actually cares about — a fact the mouth can
// reason from, versus a ban aimed at its own behaviour — is structural, not
// lexical, and Universal Dependencies already names the structure with no
// English words at all:
//
//   1. NO SUBJECT on the negated predicate (nsubj/csubj absent) — English's
//      elided-"you" imperative, the plainest command shape: "Do not use
//      JSON in your reply." Measured live against the production parser
//      (native/priors/parser-eng-ewt.json): root verb "use" (VerbForm=Inf)
//      carries no nsubj/csubj dependent at all.
//   2. The predicate's SUBJECT is itself a VERB in gerund/participle form
//      (upos=VERB, VerbForm=Ger|Part) — an ACTION or METHOD being evaluated,
//      not a piece of the problem: "Merging and concatenating is not
//      acceptable even if correct." Measured: subject node "Merging" is
//      upos=VERB, VerbForm=Part.
//   3. Anything else — the subject is a NOUN/PRON/PROPN — is a domain fact,
//      left alone. Measured: "A name never contains an equals sign" and "An
//      item is never paired with itself" both carry a NOUN subject (name,
//      item).
//
// Only the Polarity=Neg FEATS value, upos and the presence of an
// nsubj/csubj dependent are read — every one a Universal Dependencies label
// used identically across every UD-annotated language, so the same three
// rules apply to any language a parser has been trained for; nothing here
// is an English word.
//
// Input: `lines`, the raw CoNLL-U rows EOTRich already carries on
// `record.surface.lines` (eot-notation.js's loadEotParser().parse output) —
// read directly rather than re-parsing meaning.nodes, since HEAD/DEPREL live
// only in the CoNLL-U columns.

const CONLLU_ROW = /^\d+\t/;

function parseConlluLines(lines) {
  const rows = [];
  for (const line of lines ?? []) {
    if (!CONLLU_ROW.test(line)) continue;
    const cols = line.split("\t");
    if (cols.length < 8) continue;
    const [id, form, lemma, upos, , feats, head, deprel] = cols;
    rows.push({ id: Number(id), form, lemma, upos, feats: feats === "_" ? {} : Object.fromEntries(feats.split("|").map((kv) => kv.split("="))), head: Number(head), deprel });
  }
  return rows;
}

/** Does `head`'s id have an nsubj or csubj dependent among `rows`? */
function hasSubject(rows, headId) {
  return rows.some((r) => r.head === headId && (r.deprel === "nsubj" || r.deprel === "csubj" || r.deprel?.startsWith("nsubj:") || r.deprel?.startsWith("csubj:")));
}

/** The subject token itself, if one exists. */
function subjectOf(rows, headId) {
  return rows.find((r) => r.head === headId && (r.deprel === "nsubj" || r.deprel === "csubj" || r.deprel?.startsWith("nsubj:") || r.deprel?.startsWith("csubj:"))) ?? null;
}

// A predicate coordinated or subordinated to another clause shares that
// clause's subject even with no direct nsubj arc of its own ("the text was
// authored, not copied" -- copied is conj of the matrix verb mean, not of
// authored, yet "not copied" is a fact about the text, the same subject
// "mean" already carries). Measured live on two real, currently-shipped
// mouth constants (code-loop.js PROPOSAL_FORMAT) rather than assumed.
// parataxis deliberately excluded: measured live, it is also the label a
// confused parse reaches for when real input breaks the model (math notation
// like "O(log(min(m, n)))" in a real prompt this session derailed the
// tokenizer entirely, and the negated predicate landed as a parataxis of the
// sentence root purely as parser wreckage, not a real shared subject -- the
// walk-up must not paper over that with a false-clean verdict). conj/advcl/
// ccomp/xcomp are true clausal-linkage relations; parataxis is a loose
// juxtaposition label used for both real asyndeton and parser confusion
// alike, too weak a signal to inherit a subject through.
const CLAUSAL_LINK = new Set(["conj", "advcl", "ccomp", "xcomp"]);

/** Walk from `predicate` up through clausal-link ancestors to the nearest
 *  one that has its own subject; null if none does (a genuine root
 *  imperative, or a chain that never resolves to a subject at all). */
function ancestorSubject(rows, predicate) {
  let cur = predicate;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const subj = subjectOf(rows, cur.id);
    if (subj) return subj;
    if (!CLAUSAL_LINK.has(cur.deprel)) return null;
    cur = rows.find((r) => r.id === cur.head) ?? null;
  }
  return null;
}

/**
 * detectMouthDirectedNegation(lines) -> finding[] | []
 *
 * `lines` is one sentence's raw CoNLL-U rows (record.surface.lines from an
 * EOTRich parse). Each finding names the negated predicate's own text and
 * WHY it reads as addressee-directed: "no-subject" (imperative) or
 * "gerund-subject" (a method under evaluation). A negation whose subject is
 * an ordinary noun produces no finding at all — Gary's law does not touch
 * domain facts, so this is silent there, never a false alarm.
 */
export function detectMouthDirectedNegation(lines) {
  const rows = parseConlluLines(lines);
  const findings = [];
  for (const neg of rows) {
    // Measured live against the production parser: "not" is tagged
    // Polarity=Neg (PART), but "never" is tagged PronType=Neg (ADV, treated
    // as a negative pronominal adverb like "nobody"/"nothing") -- two real,
    // distinct UD feature encodings for negation, both required or "never
    // use recursion" reads as clean. Restricted to deprel=advmod (negating a
    // VERB/ADJ predicate): "no" in "contains no JSON" carries PronType=Neg
    // too but as a det on a NOUN ("no JSON" = zero JSON, a quantity fact
    // about that noun, not a negated action) -- measured live the same way,
    // and wrongly flagged as addressee-directed before this line existed.
    if ((neg.feats?.Polarity !== "Neg" && neg.feats?.PronType !== "Neg") || neg.deprel !== "advmod") continue;
    const predicate = rows.find((r) => r.id === neg.head);
    // A predicate is a VERB or ADJ; "not" attached to a NOUN is bare
    // noun-phrase negation ("this workspace is sandboxed, not the real
    // disk") -- measured live, no subject relation applies to a noun at
    // all, and treating one as a subjectless predicate false-flagged it.
    if (!predicate || (predicate.upos !== "VERB" && predicate.upos !== "ADJ")) continue;
    // A predicate attached to ITS OWN head via acl/acl:relcl is a reduced
    // relative or clausal modifier of a noun ("any file not shown above") --
    // it describes that noun and has no subject of its own by construction,
    // the same reason a bare noun negation is never addressee-directed, one
    // level deeper. Measured live: code-loop.js's own PROPOSAL_FORMAT.
    if (predicate.deprel?.startsWith("acl")) continue;
    const subj = subjectOf(rows, predicate.id) ?? ancestorSubject(rows, predicate);
    if (!subj) {
      findings.push({ kind: "addressee-directed", why: "no-subject", predicate: predicate.form, negator: neg.form });
      continue;
    }
    if (subj.upos === "VERB" && (subj.feats?.VerbForm === "Ger" || subj.feats?.VerbForm === "Part")) {
      findings.push({ kind: "addressee-directed", why: "gerund-subject", predicate: predicate.form, negator: neg.form, subject: subj.form });
    }
    // upos NOUN/PRON/PROPN (or anything else): a domain fact, no finding.
  }
  return findings;
}

/**
 * garyIntentCheck(records) -> { ok, findings } over EOTRich records (the
 * shape loadEotParser().parse(text) returns — one record per sentence, each
 * carrying surface.lines). `ok` is false only when an addressee-directed
 * negation is found; a parser that returned nothing (records: []) reads as
 * ok — an absence of sentences is not evidence of a prohibition.
 */
export function garyIntentCheck(records) {
  const findings = (records ?? []).flatMap((r) => detectMouthDirectedNegation(r?.surface?.lines).map((f) => ({ ...f, sentence: r?.surface?.text ?? null })));
  return { ok: findings.length === 0, findings };
}
