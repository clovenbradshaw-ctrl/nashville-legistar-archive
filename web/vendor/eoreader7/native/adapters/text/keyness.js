// keyness.js — is this word said more here than the language says it?
//
// The second significance instrument, sibling to surfaces.js's
// `capitalisationIsSignificant`. That one asks of a capital: is this word's
// capitalised share further above a fair coin than chance alone would put it,
// at THIS word's own sample size? This one asks of a lowercase being-candidate
// ("the pawl", "the maid"): is this word's rate in THIS material further above
// the rate a received corpus gives it than chance alone would put it, at THIS
// material's own size? Same exact one-sided binomial tail, same declared 5%
// resolution, a different null — because case is one witness of a being and
// recurrence under a determiner is another, and each earns its standing
// against its own baseline, not against a number borrowed from the other.
//
// WHY A BASELINE AT ALL. Measured on 30 KB of War and Peace: promoting every
// recurring definite/possessive descriptor to a referent added 185 beings to a
// 38-being cast, and nearly all of them were the language's own furniture —
// "the time", "the thing", "the world", "her eyes", "that moment". A noun the
// language says that often says it in every text; saying it twice here is
// nothing. The same gate passes "the maid", "the ambassador", "the vicomte",
// which the language seldom says and this text keeps saying. No word of any
// language is named: the baseline is a RECEIVED giver's own counts (a POS prior
// carries `provenance.tokens_read` and a count per form), and a language with no
// prior has no baseline — the lane abstains, typed, rather than admit on a
// number it does not have.
//
// PURE. No file is read; the prior is the caller's.

/** The declared 5% resolution, the same standing as surfaces.js's CAP_SIG_ALPHA. */
export const KEY_ALPHA = 0.05;

// ln Γ(x), Lanczos (g=7, n=9): exact to ~1e-13 over the range a count reaches,
// so the tail below is the exact answer and not an approximation to it.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
const lnGamma = (x) => {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i += 1) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
};
const lnChoose = (n, k) => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);

/**
 * ln P(X >= k | n trials, success probability p): the exact upper binomial
 * tail in log space. Summed upward from k, where the terms fall away, and
 * stopped when a term no longer moves the sum — never a normal approximation
 * (surfaces.js S37 measured that one diverging in both directions at low n),
 * never a factorial (which overflows) or a bare 0.5^n (which underflows).
 */
export const logBinomialUpperTail = (k, n, p) => {
  if (k <= 0) return 0;
  if (k > n) return -Infinity;
  if (!(p > 0)) return -Infinity;
  if (p >= 1) return 0;
  const lp = Math.log(p), lq = Math.log1p(-p);
  let logTerm = lnChoose(n, k) + k * lp + (n - k) * lq; // ln P(X = k)
  let logSum = logTerm;
  for (let j = k; j < n; j += 1) {
    logTerm += Math.log((n - j) / (j + 1)) + lp - lq; // ln P(X = j+1) from ln P(X = j)
    const next = Math.max(logSum, logTerm) + Math.log1p(Math.exp(-Math.abs(logSum - logTerm)));
    if (next - logSum < 1e-15 && logTerm < logSum) { logSum = next; break; }
    logSum = next;
  }
  return Math.min(0, logSum);
};

/**
 * Is a word seen `k` times in `n` tokens said significantly more than a
 * baseline rate `p0` gives it? The null is that this material draws the word
 * at the received rate; the answer is whether it falls below `alpha`. A word
 * seen no more often than its baseline expects is not key by construction, and
 * is not computed.
 */
export const isKeyInMaterial = (k, n, p0, { alpha = KEY_ALPHA } = {}) => {
  if (!(n > 0) || !(k > 1) || !(p0 > 0)) return false;
  if (k <= n * p0) return false;
  return Math.exp(logBinomialUpperTail(k, n, p0)) < alpha;
};

/**
 * receivedRate(prior) → (form) => the rate the received corpus gives `form`,
 * or null when there is no corpus to give one. Add-one smoothing over the
 * prior's own token count and vocabulary, so a form the treebank never met has
 * a small, nonzero rate and is judged against it, not assumed absent: the
 * treebank's silence about "pawl" is what makes "pawl" key, not what excuses it.
 * The prior's own declared figures only — `provenance.tokens_read` and the
 * per-form class counts POSPrior@1 carries.
 */
export function receivedRate(prior) {
  const tokens = Number(prior?.provenance?.tokens_read);
  const forms = prior?.forms;
  if (!forms || !(tokens > 0)) return () => null;
  const vocabulary = Number(prior?.provenance?.forms_kept) || Object.keys(forms).length;
  return (form) => {
    const counts = forms[String(form ?? "").toLowerCase()];
    const seen = counts ? Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
    return (seen + 1) / (tokens + vocabulary + 1);
  };
}
