#!/usr/bin/env node
// Ask the real kernel whether every county event is coherent and inside the county room's
// contract. This script does not know the cube; it imports it. Terrain and stance are derived
// from (op, grain) by cellOf, so an event cannot disagree with itself -- what CAN go wrong is an
// unknown operator/grain (a gap) or an event outside the room's declared region.
//
//   node scripts/eo_check_county_ops.mjs [--store <dir>]
//
// Positive controls run first: the checker must REJECT a synthesised event the county room does
// not permit and an unknown operator. If it accepts either, the verdict is void and it exits 2.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const KHORA = process.env.KHORA || "/Users/mlacy/Documents/3.0/khora";
const { cellOf } = await import(path.join(KHORA, "native/kernel/cube.js"));

const argv = process.argv.slice(2);
const store = argv.includes("--store") ? argv[argv.indexOf("--store") + 1] : path.join(here, "..", "data", "counties");
const registry = JSON.parse(fs.readFileSync(path.join(here, "..", "data", "counties", "registry.json"), "utf8")).counties;

// The county room's contract. Narrow by default: it can instantiate, define, bond, partition,
// evaluate and restructure; it cannot synthesise (that belongs to a state-level space above it).
const CONTRACT = Object.freeze({
  ops: ["INS", "DEF", "CON", "SEG", "EVA", "REC"],
  terrains: ["Entity", "Lens", "Link", "Paradigm"],
  stances: ["Making", "Dissecting", "Binding", "Composing"],
});

function judge(ev) {
  const cell = cellOf(ev.op, ev.grain);
  if (cell.gap) return { ok: false, why: `gap:${cell.reason}` };
  if (!CONTRACT.ops.includes(ev.op)) return { ok: false, why: `contract-violation: op ${ev.op}`, cell };
  if (!CONTRACT.terrains.includes(cell.terrain)) return { ok: false, why: `contract-violation: terrain ${cell.terrain}`, cell };
  if (!CONTRACT.stances.includes(cell.stance)) return { ok: false, why: `contract-violation: stance ${cell.stance}`, cell };
  return { ok: true, cell };
}

// controls
const controls = [
  { name: "SYN at Figure inside a county room", ev: { op: "SYN", grain: "Figure" } },
  { name: "unknown operator", ev: { op: "ALT", grain: "Figure" } },
  { name: "INS at Ground (Void) is not in this room's terrains", ev: { op: "INS", grain: "Ground" } },
];
const blind = controls.filter((c) => judge(c.ev).ok);
if (blind.length) {
  console.error("VOID: the checker accepted events it must reject:", blind.map((b) => b.name));
  process.exit(2);
}

const tally = {}, bad = [];
let n = 0;
for (const reg of registry) {
  const dir = path.join(store, reg.slug);
  const files = [["manifest.jsonl", () => ({ op: "INS", grain: "Figure" })], ["ops.jsonl", (r) => ({ op: r.op, grain: r.grain })]];
  for (const [f, toEv] of files) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      const ev = toEv(r);
      const v = judge(ev);
      n++;
      const k = v.ok ? `${ev.op}(${v.cell.terrain}, ${v.cell.stance})` : `REJECT ${v.why}`;
      tally[k] = (tally[k] || 0) + 1;
      if (!v.ok && bad.length < 10) bad.push({ county: reg.county, file: f, why: v.why });
    }
  }
}
console.log(JSON.stringify({ controls_rejected: controls.length, events_checked: n, cells: tally, rejected_sample: bad }, null, 1));
process.exit(bad.length ? 1 : 0);
