// quoting.js — what the person quoted, and what they said in their own words.
//
// ONE implementation, because this was got wrong twice in two files on the
// same day and each time it let something through (P133):
//
//   * `arithmetic.js` read the SHAPE of an ask from the whole question, so a
//     memory probe quoting a comparison fired the comparison door — seven
//     times in one live run.
//   * `transcript.js::quotedAsk` took the FIRST quoted span, so on a claim
//     quoting a line that itself contains quotation marks — «that: ""Both
//     true and untrue," Lincoln began; …"» — it returned the two-word inner
//     fragment and the misquote check had nothing to align.
//
// Both are the same fact about real text: QUOTES NEST, and a naive pair-off
// gets them wrong in opposite directions. When quoting is nested or
// unbalanced, the conservative reading is that everything from the first mark
// to the last is quoted material — the person is reporting it, not asking it.
// PURE.
const MARKS = /["“”]/g;
const CURLY_OPEN = /["“]/;

/** Every quote mark's index, in order. */
const marksIn = (t) => [...String(t ?? "").matchAll(MARKS)].map((m) => m.index);

/**
 * quotedSpan(text) → the material being quoted, or null.
 * Nested or unbalanced quoting is taken whole: first mark to last. A single
 * clean pair is taken as itself.
 */
export function quotedSpan(text) {
  const s = String(text ?? "");
  const at = marksIn(s);
  if (at.length < 2) return null;
  if (at.length === 2) {
    const inner = s.slice(at[0] + 1, at[1]).trim();
    return inner.length >= 8 ? inner : null;
  }
  const inner = s.slice(at[0] + 1, at[at.length - 1]).trim();
  return inner.length >= 8 ? inner : null;
}

/**
 * unquoted(text) → the person's OWN words, with quoted material removed.
 * The complement of `quotedSpan`, and the thing a detector should read when
 * it is deciding what KIND of question this is.
 */
export function unquoted(text) {
  const s = String(text ?? "");
  const at = marksIn(s);
  if (at.length < 2) return s;
  if (at.length === 2) return (s.slice(0, at[0]) + " " + s.slice(at[1] + 1)).trim();
  return (s.slice(0, at[0]) + " " + s.slice(at[at.length - 1] + 1)).trim();
}

/** True when the text quotes something at all. */
export const quotes = (text) => marksIn(text).length >= 2 && Boolean(quotedSpan(text));
