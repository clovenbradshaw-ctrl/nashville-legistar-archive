// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/resample.js. Channel collapse to mono + linear resampling.
// Perceiver-side only; the collapse is reported as a discard in Reading@1.

export function monoSum(channelData) {
  if (!channelData || channelData.length === 0) throw new RangeError('monoSum: at least one channel required');
  if (channelData.length === 1) return Float32Array.from(channelData[0]);
  const len = channelData[0].length;
  const out = new Float32Array(len);
  for (let c = 0; c < channelData.length; c++) {
    const ch = channelData[c];
    for (let i = 0; i < len; i++) out[i] += ch[i] / channelData.length;
  }
  return out;
}

export function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.round(samples.length * ratio));
  const out = new Float32Array(outLen);
  const lastIndex = samples.length - 1;
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.min(lastIndex, Math.floor(srcPos));
    const i1 = Math.min(lastIndex, i0 + 1);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}
