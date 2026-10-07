// clearance.js — NUL·Figure: does this figure clear its ground?
//
// P22 named this integration in its own disclosure the day the terminal
// language landed: "`distinguish`'s deeper refusal ('the figure doesn't
// clear it' — a real clearance over `cast`'s own referent set) remains the
// natural next integration, not faked here." This module is that
// integration, built against eoreader7's NATIVE text adapters (the organs
// this checkout can actually run) rather than the legacy engine the
// original sentence pointed at.
//
// THE QUESTION IT ANSWERS, and the one it refuses to conflate (P38): an
// index answering "does this figure EXIST in the material" (presence —
// cast.js's minSentences: 0 posture) is not an index answering "is this
// figure ESTABLISHED" (recurrence past the material's own derived floor,
// unambiguous referent identity, and — optionally, under declared numbers —
// anaphora actually binding to it). This module is the establishment
// re-gate over a presence set: a ladder of rungs, each with a TYPED refusal,
// so "cleared" is never one bit hiding four different questions.
//
// The rungs, bottom to top, and who owns each:
//   1. PRESENCE — extractSurfaces (the adapter's). Note the native adapter
//      already refuses purely sentence-initial capitalisation AT THIS RUNG:
//      accumulateSurfaceEvidence skips the sentence-initial token because
//      "it is capitalised by position and carries no evidence of namehood
//      on its own" — L2's discipline, closed at extraction. So a candidate
//      with no presence surface here includes exactly the
//      coincidental-capitalisation specimen the MHC battery's order-5 work
//      staged; this module does not re-implement that scan, it composes the
//      organ that already carries it and TYPES the refusal (`no_presence`).
//   2. ESTABLISHMENT — discoverReferents (the adapter's), at its own
//      DERIVED recurrence floor (deriveMinSentences: the 25th percentile of
//      this material's own candidates' sentence counts — a measured bar
//      from the material, never a constant typed here). A surface under the
//      floor is refused `below_recurrence_floor` with its own counts; the
//      floor itself is DISCLOSED BY MEASUREMENT (the bounds observed from
//      the organ's own behaviour), never re-derived here — re-deriving is
//      the drift class this repo's postmortems have caught twice.
//   3. AMBIGUITY — a bare form coreferring with more than one established
//      referent is WITHHELD as `ambiguous_surface` with its candidates
//      carried (the adapter's own typed gap: an ambiguous fragment is not a
//      third being, and which referent a mention names is an
//      occurrence-level question this type-level gate does not absorb).
//   4. PRONOUN BINDING (optional) — resolvePronouns, only when the organ is
//      injected AND minActivation/minMargin are DECLARED (the organ's own
//      wall: how much echo counts as real is a property of the reading,
//      never a default). A referent with at least one real binding stands
//      `bound`; the rung absent or undeclared is a TYPED SKIP
//      (`skipped_no_organ` / `skipped_undeclared`) — never a pass (P41: a
//      check that did not run must never report a pass).
//
// DISCLOSED ABSENCE, stated rather than implied closed: no constructed-null
// clearance exists for referent establishment. The floor here is the
// material's own derived recurrence bar — a measured threshold, not a
// perturbation arm. P29's search already found the nul registry carries no
// licensed text perturbation, and none is invented here; the kinds pair
// (testKindMembers, eoreader7) is where a declared membership DOES get a
// real null, because there the statistic and its perturbation exist.
//
// Organs are injected (the cast.js pattern), so this file stays pure and
// Node-testable against the real adapters by relative path.

export const CELL = Object.freeze({ op: "NUL", grain: "Figure" });

const defaultFold = (s) => String(s ?? "").toLowerCase().trim();

export function makeClearance({ splitSentences, extractSurfaces, discoverReferents, resolvePronouns = null, fold = defaultFold } = {}) {
  if (typeof splitSentences !== "function" || typeof extractSurfaces !== "function" || typeof discoverReferents !== "function") {
    throw new TypeError("makeClearance: splitSentences, extractSurfaces and discoverReferents are injected organs, all required");
  }

  /**
   * @param {object} [options.referents] DECLARED overrides forwarded
   *   verbatim to discoverReferents ({minSentences, minPartners}) — the
   *   adapter's own documented parameter surface, exactly what its own
   *   conformance tests declare at fixture scale (derived fences are
   *   book-scale statistics). Omit for the derived floors. Which was used
   *   is echoed on the result (`referentOptions.declared`), never silent.
   */
  function clearFigures(text, { pronouns = null, referents = null } = {}) {
    const sentences = splitSentences(String(text ?? ""));
    const presence = extractSurfaces(sentences);
    const result = {
      presence,
      established: [],
      refused: [],
      withheld: [],
      floorObserved: null,
      coreference: { merges: [], unresolvedMentionGaps: 0 },
      pronounRung: null,
      referentOptions: referents
        ? { declared: true, ...referents }
        : { declared: false, detail: "the material's own derived floors (deriveMinSentences / genericTokens' IQR fence)" },
    };
    if (!presence.length) {
      // The rung is ALWAYS typed — organ+numbers declared over empty
      // presence still RUNS (an empty referent map; the organ's own gaps
      // are the honest answer), never a null a consumer misreads as
      // not-skipped (the P41 hazard shape, caught by adversarial review).
      result.pronounRung = runPronounRung(resolvePronouns, pronouns, sentences, new Map()).rung;
      return result;
    }

    const { events, gaps, merges } = discoverReferents(presence, referents ?? {});
    result.coreference.merges = merges;

    const byReferent = new Map();
    const admittedSurfaces = new Set();
    for (const e of events) {
      if (!byReferent.has(e.referent_id)) byReferent.set(e.referent_id, []);
      byReferent.get(e.referent_id).push(e.surface);
      admittedSurfaces.add(e.surface);
    }

    const ambiguousSurfaces = new Set();
    for (const g of gaps) {
      if (g.reason === "ambiguous_surface") {
        ambiguousSurfaces.add(g.surface);
        result.withheld.push({ surface: g.surface, type: "ambiguous_surface", candidates: g.candidates });
      } else if (g.reason === "pronoun_and_descriptor_mentions_unresolved") {
        result.coreference.unresolvedMentionGaps += 1;
      }
    }

    // Rung 2's refusals, with the floor disclosed by measurement: the
    // derived floor sits in (refusedMaxSentences, admittedMinSentences] by
    // the organ's own `sentences <= floor` skip — bounds observed, never
    // re-derived.
    let admittedMin = Infinity;
    let refusedMax = -Infinity;
    const bySurface = new Map(presence.map((s) => [s.surface, s]));
    for (const s of presence) {
      if (admittedSurfaces.has(s.surface)) {
        admittedMin = Math.min(admittedMin, s.sentences);
      } else if (!ambiguousSurfaces.has(s.surface)) {
        refusedMax = Math.max(refusedMax, s.sentences);
        result.refused.push({
          surface: s.surface,
          type: "below_recurrence_floor",
          sentences: s.sentences,
          mentions: s.mentions,
          detail: referents
            ? "present in the material but at or below the caller's DECLARED recurrence floor — a figure that exists is not yet a figure that is established (P38)"
            : "present in the material but at or below its own derived recurrence floor — a figure that exists is not yet a figure that is established (P38)",
        });
      }
    }
    result.floorObserved = {
      admittedMinSentences: Number.isFinite(admittedMin) ? admittedMin : null,
      refusedMaxSentences: Number.isFinite(refusedMax) ? refusedMax : null,
    };

    // Rung 4 — optional, declared, typed skip otherwise; ONE implementation
    // for both the empty-presence and the ordinary path.
    const referentSurfaces = new Map();
    for (const e of events) referentSurfaces.set(e.surface, e.referent_id);
    const rung = runPronounRung(resolvePronouns, pronouns, sentences, referentSurfaces);
    result.pronounRung = rung.rung;
    const bindingsByReferent = rung.bindingsByReferent;

    for (const [referentId, surfaces] of byReferent) {
      const evidence = surfaces.map((surface) => {
        const s = bySurface.get(surface);
        return { surface, sentences: s?.sentences ?? null, mentions: s?.mentions ?? null };
      });
      const bindings = bindingsByReferent.get(referentId) ?? 0;
      result.established.push({
        referentId,
        surfaces,
        standing: bindings > 0 ? "bound" : "established",
        evidence,
        bindings,
      });
    }
    result.established.sort((a, b) => (a.referentId < b.referentId ? -1 : a.referentId > b.referentId ? 1 : 0));
    return result;
  }

  /**
   * One candidate's verdict. Matching is EXACT folded surface equality only
   * — variant resolution ("Vasquez" for "Elena Vasquez") is discoverReferents'
   * own clustering, one implementation of "the same name" (P11), never a
   * second matcher grown here.
   */
  function clearFigure(text, candidate, opts = {}) {
    const ledger = clearFigures(text, opts);
    const target = fold(candidate);
    for (const fig of ledger.established) {
      if (fig.surfaces.some((s) => fold(s) === target)) return { ...fig, ledger };
    }
    for (const w of ledger.withheld) {
      if (fold(w.surface) === target) return { refused: { ...w }, ledger };
    }
    for (const r of ledger.refused) {
      if (fold(r.surface) === target) return { refused: { ...r }, ledger };
    }
    return {
      refused: {
        type: "no_presence",
        candidate: String(candidate ?? ""),
        detail: "no orthographic evidence of namehood for this candidate in this material — note the presence rung itself already refuses purely sentence-initial capitalisation (the adapter skips position-capitalised tokens: the capitalisation there is the sentence's, not the name's — L2)",
      },
      ledger,
    };
  }

  return { clearFigures, clearFigure };
}

function runPronounRung(resolvePronouns, pronouns, sentences, referentSurfaces) {
  const skip = pronounSkip(resolvePronouns, pronouns);
  if (skip) return { rung: skip, bindingsByReferent: new Map() };
  const { bindings, gaps } = resolvePronouns(sentences, referentSurfaces, pronouns);
  const bindingsByReferent = new Map();
  for (const b of bindings) {
    const id = b.referentId ?? b.referent ?? b.referent_id;
    if (id) bindingsByReferent.set(id, (bindingsByReferent.get(id) ?? 0) + 1);
  }
  return { rung: { ran: true, bindings: bindings.length, gaps: gaps.length }, bindingsByReferent };
}

function pronounSkip(resolvePronouns, pronouns) {
  if (typeof resolvePronouns !== "function") {
    return {
      skipped: {
        reason: "skipped_no_organ",
        detail: "no pronoun-binding organ injected — this rung DID NOT RUN and is never counted as a pass (P41)",
      },
    };
  }
  if (!pronouns
    || !Number.isFinite(pronouns.minActivation) || pronouns.minActivation < 0
    || !Number.isFinite(pronouns.minMargin) || pronouns.minMargin < 0 || pronouns.minMargin > 1) {
    return {
      skipped: {
        reason: "skipped_undeclared",
        detail: "minActivation/minMargin are declared numbers (the organ's own wall: how much echo counts as real is a property of the reading) — no default is assumed here, and an undeclared rung DID NOT RUN",
      },
    };
  }
  return null;
}
