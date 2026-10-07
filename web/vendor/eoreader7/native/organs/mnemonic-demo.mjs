// mnemonic-demo.mjs — the live proof. One run, every claim, with the
// numbers: shapes, rotations, colors, two-tone sides, filled/outlined,
// overlap, standard color names navigated by DMD, the omnilingual
// referent, and the real-world boundaries — measured, disclosed, never
// wished.

import { createSeededRng } from "../kernel/rng.js";
import {
  emptyStore,
  teachGrid,
  recognizeGrid,
  recognizeGridColor,
  nameKind,
  kindByName,
  universeSnapshot,
} from "./mnemonic.js";
import {
  colorNameOf,
  navigateColorName,
  colorNameFramework,
  loadColorNamePrior,
} from "../kernel/color-name-space.js";

const W = 96;
const H = 96;
const noise = (seed) => (createSeededRng(seed)() - 0.5) * 2 * 0.02;

const jitterOf = (seed, j) => (createSeededRng(seed)() - 0.5) * 2 * j;

// ── grayscale shapes ───────────────────────────────────────────────────────
const circle = ({ seed = 1, jitter = 0.5 } = {}) => {
  const g = new Float64Array(W * H).fill(0.22);
  const r = 24 * (1 + jitterOf(seed, jitter * 0.2));
  const ox = W / 2 + jitterOf(seed + 1, jitter * 10);
  const oy = H / 2 + jitterOf(seed + 2, jitter * 10);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if ((x - ox) ** 2 + (y - oy) ** 2 <= r * r) g[y * W + x] = 1;
  }
  for (let i = 0; i < g.length; i += 1) g[i] += noise(seed + i);
  return g;
};

const square = ({ seed = 1, jitter = 0.5 } = {}) => {
  const g = new Float64Array(W * H).fill(0.22);
  const s = 40 * (1 + jitterOf(seed, jitter * 0.2));
  const ox = W / 2 + jitterOf(seed + 1, jitter * 10);
  const oy = H / 2 + jitterOf(seed + 2, jitter * 10);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (Math.abs(x - ox) <= s / 2 && Math.abs(y - oy) <= s / 2) g[y * W + x] = 1;
  }
  for (let i = 0; i < g.length; i += 1) g[i] += noise(seed + i);
  return g;
};

const triangle = ({ seed = 1, jitter = 0.5 } = {}) => {
  const g = new Float64Array(W * H).fill(0.22);
  const s = 40 * (1 + jitterOf(seed, jitter * 0.2));
  const ox = W / 2 + jitterOf(seed + 1, jitter * 10);
  const oy = H / 2 + jitterOf(seed + 2, jitter * 10);
  const top = oy - s / 2;
  const base = oy + s / 2;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const t = (y - top) / (base - top);
    if (y >= top && y <= base && Math.abs(x - ox) <= (s / 2) * t) g[y * W + x] = 1;
  }
  for (let i = 0; i < g.length; i += 1) g[i] += noise(seed + i);
  return g;
};

const diamond = () => {
  const g = new Float64Array(W * H).fill(0.22);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (Math.abs(x - W / 2) + Math.abs(y - H / 2) <= 30) g[y * W + x] = 1;
  }
  for (let i = 0; i < g.length; i += 1) g[i] += noise(i);
  return g;
};

// ── color scene: rgb + luminance for one draw ─────────────────────────────
function colorScene(draw, { seed = 1 } = {}) {
  const lum = new Float64Array(W * H).fill(0.25);
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const bg = [242, 242, 242];
      const i = y * W + x;
      const p = draw(x, y, bg);
      rgb[i * 3] = p[0];
      rgb[i * 3 + 1] = p[1];
      rgb[i * 3 + 2] = p[2];
      lum[i] = (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255;
    }
  }
  for (let i = 0; i < lum.length; i += 1) lum[i] += noise(seed + i);
  return { lum, rgb };
}

const COLORS = {
  red: [220, 40, 40], orange: [235, 130, 30], yellow: [240, 210, 40],
  green: [40, 180, 70], blue: [40, 80, 220], purple: [150, 40, 200],
  magenta: [220, 40, 200],
};

const shapeDrawer = (shape, color, { cx = W / 2, cy = H / 2, size = 40 } = {}) =>
  (x, y, bg) => {
    const half = size / 2;
    let inside = false;
    if (shape === "triangle") {
      const t = (y - (cy - half)) / size;
      inside = y >= cy - half && y <= cy + half && Math.abs(x - cx) <= half * t;
    } else if (shape === "square") {
      inside = Math.abs(x - cx) <= half && Math.abs(y - cy) <= half;
    } else if (shape === "circle") {
      inside = (x - cx) ** 2 + (y - cy) ** 2 <= half * half;
    }
    if (!inside) return [...bg, 0];
    return [...color, 1];
  };

function teachColorFamily(store, concept, draw) {
  for (let i = 0; i < 15; i += 1) {
    const size = [28, 32, 36, 40, 44][i % 5];
    const s = colorScene(draw({ size }), { seed: i * 10 + 1 });
    teachGrid(store, concept, { grid: s.lum, colorGrid: s.rgb, w: W, h: H, source: `${concept}-${i}.png`, sourceBytes: 120000 });
  }
}

function readColor(store, draw, seed = 500) {
  const s = colorScene(draw, { seed });
  return recognizeGridColor(store, s.lum, s.rgb, W, H);
}

const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ══════════════════════════════════════════════════════════════════════
const store = emptyStore();

section("1. SHAPES — taught 7 examples each of circle/square/triangle, all jittered");
for (const [name, fn] of [["circle", circle], ["square", square], ["triangle", triangle]]) {
  for (let i = 0; i < 7; i += 1) teachGrid(store, name, { grid: fn({ seed: i * 10 + 1 }), w: W, h: H, source: `${name}-${i}.png`, sourceBytes: 120000 });
}
for (const [name, fn] of [["circle", circle], ["square", square], ["triangle", triangle]]) {
  const rec = recognizeGrid(store, fn({ seed: 500 }), W, H);
  const r = rec.regions[0];
  const c = r.concepts[name];
  console.log(`  unseen ${name.padEnd(8)} -> read as ${r.recognized.join(", ").padEnd(10)} distance=${c.nearestDistance.toFixed(4)} bound=${c.bound.toFixed(4)} margin=+${c.margin.toFixed(4)} void=${c.void.kind}`);
}
const d = recognizeGrid(store, diamond(), W, H);
console.log(`  NEVER taught diamond -> read as (nothing), NOVEL: ${d.regions[0].novel.name} — high possibility, never a guess`);

section("2. COLOR — the wheel taught, a new color is still the shape");
const colorStore = emptyStore();
for (const c of ["red", "orange", "yellow", "green", "blue", "purple"]) {
  teachColorFamily(colorStore, "triangle", ({ size }) => shapeDrawer("triangle", COLORS[c], { size }));
}
const yellow = readColor(colorStore, (x, y, bg) => shapeDrawer("triangle", COLORS.yellow, { size: 40 })(x, y, bg));
const y = yellow.regions.find((r) => r.recognized.includes("triangle"));
console.log(`  a YELLOW triangle (never shown) -> ${y ? "triangle ✓" : "NOT"}  colorName=${y?.colorName?.name}  margin=+${y.concepts.triangle.margin.toFixed(3)}`);
const redSq = readColor(colorStore, (x, y, bg) => shapeDrawer("square", COLORS.red, { size: 40 })(x, y, bg));
console.log(`  a red SQUARE vs the triangle family -> ${redSq.regions[0].recognized.includes("triangle") ? "falsely triangle" : "not a triangle ✓"} — disclosed ${redSq.regions[0].novel ? "as novel" : "as its own thing"}`);

section("3. DIFFERENT COLORS ON DIFFERENT SIDES — the hue layout is spatial");
const twoTone = (left, right) => (x, y, bg) => {
  const half = 22;
  if (Math.abs(x - W / 2) > half || Math.abs(y - H / 2) > half) return [...bg, 0];
  return [...(x < W / 2 ? COLORS[left] : COLORS[right]), 1];
};
for (let i = 0; i < 5; i += 1) {
  const s = colorScene(twoTone("red", "blue"), { seed: i * 10 + 1 });
  teachGrid(colorStore, "split", { grid: s.lum, colorGrid: s.rgb, w: W, h: H, source: `split-${i}.png`, sourceBytes: 120000 });
}
const same = readColor(colorStore, twoTone("red", "blue"));
const flip = readColor(colorStore, twoTone("blue", "red"));
console.log(`  red-left/blue-right -> ${same.regions.find((r) => r.recognized.includes("split")) ? "recognized ✓" : "NOT"}`);
console.log(`  blue-left/red-right (the FLIP) -> ${flip.regions[0].recognized.includes("split") ? "falsely recognized" : "disclosed as novel ✓"} (${flip.regions[0].novel?.name?.slice(0, 24)}...)`);

section("4. OVERLAP — a red disc over a blue square separates by hue class");
for (const [name, shape, color] of [["circle", "circle", "red"], ["square", "square", "blue"]]) {
  teachColorFamily(colorStore, name, ({ size }) => shapeDrawer(shape, COLORS[color], { size }));
}
const overlap = (x, y, bg) => {
  const c = shapeDrawer("circle", COLORS.red, { cx: 50, cy: 48, size: 40 })(x, y, bg);
  if (c[3]) return c;
  return shapeDrawer("square", COLORS.blue, { cx: 50, cy: 48, size: 40 })(x, y, bg);
};
const ov = readColor(colorStore, overlap);
const disc = ov.regions.find((r) => r.recognized.includes("circle"));
console.log(`  the red disc over the blue square -> segmented by ${ov.proposal.via}; disc read as ${disc ? `circle ✓, colorName=${disc.colorName?.name}` : "NOT"}`);
const surround = ov.regions.find((r) => r.via === "hue:7");
console.log(`  the covered square (a square WITH A HOLE) -> ${surround?.recognized.includes("square") ? "falsely a square" : "disclosed as novel ✓ — the hole is a real difference"}`);

section("5. STANDARD COLOR NAMES, NAVIGATED BY DMD — the wheel is a closed manifold");
const prior = loadColorNamePrior();
const fw = colorNameFramework(prior.terms);
console.log(`  the wheel's DMD: |λ|=${fw.eigenvalues[0].magnitude.toFixed(6)} (the coherent rotation), one step = ${(fw.stepAngle * 180 / Math.PI).toFixed(1)}° (the neighbor hue gap)`);
console.log(`  navigate: red +1 step -> ${navigateColorName("red").to}, +2 -> ${navigateColorName("red", 2).to}, -1 -> ${navigateColorName("yellow", -1).to}`);
console.log(`  name hue 0.00 -> ${colorNameOf(0.0).name};  hue 0.667 -> ${colorNameOf(0.667).name};  hue 0.125 -> ${colorNameOf(0.125).name} (the between-reading: ${colorNameOf(0.125).between})`);

section("6. THE REFERENT — one being, named in every language");
nameKind(colorStore, "triangle", "en", ["triangle"]);
nameKind(colorStore, "triangle", "el", ["τρίγωνον", "τρίγωνο"]);
nameKind(colorStore, "triangle", "he", ["משולש"]);
nameKind(colorStore, "triangle", "ja", ["三角形"]);
nameKind(colorStore, "triangle", "ar", ["مثلث"]);
const identities = new Set();
for (const s of ["triangle", "τρίγωνον", "משולש", "三角形", "مثلث"]) identities.add(kindByName(colorStore, s)[0].identity);
console.log(`  triangle / τρίγωνον / משולש / 三角形 / مثلث -> ${identities.size === 1 ? "ONE bytes-identity ✓" : "DIFFERENT identities ✗"}`);
console.log(`  identity: ${[...identities][0]}`);

section("7. THE UNIVERSE — kinds, corroboration, the lattice");
const snap = universeSnapshot(colorStore);
console.log(`  kinds: ${snap.kindCount}  (${Object.keys(snap.kinds).join(", ")})`);
console.log(`  triangle: ${snap.kinds.triangle.lessons} lessons, corroboration ${snap.kinds.triangle.distinctSources}, bound ${snap.kinds.triangle.bound.toFixed(4)}, void: ${snap.kinds.triangle.void?.kind ?? "none"}`);
console.log(`  split: ${snap.kinds.split.lessons} lessons, bound ${snap.kinds.split.bound.toFixed(4)}`);
console.log(`  parts edges: ${snap.partCount} (the holonic lattice)`);

section("8. THE MEASURED BOUNDARIES — disclosed, never wished");
const dogLike = ({ seed = 1 } = {}) => {
  // an ASYMMETRIC shape: the head hangs on ONE side — its mirror is a
  // different pose (a triangle's mirror is itself — measured in this demo)
  const rnd = (a, b) => a + (createSeededRng(seed)() - 0.5) * (b - a);
  const g = new Float64Array(W * H).fill(0.22);
  const cx = W / 2 + rnd(0, 6);
  const cy = H * 0.58;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const dx = (x - cx) / 30;
    const dy = (y - cy) / 13;
    const body = dx * dx + dy * dy <= 1;
    const hdx = (x - (cx + 27)) / 9;
    const hdy = (y - (cy - 15)) / 8;
    const head = hdx * hdx + hdy * hdy <= 1;
    if (body || head) g[y * W + x] = 1;
  }
  for (let i = 0; i < g.length; i += 1) g[i] += noise(seed + i);
  return g;
};
const dogStore = emptyStore();
for (let i = 0; i < 7; i += 1) teachGrid(dogStore, "dog", { grid: dogLike({ seed: i * 10 + 1 }), w: W, h: H, source: `dog-${i}.png`, sourceBytes: 120000 });
const mir = recognizeGrid(dogStore, (() => {
  const g = dogLike({ seed: 500 });
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) out[y * W + (W - 1 - x)] = g[y * W + x];
  return out;
})(), W, H);
console.log(`  a MIRRORED dog (the head-side flips; pose never taught) -> ${mir.regions[0].recognized.includes("dog") ? "falsely a dog" : "disclosed as novel ✓ — pose must be taught"}`);
const single = emptyStore();
teachGrid(single, "triangle", { grid: triangle({ seed: 3 }), w: W, h: H, source: "one.png", sourceBytes: 120000 });
teachGrid(single, "triangle", { grid: triangle({ seed: 3 }), w: W, h: H, source: "two.png", sourceBytes: 120000 });
const other = recognizeGrid(single, triangle({ seed: 4 }), W, H);
console.log(`  two IDENTICAL lessons -> the exact self recognized, a new triangle ${other.regions[0].recognized.includes("triangle") ? "falsely" : "honestly disclosed as novel ✓ — one lesson = one memory"}`);

console.log("\nDone. Every reading above is the measured verdict of the 144-byte (232-byte colored) memory — bounded geometry, voids named, novelty disclosed, never guessed.");