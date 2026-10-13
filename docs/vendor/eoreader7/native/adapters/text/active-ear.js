// active-ear.js — the language the reader is HEARING right now, for the
// context-free tokenizers.
//
// The pipeline's tokenizers (organs/source.js::tokenize, adapters/text/
// material.js::tokenize, memory/activation.js::tokens — the last is the
// observable set DMD decomposes) are plain functions of a string; they cannot
// be handed a language. They split on letters, which is right for a spaced
// script and wrong for Chinese (a clause is one "word") and Arabic/Hebrew
// (a proclitic glued to the front of every word fragments its recurrence).
// So the reader DECLARES the ear it is using for the span of a read, and the
// tokenizers hear through it. With no ear active every tokenizer is
// byte-identical to before this file existed.
//
// `withEar(ear, fn)` scopes the declaration to a synchronous call and restores
// the previous one (an async caller must wrap each synchronous section, never
// hold an ear across an `await`). The ear is `makeEar(...)`'s `{segment,peel}`.
let current = null;

export const activeEar = () => current;

export function withEar(ear, fn) {
  const prev = current;
  current = ear && (ear.segment || ear.peel) ? ear : null;
  try { return fn(); } finally { current = prev; }
}

/** The text as the active language hears it (spaces at its word boundaries, bound morphemes split), or unchanged. */
export function hear(text) {
  const t = String(text ?? "");
  if (!current) return t;
  let out = t.toLowerCase();
  if (current.segment) out = current.segment(out);
  if (current.peel) out = current.peel(out);
  return out;
}
