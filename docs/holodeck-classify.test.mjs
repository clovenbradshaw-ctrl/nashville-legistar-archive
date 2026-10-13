// holodeck-classify.test.mjs — the change-point span merger (YAMNet frames → chunks).
// The classifier's boundary rule is the thing that decides "where something
// meaningfully different is happening", so it is pure, deterministic and tested
// here on its own: steady sound, a real change, a flicker, and a brief blip that
// must be absorbed rather than reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spansFromLabels } from './holodeck-classify.js';

const HOP = 0.48;

test('a steady sound is one span from start to end', () => {
  const r = spansFromLabels(new Array(42).fill(0), 20.16, HOP);
  assert.equal(r.spans.length, 1);
  assert.equal(r.spans[0].name, 'Speech');
  assert.ok(r.spans[0].start < 0.5);
  assert.ok(r.spans[0].end > 19.5);
});

test('a change of kind is a boundary the span list reports', () => {
  const seq = [...new Array(20).fill(0), ...new Array(20).fill(137), ...new Array(20).fill(0)];
  const r = spansFromLabels(seq, seq.length * HOP, HOP);
  assert.deepEqual(r.spans.map(s => s.name), ['Speech', 'Bass guitar', 'Speech']);
  assert.ok(r.spans[0].end <= 10.5, 'first span ends where the kind changes');
  assert.ok(r.spans[1].start >= 9, 'second span begins at the change');
});

test('a single flicker frame does not split a span', () => {
  const seq = [...new Array(10).fill(137), 0, 0, 137, ...new Array(10).fill(137)];
  const r = spansFromLabels(seq, seq.length * HOP, HOP);
  assert.equal(r.spans.length, 1, 'the flicker is smoothed away');
  assert.equal(r.spans[0].name, 'Bass guitar');
});

test('FALSIFIER — a brief blip shorter than a real section is absorbed, not reported', () => {
  const seq = [...new Array(10).fill(0), 137, 137, ...new Array(10).fill(0)];
  const r = spansFromLabels(seq, seq.length * HOP, HOP);
  assert.equal(r.spans.length, 1, 'the blip is absorbed into its neighbour');
  assert.equal(r.spans[0].name, 'Speech');
});

test('FALSIFIER — no frames yields no spans, never a crash', () => {
  const r = spansFromLabels([], 0, HOP);
  assert.deepEqual(r.spans, []);
  assert.equal(r.covered, 0);
});