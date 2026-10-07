// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/chroma.js. Pitch-class profile over a magnitude spectrum.

export function computeChroma(mags, sampleRate, fftSize) {
  const chroma = new Float64Array(12);
  const nyquistBin = mags.length - 1;
  for (let k = 1; k <= nyquistBin; k++) {
    const freq = (sampleRate * k) / fftSize;
    if (freq < 20 || freq > sampleRate / 2) continue;
    const pitch = 69 + 12 * Math.log2(freq / 440);
    const pitchClass = ((Math.round(pitch) % 12) + 12) % 12;
    chroma[pitchClass] += mags[k];
  }
  let normSq = 0;
  for (let i = 0; i < 12; i++) normSq += chroma[i] * chroma[i];
  const norm = Math.sqrt(normSq) || 1e-9;
  for (let i = 0; i < 12; i++) chroma[i] /= norm;
  return chroma;
}
