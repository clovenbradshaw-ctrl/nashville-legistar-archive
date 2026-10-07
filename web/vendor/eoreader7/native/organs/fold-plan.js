// organs/fold-plan.js — WHICH FOLD, FOR WHOM (2026-09-28). The capacity to
// decide how to fold a piece of material from what is being asked of it.
//
// The user's framing: the whole program is defining the perspective and the
// "for whom". Folding is not one act — an entity fold, a link fold, a kind
// fold and a lens fold answer different questions — so WHICH fold runs is a
// function of what the person wants out, never of what the text looks like.
// (The cube is not a content classifier: CLAUDE.md, measured 95.7% surviving
// a word shuffle. The wants are DECLARED by the asker; nothing here reads the
// material to guess them.)
//
// PURE. It reads the assembly registry's own contracts (kernel/assembly.js,
// assemblies.js): an assembly answers a want when the want is a terrain in its
// contract. It runs nothing, spends nothing, and loads no organ.
//
// THE WALLS (each a typed gap, never a default fold):
//   - an INTERPRETIVE want (Lens, Paradigm, Atmosphere) with no `forWhom` is
//     refused `no_for_whom`: meaning always has a for-whom, even if that whom
//     is the named empty hub. No view from nowhere.
//   - a want no registered assembly answers is `no_assembly_for` — an honest
//     hole in the map, not a nearest guess.
//   - a want answered only by an assembly whose measurement has not run is
//     planned, and carries `measured: false` with the assembly's own
//     stagesNotRun — the plan never claims more than the registry does.
//   - a consumed WITNESS artifact (same-read) pulls in an assembly that
//     produces it; if none does, `unmet_witness` — never silently skipped.
//
// THE CAPACITY MAP (THE-CAPACITY-MAP.md; git 2f81545:native/docs/), wired in 2026-09-28:
//   - every plan reports the PLACES it would reach as a profile, and the
//     `unmetPrerequisites` of what was asked — the places the crossing rule says
//     must be earned first that neither the plan nor `have` provides. A plan that
//     asks for a Lens and nothing beneath it says so instead of quietly asking for
//     a direction with no standing under it.
//   - `crossing: true` REPAIRS that: the prerequisites are added as supporting
//     steps (reason "prerequisite of <want>"), or are typed gaps if nothing
//     answers them. It is OPT-IN: the strict order is this map's own extension,
//     tested (drivers at git 2f81545:native/eval/capacity-map/), and a crossing the evidence did not
//     support is not made a default here (UNSUPPORTED_CROSSINGS in the kernel).
//   - `have` lists terrains already read; they satisfy prerequisites.
import { nativeRegistry } from "../assemblies.js";
import { registeredAssemblies } from "../kernel/assembly.js";
import { CROSSINGS, placeOf, prerequisites } from "../kernel/capacity-map.js";
import { hasMeasurementGap, profileOfTerrains } from "./capacity-place.js";

/** Terrains whose reading is a standpoint's: the for-whom is required. */
export const INTERPRETIVE = Object.freeze(["Lens", "Paradigm", "Atmosphere"]);

/**
 * planFold({ wants, forWhom, have, crossing, crossings, registry }) →
 *   { forWhom, steps: [{ assembly, layer, answers, reasons, measured, stagesNotRun }],
 *     gaps: [{ want, gap, why }], unmetPrerequisites: [{ for, terrain, klass, order }],
 *     profile }
 * `wants` are terrain names the asker declares. `forWhom` is a named standpoint
 * (string) or null. Steps are dependency-first (the places nearer the ground, and a
 * witness's producer, before what stands on them), then registry order.
 */
export function planFold({ wants = [], forWhom = null, have = [], crossing = false, crossings = CROSSINGS, registry = nativeRegistry() } = {}) {
  const all = registeredAssemblies(registry);
  const gaps = [];
  const chosen = new Map(); // id → { asm, answers:Set, reasons:Set }
  const take = (asm, want, reason) => {
    const row = chosen.get(asm.id) ?? { asm, answers: new Set(), reasons: new Set() };
    if (want) row.answers.add(want);
    row.reasons.add(reason);
    chosen.set(asm.id, row);
  };
  const who = typeof forWhom === "string" && forWhom.trim() ? forWhom.trim() : null;
  // answered by what an assembly is FOR (declared), not by what its cells touch; the
  // baseline measuring stick is never planned as a reading
  const answering = (want) => all.filter((a) => a.layer !== "baseline" && (a.declaredTerrains ?? a.contract.terrains).includes(want));

  const accepted = [];
  for (const want of [...new Set(wants)]) {
    if (INTERPRETIVE.includes(want) && !who) {
      gaps.push({ want, gap: "no_for_whom", why: `${want} is a standpoint's reading; name whom it is for (even the empty hub) — there is no view from nowhere` });
      continue;
    }
    const found = answering(want);
    if (!found.length) {
      gaps.push({ want, gap: "no_assembly_for", why: `no registered assembly answers ${want}` });
      continue;
    }
    accepted.push(want);
    for (const asm of found) take(asm, want, "asked");
  }

  // the crossing rule: places that must be earned before the ones asked for
  const provided = () => new Set([...have, ...[...chosen.values()].flatMap(({ asm }) => asm.declaredTerrains ?? [])]);
  const unmetPrerequisites = [];
  for (const want of accepted) {
    const place = placeOf(want);
    if (!place) continue; // a terrain the map does not place carries no prerequisite claim
    for (const pre of prerequisites(place.klass, place.order, { crossings })) {
      const because = `prerequisite of ${want}`;
      // an assembly other than the asker that already provides this place is named as its provider
      // for THIS want too, so the reasons do not depend on which want was processed first
      const providers = [...chosen.values()].filter((r) => (r.asm.declaredTerrains ?? []).includes(pre.terrain) && !r.answers.has(want));
      if (providers.length || have.includes(pre.terrain) || provided().has(pre.terrain)) {
        if (crossing) for (const r of providers) r.reasons.add(because);
        continue;
      }
      if (!crossing) {
        unmetPrerequisites.push({ for: want, terrain: pre.terrain, klass: pre.klass, order: pre.order });
        continue;
      }
      if (INTERPRETIVE.includes(pre.terrain) && !who) {
        gaps.push({ want: pre.terrain, gap: "no_for_whom", why: `${pre.terrain} is a ${because} and is a standpoint's reading; name whom it is for` });
        continue;
      }
      const found = answering(pre.terrain);
      if (!found.length) {
        gaps.push({ want: pre.terrain, gap: "no_assembly_for", why: `no registered assembly answers ${pre.terrain}, a ${because}` });
        continue;
      }
      for (const asm of found) take(asm, pre.terrain, because);
    }
  }

  // same-read witness artifacts are only lawful from a producer in the plan
  for (let grew = true; grew; ) {
    grew = false;
    for (const { asm } of [...chosen.values()]) {
      for (const need of asm.consumes.filter((c) => c.as === "witness")) {
        if ([...chosen.values()].some((r) => r.asm.produces.includes(need.kind))) continue;
        const producer = all.find((a) => a.produces.includes(need.kind));
        if (producer) { take(producer, null, `witness for ${asm.id}`); grew = true; }
        else gaps.push({ want: asm.id, gap: "unmet_witness", why: `${asm.id} consumes ${need.kind} as a witness and no registered assembly produces it` });
      }
    }
  }

  // order: the places nearer the ground first (fewest prerequisites among what a step
  // answers), then registry order; then a witness's producer is moved ahead of its consumer
  const rank = new Map(all.map((a, i) => [a.id, i]));
  const depth = (terrain) => {
    const p = placeOf(terrain);
    return p ? prerequisites(p.klass, p.order, { crossings }).length : Infinity;
  };
  const shallowest = (row) => Math.min(...(row.answers.size ? [...row.answers] : row.asm.declaredTerrains ?? []).map(depth), Infinity);
  const ordered = [...chosen.values()].sort((x, y) => shallowest(x) - shallowest(y) || rank.get(x.asm.id) - rank.get(y.asm.id));
  for (let moved = true, guard = 0; moved && guard < ordered.length ** 2 + 1; guard++) {
    moved = false;
    for (let i = 0; i < ordered.length; i++) {
      for (const need of ordered[i].asm.consumes.filter((c) => c.as === "witness")) {
        const at = ordered.findIndex((r) => r.asm.produces.includes(need.kind));
        if (at > i) { const [row] = ordered.splice(at, 1); ordered.splice(i, 0, row); moved = true; }
      }
    }
  }
  const steps = ordered.map(({ asm, answers, reasons }) => ({
    assembly: asm.id,
    layer: asm.layer,
    answers: [...answers].sort(),
    reasons: [...reasons].sort(),
    measured: !hasMeasurementGap(asm),
    stagesNotRun: [...asm.stagesNotRun],
  }));

  // canonical output: the same wants in any order give the same plan
  const byText = (...keys) => (x, y) => keys.map((k) => String(x[k]).localeCompare(String(y[k]))).find((c) => c !== 0) ?? 0;
  return {
    forWhom: who,
    steps,
    gaps: gaps.sort(byText("want", "gap")),
    unmetPrerequisites: unmetPrerequisites.sort(byText("for", "order", "klass")),
    profile: profileOfTerrains([...provided()], { crossings }),
  };
}
