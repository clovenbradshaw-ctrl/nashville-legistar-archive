// script-segment.js — the EAR for scripts that write no spaces between words.
//
// WHY. Every being-finding tier downstream (heard-surfaces.js's company
// signal, the surface matcher) works on WORDS delimited by non-letters. Chinese,
// Japanese and Thai write none, so a whole clause is one "word" and nothing
// recurs. That — not any absence of grammar — is why Chinese stayed silent.
// Capital letters were never the cure (Han has no case); the cure is hearing
// word boundaries, and a language's word boundaries are in its OWN received
// POS prior: every attested form of a treebank is a word that language wrote.
//
// WHAT. `makeSegmenter(posPrior)` → `segment(text)` returning the same text
// with spaces inserted between the words of every unspaced-script run, or null
// when the prior is not one for an unspaced script (decided from the prior's
// own forms, never from a language code). Pre-spaced text (LCCC's Weibo is
// already tokenised) passes through unchanged: existing spaces are kept, runs
// are only ever split, never joined across a space.
//
//  · LEXICON DP, not forward max-match: each unspaced run is segmented to
//    maximise the summed SQUARE of the attested word lengths (a long attested
//    word beats two short ones), unattested characters scoring 0.
//  · A NAME IS USUALLY THE UNATTESTED PART. A transliterated name (玛丽亚) is
//    split by the lexicon into single characters. Adjacent single-character
//    pieces are therefore merged back into one token when the prior does not
//    SETTLE any of them as a function/verb class — the same "settled
//    non-naming refuses, unseen admits" asymmetry heard-surfaces.js already
//    holds. A settled verb/particle/adposition stays a boundary.
//  · Katakana (loanwords and foreign names) and Latin/digit runs stay whole.
//
// PURE. The prior is the caller's. Every result is a candidate; which
// candidates are beings is the company signal's question.


const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const KATAKANA_RUN = /^[\p{Script=Katakana}ー]+$/u;
const RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}ー々〆]+/gu;

export const isUnspacedScript = (s) => UNSPACED.test(String(s ?? ""));


/** Does the prior's own vocabulary live in an unspaced script? (a share of its
 * forms, measured; the prior declares no such thing) */
export function priorIsUnspaced(posPrior, { share = 0.5 } = {}) {
  const forms = Object.keys(posPrior?.forms ?? {});
  if (forms.length < 100) return false;
  let n = 0;
  for (const f of forms) if (isUnspacedScript(f)) n += 1;
  return n / forms.length >= share;
}

export function makeSegmenter(posPrior) {
  if (!priorIsUnspaced(posPrior)) return null;
  const lex = new Set();
  let maxLen = 1;
  for (const f of Object.keys(posPrior.forms)) {
    if (!isUnspacedScript(f) || /[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}ー々〆]/u.test(f)) continue;
    lex.add(f);
    if ([...f].length > maxLen) maxLen = [...f].length;
  }
  maxLen = Math.min(maxLen, 8);
  // A character is a FRAGMENT OF A NAME (mergeable with its neighbours) only
  // when the prior does not know it as a standalone word: unattested or seen
  // fewer than FRAGMENT_MAX times (a frequent standalone noun like 岁 is a
  // word, not a piece of one), and never settled as function/verb. "Settled"
  // is read over the whole class mass — the summed non-naming share — not a
  // single class's plurality, so 的 (PART 57% / SCONJ 43%) is settled too.
  const FRAGMENT_MAX = 5;
  const mergeable = (w) => {
    const c = posPrior.forms[w];
    if (!c) return true;
    const total = Object.values(c).reduce((x, y) => x + y, 0);
    if (total >= FRAGMENT_MAX) return false;
    const naming = (c.NOUN ?? 0) + (c.PROPN ?? 0);
    return total < 2 || naming / total > 0.2;
  };
  const segmentRun = (run) => {
    if (KATAKANA_RUN.test(run)) return [run];
    const cs = [...run];
    const n = cs.length;
    const best = new Array(n + 1).fill(-Infinity);
    const back = new Array(n + 1).fill(0);
    best[0] = 0;
    for (let i = 1; i <= n; i++) {
      // an unattested single character: score 0, a boundary of its own
      if (best[i - 1] > best[i]) { best[i] = best[i - 1]; back[i] = i - 1; }
      for (let l = 1; l <= Math.min(maxLen, i); l++) {
        const w = cs.slice(i - l, i).join("");
        if (!lex.has(w)) continue;
        const sc = best[i - l] + l * l;
        if (sc > best[i] || (sc === best[i] && back[i] < i - l)) { best[i] = sc; back[i] = i - l; }
      }
    }
    const pieces = [];
    for (let i = n; i > 0; i = back[i]) pieces.push(cs.slice(back[i], i).join(""));
    pieces.reverse();
    // merge adjacent single-character pieces no class settles as function/verb
    const out = [];      // finished tokens
    let open = null;     // a run of single characters still being merged
    const flush = () => { if (open !== null) { out.push(open); open = null; } };
    for (const p of pieces) {
      const frag = [...p].length === 1 && mergeable(p);
      if (frag) { open = (open ?? "") + p; continue; }
      flush();
      out.push(p);
    }
    flush();
    return out;
  };

  // ALREADY-SPACED MATERIAL IS NOT RE-HEARD. A tokenised corpus (LCCC's Weibo
  // dialogues) separates words with spaces; a human or a tokeniser's boundary
  // outranks a lexicon's guess. Natural unspaced prose has few, long runs
  // between punctuation; a line of three or more short runs is spaced.
  const alreadySpaced = (text) => {
    // two or more space-separated unspaced-script words in one line
    return (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}] [\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length >= 2;
  };

  return function segment(text) {
    if (alreadySpaced(String(text ?? ""))) return String(text ?? "");
    return String(text ?? "").replace(RUN, (run) => ` ${segmentRun(run).join(" ")} `).replace(/ {2,}/g, " ").trim();
  };
}
