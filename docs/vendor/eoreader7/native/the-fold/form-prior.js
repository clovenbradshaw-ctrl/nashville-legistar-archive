// form-prior.js — A FORM LEARNED AS A PERSON LEARNS ONE: BY EXPECTATION,
// ONE INSTANCE AT A TIME, UNTIL ONE MORE STOPS MOVING THE HOLOGRAPH
// (2026-09-22).
//
// The user: "we've lost the idea of using bayesian surprise and activation
// … that's the key" — and "we need the bayesian surprise as the delta to the
// holograph." paradigm.js learns a form by CONTRAST (what separates the
// instances from everything else). A reader learns it by EXPECTATION: fifty
// limericks in, line 5's end word costs nothing, and a 13-line sonnet feels
// wrong before anyone counts. This module is that reader:
//
//   the prior      kernel/bayes-surprise.js — the holograph's Pattern grain,
//                  one slot per position fact (Vasana: impressions that
//                  condition later perception; Tala: the WHEN, the position)
//   the stream     instances admitted one at a time; each admission's
//                  SURPRISAL (how unexpected, Rubin) and BAYESIAN SURPRISE
//                  (how far it moved the prior, Itti & Baldi) recorded
//   the form       the slots that BECAME PREDICTABLE — more likely than not
//                  under the learned prior, and more predictable than the
//                  same instances with their element order destroyed (the
//                  null surprise-segments.js already uses: order destroyed)
//   learned at     the shallowest number of instances whose form is the form
//                  of all of them (kernel/activation.js dmdWindow's rule —
//                  the difference that makes a difference, applied to the
//                  definition): one more instance stopped changing it
//   the content    the slots that stay surprising — what the form leaves
//                  free for each instance to fill
//   the turn       Meyer: a slot the form predicts, where an instance still
//                  deviates — residual surprisal under the learned tendency
//
// Form versus content is never declared. No slot is written as "form" or
// "content"; what becomes predictable is the form, whatever it is.
//
// Slots (closed, per element position — the ruler, not the shape): its class,
// its marker kind, its syllable count, its closing punctuation, the earliest
// earlier position it rhymes with, the earliest earlier position whose end
// word it repeats, its first word, its last word; and per unit, its count.

import { elementsOf } from "./medium.js";
import { rhymes } from "./sound.js";
import { createHolograph, admit, modeOf, predict } from "../kernel/bayes-surprise.js";
import { contextualityOfSteps } from "../kernel/contextuality.js";

export const FORM_PRIOR_SCHEMA = "EOFormPrior@1";

const asElements = (u) => (Array.isArray(u?.elements) ? u.elements : elementsOf(typeof u === "string" ? u : u?.text ?? "").elements);

/** The slot facts of one instance. */
// Rhyme is the medium's (a cadence where it gives one), same as paradigm.js.
const rhymeOf = (a, b) => (a.cadence != null || b.cadence != null ? !!a.cadence && a.cadence === b.cadence : rhymes(a.last, b.last));
export function formFacts(u) {
  const E = asElements(u);
  // Positions are counted WITHIN a class: the k-th line, the k-th bar, the
  // k-th item — a tune's header fields vary in number, and bar 5 must mean
  // the fifth bar. Lines keep the bare "@k" (a poem is all lines, and every
  // earlier result reads the same); other classes are prefixed.
  const CONTENT = new Set(["line", "item", "bar"]);
  const content = E.filter((e) => CONTENT.has(e.cls));
  const f = new Map([["count", content.length]]);
  const byClass = new Map();
  for (const e of E) { if (!byClass.has(e.cls)) byClass.set(e.cls, []); byClass.get(e.cls).push(e); }
  for (const [cls, list] of byClass) {
    if (cls === "field") continue;
    const at = (k) => (cls === "line" ? `@${k}` : `${cls}@${k}`);
    list.forEach((e, k) => {
      const earlier = (rel) => { for (let j = 0; j < k; j++) if (rel(list[j], e)) return at(j); return "none"; };
      f.set(`${at(k)}:marker`, e.markerKind ?? "-");
      f.set(`${at(k)}:syllables`, e.syllables);
      f.set(`${at(k)}:closes`, e.end || "none");
      f.set(`${at(k)}:rhymes-with`, earlier(rhymeOf));
      f.set(`${at(k)}:ends-as`, earlier((a, b) => !!a.last && a.last === b.last));
      f.set(`${at(k)}:same-as`, earlier((a, b) => !!a.text && a.text === b.text));
      f.set(`${at(k)}:first-word`, e.first || "-");
      f.set(`${at(k)}:last-word`, e.last || "-");
    });
  }
  // A header field's value (a tune's meter and key) is a role fact.
  for (const e of E.filter((x) => x.cls === "field" && x.key && !/^[TSXZN]$/.test(x.key))) f.set(`field:${e.key}`, String(e.text).toLowerCase().slice(0, 24));
  // ROLE, NOT POSITION, for forms whose length varies (a man page, a recipe):
  // what the unit HAS, set only when present — everything it lacks is the
  // holograph's ABSENT, the void as information (the user: "a void is one of
  // the most useful pieces of information, the most maybe") — and its k-th
  // heading's words, aligned by ordinal rather than by line number.
  for (const e of E) { f.set(`has:${e.cls}`, "yes"); if (e.markerKind) f.set(`has-marker:${e.markerKind}`, "yes"); if (e.cls === "heading" && e.caps) f.set("has:capitals-heading", "yes"); }
  E.filter((e) => e.cls === "heading").forEach((e, k) => f.set(`heading#${k + 1}`, e.text.toLowerCase().replace(/[^a-z ]/g, "").trim() || "-"));
  return f;
}
// ── EMERGENT SLOTS (2026-09-22). The user: "and the slots are self emergent?"
// Not yet, in the ruler above: its slot TYPES (marker, syllables, closes,
// rhymes-with, ends-as, same-as, first-word, last-word) are a list someone
// wrote. Here they are GENERATED from whatever attributes the Ground reader
// (medium.js) actually puts on an element — its own keys, nested ones
// flattened, found on the element and never listed — crossed with three
// operators:
//   SIG  this attribute takes this value at this position
//   CON  this attribute EQUALS an earlier position's (rhyme, ends-as and
//        same-as all fall out: equality on the rhyme keys, the last word, the
//        whole text — and on anything else the medium carries)
//   SYN  this attribute is the SUCCESSOR of an earlier position's (numeric
//        attributes: labels counting up, a new block, dates in order)
// The one thing excluded is the element's own index (the position itself —
// tautological at a position). What is declared is the medium's grammar,
// nothing else. An element that carries a `key` (a header field) is
// addressed by its key rather than by its ordinal: a key is an address.
const flatAttrs = (e, prefix = "", out = new Map()) => {
  for (const [k, v] of Object.entries(e ?? {})) {
    if (!prefix && k === "i") continue;
    const name = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) flatAttrs(v, name, out);
    else if (["string", "number", "boolean"].includes(typeof v)) out.set(name, v);
  }
  return out;
};
// `positional` (2026-09-22, the OOM fix — see paradigm.js's
// detectParadigmPlurality, its only caller): the per-position loop below
// emits one fact per (position, attribute) — O(elements) facts — and, for
// CON/SYN (`:attr=`, `:attr+1`), re-scans every earlier position for the
// first equal/successor value, an O(elements^2) cost per class per
// attribute. For a short, fixed-shape unit (a sonnet's 14 lines) this is
// cheap and the position IS the signal — line 3 rhyming with line 1 is what
// a sonnet's rhyme scheme means — which is what learnForm/readStream/
// learnParadigmEmergent need, so their behavior is UNCHANGED (`positional`
// defaults true). For a real multi-thousand-line document self-clustered
// against OTHER documents (detectParadigmPlurality, entity-kind-induction.js's
// affinity-basin induction) an absolute line index is not a comparable
// address at all — two independently authored reports rarely say the same
// thing at line 3421 — and the induction's own admissibility gate
// (induceEntityParameters: memberCount >= 2) already discards essentially
// every one of these facts, since they almost never recur verbatim at the
// same position across differently-shaped documents. Measured directly on
// synthetic 2-8k-line documents: the per-position loop was the whole cost —
// the O(elements^2) scan (minutes at a few thousand elements) and the
// O(elements) fact volume that then gets tripled and quadrupled by
// downstream clustering structures (the flat evidence array, the
// entity-feature index, the structural-entity clone, the per-entity
// affinity profile) — OOMing a 6GB heap at ~100 real-sized instances.
// `positional: false` skips that loop and keeps only the position-
// independent facts (`count:cls`, `key:*`, and the lifted `cls*:attr`
// "every element of this class agrees/varies" facts): the only facts
// capable of recurring across multiple documents in the first place, so no
// signal the clustering could actually use is cut, only the volume that was
// never going to clear its own gate.
export function emergentFacts(u, { limit = null, positional = true } = {}) {
  const E = asElements(u);
  const f = new Map();
  const byClass = new Map();
  for (const e of E) {
    if (e.key) { for (const [a, v] of flatAttrs(e)) if (a !== "key" && a !== "cls" && a !== "block") f.set(`key:${e.key}.${a}`, typeof v === "string" ? v.toLowerCase().slice(0, 24) : v); continue; }
    if (!byClass.has(e.cls)) byClass.set(e.cls, []);
    byClass.get(e.cls).push(e);
  }
  for (const [cls, list] of byClass) {
    f.set(`count:${cls}`, list.length);
    const at = (k) => (cls === "line" ? `@${k}` : `${cls}@${k}`);
    const attrs = list.map((e) => flatAttrs(e));
    // COMPRESSION, LIFTED (2026-09-22): an attribute that takes ONE value at
    // every element of a class is a property of the whole ("every bar is 0.75
    // whole notes", "every line is unindented") — said once here, at the
    // Pattern grain, instead of once per position. Measured: without it a
    // sonnet's definition held hundreds of per-position facts repeating the
    // same thing. "varies" is itself a fact about the whole.
    if (list.length >= 2) for (const a of new Set(attrs.flatMap((m) => [...m.keys()]))) {
      if (a === "cls" || a === "text") continue;
      const vals = attrs.map((m) => m.get(a));
      f.set(`${cls}*:${a}`, vals.every((v) => v === vals[0]) ? (vals[0] === "" ? "-" : vals[0]) : "varies");
    }
    if (!positional) continue;
    list.forEach((e, k) => {
      if (limit?.get(cls) != null && k >= limit.get(cls)) return; // past the instances' median count: absence, not form
      for (const [a, v] of attrs[k]) {
        if (a === "cls") continue;
        f.set(`${at(k)}:${a}`, v === "" ? "-" : v);
        let eq = "none", sc = "none";
        for (let j = 0; j < k; j++) {
          const w = attrs[j].get(a);
          if (eq === "none" && v !== "" && v != null && w === v) eq = at(j);
          if (sc === "none" && typeof v === "number" && typeof w === "number" && v === w + 1) sc = at(j);
        }
        f.set(`${at(k)}:${a}=`, eq);
        if (typeof v === "number") f.set(`${at(k)}:${a}+1`, sc);
      }
    });
  }
  return f;
}

// ── necessaryFacts (2026-09-22) ─────────────────────────────────────────
// The user, having watched learnParadigmEmergent throw away a genuinely
// universal fact just because the comparison ground happened to share it
// sometimes: "what do all white papers have that other things may or may
// not have?" That is a DIFFERENT question from learnParadigmEmergent's own
// (support high AND contrast low — exclusive to the kind). This one asks
// only: is this reliably true of every instance of the kind, full stop —
// no ground required, because necessity is a property of the kind alone.
//
// "varies" (emergentFacts' own sentinel for "not constant across this
// class") is excluded — it is a null value, not a finding: every
// multi-line document's line lengths "vary," including a novel's.
//
// The null here needs no outside population either: it asks whether the
// observed support is a genuine property of the WHOLE corpus or an
// artifact of a handful of instances — split-half stability (does the
// same fact stay common in independent random halves of the corpus,
// draws times) rather than one hand-eyeballed support number on the full
// set. This is the same "Born null" discipline as everywhere else in this
// engine: measure a null, never assert from a raw threshold alone.
const VARIES = "varies";

export function necessaryFacts(instances, { minSupport = 0.8, draws = 200, stabilityFloor = 0.9, rnd = Math.random } = {}) {
  const n = instances.length;
  if (n < 5) return { refused: "under_powered", basis: `${n} instance(s) — too few to claim anything is necessary to the kind`, necessary: [] };
  const perInstance = instances.map((u) => emergentFacts(u, { positional: false }));
  const keys = new Set();
  for (const f of perInstance) for (const k of f.keys()) keys.add(k);
  const holds = (i, key, value) => { const f = perInstance[i]; return f.has(key) && String(f.get(key)) === value; };
  const candidates = [];
  for (const key of keys) {
    const valueCounts = new Map();
    for (const f of perInstance) {
      if (!f.has(key)) continue;
      const v = String(f.get(key));
      if (v === VARIES) continue;
      valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
    }
    for (const [value, count] of valueCounts) {
      const support = count / n;
      if (support >= minSupport) candidates.push({ key, value, support, count });
    }
  }
  const half = Math.floor(n / 2);
  for (const cand of candidates) {
    let survived = 0;
    const idx = [...Array(n).keys()];
    for (let d = 0; d < draws; d++) {
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      let c = 0;
      for (let i = 0; i < half; i++) if (holds(idx[i], cand.key, cand.value)) c++;
      if (c / half >= minSupport) survived++;
    }
    cand.stability = survived / draws;
  }
  const necessary = candidates.filter((c) => c.stability >= stabilityFloor).sort((a, b) => b.support - a.support || b.stability - a.stability);
  return {
    refused: null, n, necessary,
    basis: `${necessary.length} of ${candidates.length} candidate fact(s) (support >= ${Math.round(minSupport * 100)}%, "varies" excluded) held up in >= ${Math.round(stabilityFloor * 100)}% of ${draws} random half-splits of the ${n} real instance(s) — a within-kind necessity claim, no comparison ground involved`,
  };
}

/** Slots the order-destroyed null cannot touch: what a unit has, and its count. */
const ORDER_FREE = (slot) => slot === "count" || slot.startsWith("has") || slot.startsWith("field:") || slot.startsWith("count:") || slot.startsWith("key:") || slot.includes("*:");

let _seed = 1;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) % 2147483648; return _seed / 2147483648; };
const shuffled = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Does a learned form hold this slot = value, under any of its merged names? */
export function formHas(fp, slot, value) {
  return (fp.form ?? []).some((x) => (x.slot === slot && String(x.value) === String(value)) || (x.same ?? []).some((s) => s.slot === slot && String(s.value) === String(value)));
}

/** Run a stream through a fresh holograph: the per-instance trajectory. */
const factsFor = (slots, limit = null) => (slots === "emergent" ? (u) => emergentFacts(u, { limit }) : formFacts);
/** The median count of each class across the instances — the positions an
 *  expectation can align on; beyond it, most instances have ended. */
export function positionLimit(units) {
  const per = new Map();
  for (const u of units) { const c = new Map(); for (const e of asElements(u)) c.set(e.cls, (c.get(e.cls) ?? 0) + 1); for (const [k, n] of c) (per.get(k) ?? per.set(k, []).get(k)).push(n); }
  return new Map([...per].map(([k, xs]) => [k, [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]]));
}
export function readStream(units, { alpha = 1, gamma = 1, slots = "ruler", limit = null } = {}) {
  const holo = createHolograph({ alpha, gamma });
  const trajectory = units.map((u) => { const r = admit(holo, factsFor(slots, limit)(u)); return { surprisal: r.surprisal, bayes: r.bayes, perSlot: r.perSlot }; });
  return { holo, trajectory };
}

/** The slots more likely than not under a holograph (the high bar). */
const likely = (holo) => [...holo.slots.keys()].map((s) => ({ slot: s, ...modeOf(holo, s) })).filter((x) => x.p > 0.5);

/**
 * learnForm(units, { alpha, draws, seed }) → EOFormPrior@1
 * The form: slots whose mode is more likely than not AND whose mode's
 * probability beats every one of `draws` order-destroyed streams (the same
 * instances, each with its elements shuffled). `draws` defaults to the number
 * of slots tested, so the level is at most one false slot expected across
 * them all.
 */
export function learnForm(units, { alpha = 1, draws = null, seed = 7, slots = "ruler" } = {}) {
  const limit = slots === "emergent" ? positionLimit(units) : null;
  if (units.length < 5) return { schema: FORM_PRIOR_SCHEMA, refused: "under_powered", instances: units.length, form: [], basis: `${units.length} instance(s): below five nothing can become predictable` };
  const { holo, trajectory } = readStream(units, { alpha, slots, limit });
  // COMPRESSION BY IMPLICATION, before the order null (sound): a positional
  // fact about an attribute that is CONSTANT across its whole class in an
  // instance is implied by the lifted whole-class fact (emergentFacts, "*:")
  // — and shuffling positions cannot change it, so it could never beat the
  // null anyway. Dropped from the candidates it would only inflate (the level
  // and the null's draws). Measured first the unsound way: merging facts that
  // hold on the same instances before the null collapsed a limerick's whole
  // form into one untestable fact; facts identical on the instances can still
  // behave differently under the null.
  const factsList = units.map(factsFor(slots, limit));
  const baseOf = (slot) => { const m = slot.match(/^(?:([a-z]+)@|@)\d+:(.+?)(=|\+1)?$/); return m ? { cls: m[1] ?? "line", attr: m[2] } : null; };
  const implied = (c) => {
    if (slots !== "emergent") return false;
    const b = baseOf(c.slot); if (!b) return false;
    const lifted = `${b.cls}*:${b.attr}`;
    return factsList.every((fs) => String(fs.get(c.slot)) !== String(c.value) || (fs.has(lifted) && fs.get(lifted) !== "varies"));
  };
  const all = likely(holo).filter((c) => !ORDER_FREE(c.slot));
  const cands = all.filter((c) => !implied(c));
  const impliedCount = all.length - cands.length;

  const orderFree = likely(holo).filter((c) => ORDER_FREE(c.slot));
  const D = draws ?? Math.max(20, cands.length);
  _seed = seed;
  const nullBest = new Map(cands.map((c) => [c.slot, []]));
  for (let d = 0; d < D; d++) {
    const nh = readStream(units.map((u) => { const E = asElements(u); const content = shuffled(E.filter((e) => e.cls !== "field")); let k = 0; return { elements: E.map((e) => (e.cls === "field" ? e : content[k++])).map((e, i) => ({ ...e, i })) }; }), { alpha, slots, limit }).holo;
    for (const c of cands) nullBest.get(c.slot).push(modeOf(nh, c.slot)?.p ?? 0);
  }
  const form = cands.map((c) => {
    const nulls = nullBest.get(c.slot);
    const beaten = nulls.filter((p) => p >= c.p).length;
    return { ...c, nullMax: Math.max(...nulls), p0: (beaten + 1) / (D + 1) };
  }).filter((c) => c.p0 <= 1 / cands.length || (c.slot === "count" && c.p0 <= 1 / cands.length))
    .sort((a, b) => b.p - a.p);
  // Order-free slots (the count) are untouched by the order null: they pass
  // only by being more likely than not, and are marked as such.
  const countMode = modeOf(holo, "count");
  const count = countMode && countMode.p > 0.5 ? { slot: "count", ...countMode, orderFree: true } : null;
  // For the report only: facts at one position that hold on exactly the same
  // instances are one fact under several names (a line's rhyme tail, loose
  // key, last letters, last word) — shown once, the rest as `same`.
  {
    const pat = (c) => factsList.map((fs) => (String(fs.get(c.slot)) === String(c.value) ? "1" : "0")).join("");
    const seen = new Map(); const out = [];
    for (const c of form) { const k = `${c.slot.split(":")[0]}|${pat(c)}`; if (seen.has(k)) { (seen.get(k).same ??= []).push({ slot: c.slot, value: c.value }); continue; } seen.set(k, c); out.push(c); }
    form.length = 0; form.push(...out);
  }
  const formSlots = new Set(form.map((f) => f.slot).concat(form.flatMap((f) => (f.same ?? []).map((s) => s.slot))));
  // LEARNED AT: the shallowest prefix whose likely slots, restricted to the
  // form, are the form — one more instance stopped changing the definition.
  const defOf = (k) => { const h = readStream(units.slice(0, k), { alpha, slots, limit }).holo; return new Set(likely(h).filter((x) => formSlots.has(x.slot) && modeOf(holo, x.slot).value === x.value).map((x) => x.slot)); };
  let learnedAt = null;
  for (let k = 1; k <= units.length; k++) { const d = defOf(k); if (d.size === formSlots.size) { let stays = true; for (let k2 = k; k2 <= Math.min(units.length, k + 5); k2++) if (defOf(k2).size !== formSlots.size) { stays = false; break; } if (stays) { learnedAt = k; break; } } }
  // The content: slots that stay surprising — mean late surprisal highest.
  const late = trajectory.slice(Math.floor(trajectory.length / 2));
  const slotMean = new Map();
  for (const t of late) for (const [s, v] of Object.entries(t.perSlot)) { const a = slotMean.get(s) ?? [0, 0]; a[0] += v.surprisal; a[1]++; slotMean.set(s, a); }
  const content = [...slotMean].map(([s, [sum, n]]) => ({ slot: s, bits: sum / n })).filter((x) => !formSlots.has(x.slot) && !ORDER_FREE(x.slot)).sort((a, b) => b.bits - a.bits);
  // The delta, split: what each instance did to the FORM (the slots that
  // became predictable) and to the CONTENT (the rest). Only the first should
  // go to zero as the form is learned; content keeps moving the holograph by
  // its nature — each new end word rewrites its slot. (Measured on Lear:
  // the undivided total fell only 5.5 → 3.3 bits, because content dominated.)
  for (const t of trajectory) { t.bayesForm = 0; t.bayesContent = 0; for (const [sl, v] of Object.entries(t.perSlot)) { if (formSlots.has(sl) || sl === "count") t.bayesForm += v.bayes; else t.bayesContent += v.bayes; } }
  const tenth = Math.max(1, Math.floor(trajectory.length / 10));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const early = trajectory.slice(0, tenth).map((t) => t.bayes), tail = trajectory.slice(-tenth).map((t) => t.bayes);
  const earlyF = trajectory.slice(0, tenth).map((t) => t.bayesForm), tailF = trajectory.slice(-tenth).map((t) => t.bayesForm);
  const earlyC = trajectory.slice(0, tenth).map((t) => t.bayesContent), tailC = trajectory.slice(-tenth).map((t) => t.bayesContent);
  // CONTEXTUALITY (kernel/contextuality.js, 2026-09-25): bayes-surprise.js
  // holds the slots as independent, and says so. This asks whether that
  // simplification fails NON-classically on these instances — grouped by the
  // slot set each carries (the forms as contexts, the instances as their joint
  // sections): do the readings agree on every overlap and still admit no one
  // reading? Additive: reported beside the delta, changes nothing above.
  // The search budget is the organ's disclosed default; a spent budget lands
  // as its typed gap, never as a verdict.
  const contextuality = contextualityOfSteps(factsList);
  return {
    schema: FORM_PRIOR_SCHEMA, instances: units.length, alpha, draws: D, tested: cands.length, implied: impliedCount, slots, limit: limit ? Object.fromEntries(limit) : null,
    holo, trajectory, form, count, content, learnedAt, contextuality,
    // What every instance HAS (and so what the rest of a population would
    // have to lack): not testable against the order null, which cannot touch
    // it — its relative ground is the population (paradigm.js).
    orderFree,
    bayes: { first: mean(early), last: mean(tail), form: { first: mean(earlyF), last: mean(tailF) }, content: { first: mean(earlyC), last: mean(tailC) } },
    basis: `${units.length} instance(s) read one at a time; ${form.length} slot(s) became predictable beyond the order-destroyed null (${D} draws, level 1/${cands.length})${count ? `; ${count.value} element(s) in ${Math.round(count.p * 100)}%` : ""}; learned at instance ${learnedAt ?? "— (never settled)"}; Bayesian surprise per instance, to the form ${mean(earlyF).toFixed(2)} → ${mean(tailF).toFixed(2)} bits, to the content ${mean(earlyC).toFixed(1)} → ${mean(tailC).toFixed(1)} bits`,
  };
}

/**
 * turnOf(formPrior, unit) — Meyer: under the learned tendency, where does
 * this instance deviate? Each form slot's surprisal for this instance; the
 * slots it breaks (the form predicts a value, the instance gives another).
 */
export function turnOf(fp, unit) {
  const f = formFacts(unit);
  const breaks = [];
  for (const s of fp.form) {
    const v = f.get(s.slot);
    if (v == null) { breaks.push({ slot: s.slot, expected: s.value, got: "(absent)", bits: Infinity }); continue; }
    if (String(v) !== String(s.value)) breaks.push({ slot: s.slot, expected: s.value, got: String(v), bits: predict(fp.holo, s.slot, String(v)).bits });
  }
  return { breaks, held: fp.form.length - breaks.length, of: fp.form.length };
}

// ── KIND BOUNDARIES: A NEW KIND IS WHAT MOVES THE CURRENT GROUND MORE THAN
// ITS OWN MEMBERS DO (2026-09-22). The user: "be sure for each hunt it has a
// proper, relative ground to compare against." Measured first against the
// wrong ground — the whole stream shuffled, which mixes every kind everywhere
// and made a man page's hundreds of slots set the bar (cut ≈ 400 bits; no
// boundary found). The relative ground is the kind being read NOW: the
// `window` instances before a candidate boundary. Its score is the delta the
// instances AFTER it make to that ground's holograph, per fact, minus the
// delta the ground's own members make to it (each left out and re-admitted)
// — how much more the arrivals move the ground than the ground moves itself.
// The null is the scan's own maximum over permuted streams (the maximum, so
// the whole scan is one test): a boundary beats every permuted maximum.
// `window` is declared (kernel/activation.js: how wide the present is is the
// reader's to say) and stated in the result.

import { klAdmit, ABSENT } from "../kernel/bayes-surprise.js";

// A window's counts, absence included: a member lacking a slot another member
// has holds ABSENT there (kernel/bayes-surprise.js).
const countsOf = (factsList) => {
  const slots = new Set(factsList.flatMap((f) => [...f.keys()]));
  const m = new Map();
  for (const s of slots) { const x = new Map(); for (const f of factsList) { const k = f.has(s) ? String(f.get(s)) : ABSENT; x.set(k, (x.get(k) ?? 0) + 1); } m.set(s, x); }
  m.members = factsList.length;
  return m;
};
/** Bayesian surprise, bits per fact, of admitting `facts` to counts `C` (optionally with one member's own facts removed). */
function deltaPerFact(C, facts, alpha, without = null) {
  let bits = 0;
  const slots = new Set([...C.keys(), ...facts.keys()]);
  for (const s of slots) {
    const v = facts.has(s) ? String(facts.get(s)) : ABSENT;
    const m = C.get(s) ?? new Map([[ABSENT, C.members]]);
    const own = without ? (without.has(s) ? String(without.get(s)) : ABSENT) : null;
    const count = (k) => (m.get(k) ?? 0) - (k === own ? 1 : 0);
    // The support: the values held (less the member's own, when left out),
    // the one arriving, and the novel bucket — closed form, O(1) per slot.
    let N = 0, K = 1; // the novel bucket
    for (const [k, c0] of m) { const c = c0 - (k === own ? 1 : 0); if (c > 0 || k === v) { N += Math.max(0, c); K++; } }
    if (!m.has(v)) K++;
    bits += klAdmit(Math.max(0, count(v)) + alpha, N + alpha * K) / Math.LN2;
  }
  return bits / Math.max(1, slots.size);
}
function scan(F, window, alpha) {
  const score = new Array(F.length).fill(null);
  for (let t = window; t + window <= F.length; t++) {
    const pre = F.slice(t - window, t), C = countsOf(pre);
    const self = pre.reduce((a, f) => a + deltaPerFact(C, f, alpha, f), 0) / pre.length;
    const cross = F.slice(t, t + window).reduce((a, f) => a + deltaPerFact(C, f, alpha), 0) / window;
    score[t] = cross - self;
  }
  return score;
}

/**
 * kindBoundaries(stream, { window, draws, alpha, seed }) →
 *   { boundaries, score, cut, window, draws, basis }
 * A boundary at t: the score is a local maximum, beats the maximum score of
 * every one of `draws` permuted streams, and sits at least `window` from the
 * last boundary.
 */
export function kindBoundaries(stream, { window, draws = 20, alpha = 1, seed = 5, slots = "ruler" } = {}) {
  if (!Number.isInteger(window) || window < 2) throw new TypeError("kindBoundaries: window is declared (an integer ≥ 2)");
  if (stream.length < 2 * window) return { boundaries: [], score: [], cut: null, window, draws, basis: `${stream.length} instance(s): fewer than two windows of ${window} — nothing to compare`, refused: "too_short" };
  const F = stream.map(factsFor(slots));
  const score = scan(F, window, alpha);
  _seed = seed;
  const maxima = [];
  for (let d = 0; d < draws; d++) maxima.push(Math.max(...scan(shuffled(F), window, alpha).filter((x) => x != null)));
  const cut = Math.max(...maxima);
  const boundaries = [];
  for (let t = window; t + window <= F.length; t++) {
    const s = score[t];
    if (s == null || s <= cut) continue;
    if ((score[t - 1] ?? -Infinity) > s || (score[t + 1] ?? -Infinity) > s) continue;
    if (boundaries.length && t - boundaries.at(-1) < window) continue;
    boundaries.push(t);
  }
  return { boundaries, score, cut, window, draws, basis: `each candidate scored against the kind being read NOW (the ${window} instance(s) before it): how much more the next ${window} move that ground than its own members do, bits per fact; a boundary beats the scan's maximum on every one of ${draws} permuted streams (cut ${cut.toFixed(3)})` };
}
