/* Bukhari speaks:
 * “تابعهُ معاد وعبدٌ الصمدٍ عن شعبةً . وقال غندرٌ وعبدٌ الرحمن ١نهِي»‏ . وقال آدمُ : 'ثُهينا»”
 *
 * This file implements Bukhari's method of verification, which is essential to the rigor of the work.  The focus on independent chains of transmission is a critical part of how we approach authenticity, and that rigor should be upheld.  However, it's important to remember that this method is only one tool and should be used in conjunction with other forms of verification.
 *
 * — the engineering record below, kept whole —
 */
// reproduction.js — is this stretch of material reproduced in that material,
// and where. Medium-blind.
// Handle: Bukhari — after the isnad critics, who compared transmissions to see whether reports reached them independently or through one chain. Amendment XVII.
//
// WHAT THIS IS, AND WHY IT IS NOT `quotes.js`. `organs/quotes.js` already
// follows a quotation to the bytes and types it verbatim / drifted /
// unlocated. Its matching core — normalize both sides through ONE fold,
// search, map the hit back to real addresses, report whether the RAW units
// matched or only the folded ones — is not about quotations at all. It is
// the general question, and quotation marks are one text-specific, entirely
// optional SIGNAL that a reproduction is being CLAIMED.
//
// THE THIRD CASE, which is why this exists. Marks give two of three:
//
//   claimed + found   -> a real quotation            (quotes.js today)
//   claimed + absent  -> a fabricated quotation      (quotes.js today)
//   NOT claimed + found -> material repeated with nothing saying so
//
// The third has no representation anywhere in this instrument, and it is
// the one that decides how many INDEPENDENT voices a ledger is counting. A
// navigation template transcluded onto three pages, a wire report carried
// by four outlets, a paragraph lifted from one article into another: every
// one of them makes N sources look like N witnesses when they are one voice
// repeated. `sharedRuns` is that case, and it needs no threshold and no
// null, because it is an observation about units rather than a statistical
// claim about shape.
//
// WHAT IT NEVER SAYS. That a repeater is dishonest, that an origin is
// right, or which of two bodies came first — none of that is in the units,
// and inventing it here would be the preset this codebase refuses
// everywhere else. Reproduction is a fact about material. Whether a
// repeater used its origin FAITHFULLY IN CONTEXT is a different question
// this organ cannot reach: two bodies can share a run verbatim while the
// repeater's surrounding material makes it mean the opposite. Every result
// says so (`contextChecked: false`), and nothing here can set that true.
//
// AND THAT IS NOW A MEASURED REFUSAL, not only a design boundary — stated
// here because this is where a reader meets the table above and thinks of
// filling its unchecked cell. Checking whether a FOUND run is CLAIMED on
// each side was measured on 412 real runs and refused: the claimed-on-one-
// side cell holds 3, all of them titles (quoting as typographic convention,
// not attribution); the mutually-claimed cell is 2/14 precise, its 12 false
// members all reference-list scaffolding caught because a maximal run begins
// at the closing quote of an adjacent citation TITLE; telling those apart
// needs per-site formatting rules; and the fallback of comparing the two
// sides' extracted arrangements is already on record as flat
// (`organs/corroboration.js`'s header). The shape is not wrong — real mutual
// quotation of one origin is `organs/ranke.js`'s own input — encyclopedia
// articles just do not supply the specimens, because 366 of those 412 runs
// are machine-generated furniture neither body claims at all.
// Full account: `eval/the-fold/results/voices-RESULTS.md`; spec entry S50.
//
// MEDIUM-BLIND, and the fold is the caller's. `fold(material)` returns
// `{ norm, map }` — a normalized SEQUENCE (a string, or an array of
// symbols) plus `map[i]`, the index in the ORIGINAL material that produced
// normalized unit i. Text injects `quotes.js::normalizedIndex` (case,
// diacritics, typographic marks, whitespace). A score injects pitch-class
// normalization; an event stream its own canonicalization. Nothing in this
// file's body names a medium — `reproduction.test.js` reads this source and
// fails if one appears.

/** How a found reproduction matched: on the material's own units, or only under the fold. */
export const EXACT = "exact";
export const FOLDED = "folded";
/** Not found — a fact about this search over these bodies, never about the world. */
export const ABSENT = "absent";

/** Generic subsequence search: works on a string or an array of symbols alike. */
function indexOfSub(hay, needle, from = 0) {
  const n = needle.length;
  if (!n) return -1;
  for (let i = from; i + n <= hay.length; i++) {
    let k = 0;
    while (k < n && hay[i + k] === needle[k]) k++;
    if (k === n) return i;
  }
  return -1;
}

/**
 * makeReproduction({ fold, sameRaw }) — the organ.
 *
 * `fold(material)` -> `{ norm, map }`, above. REQUIRED: without it there is
 * no shared normalization, and comparing raw units alone would call every
 * ordinary re-typing of the same sentence a different sentence.
 *
 * `sameRaw(a, b)` -> boolean — whether two RAW stretches are the same at the
 * material's own grain, so `exact` can be told from `folded`. Optional; its
 * absence is a declared regime, not a silent default: without it nothing can
 * be typed `exact` and every hit reads `folded`, which is the honest reading
 * when the caller never said what sameness-of-units means for its medium.
 */
export function makeReproduction({ fold, sameRaw = null } = {}) {
  if (typeof fold !== "function")
    throw new TypeError("makeReproduction: fold is the caller's own — a normalized sequence plus a map back to the original's own coordinates (P5.2). There is no default normalization for an unnamed medium.");

  const prepare = (bodies) =>
    (bodies ?? [])
      .filter((b) => b && b.material != null)
      .map((b) => {
        const { norm, map } = fold(b.material);
        return { body: b, norm, map };
      });

  /**
   * The address a hit earns, in the ORIGINAL material's own coordinates,
   * offset by the body's own `start` when it is itself a slice of something
   * larger (a chunk of a page). P5.2: an address that cannot be read back is
   * not an address.
   */
  function addressOf(body, from, to) {
    const base = body.start ?? 0;
    return body.id != null ? `${body.id}#${base + from}-${base + to}` : null;
  }

  /** Assert a located span reads back as itself — never a drifting address. */
  function verify(body, from, to, expectedNorm) {
    const raw = body.material.slice(from, to);
    const back = fold(raw).norm;
    // CONTAINMENT, NOT EQUALITY, and the reason is the fold's own edges. A
    // fold that collapses or drops padding (text's whitespace, this event
    // stream's "-") cannot reproduce a padding unit sitting at a slice's
    // FIRST or LAST position: re-folding the slice trims it. That is the
    // fold behaving as declared, not an address drifting. A genuine drift
    // — a wrong offset — yields unrelated units, which containment in
    // neither direction can satisfy, so the check still catches the thing
    // it exists for.
    const same = indexOfSub(back, expectedNorm) !== -1 || indexOfSub(expectedNorm, back) !== -1;
    if (!same)
      throw new Error(`reproduction: a located span does not read back as itself (${addressOf(body, from, to)}) — the fold's own map drifted, and an address that cannot be re-read is not an address (P5.2)`);
  }

  /**
   * locate(needle, bodies) — is this stretch reproduced in any of these
   * bodies? The first body carrying it wins, in the caller's own order.
   * Returns the typed absence rather than null, so a caller can never
   * mistake "searched and not found" for "never searched".
   */
  function locate(needle, bodies) {
    const { norm: needleNorm } = fold(needle);
    return locateFolded(needleNorm, bodies, { raw: needle });
  }

  /**
   * locateFolded(needleNorm, bodies, { raw }) — the same search, for a
   * caller that has ALREADY folded its needle and must keep its own
   * needle-preparation.
   *
   * This exists because a caller's needle preparation can be legitimately
   * medium-specific in a way its bodies' is not: `organs/quotes.js` strips
   * punctuation from the EDGES of a folded quotation (a quotation's closing
   * period is routinely the quoting sentence's, not the source's) — a rule
   * about quotations, which has no business in this file, and which cannot
   * be expressed by folding raw material because the mark it strips only
   * exists after the fold. Rather than duplicate the search so that caller
   * can keep its rule, the search takes the folded needle.
   *
   * `raw`, when given, is the needle's own original units, used ONLY to
   * tell `exact` from `folded`. Without it nothing can be typed exact.
   */
  function locateFolded(needleNorm, bodies, { raw = null } = {}) {
    if (!needleNorm?.length) return { status: ABSENT, reason: "empty_after_fold", contextChecked: false };
    for (const { body, norm, map } of prepare(bodies)) {
      const at = indexOfSub(norm, needleNorm);
      if (at === -1) continue;
      const from = map[at];
      const to = map[at + needleNorm.length - 1] + 1;
      verify(body, from, to, needleNorm);
      const found = body.material.slice(from, to);
      const status = sameRaw && raw != null ? (sameRaw(found, raw) ? EXACT : FOLDED) : FOLDED;
      return { status, body: body.id ?? null, chunk: body.chunk ?? null, from, to, address: addressOf(body, from, to), raw: found, contextChecked: false };
    }
    return { status: ABSENT, reason: "not_in_these_bodies", contextChecked: false };
  }

  /**
   * sharedRuns(source, others, { minRun }) — every maximal stretch of
   * `source` that is also present in `others`. The UNCLAIMED direction: no
   * mark, no citation, no claim of any kind is required or looked for.
   *
   * `minRun` is DECLARED, never defaulted (P4/P9): how much shared material
   * is a reproduction rather than a coincidence is a fact about the medium
   * and the caller's material — five words of English is a clause, five
   * notes is a motif, five identical event symbols may be nothing at all.
   * This file has no basis to choose, so it refuses to.
   *
   * Greedy and maximal: each run is grown as far as it still occurs, then
   * the walk resumes past it, so one long shared passage is one finding
   * rather than a pile of overlapping fragments. Naive search — O(n*m) —
   * stated rather than hidden; the bodies this is asked about are pages and
   * passages, not corpora.
   */
  function sharedRuns(source, others, { minRun } = {}) {
    if (!Number.isInteger(minRun) || minRun < 1)
      throw new TypeError("sharedRuns: minRun is declared — how much shared material stops being coincidence is a property of the medium, never a constant this file picks");

    const { norm, map } = fold(source?.material ?? source);
    const prepared = prepare(others);

    // THE SEED INDEX, and why it changes nothing but the clock. Any run of
    // at least `minRun` units contains a minRun-length window at its own
    // first position, so indexing every minRun-window of each body and
    // extending only from real candidates finds exactly the runs the naive
    // scan finds. Measured before adding it: two 8k slices took 780ms and
    // grew quadratically — about five minutes for a pair of real pages,
    // which is the difference between an organ that can be pointed at
    // material and one that can only be pointed at fixtures.
    const keyAt = (seq, at) => {
      const w = seq.slice(at, at + minRun);
      return typeof seq === "string" ? w : w.join("\u0000");
    };
    for (const p of prepared) {
      p.seeds = new Map();
      for (let j = 0; j + minRun <= p.norm.length; j++) {
        const k = keyAt(p.norm, j);
        const at = p.seeds.get(k);
        if (at === undefined) p.seeds.set(k, [j]);
        else at.push(j);
      }
    }

    const runs = [];
    let i = 0;
    while (i + minRun <= norm.length) {
      const seed = keyAt(norm, i);
      let best = null;
      for (const { body, norm: hay, map: hayMap, seeds } of prepared) {
        for (const at of seeds.get(seed) ?? []) {
          let len = minRun;
          while (i + len < norm.length && at + len < hay.length && norm[i + len] === hay[at + len]) len++;
          if (!best || len > best.runLen) best = { body, hayMap, at, runLen: len };
        }
      }
      if (!best) { i++; continue; }

      const from = map[i];
      const to = map[i + best.runLen - 1] + 1;
      const srcBody = source?.material != null ? source : { material: source };
      verify(srcBody, from, to, norm.slice(i, i + best.runLen));
      const theirFrom = best.hayMap[best.at];
      const theirTo = best.hayMap[best.at + best.runLen - 1] + 1;
      runs.push({
        units: best.runLen,
        inSource: { from, to, address: addressOf(srcBody, from, to), raw: srcBody.material.slice(from, to) },
        alsoIn: {
          body: best.body.id ?? null,
          from: theirFrom,
          to: theirTo,
          address: addressOf(best.body, theirFrom, theirTo),
        },
        // Said on every finding, because it is the thing a reader would
        // otherwise assume: shared units are shared units. Whether the
        // repeater's surrounding material uses them faithfully is a
        // question this organ cannot reach.
        contextChecked: false,
      });
      i += best.runLen;
    }
    return runs;
  }

  return { locate, locateFolded, sharedRuns };
}
