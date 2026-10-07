// holodeck-holders.js — WHO IS TELLING, per statement: the holder-indexed
// reading, assembled the way the pipeline reads it.
//
// Perspective = Interpretation × Figure = Lens (cube.js's TERRAIN_BY_DOMAIN).
// The kernel names the cell (perspective.js); this module fills it for the
// surface by reading -- per statement -- who holds it, and never inventing a
// holder. Every statement leaves with `heldBy`:
//
//   { holder, depth, via, basis, gap }
//
// `basis` is perspective.js's own closed set (witnessed | asserted | reported |
// inherited); `gap` is a TYPED absence where no holder could be admitted.
//
// THE HOLDER IS A FRAME, NOT A WINDOW. An earlier cut paired a verb with a name
// in a ±90-character window around a quotation mark. That is not how the
// pipeline reads: the driver native/eval/nested-narration.mjs steps the text in
// order and asks, at each offset, WHO IS TELLING -- over the frames the material
// itself declares -- and lands one perspectiveOperation per telling. Reading a
// novel as four tellers (Walton > Victor > the creature) is exactly that:
//
//   attribution.js::holderAt(offset, { narration, embedded })
//     embedded quotation frame (depth 2)  OUTRANKS
//     outer narration frame (depth 1)     OUTRANKS
//     outside every known frame           -> no holder, a typed absence
//
// The frames are DECLARED, never inferred:
//   * speaker.js::speakerSections — an epistolary heading, a letter, a journal,
//     a named section. This is the always-on channel; the material says who is
//     telling, and this reads the binding.
//   * attribution.js::narrationFrames — an INJECTED frame prior (narratorSpans,
//     the same coref prior's own curation the nested-narration driver uses).
//     Absent a prior it returns a typed gap, never a guessed narrator (P3).
//   * attribution.js::quotationFrames — a RUN of continued-quotation paragraphs
//     is an embedded telling; its speaker, when declared, outranks the frame.
//
// NL → RELATIVE GRAMMAR → EOT → RELATIVE GRAMMAR → NL. The holder read is the
// frame layer over an EOT: the front leg reads each statement through the
// language's OWN grammar (relations-language.js::relationExtractorsFor under
// its RoleConfig@1) into EOGfpClaim@1 triples {end1, label, end2}; the back leg
// renders a claim back through the same language's lens
// (holodeck-lang.js::lensFor + kernel/gfp-claim.js::render). This module takes
// `relationsOf` (the bound front leg) and attaches `st.eot`, so the surface
// carries the language-neutral claim beside the holder. It never renders, and
// it never reads a language through another language's RoleConfig.
//
// END KEYS (perspective-claims.js::claimEndKey, used by the driver): a claim
// end becomes a being by priority -- resolved referent > the FRAME'S NARRATOR
// (first person) > a bound pronoun > the bare surface. This module reads the
// frame; pronoun binding is a separate organ (bindNarrationFrames) and is left
// to the caller's assembly, named here rather than guessed.
//
// MEASURED, DISCLOSED LIMITS:
//   1. A document with no declared heading and no injected frame prior has no
//      narration frame: its statements are the READER's own, witnessed. That is
//      perspective.js's true reading, not a default that hides a question.
//   2. A single quotation inside un-framed prose is not a run, so it is not an
//      embedded frame; a run whose speaker is not declared is a typed gap
//      (embedded_speaker_unattributed), never handed to the reader.
//   3. Sentence-level reporting ("the minister said X") is NOT a frame the
//      nested-narration driver reads; it is its own organ (a reported clause is
//      a nested proposition), named here so it is not silently lost.

import { holderAt, narrationFrames, quotationFrames } from './vendor/eoreader7/native/adapters/text/attribution.js';
import { speakerSections } from './vendor/eoreader7/native/organs/speaker.js';
import { READER, BASIS, perspectiveOperation, projectPerspectives } from './vendor/eoreader7/native/kernel/perspective.js';

const freeze = Object.freeze;

/** Every frame the document declares: its own headings (always), plus any
 *  narration prior the caller injects. Sorted by offset; overlapping is fine —
 *  holderAt takes the first containing frame. */
function framesOf(text, framePrior) {
  const out = [];
  for (const s of speakerSections(text)) out.push(freeze({ narrator: s.speaker, heading: s.heading, byteStart: s.start, byteEnd: s.end, how: s.how }));
  if (framePrior) {
    let nf = null;
    try { nf = narrationFrames(text, { framePrior }); } catch (e) { nf = null; }
    for (const f of (nf?.frames ?? [])) out.push(freeze({ narrator: f.narrator, heading: f.fromAnchor ?? '', byteStart: f.byteStart, byteEnd: f.byteEnd, how: 'prior' }));
  }
  out.sort((a, b) => a.byteStart - b.byteStart);
  return out;
}

/**
 * Attribute every statement in `sts` to the frame that holds it.
 *
 * `docs` carry the raw text (its newlines and byte offsets) so heading detection
 * and quotation runs run over the material as received.
 *
 * Injected (P3):
 *   framePrior        an optional narration prior (attribution.js's contract) —
 *                     the same curation nested-narration.mjs injects
 *   embeddedSpeakersOf(doc, quotes) -> Map(spanStart -> speaker), optional; a
 *                     run whose speaker is declared is held by that speaker
 *   relationsOf(text) -> EOGfpClaim@1 triples [{end1, label, end2, polarity}]
 *                     from the language's OWN front leg; attached as `st.eot`,
 *                     never read for the holder (the frame is the holder)
 */
export function attributeStatements(sts, docs = [], { framePrior = null, embeddedSpeakersOf = null, relationsOf = null } = {}) {
  const perDoc = new Map();
  for (const d of docs || []) {
    const text = d.text || '';
    let quotes = { embeddedFrames: [] };
    try { quotes = quotationFrames(text); } catch (e) { /* a malformed doc has no runs — a gap, never a guess */ }
    const embedded = (quotes.embeddedFrames || []).map((r) => freeze({ start: r.start, end: r.end }));
    let embeddedSpeakers = new Map();
    if (embeddedSpeakersOf) { try { embeddedSpeakers = embeddedSpeakersOf(d, quotes) || new Map(); } catch (e) { embeddedSpeakers = new Map(); } }
    perDoc.set(d.id, { narration: freeze({ frames: framesOf(text, framePrior) }), embedded, embeddedSpeakers });
  }
  const out = new Map();
  for (const st of sts || []) {
    if (relationsOf) { try { st.eot = relationsOf(st.text); } catch (e) { st.eot = []; } }
    const f = perDoc.get(st.doc);
    if (f) {
      const at = holderAt(st.s, { narration: f.narration, embedded: f.embedded, embeddedSpeakers: f.embeddedSpeakers });
      if (at.holder) {
        out.set(st.id, freeze({ holder: at.holder, depth: at.depth, via: freeze(['frame', at.basis && String(at.basis).startsWith('narration') ? 'narration' : 'embedded']), basis: BASIS.ASSERTED, gap: null }));
        continue;
      }
      if (at.gap === 'embedded_speaker_unattributed') {
        out.set(st.id, freeze({ holder: null, depth: 0, via: freeze([]), basis: null, gap: freeze({ type: 'embedded_speaker_unattributed', detail: 'this statement sits inside a quotation run whose speaker is not declared — the line is unowned, a result' }) }));
        continue;
      }
      if (at.gap === 'unassigned_by_prior') {
        out.set(st.id, freeze({ holder: null, depth: 0, via: freeze([]), basis: null, gap: freeze({ type: 'unassigned_by_prior', detail: 'the section this statement sits in declares no speaker — a typed absence, never a nearest-guess' }) }));
        continue;
      }
    }
    // No frame claims it: the reading's own witnessed belief (perspective.js).
    out.set(st.id, freeze({ holder: READER, depth: 0, via: freeze([]), basis: BASIS.WITNESSED, gap: null }));
  }
  return out;
}

/** The perspective projection over the statements' heldBy records — the same
 *  projectPerspectives the nested-narration driver runs: every holder's beliefs,
 *  kept apart (perspective.js). `latent` names the admitted cast that holds
 *  nothing (spoken of, never telling). */
export function projectHolders(sts, names = {}) {
  const log = [];
  for (const st of sts || []) { const h = st.heldBy; if (h && h.holder) log.push(perspectiveOperation({ holder: h.holder, claim: st.id, basis: h.basis })); }
  const projected = projectPerspectives(log);
  const holders = projected.holders.filter((h) => h !== READER);
  const latent = Object.keys(names || {}).filter((n) => !projected.perspectives[n]).sort();
  return freeze({ projected, holders: freeze(holders), latent: freeze(latent), readerActs: (projected.perspectives[READER]?.beliefs ?? []).length });
}

/** Roll a statement list's heldBy records into the surface's summary. */
export function summarizeHolders(sts, names = {}) {
  const holders = new Map();
  const gaps = new Map();
  const speakerNames = new Set();
  for (const st of sts || []) {
    const h = st.heldBy;
    if (!h) { gaps.set('no_record', (gaps.get('no_record') || 0) + 1); continue; }
    if (h.holder) {
      holders.set(h.holder, (holders.get(h.holder) || 0) + 1);
      if (h.basis === BASIS.ASSERTED) speakerNames.add(h.holder);
    } else if (h.gap) {
      gaps.set(h.gap.type, (gaps.get(h.gap.type) || 0) + 1);
    }
  }
  const silent = Object.keys(names || {}).filter((n) => !speakerNames.has(n)).sort();
  return freeze({
    schema: 'EOHoldersSummary@1',
    statements: (sts || []).length,
    holders: freeze([...holders.entries()].sort((a, b) => b[1] - a[1]).map(([holder, n]) => freeze({ holder, statements: n }))),
    gaps: freeze([...gaps.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => freeze({ type, statements: n }))),
    silent,
  });
}
