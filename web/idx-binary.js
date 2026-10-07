// idx-binary.js — Binary serialization for FoldReadingIndex@2, the reading index the holodeck
// keeps in OPFS. Mirrors eodb's pack.js: fixed-header + body records, FNV-1a equality columns,
// DataView scans at memory bandwidth — no TextDecoder, no JSON.parse on the render path. Follows
// the 7cac452 single-decrypt discipline: the file is read once as an ArrayBuffer and every row,
// source, and section is decoded from that one buffer on demand and cached. Loading the index is
// one arrayBuffer(), not a tens-of-MB JSON parse; matching reads stride fixed headers and decode
// bodies only for hits.
//
// Layout (v1, magic "FRIX"):
//
//   [MAGIC(4)][VER(2)][strTableOff(4)][secTableOff(4)][srcDirOff(4)][srcValOff(4)]
//   [cursorOff(4)][ms(4)][lines(4)][bad(4)][encounters(4)][castTotal(4)][bondsTotal(4)]
//   [canonTotal(4)][identitiesTotal(4)][schemaOff(4)][fromOff(4)][builtAtOff(4)][kindsOff(4)][orderOff(4)]
//   kinds    : [count(4)][ strOff(4), n(4) ] x count
//   order    : [count(4)][ strOff(4) ] x count
//   sections : 4 x { off(4), count(4) }                — cast, bonds, canon, identities
//   cast rows / bonds rows / canon rows / identities rows
//   srcDir   : [count(4)][ nameOff(4), valOff(4) ] x count   (sorted by name for binary search)
//   srcVal   : one value per source, in dir order
//   strTable : [count(4)][ off(4) ] x count, [blobLen(4)][blob]; blob = [len(4)][bytes] sequences
//
// Row records use string-table offsets (0 = empty) and an FNV-1a column per equality hot-spot
// (cast surface0, bond a/b) so a match is a u32 compare, not a string compare.
//
// Row layouts (fixed header + variable body):
//   cast   [mentions(4)][srcN(4)][firstSeq(4)][surfHash0(4)][standing(4)][id(4)][first(4)][bodyLen(4)]
//          body: [surfCount(2)][surfOff xN][srcCount(2)][srcOff, n xN]
//   bonds  [n(4)][pos(4)][neg(4)][srcN(4)][firstSeq(4)][aHash(4)][bHash(4)][a(4)][b(4)][first(4)][bodyLen(4)]
//          body: [relCount(2)][relOff, n xN][srcCount(2)][srcOff, n xN]
//   canon  [n(4)][a(4)][b(4)][srcN(4)][bodyLen(4)]
//          body: [altsCount(2)][altOff xN][srcCount(2)][srcOff, n xN]
//   ident  [n(4)][left(4)][right(4)][srcN(4)][bodyLen(4)]
//          body: [evCount(2)][evOff, n xN][srcCount(2)][srcOff, n xN]
//   source [chunks(4)][chars(4)][bodyLen(4)]
//          body: [ops][terrain][kinds][cast][bonds][idChurn], each [count(2)][sOff, n xN]

const MAGIC = new Uint8Array([0x46, 0x52, 0x49, 0x58]); // 'FRIX'
const VERSION = 1;
const HEADER_SIZE = 78;
const SEC_CAST = 0, SEC_BONDS = 1, SEC_CANON = 2, SEC_IDENTITIES = 3;
const HEAD_CAST = 32, HEAD_BONDS = 44, HEAD_CANON = 20, HEAD_IDENT = 20, HEAD_SOURCE = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class Block {
  constructor() {
    this.buf = new ArrayBuffer(1024);
    this.view = new DataView(this.buf);
    this.arr = new Uint8Array(this.buf);
    this.p = 0;
  }
  _grow(n) {
    if (this.p + n > this.buf.byteLength) {
      const b = new ArrayBuffer(Math.max(this.p + n, this.buf.byteLength * 2));
      new Uint8Array(b).set(new Uint8Array(this.buf, 0, this.p));
      this.buf = b; this.view = new DataView(b); this.arr = new Uint8Array(b);
    }
  }
  u16(v) { this._grow(2); this.view.setUint16(this.p, v); this.p += 2; return this; }
  u32(v) { this._grow(4); this.view.setUint32(this.p, v); this.p += 4; return this; }
  bytes(b) { this._grow(b.length); this.arr.set(b, this.p); this.p += b.length; return this; }
  done() { return new Uint8Array(this.buf, 0, this.p); }
}

const pairs = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

// List/map counts are u16. Overflow would silently truncate the file and
// corrupt reads later — fail loudly instead.
function u16c(w, n) {
  if (n > 0xFFFF) throw new Error('idx-binary: count ' + n + ' exceeds the u16 field (65535)');
  w.u16(n);
}

function packMap(w, o, S) {
  const e = pairs(o);
  u16c(w, e.length);
  for (const [k, n] of e) { w.u32(S(k)); w.u32(n >>> 0); }
}

function packCastRow(w, c, S) {
  const surfaces = (c.surfaces && c.surfaces.length ? c.surfaces : (c.id ? [c.id] : []));
  const src = pairs(c.src);
  const body = new Block();
  u16c(body, surfaces.length);
  for (const s of surfaces) body.u32(S(s));
  u16c(body, src.length);
  for (const [k, n] of src) { body.u32(S(k)); body.u32(n >>> 0); }
  const b = body.done();
  w.u32(c.mentions || 0);
  w.u32(c.srcN || (c.src ? Object.keys(c.src).length : 0));
  w.u32(c.firstSeq || 0);
  w.u32(fnv1a32(surfaces[0] || ''));
  w.u32(S(c.standing));
  w.u32(S(c.id));
  w.u32(S(c.first));
  w.u32(b.length);
  w.bytes(b);
}

function packBondRow(w, b, S) {
  const rel = pairs(b.rel), src = pairs(b.src);
  const body = new Block();
  u16c(body, rel.length);
  for (const [k, n] of rel) { body.u32(S(k)); body.u32(n >>> 0); }
  body.u16(src.length);
  for (const [k, n] of src) { body.u32(S(k)); body.u32(n >>> 0); }
  const bb = body.done();
  w.u32(b.n || 0); w.u32(b.pos || 0); w.u32(b.neg || 0);
  w.u32(b.srcN || (b.src ? Object.keys(b.src).length : 0));
  w.u32(b.firstSeq || 0);
  w.u32(fnv1a32(b.a || '')); w.u32(fnv1a32(b.b || ''));
  w.u32(S(b.a)); w.u32(S(b.b)); w.u32(S(b.first));
  w.u32(bb.length); w.bytes(bb);
}

function packCanonRow(w, c, S) {
  const alts = Object.keys(c.alts || {}), src = pairs(c.src);
  const body = new Block();
  u16c(body, alts.length);
  for (const a of alts) body.u32(S(a));
  body.u16(src.length);
  for (const [k, n] of src) { body.u32(S(k)); body.u32(n >>> 0); }
  const bb = body.done();
  w.u32(c.n || 0); w.u32(S(c.a)); w.u32(S(c.b));
  w.u32(c.srcN || (c.src ? Object.keys(c.src).length : 0));
  w.u32(bb.length); w.bytes(bb);
}

function packIdRow(w, i, S) {
  const ev = pairs(i.events), src = pairs(i.src);
  const body = new Block();
  u16c(body, ev.length);
  for (const [k, n] of ev) { body.u32(S(k)); body.u32(n >>> 0); }
  body.u16(src.length);
  for (const [k, n] of src) { body.u32(S(k)); body.u32(n >>> 0); }
  const bb = body.done();
  w.u32(i.n || 0); w.u32(S(i.left)); w.u32(S(i.right));
  w.u32(i.srcN || (i.src ? Object.keys(i.src).length : 0));
  w.u32(bb.length); w.bytes(bb);
}

function packSourceVal(w, v, S) {
  const body = new Block();
  for (const k of ['ops', 'terrain', 'kinds', 'cast', 'bonds', 'idChurn']) packMap(body, v[k], S);
  const bb = body.done();
  w.u32(v.chunks || 0); w.u32(v.chars || 0); w.u32(bb.length); w.bytes(bb);
}

/**
 * Pack a FoldReadingIndex@2 object into a binary Uint8Array.
 * Deterministic: maps are emitted in descending-count order, sources sorted by name.
 */
export function packIndex(index) {
  const strings = [];
  const strIdx = new Map();
  // 1-based string indices (0 is the empty sentinel).
  const S = s => {
    const k = String(s ?? '');
    if (!k) return 0;
    let i = strIdx.get(k);
    if (i === undefined) { i = strings.length + 1; strIdx.set(k, i); strings.push(k); }
    return i;
  };

  const srcNames = Object.keys(index.sources || {});
  const cursorI = S(JSON.stringify(index.cursor ?? null));
  for (const k of Object.keys(index.kinds || {})) S(k);
  for (const s of index.order || []) S(s);
  const internCast = c => { const sf = (c.surfaces && c.surfaces.length ? c.surfaces : [c.id]) || []; sf.forEach(S); S(c.id); S(c.standing); S(c.first); pairs(c.src).forEach(([k]) => S(k)); };
  const internBond = b => { S(b.a); S(b.b); S(b.first); pairs(b.rel).forEach(([k]) => S(k)); pairs(b.src).forEach(([k]) => S(k)); };
  const internCanon = c => { S(c.a); S(c.b); Object.keys(c.alts || {}).forEach(S); pairs(c.src).forEach(([k]) => S(k)); };
  const internId = i => { S(i.left); S(i.right); pairs(i.events).forEach(([k]) => S(k)); pairs(i.src).forEach(([k]) => S(k)); };
  (index.cast || []).forEach(internCast);
  (index.bonds || []).forEach(internBond);
  (index.canon || []).forEach(internCanon);
  (index.identities || []).forEach(internId);
  for (const name of srcNames) {
    S(name);
    const v = index.sources[name] || {};
    for (const k of ['ops', 'terrain', 'kinds', 'cast', 'bonds', 'idChurn']) pairs(v[k]).forEach(([kk]) => S(kk));
  }
  const schemaI = S(index.schema), fromI = S(index.from), builtAtI = S(index.builtAt);

  const file = new Block();
  file.bytes(MAGIC); file.u16(VERSION);
  const hStr = file.p; file.u32(0);
  const hSec = file.p; file.u32(0);
  const hSrcDir = file.p; file.u32(0);
  const hSrcVal = file.p; file.u32(0);
  file.u32(cursorI);
  file.u32(index.ms || 0); file.u32(index.lines || 0); file.u32(index.bad || 0); file.u32(index.encounters || 0);
  file.u32(index.castTotal || 0); file.u32(index.bondsTotal || 0); file.u32(index.canonTotal || 0); file.u32(index.identitiesTotal || 0);
  file.u32(schemaI); file.u32(fromI); file.u32(builtAtI);
  const hKinds = file.p; file.u32(0);
  const hOrder = file.p; file.u32(0);

  const kinds = pairs(index.kinds);
  const kindsOff = file.p;
  file.u32(kinds.length);
  for (const [k, n] of kinds) { file.u32(S(k)); file.u32(n >>> 0); }

  const order = index.order || [];
  const orderOff = file.p;
  file.u32(order.length);
  for (const s of order) file.u32(S(s));

  const secOff = file.p;
  const castN = (index.cast || []).length, bondsN = (index.bonds || []).length;
  const canonN = (index.canon || []).length, idN = (index.identities || []).length;
  file.u32(0); file.u32(castN);
  file.u32(0); file.u32(bondsN);
  file.u32(0); file.u32(canonN);
  file.u32(0); file.u32(idN);

  const castOff = file.p;
  for (const c of index.cast || []) packCastRow(file, c, S);
  const bondsOff = file.p;
  for (const b of index.bonds || []) packBondRow(file, b, S);
  const canonOff = file.p;
  for (const c of index.canon || []) packCanonRow(file, c, S);
  const idOff = file.p;
  for (const i of index.identities || []) packIdRow(file, i, S);

  file.view.setUint32(secOff, castOff); file.view.setUint32(secOff + 8, bondsOff);
  file.view.setUint32(secOff + 16, canonOff); file.view.setUint32(secOff + 24, idOff);

  const srcDirOff = file.p;
  const sorted = srcNames.map(n => ({ n, i: S(n) })).sort((a, b) => a.n < b.n ? -1 : a.n > b.n ? 1 : 0);
  file.u32(sorted.length);
  const valSlots = [];
  for (const s of sorted) { file.u32(s.i); valSlots.push(file.p); file.u32(0); }
  const srcValOff = file.p;
  for (let i = 0; i < sorted.length; i++) {
    const p = file.p;
    file.view.setUint32(valSlots[i], p);
    packSourceVal(file, index.sources[sorted[i].n], S);
  }

  const strTableOff = file.p;
  file.u32(strings.length + 1); // slot 0 is the empty sentinel
  file.u32(0);
  let off = 0;
  for (const s of strings) { file.u32(off); off += 4 + encoder.encode(s).length; }
  file.u32(off);
  for (const s of strings) { const b = encoder.encode(s); file.u32(b.length); file.bytes(b); }

  file.view.setUint32(hStr, strTableOff); file.view.setUint32(hSec, secOff);
  file.view.setUint32(hSrcDir, srcDirOff); file.view.setUint32(hSrcVal, srcValOff);
  file.view.setUint32(hKinds, kindsOff); file.view.setUint32(hOrder, orderOff);

  return file.done();
}

export class FoldIndex {
  constructor(buf) {
    this._arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    this._v = new DataView(this._arr.buffer, this._arr.byteOffset, this._arr.byteLength);
    if (this._arr.length < HEADER_SIZE || this._arr[0] !== 0x46 || this._arr[1] !== 0x52 || this._arr[2] !== 0x49 || this._arr[3] !== 0x58) {
      throw new Error('not a FRIX index');
    }
    const ver = this._v.getUint16(4);
    if (ver !== VERSION) throw new Error('unknown FRIX version ' + ver);
    this._strTableOff = this._v.getUint32(6);
    this._secTableOff = this._v.getUint32(10);
    this._srcDirOff = this._v.getUint32(14);
    this._srcValOff = this._v.getUint32(18);
    this._cursorOff = this._v.getUint32(22);
    this._kindsOff = this._v.getUint32(70);
    this._orderOff = this._v.getUint32(74);
    this._cast = null; this._bonds = null; this._canon = null; this._identities = null;
    this._sources = null; this._kinds = null; this._order = null; this._cursor = null;
    // Source names repeat across thousands of src maps; decoding each str() once and
    // caching by string index turns ~200k decodes into ~N-unique decodes.
    this._strCache = new Map();
    // The index is immutable, so per-name bondsOf results are safe to cache: the ask
    // path asks about the same names question after question, so repeat lookups are free.
    this._bondsOfCache = new Map();
  }

  get byteLength() { return this._arr.length; }
  get schema() { return this.str(this._v.getUint32(58)); }
  get from() { return this.str(this._v.getUint32(62)); }
  get builtAt() { return this.str(this._v.getUint32(66)); }
  get ms() { return this._v.getUint32(26); }
  get lines() { return this._v.getUint32(30); }
  get bad() { return this._v.getUint32(34); }
  get encounters() { return this._v.getUint32(38); }
  get castTotal() { return this._v.getUint32(42); }
  get bondsTotal() { return this._v.getUint32(46); }
  get canonTotal() { return this._v.getUint32(50); }
  get identitiesTotal() { return this._v.getUint32(54); }
  get cursor() {
    if (this._cursor === null) {
      const s = this.str(this._cursorOff);
      try { this._cursor = s ? JSON.parse(s) : null; } catch { this._cursor = null; }
    }
    return this._cursor;
  }
  get kinds() {
    if (!this._kinds) {
      const o = {};
      let p = this._kindsOff;
      const n = this._v.getUint32(p); p += 4;
      for (let i = 0; i < n; i++) { o[this.str(this._v.getUint32(p))] = this._v.getUint32(p + 4); p += 8; }
      this._kinds = o;
    }
    return this._kinds;
  }
  get order() {
    if (!this._order) {
      let p = this._orderOff;
      const n = this._v.getUint32(p); p += 4;
      const out = new Array(n);
      for (let i = 0; i < n; i++) { out[i] = this.str(this._v.getUint32(p)); p += 4; }
      this._order = out;
    }
    return this._order;
  }

  str(i) {
    if (!i) return '';
    const cached = this._strCache.get(i);
    if (cached !== undefined) return cached;
    const count = this._v.getUint32(this._strTableOff);
    if (i >= count) return '';
    const off = this._v.getUint32(this._strTableOff + 4 + i * 4);
    const base = this._strTableOff + 4 + count * 4 + 4;
    const len = this._v.getUint32(base + off);
    const s = decoder.decode(this._arr.subarray(base + off + 4, base + off + 4 + len));
    this._strCache.set(i, s);
    return s;
  }

  _sec(i) {
    const p = this._secTableOff + i * 8;
    return { off: this._v.getUint32(p), count: this._v.getUint32(p + 4) };
  }
  _map(p, n) {
    const o = {};
    for (let i = 0; i < n; i++) { o[this.str(this._v.getUint32(p))] = this._v.getUint32(p + 4); p += 8; }
    return o;
  }

  _castAt(p) {
    const mentions = this._v.getUint32(p);
    const srcN = this._v.getUint32(p + 4);
    const firstSeq = this._v.getUint32(p + 8);
    const standing = this.str(this._v.getUint32(p + 16));
    const id = this.str(this._v.getUint32(p + 20));
    const first = this.str(this._v.getUint32(p + 24));
    let b = p + HEAD_CAST;
    const sc = this._v.getUint16(b); b += 2;
    const surfaces = new Array(sc);
    for (let i = 0; i < sc; i++) { surfaces[i] = this.str(this._v.getUint32(b)); b += 4; }
    const scount = this._v.getUint16(b); b += 2;
    const src = this._map(b, scount);
    return { id, surfaces, standing, mentions, src, first, firstSeq, srcN };
  }

  _bondAt(p) {
    const n = this._v.getUint32(p);
    const pos = this._v.getUint32(p + 4);
    const neg = this._v.getUint32(p + 8);
    const srcN = this._v.getUint32(p + 12);
    const firstSeq = this._v.getUint32(p + 16);
    const a = this.str(this._v.getUint32(p + 28));
    const b = this.str(this._v.getUint32(p + 32));
    const first = this.str(this._v.getUint32(p + 36));
    let q = p + HEAD_BONDS;
    const rcount = this._v.getUint16(q); q += 2;
    const rel = this._map(q, rcount); q += rcount * 8;
    const scount = this._v.getUint16(q); q += 2;
    const src = this._map(q, scount);
    return { a, b, n, rel, pos, neg, src, first, firstSeq, srcN };
  }

  _canonAt(p) {
    const n = this._v.getUint32(p);
    const a = this.str(this._v.getUint32(p + 4));
    const b = this.str(this._v.getUint32(p + 8));
    const srcN = this._v.getUint32(p + 12);
    let q = p + HEAD_CANON;
    const ac = this._v.getUint16(q); q += 2;
    const alts = {};
    for (let i = 0; i < ac; i++) { const s = this.str(this._v.getUint32(q)); alts[s] = 1; q += 4; }
    const scount = this._v.getUint16(q); q += 2;
    const src = this._map(q, scount);
    return { a, b, n, alts, src, srcN };
  }

  _idAt(p) {
    const n = this._v.getUint32(p);
    const left = this.str(this._v.getUint32(p + 4));
    const right = this.str(this._v.getUint32(p + 8));
    const srcN = this._v.getUint32(p + 12);
    let q = p + HEAD_IDENT;
    const ecount = this._v.getUint16(q); q += 2;
    const events = this._map(q, ecount); q += ecount * 8;
    const scount = this._v.getUint16(q); q += 2;
    const src = this._map(q, scount);
    return { left, right, n, events, src, srcN };
  }

  _sourceAt(p) {
    const chunks = this._v.getUint32(p);
    const chars = this._v.getUint32(p + 4);
    let q = p + HEAD_SOURCE;
    const out = {};
    for (const k of ['ops', 'terrain', 'kinds', 'cast', 'bonds', 'idChurn']) {
      const c = this._v.getUint16(q); q += 2;
      out[k] = this._map(q, c);
      q += c * 8;
    }
    return { chunks, chars, ...out };
  }

  get cast() {
    if (!this._cast) {
      const s = this._sec(SEC_CAST);
      const out = new Array(s.count);
      let p = s.off;
      for (let i = 0; i < s.count; i++) { out[i] = this._castAt(p); p += HEAD_CAST + this._v.getUint32(p + HEAD_CAST - 4); }
      this._cast = out;
    }
    return this._cast;
  }
  get bonds() {
    if (!this._bonds) {
      const s = this._sec(SEC_BONDS);
      const out = new Array(s.count);
      let p = s.off;
      for (let i = 0; i < s.count; i++) { out[i] = this._bondAt(p); p += HEAD_BONDS + this._v.getUint32(p + HEAD_BONDS - 4); }
      this._bonds = out;
    }
    return this._bonds;
  }
  get canon() {
    if (!this._canon) {
      const s = this._sec(SEC_CANON);
      const out = new Array(s.count);
      let p = s.off;
      for (let i = 0; i < s.count; i++) { out[i] = this._canonAt(p); p += HEAD_CANON + this._v.getUint32(p + HEAD_CANON - 4); }
      this._canon = out;
    }
    return this._canon;
  }
  get identities() {
    if (!this._identities) {
      const s = this._sec(SEC_IDENTITIES);
      const out = new Array(s.count);
      let p = s.off;
      for (let i = 0; i < s.count; i++) { out[i] = this._idAt(p); p += HEAD_IDENT + this._v.getUint32(p + HEAD_IDENT - 4); }
      this._identities = out;
    }
    return this._identities;
  }
  get sources() {
    if (!this._sources) {
      const out = {};
      let p = this._srcDirOff;
      const n = this._v.getUint32(p); p += 4;
      for (let i = 0; i < n; i++) {
        const name = this.str(this._v.getUint32(p));
        out[name] = this._sourceAt(this._v.getUint32(p + 4));
        p += 8;
      }
      this._sources = out;
    }
    return this._sources;
  }

  /**
   * Every source, ops map only — what the sources list renders (chunks + CON/INS/REC).
   * Decodes one u16-counted map per source instead of all six, so the reading panel never
   * materializes the full sources graph.
   */
  sourcesMeta() {
    const out = {};
    let p = this._srcDirOff;
    const n = this._v.getUint32(p); p += 4;
    for (let i = 0; i < n; i++) {
      const name = this.str(this._v.getUint32(p));
      const valOff = this._v.getUint32(p + 4);
      p += 8;
      const chunks = this._v.getUint32(valOff);
      const chars = this._v.getUint32(valOff + 4);
      const q = valOff + HEAD_SOURCE;
      const ops = this._map(q + 2, this._v.getUint16(q));
      out[name] = { chunks, chars, ops };
    }
    return out;
  }

  /** First n identities (the section is pre-ranked by n desc), skipping the rest. */
  identitiesTop(n) {
    const s = this._sec(SEC_IDENTITIES);
    const out = [];
    let p = s.off;
    for (let i = 0; i < s.count && i < n; i++) { out.push(this._idAt(p)); p += HEAD_IDENT + this._v.getUint32(p + HEAD_IDENT - 4); }
    return out;
  }

  /**
   * Every bond, without the src map — what the bonds list renders (a/b, n, srcN, rel, neg).
   * Skips the variable src body so the load/back panel does not decode 3000 src maps.
   */
  eachBond(fn) {
    const s = this._sec(SEC_BONDS);
    const out = [];
    let p = s.off;
    for (let i = 0; i < s.count; i++) {
      const n = this._v.getUint32(p);
      const pos = this._v.getUint32(p + 4);
      const neg = this._v.getUint32(p + 8);
      const srcN = this._v.getUint32(p + 12);
      const a = this.str(this._v.getUint32(p + 28));
      const b = this.str(this._v.getUint32(p + 32));
      const q = p + HEAD_BONDS;
      const rcount = this._v.getUint16(q);
      const rel = this._map(q + 2, rcount);
      const row = { a, b, n, rel, pos, neg, srcN };
      if (fn) fn(row); else out.push(row);
      p += HEAD_BONDS + this._v.getUint32(p + HEAD_BONDS - 4);
    }
    return out;
  }

  /** Random access to one source's block (binary search on the sorted dir). */
  source(name) {
    let p = this._srcDirOff;
    const n = this._v.getUint32(p); p += 4;
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const q = p + mid * 8;
      const nm = this.str(this._v.getUint32(q));
      if (nm === name) return this._sourceAt(this._v.getUint32(q + 4));
      if (nm < name) lo = mid + 1; else hi = mid - 1;
    }
    return null;
  }

  /** Header-only rank: sort by (srcN desc, mentions desc), decode bodies only for the top n. */
  castTop(n) {
    const s = this._sec(SEC_CAST);
    const cand = new Array(s.count);
    let p = s.off;
    for (let i = 0; i < s.count; i++) {
      cand[i] = { srcN: this._v.getUint32(p + 4), mentions: this._v.getUint32(p), p };
      p += HEAD_CAST + this._v.getUint32(p + HEAD_CAST - 4);
    }
    cand.sort((a, b) => b.srcN - a.srcN || b.mentions - a.mentions);
    const out = cand.slice(0, Math.max(0, n));
    return out.map(c => this._castAt(c.p));
  }

  /** Bonds touching `name` — FNV-1a header stride, decode only matches, top n by n desc. */
  bondsOf(name, n = 5) {
    const key = name + '|' + n;
    const hit = this._bondsOfCache.get(key);
    if (hit) return hit;
    const h = fnv1a32(String(name ?? ''));
    const s = this._sec(SEC_BONDS);
    const out = [];
    let p = s.off;
    for (let i = 0; i < s.count; i++) {
      if (this._v.getUint32(p + 20) === h || this._v.getUint32(p + 24) === h) out.push(this._bondAt(p));
      p += HEAD_BONDS + this._v.getUint32(p + HEAD_BONDS - 4);
    }
    const top = out.sort((a, b) => b.n - a.n).slice(0, n);
    this._bondsOfCache.set(key, top);
    return top;
  }
}

/** Materialize a packed index into the plain FoldReadingIndex@2 object shape. */
export function unpackIndex(bytes) {
  const ix = new FoldIndex(bytes);
  return {
    schema: ix.schema, from: ix.from, cursor: ix.cursor, builtAt: ix.builtAt,
    ms: ix.ms, lines: ix.lines, bad: ix.bad, encounters: ix.encounters,
    castTotal: ix.castTotal, bondsTotal: ix.bondsTotal, canonTotal: ix.canonTotal, identitiesTotal: ix.identitiesTotal,
    kinds: ix.kinds, order: ix.order,
    cast: ix.cast, bonds: ix.bonds, canon: ix.canon, identities: ix.identities, sources: ix.sources,
  };
}

/** Browser OPFS read → ArrayBuffer|null (same contract as the app's opfsRead). */
export async function opfsReadBinary(path) {
  try {
    const parts = path.split('/');
    const name = parts.pop();
    let d = await navigator.storage.getDirectory();
    for (const p of parts.filter(Boolean)) d = await d.getDirectoryHandle(p);
    const fh = await d.getFileHandle(name);
    return await (await fh.getFile()).arrayBuffer();
  } catch (e) {
    return null;
  }
}