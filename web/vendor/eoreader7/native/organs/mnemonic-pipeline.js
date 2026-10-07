// native/organs/mnemonic-pipeline.js — the continuous learning loop: the
// child gets recursively better at knowing what something is, without
// calling a CV model, from EVERYTHING that passes through the reading —
// whether the work gives it material (the proxy's look loop) or we ask it
// to keep iterating.
//
// THE LOOP, THREE SEAMS:
//   learnFromLook     — when the CV PARENT runs (the expensive path), its
//                       named boxes become lessons (teachFromLook) and the
//                       read is absorbed. The parent teaches, one time.
//   learnFromGrid     — when the CHILD runs (the fast path — no CV), its
//                       own recognition is absorbed: recognized things
//                       corroborate their kinds (CON), unrecognized things
//                       are signed as provisional kinds AND taught their
//                       own first lesson (SIG) — the child learns from its
//                       own novelties.
//   learnIteratively  — keep re-reading the material until a round learns
//                       nothing new (a fixed point): the novelty curve
//                       falls to zero and the store has become the memory
//                       of the material, at 144 bytes per thing.
//
// THE REPORT makes "recursively better" measured: every call returns what
// changed (new kinds, corroborations, confirmations, the novelty count) and
// learningReport gives the whole universe's state — so the loop's progress
// is a curve, never a claim.

import {
  emptyStore,
  loadStore,
  saveStore,
  recognizeGrid,
  recognizeGridColor,
  absorbRecognition,
} from "./mnemonic.js";
import { universeSnapshot } from "../kernel/kind-universe.js";

export { loadStore, emptyStore, saveStore };
// ── the working seam: whatever the proxy looked at feeds the memory ────────
// learnFromLook: a lookAtImage result. If the FAST PATH ran (a memory read),
// the recognition is already in hand — absorb it (the child confirms its
// own memories). If the CV PARENT ran (boxes + OCR + vision), its named
// regions become lessons FIRST (the parent teaches), then the whole read is
// absorbed. The next time anything like this appears, the child answers
// from memory — the parent need not run again.
export async function learnFromLook(store, lookResult, { grid = 128 } = {}) {
  const before = universeSnapshot(store);
  const report = { taught: 0, absorbedRegions: 0, from: "cv-parent", novelty: 0, confirmed: [] };
  if (!lookResult?.imagePath) return { ...report, before, after: before };
  if (lookResult.fastPath?.matched) {
    // the child read it from memory — absorb what it saw
    report.from = "fast-path";
    report.absorbedRegions = lookResult.fastPath.regions?.length ?? 0;
  } else {
    // the parent read it: its named boxes ARE the lessons — the child is
    // taught what each region is, at the parent's own spatial coordinates.
    // Each box carries its own name (the parent said "circle"), so each
    // box teaches its own kind under that name.
    const { load } = await import("../adapters/image/material.js");
    const { figureRegions } = await import("../kernel/shadow-echo.js");
    const { teachGrid } = await import("./mnemonic.js");
    const { buf, w, h } = await load(lookResult.imagePath, { w: grid, h: grid });
    const sx = grid / lookResult.width;
    const sy = grid / lookResult.height;
    const proposal = figureRegions(buf, w, h);
    for (const b of lookResult.boxes ?? []) {
      if (!b.text || !b.text.trim() || !b.region) continue;
      const [x, y, bw, bh] = b.region;
      const box = [Math.round(x * sx), Math.round(y * sy), Math.max(1, Math.round(bw * sx)), Math.max(1, Math.round(bh * sy))];
      // the parent says "the thing is AROUND here"; the child proposes the
      // tight figure inside the box — the lesson and the query then live in
      // the same world (measured: exact parent boxes vs the child's
      // noise-inflated proposals differ at the rim by ~0.5, and a one-pixel
      // difference flips the 8x8 shadow bins)
      const center = [box[0] + box[2] / 2, box[1] + box[3] / 2];
      const inside = proposal.regions.find((r) => {
        const [rx, ry, rw, rh] = r.region;
        return center[0] >= rx && center[0] <= rx + rw && center[1] >= ry && center[1] <= ry + rh;
      });
      teachGrid(store, b.text.trim().slice(0, 60), {
        grid: buf, w, h,
        region: inside ? inside.region : box,
        source: lookResult.imagePath,
        sourceBytes: lookResult.sourceBytes ?? 0,
        label: b.text.trim().slice(0, 120),
      });
      report.taught += 1;
    }
  }
  const after = universeSnapshot(store);
  report.novelty = Object.values(after.kinds).filter((k) => k.status === "provisional").length;
  report.confirmed = Object.keys(after.kinds).filter((n) => after.kinds[n].status === "confirmed");
  return { ...report, before, after };
}

// ── the child's own learning seam: no CV anywhere ──────────────────────────
// learnFromGrid: recognize the material with the child alone (shadow/echo
// + the derived bounds — no OpenCV, no ollama), then absorb: recognized
// things corroborate (CON), unrecognized things are signed as provisional
// kinds and taught their own first lesson (SIG). The store is saved after
// every call, so the learning is continuous across sessions.
export function learnFromGrid(store, grid, w, h, { source = "working", colorGrid = null } = {}) {
  const before = universeSnapshot(store);
  const rec = colorGrid ? recognizeGridColor(store, grid, colorGrid, w, h) : recognizeGrid(store, grid, w, h);
  const absorbed = absorbRecognition(store, rec, { source, grid, w, h });
  const after = universeSnapshot(store);
  const report = {
    from: "fast-path",
    regions: rec.regions.length,
    recognized: rec.regions.filter((r) => r.recognized.length).length,
    novel: rec.regions.filter((r) => r.novel).length,
    newKinds: after.kindCount - before.kindCount,
    confirmed: Object.values(after.kinds).filter((k) => k.status === "confirmed").length,
  };
  return { report, before, after, rec };
}

// ── the iterative seam: keep reading until nothing new is learned ─────────
// learnIteratively: re-read the material round after round. Each round the
// child recognizes what it already knows and signs what it does not; the
// novelty count is the curve — it falls to zero when the material has been
// fully absorbed into the 144-byte memory. `rounds` is a bound, never a
// claim: the loop stops early at the fixed point.
export function learnIteratively(store, material, { rounds = 6, source = "iterate", colorGrid = null } = {}) {
  const curve = [];
  const reports = [];
  let round = 0;
  for (; round < rounds; round += 1) {
    const { report } = learnFromGrid(store, material.grid, material.w, material.h, {
      source: `${source}:round-${round}`,
      colorGrid: material.colorGrid ?? colorGrid,
    });
    curve.push(report.novel);
    reports.push(report);
    if (report.novel === 0 && report.newKinds === 0) break;
  }
  return {
    rounds: round + 1,
    converged: curve[curve.length - 1] === 0,
    curve,
    reports,
    universe: universeSnapshot(store),
  };
}

// ── the report: what the memory has become ─────────────────────────────────
export function learningReport(store) {
  const snap = universeSnapshot(store);
  return {
    kinds: snap.kindCount,
    confirmedKinds: Object.values(snap.kinds).filter((k) => k.status === "confirmed").length,
    provisionalKinds: Object.values(snap.kinds).filter((k) => k.status === "provisional").length,
    lessons: Object.values(snap.kinds).reduce((a, k) => a + k.lessons, 0),
    occurrences: Object.values(snap.kinds).reduce((a, k) => a + k.occurrences, 0),
    parts: snap.partCount,
    universe: snap,
  };
}
