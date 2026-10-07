// organs/vonnegut.js — THE WRITER'S ARC: shapes of stories.
// Handle: Kurt Vonnegut — his lecture on the shapes of stories: fortune on
// the y-axis, time (beginning to end) on the x-axis, and every story traces
// SOME shape — "man in hole" (fall then rise), "boy meets girl" (rise, fall,
// rise), "from bad to worse" (steady fall), "which way is up" (no shape).
// For an ESSAY the fortune is the reader's CONVICTION: the surprising thesis
// digs a hole (the dip), the body's grounded evidence climbs out (the rise),
// the conclusion lands the understanding (the peak). Vonnegut is the WRITER:
// he shapes the whole arc; Murch (the editor) cuts within it; the redundancy
// organs season the prose. A piece that traces no shape is a flatline of
// conviction — the essay's version of Vonnegut's "which way is up."
//
// The fortune of a section is its CONVICTION: how much it advances the
// piece's thesis (the evidence grounding — does it resolve the opening's
// surprise, add a claim, or merely restate?). Mechanical and auditable.

/**
 * The fortune curve of the piece: each section's conviction level in order,
 * from the thesis (opening) to the conclusion (last). A section's conviction
 * is measured from its grounded proposition load — how many distinct material
 * claims it carries that the previous sections did NOT already carry (new
 * conviction = a rise; restatement = a flat; the opening thesis is the
 * baseline the body must climb out of).
 */
export function fortuneCurve(documentLines = [], { materialPropositions = [], index = null } = {}) {
  const norm = (t) => String(t ?? "").split(/\s+/).join(" ").toLowerCase().trim();
  const props = (materialPropositions ?? []).filter((p) => p && norm(p.label));
  const resolveIn = (text) => {
    try {
      const r = index?.resolveIn?.(String(text ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  const sections = (documentLines ?? []).map((l) => String(l ?? "").trim()).filter((l) => l.length > 20);
  const carried = new Set(); // claim keys the piece has already stated
  const allCarried = []; // the running cumulative understanding
  const curve = [];
  for (let i = 0; i < sections.length; i++) {
    const text = sections[i];
    // The section's claim keys: its proposition label+object, normalized.
    const textLower = text.toLowerCase();
    let newConviction = 0;
    for (const p of props) {
      const lab = norm(p.label); if (!lab) continue;
      const e2 = norm(p.end2);
      const key = `${lab}|${e2}`;
      const labHit = lab.length > 2 && textLower.includes(lab);
      const e2Hit = !e2 || e2.length <= 2 || textLower.includes(e2);
      if (!labHit || !e2Hit) continue;
      if (!carried.has(key)) { carried.add(key); newConviction++; }
    }
    // The CONVICTION is the cumulative understanding: how many of the
    // material's claims the piece now holds. The conclusion, even when it
    // only REPRISES the thesis, holds the FULL accumulated understanding —
    // it is the peak, the "and therefore" the essay has earned. Fortune is
    // the reader's understanding, and it accumulates; it rarely falls once
    // a claim is grounded.
    const names = [...resolveIn(text)].map(represent);
    allCarried.push(carried.size);
    curve.push({
      index: i,
      conviction: carried.size,
      newClaims: newConviction,
      referents: names.slice(0, 3),
    });
  }
  return curve;
}

/**
 * THE SHAPE OF THE PIECE — Vonnegut's classification of the fortune curve.
 *   manInHole  — the thesis digs (the surprise dip), the body climbs out, the
 *                conclusion lands ABOVE where it began. The essay's classic
 *                arc: surprise, then understanding.
 *   ragsToRiches — a steady climb: each section adds conviction, ending high.
 *   fromBadToWorse — a steady fall: the piece loses conviction as it goes.
 *   flatline  — no shape: conviction never rises or falls — Vonnegut's
 *                "which way is up," the essay that argues nothing.
 * Returns the shape, the curve, and the arc points (start/dip/peak/end).
 */
export function storyShape(documentLines = [], { materialPropositions = [], index = null } = {}) {
  const curve = fortuneCurve(documentLines, { materialPropositions, index });
  if (curve.length < 2) return { shape: "flatline", curve, basis: "fewer than two sections — no arc to trace", start: 0, end: 0 };
  const totalNew = curve.reduce((a, c) => a + c.newClaims, 0);
  const start = curve[0].conviction;
  const end = curve[curve.length - 1].conviction;
  const dip = Math.min(...curve.map((c) => c.conviction));
  const peak = Math.max(...curve.map((c) => c.conviction));
  // The fortune curve is CUMULATIVE understanding. The shapes, on that curve:
  //   MAN IN HOLE — the thesis digs (the surprise is a claim the reader did
  //   not hold), the body climbs (new claims accumulate), the conclusion
  //   holds the full understanding — the essay surprises, then understands.
  //   RAGS TO RICHES — a steady climb to the peak.
  //   FLATLINE — no new claims: the piece argues nothing the material holds.
  const climbed = curve[curve.length - 1].conviction > curve[0].conviction + 1;
  const manInHole = climbed && end >= start + 1 && totalNew >= 2;
  const monotoneRise = curve.slice(1).every((c, i) => c.conviction >= curve[i].conviction) && end > start + 1 && totalNew >= 2;
  const flatline = totalNew === 0;
  const falling = end < start && !flatline;
  let shape;
  let basis;
  if (manInHole) {
    shape = "man-in-hole";
    basis = `Vonnegut: man-in-hole — the thesis surprises (${start} held), the body climbs, the conclusion holds the full understanding (${end}). The essay surprises, then understands.`;
  } else if (monotoneRise) {
    shape = "rags-to-riches";
    basis = `Vonnegut: rags-to-riches — a steady climb of understanding from ${start} to ${end} (${totalNew} new claims, peak ${peak}). Each section adds; the piece accumulates to its conclusion.`;
  } else if (flatline) {
    shape = "flatline";
    basis = `Vonnegut: no shape — the piece carries no material conviction (${totalNew} new claims total). "Which way is up": it argues nothing the material supports.`;
  } else if (falling) {
    shape = "from-bad-to-worse";
    basis = `Vonnegut: from-bad-to-worse — the piece's held understanding falls as it goes (${start} → ${end}). It argues down instead of up.`;
  } else {
    shape = "mixed";
    basis = `Vonnegut: a mixed arc — ${totalNew} new claim(s), start ${start}, end ${end}, dip ${dip}, peak ${peak}. The curve moves but does not settle into one classic shape.`;
  }
  return { shape, curve, basis, start, end, dip, peak, totalNew };
}

/** Alias of storyShape — the arc by any name. */
export const vonnegutShape = storyShape;

/** Alias of fortuneCurve — the conviction series by any name. */
export const conviction = fortuneCurve;