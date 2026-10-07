// organs/run-dmca.js — RUN DMCA (named by the user): the reproduction check.
//
// Handle: YadaYadaYada — the archon of paraphrase (Amendment XVII; registered
// 2026-09-16). The whole omnilingual paraphrase system — this organ's shadow
// chase and record equate, the witness's read, the Rosetta projection —
// reports to ONE owner; the compendium entry and README Handle table carry
// it, and every paraphrase chase credits it (the compendium's "always
// credited in a response" rule).
//
// PARAPHRASE AND MEANING (user, 2026-09-14): "something is a paraphrase if it
// isn't character identical but the holograph equates to the same thing. and
// you do have to chase meaning." AND: "I don't think any model should be
// evaluating paraphrasing." AND: "meaning always has a for whom, even if that
// whom is the empty hub of the ethos at that fold."
//   - the verbatim instrument (the shuffle-null below) is CHARACTER identity;
//   - the holograph equates when, after a MEANING chase, a write span is the
//     same claim in other words — the same referent-bound relation the
//     SOURCE's reading already projected;
//   - the chase is MODEL-FREE. The equating instrument is the RECORD's own
//     projection: the fold's claims ({label, end2, end1} at referent
//     identity — the same rows materialPropositions holds and LaVar grades
//     on). A write span is grounded-by-meaning FOR whom iff it resolves to
//     one of those rows (label + both ends, through the referent index when
//     one is injected). No model is ever asked whether two passages are the
//     same thing; the record either carries the row or it does not.
//   - meaning is stanced: the equate is performed FOR the ethos at THIS fold
//     (a face), and even the empty hub is a named standpoint, never an
//     omitted one. The report names the whom it equated for.
//   - the chase is performed in two named tiers:
//     1. THE SHADOW (cheap, offline, canonical): paraphraseCandidatesFor —
//        the write span's own claim-vocabulary is probed against the
//        sources' sentences (endsFor + statingCandidates, the SAME meaning
//        organs the sentence witness spends). A candidate is "the source's
//        own bytes carry this span's claim in other words — the record may
//        hold it." This converts the old silent "UNMEASURED" flag into a
//        MEASUREMENT with a number and a face.
//     2. THE RECORD (chaseParaphrase — model-free, stanced): the candidate
//        spans are equated against the fold's own claim rows, FOR the
//        declared whom. An equated span is PROOF of grounding, reclassified
//        from invent-leaning to Derive — by row identity, never by a model's
//        say-so. A span no row resolves is NAMED and disclosed as
//        un-equatable FOR this whom: never laundered, never silent.
//   The engine's measured law stands behind this door (corroboration.js):
//   every mechanical identity tried against the paraphrase wall measured
//   FLAT — so row-identity is STRICT by law: a genuinely-reworded claim that
//   no longer lands on a record row does not move, and the chase discloses
//   exactly that. The shadow names the wall's address; the record equates
//   only what it itself holds.
import { cellOf } from "./creativity-table.js";
import { splitSentences } from "../adapters/text/spans.js";
import { statingCandidates } from "./corroboration.js";
import { endsFor } from "./witness-sentences.js";

/** The owner of the paraphrase domain — registered in the compendium and the README Handle table; every paraphrase chase credits it. */
export const PARAPHRASE = Object.freeze({
  name: "Yada Yada Yada",
  handle: "yadayadayada",
  after: "the idiom 'yada yada yada' — the compressed restatement that skips the verbatim without changing what was meant",
  recipe: "paraphrase-v1",
});

// The question: did the mouth COMPOSE, or did it REPRODUCE a source's words?
// Reproducing FOR QUOTATION (explicitly cited) is legitimate; reproducing
// WITHOUT a citation is a DMCA violation — copy, not composition.
//
// The parse is three-way:
//   quoted   — a reproduced span that carries an explicit citation
//   copied   — a reproduced span with NO citation (the violation)
//   composed — the mouth's own prose (inspired, not reproduced)
//
// THE BOUNDARY between "inspired" and "reproduced" must come out of DMD+Born
// (born-dmd-rosetta.mjs's own question — "can the boundary come OUT of DMD +
// Born, instead of a hand-set overlap threshold?"), never a hand-set n-gram.
// Until that measurement lands, `n` is a named constant whose derivation is
// DISCLOSED as a gap, not a measurement — the same discipline that refuses to
// pass a magic number off as a measured one.
//
// Archons: a task BETWEEN Alexander and Ranke — not owned by one.
//   Alexander (SYN) owns the obligation: a synthesis must COMPOSE a new
//     pattern, never clone one. A copy is a failed synthesis.
//   Ranke owns the check: the source's words stay the source's — "wie es
//     eigentlich gewesen" — grounded is grounded, invention is invention.
// runDMCA is the seam where the two meet: did SYN actually synthesize, or did
// it cross into reproducing Ranke's sources? The citation ledger's split and
// the DMD+Born reproduction boundary are the instruments of that seam.
// Marshall upholds the law the seam enforces.
// 2026-09-16 (the unification): the seam's CELLS still adjudicate as
// Alexander's (Pattern×Structure) and Ranke's (the reproduction boundary),
// but the DOMAIN now has one owner — YadaYadaYada (`yadayadayada`) — and
// every paraphrase chase credits it by name. The owner is registered in the
// compendium and the README Handle table; the two cell archons stay the
// instruments the seam actually adjudicates with.

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();

const shinglesOf = (text, n) => {
  const words = norm(text).split(" ");
  const out = new Set();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return { words, out };
};

// THE NULL (Diaconis's discipline, Ranke's boundary): a run is REPRODUCTION
// only if it SURVIVES shuffling the source's words — i.e. it is SPECIFIC to
// the source's order, not a common-phrase overlap that any lighthouse prose
// shares by chance. The hand-set n=6 was measured to flag 175 "copied" runs
// where the citation ledger found 11 verbatim sentences; the shuffle-null
// destroys common-phrase coincidences, so only genuine order-specific
// reproduction crosses the boundary. A deterministic seed keeps it
// reproducible — the null is rebuilt, never a magic number.
function shuffleWords(text, seed = 7) {
  const words = norm(text).split(" ");
  let s = seed >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.join(" ");
}

export function runDMCA({ text = "", sources = new Map(), citations = [], n = 6, nullSeed = 7 } = {}) {
  const t = norm(text);
  if (t.split(" ").length < n) return { ok: true, derivation: 0, quoted: 0, copied: 0, paraphraseUnmeasured: false, boundary: `shuffle-null (n=${n})`, basis: "too short to measure — derivation unknown" };
  // REAL source shingles, and the NULL (shuffled) source shingles.
  const sourceShingles = new Set();
  const nullShingles = new Set();
  for (const s of sources.values()) {
    for (const sh of shinglesOf(s, n).out) sourceShingles.add(sh);
    for (const sh of shinglesOf(shuffleWords(s, nullSeed), n).out) nullShingles.add(sh);
  }

  // the cited (quoted) spans — only grounded entries, never `unsupported`.
  const citedShingles = new Set();
  for (const c of citations ?? []) {
    if (c?.source == null || c?.kind === "unsupported") continue;
    for (const sh of shinglesOf(c?.essaySentence ?? "", n).out) citedShingles.add(sh);
  }

  // THE SPECTRUM: a run counts as DERIVED when it is order-specific to a
  // source (survives the shuffle-null). `derivation` is the write's POSITION
  // on the spectrum — 0 = independent, 1 = fully reproduced. Plagiarism is a
  // REGION (low distance × uncited), not a flag: quoted = derived but owned,
  // copied = derived and unowned, and the rest of the write sits further out
  // toward inspiration (unmeasured by this verbatim instrument).
  const writeShingles = [...shinglesOf(text, n).out];
  let quoted = 0, copied = 0, derived = 0;
  const seen = new Set();
  for (const sh of writeShingles) {
    if (!sourceShingles.has(sh)) continue;       // not in any source
    if (nullShingles.has(sh)) continue;           // common phrase, not order-specific
    if (seen.has(sh)) continue; seen.add(sh);
    derived++;
    if (citedShingles.has(sh)) quoted++; else copied++;
  }
  const derivation = writeShingles.length ? derived / writeShingles.length : 0;

  // PARAPHRASE IS THE UNMEASURED TAIL: when sources exist and the write is
  // long enough to be copyable but NO order-specific reproduction was found,
  // the prose may still be a grounded-and-reworded paraphrase that the
  // verbatim instrument cannot see. Flag it — never let silence read as
  // "proven invented".
  const paraphraseUnmeasured = derived === 0 && sourceShingles.size > 0;

  return {
    ok: copied === 0,
    derivation,
    quoted,
    copied,
    paraphraseUnmeasured,
    boundary: `shuffle-null (n=${n}; the run must survive the source's words being scrambled) — the verbatim end of the derivation spectrum`,
    basis: copied
      ? `derivation ${(derivation * 100).toFixed(0)}% — ${quoted} run(s) cited (quotation), ${copied} uncited (copy): plagiarism is this region of the spectrum`
      : quoted
        ? `derivation ${(derivation * 100).toFixed(0)}% — all ${quoted} reproduced run(s) cited (quotation, not copy)`
        : `derivation ${(derivation * 100).toFixed(0)}% — ${paraphraseUnmeasured ? "no order-specific reproduction detected. WARNING: paraphrase is UNMEASURED by this verbatim instrument — silence here reads as 'invented' but may be grounded-and-reworded company the instrument cannot see." : "no order-specific reproduction; the prose sits toward the inspired end"}`,
  };
}

/**
 * THE SHADOW CHASE (tier 1 — cheap, offline, canonical). For every write span
 * the VERBATIM instrument did NOT settle (no order-specific reproduction, not
 * a cited-verbatim sentence), probe whether the sources' own sentences carry
 * the span's claim vocabulary: endsFor (the same presence-anchored end the
 * sentence witness derives) + statingCandidates (the same shared-vocabulary
 * gate the witness uses to propose what the source "may state in other
 * words"). A HIT is a paraphrase CANDIDATE — never a verdict: it means the
 * source demonstrably holds sentences whose vocabulary meets this span's
 * claim ends, so "the holograph may equate" and the verbatim silence is a
 * matter for the witness (tier 2), not proof of invention.
 *
 * P9 discipline: `maxSpans` is DECLARED by the caller — it is the ask budget
 * the caller will spend on the witness for exactly these spans.
 */
export function paraphraseCandidatesFor({ text = "", sources = new Map(), citations = [], maxSpans = null } = {}) {
  if (!maxSpans || !Number.isFinite(maxSpans)) throw new TypeError("paraphraseCandidatesFor: maxSpans is declared by the caller (P9)");
  const sourceText = [...sources.values()].map((s) => String(s ?? "")).filter((t) => t.trim().length).join("\n\n");
  const write = String(text ?? "");
  if (!sourceText.trim() || !write.trim()) return { spans: [], sourceText };
  // spans the verbatim instrument already settled (cited verbatim) are never
  // paraphrase fodder — they are character identity, not reworded meaning.
  const settled = new Set();
  for (const c of citations ?? []) if (c?.kind === "verbatim" && c?.essaySentence) settled.add(norm(c.essaySentence));
  const sentences = [];
  try {
    for (const s of splitSentences(write)) {
      if (typeof s === "string") sentences.push(s);
      else if (s?.text) sentences.push(s.text);
    }
  } catch { /* unsegmentable — nothing to chase */ }
  const spans = [];
  for (const sentence of sentences) {
    const shown = String(sentence ?? "").trim();
    if (shown.length < 12 || shown.length > 400) continue;
    if (settled.has(norm(shown))) continue;
    let ends = null;
    try { ends = endsFor(shown, [], sourceText, splitSentences); } catch { continue; }
    if (!ends?.end1 || !ends?.end2) continue;
    let stating = [];
    try { stating = statingCandidates(sourceText, ends, { splitSentences, limit: 3 }); } catch { continue; }
    if (!stating.length) continue;
    spans.push({
      span: shown,
      ends: { end1: ends.end1, end2: ends.end2, from: ends.from ?? "longest-words" },
      candidates: stating.map((cand) => ({ shown: cand.shown, start: cand.start, end: cand.end, density: cand.density })),
    });
    if (spans.length >= maxSpans) break;
  }
  return { spans, sourceText };
}

/**
 * CATEGORIZE where each span came from, against the periodic table of
 * creativity. Provenance decides the cell:
 *   Reproduce — verbatim (order-specific), split quoted (cited) vs copied (not)
 *   Derive    — grounded but reworded (the citation ledger's `company`)
 *   Invent    — the model's own (the citation ledger's `unsupported`)
 *
 * The cell is the ARTIFACT'S position on the 27-cell table: grain×phase are
 * the shape the artifact actually is (a finished essay is a Pattern at
 * Structure; a draft is an essay at Formation; declare them when known —
 * DEFAULT is the completed artifact), and derivation is read off provenance.
 * The 27 cells / 9 archons live in creativity-table.js; this function routes
 * through it (artifactCell), never a parallel hardcode.
 *
 * DISCLOSURE, not false precision:
 *   - `derivation` is a CATEGORY (the worst-case bucket: any order-specific
 *     reproduction present ⇒ Reproduce) — it is a risk label, not a share.
 *     The numeric share is `derivationRatio`, and the n-shape of that ratio
 *     is `derivationWindow` (min..max across neighboring n), so the magic
 *     constant's grip on the answer is visible, not hidden behind one number.
 *   - `reproduce` counts unique order-specific 6-gram RUNS (dedup — a copy
 *     reused N× reads once); `derive`/`invent` count citation-ledger SENTENCE
 *     rows. Different rulers: the returns carry `units` so nobody adds them.
 *   - when the verbatim instrument is silent (ratio ≈ 0) but sources exist,
 *     `paraphraseUnmeasured` is true — a paraphrase evades quietly and would
 *     otherwise read as "invented" when it is really grounded-and-reworded.
 *   - when the TWO instruments disagree (runDMCA sees order-specific runs the
 *     ledger calls company, or vice versa), `disagreement` is true — the same
 *     bytes are never one bucket across both rulers, and the report says so.
 */
export function categorizeCreativity({ text = "", sources = new Map(), citations = [], n = 6, grain = "Pattern", phase = "Structure" } = {}) {
  const dmca = runDMCA({ text, sources, citations, n });
  const ledger = {
    verbatim: (citations ?? []).filter((c) => c?.kind === "verbatim").length,
    company: (citations ?? []).filter((c) => c?.kind === "company").length,
    unsupported: (citations ?? []).filter((c) => c?.kind === "unsupported").length,
  };
  const derivation = (dmca.quoted + dmca.copied) > 0 ? "Reproduce" : ledger.company > 0 ? "Derive" : "Invent";

  // THE SHADOW CHASE runs when the verbatim instrument is silent: how many
  // spans share claim-vocabulary with the sources' own sentences? A number
  // and a face, instead of the old silent "UNMEASURED" flag.
  const probe = dmca.paraphraseUnmeasured
    ? paraphraseCandidatesFor({ text, sources, citations, maxSpans: 6 })
    : { spans: [], sourceText: "" };

  // The n-shape: the ratio measured at the boundary constant and at one step
  // either side of it, so the magic number's grip is on the surface.
  const window = [Math.max(4, n - 1), n, n + 1].map((k) => runDMCA({ text, sources, citations, n: k }).derivation);
  const denominator = text.trim().split(/\s+/).filter(Boolean).length;
  const sentenceRows = (citations ?? []).filter((c) => c?.essaySentence).length;

  const paraphraseBasis = dmca.paraphraseUnmeasured
    ? probe.spans.length
      ? `Shadow chase found ${probe.spans.length} span(s) whose claim-vocabulary the sources' own sentences carry — the verbatim instrument cannot equate them, the WITNESS is the licensed door (chaseParaphrase). The sound spans share a surface with these source sentences: ${probe.spans.slice(0, 2).map((s) => `"${s.candidates[0]?.shown?.slice(0, 60) ?? ""}"`).join("; ")}. The paraphrase archon (YadaYadaYada) owns this chase.`
      : `Shadow chase found NO claim-vocabulary tangent in the sources — a paraphrase beyond the received vocabulary (synonymy the engine has not earned) is outside every engine organ, said so, never papered over. The paraphrase archon (YadaYadaYada) owns this chase.`
    : null;

  const derivedWindow = { n, min: Math.min(...window), max: Math.max(...window) };
  const disagreement = (dmca.quoted + dmca.copied) > 0 && ledger.company > 0;
  // THE FIELD/ECHO PROJECTION (consolidation.js::projectField): a note is in
  // the FIELD when it STANDS — here the winner-take-all label is the standing
  // category, the thing the next read primes on. Below it, still ON the
  // record, is the ECHO: the numeric share, its n-window, and whether the two
  // instruments disagreed — real, preserved, but below standing.
  const projectionBasis = ` Field/echo projection: ${derivation} STANDS as the field (the category the next read primes on); below the field, still on the record, the echo is ratio=${(dmca.derivation * 100).toFixed(1)}%, window=${derivedWindow.min.toFixed(2)}…${derivedWindow.max.toFixed(2)}@n=${derivedWindow.n}, instruments-agree=${!disagreement}.`;

  return {
    reproduce: { quoted: dmca.quoted, copied: dmca.copied },
    derive: ledger.company,
    invent: ledger.unsupported,
    // the two rulers, named:
    units: {
      reproduce: "unique order-specific 6-gram runs (dedup — a copy reused N× reads once)",
      derive: "citation-ledger sentence rows (per-sentence attribution)",
      invent: "citation-ledger sentence rows (per-sentence attribution)",
    },
    // the CATEGORY (risk label) AND the numeric position it hides:
    derivation,
    field: derivation,
    derivationRatio: dmca.derivation,
    derivationWindow: derivedWindow,
    echo: { ratio: dmca.derivation, window: derivedWindow, disagreement },
    // paraphrase: the verbatim instrument is silent, the SHADOW chase names
    // the candidate spans (the witness — the meaning chase itself — is
    // injected by the caller as chaseParaphrase, never silent here):
    paraphraseUnmeasured: dmca.paraphraseUnmeasured,
    paraphraseCandidates: probe.spans.length,
    paraphraseSurfaces: probe.spans.slice(0, 3).map((s) => ({ span: s.span.slice(0, 160), ends: s.ends, source: s.candidates[0]?.shown?.slice(0, 160) ?? null })),
    // the two instruments disagree on the same bytes:
    disagreement,
    cell: cellOf({ grain, phase, derivation }),
    basis: `${paraphraseBasis ?? dmca.basis}${projectionBasis}`,
    spans: denominator,
    spanUnit: "words",
    rows: sentenceRows,
  };
}

/**
 * THE MEANING CHASE (tier 2 — the RECORD equates, never a model; stanced).
 *
 * The user's law (2026-09-14): no model evaluates paraphrasing, and meaning
 * always has a for whom — even the empty hub of the ethos at this fold.
 * So the equating instrument is the record's OWN projection: `claims`
 * (injected by the caller) are the fold's rows — {label, end2, end1} with
 * referent identity, the very rows materialPropositions holds and LaVar
 * grades on. A candidate span is grounded-by-meaning FOR `whom` iff it
 * resolves to one of those rows: its label literally (LaVar's own rule,
 * never prose) and BOTH ends through the referent index when one is
 * injected, else by row identity. No model is asked whether two passages
 * are the same thing — the record either carries the row or it does not.
 *
 * The flat-measure law (corroboration.js) is honored, not fought: row
 * identity is STRICT, so a genuinely-reworded claim that no longer lands on
 * a row does NOT move. The honest product is the NAMED set: the equated
 * rows (moved to Derive on the same ruler the ledger rows) and the
 * un-equated spans (named, disclosed as un-equatable FOR this whom — never
 * laundered, never silent, never a model's conviction).
 *
 * `whom` defaults to the empty hub: { face: null, ethos: "empty hub" } — a
 * named standpoint, because a meaning made for nobody is a meaning made
 * quietly, and that is the one thing it may not be.
 */
export function chaseParaphrase({ text = "", sources = new Map(), citations = [], n = 6, grain = "Pattern", phase = "Structure", claims = [], index = null, whom = null } = {}) {
  const base = categorizeCreativity({ text, sources, citations, n, grain, phase });
  const W = whom && typeof whom === "object" && whom.face != null ? whom : (whom && typeof whom === "string" ? { face: whom, ethos: null } : { face: null, ethos: "empty hub" });
  const whomText = (w) => w?.face ? `the ${w.face} face of this fold${w?.ethos && w.ethos !== "empty hub" ? ` (${w.ethos})` : ""}` : w?.ethos && w.ethos !== "empty hub" ? `the ${w.ethos}` : "the empty hub of this fold";
  const stance = (extra = "") => `${base.basis} The meaning chase is stanced FOR ${whomText(W)} — equated by the record's own claim rows, never a model${extra ? ` — ${extra}` : ""}.`;
  const recording = { candidates: 0, equated: 0, unEquated: 0, equatedRows: [], unEquatedSpans: [], rows: (claims ?? []).length, indexResolved: Boolean(index?.resolveIn), whom: W };
  if (!base.paraphraseUnmeasured) {
    return { categorized: { ...base, basis: stance("the verbatim instrument was not silent — no paraphrase chase was owed") }, chase: { ...recording, basis: "the verbatim instrument was not silent — no paraphrase chase was owed" } };
  }
  const probe = paraphraseCandidatesFor({ text, sources, citations, maxSpans: 8 });
  recording.candidates = probe.spans.length;
  if (!probe.spans.length) {
    return { categorized: { ...base, basis: stance("shadow chase found no claim-vocabulary tangent — paraphrase beyond the received vocabulary is outside every engine organ, said so, not papered over") }, chase: { ...recording, basis: "shadow chase found no claim-vocabulary tangent — paraphrase beyond the received vocabulary is outside every engine organ, said so, not papered over" } };
  }
  const rows = (claims ?? []).filter((c) => c && norm(c?.label ?? ""));
  const resolveIn = (spanText) => {
    if (!index?.resolveIn) return [];
    try {
      const r = index.resolveIn(String(spanText ?? ""));
      return [...(r instanceof Set ? r : new Set(r ?? []))].map((id) => { try { return index?.represent?.(id) ?? String(id); } catch { return String(id); } }).map(norm).filter(Boolean);
    } catch { return []; }
  };
  const endHit = (needle, textLower, names) => {
    const n = norm(needle ?? "");
    if (!n || n.length <= 2) return true;
    if (textLower.includes(n)) return true;
    return names.some((n2) => n2 && (n.includes(n2) || n2.includes(n)));
  };

  // THE EQUATE, FOR WHOM: the record's own rows, never a model.
  const equatedSpans = new Set();
  for (const span of probe.spans) {
    const textLower = String(span.span ?? "").toLowerCase();
    const hit = rows.find((c) => {
      const l = norm(c.label ?? "");
      if (!l || l.length <= 2 || !textLower.includes(l)) return false;
      const names = resolveIn(span.span);
      return endHit(c.end2, textLower, names) && endHit(c.end1, textLower, names);
    });
    if (hit) {
      equatedSpans.add(norm(span.span ?? ""));
      recording.equated += 1;
      recording.equatedRows.push({ span: span.span, label: hit.label, end1: hit.end1, end2: hit.end2, via: hit.sentence ?? null });
    } else {
      recording.unEquated += 1;
      recording.unEquatedSpans.push({ span: span.span.slice(0, 160), why: "no claim row of this record resolves in this span FOR this whom" });
    }
  }

  // THE SAME RULER the ledger rows: an equated span is grounded-by-meaning.
  const rowOf = (normed) => (citations ?? []).find((c) => c?.essaySentence && norm(c.essaySentence) === normed) ?? null;
  let derive = base.derive;
  let invent = base.invent;
  let confirmed = 0, moved = 0, added = 0;
  for (const normed of equatedSpans) {
    const row = rowOf(normed);
    if (!row) { derive += 1; added += 1; continue; }
    if (row.kind === "unsupported") { derive += 1; invent = Math.max(0, invent - 1); moved += 1; }
    else if (row.kind === "company") confirmed += 1;
  }
  recording.movedFromInvent = moved;
  recording.confirmedCompany = confirmed;
  recording.groundedByMeaning = recording.equated;

  const verbatimPresent = (base.reproduce.quoted + base.reproduce.copied) > 0;
  const derivation = verbatimPresent || base.derivation === "Reproduce" ? "Reproduce" : invent > 0 ? "Invent" : "Derive";
  const cell = cellOf({ grain, phase, derivation });

  const categorized = {
    ...base,
    derive,
    invent,
    derivation,
    field: derivation,
    echo: { ratio: base.derivationRatio, window: base.derivationWindow, disagreement: base.disagreement },
    cell,
    paraphraseUnmeasured: base.paraphraseUnmeasured && recording.unEquated > 0,
    paraphraseEquated: recording.equated,
    paraphraseRows: recording.equatedRows.slice(0, 3).map((r) => ({ span: r.span.slice(0, 160), row: { label: r.label, end1: r.end1, end2: r.end2 } })),
    paraphraseChase: recording,
    basis: stance(`${recording.equated} of ${recording.candidates} candidate span(s) resolve to the record's own claim rows (label + ends ${recording.indexResolved ? "through the referent index" : "by row identity"}, never a model) — grounded-by-meaning, moved to derived (${recording.movedFromInvent} from invented, ${recording.confirmedCompany} company confirmed, ${recording.added} unrowed added); ${recording.unEquated} named and disclosed un-equatable FOR ${whomText(W)}, never launderable, never a model's conviction. Cell: ${cell.name} (${cell.archon}).`),
  };

  recording.basis = `the record equated ${recording.equated} of ${recording.candidates} candidate span(s) FOR ${whomText(W)}; ${recording.unEquated} un-equatable; ${recording.rows} claim row(s) on the record`;
  return { categorized, chase: recording };
}
