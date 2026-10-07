// native/kernel/rng.js — deterministic pseudorandomness, in one place.
//
// Found duplicated, not designed duplicated: `kernel/contest.js` and
// `kernel/entity-kind-induction.js` each independently grew their own
// seeded generator for the same job — drawing a null distribution for a
// permutation test — because each was built in isolation and neither
// searched for the other first (the exact failure this repo's own history
// keeps naming: "search for the organ before you write one"). Two
// generators is not two designs, it is one need met twice, and it is
// precisely the shape that lets a real fix land in one copy and not the
// other (the DEF/EVA `Array.find` incident, the `synthesize` substring
// incident — this repo's own postmortems for what duplication like this
// costs when it drifts).
//
// TWO GENERATORS ARE KEPT, ON PURPOSE, RATHER THAN COLLAPSED TO ONE.
// `lcg` takes a bare numeric seed and is what `contest.js`'s measured,
// cited figures (its own header: "Borodino 0.028 real -> 0.053 shuffled")
// were produced with. `createSeededRng` takes ANY value — a compound key
// like `{ population, memberIds, purpose }` — because
// `entity-kind-induction.js` needs to seed independently per purpose
// without the caller hand-deriving an integer first. Forcing these to the
// same algorithm would silently move both files' already-measured,
// already-cited numbers with no scientific reason for either to change —
// exactly the "regression from an unrelated change" this repo's own rules
// warn against. What moved here is WHERE each is defined, not what either
// computes: every function below is relocated verbatim from its original
// file, so this refactor changes zero test outcomes anywhere it is
// consumed. Unifying the two algorithms is a real, separate, unattempted
// question — it needs its own measured justification, not a merge done
// because two functions happened to sit in the same new file.
//
// `stableHash` and `seedFrom` share one hash loop (FNV-1a, 32-bit) for two
// different jobs: `stableHash` makes a stable STRING IDENTIFIER (an id
// suffix), `seedFrom` makes a stable NUMERIC SEED (RNG state) — the two
// uses were previously two copies of the identical loop inside
// `entity-kind-induction.js` alone; `fnv1a` is now the one implementation
// both read from.

const fnv1a = (text) => {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** A stable, short string identifier derived from arbitrary text — never a seed. */
export const stableHash = (value) => fnv1a(String(value)).toString(36);

// Canonical (key-sorted) JSON-shaped text for any value, so seedFrom is
// insensitive to object key order — the same value seeds the same run
// however its caller happened to construct it.
const stableValue = (value) => {
  if (value === undefined) return "true";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
};

/** Any value (a number, a string, a compound key object) -> a 32-bit RNG seed. */
export function seedFrom(value) {
  return fnv1a(stableValue(value)) || 1;
}

/**
 * xorshift32, seeded via seedFrom so the caller may pass any value, not
 * only a pre-derived integer. Used where a run is seeded per-purpose from
 * a compound key (population + members + why).
 */
export function createSeededRng(seedValue) {
  let state = seedFrom(seedValue);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/** Deterministic LCG; the seed is declared so a run can be reproduced. */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Fisher-Yates, in place on a copy — never mutates `values`. */
export function shuffled(values, rng) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
