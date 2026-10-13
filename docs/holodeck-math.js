// holodeck-math.js — the vendored mathjs engine for the model-free computation
// door (answerable.js's comparison doors). One lazy instance, vendored at
// vendor/mathjs/math.js (the UMD browser bundle) — never a CDN, and never
// loaded unless the question itself looks arithmetic.
//
// THE LOADING TRICK, DISCLOSED. The UMD wrapper assigns its engine to `this`
// ("this.math = ...") — and in an ES module `this` is undefined, so the bundle
// must NOT be imported as ESM. Two honest paths, same bytes:
//   · browser — injected as a CLASSIC <script> (not a module), so `this` is
//     window and window.math appears.
//   · node/tests — the same file is required as CommonJS (vendor/mathjs/
//     package.json declares "type":"commonjs", so the ESM loader interops it)
//     and `m.default` is the engine.
// Either way, the same vendored file produces the same engine; nothing here
// is ever fetched from a CDN.
let _math = null;
let _p = null;

export function mathInstance() {
  if (_math) return Promise.resolve(_math);
  if (_p) return _p;
  _p = (async () => {
    if (typeof globalThis !== 'undefined' && globalThis.math && typeof globalThis.math.evaluate === 'function') { _math = globalThis.math; return _math; }
    if (typeof document !== 'undefined' && document.createElement) {
      await loadClassicScript('./vendor/mathjs/math.js');
      if (!globalThis.math || typeof globalThis.math.evaluate !== 'function') throw new Error('mathjs loaded but window.math was not set');
      _math = globalThis.math;
      return _math;
    }
    const m = await import('./vendor/mathjs/math.js');
    _math = m.default ?? m.math ?? m;
    if (!_math || typeof _math.evaluate !== 'function') throw new Error('mathjs did not yield an engine');
    return _math;
  })().catch((e) => { _p = null; throw e; });
  return _p;
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('mathjs failed to load: ' + src));
    document.head.appendChild(s);
  });
}

// The declared gate: only a question carrying a digit or an arithmetic/quantity
// word pays the ~650 KB engine load at all. A shape rule over the question,
// never a verdict about content; the door itself decides what it can answer.
const ARITH_RE = /\d|times|minus|plus|divided|multiplied|subtract(?:ed)?|percent|%|larger|smaller|earlier|later|older|younger|taller|shorter|faster|slower|how (?:many|much|old|long|far|tall)\b/i;
export const aboutArithmetic = (question) => ARITH_RE.test(String(question ?? ''));

export default { mathInstance, aboutArithmetic };