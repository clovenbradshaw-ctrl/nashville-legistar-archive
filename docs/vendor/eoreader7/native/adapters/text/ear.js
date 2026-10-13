// ear.js — a language's EAR: the received, giver-named grammar that turns
// text of any script into the words the being tiers listen to.
//
//   NL → [ear: this language's word boundaries and bound morphemes] → words
//
// Two parts, both read from the language's own priors and neither from a
// language name:
//   segment — word boundaries for scripts that write none (script-segment.js)
//   peel    — bound proclitics split off the front of a word (Arabic و/ب/ل/ال,
//             Hebrew ה/ו/ב/…), committed only when the remainder is a form the
//             language's POS prior attests (heard-surfaces.js::peelProclitics)
//
// `makeEar({posPrior, proclitics})` returns `{ segment, peel, proclitics }`,
// each null when the language does not need it.
//
//   contractions — a ContractionPrior@1 (scripts/build-contraction-prior.mjs): whole-surface
//             splits the treebank gives a surface word (del -> de el, don't -> do n't, du -> de
//             le), plus the apostrophe-marked and host-guarded bound affixes that recur in the
//             treebank's own multi-word tokens and glued tokens (l' d' qu' 's n't -lo -nya).
//             Derived by simulating THIS rule on the treebank and keeping only affixes that
//             are right at least as often as wrong (SETTLE share). Peeling is a split of the
//             string, never an admission: what it leaves is read by the same classes as any word.
//
//   enclitics — the mirror at the END of a word (Korean 은/는/이/가/을/를/에서…),
//             from EncliticPrior@1 (derived from the treebank's own morpheme
//             annotation). Peeled one particle at a time, longest first, and
//             committed only when the remainder is attested by the POS prior
//             and the whole word is not itself a well-attested form.

import { makeSegmenter } from "./script-segment.js";
import { peelProclitics } from "../../organs/heard-surfaces.js";

const WORD = /[\p{L}\p{M}\p{N}']+/gu;
const WORD_APOS = /[\p{L}\p{M}\p{N}'’]+/gu; // with a contractions prior the curly apostrophe is part of the word, as in the reader's own units
const straight = (w) => w.replace(/’/g, "'");
const topClass = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

const ENCLITIC_DEPTH = 2;
const WHOLE_WORD_FLOOR = 3; // a word attested this often is itself a word, not stem+particle

/**
 * applyAffixes(word, {prefixes, suffixes, posPrior}) → the parts a bound-affix peel gives `word`, or null.
 *   prefixes  [{affix}]          apostrophe-final proclitics (l' d' qu' dell'), longest first
 *   suffixes  [{affix, hosts, marked}]  bound suffixes, longest first; `hosts` the stem classes it attaches to; `marked` =
 *                                 the affix carries an apostrophe, so an UNSEEN stem (a name, a new word) may host it
 * A word the prior attests WHOLE_WORD_FLOOR times is a word, not stem+affix. A seen stem must be of a host class. Case is
 * kept: the parts are slices of the word as written.
 */
export function applyAffixes(word, rules) { return affixPeel(word, rules)?.parts ?? null; }
/** affixPeel — applyAffixes with the affixes it used: { parts, head, tail } | null (the builder attributes each firing to the rule that fired). */
export function affixPeel(word, { prefixes = [], suffixes = [], posPrior = null } = {}) {
  const w = straight(word), lw = w.toLowerCase();
  const whole = posPrior?.forms?.[lw];
  if (whole && Object.values(whole).reduce((a, b) => a + b, 0) >= WHOLE_WORD_FLOOR) return null;
  let head = null, rest = lw, tail = null;
  for (const p of prefixes) if (lw.length > p.affix.length && lw.startsWith(p.affix)) { head = p.affix; rest = lw.slice(p.affix.length); break; }
  for (const x of suffixes) {
    if (rest.length <= x.affix.length || !rest.endsWith(x.affix)) continue;
    const stem = rest.slice(0, -x.affix.length);
    const c = posPrior?.forms?.[stem];
    if (c) { if (!x.hosts?.includes(topClass(c))) continue; } else if (!x.marked) continue;
    tail = x.affix; rest = stem; break;
  }
  if (!head && !tail) return null;
  const parts = [];
  let at = 0;
  if (head) {
    const comps = prefixes.find((p) => p.affix === head)?.comps; // a fused prefix (dell' = di l') is written as its components, the grid the priors were built on
    if (comps) { const cap = /^\p{Lu}/u.test(w); comps.forEach((c, i) => parts.push(cap && i === 0 ? c[0].toUpperCase() + c.slice(1) : c)); } else parts.push(w.slice(0, head.length));
    at = head.length;
  }
  parts.push(w.slice(at, w.length - (tail ? tail.length : 0)));
  if (tail) parts.push(w.slice(w.length - tail.length));
  return { parts, head, tail };
}

export function makeEar({ posPrior = null, proclitics = null, enclitics = null, contractions = null } = {}) {
  const splits = contractions?.splits ?? null;
  const rules = contractions ? {
    prefixes: [...(contractions.prefixes ?? [])].sort((a, b) => b.affix.length - a.affix.length),
    suffixes: [...(contractions.suffixes ?? [])].sort((a, b) => b.affix.length - a.affix.length),
    posPrior,
  } : null;
  const hasAffixRules = Boolean(rules && (rules.prefixes.length || rules.suffixes.length));
  const splitWhole = (word) => {
    const lw = straight(word).toLowerCase();
    const comps = splits && Object.hasOwn(splits, lw) ? splits[lw] : null;
    if (!comps) return null;
    // a concatenative split is sliced from the word as written (case kept); a fused one (del = de el) is the components, the first capitalised if the word was
    if (comps.join("") === lw) { let at = 0; return comps.map((c) => { const part = straight(word).slice(at, at + c.length); at += c.length; return part; }); }
    const cap = /^\p{Lu}/u.test(word);
    return comps.map((c, i) => (cap && i === 0 ? c[0].toUpperCase() + c.slice(1) : c));
  };
  const set = proclitics ? new Set(proclitics) : null;
  const enc = enclitics && enclitics.length ? [...new Set(enclitics)].sort((a, b) => b.length - a.length) : null;
  const total = (c) => Object.values(c).reduce((x, y) => x + y, 0);
  const peelEnclitics = (word) => {
    if (!enc || !posPrior?.forms) return null;
    const whole = posPrior.forms[word];
    if (whole && total(whole) >= WHOLE_WORD_FLOOR) return null;
    let rest = word; const tail = [];
    for (let d = 0; d < ENCLITIC_DEPTH; d++) {
      const e = enc.find((x) => rest.length > x.length && rest.endsWith(x));
      if (!e) break;
      tail.unshift(e); rest = rest.slice(0, -e.length);
      if (posPrior.forms[rest]) return { stem: rest, enclitics: tail };
    }
    return null;
  };
  const segment = posPrior ? makeSegmenter(posPrior) : null;
  const hasPro = Boolean(set && set.size && posPrior);
  const peel = hasPro || enc || splits || hasAffixRules
    ? (text) => text.replace(splits || hasAffixRules ? WORD_APOS : WORD, (word) => {
        const whole = splits ? splitWhole(word) : null;
        if (whole) return whole.join(" ");
        if (hasPro) { const hit = peelProclitics(word, set, posPrior); if (hit) return [...hit.proclitics, hit.stem].join(" "); }
        const e = peelEnclitics(word);
        if (e) return [e.stem, ...e.enclitics].join(" ");
        const a = hasAffixRules ? applyAffixes(word, rules) : null;
        return a ? a.join(" ") : word;
      })
    : null;
  return Object.freeze({ segment, peel, proclitics: set, enclitics: enc ? new Set(enc) : null });
}
