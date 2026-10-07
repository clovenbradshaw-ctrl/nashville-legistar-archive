// native/the-fold/arc.js — THE ARC: what a unit's parts DO, in order (layer 6).
//
// Three of the study's forms are the ones the shape organs fail on — the
// obituary, the recipe, encyclopedia prose. They fail for one reason: at
// every position they look alike. A recipe's third paragraph and an
// obituary's third paragraph are both a paragraph of a few sentences with
// no indent, no rhyme, no count that separates them. What separates them is
// the ORDER OF WHAT IS DONE — the recipe instructs and then instructs
// again; the obituary binds a person to a kind, traces a life, and closes
// on a survival. That is SYN·Pattern, and nothing positional can see it.
//
// This organ adds no new learning machinery. It adds two ATTRIBUTES to the
// elements the Ground reader already produced — the stance and terrain each
// element leans to, read off the cube addresses of its own parse — and the
// emergent slot generator (form-prior.js) then makes position, equality and
// succession facts from them exactly as it does for indent or rhyme. Layer 6
// is a new kind of attribute, not a new kind of fact.
//
// THE MOVES. A stance at position 7 means nothing when one obituary runs to
// four paragraphs and another to thirty. So the arc is also attached as its
// own element class: consecutive elements leaning the same way are one MOVE,
// and the moves are few and comparable across lengths. `move@0:stance`,
// `move@1:stance==move@0`, `count:move` — the arc, in the vocabulary the
// organs already speak.
//
// THE LEAN IS RELATIVE (profile.js leanProfiles): an element's stance is its
// surprisal-weighted share minus the share of the WHOLE COLLECTION read in
// this call. Nouns and verbs put Binding and Entity everywhere; the lean is
// what is left when that is subtracted. Hand it one form's instances and the
// baseline is that form; hand it a form and its neighbours together — which
// is what a hunt does — and the baseline is the neighbourhood.
//
// THE PARSER IS OPTIONAL AND ITS LIMITS ARE ITS OWN (eot-notation.js: UD
// English-EWT, held-out LAS 77.0). Without the model file this organ attaches
// nothing and says so; no caller may treat a missing arc as a flat one.
import { elementsOf } from "./medium.js";
import { loadEotParser } from "./eot-notation.js";
import { addressesOf, leanProfiles } from "./profile.js";

export const ARC_SCHEMA = "EOArc@1";
const unitOf = (u) => (Array.isArray(u?.elements) ? u : { elements: elementsOf(typeof u === "string" ? u : u?.text ?? "").elements });
const textOf = (e) => String(e?.text ?? "").trim();

/**
 * attachArc(units, { parser }) — reads every unit's elements through the EOT
 * parser, leans each against the collection's own baseline, and attaches
 *   e.stance, e.terrain            (on the elements that parsed)
 *   { cls: "move", stance, terrain } elements, one per run
 * Returns { attached, units, parsed, unparsed, baseline, basis } — or
 * { attached: false, reason } when the parser is not available.
 */
export async function attachArc(units, { parser = null, moves = true } = {}) {
  const P = parser ?? (await loadEotParser());
  if (!P?.ok) return { schema: ARC_SCHEMA, attached: false, reason: P?.reason ?? "no parser", units: units.map(unitOf) };
  const us = units.map(unitOf);
  const cache = new Map(); // identical text is parsed once
  const items = [];
  us.forEach((u, ui) => u.elements.forEach((e, ei) => {
    const t = textOf(e);
    if (!t) return;
    let addrs = cache.get(t);
    if (!addrs) {
      try { addrs = P.parse(t, `arc:${ui}:${ei}`).flatMap(addressesOf); } catch { addrs = []; }
      cache.set(t, addrs);
    }
    if (addrs.length) items.push({ id: `${ui}:${ei}`, addresses: addrs });
  }));
  const { baseline, byId } = leanProfiles(items);
  let parsed = 0, unparsed = 0;
  us.forEach((u, ui) => {
    u.elements.forEach((e, ei) => {
      const p = byId.get(`${ui}:${ei}`);
      if (!p) { unparsed++; return; }
      parsed++;
      e.stance = p.stance.top;
      e.terrain = p.terrain.top;
    });
    if (!moves) return;
    u.elements = u.elements.filter((e) => e.cls !== "move");
    const runs = [];
    for (const e of u.elements) {
      if (!e.stance) continue;
      const last = runs[runs.length - 1];
      if (last && last.stance === e.stance) { last.n++; continue; }
      runs.push({ cls: "move", stance: e.stance, terrain: e.terrain, n: 1 });
    }
    for (const r of runs) u.elements.push({ cls: "move", stance: r.stance, terrain: r.terrain });
  });
  return {
    schema: ARC_SCHEMA, attached: true, units: us, parsed, unparsed,
    baseline,
    basis: `${parsed} element(s) leaned against this collection's own baseline, ${unparsed} not parsed (no address: absence, not a flat arc); parser ${P.provenance?.treebank ?? "UD_English-EWT"} held-out LAS ${P.provenance?.heldOut?.LAS ?? P.provenance?.scores?.LAS ?? "see provenance"} — the arc is the parse the engine has, errors included`,
  };
}

/** The moves of one unit, in order, once attachArc has run. */
export const movesOf = (u) => (unitOf(u).elements ?? []).filter((e) => e.cls === "move").map((e) => e.stance);
