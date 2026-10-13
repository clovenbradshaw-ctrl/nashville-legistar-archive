// holodeck-pcm.js — a recording's sound as 16 kHz mono windows, without ever holding
// the whole decoded track.
//
// Why: Chrome's decodeAudioData decodes a file in one piece at its native rate. A
// three-hour meeting (85 MB of AAC) peaked at 8.3 GB in the renderer and then failed
// with "Unable to decode audio data"; the ingest reader, the sound classifier, Whisper
// and the waveform each did that decode, some of them at once, so a long recording took
// the tab down. Here the container is demuxed by hand (MP4/M4A/MOV, WebM, MP3, ADTS AAC,
// WAV), the packets go through WebCodecs' AudioDecoder, and only one window of decoded
// sound is alive at a time. Anything else falls back to decodeAudioData, as before.
//
//   probeAudio(bytes)               -> { container, codec, sampleRate, channels, duration } | null
//   pcm16k(bytes, { winSec })       -> async iterator of { pcm: Float32Array, start: seconds }
//   audioDuration(bytes)            -> seconds | null   (container metadata, no decode)
//   demuxAudio(bytes)               -> the container read (metadata + packets), no decode
//
// Every window except the last is exactly winSec * 16000 samples, and `start` is the sum
// of the windows before it, so time is counted in decoded samples, not packet stamps.

export const RATE = 16000;

const u8 = b => b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null;
async function bytesOf(x) { if (typeof Blob !== 'undefined' && x instanceof Blob) return new Uint8Array(await x.arrayBuffer()); return u8(x); }
const str4 = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const be32 = (b, o) => (b[o] * 0x1000000) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const le32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000;
const le16 = (b, o) => b[o] | (b[o + 1] << 8);

// ---------- MP4 / M4A / MOV ----------
function boxes(b, start, end) {
  const out = []; let o = start;
  while (o + 8 <= end) {
    let size = be32(b, o); const type = str4(b, o + 4); let hdr = 8;
    if (size === 1) { size = be32(b, o + 8) * 0x100000000 + be32(b, o + 12); hdr = 16; }
    else if (size === 0) size = end - o;
    if (size < hdr || o + size > end) break;
    out.push({ type, start: o, body: o + hdr, end: o + size }); o += size;
  }
  return out;
}
const child = (b, box, type) => box && boxes(b, box.body, box.end).find(x => x.type === type);
function descLen(b, o) { let n = 0, i = 0; for (; i < 4; i++) { const c = b[o + i]; n = (n << 7) | (c & 0x7f); if (!(c & 0x80)) break; } return [n, i + 1]; }
function esdsConfig(b, box) {
  let o = box.body + 4; if (b[o] !== 0x03) return null; let [, k] = descLen(b, o + 1); o += 1 + k;
  const fl = b[o + 2]; o += 3; if (fl & 0x80) o += 2; if (fl & 0x40) o += 1 + b[o]; if (fl & 0x20) o += 2;
  if (b[o] !== 0x04) return null; [, k] = descLen(b, o + 1); o += 1 + k;
  const oti = b[o]; o += 13;
  let asc = null; if (b[o] === 0x05) { const [n, k2] = descLen(b, o + 1); asc = b.slice(o + 1 + k2, o + 1 + k2 + n); }
  return { oti, asc };
}
function demuxMp4(b) {
  const top = boxes(b, 0, b.length); const moov = top.find(x => x.type === 'moov'); if (!moov) return null;
  for (const trak of boxes(b, moov.body, moov.end).filter(x => x.type === 'trak')) {
    const mdia = child(b, trak, 'mdia'); const hdlr = child(b, mdia, 'hdlr'); if (!hdlr || str4(b, hdlr.body + 8) !== 'soun') continue;
    const mdhd = child(b, mdia, 'mdhd'); const v = b[mdhd.body];
    const timescale = v === 1 ? be32(b, mdhd.body + 20) : be32(b, mdhd.body + 12);
    const durUnits = v === 1 ? be32(b, mdhd.body + 24) * 0x100000000 + be32(b, mdhd.body + 28) : be32(b, mdhd.body + 16);
    const stbl = child(b, child(b, mdia, 'minf'), 'stbl'); if (!stbl) continue;
    const stsd = child(b, stbl, 'stsd'); const ent = boxes(b, stsd.body + 8, stsd.end)[0]; if (!ent) continue;
    const ver = be16(b, ent.body + 8); const channels = be16(b, ent.body + 16); const sampleRate = be32(b, ent.body + 24) / 65536;
    const kids = boxes(b, ent.body + 28 + (ver === 1 ? 16 : ver === 2 ? 36 : 0), ent.end);
    let codec = null, description;
    if (ent.type === 'mp4a') {
      const esds = kids.find(x => x.type === 'esds') || (kids.find(x => x.type === 'wave') && child(b, kids.find(x => x.type === 'wave'), 'esds'));
      const c = esds && esdsConfig(b, esds); if (!c) continue;
      if (c.oti === 0x40 || c.oti === 0x66 || c.oti === 0x67 || c.oti === 0x68) { let aot = c.asc && c.asc.length ? c.asc[0] >> 3 : 2; if (aot === 31 && c.asc.length > 1) aot = 32 + (((c.asc[0] & 7) << 3) | (c.asc[1] >> 5)); codec = 'mp4a.40.' + aot; description = c.asc || undefined; }
      else if (c.oti === 0x6b || c.oti === 0x69) codec = 'mp3';
    } else if (ent.type === '.mp3') codec = 'mp3';
    else if (ent.type === 'Opus') { const d = kids.find(x => x.type === 'dOps'); if (d) { codec = 'opus'; description = opusHeadFromDops(b.slice(d.body, d.end)); } }
    else if (ent.type === 'fLaC') { const d = kids.find(x => x.type === 'dfLa'); if (d) { codec = 'flac'; description = new Uint8Array([0x66, 0x4c, 0x61, 0x43, ...b.slice(d.body + 4, d.end)]); } }
    if (!codec) continue;
    // the edit list's media_time is the encoder's priming (AAC: 1024 or 2112 samples) — dropped from the front
    let skipSec = 0; const elst = child(b, child(b, trak, 'edts'), 'elst');
    if (elst && be32(b, elst.body + 4) >= 1) { const ev = b[elst.body]; const mt = ev === 1 ? be32(b, elst.body + 16) * 0x100000000 + be32(b, elst.body + 20) : be32(b, elst.body + 12); if (mt > 0 && mt < 0x7fffffff && timescale) skipSec = mt / timescale; }
    // sample table -> packets
    const stsz = child(b, stbl, 'stsz'), stsc = child(b, stbl, 'stsc'), stco = child(b, stbl, 'stco') || child(b, stbl, 'co64'), stts = child(b, stbl, 'stts');
    if (!stsz || !stsc || !stco) continue;
    const fixed = be32(b, stsz.body + 4), count = be32(b, stsz.body + 8);
    const size = i => fixed || be32(b, stsz.body + 12 + i * 4);
    const big = stco.type === 'co64'; const nChunks = be32(b, stco.body + 4);
    const chunkOff = i => big ? be32(b, stco.body + 8 + i * 8) * 0x100000000 + be32(b, stco.body + 12 + i * 8) : be32(b, stco.body + 8 + i * 4);
    const runs = []; const nr = be32(b, stsc.body + 4); for (let i = 0; i < nr; i++) runs.push([be32(b, stsc.body + 8 + i * 12), be32(b, stsc.body + 12 + i * 12)]);
    const deltas = []; if (stts) { const n = be32(b, stts.body + 4); for (let i = 0; i < n; i++) deltas.push([be32(b, stts.body + 8 + i * 8), be32(b, stts.body + 12 + i * 8)]); }
    const packets = (function* () {
      let s = 0, r = 0, di = 0, dLeft = deltas.length ? deltas[0][0] : Infinity, t = 0;
      for (let c = 0; c < nChunks && s < count; c++) {
        while (r + 1 < runs.length && runs[r + 1][0] <= c + 1) r++;
        let off = chunkOff(c);
        for (let k = 0; k < runs[r][1] && s < count; k++, s++) {
          const sz = size(s); yield { off, size: sz, us: Math.round(t / timescale * 1e6) };
          off += sz; const d = deltas.length ? deltas[di][1] : 1024; t += d;
          if (--dLeft <= 0 && di + 1 < deltas.length) { di++; dLeft = deltas[di][0]; }
        }
      }
    })();
    return { container: 'mp4', codec, sampleRate, channels, description, skipSec, duration: timescale ? durUnits / timescale : null, packets };
  }
  return null;
}
function opusHeadFromDops(d) { // dOps (big-endian, version 0) -> OpusHead (little-endian), what WebCodecs takes
  const out = new Uint8Array(19 + (d[10] ? 2 + d[1] : 0)); out.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, d[1]]);
  out[10] = d[3]; out[11] = d[2]; out[12] = d[7]; out[13] = d[6]; out[14] = d[5]; out[15] = d[4]; out[16] = d[9]; out[17] = d[8]; out[18] = d[10];
  if (d[10]) out.set(d.slice(11, 13 + d[1]), 19); return out;
}

// ---------- WebM / Matroska ----------
function vint(b, o, keepMarker) {
  const f = b[o]; let len = 1, m = 0x80; while (len <= 8 && !(f & m)) { m >>= 1; len++; } if (len > 8) return null;
  let v = keepMarker ? f : f & (m - 1); let allOnes = (f & (m - 1)) === m - 1;
  for (let i = 1; i < len; i++) { v = v * 256 + b[o + i]; if (b[o + i] !== 0xff) allOnes = false; }
  return { v, len, unknown: !keepMarker && allOnes };
}
const MASTERS = new Set([0x18538067, 0x1654AE6B, 0xAE, 0xE1, 0x1F43B675, 0xA0, 0x1549A966]);
function demuxWebm(b) {
  if (be32(b, 0) !== 0x1A45DFA3) return null;
  let scale = 1e6, duration = null; const tracks = []; let tr = null;
  let o = 0; let clusterTc = 0; let firstCluster = -1;
  // a flat scan: masters are entered, leaves are read — headers up to the first cluster
  while (o < b.length) {
    const id = vint(b, o, true); if (!id) break; const sz = vint(b, o + id.len); if (!sz) break;
    const body = o + id.len + sz.len, ID = id.v;
    if (ID === 0x1F43B675) { firstCluster = o; break; }
    if (MASTERS.has(ID)) { if (ID === 0xAE) { tr = {}; tracks.push(tr); } o = body; continue; }
    const end = body + sz.v;
    if (ID === 0x2AD7B1) { let v = 0; for (let i = body; i < end; i++) v = v * 256 + b[i]; scale = v; }
    else if (ID === 0x4489) { const dv = new DataView(b.buffer, b.byteOffset + body, sz.v); duration = sz.v === 4 ? dv.getFloat32(0) : dv.getFloat64(0); }
    else if (tr && ID === 0xD7) tr.num = b[body];
    else if (tr && ID === 0x83) tr.type = b[body];
    else if (tr && ID === 0x86) tr.codec = new TextDecoder().decode(b.subarray(body, end));
    else if (tr && ID === 0x63A2) tr.priv = b.slice(body, end);
    else if (tr && ID === 0xB5) { const dv = new DataView(b.buffer, b.byteOffset + body, sz.v); tr.rate = sz.v === 4 ? dv.getFloat32(0) : dv.getFloat64(0); }
    else if (tr && ID === 0x9F) tr.ch = b[body];
    o = end;
  }
  const a = tracks.find(t => t.type === 2); if (!a || firstCluster < 0) return null;
  const codec = a.codec === 'A_OPUS' ? 'opus' : a.codec === 'A_VORBIS' ? 'vorbis' : a.codec === 'A_AAC' ? 'mp4a.40.2' : a.codec === 'A_FLAC' ? 'flac' : null; if (!codec) return null;
  const packets = (function* () {
    let o = firstCluster;
    while (o < b.length) {
      const id = vint(b, o, true); if (!id) return; const sz = vint(b, o + id.len); if (!sz) return;
      const body = o + id.len + sz.len, ID = id.v;
      if (MASTERS.has(ID)) { o = body; continue; }
      const end = sz.unknown ? b.length : Math.min(b.length, body + sz.v);
      if (ID === 0xE7) { let v = 0; for (let i = body; i < end; i++) v = v * 256 + b[i]; clusterTc = v; }
      else if (ID === 0xA3 || ID === 0xA1) {
        const t = vint(b, body); if (t && t.v === a.num) {
          const rel = (b[body + t.len] << 24 >> 16) | b[body + t.len + 1]; const flags = b[body + t.len + 2];
          if (flags & 0x06) throw new Error('laced WebM blocks are not read here');
          const p = body + t.len + 3; yield { off: p, size: end - p, us: Math.round((clusterTc + rel) * scale / 1000) };
        }
      }
      o = end;
    }
  })();
  return { container: 'webm', codec, sampleRate: a.rate || 48000, channels: a.ch || 2, description: a.priv, duration: duration != null ? duration * scale / 1e9 : null, packets };
}

// ---------- MP3 ----------
const MP3_BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const MP3_SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function mp3Frame(b, o) {
  if (o + 4 > b.length || b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[o + 1] >> 3) & 3, layer = (b[o + 1] >> 1) & 3; if (ver === 1 || layer !== 1) return null;
  const bri = b[o + 2] >> 4, sri = (b[o + 2] >> 2) & 3, pad = (b[o + 2] >> 1) & 1; if (bri === 0 || bri === 15 || sri === 3) return null;
  const br = MP3_BR[ver === 3 ? 1 : 2][bri] * 1000, sr = MP3_SR[ver][sri], spf = ver === 3 ? 1152 : 576;
  return { len: Math.floor(spf / 8 * br / sr) + pad, sr, spf, ch: ((b[o + 3] >> 6) === 3) ? 1 : 2 };
}
function demuxMp3(b) {
  let o = 0; if (str4(b, 0).slice(0, 3) === 'ID3') o = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
  let f = null; for (let k = 0; k < 65536 && o + 4 < b.length; k++, o++) { f = mp3Frame(b, o); if (f && mp3Frame(b, o + f.len)) break; f = null; }
  if (!f) return null; const first = o, f0 = f;
  // duration: the Xing/Info header's frame count when the first frame carries one (that frame is
  // often a different size from the audio frames, so it can't be the yardstick); else the second frame's size
  const side = f0.spf === 1152 ? (f0.ch === 1 ? 17 : 32) : (f0.ch === 1 ? 9 : 17), xo = first + 4 + side;
  let duration = null; const xing = xo + 12 <= b.length && /^(Xing|Info)$/.test(str4(b, xo));
  if (xing && (b[xo + 7] & 1)) duration = be32(b, xo + 8) * f0.spf / f0.sr;
  if (duration == null) { const f1 = mp3Frame(b, first + f0.len) || f0; duration = (b.length - first) / f1.len * f1.spf / f1.sr; }
  const packets = (function* () { let o = xing ? first + f0.len : first, t = 0; while (o < b.length) { const g = mp3Frame(b, o); if (!g) { o++; continue; } yield { off: o, size: Math.min(g.len, b.length - o), us: Math.round(t / g.sr * 1e6) }; t += g.spf; o += g.len; } })();
  return { container: 'mp3', codec: 'mp3', sampleRate: f0.sr, channels: f0.ch, duration, packets };
}

// ---------- ADTS AAC ----------
const AAC_SR = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
function demuxAdts(b) {
  if (!(b[0] === 0xff && (b[1] & 0xf6) === 0xf0)) return null;
  const prof = (b[2] >> 6) + 1, sri = (b[2] >> 2) & 0xf, ch = ((b[2] & 1) << 2) | (b[3] >> 6);
  const asc = new Uint8Array([(prof << 3) | (sri >> 1), ((sri & 1) << 7) | (ch << 3)]);
  const packets = (function* () { let o = 0, t = 0; while (o + 7 < b.length && b[o] === 0xff && (b[o + 1] & 0xf6) === 0xf0) { const len = ((b[o + 3] & 3) << 11) | (b[o + 4] << 3) | (b[o + 5] >> 5); const h = (b[o + 1] & 1) ? 7 : 9; if (len <= h) return; yield { off: o + h, size: Math.min(len, b.length - o) - h, us: Math.round(t / AAC_SR[sri] * 1e6) }; t += 1024; o += len; } })();
  return { container: 'adts', codec: 'mp4a.40.' + prof, sampleRate: AAC_SR[sri], channels: ch || 2, description: asc, duration: null, packets };
}

// ---------- WAV (no decoder needed) ----------
function parseWav(b) {
  if (str4(b, 0) !== 'RIFF' || str4(b, 8) !== 'WAVE') return null;
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) { const id = str4(b, o), n = le32(b, o + 4); if (id === 'fmt ') fmt = { tag: le16(b, o + 8), ch: le16(b, o + 10), sr: le32(b, o + 12), bits: le16(b, o + 22) }; if (id === 'data') { data = { off: o + 8, len: Math.min(n, b.length - o - 8) }; break; } o += 8 + n + (n & 1); }
  if (!fmt || !data) return null; if (fmt.tag === 0xfffe) fmt.tag = fmt.bits === 32 ? 3 : 1;
  if (!(fmt.tag === 1 && [8, 16, 24, 32].includes(fmt.bits)) && !(fmt.tag === 3 && fmt.bits === 32)) return null;
  const bps = fmt.bits / 8, frames = Math.floor(data.len / (bps * fmt.ch));
  return { container: 'wav', codec: 'pcm', sampleRate: fmt.sr, channels: fmt.ch, duration: frames / fmt.sr, fmt, data, frames };
}

// The container read, without decoding: metadata plus a generator of { off, size, us } packets.
export function demuxAudio(x) { return demux(u8(x)); }
function demux(b) {
  if (!b || b.length < 12) return null;
  try {
    const w = parseWav(b); if (w) return w;
    if (str4(b, 4) === 'ftyp' || ['moov', 'mdat', 'free', 'wide', 'skip'].includes(str4(b, 4))) return demuxMp4(b);
    if (be32(b, 0) === 0x1A45DFA3) return demuxWebm(b);
    if (str4(b, 0) === 'fLaC' || str4(b, 0) === 'OggS') return null;
    return demuxAdts(b) || demuxMp3(b);
  } catch (e) { return null; }
}

export async function probeAudio(x) {
  const b = await bytesOf(x); const d = demux(b); if (!d) return null;
  return { container: d.container, codec: d.codec, sampleRate: d.sampleRate, channels: d.channels, duration: d.duration };
}
export async function audioDuration(x) { const p = await probeAudio(x); return p && p.duration > 0 ? p.duration : null; }

// ---------- windows ----------
async function to16k(mono, sr) {
  if (sr === RATE) return mono;
  const n = Math.max(1, Math.round(mono.length * RATE / sr));
  const AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new AC(1, n, RATE); const buf = ctx.createBuffer(1, mono.length, sr); buf.copyToChannel(mono, 0);
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0);
}
function monoOf(ad) {
  const n = ad.numberOfFrames, C = ad.numberOfChannels, out = new Float32Array(n);
  const tmp = new Float32Array(n);
  for (let c = 0; c < C; c++) { ad.copyTo(tmp, { planeIndex: c, format: 'f32-planar' }); for (let i = 0; i < n; i++) out[i] += tmp[i]; }
  if (C > 1) for (let i = 0; i < n; i++) out[i] /= C;
  return out;
}
// A FIFO of mono pieces at the native rate; take(n) cuts exactly n samples off the front.
function fifo() {
  const q = []; let len = 0, head = 0;
  return {
    get length() { return len; },
    push(a) { if (a.length) { q.push(a); len += a.length; } },
    take(n) { n = Math.min(n, len); const out = new Float32Array(n); let k = 0; while (k < n) { const a = q[0], m = Math.min(a.length - head, n - k); out.set(a.subarray(head, head + m), k); k += m; head += m; if (head >= a.length) { q.shift(); head = 0; } } len -= n; return out; },
  };
}

export async function* pcm16k(x, { winSec = 30, signal } = {}) {
  const b = await bytesOf(x); const d = demux(b);
  const W = Math.round(winSec * RATE); let start = 0;
  const emit = async function* (sr, final, Q) {
    // windows are cut at the native rate so each resamples to exactly W samples
    const wn = Math.round(winSec * sr);
    while (Q.length >= wn || (final && Q.length > 0)) { const part = Q.take(Math.min(wn, Q.length)); const pcm = await to16k(part, sr); yield { pcm, start }; start += pcm.length / RATE; }
  };
  if (d && d.container === 'wav') {
    const { fmt, data, frames, sampleRate: sr, channels: C } = d; const dv = new DataView(b.buffer, b.byteOffset + data.off, data.len); const bps = fmt.bits / 8;
    const rd = fmt.tag === 3 ? (p => dv.getFloat32(p, true)) : bps === 2 ? (p => dv.getInt16(p, true) / 32768) : bps === 1 ? (p => (dv.getUint8(p) - 128) / 128) : bps === 3 ? (p => ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) / 8388608)) : (p => dv.getInt32(p, true) / 2147483648);
    const wn = Math.round(winSec * sr);
    for (let f0 = 0; f0 < frames; f0 += wn) {
      if (signal && signal.aborted) throw new Error('stopped');
      const n = Math.min(wn, frames - f0), mono = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; const p = (f0 + i) * C * bps; for (let c = 0; c < C; c++) s += rd(p + c * bps); mono[i] = s / C; }
      const pcm = await to16k(mono, sr); yield { pcm, start }; start += pcm.length / RATE;
    }
    return;
  }
  let cfg = null;
  if (d && typeof AudioDecoder !== 'undefined') {
    cfg = { codec: d.codec, sampleRate: Math.round(d.sampleRate), numberOfChannels: d.channels, ...(d.description ? { description: d.description } : {}) };
    try { const s = await AudioDecoder.isConfigSupported(cfg); if (!s.supported) cfg = null; } catch (e) { cfg = null; }
  }
  if (cfg) {
    const Q = fifo(); let sr = 0, err = null, skip = -1;
    const dec = new AudioDecoder({ output: ad => { try { if (!sr) { sr = ad.sampleRate; skip = Math.round((d.skipSec || 0) * sr); } let m = monoOf(ad); if (skip > 0) { const k = Math.min(skip, m.length); m = m.subarray(k); skip -= k; } Q.push(m); } catch (e) { err = e; } finally { ad.close(); } }, error: e => { err = e; } });
    dec.configure(cfg);
    const waitDequeue = () => new Promise(r => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; dec.addEventListener('dequeue', fin, { once: true }); setTimeout(fin, 50); });
    try {
      for (const p of d.packets) {
        if (err) throw err; if (signal && signal.aborted) throw new Error('stopped');
        dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: p.us, data: b.subarray(p.off, p.off + p.size) }));
        while (dec.decodeQueueSize > 24) { await waitDequeue(); if (err) throw err; }
        if (sr && Q.length >= Math.round(winSec * sr)) yield* emit(sr, false, Q);
      }
      await dec.flush(); if (err) throw err;
      if (sr) yield* emit(sr, true, Q);
      return;
    } finally { try { dec.close(); } catch (e) {} }
  }
  // Fallback: the whole-file decode, for containers not read above. Long files of these
  // kinds can still exhaust the tab; a clear error is better than a dead renderer.
  const AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  let ab;
  try { ab = await new AC(1, 1, RATE).decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  catch (e) { throw new Error('this browser could not decode the sound (' + (d ? d.codec + ' in ' + d.container : 'unrecognised container') + ')'); }
  const C = ab.numberOfChannels, n = ab.length, chans = []; for (let c = 0; c < C; c++) chans.push(ab.getChannelData(c)); ab = null;
  for (let o = 0; o < n; o += W) {
    const m = Math.min(W, n - o), pcm = new Float32Array(m);
    for (let c = 0; c < C; c++) { const s = chans[c]; for (let i = 0; i < m; i++) pcm[i] += s[o + i]; }
    if (C > 1) for (let i = 0; i < m; i++) pcm[i] /= C;
    yield { pcm, start: o / RATE };
  }
}

// The whole recording as one 16 kHz mono array — only for callers that need it all at
// once, and only when it fits: capped at maxSec (default four hours = 230 MB).
export async function decode16kAll(x, { maxSec = 4 * 3600 } = {}) {
  const parts = []; let n = 0;
  for await (const w of pcm16k(x, { winSec: 60 })) { if (n >= maxSec * RATE) break; parts.push(w.pcm); n += w.pcm.length; }
  const out = new Float32Array(n); let k = 0; for (const p of parts) { out.set(p, k); k += p.length; } return out;
}
