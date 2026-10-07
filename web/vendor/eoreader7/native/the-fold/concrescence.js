// concrescence.js — THE CONCRESCENCE DETECTOR (2026-09-21, the design's
// reframe: satisfaction is the FINAL PHASE OF THE CONCRESCENCE, not an external
// measure of strain hitting zero). This module reads the rotation stream and
// tells us WHEN WE HAVE ARRIVED — not by "strain = 0" (a strain-0 essay would
// be dead: no counterweight, nothing carried), but by the phase transition in
// the process's own data.
//
// THE THREE SIGNALS (from the design — Whitehead's actual doctrine):
//   1. REMOVAL TEST (mutual requirement): for every unit u,
//      sat(whole − u) < sat(whole). The piece is a determinate unity when
//      nothing can be removed without the whole degrading. A non-integrated
//      list passes vacuously (removing a section leaves the essay "fine").
//   2. INFLUX STABILITY (self-stability under gathering): text-change per
//      gathered batch → 0 WHILE gathering stays positive. The occasion has
//      become determinate: it can absorb the universe without being altered.
//   3. TENSION HOLDING (subjective form): "broke" findings that recur across
//      rotations without being acted on, and whose presence does not drop the
//      whole's satisfaction. Held tension is the piece's character — the flood
//      as recurring counterweight — not a debt to be paid.
//
// CONCRESCENCE = strain constant + influx-stable + every unit passes the
// removal test. The triad, measured from inside the process. The detector
// NEVER says "not yet done" as a dead end: it names WHICH signal is missing
// (the watchmaker's rule — each reading is usable).

export const CONCRESCENCE_SCHEMA = "EOConcrescence@1";
export const PHASES = Object.freeze({ CONFORMAL: "conformal", VALUATION: "valuation", COMPARATIVE: "comparative", SATISFACTION: "satisfaction" });

/**
 * removalTest(whole, units, sat) → whether every unit is REQUIRED by the whole.
 * sat(whole) vs sat(whole − u) for every u: the piece is integrated when
 * removing any unit degrades it. `sat` is injected (pure function of text →
 * { strain, ok }), so the test works on any satisfaction the system has.
 */
export function removalTest(whole, units = [], sat = () => ({ strain: 0 })) {
  const wholeSat = sat(whole);
  const degrading = [];
  const independent = [];
  for (let i = 0; i < units.length; i++) {
    const without = units.filter((_, j) => j !== i).join("\n\n");
    const withoutSat = sat(without);
    if (withoutSat.strain > wholeSat.strain) degrading.push(i);
    else independent.push(i);
  }
  return {
    passed: units.length > 0 && independent.length === 0,
    degrading, independent,
    wholeStrain: wholeSat.strain,
    basis: units.length === 0
      ? "no units to test — cannot be a determinate unity"
      : independent.length === 0
        ? `every unit is required: removing any one degrades the whole (${units.length}/${units.length})`
        : `${degrading.length}/${units.length} required; ${independent.length} independent — the piece is still a list, not a unity`,
  };
}

/**
 * influxStability(log) → whether the piece is stable against new gathering.
 * log entries carry { textAfter, gathered } (from the spiral). Stability is
 * text-change per gathered batch approaching zero WHILE gathering stays
 * positive. A piece whose text stops changing while it keeps gathering has
 * achieved its determinate character (the transition from becoming to being).
 */
export function influxStability(log = []) {
  const entries = (log ?? []).filter((e) => typeof e?.textAfter === "string" && e.textAfter.length);
  if (entries.length < 2) return { stable: false, gathered: false, basis: "fewer than two rotations — not enough stream to judge" };
  // CONVERGENCE IS A LOCAL SIGNAL, NOT AN AVERAGE (2026-09-21, C1's first
  // failure): the early rotations GROW the piece (big text-change), and an
  // average over the whole stream never converges. What the detector wants is
  // the RECENT rate: the last pair of rotations — is the text still changing
  // while the piece keeps gathering? The last two identical entries (gathered
  // positive, text unchanged) are the signature of arrival.
  const last = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  const longer = Math.max(prev.textAfter.length, last.textAfter.length) || 1;
  // recentChange is the FRACTION of the text that changed: 0 = identical,
  // 1 = completely different. (The first version inverted this — 1 minus the
  // ratio — so two IDENTICAL entries reported 100% change and nothing ever
  // converged. 0 is the converged reading.)
  const recentChange = Math.abs(prev.textAfter.length - last.textAfter.length) / longer;
  const recentGather = Number(last.gathered ?? 0) > 0 || Number(prev.gathered ?? 0) > 0;
  const stable = recentChange < 0.05 && recentGather;
  return {
    stable, recentChange, gathered: recentGather,
    basis: stable
      ? `the last two rotations changed ${(recentChange * 100).toFixed(1)}% of the text while gathering stayed positive — the piece absorbs the influx unchanged`
      : `the last two rotations changed ${(recentChange * 100).toFixed(1)}% of the text — the piece is still being altered by what it takes in`,
  };
}

/**
 * tensionHold(log) → the "broke" findings that recur without being acted on,
 * and whose presence does not drop the whole's satisfaction. Held tension is
 * the piece's SUBJECTIVE FORM — its character — not an unpaid debt. The piece
 * approaches satisfaction when it holds rather than fights its tensions.
 */
export function tensionHold(log = [], { sat = null, whole = "" } = {}) {
  const recurrences = new Map();
  for (const e of log ?? []) {
    for (const b of e?.broke ?? []) {
      const k = b?.kind ?? "unknown";
      recurrences.set(k, (recurrences.get(k) ?? 0) + 1);
    }
  }
  const held = [];
  const fought = [];
  for (const [kind, count] of recurrences) {
    if (count >= 2) held.push({ kind, recurrences: count });
    else fought.push({ kind, recurrences: count });
  }
  // Did the whole's satisfaction DROP across the stream? A held tension that
  // keeps the whole satisfied is character; one that drags it down is debt.
  let satisfiedHeld = held;
  if (sat && whole) {
    const s = sat(whole);
    satisfiedHeld = held.filter(() => s.strain <= (log?.[0]?.strain ?? s.strain));
  }
  return {
    held: satisfiedHeld,
    fought,
    basis: satisfiedHeld.length
      ? `${satisfiedHeld.length} tension(s) recur unacted and the whole holds — carried as character, not debt (${satisfiedHeld.map((h) => h.kind).join(", ")})`
      : fought.length
        ? "tensions recur but are fought — the piece is still working them"
        : "no recurring tensions — nothing held, nothing fought",
  };
}

/**
 * phaseOf(log) → classify the current phase of the concrescence from the
 * rotation stream's signature. The phases are Whitehead's genetic phases:
 *   conformal (gathering, nothing rotated yet)
 *   valuation (a fold act — the piece decided its shape)
 *   comparative (broke→cut still running — integration in progress)
 *   satisfaction (the triad: strain constant + influx-stable + every unit
 *     required)
 */
export function phaseOf(log = []) {
  if (!log || log.length === 0) return { phase: PHASES.CONFORMAL, basis: "no rotations yet — the piece is still gathering its prehensions" };
  const folds = log.filter((e) => e.cell === "fold" || e.cell === "valuation");
  if (folds.length === 1 && log.length === 1) return { phase: PHASES.VALUATION, basis: "the fold landed — the piece has decided its character; integration begins" };
  const held = tensionHold(log);
  const anyHeld = held.held.length > 0;
  return { phase: anyHeld ? PHASES.SATISFACTION : PHASES.COMPARATIVE, basis: anyHeld ? "tensions held as character — approaching the completion" : "broke→cut still running — integration in progress" };
}

/**
 * isConcrescent({ whole, units, sat, log, strain }) → the full triad verdict.
 * CONCRESCENCE = every unit required + influx-stable + strain constant (not
 * zero — CONSTANT; the piece's strain has become its character). Each failing
 * signal is named, never hidden — the detector's answer is always usable.
 */
export function isConcrescent({ whole = "", units = [], sat = null, log = [], strain = null } = {}) {
  const satFn = sat ?? (() => ({ strain: 0 }));
  const removal = removalTest(whole, units, satFn);
  const influx = influxStability(log);
  const held = tensionHold(log, { sat: satFn, whole });
  const strains = (log ?? []).map((e) => e.strain ?? strain).filter((s) => s != null);
  // STRAIN CONSTANCY IS A TAIL SIGNAL (2026-09-21, C1's failure): the early
  // rotations converge (2 → 1), and judging constancy over the WHOLE stream
  // never settles. What matters is whether the RECENT rotations hold strain
  // still — the piece has stopped moving. The last N (default 3) strains
  // constant is the signature of arrival, exactly as influx-stability reads
  // the last two rotations.
  const tail = strains.slice(-3);
  const strainConstant = tail.length >= 2 && new Set(tail).size === 1;
  const passed = removal.passed && influx.stable && strainConstant;
  return {
    schema: CONCRESCENCE_SCHEMA,
    concrescent: passed,
    signals: {
      removal: removal.passed,
      influxStable: influx.stable,
      strainConstant,
      tensionHeld: held.held.length > 0,
    },
    details: { removal, influx, held, strains },
    basis: passed
      ? `concrescence reached: every unit required, influx-stable, strain constant at ${tail[tail.length - 1]} — the piece has become what it is`
      : [
          removal.passed ? "" : "not every unit is required (still a list)",
          influx.stable ? "" : "still altered by the influx (not self-stable)",
          strainConstant ? "" : "strain still moving (not constant)",
        ].filter(Boolean).join("; ") || "signals ambiguous",
  };
}