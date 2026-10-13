// heard-nominals.js — the being tier that needs no capital letters, no spaces
// and no position: a being is a RECURRING WORD THE LANGUAGE'S OWN GRAMMAR
// READS AS A NOMINAL.
//
// Capitalisation is ONE witness for "this word names something" (surfaces.js
// holds it). It is not THE witness: Chinese, Arabic, Hebrew, Korean, Japanese
// have no case; SMS, IRC and Singlish throw it away ("maria and john went 2
// boston"); a name may be lowercase by choice. This tier asks the grammar
// instead — NL → the language's own grammar → (beings) — and the grammar is
// received, giver-named data, never a word list:
//
//   EAR      adapters/text/script-segment.js: word boundaries for unspaced
//            scripts from the language's own POS prior; proclitic peeling for
//            Arabic/Hebrew (the ProcliticPrior@1, validated against the POS
//            prior's own vocabulary).
//   CLASS    a word the POS prior has attested: its own UPOS tally. A word it
//            has NOT (a transliterated name, a slang word, a typo): the class
//            its FRAME implies — FramePrior@1, the gold classes of hapax words
//            by the classes of their left and right neighbours. An unseen word
//            after an auxiliary is a verb; between a determiner and a verb it
//            is a noun. A homograph (noun/verb) is disambiguated by the same
//            frame, Bayes-corrected by the frame's own class marginal.
//   BEING    a form recurring >= minMentions whose summed nominal mass
//            (NOUN + PROPN) is >= `nameShare` of its occurrences.
//
// Every number is the caller's (P4). Absent a POS prior, nothing is admitted
// (the gate that cannot run must not guess). Absent a frame prior, an unseen
// word is admitted only on recurrence plus the neighbours' own settled
// classes being non-verbal — never silently on recurrence alone.
//
// WHAT IT DOES NOT DO. It is a candidate generator exactly as extractSurfaces
// and heardSurfaces are; which candidates are one referent is
// discoverReferents' question. Multi-word names are emitted as a compound
// only when both words recur ADJACENT >= minMentions times and neither is a
// settled common noun. Class evidence is type-level + frame; an occurrence
// the frame cannot read (both neighbours unseen too) falls to the frame
// prior's own hapax distribution, disclosed in `basis`.
//
// PURE. Priors are the caller's.

const UNIT = /[\p{L}\p{M}\p{N}'’]+|[^\s\p{L}\p{M}\p{N}]/gu;
const WORDISH = /^[\p{L}\p{M}\p{N}'’]+$/u;
const DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const NUMERIC = /^[\p{N}'’]+$/u;
const NAMING = ["NOUN", "PROPN"];
// A link or an address is a locator, not a word of the language.
const LOCATOR = /\b(?:https?|ftp):\/\/\S+|\bwww\.\S+|\S+@\S+\.\S+/giu;
// Onomatopoeic reduplication ("hahaha", "wkwkwk", "zzzz"): at most two distinct
// characters over four or more. A fact about the FORM, in any script.
const isReduplication = (w) => { const cs = [...w]; return cs.length >= 4 && new Set(cs).size <= 2; };

export const FRAME_PRIOR_SCHEMA = "FramePrior@1";

const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const majorityClass = (counts, minShare) => {
  const t = total(counts);
  if (!t) return null;
  const [upos, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n / t >= minShare ? upos : null;
};

/** The class of a NEIGHBOUR token as the frame prior saw neighbours at build
 * time: its form's majority class, "UNK" when unseen or unsettled, "PUNCT" for
 * punctuation. */
const neighbourClass = (unit, posPrior, minShare) => {
  if (unit == null) return null;
  if (!WORDISH.test(unit)) return "PUNCT";
  const counts = posPrior.forms[unit];
  if (!counts || total(counts) < 2) return "UNK";
  return majorityClass(counts, minShare) ?? "UNK";
};

const normalise = (dist) => { const t = total(dist); if (!t) return null; const out = {}; for (const [k, v] of Object.entries(dist)) out[k] = v / t; return out; };

/** The class distribution a frame implies for a word between `p` and `n`
 * (class strings, "^"/"$" at sentence edges), backing off P|N → P|* → *|N → *|*. */
export function frameDistribution(framePrior, p, n) {
  const f = framePrior?.frames;
  if (!f) return null;
  for (const key of [`${p}|${n}`, `${p}|*`, `*|${n}`, "*|*"]) if (f[key]) return { dist: normalise(f[key]), key };
  return null;
}

/**
 * classAt(unit, prev, next, {posPrior, framePrior, minShare}) → { dist, basis }
 * — the class distribution of ONE occurrence.
 */
export function classAt(unit, prev, next, { posPrior, framePrior = null, minShare = 0.5 }) {
  let counts = posPrior.forms[unit];
  // A UD treebank splits a clitic ("don't" = do + n't; "i'm" = i + 'm), so the
  // contracted form is never attested. Ask the prior in ITS units: the stem
  // before the apostrophe. A possessive of a name ("john's") then reads as the
  // name's own class; "i'm" as the pronoun it is.
  const apos = unit.search(/['’]/);
  if (!counts && apos > 0) {
    const stem = unit.slice(0, apos);
    // "don't" is do + n't: the stem before the apostrophe may carry the n of n't
    counts = posPrior.forms[stem] ?? (stem.endsWith("n") ? posPrior.forms[stem.slice(0, -1)] : undefined);
  }
  const p = prev == null ? "^" : neighbourClass(prev, posPrior, minShare);
  const n = next == null ? "$" : neighbourClass(next, posPrior, minShare);
  const frame = framePrior ? frameDistribution(framePrior, p, n) : null;
  // UD's X is "other": in Arabic and Hebrew treebanks a transliterated foreign
  // name is tagged X. A form the prior knows only as X is, for the question
  // "does it name something", unseen — the frame decides.
  if (counts && total(counts) >= 1 && (counts.X ?? 0) / total(counts) >= 0.5) counts = undefined;
  if (counts && total(counts) >= 1) {
    const own = normalise(counts);
    const settled = Math.max(...Object.values(own)) >= 0.8;
    if (settled || !frame) return { dist: own, basis: settled ? "attested-settled" : "attested-ambiguous" };
    // a homograph: the form's own tally corrected by the frame's evidence
    const marg = normalise(framePrior.marginal ?? {}) ?? {};
    const mix = {};
    for (const [c, pc] of Object.entries(own)) mix[c] = pc * ((frame.dist[c] ?? 1e-3) / (marg[c] ?? 1e-2));
    return { dist: normalise(mix), basis: `attested-ambiguous|frame:${frame.key}` };
  }
  if (frame) return { dist: frame.dist, basis: `unseen|frame:${frame.key}` };
  return { dist: null, basis: "unseen|no-frame-prior" };
}

const naming = (dist) => (dist ? NAMING.reduce((s, c) => s + (dist[c] ?? 0), 0) : null);

/**
 * createNominalIndex({posPrior, framePrior, segment, peel}) — the incremental
 * form: `add(sentence)` folds ONE sentence's evidence (neighbours are
 * within-sentence, so the past is never re-read), `beings(opts)` projects the
 * admitted surfaces. A reader that refreshes every sentence pays O(1) per
 * sentence, the same posture as organs/company-index.js.
 */
export function createNominalIndex({ posPrior = null, framePrior = null, segment = null, peel = null, minShare = 0.5, commonNouns = true } = {}) {
  const stats = new Map(); // form -> { n, sents:Set, mass, unseen, bases:Map }
  const pairs = new Map(); // "a b" -> { n, sents:Set }
  const admitted = (w) => w.length >= (DENSE_SCRIPT.test(w) ? 2 : 3) && !NUMERIC.test(w);
  let size = 0;

  const add = (s) => {
    const si = size++;
    if (!posPrior?.forms) return;
    let text = String(s?.text ?? s ?? "").toLowerCase().replace(LOCATOR, " ");
    if (segment) text = segment(text);
    if (peel) text = peel(text);
    const units = text.match(UNIT) ?? [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!WORDISH.test(u) || !admitted(u) || isReduplication(u)) continue;
      const { dist, basis } = classAt(u, units[i - 1], units[i + 1], { posPrior, framePrior, minShare });
      const mass = naming(dist);
      if (mass == null) continue; // no evidence either way: a gap, never a guess
      const st = stats.get(u) ?? { n: 0, sents: new Set(), mass: 0, unseen: 0, bases: new Map() };
      st.n += 1; st.sents.add(si); st.mass += mass;
      if (!posPrior.forms[u]) st.unseen += 1;
      const b = basis.split("|")[0];
      st.bases.set(b, (st.bases.get(b) ?? 0) + 1);
      stats.set(u, st);
    }
    for (let i = 0; i + 1 < units.length; i++) {
      const a = units[i], b = units[i + 1];
      if (!WORDISH.test(a) || !WORDISH.test(b) || !admitted(a) || !admitted(b)) continue;
      const key = `${a} ${b}`;
      const pr = pairs.get(key) ?? { n: 0, sents: new Set() };
      pr.n += 1; pr.sents.add(si); pairs.set(key, pr);
    }
  };

  // Where capitalisation IS informative (the text uses it), the capital tier
  // already names the cast and this tier's job is only what capitals cannot
  // see — names with no capital, unseen words — so a form the prior SETTLES as
  // a common noun is not added (`commonNouns: false`). Where it is not
  // (Chinese, Arabic, SMS, lowercased text) every nominal is a candidate.
  const settledCommon = (w) => { const c = posPrior.forms[w]; if (!c) return false; const t = total(c); return t >= 3 && (c.NOUN ?? 0) / t >= 0.7; };
  const beings = ({ minMentions = 2, nameShare = 0.5, compounds = true } = {}) => {
    if (!Number.isFinite(minMentions)) throw new Error("heardNominals: minMentions must be declared");
    const out = [];
    const kept = new Map();
    for (const [w, st] of stats) {
      if (st.n < minMentions) continue;
      if (!commonNouns && settledCommon(w)) continue;
      const share = st.mass / st.n;
      if (share < nameShare) continue;
      kept.set(w, { surface: w, mentions: st.n, sentences: st.sents.size, namingShare: Number(share.toFixed(3)), unseen: st.unseen, basis: [...st.bases.keys()].join("+") });
    }
    out.push(...kept.values());
    if (compounds) {
      // a compound name: two recurring beings adjacent >= minMentions times,
      // neither a settled COMMON noun (a name's parts are unseen or PROPN)
      const commonNoun = (w) => { const c = posPrior.forms[w]; if (!c) return false; const t = total(c); return t >= 3 && (c.NOUN ?? 0) / t >= 0.7; };
      for (const [key, pr] of pairs) {
        if (pr.n < minMentions) continue;
        const [a, b] = key.split(" ");
        if (!kept.has(a) || !kept.has(b) || commonNoun(a) || commonNoun(b)) continue;
        out.push({ surface: key, mentions: pr.n, sentences: pr.sents.size, namingShare: Math.min(kept.get(a).namingShare, kept.get(b).namingShare), unseen: Math.min(kept.get(a).unseen, kept.get(b).unseen), basis: "compound" });
      }
    }
    return out.sort((x, y) => y.mentions - x.mentions);
  };

  return { add, beings, get size() { return size; } };
}

/**
 * heardNominals(sentences, {posPrior, framePrior, segment, peel, minMentions, nameShare, minShare, compounds})
 *
 * `segment(text)` — optional ear for unspaced scripts (makeSegmenter).
 * `peel(text)` — optional proclitic peeler returning spaced text.
 * Returns `[{surface, mentions, sentences, namingShare, unseen, basis}]` in the
 * shape extractSurfaces/heardSurfaces return (+ evidence fields), so
 * discoverReferents consumes it unchanged.
 */
export function heardNominals(sentences, { posPrior = null, framePrior = null, segment = null, peel = null, minMentions = 2, nameShare = 0.5, minShare = 0.5, compounds = true, commonNouns = true } = {}) {
  if (!posPrior?.forms) return [];
  const idx = createNominalIndex({ posPrior, framePrior, segment, peel, minShare, commonNouns });
  for (const s of sentences ?? []) idx.add(s);
  return idx.beings({ minMentions, nameShare, compounds });
}
