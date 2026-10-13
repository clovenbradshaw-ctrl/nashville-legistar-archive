// holodeck-qr.test.mjs — an INDEPENDENT decoder for the QR matrix, written from ISO/IEC 18004 and sharing nothing with
// the encoder but its output: format bits and mask, the zig-zag read order around the function patterns, block
// de-interleaving, Reed–Solomon syndromes (all must be zero), and the byte-mode payload. The encoder was copied from a
// project whose header promised exactly such a test and had none on disk; this is that test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix } from './holodeck-qr.js';

// ---- GF(256), primitive polynomial 0x11d — built here, independently of the encoder's
const EXP = new Array(512), LOG = new Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// EC level M, versions 1–10: [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], …]]
const M_TABLE = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

function decode(matrix) {
  const N = matrix.length, v = (N - 17) / 4;
  assert.ok(Number.isInteger(v) && v >= 1 && v <= 10, 'size ' + N + ' is a version 1–10 symbol');
  const at = (r, c) => (matrix[r][c] ? 1 : 0);
  // format information: 15 bits, copy 1 around the top-left finder; XOR mask 101010000010010
  const fbits = [];
  for (let c = 0; c <= 5; c++) fbits.push(at(8, c));
  fbits.push(at(8, 7), at(8, 8), at(7, 8));
  for (let r = 5; r >= 0; r--) fbits.push(at(r, 8));
  let f = 0; for (const b of fbits) f = (f << 1) | b;
  f ^= 0b101010000010010;
  const ec = (f >> 13) & 3, mask = (f >> 10) & 7;
  assert.equal(ec, 0b00, 'error-correction level M');
  // copy 2 must agree (bottom-left / top-right): a corrupt copy would mean a corrupt symbol
  const f2 = []; for (let r = N - 1; r >= N - 7; r--) f2.push(at(r, 8)); for (let c = N - 8; c < N; c++) f2.push(at(8, c));
  let g = 0; for (const b of f2) g = (g << 1) | b; g ^= 0b101010000010010;
  assert.equal(g, f, 'both copies of the format information agree');

  // function patterns
  const func = Array.from({ length: N }, () => new Array(N).fill(false));
  const box = (r0, c0, h, w) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (r >= 0 && c >= 0 && r < N && c < N) func[r][c] = true; };
  box(0, 0, 9, 9); box(0, N - 8, 9, 8); box(N - 8, 0, 8, 9);        // finders + separators + format
  for (let i = 0; i < N; i++) { func[6][i] = true; func[i][6] = true; } // timing
  const al = ALIGN[v] || [];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    box(r - 2, c - 2, 5, 5);
  }
  if (v >= 7) { box(0, N - 11, 6, 3); box(N - 11, 0, 3, 6); }
  func[N - 8][8] = true;                                                // the dark module

  // data bits: two-column strips from the bottom right, upward then downward, skipping the timing column
  const bits = [];
  let up = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < N; i++) {
      const r = up ? N - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (func[r][c]) continue;
        let b = at(r, c); if (MASKS[mask](r, c)) b ^= 1;
        bits.push(b);
      }
    }
    up = !up;
  }
  const cws = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) { let x = 0; for (let k = 0; k < 8; k++) x = (x << 1) | bits[i + k]; cws.push(x); }

  // de-interleave into blocks
  const [ecPer, groups] = M_TABLE[v];
  const dataLens = groups.flatMap(([n, d]) => new Array(n).fill(d));
  const total = dataLens.reduce((a, b) => a + b, 0) + ecPer * dataLens.length;
  assert.ok(cws.length >= total, 'enough codewords: have ' + cws.length + ', need ' + total);
  const blocks = dataLens.map(() => ({ data: [], ec: [] }));
  let p = 0;
  for (let i = 0; i < Math.max(...dataLens); i++) dataLens.forEach((d, b) => { if (i < d) blocks[b].data.push(cws[p++]); });
  for (let i = 0; i < ecPer; i++) blocks.forEach((b) => b.ec.push(cws[p++]));

  // Reed–Solomon: every block's syndromes S_0..S_{ec-1} must be zero
  for (const [bi, b] of blocks.entries()) {
    const word = [...b.data, ...b.ec];
    for (let s = 0; s < ecPer; s++) {
      let acc = 0; for (const cw of word) acc = gmul(acc, EXP[s]) ^ cw;
      assert.equal(acc, 0, `block ${bi} syndrome ${s} is zero`);
    }
  }
  // payload
  const data = blocks.flatMap((b) => b.data);
  let pos = 0;
  const take = (n) => { let x = 0; for (let k = 0; k < n; k++) { const byte = data[pos >> 3]; x = (x << 1) | ((byte >> (7 - (pos & 7))) & 1); pos++; } return x; };
  assert.equal(take(4), 0b0100, 'byte mode');
  const len = take(v <= 9 ? 8 : 16);
  const bytes = []; for (let i = 0; i < len; i++) bytes.push(take(8));
  return { version: v, mask, text: new TextDecoder().decode(new Uint8Array(bytes)) };
}

test('the encoder’s output decodes, through an independent decoder, to exactly what went in — at every version it supports', () => {
  const samples = [
    'HELLO WORLD',
    'https://example.com/a?b=c',
    'otpauth://totp/Holodeck:owner?secret=QL7PUPJO4R4YCXN32KVHG3PCZKW5KJCR&issuer=Holodeck&algorithm=SHA1&digits=6&period=30',
    'otpauth://totp/Holodeck:Ana%20(accountant)?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Holodeck&algorithm=SHA1&digits=6&period=30',
    'ünïcödé — ✓ 日本語',
  ];
  for (let n = 5; n <= 200; n += 15) samples.push('x'.repeat(n));
  const seen = new Set();
  for (const text of samples) {
    const { matrix } = qrMatrix(text);
    const r = decode(matrix);
    assert.equal(r.text, text, 'round trip of ' + JSON.stringify(text.slice(0, 40)));
    seen.add(r.version);
  }
  assert.ok(seen.size >= 5, 'several versions were exercised: ' + [...seen].sort((a, b) => a - b).join(','));
});

test('control: the decoder is not a rubber stamp — a flipped data module breaks a Reed–Solomon syndrome, and a wrong mask or level is noticed', () => {
  const { matrix } = qrMatrix('otpauth://totp/Holodeck:owner?secret=QL7PUPJO4R4YCXN32KVHG3PCZKW5KJCR&issuer=Holodeck');
  const flipped = matrix.map((r) => r.slice());
  flipped[matrix.length - 3][matrix.length - 3] = !flipped[matrix.length - 3][matrix.length - 3];     // a data module near the bottom-right
  assert.throws(() => decode(flipped), /syndrome/);
  const badFormat = matrix.map((r) => r.slice());
  for (let c = 0; c <= 5; c++) badFormat[8][c] = !badFormat[8][c];
  assert.throws(() => decode(badFormat));
});
