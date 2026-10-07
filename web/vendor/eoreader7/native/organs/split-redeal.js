// split-redeal.js — does one node's material carry TWO structures?
//
// THE DEFECT THIS IS AIMED AT. `discoverReferents` put the father's surname
// on the daughter: `ref:auto:marmeladov` carries «Sofya Semyonovna
// Marmeladov», «Sofya Semyonovna» AND «Marmeladov». The compliance review of
// 2026-09-07 found it by hand. fold-gate's `reviewMerges` cannot: both sides
// are persons, so both read the same verdict against any person-kind and
// `foldPermitted` permits by construction. `refuteIdentity` gets closer by
// making the anchor a kind of one, but it still needs a POPULATION of
// comparable referents to rank against, and on a real novel those are
// scarce — the mass-matched null collapses to five or six usable draws.
//
// THE MOVE. Destroy one property, hold everything else fixed, measure
// whether the arm collapses. Here the property is WHICH MENTIONS BELONG TO
// WHICH SURFACE SET. Every mention, every address, every note is kept; only
// the assignment is redealt. The null is therefore the node ITSELF under a
// different assignment, which is why this needs no kind, no level, and no
// reference class: nothing has to be decided about whether the peer group is
// persons or perturbations, and the draw count is the number of shuffles
// asked for rather than the number of comparable characters the book happens
// to contain. Two hundred draws are free.
//
// ── RESULT, 2026-09-08: H0 IS FALSE FOR ONE BEING TOO. THE FRAMING DOES
// ── NOT SEPARATE THE CASES. This module is kept as the record of that, and
// ── `refuteSplit` REFUSES rather than returning a verdict. Do not re-run it
// ── expecting one.
//
// Three statistics were tried inside the within-node redeal, each against
// the declared positive control (Pyotr Petrovitch / Luzhin — one man, must
// NOT split), on the persisted Crime and Punishment reading:
//
//   statistic          specimen (must split)   control (must not split)
//   purity depth       depth 1,  p=1.0000      depth 21          ranked BACKWARDS
//   runs               30 < 46,  p=0.0000      88 < 117, p=0.0000   fires on both
//   company gap        0.299 > 0.178, p=0.0000 0.251 > 0.072, p=0.0000  fires on both
//
// All three refuse the control. The common cause is not the statistic: it is
// H0. Name-form choice is NOT exchangeable within a node even when the node
// is one being — a novelist writes «Luzhin» in some contexts and «Pyotr
// Petrovitch» in others, by register, scene and speaker. So the sides of a
// ONE-BEING node differ from each other measurably, and any statistic
// sensitive to "these two sides differ" convicts it. The redeal is sound and
// the question it asks is the wrong one.
//
// And the surface-containment escape does not work either, which is why this
// specimen needed a human in the first place: a bridging surface spanning
// both sides is present in BOTH cases — «Pyotr Petrovitch Luzhin» for the one
// man, and «Sofya Semyonovna Marmeladov» for the two people, because the
// daughter's own full name legitimately contains the father's surname. That
// containment is exactly what produced the bad merge; it cannot also be the
// thing that refutes it.
//
// What would have to be different: a signal ASYMMETRIC between the two cases
// rather than one measuring difference-between-sides, which both cases have.
// Not attempted here.
//
// H0, STATED BEFORE THE RUN: the node's mentions are EXCHANGEABLE between
// its two surface sets — carrying «Marmeladov» rather than «Sofya
// Semyonovna» tells you nothing about where in the reading a mention sits or
// what company it keeps. Under H0 the true split is no more structured than
// a redealt one.
//
// A STATISTIC TRIED AND REFUTED FIRST, kept so it is not tried again.
// PURITY DEPTH over reading order — seed at one side's first arrival, walk
// outward by reading distance, take the first hop whose composition falls to
// the node's own base rate — ranks the specimens BACKWARDS. Measured: the
// Sofya/Marmeladov node scores depth 1 (p=1.0000) while the Luzhin control,
// one man, scores 21. With a base rate near 0.5 a single opposite mention
// beside the seed ends the walk at hop 1, so the statistic reads adjacency
// noise rather than structure. The framing survived it; only the statistic
// changed, which is what the framing was chosen to allow.
//
// THE STATISTIC: RUNS. Two beings sharing one node do not interleave — each
// holds stretches of the reading the other is absent from, so the sequence
// of sides has FEW RUNS. One being under two name-forms is called by either
// at any moment, so its sides interleave and the run count sits where chance
// puts it. Counting runs asks exactly the question the framing poses — is
// the assignment of mentions to sides structured in reading order — and asks
// nothing else. Wald and Wolfowitz's statistic, used for what it was built
// for, against a redeal rather than an asymptotic table.
//
// THE DECISION RULE, DECLARED BEFORE THE RUN: refuse the merge iff the true
// split's run count is BELOW the alpha quantile of the redealt splits' run
// counts — fewer runs than redealing produces means the two sides hold
// separate stretches of the reading. alpha is the caller's (P4), never defaulted here. A true
// depth inside the band is not evidence of one being; it is a failure to
// refuse two.
//
// WHAT THIS ORGAN CANNOT DO, AND MUST NOT BE READ AS DOING. It cannot show
// that a merge is RIGHT. It can only fail to refuse it. And it tests whether
// a node's material carries two STRUCTURES, never whether those structures
// are two PEOPLE: a character who changes drastically halfway through a book
// should be expected to split under this test, and that is a real failure
// mode to pin in the suite rather than hide.
//
// PURE. Mentions arrive as arguments; this module reads no engine.

export const REFUSALS = Object.freeze({
  one_side_empty: "a split needs both sides attested — one surface set with no mention of its own is not a split, it is a variant nobody used",
  too_few: "fewer mentions than the smallest side needs for a redeal to differ from the truth",
  framing_refuted: "within-node redeal cannot separate two beings from one being with register-varying name forms — all three statistics tried convict the positive control (see the RESULT block in this file's header)",
  degenerate: "every redeal reproduced the true depth — this null would clear anything, so it decides nothing",
});

/** How many unbroken stretches of one side the reading order holds. */
export function runs(sides) {
  let n = 0;
  for (let i = 0; i < sides.length; i++) if (i === 0 || sides[i] !== sides[i - 1]) n++;
  return n;
}

const lcg = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; }; };

/**
 * refuteSplit(sides, { draws, alpha, seed }) — sides is one entry per mention
 * in READING ORDER, each `true` for surface set A and `false` for set B.
 */
export function refuteSplit(sides = [], { draws, alpha, seed = 20260812, iUnderstandThisIsRefuted = false } = {}) {
  // The header's RESULT block: measured against its own positive control,
  // this test convicts a single being. It returns a gap rather than a
  // verdict so a caller cannot read a refutation as a finding.
  if (!iUnderstandThisIsRefuted) return { refused: false, gap: "framing_refuted", detail: REFUSALS.framing_refuted };
  if (!Number.isFinite(alpha)) throw new Error("refuteSplit: alpha is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 2) throw new Error("refuteSplit: draws is declared — the resolution of testimony is 1/draws");
  const a = sides.filter(Boolean).length, b = sides.length - a;
  if (!a || !b) return { refused: false, gap: "one_side_empty", detail: REFUSALS.one_side_empty };
  if (sides.length < 4) return { refused: false, gap: "too_few", detail: REFUSALS.too_few };

  const observed = runs(sides);

  const rnd = lcg(seed);
  const nulls = [];
  for (let d = 0; d < draws; d++) {
    // redeal WHICH mentions carry side A, holding the counts fixed — every
    // mention, address and note stays exactly where it is.
    const shuffled = sides.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    nulls.push(runs(shuffled));
  }
  nulls.sort((x, y) => x - y);
  if (nulls[0] === nulls[nulls.length - 1] && nulls[0] === observed)
    return { refused: false, gap: "degenerate", detail: REFUSALS.degenerate, observed, nulls };
  const lo = nulls[Math.max(0, Math.floor(nulls.length * alpha) - 1)];
  const below = nulls.filter((v) => v <= observed).length;
  return Object.freeze({
    refused: observed < lo,
    observed, floor: lo, pValue: below / nulls.length,
    counts: { a, b, mentions: sides.length },
    declared: { draws, alpha, seed },
    reads: observed < lo
      ? "the true split holds structure the redeals do not — this node carries two structures, and the merge is REFUSED"
      : "the true split sits inside what redealing produces — not evidence of one being, only a failure to refuse two",
  });
}
