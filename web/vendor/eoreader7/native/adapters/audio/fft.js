// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/fft.js. Iterative radix-2 Cooley-Tukey FFT, in place on parallel re/im arrays.
// Framework-free: runs in browser and plain node.

export function fft(re, im) {
  const n = re.length;
  if (n !== im.length) throw new RangeError('fft: re/im length mismatch');
  if (n === 0) return;
  if ((n & (n - 1)) !== 0) throw new RangeError('fft: length must be a power of two');

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k], uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = uRe + vRe; im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe; im[i + k + half] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe; curIm = nextIm;
      }
    }
  }
}

export function magnitudeSpectrum(frame) {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  fft(re, im);
  const bins = n / 2 + 1;
  const mags = new Float64Array(bins);
  for (let k = 0; k < bins; k++) mags[k] = Math.hypot(re[k], im[k]);
  return mags;
}
