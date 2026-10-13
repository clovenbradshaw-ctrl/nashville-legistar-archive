// holodeck-fold.js — the folded reading of a scan: what each OCR token is, and what it should read as, asserted
// from what the REST of the sample established, never from a language model's next-word guess.
//
// The discipline is the engine's own (cast.js::resolve, holodeck-match.js), applied token by token:
//   1. Exact      the form is established: another contract in the sample reads it. It stands as read.
//   2. Near-miss  surfaces.js::isNearMissSpelling (one edit, both sides >= MIN_VARIANT_LEN) or an OCR-style visual
//                 confusable (surfaces.js::opticalReferentForm), against forms the sample established. It is a LAST
//                 RESORT, reached only when the form itself is not established.
//   3. Witness    the neighbours: a candidate stands only if every known neighbour has been read beside it in the
//                 sample. Witnesses narrow the candidates; they never choose between ties.
//   4. Refuse     more than one candidate left, or none supported: the token is left as read and says why.
// A form is "established" by DOCUMENT frequency (how many other contracts hold it), so a page's own misreads cannot
// vouch for themselves: the page's own document is subtracted before it asks.
import { osaDistanceAtMost1, opticalReferentForm } from './vendor/eoreader7/native/adapters/text/surfaces.js';
import { wordFloor } from './vendor/eoreader7/native/adapters/text/script-floor.js';
import { isUnspacedScript } from './vendor/eoreader7/native/adapters/text/script-segment.js';
import { createHolograph, predict } from './vendor/eoreader7/native/kernel/bayes-surprise.js';

const MIN_LEN = 4;                                   // the engine's own floor for alphabetic scripts, lowered per script below
// how short a word may be and still carry a meaning, per script (script-floor.js): a Han character is a morpheme, an
// Arabic or Hebrew root is three consonants. One number of characters is a fact about Latin, not about language.
const floorOf = (w) => wordFloor(String(w), MIN_LEN);
const lenOf = (w) => [...String(w)].length;
const coreOf = (t) => { const s = String(t || ''); if (/\d/.test(s)) return null;
  const m = /^([^\p{L}\p{M}]*)([\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?)([^\p{L}\p{M}]*)$/u.exec(s); return m ? { pre: m[1], w: m[2], post: m[3] } : null; };
const lc = (w) => w.toLowerCase().replace(/’/g, "'");
// case is a property of some scripts, not of language: a capital marks a name in Latin, Cyrillic or Greek and means
// nothing in Arabic, Hebrew or Han. A caseless word cannot be taken for a name by its capital.
const isCased = (w) => /[\p{Lu}\p{Ll}]/u.test(w);
const isTitle = (w) => /^\p{Lu}\p{Ll}+$/u.test(w);
const recase = (from, to) => { const up = (from.match(/\p{Lu}/gu) || []).length, lo = (from.match(/\p{Ll}/gu) || []).length;
  return from.length > 1 && up >= lo && up > 1 ? to.toUpperCase() : /^\p{Lu}/u.test(from) ? to[0].toUpperCase() + to.slice(1) : to; };
// PRODUCTIVE ENDINGS, learned from the vocabulary itself. An ending (1 to 3 letters) is productive when the words that
// carry it have a known stem more often than a random sample of the same number of words has: "-ing" does ("hook",
// "cook", "look" are words), "-sy" does not ("here" is, but "heresy" is not "here" inflected). The control is B random
// subsets of the vocabulary, and an ending must beat every one of them, so there is no ratio to choose. Deterministic
// (a fixed seed), and it assumes no language's endings.
function learnEndings(vocab, known, B = 100) {
  const cs = vocab.filter((w) => lenOf(w) >= 5).map((w) => [w, [...w]]);
  if (cs.length < 200) return new Set();
  let seed = 20261013; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = new Set();
  for (let k = 1; k <= 3; k++) {
    const hasHead = cs.map(([, c]) => c.length - k >= 4 && known.has(c.slice(0, c.length - k).join('')));
    const groups = new Map();
    cs.forEach(([, c], i) => { if (c.length - k < 4) return; const t = c.slice(c.length - k).join(''); let g = groups.get(t); if (!g) groups.set(t, g = []); g.push(i); });
    const eligible = cs.map((_, i) => i).filter((i) => cs[i][1].length - k >= 4);
    for (const [t, idx] of groups) {
      if (idx.length < 5) continue;
      let c = 0; for (const i of idx) if (hasHead[i]) c++;
      let beaten = true;
      for (let b = 0; b < B && beaten; b++) { let cc = 0; for (let j = 0; j < idx.length; j++) if (hasHead[eligible[Math.floor(rnd() * eligible.length)]]) cc++; if (cc >= c) beaten = false; }
      if (beaten) out.add(t);
    }
  }
  return out;
}
const ABJAD = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
// A Roman numeral is not a word: "vill" is VIII with its I's read as l's. Latin script only.
const ROMAN = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const romanLike = (w) => /^[\p{Script=Latin}]+$/u.test(w) && ROMAN.test(String(w).toLowerCase().replace(/[l1|!]/g, 'i'));
// one edit apart, both sides at least the script's floor long (surfaces.js::osaDistanceAtMost1, with the floor per script)
const nearMiss = (a, b) => lenOf(a) >= floorOf(a) && lenOf(b) >= floorOf(b) && osaDistanceAtMost1(a, b);
const deletes = (w) => { const o = [w]; for (let i = 0; i < w.length; i++) o.push(w.slice(0, i) + w.slice(i + 1)); return o; };

// opts.lexicon: word -> its part-of-speech counts, or null when the engine's lexicon does not know the word
// (the Holodeck passes hdPos). Without it the slot filter below is off: a word's absence from a lexicon that did not
// load says nothing.
export function makeFold(priors, opts = {}) {
  const lexicon = typeof opts.lexicon === 'function' ? opts.lexicon : null;
  const words = priors.words || {}, pairs = priors.pairs || {};
  // no sample-wide adjacency priors for this language (only English has them so far): the fold then stands on the
  // language's own lexicon and on what THIS document reads cleanly, and the slot filter, which needs adjacencies, is off
  const noPairs = Object.keys(pairs).length === 0;
  const lexForms = opts.lexiconForms ? (Array.isArray(opts.lexiconForms) ? opts.lexiconForms : Object.keys(opts.lexiconForms)) : [];
  const vocab = [...new Set([...Object.keys(words), ...lexForms.map(lc)])].filter((w) => /^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(w));   // words, not punctuation
  const byDel = new Map(), byOpt = new Map(), known = new Set(vocab), prefixOf = new Set();
  // The sample's adjacencies as the engine's holograph: slot = the word before, value = the word after, counts = how
  // many contracts read the pair. predict() then says how many bits of surprise a word carries in a slot.
  let _holo = null;
  const holo = () => { if (_holo) return _holo; _holo = createHolograph({ alpha: 1 });
    for (const [k, n] of Object.entries(priors.pairs || {})) { const i = k.indexOf(' '); const a = k.slice(0, i), b = k.slice(i + 1);
      let m = _holo.slots.get(a); if (!m) _holo.slots.set(a, m = new Map()); m.set(b, n); }
    return _holo; };
  // Two forms of one word differ at the END by a productive ending (elevate/elevated, hook/hooking, casa/casas): a form
  // whose family the sample or lexicon holds is a valid form of a known word, not a misread of one. A substitution
  // inside the word (contral/control) is not a family.
  const endings = learnEndings(vocab, known);
  for (const x of vocab) { const cs = [...x]; for (let t = 1; t <= 3; t++) { if (cs.length - t < 4) continue; if (endings.has(cs.slice(cs.length - t).join(''))) prefixOf.add(cs.slice(0, cs.length - t).join('')); } }
  const inFamily = (w) => { if (prefixOf.has(w)) return true; const cs = [...w];
    for (let t = 1; t <= 3; t++) { if (cs.length - t < 4) continue; if (endings.has(cs.slice(cs.length - t).join('')) && known.has(cs.slice(0, cs.length - t).join(''))) return true; } return false; };
  const sameFamily = (a, b) => { const [sh, lo] = lenOf(a) <= lenOf(b) ? [a, b] : [b, a]; return sh !== lo && lenOf(sh) >= 4 && lo.startsWith(sh) && endings.has(lo.slice(sh.length)); };
  for (const w of vocab) { if (lenOf(w) < floorOf(w)) continue;
    for (const k of deletes(w)) { let a = byDel.get(k); if (!a) byDel.set(k, a = []); a.push(w); }
    const o = opticalReferentForm(w); let b = byOpt.get(o); if (!b) byOpt.set(o, b = []); b.push(w); }
  const own = (rec) => { const W = new Set(), P = new Set();
    for (const pg of rec) { let prev = null; for (const e of pg.elements || []) { const c = coreOf(e.text), w = c && c.w.length >= 2 ? lc(c.w) : null;
      if (!w) { prev = null; continue; } W.add(w); if (prev) P.add(prev + ' ' + w); prev = w; } }
    return { W, P }; };
  // witness: what a repair must stand on besides being uniquely one edit away.
  //   'both'  every known neighbour has been read beside the candidate in the sample (strictest)
  //   'any'   at least one known neighbour has
  //   'self'  a neighbour pair in the sample, OR this document itself reads the candidate cleanly elsewhere
  function foldDoc(rec, { protect = new Set(), witness = 'any', selfMin = 8 } = {}) {
    // a lexicon that has not loaded says nothing: the slot filter is then off, not "every word is absent"
    const lexReady = !!lexicon && (typeof opts.lexiconReady === 'function' ? !!opts.lexiconReady() : lexForms.length > 0);
    const { W, P } = own(rec);
    // established: read by another contract of the sample (this document subtracted), or, where the language has no
    // sample-wide priors, known to the language's own lexicon
    const df = (w) => { const n = Math.max(0, (words[w] || 0) - (W.has(w) ? 1 : 0)); return noPairs && lexReady && lexicon(w) ? n + 1 : n; };
    const pf = (a, b) => { const k = a + ' ' + b; return Math.max(0, (pairs[k] || 0) - (P.has(k) ? 1 : 0)); };
    const out = [], stats = { read: 0, repaired: 0, refused: 0, unread: 0, name: 0, other: 0 };
    // EARNED GROUND from the page itself: the words this document reads cleanly (established by the sample), counted
    const selfRead = new Map();
    for (const pg of rec) for (const e of pg.elements || []) { const c = coreOf(e.text); if (!c || lenOf(c.w) < floorOf(c.w)) continue; const w = lc(c.w);
      if (df(w) > 0) selfRead.set(w, (selfRead.get(w) || 0) + 1); }
    const occ = new Map();
    for (const pg of rec) for (const e of pg.elements || []) { const c = coreOf(e.text); if (c) { const w = lc(c.w); occ.set(w, (occ.get(w) || 0) + 1); } }
    // a form this document prints identically again and again may simply be printed that way: the source's own typo
    const sameForm = new Map();
    for (const pg of rec) for (const e of pg.elements || []) { if (e.text && !selfRead.has(lc(coreOf(e.text) ? coreOf(e.text).w : e.text))) sameForm.set(e.text, (sameForm.get(e.text) || 0) + 1); }
    // SLOT FILTER. A word the sample holds but the engine's lexicon does not, sitting where no other contract has ever
    // read it beside either neighbour, while ONE near-miss form HAS been read beside BOTH ("signature pate Jun" where
    // "signature date" and "date Jun" are each attested): the slot is a hole of that form's shape, and the word in it is
    // surprising on both sides where the form is not. Guards, not thresholds: only the lexicon-absent are eligible (a
    // valid word such as "thereby", "meat", "finds" is never touched on slot evidence), not a valid form of an established
    // stem family (elevate/elevated, bonding beside bond), not a line-break fragment that joins its neighbour into an
    // established word (be + fore, ex- + cess), exactly one candidate. Checked against the scans: of 35 candidates the
    // both-sides condition kept 18 of 25 right ones and none of the 10 wrong ones (single signals ranked right above
    // wrong with AUC 0.79-0.86; this one has no constant to choose). The bits it reports are the engine's own
    // Bayesian surprise (kernel/bayes-surprise.js) over the sample's adjacencies.
    const slotFix = (w, pw, nw) => {
      if (noPairs || !lexReady || lenOf(w) < floorOf(w) || df(w) === 0 || protect.has(w) || lexicon(w) || romanLike(w) || inFamily(w)) return null;
      if (!pw || !nw || df(pw) === 0 || df(nw) === 0 || pf(pw, w) > 0 || pf(w, nw) > 0) return null;
      // a fragment of a word the line broke ("be" + "fore", "ex-" + "cess", "representa-" + "tive") joins its neighbour
      // into an established word: it is a split word, not a misread
      if (df(pw + w) > 0 || df(w + nw) > 0) return null;
      const cd = new Set();
      // the candidate is a word the engine's lexicon knows: a garble the sample happens to hold is not a target
      for (const k of deletes(w)) for (const x of byDel.get(k) || []) if (x !== w && df(x) > 0 && lexicon(x) && nearMiss(w, x) && !sameFamily(x, w)) cd.add(x);
      for (const x of byOpt.get(opticalReferentForm(w)) || []) if (x !== w && df(x) > 0 && lexicon(x) && !sameFamily(x, w)) cd.add(x);
      const fit = [];
      for (const c of cd) if (pf(pw, c) > 0 && pf(c, nw) > 0) fit.push(c);       // read beside BOTH neighbours
      if (fit.length !== 1) return null;
      const c = fit[0], H = holo();
      const bits = (x) => predict(H, pw, x).bits + predict(H, x, nw).bits;     // surprise of the two transitions through x
      return { c, vouched: df(c), pairs: pf(pw, c) + pf(c, nw), own: df(w), bitsRead: bits(w), bitsFold: bits(c) };
    };
    for (const pg of rec) {
      const els = pg.elements || [], toks = els.map((e) => { const c = coreOf(e.text); return { e, c, w: c ? lc(c.w) : null }; });
      // the page's own type height: a box far taller than that (handwriting, a stray stroke) is not a set word, so
      // nothing is repaired from it (a handwritten "Government" was read "erent" and would have become "event")
      const hts = els.map((e) => (e.region || [])[3]).filter(Boolean).sort((a, b) => a - b), typeH = hts[Math.floor(hts.length / 2)] || 0;
      const page = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i], r = { i, text: t.e.text, kind: 'other' };
        if (isUnspacedScript(t.e.text)) { stats.other++; page.push(r); continue; }   // no spaces to split on: a word is not a token here
        // Consonant-only scripts have dense near-neighbours (a three-letter root), and with no sample adjacencies a valid
        // word absent from the lexicon is "repaired" to a neighbour: measured 26 and 22 changes per 1,000 words of CLEAN
        // Arabic and Hebrew. Repair there waits for sample priors; the cleanup of stray glyphs below still runs.
        if (noPairs && ABJAD.test(t.e.text)) { stats.other++; stats.deferred = (stats.deferred || 0) + 1; page.push(r); continue; }
        if (!t.c || lenOf(t.c.w) < floorOf(t.c.w)) {
          // two things glued across an underline rule or a letter/digit join ("paTE_Jun3,2011" is "DATE Jun 3,2011"):
          // split, resolve each alphabetic part by the same rules, and join with a space
          const tx = t.e.text || '';
          // a digit INSIDE a word (grea5e) is a visual confusable for a letter, never a join: it is resolved whole through
          // the engine's optical form below. A join is an underline rule, or letters then a trailing digit group.
          const mixed = /\p{L}/u.test(tx) && /\d/.test(tx);
          // a digit in a word is a visual confusable for a letter, so a mixed token is first tried WHOLE through the optical
          // form; only when that finds nothing is it taken for two things joined
          let wholeDone = false;
          if (mixed && !/_/.test(tx)) {
            const letters = tx.replace(/[^\p{L}\d]/gu, ''), w = lc(letters);
            if (lenOf(w) >= floorOf(w) && df(w) === 0) { wholeDone = true;
              const cd = new Set(); for (const x of byOpt.get(opticalReferentForm(w)) || []) if (df(x) > 0 && x !== w) cd.add(x);
              const prevW = i > 0 && toks[i - 1].w ? toks[i - 1].w : null, nextW = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
              const pairOkO = (c) => (prevW !== null && pf(prevW, c) > 0) || (nextW !== null && pf(c, nextW) > 0);
              const sup = [...cd].filter((c) => pairOkO(c) || (witness === 'self' && (selfRead.get(c) || 0) > 0));
              if (sup.length === 1) { const pre = (/^[^\p{L}\d]*/u.exec(tx) || [''])[0], post = (/[^\p{L}\d]*$/u.exec(tx) || [''])[0];
                r.kind = 'repaired'; r.to = pre + recase(letters.replace(/\d/g, 'x'), sup[0]) + post; r.vouched = df(sup[0]); r.pairs = (prevW ? pf(prevW, sup[0]) : 0) + (nextW ? pf(sup[0], nextW) : 0); r.self = selfRead.get(sup[0]) || 0; r.recurs = sameForm.get(tx) || 1; stats.repaired++; page.push(r); continue; }
              if (cd.size) { r.kind = 'refused'; r.why = 'one visual swap from ' + [...cd].slice(0, 3).join(' / ') + ', but no neighbour has been read beside it'; stats.refused++; page.push(r); continue; }
            }
          }
          const inner = false;
          if (!inner && !(wholeDone && !/_/.test(tx)) && (/_/.test(tx) || /\p{L}\d|\d\p{L}/u.test(tx))) {
            const segs = tx.split(/_+|(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/u).filter(Boolean);
            if (segs.length > 1) {
              const prevW = i > 0 && toks[i - 1].w ? toks[i - 1].w : null;
              let changed = false, all = true, slotUsed = null;
              const fixed = segs.map((sg, j) => { const c = coreOf(sg); if (!c || lenOf(c.w) < floorOf(c.w)) return sg; const w = lc(c.w);
                if (df(w) > 0 || (selfRead.get(w) || 0) > 0) {
                  // established: only the slot filter may change it, with the neighbouring part (or token) as context
                  const nxt = segs.slice(j + 1).map((x) => coreOf(x)).find((x) => x && x.w.length >= 2);
                  const pwS = j > 0 ? (segs.slice(0, j).map((x) => coreOf(x)).filter((x) => x && x.w.length >= 2).pop() || {}).w : prevW;
                  const nwS = nxt ? nxt.w : (i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null);
                  const fx = !isTitle(c.w) ? slotFix(w, pwS ? lc(pwS) : null, nwS ? lc(nwS) : null) : null;
                  if (fx) { changed = true; slotUsed = fx; return c.pre + recase(c.w, fx.c) + c.post; }
                  return sg;
                }
                const cd = new Set();
                for (const k of deletes(w)) for (const x of byDel.get(k) || []) if (df(x) > 0 && x !== w && nearMiss(w, x)) cd.add(x);
                for (const x of byOpt.get(opticalReferentForm(w)) || []) if (df(x) > 0 && x !== w) cd.add(x);
                const sup = [...cd].filter((x) => (selfRead.get(x) || 0) > 0 || (j === 0 && prevW && pf(prevW, x) > 0));
                if (sup.length === 1) { changed = true; return c.pre + recase(c.w, sup[0]) + c.post; } all = false; return sg; });
              if (changed) { r.kind = 'repaired'; r.to = fixed.join(' '); r.vouched = slotUsed ? slotUsed.vouched : 1; r.pairs = slotUsed ? slotUsed.pairs : 0; r.self = 1; r.recurs = sameForm.get(tx) || 1; if (slotUsed) { r.slot = true; r.own = slotUsed.own; stats.slot = (stats.slot || 0) + 1; } stats.repaired++; page.push(r); continue; }
            }
          }
          stats.other++; page.push(r); continue;
        }
        // SLOT FILTER (see slotFix): an established word, absent from the lexicon, where it has never been read
        if (!isTitle(t.c.w)) {
          const pw = i > 0 && toks[i - 1].w ? toks[i - 1].w : null, nw = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
          const fx = slotFix(t.w, pw, nw);
          if (fx) { r.kind = 'repaired'; r.slot = true; r.to = t.c.pre + recase(t.c.w, fx.c) + t.c.post; r.vouched = fx.vouched; r.pairs = fx.pairs; r.own = fx.own;
            r.self = selfRead.get(fx.c) || 0; r.recurs = sameForm.get(t.e.text) || 1; stats.repaired++; stats.slot = (stats.slot || 0) + 1; page.push(r); continue; }
        }
        // established as read, or as a plural/singular of a form the sample read: an inflection is not a misread
        if (df(t.w) > 0 || protect.has(t.w)) { r.kind = 'read'; r.vouched = df(t.w); stats.read++; page.push(r); continue; }
        if (lenOf(t.w) >= 5 && inFamily(t.w)) { r.kind = 'read'; r.vouched = 0; r.form = 'a form of an established word'; stats.read++; page.push(r); continue; }
        if (isTitle(t.c.w)) { r.kind = 'name'; stats.name++; page.push(r); continue; }          // a name is not respelled
        if (typeH && t.e.region && t.e.region[3] > typeH * 1.5) { r.kind = 'refused'; r.why = 'its box is ' + Math.round(t.e.region[3] / typeH * 10) / 10 + ' times the page\'s own type height, so it is handwriting or a stray stroke, not set type'; stats.refused++; page.push(r); continue; }
        // near-miss candidates: established forms one edit away, or the same form seen through OCR-style glyph swaps
        const cand = new Set();
        for (const k of deletes(t.w)) for (const w of byDel.get(k) || []) if (df(w) > 0 && w !== t.w && nearMiss(t.w, w)) cand.add(w);
        for (const w of byOpt.get(opticalReferentForm(t.w)) || []) if (df(w) > 0 && w !== t.w) cand.add(w);
        const prev = i > 0 && toks[i - 1].w ? (out.length && page[i - 1] && page[i - 1].to ? lc(page[i - 1].to) : toks[i - 1].w) : null;
        const next = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
        // a caseless word cannot be told from a name by a capital, so it must be read beside BOTH neighbours
        const strict = witness !== 'any' || !isCased(t.c.w);
        const pairOk = (c) => !strict ? ((prev !== null && pf(prev, c) > 0) || (next !== null && pf(c, next) > 0))
          : (prev === null || pf(prev, c) > 0) && (next === null || pf(c, next) > 0) && (prev !== null || next !== null);
        // the document's own clean reads of the candidate: for words of selfMin letters or more where the sample has
        // adjacencies (shorter ones gave wrong repairs), and for any length where it has none
        // Without sample adjacencies the document's own reads are the only witness, so they must out-vote the token: a valid
        // word absent from a small lexicon recurs in its document, a misread is a one-off, and the candidate must be read
        // more often than the token is.
        const selfOk = (c) => (selfRead.get(c) || 0) > 0 && (noPairs ? (occ.get(t.w) || 1) === 1 && (selfRead.get(c) || 0) > (occ.get(t.w) || 1) : lenOf(c) >= selfMin);
        const supported = [...cand].filter((c) => pairOk(c) || selfOk(c));
        if (supported.length === 1) { const c = supported[0]; r.kind = 'repaired'; r.to = t.c.pre + recase(t.c.w, c) + t.c.post; r.vouched = df(c); r.pairs = (prev ? pf(prev, c) : 0) + (next ? pf(c, next) : 0); r.self = selfRead.get(c) || 0; r.recurs = sameForm.get(t.e.text) || 1; stats.repaired++; }
        else if (cand.size > 0) { r.kind = 'refused'; r.why = supported.length > 1 ? 'more than one established form fits: ' + supported.slice(0, 4).join(', ') : 'no neighbour has been read beside ' + [...cand].slice(0, 3).join(' / '); stats.refused++; }
        else { r.kind = 'unread'; stats.unread++; }
        page.push(r);
      }
      // JUNK: stray glyphs the scan put in or around text (_ | ~ ¢ [ ] ⌟ ...) are noise, not text. A token carrying one is
      // CLEANED of it ("|9/30/2006" -> "9/30/2006", "$__2,000,000" -> "$2,000,000"); if nothing that reads as a word or a
      // number is left, it is DROPPED ("_]", "a¢y"). A bare symbol with no glyph in it still stands when the tokens on both
      // sides stand as read or are numbers ("Smith & Sons", "$ 1,000", a hyphen between words), the repairs' own witness.
      const ODD = /[_|~¢¬§¤¦\\^`<>{}\[\]⌟⌞⌜⌝]/, ODD_G = new RegExp(ODD.source, 'g');
      // standing: read elsewhere, a number, or a plain word of two letters or more (Inc., of, to): a separator between
      // two such words is punctuation, not noise
      const standing = (x) => x && (x.kind === 'read' || /\d/.test(x.text) || (/\p{L}{2,}/u.test(x.text) && !ODD.test(x.text)));
      page.forEach((r, i) => {
        if (r.kind === 'repaired') return;
        const t = r.text || '', hasOdd = ODD.test(t), symbolOnly = !/[\p{L}\p{N}]/u.test(t);
        if (r.kind === 'read' || r.kind === 'name') { if (!hasOdd) return; }
        if (!hasOdd && !(symbolOnly && !(standing(page[i - 1]) && standing(page[i + 1])))) return;
        const rest = t.replace(/(?<=[\p{L}\p{N}])_+(?=[\p{L}\p{N}])/gu, ' ').replace(ODD_G, '').replace(/^[^\p{L}\p{N}$%(“"']+|[^\p{L}\p{N}%)”"'.,;:]+$/gu, '');
        // a lone X (or x) left in a form box is a CHECK MARK, which is information: it is kept, not dropped
        const check = /^[xX]$/.test(rest);
        const keeps = check || /\p{L}{3,}/u.test(rest) || /\p{N}/u.test(rest);
        r.junk = true; r.drop = !keeps; r.cleanTo = keeps ? rest : ''; r.conf = (els[i] && els[i].conf) || 0; stats.junk = (stats.junk || 0) + 1;
      });
      out.push({ page: pg.page, tokens: page });
    }
    return { pages: out, stats };
  }
  // The same fold for any plain string, so a transcript, a web page or a note gets it as the OCR'd contract does.
  // Whitespace is kept exactly; a repair replaces its token, a cleaned token is cleaned, a dropped one is removed.
  function foldText(text, o = {}) {
    const parts = String(text || '').split(/(\s+)/); const idx = []; const elements = [];
    parts.forEach((x, i) => { if (x && !/^\s+$/.test(x)) { idx.push(i); elements.push({ text: x }); } });
    const res = foldDoc([{ page: 1, elements }], o); const toks = res.pages[0].tokens; const out = parts.slice();
    toks.forEach((t, k) => { const i = idx[k];
      if (t.kind === 'repaired') out[i] = t.to; else if (t.junk) out[i] = t.drop ? '' : t.cleanTo; });
    return { text: out.join('').replace(/[ \t]{2,}/g, ' '), tokens: toks, stats: res.stats };
  }
  return { foldDoc, foldText, endings, noPairs };
}
