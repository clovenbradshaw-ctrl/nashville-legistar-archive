// adapters/math/local.js — the LOW: what a curve looks like modulo small
// primes. NUL·Void · Clearing — a cheap measurement read before any
// expensive judgment, never a judgment itself.
//
// WHY THIS IS THE LOW. A family (construction.js) is the high: one formula
// that holds infinitely many curves, and whose own rank is a floor its
// members inherit (Silverman's specialization theorem — all but finitely many
// members keep it). The low runs the other way. Reducing a curve mod p and
// counting its points is local, fast, and says nothing certain — but Nagao's
// observation, proved by Rosen and Silverman for an important class of
// families, is that these counts averaged over primes are where rank LIVES.
// A curve with more points mod p than chance, prime after prime, is a curve
// on which high rank is POSSIBLE. The low sets the possibility; the descent
// (lib/pari-oracle.mjs) is what turns a possibility into a claim.
//
// THE SCORE, AND ITS SIGN. `nagao` is sum over good primes p <= N of
// a_p * ln(p), where #E(F_p) = p + 1 - a_p. More NEGATIVE means more points
// than chance, heuristically higher rank. The sign was calibrated in this
// repo's own session against curves of known rank before it was used
// (rank-3 curve: strongly negative; two rank-0 curves: near zero). It is a
// RANKING — nothing here compares it to a cutoff, and a caller that wants
// to know whether ranking by it helps must measure that against a random
// selection of the same size (eval/the-fold/curve-rank-sieve.mjs does).

const primesUpTo = (n) => {
  const sieve = new Uint8Array(n + 1);
  const out = [];
  for (let i = 2; i <= n; i += 1) {
    if (sieve[i]) continue;
    out.push(i);
    for (let j = i * i; j <= n; j += i) sieve[j] = 1;
  }
  return out;
};

const QR = new Map();
function legendreTable(p) {
  let t = QR.get(p);
  if (t) return t;
  t = new Int8Array(p).fill(-1);
  t[0] = 0;
  for (let a = 1; a < p; a += 1) t[(a * a) % p] = 1;
  QR.set(p, t);
  return t;
}

const modPowBig = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; };

/** A rational coefficient "n" or "n/d" reduced mod p, or null if p divides d. */
function reduce(coeff, p) {
  const [n, d = "1"] = String(coeff).split("/");
  const P = BigInt(p);
  const nn = ((BigInt(n) % P) + P) % P;
  const dd = ((BigInt(d) % P) + P) % P;
  if (dd === 0n) return null;
  return Number((nn * modPowBig(dd, P - 2n, P)) % P);
}

/** Five Weierstrass coefficients from [a1,a2,a3,a4,a6] or short [A,B]. */
const five = (coeffs) => (coeffs.length === 2 ? ["0", "0", "0", coeffs[0], coeffs[1]] : coeffs);

/**
 * apOf(coeffs, p) — the trace a_p for an odd prime of good reduction, or null
 * when p is bad (divides a denominator or the discriminant). Exact: counts
 * y-solutions of y^2 + (a1 x + a3) y = x^3 + a2 x^2 + a4 x + a6 for every x.
 */
export function apOf(coeffs, p) {
  if (p === 2) return null;
  const r = five(coeffs).map((c) => reduce(c, p));
  if (r.some((v) => v === null)) return null;
  const [a1, a2, a3, a4, a6] = r;
  const m = (x) => ((x % p) + p) % p;
  const b2 = m(a1 * a1 + 4 * a2), b4 = m(2 * a4 + a1 * a3), b6 = m(a3 * a3 + 4 * a6);
  const b8 = m(m(a1 * a1 * a6) + m(4 * a2 * a6) - m(m(a1 * a3) * a4) + m(a2 * a3 * a3) - m(a4 * a4));
  const disc = m(-m(m(b2 * b2) * b8) - m(8 * m(b4 * b4) * b4) - m(27 * m(b6 * b6)) + m(9 * m(b2 * b4) * b6));
  if (disc === 0) return null;
  const L = legendreTable(p);
  let s = 0;
  for (let x = 0; x < p; x += 1) {
    const lin = m(a1 * x + a3);
    const rhs = m(m(m(x * x) * x) + m(a2 * m(x * x)) + m(a4 * x) + a6);
    s += L[m(lin * lin + 4 * rhs)];
  }
  return s === 0 ? 0 : -s;
}

/**
 * nagao(coeffs, { primes }) — the local score over declared primes, with the
 * bad primes it skipped named rather than silently dropped.
 */
export function nagao(coeffs, { upTo = 500 } = {}) {
  let score = 0, used = 0;
  const skipped = [];
  for (const p of primesUpTo(upTo)) {
    const ap = apOf(coeffs, p);
    if (ap === null) { skipped.push(p); continue; }
    score += ap * Math.log(p);
    used += 1;
  }
  return Object.freeze({ score, used, skipped: Object.freeze(skipped), upTo });
}
