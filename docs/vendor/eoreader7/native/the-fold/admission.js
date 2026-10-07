// admission.js — THE SELECTOR, MADE OMNILINGUAL AND OMNITASK.
//
// The division this repo runs on is model-as-generator, machinery-as-selector:
// the mouth is drawn wide with a minimal positive prompt, and the MACHINERY
// decides what survives. That division was sound. The selector was not — it
// was written in English, about essays, with the topic's own words compiled
// into it.
//
// Measured 2026-09-21, before this module existed:
//
//   * `claimCoreOfStable` stripped every character outside [a-z'], so in
//     Chinese, Arabic, Russian and Hindi EVERY sentence's claim core was the
//     empty string. The first sentence deposited "" in the registry and every
//     later sentence in the document collided with it. A non-Latin document
//     could not exceed one sentence. Not a degradation — a wall.
//   * The sentence splitter `(?<=[.!?])\s+(?=[A-Z])` requires an ASCII capital
//     after the break, so a non-Latin paragraph never split at all: one
//     candidate, one refusal, nothing.
//   * The variance vocabulary was a hand-written Set containing "cumberland"
//     and "nashville" — the topic of one run, compiled into the engine.
//
// And one defect that is not about language at all: the selector admitted a
// sentence only when it was GROUNDED and its claim was NEW. Both tests reward
// a fresh assertion about the subject and punish a sentence that TURNS — a
// bridging sentence carries pronouns and connectives, resolves to few
// referents, and has a thin claim core. So the survivors were, structurally,
// a list of assertions about the topic. Thirteen topics, never a turn.
//
// This module is the repair, and it holds three laws:
//
//   1. NO HAND-SET CONSTANT. Every vocabulary and every cut is MEASURED from
//      the material against a null. The variance words are the words whose
//      spread across the ground exceeds what a shuffle of the same tokens
//      scattering would already achieve; the bond a continuation must clear is
//      the bond arbitrary ground sentences already have. Nothing here
//      knows what a river is, what English is, or what an essay is.
//   2. TWO ROADS INTO THE PIECE. A sentence is admitted when it carries NEW
//      MATTER (grounded and claim-new) or when it carries MOTION (it bonds to
//      where the piece just landed, harder than chance, carrying no invented
//      referent). Matter alone is a list. Motion alone is drift. A piece needs
//      both roads open, and the record says which road each sentence took.
//   3. A REFUSAL IS ATTRIBUTED, NEVER VANISHED. Every refusal names its kind
//      and its given, so the piece can state what it cut and who said it.
//
// Nothing in this file is essay-specific. The same selector runs over a story,
// a report, a spec or a letter — the caller supplies the ground, the prior
// landing and the registry; the register decides nothing here.

/** Does this text's script carry case at all? Exact, script-neutral: a
 * character has case when its upper and lower forms differ. Chinese, Arabic,
 * Hebrew, Hindi, Japanese, Korean and Thai answer no — which is why a
 * capitalization-based name gate is a silent no-op there, and why this module
 * says so out loud rather than pretending to guard. */
export function scriptHasCase(text) {
  for (const ch of String(text ?? "")) {
    if (ch.toUpperCase() !== ch.toLowerCase()) return true;
  }
  return false;
}

const segCache = new Map();
function segmenter(locale, granularity) {
  const key = `${locale ?? "und"}:${granularity}`;
  let s = segCache.get(key);
  if (s) return s;
  try {
    s = new Intl.Segmenter(locale || undefined, { granularity });
  } catch {
    s = null;
  }
  segCache.set(key, s);
  return s;
}

/** Sentences, by the script's own boundary rules. ICU knows that 。 ends a
 * Chinese sentence and ؟ an Arabic one; the old ASCII regex knew only that a
 * period followed by a capital letter ends an English one. */
export function segmentSentences(text, locale) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  const seg = segmenter(locale, "sentence");
  const raw = [];
  if (!seg) raw.push(...s.split(/(?<=[.!?。！？؟।])\s*/).map((x) => x.trim()).filter(Boolean));
  else for (const { segment } of seg.segment(s)) { const t = segment.trim(); if (t) raw.push(t); }
  // AN INITIAL IS NOT A SENTENCE END (2026-09-21, measured on the mouth's own
  // prose: "The U.S. Army Corps of Engineers built…" came back as "The U.S."
  // plus a fragment, and the short half was then filtered away). A segment
  // ending in a lone capital and a period ("U.", "U.S.", "T.") or a short
  // capitalised abbreviation before a capitalised word ("Dr. Thomas") is
  // joined to the next. Structural, in scripts with case; a no-op elsewhere.
  const out = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    if (prev && (/(?:^|[\s(])(?:\p{Lu}\.)+$/u.test(prev) || (/(?:^|\s)\p{Lu}\p{Ll}{1,2}\.$/u.test(prev) && /^\p{Lu}/u.test(t)))) {
      out[out.length - 1] = `${prev} ${t}`;
    } else out.push(t);
  }
  return out;
}

/** THE MOUTH MIMICS ITS OWN PROMPT'S PUNCTUATION (2026-09-25, measured live:
 *  a point-level rewrite prompt shows its inputs in double quotes — 'A fact
 *  from the source: "…"', 'The piece says: "…"' — and the mouth wrapped its
 *  OWN answer in quotes too, which then read as the sentence's own text all
 *  the way to the final assembled piece). A candidate unit that is ENTIRELY
 *  wrapped in one matching pair of double quotes (straight or curly) has
 *  that outer pair stripped — never an internal quotation ('The mayor said
 *  "we will rebuild."' is untouched, since it does not itself begin with a
 *  quote mark). Mechanical, not a model call: the mouth is never trusted to
 *  know its own formatting. Single quotes are left alone, on purpose — a
 *  possessive or a contraction's apostrophe should never be read as a wrap. */
export function stripMouthQuoting(s) {
  const t = String(s ?? "").trim();
  for (const [open, close] of [['"', '"'], ["“", "”"]]) {
    if (t.length > 1 && t[0] === open && t[t.length - 1] === close) return t.slice(1, -1).trim();
  }
  return t;
}

/** The ground's DISTINCT sentences. A corpus stores a file as overlapping
 * chunks, so the same sentence arrives two or three times; measured live
 * 2026-09-21, a 25-sentence file became 205 ground sentences and the bond
 * null's "two arbitrary passages" found identical ones — a ceiling of 1.000,
 * which closes the motion road and makes every grounded sentence a repeat.
 * Two copies of a sentence are one passage. */
export function distinctSentences(text, locale) {
  const seen = new Set();
  const cands = [];
  for (const s of segmentSentences(text, locale)) {
    const toks = wordTokens(s, locale);
    const k = toks.join(" ");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    cands.push({ s, set: new Set(toks) });
  }
  // A FRAGMENT IS NOT A PASSAGE (2026-09-21, measured: after exact dedupe a
  // 25-sentence file still yielded 176 "distinct" sentences, because the
  // intake's chunks cut sentences mid-way, and a fragment's tokens are a
  // subset of its whole sentence's — bond 1, ceiling pinned). A sentence
  // whose token set is contained in another's is that sentence's fragment
  // and is dropped; the longest form stands.
  cands.sort((a, b) => b.set.size - a.set.size);
  const kept = [];
  for (const c of cands) {
    let contained = false;
    for (const k of kept) {
      if (k.set.size <= c.set.size) continue;
      let inside = true;
      for (const w of c.set) { if (!k.set.has(w)) { inside = false; break; } }
      if (inside) { contained = true; break; }
    }
    // ONE PASSAGE, MEASURED THE SAME WAY EVERYWHERE (2026-09-21): two
    // sentences whose words differ by at most one on each side are one
    // passage twice — a chunk boundary adding "Then" or "there". The bond
    // null already treated them so; the variance count did not, so each
    // near-duplicate tripled its words' spread, turned them into "variance",
    // and left an unrelated pair looking bonded (a ceiling of 0.5 from
    // "It flows 688 miles…" against "The flood of May 2010…"). The rule now
    // lives here, where both measurements read from.
    if (!contained) {
      for (const k of kept) {
        let onlyC = 0, onlyK = 0;
        for (const w of c.set) if (!k.set.has(w)) { onlyC++; if (onlyC > 1) break; }
        if (onlyC > 1) continue;
        for (const w of k.set) if (!c.set.has(w)) { onlyK++; if (onlyK > 1) break; }
        if (onlyK <= 1) { contained = true; break; }
      }
    }
    if (!contained) kept.push(c);
  }
  return kept.map((c) => c.s);
}

/** Word-like tokens, by the script's own word rules. In Chinese and Japanese
 * this is real segmentation, not a whitespace split — which is the whole
 * reason the old tokenizer returned nothing there. */
export function wordTokens(text, locale) {
  const s = String(text ?? "");
  if (!s.trim()) return [];
  const seg = segmenter(locale, "word");
  if (!seg) return s.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const out = [];
  for (const { segment, isWordLike } of seg.segment(s)) {
    if (isWordLike) out.push(segment.toLowerCase());
  }
  return out;
}

/**
 * measureVariance(ground, locale) -> the set of words that carry no claim
 * identity IN THIS MATERIAL, found by a null rather than declared.
 *
 * A word spread across the whole of the ground distinguishes nothing: it is
 * the material's own connective tissue ("the", "river", "gorod"). A word that
 * clusters in one place is where a claim lives. The line between them is
 * MEASURED, and the null is exact rather than sampled: a word said k times,
 * dropped into N sentences independently, would be expected to occupy
 *
 *     N * (1 - (1 - 1/N)^k)
 *
 * distinct sentences. A word occupying AT LEAST that many is spread as widely
 * as chance allows -- it belongs to the whole material, not to any claim in
 * it. A word occupying fewer has clustered, and clustering is what a claim
 * looks like from the outside.
 *
 * A word said ONCE has no distribution to measure -- one occurrence occupies
 * one sentence in every possible world -- so it is never called variance. That
 * is not a tuned cut; it is a statement about what a single observation can
 * support.
 *
 * This is what replaces the hand-written Set. "cumberland" and "nashville" are
 * variance words of the Cumberland material because THAT MATERIAL says them
 * throughout -- the engine was never told their names, and it holds no word of
 * any language.
 */
export function measureVariance(ground, locale) {
  const sentences = distinctSentences(ground, locale);
  const N = sentences.length;
  if (N < 3) return new Set();
  const df = new Map();
  const tf = new Map();
  for (const sent of sentences) {
    const toks = wordTokens(sent, locale);
    for (const w of toks) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of new Set(toks)) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const variance = new Set();
  for (const [w, seen] of df) {
    const k = tf.get(w) ?? seen;
    if (k < 2) continue;
    const expected = N * (1 - Math.pow(1 - 1 / N, k));
    if (seen >= expected) variance.add(w);
  }
  return variance;
}

/**
 * claimCore(sentence, variance, locale) → the mechanical identity of what a
 * sentence CLAIMS, with the material's variance words stripped. Two sentences
 * that say the same thing in different words fold to the same core, and the
 * registry refuses the second. Unlike its predecessor this survives every
 * script, because the tokens come from the script's own word rules.
 */
export function claimCore(sentence, variance, locale, { width = 6 } = {}) {
  const v = variance instanceof Set ? variance : new Set();
  const words = wordTokens(sentence, locale).filter((w) => !v.has(w));
  return words.slice(0, width).join(" ");
}

/**
 * matterWords(sentence, ground, variance) -> the sentence's grounded,
 * non-variance words: what it asserts that the material holds. The registry
 * deposits these (as "w:<word>") beside the claim core, and a sentence that
 * brings none new is a repeat however it is phrased.
 */
export function matterWords(sentence, ground, variance, locale) {
  const known = groundVocabulary(ground, locale);
  const v = variance instanceof Set ? variance : new Set();
  return [...new Set(wordTokens(sentence, locale))].filter((w) => known.has(w) && !v.has(w));
}
const vocabCache = new Map();
function groundVocabulary(ground, locale) {
  const key = `${locale ?? ""}|${ground}`;
  let set = vocabCache.get(key);
  if (!set) { set = new Set(wordTokens(ground, locale)); if (vocabCache.size > 32) vocabCache.clear(); vocabCache.set(key, set); }
  return set;
}

/** deposit(registry, verdict) -> record an admitted sentence's core and matter
 * so no later sentence re-asserts either. The caller's one line after admit. */
export function deposit(registry, verdict) {
  if (!(registry instanceof Set) || !verdict) return registry;
  if (verdict.core) registry.add(verdict.core);
  for (const w of verdict.matter ?? []) registry.add(`w:${w}`);
  return registry;
}

function differByAtMostOne(a, b, locale, variance) {
  const v = variance instanceof Set ? variance : new Set();
  const A = new Set(wordTokens(a, locale).filter((w) => !v.has(w)));
  const B = new Set(wordTokens(b, locale).filter((w) => !v.has(w)));
  let onlyA = 0, onlyB = 0;
  for (const w of A) if (!B.has(w)) { onlyA++; if (onlyA > 1) return false; }
  for (const w of B) if (!A.has(w)) { onlyB++; if (onlyB > 1) return false; }
  return true;
}

/** Overlap of two passages' word-like tokens — the share of the candidate's
 * own vocabulary that the other passage already holds. Clark's common ground,
 * counted. */
export function bond(a, b, locale, variance) {
  const v = variance instanceof Set ? variance : new Set();
  const A = new Set(wordTokens(a, locale).filter((w) => !v.has(w)));
  const B = new Set(wordTokens(b, locale).filter((w) => !v.has(w)));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / A.size;
}

/**
 * measureBondNull(ground, locale, variance) -> how much two ARBITRARY passages
 * of this material already share.
 *
 * A sentence that bonds to the prior landing no better than two unrelated
 * sentences of the ground bond to each other is not continuing anything; it is
 * merely speaking the same subject. The line a continuation must clear is this
 * null's ceiling, and the MATERIAL sets it -- a dense, repetitive ground
 * demands a tighter bond than a loose one.
 *
 * Every distinct pair is measured, not a sample, so the null is exact and the
 * same ground yields the same ceiling forever.
 */
export function measureBondNull(ground, locale, variance) {
  const sentences = distinctSentences(ground, locale);
  if (sentences.length < 3) return { max: 1, mean: 1, pairs: 0 };
  let max = 0, sum = 0, n = 0;
  for (let i = 0; i < sentences.length; i++) {
    for (let j = 0; j < sentences.length; j++) {
      if (i === j) continue;
      const b = bond(sentences[i], sentences[j], locale, variance);
      // TWO SENTENCES THAT DIFFER BY ONE CLAIM WORD ARE ONE PASSAGE (measured
      // live 2026-09-21: with containment excluded the ceiling still sat at
      // 0.926 — chunk variants of the same sentence carrying one boundary
      // token more or less). One token is a structural difference, not a
      // fraction; a pair closer than that is the same passage twice.
      if (differByAtMostOne(sentences[i], sentences[j], locale, variance)) continue;
      // A PASSAGE WHOLLY CONTAINED IN ANOTHER IS NOT A SECOND PASSAGE. Bond
      // strips variance before comparing, so a sentence whose claim words all
      // sit inside another's has bond 1 even when its raw tokens do not (the
      // raw containment test in distinctSentences cannot see it). Measured
      // live 2026-09-21: 160 distinct strings, ceiling still 1.000. Such a
      // pair is one passage twice, and says nothing about two arbitrary ones.
      if (b >= 1) continue;
      sum += b; n++;
      if (b > max) max = b;
    }
  }
  return { max, mean: n ? sum / n : 0, pairs: n };
}

/**
 * ungroundedTokenRuns(sentence, ground, locale) → runs of adjacent word-like
 * tokens the ground has never held, for scripts WITHOUT case.
 *
 * Where a script has case, `referent-verify.js` already reads names off
 * capitalization and this module defers to it. Where it does not, there is no
 * name signal in the orthography at all, and this module does NOT pretend to
 * have one: it reports unknown token runs so the caller can weigh them, and
 * `nameGate` below states plainly that the gate is the referent index, not
 * this. Naming the ceiling beats faking a floor.
 */
export function ungroundedTokenRuns(sentence, ground, locale) {
  const known = new Set(wordTokens(ground, locale));
  const toks = wordTokens(sentence, locale);
  const runs = [];
  let cur = [];
  for (const t of toks) {
    if (!known.has(t) && t.length > 1) cur.push(t);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Which gate actually guards invented referents for this material. Stated,
 * not assumed — a caller that reads `gate: "referent-index"` knows the
 * capitalization guard is off and the reading's own index is carrying it. */
export function nameGate(ground) {
  return scriptHasCase(ground) ? { gate: "capitalization", applies: true } : { gate: "referent-index", applies: false };
}

/**
 * looksMeta(sentence, { instruction, ground, locale }) → is the mouth talking
 * ABOUT the piece instead of writing it?
 *
 * The predecessor was an English regex listing "the user", "this essay",
 * "asked to write" — which catches nothing in any other language. The
 * mechanical form is language-free: a sentence of the piece speaks the
 * MATERIAL'S vocabulary; a sentence about the task speaks the INSTRUCTION'S.
 * Measure both bonds and compare. No list of forbidden phrases, in any
 * language, ever again.
 */
export function looksMeta(sentence, { instruction = "", ground = "", variance = null, locale } = {}) {
  if (!String(instruction).trim() || !String(ground).trim()) return false;
  // THE SUBJECT'S OWN WORDS CANNOT DISCRIMINATE (2026-09-21, falsified
  // offline: "The Cumberland River shaped Nashville's growth as a port" read
  // as meta because the task names the river). A word the instruction shares
  // with the ground is the subject; a word only the instruction has is the
  // scaffolding ("write", "essay", "kind", "hold", "material"). Both counts
  // are taken after the material's variance is stripped, and the verdict is
  // a comparison of counts, never a ratio against a chosen bar: the sentence
  // leans on the scaffolding when it touches more scaffold words than ground
  // words.
  const v = variance instanceof Set ? variance : new Set();
  const known = groundVocabulary(ground, locale);
  const scaffold = new Set(wordTokens(instruction, locale).filter((w) => !known.has(w) && !v.has(w)));
  if (!scaffold.size) return false;
  const toks = [...new Set(wordTokens(sentence, locale))].filter((w) => !v.has(w));
  let scaffoldHits = 0, groundHits = 0;
  for (const w of toks) { if (scaffold.has(w)) scaffoldHits++; else if (known.has(w)) groundHits++; }
  return scaffoldHits > groundHits;
}

/**
 * admit(candidate, context) → the verdict, and the ROAD it came in on.
 *
 * MATTER: grounded, and a claim the registry has not already deposited. This
 * is what the old selector did, and it is what builds a piece's substance.
 *
 * MOTION: it takes up a referent the piece just put down, carrying no
 * invented referent and not meta. This road did not exist, and its absence is exactly why every
 * surviving sentence was a fresh assertion about the topic. A sentence that
 * turns the piece rarely resolves cleanly to a referent — it carries pronouns
 * and connectives — so the grounded test refused it and the piece never moved.
 *
 * A candidate that repeats a deposited claim is refused on BOTH roads: motion
 * is not a licence to say the same thing again.
 */
export function admit(candidate, {
  ground = "",
  priorLanding = "",
  instruction = "",
  registry = null,
  variance = null,
  bondNull = null,
  locale,
  isGrounded = null,
  invented = null,
  continues = null,
  verse = false,
  linked = null,
} = {}) {
  const s = String(candidate ?? "").trim();
  const refused = [];
  if (!s) return { admit: false, road: null, refused: [{ kind: "empty", given: "model" }] };
  // VERSE (2026-09-22, nine-sonnet-2): a line of a poem carries an image, not
  // an assertion — "A ribbon of silver, through the hills it flows" grounds
  // to nothing and is not a repeat of anything, and the matter road refused
  // nine of fourteen lines. A line is refused only for what a line can do
  // wrong: leak the apparatus (meta) or name what the material does not
  // (invented). The facts are the PART's charge, checked by coverage.
  if (verse) {
    if (looksMeta(s, { instruction, ground, variance: variance instanceof Set ? variance : measureVariance(ground, locale), locale })) return { admit: false, road: null, refused: [{ kind: "meta", given: "model" }] };
    const runs = typeof invented === "function" ? (invented(s) ?? []) : [];
    if (runs.length) return { admit: false, road: null, refused: [{ kind: "invented", given: "model", runs }] };
    return { admit: true, road: "verse", core: null, matter: [], refused };
  }

  // A SENTENCE THE MODEL SAYS IS GROUNDED ONLY IF IT LINKS (2026-09-30, user direction: "anything the model says that can't be
  // holographically linked to an auditable source is ungrounded by definition"; "trace it in real time and have this activation
  // feed generation"). `linked` is ground-trace.js's tracer for this composition's ground. A candidate that carries its claim in
  // no one sentence of the ground is refused on BOTH roads — the motion road admits a turn, never an unsourced claim — and an
  // admitted one returns the source sentence it lit (`lit`), which the caller deposits so the next window is built from what
  // the output has not yet lit.
  let lit = null;
  if (typeof linked === "function") {
    const t = linked(s);
    if (t.status === "ungrounded") return { admit: false, road: null, refused: [{ kind: "unlinked", given: "model", basis: "no sentence of the ground carries more than half of this sentence's words (and its numbers)" }] };
    if (t.status === "linked") lit = t.link;
  }

  const v = variance instanceof Set ? variance : measureVariance(ground, locale);
  const core = claimCore(s, v, locale);
  const reg = registry instanceof Set ? registry : new Set();

  if (core && reg.has(core)) {
    return { admit: false, road: null, core, refused: [{ kind: "repeat", given: "model", core, basis: "same claim core as a deposited sentence" }] };
  }
  // NO NEW MATTER IS A REPEAT (2026-09-21, falsified live: "carved its path
  // through the landscape, shaping the city's growth" and "...shaping the
  // city's development" differ at the sixth word of a six-word core and both
  // survived). A sentence's MATTER is its grounded, non-variance words — the
  // words that assert something the material holds. A sentence whose every
  // matter word is already deposited asserts nothing new, whatever its
  // wording. A sentence with NO matter words is not judged here: it carries
  // no assertion, and only the motion road can admit it.
  // THE FRACTION IS MEASURED AGAINST THE NULL (falsified once more: "it"
  // occurs once in a small ground, so a pronoun alone licensed a restated
  // claim). Two arbitrary passages of this material share at most the bond
  // ceiling, so an arbitrary NEW sentence brings at least (1 - ceiling) new
  // matter. A candidate whose new-matter fraction is at or below the ceiling
  // is far outside that null: it is a restatement. At a ceiling of zero this
  // degrades to "no new matter at all", never to a chosen constant.
  // MOTION IS REFERENT CONTINUITY, NOT WORD OVERLAP (2026-09-21, measured and
  // falsified). The first design asked whether a candidate's words overlapped
  // the prior landing's harder than two arbitrary passages of the material
  // overlap. Measured against the source's OWN adjacent sentences — which are
  // true continuations by construction — that test fired on 0 of 24, because
  // `bond` strips the material's variance words and cohesion lives in exactly
  // those: the pronoun, the repeated topic noun, the connective. Counting the
  // variance words back in barely separates anything (true pairs mean 0.178,
  // arbitrary pairs 0.161; a per-candidate rule fires on 67% of true pairs
  // and 50% of false ones). Lexical overlap does not know what a turn is.
  //
  // A turn is a sentence that takes up something the piece just put down —
  // a REFERENT, not a string. The caller supplies `continues`, backed by the
  // reading's own proposition index, and the string test survives only as the
  // stated fallback for a caller that has no index, which is honest about
  // being weak rather than silently deciding.
  const nul = bondNull ?? measureBondNull(ground, locale, v);
  const toPrior = priorLanding ? bond(s, priorLanding, locale, v) : 0;
  const isTurn = !!priorLanding && (typeof continues === "function"
    ? !!continues(s, priorLanding)
    : toPrior > (nul.max ?? 0));
  const matter = matterWords(s, ground, v, locale);
  // A NULL THAT WAS NEVER MEASURED IS NOT A CEILING (2026-09-21, found by a
  // test on a two-sentence ground): below three distinct sentences there are
  // no pairs to measure, and `measureBondNull` reports max 1 — which, read as
  // a ceiling, refused EVERY sentence as a repeat, since no fresh fraction can
  // exceed 1. Any short material would have come back as nothing but floors.
  // With no pairs measured the rule falls back to its exact form: a repeat is
  // a sentence that brings no new matter at all.
  const ceiling = (nul.pairs ?? 0) > 0 ? (nul.max ?? 0) : 0;
  if (matter.length) {
    const fresh = matter.filter((w) => !reg.has(`w:${w}`));
    if (fresh.length / matter.length <= ceiling) {
      return { admit: false, road: null, core, refused: [{ kind: "repeat", given: "model", core, basis: fresh.length ? `new matter ${fresh.length}/${matter.length} within the null ceiling ${ceiling.toFixed(2)}` : "no new matter" }] };
    }
  }
  // A TURN IS EXEMPT FROM THE META CHECK: a sentence that bonds to where the
  // piece just landed, harder than chance, is the piece continuing — its
  // connectives ("as", "or", "they") may well be scaffold words too, and
  // admission-falsify.test.mjs's own "a turn whose connectives are scaffold
  // words is admitted on motion, not refused as meta" locks in a real case
  // that would be wrongly refused without this exemption.
  //
  // CORRECTED (2026-09-26): this comment used to also claim "the chain
  // cannot start from a leak because the first leak has no prior to bond
  // to" — a real, verbatim leak observed live this session (a model
  // commenting on its own phrasing technique) refutes that: it bonded as a
  // turn to an ordinary PRECEDING sentence, not to a prior leak, so a leak
  // needs no prior leak to exploit this exemption. That specific leak is
  // now caught earlier — referent-verify.js's isMetaSentence runs
  // unconditionally in prosify.js before admit() is ever called — so this
  // exemption is not currently known to be exploited by any observed leak,
  // but the exemption's own safety no longer rests on the disproven claim
  // above. Measured, so the bond and the ceiling are computed once here.
  if (!isTurn && looksMeta(s, { instruction, ground, variance: v, locale })) {
    return { admit: false, road: null, core, refused: [{ kind: "meta", given: "model" }] };
  }
  const inventedRuns = typeof invented === "function" ? (invented(s) ?? []) : [];
  if (inventedRuns.length) {
    return { admit: false, road: null, core, refused: [{ kind: "invented", given: "model", runs: inventedRuns }] };
  }

  // A SENTENCE IS JUDGED BY WHAT IT DOES, NOT BY WHICH TEST FIRES FIRST
  // (2026-09-21, read off a finished run: every section reported "0 motion"
  // and burned a redraw on it, across two whole runs). The grounded branch
  // used to RETURN before the turn was ever tested, so a sentence that both
  // asserted something grounded AND answered the prior landing was recorded
  // as matter alone. Motion could therefore only be reported for a sentence
  // that grounded to nothing — which is the rarest and weakest kind of turn.
  // The best sentence in a piece does both, and the record now says so.
  const grounded = typeof isGrounded === "function" ? !!isGrounded(s) : null;
  if (grounded || isTurn) {
    const road = grounded && isTurn ? "both" : (isTurn ? "motion" : "matter");
    return { admit: true, road, core, matter, bond: toPrior, nullMax: nul.max, refused, lit };
  }

  refused.push({ kind: grounded === null ? "unbonded" : "ungrounded", given: "model", bond: toPrior, nullMax: nul.max });
  return { admit: false, road: null, core, bond: toPrior, nullMax: nul.max, refused };
}
