// falsify-categorization.mjs — TEST THOROUGHLY, TRY TO FALSIFY.
// Second pass against the STRENGTHENED contract of the periodic-table
// categorization. The three structural gaps that a VERBATIM instrument
// cannot close are DISCLOSED, not papered over — the test now checks that
// the disclosure is actually made (never silent), so a false silence reads
// as the failure it is, exactly as the CLAUDE.md doctrine demands.
//
// Claim set tightened to what is now promised:
//   1. The artifact's cell resolves through the table (cellOf), never a
//      parallel hardcode.
//   2. The derivation CATEGORY is a risk label; the numeric ratio is
//      reported beside it, with the n-shape it hides (derivationWindow).
//   3. The two rulers are NAMED (unique 6-gram runs vs ledger sentence rows).
//   4. Paraphrase escape is FLAGGED, never silent ("invented").
//   5. Instrument disagreement on the same bytes is FLAGGED.
// Every falsification is a real run. Exit 0 only if the strengthened
// contract holds; a "FALSIFIED" verdict is a broken disclosure, not a
// curiosity.

import { categorizeCreativity, runDMCA, chaseParaphrase } from "./run-dmca.js";
import { cellOf, CELLS } from "./creativity-table.js";

let ruledOut = 0, falsified = 0;
const verdict = (claim, held, evidence) => {
  console.log(`\n  ${held ? "RULED OUT" : "FALSIFIED"}  ${claim}\n    ${evidence}`);
  held ? ruledOut++ : falsified++;
  return !held;
};

// ---------------------------------------------------------------------------
// G1  THE TABLE IS THE SOURCE OF TRUTH — cellOf is the runtime's resolver.
// ---------------------------------------------------------------------------
{
  const claim = "The artifact's cell resolves through the table (cellOf), grain×phase×derivation, not a parallel hardcode";
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night."]]);
  const verb = "The storm came in off the sea and the great beam turned in the tower all through the dark night.";
  const rew = "A gale rolled in from the ocean while the lamp revolved overhead throughout the long gloomy hours.";
  const cases = [
    ["Reproduce", categorizeCreativity({ text: verb, sources: src, citations: [{ kind: "verbatim", source: "S", essaySentence: verb }] }).cell, { grain: "Pattern", phase: "Structure", derivation: "Reproduce" }],
    ["Derive", categorizeCreativity({ text: rew, sources: src, citations: [{ kind: "company", source: "S", essaySentence: rew }] }).cell, { grain: "Pattern", phase: "Structure", derivation: "Derive" }],
    ["Invent", categorizeCreativity({ text: "The old keeper swept the steps each dawn.", sources: src, citations: [{ kind: "unsupported", source: null, essaySentence: "The old keeper swept the steps each dawn." }] }).cell, { grain: "Pattern", phase: "Structure", derivation: "Invent" }],
  ];
  const held = cases.every(([n, got, want]) => {
    const expected = cellOf(want);
    return got.grain === expected.grain && got.phase === expected.phase && got.derivation === expected.derivation && got.name === expected.name && got.archon === expected.archon;
  });
  verdict(claim, held, cases.map(([n, got]) => `${n}: ${got.name}/${got.archon} @ ${got.grain}×${got.phase}`).join(" "));
}

// ---------------------------------------------------------------------------
// G2  THE DERIVATION CATEGORY AND ITS RATIO — the label never hides the share.
//     1 verbatim sentence among 90 invented must show BOTH the risk label
//     (Reproduce) AND the ~0 ratio, on the record.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night."]]);
  const verbatim = "The storm came in off the sea and the great beam turned in the tower all through the dark night.";
  const invented = Array.from({ length: 90 }, (_, i) => `The keeper climbed stair ${i} of the spiral with a lantern in each hand, oil sloshing softly in the tin.`).join(" ");
  const c = categorizeCreativity({ text: invented + " " + verbatim, sources: src, citations: [{ kind: "verbatim", source: "S", essaySentence: verbatim }] });
  const held = c.derivation === "Reproduce" && typeof c.derivationRatio === "number" && c.derivationRatio < 0.05 && c.derivationWindow && c.derivationWindow.min <= c.derivationRatio && c.derivationRatio <= c.derivationWindow.max;
  verdict("The risk label (Reproduce) and the numeric share (≈0) are BOTH on the record", held, `derivation=${c.derivation}, derivationRatio=${c.derivationRatio.toFixed(4)}, window=[${c.derivationWindow.min.toFixed(2)}, ${c.derivationWindow.max.toFixed(2)}] at n=${c.derivationWindow.n}: the reader sees the category AND the share AND the n-grip, never a falsely precise point. (The winner-take-all label itself is the disclosed risk posture — one copy present ⇒ Reproduce, whatever its share — now stated as such.)`);
}

// ---------------------------------------------------------------------------
// G3  THE RULERS ARE NAMED — unique 6-gram runs vs ledger sentence rows.
//     50× repetition of one source sentence: reproduce must NOT report 50.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night."]]);
  const verbatim = "The storm came in off the sea and the great beam turned in the tower all through the dark night.";
  const fifty = Array(50).fill(verbatim).join(" ");
  const c = categorizeCreativity({ text: fifty, sources: src, citations: [{ kind: "verbatim", source: "S", essaySentence: verbatim }] });
  const held = typeof c.units === "object" && /run/i.test(c.units.reproduce) && /row/i.test(c.units.derive) && c.reproduce.quoted < 50 && c.reproduce.copied < 50;
  verdict("The two rulers are on the report, so nobody adds runs to rows", held, `reproduce=${c.reproduce.quoted} quoted / ${c.reproduce.copied} copied unique runs (50× repetition is NOT 50); units.reproduce = "${c.units.reproduce}"; units.derive = "${c.units.derive}".`);
}

// ---------------------------------------------------------------------------
// G4  PARAPHRASE ESCAPE IS FLAGGED, never silent — a reworded grounded piece
//     with NO order-specific reproduction must read as "paraphrase unmeasured",
//     not as proven invention.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night."]]);
  const para = "A gale rolled in from the ocean while the lamp revolved overhead throughout the long gloomy hours.";
  const evaded = runDMCA({ text: para, sources: src, citations: [] });
  const catShape = categorizeCreativity({ text: para, sources: src, citations: [{ kind: "company", source: "S", essaySentence: para }] });
  const withoutRow = categorizeCreativity({ text: para, sources: src, citations: [] });
  const held = evaded.paraphraseUnmeasured === true && /paraphrase/i.test(evaded.basis) && catShape.paraphraseUnmeasured === true && withoutRow.paraphraseUnmeasured === true;
  verdict("Paraphrase that escapes the verbatim instrument is flagged, and the basis names it", held, `runDMCA.paraphraseUnmeasured=${evaded.paraphraseUnmeasured}; basis says: "${evaded.basis.split("WARNING")[1]?.trim().slice(0, 80) ?? evaded.basis}"; categorize (with company row) derivation=${catShape.derivation} → ${catShape.cell.name}, (no row) derivation=${withoutRow.derivation} → ${withoutRow.cell.name}, flagged=${withoutRow.paraphraseUnmeasured}.`);
}

// ---------------------------------------------------------------------------
// G5  INSTRUMENT DISAGREEMENT IS FLAGGED — a verbatim span a row calls
//     "company" is not silently both Reproduce and Derive.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night."]]);
  const verbatim = "The storm came in off the sea and the great beam turned in the tower all through the dark night.";
  const c = categorizeCreativity({ text: verbatim, sources: src, citations: [{ kind: "company", source: "S", essaySentence: verbatim }] });
  const held = c.disagreement === true;
  verdict("The same bytes are never both Reproduce and Derive without a flag", held, `reproduce.quoted=${c.reproduce.quoted} (runDMCA sees order-specific) AND derive=${c.derive} (the row calls it company) → disagreement=${c.disagreement}: the viewer is told the two instruments conflict on this text.`);
}

// ---------------------------------------------------------------------------
// G6  EDGES (regress) — empty, short, sourceless, kind-less.
// ---------------------------------------------------------------------------
{
  const empty = runDMCA({ text: "", sources: new Map(), citations: [] });
  const short = runDMCA({ text: "the sea", sources: new Map([["S", "a much longer source that actually has plenty of words to match against the text"]]) });
  const sourceless = categorizeCreativity({ text: "The keeper climbed the spiral stair with oil in a tin lantern, the beam turning far out across the dark water.", sources: new Map(), citations: [{ kind: "unsupported", source: null, essaySentence: "The keeper climbed the spiral stair." }] });
  const held = empty.ok && empty.paraphraseUnmeasured === false && short.ok && sourceless.derivation === "Invent" && sourceless.cell.name === "System";
  verdict("Edges behave (empty→ok, no false paraphrase flag on empty, short→ok, sourceless→System)", held, `empty.ok=${empty.ok}, empty.paraphraseUnmeasured=${empty.paraphraseUnmeasured}, short.ok=${short.ok}, sourceless=${sourceless.derivation}/${sourceless.cell.name}.`);
}

// ---------------------------------------------------------------------------
// G7  THE N-SHAPE IS A RANGE, not a point (the magic constant's grip is shown).
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The storm came in off the sea and the great beam turned in the tower all through the dark night it was a night of trouble for every ship around the bitter headland and the keeper refilled the lamp with oil from the great copper vessel in the store."]]);
  const half = "The keeper refilled the lamp with oil from the great copper vessel in the store while the beam turned in the tower all through the dark night and the storm came in off the sea.";
  const wide = [4, 5, 6, 7, 8, 9, 10].map((n) => runDMCA({ text: half, sources: src, citations: [], n }).derivation);
  const c = categorizeCreativity({ text: half, sources: src, citations: [] });
  const held = c.derivationWindow && c.derivationWindow.min !== c.derivationWindow.max && wide.some((d) => d < c.derivationWindow.min || d > c.derivationWindow.max);
  verdict("The answer shows its n-dependence as a window (min..max around n), and wide sweeps visibly disagree", held, `derivationWindow=[${c.derivationWindow.min.toFixed(2)}, ${c.derivationWindow.max.toFixed(2)}] @ n=${c.derivationWindow.n}; full n=4..10 sweep=${wide.map((d) => d.toFixed(2)).join(", ")} — the boundary is n-shaped and the report says so (the DMD+Born edge is the disclosed land).`);
}

// ---------------------------------------------------------------------------
// G8  THE FULL TABLE IS REAL AND REACHABLE by cellOf (regress) + the original
//     provenance axioms (regress).
// ---------------------------------------------------------------------------
{
  const names = Object.keys(CELLS);
  const allDistinct = new Set(names).size === 27;
  const apex = cellOf({ grain: "Pattern", phase: "Interpretation", derivation: "Invent" });
  const apexOk = apex.name === "Cosmogeny" && apex.archon === "Wilson";
  const lift = "Lighthouses mark dangerous coastlines, hazardous shoals, reefs, rocks, and safe entries to harbors.";
  const S = new Map([["wiki", "Lighthouses mark dangerous coastlines, hazardous shoals, reefs, rocks, and safe entries to harbors. A Fresnel lens captures more oblique light from a source, visible over greater distances."]]);
  const axioms = [
    categorizeCreativity({ text: lift, sources: S, citations: [] }).derivation === "Reproduce",
    categorizeCreativity({ text: lift, sources: S, citations: [{ essaySentence: lift, source: "wiki", kind: "verbatim" }] }).derivation === "Reproduce",
    categorizeCreativity({ text: "Lighthouses stand watch over perilous shores.", sources: S, citations: [{ essaySentence: "Lighthouses stand watch over perilous shores.", source: "wiki", kind: "company" }] }).derivation === "Derive",
    categorizeCreativity({ text: "The old keeper swept the steps each dawn.", sources: S, citations: [{ essaySentence: "The old keeper swept the steps each dawn.", source: null, kind: "unsupported" }] }).derivation === "Invent",
  ];
  const held = names.length === 27 && allDistinct && apexOk && axioms.every(Boolean);
  verdict("The 27-cell table is intact (Cosmogeny at the apex) and the provenance axioms hold (regress)", held, `${names.length} cells distinct, apex=${apex.name}/${apex.archon}, axioms: reproduce-uncited ✓ reproduce-cited ✓ company→Derive ✓ unsupported→Invent ✓`);
}

// ---------------------------------------------------------------------------
// G9  THE SHADOW CHASE NAMES THE EVASION (never silent "UNMEASURED"). A
//     reworded span that shares its claim-vocabulary with the sources'
//     sentences (same referents in the claim, other words) is surfaced as a
//     paraphrase CANDIDATE, synchronously, with no model — the verbatim
//     instrument's silence becomes a measurement with a number and a face.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The keeper polished the brass reflector until it gleamed in the lamp's light each night."]]);
  const para = "Every night he rubbed the brass reflector until it shone in the lamp's pale light.";
  const c = categorizeCreativity({ text: para, sources: src, citations: [{ kind: "unsupported", source: null, essaySentence: para }] });
  const held = c.paraphraseUnmeasured === true && c.paraphraseCandidates >= 1 && c.paraphraseSurfaces.length >= 1 && /Shadow chase/.test(c.basis);
  verdict("A reworded span sharing claim-vocabulary with the sources is NAMED by the shadow chase (paraphraseCandidates, never silently unmeasured)", held, `paraphraseUnmeasured=${c.paraphraseUnmeasured}, paraphraseCandidates=${c.paraphraseCandidates}, surfaces=${c.paraphraseSurfaces.length}, basis="${c.basis.slice(0, 120)}…": the evasion now has a number and a face, and the RECORD (tier 2, chaseParaphrase — the fold's own claim rows, no model) is the declared equating door.`);
}

// ---------------------------------------------------------------------------
// G10  THE RECORD, NOT A MODEL, EQUATES the holograph-equivalent span — "not
//      character-identical, but the record's own projection holds the same
//      claim" — from invent-leaning to Derive, on the ledger's OWN ruler
//      (per-sentence rows), with the winner-take-all label recomputed. The
//      equate is performed FOR a whom (default: the empty hub of this fold —
//      a named standpoint, never an omitted one). One equated row never
//      launders the span no row resolves.
// ---------------------------------------------------------------------------
{
  const src = new Map([["S", "The keeper polished the brass reflector until it gleamed in the lamp's light each night."]]);
  const para = "Every night he rubbed the brass reflector until it shone in the lamp's pale light.";
  // The record's own claim row for the span's claim (the material's
  // {label, end2, end1} proposition; label literal + both ends, LaVar's rule).
  const claim = { label: "rubbed", end1: "he", end2: "brass reflector", sentence: "The keeper polished the brass reflector until it gleamed in the lamp's light each night." };
  const clean = chaseParaphrase({ text: para, sources: src, citations: [{ kind: "unsupported", source: null, essaySentence: para }], claims: [claim] });
  const expected = cellOf({ grain: "Pattern", phase: "Structure", derivation: "Derive" });
  const heldClean = clean.chase.equated === 1 && clean.chase.movedFromInvent === 1 && clean.categorized.derive === 1 && clean.categorized.invent === 0 && clean.categorized.derivation === "Derive" && clean.categorized.cell.name === expected.name && clean.categorized.cell.archon === expected.archon && clean.chase.whom.face === null && clean.chase.whom.ethos === "empty hub";
  verdict("A span that resolves to the record's own claim row MOVES to Derive on the ledger's own ruler; the cell follows (Composition/Alexander) — for the declared whom, never a model", heldClean, `equated=${clean.chase.equated}, movedFromInvent=${clean.chase.movedFromInvent}, derive=${clean.categorized.derive}, invent=${clean.categorized.invent}, derivation=${clean.categorized.derivation}, cell=${clean.categorized.cell.name}/${clean.categorized.cell.archon}, whom=${clean.chase.whom.face ?? clean.chase.whom.ethos} — grounded-by-meaning, equated by the record's row, not by character identity.`);

  const disjoint = "The keeper dreamed of the sea beyond the rocks while the fog rolled in grey and cold.";
  // The record holds ONE row; the dream span shares only "keeper" with the
  // source and no row of the record states its claim — the equate must NOT
  // launder it. It is NAMED (unEquated=1) and the piece stays Invent/System.
  const guarded = chaseParaphrase({ text: `${para} ${disjoint}`, sources: src, citations: [{ kind: "unsupported", source: null, essaySentence: para }, { kind: "unsupported", source: null, essaySentence: disjoint }], claims: [claim] });
  const heldGuarded = guarded.chase.equated === 1 && guarded.chase.unEquated === 1 && guarded.chase.movedFromInvent === 1 && guarded.categorized.derive === 1 && guarded.categorized.invent === 1 && guarded.categorized.derivation === "Invent" && guarded.categorized.cell.name === "System" && guarded.categorized.paraphraseUnmeasured === true;
  verdict("One equated row never launders the span no row resolves — it is NAMED un-equatable, the label recomputes, the piece stays Invent/System", heldGuarded, `equated=${guarded.chase.equated}, unEquated=${guarded.chase.unEquated}, derive=${guarded.categorized.derive}, invent=${guarded.categorized.invent}, derivation=${guarded.categorized.derivation}, cell=${guarded.categorized.cell.name}, paraphraseUnmeasured=${guarded.categorized.paraphraseUnmeasured} — the record closes one span, never the run.`);
}

{ // G10b — THE MODEL IS GONE, AND THE WHOM IS NAMED. The model-era verdict
  // fields (attested/asked/refused/unresolved) do not exist on the chase
  // recording; the equate is record-driven (equated/unEquated). The default
  // whom is the empty hub of this fold — a named standpoint — and an armed
  // face passes through and is disclosed in the basis.
  const f = chaseParaphrase({ text: "Every night he rubbed the brass reflector until it shone in the lamp's pale light.", sources: new Map(), citations: [], claims: [] });
  const modelFree = !("attested" in f.chase) && !("asked" in f.chase) && !("refused" in f.chase) && "equated" in f.chase && "unEquated" in f.chase;
  const stanced = f.chase.whom.face === null && f.chase.whom.ethos === "empty hub" && /empty hub of this fold/.test(f.categorized.basis);
  const armed = chaseParaphrase({ text: "Every night he rubbed the brass reflector until it shone in the lamp's pale light.", sources: new Map(), citations: [], claims: [], whom: { face: "LaVar", ethos: "the EVA lens of this fold" } });
  const facePasses = /the LaVar face of this fold/.test(armed.categorized.basis);
  verdict("The model-era witness is GONE (no asked/attested/refused on the chase) and the equate is stanced: the default whom is the empty hub of this fold, named in the basis; an armed face passes through and is disclosed", modelFree && stanced && facePasses, `model-verdict fields: ${modelFree ? "absent ✓" : "PRESENT (the old witness still rides)"}; default whom: ${f.chase.whom.face ?? `${f.chase.whom.ethos}`}, basis named: ${stanced}; armed whom passes: ${facePasses} — meaning is always equated FOR someone.`);
}

console.log(`\n================================`);
console.log(`RULED OUT (strengthened contract holds): ${ruledOut}`);
console.log(`FALSIFIED (a disclosure is broken):       ${falsified}`);
console.log(`================================`);
process.exit(falsified ? 1 : 0);