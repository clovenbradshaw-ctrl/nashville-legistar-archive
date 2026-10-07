// aperture.js — System 1's own ground, measured. Pure.
//
// fold.js already splits a turn into two kinds of record and says why: S1
// (the running summary) is a paraphrase, associative and lossy on purpose,
// with no address; S2 (the warrant record) keeps the address and can be
// re-opened. What neither one has ever measured is the THIRD thing the
// engine's own canon already names for exactly this shape.
//
// `eoreader6.1/nul/index.js` is not a metaphor here — it is the literal
// module this file leans on, and its own header states the vocabulary
// first: "figure — difference from its own ground; pattern — the
// difference that figure made to the next ground." Pattern is Bateson's, a
// difference that makes a difference, and `nul.pattern()`'s `opened` field
// already carries the sign this file's name borrows: "a difference that
// narrows the ground is still a pattern, and it is extraction. Only
// widening is encounter." That function is real, tested, and measured
// against its own false-positive rate (nul/index.js, `pattern()`'s own
// docstring) — this file does not reimplement it.
//
// What this file DOES do is give S1 the Ground+Figure half of that triad,
// using the organ already licensed for exactly this shape: reflex.js wires
// eoreader6's emergence/tiers.js (createTierStack/foldThrough, over
// surprise.js's bayesianSurprise and priorContinuationNull) to the SELF
// plane — the instrument's own acts. This module wires the SAME organ, the
// SAME declared numbers (SURPRISE_WINDOW/DRAWS/ALPHA/SEED — reflex.js names
// their givers; nothing here re-declares or re-tunes them), to the WORLD
// plane instead: the conversation's own discourse stream, which is exactly
// what S1's running summary is already a paraphrase of. One meter per
// conversation, held apart from reflex.js's self-ledger meter the same way
// reflex.js holds the self plane apart from material — a different stream
// through the same physiology, never the same instance.
//
// WHAT THIS FILE DOES NOT DO, disclosed rather than implied. tiers.js's own
// header says it outright: a shift here "has a ground (the continuation
// null) and a figure (this movement's place against it) but NO PATTERN
// TERM — nothing asks whether the shift changed what the tier does next.
// witness() is deliberately NOT called: it would refuse, and supplying a
// third term it did not measure is the confabulation the gate exists to
// prevent." This file does not manufacture one either. `apertureDelta` and
// `apertureDirection` below are a DIRECT, un-nulled Shannon-entropy reading
// of the discourse tier's own decayed prior (a textbook width-of-belief
// measure, not a hand-picked threshold) — disclosed as exactly that, never
// dressed up as `nul.pattern()`'s null-corrected `opened` sign. A real
// `opened` for S1 would mean reframing this entropy series as a numeric
// series and running it through `nul.ground()`/`nul.pattern()` (licensed
// pair: windowMean/shuffle) so the sign gets the same reseed-noise null
// `opened` already earned there — named here as the next step, not taken.
// The engine's third use of the same operation, `level()` (one figure
// measured against another figure's ground), is also unconnected to S1 —
// that is the shape of cross-turn/cross-source corroboration, not built
// here, and separate again from cast.js's own referent-identity machinery,
// which answers a different question ("is this the same name") than
// `level()` does ("does this ground constrain more than that one").

import { truncate } from "./fold.js";
import { tokenize } from "../organs/source.js";
import {
  SELF_TIERS,
  SURPRISE_ALPHA,
  SURPRISE_DRAWS,
  SURPRISE_SEED,
  SURPRISE_WINDOW,
} from "./reflex.js";

// Re-exported so a caller never has to reach into reflex.js to find the
// numbers this module also runs on — one set of givers, read from where
// they are declared, not copied.
export { SURPRISE_ALPHA, SURPRISE_DRAWS, SURPRISE_SEED, SURPRISE_WINDOW };

const countsOf = (tokens) => {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};

/** Natural-frequency phrasing, identical wording to reflex.js's own —
 * mirrored rather than imported, since reflex.js's helpers are private to
 * the self plane's module and this is the world plane's own meter. */
function standingOf(r) {
  if (r.censored === "above") return `beyond all ${SURPRISE_DRAWS} continuations of its own prior`;
  if (r.censored === "below") return `below every one of ${SURPRISE_DRAWS} continuations — steadier than carrying on`;
  if (r.rank != null) return `${Math.round(r.rank * SURPRISE_DRAWS)} of ${SURPRISE_DRAWS} continuations moved belief at least this far`;
  return null;
}

/**
 * Shannon entropy, in bits, of a tier's own CURRENT decayed prior — the
 * same Map/total shape tiers.js's `observe()` already maintains and decays
 * every arrival. This is the room S1's ground currently holds: many forms
 * near-evenly weighted reads high, belief collapsed onto a few dominant
 * forms reads low. Direct and un-nulled — a width reading, not a placed
 * observation — so it is reported as `entropy`/`apertureDelta`, never as
 * `rank` or `censored`, which stay reserved for what actually went through
 * the continuation-null gate.
 */
function shannonEntropyOf(tier) {
  if (!tier || !(tier.total > 0)) return null;
  let h = 0;
  for (const w of tier.prior.values()) {
    if (w <= 0) continue;
    const p = w / tier.total;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * The full internal state of every tier in the stack, at whatever point the
 * caller asks — not a per-arrival delta but a snapshot of what the ground
 * currently holds. Every field is read straight off the tier object
 * tiers.js already maintains; nothing here is computed beyond what
 * `shannonEntropyOf` already does for tier 0 in `observe`.
 *
 *   mass       tier.total — the decayed weight the ground currently carries.
 *   forms      distinct forms in tier.prior — vocabulary breadth, a
 *              different question from entropy (a wide, uneven vocabulary
 *              can still read low on entropy if one form dominates).
 *   novelRate  tiers.js's own running share of never-before-seen forms,
 *              decayed at the tier's own gamma (tiers.js: "measured from
 *              this tier's own past, never this arrival's own novelty").
 *              THIS is the direct answer to "how does learning more affect
 *              surprise": a tier whose novelRate is falling is one whose
 *              continuation null expects less novelty turn over turn — the
 *              ground is settling, not just being watched.
 *   shifts     count of this tier's own shiftRecords — arrivals that
 *              exceeded the continuation null (censored above), each one
 *              already carrying its own provenance (tiers.js: "a shift that
 *              cannot say what moved, when, and against what, is a number
 *              claiming to be testimony" — the records, not just the count,
 *              are on `tier.shiftRecords` for a caller that wants them).
 *   entropy    `shannonEntropyOf` at every altitude — the same reading
 *              `observe` reports per-arrival for tier 0, here for the whole
 *              ladder (a settled discourse under a still-moving atmosphere
 *              and vice versa are different states, distinguishable only if
 *              both are read).
 */
export function meterSnapshot(meter) {
  return meter.tiers.map((tier) => {
    const h = shannonEntropyOf(tier);
    return {
      name: tier.name,
      observations: tier.observations,
      mass: Number(tier.total.toFixed(3)),
      forms: tier.prior.size,
      novelRate: Number(tier.novelRate.toFixed(3)),
      shifts: tier.shifts,
      entropy: h != null ? Number(h.toFixed(3)) : null,
    };
  });
}

/**
 * `makeApertureMeter(organs)` → `{ create, observe }`. Same shape as
 * reflex.js's `makeReflexMeter`, same injected organs (createTierStack/
 * foldThrough from eoreader6 emergence/tiers.js — the page loads them from
 * /engine, the tests import the real module by relative path), so this
 * file stays pure and node-testable while sharing nothing at runtime with
 * the self-plane meter but the physiology.
 *
 * The stack reuses SELF_TIERS' three names (discourse/atmosphere/lens) —
 * not because the self plane and this one are the same ground, but because
 * "how far did this arrival reach" is the same question at either plane,
 * and a second vocabulary for the identical ladder would be a second name
 * for one thing.
 */
export function makeApertureMeter({ createTierStack, foldThrough }) {
  return {
    create() {
      return {
        tiers: createTierStack([...SELF_TIERS], {
          window: SURPRISE_WINDOW,
          draws: SURPRISE_DRAWS,
          seed: SURPRISE_SEED,
        }),
        /** Every arrival's measurement, in order. Append-only. */
        observations: [],
      };
    },

    /** One message the CONVERSATION contributed = one arrival — the same
     * unit fold.js's own turn fold is built from (a turn is a question and
     * an answer, folded together; this observes each half separately, the
     * way reflex.js observes both roles of an exchange). */
    observe(meter, { turn, role, text }) {
      const arrival = countsOf(tokenize(text));
      const seq = meter.observations.length;
      const prev = meter.observations[meter.observations.length - 1] ?? null;
      let obs;
      if (arrival.size === 0) {
        obs = {
          seq, turn, role,
          gist: truncate(text, 100),
          bits: null, rank: null, censored: null, standing: null, top: null,
          entropy: prev?.entropy ?? null, apertureDelta: null, apertureDirection: null,
          gap: "empty_arrival — nothing tokenizable arrived",
        };
      } else {
        const r = foldThrough(meter.tiers, arrival, { alpha: SURPRISE_ALPHA });
        const t0 = r.results[0];
        const tier0 = meter.tiers[0];
        const entropy = shannonEntropyOf(tier0);
        const prevEntropy = prev?.entropy ?? null;
        const apertureDelta =
          entropy != null && prevEntropy != null ? Number((entropy - prevEntropy).toFixed(3)) : null;
        obs = {
          seq,
          turn,
          role,
          gist: truncate(text, 100),
          bits: t0.surprise != null ? Number(t0.surprise.toFixed(3)) : null,
          rank: t0.rank ?? null,
          censored: t0.censored ?? null,
          standing: standingOf(t0),
          top: r.top,
          entropy: entropy != null ? Number(entropy.toFixed(3)) : null,
          apertureDelta,
          // A direct reading, not `nul.pattern()`'s null-tested `opened` —
          // see this file's header. Zero reads as no sign sayable, the
          // same three-valued discipline `opened` itself uses.
          apertureDirection: apertureDelta > 0 ? "widening" : apertureDelta < 0 ? "narrowing" : null,
          // The learning state the arrival left behind, read off the tier
          // tiers.js already maintains — how the ground is settling, on the
          // same row as how far this arrival moved it. novelRate falling
          // while bits fall is learning; bits falling while novelRate holds
          // is the material going quiet — the two causes the stateless
          // engine could never tell apart, on one row.
          novelRate: Number(tier0.novelRate.toFixed(3)),
          mass: Number(tier0.total.toFixed(3)),
          forms: tier0.prior.size,
          gap: t0.gap ? `${t0.gap.gap ?? t0.gap}${t0.gap.detail?.reason ? ` — ${t0.gap.detail.reason}` : ""}` : null,
        };
      }
      obs = Object.freeze(obs);
      meter.observations.push(obs);
      return obs;
    },
  };
}

/**
 * Did this arrival land on the ordinary half of what its own continuation
 * null could have produced?
 *
 * `censored: "below"` is stronger than ordinary — outside the WHOLE
 * support, stiller than every one of the null's own draws — and holds.
 * `censored: "above"` is a shift and refuses outright: the movement beat
 * every continuation the prior could produce. Otherwise the arrival was
 * PLACED, at `rank` — the fraction of the null's own KL draws that were AT
 * LEAST this large (nul/index.js::difference, which tiers.js's gate calls
 * directly) — and `rank > 0.5` asks the one question a placed rank can
 * answer without picking a cut: did MORE than half the null's own
 * continuations move belief at least this far? That is the null's OWN
 * median, not a value chosen by checking what it does to any one run.
 *
 * WHY THE FIRST VERSION OF THIS FUNCTION IS GONE. It gated on
 * `censored !== "above"` alone — every placed rank counted as "held",
 * because on the reachability fixture (hand-repeated sentences,
 * scratchpad, 2026-08-17) that read fine: a repeat's KL never came close
 * to the null's maximum. Run against a REAL model's own answers
 * (eval/summary-refresh-gate-eval.mjs, qwen2.5:14b) it was measurably
 * unsafe: a real model paraphrases even when repeating itself, so the
 * null's own support widened enough that a genuine topic pivot — "now,
 * completely separately, volcanic soil chemistry in Iceland" — placed at
 * rank 0.01 on BOTH arrivals (99th percentile of surprise; SEED.md's own
 * "censored above" bar is the single most extreme of 200 draws, and this
 * fell just inside it) instead of exceeding the support outright. Gating
 * on `censored` alone held through the pivot; the gated summary's topic
 * stayed "Harbor Traffic in Spring" for the rest of the run while the
 * conversation had moved to crops in volcanic soil — a real correctness
 * defect, caught by running a live turn rather than a synthetic fixture
 * (the same lesson eoreader6.1's own CLAUDE.md names the network golden
 * for: search AND run before trusting a gate). `rank > 0.5` catches
 * exactly this arrival (0.01 « 0.5) while still holding the six settled
 * exchanges around it — re-measured after the fix, same eval script.
 *
 * A gap REFUSES rather than supports: an arrival that could not be
 * measured (first ground, empty arrival, degenerate null) is "withheld",
 * never "nothing moved" — the same line the grounding ladder holds
 * elsewhere (a checking organ may say "I have nothing to compare this
 * against" or "I compared it and it failed", never manufacture the second
 * out of the first).
 */
// ── the regime: surprise as posture, consumed, never displayed ──────────────
//
// The gate above answers a yes/no question once, at refresh time, and
// nothing about it persists. What follows lives ACROSS turns as a standing
// state the reader is currently IN — the shape surprise has in a nervous
// system. A startle does not get logged by an organism; it RECONFIGURES
// the organism: attention narrows onto what caused it, sampling density
// rises, the horizon shortens, and "time dilates" because the grain got
// finer — more moments individuated per unit of material — never because
// the clock changed. Then it RELEASES: the posture relaxes back to
// baseline, and sustained arousal without release is a diagnosis, not a
// mode. So the regime here is a number the turn loop CONSUMES as changed
// behavior and no surface ever renders — a reader's stance is something
// it is in, not something it reports (user direction, 2026-08-17: the
// system registers surprise to itself, "not in just like a number, never
// show it metrics of its own self state").
//
// The knob this pass turns: the reach of the present. fold.js's
// RECENCY_WINDOW is how many raw, unfolded messages the next prompt still
// carries verbatim. Under startle the present CONTRACTS toward the
// exchange that startled it — the surprising exchange stays raw and
// whole while the settled turns before it (already safely folded into
// S1) drop out of the raw slice sooner. Not widened: the first draft of
// this block widened the window under surprise, and that reads the
// phenomenology backwards — a startled reader is not reaching further
// back, it is narrowing onto now. Knobs the same regime should turn and
// this pass does not: finer record grain on a startled turn (sub-turn
// atoms instead of one turn-level record), a tightened retrieval pool,
// a raised correction budget — named in CLAUDE.md as open work, not
// implied here.

function arrivalSurprise(o) {
  if (!o || o.gap) return 0;
  if (o.censored === "above") return 1;
  if (o.censored === "below") return 0;
  return o.rank != null ? 1 - o.rank : 0;
}

/**
 * How surprised was this exchange, on a continuous 0..1 reading — the
 * analogue counterpart to `exchangeHeldGround`'s binary verdict, built
 * from the same ingredients (`rank`, `censored`). 1 is the ceiling this
 * resolution can name (censored above — "outside the whole support" is
 * not itself a percentile); a placed arrival reads `1 - rank`, so the
 * null's own median (rank 0.5) reads exactly 0.5 and the scale is
 * continuous through the gate's own cut rather than jumping at it. The
 * MAX of the exchange's arrivals, not their mean: attention narrows onto
 * whichever half of the exchange was sharpest, not the exchange's
 * average.
 */
export function exchangeSurprise(arrivals) {
  if (!Array.isArray(arrivals) || arrivals.length === 0) return 0;
  return Math.max(...arrivals.map(arrivalSurprise));
}

/**
 * Advance the standing regime by one exchange: this exchange's own
 * surprise sets the floor, and whatever was already standing decays
 * toward zero at the tier's own `gamma` — the identical rate the belief
 * prior itself forgets at (tiers.js: `gammaFor(window) = 1 - 1/window`),
 * so posture and belief relax on one clock, never a second number
 * declared for this purpose alone. `tier` is `meter.tiers[0]` — the
 * discourse tier's own live gamma, read, not re-derived. The release is
 * this decay: a reader whose regime never falls is one being startled
 * every turn, which the value then honestly says.
 */
export function regimeAfter(prevRegime, arrivals, tier) {
  const now = exchangeSurprise(arrivals);
  const carried = (prevRegime ?? 0) * (tier?.gamma ?? 0);
  return Math.max(now, carried);
}

/**
 * The regime read as the present's reach, in messages. At 0 the present
 * is fold.js's own declared baseline, untouched. At 1 — an arrival that
 * just beat every one of its continuation null's draws — it contracts to
 * ONE exchange: the two messages of the startling exchange itself, the
 * same unit the fold already counts a turn as. The floor is structural
 * (the exchange that caused the startle is what attention narrowed onto,
 * so it is the one thing that must survive raw), the ceiling is the
 * declared constant, and between them is linear because any curve would
 * be a shape picked by hand. Rounded — a message slice has no
 * fractional unit.
 */
export function presentWindow(regime, baseWindow) {
  const r = Math.min(1, Math.max(0, regime ?? 0));
  return Math.max(2, Math.round(baseWindow - (baseWindow - 2) * r));
}

function arrivalHeld(o) {
  if (!o || o.gap) return false;
  if (o.censored === "above") return false;
  if (o.censored === "below") return true;
  return o.rank != null && o.rank > 0.5;
}

/**
 * Did the WHOLE exchange (every arrival — both roles, in fold.js's own
 * turn unit) hold the ground still? What this licenses the caller to skip
 * is exactly the work whose whole job is recording movement — the summary
 * refresh is S1's state transition, and an exchange measured to have moved
 * nothing has nothing for it to record. The fold LINE still lands (the
 * folds list is append-only bookkeeping, not a measurement), so a deferred
 * refresh sees every held turn's line when the ground next moves; nothing
 * is lost, only not rewritten.
 */
export function exchangeHeldGround(arrivals) {
  if (!Array.isArray(arrivals) || arrivals.length === 0) return false;
  return arrivals.every(arrivalHeld);
}

// There is deliberately NO phrasing/rendering helper in this module. An
// earlier draft exported `apertureLine` ("5.8 bits of ground · widening")
// as a future disclosure surface; it was removed by user direction
// (2026-08-17): the system registers surprise TO ITSELF and consumes it
// as posture — "never show it metrics of its own self state." The meter's
// numbers stay readable in code (observations, meterSnapshot) for organs
// and evals; no surface draws them.
