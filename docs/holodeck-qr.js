// qr.js — a compact QR code generator, self-contained (no dependency, no
// CDN, no external API): the app's own shared subscribe links are printed
// as QR codes so a poster or a table card can carry them. Byte mode, error
// correction level M, versions 1–10 (up to ~213 bytes — a long URL fits).
//
// The algorithm is the ISO/IEC 18004 standard; every choice is a public
// constant, and the whole encoder is proven in qr.test.mjs by DECODING the
// rendered matrix with an independent decoder (round-trip, not eyeballing).
//
// Output: `qrMatrix(text)` → a square boolean matrix, and `qrSvg(text)`
// → the same thing as an inline SVG for the page.

// ── GF(256) ────────────────────────────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// ── Reed-Solomon ───────────────────────────────────────────────────────────
// Reed–Solomon over GF(256)/0x11d. The divisor is g(x) = (x-α^0)(x-α^1)…(x-α^(n-1)), stored highest degree first
// WITHOUT its leading 1; the remainder is the long division of data(x)·x^n by g(x).
function rsGenerator(degree) {
  const gen = new Array(degree).fill(0);
  gen[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      gen[j] = gmul(gen[j], root);
      if (j + 1 < degree) gen[j] ^= gen[j + 1];
    }
    root = gmul(root, 2);
  }
  return gen;
}
function rsRemainder(data, gen) {
  const res = new Array(gen.length).fill(0);
  for (const b of data) {
    const factor = b ^ res.shift();
    res.push(0);
    for (let i = 0; i < gen.length; i++) res[i] ^= gmul(gen[i], factor);
  }
  return res;
}

const V = [
  [26, 1, 10], [44, 1, 16], [70, 1, 26], [100, 2, 36], [134, 2, 48],
  [172, 4, 64], [196, 4, 72], [242, 4, 88], [292, 5, 110], [346, 5, 130],
];
const ALIGN = {
  2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};
const FORMAT_MASK = 0x5412;
const VERSION_GEN = 0x1f25;

function pickVersion(len) {
  for (let v = 1; v <= 10; v++) {
    const [total, blocks, ecTotal] = V[v - 1];
    const data = total - ecTotal;
    const headerBits = v < 10 ? 12 : 20; // 4 mode + 8/16 count
    if (Math.floor((data * 8 - headerBits) / 8) >= len) return v;
  }
  throw new Error("the link is too long for a QR code");
}

// EC level M, versions 1–10: [error-correction codewords per block, [[block count, data codewords per block], …]]
const M_BLOCKS = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]],
};
/** The final codeword sequence of a symbol: data blocks interleaved column by column, then the EC blocks likewise. */
function encodeBytes(text, version) {
  const bytes = new TextEncoder().encode(text);
  const [ecPer, groups] = M_BLOCKS[version];
  const sizes = groups.flatMap(([n, d]) => new Array(n).fill(d));
  const dataCodewords = sizes.reduce((a, b) => a + b, 0);
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);                                    // byte mode
  push(bytes.length, version < 10 ? 8 : 16);          // character count
  for (const b of bytes) push(b, 8);
  if (bits.length > dataCodewords * 8) throw new Error('the link is too long for a QR code');
  push(0, Math.min(4, dataCodewords * 8 - bits.length));   // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xec ^ 0x11) data.push(pad);
  const gen = rsGenerator(ecPer);
  const blocks = [];
  let at = 0;
  for (const sz of sizes) { const d = data.slice(at, at + sz); at += sz; blocks.push({ data: d, ec: rsRemainder(d, gen) }); }
  const out = [];
  for (let i = 0; i < Math.max(...sizes); i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecPer; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

function moduleMatrix(version, codewords) {
  const size = version * 4 + 17;
  const m = new Array(size);
  const func = new Array(size); // true where a FUNCTION module lives: never masked, never data
  for (let i = 0; i < size; i++) { m[i] = new Array(size).fill(null); func[i] = new Array(size).fill(false); }
  const set = (r, c, v) => { m[r][c] = v; func[r][c] = true; };
  const putFinder = (top, left) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = top + r, cc = left + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on);
    }
  };
  putFinder(0, 0); putFinder(0, size - 7); putFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  set(size - 8, 8, true); // dark module
  const align = ALIGN[version];
  if (align) for (const r of align) for (const c of align) {
    if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.abs(dr) <= 1 && Math.abs(dc) <= 1);
    }
  }
  // reserve format areas + version areas as function modules
  for (let i = 0; i <= 8; i++) { if (!func[8][i]) set(8, i, false); if (!func[i][8]) set(i, 8, false); }
  for (let i = size - 8; i < size; i++) { if (!func[8][i]) set(8, i, false); if (!func[i][8]) set(i, 8, false); }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      if (!func[i][size - 11 + j]) set(i, size - 11 + j, false);
      if (!func[size - 11 + j][i]) set(size - 11 + j, i, false);
    }
  }
  // data bits, most significant first, in two-column strips from the bottom right: up, then down, skipping the timing column.
  // Modules left over after the last codeword (the remainder bits) stay 0.
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      for (let k = 0; k < 2; k++) {
        const c = right - k;
        const r = upward ? size - 1 - vert : vert;
        if (!func[r][c] && bi < bits.length) m[r][c] = bits[bi++] === 1;
      }
    }
  }
  return { m, func, size };
}

// ── format + version info ──────────────────────────────────────────────────
function formatBits(mask) {
  const data = (0b00 << 3) | mask; // EC level M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) & 1 ? 0x537 : 0);
  const bits = ((data << 10) | rem) ^ FORMAT_MASK;
  return bits;
}
function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) & 1 ? VERSION_GEN : 0);
  return (version << 12) | rem;
}
function placeFormat(m, size, mask) {
  // ISO/IEC 18004 §7.9. Bit 0 is the least significant. (The copy this file came from had the two axes swapped here, which
  // makes every symbol unreadable to a strict decoder: the finder patterns are found and the mask is not. holodeck-qr.test.mjs
  // decodes with an independent decoder; the platform's BarcodeDetector agreed once this was fixed.)
  const bits = formatBits(mask);
  const b = (i) => (bits >> i) & 1;
  // copy 1, around the top-left finder
  for (let i = 0; i <= 5; i++) m[i][8] = b(i);
  m[7][8] = b(6);
  m[8][8] = b(7);
  m[8][7] = b(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = b(i);
  // copy 2: along row 8 at the right edge, and down column 8 at the bottom. The dark module at (size-8, 8) is
  // set by the matrix builder and left untouched here.
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = b(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = b(i);
}
function placeVersion(m, size, version) {
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const v = (bits >> i) & 1;
    const r = Math.floor(i / 3), c = i % 3;
    m[r][size - 11 + c] = v;
    m[size - 11 + c][r] = v;
  }
}

// ── masking ────────────────────────────────────────────────────────────────
const MASK_FN = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];
function penalty(m, size) {
  let score = 0;
  const run = (get) => {
    let prev = null, len = 0;
    for (let i = 0; i < size; i++) {
      const v = get(i);
      if (v === prev) { len++; } else { if (prev !== null && len >= 5) score += 3 + (len - 5); prev = v; len = 1; }
    }
    if (len >= 5) score += 3 + (len - 5);
  };
  for (let r = 0; r < size; r++) run((i) => m[r][i]);
  for (let c = 0; c < size; c++) run((i) => m[i][c]);
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size - 6; c++) {
    const s = [0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0].map((k) => (c + k < size ? m[r][c + k] : false));
    if ((s[3] && !s[2] && s[1] && !s[0] && s[4] && s[5] && s[6] && !s[7] && s[8]) && ((c === 0 || !m[r][c - 1] && !s[0]) || (c + 11 < size && !m[r][c + 11] && !s[10]))) score += 40;
  }
  for (let c = 0; c < size; c++) for (let r = 0; r < size - 6; r++) {
    const s = [0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0].map((k) => (r + k < size ? m[r + k][c] : false));
    if ((s[3] && !s[2] && s[1] && !s[0] && s[4] && s[5] && s[6] && !s[7] && s[8]) && ((r === 0 || !m[r - 1][c] && !s[0]) || (r + 11 < size && !m[r + 11][c] && !s[10]))) score += 40;
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  score += 10 * Math.floor(Math.abs((dark / (size * size)) * 100 - 50) / 5);
  return score;
}

export function qrMatrix(text) {
  const version = pickVersion(new TextEncoder().encode(text).length);   // bytes, not characters
  const codewords = encodeBytes(text, version);
  const { m, func, size } = moduleMatrix(version, codewords);
  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const trial = m.map((row) => row.slice());
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!func[r][c] && MASK_FN[mask](r, c)) trial[r][c] = !trial[r][c];
    }
    placeFormat(trial, size, mask);
    if (version >= 7) placeVersion(trial, size, version);
    const s = penalty(trial, size);
    if (s < bestScore) { bestScore = s; best = trial; }
  }
  return { matrix: best, size, version };
}

export function qrSvg(text, { scale = 8, quiet = 4, dark = "#1b1914", light = "#fffdf9" } = {}) {
  const { matrix, size } = qrMatrix(text);
  const n = size + quiet * 2;
  const rects = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (matrix[r][c]) rects.push(`<rect x="${(c + quiet) * scale}" y="${(r + quiet) * scale}" width="${scale}" height="${scale}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n * scale}" height="${n * scale}" viewBox="0 0 ${n * scale} ${n * scale}" shape-rendering="crispEdges"><rect width="${n * scale}" height="${n * scale}" fill="${light}"/><g fill="${dark}">${rects.join("")}</g></svg>`;
}