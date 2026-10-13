import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClip, timeToSec, clockLabel, youtubeIdFrom } from './holodeck-clip.js';

test('one span + id + name is a snip', () => {
  const s = parseClip('clip 2:28:00-2:29:35 from https://www.youtube.com/watch?v=wNHXllwtgBk named evanssegall');
  assert.equal(s.kind, 'clip');
  assert.equal(s.id, 'wNHXllwtgBk');
  assert.equal(s.name, 'evanssegall');
  assert.deepEqual(s.segments, [{ start: 8880, end: 8975 }]);
});

test('a short form and a bare id after "from"', () => {
  const s = parseClip('snip 2:28-2:29:35 from wNHXllwtgBk as quote');
  assert.equal(s.kind, 'clip');
  assert.equal(s.id, 'wNHXllwtgBk');
  assert.equal(s.segments[0].start, 148);
  assert.equal(s.segments[0].end, 8975);
});

test('two spans stitch even under a clip verb', () => {
  const s = parseClip('clip 0:30-0:45 and 2:00-2:10 from https://youtu.be/wNHXllwtgBk as undercroft');
  assert.equal(s.kind, 'stitch');
  assert.deepEqual(s.segments.map(x => x.start), [30, 120]);
});

test('a stitch verb with one span is still a stitch', () => {
  const s = parseClip('stitch 1:00-1:30 from wNHXllwtgBk titled join');
  assert.equal(s.kind, 'stitch');
  assert.equal(s.name, 'join');
});

test('seconds-only spans, comma separated', () => {
  const s = parseClip('join 10-20, 30-40 from wNHXllwtgBk named microcuts');
  assert.equal(s.kind, 'stitch');
  assert.deepEqual(s.segments, [{ start: 10, end: 20 }, { start: 30, end: 40 }]);
});

test('every span must be well-formed, or the sentence is not a clip', () => {
  assert.equal(parseClip('clip 5:00-4:00 from wNHXllwtgBk'), null);          // start >= end
  assert.equal(parseClip('clip 2:00 from wNHXllwtgBk'), null);               // no range
  assert.equal(parseClip('clip 1:00-2:00 from notanid'), null);              // bad id
  assert.equal(parseClip('trim 1:00-2:00'), null);                           // no id
  assert.equal(parseClip('cut 1:00-2:00 and 3:00-4:00 and 5:00-6:00 and 7:00-8:00 and 9:00-10:00 and 11:00-12:00 and 13:00-14:00 and 15:00-16:00 and 17:00-18:00 and 19:00-20:00 and 21:00-22:00 and 23:00-24:00 and 25:00-26:00 from wNHXllwtgBk'), null); // >12
});

test('an ordinary question never becomes a clip', () => {
  assert.equal(parseClip('what quote did Evans Segall give at 2:28, from the video before?'), null);   // no verb
  assert.equal(parseClip('could you clip the audio for me please'), null);                              // no id, no range
  assert.equal(parseClip('no thanks'), null);
  assert.equal(parseClip(''), null);
});

test('timeToSec accepts only real clock shapes, including over 59 minutes', () => {
  assert.equal(timeToSec('2:28:00'), 8880);
  assert.equal(timeToSec('2:28'), 148);
  assert.equal(timeToSec('97'), 97);
  assert.equal(timeToSec('0.5'), 0.5);
  assert.equal(timeToSec('5:61'), null);
  assert.equal(timeToSec('::'), null);
  assert.equal(timeToSec('-1'), null);
});

test('clockLabel renders a readable timecode', () => {
  assert.equal(clockLabel(97), '1:37');
  assert.equal(clockLabel(8784), '2:26:24');
  assert.equal(clockLabel(0), '0:00');
});

test('youtubeIdFrom finds urls and bare ids after "from"', () => {
  assert.equal(youtubeIdFrom('from wNHXllwtgBk named x'), 'wNHXllwtgBk');
  assert.equal(youtubeIdFrom('see https://youtu.be/wNHXllwtgBk ok'), 'wNHXllwtgBk');
  assert.equal(youtubeIdFrom('plain text with no id'), null);
});