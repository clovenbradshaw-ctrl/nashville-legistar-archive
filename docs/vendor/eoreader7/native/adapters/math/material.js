// adapters/math/material.js — a constructed mathematical object as MATERIAL.
//
// THE SLOT THIS FILLS. `adapters/` already holds text, audio, image, midi and
// video. Every one of them takes material that ALREADY EXISTS and addresses
// it: audio/material.js decodes real PCM and reduces it per frame; text does
// the same over bytes of prose. `kernel/notes.js` is deliberately blind to
// which — its own line: "A span is an ADDRESS (`at`) plus whatever the
// medium's adapter put there ... this file does not know what a span holds."
//
// WHAT IS DIFFERENT HERE, AND WHY IT IS STILL AN ADAPTER. A curve is not
// perceived, it is CONSTRUCTED (construction.js, INS·Pattern). But the moment
// it exists it is material like any other: it has canonical bytes, addressable
// parts, and facts about it that an instrument decides. So this adapter does
// exactly what the audio one does — turn material into addressed spans and
// arrangements — and the fact that the material was born rather than recorded
// changes nothing downstream. That is the whole claim of the medium-blind
// kernel, taken at its word.
//
// THE SPAN IS REAL. P5.2 says a vote must be re-openable at a byte address in
// the source's own bytes. A constructed curve's "source bytes" are its
// canonical serialization, and the spans here are genuine offsets into that
// exact string — `bytesOf(candidate)` is what the address indexes, so a
// reader holding a span can slice the material and see the coefficient or
// point the claim is about. Nothing here is a paraphrase of a curve.
//
// THE WITNESS IS NAMESPACED. notes.js owns the witness grammar
// (`kind:source#address~recipe`): the prefix declares HOW the witness was
// earned, so a vote earned one way is never confusable with another. A
// mechanical re-sighting is a bare `sighting`; a small model reading a slice
// is `testimony:`. A rank that a descent computation decided is `descent:` —
// its source is the engine and version, its recipe the function that ran. A
// descent vote and a testimony vote must never collapse into "two witnesses".

/** Canonical bytes for a candidate: stable key order, no incidental spacing. */
export function bytesOf(candidate) {
  const coeffs = (candidate?.coeffs ?? []).map(String);
  const forced = (candidate?.forced ?? []).map((p) => [String(p[0]), String(p[1])]);
  return `{"coeffs":[${coeffs.map((c) => `"${c}"`).join(",")}],"forced":[${forced.map(([x, y]) => `["${x}","${y}"]`).join(",")}]}`;
}

/** `at` shape shared with every other adapter: a byte range into the material. */
const at = (start, end) => `bytes:${start}-${end}`;

/**
 * spansOf(candidate) — real offsets into `bytesOf(candidate)`. Each part of
 * the material the reading will make claims about gets its own address:
 * the whole curve, each coefficient, each forced point.
 */
export function spansOf(candidate) {
  const src = bytesOf(candidate);
  const find = (needle, from = 0) => {
    const i = src.indexOf(needle, from);
    return i < 0 ? null : { at: at(i, i + needle.length), text: needle };
  };
  const coeffs = (candidate?.coeffs ?? []).map(String);
  const forced = (candidate?.forced ?? []).map((p) => [String(p[0]), String(p[1])]);
  let cursor = src.indexOf('"coeffs"');
  const coeffSpans = coeffs.map((c) => {
    const s = find(`"${c}"`, cursor);
    if (s) cursor = Number(s.at.split(":")[1].split("-")[1]);
    return s;
  });
  let pcursor = src.indexOf('"forced"');
  const forcedSpans = forced.map(([x, y]) => {
    const s = find(`["${x}","${y}"]`, pcursor);
    if (s) pcursor = Number(s.at.split(":")[1].split("-")[1]);
    return s;
  });
  return Object.freeze({
    whole: { at: at(0, src.length), text: src },
    coeffs: Object.freeze(coeffSpans),
    forced: Object.freeze(forcedSpans),
  });
}

/** The witness string a descent computation earns, in notes.js's own grammar. */
export const descentWitness = ({ engine, version, recipe = "ellrank", address = null }) =>
  `descent:${engine}-${version}${address ? `#${address}` : ""}~${recipe}`;

/** The witness a CONSTRUCTION earns — it made the object, it did not judge it. */
export const constructionWitness = ({ family, recipe = "forcePoints", address = null }) =>
  `construction:${family}${address ? `#${address}` : ""}~${recipe}`;

/**
 * arrangementsOf(candidate, verdict, { engine, version, family })
 * — the medium-neutral `{end1, label, end2, spans, witness}` shape
 * `kernel/notes.js::hear` admits, exactly as the text adapter produces it
 * from prose. Two KINDS of claim come out, and they are kept apart:
 *
 *   what the construction MADE — that these points lie on this curve. The
 *   construction witnesses this, because solving the linear system is what
 *   put them there; it is not an independent sighting and must not read as
 *   one.
 *
 *   what the instrument DECIDED — the rank. Only a descent witnesses this,
 *   and only when the descent PINNED it. A bounded-but-unpinned descent
 *   yields no rank arrangement at all: the gap is left open rather than
 *   filled with the lower bound.
 */
export function arrangementsOf(candidate, verdict, { engine = "pari", version = "unknown", family = "unnamed" } = {}) {
  const spans = spansOf(candidate);
  const name = curveName(candidate);
  const out = [];
  const cw = constructionWitness({ family, address: spans.whole.at });

  for (let i = 0; i < (candidate?.forced ?? []).length; i += 1) {
    const s = spans.forced[i];
    if (!s) continue;
    out.push({
      end1: name,
      label: "carries-point",
      end2: `(${candidate.forced[i][0]},${candidate.forced[i][1]})`,
      spans: [s],
      witness: constructionWitness({ family, address: s.at }),
    });
  }

  out.push({ end1: name, label: "was-composed-by", end2: family, spans: [spans.whole], witness: cw });

  if (verdict?.exact !== null && verdict?.exact !== undefined) {
    out.push({
      end1: name,
      label: "has-rank",
      end2: String(verdict.exact),
      spans: [spans.whole],
      witness: descentWitness({ engine, version, address: spans.whole.at }),
    });
  }
  return Object.freeze(out);
}

/** A stable, readable name for the curve — its coefficients, nothing derived. */
export const curveName = (candidate) => `curve[${(candidate?.coeffs ?? []).map(String).join(",")}]`;

/**
 * The inference a caller declares to organs/reasoning-lint.js so the rank
 * claim is CHECKED rather than trusted. `pari` is the engine expression
 * lib/pari-oracle.mjs dispatches on — the same shape pyodide-oracle's
 * `sympy`/`scipy`/`code` claims carry.
 */
export const rankClaim = (candidate, claimedRank) => Object.freeze({
  kind: "equation",
  end1: curveName(candidate),
  label: "has-rank",
  end2: String(claimedRank),
  statement: `rank(${curveName(candidate)}) = ${claimedRank}`,
  ref: curveName(candidate),
  spans: [spansOf(candidate).whole],
  // The forced points ride along as hints so the re-check's descent does not
  // have to rediscover what was built; the bounds it returns are still its own.
  pari: { coeffs: (candidate?.coeffs ?? []).map(String), rank: claimedRank, points: (candidate?.forced ?? []).map((p) => p.map(String)) },
});
