// holodeck-loops.js — a recognizer's runaway repetition, collapsed to what was actually there.
//
// A speech recognizer that loses the signal (music, a hum, a long silence, a clip it cannot place) does not stop: it
// writes the last thing it was confident about again, and again, for as long as the window lasts —
// "hum, hum, hum, hum, …" three hundred times, or one sentence once a segment. That is not something anyone said, and
// left in it becomes a paragraph, a statement, a summary and a name count. This module finds such runs and keeps one
// occurrence with the count beside it.
//
// What counts as a loop:
//   unit      one to MAX_UNIT consecutive tokens (a word, a phrase), compared by their letters and digits, not their
//             punctuation or case.
//   run       the same unit, back to back, at least `need` times. `need` is the larger of
//               RUN_FLOOR   a person says "no, no, no" and "very, very"; four in a row is where speech stops, and
//               chance      how many back-to-back repeats the transcript's own word frequencies would give once by
//                           chance in the whole transcript: ceil(ln N / −ln p), p the unit's frequency.
//             So a rare word needs RUN_FLOOR, a very common one a few more.
//   segments  the same whole segment (normalised) back to back needs the same.
// What is kept: the first occurrence, with `loop: { unit, reps }` on the segment so a surface can say so in its own
// voice. Nothing is invented, and a repeat that is not a runaway is left exactly as heard.

export const RUN_FLOOR = 4;
export const MAX_UNIT = 6;

const keyOf = (tok) => String(tok).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function collapseLoops(segs, { floor = RUN_FLOOR } = {}) {
  const src = (segs || []).map((g) => ({ ...g, text: String(g.text || '') }));
  // the transcript's own unigram frequencies, for the chance term
  const freq = new Map(); let N = 0;
  src.forEach((g) => g.text.split(/\s+/).forEach((t) => { const k = keyOf(t); if (!k) return; freq.set(k, (freq.get(k) || 0) + 1); N++; }));
  const need = (unit) => {
    let lp = 0; for (const k of unit) lp += Math.log(Math.max(1, freq.get(k) || 1) / Math.max(1, N));
    const chance = lp < 0 ? Math.ceil(Math.log(Math.max(2, N)) / -lp) : floor;
    return Math.max(floor, chance);
  };
  const loops = [];
  // 1. within a segment: the longest run that starts at each token
  const out = src.map((g, si) => {
    const toks = g.text.split(/\s+/).filter(Boolean); if (toks.length < floor) return g;
    const keys = toks.map(keyOf);
    const kept = []; const found = []; let i = 0;
    while (i < toks.length) {
      let best = null;
      for (let u = 1; u <= MAX_UNIT && i + u <= toks.length; u++) {
        const unit = keys.slice(i, i + u); if (unit.some((k) => !k)) continue;
        let r = 1; while (i + (r + 1) * u <= toks.length && keys.slice(i + r * u, i + (r + 1) * u).every((k, j) => k === unit[j])) r++;
        if (r >= need(unit) && (!best || r * u > best.r * best.u)) best = { u, r };
      }
      if (best) { kept.push(...toks.slice(i, i + best.u)); found.push({ unit: toks.slice(i, i + best.u).join(' '), reps: best.r }); i += best.u * best.r; }
      else { kept.push(toks[i]); i++; }
    }
    if (!found.length) return g;
    found.forEach((f) => loops.push({ seg: si, unit: f.unit, reps: f.reps }));
    const top = found.reduce((a, b) => (b.reps > a.reps ? b : a));
    return { ...g, text: kept.join(' '), loop: { unit: top.unit, reps: found.reduce((n, f) => n + f.reps, 0), runs: found.length } };
  });
  // 2. the same segment, back to back
  const segKey = (g) => g.text.split(/\s+/).map(keyOf).join(' ').trim();
  const res = []; let i = 0;
  while (i < out.length) {
    const k = segKey(out[i]);
    let r = 1; if (k) while (i + r < out.length && segKey(out[i + r]) === k) r++;
    if (k && r >= need(k.split(' '))) {
      const first = out[i], last = out[i + r - 1];
      res.push({ ...first, end: last.end, loop: { unit: first.text.trim(), reps: r + (first.loop ? first.loop.reps - 1 : 0), runs: 1, segments: r } });
      loops.push({ seg: i, unit: first.text.trim(), reps: r, segments: r });
      i += r;
    } else { res.push(out[i]); i++; }
  }
  return { segs: res, loops, basis: loops.length ? loops.length + ' runaway run' + (loops.length === 1 ? '' : 's') + ' collapsed: ' + loops.slice(0, 3).map((l) => '“' + l.unit.slice(0, 30) + '” ×' + l.reps).join(', ') : 'no runaway repetition' };
}
