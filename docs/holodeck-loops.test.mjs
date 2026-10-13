import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseLoops, RUN_FLOOR } from './holodeck-loops.js';

const seg = (texts) => texts.map((text, i) => ({ start: i * 5, end: i * 5 + 4, text }));
const SPEECH = [
  'We should think of more than one kind of generosity in public life.',
  'The council discussed the contract and then moved to the next item on the agenda.',
  'No, no, no, that is not what the report says about the retention period.',
  'Members asked whether the vendor would delete the footage after thirty days.',
  'It is very, very important that the audit is finished before the vote.',
];

test('the hum: one word, hundreds of times, is one word and a count', () => {
  const hum = Array(312).fill('hum,').join(' ');
  const r = collapseLoops(seg([...SPEECH, 'Mark Rowe paid the eight constructs, sort of a ' + hum, SPEECH[0]]));
  const g = r.segs[5];
  assert.equal(g.text, 'Mark Rowe paid the eight constructs, sort of a hum,');
  assert.equal(g.loop.reps, 312);
  assert.equal(g.loop.unit, 'hum,');
  assert.equal(r.loops.length, 1);
  // the words either side of it are exactly as heard
  assert.equal(r.segs[0].text, SPEECH[0]); assert.equal(r.segs[6].text, SPEECH[0]);
});

test('a phrase that loops is collapsed to one pass of the phrase', () => {
  const r = collapseLoops(seg([...SPEECH, 'and then ' + Array(40).fill('thank you for watching').join(' ') + ' it ended']));
  assert.equal(r.segs[5].text, 'and then thank you for watching it ended');
  assert.equal(r.segs[5].loop.reps, 40);
});

test('the same segment back to back is one segment, over the time it took', () => {
  const r = collapseLoops(seg([...SPEECH, ...Array(30).fill('Thank you.'), 'The meeting was adjourned at noon.']));
  assert.equal(r.segs.length, 7);
  assert.equal(r.segs[5].text, 'Thank you.');
  assert.equal(r.segs[5].loop.segments, 30);
  assert.ok(r.segs[5].end >= 5 * 5 + 29 * 5, 'it spans the whole run');
});

test('ordinary speech is left exactly as heard: "no, no, no" and "very, very"', () => {
  const r = collapseLoops(seg(SPEECH));
  assert.equal(r.loops.length, 0);
  assert.deepEqual(r.segs.map((g) => g.text), SPEECH);
});

test('the floor: three in a row stand, four do not', () => {
  assert.equal(RUN_FLOOR, 4);
  assert.equal(collapseLoops(seg([...SPEECH, 'It was no no no and then it stopped.'])).loops.length, 0);
  const r = collapseLoops(seg([...SPEECH, 'It was no no no no and then it stopped.']));
  assert.equal(r.loops.length, 1);
  assert.equal(r.segs[5].text, 'It was no and then it stopped.');
});

test('a very common word needs more than the floor, by the transcript\'s own frequencies', () => {
  // "the" is a large share of this transcript, so four in a row is about what chance gives once: not a loop yet
  const filler = Array(200).fill('the cat and the dog and the bird and the fish').join(' ');
  const r = collapseLoops(seg([filler, 'we saw the the the the cat']));
  assert.equal(r.loops.length, 0);
});

test('nothing is invented: collapsing only removes, and keeps word order', () => {
  const r = collapseLoops(seg([...SPEECH, 'alpha ' + Array(10).fill('beta').join(' ') + ' gamma']));
  assert.equal(r.segs[5].text, 'alpha beta gamma');
});
