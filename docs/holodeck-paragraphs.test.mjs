import test from 'node:test';
import assert from 'node:assert/strict';
import { paragraphsOf, cutsOf } from './holodeck-paragraphs.js';

// Subjects are generated, not hand-written: a subject is a lexicon of content words; a sentence is a few of them among
// the function words every subject uses. A seeded generator, so the same corpus every run.
const FN = 'the of and to a in that it was for on with as at by this we they said would from have be which an or are not but his her had their there been'.split(' ');
const LEX = {
  drones: 'drone vendor footage retention contract surveillance camera operator flight altitude battery license pilot airspace privacy audit deployment fleet sensor camera policy storage download archive'.split(' '),
  budget: 'budget revenue forecast deficit reserve capital taxes spending allocation fiscal appropriation bond audit payroll surplus millage assessment projection expenditure levy grant'.split(' '),
  parks: 'playground trail greenway volunteers field benches fence riverside picnic pavilion garden restroom shelter canoe lawn mulch seedlings fountain overlook pier boardwalk'.split(' '),
  courts: 'judge docket hearing plaintiff defendant motion verdict appeal attorney subpoena testimony jury sentencing warrant bail ruling counsel affidavit clerk probation'.split(' '),
};
function rng(seed) { let x = seed >>> 0 || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }
function sentences(subject, n, seed, punct = true) {
  const r = rng(seed), lex = LEX[subject], out = [];
  for (let i = 0; i < n; i++) {
    const w = []; const len = 11 + Math.floor(r() * 6);
    for (let j = 0; j < len; j++) w.push(r() < 0.35 ? lex[Math.floor(r() * lex.length)] : FN[Math.floor(r() * FN.length)]);
    out.push(w.join(' ').replace(/^./, (c) => c.toUpperCase()) + (punct ? '.' : ''));
  }
  return out;
}
const seg = (texts, t0 = 0) => texts.map((text, i) => ({ start: t0 + i * 6, end: t0 + i * 6 + 5, text }));
const starts = (r) => r.paragraphs.map((p) => p.segs[0]);

test('a change of subject is a break, and nothing inside one subject is', () => {
  const segs = seg([...sentences('drones', 30, 1), ...sentences('budget', 30, 2), ...sentences('parks', 30, 3)]);
  const r = paragraphsOf(segs);
  const s = starts(r);
  assert.ok(s.includes(30), 'drones to budget is a break');
  assert.ok(s.includes(60), 'budget to parks is a break');
  assert.deepEqual(s.filter((x) => x > 0 && x !== 30 && x !== 60), [], 'no paragraph begins inside a subject');
});

test('one subject told throughout stays one paragraph: no pause or length rule cuts it', () => {
  const segs = seg(sentences('drones', 90, 4)).map((g, i) => ({ ...g, start: i * 60, end: i * 60 + 5 })); // long pauses, a lot of text
  const r = paragraphsOf(segs);
  assert.equal(r.paragraphs.length, 1);
  assert.equal(r.paragraphs[0].segs.length, 90);
});

test('across many one-subject transcripts the chance cut rate is the null\'s, not more', () => {
  let cut = 0; const N = 12;
  for (let k = 0; k < N; k++) if (paragraphsOf(seg(sentences('budget', 60, 100 + k))).paragraphs.length > 1) cut++;
  // 3 scales over 60 shuffles: about 5% a transcript; a generous bound so the test is about the method, not the seed
  assert.ok(cut <= 2, 'cut ' + cut + ' of ' + N + ' single-subject transcripts');
});

test('the same input always gives the same cuts', () => {
  const segs = seg([...sentences('drones', 20, 5), ...sentences('courts', 20, 6)]);
  assert.deepEqual(paragraphsOf(segs).paragraphs.map((p) => p.segs), paragraphsOf(segs).paragraphs.map((p) => p.segs));
});

test('a change in the sound itself is a break even where the words do not move', () => {
  const r = paragraphsOf(seg(sentences('drones', 10, 7)), { breaks: [{ start: 17, end: 20 }] }); // between segment 2 (12..17) and 3 (18..23)
  assert.ok(starts(r).includes(3));
  assert.equal(r.paragraphs.find((p) => p.segs[0] === 3).why, 'sound');
});

test('a break never falls inside a sentence', () => {
  // each recognizer window ends mid-sentence: a sentence is split across two segments at an arbitrary word
  const raw = [...sentences('drones', 24, 8), ...sentences('courts', 24, 9)];
  const segs = [];
  raw.forEach((t, i) => { const w = t.split(' '), k = 3 + (i % 5); segs.push({ start: i * 10, end: i * 10 + 4, text: w.slice(0, k).join(' ') }, { start: i * 10 + 5, end: i * 10 + 9, text: w.slice(k).join(' ') }); });
  const r = paragraphsOf(segs);
  r.paragraphs.slice(0, -1).forEach((p) => assert.match(p.text, /[.!?]["'”’)\]]*$/, 'a paragraph ends on a sentence: ' + p.text.slice(-40)));
  assert.deepEqual(r.paragraphs.flatMap((p) => p.segs), segs.map((_, i) => i), 'no segment dropped or reordered');
  assert.ok(r.paragraphs.length >= 2, 'and the change of subject is still found');
});

test('text with no sentence punctuation at all is cut between segments, since there are no sentences to find', () => {
  const r = paragraphsOf(seg([...sentences('drones', 30, 10, false), ...sentences('courts', 30, 11, false)]));
  assert.ok(starts(r).includes(30));
});

test('sections: the same test on the paragraphs, titled by what sets each apart', () => {
  // four subjects, each broken into paragraphs by a change in the sound; sections come back as the subjects
  const parts = ['drones', 'budget', 'parks', 'courts'].map((s, i) => sentences(s, 24, 20 + i));
  const segs = seg(parts.flat());
  const breaks = []; for (let k = 6; k < segs.length; k += 6) breaks.push({ start: segs[k].start - 1, end: segs[k].start });
  const r = paragraphsOf(segs, { breaks });
  assert.ok(r.paragraphs.length >= 12);
  assert.ok(r.sections.length >= 3, 'sections: ' + r.sections.length);
  r.sections.forEach((s) => assert.ok(Array.isArray(s.title) && s.title.length));
  const all = new Set(r.sections.flatMap((s) => s.title));
  assert.ok([...all].some((w) => Object.values(LEX).some((l) => l.includes(w))), 'titles are the sections\' own words');
});

test('too little to cut: fewer than three units, and empty text', () => {
  assert.equal(cutsOf([new Map([['a', 1]]), new Map([['b', 1]])]).cuts.size, 0);
  assert.deepEqual(paragraphsOf([]).paragraphs, []);
  assert.equal(paragraphsOf([{ start: 0, end: 1, text: '   ' }]).paragraphs.length, 0);
  assert.equal(paragraphsOf([{ start: 0, end: 1, text: 'One short line.' }]).paragraphs.length, 1);
});
