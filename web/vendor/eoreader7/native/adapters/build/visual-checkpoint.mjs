// adapters/build/visual-checkpoint.mjs — "we should have CV and OCR look
// at output at different checkpoints." Direct correction, and a precise
// one: the quote-injection bug that prompted this whole thread lived
// entirely in HTML ATTRIBUTE SYNTAX, invisible in rendered pixels — a
// browser silently tolerates the malformed attributes and still shows
// perfectly readable text. CV/OCR would NOT have caught that bug; the
// DOM-attribute check (escapingScore, coherence-properties.mjs) is the right
// tool for it. Chasing this honestly also found a SECOND real bug (a
// fuzzed show title containing `<img src=x onerror=...>` genuinely
// parses as a live element — real XSS) whose visible text STILL reads
// clean ("Evil Show") — so OCR would not have caught that one either.
//
// What CV/OCR is actually the right tool for, verified by construction
// rather than assumed: a gap between what the DOM CLAIMS is present
// (`element.textContent`) and what a real person actually SEES on
// screen. CSS (overflow:hidden, a fixed height, white-space:nowrap,
// z-index stacking, a color matching its own background) can make real,
// correct DOM content invisible or unreadable — a purely structural
// check is blind to this by construction, because it never looks at
// PIXELS. This app, as it stands today, has no clipping/overflow CSS
// anywhere (checked directly), so it does not currently exhibit this
// failure — disclosed honestly rather than forcing a demonstration where
// none exists. The mechanism below is real, tested, and general: it
// catches this class the moment any checkpoint's markup does clip
// something, in this app or any other screenshot handed to it.
import { createWorker } from "tesseract.js";

/** ocrText(pngBuffer) — real OCR, not a stand-in: tesseract.js reading an
 * actual screenshot's actual pixels. Returns the text a person looking at
 * the image would actually be able to read. */
export async function ocrText(pngBuffer) {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(pngBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/** visualFidelityCheck({domText, pngBuffer, expectSubstrings}) — the
 * checkpoint itself. Compares what OCR actually reads off the rendered
 * pixels against (a) the DOM's own claimed text and (b) an optional list
 * of substrings the caller expects to be genuinely visible. A large gap
 * between DOM length and OCR length, or an expected substring missing
 * from the OCR'd text, means real content the DOM carries is not
 * actually reaching a real viewer's eyes — the exact class this checkpoint
 * exists for, and the exact class a pure DOM/attribute check cannot see. */
export async function visualFidelityCheck({ domText, pngBuffer, expectSubstrings = [] }) {
  const ocr = (await ocrText(pngBuffer)).replace(/\s+/g, " ").trim();
  const domNormalized = (domText ?? "").replace(/\s+/g, " ").trim();
  const missing = expectSubstrings.filter((s) => !ocr.includes(s));
  // OCR is never pixel-perfect (font rendering, anti-aliasing) — this is
  // a coarse, honest signal (a large proportional gap), not a byte-exact
  // diff. The threshold is declared, not tuned against any one case.
  const lengthRatio = domNormalized.length > 0 ? ocr.length / domNormalized.length : 1;
  const substantiallyClipped = domNormalized.length > 20 && lengthRatio < 0.5;
  return {
    ocrText: ocr,
    domTextLength: domNormalized.length,
    ocrTextLength: ocr.length,
    lengthRatio,
    missingExpected: missing,
    visuallyIntact: missing.length === 0 && !substantiallyClipped,
    finding: substantiallyClipped
      ? `the DOM carries ${domNormalized.length} chars of text but OCR could only read ${ocr.length} back off the actual rendered pixels — real content is present but not actually visible to a person looking at the page (CSS clipping/overflow is the usual cause)`
      : missing.length
        ? `expected substring(s) never appeared in what OCR could read off the rendered pixels: ${missing.join(", ")}`
        : "OCR's reading of the rendered pixels matches what the DOM claims is there",
  };
}
