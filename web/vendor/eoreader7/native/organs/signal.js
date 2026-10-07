// signal.js — try things, find signal, and be refused when there is none.
// Handle: Platanista — after the blind river dolphin that hunts by echolocation alone: probe, listen; a clean nothing is itself a result. Amendment XVII.
//
// User direction (2026-09-01): "let's have this enter our DNA and be useable
// for anything, trying things to find signal." Four media went through the
// pipeline by hand — text, music, video, turbulence — and each hand-rolled
// the same five steps. This is that shape as one organ, with the two things
// the hand-rolled versions got wrong now structural rather than remembered.
//
// THE SHAPE (what the four runs actually did):
//   1. an INSTRUMENT turns material into a stream of events
//   2. kinds are DISCOVERED from the stream's own company (taught nothing)
//   3. a CONTROL BUILT TO FAIL destroys the company and must dissolve them
//   4. findings are counted by SOURCE and by INSTRUMENT, never conflated
//   5. what survives is reported; what does not is typed, never silent
//
// TWO HAZARDS, BOTH LEARNED BY BEING BITTEN, BOTH STRUCTURAL HERE:
//
// (a) THE SEARCH INFLATES. This organ's whole purpose — try many
//     instruments — is also the classic way to manufacture a finding: at
//     alpha 0.05, one instrument in twenty passes on noise. So the null is
//     SEARCH-AWARE by construction: the ceiling a share must beat is the
//     distribution of the MAXIMUM share across every instrument tried, not
//     each instrument's own. Trying more instruments therefore RAISES the
//     bar rather than lowering it, which is the only honest way to search.
//     A caller cannot opt out; there is no parameter for it.
//
// (b) TWO SOURCES THROUGH ONE INSTRUMENT ARE ONE READING. Measured live
//     (eval/omnimodal-pipeline.mjs): one pitch tracker's systematic artifact
//     landed identically in two performances and a false kind corroborated
//     at "2 distinct sources". Every finding here reports sources AND
//     instruments apart, and `corroborated` requires both >= 2.
//
//     SCOPE IS NOT RULE — the usage law, made visible by the spatial run
//     (eval/spatial-pipeline.mjs). Instrument independence needs
//     instruments that CAN SEE THE SAME THING. A row-major and a
//     column-major reading of one lattice are not two checks on a
//     west-to-east grammar: one of them is simply blind to it, and a
//     mirrored reading finds the mirror instead. So a directional finding
//     stays honestly "one instrument only" until a SAME-SCOPE,
//     DIFFERENT-RULE instrument exists — measured: adding a west-to-east
//     instrument that segments in 2-row bands (same scope, different
//     phrase rule) corroborated the true grammar while the mirrored
//     instrument correctly stayed at one. Turbulence's hole-vs-peak pair
//     was same-scope by luck; choose the pair on purpose.
//
// PURE, ORGANS INJECTED (the cast.js posture). It reads no engine of its
// own: `discoverCompanyKinds` arrives as an argument, so this module has no
// opinion about what a "kind" is beyond the contract, and a caller may
// substitute a different discovery organ entirely.
//
// MEDIUM-BLIND BY CONSTRUCTION: material is opaque — only the caller's
// instruments ever look inside it. Nothing here parses, tokenizes, folds
// case, or knows what a word is.
//
// A VIEW FROM SOMEWHERE (frame + mechanism identity). A finding is only a
// finding relative to the views that produced it, so two things ride every
// result: (1) an optional declared `frame` ({ id }) — stamped onto every
// finding and the result itself, so a verdict carries the ground it was
// computed on (frame.js); an unframed result carries `frame: null` and
// joins no cross-frame comparison. (2) MECHANISM identity, never recipe
// names: `corroborated` counts distinct MECHANISMS, not distinct recipe
// strings — two names for one decoder are one reading, caught here by
// construction rather than by the caller's honesty (see mechanismOf).

/** Every parameter this organ will not default. P4/P9: numbers are declared. */
export const REQUIRED = Object.freeze(["draws", "seed", "alpha", "minMentions", "minShare", "minMembers"]);

export const REFUSALS = Object.freeze({
  no_instruments: "no instruments were offered — an instrument is what turns material into events, and this organ never invents one",
  no_sources: "no sources were offered",
  undeclared: "every number is the caller's (P4)",
  no_events: "every instrument produced too few events on every source to have company at all",
  control_survived: "the control built to fail did not fail: kinds formed on material whose company was destroyed, so the statistic does not resolve the claim (II.23)",
});

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };

/**
 * mechanismOf(inst) — which decoder this instrument IS, as opposed to what
 * it is CALLED. An explicit non-empty `inst.mechanism` string always wins
 * (the caller confessing sameness across recipes, or distinctness across
 * shared code, is a statement this organ keeps verbatim). Otherwise the
 * fingerprint is the discretize function's own source text (FNV-1a, 8 hex
 * chars): two recipes running byte-identical code are one mechanism even
 * when their names differ — the sham-independence case, caught without
 * requiring the caller's honesty.
 *
 * Disclosed limit: this is exact-source identity, not semantic equivalence.
 * An alpha-renamed copy (`x=>x` vs `y=>y`) or a retyped equivalent escapes
 * it. What it closes is the cheap, common case — the same function
 * reference or the same source offered under two names.
 */
export function mechanismOf(inst) {
  if (inst && typeof inst.mechanism === "string" && inst.mechanism.length) return inst.mechanism;
  const src = String(inst?.discretize ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `fn:${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/** Destroy company, keep marginals: the one perturbation this organ spends. */
export function scramble(events, rnd) {
  return events.map((e) => {
    const w = String(e.text ?? e).split(/\s+/);
    for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
    return { text: w.join(" ") };
  });
}

/**
 * findSignal(sources, { instruments, vocabulary, discoverKinds, ...numbers })
 *
 * `sources`     [{ ref, material }]      — material is opaque to this organ
 * `instruments` [{ recipe, discretize, mechanism?, archon? }] — discretize
 *               (material) -> [{text}]. `recipe` is the display name;
 *               `mechanism` is an optional caller-declared identity of the
 *               decoder itself. Corroboration counts MECHANISMS (mechanismOf:
 *               explicit `mechanism` wins, else the discretize source
 *               fingerprint), so two recipes running one decoder never
 *               corroborate. `archon` is an optional handle off solon.js's
 *               register naming whose standpoint wields the instrument —
 *               carried onto every finding as `archons`, never counted
 *               toward corroboration (two archons running one mechanism are
 *               still one view).
 * `vocabulary`  the symbols worth asking about (the caller's declaration of
 *               what could possibly be an event kind — never inferred here,
 *               because inferring it from the data is a second search)
 * `discoverKinds` the discovery organ (kind-standing.js::discoverCompanyKinds)
 * `frame`       optional declared view ({ id }, frame.js::declareFrame) —
 *               stamped onto every finding and the result. Absent: the
 *               result carries `frame: null` (unframed, joins no comparison).
 *
 * Returns { findings, tried, searchCeiling, control, gaps, frame } — never
 * a bare list. A finding carries its sources, its instruments (recipes),
 * its mechanisms, its archons (attributed standpoints, possibly empty —
 * an unowned instrument still runs, and says so), its share, the
 * search-aware ceiling it had to beat, and the frame it was computed under.
 */
export async function findSignal(sources, {
  instruments, vocabulary, discoverKinds,
  draws, seed, alpha, minMentions, minShare, minMembers,
  clean = null, onProgress = null, frame = null,
} = {}) {
  if (typeof discoverKinds !== "function") throw new TypeError("findSignal: discoverKinds is injected — required, never defaulted");
  if (!Array.isArray(sources) || !sources.length) return { refused: "no_sources", detail: REFUSALS.no_sources, frame: frame?.id ?? null };
  if (!Array.isArray(instruments) || !instruments.length) return { refused: "no_instruments", detail: REFUSALS.no_instruments, frame: frame?.id ?? null };
  for (const k of REQUIRED) if (!Number.isFinite({ draws, seed, alpha, minMentions, minShare, minMembers }[k]))
    return { refused: "undeclared", what: k, detail: REFUSALS.undeclared, frame: frame?.id ?? null };
  const frameId = frame?.id ?? null;

  const floors = { minMentions, minShare, minMembers, ...(clean ? { clean } : {}) };
  const gaps = [];

  // 1. every (source, instrument) pair becomes a stream, once.
  // The stream carries recipe (display name), mechanism (what the decoder
  // is), and archon (whose standpoint wields it, possibly null) —
  // corroboration reads the mechanism, findings disclose all three.
  const archonOf = (inst) => (typeof inst?.archon === "string" && inst.archon.length ? inst.archon : null);
  const streams = [];
  for (const src of sources) for (const inst of instruments) {
    let events = [];
    try { events = inst.discretize(src.material) ?? []; }
    catch (err) { gaps.push({ type: "instrument_threw", ref: src.ref, recipe: inst.recipe, archon: archonOf(inst), detail: String(err?.message ?? err) }); continue; }
    if (!events.length) { gaps.push({ type: "no_events", ref: src.ref, recipe: inst.recipe, archon: archonOf(inst) }); continue; }
    streams.push({ ref: src.ref, recipe: inst.recipe, mechanism: mechanismOf(inst), archon: archonOf(inst), events });
    onProgress?.({ step: "discretized", ref: src.ref, recipe: inst.recipe, events: events.length });
  }
  if (!streams.length) return { refused: "no_events", detail: REFUSALS.no_events, gaps, frame: frameId };

  // 2. THE SEARCH-AWARE NULL, computed BEFORE anything is believed.
  // Per draw: scramble every stream, discover the best share each word
  // reaches ANYWHERE in the search, and keep that maximum. The ceiling is
  // the (1-alpha) quantile of those maxima — so a finding must beat not
  // "what chance does here" but "the best chance does anywhere I looked".
  const rnd = lcg(seed);
  const maxima = [];
  for (let d = 0; d < draws; d++) {
    let best = 0;
    for (const st of streams) {
      const kinds = discoverKinds(scramble(st.events, rnd), vocabulary, { ...floors, minShare: 0 });
      for (const k of kinds) for (const share of k.share.values()) if (share > best) best = share;
    }
    maxima.push(best);
    if (d % 25 === 0) onProgress?.({ step: "null", draw: d, of: draws });
  }
  maxima.sort((a, b) => a - b);
  const idx = Math.min(maxima.length - 1, Math.max(0, Math.ceil((1 - alpha) * maxima.length) - 1));
  const searchCeiling = maxima[idx];

  // 3. the observed search, same organ, same floors.
  const observed = new Map(); // `${word}|${signature}` -> {shares, refs, recipes, mechanisms, archons}
  for (const st of streams) {
    for (const kind of discoverKinds(st.events, vocabulary, floors)) {
      for (const [word, share] of kind.share) {
        const key = `${word}|${kind.signature}`;
        if (!observed.has(key)) observed.set(key, { word, signature: kind.signature, shares: [], refs: new Set(), recipes: new Set(), mechanisms: new Set(), archons: new Set() });
        const rec = observed.get(key);
        rec.shares.push(share);
        rec.refs.add(st.ref);
        rec.recipes.add(st.recipe);
        rec.mechanisms.add(st.mechanism);
        if (st.archon) rec.archons.add(st.archon);
      }
    }
  }

  // 4. THE CONTROL BUILT TO FAIL, reported whatever it says. It is the same
  // scramble the null spends, run once at the shipped floors: if kinds form
  // on scrambled company, this search decided nothing and says so.
  const controlRnd = lcg(seed ^ 0x5eed);
  let controlSurvivors = 0;
  for (const st of streams) {
    for (const kind of discoverKinds(scramble(st.events, controlRnd), vocabulary, floors))
      for (const share of kind.share.values()) if (share > searchCeiling) controlSurvivors += 1;
  }

  // 5. what beat the search-aware ceiling, with both counts kept apart.
  // Corroboration counts MECHANISMS, never recipe names: two recipes
  // running one decoder are one instrument, and say so in the note.
  const findings = [];
  for (const rec of observed.values()) {
    const share = Math.max(...rec.shares);
    if (!(share > searchCeiling)) continue;
    const mechN = rec.mechanisms.size;
    const sham = rec.recipes.size > mechN;
    findings.push({
      subject: rec.word,
      kind: `kind:${rec.signature}`,
      share,
      searchCeiling,
      sources: [...rec.refs],
      instruments: [...rec.recipes],
      mechanisms: [...rec.mechanisms],
      archons: [...rec.archons],
      frame: frameId,
      corroborated: rec.refs.size >= 2 && mechN >= 2,
      note: rec.refs.size < 2 ? "one source only" : mechN < 2 ? `one instrument only — a systematic error of that instrument is invisible here${sham ? ` (${rec.recipes.size} recipes, one mechanism)` : ""}` : null,
    });
  }
  findings.sort((a, b) => b.share - a.share || a.subject.localeCompare(b.subject));

  const control = { survivors: controlSurvivors, passed: controlSurvivors === 0 };
  if (!control.passed) return { refused: "control_survived", detail: REFUSALS.control_survived, control, searchCeiling, tried: streams.length, gaps, frame: frameId };
  return { findings, tried: streams.length, instrumentsTried: instruments.length, sourcesTried: sources.length, searchCeiling, control, gaps, frame: frameId };
}

/** A one-line honest reading of a result — counts and limits, never a verdict. */
export function phrase(result) {
  if (result.refused) return `refused: ${result.refused} — ${result.detail}`;
  if (!result.findings.length)
    return `nothing beat the search-aware ceiling (${result.searchCeiling.toFixed(3)}) across ${result.tried} stream(s) from ${result.sourcesTried} source(s) × ${result.instrumentsTried} instrument(s). The control passed, so this is a measured absence, not a failure to look.`;
  const corr = result.findings.filter((f) => f.corroborated).length;
  const who = [...new Set(result.findings.flatMap((f) => f.archons ?? []))].sort();
  const unattributed = result.findings.filter((f) => !(f.archons ?? []).length).length;
  return `${result.findings.length} finding(s) beat the search-aware ceiling ${result.searchCeiling.toFixed(3)}; ${corr} corroborated by ≥2 sources AND ≥2 mechanisms, ${result.findings.length - corr} standing on one source or one mechanism.` +
    (who.length ? ` Attributed standpoints: ${who.join(", ")}.` : ` No standpoint attributed.`) +
    (unattributed ? ` ${unattributed} finding(s) from unowned instruments.` : ``);
}
