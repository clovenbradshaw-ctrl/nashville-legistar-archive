// fold-chat-clip.js — "type it, get the cut" in the chat surface. The twin of
// holodeck/holodeck-clip.js: both surfaces type the same grammar, each keeps its own copy
// (the repos are independent surfaces; the holodeck copy is the canonical testbed). The
// parse is words and clock regexes — no model is ever consulted, so a passing unit is a
// passing unit, and an ordinary question returns null and reaches the chat lanes.
//
// Grammar (in any order, under a leading clip/stitch verb):
//   clip  2:28:00-2:29:35  from <youtube-url-or-id>  named evanssegall  -> one cut mp4
//   stitch 0:30-0:45 and 2:00-2:10 from <url> as undercroft             -> joined mp4
//   (, , then, +, or & may separate spans; named/as/called/titled name the file)
//
// Falsifying control: an ordinary question that parses to a clip (false positive), or a
// clip sentence that returns null (a missed cut), breaks this parser.

const VERBS = ['clip', 'snip', 'cut', 'trim', 'extract'];
const STITCH = ['stitch', 'join', 'combine', 'concat', 'mash'];
const RANGE = /(\d{1,2}:\d{2}(?::\d{2})?|\d{1,3}(?:\.\d+)?)\s*(?:-|–|—|to|→)\s*(\d{1,2}:\d{2}(?::\d{2})?|\d{1,3}(?:\.\d+)?)/g;

export function timeToSec(t) {
  if (typeof t !== 'string') return null;
  const T = t.trim();
  if (/^\d+(\.\d+)?$/.test(T)) {
    const n = Number(T);
    return isFinite(n) && n >= 0 ? n : null;
  }
  const m = T.match(/^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!m) return null;
  const secs = m[3] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  return isFinite(secs) ? secs : null;
}

export function youtubeIdFrom(text) {
  const s = String(text);
  const url = s.match(/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (url) return url[1];
  const from = s.match(/\bfrom\s+([\w-]{11})(?:\b)/i);
  return from ? from[1] : null;
}

function nameOf(text) {
  const m = String(text).match(/(?:named|as|call(?:ed)?|titled?|title)\s+["']?([A-Za-z0-9][A-Za-z0-9 _.-]{0,60})/i);
  return m ? m[1].trim() : null;
}

export function clipAsk(text) {
  if (typeof text !== 'string') return null;
  const low = text.toLowerCase();
  const isClip = VERBS.some(w => new RegExp('\\b' + w + '\\b').test(low));
  const isStitch = STITCH.some(w => new RegExp('\\b' + w + '\\b').test(low));
  if (!isClip && !isStitch) return null;
  const id = youtubeIdFrom(text);
  if (!id) return null;
  const segments = [];
  let m;
  RANGE.lastIndex = 0;
  while ((m = RANGE.exec(text)) !== null) {
    const a = timeToSec(m[1]);
    const b = timeToSec(m[2]);
    if (a === null || b === null || a >= b) return null;
    segments.push({ start: a, end: b });
  }
  if (!segments.length || segments.length > 12) return null;
  const kind = isStitch || segments.length > 1 ? 'stitch' : 'clip';
  const name = nameOf(text) || id + '-' + segments[0].start + '-' + segments[0].end;
  return { kind, id, name, segments };
}