// spiral-contract.js — THE LAYERS OF THE SPIRAL, HYPER-DEFINED (2026-09-21,
// the user's law: "it will be most stable when the different layers of the
// spiral are hyper defined, with explicit, revisable work product at each
// loop. low sets possibility for high. high probability for low.")
//
// Before this module the spiral ran ONCE, in a line: wide draft → fold →
// tighten → detect, and the detector's verdict ("still a list", "strain still
// moving") was written to the ledger and the run ended. A failing signal
// never became a revision. That is how "The tension [gap] (empty)" shipped in
// a finished essay. A spiral with no re-entry is a line.
//
// The contract: every layer produces ONE typed work product, and every
// product faces TWO gates.
//
//   THE LOW GATE sets possibility. It asks only "is there anything here for
//   the next layer to work on?" A product that fails it is not revised — the
//   layer has nothing, and says so.
//
//   THE HIGH GATE sets probability. It asks "is this product good enough for
//   the next layer to ACT on?" A product that fails it is NOT discarded: the
//   gate names the missing signal, and that signal is a REVISION the same
//   layer can run, bounded by a budget. The revised product supersedes the
//   old one on the ledger; the old one is kept as history. Revision is the
//   loop; the budget is what makes it a spiral rather than a circle.
//
// Nothing in a gate is a hand-set threshold. A gate reads MEASURED quantities
// (native/the-fold/admission.js: the material's own variance, the bond two
// arbitrary passages of it already share) or STRUCTURAL facts (a beat is
// empty; a section has no sentence that turned). The only numbers here are
// BUDGETS — how many revisions a layer may spend — and a budget is a cost,
// not a judgment.
//
// Nothing here is essay-shaped. A story's beats, a spec's sections, a
// letter's paragraphs run the same contract: the caller supplies the shape.
//
// PURE. Every gate is a function of a product and a context; every verdict
// carries its basis; nothing here draws from a model or writes a file.

import { bond, claimCore, wordTokens, segmentSentences } from "./admission.js";

export const SPIRAL_CONTRACT_SCHEMA = "EOSpiralContract@1";

/** The layers, in order. Each names its product's ledger role. */
export const LAYERS = Object.freeze([
  { name: "ground", role: "ground",  product: "the material, measured: variance, bond null, which referent gate applies" },
  { name: "plan",   role: "plan",    product: "the sections to write, each with the ground window it may draw from" },
  { name: "draft",  role: "part",    product: "one section's admitted sentences, each with the road it took and every refusal" },
  { name: "fold",   role: "fold",    product: "the draft valued into the asked shape: beats, gaps named" },
  { name: "tighten",role: "tighten", product: "the beats with decoration cut, each cut's lineage recorded" },
  { name: "arrive", role: "concrescence", product: "the verdict, naming the missing signal when there is one" },
]);

const verdict = (pass, basis, extra = {}) => ({ pass: !!pass, basis: String(basis ?? ""), ...extra });

// ── L1 GROUND ──────────────────────────────────────────────────────────────
export const groundGate = {
  low(product) {
    const n = product?.sentences ?? 0;
    return verdict(n >= 3, n >= 3 ? `${n} ground sentences — something to measure` : `${n} ground sentence(s): nothing to measure a null on`);
  },
  high(product) {
    const pairs = product?.bondNull?.pairs ?? 0;
    return verdict(pairs > 0, pairs > 0 ? `bond null measured over ${pairs} pairs` : "no bond null — a continuation cannot be told from chance", { missing: pairs > 0 ? null : "ground" });
  },
};

// ── L2 PLAN ────────────────────────────────────────────────────────────────
export const planGate = {
  low(product) {
    const n = product?.sections?.length ?? 0;
    return verdict(n >= 1, n >= 1 ? `${n} section(s) planned` : "no sections — nothing to draw");
  },
  /** Every section must have ground to draw from. A section with none is not
   * refused: it is DECLARED a void, kept on the plan as a named gap, and never
   * sent to the mouth — the mouth writing on nothing is where invention
   * starts. */
  high(product) {
    const secs = product?.sections ?? [];
    const dark = secs.filter((s) => !String(s.window ?? "").trim());
    return verdict(dark.length === 0,
      dark.length === 0 ? "every section has a ground window" : `${dark.length} section(s) have no ground — declared void, not drawn`,
      { missing: dark.length ? "window" : null, voids: dark.map((s) => s.title ?? s.question ?? "") });
  },
};

// ── L3 DRAFT (one section) ─────────────────────────────────────────────────
export const draftGate = {
  low(product) {
    const n = product?.survivors?.length ?? 0;
    return verdict(n >= 1, n >= 1 ? `${n} sentence(s) survived admission` : `nothing survived: ${[...new Set((product?.refusals ?? []).map((r) => r.kind))].join(", ") || "no candidates"}`);
  },
  /** A section acts on the piece when it carries MATTER (something grounded
   * and new) and, unless it opens the piece, MOTION (a sentence that answered
   * where the piece just landed). Matter without motion is a list entry;
   * motion without matter is drift. The missing road is the revision. */
  high(product, { isOpening = false } = {}) {
    // A sentence on the "both" road counts on BOTH — it asserted something
    // grounded and it answered where the piece had landed.
    const roads = product?.roads ?? [];
    const matter = roads.filter((r) => r === "matter" || r === "both").length;
    const motion = roads.filter((r) => r === "motion" || r === "both").length;
    if (!matter) return verdict(false, "no matter: nothing grounded and new — the section asserts nothing", { missing: "matter", matter, motion });
    if (!isOpening && !motion) return verdict(false, "no motion: no sentence answered the prior landing — a fresh topic, not a turn", { missing: "motion", matter, motion });
    return verdict(true, `matter ${matter}, motion ${motion}`, { missing: null, matter, motion });
  },
  /** The revision the high gate licenses: what the redraw must open on. A
   * missing MOTION redraw opens on the prior landing alone (no window — the
   * window is where the mouth finds fresh topics to re-assert). A missing
   * MATTER redraw opens on the window alone. */
  revise(product, gate) {
    if (!gate || gate.pass) return null;
    return gate.missing === "motion"
      ? { kind: "redraw", open: "prior-landing", drop: "window", basis: gate.basis }
      : { kind: "redraw", open: "window", drop: "prior-landing", basis: gate.basis };
  },
};

// ── L4 FOLD ────────────────────────────────────────────────────────────────
export const foldGate = {
  low(product) {
    const filled = (product?.beats ?? []).filter((b) => !b.gap && String(b.text ?? "").trim()).length;
    return verdict(filled >= 1, filled >= 1 ? `${filled} beat(s) filled` : "no beat filled — the fold has no shape to give");
  },
  /** A gap beat is the fold's own statement that the draft never reached that
   * part of the shape. It is not "(empty)" in a finished piece: it is the
   * NEXT SECTION TO DRAW, opening on the landing of the beat before it. */
  high(product) {
    const beats = product?.beats ?? [];
    const gaps = beats.map((b, i) => ({ ...b, index: i })).filter((b) => b.gap || !String(b.text ?? "").trim());
    return verdict(gaps.length === 0,
      gaps.length === 0 ? "every beat filled" : `${gaps.length} gap beat(s): ${gaps.map((g) => g.title).join(", ")}`,
      { missing: gaps.length ? "beat" : null, gaps: gaps.map((g) => ({ index: g.index, title: g.title })) });
  },
  revise(product, gate) {
    if (!gate || gate.pass) return null;
    const beats = product?.beats ?? [];
    return gate.gaps.map((g) => {
      const prior = beats.slice(0, g.index).reverse().find((b) => !b.gap && String(b.text ?? "").trim());
      return { kind: "redraw", section: g.title, beatIndex: g.index, open: "prior-landing", priorLanding: prior ? lastSentence(prior.text) : "", basis: `gap beat "${g.title}"` };
    });
  },
};

// ── L5 TIGHTEN ─────────────────────────────────────────────────────────────
/**
 * measuredInflation(text, ground, variance) → the words of `text` that are
 * DECORATION: absent from the ground, and removable without changing the
 * sentence's claim. No list of English intensifiers. A word is inflation in
 * THIS piece over THIS material when the material never said it and the
 * claim survives its removal — which is exactly what "vital", "bustling" and
 * "myriad" do in any language, and what a content word never does.
 */
export function measuredInflation(text, ground, variance, locale) {
  // The claim is the sentence's GROUNDED words — the ones the material also
  // says. A word the material never said cannot be part of a claim about it;
  // it is either an invented referent (the name gate's business) or
  // decoration. Decoration is what remains when the grounded claim is
  // unchanged by the word's absence — which for an ungrounded word is
  // always, unless the word is a number or a name-length token the ground
  // has no way to hold. So: an ungrounded, non-numeric word of three or more
  // characters, in a sentence that still carries at least one grounded claim
  // word without it. The sentence's claim is measured, not the word's class.
  const known = new Set(wordTokens(ground, locale));
  const v = variance instanceof Set ? variance : new Set();
  const out = [];
  for (const sentence of segmentSentences(text, locale)) {
    const toks = wordTokens(sentence, locale);
    const groundedClaim = toks.filter((w) => known.has(w) && !v.has(w));
    if (!groundedClaim.length) continue;
    for (const w of new Set(toks)) {
      // No length guard: a Chinese word is one or two characters, and a
      // character-count cut is a Latin threshold in disguise.
      if (known.has(w) || /^[\p{N}.,]+$/u.test(w)) continue;
      out.push({ word: w, sentence: sentence.slice(0, 80) });
    }
  }
  return out;
}

export const tightenGate = {
  low(product) {
    const n = (product?.beats ?? []).filter((t) => String(t ?? "").trim()).length;
    return verdict(n >= 1, n >= 1 ? `${n} beat(s) after tightening` : "tightening emptied the piece");
  },
  /** A cut must not take the matter or the motion with it. Each tightened
   * beat is re-read against the draft gate; a beat the cut broke reverts to
   * its pre-cut text — the cut is the revision that failed, and reverting is
   * the recorded act. */
  high(product, { before = [], ground = "", variance = null, bondNull = null, locale } = {}) {
    const beats = product?.beats ?? [];
    const broken = [];
    for (let i = 0; i < beats.length; i++) {
      const prev = i > 0 ? beats[i - 1] : "";
      const a = prev ? bond(beats[i], prev, locale, variance) : null;
      const b = prev && before[i - 1] ? bond(before[i] ?? "", before[i - 1], locale, variance) : null;
      // The cut broke the link to the prior beat: the bond that cleared the
      // null before the cut no longer does.
      if (a != null && b != null && bondNull && b > bondNull.max && a <= bondNull.max) broken.push(i);
      if (!String(beats[i] ?? "").trim() && String(before[i] ?? "").trim()) broken.push(i);
    }
    const uniq = [...new Set(broken)];
    return verdict(uniq.length === 0, uniq.length === 0 ? "no cut broke a beat's matter or motion" : `${uniq.length} cut(s) broke a beat — revert: ${uniq.join(", ")}`, { missing: uniq.length ? "revert" : null, broken: uniq });
  },
  revise(product, gate, { before = [] } = {}) {
    if (!gate || gate.pass) return null;
    return gate.broken.map((i) => ({ kind: "revert", beatIndex: i, text: before[i] ?? "", basis: "the cut broke this beat" }));
  },
};

// ── L6 ARRIVE ──────────────────────────────────────────────────────────────
/**
 * chainStrain(beats, { variance, bondNull }) → a MEASURED satisfaction for the
 * concrescence detector's removal test. Strain is the number of adjacent
 * beat pairs whose bond does not clear the material's null — the broken links
 * in the chain. Remove a beat the chain needs and its neighbours, which
 * bonded through it, now face each other directly and fail: strain rises.
 * Remove a beat nothing needed and strain holds. That is Whitehead's removal
 * test with a quantity behind it — the old satisfaction ("strain 1 if over 25
 * words") could not move when a beat was removed, so the detector reported
 * "still a list" on every piece longer than a sentence, forever.
 */
export function chainStrain(beats, { variance = null, bondNull = null, locale } = {}) {
  const units = (Array.isArray(beats) ? beats : String(beats ?? "").split("\n\n")).map((b) => String(b ?? "").trim()).filter(Boolean);
  if (units.length < 2) return { strain: 0, links: 0, broken: [] };
  const ceiling = bondNull?.max ?? 0;
  const broken = [];
  for (let i = 1; i < units.length; i++) {
    if (bond(units[i], units[i - 1], locale, variance) <= ceiling) broken.push(i);
  }
  return { strain: broken.length, links: units.length - 1, broken };
}

export const arriveGate = {
  low(product) {
    return verdict(product?.signals != null, product?.signals != null ? "a verdict was reached" : "no verdict");
  },
  high(product) {
    const s = product?.signals ?? {};
    const missing = Object.entries(s).filter(([k, v]) => k !== "tensionHeld" && !v).map(([k]) => k);
    return verdict(!!product?.concrescent, product?.concrescent ? "arrived" : `missing: ${missing.join(", ") || "unknown"}`, { missing: missing[0] ?? null, missingAll: missing });
  },
};

// ── the loop ───────────────────────────────────────────────────────────────
/**
 * runLayer({ gate, product, ctx, revise, budget }) → the product after the
 * loop, with its record. The low gate is asked once: fail, and the layer has
 * nothing (recorded, returned). The high gate is asked, and while it fails
 * and budget remains, `revise(instruction)` is called to produce the next
 * product — the caller's act (a redraw, a revert), never this module's. Every
 * attempt is on the record with the gate's basis; the returned product is the
 * last one, and `record.exhausted` says whether the budget ran out before the
 * high gate passed. Budget is a COST the caller sets, never a judgment.
 */
export async function runLayer({ name, gate, product, ctx = {}, revise = null, budget = 0 } = {}) {
  const record = { layer: name, attempts: [], exhausted: false, low: null };
  const low = gate.low(product, ctx);
  record.low = low;
  if (!low.pass) return { product, record, pass: false, stage: "low" };
  let cur = product;
  let spent = 0;
  for (;;) {
    const high = gate.high(cur, ctx);
    record.attempts.push({ n: spent, pass: high.pass, basis: high.basis, missing: high.missing ?? null });
    if (high.pass) return { product: cur, record, pass: true, stage: "high" };
    const instruction = typeof gate.revise === "function" ? gate.revise(cur, high, ctx) : null;
    if (!instruction || typeof revise !== "function" || spent >= budget) {
      record.exhausted = spent >= budget && !!instruction;
      return { product: cur, record, pass: false, stage: "high", missing: high.missing ?? null, instruction };
    }
    spent++;
    const next = await revise(instruction, cur, high);
    if (!next) { record.exhausted = true; return { product: cur, record, pass: false, stage: "high", missing: high.missing ?? null, instruction }; }
    cur = next;
  }
}

export function lastSentence(text, locale) {
  const s = segmentSentences(text, locale);
  return s.length ? s[s.length - 1] : String(text ?? "").trim();
}
