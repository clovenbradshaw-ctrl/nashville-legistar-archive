// fold-chat-impression.js — keep the difference that makes a difference, not the page.
//
// A read page is up to 24,000 characters; the model used to be shown the first
// 4,000. For an encyclopedia article that is the introduction, and the sentence
// that answers the ask (how long per side, what year, which dose) is on page
// nine. And holding every page whole is not the point of reading it: what has
// to outlive the read is an IMPRESSION — the few sentences that make a
// difference to the ask — with the page's SHADOW behind it.
//
// This is the holograph's own keyless memory (THE-HOLOGRAPH §3, relative.js),
// not a string scorer:
//
//   SHADOW   every sentence of the page is admitted to a Field as a shadow node:
//            the state its words light (bits) and its ADDRESS in the page — no
//            words. The ask recalls against that field (`Field.recall`): start
//            from the cue's state and let activation settle.
//   NULL BAND  what counts as a recall is not chosen. `nullBand` measures what
//            a cue of this length pulls out of THIS field by chance, from the
//            field's own vocabulary; a sentence below the weakest chance top
//            (`lo`) is noise, and one between lo and hi must earn its place by
//            REACH. A word every sentence carries lifts every sentence the same
//            and so lifts none above the band — that is "a difference that makes
//            no difference", measured, not listed.
//   REACH    the cut (`dmdWindow`'s question, "does showing one more sentence
//            change what the ask reaches?"): a recalled sentence is kept only if
//            it carries a cue word that tells sentences apart, or a figure, not
//            already carried by what is kept. A restatement reaches nothing new.
//   ECHO     the coarse tier (512 bits, 64 bytes): "something like this was said
//            here", never read back. It rides the record beside the shadow.
//
// The impression is the kept sentences, re-expanded from the page by their
// ADDRESS (byte ranges) — the holograph's re-expansion through the record. The
// shadow keeps those addresses, the page's length and a fingerprint, so what was
// kept stays checkable after the page itself is dropped.
//
// Nothing here keys on capitals or on a language's word list: word boundaries
// come from the script (`segments`, Intl.Segmenter), and what is common comes
// from the page itself. Deterministic: the null band is drawn from a PRNG seeded
// by the page and the ask, so the same page and ask give the same impression.

import { Field, sdrOf, packSdr, bytesToBase64, ECHO_BITS } from "./vendor/khora/native/the-fold/relative.js";
import { segments, fold } from "./fold-chat-mind.js";
import { endsWithAbbreviation } from "./fold-chat-junk.js";

// Declared, not measured (Constitution II.11 — a number with its giver):
export const DECLARED = Object.freeze({
  // A line shorter than this many words is a heading, a label, a nav item — it
  // says nothing alone. Words are the SCRIPT's own segments, never characters.
  minWords: 5,
  // A run longer than this with no stop is a table or a wall, not a sentence.
  maxWords: 140,
  // Draws for the null band: enough to find the chance ceiling of a small field.
  nullDraws: 60,
  // A word in at least this share of the page's sentences tells them apart not
  // at all (it is the page's subject, or its grammar).
  commonShare: 0.5,
});

/** FNV-1a, 32-bit, hex — a fingerprint, not a security hash. */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** Sentences with their offsets in the original text. ASCII . ! ? end a sentence only before whitespace (so "3.5", "4.97" and
 *  "D.C." stay whole — the old pattern LOST the words before any decimal point); a "." that ends a known abbreviation or a lone
 *  initial ("Fig.", "Dr.", "J.") does not end one; 。！？ end one anywhere; a line break always does. Ranges slice back exactly. */
export function sentencesWithOffsets(text) {
  const src = String(text ?? "");
  const n = src.length, out = [];
  let start = 0, i = 0;
  const push = (a, b) => {
    let s = a, e = b;
    while (s < e && /\s/.test(src[s])) s++;
    while (e > s && /\s/.test(src[e - 1])) e--;
    if (e > s) out.push({ text: src.slice(s, e), start: s, end: e });
  };
  while (i < n) {
    const ch = src[i];
    if (ch === "\n") { push(start, i); start = ++i; continue; }
    if (ch === "。" || ch === "！" || ch === "？") {
      let j = i + 1;
      while (j < n && /[。！？]/.test(src[j])) j++;
      while (j < n && /["')\]”’」』]/.test(src[j])) j++;
      push(start, j); start = i = j; continue;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      let j = i + 1;
      while (j < n && /[.!?]/.test(src[j])) j++;
      let k = j;
      while (k < n && /["')\]”’]/.test(src[k])) k++;
      if (k >= n || /\s/.test(src[k])) {
        const lone = ch === "." && j === i + 1;
        if (!(lone && endsWithAbbreviation(src.slice(start, j)))) { push(start, k); start = i = k; continue; }
      }
      i = j; continue;
    }
    i++;
  }
  push(start, n);
  return out;
}

// The words of a text, as the script segments them, case/diacritic-folded.
const wordsOf = (s) => segments(s).map((x) => fold(x.text));
const spaced = (s) => wordsOf(s).join(" ");
const isFigure = (w) => /^\p{N}/u.test(w);

// A small seeded PRNG so the null band is reproducible.
function rngFrom(seed) {
  let a = parseInt(fingerprint(seed), 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * The impression of a page for an ask.
 * @returns { text, shadow }
 *   `text`   the kept sentences in page order, one per line (the impression);
 *   `shadow` { chars, kept, hash, segments:[{start,end}], echo, band, recalled }
 *            segments are byte ranges in the ORIGINAL page; echo is the 512-bit
 *            coarse tier as base64; band/recalled disclose the cut.
 */
export function impressionOf(text, question, { budget = 3000, lead = true } = {}) {
  const src = String(text ?? "");
  const hash = fingerprint(src);
  const whole = () => ({ text: src, shadow: { chars: src.length, kept: src.length, hash, segments: src.length ? [{ start: 0, end: src.length }] : [], echo: echoOf(src) } });
  if (src.length <= budget) return whole();

  // A STRUCTURED HEAD (the reader's own "Recipe: …" block, ingredients and steps
  // as short lines) is already a distillation of the page. Its lines are too
  // short to be prose and would be thrown away below, so it is kept whole as one
  // segment and only the prose after it is reduced.
  const headEnd = /^Recipe: /.test(src) ? src.indexOf("\n\n") : -1;
  if (headEnd > 0 && headEnd < budget) {
    const head = src.slice(0, headEnd);
    const shift = headEnd + 2;
    const tail = impressionOf(src.slice(shift), question, { budget: Math.max(0, budget - head.length - 1), lead: false });
    const segs = [{ start: 0, end: headEnd }, ...tail.shadow.segments.map((g) => ({ start: g.start + shift, end: g.end + shift }))];
    const out = tail.text ? head + "\n" + tail.text : head;
    return { text: out, shadow: { chars: src.length, kept: head.length + tail.shadow.kept, hash, segments: segs, echo: echoOf(out), band: tail.shadow.band, recalled: tail.shadow.recalled } };
  }

  const sents = sentencesWithOffsets(src).map((s) => ({ ...s, w: wordsOf(s.text) })).filter((s) => s.w.length >= DECLARED.minWords && s.w.length <= DECLARED.maxWords);
  if (!sents.length) return whole();

  // SHADOW: admit every sentence as a state + address, no words, in page order
  // (admission chains each to the one before it — temporal adjacency).
  const field = new Field({ spread: 0.25, steps: 1 });
  sents.forEach((s, i) => field.admit(s.w.join(" "), { i, start: s.start, end: s.end }, { tier: "shadow" }));

  // WHICH WORDS OF THE ASK MAKE A DIFFERENCE here: a word in half the page's
  // sentences is its subject or its grammar and tells them apart not at all
  // (cosine over bits would let "Eiffel Tower" outvote "rivets" on an Eiffel
  // page). Only words present in the page but not in most of it are the cue.
  const cueWords = wordsOf(question);
  const df = new Map();
  for (const s of sents) for (const w of new Set(s.w)) df.set(w, (df.get(w) || 0) + 1);
  const tells = new Set(cueWords.filter((w) => (df.get(w) || 0) > 0 && (df.get(w) || 0) / sents.length < DECLARED.commonShare));

  // RECALL: the telling words are the cue. What beats chance is a recall — the
  // null band is measured on THIS field, never set.
  const kept = new Set();
  let used = 0;
  const take = (i) => { kept.add(i); used += sents[i].text.length + 1; };
  if (lead) take(0);                                        // what the page IS: the identity of the shadow
  let band = { lo: 0, hi: 0 }, recalled = 0;
  if (tells.size && sents.length > 1) {
    const cue = [...tells];
    band = field.nullBand(cue.length, { draws: DECLARED.nullDraws, rng: rngFrom(hash + "|" + cue.join(" ")) });
    // Below `lo` — the weakest top activation chance ever produced here — is noise.
    // Between lo and hi chance COULD reach, so the reach cut below decides those.
    const hits = field.recall(cue.join(" ")).filter((r) => r.activation > band.lo);
    recalled = hits.length;

    // REACH: a recalled sentence is kept only if it shows what is not yet shown.
    const covered = new Set();
    const cover = (i) => { for (const w of sents[i].w) if (tells.has(w) || isFigure(w)) covered.add(w); };
    if (kept.has(0)) cover(0);
    for (const { node } of hits) {                          // strongest recall first
      const i = node.payload.i;
      if (kept.has(i) || used + sents[i].text.length + 1 > budget) continue;
      // A telling cue word not yet carried — or, in a sentence that carries one
      // at all, a figure not yet carried (a "when/how many" answer is the
      // number, and may use none of the ask's other words).
      const w = sents[i].w;
      const onAsk = w.some((x) => tells.has(x));
      const adds = w.some((x) => tells.has(x) && !covered.has(x)) || (onAsk && w.some((x) => isFigure(x) && !covered.has(x)));
      if (!adds) continue;                                  // shows nothing the ask doesn't already have
      take(i); cover(i);
    }
  }

  const idx = [...kept].sort((a, b) => a - b);
  const sel = idx.map((i) => sents[i]);
  const out = sel.map((s) => s.text).join("\n");
  return {
    text: out,
    shadow: { chars: src.length, kept: sel.reduce((n, s) => n + s.text.length, 0), hash, segments: sel.map((s) => ({ start: s.start, end: s.end })), echo: echoOf(out), band: { lo: +(band.lo || 0).toFixed(4), hi: +(band.hi || 0).toFixed(4) }, recalled },
  };
}

/** The ECHO tier of a text: 512 bits, 64 bytes, base64 — "something like this
 *  was said here", never read back. */
export function echoOf(text) {
  return bytesToBase64(packSdr(sdrOf(spaced(text), { bits: ECHO_BITS }), { bits: ECHO_BITS }));
}

/** Map a span inside the impression text back to the original page: the byte
 *  range of the shadow segment(s) it falls in. Lets an address stay checkable
 *  after the page itself is dropped. */
export function originalSpan(shadow, start, end) {
  if (!shadow || !Array.isArray(shadow.segments)) return null;
  let pos = 0, from = null, to = null;
  for (const seg of shadow.segments) {
    const len = seg.end - seg.start;
    const a = pos, b = pos + len;                 // this segment's range in the impression text
    if (from == null && start < b + 1 && start >= a) from = seg.start + (start - a);
    if (end > a && end <= b + 1) { to = seg.start + Math.min(end - a, len); break; }
    pos = b + 1;                                   // the "\n" between sentences
  }
  return from != null && to != null ? { start: from, end: to } : null;
}
