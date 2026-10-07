// holodeck-media.js — readers for what isn't prose: images, sound, scores, math, spreadsheets, and any other bytes.
// Each reader returns { html | text, type, note } like readAny does, so everything downstream (analyze, the holograph)
// is unchanged. What a reader writes is a DESCRIPTION measured from the bytes (sizes, pitches, loudness, cells), and
// the note says so: nothing here is presented as text the file contained when it didn't.
// Every reader reports each step to tr(stage, kind, msg, data) so the ingest replay shows the real decode.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const para = lines => lines.filter(Boolean).map(l => '<p>' + esc(l) + '</p>').join('');
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const noop = () => {};

// ---------- sniffing ----------
const MAGIC = [
  ['png', [0x89, 0x50, 0x4E, 0x47]], ['jpeg', [0xFF, 0xD8, 0xFF]], ['gif', [0x47, 0x49, 0x46, 0x38]], ['webp', [0x52, 0x49, 0x46, 0x46], 8, [0x57, 0x45, 0x42, 0x50]],
  ['wav', [0x52, 0x49, 0x46, 0x46], 8, [0x57, 0x41, 0x56, 0x45]], ['midi', [0x4D, 0x54, 0x68, 0x64]], ['mp3', [0x49, 0x44, 0x33]], ['flac', [0x66, 0x4C, 0x61, 0x43]],
  ['ogg', [0x4F, 0x67, 0x67, 0x53]], ['zip', [0x50, 0x4B, 0x03, 0x04]], ['pdf', [0x25, 0x50, 0x44, 0x46]], ['mp4', null, 4, [0x66, 0x74, 0x79, 0x70]], ['bmp', [0x42, 0x4D]],
];
export function sniff(b) {
  for (const [name, head, off, tail] of MAGIC) {
    if (head && !head.every((x, i) => b[i] === x)) continue;
    if (tail && !tail.every((x, i) => b[(off || 0) + i] === x)) continue;
    return name;
  }
  let bad = 0; const n = Math.min(b.length, 4000); for (let i = 0; i < n; i++) { const c = b[i]; if (c < 9 || (c > 13 && c < 32)) bad++; }
  return n && bad / n < 0.01 ? 'text' : 'binary';
}
const hex = (b, n) => [...b.slice(0, n)].map(x => x.toString(16).padStart(2, '0')).join(' ');
export function sniffReport(b, tr = noop) {
  const kind = sniff(b); tr('bytes', 'sniff', 'First bytes ' + hex(b, 8) + ' → ' + (kind === 'text' ? 'plain text (no control bytes in the first ' + Math.min(b.length, 4000) + ')' : kind === 'binary' ? 'no known signature' : kind + ' signature'), { kind, bytes: b.length });
  return kind;
}

// ---------- images ----------
const HUES = [[0, 'red'], [25, 'orange'], [50, 'yellow'], [85, 'green'], [160, 'teal'], [200, 'blue'], [255, 'purple'], [300, 'magenta'], [340, 'pink'], [360, 'red']];
function colourName(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
  if (s < 0.15) return l < 0.15 ? 'black' : l > 0.88 ? 'white' : l < 0.45 ? 'dark grey' : 'grey';
  let h = mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60; if (h < 0) h += 360;
  const name = HUES.reduce((best, x) => Math.abs(x[0] - h) < Math.abs(best[0] - h) ? x : best)[1];
  return (l < 0.3 ? 'dark ' : l > 0.75 ? 'pale ' : '') + name;
}
export async function readImage(file, bytes, tr = noop) {
  const title = file.name.replace(/\.[^.]+$/, '');
  const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { tr('decode', 'fail', 'The browser could not decode this image (' + e.message + ')'); return { type: 'Image', html: '<figure><img src="' + url + '" alt="' + esc(title) + '"></figure>', note: title + ' could not be decoded, so only the file is kept.' }; }
  const W = bmp.width, H = bmp.height; tr('decode', 'image', 'Decoded ' + W + ' × ' + H + ' pixels', { w: W, h: H });
  const S = 64, cv = new OffscreenCanvas(S, S), cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, S, S);
  const px = cx.getImageData(0, 0, S, S).data; tr('decode', 'sample', 'Resampled to ' + S + ' × ' + S + ' (' + (S * S) + ' samples) to measure colour and texture');
  const bins = new Map(); let lum = 0, edge = 0; const L = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; lum += L[i]; const k = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5); const e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e); }
  for (let y = 1; y < S; y++) for (let x = 1; x < S; x++) { const i = y * S + x; edge += Math.abs(L[i] - L[i - 1]) + Math.abs(L[i] - L[i - S]); }
  lum /= S * S; const edgeD = edge / ((S - 1) * (S - 1) * 2 * 255);
  const names = new Map(); [...bins.values()].forEach(e => { const nm = colourName(e.r / e.n, e.g / e.n, e.b / e.n); names.set(nm, (names.get(nm) || 0) + e.n); });
  const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, c]) => ({ n, pct: Math.round(c / (S * S) * 100) })).filter(x => x.pct >= 4);
  top.forEach(c => tr('decode', 'colour', c.n + ' covers ' + c.pct + '% of the samples', c));
  tr('decode', 'texture', 'Mean brightness ' + Math.round(lum / 2.55) + '%, edge density ' + edgeD.toFixed(3), { lum, edgeD });
  const orient = W > H * 1.15 ? 'landscape' : H > W * 1.15 ? 'portrait' : 'square';
  const lines = [
    'The image ' + title + ' is ' + W + ' by ' + H + ' pixels, a ' + orient + ' frame of ' + (W * H / 1e6).toFixed(1) + ' megapixels.',
    top.length ? 'Its main colours are ' + top.map(c => c.n + ' at ' + c.pct + ' percent').join(', ') + '.' : '',
    'Its mean brightness is ' + Math.round(lum / 2.55) + ' percent and it is ' + (edgeD > 0.08 ? 'busy with fine detail' : edgeD > 0.03 ? 'moderately detailed' : 'smooth, with little fine detail') + '.',
  ];
  return { type: 'Image', measured: true, format: 'html', html: '<figure><img src="' + url + '" alt="' + esc(title) + '" style="max-width:100%"></figure>' + para(lines), note: title + ' is an image. The statements under it were measured from its pixels (size, colour, detail); no text was read from it.' };
}

// ---------- sound (audio, and the audio track of video) ----------
export async function readSound(file, bytes, tr = noop, kind = 'Audio') {
  const title = file.name.replace(/\.[^.]+$/, '');
  let ab; try { const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext; const ctx = new AC(1, 1, 44100); ab = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); }
  catch (e) { tr('decode', 'fail', 'The browser could not decode a sound track (' + (e && e.message || 'unsupported codec') + ')'); return { type: kind, text: '', note: title + ' has no sound track this browser can decode, so it is listed but nothing in it can be linked.' }; }
  const sr = ab.sampleRate, ch = ab.numberOfChannels, dur = ab.duration; tr('decode', 'audio', 'Decoded ' + mmss(dur) + ' of sound, ' + ch + ' channel' + (ch > 1 ? 's' : '') + ' at ' + sr + ' Hz', { dur, sr, ch });
  const d = ab.getChannelData(0), win = Math.max(1, Math.floor(sr / 4)), n = Math.floor(d.length / win), rms = new Float32Array(n); let peak = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * win; j < (i + 1) * win; j++) { const v = d[j]; s += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); } rms[i] = Math.sqrt(s / win); }
  tr('decode', 'envelope', 'Measured loudness in ' + n + ' quarter-second windows; peak ' + (20 * Math.log10(peak || 1e-9)).toFixed(1) + ' dBFS', { n, peak });
  // silence floor from this file's own distribution: the 10th percentile of window loudness, not a fixed dB
  const sorted = [...rms].sort((a, b) => a - b), floor = (sorted[Math.floor(n * 0.1)] || 0) * 2 + 1e-4;
  // the same factor as the quiet rule: if the loudest tenth never rises above twice the quietest tenth, the level is steady
  const steady = (sorted[Math.floor(n * 0.9)] || 0) <= floor;
  if (steady) tr('decode', 'steady', 'Level is steady: the 90th-percentile window is within twice the 10th, so there are no silences to divide it');
  const secs = []; let cur = null, quiet = 0;
  for (let i = 0; i < n; i++) { const loud = rms[i] > floor; if (loud) { if (!cur) cur = { a: i, b: i, e: 0 }; cur.b = i; cur.e += rms[i]; quiet = 0; } else if (cur && ++quiet >= 4) { secs.push(cur); cur = null; } }
  if (cur) secs.push(cur);
  const db = x => (20 * Math.log10(x || 1e-9)).toFixed(0);
  const S = secs.filter(s => s.b - s.a >= 3).slice(0, 40).map((s, i) => ({ i: i + 1, from: s.a / 4, to: (s.b + 1) / 4, level: s.e / (s.b - s.a + 1) }));
  tr('decode', 'sections', 'Found ' + S.length + ' sounding section' + (S.length === 1 ? '' : 's') + ' separated by at least a second of quiet (quiet = under twice this file’s own 10th-percentile level)', { sections: S.length });
  const loudest = S.slice().sort((a, b) => b.level - a.level)[0];
  const lines = [
    'The recording ' + title + ' runs ' + mmss(dur) + ' with ' + ch + ' channel' + (ch > 1 ? 's' : '') + ' sampled at ' + sr + ' hertz.',
    steady ? 'Its level is steady from start to end, with no silences.' : S.length ? 'It has ' + S.length + ' sounding section' + (S.length === 1 ? '' : 's') + ' separated by silence.' : 'It has no silence long enough to divide it into sections.',
    ...S.map(s => 'Section ' + s.i + ' is heard from ' + mmss(s.from) + ' to ' + mmss(s.to) + ' at an average level of ' + db(s.level) + ' decibels' + (s === loudest ? ', the loudest section' : '') + '.'),
  ];
  return { type: kind, measured: true, format: 'html', html: para(lines), note: title + ' is ' + (kind === 'Video' ? 'a video; its sound track' : 'a sound file; it') + ' was measured for length, loudness and silences. No speech was transcribed.' };
}

// ---------- MIDI ----------
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitch = n => NOTE[n % 12] + (Math.floor(n / 12) - 1);
const GM_FAMILY = ['Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad', 'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects'];
export function readMidi(file, b, tr = noop) {
  const title = file.name.replace(/\.[^.]+$/, '');
  const u32 = o => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0, u16 = o => b[o] << 8 | b[o + 1];
  const fmt = u16(8), ntr = u16(10), div = u16(12); tr('decode', 'midi', 'MIDI header: format ' + fmt + ', ' + ntr + ' track chunk' + (ntr === 1 ? '' : 's') + ', ' + div + ' ticks per quarter note', { fmt, ntr, div });
  let o = 14; const tracks = []; let tempo = 500000, ts = null, key = null;
  for (let t = 0; t < ntr && o + 8 <= b.length; t++) {
    if (u32(o) !== 0x4D54726B) break; const len = u32(o + 4); let p = o + 8; const end = p + len; o = end;
    const T = { name: '', inst: '', prog: null, notes: 0, lo: 127, hi: 0, first: Infinity, last: 0, ch: new Set(), drums: false }; let tick = 0, run = 0;
    const vlq = () => { let v = 0, c; do { c = b[p++]; v = v << 7 | c & 0x7F; } while (c & 0x80 && p < end); return v; };
    while (p < end) {
      tick += vlq(); let st = b[p]; if (st & 0x80) p++; else st = run;
      if (st === 0xFF) { const ty = b[p++], ln = vlq(), data = b.slice(p, p + ln); p += ln; const txt = () => new TextDecoder().decode(data).replace(/\0/g, '').trim();
        if (ty === 0x03 && !T.name) T.name = txt(); else if (ty === 0x04) T.inst = txt(); else if (ty === 0x51 && ln === 3) tempo = data[0] << 16 | data[1] << 8 | data[2]; else if (ty === 0x58) ts = data[0] + '/' + (1 << data[1]); else if (ty === 0x59) { const sf = (data[0] << 24) >> 24; key = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'][sf + 7] + (data[1] ? ' minor' : ' major'); }
        continue; }
      if (st === 0xF0 || st === 0xF7) { p += vlq(); continue; }
      run = st; const hi = st & 0xF0, chn = st & 0x0F; const a = b[p++], v = (hi === 0xC0 || hi === 0xD0) ? 0 : b[p++];
      if (hi === 0x90 && v > 0) { T.notes++; T.lo = Math.min(T.lo, a); T.hi = Math.max(T.hi, a); T.first = Math.min(T.first, tick); T.last = Math.max(T.last, tick); T.ch.add(chn); if (chn === 9) T.drums = true; }
      else if (hi === 0xC0 && T.prog === null) T.prog = a;
    }
    if (T.notes || T.name) tracks.push(T);
    tr('decode', 'track', 'Track ' + (t + 1) + (T.name ? ' “' + T.name + '”' : '') + ': ' + T.notes + ' notes' + (T.notes ? ' from ' + pitch(T.lo) + ' to ' + pitch(T.hi) : ''), { t, notes: T.notes });
  }
  const sec = tk => tk / div * tempo / 1e6, bpm = Math.round(60e6 / tempo);
  const label = (T, i) => T.drums ? (T.name || 'Drums') : (T.name || T.inst || (T.prog !== null ? GM_FAMILY[T.prog >> 3] : 'Track ' + (i + 1)));
  const sounding = tracks.filter(T => T.notes);
  const lines = [
    'The score ' + title + ' has ' + sounding.length + ' sounding part' + (sounding.length === 1 ? '' : 's') + ' at ' + bpm + ' beats per minute' + (ts ? ' in ' + ts + ' time' : '') + (key ? ' in ' + key : '') + '.',
    ...sounding.map((T, i) => 'The ' + label(T, i) + ' Part plays ' + T.notes + ' notes ' + (T.drums ? '' : 'from ' + pitch(T.lo) + ' to ' + pitch(T.hi) + ' ') + 'between ' + mmss(sec(T.first)) + ' and ' + mmss(sec(T.last)) + '.'),
  ];
  // parts that sound together are named in one sentence, so the holograph bonds them the way it bonds co-mentioned names
  for (let i = 0; i < sounding.length; i++) for (let j = i + 1; j < sounding.length; j++) { const A = sounding[i], B = sounding[j]; const ov = Math.min(A.last, B.last) - Math.max(A.first, B.first); if (ov > 0) lines.push('The ' + label(A, i) + ' Part and the ' + label(B, j) + ' Part are heard together for ' + mmss(sec(ov)) + '.'); }
  return { type: 'Music', measured: true, format: 'html', html: para(lines), note: title + ' is a MIDI score. Its parts, notes, tempo and key were read from the file’s events; the sentences describe them.' };
}
export function readAbc(file, raw, tr = noop) {
  const title = file.name.replace(/\.[^.]+$/, ''); const f = {}; const body = [];
  raw.split(/\r?\n/).forEach(l => { const m = l.match(/^([A-Za-z]):\s*(.*)$/); if (m && 'TCMLKQRZOSH'.includes(m[1])) (f[m[1]] = f[m[1]] || []).push(m[2].trim()); else if (l.trim() && !/^%/.test(l)) body.push(l); });
  const notes = (body.join(' ').match(/[_^=]*[A-Ga-g][,']*/g) || []).length; tr('decode', 'abc', 'ABC notation: ' + Object.keys(f).length + ' header fields, ' + notes + ' note tokens');
  const lines = [(f.T ? 'The tune ' + f.T[0] : 'The tune ' + title) + (f.C ? ' is by ' + f.C[0] : '') + (f.K ? ', in the key of ' + f.K[0] : '') + (f.M ? ' in ' + f.M[0] + ' time' : '') + '.', 'It has ' + notes + ' written notes' + (f.R ? ' and is a ' + f.R[0] : '') + '.', ...(f.H || []), ...(f.N || [])];
  return { type: 'Music', measured: true, format: 'html', html: para(lines) + '<pre>' + esc(raw) + '</pre>', note: title + ' is ABC music notation; its header fields and notes were read.' };
}
export function readMusicXml(file, raw, tr = noop) {
  const title = file.name.replace(/\.[^.]+$/, ''); const x = new DOMParser().parseFromString(raw, 'application/xml'); const q = s => [...x.getElementsByTagName(s)];
  const work = (q('work-title')[0] || q('movement-title')[0] || {}).textContent || title; const comp = q('creator').filter(c => c.getAttribute('type') === 'composer').map(c => c.textContent.trim())[0];
  const parts = q('score-part').map(p => ({ id: p.getAttribute('id'), name: ((p.getElementsByTagName('part-name')[0] || {}).textContent || '').trim() }));
  const lines = ['The score ' + work.trim() + (comp ? ', by ' + comp + ',' : '') + ' has ' + parts.length + ' part' + (parts.length === 1 ? '' : 's') + '.'];
  const sounding = [];
  q('part').forEach(p => { const P = parts.find(z => z.id === p.getAttribute('id')) || { name: p.getAttribute('id') }; const ns = [...p.getElementsByTagName('note')].filter(n => !n.getElementsByTagName('rest').length); const ps = ns.map(n => { const s = n.getElementsByTagName('step')[0], o = n.getElementsByTagName('octave')[0]; return s && o ? NOTE.indexOf(s.textContent) + 12 * (+o.textContent + 1) : null; }).filter(v => v !== null && v >= 0);
    tr('decode', 'part', 'Part “' + (P.name || '?') + '”: ' + ns.length + ' notes in ' + p.getElementsByTagName('measure').length + ' measures');
    if (ns.length) sounding.push({ name: P.name || 'Unnamed', m: new Set([...p.getElementsByTagName('measure')].filter(m => [...m.getElementsByTagName('note')].some(n => !n.getElementsByTagName('rest').length)).map(m => m.getAttribute('number'))) });
    lines.push('The ' + (P.name || 'Unnamed') + ' Part plays ' + ns.length + ' notes over ' + p.getElementsByTagName('measure').length + ' measures' + (ps.length ? ', from ' + pitch(Math.min(...ps)) + ' to ' + pitch(Math.max(...ps)) : '') + '.'); });
  for (let i = 0; i < sounding.length; i++) for (let j = i + 1; j < sounding.length; j++) { const both = [...sounding[i].m].filter(x => sounding[j].m.has(x)).length; if (both) lines.push('The ' + sounding[i].name + ' Part and the ' + sounding[j].name + ' Part are heard together in ' + both + ' measure' + (both === 1 ? '' : 's') + '.'); }
  return { type: 'Music', measured: true, format: 'html', html: para(lines), note: title + ' is a MusicXML score; its parts and notes were read.' };
}

// ---------- math ----------
export function readTex(file, raw, tr = noop) {
  const title = file.name.replace(/\.[^.]+$/, '');
  let t = raw.replace(/(^|[^\\])%.*$/gm, '$1'); const eqs = [];
  t = t.replace(/\\begin\{(equation|align|gather|multline|displaymath)\*?\}([\s\S]*?)\\end\{\1\*?\}|\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g, (m, e, a, b, c) => { const src = (a || b || c || '').trim(); eqs.push(src); return '\n[equation ' + eqs.length + ': ' + src.replace(/\s+/g, ' ') + ']\n'; });
  tr('decode', 'tex', 'LaTeX: ' + eqs.length + ' display equation' + (eqs.length === 1 ? '' : 's') + ', ' + ((t.match(/\$[^$]+\$/g) || []).length) + ' inline', { eqs: eqs.length });
  const envs = []; t = t.replace(/\\begin\{(theorem|lemma|proposition|corollary|definition|proof|remark|example)\}(\[[^\]]*\])?/g, (m, e, n) => { envs.push(e); return '\n' + e[0].toUpperCase() + e.slice(1) + (n ? ' ' + n.slice(1, -1) : '') + '. '; }).replace(/\\end\{(theorem|lemma|proposition|corollary|definition|proof|remark|example)\}/g, '\n');
  envs.forEach((e, i) => tr('decode', 'env', e + ' ' + (i + 1)));
  t = t.replace(/\\(section|subsection|subsubsection|chapter|title)\*?\{([^}]*)\}/g, '\n\n$2\n\n').replace(/\\(emph|textbf|textit|text|mathrm|operatorname)\{([^}]*)\}/g, '$2').replace(/\\(cite|ref|label|eqref)\{[^}]*\}/g, '').replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}|\\(documentclass|usepackage|maketitle|newcommand)(\[[^\]]*\])?(\{[^}]*\})*/g, '').replace(/\\\\/g, '\n');
  return { type: 'Math', text: t.replace(/\n{3,}/g, '\n\n').trim(), note: title + ' is LaTeX. Prose and theorem statements were kept; each display equation stays verbatim as “[equation n: …]” so it can be cited.' };
}
export function readMathMl(file, raw, tr = noop) {
  const x = new DOMParser().parseFromString(raw, 'application/xml'); const ms = [...x.getElementsByTagName('math')]; tr('decode', 'mathml', 'MathML: ' + ms.length + ' formula' + (ms.length === 1 ? '' : 's'));
  const lin = el => el.textContent.replace(/\s+/g, ' ').trim();
  return { type: 'Math', measured: true, format: 'html', html: para(ms.map((m, i) => 'Formula ' + (i + 1) + ' reads ' + lin(m) + '.')), note: 'MathML formulas were linearised from their symbols.' };
}

// ---------- spreadsheets (real cells, every sheet) ----------
export async function readXlsx(zip, tr = noop) {
  const sx = zip.file('xl/sharedStrings.xml'); const shared = [];
  if (sx) { const d = new DOMParser().parseFromString(await sx.async('string'), 'application/xml'); [...d.getElementsByTagName('si')].forEach(si => shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''))); }
  const wb = new DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'), 'application/xml');
  const names = [...wb.getElementsByTagName('sheet')].map(s => s.getAttribute('name'));
  const files = Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  const col = r => { let n = 0; for (const c of r.replace(/\d+/g, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  let html = '';
  for (let i = 0; i < files.length; i++) {
    const d = new DOMParser().parseFromString(await zip.file(files[i]).async('string'), 'application/xml'); const rows = [];
    [...d.getElementsByTagName('row')].slice(0, 2000).forEach(r => { const row = []; [...r.getElementsByTagName('c')].forEach(c => { const v = (c.getElementsByTagName('v')[0] || c.getElementsByTagName('t')[0] || {}).textContent || ''; row[col(c.getAttribute('r') || 'A1')] = c.getAttribute('t') === 's' ? shared[+v] || '' : v; }); rows.push([...row].map(x => x ?? '')); });
    tr('decode', 'sheet', 'Sheet “' + (names[i] || i + 1) + '”: ' + rows.length + ' rows × ' + Math.max(0, ...rows.map(r => r.length)) + ' columns', { rows: rows.length });
    if (!rows.length) continue; const [h, ...body] = rows;
    // each data row also becomes a sentence ("Column: value; ...") so names and figures in cells reach the fold
    html += '<h2>' + esc(names[i] || 'Sheet ' + (i + 1)) + '</h2><table><thead><tr>' + h.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + body.map(r => '<tr>' + h.map((_, j) => '<td>' + esc(r[j] ?? '') + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
      + para(body.slice(0, 500).map(r => { const rest = h.map((k, j) => j && r[j] !== '' && r[j] != null ? String(k || 'column ' + (j + 1)).toLowerCase() + ' ' + r[j] : '').filter(Boolean); return r[0] ? r[0] + ' has ' + (rest.length ? rest.join(', ') : 'no other values') + '.' : ''; }));
  }
  return html;
}

// ---------- anything else: printable runs, like `strings` ----------
export function readStrings(file, b, tr = noop) {
  const out = []; let run = '';
  for (let i = 0; i < b.length && out.length < 4000; i++) { const c = b[i]; if (c >= 32 && c < 127) run += String.fromCharCode(c); else { if (run.length >= 6) out.push(run); run = ''; } }
  if (run.length >= 6) out.push(run);
  const words = out.filter(s => /[A-Za-z]{3,}.*\s.*[A-Za-z]{3,}/.test(s));
  tr('decode', 'strings', 'No reader for these bytes; pulled ' + out.length + ' printable runs of 6+ characters, ' + words.length + ' of them word-like', { runs: out.length, words: words.length });
  return { type: 'Binary', text: words.join('\n'), note: file.name + ' is in a format with no reader here. The text under it is the printable strings found in its bytes, in order.' };
}
