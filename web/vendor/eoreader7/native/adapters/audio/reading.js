// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/reading.js. The field-vector perceiver: PCM in, Reading@1
// out (per-frame chroma+timbre+moments). Structure-neutral by construction —
// onsets, beats, segmentation are emergence's, never this module's.
//
// Audio perceiver: PCM in, field vectors out. No structure-finding.
// Structure (segments, onsets, beats) is engine territory — emergence finds it.
//
// The perceiver answers: what are the units, what is each unit's field vector?
// Nothing more. It is modality-specific (audio DSP) but structure-neutral.

import { magnitudeSpectrum } from './fft.js';
import { hannWindow } from './window.js';
import { monoSum, resampleLinear } from './resample.js';
import { computeChroma } from './chroma.js';
import { melFilterbank, computeTimbre } from './timbre.js';
import { computeMoments } from './moments.js';

export const TARGET_SAMPLE_RATE = 22050;
export const FRAME_SIZE = 4096;
export const HOP_SIZE = 1024;
export const MEL_FILTERS = 26;

const CHROMA_DIMS = 12;
const TIMBRE_DIMS = 13;
const MOMENTS_DIMS = 5;

export const AUDIO_FIELD_SPEC = Object.freeze({
  channels: [
    { name: 'chroma', dims: CHROMA_DIMS, metric: 'cosine' },
    { name: 'timbre', dims: TIMBRE_DIMS, metric: 'cosine' },
    { name: 'moments', dims: MOMENTS_DIMS, metric: 'euclidean-standardised' },
  ],
});

export function frameSignal(samples, frameSize, hop) {
  const frames = [];
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    frames.push(samples.subarray(start, start + frameSize));
  }
  if (frames.length === 0 && samples.length > 0) {
    const padded = new Float32Array(frameSize);
    padded.set(samples);
    frames.push(padded);
  }
  return frames;
}

export function extractFrameFields(samples, sampleRate, { frameSize = FRAME_SIZE, hop = HOP_SIZE } = {}) {
  const frames = frameSignal(samples, frameSize, hop);
  const window = hannWindow(frameSize);
  const filterbank = melFilterbank(MEL_FILTERS, frameSize, sampleRate);
  let prevMags = null;
  const perFrame = frames.map((frame) => {
    const windowed = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) windowed[i] = frame[i] * window[i];
    const mags = magnitudeSpectrum(windowed);
    const chroma = computeChroma(mags, sampleRate, frameSize);
    const timbre = computeTimbre(mags, filterbank, TIMBRE_DIMS);
    const moments = computeMoments({ mags, prevMags, sampleRate, fftSize: frameSize, frameSamples: frame });
    prevMags = mags;
    return { chroma, timbre, moments };
  });
  return { frames: perFrame, frameSize, hop, sampleRate };
}

async function contentHash(bytes) {
  const g = globalThis;
  if (g.crypto && g.crypto.subtle && typeof g.crypto.subtle.digest === 'function') {
    const digest = await g.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex}`;
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

// The perceiver: raw PCM in, Reading@1 out. Structure-neutral.
// No onset detection, no beat-sync, no segmentation. Just field vectors.
export async function buildAudioReading({ channelData, sampleRate, sourceBytes, perceiver = {} }) {
  if (!channelData || channelData.length === 0) throw new RangeError('buildAudioReading requires at least one channel');
  if (!sampleRate) throw new RangeError('buildAudioReading requires sampleRate');

  const summed = monoSum(channelData);
  const resampled = resampleLinear(summed, sampleRate, TARGET_SAMPLE_RATE);
  const { frames } = extractFrameFields(resampled, TARGET_SAMPLE_RATE);

  const hash = sourceBytes ? await contentHash(sourceBytes) : null;

  // Raw frames as units — no structure imposed. Emergence finds the rest.
  const units = frames.map((f, idx) => ({
    pos: (idx * HOP_SIZE) / TARGET_SAMPLE_RATE,
    span: HOP_SIZE / TARGET_SAMPLE_RATE,
    field: [...f.chroma, ...f.timbre, ...f.moments],
    block_id: `block:${hash || 'inline'}:${idx}`,
  }));

  const extent = frames.length > 0 ? (frames.length * HOP_SIZE + FRAME_SIZE) / TARGET_SAMPLE_RATE : 0;

  const discard = [
    { kind: 'phase-spectrum', reason: 'magnitude-only STFT; phase discarded', recoverable: false },
    { kind: 'sample-rate-reduction', reason: `resampled from ${sampleRate} Hz to ${TARGET_SAMPLE_RATE} Hz`, recoverable: true },
    { kind: 'channel-collapse', reason: `${channelData.length} channel(s) summed to mono`, recoverable: true },
  ];

  const perceiverInfo = {
    id: 'audio-field-vectors',
    version: '0.1.0',
    ...perceiver,
    params: {
      frameSize: FRAME_SIZE,
      hop: HOP_SIZE,
      targetSampleRate: TARGET_SAMPLE_RATE,
      melFilters: MEL_FILTERS,
      ...(perceiver.params || {}),
    },
  };

  return {
    schema: 'Reading@1',
    medium: 'audio',
    axis: { kind: 'time', unit: 's', extent },
    units,
    field_spec: AUDIO_FIELD_SPEC,
    segments_proposed: [],
    sightings: [],
    discard,
    perceiver: perceiverInfo,
    content_hash: hash,
  };
}
