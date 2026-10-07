// native/kernel/bayes-surprise.js — BAYESIAN SURPRISE: THE DELTA AN
// ADMISSION MAKES TO THE HOLOGRAPH. Medium-blind, kernel-level (2026-09-22).
// Handle: Itti & Baldi — after "Bayesian surprise": how far an observation
// moves belief, the divergence of the posterior from the prior. Nomination.
//
// Two different quantities, both kept, never confused:
//
//   SURPRISAL     −log₂ p(x) under the prior BEFORE x arrives (prequential,
//                 Rubin's measure in surprise-segments.js): how unexpected x
//                 was. A rare event is always surprising in this sense, even
//                 to a reader who has learned that such events are rare.
//   BAYES         KL(posterior ‖ prior) in bits: how much x CHANGED what the
//                 reader believes. An event the reader already expected to
//                 be unpredictable moves nothing; an event that rewrites the
//                 expectation moves a lot. This is the delta to the
//                 holograph (docs/THE-HOLOGRAPH.md): the holograph cuts where
//                 one more line changes nothing (dmdWindow — Bateson's
//                 difference that makes a difference); Bayesian surprise is
//                 the same difference measured on admission. A kind is
//                 learned when one more instance stops moving it.
//
// THE PRIOR IS DECLARED, NEVER A VIEW FROM NOWHERE. The holograph's Pattern
// grain is held here as independent slots, each a Dirichlet over the values
// seen in that slot, with a symmetric concentration `alpha` the caller
// declares (Laplace's 1 by default, stated in every result). Independence of
// slots is a declared simplification, not a finding. What a slot IS — a
// position of a poem, a heading's ordinal, a terrain — is the caller's; no
// slot is named in this file.
//
// ACTIVATION DECAYS (kernel/activation.js, P1): with a declared `gamma`,
// every count fades by gamma on each admission, so a prior learned on one
// kind gives way when the stream turns to another. Identity is not this
// module's business; only how present a belief is.
//
// Typing (reasoned, per the capacity registry's hand-check discipline):
// re-forming a prior across instances is Generate·Interpretation at Pattern
// grain — REC·Paradigm; its delta is what REC produces. Reference-only here.

export const BAYES_SURPRISE_SCHEMA = "EOBayesSurprise@1";
/** The value a slot holds for an instance that lacks it. A holograph that
 *  has read five-line poems EXPECTS line six to be absent; a slot it has
 *  never seen is not a slot with no expectation (measured 2026-09-22: without
 *  this, a sonnet arriving at a limerick ground moved nothing on its nine new
 *  lines, and the change of kind at instance 40 was missed). */
export const ABSENT = "(absent)";
/** The mass the holograph keeps for a value it has never seen. Without it a
 *  slot that has only ever held one value is a point, and a repeat moves it
 *  exactly zero (measured 2026-09-22 by the falsifier: eight repeats, 0.000
 *  bits each) — yet a reader who has seen "There" open fifty limericks
 *  believes it MORE each time. The unseen is always possible; this is its
 *  share, alpha, the same the predictive already reserves. */
const NOVEL = "\u0000novel";
const LN2 = Math.LN2;

/** ln Γ(x), Lanczos (g = 7, n = 9), x > 0. */
export function lgamma(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
/** ψ(x), the digamma function, x > 0: recurrence up to 6, then the asymptotic series. */
export function digamma(x) {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
/** KL(Dir(a) ‖ Dir(b)) in nats, a and b over the same support. */
export function klDirichlet(a, b) {
  const A = a.reduce((s, x) => s + x, 0), B = b.reduce((s, x) => s + x, 0);
  let kl = lgamma(A) - lgamma(B);
  const dA = digamma(A);
  for (let i = 0; i < a.length; i++) kl += lgamma(b[i]) - lgamma(a[i]) + (a[i] - b[i]) * (digamma(a[i]) - dA);
  return Math.max(0, kl);
}

/** KL(Dir(b + e_v) ‖ Dir(b)) in nats — the divergence ONE admission makes —
 *  in closed form: ln B − ln b_v + ψ(b_v + 1) − ψ(B + 1), with b_v the prior
 *  count of the value that arrived and B the prior's total. O(1) where the
 *  general form is O(support); equal to klDirichlet(post, prior) exactly
 *  (pinned in the falsifier). A slot whose support grows with every
 *  instance (a text, a word) made the general form quadratic over a stream. */
export function klAdmit(bv, B) {
  return Math.max(0, Math.log(B) - Math.log(bv) + digamma(bv + 1) - digamma(B + 1));
}

/** A holograph's Pattern grain: slots of Dirichlet counts. */
export function createHolograph({ alpha = 1, gamma = 1 } = {}) {
  if (!(alpha > 0)) throw new TypeError("createHolograph: alpha is declared and positive");
  if (!(gamma > 0 && gamma <= 1)) throw new TypeError("createHolograph: gamma is in (0, 1] — 1 means nothing fades");
  return { schema: BAYES_SURPRISE_SCHEMA, alpha, gamma, admitted: 0, slots: new Map() };
}

/** The prior's predictive probability of `value` in `slot`, and its surprisal in bits. */
export function predict(holo, slot, value) {
  const m = holo.slots.get(slot) ?? new Map();
  const K = m.size + (m.has(value) ? 0 : 1) + 1; // + the novel bucket: the unseen stays possible
  const N = [...m.values()].reduce((s, x) => s + x, 0);
  const p = ((m.get(value) ?? 0) + holo.alpha) / (N + holo.alpha * K);
  return { p, bits: -Math.log2(p) };
}

/**
 * admit(holo, facts) → { surprisal, bayes, perSlot } — facts is a Map or an
 * object slot → value. Surprisal and Bayesian surprise are each measured
 * against the prior as it stood BEFORE this admission, then the holograph is
 * updated (decayed by gamma, then counted). Totals are sums over slots, in bits.
 */
export function admit(holo, facts) {
  const entries = facts instanceof Map ? [...facts] : Object.entries(facts);
  // Decay first: the belief the admission is measured against is the one
  // present NOW, after what has faded since the last admission.
  if (holo.gamma < 1) for (const m of holo.slots.values()) for (const [v, c] of m) m.set(v, c * holo.gamma);
  const perSlot = {};
  let surprisal = 0, bayes = 0;
  const given = new Map(entries.map(([s, v]) => [s, String(v)]));
  // A slot the holograph holds and this instance lacks is admitted as ABSENT;
  // a slot new to the holograph starts with every earlier admission absent.
  for (const slot of holo.slots.keys()) if (!given.has(slot)) given.set(slot, ABSENT);
  for (const slot of given.keys()) if (!holo.slots.has(slot) && holo.admitted > 0) holo.slots.set(slot, new Map([[ABSENT, holo.absentMass ?? holo.admitted]]));
  for (const [slot, value] of given) {
    const m = holo.slots.get(slot) ?? new Map();
    // The support is the values seen, the one arriving, and the novel bucket.
    let N = 0; for (const c of m.values()) N += c;
    const K = m.size + (m.has(value) ? 0 : 1) + 1;
    const bv = (m.get(value) ?? 0) + holo.alpha, B = N + holo.alpha * K;
    const bits = -Math.log2(bv / B);
    const b = klAdmit(bv, B) / LN2;
    perSlot[slot] = { value, surprisal: bits, bayes: b };
    surprisal += bits; bayes += b;
    m.set(value, (m.get(value) ?? 0) + 1);
    holo.slots.set(slot, m);
  }
  holo.admitted++;
  holo.absentMass = (holo.absentMass ?? 0) * holo.gamma + 1;
  return { surprisal, bayes, perSlot };
}

/** A slot's current mode and its predictive probability. */
export function modeOf(holo, slot) {
  const m = holo.slots.get(slot);
  if (!m || !m.size) return null;
  const [value] = [...m].sort((a, b) => b[1] - a[1])[0];
  return { value, p: predict(holo, slot, value).p };
}
