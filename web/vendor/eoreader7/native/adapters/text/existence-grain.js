// existence-grain.js — which recurring forms may leave the Void, and to
// which Existence grain. Cube cell NUL·Ground (Differentiate·Existence,
// terrain Void, stance Clearing): the act that decides what a form is NOT.
// Handle: Sullivan — the default cue set below is the one her swarm run
// learned (eval/lavar/sullivan-learn.mjs), not a hand choice.
//
// THE GAP. kernel/cube.js already routes INS·Figure to Entity and
// INS·Pattern to Kind, but nothing computes which grain a recurring form
// belongs to — callers pass it in. surfaces.js's capitalisation binomial
// (a fair-coin null) is the English proper-noun SIG; nominal-beings.js and
// greek.mjs::greekBeings pool NOUN+PROPN or require an article; the Kind
// assembly (assemblies.js KIND) is declared with cells: []. A proper noun
// names an individual (Entity); a common noun names a kind (Kind); a form
// nothing has resolved stays in the Void.
//
// FOUND BY ELIMINATION. A name is known first by what it refuses: it does
// not take determiners, the received prior has not settled it into an
// ordinary class, it is not written lowercase where capitals are not
// forced. Each elimination cue speaks only above its own measured null;
// what no cue can place stays Void — an honest "not yet", never a guess.
//
// LICENSING (the rule that made the swarm's own fitness track the
// witness — see THEORIES in eval/lavar/english-ladder.mjs). A resolution
// counts only when licensed:
//   Kind     an elimination cue fired (above its null, or the received
//            prior settled the form, or a declared orthographic rule)
//   Entity   positive naming evidence (capitalised mid-line more than the
//            material's own positional base rate, exact binomial), or
//            determiner-avoidance with no licensed kill — absence of
//            kind-marking cannot contest a positive kill
//   Contest  a licensed kill AND naming evidence (the role-title class:
//            "the Emperor", "Doctor", "the Good Angel") — landed typed,
//            never silently resolved
//   Void     neither
//   Kind*    the E4 raw kill: "no burstier than a shuffled copy" accepts a
//            null without power. Measured: it killed 9 real names in two
//            English plays and 9 in Antigone. Reported, never licensed.
//
// UNIVERSAL VS PARTICULAR (with Chomsky; measured 2026-09-23 on Doctor
// Faustus, Henry IV Part 1 and Sophocles' Antigone):
//   E1 kind-frame      CONDITIONAL on a word-level article system, and its
//                      direction is register-particular (Attic prose puts
//                      the article on names; tragic verse and English do
//                      not). Speaks only where its real exceedances clear
//                      the null's — measured, not looked up in a table.
//   E2 prior-settled   UNIVERSAL as a rule; how much it knows is the
//                      prior's corpus coverage, not typology.
//   E3 lowercase-mid   PARTICULAR to a cased script whose orthography
//                      capitalises names (this Greek edition capitalises
//                      only names; German capitalises every noun; caseless
//                      scripts have none). Self-silences via scriptIsCaseless.
//   E4 dispersion      UNIVERSAL signal (burstiness survives the shuffle
//                      null; characters are the burstiest forms) but a weak
//                      KILL — see Kind* above; the calibrated variant is a
//                      positive test (more even than two shuffles differ).
//   E5 contraction     PARTICULAR (an internal apostrophe marks elision).
//   E6 foreign-run     UNIVERSAL mechanism (an unattested form whose
//                      neighbours are unattested beyond the null is a
//                      code-switch span, e.g. Latin inside English).
// The strongest cue in all three texts is orthographic, so the learned
// default is strongest exactly where it is least universal. It has never
// been run on a caseless script — named, not assumed.
//
// NULLS. The kind-frame and foreign-run bars are the 99.5th percentile of
// the same statistic on a word-shuffle of the same material (null-arm.mjs's
// shuffle: words permuted into the same punctuation and line skeleton). The
// capitalisation null is the material's MEASURED positional base rate, not
// surfaces.js's fair coin. alpha is the repo's standing 0.05.

import { tokenize, nominalClass } from "./nominal-beings.js";
import { withinTextSightings } from "./tacit-corroboration.js";
import { scriptIsCaseless } from "./recurring-form-anchors.js";
import { lcg, shuffled } from "../../kernel/rng.js";

const ALPHA = 0.05;
const UPPER = /^\p{Lu}/u;
const ELISION = /\p{L}['’]\p{L}/u;

/** The cue organs, typed to the cube (cellOf-checked in the test). */
export const CUES = Object.freeze({
  E1: Object.freeze({ cell: ["NUL", "Pattern"], variants: ["all", "run"], universality: "conditional: a word-level article system" }),
  E2: Object.freeze({ cell: ["NUL", "Pattern"], universality: "universal rule, coverage-dependent" }),
  E3: Object.freeze({ cell: ["NUL", "Pattern"], universality: "particular: a cased script that capitalises names" }),
  E4: Object.freeze({ cell: ["SIG", "Ground"], variants: ["raw", "cal"], universality: "universal signal; raw kill unlicensed" }),
  E5: Object.freeze({ cell: ["NUL", "Pattern"], universality: "particular: apostrophe elision" }),
  E6: Object.freeze({ cell: ["NUL", "Ground"], universality: "universal mechanism, needs a received prior" }),
});

/** The swarm's learned champion: both English plays converged on it
 *  independently (seed E3, E2+E3 kept at generation 1); Antigone's
 *  champion was E3 alone. */
export const LEARNED_CUES = Object.freeze({ E1: "off", E2: 1, E3: 1, E4: "off", E5: 0, E6: 0 });

const logFactCache = [0];
const logFact = (n) => { while (logFactCache.length <= n) logFactCache.push(logFactCache[logFactCache.length - 1] + Math.log(logFactCache.length)); return logFactCache[n]; };
const logPmf = (k, n, p) => logFact(n) - logFact(k) - logFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
/** Exact binomial tail. surfaces.js has a private equivalent fixed at p=0.5; this one takes the measured p. */
export function binomialTail(k, n, p, side = "upper") {
  if (!(p > 0 && p < 1) || n <= 0) return 1;
  let s = 0;
  if (side === "upper") { if (k <= 0) return 1; for (let i = k; i <= n; i += 1) s += Math.exp(logPmf(i, n, p)); }
  else for (let i = 0; i <= k; i += 1) s += Math.exp(logPmf(i, n, p));
  return Math.min(1, s);
}
const poissonUpper = (k, lam) => { let p = 0, term = Math.exp(-lam); for (let i = 0; i < k; i += 1) { p += term; term *= lam / (i + 1); } return 1 - p; };
const quantile = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : Infinity; };

/** wordShuffle(text, seed) — null-arm.mjs's null: the words permuted into
 *  the same punctuation and line skeleton, so only arrangement is destroyed. */
export function wordShuffle(text, seed) {
  const toks = tokenize(text);
  const words = shuffled(toks.map((t) => t.raw), lcg(seed));
  let out = "", last = 0;
  toks.forEach((t, i) => { out += text.slice(last, t.start) + words[i]; last = t.end; });
  return out + text.slice(last);
}

function formStats(text, prior, { minSeparation }) {
  const hasPrior = !!prior?.forms;
  const cache = new Map();
  const cls = (w) => { if (!hasPrior) return null; if (!cache.has(w)) cache.set(w, nominalClass(w, prior)); return cache.get(w); };
  const attested = (w) => hasPrior && Object.prototype.hasOwnProperty.call(prior.forms, w);
  const toks = tokenize(text);
  const per = new Map();
  let detAll = 0, detRun = 0, runN = 0, midN = 0, midCap = 0, nbSlots = 0, nbUn = 0;
  toks.forEach((t, i) => {
    const prev = toks[i - 1], next = toks[i + 1];
    const gap = prev ? text.slice(prev.end, t.start) : "\n";
    const adjPrev = prev && /^[ \t]+$/.test(gap);
    const adjNext = next && /^[ \t]+$/.test(text.slice(t.end, next.start));
    const lineInitial = gap.includes("\n");
    const detPrev = adjPrev && cls(prev.w) === "DET";
    const mid = !lineInitial && !/[.!?;:·]/.test(gap);
    if (!per.has(t.w)) per.set(t.w, { n: 0, d: 0, nr: 0, dr: 0, m: 0, c: 0, a: 0, u: 0 });
    const e = per.get(t.w);
    e.n += 1;
    if (detPrev) { e.d += 1; detAll += 1; }
    if (!lineInitial) { e.nr += 1; runN += 1; if (detPrev) { e.dr += 1; detRun += 1; } }
    if (mid) { e.m += 1; midN += 1; if (UPPER.test(t.raw)) { e.c += 1; midCap += 1; } }
    if (hasPrior) for (const nb of [adjPrev && prev, adjNext && next]) if (nb) { e.a += 1; nbSlots += 1; if (!attested(nb.w)) { e.u += 1; nbUn += 1; } }
  });
  const rates = { pAll: detAll / Math.max(1, toks.length), pRun: detRun / Math.max(1, runN), q: midCap / Math.max(1, midN), r: nbUn / Math.max(1, nbSlots) };
  const z = (k, n, p) => (n && p > 0 && p < 1 ? (k - n * p) / Math.sqrt(n * p * (1 - p)) : 0);
  const sightings = withinTextSightings(text, { minSeparation });
  for (const [w, e] of per) {
    e.zAll = z(e.d, e.n, rates.pAll);
    e.zRun = z(e.dr, e.nr, rates.pRun);
    e.zCap = e.m ? z(e.c, e.m, rates.q) : null;
    e.zNb = z(e.u, e.a, rates.r);
    e.disp = sightings.get(w).length / e.n;
    e.capP = e.m ? binomialTail(e.c, e.m, rates.q, "upper") : 1;
    e.avoidP = e.nr ? binomialTail(e.dr, e.nr, rates.pRun, "lower") : 1;
  }
  return { per, rates, cls, attested, hasPrior, cased: !scriptIsCaseless(text) };
}

/**
 * grainEvidence(text, prior, {nullSeed, minSeparation, minOccurrences}) —
 * every cue's verdict per recurring form, each against its own null. Pure
 * given its inputs; the null seed is declared so a run reproduces.
 */
export function grainEvidence(text, prior, { nullSeed = 7, minSeparation = 200, minOccurrences = 2 } = {}) {
  const R = formStats(text, prior, { minSeparation });
  const N1 = formStats(wordShuffle(text, nullSeed), prior, { minSeparation });
  const N2 = formStats(wordShuffle(text, nullSeed + 4), prior, { minSeparation });
  const nullRows = [...N1.per.values()].filter((e) => e.n >= minOccurrences);
  const cand = [...R.per].filter(([, e]) => e.n >= minOccurrences);
  const bar = (key) => {
    const b = quantile(nullRows.map((e) => e[key]), 0.995);
    const realOver = cand.filter(([, e]) => e[key] > b).length;
    const nullOver = nullRows.filter((e) => e[key] > b).length;
    return { bar: b, speaks: poissonUpper(realOver, Math.max(1, nullOver)) < ALPHA, realOver, nullOver };
  };
  const E1all = bar("zAll"), E1run = bar("zRun");
  const E6bar = R.hasPrior ? bar("zNb") : { speaks: false };
  const bin = (n) => Math.floor(Math.log2(n));
  const spread = new Map();
  for (const [w, e] of N1.per) {
    const e2 = N2.per.get(w);
    if (e.n < minOccurrences || !e2) continue;
    if (!spread.has(bin(e.n))) spread.set(bin(e.n), []);
    spread.get(bin(e.n)).push(e.disp / e2.disp);
  }
  const calBar = new Map([...spread].map(([b, xs]) => [b, quantile(xs, 0.975)]));
  const forms = new Map();
  for (const [w, e] of cand) {
    const ne = N1.per.get(w);
    const ratio = ne ? e.disp / ne.disp : 1;
    const c = R.cls(w);
    forms.set(w, Object.freeze({
      n: e.n,
      E1all: E1all.speaks && e.zAll > E1all.bar,
      E1run: E1run.speaks && e.zRun > E1run.bar,
      E2: c !== null && c !== "PROPN",
      E3: R.cased && e.zCap !== null && e.zCap <= 0,
      E4raw: ratio >= 1,
      E4cal: ratio >= (calBar.get(bin(e.n)) ?? Infinity),
      E5: ELISION.test(w),
      E6: E6bar.speaks && !R.attested(w) && e.zNb > E6bar.bar,
      naming: R.cased && e.capP < ALPHA,
      avoids: E1run.speaks && e.avoidP < ALPHA,
      burst: ratio,
    }));
  }
  return { forms, rates: R.rates, cased: R.cased, speaks: { E1all: E1all.speaks, E1run: E1run.speaks, E3: R.cased, E6: E6bar.speaks }, bars: { E1all, E1run, E6: E6bar } };
}

/** grainOf(evidence, cues) — the licensed grain of one form under a cue set. */
export function grainOf(ev, cues = LEARNED_CUES) {
  if (!ev) return null;
  const kill = (cues.E1 === "all" && ev.E1all) || (cues.E1 === "run" && ev.E1run) || (cues.E2 && ev.E2) || (cues.E3 && ev.E3)
    || (cues.E4 === "cal" && ev.E4cal) || (cues.E5 && ev.E5) || (cues.E6 && ev.E6);
  if (kill && ev.naming) return "Contest";
  if (kill) return "Kind";
  if (cues.E4 === "raw" && ev.E4raw) return "Kind*";
  if (ev.naming || ev.avoids) return "Entity";
  return "Void";
}

/** existenceGrains(text, prior, opts) — every recurring form sorted into
 *  its licensed grain, most-occurring first, with the evidence behind it. */
export function existenceGrains(text, prior, { cues = LEARNED_CUES, ...opts } = {}) {
  const ev = grainEvidence(text, prior, opts);
  const out = { Entity: [], Kind: [], "Kind*": [], Contest: [], Void: [] };
  for (const [w, e] of ev.forms) out[grainOf(e, cues)].push(w);
  for (const k of Object.keys(out)) out[k].sort((a, b) => ev.forms.get(b).n - ev.forms.get(a).n);
  return { ...out, evidence: ev, cues };
}
