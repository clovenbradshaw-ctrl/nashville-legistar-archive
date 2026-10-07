// adapters/midi/midi.js — floor 0 for MIDI: Standard MIDI File bytes in,
// addressed note events out; note events in, Standard MIDI File bytes out.
//
// THE MEDIUM, in this project's own terms. A MIDI file is not sound — it is
// a SCRIPT (stratum S1, LEVELS.md): someone wrote the notes down. That is
// exactly what makes it the cleanest possible material for asking whether
// the reading organs learn a grammar and whether a prior sedimented from a
// reading can GENERATE: nothing has to be pitch-tracked, every event is
// declared by the file's own bytes, and every event has an address (its
// ordinal, and its tick) that reads back.
//
// PURE. No engine import; no music theory. Pitch is the MIDI number the file
// carries; a note NAME is a projection a caller may ask for (`noteName`) and
// is a received convention (the twelve pitch classes, octave from 60 = C4,
// giver: MIDI 1.0 spec / scientific pitch notation), never anything derived
// here. Duration is ticks; the caller decides what a "class" of duration is.
//
// SCOPE, disclosed: format 0 and 1; note-on/note-off (a note-on at velocity
// 0 is a note-off, per the spec); running status honoured; tempo meta read
// (for seconds, if a caller wants them) but every address is in TICKS; other
// channel messages and SysEx are skipped by length, never interpreted. A
// file whose chunks do not read back is refused with its reason, never
// half-parsed.

export const REFUSALS = Object.freeze({
  not_smf: "not a Standard MIDI File — the first chunk is not MThd",
  truncated: "a chunk runs past the end of the file",
  unsupported_format: "only SMF formats 0 and 1 are read",
});

const PITCH_CLASS = Object.freeze(["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]);

/** MIDI number → a name in scientific pitch notation (60 = c4). A projection, not a fact about the file. */
export const noteName = (n) => `${PITCH_CLASS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
/** The inverse projection, for a caller writing events named this way. */
export function noteNumber(name) {
  const m = String(name).toLowerCase().match(/^([a-g]#?)(-?\d+)$/);
  if (!m) return null;
  const pc = PITCH_CLASS.indexOf(m[1]);
  return pc < 0 ? null : (Number(m[2]) + 1) * 12 + pc;
}

function readVarLen(buf, at) {
  let v = 0, i = at;
  for (;;) {
    const b = buf[i++];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
    if (i > buf.length) throw new Error(REFUSALS.truncated);
  }
  return { value: v, next: i };
}

/**
 * parseMidi(bytes) → { format, ticksPerBeat, tracks, notes, tempo, refused }
 * `notes`: one row per sounded note, in onset order —
 *   { i, tick, dur, pitch, velocity, channel, track, at }
 * `at` is the event's own address: `midi:t<track>#<tick>` — readable back
 * from the file by anyone with the bytes.
 */
export function parseMidi(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const str = (o, n) => String.fromCharCode(...buf.slice(o, o + n));
  const u32 = (o) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  const u16 = (o) => (buf[o] << 8) | buf[o + 1];
  if (buf.length < 14 || str(0, 4) !== "MThd") return { refused: { type: "not_smf", detail: REFUSALS.not_smf } };
  const headerLen = u32(4);
  const format = u16(8), nTracks = u16(10), division = u16(12);
  if (format !== 0 && format !== 1) return { refused: { type: "unsupported_format", detail: REFUSALS.unsupported_format, format } };
  const ticksPerBeat = division & 0x8000 ? null : division;
  let o = 8 + headerLen;
  const tracks = [];
  const notes = [];
  let tempo = 500000; // µs per quarter, the spec's default
  for (let t = 0; t < nTracks; t += 1) {
    if (o + 8 > buf.length || str(o, 4) !== "MTrk") return { refused: { type: "truncated", detail: REFUSALS.truncated, at: o } };
    const len = u32(o + 4);
    const end = o + 8 + len;
    if (end > buf.length) return { refused: { type: "truncated", detail: REFUSALS.truncated, at: o } };
    let i = o + 8, tick = 0, status = 0;
    const open = new Map(); // `${ch}:${pitch}` -> { tick, velocity }
    const events = [];
    while (i < end) {
      const d = readVarLen(buf, i); tick += d.value; i = d.next;
      let b = buf[i];
      if (b === 0xff) {
        const type = buf[i + 1];
        const l = readVarLen(buf, i + 2);
        const dataAt = l.next;
        if (type === 0x51 && l.value === 3) tempo = (buf[dataAt] << 16) | (buf[dataAt + 1] << 8) | buf[dataAt + 2];
        i = dataAt + l.value;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) { const l = readVarLen(buf, i + 1); i = l.next + l.value; continue; }
      if (b & 0x80) { status = b; i += 1; } // else running status
      const kind = status & 0xf0, ch = status & 0x0f;
      const twoByte = kind === 0xc0 || kind === 0xd0;
      const d1 = buf[i], d2 = twoByte ? 0 : buf[i + 1];
      i += twoByte ? 1 : 2;
      if (kind === 0x90 && d2 > 0) {
        open.set(`${ch}:${d1}`, { tick, velocity: d2 });
      } else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) {
        const k = `${ch}:${d1}`;
        const on = open.get(k);
        if (on) {
          open.delete(k);
          events.push({ tick: on.tick, dur: tick - on.tick, pitch: d1, velocity: on.velocity, channel: ch, track: t, at: `midi:t${t}#${on.tick}` });
        }
      }
    }
    tracks.push({ index: t, events: events.length, bytes: len });
    for (const e of events) notes.push(e);
    o = end;
  }
  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  notes.forEach((n, i) => { n.i = i; });
  return { format, ticksPerBeat, tracks, notes, tempo, refused: null };
}

/**
 * writeMidi(notes, { ticksPerBeat, tempo }) → Uint8Array — format 0, one
 * track, note-on/off pairs from { tick, dur, pitch, velocity?, channel? }.
 * Every number is the caller's; nothing is quantised or humanised here.
 */
export function writeMidi(notes, { ticksPerBeat = 480, tempo = 500000 } = {}) {
  const evs = [];
  for (const n of notes ?? []) {
    const ch = n.channel ?? 0, v = n.velocity ?? 80;
    evs.push({ tick: n.tick, order: 1, bytes: [0x90 | ch, n.pitch & 0x7f, v & 0x7f] });
    evs.push({ tick: n.tick + Math.max(1, n.dur | 0), order: 0, bytes: [0x80 | ch, n.pitch & 0x7f, 0] });
  }
  evs.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const varLen = (v) => { const out = [v & 0x7f]; v >>= 7; while (v > 0) { out.unshift((v & 0x7f) | 0x80); v >>= 7; } return out; };
  const track = [0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff];
  let last = 0;
  for (const e of evs) { track.push(...varLen(e.tick - last), ...e.bytes); last = e.tick; }
  track.push(0x00, 0xff, 0x2f, 0x00);
  const u32 = (v) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const u16 = (v) => [(v >> 8) & 0xff, v & 0xff];
  const head = [...[77, 84, 104, 100], ...u32(6), ...u16(0), ...u16(1), ...u16(ticksPerBeat)];
  const trk = [...[77, 84, 114, 107], ...u32(track.length), ...track];
  return new Uint8Array([...head, ...trk]);
}
