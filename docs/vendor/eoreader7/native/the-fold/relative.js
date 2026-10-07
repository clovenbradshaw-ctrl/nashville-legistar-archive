// relative.js — an experiment: addresses that are relative, resolution by state.
//
// The keyless memory in three tiers (field-of-record.js): THE HOLOGRAPH, THE
// SHADOW, THE ECHO (2026-09-11, user-given).
//
//   THE HOLOGRAPH — the first tier, and the record, merged: a node keeps the
//     full tokens AND the address — both sides. "If it has the full tokens,
//     it's the real thing." Re-expandable to the ground; the only tier the
//     mouth reads. (Before the record there is only the file — the raw bytes,
//     unread.)
//   THE SHADOW — the second tier: a node keeps only its state (which words and
//     pairs lit which bits) and the address, NO words. Recall-only: "have I
//     met this," and where. A lien on content, never the content; re-expands
//     only through the record. The deidentified RESIDUE of significance — what
//     the DEF/EVA/REC calculus left behind when it passed: an echo is not a
//     sound, it is the trace of a sound.
//   THE ECHO — the third tier, the coarse minimum: a low-resolution state and
//     the address. "Something like this was said here," cheap over a million
//     pages or a whole room. The coarsest grain of the shadow's residue.
//     Never read back into full EOT — it only says whether to bother looking.
//
// Graceful and never exact: the shadow and echo degrade, and say by how much.
// Ground casts; the holograph holds; the shadow and echo follow; the pattern
// measures the light (relative-pattern.js). Resolution is the size knob,
// measured by GFP Pass 36, never picked by hand.
//
// Everything the record holds today is reached by an ABSOLUTE address: a seq
// in a ledger, `name#start-end` into a source's bytes, an mxc in a media
// store. That is a graph database's way — a key, a lookup, exact or nothing.
// A brain has no such keys. A neuron is where its connections put it, a
// memory is a pattern the network settles into from a partial cue, and an
// address is only ever RELATIVE: to the cue that is active now, or to the
// neighbour one step away.
//
// This module is that other way, kept pure so it can be measured:
//
//   sdrOf(text)         a sparse distributed representation — the "state"
//                       a text puts the field into: which of n bits it lights
//   Field               nodes with NO keys. The only ways in are recall(cue)
//                       — start from a state and let activation spread until
//                       it settles — and after(node)/before(node), one
//                       synapse along. There is no get(id). There is no id.
//   nullBand(field, …)  what a cue of that length pulls out of this field by
//                       chance: measured with random cues, never chosen
//   serialize()         nodes with their neighbours named by signature, not
//                       by position, so a re-ordered or re-numbered store
//                       rebuilds the same field
//
// And the third thing the two ways of addressing make between them — the
// Pattern over the Ground and the Figure: `reanchor` and `drift` in
// relative-pattern.js, which take an absolute address and a figure recalled
// from the same bytes and say whether they still agree, and mint the ground
// address anew from the figure when they do not.
//
// Structural constants, stated: n = 4096 bits per state; a token lights one
// bit. Density is whatever the text makes it; overlap is cosine over bits,
// so long and short texts compare on one scale. No activation threshold is
// chosen anywhere — the null band decides what counts as a recall.

// Declared, not measured (spec F4, P130): set by hand for the 2026-09-07
// relative-address experiment, the value every number in
// GROUND-FIGURE-PATTERN-SPEC.md §0 was measured with — a structural size,
// never a cut (nothing is decided against it). GFP Pass 36 measures its
// sensitivity (2,048 / 4,096 / 8,192) and confirms or replaces it in the
// record.
export const SDR_BITS = 4096;
/** THE ECHO's resolution — the coarse minimum (2026-09-11). Declared, not
 * measured: set by hand for the third tier, a structural size, never a cut.
 * GFP Pass 36 measures the whole ladder's sensitivity (2,048 / 4,096 / 8,192
 * and below) and confirms or replaces both this and SDR_BITS in the record. */
export const ECHO_BITS = 512;
/** Joins an ordered pair of words into one token; a word never contains it. */
export const PAIR = "\u0001";
export const isWord = (t) => !t.includes(PAIR);

/** FNV-1a over a string, 32 bits; the same token lights the same bit anywhere. */
export function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** Words and their ordered pairs — order is part of the state, so "war and
 * peace" and "peace and war" light different bits. */
export function tokensOf(text) {
  const words = String(text ?? "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const out = words.slice();
  for (let i = 1; i < words.length; i++) out.push(`${words[i - 1]}${PAIR}${words[i]}`);
  return out;
}
/** The state a text lights: a sorted array of distinct bit indices. */
export function sdrOf(text, { bits = SDR_BITS } = {}) {
  const set = new Set();
  for (const t of tokensOf(text)) set.add(hash32(t) % bits);
  return Uint32Array.from([...set].sort((a, b) => a - b));
}
/** |a ∩ b| over sorted index arrays. */
export function sharedBits(a, b) {
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { n++; i++; j++; } else if (a[i] < b[j]) i++; else j++; }
  return n;
}
/** Cosine over lit bits: 1 for the same state, 0 for nothing shared. */
export function overlap(a, b) { return a.length && b.length ? sharedBits(a, b) / Math.sqrt(a.length * b.length) : 0; }

// GFP PASS 36 (second half) — the PACKED shadow: a state as a bitfield
// (ceil(bits/8) bytes) instead of sparse indices. Overlap becomes a bitwise
// AND + popcount — 2.4× smaller in memory, SIMD-ready — and the packed row is
// the truly-small store (a 512-bit echo = 64 bytes = ~88 base64 chars).
const POPCOUNT8 = (() => { const t = new Uint8Array(256); for (let i = 1; i < 256; i++) t[i] = t[i >> 1] + (i & 1); return t; })();
/** Pack a sparse state into a bitfield: bit i is set iff i is in the state. */
export function packSdr(sdr, { bits = SDR_BITS } = {}) {
  const out = new Uint8Array(Math.ceil(bits / 8));
  for (let i = 0; i < sdr.length; i++) { const b = sdr[i]; out[b >> 3] |= 1 << (b & 7); }
  return out;
}
/** Number of set bits in a packed state. */
export function popcountPacked(u8) { let n = 0; for (let i = 0; i < u8.length; i++) n += POPCOUNT8[u8[i]]; return n; }
/** Cosine over two packed states of the SAME byte length. */
export function packedOverlap(a, b) {
  if (!a?.length || !b?.length) return 0;
  let shared = 0;
  for (let i = 0; i < a.length; i++) shared += POPCOUNT8[a[i] & b[i]];
  const wa = popcountPacked(a), wb = popcountPacked(b);
  return wa && wb ? shared / Math.sqrt(wa * wb) : 0;
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** The packed row's store form — base64, browser-safe, no Buffer. */
export function bytesToBase64(u8) {
  let out = "";
  for (let i = 0; i < u8.length; i += 3) {
    const b0 = u8[i], b1 = u8[i + 1], b2 = u8[i + 2];
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += b1 !== undefined ? B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] : "=";
    out += b2 !== undefined ? B64[b2 & 63] : "=";
  }
  return out;
}
export function base64ToBytes(s) {
  const out = []; let buf = 0, nb = 0;
  for (const c of s) { if (c === "=") break; const v = B64.indexOf(c); if (v < 0) continue; buf = (buf << 6) | v; nb += 6; if (nb >= 8) { nb -= 8; out.push((buf >> nb) & 255); } }
  return Uint8Array.from(out);
}

/** A node is a state, a payload, and its synapses. It has no key.
 * `tier` is one of the memory's three resolutions:
 *   "holograph" — the record merged: full tokens AND the address, both sides.
 *     Re-expandable to the ground; the only tier the mouth reads.
 *   "shadow" — state + address, NO words. Recall-only; re-expands only
 *     through the record; a lien on content, never the content.
 *   "echo" — the coarse minimum: a low-resolution state + address, no words.
 * For shadow and echo there is no text to rebuild the state from, so the
 * state is persisted on the store; the signature is over the state. */
class Node {
  constructor(text, payload, tier = "holograph", sdr = null) {
    this.tier = tier;
    this.sdr = sdr ?? sdrOf(text, { bits: tier === "echo" ? ECHO_BITS : SDR_BITS });
    this.text = tier === "holograph" ? text : null;
    this.payload = payload;
    this.next = new Map(); this.prev = new Map();
    this.signature = tier === "holograph" ? hash32(text).toString(16) : stateSignature(this.sdr);
  }
}
/** A state's own signature: FNV-1a over the lit bit indices, so a store with
 * no words can still name a node by what it is. */
function stateSignature(sdr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < sdr.length; i++) { h ^= sdr[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

/**
 * The field. Admit texts in the order they arrived and each is joined to the
 * one before it by a synapse of weight 1 (temporal adjacency — what a brain
 * gets for free from time). Recall starts from a cue's state, activates every
 * node by overlap, then lets activation spread along synapses for `steps`
 * rounds with gain `spread`, and reports where it settled. Nothing here is
 * looked up; everything is reached.
 */
export class Field {
  constructor({ spread = 0.25, steps = 1, packed = false } = {}) { this.nodes = []; this.spread = spread; this.steps = steps; this.last = null; this.vocab = new Map(); this.posting = new Map(); this._index = null; this.packed = Boolean(packed); }
  get size() { return this.nodes.length; }
  /** The set bits of a state, whichever form — sparse indices or packed bytes. */
  static setBitsOf(sdr) {
    const out = [];
    if (sdr instanceof Uint8Array) { for (let b = 0; b < sdr.length * 8; b++) if (sdr[b >> 3] & (1 << (b & 7))) out.push(b); }
    else { for (let k = 0; k < sdr.length; k++) out.push(sdr[k]); }
    return out;
  }
  /** Rebuild the posting lists (bit → node indices) — the recall index of GFP
   * Pass 36. Bits are FEATURES, never addresses of nodes (F1 still holds); the
   * posting is derived from the states and is always rebuildable. */
  buildPostings() {
    this.posting = new Map(); this._index = null;
    for (let i = 0; i < this.nodes.length; i++) {
      for (const bit of Field.setBitsOf(this.nodes[i].sdr)) {
        let list = this.posting.get(bit);
        if (!list) { list = []; this.posting.set(bit, list); }
        list.push(i);
      }
    }
    return this;
  }
  /** Admit a text as one of the memory's tiers: "holograph" (full tokens +
   * address), "shadow" (state + address, no words), "echo" (coarse state +
   * address, no words). A PACKED field stores each state as a bitfield —
   * 2.4× smaller, bitwise overlap (GFP Pass 36 second half). */
  admit(text, payload = null, { after = this.last, tier = "holograph" } = {}) {
    const bits = tier === "echo" ? ECHO_BITS : SDR_BITS;
    const raw = sdrOf(text, { bits });
    const node = new Node(text, payload, tier, this.packed ? packSdr(raw, { bits }) : raw);
    if (after) { after.next.set(node, (after.next.get(node) ?? 0) + 1); node.prev.set(after, (node.prev.get(after) ?? 0) + 1); }
    this.nodes.push(node); this.last = node; this._index = null;
    const i = this.nodes.length - 1;
    for (const bit of Field.setBitsOf(node.sdr)) {
      let list = this.posting.get(bit);
      if (!list) { list = []; this.posting.set(bit, list); }
      list.push(i);
    }
    for (const w of tokensOf(text)) if (isWord(w)) this.vocab.set(w, (this.vocab.get(w) ?? 0) + 1);
    return node;
  }
  /** Strengthen a synapse between two nodes that were reached together (Hebb). */
  bind(a, b, w = 1) { a.next.set(b, (a.next.get(b) ?? 0) + w); b.prev.set(a, (b.prev.get(a) ?? 0) + w); }
  /** One synapse forward or back: the neighbour the strongest link names. */
  after(node) { let best = null, bw = 0; for (const [n, w] of node.next) if (w > bw) { best = n; bw = w; } return best; }
  before(node) { let best = null, bw = 0; for (const [n, w] of node.prev) if (w > bw) { best = n; bw = w; } return best; }
  /**
   * Start from a cue's state and settle. Returns the nodes in activation
   * order with the activation each settled at; nothing about which counts
   * as a recall — that is the null band's to say (see `recallAgainstNull`).
   */
  recall(cue, { steps = this.steps, spread = this.spread } = {}) {
    const q = typeof cue === "string" ? (this.packed ? packSdr(sdrOf(cue)) : sdrOf(cue)) : cue;
    let a = new Float64Array(this.nodes.length);
    const n = this.nodes.length;
    if (this._index === null || this._index.size !== n) this._index = new Map(this.nodes.map((nd, i) => [nd, i]));
    const index = this._index;
    // Posting lists (GFP Pass 36): only nodes that SHARE a lit bit with the cue
    // can have non-zero overlap, so activation touches the intersection set, not
    // the whole field. An empty cue or an empty posting (tiny field, or an echo
    // whose state is below the cue's) falls back to the full scan — identical
    // result either way, because a node sharing no bit has overlap exactly 0.
    const seen = new Set();
    const cueBits = Field.setBitsOf(q);
    for (let k = 0; k < cueBits.length; k++) {
      const list = this.posting.get(cueBits[k]);
      if (list) for (let j = 0; j < list.length; j++) if (!seen.has(list[j])) seen.add(list[j]);
    }
    const score = this.packed ? packedOverlap : overlap;
    if (seen.size) {
      for (const i of seen) a[i] = score(q, this.nodes[i].sdr);
    } else {
      for (let i = 0; i < n; i++) a[i] = score(q, this.nodes[i].sdr);
    }
    for (let s = 0; s < steps; s++) {
      const b = Float64Array.from(a);
      for (let i = 0; i < this.nodes.length; i++) {
        if (!a[i]) continue;
        for (const [n, w] of this.nodes[i].next) b[index.get(n)] += spread * w * a[i];
        for (const [n, w] of this.nodes[i].prev) b[index.get(n)] += spread * w * a[i];
      }
      a = b;
    }
    const order = [];
    const nz = [];
    for (let i = 0; i < a.length; i++) { if (a[i] !== 0) nz.push(i); else order.push(i); }
    // Sparse sort (GFP Pass 36): only the nodes the cue actually reached are
    // ranked; the untouched zeros follow in index order — the exact order the
    // stable full sort would produce, at the cost of the intersection set
    // rather than the whole field.
    nz.sort((i, j) => a[j] - a[i]);
    return [...nz, ...order].map((i) => ({ node: this.nodes[i], activation: a[i] }));
  }
  /**
   * What a cue of `tokenCount` words pulls out of THIS field by chance: random
   * words drawn from the field's own vocabulary, `draws` times; the band is
   * the lowest and highest top activation seen, and the widest gap between a
   * top and its runner-up. Measured, not chosen.
   *
   * `steps`/`spread` are NEW (2026-09-08), additive, and default to the
   * field's own — every existing caller is byte-identical. They exist
   * because a null band measured at one hop count is the wrong control for
   * a recall measured at another: more spreading steps changes what chance
   * alone can pull out of this field, so a multi-hop question ("does this
   * cue still settle on something above chance after N hops") needs its own
   * band at that same N, never the field's default band reused past hop 1.
   */
  nullBand(tokenCount, { draws = 200, rng = Math.random, steps = this.steps, spread = this.spread } = {}) {
    const words = [...this.vocab.keys()];
    if (!words.length || !this.nodes.length) return { lo: 0, hi: 0, margin: 0, draws: 0, steps };
    let lo = Infinity, hi = 0, margin = 0;
    for (let d = 0; d < draws; d++) {
      const cue = Array.from({ length: Math.max(1, tokenCount) }, () => words[Math.floor(rng() * words.length)]).join(" ");
      const r = this.recall(cue, { steps, spread });
      const top = r[0]?.activation ?? 0, second = r[1]?.activation ?? 0;
      lo = Math.min(lo, top); hi = Math.max(hi, top); margin = Math.max(margin, top - second);
    }
    return { lo: lo === Infinity ? 0 : lo, hi, margin, draws, steps };
  }
  /**
   * A recall that says whether it is one: the top node when its activation
   * clears the null band AND its lead over the runner-up exceeds the widest
   * lead chance produced; `ambiguous` when the field settled on more than
   * one figure; `nothing` when it is inside the band.
   *
   * `steps`/`spread` (new, additive, default the field's own — every
   * existing caller unchanged): passed to BOTH the recall and a
   * self-measured band, so a caller cannot accidentally compare a hop-N
   * recall against a hop-1 band by only setting one of the two. A `band`
   * passed in explicitly is trusted as already measured at the right hop
   * count — the caller's own responsibility, same as before.
   */
  recallAgainstNull(cue, { band = null, draws = 200, steps = this.steps, spread = this.spread } = {}) {
    const words = tokensOf(cue).filter(isWord).length;
    const b = band ?? this.nullBand(words, { draws, steps, spread });
    const r = this.recall(cue, { steps, spread });
    const top = r[0], second = r[1];
    if (!top || top.activation <= b.hi) return { kind: "nothing", top: top ?? null, band: b, ranked: r };
    if (second && top.activation - second.activation <= b.margin) return { kind: "ambiguous", top, second, band: b, ranked: r };
    return { kind: "figure", top, band: b, ranked: r };
  }
  /** Nodes with their neighbours named by SIGNATURE — a store with no positions.
   * A shadow or echo node (no text) persists its STATE (`sdr`), since nothing
   * else can rebuild it; a holograph node rebuilds its state from its words.
   * A PACKED node persists its bitfield as base64 — the truly-small row. */
  serialize() {
    return this.nodes.map((n) => ({ tier: n.tier, text: n.text, ...(n.tier !== "holograph" ? { sdr: n.sdr instanceof Uint8Array ? bytesToBase64(n.sdr) : Array.from(n.sdr), ...(n.sdr instanceof Uint8Array ? { packed: true } : {}) } : {}), payload: n.payload, signature: n.signature, next: [...n.next].map(([m, w]) => [m.signature, w]), prev: [...n.prev].map(([m, w]) => [m.signature, w]) }));
  }
  static deserialize(rows, opts) {
    const f = new Field(opts);
    const bySig = new Map();
    for (const r of rows) {
      const tier = r.tier ?? (r.text == null ? "shadow" : "holograph");
      let restored = null;
      if (tier !== "holograph") { if (r.packed && typeof r.sdr === "string") restored = base64ToBytes(r.sdr); else if (Array.isArray(r.sdr)) restored = Uint32Array.from(r.sdr); }
      const n = tier === "holograph" ? new Node(r.text, r.payload, "holograph", f.packed ? packSdr(sdrOf(r.text), { bits: SDR_BITS }) : null) : new Node("", r.payload, tier, restored);
      bySig.set(r.signature, n); f.nodes.push(n);
      if (r.text) for (const w of tokensOf(r.text)) if (isWord(w)) f.vocab.set(w, (f.vocab.get(w) ?? 0) + 1);
    }
    for (const r of rows) { const n = bySig.get(r.signature); for (const [sig, w] of r.next ?? []) { const m = bySig.get(sig); if (m) n.next.set(m, w); } for (const [sig, w] of r.prev ?? []) { const m = bySig.get(sig); if (m) n.prev.set(m, w); } }
    f.last = f.nodes.at(-1) ?? null;
    f.buildPostings();
    return f;
  }
}
