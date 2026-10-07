// native/kernel/kind-universe.js — the child's universe: referents rolling
// up into kinds, dynamically, recursively, holonically. Pure over a store
// shape — no I/O, no engine, no model.
//
// THE UNIVERSE IS BUILT FROM RECOGNITIONS. Every recognized region is a
// REFERENT OCCURRENCE (a thing seen, at an address); every concept in the
// store is a KIND (a thing recognized as itself). The universe is not a
// fixed taxonomy — it is grown: an occurrence corroborates its kind, a
// novel occurrence proposes a provisional kind, a falsification refutes a
// lesson, and a kind whose own examples stop being mutually reachable
// SPLITS into sub-kinds. Each of those is one of the fold's own operations,
// by name:
//
//   SIG  — a novel thing is SIGNED as a provisional kind (high possibility:
//          it might be anything — that is what novelty means)
//   CON  — a kind is CORROBORATED by occurrences from distinct sources;
//          corroboration IS its probability (high frequency → high
//          probability; the floor is the house's own canonicalizationFloor)
//   SEG  — a kind SPLITS: its examples cluster into sub-kinds exactly when
//          its members are no longer mutually reachable at its own
//          within-kind distance (measured, never typed)
//   DEF  — a FALSIFICATION: a lesson is refuted and excluded from the
//          framework (a false memory is a memory that admits it is false)
//   REC  — a lesson is REVISED: superseded by a corrected one
//
// HOLONIC: a recognized thing's PARTS are themselves referents. The child
// can look inside a dog — its head, its body, its legs — and each part is
// its own occurrence that can roll up into its own kind. The universe is a
// lattice: what is a whole at one level is a part at the next, and the
// lattice is recomputed from the store on every snapshot, never stored
// separately (the store is the memory; the lattice is a view of it).

import { stableHash } from "./rng.js";
import { distanceOf, selfBoundOf, decodeDescriptor } from "./shadow-echo.js";
// SIG/CON/DEF/REC over bare occurrence rows moved to kernel/corroboration.js
// (2026-09-22) — none of the four ever touched a descriptor or a distance,
// and three independent lineages (organs/mnemonic.js, the-fold/expertise.js,
// the-fold/kind-memory.js) were each reaching sideways into this
// vision-named module to get them. Re-exported here so every existing
// import of this module keeps working unchanged; SEG (splitProposals) below
// stays put, because it is genuinely descriptor-geometry, not yet
// generalized past vision.
import { CANONICALIZATION_FLOOR, occurrenceKey, signProvisionalKind, corroboration, confirmKind, falsifyOccurrence, supersedeLesson } from "./corroboration.js";
export { CANONICALIZATION_FLOOR, occurrenceKey, signProvisionalKind, corroboration, confirmKind, falsifyOccurrence, supersedeLesson } from "./corroboration.js";

export const provisionalKindName = (descriptor) =>
  `kind:novel:${stableHash(`provisional|${descriptor.length}|${Array.from(descriptor.slice(0, 32)).join(",")}`)}`;

const decodeDescriptorOf = (item) => decodeDescriptor(item.d);

// SIG/CON/DEF moved to kernel/corroboration.js (imported/re-exported above);
// what follows is the vision-specific geometry that stays here.

// ── SEG: split — a kind whose members stop being mutually reachable ───────
// The derived split criterion: build the graph over the concept's own
// examples with an edge when the distance is within the concept's own
// within-kind bound (leave-one-out nearest bound); the connected components
// ARE the proposed sub-kinds. A kind splits exactly when its members stop
// being reachable from one another at the distance the kind itself
// established — "dogs will be hard" is exactly when the dog framework
// contains two clusters that no longer touch.
export function splitProposals(store, concept, { bound = null } = {}) {
  const entry = store.concepts?.[concept];
  if (!entry) return { concept, components: [] };
  // veto-report: entry.items are lessons a teacher (the CV parent, a named
  // giver) already taught; this only REMOVES the ones a re-read falsified
  // (falsifyOccurrence) — the giver's set minus the refuted, afterVeto's
  // shape. No item enters the set for being unrefuted.
  const items = entry.items.filter((it) => !it.refuted);
  if (items.length < 2) return { concept, components: [] };
  const descriptors = items.map(decodeDescriptorOf);
  const b = bound ?? withinKindBound(store, concept);
  // bound 0 is a real bound (identical lessons connect); only a missing
  // bound (no lessons, no gap) is empty
  if (b < 0) return { concept, components: [] };
  const parent = items.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < descriptors.length; i += 1) {
    for (let j = i + 1; j < descriptors.length; j += 1) {
      if (distanceOf(descriptors[i], descriptors[j]) <= b) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[ri] = rj;
      }
    }
  }
  const groups = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(items[i]);
  }
  const components = [...groups.values()].sort((a, z) => z.length - a.length);
  return { concept, bound: b, components: components.length > 1 ? components : [] };
}

// the within-kind bound for the SPLIT — the RAW leave-one-out nearest
// structure, WITHOUT the twin compensation the recognition bound applies
// (shadow-echo.js::selfBoundOf). The split asks: at the kind's own local
// density, are the members mutually reachable? A hand-multiplicity or a
// symmetry orbit that RECOGNITION refuses to count as distance is exactly
// the redundancy the split is allowed to see — the split proposes sub-kinds
// at the density, and the recognition bound then decides what the sub-kinds
// recognize. (Measured, mnemonic-shapes.test.mjs: the twin-compensated
// bound connected a wide/tall rectangle family at the cross-cluster
// distance and the split vanished — the raw bound restores it.)
export function withinKindBound(store, concept) {
  const entry = store.concepts?.[concept];
  if (!entry?.items?.length) return 0;
  // veto-report: as in splitProposals — the taught lessons minus the
  // falsified ones; removal only, nothing admitted for being unrefuted.
  const live = entry.items.filter((it) => !it.refuted);
  if (live.length < 2) return 0;
  const items = live.map((it) => ({ descriptor: decodeDescriptorOf(it) }));
  let worst = 0;
  for (let i = 0; i < items.length; i += 1) {
    let nearest = Infinity;
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;
      const d = distanceOf(items[i].descriptor, items[j].descriptor);
      if (d < nearest) nearest = d;
    }
    if (nearest > worst) worst = nearest;
  }
  return worst;
}

// REC (supersedeLesson) moved to kernel/corroboration.js.

// ── the universe snapshot: the whole lattice, recomputed from the store ───
// Kinds with their status/history (occurrences, corroboration), the DMD
// bound each kind recognizes within, and the VOID each kind is read against
// (the nearest example of any other kind, measured from the kind's OWN
// examples — a kind that sits inside another kind's void is a containment,
// disclosed, which is exactly how dog reads against mammal). Holonic PARTS
// edges: a kind whose occurrences sit inside another kind's region at the
// same source is a part of it. Pure view — the store is the memory, the
// lattice is derived from it.
export function voidOfKind(store, concept) {
  const entry = store.concepts?.[concept];
  if (!entry?.items?.length) return null;
  const shape = entry.items[0].shape ?? 0;
  let voidBest = null;
  let voidD = Infinity;
  for (const [otherName, otherEntry] of Object.entries(store.concepts ?? {})) {
    if (otherName === concept || !otherEntry?.items?.length) continue;
    if ((otherEntry.items[0].shape ?? 0) !== shape) continue;
    for (const mine of entry.items) {
      for (const item of otherEntry.items) {
        const d = distanceOf(decodeDescriptorOf(mine), decodeDescriptorOf(item));
        if (d < voidD) { voidD = d; voidBest = otherName; }
      }
    }
  }
  return voidBest ? { kind: voidBest, distance: voidD } : null;
}

export function universeSnapshot(store) {
  const kinds = {};
  for (const [name, entry] of Object.entries(store.concepts ?? {})) {
    kinds[name] = {
      status: entry.status ?? "provisional",
      modality: entry.modality ?? null,
      occurrences: entry.occurrences?.length ?? 0,
      falsified: entry.occurrences?.filter((o) => o.falsified).length ?? 0,
      distinctSources: corroboration(store, name),
      // veto-report: a descriptive count for the snapshot (lessons still
      // standing); it admits nothing.
      lessons: entry.items?.filter((it) => !it.refuted).length ?? 0,
      bound: withinKindBound(store, name),
      void: voidOfKind(store, name),
    };
  }
  const parts = [];
  const bySource = new Map();
  for (const [name, entry] of Object.entries(store.concepts ?? {})) {
    for (const o of entry.occurrences ?? []) {
      if (!o.source) continue;
      if (!bySource.has(o.source)) bySource.set(o.source, []);
      bySource.get(o.source).push({ kind: name, region: o.region, id: o.id });
    }
  }
  for (const occs of bySource.values()) {
    for (const a of occs) {
      for (const b of occs) {
        if (a.kind === b.kind || !a.region || !b.region) continue;
        // b's region strictly inside a's region, at the same source → b is a
        // part of a (holonic edge)
        const [ax, ay, aw, ah] = a.region;
        const [bx, by, bw, bh] = b.region;
        if (bx >= ax && by >= ay && bx + bw <= ax + aw && by + bh <= ay + ah) {
          parts.push({ whole: a.kind, part: b.kind, source: b.source, region: b.region });
        }
      }
    }
  }
  return { kinds, parts, kindCount: Object.keys(kinds).length, partCount: parts.length };
}