/* Koopman speaks:
 * “It is the object of this note to outline certain 
investigations of our own in which the domain of this theory has been 
extended in such a way as to include classical Hamiltonian mechanics, 
or, more generally, systems defining a steady n-dimensional flow of a 
fluid of positive density.”
 *
 * This file implements the DMD operator, a method for approximating the eigenvectors and eigenvalues of a dynamical system.  The DMD operator is used to analyze the dynamics of a system and to understand the system's behavior.  My teaching, however, emphasizes the importance of understanding the underlying mathematical principles that govern the DMD operator's application.
 *
 * — the engineering record below, kept whole —
 */
// native/kernel/dmd.js — Dynamic Mode Decomposition: the coherent modes of a
// Handle: Koopman — after the operator whose eigenvalues DMD approximates: modes with their own growth rate and their own frequency. Amendment XVII.
// state trajectory, each with its own growth rate and its own FREQUENCY.
//
// WHY THIS IS HERE, and what it closes. A received prior holds a form's class
// in superposition ({AUX:154, VERB:335}) and a frequency table can never say
// more than a magnitude — counts give |amplitude|^2 and throw the PHASE away,
// which is why a density-matrix treatment built on counts reduces exactly to
// Bayes' rule and adds nothing but notation. DMD gets the missing quantity
// from somewhere a count cannot reach: the DYNAMICS. Its eigenvalues are
// complex, lambda = |lambda| * e^(i*theta) — magnitude is growth or decay,
// argument is frequency. DMD eigenvalues approximate KOOPMAN eigenvalues, and
// the Koopman operator is the linear representation of a nonlinear system in
// observable space, so the Hilbert-space structure here is measured rather
// than asserted.
//
// THE WHEEL (native/docs/THE-WHEEL.md): DMD decomposes the RIM's dynamics —
// the Fold grain, the difference the being made, at its own growth and its
// own frequency. The fold is one (1), the mode the many (n) excite.
//
// WHY DECOMPOSITION AND NOT A DEEPER SPREAD. memory/activation.js rejects
// multi-hop spreading activation by name: a diffuse spread "pools inside a
// passage's own dense vocabulary and drowns the distant target," so it stops
// at ONE recurrent hop. That objection is about SPREADING. DMD does not
// spread; it decomposes a trajectory that has already been read. The flood
// argument does not transfer, which is the reason to decompose rather than to
// lift the one-hop cap.
//
// CAUSALITY, AND THE VARIANT THIS FILE IS. Batch DMD over a whole reading
// consumes the future, which this repo's memory law forbids ("computed with
// nothing from the future"). The functions here are the BATCH core, written
// to be correct and testable in isolation; a causal consumer must feed them
// only a prefix, or use the streaming formulation (Hemati, Williams & Rowley,
// Phys. Fluids 26, 111701, 2014 — incremental, mathematically equivalent to
// batch). Nothing in this file enforces that; the caller owns it, and a
// caller that hands it a whole book has read the future.
//
// PURE. No engine import, no priors, no notion of text. A trajectory of
// numeric states in, modes out.

const EPS = 1e-12;

const rows = (M) => M.length;
const cols = (M) => (M[0]?.length ?? 0);
const zeros = (m, n) => Array.from({ length: m }, () => new Array(n).fill(0));

export const transpose = (M) => {
  const out = zeros(cols(M), rows(M));
  for (let i = 0; i < rows(M); i += 1) for (let j = 0; j < cols(M); j += 1) out[j][i] = M[i][j];
  return out;
};

export const matmul = (A, B) => {
  const m = rows(A), k = cols(A), n = cols(B);
  if (k !== rows(B)) throw new TypeError(`dmd.matmul: inner dimensions disagree (${k} vs ${rows(B)})`);
  const out = zeros(m, n);
  for (let i = 0; i < m; i += 1) {
    for (let p = 0; p < k; p += 1) {
      const a = A[i][p];
      if (a === 0) continue;
      for (let j = 0; j < n; j += 1) out[i][j] += a * B[p][j];
    }
  }
  return out;
};

/**
 * symmetricEigen — cyclic Jacobi rotation for a real symmetric matrix.
 * Returns eigenvalues descending with their eigenvectors as columns.
 * Chosen over a general solver because the only symmetric matrix this file
 * needs is the small Gram matrix of the snapshot set.
 */
export const symmetricEigen = (S, { sweeps = 100, tol = 1e-14 } = {}) => {
  const n = rows(S);
  const A = S.map((r) => [...r]);
  let V = zeros(n, n);
  for (let i = 0; i < n; i += 1) V[i][i] = 1;

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += A[p][q] * A[p][q];
    if (Math.sqrt(off) < tol) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(A[p][q]) < tol) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
  return {
    values: order.map((i) => A[i][i]),
    vectors: Array.from({ length: n }, (_, r) => order.map((i) => V[r][i])),
  };
};

/**
 * economySVD — X = U * diag(s) * V^T, truncated at `rank` and at a relative
 * singular-value floor. Built from the symmetric eigendecomposition of X X^T
 * because the state dimension here is small by construction: salience selects
 * the observables, so this never sees a full vocabulary.
 */
export const economySVD = (X, { rank = Infinity, relTol = null } = {}) => {
  // Eigendecompose whichever Gram is SMALLER — X Xᵀ (m×m) or Xᵀ X (n×n).
  // Both have the same nonzero spectrum, so this is an identity, not an
  // approximation, and the rank can never exceed min(m,n) anyway. Derived
  // from the matrix's own shape; nothing is chosen.
  if (cols(X) < rows(X)) {
    const { U: Vn, s, V: Un } = economySVD(transpose(X), { rank, relTol });
    return { U: Un, s, V: Vn, rank: s.length };
  }
  const G = matmul(X, transpose(X));               // m x m
  const { values, vectors } = symmetricEigen(G);
  const smax = Math.sqrt(Math.max(values[0] ?? 0, 0));
  // NUMERICAL RANK, derived rather than typed: the standard criterion is
  // tol = max(m,n) * eps * sigma_max — the floor below which a singular
  // value is indistinguishable from floating-point noise at THIS matrix's
  // size and scale. A hand-typed relTol would be a modelling choice wearing
  // a precision floor's clothes (READING-SPEC S10's lesson, one register
  // over); passing relTol explicitly overrides, and is then a declaration.
  const eps = Number.EPSILON;
  const derivedRelTol = Math.max(rows(X), cols(X)) * eps;
  const tol = relTol ?? derivedRelTol;
  const keep = [];
  for (let i = 0; i < values.length && keep.length < rank; i += 1) {
    const s = Math.sqrt(Math.max(values[i], 0));
    if (smax > 0 && s / smax < tol) break;
    if (s <= EPS) break;
    keep.push({ s, i });
  }
  const r = keep.length;
  const U = Array.from({ length: rows(X) }, (_, a) => keep.map(({ i }) => vectors[a][i]));
  const s = keep.map((k) => k.s);
  // V = X^T U S^-1
  const Vt = matmul(transpose(X), U);              // n x r
  const V = Vt.map((row) => row.map((v, j) => v / s[j]));
  return { U, s, V, rank: r };
};

// ── complex eigenvalues of a small real matrix ──────────────────────────
// Hessenberg reduction then shifted QR, reading 1x1 and 2x2 diagonal blocks
// off the real Schur form. A 2x2 block with negative discriminant IS the
// complex-conjugate pair, and that pair is the whole reason this file exists:
// its argument is the frequency a count can never carry.

const hessenberg = (Ain) => {
  const n = rows(Ain);
  const A = Ain.map((r) => [...r]);
  for (let k = 0; k < n - 2; k += 1) {
    let norm = 0;
    for (let i = k + 1; i < n; i += 1) norm += A[i][k] * A[i][k];
    norm = Math.sqrt(norm);
    if (norm < EPS) continue;
    const alpha = A[k + 1][k] > 0 ? -norm : norm;
    const v = new Array(n).fill(0);
    v[k + 1] = A[k + 1][k] - alpha;
    for (let i = k + 2; i < n; i += 1) v[i] = A[i][k];
    let vnorm = 0;
    for (let i = k + 1; i < n; i += 1) vnorm += v[i] * v[i];
    if (vnorm < EPS) continue;
    for (let j = 0; j < n; j += 1) {
      let dot = 0;
      for (let i = k + 1; i < n; i += 1) dot += v[i] * A[i][j];
      const f = (2 * dot) / vnorm;
      for (let i = k + 1; i < n; i += 1) A[i][j] -= f * v[i];
    }
    for (let i = 0; i < n; i += 1) {
      let dot = 0;
      for (let j = k + 1; j < n; j += 1) dot += A[i][j] * v[j];
      const f = (2 * dot) / vnorm;
      for (let j = k + 1; j < n; j += 1) A[i][j] -= f * v[j];
    }
  }
  return A;
};

const eigenvaluesOf2x2 = (a, b, c, d) => {
  const tr = a + d;
  const det = a * d - b * c;
  const disc = (tr * tr) / 4 - det;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return [{ re: tr / 2 + s, im: 0 }, { re: tr / 2 - s, im: 0 }];
  }
  const s = Math.sqrt(-disc);
  return [{ re: tr / 2, im: s }, { re: tr / 2, im: -s }];
};

export const eigenvalues = (Ain, { iterations = 500, tol = 1e-12 } = {}) => {
  const n = rows(Ain);
  if (n === 0) return [];
  if (n === 1) return [{ re: Ain[0][0], im: 0 }];
  let A = hessenberg(Ain);
  let high = n - 1;
  const out = [];
  let guard = 0;

  while (high >= 0 && guard < iterations * n) {
    guard += 1;
    if (high === 0) { out.push({ re: A[0][0], im: 0 }); break; }

    // deflate on a negligible subdiagonal
    const small = Math.abs(A[high][high - 1]) <= tol * (Math.abs(A[high][high]) + Math.abs(A[high - 1][high - 1]) + EPS);
    if (small) {
      out.push({ re: A[high][high], im: 0 });
      high -= 1;
      A = A.slice(0, high + 1).map((r) => r.slice(0, high + 1));
      continue;
    }
    if (high === 1 || Math.abs(A[high - 1][high - 2]) <= tol * (Math.abs(A[high - 1][high - 1]) + Math.abs(A[high - 2][high - 2]) + EPS)) {
      const pair = eigenvaluesOf2x2(A[high - 1][high - 1], A[high - 1][high], A[high][high - 1], A[high][high]);
      out.push(pair[0], pair[1]);
      high -= 2;
      if (high < 0) break;
      A = A.slice(0, high + 1).map((r) => r.slice(0, high + 1));
      continue;
    }

    // Wilkinson-shifted QR step via Gram-Schmidt on the shifted block
    const m = high + 1;
    const mu = A[high][high];
    const S = A.map((r, i) => r.map((v, j) => (i === j ? v - mu : v)));
    const Q = zeros(m, m);
    const R = zeros(m, m);
    for (let j = 0; j < m; j += 1) {
      const v = S.map((r) => r[j]);
      for (let i = 0; i < j; i += 1) {
        let dot = 0;
        for (let k = 0; k < m; k += 1) dot += Q[k][i] * S[k][j];
        R[i][j] = dot;
        for (let k = 0; k < m; k += 1) v[k] -= dot * Q[k][i];
      }
      let nrm = 0;
      for (let k = 0; k < m; k += 1) nrm += v[k] * v[k];
      nrm = Math.sqrt(nrm);
      R[j][j] = nrm;
      for (let k = 0; k < m; k += 1) Q[k][j] = nrm > EPS ? v[k] / nrm : 0;
    }
    const RQ = matmul(R, Q);
    A = RQ.map((r, i) => r.map((v, j) => (i === j ? v + mu : v)));
  }
  return out;
};

/**
 * dmd — the decomposition itself.
 *
 * @param {number[][]} X  states 0..n-2 as columns (observables x snapshots)
 * @param {number[][]} Xp states 1..n-1 as columns, same shape
 * @param {object} options
 * @param {number|"numerical"} options.rank truncation. An integer is a
 *   declaration of model order. "numerical" derives it from the spectrum
 *   itself — keep every direction the data excited above floating-point
 *   noise — which is the only honest answer when no golden says how many
 *   modes a reading has. Never silently defaulted either way.
 * @param {number} [options.dt] sample spacing, for continuous-time rates
 * @returns {{eigenvalues: Array<{re,im,magnitude,frequency,growth}>, rank: number, operator: number[][]}}
 */
export const dmd = (X, Xp, { rank, dt = 1, relTol = null } = {}) => {
  const numerical = rank === "numerical";
  if (!numerical && (!Number.isInteger(rank) || rank < 1))
    throw new TypeError('dmd: rank is declared — an integer model order, or "numerical" to derive it from the spectrum; never a silent default');
  if (rows(X) !== rows(Xp) || cols(X) !== cols(Xp))
    throw new TypeError("dmd: X and X' must have the same shape");
  const { U, s, V, rank: r } = economySVD(X, { rank: numerical ? Infinity : rank, relTol });
  if (r === 0) return Object.freeze({ eigenvalues: [], rank: 0, operator: [] });

  // Atilde = U^T X' V S^-1
  const UtXp = matmul(transpose(U), Xp);           // r x n
  const UtXpV = matmul(UtXp, V);                   // r x r
  const At = UtXpV.map((row) => row.map((v, j) => v / s[j]));

  const vals = eigenvalues(At).map((z) => {
    const magnitude = Math.hypot(z.re, z.im);
    return Object.freeze({
      re: z.re,
      im: z.im,
      magnitude,
      // the two quantities a frequency table cannot carry
      growth: magnitude > 0 ? Math.log(magnitude) / dt : -Infinity,
      frequency: Math.atan2(z.im, z.re) / dt,
    });
  }).sort((a, b) => b.magnitude - a.magnitude);

  return Object.freeze({ eigenvalues: Object.freeze(vals), rank: r, operator: At });
};
