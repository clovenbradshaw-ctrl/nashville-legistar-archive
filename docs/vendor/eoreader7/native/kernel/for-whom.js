// for-whom.mjs — arbitrary adjudicators: spin up a reader with a
// PARTICULAR ground, PARTICULAR priors, and a PARTICULAR universe of
// meaning, gated by whether its reading makes a difference to its
// question. (2026-09-13)
//
// THE VISION. Content recovery is Pattern -> Figure: the reader notices a
// difference and resolves it to an exact Figure. But WHO is reading, and
// FOR WHAT? S113: identity exists only for-whom. This organ makes that
// general and jurisdictional: a for-whom is a FRAME — for whom (giver),
// for what (question), under what (priors), on what field (ground),
// through what (medium), by what knowing. It reads the SAME material
// through that frame and is gated by whether the reading makes a
// difference to its question.
//
// THE WHEEL (native/docs/THE-WHEEL.md): the beings are the particulars —
// the spokes, the span-free referent nodes. A for-whom is a being's
// jurisdiction: identity exists only for-whom (S113), the spoke's witness.
//
// THE GATE IS THREE LEGS (2026-09-13, measured): DMD coherence (the
// trajectory has order-dependent structure above its shuffled null),
// material discovery (it found the text at all), and QUESTION RELEVANCE
// (its structure touches the question's terms — Bateson: a difference
// that makes a difference). Every script-prior clears legs 1+2 on any
// text; only the for-whom whose reading is ABOUT the question survives.
//
// THE FOLD (2026-09-13, P159): the universe is NEVER recomputed. Each
// for-whom carries a FOLDED STATE — running accumulators (trajectory
// counts, question-relevant count, total) extended in place by the delta
// stream. `foldForWhom` folds one delta; `gateForWhom` is a PROJECTION
// over the folded state, never a recomputation over the whole reading.
// A for-whom that has read 10,000 encounters is gated from its folded
// counts, not by re-reading them.
//
// THE HYPERLEXICON IS THE SHARED FIELD: every for-whom reads from the
// same accumulated prior (the broader ground) and writes its reading
// back. Different for-whoms see different slices of it — an English-POS
// for-whom, a Russian-POS for-whom, a reduced-clause for-whom, a
// music-events for-whom — each with its own universe, each gated by
// whether its trajectory finds DMD.
//
//   node for-whom.mjs --for=english --ground=wp-work-prior-v4 <text>
//   node for-whom.mjs --for=russian --ground=wp-work-prior-v4 <text>
import { dmd } from "./dmd.js";

// A pure SHA-256 (FIPS 180-4) so this organ loads in a browser as well as in Node: it was `node:crypto`'s createHash and the output
// (first 16 hex chars of the digest) is byte-identical, so every for-whom id already minted still matches.
const K256 = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256hex(str) {
  const m = new TextEncoder().encode(str);
  const len = m.length, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(m); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000)); dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64), rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}
const sha = (s) => sha256hex(String(s ?? "")).slice(0, 16);

/** A for-whom: a configured instrument — a JURISDICTION, not a (who,
 * what) pair. The frame is the whole address of the reading (S42/S43:
 * a claim without a frame is a view from nowhere). Every field is a
 * coordinate of that frame:
 *   id         — the instrument's name (its being)
 *   giver      — FOR WHOM: the adjudicator whose authority it reads under
 *                (S113 — identity exists only for-whom)
 *   question   — FOR WHAT: the ask it must make a difference to
 *                (Bateson: a difference that makes a difference)
 *   priors     — UNDER WHAT: the received resources it stands on
 *   ground     — ON WHAT FIELD: the accumulated prior it leverages
 *                (the hyperlexicon — the broader ground)
 *   universe   — OF WHAT: the referents/relations it can hold
 *   medium     — THROUGH WHAT: the reader it uses (text/audio/image)
 *   knowing    — BY WHAT WAY: the way of knowing it trusts
 *                (THE-WAYS-OF-KNOWING: ostension, perturbation, prediction…)
 *   recipe     — AS WHAT ADDRESS: its identity (THE-ADDRESS A5)
 * Immutable. */
export function createForWhom({ id, giver = null, question = null, ground = null, priors = [], universe = [], medium = null, knowing = null, recipe = null } = {}) {
  if (!id) throw new TypeError("createForWhom: id is required — every instrument is named");
  if (!question) throw new TypeError("createForWhom: question is required — a for-whom reads FOR something, never from nowhere");
  return Object.freeze({
    schema: "EOForWhom@1",
    id,
    giver: giver ?? `for-whom:${id}`,        // for whom it reads (S113)
    question,                                 // for what it reads (Bateson)
    ground: ground ?? null,                   // the field it stands on
    priors: Object.freeze([...(priors ?? [])]), // under what
    universe: Object.freeze([...(universe ?? [])]), // of what
    medium: medium ?? "text",                 // through what
    knowing: knowing ?? "perturbation",       // by what way (default: the difference-maker)
    recipe: recipe ?? `for-whom:${sha(`${id}|${question}|${giver ?? ""}`)}`, // as what address (A5)
  });
}

/** encounterOrder(a, b) — READING order for encounter keys. Keys that end in a
 * byte address ("source#start-end") compare by source, then by START AS A
 * NUMBER; a string sort put "s#100-109" before "s#20-29" and scrambled the
 * discovery trajectory the coherence leg decomposes (measured 2026-09-28: a
 * true 1,2,3,4,5 read back as 1,2,4,3,5). Keys with no address fall back to
 * the string order they always had. */
const ADDR = /^(.*)#(\d+)-(\d+)$/;
function encounterOrder(a, b) {
  const x = ADDR.exec(a), y = ADDR.exec(b);
  if (x && y) return x[1] === y[1] ? Number(x[2]) - Number(y[2]) || Number(x[3]) - Number(y[3]) : x[1].localeCompare(y[1]);
  return a.localeCompare(b);
}

/** questionTerms(question) — the question's content terms: the beings and
 * acts it asks about. A for-whom is relevant only if its reading touches
 * these. Pure. */
export function questionTerms(question = "") {
  return Object.freeze(
    [...new Set(String(question).toLowerCase().match(/[\p{L}\p{N}’']{3,}/gu) ?? [])]
      .filter((w) => !["the", "a", "an", "and", "or", "of", "to", "in", "with", "was", "were", "is", "are", "what", "who", "how", "why", "did", "do", "does", "her", "his", "its", "their", "on", "at", "by", "for", "from"].includes(w)),
  );
}

/** createForWhomFold(forWhom) — the for-whom's FOLDED STATE (P159): running
 * accumulators extended in place by the delta stream, never recomputed.
 * The trajectory is kept as a per-encounter count map; the question-
 * relevance is a running count. The universe is folded, not rebuilt. */
export function createForWhomFold(forWhom) {
  return {
    schema: "EOForWhomFold@1",
    forWhomId: forWhom.id,
    // per-encounter structure counts (the discovery trajectory, as a map)
    byEncounter: new Map(),
    totalDiscovered: 0,
    relevantDiscovered: 0,
    qTerms: questionTerms(forWhom.question),
    encounters: 0,
  };
}

/** foldForWhom(fold, entry) — fold ONE entry into the for-whom's state in
 * place. The universe is extended, never recomputed. A structure-bearing
 * entry (edge/referent/mention) increments its encounter's count; if it
 * touches the question's terms, it increments the relevance count. This
 * is the P159 discipline: the fold owns its array, the consumer reads the
 * projection, and nothing re-scans the whole reading. */
export function foldForWhom(fold, entry) {
  const enc = entry?.encounterRef ?? "unknown";
  const isStructure = entry?.schema === "EOHyperedge@1" || entry?.schema === "EOReferent@1" || entry?.schema === "EOMention@1";
  if (!isStructure) return fold;
  fold.byEncounter.set(enc, (fold.byEncounter.get(enc) ?? 0) + 1);
  fold.totalDiscovered += 1;
  if (fold.qTerms.length) {
    const text = [entry?.relation, entry?.referent, entry?.canonicalSurface, ...(entry?.participants ?? []).map((p) => p?.surface ?? p?.ref)]
      .filter(Boolean).join(" ").toLowerCase();
    if (fold.qTerms.some((t) => text.includes(t))) fold.relevantDiscovered += 1;
  }
  fold.encounters += 1;
  return fold;
}

/** gateForWhomFold(fold, { nullDraws, nullSeed }) — a PROJECTION over the
 * folded state, never a recomputation: the discovery trajectory is read
 * from the running per-encounter map, the relevance from the running
 * count, and the DMD coherence from the folded trajectory. Nothing here
 * re-scans the entries the fold has already absorbed. */
export function gateForWhomFold(fold, { nullDraws = 40, nullSeed = 42, minDiscovered = 0, minRelevance = 0, minTrajectoryLength = 12 } = {}) {
  const trajectory = Object.freeze([...fold.byEncounter.entries()].sort((a, b) => encounterOrder(a[0], b[0])).map(([, n]) => n));
  const real = coherentMass(trajectory);
  const floor = trajectoryNull(trajectory, { draws: nullDraws, seed: nullSeed });
  const totalDiscovered = fold.totalDiscovered;
  const relevance = fold.qTerms.length && totalDiscovered ? fold.relevantDiscovered / totalDiscovered : 0; // nothing discovered is 0, never NaN
  // THE COHERENCE LEG NEEDS A REAL TRAJECTORY (2026-09-13, measured): a
  // rank-1 DMD on <12 points collapses real and null both to ~1.0 — the
  // leg is not evaluable, not "noise". Below the declared minimum, the
  // coherence leg is WITHHELD (a typed gap, never a false refusal); the
  // gate falls to the two legs that ARE evaluable (material + relevance).
  const evaluable = trajectory.length >= minTrajectoryLength;
  const coherent = evaluable ? real > floor : true; // withheld, not refused
  const material = totalDiscovered >= Math.max(1, minDiscovered); // a reading that found nothing never found the text (structural floor of 1; the caller may raise it)
  const relevant = fold.qTerms.length ? relevance >= minRelevance : true;
  const admitted = coherent && material && relevant;
  return Object.freeze({
    schema: "EOForWhomGate@1",
    forWhom: fold.forWhomId,
    real, floor, admitted,
    coherent,
    coherentEvaluable: evaluable,
    material,
    relevant,
    relevance,
    minRelevance,
    minDiscovered,
    trajectoryLength: trajectory.length,
    totalDiscovered,
    relevantDiscovered: fold.relevantDiscovered,
    decision: admitted
      ? "ADMITTED — coherent dynamics above the null, material discovery, AND the structure makes a difference to the question; this for-whom is relevant"
      : !material
        ? "REFUSED — coherent but nearly empty; the 'structure' is the empty field's own arithmetic, not the text's"
        : "REFUSED — discovers structure but NONE of it answers the question; a difference that makes no difference is not a finding",
  });
}

/** gateForWhom(forWhom, entries, opts) — fold every entry into a fresh
 * for-whom fold in ONE pass (transient — the fold owns its state), then
 * project. Kept for compatibility and small inputs; the streaming path is
 * `foldForWhom` per delta + `gateForWhomFold` at the moment. */
export function gateForWhom(forWhom, entries = [], opts = {}) {
  const fold = createForWhomFold(forWhom);
  for (const e of entries) foldForWhom(fold, e);
  return gateForWhomFold(fold, opts);
}

/** relevanceOf(entries, questionTerms) — how much of the for-whom's
 * reading touches the question: the share of discovered structure whose
 * referents/relations carry a question term. A for-whom that discovers a
 * lot but none of it about the question is irrelevant. */
export function relevanceOf(entries = [], qTerms = []) {
  if (!qTerms.length) return 0;
  let relevant = 0, total = 0;
  for (const e of entries) {
    if (e?.schema !== "EOHyperedge@1" && e?.schema !== "EOReferent@1" && e?.schema !== "EOMention@1") continue;
    total += 1;
    const text = [e?.relation, e?.referent, e?.canonicalSurface, ...(e?.participants ?? []).map((p) => p?.surface ?? p?.ref)]
      .filter(Boolean).join(" ").toLowerCase();
    if (qTerms.some((t) => text.includes(t))) relevant += 1;
  }
  return total ? relevant / total : 0;
}

/** discoveryTrajectory(entries) — the for-whom's reading as a series: new
 * referents + relations per encounter. This is the SIGNAL DMD decomposes:
 * a for-whom that finds structure has a trajectory with real dynamics; a
 * for-whom whose priors match nothing is flat. */
export function discoveryTrajectory(entries = []) {
  const byEnc = new Map();
  for (const e of entries) {
    const enc = e?.encounterRef ?? "unknown";
    if (!byEnc.has(enc)) byEnc.set(enc, 0);
    if (e?.schema === "EOHyperedge@1" || e?.schema === "EOReferent@1" || e?.schema === "EOMention@1") byEnc.set(enc, byEnc.get(enc) + 1);
  }
  return Object.freeze([...byEnc.entries()].sort((a, b) => encounterOrder(a[0], b[0])).map(([, n]) => n));
}

/** coherentMass(trajectory) — the Born-rule coherent mass of the
 * trajectory's dominant DMD mode: |λ|² of the largest mode. A trajectory
 * with real structure has a dominant mode; flat noise has none. Uses the
 * REAL dmd organ (kernel/dmd.js) — a trajectory as a 1-row state,
 * decomposed at rank 1, the single eigenvalue's magnitude squared. Same
 * mathematics the swarm uses; not an autocorrelation shortcut. */
export function coherentMass(trajectory = []) {
  const n = trajectory.length;
  if (n < 4) return 0;
  const X = trajectory.slice(0, -1).map((v) => [v]);
  const Xp = trajectory.slice(1).map((v) => [v]);
  const r = dmd(X, Xp, { rank: 1 });
  const lam = r.eigenvalues[0];
  if (!lam || !Number.isFinite(lam.magnitude)) return 0;
  return lam.magnitude * lam.magnitude;
}

/** trajectoryNull(trajectory, { draws, seed }) — the null: the same
 * trajectory's ORDER destroyed (shuffled), so any dynamics that survive
 * shuffling are not order-dependent signal. Declared draws + seed (the
 * null-arm's own discipline: a null drawn once is a null drawn zero
 * times). Returns the max coherent mass across the draws — the
 * false-positive floor for "this for-whom found DMD." */
export function trajectoryNull(trajectory = [], { draws = 40, seed = 42 } = {}) {
  let s = seed >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const masses = [];
  for (let d = 0; d < draws; d += 1) {
    const shuffled = [...trajectory];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    masses.push(coherentMass(shuffled));
  }
  masses.sort((a, b) => a - b);
  return masses[Math.max(0, Math.ceil(0.99 * masses.length) - 1)];
}
