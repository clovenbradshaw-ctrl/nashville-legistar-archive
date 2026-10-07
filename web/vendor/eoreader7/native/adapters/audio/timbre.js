// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/timbre.js. Mel filterbank + DCT coefficients (MFCC-style).

function hzToMel(f) { return 2595 * Math.log10(1 + f / 700); }
function melToHz(m) { return 700 * (10 ** (m / 2595) - 1); }

export function melFilterbank(numFilters, fftSize, sampleRate, minHz = 0, maxHz = sampleRate / 2) {
  const melMin = hzToMel(minHz), melMax = hzToMel(maxHz);
  const nPoints = numFilters + 2;
  const hzPoints = new Float64Array(nPoints);
  for (let i = 0; i < nPoints; i++) hzPoints[i] = melToHz(melMin + (i * (melMax - melMin)) / (nPoints - 1));
  const nBins = fftSize / 2 + 1;
  const bins = Array.from(hzPoints, (hz) => Math.floor(((fftSize + 1) * hz) / sampleRate));

  const filters = [];
  for (let m = 1; m <= numFilters; m++) {
    const f = new Float64Array(nBins);
    const left = bins[m - 1], center = bins[m], right = bins[m + 1];
    if (center > left) for (let k = left; k < center && k < nBins; k++) if (k >= 0) f[k] = (k - left) / (center - left);
    if (right > center) for (let k = center; k < right && k < nBins; k++) if (k >= 0) f[k] = (right - k) / (right - center);
    filters.push(f);
  }
  return filters;
}

export function computeTimbre(mags, filterbank, numCoeffs) {
  const numFilters = filterbank.length;
  const energies = new Float64Array(numFilters);
  for (let m = 0; m < numFilters; m++) {
    const filter = filterbank[m];
    let sum = 0;
    for (let k = 0; k < filter.length; k++) sum += filter[k] * mags[k];
    energies[m] = Math.log(sum + 1e-10);
  }
  const coeffs = new Float64Array(numCoeffs);
  for (let c = 0; c < numCoeffs; c++) {
    let sum = 0;
    for (let m = 0; m < numFilters; m++) sum += energies[m] * Math.cos((Math.PI / numFilters) * (m + 0.5) * c);
    coeffs[c] = sum;
  }
  return coeffs;
}
