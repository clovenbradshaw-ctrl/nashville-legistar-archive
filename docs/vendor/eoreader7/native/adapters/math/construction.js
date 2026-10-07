// adapters/math/construction.js — INS·Pattern · Kind · Composing: a
// CONSTRUCTION kept as code, instantiated onto new material.
//
// capacities.js registers `skill` at INS·Kind as exactly this shape — "a
// procedure kept as code, instantiated onto new material". This file is that
// cell for constructed mathematics, and its point is the difference between
// the two ways to get a curve with many rational points:
//
//   SEARCH  — scan coefficients and hope points exist on what you land on.
//             Measured in this repo: 25,914 curves scanned by a Mestre-Nagao
//             sieve, best verified rank 3.
//   COMPOSE — choose the points FIRST and solve for the curve that carries
//             them. Each chosen point is LINEAR in the coefficients, so k
//             points and k unknowns is one exact rational linear system.
//
// The general Weierstrass form has five free coefficients:
//
//     y^2 + a1*x*y + a3*y = x^3 + a2*x^2 + a4*x + a6
//
// and each point (x,y) on it rearranges to a linear equation in them:
//
//     a1*(x*y) + a2*(-x^2) + a3*(y) + a4*(-x) + a6*(-1) = x^3 - y^2
//
// So five chosen points determine a curve passing through all five, exactly.
// What the construction does NOT get to decide — and what an oracle must —
// is whether those points are INDEPENDENT, whether some are torsion, or
// whether the curve is even nonsingular. Forcing five points is not a rank
// claim; it is five points. That boundary is the whole reason this file
// hands its output to lib/pari-oracle.mjs instead of reporting a number.
//
// A FAMILY (a Kind) is a base of points held fixed, with the remaining
// degrees of freedom open. Holding (-1,0), (-2,0), (-3,0) forces the cubic
// to (x+1)(x+2)(x+3) and leaves a1 and a3 free — a two-parameter family
// every member of which carries those three points by construction. That is
// the Kind; choosing the remaining points is the Figure.
//
// EXACT ARITHMETIC, NOT FLOATING POINT. A coefficient that is right to
// fifteen digits is a different curve. Everything here is BigInt rationals.

// ── exact rationals ────────────────────────────────────────────────────────

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };

/** A rational as a normalized [numerator, denominator] BigInt pair. */
export function rat(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new RangeError("construction: zero denominator");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
}

const add = ([a, b], [c, d]) => rat(a * d + c * b, b * d);
const sub = ([a, b], [c, d]) => rat(a * d - c * b, b * d);
const mul = ([a, b], [c, d]) => rat(a * c, b * d);
const div = ([a, b], [c, d]) => { if (c === 0n) throw new RangeError("construction: divide by zero"); return rat(a * d, b * c); };
const isZero = ([n]) => n === 0n;

/** Print a rational the way PARI reads it: "3" or "118/3". */
export const ratStr = ([n, d]) => (d === 1n ? String(n) : `${n}/${d}`);

const powRat = (r, k) => { let out = rat(1n); for (let i = 0; i < k; i += 1) out = mul(out, r); return out; };

// ── the linear solve ───────────────────────────────────────────────────────

/** Exact Gaussian elimination. Returns null when the system is singular. */
export function solve(M, b) {
  const n = M.length;
  const A = M.map((row, i) => [...row.map((x) => rat(...(Array.isArray(x) ? x : [x]))), rat(...(Array.isArray(b[i]) ? b[i] : [b[i]]))]);
  for (let col = 0; col < n; col += 1) {
    let piv = -1;
    for (let r = col; r < n; r += 1) if (!isZero(A[r][col])) { piv = r; break; }
    if (piv < 0) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    const pv = A[col][col];
    A[col] = A[col].map((x) => div(x, pv));
    for (let r = 0; r < n; r += 1) {
      if (r === col || isZero(A[r][col])) continue;
      const f = A[r][col];
      A[r] = A[r].map((x, j) => sub(x, mul(f, A[col][j])));
    }
  }
  return A.map((row) => row[n]);
}

// ── the construction ───────────────────────────────────────────────────────

/**
 * curveThroughPoints(points) — five (x,y) pairs → [a1,a2,a3,a4,a6] as
 * rational strings, or null when the five do not determine a curve (e.g.
 * two share an x, making the system singular).
 */
export function curveThroughPoints(points) {
  if (!Array.isArray(points) || points.length !== 5) return null;
  const M = [], b = [];
  for (const [xi, yi] of points) {
    const x = rat(xi), y = rat(yi);
    M.push([mul(x, y), mul(rat(-1n), mul(x, x)), y, mul(rat(-1n), x), rat(-1n)]);
    b.push(sub(powRat(x, 3), mul(y, y)));
  }
  const a = solve(M, b);
  return a ? a.map(ratStr) : null;
}

/**
 * defineFamily({ name, base }) — the KIND. `base` is the points every member
 * carries by construction; the remaining 5 - base.length points are the
 * family's free parameters.
 */
export function defineFamily({ name, base }) {
  if (!Array.isArray(base) || base.length > 5) throw new TypeError("construction: a family's base is at most five points");
  return Object.freeze({ name, base: Object.freeze(base.map((p) => Object.freeze([...p]))), degreesOfFreedom: 5 - base.length });
}

/**
 * instantiate(family, params) — the FIGURE. `params` supplies the family's
 * remaining points. Returns a candidate `{coeffs, forced, family}` or null
 * when this choice of parameters does not determine a curve.
 */
export function instantiate(family, params) {
  const points = [...family.base, ...params];
  if (points.length !== 5) return null;
  const xs = new Set(points.map(([x]) => String(x)));
  if (xs.size < 5) return null;
  const coeffs = curveThroughPoints(points);
  if (!coeffs) return null;
  return Object.freeze({ coeffs: Object.freeze(coeffs), forced: Object.freeze(points.map((p) => Object.freeze([...p]))), family: family.name });
}

/**
 * enumerate(family, { height }) — every parameter choice inside a declared
 * height bound, in a fixed order. The bound is the caller's DECLARED extent,
 * not a tuning knob discovered by trying several: a run states the height it
 * searched and that height is what its numbers are about.
 */
export function* enumerate(family, { height = 3 } = {}) {
  const coords = [];
  for (let x = -height; x <= height; x += 1) for (let y = 0; y <= height; y += 1) coords.push([x, y]);
  const k = family.degreesOfFreedom;
  const pick = function* (start, chosen) {
    if (chosen.length === k) { yield chosen; return; }
    for (let i = start; i < coords.length; i += 1) yield* pick(i + 1, [...chosen, coords[i]]);
  };
  for (const params of pick(0, [])) {
    const c = instantiate(family, params);
    if (c) yield c;
  }
}

/** The family the measured run uses: three collinear-in-x base points. */
export const THREE_ROOT_FAMILY = defineFamily({ name: "three-root", base: [[-3, 0], [-2, 0], [-1, 0]] });

// ── eight points on a cubic (Mestre's square-root construction) ────────────
//
// One level up from forcing points by a linear solve. Take eight distinct
// rationals r_i and the monic octic q(x) = prod (x - r_i). There is exactly
// one monic quartic g whose square agrees with q from x^8 down to x^4, so
// h = g^2 - q has degree at most 3, and at every root
//
//     h(r_i) = g(r_i)^2 - q(r_i) = g(r_i)^2
//
// so the cubic y^2 = h(x) carries all eight points (r_i, g(r_i)). Nothing is
// solved and nothing can fail except h losing its cubic term: the eight roots
// ARE the eight points, held losslessly in one polynomial identity.
//
// THE RELATION, DECLARED. y - g(x) is a function on the curve whose only
// zeros are those eight points and whose only pole is at infinity, so the
// eight points SUM TO ZERO in the group. At most seven are independent by
// construction. Any rank above seven on a member was found by the descent,
// not put there by this file — the two must never be reported as one.
//
// ISOMORPHISM, EXACT. Translating every root, negating every root, or scaling
// every root by one rational all give the same curve up to isomorphism over
// Q, so the same rank. `canonicalRoots` reduces a root set to one
// representative, and a search that skips repeats spends no oracle call
// re-deciding a curve it already decided.

const polyMul = (a, b) => {
  const out = Array.from({ length: a.length + b.length - 1 }, () => rat(0n));
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] = add(out[i + j], mul(a[i], b[j]));
  return out;
};
const polyEval = (p, x) => p.reduceRight((acc, c) => add(mul(acc, x), c), rat(0n));
const half = (r) => div(r, rat(2n));

/**
 * eightOnACubic(roots) — eight distinct integers → a candidate carrying the
 * eight points, in short-ish Weierstrass form [0, a2, 0, a4, a6], or null.
 */
export function eightOnACubic(roots) {
  if (!Array.isArray(roots) || roots.length !== 8 || new Set(roots.map(String)).size !== 8) return null;
  const rs = roots.map((r) => rat(r));
  let q = [rat(1n)];
  for (const r of rs) q = polyMul(q, [mul(rat(-1n), r), rat(1n)]);
  const g3 = half(q[7]);
  const g2 = half(sub(q[6], mul(g3, g3)));
  const g1 = half(sub(q[5], mul(rat(2n), mul(g3, g2))));
  const g0 = half(sub(sub(q[4], mul(rat(2n), mul(g3, g1))), mul(g2, g2)));
  const g = [g0, g1, g2, g3, rat(1n)];
  const h = polyMul(g, g).map((c, i) => sub(c, q[i]));
  for (let i = 4; i <= 8; i += 1) if (!isZero(h[i])) throw new Error(`construction: g^2 - q kept degree ${i} — the square root is wrong`);
  const [h0, h1, h2, h3] = h;
  if (isZero(h3)) return null;
  // y^2 = h3 x^3 + h2 x^2 + h1 x + h0  —(X = h3 x, Y = h3 y)→  Y^2 = X^3 + h2 X^2 + h1 h3 X + h0 h3^2
  const coeffs = [rat(0n), h2, rat(0n), mul(h1, h3), mul(h0, mul(h3, h3))].map(ratStr);
  const forced = rs.map((r) => Object.freeze([ratStr(mul(h3, r)), ratStr(mul(h3, polyEval(g, r)))]));
  return Object.freeze({
    coeffs: Object.freeze(coeffs),
    forced: Object.freeze(forced),
    family: "eight-on-a-cubic",
    roots: Object.freeze(roots.map(String)),
    independentByConstruction: 7,
  });
}

const gcdNum = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/** One representative per isomorphism class under translate / negate / scale. */
export function canonicalRoots(roots) {
  const norm = (rs) => {
    const m = Math.min(...rs);
    const shifted = rs.map((r) => r - m).sort((a, b) => a - b);
    const g = shifted.reduce((acc, v) => gcdNum(acc, v), 0) || 1;
    return shifted.map((v) => v / g);
  };
  const a = norm(roots), b = norm(roots.map((r) => -r));
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? a : b;
  return a;
}

// ── Elkies-Klagsbrun's rank-9-generic fibration (2020) ─────────────────────
//
// Every family above forces rank by SOLVING for a curve through chosen
// points, so its floor is bounded by how many points a linear/quadratic
// system can carry (5, or 7 independent via Mestre's octic). This is a
// different KIND of floor: a published elliptic FIBRATION E_u/Q(t) whose
// Mordell-Weil group is PROVEN to be Z/2Z x Z^9 over Q(t) for every u with
// 5 - u^2 a perfect square (u != +-1, +-2, to exclude CM points) — nine
// independent points come from the fibration's own structure, not from any
// construction this file performs. Silverman's specialization theorem (the
// same theorem local.js's own header names) says every t but finitely many
// keeps that rank 9 on the specialized curve E_u,t/Q for FREE; the published
// search (Elkies & Klagsbrun, "New Rank Records for Elliptic Curves Having
// Rational Torsion", ANTS 2020, section 9) then used exactly this file's own
// method — Nagao's score, ranking candidate t before any descent — to find
// t giving MUCH higher rank on the specialization: 17 curves of rank 19 at
// u=2/5, and one rank-20 curve at u=11/5 — the largest UNCONDITIONALLY KNOWN
// rank for any elliptic curve over Q at the time of that paper. THE u=11/5
// SEARCH WAS DONE IN A TRANSFORMED COORDINATE (the paper applies
// t -> (2-t)/(t-6) to E_11/5 before searching, section 9) — a t reported in
// the paper's prose for that u is in THAT coordinate, not this function's
// own (the "original model of Eu"), and the paper states both values
// side by side for exactly this reason. Verified here on the ORIGINAL-model
// values: t=-721141/2026305 (the paper's rank-20 curve) gives a descent
// bound of [12,20] with this file's own 9 forced points — consistent, not
// pinned; t=-26876/131019 (the paper's smaller-discriminant rank-19 curve)
// PINS EXACTLY at rank 19 via full 2-descent — an independent reproduction
// of a published record, not a plausible-looking number.
//
// GIVEN, NEVER RE-DERIVED. y^2 = x^3 + 2*A(t,u)*x^2 + B(t,u)*x, with A a
// fixed quartic in t whose coefficients are given polynomials in u, and B a
// product of four linear-in-t factors and their images under
// B_i(t,u) = -B_{i-1}(-t,-u) — computed here by literally calling the SAME
// function on negated (t,u) and negating the result, never by hand-expanding
// the substitution, so a transcription slip in this file can only be in the
// four B_1/B_3/B_5/B_7 polynomials themselves, checkable by eye against the
// paper, not in an algebra step nobody can check.
const EK_U_WITH_5_MINUS_U2_SQUARE = Object.freeze({ "2/5": true, "11/5": true }); // 5-(2/5)^2=(11/5)^2; 5-(11/5)^2=(2/5)^2 -- both checked, both usable

function ekA(t, u) {
  // c4..c0 transcribed term-by-term from formula (3), each a plain
  // polynomial in u alone, so it reads back against the paper one summand
  // at a time rather than as one long expression.
  const c4 = add(sub(add(sub(powRat(u, 8), mul(rat(18n), powRat(u, 6))), mul(rat(163n), powRat(u, 4))), mul(rat(1152n), powRat(u, 2))), rat(4096n)); // u^8 - 18u^6 + 163u^4 - 1152u^2 + 4096
  const c3 = add(sub(sub(mul(rat(3n), powRat(u, 7)), mul(rat(35n), powRat(u, 5))), mul(rat(120n), powRat(u, 3))), mul(rat(1536n), u)); // 3u^7 - 35u^5 - 120u^3 + 1536u
  const c2 = add(sub(add(sub(powRat(u, 8), mul(rat(13n), powRat(u, 6))), mul(rat(32n), powRat(u, 4))), mul(rat(152n), powRat(u, 2))), rat(1536n)); // u^8 - 13u^6 + 32u^4 - 152u^2 + 1536
  const c1 = add(sub(add(powRat(u, 7), mul(rat(3n), powRat(u, 5))), mul(rat(156n), powRat(u, 3))), mul(rat(672n), u)); // u^7 + 3u^5 - 156u^3 + 672u
  const c0 = sub(add(sub(mul(rat(3n), powRat(u, 6)), mul(rat(33n), powRat(u, 4))), mul(rat(112n), powRat(u, 2))), rat(80n)); // 3u^6 - 33u^4 + 112u^2 - 80
  return add(add(add(add(mul(c4, powRat(t, 4)), mul(c3, powRat(t, 3))), mul(c2, powRat(t, 2))), mul(c1, t)), c0);
}

const B1 = (t, u) => add(mul(add(mul(u, u), sub(u, rat(8n))), t), sub(rat(2n), u));
const B3 = (t, u) => add(mul(sub(sub(mul(u, u), u), rat(8n)), t), sub(add(mul(u, u), u), rat(10n)));
const B5 = (t, u) => add(mul(add(sub(mul(u, u), mul(rat(7n), u)), rat(8n)), t), add(sub(u, mul(u, u)), rat(2n)));
const B7 = (t, u) => add(mul(add(add(mul(u, u), mul(rat(5n), u)), rat(8n)), t), add(add(mul(u, u), mul(rat(3n), u)), rat(2n)));
const neg = (r) => mul(rat(-1n), r);

/** The eight B_i(t,u), even-indexed ones by the paper's own stated symmetry
 * B_i(t,u) = -B_{i-1}(-t,-u) — computed by calling B1/B3/B5/B7 on negated
 * (t,u), never by hand-expanding the substitution. */
function ekBValues(t, u) {
  const B1v = B1(t, u), B2v = neg(B1(neg(t), neg(u)));
  const B3v = B3(t, u), B4v = neg(B3(neg(t), neg(u)));
  const B5v = B5(t, u), B6v = neg(B5(neg(t), neg(u)));
  const B7v = B7(t, u), B8v = neg(B7(neg(t), neg(u)));
  return [B1v, B2v, B3v, B4v, B5v, B6v, B7v, B8v];
}
const ekB = (t, u) => ekBValues(t, u).reduce((acc, b) => mul(acc, b), rat(1n));

// Appendix A's u -> m parametrization (formula 8), solved for the two
// declared u: u = 2(m^2-m-1)/(m^2+1). u=2/5 -> m=2 (1/5*2=2/5); u=11/5 ->
// m=-3 (11/10*2=11/5) — both checked by direct substitution, not assumed.
const EK_M_FOR_U = Object.freeze({ "2/5": 2n, "11/5": -3n });

/** Exact non-negative-integer floor sqrt (Newton's method), BigInt only. */
function isqrt(n) {
  if (n < 0n) throw new RangeError("construction: isqrt of a negative BigInt");
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

/** Exact rational sqrt, or null when [n,d] (already reduced) is not one —
 * gcd(n,d)=1 so y is rational iff n and d are EACH a perfect square. */
function ratSqrt([n, d]) {
  if (n < 0n) return null;
  const sn = isqrt(n), sd = isqrt(d);
  return sn * sn === n && sd * sd === d ? rat(sn, sd) : null;
}

/**
 * Appendix A's list (7) — the x-coordinates of 8 generators in Q(u)[t],
 * true for ANY declared u — plus the 9th, -(m-1)^2 B1 B2 B3 B8, which needs
 * m rational (EK_M_FOR_U's two declared u only). Returns rational x-coords;
 * the caller pairs each with its y via the curve equation.
 */
function ekXCoords(t, u, uKey) {
  const [B1v, B2v, B3v, B4v, B5v, B6v, B7v, B8v] = ekBValues(t, u);
  const xs = [
    neg(mul(mul(B1v, B2v), mul(B3v, B6v))),                              // -B1 B2 B3 B6
    neg(mul(mul(B1v, B2v), mul(B4v, B5v))),                              // -B1 B2 B4 B5
    mul(rat(4n), mul(mul(B1v, B2v), mul(B5v, B6v))),                     // 4 B1 B2 B5 B6
    mul(mul(B1v, B3v), mul(B4v, B6v)),                                   // B1 B3 B4 B6
    neg(mul(mul(B1v, B3v), mul(B4v, B7v))),                              // -B1 B3 B4 B7
    mul(mul(B1v, B3v), mul(B4v, B8v)),                                   // B1 B3 B4 B8
    mul(mul(B1v, B3v), mul(B5v, B6v)),                                   // B1 B3 B5 B6
    neg(mul(mul(B1v, B5v), mul(B6v, B7v))),                              // -B1 B5 B6 B7
  ];
  const m = EK_M_FOR_U[uKey];
  if (m !== undefined) {
    const mMinus1 = sub(rat(m), rat(1n));
    xs.push(neg(mul(powRat(mMinus1, 2), mul(mul(B1v, B2v), mul(B3v, B8v))))); // -(m-1)^2 B1 B2 B3 B8
  }
  return xs;
}

/**
 * elkiesKlagsbrunFibration(u, t) — a candidate `{coeffs, forced, family, u,
 * t}` on E_u/Q(t), or null when 5-u^2 is not a declared perfect square
 * (never silently proceeding on an unchecked u). `u` and `t` are rational
 * strings ("2/5"); the returned coeffs are short-form-adjacent
 * [a1,a2,a3,a4,a6] = [0, 2A, 0, B, 0], the same 5-slot shape every other
 * candidate here carries.
 *
 * `forced` carries the 9 generator points from Appendix A (formula 7 plus
 * the m-parametrized 9th), each an x-coordinate from the paper PAIRED HERE
 * with an exact rational y solved from y^2 = x^3 + 2A x^2 + B x — the paper
 * gives only x-coordinates, so y is computed, never transcribed, and a point
 * whose y^2 is not a perfect rational square (should not happen at a generic
 * t; would mean either a bad t or a transcription error upstream) is dropped
 * rather than guessed. `independentByConstruction` is NOT set: unlike
 * eight-on-a-cubic's algebraic identity, these 9 points are independent by
 * the paper's own proof over Q(t), not by anything checkable in this file —
 * a caller wanting that fact confirmed for one candidate calls
 * lib/pari-oracle.mjs's `independence()`.
 */
export function elkiesKlagsbrunFibration(u, t) {
  const uKey = String(u);
  if (!EK_U_WITH_5_MINUS_U2_SQUARE[uKey]) return null;
  const U = rat(...uKey.split("/").map(BigInt));
  const T = rat(...String(t).split("/").map(BigInt));
  const A = ekA(T, U);
  const B = ekB(T, U);
  const a2 = mul(rat(2n), A);
  const forced = [];
  for (const x of ekXCoords(T, U, uKey)) {
    const y2 = add(add(powRat(x, 3), mul(a2, powRat(x, 2))), mul(B, x));
    const y = ratSqrt(y2);
    if (y) forced.push(Object.freeze([ratStr(x), ratStr(y)]));
  }
  return Object.freeze({
    coeffs: Object.freeze([ratStr(rat(0n)), ratStr(a2), ratStr(rat(0n)), ratStr(B), ratStr(rat(0n))]),
    forced: Object.freeze(forced),
    family: "elkies-klagsbrun-fibration",
    u: uKey,
    t: String(t),
  });
}
