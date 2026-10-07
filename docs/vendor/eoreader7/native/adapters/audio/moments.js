// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/moments.js. Per-frame spectral moments: centroid, flux,
// rolloff, flatness, RMS.

export function computeMoments({ mags, prevMags, sampleRate, fftSize, frameSamples, rolloffFraction = 0.85 }) {
  const nBins = mags.length;

  let sumMag = 0, sumFreqMag = 0;
  for (let k = 0; k < nBins; k++) {
    const freq = (sampleRate * k) / fftSize;
    sumMag += mags[k];
    sumFreqMag += freq * mags[k];
  }
  const centroid = sumMag > 0 ? sumFreqMag / sumMag : 0;

  let flux = 0;
  if (prevMags) {
    for (let k = 0; k < nBins; k++) {
      const d = mags[k] - prevMags[k];
      if (d > 0) flux += d;
    }
  }

  const target = rolloffFraction * sumMag;
  let cumulative = 0, rolloff = (sampleRate * (nBins - 1)) / fftSize;
  for (let k = 0; k < nBins; k++) {
    cumulative += mags[k];
    if (cumulative >= target) { rolloff = (sampleRate * k) / fftSize; break; }
  }

  let logSum = 0, count = 0;
  for (let k = 1; k < nBins; k++) {
    if (mags[k] > 0) { logSum += Math.log(mags[k]); count++; }
  }
  const geoMean = count > 0 ? Math.exp(logSum / count) : 0;
  const arithMean = nBins > 1 ? sumMag / (nBins - 1) : 0;
  const flatness = arithMean > 0 ? geoMean / arithMean : 0;

  let sumSq = 0;
  for (let i = 0; i < frameSamples.length; i++) sumSq += frameSamples[i] * frameSamples[i];
  const rms = Math.sqrt(sumSq / frameSamples.length);

  return Float64Array.from([centroid, flux, rolloff, flatness, rms]);
}
