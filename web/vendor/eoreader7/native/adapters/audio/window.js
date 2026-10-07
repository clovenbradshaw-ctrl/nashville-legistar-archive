// the legacy engine · perceiver/audio — promoted verbatim from eoreader5's
// perceiver/audio/window.js. Hann window over a frame.

export function hannWindow(n) {
  const w = new Float64Array(n);
  if (n === 1) { w[0] = 1; return w; }
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}
