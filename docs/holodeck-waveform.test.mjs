import test from 'node:test';
import assert from 'node:assert/strict';
import { peaksOf, timeAtX, decodePeaks } from './holodeck-waveform.js';

test('peaksOf: one peak per bucket, loudest bucket is 1, silence stays 0', () => {
  const s = new Float32Array(1000);
  s[10] = 0.2; s[510] = -0.8; // two spikes, the second (negative) is the loudest
  const p = peaksOf(s, 4);
  assert.equal(p.length, 4);
  assert.equal(p[0], 0.25);          // 0.2 / 0.8
  assert.equal(p[1], 0);
  assert.equal(p[2], 1);             // |-0.8| / 0.8
  assert.equal(p[3], 0);
});

test('peaksOf: fewer samples than buckets, empty input, all-silent input', () => {
  assert.equal(peaksOf(new Float32Array([0.5, 1]), 8).length, 8);
  assert.deepEqual([...peaksOf(new Float32Array(0), 3)], [0, 0, 0]);
  assert.deepEqual([...peaksOf(new Float32Array(100), 5)], [0, 0, 0, 0, 0]);
});

test('timeAtX: maps a pixel to a time and clamps to the recording', () => {
  assert.equal(timeAtX(50, 200, 60), 15);
  assert.equal(timeAtX(-5, 200, 60), 0);
  assert.equal(timeAtX(999, 200, 60), 60);
  assert.equal(timeAtX(10, 0, 60), 0);
  assert.equal(timeAtX(10, 200, 0), 0);
});

test('decodePeaks: null (not a throw) when there is no audio context or no bytes', async () => {
  assert.equal(await decodePeaks(null), null);
  assert.equal(await decodePeaks(new ArrayBuffer(8)), null); // node has no OfflineAudioContext
});
