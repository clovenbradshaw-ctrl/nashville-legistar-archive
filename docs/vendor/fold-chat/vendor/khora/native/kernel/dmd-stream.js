// native/kernel/dmd-stream.js — Dynamic Mode Decomposition as a READER has
// to do it: one snapshot at a time, nothing from the future.
//
// kernel/dmd.js is the batch core, and its own header says what a caller
// owes: batch over a whole reading consumes the future (READING-SPEC S3,
// S11). This file is the causal consumer — the streaming formulation of
// Hemati, Williams & Rowley (Phys. Fluids 26, 111701, 2014): maintain the
// running second-moment matrices
//
//   P = Σ x_k x_k^T        (state Gram)
//   K = Σ x_{k+1} x_k^T    (transition cross-moment)
//
// updated O(dims²) per push, and at ANY moment recover the operator
// A = K · P⁺ — mathematically the same least-squares operator batch DMD
// fits, so `modes()` at snapshot t equals batch DMD over the prefix ..t.
// That equality is pinned by test, not asserted.
//
// WHAT IS DELIBERATELY NOT HERE: no decay constant. The state pushed in is
// the raw observation; the eigenvalue magnitudes that come out ARE the
// measured decay of the reading's own modes. Imposing a gamma on the state
// before decomposing would hand the modes my number and call it theirs —
// the same contamination S10 names, one level up.

import { symmetricEigen, eigenvalues, matmul, transpose } from "./dmd.js";

export function createStreamingDmd({ dims, dt = 1 } = {}) {
  if (!Number.isInteger(dims) || dims < 1)
    throw new TypeError("createStreamingDmd: dims is declared — how many observables the reading tracks is the caller's to say");

  const P = Array.from({ length: dims }, () => new Array(dims).fill(0));
  const K = Array.from({ length: dims }, () => new Array(dims).fill(0));
  let prev = null;
  let pushes = 0;
  let pairs = 0;

  const push = (x) => {
    if (!Array.isArray(x) || x.length !== dims)
      throw new TypeError(`createStreamingDmd.push: state must have the declared ${dims} dims, got ${x?.length}`);
    if (prev) {
      for (let i = 0; i < dims; i += 1) {
        const pi = prev[i];
        if (pi !== 0) {
          for (let j = 0; j < dims; j += 1) {
            P[j][i] += prev[j] * pi;      // P += prev prevᵀ
            K[j][i] += x[j] * pi;         // K += x prevᵀ
          }
        }
      }
      pairs += 1;
    }
    prev = [...x];
    pushes += 1;
  };

  /**
   * The modes of everything pushed so far. `rank` is declared (S11's own
   * standing, inherited from dmd()): P's eigenspace is truncated there
   * before inversion, which is the projected-DMD regularization — a
   * direction the data never excited is not inverted into.
   */
  const modes = ({ rank, relTol = 1e-10 } = {}) => {
    if (!Number.isInteger(rank) || rank < 1)
      throw new TypeError("createStreamingDmd.modes: rank is declared — how many modes a reading may resolve is never a default");
    if (pairs < 2) return Object.freeze({ eigenvalues: Object.freeze([]), rank: 0, pairs, gap: "insufficient_pairs" });

    const { values, vectors } = symmetricEigen(P);
    const smax = Math.max(values[0] ?? 0, 0);
    const keep = [];
    for (let i = 0; i < values.length && keep.length < rank; i += 1) {
      if (values[i] <= 0 || (smax > 0 && values[i] / smax < relTol)) break;
      keep.push(i);
    }
    if (!keep.length) return Object.freeze({ eigenvalues: Object.freeze([]), rank: 0, pairs, gap: "degenerate_gram" });

    // U: dims x r eigenvectors of P; Ã = Uᵀ K U diag(1/λ)  (= Uᵀ A U)
    const U = Array.from({ length: dims }, (_, a) => keep.map((i) => vectors[a][i]));
    const UtKU = matmul(matmul(transpose(U), K), U);
    const At = UtKU.map((row) => row.map((v, j) => v / values[keep[j]]));

    const vals = eigenvalues(At).map((z) => {
      const magnitude = Math.hypot(z.re, z.im);
      return Object.freeze({
        re: z.re, im: z.im, magnitude,
        growth: magnitude > 0 ? Math.log(magnitude) / dt : -Infinity,
        frequency: Math.atan2(z.im, z.re) / dt,
        period: z.im !== 0 ? (2 * Math.PI) / Math.abs(Math.atan2(z.im, z.re) / dt) : null,
      });
    }).sort((a, b) => b.magnitude - a.magnitude);

    return Object.freeze({ eigenvalues: Object.freeze(vals), rank: keep.length, pairs });
  };

  return Object.freeze({ push, modes, get pairs() { return pairs; }, get pushes() { return pushes; } });
}
