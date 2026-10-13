// holodeck-pcm.test.mjs — the hand-written demuxers that let a long recording stream instead of
// decoding whole. Node has no AudioDecoder, so this pins the container reading: codec, rate,
// channels, duration, and that the packets tile the file and add up to the recording's length.
// Fixtures are 3 s of speech made by ffmpeg (tests/fixtures/audio); the browser half (decode,
// resample, window cutting) was checked against ffmpeg's own 16 kHz decode (r = 0.999).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demuxAudio, probeAudio } from './holodeck-pcm.js';

const fx = n => readFileSync(new URL('tests/fixtures/audio/' + n, import.meta.url));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, msg + ': ' + a + ' vs ' + b);

for (const [file, container, codec, rate, ch, dur, perPacket] of [
  ['speech-3s.m4a', 'mp4', 'mp4a.40.2', 22050, 1, 3.0, 1024],
  ['speech-3s-video.mp4', 'mp4', 'mp4a.40.2', 22050, 1, 3.0, 1024],   // the sound track of a video, past the video track
  ['speech-3s.webm', 'webm', 'opus', 48000, 1, 3.008, null],
  ['speech-3s.mp3', 'mp3', 'mp3', 22050, 1, 3.0, 576],               // MPEG-2 layer III; first frame is the Info header
  ['speech-3s.aac', 'adts', 'mp4a.40.2', 22050, 1, null, 1024],
]) {
  test('demuxAudio reads ' + file, () => {
    const b = fx(file), d = demuxAudio(b);
    assert.ok(d, 'recognised');
    assert.equal(d.container, container); assert.equal(d.codec, codec);
    assert.equal(Math.round(d.sampleRate), rate); assert.equal(d.channels, ch);
    if (dur != null) near(d.duration, dur, 0.06, 'duration');
    const ps = [...d.packets];
    assert.ok(ps.length > 10, 'has packets');
    let last = -1, lastUs = -1;
    for (const p of ps) { assert.ok(p.off >= 0 && p.size > 0 && p.off + p.size <= b.length, 'packet inside the file'); assert.ok(p.off >= last, 'packets in file order'); assert.ok(p.us >= lastUs, 'time never goes back'); last = p.off + (container === 'mp4' ? 0 : p.size); lastUs = p.us; }
    if (perPacket) near(ps.length * perPacket / rate, dur != null ? dur : 3.0, 0.12, 'packets add up to the length');
    if (codec === 'mp3') assert.equal(b[ps[0].off], 0xff, 'mp3 packets start on a frame sync');
  });
}

test('the edit list priming is read from the MP4 (AAC encoder delay)', () => {
  const d = demuxAudio(fx('speech-3s.m4a'));
  assert.ok(d.skipSec > 0 && d.skipSec < 0.2, 'skipSec ' + d.skipSec);
});

test('WAV is read straight from its header, no decoder', async () => {
  const p = await probeAudio(fx('speech-3s.wav'));
  assert.deepEqual({ ...p, duration: +p.duration.toFixed(3) }, { container: 'wav', codec: 'pcm', sampleRate: 8000, channels: 2, duration: 3 });
});

test('unknown bytes are not mistaken for a container', async () => {
  assert.equal(await probeAudio(new Uint8Array(4096)), null);
  assert.equal(await probeAudio(new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n'.repeat(50))), null);
});
